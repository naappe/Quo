/* Quo v12 atomic document numbering.
   The database assigns the permanent number during first INSERT.
   Format: QT-YYYY-0001 / PI-YYYY-0001 / INV-YYYY-0001 / RC-YYYY-0001. */

saveCurrent=async function(showToast=true){
  readEditor();
  const d=S.current;
  const name=prepared();
  const wasNew=!d.id;

  if(!name){
    alert('Enter Prepared By before saving.');
    $('#preparedBy')?.focus();
    return false;
  }
  if(!d.creation_date){
    alert('Enter the Issue Date before saving. The issue year is used for the automatic document number.');
    document.querySelector('[data-field="creation_date"]')?.focus();
    return false;
  }
  if(!d.customer_name?.trim()){
    alert('Enter the customer name before saving.');
    return false;
  }
  if(!(d.items||[]).some(i=>String(i.description||'').trim())){
    alert('Add at least one item description.');
    return false;
  }

  if(['invoice','proforma'].includes(d.document_type)&&d.status!=='Cancelled'){
    const cc=calc(d);
    if(num(d.paid_amount)>0)d.status=num(d.paid_amount)>=cc.total?'Paid':'Part Paid';
  }

  try{
    if(wasNew){
      // NEW is intentionally sent to Supabase. A BEFORE INSERT trigger assigns
      // the next number atomically in the same transaction as the document insert.
      d.document_number='NEW';
      const r=await sb.from('quo_documents')
        .insert({...payload(d),created_by:null,created_by_name:name,updated_by:null,updated_by_name:name})
        .select('*')
        .single();
      if(r.error)throw r.error;
      S.current={...d,...r.data};
    }else{
      const p=payload(d);
      delete p.document_number;
      delete p.document_type;
      const r=await sb.from('quo_documents')
        .update({...p,updated_by:null,updated_by_name:name})
        .eq('id',d.id)
        .select('*')
        .single();
      if(r.error)throw r.error;
      S.current={...d,...r.data};
    }

    if(wasNew&&S.current.document_type==='receipt'&&S.current.source_document_id){
      await applyReceiptToSource(S.current,name);
    }
    await refreshDocs();
    if(showToast)toast(`${S.current.document_number} saved`);
    render();
    return true;
  }catch(e){
    console.error(e);
    alert('Save failed: '+(e?.message||'Unknown error'));
    return false;
  }
};

if(!document.getElementById('quoNumberingStyle')){
  const style=document.createElement('style');
  style.id='quoNumberingStyle';
  style.textContent='.number-hint{display:block;margin-top:4px;font-size:8px;color:#929799}';
  document.head.appendChild(style);
}
