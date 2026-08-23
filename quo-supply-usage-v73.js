/* Quo v77 - Admin-only Catering Supplies.
   Prefer the final Invoice. A Quotation is offered only when no active Invoice exists yet.
   Visible wording is kept simple for non-accounting staff; stored document/status values are unchanged. */
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
  const docLabel=d=>`${d.document_number||'Document'} · ${d.customer_name||'No customer'}${d.event_name?' · '+d.event_name:''}${d.service_pax?` · ${n(d.service_pax).toLocaleString()} pax`:''}`;
  const typeLabel=t=>t==='invoice'?'Final Invoice':'Quotation';
  const friendlyStatus=v=>({
    'Follow Up':'Waiting for Customer',
    'Lost':'Customer Did Not Proceed',
    'Converted':'Invoice Created',
    'Superseded':'Previous Version',
    'Awaiting Payment':'Waiting for Payment',
    'Part Paid':'Partly Paid',
    'Overdue':'Payment Overdue',
    'Accepted':'Confirmed'
  })[String(v||'')]||String(v||'');

  function setText(selector,text){const el=document.querySelector(selector);if(el)el.textContent=text}
  function replaceButtonText(root=document){
    const map={
      'Convert to Proforma Invoice':'Create Payment Request',
      'Open Proforma Invoice':'Open Payment Request',
      'Create Receipt':'Record Payment',
      'Amend Document':'Correct Document',
      'Amend unavailable':'Correction unavailable',
      'Void Document':'Cancel Document',
      'Void Receipt':'Cancel Payment Receipt'
    };
    root.querySelectorAll?.('button').forEach(b=>{const key=b.textContent.trim();if(map[key])b.textContent=map[key]});
  }

  function applyPlainLanguage(){
    setText('[data-filter="proforma"] span:last-child','Payment Requests');
    setText('[data-filter="receipt"] span:last-child','Payment Receipts');
    setText('[data-view="supply-usage"] span:last-child','Catering Supplies');

    const createPayment=document.querySelector('[data-create="proforma"]');
    if(createPayment){
      const span=createPayment.querySelector('span');if(span)span.textContent='Payment Request';
      const small=createPayment.querySelector('small');if(small)small.textContent='Request customer payment';
    }

    if(S.view==='documents'&&S.filter==='proforma'){
      setText('#topTitle','Payment Requests');
      const h=document.querySelector('#view .page-head h2');if(h)h.textContent='Payment Requests';
    }
    if(S.view==='documents'&&S.filter==='receipt'){
      setText('#topTitle','Payment Receipts');
      const h=document.querySelector('#view .page-head h2');if(h)h.textContent='Payment Receipts';
    }
    if(S.view==='supply-usage'){
      setText('#topTitle','Catering Supplies');
      const newBtn=document.querySelector('#newDocBtn');if(newBtn)newBtn.hidden=true;
      const prepared=document.querySelector('.prepared-by');if(prepared)prepared.hidden=true;
    }else{
      const newBtn=document.querySelector('#newDocBtn');if(newBtn)newBtn.hidden=false;
      const prepared=document.querySelector('.prepared-by');if(prepared)prepared.hidden=false;
    }

    document.querySelectorAll('#view .subline').forEach(el=>{
      const t=el.textContent.trim();
      if(t==='Proforma Invoice')el.textContent='Payment Request';
      if(t==='Receipt')el.textContent='Payment Receipt';
    });
    document.querySelectorAll('#view .chip').forEach(el=>{
      const t=el.textContent.trim();
      if(t==='Proforma Invoice')el.textContent='Payment Request';
      if(t==='Receipt')el.textContent='Payment Receipt';
    });
    document.querySelectorAll('#view .badge').forEach(el=>{
      const raw=el.textContent.trim(),nice=friendlyStatus(raw);
      if(nice!==raw)el.textContent=nice;
    });
    const status=document.querySelector('[data-field="status"]');
    if(status)[...status.options].forEach(o=>{const raw=o.value||o.textContent.trim();o.textContent=friendlyStatus(raw)});

    replaceButtonText(document.querySelector('#view')||document);

    const banner=document.querySelector('.q66-revision-banner');
    if(banner){
      const stateEl=banner.querySelector('span');
      if(stateEl?.textContent.includes('Superseded'))stateEl.textContent='Previous Version';
      if(stateEl?.textContent.includes('Voided'))stateEl.textContent='Cancelled';
      const ctx=banner.querySelector('b');
      if(ctx?.textContent.startsWith('Replaced by '))ctx.textContent=ctx.textContent.replace('Replaced by ','New version: ');
      if(ctx?.textContent.startsWith('Amended from '))ctx.textContent=ctx.textContent.replace('Amended from ','Corrected from ');
      const open=banner.querySelector('[data-q66-open-related]');if(open)open.textContent='Open New Version';
    }

    const lock=document.querySelector('.q66-lock-note');
    if(lock){
      const b=lock.querySelector('b'),s=lock.querySelector('span');
      if(b?.textContent==='Issued receipt'){b.textContent='Saved Payment Receipt';if(s)s.textContent='Payment details are protected. Use Cancel Payment Receipt if this was recorded incorrectly.'}
      else if(b?.textContent==='Historical document'){b.textContent='Previous / Cancelled Document';if(s)s.textContent='This older version is kept for reference and cannot be edited.'}
      else if(b?.textContent==='Issued document locked'){b.textContent='Saved Document';if(s)s.textContent='This saved document is protected. Use Correct Document to make a corrected version.'}
    }

    const modal=document.getElementById('q66ActionModal');
    if(modal&&!modal.classList.contains('hidden')){
      const mode=modal.dataset.mode;
      if(mode==='amend'){
        setText('#q66ActionEyebrow','CORRECT DOCUMENT');
        const title=modal.querySelector('#q66ActionTitle');if(title)title.textContent=title.textContent.replace(/^Amend /,'Correct ');
        setText('#q66ReasonLabel','Why are you correcting this?');
        const confirm=modal.querySelector('#q66ActionConfirm');if(confirm)confirm.textContent='Create Corrected Version';
        const copy=modal.querySelector('#q66ActionCopy');
        if(copy){const b=copy.querySelector('b'),s=copy.querySelector('span');if(b)b.textContent='A corrected copy will be created.';if(s)s.textContent='The current document stays safely in history as the previous version.'}
      }else if(mode==='void'){
        setText('#q66ActionEyebrow','CANCEL DOCUMENT');
        const title=modal.querySelector('#q66ActionTitle');if(title)title.textContent=title.textContent.replace(/^Void /,'Cancel ');
        setText('#q66ReasonLabel','Reason for cancellation');
        const confirm=modal.querySelector('#q66ActionConfirm');if(confirm)confirm.textContent='Cancel Document';
        const copy=modal.querySelector('#q66ActionCopy');
        if(copy){const b=copy.querySelector('b'),s=copy.querySelector('span');if(b)b.textContent='This document will be cancelled.';if(s)s.textContent='It will remain safely in history for reference.'}
      }
    }

    const pageCopy=document.querySelector('#view .page-head p');
    if(pageCopy&&pageCopy.textContent.includes('commercial documents'))pageCopy.textContent='Create and track quotations, payment requests, invoices and payment receipts in one place.';
  }

  function syncNav(){
    const nav=document.querySelector('[data-view="supply-usage"]');
    if(nav){nav.hidden=!isAdmin();const label=nav.querySelector('span:last-child');if(label)label.textContent='Catering Supplies'}
    applyPlainLanguage();
  }

  function optionList(){
    const invoices=state.documents.filter(d=>d.document_type==='invoice');
    const quotes=state.documents.filter(d=>d.document_type==='quotation');
    const group=(label,list)=>list.length?`<optgroup label="${label}">${list.map(d=>`<option value="${esc(d.document_id)}">${esc(docLabel(d))}</option>`).join('')}</optgroup>`:'';
    return `<option value="">Select catering invoice</option>${group('Final Invoices — recommended',invoices)}${group('No invoice yet — use quotation temporarily',quotes)}`;
  }

  function historyOptionList(){
    return historyDocs().map(d=>`<option value="${esc(d.id)}">${esc(d.document_number||'Document')} · ${esc(d.customer_name||'No customer')}</option>`).join('');
  }

  function vendorOptions(){return state.vendors.map(v=>`<option value="${esc(v)}"></option>`).join('')}

  function lineHtml(values={}){
    return `<div class="quo-supply-line" data-supply-line>
      <label><span>Supplier</span><input data-line-vendor list="quoSupplyVendorList" autocomplete="off" placeholder="Select or type supplier" value="${esc(values.vendor||'')}"></label>
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
    if($('#topTitle'))$('#topTitle').textContent='Catering Supplies';
    setActiveNav();
    $('#view').innerHTML=`
      <div class="page-head quo-supply-page-head"><div><div class="eyebrow">WHITE SAFFRON · INTERNAL</div><h2>Catering Supplies</h2><p>Select the catering invoice and record what was bought for that job.</p></div></div>
      <section class="panel quo-simple-supply-entry">
        <div class="panel-head"><div><h3>Add Supplies</h3><p>Use the Final Invoice when available. If there is no invoice yet, the quotation can be used temporarily.</p></div><span class="badge final">ADMIN ONLY</span></div>
        <form id="quoSupplyUsageForm" class="quo-simple-supply-form">
          <div class="quo-supply-context">
            <label class="doc-field"><span>Select Catering Invoice</span><select id="quoSupplyDoc" required><option value="">Loading catering jobs…</option></select><small class="quo-doc-help">Final Invoice is the normal choice.</small></label>
            <label class="date-field"><span>Date Bought / Used</span><input id="quoSupplyDate" type="date" value="${today()}" required></label>
          </div>
          <div class="quo-supply-lines-bar"><div><strong>Supplies</strong><span>Each line can have a different supplier.</span></div><button class="btn" id="quoSupplyAddLine" type="button">+ Add Another Supply</button></div>
          <datalist id="quoSupplyVendorList">${vendorOptions()}</datalist>
          <div id="quoSupplyLines" class="quo-supply-lines">${lineHtml()}</div>
          <div class="quo-supply-form-actions"><span>This does not change the customer invoice.</span><button class="btn primary" id="quoSupplySave" type="submit">Save Supplies</button></div>
        </form>
      </section>
      <section class="panel quo-simple-supply-list">
        <div class="panel-head"><div><h3>Catering Supply History</h3><p>Search by supplier, supply, invoice, customer or event.</p></div></div>
        <div class="quo-simple-supply-toolbar">
          <input id="quoSupplyUsageSearch" type="search" placeholder="Search supplier, supply, invoice, customer or event">
          <select id="quoSupplyUsageDocFilter"><option value="">All catering jobs</option>${historyOptionList()}</select>
        </div>
        <div id="quoSupplyUsageRows"><div class="empty">Loading supplies…</div></div>
      </section>`;
    bindSupplyUI();
    loadDocumentOptions();
    loadVendors();
    loadRows();
    applyPlainLanguage();
  }

  function rowsHtml(rows){
    if(!rows.length)return '<div class="empty">No catering supplies recorded yet.</div>';
    return `<div class="table-wrap"><table class="data-table quo-simple-supply-table"><thead><tr><th>Date</th><th>Catering Document</th><th>Customer / Event</th><th>Supplier</th><th>Supply</th><th>Quantity</th><th>Note</th><th></th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.used_on?dateTiny(r.used_on):'-')}</td><td><button class="table-action quo-supply-doc-link" type="button" data-supply-open-doc="${esc(r.document_id)}"><strong>${esc(r.document_number||'Document')}</strong><span>${esc(typeLabel(r.document_type))}</span></button></td><td><strong>${esc(r.customer_name||'No customer')}</strong>${r.event_name?`<span class="subline">${esc(r.event_name)}</span>`:''}</td><td>${esc(r.vendor_name||'Not recorded')}</td><td><strong>${esc(r.supply_name)}</strong></td><td>${esc(qfmt(r.quantity,r.unit))}</td><td>${esc(r.note||'—')}</td><td class="row-actions"><button class="table-action danger-text" type="button" data-supply-usage-remove="${r.usage_id}">Remove</button></td></tr>`).join('')}</tbody></table></div>`;
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
      console.error('Catering Supplies document options failed',e);
      select.innerHTML='<option value="">Could not load catering jobs</option>';
    }
  }

  async function loadVendors(){
    if(!isAdmin()||state.vendors.length)return;
    try{
      const r=await sb.rpc('quo_supply_usage_vendor_options',{p_limit:500});
      if(r.error)throw r.error;
      state.vendors=(r.data||[]).map(x=>String(x.vendor_name||'').trim()).filter(Boolean);
      const list=$('#quoSupplyVendorList');if(list)list.innerHTML=vendorOptions();
    }catch(e){console.warn('Supplier suggestions unavailable',e)}
  }

  async function loadRows(){
    if(!isAdmin()||S.view!=='supply-usage')return;
    const host=$('#quoSupplyUsageRows');if(!host)return;
    state.loading=true;host.innerHTML='<div class="empty">Loading supplies…</div>';
    try{
      const r=await sb.rpc('quo_supply_usage_list',{p_search:state.search||null,p_document_id:state.documentId||null,p_limit:500});
      if(r.error)throw r.error;
      state.rows=r.data||[];host.innerHTML=rowsHtml(state.rows);bindRowActions();
    }catch(e){host.innerHTML=`<div class="quo-simple-supply-error">${esc(e?.message||'Could not load catering supplies.')}</div>`}
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
      if(!vendor)throw new Error('Enter the Supplier for every supply line.');
      if(!supply)throw new Error('Enter the Supply name for every line.');
      if(n(qty)<=0)throw new Error(`Enter how much was bought for ${supply}, for example 10 KG or 2 CSE.`);
      lines.push({vendor,supply,quantity:n(qty),unit,note});
    }
    if(!lines.length)throw new Error('Add at least one supply.');
    return lines;
  }

  async function saveUsage(e){
    e.preventDefault();
    const documentId=$('#quoSupplyDoc')?.value||'',usedOn=$('#quoSupplyDate')?.value||today();
    if(!documentId)return alert('Select the catering Final Invoice. Use the quotation only if an Invoice has not been created yet.');
    let lines;try{lines=collectLines()}catch(err){return alert(err.message)}
    const btn=$('#quoSupplySave');btn.disabled=true;btn.textContent='Saving…';
    try{
      const r=await sb.rpc('quo_add_supply_usage_lines',{p_document_id:documentId,p_used_on:usedOn,p_lines:lines});
      if(r.error)throw r.error;
      $('#quoSupplyLines').innerHTML=lineHtml();bindLineActions();
      toast(`${r.data||lines.length} suppl${Number(r.data||lines.length)===1?'y':'ies'} saved`);
      await loadRows();
      $('#quoSupplyLines [data-line-vendor]')?.focus();
    }catch(e){
      let msg=e?.message||String(e);
      if(/already has Final Invoice/i.test(msg))msg='This catering already has a Final Invoice. Please select that Invoice instead.';
      alert('Could not save supplies: '+msg);
    }
    finally{btn.disabled=false;btn.textContent='Save Supplies'}
  }

  async function removeUsage(id){
    if(!confirm('Remove this supply record? The customer document itself will not be changed.'))return;
    try{const r=await sb.rpc('quo_remove_supply_usage',{p_usage_id:Number(id)});if(r.error)throw r.error;toast('Supply record removed');await loadRows()}
    catch(e){alert('Could not remove supply: '+(e?.message||e))}
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
    bindLineActions();bindRowActions();applyPlainLanguage();
  }

  const previousRender=render;
  render=function(){
    if(S.view==='supply-usage')return renderSupplyUsage();
    const result=previousRender.apply(this,arguments);
    syncNav();applyPlainLanguage();
    return result;
  };
  try{
    const previousBind=bindDynamic;
    bindDynamic=function(){const r=previousBind.apply(this,arguments);syncNav();if(S.view==='supply-usage')bindSupplyUI();applyPlainLanguage();return r};
  }catch(e){}

  document.addEventListener('click',e=>{
    if(e.target.closest?.('[data-q66-amend],[data-q66-void],.editor-more'))setTimeout(applyPlainLanguage,0);
  });

  document.getElementById('quoSimpleSupplyV75Style')?.remove();
  document.getElementById('quoSimpleSupplyV73Style')?.remove();
  document.getElementById('quoSimpleSupplyV76Style')?.remove();
  if(!document.getElementById('quoSimpleSupplyV77Style')){
    const st=document.createElement('style');st.id='quoSimpleSupplyV77Style';st.textContent=`
      [data-view="supply-usage"][hidden]{display:none!important}.quo-supply-page-head,.quo-simple-supply-entry,.quo-simple-supply-list{min-width:0;max-width:100%}.quo-simple-supply-entry{margin-bottom:14px;overflow:hidden}.quo-simple-supply-list{margin-bottom:24px;overflow:hidden}.quo-simple-supply-entry .panel-head p,.quo-simple-supply-list .panel-head p{margin:3px 0 0;color:var(--muted);font-size:9px}.quo-simple-supply-form{min-width:0}.quo-simple-supply-form label{display:grid;gap:5px;min-width:0}.quo-simple-supply-form label>span{font-size:8px;font-weight:800;letter-spacing:.045em;text-transform:uppercase;color:#727b78}.quo-simple-supply-form label small{font-weight:600;text-transform:none;letter-spacing:0}.quo-doc-help{font-size:8px;color:var(--muted)}.quo-simple-supply-form input,.quo-simple-supply-form select,.quo-simple-supply-toolbar input,.quo-simple-supply-toolbar select{box-sizing:border-box;width:100%;min-width:0;height:38px;border:1px solid #d9dfdd;border-radius:7px;background:#fff;padding:0 10px;font-size:10px;color:#27312f;outline:0}.quo-simple-supply-form input:focus,.quo-simple-supply-form select:focus,.quo-simple-supply-toolbar input:focus,.quo-simple-supply-toolbar select:focus{border-color:#87a79f;box-shadow:0 0 0 3px rgba(70,124,112,.07)}.quo-supply-context{display:grid;grid-template-columns:minmax(0,1fr) 180px;gap:10px;padding:14px;border-bottom:1px solid var(--line2);background:#fbfcfc}.quo-supply-lines-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 14px 7px}.quo-supply-lines-bar>div{display:grid;gap:2px}.quo-supply-lines-bar strong{font-size:10px}.quo-supply-lines-bar span{font-size:8.5px;color:var(--muted)}.quo-supply-lines-bar .btn{min-height:34px;white-space:nowrap}.quo-supply-lines{display:grid;gap:8px;padding:0 14px 12px}.quo-supply-line{display:grid;grid-template-columns:minmax(150px,1.05fr) minmax(175px,1.3fr) 95px 82px minmax(150px,1fr) 34px;gap:8px;align-items:end;min-width:0;padding:10px;border:1px solid #e3e7e5;border-radius:9px;background:#fff}.quo-supply-line-remove{width:34px;height:38px;border:1px solid #ead9d5;border-radius:7px;background:#fff9f7;color:#9b554b;font-size:18px;line-height:1;cursor:pointer}.quo-supply-form-actions{display:flex;align-items:center;justify-content:flex-end;gap:14px;padding:11px 14px;border-top:1px solid var(--line2);background:#fafbfb}.quo-supply-form-actions span{margin-right:auto;font-size:8.5px;color:var(--muted)}.quo-supply-form-actions .btn{min-width:150px;min-height:38px;white-space:nowrap}.quo-simple-supply-toolbar{display:grid;grid-template-columns:minmax(0,1fr) minmax(220px,.7fr);gap:9px;padding:11px 14px;border-bottom:1px solid var(--line2);background:#fafbfb}.quo-simple-supply-table{min-width:980px}.quo-simple-supply-table .quo-supply-doc-link{display:grid;gap:2px;text-align:left}.quo-simple-supply-table .quo-supply-doc-link strong{font-size:9.5px}.quo-simple-supply-table .quo-supply-doc-link span{font-size:7.5px;color:var(--muted);text-transform:uppercase}.quo-simple-supply-error{padding:18px;text-align:center;color:#98483f;background:#fff6f5}
      @media(max-width:1120px){.quo-supply-line{grid-template-columns:minmax(160px,1fr) minmax(180px,1.2fr) 95px 82px 34px}.quo-supply-line-note{grid-column:1/5}.quo-supply-line-remove{grid-column:5;grid-row:1/3;align-self:center}}
      @media(max-width:760px){.quo-supply-context{grid-template-columns:1fr}.quo-supply-line{grid-template-columns:1fr 1fr}.quo-supply-line-note{grid-column:1/-1}.quo-supply-line-remove{grid-column:2;grid-row:auto;justify-self:end}.quo-supply-lines-bar{align-items:flex-start}.quo-supply-form-actions{align-items:stretch;flex-direction:column}.quo-supply-form-actions span{margin-right:0}.quo-supply-form-actions .btn{width:100%}.quo-simple-supply-toolbar{grid-template-columns:1fr}.quo-simple-supply-table{min-width:920px}}
      @media(max-width:480px){.quo-supply-line{grid-template-columns:1fr}.quo-supply-line-note,.quo-supply-line-remove{grid-column:auto}.quo-supply-line-remove{justify-self:stretch;width:100%;font-size:10px}.quo-supply-line-remove::after{content:' Remove line';font-size:9px;vertical-align:middle}}
    `;document.head.appendChild(st);
  }
  syncNav();applyPlainLanguage();
})();