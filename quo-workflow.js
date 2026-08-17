/* Quo v33 - workflow dashboard, document hierarchy and non-overlapping editor actions. */
(function(){
  const byUpdated=(a,b)=>String(b.updated_at||b.created_at||'').localeCompare(String(a.updated_at||a.created_at||''));

  function docsOf(type){return (S.docs||[]).filter(d=>d.document_type===type&&d.status!=='Cancelled').sort(byUpdated)}
  function latestLine(rows,empty){
    if(!rows.length)return `<span class="wf-latest empty-copy">${esc(empty)}</span>`;
    const d=rows[0];
    return `<button type="button" class="wf-latest" data-open="${d.id}"><b>${esc(d.document_number)}</b><span>${esc(d.customer_name||'No customer')}</span><em class="badge ${statusClass(d.status)}">${esc(d.status||'Draft')}</em></button>`;
  }
  function stageCard(type,title,short,rows,metrics,empty){
    return `<article class="wf-stage ${type}">
      <button type="button" class="wf-stage-head" data-workflow-open="${type}">
        <span class="wf-stage-code">${esc(short)}</span>
        <span><b>${esc(title)}</b><small>${rows.length} document${rows.length===1?'':'s'}</small></span>
        <span class="wf-stage-arrow">›</span>
      </button>
      <div class="wf-stage-metrics">${metrics.map(([label,value])=>`<span><b>${esc(String(value))}</b><small>${esc(label)}</small></span>`).join('')}</div>
      ${latestLine(rows,empty)}
    </article>`;
  }
  function queueRow(d,label){
    const c=calc(d);
    const amount=d.document_type==='quotation'?c.total:c.balance;
    const type=CFG[d.document_type]?.label||d.document_type;
    return `<button type="button" class="wf-queue-row" data-open="${d.id}">
      <span class="wf-queue-type">${esc(label||type)}</span>
      <span class="wf-queue-main"><b>${esc(d.document_number)}</b><small>${esc(d.customer_name||'No customer')}</small></span>
      <span class="wf-queue-money">${money(amount,d.currency)}</span>
      <span class="badge ${statusClass(d.status)}">${esc(d.status||'Draft')}</span>
    </button>`;
  }

  renderDashboard=function(){
    const q=docsOf('quotation'),p=docsOf('proforma'),inv=docsOf('invoice'),rc=docsOf('receipt');
    const sent=q.filter(d=>d.status==='Sent').length;
    const follow=q.filter(d=>d.status==='Follow Up').length;
    const confirmed=q.filter(d=>['Confirmed','Accepted'].includes(d.status)).length;
    const pAwait=p.filter(d=>calc(d).balance>0&&!['Part Paid','Paid'].includes(d.status)).length;
    const pPart=p.filter(d=>d.status==='Part Paid'||(calc(d).paid>0&&calc(d).balance>0)).length;
    const pPaid=p.filter(d=>d.status==='Paid'||calc(d).balance<=0).length;
    const invDue=inv.filter(d=>calc(d).balance>0).length;
    const invPaid=inv.filter(d=>d.status==='Paid'||calc(d).balance<=0).length;
    const received=rc.reduce((a,d)=>a+calc(d).total,0);

    const salesQueue=q.filter(d=>['Draft','Sent','Follow Up'].includes(d.status)).slice(0,8);
    const paymentQueue=[...p,...inv].filter(d=>calc(d).balance>0).sort(byUpdated).slice(0,8);
    const recent=(S.docs||[]).slice().sort(byUpdated).slice(0,10);

    const stages=`<section class="wf-sequence" aria-label="Commercial document workflow">
      ${stageCard('quotation','Quotations','QT',q,[['Sent',sent],['Follow Up',follow],['Confirmed',confirmed]],'No quotations yet')}
      <div class="wf-connector">→</div>
      ${stageCard('proforma','Proforma Invoices','PI',p,[['Awaiting',pAwait],['Part Paid',pPart],['Paid',pPaid]],'No proforma invoices yet')}
      <div class="wf-connector">→</div>
      ${stageCard('invoice','Invoices','INV',inv,[['Outstanding',invDue],['Paid',invPaid],['Total',inv.length]],'No invoices yet')}
      <div class="wf-connector">→</div>
      ${stageCard('receipt','Receipts','RC',rc,[['Receipts',rc.length],['Collected',moneyOnly(received)],['Currency',S.settings.currency||'MVR']], 'No receipts yet')}
    </section>`;

    const queues=`<section class="wf-queues">
      <div class="panel wf-panel"><div class="panel-head"><div><h3>Sales Follow-up</h3><p>Draft, Sent and Follow Up quotations that still need action.</p></div><button type="button" data-workflow-open="quotation">View quotations</button></div><div class="wf-queue">${salesQueue.length?salesQueue.map(d=>queueRow(d,'Quotation')).join(''):'<div class="empty">No quotation follow-up is pending.</div>'}</div></div>
      <div class="panel wf-panel"><div class="panel-head"><div><h3>Payment Queue</h3><p>Proforma invoices and invoices with an outstanding balance.</p></div><button type="button" data-workflow-open="proforma">View proforma</button></div><div class="wf-queue">${paymentQueue.length?paymentQueue.map(d=>queueRow(d)).join(''):'<div class="empty">No payments are currently outstanding.</div>'}</div></div>
    </section>`;

    const recentPanel=`<section class="panel wf-recent"><div class="panel-head"><div><h3>Recent Documents</h3><p>Latest activity across quotations, proforma invoices, invoices and receipts.</p></div><button type="button" data-go-docs>View all</button></div>${tableDocs(recent,true)}</section>`;

    return pageHead('Dashboard','Commercial workflow in order: quotation, proforma invoice, invoice, then receipt.','<button class="btn primary" data-new>+ New Document</button>')+stages+queues+recentPanel;
  };

  /* Add type-specific status hierarchy to each document page. */
  const previousRenderDocuments=renderDocuments;
  renderDocuments=function(){
    let html=previousRenderDocuments();
    const type=S.filter;
    if(!['quotation','proforma','invoice','receipt'].includes(type))return html;
    const rows=(S.docs||[]).filter(d=>d.document_type===type&&d.status!=='Cancelled');
    const statuses=CFG[type]?.statuses||[];
    const summary=statuses.filter(s=>s!=='Cancelled').map(s=>[s,rows.filter(d=>d.status===s).length]).filter(([,n])=>n>0);
    const bar=`<section class="wf-page-summary"><div><b>${rows.length}</b><span>Total ${esc(CFG[type]?.plural||'Documents')}</span></div>${summary.map(([s,n])=>`<div><b>${n}</b><span>${esc(s)}</span></div>`).join('')}</section>`;
    const marker='<div class="toolbar-row">';
    return html.includes(marker)?html.replace(marker,bar+marker):bar+html;
  };

  /* Bind all dashboard/document navigation consistently. */
  const previousBind=bindDynamic;
  bindDynamic=function(){
    previousBind();
    $$('[data-workflow-open]').forEach(b=>b.onclick=e=>{e.preventDefault();goDocuments(b.dataset.workflowOpen||'all')});
    $$('[data-doc-filter]').forEach(b=>{
      if(b.closest('.chips'))return;
      b.onclick=e=>{e.preventDefault();goDocuments(b.dataset.docFilter||'all')};
    });
    $$('.wf-stage [data-open],.wf-queue-row[data-open]').forEach(b=>b.onclick=e=>{e.preventDefault();const d=S.docs.find(x=>x.id===b.dataset.open);if(d)openEditor(d)});
  };

  if(!document.getElementById('quoWorkflowV33Style')){
    const st=document.createElement('style');
    st.id='quoWorkflowV33Style';
    st.textContent=`
      /* Dashboard hierarchy */
      .wf-sequence{display:grid;grid-template-columns:minmax(0,1fr) 26px minmax(0,1fr) 26px minmax(0,1fr) 26px minmax(0,1fr);gap:8px;align-items:stretch;margin:0 0 14px}
      .wf-stage{min-width:0;background:#fff;border:1px solid #e3e6e7;border-radius:9px;overflow:hidden}
      .wf-stage-head{width:100%;border:0;background:#fff;display:grid;grid-template-columns:34px 1fr 18px;gap:9px;align-items:center;text-align:left;padding:13px 14px 10px;color:#25292b}
      .wf-stage-head:hover{background:#fafbfb}.wf-stage-code{width:32px;height:32px;border-radius:7px;display:grid;place-items:center;background:#f1f2f3;font-size:9px;font-weight:800;color:#5d6466}
      .wf-stage.quotation .wf-stage-code{background:#f1edff;color:#6f55d9}.wf-stage.proforma .wf-stage-code{background:#fff4e6;color:#cf7d20}.wf-stage.invoice .wf-stage-code{background:#edf5ff;color:#397fd0}.wf-stage.receipt .wf-stage-code{background:#edf7f1;color:#4f9f73}
      .wf-stage-head b{display:block;font-size:12px;font-weight:650}.wf-stage-head small{display:block;margin-top:2px;font-size:8.5px;color:#8a9092}.wf-stage-arrow{font-size:18px;color:#afb4b6;text-align:right}
      .wf-stage-metrics{display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid #edf0f1;border-bottom:1px solid #edf0f1;background:#fbfcfc}.wf-stage-metrics span{padding:9px 8px;text-align:center;border-right:1px solid #edf0f1;min-width:0}.wf-stage-metrics span:last-child{border-right:0}.wf-stage-metrics b{display:block;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.wf-stage-metrics small{display:block;margin-top:2px;font-size:7.5px;color:#8b9193;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .wf-latest{width:100%;min-height:44px;border:0;background:#fff;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:7px;padding:9px 11px;text-align:left;color:#25292b}.wf-latest:hover{background:#fafbfb}.wf-latest b{font-size:9px}.wf-latest span{font-size:8.5px;color:#737a7c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.wf-latest em{font-style:normal}.wf-latest.empty-copy{display:block;color:#9aa0a2;font-size:8.5px;padding-top:14px}
      .wf-connector{display:grid;place-items:center;color:#b1b6b8;font-size:18px}
      .wf-queues{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}.wf-panel{min-width:0}.wf-queue{padding:4px 9px}.wf-queue-row{width:100%;border:0;border-bottom:1px solid #edf0f1;background:#fff;display:grid;grid-template-columns:78px minmax(120px,1fr) 110px auto;gap:9px;align-items:center;padding:9px 5px;text-align:left;color:#25292b}.wf-queue-row:last-child{border-bottom:0}.wf-queue-row:hover{background:#fafbfb}.wf-queue-type{font-size:8px;color:#858c8e;text-transform:uppercase;letter-spacing:.05em}.wf-queue-main b,.wf-queue-main small{display:block}.wf-queue-main b{font-size:9.5px}.wf-queue-main small{font-size:8.5px;color:#7e8587;margin-top:2px}.wf-queue-money{font-size:9px;font-weight:650;text-align:right;white-space:nowrap}.wf-recent{margin-bottom:20px}
      .wf-page-summary{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 10px}.wf-page-summary>div{min-width:96px;padding:9px 11px;border:1px solid #e4e7e8;border-radius:7px;background:#fff}.wf-page-summary b{display:block;font-size:14px}.wf-page-summary span{display:block;margin-top:2px;font-size:8px;color:#858b8d}

      /* More is a reserved action tray, never an overlay over the PDF preview. */
      .editor-actions{position:relative!important;overflow:visible!important}
      .editor-actions:has(.editor-more[open]){padding-bottom:74px!important}
      .editor-more[open] .editor-more-menu{display:flex!important;flex-wrap:wrap!important;gap:6px!important;top:43px!important;right:0!important;width:min(520px,calc(100vw - 36px))!important;min-width:0!important;padding:7px!important;background:#f7f8f8!important;border:1px solid #dde2e3!important;border-radius:8px!important;box-shadow:none!important}
      .editor-more[open] .editor-more-menu .btn{width:auto!important;min-height:32px!important;border:1px solid #dfe3e4!important;background:#fff!important;padding:0 10px!important}
      .editor-more[open] .editor-more-menu .btn:hover{background:#f2f4f4!important}

      @media(max-width:1250px){.wf-sequence{grid-template-columns:1fr 18px 1fr}.wf-stage:nth-of-type(3),.wf-stage:nth-of-type(4){margin-top:0}.wf-sequence>.wf-connector:nth-of-type(4){display:none}.wf-sequence{grid-auto-flow:row}.wf-queues{grid-template-columns:1fr}.wf-connector{font-size:15px}}
      @media(max-width:820px){.wf-sequence{display:block}.wf-stage{margin-bottom:8px}.wf-connector{display:none}.wf-queue-row{grid-template-columns:70px 1fr auto}.wf-queue-money{display:none}.editor-actions:has(.editor-more[open]){padding-bottom:112px!important}}
      @media(max-width:520px){.wf-stage-metrics{grid-template-columns:repeat(3,1fr)}.wf-queue-row{grid-template-columns:1fr auto}.wf-queue-type{display:none}.wf-page-summary>div{min-width:82px;flex:1}.editor-actions:has(.editor-more[open]){padding-bottom:148px!important}}
    `;
    document.head.appendChild(st);
  }

  if(typeof S!=='undefined'&&!S.loading&&S.view==='dashboard')render();
})();
