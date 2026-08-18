/* Quo v69 - finance note navigation wiring. */
(function(){
  if(typeof S==='undefined')return;
  window.QUO_FINANCE_NAV_VERSION='69';

  function openType(type){
    S.view='documents';
    S.filter=type;
    S.search='';
    if('customerFilter' in S)S.customerFilter=null;
    render();
    window.scrollTo(0,0);
  }

  function ensureButton(type,label){
    const nav=document.querySelector('.nav');if(!nav)return null;
    let btn=nav.querySelector(`[data-filter="${type}"]`);
    if(!btn){
      const receipt=nav.querySelector('[data-filter="receipt"]');if(!receipt)return null;
      btn=document.createElement('button');btn.dataset.view='documents';btn.dataset.filter=type;btn.innerHTML=`<span class="nav-dot"></span><span>${label}</span>`;
      const debit=nav.querySelector('[data-filter="debit_note"]');
      if(type==='credit_note'&&debit)debit.insertAdjacentElement('beforebegin',btn);else receipt.insertAdjacentElement('afterend',btn);
    }
    btn.onclick=e=>{e.preventDefault();e.stopPropagation();openType(type)};
    return btn;
  }

  function ensureChips(){
    if(S.view!=='documents')return;
    const chips=document.querySelector('.chips');if(!chips)return;
    [['credit_note','Credit Notes'],['debit_note','Debit Notes']].forEach(([type,label])=>{
      let b=chips.querySelector(`[data-q69-filter="${type}"]`);
      if(!b){b=document.createElement('button');b.type='button';b.className='chip';b.dataset.q69Filter=type;b.textContent=label;chips.appendChild(b)}
      b.classList.toggle('active',S.filter===type);
      b.onclick=e=>{e.preventDefault();openType(type)};
    });
  }

  function wire(){ensureButton('credit_note','Credit Notes');ensureButton('debit_note','Debit Notes');ensureChips()}
  try{const previousBind=bindDynamic;bindDynamic=function(){const result=previousBind.apply(this,arguments);wire();return result}}catch(e){}
  wire();
})();
