/* Quo v96 - clean customer-facing paid invoice state. */
(function(){
  if(typeof S==='undefined')return;
  const EPS=.005;
  const STAMP='./assets/white-saffron-paid-stamp.png?v=96';
  const METHODS=['Bank Transfer','Cash','Card','Cheque'];

  function isPaidInvoice(d){
    if(!d||d.document_type!=='invoice')return false;
    try{
      const c=calc(d);
      return Number(c.total||0)>EPS&&Number(c.balance||0)<=EPS;
    }catch(e){return String(d.payment_status||'')==='Paid'}
  }

  function receiptsFor(invoiceId){
    return (S.docs||[]).filter(r=>r.document_type==='receipt'&&r.source_document_id===invoiceId&&!r.deleted_at&&r.status!=='Cancelled')
      .sort((a,b)=>`${a.creation_date||''}|${a.created_at||''}`.localeCompare(`${b.creation_date||''}|${b.created_at||''}`));
  }

  function paymentMethod(r){
    const saved=String(r?.payment_method||'').trim();
    if(METHODS.includes(saved))return saved;
    const ref=String(r?.payment_reference||'').trim();
    return METHODS.find(m=>ref.toLowerCase().startsWith(m.toLowerCase()))||'';
  }

  function paymentReference(r){
    let ref=String(r?.payment_reference||'').trim();
    const method=paymentMethod(r);
    if(method&&ref.toLowerCase().startsWith(method.toLowerCase()+' - '))ref=ref.slice(method.length+3).trim();
    if(method&&ref.toLowerCase()===method.toLowerCase())return '';
    return ref;
  }

  function cleanOldPaid(root){
    if(!root)return;
    root.querySelectorAll('.q43-doc-stamp.paid,.quo-paid-stamp-v93').forEach(el=>el.remove());
    root.querySelectorAll('.q43-payment-badge.paid,.q86-pdf-payment-history').forEach(el=>el.remove());
  }

  function cleanPaymentDetails(root,d){
    if(!root||!isPaidInvoice(d))return;
    const rows=receiptsFor(d.id);
    const latest=rows.length?rows[rows.length-1]:null;
    if(!latest)return;
    const block=root.querySelector('.q43-invoice-payment');
    if(!block)return;
    block.classList.add('quo-paid-customer-v95');
    const detail=block.querySelector('.q43-payment-detail');
    if(detail){
      const method=paymentMethod(latest)||'Paid';
      const ref=paymentReference(latest);
      detail.classList.add('quo-v95-payment-detail');
      detail.innerHTML=`<span><small>Paid By</small><b>${esc(method)}</b></span><span><small>Payment Date</small><b>${esc(dateLong(latest.creation_date)||'-')}</b></span>${ref?`<span><small>Reference</small><b>${esc(ref)}</b></span>`:''}`;
    }
  }

  function addHeaderPaid(page){
    if(!page)return;
    const doc=page.querySelector('.q26-doc');
    const number=doc?.querySelector('.no');
    if(!doc||!number||doc.querySelector('.quo-paid-near-number-v96'))return;
    const paid=document.createElement('span');
    paid.className='quo-paid-near-number-v96';
    paid.textContent='PAID';
    number.insertAdjacentElement('afterend',paid);
  }

  function addStamp(root,d){
    cleanOldPaid(root);
    cleanPaymentDetails(root,d);
    if(!root||!isPaidInvoice(d))return;
    const page=root.querySelector('.pdf-page.q26-main,.pdf-page');
    if(!page)return;
    addHeaderPaid(page);
    if(page.querySelector('.quo-paid-stamp-v94'))return;
    const stamp=document.createElement('div');
    stamp.className='quo-paid-stamp-v94';
    stamp.innerHTML=`<img src="${STAMP}" alt="White Saffron"><strong>PAID</strong>`;
    page.appendChild(stamp);
  }

  try{
    const previousPrint=renderPrint;
    renderPrint=function(d){
      const result=previousPrint.apply(this,arguments);
      addStamp(document.getElementById('printRoot'),d);
      return result;
    };
  }catch(e){}

  function paintEditor(){
    if(S.view!=='editor'||!isPaidInvoice(S.current))return;
    document.querySelectorAll('.doc-title-row .badge,.preview-toolbar .badge').forEach(b=>{
      b.textContent='Paid';
      b.classList.add('quo-paid-red-v94');
    });
  }

  try{
    const previousBind=bindDynamic;
    bindDynamic=function(){const result=previousBind.apply(this,arguments);paintEditor();return result};
  }catch(e){}

  document.getElementById('quoPaidStampV93Style')?.remove();
  document.getElementById('quoPaidStampV94Style')?.remove();
  const st=document.createElement('style');
  st.id='quoPaidStampV94Style';
  st.textContent=`
    .q43-doc-stamp.paid,.q43-payment-badge.paid,.quo-paid-stamp-v93{display:none!important}
    .quo-paid-customer-v95 .q43-state-cell strong{color:#b42318!important}
    .quo-paid-customer-v95{border-color:#e4c3c0!important;background:#fffafa!important}
    .quo-v95-payment-detail{grid-template-columns:repeat(3,minmax(0,1fr))!important}
    .quo-paid-near-number-v96{display:inline-block;margin-top:2mm;padding:1.1mm 3mm;border:1px solid #d9473f;border-radius:99px;background:#fff4f3;color:#b42318;font-family:Arial,Helvetica,sans-serif;font-size:7.4pt;line-height:1;font-weight:900;letter-spacing:.08em}
    .quo-paid-stamp-v94{position:absolute;right:18mm;bottom:18mm;top:auto;width:27mm;min-height:29mm;padding:1.8mm 1.8mm 1.6mm;border:.85mm solid #c62828;border-radius:2mm;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.8mm;transform:rotate(-5deg);z-index:12;box-sizing:border-box;pointer-events:none}
    .quo-paid-stamp-v94 img{display:block;width:18mm;height:18mm;object-fit:contain}
    .quo-paid-stamp-v94 strong{display:block;width:100%;padding-top:.9mm;border-top:.5mm solid #c62828;color:#c62828;font-family:Arial,Helvetica,sans-serif;font-size:5.8mm;line-height:1;letter-spacing:.55mm;font-weight:900;text-align:center}
    .quo-paid-red-v94{background:#fff1f1!important;color:#b42318!important;border-color:#efb2ad!important}
    .badge.paid,.payment-paid{color:#b42318!important}
  `;
  document.head.appendChild(st);
  paintEditor();
})();
