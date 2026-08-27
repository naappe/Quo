/* Quo v83 - professional workflow dashboard and navigation sequence. No DOM observers. */
(function(){
  if(typeof S==='undefined')return;
  const EPS=.005;
  const INACTIVE=new Set(['Cancelled','Superseded']);

  const activeDocs=()=> (S.docs||[]).filter(d=>!d.deleted_at&&!INACTIVE.has(String(d.status||'')));
  const updated=(a,b)=>String(b.updated_at||b.created_at||'').localeCompare(String(a.updated_at||a.created_at||''));
  const totalOf=d=>{try{return Number(calc(d)?.total||0)}catch(e){return 0}};
  const balanceOf=d=>{try{return Number(calc(d)?.balance||0)}catch(e){return 0}};
  const currency=()=>S.settings?.currency||'MVR';
  const m=v=>money(Number(v||0),currency());

  function goStage(type){
    S.view='documents';S.filter=type;S.current=null;S.search='';S.smartFilter=null;
    render();scrollTo(0,0);
  }
  function goAll(){S.view='documents';S.filter='all';S.current=null;S.search='';S.smartFilter=null;render();scrollTo(0,0)}
  function openDoc(id){const d=(S.docs||[]).find(x=>x.id===id);if(d)openEditor(d)}

  function stageCard({type,no,code,title,help,total,primaryLabel,primaryValue,secondary}){
    return `<article class="q83-stage q83-${type}" data-q83-stage="${type}" role="button" tabindex="0" aria-label="View ${esc(title)}">
      <div class="q83-stage-top"><span class="q83-step">${no}</span><span class="q83-code">${code}</span><span class="q83-stage-arrow">→</span></div>
      <h3>${esc(title)}</h3><p>${esc(help)}</p>
      <div class="q83-stage-main"><b>${esc(String(primaryValue))}</b><span>${esc(primaryLabel)}</span></div>
      <div class="q83-stage-foot"><span><b>${esc(String(total))}</b> Total</span>${secondary.map(x=>`<span><b>${esc(String(x[1]))}</b> ${esc(x[0])}</span>`).join('')}</div>
    </article>`;
  }

  function attentionRow(d,kind){
    const c=calc(d),isInvoice=d.document_type==='invoice';
    const amount=isInvoice?c.balance:c.total;
    const status=isInvoice?(c.balance<=EPS?'Paid':Number(d.paid_amount||0)>EPS?'Part Paid':'Unpaid'):(d.status||'Draft');
    return `<button type="button" class="q83-work-row" data-q83-doc="${esc(d.id)}">
      <span class="q83-work-kind">${esc(kind)}</span>
      <span class="q83-work-main"><b>${esc(d.document_number||'Document')}</b><small>${esc(d.customer_name||'No customer')}</small></span>
      <span class="q83-work-date">${esc(dateTiny(d.creation_date)||'-')}</span>
      <span class="q83-work-money">${m(amount)}</span>
      <span class="badge ${statusClass(d.status)}">${esc(status)}</span>
      <span class="q83-edit">Edit</span>
    </button>`;
  }

  function recentTable(rows){
    if(!rows.length)return '<div class="empty">No documents yet.</div>';
    return `<div class="table-wrap"><table class="data-table q83-recent-table"><thead><tr><th>Document</th><th>Customer</th><th>Date</th><th class="num">Total</th><th>Status</th><th></th></tr></thead><tbody>${rows.map(d=>{
      const label=d.document_type==='proforma'?'Payment Request':d.document_type==='receipt'?'Payment Receipt':CFG[d.document_type]?.label||d.document_type;
      const action=d.document_type==='receipt'?'View':'Edit';
      return `<tr><td><strong>${esc(d.document_number)}</strong><span class="subline">${esc(label)}</span></td><td>${esc(d.customer_name||'No customer')}</td><td>${esc(dateTiny(d.creation_date)||'-')}</td><td class="num">${moneyOnly(totalOf(d))}</td><td><span class="badge ${statusClass(d.status)}">${esc(d.status||'Draft')}</span></td><td class="row-actions"><button type="button" class="table-action" data-q83-doc="${esc(d.id)}">${action}</button></td></tr>`;
    }).join('')}</tbody></table></div>`;
  }

  renderDashboard=function(){
    const docs=activeDocs().sort(updated);
    const q=docs.filter(d=>d.document_type==='quotation');
    const p=docs.filter(d=>d.document_type==='proforma');
    const inv=docs.filter(d=>d.document_type==='invoice');
    const rc=docs.filter(d=>d.document_type==='receipt');

    const qNeed=q.filter(d=>['Draft','Sent','Follow Up'].includes(d.status));
    const qConfirmed=q.filter(d=>['Confirmed','Accepted'].includes(d.status));
    const pNeed=p.filter(d=>!['Converted'].includes(d.status));
    const pConverted=p.filter(d=>d.status==='Converted');
    const invDue=inv.filter(d=>balanceOf(d)>EPS);
    const invPaid=inv.filter(d=>totalOf(d)>0&&balanceOf(d)<=EPS);

    const outstanding=invDue.reduce((s,d)=>s+balanceOf(d),0);
    const quoted=q.reduce((s,d)=>s+totalOf(d),0);
    const invoiced=inv.reduce((s,d)=>s+totalOf(d),0);
    const collected=rc.reduce((s,d)=>s+totalOf(d),0);

    const stages=[
      stageCard({type:'quotation',no:'01',code:'QT',title:'Quotations',help:'Prepare the offer and follow up with the customer.',total:q.length,primaryLabel:'Need attention',primaryValue:qNeed.length,secondary:[['Confirmed',qConfirmed.length]]}),
      stageCard({type:'proforma',no:'02',code:'PI',title:'Payment Requests',help:'Request payment after the customer confirms the quotation.',total:p.length,primaryLabel:'Active requests',primaryValue:pNeed.length,secondary:[['Converted',pConverted.length]]}),
      stageCard({type:'invoice',no:'03',code:'INV',title:'Invoices',help:'Issue the final bill and track the amount still due.',total:inv.length,primaryLabel:'Outstanding',primaryValue:m(outstanding),secondary:[['Paid',invPaid.length]]}),
      stageCard({type:'receipt',no:'04',code:'RC',title:'Payment Receipts',help:'Keep the record of payments received from customers.',total:rc.length,primaryLabel:'Collected',primaryValue:m(collected),secondary:[['Receipts',rc.length]]})
    ].join('<div class="q83-flow-link" aria-hidden="true">→</div>');

    const quoteQueue=qNeed.slice(0,6);
    const invoiceQueue=invDue.slice().sort(updated).slice(0,6);
    const recent=docs.slice(0,8);

    return `${pageHead('Dashboard','Manage each job in one clear sequence: quotation → payment request → invoice → payment receipt.')}
      <section class="q83-overview">
        <div><span>Quoted</span><b>${m(quoted)}</b><small>${q.length} quotation${q.length===1?'':'s'}</small></div>
        <div><span>Invoiced</span><b>${m(invoiced)}</b><small>${inv.length} invoice${inv.length===1?'':'s'}</small></div>
        <div class="q83-important"><span>Outstanding</span><b>${m(outstanding)}</b><small>${invDue.length} invoice${invDue.length===1?'':'s'} to collect</small></div>
        <div><span>Collected</span><b>${m(collected)}</b><small>${rc.length} receipt${rc.length===1?'':'s'}</small></div>
      </section>

      <section class="q83-section-head"><div><span>WORKFLOW</span><h2>Document sequence</h2><p>Click a stage to open its working page.</p></div></section>
      <section class="q83-flow" aria-label="Quotation to payment workflow">${stages}</section>

      <section class="q83-section-head q83-attention-head"><div><span>NEEDS ATTENTION</span><h2>What to work on next</h2><p>Only items that still need action are shown here.</p></div></section>
      <section class="q83-work-grid">
        <article class="panel q83-work-panel"><div class="panel-head"><div><h3>Quotation Follow-up</h3><p>Draft, sent or follow-up quotations.</p></div><button type="button" data-q83-stage="quotation">View quotations</button></div><div class="q83-work-list">${quoteQueue.length?quoteQueue.map(d=>attentionRow(d,'Quotation')).join(''):'<div class="q83-clear"><b>All clear</b><span>No quotations currently need follow-up.</span></div>'}</div></article>
        <article class="panel q83-work-panel"><div class="panel-head"><div><h3>Invoice Collection</h3><p>Invoices with money still outstanding.</p></div><button type="button" data-q83-stage="invoice">View invoices</button></div><div class="q83-work-list">${invoiceQueue.length?invoiceQueue.map(d=>attentionRow(d,'Invoice')).join(''):'<div class="q83-clear"><b>All clear</b><span>No invoice payment is outstanding.</span></div>'}</div>${invoiceQueue.length?`<div class="q83-panel-total"><span>Total outstanding</span><b>${m(outstanding)}</b></div>`:''}</article>
      </section>

      <section class="panel q83-recent"><div class="panel-head"><div><h3>Recent Documents</h3><p>Latest activity across the complete workflow.</p></div><button type="button" data-q83-all>View all documents</button></div>${recentTable(recent)}</section>`;
  };

  function arrangeNavigation(){
    const nav=document.querySelector('.sidebar .nav');if(!nav||nav.dataset.q83Arranged==='1')return;
    const dashboard=nav.querySelector('[data-view="dashboard"]');
    const all=nav.querySelector('[data-view="documents"][data-filter="all"]');
    const q=nav.querySelector('[data-view="documents"][data-filter="quotation"]');
    const p=nav.querySelector('[data-view="documents"][data-filter="proforma"]');
    const inv=nav.querySelector('[data-view="documents"][data-filter="invoice"]');
    const rc=nav.querySelector('[data-view="documents"][data-filter="receipt"]');
    const trash=nav.querySelector('[data-view="trash"]');
    const supply=nav.querySelector('[data-view="supply-usage"]');
    const customers=nav.querySelector('[data-view="customers"]');
    const settings=nav.querySelector('[data-view="settings"]');
    if(!dashboard||!q||!p||!inv||!rc)return;
    nav.innerHTML='';
    const label=text=>{const x=document.createElement('div');x.className='nav-label';x.textContent=text;return x};
    nav.append(dashboard,label('Workflow'),q,p,inv,rc,label('Records'));
    if(all)nav.append(all);if(trash)nav.append(trash);
    if(supply){nav.append(label('Operations'),supply)}
    if(customers){nav.append(label('Directory'),customers)}
    if(settings){nav.append(label('System'),settings)}
    nav.dataset.q83Arranged='1';
  }

  const previousBind=bindDynamic;
  bindDynamic=function(){
    previousBind.apply(this,arguments);
    arrangeNavigation();
    document.querySelectorAll('[data-q83-stage]').forEach(el=>{
      const act=()=>goStage(el.dataset.q83Stage);
      el.onclick=e=>{e.preventDefault();act()};
      el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();act()}};
    });
    document.querySelectorAll('[data-q83-doc]').forEach(el=>el.onclick=e=>{e.preventDefault();e.stopPropagation();openDoc(el.dataset.q83Doc)});
    document.querySelector('[data-q83-all]')?.addEventListener('click',goAll);
  };

  arrangeNavigation();

  if(!document.getElementById('quoDashboardV83Style')){
    const st=document.createElement('style');st.id='quoDashboardV83Style';st.textContent=`
      .q83-overview{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:0 0 18px}.q83-overview>div{background:#fff;border:1px solid var(--line);border-radius:10px;padding:13px 14px;min-width:0}.q83-overview span{display:block;font-size:8px;letter-spacing:.08em;text-transform:uppercase;font-weight:850;color:#77817e}.q83-overview b{display:block;margin:5px 0 3px;font-size:17px;color:#24312e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.q83-overview small{font-size:8.5px;color:#87908d}.q83-overview .q83-important{border-color:#c9dcd6;background:#f7fbf9}.q83-overview .q83-important b{color:#1f6558}
      .q83-section-head{display:flex;align-items:flex-end;justify-content:space-between;margin:4px 0 9px}.q83-section-head span{font-size:7.5px;font-weight:900;letter-spacing:.12em;color:#7b8582}.q83-section-head h2{font-size:14px;margin:2px 0;color:#23302d}.q83-section-head p{margin:0;font-size:8.5px;color:#818a87}.q83-attention-head{margin-top:19px}
      .q83-flow{display:grid;grid-template-columns:minmax(0,1fr) 24px minmax(0,1fr) 24px minmax(0,1fr) 24px minmax(0,1fr);align-items:stretch}.q83-flow-link{display:flex;align-items:center;justify-content:center;color:#9da7a3;font-size:16px}.q83-stage{background:#fff;border:1px solid #dfe5e2;border-radius:11px;padding:13px;cursor:pointer;min-width:0;transition:transform .14s ease,border-color .14s ease,box-shadow .14s ease}.q83-stage:hover{transform:translateY(-1px);border-color:#b9ccc6;box-shadow:0 5px 16px rgba(26,48,42,.06)}.q83-stage:focus-visible{outline:2px solid #557d74;outline-offset:2px}.q83-stage-top{display:flex;align-items:center;gap:7px}.q83-step{font-size:7px;font-weight:900;color:#8b9491}.q83-code{display:inline-flex;align-items:center;justify-content:center;min-width:28px;height:22px;border-radius:6px;background:#edf4f1;color:#275d52;font-size:8px;font-weight:900}.q83-stage-arrow{margin-left:auto;color:#91a09c}.q83-stage h3{font-size:13px;margin:12px 0 3px;color:#24312e}.q83-stage p{font-size:8.5px;line-height:1.45;color:#7a8480;min-height:37px;margin:0}.q83-stage-main{margin:12px -13px 0;padding:10px 13px;border-top:1px solid #edf0ef;border-bottom:1px solid #edf0ef;background:#fafcfb}.q83-stage-main b{display:block;font-size:14px;color:#23443d;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.q83-stage-main span{font-size:7.5px;color:#7f8986}.q83-stage-foot{display:flex;gap:10px;flex-wrap:wrap;padding-top:9px}.q83-stage-foot span{font-size:7.5px;color:#7a8481}.q83-stage-foot b{color:#374440}.q83-invoice .q83-code{background:#edf0f6;color:#425777}.q83-receipt .q83-code{background:#eef7f1;color:#347253}
      .q83-work-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}.q83-work-panel{overflow:hidden}.q83-work-panel .panel-head p{font-size:8.5px;margin:3px 0 0;color:#808a86}.q83-work-list{display:flex;flex-direction:column}.q83-work-row{display:grid;grid-template-columns:72px minmax(120px,1fr) 58px 105px 82px 38px;align-items:center;gap:8px;width:100%;border:0;border-top:1px solid #edf0ef;background:#fff;padding:9px 11px;text-align:left;cursor:pointer}.q83-work-row:hover{background:#fafcfb}.q83-work-kind{font-size:7.5px;text-transform:uppercase;letter-spacing:.05em;font-weight:850;color:#76817d}.q83-work-main b,.q83-work-main small{display:block}.q83-work-main b{font-size:9px;color:#2a3733}.q83-work-main small{font-size:8px;color:#7d8783;margin-top:2px}.q83-work-date,.q83-work-money{font-size:8px;color:#66716d}.q83-work-money{text-align:right;font-weight:800;color:#35423e}.q83-edit{font-size:8px;font-weight:850;color:#356b60;text-align:right}.q83-clear{padding:22px;text-align:center;border-top:1px solid #edf0ef}.q83-clear b,.q83-clear span{display:block}.q83-clear b{font-size:10px;color:#3f625a}.q83-clear span{font-size:8.5px;color:#87918d;margin-top:3px}.q83-panel-total{display:flex;justify-content:space-between;align-items:center;padding:9px 11px;border-top:1px solid #e5ebe8;background:#f8fbfa}.q83-panel-total span{font-size:8px;color:#78827e}.q83-panel-total b{font-size:10px;color:#23483f}
      .q83-recent{margin-bottom:18px}.q83-recent .panel-head p{font-size:8.5px;margin:3px 0 0;color:#808a86}.q83-recent-table .row-actions{width:50px}.q83-recent-table .table-action{font-weight:800;color:#356b60}
      @media(max-width:1200px){.q83-overview{grid-template-columns:repeat(2,1fr)}.q83-flow{grid-template-columns:1fr 18px 1fr}.q83-flow-link:nth-of-type(4),.q83-flow-link:nth-of-type(6){display:none}.q83-stage:nth-of-type(5){grid-column:1}.q83-stage:nth-of-type(7){grid-column:3}.q83-work-grid{grid-template-columns:1fr}.q83-work-row{grid-template-columns:70px minmax(140px,1fr) 58px 100px 78px 36px}}
      @media(max-width:760px){.q83-overview{grid-template-columns:1fr 1fr;gap:7px}.q83-overview>div{padding:10px}.q83-overview b{font-size:13px}.q83-flow{display:flex;flex-direction:column;gap:7px}.q83-flow-link{display:none!important}.q83-stage p{min-height:0}.q83-work-row{grid-template-columns:62px 1fr auto}.q83-work-date,.q83-work-money,.q83-work-row>.badge{display:none}.q83-edit{grid-column:3}.q83-recent-table th:nth-child(3),.q83-recent-table td:nth-child(3),.q83-recent-table th:nth-child(4),.q83-recent-table td:nth-child(4){display:none}}
    `;document.head.appendChild(st);
  }

  if(!S.loading&&S.view==='dashboard')render();
})();