/* Quo v94 - single clean paid invoice stamp. */
(function(){
  if(typeof S==='undefined')return;
  const EPS=.005;
  const STAMP='./assets/white-saffron-paid-stamp.png?v=94';

  function isPaidInvoice(d){
    if(!d||d.document_type!=='invoice')return false;
    try{
      const c=calc(d);
      return Number(c.total||0)>EPS&&Number(c.balance||0)<=EPS;
    }catch(e){return String(d.payment_status||'')==='Paid'}
  }

  function cleanOldPaid(root){
    if(!root)return;
    root.querySelectorAll('.q43-doc-stamp.paid,.quo-paid-stamp-v93').forEach(el=>el.remove());
    root.querySelectorAll('.q43-payment-badge.paid').forEach(el=>el.remove());
  }

  function addStamp(root,d){
    cleanOldPaid(root);
    if(!root||!isPaidInvoice(d))return;
    const page=root.querySelector('.pdf-page.q26-main,.pdf-page');
    if(!page||page.querySelector('.quo-paid-stamp-v94'))return;
    const stamp=document.createElement('div');
    stamp.className='quo-paid-stamp-v94';
    stamp.innerHTML=`<img src="${STAMP}" alt="White Saffron"><strong>PAID</strong>`;
    page.appendChild(stamp);
  }

  try{
    const previousPrint=renderPrint;
    renderPrint=function(d){
      const result=previousPrint.apply(this,arguments);
      addStamp(document.getElementById('printRoot'),d);
      return result;
    };
  }catch(e){}

  function paintEditor(){
    if(S.view!=='editor'||!isPaidInvoice(S.current))return;
    document.querySelectorAll('.doc-title-row .badge,.preview-toolbar .badge').forEach(b=>{
      b.textContent='Paid';
      b.classList.add('quo-paid-red-v94');
    });
  }

  try{
    const previousBind=bindDynamic;
    bindDynamic=function(){const result=previousBind.apply(this,arguments);paintEditor();return result};
  }catch(e){}

  const old=document.getElementById('quoPaidStampV93Style');if(old)old.remove();
  if(!document.getElementById('quoPaidStampV94Style')){
    const st=document.createElement('style');
    st.id='quoPaidStampV94Style';
    st.textContent=`
      .q43-doc-stamp.paid{display:none!important}
      .q43-payment-badge.paid{display:none!important}
      .quo-paid-stamp-v93{display:none!important}
      .quo-paid-stamp-v94{position:absolute;right:18mm;top:176mm;width:32mm;min-height:35mm;padding:2.3mm 2.2mm 2mm;border:1mm solid #c62828;border-radius:2.4mm;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.2mm;transform:rotate(-6deg);z-index:12;box-sizing:border-box;pointer-events:none}
      .quo-paid-stamp-v94 img{display:block;width:22mm;height:22mm;object-fit:contain}
      .quo-paid-stamp-v94 strong{display:block;width:100%;padding-top:1.2mm;border-top:.65mm solid #c62828;color:#c62828;font-family:Arial,Helvetica,sans-serif;font-size:7.2mm;line-height:1;letter-spacing:.7mm;font-weight:900;text-align:center}
      .quo-paid-red-v94{background:#fff1f1!important;color:#b42318!important;border-color:#efb2ad!important}
      .badge.paid,.payment-paid{color:#b42318!important}
    `;
    document.head.appendChild(st);
  }
  paintEditor();
})();
