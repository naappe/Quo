/* Quo v78 - guard against guest-count / per-pax billing mismatches. */
(function(){
  const EPS=0.005;

  function normaliseUnit(value){
    return String(value||'').trim().toLowerCase();
  }

  function perPaxRows(d){
    return (d?.items||[])
      .map((item,index)=>({item,index}))
      .filter(row=>String(row.item?.description||'').trim())
      .filter(row=>['pax','person','persons','guest','guests'].includes(normaliseUnit(row.item?.unit)));
  }

  function mismatch(){
    if(typeof readEditor==='function')readEditor();
    const d=S?.current;
    if(!d||!d.service_enabled)return null;
    const guests=num(d.service_pax);
    if(!(guests>0))return null;
    const rows=perPaxRows(d);
    if(rows.length!==1)return null;
    const row=rows[0];
    const qty=num(row.item.qty);
    if(Math.abs(qty-guests)<=EPS)return null;
    return {d,guests,qty,index:row.index,item:row.item};
  }

  function focusQty(index){
    const input=document.querySelector(`[data-item="${index}"] [data-item-field="qty"]`);
    if(input){input.focus();input.select?.();}
  }

  function setPaxQty(m){
    m.d.items[m.index].qty=m.guests;
    const input=document.querySelector(`[data-item="${m.index}"] [data-item-field="qty"]`);
    if(input)input.value=String(m.guests);
    S.editorDirty=true;
  }

  function resolveMismatch(action){
    const m=mismatch();
    if(!m)return true;
    const description=String(m.item.description||'Per Pax item').trim();
    const useGuestCount=confirm(
      `Guest count is ${m.guests.toLocaleString()} Pax, but "${description}" is billed for ${m.qty.toLocaleString()} Pax.\n\n`+
      `Use ${m.guests.toLocaleString()} Pax for this line before ${action}?`
    );
    if(useGuestCount){
      setPaxQty(m);
      return true;
    }
    alert('Guests and the single Per Pax quantity do not match. Update either Guests or Qty before continuing.');
    focusQty(m.index);
    return false;
  }

  if(typeof saveCurrent==='function'){
    const previousSaveCurrent=saveCurrent;
    saveCurrent=async function(showToast=true){
      if(!resolveMismatch('saving'))return false;
      return previousSaveCurrent(showToast);
    };
  }

  if(typeof convertCurrent==='function'){
    const previousConvertCurrent=convertCurrent;
    convertCurrent=function(type){
      if(!resolveMismatch('converting'))return;
      return previousConvertCurrent(type);
    };
  }

  if(typeof openFullPreview==='function'){
    const previousOpenFullPreview=openFullPreview;
    openFullPreview=function(){
      const m=mismatch();
      if(m){
        alert(`Guest count is ${m.guests.toLocaleString()} Pax, but the Per Pax line is ${m.qty.toLocaleString()} Pax. Correct the mismatch before previewing the final PDF.`);
        focusQty(m.index);
        return;
      }
      return previousOpenFullPreview();
    };
  }
})();
