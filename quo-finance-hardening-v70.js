/* Quo v70 - server-backed finance totals, aging and paged-document hydration. */
(function(){
  if(typeof S==='undefined'||typeof sb==='undefined')return;
  window.QUO_FINANCE_HARDENING_VERSION='70';

  const snapshots=new Map();
  let agingCache=null;
  let agingLoad=null;

  function mergeDocs(rows){
    if(!Array.isArray(rows)||!rows.length)return;
    const map=new Map((S.docs||[]).map(d=>[d.id,d]));
    rows.forEach(row=>{if(row?.id)map.set(row.id,{...(map.get(row.id)||{}),...row})});
    S.docs=[...map.values()].sort((a,b)=>String(b.updated_at||b.created_at||'').localeCompare(String(a.updated_at||a.created_at||'')));
  }

  function invoiceIdFor(d){
    if(!d)return null;
    if(d.document_type==='invoice')return d.id||null;
    if(['credit_note','debit_note'].includes(d.document_type))return d.source_document_id||null;
    return null;
  }

  async function hydrateInvoice(invoiceId,rerender=true){
    if(!invoiceId||snapshots.has(invoiceId))return snapshots.get(invoiceId)||null;
    const r=await sb.rpc('quo_invoice_finance_snapshot',{p_invoice_id:invoiceId});
    if(r.error){console.warn('Invoice finance snapshot failed',r.error);return null}
    const snap=r.data||{};
    snapshots.set(invoiceId,snap);
    mergeDocs([snap.invoice,...(Array.isArray(snap.notes)?snap.notes:[])]);
    const currentInvoiceId=invoiceIdFor(S.current);
    if(rerender&&S.view==='editor'&&currentInvoiceId===invoiceId)render();
    return snap;
  }

  try{
    const previousOpenEditor=openEditor;
    openEditor=function(d){
      const result=previousOpenEditor.apply(this,arguments);
      const invoiceId=invoiceIdFor(d);
      if(invoiceId)hydrateInvoice(invoiceId,true);
      return result;
    };
  }catch(e){}

  function amount(v){return money(Number(v||0),S.settings?.currency||'MVR')}
  function countText(v){const n=Number(v||0);return `${n} invoice${n===1?'':'s'}`}

  async function loadAging(force=false){
    if(agingCache&&!force)return agingCache;
    if(agingLoad&&!force)return agingLoad;
    agingLoad=(async()=>{
      const r=await sb.rpc('quo_invoice_aging');
      if(r.error){console.warn('Invoice aging load failed',r.error);return null}
      agingCache=r.data||null;
      return agingCache;
    })();
    try{return await agingLoad}finally{agingLoad=null}
  }

  function agingRows(kind='all',customer=''){
    const rows=Array.isArray(agingCache?.rows)?agingCache.rows:[];
    return rows.filter(r=>{
      if(customer&&String(r.customer_name||'')!==customer)return false;
      if(kind==='all')return true;
      return r.bucket===kind;
    });
  }

  function ensureModal(){
    let m=document.getElementById('q70AgingModal');
    if(m)return m;
    m=document.createElement('div');m.id='q70AgingModal';m.className='modal hidden';
    m.innerHTML='<div class="modal-card q68-aging-modal"><div class="modal-head"><div><div class="eyebrow">COLLECTIONS</div><h2 id="q70AgingTitle">Outstanding Invoices</h2></div><button class="icon-btn" type="button" data-q70-close>×</button></div><div id="q70AgingRows"></div></div>';
    document.body.appendChild(m);
    m.querySelector('[data-q70-close]').onclick=()=>m.classList.add('hidden');
    m.addEventListener('click',e=>{if(e.target===m)m.classList.add('hidden')});
    return m;
  }

  function openRows(kind='all',customer=''){
    const rows=agingRows(kind,customer);
    const title=customer?`${customer} - Outstanding`:kind==='today'?'Due Today':kind==='d1_7'?'1-7 Days Overdue':kind==='d8_30'?'8-30 Days Overdue':kind==='d31_plus'?'31+ Days Overdue':kind==='not_due'?'Not Due Yet':kind==='no_due'?'No Due Date':'Outstanding Invoices';
    const m=ensureModal();m.querySelector('#q70AgingTitle').textContent=title;
    m.querySelector('#q70AgingRows').innerHTML=rows.length?`<div class="q68-aging-list">${rows.map(d=>`<button type="button" data-q70-open="${d.id}"><span><b>${esc(d.document_number)}</b><small>${esc(d.customer_name||'No customer')} · Due ${esc(dateTiny(d.due_date)||'Not set')}</small></span><strong>${amount(d.balance)}</strong></button>`).join('')}</div>`:'<div class="empty">No invoices in this group.</div>';
    m.querySelectorAll('[data-q70-open]').forEach(b=>b.onclick=async()=>{
      let d=(S.docs||[]).find(x=>x.id===b.dataset.q70Open);
      if(!d){const r=await sb.from('quo_documents').select('*').eq('id',b.dataset.q70Open).maybeSingle();if(!r.error&&r.data){d=r.data;mergeDocs([d])}}
      if(d){m.classList.add('hidden');openEditor(d)}
    });
    m.classList.remove('hidden');
  }

  function patchAgingPanel(){
    if(S.view!=='dashboard'||!agingCache)return;
    const panel=document.querySelector('.q68-aging-panel');if(!panel)return;
    const s=agingCache.summary||{},top=s.top_customer||{name:'-',amount:0};
    const box=(key,label)=>`<button type="button" class="q68-aging-card" data-q70-aging="${key}"><span>${esc(label)}</span><b>${amount(s[key]?.amount)}</b><small>${countText(s[key]?.count)}</small></button>`;
    panel.innerHTML=`<div class="panel-head"><div><h3>Invoice Aging & Collections</h3><p>Server-verified outstanding balances as of ${esc(dateShort(s.as_of)||s.as_of||'today')}.</p></div><button type="button" data-q70-aging="all">View all outstanding</button></div><div class="q68-aging-grid">${box('today','Due Today')}${box('d1_7','1-7 Days')}${box('d8_30','8-30 Days')}${box('d31_plus','31+ Days')}</div><div class="q70-aging-extra"><button type="button" data-q70-aging="not_due"><span>Not Due Yet</span><b>${amount(s.not_due?.amount)}</b><small>${countText(s.not_due?.count)}</small></button><button type="button" data-q70-aging="no_due"><span>No Due Date</span><b>${amount(s.no_due?.amount)}</b><small>${countText(s.no_due?.count)}</small></button></div><div class="q68-aging-foot"><div><span>Total Outstanding</span><b>${amount(s.total_outstanding)}</b><small>${countText(s.total_count)}</small></div><button type="button" data-q70-customer="${esc(top.name||'-')}"><span>Highest Outstanding Customer</span><b>${esc(top.name||'-')}</b><small>${amount(top.amount)}</small></button></div>`;
    panel.querySelectorAll('[data-q70-aging]').forEach(b=>b.onclick=()=>openRows(b.dataset.q70Aging));
    panel.querySelectorAll('[data-q70-customer]').forEach(b=>b.onclick=()=>openRows('all',b.dataset.q70Customer));
  }

  async function refreshAgingUI(){
    if(S.view!=='dashboard')return;
    const data=await loadAging(false);
    if(data&&S.view==='dashboard')patchAgingPanel();
  }

  try{
    const previousRefresh=refreshDocs;
    refreshDocs=async function(){
      const result=await previousRefresh.apply(this,arguments);
      snapshots.clear();agingCache=null;
      return result;
    };
  }catch(e){}

  try{
    const previousBind=bindDynamic;
    bindDynamic=function(){
      const result=previousBind.apply(this,arguments);
      if(S.view==='dashboard')refreshAgingUI();
      if(S.view==='editor'&&S.current){const id=invoiceIdFor(S.current);if(id)hydrateInvoice(id,true)}
      return result;
    };
  }catch(e){}

  if(!document.getElementById('quoFinanceHardeningV70Style')){
    const st=document.createElement('style');st.id='quoFinanceHardeningV70Style';st.textContent=`
      .q70-aging-extra{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:9px}.q70-aging-extra>button{display:flex;flex-direction:column;align-items:flex-start;gap:3px;padding:10px 12px;border:1px solid #e0e6e4;border-radius:9px;background:#fff;text-align:left;cursor:pointer}.q70-aging-extra span{font-size:9px;font-weight:850;text-transform:uppercase;letter-spacing:.05em;color:#68736f}.q70-aging-extra b{font-size:12px}.q70-aging-extra small{font-size:9px;color:#78817e}@media(max-width:600px){.q70-aging-extra{grid-template-columns:1fr}}
    `;document.head.appendChild(st);
  }

  if(!S.loading){if(S.view==='dashboard')refreshAgingUI();if(S.view==='editor'&&S.current){const id=invoiceIdFor(S.current);if(id)hydrateInvoice(id,true)}}
})();
