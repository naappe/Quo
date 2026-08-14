/* Quo v24 - adaptive page balance for sparse commercial documents. */
(function(){
  const previousRenderPrint=renderPrint;

  function closingCopy(d){
    if(d.document_type==='receipt')return 'Thank you for your payment.';
    if(d.document_type==='invoice')return 'Thank you for your business.';
    if(d.document_type==='proforma')return 'Payment and document references are shown above for easy processing.';
    return "Thank you for considering Cafe' White Saffron.";
  }

  function makeClose(d){
    const t=CFG[d.document_type];
    const dueLabel=t?.due&&d.expires_on?t.due:'Issue Date';
    const dueValue=t?.due&&d.expires_on?dateLong(d.expires_on):(dateLong(d.creation_date)||'Not set');
    return `<section class="q24-close">
      <div class="q24-close-title"><span>Document Summary</span><b>${esc(closingCopy(d))}</b></div>
      <div class="q24-close-grid">
        <div><span>Reference</span><strong>${esc(d.document_number)}</strong></div>
        <div><span>${esc(dueLabel)}</span><strong>${esc(dueValue)}</strong></div>
        <div><span>Contact</span><strong>Hotline ${esc(FIXED.hotline)}</strong><small>${esc(S.settings.email||defaultSettings.email)}</small></div>
        ${d.document_type==='receipt'?'':`<div><span>Payment Slip</span><strong>Viber ${esc(FIXED.viber)}</strong><small>Quote the document reference when sending.</small></div>`}
      </div>
    </section>`;
  }

  function balance(d){
    const page=document.querySelector('#printRoot .q23-main');
    if(!page)return;
    page.querySelectorAll('.q24-close').forEach(x=>x.remove());

    const items=(d.items||[]).filter(i=>String(i.description||'').trim());
    const hasTerms=!!String(d.extra_terms||'').trim();
    const score=items.length+(d.service_enabled?2:0)+(hasTerms?2:0)+(d.use_advance?2:0)+(d.document_type==='invoice'?2:0);
    const sparse=score<=4;
    page.classList.toggle('q24-sparse',sparse);
    page.classList.toggle('q24-very-sparse',sparse&&items.length<=1&&!d.service_enabled&&!hasTerms);

    if(sparse){
      const footer=page.querySelector('.q23-footer');
      if(footer)footer.insertAdjacentHTML('beforebegin',makeClose(d));
      else page.insertAdjacentHTML('beforeend',makeClose(d));
    }
  }

  renderPrint=function(d){
    previousRenderPrint(d);
    balance(d);
  };

  const st=document.createElement('style');
  st.id='quoDocumentBalanceV24';
  st.textContent=`
    .pdf-page.quo-v23.q24-sparse{
      height:297mm!important;
      min-height:297mm!important;
      display:flex!important;
      flex-direction:column!important;
      box-sizing:border-box!important;
    }
    .quo-v23.q24-sparse .q23-head,
    .quo-v23.q24-sparse .q23-info,
    .quo-v23.q24-sparse .q23-service,
    .quo-v23.q24-sparse .q23-table,
    .quo-v23.q24-sparse .q23-summary,
    .quo-v23.q24-sparse .q23-payment,
    .quo-v23.q24-sparse .q23-terms{flex:0 0 auto}

    .quo-v23.q24-sparse .q23-head{padding-bottom:6mm!important}
    .quo-v23.q24-sparse .q23-info{margin-top:5.5mm!important;padding:5mm 0!important}
    .quo-v23.q24-sparse .q23-table{margin-top:5mm!important}
    .quo-v23.q24-sparse .q23-table td{padding-top:4mm!important;padding-bottom:4mm!important}
    .quo-v23.q24-sparse .q23-summary{margin-top:5.5mm!important}

    .quo-v23.q24-sparse .q23-payment{
      margin-top:7mm!important;
      padding:4.5mm 4.5mm!important;
      border:1px solid #dfe7e4!important;
      background:#f7faf9!important;
    }
    .quo-v23.q24-sparse .q23-payment.compact{border-top:1px solid #dfe7e4!important}
    .quo-v23.q24-sparse .q23-payment .q23-section-title{margin-bottom:2.5mm}

    .quo-v23 .q24-close{
      margin-top:auto;
      margin-bottom:10mm;
      padding:5mm 0 0;
      border-top:1px solid #d9e1de;
    }
    .quo-v23 .q24-close-title{
      display:flex;
      align-items:baseline;
      justify-content:space-between;
      gap:8mm;
      margin-bottom:4mm;
    }
    .quo-v23 .q24-close-title span{
      font-size:6.3pt;
      letter-spacing:.13em;
      text-transform:uppercase;
      color:#5b6e69;
      font-weight:800;
    }
    .quo-v23 .q24-close-title b{
      font-family:Georgia,'Times New Roman',serif;
      font-size:10pt;
      color:#29423d;
      font-weight:700;
      text-align:right;
    }
    .quo-v23 .q24-close-grid{
      display:grid;
      grid-template-columns:1fr 1fr 1.15fr 1.15fr;
      border:1px solid #dfe7e4;
      background:#fbfcfc;
    }
    .quo-v23 .q24-close-grid>div{
      min-height:22mm;
      padding:4mm;
      border-right:1px solid #e3e9e7;
    }
    .quo-v23 .q24-close-grid>div:last-child{border-right:0}
    .quo-v23 .q24-close-grid span{
      display:block;
      font-size:5.9pt;
      letter-spacing:.08em;
      text-transform:uppercase;
      color:#79837f;
    }
    .quo-v23 .q24-close-grid strong{
      display:block;
      margin-top:1.6mm;
      font-size:8pt;
      line-height:1.3;
      color:#25302d;
    }
    .quo-v23 .q24-close-grid small{
      display:block;
      margin-top:1mm;
      font-size:6.3pt;
      line-height:1.35;
      color:#6a7471;
    }

    .quo-v23.q24-very-sparse .q23-brand img{width:22mm!important;height:22mm!important}
    .quo-v23.q24-very-sparse .q23-brand h1{font-size:16.5pt!important}
    .quo-v23.q24-very-sparse .q23-doc .type{font-size:27pt!important}
    .quo-v23.q24-very-sparse .q23-client h2{font-size:12.2pt!important}

    @media print{
      .pdf-page.quo-v23.q24-sparse{height:297mm!important;min-height:297mm!important}
    }
  `;
  document.head.appendChild(st);
})();
