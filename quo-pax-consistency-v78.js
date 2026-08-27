/* Quo v79 - keep guest count, per-pax billing and previews in sync. */
(function(){
  const EPS=0.005;

  function normaliseUnit(value){
    return String(value||'').trim().toLowerCase();
  }

  function isPaxUnit(value){
    return ['pax','person','persons','guest','guests'].includes(normaliseUnit(value));
  }

  function perPaxRows(d){
    return (d?.items||[])
      .map((item,index)=>({item,index}))
      .filter(row=>String(row.item?.description||'').trim())
      .filter(row=>isPaxUnit(row.item?.unit));
  }

  function refreshEditorAmountsAndPreview(){
    try{
      if(typeof renderEditorSoft==='function')renderEditorSoft();
      else if(typeof window.quoRefreshLivePreview==='function')window.quoRefreshLivePreview();
    }catch(e){
      console.warn('Could not refresh Pax preview',e);
    }
  }

  function syncPaxRowsToGuests(guestValue){
    const d=S?.current;
    if(!d||!d.service_enabled)return false;
    const guests=num(guestValue);
    if(!(guests>=0))return false;

    let changed=false;
    perPaxRows(d).forEach(({item,index})=>{
      if(Math.abs(num(item.qty)-guests)<=EPS)return;
      item.qty=guests;
      const input=document.querySelector(`[data-item="${index}"] [data-item-field="qty"]`);
      if(input)input.value=String(guests);
      changed=true;
    });

    if(changed){
      S.editorDirty=true;
      refreshEditorAmountsAndPreview();
    }
    return changed;
  }

  // Other editor listeners also run while the user types. Queue one final pass after
  // they finish so a just-entered guest count cannot be overwritten by stale Qty DOM.
  let queuedGuestSync=false;
  function queuePaxSync(){
    if(queuedGuestSync)return;
    queuedGuestSync=true;
    requestAnimationFrame(()=>{
      queuedGuestSync=false;
      const field=document.querySelector('[data-field="service_pax"]');
      if(!field||!S?.current)return;
      const guests=num(field.value);
      S.current.service_pax=guests;
      if(syncPaxRowsToGuests(guests))refreshEditorAmountsAndPreview();
    });
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
    refreshEditorAmountsAndPreview();
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

  /* Changing Guests is authoritative for rows billed per Pax. */
  document.addEventListener('input',e=>{
    const field=e.target?.closest?.('[data-field="service_pax"]');
    if(!field||!S?.current)return;
    S.current.service_pax=num(field.value);
    syncPaxRowsToGuests(field.value);
    queuePaxSync();
  },true);

  document.addEventListener('change',e=>{
    const field=e.target?.closest?.('[data-field="service_pax"]');
    if(field&&S?.current){
      S.current.service_pax=num(field.value);
      syncPaxRowsToGuests(field.value);
      refreshEditorAmountsAndPreview();
      queuePaxSync();
      return;
    }

    /* If an item is changed to a Pax unit, initialise its Qty from Guests. */
    const unit=e.target?.closest?.('[data-item-field="unit"]');
    if(!unit||!isPaxUnit(unit.value)||!S?.current?.service_enabled)return;
    const row=unit.closest('[data-item]');
    const index=Number(row?.dataset?.item);
    if(!Number.isInteger(index)||!S.current.items?.[index])return;
    const guests=num(S.current.service_pax);
    if(!(guests>0))return;
    S.current.items[index].unit=unit.value;
    S.current.items[index].qty=guests;
    const qtyInput=row.querySelector('[data-item-field="qty"]');
    if(qtyInput)qtyInput.value=String(guests);
    S.editorDirty=true;
    refreshEditorAmountsAndPreview();
  },true);

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
