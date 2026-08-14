/* Quo v14 runtime reliability: clear automatic numbering, full PDF preview, reliable export, White Saffron logo. */

const QUO_LOGO_URL='./assets/white-saffron-logo.png?v=14';

function quoAutoNumberLabel(type){
  const p={quotation:'QT',proforma:'PI',invoice:'INV',receipt:'RC'}[type]||'DOC';
  return `${p} - AUTO ON SAVE`;
}

/* Show the document type before first save without consuming a real number. */
const _quoRuntimeBlankDoc=blankDoc;
blankDoc=function(type='quotation',copy=null){
  const d=_quoRuntimeBlankDoc(type,copy);
  if(d&&!d.id)d.document_number=quoAutoNumberLabel(type);
  return d;
};

/* Make first-save numbering explicit and add full preview. */
const _quoRuntimeRenderEditor=renderEditor;
renderEditor=function(){
  let html=_quoRuntimeRenderEditor();
  const d=S.current;
  if(!d)return html;

  if(!html.includes('data-full-preview')){
    html=html.replace(
      '<button class="btn" data-pdf>Export PDF</button>',
      '<button class="btn" data-full-preview>Preview PDF</button><button class="btn" data-pdf>Export PDF</button>'
    );
  }

  if(!d.id){
    if(!d.document_number||/^(NEW|.*AUTO.*)$/i.test(String(d.document_number)))d.document_number=quoAutoNumberLabel(d.document_type);
    html=html.replace(/<button class="btn primary" data-save>Save<\/button>/,'<button class="btn primary" data-save>Save & Number</button>');
    html=html.replace(/(<div class="field"><label>Number<\/label><input value="[^"]*" readonly><\/div>)/,
      `$1<div class="number-hint runtime-number-hint">Permanent ${esc(CFG[d.document_type]?.label||'document')} number is assigned automatically on first save.</div>`);
  }
  return html;
};

/* Keep the DB trigger as the authority, then verify the permanent number came back. */
const _quoRuntimeSaveCurrent=saveCurrent;
saveCurrent=async function(showToast=true){
  readEditor();
  const d=S.current;
  if(!d)return false;
  if(!d.id&&!d.creation_date){
    alert(`Set the Issue Date first. It stays manual. Quo uses its year to create the automatic ${CFG[d.document_type]?.label||'document'} number.`);
    document.querySelector('[data-field="creation_date"]')?.focus();
    return false;
  }

  const ok=await _quoRuntimeSaveCurrent(false);
  if(!ok)return false;

  if(S.current?.id&&(!S.current.document_number||/NEW|AUTO ON SAVE/i.test(String(S.current.document_number)))){
    const r=await sb.from('quo_documents').select('*').eq('id',S.current.id).single();
    if(!r.error&&r.data)S.current={...S.current,...r.data};
  }

  if(!S.current?.document_number||/NEW|AUTO ON SAVE/i.test(String(S.current.document_number))){
    alert('The document was saved, but Quo could not read its permanent number. Reopen the document and try again.');
    return false;
  }

  if(showToast)toast(`${S.current.document_number} saved`);
  render();
  return true;
};

/* Add the real White Saffron logo to both the app and customer-facing PDF. */
function quoApplySidebarLogo(){
  const mark=document.querySelector('.side-brand .mark');
  if(mark&&!mark.querySelector('img'))mark.innerHTML=`<img src="${QUO_LOGO_URL}" alt="White Saffron">`;
}
quoApplySidebarLogo();

const _quoRuntimeRenderPrint=renderPrint;
renderPrint=function(d){
  _quoRuntimeRenderPrint(d);
  document.querySelectorAll('#printRoot .pdf-company').forEach(company=>{
    if(company.querySelector('.pdf-logo'))return;
    company.classList.add('has-logo');
    company.insertAdjacentHTML('afterbegin',`<img class="pdf-logo" src="${QUO_LOGO_URL}" alt="White Saffron">`);
  });
};

function quoSafeFilePart(v){
  return String(v||'document').replace(/[\\/:*?"<>|]+/g,'-').replace(/\s+/g,' ').trim()||'document';
}

function quoPopupPrintHTML(title,bodyHTML){
  const cssURL=new URL('./quo-doc.css?v=4',location.href).href;
  const absoluteLogo=new URL(QUO_LOGO_URL,location.href).href;
  const body=String(bodyHTML).replaceAll(QUO_LOGO_URL,absoluteLogo);
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><link rel="stylesheet" href="${cssURL}"><style>@page{size:A4;margin:0}html,body{margin:0;padding:0;background:#fff}.pdf-page{margin:0!important;box-shadow:none!important}.pdf-logo{width:28mm;max-height:23mm;object-fit:contain;object-position:left top;display:block;margin:0 0 1.5mm}.pdf-company.has-logo h1{display:none}</style></head><body>${body}</body></html>`;
}

function quoEnsurePreviewModal(){
  let modal=document.getElementById('quoFullPreview');
  if(modal)return modal;
  modal=document.createElement('div');
  modal.id='quoFullPreview';
  modal.className='quo-full-preview hidden';
  modal.innerHTML=`
    <div class="quo-full-preview-head">
      <div class="quo-full-preview-title">
        <span>PDF PREVIEW</span>
        <strong id="quoPreviewName">Document</strong>
        <small id="quoPreviewMeta"></small>
      </div>
      <div class="quo-full-preview-actions">
        <button class="btn" type="button" data-preview-close>Close</button>
        <button class="btn primary" type="button" data-preview-export>Export PDF</button>
      </div>
    </div>
    <div class="quo-full-preview-scroll">
      <div class="quo-full-preview-pages" id="quoFullPreviewPages"></div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click',e=>{
    if(e.target.closest('[data-preview-close]'))closeFullPreview();
    if(e.target.closest('[data-preview-export]')){closeFullPreview();exportPDF();}
  });
  return modal;
}

function closeFullPreview(){
  const modal=document.getElementById('quoFullPreview');
  if(modal)modal.classList.add('hidden');
  document.documentElement.classList.remove('quo-preview-open');
}

function openFullPreview(){
  readEditor();
  const d=S.current;
  if(!d)return alert('Open a document before previewing.');

  renderPrint(d);
  const root=document.getElementById('printRoot');
  const pages=root?[...root.querySelectorAll('.pdf-page')]:[];
  if(!pages.length)return alert('Could not prepare the PDF preview. Refresh Quo and try again.');

  const modal=quoEnsurePreviewModal();
  const target=modal.querySelector('#quoFullPreviewPages');
  const title=CFG[d.document_type]?.label||'Document';
  modal.querySelector('#quoPreviewName').textContent=`${title} - ${d.document_number||quoAutoNumberLabel(d.document_type)}`;
  modal.querySelector('#quoPreviewMeta').textContent=`${d.customer_name||'No customer'} | ${pages.length} page${pages.length===1?'':'s'} | A4`;
  target.innerHTML=pages.map((page,i)=>`<section class="quo-full-preview-page"><div class="quo-full-page-label">PAGE ${i+1}${i===1?' - MENU':''}</div>${page.outerHTML}</section>`).join('');
  modal.classList.remove('hidden');
  document.documentElement.classList.add('quo-preview-open');
  modal.querySelector('.quo-full-preview-scroll').scrollTop=0;
}

/* Open the print window immediately on the click, before any async save work. */
exportPDF=async function(){
  readEditor();
  if(!S.current)return alert('Open a document before exporting.');
  if(!S.current.creation_date){
    alert('Set the Issue Date before exporting. The date remains manual and is required for the automatic document number.');
    document.querySelector('[data-field="creation_date"]')?.focus();
    return;
  }

  const printWindow=window.open('','quo-pdf-export','width=1050,height=800');
  if(!printWindow){
    alert('Your browser blocked the PDF window. Allow pop-ups for this Quo site, then click Export PDF again.');
    return;
  }
  printWindow.document.open();
  printWindow.document.write('<!doctype html><html><head><title>Preparing PDF...</title></head><body style="font-family:Arial,sans-serif;padding:32px;color:#333">Preparing document...</body></html>');
  printWindow.document.close();

  try{
    const ok=await saveCurrent(false);
    if(!ok){printWindow.close();return;}

    renderPrint(S.current);
    const root=document.querySelector('#printRoot');
    const pages=root?[...root.querySelectorAll('.pdf-page')]:[];
    if(!root||!pages.length){
      printWindow.close();
      alert('Could not prepare the PDF pages. Refresh Quo and try again.');
      return;
    }

    const expected=S.current.include_menu&&String(S.current.menu_text||'').trim()&&S.current.document_type!=='receipt'?2:1;
    if(pages.length<expected){
      printWindow.close();
      alert('The PDF is incomplete. Check the menu content and try again.');
      return;
    }

    const title=`${quoSafeFilePart(S.current.document_number)}-${quoSafeFilePart(S.current.customer_name)}`;
    const printable=quoPopupPrintHTML(title,root.innerHTML);
    printWindow.document.open();
    printWindow.document.write(printable);
    printWindow.document.close();
    printWindow.onafterprint=()=>{try{printWindow.close()}catch(_){}};

    const doPrint=()=>{
      const images=[...printWindow.document.images];
      if(!images.length||images.every(img=>img.complete)){
        setTimeout(()=>{try{printWindow.focus();printWindow.print()}catch(e){console.error(e)}},180);
        return;
      }
      let left=images.filter(img=>!img.complete).length;
      const done=()=>{left--;if(left<=0)setTimeout(()=>{try{printWindow.focus();printWindow.print()}catch(e){console.error(e)}},120)};
      images.filter(img=>!img.complete).forEach(img=>{img.addEventListener('load',done,{once:true});img.addEventListener('error',done,{once:true})});
      setTimeout(()=>{try{printWindow.focus();printWindow.print()}catch(e){console.error(e)}},1400);
    };
    if(printWindow.document.readyState==='complete')doPrint();else printWindow.addEventListener('load',doPrint,{once:true});
    toast(`Exporting ${S.current.document_number}`);
  }catch(e){
    console.error('PDF export failed',e);
    try{printWindow.close()}catch(_){}
    alert('PDF export failed: '+(e?.message||'Unknown error'));
  }
};

/* Rebind the final handlers after all earlier modules have rendered the editor. */
const _quoRuntimeBindDynamic=bindDynamic;
bindDynamic=function(){
  _quoRuntimeBindDynamic();
  quoApplySidebarLogo();
  const saveBtn=document.querySelector('[data-save]');
  if(saveBtn)saveBtn.onclick=e=>{e.preventDefault();saveCurrent(true)};
  const previewBtn=document.querySelector('[data-full-preview]');
  if(previewBtn)previewBtn.onclick=e=>{e.preventDefault();openFullPreview()};
  const pdfBtn=document.querySelector('[data-pdf]');
  if(pdfBtn)pdfBtn.onclick=e=>{e.preventDefault();exportPDF()};
};

document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&!document.getElementById('quoFullPreview')?.classList.contains('hidden'))closeFullPreview();
});

if(!document.getElementById('quoRuntimeStyle')){
  const st=document.createElement('style');
  st.id='quoRuntimeStyle';
  st.textContent=`
    .side-brand .mark{width:44px!important;height:38px!important;border-radius:7px!important;background:#fff!important;border:1px solid #eceeef!important;padding:2px!important;box-shadow:none!important;overflow:hidden}
    .side-brand .mark img{width:100%;height:100%;display:block;object-fit:contain}
    .runtime-number-hint{grid-column:1/-1;margin:-5px 0 0;font-size:8px;color:#8d9395}
    .pdf-logo{width:28mm;max-height:23mm;object-fit:contain;object-position:left top;display:block;margin:0 0 1.5mm}
    .pdf-company.has-logo h1{display:none}
    html.quo-preview-open,html.quo-preview-open body{overflow:hidden}
    .quo-full-preview{position:fixed;inset:0;z-index:1000;background:#eef0f1;display:flex;flex-direction:column;color:#25292b}
    .quo-full-preview.hidden{display:none!important}
    .quo-full-preview-head{height:58px;flex:0 0 58px;background:#fff;border-bottom:1px solid #dde1e3;display:flex;align-items:center;padding:0 18px;gap:16px}
    .quo-full-preview-title{min-width:0;margin-right:auto;display:flex;align-items:baseline;gap:10px}
    .quo-full-preview-title>span{font-size:8px;letter-spacing:.12em;font-weight:800;color:#8a9093}
    .quo-full-preview-title>strong{font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .quo-full-preview-title>small{font-size:9px;color:#7d8386;white-space:nowrap}
    .quo-full-preview-actions{display:flex;gap:7px}
    .quo-full-preview-scroll{flex:1;overflow:auto;padding:24px}
    .quo-full-preview-pages{display:flex;flex-direction:column;align-items:center;gap:24px}
    .quo-full-preview-page{position:relative}
    .quo-full-page-label{font-size:9px;letter-spacing:.08em;font-weight:800;color:#787f82;margin:0 0 7px 2px}
    .quo-full-preview-page>.pdf-page{margin:0!important;box-shadow:0 8px 28px rgba(20,24,27,.12)!important;page-break-after:auto!important}
    @media(max-width:900px){.quo-full-preview-head{height:auto;min-height:58px;flex-wrap:wrap;padding:9px 12px}.quo-full-preview-title{width:100%;flex-wrap:wrap;gap:5px 9px}.quo-full-preview-actions{width:100%}.quo-full-preview-actions .btn{flex:1}.quo-full-preview-scroll{padding:12px}.quo-full-preview-page{width:100%;overflow:auto}.quo-full-preview-page>.pdf-page{transform-origin:top left}}
  `;
  document.head.appendChild(st);
}

/* Refresh current screen so a freshly opened unsaved document uses the new label. */
if(S.current&&!S.current.id){
  S.current.document_number=quoAutoNumberLabel(S.current.document_type);
  render();
}