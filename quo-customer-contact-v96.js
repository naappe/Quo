/* Quo v97 - separate organisation, contact person, designation and section. */
(function(){
  function contactName(d){return String(d?.customer_contact_name||'').trim()}
  function contactRole(d){return String(d?.customer_contact_role||'').trim()}
  function contactSection(d){return String(d?.customer_contact_section||'').trim()}

  /* New and converted documents carry a document-level contact person. */
  try{
    const previousBlankDoc=blankDoc;
    blankDoc=function(type='quotation',copy=null){
      const d=previousBlankDoc.apply(this,arguments);
      if(d && d.customer_contact_name==null)d.customer_contact_name=copy?.customer_contact_name||'';
      if(d && d.customer_contact_role==null)d.customer_contact_role=copy?.customer_contact_role||'';
      if(d && d.customer_contact_section==null)d.customer_contact_section=copy?.customer_contact_section||'';
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
        const contact=`<div class="field"><label>Contact Person</label><input data-field="customer_contact_name" value="${esc(d.customer_contact_name||'')}" placeholder="Person requesting this document"></div>
        <div class="field"><label>Designation</label><input data-field="customer_contact_role" value="${esc(d.customer_contact_role||'')}" placeholder="Job title / designation"></div>
        <div class="field"><label>Section / Department</label><input data-field="customer_contact_section" value="${esc(d.customer_contact_section||'')}" placeholder="Section or department"></div>`;
        html=html.replace(phoneMarker,contact+phoneMarker);
      }
      return html;
    };
  }catch(e){console.warn('Quo contact-person editor patch failed',e)}

  /* Persist the contact person independently from the organisation. */
  try{
    const previousPayload=payload;
    payload=function(d){
      return {...previousPayload.apply(this,arguments),
        customer_contact_name:contactName(d)||null,
        customer_contact_role:contactRole(d)||null,
        customer_contact_section:contactSection(d)||null
      };
    };
  }catch(e){console.warn('Quo contact-person payload patch failed',e)}

  function addContactToPdf(root,d){
    if(!root||!d)return;
    root.querySelectorAll('.q26-main .q26-client-meta').forEach(meta=>{
      meta.querySelectorAll('.q96-contact-person').forEach(el=>el.remove());
      const existingRows=[...meta.querySelectorAll('.q26-contact-row')];
      const phoneRow=existingRows.find(row=>/^(contact|phone)$/i.test(String(row.querySelector('span')?.textContent||'').trim()));
      if(phoneRow?.querySelector('span'))phoneRow.querySelector('span').textContent='Phone';
      const rows=[
        ['Contact Person',contactName(d),'q96-contact-person'],
        ['Designation',contactRole(d),'q97-contact-role'],
        ['Section',contactSection(d),'q97-contact-section']
      ].filter(([,value])=>value);
      if(!rows.length)return;
      rows.reverse().forEach(([label,value,cls])=>{
        const row=document.createElement('div');
        row.className=`q26-contact-row ${cls}`;
        row.innerHTML=`<span>${esc(label)}</span><b>${esc(value)}</b>`;
        if(phoneRow)meta.insertBefore(row,phoneRow);else meta.prepend(row);
      });
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
  function syncContactField(e){
    const key=e.target?.dataset?.field;
    if(!['customer_contact_name','customer_contact_role','customer_contact_section'].includes(key))return;
    if(S.current)S.current[key]=e.target.value;
    setTimeout(()=>window.quoRefreshLivePreview?.(),0);
  }
  document.addEventListener('input',syncContactField,true);
  document.addEventListener('change',syncContactField,true);

  if(!document.getElementById('quoCustomerContactV96Style')){
    const st=document.createElement('style');
    st.id='quoCustomerContactV96Style';
    st.textContent=`
      .quo-v26 .q96-contact-person b,
      .quo-v26 .q97-contact-role b,
      .quo-v26 .q97-contact-section b{font-weight:700;color:#303b38}
    `;
    document.head.appendChild(st);
  }
})();
