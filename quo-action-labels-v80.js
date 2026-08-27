/* Quo v80 - use Edit for document actions that open the editor. */
(function(){
  const SELECTOR='.row-actions button[data-open], .deal-actions button[data-open]';

  function applyEditLabels(root=document){
    root.querySelectorAll?.(SELECTOR).forEach(button=>{
      if(button.textContent.trim()==='Edit')return;
      button.textContent='Edit';
      button.setAttribute('aria-label','Edit document');
      button.setAttribute('title','Edit document');
    });
  }

  applyEditLabels();

  const observer=new MutationObserver(mutations=>{
    let needsUpdate=false;
    for(const mutation of mutations){
      if(mutation.type==='childList'&&mutation.addedNodes.length){needsUpdate=true;break;}
    }
    if(needsUpdate)applyEditLabels();
  });
  observer.observe(document.getElementById('view')||document.body,{childList:true,subtree:true});
})();
