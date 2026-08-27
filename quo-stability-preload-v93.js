/* Quo v93 stability preload: prevent known whole-page MutationObservers from creating render cascades. */
(function(){
  const Native=window.MutationObserver;
  if(typeof Native!=='function'||window.__QUO_STABILITY_V93__)return;
  window.__QUO_STABILITY_V93__=true;

  const blocked=/quo-preview-v44\.js|quo-final-audit-v65\.js|quo-trash\.js|quo-auth-v46\.js/;

  class QuoSafeMutationObserver extends Native{
    observe(target,options){
      const broad=(target===document.body||target===document.documentElement)&&options?.childList&&options?.subtree;
      if(broad){
        const stack=String(new Error().stack||'');
        if(blocked.test(stack))return;
      }
      return super.observe(target,options);
    }
  }

  window.MutationObserver=QuoSafeMutationObserver;
})();
