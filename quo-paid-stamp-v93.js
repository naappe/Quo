/* Quo v93 - customer-facing paid invoice stamp. */
(function(){
  if(typeof S==='undefined')return;
  const EPS=.005;
  const STAMP='./assets/white-saffron-logo.png?v=93';

  function isPaidInvoice(d){
    if(!d||d.document_type!=='invoice')return false;
    try{
      const c=calc(d);
      return Number(c.total||0)>EPS&&Number(c.balance||0)<=EPS;
    }catch(e){
      return String(d.payment_status||'')==='Paid';
    }
  }

  function addStamp(root,d){
    if(!root||!isPaidInvoice(d))return;
    root.querySelectorAll('.pdf-page').forEach(page=>{
      const status=page.querySelector('.pdf-doc .status');
      if(status){status.textContent='PAID';status.classList.add('quo-paid-red-v93')}
      if(page.querySelector('.quo-paid-stamp-v93'))return;
      const stamp=document.createElement('div');
      stamp.className='quo-paid-stamp-v93';
      stamp.innerHTML=`<img src="${STAMP}" alt="White Saffron"><strong>PAID</strong>`;
      page.appendChild(stamp);
    });
  }

  try{
    const previousPrint=renderPrint;
    renderPrint=function(d){
      const result=previousPrint.apply(this,arguments);
      addStamp(document.getElementById('printRoot'),d);
      return result;
    };
  }catch(e){}

  function paintEditorPaid(){
    if(S.view!=='editor'||!isPaidInvoice(S.current))return;
    document.querySelectorAll('.doc-title-row .badge,.preview-toolbar .badge').forEach(b=>{
      b.textContent='Paid';
      b.classList.add('quo-paid-red-v93');
    });
  }

  try{
    const previousBind=bindDynamic;
    bindDynamic=function(){
      const result=previousBind.apply(this,arguments);
      paintEditorPaid();
      return result;
    };
  }catch(e){}

  if(!document.getElementById('quoPaidStampV93Style')){
    const st=document.createElement('style');
    st.id='quoPaidStampV93Style';
    st.textContent=`
      .quo-paid-stamp-v93{position:absolute;right:14mm;top:46mm;width:31mm;padding:2.2mm 2mm 1.8mm;border:1.15mm solid #c62828;border-radius:2.2mm;background:rgba(255,255,255,.92);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1mm;transform:rotate(-7deg);z-index:12;box-sizing:border-box;pointer-events:none}
      .quo-paid-stamp-v93 img{display:block;width:22mm;height:auto;max-height:22mm;object-fit:contain;filter:sepia(1) saturate(4) hue-rotate(165deg) brightness(.72) contrast(1.05)}
      .quo-paid-stamp-v93 strong{display:block;color:#c62828;font-family:Arial,Helvetica,sans-serif;font-size:8mm;line-height:.88;letter-spacing:.8mm;font-weight:900;border-top:.65mm solid #c62828;padding-top:1.1mm;width:100%;text-align:center}
      .quo-paid-red-v93{background:#fff1f1!important;color:#b42318!important;border-color:#efb2ad!important}
      .pdf-doc .status.quo-paid-red-v93{background:#fff1f1!important;color:#b42318!important;border:1px solid #efb2ad!important}
      .badge.paid,.payment-paid{color:#b42318!important}
      @media screen and (max-width:760px){.quo-paid-stamp-v93{right:10mm;top:43mm}}
    `;
    document.head.appendChild(st);
  }

  paintEditorPaid();
})();
