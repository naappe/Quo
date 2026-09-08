/* Quo v99 - context-aware quotation recommendation panel on catering menu pages. */
(function(){
  const clean=value=>String(value||'').replace(/\s+/g,' ').trim();
  const escHtml=value=>String(value??'').replace(/[&<>'"]/g,ch=>({
    '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
  }[ch]));

  function quoteText(d){
    return [
      d?.event_name,d?.service_type,d?.menu_title,d?.menu_text,d?.extra_terms,
      ...(Array.isArray(d?.items)?d.items.map(i=>i?.description):[])
    ].map(clean).filter(Boolean).join(' ').toLowerCase();
  }

  function has(text,words){return words.some(word=>text.includes(word))}

  function recommendations(d){
    const text=quoteText(d);
    const rec=[];
    const add=(title,copy,keys=[])=>{
      if(keys.length&&has(text,keys))return;
      if(!rec.some(x=>x.title===title))rec.push({title,copy});
    };

    const breakfast=has(text,['breakfast','morning coffee']);
    const buffet=has(text,['buffet','catering','dinner','lunch','meal','event']);

    if(breakfast){
      add('Fresh Fruit Selection','Add a light fruit option for a more complete breakfast service.',['fruit','banana','watermelon','papaya','pineapple']);
      add('Tea & Coffee Service','Hot beverages can be added for guests before or after the meal.',['tea','coffee','milo']);
      add('Juice Station','Add one or more chilled juice choices for the table.',['juice']);
      add('Service & Setup','We can arrange buffet setup and serving support for the event.',['serving staff','service staff','buffet setup']);
    }else if(buffet){
      add('Dessert Add-On','Finish the buffet with a simple dessert selection for your guests.',['dessert','custard','caramel','cake','pudding','ice cream','fruit salad']);
      add('Tea & Coffee Service','Add hot tea and coffee service after the meal.',['tea','coffee','milo']);
      add('Bottled Water','Individual drinking water can be added to the guest setup.',['drinking water','bottled water','mineral water']);
      add('Buffet Setup & Serving','Ask us to include buffet setup and serving support for the event.',['serving staff','service staff','buffet setup']);
      add('Delivery & Collection','Delivery, setup timing and collection can be arranged with the catering order.',['delivery','collection']);
    }else{
      add('Refreshments','Add beverages or light refreshments to complement the order.',['juice','tea','coffee','water','beverage']);
      add('Dessert Selection','A dessert option can be added to complete the order.',['dessert','cake','custard','pudding']);
      add('Delivery & Setup','Ask us about delivery and setup for your order.',['delivery','setup']);
    }

    return rec.slice(0,3);
  }

  function addPanel(root,d){
    if(!root||!d||d.document_type!=='quotation')return;
    const recs=recommendations(d);
    if(!recs.length)return;

    root.querySelectorAll('.q26-menu').forEach(page=>{
      page.querySelectorAll('.q99-context-ad').forEach(el=>el.remove());
      const menu=page.querySelector('.q95-menu-sections');
      if(!menu)return;

      const panel=document.createElement('section');
      panel.className='q99-context-ad';
      panel.innerHTML=`
        <div class="q99-ad-intro">
          <span>Optional Add-Ons</span>
          <h3>Complete Your Catering</h3>
          <p>These extras are not included in this quotation. Ask us to add any of them before confirmation.</p>
        </div>
        <div class="q99-ad-cards">
          ${recs.map(r=>`<div class="q99-ad-card"><b>${escHtml(r.title)}</b><p>${escHtml(r.copy)}</p></div>`).join('')}
        </div>
        <div class="q99-ad-contact"><span>Need to customise this menu?</span><b>White Saffron · Hotline 9990453</b></div>`;
      menu.insertAdjacentElement('afterend',panel);
    });
  }

  try{
    const previousRenderPrint=renderPrint;
    renderPrint=function(d){
      const result=previousRenderPrint.apply(this,arguments);
      addPanel(document.getElementById('printRoot'),d);
      return result;
    };
  }catch(e){console.warn('Quo v99 contextual advertisement could not wrap renderer',e)}

  if(!document.getElementById('quoContextAdV99Style')){
    const st=document.createElement('style');
    st.id='quoContextAdV99Style';
    st.textContent=`
      .quo-v26 .q99-context-ad{margin-top:9mm;padding:6mm 6.5mm;border:1px solid #d8e3df;border-radius:3mm;background:linear-gradient(135deg,#f5faf8 0%,#ffffff 72%);break-inside:avoid;page-break-inside:avoid}
      .quo-v26 .q99-ad-intro span{display:block;margin:0 0 1.5mm;font-family:Arial,sans-serif;font-size:6pt;font-weight:850;letter-spacing:.16em;text-transform:uppercase;color:#285f58}
      .quo-v26 .q99-ad-intro h3{margin:0;font-family:Georgia,'Times New Roman',serif;font-size:15pt;line-height:1.15;color:#183b36}
      .quo-v26 .q99-ad-intro p{max-width:150mm;margin:2mm 0 0;font-size:7.1pt;line-height:1.45;color:#68736f}
      .quo-v26 .q99-ad-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:3mm;margin-top:4mm}
      .quo-v26 .q99-ad-card{min-height:22mm;padding:3.2mm;border:1px solid #e0e8e5;border-radius:2mm;background:#fff}
      .quo-v26 .q99-ad-card b{display:block;font-family:Georgia,'Times New Roman',serif;font-size:9pt;line-height:1.25;color:#253d37}
      .quo-v26 .q99-ad-card p{margin:1.6mm 0 0;font-size:6.6pt;line-height:1.42;color:#6b7572}
      .quo-v26 .q99-ad-contact{display:flex;align-items:center;justify-content:space-between;gap:6mm;margin-top:4mm;padding-top:3mm;border-top:1px solid #dce5e2;font-size:6.8pt;color:#68736f}
      .quo-v26 .q99-ad-contact b{color:#285f58;font-size:7pt}
      @media(max-width:700px){.quo-v26 .q99-ad-cards{grid-template-columns:1fr}.quo-v26 .q99-ad-contact{align-items:flex-start;flex-direction:column;gap:1mm}}
      @media print{.quo-v26 .q99-context-ad{break-inside:avoid;page-break-inside:avoid}}
    `;
    document.head.appendChild(st);
  }

  window.quoAddContextAd=function(d){addPanel(document.getElementById('printRoot'),d)};
})();
