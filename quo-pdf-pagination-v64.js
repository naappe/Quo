/* Quo v64 - deterministic A4 continuation pages for long documents and menus. */
(function(){
  if(typeof renderPrint!=='function')return;
  const baseRenderPrint=renderPrint;

  function rowWeight(row){
    const desc=String(row?.cells?.[1]?.textContent||'').trim();
    const lines=Math.max(1,Math.ceil(desc.length/58));
    return 1+(lines-1)*0.58;
  }

  function totalWeight(rows){return rows.reduce((sum,row)=>sum+rowWeight(row),0)}

  function takeByWeight(rows,start,capacity){
    const out=[];
    let used=0,i=start;
    for(;i<rows.length;i++){
      const w=rowWeight(rows[i]);
      if(out.length&&used+w>capacity)break;
      out.push(rows[i]);used+=w;
      if(used>=capacity)break;
    }
    return {rows:out,next:i+((i<rows.length&&out[out.length-1]===rows[i])?1:0)};
  }

  function splitRows(rows,firstCap,midCap,finalCap){
    if(!rows.length)return [[]];
    if(totalWeight(rows)<=finalCap)return [rows];
    const chunks=[];
    let index=0;
    const first=takeByWeight(rows,index,firstCap);
    chunks.push(first.rows);index=first.next;
    while(index<rows.length){
      const remain=rows.slice(index);
      if(totalWeight(remain)<=finalCap){chunks.push(remain);break;}
      const part=takeByWeight(rows,index,midCap);
      if(!part.rows.length){chunks.push([rows[index]]);index++;continue;}
      chunks.push(part.rows);index=part.next;
    }
    return chunks.filter(x=>x.length);
  }

  function splitText(text,firstLimit=760,nextLimit=1750){
    const raw=String(text||'').trim();
    if(!raw)return [];
    const parts=[];
    let remaining=raw,limit=firstLimit;
    while(remaining.length>limit){
      let cut=remaining.lastIndexOf('\n',limit);
      if(cut<Math.floor(limit*.58))cut=remaining.lastIndexOf(' ',limit);
      if(cut<Math.floor(limit*.58))cut=limit;
      parts.push(remaining.slice(0,cut).trim());
      remaining=remaining.slice(cut).trim();
      limit=nextLimit;
    }
    if(remaining)parts.push(remaining);
    return parts;
  }

  function remove(node,selector){node.querySelector(selector)?.remove()}
  function removeAll(node,selectors){selectors.forEach(s=>remove(node,s))}

  function continuationLabel(page,d,label='Document continued'){
    const head=page.querySelector('.q26-head,.q26-menu-head');
    if(!head)return;
    const el=document.createElement('div');
    el.className='q64-continuation-label';
    el.innerHTML=`<span>${esc(label)}</span><b>${esc(d.document_number||'')}</b>`;
    head.insertAdjacentElement('afterend',el);
  }

  function setTerms(page,text){
    const terms=page.querySelector('.q26-terms');
    if(!text){terms?.remove();return;}
    if(terms){const p=terms.querySelector('p');if(p)p.textContent=text;return;}
    const closing=page.querySelector('.q26-closing');
    const section=document.createElement('section');
    section.className='q26-terms';
    section.innerHTML=`<div class="q26-section-title">Notes &amp; Terms</div><p>${esc(text)}</p>`;
    if(closing)closing.insertAdjacentElement('beforebegin',section);else page.querySelector('.q26-footer')?.insertAdjacentElement('beforebegin',section);
  }

  function docCapacity(d,termsLength){
    let single=7,first=8,mid=11,final=7;
    if(d.service_enabled){single-=1;first-=1;final-=1}
    if(d.use_advance){single-=1;final-=1}
    if(d.document_type==='invoice'){single-=1;final-=1}
    if(d.document_type==='receipt'){single-=1;final-=1}
    if(termsLength>450){single-=1;final-=1}
    return {single:Math.max(4,single),first:Math.max(5,first),mid:Math.max(8,mid),final:Math.max(4,final)};
  }

  function buildDocumentPages(main,d){
    if(!main)return [];
    const sourceRows=[...main.querySelectorAll('.q26-table tbody tr')];
    const termsText=String(main.querySelector('.q26-terms p')?.textContent||'').trim();
    const cap=docCapacity(d,termsText.length);
    const needsRowSplit=totalWeight(sourceRows)>cap.single;
    const termParts=splitText(termsText,needsRowSplit?620:850,1750);

    if(!needsRowSplit&&termParts.length<=1){
      main.classList.remove('q26-sparse');
      return [main];
    }

    const rowChunks=needsRowSplit?splitRows(sourceRows,cap.first,cap.mid,cap.final):[sourceRows];
    const pages=[];

    rowChunks.forEach((chunk,index)=>{
      const page=main.cloneNode(true);
      page.classList.remove('q26-sparse');
      const body=page.querySelector('.q26-table tbody');
      if(body)body.innerHTML=chunk.map(row=>row.outerHTML).join('');
      if(index>0){
        removeAll(page,['.q26-info','.q26-service']);
        continuationLabel(page,d,'Document continued');
      }
      const isLastItems=index===rowChunks.length-1;
      if(!isLastItems){
        removeAll(page,['.q26-summary','.q26-payment','.q26-terms','.q26-closing']);
      }else{
        if(termParts.length){setTerms(page,termParts[0])}else remove(page,'.q26-terms');
        if(termParts.length>1)remove(page,'.q26-closing');
      }
      pages.push(page);
    });

    if(termParts.length>1){
      for(let i=1;i<termParts.length;i++){
        const page=main.cloneNode(true);
        page.classList.remove('q26-sparse');
        removeAll(page,['.q26-info','.q26-service','.q26-table','.q26-summary','.q26-payment']);
        continuationLabel(page,d,'Notes & Terms continued');
        setTerms(page,termParts[i]);
        if(i<termParts.length-1)remove(page,'.q26-closing');
        pages.push(page);
      }
    }

    return pages;
  }

  function dayWeight(day){
    const meals=[...day.querySelectorAll('.q26-meal')];
    const chars=meals.reduce((sum,m)=>sum+String(m.textContent||'').length,0);
    return 1+Math.max(0,meals.length-3)*.32+Math.max(0,chars-340)/520;
  }

  function menuChunks(days){
    const out=[];let current=[],weight=0;
    for(const day of days){
      const w=dayWeight(day);
      if(current.length&&(current.length>=4||weight+w>4.6)){out.push(current);current=[];weight=0}
      current.push(day);weight+=w;
    }
    if(current.length)out.push(current);
    return out;
  }

  function buildMenuPages(menu,d){
    if(!menu)return [];
    const days=[...menu.querySelectorAll('.q26-menu-grid > .q26-day')];
    if(days.length<=4&&days.reduce((s,x)=>s+dayWeight(x),0)<=4.7)return [menu];
    const chunks=menuChunks(days),pages=[];
    chunks.forEach((chunk,index)=>{
      const page=menu.cloneNode(true);
      const grid=page.querySelector('.q26-menu-grid');
      if(grid)grid.innerHTML=chunk.map(day=>day.outerHTML).join('');
      if(index>0){
        const title=page.querySelector('.q26-menu-title span');
        if(title)title.textContent='Menu Attachment - Continued';
      }
      pages.push(page);
    });
    return pages;
  }

  function updateFooters(pages,d){
    const total=pages.length;
    pages.forEach((page,index)=>{
      page.dataset.quoPage=String(index+1);
      const footer=page.querySelector('.q26-footer');
      if(!footer)return;
      const spans=footer.querySelectorAll('span');
      if(spans.length>1)spans[spans.length-1].textContent=`${d.document_number||''} - Page ${index+1} of ${total}`;
    });
  }

  renderPrint=function(d){
    baseRenderPrint(d);
    const root=document.getElementById('printRoot');if(!root)return;
    const main=root.querySelector('.q26-main');
    const menu=root.querySelector('.q26-menu');
    const docPages=buildDocumentPages(main,d);
    const menuPages=buildMenuPages(menu,d);
    const pages=[...docPages,...menuPages];
    if(!pages.length)return;
    updateFooters(pages,d);
    root.innerHTML='';
    pages.forEach(page=>root.appendChild(page));
  };

  if(!document.getElementById('quoPdfPaginationV64Style')){
    const st=document.createElement('style');
    st.id='quoPdfPaginationV64Style';
    st.textContent=`
      .quo-v26 .q64-continuation-label{display:flex;align-items:center;justify-content:space-between;gap:8mm;margin-top:4mm;padding:2.2mm 0;border-bottom:1px solid #e3e8e6;color:#6b7773}
      .quo-v26 .q64-continuation-label span{font-size:6.2pt;font-weight:800;letter-spacing:.11em;text-transform:uppercase}
      .quo-v26 .q64-continuation-label b{font-size:7.2pt;color:#35443f}
      .quo-v26[data-quo-page]:not([data-quo-page="1"]) .q26-head{padding-bottom:3.5mm!important}
      @media print{.pdf-page.quo-v26{break-after:page;page-break-after:always}.pdf-page.quo-v26:last-child{break-after:auto;page-break-after:auto}}
    `;
    document.head.appendChild(st);
  }

  window.QUO_PDF_PAGINATION_VERSION='64';
})();
