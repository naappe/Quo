/* Quo v59 - safe soft delete for all documents; Trash/restore are admin-only. */
(function(){
  const q=s=>document.querySelector(s), qa=s=>[...document.querySelectorAll(s)];
  const isAdmin=()=>typeof S!=='undefined'&&S.role==='admin';

  async function softDelete(id){
    const d=(S.docs||[]).find(x=>x.id===id);
    if(!d)return;
    const label=d.document_type==='receipt'?'receipt':'document';
    const extra=d.document_type==='receipt'?'\n\nDeleting a receipt will automatically recalculate the related invoice balance.':'';
    if(!confirm(`Move ${d.document_number} to Trash?\n\nThe ${label} can be restored later by an administrator.${extra}`))return;
    const name=(S.displayName||S.preparedBy||'White Saffron').trim()||'White Saffron';
    const r=await sb.rpc('quo_soft_delete_document',{p_document_id:id,p_actor:name});
    if(r.error){alert('Could not move document to Trash: '+r.error.message);return;}
    if(typeof refreshDocs==='function')await refreshDocs();
    if(S.current?.id===id)S.current=null;
    toast?.(`${d.document_number} moved to Trash`);
    S.view='documents';S.filter=d.document_type||'all';
    render();
  }

  async function loadTrash(){
    if(!isAdmin())throw new Error('Admin access required');
    const out=[];const page=1000;
    for(let from=0;;from+=page){
      const r=await sb.from('quo_documents').select('*').not('deleted_at','is',null).order('deleted_at',{ascending:false}).range(from,from+page-1);
      if(r.error)throw r.error;
      out.push(...(r.data||[]));
      if((r.data||[]).length<page)break;
    }
    return out;
  }

  async function renderTrash(){
    if(!isAdmin()){
      S.view='dashboard';S.current=null;toast?.('Trash is admin-only.');render();return;
    }
    S.view='trash';S.current=null;
    const title=q('#topTitle'),eye=q('#topEyebrow');if(title)title.textContent='Trash';if(eye)eye.textContent='ADMIN';
    const view=q('#view');if(!view)return;
    view.innerHTML='<div class="panel"><div class="empty">Loading Trash...</div></div>';
    try{
      const rows=await loadTrash();
      view.innerHTML=`<div class="page-head"><div><div class="eyebrow">ADMIN RECOVERY</div><h2>Trash</h2><p>Only the administrator can view or restore deleted documents.</p></div></div>
      <div class="trash-note">Deleted documents stay here for recovery. Restoring a linked document is allowed only when its workflow remains consistent.</div>
      <div class="panel"><div class="panel-head"><h3>Deleted Documents</h3><span class="trash-count">${rows.length}</span></div>${rows.length?`<div class="table-wrap"><table class="data-table"><thead><tr><th>Document</th><th>Customer</th><th>Deleted</th><th></th></tr></thead><tbody>${rows.map(d=>`<tr><td><strong>${esc(d.document_number)}</strong><span class="subline">${esc(CFG[d.document_type]?.label||d.document_type)}</span></td><td>${esc(d.customer_name||'No customer')}</td><td>${esc(new Date(d.deleted_at).toLocaleString())}<span class="subline">by ${esc(d.deleted_by_name||'Unknown')}</span></td><td class="row-actions"><button class="table-action restore-action" type="button" data-restore-doc="${d.id}">Restore</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Trash is empty.</div>'}</div>`;
      qa('[data-restore-doc]').forEach(b=>b.onclick=()=>restoreDoc(b.dataset.restoreDoc));
    }catch(e){view.innerHTML=`<div class="panel"><div class="empty">Could not load Trash: ${esc(e.message)}</div></div>`}
  }

  async function restoreDoc(id){
    if(!isAdmin())return toast?.('Restore is admin-only.');
    const button=document.querySelector(`[data-restore-doc="${id}"]`);
    if(button){button.disabled=true;button.textContent='Restoring...';}
    try{
      const r=await sb.rpc('quo_restore_document',{p_document_id:id});
      if(r.error)throw r.error;
      const no=r.data?.document_number||'Document';
      if(typeof refreshDocs==='function')await refreshDocs();
      toast?.(`${no} restored`);
      await renderTrash();
    }catch(e){
      alert('Restore failed: '+(e?.message||'Unknown error'));
      if(button){button.disabled=false;button.textContent='Restore';}
    }
  }

  function installTrashNav(){
    const existing=q('[data-view="trash"]');
    if(!isAdmin()){
      if(existing)existing.remove();
      return;
    }
    if(existing)return;
    const receipt=q('[data-view="documents"][data-filter="receipt"]');
    if(!receipt)return;
    const b=document.createElement('button');
    b.dataset.view='trash';
    b.innerHTML='<span class="nav-icon">♲</span><span>Trash</span>';
    receipt.insertAdjacentElement('afterend',b);
    b.onclick=()=>{qa('.nav button').forEach(x=>x.classList.remove('active'));b.classList.add('active');renderTrash();q('#sidebar')?.classList.remove('open')};
  }

  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-delete-doc]');
    if(!b)return;
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
    softDelete(b.dataset.deleteDoc);
  },true);

  const style=document.createElement('style');
  style.textContent=`
    .trash-note{margin:0 0 12px;padding:10px 12px;border:1px solid #dfe7e3;border-radius:9px;background:#f7faf8;color:#52625d;font-size:10px;line-height:1.45}
    .trash-count{min-width:24px;height:24px;border-radius:999px;background:#f1f3f3;display:grid;place-items:center;font-size:10px;font-weight:800;color:#68716f}
    .restore-action{color:#2f6b50!important;font-weight:800!important}
  `;
  document.head.appendChild(style);

  window.quoRefreshTrashAccess=installTrashNav;
  installTrashNav();
  const mo=new MutationObserver(()=>installTrashNav());mo.observe(document.body,{childList:true,subtree:true});
})();