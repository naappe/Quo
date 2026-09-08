/* Quo v102 - restrained image-led advertisement in spare menu-page space. */
(function(){
  const PHOTO='https://unsplash.com/photos/v2CrrVbgu2A/download?force=true&w=1200';

  function refineMenuAd(root,d){
    if(!root||!d||d.document_type!=='quotation')return;
    root.querySelectorAll('.q26-menu .q100-customer-ad').forEach(ad=>{
      if(ad.dataset.q102Done==='1')return;
      ad.dataset.q102Done='1';

      const kicker=ad.querySelector('.q100-ad-kicker')?.textContent||'White Saffron Catering';
      const headline=ad.querySelector('.q100-ad-copy h3')?.textContent||'Planning Your Next Event?';
      const copy=ad.querySelector('.q100-ad-copy p')?.textContent||'Keep White Saffron in mind for your next gathering, meeting or function.';
      const services=[...ad.querySelectorAll('.q100-ad-services span')].slice(0,4).map(x=>x.textContent.trim()).filter(Boolean);

      ad.classList.add('q102-visual-ad');
      ad.innerHTML=`
        <div class="q102-photo" aria-hidden="true">
          <img src="${PHOTO}" alt="" loading="eager" referrerpolicy="no-referrer">
        </div>
        <div class="q102-ad-body">
          <span class="q102-kicker">${kicker}</span>
          <h3>${headline}</h3>
          <p>${copy}</p>
          <div class="q102-services">${services.map(s=>`<span>${s}</span>`).join('')}</div>
          <div class="q102-contact"><b>9990453</b><span>Ask us for your next catering quotation</span></div>
        </div>`;
    });
  }

  try{
    const previousRenderPrint=renderPrint;
    renderPrint=function(d){
      const result=previousRenderPrint.apply(this,arguments);
      refineMenuAd(document.getElementById('printRoot'),d);
      return result;
    };
  }catch(e){console.warn('Quo v102 menu ad visual could not wrap renderer',e)}

  if(!document.getElementById('quoMenuAdVisualV102Style')){
    const st=document.createElement('style');
    st.id='quoMenuAdVisualV102Style';
    st.textContent=`
      .quo-v26 .q100-customer-ad.q102-visual-ad{display:grid!important;grid-template-columns:63mm 1fr!important;min-height:47mm!important;margin-top:9mm!important;padding:0!important;overflow:hidden!important;border:1px solid #d9dfdc!important;border-radius:2.5mm!important;background:#f8f7f4!important;color:#24312e!important;box-shadow:none!important}
      .quo-v26 .q100-customer-ad.q102-visual-ad:after{display:none!important}
      .quo-v26 .q102-photo{position:relative;min-height:47mm;overflow:hidden;background:#e8e5df}
      .quo-v26 .q102-photo:after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,rgba(20,30,27,.04),rgba(20,30,27,.16));pointer-events:none}
      .quo-v26 .q102-photo img{display:block;width:100%;height:100%;min-height:47mm;object-fit:cover;object-position:center;filter:saturate(.82) contrast(.94)}
      .quo-v26 .q102-ad-body{display:flex;flex-direction:column;justify-content:center;padding:5.5mm 6mm;min-width:0}
      .quo-v26 .q102-kicker{font-family:Arial,sans-serif;font-size:5.7pt;font-weight:850;letter-spacing:.15em;text-transform:uppercase;color:#6e5a43}
      .quo-v26 .q102-ad-body h3{margin:1.8mm 0 1.7mm;font-family:Georgia,'Times New Roman',serif;font-size:15.5pt;line-height:1.08;color:#26362f}
      .quo-v26 .q102-ad-body p{margin:0;max-width:102mm;font-size:7pt;line-height:1.45;color:#65706c}
      .quo-v26 .q102-services{display:flex;flex-wrap:wrap;gap:1.5mm;margin-top:3mm}
      .quo-v26 .q102-services span{padding:1.3mm 2mm;border:1px solid #ddd7ce;border-radius:99mm;font-family:Arial,sans-serif;font-size:5.5pt;font-weight:700;color:#5b5147;background:#fff}
      .quo-v26 .q102-contact{display:flex;align-items:baseline;gap:3mm;margin-top:3.5mm;padding-top:2.7mm;border-top:1px solid #dedbd5}
      .quo-v26 .q102-contact b{font-family:Georgia,'Times New Roman',serif;font-size:12pt;color:#6b4529}
      .quo-v26 .q102-contact span{font-size:6pt;color:#7b817e}
      @media print{
        .quo-v26 .q102-photo img{-webkit-print-color-adjust:exact;print-color-adjust:exact}
        .quo-v26 .q100-customer-ad.q102-visual-ad{-webkit-print-color-adjust:exact;print-color-adjust:exact}
      }
    `;
    document.head.appendChild(st);
  }
})();
