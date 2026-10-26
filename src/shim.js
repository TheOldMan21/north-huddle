/* ===================== North Huddle data layer =====================
   Gives the page the same small db/user API it was written against,
   backed by Supabase (one "docs" table: path -> JSON data). */
(function(){
  const SB_URL="https://hoxcsdtbljhfappkshya.supabase.co";
  const SB_KEY="sb_publishable_KON7uG5HO_MW7fi2JVo9aw_-mpduqIe";
  const sb=window.supabase.createClient(SB_URL,SB_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  window.SB=sb;
  const segs=p=>String(p).split("/").filter(Boolean);
  const parentOf=p=>segs(p).slice(0,-1).join("/");
  const lastOf=p=>segs(p).slice(-1)[0];
  const rid=()=>{ const A="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"; let s=""; const r=crypto.getRandomValues(new Uint8Array(20)); r.forEach(x=>s+=A[x%62]); return s; };
  const err=(code,message)=>Object.assign(new Error(message||code),{code});
  const mapErr=e=>{ const m=String(e?.message||e||""); if(/not_found/.test(m)) return err("invalid_argument","Document does not exist"); if(/row-level security|permission|42501/i.test(m)) return err("permission_denied",m); return err("unavailable",m); };

  function docSnap(row,path){ const d=row?row.data:undefined; return {id:row?row.id:lastOf(path), exists:!!row, ref:null, data:()=>d===undefined?undefined:JSON.parse(JSON.stringify(d))}; }
  function querySnap(rows){ const docs=rows.map(r=>docSnap(r,r.path)); return {docs, size:docs.length, empty:!docs.length, forEach:f=>docs.forEach(f)}; }

  /* ---------- live listeners ---------- */
  const listeners=new Set();
  function notify(path){
    const col=parentOf(path);
    listeners.forEach(l=>{ if(l.kind==="doc"? l.path===path : l.col===col) l.kick(); });
  }
  let live=false;
  sb.channel("docs-live").on("postgres_changes",{event:"*",schema:"public",table:"docs"},p=>{
    const path=(p.new&&p.new.path)||(p.old&&p.old.path);
    if(path) notify(path); else listeners.forEach(l=>l.kick());
  }).subscribe(st=>{ const was=live; live=(st==="SUBSCRIBED"); if(live&&!was) listeners.forEach(l=>l.kick()); });
  // Safety net if live updates drop: refresh when the tab comes back, and slowly while visible.
  document.addEventListener("visibilitychange",()=>{ if(!document.hidden) listeners.forEach(l=>l.kick()); });
  setInterval(()=>{ if(!document.hidden) listeners.forEach(l=>l.kick()); }, 120000);
  function listen(kind,key,fetcher,onNext,onErr){
    let last=null, t=0, stopped=false, busy=false, again=false;
    const run=async()=>{
      if(stopped) return; if(busy){ again=true; return; } busy=true;
      try{ const snap=await fetcher(); const sig=JSON.stringify(snap.raw); if(sig!==last){ last=sig; onNext(snap.out); } }
      catch(e){ if(onErr) onErr(mapErr(e)); }
      busy=false; if(again){ again=false; run(); }
    };
    const l={kind, path:kind==="doc"?key:null, col:kind==="col"?key:null, kick(){ clearTimeout(t); t=setTimeout(run,250); }};
    listeners.add(l); run();
    return ()=>{ stopped=true; listeners.delete(l); };
  }

  /* ---------- documents ---------- */
  async function getRow(path){ const {data,error}=await sb.from("docs").select("path,id,data").eq("path",path).maybeSingle(); if(error) throw error; return data; }
  function docRef(path){
    path=segs(path).join("/");
    const ref={
      id:lastOf(path), path,
      async get(){ try{ return docSnap(await getRow(path),path); }catch(e){ throw mapErr(e); } },
      async set(data){ const {error}=await sb.from("docs").upsert({path, col:parentOf(path), id:lastOf(path), data, updated_at:new Date().toISOString()}); if(error) throw mapErr(error); notify(path); },
      async update(data){ const {error}=await sb.rpc("doc_update",{p_path:path, p_patch:data}); if(error) throw mapErr(error); notify(path); },
      async delete(){ const {error}=await sb.from("docs").delete().eq("path",path); if(error) throw mapErr(error); notify(path); },
      async acquire(o){ o=o||{}; const {data,error}=await sb.rpc("doc_acquire",{p_path:path, p_holder:String(o.holder||rid()), p_ttl_ms:Number(o.ttlMs||1000)}); if(error) throw mapErr(error); return {acquired:!!data, holder:o.holder}; },
      collection(c){ return colRef(path+"/"+c); },
      onSnapshot(next,onErr){ return listen("doc",path,async()=>{ const r=await getRow(path); return {raw:r, out:docSnap(r,path)}; },next,onErr); }
    };
    return ref;
  }
  function colRef(col,q){
    col=segs(col).join("/"); q=q||{wh:[],ord:null,lim:null};
    const build=()=>{
      let qb=sb.from("docs").select("path,id,data").eq("col",col);
      q.wh.forEach(([f,op,v])=>{
        if(op==="array-contains") qb=qb.contains("data",{[f]:[v]});
        else if(op==="=="||op==="===") qb=qb.contains("data",{[f]:v});
        else if(op==="!=") qb=qb.not("data->>"+f,"eq",String(v));
        else if(op===">"||op===">="||op==="<"||op==="<="){ const m={">":"gt",">=":"gte","<":"lt","<=":"lte"}[op]; qb=qb.filter("data->>"+f,m,String(v)); }
      });
      if(q.ord) qb=qb.order("data->"+q.ord[0],{ascending:q.ord[1]!=="desc",nullsFirst:false}); else qb=qb.order("id",{ascending:true});
      qb=qb.limit(q.lim||1000);
      return qb;
    };
    const fetchRows=async()=>{ const {data,error}=await build(); if(error) throw error; return data||[]; };
    return {
      id:lastOf(col), path:col,
      doc(id){ return docRef(col+"/"+(id||rid())); },
      where(f,op,v){ return colRef(col,{...q,wh:[...q.wh,[f,op,v]]}); },
      orderBy(f,dir){ return colRef(col,{...q,ord:[f,dir||"asc"]}); },
      limit(n){ return colRef(col,{...q,lim:n}); },
      async get(){ try{ return querySnap(await fetchRows()); }catch(e){ throw mapErr(e); } },
      async add(data){ const r=docRef(col+"/"+rid()); await r.set(data); return r; },
      onSnapshot(next,onErr){ return listen("col",col,async()=>{ const rows=await fetchRows(); return {raw:rows, out:querySnap(rows)}; },next,onErr); }
    };
  }
  const db=Object.freeze({doc:docRef, collection:colRef});

  /* ---------- who is viewing ---------- */
  const sessionP=sb.auth.getSession().then(r=>r.data.session).catch(()=>null);
  let adminP=null;
  const profCache={};
  async function profiles(ids){
    ids=[...new Set((ids||[]).filter(Boolean))]; const need=ids.filter(i=>!profCache[i]);
    if(need.length){ try{ const {data}=await sb.from("docs").select("id,data").eq("col","profiles").in("id",need); (data||[]).forEach(r=>profCache[r.id]={name:r.data?.name||"", avatarUrl:r.data?.photo||""}); }catch(e){} need.forEach(i=>{ if(!profCache[i]) profCache[i]={name:"",avatarUrl:""}; }); }
    const out={}; ids.forEach(i=>out[i]={id:i,...profCache[i]}); return out;
  }
  async function makeUser(){
    const s=await sessionP; if(!s) return null;
    const u=s.user;
    return Object.freeze({
      async id(){ return u.id; },
      async me(){ const p=(await profiles([u.id]))[u.id]; return {id:u.id, name:p.name||u.user_metadata?.name||(u.email||"").split("@")[0], avatarUrl:p.avatarUrl||"", email:u.email}; },
      profiles,
      async isOwner(){ adminP=adminP||sb.rpc("is_admin").then(r=>!!r.data).catch(()=>false); return adminP; },
      async canEdit(){ return this.isOwner(); },
      async can(){ return true; },
      async search(qs){ const {data}=await sb.from("docs").select("id,data").eq("col","profiles").ilike("data->>name","%"+String(qs||"")+"%").limit(20); return (data||[]).map(r=>({id:r.id,name:r.data?.name||""})); }
    });
  }
  const userP=makeUser();
  window.claude={ use(name){ if(name==="db") return Promise.resolve(db); if(name==="user") return userP; return Promise.resolve(null); } };

  /* ---------- sign in / sign up ---------- */
  window.NH={
    sb, session:sessionP,
    async signIn(email,password){ const {error}=await sb.auth.signInWithPassword({email,password}); if(error) throw error; location.reload(); },
    async signUp(name,email,password){
      const {data,error}=await sb.auth.signUp({email,password,options:{data:{name}}}); if(error) throw error;
      if(!data.session) return "confirm";
      try{ await docRef("profiles/"+data.user.id).set({name, photo:"", updatedAt:new Date().toISOString()}); }catch(e){}
      location.reload(); return "ok";
    },
    async signOut(){ await sb.auth.signOut(); location.reload(); },
    async resetPassword(email){ const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+"/"}); if(error) throw error; },
    async setPassword(pw){ const {error}=await sb.auth.updateUser({password:pw}); if(error) throw error; }
  };
})();
