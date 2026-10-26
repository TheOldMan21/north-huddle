/* ===================== North Huddle: instant team hubs from ESPN ===================== */
// Other teams load in about a second from /api/team (ESPN data via Cloudflare).
// A Claude-built team doc (teams/<abbr>) still wins when it's fresh, since it adds interviews and written summaries.
const QUICK={}, QLOAD={};
async function fetchQuick(a, force){
  if(!a||a==="MIN"||!TEAMS[a]) return;
  if(!force && QUICK[a] && Date.now()-QUICK[a]._at<10*60e3) return;
  if(QLOAD[a]) return QLOAD[a];
  QLOAD[a]=(async()=>{
    try{ const r=await fetch("/api/team?abbr="+encodeURIComponent(a)); if(r.ok){ const d=await r.json(); if(d&&d.meta){ d._at=Date.now(); QUICK[a]=d; if(a===CUR){ syncView(); renderAll(); } } } }
    catch(e){}
    delete QLOAD[a];
  })();
  return QLOAD[a];
}
function claudeFresh(d){ const u=d?.meta?.updatedAt; return !!u && Date.now()-Date.parse(u)<TEAM_STALE; }
const _teamViewQ=teamView;
teamView=function(a){
  if(a==="MIN") return _teamViewQ(a);
  const c=TEAMDOCS[a], q=QUICK[a];
  if(!q || claudeFresh(c)) return _teamViewQ(a);
  // ESPN data, plus anything extra a previous Claude build had (interviews, written news).
  const news=[...(q.news||[])];
  (c?.news||[]).forEach(n=>{ if(!news.some(x=>x.headline===n.headline)) news.push(n); });
  return {meta:q.meta, games:q.games||[], players:q.players||[], injuries:q.injuries||[], depth:q.depth||[], videos:c?.videos||[],
    news:news.sort((x,y)=>String(y.date).localeCompare(String(x.date))).slice(0,20),
    standings:(LEAGUE.standings||{})[TEAMS[a][2]]||[]};
};
// No more waiting on a Claude build just to open a team. The Update button still requests one.
maybeLoadTeam=async function(a,force){
  if(a==="MIN") return;
  await fetchQuick(a, force);
  if(force){ await accReady; if(ACC.db&&ACC.id) memberUpdate("team",a); }
};
updateClick=async function(){
  await accReady;
  if(CUR!=="MIN"){ fetchQuick(CUR,true); if(ACC.db&&ACC.id) memberUpdate("team",CUR); else toast(`${TEAMS[CUR][1]} refreshed.`); return; }
  if(!ACC.db||!ACC.id) return openUpdateInfo();
  memberUpdate("update");
};
const _setTeamQ=setTeam;
setTeam=function(a){ if(a!=="MIN"&&!QUICK[a]&&!claudeFresh(TEAMDOCS[a])) fetchQuick(a); _setTeamQ(a); };
const _teamStatusQ=teamStatus;
teamStatus=function(a){ if(a!=="MIN"&&QUICK[a]&&!claudeFresh(TEAMDOCS[a])) return "Live from ESPN"; return _teamStatusQ(a); };
if(CUR!=="MIN") fetchQuick(CUR);
