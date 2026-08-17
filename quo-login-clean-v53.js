/* Quo v53 - keep login fields neutral and private. */
(function(){
  function cleanLogin(){
    const input=document.getElementById('quoLoginId');
    if(input)input.removeAttribute('placeholder');
    const copy=document.querySelector('.quo-login-copy p');
    if(copy)copy.textContent='Sign in to continue.';
  }
  cleanLogin();
  new MutationObserver(cleanLogin).observe(document.body,{childList:true,subtree:true});
})();