import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=file=>fs.readFileSync(file,'utf8');

test('saved session is restored before the password form is shown',()=>{
  const auth=read('quo-auth-v46.js');
  assert.doesNotMatch(auth,/ensureGate\(\);showLogin\(\);await restoreLogin\(\)/);
  assert.match(auth,/storedSession\(\)/);
  assert.match(auth,/showRestoring/);
});

test('documents are not loaded before authentication restores',()=>{
  const ui=read('quo-ui.js');
  assert.doesNotMatch(ui,/globalEvents\(\);loadAll\(\);?\s*$/);
  assert.match(ui,/globalEvents\(\);?\s*$/);
});
