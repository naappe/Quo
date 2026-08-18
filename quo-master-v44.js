/* Quo v58 - canonical editor master and navigation guard. */
(function(){
  const VERSION='58';
  const PREPARER='White Saffron';
  const ORDER=['document','customer','items','event / service','menu','notes & terms'];

  window.QUO_MASTER_VERSION=VERSION;
  if(typeof S!=='undefined')S.preparedBy=PREPARER;
  try{localStorage.setItem('quo_prepared_by',PREPARER)}catch(e){}
  try{prepared=function(){if(typeof S!=='undefined')S.preparedBy=PREPARER;return PREPARER}}catch(e){}

  try{
    const originalParseMenu=parseMenu;
    parseMenu=function(text){
      const raw=String(text||'').trim();
      if(!raw)return [];
      const parsed=originalParseMenu(raw);
      if(parsed.length&&parsed.some(day=>Array.isArray(day.meals)&&day.meals.length))return parsed;
      const lines=raw.split(/\r?\n/).map(v=>v.trim()).filter(Boolean);
      return [{label:'Day 1',meals:lines.map((line,i)=>{
        const colon=line.indexOf(':');
        return colon>0
          ? {name:line.slice(0,colon).trim(),time:'',items:line.slice(colon+1).trim()||'-'}
          : {name:`Item ${i+1}`,time:'',items:line};
      })}];
    };
  }catch(e){}

  function titleOf(card){return String(card?.querySelector('header h3')?.textContent||'').trim().toLowerCase()}
  function dealKey(d){return d?.deal_id||d?.id||null}
  function linkedDoc(d,type){
    const key=dealKey(d);
    return (S.docs||[]).find(x=>x.document_type===type&&!x.deleted_at&&x.status!=='Cancelled'&&(x.source_document_id===d.id||(key&&x.deal_id===key)));
  }

  function suggestedTerms(type){
    if(type==='quotation'){
      const saved=String(S.settings?.quotation_terms||'').trim();
      if(saved)return saved;
      return 'This quotation is valid until the date shown above. Final menu, guest count, venue and service details must be confirmed before service. Changes after confirmation may affect pricing or availability. Only the items and services listed in this quotation are included.';
    }
    if(type==='proforma'){
      return 'This proforma invoice is a payment request and does not confirm that payment has been received. Please use the document number as the payment reference. Final service details remain subject to the agreed quotation or order.';
    }
    if(type==='invoice'){
      const saved=String(S.settings?.invoice_terms||'').trim();
      if(saved)return saved;
      return 'Please use the invoice number as the payment reference. Any discrepancy should be reported promptly. Payment status reflects payments recorded against this invoice. A receipt is issued for each recorded payment.';
    }
    return '';
  }

  function configureTermsCard(host){
    const main=host.querySelector('.editor-main');if(!main)return;
    const card=[...main.children].find(el=>el.classList?.contains('editor-card')&&titleOf(el)==='notes & terms');
    if(!card)return;

    if(S.current?.document_type==='receipt'){
      card.remove();
      return;
    }

    const hasTerms=!!String(S.current?.extra_terms||'').trim();
    const header=card.querySelector('header');
    const body=card.querySelector('.card-body');
    card.classList.add('quo-terms-card');
    card.classList.toggle('quo-terms-empty',!hasTerms);
    card.classList.remove('collapsed');

    const title=header?.querySelector('h3');
    if(title)title.textContent='Notes & Terms';
    header?.querySelectorAll('.section-toggle,[data-section-toggle],.quo-terms-action').forEach(el=>el.remove());
    if(header){
      const b=document.createElement('button');
      b.type='button';b.className='quo-terms-action';
      if(hasTerms){b.dataset.quoTermsRemove='';b.textContent='Remove'}
      else{b.dataset.quoTermsAdd='';b.textContent='Add Terms'}
      header.appendChild(b);
    }
    if(body){
      body.hidden=!hasTerms;
      const ta=body.querySelector('[data-field="extra_terms"]');
      if(ta)ta.placeholder='Notes or terms';
    }
  }

  function configureWorkflowActions(host){
    const actions=host.querySelector('.editor-actions');
    if(!actions)return;
    actions.querySelectorAll('[data-create-receipt]').forEach(el=>el.remove());

    const more=actions.querySelector('.editor-more');
    const menu=more?.querySelector('.editor-more-menu');
    const d=S.current;

    if(d.document_type==='receipt')menu?.querySelector('[data-duplicate]')?.remove();

    if(d.document_type==='quotation'){
      menu?.querySelector('[data-convert="invoice"]')?.remove();
      const piButton=menu?.querySelector('[data-convert="proforma"]');
      if(piButton&&linkedDoc(d,'proforma'))piButton.textContent='Open Proforma Invoice';
    }
    if(d.document_type==='proforma'){
      const invButton=menu?.querySelector('[data-convert="invoice"]');
      if(invButton&&linkedDoc(d,'invoice'))invButton.textContent='Open Invoice';
    }

    let preview=actions.querySelector('[data-full-preview]');
    if(!preview){
      preview=document.createElement('button');preview.type='button';preview.className='btn';preview.dataset.fullPreview='';preview.textContent='Preview PDF';
      actions.querySelector('[data-save]')?.insertAdjacentElement('afterend',preview);
    }else preview.textContent='Preview PDF';

    const pdfButtons=[...actions.querySelectorAll('[data-pdf]')];
    let pdf=pdfButtons.find(el=>!menu?.contains(el))||pdfButtons[0];
    pdfButtons.filter(el=>el!==pdf).forEach(el=>el.remove());
    if(pdf&&menu&&!menu.contains(pdf))menu.prepend(pdf);
    if(pdf){pdf.textContent='Download PDF';pdf.classList.add('btn')}

    if(d.id&&menu&&!menu.querySelector('[data-delete-doc]')){
      const del=document.createElement('button');
      del.type='button';del.className='btn danger';del.dataset.deleteDoc=d.id;del.textContent='Delete';
      menu.appendChild(del);
    }
  }

  function masterEditorHTML(html){
    if(typeof html!=='string'||typeof S==='undefined'||!S.current)return html;
    const host=document.createElement('div');host.innerHTML=html;

    host.querySelectorAll('.quote-stage-bar,.fill-guide,.section-warning,.runtime-number-hint').forEach(el=>el.remove());

    const back=host.querySelector('[data-back]');
    if(back){
      back.type='button';back.textContent='← Back';back.setAttribute('aria-label','Back to documents');back.setAttribute('title','Back to documents');
    }

    const main=host.querySelector('.editor-main');
    if(main){
      const cards=[...main.children].filter(el=>el.classList?.contains('editor-card'));
      cards.filter(card=>titleOf(card)==='payment').forEach(card=>card.remove());
      const live=[...main.children].filter(el=>el.classList?.contains('editor-card'));
      live.forEach(card=>{
        card.classList.remove('collapsed');
        card.querySelectorAll('.section-toggle,[data-section-toggle]').forEach(el=>el.remove());
      });
      const map=new Map(live.map(card=>[titleOf(card),card]));
      ORDER.forEach(name=>{const card=map.get(name);if(card)main.appendChild(card)});
      live.filter(card=>!ORDER.includes(titleOf(card))).forEach(card=>main.appendChild(card));
      main.classList.add('quo-master-editor');
    }

    configureTermsCard(host);
    configureWorkflowActions(host);

    if(!S.current.id&&/AUTO ON SAVE/i.test(String(S.current.document_number||''))){
      host.querySelectorAll('.doc-number-pill,.mini-doc span').forEach(el=>el.textContent='Auto number on save');
    }
    return host.innerHTML;
  }

  try{
    const previousRenderEditor=renderEditor;
    renderEditor=function(){return masterEditorHTML(previousRenderEditor.apply(this,arguments))};
  }catch(e){}

  /* A duplicate is a new independent commercial record, never part of the old deal. */
  try{
    duplicateCurrent=function(){
      if(!S.current)return;
      if(S.current.document_type==='receipt')return alert('Receipts are created only from recorded Invoice payments.');
      readEditor?.();
      const copy=blankDoc(S.current.document_type,S.current);
      copy.source_document_id=null;
      copy.deal_id=null;
      copy.status='Draft';
      copy.paid_amount=0;
      copy.payment_reference='';
      copy.payment_status=copy.document_type==='invoice'?'Unpaid':'Not Applicable';
      S.editorDirty=false;
      openEditor(copy);
    };
  }catch(e){}

  function cleanChrome(){
    document.querySelector('.prepared-by')?.remove();
    document.querySelectorAll('.quote-stage-bar,.fill-guide,.section-warning,.runtime-number-hint').forEach(el=>el.remove());
  }

  function bindBackButton(){
    const back=document.querySelector('[data-back]');
    if(!back)return;
    back.onclick=function(e){
      e.preventDefault();e.stopPropagation();
      if(typeof goDocuments==='function')goDocuments(S.current?.document_type||'all');
    };
  }

  try{
    const previousBind=bindDynamic;
    bindDynamic=function(){
      cleanChrome();
      const result=previousBind.apply(this,arguments);
      bindBackButton();
      cleanChrome();
      return result;
    };
  }catch(e){}

  function leavingEditorTarget(target){
    return target?.closest?.('[data-back],[data-view],[data-go-docs],[data-workflow-open],[data-open],[data-create]');
  }
  document.addEventListener('click',e=>{
    if(S?.view!=='editor'||!S?.editorDirty)return;
    const nav=leavingEditorTarget(e.target);if(!nav)return;
    if(confirm('You have unsaved changes. Leave without saving?'))return;
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
  },true);
  window.addEventListener('beforeunload',e=>{
    if(S?.view==='editor'&&S?.editorDirty){e.preventDefault();e.returnValue='';}
  });

  if(!document.getElementById('quoMasterV58Style')){
    const st=document.createElement('style');st.id='quoMasterV58Style';st.textContent=`
      .editor-top .back-btn{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-height:34px!important;margin-top:1px!important;padding:7px 10px!important;border:1px solid #dce3e0!important;border-radius:8px!important;background:#fff!important;color:#40504b!important;font-size:10px!important;font-weight:750!important;cursor:pointer!important;pointer-events:auto!important;position:relative!important;z-index:40!important}
      .editor-top .back-btn:hover{background:#f4f7f6!important;border-color:#bccbc6!important;color:#1f342e!important}
      .editor-top .back-btn:focus-visible{outline:2px solid #7fa79f!important;outline-offset:2px!important}
      .editor-actions:has(.editor-more[open]){padding-bottom:0!important}
      .editor-more[open] .editor-more-menu{display:block!important;position:absolute!important;top:43px!important;right:0!important;left:auto!important;width:220px!important;min-width:220px!important;padding:6px!important;background:#fff!important;border:1px solid #dce2df!important;border-radius:9px!important;box-shadow:0 14px 36px rgba(25,39,36,.14)!important;z-index:1000!important}
      .editor-more[open] .editor-more-menu .btn{display:block!important;width:100%!important;min-height:34px!important;margin:0!important;padding:8px 10px!important;border:0!important;background:#fff!important;text-align:left!important}
      .editor-more[open] .editor-more-menu .btn:hover{background:#f5f7f6!important}
      .editor-more[open] .editor-more-menu .btn.danger{color:#9c4545!important}
      .editor-more[open] .editor-more-menu .btn.danger:hover{background:#fff3f2!important}
      .quote-stage-bar,.prepared-by,.fill-guide,.section-warning,.runtime-number-hint,.section-toggle,[data-section-toggle],.section-no{display:none!important}
      .quo-terms-card header{align-items:center!important}.quo-terms-action{margin-left:auto;border:0;background:transparent;color:#2d6d64;font-size:9px;font-weight:850;cursor:pointer;padding:5px 7px;border-radius:6px}.quo-terms-action:hover{background:#edf6f3}.quo-terms-empty{min-height:0!important}.quo-terms-empty .card-body{display:none!important}
      @media(max-width:820px){.editor-more[open] .editor-more-menu{left:0!important;right:auto!important;width:min(240px,calc(100vw - 32px))!important;min-width:0!important}}
    `;document.head.appendChild(st);
  }

  document.addEventListener('click',e=>{
    const add=e.target.closest('[data-quo-terms-add]');
    if(add&&S.current){
      e.preventDefault();e.stopPropagation();
      S.current.extra_terms=suggestedTerms(S.current.document_type);
      S.editorDirty=true;render();
      setTimeout(()=>document.querySelector('[data-field="extra_terms"]')?.focus(),0);
      return;
    }
    const remove=e.target.closest('[data-quo-terms-remove]');
    if(remove&&S.current){
      e.preventDefault();e.stopPropagation();
      if(!confirm('Remove Notes & Terms from this document and its PDF?'))return;
      S.current.extra_terms='';S.editorDirty=true;render();
      return;
    }
    const open=document.querySelector('.editor-more[open]');
    if(open&&!open.contains(e.target))open.removeAttribute('open');
  });

  cleanChrome();
  if(typeof S!=='undefined'&&S.current&&S.view==='editor'&&typeof render==='function')render();
})();