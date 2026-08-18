/* Quo v64 production layer: customer master, scalable document browsing, and health diagnostics. */
(function(){
  if(typeof S==='undefined'||typeof sb==='undefined')return;
  window.QUO_PRODUCTION_VERSION='64';

  S.customers=Array.isArray(S.customers)?S.customers:[];
  S.customerFilter=S.customerFilter||null;
  S.customerSearch=S.customerSearch||'';

  const docPager={page:0,size:50,total:0,rows:[],key:'',loading:false,error:'',seq:0,timer:null};
  let customerLoad=null;
  let docSearchTimer=null;

  const clean=v=>String(v||'').trim();
  const normName=v=>clean(v).toLowerCase().replace(/\s+/g,' ');
  function normPhone(value){
    let digits=clean(value).replace(/\D/g,'');
    if(digits.length===10&&digits.startsWith('960'))digits=digits.slice(3);
    return digits;
  }

  function fallbackCustomers(){
    const map=new Map();
    (S.docs||[]).filter(d=>!d.deleted_at&&clean(d.customer_name)).forEach(d=>{
      const phone=normPhone(d.customer_phone),name=normName(d.customer_name),key=phone?`p:${phone}`:`n:${name}`;
      if(!map.has(key))map.set(key,{id:d.customer_id||'',name:clean(d.customer_name),phone:clean(d.customer_phone),address:clean(d.customer_address),notes:'',updated_at:d.updated_at||d.created_at||''});
    });
    return [...map.values()];
  }

  function customerRows(){
    const rows=(S.customers||[]).filter(c=>c.is_active!==false&&clean(c.name));
    return rows.length?rows:fallbackCustomers();
  }

  async function refreshCustomerMaster(force=false){
    if(customerLoad&&!force)return customerLoad;
    if(!S.authUser)return [];
    customerLoad=(async()=>{
      const r=await sb.from('quo_customers').select('id,name,phone,phone_normalized,address,notes,is_active,created_at,updated_at').eq('is_active',true).order('updated_at',{ascending:false}).limit(2000);
      if(r.error){console.warn('Customer master load failed',r.error);return S.customers||[]}
      S.customers=r.data||[];
      return S.customers;
    })();
    try{return await customerLoad}finally{customerLoad=null}
  }
  window.quoRefreshCustomers=refreshCustomerMaster;

  try{
    const baseLoadAll=loadAll;
    loadAll=async function(){
      const result=await baseLoadAll.apply(this,arguments);
      await refreshCustomerMaster(true);
      if(S.view==='customers'||S.view==='editor')render();
      return result;
    };
  }catch(e){}

  try{
    const baseRefreshDocs=refreshDocs;
    refreshDocs=async function(){
      const result=await baseRefreshDocs.apply(this,arguments);
      refreshCustomerMaster(true).catch(()=>{});
      return result;
    };
  }catch(e){}

  function customerScore(row,query,mode){
    const q=clean(query), qName=normName(q), qPhone=normPhone(q), name=normName(row.name), phone=normPhone(row.phone), address=clean(row.address).toLowerCase();
    if(!q)return 1;
    let s=0;
    if(qPhone){
      if(phone===qPhone)s=140;else if(phone.startsWith(qPhone))s=110;else if(phone.includes(qPhone))s=90;
    }
    if(qName){
      if(name===qName)s=Math.max(s,130);else if(name.startsWith(qName))s=Math.max(s,100);else if(name.includes(qName))s=Math.max(s,80);else if(address.includes(qName))s=Math.max(s,45);
    }
    if(mode==='phone'&&qPhone&&phone===qPhone)s+=20;
    return s;
  }

  function customerMatches(query,mode){
    const q=clean(query);
    return customerRows().map(row=>({row,score:customerScore(row,q,mode)})).filter(x=>q?x.score>0:true).sort((a,b)=>b.score-a.score||String(b.row.updated_at||'').localeCompare(String(a.row.updated_at||''))).slice(0,q?7:6).map(x=>x.row);
  }

  function setDirty(){
    S.editorDirty=true;
    try{updateEditorSaveState?.()}catch(e){}
  }

  function closeCustomerResults(){
    document.querySelectorAll('.q64-customer-results').forEach(box=>{box.hidden=true;box.innerHTML=''});
    document.querySelectorAll('.q64-customer-field').forEach(field=>field.classList.remove('open'));
  }

  function useCustomer(row){
    if(!row||!S.current)return;
    const name=document.querySelector('[data-field="customer_name"]'),phone=document.querySelector('[data-field="customer_phone"]'),address=document.querySelector('[data-field="customer_address"]');
    if(name)name.value=row.name||'';if(phone)phone.value=row.phone||'';if(address)address.value=row.address||'';
    Object.assign(S.current,{customer_id:row.id||null,customer_name:row.name||'',customer_phone:row.phone||'',customer_address:row.address||''});
    setDirty();closeCustomerResults();
    document.querySelectorAll('.q64-customer-match').forEach(el=>el.remove());
    try{window.quoRefreshLivePreview?.()}catch(e){}
    try{toast?.(`${row.name} selected`)}catch(e){}
  }

  let activeRows=[],activeIndex=-1,activeInput=null;
  function resultHTML(rows,query,mode){
    if(!rows.length)return '<div class="q64-customer-none">No existing customer match. Keep typing to use a new customer.</div>';
    const qPhone=normPhone(query);
    return rows.map((row,i)=>{
      const exact=mode==='phone'&&qPhone&&normPhone(row.phone)===qPhone;
      return `<button type="button" class="q64-customer-result" data-q64-customer="${i}"><span><b>${esc(row.name)}</b><small>${row.phone?esc(row.phone):'No mobile'}</small></span><em>${exact?'<strong>Exact mobile</strong>':''}${row.address?`<i>${esc(row.address)}</i>`:''}</em></button>`;
    }).join('');
  }

  function ensureResultBox(field){
    field.classList.add('q64-customer-field');
    let box=field.querySelector('.q64-customer-results');
    if(!box){box=document.createElement('div');box.className='q64-customer-results';box.hidden=true;field.appendChild(box)}
    return box;
  }

  function openCustomerResults(input,mode,recent=false){
    const field=input.closest('.field'),box=field&&ensureResultBox(field);if(!box)return;
    const query=clean(input.value);
    if(!query&&!recent){box.hidden=true;field.classList.remove('open');return;}
    activeRows=customerMatches(query,mode);activeIndex=-1;activeInput=input;
    box.innerHTML=`${!query?'<div class="q64-customer-recent">Recent customers</div>':''}${resultHTML(activeRows,query,mode)}`;
    box.hidden=false;field.classList.add('open');
    box.querySelectorAll('[data-q64-customer]').forEach(btn=>btn.onclick=e=>{e.preventDefault();e.stopPropagation();useCustomer(activeRows[Number(btn.dataset.q64Customer)])});
  }

  function customerKeyboard(e){
    const box=e.target.closest('.field')?.querySelector('.q64-customer-results');if(!box||box.hidden)return;
    const buttons=[...box.querySelectorAll('[data-q64-customer]')];
    if(e.key==='Escape'){e.preventDefault();closeCustomerResults();return}
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){
      e.preventDefault();if(!buttons.length)return;
      activeIndex=(activeIndex+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;
      buttons.forEach((b,i)=>b.classList.toggle('active',i===activeIndex));buttons[activeIndex].scrollIntoView({block:'nearest'});return;
    }
    if(e.key==='Enter'&&activeRows.length){e.preventDefault();useCustomer(activeRows[activeIndex>=0?activeIndex:0])}
  }

  function exactPhone(value){const p=normPhone(value);return p?customerRows().find(row=>normPhone(row.phone)===p)||null:null}
  function phoneHint(input){
    document.querySelectorAll('.q64-customer-match').forEach(el=>el.remove());
    const p=normPhone(input.value);if(p.length<7)return;
    const row=exactPhone(input.value);if(!row)return;
    if(normName(document.querySelector('[data-field="customer_name"]')?.value)===normName(row.name))return;
    const hint=document.createElement('button');hint.type='button';hint.className='q64-customer-match';hint.innerHTML=`<span>Existing customer found</span><b>${esc(row.name)}</b><em>Use details</em>`;hint.onclick=e=>{e.preventDefault();useCustomer(row)};input.closest('.field')?.appendChild(hint);
  }

  function installCustomerAutocomplete(){
    if(S.view!=='editor'||!S.current)return;
    const name=document.querySelector('[data-field="customer_name"]'),phone=document.querySelector('[data-field="customer_phone"]');if(!name||!phone)return;
    ensureResultBox(name.closest('.field'));ensureResultBox(phone.closest('.field'));
    name.autocomplete='off';phone.autocomplete='off';phone.inputMode='tel';
    name.onfocus=()=>openCustomerResults(name,'name',true);
    name.oninput=()=>{setDirty();openCustomerResults(name,'name',false)};
    name.onkeydown=customerKeyboard;
    phone.onfocus=()=>openCustomerResults(phone,'phone',true);
    phone.oninput=()=>{setDirty();openCustomerResults(phone,'phone',false);phoneHint(phone)};
    phone.onchange=()=>phoneHint(phone);phone.onkeydown=customerKeyboard;phoneHint(phone);
  }

  function filteredCustomers(){
    const q=clean(S.customerSearch).toLowerCase(),digits=normPhone(q);
    return customerRows().filter(c=>!q||normName(c.name).includes(q)||clean(c.address).toLowerCase().includes(q)||(digits&&normPhone(c.phone).includes(digits)));
  }

  renderCustomers=function(){
    const rows=filteredCustomers();
    return pageHead('Customers','One customer record per mobile number. Edit details once and reuse them in every new document.','<button class="btn primary" type="button" data-q64-new-customer>+ New Customer</button>')+
      `<div class="toolbar-row q64-customer-toolbar"><label class="search"><input id="q64CustomerSearch" value="${esc(S.customerSearch||'')}" placeholder="Search name, mobile or address..."></label><span class="q64-record-count">${rows.length} customer${rows.length===1?'':'s'}</span></div>`+
      `<div class="panel"><div class="table-wrap"><table class="data-table q64-customer-table"><thead><tr><th>Customer</th><th>Mobile</th><th>Address</th><th>Updated</th><th class="actions-col">Actions</th></tr></thead><tbody>${rows.length?rows.map(c=>`<tr><td><strong>${esc(c.name)}</strong></td><td>${c.phone?`<a href="tel:${esc(clean(c.phone).replace(/[^0-9+]/g,''))}">${esc(c.phone)}</a>`:'-'}</td><td>${esc(c.address||'-')}</td><td>${esc(typeof dateTiny==='function'?dateTiny(String(c.updated_at||'').slice(0,10)):'')}</td><td class="row-actions"><button class="table-action" type="button" data-q64-customer-docs="${esc(c.id||'')}" data-name="${esc(c.name)}">Documents</button><button class="table-action" type="button" data-q64-edit-customer="${esc(c.id||'')}">Edit</button></td></tr>`).join(''):'<tr><td colspan="5"><div class="empty">No customers found.</div></td></tr>'}</tbody></table></div></div>`;
  };

  function ensureCustomerModal(){
    let m=document.getElementById('q64CustomerModal');if(m)return m;
    m=document.createElement('div');m.id='q64CustomerModal';m.className='modal hidden';m.innerHTML=`<div class="modal-card q64-customer-modal"><div class="modal-head"><div><div class="eyebrow">CUSTOMER MASTER</div><h2 id="q64CustomerModalTitle">Customer</h2></div><button class="icon-btn" type="button" data-q64-customer-close>×</button></div><div class="form-grid"><div class="field full"><label>Customer / Organisation</label><input id="q64CustomerName"></div><div class="field"><label>Mobile</label><input id="q64CustomerPhone" inputmode="tel"></div><div class="field"><label>Address</label><input id="q64CustomerAddress"></div><div class="field full"><label>Internal Notes</label><textarea id="q64CustomerNotes" placeholder="Optional internal note - not printed on documents"></textarea></div></div><div class="q64-modal-actions"><button class="btn" type="button" data-q64-customer-close>Cancel</button><button class="btn primary" type="button" id="q64CustomerSave">Save Customer</button></div></div>`;document.body.appendChild(m);
    m.querySelectorAll('[data-q64-customer-close]').forEach(b=>b.onclick=()=>m.classList.add('hidden'));
    m.addEventListener('click',e=>{if(e.target===m)m.classList.add('hidden')});
    m.querySelector('#q64CustomerSave').onclick=saveCustomerMaster;
    return m;
  }

  function openCustomerModal(id=''){
    const row=id?customerRows().find(c=>c.id===id):null,m=ensureCustomerModal();m.dataset.customerId=id||'';
    m.querySelector('#q64CustomerModalTitle').textContent=row?'Edit Customer':'New Customer';
    m.querySelector('#q64CustomerName').value=row?.name||'';m.querySelector('#q64CustomerPhone').value=row?.phone||'';m.querySelector('#q64CustomerAddress').value=row?.address||'';m.querySelector('#q64CustomerNotes').value=row?.notes||'';
    m.classList.remove('hidden');setTimeout(()=>m.querySelector('#q64CustomerName')?.focus(),20);
  }

  async function saveCustomerMaster(){
    const m=ensureCustomerModal(),id=m.dataset.customerId||'',name=clean(m.querySelector('#q64CustomerName').value),phone=clean(m.querySelector('#q64CustomerPhone').value),address=clean(m.querySelector('#q64CustomerAddress').value),notes=clean(m.querySelector('#q64CustomerNotes').value),btn=m.querySelector('#q64CustomerSave');
    if(!name){alert('Enter the customer or organisation name.');return}
    btn.disabled=true;btn.textContent='Saving...';
    try{
      const payload={name,phone:phone||null,address:address||null,notes:notes||null,is_active:true};
      const r=id?await sb.from('quo_customers').update(payload).eq('id',id).select('*').single():await sb.from('quo_customers').insert(payload).select('*').single();
      if(r.error)throw r.error;
      await refreshCustomerMaster(true);m.classList.add('hidden');toast(id?'Customer updated':'Customer created');render();
    }catch(e){
      const msg=e?.code==='23505'?'That mobile number already belongs to an existing customer. Search the customer and edit that record instead.':(e?.message||'Could not save customer.');alert(msg);
    }finally{btn.disabled=false;btn.textContent='Save Customer'}
  }

  function resetPager(){docPager.page=0;docPager.total=0;docPager.rows=[];docPager.key='';docPager.error='';clearTimeout(docPager.timer)}
  function smartKind(){return typeof S.smartFilter==='string'?S.smartFilter:S.smartFilter?.kind||''}
  function serverSupported(){return !['pending-payment','paid-payment'].includes(smartKind())}
  function pagerKey(){return JSON.stringify([S.filter||'all',clean(S.search),smartKind(),S.customerFilter?.id||''])}
  function scheduleDocPage(delay=0){if(S.view!=='documents'||!serverSupported())return;clearTimeout(docPager.timer);docPager.timer=setTimeout(loadDocPage,delay)}

  async function loadDocPage(){
    if(S.view!=='documents'||!serverSupported())return;
    const key=pagerKey(),seq=++docPager.seq;docPager.loading=true;docPager.error='';docPager.key=key;
    let q=sb.from('quo_documents').select('*',{count:'exact'}).is('deleted_at',null);
    const kind=smartKind();
    if(S.customerFilter?.id)q=q.eq('customer_id',S.customerFilter.id);
    if(kind==='open-quotes')q=q.eq('document_type','quotation').in('status',typeof QUOTE_OPEN_STATUSES!=='undefined'?QUOTE_OPEN_STATUSES:['Draft','Sent','Follow Up']);
    else if(kind==='quotations')q=q.eq('document_type','quotation');
    else if(kind==='confirmed-quotes')q=q.eq('document_type','quotation').in('status',typeof QUOTE_WON_STATUSES!=='undefined'?QUOTE_WON_STATUSES:['Confirmed']);
    else if(kind==='proforma')q=q.eq('document_type','proforma');
    else if(kind==='invoice')q=q.eq('document_type','invoice');
    else if(!S.customerFilter&&S.filter&&S.filter!=='all')q=q.eq('document_type',S.filter);
    const search=clean(S.search).replace(/[,%()]/g,' ').replace(/\s+/g,' ').trim();
    if(search){const p=`%${search}%`;q=q.or(`document_number.ilike.${p},customer_name.ilike.${p},customer_phone.ilike.${p},status.ilike.${p}`)}
    const from=docPager.page*docPager.size,to=from+docPager.size-1;
    const r=await q.order('updated_at',{ascending:false}).range(from,to);
    if(seq!==docPager.seq)return;
    docPager.loading=false;
    if(r.error){docPager.error=r.error.message||'Could not load documents';docPager.rows=[];docPager.total=0}else{docPager.rows=r.data||[];docPager.total=r.count||0}
    if(S.view==='documents')render();
  }

  const baseRenderDocuments=renderDocuments;
  renderDocuments=function(){
    if(!serverSupported())return baseRenderDocuments();
    const key=pagerKey();if(docPager.key!==key&&!docPager.loading){resetPager();docPager.key=key;scheduleDocPage(0)}
    const label=S.customerFilter?`Documents - ${S.customerFilter.name}`:(S.filter==='all'?'All Documents':CFG[S.filter]?.plural||'Documents');
    const chips=['all','quotation','proforma','invoice','receipt'].map(k=>`<button class="chip ${!S.customerFilter&&S.filter===k?'active':''}" data-q64-doc-filter="${k}">${k==='all'?'All':CFG[k].label}</button>`).join('');
    const totalPages=Math.max(1,Math.ceil(docPager.total/docPager.size)),page=Math.min(docPager.page+1,totalPages);
    const banner=S.customerFilter?`<div class="smart-filter-bar"><span>Customer history: ${esc(S.customerFilter.name)}</span><button type="button" data-q64-clear-customer>Show all documents</button></div>`:(S.smartFilter&&typeof quoSmartLabel==='function'?`<div class="smart-filter-bar"><span>${esc(quoSmartLabel(S.smartFilter))}</span><button type="button" data-q64-clear-smart>Show all</button></div>`:'');
    const content=docPager.loading&&!docPager.rows.length?'<div class="empty">Loading documents...</div>':docPager.error?`<div class="empty">${esc(docPager.error)}</div>`:tableDocs(docPager.rows);
    return pageHead(label,'Search all saved documents. Older records remain available as the database grows.','<button class="btn primary" data-new>+ New Document</button>')+banner+`<div class="toolbar-row"><label class="search"><input id="docSearch" value="${esc(S.search||'')}" placeholder="Search number, customer, mobile or status..."></label><div class="chips">${chips}</div></div><div class="panel">${content}<div class="q64-pagination"><span data-q64-page-status>${docPager.loading?'Loading...':`${docPager.total.toLocaleString()} documents - Page ${page} of ${totalPages}`}</span><div><button class="btn" type="button" data-q64-page="prev" ${docPager.page<=0||docPager.loading?'disabled':''}>Previous</button><button class="btn" type="button" data-q64-page="next" ${(docPager.page+1>=totalPages)||docPager.loading?'disabled':''}>Next</button></div></div></div>`;
  };

  function openCustomerHistory(id,name){S.customerFilter={id,name};S.smartFilter=null;S.view='documents';S.filter='all';S.current=null;S.search='';resetPager();render();scrollTo(0,0)}
  function openServerDoc(id){const d=docPager.rows.find(x=>x.id===id)||(S.docs||[]).find(x=>x.id===id);if(d)openEditor(d)}

  function healthPanel(){
    if(S.role!=='admin')return '';
    return `<section class="panel q64-health-panel"><div class="panel-head"><div><h3>System Health</h3><p>Read-only checks for workflow integrity, customer links and the production PDF engine.</p></div><button class="btn" type="button" data-q64-health>Run System Check</button></div><div id="q64HealthResult"><div class="empty">Run the check after major updates or before important document work.</div></div></section>`;
  }

  try{
    const baseSettings=renderSettings;
    renderSettings=function(){const html=baseSettings();return S.role==='admin'?healthPanel()+html:html};
  }catch(e){}

  async function runHealth(){
    const host=document.getElementById('q64HealthResult'),btn=document.querySelector('[data-q64-health]');if(!host)return;
    btn.disabled=true;btn.textContent='Checking...';host.innerHTML='<div class="empty">Checking database and browser modules...</div>';
    try{
      const r=await sb.rpc('quo_system_health');if(r.error)throw r.error;
      const h=r.data||{},issues=Number(h.documents_without_customer||0)+Number(h.confirmed_quotes_without_proforma||0)+Number(h.converted_proformas_without_invoice||0)+Number(h.receipts_without_invoice||0)+Number(h.duplicate_active_deal_types||0);
      const modules=[['PDF pagination',window.QUO_PDF_PAGINATION_VERSION==='64'],['Preview loop protection',!!document.getElementById('quoPreviewV47Style')||typeof window.quoRefreshLivePreview==='function'],['Customer master',Array.isArray(S.customers)],['Scalable document browser',true]];
      host.innerHTML=`<div class="q64-health-summary ${issues?'bad':'good'}"><b>${issues?'Attention required':'All core checks passed'}</b><span>${Number(h.active_documents||0).toLocaleString()} active documents · ${Number(h.active_customers||0).toLocaleString()} customers</span></div><div class="q64-health-grid"><div><span>Customer links</span><b>${h.documents_without_customer||0}</b><small>documents missing master link</small></div><div><span>Quotation chain</span><b>${h.confirmed_quotes_without_proforma||0}</b><small>confirmed without proforma</small></div><div><span>Proforma chain</span><b>${h.converted_proformas_without_invoice||0}</b><small>converted without invoice</small></div><div><span>Receipt chain</span><b>${h.receipts_without_invoice||0}</b><small>receipt without invoice</small></div><div><span>Deal duplicates</span><b>${h.duplicate_active_deal_types||0}</b><small>duplicate active types</small></div></div><div class="q64-module-checks">${modules.map(([name,ok])=>`<span class="${ok?'ok':'bad'}">${ok?'✓':'!'} ${esc(name)}</span>`).join('')}</div>`;
    }catch(e){host.innerHTML=`<div class="q64-health-summary bad"><b>System check failed</b><span>${esc(e?.message||'Unknown error')}</span></div>`}
    finally{btn.disabled=false;btn.textContent='Run System Check'}
  }

  function bindProduction(){
    installCustomerAutocomplete();
    const customerSearch=document.getElementById('q64CustomerSearch');if(customerSearch)customerSearch.oninput=()=>{S.customerSearch=customerSearch.value;render()};
    document.querySelector('[data-q64-new-customer]')?.addEventListener('click',()=>openCustomerModal(''));
    document.querySelectorAll('[data-q64-edit-customer]').forEach(b=>b.onclick=()=>openCustomerModal(b.dataset.q64EditCustomer));
    document.querySelectorAll('[data-q64-customer-docs]').forEach(b=>b.onclick=()=>openCustomerHistory(b.dataset.q64CustomerDocs,b.dataset.name||'Customer'));

    const search=document.getElementById('docSearch');if(search&&serverSupported())search.oninput=()=>{S.search=search.value;clearTimeout(docSearchTimer);docSearchTimer=setTimeout(()=>{docPager.page=0;docPager.key='';scheduleDocPage(0)},280)};
    document.querySelectorAll('[data-q64-doc-filter]').forEach(b=>b.onclick=()=>{S.filter=b.dataset.q64DocFilter;S.smartFilter=null;S.customerFilter=null;S.search='';resetPager();render()});
    document.querySelector('[data-q64-clear-customer]')?.addEventListener('click',()=>{S.customerFilter=null;S.smartFilter=null;S.filter='all';S.search='';resetPager();render()});
    document.querySelector('[data-q64-clear-smart]')?.addEventListener('click',()=>{S.smartFilter=null;S.customerFilter=null;S.filter='all';S.search='';resetPager();render()});
    document.querySelectorAll('[data-q64-page]').forEach(b=>b.onclick=()=>{const totalPages=Math.max(1,Math.ceil(docPager.total/docPager.size));docPager.page=Math.max(0,Math.min(totalPages-1,docPager.page+(b.dataset.q64Page==='next'?1:-1)));scheduleDocPage(0);render()});

    if(S.view==='documents'&&serverSupported()){
      document.querySelectorAll('.clickable-doc-row').forEach(row=>{
        const id=row.dataset.open;
        row.onclick=e=>{if(e.target.closest('button,a'))return;openServerDoc(id)};
        row.onkeydown=e=>{if((e.key==='Enter'||e.key===' ')&&!e.target.closest('button,a')){e.preventDefault();openServerDoc(id)}};
        row.querySelectorAll('[data-open]').forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();openServerDoc(id)});
        row.querySelectorAll('[data-delete-doc]').forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();const d=docPager.rows.find(x=>x.id===id);if(d&&!(S.docs||[]).some(x=>x.id===id))S.docs.unshift(d);softDeleteDocument?.(id)});
      });
    }

    document.querySelector('[data-q64-health]')?.addEventListener('click',runHealth);
    document.querySelectorAll('.nav [data-view="documents"]').forEach(b=>b.onclick=()=>{S.smartFilter=null;S.customerFilter=null;S.view='documents';S.filter=b.dataset.filter||'all';S.current=null;S.search='';resetPager();render();scrollTo(0,0)});
  }

  try{
    const baseBind=bindDynamic;
    bindDynamic=function(){const result=baseBind.apply(this,arguments);bindProduction();return result};
  }catch(e){}

  document.addEventListener('click',e=>{if(!e.target.closest('.q64-customer-field,.q64-customer-match'))closeCustomerResults()},true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape')document.getElementById('q64CustomerModal')?.classList.add('hidden')});

  if(!document.getElementById('quoProductionV64Style')){
    const st=document.createElement('style');st.id='quoProductionV64Style';st.textContent=`
      .q64-customer-field{position:relative}.q64-customer-field.open{z-index:150}.q64-customer-results{position:absolute;left:0;right:0;top:calc(100% + 4px);z-index:1600;padding:5px;max-height:290px;overflow:auto;border:1px solid #d5dfdb;border-radius:9px;background:#fff;box-shadow:0 16px 38px rgba(25,42,37,.16)}
      .q64-customer-recent{padding:6px 9px 5px;font-size:8px;font-weight:850;letter-spacing:.08em;text-transform:uppercase;color:#7b8783}.q64-customer-result{width:100%;min-height:50px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 10px;border:0;border-bottom:1px solid #edf1ef;border-radius:6px;background:#fff;text-align:left;cursor:pointer}.q64-customer-result:last-child{border-bottom:0}.q64-customer-result:hover,.q64-customer-result.active{background:#f2f8f5}.q64-customer-result span b{display:block;font-size:10.5px;color:#25332f}.q64-customer-result span small{display:block;margin-top:3px;font-size:8.5px;color:#697670}.q64-customer-result em{max-width:48%;display:flex;flex-direction:column;align-items:flex-end;gap:3px;font-style:normal}.q64-customer-result em strong{font-size:7.5px;padding:2px 5px;border-radius:999px;background:#e8f4ef;color:#2e6759}.q64-customer-result em i{font-style:normal;font-size:8px;line-height:1.3;text-align:right;color:#7b8782}.q64-customer-none{padding:10px;font-size:9px;color:#78847f}
      .q64-customer-match{width:100%;min-height:40px;margin-top:6px;display:flex;align-items:center;gap:7px;padding:7px 9px;border:1px solid #cfe1da;border-radius:7px;background:#f1f8f5;color:#48655c;text-align:left;cursor:pointer}.q64-customer-match b{font-size:9px}.q64-customer-match span{font-size:8px;color:#74817c}.q64-customer-match em{margin-left:auto;font-style:normal;font-size:8px;font-weight:850;color:#2e6d60}
      .q64-customer-toolbar{align-items:center}.q64-record-count{font-size:9px;color:#78817e;white-space:nowrap}.q64-customer-table a{color:#356d63;text-decoration:none}.q64-customer-table a:hover{text-decoration:underline}.q64-customer-modal{width:min(620px,calc(100vw - 24px))}.q64-customer-modal textarea{min-height:82px}.q64-modal-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}
      .q64-pagination{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 12px;border-top:1px solid #e5e9e7}.q64-pagination>span{font-size:9px;color:#6f7975}.q64-pagination>div{display:flex;gap:7px}.q64-pagination .btn{min-height:34px}
      .q64-health-panel{margin-bottom:14px}.q64-health-panel .panel-head p{margin:4px 0 0;font-size:9px;color:#78817e}.q64-health-summary{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 13px;border-top:1px solid #e5e9e7}.q64-health-summary.good{background:#f2f8f4;color:#2f644d}.q64-health-summary.bad{background:#fff5f3;color:#8b443d}.q64-health-summary b{font-size:11px}.q64-health-summary span{font-size:9px}.q64-health-grid{display:grid;grid-template-columns:repeat(5,1fr);border-top:1px solid #e5e9e7}.q64-health-grid>div{padding:11px;border-right:1px solid #e8ecea}.q64-health-grid>div:last-child{border-right:0}.q64-health-grid span,.q64-health-grid small{display:block;font-size:8px;color:#78817e}.q64-health-grid b{display:block;margin:4px 0;font-size:15px}.q64-module-checks{display:flex;flex-wrap:wrap;gap:6px;padding:10px 12px;border-top:1px solid #e5e9e7}.q64-module-checks span{padding:4px 7px;border-radius:999px;font-size:8px}.q64-module-checks .ok{background:#edf7f1;color:#35664f}.q64-module-checks .bad{background:#fff1ef;color:#8b443d}
      @media(max-width:760px){.q64-customer-results{position:fixed;left:12px;right:12px;top:auto;bottom:12px;max-height:55vh;border-radius:13px;padding:7px;box-shadow:0 18px 50px rgba(18,32,28,.24)}.q64-customer-result{min-height:58px;align-items:flex-start;flex-direction:column;gap:4px;padding:10px 11px}.q64-customer-result em{max-width:none;align-items:flex-start}.q64-customer-result em i{text-align:left}.q64-customer-match{min-height:44px}.q64-pagination{align-items:flex-start;flex-direction:column}.q64-pagination>div{width:100%}.q64-pagination .btn{flex:1}.q64-health-grid{grid-template-columns:1fr 1fr}.q64-health-grid>div{border-bottom:1px solid #e8ecea}.q64-health-summary{align-items:flex-start;flex-direction:column}}
    `;document.head.appendChild(st);
  }

  setTimeout(()=>{if(S.authUser)refreshCustomerMaster(true).then(()=>{if(S.view==='customers'||S.view==='editor')render()}).catch(()=>{})},250);
})();
