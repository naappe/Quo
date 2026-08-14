/* Quo v13 runtime reliability: clear automatic numbering, save verification, reliable PDF export, White Saffron logo. */

const QUO_LOGO_URL='./assets/white-saffron-logo.png?v=13';

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

/* Make first-save numbering explicit in the editor. */
const _quoRuntimeRenderEditor=renderEditor;
renderEditor=function(){
  let html=_quoRuntimeRenderEditor();
  const d=S.current;
  if(!d)return html;
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
  const saveBtn=document.querySelector('[data-save]');
  if(saveBtn)saveBtn.onclick=e=>{e.preventDefault();saveCurrent(true)};
  const pdfBtn=document.querySelector('[data-pdf]');
  if(pdfBtn)pdfBtn.onclick=e=>{e.preventDefault();exportPDF()};
};

if(!document.getElementById('quoRuntimeStyle')){
  const st=document.createElement('style');
  st.id='quoRuntimeStyle';
  st.textContent=`
    .side-brand .mark{width:44px!important;height:38px!important;border-radius:7px!important;background:#fff!important;border:1px solid #eceeef!important;padding:2px!important;box-shadow:none!important;overflow:hidden}
    .side-brand .mark img{width:100%;height:100%;display:block;object-fit:contain}
    .runtime-number-hint{grid-column:1/-1;margin:-5px 0 0;font-size:8px;color:#8d9395}
    .pdf-logo{width:28mm;max-height:23mm;object-fit:contain;object-position:left top;display:block;margin:0 0 1.5mm}
    .pdf-company.has-logo h1{display:none}
  `;
  document.head.appendChild(st);
}

/* Refresh current screen so a freshly opened unsaved document uses the new label. */
if(S.current&&!S.current.id){
  S.current.document_number=quoAutoNumberLabel(S.current.document_type);
  render();
}
