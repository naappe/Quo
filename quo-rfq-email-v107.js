/* Quo v107 - email White Saffron when a public RFQ is successfully submitted. */
(function(){
  const EMAIL='whitesaffron2025@gmail.com';
  const REVIEW_URL='https://naappe.github.io/Quo/';
  let sentFor='';

  function value(name){
    const el=document.querySelector(`[name="${name}"]`);
    return String(el?.value||'').trim();
  }

  async function sendNotification(){
    const success=document.getElementById('success');
    if(!success||!success.classList.contains('show'))return;
    const rfq=String(document.getElementById('rfqNo')?.textContent||'').trim();
    if(!rfq||rfq==='Request received'||rfq===sentFor)return;
    sentFor=rfq;

    const customer=value('customer_name');
    const mobile=value('mobile');
    const email=value('email');
    const eventDate=value('event_date');
    const time=value('time');
    const pax=value('pax');
    const requirement=value('requirement');

    const payload={
      _subject:`New White Saffron quotation request - ${rfq}`,
      _template:'table',
      'RFQ Reference':rfq,
      'Customer Name':customer,
      'Mobile':mobile,
      'Email':email||'Not provided',
      'Date':eventDate,
      'Time':time,
      'Pax':pax,
      'Requirement':requirement,
      'Review in Quo':REVIEW_URL
    };
    if(email)payload._replyto=email;

    try{
      const response=await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(EMAIL)}`,{
        method:'POST',
        headers:{'Content-Type':'application/json','Accept':'application/json'},
        body:JSON.stringify(payload)
      });
      if(!response.ok)throw new Error(`Email service returned ${response.status}`);
      const data=await response.json().catch(()=>({}));
      if(data?.success===false)throw new Error(data?.message||'Email notification failed');
      console.info(`RFQ email notification submitted for ${rfq}`);
    }catch(err){
      console.warn('RFQ saved, but email notification could not be submitted.',err);
      sentFor='';
    }
  }

  function watch(){
    const success=document.getElementById('success');
    if(!success)return;
    const observer=new MutationObserver(()=>sendNotification());
    observer.observe(success,{attributes:true,attributeFilter:['class'],childList:true,subtree:true});
    sendNotification();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',watch,{once:true});
  else watch();
})();
