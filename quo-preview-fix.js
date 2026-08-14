/* Quo preview navigation reliability fix v2 - no mutation loop. */
(function(){
  let pageIndex=0;

  const modal=()=>document.getElementById('quoFullPreview');
  const pages=()=>{const m=modal();return m?[...m.querySelectorAll('.quo-full-preview-page')]:[]};

  function hardClose(){
    const m=modal();
    if(m){m.classList.add('hidden');m.setAttribute('aria-hidden','true')}
    document.documentElement.classList.remove('quo-preview-open');
    document.body.classList.remove('quo-preview-open');
    document.documentElement.style.overflow='';
    document.body.style.overflow='';
    pageIndex=0;
  }

  function showPage(i,scroll=true){
    const list=pages();
    if(!list.length)return;
    pageIndex=Math.max(0,Math.min(i,list.length-1));
    list.forEach((p,n)=>p.classList.toggle('quo-page-current',n===pageIndex));
    const label=document.getElementById('quoPreviewPageCount');
    if(label)label.textContent=`Page ${pageIndex+1} of ${list.length}`;
    const prev=document.getElementById('quoPreviewPrev');
    const next=document.getElementById('quoPreviewNext');
    if(prev)prev.disabled=pageIndex===0;
    if(next)next.disabled=pageIndex===list.length-1;
    if(scroll){
      const scroller=modal()?.querySelector('.quo-full-preview-scroll');
      if(scroller)scroller.scrollTo({top:0,behavior:'auto'});
    }
  }

  function enhance(){
    const m=modal();
    if(!m)return;
    m.setAttribute('aria-hidden',m.classList.contains('hidden')?'true':'false');

    if(m.dataset.navFixed!=='1'){
      m.dataset.navFixed='1';
      const close=m.querySelector('[data-preview-close]');
      if(close){
        close.removeAttribute('onclick');
        close.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();hardClose()},true);
      }

      const bar=document.createElement('div');
      bar.className='quo-preview-bottom-nav';
      bar.innerHTML='<button class="btn" id="quoPreviewBack" type="button">Back to Editor</button><div class="quo-preview-page-nav"><button class="btn" id="quoPreviewPrev" type="button">Previous</button><b id="quoPreviewPageCount">Page 1 of 1</b><button class="btn" id="quoPreviewNext" type="button">Next</button></div><button class="btn primary" id="quoPreviewDownload" type="button">Download PDF</button>';
      m.appendChild(bar);
      bar.querySelector('#quoPreviewBack').onclick=hardClose;
      bar.querySelector('#quoPreviewPrev').onclick=()=>showPage(pageIndex-1);
      bar.querySelector('#quoPreviewNext').onclick=()=>showPage(pageIndex+1);
      bar.querySelector('#quoPreviewDownload').onclick=()=>{hardClose();if(typeof exportPDF==='function')exportPDF()};
    }
  }

  /* Patch the real preview opener once. This avoids observing class mutations,
     which previously caused showPage -> class mutation -> observer -> showPage loops. */
  if(typeof window.openFullPreview==='function'){
    const originalOpen=window.openFullPreview;
    window.openFullPreview=function(){
      originalOpen.apply(this,arguments);
      pageIndex=0;
      enhance();
      requestAnimationFrame(()=>showPage(0,false));
    };
  }

  document.addEventListener('click',e=>{
    if(e.target.closest('[data-preview-close],#quoPreviewBack')){
      e.preventDefault();e.stopPropagation();hardClose();
    }
  },true);

  document.addEventListener('keydown',e=>{
    const m=modal();
    if(!m||m.classList.contains('hidden'))return;
    if(e.key==='Escape'){e.preventDefault();hardClose()}
    if(e.key==='ArrowLeft'){e.preventDefault();showPage(pageIndex-1)}
    if(e.key==='ArrowRight'){e.preventDefault();showPage(pageIndex+1)}
  },true);

  /* Only watch for the modal being inserted into the DOM. Never watch class changes. */
  const obs=new MutationObserver(()=>{
    const m=modal();
    if(m){enhance();obs.disconnect()}
  });
  obs.observe(document.body,{childList:true,subtree:true});

  const st=document.createElement('style');
  st.textContent=`
    .quo-full-preview{z-index:2147483600!important}
    .quo-full-preview-head{position:sticky;top:0;z-index:5}
    .quo-full-preview-actions [data-preview-close]{position:relative;z-index:10;pointer-events:auto!important;touch-action:manipulation}
    .quo-full-preview-scroll{overscroll-behavior:contain;-webkit-overflow-scrolling:touch;scroll-behavior:auto!important}
    .quo-preview-bottom-nav{position:sticky;bottom:0;z-index:6;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;background:rgba(255,255,255,.98);border-top:1px solid #dfe3e5;box-shadow:0 -8px 24px rgba(20,24,27,.08);backdrop-filter:blur(12px)}
    .quo-preview-page-nav{display:flex;align-items:center;gap:8px}.quo-preview-page-nav b{min-width:92px;text-align:center;font-size:10px;color:#687074}
    .quo-preview-bottom-nav .btn{min-height:40px;touch-action:manipulation}
    @media(max-width:760px){
      .quo-full-preview-scroll{padding:8px 6px 74px!important;overflow-y:auto!important;touch-action:pan-y}
      .quo-preview-bottom-nav{position:fixed;left:0;right:0;bottom:0;padding:8px max(8px,env(safe-area-inset-right)) max(8px,env(safe-area-inset-bottom)) max(8px,env(safe-area-inset-left));gap:5px}
      .quo-preview-bottom-nav .btn{padding:9px 8px;font-size:10px;flex:1}
      .quo-preview-page-nav{display:flex;flex:2;gap:4px}.quo-preview-page-nav .btn{flex:1}.quo-preview-page-nav b{min-width:58px;font-size:9px}
      .quo-full-preview-page{display:none!important}.quo-full-preview-page.quo-page-current{display:block!important}
    }
  `;
  document.head.appendChild(st);
})();
