/* Quo v76 - Admin-only Supply Usage.
   Prefer the final Invoice. A Quotation is offered only when no active Invoice exists yet. */
(function(){
  const state={rows:[],vendors:[],documents:[],loading:false,search:'',documentId:''};
  let searchTimer=null;
  const isAdmin=()=>S.role==='admin';
  const n=v=>{const x=Number(v);return Number.isFinite(x)?x:0};
  const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Indian/Maldives',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const qfmt=(v,u='')=>`${n(v).toLocaleString('en-US',{maximumFractionDigits:4})}${u?' '+u:''}`;
  const historyDocs=()=>[...(S.docs||[])]
    .filter(d=>!d.deleted_at&&['quotation','invoice'].includes(d.document_type))
    .sort((a,b)=>String(b.updated_at||b.created_at||'').localeCompare(String(a.updated_at||a.created_at||'')));
  const docLabel=d=>`${d.document_number||'Document'} · ${d.customer_name||'No customer'}${d.event_name?' · '+d.event_name:''}`;
  const typeLabel=t=>t==='invoice'?'Final Invoice':'Quotation';

  function syncNav(){
    const nav=document.querySelector('[data-view="supply-usage"]');
    if(nav)nav.hidden=!isAdmin();
  }

  function optionList(){
    const invoices=state.documents.filter(d=>d.document_type==='invoice');
    const quotes=state.documents.filter(d=>d.document_type==='quotation');
    const group=(label,list)=>list.length?`<optgroup label="${label}">${list.map(d=>`<option value="${esc(d.document_id)}">${esc(docLabel(d))}</option>`).join('')}</optgroup>`:'';
    return `<option value="">Select Final Invoice</option>${group('Final Invoices — use these first',invoices)}${group('Quotations — only when no Invoice exists yet',quotes)}`;
  }

  function historyOptionList(){
    return historyDocs().map(d=>`<option value="${esc(d.id)}">${esc(d.document_number||'Document')} · ${esc(d.customer_name||'No customer')}</option>`).join('');
  }

  function vendorOptions(){return state.vendors.map(v=>`<option value="${esc(v)}"></option>`).join('')}

  function lineHtml(values={}){
    return `<div class="quo-supply-line" data-supply-line>
      <label><span>Vendor</span><input data-line-vendor list="quoSupplyVendorList" autocomplete="off" placeholder="Select or type vendor" value="${esc(values.vendor||'')}"></label>
      <label><span>Supply</span><input data-line-supply placeholder="e.g. Basmati Rice" value="${esc(values.supply||'')}"></label>
      <label><span>Quantity</span><input data-line-qty type="number" min="0.0001" step="0.0001" placeholder="0" value="${esc(values.quantity||'')}"></label>
      <label><span>Unit</span><select data-line-unit>${['KG','G','PCS','L','ML','CSE'].map(u=>`<option${u===(values.unit||'KG')?' selected':''}>${u}</option>`).join('')}</select></label>
      <label class="quo-supply-line-note"><span>Note <small>optional</small></span><input data-line-note placeholder="e.g. Dinner catering" value="${esc(values.note||'')}"></label>
      <button class="quo-supply-line-remove" type="button" data-remove-line aria-label="Remove supply line" title="Remove line">×</button>
    </div>`;
  }

  function renderSupplyUsage(){
    if(!isAdmin()){S.view='dashboard';return previousRender()}
    if($('#topEyebrow'))$('#topEyebrow').textContent='INTERNAL';
    if($('#topTitle'))$('#topTitle').textContent='Supply Usage';
    setActiveNav();
    $('#view').innerHTML=`
      <div class="page-head quo-supply-page-head"><div><div class="eyebrow">WHITE SAFFRON · INTERNAL</div><h2>Supply Usage</h2><p>Record supplies against the final Invoice for the catering job.</p></div></div>
      <section class="panel quo-simple-supply-entry">
        <div class="panel-head"><div><h3>Record Supply</h3><p>Select the Final Invoice. A Quotation is shown only when that job has no Final Invoice yet.</p></div><span class="badge final">ADMIN ONLY</span></div>
        <form id="quoSupplyUsageForm" class="quo-simple-supply-form">
          <div class="quo-supply-context">
            <label class="doc-field"><span>Final Invoice / Document</span><select id="quoSupplyDoc" required><option value="">Loading documents…</option></select><small class="quo-doc-help">Final Invoice is the normal choice.</small></label>
            <label class="date-field"><span>Date Used</span><input id="quoSupplyDate" type="date" value="${today()}" required></label>
          </div>
          <div class="quo-supply-lines-bar"><div><strong>Supply Lines</strong><span>Vendor can be different on each line.</span></div><button class="btn" id="quoSupplyAddLine" type="button">+ Add Line</button></div>
          <datalist id="quoSupplyVendorList">${vendorOptions()}</datalist>
          <div id="quoSupplyLines" class="quo-supply-lines">${lineHtml()}</div>
          <div class="quo-supply-form-actions"><span>These lines only record which supplies were used for the selected catering document.</span><button class="btn primary" id="quoSupplySave" type="submit">Save Supply Usage</button></div>
        </form>
      </section>
      <section class="panel quo-simple-supply-list">
        <div class="panel-head"><div><h3>Supply History</h3><p>Search by vendor, supply, document, customer or event.</p></div></div>
        <div class="quo-simple-supply-toolbar">
          <input id="quoSupplyUsageSearch" type="search" placeholder="Search vendor, supply, document, customer or event">
          <select id="quoSupplyUsageDocFilter"><option value="">All documents</option>${historyOptionList()}</select>
        </div>
        <div id="quoSupplyUsageRows"><div class="empty">Loading supply usage…</div></div>
      </section>`;
    bindSupplyUI();
    loadDocumentOptions();
    loadVendors();
    loadRows();
  }

  function rowsHtml(rows){
    if(!rows.length)return '<div class="empty">No supply usage recorded yet.</div>';
    return `<div class="table-wrap"><table class="data-table quo-simple-supply-table"><thead><tr><th>Date</th><th>Document</th><th>Customer / Event</th><th>Vendor</th><th>Supply</th><th>Quantity</th><th>Note</th><th></th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.used_on?dateTiny(r.used_on):'-')}</td><td><button class="table-action quo-supply-doc-link" type="button" data-supply-open-doc="${esc(r.document_id)}"><strong>${esc(r.document_number||'Document')}</strong><span>${esc(typeLabel(r.document_type))}</span></button></td><td><strong>${esc(r.customer_name||'No customer')}</strong>${r.event_name?`<span class="subline">${esc(r.event_name)}</span>`:''}</td><td>${esc(r.vendor_name||'Not recorded')}</td><td><strong>${esc(r.supply_name)}</strong></td><td>${esc(qfmt(r.quantity,r.unit))}</td><td>${esc(r.note||'—')}</td><td class="row-actions"><button class="table-action danger-text" type="button" data-supply-usage-remove="${r.usage_id}">Remove</button></td></tr>`).join('')}</tbody></table></div>`;
  }

  async function loadDocumentOptions(){
    if(!isAdmin()||S.view!=='supply-usage')return;
    const select=$('#quoSupplyDoc');if(!select)return;
    try{
      const r=await sb.rpc('quo_supply_usage_document_options',{p_limit:2000});
      if(r.error)throw r.error;
      state.documents=r.data||[];
      select.innerHTML=optionList();
    }catch(e){
      console.error('Supply Usage document options failed',e);
      select.innerHTML='<option value="">Could not load documents</option>';
    }
  }

  async function loadVendors(){
    if(!isAdmin()||state.vendors.length)return;
    try{
      const r=await sb.rpc('quo_supply_usage_vendor_options',{p_limit:500});
      if(r.error)throw r.error;
      state.vendors=(r.data||[]).map(x=>String(x.vendor_name||'').trim()).filter(Boolean);
      const list=$('#quoSupplyVendorList');if(list)list.innerHTML=vendorOptions();
    }catch(e){console.warn('Vendor suggestions unavailable',e)}
  }

  async function loadRows(){
    if(!isAdmin()||S.view!=='supply-usage')return;
    const host=$('#quoSupplyUsageRows');if(!host)return;
    state.loading=true;host.innerHTML='<div class="empty">Loading supply usage…</div>';
    try{
      const r=await sb.rpc('quo_supply_usage_list',{p_search:state.search||null,p_document_id:state.documentId||null,p_limit:500});
      if(r.error)throw r.error;
      state.rows=r.data||[];host.innerHTML=rowsHtml(state.rows);bindRowActions();
    }catch(e){host.innerHTML=`<div class="quo-simple-supply-error">${esc(e?.message||'Could not load supply usage.')}</div>`}
    finally{state.loading=false}
  }

  function addLine(){
    const host=$('#quoSupplyLines');if(!host)return;
    host.insertAdjacentHTML('beforeend',lineHtml());
    bindLineActions();
    host.lastElementChild?.querySelector('[data-line-vendor]')?.focus();
  }

  function bindLineActions(){
    $$('[data-remove-line]').forEach(b=>{
      if(b.dataset.bound)return;b.dataset.bound='1';
      b.onclick=()=>{
        const host=$('#quoSupplyLines'),row=b.closest('[data-supply-line]');if(!host||!row)return;
        if(host.querySelectorAll('[data-supply-line]').length>1)row.remove();
        else row.querySelectorAll('input').forEach(i=>i.value='');
      };
    });
  }

  function collectLines(){
    const lines=[];
    for(const row of $$('[data-supply-line]')){
      const vendor=row.querySelector('[data-line-vendor]')?.value.trim()||'';
      const supply=row.querySelector('[data-line-supply]')?.value.trim()||'';
      const qty=row.querySelector('[data-line-qty]')?.value.trim()||'';
      const unit=row.querySelector('[data-line-unit]')?.value||'PCS';
      const note=row.querySelector('[data-line-note]')?.value.trim()||'';
      if(!vendor&&!supply&&!qty&&!note)continue;
      if(!vendor)throw new Error('Enter the Vendor for every supply line.');
      if(!supply)throw new Error('Enter the Supply name for every line.');
      if(n(qty)<=0)throw new Error(`Enter a quantity greater than zero for ${supply}.`);
      lines.push({vendor,supply,quantity:n(qty),unit,note});
    }
    if(!lines.length)throw new Error('Add at least one supply line.');
    return lines;
  }

  async function saveUsage(e){
    e.preventDefault();
    const documentId=$('#quoSupplyDoc')?.value||'',usedOn=$('#quoSupplyDate')?.value||today();
    if(!documentId)return alert('Select the Final Invoice. Use a Quotation only when no Final Invoice exists yet.');
    let lines;try{lines=collectLines()}catch(err){return alert(err.message)}
    const btn=$('#quoSupplySave');btn.disabled=true;btn.textContent='Saving…';
    try{
      const r=await sb.rpc('quo_add_supply_usage_lines',{p_document_id:documentId,p_used_on:usedOn,p_lines:lines});
      if(r.error)throw r.error;
      $('#quoSupplyLines').innerHTML=lineHtml();bindLineActions();
      toast(`${r.data||lines.length} supply line${Number(r.data||lines.length)===1?'':'s'} saved`);
      await loadRows();
      $('#quoSupplyLines [data-line-vendor]')?.focus();
    }catch(e){alert('Could not save supply usage: '+(e?.message||e))}
    finally{btn.disabled=false;btn.textContent='Save Supply Usage'}
  }

  async function removeUsage(id){
    if(!confirm('Remove this supply usage record? The selected document itself will not be changed.'))return;
    try{const r=await sb.rpc('quo_remove_supply_usage',{p_usage_id:Number(id)});if(r.error)throw r.error;toast('Supply usage removed');await loadRows()}
    catch(e){alert('Could not remove supply usage: '+(e?.message||e))}
  }

  async function openExistingDocument(id){
    let d=(S.docs||[]).find(x=>String(x.id)===String(id));
    if(!d){const r=await sb.from('quo_documents').select('*').eq('id',id).maybeSingle();if(r.error||!r.data)return alert('Could not open this document.');d=r.data;S.docs=[d,...(S.docs||[])]}
    S.editorDirty=false;openEditor(d);scrollTo(0,0);
  }

  function bindRowActions(){
    $$('[data-supply-usage-remove]').forEach(b=>b.onclick=()=>removeUsage(b.dataset.supplyUsageRemove));
    $$('[data-supply-open-doc]').forEach(b=>b.onclick=()=>openExistingDocument(b.dataset.supplyOpenDoc));
  }

  function bindSupplyUI(){
    syncNav();
    const form=$('#quoSupplyUsageForm');if(form)form.onsubmit=saveUsage;
    const add=$('#quoSupplyAddLine');if(add)add.onclick=addLine;
    const search=$('#quoSupplyUsageSearch');if(search)search.oninput=()=>{state.search=search.value.trim();clearTimeout(searchTimer);searchTimer=setTimeout(loadRows,250)};
    const filter=$('#quoSupplyUsageDocFilter');if(filter)filter.onchange=()=>{state.documentId=filter.value;loadRows()};
    bindLineActions();bindRowActions();
  }

  const previousRender=render;
  render=function(){if(S.view==='supply-usage')return renderSupplyUsage();const result=previousRender.apply(this,arguments);syncNav();return result};
  try{const previousBind=bindDynamic;bindDynamic=function(){const r=previousBind.apply(this,arguments);syncNav();if(S.view==='supply-usage')bindSupplyUI();return r}}catch(e){}

  document.getElementById('quoSimpleSupplyV75Style')?.remove();
  document.getElementById('quoSimpleSupplyV73Style')?.remove();
  if(!document.getElementById('quoSimpleSupplyV76Style')){
    const st=document.createElement('style');st.id='quoSimpleSupplyV76Style';st.textContent=`
      [data-view="supply-usage"][hidden]{display:none!important}.quo-supply-page-head,.quo-simple-supply-entry,.quo-simple-supply-list{min-width:0;max-width:100%}.quo-simple-supply-entry{margin-bottom:14px;overflow:hidden}.quo-simple-supply-list{margin-bottom:24px;overflow:hidden}.quo-simple-supply-entry .panel-head p,.quo-simple-supply-list .panel-head p{margin:3px 0 0;color:var(--muted);font-size:9px}.quo-simple-supply-form{min-width:0}.quo-simple-supply-form label{display:grid;gap:5px;min-width:0}.quo-simple-supply-form label>span{font-size:8px;font-weight:800;letter-spacing:.045em;text-transform:uppercase;color:#727b78}.quo-simple-supply-form label small{font-weight:600;text-transform:none;letter-spacing:0}.quo-doc-help{font-size:8px;color:var(--muted)}.quo-simple-supply-form input,.quo-simple-supply-form select,.quo-simple-supply-toolbar input,.quo-simple-supply-toolbar select{box-sizing:border-box;width:100%;min-width:0;height:38px;border:1px solid #d9dfdd;border-radius:7px;background:#fff;padding:0 10px;font-size:10px;color:#27312f;outline:0}.quo-simple-supply-form input:focus,.quo-simple-supply-form select:focus,.quo-simple-supply-toolbar input:focus,.quo-simple-supply-toolbar select:focus{border-color:#87a79f;box-shadow:0 0 0 3px rgba(70,124,112,.07)}.quo-supply-context{display:grid;grid-template-columns:minmax(0,1fr) 180px;gap:10px;padding:14px;border-bottom:1px solid var(--line2);background:#fbfcfc}.quo-supply-lines-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 14px 7px}.quo-supply-lines-bar>div{display:grid;gap:2px}.quo-supply-lines-bar strong{font-size:10px}.quo-supply-lines-bar span{font-size:8.5px;color:var(--muted)}.quo-supply-lines-bar .btn{min-height:34px;white-space:nowrap}.quo-supply-lines{display:grid;gap:8px;padding:0 14px 12px}.quo-supply-line{display:grid;grid-template-columns:minmax(150px,1.05fr) minmax(175px,1.3fr) 95px 82px minmax(150px,1fr) 34px;gap:8px;align-items:end;min-width:0;padding:10px;border:1px solid #e3e7e5;border-radius:9px;background:#fff}.quo-supply-line-remove{width:34px;height:38px;border:1px solid #ead9d5;border-radius:7px;background:#fff9f7;color:#9b554b;font-size:18px;line-height:1;cursor:pointer}.quo-supply-form-actions{display:flex;align-items:center;justify-content:flex-end;gap:14px;padding:11px 14px;border-top:1px solid var(--line2);background:#fafbfb}.quo-supply-form-actions span{margin-right:auto;font-size:8.5px;color:var(--muted)}.quo-supply-form-actions .btn{min-width:150px;min-height:38px;white-space:nowrap}.quo-simple-supply-toolbar{display:grid;grid-template-columns:minmax(0,1fr) minmax(220px,.7fr);gap:9px;padding:11px 14px;border-bottom:1px solid var(--line2);background:#fafbfb}.quo-simple-supply-table{min-width:980px}.quo-simple-supply-table .quo-supply-doc-link{display:grid;gap:2px;text-align:left}.quo-simple-supply-table .quo-supply-doc-link strong{font-size:9.5px}.quo-simple-supply-table .quo-supply-doc-link span{font-size:7.5px;color:var(--muted);text-transform:uppercase}.quo-simple-supply-error{padding:18px;text-align:center;color:#98483f;background:#fff6f5}
      @media(max-width:1120px){.quo-supply-line{grid-template-columns:minmax(160px,1fr) minmax(180px,1.2fr) 95px 82px 34px}.quo-supply-line-note{grid-column:1/5}.quo-supply-line-remove{grid-column:5;grid-row:1/3;align-self:center}}
      @media(max-width:760px){.quo-supply-context{grid-template-columns:1fr}.quo-supply-line{grid-template-columns:1fr 1fr}.quo-supply-line-note{grid-column:1/-1}.quo-supply-line-remove{grid-column:2;grid-row:auto;justify-self:end}.quo-supply-lines-bar{align-items:flex-start}.quo-supply-form-actions{align-items:stretch;flex-direction:column}.quo-supply-form-actions span{margin-right:0}.quo-supply-form-actions .btn{width:100%}.quo-simple-supply-toolbar{grid-template-columns:1fr}.quo-simple-supply-table{min-width:920px}}
      @media(max-width:480px){.quo-supply-line{grid-template-columns:1fr}.quo-supply-line-note,.quo-supply-line-remove{grid-column:auto}.quo-supply-line-remove{justify-self:stretch;width:100%;font-size:10px}.quo-supply-line-remove::after{content:' Remove line';font-size:9px;vertical-align:middle}}
    `;document.head.appendChild(st);
  }
  syncNav();
})();