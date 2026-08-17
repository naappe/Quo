/* Quo v30 - simplify editor: show all sections, remove guidance, fixed business preparer. */
(function(){
  const FIXED_PREPARER='White Saffron';

  if(typeof S!=='undefined'){
    S.preparedBy=FIXED_PREPARER;
    S.editorDirty=!!S.editorDirty;
  }
  try{localStorage.setItem('quo_prepared_by',FIXED_PREPARER)}catch(e){}

  try{
    prepared=function(){
      if(typeof S!=='undefined')S.preparedBy=FIXED_PREPARER;
      return FIXED_PREPARER;
    };
  }catch(e){}

  /* Optional document sections are always visible. */
  try{
    optionalEditorCard=function(n,title,body){
      return editorCard(n,title,body);
    };
  }catch(e){}

  function cleanStaticChrome(){
    document.querySelector('.prepared-by')?.remove();
    document.querySelectorAll('.fill-guide').forEach(el=>el.remove());
  }

  cleanStaticChrome();

  if(typeof S!=='undefined'&&S.current&&S.view==='editor'&&typeof render==='function'){
    render();
    cleanStaticChrome();
  }
})();
