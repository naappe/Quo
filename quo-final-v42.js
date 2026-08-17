/* Quo v51 - final workflow UX: quotation actions live on Dashboard and use atomic conversion. */
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

  function goToQuotationActions(){
    S.current=null;
    S.view='dashboard';
    S.filter='all';
    render();
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      const target=document.getElementById('quotationActions');
      if(!target)return;
      target.scrollIntoView({behavior:'smooth',block:'start'});
      target.classList.add('quo-focus-panel');
      setTimeout(()=>target.classList.remove('quo-focus-panel'),1400);
    }));
  }

  function finalEditorRules(){
    if(S.view!=='editor'||!S.current)return;
    const d=S.current,status=document.querySelector('[data-field="status"]');
    if(d.document_type==='quotation'&&status){
      status.disabled=true;
      const confirmed=['Confirmed','Accepted'].includes(d.status);
      status.title=confirmed?'Confirmed quotations continue through the linked Proforma workflow.':'Quotation status is managed from Dashboard → Quotation Actions.';
      const field=status.closest('.field');
      if(field&&!field.querySelector('.quo-status-manage')){
        field.insertAdjacentHTML('beforeend',`<div class="quo-status-manage"><small>${confirmed?'Quotation confirmed. Continue with the linked document workflow.':'Status changes are handled in Quotation Actions.'}</small><button type="button" data-go-quote-actions>${confirmed?'View Workflow':'Manage Status'} →</button></div>`);
      }
    }
    if(d.document_type==='proforma'&&d.status==='Converted'&&status){status.disabled=true;status.title='Converted Proforma status is locked.';}
  }

  const previousBind=bindDynamic;
  bindDynamic=function(){
    previousBind();finalEditorRules();
    $$('[data-quote-stage]').forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();updateQuoteStage(b.dataset.quoteId,b.dataset.quoteStage)});
    $$('[data-go-quote-actions]').forEach(b=>b.onclick=e=>{e.preventDefault();goToQuotationActions()});
  };

  if(!document.getElementById('quoFinalV51Style')){
    const st=document.createElement('style');st.id='quoFinalV51Style';st.textContent=`
      .wf-queues>.wf-panel:first-child{display:none!important}
      .quo-final-pipeline{margin-bottom:12px!important;scroll-margin-top:92px}
      .quo-status-manage{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:6px;padding:7px 9px;border:1px solid #e1e6e4;border-radius:7px;background:#f8faf9}
      .quo-status-manage small{font-size:8.5px;line-height:1.35;color:#737d79}
      .quo-status-manage button{flex:0 0 auto;border:0;background:transparent;padding:2px 0;color:#27695c;font-size:9px;font-weight:850;cursor:pointer}
      .quo-status-manage button:hover{text-decoration:underline}
      [data-field="status"]:disabled{background:#f5f7f6!important;color:#6e7774!important;cursor:not-allowed!important}
      .quo-focus-panel{box-shadow:0 0 0 3px rgba(47,107,80,.12),0 8px 28px rgba(32,53,46,.08)!important;border-color:#9fc4b6!important;transition:box-shadow .2s,border-color .2s}
      @media(max-width:560px){.quo-status-manage{align-items:flex-start;flex-direction:column}.quo-status-manage button{font-size:9.5px}}
    `;document.head.appendChild(st);
  }

  if(!S.loading&&S.view==='dashboard')render();
})();