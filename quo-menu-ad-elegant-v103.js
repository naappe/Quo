/* Quo v103 - elegant text-led customer advertisement for spare quotation menu-page space. */
(function(){
  const escHtml=v=>String(v??'').replace(/[&<>'"]/g,ch=>({
    '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
  }[ch]));

  function buildAdCopy(d){
    const text=[d?.customer_name,d?.event_name,d?.service_type,d?.menu_title,d?.menu_text,
      ...(Array.isArray(d?.items)?d.items.map(i=>i?.description):[])]
      .filter(Boolean).join(' ').toLowerCase();

    if(/pvt\s*ltd|private limited|company|corporate|office|trading|business|meeting|staff/.test(text)){
      return {
        eyebrow:'WHITE SAFFRON CATERING',
        headline:'Make the Next Team Occasion Easier.',
        intro:'From a working lunch to a larger company gathering, ask White Saffron to prepare a catering quotation around your guest count, service time and preferred menu.',
        occasions:['Office Meetings','Staff Meals','Corporate Functions','Team Gatherings'],
        services:['Buffet Menus','Custom Quotations','Refreshments','Event Catering'],
        note:'Planning another event? Send us the date, time and number of guests — we will help shape the menu.'
      };
    }

    if(/school|college|academy|students?|teachers?/.test(text)){
      return {
        eyebrow:'WHITE SAFFRON CATERING',
        headline:'Catering for the Next School Occasion.',
        intro:'For staff gatherings, school functions and organised meal service, ask us for a menu and quotation prepared around your schedule and guest count.',
        occasions:['School Functions','Staff Gatherings','Special Events','Group Meals'],
        services:['Buffet Menus','Refreshments','Custom Quotations','Event Catering'],
        note:'Have another date in mind? Share the event details and we can prepare the next quotation.'
      };
    }

    if(/wedding|engagement|birthday|anniversary|party|family/.test(text)){
      return {
        eyebrow:'WHITE SAFFRON CATERING',
        headline:'Good Food for the Moments You Remember.',
        intro:'For birthdays, family gatherings and private functions, ask us to prepare a catering quotation around the occasion, guest count and menu you have in mind.',
        occasions:['Birthdays','Family Gatherings','Private Functions','Celebrations'],
        services:['Buffet Menus','Refreshments','Custom Quotations','Event Catering'],
        note:'Tell us what you are planning next — we can help turn the details into a clear catering menu.'
      };
    }

    return {
      eyebrow:'WHITE SAFFRON CATERING',
      headline:'Planning Another Occasion?',
      intro:'Keep White Saffron in mind for your next gathering. Share the date, service time, guest count and menu idea, and ask us for a tailored catering quotation.',
      occasions:['Meetings','Staff Meals','Private Functions','Events'],
      services:['Buffet Menus','Refreshments','Custom Quotations','Event Catering'],
      note:'One message with your event details is enough to start the next quotation.'
    };
  }

  function enhance(root,d){
    if(!root||!d||d.document_type!=='quotation')return;
    const copy=buildAdCopy(d);

    root.querySelectorAll('.q26-menu').forEach(page=>{
      const ad=page.querySelector('.q100-customer-ad');
      if(!ad)return;
      ad.className='q100-customer-ad q103-elegant-ad';
      ad.removeAttribute('data-q102-done');
      ad.innerHTML=`
        <div class="q103-ornament q103-ornament-a" aria-hidden="true"></div>
        <div class="q103-ornament q103-ornament-b" aria-hidden="true"></div>
        <div class="q103-top">
          <span class="q103-eyebrow">${escHtml(copy.eyebrow)}</span>
          <span class="q103-mini">CATERING · EVENTS · FUNCTIONS</span>
        </div>
        <div class="q103-title-row">
          <div>
            <h3>${escHtml(copy.headline)}</h3>
            <p>${escHtml(copy.intro)}</p>
          </div>
          <div class="q103-contact">
            <small>BOOK / ENQUIRE</small>
            <b>9990453</b>
            <span>White Saffron · Villimale</span>
          </div>
        </div>
        <div class="q103-rule"><span>◆</span></div>
        <div class="q103-columns">
          <div class="q103-group">
            <small>IDEAL FOR</small>
            <div class="q103-list">${copy.occasions.map(x=>`<span>${escHtml(x)}</span>`).join('')}</div>
          </div>
          <div class="q103-group">
            <small>ASK US ABOUT</small>
            <div class="q103-list">${copy.services.map(x=>`<span>${escHtml(x)}</span>`).join('')}</div>
          </div>
        </div>
        <div class="q103-bottom">
          <p>${escHtml(copy.note)}</p>
          <b>Good food. Clear planning. One quotation at a time.</b>
        </div>`;
    });
  }

  try{
    const previousRenderPrint=renderPrint;
    renderPrint=function(d){
      const result=previousRenderPrint.apply(this,arguments);
      enhance(document.getElementById('printRoot'),d);
      return result;
    };
  }catch(e){console.warn('Quo v103 elegant menu advertisement could not wrap renderer',e)}

  if(!document.getElementById('quoMenuAdElegantV103Style')){
    const st=document.createElement('style');
    st.id='quoMenuAdElegantV103Style';
    st.textContent=`
      .quo-v26 .q103-elegant-ad{position:relative!important;display:block!important;overflow:hidden!important;margin-top:9mm!important;padding:7mm 7.5mm 6.5mm!important;border:1px solid #d8dfdc!important;border-radius:2.4mm!important;background:#fbfaf7!important;color:#25332f!important;box-shadow:none!important;break-inside:avoid!important;page-break-inside:avoid!important}
      .quo-v26 .q103-elegant-ad:before{content:'';position:absolute;inset:3mm;border:1px solid rgba(57,95,85,.12);pointer-events:none}
      .quo-v26 .q103-elegant-ad:after{display:none!important}
      .quo-v26 .q103-ornament{position:absolute;width:24mm;height:24mm;border:1px solid rgba(77,103,95,.16);border-radius:50%;pointer-events:none}
      .quo-v26 .q103-ornament:after{content:'';position:absolute;inset:4mm;border:1px solid rgba(77,103,95,.10);border-radius:50%}
      .quo-v26 .q103-ornament-a{right:-11mm;top:-12mm}.quo-v26 .q103-ornament-b{left:-13mm;bottom:-14mm}
      .quo-v26 .q103-top{position:relative;z-index:1;display:flex;align-items:center;justify-content:space-between;gap:6mm;padding-bottom:3mm}
      .quo-v26 .q103-eyebrow,.quo-v26 .q103-mini{font-family:Arial,sans-serif;font-weight:850;letter-spacing:.16em;text-transform:uppercase}
      .quo-v26 .q103-eyebrow{font-size:5.9pt;color:#6d5139}.quo-v26 .q103-mini{font-size:5pt;color:#8a928f;white-space:nowrap}
      .quo-v26 .q103-title-row{position:relative;z-index:1;display:grid;grid-template-columns:1fr 43mm;gap:9mm;align-items:end;padding-top:1mm}
      .quo-v26 .q103-title-row h3{max-width:115mm;margin:0;font-family:Georgia,'Times New Roman',serif;font-size:19pt;line-height:1.08;color:#1d3f37;font-weight:700}
      .quo-v26 .q103-title-row p{max-width:118mm;margin:2.5mm 0 0;font-size:7.2pt;line-height:1.55;color:#66716d}
      .quo-v26 .q103-contact{padding-left:5mm;border-left:1px solid #d8ddda}
      .quo-v26 .q103-contact small{display:block;font-family:Arial,sans-serif;font-size:5.2pt;font-weight:850;letter-spacing:.13em;color:#87908d}
      .quo-v26 .q103-contact b{display:block;margin-top:1.5mm;font-family:Georgia,'Times New Roman',serif;font-size:16pt;line-height:1;color:#6c472d}
      .quo-v26 .q103-contact span{display:block;margin-top:1.7mm;font-size:5.8pt;color:#7b8481}
      .quo-v26 .q103-rule{position:relative;z-index:1;display:flex;align-items:center;gap:3mm;margin:5mm 0 4.5mm;color:#8a6a50;font-size:5pt}
      .quo-v26 .q103-rule:before,.quo-v26 .q103-rule:after{content:'';height:1px;background:#d8ddda;flex:1}.quo-v26 .q103-rule span{transform:scale(.7)}
      .quo-v26 .q103-columns{position:relative;z-index:1;display:grid;grid-template-columns:1fr 1fr;gap:8mm}
      .quo-v26 .q103-group small{display:block;margin-bottom:2mm;font-family:Arial,sans-serif;font-size:5.2pt;font-weight:850;letter-spacing:.14em;color:#777f7c}
      .quo-v26 .q103-list{display:grid;grid-template-columns:1fr 1fr;gap:1.8mm 4mm}
      .quo-v26 .q103-list span{position:relative;padding-left:3mm;font-family:Georgia,'Times New Roman',serif;font-size:7.2pt;color:#35423e}
      .quo-v26 .q103-list span:before{content:'•';position:absolute;left:0;color:#8a6a50}
      .quo-v26 .q103-bottom{position:relative;z-index:1;display:flex;align-items:flex-end;justify-content:space-between;gap:8mm;margin-top:5mm;padding-top:3.5mm;border-top:1px solid #dfe3e1}
      .quo-v26 .q103-bottom p{max-width:118mm;margin:0;font-size:6.5pt;line-height:1.5;color:#707a76}
      .quo-v26 .q103-bottom b{max-width:58mm;font-family:Georgia,'Times New Roman',serif;font-size:7.3pt;line-height:1.35;text-align:right;color:#30453f}
      @media print{.quo-v26 .q103-elegant-ad{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
    `;
    document.head.appendChild(st);
  }
})();
