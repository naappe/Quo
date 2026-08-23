/* Quo v66 - issued-document amendments, revision history and void workflow. */
(function(){
  if(typeof S==='undefined'||typeof sb==='undefined')return;
  window.QUO_AMENDMENTS_VERSION='66';

  const INACTIVE=new Set(['Cancelled','Superseded']);
  const clean=v=>String(v||'').trim();
  const hasPayment=d=>d?.document_type==='invoice'&&(Number(d.paid_amount||0)>.005||['Part Paid','Paid'].includes(d.payment_status));
  const isHistorical=d=>!!d&&INACTIVE.has(d.status);
  const isIssuedLocked=d=>!!d?.id&&(d.document_type==='receipt'||(d.document_type!=='receipt'&&d.status!=='Draft'));
  const actor=()=>clean(S.displayName)||'White Saffron';

  /* Cancel/Supersede are audit actions, not ordinary dropdown statuses. */
  if(typeof CFG!=='undefined'){
    if(CFG.quotation)CFG.quotation.statuses=['Draft','Sent','Follow Up','Confirmed','Lost','Expired'];
    if(CFG.proforma)CFG.proforma.statuses=['Draft','Sent','Awaiting Payment','Converted'];
    if(CFG.invoice)CFG.invoice.statuses=['Draft','Sent','Overdue'];
    if(CFG.receipt)CFG.receipt.statuses=['Issued'];
  }

  function activeLinked(d,type){
    const key=d?.deal_id||d?.id;
    return (S.docs||[]).find(x=>x.document_type===type&&!x.deleted_at&&!INACTIVE.has(x.status)&&(x.source_document_id===d?.id||(key&&x.deal_id===key)))||null;
  }

  function revisionLabel(d){return Number(d?.revision_no||0)>0?`Revision R${Number(d.revision_no)}`:'Original issue'}
  function relatedNumber(id){return (S.docs||[]).find(x=>x.id===id)?.document_number||''}

  function revisionBanner(d){
    if(!d?.id)return null;
    const existing=document.querySelector('.q66-revision-banner');
    if(existing)existing.remove();
    if(!Number(d.revision_no||0)&&!isHistorical(d)&&!clean(d.amendment_reason)&&!clean(d.void_reason))return null;

    const box=document.createElement('section');
    box.className=`q66-revision-banner ${isHistorical(d)?'historical':'revision'}`;
    const previous=relatedNumber(d.supersedes_document_id);
    const next=relatedNumber(d.superseded_by_id);
    const reason=clean(d.void_reason||d.amendment_reason);
    const state=d.status==='Superseded'?'Superseded - historical record':d.status==='Cancelled'?'Voided - historical record':revisionLabel(d);
    let context='';
    if(d.status==='Superseded'&&next)context=`Replaced by ${next}`;
    else if(d.status==='Cancelled')context='This version must not be used as a current commercial document.';
    else if(previous)context=`Amended from ${previous}`;
    else if(Number(d.revision_no||0)>0)context='Current revised version';
    box.innerHTML=`<div><span>${esc(state)}</span><b>${esc(context)}</b>${reason?`<small>Reason: ${esc(reason)}</small>`:''}</div>${next?`<button type="button" class="btn" data-q66-open-related="${esc(d.superseded_by_id)}">Open replacement</button>`:''}`;
    document.querySelector('.editor-top')?.insertAdjacentElement('afterend',box);
    return box;
  }

  function fieldLockNote(d){
    document.querySelector('.q66-lock-note')?.remove();
    if(!isIssuedLocked(d)||!d.id)return;
    const note=document.createElement('div');note.className='q66-lock-note';
    if(d.document_type==='receipt')note.innerHTML='<b>Issued receipt</b><span>Payment details are locked. Use Void Receipt if the payment was recorded incorrectly.</span>';
    else if(isHistorical(d))note.innerHTML='<b>Historical document</b><span>This version is read-only and retained for audit history.</span>';
    else note.innerHTML='<b>Issued document locked</b><span>Commercial details cannot be overwritten. Use Amend to create a new revision.</span>';
    document.querySelector('.editor-main')?.prepend(note);
  }

  function lockEditor(d){
    if(!d?.id)return;
    const locked=isIssuedLocked(d);
    if(!locked)return;

    document.querySelectorAll('[data-field]').forEach(el=>{
      const isStatus=el.dataset.field==='status';
      if(isStatus)return;
      if(el.tagName==='SELECT'||el.type==='checkbox')el.disabled=true;
      else el.readOnly=true;
      el.setAttribute('aria-readonly','true');
    });
    document.querySelectorAll('[data-item-field]').forEach(el=>{el.readOnly=true;el.setAttribute('aria-readonly','true')});
    document.querySelectorAll('[data-add-item],[data-remove-item],[data-quo-terms-add],[data-quo-terms-remove],.quo-terms-action').forEach(el=>{el.disabled=true;el.classList.add('q66-disabled-control')});

    const status=document.querySelector('[data-field="status"]');
    const hardLocked=d.document_type==='receipt'||isHistorical(d)||(d.document_type==='quotation'&&d.status==='Confirmed')||(d.document_type==='proforma'&&d.status==='Converted');
    if(status)status.disabled=hardLocked;

    const save=document.querySelector('[data-save]');
    if(save){
      if(hardLocked){save.hidden=true}
      else{save.hidden=false;save.textContent='Save Status'}
    }
    fieldLockNote(d);
  }

  function configureLinkedButtons(d,menu){
    if(!menu||!d)return;
    if(isHistorical(d)){
      menu.querySelectorAll('[data-convert]').forEach(el=>el.remove());
      return;
    }
    if(d.document_type==='quotation'){
      const b=menu.querySelector('[data-convert="proforma"]');if(b)b.textContent=activeLinked(d,'proforma')?'Open Proforma Invoice':'Convert to Proforma Invoice';
    }
    if(d.document_type==='proforma'){
      const b=menu.querySelector('[data-convert="invoice"]');if(b)b.textContent=activeLinked(d,'invoice')?'Open Invoice':'Convert to Invoice';
    }
  }

  function configureActions(d){
    const menu=document.querySelector('.editor-more-menu');if(!menu||!d)return;
    menu.querySelectorAll('[data-q66-amend],[data-q66-void]').forEach(el=>el.remove());
    configureLinkedButtons(d,menu);

    const del=menu.querySelector('[data-delete-doc]');
    if(del&&(isHistorical(d)||d.document_type==='receipt'))del.remove();

    const before=menu.querySelector('[data-delete-doc]');
    if(d.id&&d.document_type!=='receipt'&&d.status!=='Draft'&&!isHistorical(d)){
      const amend=document.createElement('button');amend.type='button';amend.className='btn';amend.dataset.q66Amend='';
      if(hasPayment(d)){amend.textContent='Amend unavailable';amend.disabled=true;amend.title='Paid or part-paid invoices are locked and cannot be amended here.'}
      else amend.textContent='Amend Document';
      menu.insertBefore(amend,before||null);
    }
    if(d.id&&(d.document_type==='receipt'||d.status!=='Draft')&&!isHistorical(d)){
      const voidBtn=document.createElement('button');voidBtn.type='button';voidBtn.className='btn danger';voidBtn.dataset.q66Void='';voidBtn.textContent=d.document_type==='receipt'?'Void Receipt':'Void Document';
      menu.insertBefore(voidBtn,before||null);
    }
  }

  function ensureModal(){
    let modal=document.getElementById('q66ActionModal');if(modal)return modal;
    modal=document.createElement('div');modal.id='q66ActionModal';modal.className='modal hidden';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');
    modal.innerHTML=`<div class="modal-card q66-action-modal"><div class="modal-head"><div><div class="eyebrow" id="q66ActionEyebrow">DOCUMENT CONTROL</div><h2 id="q66ActionTitle">Amend Document</h2></div><button class="icon-btn" type="button" data-q66-close>×</button></div><div class="q66-action-copy" id="q66ActionCopy"></div><div class="field full"><label id="q66ReasonLabel">Reason</label><textarea id="q66ActionReason" maxlength="500" placeholder="Enter the reason for this change"></textarea><small class="q66-reason-help">This reason is kept in the internal revision history and is not printed as customer-facing terms.</small></div><div class="q66-action-buttons"><button class="btn" type="button" data-q66-close>Cancel</button><button class="btn primary" type="button" id="q66ActionConfirm">Continue</button></div></div>`;
    document.body.appendChild(modal);
    modal.querySelectorAll('[data-q66-close]').forEach(b=>b.onclick=()=>modal.classList.add('hidden'));
    modal.addEventListener('click',e=>{if(e.target===modal)modal.classList.add('hidden')});
    modal.querySelector('#q66ActionConfirm').onclick=submitAction;
    return modal;
  }

  function actionCopy(d,mode){
    if(mode==='amend'){
      if(d.document_type==='quotation')return '<b>A new quotation revision will be created.</b><span>The current quotation remains in history as Superseded. If it has a Proforma but no Invoice yet, that Proforma is also superseded automatically.</span>';
      if(d.document_type==='proforma')return '<b>A new Proforma revision will be created.</b><span>The current Proforma remains in history. An existing Invoice prevents this amendment.</span>';
      return '<b>A corrected Invoice revision will be created.</b><span>This is allowed only before any payment is recorded. Paid or part-paid invoices are locked and cannot be amended here.</span>';
    }
    if(d.document_type==='receipt')return '<b>Voiding this receipt reverses this recorded payment.</b><span>The related Invoice balance and payment status are recalculated automatically. The receipt remains in history as Cancelled.</span>';
    return '<b>This document will remain in history as Cancelled.</b><span>Linked later-stage documents can prevent a void so the commercial chain cannot be broken accidentally.</span>';
  }

  function openAction(mode){
    const d=S.current;if(!d?.id)return;
    const modal=ensureModal();modal.dataset.mode=mode;modal.dataset.documentId=d.id;
    modal.querySelector('#q66ActionEyebrow').textContent=mode==='amend'?'REVISION CONTROL':'VOID CONTROL';
    modal.querySelector('#q66ActionTitle').textContent=mode==='amend'?`Amend ${d.document_number}`:`Void ${d.document_number}`;
    modal.querySelector('#q66ReasonLabel').textContent=mode==='amend'?'Amendment reason':'Void reason';
    modal.querySelector('#q66ActionCopy').innerHTML=actionCopy(d,mode);
    modal.querySelector('#q66ActionReason').value='';
    const confirmBtn=modal.querySelector('#q66ActionConfirm');confirmBtn.textContent=mode==='amend'?'Create Revision':'Void Document';confirmBtn.classList.toggle('danger',mode==='void');
    modal.classList.remove('hidden');setTimeout(()=>modal.querySelector('#q66ActionReason')?.focus(),30);
  }

  async function submitAction(){
    const modal=ensureModal(),mode=modal.dataset.mode,id=modal.dataset.documentId,reason=clean(modal.querySelector('#q66ActionReason').value),btn=modal.querySelector('#q66ActionConfirm');
    if(!reason){alert('Enter a reason before continuing.');modal.querySelector('#q66ActionReason').focus();return}
    btn.disabled=true;btn.textContent=mode==='amend'?'Creating revision...':'Voiding...';
    try{
      const rpc=mode==='amend'?'quo_amend_document':'quo_void_document';
      const r=await sb.rpc(rpc,{p_document_id:id,p_reason:reason});if(r.error)throw r.error;
      await refreshDocs();modal.classList.add('hidden');S.editorDirty=false;
      if(mode==='amend'){
        const target=r.data?.document;const fresh=(S.docs||[]).find(x=>x.id===target?.id)||target;
        if(!fresh?.id)throw new Error('The revised document was not returned.');
        openEditor(fresh);
        const downstream=r.data?.downstream_proforma_superseded;
        toast(`${fresh.document_number} created${downstream?` - ${downstream} superseded`:''}`);
      }else{
        const fresh=(S.docs||[]).find(x=>x.id===id)||r.data?.document;
        if(fresh?.id)openEditor(fresh);else render();
        toast(`${fresh?.document_number||'Document'} voided`);
      }
    }catch(e){console.error(e);alert(`${mode==='amend'?'Amendment':'Void'} failed: ${e?.message||'Unknown error'}`)}
    finally{btn.disabled=false;btn.textContent=mode==='amend'?'Create Revision':'Void Document'}
  }

  function applyEditorUI(){
    if(S.view!=='editor'||!S.current)return;
    const d=S.current;
    revisionBanner(d);lockEditor(d);configureActions(d);
    document.querySelectorAll('[data-q66-open-related]').forEach(b=>b.onclick=()=>{const x=(S.docs||[]).find(row=>row.id===b.dataset.q66OpenRelated);if(x)openEditor(x)});
    document.querySelector('[data-q66-amend]')?.addEventListener('click',()=>openAction('amend'));
    document.querySelector('[data-q66-void]')?.addEventListener('click',()=>openAction('void'));
  }

  /* Superseded versions stay searchable, but must not inflate live dashboard totals. */
  try{
    const previousDashboard=renderDashboard;
    renderDashboard=function(){
      const all=S.docs;S.docs=(all||[]).filter(d=>d.status!=='Superseded');
      try{return previousDashboard.apply(this,arguments)}finally{S.docs=all}
    };
  }catch(e){}
  try{
    const previousCustomers=uniqueCustomers;
    uniqueCustomers=function(){
      const all=S.docs;S.docs=(all||[]).filter(d=>d.status!=='Superseded');
      try{return previousCustomers.apply(this,arguments)}finally{S.docs=all}
    };
  }catch(e){}

  /* Independent duplicates must never inherit revision lineage. */
  try{
    const previousDuplicate=duplicateCurrent;
    duplicateCurrent=function(){
      const result=previousDuplicate.apply(this,arguments);
      if(S.current&&!S.current.id){
        Object.assign(S.current,{revision_root_id:null,revision_no:0,supersedes_document_id:null,superseded_by_id:null,amendment_reason:null,void_reason:null});
        render();
      }
      return result;
    };
  }catch(e){}

  /* Customer-facing PDFs show the revision identifier, while historical PDFs are unmistakable. */
  try{
    const previousPrint=renderPrint;
    renderPrint=function(d){
      const result=previousPrint.apply(this,arguments);
      const root=document.getElementById('printRoot');if(!root||!d)return result;
      root.querySelectorAll('.pdf-page').forEach(page=>{
        if(Number(d.revision_no||0)>0&&!page.querySelector('.q66-pdf-revision')){
          const doc=page.querySelector('.q26-doc');
          if(doc){const tag=document.createElement('div');tag.className='q66-pdf-revision';tag.textContent=`REVISION R${Number(d.revision_no)}`;doc.appendChild(tag)}
        }
        if(isHistorical(d)&&!page.querySelector('.q66-pdf-history-state')){
          const head=page.querySelector('.q26-head,.q26-menu-head');
          if(head){const tag=document.createElement('div');tag.className=`q66-pdf-history-state ${d.status==='Cancelled'?'voided':'superseded'}`;tag.textContent=d.status==='Cancelled'?'VOID / CANCELLED':'SUPERSEDED - NOT CURRENT';head.insertAdjacentElement('afterend',tag)}
        }
      });
      return result;
    };
  }catch(e){}

  try{
    const previousBind=bindDynamic;
    bindDynamic=function(){const result=previousBind.apply(this,arguments);applyEditorUI();return result};
  }catch(e){}

  document.addEventListener('keydown',e=>{if(e.key==='Escape')document.getElementById('q66ActionModal')?.classList.add('hidden')});

  if(!document.getElementById('quoAmendmentsV66Style')){
    const st=document.createElement('style');st.id='quoAmendmentsV66Style';st.textContent=`
      .q66-revision-banner{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 12px;padding:10px 12px;border:1px solid #d8e3df;border-radius:9px;background:#f4f8f6}.q66-revision-banner.historical{border-color:#ead8d3;background:#fff6f3}.q66-revision-banner>div{min-width:0}.q66-revision-banner span{display:block;font-size:8px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#49665e}.q66-revision-banner.historical span{color:#8a4e44}.q66-revision-banner b{display:block;margin-top:3px;font-size:10px;color:#293934}.q66-revision-banner small{display:block;margin-top:4px;font-size:8.5px;line-height:1.4;color:#6f7a76}
      .q66-lock-note{grid-column:1/-1;display:flex;align-items:center;gap:10px;padding:9px 11px;border:1px solid #e1e6e4;border-radius:8px;background:#fafbfb}.q66-lock-note b{font-size:9px;color:#40504b;white-space:nowrap}.q66-lock-note span{font-size:8.5px;line-height:1.4;color:#747e7a}.q66-disabled-control{opacity:.48!important;pointer-events:none!important}
      .editor-main input[readonly],.editor-main textarea[readonly],.editor-main select:disabled{background:#f6f7f7!important;color:#66716d!important;cursor:default!important}.editor-main [data-item-field][readonly]{border-color:#e3e7e5!important}
      .q66-action-modal{width:min(610px,calc(100vw - 24px))}.q66-action-copy{display:flex;flex-direction:column;gap:4px;margin:0 0 13px;padding:10px 11px;border:1px solid #dfe5e2;border-radius:8px;background:#f8faf9}.q66-action-copy b{font-size:10px;color:#2e3c38}.q66-action-copy span{font-size:9px;line-height:1.45;color:#6c7773}.q66-action-modal textarea{min-height:96px;resize:vertical}.q66-reason-help{display:block;margin-top:5px;font-size:8px;color:#7b8581}.q66-action-buttons{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}.q66-action-buttons .danger{background:#a64d45!important;border-color:#a64d45!important;color:#fff!important}
      .editor-more-menu [data-q66-amend]:disabled{opacity:.5;cursor:not-allowed!important}.q66-pdf-revision{margin-top:2mm;font-size:6pt;font-weight:900;letter-spacing:.08em;color:#536b64;text-transform:uppercase}.q66-pdf-history-state{margin:2.4mm 0 0;padding:1.4mm 2mm;border:1px solid #dfb9b0;background:#fff3ef;color:#8b493f;font-size:6.2pt;font-weight:900;letter-spacing:.09em;text-align:center;text-transform:uppercase}.q66-pdf-history-state.superseded{border-color:#d8cbc3;background:#faf7f4;color:#75665d}
      @media(max-width:760px){.q66-revision-banner{align-items:flex-start;flex-direction:column}.q66-revision-banner .btn{width:100%}.q66-lock-note{align-items:flex-start;flex-direction:column;gap:3px}.q66-action-buttons{flex-direction:column-reverse}.q66-action-buttons .btn{width:100%;min-height:44px}}
    `;document.head.appendChild(st);
  }
})();