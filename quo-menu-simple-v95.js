/* Quo v95 - simple, text-first catering menu. No food photos or decorative icons. */
(function(){
  const CATEGORY_NAMES=new Set([
    'beverages','drinks','juices','salads','salad','main course','main courses','mains','dessert','desserts',
    'starter','starters','appetizer','appetizers','sides','side dishes','rice','pasta','seafood','fish','chicken',
    'beef','breakfast','lunch','dinner','snacks','soup','soups','bread','breads','condiments'
  ]);

  const escHtml=(value)=>String(value??'').replace(/[&<>'"]/g,ch=>({
    '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
  }[ch]));

  function cleanText(value){
    return String(value||'')
      .replace(/^\s*[•·▪◦‣⁃*-]+\s*/,'')
      .replace(/\s+/g,' ')
      .trim();
  }

  function titleCase(value){
    const s=cleanText(value).toLowerCase();
    return s.replace(/(^|[\s/(&-])([a-z])/g,(m,p,c)=>p+c.toUpperCase());
  }

  function isGenericItemLabel(value){
    return /^(item|menu item)\s*\d+\s*$/i.test(cleanText(value));
  }

  function isCategory(value){
    const raw=cleanText(value);
    if(!raw)return false;
    const key=raw.toLowerCase().replace(/\s*[:–—-]\s*$/,'');
    if(CATEGORY_NAMES.has(key))return true;
    const letters=raw.replace(/[^A-Za-z]/g,'');
    return letters.length>=3 && raw.length<=32 && raw===raw.toUpperCase();
  }

  function splitItems(value){
    const raw=String(value||'').trim();
    if(!raw)return [];
    let parts=raw.split(/\n|\r|•|▪|◦|‣|⁃|;/g).map(cleanText).filter(Boolean);
    if(parts.length===1 && /,/.test(raw)){
      const commas=raw.split(',').map(cleanText).filter(Boolean);
      if(commas.length>1 && commas.every(x=>x.length<55))parts=commas;
    }
    return parts.length?parts:[cleanText(raw)].filter(Boolean);
  }

  function pushGroup(groups,name,items){
    const cleanName=cleanText(name)||'Menu';
    const cleanItems=(items||[]).map(cleanText).filter(Boolean);
    if(!cleanItems.length)return;
    const existing=groups.find(g=>g.name.toLowerCase()===cleanName.toLowerCase());
    if(existing){
      cleanItems.forEach(item=>{if(!existing.items.includes(item))existing.items.push(item)});
    }else{
      groups.push({name:cleanName,items:cleanItems});
    }
  }

  function groupsFromPage(page){
    const rows=[...page.querySelectorAll('.q26-meal')];
    if(!rows.length)return [];
    const genericRows=rows.filter(row=>isGenericItemLabel(row.querySelector('b')?.textContent||'')).length;
    const genericMode=genericRows>=Math.max(2,Math.ceil(rows.length*.55));
    const groups=[];

    if(genericMode){
      let current=null;
      rows.forEach(row=>{
        const body=cleanText(row.querySelector('p')?.textContent||'');
        if(!body || /not required/i.test(body))return;
        if(isCategory(body)){
          current={name:titleCase(body),items:[]};
          groups.push(current);
          return;
        }
        if(!current){
          current={name:'Menu',items:[]};
          groups.push(current);
        }
        splitItems(body).forEach(item=>current.items.push(item));
      });
      return groups.filter(g=>g.items.length);
    }

    rows.forEach(row=>{
      const name=cleanText(row.querySelector('b')?.textContent||'Menu');
      const body=cleanText(row.querySelector('p')?.textContent||'');
      if(!body || /not required/i.test(body))return;
      pushGroup(groups,titleCase(name),splitItems(body));
    });
    return groups;
  }

  function displayTitle(d){
    const event=cleanText(d?.event_name||d?.service_type||'');
    if(event){
      const title=titleCase(event);
      return /menu$/i.test(title)?title:`${title} Menu`;
    }
    const supplied=cleanText(d?.menu_title||'');
    return supplied?titleCase(supplied):'Catering Menu';
  }

  function menuMeta(d){
    const parts=[];
    if(cleanText(d?.customer_name))parts.push(cleanText(d.customer_name));
    try{
      if(d?.service_enabled && typeof period==='function'){
        const p=period(d.service_from,d.service_to);
        if(p)parts.push(p);
      }else if(d?.creation_date && typeof dateLong==='function'){
        const dt=dateLong(d.creation_date);if(dt)parts.push(dt);
      }
    }catch(e){}
    const pax=Number(d?.service_pax||0);
    if(pax>0)parts.push(`${pax.toLocaleString()} Pax`);
    return parts.join('  ·  ');
  }

  function enhanceMenuPage(page,d,index,total){
    if(!page)return;
    page.classList.add('q95-simple-menu');

    const brandCopy=page.querySelector('.q26-brand.compact p');
    if(brandCopy)brandCopy.textContent='Catering · Events · Private Dining';

    const ref=page.querySelector('.q26-menu-ref');
    if(ref && d?.document_number)ref.textContent=d.document_number;

    const titleBox=page.querySelector('.q26-menu-title');
    if(titleBox){
      const eyebrow=titleBox.querySelector('span');
      if(eyebrow)eyebrow.textContent=index===0?'Catering Menu':'Catering Menu · Continued';
      const h2=titleBox.querySelector('h2');
      if(h2)h2.textContent=displayTitle(d);
      const p=titleBox.querySelector('p');
      if(p)p.textContent=menuMeta(d);
    }

    const oldGrid=page.querySelector('.q26-menu-grid');
    if(!oldGrid)return;
    const groups=groupsFromPage(page);
    const container=document.createElement('div');
    container.className='q95-menu-sections';

    if(!groups.length){
      container.innerHTML='<div class="q95-empty">Menu details will appear here.</div>';
    }else{
      groups.forEach(group=>{
        const section=document.createElement('section');
        section.className='q95-menu-section';
        section.innerHTML=`<h3>${escHtml(group.name)}</h3><ul>${group.items.map(item=>`<li>${escHtml(item)}</li>`).join('')}</ul>`;
        container.appendChild(section);
      });
    }
    oldGrid.replaceWith(container);

    const footer=page.querySelector('.q26-footer span:last-child');
    if(footer && d?.document_number)footer.textContent=`${d.document_number} - Menu ${index+1} of ${total}`;
  }

  function enhanceRenderedMenu(root,d){
    if(!root)return;
    const pages=[...root.querySelectorAll('.q26-menu')];
    pages.forEach((page,index)=>enhanceMenuPage(page,d,index,pages.length));
  }

  try{
    const previousRenderPrint=renderPrint;
    renderPrint=function(d){
      const result=previousRenderPrint.apply(this,arguments);
      enhanceRenderedMenu(document.getElementById('printRoot'),d);
      return result;
    };
  }catch(e){console.warn('Quo simple menu could not wrap print renderer',e)}

  if(!document.getElementById('quoMenuSimpleV95Style')){
    const st=document.createElement('style');
    st.id='quoMenuSimpleV95Style';
    st.textContent=`
      .quo-v26.q95-simple-menu{background:#fff!important}
      .quo-v26.q95-simple-menu .q26-topline{height:3mm;background:#285f58}
      .quo-v26.q95-simple-menu .q26-menu-head{margin-top:1mm;padding-bottom:4.5mm;border-bottom:1px solid #d9dfdd;align-items:center}
      .quo-v26.q95-simple-menu .q26-brand.compact{align-items:center;gap:3.5mm}
      .quo-v26.q95-simple-menu .q26-brand.compact img{width:15mm;height:15mm}
      .quo-v26.q95-simple-menu .q26-brand.compact h1{font-family:Georgia,'Times New Roman',serif;font-size:13.5pt;color:#203a35;margin:0}
      .quo-v26.q95-simple-menu .q26-brand.compact p{font-size:6.7pt;letter-spacing:.02em;color:#737d7a;margin-top:1mm}
      .quo-v26.q95-simple-menu .q26-menu-ref{padding:0;font-size:7.6pt;letter-spacing:.03em;color:#273431}

      .quo-v26.q95-simple-menu .q26-menu-title{margin-top:9mm;padding-bottom:6mm;border-bottom:1px solid #dfe4e2;text-align:left}
      .quo-v26.q95-simple-menu .q26-menu-title span{display:block;font-family:Arial,sans-serif;font-size:6.2pt;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:#285f58}
      .quo-v26.q95-simple-menu .q26-menu-title h2{max-width:170mm;margin:2mm 0 1.8mm;font-family:Georgia,'Times New Roman',serif;font-size:22pt;line-height:1.12;font-weight:700;color:#183b36}
      .quo-v26.q95-simple-menu .q26-menu-title p{margin:0;font-size:7.8pt;line-height:1.45;color:#67726f}

      .quo-v26.q95-simple-menu .q95-menu-sections{display:grid;grid-template-columns:1fr 1fr;column-gap:10mm;row-gap:3mm;margin-top:8mm;align-items:start}
      .quo-v26.q95-simple-menu .q95-menu-section{break-inside:avoid;padding:0 0 5mm;border-bottom:1px solid #dfe4e2;min-width:0}
      .quo-v26.q95-simple-menu .q95-menu-section h3{margin:0 0 2.5mm;padding:0 0 2mm;border-bottom:1.5px solid #285f58;font-family:Arial,sans-serif;font-size:7.4pt;line-height:1.2;font-weight:800;letter-spacing:.13em;text-transform:uppercase;color:#285f58}
      .quo-v26.q95-simple-menu .q95-menu-section ul{list-style:none;margin:0;padding:0}
      .quo-v26.q95-simple-menu .q95-menu-section li{margin:0;padding:2.2mm 0;border-bottom:1px solid #eef1f0;font-family:Georgia,'Times New Roman',serif;font-size:10.2pt;line-height:1.3;color:#26312e}
      .quo-v26.q95-simple-menu .q95-menu-section li:last-child{border-bottom:0}
      .quo-v26.q95-simple-menu .q95-empty{grid-column:1/-1;padding:10mm 0;color:#7b8582;font-size:9pt}
      .quo-v26.q95-simple-menu .q26-footer{color:#7a8380;border-top:1px solid #dfe4e2}

      @media print{
        .quo-v26.q95-simple-menu .q95-menu-section{break-inside:avoid;page-break-inside:avoid}
      }
    `;
    document.head.appendChild(st);
  }

  window.quoEnhanceSimpleMenu=function(d){enhanceRenderedMenu(document.getElementById('printRoot'),d)};
})();
