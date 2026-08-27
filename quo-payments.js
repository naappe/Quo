/* Quo v86 - invoice payment recording with explicit methods and optional references. */
(function(){
  const EPS=0.005;
  const METHODS=['Bank Transfer','Cash','Card','Cheque'];
  const maleToday=()=>{
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Indian/Maldives',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    const get=t=>parts.find(p=>p.type===t)?.value||'';
    return `${get('year')}-${get('month')}-${get('day')}`;
  };

  function linkedReceipts(invoiceId){
    return (S.docs||[]).filter(d=>d.document_type==='receipt'&&d.source_document_id===invoiceId&&d.status!=='Cancelled'&&!d.deleted_at)
      .sort((a,b)=>String(b.creation_date||b.created_at||b.updated_at||'').localeCompare(String(a.creation_date||a.created_at||a.updated_at||'')));
  }

  function inferMethod(receipt){
    const saved=String(receipt?.payment_method||'').trim();
    if(METHODS.includes(saved))return saved;
    const ref=String(receipt?.payment_reference||'').trim();
    const terms=String(receipt?.extra_terms||'');
    for(const method of METHODS){
      if(ref.toLowerCase().startsWith(method.toLowerCase()))return method;
      if(terms.toLowerCase().includes(`method: ${method.toLowerCase()}`))return method;
    }
    return 'Payment';
  }

  function cleanReference(receipt){
    let ref=String(receipt?.payment_reference||'').trim();
    const method=inferMethod(receipt);
    if(ref.toLowerCase().startsWith(method.toLowerCase()+' - '))ref=ref.slice(method.length+3).trim();
    if(ref.toLowerCase()===method.toLowerCase())ref='';
    return ref;
  }

  function referenceRule(method){
    if(method==='Bank Transfer')return {label:'Transaction / Reference No.',placeholder:'Optional bank transaction/reference'};
    if(method==='Card')return {label:'Card / Terminal Reference',placeholder:'Optional card or terminal reference'};
    if(method==='Cheque')return {label:'Cheque No. / Reference',placeholder:'Optional cheque number or reference'};
    return {label:'Reference / Note',placeholder:'Optional cash reference or note'};
  }

  function syncReferenceField(){
    const method=document.getElementById('quoPayMethod')?.value||'Bank Transfer';
    const input=document.getElementById('quoPayReference');
    const label=document.getElementById('quoPayReferenceLabel');
    if(!input||!label)return;
    const rule=referenceRule(method);
    label.textContent=rule.label;
    input.placeholder=rule.placeholder;
    input.required=false;
    input.setAttribute('aria-required','false');
  }

  function ensurePaymentModal(){
    const old=document.getElementById('quoPaymentModal');
    if(old)old.remove();
    const wrap=document.createElement('div');
    wrap.id='quoPaymentModal';wrap.className='modal hidden quo-payment-modal';wrap.setAttribute('role','dialog');wrap.setAttribute('aria-modal','true');
    wrap.innerHTML=`<div class="modal-card quo-payment-card">
      <div class="modal-head"><div><div class="eyebrow">INVOICE PAYMENT</div><h2>Record Payment</h2></div><button class="icon-btn" type="button" data-payment-close>×</button></div>
      <div class="quo-payment-summary"><div><span>Invoice</span><b id="quoPayInvoice">-</b></div><div><span>Total</span><b id="quoPayTotal">MVR 0.00</b></div><div><span>Already Paid</span><b id="quoPayPaid">MVR 0.00</b></div><div class="balance"><span>Balance Due</span><b id="quoPayBalance">MVR 0.00</b></div></div>
      <div class="form-grid two quo-payment-fields">
        <div class="field"><label>Amount Received</label><input id="quoPayAmount" type="number" min="0.01" step="0.01"></div>
        <div class="field"><label>Payment Date</label><input id="quoPayDate" type="date"></div>
        <div class="field"><label>Paid By</label><select id="quoPayMethod"><option>Bank Transfer</option><option>Cash</option><option>Card</option><option>Cheque</option></select></div>
        <div class="field"><label id="quoPayReferenceLabel">Transaction / Reference No.</label><input id="quoPayReference" placeholder="Optional reference"></div>
      </div>
      <div class="quo-payment-method-note"><b>Reference number is optional.</b> Use it when you have a bank transaction ID, card slip, cheque number or another useful reference.</div>
      <div class="quo-payment-error hidden" id="quoPayError"></div>
      <div class="quo-payment-actions"><button class="btn" type="button" data-payment-close>Cancel</button><button class="btn primary" type="button" id="quoPayConfirm">Record Payment & Create Receipt</button></div>
    </div>`;
    document.body.appendChild(wrap);
    wrap.querySelectorAll('[data-payment-close]').forEach(b=>b.onclick=closePaymentModal);
    wrap.addEventListener('click',e=>{if(e.target===wrap)closePaymentModal()});
    document.getElementById('quoPayMethod').onchange=syncReferenceField;
    document.getElementById('quoPayConfirm').onclick=submitPayment;
    syncReferenceField();
  }

  let paymentInvoiceId=null;

  async function beginRecordPayment(invoiceId){
    if(!S.current||S.current.id!==invoiceId)return;
    if(S.editorDirty){const ok=await saveCurrent(false);if(!ok)return;invoiceId=S.current.id;}
    openPaymentModal(invoiceId);
  }

  function openPaymentModal(invoiceId){
    if(!document.getElementById('quoPaymentModal'))ensurePaymentModal();
    const invoice=(S.docs||[]).find(d=>d.id===invoiceId)||(S.current?.id===invoiceId?S.current:null);if(!invoice||invoice.document_type!=='invoice')return;
    const c=calc(invoice);if(c.balance<=EPS){toast(`${invoice.document_number} is already paid`);return;}
    paymentInvoiceId=invoice.id;
    document.getElementById('quoPayInvoice').textContent=invoice.document_number;
    document.getElementById('quoPayTotal').textContent=money(c.total,invoice.currency);
    document.getElementById('quoPayPaid').textContent=money(c.paid,invoice.currency);
    document.getElementById('quoPayBalance').textContent=money(c.balance,invoice.currency);
    document.getElementById('quoPayAmount').value=c.balance.toFixed(2);
    document.getElementById('quoPayAmount').max=c.balance.toFixed(2);
    document.getElementById('quoPayDate').value=maleToday();
    document.getElementById('quoPayMethod').value='Bank Transfer';
    document.getElementById('quoPayReference').value='';
    syncReferenceField();
    document.getElementById('quoPayError').classList.add('hidden');
    document.getElementById('quoPayError').textContent='';
    document.getElementById('quoPaymentModal').classList.remove('hidden');
    setTimeout(()=>document.getElementById('quoPayAmount')?.select(),20);
  }

  function closePaymentModal(){document.getElementById('quoPaymentModal')?.classList.add('hidden');paymentInvoiceId=null;}
  function paymentError(msg){const el=document.getElementById('quoPayError');if(el){el.textContent=msg;el.classList.remove('hidden')}}

  async function submitPayment(){
    const invoice=(S.docs||[]).find(d=>d.id===paymentInvoiceId)||(S.current?.id===paymentInvoiceId?S.current:null);if(!invoice)return paymentError('Invoice could not be found.');
    const c=calc(invoice);
    const amount=num(document.getElementById('quoPayAmount')?.value);
    const date=document.getElementById('quoPayDate')?.value||'';
    const method=document.getElementById('quoPayMethod')?.value||'Bank Transfer';
    const reference=String(document.getElementById('quoPayReference')?.value||'').trim();
    if(amount<=0)return paymentError('Enter an amount greater than 0.');
    if(amount>c.balance+EPS)return paymentError(`Payment cannot exceed the balance of ${money(c.balance,invoice.currency)}.`);
    if(!date)return paymentError('Select the payment date.');
    if(!METHODS.includes(method))return paymentError('Select Bank Transfer, Cash, Card or Cheque.');
    const btn=document.getElementById('quoPayConfirm');btn.disabled=true;btn.textContent='Recording...';
    try{
      const r=await sb.rpc('quo_record_invoice_payment',{p_invoice_id:invoice.id,p_amount:amount,p_payment_date:date,p_method:method,p_reference:reference||null,p_actor:'White Saffron'});
      if(r.error)throw r.error;
      const result=r.data||{},updatedInvoice=result.invoice,receipt=result.receipt;
      await refreshDocs();
      if(S.current?.id===invoice.id&&updatedInvoice)S.current={...S.current,...updatedInvoice};
      closePaymentModal();S.editorDirty=false;render();
      toast(`${money(amount,invoice.currency)} recorded by ${method}${reference?` · ${reference}`:''}`);
    }catch(e){console.error(e);paymentError('Payment could not be recorded: '+(e?.message||'Unknown error'));}
    finally{btn.disabled=false;btn.textContent='Record Payment & Create Receipt';}
  }

  function paymentHistoryHTML(receipts,currency){
    if(!receipts.length)return '';
    return `<section class="quo-payment-history"><div class="quo-payment-history-head"><b>Payment History</b><span>${receipts.length} payment${receipts.length===1?'':'s'}</span></div>${receipts.map(r=>{
      const amount=calc(r).total;
      const method=inferMethod(r),ref=cleanReference(r);
      return `<button type="button" class="quo-payment-history-row" data-payment-receipt="${esc(r.id)}"><span><b>${esc(method)}</b><small>${esc(dateLong(r.creation_date)||'')}</small></span><span>${ref?`Ref: ${esc(ref)}`:'No reference'}</span><strong>${esc(money(amount,currency))}</strong><em>View receipt</em></button>`;
    }).join('')}</section>`;
  }

  function enhanceInvoicePaymentUI(){
    if(S.view!=='editor'||!S.current||S.current.document_type!=='invoice')return;
    const d=S.current,c=calc(d),actions=document.querySelector('.editor-actions'),state=document.querySelector('.editor-save-state');
    const payStatus=d.payment_status||(c.balance<=EPS?'Paid':c.paid>EPS?'Part Paid':'Unpaid');
    const receipts=linkedReceipts(d.id);
    if(state&&!document.querySelector('.quo-invoice-payment-state')){
      const methods=[...new Set(receipts.map(inferMethod).filter(Boolean))];
      state.insertAdjacentHTML('afterend',`<div class="quo-invoice-payment-state"><span>Payment <b>${esc(payStatus)}</b></span><span>Paid <b>${esc(money(c.paid,d.currency))}</b></span><span>Balance <b>${esc(money(c.balance,d.currency))}</b></span>${methods.length?`<span>Paid By <b>${esc(methods.join(', '))}</b></span>`:''}</div>`);
    }
    const main=document.querySelector('.editor-main');
    if(main&&receipts.length&&!main.querySelector('.quo-payment-history'))main.insertAdjacentHTML('beforeend',paymentHistoryHTML(receipts,d.currency));
    document.querySelectorAll('[data-payment-receipt]').forEach(b=>b.onclick=e=>{e.preventDefault();const rec=S.docs.find(x=>x.id===b.dataset.paymentReceipt);if(rec)openEditor(rec)});

    if(actions&&d.id&&d.status!=='Cancelled'){
      if(c.balance>EPS&&!actions.querySelector('[data-record-payment]')){
        const more=actions.querySelector('.editor-more'),b=document.createElement('button');
        b.type='button';b.className='btn quo-record-payment';b.dataset.recordPayment=d.id;b.textContent='Record Payment';
        if(more)more.insertAdjacentElement('beforebegin',b);else actions.appendChild(b);
        b.onclick=()=>beginRecordPayment(d.id);
      }
      if(c.balance<=EPS&&!actions.querySelector('.quo-paid-indicator')){
        const more=actions.querySelector('.editor-more'),paid=document.createElement('span');paid.className='quo-paid-indicator';paid.textContent='PAID';
        if(more)more.insertAdjacentElement('beforebegin',paid);else actions.appendChild(paid);
      }
      const moreMenu=actions.querySelector('.editor-more-menu');
      if(receipts.length&&moreMenu&&!moreMenu.querySelector('[data-open-payment-receipt]')){
        const rb=document.createElement('button');rb.type='button';rb.className='btn';rb.dataset.openPaymentReceipt=receipts[0].id;
        rb.textContent=receipts.length>1?`Open Latest Receipt (${receipts.length})`:'Open Receipt';moreMenu.appendChild(rb);
        rb.onclick=e=>{e.preventDefault();const rec=S.docs.find(x=>x.id===rb.dataset.openPaymentReceipt);if(rec)openEditor(rec)};
      }
    }
  }

  const previousBind=bindDynamic;
  bindDynamic=function(){const result=previousBind.apply(this,arguments);enhanceInvoicePaymentUI();return result;};

  ensurePaymentModal();
  if(!document.getElementById('quoPaymentsV86Style')){
    document.getElementById('quoPaymentsV43Style')?.remove();
    const st=document.createElement('style');st.id='quoPaymentsV86Style';st.textContent=`
      .quo-record-payment{border-color:#b8d6c6!important;background:#f1f8f4!important;color:#276446!important;font-weight:700!important}.quo-paid-indicator{display:inline-flex;align-items:center;min-height:36px;padding:0 12px;border:2px solid #4b8a68;border-radius:7px;background:#edf7f1;color:#286244;font-size:11px;font-weight:900;letter-spacing:.06em}.quo-invoice-payment-state{display:flex;gap:10px;margin-top:5px;font-size:9px;color:#78817e;flex-wrap:wrap}.quo-invoice-payment-state b{color:#34403c}.quo-payment-modal{z-index:2147483601}.quo-payment-card{width:min(620px,calc(100vw - 28px))!important}.quo-payment-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:14px 0;padding:10px;border:1px solid #e2e7e5;border-radius:9px;background:#fafbfb}.quo-payment-summary>div{padding:6px 8px}.quo-payment-summary span{display:block;font-size:8px;text-transform:uppercase;color:#7c8582}.quo-payment-summary b{display:block;margin-top:4px;font-size:12px}.quo-payment-summary .balance b{color:#276446}.quo-payment-method-note{margin-top:8px;padding:8px 10px;border-radius:7px;background:#f7f9f8;font-size:9px;color:#78817e}.quo-payment-method-note b{color:#44514d}.quo-payment-error{margin-top:10px;padding:9px 11px;border:1px solid #efc9c6;border-radius:7px;background:#fff3f2;color:#9c3f38;font-size:10px}.quo-payment-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px;padding-top:12px;border-top:1px solid #e6e9e8}.quo-payment-history{margin-top:12px;border:1px solid #dfe6e3;border-radius:10px;background:#fff;overflow:hidden}.quo-payment-history-head{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:#f7f9f8;border-bottom:1px solid #e8ecea}.quo-payment-history-head b{font-size:11px}.quo-payment-history-head span{font-size:8px;color:#7a8581}.quo-payment-history-row{width:100%;display:grid;grid-template-columns:minmax(130px,1fr) minmax(120px,1fr) 120px 72px;align-items:center;gap:10px;padding:10px 12px;border:0;border-bottom:1px solid #edf0ef;background:#fff;text-align:left;cursor:pointer}.quo-payment-history-row:last-child{border-bottom:0}.quo-payment-history-row:hover{background:#fafcfb}.quo-payment-history-row span b{display:block;font-size:9px;color:#2d3d38}.quo-payment-history-row small,.quo-payment-history-row>span:nth-child(2){font-size:8px;color:#7e8884}.quo-payment-history-row strong{text-align:right;font-size:9px;color:#2c4f46}.quo-payment-history-row em{text-align:right;font-style:normal;font-size:8px;font-weight:800;color:#2e6b5c}
      @media(max-width:620px){.quo-payment-summary{grid-template-columns:1fr 1fr}.quo-payment-fields{grid-template-columns:1fr!important}.quo-payment-actions{flex-direction:column-reverse}.quo-payment-actions .btn{width:100%}.quo-payment-history-row{grid-template-columns:1fr auto}.quo-payment-history-row>span:nth-child(2),.quo-payment-history-row em{grid-column:1/-1;text-align:left}.quo-payment-history-row strong{grid-column:2;grid-row:1;text-align:right}}
    `;document.head.appendChild(st);
  }
})();
