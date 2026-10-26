/* ===================== North Huddle: Sleeper league import ===================== */
// Read-only view of a real Sleeper fantasy league (public API, no login). Username is remembered on this device.
const SL={user:null, leagues:[], league:null, state:null, rosters:[], users:{}, matchups:[], players:null, loading:false, err:"", week:null, t:0};
const SLAPI="https://api.sleeper.app/v1";
async function slGet(p){ const r=await fetch(SLAPI+p); if(!r.ok) throw new Error(r.status); return r.json(); }
function slSaved(){ try{ return JSON.parse(localStorage.getItem("nh_sleeper")||"null"); }catch(e){ return null; } }
function slSave(v){ try{ v?localStorage.setItem("nh_sleeper",JSON.stringify(v)):localStorage.removeItem("nh_sleeper"); }catch(e){} }
async function slPlayers(){ if(SL.players) return SL.players; try{ const r=await fetch("/api/data?f=sleeper"); if(r.ok) SL.players=await r.json(); }catch(e){} return SL.players||{}; }
function slName(pid){ const p=SL.players?.[pid]; if(!p) return isNaN(pid)?`${pid} D/ST`:"Player"; return p[0]; }
function slMeta(pid){ const p=SL.players?.[pid]; if(!p) return isNaN(pid)?"DEF":""; return `${p[1]}${p[2]?" · "+p[2]:""}${p[3]?` · <span class="st-note">${esc(p[3])}</span>`:""}`; }
const slAv=a=>a?`https://sleepercdn.com/avatars/thumbs/${encodeURIComponent(a)}`:BLANK_AV;

async function slLoadUser(username){
  SL.loading=true; SL.err=""; renderFantasy();
  try{
    const u=await slGet("/user/"+encodeURIComponent(username.trim())); if(!u||!u.user_id) throw new Error("nouser");
    SL.state=SL.state||await slGet("/state/nfl");
    const season=SL.state.league_season||SL.state.season;
    SL.user=u; SL.leagues=await slGet(`/user/${u.user_id}/leagues/nfl/${season}`)||[];
    const saved=slSaved()||{}; slSave({username:u.username||username, league:saved.league&&SL.leagues.some(l=>l.league_id===saved.league)?saved.league:(SL.leagues[0]?.league_id||null)});
    if(slSaved().league) await slLoadLeague(slSaved().league);
  }catch(e){ SL.err=String(e.message)==="nouser"||String(e.message)==="404"?"No Sleeper user with that name. Check the spelling (it's your Sleeper username, not your email).":"Couldn't reach Sleeper. Try again in a minute."; }
  SL.loading=false; renderFantasy();
}
async function slLoadLeague(id){
  SL.loading=true; renderFantasy();
  try{
    SL.state=SL.state||await slGet("/state/nfl");
    const wk=SL.state.display_week||SL.state.week||1; SL.week=SL.week||wk;
    const [lg,ros,us,mu]=await Promise.all([slGet("/league/"+id),slGet(`/league/${id}/rosters`),slGet(`/league/${id}/users`),slGet(`/league/${id}/matchups/${SL.week}`),slPlayers()]);
    SL.league=lg; SL.rosters=ros||[]; SL.users=Object.fromEntries((us||[]).map(u=>[u.user_id,u])); SL.matchups=mu||[];
    const s=slSaved()||{}; slSave({...s, league:id});
  }catch(e){ SL.err="Couldn't load that league from Sleeper."; }
  SL.loading=false; renderFantasy();
  clearInterval(SL.t); SL.t=setInterval(()=>{ if(FX.sec==="sleeper"&&S.tab==="fantasy"&&!document.hidden&&SL.league) slRefreshPoints(); },60000);
}
async function slRefreshPoints(){ try{ SL.matchups=await slGet(`/league/${SL.league.league_id}/matchups/${SL.week}`)||[]; if(FX.sec==="sleeper"&&!document.activeElement?.closest?.("#slForm")) renderFantasy(); }catch(e){} }
function slTeamName(r){ const u=SL.users[r?.owner_id]; return u?.metadata?.team_name||u?.display_name||"Team "+(r?.roster_id||""); }
function slOwner(r){ return SL.users[r?.owner_id]; }

function renderSleeper(){
  const saved=slSaved();
  const intro=`<div class="card sl-intro"><div class="sl-logo">S</div><div><div class="t1">Your Sleeper league</div><div class="t2">See your real Sleeper league here: matchup, live points and standings. Just your Sleeper username, no password.</div></div></div>`;
  if(!saved?.username) return intro+`<form class="card sl-form" id="slForm"><label class="t2" for="slUser">Sleeper username</label><div class="sl-row"><input id="slUser" name="u" autocomplete="off" autocapitalize="off" placeholder="e.g. skolfan21" required><button class="btn-gold" type="submit">Connect</button></div>${SL.err?`<div class="auth-err">${esc(SL.err)}</div>`:""}</form>`;
  if(SL.loading&&!SL.league) return skelRows(4);
  if(!SL.user){ slLoadUser(saved.username); return skelRows(4); }
  if(SL.err&&!SL.league) return `<div class="card"><div class="auth-err">${esc(SL.err)}</div><button class="tbtn" data-slreset="1">Use a different username</button></div>`;
  if(!SL.leagues.length) return `<div class="card empty">No ${esc(SL.state?.league_season||"")} Sleeper leagues for <b>${esc(saved.username)}</b>.<br><button class="tbtn" data-slreset="1">Use a different username</button></div>`;
  const pick=SL.leagues.length>1?`<select id="slLeague" class="sl-select" aria-label="Choose league">${SL.leagues.map(l=>`<option value="${esc(l.league_id)}"${l.league_id===saved.league?" selected":""}>${esc(l.name)}</option>`).join("")}</select>`:"";
  const head=`<div class="card sl-head"><img class="av" src="${esc(slAv(SL.user.avatar))}" alt=""><div class="grow"><div class="t1">${esc(SL.league?.name||"")}</div><div class="t2">${esc(SL.user.display_name||saved.username)} · Week ${esc(SL.week||"")} · ${SL.league?.total_rosters||""} teams</div></div><button class="tbtn" data-slreset="1">Switch</button></div>${pick}`;
  if(!SL.league) return head+skelRows(3);
  const mine=SL.rosters.find(r=>r.owner_id===SL.user.user_id||(r.co_owners||[]).includes(SL.user.user_id));
  const mm=SL.matchups.find(m=>m.roster_id===mine?.roster_id), opp=mm&&SL.matchups.find(m=>m.matchup_id===mm.matchup_id&&m.roster_id!==mm.roster_id);
  const side=(m,r)=>{ const st=m?.starters||[], pts=m?.starters_points||[];
    return `<div class="sl-side"><div class="sl-team"><img class="av" src="${esc(slAv(slOwner(r)?.avatar))}" alt=""><div class="grow"><div class="t1">${esc(slTeamName(r))}</div><div class="t2">${r?.settings?`${r.settings.wins}-${r.settings.losses}${r.settings.ties?"-"+r.settings.ties:""}`:""}</div></div><b class="num sl-pts">${(m?.points??0).toFixed(1)}</b></div>
      ${st.map((pid,i)=>`<div class="sl-pl"><div class="grow"><div class="t1">${esc(pid==="0"?"Empty":slName(pid))}</div><div class="t2">${pid==="0"?"":slMeta(pid)}</div></div><span class="num">${(pts[i]??0).toFixed(1)}</span></div>`).join("")}</div>`; };
  const matchup=mm?`<h2>This week's matchup</h2><div class="card sl-mu">${side(mm,mine)}${opp?side(opp,SL.rosters.find(r=>r.roster_id===opp.roster_id)):'<div class="sl-side t2">No opponent this week.</div>'}</div>`:`<div class="card empty">No matchup found for week ${esc(SL.week)}.</div>`;
  const stand=SL.rosters.slice().sort((a,b)=>(b.settings?.wins||0)-(a.settings?.wins||0)||((b.settings?.fpts||0)+(b.settings?.fpts_decimal||0)/100)-((a.settings?.fpts||0)+(a.settings?.fpts_decimal||0)/100));
  const table=`<h2>Standings</h2><div class="list">${stand.map((r,i)=>`<div class="row${r===mine?" sl-me":""}"><b class="num pred-rank">${i+1}</b><img class="av" src="${esc(slAv(slOwner(r)?.avatar))}" alt=""><div class="grow"><div class="t1">${esc(slTeamName(r))}</div><div class="t2">${esc(slOwner(r)?.display_name||"")}</div></div><span class="num">${r.settings?.wins||0}-${r.settings?.losses||0}${r.settings?.ties?"-"+r.settings.ties:""}</span><span class="t2 num sl-pf">${((r.settings?.fpts||0)+(r.settings?.fpts_decimal||0)/100).toFixed(1)} PF</span></div>`).join("")}</div>`;
  return head+matchup+table+`<div class="foot">From Sleeper · points refresh every minute while this page is open.</div>`;
}
document.addEventListener("submit",e=>{ if(e.target.id!=="slForm") return; e.preventDefault(); e.stopImmediatePropagation(); const u=e.target.u.value.trim(); if(!u) return; slSave({username:u}); SL.user=null; SL.league=null; slLoadUser(u); },true);
document.addEventListener("change",e=>{ if(e.target.id==="slLeague"){ SL.league=null; SL.week=null; slLoadLeague(e.target.value); } });
document.addEventListener("click",e=>{ if(e.target.closest("[data-slreset]")){ slSave(null); Object.assign(SL,{user:null,leagues:[],league:null,err:"",week:null}); renderFantasy(); } });
(function(){ const seg=$("fSeg"); if(seg&&!seg.querySelector('[data-fsec="sleeper"]')) seg.querySelector('[data-fsec="league"]')?.insertAdjacentHTML("afterend",`<button data-fsec="sleeper" aria-pressed="false">Sleeper</button>`); })();
const _renderFantasySL=renderFantasy;
renderFantasy=function(){
  if(FX.sec!=="sleeper") return _renderFantasySL();
  $("fHead").hidden=true; $("fSetup").hidden=true;
  document.querySelectorAll("#fSeg button").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.fsec==="sleeper")));
  $("fantasyBody").innerHTML=renderSleeper();
};
if(FX.sec==="sleeper") renderFantasy();
