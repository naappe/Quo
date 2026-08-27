/* Quo v81 - use Edit labels without DOM observers. */
(function(){
  const SELECTOR='.row-actions button[data-open], .deal-actions button[data-open]';

  function applyEditLabels(root=document){
    root.querySelectorAll?.(SELECTOR).forEach(button=>{
      if(button.textContent.trim()!=='Edit')button.textContent='Edit';
      if(button.getAttribute('aria-label')!=='Edit document')button.setAttribute('aria-label','Edit document');
      if(button.getAttribute('title')!=='Edit document')button.setAttribute('title','Edit document');
    });
  }

  /* Apply once after each normal Quo render/bind cycle. No MutationObserver. */
  try{
    const previousBind=bindDynamic;
    bindDynamic=function(){
      const result=previousBind.apply(this,arguments);
      applyEditLabels(document.getElementById('view')||document);
      return result;
    };
  }catch(e){}

  applyEditLabels(document.getElementById('view')||document);
})();