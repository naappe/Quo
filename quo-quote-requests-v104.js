/* Quo v104 - public RFQ inbox and conversion into quotation drafts. */
(function(){
  if(typeof S==='undefined'||typeof sb==='undefined')return;
  let rows=[],loading=false,filter='Open';
  const escHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmtDate=v=>{try{return v?new Date(v+'T00:00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}):'-'}catch(e){return v||'-'}};
  const fmtTime=v=>String(v||'').slice(0,5);
  const openStatuses=new Set(['New','Reviewing']);

  function navButton(){
    let b=document.querySelector('[data-q104-requests]');
    if(b)return b;
    const nav=document.querySelector('.sidebar .nav');if(!nav)return null;
    b=document.createElement('button');
    b.type='button';b.dataset.q104Requests='1';
    b.innerHTML='<span class="nav-icon">✦</span><span>Quote Requests</span><small class="q104-nav-count" hidden></small>';
    const workflow=[...nav.querySelectorAll('.nav-label')].find(x=>/workflow/i.test(x.textContent||''));
    if(workflow)workflow.insertAdjacentElement('afterend',b);else nav.prepend(b);
    b.onclick=()=>openRequests();
    return b;
  }

  function updateNavCount(){
    const b=navButton(),n=rows.filter(r=>r.status==='New').length,c=b?.querySelector('.q104-nav-count');
    if(!c)return;c.hidden=!n;c.textContent=n>99?'99+':String(n);
  }

  async function loadRequests(){
    loading=true;renderRequestView();
    const r=await sb.from('quo_quote_requests').select('*').order('created_at',{ascending:false}).limit(500);
    loading=false;
    if(r.error){console.error(r.error);rows=[];toast('Could not load quote requests')}else rows=r.data||[];
    updateNavCount();renderRequestView();
  }

  function visibleRows(){
    if(filter==='Open')return rows.filter(r=>openStatuses.has(r.status));
    if(filter==='All')return rows;
    return rows.filter(r=>r.status===filter);
  }

  function statusBadge(s){return `<span class="q104-status q104-${String(s||'New').toLowerCase().replaceAll(' ','-')}">${escHtml(s||'New')}</span>`}
  function requestCard(r){
    const customer=r.customer_type==='Individual'?(r.contact_name||'Individual'):(r.company_name||r.contact_name||'Customer');
    const times=[fmtTime(r.time_from),fmtTime(r.time_to)].filter(Boolean).join('–');
    const quote=S.docs.find(d=>d.id===r.converted_document_id);
    return `<article class="q104-card">
      <div class="q104-card-top"><div><span class="q104-ref">${escHtml(r.request_number)}</span>${statusBadge(r.status)}</div><time>${escHtml(fmtDate(String(r.created_at||'').slice(0,10)))}</time></div>
      <div class="q104-main"><div class="q104-customer"><small>CUSTOMER</small><h3>${escHtml(customer)}</h3><p>${escHtml(r.contact_name||'')}${r.phone?` · ${escHtml(r.phone)}`:''}${r.email?`<br>${escHtml(r.email)}`:''}${r.gst_number?`<br>GST: ${escHtml(r.gst_number)}`:''}</p></div><div class="q104-event"><small>REQUEST</small><h4>${escHtml(r.event_name||r.service_type||'Catering')}</h4><p>${escHtml(fmtDate(r.event_date))}${times?` · ${escHtml(times)}`:''}${r.pax?` · ${Number(r.pax).toLocaleString()} Pax`:''}${r.venue?`<br>${escHtml(r.venue)}`:''}</p></div></div>
      ${r.menu_request?`<div class="q104-note"><small>MENU / ITEMS</small><p>${escHtml(r.menu_request)}</p></div>`:''}
      ${(r.budget_per_pax!=null||r.notes)?`<div class="q104-note muted-note">${r.budget_per_pax!=null?`<b>Target budget: MVR ${Number(r.budget_per_pax).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})} / pax</b>`:''}${r.notes?`<p>${escHtml(r.notes)}</p>`:''}</div>`:''}
      <div class="q104-actions">
        ${quote?`<button class="btn" type="button" data-q104-open-doc="${escHtml(quote.id)}">Open ${escHtml(quote.document_number)}</button>`:!['Closed','Declined'].includes(r.status)?`<button class="btn primary" type="button" data-q104-create="${escHtml(r.id)}">Create Quotation</button>`:''}
        <select data-q104-status="${escHtml(r.id)}" aria-label="Request status">${['New','Reviewing','Quoted','Closed','Declined'].map(s=>`<option ${s===r.status?'selected':''}>${s}</option>`).join('')}</select>
      </div>
    </article>`;
  }

  function viewHtml(){
    const visible=visibleRows(),counts={New:rows.filter(x=>x.status==='New').length,Reviewing:rows.filter(x=>x.status==='Reviewing').length,Quoted:rows.filter(x=>x.status==='Quoted').length};
    return `${pageHead('Quote Requests','Customer enquiries are reviewed here before they become official quotations.','<button class="btn" type="button" data-q104-public>Open Customer Form ↗</button><button class="btn" type="button" data-q104-refresh>Refresh</button>')}
      <section class="q104-summary"><div><span>New</span><b>${counts.New}</b></div><div><span>Reviewing</span><b>${counts.Reviewing}</b></div><div><span>Quoted</span><b>${counts.Quoted}</b></div><div class="q104-flow"><small>WORKFLOW</small><b>Request → Review → Quotation</b></div></section>
      <div class="q104-filter">${['Open','New','Reviewing','Quoted','Closed','Declined','All'].map(x=>`<button class="chip ${filter===x?'active':''}" type="button" data-q104-filter="${x}">${x}</button>`).join('')}</div>
      ${loading?'<div class="panel"><div class="empty">Loading quote requests...</div></div>':visible.length?`<div class="q104-list">${visible.map(requestCard).join('')}</div>`:'<div class="panel"><div class="empty">No quote requests in this view.</div></div>'}`;
  }

  function bindView(){
    document.querySelector('[data-q104-public]')?.addEventListener('click',()=>window.open('./request-quote.html','_blank','noopener'));
    document.querySelector('[data-q104-refresh]')?.addEventListener('click',loadRequests);
    document.querySelectorAll('[data-q104-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.q104Filter;renderRequestView()});
    document.querySelectorAll('[data-q104-create]').forEach(b=>b.onclick=()=>prefillQuotation(b.dataset.q104Create));
    document.querySelectorAll('[data-q104-open-doc]').forEach(b=>b.onclick=()=>{const d=S.docs.find(x=>x.id===b.dataset.q104OpenDoc);if(d)openEditor(d)});
    document.querySelectorAll('[data-q104-status]').forEach(s=>s.onchange=()=>setStatus(s.dataset.q104Status,s.value));
  }

  function renderRequestView(){
    if(S.view!=='quote-requests')return;
    document.querySelectorAll('.sidebar .nav button').forEach(x=>x.classList.remove('active'));
    navButton()?.classList.add('active');
    const e=document.getElementById('topEyebrow'),t=document.getElementById('topTitle');if(e)e.textContent='WORKFLOW';if(t)t.textContent='Quote Requests';
    const host=document.getElementById('view');if(host)host.innerHTML=viewHtml();bindView();
  }

  function openRequests(){
    S.view='quote-requests';S.current=null;S.editorDirty=false;
    document.getElementById('sidebar')?.classList.remove('open');
    renderRequestView();window.scrollTo(0,0);loadRequests();
  }

  async function setStatus(id,status){
    const r=await sb.from('quo_quote_requests').update({status,updated_at:new Date().toISOString()}).eq('id',id).select('*').maybeSingle();
    if(r.error){toast('Could not update request');await loadRequests();return}
    const i=rows.findIndex(x=>x.id===id);if(i>=0)rows[i]=r.data;updateNavCount();renderRequestView();
  }

  function addDays(iso,days){const d=new Date((iso||isoToday())+'T00:00:00');d.setDate(d.getDate()+Number(days||0));return d.toISOString().slice(0,10)}
  async function prefillQuotation(id){
    const r=rows.find(x=>x.id===id);if(!r)return;
    if(r.status==='New')await sb.from('quo_quote_requests').update({status:'Reviewing',updated_at:new Date().toISOString()}).eq('id',id);
    const d=blankDoc('quotation');
    d.creation_date=isoToday();d.expires_on=addDays(d.creation_date,S.settings.default_validity_days||7);
    d.customer_name=r.customer_type==='Individual'?(r.contact_name||'Customer'):(r.company_name||r.contact_name||'Customer');
    d.customer_contact_name=r.contact_name||'';d.customer_phone=r.phone||'';d.customer_gst_number=r.gst_number||'';
    d.service_enabled=!!(r.event_date||r.pax||r.venue||r.service_type);
    d.service_type=r.service_type||'Catering - Buffet';
    const time=[fmtTime(r.time_from),fmtTime(r.time_to)].filter(Boolean).join('–');
    d.event_name=(r.event_name||r.service_type||'Catering')+(time?` (${time})`:'');
    d.service_from=r.event_date||'';d.service_to=r.event_date||'';d.service_pax=Number(r.pax||0);d.venue=r.venue||'';
    d.items=[{description:r.service_type||'Catering Service',qty:Number(r.pax||1),unit:r.pax?'Pax':'Service',price:0}];
    d.menu_text=r.menu_request||'';d.include_menu=false;d.menu_title='CATERING MENU';
    d.extra_terms=S.settings.quotation_terms||'';
    sessionStorage.setItem('quo_active_rfq_id',r.id);sessionStorage.setItem('quo_active_rfq_no',r.request_number||'');
    S.current=d;S.view='editor';S.filter='quotation';S.editorDirty=true;render();scrollTo(0,0);
    toast(`${r.request_number} loaded into a quotation draft`);
  }

  const previousRender=render;
  render=function(){if(S.view==='quote-requests'){renderRequestView();return}return previousRender.apply(this,arguments)};

  const previousSave=saveCurrent;
  saveCurrent=async function(showToast=true){
    const ok=await previousSave.apply(this,arguments);
    if(ok&&S.current?.id&&S.current.document_type==='quotation'){
      const id=sessionStorage.getItem('quo_active_rfq_id');
      if(id){
        const upd=await sb.from('quo_quote_requests').update({status:'Quoted',converted_document_id:S.current.id,updated_at:new Date().toISOString()}).eq('id',id);
        if(!upd.error){sessionStorage.removeItem('quo_active_rfq_id');sessionStorage.removeItem('quo_active_rfq_no');}
      }
    }
    return ok;
  };

  navButton();
  if(!document.getElementById('quoQuoteRequestsV104Style')){
    const st=document.createElement('style');st.id='quoQuoteRequestsV104Style';st.textContent=`
      .q104-nav-count{margin-left:auto;min-width:18px;height:18px;padding:0 5px;border-radius:99px;background:#285f58;color:#fff;display:inline-grid;place-items:center;font-size:8px;font-weight:900}.q104-nav-count[hidden]{display:none!important}
      .q104-summary{display:grid;grid-template-columns:repeat(3,120px) 1fr;gap:10px;margin-bottom:12px}.q104-summary>div{background:#fff;border:1px solid var(--line);border-radius:10px;padding:12px 14px}.q104-summary span,.q104-summary small{display:block;font-size:7.5px;font-weight:850;letter-spacing:.1em;text-transform:uppercase;color:#7e8885}.q104-summary b{display:block;margin-top:4px;font-size:18px;color:#26332f}.q104-summary .q104-flow{background:#f6faf8;border-color:#d9e7e2}.q104-summary .q104-flow b{font-size:12px;color:#285f58}
      .q104-filter{display:flex;gap:5px;flex-wrap:wrap;margin:0 0 12px}.q104-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.q104-card{background:#fff;border:1px solid var(--line);border-radius:11px;padding:15px;min-width:0}.q104-card-top{display:flex;align-items:center;justify-content:space-between;gap:10px;padding-bottom:11px;border-bottom:1px solid var(--line2)}.q104-card-top>div{display:flex;align-items:center;gap:7px}.q104-card-top time{font-size:8.5px;color:#909895}.q104-ref{font-size:9px;font-weight:900;letter-spacing:.06em;color:#34423e}.q104-status{padding:4px 7px;border-radius:99px;background:#f0f2f2;color:#68716f;font-size:7px;font-weight:850}.q104-new{background:#fff5df;color:#8b6329}.q104-reviewing{background:#edf4fb;color:#446783}.q104-quoted{background:#ebf6ef;color:#3f7353}.q104-declined{background:#fff0f0;color:#914848}
      .q104-main{display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:13px 0}.q104-main small,.q104-note small{font-size:7px;font-weight:900;letter-spacing:.1em;color:#89928f}.q104-main h3,.q104-main h4{margin:4px 0;font-size:12px}.q104-main p,.q104-note p{margin:0;font-size:9px;line-height:1.55;color:#737d79}.q104-note{padding:10px 11px;border-radius:8px;background:#fafbf9;margin-bottom:9px}.q104-note p{white-space:pre-wrap;margin-top:4px}.q104-note.muted-note{background:#f8f6f2}.q104-note.muted-note b{font-size:8.5px;color:#6e5a43}.q104-actions{display:flex;align-items:center;gap:7px;padding-top:11px;border-top:1px solid var(--line2)}.q104-actions select{margin-left:auto;height:34px;border:1px solid #dfe4e2;border-radius:8px;background:#fff;padding:0 8px;font-size:9px;color:#596460}
      @media(max-width:1050px){.q104-list{grid-template-columns:1fr}.q104-summary{grid-template-columns:repeat(3,1fr)}.q104-summary .q104-flow{grid-column:1/-1}}
      @media(max-width:560px){.q104-summary{grid-template-columns:repeat(3,1fr)}.q104-main{grid-template-columns:1fr}.q104-actions{flex-wrap:wrap}.q104-actions select{width:100%;margin-left:0}.q104-card{padding:12px}}
    `;document.head.appendChild(st);
  }
})();
