/* Quo v92 - restore the exact working page/draft across browser refreshes. No observers. */
(function(){
  if(typeof S==='undefined') return;

  const KEY='quo_last_route_v92';
  let restored=false;

  function safeRead(){
    try{return JSON.parse(localStorage.getItem(KEY)||'null')}catch(e){return null}
  }

  function safeWrite(value){
    try{localStorage.setItem(KEY,JSON.stringify(value))}catch(e){}
  }

  function cloneDraft(d){
    if(!d) return null;
    try{return JSON.parse(JSON.stringify(d))}catch(e){return null}
  }

  function snapshot(){
    const current=S.current||null;
    const isEditor=S.view==='editor';
    return {
      view:S.view||'dashboard',
      filter:S.filter||'all',
      search:S.search||'',
      documentId:isEditor&&current?.id?current.id:null,
      documentType:isEditor&&current?.document_type?current.document_type:null,
      draft:isEditor&&!current?.id?cloneDraft(current):null,
      savedAt:Date.now()
    };
  }

  function saveRoute(){
    safeWrite(snapshot());
  }

  function restoreRoute(){
    if(restored||S.loading) return;
    restored=true;
    const saved=safeRead();
    if(!saved||!saved.view) return;

    if(saved.view==='editor'){
      if(saved.documentId){
        const doc=(S.docs||[]).find(d=>d.id===saved.documentId&&!d.deleted_at);
        if(doc){
          S.view='editor';
          S.current=doc;
          S.filter=doc.document_type||saved.documentType||saved.filter||'all';
          S.search='';
          S.editorDirty=false;
          return;
        }
      }
      if(saved.draft&&saved.draft.document_type){
        S.view='editor';
        S.current=saved.draft;
        S.filter=saved.draft.document_type||saved.documentType||saved.filter||'all';
        S.search='';
        S.editorDirty=true;
        return;
      }
      S.view='documents';
      S.current=null;
      S.filter=saved.documentType||saved.filter||'all';
      S.search='';
      return;
    }

    const allowed=new Set(['dashboard','documents','customers','settings','trash','supply-usage']);
    if(allowed.has(saved.view)){
      S.view=saved.view;
      S.current=null;
      S.filter=saved.filter||S.filter||'all';
      S.search=saved.view==='documents'?(saved.search||''):'';
    }
  }

  const previousRender=render;
  render=function(){
    restoreRoute();
    const result=previousRender.apply(this,arguments);
    if(!S.loading) saveRoute();
    return result;
  };

  window.addEventListener('beforeunload',saveRoute);
  window.addEventListener('pagehide',saveRoute);
})();
