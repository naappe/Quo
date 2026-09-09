/* Quo v105 - always-visible alert for new customer quotation requests. */
(function(){
  if(typeof sb==='undefined')return;
  let previousCount=null;
  let timer=null;
  const baseTitle=document.title;

  function requestNav(){
    return document.querySelector('[data-q104-requests]');
  }

  function ensureTopAlert(){
    let el=document.getElementById('q105RfqAlert');
    if(el)return el;
    const actions=document.querySelector('.top-actions');
    if(!actions)return null;
    el=document.createElement('button');
    el.id='q105RfqAlert';
    el.type='button';
    el.className='q105-rfq-alert';
    el.hidden=true;
    el.innerHTML='<span class="q105-dot"></span><span class="q105-copy"><small>NEW REQUESTS</small><b><span data-q105-count>0</span> waiting</b></span>';
    el.addEventListener('click',()=>requestNav()?.click());
    const newBtn=document.getElementById('newDocBtn');
    actions.insertBefore(el,newBtn||actions.firstChild);
    return el;
  }

  function paint(count){
    count=Number(count||0);
    const nav=requestNav();
    const badge=nav?.querySelector('.q104-nav-count');
    if(badge){badge.hidden=count===0;badge.textContent=count>99?'99+':String(count)}
    const alert=ensureTopAlert();
    if(alert){
      alert.hidden=count===0;
      const n=alert.querySelector('[data-q105-count]');if(n)n.textContent=count>99?'99+':String(count);
    }
    document.title=count?`(${count}) ${baseTitle}`:baseTitle;
  }

  async function check(){
    try{
      const r=await sb.from('quo_quote_requests').select('id',{count:'exact',head:true}).eq('status','New');
      if(r.error)return;
      const count=Number(r.count||0);
      paint(count);
      if(previousCount!==null&&count>previousCount&&typeof toast==='function'){
        const added=count-previousCount;
        toast(added===1?'New quotation request received':`${added} new quotation requests received`);
      }
      previousCount=count;
    }catch(e){console.warn('Quo RFQ alert check failed',e)}
  }

  function start(){
    clearInterval(timer);
    check();
    timer=setInterval(check,60000);
  }

  window.addEventListener('focus',check);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)check()});
  setTimeout(start,1600);

  if(!document.getElementById('quoRfqAlertV105Style')){
    const st=document.createElement('style');
    st.id='quoRfqAlertV105Style';
    st.textContent=`
      .q105-rfq-alert{height:38px;display:flex;align-items:center;gap:8px;padding:0 11px;border:1px solid #e1d5b9;border-radius:9px;background:#fff9ea;color:#6f5624;cursor:pointer;white-space:nowrap}
      .q105-rfq-alert[hidden]{display:none!important}.q105-dot{width:7px;height:7px;border-radius:50%;background:#d79a23;box-shadow:0 0 0 4px rgba(215,154,35,.12)}
      .q105-copy{display:flex;flex-direction:column;align-items:flex-start;line-height:1.05}.q105-copy small{font-size:6.5px;font-weight:900;letter-spacing:.1em;color:#9a7a3b}.q105-copy b{margin-top:3px;font-size:9px;color:#5f4b24}
      @media(max-width:720px){.q105-rfq-alert{width:38px;padding:0;justify-content:center}.q105-copy{display:none}}
    `;
    document.head.appendChild(st);
  }
})();
