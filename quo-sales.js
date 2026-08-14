/* Quo v9 quotation sales pipeline: track open deals, follow-up, confirmation and lost quotes. */

CFG.quotation.statuses=['Draft','Sent','Follow Up','Confirmed','Lost','Expired','Cancelled'];

const QUOTE_OPEN_STATUSES=['Draft','Sent','Follow Up'];
const QUOTE_WON_STATUSES=['Confirmed','Accepted'];
const QUOTE_CLOSED_STATUSES=['Confirmed','Accepted','Lost','Expired','Cancelled'];

function quoteStageClass(status){
  const s=String(status||'Draft').toLowerCase().replaceAll(' ','-');
  if(QUOTE_WON_STATUSES.includes(status))return 'quote-won';
  if(status==='Lost'||status==='Cancelled')return 'quote-lost';
  if(status==='Expired')return 'quote-expired';
  if(status==='Follow Up')return 'quote-follow';
  if(status==='Sent')return 'quote-sent';
  return s;
}

async function updateQuoteStage(id,status){
  const d=S.docs.find(x=>x.id===id)||(S.current?.id===id?S.current:null);
  if(!d||d.document_type!=='quotation')return;
  const name=prepared();
  if(!name){alert('Enter Prepared By before changing a quotation status.');$('#preparedBy')?.focus();return}
  if(status==='Confirmed'&&!confirm(`Confirm ${d.document_number} as a won deal?\n\nYou can then convert it to a Proforma Invoice or Invoice.`))return;
  if(status==='Lost'&&!confirm(`Mark ${d.document_number} as lost?`))return;
  try{
    const r=await sb.from('quo_documents').update({status,updated_by:null,updated_by_name:name}).eq('id',id).select('*').single();
    if(r.error)throw r.error;
    if(S.current?.id===id)S.current={...S.current,...r.data};
    await refreshDocs();
    toast(`${d.document_number} - ${status}`);
    render();
  }catch(e){
    console.error(e);
    alert('Could not update quotation: '+(e?.message||'Unknown error'));
  }
}

function quotePipelineCard(d){
  const c=calc(d);
  const expiry=d.expires_on?dateTiny(d.expires_on):'-';
  const service=d.service_enabled&&d.service_from?period(d.service_from,d.service_to):'';
  const status=String(d.status||'Draft');
  const quick=QUOTE_WON_STATUSES.includes(status)
    ? `<button class="deal-btn open" data-open="${d.id}">Open</button>`
    : status==='Lost'||status==='Expired'||status==='Cancelled'
      ? `<button class="deal-btn open" data-open="${d.id}">Open</button>`
      : `<button class="deal-btn sent" data-quote-stage="Sent" data-quote-id="${d.id}">Sent</button><button class="deal-btn follow" data-quote-stage="Follow Up" data-quote-id="${d.id}">Follow Up</button><button class="deal-btn win" data-quote-stage="Confirmed" data-quote-id="${d.id}">Confirm Deal</button><button class="deal-btn open" data-open="${d.id}">Open</button>`;
  return `<article class="deal-row">
    <div class="deal-main"><strong>${esc(d.document_number)}</strong><span>${esc(d.customer_name||'No customer')}</span>${service?`<small>${esc(service)}</small>`:''}</div>
    <div class="deal-money"><strong>${money(c.total,d.currency)}</strong><small>Valid until ${esc(expiry)}</small></div>
    <div><span class="deal-status ${quoteStageClass(status)}">${esc(status)}</span></div>
    <div class="deal-actions">${quick}</div>
  </article>`;
}

renderDashboard=function(){
  const q=S.docs.filter(d=>d.document_type==='quotation');
  const p=S.docs.filter(d=>d.document_type==='proforma');
  const inv=S.docs.filter(d=>d.document_type==='invoice');
  const commercial=[...p,...inv].filter(d=>d.status!=='Cancelled');

  const openQuotes=q.filter(d=>QUOTE_OPEN_STATUSES.includes(d.status));
  const wonQuotes=q.filter(d=>QUOTE_WON_STATUSES.includes(d.status));
  const openQuoteValue=openQuotes.reduce((a,d)=>a+calc(d).total,0);
  const wonQuoteValue=wonQuotes.reduce((a,d)=>a+calc(d).total,0);
  const pAwait=p.filter(d=>d.status!=='Cancelled'&&calc(d).balance>0).length;
  const iPaid=inv.filter(d=>d.status!=='Cancelled'&&(calc(d).balance<=0||d.status==='Paid')).length;
  const pendingAmount=commercial.reduce((a,d)=>a+calc(d).balance,0);
  const pendingDocs=commercial.filter(d=>calc(d).balance>0).length;
  const paidAmount=commercial.reduce((a,d)=>a+Math.min(calc(d).paid,calc(d).total),0);
  const paidDocs=commercial.filter(d=>calc(d).paid>0).length;
  const recent=S.docs.slice(0,8);
  const today=isoToday();
  const active=S.docs.filter(d=>d.service_enabled&&d.service_to&&d.service_to>=today&&d.status!=='Cancelled').sort((a,b)=>String(a.service_from).localeCompare(String(b.service_from))).slice(0,5);
  const pipeline=q.filter(d=>!['Cancelled'].includes(d.status)).sort((a,b)=>String(b.updated_at||'').localeCompare(String(a.updated_at||''))).slice(0,8);

  return pageHead('Welcome back','Track quotations as sales opportunities, then move confirmed deals into payment documents.','<button class="btn primary" data-new>+ New Document</button>')+
    `<section class="kpis sales-kpis">
      ${kpi('Open Quotations',money(openQuoteValue,S.settings.currency),`${openQuotes.length} deals to follow up`,'QT','money quote-open-kpi')}
      ${kpi('Confirmed Deals',money(wonQuoteValue,S.settings.currency),`${wonQuotes.length} won quotations`,'WON','money quote-won-kpi')}
      ${kpi('Proforma',p.length,`${pAwait} awaiting payment`,'PI')}
      ${kpi('Invoices',inv.length,`${iPaid} fully paid`,'INV')}
      ${kpi('Pending Payment',money(pendingAmount,S.settings.currency),`${pendingDocs} documents`,'DUE','money pending-kpi')}
      ${kpi('Paid',money(paidAmount,S.settings.currency),`${paidDocs} documents with payment`,'PAID','money paid-kpi')}
    </section>`+
    `<section class="panel deal-panel"><div class="panel-head"><div><h3>Quotation Pipeline</h3><p>Follow up open quotations and confirm the deals you win.</p></div><button data-doc-filter="quotation">View quotations</button></div><div class="deal-list">${pipeline.length?pipeline.map(quotePipelineCard).join(''):'<div class="empty">No quotations yet.</div>'}</div></section>`+
    `<section class="dashboard-grid"><div class="panel"><div class="panel-head"><h3>Recent Documents</h3><button data-go-docs>View all</button></div>${tableDocs(recent,true)}</div><div class="panel"><div class="panel-head"><h3>Upcoming / Active</h3></div><div class="upcoming">${active.length?active.map(eventCard).join(''):'<div class="empty">No upcoming catering services.</div>'}</div></div></section>`;
};

const _quoSalesRenderEditor=renderEditor;
renderEditor=function(){
  let html=_quoSalesRenderEditor();
  const d=S.current;
  if(!d||d.document_type!=='quotation'||!d.id)return html;
  const s=String(d.status||'Draft');
  const controls=`<div class="quote-stage-bar"><span>Deal status</span><button class="stage-btn ${s==='Sent'?'active':''}" data-quote-stage="Sent" data-quote-id="${d.id}">Sent</button><button class="stage-btn ${s==='Follow Up'?'active':''}" data-quote-stage="Follow Up" data-quote-id="${d.id}">Follow Up</button><button class="stage-btn win ${QUOTE_WON_STATUSES.includes(s)?'active':''}" data-quote-stage="Confirmed" data-quote-id="${d.id}">Confirm Deal</button><button class="stage-btn lost ${s==='Lost'?'active':''}" data-quote-stage="Lost" data-quote-id="${d.id}">Lost</button></div>`;
  return html.replace('<div class="editor-shell">',controls+'<div class="editor-shell">');
};

const _quoSalesBindDynamic=bindDynamic;
bindDynamic=function(){
  _quoSalesBindDynamic();
  $$('[data-quote-stage]').forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();updateQuoteStage(b.dataset.quoteId,b.dataset.quoteStage)});
  $$('[data-doc-filter="quotation"]').forEach(b=>{if(!b.closest('.chips'))b.onclick=()=>goDocuments('quotation')});
};

if(!document.getElementById('quoSalesStyle')){
  const st=document.createElement('style');
  st.id='quoSalesStyle';
  st.textContent=`
    .sales-kpis{grid-template-columns:repeat(6,minmax(0,1fr))}.quote-open-kpi{border-color:#dbe6e2}.quote-open-kpi .glyph{background:#eef5f3;color:var(--brand-dark)}.quote-won-kpi{border-color:#cfe6d6}.quote-won-kpi .glyph{background:var(--good-bg);color:var(--good)}
    .deal-panel{margin-bottom:14px}.deal-panel .panel-head>div{margin-right:auto}.deal-panel .panel-head p{font-size:9px;color:var(--muted);margin:3px 0 0}.deal-list{padding:5px 10px}.deal-row{display:grid;grid-template-columns:minmax(190px,1.3fr) minmax(140px,.7fr) 110px minmax(260px,1fr);gap:12px;align-items:center;padding:11px 5px;border-bottom:1px solid var(--line2)}.deal-row:last-child{border-bottom:0}.deal-main strong,.deal-main span,.deal-main small{display:block}.deal-main strong{font-size:10px;color:var(--brand-dark)}.deal-main span{font-size:11px;font-weight:800;margin-top:2px}.deal-main small,.deal-money small{font-size:8.5px;color:var(--muted);margin-top:3px}.deal-money strong{font-size:11px}.deal-status{display:inline-flex;padding:5px 8px;border-radius:999px;font-size:8px;font-weight:850;background:#f1f3f2;color:#66716e}.deal-status.quote-sent{background:var(--warn-bg);color:var(--warn)}.deal-status.quote-follow{background:#f4f0ff;color:#71569b}.deal-status.quote-won{background:var(--good-bg);color:var(--good)}.deal-status.quote-lost{background:var(--bad-bg);color:var(--bad)}.deal-status.quote-expired{background:#f4f4f4;color:#888}.deal-actions{display:flex;gap:4px;justify-content:flex-end;flex-wrap:wrap}.deal-btn,.stage-btn{border:1px solid var(--line);background:#fff;border-radius:7px;padding:6px 8px;font-size:8px;font-weight:850;color:#5c6764}.deal-btn:hover,.stage-btn:hover{border-color:#abc3bd}.deal-btn.win,.stage-btn.win{background:var(--good-bg);border-color:#cfe6d6;color:var(--good)}.deal-btn.follow{background:#f7f4ff;color:#71569b}.deal-btn.sent{background:var(--warn-bg);color:var(--warn)}.deal-btn.open{color:var(--brand-dark)}
    .quote-stage-bar{display:flex;align-items:center;gap:6px;background:#fff;border:1px solid var(--line);border-radius:10px;padding:9px 11px;margin:0 0 12px;flex-wrap:wrap}.quote-stage-bar>span{font-size:8.5px;text-transform:uppercase;letter-spacing:.08em;color:#7a8581;font-weight:850;margin-right:3px}.stage-btn.active{box-shadow:0 0 0 2px rgba(45,109,100,.12);border-color:#8db7ae}.stage-btn.lost{color:var(--bad)}.stage-btn.lost.active{background:var(--bad-bg);border-color:#e7c3c3}
    .badge.confirmed{background:var(--good-bg);color:var(--good)}.badge.follow-up{background:#f4f0ff;color:#71569b}.badge.lost{background:var(--bad-bg);color:var(--bad)}
    @media(max-width:1320px){.sales-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}.deal-row{grid-template-columns:1.2fr .8fr 100px}.deal-actions{grid-column:1/-1;justify-content:flex-start;padding-bottom:3px}}
    @media(max-width:760px){.sales-kpis{grid-template-columns:1fr 1fr}.deal-row{grid-template-columns:1fr 1fr}.deal-actions{grid-column:1/-1}.deal-row>div:nth-child(3){text-align:right}}
    @media(max-width:460px){.sales-kpis{grid-template-columns:1fr}.deal-row{grid-template-columns:1fr}.deal-row>div:nth-child(3){text-align:left}}
  `;
  document.head.appendChild(st);
}
