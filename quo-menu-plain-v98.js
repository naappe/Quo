/* Quo v98 - plain catering menu lists stay as items, never accidental categories. */
(function(){
  const clean=(value)=>String(value||'')
    .replace(/^\s*[•·▪◦‣⁃*-]+\s*/,'')
    .replace(/\s+/g,' ')
    .trim();

  const escHtml=(value)=>String(value??'').replace(/[&<>'"]/g,ch=>({
    '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
  }[ch]));

  function plainItems(text){
    const lines=String(text||'').split(/\r?\n/).map(clean).filter(Boolean);
    if(lines.length<2)return null;

    const looksStructured=lines.some(line=>{
      if(/:\s*\S/.test(line))return true;
      if(/^day\s*\d+/i.test(line))return true;
      if(/\b\d{1,2}[:.]\d{2}\s*(?:-|–|—|to)\s*\d{1,2}[:.]\d{2}\b/i.test(line))return true;
      if(/not required/i.test(line))return true;
      const letters=line.replace(/[^A-Za-z]/g,'');
      if(letters.length>=3 && line===line.toUpperCase())return true;
      return false;
    });

    return looksStructured?null:lines;
  }

  function fixPlainMenu(root,d){
    const items=plainItems(d?.menu_text);
    if(!items||!root)return;

    root.querySelectorAll('.q26-menu').forEach(page=>{
      const host=page.querySelector('.q95-menu-sections');
      if(!host)return;
      host.innerHTML=`<section class="q95-menu-section q98-plain-list"><h3>Menu</h3><ul>${items.map(item=>`<li>${escHtml(item)}</li>`).join('')}</ul></section>`;
      page.classList.add('q98-plain-menu');
    });
  }

  try{
    const previousRenderPrint=renderPrint;
    renderPrint=function(d){
      const result=previousRenderPrint.apply(this,arguments);
      fixPlainMenu(document.getElementById('printRoot'),d);
      return result;
    };
  }catch(e){console.warn('Quo v98 plain-menu fix could not wrap renderer',e)}

  if(!document.getElementById('quoMenuPlainV98Style')){
    const st=document.createElement('style');
    st.id='quoMenuPlainV98Style';
    st.textContent=`
      .quo-v26.q98-plain-menu .q98-plain-list{grid-column:1/-1;padding-bottom:0}
      .quo-v26.q98-plain-menu .q98-plain-list ul{columns:2;column-gap:10mm}
      .quo-v26.q98-plain-menu .q98-plain-list li{break-inside:avoid;page-break-inside:avoid}
      @media(max-width:700px){.quo-v26.q98-plain-menu .q98-plain-list ul{columns:1}}
    `;
    document.head.appendChild(st);
  }
})();
