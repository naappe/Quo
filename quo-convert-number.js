/* Quo v38 - conversions immediately create and number the target document. */
(function(){
  async function createConvertedDocument(type){
    if(typeof S==='undefined'||!S.current)return;

    try{if(typeof readEditor==='function')readEditor()}catch(e){}
    let source=S.current;

    /* A conversion must point to a real saved source document. Save any new or
       edited source first so the relationship and copied data are reliable. */
    if(!source.id||S.editorDirty){
      const ok=await saveCurrent(false);
      if(!ok)return;
      source=S.current;
    }

    /* Do not accidentally create the same conversion twice. */
    const existing=(S.docs||[]).find(d=>
      d.source_document_id===source.id&&
      d.document_type===type&&
      d.status!=='Cancelled'
    );
    if(existing){
      openEditor(existing);
      toast(`${existing.document_number} already exists for ${source.document_number}`);
      return;
    }

    const sourceNumber=source.document_number;
    const copy=blankDoc(type,source);
    copy.source_document_id=source.id;
    copy.creation_date=isoToday();

    if(type==='invoice'){
      copy.status='Draft';
      copy.use_advance=false;
      copy.paid_amount=0;
      copy.payment_reference='';
      copy.extra_terms=S.settings.invoice_terms||copy.extra_terms;
    }else if(type==='proforma'){
      copy.status='Awaiting Payment';
      copy.paid_amount=0;
      copy.payment_reference='';
    }

    S.editorDirty=false;
    openEditor(copy);

    /* First insert is where Supabase atomically assigns INV/PI-YYYY-####. */
    const ok=await saveCurrent(false);
    if(!ok)return;

    S.editorDirty=false;
    toast(`${S.current.document_number} created from ${sourceNumber}`);
    render();
  }

  /* Replace the old preview-only conversion behavior. */
  convertCurrent=function(type){
    return createConvertedDocument(type);
  };
})();
