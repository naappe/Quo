/* Quo v11 polish: remove duplicate actions, tighten header, refine neutral document workspace. */

const _quoPolishSetTop=setTop;
setTop=function(){
  const [section,title]=titleForView();
  const eyebrow=$('#topEyebrow');
  const heading=$('#topTitle');
  if(!eyebrow||!heading)return;
  eyebrow.textContent=section==='QUO'?'':section;
  heading.textContent=title;
};

if(!document.getElementById('quoPolishStyle')){
  const st=document.createElement('style');
  st.id='quoPolishStyle';
  st.textContent=`
    /* top bar */
    .topbar{height:54px;padding:0 20px;background:#fff;border-bottom:1px solid #e7e9ea}
    .top-title{display:flex;align-items:center;gap:7px;min-width:0}
    .top-title .eyebrow{font-size:8px;color:#9a9fa1;letter-spacing:.11em;margin:0}
    .top-title .eyebrow:not(:empty)::after{content:' /';color:#c3c7c8}
    .top-title h1{font-size:12px;font-weight:600;color:#555b5e;margin:0;white-space:nowrap}
    .top-actions{gap:7px}
    .prepared-by{height:32px;min-width:188px;border:0;background:#f5f6f6;border-radius:6px;padding:0 8px;gap:6px}
    .prepared-by span{font-size:7.5px;color:#969b9d;letter-spacing:.06em}
    .prepared-by input{width:105px;padding:0;font-size:10.5px;font-weight:500;color:#35393b}
    .top-actions>.btn.primary{height:32px;background:#25292b;border-color:#25292b;color:#fff;padding:0 11px;font-size:10.5px;font-weight:600}
    .top-actions>.btn.primary:hover{background:#111415;border-color:#111415}

    /* content header */
    .content{padding:18px 24px 30px}
    .page-head{align-items:center;margin-bottom:14px;min-height:40px}
    .page-head .eyebrow{display:none}
    .page-head h2{font-size:18px;margin:0 0 3px;font-weight:600;letter-spacing:-.01em}
    .page-head p{font-size:10px;color:#7d8385}
    .page-head [data-new]{display:none!important}
    .page-actions:empty{display:none}

    /* document toolbar */
    .toolbar-row{display:grid;grid-template-columns:minmax(260px,1fr) auto;gap:10px;align-items:center;margin:0 0 10px}
    .search{max-width:none;min-width:0}
    .search input{height:34px;border-radius:6px;border-color:#dfe2e3;background:#fff;font-size:10.5px;padding-left:31px}
    .search:before{top:6px;color:#9ca1a3}
    .chips{justify-content:flex-end;gap:5px}
    .chip{height:30px;padding:0 10px;border-radius:6px;font-size:9px;font-weight:500;background:#fff;color:#666c6e;border-color:#e0e3e4}
    .chip.active{background:#f1edff;border-color:#e0d8ff;color:#654bd0;font-weight:600}

    /* tables */
    .panel{border-radius:7px;box-shadow:none}
    .data-table th{height:32px;padding:0 12px;background:#fafafa;color:#929799;font-size:7.5px;font-weight:700;letter-spacing:.08em}
    .data-table td{height:46px;padding:8px 12px;font-size:10px}
    .data-table tbody tr:hover{background:#fcfcfc}
    .data-table strong{font-weight:600}
    .subline{font-size:8px;margin-top:1px;color:#9ba0a2}
    .badge{border-radius:5px;padding:3px 6px;font-size:7.5px;font-weight:600}
    .actions-col{width:104px}
    .row-actions{text-align:right}
    .table-action{font-size:8.5px;padding:5px 6px;font-weight:600}

    /* sidebar */
    .sidebar{padding-top:12px}
    .side-brand{padding-bottom:13px}
    .side-brand .mark{background:#25292b}
    .nav-label{padding-top:11px}

    /* remove excess visual emphasis from generic primary actions outside topbar */
    .page-actions .btn.primary,.editor-actions .btn.primary{background:#25292b;border-color:#25292b}
    .page-actions .btn.primary:hover,.editor-actions .btn.primary:hover{background:#111415;border-color:#111415}

    @media(max-width:820px){
      .topbar{height:auto;min-height:54px;padding:8px 12px}
      .top-actions{width:100%}
      .prepared-by{flex:1;min-width:0}
      .prepared-by input{width:100%}
      .content{padding:14px 12px 28px}
      .toolbar-row{grid-template-columns:1fr}
      .chips{justify-content:flex-start}
    }
  `;
  document.head.appendChild(st);
}

if(typeof render==='function'&&!S.loading){render();}
