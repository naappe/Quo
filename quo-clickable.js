/* Quo v19 interaction pass: make dashboard, document rows, pipeline and customers clickable with useful drill-down filters. */

const _quoClickableKpi=kpi;
kpi=function(label,value,sub,glyph,cls=''){
  const map={
    'Open Quotations':'open-quotes',
    'Quotations':'quotations',
    'Confirmed Deals':'confirmed-quotes',
    'Proforma':'proforma',
    'Invoices':'invoice',
    'Pending Payment':'pending-payment',
    'Paid':'paid-payment'
  };
  let html=_quoClickableKpi(label,value,sub,glyph,cls);
  const smart=map[label];
  if(smart){
    html=html.replace('<article class="kpi ',`<article class="kpi clickable-kpi `)
      .replace('<article class="kpi">','<article class="kpi clickable-kpi">')
      .replace('<article class="kpi clickable-kpi ',`<article role="button" tabindex="0" data-kpi-open="${smart}" aria-label="Open ${esc(label)}" class="kpi clickable-kpi `)
      .replace('<article class="kpi clickable-kpi">',`<article role="button" tabindex="0" data-kpi-open="${smart}" aria-label="Open ${esc(label)}" class="kpi clickable-kpi">`);
  }
  return html;
};

function quoSmartMatch(d,smart){
  if(!smart)return true;
  const kind=typeof smart==='string'?smart:smart.kind;
  const value=typeof smart==='object'?smart.value:null;
  if(kind==='open-quotes')return d.document_type==='quotation'&&QUOTE_OPEN_STATUSES.includes(d.status);
  if(kind==='quotations')return d.document_type==='quotation';
  if(kind==='confirmed-quotes')return d.document_type==='quotation'&&QUOTE_WON_STATUSES.includes(d.status);
  if(kind==='proforma')return d.document_type==='proforma';
  if(kind==='invoice')return d.document_type==='invoice';
  if(kind==='pending-payment')return ['proforma','invoice'].includes(d.document_type)&&d.status!=='Cancelled'&&calc(d).balance>0;
  if(kind==='paid-payment')return ['proforma','invoice'].includes(d.document_type)&&d.status!=='Cancelled'&&calc(d).paid>0;
  if(kind==='customer')return String(d.customer_name||'').trim().toLowerCase()===String(value||'').trim().toLowerCase();
  return true;
}

function quoSmartLabel(smart){
  if(!smart)return '';
  const kind=typeof smart==='string'?smart:smart.kind;
  const value=typeof smart==='object'?smart.value:'';
  return ({
    'open-quotes':'Open quotations - Draft, Sent and Follow Up',
    'quotations':'All quotations',
    'confirmed-quotes':'Confirmed quotation deals',
    'proforma':'Proforma invoices',
    'invoice':'Invoices',
    'pending-payment':'Documents with balance due',
    'paid-payment':'Documents with recorded payment'
  })[kind]||(kind==='customer'?`Documents for ${value}`:'Filtered documents');
}

function goSmartDocuments(smart,filter='all'){
  S.view='documents';
  S.filter=filter;
  S.current=null;
  S.search='';
  S.smartFilter=smart;
  render();
  scrollTo(0,0);
}

const _quoClickableGoDocuments=goDocuments;
goDocuments=function(filter='all'){
  S.smartFilter=null;
  return _quoClickableGoDocuments(filter);
};

/* Every document row opens the document. Edit/Delete buttons remain separate. */
tableDocs=function(rows,compact=false){
  if(!rows.length)return '<div class="empty">No documents found.</div>';
  const actionHead=compact?'':'<th class="actions-col">Actions</th>';
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Document</th><th>Customer</th><th>Date</th><th class="num">Total</th><th>Status</th>${actionHead}</tr></thead><tbody>${rows.map(d=>{
    const c=calc(d);
    const actions=compact?'':`<td class="row-actions"><button class="table-action" data-open="${d.id}" type="button">Edit</button><button class="table-action danger-text" data-delete-doc="${d.id}" type="button">Delete</button></td>`;
    return `<tr class="clickable-doc-row" data-open="${d.id}" tabindex="0" role="button" aria-label="Open ${esc(d.document_number)}"><td><strong>${esc(d.document_number)}</strong><span class="subline">${esc(CFG[d.document_type]?.label||d.document_type)}</span></td><td>${esc(d.customer_name||'No customer')}</td><td>${esc(dateTiny(d.creation_date)||'-')}</td><td class="num">${moneyOnly(c.total)}</td><td><span class="badge ${statusClass(d.status)}">${esc(d.status||'Draft')}</span>${typeof paymentSummaryLine==='function'?paymentSummaryLine(d):''}</td>${actions}</tr>`;
  }).join('')}</tbody></table></div>`;
};

const _quoClickableRenderDocuments=renderDocuments;
renderDocuments=function(){
  const original=S.docs;
  if(S.smartFilter)S.docs=original.filter(d=>quoSmartMatch(d,S.smartFilter));
  let html=_quoClickableRenderDocuments();
  S.docs=original;
  if(S.smartFilter){
    const banner=`<div class="smart-filter-bar"><span>${esc(quoSmartLabel(S.smartFilter))}</span><button type="button" data-clear-smart>Show all</button></div>`;
    html=html.replace('<div class="toolbar-row">',banner+'<div class="toolbar-row">');
  }
  return html;
};

/* Customer directory becomes a drill-down instead of static cards. */
renderCustomers=function(){
  const rows=uniqueCustomers();
  return pageHead('Customers','Customer directory is built automatically from saved documents. Click a customer to see their documents.')+
    `<div class="customer-grid">${rows.length?rows.map(c=>{
      const phone=String(c.phone||'').trim();
      const phoneHTML=phone?`<a class="customer-phone" href="tel:${esc(phone.replace(/[^0-9+]/g,''))}" data-customer-phone>${esc(phone)}</a>`:'<span>No phone</span>';
      return `<article class="customer-card clickable-customer" role="button" tabindex="0" data-customer-open="${esc(c.name)}" aria-label="Open documents for ${esc(c.name)}"><b>${esc(c.name)}</b><p>${phoneHTML}<br>${esc(c.address||'')}</p><div class="stat">${c.count} documents - ${money(c.outstanding,S.settings.currency)} outstanding</div><span class="customer-open-hint">View documents</span></article>`;
    }).join(''):'<div class="panel"><div class="empty">Customers will appear after documents are saved.</div></div>'}</div>`;
};

/* Make the whole quotation pipeline row openable while preserving its quick-action buttons. */
const _quoClickableQuotePipelineCard=quotePipelineCard;
quotePipelineCard=function(d){
  return _quoClickableQuotePipelineCard(d).replace('<article class="deal-row">',`<article class="deal-row clickable-deal-row" data-deal-open="${d.id}" role="button" tabindex="0" aria-label="Open ${esc(d.document_number)}">`);
};

function quoOpenDocById(id){
  const d=S.docs.find(v=>v.id===id);
  if(d)openEditor(d);
}

const _quoClickableBindDynamic=bindDynamic;
bindDynamic=function(){
  _quoClickableBindDynamic();

  $$('[data-kpi-open]').forEach(el=>{
    const act=()=>{
      const smart=el.dataset.kpiOpen;
      const type=smart==='open-quotes'||smart==='confirmed-quotes'||smart==='quotations'?'quotation':smart==='proforma'?'proforma':smart==='invoice'?'invoice':'all';
      goSmartDocuments(smart,type);
    };
    el.onclick=act;
    el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();act();}};
  });

  $$('[data-clear-smart]').forEach(b=>b.onclick=()=>goDocuments('all'));

  $$('.clickable-doc-row').forEach(row=>{
    const act=()=>quoOpenDocById(row.dataset.open);
    row.onclick=e=>{if(e.target.closest('button,a'))return;act();};
    row.onkeydown=e=>{if((e.key==='Enter'||e.key===' ')&&!e.target.closest('button,a')){e.preventDefault();act();}};
  });

  $$('.clickable-deal-row').forEach(row=>{
    const act=()=>quoOpenDocById(row.dataset.dealOpen);
    row.onclick=e=>{if(e.target.closest('button,a'))return;act();};
    row.onkeydown=e=>{if((e.key==='Enter'||e.key===' ')&&!e.target.closest('button,a')){e.preventDefault();act();}};
  });

  $$('[data-customer-open]').forEach(card=>{
    const act=()=>goSmartDocuments({kind:'customer',value:card.dataset.customerOpen},'all');
    card.onclick=e=>{if(e.target.closest('a,button'))return;act();};
    card.onkeydown=e=>{if((e.key==='Enter'||e.key===' ')&&!e.target.closest('a,button')){e.preventDefault();act();}};
  });
  $$('[data-customer-phone]').forEach(a=>a.onclick=e=>e.stopPropagation());

  const brand=document.querySelector('.side-brand');
  if(brand){
    brand.setAttribute('role','button');brand.setAttribute('tabindex','0');brand.title='Dashboard';
    const act=()=>{S.smartFilter=null;S.view='dashboard';S.current=null;render();scrollTo(0,0)};
    brand.onclick=act;brand.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();act();}};
  }
};

if(!document.getElementById('quoClickableStyle')){
  const st=document.createElement('style');
  st.id='quoClickableStyle';
  st.textContent=`
    .clickable-kpi,.clickable-doc-row,.clickable-deal-row,.clickable-customer,.side-brand{cursor:pointer}
    .clickable-kpi{transition:border-color .14s ease,transform .14s ease,box-shadow .14s ease}
    .clickable-kpi:hover{border-color:#cfd3d5;transform:translateY(-1px);box-shadow:0 3px 10px rgba(20,24,27,.05)}
    .clickable-kpi:focus-visible,.clickable-doc-row:focus-visible,.clickable-deal-row:focus-visible,.clickable-customer:focus-visible,.side-brand:focus-visible{outline:2px solid #6f55d9;outline-offset:2px}
    .clickable-doc-row:hover td{background:#fafbfb}.clickable-doc-row td:first-child strong{text-decoration-thickness:1px;text-underline-offset:2px}.clickable-doc-row:hover td:first-child strong{text-decoration:underline}
    .clickable-deal-row:hover{background:#fafbfb}
    .clickable-customer{position:relative;transition:border-color .14s ease,box-shadow .14s ease}.clickable-customer:hover{border-color:#cfd3d5;box-shadow:0 3px 10px rgba(20,24,27,.045)}
    .customer-phone{color:#4e7fb8;text-decoration:none}.customer-phone:hover{text-decoration:underline}.customer-open-hint{display:block;margin-top:8px;font-size:8px;font-weight:700;color:#6f55d9}
    .smart-filter-bar{min-height:34px;margin:0 0 9px;padding:6px 8px 6px 11px;border:1px solid #e0dcf5;border-radius:6px;background:#faf9ff;display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:9px;color:#5f5873}.smart-filter-bar button{border:0;background:transparent;color:#6f55d9;font-size:9px;font-weight:700;cursor:pointer;padding:4px 6px}.smart-filter-bar button:hover{text-decoration:underline}
    .side-brand:hover strong{color:#6f55d9}
  `;
  document.head.appendChild(st);
}
