/* Quo v46 - authenticated access, admin-only settings/trash and staff user management. */
(function(){
  const SESSION_KEY='quo_auth_session_v1';
  let booted=false;
  let usersLoading=false;

  function slugUsername(value){
    return String(value||'').trim().toLowerCase().replace(/[^a-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'');
  }
  function loginEmail(identifier){
    const raw=String(identifier||'').trim().toLowerCase();
    if(raw.includes('@'))return raw;
    return `quo.${slugUsername(raw)}@users.whitesaffron.local`;
  }
  function saveSession(session){
    try{
      if(!session){localStorage.removeItem(SESSION_KEY);return;}
      localStorage.setItem(SESSION_KEY,JSON.stringify({access_token:session.access_token,refresh_token:session.refresh_token}));
    }catch(e){}
  }
  function storedSession(){
    try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'null')}catch(e){return null}
  }
  function isAdmin(){return S.role==='admin'}
  function actorName(){return String(S.displayName||S.authUser?.email||'White Saffron').trim()||'White Saffron'}

  function ensureGate(){
    let gate=document.getElementById('quoAuthGate');
    if(gate)return gate;
    gate=document.createElement('div');
    gate.id='quoAuthGate';
    gate.className='quo-auth-gate hidden';
    gate.innerHTML=`<div class="quo-login-card">
      <div class="quo-login-brand"><div class="quo-login-mark">WS</div><div><b>QUO</b><span>White Saffron Documents</span></div></div>
      <div class="quo-login-copy"><h1>Sign in</h1><p>Use the main admin email or a staff username.</p></div>
      <form id="quoLoginForm">
        <label>EMAIL OR USERNAME<input id="quoLoginId" autocomplete="username" required placeholder="naappe@gmail.com or username"></label>
        <label>PASSWORD<input id="quoLoginPassword" type="password" autocomplete="current-password" required></label>
        <div id="quoLoginError" class="quo-login-error hidden"></div>
        <button class="btn primary" id="quoLoginButton" type="submit">Sign In</button>
      </form>
    </div>`;
    document.body.appendChild(gate);
    gate.querySelector('#quoLoginForm').addEventListener('submit',login);
    return gate;
  }

  function showLogin(message=''){
    const gate=ensureGate();
    gate.classList.remove('hidden');
    document.getElementById('app')?.setAttribute('aria-hidden','true');
    const err=gate.querySelector('#quoLoginError');
    if(message){err.textContent=message;err.classList.remove('hidden')}else{err.textContent='';err.classList.add('hidden')}
    setTimeout(()=>gate.querySelector('#quoLoginId')?.focus(),30);
  }
  function hideLogin(){
    ensureGate().classList.add('hidden');
    document.getElementById('app')?.removeAttribute('aria-hidden');
  }

  async function login(e){
    e.preventDefault();
    const id=document.getElementById('quoLoginId')?.value||'';
    const password=document.getElementById('quoLoginPassword')?.value||'';
    const button=document.getElementById('quoLoginButton');
    const err=document.getElementById('quoLoginError');
    if(!slugUsername(id)&&!String(id).includes('@'))return;
    button.disabled=true;button.textContent='Signing in...';err.classList.add('hidden');
    try{
      const r=await sb.auth.signInWithPassword({email:loginEmail(id),password});
      if(r.error)throw r.error;
      saveSession(r.data.session);
      const ok=await activateSession(r.data.session);
      if(!ok)throw new Error('This Quo user is not active.');
    }catch(ex){
      await sb.auth.signOut().catch(()=>{});saveSession(null);
      err.textContent=ex?.message==='Invalid login credentials'?'Incorrect username/email or password.':(ex?.message||'Could not sign in.');
      err.classList.remove('hidden');
    }finally{button.disabled=false;button.textContent='Sign In'}
  }

  async function roleFor(user){
    const r=await sb.from('quo_users').select('user_id,role,is_active,display_name,username').eq('user_id',user.id).maybeSingle();
    if(r.error||!r.data||!r.data.is_active)return null;
    return r.data;
  }

  async function activateSession(session){
    const user=session?.user||(await sb.auth.getUser()).data?.user;
    if(!user)return false;
    const role=await roleFor(user);if(!role)return false;
    S.authUser=user;S.role=role.role;S.displayName=role.display_name||role.username||user.email||'User';
    try{prepared=function(){S.preparedBy=actorName();return S.preparedBy}}catch(e){}
    hideLogin();applyPermissions();installAccountFooter();
    S.loading=true;render();
    await loadAll();
    applyPermissions();installAccountFooter();
    return true;
  }

  async function restoreLogin(){
    const stored=storedSession();
    if(!stored?.access_token||!stored?.refresh_token){showLogin();return;}
    try{
      const r=await sb.auth.setSession(stored);
      if(r.error||!r.data.session)throw r.error||new Error('Session expired');
      saveSession(r.data.session);
      if(!await activateSession(r.data.session))throw new Error('Account inactive');
    }catch(e){await sb.auth.signOut().catch(()=>{});saveSession(null);showLogin('Please sign in again.');}
  }

  async function logout(){
    await sb.auth.signOut().catch(()=>{});saveSession(null);
    S.authUser=null;S.role=null;S.displayName='';S.docs=[];S.current=null;S.view='dashboard';S.loading=false;
    showLogin();applyPermissions();
  }

  function installAccountFooter(){
    const foot=document.querySelector('.side-footer');if(!foot||!S.authUser)return;
    foot.innerHTML=`<div class="quo-account"><div><b>${esc(actorName())}</b><span>${isAdmin()?'Administrator':'Staff'}</span></div><button type="button" data-quo-logout>Sign out</button></div><div class="live-pill"><i></i> Supabase connected</div>`;
    foot.querySelector('[data-quo-logout]').onclick=logout;
  }

  function applyPermissions(){
    const settings=document.querySelector('[data-view="settings"]');
    if(settings)settings.hidden=!isAdmin();
    if(typeof window.quoRefreshTrashAccess==='function')window.quoRefreshTrashAccess();
    const trash=document.querySelector('[data-view="trash"]');if(trash)trash.hidden=!isAdmin();
    if(!isAdmin()&&(S.view==='settings'||S.view==='trash')){S.view='dashboard';S.current=null;if(!S.loading)render()}
  }

  function userPanel(){
    return `<section class="panel quo-user-panel">
      <div class="panel-head"><div><h3>User Access</h3><p>Create staff logins without creating an email address. Settings and Trash remain admin-only.</p></div><span class="badge final">ADMIN</span></div>
      <div class="quo-user-create">
        <div class="field"><label>Display Name</label><input id="quoNewDisplay" placeholder="Staff name"></div>
        <div class="field"><label>Username</label><input id="quoNewUsername" autocomplete="off" placeholder="e.g. cashier1"></div>
        <div class="field"><label>Password</label><input id="quoNewPassword" type="password" autocomplete="new-password" placeholder="Minimum 8 characters"></div>
        <button class="btn primary" id="quoCreateUser" type="button">Create User</button>
      </div>
      <div id="quoUserMessage" class="quo-user-message hidden"></div>
      <div id="quoUserList"><div class="empty">Loading users...</div></div>
    </section>`;
  }

  try{
    const baseSettings=renderSettings;
    renderSettings=function(){
      if(!isAdmin())return pageHead('Access restricted','Settings are available only to the administrator.');
      const html=baseSettings();
      const marker='<div class="settings-grid">';
      return html.includes(marker)?html.replace(marker,userPanel()+marker):userPanel()+html;
    };
  }catch(e){}

  async function invokeAdmin(body){
    const r=await sb.functions.invoke('quo-user-admin',{body});
    if(r.error)throw new Error(r.error.message||'User management request failed');
    if(r.data?.error)throw new Error(r.data.error);
    return r.data||{};
  }
  function userMessage(message,bad=false){
    const el=document.getElementById('quoUserMessage');if(!el)return;
    el.textContent=message;el.classList.toggle('bad',bad);el.classList.remove('hidden');
    clearTimeout(userMessage._t);userMessage._t=setTimeout(()=>el.classList.add('hidden'),3000);
  }
  async function loadUsers(){
    if(!isAdmin()||usersLoading||!document.getElementById('quoUserList'))return;
    usersLoading=true;
    try{
      const data=await invokeAdmin({action:'list'});renderUsers(data.users||[]);
    }catch(e){document.getElementById('quoUserList').innerHTML=`<div class="empty">${esc(e.message||'Could not load users')}</div>`}
    finally{usersLoading=false}
  }
  function renderUsers(users){
    const host=document.getElementById('quoUserList');if(!host)return;
    if(!users.length){host.innerHTML='<div class="empty">No users found.</div>';return}
    host.innerHTML=`<div class="table-wrap"><table class="data-table"><thead><tr><th>User</th><th>Login</th><th>Role</th><th>Status</th><th></th></tr></thead><tbody>${users.map(u=>`<tr><td><strong>${esc(u.display_name||'User')}</strong>${u.is_main_admin?'<span class="subline">Main administrator</span>':''}</td><td>${esc(u.username||'')}</td><td>${esc(u.role==='admin'?'Admin':'Staff')}</td><td><span class="badge ${u.is_active?'final':'cancelled'}">${u.is_active?'Active':'Disabled'}</span></td><td class="row-actions">${u.is_main_admin?'':`<button class="table-action" type="button" data-quo-user-toggle="${esc(u.id)}" data-active="${u.is_active?'1':'0'}">${u.is_active?'Disable':'Enable'}</button><button class="table-action" type="button" data-quo-user-reset="${esc(u.id)}">Reset Password</button>`}</td></tr>`).join('')}</tbody></table></div>`;
    host.querySelectorAll('[data-quo-user-toggle]').forEach(b=>b.onclick=async()=>{
      b.disabled=true;try{await invokeAdmin({action:'set_active',user_id:b.dataset.quoUserToggle,is_active:b.dataset.active!=='1'});userMessage('User access updated.');await loadUsers()}catch(e){userMessage(e.message,true)}finally{b.disabled=false}
    });
    host.querySelectorAll('[data-quo-user-reset]').forEach(b=>b.onclick=async()=>{
      const password=prompt('Enter the new password (minimum 8 characters)');if(password===null)return;
      if(password.length<8)return userMessage('Password must be at least 8 characters.',true);
      b.disabled=true;try{await invokeAdmin({action:'reset_password',user_id:b.dataset.quoUserReset,password});userMessage('Password updated.')}catch(e){userMessage(e.message,true)}finally{b.disabled=false}
    });
  }
  async function createUser(){
    const display=document.getElementById('quoNewDisplay')?.value.trim()||'';
    const username=document.getElementById('quoNewUsername')?.value.trim()||'';
    const password=document.getElementById('quoNewPassword')?.value||'';
    if(!display||!username||password.length<8)return userMessage('Enter display name, username and a password of at least 8 characters.',true);
    const btn=document.getElementById('quoCreateUser');btn.disabled=true;btn.textContent='Creating...';
    try{
      await invokeAdmin({action:'create',display_name:display,username,password});
      document.getElementById('quoNewDisplay').value='';document.getElementById('quoNewUsername').value='';document.getElementById('quoNewPassword').value='';
      userMessage('Staff user created.');await loadUsers();
    }catch(e){userMessage(e.message,true)}finally{btn.disabled=false;btn.textContent='Create User'}
  }

  function ensureReceiptDeleteButtons(){
    if(!S.authUser)return;
    document.querySelectorAll('.data-table tbody tr').forEach(row=>{
      const open=row.querySelector('[data-open]');if(!open)return;
      const id=open.dataset.open,d=(S.docs||[]).find(x=>x.id===id);if(!d||d.document_type!=='receipt')return;
      const actions=open.closest('.row-actions');if(!actions||actions.querySelector('[data-delete-doc]'))return;
      const b=document.createElement('button');b.type='button';b.className='table-action danger-text';b.dataset.deleteDoc=id;b.textContent='Delete';actions.appendChild(b);
    });
  }

  function bindAdminUI(){
    applyPermissions();installAccountFooter();ensureReceiptDeleteButtons();
    const create=document.getElementById('quoCreateUser');if(create&&!create.dataset.bound){create.dataset.bound='1';create.onclick=createUser;loadUsers()}
  }
  try{
    const previousBind=bindDynamic;
    bindDynamic=function(){const result=previousBind.apply(this,arguments);bindAdminUI();return result};
  }catch(e){}

  document.addEventListener('click',e=>{
    const settings=e.target.closest?.('[data-view="settings"]');
    if(settings&&!isAdmin()){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();toast('Settings are admin-only.');}
  },true);

  // Rendering replaces large parts of the page. Run this once after a paint rather
  // than once for every inserted row, otherwise large document lists can feel frozen.
  let permissionRefreshQueued=false;
  const permissionObserver=new MutationObserver(()=>{
    if(!S.authUser||permissionRefreshQueued)return;
    permissionRefreshQueued=true;
    requestAnimationFrame(()=>{permissionRefreshQueued=false;applyPermissions()});
  });
  permissionObserver.observe(document.body,{childList:true,subtree:true});

  if(!document.getElementById('quoAuthV46Style')){
    const st=document.createElement('style');st.id='quoAuthV46Style';st.textContent=`
      .quo-auth-gate{position:fixed;inset:0;z-index:2147483646;display:grid;place-items:center;padding:20px;background:#eef1f0}.quo-login-card{width:min(410px,100%);padding:30px;background:#fff;border:1px solid #dfe5e2;border-radius:14px;box-shadow:0 20px 70px rgba(24,38,34,.12)}.quo-login-brand{display:flex;align-items:center;gap:12px}.quo-login-mark{width:46px;height:46px;border:1px solid #d9dfdd;border-radius:10px;display:grid;place-items:center;font-family:Georgia,serif;font-weight:800;color:#754920;background:#fffaf3}.quo-login-brand b{display:block;letter-spacing:.16em;font-size:17px}.quo-login-brand span{display:block;margin-top:2px;font-size:9px;color:#7d8582}.quo-login-copy{margin:28px 0 18px}.quo-login-copy h1{margin:0;font-size:25px}.quo-login-copy p{margin:6px 0 0;color:#707976;font-size:11px}.quo-login-card form{display:grid;gap:14px}.quo-login-card label{display:grid;gap:6px;font-size:9px;letter-spacing:.06em;font-weight:800;color:#66706d}.quo-login-card input{height:44px;border:1px solid #d7dfdc;border-radius:8px;padding:0 12px;font-size:13px;outline:0}.quo-login-card input:focus{border-color:#799d94;box-shadow:0 0 0 3px rgba(45,109,100,.08)}.quo-login-card .btn{height:44px;margin-top:2px}.quo-login-error,.quo-user-message{padding:9px 11px;border:1px solid #e3cbc8;border-radius:7px;background:#fff3f2;color:#98443d;font-size:10px}.quo-user-message{margin:0 16px 12px;border-color:#cfe1d7;background:#f1f8f4;color:#35644d}.quo-user-message.bad{border-color:#e3cbc8;background:#fff3f2;color:#98443d}.quo-account{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px}.quo-account b{display:block;font-size:10px}.quo-account span{display:block;margin-top:2px;font-size:8px;color:#89918e;text-transform:uppercase;letter-spacing:.06em}.quo-account button{border:0;background:transparent;color:#66706d;font-size:8.5px;font-weight:800}.quo-user-panel{margin-bottom:14px}.quo-user-create{display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:10px;align-items:end;padding:14px 16px;border-bottom:1px solid var(--line2)}.quo-user-create .btn{height:39px}.quo-user-panel .data-table td:last-child{text-align:right}.quo-user-panel .row-actions{white-space:nowrap}@media(max-width:900px){.quo-user-create{grid-template-columns:1fr 1fr}.quo-user-create .btn{width:100%}}@media(max-width:560px){.quo-user-create{grid-template-columns:1fr}}
    `;document.head.appendChild(st);
  }

  window.quoAuthBoot=async function(){
    if(booted)return;booted=true;ensureGate();showLogin();await restoreLogin();
  };
  window.quoAuthBoot();
})();
