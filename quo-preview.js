/* Quo v7 full live PDF preview: uses the same PDF renderer as Export PDF. */

function exactPreviewHTML(d){
  const root=$('#printRoot');
  if(!root)return '';
  const previous=root.innerHTML;
  renderPrint(d);
  const rendered=root.innerHTML;
  root.innerHTML=previous;
  const box=document.createElement('div');
  box.innerHTML=rendered;
  const pages=[...box.querySelectorAll('.pdf-page')];
  if(!pages.length)return '';
  return `<div class="preview-pages">${pages.map((page,i)=>`<section class="preview-page-wrap"><div class="preview-page-label"><span>PAGE ${i+1}</span><b>${i===0?'Document':'Menu Attachment'}</b></div><div class="preview-scale-shell"><div class="preview-scale">${page.outerHTML}</div></div></section>`).join('')}</div>`;
}

miniPreview=function(d){
  return exactPreviewHTML(d);
};

renderEditorSoft=function(){
  const d=S.current;if(!d)return;
  const c=calc(d);
  const total=$('.totals-mini b');if(total)total.textContent=money(c.total,d.currency);
  $$('[data-item]').forEach((row,i)=>{const a=row.querySelector('.amount');if(a)a.textContent=moneyOnly(num(d.items[i]?.qty)*num(d.items[i]?.price))});
  const preview=$('.preview-pages');
  if(preview){
    const tmp=document.createElement('div');
    tmp.innerHTML=miniPreview(d);
    if(tmp.firstElementChild)preview.replaceWith(tmp.firstElementChild);
  }
  const ev=$('#eventFields');if(ev)ev.classList.toggle('hidden',!d.service_enabled);
  const mf=$('#menuFields');if(mf)mf.classList.toggle('hidden',!d.include_menu);
  const af=$('#advanceFields');if(af)af.classList.toggle('hidden',!d.use_advance);
};

if(!document.getElementById('quoFullPreviewStyle')){
  const st=document.createElement('style');
  st.id='quoFullPreviewStyle';
  st.textContent=`
    .preview-card{max-height:calc(100vh - 104px);overflow:auto;scrollbar-width:thin}
    .preview-toolbar{position:sticky;top:-12px;z-index:4;background:#e9edeb;padding:3px 0 8px;margin-bottom:0}
    .preview-pages{display:flex;flex-direction:column;gap:16px;padding-top:8px}
    .preview-page-wrap{display:block}
    .preview-page-label{display:flex;align-items:center;gap:7px;margin:0 2px 6px;color:#65706d;font-size:8px;text-transform:uppercase;letter-spacing:.08em}
    .preview-page-label span{font-weight:900;color:var(--brand-dark)}
    .preview-page-label b{font-size:8px}
    .preview-scale-shell{width:397px;height:561px;max-width:100%;margin:0 auto;background:#fff;overflow:hidden;box-shadow:0 8px 25px rgba(25,43,40,.10)}
    .preview-scale{width:210mm;height:297mm;transform:scale(.5);transform-origin:top left}
    .preview-scale .pdf-page{box-shadow:none;margin:0;page-break-after:auto}
    @media(max-width:1180px){.preview-card{max-height:none;overflow:visible}.preview-scale-shell{width:397px}}
    @media(max-width:500px){.preview-scale-shell{width:318px;height:449px}.preview-scale{transform:scale(.4)}}
  `;
  document.head.appendChild(st);
}
