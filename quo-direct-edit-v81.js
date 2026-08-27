/* Quo v82 - direct editing without self-triggering DOM observers. */
(function(){
  const INACTIVE=new Set(['Cancelled','Superseded']);

  function canDirectEdit(d){
    return !!d?.id&&d.document_type!=='receipt'&&!INACTIVE.has(String(d.status||''));
  }

  function enableControl(el){
    if(!el)return;
    if(el.disabled)el.disabled=false;
    if(el.readOnly)el.readOnly=false;
    if(el.hasAttribute('aria-readonly'))el.removeAttribute('aria-readonly');
    if(el.hasAttribute('aria-disabled'))el.removeAttribute('aria-disabled');
    if(el.classList?.contains('q66-disabled-control'))el.classList.remove('q66-disabled-control');
  }

  function unlockCurrentDocument(){
    if(typeof S==='undefined'||S.view!=='editor'||!canDirectEdit(S.current))return;

    const lockNote=document.querySelector('.q66-lock-note');
    if(lockNote)lockNote.remove();
    document.querySelectorAll('[data-q66-amend]').forEach(el=>el.remove());

    document.querySelectorAll('[data-field],[data-item-field],[data-add-item],[data-remove-item],[data-quo-terms-add],[data-quo-terms-remove],.quo-terms-action').forEach(enableControl);

    const save=document.querySelector('[data-save]');
    if(save){
      if(save.hidden)save.hidden=false;
      if(save.disabled)save.disabled=false;
      if(save.textContent!=='Save Changes')save.textContent='Save Changes';
      if(save.title!=='Save changes to this document')save.title='Save changes to this document';
    }
  }

  /* quo-amendments runs inside bindDynamic first; unlock once after that pass. */
  try{
    const previousBind=bindDynamic;
    bindDynamic=function(){
      const result=previousBind.apply(this,arguments);
      unlockCurrentDocument();
      return result;
    };
  }catch(e){}

  /* No MutationObserver here: observing and rewriting the same editor caused a render loop. */
  unlockCurrentDocument();
})();
