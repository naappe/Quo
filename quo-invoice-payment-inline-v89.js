/* Quo v89 - invoice payment is completed inline from the Document card. No observers. */
(function(){
  if(typeof S==='undefined') return;
  const EPS=0.005;
  const METHODS=['Bank Transfer','Cash','Card','Cheque'];

  function maleToday(){
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Indian/Maldives',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    const get=t=>parts.find(p=>p.type===t)?.value||'';
    return `${get('year')}-${get('month')}-${get('day')}`;
  }

  function receiptsFor(invoiceId){
    return (S.docs||[]).filter(d=>d.document_type==='receipt'&&d.source_document_id===invoiceId&&!d.deleted_at&&d.status!=='Cancelled')
      .sort((a,b)=>String(b.creation_date||b.created_at||b.updated_at||'').localeCompare(String(a.creation_date||a.created_at||a.updated_at||'')));
  }

  function paymentState(d){
    const c=calc(d);
    if(c.balance<=EPS) return 'Paid';
    if(c.paid>EPS) return 'Part Paid';
    return 'Unpaid';
  }

  function latestPayment(d){
    const r=receiptsFor(d.id)[0];
    return {
      method: METHODS.includes(String(r?.payment_method||''))?r.payment_method:'Bank Transfer',
      reference:String(r?.payment_reference||''),
      date:r?.creation_date||maleToday()
    };
  }

  function setPaymentBadges(state){
    document.querySelectorAll('.doc-title-row .badge,.preview-toolbar .badge').forEach(b=>{
      b.textContent=state;
      b.classList.toggle('q89-paid-badge',state==='Paid');
      b.classList.toggle('q89-part-badge',state==='Part Paid');
      b.classList.toggle('q89-unpaid-badge',state==='Unpaid');
    });
  }

  function markDirty(){
    try{markEditorDirty()}catch(e){S.editorDirty=true}
  }

  function installInlinePayment(){
    if(S.view!=='editor'||!S.current||S.current.document_type!=='invoice') return;
    const d=S.current;
    const c=calc(d);
    const state=paymentState(d);
    const statusSelect=document.querySelector('select[data-field="status"]');
    if(!statusSelect) return;
    const field=statusSelect.closest('.field');
    if(!field) return;

    // The original document status stays internal. Do not let readEditor() overwrite it.
    statusSelect.removeAttribute('data-field');
    statusSelect.id='quoInvoicePaymentStatus';
    field.querySelector('label').textContent='Payment Status';
    statusSelect.innerHTML=`
      <option value="Unpaid" ${state==='Unpaid'?'selected':''}>Unpaid</option>
      ${state==='Part Paid'?'<option value="Part Paid" selected disabled>Part Paid</option>':''}
      <option value="Paid" ${state==='Paid'?'selected':''}>Paid</option>`;
    if(state==='Paid') statusSelect.disabled=true;

    const card=field.closest('.editor-card');
    const grid=field.closest('.editor-details-grid');
    if(card&&grid&&!card.querySelector('#quoInlinePaymentDetails')){
      const last=latestPayment(d);
      const details=document.createElement('div');
      details.id='quoInlinePaymentDetails';
      details.className='q89-payment-details';
      details.innerHTML=`
        <div class="field"><label>Paid By</label><select id="quoInlinePaidBy">${METHODS.map(m=>`<option ${m===last.method?'selected':''}>${m}</option>`).join('')}</select></div>
        <div class="field"><label>Payment Date</label><input id="quoInlinePaymentDate" type="date" value="${last.date}"></div>
        <div class="field q89-ref"><label>Reference No. <span>Optional</span></label><input id="quoInlinePaymentRef" value="${esc(last.reference)}" placeholder="Optional reference"></div>
        <div class="q89-payment-summary"><span>Invoice Total <b>${esc(money(c.total,d.currency))}</b></span><span>Already Paid <b>${esc(money(c.paid,d.currency))}</b></span><span>Balance <b>${esc(money(c.balance,d.currency))}</b></span></div>`;
      grid.insertAdjacentElement('afterend',details);
    }

    const details=document.getElementById('quoInlinePaymentDetails');
    if(details) details.classList.toggle('hidden',state==='Unpaid');

    statusSelect.onchange=()=>{
      if(paymentState(S.current)==='Paid'){
        statusSelect.value='Paid';
        return;
      }
      const wantsPaid=statusSelect.value==='Paid';
      details?.classList.toggle('hidden',!wantsPaid);
      if(wantsPaid){
        const date=document.getElementById('quoInlinePaymentDate');
        if(date&&!date.value) date.value=maleToday();
        document.querySelector('[data-save]')?.setAttribute('data-q89-payment','1');
        const save=document.querySelector('[data-save]');
        if(save) save.textContent='Save & Mark Paid';
      }else{
        const save=document.querySelector('[data-save]');
        if(save){save.removeAttribute('data-q89-payment');save.textContent=S.current.id?'Save Changes':'Save & Number'}
      }
      markDirty();
    };

    ['quoInlinePaidBy','quoInlinePaymentDate','quoInlinePaymentRef'].forEach(id=>{
      const el=document.getElementById(id);
      if(el){el.oninput=markDirty;el.onchange=markDirty}
    });

    // The invoice now has one primary payment path. Keep the old modal out of the main editor.
    document.querySelectorAll('.quo-record-payment').forEach(b=>b.style.display='none');
    document.querySelectorAll('.editor-card h3').forEach(h=>{
      if(h.textContent.trim()==='Payment'&&h.closest('.optional-card')) h.closest('.optional-card').style.display='none';
    });

    setPaymentBadges(state);
  }

  const previousSave=saveCurrent;
  saveCurrent=async function(showToast=true){
    const isInvoice=S.current?.document_type==='invoice';
    let wantsPaid=false,method='Bank Transfer',date=maleToday(),reference='';
    if(isInvoice){
      const paymentSelect=document.getElementById('quoInvoicePaymentStatus');
      wantsPaid=paymentSelect?.value==='Paid'&&paymentState(S.current)!=='Paid';
      if(wantsPaid){
        method=document.getElementById('quoInlinePaidBy')?.value||'Bank Transfer';
        date=document.getElementById('quoInlinePaymentDate')?.value||'';
        reference=String(document.getElementById('quoInlinePaymentRef')?.value||'').trim();
        if(!METHODS.includes(method)){alert('Select how the invoice was paid.');return false}
        if(!date){alert('Select the payment date.');return false}
      }
    }

    const saved=await previousSave(wantsPaid?false:showToast);
    if(!saved) return false;
    if(!wantsPaid) return true;

    try{
      const current=(S.docs||[]).find(x=>x.id===S.current.id)||S.current;
      const c=calc(current);
      if(c.balance<=EPS){
        if(showToast) toast(`${current.document_number} is paid`);
        return true;
      }
      const r=await sb.rpc('quo_record_invoice_payment',{
        p_invoice_id:current.id,
        p_amount:Number(c.balance.toFixed(2)),
        p_payment_date:date,
        p_method:method,
        p_reference:reference||null,
        p_actor:'White Saffron'
      });
      if(r.error) throw r.error;
      await refreshDocs();
      const fresh=(S.docs||[]).find(x=>x.id===current.id);
      if(fresh) S.current={...S.current,...fresh};
      S.editorDirty=false;
      render();
      if(showToast) toast(`${S.current.document_number} marked Paid · ${method}`);
      return true;
    }catch(e){
      console.error(e);
      alert('Invoice details were saved, but payment could not be recorded: '+(e?.message||'Unknown error'));
      return false;
    }
  };

  const previousBind=bindDynamic;
  bindDynamic=function(){
    const result=previousBind.apply(this,arguments);
    installInlinePayment();
    return result;
  };

  if(!document.getElementById('quoInvoiceInlineV89Style')){
    const st=document.createElement('style');
    st.id='quoInvoiceInlineV89Style';
    st.textContent=`
      .q89-payment-details{display:grid;grid-template-columns:1fr 1fr 1.25fr;gap:12px;margin-top:12px;padding:14px;border:1px solid #cfe0da;border-radius:10px;background:#f8fbfa}.q89-payment-details.hidden{display:none}.q89-payment-details label span{font-size:8px;font-weight:600;color:#8a9490;margin-left:4px}.q89-payment-summary{grid-column:1/-1;display:flex;gap:22px;padding-top:10px;border-top:1px solid #e1e9e6;font-size:9px;color:#6f7b77}.q89-payment-summary span{display:flex;gap:6px}.q89-payment-summary b{color:#283934}.q89-paid-badge{background:#e8f6ee!important;color:#21704b!important;border-color:#c6e5d3!important}.q89-part-badge{background:#fff6df!important;color:#8b641c!important;border-color:#ead9aa!important}.q89-unpaid-badge{background:#fff0ed!important;color:#a24c3c!important;border-color:#efc9c1!important}@media(max-width:820px){.q89-payment-details{grid-template-columns:1fr}.q89-payment-summary{grid-column:1;flex-direction:column;gap:5px}}`;
    document.head.appendChild(st);
  }

  installInlinePayment();
})();
