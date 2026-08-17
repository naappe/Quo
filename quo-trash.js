/* Quo v46 - soft delete for all documents; Trash and restore are admin-only. */
(function(){
  const q=s=>document.querySelector(s), qa=s=>[...document.querySelectorAll(s)];
  const isAdmin=()=>typeof S!=='undefined'&&S.role==='admin';

  async function softDelete(id){
    const d=(S.docs||[]).find(x=>x.id===id);
    if(!d)return;
    const label=d.document_type==='receipt'?'receipt':'document';
    const extra=d.document_type==='receipt'?'\n\nDeleting a receipt will automatically recalculate the related invoice payment balance.':'';
    if(!confirm(`Move ${d.document_number} to Trash?\n\nThis ${label} will be kept for 30 days.${extra}`))return;
    const name=(typeof prepared==='function'?prepared():S.displayName||S.preparedBy)||'Unknown';
    const r=await sb.from('quo_documents').update({deleted_at:new Date().toISOString(),deleted_by_name:name,updated_by_name:name}).eq('id',id);
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

  function daysLeft(d){
    const t=new Date(d.deleted_at).getTime()+30*86400000-Date.now();
    return Math.max(0,Math.ceil(t/86400000));
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
      <div class="trash-note">Deleted documents are kept for recovery. Receipt deletion automatically reconciles the related invoice balance.</div>
      <div class="panel"><div class="panel-head"><h3>Deleted Documents</h3><span class="trash-count">${rows.length}</span></div>${rows.length?`<div class="table-wrap"><table class="data-table"><thead><tr><th>Document</th><th>Customer</th><th>Deleted</th><th>Remaining</th><th></th></tr></thead><tbody>${rows.map(d=>`<tr><td><strong>${esc(d.document_number)}</strong><span class="subline">${esc(CFG[d.document_type]?.label||d.document_type)}</span></td><td>${esc(d.customer_name||'No customer')}</td><td>${esc(new Date(d.deleted_at).toLocaleString())}<span class="subline">by ${esc(d.deleted_by_name||'Unknown')}</span></td><td><span class="badge sent">${daysLeft(d)} days</span></td><td class="row-actions"><button class="table-action restore-action" type="button" data-restore-doc="${d.id}">Restore</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Trash is empty.</div>'}</div>`;
      qa('[data-restore-doc]').forEach(b=>b.onclick=()=>restoreDoc(b.dataset.restoreDoc));
    }catch(e){view.innerHTML=`<div class="panel"><div class="empty">Could not load Trash: ${esc(e.message)}</div></div>`}
  }

  async function restoreDoc(id){
    if(!isAdmin())return toast?.('Restore is admin-only.');
    const name=(typeof prepared==='function'?prepared():S.displayName||S.preparedBy)||'Unknown';
    const row=(await sb.from('quo_documents').select('document_number').eq('id',id).maybeSingle()).data;
    const r=await sb.from('quo_documents').update({deleted_at:null,deleted_by_name:null,updated_by_name:name}).eq('id',id);
    if(r.error){alert('Restore failed: '+r.error.message);return;}
    if(typeof refreshDocs==='function')await refreshDocs();
    toast?.(`${row?.document_number||'Document'} restored`);
    renderTrash();
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
    .trash-note{margin:0 0 12px;padding:10px 12px;border:1px solid #eadfbf;border-radius:9px;background:#fff8e8;color:#74541d;font-size:10px;line-height:1.45}
    .trash-count{min-width:24px;height:24px;border-radius:999px;background:#f1f3f3;display:grid;place-items:center;font-size:10px;font-weight:800;color:#68716f}
    .restore-action{color:#2f6b50!important;font-weight:800!important}
  `;
  document.head.appendChild(style);

  window.quoRefreshTrashAccess=installTrashNav;
  installTrashNav();
  const mo=new MutationObserver(()=>installTrashNav());mo.observe(document.body,{childList:true,subtree:true});
})();