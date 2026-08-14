/* Quo v5 interaction patch: edit/delete, soft delete, payment visibility, active-record filtering. */

const _quoRenderEditor=renderEditor;
renderEditor=function(){
  let html=_quoRenderEditor();
  if(S.current?.id){
    html=html.replace('<button class="btn primary" data-save>Update</button>','<button class="btn danger" data-delete-current>Delete</button><button class="btn primary" data-save>Update</button>');
  }
  return html;
};

function paymentSummaryLine(d){
  const c=calc(d);
  if(d.document_type==='receipt')return `<span class="payment-line paid-line">Received ${money(c.total,d.currency)}</span>`;
  if(!['proforma','invoice'].includes(d.document_type)||d.status==='Cancelled')return '';
  if(c.paid>0&&c.balance>0)return `<span class="payment-line part-line">Paid ${money(c.paid,d.currency)} - Due ${money(c.balance,d.currency)}</span>`;
  if(c.paid>0&&c.balance<=0)return `<span class="payment-line paid-line">Paid ${money(c.paid,d.currency)}</span>`;
  if(c.balance>0)return `<span class="payment-line due-line">Due ${money(c.balance,d.currency)}</span>`;
  return '';
}

tableDocs=function(rows,compact=false){
  if(!rows.length)return '<div class="empty">No documents found.</div>';
  const actionHead=compact?'':'<th class="actions-col">Actions</th>';
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Document</th><th>Customer</th><th>Date</th><th class="num">Total</th><th>Status</th>${actionHead}</tr></thead><tbody>${rows.map(d=>{const c=calc(d);const rowOpen=compact?` data-open="${d.id}"`:'';const actions=compact?'':`<td class="row-actions"><button class="table-action" data-open="${d.id}" type="button">Edit</button><button class="table-action danger-text" data-delete-doc="${d.id}" type="button">Delete</button></td>`;return `<tr${rowOpen}><td><strong>${esc(d.document_number)}</strong><span class="subline">${esc(CFG[d.document_type]?.label||d.document_type)}</span></td><td>${esc(d.customer_name||'No customer')}</td><td>${esc(dateTiny(d.creation_date)||'-')}</td><td class="num">${moneyOnly(c.total)}</td><td><span class="badge ${statusClass(d.status)}">${esc(d.status||'Draft')}</span>${paymentSummaryLine(d)}</td>${actions}</tr>`}).join('')}</tbody></table></div>`;
};

renderDashboard=function(){
  const q=S.docs.filter(d=>d.document_type==='quotation');
  const p=S.docs.filter(d=>d.document_type==='proforma');
  const inv=S.docs.filter(d=>d.document_type==='invoice');
  const commercial=[...p,...inv].filter(d=>d.status!=='Cancelled');
  const qAwait=q.filter(d=>['Draft','Sent'].includes(d.status)).length;
  const pAwait=p.filter(d=>d.status!=='Cancelled'&&calc(d).balance>0).length;
  const iPaid=inv.filter(d=>d.status!=='Cancelled'&&(calc(d).balance<=0||d.status==='Paid')).length;
  const pendingAmount=commercial.reduce((a,d)=>a+calc(d).balance,0);
  const pendingDocs=commercial.filter(d=>calc(d).balance>0).length;
  const paidAmount=commercial.reduce((a,d)=>a+Math.min(calc(d).paid,calc(d).total),0);
  const paidDocs=commercial.filter(d=>calc(d).paid>0).length;
  const recent=S.docs.slice(0,8);
  const today=isoToday();
  const active=S.docs.filter(d=>d.service_enabled&&d.service_to&&d.service_to>=today&&d.status!=='Cancelled').sort((a,b)=>String(a.service_from).localeCompare(String(b.service_from))).slice(0,5);
  return pageHead('Welcome back','Create, send and track White Saffron commercial documents without ERP clutter.','<button class="btn primary" data-new>+ New Document</button>')+
    `<section class="kpis payment-kpis">${kpi('Quotations',q.length,`${qAwait} awaiting action`,'QT')}${kpi('Proforma',p.length,`${pAwait} awaiting payment`,'PI')}${kpi('Invoices',inv.length,`${iPaid} fully paid`,'INV')}${kpi('Pending Payment',money(pendingAmount,S.settings.currency),`${pendingDocs} documents`,'DUE','money pending-kpi')}${kpi('Paid',money(paidAmount,S.settings.currency),`${paidDocs} documents with payment`,'PAID','money paid-kpi')}</section>`+
    `<section class="dashboard-grid"><div class="panel"><div class="panel-head"><h3>Recent Documents</h3><button data-go-docs>View all</button></div>${tableDocs(recent,true)}</div><div class="panel"><div class="panel-head"><h3>Upcoming / Active</h3></div><div class="upcoming">${active.length?active.map(eventCard).join(''):'<div class="empty">No upcoming catering services.</div>'}</div></div></section>`;
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
  const st=document.createElement('style');st.id='quoPatchStyle';st.textContent=`
  .btn.danger{border-color:#e5caca;color:#9c3d3d;background:#fff}.btn.danger:hover{background:#fff7f7;border-color:#d8aaaa}
  .actions-col{width:118px}.row-actions{white-space:nowrap;text-align:right}.table-action{border:0;background:transparent;color:var(--brand-dark);font-size:9px;font-weight:850;padding:6px 7px;cursor:pointer}.table-action:hover{text-decoration:underline}.danger-text{color:#a04444}
  .payment-kpis{grid-template-columns:repeat(5,minmax(0,1fr))}.pending-kpi{border-color:#eadfca}.pending-kpi .glyph{background:var(--warn-bg);color:var(--warn)}.paid-kpi{border-color:#d8e9dd}.paid-kpi .glyph{background:var(--good-bg);color:var(--good)}
  .payment-line{display:block;font-size:8px;font-weight:750;margin-top:4px;white-space:nowrap}.due-line{color:var(--warn)}.part-line{color:#7b6a31}.paid-line{color:var(--good)}.badge.part-paid{background:var(--warn-bg);color:var(--warn)}
  @media(max-width:1180px){.payment-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:760px){.payment-kpis{grid-template-columns:1fr 1fr}}@media(max-width:460px){.payment-kpis{grid-template-columns:1fr}}
  `;document.head.appendChild(st);
}
