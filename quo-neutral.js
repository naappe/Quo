/* Quo v10 neutral application skin and reference-style dashboard.
   Business logic, Supabase, PDF rendering and document content are unchanged. */

renderDashboard=function(){
  const q=S.docs.filter(d=>d.document_type==='quotation');
  const p=S.docs.filter(d=>d.document_type==='proforma');
  const inv=S.docs.filter(d=>d.document_type==='invoice');
  const receipts=S.docs.filter(d=>d.document_type==='receipt');
  const commercial=[...p,...inv].filter(d=>d.status!=='Cancelled');

  const openQuotes=q.filter(d=>QUOTE_OPEN_STATUSES.includes(d.status));
  const wonQuotes=q.filter(d=>QUOTE_WON_STATUSES.includes(d.status));
  const lostQuotes=q.filter(d=>d.status==='Lost');
  const openQuoteValue=openQuotes.reduce((a,d)=>a+calc(d).total,0);
  const wonQuoteValue=wonQuotes.reduce((a,d)=>a+calc(d).total,0);
  const pendingAmount=commercial.reduce((a,d)=>a+calc(d).balance,0);
  const pendingDocs=commercial.filter(d=>calc(d).balance>0).length;
  const paidAmount=commercial.reduce((a,d)=>a+Math.min(calc(d).paid,calc(d).total),0);
  const paidDocs=commercial.filter(d=>calc(d).paid>0).length;

  const recent=S.docs.slice(0,8);
  const recentQuotes=q.slice().sort((a,b)=>String(b.updated_at||'').localeCompare(String(a.updated_at||''))).slice(0,6);
  const today=isoToday();
  const active=S.docs.filter(d=>d.service_enabled&&d.service_to&&d.service_to>=today&&d.status!=='Cancelled')
    .sort((a,b)=>String(a.service_from).localeCompare(String(b.service_from))).slice(0,5);
  const pipeline=q.filter(d=>d.status!=='Cancelled')
    .sort((a,b)=>String(b.updated_at||'').localeCompare(String(a.updated_at||''))).slice(0,8);

  const commercialRows=`
    <button class="compact-stat" data-doc-filter="proforma"><span class="compact-icon pi">PI</span><span><b>Proforma Invoices</b><small>${p.length} documents</small></span><strong>${p.filter(d=>d.status!=='Cancelled'&&calc(d).balance>0).length}</strong></button>
    <button class="compact-stat" data-doc-filter="invoice"><span class="compact-icon inv">INV</span><span><b>Invoices</b><small>${inv.length} documents</small></span><strong>${inv.filter(d=>d.status==='Paid'||calc(d).balance<=0).length}</strong></button>
    <button class="compact-stat" data-doc-filter="receipt"><span class="compact-icon rc">RC</span><span><b>Receipts</b><small>Recorded payments</small></span><strong>${receipts.length}</strong></button>`;

  const quoteTable=recentQuotes.length?`<div class="table-wrap"><table class="data-table compact-table"><thead><tr><th>Quotation</th><th>Customer</th><th class="num">Value</th><th>Status</th></tr></thead><tbody>${recentQuotes.map(d=>`<tr data-open="${d.id}"><td><strong>${esc(d.document_number)}</strong></td><td>${esc(d.customer_name||'No customer')}</td><td class="num">${moneyOnly(calc(d).total)}</td><td><span class="badge ${statusClass(d.status)}">${esc(d.status||'Draft')}</span></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">No quotations yet.</div>';

  return pageHead('Dashboard','Track open quotations, confirmed deals, payments and upcoming catering work.','<button class="btn primary" data-new>+ New Document</button>')+
    `<section class="summary-grid reference-summary">
      ${kpi('Open Quotations',money(openQuoteValue,S.settings.currency),`${openQuotes.length} deals to follow up`,'QT','money accent-purple')}
      ${kpi('Confirmed Deals',money(wonQuoteValue,S.settings.currency),`${wonQuotes.length} won quotations`,'WON','money accent-green')}
      ${kpi('Pending Payment',money(pendingAmount,S.settings.currency),`${pendingDocs} documents`,'DUE','money accent-orange')}
      ${kpi('Paid',money(paidAmount,S.settings.currency),`${paidDocs} documents with payment`,'PAID','money accent-blue')}
    </section>`+
    `<section class="middle-grid reference-middle">
      <div class="panel deal-panel dashboard-large"><div class="panel-head"><div><h3>Quotation Pipeline</h3><p>${openQuotes.length} open - ${wonQuotes.length} confirmed - ${lostQuotes.length} lost</p></div><button data-doc-filter="quotation">View quotations</button></div><div class="deal-list">${pipeline.length?pipeline.map(quotePipelineCard).join(''):'<div class="empty">No quotations yet.</div>'}</div></div>
      <div class="panel dashboard-medium"><div class="panel-head"><div><h3>Commercial Documents</h3><p>Payment-document progress</p></div></div><div class="compact-stats">${commercialRows}</div></div>
      <div class="panel dashboard-small"><div class="panel-head"><div><h3>Upcoming / Active</h3><p>Catering and dated services</p></div></div><div class="upcoming compact-upcoming">${active.length?active.map(eventCard).join(''):'<div class="empty">No upcoming services.</div>'}</div></div>
    </section>`+
    `<section class="bottom-grid reference-bottom">
      <div class="panel"><div class="panel-head"><h3>Recent Documents</h3><button data-go-docs>View all</button></div>${tableDocs(recent,true)}</div>
      <div class="panel"><div class="panel-head"><h3>Recent Quotations</h3><button data-doc-filter="quotation">View all</button></div>${quoteTable}</div>
    </section>`;
};

if(!document.getElementById('quoNeutralSkin')){
  const st=document.createElement('style');
  st.id='quoNeutralSkin';
  st.textContent=`
  :root{
    --ink:#25292b;--muted:#747a7d;--line:#e4e7e8;--line2:#eceeef;
    --bg:#f7f8f8;--paper:#ffffff;--brand:#25292b;--brand-dark:#25292b;
    --brand-soft:#f1f2f3;--warn:#b46b15;--warn-bg:#fff6e9;
    --good:#4f9f73;--good-bg:#edf7f1;--bad:#c7504a;--bad-bg:#fff1f0;
    --purple:#6f55d9;--orange:#f29a38;--yellow:#f4c84c;--blue:#4e9df5;--red:#f2635b;
    --shadow:0 1px 2px rgba(20,24,27,.025);--r:8px;
  }
  html,body{background:#f7f8f8;color:#25292b;font-size:12px}
  .app{grid-template-columns:185px minmax(0,1fr)}
  .sidebar{padding:14px 10px;height:100vh;border-right:1px solid #e8eaeb;background:#fff}
  .side-brand{padding:1px 6px 16px;gap:9px}.mark{width:32px;height:32px;border-radius:8px;background:#25292b;box-shadow:none;font-size:16px}.side-brand strong{font-size:14px;letter-spacing:.14em}.side-brand small{font-size:8px;color:#92989a}
  .nav{gap:2px}.nav-label{padding:12px 8px 4px;font-size:8px;color:#a1a6a8;letter-spacing:.13em}.nav button{height:34px;border-radius:6px;padding:0 8px;gap:8px;font-size:11.5px;font-weight:500;color:#555b5e}.nav button:hover{background:#f6f7f7}.nav button.active{background:#f1f2f3;color:#24282a;font-weight:600}.nav-icon{font-size:13px;width:16px;color:#777e80}.nav-dot{width:5px;height:5px;margin-left:5px;margin-right:5px;background:#b3b8ba}.nav button.active .nav-dot{background:#747a7d}
  .side-footer{padding:12px 7px 2px;border-top:1px solid #eceeef}.live-pill{font-size:9px;color:#747a7d}.live-pill i{width:6px;height:6px;background:#69b88c;box-shadow:none}.side-footer small{font-size:8px;color:#a1a6a8;margin-top:5px}
  .topbar{height:58px;padding:0 22px;background:#fff;backdrop-filter:none;border-bottom:1px solid #e8eaeb;gap:10px}.top-title h1{font-size:17px;font-weight:600;margin-top:2px}.eyebrow{font-size:8px;color:#747a7d;letter-spacing:.13em}.top-actions{gap:8px}.prepared-by{height:34px;border-radius:6px;padding:0 5px 0 9px;border-color:#e0e3e4}.prepared-by span{font-size:8px;color:#8c9294}.prepared-by input{width:118px;font-size:11px;padding:4px 5px}
  .btn,.icon-btn{height:34px;border-radius:6px;border-color:#dfe2e3;font-weight:500;box-shadow:none}.btn{padding:0 12px;font-size:11.5px}.btn:hover,.icon-btn:hover{background:#f7f8f8;border-color:#cfd3d4}.btn.primary{background:#6f55d9;border-color:#6f55d9;box-shadow:none}.btn.primary:hover{background:#6048c7;border-color:#6048c7}.btn.danger{color:#c7504a}
  .content{padding:20px 22px 30px;max-width:none;margin:0;width:100%}.page-head{margin-bottom:16px;gap:14px}.page-head h2{font-family:Inter,"Segoe UI",Arial,sans-serif;font-size:18px;font-weight:600;margin:2px 0 4px}.page-head p{font-size:10.5px;line-height:1.45}.page-actions{gap:6px}
  .panel,.kpi,.editor-card,.customer-card{border-radius:8px;border-color:#e5e7e8;box-shadow:0 1px 2px rgba(20,24,27,.025)}
  .panel-head{padding:12px 14px;min-height:44px;border-bottom-color:#eceeef}.panel-head h3{font-size:12px;font-weight:600}.panel-head p{font-size:9px!important;color:#8a9092!important;margin:2px 0 0!important}.panel-head button{font-size:9px;color:#6f55d9;font-weight:600}
  .summary-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:12px}.reference-summary .kpi{min-height:86px;padding:14px 16px}.kpi .label{font-size:8.5px;letter-spacing:.09em;color:#81878a;font-weight:600}.kpi .glyph{width:24px;height:24px;border-radius:6px;background:#f3f4f5;color:#6b7173;font-size:8px}.kpi strong{font-size:20px;font-weight:600;line-height:1.05;margin-top:10px}.kpi.money strong{font-size:19px}.kpi small{font-size:9px;margin-top:5px;color:#858b8d}.kpi.accent-purple .glyph{background:#f1edff;color:#6f55d9}.kpi.accent-green .glyph{background:#edf7f1;color:#4f9f73}.kpi.accent-orange .glyph{background:#fff4e6;color:#d88022}.kpi.accent-blue .glyph{background:#edf5ff;color:#4e9df5}
  .middle-grid{display:grid;grid-template-columns:1.15fr 1fr .85fr;gap:12px;margin-top:12px;align-items:stretch}.bottom-grid{display:grid;grid-template-columns:1.25fr 1fr;gap:12px;margin-top:12px}.reference-middle>.panel,.reference-bottom>.panel{min-width:0}
  .deal-panel{margin-bottom:0}.deal-list{padding:3px 8px}.deal-row{grid-template-columns:minmax(150px,1.15fr) minmax(105px,.72fr) 86px;gap:8px;padding:9px 4px}.deal-actions{grid-column:1/-1;justify-content:flex-start;padding:0 0 2px}.deal-main strong{font-size:9px;color:#5d6264}.deal-main span{font-size:10.5px;font-weight:600}.deal-main small,.deal-money small{font-size:8px}.deal-money strong{font-size:10px;font-weight:600}.deal-status{border-radius:5px;padding:4px 6px;font-size:7.5px;font-weight:600}.deal-status.quote-sent{background:#edf5ff;color:#397fd0}.deal-status.quote-follow{background:#f1edff;color:#6f55d9}.deal-status.quote-won{background:#edf7f1;color:#4f9f73}.deal-status.quote-lost{background:#fff1f0;color:#c7504a}.deal-btn,.stage-btn{height:28px;border-radius:5px;padding:0 7px;font-size:8px;font-weight:600}.deal-btn.sent{background:#edf5ff;color:#397fd0}.deal-btn.follow{background:#f1edff;color:#6f55d9}.deal-btn.win{background:#edf7f1;border-color:#d7ebdf;color:#4f9f73}.deal-btn.open{color:#5e6466}
  .compact-stats{padding:8px}.compact-stat{width:100%;min-height:54px;border:0;border-bottom:1px solid #eceeef;background:#fff;display:grid;grid-template-columns:32px 1fr auto;align-items:center;gap:9px;padding:8px;text-align:left;color:#25292b}.compact-stat:last-child{border-bottom:0}.compact-stat:hover{background:#fafbfb}.compact-stat span:nth-child(2){min-width:0}.compact-stat b{display:block;font-size:10.5px;font-weight:600}.compact-stat small{display:block;font-size:8.5px;color:#8b9193;margin-top:2px}.compact-stat>strong{font-size:16px;font-weight:600}.compact-icon{width:28px;height:28px;border-radius:6px;display:grid;place-items:center;font-size:8px;font-weight:700;background:#f1edff;color:#6f55d9}.compact-icon.inv{background:#edf5ff;color:#4e9df5}.compact-icon.rc{background:#edf7f1;color:#4f9f73}
  .upcoming{padding:6px}.compact-upcoming .event-card{grid-template-columns:44px 1fr;gap:9px;margin:5px;padding:9px;border-radius:7px}.event-card{border-color:#eceeef}.event-card:hover{background:#fafbfb;border-color:#dfe2e3}.event-date{border-radius:6px;background:#f3f4f5;color:#4f5557;padding:7px 4px}.event-date b{font-size:13px}.event-date span{font-size:7px}.event-card h4{font-size:10px;font-weight:600}.event-card p{font-size:8px;line-height:1.4}
  .data-table th{padding:8px 10px;background:#fafafa;color:#858b8d;font-size:8px;font-weight:600;border-bottom-color:#e6e8e9}.data-table td{padding:9px 10px;font-size:10px;border-bottom-color:#eef0f1}.data-table tbody tr[data-open]:hover{background:#fafbfb}.data-table strong{font-weight:600}.subline{font-size:8px;color:#969b9d}.badge{border-radius:5px;padding:3px 6px;font-size:8px;font-weight:600}.badge.sent,.badge.awaiting-payment{background:#edf5ff;color:#397fd0}.badge.follow-up{background:#f1edff;color:#6f55d9}.badge.confirmed,.badge.paid,.badge.final{background:#edf7f1;color:#4f9f73}.badge.lost,.badge.cancelled{background:#fff1f0;color:#c7504a}.compact-table th,.compact-table td{padding-left:9px;padding-right:9px}
  .toolbar-row{gap:8px;margin-bottom:10px}.search{max-width:390px}.search input{height:34px;border-radius:6px;font-size:11px;border-color:#dfe2e3}.chip{border-radius:6px;padding:6px 9px;font-size:9px;font-weight:500}.chip.active{background:#f1f2f3;border-color:#e2e4e5;color:#25292b}
  .modal-card{border-radius:8px;box-shadow:0 18px 60px rgba(20,24,27,.15)}.create-grid button{border-radius:7px}.create-grid b{border-radius:6px;background:#f1edff;color:#6f55d9}
  @media(max-width:1280px){.middle-grid{grid-template-columns:1.25fr 1fr}.dashboard-small{grid-column:1/-1}.compact-upcoming{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}}
  @media(max-width:1050px){.summary-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.bottom-grid,.middle-grid{grid-template-columns:1fr}.dashboard-small{grid-column:auto}.compact-upcoming{display:block}}
  @media(max-width:820px){.app{grid-template-columns:1fr}.sidebar{width:185px;left:-205px}.topbar{min-height:58px;padding:0 12px}.content{padding:16px 12px 28px}.summary-grid{grid-template-columns:1fr 1fr}}
  @media(max-width:520px){.summary-grid{grid-template-columns:1fr}.top-actions{padding-bottom:8px}.page-head{margin-bottom:12px}}
  `;
  document.head.appendChild(st);
}
