/* Quo v68 - credit/debit notes, invoice aging and document activity timeline. */
(function(){
  if(typeof S==='undefined'||typeof sb==='undefined'||typeof CFG==='undefined')return;
  window.QUO_FINANCE_VERSION='68';

  CFG.credit_note={label:'Credit Note',plural:'Credit Notes',short:'CN',due:'',statuses:['Issued','Cancelled']};
  CFG.debit_note={label:'Debit Note',plural:'Debit Notes',short:'DN',due:'',statuses:['Issued','Cancelled']};

  const NOTE_TYPES=new Set(['credit_note','debit_note']);
  const INACTIVE=new Set(['Cancelled','Superseded']);
  const clean=v=>String(v||'').trim();
  const n=v=>Number(v||0);
  const activeNotes=invoiceId=>(S.docs||[]).filter(d=>NOTE_TYPES.has(d.document_type)&&d.source_document_id===invoiceId&&!d.deleted_at&&!INACTIVE.has(d.status));
  const originalCalc=calc;

  calc=function(d){
    const c=originalCalc(d);
    if(!d||d.document_type!=='invoice'||!d.id)return c;
    const notes=activeNotes(d.id);
    const debit=notes.filter(x=>x.document_type==='debit_note').reduce((a,x)=>a+originalCalc(x).total,0);
    const credit=notes.filter(x=>x.document_type==='credit_note').reduce((a,x)=>a+originalCalc(x).total,0);
    const effective=Math.max(0,c.total+debit-credit);
    return {...c,originalTotal:c.total,debitNotes:debit,creditNotes:credit,total:effective,balance:Math.max(effective-c.paid,0),overpaid:Math.max(c.paid-effective,0)};
  };

  function ensureNav(){
    const nav=document.querySelector('.nav');if(!nav||nav.querySelector('[data-filter="credit_note"]'))return;
    const receipt=nav.querySelector('[data-filter="receipt"]');if(!receipt)return;
    const credit=document.createElement('button');credit.dataset.view='documents';credit.dataset.filter='credit_note';credit.innerHTML='<span class="nav-dot"></span><span>Credit Notes</span>';
    const debit=document.createElement('button');debit.dataset.view='documents';debit.dataset.filter='debit_note';debit.innerHTML='<span class="nav-dot"></span><span>Debit Notes</span>';
    receipt.insertAdjacentElement('afterend',debit);receipt.insertAdjacentElement('afterend',credit);
  }

  function sourceInvoice(d){return (S.docs||[]).find(x=>x.id===d?.source_document_id&&x.document_type==='invoice')||null}
  function noteAmount(d){return originalCalc(d).total}
  function adjustmentSummary(invoice){
    const notes=activeNotes(invoice.id);if(!notes.length)return '';
    const rows=notes.map(x=>`<tr class="q68-adjust-row ${x.document_type}"><td>${esc(CFG[x.document_type].label)} ${esc(x.document_number)}</td><td>${x.document_type==='credit_note'?'-':'+'}${moneyOnly(noteAmount(x))}</td></tr>`).join('');
    return rows;
  }

  function renderAdjustmentPrint(d){
    const invoice=sourceInvoice(d),amount=noteAmount(d),isCredit=d.document_type==='credit_note',title=isCredit?'CREDIT NOTE':'DEBIT NOTE';
    const state=d.status==='Cancelled'?'<div class="q68-note-void">VOID / CANCELLED</div>':'';
    const logo='./assets/white-saffron-logo.svg?v=17';
    const reason=clean(d.extra_terms)||'-',reference=clean(d.payment_reference)||'-';
    const html=`<section class="pdf-page quo-v26 q26-main q68-note-page"><div class="q26-topline"></div>
      <header class="q26-head"><div class="q26-brand"><img src="${esc(logo)}" alt="White Saffron"><div><h1>${esc(S.settings.company_name)}</h1><p>${esc(S.settings.address)}<br>${esc(S.settings.email)}<br>Hotline: ${esc(FIXED.hotline)}</p></div></div><div class="q26-doc"><div class="type">${title}</div><div class="no">${esc(d.document_number)}</div></div></header>
      ${state}
      <section class="q26-info"><div class="q26-client"><div class="q26-eyebrow">Prepared For</div><h2>${esc(d.customer_name||'Customer')}</h2><div class="q26-client-meta">${d.customer_phone?`<div class="q26-contact-row"><span>Contact</span><b>${esc(d.customer_phone)}</b></div>`:''}${d.customer_address?`<div class="q26-contact-row"><span>Address</span><b>${esc(d.customer_address)}</b></div>`:''}</div></div><div class="q26-details"><div class="q26-details-head"><div class="q26-eyebrow">Document Details</div><div class="q43-detail-badges"><span class="q26-info-status">${esc(d.status)}</span></div></div><div class="q26-details-body"><div class="q26-meta-row"><span>Reference</span><b>${esc(d.document_number)}</b></div><div class="q26-meta-row"><span>Issue Date</span><b>${esc(dateLong(d.creation_date)||'Not set')}</b></div><div class="q26-meta-row"><span>Related Invoice</span><b>${esc(invoice?.document_number||'-')}</b></div></div></div></section>
      <section class="q68-note-amount"><span>${isCredit?'Credit Amount':'Additional Charge'}</span><strong>${money(amount,d.currency)}</strong></section>
      <section class="q68-note-detail"><div><span>Reason</span><b>${esc(reason)}</b></div><div><span>Reference</span><b>${esc(reference)}</b></div></section>
      <section class="q68-note-explain">${isCredit?'This Credit Note reduces the amount of the related Invoice.':'This Debit Note increases the amount of the related Invoice.'}</section>
      <div class="q26-closing"><strong>Thank you for your business.</strong><span>${esc(d.document_number)} - Hotline ${esc(FIXED.hotline)}</span></div>
      <footer class="q26-footer"><span>${esc(S.settings.footer||defaultSettings.footer)}</span><span>${esc(d.document_number)} - Page 1 of 1</span></footer>
    </section>`;
    document.getElementById('printRoot').innerHTML=html;
  }

  try{
    const previousPrint=renderPrint;
    renderPrint=function(d){
      if(NOTE_TYPES.has(d?.document_type)){renderAdjustmentPrint(d);return}
      const result=previousPrint.apply(this,arguments);
      if(d?.document_type==='invoice'&&d.id){
        const tbody=document.querySelector('#printRoot .q26-summary tbody'),grand=tbody?.querySelector('tr.grand');
        if(tbody&&grand){
          const box=document.createElement('tbody');box.innerHTML=adjustmentSummary(d);
          [...box.children].forEach(row=>tbody.insertBefore(row,grand));
        }
        const c=calc(d);
        if(c.overpaid>.005){
          const pay=document.querySelector('#printRoot .q26-payment');
          if(pay){const div=document.createElement('div');div.className='q68-credit-balance';div.innerHTML=`<span>Credit Balance / Refund Due</span><b>${money(c.overpaid,d.currency)}</b>`;pay.appendChild(div)}
        }
      }
      return result;
    };
  }catch(e){}

  function ensureAdjustmentModal(){
    let m=document.getElementById('q68AdjustmentModal');if(m)return m;
    m=document.createElement('div');m.id='q68AdjustmentModal';m.className='modal hidden';m.setAttribute('role','dialog');m.setAttribute('aria-modal','true');
    m.innerHTML=`<div class="modal-card q68-adjust-modal"><div class="modal-head"><div><div class="eyebrow">INVOICE ADJUSTMENT</div><h2 id="q68AdjustTitle">Credit Note</h2></div><button class="icon-btn" type="button" data-q68-adjust-close>×</button></div><div id="q68AdjustContext" class="q68-adjust-context"></div><div class="form-grid"><div class="field"><label>Amount</label><input id="q68AdjustAmount" type="number" min="0.01" step="0.01" inputmode="decimal"></div><div class="field"><label>Reference</label><input id="q68AdjustReference" placeholder="Optional reference"></div><div class="field full"><label>Reason</label><textarea id="q68AdjustReason" maxlength="500" placeholder="Why is this adjustment required?"></textarea></div></div><div class="q68-modal-actions"><button class="btn" type="button" data-q68-adjust-close>Cancel</button><button class="btn primary" type="button" id="q68AdjustCreate">Create Note</button></div></div>`;
    document.body.appendChild(m);
    m.querySelectorAll('[data-q68-adjust-close]').forEach(b=>b.onclick=()=>m.classList.add('hidden'));
    m.addEventListener('click',e=>{if(e.target===m)m.classList.add('hidden')});
    m.querySelector('#q68AdjustCreate').onclick=createAdjustment;
    return m;
  }

  function openAdjustment(type){
    const d=S.current;if(!d?.id||d.document_type!=='invoice')return;
    const m=ensureAdjustmentModal(),c=calc(d),credit=type==='credit_note';
    m.dataset.type=type;m.dataset.invoiceId=d.id;
    m.querySelector('#q68AdjustTitle').textContent=credit?'Create Credit Note':'Create Debit Note';
    m.querySelector('#q68AdjustContext').innerHTML=`<b>${esc(d.document_number)}</b><span>Adjusted total ${money(c.total,d.currency)} · Paid ${money(c.paid,d.currency)} · Balance ${money(c.balance,d.currency)}${c.overpaid>.005?` · Credit balance ${money(c.overpaid,d.currency)}`:''}</span>`;
    m.querySelector('#q68AdjustAmount').value='';m.querySelector('#q68AdjustReference').value='';m.querySelector('#q68AdjustReason').value='';
    m.querySelector('#q68AdjustCreate').textContent=credit?'Create Credit Note':'Create Debit Note';
    m.classList.remove('hidden');setTimeout(()=>m.querySelector('#q68AdjustAmount')?.focus(),20);
  }

  async function createAdjustment(){
    const m=ensureAdjustmentModal(),type=m.dataset.type,id=m.dataset.invoiceId,amount=Number(m.querySelector('#q68AdjustAmount').value),reason=clean(m.querySelector('#q68AdjustReason').value),reference=clean(m.querySelector('#q68AdjustReference').value),btn=m.querySelector('#q68AdjustCreate');
    if(!amount||amount<=0)return alert('Enter an amount greater than zero.');
    if(!reason)return alert('Enter the reason for this adjustment.');
    btn.disabled=true;btn.textContent='Creating...';
    try{
      const r=await sb.rpc('quo_create_adjustment_note',{p_invoice_id:id,p_note_type:type,p_amount:amount,p_reason:reason,p_reference:reference||null});
      if(r.error)throw r.error;
      await refreshDocs();m.classList.add('hidden');
      const target=r.data?.document,fresh=(S.docs||[]).find(x=>x.id===target?.id)||target;
      if(!fresh?.id)throw new Error('Adjustment note was not returned.');
      S.editorDirty=false;openEditor(fresh);toast(`${fresh.document_number} created`);
    }catch(e){console.error(e);alert('Could not create adjustment note: '+(e?.message||'Unknown error'))}
    finally{btn.disabled=false;btn.textContent=type==='credit_note'?'Create Credit Note':'Create Debit Note'}
  }

  function configureInvoiceActions(){
    if(S.view!=='editor'||!S.current)return;
    const d=S.current,menu=document.querySelector('.editor-more-menu');if(!menu)return;
    menu.querySelectorAll('[data-q68-credit],[data-q68-debit]').forEach(x=>x.remove());
    if(d.document_type==='invoice'&&d.id&&!d.deleted_at&&!INACTIVE.has(d.status)){
      const before=menu.querySelector('[data-q66-amend],[data-delete-doc]');
      const credit=document.createElement('button');credit.type='button';credit.className='btn';credit.dataset.q68Credit='';credit.textContent='Create Credit Note';
      const debit=document.createElement('button');debit.type='button';debit.className='btn';debit.dataset.q68Debit='';debit.textContent='Create Debit Note';
      menu.insertBefore(debit,before||null);menu.insertBefore(credit,debit);
      credit.onclick=e=>{e.preventDefault();openAdjustment('credit_note')};debit.onclick=e=>{e.preventDefault();openAdjustment('debit_note')};
    }
    if(NOTE_TYPES.has(d.document_type)){
      menu.querySelectorAll('[data-q66-amend],[data-delete-doc],[data-duplicate],[data-convert]').forEach(x=>x.remove());
      const save=document.querySelector('[data-save]');if(save)save.hidden=true;
      const status=document.querySelector('[data-field="status"]');if(status)status.disabled=true;
      document.querySelectorAll('.editor-card').forEach(card=>{
        const title=clean(card.querySelector('header h3')?.textContent).toLowerCase();
        if(['event / service','menu'].includes(title))card.remove();
      });
      const lock=document.querySelector('.q66-lock-note');if(lock)lock.innerHTML='<b>Issued adjustment note</b><span>Financial details are locked. Use Void Document if this note was created incorrectly.</span>';
    }
  }

  function maldivesToday(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Indian/Maldives',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
  function daysBetween(a,b){const x=new Date(a+'T00:00:00+05:00'),y=new Date(b+'T00:00:00+05:00');return Math.floor((x-y)/86400000)}
  function outstandingInvoices(){return (S.docs||[]).filter(d=>d.document_type==='invoice'&&!d.deleted_at&&!INACTIVE.has(d.status)&&calc(d).balance>.005)}
  function agingData(){
    const today=maldivesToday(),rows=outstandingInvoices(),buckets={today:[],d1_7:[],d8_30:[],d31:[],current:[]};
    rows.forEach(d=>{
      const due=clean(d.expires_on);if(!due){buckets.current.push(d);return}
      const late=daysBetween(today,due);
      if(late<0)buckets.current.push(d);else if(late===0)buckets.today.push(d);else if(late<=7)buckets.d1_7.push(d);else if(late<=30)buckets.d8_30.push(d);else buckets.d31.push(d);
    });
    const amount=arr=>arr.reduce((a,d)=>a+calc(d).balance,0);
    const customerMap=new Map();rows.forEach(d=>{const k=clean(d.customer_name)||'Unknown';customerMap.set(k,(customerMap.get(k)||0)+calc(d).balance)});
    const top=[...customerMap.entries()].sort((a,b)=>b[1]-a[1])[0]||['-',0];
    return {today,rows,buckets,amount,total:amount(rows),top};
  }

  function agingPanel(){
    const a=agingData(),box=(key,label,sub)=>`<button type="button" class="q68-aging-card" data-q68-aging="${key}"><span>${esc(label)}</span><b>${money(a.amount(a.buckets[key]),S.settings.currency)}</b><small>${a.buckets[key].length} invoice${a.buckets[key].length===1?'':'s'} ${esc(sub)}</small></button>`;
    return `<section class="panel q68-aging-panel"><div class="panel-head"><div><h3>Invoice Aging & Collections</h3><p>Outstanding invoices grouped by how long payment is overdue.</p></div><button type="button" data-q68-aging="all">View all outstanding</button></div><div class="q68-aging-grid">${box('today','Due Today','due today')}${box('d1_7','1-7 Days','overdue')}${box('d8_30','8-30 Days','overdue')}${box('d31','31+ Days','overdue')}</div><div class="q68-aging-foot"><div><span>Total Outstanding</span><b>${money(a.total,S.settings.currency)}</b></div><button type="button" data-q68-aging-customer="${esc(a.top[0])}"><span>Highest Outstanding Customer</span><b>${esc(a.top[0])}</b><small>${money(a.top[1],S.settings.currency)}</small></button></div></section>`;
  }

  try{
    const previousDashboard=renderDashboard;
    renderDashboard=function(){
      let html=previousDashboard.apply(this,arguments);
      const panel=agingPanel();
      const marker='<section class="wf-recent"';
      const at=html.indexOf(marker);
      if(at>=0)html=html.slice(0,at)+panel+html.slice(at);else html+=panel;
      return html;
    };
  }catch(e){}

  function ensureAgingModal(){
    let m=document.getElementById('q68AgingModal');if(m)return m;
    m=document.createElement('div');m.id='q68AgingModal';m.className='modal hidden';m.innerHTML='<div class="modal-card q68-aging-modal"><div class="modal-head"><div><div class="eyebrow">COLLECTIONS</div><h2 id="q68AgingTitle">Outstanding Invoices</h2></div><button class="icon-btn" type="button" data-q68-aging-close>×</button></div><div id="q68AgingRows"></div></div>';
    document.body.appendChild(m);m.querySelector('[data-q68-aging-close]').onclick=()=>m.classList.add('hidden');m.addEventListener('click',e=>{if(e.target===m)m.classList.add('hidden')});return m;
  }
  function openAging(kind,customer=''){
    const a=agingData();let rows=kind==='all'?a.rows:(a.buckets[kind]||[]);if(customer)rows=a.rows.filter(d=>clean(d.customer_name)===customer);
    const title=customer?`${customer} - Outstanding`:kind==='today'?'Due Today':kind==='d1_7'?'1-7 Days Overdue':kind==='d8_30'?'8-30 Days Overdue':kind==='d31'?'31+ Days Overdue':'Outstanding Invoices';
    const m=ensureAgingModal();m.querySelector('#q68AgingTitle').textContent=title;
    m.querySelector('#q68AgingRows').innerHTML=rows.length?`<div class="q68-aging-list">${rows.sort((x,y)=>String(x.expires_on||'9999').localeCompare(String(y.expires_on||'9999'))).map(d=>`<button type="button" data-q68-open-invoice="${d.id}"><span><b>${esc(d.document_number)}</b><small>${esc(d.customer_name||'No customer')} · Due ${esc(dateTiny(d.expires_on)||'Not set')}</small></span><strong>${money(calc(d).balance,d.currency)}</strong></button>`).join('')}</div>`:'<div class="empty">No invoices in this group.</div>';
    m.querySelectorAll('[data-q68-open-invoice]').forEach(b=>b.onclick=()=>{const d=(S.docs||[]).find(x=>x.id===b.dataset.q68OpenInvoice);if(d){m.classList.add('hidden');openEditor(d)}});m.classList.remove('hidden');
  }

  const timelineCache=new Map();
  function eventLabel(type){return ({created:'Created',converted:'Converted',status_changed:'Status changed',payment_recorded:'Payment recorded',payment_status_changed:'Payment status changed',superseded:'Superseded',voided:'Voided',credit_note_created:'Credit Note created',debit_note_created:'Debit Note created'})[type]||type.replaceAll('_',' ')}
  function eventDetail(e){
    const d=e.details||{};
    if(e.event_type==='converted')return `${d.to_number||'Related document'} created`;
    if(e.event_type==='payment_recorded')return `${d.receipt_number||'Receipt'} · ${money(n(d.amount),S.settings.currency)}${d.payment_reference?` · ${d.payment_reference}`:''}`;
    if(e.event_type==='credit_note_created'||e.event_type==='debit_note_created')return `${d.note_number||'Adjustment'} · ${money(n(d.amount),S.settings.currency)}${d.reason?` · ${d.reason}`:''}`;
    if(e.event_type==='status_changed'||e.event_type==='payment_status_changed')return `${d.from_status||'-'} → ${d.to_status||'-'}`;
    if(e.event_type==='superseded'||e.event_type==='voided')return d.reason||d.to_status||'';
    return d.document_number||d.status||'';
  }
  function eventTime(v){try{return new Intl.DateTimeFormat('en-GB',{timeZone:'Indian/Maldives',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(v))}catch(e){return ''}}
  async function loadTimeline(){
    const current=S.current;if(S.view!=='editor'||!current?.id)return;
    const key=current.deal_id||current.id,token=current.id;
    let rows=timelineCache.get(key);
    if(!rows){const r=await sb.from('quo_document_events').select('id,document_id,deal_id,event_type,event_at,actor_name,related_document_id,details').eq('deal_id',key).order('event_at',{ascending:false}).limit(100);if(r.error){console.warn('Timeline load failed',r.error);rows=[]}else{rows=r.data||[];timelineCache.set(key,rows)}}
    if(S.view!=='editor'||S.current?.id!==token)return;
    let card=document.querySelector('.q68-timeline-card');if(!card){card=document.createElement('section');card.className='editor-card q68-timeline-card';card.innerHTML='<header><h3>Activity Timeline</h3></header><div class="card-body q68-timeline-body"></div>';document.querySelector('.editor-main')?.appendChild(card)}
    const body=card.querySelector('.q68-timeline-body');if(!body)return;
    body.innerHTML=rows.length?rows.map(e=>`<div class="q68-timeline-row"><i></i><div><b>${esc(eventLabel(e.event_type))}</b><span>${esc(eventDetail(e))}</span><small>${esc(e.actor_name||'System')} · ${esc(eventTime(e.event_at))}</small></div></div>`).join(''):'<div class="empty">No activity recorded yet.</div>';
  }
  function clearTimeline(){timelineCache.clear()}

  function bindV68(){
    ensureNav();configureInvoiceActions();
    document.querySelectorAll('[data-q68-aging]').forEach(b=>b.onclick=()=>openAging(b.dataset.q68Aging));
    document.querySelectorAll('[data-q68-aging-customer]').forEach(b=>b.onclick=()=>openAging('all',b.dataset.q68AgingCustomer));
    if(S.view==='editor'&&S.current?.id)loadTimeline();
  }

  try{
    const previousRefresh=refreshDocs;
    refreshDocs=async function(){const result=await previousRefresh.apply(this,arguments);clearTimeline();return result};
  }catch(e){}
  try{
    const previousBind=bindDynamic;
    bindDynamic=function(){const result=previousBind.apply(this,arguments);bindV68();return result};
  }catch(e){}

  if(!document.getElementById('quoFinanceV68Style')){
    const st=document.createElement('style');st.id='quoFinanceV68Style';st.textContent=`
      .q68-adjust-row td:last-child{text-align:right;font-weight:800}.q68-adjust-row.credit_note td:last-child{color:#8b3d46}.q68-adjust-row.debit_note td:last-child{color:#315f58}.q68-credit-balance{display:flex;justify-content:space-between;gap:12px;margin-top:8px;padding:9px 10px;border-radius:7px;background:#fff7e8;border:1px solid #ecd9ae}.q68-credit-balance span{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.05em}.q68-credit-balance b{font-size:11px}
      .q68-note-page .q68-note-void{margin:0 0 12px;padding:8px;text-align:center;background:#fff0ef;border:1px solid #e7b8b3;color:#953f3a;font-size:12px;font-weight:900;letter-spacing:.08em}.q68-note-amount{display:flex;justify-content:space-between;align-items:end;margin:18px 0;padding:16px 18px;border:1px solid #dce4e1;border-radius:10px;background:#f8faf9}.q68-note-amount span{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#66716e}.q68-note-amount strong{font-size:24px;color:#203a34}.q68-note-detail{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:0 0 14px}.q68-note-detail>div{padding:12px;border:1px solid #e1e6e4;border-radius:8px}.q68-note-detail span{display:block;font-size:8px;text-transform:uppercase;color:#75807d}.q68-note-detail b{display:block;margin-top:4px;font-size:11px}.q68-note-explain{padding:12px 14px;border-left:3px solid #7e9e97;background:#f4f7f6;font-size:10px;line-height:1.5}
      .q68-adjust-context{display:flex;flex-direction:column;gap:4px;margin-bottom:12px;padding:10px 12px;border-radius:8px;background:#f4f7f6}.q68-adjust-context b{font-size:12px}.q68-adjust-context span{font-size:10px;color:#64706c}.q68-modal-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}
      .q68-aging-panel{margin-top:12px}.q68-aging-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}.q68-aging-card{display:flex;flex-direction:column;align-items:flex-start;gap:4px;padding:13px;border:1px solid #dde5e2;border-radius:9px;background:#fff;text-align:left;cursor:pointer}.q68-aging-card:hover{border-color:#b8ccc6;background:#f8fbfa}.q68-aging-card span,.q68-aging-foot span{font-size:9px;font-weight:850;text-transform:uppercase;letter-spacing:.05em;color:#68736f}.q68-aging-card b{font-size:15px;color:#243d37}.q68-aging-card small{font-size:9px;color:#78817e}.q68-aging-foot{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:9px}.q68-aging-foot>div,.q68-aging-foot>button{display:flex;flex-direction:column;align-items:flex-start;gap:3px;padding:11px 13px;border:1px solid #e0e6e4;border-radius:9px;background:#f8faf9;text-align:left}.q68-aging-foot>button{cursor:pointer}.q68-aging-foot b{font-size:13px}.q68-aging-foot small{font-size:10px;color:#68736f}.q68-aging-modal{width:min(760px,calc(100vw - 24px));max-height:86vh;overflow:auto}.q68-aging-list{display:flex;flex-direction:column;gap:6px}.q68-aging-list>button{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 12px;border:1px solid #e0e6e4;border-radius:8px;background:#fff;text-align:left;cursor:pointer}.q68-aging-list>button:hover{background:#f7faf9}.q68-aging-list span{display:flex;flex-direction:column;gap:2px}.q68-aging-list small{font-size:9px;color:#727d79}.q68-aging-list strong{font-size:11px;white-space:nowrap}
      .q68-timeline-card{margin-top:0}.q68-timeline-body{position:relative;padding-left:4px}.q68-timeline-row{display:grid;grid-template-columns:14px 1fr;gap:8px;position:relative;padding:0 0 13px}.q68-timeline-row:before{content:'';position:absolute;left:6px;top:10px;bottom:-2px;width:1px;background:#dfe6e3}.q68-timeline-row:last-child:before{display:none}.q68-timeline-row i{width:7px;height:7px;border-radius:50%;margin:5px 0 0 3px;background:#6f948b;z-index:1}.q68-timeline-row>div{display:flex;flex-direction:column;gap:2px}.q68-timeline-row b{font-size:10px}.q68-timeline-row span{font-size:9px;color:#53615d}.q68-timeline-row small{font-size:8px;color:#8a9390}
      @media(max-width:900px){.q68-aging-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:600px){.q68-aging-grid,.q68-aging-foot,.q68-note-detail{grid-template-columns:1fr}.q68-aging-card{padding:11px}.q68-aging-foot{margin-top:7px}}
    `;document.head.appendChild(st);
  }

  ensureNav();
  if(!S.loading)try{render()}catch(e){console.warn('Quo v68 initial render deferred',e)}
})();
