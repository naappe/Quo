/* Quo v22 - 30 day Trash / Restore. Hard delete is replaced by soft delete. */
(function(){
  const q=s=>document.querySelector(s), qa=s=>[...document.querySelectorAll(s)];

  async function loadActive(){
    const r=await sb.from('quo_documents').select('*').is('deleted_at',null).order('updated_at',{ascending:false}).limit(500);
    if(!r.error)S.docs=r.data||[];
    return r;
  }

  // Make all future refreshes ignore Trash.
  refreshDocs=async function(){
    return loadActive();
  };

  async function softDelete(id){
    const d=S.docs.find(x=>x.id===id);
    if(!d)return;
    if(!confirm(`Move ${d.document_number} to Trash?\n\nIt will be kept for 30 days and can be restored.`))return;
    const name=(typeof prepared==='function'?prepared():S.preparedBy)||'Unknown';
    const r=await sb.from('quo_documents').update({deleted_at:new Date().toISOString(),deleted_by_name:name,updated_by_name:name}).eq('id',id).select('id').single();
    if(r.error){alert('Could not move document to Trash: '+r.error.message);return;}
    await loadActive();
    if(S.current?.id===id)S.current=null;
    toast?.(`${d.document_number} moved to Trash`);
    S.view='documents';
    render();
  }

  async function loadTrash(){
    const r=await sb.from('quo_documents').select('*').not('deleted_at','is',null).order('deleted_at',{ascending:false}).limit(500);
    if(r.error)throw r.error;
    return r.data||[];
  }

  function daysLeft(d){
    const t=new Date(d.deleted_at).getTime()+30*86400000-Date.now();
    return Math.max(0,Math.ceil(t/86400000));
  }

  async function renderTrash(){
    S.view='trash';S.current=null;
    const title=q('#topTitle'), eye=q('#topEyebrow');if(title)title.textContent='Trash';if(eye)eye.textContent='RECOVERY';
    const view=q('#view');if(!view)return;
    view.innerHTML='<div class="panel"><div class="empty">Loading Trash...</div></div>';
    try{
      const rows=await loadTrash();
      view.innerHTML=`<div class="page-head"><div><div class="eyebrow">RECOVERY</div><h2>Trash</h2><p>Deleted documents stay here for 30 days. Restore them any time before automatic removal.</p></div></div>
      <div class="trash-note">Documents are automatically removed permanently after 30 days.</div>
      <div class="panel"><div class="panel-head"><h3>Deleted Documents</h3><span class="trash-count">${rows.length}</span></div>${rows.length?`<div class="table-wrap"><table class="data-table"><thead><tr><th>Document</th><th>Customer</th><th>Deleted</th><th>Remaining</th><th></th></tr></thead><tbody>${rows.map(d=>`<tr><td><strong>${esc(d.document_number)}</strong><span class="subline">${esc(CFG[d.document_type]?.label||d.document_type)}</span></td><td>${esc(d.customer_name||'No customer')}</td><td>${esc(new Date(d.deleted_at).toLocaleString())}<span class="subline">by ${esc(d.deleted_by_name||'Unknown')}</span></td><td><span class="badge sent">${daysLeft(d)} days</span></td><td class="row-actions"><button class="table-action restore-action" type="button" data-restore-doc="${d.id}">Restore</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Trash is empty.</div>'}</div>`;
      qa('[data-restore-doc]').forEach(b=>b.onclick=()=>restoreDoc(b.dataset.restoreDoc));
    }catch(e){view.innerHTML=`<div class="panel"><div class="empty">Could not load Trash: ${esc(e.message)}</div></div>`}
  }

  async function restoreDoc(id){
    const name=(typeof prepared==='function'?prepared():S.preparedBy)||'Unknown';
    const r=await sb.from('quo_documents').update({deleted_at:null,deleted_by_name:null,updated_by_name:name}).eq('id',id).select('document_number').single();
    if(r.error){alert('Restore failed: '+r.error.message);return;}
    await loadActive();
    toast?.(`${r.data.document_number} restored`);
    renderTrash();
  }

  function installTrashNav(){
    if(q('[data-view="trash"]'))return;
    const receipt=q('[data-view="documents"][data-filter="receipt"]');
    if(!receipt)return;
    const b=document.createElement('button');
    b.dataset.view='trash';
    b.innerHTML='<span class="nav-icon">♲</span><span>Trash</span>';
    receipt.insertAdjacentElement('afterend',b);
    b.onclick=()=>{qa('.nav button').forEach(x=>x.classList.remove('active'));b.classList.add('active');renderTrash();q('#sidebar')?.classList.remove('open')};
  }

  // Capture delete before older modules can hard-delete it.
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

  installTrashNav();
  const mo=new MutationObserver(()=>installTrashNav());mo.observe(document.body,{childList:true,subtree:true});

  // Re-load active documents once this patch is installed so Trash never leaks into normal lists.
  setTimeout(async()=>{await loadActive();if(S.view!=='editor'&&S.view!=='trash')render()},300);
})();
