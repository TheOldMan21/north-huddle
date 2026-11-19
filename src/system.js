/* ===================== North Huddle: admin "System" tab — topology map, jobs, data freshness, controls ===================== */
// Everything here is read-only health info gathered from the site's own data (docs.updated_at, sys/status written by the
// free GitHub updater, push/state written by the alerts worker) plus quick probes of the site's live functions.
const NH_BUILD="__NH_BUILD__";
const SYS={loaded:false, loading:false, at:0, sel:"updater", probe:{}, fresh:{}, status:null, stats:null, schema:null, counts:{}, visitors:null, subs:null, err:""};
const GH="https://github.com/TheOldMan21/north-huddle", GH_RUN=GH+"/actions/workflows/site-update.yml", GH_STATS=GH+"/actions/workflows/espn-data.yml";
const SB_DASH="https://supabase.com/dashboard/project/hoxcsdtbljhfappkshya", CF_DASH="https://dash.cloudflare.com/?to=/:account/pages";
const minsAgo=t=>t?Math.round((Date.now()-Date.parse(t))/60e3):null;
const ageTxt=t=>{ const m=minsAgo(t); if(m==null) return "never"; if(m<1) return "just now"; if(m<60) return m+" min ago"; if(m<1440) return Math.round(m/60)+" hr ago"; const d=Math.round(m/1440); return d+(d===1?" day ago":" days ago"); };
const health=(t,ok,warn)=>{ const m=minsAgo(t); return m==null?"off":m<=ok?"ok":m<=warn?"warn":"bad"; };
async function sysProbe(name,url){ const t0=performance.now(); try{ const r=await fetch(url,{cache:"no-store"}); const ms=Math.round(performance.now()-t0); let j=null; try{ j=await r.clone().json(); }catch(e){} SYS.probe[name]={ok:r.ok,ms,j}; }catch(e){ SYS.probe[name]={ok:false,ms:0}; } }
async function sysLoad(){
  if(SYS.loading) return; SYS.loading=true; renderAdmin();
  const sb=NH.sb, newest=async(col)=>{ const {data}=await sb.from("docs").select("path,updated_at,data").eq("col",col).order("updated_at",{ascending:false}).limit(1); return data&&data[0]; };
  const one=async(path)=>{ const {data}=await sb.from("docs").select("path,updated_at,data").eq("path",path).limit(1); return data&&data[0]; };
  const count=async(col)=>{ const {count:c}=await sb.from("docs").select("path",{count:"exact",head:true}).eq("col",col); return c||0; };
  try{
    const [st,ps,meta,schema,news,vids,inj,dep,pl,fan,stand,games]=await Promise.all([one("sys/status"),one("push/state"),one("hub/meta"),one("sys/schema"),newest("news"),newest("videos"),newest("injuries"),newest("depth"),newest("players"),newest("fantasy"),newest("standings"),newest("games")]);
    SYS.status=st?.data||null; SYS.statusAt=st?.updated_at||null; SYS.pushAt=ps?.data?.at||null; SYS.schema=schema?.data||null; SYS.meta=meta?.data||{};
    // "last checked" = the newest of the free updater's last good run and the last Claude refresh (hub/meta.updatedAt)
    const sd=st?.data, newer=(...t)=>t.filter(Boolean).sort().slice(-1)[0]||null, okAt=k=>sd&&sd.parts?.[k]?.ok!==false&&sd.parts?.[k]?sd.at:null, claude=meta?.data?.updatedAt;
    const {data:nw}=await sb.from("docs").select("data").eq("col","news").order("data->>date",{ascending:false}).limit(1);
    const {data:vw}=await sb.from("docs").select("data").eq("col","videos").order("data->>date",{ascending:false}).limit(1);
    const {data:fw}=await sb.from("docs").select("data").eq("path","fantasy/week").limit(1);
    SYS.fresh={hub:newer(okAt("hub"),claude), news:newer(okAt("news"),claude), newsDate:nw?.[0]?.data?.date, videos:newer(okAt("videos"),claude), videoDate:vw?.[0]?.data?.date, fantasy:fw?.[0]?.data?.updatedAt||null};
    const cs=await Promise.all(["news","players","injuries","videos","chat","leagues","scores"].map(count)); ["news","players","injuries","videos","chat","leagues","scores"].forEach((c,i)=>SYS.counts[c]=cs[i]);
    try{ const day=new Date(Date.now()-864e5).toISOString(); const {data:v}=await sb.from("visits").select("uid,device").gte("at",day).limit(2000); SYS.visitors=v?{people:new Set(v.map(r=>r.uid||"g"+r.device)).size, members:new Set(v.filter(r=>r.uid).map(r=>r.uid)).size}:null; }catch(e){}
    try{ const {count:c}=await sb.from("push_subs").select("uid",{count:"exact",head:true}); SYS.subs=c; }catch(e){}
    SYS.err="";
  }catch(e){ SYS.err=String(e?.message||e); }
  await Promise.all([sysProbe("scores","/api/scores?team=MIN"), sysProbe("team","/api/team?abbr=MIN"), sysProbe("standings","/api/standings"), sysProbe("announce","/api/announce?list=1"), sysProbe("players","/api/data?f=players"), (async()=>{ try{ const r=await fetch("/api/kick",{method:"POST",headers:{"x-probe":"1"}}); SYS.probe.kick={j:await r.json()}; }catch(e){} })()]);
  SYS.stats=SYS.probe.players?.j?.updatedAt||null; if(SYS.probe.players) SYS.probe.players.j=null;
  SYS.loaded=true; SYS.loading=false; SYS.at=Date.now(); if(ADM.tab==="system") renderAdmin();
}
/* ---------- the nodes on the map ---------- */
function sysNodes(){
  const s=SYS.status, up=s?health(s.at,45,180):"off", parts=s?.parts||{};
  const p=SYS.probe, pr=k=>!p[k]?"off":p[k].ok?(p[k].ms>2500?"warn":"ok"):"bad";
  const N={
    espn:{row:0,ic:"📡",name:"ESPN",sub:"Scores, stats, injuries, depth, news",st:[pr("scores"),pr("team")].includes("bad")?"bad":pr("scores"),
      info:"ESPN's public data is the main source. The live functions read it every time someone opens the site, and the updater reads it every 20 minutes.",
      facts:[["Live scores check",p.scores?`${p.scores.ok?"OK":"Failed"} · ${p.scores.ms} ms`:"—"],["Team feed check",p.team?`${p.team.ok?"OK":"Failed"} · ${p.team.ms} ms`:"—"]]},
    vik:{row:0,ic:"📰",name:"Vikings.com",sub:"Team news feed",st:!s?"off":parts.news?.ok===false?"bad":"ok",info:"The updater reads the team's news feed every run and adds new stories with a one-line summary.",facts:[["Stories on the site",SYS.counts.news??"—"],["Newest story",ageTxt(SYS.fresh.newsDate)],["Last checked",ageTxt(SYS.fresh.news)]]},
    yt:{row:0,ic:"▶️",name:"YouTube",sub:"Interviews & pressers",st:!s?"off":parts.videos?.ok===false?"bad":"ok",info:"Press conferences and interviews come from the team's YouTube channel feed.",facts:[["Interviews on the site",SYS.counts.videos??"—"],["Newest interview",ageTxt(SYS.fresh.videoDate)],["Last checked",ageTxt(SYS.fresh.videos)]]},
    ai:{row:0,ic:"✨",name:"AI helpers",sub:"Summaries, recaps, voice",st:!s?"off":s.ai==="unavailable"?"warn":"ok",
      info:"Free AI (Cloudflare Workers AI): writes one-line news and injury summaries during updates (via /api/summarize), game recaps, answers Ask AI and voices the Kirko Chainz announcer.",
      facts:[["Summaries last run",s?(s.ai==="unavailable"?"Unavailable (stories saved without a summary)":`${s.ai} written`):"—"],["Announcer voice",p.announce?.ok?"Ready":"Unavailable"]]},
    sleeper:{row:0,ic:"🏈",name:"Sleeper",sub:"Fantasy players",st:"ok",info:"Members' Sleeper leagues load straight from Sleeper in their browser. A player list copy is refreshed hourly by the stats job.",facts:[]},
    updater:{row:1,ic:"⚙️",name:"Site updater",sub:"GitHub · every 20 min",st:up,link:GH_RUN,
      info:"The free robot that keeps the site current: schedule and scores, standings, record, player stats and game logs, depth chart, injuries, news, interviews, tracked players and fantasy league scoring. Runs every 20 minutes (every 10 during games) on GitHub, at no cost.",
      facts:s?[["Last run",ageTxt(s.at)],["Took",s.secs+" sec"],["Changes last run",s.changeCount],["Problems",s.errors?.length?s.errors.join("; "):"None"]]:[["Status","Waiting for setup: add the NH_BOT_PW secret on GitHub (see Setup below)"]]},
    stats:{row:1,ic:"📊",name:"Stats job",sub:"GitHub · hourly",st:health(SYS.stats,240,720),link:GH_STATS,info:"Collects season stat leaders for all 32 teams (used by player search and other team hubs). Hourly, every 20 minutes during games.",facts:[["Last file",ageTxt(SYS.stats)]]},
    live:{row:1,ic:"⚡",name:"Live functions",sub:"Cloudflare · on demand",st:["scores","team","standings"].map(pr).includes("bad")?"bad":["scores","team","standings"].map(pr).includes("warn")?"warn":"ok",link:CF_DASH,
      info:"Small programs on Cloudflare that answer the site's live requests: scores every minute, team feed every 3 minutes, standings, flags, win chances, recaps, link previews and the announcer.",
      facts:[["Scores",p.scores?p.scores.ms+" ms":"—"],["Team feed",p.team?p.team.ms+" ms":"—"],["Standings",p.standings?p.standings.ms+" ms":"—"]]},
    alerts:{row:1,ic:"🔔",name:"Game alerts",sub:"Cloudflare · every minute",st:health(SYS.pushAt,5,60),info:"A Cloudflare Worker that checks scores every minute and sends phone notifications for kickoff, scores and finals.",facts:[["Last check",ageTxt(SYS.pushAt)],["Phones signed up",SYS.subs??"—"]]},
    db:{row:2,ic:"🗄️",name:"Database",sub:"Supabase",st:SYS.err?"bad":"ok",link:SB_DASH,info:"Everything the site saves lives here: hub data, members, chat, leagues, scores, settings. Access rules decide who can change what.",
      facts:[["Players",SYS.counts.players??"—"],["Chat messages",SYS.counts.chat??"—"],["Fantasy leagues",SYS.counts.leagues??"—"],["Game score records",SYS.counts.scores??"—"],["Security update",SYS.schema?.round>=6?"Installed":"Not installed yet"]]},
    site:{row:3,ic:"🌐",name:"Website",sub:"north-huddle.pages.dev",st:"ok",link:CF_DASH,info:"The site itself, hosted on Cloudflare Pages. Every change pushed to GitHub goes live in about a minute.",facts:[["This version built",NH_BUILD.startsWith("__")?"—":ageTxt(NH_BUILD)],["Security headers","On"]]},
    people:{row:4,ic:"👥",name:"Fans",sub:SYS.visitors?`${SYS.visitors.people} in the last 24 hrs`:"Visitors",st:"ok",info:"Members and guests using the site. See the Activity tab for who opened it and when.",facts:[["People (24 hrs)",SYS.visitors?.people??"—"],["Members (24 hrs)",SYS.visitors?.members??"—"],["Phone alerts on",SYS.subs??"—"]]}
  };
  const E=[["espn","updater"],["espn","stats"],["espn","live"],["espn","alerts"],["vik","updater"],["yt","updater"],["ai","updater"],["ai","live"],["sleeper","site"],
           ["updater","db"],["stats","live"],["alerts","db"],["db","site"],["live","site"],["site","people"],["alerts","people"]];
  return {N,E};
}
const SYS_COL={ok:"#22c55e",warn:"#f5b301",bad:"#ef4444",off:"#8b95a7"};
const SYS_LBL={ok:"Healthy",warn:"Slow / stale",bad:"Problem",off:"Not set up"};
function sysMap(){
  const {N}=sysNodes(), rows=[0,1,2,3,4].map(r=>Object.entries(N).filter(([,n])=>n.row===r));
  const titles=["Sources","Jobs & functions","Database","Website","Fans"];
  return `<div class="sys-topo" id="sysTopo"><svg class="sys-wires" id="sysWires" aria-hidden="true"></svg>
    ${rows.map((r,i)=>`<div class="sys-row"><div class="sys-rl">${titles[i]}</div><div class="sys-nodes">${r.map(([id,n])=>`<button class="sys-node${SYS.sel===id?" sel":""}" data-sysnode="${id}" style="--st:${SYS_COL[n.st]}"><span class="sys-ic">${n.ic}</span><span class="sys-nt"><b>${esc(n.name)}</b><small>${esc(n.sub)}</small></span><i class="sys-dot" title="${SYS_LBL[n.st]}"></i></button>`).join("")}</div></div>`).join("")}</div>`;
}
function sysWires(){
  const box=$("sysTopo"), svg=$("sysWires"); if(!box||!svg) return; const {N,E}=sysNodes(), r0=box.getBoundingClientRect();
  svg.setAttribute("width",r0.width); svg.setAttribute("height",r0.height); svg.setAttribute("viewBox",`0 0 ${r0.width} ${r0.height}`);
  const pos=id=>{ const el=box.querySelector(`[data-sysnode="${id}"]`); if(!el) return null; const r=el.getBoundingClientRect(); return {x:r.left-r0.left+r.width/2, top:r.top-r0.top, bot:r.bottom-r0.top}; };
  svg.innerHTML=E.map(([a,b])=>{ const A=pos(a), B=pos(b); if(!A||!B) return ""; const st=[N[a].st,N[b].st].includes("bad")?"bad":[N[a].st,N[b].st].includes("off")?"off":[N[a].st,N[b].st].includes("warn")?"warn":"ok";
    const y1=A.bot, y2=B.top, my=(y1+y2)/2, sel=SYS.sel===a||SYS.sel===b;
    return `<path d="M${A.x},${y1} C${A.x},${my} ${B.x},${my} ${B.x},${y2}" class="sys-wire${sel?" sel":""}${st==="off"?" off":""}" style="--wc:${SYS_COL[st]}"/>`; }).join("");
}
function sysDetail(){
  const {N}=sysNodes(), n=N[SYS.sel]||N.updater;
  return `<div class="card sys-detail" style="--st:${SYS_COL[n.st]}"><div class="sys-dh"><span class="sys-ic big">${n.ic}</span><div class="grow"><div class="t1">${esc(n.name)}</div><div class="t2"><i class="sys-dot"></i> ${SYS_LBL[n.st]}</div></div>${n.link?`<a class="tbtn" href="${esc(n.link)}" target="_blank" rel="noopener">Open ↗</a>`:""}</div>
    <p class="acct-p">${esc(n.info)}</p>${n.facts.length?`<div class="sys-facts">${n.facts.map(([l,v])=>`<div><span>${esc(l)}</span><b>${esc(String(v))}</b></div>`).join("")}</div>`:""}
    ${SYS.sel==="updater"?`<div class="sys-acts"><button class="btn-gold" data-syskick>▶ Run an update now</button><span class="t2">${SYS.kick||"Starts the free updater right away. Fresh data in about a minute."}</span></div>`:""}</div>`;
}
function sysFresh(){
  const f=SYS.fresh, rows=[
    ["Live scores","Every minute while open",SYS.probe.scores?.ok?"ok":"bad","Live"],
    ["Record, schedule & standings","Every 20 min",health(f.hub,60,360),"checked "+ageTxt(f.hub)],
    ["Player stats & game logs","Every 20 min",health(f.hub,60,360),"checked "+ageTxt(f.hub)],
    ["Injuries & depth chart","Every 20 min + live",health(f.hub,60,360),"checked "+ageTxt(f.hub)],
    ["News","Every 20 min",health(f.news,60,360),"newest "+ageTxt(f.newsDate)],
    ["Interviews","Every 20 min",health(f.videos,120,720),"newest "+ageTxt(f.videoDate)],
    ["Fantasy tab","Weekly (Tue)",health(f.fantasy,10080,20160),ageTxt(f.fantasy)],
    ["All-teams stats","Hourly",health(SYS.stats,240,720),ageTxt(SYS.stats)]];
  return `<div class="sys-grid">${rows.map(([n,how,st,v])=>`<div class="sys-f" style="--st:${SYS_COL[st]}"><i class="sys-dot"></i><div class="grow"><b>${n}</b><small>${how}</small></div><span>${esc(v)}</span></div>`).join("")}</div>`;
}
function sysJobs(){
  const s=SYS.status, hist=(s?.history||[]).slice(0,48).reverse();
  const spark=hist.length?`<div class="sys-spark" title="Last ${hist.length} runs">${hist.map(h=>`<i style="height:${Math.min(100,15+h.changes*4)}%;background:${h.ok?"#22c55e":"#ef4444"}" title="${esc(new Date(h.at).toLocaleString("en-US",{timeZone:"America/Chicago"}))}: ${h.changes} changes"></i>`).join("")}</div>`:"";
  const jobs=[
    ["⚙️","Site updater","GitHub · every 20 min (10 during games)",s?`Last ran ${ageTxt(s.at)} · ${s.changeCount} changes`:"Waiting for setup",s?health(s.at,45,180):"off",GH_RUN],
    ["📊","Stats job","GitHub · hourly (20 min during games)",SYS.stats?`Last file ${ageTxt(SYS.stats)}`:"—",health(SYS.stats,240,720),GH_STATS],
    ["🔔","Game alerts","Cloudflare Worker · every minute",SYS.pushAt?`Last check ${ageTxt(SYS.pushAt)}`:"—",health(SYS.pushAt,5,60),""],
    ["🤖","Claude backup tasks","Claude · 3×/day + game days","Stand down on their own while the updater is healthy; Tuesdays they only refresh the fantasy tab.",s&&health(s.at,90,90)==="ok"?"ok":"warn",""]];
  return `<div class="list">${jobs.map(([ic,n,sch,last,st,link])=>`<div class="row sys-job" style="--st:${SYS_COL[st]}"><span class="sys-ic">${ic}</span><div class="grow"><div class="t1">${n} <i class="sys-dot"></i></div><div class="t2">${sch}</div><div class="t2">${esc(last)}</div></div>${link?`<a class="tbtn" href="${link}" target="_blank" rel="noopener">Runs ↗</a>`:""}</div>`).join("")}</div>
    ${spark?`<div class="label" style="margin-top:10px">Updater: last ${hist.length} runs</div>${spark}`:""}
    ${s?.changes?.length?`<details class="sys-ch"><summary>What changed in the last update (${s.changeCount})</summary><ul>${s.changes.map(c=>`<li>${esc(c)}</li>`).join("")}</ul></details>`:""}`;
}
function sysSetup(){
  const s=SYS.status, items=[
    [!!s,"Free updater turned on",`GitHub → Settings → Secrets and variables → Actions → New repository secret. Name: <b>NH_BOT_PW</b>, value: the bot password. <a href="${GH}/settings/secrets/actions/new" target="_blank" rel="noopener">Open ↗</a>`],
    [(SYS.schema?.round||0)>=5,"Guest numbers (round5.sql)",`Supabase → SQL Editor → paste <a href="${GH}/blob/main/supabase/round5.sql" target="_blank" rel="noopener">round5.sql</a> → Run.`],
    [(SYS.schema?.round||0)>=6,"Security update (round6.sql)",`Then paste <a href="${GH}/blob/main/supabase/round6.sql" target="_blank" rel="noopener">round6.sql</a> → Run.`],
    [SYS.probe.kick?.j?.reason==="ready","One-tap & on-time updates (optional)",`GitHub's schedule can run late. Make a key: <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">GitHub → Fine-grained token ↗</a> → only this repository → Permissions: Actions = Read and write → Generate. Then Cloudflare → Workers &amp; Pages → north-huddle → Settings → Variables and Secrets → Add <b>GH_DISPATCH_TOKEN</b> (type Secret) with that key → Save, then redeploy.`],
    [null,"Two-step login on your accounts","Turn on 2FA for GitHub, Cloudflare, Supabase and your Google account. These control the whole site."]];
  return `<div class="list">${items.map(([ok,t,how])=>`<div class="row sys-chk"><span class="sys-ck ${ok?"y":ok===false?"n":"q"}">${ok?"✓":ok===false?"!":"•"}</span><div class="grow"><div class="t1">${t}</div>${ok?"":`<div class="t2">${how}</div>`}</div></div>`).join("")}</div>`;
}
function sysControls(){
  const m=SYS.meta||{};
  return `<div class="card"><div class="t1">Top-of-site alert</div><p class="t2">The yellow headline on Home. The updater replaces it with new big news or a final score.</p>
    <form id="sysAlert" class="sys-alert"><input name="a" maxlength="160" value="${esc(m.alert||"")}" placeholder="One short headline"><button class="tbtn" type="submit">Save</button><button class="tbtn" type="button" data-sysalertclear>Clear</button></form></div>
    <div class="sys-links"><a class="tbtn" href="${GH}/actions" target="_blank" rel="noopener">GitHub jobs ↗</a><a class="tbtn" href="${SB_DASH}" target="_blank" rel="noopener">Database ↗</a><a class="tbtn" href="${CF_DASH}" target="_blank" rel="noopener">Cloudflare ↗</a><a class="tbtn" href="${GH}/commits/main" target="_blank" rel="noopener">Site changes ↗</a></div>`;
}
function admSystem(){
  if(!SYS.loaded&&!SYS.loading){ sysLoad(); }
  if(!SYS.loaded) return skelRows(5);
  const {N}=sysNodes(), bad=Object.values(N).filter(n=>n.st==="bad").length, warn=Object.values(N).filter(n=>n.st==="warn"||n.st==="off").length;
  const head=bad?["bad","Something needs attention","Tap a red dot on the map to see what's wrong."]:warn?["warn","Mostly healthy","A few parts are slow, stale or not set up yet."]:["ok","Everything's running","The site is updating itself. Nothing for you to do."];
  return `<div class="sys-head" style="--st:${SYS_COL[head[0]]}"><i class="sys-dot big"></i><div class="grow"><div class="t1">${head[1]}</div><div class="t2">${head[2]} Checked ${ageTxt(new Date(SYS.at).toISOString())}.</div></div><button class="tbtn" data-sysreload>Re-check</button></div>
    <h2>How it all connects</h2><p class="t2">Data flows top to bottom: sources → the jobs that read them → the database → the website → fans. Tap any box.</p>
    ${sysMap()}${sysDetail()}
    <h2>How fresh is everything</h2>${sysFresh()}
    <h2>Scheduled jobs</h2>${sysJobs()}
    <h2>Setup checklist</h2>${sysSetup()}
    <h2>Controls</h2>${sysControls()}`;
}
const _renderAdminSYS=renderAdmin;
renderAdmin=function(){
  const ov=$("adminView");
  if(ov&&!ov.querySelector('[data-adm-tab="system"]')) ov.querySelector(".adm-tabs")?.insertAdjacentHTML("afterbegin",`<button data-adm-tab="system">System</button>`);
  if(ADM.tab!=="system"){ _renderAdminSYS(); return; }
  ov.querySelectorAll("[data-adm-tab]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.admTab===ADM.tab)));
  ov.querySelector(".adm-body").innerHTML=admSystem(); requestAnimationFrame(sysWires);
};
window.addEventListener("resize",()=>{ if(ADM.tab==="system") sysWires(); });
document.addEventListener("click",async e=>{
  const n=e.target.closest("[data-sysnode]"); if(n){ SYS.sel=n.dataset.sysnode; renderAdmin(); setTimeout(()=>document.querySelector(".sys-detail")?.scrollIntoView({behavior:"smooth",block:"nearest"}),30); return; }
  if(e.target.closest("[data-sysreload]")||(e.target.closest("[data-adm-refresh]")&&ADM.tab==="system")){ SYS.loaded=false; sysLoad(); return; }
  if(e.target.closest("[data-sysalertclear]")){ await sysSaveAlert(""); return; }
  if(e.target.closest("[data-syskick]")){ SYS.kick="Starting…"; renderAdmin();
    try{ const {data}=await NH.sb.auth.getSession(); const r=await fetch("/api/kick?force=1",{method:"POST",headers:{authorization:"Bearer "+(data?.session?.access_token||"")}}); const j=await r.json();
      if(j.ok){ SYS.kick="Started! Tap Re-check in a minute to see the result."; }
      else if(j.reason==="not_configured"){ SYS.kick="One-tap runs need the GitHub key (see Setup). Opening GitHub instead…"; window.open(GH_RUN,"_blank","noopener"); }
      else SYS.kick="Couldn't start it ("+j.reason+")."; }catch(err){ SYS.kick="Couldn't start it."; }
    renderAdmin(); return; }
});
document.addEventListener("submit",async e=>{ if(e.target.id!=="sysAlert") return; e.preventDefault(); await sysSaveAlert(String(new FormData(e.target).get("a")||"").trim()); });
async function sysSaveAlert(a){ try{ await ACC.db.doc("hub/meta").update({alert:a, alertAt:nowIso()}); SYS.meta={...SYS.meta,alert:a}; toast(a?"Alert saved.":"Alert cleared."); renderAdmin(); }catch(err){ toast("Couldn't save the alert."); } }
// open on the System tab by default
if(typeof openAdmin==="function"){ const _openAdminSYS=openAdmin; openAdmin=function(){ if(!ADM._sysDefault){ ADM._sysDefault=1; if(ADM.tab==="members") ADM.tab="system"; } _openAdminSYS(); }; }

// Any visit nudges the free updater when its last run is more than 25 minutes old (GitHub's schedule can lag).
setTimeout(async()=>{ try{
  const last=Number(localStorage.getItem("nh_kick")||0); if(Date.now()-last<10*60e3) return;
  const {data}=await NH.sb.from("docs").select("data").eq("path","sys/status").limit(1); const at=data?.[0]?.data?.at;
  if(at&&Date.now()-Date.parse(at)<25*60e3) return;
  localStorage.setItem("nh_kick",String(Date.now())); fetch("/api/kick",{method:"POST"}).catch(()=>{});
}catch(e){} },6000);
