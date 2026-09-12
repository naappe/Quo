import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=file=>fs.readFileSync(file,'utf8');

test('supplied mockup owns final Quo renderer',()=>{
  const index=read('index.html');
  assert.doesNotMatch(index,/quo-dashboard-v83\.js/);
  assert.doesNotMatch(index,/quo-professional-v108\.js/);
  assert.match(index,/quo-mockup-v110\.js\?v=111/);
  assert.ok(index.lastIndexOf('quo-mockup-v110.js')>index.lastIndexOf('quo-theme-v107.js'),'final renderer must load after legacy UI modules');
});

test('final renderer restores saffron Q after legacy runtime binds',()=>{
  const js=read('quo-mockup-v110.js');
  const css=read('quo-mockup-v110.css');
  assert.match(js,/function syncBrand\(\)/);
  assert.match(js,/mark\.textContent='Q'/);
  assert.match(js,/const previousBind=bindDynamic/);
  assert.match(css,/\.side-brand \.mark img\{display:none!important\}/);
});

test('v110 matches supplied mockup shell and views',()=>{
  const js=read('quo-mockup-v110.js');
  const css=read('quo-mockup-v110.css');
  for(const token of ['Dashboard','Documents','Quotations','Payment Requests','Invoices','Customers','Payments']) assert.match(js,new RegExp(token));
  for(const token of ['--sidebar-w:240px','--accent:#f59e0b','--accent-soft:#fef3c7','--bg:#fafaf9','@media (max-width: 768px)']) assert.ok(css.includes(token),`missing ${token}`);
  assert.match(css,/\.quo-login-card[\s\S]*var\(--surface\)/);
  assert.match(css,/#quoLoginButton[\s\S]*var\(--accent\)/);
});

test('final renderer reasserts Payments after legacy render wrappers finish',()=>{
  const js=read('quo-mockup-v110.js');
  assert.match(js,/function syncCurrentViewLabels\(\)/);
  assert.match(js,/S\.view==='documents'&&S\.filter==='receipt'/);
  assert.match(js,/title\.textContent='Payments'/);
  assert.match(js,/const previousRender=render/);
  assert.match(js,/render=function\(\)\{[\s\S]*previousRender\.apply\(this,arguments\)[\s\S]*syncFinalShell\(\)/);
});