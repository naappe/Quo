/* Quo v48 - canonical editor master.
   Replaces the old editor-final, cleanup, trim and editor-order patch stack. */
(function(){
  const VERSION='48';
  const PREPARER='White Saffron';
  const ORDER=['document','customer','items','event / service','menu','notes & terms'];

  window.QUO_MASTER_VERSION=VERSION;
  if(typeof S!=='undefined')S.preparedBy=PREPARER;
  try{localStorage.setItem('quo_prepared_by',PREPARER)}catch(e){}
  try{prepared=function(){if(typeof S!=='undefined')S.preparedBy=PREPARER;return PREPARER}}catch(e){}

  try{
    const originalParseMenu=parseMenu;
    parseMenu=function(text){
      const raw=String(text||'').trim();
      if(!raw)return [];
      const parsed=originalParseMenu(raw);
      if(parsed.length&&parsed.some(day=>Array.isArray(day.meals)&&day.meals.length))return parsed;
      const lines=raw.split(/\r?\n/).map(v=>v.trim()).filter(Boolean);
      return [{label:'Day 1',meals:lines.map((line,i)=>{
        const colon=line.indexOf(':');
        return colon>0
          ? {name:line.slice(0,colon).trim(),time:'',items:line.slice(colon+1).trim()||'-'}
          : {name:`Item ${i+1}`,time:'',items:line};
      })}];
    };
  }catch(e){}

  function titleOf(card){return String(card?.querySelector('header h3')?.textContent||'').trim().toLowerCase()}

  function masterEditorHTML(html){
    if(typeof html!=='string'||typeof S==='undefined'||!S.current)return html;
    const host=document.createElement('div');host.innerHTML=html;

    host.querySelectorAll('.quote-stage-bar,.fill-guide,.section-warning,.runtime-number-hint').forEach(el=>el.remove());

    const main=host.querySelector('.editor-main');
    if(main){
      const cards=[...main.children].filter(el=>el.classList?.contains('editor-card'));
      cards.filter(card=>titleOf(card)==='payment').forEach(card=>card.remove());
      const live=[...main.children].filter(el=>el.classList?.contains('editor-card'));
      live.forEach(card=>{
        card.classList.remove('collapsed');
        card.querySelectorAll('.section-toggle,[data-section-toggle]').forEach(el=>el.remove());
      });
      const map=new Map(live.map(card=>[titleOf(card),card]));
      ORDER.forEach(name=>{const card=map.get(name);if(card)main.appendChild(card)});
      live.filter(card=>!ORDER.includes(titleOf(card))).forEach(card=>main.appendChild(card));
      main.classList.add('quo-master-editor');
    }

    const actions=host.querySelector('.editor-actions');
    if(actions){
      actions.querySelectorAll('[data-create-receipt]').forEach(el=>el.remove());
      const more=actions.querySelector('.editor-more');
      const menu=more?.querySelector('.editor-more-menu');
      let preview=actions.querySelector('[data-full-preview]');
      if(!preview){
        preview=document.createElement('button');preview.type='button';preview.className='btn';preview.dataset.fullPreview='';preview.textContent='Preview PDF';
        actions.querySelector('[data-save]')?.insertAdjacentElement('afterend',preview);
      }else preview.textContent='Preview PDF';

      const pdfButtons=[...actions.querySelectorAll('[data-pdf]')];
      let pdf=pdfButtons.find(el=>!menu?.contains(el))||pdfButtons[0];
      pdfButtons.filter(el=>el!==pdf).forEach(el=>el.remove());
      if(pdf&&menu&&!menu.contains(pdf))menu.prepend(pdf);
      if(pdf){pdf.textContent='Download PDF';pdf.classList.add('btn')}

      if(S.current.id&&menu&&!menu.querySelector('[data-delete-doc]')){
        const del=document.createElement('button');
        del.type='button';del.className='btn danger';del.dataset.deleteDoc=S.current.id;del.textContent='Delete';
        menu.appendChild(del);
      }
    }

    if(!S.current.id&&/AUTO ON SAVE/i.test(String(S.current.document_number||''))){
      host.querySelectorAll('.doc-number-pill,.mini-doc span').forEach(el=>el.textContent='Auto number on save');
    }
    return host.innerHTML;
  }

  try{
    const previousRenderEditor=renderEditor;
    renderEditor=function(){return masterEditorHTML(previousRenderEditor.apply(this,arguments))};
  }catch(e){}

  function cleanChrome(){
    document.querySelector('.prepared-by')?.remove();
    document.querySelectorAll('.quote-stage-bar,.fill-guide,.section-warning,.runtime-number-hint').forEach(el=>el.remove());
  }

  try{
    const previousBind=bindDynamic;
    bindDynamic=function(){
      cleanChrome();
      const result=previousBind.apply(this,arguments);
      cleanChrome();
      return result;
    };
  }catch(e){}

  if(!document.getElementById('quoMasterV48Style')){
    const st=document.createElement('style');st.id='quoMasterV48Style';st.textContent=`
      .editor-actions:has(.editor-more[open]){padding-bottom:0!important}
      .editor-more[open] .editor-more-menu{display:block!important;position:absolute!important;top:43px!important;right:0!important;left:auto!important;width:220px!important;min-width:220px!important;padding:6px!important;background:#fff!important;border:1px solid #dce2df!important;border-radius:9px!important;box-shadow:0 14px 36px rgba(25,39,36,.14)!important;z-index:1000!important}
      .editor-more[open] .editor-more-menu .btn{display:block!important;width:100%!important;min-height:34px!important;margin:0!important;padding:8px 10px!important;border:0!important;background:#fff!important;text-align:left!important}
      .editor-more[open] .editor-more-menu .btn:hover{background:#f5f7f6!important}
      .editor-more[open] .editor-more-menu .btn.danger{color:#9c4545!important}
      .editor-more[open] .editor-more-menu .btn.danger:hover{background:#fff3f2!important}
      .quote-stage-bar,.prepared-by,.fill-guide,.section-warning,.runtime-number-hint,.section-toggle,[data-section-toggle],.section-no{display:none!important}
      @media(max-width:820px){.editor-more[open] .editor-more-menu{left:0!important;right:auto!important;width:min(240px,calc(100vw - 32px))!important;min-width:0!important}}
    `;document.head.appendChild(st);
  }

  document.addEventListener('click',e=>{
    const open=document.querySelector('.editor-more[open]');
    if(open&&!open.contains(e.target))open.removeAttribute('open');
  });

  cleanChrome();
  if(typeof S!=='undefined'&&S.current&&S.view==='editor'&&typeof render==='function')render();
})();
