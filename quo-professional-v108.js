(function(){
  function displayType(type,plural){
    const labels={
      quotation:['Quotation','Quotations'],
      proforma:['Payment Request','Payment Requests'],
      invoice:['Invoice','Invoices'],
      receipt:['Payment Receipt','Payment Receipts']
    };
    const pair=labels[type];
    if(pair)return pair[plural?1:0];
    return CFG[type]?.[plural?'plural':'label']||'Document';
  }

  titleForView=function(){
    if(S.view==='dashboard')return['QUO','Dashboard'];
    if(S.view==='customers')return['DIRECTORY','Customers'];
    if(S.view==='settings')return['SYSTEM','Settings'];
    if(S.view==='editor')return['DOCUMENT','Editor'];
    const title=S.filter==='all'?'All Documents':displayType(S.filter,true);
    return['DOCUMENTS',title];
  };

  tableDocs=function(rows,compact=false){
    if(!rows.length)return '<div class="empty">No documents found.</div>';
    return `<div class="table-wrap"><table class="data-table professional-doc-table"><thead><tr><th>Document</th><th>Customer</th><th>Date</th><th class="num">Total</th><th class="num balance-col">Balance</th><th>Status</th></tr></thead><tbody>${rows.map(d=>{
      const c=calc(d);
      const hasBalance=['invoice','proforma'].includes(d.document_type)&&d.status!=='Cancelled';
      const balance=hasBalance?moneyOnly(c.balance):'—';
      const balanceClass=hasBalance&&c.balance>0?'open-balance':'settled-balance';
      return `<tr data-open="${d.id}"><td><strong>${esc(d.document_number)}</strong><span class="subline">${esc(displayType(d.document_type,false))}</span></td><td><strong class="customer-name">${esc(d.customer_name||'No customer')}</strong>${d.customer_gst_number?`<span class="subline">GST ${esc(d.customer_gst_number)}</span>`:''}</td><td>${esc(dateTiny(d.creation_date)||'-')}</td><td class="num">${moneyOnly(c.total)}</td><td class="num balance-col ${balanceClass}">${balance}</td><td><span class="badge ${statusClass(d.status)}">${esc(d.status||'Draft')}</span></td></tr>`;
    }).join('')}</tbody></table></div>`;
  };

  renderDocuments=function(){
    const label=S.filter==='all'?'All Documents':displayType(S.filter,true);
    let rows=S.filter==='all'?S.docs:S.docs.filter(d=>d.document_type===S.filter);
    const q=S.search.trim().toLowerCase();
    if(q)rows=rows.filter(d=>[
      d.document_number,d.customer_name,d.customer_phone,d.customer_gst_number,
      d.customer_address,d.status,displayType(d.document_type,false)
    ].some(v=>String(v||'').toLowerCase().includes(q)));
    const chips=['all','quotation','proforma','invoice','receipt'].map(k=>`<button class="chip ${S.filter===k?'active':''}" data-doc-filter="${k}">${k==='all'?'All':displayType(k,false)}</button>`).join('');
    const count=`<span class="result-count">${rows.length.toLocaleString()} ${rows.length===1?'document':'documents'}</span>`;
    return pageHead(label,'Review quotations, payment requests, invoices and receipts from one workspace.','<button class="btn primary" data-new>+ New Document</button>')+
      `<div class="toolbar-row professional-toolbar"><label class="search"><input id="docSearch" value="${esc(S.search)}" placeholder="Search number, customer, GST or status..."></label><div class="chips">${chips}</div>${count}</div><div class="panel">${tableDocs(rows)}</div>`;
  };

  uniqueCustomers=function(){
    const map=new Map();
    for(const d of S.docs){
      const key=String(d.customer_name||'').trim().toLowerCase();
      if(!key)continue;
      const c=calc(d);
      const old=map.get(key)||{name:d.customer_name,gst:'',phone:'',address:'',count:0,total:0,outstanding:0,last:''};
      old.count++;
      old.total+=c.total;
      if(['invoice','proforma'].includes(d.document_type)&&d.status!=='Cancelled')old.outstanding+=c.balance;
      if(String(d.updated_at||'')>=old.last){
        old.last=d.updated_at||old.last;
        old.name=d.customer_name||old.name;
        old.gst=d.customer_gst_number||old.gst;
        old.phone=d.customer_phone||old.phone;
        old.address=d.customer_address||old.address;
      }else{
        old.gst=old.gst||d.customer_gst_number||'';
        old.phone=old.phone||d.customer_phone||'';
        old.address=old.address||d.customer_address||'';
      }
      map.set(key,old);
    }
    return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name));
  };

  renderCustomers=function(){
    const rows=uniqueCustomers();
    const body=rows.length?`<div class="table-wrap"><table class="data-table customer-directory-table"><thead><tr><th>Customer</th><th>GST / TIN</th><th>Contact</th><th class="num">Documents</th><th class="num">Open Balance</th></tr></thead><tbody>${rows.map(c=>`<tr><td><strong>${esc(c.name)}</strong>${c.address?`<span class="subline">${esc(c.address)}</span>`:''}</td><td>${c.gst?esc(c.gst):'<span class="muted">Not recorded</span>'}</td><td>${c.phone?esc(c.phone):'<span class="muted">No phone</span>'}</td><td class="num">${c.count.toLocaleString()}</td><td class="num ${c.outstanding>0?'open-balance':'settled-balance'}">${money(c.outstanding,S.settings.currency)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Customers will appear after documents are saved.</div>';
    return pageHead('Customers','Customer details are consolidated automatically from saved commercial documents.')+`<div class="panel">${body}</div>`;
  };

  renderDashboard=function(){
    const q=S.docs.filter(d=>d.document_type==='quotation');
    const p=S.docs.filter(d=>d.document_type==='proforma');
    const inv=S.docs.filter(d=>d.document_type==='invoice');
    const qAwait=q.filter(d=>['Draft','Sent'].includes(d.status)).length;
    const pAwait=p.filter(d=>calc(d).balance>0&&d.status!=='Cancelled').length;
    const iPaid=inv.filter(d=>calc(d).balance<=0||d.status==='Paid').length;
    const outstanding=[...p,...inv].filter(d=>d.status!=='Cancelled').reduce((a,d)=>a+calc(d).balance,0);
    const outDocs=[...p,...inv].filter(d=>d.status!=='Cancelled'&&calc(d).balance>0).length;
    const recent=S.docs.slice(0,8);
    const today=isoToday();
    const active=S.docs.filter(d=>d.service_enabled&&d.service_to&&d.service_to>=today&&d.status!=='Cancelled').sort((a,b)=>String(a.service_from).localeCompare(String(b.service_from))).slice(0,5);
    return pageHead('Dashboard','A concise view of documents, money due and upcoming White Saffron services.','<button class="btn primary" data-new>+ New Document</button>')+
      `<section class="kpis">${kpi('Quotations',q.length,`${qAwait} awaiting action`,'QT')}${kpi('Payment Requests',p.length,`${pAwait} awaiting payment`,'PR')}${kpi('Invoices',inv.length,`${iPaid} paid`,'INV')}${kpi('Outstanding',money(outstanding,S.settings.currency),`${outDocs} open documents`,'MVR','money')}</section>`+
      `<section class="dashboard-grid"><div class="panel"><div class="panel-head"><div><h3>Recent Documents</h3><p>Latest commercial activity</p></div><button data-go-docs>View all</button></div>${tableDocs(recent,true)}</div><div class="panel"><div class="panel-head"><div><h3>Upcoming Services</h3><p>Scheduled catering and service dates</p></div></div><div class="upcoming">${active.length?active.map(eventCard).join(''):'<div class="empty">No upcoming catering services.</div>'}</div></div></section>`;
  };
})();
