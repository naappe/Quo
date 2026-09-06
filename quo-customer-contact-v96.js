/* Quo v96 - separate organisation from the per-document contact person. */
(function(){
  function contactName(d){return String(d?.customer_contact_name||'').trim()}

  /* New and converted documents carry a document-level contact person. */
  try{
    const previousBlankDoc=blankDoc;
    blankDoc=function(type='quotation',copy=null){
      const d=previousBlankDoc.apply(this,arguments);
      if(d && d.customer_contact_name==null)d.customer_contact_name=copy?.customer_contact_name||'';
      return d;
    };
  }catch(e){console.warn('Quo contact-person blank document patch failed',e)}

  /* Add Contact Person to the Customer card without changing the company master. */
  try{
    const previousRenderEditor=renderEditor;
    renderEditor=function(){
      let html=previousRenderEditor.apply(this,arguments);
      const d=S.current||{};
      html=html.replace(
        '<div class="field"><label>Customer / Organisation</label>',
        '<div class="field full"><label>Customer / Organisation</label>'
      );
      const phoneMarker='<div class="field"><label>Phone</label><input data-field="customer_phone"';
      if(html.includes(phoneMarker) && !html.includes('data-field="customer_contact_name"')){
        const contact=`<div class="field"><label>Contact Person</label><input data-field="customer_contact_name" value="${esc(d.customer_contact_name||'')}" placeholder="Person requesting this document"></div>`;
        html=html.replace(phoneMarker,contact+phoneMarker);
      }
      return html;
    };
  }catch(e){console.warn('Quo contact-person editor patch failed',e)}

  /* Persist the contact person independently from the organisation. */
  try{
    const previousPayload=payload;
    payload=function(d){
      return {...previousPayload.apply(this,arguments),customer_contact_name:contactName(d)||null};
    };
  }catch(e){console.warn('Quo contact-person payload patch failed',e)}

  function addContactToPdf(root,d){
    if(!root||!d)return;
    root.querySelectorAll('.q26-main .q26-client-meta').forEach(meta=>{
      meta.querySelectorAll('.q96-contact-person').forEach(el=>el.remove());
      const existingRows=[...meta.querySelectorAll('.q26-contact-row')];
      const phoneRow=existingRows.find(row=>/^(contact|phone)$/i.test(String(row.querySelector('span')?.textContent||'').trim()));
      if(phoneRow?.querySelector('span'))phoneRow.querySelector('span').textContent='Phone';
      const name=contactName(d);
      if(!name)return;
      const row=document.createElement('div');
      row.className='q26-contact-row q96-contact-person';
      row.innerHTML=`<span>Contact Person</span><b>${esc(name)}</b>`;
      if(phoneRow)meta.insertBefore(row,phoneRow);else meta.prepend(row);
    });
  }

  /* PDF and live preview show company first, then requester, phone and address. */
  try{
    const previousRenderPrint=renderPrint;
    renderPrint=function(d){
      const result=previousRenderPrint.apply(this,arguments);
      addContactToPdf(document.getElementById('printRoot'),d);
      return result;
    };
  }catch(e){console.warn('Quo contact-person PDF patch failed',e)}

  /* Receipts created from an invoice retain the original contact person. */
  try{
    const previousReceiptFromCurrent=receiptFromCurrent;
    receiptFromCurrent=function(){
      const sourceContact=contactName(S.current);
      const result=previousReceiptFromCurrent.apply(this,arguments);
      if(sourceContact && S.current?.document_type==='receipt' && !contactName(S.current)){
        S.current.customer_contact_name=sourceContact;
      }
      return result;
    };
  }catch(e){}

  /* The preview key in older code does not know this field, so force-refresh it. */
  document.addEventListener('input',e=>{
    if(e.target?.matches?.('[data-field="customer_contact_name"]')){
      if(S.current)S.current.customer_contact_name=e.target.value;
      setTimeout(()=>window.quoRefreshLivePreview?.(),0);
    }
  },true);
  document.addEventListener('change',e=>{
    if(e.target?.matches?.('[data-field="customer_contact_name"]')){
      if(S.current)S.current.customer_contact_name=e.target.value;
      setTimeout(()=>window.quoRefreshLivePreview?.(),0);
    }
  },true);

  if(!document.getElementById('quoCustomerContactV96Style')){
    const st=document.createElement('style');
    st.id='quoCustomerContactV96Style';
    st.textContent=`
      .quo-v26 .q96-contact-person b{font-weight:700;color:#303b38}
    `;
    document.head.appendChild(st);
  }
})();
