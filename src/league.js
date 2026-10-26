/* ===================== North Huddle: all-games scoreboard, standings, league-wide players, Sleeper ===================== */

/* ---------- Schedule tab: Team | Scores | Standings ---------- */
const GM={mode:store.get("vh_gmode")||"team", stand:null, standAt:0, sheet:null, sheetT:0};
function gmSeg(){ return `<div class="seg gm-seg" role="group" aria-label="Schedule view">${[["team",NICK()],["scores","All scores"],["standings","Standings"]].map(([k,l])=>`<button data-gmode="${k}" aria-pressed="${GM.mode===k}">${esc(l)}</button>`).join("")}</div>`; }
const _renderGamesL=renderGames;
renderGames=function(){
  const el=$("v-games"); if(!el) return;
  if(GM.mode==="team"){ _renderGamesL(); el.insertAdjacentHTML("afterbegin",gmSeg()); return; }
  el.innerHTML=gmSeg()+`<div id="gmBody" class="stack"></div>`;
  if(GM.mode==="scores") renderScoreboard(); else renderStandings();
};
document.addEventListener("click",e=>{
  const b=e.target.closest("[data-gmode]"); if(b){ GM.mode=b.dataset.gmode; store.set("vh_gmode",GM.mode); renderGames(); if(GM.mode==="standings") loadStandings(); if(GM.mode==="scores") pollLive(); return; }
  const g=e.target.closest("[data-sbgame]"); if(g){ openGameSheet(g.dataset.sbgame); return; }
});

/* ---------- scoreboard ---------- */
function stateRank(x){ return x.state==="in"?0:x.state==="pre"?1:2; }
function gameRow(x){
  const live=x.state==="in", fin=x.state==="post", pre=x.state==="pre";
  const sc=(a,s,win)=>`<div class="sb-team${win?" win":""}">${badge(a)}<span class="sb-abbr">${esc(a)}</span>${pre?"":`<b class="num">${esc(s)}</b>`}${x.possession===a&&live?'<span class="sb-poss" title="Has the ball">●</span>':""}</div>`;
  const when=pre?fmtDate(x.kickoff,{weekday:"short",hour:"numeric",minute:"2-digit"})+" CT":x.detail;
  return `<button class="card sb-game${live?" live":""}${(x.home===CUR||x.away===CUR)?" mine":""}" data-sbgame="${esc(x.id)}">
    <div class="sb-teams">${sc(x.away,x.as,fin&&x.as>x.hs)}${sc(x.home,x.hs,fin&&x.hs>x.as)}</div>
    <div class="sb-meta">${live?'<span class="chip live">LIVE</span>':""}<span>${esc(when)}</span>${x.tv&&pre?`<span class="t2">${esc(x.tv)}</span>`:""}${live&&x.shortDD?`<span class="t2">${esc(x.shortDD)}${x.posText?` · ${esc(x.posText)}`:""}</span>`:""}${live&&x.redZone?'<span class="chip live">RED ZONE</span>':""}</div></button>`;
}
function renderScoreboard(){
  const b=$("gmBody"); if(!b) return;
  const gs=(LIVE.data?.games||[]).slice().sort((a,c)=>stateRank(a)-stateRank(c)||String(a.kickoff).localeCompare(String(c.kickoff)));
  if(!gs.length){ b.innerHTML=skelRows(4); return; }
  const live=gs.filter(x=>x.state==="in").length;
  b.innerHTML=`<div class="sb-head"><h2>Week ${esc(LIVE.data.week||"")} scoreboard</h2><span class="t2">${live?`${live} live · updates every minute`:"Tap a game for details"}</span></div><div class="sb-grid">${gs.map(gameRow).join("")}</div>`;
}
// keep the scoreboard fresh: the shared live poll already fetches every minute during games
const _pollLiveL=pollLive;
pollLive=async function(){ await _pollLiveL(); if(S.tab==="games"&&GM.mode==="scores") renderScoreboard(); if(GM.sheet) refreshGameSheet(); };

/* ---------- game sheet (any game) ---------- */
async function openGameSheet(id){ GM.sheet={id, data:null}; renderGameSheet(); $("sheetBg").hidden=false; refreshGameSheet(); clearInterval(GM.sheetT); GM.sheetT=setInterval(()=>{ if($("sheetBg").hidden){ clearInterval(GM.sheetT); GM.sheet=null; return; } refreshGameSheet(); },60000); }
async function refreshGameSheet(){
  const s=GM.sheet; if(!s) return;
  try{ const r=await fetch(`/api/scores?event=${encodeURIComponent(s.id)}&team=${CUR}`,{cache:"no-store"}); if(r.ok){ s.data=await r.json(); if(GM.sheet===s&&!$("sheetBg").hidden) renderGameSheet(); } }catch(e){}
}
function renderGameSheet(){
  const s=GM.sheet, d=s.data, x=(d?.games||LIVE.data?.games||[]).find(g=>String(g.id)===String(s.id));
  if(!x){ $("sheet").innerHTML=`<div class="sheet-head"><div class="nm">Game</div><button class="x" id="closeSheet" aria-label="Close">×</button></div>${skelRows(3)}`; return; }
  const f=d?.focus, pre=x.state==="pre";
  const wp=f?.wp?.pts?.length?(()=>{ const p=Math.round(f.wp.now*100); return `<div class="gs-sec"><div class="label">Win probability</div><div class="gs-wp"><span class="gs-wph" style="width:${p}%"></span></div><div class="wp-lab"><span>${esc(x.home)} ${p}%</span><span>${esc(x.away)} ${100-p}%</span></div></div>`; })():"";
  const sit=x.state==="in"&&x.possession?`<div class="gs-sit">${badge(x.possession)} <b>${esc(x.possession)} ball</b> · ${esc(x.shortDD||"")}${x.posText?` at ${esc(x.posText)}`:""}${x.redZone?' <span class="chip live">RED ZONE</span>':""}</div>${x.lastPlay?`<div class="t2 gs-last">Last play: ${esc(x.lastPlay)}</div>`:""}`:"";
  const plays=(f?.plays||[]).slice(0,12).map(p=>`<div class="gx-play${p.scoring?" gx-score":""}"><div class="gx-pm">Q${esc(p.q)} ${esc(p.clock)}${p.team?` · ${esc(p.team)}`:""}${p.dd?` · ${esc(p.dd)}`:""}</div><div class="gx-pt">${esc(p.text)}</div></div>`).join("");
  const box=(f?.box||[]).map(t=>{ const tabs=Object.entries({passing:"Passing",rushing:"Rushing",receiving:"Receiving"}).map(([k,l])=>{ const c=t.cats?.[k]; if(!c?.rows?.length) return ""; return `<table class="gx-box"><thead><tr><th>${esc(t.team)} ${l}</th>${c.labels.map(z=>`<th>${esc(z)}</th>`).join("")}</tr></thead><tbody>${c.rows.map(r=>`<tr><td>${esc(r.name)}</td>${r.stats.map(v=>`<td class="num">${esc(v)}</td>`).join("")}</tr>`).join("")}</tbody></table>`; }).join(""); return tabs; }).join("");
  $("sheet").innerHTML=`<div class="sheet-head"><div><div class="label">${x.state==="in"?'<span class="chip live">LIVE</span> ':""}${esc(pre?fmtDate(x.kickoff,{weekday:"long",hour:"numeric",minute:"2-digit"})+" CT":x.detail)}${x.tv?` · ${esc(x.tv)}`:""}</div>
      <div class="gs-score">${badge(x.away,true)}<b class="num">${pre?"":esc(x.as)}</b><span class="gs-at">@</span><b class="num">${pre?"":esc(x.hs)}</b>${badge(x.home,true)}</div></div><button class="x" id="closeSheet" aria-label="Close">×</button></div>
    ${sit}${wp}
    ${plays?`<div class="gs-sec"><div class="label">Latest plays</div>${plays}</div>`:""}
    ${box?`<div class="gs-sec"><div class="label">Box score</div>${box}</div>`:""}
    ${pre&&!plays?`<div class="card empty">Live plays, box score and win probability appear here at kickoff.</div>`:""}
    <div class="foot">Updates every minute while open.</div>`;
}

/* ---------- standings (always current from ESPN) ---------- */
async function loadStandings(force){
  if(!force && GM.stand && Date.now()-GM.standAt<10*60e3) return;
  try{ const r=await fetch("/api/standings"); if(r.ok){ const d=await r.json(); if(d?.divisions){ GM.stand=d; GM.standAt=Date.now(); LEAGUE.standings=d.divisions; syncView(); if(S.tab==="games"&&GM.mode==="standings") renderStandings(); else renderAll(); } } }catch(e){}
}
function renderStandings(){
  const b=$("gmBody"); if(!b) return;
  const D=GM.stand?.divisions; if(!D){ b.innerHTML=skelRows(6); loadStandings(); return; }
  const myDiv=TEAMS[CUR]?.[2];
  const table=(name,rows)=>`<div class="card st-card${name===myDiv?" mine":""}"><div class="st-h">${esc(name)}</div><table class="st-t"><thead><tr><th></th><th>W-L${rows.some(r=>r.t)?"-T":""}</th><th>PF</th><th>PA</th><th>Strk</th></tr></thead><tbody>${rows.map(r=>`<tr class="${r.abbr===CUR?"me":""}"><td><span class="st-team">${badge(r.abbr)}<span>${esc(r.abbr)}</span>${r.seed&&r.seed<=7?`<span class="st-seed" title="Playoff seed">${r.seed}</span>`:""}</span></td><td class="num">${r.w}-${r.l}${rows.some(z=>z.t)?"-"+r.t:""}</td><td class="num">${r.pf}</td><td class="num">${r.pa}</td><td>${esc(r.streak)}</td></tr>`).join("")}</tbody></table></div>`;
  const conf=c=>{ const all=Object.entries(D).filter(([n])=>n.startsWith(c)).flatMap(([n,rs])=>rs.map(r=>({...r,divn:n}))); const seeded=all.filter(r=>r.seed&&r.seed<=7).sort((a,z)=>a.seed-z.seed);
    return `<div class="card pp-card"><div class="st-h">${c} playoff picture</div>${seeded.map(r=>`<div class="pp-row${r.abbr===CUR?" me":""}"><b class="num pp-seed">${r.seed}</b>${badge(r.abbr)}<span class="grow">${esc(r.team)}</span><span class="num">${r.w}-${r.l}${r.t?"-"+r.t:""}</span><span class="t2">${r.seed<=4?"Div. leader":"Wild card"}</span></div>`).join("")||'<div class="t2">Seeds appear once games are played.</div>'}</div>`; };
  b.innerHTML=`<div class="sb-head"><h2>Standings</h2><span class="t2">Live from ESPN</span></div>${conf("NFC")}${conf("AFC")}<div class="st-grid">${Object.entries(D).sort(([a],[z])=>(a===myDiv?-1:z===myDiv?1:a.localeCompare(z))).map(([n,r])=>table(n,r)).join("")}</div>`;
}
loadStandings();

/* ---------- any NFL player: stats in search results ---------- */
const LP={data:null, idx:null};
async function loadLeaguePlayers(){
  if(LP.data) return LP.data;
  try{ const r=await fetch("/api/data?f=players"); if(r.ok){ LP.data=await r.json(); LP.idx={}; Object.entries(LP.data.teams||{}).forEach(([a,ps])=>ps.forEach(p=>{ LP.idx[nmz(p.name)+"|"+a]=p; LP.idx[nmz(p.name)]=LP.idx[nmz(p.name)]||{...p,abbr:a}; })); } }catch(e){}
  return LP.data;
}
function lpFind(name,abbr){ if(!LP.idx) return null; return abbr?(LP.idx[nmz(name)+"|"+abbr]||null):(LP.idx[nmz(name)]||null); }
function lpLine(p){ const s=p?.stats||{}, o=[];
  if(s.pass?.yds) o.push(`${s.pass.yds} pass yds, ${s.pass.td} TD`); if(s.rush?.yds) o.push(`${s.rush.yds} rush yds${s.rush.td?`, ${s.rush.td} TD`:""}`);
  if(s.rec?.yds) o.push(`${s.rec.rec} rec, ${s.rec.yds} yds${s.rec.td?`, ${s.rec.td} TD`:""}`); if(s.def?.tkl||s.def?.sacks) o.push(`${s.def.tkl} tkl${s.def.sacks?`, ${s.def.sacks} sk`:""}${s.def.int?`, ${s.def.int} INT`:""}`);
  return o.join(" · "); }
function lpDecorate(){
  const box=$("tresults"); if(!box||box.hidden) return;
  if(!LP.data){ loadLeaguePlayers().then(()=>{ if(LP.data) lpDecorate(); }); return; }
  const q=$("tsearch").value, r=searchPlayers(q);
  box.querySelectorAll(".row").forEach((row,i)=>{ const p=r[i]; if(!p) return; const lp=lpFind(p.name,p.abbr); const line=lpLine(lp);
    if(line&&!row.querySelector(".lp-line")) row.querySelector(".grow")?.insertAdjacentHTML("beforeend",`<div class="t2 lp-line">2026: ${esc(line)}</div>`);
    if(lp){ row.classList.add("lp-tap"); row.dataset.lp=p.abbr+"|"+p.name; } });
}
$("tsearch")?.addEventListener("input",()=>setTimeout(lpDecorate,0));
const _renderTrackResultsL=renderTrackResults;
renderTrackResults=function(){ _renderTrackResultsL(); lpDecorate(); };
document.addEventListener("click",e=>{
  const row=e.target.closest("[data-lp]"); if(!row||e.target.closest("button")) return;
  const [abbr,name]=row.dataset.lp.split(/\|(.+)/); const p=lpFind(name,abbr); if(!p) return;
  const s=p.stats||{}, grid=(t,items)=>`<h2>${t}</h2><div class="statgrid">${items.filter(i=>i[1]!=null&&i[1]!=="").map(([l,v])=>`<div class="sg"><b class="num">${esc(v)}</b><span>${l}</span></div>`).join("")}</div>`;
  const blocks=[];
  if(s.pass) blocks.push(grid("Passing",[["Cmp/Att",s.pass.att?`${s.pass.cmp}/${s.pass.att}`:null],["Yards",s.pass.yds],["TD",s.pass.td],["INT",s.pass.att?s.pass.int:null],["Rating",s.pass.rate?Number(s.pass.rate).toFixed(1):null]]));
  if(s.rush) blocks.push(grid("Rushing",[["Carries",s.rush.att],["Yards",s.rush.yds],["TD",s.rush.td]]));
  if(s.rec) blocks.push(grid("Receiving",[["Rec",s.rec.rec],["Yards",s.rec.yds],["TD",s.rec.td]]));
  if(s.def) blocks.push(grid("Defense",[["Tackles",s.def.tkl],["Sacks",s.def.sacks],["INT",s.def.int]]));
  $("sheet").innerHTML=`<div class="sheet-head"><div><div class="label">${badge(abbr)} ${esc(p.pos||"")}${p.number?` · #${esc(p.number)}`:""}</div><div class="nm">${esc(p.name)}</div></div><button class="x" id="closeSheet" aria-label="Close">×</button></div>
    ${p.status?`<div class="alert"><div>${esc(p.status)}</div></div>`:""}${blocks.join("")||'<div class="empty">No season stats yet.</div>'}<div class="foot">2026 season totals from ESPN, refreshed every few hours.</div>`;
  $("sheetBg").hidden=false;
});
