/* Quo v67 - native dashboard commercial activity graph. */
(function(){
  if(typeof S==='undefined')return;
  window.QUO_DASHBOARD_GRAPH_VERSION='67';

  const inactive=new Set(['Cancelled','Superseded']);
  const clean=v=>String(v||'').trim();
  const moneyValue=v=>Number(v||0);

  function maldivesYearMonth(){
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Indian/Maldives',year:'numeric',month:'2-digit'}).formatToParts(new Date());
    const year=Number(parts.find(p=>p.type==='year')?.value||new Date().getFullYear());
    const month=Number(parts.find(p=>p.type==='month')?.value||new Date().getMonth()+1);
    return {year,month};
  }

  function monthSeries(count=6){
    const now=maldivesYearMonth(),out=[];
    for(let offset=count-1;offset>=0;offset--){
      const d=new Date(Date.UTC(now.year,now.month-1-offset,1));
      const y=d.getUTCFullYear(),m=d.getUTCMonth()+1;
      out.push({
        key:`${y}-${String(m).padStart(2,'0')}`,
        label:new Intl.DateTimeFormat('en',{month:'short'}).format(new Date(Date.UTC(y,m-1,2))),
        year:y,
        quoted:0,
        invoiced:0,
        collected:0
      });
    }
    return out;
  }

  function documentTotal(d){
    try{return Number(calc(d)?.total||0)}catch(e){
      return (d.items||[]).reduce((sum,item)=>sum+moneyValue(item.qty)*moneyValue(item.price),0)-moneyValue(d.discount);
    }
  }

  function chartData(){
    const months=monthSeries(6),map=new Map(months.map(m=>[m.key,m]));
    (S.docs||[]).filter(d=>!d.deleted_at&&!inactive.has(d.status)).forEach(d=>{
      const key=clean(d.creation_date).slice(0,7),bucket=map.get(key);if(!bucket)return;
      const total=documentTotal(d);
      if(d.document_type==='quotation')bucket.quoted+=total;
      if(d.document_type==='invoice')bucket.invoiced+=total;
      if(d.document_type==='receipt')bucket.collected+=total;
    });
    return months;
  }

  function compact(value){
    const n=Math.max(0,Number(value||0));
    if(n>=1000000)return `${(n/1000000).toFixed(n>=10000000?0:1)}m`;
    if(n>=1000)return `${(n/1000).toFixed(n>=100000?0:1)}k`;
    return Math.round(n).toLocaleString();
  }

  function amount(value){
    const currency=clean(S.settings?.currency)||'MVR';
    return `${currency} ${Number(value||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  }

  function graphSVG(rows){
    const W=760,H=286,left=58,right=16,top=24,bottom=54;
    const plotW=W-left-right,plotH=H-top-bottom;
    const max=Math.max(1,...rows.flatMap(r=>[r.quoted,r.invoiced,r.collected]));
    const padded=max*1.12;
    const grid=[0,.25,.5,.75,1];
    const groupW=plotW/rows.length,barW=Math.min(18,groupW/5),gap=4;
    const colors=['q67-quoted','q67-invoiced','q67-collected'];
    const keys=['quoted','invoiced','collected'];
    const gridLines=grid.map(p=>{
      const y=top+plotH-(plotH*p),v=padded*p;
      return `<g class="q67-grid"><line x1="${left}" y1="${y.toFixed(1)}" x2="${W-right}" y2="${y.toFixed(1)}"></line><text x="${left-9}" y="${(y+3).toFixed(1)}" text-anchor="end">${compact(v)}</text></g>`;
    }).join('');
    const bars=rows.map((row,i)=>{
      const center=left+groupW*i+groupW/2,totalWidth=barW*3+gap*2,start=center-totalWidth/2;
      const rects=keys.map((key,j)=>{
        const value=row[key],h=value<=0?0:Math.max(2,(value/padded)*plotH),x=start+j*(barW+gap),y=top+plotH-h;
        return `<rect class="q67-bar ${colors[j]}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="3"><title>${row.label} ${row.year} - ${key[0].toUpperCase()+key.slice(1)}: ${amount(value)}</title></rect>`;
      }).join('');
      return `${rects}<text class="q67-month" x="${center.toFixed(1)}" y="${H-28}" text-anchor="middle">${row.label}</text>`;
    }).join('');
    return `<svg class="q67-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Six month quotation, invoice and collection activity">${gridLines}<line class="q67-axis" x1="${left}" y1="${top+plotH}" x2="${W-right}" y2="${top+plotH}"></line>${bars}</svg>`;
  }

  function graphPanel(){
    const rows=chartData();
    const totals=rows.reduce((a,r)=>({quoted:a.quoted+r.quoted,invoiced:a.invoiced+r.invoiced,collected:a.collected+r.collected}),{quoted:0,invoiced:0,collected:0});
    const empty=totals.quoted<=0&&totals.invoiced<=0&&totals.collected<=0;
    return `<section class="panel q67-dashboard-graph">
      <div class="panel-head q67-graph-head"><div><h3>Commercial Activity</h3><p>Last 6 months - quotations issued, invoices issued and payments collected.</p></div><div class="q67-legend"><span><i class="q67-quoted"></i>Quoted</span><span><i class="q67-invoiced"></i>Invoiced</span><span><i class="q67-collected"></i>Collected</span></div></div>
      <div class="q67-graph-kpis"><div><span>Quoted</span><b>${amount(totals.quoted)}</b></div><div><span>Invoiced</span><b>${amount(totals.invoiced)}</b></div><div><span>Collected</span><b>${amount(totals.collected)}</b></div></div>
      <div class="q67-chart-wrap">${graphSVG(rows)}${empty?'<div class="q67-empty-note">Activity will appear here as quotations, invoices and receipts are created.</div>':''}</div>
      <div class="q67-graph-foot"><span>Superseded and cancelled documents are excluded.</span><span>Amounts use each document issue/payment date.</span></div>
    </section>`;
  }

  try{
    const previousDashboard=renderDashboard;
    renderDashboard=function(){
      let html=previousDashboard.apply(this,arguments);
      const panel=graphPanel();
      if(html.includes('<section class="quo-final-pipeline'))return html.replace('<section class="quo-final-pipeline',panel+'<section class="quo-final-pipeline');
      if(html.includes('<section class="wf-queues'))return html.replace('<section class="wf-queues',panel+'<section class="wf-queues');
      if(html.includes('<section class="panel wf-recent'))return html.replace('<section class="panel wf-recent',panel+'<section class="panel wf-recent');
      return html+panel;
    };
  }catch(e){console.warn('Dashboard graph could not attach',e)}

  if(!document.getElementById('quoDashboardGraphV67Style')){
    const st=document.createElement('style');st.id='quoDashboardGraphV67Style';st.textContent=`
      .q67-dashboard-graph{margin:0 0 12px!important;overflow:hidden}.q67-graph-head{align-items:flex-start!important}.q67-graph-head p{margin:4px 0 0!important;font-size:9px!important;color:#77817d!important}.q67-legend{display:flex;align-items:center;gap:12px;flex-wrap:wrap;justify-content:flex-end}.q67-legend span{display:flex;align-items:center;gap:5px;font-size:8px;font-weight:750;color:#68736f}.q67-legend i{display:inline-block;width:9px;height:9px;border-radius:3px}.q67-quoted{background:#9fb8b2!important;fill:#9fb8b2}.q67-invoiced{background:#385f58!important;fill:#385f58}.q67-collected{background:#1f8a70!important;fill:#1f8a70}.q67-graph-kpis{display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid #e6ebe8;border-bottom:1px solid #e6ebe8}.q67-graph-kpis>div{padding:11px 13px;border-right:1px solid #e8ecea}.q67-graph-kpis>div:last-child{border-right:0}.q67-graph-kpis span{display:block;margin-bottom:3px;font-size:8px;color:#77817d}.q67-graph-kpis b{display:block;font-size:12px;color:#25332f}.q67-chart-wrap{position:relative;padding:8px 12px 0;min-height:210px}.q67-chart{display:block;width:100%;height:auto;min-height:210px;overflow:visible}.q67-grid line{stroke:#e7ece9;stroke-width:1}.q67-grid text{fill:#8a938f;font-size:8px}.q67-axis{stroke:#cfd8d4;stroke-width:1}.q67-month{fill:#6f7975;font-size:9px;font-weight:700}.q67-bar{transition:opacity .15s ease}.q67-bar:hover{opacity:.72}.q67-empty-note{position:absolute;left:50%;top:50%;transform:translate(-50%,-15%);width:min(420px,80%);padding:8px 10px;text-align:center;font-size:9px;color:#7b8581;background:rgba(255,255,255,.9);border:1px solid #edf0ef;border-radius:7px}.q67-graph-foot{display:flex;justify-content:space-between;gap:10px;padding:0 13px 11px;font-size:8px;color:#8a928f}.q67-dashboard-graph svg title{pointer-events:none}
      @media(max-width:760px){.q67-graph-head{display:block!important}.q67-legend{justify-content:flex-start;margin-top:9px;gap:10px}.q67-graph-kpis{grid-template-columns:1fr}.q67-graph-kpis>div{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 11px;border-right:0;border-bottom:1px solid #edf0ef}.q67-graph-kpis>div:last-child{border-bottom:0}.q67-graph-kpis span{margin:0}.q67-chart-wrap{padding:7px 4px 0;overflow-x:auto}.q67-chart{min-width:610px}.q67-graph-foot{display:block;padding:0 11px 10px}.q67-graph-foot span{display:block;margin-top:3px}}
    `;document.head.appendChild(st);
  }

  if(!S.loading&&S.view==='dashboard')render();
})();
