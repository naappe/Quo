const core=document.createElement('script');
core.src='app-core.js?v=2';

let pdfPreviewIndex=0;
let pdfReturnScroll=0;

function installPdfNavigation(){
  if(document.getElementById('pdfNav'))return;
  const nav=document.createElement('div');
  nav.id='pdfNav';
  nav.className='pdf-nav';
  nav.innerHTML=`
    <button class="pdf-nav-btn back" type="button" onclick="closePdfPreview()">Back to Editor</button>
    <div class="pdf-nav-pages">
      <button class="pdf-nav-btn" id="pdfPrev" type="button" onclick="pdfPrevPage()">Previous</button>
      <span class="pdf-page-label" id="pdfPageLabel">Page 1 of 1</span>
      <button class="pdf-nav-btn" id="pdfNext" type="button" onclick="pdfNextPage()">Next</button>
    </div>
    <button class="pdf-nav-btn print" type="button" onclick="printPdfNow()">Print / Save PDF</button>`;
  document.body.appendChild(nav);

  const style=document.createElement('style');
  style.id='pdfNavStyles';
  style.textContent=`
    .pdf-nav{display:none;position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:1200;width:min(900px,calc(100% - 20px));align-items:center;justify-content:space-between;gap:10px;padding:10px;background:rgba(255,255,255,.97);border:1px solid #dfe6e4;border-radius:14px;box-shadow:0 14px 40px rgba(25,43,42,.15);backdrop-filter:blur(16px)}
    .pdf-nav-pages{display:flex;align-items:center;justify-content:center;gap:8px;min-width:0}
    .pdf-nav-btn{border:1px solid #d2dcda;background:#fff;color:#273230;border-radius:9px;padding:9px 13px;font:700 12px Inter,Arial,sans-serif;cursor:pointer;white-space:nowrap}
    .pdf-nav-btn:hover{border-color:#95aaa5;background:#f8faf9}.pdf-nav-btn:disabled{opacity:.38;cursor:not-allowed}
    .pdf-nav-btn.back{background:#f4f7f6}.pdf-nav-btn.print{background:#2e6d65;border-color:#2e6d65;color:#fff}
    .pdf-page-label{min-width:128px;text-align:center;font:800 11px Inter,Arial,sans-serif;color:#53605d;white-space:nowrap}
    body.pdf-preview-mode{background:#dfe4e2;overflow-x:hidden}
    body.pdf-preview-mode .toolbar,body.pdf-preview-mode .editor{display:none!important}
    body.pdf-preview-mode .pdf-nav{display:flex}
    body.pdf-preview-mode .workspace{display:block!important;max-width:none!important;padding:86px 12px 30px!important}
    body.pdf-preview-mode .preview{overflow:visible!important;padding:0!important}
    body.pdf-preview-mode .preview .page{display:none!important;margin:0 auto 24px!important}
    body.pdf-preview-mode .preview .page.preview-active:not(.hidden){display:block!important;zoom:var(--pdf-zoom,1)}
    @media(max-width:680px){
      .pdf-nav{top:auto;bottom:10px;width:calc(100% - 16px);padding:8px;border-radius:13px;gap:6px}
      .pdf-nav-pages{flex:1;gap:5px}.pdf-nav-btn{padding:9px 10px;font-size:11px}.pdf-page-label{min-width:72px;font-size:10px}
      .pdf-nav-btn.back{font-size:0}.pdf-nav-btn.back:after{content:'Back';font-size:11px}
      .pdf-nav-btn.print{font-size:0}.pdf-nav-btn.print:after{content:'Save PDF';font-size:11px}
      body.pdf-preview-mode .workspace{padding:10px 4px 82px!important}
    }
    @media print{
      .pdf-nav{display:none!important}
      body.pdf-preview-mode{background:#fff!important}
      body.pdf-preview-mode .workspace{padding:0!important}
      body.pdf-preview-mode .preview .page:not(.hidden){display:block!important;zoom:1!important;margin:0!important}
      body.pdf-preview-mode .preview .page.hidden{display:none!important}
    }`;
  document.head.appendChild(style);

  const topPdfButton=[...document.querySelectorAll('.toolbar button')].find(b=>b.getAttribute('onclick')==='savePDF()');
  if(topPdfButton)topPdfButton.textContent='Preview PDF';
}

function pdfPages(){
  return [...document.querySelectorAll('.preview .page')].filter(p=>!p.classList.contains('hidden'));
}

function fitPdfPage(){
  const pages=pdfPages();
  const page=pages[pdfPreviewIndex];
  if(!page)return;
  document.documentElement.style.setProperty('--pdf-zoom','1');
  const available=Math.max(280,window.innerWidth-12);
  const width=page.offsetWidth||794;
  const scale=Math.min(1,available/width);
  document.documentElement.style.setProperty('--pdf-zoom',String(scale));
}

function showPdfPage(index){
  const pages=pdfPages();
  if(!pages.length)return;
  pdfPreviewIndex=Math.max(0,Math.min(index,pages.length-1));
  pages.forEach((p,i)=>p.classList.toggle('preview-active',i===pdfPreviewIndex));
  const active=pages[pdfPreviewIndex];
  const title=active?.id==='menuPage'?'Menu':'Document';
  const label=document.getElementById('pdfPageLabel');
  if(label)label.textContent=`${title} ${pdfPreviewIndex+1} of ${pages.length}`;
  const prev=document.getElementById('pdfPrev'),next=document.getElementById('pdfNext');
  if(prev)prev.disabled=pdfPreviewIndex===0;
  if(next)next.disabled=pdfPreviewIndex===pages.length-1;
  fitPdfPage();
  window.scrollTo({top:0,behavior:'smooth'});
}

window.openPdfPreview=function(){
  if(!s)return;
  render();
  pdfReturnScroll=window.scrollY;
  document.body.classList.add('pdf-preview-mode');
  showPdfPage(0);
};
window.closePdfPreview=function(){
  document.body.classList.remove('pdf-preview-mode');
  pdfPages().forEach(p=>p.classList.remove('preview-active'));
  document.documentElement.style.removeProperty('--pdf-zoom');
  setTimeout(()=>window.scrollTo({top:pdfReturnScroll,behavior:'smooth'}),0);
};
window.pdfPrevPage=function(){showPdfPage(pdfPreviewIndex-1)};
window.pdfNextPage=function(){showPdfPage(pdfPreviewIndex+1)};
window.printPdfNow=function(){
  if(!s)return;
  document.title=s.document_number.replace('/','-')+'-'+(s.customer_name||'document');
  window.print();
};
window.addEventListener('resize',()=>{if(document.body.classList.contains('pdf-preview-mode'))fitPdfPage()});
window.addEventListener('keydown',e=>{
  if(!document.body.classList.contains('pdf-preview-mode'))return;
  if(e.key==='Escape')closePdfPreview();
  if(e.key==='ArrowLeft')pdfPrevPage();
  if(e.key==='ArrowRight')pdfNextPage();
});

core.onload=async()=>{
  try{
    injectLogin=()=>{};
    if(!window.supabase){await new Promise((ok,fail)=>{const sc=document.createElement('script');sc.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';sc.onload=ok;sc.onerror=fail;document.head.appendChild(sc)})}
    const anonClient=window.supabase.createClient('https://tmupbruwmwlrmewhoodn.supabase.co','sb_publishable_LAn1liS2zqMqlB33IQJxIw_NbgWKix1',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
    const setNoAuth=()=>{
      sb=anonClient;
      me={id:null,email:null};
      userRole='passwordless';
      displayName=localStorage.getItem('quo_prepared_by')||'';
      document.getElementById('quoLogin')?.remove();
      document.querySelectorAll('#quoUser,.toolbar button').forEach(el=>{if(el.id==='quoUser'||el.textContent.trim()==='Sign out')el.remove()});
    };
    setNoAuth();
    [250,800,1800].forEach(ms=>setTimeout(setNoAuth,ms));

    let field=document.getElementById('preparedBy');
    if(!field){
      const docGrid=document.querySelector('.editor .section .formgrid');
      if(docGrid){
        const wrap=document.createElement('div');
        wrap.className='full';
        wrap.innerHTML='<label>Prepared By</label><input id="preparedBy" placeholder="Enter your name">';
        docGrid.appendChild(wrap);
        field=wrap.querySelector('input');
      }
    }
    if(field){
      field.value=displayName;
      field.addEventListener('input',()=>{displayName=field.value.trim();localStorage.setItem('quo_prepared_by',displayName);if(s&&!s.id)s.created_by_name=displayName;renderAudit?.()});
    }

    const originalRead=read;
    read=function(){originalRead();if(field){displayName=field.value.trim();localStorage.setItem('quo_prepared_by',displayName);if(s&&!s.id)s.created_by_name=displayName}};

    const oldFresh=fresh;
    fresh=function(type='quotation',copy=null){oldFresh(type,copy);if(s){s.created_by=null;s.updated_by=null;s.created_by_name=displayName||s.created_by_name||''}if(field)field.value=displayName};

    saveDoc=async function(show=true){
      setNoAuth();
      if(field){displayName=field.value.trim();localStorage.setItem('quo_prepared_by',displayName)}
      if(!displayName){alert('Please enter Prepared By before saving.');field?.focus();return false}
      try{
        read();state('Saving to Supabase...');
        if(!s.id){
          const nr=await sb.rpc('next_quo_document_number',{p_type:s.document_type});if(nr.error)throw nr.error;
          s.document_number=nr.data;
          const r=await sb.from('quo_documents').insert({...payload(),created_by:null,created_by_name:displayName,updated_by:null,updated_by_name:displayName}).select('*').single();if(r.error)throw r.error;s={...s,...r.data};
        }else{
          const p=payload();delete p.document_number;delete p.document_type;
          const r=await sb.from('quo_documents').update({...p,updated_by:null,updated_by_name:displayName}).eq('id',s.id).select('*').single();if(r.error)throw r.error;s={...s,...r.data};
        }
        bind();if(field)field.value=displayName;await loadDocs();state(`${s.document_number} saved`);if(show)toast(`${s.document_number} saved to Supabase`);return true;
      }catch(e){console.error(e);state('Save failed');alert('Save failed: '+e.message);return false}
    };

    savePDF=async function(){
      if(await saveDoc(false))openPdfPreview();
    };

    installPdfNavigation();

    setTimeout(async()=>{
      setNoAuth();
      await loadDocs();
      if(!s)fresh('quotation');
      else {if(field)field.value=displayName;state('Ready');}
    },350);
  }catch(e){console.error(e);alert('Could not start quotation system: '+e.message)}
};
document.head.appendChild(core);
