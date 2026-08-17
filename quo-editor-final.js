/* Quo v29 - final editor composition after legacy/runtime patches. */
(function(){
  const previousRenderEditor=renderEditor;
  renderEditor=function(){
    let html=previousRenderEditor();
    const d=S.current;
    if(!d)return html;

    /* Keep only Save + Preview as primary toolbar actions. Put PDF download in More. */
    const combined='<button class="btn" data-full-preview>Preview PDF</button><button class="btn" data-pdf>Download PDF</button>';
    if(html.includes(combined)){
      html=html.replace(combined,'<button class="btn" data-full-preview>Preview PDF</button>');
      html=html.replace('<div class="editor-more-menu">','<div class="editor-more-menu"><button class="btn" type="button" data-pdf>Download PDF</button>');
    }

    /* Do not expose the internal placeholder wording to the user. */
    if(!d.id&&/AUTO ON SAVE/i.test(String(d.document_number||''))){
      html=html.split(esc(d.document_number)).join('Auto number on save');
    }
    return html;
  };

  /* Re-apply the final editor stylesheet after all runtime-injected styles. */
  const existing=document.getElementById('quoEditorFinalStyle');
  if(!existing){
    const link=document.createElement('link');
    link.id='quoEditorFinalStyle';
    link.rel='stylesheet';
    link.href='./quo-editor-v2.css?v=29';
    document.head.appendChild(link);
  }

  if(S.current&&S.view==='editor')render();
})();
