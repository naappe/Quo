/* Quo v46 - single preview authority with stall protection and render deduping. */
(function(){
  let previewTimer=null;
  let previewBusy=false;
  let previewQueued=false;
  let lastPreviewKey='';
  let fullPageIndex=0;
  const observedShells=new WeakSet();
  const fittedShells=new WeakMap();

  function previewKey(d){
    if(!d)return '';
    const s=typeof S!=='undefined'?S.settings||{}:{};
    try{
      return JSON.stringify([
        d.document_number,d.document_type,d.status,d.currency,d.creation_date,d.expires_on,
        d.customer_name,d.customer_phone,d.customer_address,d.event_name,d.service_enabled,d.service_type,
        d.service_from,d.service_to,d.service_pax,d.venue,d.items,d.gst_mode,d.gst_rate,d.discount,d.show_gst,
        d.include_menu,d.menu_title,d.menu_text,d.use_advance,d.advance_percent,d.advance_due,d.paid_amount,
        d.payment_reference,d.extra_terms,d.source_document_id,
        s.company_name,s.address,s.email,s.footer
      ]);
    }catch(e){return String(Date.now())}
  }

  function exactPreviewHTML(d){
    const root=$('#printRoot');if(!root)return '';
    const previous=root.innerHTML;
    try{renderPrint(d)}catch(e){console.warn('Preview render failed',e);return ''}
    const rendered=root.innerHTML;root.innerHTML=previous;
    const box=document.createElement('div');box.innerHTML=rendered;
    const pages=[...box.querySelectorAll('.pdf-page')];
    if(!pages.length)return '';
    return `<div class="preview-pages">${pages.map((page,i)=>`<section class="preview-page-wrap"><div class="preview-page-label"><span>PAGE ${i+1}</span><b>${i===0?'Document':'Menu Attachment'}</b></div><div class="preview-scale-shell"><div class="preview-scale">${page.outerHTML}</div></div></section>`).join('')}</div>`;
  }
  miniPreview=function(d){return exactPreviewHTML(d)};

  function refreshLivePreview(force=false){
    if(typeof S==='undefined'||S.view!=='editor'||!S.current)return;
    if(previewBusy){previewQueued=true;return;}
    try{readEditor?.()}catch(e){}
    const card=document.querySelector('.preview-card');if(!card)return;
    const key=previewKey(S.current);
    if(!force&&key===lastPreviewKey&&card.querySelector('.preview-pages'))return;

    previewBusy=true;
    try{
      const html=exactPreviewHTML(S.current);if(!html)return;
      const tmp=document.createElement('div');tmp.innerHTML=html;
      const fresh=tmp.firstElementChild;if(!fresh)return;
      const current=card.querySelector('.preview-pages,.paper-mini');
      if(current)current.replaceWith(fresh);else card.appendChild(fresh);
      lastPreviewKey=key;
      attachPreviewShells(fresh);
    }finally{
      previewBusy=false;
      if(previewQueued){previewQueued=false;schedulePreview(90,true)}
    }
  }

  function schedulePreview(delay=140,force=false){
    clearTimeout(previewTimer);
    previewTimer=setTimeout(()=>refreshLivePreview(force),delay);
  }

  renderEditorSoft=function(){
    const d=S.current;if(!d)return;
    try{readEditor?.()}catch(e){}
    const c=calc(d),total=$('.totals-mini b');if(total)total.textContent=money(c.total,d.currency);
    $$('[data-item]').forEach((row,i)=>{const a=row.querySelector('.amount');if(a)a.textContent=moneyOnly(num(d.items[i]?.qty)*num(d.items[i]?.price))});
    const ev=$('#eventFields');if(ev)ev.classList.toggle('hidden',!d.service_enabled);
    const mf=$('#menuFields');if(mf)mf.classList.toggle('hidden',!d.include_menu);
    const af=$('#advanceFields');if(af)af.classList.toggle('hidden',!d.use_advance);
    if(typeof updateEditorSaveState==='function')updateEditorSaveState();
    schedulePreview(110);
  };

  function fitShell(shell){
    if(!shell||!shell.isConnected)return;
    const page=shell.querySelector('.preview-scale');if(!page)return;
    const available=Math.max(1,shell.clientWidth),naturalW=page.offsetWidth||794,naturalH=page.offsetHeight||1123;
    const scale=Math.min(1,available/naturalW),height=Math.ceil(naturalH*scale);
    const previous=fittedShells.get(shell);
    if(previous&&Math.abs(previous.available-available)<1&&Math.abs(previous.scale-scale)<.001&&previous.height===height)return;
    fittedShells.set(shell,{available,scale,height});
    shell.style.width='100%';shell.style.maxWidth='100%';shell.style.overflow='hidden';
    page.style.transform=`scale(${scale})`;page.style.transformOrigin='top left';
    if(shell.style.height!==`${height}px`)shell.style.height=`${height}px`;
  }

  const resizeObserver=typeof ResizeObserver==='function'?new ResizeObserver(entries=>{
    entries.forEach(entry=>requestAnimationFrame(()=>fitShell(entry.target)));
  }):null;
  function attachPreviewShells(root=document){
    root.querySelectorAll?.('.preview-scale-shell').forEach(shell=>{
      if(!observedShells.has(shell)){observedShells.add(shell);resizeObserver?.observe(shell)}
      requestAnimationFrame(()=>fitShell(shell));
    });
  }

  function fullModal(){return document.getElementById('quoFullPreview')}
  function fullPages(){const m=fullModal();return m?[...m.querySelectorAll('.quo-full-preview-page')]:[]}
  function hardClosePreview(){
    const m=fullModal();if(m){m.classList.add('hidden');m.setAttribute('aria-hidden','true')}
    document.documentElement.classList.remove('quo-preview-open');document.body.classList.remove('quo-preview-open');document.documentElement.style.overflow='';document.body.style.overflow='';fullPageIndex=0;
  }
  function showFullPage(i){
    const list=fullPages();if(!list.length)return;
    fullPageIndex=Math.max(0,Math.min(i,list.length-1));list.forEach((p,n)=>p.classList.toggle('quo-page-current',n===fullPageIndex));
    const label=document.getElementById('quoPreviewPageCount');if(label)label.textContent=`Page ${fullPageIndex+1} of ${list.length}`;
    const prev=document.getElementById('quoPreviewPrev'),next=document.getElementById('quoPreviewNext');if(prev)prev.disabled=fullPageIndex===0;if(next)next.disabled=fullPageIndex===list.length-1;
  }
  function enhanceFullPreview(){
    const m=fullModal();if(!m||m.dataset.v44Preview==='1')return;
    m.dataset.v44Preview='1';m.setAttribute('aria-hidden',m.classList.contains('hidden')?'true':'false');
    const bar=document.createElement('div');bar.className='quo-preview-bottom-nav';bar.innerHTML='<button class="btn" id="quoPreviewBack" type="button">Back to Editor</button><div class="quo-preview-page-nav"><button class="btn" id="quoPreviewPrev" type="button">Previous</button><b id="quoPreviewPageCount">Page 1 of 1</b><button class="btn" id="quoPreviewNext" type="button">Next</button></div><button class="btn primary" id="quoPreviewDownload" type="button">Download PDF</button>';
    m.appendChild(bar);bar.querySelector('#quoPreviewBack').onclick=hardClosePreview;bar.querySelector('#quoPreviewPrev').onclick=()=>showFullPage(fullPageIndex-1);bar.querySelector('#quoPreviewNext').onclick=()=>showFullPage(fullPageIndex+1);bar.querySelector('#quoPreviewDownload').onclick=()=>{hardClosePreview();exportPDF?.()};
  }

  document.addEventListener('input',e=>{if(e.target.closest?.('[data-field],[data-item-field]'))schedulePreview(170)},true);
  document.addEventListener('change',e=>{if(e.target.closest?.('[data-field],[data-item-field]'))schedulePreview(80)},true);
  document.addEventListener('click',e=>{if(e.target.closest('[data-preview-close],#quoPreviewBack')){e.preventDefault();e.stopPropagation();hardClosePreview()}},true);
  document.addEventListener('keydown',e=>{const m=fullModal();if(!m||m.classList.contains('hidden'))return;if(e.key==='Escape'){e.preventDefault();hardClosePreview()}if(e.key==='ArrowLeft'){e.preventDefault();showFullPage(fullPageIndex-1)}if(e.key==='ArrowRight'){e.preventDefault();showFullPage(fullPageIndex+1)}},true);
  window.addEventListener('resize',()=>attachPreviewShells(document));

  const mutationObserver=new MutationObserver(mutations=>{
    let editorAdded=false;
    for(const m of mutations){for(const node of m.addedNodes){
      if(node.nodeType!==1)continue;
      if(node.matches?.('.preview-card')||node.querySelector?.('.preview-card'))editorAdded=true;
      if(node.matches?.('.preview-scale-shell')||node.querySelector?.('.preview-scale-shell'))attachPreviewShells(node.matches?.('.preview-scale-shell')?(node.parentElement||document):node);
    }}
    if(editorAdded){lastPreviewKey='';schedulePreview(60,true)}
    enhanceFullPreview();
    const modal=fullModal();if(modal&&!modal.classList.contains('hidden')&&fullPages().length)showFullPage(fullPageIndex);
  });
  mutationObserver.observe(document.documentElement,{childList:true,subtree:true});

  try{const previousOpen=openEditor;openEditor=function(){lastPreviewKey='';const result=previousOpen.apply(this,arguments);schedulePreview(70,true);return result}}catch(e){}
  try{const previousFull=openFullPreview;openFullPreview=function(){const result=previousFull.apply(this,arguments);setTimeout(()=>{enhanceFullPreview();showFullPage(0)},0);return result}}catch(e){}

  if(!document.getElementById('quoPreviewV46Style')){
    document.getElementById('quoPreviewV44Style')?.remove();
    const st=document.createElement('style');st.id='quoPreviewV46Style';st.textContent=`
      .preview-card{max-height:calc(100vh - 104px);overflow-y:auto!important;overflow-x:hidden!important;scrollbar-width:thin}.preview-toolbar{position:sticky;top:-12px;z-index:4;background:#e9edeb;padding:3px 0 8px;margin-bottom:0}.preview-pages{display:flex;flex-direction:column;gap:16px;padding-top:8px;width:100%;min-width:0}.preview-page-wrap{display:block;width:100%;min-width:0}.preview-page-label{display:flex;align-items:center;gap:7px;margin:0 2px 6px;color:#65706d;font-size:8px;text-transform:uppercase;letter-spacing:.08em}.preview-page-label span{font-weight:900;color:var(--brand-dark)}.preview-page-label b{font-size:8px}.preview-scale-shell{width:100%!important;max-width:100%!important;margin:0!important;height:auto;overflow:hidden!important;background:#fff;box-shadow:0 8px 25px rgba(25,43,40,.10)}.preview-scale{width:210mm;height:297mm;transform-origin:top left!important}.preview-scale .pdf-page{box-shadow:none;margin:0;page-break-after:auto}
      .quo-full-preview{z-index:2147483600!important}.quo-full-preview-head{position:sticky;top:0;z-index:5}.quo-full-preview-scroll{overscroll-behavior:contain;-webkit-overflow-scrolling:touch}.quo-preview-bottom-nav{position:sticky;bottom:0;z-index:6;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;background:rgba(255,255,255,.98);border-top:1px solid #dfe3e5;box-shadow:0 -8px 24px rgba(20,24,27,.08);backdrop-filter:blur(12px)}.quo-preview-page-nav{display:flex;align-items:center;gap:8px}.quo-preview-page-nav b{min-width:92px;text-align:center;font-size:10px;color:#687074}.quo-preview-bottom-nav .btn{min-height:40px}
      @media(max-width:1180px){.preview-card{max-height:none;overflow:visible!important;width:100%!important;max-width:620px!important}}
      @media(max-width:760px){.quo-full-preview-scroll{padding:8px 6px 74px!important;overflow-y:auto!important;touch-action:pan-y!important}.quo-preview-bottom-nav{position:fixed;left:0;right:0;bottom:0;padding:8px max(8px,env(safe-area-inset-right)) max(8px,env(safe-area-inset-bottom)) max(8px,env(safe-area-inset-left));gap:5px}.quo-preview-bottom-nav .btn{padding:9px 8px;font-size:10px;flex:1}.quo-preview-page-nav{display:flex;flex:2;gap:4px}.quo-preview-page-nav .btn{flex:1}.quo-preview-page-nav b{min-width:58px;font-size:9px}.quo-full-preview-page{display:none!important}.quo-full-preview-page.quo-page-current{display:block!important}}
    `;document.head.appendChild(st);
  }

  window.quoRefreshLivePreview=()=>schedulePreview(0,true);
  attachPreviewShells(document);enhanceFullPreview();schedulePreview(90,true);
})();