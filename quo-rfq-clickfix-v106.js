/* Quo v106 - make the new-RFQ alert reliably open Quote Requests. */
(function(){
  if(typeof S==='undefined')return;

  function openQuoteRequests(){
    try{
      S.view='quote-requests';
      S.current=null;
      S.editorDirty=false;
      document.getElementById('sidebar')?.classList.remove('open');
      document.body.classList.remove('q101-drawer-open');
      if(typeof render==='function')render();
      window.scrollTo(0,0);
      setTimeout(()=>document.querySelector('[data-q104-refresh]')?.click(),60);
    }catch(e){
      console.warn('Could not open Quote Requests directly',e);
      document.querySelector('[data-q104-requests]')?.click();
    }
  }

  function bind(){
    const alert=document.getElementById('q105RfqAlert');
    if(alert&&!alert.dataset.q106Bound){
      alert.dataset.q106Bound='1';
      alert.onclick=function(e){e.preventDefault();e.stopPropagation();openQuoteRequests()};
      alert.setAttribute('aria-label','Open new quotation requests');
    }
    const nav=document.querySelector('[data-q104-requests]');
    if(nav&&!nav.dataset.q106Bound){
      nav.dataset.q106Bound='1';
      nav.addEventListener('click',()=>setTimeout(()=>{
        if(S.view!=='quote-requests')openQuoteRequests();
      },0));
    }
  }

  const observer=new MutationObserver(bind);
  observer.observe(document.body,{childList:true,subtree:true});
  bind();
  setTimeout(bind,1800);

  if(!document.getElementById('quoRfqClickFixV106Style')){
    const st=document.createElement('style');
    st.id='quoRfqClickFixV106Style';
    st.textContent=`
      #q105RfqAlert{position:relative!important;z-index:40!important;pointer-events:auto!important;touch-action:manipulation!important;cursor:pointer!important}
      #q105RfqAlert *{pointer-events:none!important}
    `;
    document.head.appendChild(st);
  }

  window.quoOpenQuoteRequests=openQuoteRequests;
})();
