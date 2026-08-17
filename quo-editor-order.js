/* Quo v37 - final editor section order. Payment editing removed. */
(function(){
  const ORDER=['document','customer','items','event / service','menu','notes & terms'];

  function titleOf(card){
    return String(card?.querySelector('header h3')?.textContent||'').trim().toLowerCase();
  }

  function clearAdvanceState(){
    if(typeof S==='undefined'||!S.current)return;
    S.current.use_advance=false;
    S.current.advance_percent=0;
    S.current.advance_due='';
  }

  function normalizeEditor(){
    if(typeof S==='undefined'||S.view!=='editor'||!S.current)return;
    clearAdvanceState();
    const main=document.querySelector('.editor-main');
    if(!main)return;

    const cards=[...main.children].filter(el=>el.classList?.contains('editor-card'));
    if(!cards.length)return;

    /* Payment is intentionally not part of the editor workflow. */
    cards.filter(card=>titleOf(card)==='payment').forEach(card=>card.remove());

    const live=[...main.children].filter(el=>el.classList?.contains('editor-card'));
    const known=new Map(live.map(card=>[titleOf(card),card]));

    ORDER.forEach(name=>{
      const card=known.get(name);
      if(card)main.appendChild(card);
    });

    /* Any future/unrecognized card stays after the approved workflow. */
    live.filter(card=>!ORDER.includes(titleOf(card))).forEach(card=>main.appendChild(card));
    main.classList.add('quo-editor-ordered');
  }

  /* Ensure hidden old advance values cannot reappear in preview/PDF after save. */
  try{
    const previousSave=saveCurrent;
    saveCurrent=async function(){
      clearAdvanceState();
      return previousSave.apply(this,arguments);
    };
  }catch(e){}

  /* Reorder after every full editor render, before and after normal bindings. */
  try{
    const previousBind=bindDynamic;
    bindDynamic=function(){
      normalizeEditor();
      const result=previousBind.apply(this,arguments);
      normalizeEditor();
      return result;
    };
  }catch(e){}

  if(!document.getElementById('quoEditorOrderV37Style')){
    const st=document.createElement('style');
    st.id='quoEditorOrderV37Style';
    st.textContent=`
      .quo-editor-ordered>.editor-card{margin-bottom:12px!important}
      .quo-editor-ordered>.editor-card:last-child{margin-bottom:0!important}
    `;
    document.head.appendChild(st);
  }

  normalizeEditor();
})();
