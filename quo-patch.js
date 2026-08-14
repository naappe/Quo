/* Quo v4 interaction patch: explicit Edit/Delete, soft delete, active-record filtering. */

const _quoRenderEditor=renderEditor;
renderEditor=function(){
  let html=_quoRenderEditor();
  if(S.current?.id){
    html=html.replace('<button class="btn primary" data-save>Update</button>','<button class="btn danger" data-delete-current>Delete</button><button class="btn primary" data-save>Update</button>');
  }
  return html;
};

tableDocs=function(rows,compact=false){
  if(!rows.length)return '<div class="empty">No documents found.</div>';
  const actionHead=compact?'':'<th class="actions-col">Actions</th>';
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Document</th><th>Customer</th><th>Date</th><th class="num">Total</th><th>Status</th>${actionHead}</tr></thead><tbody>${rows.map(d=>{const c=calc(d);const rowOpen=compact?` data-open="${d.id}"`:'';const actions=compact?'':`<td class="row-actions"><button class="table-action" data-open="${d.id}" type="button">Edit</button><button class="table-action danger-text" data-delete-doc="${d.id}" type="button">Delete</button></td>`;return `<tr${rowOpen}><td><strong>${esc(d.document_number)}</strong><span class="subline">${esc(CFG[d.document_type]?.label||d.document_type)}</span></td><td>${esc(d.customer_name||'No customer')}</td><td>${esc(dateTiny(d.creation_date)||'-')}</td><td class="num">${moneyOnly(c.total)}</td><td><span class="badge ${statusClass(d.status)}">${esc(d.status||'Draft')}</span></td>${actions}</tr>`}).join('')}</tbody></table></div>`;
};

renderDocuments=function(){
  const label=S.filter==='all'?'All Documents':CFG[S.filter].plural;
  let rows=S.filter==='all'?S.docs:S.docs.filter(d=>d.document_type===S.filter);
  const q=S.search.trim().toLowerCase();
  if(q)rows=rows.filter(d=>[d.document_number,d.customer_name,d.customer_phone,d.status].some(v=>String(v||'').toLowerCase().includes(q)));
  const chips=['all','quotation','proforma','invoice','receipt'].map(k=>`<button class="chip ${S.filter===k?'active':''}" data-doc-filter="${k}">${k==='all'?'All':CFG[k].label}</button>`).join('');
  return pageHead(label,'Search, edit or delete commercial documents from one clean document engine.','<button class="btn primary" data-new>+ New Document</button>')+`<div class="toolbar-row"><label class="search"><input id="docSearch" value="${esc(S.search)}" placeholder="Search document, customer or status..."></label><div class="chips">${chips}</div></div><div class="panel">${tableDocs(rows)}</div>`;
};

loadAll=async function(){
  S.loading=true;render();
  const [dr,sr]=await Promise.all([
    sb.from('quo_documents').select('*').is('deleted_at',null).order('updated_at',{ascending:false}).limit(500),
    sb.from('quo_settings').select('*').eq('id',1).maybeSingle()
  ]);
  if(dr.error){console.error(dr.error);toast('Could not load documents')}else S.docs=dr.data||[];
  if(!sr.error&&sr.data)S.settings={...defaultSettings,...sr.data,bank:FIXED.bank,account_number:FIXED.account,viber:FIXED.viber,phone:FIXED.hotline};
  S.loading=false;render();
};

refreshDocs=async function(){
  const r=await sb.from('quo_documents').select('*').is('deleted_at',null).order('updated_at',{ascending:false}).limit(500);
  if(!r.error)S.docs=r.data||[];
};

async function reverseDeletedReceipt(receipt,name){
  if(receipt.document_type!=='receipt'||!receipt.source_document_id)return;
  const src=S.docs.find(x=>x.id===receipt.source_document_id);
  if(!src||!['invoice','proforma'].includes(src.document_type))return;
  const total=calc(src).total;
  const newPaid=Math.max(0,num(src.paid_amount)-calc(receipt).total);
  const status=newPaid>=total&&total>0?'Paid':newPaid>0?'Part Paid':src.document_type==='proforma'?'Awaiting Payment':'Sent';
  const r=await sb.from('quo_documents').update({paid_amount:newPaid,status,updated_by:null,updated_by_name:name}).eq('id',src.id);
  if(r.error)console.warn('Document deleted, but linked payment reversal failed',r.error);
}

async function softDeleteDocument(id){
  const d=(S.current?.id===id?S.current:S.docs.find(x=>x.id===id));
  if(!d)return;
  const name=prepared();
  if(!name){alert('Enter Prepared By before deleting a document.');$('#preparedBy')?.focus();return}
  if(!confirm(`Delete ${d.document_number}?\n\nIt will disappear from Quo, but a recovery copy remains in the database.`))return;
  try{
    const r=await sb.from('quo_documents').update({deleted_at:new Date().toISOString(),deleted_by_name:name,updated_by:null,updated_by_name:name}).eq('id',d.id).select('id').single();
    if(r.error)throw r.error;
    await reverseDeletedReceipt(d,name);
    await refreshDocs();
    if(S.current?.id===d.id){S.current=null;S.view='documents';S.filter='all';S.search=''}
    toast(`${d.document_number} deleted`);
    render();
  }catch(e){console.error(e);alert('Delete failed: '+e.message)}
}

document.addEventListener('click',e=>{
  const listDelete=e.target.closest('[data-delete-doc]');
  if(listDelete){e.preventDefault();e.stopPropagation();softDeleteDocument(listDelete.dataset.deleteDoc);return}
  const currentDelete=e.target.closest('[data-delete-current]');
  if(currentDelete){e.preventDefault();e.stopPropagation();softDeleteDocument(S.current?.id);return}
},true);

if(!document.getElementById('quoPatchStyle')){
  const st=document.createElement('style');st.id='quoPatchStyle';st.textContent=`.btn.danger{border-color:#e5caca;color:#9c3d3d;background:#fff}.btn.danger:hover{background:#fff7f7;border-color:#d8aaaa}.actions-col{width:118px}.row-actions{white-space:nowrap;text-align:right}.table-action{border:0;background:transparent;color:var(--brand-dark);font-size:9px;font-weight:850;padding:6px 7px;cursor:pointer}.table-action:hover{text-decoration:underline}.danger-text{color:#a04444}`;document.head.appendChild(st);
}
