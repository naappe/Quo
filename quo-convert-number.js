/* Quo v41 - atomic, deal-aware document conversion via Supabase RPC. */
(function(){
  async function convertAtomic(type){
    if(typeof S==='undefined'||!S.current)return;
    try{if(typeof readEditor==='function')readEditor()}catch(e){}

    if(!S.current.id||S.editorDirty){
      const ok=await saveCurrent(false);
      if(!ok)return;
    }

    const source={...S.current};
    if(source.document_type==='quotation'&&!['proforma','invoice'].includes(type))return;
    if(source.document_type==='proforma'&&type!=='invoice')return;

    try{
      const r=await sb.rpc('quo_convert_document',{
        p_source_id:source.id,
        p_target_type:type,
        p_actor:'White Saffron'
      });
      if(r.error)throw r.error;
      const result=r.data||{};
      const target=result.document;
      if(!target?.id)throw new Error('Converted document was not returned.');
      await refreshDocs();
      const current=S.docs.find(d=>d.id===target.id)||target;
      S.editorDirty=false;
      openEditor(current);
      toast(result.created===false?`${current.document_number} already exists for this deal`:`${current.document_number} created from ${source.document_number}`);
    }catch(e){
      console.error(e);
      alert('Conversion failed: '+(e?.message||'Unknown error'));
    }
  }

  convertCurrent=function(type){return convertAtomic(type)};
})();
