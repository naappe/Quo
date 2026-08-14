/* Quo v22 - stable filling guide, logical section navigation, lightweight validation */
(function(){
  const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
  const labels=['Document','Customer','Event / Service','Items','Menu','Payment','Notes & Terms'];
  let io=null;
  let timer=null;
  const state=()=>typeof S!=='undefined'?S:null;
  function fieldByKey(card,key){return card?.querySelector(`[data-field="${key}"]`)||null}
  function mark(el,missing){const f=el?.closest('.field');if(f)f.classList.toggle('field-missing',!!missing)}
  function assess(cards){
    const d=state()?.current;if(!d)return [];
    const states=cards.map(()=>true);
    if(cards[0]){const el=fieldByKey(cards[0],'creation_date');const miss=!String(d.creation_date||'').trim();mark(el,miss);states[0]=!miss}
    if(cards[1]){const el=fieldByKey(cards[1],'customer_name');const miss=!String(d.customer_name||'').trim();mark(el,miss);states[1]=!miss}
    const eventIndex=cards.findIndex(c=>/Event\s*\/\s*Service/i.test(c.querySelector('h3')?.textContent||''));
    if(eventIndex>=0){let ok=true;if(d.service_enabled){['service_from','service_to'].forEach(k=>{const el=fieldByKey(cards[eventIndex],k),miss=!String(d[k]||'').trim();mark(el,miss);if(miss)ok=false});const pax=fieldByKey(cards[eventIndex],'service_pax'),pmiss=!(Number(d.service_pax)>0);mark(pax,pmiss);if(pmiss)ok=false}states[eventIndex]=ok}
    const itemIndex=cards.findIndex(c=>/^Items$/i.test(c.querySelector('h3')?.textContent||''));
    if(itemIndex>=0){const items=d.items||[];states[itemIndex]=items.some(i=>String(i.description||'').trim()&&Number(i.qty)>0&&Number(i.price)>=0)}
    const menuIndex=cards.findIndex(c=>/^Menu$/i.test(c.querySelector('h3')?.textContent||''));
    if(menuIndex>=0){states[menuIndex]=!d.include_menu||!!String(d.menu_text||'').trim();const ta=fieldByKey(cards[menuIndex],'menu_text');if(ta)ta.placeholder='Day 1\nBreakfast: Bread, Roshi, Mashuni...\nLunch: Rice, Fish Curry, Salad...\n\nDay 2\nBreakfast: ...\nLunch: ...'}
    const payIndex=cards.findIndex(c=>/^Payment$/i.test(c.querySelector('h3')?.textContent||''));
    if(payIndex>=0){let ok=true;if(d.use_advance){const pct=fieldByKey(cards[payIndex],'advance_percent'),due=fieldByKey(cards[payIndex],'advance_due');const pmiss=!(Number(d.advance_percent)>0&&Number(d.advance_percent)<=100),dmiss=!String(d.advance_due||'').trim();mark(pct,pmiss);mark(due,dmiss);ok=!pmiss&&!dmiss}states[payIndex]=ok}
    return states;
  }
  function syncWarning(card,show,text){
    if(!card)return;
    let w=card.querySelector('.section-warning[data-segment-warning]');
    if(!show){w?.remove();return}
    if(!w){w=document.createElement('div');w.className='section-warning';w.dataset.segmentWarning='1';card.querySelector('.card-body')?.prepend(w)}
    if(w&&w.textContent!==text)w.textContent=text;
  }
  function addWarnings(cards){
    const d=state()?.current;if(!d)return;
    const event=cards.find(c=>/Event\s*\/\s*Service/i.test(c.querySelector('h3')?.textContent||''));
    syncWarning(event,!!(event&&d.service_enabled&&(!d.service_from||!d.service_to)),'Service dates are separate from the quotation expiry date. Enter the actual catering or delivery period here.');
    const pay=cards.find(c=>/^Payment$/i.test(c.querySelector('h3')?.textContent||''));
    syncWarning(pay,!!(pay&&d.use_advance&&!d.advance_due),'Advance payment is enabled. Add the advance due date so the customer knows the confirmation deadline.');
  }
  function syncSteps(cards,states){
    const steps=q('#fillSteps');if(!steps)return;
    const wanted=cards.map((c,i)=>({title:c.querySelector('h3')?.textContent?.trim()||labels[i]||`Section ${i+1}`,done:!!states[i]}));
    let buttons=[...steps.querySelectorAll('[data-fill-step]')];
    const structureChanged=buttons.length!==wanted.length||buttons.some((b,i)=>b.dataset.title!==wanted[i].title);
    if(structureChanged){
      steps.innerHTML=wanted.map((x,i)=>`<button type="button" class="fill-step ${x.done?'done':'missing'}" data-fill-step="${i}" data-title="${x.title.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}">${i+1}. ${x.title.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</button>`).join('');
      buttons=[...steps.querySelectorAll('[data-fill-step]')];
    }
    buttons.forEach((b,i)=>{
      b.classList.toggle('done',wanted[i].done);
      b.classList.toggle('missing',!wanted[i].done);
      b.onclick=()=>cards[i]?.scrollIntoView({behavior:'smooth',block:'start'});
    });
  }
  function decorate(){
    const main=q('.editor-main');if(!main||!state()?.current)return;
    const cards=[...main.querySelectorAll(':scope > .editor-card')];if(!cards.length)return;
    let guide=q('.fill-guide');
    if(!guide){
      guide=document.createElement('div');guide.className='fill-guide';
      guide.innerHTML='<div class="fill-guide-head"><b>Filling Guide</b><span id="fillGuideCount"></span></div><div class="fill-progress"><i id="fillGuideBar"></i></div><div class="fill-steps" id="fillSteps"></div>';
      main.prepend(guide);
    }
    const states=assess(cards);addWarnings(cards);syncSteps(cards,states);
    const complete=states.filter(Boolean).length,total=states.length,pct=total?Math.round(complete/total*100):0;
    const bar=q('#fillGuideBar'),count=q('#fillGuideCount');if(bar)bar.style.width=pct+'%';if(count)count.textContent=`${complete}/${total} sections ready`;
    io?.disconnect();
    io=new IntersectionObserver(entries=>{
      const hit=entries.filter(e=>e.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];if(!hit)return;
      const idx=cards.indexOf(hit.target);
      qa('.fill-step').forEach((b,i)=>b.classList.toggle('current',i===idx));
    },{rootMargin:'-155px 0px -55% 0px',threshold:[.05,.25,.6]});
    cards.forEach(c=>io.observe(c));
  }
  const schedule=()=>{clearTimeout(timer);timer=setTimeout(decorate,80)};
  const observer=new MutationObserver(mutations=>{
    const meaningful=mutations.some(m=>{
      if(m.target instanceof Element&&m.target.closest('.fill-guide'))return false;
      const nodes=[...m.addedNodes,...m.removedNodes];
      if(nodes.length&&nodes.every(n=>n.nodeType===1&&(n.classList?.contains('fill-guide')||n.classList?.contains('section-warning'))))return false;
      return true;
    });
    if(meaningful)schedule();
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('input',schedule,true);
  document.addEventListener('change',schedule,true);
  window.addEventListener('load',schedule);
  schedule();
})();
