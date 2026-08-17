/* Quo v50 - shared workflow presentation and navigation.
   Dashboard data/logic is owned by quo-core-v41.js. */
(function(){
  const previousRenderDocuments=renderDocuments;
  renderDocuments=function(){
    let html=previousRenderDocuments();
    const type=S.filter;
    if(!['quotation','proforma','invoice','receipt'].includes(type))return html;
    const rows=(S.docs||[]).filter(d=>d.document_type===type&&d.status!=='Cancelled'&&!d.deleted_at);
    const statuses=CFG[type]?.statuses||[];
    const summary=statuses.filter(s=>s!=='Cancelled').map(s=>[s,rows.filter(d=>d.status===s).length]).filter(([,n])=>n>0);
    const bar=`<section class="wf-page-summary"><div><b>${rows.length}</b><span>Total ${esc(CFG[type]?.plural||'Documents')}</span></div>${summary.map(([s,n])=>`<div><b>${n}</b><span>${esc(s)}</span></div>`).join('')}</section>`;
    const marker='<div class="toolbar-row">';
    return html.includes(marker)?html.replace(marker,bar+marker):bar+html;
  };

  const previousBind=bindDynamic;
  bindDynamic=function(){
    previousBind();
    $$('[data-workflow-open]').forEach(b=>b.onclick=e=>{e.preventDefault();goDocuments(b.dataset.workflowOpen||'all')});
    $$('[data-doc-filter]').forEach(b=>{if(!b.closest('.chips'))b.onclick=e=>{e.preventDefault();goDocuments(b.dataset.docFilter||'all')}});
    $$('.wf-stage [data-open],.wf-queue-row[data-open]').forEach(b=>b.onclick=e=>{e.preventDefault();const d=S.docs.find(x=>x.id===b.dataset.open);if(d)openEditor(d)});
  };

  if(!document.getElementById('quoWorkflowV50Style')){
    document.getElementById('quoWorkflowV44Style')?.remove();
    const st=document.createElement('style');
    st.id='quoWorkflowV50Style';
    st.textContent=`
      .wf-sequence{display:grid;grid-template-columns:minmax(0,1fr) 22px minmax(0,1fr) 22px minmax(0,1fr) 22px minmax(0,1fr);gap:8px;align-items:stretch;margin:0 0 14px}
      .wf-stage{min-width:0;background:#fff;border:1px solid #e3e6e7;border-radius:9px;overflow:hidden;align-self:stretch}.wf-stage-head{width:100%;border:0;background:#fff;display:grid;grid-template-columns:34px 1fr 18px;gap:9px;align-items:center;text-align:left;padding:13px 14px 10px;color:#25292b}.wf-stage-head:hover{background:#fafbfb}
      .wf-stage-code{width:32px;height:32px;border-radius:7px;display:grid;place-items:center;background:#f1f2f3;font-size:9px;font-weight:800;color:#5d6466}.wf-stage.quotation .wf-stage-code{background:#f1edff;color:#6f55d9}.wf-stage.proforma .wf-stage-code{background:#fff4e6;color:#cf7d20}.wf-stage.invoice .wf-stage-code{background:#edf5ff;color:#397fd0}.wf-stage.receipt .wf-stage-code{background:#edf7f1;color:#4f9f73}
      .wf-stage-head b{display:block;font-size:12px;font-weight:650}.wf-stage-head small{display:block;margin-top:2px;font-size:8.5px;color:#8a9092}.wf-stage-arrow{font-size:18px;color:#afb4b6;text-align:right}
      .wf-stage-metrics{display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid #edf0f1;border-bottom:1px solid #edf0f1;background:#fbfcfc}.wf-stage-metrics span{padding:9px 8px;text-align:center;border-right:1px solid #edf0f1;min-width:0}.wf-stage-metrics span:last-child{border-right:0}.wf-stage-metrics b{display:block;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.wf-stage-metrics small{display:block;margin-top:2px;font-size:7.5px;color:#8b9193;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .wf-latest{width:100%;min-height:44px;border:0;background:#fff;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:7px;padding:9px 11px;text-align:left;color:#25292b}.wf-latest:hover{background:#fafbfb}.wf-latest b{font-size:9px}.wf-latest span{font-size:8.5px;color:#737a7c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.wf-latest em{font-style:normal}.wf-latest.empty-copy{display:block;color:#9aa0a2;font-size:8.5px;padding-top:14px}.wf-connector{display:grid;place-items:center;color:#b1b6b8;font-size:18px}
      .wf-queues{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}.wf-panel{min-width:0}.wf-queue{padding:4px 9px}.wf-queue-row{width:100%;border:0;border-bottom:1px solid #edf0f1;background:#fff;display:grid;grid-template-columns:78px minmax(120px,1fr) 110px auto;gap:9px;align-items:center;padding:9px 5px;text-align:left;color:#25292b}.wf-queue-row:last-child{border-bottom:0}.wf-queue-row:hover{background:#fafbfb}.wf-queue-type{font-size:8px;color:#858c8e;text-transform:uppercase;letter-spacing:.05em}.wf-queue-main b,.wf-queue-main small{display:block}.wf-queue-main b{font-size:9.5px}.wf-queue-main small{font-size:8.5px;color:#7e8587;margin-top:2px}.wf-queue-money{font-size:9px;font-weight:650;text-align:right;white-space:nowrap}.wf-recent{margin-bottom:20px}
      .wf-page-summary{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 12px}.wf-page-summary>div{min-width:96px;padding:9px 11px;border:1px solid #e4e7e8;border-radius:7px;background:#fff}.wf-page-summary b{display:block;font-size:14px}.wf-page-summary span{display:block;margin-top:2px;font-size:8px;color:#858b8d}.quo-dashboard-total{padding:10px 14px;border-top:1px solid #edf0f1;text-align:right;font-size:10px;color:#6f7875}.quo-dashboard-total b{margin-left:8px;color:#26332f}

      /* Medium desktop/tablet: four workflow stages become a clean 2x2 grid.
         Connectors are intentionally hidden here instead of becoming grid items and creating blank rows. */
      @media(max-width:1250px){
        .wf-sequence{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;align-items:stretch}
        .wf-sequence>.wf-connector{display:none}
        .wf-queues{grid-template-columns:1fr 1fr}
      }
      @media(max-width:900px){
        .wf-queues{grid-template-columns:1fr}
        .wf-queue-row{grid-template-columns:70px minmax(0,1fr) auto}.wf-queue-money{display:none}
      }
      @media(max-width:680px){
        .wf-sequence{grid-template-columns:1fr;gap:8px}
        .wf-stage{margin:0}
      }
      @media(max-width:520px){.wf-queue-row{grid-template-columns:1fr auto}.wf-queue-type{display:none}.wf-page-summary>div{min-width:82px;flex:1}}
    `;
    document.head.appendChild(st);
  }
})();