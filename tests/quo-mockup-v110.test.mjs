import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=file=>fs.readFileSync(file,'utf8');

test('supplied mockup owns final Quo renderer',()=>{
  const index=read('index.html');
  assert.doesNotMatch(index,/quo-dashboard-v83\.js/);
  assert.doesNotMatch(index,/quo-professional-v108\.js/);
  assert.match(index,/quo-mockup-v110\.js\?v=110/);
});

test('sidebar identity is saffron Q, not runtime logo injection',()=>{
  const runtime=read('quo-runtime.js');
  assert.doesNotMatch(runtime,/quoApplySidebarLogo/);
  assert.doesNotMatch(runtime,/\.side-brand \.mark img/);
});

test('v110 matches supplied mockup shell and views',()=>{
  const js=read('quo-mockup-v110.js');
  const css=read('quo-mockup-v110.css');
  for(const token of ['Dashboard','Documents','Quotations','Payment Requests','Invoices','Customers','Payments']) assert.match(js,new RegExp(token));
  for(const token of ['--sidebar-w:240px','--accent:#f59e0b','--accent-soft:#fef3c7','--bg:#fafaf9','@media (max-width: 768px)']) assert.ok(css.includes(token),`missing ${token}`);
  assert.match(css,/\.quo-login-card[\s\S]*var\(--surface\)/);
  assert.match(css,/#quoLoginButton[\s\S]*var\(--accent\)/);
});
