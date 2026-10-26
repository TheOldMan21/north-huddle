/* ===================== North Huddle: admin page (site owner only) ===================== */
const ADM={tab:"members", users:[], chat:[], leagues:[], loading:false, err:"", arm:null};
function admDate(t){ return t?fmtDate(t,{month:"short",day:"numeric",year:"numeric"}):"—"; }
function admAgo(t){ return t?ago(t):"never"; }
async function admLoad(){
  ADM.loading=true; ADM.err=""; renderAdmin();
  try{
    const [u,c,l]=await Promise.all([
      NH.sb.rpc("admin_users"),
      ACC.db.collection("chat").orderBy("t","desc").limit(150).get(),
      ACC.db.collection("leagues").get()
    ]);
    if(u.error) throw u.error;
    ADM.users=u.data||[]; ADM.chat=c.docs.map(d=>({id:d.id,...d.data()})); ADM.leagues=l.docs.map(d=>({id:d.id,...d.data()}));
  }catch(e){ ADM.err=/admin_users|function|not_admin|schema cache/i.test(String(e?.message||e))?"setup":String(e?.message||e); }
  ADM.loading=false; renderAdmin();
}
function admName(uid){ const u=ADM.users.find(x=>x.id===uid); return u?.name||(u?.email||"").split("@")[0]||personName(uid); }
function admAv(u){ return `<img class="av" src="${esc(u.photo||BLANK_AV)}" alt="">`; }
function admArm(key,label,armed){ return ADM.arm===key?`<button class="tbtn adm-danger" data-adm-go="${esc(key)}">Tap to confirm</button>`:`<button class="tbtn" data-adm-arm="${esc(key)}">${label}</button>`; }
function admMembers(){
  const now=Date.now(), wk=7*864e5, real=ADM.users.filter(u=>!/huddlebot@/i.test(u.email));
  const newWk=real.filter(u=>now-Date.parse(u.created_at)<wk).length, act=real.filter(u=>u.last_sign_in_at&&now-Date.parse(u.last_sign_in_at)<wk).length;
  const chatDay=ADM.chat.filter(m=>now-Date.parse(m.t)<864e5).length;
  const stats=`<div class="adm-stats">${[["Members",real.length],["New this week",newWk],["Active this week",act],["Chats today",chatDay]].map(([l,v])=>`<div class="adm-stat"><b class="num">${v}</b><span>${l}</span></div>`).join("")}</div>`;
  const rows=real.map(u=>`<div class="row adm-user">${admAv(u)}<div class="grow"><div class="t1">${esc(u.name||"(no name)")}${u.is_admin?' <span class="chip pos">ADMIN</span>':""}${u.banned?' <span class="chip live">BANNED</span>':""}</div>
      <div class="t2">${esc(u.email)}</div><div class="t2">Joined ${esc(admDate(u.created_at))} · Last visit ${esc(admAgo(u.last_sign_in_at))}</div>
      <div class="adm-badges"><span class="t2">Badges:</span>${[["vip","VIP"],["donor","Donor"]].map(([k,l])=>`<button class="adm-bt${(typeof BADGES!=="undefined"&&BADGES[u.id]?.[k])?" on":""}" data-admbadge="${k}" data-uid="${esc(u.id)}" aria-pressed="${!!(typeof BADGES!=="undefined"&&BADGES[u.id]?.[k])}">${k==="vip"?ICO_STAR:ICO_HEART}${l}</button>`).join("")}</div></div>
      ${u.is_admin?"":u.banned?`<button class="tbtn" data-adm-unban="${esc(u.id)}">Unban</button>`:admArm("ban:"+u.id,"Ban")}</div>`).join("");
  return stats+`<h2>Members</h2><div class="list">${rows||`<div class="card empty">No members yet. Share the site link with friends!</div>`}</div>
    <div class="foot">Banned members can still view the site but can't chat, post or play. To delete an account completely, use Supabase → Authentication → Users.</div>`;
}
function admChat(){
  const rows=ADM.chat.map(m=>`<div class="row"><div class="grow"><div class="t2"><b>${esc(admName(m.uid))}</b> · ${esc(admAgo(m.t))}</div><div class="t1 adm-msg">${esc(m.text)}</div></div>${admArm("msg:"+m.id,"Delete")}</div>`).join("");
  return `<h2>Fan chat · latest ${ADM.chat.length}</h2><div class="list">${rows||`<div class="card empty">No messages yet.</div>`}</div>`;
}
function admLeagues(){
  const rows=ADM.leagues.map(L=>`<div class="card adm-lg"><div class="adm-lg-h"><div><div class="t1">${esc(L.name||L.id)}</div><div class="t2">Code ${esc(L.id)} · ${esc(L.status||"setup")} · ${(L.members||[]).length}/${esc(L.size||"?")} teams</div></div>${admArm("lg:"+L.id,"Delete")}</div>
      <div class="t2">Commissioner: <b>${esc(admName(L.commish))}</b></div>
      <div class="adm-chips">${(L.members||[]).map(u=>`<span class="chip">${esc(L.teams?.[u]?.name||admName(u))} · ${esc(admName(u))}</span>`).join("")}</div></div>`).join("");
  return `<h2>Fantasy leagues</h2>${rows||`<div class="card empty">No leagues yet.</div>`}`;
}
function admPolls(){
  const ps=(typeof POLL!=="undefined"?POLL.polls:[]).slice().sort((a,b)=>String(b.t).localeCompare(String(a.t)));
  const form=`<form class="card adm-pollf" id="admPollForm"><div class="t1">New poll</div><input name="q" maxlength="120" placeholder="Question, e.g. Who's the MVP so far?" required>
    ${[1,2,3,4].map(i=>`<input name="o${i}" maxlength="60" placeholder="Answer ${i}${i>2?" (optional)":""}" ${i<=2?"required":""}>`).join("")}
    <button class="btn-gold" type="submit">Post poll</button><div class="t2">New polls show on everyone's Home page. Posting a new one replaces the current poll there.</div></form>`;
  const list=ps.map(p=>{ const vs=POLL.votes.filter(v=>v.poll===p.id), tot=vs.length;
    return `<div class="card adm-lg"><div class="adm-lg-h"><div><div class="t1">${esc(p.q)}</div><div class="t2">${tot} votes · ${p.open===false?"Closed":"Open"} · ${esc(admDate(p.t))}</div></div>${admArm("poll:"+p.id,"Delete")}</div>
      ${(p.options||[]).map((o,i)=>{ const n=vs.filter(v=>v.choice===i).length; return `<div class="t2">${esc(o)}: <b>${n}</b>${tot?` (${Math.round(n/tot*100)}%)`:""}</div>`; }).join("")}
      <button class="tbtn" data-pollopen="${esc(p.id)}" data-open="${p.open===false?"1":"0"}">${p.open===false?"Reopen":"Close voting"}</button></div>`; }).join("");
  return form+`<h2>Polls</h2>`+(list||`<div class="card empty">No polls yet.</div>`);
}
document.addEventListener("submit",async e=>{
  if(e.target.id!=="admPollForm") return; e.preventDefault(); e.stopImmediatePropagation();
  const f=e.target, q=f.q.value.trim(), options=[f.o1,f.o2,f.o3,f.o4].map(x=>x.value.trim()).filter(Boolean);
  if(!q||options.length<2) return toast("Add a question and at least two answers.");
  try{ for(const p of POLL.polls.filter(p=>p.open!==false)) await ACC.db.doc("polls/"+p.id).update({open:false});
    await ACC.db.collection("polls").add({q, options, open:true, t:nowIso()}); f.reset(); toast("Poll posted!"); }catch(err){ toast("Couldn't post the poll."); }
},true);
document.addEventListener("click",async e=>{ const b=e.target.closest("[data-pollopen]"); if(!b) return; try{ await ACC.db.doc("polls/"+b.dataset.pollopen).update({open:b.dataset.open==="1"}); }catch(err){ toast("Couldn't update the poll."); } });
function renderAdmin(){
  const ov=$("adminView"); if(!ov) return;
  const body=ov.querySelector(".adm-body");
  ov.querySelectorAll("[data-adm-tab]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.admTab===ADM.tab)));
  if(ADM.loading&&!ADM.users.length){ body.innerHTML=skelRows(5); return; }
  if(ADM.err==="setup"){ body.innerHTML=`<div class="card"><b>One-time setup needed.</b><p class="acct-p">Open github.com/TheOldMan21/north-huddle/blob/main/supabase/admin.sql, copy it, and run it in Supabase → SQL Editor → New query. Then tap Refresh.</p></div>`; return; }
  if(ADM.err){ body.innerHTML=`<div class="card empty">Couldn't load: ${esc(ADM.err)}</div>`; return; }
  body.innerHTML=ADM.tab==="members"?admMembers():ADM.tab==="chat"?admChat():ADM.tab==="polls"?admPolls():admLeagues();
}
function openAdmin(){
  let ov=$("adminView");
  if(!ov){
    ov=document.createElement("div"); ov.id="adminView"; ov.setAttribute("role","dialog"); ov.setAttribute("aria-label","Admin");
    ov.innerHTML=`<div class="adm-top"><div class="adm-title">Admin</div><button class="tbtn" data-adm-refresh="1">Refresh</button><button class="x" data-adm-close="1" aria-label="Close">×</button></div>
      <div class="auth-seg adm-tabs" role="group"><button data-adm-tab="members">Members</button><button data-adm-tab="chat">Chat</button><button data-adm-tab="leagues">Leagues</button><button data-adm-tab="polls">Polls</button></div>
      <div class="adm-body"></div>`;
    document.body.appendChild(ov);
  }
  ov.hidden=false; document.body.classList.add("adm-open"); closeSheet&&closeSheet(); admLoad();
}
function closeAdmin(){ const ov=$("adminView"); if(ov) ov.hidden=true; document.body.classList.remove("adm-open"); }
document.addEventListener("click",async e=>{
  const t=e.target;
  if(t.closest("[data-adm-open]")){ openAdmin(); return; }
  if(t.closest("[data-adm-close]")){ closeAdmin(); return; }
  if(t.closest("[data-adm-refresh]")){ admLoad(); return; }
  const tab=t.closest("[data-adm-tab]"); if(tab){ ADM.tab=tab.dataset.admTab; ADM.arm=null; renderAdmin(); return; }
  const arm=t.closest("[data-adm-arm]"); if(arm){ ADM.arm=arm.dataset.admArm; renderAdmin(); setTimeout(()=>{ if(ADM.arm===arm.dataset.admArm){ ADM.arm=null; renderAdmin(); } },4000); return; }
  const un=t.closest("[data-adm-unban]"); if(un){ const {error}=await NH.sb.from("banned").delete().eq("uid",un.dataset.admUnban); toast(error?"Couldn't unban.":"Member unbanned."); admLoad(); return; }
  const bd=t.closest("[data-admbadge]"); if(bd){ const k=bd.dataset.admbadge, uid=bd.dataset.uid, on=!BADGES[uid]?.[k]; try{ await setBadge(uid,k,on); toast(`${k==="vip"?"VIP":"Donor"} badge ${on?"added":"removed"}.`); }catch(err){ toast("Couldn't change the badge."); } return; }
  const go=t.closest("[data-adm-go]"); if(!go) return;
  const [kind,id]=go.dataset.admGo.split(/:(.+)/); ADM.arm=null;
  try{
    if(kind==="ban"){ const {error}=await NH.sb.from("banned").insert({uid:id}); if(error) throw error; toast("Member banned."); }
    else if(kind==="msg"){ await ACC.db.doc("chat/"+id).delete(); toast("Message deleted."); }
    else if(kind==="poll"){ await ACC.db.doc("polls/"+id).delete(); toast("Poll deleted."); }
    else if(kind==="lg"){ const ch=await ACC.db.collection("leagues/"+id+"/chat").get(); for(const d of ch.docs) await ACC.db.doc("leagues/"+id+"/chat/"+d.id).delete(); await ACC.db.doc("leagues/"+id).delete(); toast("League deleted."); }
  }catch(err){ toast("Couldn't do that: "+(err?.message||err)); }
  admLoad();
});
document.addEventListener("keydown",e=>{ if(e.key==="Escape"&&!$("adminView")?.hidden) closeAdmin(); });
// Admin button in the account sheet (owner only)
const _openAcctAdm=openAcct;
openAcct=function(){ _openAcctAdm(); if(ACC.id&&ACC.owner){ const out=$("sheet").querySelector("[data-signout]"); const b=`<button class="btn-gold adm-btn" data-adm-open="1">Open admin page</button>`; if(out) out.insertAdjacentHTML("beforebegin",b); else $("sheet").insertAdjacentHTML("beforeend",b); } };
if(location.hash==="#admin") accReady.then(()=>{ if(ACC.owner) openAdmin(); });
// Admin shortcut in the header, next to Update (owner only)
accReady.then(()=>{
  if(!ACC.owner || $("admHdrBtn")) return;
  $("refreshBtn")?.insertAdjacentHTML("beforebegin",`<button class="refresh adm-hdr" id="admHdrBtn" data-adm-open="1" aria-label="Admin page" title="Admin"><svg viewBox="0 0 24 24"><path d="M12 3l7 3v5c0 4.6-3 8.4-7 10-4-1.6-7-5.4-7-10V6z"/><path d="M9 12l2 2 4-4"/></svg></button>`);
});
