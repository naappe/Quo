/* Quo v73 - Simple Admin-only supply usage.
   Workflow: choose an existing quotation/invoice -> enter supply -> save. */
(function(){
  const state={rows:[],loading:false,search:'',documentId:''};
  let searchTimer=null;
  const isAdmin=()=>S.role==='admin';
  const n=v=>{const x=Number(v);return Number.isFinite(x)?x:0};
  const today=()=>new Date().toISOString().slice(0,10);
  const qfmt=(v,u='')=>`${n(v).toLocaleString('en-US',{maximumFractionDigits:4})}${u?' '+u:''}`;
  const docs=()=>[...(S.docs||[])].filter(d=>!d.deleted_at&&['quotation','invoice'].includes(d.document_type)).sort((a,b)=>String(b.updated_at||b.created_at||'').localeCompare(String(a.updated_at||a.created_at||'')));
  const docLabel=d=>`${d.document_number||'Document'} · ${d.customer_name||'No customer'}${d.event_name?' · '+d.event_name:''}`;
  const typeLabel=t=>t==='invoice'?'Invoice':'Quotation';

  function syncNav(){
    const nav=document.querySelector('[data-view="supply-usage"]');
    if(nav)nav.hidden=!isAdmin();
  }

  function optionList(){
    const rows=docs();
    const quotes=rows.filter(d=>d.document_type==='quotation');
    const invoices=rows.filter(d=>d.document_type==='invoice');
    const group=(label,list)=>list.length?`<optgroup label="${label}">${list.map(d=>`<option value="${esc(d.id)}">${esc(docLabel(d))}</option>`).join('')}</optgroup>`:'';
    return `<option value="">Select existing document</option>${group('Quotations',quotes)}${group('Invoices',invoices)}`;
  }

  function renderSupplyUsage(){
    if(!isAdmin()){
      S.view='dashboard';
      return previousRender();
    }
    if($('#topEyebrow'))$('#topEyebrow').textContent='INTERNAL';
    if($('#topTitle'))$('#topTitle').textContent='Supply Usage';
    setActiveNav();
    $('#view').innerHTML=`
      <div class="page-head quo-supply-page-head">
        <div><div class="eyebrow">WHITE SAFFRON · INTERNAL</div><h2>Supply Usage</h2><p>Select an existing quotation or invoice, enter the supply used, and save.</p></div>
      </div>
      <section class="panel quo-simple-supply-entry">
        <div class="panel-head"><div><h3>Record Supply</h3><p>Nothing new is created in Documents. This only records which existing document used the supply.</p></div><span class="badge final">ADMIN ONLY</span></div>
        <form id="quoSupplyUsageForm" class="quo-simple-supply-form">
          <label class="doc-field"><span>Existing Document</span><select id="quoSupplyDoc" required>${optionList()}</select></label>
          <label><span>Supply</span><input id="quoSupplyName" required placeholder="e.g. Basmati Rice"></label>
          <label><span>Quantity</span><input id="quoSupplyQty" type="number" min="0.0001" step="0.0001" required placeholder="0"></label>
          <label><span>Unit</span><select id="quoSupplyUnit"><option>KG</option><option>G</option><option>PCS</option><option>L</option><option>ML</option><option>CSE</option></select></label>
          <label><span>Date Used</span><input id="quoSupplyDate" type="date" value="${today()}" required></label>
          <label class="note-field"><span>Note <small>optional</small></span><input id="quoSupplyNote" placeholder="e.g. Dinner catering"></label>
          <button class="btn primary" id="quoSupplySave" type="submit">Save Supply Usage</button>
        </form>
      </section>
      <section class="panel quo-simple-supply-list">
        <div class="panel-head"><div><h3>Supply History</h3><p>Search a supply or document to see where it was used.</p></div></div>
        <div class="quo-simple-supply-toolbar">
          <input id="quoSupplyUsageSearch" type="search" placeholder="Search supply, document, customer or event">
          <select id="quoSupplyUsageDocFilter"><option value="">All documents</option>${docs().map(d=>`<option value="${esc(d.id)}">${esc(d.document_number||'Document')} · ${esc(d.customer_name||'No customer')}</option>`).join('')}</select>
        </div>
        <div id="quoSupplyUsageRows"><div class="empty">Loading supply usage…</div></div>
      </section>`;
    bindSupplyUI();
    loadRows();
  }

  function rowsHtml(rows){
    if(!rows.length)return '<div class="empty">No supply usage recorded yet.</div>';
    return `<div class="table-wrap"><table class="data-table quo-simple-supply-table"><thead><tr><th>Date</th><th>Document</th><th>Customer / Event</th><th>Supply</th><th>Quantity</th><th>Note</th><th></th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.used_on?dateTiny(r.used_on):'-')}</td><td><button class="table-action quo-supply-doc-link" type="button" data-supply-open-doc="${esc(r.document_id)}"><strong>${esc(r.document_number||'Document')}</strong><span>${esc(typeLabel(r.document_type))}</span></button></td><td><strong>${esc(r.customer_name||'No customer')}</strong>${r.event_name?`<span class="subline">${esc(r.event_name)}</span>`:''}</td><td><strong>${esc(r.supply_name)}</strong></td><td>${esc(qfmt(r.quantity,r.unit))}</td><td>${esc(r.note||'—')}</td><td class="row-actions"><button class="table-action danger-text" type="button" data-supply-usage-remove="${r.usage_id}">Remove</button></td></tr>`).join('')}</tbody></table></div>`;
  }

  async function loadRows(){
    if(!isAdmin()||S.view!=='supply-usage')return;
    const host=$('#quoSupplyUsageRows');if(!host)return;
    state.loading=true;host.innerHTML='<div class="empty">Loading supply usage…</div>';
    try{
      const r=await sb.rpc('quo_supply_usage_list',{p_search:state.search||null,p_document_id:state.documentId||null,p_limit:500});
      if(r.error)throw r.error;
      state.rows=r.data||[];
      host.innerHTML=rowsHtml(state.rows);
      bindRowActions();
    }catch(e){host.innerHTML=`<div class="quo-simple-supply-error">${esc(e?.message||'Could not load supply usage.')}</div>`}
    finally{state.loading=false}
  }

  async function saveUsage(e){
    e.preventDefault();
    const documentId=$('#quoSupplyDoc')?.value||'';
    const supply=$('#quoSupplyName')?.value.trim()||'';
    const qty=n($('#quoSupplyQty')?.value);
    const unit=$('#quoSupplyUnit')?.value||'PCS';
    const usedOn=$('#quoSupplyDate')?.value||today();
    const note=$('#quoSupplyNote')?.value.trim()||null;
    if(!documentId)return alert('Select the quotation or invoice that used this supply.');
    if(!supply)return alert('Enter the supply name.');
    if(qty<=0)return alert('Enter the quantity used.');
    const btn=$('#quoSupplySave');btn.disabled=true;btn.textContent='Saving…';
    try{
      const r=await sb.rpc('quo_add_supply_usage',{p_document_id:documentId,p_supply_name:supply,p_quantity:qty,p_unit:unit,p_used_on:usedOn,p_note:note});
      if(r.error)throw r.error;
      $('#quoSupplyName').value='';$('#quoSupplyQty').value='';$('#quoSupplyNote').value='';
      toast('Supply usage saved');
      await loadRows();
      $('#quoSupplyName')?.focus();
    }catch(e){alert('Could not save supply usage: '+(e?.message||e))}
    finally{btn.disabled=false;btn.textContent='Save Supply Usage'}
  }

  async function removeUsage(id){
    if(!confirm('Remove this supply usage record? The quotation/invoice itself will not be changed.'))return;
    try{
      const r=await sb.rpc('quo_remove_supply_usage',{p_usage_id:Number(id)});
      if(r.error)throw r.error;
      toast('Supply usage removed');await loadRows();
    }catch(e){alert('Could not remove supply usage: '+(e?.message||e))}
  }

  async function openExistingDocument(id){
    let d=(S.docs||[]).find(x=>String(x.id)===String(id));
    if(!d){
      const r=await sb.from('quo_documents').select('*').eq('id',id).maybeSingle();
      if(r.error||!r.data)return alert('Could not open this document.');
      d=r.data;
      S.docs=[d,...(S.docs||[])];
    }
    S.editorDirty=false;openEditor(d);scrollTo(0,0);
  }

  function bindRowActions(){
    $$('[data-supply-usage-remove]').forEach(b=>b.onclick=()=>removeUsage(b.dataset.supplyUsageRemove));
    $$('[data-supply-open-doc]').forEach(b=>b.onclick=()=>openExistingDocument(b.dataset.supplyOpenDoc));
  }

  function bindSupplyUI(){
    syncNav();
    const form=$('#quoSupplyUsageForm');if(form)form.onsubmit=saveUsage;
    const search=$('#quoSupplyUsageSearch');if(search)search.oninput=()=>{state.search=search.value.trim();clearTimeout(searchTimer);searchTimer=setTimeout(loadRows,250)};
    const filter=$('#quoSupplyUsageDocFilter');if(filter)filter.onchange=()=>{state.documentId=filter.value;loadRows()};
    bindRowActions();
  }

  const previousRender=render;
  render=function(){
    if(S.view==='supply-usage')return renderSupplyUsage();
    const result=previousRender.apply(this,arguments);
    syncNav();
    return result;
  };

  try{
    const previousBind=bindDynamic;
    bindDynamic=function(){const r=previousBind.apply(this,arguments);syncNav();if(S.view==='supply-usage')bindSupplyUI();return r};
  }catch(e){}

  if(!document.getElementById('quoSimpleSupplyV73Style')){
    const st=document.createElement('style');st.id='quoSimpleSupplyV73Style';st.textContent=`
      [data-view="supply-usage"][hidden]{display:none!important}.quo-simple-supply-entry{margin-bottom:14px}.quo-simple-supply-entry .panel-head p,.quo-simple-supply-list .panel-head p{margin:3px 0 0;color:var(--muted);font-size:9px}.quo-simple-supply-form{display:grid;grid-template-columns:minmax(260px,1.6fr) minmax(180px,1.2fr) 110px 90px 130px minmax(180px,1fr) auto;gap:9px;align-items:end;padding:14px}.quo-simple-supply-form label{display:grid;gap:5px}.quo-simple-supply-form label>span{font-size:8px;font-weight:800;letter-spacing:.045em;text-transform:uppercase;color:#727b78}.quo-simple-supply-form label small{font-weight:600;text-transform:none;letter-spacing:0}.quo-simple-supply-form input,.quo-simple-supply-form select,.quo-simple-supply-toolbar input,.quo-simple-supply-toolbar select{height:38px;border:1px solid #d9dfdd;border-radius:7px;background:#fff;padding:0 10px;font-size:10px;color:#27312f;outline:0}.quo-simple-supply-form input:focus,.quo-simple-supply-form select:focus,.quo-simple-supply-toolbar input:focus,.quo-simple-supply-toolbar select:focus{border-color:#87a79f;box-shadow:0 0 0 3px rgba(70,124,112,.07)}.quo-simple-supply-form .btn{height:38px;white-space:nowrap}.quo-simple-supply-toolbar{display:grid;grid-template-columns:1fr minmax(230px,.7fr);gap:9px;padding:11px 14px;border-bottom:1px solid var(--line2);background:#fafbfb}.quo-simple-supply-table .quo-supply-doc-link{display:grid;gap:2px;text-align:left}.quo-simple-supply-table .quo-supply-doc-link strong{font-size:9.5px}.quo-simple-supply-table .quo-supply-doc-link span{font-size:7.5px;color:var(--muted);text-transform:uppercase}.quo-simple-supply-error{padding:18px;text-align:center;color:#98483f;background:#fff6f5}.quo-simple-supply-list{margin-bottom:24px}
      @media(max-width:1250px){.quo-simple-supply-form{grid-template-columns:2fr 1.4fr 110px 90px 130px}.quo-simple-supply-form .note-field{grid-column:1/4}.quo-simple-supply-form .btn{grid-column:4/6}}
      @media(max-width:760px){.quo-simple-supply-form{grid-template-columns:1fr 1fr}.quo-simple-supply-form .doc-field,.quo-simple-supply-form .note-field{grid-column:1/-1}.quo-simple-supply-form .btn{grid-column:1/-1;width:100%}.quo-simple-supply-toolbar{grid-template-columns:1fr}.quo-simple-supply-table{min-width:760px}}
      @media(max-width:480px){.quo-simple-supply-form{grid-template-columns:1fr}.quo-simple-supply-form .doc-field,.quo-simple-supply-form .note-field,.quo-simple-supply-form .btn{grid-column:auto}}
    `;document.head.appendChild(st);
  }
  syncNav();
})();
