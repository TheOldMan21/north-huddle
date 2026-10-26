/* ===================== North Huddle round 3: spam filter, pick'em, power rankings, profiles, recaps, watch party ===================== */
const r3Week=()=>Number(LIVE.data?.week)||0;
const r3Win=x=>x&&x.state==="post"&&x.hs!==x.as?(x.hs>x.as?x.home:x.away):null;
const r3Locked=x=>!x||x.state!=="pre"||(x.kickoff&&Date.now()>=Date.parse(x.kickoff));
const r3Nick=a=>TEAMS[a]?.[1]||a;

/* ---------- 1. spam filter: no links, no repeats, no floods (bad language is fine) ---------- */
const SPAM={hist:[]};
const LINK_RE=/(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|gg|ly|co|xyz|me|tv|app|link|site|info|biz|ru|cn|shop|live|click)\b)/i;
function spamReason(text){
  if(ACC.owner) return "";
  const t=String(text||"").trim(); if(!t) return "";
  if(LINK_RE.test(t)) return "Links aren't allowed in chat or comments.";
  if(/(.)\1{24,}/.test(t)) return "That looks like spam. Try a shorter message.";
  const now=Date.now(), norm=t.toLowerCase().replace(/\s+/g," ");
  SPAM.hist=SPAM.hist.filter(h=>now-h.t<120e3);
  if(SPAM.hist.some(h=>h.n===norm&&now-h.t<90e3)) return "You just said that.";
  if(SPAM.hist.filter(h=>now-h.t<20e3).length>=5) return "Slow down a sec.";
  SPAM.hist.push({n:norm,t:now}); return "";
}
// runs before every chat/comment form handler (window capture fires first)
window.addEventListener("submit",e=>{
  const f=e.target; if(!(f instanceof HTMLFormElement)||!f.matches("form.chat-in")) return;
  const i=f.querySelector("input[type=text],input:not([type]),textarea"); if(!i) return;
  const why=spamReason(i.value); if(!why) return;
  e.preventDefault(); e.stopImmediatePropagation(); toast(why);
},true);

/* ---------- 2. pick'em: every NFL game, weekly + season leaderboards ---------- */
// pickem/pk-w<week>-<event>__<uid> = {uid, week, event, pick, t}
const PK={all:[], weeks:{}, loading:{}, week:0, lb:"week"};
function pkGames(w){ return w&&w===r3Week()?(LIVE.data?.games||[]):(PK.weeks[w]||null); }
async function pkLoad(w){
  if(!w||w===r3Week()||PK.weeks[w]||PK.loading[w]) return;
  try{ const c=JSON.parse(localStorage.getItem("nh_pkw"+w)||"null"); if(c){ PK.weeks[w]=c; return; } }catch(e){}
  PK.loading[w]=true;
  try{ const r=await fetch("/api/scores?week="+w); if(r.ok){ const d=await r.json(); PK.weeks[w]=d.games||[];
    if(PK.weeks[w].length&&PK.weeks[w].every(x=>x.state==="post")) try{ localStorage.setItem("nh_pkw"+w,JSON.stringify(PK.weeks[w])); }catch(e){} } }catch(e){}
  PK.loading[w]=false; pkRefresh();
}
function pkRefresh(){ if(S.tab==="games"&&GM.mode==="pickem") renderPickem(); if(!$("sheetBg").hidden&&PF.uid&&$("sheet").querySelector(".pf-card")) renderProfile(); if(S.tab==="home") placePickemCard(); }
function pkMine(id){ return PK.all.find(p=>String(p.event)===String(id)&&p.uid===ACC.id)?.pick; }
function pkTally(weeks){
  const t={};
  weeks.forEach(w=>{ (pkGames(w)||[]).forEach(x=>{ const win=r3Win(x); if(!win&&x.state!=="post") return;
    PK.all.filter(p=>String(p.event)===String(x.id)).forEach(p=>{ const r=t[p.uid]||(t[p.uid]={uid:p.uid,c:0,n:0}); r.n++; if(p.pick===win) r.c++; }); }); });
  return Object.values(t).sort((a,b)=>b.c-a.c||(b.c/b.n)-(a.c/a.n)||a.n-b.n);
}
function pkWeeksWithPicks(){ return [...new Set(PK.all.map(p=>Number(p.week)).filter(Boolean))].sort((a,b)=>a-b); }
function pkLbHtml(rows,limit){
  if(!rows.length) return `<div class="card empty">No finished games with picks yet.</div>`;
  return `<div class="list">${rows.slice(0,limit||25).map((r,i)=>`<div class="row${r.uid===ACC.id?" me-row":""}"><b class="num pred-rank">${i+1}</b>${av(r.uid)}<div class="grow"><div class="t1" data-uname="${esc(r.uid)}">${esc(personName(r.uid))}</div><div class="t2">${r.c}-${r.n-r.c} · ${Math.round(r.c/r.n*100)}%</div></div><b class="num">${r.c}</b></div>`).join("")}</div>`;
}
function pkRow(x){
  const locked=r3Locked(x), mine=pkMine(x.id), win=r3Win(x), picks=PK.all.filter(p=>String(p.event)===String(x.id)), n=picks.length;
  const pct=a=>n?Math.round(picks.filter(p=>p.pick===a).length/n*100):0;
  const side=(a,s)=>`<button class="pk-side${mine===a?" mine":""}${win===a?" won":""}" data-pkpick="${esc(x.id)}" data-pkteam="${esc(a)}" ${locked||!ACC.id?"disabled":""} aria-pressed="${mine===a}">${badge(a)}<span class="pk-nm">${esc(r3Nick(a))}</span>${x.state!=="pre"?`<b class="num">${esc(s)}</b>`:""}${n?`<span class="pk-pct num">${pct(a)}%</span>`:""}</button>`;
  const res=mine&&x.state==="post"?(mine===win?'<span class="chip pos">✓ Correct</span>':'<span class="chip l">✗ Missed</span>'):"";
  const when=x.state==="pre"?fmtDate(x.kickoff,{weekday:"short",hour:"numeric",minute:"2-digit"})+" CT":x.state==="in"?"LIVE · "+(x.detail||""):"Final";
  return `<div class="card pk-game"><div class="pk-meta"><span class="t2">${esc(when)}</span>${res}${locked&&x.state==="pre"?'<span class="t2">Locked</span>':""}</div><div class="pk-sides">${side(x.away,x.as)}<span class="pk-at">@</span>${side(x.home,x.hs)}</div></div>`;
}
function renderPickem(){
  const b=$("gmBody"); if(!b) return;
  const cw=r3Week(); if(!PK.week) PK.week=cw;
  const w=PK.week, gs=pkGames(w);
  if(!cw){ b.innerHTML=skelRows(4); return; }
  if(!gs){ pkLoad(w); b.innerHTML=`<div class="pk-nav">${pkNav(w,cw)}</div>`+skelRows(4); return; }
  const ord=x=>x.state==="pre"?0:x.state==="in"?1:2, list=gs.slice().sort((a,c)=>ord(a)-ord(c)||String(a.kickoff).localeCompare(String(c.kickoff)));
  const open=list.filter(x=>!r3Locked(x)), picked=list.filter(x=>pkMine(x.id)).length;
  if(PK.lb==="season") pkWeeksWithPicks().forEach(pkLoad);
  const rows=PK.lb==="season"?pkTally(pkWeeksWithPicks().concat(cw).filter((v,i,a)=>a.indexOf(v)===i)):pkTally([w]);
  b.innerHTML=`<div class="pk-nav">${pkNav(w,cw)}</div>
    <div class="card pk-sum"><div><div class="label">Pick'em · Week ${w}</div><div class="t1">${ACC.id?`You've picked ${picked} of ${list.length}`:"Pick the winner of every game"}</div><div class="t2">${open.length?`${open.length} ${open.length===1?"game":"games"} still open · each locks at kickoff`:"All games are locked for this week"} · 1 point per correct pick</div></div>${!ACC.id?`<button class="btn-gold" data-acct="1">Sign in to play</button>`:""}</div>
    <div class="pk-list">${list.map(pkRow).join("")||'<div class="card empty">No games this week.</div>'}</div>
    <div class="sb-head"><h2>Leaderboard</h2><div class="auth-seg">${[["week","Week "+w],["season","Season"]].map(([k,l])=>`<button data-pklb="${k}" aria-pressed="${PK.lb===k}">${esc(l)}</button>`).join("")}</div></div>${pkLbHtml(rows)}`;
}
function pkNav(w,cw){ return `<button class="tbtn" data-pkweek="${w-1}" ${w<=1?"disabled":""} aria-label="Previous week">‹</button><b>Week ${w}${w===cw?" · this week":""}</b><button class="tbtn" data-pkweek="${w+1}" ${w>=Math.min(cw+1,18)?"disabled":""} aria-label="Next week">›</button>`; }
document.addEventListener("click",async e=>{
  const wk=e.target.closest("[data-pkweek]"); if(wk&&!wk.disabled){ PK.week=Number(wk.dataset.pkweek); renderPickem(); return; }
  const lb=e.target.closest("[data-pklb]"); if(lb){ PK.lb=lb.dataset.pklb; renderPickem(); return; }
  if(e.target.closest("[data-pkgo]")){ setTab("games"); GM.mode="pickem"; store.set("vh_gmode","pickem"); PK.week=r3Week(); renderGames(); return; }
  const b=e.target.closest("[data-pkpick]"); if(!b||b.disabled) return;
  if(!ACC.db||!ACC.id) return openAcct();
  const id=b.dataset.pkpick, w=PK.week||r3Week(), x=(pkGames(w)||[]).find(g=>String(g.id)===id);
  if(r3Locked(x)) return toast("That game is locked.");
  const doc={uid:ACC.id, week:w, event:id, pick:b.dataset.pkteam, t:nowIso()}, path=`pickem/pk-w${w}-${id}__${ACC.id}`;
  const old=PK.all.find(p=>p.id===path.split("/")[1]); if(old) Object.assign(old,doc); else PK.all.push({id:path.split("/")[1],...doc}); renderPickem();
  try{ await ACC.db.doc(path).set(doc); }catch(err){ toast("Couldn't save your pick. Try again."); }
});
function pickemCardHtml(){
  const cw=r3Week(), gs=LIVE.data?.games||[]; if(!cw||!gs.length) return "";
  const open=gs.filter(x=>!r3Locked(x)), picked=gs.filter(x=>pkMine(x.id)).length, lead=pkTally([cw])[0];
  return `<section class="card pk-card" id="pkCard" style="order:7"><div class="pred-head"><div><div class="label">Pick'em · Week ${cw}</div><div class="t1">${ACC.id?(open.length?`You've picked ${picked} of ${gs.length} games`:`You went ${pkTally([cw]).find(r=>r.uid===ACC.id)?.c??0} for ${picked}`):"Pick every game this week"}</div>
    <div class="t2">${open.length?`${open.length} still open`:"All games locked"}${lead?` · Leader: <span data-uname="${esc(lead.uid)}">${esc(personName(lead.uid))}</span> (${lead.c})`:""}</div></div><button class="btn-gold" data-pkgo="1">${open.length&&ACC.id&&picked<gs.length?"Make picks":"View"}</button></div></section>`;
}
function placePickemCard(){ const el=$("v-home"); if(!el) return; el.querySelector("#pkCard")?.remove(); const h=pickemCardHtml(); if(!h) return; const a=el.querySelector("#pollCard")||el.querySelector("#predCard")||el.querySelector(".sb-row")||el.querySelector(".upd-line"); a?.insertAdjacentHTML("afterend",h); }

/* ---------- 3. fan power rankings (top-10 ballots, Borda count) ---------- */
// ranks/w<week>__<uid> = {uid, week, list:[abbr x10], t}
const RK={all:[], edit:null};
function rkWeekToShow(){ const cw=r3Week(); if(RK.all.some(r=>r.week===cw)) return cw; const ws=RK.all.map(r=>r.week).filter(w=>w<cw); return ws.length?Math.max(...ws):cw; }
function rkTable(w){
  const pts={}, firsts={}, ballots=RK.all.filter(r=>r.week===w);
  ballots.forEach(b=>(b.list||[]).slice(0,10).forEach((a,i)=>{ pts[a]=(pts[a]||0)+(10-i); if(!i) firsts[a]=(firsts[a]||0)+1; }));
  return {n:ballots.length, rows:Object.keys(pts).map(a=>({a,p:pts[a],f:firsts[a]||0})).sort((x,y)=>y.p-x.p||y.f-x.f)};
}
function renderRanks(){
  const b=$("gmBody"); if(!b) return;
  const cw=r3Week(), w=rkWeekToShow(), t=rkTable(w), prev=rkTable(w-1), prevPos=Object.fromEntries(prev.rows.map((r,i)=>[r.a,i+1]));
  const mine=RK.all.find(r=>r.week===cw&&r.uid===ACC.id);
  if(RK.edit){ b.innerHTML=rkEditor(); return; }
  const mv=(a,i)=>{ const p=prevPos[a]; if(!p) return prev.n?'<span class="rk-mv new">new</span>':""; const d=p-(i+1); return d>0?`<span class="rk-mv up">▲${d}</span>`:d<0?`<span class="rk-mv dn">▼${-d}</span>`:'<span class="rk-mv">–</span>'; };
  b.innerHTML=`<div class="card pk-sum"><div><div class="label">Fan power rankings · Week ${w}</div><div class="t1">${t.n?`Voted by ${t.n} ${t.n===1?"fan":"fans"}`:"No ballots yet this week"}</div><div class="t2">Rank your top 10. 1st gets 10 points, 10th gets 1.${w!==cw&&cw?` Week ${cw} voting is open.`:""}</div></div>
      <button class="btn-gold" data-rkedit="1">${mine?"Edit my ballot":"Vote"}</button></div>
    ${t.rows.length?`<div class="list rk-list">${t.rows.map((r,i)=>`<div class="row"><b class="num pred-rank">${i+1}</b>${badge(r.a)}<div class="grow"><div class="t1">${esc(TEAMS[r.a]?.[0]||"")} ${esc(r3Nick(r.a))}</div><div class="t2">${r.p} ${r.p===1?"pt":"pts"}${r.f?` · ${r.f} first-place ${r.f===1?"vote":"votes"}`:""}</div></div>${mv(r.a,i)}</div>`).join("")}</div>`:`<div class="card empty">Be the first to vote!</div>`}
    ${mine?`<div class="foot">Your ballot: ${mine.list.map((a,i)=>`${i+1}. ${esc(a)}`).join(" · ")}</div>`:""}`;
}
function rkEditor(){
  const L=RK.edit;
  const all=Object.keys(TEAMS).sort((a,b)=>r3Nick(a).localeCompare(r3Nick(b)));
  return `<div class="card rk-ed"><div class="pred-head"><div><div class="label">Your top 10 · Week ${r3Week()}</div><div class="t1">${L.length<10?`Tap teams in order (${L.length}/10)`:"Looks good? Save it."}</div></div><button class="tbtn" data-rkcancel="1">Cancel</button></div>
    <ol class="rk-ballot">${Array.from({length:10},(_,i)=>L[i]?`<li>${badge(L[i])}<span class="grow">${esc(r3Nick(L[i]))}</span>${i?`<button class="tbtn" data-rkup="${i}" aria-label="Move up">↑</button>`:""}<button class="tbtn" data-rkrm="${i}" aria-label="Remove">×</button></li>`:`<li class="rk-empty">—</li>`).join("")}</ol>
    <div class="rk-pool">${all.map(a=>`<button class="rk-team${L.includes(a)?" on":""}" data-rkadd="${esc(a)}" ${L.includes(a)||L.length>=10?"disabled":""}>${badge(a)}<span>${esc(r3Nick(a))}</span></button>`).join("")}</div>
    <button class="btn-gold" data-rksave="1" ${L.length<10?"disabled":""}>Save ballot</button></div>`;
}
document.addEventListener("click",async e=>{
  if(e.target.closest("[data-rkedit]")){ if(!ACC.db||!ACC.id) return openAcct(); const m=RK.all.find(r=>r.week===r3Week()&&r.uid===ACC.id); RK.edit=m?m.list.slice():[]; renderRanks(); return; }
  if(!RK.edit) return;
  if(e.target.closest("[data-rkcancel]")){ RK.edit=null; renderRanks(); return; }
  const ad=e.target.closest("[data-rkadd]"); if(ad&&!ad.disabled){ RK.edit.push(ad.dataset.rkadd); renderRanks(); return; }
  const rm=e.target.closest("[data-rkrm]"); if(rm){ RK.edit.splice(Number(rm.dataset.rkrm),1); renderRanks(); return; }
  const up=e.target.closest("[data-rkup]"); if(up){ const i=Number(up.dataset.rkup); [RK.edit[i-1],RK.edit[i]]=[RK.edit[i],RK.edit[i-1]]; renderRanks(); return; }
  if(e.target.closest("[data-rksave]")&&RK.edit.length===10){
    const w=r3Week(), doc={uid:ACC.id, week:w, list:RK.edit.slice(), t:nowIso()};
    try{ await ACC.db.doc(`ranks/w${w}__${ACC.id}`).set(doc); const o=RK.all.find(r=>r.week===w&&r.uid===ACC.id); if(o) Object.assign(o,doc); else RK.all.push(doc); RK.edit=null; renderRanks(); toast("Ballot saved!"); }
    catch(err){ toast("Couldn't save. Try again."); }
  }
});

/* ---------- Schedule tab: add Pick'em + Rankings ---------- */
gmSeg=function(){ return `<div class="seg gm-seg" role="group" aria-label="Schedule view">${[["team",NICK()],["scores","Scores"],["pickem","Pick'em"],["standings","Standings"],["ranks","Rankings"]].map(([k,l])=>`<button data-gmode="${k}" aria-pressed="${GM.mode===k}">${esc(l)}</button>`).join("")}</div>`; };
const _renderGamesR3=renderGames;
renderGames=function(){
  if(GM.mode!=="pickem"&&GM.mode!=="ranks") return _renderGamesR3();
  const el=$("v-games"); if(!el) return;
  el.innerHTML=gmSeg()+`<div id="gmBody" class="stack"></div>`;
  if(GM.mode==="pickem") renderPickem(); else renderRanks();
  el.querySelector(".gm-seg [aria-pressed=true]")?.scrollIntoView?.({block:"nearest",inline:"center"});
};
const _pollLiveR3=pollLive;
pollLive=async function(){ await _pollLiveR3(); if(S.tab==="games"&&GM.mode==="pickem"&&!$("gmBody")?.contains(document.activeElement)) renderPickem(); if(WPV.open) wpvRender(); if(S.tab==="home") placeRecapCard(); };

/* ---------- 4. member profiles ---------- */
// profiles/<uid> also holds {bio, fav} — shown when anyone taps a name or photo
const PFX={}, PF={uid:null, leagues:null};
function r3Called(uid){ // "who wins?" picks for the current team's games
  const games=Object.fromEntries(S.games.map(g=>[gameKey(g),g])); let c=0,n=0;
  PRED.all.forEach(p=>{ if(p.uid!==uid||p.kind!=="pick") return; const g=games[p.game]; if(!g||g.status!=="final"||g.us==null||g.us===g.them) return; n++; if(p.pick===(g.us>g.them?CUR:g.oppAbbr)) c++; });
  return {c,n};
}
function r3PredRank(uid){
  const games=Object.fromEntries(S.games.map(g=>[gameKey(g),g])), tot={};
  PRED.all.forEach(p=>{ if(p.kind==="pick") return; const sc=predScore(p,games[p.game]); if(sc==null) return; tot[p.uid]=(tot[p.uid]||0)+sc; });
  const rows=Object.entries(tot).sort((a,b)=>b[1]-a[1]), i=rows.findIndex(r=>r[0]===uid);
  return i<0?null:{rank:i+1, of:rows.length, pts:rows[i][1]};
}
function openProfile(uid){
  if(!uid) return; PF.uid=uid; PF.leagues=null; renderProfile(); $("sheetBg").hidden=false;
  pkWeeksWithPicks().forEach(pkLoad);
  if(ACC.db) ACC.db.collection("leagues").where("members","array-contains",uid).get().then(s=>{ PF.leagues=s.docs.map(d=>({id:d.id,...d.data()})); if(PF.uid===uid&&!$("sheetBg").hidden&&$("sheet").querySelector(".pf-card")) renderProfile(); }).catch(()=>{ PF.leagues=[]; });
}
function renderProfile(){
  const uid=PF.uid; if(!uid) return;
  const x=PFX[uid]||{}, me=uid===ACC.id, bl=badgeList(uid);
  const pk=pkTally(pkWeeksWithPicks().concat(r3Week()).filter((v,i,a)=>v&&a.indexOf(v)===i)), pki=pk.findIndex(r=>r.uid===uid), pkr=pk[pki];
  const cl=r3Called(uid), pr=r3PredRank(uid);
  const stat=(v,l)=>`<div class="adm-stat"><b class="num">${v}</b><span>${l}</span></div>`;
  const lgs=PF.leagues==null?`<div class="t2">Loading…</div>`:PF.leagues.length?PF.leagues.map(L=>`<div class="row"><div class="grow"><div class="t1">${esc(L.teams?.[uid]?.name||"Team")}</div><div class="t2">${esc(L.name||"League")}</div></div></div>`).join(""):`<div class="t2">Not in a fantasy league yet.</div>`;
  $("sheet").innerHTML=`<div class="sheet-head"><div class="label">Fan profile</div><button class="x" id="closeSheet" aria-label="Close">×</button></div>
    <div class="pf-card"><img class="pf-big${BADGES[uid]?.vip?" av-vip":""}" src="${esc(PUB[uid]?.photo||PROF[uid]?.avatarUrl||(me&&ACC.me?.avatarUrl)||BLANK_AV)}" alt="">
      <div class="pf-info"><div class="nm pf-nm">${esc(personName(uid))}</div>${bl.length?`<div class="pf-badges">${bl.map(b=>`<span class="nb nb-${b.k}" title="${esc(b.title)}">${b.ico}<span>${esc(b.label||b.title)}</span></span>`).join("")}</div>`:""}
      ${x.fav?`<div class="t2">Favorite player: <b>${esc(x.fav)}</b></div>`:""}</div></div>
    ${x.bio?`<p class="pf-bio">${esc(x.bio)}</p>`:me?`<p class="t2">Add a bio and favorite player from your account (person icon).</p>`:""}
    <div class="adm-stats pf-stats">${stat(pkr?`${pkr.c}-${pkr.n-pkr.c}`:"–","Pick'em record")}${stat(pkr?"#"+(pki+1):"–","Pick'em rank")}${stat(cl.n?`${cl.c}/${cl.n}`:"–",`${esc(NICK())} winners called`)}${stat(pr?`#${pr.rank}`:"–",pr?`Score predictions · ${pr.pts} pts`:"Score predictions")}</div>
    <h2>Fantasy leagues</h2><div class="list">${lgs}</div>
    ${me?`<button class="tbtn" data-pfedit="1">Edit my profile</button>`:""}`;
}
document.addEventListener("click",e=>{
  if(e.target.closest("[data-pfedit]")){ openAcct(); setTimeout(()=>$("pfBio")?.querySelector("input")?.focus(),50); return; }
  if(e.target.closest("#adminView,.pf-edit,.pf-card,#acctBtn,form,button,a")) return;
  const n=e.target.closest("[data-uname],img.av[data-uid]"); if(!n) return;
  const uid=n.dataset.uname||n.dataset.uid; if(!uid) return;
  e.preventDefault(); e.stopPropagation(); openProfile(uid);
},true);
// keep bio + favorite player when the photo or name is saved
savePub=async function(patch){
  const cur={...(PFX[ACC.id]||{}), ...(PUB[ACC.id]||{})};
  const doc={photo:cur.photo||"", name:cur.name||"", bio:cur.bio||"", fav:cur.fav||"", ...patch, updatedAt:nowIso()};
  await ACC.db.doc("profiles/"+ACC.id).set(doc); PFX[ACC.id]={...doc};
};
const _openAcctR3=openAcct;
openAcct=function(){
  _openAcctR3();
  if(!ACC.id||!ACC.db) return;
  const sh=$("sheet"), pe=sh.querySelector(".pf-edit"); if(!pe||sh.querySelector("#pfBio")) return;
  const x=PFX[ACC.id]||{};
  pe.insertAdjacentHTML("afterend",`<form id="pfBio" class="card pf-bioform"><label class="t2">Favorite player<input name="fav" maxlength="40" value="${esc(x.fav||"")}" placeholder="e.g. your all-time favorite"></label>
    <label class="t2">Bio<textarea name="bio" maxlength="160" rows="2" placeholder="A line about you as a fan">${esc(x.bio||"")}</textarea></label>
    <div class="pa-btns"><button class="tbtn" type="submit">Save profile</button><button class="tbtn" type="button" data-pfview="1">View my profile</button></div></form>`);
};
document.addEventListener("click",e=>{ if(e.target.closest("[data-pfview]")) openProfile(ACC.id); });
document.addEventListener("submit",async e=>{
  if(e.target.id!=="pfBio") return; e.preventDefault(); e.stopImmediatePropagation();
  const fd=new FormData(e.target), fav=String(fd.get("fav")||"").trim().slice(0,40), bio=String(fd.get("bio")||"").trim().slice(0,160);
  if(LINK_RE.test(fav+" "+bio)&&!ACC.owner) return toast("Links aren't allowed in profiles.");
  try{ await savePub({fav,bio}); toast("Profile saved."); }catch(err){ toast("Couldn't save. Try again."); }
},true);

/* ---------- 5. AI game recaps (Home + game sheet) ---------- */
const RCP={};
async function getRecap(id){
  if(!id||RCP[id]) return RCP[id];
  RCP[id]="loading";
  try{ const r=await fetch("/api/recap?event="+encodeURIComponent(id)); const d=r.ok?await r.json():null; RCP[id]=d?.final&&d.recap?d:"none"; }catch(e){ RCP[id]="none"; }
  if(S.tab==="home") placeRecapCard(); if(GM.sheet&&String(GM.sheet.id)===String(id)) renderGameSheet();
  return RCP[id];
}
function lastFinalId(){
  const lg=liveFor(CUR); if(lg&&lg.state==="post") return {id:lg.id, week:LIVE.data?.week};
  const g=S.games.filter(g=>g.status==="final"&&g.espnId&&g.kickoff&&Date.now()-Date.parse(g.kickoff)<8*864e5).sort((a,b)=>Date.parse(b.kickoff)-Date.parse(a.kickoff))[0];
  return g?{id:g.espnId, week:g.week}:null;
}
function placeRecapCard(){
  const el=$("v-home"); if(!el||!S.meta) return;
  const f=lastFinalId(), old=el.querySelector("#rcpCard");
  if(!f||liveGameNow()){ old?.remove(); return; }
  const d=RCP[f.id]; if(!d){ getRecap(f.id); return; }
  if(typeof d!=="object"){ old?.remove(); return; }
  const html=`<section class="card rcp-card" id="rcpCard" style="order:6"><div class="pred-head"><div><div class="label">${ICO_RCP} Game recap${f.week?` · Week ${esc(f.week)}`:""}</div><div class="t1">${esc(d.title)}</div></div><button class="tbtn" data-sbgame="${esc(d.event)}">Box score</button></div>${d.recap.split(/\n+/).map(p=>`<p class="rcp-p">${esc(p)}</p>`).join("")}<div class="t2">Written by Huddle AI from the official play-by-play.</div></section>`;
  if(old){ if(old.outerHTML!==html) old.outerHTML=html; return; }
  const a=el.querySelector(".sb-row")||el.querySelector(".upd-line"); a?.insertAdjacentHTML("afterend",html);
}
const ICO_RCP=`<svg viewBox="0 0 24 24" aria-hidden="true" class="ico-spark"><path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8z"/></svg>`;
const _renderGameSheetR3=renderGameSheet;
renderGameSheet=function(){
  _renderGameSheetR3();
  const s=GM.sheet; if(!s) return;
  const x=(s.data?.games||LIVE.data?.games||[]).find(g=>String(g.id)===String(s.id)); if(!x||x.state!=="post") return;
  const d=RCP[s.id]; if(!d){ getRecap(s.id); }
  const sec=typeof d==="object"?`<div class="gs-sec rcp-sec"><div class="label">${ICO_RCP} Recap</div>${d.recap.split(/\n+/).map(p=>`<p class="rcp-p">${esc(p)}</p>`).join("")}</div>`:d==="loading"||!d?`<div class="gs-sec rcp-sec"><div class="label">${ICO_RCP} Recap</div><div class="t2">Writing the recap…</div></div>`:"";
  const hd=$("sheet").querySelector(".sheet-head"); if(sec&&hd) hd.insertAdjacentHTML("afterend",sec);
};

/* ---------- 6. watch party: full-screen field + score + plays + game chat ---------- */
const WPV={open:false, el:null, sig:"", t:0, last:0};
function wpvGame(){ return liveGameNow()||soonGame(); }
function wpvOpen(){
  const g=wpvGame(); if(!g) return toast("Watch party opens on game day.");
  gxSubscribe(gameKey(g));
  if(!WPV.el){
    const el=document.createElement("div"); el.id="wpv"; el.setAttribute("role","dialog"); el.setAttribute("aria-label","Watch party");
    el.innerHTML=`<div class="wpv-game"></div><div class="wpv-chat"><div class="wpv-ch"><b>Game chat</b><span class="t2 wpv-n"></span><button class="x" data-wpvx="1" aria-label="Close watch party">×</button></div><div class="fc-list wpv-list"></div><div class="wpv-in"></div></div>`;
    el.addEventListener("submit",async e=>{
      if(!e.target.closest(".wpv-form")) return; e.preventDefault();
      const i=e.target.querySelector("input"), t=(i.value||"").trim().slice(0,300); if(!t||!GX.key) return;
      if(Date.now()-WPV.last<2000) return toast("Slow down a sec.");
      WPV.last=Date.now(); i.value="";
      try{ await ACC.db.collection("gamechat").add({uid:ACC.id, game:GX.key, text:t, t:nowIso()}); }catch(err){ toast("Couldn't send. Try again."); }
    });
    el.addEventListener("click",e=>{ if(e.target.closest("[data-wpvx]")) wpvClose(); });
    document.body.appendChild(el); WPV.el=el;
  }
  WPV.open=true; WPV.sig=""; WPV.el.hidden=false; document.body.classList.add("wpv-on");
  WPV.el.querySelector(".wpv-in").innerHTML=ACC.id?`<form class="chat-in fc-form wpv-form">${av(ACC.id,"me")}<input maxlength="300" autocomplete="off" placeholder="React to the game…" aria-label="Game chat message"><button class="tbtn" type="submit">Send</button></form>`:`<button class="btn-gold" data-acct="1">Sign in to chat</button>`;
  try{ const p=WPV.el.requestFullscreen?.(); p?.then?.(()=>screen.orientation?.lock?.("landscape").catch(()=>{})).catch(()=>{}); }catch(e){}
  wpvRender(); clearInterval(WPV.t); WPV.t=setInterval(wpvChat,1500); wpvChat(true);
}
function wpvClose(){
  WPV.open=false; clearInterval(WPV.t); if(WPV.el) WPV.el.hidden=true; document.body.classList.remove("wpv-on");
  try{ screen.orientation?.unlock?.(); }catch(e){} if(document.fullscreenElement) document.exitFullscreen().catch(()=>{});
}
document.addEventListener("fullscreenchange",()=>{ if(!document.fullscreenElement&&WPV.open&&WPV.wasFs) wpvClose(); WPV.wasFs=!!document.fullscreenElement; });
document.addEventListener("keydown",e=>{ if(e.key==="Escape"&&WPV.open) wpvClose(); });
function wpvRender(){
  if(!WPV.open||!WPV.el) return;
  const g=wpvGame()||S.games.find(x=>gameKey(x)===GX.key); const box=WPV.el.querySelector(".wpv-game"); if(!g){ box.innerHTML=`<div class="gx-empty">The game has ended.</div>`; return; }
  const lg=liveFor(CUR), live=g.status==="live";
  const us=live||g.status==="final"?g.us:"", them=live||g.status==="final"?g.them:"";
  const plays=(LIVE.data?.focus?.plays||[]).slice(0,6).map(p=>`<div class="gx-play${p.scoring?" gx-score":""}"><div class="gx-pm">Q${esc(p.q)} ${esc(p.clock)}${p.team?` · ${esc(p.team)}`:""}${p.dd?` · ${esc(p.dd)}`:""}</div><div class="gx-pt">${esc(p.text)}</div></div>`).join("");
  box.innerHTML=`<div class="wpv-score">${badge(CUR,true)}<b class="num">${esc(us)}</b><div class="wpv-mid"><span class="chip ${live?"live":"new"}">${live?"LIVE":"SOON"}</span><span class="t2">${esc(lg?.detail||fmtDate(g.kickoff,{hour:"numeric",minute:"2-digit"})+" CT")}</span></div><b class="num">${esc(them)}</b>${badge(g.oppAbbr,true)}</div>
    ${g.field?fieldHtml(g.field):`<div class="gx-empty">${live?"Waiting for the next snap…":"The live field shows up at kickoff."}</div>`}
    ${wpHtml()}${plays?`<div class="wpv-plays"><div class="label">Latest plays</div>${plays}</div>`:""}`;
}
function wpvChat(force){
  if(!WPV.open) return;
  const m=GX.msgs, sig=m.length+":"+(m[m.length-1]?.id||"")+":"+Object.keys(PUB).length; if(!force&&sig===WPV.sig) return; WPV.sig=sig;
  const l=WPV.el.querySelector(".wpv-list"), atBottom=l.scrollHeight-l.scrollTop-l.clientHeight<40;
  l.innerHTML=m.length?m.map(x=>`<div class="fc-msg${x.uid===ACC.id?" me":""}" data-mid="${esc(x.id)}" data-mcol="gamechat">${av(x.uid)}<div class="fc-body"><div class="fc-who"><b data-uname="${esc(x.uid)}">${esc(personName(x.uid))}</b> · ${esc(ago(x.t))}</div><div class="fc-text">${esc(x.text)}</div></div></div>`).join(""):`<div class="fc-empty">Game chat is open. Say something!</div>`;
  WPV.el.querySelector(".wpv-n").textContent=m.length?`${m.length} messages`:"";
  if(atBottom||force) l.scrollTop=l.scrollHeight;
  if(typeof decorateReactions==="function") decorateReactions(l);
}
document.addEventListener("click",e=>{ if(e.target.closest("[data-wparty]")){ e.preventDefault(); wpvOpen(); } });
const _renderHomeR3=renderHome;
renderHome=function(){
  _renderHomeR3();
  if(!S.meta) return;
  const top=$("v-home")?.querySelector(".gameday .gd-top"); if(top&&!top.querySelector("[data-wparty]")) top.insertAdjacentHTML("beforeend",`<button class="wpv-btn" data-wparty="1" aria-label="Open watch party mode">${ICO_TV}<span>Watch party</span></button>`);
  placeRecapCard(); placePickemCard();
};
const ICO_TV=`<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="5" width="19" height="12.5" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 21h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;

/* ---------- live data subscriptions ---------- */
(async()=>{
  await accReady; if(!ACC.db) return;
  ACC.db.collection("pickem").orderBy("t","desc").limit(5000).onSnapshot(s=>{ PK.all=s.docs.map(d=>({id:d.id,...d.data()})); pkRefresh(); },e=>console.warn("pickem",e));
  ACC.db.collection("ranks").orderBy("t","desc").limit(3000).onSnapshot(s=>{ RK.all=s.docs.map(d=>({id:d.id,...d.data()})); if(S.tab==="games"&&GM.mode==="ranks"&&!RK.edit) renderRanks(); },e=>console.warn("ranks",e));
  ACC.db.collection("profiles").onSnapshot(s=>{ s.docs.forEach(d=>{ const x=d.data(); PFX[d.id]={bio:x.bio||"", fav:x.fav||""}; }); if(PF.uid&&!$("sheetBg").hidden&&$("sheet").querySelector(".pf-card")) renderProfile(); },e=>console.warn("profiles",e));
  if(S.tab==="home") renderHome();
})();
