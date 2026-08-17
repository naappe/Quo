/* Quo v39 - controlled invoice payments with automatic receipt creation. */
(function(){
  const EPS=0.005;

  function linkedReceipts(invoiceId){
    return (S.docs||[])
      .filter(d=>d.document_type==='receipt'&&d.source_document_id===invoiceId&&d.status!=='Cancelled')
      .sort((a,b)=>String(b.created_at||b.updated_at||'').localeCompare(String(a.created_at||a.updated_at||'')));
  }

  function ensurePaymentModal(){
    if(document.getElementById('quoPaymentModal'))return;
    const wrap=document.createElement('div');
    wrap.id='quoPaymentModal';
    wrap.className='modal hidden quo-payment-modal';
    wrap.setAttribute('role','dialog');
    wrap.setAttribute('aria-modal','true');
    wrap.innerHTML=`<div class="modal-card quo-payment-card">
      <div class="modal-head"><div><div class="eyebrow">INVOICE PAYMENT</div><h2>Record Payment</h2></div><button class="icon-btn" type="button" data-payment-close>×</button></div>
      <div class="quo-payment-summary">
        <div><span>Invoice</span><b id="quoPayInvoice">-</b></div>
        <div><span>Total</span><b id="quoPayTotal">MVR 0.00</b></div>
        <div><span>Already Paid</span><b id="quoPayPaid">MVR 0.00</b></div>
        <div class="balance"><span>Balance Due</span><b id="quoPayBalance">MVR 0.00</b></div>
      </div>
      <div class="form-grid two quo-payment-fields">
        <div class="field"><label>Amount Received</label><input id="quoPayAmount" type="number" min="0.01" step="0.01"></div>
        <div class="field"><label>Payment Date</label><input id="quoPayDate" type="date"></div>
        <div class="field"><label>Method</label><select id="quoPayMethod"><option>Bank Transfer</option><option>Cash</option><option>Other</option></select></div>
        <div class="field"><label>Reference</label><input id="quoPayReference" placeholder="Optional transfer / cash reference"></div>
      </div>
      <div class="quo-payment-error hidden" id="quoPayError"></div>
      <div class="quo-payment-actions"><button class="btn" type="button" data-payment-close>Cancel</button><button class="btn primary" type="button" id="quoPayConfirm">Record Payment & Create Receipt</button></div>
    </div>`;
    document.body.appendChild(wrap);
    wrap.querySelectorAll('[data-payment-close]').forEach(b=>b.onclick=closePaymentModal);
    wrap.addEventListener('click',e=>{if(e.target===wrap)closePaymentModal()});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!wrap.classList.contains('hidden'))closePaymentModal()});
    document.getElementById('quoPayConfirm').onclick=submitPayment;
  }

  let paymentInvoiceId=null;

  function openPaymentModal(invoiceId){
    ensurePaymentModal();
    const invoice=(S.docs||[]).find(d=>d.id===invoiceId)||(S.current?.id===invoiceId?S.current:null);
    if(!invoice||invoice.document_type!=='invoice')return;
    const c=calc(invoice);
    if(c.balance<=EPS){toast(`${invoice.document_number} is already paid`);return}
    paymentInvoiceId=invoice.id;
    document.getElementById('quoPayInvoice').textContent=invoice.document_number;
    document.getElementById('quoPayTotal').textContent=money(c.total,invoice.currency);
    document.getElementById('quoPayPaid').textContent=money(c.paid,invoice.currency);
    document.getElementById('quoPayBalance').textContent=money(c.balance,invoice.currency);
    document.getElementById('quoPayAmount').value=c.balance.toFixed(2);
    document.getElementById('quoPayAmount').max=c.balance.toFixed(2);
    document.getElementById('quoPayDate').value=isoToday();
    document.getElementById('quoPayMethod').value='Bank Transfer';
    document.getElementById('quoPayReference').value='';
    document.getElementById('quoPayError').classList.add('hidden');
    document.getElementById('quoPayError').textContent='';
    document.getElementById('quoPaymentModal').classList.remove('hidden');
    setTimeout(()=>document.getElementById('quoPayAmount')?.select(),20);
  }

  function closePaymentModal(){
    const m=document.getElementById('quoPaymentModal');
    if(m)m.classList.add('hidden');
    paymentInvoiceId=null;
  }

  function paymentError(message){
    const el=document.getElementById('quoPayError');
    if(!el)return;
    el.textContent=message;
    el.classList.remove('hidden');
  }

  async function submitPayment(){
    const invoice=(S.docs||[]).find(d=>d.id===paymentInvoiceId)||(S.current?.id===paymentInvoiceId?S.current:null);
    if(!invoice)return paymentError('Invoice could not be found.');
    const c=calc(invoice);
    const amount=num(document.getElementById('quoPayAmount')?.value);
    const date=document.getElementById('quoPayDate')?.value||'';
    const method=document.getElementById('quoPayMethod')?.value||'Bank Transfer';
    const reference=String(document.getElementById('quoPayReference')?.value||'').trim();

    if(amount<=0)return paymentError('Enter an amount greater than 0.');
    if(amount>c.balance+EPS)return paymentError(`Payment cannot exceed the balance of ${money(c.balance,invoice.currency)}.`);
    if(!date)return paymentError('Select the payment date.');

    const btn=document.getElementById('quoPayConfirm');
    btn.disabled=true;
    btn.textContent='Recording...';

    let insertedReceipt=null;
    try{
      const name=prepared()||'White Saffron';
      const receipt=blankDoc('receipt');
      receipt.document_number='NEW';
      receipt.status='Issued';
      receipt.currency=invoice.currency;
      receipt.creation_date=date;
      receipt.customer_name=invoice.customer_name;
      receipt.customer_phone=invoice.customer_phone;
      receipt.customer_address=invoice.customer_address;
      receipt.source_document_id=invoice.id;
      receipt.items=[{description:`Payment received for ${invoice.document_number}`,qty:1,unit:'Payment',price:amount}];
      receipt.paid_amount=amount;
      receipt.payment_reference=reference?`${method} - ${reference}`:method;
      receipt.extra_terms=`Payment received against ${invoice.document_number}. Method: ${method}.${reference?` Reference: ${reference}.`:''}`;

      const rr=await sb.from('quo_documents')
        .insert({...payload(receipt),created_by:null,created_by_name:name,updated_by:null,updated_by_name:name})
        .select('*').single();
      if(rr.error)throw rr.error;
      insertedReceipt=rr.data;

      const newPaid=Math.min(c.total,c.paid+amount);
      const newStatus=newPaid>=c.total-EPS?'Paid':'Part Paid';
      const ir=await sb.from('quo_documents')
        .update({paid_amount:newPaid,status:newStatus,payment_reference:receipt.payment_reference,updated_by:null,updated_by_name:name})
        .eq('id',invoice.id).select('*').single();
      if(ir.error)throw ir.error;

      await refreshDocs();
      if(S.current?.id===invoice.id)S.current={...S.current,...ir.data};
      closePaymentModal();
      S.editorDirty=false;
      render();
      toast(`${insertedReceipt.document_number} created - ${invoice.document_number} is ${newStatus}`);
    }catch(e){
      console.error(e);
      if(insertedReceipt?.id){
        try{await sb.from('quo_documents').delete().eq('id',insertedReceipt.id)}catch(_e){}
      }
      paymentError('Payment could not be recorded: '+(e?.message||'Unknown error'));
    }finally{
      btn.disabled=false;
      btn.textContent='Record Payment & Create Receipt';
    }
  }

  function enhanceInvoicePaymentUI(){
    if(typeof S==='undefined'||S.view!=='editor'||!S.current||S.current.document_type!=='invoice')return;
    const d=S.current,c=calc(d);
    const actions=document.querySelector('.editor-actions');
    const state=document.querySelector('.editor-save-state');

    if(state&&!document.querySelector('.quo-invoice-payment-state')){
      const line=document.createElement('div');
      line.className='quo-invoice-payment-state';
      line.innerHTML=`<span>Paid <b>${esc(money(c.paid,d.currency))}</b></span><span>Balance <b>${esc(money(c.balance,d.currency))}</b></span>`;
      state.insertAdjacentElement('afterend',line);
    }

    if(actions&&d.id){
      if(c.balance>EPS&&!actions.querySelector('[data-record-payment]')){
        const more=actions.querySelector('.editor-more');
        const b=document.createElement('button');
        b.type='button';b.className='btn quo-record-payment';b.dataset.recordPayment=d.id;b.textContent='Record Payment';
        if(more)more.insertAdjacentElement('beforebegin',b);else actions.appendChild(b);
        b.onclick=()=>openPaymentModal(d.id);
      }
      if(c.balance<=EPS&&!actions.querySelector('.quo-paid-indicator')){
        const more=actions.querySelector('.editor-more');
        const paid=document.createElement('span');
        paid.className='quo-paid-indicator';paid.textContent='Paid';
        if(more)more.insertAdjacentElement('beforebegin',paid);else actions.appendChild(paid);
      }

      const receipts=linkedReceipts(d.id);
      const moreMenu=actions.querySelector('.editor-more-menu');
      if(receipts.length&&moreMenu&&!moreMenu.querySelector('[data-open-payment-receipt]')){
        const rb=document.createElement('button');
        rb.type='button';rb.className='btn';rb.dataset.openPaymentReceipt=receipts[0].id;
        rb.textContent=receipts.length>1?`Open Latest Receipt (${receipts.length})`:'Open Receipt';
        moreMenu.appendChild(rb);
        rb.onclick=e=>{e.preventDefault();const r=(S.docs||[]).find(x=>x.id===rb.dataset.openPaymentReceipt);if(r)openEditor(r)};
      }
    }

    /* Paid / Part Paid are system controlled. Users can still manage normal invoice workflow statuses. */
    const status=document.querySelector('[data-field="status"]');
    if(status){
      [...status.options].forEach(o=>{
        if(['Paid','Part Paid'].includes(o.value)&&o.value!==d.status)o.remove();
      });
      if(['Paid','Part Paid'].includes(d.status)){
        status.disabled=true;
        status.title='Payment status is controlled by recorded payments.';
      }
    }
  }

  const previousBind=bindDynamic;
  bindDynamic=function(){
    previousBind();
    enhanceInvoicePaymentUI();
  };

  if(!document.getElementById('quoPaymentsV39Style')){
    const st=document.createElement('style');
    st.id='quoPaymentsV39Style';
    st.textContent=`
      .quo-record-payment{border-color:#b8d6c6!important;background:#f1f8f4!important;color:#276446!important;font-weight:700!important}
      .quo-paid-indicator{display:inline-flex;align-items:center;min-height:36px;padding:0 12px;border:1px solid #cfe5d8;border-radius:7px;background:#edf7f1;color:#397a56;font-size:10px;font-weight:800}
      .quo-invoice-payment-state{display:flex;gap:10px;margin-top:5px;font-size:9px;color:#78817e}.quo-invoice-payment-state b{color:#34403c;font-weight:750}
      .quo-payment-modal{z-index:2147483601}.quo-payment-card{width:min(620px,calc(100vw - 28px))!important}
      .quo-payment-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:14px 0;padding:10px;border:1px solid #e2e7e5;border-radius:9px;background:#fafbfb}
      .quo-payment-summary>div{min-width:0;padding:6px 8px}.quo-payment-summary span{display:block;font-size:8px;text-transform:uppercase;letter-spacing:.06em;color:#7c8582}.quo-payment-summary b{display:block;margin-top:4px;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.quo-payment-summary .balance b{color:#276446}
      .quo-payment-fields{margin-top:8px}.quo-payment-error{margin-top:10px;padding:9px 11px;border:1px solid #efc9c6;border-radius:7px;background:#fff3f2;color:#9c3f38;font-size:10px}
      .quo-payment-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px;padding-top:12px;border-top:1px solid #e6e9e8}
      @media(max-width:620px){.quo-payment-summary{grid-template-columns:1fr 1fr}.quo-payment-fields{grid-template-columns:1fr!important}.quo-payment-actions{flex-direction:column-reverse}.quo-payment-actions .btn{width:100%}}
    `;
    document.head.appendChild(st);
  }

  ensurePaymentModal();
  if(typeof S!=='undefined'&&S.view==='editor')enhanceInvoicePaymentUI();
})();
