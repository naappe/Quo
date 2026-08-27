/* Quo v86 - surface stored payment methods on receipts, invoices and PDFs. */
(function(){
  const METHODS=['Bank Transfer','Cash','Card','Cheque'];
  const inferMethod=r=>{
    const saved=String(r?.payment_method||'').trim();
    if(METHODS.includes(saved))return saved;
    const ref=String(r?.payment_reference||'').trim().toLowerCase();
    const terms=String(r?.extra_terms||'').toLowerCase();
    return METHODS.find(m=>ref.startsWith(m.toLowerCase())||terms.includes(`method: ${m.toLowerCase()}`))||'Payment';
  };
  const cleanRef=r=>{
    let ref=String(r?.payment_reference||'').trim();
    const method=inferMethod(r);
    if(ref.toLowerCase().startsWith(method.toLowerCase()+' - '))ref=ref.slice(method.length+3).trim();
    if(ref.toLowerCase()===method.toLowerCase())return '';
    return ref;
  };
  const receiptsFor=id=>(S.docs||[]).filter(r=>r.document_type==='receipt'&&r.source_document_id===id&&!r.deleted_at&&r.status!=='Cancelled')
    .sort((a,b)=>String(a.creation_date||a.created_at||'').localeCompare(String(b.creation_date||b.created_at||'')));

  function enhanceReceiptEditor(){
    if(S.view!=='editor'||S.current?.document_type!=='receipt')return;
    const d=S.current;
    const card=[...document.querySelectorAll('.editor-card')].find(x=>/payment/i.test(x.querySelector('h3')?.textContent||''));
    const grid=card?.querySelector('.form-grid');
    if(!grid||grid.querySelector('[data-q86-payment-method]'))return;
    const method=document.createElement('div');method.className='field';method.dataset.q86PaymentMethod='';
    method.innerHTML=`<label>Paid By</label><input value="${esc(inferMethod(d))}" readonly>`;
    grid.prepend(method);
    const ref=grid.querySelector('[data-field="payment_reference"]');
    if(ref){
      ref.value=cleanRef(d);
      const label=ref.closest('.field')?.querySelector('label');if(label)label.textContent='Reference No. (Optional)';
    }
  }

  try{
    const previousBind=bindDynamic;
    bindDynamic=function(){const result=previousBind.apply(this,arguments);enhanceReceiptEditor();return result;};
  }catch(e){}

  try{
    const previousPrint=renderPrint;
    renderPrint=function(d){
      const result=previousPrint.apply(this,arguments);
      const root=document.getElementById('printRoot');
      if(!root||!d)return result;
      const page=root.querySelector('.pdf-page');if(!page)return result;
      const footer=page.querySelector('.pdf-footer');
      if(d.document_type==='receipt'){
        const ref=cleanRef(d),method=inferMethod(d);
        const box=document.createElement('section');box.className='q86-pdf-payment-record';
        box.innerHTML=`<div><span>Payment Method</span><b>${esc(method)}</b></div><div><span>Reference No.</span><b>${esc(ref||'—')}</b></div>`;
        footer?.insertAdjacentElement('beforebegin',box);
      }
      if(d.document_type==='invoice'){
        const rows=receiptsFor(d.id);
        if(rows.length){
          const box=document.createElement('section');box.className='q86-pdf-payment-history';
          box.innerHTML=`<h4>Payment Record</h4><div class="q86-payment-head"><span>Date</span><span>Paid By</span><span>Reference</span><span>Amount</span></div>${rows.map(r=>`<div class="q86-payment-row"><span>${esc(dateShort(r.creation_date)||'')}</span><span>${esc(inferMethod(r))}</span><span>${esc(cleanRef(r)||'—')}</span><b>${esc(money(calc(r).total,d.currency))}</b></div>`).join('')}`;
          footer?.insertAdjacentElement('beforebegin',box);
        }
      }
      return result;
    };
  }catch(e){}

  if(!document.getElementById('quoPaymentMethodV86Style')){
    const st=document.createElement('style');st.id='quoPaymentMethodV86Style';st.textContent=`
      .q86-pdf-payment-record{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0;padding:9px 10px;border:1px solid #dfe7e3;border-radius:6px;background:#f8faf9}.q86-pdf-payment-record span{display:block;font-size:7px;text-transform:uppercase;letter-spacing:.06em;color:#78837f}.q86-pdf-payment-record b{display:block;margin-top:3px;font-size:9px;color:#263a34}.q86-pdf-payment-history{margin:10px 0;border:1px solid #dfe7e3;border-radius:6px;overflow:hidden}.q86-pdf-payment-history h4{margin:0;padding:7px 9px;background:#f5f8f7;font-size:8px;color:#2d463f}.q86-payment-head,.q86-payment-row{display:grid;grid-template-columns:105px 1fr 1fr 120px;gap:8px;align-items:center;padding:6px 9px}.q86-payment-head{background:#fafbfb;border-top:1px solid #e6ece9;border-bottom:1px solid #e6ece9;font-size:6.5px;font-weight:800;text-transform:uppercase;color:#79837f}.q86-payment-row{border-bottom:1px solid #edf1ef;font-size:7.5px;color:#3c4945}.q86-payment-row:last-child{border-bottom:0}.q86-payment-row b{text-align:right;color:#23483e}
    `;document.head.appendChild(st);
  }

  enhanceReceiptEditor();
})();
