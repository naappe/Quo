/* Quo v8 action safety: validates save/payment flows, linked documents and PDF export. */

const _quoSafeSaveCurrent=saveCurrent;
saveCurrent=async function(showToast=true){
  readEditor();
  const d=S.current;
  if(d&&['invoice','proforma'].includes(d.document_type)&&d.status!=='Cancelled'){
    const c=calc(d),paid=num(d.paid_amount);
    if(paid<0){alert('Paid amount cannot be negative.');return false}
    if(paid>c.total+0.005){alert(`Paid amount cannot be greater than the document total (${money(c.total,d.currency)}).`);return false}
    if(c.total>0&&paid>=c.total)d.status='Paid';
    else if(paid>0)d.status='Part Paid';
    else if(['Paid','Part Paid'].includes(d.status))d.status=d.document_type==='proforma'?'Awaiting Payment':'Sent';
    const statusField=document.querySelector('[data-field="status"]');
    if(statusField)statusField.value=d.status;
  }
  return _quoSafeSaveCurrent(showToast);
};

const _quoSafeConvertCurrent=convertCurrent;
convertCurrent=function(type){
  readEditor();
  if(!S.current?.id){
    alert('Save this document first before converting it. This keeps the document history and source reference correct.');
    return;
  }
  return _quoSafeConvertCurrent(type);
};

const _quoSafeRenderEditor=renderEditor;
renderEditor=function(){
  let html=_quoSafeRenderEditor();
  if(S.current&&!S.current.id){
    html=html.replace('<button class="btn" data-toggle-convert>Convert ▾</button>','<button class="btn" data-toggle-convert disabled title="Save this document before converting">Convert ▾</button>');
  }
  return html;
};

const _quoSafeDeleteDocument=softDeleteDocument;
softDeleteDocument=async function(id){
  const d=(S.current?.id===id?S.current:S.docs.find(x=>x.id===id));
  if(!d)return;
  const linked=S.docs.filter(x=>x.id!==id&&x.source_document_id===id);
  if(linked.length){
    const refs=linked.slice(0,5).map(x=>x.document_number).join(', ')+(linked.length>5?' ...':'');
    alert(`Cannot delete ${d.document_number} because it has linked document${linked.length===1?'':'s'}: ${refs}.\n\nDelete or resolve the linked document first so the commercial history is not broken.`);
    return;
  }
  return _quoSafeDeleteDocument(id);
};

receiptFromCurrent=function(){
  readEditor();
  const src=S.current,c=calc(src);
  if(!src?.id)return alert('Save the invoice before creating a receipt.');
  if(c.balance<=0)return alert('This invoice is already fully paid.');
  const raw=prompt('Payment amount received',String(c.balance.toFixed(2)));
  if(raw===null)return;
  const amt=num(raw);
  if(amt<=0)return alert('Enter a payment amount greater than 0.');
  if(amt>c.balance+0.005)return alert(`Payment cannot be greater than the current balance (${money(c.balance,src.currency)}).`);
  const r=blankDoc('receipt');
  r.customer_name=src.customer_name;
  r.customer_phone=src.customer_phone;
  r.customer_address=src.customer_address;
  r.currency=src.currency;
  r.creation_date=isoToday();
  r.source_document_id=src.id;
  r.items=[{description:`Payment received for ${src.document_number}`,qty:1,unit:'Payment',price:amt}];
  r.paid_amount=amt;
  r.extra_terms=`Payment received against ${src.document_number}.`;
  openEditor(r);
};

exportPDF=async function(){
  try{
    readEditor();
    if(!S.current)return alert('Open a document before exporting.');
    const ok=await saveCurrent(false);
    if(!ok)return;
    renderPrint(S.current);
    const root=$('#printRoot');
    const pages=root?[...root.querySelectorAll('.pdf-page')]:[];
    if(!root||!pages.length){
      console.error('PDF export aborted: no printable pages were generated.');
      alert('Could not prepare the PDF. Please refresh Quo and try again.');
      return;
    }
    const expected=S.current.include_menu&&String(S.current.menu_text||'').trim()&&S.current.document_type!=='receipt'?2:1;
    if(pages.length<expected){
      console.warn(`PDF export generated ${pages.length} page(s); ${expected} expected.`);
      alert('The PDF preview is incomplete. Please check the menu content before exporting.');
      return;
    }
    const oldTitle=document.title;
    const safeCustomer=String(S.current.customer_name||'document').replace(/[\\/:*?"<>|]+/g,'-').trim()||'document';
    document.title=`${S.current.document_number}-${safeCustomer}`;
    let restored=false;
    const restore=()=>{if(restored)return;restored=true;document.title=oldTitle};
    window.addEventListener('afterprint',restore,{once:true});
    toast(`Preparing ${pages.length}-page PDF...`);
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      window.focus();
      window.print();
      setTimeout(restore,1500);
    }));
  }catch(e){
    console.error('PDF export failed',e);
    alert('PDF export failed: '+(e?.message||'Unknown error'));
  }
};
