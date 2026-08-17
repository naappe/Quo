/* Quo v31 - final editor cleanup and legacy-conflict hotfix. */
(function(){
  const FIXED_PREPARER='White Saffron';

  if(typeof S!=='undefined'){
    S.preparedBy=FIXED_PREPARER;
    S.editorDirty=!!S.editorDirty;
  }
  try{localStorage.setItem('quo_prepared_by',FIXED_PREPARER)}catch(e){}

  /* Saving never asks for a staff/preparer name. */
  try{
    prepared=function(){
      if(typeof S!=='undefined')S.preparedBy=FIXED_PREPARER;
      return FIXED_PREPARER;
    };
  }catch(e){}

  /* All editor sections stay open. The internal enable switches still control
     whether Event/Menu/Advance information is included in the document. */
  try{
    optionalEditorCard=function(n,title,body){
      return editorCard(n,title,body);
    };
  }catch(e){}

  function cleanStaticChrome(){
    document.querySelector('.prepared-by')?.remove();
    document.querySelectorAll('.fill-guide,.section-warning,.runtime-number-hint').forEach(el=>el.remove());
  }

  function cleanEditorDOM(){
    cleanStaticChrome();
    const editor=document.querySelector('.editor-shell');
    if(!editor)return;

    /* Remove stale Show/Hide controls and stale collapsed classes from older JS/CSS. */
    editor.querySelectorAll('[data-section-toggle],.section-toggle').forEach(el=>el.remove());
    editor.querySelectorAll('.optional-card,.editor-card').forEach(card=>card.classList.remove('collapsed'));

    /* Do not expose the internal temporary numbering token. */
    const d=typeof S!=='undefined'?S.current:null;
    if(d&&!d.id&&/AUTO ON SAVE/i.test(String(d.document_number||''))){
      document.querySelectorAll('.doc-number-pill,.mini-doc span').forEach(el=>el.textContent='Auto number on save');
    }

    /* Keep the main toolbar focused: Save + Preview + More. */
    const actions=document.querySelector('.editor-actions');
    if(actions){
      const moreMenu=actions.querySelector('.editor-more-menu');
      const preview=actions.querySelector('[data-full-preview]');
      const directPdf=[...actions.children].find(el=>el.matches?.('[data-pdf]'));
      if(directPdf&&moreMenu){
        directPdf.textContent='Download PDF';
        moreMenu.prepend(directPdf);
      }
      if(!preview){
        const save=actions.querySelector('[data-save]');
        if(save){
          const b=document.createElement('button');
          b.className='btn';b.type='button';b.dataset.fullPreview='';b.textContent='Preview PDF';
          save.insertAdjacentElement('afterend',b);
        }
      }
    }
  }

  /* Clean the DOM before handlers are attached so moved toolbar buttons keep working. */
  try{
    const previousBind=bindDynamic;
    bindDynamic=function(){
      cleanEditorDOM();
      previousBind();
      cleanEditorDOM();
    };
  }catch(e){}

  if(!document.getElementById('quoCleanupV31Style')){
    const st=document.createElement('style');
    st.id='quoCleanupV31Style';
    st.textContent=`
      /* Remove obsolete guidance and section controls. */
      .prepared-by,.fill-guide,.section-warning,.runtime-number-hint,
      .section-no,.section-toggle,[data-section-toggle]{display:none!important}
      .switch-copy span{display:none!important}

      /* Neutral cards override all legacy segment colors. */
      .editor-card,.optional-card{
        border:1px solid #e2e7e5!important;
        border-radius:10px!important;
        background:#fff!important;
        box-shadow:none!important;
        overflow:hidden!important;
        margin:0 0 12px!important
      }
      .editor-card:before,.optional-card:before{display:none!important}
      .editor-card>header,.optional-card>header{
        position:static!important;
        display:flex!important;
        align-items:center!important;
        min-height:auto!important;
        padding:13px 16px 7px!important;
        background:#fff!important;
        border:0!important;
        box-shadow:none!important
      }
      .editor-card>header h3,.optional-card>header h3{
        margin:0!important;color:#202826!important;font-size:15px!important;font-weight:700!important
      }
      .editor-card .card-body,.optional-card .card-body{display:block!important;padding:8px 16px 16px!important}

      /* Prevent sticky headers from overlapping sections while scrolling. */
      .editor-top{position:static!important;top:auto!important;margin:0 0 16px!important;padding:0 0 14px!important;background:transparent!important;border-bottom:1px solid #e5e9e7!important;backdrop-filter:none!important}
      .editor-title .eyebrow{display:none!important}
      .editor-title .doc-type-title{font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif!important;font-size:22px!important}

      /* Toolbar cannot spill outside the workspace. */
      .editor-actions{display:flex!important;align-items:center!important;justify-content:flex-end!important;gap:7px!important;flex-wrap:wrap!important;max-width:52%!important}
      .editor-actions>.btn,.editor-more>summary{min-height:36px!important;white-space:nowrap!important}
      .editor-more{position:relative!important}
      .editor-more-menu{right:0!important;left:auto!important;min-width:190px!important;z-index:100!important}

      /* Give the editor/preview stable proportions. */
      .editor-shell{grid-template-columns:minmax(620px,1fr) minmax(310px,360px)!important;gap:20px!important}
      .preview-card{top:68px!important}

      /* Clean switch rows and form spacing. */
      .switch-row{background:#fafbfb!important;border:1px solid #e4e8e6!important;box-shadow:none!important}
      .switch-copy b{font-size:11.5px!important}
      .field label{font-size:10px!important;color:#616b68!important}
      .field input,.field select,.field textarea{font-size:13px!important;min-height:39px!important}

      @media(max-width:1180px){
        .editor-shell{grid-template-columns:1fr!important}
        .preview-card{position:relative!important;top:auto!important;max-width:560px!important;margin:0 auto!important}
        .editor-actions{max-width:none!important}
      }
      @media(max-width:720px){
        .editor-top{display:flex!important;flex-wrap:wrap!important}
        .editor-actions{width:100%!important;justify-content:flex-start!important;max-width:none!important}
      }
    `;
    document.head.appendChild(st);
  }

  cleanStaticChrome();
  cleanEditorDOM();

  if(typeof S!=='undefined'&&S.current&&S.view==='editor'&&typeof render==='function'){
    render();
    cleanEditorDOM();
  }
})();
