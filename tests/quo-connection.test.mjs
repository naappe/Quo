import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
function setup(){
  let result={data:[],error:null},throwError=false;
  const el={dataset:{},textContent:''};
  const events={};
  const context=vm.createContext({console:{error(){}},localStorage:{getItem:()=>null},window:{supabase:{createClient:()=>({from:()=>({select(){return this},is(){return this},order(){return this},range(){return this},eq(){return this},maybeSingle(){return this},then(resolve,reject){return (throwError?Promise.reject(new Error('network down')):Promise.resolve(result)).then(resolve,reject)}})})},addEventListener:(name,fn)=>events[name]=fn},document:{getElementById:()=>el},setTimeout,clearTimeout});
  vm.runInContext(fs.readFileSync('quo-base.js','utf8'),context);
  vm.runInContext("render=function() {renderConnectionStatus()};toast=function(){};S.authUser={id:'fixture'};",context);
  const source=fs.readFileSync('quo-core-v41.js','utf8');
  vm.runInContext(source.slice(source.indexOf('  async function fetchAllActive'),source.indexOf('  /* New documents start')),context);
  return {el,events,run:code=>vm.runInContext(code,context),fail:()=>result={data:null,error:{message:'denied'}},networkFail:()=>throwError=true,recover:()=>{result={data:[],error:null};throwError=false}};
}

test('status is unknown before a successful query, then tracks errors and recovery',async()=>{
  const f=setup();
  f.run('renderConnectionStatus()');assert.equal(f.el.dataset.state,'unknown');
  await f.run('loadAll()');assert.equal(f.el.dataset.state,'ok');
  f.fail();await f.run('loadAll()');assert.equal(f.el.dataset.state,'error');
  assert.equal(f.run('S.loading'),false);
  f.networkFail();await f.run('loadAll()');assert.equal(f.el.dataset.state,'error');
  f.recover();await f.run('loadAll()');assert.equal(f.el.dataset.state,'ok');
  f.events.offline();assert.equal(f.el.dataset.state,'error');
  f.events.online();assert.equal(f.el.dataset.state,'unknown');
  await f.run('refreshDocs()');assert.equal(f.el.dataset.state,'ok');
});

test('failed refresh retains existing document data',async()=>{
  const f=setup();f.run("S.docs=[{id:'existing'}]");f.fail();
  const result=await f.run('refreshDocs()');
  assert.ok(result.error);assert.equal(f.run('S.docs[0].id'),'existing');
  assert.equal(f.el.dataset.state,'error');
});

test('signed-out load does not claim a verified connection',async()=>{
  const f=setup();await f.run('loadAll()');
  f.run('S.authUser=null');await f.run('loadAll()');
  assert.equal(f.el.dataset.state,'unknown');
});

test('an in-flight query cannot reconnect the indicator after logout',async()=>{
  const f=setup();
  f.run("sb.from=()=>({select(){return this},is(){return this},order(){return this},range(){return this},then(resolve){resolveLater=resolve}})");
  const pending=f.run('refreshDocs()');
  await new Promise(resolve=>setImmediate(resolve));
  f.run("S.authUser=null;setConnectionStatus('unknown');resolveLater({data:[{id:'stale'}],error:null})");
  await pending;
  assert.equal(f.el.dataset.state,'unknown');assert.equal(f.run('S.docs.length'),0);
});
