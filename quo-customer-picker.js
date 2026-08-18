/* Quo v63 - integrated customer autocomplete for name and mobile. */
(function(){
  const clean=value=>String(value||'').trim();
  const normName=value=>clean(value).toLowerCase().replace(/\s+/g,' ');
  function normPhone(value){
    let digits=clean(value).replace(/\D/g,'');
    if(digits.length===10&&digits.startsWith('960'))digits=digits.slice(3);
    return digits;
  }

  function customerRows(){
    const docs=(typeof S!=='undefined'&&Array.isArray(S.docs)?S.docs:[])
      .filter(d=>!d.deleted_at&&clean(d.customer_name))
      .sort((a,b)=>String(b.updated_at||b.created_at||'').localeCompare(String(a.updated_at||a.created_at||'')));
    const map=new Map();
    for(const d of docs){
      const phone=normPhone(d.customer_phone), name=normName(d.customer_name);
      const key=phone?`p:${phone}`:`n:${name}`;
      if(!map.has(key)){
        map.set(key,{name:clean(d.customer_name),phone:clean(d.customer_phone),address:clean(d.customer_address),updatedAt:d.updated_at||d.created_at||'',count:1});
      }else{
        const row=map.get(key);row.count++;
        if(!row.phone&&clean(d.customer_phone))row.phone=clean(d.customer_phone);
        if(!row.address&&clean(d.customer_address))row.address=clean(d.customer_address);
      }
    }
    return [...map.values()];
  }

  function score(row,query,mode){
    const q=clean(query), qName=normName(q), qPhone=normPhone(q);
    const name=normName(row.name), phone=normPhone(row.phone), address=clean(row.address).toLowerCase();
    if(!q)return 1;
    let s=0;
    if(qPhone){
      if(phone===qPhone)s=120;
      else if(phone.startsWith(qPhone))s=95;
      else if(phone.includes(qPhone))s=80;
    }
    if(qName){
      if(name===qName)s=Math.max(s,110);
      else if(name.startsWith(qName))s=Math.max(s,90);
      else if(name.includes(qName))s=Math.max(s,70);
      else if(address.includes(qName))s=Math.max(s,40);
    }
    if(mode==='phone'&&qPhone&&phone===qPhone)s+=20;
    if(mode==='name'&&qName&&name===qName)s+=20;
    return s;
  }

  function matches(query,mode){
    const q=clean(query);
    return customerRows()
      .map(row=>({row,score:score(row,q,mode)}))
      .filter(x=>q?x.score>0:true)
      .sort((a,b)=>b.score-a.score||String(b.row.updatedAt).localeCompare(String(a.row.updatedAt)))
      .slice(0,q?6:5)
      .map(x=>x.row);
  }

  function setDirty(){
    if(typeof S!=='undefined')S.editorDirty=true;
    try{if(typeof updateEditorSaveState==='function')updateEditorSaveState()}catch(e){}
  }

  function closeAll(){
    document.querySelectorAll('.quo-customer-smart-results').forEach(box=>{box.hidden=true;box.innerHTML=''});
    document.querySelectorAll('.quo-customer-smart-field').forEach(field=>field.classList.remove('quo-customer-open'));
  }

  function useCustomer(row){
    if(!row||typeof S==='undefined'||!S.current)return;
    const name=document.querySelector('[data-field="customer_name"]');
    const phone=document.querySelector('[data-field="customer_phone"]');
    const address=document.querySelector('[data-field="customer_address"]');
    if(name)name.value=row.name||'';
    if(phone)phone.value=row.phone||'';
    if(address)address.value=row.address||'';
    S.current.customer_name=row.name||'';
    S.current.customer_phone=row.phone||'';
    S.current.customer_address=row.address||'';
    setDirty();closeAll();clearMatchHint();
    try{window.quoRefreshLivePreview?.()}catch(e){}
    try{toast?.(`${row.name} selected`)}catch(e){}
  }

  function resultHTML(rows,query,mode){
    if(!rows.length)return '<div class="quo-customer-none">No existing customer match</div>';
    const qPhone=normPhone(query);
    return rows.map((row,i)=>{
      const exact=mode==='phone'&&qPhone&&normPhone(row.phone)===qPhone;
      return `<button type="button" class="quo-customer-smart-result" data-customer-index="${i}">
        <span class="quo-customer-smart-main"><b>${esc(row.name)}</b><small>${row.phone?esc(row.phone):'No mobile'}${row.count>1?` · ${row.count} documents`:''}</small></span>
        <span class="quo-customer-smart-side">${exact?'<strong>Exact mobile</strong>':''}${row.address?`<em>${esc(row.address)}</em>`:''}</span>
      </button>`;
    }).join('');
  }

  let activeRows=[], activeIndex=-1, activeInput=null;
  function openResults(input,mode,showRecent=false){
    const field=input.closest('.field');
    const box=field?.querySelector('.quo-customer-smart-results');if(!box)return;
    const query=clean(input.value);
    if(!query&&!showRecent){box.hidden=true;field.classList.remove('quo-customer-open');return;}
    activeRows=matches(query,mode);activeIndex=-1;activeInput=input;
    box.innerHTML=`${!query?'<div class="quo-customer-recent-label">Recent customers</div>':''}${resultHTML(activeRows,query,mode)}`;
    box.hidden=false;field.classList.add('quo-customer-open');
    box.querySelectorAll('[data-customer-index]').forEach(btn=>btn.onclick=e=>{
      e.preventDefault();e.stopPropagation();useCustomer(activeRows[Number(btn.dataset.customerIndex)]);
    });
  }

  function moveActive(delta){
    if(!activeInput)return;
    const field=activeInput.closest('.field'), buttons=[...(field?.querySelectorAll('[data-customer-index]')||[])];
    if(!buttons.length)return;
    activeIndex=(activeIndex+delta+buttons.length)%buttons.length;
    buttons.forEach((b,i)=>b.classList.toggle('active',i===activeIndex));
    buttons[activeIndex].scrollIntoView({block:'nearest'});
  }

  function keyboard(e){
    const field=e.target.closest('.field'), box=field?.querySelector('.quo-customer-smart-results');
    if(!box||box.hidden)return;
    if(e.key==='ArrowDown'){e.preventDefault();moveActive(1)}
    else if(e.key==='ArrowUp'){e.preventDefault();moveActive(-1)}
    else if(e.key==='Enter'){
      if(activeRows.length){e.preventDefault();useCustomer(activeRows[activeIndex>=0?activeIndex:0])}
    }else if(e.key==='Escape'){e.preventDefault();closeAll()}
  }

  function exactPhone(value){
    const p=normPhone(value);if(!p)return null;
    return customerRows().find(row=>normPhone(row.phone)===p)||null;
  }

  function clearMatchHint(){
    document.querySelectorAll('.quo-customer-match-hint').forEach(el=>el.remove());
  }

  function phoneMatchHint(phoneInput){
    clearMatchHint();
    const p=normPhone(phoneInput.value);if(p.length<7)return;
    const row=exactPhone(phoneInput.value);if(!row)return;
    const currentName=normName(document.querySelector('[data-field="customer_name"]')?.value);
    if(currentName===normName(row.name))return;
    const hint=document.createElement('button');
    hint.type='button';hint.className='quo-customer-match-hint';
    hint.innerHTML=`<span>Existing customer</span><b>${esc(row.name)}</b><em>Use details</em>`;
    hint.onclick=e=>{e.preventDefault();e.stopPropagation();useCustomer(row)};
    phoneInput.closest('.field')?.appendChild(hint);
  }

  function ensureResults(field){
    let box=field.querySelector('.quo-customer-smart-results');
    if(!box){box=document.createElement('div');box.className='quo-customer-smart-results';box.hidden=true;field.appendChild(box)}
    field.classList.add('quo-customer-smart-field');
    return box;
  }

  function install(){
    if(typeof S==='undefined'||S.view!=='editor'||!S.current)return;
    document.querySelectorAll('.quo-customer-picker').forEach(el=>el.remove());
    const name=document.querySelector('[data-field="customer_name"]');
    const phone=document.querySelector('[data-field="customer_phone"]');
    if(!name||!phone)return;

    ensureResults(name.closest('.field'));ensureResults(phone.closest('.field'));
    name.autocomplete='off';phone.autocomplete='off';phone.inputMode='tel';

    name.onfocus=()=>openResults(name,'name',true);
    name.oninput=()=>{setDirty();openResults(name,'name',false);clearMatchHint()};
    name.onkeydown=keyboard;

    phone.onfocus=()=>openResults(phone,'phone',true);
    phone.oninput=()=>{setDirty();openResults(phone,'phone',false);phoneMatchHint(phone)};
    phone.onchange=()=>phoneMatchHint(phone);
    phone.onkeydown=keyboard;
    phoneMatchHint(phone);
  }

  document.addEventListener('click',e=>{
    if(!e.target.closest('.quo-customer-smart-field,.quo-customer-match-hint'))closeAll();
  },true);

  try{
    const previousBind=bindDynamic;
    bindDynamic=function(){const result=previousBind.apply(this,arguments);install();return result};
  }catch(e){}

  if(!document.getElementById('quoCustomerPickerV63Style')){
    const st=document.createElement('style');st.id='quoCustomerPickerV63Style';st.textContent=`
      .quo-customer-smart-field{position:relative}.quo-customer-smart-field.quo-customer-open{z-index:120}
      .quo-customer-smart-results{position:absolute;left:0;right:0;top:calc(100% + 4px);z-index:1400;padding:5px;border:1px solid #d4dedb;border-radius:9px;background:#fff;box-shadow:0 16px 38px rgba(25,42,37,.16);max-height:286px;overflow:auto}
      .quo-customer-recent-label{padding:6px 9px 5px;font-size:8px;font-weight:850;letter-spacing:.07em;text-transform:uppercase;color:#7a8782}
      .quo-customer-smart-result{width:100%;min-height:48px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 10px;border:0;border-bottom:1px solid #edf1ef;border-radius:6px;background:#fff;text-align:left;cursor:pointer}.quo-customer-smart-result:last-child{border-bottom:0}.quo-customer-smart-result:hover,.quo-customer-smart-result:focus-visible,.quo-customer-smart-result.active{background:#f2f8f5;outline:none}
      .quo-customer-smart-main{min-width:0}.quo-customer-smart-main b{display:block;font-size:10.5px;color:#24312d}.quo-customer-smart-main small{display:block;margin-top:3px;font-size:8.5px;color:#697670}.quo-customer-smart-side{max-width:48%;display:flex;flex-direction:column;align-items:flex-end;gap:3px}.quo-customer-smart-side strong{font-size:7.5px;padding:2px 5px;border-radius:999px;background:#e8f4ef;color:#2e6759}.quo-customer-smart-side em{font-style:normal;font-size:8px;line-height:1.3;text-align:right;color:#7b8782}
      .quo-customer-none{padding:10px;font-size:9px;color:#7a8581}
      .quo-customer-match-hint{width:100%;margin-top:6px;min-height:38px;display:flex;align-items:center;gap:7px;padding:7px 9px;border:1px solid #cfe1da;border-radius:7px;background:#f1f8f5;color:#48655c;text-align:left;cursor:pointer}.quo-customer-match-hint:hover{background:#e9f5f0}.quo-customer-match-hint span{font-size:8px;color:#74817c}.quo-customer-match-hint b{font-size:9px;color:#29483f}.quo-customer-match-hint em{margin-left:auto;font-style:normal;font-size:8px;font-weight:850;color:#2e6d60}
      @media(max-width:620px){.quo-customer-smart-results{position:fixed;left:12px;right:12px;top:auto;bottom:12px;max-height:52vh;border-radius:13px;padding:7px;box-shadow:0 18px 50px rgba(18,32,28,.24)}.quo-customer-smart-result{min-height:56px;align-items:flex-start;flex-direction:column;gap:4px;padding:10px 11px}.quo-customer-smart-side{max-width:none;align-items:flex-start}.quo-customer-smart-side em{text-align:left}.quo-customer-smart-side strong{order:2}.quo-customer-match-hint{min-height:44px}}
    `;document.head.appendChild(st);
  }
})();
