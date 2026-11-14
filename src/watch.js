/* ===================== North Huddle: Watch / Listen buttons + live highlights ===================== */
// The game itself plays in the official app that has the rights; we just get people there in one tap.
const NETS=[
  [/\bCBS\b/i,         {name:"CBS",           app:"Paramount+",   url:"https://www.paramountplus.com/live-tv/"}],
  [/\bFOX\b/i,         {name:"FOX",           app:"FOX Sports",   url:"https://www.foxsports.com/live"}],
  [/\bNBC\b|Peacock/i, {name:"NBC",           app:"Peacock",      url:"https://www.peacocktv.com/sports"}],
  [/\bESPN\b|\bABC\b/i,{name:"ESPN / ABC",    app:"ESPN",         url:"https://www.espn.com/watch/"}],
  [/Prime|Amazon/i,    {name:"Prime Video",   app:"Prime Video",  url:"https://www.amazon.com/primevideo"}],
  [/Netflix/i,         {name:"Netflix",       app:"Netflix",      url:"https://www.netflix.com/"}],
  [/YouTube/i,         {name:"YouTube",       app:"YouTube",      url:"https://www.youtube.com/"}],
  [/NFL ?Net|NFLN/i,   {name:"NFL Network",   app:"NFL+",         url:"https://www.nfl.com/plus/"}]
];
const ALWAYS=[{app:"NFL+",note:"Local and prime-time games on your phone or tablet",url:"https://www.nfl.com/plus/"},
  {app:"YouTube TV",note:"Live TV, includes CBS, FOX, NBC, ESPN",url:"https://tv.youtube.com/"},
  {app:"Fubo",note:"Live TV, includes CBS, FOX, NBC, ESPN",url:"https://www.fubo.tv/"},
  {app:"NFL Sunday Ticket",note:"Out-of-market Sunday afternoon games",url:"https://tv.youtube.com/nfl/"}];
const RADIO={MIN:{station:"KFAN 100.3 FM",url:"https://kfan.iheart.com/"}};
function netsFor(tv){ const out=[]; String(tv||"").split(/[,/]| and /).map(s=>s.trim()).filter(Boolean).forEach(t=>{ const m=NETS.find(([re])=>re.test(t)); if(m&&!out.some(o=>o.app===m[1].app)) out.push(m[1]); }); return out; }
const ICO_TVW=`<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="5" width="19" height="12.5" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10 9l5 2.5-5 2.5z" fill="currentColor"/></svg>`;
const ICO_RADIO=`<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="8" width="18" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="15.5" cy="14" r="2.6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M6 12h5M6 15.5h5M7 8l10-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
function openWatch(tv,label){
  const nets=netsFor(tv), r=RADIO[CUR];
  const row=(o,primary)=>`<a class="card wt-row${primary?" primary":""}" href="${esc(o.url)}" target="_blank" rel="noopener"><span class="wt-ico">${ICO_TVW}</span><span class="grow"><b>${esc(o.app)}</b><span class="t2">${esc(o.note||("Watch on "+(o.name||o.app)))}</span></span><span class="wt-go">Open ›</span></a>`;
  $("sheet").innerHTML=`<div class="sheet-head"><div><div class="label">Watch &amp; listen</div><div class="nm" style="font-size:24px">${esc(label||"This game")}</div></div><button class="x" id="closeSheet" aria-label="Close">×</button></div>
    ${nets.length?`<h2>On TV: ${esc(nets.map(n=>n.name).join(", "))}</h2>${nets.map(n=>row({...n,note:`Official ${n.name} stream (sign in with your TV provider or subscription)`},true)).join("")}`:`<p class="acct-p">The TV channel for this game isn't announced yet.</p>`}
    <h2>Other ways to watch</h2>${ALWAYS.filter(a=>!nets.some(n=>n.app===a.app)).map(a=>row(a,false)).join("")}
    <h2>Listen live</h2>
    ${r?`<a class="card wt-row" href="${esc(r.url)}" target="_blank" rel="noopener"><span class="wt-ico">${ICO_RADIO}</span><span class="grow"><b>${esc(r.station)}</b><span class="t2">Official ${esc(NICK())} radio play-by-play</span></span><span class="wt-go">Listen ›</span></a>`:""}
    <a class="card wt-row" href="https://www.nfl.com/plus/" target="_blank" rel="noopener"><span class="wt-ico">${ICO_RADIO}</span><span class="grow"><b>NFL+ audio</b><span class="t2">Live radio calls for every game, home and away</span></span><span class="wt-go">Listen ›</span></a>
    <div class="foot">North Huddle doesn't stream games. These open the official apps and sites. Some need a subscription or TV provider. Tip: keep North Huddle open next to the game for live plays, stats and chat.</div>`;
  $("sheetBg").hidden=false;
}
document.addEventListener("click",e=>{ const b=e.target.closest("[data-watch]"); if(b){ e.preventDefault(); e.stopPropagation(); openWatch(b.dataset.watch,b.dataset.wlabel); } },true);
function watchBtn(tv,label,cls){ return `<button class="${cls||"tbtn"} wt-btn" data-watch="${esc(tv||"")}" data-wlabel="${esc(label||"")}">${ICO_TVW}<span>Watch</span></button>`; }
function gameLabel(g){ return `${NICK()} ${g.home?"vs":"at"} ${oppName(g)}`; }
function tvOf(g){ if(g?.tv) return g.tv; const lg=liveFor(CUR); return lg?.tv||""; }
// Home: game-day card (next to Watch party) and the next-game card
const _renderHomeWT=renderHome;
renderHome=function(){
  _renderHomeWT(); if(!S.meta) return;
  const gdTop=$("v-home")?.querySelector(".gameday .gd-top"), g=liveGameNow()||soonGame();
  if(gdTop&&g&&!gdTop.querySelector(".wt-btn")){ const wrap=document.createElement("div"); wrap.className="gd-acts"; wrap.innerHTML=watchBtn(tvOf(g),gameLabel(g),"wpv-btn"); const wp=gdTop.querySelector("[data-wparty]"); if(wp) wrap.append(wp); gdTop.append(wrap); }
  const cd=$("v-home")?.querySelector("#countdown"), nxt=S.games.find(x=>x.status==="scheduled"&&x.kickoff&&Date.parse(x.kickoff)>Date.now()-4*36e5);
  if(cd&&nxt){ const card=cd.closest(".game-card"); if(card&&!card.querySelector(".wt-btn")) card.querySelector(".gc-head")?.insertAdjacentHTML("beforeend",watchBtn(tvOf(nxt),gameLabel(nxt))); }
  placeLiveHL();
};
// Game details sheet
const _renderGameSheetWT=renderGameSheet;
renderGameSheet=function(){ _renderGameSheetWT(); const s=GM.sheet; if(!s) return; const x=(s.data?.games||LIVE.data?.games||[]).find(g=>String(g.id)===String(s.id)); if(!x||x.state==="post") return;
  const hd=$("sheet").querySelector(".sheet-head"); if(hd&&!$("sheet").querySelector(".wt-btn")) hd.insertAdjacentHTML("afterend",`<div class="wt-line">${watchBtn(x.tv,`${TEAMS[x.away]?.[1]||x.away} at ${TEAMS[x.home]?.[1]||x.home}`)}<span class="t2">${esc(x.tv||"TV channel TBA")}</span></div>`); };

/* ---------- live highlights: new clips appear on the game-day card during the game ---------- */
function liveHLGame(){ const lg=liveFor(CUR); if(!lg||lg.state==="pre"||!HL.data) return null; return (HL.data.games||[]).find(g=>String(g.id)===String(lg.id))||null; }
function placeLiveHL(){
  const gd=$("v-home")?.querySelector(".gameday"); if(!gd) return; gd.querySelector(".lhl")?.remove();
  const g=liveHLGame(); if(!g||!g.videos?.length) return;
  const vids=g.videos.slice().sort((a,b)=>String(b.at).localeCompare(String(a.at))).slice(0,8);
  const h=`<div class="gd-sec lhl"><div class="label">Latest highlights <span class="lhl-new">${vids.length} ${vids.length===1?"clip":"clips"}</span></div><div class="hl-row">${vids.map(v=>hlVid(v,g,false)).join("")}</div></div>`;
  const foot=gd.querySelector(".gd-foot"); if(foot) foot.insertAdjacentHTML("beforebegin",h); else gd.insertAdjacentHTML("beforeend",h);
}
// refresh clips every 2 minutes while our game is on
setInterval(()=>{ if(document.hidden) return; const lg=liveFor(CUR); if(lg&&lg.state==="in"){ HL.at=0; loadHL(true).then(()=>{ if(S.tab==="home") placeLiveHL(); }); } },120e3);
