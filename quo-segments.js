/* Quo v21.1 - filling guide, logical section navigation, lightweight validation */
(function(){
  const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
  const labels=['Document','Customer','Event / Service','Items','Menu','Payment','Notes & Terms'];
  let io=null;
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
  function addWarnings(cards){cards.forEach(c=>c.querySelector('.section-warning')?.remove());const d=state()?.current;if(!d)return;
    const event=cards.find(c=>/Event\s*\/\s*Service/i.test(c.querySelector('h3')?.textContent||''));if(event&&d.service_enabled&&(!d.service_from||!d.service_to)){const w=document.createElement('div');w.className='section-warning';w.textContent='Service dates are separate from the quotation expiry date. Enter the actual catering or delivery period here.';event.querySelector('.card-body')?.prepend(w)}
    const pay=cards.find(c=>/^Payment$/i.test(c.querySelector('h3')?.textContent||''));if(pay&&d.use_advance&&!d.advance_due){const w=document.createElement('div');w.className='section-warning';w.textContent='Advance payment is enabled. Add the advance due date so the customer knows the confirmation deadline.';pay.querySelector('.card-body')?.prepend(w)}
  }
  function decorate(){
    const main=q('.editor-main');if(!main||!state()?.current)return;
    const cards=[...main.querySelectorAll(':scope > .editor-card')];if(!cards.length)return;
    let guide=q('.fill-guide');if(!guide){guide=document.createElement('div');guide.className='fill-guide';guide.innerHTML='<div class="fill-guide-head"><b>Filling Guide</b><span id="fillGuideCount"></span></div><div class="fill-progress"><i id="fillGuideBar"></i></div><div class="fill-steps" id="fillSteps"></div>';main.prepend(guide)}
    const states=assess(cards);addWarnings(cards);
    const steps=q('#fillSteps');if(steps){steps.innerHTML=cards.map((c,i)=>{const title=c.querySelector('h3')?.textContent?.trim()||labels[i]||`Section ${i+1}`;return `<button type="button" class="fill-step ${states[i]?'done':'missing'}" data-fill-step="${i}">${i+1}. ${title}</button>`}).join('');steps.querySelectorAll('[data-fill-step]').forEach(b=>b.onclick=()=>cards[+b.dataset.fillStep]?.scrollIntoView({behavior:'smooth',block:'start'}))}
    const complete=states.filter(Boolean).length,total=states.length,pct=total?Math.round(complete/total*100):0;const bar=q('#fillGuideBar'),count=q('#fillGuideCount');if(bar)bar.style.width=pct+'%';if(count)count.textContent=`${complete}/${total} sections ready`;
    io?.disconnect();io=new IntersectionObserver(entries=>{const hit=entries.filter(e=>e.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];if(!hit)return;const idx=cards.indexOf(hit.target);qa('.fill-step').forEach((b,i)=>b.classList.toggle('current',i===idx))},{rootMargin:'-155px 0px -55% 0px',threshold:[.05,.25,.6]});cards.forEach(c=>io.observe(c));
  }
  let timer;const schedule=()=>{clearTimeout(timer);timer=setTimeout(decorate,80)};
  const observer=new MutationObserver(schedule);observer.observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('input',schedule,true);document.addEventListener('change',schedule,true);window.addEventListener('load',schedule);schedule();
})();
