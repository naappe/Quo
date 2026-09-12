import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('approved v110 theme is active before first paint',()=>{
  assert.match(index,/<html[^>]*class="[^"]*quo-v110[^"]*"/i,'html must carry quo-v110 before runtime scripts execute');
  const css=index.indexOf('quo-mockup-v110.css?v=112');
  const headEnd=index.indexOf('</head>');
  const authScript=index.indexOf('quo-auth-v46.js');
  assert.ok(css>=0,'v110 stylesheet must be linked directly in index.html');
  assert.ok(css<headEnd,'v110 stylesheet must load inside <head>');
  assert.ok(css<authScript,'v110 stylesheet must load before the auth script can create the login card');
});
