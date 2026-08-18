/* Quo v65 final audit patch: accurate labels for multi-page document and menu previews. */
(function(){
  function pageKind(page,index){
    if(!page)return index===0?'Document':'Document Continued';
    if(page.classList.contains('q26-menu')){
      const continued=/continued/i.test(page.querySelector('.q26-menu-title span')?.textContent||'');
      return continued?'Menu Continued':'Menu Attachment';
    }
    return page.querySelector('.q64-continuation-label')?'Document Continued':'Document';
  }

  function relabel(root=document){
    root.querySelectorAll?.('.preview-page-wrap').forEach((wrap,index)=>{
      const page=wrap.querySelector('.pdf-page');
      const label=wrap.querySelector('.preview-page-label b');
      if(!label)return;
      const wanted=pageKind(page,index);
      if(label.textContent!==wanted)label.textContent=wanted;
    });

    const modal=document.getElementById('quoFullPreview');
    modal?.querySelectorAll('.quo-full-preview-page').forEach((wrap,index)=>{
      const page=wrap.querySelector('.pdf-page');
      const label=wrap.querySelector('.quo-full-page-label');
      if(!label)return;
      const kind=pageKind(page,index);
      const suffix=kind==='Document'?'':kind==='Document Continued'?' - CONTINUED':kind==='Menu Continued'?' - MENU CONTINUED':' - MENU';
      const wanted=`PAGE ${index+1}${suffix}`;
      if(label.textContent.trim()!==wanted)label.textContent=wanted;
    });
  }

  let queued=false;
  function schedule(){
    if(queued)return;
    queued=true;
    requestAnimationFrame(()=>{queued=false;relabel(document)});
  }

  const observer=new MutationObserver(mutations=>{
    for(const mutation of mutations){
      for(const node of mutation.addedNodes){
        if(node.nodeType!==1)continue;
        if(node.matches?.('.preview-pages,.quo-full-preview-page,.preview-page-wrap')||node.querySelector?.('.preview-page-wrap,.quo-full-preview-page')){
          schedule();
          return;
        }
      }
    }
  });
  observer.observe(document.body,{childList:true,subtree:true});
  document.addEventListener('click',e=>{if(e.target.closest?.('[data-full-preview]'))setTimeout(schedule,0)},true);

  window.quoRelabelPreviewPages=schedule;
  window.QUO_FINAL_AUDIT_VERSION='65';
  schedule();
})();
