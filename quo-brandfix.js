/* Quo v18 branding fix: supplied White Saffron WS logo, business name visible, customer PDF audit line hidden. */

const QUO_BRAND_LOGO_URL='./assets/white-saffron-logo.svg?v=17';

function quoBrandApplySidebarLogo(){
  const mark=document.querySelector('.side-brand .mark');
  if(!mark)return;
  let img=mark.querySelector('img');
  if(!img){
    mark.textContent='';
    img=document.createElement('img');
    img.alt='White Saffron';
    mark.appendChild(img);
  }
  img.src=QUO_BRAND_LOGO_URL;
}

function quoBrandApplyPdfLogo(){
  document.querySelectorAll('#printRoot .pdf-company').forEach(company=>{
    company.classList.remove('has-logo');
    company.classList.add('quo-brand-company');
    company.querySelectorAll('.pdf-logo,.quo-pdf-logo').forEach(el=>el.remove());
    const logo=document.createElement('img');
    logo.className='quo-pdf-logo';
    logo.src=QUO_BRAND_LOGO_URL;
    logo.alt='White Saffron';
    company.insertAdjacentElement('afterbegin',logo);
  });
}

function quoBrandRemoveCustomerAudit(){
  document.querySelectorAll('#printRoot .pdf-audit').forEach(el=>el.remove());
}

const _quoBrandRenderPrint=renderPrint;
renderPrint=function(d){
  _quoBrandRenderPrint(d);
  quoBrandApplyPdfLogo();
  quoBrandRemoveCustomerAudit();
};

const _quoBrandBindDynamic=bindDynamic;
bindDynamic=function(){
  _quoBrandBindDynamic();
  quoBrandApplySidebarLogo();
};

if(!document.getElementById('quoBrandFixStyle')){
  const st=document.createElement('style');
  st.id='quoBrandFixStyle';
  st.textContent=`
    .side-brand .mark img{width:100%;height:100%;display:block;object-fit:contain}
    .pdf-audit{display:none!important}

    .pdf-company.quo-brand-company{
      display:grid!important;
      grid-template-columns:22mm minmax(0,1fr);
      grid-template-rows:auto auto;
      column-gap:4mm;
      align-items:center;
      min-width:82mm;
    }
    .pdf-company.quo-brand-company .quo-pdf-logo{
      grid-column:1;
      grid-row:1 / span 2;
      width:22mm;
      height:22mm;
      display:block;
      object-fit:contain;
      align-self:start;
    }
    .pdf-company.quo-brand-company h1{
      grid-column:2;
      grid-row:1;
      display:block!important;
      margin:1mm 0 0!important;
      font-family:Georgia,'Times New Roman',serif;
      font-size:16pt!important;
      line-height:1.05;
      color:#202a28;
    }
    .pdf-company.quo-brand-company p{
      grid-column:2;
      grid-row:2;
      margin:1.2mm 0 0!important;
      line-height:1.45;
    }
  `;
  document.head.appendChild(st);
}

quoBrandApplySidebarLogo();
if(S.current)render();
