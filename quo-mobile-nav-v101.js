/* Quo v101 - reliable mobile navigation drawer controller. */
(function(){
  const MOBILE_MAX=820;
  const root=document.documentElement;
  const sidebar=document.getElementById('sidebar');
  const menuBtn=document.getElementById('menuBtn');
  if(!sidebar||!menuBtn)return;

  let backdrop=document.getElementById('quoMobileNavBackdrop');
  if(!backdrop){
    backdrop=document.createElement('button');
    backdrop.type='button';
    backdrop.id='quoMobileNavBackdrop';
    backdrop.className='quo-mobile-nav-backdrop';
    backdrop.setAttribute('aria-label','Close navigation');
    document.body.appendChild(backdrop);
  }

  const isMobile=()=>window.innerWidth<=MOBILE_MAX;
  const isOpen=()=>sidebar.classList.contains('open');

  function sync(){
    const open=isMobile()&&isOpen();
    root.classList.toggle('quo-mobile-nav-open',open);
    backdrop.classList.toggle('show',open);
    menuBtn.setAttribute('aria-expanded',open?'true':'false');
    menuBtn.setAttribute('aria-label',open?'Close navigation':'Open navigation');
    menuBtn.textContent=open?'×':'☰';
  }

  function closeDrawer(){
    sidebar.classList.remove('open');
    sync();
  }

  function openDrawer(){
    if(!isMobile())return;
    sidebar.classList.add('open');
    sync();
  }

  function toggleDrawer(){
    if(!isMobile())return;
    isOpen()?closeDrawer():openDrawer();
  }

  /* Replace the old single class toggle with a complete drawer controller. */
  menuBtn.onclick=function(e){
    e.preventDefault();
    e.stopPropagation();
    toggleDrawer();
  };

  backdrop.onclick=function(e){
    e.preventDefault();
    closeDrawer();
  };

  /* Any real navigation choice should immediately reveal the destination page. */
  sidebar.addEventListener('click',function(e){
    const action=e.target.closest('button,a,[data-view],[data-open],[data-create]');
    if(!action)return;
    if(action===menuBtn)return;
    setTimeout(closeDrawer,0);
  },true);

  /* Defensive outside tap in case another layer sits above the backdrop. */
  document.addEventListener('pointerdown',function(e){
    if(!isMobile()||!isOpen())return;
    if(sidebar.contains(e.target)||menuBtn.contains(e.target))return;
    closeDrawer();
  },true);

  document.addEventListener('keydown',function(e){
    if(e.key==='Escape'&&isOpen())closeDrawer();
  },true);

  window.addEventListener('resize',function(){
    if(!isMobile())closeDrawer();
    else sync();
  });

  window.addEventListener('pageshow',function(){
    if(isMobile())closeDrawer();
  });

  /* Mobile must always start with the drawer hidden after refresh/load. */
  if(isMobile())sidebar.classList.remove('open');
  sync();

  if(!document.getElementById('quoMobileNavV101Style')){
    const st=document.createElement('style');
    st.id='quoMobileNavV101Style';
    st.textContent=`
      .quo-mobile-nav-backdrop{display:none;position:fixed;inset:0;z-index:49;border:0;padding:0;background:rgba(16,25,23,.34);backdrop-filter:blur(1px);-webkit-backdrop-filter:blur(1px)}
      @media(max-width:820px){
        .quo-mobile-nav-backdrop.show{display:block}
        #sidebar{z-index:60!important;overscroll-behavior:contain;overflow-y:auto;-webkit-overflow-scrolling:touch}
        #sidebar:not(.open){transform:translateX(-105%)!important;pointer-events:none}
        #sidebar.open{transform:translateX(0)!important;pointer-events:auto}
        html.quo-mobile-nav-open,html.quo-mobile-nav-open body{overflow:hidden;touch-action:none}
        #menuBtn{position:relative;z-index:61}
      }
      @media(min-width:821px){.quo-mobile-nav-backdrop{display:none!important}}
    `;
    document.head.appendChild(st);
  }

  window.quoCloseMobileNav=closeDrawer;
})();
