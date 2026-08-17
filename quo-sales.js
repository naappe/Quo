/* Quo v44 - quotation pipeline UI helpers only.
   Dashboard/workflow authority lives in quo-core-v41.js + quo-final-v42.js. */

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

function quotePipelineCard(d){
  const c=calc(d);
  const expiry=d.expires_on?dateTiny(d.expires_on):'-';
  const service=d.service_enabled&&d.service_from?period(d.service_from,d.service_to):'';
  const status=String(d.status||'Draft');
  const quick=QUOTE_WON_STATUSES.includes(status)||['Lost','Expired','Cancelled'].includes(status)
    ? `<button class="deal-btn open" data-open="${d.id}">Open</button>`
    : `<button class="deal-btn sent" data-quote-stage="Sent" data-quote-id="${d.id}">Sent</button><button class="deal-btn follow" data-quote-stage="Follow Up" data-quote-id="${d.id}">Follow Up</button><button class="deal-btn win" data-quote-stage="Confirmed" data-quote-id="${d.id}">Confirm + PI</button><button class="deal-btn open" data-open="${d.id}">Open</button>`;
  return `<article class="deal-row">
    <div class="deal-main"><strong>${esc(d.document_number)}</strong><span>${esc(d.customer_name||'No customer')}</span>${service?`<small>${esc(service)}</small>`:''}</div>
    <div class="deal-money"><strong>${money(c.total,d.currency)}</strong><small>Valid until ${esc(expiry)}</small></div>
    <div><span class="deal-status ${quoteStageClass(status)}">${esc(status)}</span></div>
    <div class="deal-actions">${quick}</div>
  </article>`;
}

if(!document.getElementById('quoSalesStyle')){
  const st=document.createElement('style');
  st.id='quoSalesStyle';
  st.textContent=`
    .deal-panel{margin-bottom:14px}.deal-panel .panel-head>div{margin-right:auto}.deal-panel .panel-head p{font-size:9px;color:var(--muted);margin:3px 0 0}.deal-list{padding:5px 10px}
    .deal-row{display:grid;grid-template-columns:minmax(190px,1.3fr) minmax(140px,.7fr) 110px minmax(260px,1fr);gap:12px;align-items:center;padding:11px 5px;border-bottom:1px solid var(--line2)}.deal-row:last-child{border-bottom:0}
    .deal-main strong,.deal-main span,.deal-main small{display:block}.deal-main strong{font-size:10px;color:var(--brand-dark)}.deal-main span{font-size:11px;font-weight:800;margin-top:2px}.deal-main small,.deal-money small{font-size:8.5px;color:var(--muted);margin-top:3px}.deal-money strong{font-size:11px}
    .deal-status{display:inline-flex;padding:5px 8px;border-radius:999px;font-size:8px;font-weight:850;background:#f1f3f2;color:#66716e}.deal-status.quote-sent{background:var(--warn-bg);color:var(--warn)}.deal-status.quote-follow{background:#f4f0ff;color:#71569b}.deal-status.quote-won{background:var(--good-bg);color:var(--good)}.deal-status.quote-lost{background:var(--bad-bg);color:var(--bad)}.deal-status.quote-expired{background:#f4f4f4;color:#888}
    .deal-actions{display:flex;gap:4px;justify-content:flex-end;flex-wrap:wrap}.deal-btn{border:1px solid var(--line);background:#fff;border-radius:7px;padding:6px 8px;font-size:8px;font-weight:850;color:#5c6764}.deal-btn:hover{border-color:#abc3bd}.deal-btn.win{background:var(--good-bg);border-color:#cfe6d6;color:var(--good)}.deal-btn.follow{background:#f7f4ff;color:#71569b}.deal-btn.sent{background:var(--warn-bg);color:var(--warn)}.deal-btn.open{color:var(--brand-dark)}
    .badge.confirmed{background:var(--good-bg);color:var(--good)}.badge.follow-up{background:#f4f0ff;color:#71569b}.badge.lost{background:var(--bad-bg);color:var(--bad)}
    @media(max-width:1320px){.deal-row{grid-template-columns:1.2fr .8fr 100px}.deal-actions{grid-column:1/-1;justify-content:flex-start;padding-bottom:3px}}
    @media(max-width:760px){.deal-row{grid-template-columns:1fr 1fr}.deal-actions{grid-column:1/-1}.deal-row>div:nth-child(3){text-align:right}}
    @media(max-width:460px){.deal-row{grid-template-columns:1fr}.deal-row>div:nth-child(3){text-align:left}}
  `;
  document.head.appendChild(st);
}
