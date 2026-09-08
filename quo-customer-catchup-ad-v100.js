/* Quo v100 - customer catch-up brand advertisement for quotation menu pages. */
(function(){
  const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
  const escHtml=v=>String(v??'').replace(/[&<>'"]/g,ch=>({
    '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
  }[ch]));

  function adCopy(d){
    const text=[d?.customer_name,d?.event_name,d?.service_type,d?.menu_title,d?.menu_text,
      ...(Array.isArray(d?.items)?d.items.map(i=>i?.description):[])]
      .map(clean).filter(Boolean).join(' ').toLowerCase();

    if(/school|college|academy|students?|teachers?/.test(text)){
      return {
        eyebrow:'White Saffron Catering',
        headline:'Planning Your Next School Event?',
        copy:'From staff gatherings to student functions, we prepare practical catering menus around your occasion.',
        services:['School Functions','Staff Meals','Event Buffets','Refreshments']
      };
    }

    if(/pvt\s*ltd|private limited|company|corporate|office|trading|business|meeting|staff/.test(text)){
      return {
        eyebrow:'White Saffron Catering',
        headline:'Planning Your Next Team Event?',
        copy:'Keep White Saffron in mind for meetings, staff meals, office gatherings and corporate functions.',
        services:['Corporate Catering','Staff Meals','Meetings','Events & Functions']
      };
    }

    if(/wedding|engagement|birthday|anniversary|party|family/.test(text)){
      return {
        eyebrow:'White Saffron Catering',
        headline:'Make Your Next Celebration Delicious.',
        copy:'Tell us the occasion and guest count. We can prepare a catering menu to suit your next gathering.',
        services:['Private Functions','Celebrations','Buffet Catering','Custom Menus']
      };
    }

    return {
      eyebrow:'White Saffron Catering',
      headline:'Planning Your Next Event?',
      copy:'Good food makes the occasion easier. Keep White Saffron in mind for your next gathering, meeting or function.',
      services:['Buffet Catering','Events & Functions','Staff Meals','Custom Menus']
    };
  }

  function addAdvertisement(root,d){
    if(!root||!d||d.document_type!=='quotation')return;
    const ad=adCopy(d);

    root.querySelectorAll('.q26-menu').forEach(page=>{
      /* v99 was an upsell panel; v100 replaces it completely. */
      page.querySelectorAll('.q99-context-ad,.q100-customer-ad').forEach(el=>el.remove());
      const menu=page.querySelector('.q95-menu-sections');
      if(!menu)return;

      const section=document.createElement('section');
      section.className='q100-customer-ad';
      section.innerHTML=`
        <div class="q100-ad-kicker">${escHtml(ad.eyebrow)}</div>
        <div class="q100-ad-main">
          <div class="q100-ad-copy">
            <h3>${escHtml(ad.headline)}</h3>
            <p>${escHtml(ad.copy)}</p>
          </div>
          <div class="q100-ad-contact">
            <span>BOOK / ENQUIRE</span>
            <b>9990453</b>
            <small>White Saffron · Villimale</small>
          </div>
        </div>
        <div class="q100-ad-services">${ad.services.map(s=>`<span>${escHtml(s)}</span>`).join('')}</div>
        <div class="q100-ad-line"><b>Your next occasion deserves a menu made for it.</b><span>Ask us for a quotation.</span></div>`;

      menu.insertAdjacentElement('afterend',section);
    });
  }

  try{
    const previousRenderPrint=renderPrint;
    renderPrint=function(d){
      const result=previousRenderPrint.apply(this,arguments);
      addAdvertisement(document.getElementById('printRoot'),d);
      return result;
    };
  }catch(e){console.warn('Quo v100 customer advertisement could not wrap renderer',e)}

  if(!document.getElementById('quoCustomerAdV100Style')){
    const st=document.createElement('style');
    st.id='quoCustomerAdV100Style';
    st.textContent=`
      .quo-v26 .q100-customer-ad{position:relative;overflow:hidden;margin-top:10mm;padding:7mm 7.5mm 6mm;border-radius:3.2mm;background:#173f39;color:#fff;break-inside:avoid;page-break-inside:avoid}
      .quo-v26 .q100-customer-ad:after{content:'';position:absolute;width:64mm;height:64mm;right:-20mm;top:-28mm;border:11mm solid rgba(255,255,255,.055);border-radius:50%;pointer-events:none}
      .quo-v26 .q100-ad-kicker{position:relative;z-index:1;margin-bottom:3mm;font-family:Arial,sans-serif;font-size:6.1pt;font-weight:850;letter-spacing:.19em;text-transform:uppercase;color:#d7ebe5}
      .quo-v26 .q100-ad-main{position:relative;z-index:1;display:grid;grid-template-columns:1fr 42mm;gap:8mm;align-items:end}
      .quo-v26 .q100-ad-copy h3{max-width:110mm;margin:0;font-family:Georgia,'Times New Roman',serif;font-size:20pt;line-height:1.06;font-weight:700;color:#fff}
      .quo-v26 .q100-ad-copy p{max-width:116mm;margin:2.8mm 0 0;font-size:7.7pt;line-height:1.5;color:#d9e7e3}
      .quo-v26 .q100-ad-contact{padding-left:5mm;border-left:1px solid rgba(255,255,255,.25)}
      .quo-v26 .q100-ad-contact span{display:block;font-family:Arial,sans-serif;font-size:5.5pt;font-weight:850;letter-spacing:.14em;color:#bcd5cf}
      .quo-v26 .q100-ad-contact b{display:block;margin-top:1.5mm;font-family:Georgia,'Times New Roman',serif;font-size:17pt;line-height:1;color:#fff}
      .quo-v26 .q100-ad-contact small{display:block;margin-top:1.7mm;font-size:6.3pt;color:#d3e2de}
      .quo-v26 .q100-ad-services{position:relative;z-index:1;display:flex;flex-wrap:wrap;gap:2mm;margin-top:5mm;padding-top:4mm;border-top:1px solid rgba(255,255,255,.2)}
      .quo-v26 .q100-ad-services span{padding:2mm 2.7mm;border:1px solid rgba(255,255,255,.25);border-radius:99mm;font-family:Arial,sans-serif;font-size:6.1pt;font-weight:700;color:#eef7f4}
      .quo-v26 .q100-ad-line{position:relative;z-index:1;display:flex;justify-content:space-between;gap:8mm;margin-top:5mm;padding-top:3.5mm;border-top:1px solid rgba(255,255,255,.16);font-size:6.6pt;color:#d7e6e2}
      .quo-v26 .q100-ad-line b{font-weight:700;color:#fff}.quo-v26 .q100-ad-line span{white-space:nowrap}
      @media print{.quo-v26 .q100-customer-ad{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
    `;
    document.head.appendChild(st);
  }
})();
