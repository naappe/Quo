/* Quo v41 - approved editor order. Payment card hidden, stored payment data preserved. */
(function(){
  const ORDER=['document','customer','items','event / service','menu','notes & terms'];
  function titleOf(card){return String(card?.querySelector('header h3')?.textContent||'').trim().toLowerCase()}
  function normalizeEditor(){
    if(typeof S==='undefined'||S.view!=='editor'||!S.current)return;
    const main=document.querySelector('.editor-main');if(!main)return;
    const cards=[...main.children].filter(el=>el.classList?.contains('editor-card'));if(!cards.length)return;
    cards.filter(card=>titleOf(card)==='payment').forEach(card=>card.remove());
    const live=[...main.children].filter(el=>el.classList?.contains('editor-card'));
    const known=new Map(live.map(card=>[titleOf(card),card]));
    ORDER.forEach(name=>{const card=known.get(name);if(card)main.appendChild(card)});
    live.filter(card=>!ORDER.includes(titleOf(card))).forEach(card=>main.appendChild(card));
    main.classList.add('quo-editor-ordered');
  }
  const previousBind=bindDynamic;
  bindDynamic=function(){normalizeEditor();const result=previousBind.apply(this,arguments);normalizeEditor();return result;};
  if(!document.getElementById('quoEditorOrderV41Style')){const st=document.createElement('style');st.id='quoEditorOrderV41Style';st.textContent='.quo-editor-ordered>.editor-card{margin-bottom:12px!important}.quo-editor-ordered>.editor-card:last-child{margin-bottom:0!important}';document.head.appendChild(st);}
  normalizeEditor();
})();
