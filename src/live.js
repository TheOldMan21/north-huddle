/* ===================== North Huddle: live game extras, game chat, predictions ===================== */

/* ---------- helpers ---------- */
function liveGameNow(){ return S.games.find(g=>g.status==="live")||null; }
function soonGame(){ const now=Date.now(); return S.games.find(g=>g.status==="scheduled"&&g.kickoff&&Date.parse(g.kickoff)-now<8*36e5&&now-Date.parse(g.kickoff)<4.5*36e5)||null; }
function gameKey(g){ return g?(CUR.toLowerCase()+"-"+g.id):""; }
function nextGameForPred(){ const now=Date.now(); const up=S.games.filter(g=>g.status==="scheduled"&&g.kickoff&&Date.parse(g.kickoff)>now-4.5*36e5).sort((a,b)=>Date.parse(a.kickoff)-Date.parse(b.kickoff)); return liveGameNow()||up[0]||null; }
function oppName(g){ return g?.opp||TEAMS[g?.oppAbbr]?.[1]||g?.oppAbbr||"Opponent"; }

/* ---------- win probability ---------- */
function wpHtml(){
  const w=LIVE.data?.focus?.wp; if(!w||!w.pts?.length) return "";
  const home=w.home===CUR, us=p=>home?p:1-p, now=us(w.now), opp=home?w.away:w.home;
  const pct=Math.round(now*100), pts=w.pts.map(us), n=pts.length;
  const path=pts.map((p,i)=>`${i?"L":"M"}${(n===1?100:i/(n-1)*100).toFixed(1)} ${(24-p*24).toFixed(1)}`).join(" ");
  return `<div class="gd-sec gd-wp"><div class="label">Win probability</div>
    <div class="wp-bar" role="img" aria-label="${esc(CUR)} ${pct}% to win"><span class="wp-us" style="width:${pct}%"></span></div>
    <div class="wp-lab"><b>${esc(CUR)} ${pct}%</b><span>${esc(opp)} ${100-pct}%</span></div>
    <svg class="wp-spark" viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true"><line x1="0" y1="12" x2="100" y2="12" class="wp-mid"/><path d="${path}" class="wp-line"/></svg></div>`;
}

/* ---------- persistent tab panel: Plays | Box score | Game chat ---------- */
const GX={el:null, tab:store.get("vh_gxtab")||"plays", boxTeam:null, allPlays:false, pending:false, key:"", unsub:null, msgs:[], last:0};
function gxEl(){
  if(GX.el) return GX.el;
  const s=document.createElement("div"); s.className="gx"; s.id="gx";
  s.innerHTML=`<div class="gx-seg" role="tablist"></div><div class="gx-pane"></div>`;
  s.addEventListener("click",async e=>{
    const t=e.target.closest("[data-gxtab]"); if(t){ GX.tab=t.dataset.gxtab; store.set("vh_gxtab",GX.tab); renderGX(); return; }
    const b=e.target.closest("[data-gxbox]"); if(b){ GX.boxTeam=b.dataset.gxbox; renderGX(); return; }
    if(e.target.closest("[data-gxall]")){ GX.allPlays=!GX.allPlays; renderGX(); return; }
    const d=e.target.closest("[data-gcdel]"); if(d&&(ACC.owner||GX.msgs.find(m=>m.id===d.dataset.gcdel)?.uid===ACC.id)){ try{ await ACC.db.doc("gamechat/"+d.dataset.gcdel).delete(); }catch(err){} }
  });
  s.addEventListener("submit",async e=>{
    e.preventDefault(); e.stopImmediatePropagation();
    const i=s.querySelector(".gc-form input"); const t=(i?.value||"").trim().slice(0,300); if(!t) return;
    if(Date.now()-GX.last<2000) return toast("Slow down a sec.");
    GX.last=Date.now(); i.value="";
    try{ await ACC.db.collection("gamechat").add({uid:ACC.id, game:GX.key, text:t, t:nowIso()}); }catch(err){ toast("Couldn't send. Try again."); }
  },true);
  s.addEventListener("focusout",()=>setTimeout(()=>{ if(GX.pending && !s.contains(document.activeElement)){ GX.pending=false; renderHome(); } },150));
  GX.el=s; return s;
}
function gxSubscribe(key){
  if(key===GX.key) return; GX.key=key; GX.msgs=[];
  if(GX.unsub){ GX.unsub(); GX.unsub=null; }
  if(!key||!ACC.db) return;
  GX.unsub=ACC.db.collection("gamechat").where("game","==",key).orderBy("t","desc").limit(80).onSnapshot(s=>{ GX.msgs=s.docs.map(d=>({id:d.id,...d.data()})).reverse(); if(GX.tab==="chat") renderGX(true); },e=>console.warn("gamechat",e));
}
function playsHtml(){
  const pl=LIVE.data?.focus?.plays||[];
  if(!pl.length) return `<div class="gx-empty">Plays show up here once the game starts.</div>`;
  const list=(GX.allPlays?pl:pl.slice(0,8)).map(p=>`<div class="gx-play${p.scoring?" gx-score":""}"><div class="gx-pm">Q${esc(p.q)} ${esc(p.clock)}${p.team?` · ${esc(p.team)}`:""}${p.dd?` · ${esc(p.dd)}`:""}${p.scoring?' · <b>SCORE</b>':""}</div><div class="gx-pt">${esc(p.text)}</div></div>`).join("");
  return list+(pl.length>8?`<button class="tbtn gx-more" data-gxall="1">${GX.allPlays?"Show fewer":"Show all "+pl.length+" plays"}</button>`:"");
}
function boxHtml(){
  const box=LIVE.data?.focus?.box||[];
  if(!box.length) return `<div class="gx-empty">The box score shows up once the game starts.</div>`;
  const teams=box.map(b=>b.team); if(!GX.boxTeam||!teams.includes(GX.boxTeam)) GX.boxTeam=teams.includes(CUR)?CUR:teams[0];
  const t=box.find(b=>b.team===GX.boxTeam)||box[0];
  const names={passing:"Passing",rushing:"Rushing",receiving:"Receiving"};
  const tables=Object.entries(names).map(([k,label])=>{ const c=t.cats?.[k]; if(!c||!c.rows?.length) return "";
    return `<table class="gx-box"><thead><tr><th>${label}</th>${c.labels.map(l=>`<th>${esc(l)}</th>`).join("")}</tr></thead><tbody>${c.rows.map(r=>`<tr><td>${esc(r.name)}</td>${r.stats.map(v=>`<td class="num">${esc(v)}</td>`).join("")}</tr>`).join("")}</tbody></table>`; }).join("");
  return `<div class="gx-teams">${teams.map(a=>`<button data-gxbox="${esc(a)}" aria-pressed="${a===GX.boxTeam}">${esc(a)}</button>`).join("")}</div>${tables||`<div class="gx-empty">No stats yet.</div>`}`;
}
function gameChatHtml(){
  if(!ACC.db||!ACC.id) return `<div class="gx-empty">Talk about the game live with everyone watching.</div><button class="btn-gold" data-acct="1">Sign in to chat</button>`;
  const list=GX.msgs.length?GX.msgs.map(m=>`<div class="fc-msg${m.uid===ACC.id?" me":""}" data-mid="${esc(m.id)}" data-mcol="gamechat">${av(m.uid)}<div class="fc-body"><div class="fc-who"><b data-uname="${esc(m.uid)}">${esc(personName(m.uid))}</b> · ${esc(ago(m.t))}${ACC.owner||m.uid===ACC.id?` <button class="fc-del" data-gcdel="${esc(m.id)}" aria-label="Delete message">×</button>`:""}</div><div class="fc-text">${esc(m.text)}</div></div></div>`).join("")
    :`<div class="fc-empty">Game chat is open. Say something!</div>`;
  return `<div class="fc-list gc-list" id="gcList">${list}</div><form class="chat-in fc-form gc-form">${av(ACC.id,"me")}<input maxlength="300" autocomplete="off" placeholder="React to the game…" aria-label="Game chat message"><button class="tbtn" type="submit">Send</button></form>`;
}
function renderGX(chatOnly){
  const s=gxEl(), live=!!liveGameNow();
  const tabs=live?[["plays","Plays"],["box","Box score"],["chat","Game chat"]]:[["chat","Game chat"]];
  if(!tabs.some(t=>t[0]===GX.tab)) GX.tab=tabs[0][0];
  s.querySelector(".gx-seg").innerHTML=tabs.map(([k,l])=>`<button role="tab" data-gxtab="${k}" aria-selected="${GX.tab===k}">${l}${k==="chat"&&GX.msgs.length?` <span class="gx-n">${GX.msgs.length}</span>`:""}</button>`).join("");
  const pane=s.querySelector(".gx-pane");
  if(GX.tab==="chat"){
    const inp=pane.querySelector(".gc-form input"), keep=inp&&document.activeElement===inp, val=inp?.value||"";
    const lst=pane.querySelector("#gcList"), atBottom=!lst||lst.scrollHeight-lst.scrollTop-lst.clientHeight<40;
    pane.innerHTML=gameChatHtml();
    const ni=pane.querySelector(".gc-form input"); if(ni){ ni.value=val; if(keep) ni.focus(); }
    const nl=pane.querySelector("#gcList"); if(nl&&atBottom) nl.scrollTop=nl.scrollHeight;
    if(typeof decorateReactions==="function") decorateReactions(pane);
  } else if(!chatOnly){ pane.innerHTML=GX.tab==="box"?boxHtml():playsHtml(); }
}

/* ---------- predictions ---------- */
const PRED={all:[], unsub:null};
function predScore(p,g){
  if(!g||g.status!=="final"||g.us==null) return null;
  const err=Math.abs(p.us-g.us)+Math.abs(p.them-g.them);
  const sgn=x=>x>0?1:x<0?-1:0, winner=sgn(p.us-p.them)===sgn(g.us-g.them);
  return (winner?5:0)+Math.max(0,10-Math.round(err/2))+(err===0?5:0);
}
function predFor(g){ const k=gameKey(g); return PRED.all.filter(p=>p.game===k); }
function predCardHtml(){
  const g=nextGameForPred(); if(!g) return "";
  const k=gameKey(g), mine=PRED.all.find(p=>p.game===k&&p.uid===ACC.id), list=predFor(g);
  const locked=Date.now()>=Date.parse(g.kickoff)||g.status!=="scheduled";
  const vs=`${g.home?"vs":"at"} ${esc(oppName(g))}`;
  let body;
  if(!locked){
    if(!ACC.db||!ACC.id) body=`<p class="t2">Guess the final score before kickoff. Closest fans climb the season leaderboard.</p><button class="btn-gold" data-acct="1">Sign in to predict</button>`;
    else body=`<form class="pred-form" data-pred="${esc(k)}"><label>${badge(CUR)}<input name="us" type="number" inputmode="numeric" min="0" max="99" value="${mine?mine.us:""}" required aria-label="${esc(CUR)} points"></label><span class="pred-dash">–</span><label><input name="them" type="number" inputmode="numeric" min="0" max="99" value="${mine?mine.them:""}" required aria-label="${esc(g.oppAbbr)} points">${badge(g.oppAbbr)}</label><button class="btn-gold" type="submit">${mine?"Update":"Lock it in"}</button></form>
      <div class="t2">Locks at kickoff · ${esc(fmtDate(g.kickoff,{weekday:"short",hour:"numeric",minute:"2-digit"}))} CT${list.length?` · ${list.length} ${list.length===1?"fan has":"fans have"} predicted`:""}</div>`;
  } else {
    const sorted=list.slice().sort((a,b)=>{ if(g.us==null) return 0; const ea=Math.abs(a.us-g.us)+Math.abs(a.them-g.them), eb=Math.abs(b.us-g.us)+Math.abs(b.them-g.them); return ea-eb; });
    body=list.length?`<div class="list pred-list">${sorted.slice(0,10).map((p,i)=>`<div class="row">${av(p.uid)}<div class="grow"><div class="t1" data-uname="${esc(p.uid)}">${esc(personName(p.uid))}</div></div><b class="num">${esc(p.us)}–${esc(p.them)}</b>${predScore(p,g)!=null?`<span class="chip pos">+${predScore(p,g)}</span>`:""}</div>`).join("")}</div>`
      :`<div class="t2">No predictions for this game.</div>`;
    if(mine) body=`<div class="t2">Your pick: <b>${esc(CUR)} ${esc(mine.us)}–${esc(mine.them)}</b></div>`+body;
  }
  return `<section class="card pred-card" id="predCard"><div class="pred-head"><div><div class="label">Predict the score · Week ${esc(g.week)}</div><div class="t1">${esc(NICK())} ${vs}</div></div><button class="tbtn" data-predlb="1">Leaderboard</button></div>${body}</section>`;
}
function openPredLeaderboard(){
  const games=Object.fromEntries(S.games.map(g=>[gameKey(g),g])), tot={};
  PRED.all.forEach(p=>{ const sc=predScore(p,games[p.game]); if(sc==null) return; const t=tot[p.uid]||(tot[p.uid]={uid:p.uid,pts:0,n:0,exact:0}); t.pts+=sc; t.n++; if(sc>=20) t.exact++; });
  const rows=Object.values(tot).sort((a,b)=>b.pts-a.pts||b.exact-a.exact);
  $("sheet").innerHTML=`<div class="sheet-head"><div><div class="label">Score predictions</div><div class="nm" style="font-size:26px">Season leaderboard</div></div><button class="x" id="closeSheet" aria-label="Close">×</button></div>
    ${rows.length?`<div class="list">${rows.map((r,i)=>`<div class="row"><b class="num pred-rank">${i+1}</b>${av(r.uid)}<div class="grow"><div class="t1" data-uname="${esc(r.uid)}">${esc(personName(r.uid))}</div><div class="t2">${r.n} ${r.n===1?"game":"games"}${r.exact?` · ${r.exact} exact`:""}</div></div><b class="num">${r.pts}</b></div>`).join("")}</div>`
      :`<div class="card empty">No finished games with predictions yet.</div>`}
    <div class="foot">Scoring: 5 for the right winner, up to 10 for how close you are, and 5 bonus for the exact score.</div>`;
  $("sheetBg").hidden=false;
}
document.addEventListener("click",e=>{ if(e.target.closest("[data-predlb]")) openPredLeaderboard(); });
document.addEventListener("submit",async e=>{
  const f=e.target.closest("[data-pred]"); if(!f) return; e.preventDefault(); e.stopImmediatePropagation();
  const us=parseInt(f.us.value,10), them=parseInt(f.them.value,10);
  if(!(us>=0&&us<100&&them>=0&&them<100)) return toast("Enter both scores.");
  const k=f.dataset.pred, g=S.games.find(x=>gameKey(x)===k); if(g&&Date.now()>=Date.parse(g.kickoff)) return toast("Predictions are locked.");
  try{ await ACC.db.doc(`predictions/${k}__${ACC.id}`).set({uid:ACC.id, game:k, us, them, t:nowIso()}); toast("Prediction saved!"); document.activeElement?.blur?.(); renderHome(); }catch(err){ toast("Couldn't save. Try again."); }
},true);
let predEl=null;
function placePredCard(){
  if(document.activeElement?.closest?.(".pred-form")) return; // don't redraw while typing
  const el=$("v-home"), html=predCardHtml(); el.querySelector("#predCard")?.remove(); if(!html) return;
  const anchor=el.querySelector(".sb-row")||el.querySelector(".upd-line");
  if(anchor) anchor.insertAdjacentHTML("afterend",html); else el.querySelector(".col-main")?.insertAdjacentHTML("beforeend",html);
}

/* ---------- hook into Home rendering ---------- */
const _gameDayHtmlLX=gameDayHtml;
gameDayHtml=function(g){
  let h=_gameDayHtmlLX(g);
  const wp=wpHtml(); if(wp) h=h.includes("<!--/gd-field-->")?h.replace("<!--/gd-field-->","<!--/gd-field-->"+wp):h.replace(/(<div class="gd-score">[\s\S]*?<\/div>)/, m=>m+wp);
  h=h.replace(/<div class="gd-sec"><div class="label">Scoring plays<\/div>[\s\S]*?<\/div><\/div>/,"");
  return h.replace(/(<div class="gd-foot">)/, '<div id="gxSlot"></div>$1');
};
const _gameDayPreLX=gameDayPre;
gameDayPre=function(g){ return _gameDayPreLX(g).replace(/(<\/div>)\s*$/, '<div id="gxSlot"></div>$1'); };
const _renderHomeLX=renderHome;
renderHome=function(){
  if(GX.el&&GX.el.contains(document.activeElement)){ GX.pending=true; return; }
  if(document.activeElement?.closest?.(".pred-form")) return;
  _renderHomeLX();
  if(!S.meta) return;
  const g=liveGameNow()||soonGame();
  gxSubscribe(g?gameKey(g):"");
  const slot=$("gxSlot"); if(slot){ slot.replaceWith(gxEl()); renderGX(); }
  placePredCard();
};
(async()=>{
  await accReady;
  if(ACC.db) PRED.unsub=ACC.db.collection("predictions").orderBy("t","desc").limit(1000).onSnapshot(s=>{ PRED.all=s.docs.map(d=>({id:d.id,...d.data()})); if(S.tab==="home") renderHome(); },e=>console.warn("predictions",e));
  renderHome();
})();
