/* Quo v81 - Edit means direct editing of the current commercial document. */
(function(){
  const INACTIVE=new Set(['Cancelled','Superseded']);

  function canDirectEdit(d){
    return !!d?.id&&d.document_type!=='receipt'&&!INACTIVE.has(String(d.status||''));
  }

  function unlockCurrentDocument(){
    if(typeof S==='undefined'||S.view!=='editor'||!canDirectEdit(S.current))return;

    /* Remove the old protected-document message and amendment-only action. */
    document.querySelector('.q66-lock-note')?.remove();
    document.querySelectorAll('[data-q66-amend]').forEach(el=>el.remove());

    /* All normal document fields are editable when the user chose Edit. */
    document.querySelectorAll('[data-field]').forEach(el=>{
      el.disabled=false;
      el.readOnly=false;
      el.removeAttribute('aria-readonly');
      el.removeAttribute('aria-disabled');
    });
    document.querySelectorAll('[data-item-field]').forEach(el=>{
      el.disabled=false;
      el.readOnly=false;
      el.removeAttribute('aria-readonly');
      el.removeAttribute('aria-disabled');
    });
    document.querySelectorAll('[data-add-item],[data-remove-item],[data-quo-terms-add],[data-quo-terms-remove],.quo-terms-action').forEach(el=>{
      el.disabled=false;
      el.classList.remove('q66-disabled-control');
      el.removeAttribute('aria-disabled');
    });

    const save=document.querySelector('[data-save]');
    if(save){
      save.hidden=false;
      save.disabled=false;
      save.textContent='Save Changes';
      save.title='Save changes to this document';
    }
  }

  try{
    const previousBind=bindDynamic;
    bindDynamic=function(){
      const result=previousBind.apply(this,arguments);
      unlockCurrentDocument();
      return result;
    };
  }catch(e){}

  /* The editor is frequently rebuilt after field changes; keep direct-edit state applied. */
  const host=document.getElementById('view');
  if(host){
    const observer=new MutationObserver(()=>unlockCurrentDocument());
    observer.observe(host,{childList:true,subtree:true});
  }

  unlockCurrentDocument();
})();
