const core=document.createElement('script');
core.src='app-core.js?v=1';
core.onload=()=>{
  const activate=async()=>{
    try{
      if(typeof sb==='undefined'||!sb){
        if(!window.supabase){await new Promise((ok,fail)=>{const sc=document.createElement('script');sc.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';sc.onload=ok;sc.onerror=fail;document.head.appendChild(sc)})}
        sb=window.supabase.createClient('https://tmupbruwmwlrmewhoodn.supabase.co','sb_publishable_LAn1liS2zqMqlB33IQJxIw_NbgWKix1',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})
      }
      document.getElementById('quoLogin')?.remove();
      me={id:null,email:null};
      userRole='passwordless';
      displayName=localStorage.getItem('quo_prepared_by')||'';
      let field=document.getElementById('preparedBy');
      if(!field){
        const grids=[...document.querySelectorAll('.section .formgrid')];
        const docGrid=grids[0];
        if(docGrid){
          const wrap=document.createElement('div');
          wrap.className='full';
          wrap.innerHTML='<label>Prepared By</label><input id="preparedBy" placeholder="Enter your name">';
          docGrid.appendChild(wrap);
          field=wrap.querySelector('input');
        }
      }
      if(field){
        field.value=displayName;
        field.addEventListener('input',()=>{displayName=field.value.trim();localStorage.setItem('quo_prepared_by',displayName);if(s&&!s.id)s.created_by_name=displayName;renderAudit?.()});
      }
      const originalRead=read;
      read=function(){originalRead();if(field){displayName=field.value.trim();localStorage.setItem('quo_prepared_by',displayName);if(s&&!s.id)s.created_by_name=displayName}};
      const originalSave=saveDoc;
      saveDoc=async function(show=true){
        if(field){displayName=field.value.trim();localStorage.setItem('quo_prepared_by',displayName)}
        if(!displayName){alert('Please enter Prepared By before saving.');field?.focus();return false}
        try{
          read();state('Saving to Supabase...');
          if(!s.id){
            const nr=await sb.rpc('next_quo_document_number',{p_type:s.document_type});if(nr.error)throw nr.error;
            s.document_number=nr.data;
            const r=await sb.from('quo_documents').insert({...payload(),created_by:null,created_by_name:displayName,updated_by:null,updated_by_name:displayName}).select('*').single();if(r.error)throw r.error;s={...s,...r.data};
          }else{
            const p=payload();delete p.document_number;delete p.document_type;
            const r=await sb.from('quo_documents').update({...p,updated_by:null,updated_by_name:displayName}).eq('id',s.id).select('*').single();if(r.error)throw r.error;s={...s,...r.data};
          }
          bind();if(field)field.value=displayName;await loadDocs();state(`${s.document_number} saved`);if(show)toast(`${s.document_number} saved to Supabase`);return true;
        }catch(e){console.error(e);state('Save failed');alert('Save failed: '+e.message);return false}
      };
      const oldFresh=fresh;
      fresh=function(type='quotation',copy=null){oldFresh(type,copy);if(s){s.created_by=null;s.updated_by=null;s.created_by_name=displayName||s.created_by_name||''}if(field)field.value=displayName};
      await loadDocs();
      if(!s)fresh('quotation');
      else {if(field)field.value=displayName;state('Passwordless mode');}
      document.querySelectorAll('#quoUser,.toolbar button').forEach(el=>{if(el.id==='quoUser'||el.textContent.trim()==='Sign out')el.remove()});
    }catch(e){console.error(e);alert('Could not start passwordless mode: '+e.message)}
  };
  setTimeout(activate,50);
};
document.head.appendChild(core);
