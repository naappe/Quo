// Isolated browser fixture: no real account, database or payment is accessed.
(() => {
  const clone = value => JSON.parse(JSON.stringify(value));
  const user = {id:'test-user',email:'test@example.invalid'};
  const session = {user,access_token:'fixture',refresh_token:'fixture'};
  const saved = JSON.parse(localStorage.getItem('fixture-docs') || '[]');
  window.fixtureDB = {docs:saved,fail:false,reject:false,queries:[],writes:[]};
  function from(table) {
    const q = {operation:'select',values:null,filters:[],one:false,start:0,end:999};
    const api = {};
    for (const method of ['select','order','limit','eq','is','range','or','neq','in','ilike','gte','lte','not','insert','update','upsert','delete','single','maybeSingle']) {
      api[method] = (...args) => {
        if (['insert','update','upsert','delete'].includes(method)) {q.operation=method;q.values=args[0];}
        if (method==='eq'||method==='is') q.filters.push(args);
        if (method==='range') [q.start,q.end]=args;
        if (method==='single'||method==='maybeSingle') q.one=true;
        return api;
      };
    }
    api.then = (resolve,reject) => Promise.resolve().then(() => {
      fixtureDB.queries.push({table,operation:q.operation});
      if(fixtureDB.reject) throw new Error('Fixture network failure');
      if(fixtureDB.fail) return {data:null,error:{message:'Fixture query denied'}};
      let rows = table==='quo_documents'?fixtureDB.docs:table==='quo_users'?[{user_id:user.id,role:'admin',is_active:true,display_name:'Test Admin'}]:[];
      if(table==='quo_settings') return {data:{id:1,company_name:'White Saffron',currency:'MVR'},error:null};
      if(q.operation!=='select') {
        fixtureDB.writes.push({table,operation:q.operation,values:clone(q.values)});
        let row;
        if(q.operation==='insert') {
          row={...clone(q.values),id:crypto.randomUUID(),document_number:'QT-2026-TEST',created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
          fixtureDB.docs.push(row);
        } else {
          row=rows.find(r=>q.filters.every(([key,value])=>r[key]===value));
          if(row)Object.assign(row,clone(q.values));
        }
        localStorage.setItem('fixture-docs',JSON.stringify(fixtureDB.docs));
        return {data:clone(row||{}),error:null};
      }
      rows=rows.filter(r=>q.filters.every(([key,value])=>(r[key]??null)===value));
      return {data:clone(q.one?(rows[0]||null):rows.slice(q.start,q.end+1)),count:rows.length,error:null};
    }).then(resolve,reject);
    return api;
  }
  window.supabase={createClient:()=>({from,auth:{
    signInWithPassword:async()=>({data:{user,session},error:null}),
    getUser:async()=>({data:{user},error:null}),
    setSession:async()=>({data:{session},error:null}),
    signOut:async()=>({error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})
  },rpc:async(name,args)=>{
    fixtureDB.queries.push({rpc:name,args});
    if(name==='quo_record_invoice_payment')throw new Error('Payment mutations are outside this fixture');
    return {data:null,error:null};
  },functions:{invoke:async()=>({data:{users:[]},error:null})}})};
})();
