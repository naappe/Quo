/* Quo v111 — final renderer for the approved warm-neutral / saffron mockup. */
(function(){
  const EPS=.005;
  document.documentElement.classList.add('quo-v110');

  function ensureFinalCss(){
    let link=document.getElementById('quoMockupV110Css');
    if(link)return;
    link=document.createElement('link');
    link.id='quoMockupV110Css';
    link.rel='stylesheet';
    link.href='./quo-mockup-v110.css?v=110';
    document.head.appendChild(link);
  }
  ensureFinalCss();

  const labelFor=(type,plural=false)=>({
    quotation:plural?'Quotations':'Quotation',
    proforma:plural?'Payment Requests':'Payment Request',
    invoice:plural?'Invoices':'Invoice',
    receipt:plural?'Payments':'Payment'
  }[type]||(CFG[type]?.[plural?'plural':'label']||'Document'));

  const activeDocs=()=> (S.docs||[]).filter(d=>!d.deleted_at&&d.status!=='Cancelled'&&d.status!=='Superseded');
  const totalOf=d=>{try{return Number(calc(d)?.total||0)}catch(_){return 0}};
  const balanceOf=d=>{try{return Number(calc(d)?.balance||0)}catch(_){return 0}};
  const currencyOf=d=>d?.currency||S.settings?.currency||'MVR';

  function stateFor(d){
    const c=calc(d);
    if(d.document_type==='receipt')return {text:d.status==='Cancelled'?'Cancelled':'Paid',cls:d.status==='Cancelled'?'unpaid':'paid'};
    if(['invoice','proforma'].includes(d.document_type)){
      if(c.total>0&&c.balance<=EPS)return {text:'Paid',cls:'paid'};
      if(c.paid>EPS&&c.balance>EPS)return {text:'Part Paid',cls:'part-paid'};
      if(c.balance>EPS)return {text:d.status==='Overdue'?'Overdue':'Unpaid',cls:'unpaid'};
    }
    const text=d.status||'Draft';
    const cls=/paid|issued|confirmed|accepted/i.test(text)?'paid':/sent|awaiting|follow/i.test(text)?'part-paid':/cancel|expired|overdue/i.test(text)?'unpaid':'';
    return {text,cls};
  }

  function documentRows(rows){
    if(!rows.length)return '<div class="empty">No documents found.</div>';
    return `<div class="mock-card"><div class="table-wrap"><table class="mock-table"><thead><tr><th>Number</th><th>Customer</th><th>Date</th><th class="r">Total</th><th class="r">Balance</th><th>Status</th></tr></thead><tbody>${rows.map((d,i)=>{
      const c=calc(d),state=stateFor(d),balance=d.document_type==='receipt'?'—':money(c.balance,currencyOf(d));
      return `<tr data-open="${esc(d.id)}"${i===0?' class="selected"':''}><td class="num">${esc(d.document_number||'Draft')}</td><td>${esc(d.customer_name||'No customer')}${d.customer_gst_number?`<span class="subline">GST ${esc(d.customer_gst_number)}</span>`:''}</td><td class="mut">${esc(dateShort(d.creation_date)||'-')}</td><td class="r">${money(c.total,currencyOf(d))}</td><td class="r mut">${balance}</td><td><span class="pill ${state.cls}">${esc(state.text)}</span></td></tr>`;
    }).join('')}</tbody></table></div></div>`;
  }

  function recentRows(rows){
    if(!rows.length)return '<div class="empty">No documents yet.</div>';
    return `<div class="mock-card"><div class="table-wrap"><table class="mock-table"><thead><tr><th>Recent</th><th>Customer</th><th class="r">Amount</th><th>Status</th></tr></thead><tbody>${rows.map(d=>{
      const state=stateFor(d);
      return `<tr data-open="${esc(d.id)}"><td class="num">${esc(d.document_number||'Draft')}</td><td>${esc(d.customer_name||'No customer')}</td><td class="r">${money(totalOf(d),currencyOf(d))}</td><td><span class="pill ${state.cls}">${esc(state.text)}</span></td></tr>`;
    }).join('')}</tbody></table></div></div>`;
  }

  function customerRows(){
    const map=new Map();
    for(const d of activeDocs()){
      const key=String(d.customer_name||'').trim().toLowerCase();
      if(!key)continue;
      const old=map.get(key)||{name:d.customer_name,gst:'',outstanding:0,last:''};
      if(['invoice','proforma'].includes(d.document_type))old.outstanding+=balanceOf(d);
      const stamp=String(d.updated_at||d.created_at||'');
      if(stamp>=old.last){old.last=stamp;old.name=d.customer_name||old.name;old.gst=d.customer_gst_number||old.gst}
      else old.gst=old.gst||d.customer_gst_number||'';
      map.set(key,old);
    }
    return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name));
  }

  function renderPayments(){
    const rows=activeDocs().filter(d=>d.document_type==='receipt');
    if(!rows.length)return '<div class="mock-card"><div class="empty">No payments recorded yet.</div></div>';
    return `<div class="mock-card"><div class="table-wrap"><table class="mock-table"><thead><tr><th>Receipt</th><th>Invoice</th><th>Date</th><th class="r">Amount</th></tr></thead><tbody>${rows.map(d=>{
      const source=(S.docs||[]).find(x=>x.id===d.source_document_id);
      return `<tr data-open="${esc(d.id)}"><td class="num">${esc(d.document_number||'Receipt')}</td><td>${esc(source?.document_number||'Standalone')}</td><td class="mut">${esc(dateShort(d.creation_date)||'-')}</td><td class="r">${money(totalOf(d),currencyOf(d))}</td></tr>`;
    }).join('')}</tbody></table></div></div>`;
  }

  titleForView=function(){
    if(S.view==='dashboard')return['QUO','Dashboard'];
    if(S.view==='customers')return['QUO','Customers'];
    if(S.view==='settings')return['QUO','Settings'];
    if(S.view==='trash')return['QUO','Trash'];
    if(S.view==='supply-usage')return['QUO','Catering Supplies'];
    if(S.view==='editor')return['QUO',labelFor(S.current?.document_type||S.filter,false)];
    if(S.view==='documents'&&S.filter==='receipt')return['QUO','Payments'];
    if(S.view==='documents'&&S.filter==='all')return['QUO','Documents'];
    return['QUO',labelFor(S.filter,true)];
  };

  renderDashboard=function(){
    const docs=activeDocs();
    const invoiceLike=docs.filter(d=>['invoice','proforma'].includes(d.document_type));
    const outstanding=invoiceLike.reduce((sum,d)=>sum+balanceOf(d),0);
    const cutoff=new Date();cutoff.setDate(cutoff.getDate()-30);
    const cutoffIso=cutoff.toISOString().slice(0,10);
    const receipts=docs.filter(d=>d.document_type==='receipt');
    const collected30=receipts.filter(d=>String(d.creation_date||'')>=cutoffIso).reduce((sum,d)=>sum+totalOf(d),0);
    const drafts=docs.filter(d=>String(d.status||'').toLowerCase()==='draft').length;
    const recent=docs.slice().sort((a,b)=>String(b.updated_at||b.created_at||'').localeCompare(String(a.updated_at||a.created_at||''))).slice(0,8);
    return `<div class="stat-grid">
      <div class="stat"><div class="v">${money(outstanding,S.settings.currency)}</div><div class="l">Outstanding</div></div>
      <div class="stat"><div class="v ok">${money(collected30,S.settings.currency)}</div><div class="l">Collected (30d)</div></div>
      <div class="stat"><div class="v">${drafts.toLocaleString()}</div><div class="l">Draft documents</div></div>
    </div>${recentRows(recent)}`;
  };

  renderDocuments=function(){
    if(S.filter==='receipt')return renderPayments();
    let rows=S.filter==='all'?activeDocs():activeDocs().filter(d=>d.document_type===S.filter);
    const q=String(S.search||'').trim().toLowerCase();
    if(q)rows=rows.filter(d=>[d.document_number,d.customer_name,d.customer_phone,d.customer_gst_number,d.status,labelFor(d.document_type,false)].some(v=>String(v||'').toLowerCase().includes(q)));
    const placeholder=S.filter==='all'?'Search customer or number…':`Search ${labelFor(S.filter,true).toLowerCase()}…`;
    return `<div class="mock-toolbar"><input class="mock-search" id="docSearch" value="${esc(S.search||'')}" placeholder="${esc(placeholder)}"><span class="mock-result-count">${rows.length.toLocaleString()} ${rows.length===1?'record':'records'}</span></div>${documentRows(rows)}`;
  };

  renderCustomers=function(){
    const rows=customerRows();
    if(!rows.length)return '<div class="mock-card"><div class="empty">Customers will appear after documents are saved.</div></div>';
    return `<div class="mock-card"><div class="table-wrap"><table class="mock-table"><thead><tr><th>Name</th><th>GST</th><th class="r">Open balance</th></tr></thead><tbody>${rows.map(c=>`<tr><td class="num" style="text-align:left">${esc(c.name)}</td><td class="mut">${c.gst?esc(c.gst):'—'}</td><td class="r">${money(c.outstanding,S.settings.currency)}</td></tr>`).join('')}</tbody></table></div></div>`;
  };

  function buttonContent(button,icon,text){
    if(!button)return;
    button.innerHTML=`<span class="nav-icon">${icon}</span><span class="nav-text">${text}</span>`;
  }

  function arrangeNavigation(){
    const nav=document.querySelector('.sidebar .nav');
    if(!nav)return;
    const dashboard=nav.querySelector('[data-view="dashboard"]');
    const all=nav.querySelector('[data-view="documents"][data-filter="all"]');
    const quotations=nav.querySelector('[data-view="documents"][data-filter="quotation"]');
    const requests=nav.querySelector('[data-view="documents"][data-filter="proforma"]');
    const invoices=nav.querySelector('[data-view="documents"][data-filter="invoice"]');
    const payments=nav.querySelector('[data-view="documents"][data-filter="receipt"]');
    const customers=nav.querySelector('[data-view="customers"]');
    const supply=nav.querySelector('[data-view="supply-usage"]');
    const trash=nav.querySelector('[data-view="trash"]');
    const settings=nav.querySelector('[data-view="settings"]');
    if(!dashboard||!all||!quotations||!requests||!invoices||!payments||!customers)return;

    [dashboard,all,customers,payments].forEach(b=>{b.classList.remove('nav-sub','nav-secondary');b.classList.add('nav-main')});
    [quotations,requests,invoices].forEach(b=>{b.classList.remove('nav-main','nav-secondary');b.classList.add('nav-sub')});
    [supply,trash,settings].filter(Boolean).forEach(b=>{b.classList.remove('nav-main','nav-sub');b.classList.add('nav-secondary')});

    buttonContent(dashboard,'▦','Dashboard');
    buttonContent(all,'▤','Documents');
    buttonContent(quotations,'','· Quotations');
    buttonContent(requests,'','· Payment Requests');
    buttonContent(invoices,'','· Invoices');
    buttonContent(customers,'◉','Customers');
    buttonContent(payments,'▭','Payments');
    if(supply)buttonContent(supply,'↳','Catering Supplies');
    if(trash)buttonContent(trash,'⌫','Trash');
    if(settings)buttonContent(settings,'⚙','Settings');

    nav.innerHTML='';
    nav.append(dashboard,all,quotations,requests,invoices,customers,payments);
    const spacer=document.createElement('div');spacer.className='nav-spacer';nav.append(spacer);
    if(supply)nav.append(supply);if(trash)nav.append(trash);if(settings)nav.append(settings);
    setActiveNav();
  }

  function syncBrand(){
    const mark=document.querySelector('.side-brand .mark');
    if(mark){mark.textContent='Q';mark.removeAttribute('style')}
    const strong=document.querySelector('.side-brand strong');if(strong)strong.textContent='Quo';
  }

  function syncLogin(){
    const mark=document.querySelector('.quo-login-mark');if(mark)mark.textContent='Q';
    const brand=document.querySelector('.quo-login-brand b');if(brand)brand.textContent='Quo';
  }

  function syncTopAction(){
    const btn=document.getElementById('newDocBtn');if(!btn)return;
    btn.hidden=false;
    if(S.view==='documents'&&S.filter==='quotation')btn.textContent='+ New Quotation';
    else if(S.view==='documents'&&S.filter==='proforma')btn.textContent='+ Payment Request';
    else if(S.view==='documents'&&S.filter==='invoice')btn.textContent='+ New Invoice';
    else if(S.view==='documents'&&S.filter==='receipt')btn.textContent='+ New Document';
    else btn.textContent='+ New Document';
  }

  function syncCurrentViewLabels(){
    if(S.view==='documents'&&S.filter==='receipt'){
      const title=document.getElementById('topTitle');if(title)title.textContent='Payments';
    }
  }

  function syncFinalShell(){
    arrangeNavigation();
    syncBrand();
    syncLogin();
    syncTopAction();
    syncCurrentViewLabels();
  }

  const previousBind=bindDynamic;
  bindDynamic=function(){
    const result=previousBind.apply(this,arguments);
    syncFinalShell();
    return result;
  };

  /* Some legacy modules wrap render() and change labels after bindDynamic() returns.
     Keep this wrapper outermost so the approved v110 shell always wins last. */
  const previousRender=render;
  render=function(){
    const result=previousRender.apply(this,arguments);
    syncFinalShell();
    return result;
  };

  syncFinalShell();
  setTimeout(syncLogin,0);
  setTimeout(syncLogin,250);

  if(typeof render==='function'&&!S.loading)render();
})();