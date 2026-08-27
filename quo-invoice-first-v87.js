/* Quo v87 - invoice-first customer workflow. Payment receipts remain audit/payment records. */
(function(){
  if(typeof S==='undefined')return;
  const EPS=.005;
  const inactive=new Set(['Cancelled','Superseded']);
  const active=()=> (S.docs||[]).filter(d=>!d.deleted_at&&!inactive.has(String(d.status||'')));
  const updated=(a,b)=>String(b.updated_at||b.created_at||'').localeCompare(String(a.updated_at||a.created_at||''));
  const total=d=>{try{return Number(calc(d)?.total||0)}catch(e){return 0}};
  const balance=d=>{try{return Number(calc(d)?.balance||0)}catch(e){return 0}};
  const cur=()=>S.settings?.currency||'MVR';
  const amt=v=>money(Number(v||0),cur());

  function go(type){S.view='documents';S.filter=type;S.current=null;S.search='';S.smartFilter=null;render();scrollTo(0,0)}
  function open(id){const d=(S.docs||[]).find(x=>x.id===id);if(d)openEditor(d)}

  function card(type,no,code,title,help,main,label,foot){
    return `<article class="q83-stage q87-stage" data-q87-stage="${type}" role="button" tabindex="0">
      <div class="q83-stage-top"><span class="q83-step">${no}</span><span class="q83-code">${code}</span><span class="q83-stage-arrow">→</span></div>
      <h3>${esc(title)}</h3><p>${esc(help)}</p>
      <div class="q83-stage-main"><b>${esc(String(main))}</b><span>${esc(label)}</span></div>
      <div class="q83-stage-foot">${foot.map(([l,v])=>`<span><b>${esc(String(v))}</b> ${esc(l)}</span>`).join('')}</div>
    </article>`;
  }

  function row(d,kind){
    const c=calc(d),isInv=d.document_type==='invoice';
    const state=isInv?(c.balance<=EPS?'Paid':c.paid>EPS?'Part Paid':'Unpaid'):(d.status||'Draft');
    return `<button type="button" class="q83-work-row" data-q87-doc="${esc(d.id)}"><span class="q83-work-kind">${esc(kind)}</span><span class="q83-work-main"><b>${esc(d.document_number)}</b><small>${esc(d.customer_name||'No customer')}</small></span><span class="q83-work-date">${esc(dateTiny(d.creation_date)||'-')}</span><span class="q83-work-money">${amt(isInv?c.balance:c.total)}</span><span class="badge ${statusClass(d.status)}">${esc(state)}</span><span class="q83-edit">Edit</span></button>`;
  }

  function recent(rows){
    if(!rows.length)return '<div class="empty">No customer documents yet.</div>';
    return `<div class="table-wrap"><table class="data-table q83-recent-table"><thead><tr><th>Document</th><th>Customer</th><th>Date</th><th class="num">Total</th><th>Status</th><th></th></tr></thead><tbody>${rows.map(d=>{const c=calc(d);const label=d.document_type==='proforma'?'Payment Request':CFG[d.document_type]?.label||d.document_type;const state=d.document_type==='invoice'?(c.balance<=EPS?'Paid':c.paid>EPS?'Part Paid':'Unpaid'):(d.status||'Draft');return `<tr><td><strong>${esc(d.document_number)}</strong><span class="subline">${esc(label)}</span></td><td>${esc(d.customer_name||'No customer')}</td><td>${esc(dateTiny(d.creation_date)||'-')}</td><td class="num">${moneyOnly(c.total)}</td><td><span class="badge ${statusClass(d.status)}">${esc(state)}</span></td><td class="row-actions"><button type="button" class="table-action" data-q87-doc="${esc(d.id)}">Edit</button></td></tr>`}).join('')}</tbody></table></div>`;
  }

  renderDashboard=function(){
    const docs=active().sort(updated),commercial=docs.filter(d=>d.document_type!=='receipt');
    const q=docs.filter(d=>d.document_type==='quotation'),p=docs.filter(d=>d.document_type==='proforma'),inv=docs.filter(d=>d.document_type==='invoice'),receipts=docs.filter(d=>d.document_type==='receipt');
    const qNeed=q.filter(d=>['Draft','Sent','Follow Up'].includes(d.status));
    const qConfirmed=q.filter(d=>['Confirmed','Accepted'].includes(d.status));
    const pActive=p.filter(d=>d.status!=='Converted');
    const invDue=inv.filter(d=>balance(d)>EPS),invPaid=inv.filter(d=>total(d)>0&&balance(d)<=EPS);
    const outstanding=invDue.reduce((s,d)=>s+balance(d),0),invoiced=inv.reduce((s,d)=>s+total(d),0),collected=receipts.reduce((s,d)=>s+total(d),0);
    const stages=[
      card('quotation','01','QT','Quotation','Prepare the offer and get customer confirmation.',qNeed.length,'Need attention',[['Total',q.length],['Confirmed',qConfirmed.length]]),
      card('proforma','02','PI','Payment Request','Use when you need to request payment before the final invoice.',pActive.length,'Active requests',[['Total',p.length],['Converted',p.filter(d=>d.status==='Converted').length]]),
      card('invoice','03','INV','Invoice','Final customer document. Record payment here and give the paid invoice to the customer.',amt(outstanding),'Outstanding',[['Total',inv.length],['Paid',invPaid.length]])
    ].join('<div class="q87-arrow" aria-hidden="true">→</div>');
    const quoteQueue=qNeed.slice(0,6),invoiceQueue=invDue.slice().sort(updated).slice(0,6);
    return `${pageHead('Dashboard','Customer workflow: Quotation → Payment Request (when needed) → Invoice. Payment records stay in the background.')}
      <section class="q83-overview q87-overview"><div><span>Invoices</span><b>${amt(invoiced)}</b><small>${inv.length} final invoice${inv.length===1?'':'s'}</small></div><div class="q83-important"><span>Outstanding</span><b>${amt(outstanding)}</b><small>${invDue.length} invoice${invDue.length===1?'':'s'} to collect</small></div><div><span>Collected</span><b>${amt(collected)}</b><small>${receipts.length} recorded payment${receipts.length===1?'':'s'}</small></div></section>
      <section class="q83-section-head"><div><span>CUSTOMER WORKFLOW</span><h2>From quotation to final invoice</h2><p>Payment receipt is not a required customer step.</p></div></section>
      <section class="q87-flow">${stages}</section>
      <section class="q83-section-head q83-attention-head"><div><span>NEEDS ATTENTION</span><h2>What to work on next</h2></div></section>
      <section class="q83-work-grid"><article class="panel q83-work-panel"><div class="panel-head"><div><h3>Quotation Follow-up</h3><p>Offers still waiting for action.</p></div><button type="button" data-q87-stage="quotation">View quotations</button></div><div class="q83-work-list">${quoteQueue.length?quoteQueue.map(d=>row(d,'Quotation')).join(''):'<div class="q83-clear"><b>All clear</b><span>No quotation follow-up is pending.</span></div>'}</div></article><article class="panel q83-work-panel"><div class="panel-head"><div><h3>Invoice Collection</h3><p>Final invoices with money still due.</p></div><button type="button" data-q87-stage="invoice">View invoices</button></div><div class="q83-work-list">${invoiceQueue.length?invoiceQueue.map(d=>row(d,'Invoice')).join(''):'<div class="q83-clear"><b>All clear</b><span>No invoice payment is outstanding.</span></div>'}</div>${invoiceQueue.length?`<div class="q83-panel-total"><span>Total outstanding</span><b>${amt(outstanding)}</b></div>`:''}</article></section>
      <section class="panel q83-recent"><div class="panel-head"><div><h3>Recent Customer Documents</h3><p>Quotations, payment requests and invoices only.</p></div><button type="button" data-q87-all>View all documents</button></div>${recent(commercial.slice(0,8))}</section>`;
  };

  function arrangeNav(){
    const nav=document.querySelector('.sidebar .nav');if(!nav)return;
    const dashboard=nav.querySelector('[data-view="dashboard"]'),all=nav.querySelector('[data-view="documents"][data-filter="all"]'),q=nav.querySelector('[data-filter="quotation"]'),p=nav.querySelector('[data-filter="proforma"]'),inv=nav.querySelector('[data-filter="invoice"]'),rc=nav.querySelector('[data-filter="receipt"]'),trash=nav.querySelector('[data-view="trash"]'),supply=nav.querySelector('[data-view="supply-usage"]'),customers=nav.querySelector('[data-view="customers"]'),settings=nav.querySelector('[data-view="settings"]');
    if(!dashboard||!q||!p||!inv||!rc)return;
    nav.innerHTML='';const label=t=>{const x=document.createElement('div');x.className='nav-label';x.textContent=t;return x};
    nav.append(dashboard,label('Workflow'),q,p,inv,label('Records'));
    if(all)nav.append(all);rc.querySelector('span:last-child')&&(rc.querySelector('span:last-child').textContent='Payment Records');nav.append(rc);if(trash)nav.append(trash);
    if(supply){nav.append(label('Operations'),supply)}if(customers){nav.append(label('Directory'),customers)}if(settings){nav.append(label('System'),settings)}
  }

  function paymentCopy(){
    const confirm=document.getElementById('quoPayConfirm');if(confirm&&confirm.textContent!=='Recording...')confirm.textContent='Record Payment';
    const note=document.querySelector('.quo-payment-method-note');if(note)note.innerHTML='<b>Reference number is optional.</b> The payment is recorded against this invoice. The customer can use the updated paid invoice; a payment record is kept automatically for audit history.';
    document.querySelectorAll('.quo-payment-history-row em').forEach(el=>el.textContent='View record');
    document.querySelectorAll('[data-open-payment-receipt]').forEach(el=>{el.textContent=el.textContent.replace('Receipt','Payment Record')});
  }

  const previousBind=bindDynamic;
  bindDynamic=function(){const result=previousBind.apply(this,arguments);arrangeNav();paymentCopy();document.querySelectorAll('[data-q87-stage]').forEach(el=>{const act=()=>go(el.dataset.q87Stage);el.onclick=e=>{e.preventDefault();act()};el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();act()}}});document.querySelectorAll('[data-q87-doc]').forEach(el=>el.onclick=e=>{e.preventDefault();open(el.dataset.q87Doc)});document.querySelector('[data-q87-all]')?.addEventListener('click',()=>go('all'));return result;};

  arrangeNav();paymentCopy();
  const st=document.createElement('style');st.id='quoInvoiceFirstV87Style';st.textContent=`.q87-overview{grid-template-columns:repeat(3,1fr)!important}.q87-flow{display:grid;grid-template-columns:minmax(0,1fr) 30px minmax(0,1fr) 30px minmax(0,1fr);align-items:stretch;margin-bottom:18px}.q87-arrow{display:flex;align-items:center;justify-content:center;color:#96a19d;font-size:18px}.q87-stage p{min-height:38px}.q87-stage:last-child .q83-stage-arrow{display:none}@media(max-width:900px){.q87-flow{grid-template-columns:1fr}.q87-arrow{transform:rotate(90deg);min-height:24px}.q87-overview{grid-template-columns:1fr!important}}`;document.head.appendChild(st);
  if(!S.loading&&S.view==='dashboard')render();
})();
