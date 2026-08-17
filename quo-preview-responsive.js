/* Quo v36 - responsive live preview: always fit the full A4 page inside the preview pane. */
(function(){
  const observed=new WeakSet();
  const ro=new ResizeObserver(entries=>{
    entries.forEach(entry=>fitShell(entry.target));
  });

  function fitShell(shell){
    if(!shell||!shell.isConnected)return;
    const page=shell.querySelector('.preview-scale');
    if(!page)return;

    /* Let the shell take the entire available preview width, then scale the
       real A4 page to that width. This avoids the old fixed 397px preview
       being cropped when the right column is narrower. */
    shell.style.width='100%';
    shell.style.maxWidth='100%';
    shell.style.overflow='hidden';

    const available=Math.max(1,shell.clientWidth);
    const naturalW=page.offsetWidth||794;
    const naturalH=page.offsetHeight||1123;
    const scale=Math.min(1,available/naturalW);

    page.style.transform=`scale(${scale})`;
    page.style.transformOrigin='top left';
    shell.style.height=`${Math.ceil(naturalH*scale)}px`;
  }

  function attach(root=document){
    root.querySelectorAll?.('.preview-scale-shell').forEach(shell=>{
      if(!observed.has(shell)){
        observed.add(shell);
        ro.observe(shell);
      }
      requestAnimationFrame(()=>fitShell(shell));
    });
  }

  const mo=new MutationObserver(mutations=>{
    for(const m of mutations){
      for(const node of m.addedNodes){
        if(node.nodeType!==1)continue;
        if(node.matches?.('.preview-scale-shell'))attach(node.parentElement||document);
        else if(node.querySelector?.('.preview-scale-shell'))attach(node);
      }
    }
  });
  mo.observe(document.documentElement,{childList:true,subtree:true});

  window.addEventListener('resize',()=>attach(document));
  attach(document);

  const st=document.createElement('style');
  st.id='quoPreviewResponsiveV36';
  st.textContent=`
    /* Full page must fit inside the live preview column. */
    .preview-card{overflow-x:hidden!important}
    .preview-pages,.preview-page-wrap{width:100%!important;min-width:0!important}
    .preview-scale-shell{
      width:100%!important;
      max-width:100%!important;
      margin:0!important;
      height:auto;
      overflow:hidden!important;
      background:#fff;
    }
    .preview-scale{transform-origin:top left!important}

    /* Give the preview a little more useful desktop width while preserving
       the editor as the primary workspace. */
    @media(min-width:1280px){
      .editor-shell{grid-template-columns:minmax(620px,1fr) minmax(390px,430px)!important}
    }
    @media(max-width:1180px){
      .preview-card{width:100%!important;max-width:620px!important}
    }
  `;
  document.head.appendChild(st);
})();
