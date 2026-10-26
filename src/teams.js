/* ===================== North Huddle: instant team hubs from ESPN ===================== */
// Other teams load in about a second from /api/team (ESPN data via Cloudflare).
// A Claude-built team doc (teams/<abbr>) still wins when it's fresh, since it adds interviews and written summaries.
const QUICK={}, QLOAD={};
async function fetchQuick(a, force){
  if(!a||!TEAMS[a]) return;
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
  if(a==="MIN") return minBlend(_teamViewQ(a), QUICK.MIN);
  const c=TEAMDOCS[a], q=QUICK[a];
  if(!q || claudeFresh(c)) return _teamViewQ(a);
  // ESPN data, plus anything extra a previous Claude build had (interviews, written news).
  const news=[...(q.news||[])];
  (c?.news||[]).forEach(n=>{ if(!news.some(x=>x.headline===n.headline)) news.push(n); });
  return {meta:q.meta, games:q.games||[], players:q.players||[], injuries:q.injuries||[], depth:q.depth||[], videos:c?.videos||[],
    news:news.sort((x,y)=>String(y.date).localeCompare(String(x.date))).slice(0,20),
    standings:(LEAGUE.standings||{})[TEAMS[a][2]]||[]};
};
// Minnesota: Claude's content stays, ESPN keeps the facts current between Claude updates.
const nmz=s=>String(s||"").toLowerCase().replace(/\b(jr|sr|ii|iii|iv)\b\.?/g,"").replace(/[^a-z]/g,"");
function minBlend(v,q){
  if(!q) return v;
  const out={...v};
  const m=v.meta||{}, qm=q.meta||{};
  out.meta={...m};
  ["record","recordHome","recordAway","streak","pf","pa"].forEach(k=>{ if(qm[k]!=null&&qm[k]!=="") out.meta[k]=qm[k]; });
  if(!m.updatedAt||Date.parse(qm.updatedAt)>Date.parse(m.updatedAt)) out.meta.liveAt=qm.updatedAt;
  // games: take ESPN's result/score/kickoff when it knows more
  const qg=Object.fromEntries((q.games||[]).map(g=>[g.week,g]));
  out.games=(v.games||[]).map(g=>{ const e=qg[g.week]; if(!e||e.status==="bye") return g; const n={...g};
    if(e.status==="final"&&g.status!=="final"){ n.status="final"; n.us=e.us; n.them=e.them; n.result=e.result; }
    if(!n.kickoff&&e.kickoff) n.kickoff=e.kickoff; if(!n.tv&&e.tv) n.tv=e.tv;
    return n; });
  // injuries: Claude's (with body parts) plus anything new ESPN lists (skip long-term IR Claude didn't mention)
  const inj=[...(v.injuries||[])], have=new Set(inj.map(i=>nmz(i.player)));
  (q.injuries||[]).forEach(i=>{ if(!have.has(nmz(i.player)) && !/reserve/i.test(i.status)) inj.push(i); });
  out.injuries=inj;
  // players: season totals only go up, so keep the larger number from either source
  const qp=Object.fromEntries((q.players||[]).map(p=>[nmz(p.name),p]));
  out.players=(v.players||[]).map(p=>{ const e=qp[nmz(p.name)]; if(!e) return p; const s=JSON.parse(JSON.stringify(p.stats||{}));
    for(const [grp,keys] of Object.entries({pass:["yds","td","cmp","att","int"],rush:["yds","td","att"],rec:["rec","yds","td"],def:["tkl","sacks","int"]})){
      if(!e.stats?.[grp]) continue; s[grp]=s[grp]||{}; keys.forEach(k=>{ const a=Number(s[grp][k]||0), b=Number(e.stats[grp][k]||0); if(b>a) s[grp][k]=b; }); }
    const n={...p, stats:s}; n.rank=(s.pass?.yds||0)+(s.rush?.yds||0)+(s.rec?.yds||0)+5*(s.def?.tkl||0)+20*(s.def?.sacks||0); return n; });
  // news: add ESPN headlines Claude hasn't covered
  const news=[...(v.news||[])], heads=new Set(news.map(n=>nmz(n.headline)));
  (q.news||[]).forEach(n=>{ if(!heads.has(nmz(n.headline))) news.push(n); });
  out.news=news.sort((x,y)=>String(y.date).localeCompare(String(x.date)));
  return out;
}

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
setTeam=function(a){ if(!QUICK[a]) fetchQuick(a); _setTeamQ(a); };
const _teamStatusQ=teamStatus;
teamStatus=function(a){ if(a!=="MIN"&&QUICK[a]&&!claudeFresh(TEAMDOCS[a])) return "Live from ESPN"; return _teamStatusQ(a); };
fetchQuick(CUR); if(CUR!=="MIN") fetchQuick("MIN");
setInterval(()=>{ if(!document.hidden) fetchQuick(CUR); }, 10*60e3);
document.addEventListener("visibilitychange",()=>{ if(!document.hidden) fetchQuick(CUR); });
