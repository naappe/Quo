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
if(!index.includes('quo-final-audit-v65.js?v=65'))fail('v65 final audit module is not loaded');else ok('v65 final audit module is loaded');
if(!index.includes('quo-amendments-v66.js?v=66'))fail('v66 amendment module is not loaded');else ok('v66 amendment module is loaded');
if(!index.includes('quo-dashboard-graph-v67.js?v=67'))fail('v67 dashboard graph module is not loaded');else ok('v67 dashboard graph is loaded');
if(!index.includes('quo-finance-v68.js?v=68'))fail('v68 finance controls module is not loaded');else ok('v68 finance controls are loaded');
if(!index.includes('quo-finance-nav-v69.js?v=69'))fail('v69 finance navigation module is not loaded');else ok('v69 finance navigation is loaded');
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

const finalAudit=read('quo-final-audit-v65.js');
if(!finalAudit.includes("QUO_FINAL_AUDIT_VERSION='65'"))fail('Final audit version marker missing');
if(!finalAudit.includes("if(label.textContent!==wanted)label.textContent=wanted"))fail('Preview relabel mutation guard missing');
if(!process.exitCode)ok('Final audit preview label guard is present');

const amendments=read('quo-amendments-v66.js');
for(const token of ["QUO_AMENDMENTS_VERSION='66'",'quo_amend_document','quo_void_document','Superseded - historical record','Issued document locked']){
  if(!amendments.includes(token))fail(`Amendment capability marker missing: ${token}`);
}
if(!amendments.includes("const previousDashboard=renderDashboard"))fail('Superseded dashboard exclusion wrapper is missing');
if(!process.exitCode)ok('Revision, void, history and dashboard amendment guards are present');

const migration=read('supabase/migrations/20260819_quo_document_amendments_v66.sql');
for(const token of ['revision_root_id','superseded_by_id','quo_guard_issued_content','quo_amend_document','quo_void_document',"status not in ('Cancelled','Superseded')"]){
  if(!migration.includes(token))fail(`Database amendment marker missing: ${token}`);
}
if(!process.exitCode)ok('Database revision and issued-document immutability migration is present');

const graph=read('quo-dashboard-graph-v67.js');
for(const token of ["QUO_DASHBOARD_GRAPH_VERSION='67'",'Commercial Activity','quoted:0','invoiced:0','collected:0',"new Set(['Cancelled','Superseded'])"]){
  if(!graph.includes(token))fail(`Dashboard graph capability marker missing: ${token}`);
}
if(graph.includes('MutationObserver'))fail('Dashboard graph must not add a MutationObserver');
if(!process.exitCode)ok('Six-month dashboard graph and inactive-document exclusions are present');

const finance=read('quo-finance-v68.js');
for(const token of ["QUO_FINANCE_VERSION='68'",'quo_create_adjustment_note','Invoice Aging & Collections','Activity Timeline','Credit Note','Debit Note','Credit Balance / Refund Due']){
  if(!finance.includes(token))fail(`Finance v68 capability marker missing: ${token}`);
}
if(finance.includes('MutationObserver'))fail('Finance v68 must not add a MutationObserver');
if(!process.exitCode)ok('Credit/debit notes, aging and activity timeline UI are present');

const financeNav=read('quo-finance-nav-v69.js');
for(const token of ["QUO_FINANCE_NAV_VERSION='69'",'credit_note','debit_note','openType(type)','data-q69-filter']){
  if(!financeNav.includes(token))fail(`Finance v69 navigation marker missing: ${token}`);
}
if(financeNav.includes('MutationObserver'))fail('Finance v69 navigation must not add a MutationObserver');
if(!process.exitCode)ok('Credit/debit navigation and filter chips are wired');

const financeMigration=read('supabase/migrations/20260819_quo_financial_controls_aging_timeline_v68.sql');
for(const token of ['credit_note','debit_note','quo_invoice_effective_total','quo_create_adjustment_note','quo_document_events','quo_log_document_event','adjustment_notes_without_invoice']){
  if(!financeMigration.includes(token))fail(`Finance v68 database marker missing: ${token}`);
}
if(!process.exitCode)ok('Finance v68 database controls and timeline schema are present');

if(process.exitCode)process.exit(process.exitCode);
console.log('Quo static production checks passed.');
