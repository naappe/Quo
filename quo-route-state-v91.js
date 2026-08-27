/* Quo v91 - remember the last working page across browser refreshes. No observers. */
(function(){
  if(typeof S==='undefined') return;

  const KEY='quo_last_route_v91';
  let restored=false;

  function safeRead(){
    try{return JSON.parse(localStorage.getItem(KEY)||'null')}catch(e){return null}
  }

  function safeWrite(value){
    try{localStorage.setItem(KEY,JSON.stringify(value))}catch(e){}
  }

  function snapshot(){
    const current=S.current||null;
    return {
      view:S.view||'dashboard',
      filter:S.filter||'all',
      documentId:S.view==='editor'&&current?.id?current.id:null,
      documentType:S.view==='editor'&&current?.document_type?current.document_type:null,
      savedAt:Date.now()
    };
  }

  function saveRoute(){
    // Unsaved new documents cannot be safely reconstructed after a full refresh.
    // Keep the user in the appropriate document list instead of falsely restoring a draft.
    if(S.view==='editor'&&!S.current?.id){
      safeWrite({
        view:'documents',
        filter:S.current?.document_type||S.filter||'all',
        documentId:null,
        documentType:S.current?.document_type||null,
        savedAt:Date.now()
      });
      return;
    }
    safeWrite(snapshot());
  }

  function restoreRoute(){
    if(restored||S.loading) return;
    restored=true;
    const saved=safeRead();
    if(!saved||!saved.view) return;

    if(saved.view==='editor'&&saved.documentId){
      const doc=(S.docs||[]).find(d=>d.id===saved.documentId&&!d.deleted_at);
      if(doc){
        S.view='editor';
        S.current=doc;
        S.filter=doc.document_type||saved.documentType||saved.filter||'all';
        S.search='';
        S.editorDirty=false;
        return;
      }
      S.view='documents';
      S.current=null;
      S.filter=saved.documentType||saved.filter||'all';
      return;
    }

    const allowed=new Set(['dashboard','documents','customers','settings','trash','supply-usage']);
    if(allowed.has(saved.view)){
      S.view=saved.view;
      S.current=null;
      if(saved.view==='documents') S.filter=saved.filter||'all';
    }
  }

  const previousRender=render;
  render=function(){
    restoreRoute();
    const result=previousRender.apply(this,arguments);
    if(!S.loading) saveRoute();
    return result;
  };

  // Save once more just before a refresh/tab close so the latest editor/document wins.
  window.addEventListener('beforeunload',saveRoute);
  window.addEventListener('pagehide',saveRoute);
})();
