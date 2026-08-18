/* Quo v57 - safe quotation workflow status editing. */
(function(){
  const actor=()=>String(S?.displayName||'White Saffron').trim()||'White Saffron';

  function linkedActiveProforma(quote){
    const key=quote.deal_id||quote.id;
    return (S.docs||[]).find(x=>x.document_type==='proforma'&&!x.deleted_at&&x.status!=='Cancelled'&&(x.source_document_id===quote.id||x.deal_id===key));
  }

  function syncCurrent(id){
    if(!S.current||S.current.id!==id)return;
    const fresh=(S.docs||[]).find(x=>x.id===id);
    if(fresh)S.current={...fresh};
  }

  updateQuoteStage=async function(id,status){
    const d=(S.docs||[]).find(x=>x.id===id)||(S.current?.id===id?S.current:null);
    if(!d||d.document_type!=='quotation')return false;

    if(status==='Confirmed'){
      if(d.status==='Confirmed')return true;
      if(!confirm(`Confirm ${d.document_number} and create its Proforma Invoice?`))return false;
      try{
        const r=await sb.rpc('quo_convert_document',{p_source_id:d.id,p_target_type:'proforma',p_actor:actor()});
        if(r.error)throw r.error;
        await refreshDocs();
        syncCurrent(id);
        const target=r.data?.document;
        toast(target?.document_number?`${target.document_number} created - ${d.document_number} confirmed`:`${d.document_number} confirmed`);
        render();
        return true;
      }catch(e){console.error(e);alert('Could not confirm quotation: '+(e?.message||'Unknown error'));return false;}
    }

    if(!['Draft','Sent','Follow Up','Lost','Expired'].includes(status))return false;

    if(d.status==='Confirmed'){
      const pi=linkedActiveProforma(d);
      if(pi){
        alert(`${d.document_number} already has linked ${pi.document_number}. Cancel or resolve that Proforma before reopening the quotation.`);
        render();
        return false;
      }
    }
    if(status==='Lost'&&!confirm(`Mark ${d.document_number} as lost?`))return false;

    try{
      const r=await sb.from('quo_documents').update({status,updated_by:null,updated_by_name:actor()}).eq('id',id).select('*').single();
      if(r.error)throw r.error;
      await refreshDocs();
      syncCurrent(id);
      toast(`${d.document_number} - ${status}`);
      render();
      return true;
    }catch(e){console.error(e);alert('Could not update quotation: '+(e?.message||'Unknown error'));render();return false;}
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
      status.disabled=false;
      status.removeAttribute('title');
      status.closest('.field')?.querySelector('.quo-status-manage')?.remove();
      status.closest('.field')?.querySelector('.quo-status-note')?.remove();
      status.oninput=null;
      status.onchange=async e=>{
        const next=e.target.value;
        const current=(S.docs||[]).find(x=>x.id===d.id)?.status||d.status;
        if(next===current)return;
        e.target.disabled=true;

        /* A workflow action must never discard unsaved customer/items/menu edits. */
        if(S.editorDirty){
          e.target.value=current;
          const saved=await saveCurrent(false);
          if(!saved){
            if(document.body.contains(e.target)){e.target.disabled=false;e.target.value=current;}
            return;
          }
        }

        const ok=await updateQuoteStage(d.id,next);
        if(!ok&&document.body.contains(e.target)){e.target.disabled=false;e.target.value=current;}
      };
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

  if(!document.getElementById('quoFinalV57Style')){
    const st=document.createElement('style');st.id='quoFinalV57Style';st.textContent=`
      .wf-queues>.wf-panel:first-child{display:none!important}
      .quo-final-pipeline{margin-bottom:12px!important;scroll-margin-top:92px}
      .quo-status-manage,.quo-status-note{display:none!important}
      [data-field="status"]:disabled{background:#f5f7f6!important;color:#6e7774!important;cursor:default!important}
    `;document.head.appendChild(st);
  }

  if(!S.loading&&S.view==='dashboard')render();
})();