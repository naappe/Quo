/* Quo v52 - final workflow UX: quotation actions live on Dashboard and use atomic conversion. */
(function(){
  const ACTOR='White Saffron';

  updateQuoteStage=async function(id,status){
    const d=(S.docs||[]).find(x=>x.id===id)||(S.current?.id===id?S.current:null);
    if(!d||d.document_type!=='quotation')return;
    if(status==='Confirmed'){
      if(!confirm(`Confirm ${d.document_number} and create its Proforma Invoice?`))return;
      try{
        const r=await sb.rpc('quo_convert_document',{p_source_id:d.id,p_target_type:'proforma',p_actor:ACTOR});
        if(r.error)throw r.error;
        await refreshDocs();
        const target=r.data?.document;
        toast(target?.document_number?`${target.document_number} created - ${d.document_number} confirmed`:`${d.document_number} confirmed`);
        render();
      }catch(e){console.error(e);alert('Could not confirm quotation: '+(e?.message||'Unknown error'));}
      return;
    }
    if(!['Sent','Follow Up','Lost','Expired'].includes(status))return;
    if(status==='Lost'&&!confirm(`Mark ${d.document_number} as lost?`))return;
    try{
      const r=await sb.from('quo_documents').update({status,updated_by:null,updated_by_name:ACTOR}).eq('id',id).select('*').single();
      if(r.error)throw r.error;
      await refreshDocs();toast(`${d.document_number} - ${status}`);render();
    }catch(e){console.error(e);alert('Could not update quotation: '+(e?.message||'Unknown error'));}
  };

  const coreDashboard=renderDashboard;
  renderDashboard=function(){
    let html=coreDashboard();
    const quotes=(S.docs||[]).filter(d=>d.document_type==='quotation'&&!d.deleted_at&&d.status!=='Cancelled')
      .sort((a,b)=>String(b.updated_at||b.created_at||'').localeCompare(String(a.updated_at||a.created_at||''))).slice(0,8);
    const pipeline=`<section class="panel deal-panel quo-final-pipeline" id="quotationActions"><div class="panel-head"><div><h3>Quotation Actions</h3><p>Update quotation status here. Confirming a quotation automatically creates its linked Proforma Invoice.</p></div><button data-workflow-open="quotation">View all quotations</button></div><div class="deal-list">${quotes.length?quotes.map(quotePipelineCard).join(''):'<div class="empty">No quotations yet.</div>'}</div></section>`;
    html=html.replace('<section class="wf-queues">',pipeline+'<section class="wf-queues">');
    return html;
  };

  function finalEditorRules(){
    if(S.view!=='editor'||!S.current)return;
    const d=S.current,status=document.querySelector('[data-field="status"]');
    if(d.document_type==='quotation'&&status){
      status.disabled=true;
      status.removeAttribute('title');
      status.closest('.field')?.querySelector('.quo-status-manage')?.remove();
      status.closest('.field')?.querySelector('.quo-status-note')?.remove();
    }
    if(d.document_type==='proforma'&&d.status==='Converted'&&status){
      status.disabled=true;
      status.removeAttribute('title');
    }
  }

  const previousBind=bindDynamic;
  bindDynamic=function(){
    previousBind();finalEditorRules();
    $$('[data-quote-stage]').forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();updateQuoteStage(b.dataset.quoteId,b.dataset.quoteStage)});
  };

  if(!document.getElementById('quoFinalV52Style')){
    const st=document.createElement('style');st.id='quoFinalV52Style';st.textContent=`
      .wf-queues>.wf-panel:first-child{display:none!important}
      .quo-final-pipeline{margin-bottom:12px!important;scroll-margin-top:92px}
      .quo-status-manage,.quo-status-note{display:none!important}
      [data-field="status"]:disabled{background:#f5f7f6!important;color:#6e7774!important;cursor:default!important}
    `;document.head.appendChild(st);
  }

  if(!S.loading&&S.view==='dashboard')render();
})();