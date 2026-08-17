/* Quo v35 - keep quotation status actions on the dashboard, not inside the editor. */
(function(){
  try{
    const previousRenderEditor=renderEditor;
    renderEditor=function(){
      let html=previousRenderEditor.apply(this,arguments);
      if(typeof html!=='string')return html;
      return html.replace(/<div class="quote-stage-bar">[\s\S]*?<\/div>/g,'');
    };
  }catch(e){}

  function removeDuplicateDealBar(){
    document.querySelectorAll('.quote-stage-bar').forEach(el=>el.remove());
  }

  try{
    const previousBind=bindDynamic;
    bindDynamic=function(){
      removeDuplicateDealBar();
      const result=previousBind.apply(this,arguments);
      removeDuplicateDealBar();
      return result;
    };
  }catch(e){}

  if(!document.getElementById('quoEditorTrimV35')){
    const st=document.createElement('style');
    st.id='quoEditorTrimV35';
    st.textContent='.quote-stage-bar{display:none!important}';
    document.head.appendChild(st);
  }

  removeDuplicateDealBar();
  if(typeof S!=='undefined'&&S.view==='editor'&&S.current&&typeof render==='function')render();
})();
