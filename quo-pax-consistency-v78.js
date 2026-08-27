/* Quo v85 - one authoritative controller for service inclusion, guest count and Pax billing. */
(function(){
  const PAX_UNITS=new Set(['pax','person','persons','guest','guests']);

  function isPax(value){return PAX_UNITS.has(String(value||'').trim().toLowerCase())}
  function current(){return typeof S!=='undefined'&&S.view==='editor'?S.current:null}

  function paxRows(d){
    return (d?.items||[]).map((item,index)=>({item,index})).filter(({item})=>isPax(item?.unit));
  }

  function syncPaxRows(d,guests){
    if(!d||!d.service_enabled)return;
    paxRows(d).forEach(({item,index})=>{
      item.qty=guests;
      const qty=document.querySelector(`[data-item="${index}"] [data-item-field="qty"]`);
      if(qty&&qty.value!==String(guests))qty.value=String(guests);
    });
  }

  function markChanged(){
    if(typeof S!=='undefined')S.editorDirty=true;
    if(typeof updateEditorSaveState==='function')updateEditorSaveState();
  }

  function refreshSoft(){
    try{
      if(typeof renderEditorSoft==='function')renderEditorSoft();
      else if(typeof window.quoRefreshLivePreview==='function')window.quoRefreshLivePreview();
    }catch(e){console.warn('Service preview refresh failed',e)}
  }

  function toggleServiceArea(enabled){
    const area=document.getElementById('eventFields');
    if(area)area.classList.toggle('hidden',!enabled);
  }

  function bindServiceControls(){
    const d=current();if(!d)return;

    const include=document.querySelector('[data-field="service_enabled"]');
    if(include){
      const handle=()=>{
        d.service_enabled=!!include.checked;
        toggleServiceArea(d.service_enabled);
        if(d.service_enabled)syncPaxRows(d,num(d.service_pax));
        markChanged();
        refreshSoft();
      };
      /* Replace the generic handlers so this checkbox does not rebuild the whole editor. */
      include.oninput=handle;
      include.onchange=handle;
    }

    const guests=document.querySelector('[data-field="service_pax"]');
    if(guests){
      const handle=()=>{
        const value=Math.max(0,num(guests.value));
        d.service_pax=value;
        syncPaxRows(d,value);
        markChanged();
        refreshSoft();
      };
      guests.oninput=handle;
      guests.onchange=handle;
    }

    document.querySelectorAll('[data-item-field="unit"]').forEach(unit=>{
      const originalInput=unit.oninput;
      unit.oninput=function(e){
        if(typeof originalInput==='function')originalInput.call(this,e);
        const d2=current();if(!d2||!d2.service_enabled||!isPax(this.value))return;
        const row=this.closest('[data-item]'),index=Number(row?.dataset?.item);
        if(!Number.isInteger(index)||!d2.items?.[index])return;
        d2.items[index].unit=this.value;
        d2.items[index].qty=Math.max(0,num(d2.service_pax));
        const qty=row.querySelector('[data-item-field="qty"]');if(qty)qty.value=String(d2.items[index].qty);
        markChanged();refreshSoft();
      };
    });
  }

  /* Bind after the normal editor bindings. Later Quo layers can still wrap bindDynamic safely. */
  try{
    const previousBind=bindDynamic;
    bindDynamic=function(){
      const result=previousBind.apply(this,arguments);
      bindServiceControls();
      return result;
    };
  }catch(e){console.warn('Service controls could not bind',e)}

  /* Before save/conversion, make the document model authoritative and keep every Pax row aligned. */
  if(typeof saveCurrent==='function'){
    const previousSave=saveCurrent;
    saveCurrent=async function(showToast=true){
      try{if(typeof readEditor==='function')readEditor()}catch(e){}
      const d=current();if(d&&d.service_enabled){d.service_pax=Math.max(0,num(d.service_pax));syncPaxRows(d,d.service_pax)}
      return previousSave(showToast);
    };
  }

  if(typeof convertCurrent==='function'){
    const previousConvert=convertCurrent;
    convertCurrent=function(type){
      try{if(typeof readEditor==='function')readEditor()}catch(e){}
      const d=current();if(d&&d.service_enabled){d.service_pax=Math.max(0,num(d.service_pax));syncPaxRows(d,d.service_pax)}
      return previousConvert(type);
    };
  }

  if(typeof openFullPreview==='function'){
    const previousPreview=openFullPreview;
    openFullPreview=function(){
      try{if(typeof readEditor==='function')readEditor()}catch(e){}
      const d=current();if(d&&d.service_enabled){d.service_pax=Math.max(0,num(d.service_pax));syncPaxRows(d,d.service_pax)}
      return previousPreview.apply(this,arguments);
    };
  }

  bindServiceControls();
})();