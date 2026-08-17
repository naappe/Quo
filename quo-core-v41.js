/* Quo v41 - canonical workflow/integrity layer.
   Final authority for save validation, dashboard accounting, receipt locking,
   full document loading and workspace defaults. */
(function(){
  const ACTOR='White Saffron';
  const EPS=0.005;

  function maleToday(){
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Indian/Maldives',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    const get=t=>parts.find(p=>p.type===t)?.value||'';
    return `${get('year')}-${get('month')}-${get('day')}`;
  }
  function addDays(iso,days){
    if(!iso)return '';
    const d=new Date(`${iso}T12:00:00+05:00`);d.setUTCDate(d.getUTCDate()+Number(days||0));
    return new Intl.DateTimeFormat('en-CA',{timeZone:'Indian/Maldives',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
  }
  function byUpdated(a,b){return String(b.updated_at||b.created_at||'').localeCompare(String(a.updated_at||a.created_at||''))}
  function active(rows=S.docs||[]){return rows.filter(d=>!d.deleted_at)}
  function invoicePaymentStatus(d){
    if(d.document_type!=='invoice')return 'Not Applicable';
    const c=calc(d);
    if(c.total>0&&c.balance<=EPS)return 'Paid';
    if(c.paid>EPS)return 'Part Paid';
    return d.payment_status&&d.payment_status!=='Not Applicable'?d.payment_status:'Unpaid';
  }
  function dealKey(d){return d.deal_id||d.id||d.source_document_id||null}
  function linkedInvoiceFor(d){
    const key=dealKey(d);if(!key)return null;
    return active().find(x=>x.document_type==='invoice'&&x.status!=='Cancelled'&&(x.deal_id===key||x.source_document_id===d.id));
  }

  /* Status means document workflow only. Payment state is separate. */
  CFG.quotation.statuses=['Draft','Sent','Follow Up','Confirmed','Lost','Expired','Cancelled'];
  CFG.proforma.statuses=['Draft','Sent','Awaiting Payment','Converted','Cancelled'];
  CFG.invoice.statuses=['Draft','Sent','Overdue','Cancelled'];
  CFG.receipt.statuses=['Issued','Cancelled'];

  /* Keep removed advance-payment UI removed without destroying historical data. */
  function canonicalPayload(d){
    return {
      document_number:d.document_number,
      document_type:d.document_type,
      status:d.status||'Draft',
      currency:d.currency||'MVR',
      creation_date:d.creation_date||null,
      expires_on:d.expires_on||null,
      customer_name:d.customer_name||null,
      customer_phone:d.customer_phone||null,
      customer_address:d.customer_address||null,
      event_name:d.event_name||null,
      service_enabled:!!d.service_enabled,
      service_type:d.service_type||null,
      service_from:d.service_from||null,
      service_to:d.service_to||null,
      service_pax:num(d.service_pax),
      service_label:d.service_label||'Service Period',
      venue:d.venue||null,
      items:d.items||[],
      gst_mode:d.gst_mode||'none',
      gst_rate:num(d.gst_rate),
      discount:num(d.discount),
      show_gst:!!d.show_gst,
      include_menu:!!d.include_menu,
      menu_title:d.menu_title||null,
      menu_text:d.menu_text||null,
      use_advance:!!d.use_advance,
      advance_percent:num(d.advance_percent),
      advance_due:d.advance_due||null,
      bank:FIXED.bank,
      account_no:FIXED.account,
      slip_via:'Viber',
      slip_contact:FIXED.viber,
      paid_amount:num(d.paid_amount),
      payment_reference:d.payment_reference||null,
      extra_terms:d.extra_terms||null,
      source_document_id:d.source_document_id||null,
      deal_id:d.deal_id||null,
      payment_status:invoicePaymentStatus(d)
    };
  }

  function validateDocument(d){
    if(!d.creation_date)return 'Enter the Issue Date.';
    if(!String(d.customer_name||'').trim())return 'Enter the customer name.';
    const described=(d.items||[]).filter(i=>String(i.description||'').trim());
    if(!described.length)return 'Add at least one item description.';
    for(const i of described){
      if(num(i.qty)<0)return 'Item quantity cannot be negative.';
      if(num(i.price)<0)return 'Item rate cannot be negative.';
    }
    if(num(d.discount)<0)return 'Discount cannot be negative.';
    if(num(d.gst_rate)<0||num(d.gst_rate)>100)return 'GST must be between 0% and 100%.';
    if(num(d.service_pax)<0)return 'Guest count cannot be negative.';
    const raw=(d.items||[]).reduce((a,i)=>a+num(i.qty)*num(i.price),0);
    if(num(d.discount)>raw+EPS)return 'Discount cannot be greater than the item subtotal.';
    if(d.expires_on&&d.expires_on<d.creation_date)return `${CFG[d.document_type]?.due||'Due date'} cannot be before the Issue Date.`;
    if(d.service_from&&d.service_to&&d.service_to<d.service_from)return 'Service end date cannot be before the start date.';
    return '';
  }

  saveCurrent=async function(showToast=true){
    readEditor();
    const d=S.current;if(!d)return false;
    if(d.document_type==='receipt'&&d.id){toast('Issued receipts are locked. Void the receipt to reverse it.');return false;}
    const error=validateDocument(d);
    if(error){alert(error);return false;}
    const wasNew=!d.id;
    try{
      const p=canonicalPayload(d);
      if(wasNew){
        p.document_number='NEW';
        const r=await sb.from('quo_documents').insert({...p,created_by:null,created_by_name:ACTOR,updated_by:null,updated_by_name:ACTOR}).select('*').single();
        if(r.error)throw r.error;
        S.current={...d,...r.data};
      }else{
        delete p.document_number;delete p.document_type;
        const r=await sb.from('quo_documents').update({...p,updated_by:null,updated_by_name:ACTOR}).eq('id',d.id).select('*').single();
        if(r.error)throw r.error;
        S.current={...d,...r.data};
      }
      await refreshDocs();
      S.editorDirty=false;
      if(showToast)toast(`${S.current.document_number} saved`);
      render();
      return true;
    }catch(e){console.error(e);alert('Save failed: '+(e?.message||'Unknown error'));return false;}
  };

  async function fetchAllActive(){
    const out=[];const page=1000;
    for(let from=0;;from+=page){
      const r=await sb.from('quo_documents').select('*').is('deleted_at',null).order('updated_at',{ascending:false}).range(from,from+page-1);
      if(r.error)throw r.error;
      out.push(...(r.data||[]));
      if((r.data||[]).length<page)break;
    }
    return out;
  }
  refreshDocs=async function(){
    try{S.docs=await fetchAllActive();return {data:S.docs,error:null}}catch(error){console.error(error);return {data:null,error}}
  };
  loadAll=async function(){
    S.loading=true;render();
    try{
      const [docs,sr]=await Promise.all([fetchAllActive(),sb.from('quo_settings').select('*').eq('id',1).maybeSingle()]);
      S.docs=docs;
      if(!sr.error&&sr.data)S.settings={...defaultSettings,...sr.data,bank:FIXED.bank,account_number:FIXED.account,viber:FIXED.viber,phone:FIXED.hotline};
    }catch(e){console.error(e);toast('Could not load documents')}
    S.loading=false;render();
  };

  /* New documents start on the correct Maldives business date. */
  newDocument=function(type){
    if(type==='receipt')return;
    const d=blankDoc(type);const today=maleToday();
    d.creation_date=today;
    const days=Math.max(0,num(S.settings.default_validity_days||7));
    if(CFG[type]?.due)d.expires_on=addDays(today,days);
    d.payment_status=type==='invoice'?'Unpaid':'Not Applicable';
    S.current=d;S.view='editor';S.filter=type;S.editorDirty=false;closeModal();render();scrollTo(0,0);
  };

  /* Financial table: only invoices carry receivables; Proforma is a request, not a second debt. */
  tableDocs=function(rows,compact=false){
    if(!rows.length)return '<div class="empty">No documents found.</div>';
    const actionHead=compact?'':'<th class="actions-col">Actions</th>';
    return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Document</th><th>Customer</th><th>Date</th><th class="num">Total</th><th>Status</th>${actionHead}</tr></thead><tbody>${rows.map(d=>{
      const c=calc(d);const ps=invoicePaymentStatus(d);const rowOpen=compact?` data-open="${d.id}"`:'';
      const pay=d.document_type==='invoice'?`<span class="payment-line ${ps==='Paid'?'paid-line':ps==='Part Paid'?'part-line':'due-line'}">${esc(ps)}${c.balance>EPS?` - Due ${money(c.balance,d.currency)}`:''}</span>`:d.document_type==='receipt'?`<span class="payment-line paid-line">Received ${money(c.total,d.currency)}</span>`:'';
      const actions=compact?'':`<td class="row-actions"><button class="table-action" data-open="${d.id}" type="button">Open</button>${d.document_type==='receipt'?'':`<button class="table-action danger-text" data-delete-doc="${d.id}" type="button">Delete</button>`}</td>`;
      return `<tr${rowOpen}><td><strong>${esc(d.document_number)}</strong><span class="subline">${esc(CFG[d.document_type]?.label||d.document_type)}</span></td><td>${esc(d.customer_name||'No customer')}</td><td>${esc(dateTiny(d.creation_date)||'-')}</td><td class="num">${moneyOnly(c.total)}</td><td><span class="badge ${statusClass(d.status)}">${esc(d.status||'Draft')}</span>${pay}</td>${actions}</tr>`;
    }).join('')}</tbody></table></div>`;
  };

  uniqueCustomers=function(){
    const map=new Map();
    for(const d of active()){
      const key=String(d.customer_name||'').trim().toLowerCase();if(!key)continue;
      const c=calc(d),old=map.get(key)||{name:d.customer_name,phone:d.customer_phone,address:d.customer_address,count:0,total:0,outstanding:0,last:''};
      old.count++;old.total+=c.total;
      if(d.document_type==='invoice'&&d.status!=='Cancelled')old.outstanding+=c.balance;
      if(String(d.updated_at||'')>old.last){old.last=d.updated_at;old.phone=d.customer_phone||old.phone;old.address=d.customer_address||old.address}
      map.set(key,old);
    }
    return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name));
  };

  function stage(type,title,short,rows,metrics){
    const latest=rows[0];
    return `<article class="wf-stage ${type}"><button type="button" class="wf-stage-head" data-workflow-open="${type}"><span class="wf-stage-code">${short}</span><span><b>${title}</b><small>${rows.length} document${rows.length===1?'':'s'}</small></span><span class="wf-stage-arrow">›</span></button><div class="wf-stage-metrics">${metrics.map(([l,v])=>`<span><b>${esc(String(v))}</b><small>${esc(l)}</small></span>`).join('')}</div>${latest?`<button type="button" class="wf-latest" data-open="${latest.id}"><b>${esc(latest.document_number)}</b><span>${esc(latest.customer_name||'No customer')}</span><em class="badge ${statusClass(latest.status)}">${esc(latest.status)}</em></button>`:'<span class="wf-latest empty-copy">No documents yet</span>'}</article>`;
  }
  function queueRow(d,label){const c=calc(d);return `<button type="button" class="wf-queue-row" data-open="${d.id}"><span class="wf-queue-type">${esc(label)}</span><span class="wf-queue-main"><b>${esc(d.document_number)}</b><small>${esc(d.customer_name||'No customer')}</small></span><span class="wf-queue-money">${money(d.document_type==='invoice'?c.balance:c.total,d.currency)}</span><span class="badge ${statusClass(d.status)}">${esc(d.document_type==='invoice'?invoicePaymentStatus(d):d.status)}</span></button>`}

  renderDashboard=function(){
    const docs=active().filter(d=>d.status!=='Cancelled').sort(byUpdated);
    const q=docs.filter(d=>d.document_type==='quotation');
    const p=docs.filter(d=>d.document_type==='proforma');
    const inv=docs.filter(d=>d.document_type==='invoice');
    const rc=docs.filter(d=>d.document_type==='receipt');
    const qOpen=q.filter(d=>['Draft','Sent','Follow Up'].includes(d.status));
    const qConfirmed=q.filter(d=>d.status==='Confirmed');
    const pAwait=p.filter(d=>!['Converted','Cancelled'].includes(d.status));
    const pConverted=p.filter(d=>d.status==='Converted'||!!linkedInvoiceFor(d));
    const invDue=inv.filter(d=>calc(d).balance>EPS);
    const invPaid=inv.filter(d=>invoicePaymentStatus(d)==='Paid');
    const outstanding=invDue.reduce((a,d)=>a+calc(d).balance,0);
    const collected=rc.reduce((a,d)=>a+calc(d).total,0);
    const follow=qOpen.slice(0,8);
    const paymentQueue=invDue.slice().sort(byUpdated).slice(0,8);
    const recent=docs.slice(0,10);
    const stages=`<section class="wf-sequence" aria-label="Commercial workflow">${stage('quotation','Quotations','QT',q,[['Open',qOpen.length],['Confirmed',qConfirmed.length],['Total',q.length]])}<div class="wf-connector">→</div>${stage('proforma','Proforma Invoices','PI',p,[['Active',pAwait.length],['Converted',pConverted.length],['Total',p.length]])}<div class="wf-connector">→</div>${stage('invoice','Invoices','INV',inv,[['Outstanding',invDue.length],['Paid',invPaid.length],['Total',inv.length]])}<div class="wf-connector">→</div>${stage('receipt','Receipts','RC',rc,[['Receipts',rc.length],['Collected',moneyOnly(collected)],['Currency',S.settings.currency||'MVR']])}</section>`;
    const queues=`<section class="wf-queues"><div class="panel wf-panel"><div class="panel-head"><div><h3>Sales Follow-up</h3><p>Quotations that still need action.</p></div><button data-workflow-open="quotation">View quotations</button></div><div class="wf-queue">${follow.length?follow.map(d=>queueRow(d,'Quotation')).join(''):'<div class="empty">No quotation follow-up is pending.</div>'}</div></div><div class="panel wf-panel"><div class="panel-head"><div><h3>Invoice Collection</h3><p>Only real invoices count as money outstanding.</p></div><button data-workflow-open="invoice">View invoices</button></div><div class="wf-queue">${paymentQueue.length?paymentQueue.map(d=>queueRow(d,'Invoice')).join(''):'<div class="empty">No invoice payments are outstanding.</div>'}</div><div class="quo-dashboard-total">Outstanding <b>${money(outstanding,S.settings.currency)}</b></div></div></section>`;
    const recentPanel=`<section class="panel wf-recent"><div class="panel-head"><div><h3>Recent Documents</h3><p>Latest activity across the full document chain.</p></div><button data-go-docs>View all</button></div>${tableDocs(recent,true)}</section>`;
    return pageHead('Dashboard','Quotation → Proforma Invoice → Invoice → Payment → Receipt.','<button class="btn primary" data-new>+ New Document</button>')+stages+queues+recentPanel;
  };

  async function voidReceipt(id){
    const d=(S.docs||[]).find(x=>x.id===id)||S.current;if(!d||d.document_type!=='receipt')return;
    if(!confirm(`Void ${d.document_number}?\n\nThe linked invoice balance will be recalculated automatically.`))return;
    const r=await sb.from('quo_documents').update({status:'Cancelled',updated_by:null,updated_by_name:ACTOR}).eq('id',id).select('*').single();
    if(r.error)return alert('Could not void receipt: '+r.error.message);
    await refreshDocs();toast(`${d.document_number} voided`);goDocuments('receipt');
  }

  function enhanceCoreDOM(){
    document.querySelector('[data-create="receipt"]')?.remove();
    if(S.view!=='editor'||!S.current)return;
    const d=S.current;
    document.querySelectorAll('[data-create-receipt]').forEach(x=>x.remove());
    if(d.document_type==='receipt'&&d.id){
      document.querySelectorAll('[data-field],[data-item-field]').forEach(el=>el.disabled=true);
      document.querySelectorAll('[data-add-item],[data-remove-item],[data-save],[data-duplicate]').forEach(el=>el.remove());
      const del=document.querySelector('[data-delete-current]');
      if(del){del.removeAttribute('data-delete-current');del.dataset.voidReceipt=d.id;del.textContent='Void Receipt';}
      const title=document.querySelector('.editor-title');
      if(title&&!title.querySelector('.quo-locked-note'))title.insertAdjacentHTML('beforeend','<div class="quo-locked-note">Issued receipt - financial details locked</div>');
    }
  }

  const previousBind=bindDynamic;
  bindDynamic=function(){
    previousBind();enhanceCoreDOM();
    $$('[data-workflow-open]').forEach(b=>b.onclick=e=>{e.preventDefault();goDocuments(b.dataset.workflowOpen||'all')});
    $$('.wf-stage [data-open],.wf-queue-row[data-open]').forEach(b=>b.onclick=e=>{e.preventDefault();const d=S.docs.find(x=>x.id===b.dataset.open);if(d)openEditor(d)});
    document.querySelectorAll('[data-void-receipt]').forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();voidReceipt(b.dataset.voidReceipt)});
  };

  if(!document.getElementById('quoCoreV41Style')){
    const st=document.createElement('style');st.id='quoCoreV41Style';st.textContent=`
      .quo-locked-note{margin-top:5px;font-size:9px;font-weight:750;color:#6f7774}
      .quo-dashboard-total{display:flex;justify-content:flex-end;gap:8px;padding:9px 14px;border-top:1px solid #edf0f1;font-size:9px;color:#707875}.quo-dashboard-total b{color:#26302d}
      .badge.converted{background:#eef2f7;color:#617188}.badge.overdue{background:#fff0ee;color:#a34d45}
      .editor-more-menu [data-create-receipt]{display:none!important}
    `;document.head.appendChild(st);
  }

  /* Final cleanup and complete re-fetch after schema/workflow upgrade. */
  S.preparedBy=ACTOR;try{localStorage.setItem('quo_prepared_by',ACTOR)}catch(e){}
  enhanceCoreDOM();
  setTimeout(async()=>{await refreshDocs();if(!S.loading)render()},120);
})();
