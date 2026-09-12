import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const index=fs.readFileSync('index.html','utf8');

test('mobile editor polish assets are loaded in the correct order',()=>{
  assert.match(index,/quo-editor-mobile-v109\.css\?v=109/);
  assert.match(index,/quo-editor-mobile-v109\.js\?v=109/);
  const dataAt=index.indexOf('quo-data.js');
  const mobileAt=index.indexOf('quo-editor-mobile-v109.js');
  const editorAt=index.indexOf('quo-editor.js');
  assert.ok(dataAt>=0 && mobileAt>dataAt && editorAt>mobileAt,'mobile item markup must override quo-data.js before quo-editor.js renders');
});

test('mobile item rows expose field labels without changing item data attributes',()=>{
  const source=fs.readFileSync('quo-editor-mobile-v109.js','utf8');
  for(const token of [
    'data-mobile-label="Description"',
    'data-mobile-label="Qty"',
    'data-mobile-label="Unit"',
    'data-mobile-label="Rate"',
    'data-mobile-label="Amount"',
    'data-item-field="description"',
    'data-item-field="qty"',
    'data-item-field="unit"',
    'data-item-field="price"',
    'data-remove-item'
  ]) assert.ok(source.includes(token),`missing mobile item marker: ${token}`);
});

test('mobile editor keeps primary actions reachable and uses touch-sized controls',()=>{
  const css=fs.readFileSync('quo-editor-mobile-v109.css','utf8');
  assert.match(css,/@media\s*\(max-width:820px\)/);
  assert.match(css,/\.editor-actions\s*\{[^}]*position:sticky[^}]*bottom:/s);
  assert.match(css,/\.editor-actions\s+\.btn[^}]*min-height:44px/s);
  assert.match(css,/\.item-row\s*\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/s);
  assert.match(css,/\.item-cell\.description[^}]*grid-column:1\/-1/s);
  assert.match(css,/\.preview-card[^}]*position:relative/s);
});
