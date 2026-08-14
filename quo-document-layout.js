/* Quo v26 - canonical adaptive commercial document renderer. */
(function(){
  const brandLogo=typeof QUO_BRAND_LOGO_URL!=='undefined'?QUO_BRAND_LOGO_URL:'./assets/white-saffron-logo.svg?v=17';

  function row(label,value){
    if(!value)return '';
    return `<div class="q26-meta-row"><span>${esc(label)}</span><b>${esc(value)}</b></div>`;
  }

  function contactRow(label,value){
    if(!value)return '';
    return `<div class="q26-contact-row"><span>${esc(label)}</span><b>${esc(value)}</b></div>`;
  }

  function footer(d,page,total){
    return `<footer class="q26-footer"><span>${esc(S.settings.footer||defaultSettings.footer)}</span><span>${esc(d.document_number)} - Page ${page} of ${total}</span></footer>`;
  }

  function isSparse(d){
    const items=(d.items||[]).filter(i=>String(i.description||'').trim()).length;
    const terms=String(d.extra_terms||'').trim();
    return items<=2&&!terms&&!d.service_enabled;
  }

  function paymentBlock(d,c){
    if(d.document_type==='receipt'){
      return `<section class="q26-payment"><div class="q26-section-title">Payment Record</div><div class="q26-payment-grid two"><div><span>Amount Received</span><strong>${money(c.total,d.currency)}</strong></div><div><span>Related Document</span><strong>${esc(sourceNo(d.source_document_id)||'Standalone')}</strong>${d.payment_reference?`<small>Reference: ${esc(d.payment_reference)}</small>`:''}</div></div></section>`;
    }
    if(d.document_type==='invoice'){
      return `<section class="q26-payment"><div class="q26-section-title">Payment Instructions</div><div class="q26-payment-grid three"><div><span>Paid</span><strong>${money(c.paid,d.currency)}</strong></div><div><span>Balance Due</span><strong>${money(c.balance,d.currency)}</strong></div><div><span>Bank Transfer</span><strong>${esc(FIXED.bank)}</strong><small>Account No. ${esc(FIXED.account)}</small></div></div><div class="q26-payment-note"><span>Payment Slip</span><b>Send via Viber ${esc(FIXED.viber)}</b><em>Reference: ${esc(d.document_number)}</em></div></section>`;
    }
    if(d.use_advance){
      const adv=c.total*num(d.advance_percent)/100;
      return `<section class="q26-payment"><div class="q26-section-title">Payment Instructions</div><div class="q26-payment-grid three"><div><span>Advance Required</span><strong>${money(adv,d.currency)}</strong><small>${num(d.advance_percent)}% of total${d.advance_due?` - due ${esc(dateLong(d.advance_due))}`:''}</small></div><div><span>Remaining Balance</span><strong>${money(c.total-adv,d.currency)}</strong><small>Payable as agreed before service or delivery</small></div><div><span>Bank Transfer</span><strong>${esc(FIXED.bank)}</strong><small>Account No. ${esc(FIXED.account)}</small></div></div><div class="q26-payment-note"><span>Payment Slip</span><b>Send via Viber ${esc(FIXED.viber)}</b><em>Reference: ${esc(d.document_number)}</em></div></section>`;
    }
    return `<section class="q26-payment compact"><div class="q26-section-title">Payment Instructions</div><div class="q26-payment-grid two"><div><span>Bank Transfer</span><strong>${esc(FIXED.bank)}</strong><small>Account No. ${esc(FIXED.account)}</small></div><div><span>Payment Slip</span><strong>Viber ${esc(FIXED.viber)}</strong><small>Reference: ${esc(d.document_number)}</small></div></div></section>`;
  }

  function summaryTable(d,c){
    const base=d.gst_mode==='inclusive'?c.net:c.raw;
    const subLabel=d.gst_mode==='inclusive'?'Net Amount':'Subtotal';
    return `<table class="q26-summary"><tbody><tr><td>${subLabel}</td><td>${moneyOnly(base)}</td></tr>${c.discount?`<tr><td>Discount</td><td>${moneyOnly(c.discount)}</td></tr>`:''}${c.gst||d.show_gst?`<tr><td>GST @ ${num(d.gst_rate)}%</td><td>${moneyOnly(c.gst)}</td></tr>`:''}<tr class="grand"><td>Total (${esc(d.currency)})</td><td>${moneyOnly(c.total)}</td></tr></tbody></table>`;
  }

  function serviceStrip(d){
    if(!d.service_enabled)return '';
    const title=d.event_name||d.service_type||'Service';
    const when=period(d.service_from,d.service_to)||'Service dates not set';
    return `<section class="q26-service"><div><span>Service</span><b>${esc(title)}</b></div><div><span>Period</span><b>${esc(when)}</b></div>${d.venue?`<div><span>Venue</span><b>${esc(d.venue)}</b></div>`:''}<div class="pax"><span>Guests</span><b>${num(d.service_pax).toLocaleString()} Pax</b></div></section>`;
  }

  function thankYou(d){
    if(d.document_type==='receipt')return 'Thank you for your payment.';
    if(d.document_type==='invoice')return 'Thank you for your business.';
    return "Thank you for considering Cafe' White Saffron.";
  }

  function renderIdentity(d,t){
    const due=t?.due&&d.expires_on?row(t.due,dateLong(d.expires_on)):'';
    return `<section class="q26-info">
      <div class="q26-client">
        <div class="q26-eyebrow">Prepared For</div>
        <h2>${esc(d.customer_name||'Customer')}</h2>
        <div class="q26-client-meta">${contactRow('Contact',d.customer_phone)}${contactRow('Address',d.customer_address)}</div>
      </div>
      <div class="q26-details">
        <div class="q26-details-head"><div class="q26-eyebrow">Document Details</div><span class="q26-info-status">${esc(d.status||'Draft')}</span></div>
        <div class="q26-details-body">${row('Reference',d.document_number)}${row('Issue Date',dateLong(d.creation_date)||'Not set')}${due}</div>
      </div>
    </section>`;
  }

  function renderMain(d,pageCount){
    const c=calc(d),set=S.settings,t=CFG[d.document_type];
    const terms=String(d.extra_terms||'').trim();
    const sparse=isSparse(d)?' q26-sparse':'';
    return `<section class="pdf-page quo-v26 q26-main${sparse}"><div class="q26-topline"></div>
      <header class="q26-head">
        <div class="q26-brand"><img src="${esc(brandLogo)}" alt="White Saffron"><div><h1>${esc(set.company_name)}</h1><p>${esc(set.address)}<br>${esc(set.email)}<br>Hotline: ${esc(FIXED.hotline)}</p></div></div>
        <div class="q26-doc"><div class="type">${esc(pdfTypeTitle(d))}</div><div class="no">${esc(d.document_number)}</div></div>
      </header>
      ${renderIdentity(d,t)}
      ${serviceStrip(d)}
      <table class="q26-table"><colgroup><col style="width:5%"><col style="width:48%"><col style="width:9%"><col style="width:9%"><col style="width:13%"><col style="width:16%"></colgroup><thead><tr><th>#</th><th>Description</th><th>Qty</th><th>Unit</th><th class="num">Rate</th><th class="num">Amount</th></tr></thead><tbody>${(d.items||[]).map((i,n)=>`<tr><td>${n+1}</td><td><b>${esc(i.description||'')}</b></td><td>${num(i.qty).toLocaleString('en-US',{maximumFractionDigits:2})}</td><td>${esc(i.unit||'')}</td><td class="num">${moneyOnly(i.price)}</td><td class="num">${moneyOnly(num(i.qty)*num(i.price))}</td></tr>`).join('')}</tbody></table>
      ${summaryTable(d,c)}
      ${paymentBlock(d,c)}
      ${terms?`<section class="q26-terms"><div class="q26-section-title">Notes & Terms</div><p>${esc(terms)}</p></section>`:''}
      <div class="q26-closing"><strong>${esc(thankYou(d))}</strong><span>${esc(d.document_number)}${d.document_type==='receipt'?'':` - Hotline ${esc(FIXED.hotline)}`}</span></div>
      ${footer(d,1,pageCount)}
    </section>`;
  }

  function renderMenu(d,pageCount){
    if(!d.include_menu||!String(d.menu_text||'').trim()||d.document_type==='receipt')return '';
    const set=S.settings,days=parseMenu(d.menu_text);
    return `<section class="pdf-page quo-v26 q26-menu"><div class="q26-topline"></div>
      <header class="q26-menu-head"><div class="q26-brand compact"><img src="${esc(brandLogo)}" alt="White Saffron"><div><h1>${esc(set.company_name)}</h1><p>Catering Menu - Hotline: ${esc(FIXED.hotline)}</p></div></div><div class="q26-menu-ref">${esc(d.document_number)}</div></header>
      <div class="q26-menu-title"><span>Menu Attachment</span><h2>${esc(d.menu_title||'CATERING MENU')}</h2><p>${esc(d.customer_name||'')}${d.service_enabled&&period(d.service_from,d.service_to)?` - ${esc(period(d.service_from,d.service_to))}`:''}</p></div>
      <div class="q26-menu-grid">${days.map((day,i)=>{let dt=d.service_from?new Date(d.service_from+'T00:00:00'):null;if(dt)dt.setDate(dt.getDate()+i);const title=dt?`DAY ${i+1} - ${dateLong(dt.toISOString().slice(0,10)).toUpperCase()}`:`DAY ${i+1}`;return `<section class="q26-day"><header><small>Service Schedule</small><h3>${esc(title)}</h3></header>${day.meals.map(m=>`<div class="q26-meal"><div><b>${esc(m.name)}</b>${m.time?`<time>${esc(m.time)}</time>`:''}</div><p class="${/not required/i.test(m.items)?'off':''}">${esc(m.items)}</p></div>`).join('')}</section>`}).join('')}</div>
      ${footer(d,2,pageCount)}
    </section>`;
  }

  renderPrint=function(d){
    const hasMenu=!!(d.include_menu&&String(d.menu_text||'').trim()&&d.document_type!=='receipt');
    const pages=hasMenu?2:1;
    $('#printRoot').innerHTML=renderMain(d,pages)+renderMenu(d,pages);
  };

  if(!document.getElementById('quoDocumentV26Style')){
    const st=document.createElement('style');
    st.id='quoDocumentV26Style';
    st.textContent=`
      .pdf-page.quo-v26{padding:13mm 15mm 13mm!important;color:#202725!important;font-family:Arial,sans-serif!important;box-sizing:border-box!important}
      .quo-v26 .q26-topline{position:absolute;left:0;right:0;top:0;height:4.5mm;background:#285f58}
      .quo-v26 .q26-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12mm;margin-top:2mm;padding-bottom:4.5mm;border-bottom:1px solid #dfe4e2}
      .quo-v26 .q26-brand{display:flex;align-items:flex-start;gap:4mm;min-width:0}.quo-v26 .q26-brand img{width:20mm;height:20mm;object-fit:contain;flex:none}.quo-v26 .q26-brand h1{margin:1mm 0 0;font-family:Georgia,'Times New Roman',serif;font-size:15.5pt;line-height:1.05;color:#202725}.quo-v26 .q26-brand p{margin:1.5mm 0 0;font-size:7.2pt;line-height:1.45;color:#66716e}
      .quo-v26 .q26-doc{text-align:right;min-width:62mm}.quo-v26 .q26-doc .type{font-family:Georgia,'Times New Roman',serif;font-size:25pt;font-weight:700;line-height:1;color:#16211f}.quo-v26 .q26-doc .no{margin-top:2.2mm;font-size:8.5pt;font-weight:800}
      .quo-v26 .q26-info{display:grid;grid-template-columns:1.2fr .8fr;margin-top:5mm;border:1px solid #dfe5e3;background:#fff}
      .quo-v26 .q26-client,.quo-v26 .q26-details{padding:4.2mm 5mm;min-width:0}.quo-v26 .q26-details{border-left:1px solid #dfe5e3;background:#fafcfb}
      .quo-v26 .q26-eyebrow,.quo-v26 .q26-section-title{font-size:6.2pt;letter-spacing:.13em;text-transform:uppercase;color:#5b6e69;font-weight:800}
      .quo-v26 .q26-client h2{font-size:11.7pt;margin:2mm 0 0;line-height:1.18;color:#202725}.quo-v26 .q26-client-meta{margin-top:2.4mm;display:grid;gap:1.2mm}.quo-v26 .q26-contact-row{display:grid;grid-template-columns:16mm 1fr;gap:3mm;align-items:start;font-size:7.3pt}.quo-v26 .q26-contact-row span{text-transform:uppercase;letter-spacing:.05em;color:#7a8581;font-size:6pt}.quo-v26 .q26-contact-row b{font-weight:500;line-height:1.35;color:#515c59}
      .quo-v26 .q26-details-head{display:flex;align-items:center;justify-content:space-between;gap:4mm;padding-bottom:2.2mm;border-bottom:1px solid #e5e9e7}.quo-v26 .q26-info-status{display:inline-flex;align-items:center;padding:1mm 2.4mm;border-radius:99px;background:#edf6f3;color:#285f58;font-size:6.2pt;font-weight:800;white-space:nowrap}.quo-v26 .q26-details-body{padding-top:1mm}.quo-v26 .q26-meta-row{display:grid;grid-template-columns:23mm 1fr;gap:3mm;align-items:baseline;padding:1.4mm 0;border-bottom:1px solid #edf0ef}.quo-v26 .q26-meta-row:last-child{border-bottom:0}.quo-v26 .q26-meta-row span{text-transform:uppercase;letter-spacing:.05em;color:#727d79;font-size:6pt}.quo-v26 .q26-meta-row b{text-align:right;font-size:7.4pt;color:#25302d}
      .quo-v26 .q26-service{display:grid;grid-template-columns:1.15fr 1.3fr 1fr .72fr;gap:0;margin-top:4mm;border:1px solid #dce7e4;background:#f4f8f7}.quo-v26 .q26-service>div{padding:3mm 3.2mm;border-right:1px solid #dce7e4;min-width:0}.quo-v26 .q26-service>div:last-child{border-right:0}.quo-v26 .q26-service span{display:block;font-size:5.8pt;text-transform:uppercase;letter-spacing:.09em;color:#71807c}.quo-v26 .q26-service b{display:block;margin-top:1mm;font-size:7.5pt;line-height:1.3}.quo-v26 .q26-service .pax{text-align:right}
      .quo-v26 .q26-table{width:100%;border-collapse:collapse;margin-top:5mm;table-layout:fixed}.quo-v26 .q26-table th{background:#214f49;color:#fff;padding:2.7mm 2.2mm;font-size:6.6pt;text-transform:uppercase;letter-spacing:.03em;text-align:left}.quo-v26 .q26-table td{padding:3.3mm 2.2mm;border-bottom:1px solid #e3e7e6;font-size:7.7pt;vertical-align:top;line-height:1.35;overflow-wrap:anywhere}.quo-v26 .q26-table .num{text-align:right;font-variant-numeric:tabular-nums}.quo-v26 .q26-table td b{font-weight:700}
      .quo-v26 .q26-summary{width:74mm;margin:5mm 0 0 auto;border-collapse:collapse;border-top:1px solid #d8dfdd}.quo-v26 .q26-summary td{padding:2.4mm 3mm;font-size:7.7pt}.quo-v26 .q26-summary td:last-child{text-align:right;font-weight:800;font-variant-numeric:tabular-nums}.quo-v26 .q26-summary .grand{background:#eaf4f1;color:#183f39;border-top:1px solid #ceded9}.quo-v26 .q26-summary .grand td{padding-top:3.1mm;padding-bottom:3.1mm;font-size:10.7pt;font-weight:900}
      .quo-v26 .q26-payment{margin-top:6mm;padding:4mm 4.5mm;border:1px solid #dfe7e4;background:#f8faf9}.quo-v26 .q26-payment-grid{display:grid;gap:4mm;margin-top:2.8mm}.quo-v26 .q26-payment-grid.two{grid-template-columns:1fr 1fr}.quo-v26 .q26-payment-grid.three{grid-template-columns:1fr 1fr 1.2fr}.quo-v26 .q26-payment-grid>div{padding-right:3mm;border-right:1px solid #e4e8e7}.quo-v26 .q26-payment-grid>div:last-child{border-right:0}.quo-v26 .q26-payment-grid span,.quo-v26 .q26-payment-note span{display:block;font-size:6.1pt;text-transform:uppercase;letter-spacing:.08em;color:#76817e}.quo-v26 .q26-payment-grid strong{display:block;margin-top:1.2mm;font-size:9.4pt;line-height:1.25}.quo-v26 .q26-payment-grid small{display:block;margin-top:1mm;font-size:6.8pt;color:#66716e;line-height:1.35}.quo-v26 .q26-payment-note{display:grid;grid-template-columns:25mm 1fr auto;gap:4mm;align-items:center;margin-top:3mm;padding-top:2.7mm;border-top:1px solid #e1e7e5;font-size:7pt}.quo-v26 .q26-payment-note b{font-size:7.4pt}.quo-v26 .q26-payment-note em{font-style:normal;color:#65706d;font-size:6.8pt}
      .quo-v26 .q26-terms{margin-top:4.5mm;padding-top:3mm;border-top:1px solid #e1e5e4}.quo-v26 .q26-terms p{margin:2mm 0 0;font-size:7.4pt;line-height:1.5;white-space:pre-wrap;color:#46504d}
      .quo-v26 .q26-closing{display:flex;justify-content:space-between;align-items:flex-end;gap:8mm;margin-top:7mm;padding-top:4mm;border-top:1px solid #dfe4e2;color:#596360}.quo-v26 .q26-closing strong{font-family:Georgia,'Times New Roman',serif;font-size:10pt;color:#29423d}.quo-v26 .q26-closing span{font-size:6.7pt;text-align:right}
      .quo-v26.q26-sparse{height:297mm!important;min-height:297mm!important;display:flex!important;flex-direction:column!important}.quo-v26.q26-sparse .q26-head,.quo-v26.q26-sparse .q26-info,.quo-v26.q26-sparse .q26-table,.quo-v26.q26-sparse .q26-summary,.quo-v26.q26-sparse .q26-payment{flex:0 0 auto}.quo-v26.q26-sparse .q26-closing{margin-top:auto;margin-bottom:11mm}
      .quo-v26 .q26-footer{position:absolute;left:15mm;right:15mm;bottom:7mm;padding-top:2.5mm;border-top:1px solid #dfe4e2;display:flex;justify-content:space-between;gap:8mm;font-size:6.3pt;color:#78827f}.quo-v26 .q26-footer span:last-child{text-align:right;white-space:nowrap}
      .quo-v26 .q26-menu-head{display:flex;align-items:flex-start;justify-content:space-between;margin-top:2mm;padding-bottom:4mm;border-bottom:1px solid #dfe4e2}.quo-v26 .q26-brand.compact img{width:16mm;height:16mm}.quo-v26 .q26-brand.compact h1{font-size:13pt}.quo-v26 .q26-brand.compact p{font-size:6.7pt}.quo-v26 .q26-menu-ref{font-size:8pt;font-weight:800;padding-top:2mm}.quo-v26 .q26-menu-title{margin-top:8mm}.quo-v26 .q26-menu-title span{font-size:6.2pt;letter-spacing:.13em;text-transform:uppercase;color:#5b6e69;font-weight:800}.quo-v26 .q26-menu-title h2{font-family:Georgia,'Times New Roman',serif;font-size:23pt;margin:1.5mm 0 1mm}.quo-v26 .q26-menu-title p{font-size:8pt;color:#65706d;margin:0}.quo-v26 .q26-menu-grid{display:grid;grid-template-columns:1fr 1fr;gap:5mm;margin-top:6mm}.quo-v26 .q26-day{border:1px solid #dfe4e2}.quo-v26 .q26-day>header{background:#285f58;color:#fff;padding:3mm 3.5mm}.quo-v26 .q26-day>header small{font-size:5.8pt;text-transform:uppercase;letter-spacing:.1em;opacity:.8}.quo-v26 .q26-day>header h3{font-family:Georgia,'Times New Roman',serif;font-size:11.5pt;margin:1mm 0 0}.quo-v26 .q26-meal{display:grid;grid-template-columns:31mm 1fr;gap:3.5mm;padding:3mm 3.5mm;border-bottom:1px solid #e7eae9}.quo-v26 .q26-meal:last-child{border-bottom:0}.quo-v26 .q26-meal b{font-size:7.3pt}.quo-v26 .q26-meal time{display:block;margin-top:1mm;font-size:6pt;color:#7b8582}.quo-v26 .q26-meal p{font-size:7.3pt;line-height:1.45;margin:0}.quo-v26 .q26-meal p.off{color:#969d9b;font-style:italic}
      @media print{.pdf-page.quo-v26{page-break-after:always}.pdf-page.quo-v26:last-child{page-break-after:auto}}
    `;
    document.head.appendChild(st);
  }

  if(S.current&&S.view==='editor')renderEditorSoft?.();
})();
