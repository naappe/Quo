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

for(const [file,version] of [
  ['quo-pdf-pagination-v64.js','64'],
  ['quo-production-v64.js','64'],
  ['quo-final-audit-v65.js','65'],
  ['quo-amendments-v66.js','66'],
  ['quo-dashboard-graph-v67.js','67'],
  ['quo-supply-usage-v73.js','76']
]){
  if(!index.includes(`${file}?v=${version}`))fail(`${file} is not loaded at v${version}`);else ok(`${file} v${version} is loaded`);
}

for(const removed of ['quo-finance-v68.js','quo-finance-nav-v69.js','quo-finance-hardening-v70.js']){
  if(index.includes(removed))fail(`Removed finance module is still loaded: ${removed}`);else ok(`${removed} is not loaded`);
}
if(/credit[_ ]note|debit[_ ]note/i.test(index))fail('Credit/Debit Note UI remains in index.html');else ok('Credit/Debit Note navigation is absent');
if(index.includes('quo-customer-picker.js'))fail('Superseded customer picker is still loaded');else ok('Old customer picker is removed from runtime');

const preview=read('quo-preview-v44.js');
const oldLoop="if(modal&&!modal.classList.contains('hidden')&&fullPages().length)showFullPage(fullPageIndex)";
if(preview.includes(oldLoop))fail('Known full-preview MutationObserver loop is present');else ok('Known PDF preview mutation loop is absent');

const pagination=read('quo-pdf-pagination-v64.js');
if(!pagination.includes("QUO_PDF_PAGINATION_VERSION='64'"))fail('PDF pagination version marker missing');else ok('PDF pagination version marker present');

const production=read('quo-production-v64.js');
for(const token of ['quo_customers','quo_system_health','select(\'*\',{count:\'exact\'})','data-q64-page'])if(!production.includes(token))fail(`Production capability marker missing: ${token}`);
if(!process.exitCode)ok('Customer master, health checks and server-side document paging markers are present');

const finalAudit=read('quo-final-audit-v65.js');
if(!finalAudit.includes("QUO_FINAL_AUDIT_VERSION='65'"))fail('Final audit version marker missing');
if(!finalAudit.includes("if(label.textContent!==wanted)label.textContent=wanted"))fail('Preview relabel mutation guard missing');
if(!process.exitCode)ok('Final audit preview label guard is present');

const amendments=read('quo-amendments-v66.js');
for(const token of ["QUO_AMENDMENTS_VERSION='66'",'quo_amend_document','quo_void_document','Superseded - historical record','Issued document locked'])if(!amendments.includes(token))fail(`Amendment capability marker missing: ${token}`);
if(!amendments.includes("const previousDashboard=renderDashboard"))fail('Superseded dashboard exclusion wrapper is missing');
if(/Credit Note|Debit Note/i.test(amendments))fail('Removed Credit/Debit Note guidance remains in amendments');
if(!process.exitCode)ok('Revision and void controls remain without Credit/Debit Note guidance');

const graph=read('quo-dashboard-graph-v67.js');
for(const token of ["QUO_DASHBOARD_GRAPH_VERSION='67'",'Commercial Activity','quoted:0','invoiced:0','collected:0',"new Set(['Cancelled','Superseded'])"])if(!graph.includes(token))fail(`Dashboard graph capability marker missing: ${token}`);
if(graph.includes('MutationObserver'))fail('Dashboard graph must not add a MutationObserver');
if(!process.exitCode)ok('Six-month dashboard graph and inactive-document exclusions are present');

const supply=read('quo-supply-usage-v73.js');
for(const token of ['Quo v76','Final Invoice','Vendor','+ Add Line','quo_add_supply_usage_lines','quo_supply_usage_vendor_options','quo_supply_usage_document_options','quo_supply_usage_list','ADMIN ONLY'])if(!supply.includes(token))fail(`Supply Usage marker missing: ${token}`);
if(/credit[_ ]note|debit[_ ]note/i.test(supply))fail('Supply Usage contains unrelated Credit/Debit Note logic');
if(!supply.includes("timeZone:'Indian/Maldives'"))fail('Supply Usage Maldives date guard is missing');
if(!process.exitCode)ok('Supply Usage prefers Final Invoice, supports vendor lines and keeps Maldives dates');

const cleanup=read('supabase/migrations/20260823_quo_remove_credit_debit_cleanup_v74.sql');
for(const token of ["document_type in ('quotation','proforma','invoice','receipt')",'drop function if exists public.quo_create_adjustment_note','drop trigger if exists quo_adjustment_reconcile_invoice'])if(!cleanup.includes(token))fail(`v74 cleanup marker missing: ${token}`);
if(!process.exitCode)ok('Database cleanup removes Credit/Debit Note creation paths');

const supplyMigration=read('supabase/migrations/20260823_quo_supply_usage_vendor_lines_v75.sql');
for(const token of ['vendor_name','quo_supply_usage_vendor_options','quo_add_supply_usage_lines','A maximum of 50 supply lines'])if(!supplyMigration.includes(token))fail(`v75 Supply Usage database marker missing: ${token}`);
if(!process.exitCode)ok('Database Supply Usage supports vendor history and transactional multi-line saves');

const finalInvoiceMigration=read('supabase/migrations/20260823_quo_supply_usage_final_invoice_v76.sql');
for(const token of ['quo_supply_usage_document_options','Final Invoice','document_type=\'invoice\'','document_type=\'quotation\'','already has Final Invoice'])if(!finalInvoiceMigration.includes(token))fail(`v76 Final Invoice rule marker missing: ${token}`);
if(!process.exitCode)ok('Database enforces Final Invoice preference and quotation fallback');

if(process.exitCode)process.exit(process.exitCode);
console.log('Quo static production checks passed.');
