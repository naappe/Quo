/* Quo v34 - keep live PDF preview synced for new and existing documents. */
(function(){
  let previewTimer=null;

  function buildPreviewHTML(d){
    if(!d||typeof miniPreview!=='function')return '';
    try{return miniPreview(d)||''}catch(e){console.warn('Live preview build failed',e);return ''}
  }

  function refreshLivePreview(){
    if(typeof S==='undefined'||S.view!=='editor'||!S.current)return;
    try{if(typeof readEditor==='function')readEditor()}catch(e){}
    const card=document.querySelector('.preview-card');
    if(!card)return;
    const html=buildPreviewHTML(S.current);
    if(!html)return;
    const tmp=document.createElement('div');
    tmp.innerHTML=html;
    const fresh=tmp.firstElementChild;
    if(!fresh)return;

    const current=card.querySelector('.preview-pages,.paper-mini');
    if(current)current.replaceWith(fresh);
    else card.appendChild(fresh);
  }

  function schedulePreview(delay=35){
    clearTimeout(previewTimer);
    previewTimer=setTimeout(refreshLivePreview,delay);
  }

  /* Run after the normal editor handlers, so unsaved menu text is already in S.current. */
  document.addEventListener('input',e=>{
    if(!e.target.closest?.('[data-field],[data-item-field]'))return;
    schedulePreview();
  },true);

  document.addEventListener('change',e=>{
    if(!e.target.closest?.('[data-field],[data-item-field]'))return;
    /* Switch changes often trigger a full render. Wait until the new preview card exists. */
    schedulePreview(90);
  },true);

  /* Re-rendering the editor creates a new preview node. Sync it once DOM settles. */
  const observer=new MutationObserver(mutations=>{
    if(typeof S==='undefined'||S.view!=='editor'||!S.current)return;
    if(mutations.some(m=>[...m.addedNodes].some(n=>n.nodeType===1&&(n.matches?.('.preview-card')||n.querySelector?.('.preview-card')))))schedulePreview(20);
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});

  /* Explicitly wrap the soft updater because this is the path used while typing menu text. */
  try{
    const previousSoft=renderEditorSoft;
    renderEditorSoft=function(){
      const result=previousSoft.apply(this,arguments);
      schedulePreview(10);
      return result;
    };
  }catch(e){}

  /* New documents must behave exactly like saved documents. */
  try{
    const previousOpen=openEditor;
    openEditor=function(d){
      const result=previousOpen.apply(this,arguments);
      schedulePreview(30);
      return result;
    };
  }catch(e){}

  window.quoRefreshLivePreview=refreshLivePreview;
  schedulePreview(60);
})();
