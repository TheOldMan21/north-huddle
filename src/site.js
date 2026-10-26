/* ===================== North Huddle: accounts, branding, live scores ===================== */

/* ---------- account sheet: email + password ---------- */
let AMODE="in";
const _openAcctNH=openAcct;
function authSheet(){
  const up=AMODE==="up";
  return `<div class="sheet-head"><div><div class="label">Optional</div><div class="nm" style="font-size:26px">${up?"Create account":"Sign in"}</div></div><button class="x" id="closeSheet" aria-label="Close">×</button></div>
    <p class="acct-p">Everything on North Huddle works without an account. Sign in to play fantasy with friends, chat, and keep your settings on every device.</p>
    <div class="auth-seg" role="group"><button data-amode="in" aria-pressed="${!up}">Sign in</button><button data-amode="up" aria-pressed="${up}">Create account</button></div>
    <form id="authForm" class="auth-form" novalidate>
      ${up?`<label>Display name<input name="name" maxlength="24" autocomplete="nickname" placeholder="What friends call you" required></label>`:""}
      <label>Email<input name="email" type="email" autocomplete="email" inputmode="email" required></label>
      <label>Password<input name="password" type="password" minlength="6" autocomplete="${up?"new-password":"current-password"}" placeholder="${up?"At least 6 characters":""}" required></label>
      <div class="auth-err" id="authErr" role="alert"></div>
      <button class="btn-gold" type="submit" id="authGo">${up?"Create account":"Sign in"}</button>
    </form>
    ${up?"":`<button class="auth-link" data-aforgot="1">Forgot password?</button>`}
    ${themeRow()}`;
}
openAcct=function(){
  if(ACC.id){
    _openAcctNH();
    const f=[...$("sheet").querySelectorAll(".foot")].find(x=>/sign out/i.test(x.textContent));
    const html=`<button class="tbtn auth-out" data-signout="1">Sign out</button>`;
    if(f) f.outerHTML=html; else $("sheet").insertAdjacentHTML("beforeend",html);
    return;
  }
  $("sheet").innerHTML=authSheet(); $("sheetBg").hidden=false;
  setTimeout(()=>$("authForm")?.querySelector("input")?.focus(),50);
};
document.addEventListener("click",async e=>{
  const m=e.target.closest("[data-amode]"); if(m){ AMODE=m.dataset.amode; $("sheet").innerHTML=authSheet(); $("authForm").querySelector("input").focus(); return; }
  if(e.target.closest("[data-signout]")){ NH.signOut(); return; }
  if(e.target.closest("[data-aforgot]")){
    const em=$("authForm")?.email?.value.trim(); const er=$("authErr");
    if(!em){ er.textContent="Type your email above first, then tap Forgot password."; return; }
    try{ await NH.resetPassword(em); er.textContent="If that email has an account, a reset link is on its way."; }
    catch(x){ er.textContent="Couldn't send a reset email. Ask the site owner to reset your password."; }
  }
});
document.addEventListener("submit",async e=>{
  if(e.target.id!=="authForm") return; e.preventDefault(); e.stopImmediatePropagation();
  const f=e.target, er=$("authErr"), go=$("authGo");
  const name=(f.name?.value||"").trim().slice(0,24), email=f.email.value.trim(), pw=f.password.value;
  er.textContent="";
  if(AMODE==="up"&&!name){ er.textContent="Pick a display name."; return; }
  if(!/^\S+@\S+\.\S+$/.test(email)){ er.textContent="Enter a valid email."; return; }
  if(pw.length<6){ er.textContent="Password needs at least 6 characters."; return; }
  go.disabled=true; go.textContent=AMODE==="up"?"Creating…":"Signing in…";
  try{
    if(AMODE==="up"){ const r=await NH.signUp(name,email,pw); if(r==="confirm"){ er.textContent="Check your email to confirm your account, then sign in."; go.disabled=false; go.textContent="Create account"; } }
    else await NH.signIn(email,pw);
  }catch(x){
    const m=String(x?.message||"");
    er.textContent=/invalid login/i.test(m)?"Wrong email or password.":/already registered|already exists/i.test(m)?"That email already has an account. Sign in instead.":/rate|too many/i.test(m)?"Too many tries. Wait a minute and try again.":(m||"Something went wrong. Try again.");
    go.disabled=false; go.textContent=AMODE==="up"?"Create account":"Sign in";
  }
},true);
NH.sb.auth.onAuthStateChange(async ev=>{
  if(ev!=="PASSWORD_RECOVERY") return;
  const pw=prompt("Choose a new password (at least 6 characters):");
  if(pw&&pw.length>=6){ try{ await NH.setPassword(pw); toast("Password updated."); }catch(x){ toast("Couldn't update the password."); } }
});

/* ---------- branding ---------- */
const _updateBrandNH=updateBrand;
updateBrand=function(){ _updateBrandNH(); const b=$("brandName"); if(b){ b.textContent="North"; } const w=document.querySelector("#teamBtn .hubw"); if(w) w.textContent="Huddle"; };
updateBrand();
(function(){
  const m=document.querySelector("main");
  if(m && !$("nhFoot")) m.insertAdjacentHTML("beforeend",`<footer id="nhFoot" class="nh-foot">North Huddle is an unofficial fan site. Not affiliated with, endorsed by, or connected to the Minnesota Vikings, any NFL team, or the National Football League. Team names are used only to identify teams.</footer>`);
})();

/* ---------- updates: everyone uses requests ---------- */
updateClick=async function(){ await accReady; if(!ACC.db||!ACC.id) return openUpdateInfo(); if(CUR!=="MIN") return memberUpdate("team",CUR); memberUpdate("update"); };
$("refreshBtn").replaceWith($("refreshBtn").cloneNode(true));
$("refreshBtn").addEventListener("click",()=>updateClick());
maybeLoadTeam=async function(a,force){
  if(a==="MIN") return; await accReady;
  const u=TEAMDOCS[a]?.meta?.updatedAt, age=u?Date.now()-new Date(u).getTime():Infinity;
  if(!force && age<TEAM_STALE) return;
  if(!ACC.db||!ACC.id){ if(force||!u) toast(`Sign in to request the ${TEAMS[a][1]} hub.`); return; }
  const k="vh_teamreq_"+a, last=Number(store.get(k)||0);
  if(Date.now()-last<60*60e3){ if(force) toast(`The ${TEAMS[a][1]} hub was already requested. It shows up here automatically.`); return; }
  store.set(k,String(Date.now())); memberUpdate("team",a);
};

/* ---------- live scores (every minute during games) ---------- */
const LIVE={data:null, at:0, t:0};
function liveFor(abbr){ return LIVE.data?.games?.find(x=>x.home===abbr||x.away===abbr)||null; }
function matchGame(lg){
  const opp=lg.home===CUR?lg.away:lg.home, k=Date.parse(lg.kickoff);
  return S.games.find(g=>g.oppAbbr===opp && (!g.kickoff || Math.abs(Date.parse(g.kickoff)-k)<36*36e5));
}
function applyLive(){
  const lg=liveFor(CUR); if(!lg||lg.state==="pre") return;
  const g=matchGame(lg); if(!g) return;
  const home=lg.home===CUR, us=home?lg.hs:lg.as, them=home?lg.as:lg.hs;
  if(lg.state==="in"){
    g.status="live"; g.us=us; g.them=them;
    g.note=lg.posText&&lg.possession ? lg.detail : [lg.detail, lg.downDist?(lg.possession?lg.possession+" ball · ":"")+lg.downDist:""].filter(Boolean).join(" · ");
    const sc=LIVE.data.focus?.scoring;
    if(sc&&sc.length) g.plays=sc.slice().reverse().map(p=>`Q${p.q} ${p.clock||""} · ${p.team||""} · ${p.text}`.replace(/\s+·\s+·/g," ·"));
    g.liveAt=LIVE.at;
    g.field=fieldState(lg);
  } else if(lg.state==="post" && g.status!=="final"){
    g.status="final"; g.us=us; g.them=them; g.result=us>them?"W":us<them?"L":"T";
  }
}
/* ---------- live field: who has the ball and where ---------- */
// x = yards from OUR goal line (0) to theirs (100). We attack to the right.
function fieldState(lg){
  const opp=lg.home===CUR?lg.away:lg.home;
  const fix=a=>({WAS:"WSH",LA:"LAR"}[a]||a);
  const m=String(lg.posText||"").trim().match(/^([A-Z]{2,4})?\s*(\d{1,2})$/i);
  if(!lg.possession || !m) return null;
  const side=m[1]?fix(m[1].toUpperCase()):"", n=Math.max(0,Math.min(50,Number(m[2])));
  const x = !side||n===50 ? 50 : side===CUR ? n : 100-n;
  const ours=lg.possession===CUR, dir=ours?1:-1;
  const dist=Number(lg.distance)||0;
  const toGoal=ours?100-x:x;
  const fd = dist>0 && dist<toGoal ? x+dir*dist : null;
  return {x, ours, team:lg.possession, opp, fd, dd:lg.shortDD||"", posText:lg.posText, red: toGoal<=20, last:lg.lastPlay||""};
}
function liveFieldSvg(f){
  const c1=TEAM[CUR]||["#4F2683","#FFC62F","#fff"], c2=TEAM[f.opp]||["#555","#999","#fff"];
  const X=v=>10+v; // field starts after 10-unit end zone
  let lines="";
  for(let y=10;y<100;y+=10){ lines+=`<line x1="${X(y)}" y1="0" x2="${X(y)}" y2="30" class="lf-yl"/>`; const lab=y<=50?y:100-y; if(y%10===0) lines+=`<text x="${X(y)}" y="27.6" class="lf-num">${lab}</text>`; }
  for(let y=5;y<100;y+=10) lines+=`<line x1="${X(y)}" y1="13.5" x2="${X(y)}" y2="16.5" class="lf-tick"/>`;
  const bx=X(f.x), arrow=f.ours?`M${bx+4} 5.4 l3.2 2.2 -3.2 2.2z`:`M${bx-4} 5.4 l-3.2 2.2 3.2 2.2z`;
  return `<svg class="lf" viewBox="0 0 120 30" role="img" aria-label="${esc(f.team)} ball, ${esc(f.dd)} at ${esc(f.posText)}">
    <rect x="0" y="0" width="120" height="30" rx="2" class="lf-grass"/>
    ${f.red?`<rect x="${f.ours?X(80):X(0)}" y="0" width="20" height="30" class="lf-red"/>`:""}
    <rect x="0" y="0" width="10" height="30" rx="2" fill="${c1[0]}"/><rect x="110" y="0" width="10" height="30" rx="2" fill="${c2[0]}"/>
    <text x="5" y="15" class="lf-ez" fill="${c1[2]}" transform="rotate(-90 5 15)">${esc(CUR)}</text>
    <text x="115" y="15" class="lf-ez" fill="${c2[2]}" transform="rotate(90 115 15)">${esc(f.opp)}</text>
    ${lines}
    ${f.fd!=null?`<line x1="${X(f.fd)}" y1="0" x2="${X(f.fd)}" y2="30" class="lf-fd"/>`:""}
    <line x1="${bx}" y1="0" x2="${bx}" y2="30" class="lf-los"/>
    <path d="${arrow}" class="lf-arrow"/>
    <ellipse cx="${bx}" cy="15" rx="3.3" ry="2" class="lf-ball"/><line x1="${bx-1.4}" y1="15" x2="${bx+1.4}" y2="15" class="lf-lace"/>
  </svg>`;
}
function fieldHtml(f){
  if(!f) return "";
  return `<div class="gd-field">
    <div class="lf-top">${badge(f.team)}<b>${esc(f.ours?NICK():(TEAMS[f.team]?.[1]||f.team))} ball</b><span class="lf-dd">${esc(f.dd)}${f.posText?` · ${esc(f.posText)}`:""}</span>${f.red?'<span class="chip live lf-rz">RED ZONE</span>':""}</div>
    ${liveFieldSvg(f)}
    ${f.last?`<div class="lf-last"><span class="label">Last play</span> ${esc(f.last)}</div>`:""}
  </div><!--/gd-field-->`;
}
const _syncViewNH=syncView;
syncView=function(){ _syncViewNH(); try{ applyLive(); }catch(e){} };
function liveWindow(){
  const now=Date.now();
  if(S.games.some(g=>g.status==="live")) return true;
  return S.games.some(g=>g.kickoff && Date.parse(g.kickoff)-now<20*60e3 && now-Date.parse(g.kickoff)<5*36e5);
}
async function pollLive(){
  clearTimeout(LIVE.t);
  const active=liveWindow();
  if(!document.hidden && (active || Date.now()-LIVE.at>10*60e3)){
    try{
      const r=await fetch("/api/scores?team="+encodeURIComponent(CUR),{cache:"no-store"});
      if(r.ok){ const d=await r.json(); const sig=JSON.stringify([d.games,d.focus]); const changed=sig!==LIVE.sig; LIVE.sig=sig; LIVE.data=d; LIVE.at=Date.now(); if(changed){ syncView(); renderAll(); } }
    }catch(e){}
  }
  LIVE.t=setTimeout(pollLive, active?60e3:5*60e3);
}
document.addEventListener("visibilitychange",()=>{ if(!document.hidden) pollLive(); });
const _setTeamNH=setTeam;
setTeam=function(a){ _setTeamNH(a); LIVE.at=0; pollLive(); };
pollLive();
const _gameDayHtmlNH=gameDayHtml;
gameDayHtml=function(g){
  let h=_gameDayHtmlNH(g);
  if(g.field) h=h.replace(/(<div class="gd-score">[\s\S]*?<\/div>)/, "$1"+fieldHtml(g.field));
  h=h.replace(/Scores refresh about every hour during the game · updated [^<]*/, g.liveAt?`Live · updates every minute · ${esc(ago(new Date(g.liveAt).toISOString()))}`:"Live · updates every minute");
  const others=(LIVE.data?.games||[]).filter(x=>x.state!=="pre" && x.home!==CUR && x.away!==CUR).slice(0,8);
  if(others.length){
    const sec=`<div class="gd-sec"><div class="label">Around the league</div>${others.map(x=>`<div class="gd-row"><span>${esc(x.away)} ${esc(x.as)} @ ${esc(x.home)} ${esc(x.hs)}</span><span class="t2">${esc(x.state==="post"?"Final":x.detail||"Live")}</span></div>`).join("")}</div>`;
    h=h.replace(/<div class="gd-sec"><div class="label">Around the league<\/div>[\s\S]*?<\/div><\/div>(?=<div class="gd-foot">|\s*<div class="gd-foot">)/,"");
    h=h.replace(/(\s*<div class="gd-foot">)/, sec+"$1");
  }
  return h;
};
const _gameDayPreNH=gameDayPre;
gameDayPre=function(g){ return _gameDayPreNH(g).replace("The live score shows up here with the next update, then refreshes about every hour.","Live score loading… it updates every minute."); };
syncView(); renderAll();
