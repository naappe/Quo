(function(){
  const KEY='quo-theme';
  const root=document.documentElement;
  const meta=document.querySelector('meta[name="theme-color"]');

  function savedTheme(){
    try{
      const v=localStorage.getItem(KEY);
      return v==='dark'||v==='light'?v:null;
    }catch(_){return null}
  }

  function initialTheme(){
    return savedTheme() || 'light';
  }

  function setTheme(theme,persist){
    const next=theme==='dark'?'dark':'light';
    root.setAttribute('data-theme',next);
    if(meta)meta.setAttribute('content',next==='dark'?'#1c1917':'#fafaf9');
    const btn=document.getElementById('themeToggle');
    if(btn){
      const icon=btn.querySelector('.theme-icon');
      const label=btn.querySelector('.theme-label');
      if(icon)icon.textContent=next==='dark'?'☀':'☾';
      if(label)label.textContent=next==='dark'?'Light':'Dark';
      btn.setAttribute('aria-label',next==='dark'?'Switch to light mode':'Switch to dark mode');
      btn.setAttribute('title',next==='dark'?'Switch to light mode':'Switch to dark mode');
      btn.setAttribute('aria-pressed',next==='dark'?'true':'false');
    }
    if(persist){
      try{localStorage.setItem(KEY,next)}catch(_){}
    }
  }

  setTheme(initialTheme(),false);

  function bind(){
    const btn=document.getElementById('themeToggle');
    if(!btn)return;
    setTheme(root.getAttribute('data-theme')||initialTheme(),false);
    btn.addEventListener('click',function(){
      setTheme(root.getAttribute('data-theme')==='dark'?'light':'dark',true);
    });
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});
  else bind();
})();
