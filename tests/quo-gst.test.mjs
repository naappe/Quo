import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function setup(){
  const root={innerHTML:''};
  const fields=[];
  const context=vm.createContext({
    console,localStorage:{getItem:()=>null,setItem(){}},
    window:{supabase:{createClient:()=>({})},addEventListener(){}},
    document:{querySelector:()=>root,querySelectorAll:()=>fields,getElementById:()=>({})},
    setTimeout,clearTimeout,scrollTo(){},
  });
  for(const name of ['quo-domain.js','quo-base.js','quo-data.js','quo-editor.js'])vm.runInContext(fs.readFileSync(name,'utf8'),context);
  vm.runInContext("function parseMenu(){return []};function pdfTypeTitle(d){return CFG[d.document_type].label};",context);
  vm.runInContext(fs.readFileSync('quo-document-layout.js','utf8'),context);
  return {context,root,fields,run:code=>vm.runInContext(code,context)};
}

test('GST is a native editor field and survives payload serialization, reload and copy',()=>{
  const {run}=setup();
  run("S.current=blankDoc('quotation'); S.current.customer_name='Test organisation'; S.current.customer_gst_number=' 1155677GST501 '; ");
  assert.equal(run("(renderEditor().match(/data-field=\"customer_gst_number\"/g)||[]).length"),1);
  assert.equal(run("payload(S.current).customer_gst_number"),'1155677GST501');
  // Same JSON boundary used by document saves and reads; not a live database test.
  run("S.current=JSON.parse(JSON.stringify(payload(S.current)))");
  assert.equal(run("S.current.customer_gst_number"),'1155677GST501');
  assert.equal(run("blankDoc('invoice',S.current).customer_gst_number"),'1155677GST501');
  assert.equal(run("blankDoc('quotation').customer_gst_number"),'');
});

test('ordinary editor reader handles GST without a special event listener',()=>{
  const ctx=setup();
  ctx.context.testFields=[{dataset:{field:'customer_gst_number'},type:'text',value:'TIN-TEST'}];
  ctx.run("document.querySelectorAll=selector=>selector==='[data-field]'?testFields:[]; S.current=blankDoc('quotation');readEditor()");
  assert.equal(ctx.run('S.current.customer_gst_number'),'TIN-TEST');
});

test('canonical PDF identity renders escaped GST and omits blank GST',()=>{
  const {run,root}=setup();
  run("S.current=blankDoc('quotation');S.current.customer_gst_number='1155677GST501';renderPrint(S.current)");
  assert.match(root.innerHTML,/GST Number/);
  assert.match(root.innerHTML,/1155677GST501/);
  run("S.current.customer_gst_number='<script>bad()</script>';renderPrint(S.current)");
  assert.ok(root.innerHTML.includes('&lt;script&gt;bad()&lt;/script&gt;'));
  assert.ok(!root.innerHTML.includes('<script>'));
  run("S.current.customer_gst_number='  ';renderPrint(S.current)");
  assert.ok(!root.innerHTML.includes('GST Number'));
  assert.equal(run('payload(S.current).customer_gst_number'),null);
});

test('GST participates in preview change detection',()=>{
  const {run}=setup();
  const source=fs.readFileSync('quo-preview-v44.js','utf8');
  const start=source.indexOf('  function previewKey(d){');
  const end=source.indexOf('\n  function exactPreviewHTML',start);
  run(source.slice(start,end));
  run("S.current=blankDoc('quotation');before=previewKey(S.current);S.current.customer_gst_number='TIN-CHANGED'");
  assert.notEqual(run('previewKey(S.current)'),run('before'));
});
