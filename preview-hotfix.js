(function(){
  function forceClosePreview(){
    try{
      document.body.classList.remove('pdf-preview-mode');
      document.documentElement.classList.remove('pdf-preview-mode');
      document.querySelectorAll('.preview .page').forEach(function(p){p.classList.remove('preview-active')});
      document.documentElement.style.removeProperty('--pdf-zoom');
      window.scrollTo(0, window.pdfReturnScroll || 0);
    }catch(e){
      console.error('Preview close recovery failed',e);
    }
  }

  window.closePdfPreview = forceClosePreview;

  document.addEventListener('click',function(e){
    var back=e.target.closest('#pdfBackBtn,.pdf-nav-btn.back');
    if(back){
      e.preventDefault();
      e.stopPropagation();
      forceClosePreview();
      return;
    }
    var prev=e.target.closest('#pdfPrev');
    if(prev && typeof window.pdfPrevPage==='function'){
      e.preventDefault();
      window.pdfPrevPage();
      return;
    }
    var next=e.target.closest('#pdfNext');
    if(next && typeof window.pdfNextPage==='function'){
      e.preventDefault();
      window.pdfNextPage();
    }
  },true);

  window.addEventListener('keydown',function(e){
    if(e.key==='Escape' && document.body.classList.contains('pdf-preview-mode')){
      e.preventDefault();
      forceClosePreview();
    }
  },true);

  window.addEventListener('pageshow',function(){
    if(!document.body.classList.contains('pdf-preview-mode')){
      document.documentElement.classList.remove('pdf-preview-mode');
      document.documentElement.style.removeProperty('--pdf-zoom');
    }
  });

  var style=document.createElement('style');
  style.textContent='.pdf-nav{z-index:2147483647!important;pointer-events:auto!important}.pdf-nav button{pointer-events:auto!important;touch-action:manipulation!important;min-height:42px}.pdf-nav-btn.back{position:relative!important;z-index:2!important}@media(max-width:680px){.pdf-nav{bottom:max(8px,env(safe-area-inset-bottom))!important}}';
  document.head.appendChild(style);
})();
