/* Quo v62 - existing customer picker with name/mobile matching. */
(function(){
  function clean(value){return String(value||'').trim()}
  function normName(value){return clean(value).toLowerCase().replace(/\s+/g,' ')}
  function normPhone(value){
    let digits=clean(value).replace(/\D/g,'');
    if(digits.length===10&&digits.startsWith('960'))digits=digits.slice(3);
    return digits;
  }

  function customerRows(){
    const docs=(typeof S!=='undefined'&&Array.isArray(S.docs)?S.docs:[])
      .filter(d=>!d.deleted_at&&clean(d.customer_name))
      .sort((a,b)=>String(b.updated_at||b.created_at||'').localeCompare(String(a.updated_at||a.created_at||'')));
    const map=new Map();
    for(const d of docs){
      const phone=normPhone(d.customer_phone);
      const name=normName(d.customer_name);
      const key=phone?`p:${phone}`:`n:${name}`;
      if(!map.has(key))map.set(key,{name:clean(d.customer_name),phone:clean(d.customer_phone),address:clean(d.customer_address),updated_at:d.updated_at||d.created_at||'',count:1});
      else{
        const row=map.get(key);row.count++;
        if(!row.phone&&clean(d.customer_phone))row.phone=clean(d.customer_phone);
        if(!row.address&&clean(d.customer_address))row.address=clean(d.customer_address);
      }
    }
    return [...map.values()];
  }

  function customerMatches(row,query){
    const q=clean(query).toLowerCase();
    if(!q)return true;
    const digits=normPhone(q);
    const name=normName(q);
    return normName(row.name).includes(name)||clean(row.address).toLowerCase().includes(q)||(digits&&normPhone(row.phone).includes(digits));
  }

  function exactPhoneCustomer(value){
    const phone=normPhone(value);if(!phone)return null;
    return customerRows().find(row=>normPhone(row.phone)===phone)||null;
  }

  function setDirty(){
    if(typeof S!=='undefined')S.editorDirty=true;
    try{if(typeof updateEditorSaveState==='function')updateEditorSaveState()}catch(e){}
  }

  function useCustomer(row){
    if(!row||typeof S==='undefined'||!S.current)return;
    const name=document.querySelector('[data-field="customer_name"]');
    const phone=document.querySelector('[data-field="customer_phone"]');
    const address=document.querySelector('[data-field="customer_address"]');
    if(name)name.value=row.name||'';
    if(phone)phone.value=row.phone||'';
    if(address)address.value=row.address||'';
    S.current.customer_name=row.name||'';
    S.current.customer_phone=row.phone||'';
    S.current.customer_address=row.address||'';
    setDirty();
    const search=document.querySelector('[data-customer-search]');
    if(search)search.value=row.name||row.phone||'';
    renderResults(search?.value||'',false);
    try{window.quoRefreshLivePreview?.()}catch(e){}
    try{toast?.(`${row.name} selected`)}catch(e){}
  }

  function resultHTML(rows){
    if(!rows.length)return '<div class="quo-customer-empty">No existing customer match.</div>';
    return rows.slice(0,6).map((row,i)=>`<button type="button" class="quo-customer-result" data-customer-pick="${i}"><span><b>${esc(row.name)}</b>${row.phone?`<small>${esc(row.phone)}</small>`:''}</span>${row.address?`<em>${esc(row.address)}</em>`:''}</button>`).join('');
  }

  let visibleRows=[];
  function renderResults(query,open=true){
    const box=document.querySelector('[data-customer-results]');if(!box)return;
    const q=clean(query);
    visibleRows=customerRows().filter(row=>customerMatches(row,q)).slice(0,6);
    if(!open||!q){box.hidden=true;box.innerHTML='';return;}
    box.innerHTML=resultHTML(visibleRows);box.hidden=false;
    box.querySelectorAll('[data-customer-pick]').forEach(btn=>btn.onclick=e=>{
      e.preventDefault();e.stopPropagation();
      useCustomer(visibleRows[Number(btn.dataset.customerPick)]);
    });
  }

  function refreshExactPhoneHint(){
    const phone=document.querySelector('[data-field="customer_phone"]');
    const hint=document.querySelector('[data-customer-phone-match]');
    if(!phone||!hint)return;
    const row=exactPhoneCustomer(phone.value);
    const same=row&&normName(row.name)===normName(document.querySelector('[data-field="customer_name"]')?.value);
    if(!row||same){hint.hidden=true;hint.innerHTML='';return;}
    hint.hidden=false;
    hint.innerHTML=`Existing customer found: <b>${esc(row.name)}</b> <button type="button" data-use-phone-match>Use details</button>`;
    hint.querySelector('[data-use-phone-match]').onclick=e=>{e.preventDefault();useCustomer(row)};
  }

  function install(){
    if(typeof S==='undefined'||S.view!=='editor'||!S.current)return;
    const name=document.querySelector('[data-field="customer_name"]');
    const phone=document.querySelector('[data-field="customer_phone"]');
    if(!name||!phone)return;
    const card=name.closest('.editor-card');
    const body=card?.querySelector('.card-body');
    if(!body)return;

    let picker=body.querySelector('.quo-customer-picker');
    if(!picker){
      picker=document.createElement('div');picker.className='quo-customer-picker';
      picker.innerHTML=`<label>Existing Customer</label><div class="quo-customer-search-wrap"><input type="search" autocomplete="off" data-customer-search placeholder="Search by customer name or mobile"><span class="quo-customer-search-icon">⌕</span><div class="quo-customer-results" data-customer-results hidden></div></div><div class="quo-customer-phone-match" data-customer-phone-match hidden></div>`;
      body.prepend(picker);
    }

    const search=picker.querySelector('[data-customer-search]');
    search.oninput=()=>renderResults(search.value,true);
    search.onfocus=()=>{if(clean(search.value))renderResults(search.value,true)};
    search.onkeydown=e=>{if(e.key==='Escape')renderResults('',false)};
    phone.addEventListener('input',refreshExactPhoneHint);
    phone.addEventListener('change',refreshExactPhoneHint);
    name.addEventListener('input',refreshExactPhoneHint);
    refreshExactPhoneHint();
  }

  document.addEventListener('click',e=>{
    const picker=document.querySelector('.quo-customer-picker');
    if(picker&&!picker.contains(e.target))renderResults('',false);
  });

  try{
    const previousBind=bindDynamic;
    bindDynamic=function(){const result=previousBind.apply(this,arguments);install();return result};
  }catch(e){}

  if(!document.getElementById('quoCustomerPickerV62Style')){
    const st=document.createElement('style');st.id='quoCustomerPickerV62Style';st.textContent=`
      .quo-customer-picker{margin:0 0 12px;padding:10px 11px;border:1px solid #dfe7e4;border-radius:9px;background:#f8faf9;position:relative;z-index:20}
      .quo-customer-picker>label{display:block;margin-bottom:6px;font-size:8px;font-weight:850;letter-spacing:.08em;text-transform:uppercase;color:#66746f}
      .quo-customer-search-wrap{position:relative}.quo-customer-search-wrap>input{width:100%;min-height:38px;padding:8px 34px 8px 10px;border:1px solid #cfd9d5;border-radius:7px;background:#fff;font:inherit;color:#26332f;box-sizing:border-box}.quo-customer-search-wrap>input:focus{outline:2px solid #b8d4cc;outline-offset:1px;border-color:#7da79c}.quo-customer-search-icon{position:absolute;right:11px;top:9px;color:#73817c;pointer-events:none}
      .quo-customer-results{position:absolute;left:0;right:0;top:43px;z-index:1200;padding:5px;border:1px solid #d6dfdc;border-radius:8px;background:#fff;box-shadow:0 14px 34px rgba(26,43,38,.14);max-height:276px;overflow:auto}.quo-customer-result{display:flex;width:100%;align-items:center;justify-content:space-between;gap:12px;padding:9px 10px;border:0;border-bottom:1px solid #edf0ef;background:#fff;text-align:left;cursor:pointer}.quo-customer-result:last-child{border-bottom:0}.quo-customer-result:hover,.quo-customer-result:focus-visible{background:#f3f8f6;outline:none}.quo-customer-result span{min-width:0}.quo-customer-result b{display:block;font-size:10px;color:#25332f}.quo-customer-result small{display:block;margin-top:2px;font-size:8px;color:#61706b}.quo-customer-result em{max-width:48%;font-style:normal;font-size:8px;line-height:1.3;text-align:right;color:#7a8581}.quo-customer-empty{padding:10px;font-size:9px;color:#7b8582}
      .quo-customer-phone-match{margin-top:7px;padding:7px 8px;border-radius:6px;background:#eef6f3;color:#49645c;font-size:8.5px}.quo-customer-phone-match button{margin-left:5px;padding:2px 5px;border:0;background:transparent;color:#2e6d60;font-weight:850;cursor:pointer;text-decoration:underline}
      @media(max-width:620px){.quo-customer-picker{margin-bottom:10px}.quo-customer-result{align-items:flex-start;flex-direction:column;gap:4px;padding:10px}.quo-customer-result em{max-width:none;text-align:left}.quo-customer-results{max-height:230px}}
    `;document.head.appendChild(st);
  }
})();
