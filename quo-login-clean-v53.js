/* Quo v54 - neutral login fields without observer loop. */
(function(){
  const cleanLogin=()=>{
    const input=document.getElementById('quoLoginId');
    if(input)input.removeAttribute('placeholder');
    const copy=document.querySelector('.quo-login-copy p');
    if(copy&&copy.textContent!=='Sign in to continue.')copy.textContent='Sign in to continue.';
  };
  cleanLogin();
  setTimeout(cleanLogin,0);
})();
