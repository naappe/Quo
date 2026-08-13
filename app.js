const $=id=>document.getElementById(id);
const cfg={quotation:{title:'Quotation',pre:'QT',due:'Expires On'},proforma:{title:'Proforma Invoice',pre:'PI',due:'Valid Until'},invoice:{title:'Invoice',pre:'INV',due:'Due Date'}};
const keys={docs:'quo_docs_v1',count:'quo_count_v1',draft:'quo_draft_v1'};
let s;

function money(n){return Number(n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}
function fd(d){if(!d)return'';return new Date(d+'T00:00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}).replaceAll(' ','-')}
function esc(v){let x=document.createElement('div');x.textContent=v??'';return x.innerHTML}
function next(type){let c=JSON.parse(localStorage.getItem(keys.count)||'{}');c[type]=(c[type]||0)+1;localStorage.setItem(keys.count,JSON.stringify(c));return cfg[type].pre+'/'+String(c[type]).padStart(3,'0')}
function menuDefault(){return `Day 1 - 22 August
Morning Coffee 04:30-05:30: Hot Milo
Breakfast 07:15-08:15: Bread, Butter, Peanut Butter, Jam, Roshi, Baked Beans, Kulhimas, Omelette, Banana, Tea
Lunch 12:00-14:00: White Rice, Roshi, Fish Curry, Dhaal Curry, Salad, Papadum, Custard, Juice
Tea Break 15:30-16:30: Sandwich, Tuna, Bis Keemiya, Gulha, Boakibaa, Butter Cake, Roast Paan, Tea
Dinner 20:00-21:00: White Rice, Spaghetti, Devilled Chicken, Fish Curry, Salad, Papadum, Custard, Juice
Red Coffee 22:30-23:00: Hot Milo

Day 2 - 23 August
Morning Coffee 04:30-05:30: Hot Milo
Breakfast 07:15-08:15: Bread, Butter, Peanut Butter, Jam, Roshi, Mashuni, Boiled Eggs, Banana, Tea
Lunch 12:00-14:00: White Rice, Fried Noodles, Devilled Fish, Chicken Curry, Mixed Salad, Papadum, Fruits, Juice
Red Coffee 22:30-23:00: Hot Milo
Juice Break: Not Required
Tea Break: Not Required
Dinner: Not Required`}

function fresh(type='quotation',old={}){
  s={uid:String(Date.now())+Math.random(),type,number:next(type),date:'',due:'',status:'Draft',currency:old.currency||'MVR',customer:old.customer||'Muhyiddin School',phone:old.phone||'9997870',address:old.address||'',items:old.items?JSON.parse(JSON.stringify(old.items)):[{description:'2-Day Meal Package - Per Pax',qty:200,unit:'Pax',price:600}],gstMode:old.gstMode||'none',gstRate:old.gstRate??8,discount:old.discount||0,showGst:old.showGst||false,includeMenu:old.includeMenu??true,menuTitle:old.menuTitle||'MESS MENU',menu:old.menu||menuDefault(),useAdvance:false,advance:old.advance??50,advanceDate:'',bank:old.bank||'Bank of Maldives (BML)',account:old.account||'',slipVia:old.slipVia||'Viber',slipNo:old.slipNo||'',extra:old.extra||''};
  bind();render();
}

function normalizeState(x){
  x.useAdvance = x.useAdvance===undefined ? Boolean(Number(x.advance)>0 && (x.advanceDate||x.account||x.slipNo)) : Boolean(x.useAdvance);
  x.date=x.date||'';x.due=x.due||'';x.advanceDate=x.advanceDate||'';return x;
}

function bind(){
  s=normalizeState(s);
  ['type','number','date','due','status','currency','customer','phone','address','gstMode','gstRate','discount','menuTitle','menu','advance','advanceDate','bank','account','slipVia','slipNo','extra'].forEach(k=>$(k).value=s[k]??'');
  $('showGst').checked=!!s.showGst;$('includeMenu').checked=!!s.includeMenu;$('useAdvance').checked=!!s.useAdvance;drawItems();toggleAdvance();
}

function read(){
  ['date','due','status','currency','customer','phone','address','gstMode','menuTitle','menu','bank','account','slipVia','slipNo','extra'].forEach(k=>s[k]=$(k).value);
  ['gstRate','discount','advance'].forEach(k=>s[k]=Number($(k).value||0));
  s.advanceDate=$('advanceDate').value;s.showGst=$('showGst').checked;s.includeMenu=$('includeMenu').checked;s.useAdvance=$('useAdvance').checked;
}

function drawItems(){
  $('items').innerHTML=s.items.map((i,n)=>`<div class="item" data-i="${n}"><div><label>Description</label><input data-k="description" value="${esc(i.description)}"></div><div><label>Qty</label><input data-k="qty" type="number" step="0.01" value="${i.qty}"></div><div><label>Unit</label><input data-k="unit" value="${esc(i.unit)}"></div><div><label>Price</label><input data-k="price" type="number" step="0.01" value="${i.price}"></div><button class="remove" onclick="removeItem(${n})">x</button></div>`).join('');
}

function calc(){
  let raw=s.items.reduce((a,i)=>a+Number(i.qty||0)*Number(i.price||0),0),disc=Math.min(Number(s.discount||0),raw),base=raw-disc,gst=0,net=base;
  if(s.gstMode==='exclusive')gst=base*Number(s.gstRate||0)/100;
  if(s.gstMode==='inclusive'){gst=base-base/(1+Number(s.gstRate||0)/100);net=base-gst}
  return{raw,disc,gst,net,total:s.gstMode==='exclusive'?base+gst:base};
}

function toggleAdvance(){
  $('advanceFields').classList.toggle('disabled',!$('useAdvance').checked);
}

function render(){
  read();toggleAdvance();let c=calc(),t=cfg[s.type];
  $('dueLabel').textContent=t.due+' - Optional';$('chip').textContent=s.number;
  $('eSub').textContent=money(s.gstMode==='inclusive'?c.net:c.raw);$('eGst').textContent=money(c.gst);$('eTotal').textContent=money(c.total);
  $('pTitle').textContent=t.title;$('pStatus').textContent=s.status;$('pNumber').textContent=s.number;$('pNumber2').textContent=s.number;
  $('pCustomer').textContent=s.customer||'Customer';$('pPhone').textContent=s.phone||'';$('pAddress').textContent=s.address||'';
  $('pDate').textContent=s.date?fd(s.date):'Not set';$('pDueLabel').textContent=s.due?t.due:'';$('pDue').textContent=s.due?fd(s.due):'';
  $('pItems').innerHTML=s.items.map((i,n)=>`<tr><td>${n+1}</td><td class="desc">${esc(i.description)}</td><td class="qty">${Number(i.qty||0).toLocaleString()}</td><td>${esc(i.unit)}</td><td class="num">${money(i.price)}</td><td class="num">${money(Number(i.qty||0)*Number(i.price||0))}</td></tr>`).join('');
  $('pSub').textContent=money(s.gstMode==='inclusive'?c.net:c.raw);$('pDisc').textContent=money(c.disc);$('pDiscRow').classList.toggle('hidden',!c.disc);
  $('pGstLabel').textContent='GST @ '+Number(s.gstRate||0)+'%';$('pGst').textContent=money(c.gst);$('pGstRow').classList.toggle('hidden',!(s.showGst||c.gst));
  $('pTotalLabel').textContent='Total ('+s.currency+')';$('pTotal').textContent=money(c.total);
  $('summaryNote').textContent=s.includeMenu&&s.menu.trim()?'Meal details are provided on the attached menu page.':'';

  let adv=c.total*Number(s.advance||0)/100,bal=c.total-adv;
  $('pAdvanceBox').classList.toggle('hidden',!s.useAdvance);
  if(s.useAdvance){$('pAdvanceValue').textContent=s.currency+' '+money(adv);$('pAdvanceDue').textContent=s.advanceDate?'Due on or before '+fd(s.advanceDate):'Advance due date to be confirmed';$('pBalanceValue').textContent=s.currency+' '+money(bal)}

  let terms=[];
  if(s.useAdvance)terms.push(`${Number(s.advance||0)}% advance payment of ${s.currency} ${money(adv)}${s.advanceDate?' is required on or before '+fd(s.advanceDate):' is required to confirm the booking'}. Remaining balance: ${s.currency} ${money(bal)}.`);
  if(s.bank||s.account)terms.push(`Bank Transfer: ${s.bank||'Bank'}${s.account?' - Account No.: '+s.account:''}`);
  if(s.slipVia||s.slipNo)terms.push(`After payment, please send the payment slip${s.slipVia?' via '+s.slipVia:''}${s.slipNo?' to '+s.slipNo:''}.`);
  if(s.extra.trim())terms.push(s.extra.trim());
  $('pTerms').textContent=terms.join('\n\n')||'Payment and service terms as agreed with the customer.';
  $('pFooterRef').textContent=s.number;

  renderMenu();
  localStorage.setItem(keys.draft,JSON.stringify(s));
}

function parseMenu(text){
  const lines=text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);let days=[],cur=null;
  for(const line of lines){
    if(/^Day\s+\d+/i.test(line)){cur={title:line,meals:[]};days.push(cur);continue}
    if(!cur)continue;
    const m=line.match(/^(.+?)(?:\s+(\d{2}:\d{2}-\d{2}:\d{2}))?:\s*(.+)$/);
    if(m)cur.meals.push({name:m[1].trim(),time:m[2]||'',items:m[3].trim()});
  }
  return days;
}

function renderMenu(){
  $('menuPage').classList.toggle('hidden',!(s.includeMenu&&s.menu.trim()));if(!(s.includeMenu&&s.menu.trim()))return;
  $('pMenuTitle').textContent=s.menuTitle||'MESS MENU';$('menuDocRef').textContent=s.number;$('menuSub').textContent=s.customer||'Customer';$('menuBadge').textContent=s.items[0]?.qty?`${Number(s.items[0].qty).toLocaleString()} ${s.items[0].unit||''}`:'';
  const days=parseMenu(s.menu);$('menuGrid').innerHTML='';$('fallbackMenu').classList.add('hidden');
  if(days.length){
    $('menuGrid').classList.remove('hidden');
    $('menuGrid').innerHTML=days.map((d,i)=>`<section class="day-card"><div class="day-head"><div class="day-kicker">Service Schedule</div><div class="day-title">${esc(d.title)}</div></div>${d.meals.map(m=>`<div class="meal"><div><div class="meal-name">${esc(m.name)}</div>${m.time?`<div class="meal-time">${esc(m.time)}</div>`:''}</div><div class="meal-items ${/not required/i.test(m.items)?'not-required':''}">${esc(m.items)}</div></div>`).join('')}</section>`).join('');
  }else{$('menuGrid').classList.add('hidden');$('fallbackMenu').classList.remove('hidden');$('fallbackMenu').textContent=s.menu}
}

function addItem(){s.items.push({description:'',qty:1,unit:'Pax',price:0});drawItems();render()}
function removeItem(n){if(s.items.length===1)return;s.items.splice(n,1);drawItems();render()}

$('items').addEventListener('input',e=>{let r=e.target.closest('.item');if(!r||!e.target.dataset.k)return;let k=e.target.dataset.k;s.items[+r.dataset.i][k]=['qty','price'].includes(k)?Number(e.target.value||0):e.target.value;render()});
$('useAdvance').addEventListener('change',()=>{toggleAdvance();render()});
document.querySelector('.editor').addEventListener('input',e=>{if(!e.target.closest('#items')&&e.target.id!=='useAdvance')render()});
document.querySelector('.editor').addEventListener('change',e=>{if(e.target.id!=='type'&&e.target.id!=='useAdvance')render()});
$('type').addEventListener('change',e=>{let nt=e.target.value;if(nt===s.type)return;if(confirm('Create a new '+cfg[nt].title+' number and keep the same content?')){saveDoc(false);fresh(nt,s)}else e.target.value=s.type});

function docs(){return JSON.parse(localStorage.getItem(keys.docs)||'[]')}
function saveDoc(msg=true){read();let d=docs(),i=d.findIndex(x=>x.uid===s.uid),copy=JSON.parse(JSON.stringify(s));i>=0?d[i]=copy:d.unshift(copy);localStorage.setItem(keys.docs,JSON.stringify(d));history();if(msg)alert(s.number+' saved')}
function history(){let d=docs();$('history').innerHTML=d.length?d.map(x=>`<div><span><b>${esc(x.number)}</b><br>${esc(x.customer||'No customer')}</span><button class="btn" onclick="openDoc('${x.uid}')">Open</button><button class="btn" onclick="deleteDoc('${x.uid}')">Delete</button></div>`).join(''):'No saved documents yet.'}
function openDoc(id){let x=docs().find(x=>x.uid===id);if(x){s=normalizeState(JSON.parse(JSON.stringify(x)));bind();render();scrollTo(0,0)}}
function deleteDoc(id){if(!confirm('Delete this document?'))return;localStorage.setItem(keys.docs,JSON.stringify(docs().filter(x=>x.uid!==id)));history()}
function newDoc(){if(confirm('Create a new quotation? Current document will be saved.')){saveDoc(false);fresh()}}
function convertDoc(){let x=prompt('Convert to quotation, proforma, or invoice','invoice');if(!x)return;let m={quotation:'quotation',quote:'quotation',proforma:'proforma','proforma invoice':'proforma',invoice:'invoice'}[x.toLowerCase().trim()];if(!m)return alert('Use quotation, proforma, or invoice');saveDoc(false);fresh(m,s)}
function savePDF(){saveDoc(false);document.title=s.number.replace('/','-')+'-'+(s.customer||'document');window.print()}

let d=localStorage.getItem(keys.draft);if(d){try{s=normalizeState(JSON.parse(d));bind();render()}catch{fresh()}}else fresh();history();
