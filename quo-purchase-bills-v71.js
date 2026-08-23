/* Quo v71 - Admin-only supply purchase bills linked to confirmed quotations. */
(function(){
  const cache=new Map();
  let pickerQuotationId=null;
  let pickerTimer=null;

  const isAdmin=()=>S.role==='admin';
  const isFinalQuotation=d=>!!d&&d.document_type==='quotation'&&['Confirmed','Accepted'].includes(String(d.status||''))&&!!d.id&&!d.deleted_at;
  const n=v=>{const x=Number(v);return Number.isFinite(x)?x:0};
  const m=v=>money(n(v),S.settings?.currency||'MVR');

  function purchaseBody(d){
    const state=cache.get(d.id);
    if(!state)return `<div class="quo-purchase-loading">Loading linked purchase bills…</div>`;
    if(state.error)return `<div class="quo-purchase-error">${esc(state.error)}</div>`;
    const rows=state.rows||[];
    const sale=calc(d).total;
    const cost=rows.reduce((a,b)=>a+n(b.amount),0);
    const difference=sale-cost;
    const ratio=sale>0?(cost/sale)*100:0;
    return `<div class="quo-purchase-summary">
      <div><span>Quotation Sale Value</span><strong>${m(sale)}</strong></div>
      <div><span>Linked Supply Bills</span><strong>${m(cost)}</strong></div>
      <div><span>Supply Cost %</span><strong>${ratio.toFixed(1)}%</strong></div>
      <div><span>Quote − Linked Supply Cost</span><strong>${m(difference)}</strong></div>
    </div>
    <div class="quo-purchase-note">This is an internal purchasing view. Linked bills are supply costs associated with this confirmed quotation; the difference is not treated as final profit because labour, overhead and other costs may still apply.</div>
    ${rows.length?`<div class="table-wrap quo-purchase-table"><table class="data-table"><thead><tr><th>Bill</th><th>Supplier</th><th>Date</th><th class="num">Amount</th><th>Status</th><th></th></tr></thead><tbody>${rows.map(b=>`<tr><td><strong>${esc(b.bill_no||'#'+b.bill_id)}</strong></td><td>${esc(b.vendor||'Unknown supplier')}</td><td>${esc(b.bill_day?dateTiny(b.bill_day):'-')}</td><td class="num">${m(b.amount)}</td><td><span class="badge ${String(b.payment_status||'').toLowerCase()==='paid'?'paid':'draft'}">${esc(b.payment_status||'Pending')}</span></td><td class="row-actions"><button type="button" class="table-action danger-text" data-purchase-unlink="${b.bill_id}">Unlink</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="quo-purchase-empty">No purchase bills linked to this quotation yet.</div>'}`;
  }

  function purchaseCard(d){
    return `<section class="editor-card quo-purchase-bills-card" data-purchase-quotation="${esc(d.id)}"><header><span class="section-no">08</span><h3>Purchase Bills</h3><span class="quo-admin-only">ADMIN ONLY</span><button type="button" class="btn quo-purchase-add" data-purchase-link-open>+ Link Purchase Bill</button></header><div class="card-body" data-purchase-body>${purchaseBody(d)}</div></section>`;
  }

  try{
    const previousRenderEditor=renderEditor;
    renderEditor=function(){
      const html=previousRenderEditor.apply(this,arguments);
      const d=S.current;
      if(!isAdmin()||!isFinalQuotation(d))return html;
      const marker='</div><aside class="preview-card">';
      return html.includes(marker)?html.replace(marker,purchaseCard(d)+marker):html+purchaseCard(d);
    };
  }catch(e){console.warn('Quo purchase bills editor hook unavailable',e)}

  async function loadLinks(id,force=false){
    if(!id||!isAdmin())return;
    if(cache.has(id)&&!force)return;
    cache.set(id,{rows:null,loading:true});
    refreshCard(id);
    try{
      const r=await sb.rpc('quo_get_purchase_bill_links',{p_quotation_id:id});
      if(r.error)throw r.error;
      cache.set(id,{rows:r.data||[],loading:false});
    }catch(e){cache.set(id,{rows:[],loading:false,error:e?.message||'Could not load purchase bills.'})}
    refreshCard(id);
  }

  function refreshCard(id){
    const card=document.querySelector(`.quo-purchase-bills-card[data-purchase-quotation="${CSS.escape(String(id))}"]`);
    if(!card||!S.current||String(S.current.id)!==String(id))return;
    const body=card.querySelector('[data-purchase-body]');
    if(body)body.innerHTML=purchaseBody(S.current);
    bindPurchaseUI();
  }

  function ensurePicker(){
    let modal=document.getElementById('quoPurchaseBillPicker');
    if(modal)return modal;
    modal=document.createElement('div');
    modal.id='quoPurchaseBillPicker';
    modal.className='quo-purchase-modal hidden';
    modal.innerHTML=`<div class="quo-purchase-modal-card"><div class="quo-purchase-modal-head"><div><div class="eyebrow">ADMIN · PURCHASING</div><h2>Link Purchase Bill</h2><p>Choose a bill already recorded in White Saffron Purchase Invoices.</p></div><button type="button" class="icon-btn" data-purchase-close>×</button></div><div class="quo-purchase-search"><input id="quoPurchaseSearch" type="search" placeholder="Search bill number, supplier or location"><button class="btn" type="button" id="quoPurchaseSearchBtn">Search</button></div><div id="quoPurchaseCandidates" class="quo-purchase-candidates"><div class="empty">Loading purchase bills…</div></div></div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click',e=>{if(e.target===modal||e.target.closest('[data-purchase-close]'))closePicker()});
    modal.querySelector('#quoPurchaseSearchBtn').onclick=()=>loadCandidates();
    modal.querySelector('#quoPurchaseSearch').addEventListener('input',()=>{clearTimeout(pickerTimer);pickerTimer=setTimeout(loadCandidates,260)});
    return modal;
  }

  async function openPicker(){
    if(!isAdmin()||!isFinalQuotation(S.current))return;
    pickerQuotationId=S.current.id;
    const modal=ensurePicker();
    modal.classList.remove('hidden');
    const input=modal.querySelector('#quoPurchaseSearch');input.value='';
    await loadCandidates();
    setTimeout(()=>input.focus(),20);
  }
  function closePicker(){ensurePicker().classList.add('hidden');pickerQuotationId=null}

  async function loadCandidates(){
    if(!pickerQuotationId||!isAdmin())return;
    const host=document.getElementById('quoPurchaseCandidates');if(!host)return;
    const q=document.getElementById('quoPurchaseSearch')?.value.trim()||'';
    host.innerHTML='<div class="empty">Loading purchase bills…</div>';
    try{
      const r=await sb.rpc('quo_purchase_bill_candidates',{p_quotation_id:pickerQuotationId,p_search:q||null,p_limit:100});
      if(r.error)throw r.error;
      const rows=r.data||[];
      host.innerHTML=rows.length?`<div class="table-wrap"><table class="data-table"><thead><tr><th>Bill</th><th>Supplier</th><th>Date</th><th class="num">Amount</th><th>Payment</th><th></th></tr></thead><tbody>${rows.map(b=>`<tr><td><strong>${esc(b.bill_no||'#'+b.bill_id)}</strong></td><td>${esc(b.vendor||'Unknown supplier')}</td><td>${esc(b.bill_day?dateTiny(b.bill_day):'-')}</td><td class="num">${m(b.amount)}</td><td><span class="badge ${String(b.payment_status||'').toLowerCase()==='paid'?'paid':'draft'}">${esc(b.payment_status||'Pending')}</span></td><td><button class="btn small" type="button" data-purchase-link="${b.bill_id}">Link</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">No matching unlinked purchase bills.</div>';
      host.querySelectorAll('[data-purchase-link]').forEach(b=>b.onclick=()=>linkBill(Number(b.dataset.purchaseLink)));
    }catch(e){host.innerHTML=`<div class="quo-purchase-error">${esc(e?.message||'Could not load purchase bills.')}</div>`}
  }

  async function linkBill(billId){
    if(!pickerQuotationId||!isAdmin())return;
    const buttons=$$('[data-purchase-link]');buttons.forEach(b=>b.disabled=true);
    try{
      const r=await sb.rpc('quo_link_purchase_bill',{p_quotation_id:pickerQuotationId,p_bill_id:billId,p_note:null});
      if(r.error)throw r.error;
      toast('Purchase bill linked');
      const id=pickerQuotationId;
      await loadLinks(id,true);
      await loadCandidates();
    }catch(e){alert('Could not link purchase bill: '+(e?.message||e))}
    finally{buttons.forEach(b=>b.disabled=false)}
  }

  async function unlinkBill(billId){
    const d=S.current;if(!isAdmin()||!isFinalQuotation(d))return;
    if(!confirm('Unlink this purchase bill from the quotation? The bill itself will not be deleted.'))return;
    try{
      const r=await sb.rpc('quo_unlink_purchase_bill',{p_quotation_id:d.id,p_bill_id:Number(billId)});
      if(r.error)throw r.error;
      toast('Purchase bill unlinked');
      await loadLinks(d.id,true);
    }catch(e){alert('Could not unlink purchase bill: '+(e?.message||e))}
  }

  function bindPurchaseUI(){
    if(!isAdmin())return;
    const d=S.current;
    if(isFinalQuotation(d))loadLinks(d.id);
    $$('[data-purchase-link-open]').forEach(b=>{if(!b.dataset.bound){b.dataset.bound='1';b.onclick=openPicker}});
    $$('[data-purchase-unlink]').forEach(b=>{if(!b.dataset.bound){b.dataset.bound='1';b.onclick=()=>unlinkBill(b.dataset.purchaseUnlink)}});
  }

  try{
    const previousBind=bindDynamic;
    bindDynamic=function(){const result=previousBind.apply(this,arguments);bindPurchaseUI();return result};
  }catch(e){console.warn('Quo purchase bills bind hook unavailable',e)}

  if(!document.getElementById('quoPurchaseBillsV71Style')){
    const st=document.createElement('style');
    st.id='quoPurchaseBillsV71Style';
    st.textContent=`
      .quo-purchase-bills-card>header{grid-template-columns:auto 1fr auto auto;align-items:center}.quo-admin-only{font-size:7.5px;font-weight:850;letter-spacing:.08em;color:#7b654d;background:#fff8ec;border:1px solid #eadcc4;border-radius:999px;padding:4px 7px}.quo-purchase-add{min-height:32px!important;padding:0 10px!important;font-size:9px!important}
      .quo-purchase-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.quo-purchase-summary>div{padding:11px;border:1px solid #e2e6e4;border-radius:8px;background:#fafbfa}.quo-purchase-summary span{display:block;font-size:7.5px;font-weight:800;letter-spacing:.045em;text-transform:uppercase;color:#7b8481}.quo-purchase-summary strong{display:block;margin-top:4px;font-size:12px;color:#26322f}.quo-purchase-note{margin-top:9px;padding:9px 10px;border-left:2px solid #cab895;background:#fffaf2;color:#736755;font-size:8.5px;line-height:1.45}.quo-purchase-table{margin-top:11px}.quo-purchase-empty,.quo-purchase-loading,.quo-purchase-error{margin-top:10px;padding:16px;border:1px dashed #d9dfdc;border-radius:8px;text-align:center;color:#7a8380;font-size:9px}.quo-purchase-error{border-color:#ebcfcb;background:#fff6f5;color:#98483f}
      .quo-purchase-modal{position:fixed;inset:0;z-index:2147483645;display:grid;place-items:center;padding:18px;background:rgba(20,28,26,.46);backdrop-filter:blur(3px)}.quo-purchase-modal-card{width:min(1000px,96vw);max-height:88vh;overflow:auto;background:#fff;border:1px solid #dfe4e2;border-radius:12px;box-shadow:0 24px 80px rgba(18,29,25,.22)}.quo-purchase-modal-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding:18px 20px 14px;border-bottom:1px solid #edf0ef}.quo-purchase-modal-head h2{margin:2px 0 3px;font-size:20px}.quo-purchase-modal-head p{margin:0;color:#78817e;font-size:9px}.quo-purchase-search{display:grid;grid-template-columns:1fr auto;gap:8px;padding:12px 20px;border-bottom:1px solid #edf0ef;background:#fafbfb}.quo-purchase-search input{height:38px;border:1px solid #d8dfdc;border-radius:8px;padding:0 11px;font-size:11px}.quo-purchase-candidates{padding:10px 20px 20px}.quo-purchase-candidates .data-table{min-width:700px}
      @media(max-width:900px){.quo-purchase-summary{grid-template-columns:1fr 1fr}}@media(max-width:620px){.quo-purchase-bills-card>header{grid-template-columns:auto 1fr auto}.quo-purchase-add{grid-column:1/-1;width:100%}.quo-purchase-summary{grid-template-columns:1fr}.quo-purchase-modal{padding:8px}.quo-purchase-modal-card{width:100%;max-height:94vh}.quo-purchase-search{grid-template-columns:1fr}.quo-purchase-search .btn{width:100%}}
    `;
    document.head.appendChild(st);
  }
})();
