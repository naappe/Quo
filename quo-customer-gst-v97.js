/* Quo v97 - customer GST/TIN number on commercial documents. */
(function(){
  function gstNumber(d){return String(d?.customer_gst_number||'').trim()}

  /* New and copied documents carry the customer GST/TIN number. */
  try{
    const previousBlankDoc=blankDoc;
    blankDoc=function(type='quotation',copy=null){
      const d=previousBlankDoc.apply(this,arguments);
      if(d && d.customer_gst_number==null)d.customer_gst_number=copy?.customer_gst_number||'';
      return d;
    };
  }catch(e){console.warn('Quo customer GST blank document patch failed',e)}

  /* Add a dedicated GST Number field to the Customer card. */
  try{
    const previousRenderEditor=renderEditor;
    renderEditor=function(){
      let html=previousRenderEditor.apply(this,arguments);
      const d=S.current||{};
      const phoneMarker='<div class="field"><label>Phone</label><input data-field="customer_phone"';
      if(html.includes(phoneMarker) && !html.includes('data-field="customer_gst_number"')){
        const gst=`<div class="field"><label>Customer GST Number</label><input data-field="customer_gst_number" value="${esc(d.customer_gst_number||'')}" placeholder="e.g. 1155677GST501" autocomplete="off"></div>`;
        html=html.replace(phoneMarker,gst+phoneMarker);
      }
      return html;
    };
  }catch(e){console.warn('Quo customer GST editor patch failed',e)}

  /* Persist independently from the seller GST calculation settings. */
  try{
    const previousPayload=payload;
    payload=function(d){
      return {...previousPayload.apply(this,arguments),customer_gst_number:gstNumber(d)||null};
    };
  }catch(e){console.warn('Quo customer GST payload patch failed',e)}

  function addGstToPdf(root,d){
    if(!root||!d)return;
    root.querySelectorAll('.q26-main .q26-client-meta').forEach(meta=>{
      meta.querySelectorAll('.q97-customer-gst').forEach(el=>el.remove());
      const number=gstNumber(d);
      if(!number)return;
      const rows=[...meta.querySelectorAll('.q26-contact-row')];
      const phoneRow=rows.find(row=>/^(phone|contact)$/i.test(String(row.querySelector('span')?.textContent||'').trim()));
      const row=document.createElement('div');
      row.className='q26-contact-row q97-customer-gst';
      row.innerHTML=`<span>GST Number</span><b>${esc(number)}</b>`;
      if(phoneRow)meta.insertBefore(row,phoneRow);else meta.appendChild(row);
    });
  }

  /* PDF and live preview show the customer's GST/TIN number. */
  try{
    const previousRenderPrint=renderPrint;
    renderPrint=function(d){
      const result=previousRenderPrint.apply(this,arguments);
      addGstToPdf(document.getElementById('printRoot'),d);
      return result;
    };
  }catch(e){console.warn('Quo customer GST PDF patch failed',e)}

  function syncInput(e){
    if(!e.target?.matches?.('[data-field="customer_gst_number"]'))return;
    if(S.current)S.current.customer_gst_number=e.target.value;
    try{S.editorDirty=true;updateEditorSaveState?.()}catch(err){}
    setTimeout(()=>window.quoRefreshLivePreview?.(),0);
  }
  document.addEventListener('input',syncInput,true);
  document.addEventListener('change',syncInput,true);

  if(!document.getElementById('quoCustomerGstV97Style')){
    const st=document.createElement('style');
    st.id='quoCustomerGstV97Style';
    st.textContent=`.quo-v26 .q97-customer-gst b{font-weight:700;color:#303b38}`;
    document.head.appendChild(st);
  }
})();
