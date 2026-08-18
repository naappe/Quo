import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const root=process.cwd();
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const fail=message=>{console.error(`FAIL: ${message}`);process.exitCode=1;};
const ok=message=>console.log(`OK: ${message}`);

const index=read('index.html');
const localScripts=[...index.matchAll(/<script src="\.\/(.+?\.js)(?:\?[^\"]*)?"><\/script>/g)].map(m=>m[1]);

for(const file of localScripts){
  if(!fs.existsSync(path.join(root,file))){fail(`Missing script referenced by index.html: ${file}`);continue;}
  const check=spawnSync(process.execPath,['--check',file],{cwd:root,encoding:'utf8'});
  if(check.status!==0)fail(`JavaScript syntax error in ${file}: ${check.stderr||check.stdout}`);
}
if(!process.exitCode)ok(`${localScripts.length} referenced JavaScript files parse successfully`);

if(!index.includes('quo-pdf-pagination-v64.js?v=64'))fail('v64 PDF pagination module is not loaded');else ok('v64 PDF pagination is loaded');
if(!index.includes('quo-production-v64.js?v=64'))fail('v64 production module is not loaded');else ok('v64 production module is loaded');
if(index.includes('quo-customer-picker.js'))fail('Superseded customer picker is still loaded');else ok('Old customer picker is removed from runtime');

const preview=read('quo-preview-v44.js');
const oldLoop="if(modal&&!modal.classList.contains('hidden')&&fullPages().length)showFullPage(fullPageIndex)";
if(preview.includes(oldLoop))fail('Known full-preview MutationObserver loop is present');else ok('Known PDF preview mutation loop is absent');

const pagination=read('quo-pdf-pagination-v64.js');
if(!pagination.includes("QUO_PDF_PAGINATION_VERSION='64'"))fail('PDF pagination version marker missing');else ok('PDF pagination version marker present');

const production=read('quo-production-v64.js');
for(const token of ['quo_customers','quo_system_health','select(\'*\',{count:\'exact\'})','data-q64-page']){
  if(!production.includes(token))fail(`Production capability marker missing: ${token}`);
}
if(!process.exitCode)ok('Customer master, health checks and server-side document paging markers are present');

if(process.exitCode)process.exit(process.exitCode);
console.log('Quo static production checks passed.');
