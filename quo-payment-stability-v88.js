/* Quo v88 - keep invoice payment UI invoice-first without DOM observers. */
(function(){
  function patchPaymentUI(){
    const btn=document.getElementById('quoPayConfirm');
    if(btn){
      if(btn.textContent!=='Recording...')btn.textContent='Record Payment';
      if(btn.dataset.q88Wrapped!=='1'&&typeof btn.onclick==='function'){
        const original=btn.onclick;
        btn.onclick=async function(e){
          try{
            const result=original.call(this,e);
            if(result&&typeof result.then==='function')await result;
            return result;
          }finally{
            if(document.body.contains(this)&&!this.disabled)this.textContent='Record Payment';
          }
        };
        btn.dataset.q88Wrapped='1';
      }
    }

    const note=document.querySelector('.quo-payment-method-note');
    if(note)note.innerHTML='<b>Reference number is optional.</b> The payment is recorded against this invoice. The customer can use the updated paid invoice; a payment record is kept automatically for audit history.';

    document.querySelectorAll('.quo-payment-history-row em').forEach(el=>el.textContent='View record');
    document.querySelectorAll('[data-open-payment-receipt]').forEach(el=>{
      el.textContent=String(el.textContent||'').replace(/Receipt/g,'Payment Record');
    });
  }

  try{
    const previousBind=bindDynamic;
    bindDynamic=function(){
      const result=previousBind.apply(this,arguments);
      patchPaymentUI();
      return result;
    };
  }catch(e){console.warn('Payment UI finalizer could not bind',e)}

  patchPaymentUI();
})();
