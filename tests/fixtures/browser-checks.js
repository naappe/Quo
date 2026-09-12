// Runs only through quo-test-server.mjs. CSP blocks all outbound connections.
localStorage.setItem('quo_auth_session_v1',JSON.stringify({access_token:'fixture',refresh_token:'fixture'}));
window.html2canvas=async element=>{
  window.fixtureExportPages??=[];
  fixtureExportPages.push(element.innerHTML);
  return {toDataURL:()=>"data:image/jpeg;base64,AA=="};
};
window.jspdf={jsPDF:class{addPage(){} addImage(){} setProperties(){} save(name){window.fixturePdfName=name}}};
const fixtureErrors=[];
window.addEventListener('error',e=>fixtureErrors.push(e.message));
window.addEventListener('unhandledrejection',e=>fixtureErrors.push(String(e.reason)));
window.addEventListener('load',()=>{
  const output=document.createElement('pre');output.id='fixture-results';
  output.style='position:fixed;bottom:0;left:0;max-height:35vh;overflow:auto;background:white;border:2px solid #285f58;color:black;padding:12px;z-index:2147483647;font:14px monospace;max-width:95vw;white-space:pre-wrap';
  output.textContent='Running isolated checks…';document.body.append(output);
  const ok=(condition,message)=>{if(!condition)throw new Error(message)};
  const equal=(a,b,message)=>ok(JSON.stringify(a)===JSON.stringify(b),message);
  const waitFor=async fn=>{for(let n=0;n<100;n++){if(fn())return;await new Promise(r=>setTimeout(r,100))}throw new Error('Timed out waiting for fixture state')};
  const input=(selector,value)=>{const el=document.querySelector(selector);ok(el,'Missing input: '+selector);el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}))};
  (async()=>{
    await waitFor(()=>typeof S!=='undefined'&&S.authUser&&!S.loading);
    const stage=sessionStorage.getItem('fixture-stage');
    if(stage!=='reload'){
      const d=blankDoc('quotation');
      Object.assign(d,{creation_date:'2026-09-12',customer_name:'Fixture Catering',customer_contact_name:'Test Contact',customer_phone:'7000000',items:[{description:'Buffet dinner',qty:15,unit:'Pax',price:130}]});
      openEditor(d);
      equal(document.querySelectorAll('[data-field="customer_gst_number"]').length,1,'Exactly one GST input');
      input('[data-field="customer_gst_number"]','1155677GST501');
      await waitFor(()=>document.querySelector('.preview-pages')?.textContent.includes('1155677GST501'));
      equal(payload(S.current).customer_gst_number,'1155677GST501','GST payload');
      ok(await saveCurrent(false),'Save document');
      const saved=fixtureDB.docs.find(d=>d.id===S.current.id);
      equal(saved.customer_gst_number,'1155677GST501','GST persisted in fixture DB');
      sessionStorage.setItem('fixture-doc-id',saved.id);
      sessionStorage.setItem('fixture-stage','reload');location.reload();return;
    }
    const id=sessionStorage.getItem('fixture-doc-id');
    openEditor(S.docs.find(d=>d.id===id));
    equal(document.querySelector('[data-field="customer_gst_number"]').value,'1155677GST501','GST reloaded');
    equal(blankDoc('invoice',S.current).customer_gst_number,'1155677GST501','GST conversion copy');
    renderPrint(S.current);
    ok(document.querySelector('#printRoot .q26-client-meta').textContent.includes('1155677GST501'),'PDF contains GST');
    S.current.items=Array.from({length:24},(_,i)=>({description:`Service ${i+1}`,qty:1,unit:'Pax',price:130}));render();
    renderPrint(S.current);
    const expected=[...document.querySelectorAll('#printRoot .pdf-page')].map(p=>p.innerHTML);
    ok(expected.length>1,'Long document paginates');
    const preview=document.createElement('div');preview.innerHTML=miniPreview(S.current);
    equal([...preview.querySelectorAll('.pdf-page')].map(p=>p.innerHTML),expected,'Live preview matches print pages');
    window.fixtureExportPages=[];await exportPDF();
    equal(fixtureExportPages,expected,'Export receives same pages');
    ok(fixturePdfName?.endsWith('.pdf'),'PDF filename');
    input('[data-field="customer_gst_number"]','<script>bad()</script>');renderPrint(S.current);
    equal(document.querySelectorAll('#printRoot script').length,0,'GST HTML escaped');
    input('[data-field="customer_gst_number"]','');renderPrint(S.current);
    ok(!document.querySelector('#printRoot').textContent.includes('GST Number'),'Empty GST omitted');
    if(typeof setConnectionStatus==='function'){
      await loadAll();equal(document.querySelector('#db-status').dataset.state,'ok','Successful query connected');
      fixtureDB.fail=true;await loadAll();equal(document.querySelector('#db-status').dataset.state,'error','Returned query error shown');
      fixtureDB.fail=false;fixtureDB.reject=true;await loadAll();equal(document.querySelector('#db-status').dataset.state,'error','Network exception shown');
      fixtureDB.reject=false;await loadAll();equal(document.querySelector('#db-status').dataset.state,'ok','Connection recovers');
      window.dispatchEvent(new Event('offline'));equal(document.querySelector('#db-status').dataset.state,'error','Offline state');
      window.dispatchEvent(new Event('online'));equal(document.querySelector('#db-status').dataset.state,'unknown','Online is not proof of database access');
      await loadAll();
    }
    equal(fixtureErrors,[],'No uncaught browser errors: '+fixtureErrors.join(', '));
    sessionStorage.removeItem('fixture-stage');
    output.dataset.result='pass';output.textContent='PASS — GST edit/save/reload/copy/escape/clear; multi-page preview/export DOM parity; connection success/error/recovery (when present); no uncaught errors. PDF libraries are test doubles, not raster/PDF validation.';
  })().catch(e=>{sessionStorage.removeItem('fixture-stage');output.dataset.result='fail';output.textContent='FAIL — '+e.stack;console.error(e)});
});
