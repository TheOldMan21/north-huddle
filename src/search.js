/* ===================== North Huddle: site search + Huddle AI assistant ===================== */
const SR={open:false, q:"", ai:{ready:null, msgs:[], busy:false}};
const ICO_SEARCH=`<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M15.5 15.5L20 20" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`;
const ICO_SPARK=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l1.8 5.4L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.6zM19 14l.9 2.6 2.6.9-2.6.9L19 21l-.9-2.6-2.6-.9 2.6-.9zM5 15l.7 1.8 1.8.7-1.8.7L5 20l-.7-1.8L2.5 17.5l1.8-.7z"/></svg>`;
(function(){ const h=document.querySelector("header.top"); if(h&&!$("hSearch")) h.insertAdjacentHTML("beforeend",`<div class="hsearch" id="hSearch"><button class="hs-field" id="searchBtn" aria-label="Search the site">${ICO_SEARCH}<span>Search players, teams, news…</span></button><button class="hs-ai" data-hsai="1" aria-label="Ask Huddle AI" title="Ask Huddle AI">${ICO_SPARK}<span>Ask AI</span></button></div>`); })();

/* ---------- what can be found ---------- */
function sections(){
  const go=(tab,fn)=>()=>{ closeSearch(); setTab(tab); if(fn) fn(); };
  const fx=sec=>go("fantasy",()=>{ FX.sec=sec; renderFantasy(); });
  const gm=m=>go("games",()=>{ GM.mode=m; store.set("vh_gmode",m); renderGames(); });
  const pm=m=>go("players",()=>setPmode(m));
  const list=[
    ["Home","home scores today game day",go("home")],
    ["Game picks & score predictions","pick winner predict score leaderboard",go("home",()=>setTimeout(()=>$("predCard")?.scrollIntoView({block:"center"}),150))],
    ["Fan chat","chat talk message",go("home",()=>setTimeout(()=>$("fanChat")?.scrollIntoView({block:"center"}),150))],
    [`${NICK()} schedule`,"schedule games results bye",gm("team")],
    ["All scores (every game)","scoreboard live scores nfl games week",gm("scores")],
    ["Standings & playoff picture","standings playoffs seeds division wild card",gm("standings")],
    [`${NICK()} roster & stats`,"players roster stats leaders",pm("vikings")],
    ["Depth chart","depth chart starters lineup field injuries injury report",pm("depth")],
    ["Search any NFL player / Tracker","tracker track player search nfl",pm("tracker")],
    ["Compare players","compare versus vs",pm("compare")],
    ["Fantasy league","fantasy league draft trade waivers matchup",fx("league")],
    ["Sleeper league","sleeper fantasy import",fx("sleeper")],
    ["Start / Sit","start sit fantasy advice",fx("startsit")],
    ["Waiver wire","waivers pickups free agents",fx("waivers")],
    ["Fantasy rankings","rankings fantasy",fx("rankings")],
    ["Fantasy injuries","injuries fantasy",fx("injuries")],
    ["Learn fantasy football","learn beginner how to play fantasy",fx("learn")],
    ["News","news stories headlines",go("news")],
    ["Interviews & press conferences","interviews videos press conference coach",go("news",()=>document.querySelector('[data-nmode="videos"],[data-ntab="videos"]')?.click())],
    ["My account & game alerts","account profile photo name sign in alerts notifications settings",()=>{ closeSearch(); openAcct(); }],
    ["Switch team","team switch change other teams",()=>{ closeSearch(); $("teamBtn")?.click(); }],
  ];
  if(ACC.owner) list.push(["Admin page","admin members ban vip donor polls",()=>{ closeSearch(); openAdmin(); }]);
  return list.map(([label,kw,act])=>({type:"Section",label,kw,act}));
}
function srScore(text,q){ const t=text.toLowerCase(); if(t===q) return 100; if(t.startsWith(q)) return 80; if(t.split(/[^a-z0-9]+/).some(w=>w.startsWith(q))) return 60; if(t.includes(q)) return 40; return 0; }
function searchAll(q){
  q=q.trim().toLowerCase(); if(q.length<2) return [];
  const out=[], add=(item,score)=>{ if(score>0) out.push({...item,score}); };
  sections().forEach(s=>add(s,Math.max(srScore(s.label,q),srScore(s.kw,q)*.9)));
  Object.entries(TEAMS).forEach(([a,t])=>add({type:"Team",label:`${t[0]} ${t[1]}`,sub:t[2],badge:a,act:()=>{ closeSearch(); setTeam(a); setTab("home"); }},Math.max(srScore(`${t[0]} ${t[1]}`,q),srScore(t[1],q),a.toLowerCase()===q?95:0)));
  (S.players||[]).forEach(p=>add({type:"Player",label:p.name,sub:`${p.pos||""} · ${NICK()}`,badge:CUR,act:()=>{ closeSearch(); setTab("players"); openPlayer(p.id); }},(sc=>sc?sc+5:0)(srScore(p.name,q))));
  if(LP.data) Object.entries(LP.data.teams||{}).forEach(([a,ps])=>{ if(a===CUR) return; ps.forEach(p=>add({type:"Player",label:p.name,sub:`${p.pos||""} · ${TEAMS[a]?.[1]||a}`,badge:a,act:()=>{ closeSearch(); openLeaguePlayer(a,p.name); }},srScore(p.name,q))); });
  (S.news||[]).forEach(n=>add({type:"News",label:n.headline,sub:`${n.source||""} · ${ago(n.date)}`,act:()=>{ closeSearch(); if(n.url) window.open(n.url,"_blank","noopener"); else setTab("news"); }},srScore(n.headline,q)*.8));
  (S.games||[]).filter(g=>g.opp).forEach(g=>add({type:"Game",label:`Week ${g.week}: ${g.home?"vs":"at"} ${g.opp}`,sub:g.status==="final"?`${g.result||""} ${g.us}-${g.them}`:g.kickoff?fmtDate(g.kickoff,{weekday:"short",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}):"",badge:g.oppAbbr,act:()=>{ closeSearch(); setTab("games"); GM.mode="team"; renderGames(); }},Math.max(srScore(g.opp,q),srScore(`week ${g.week}`,q))*.85));
  const seen=new Set();
  return out.sort((a,b)=>b.score-a.score).filter(r=>{ const k=r.type+r.label+(r.badge||""); if(seen.has(k)) return false; seen.add(k); return true; }).slice(0,14);
}
function openLeaguePlayer(abbr,name){ const el=document.createElement("div"); el.setAttribute("data-lp",abbr+"|"+name); document.body.appendChild(el); el.click(); el.remove(); }

/* ---------- overlay ---------- */
function openSearch(prefill,ai){
  SR.aiMode=!!ai;
  let ov=$("searchView");
  if(!ov){
    ov=document.createElement("div"); ov.id="searchView"; ov.setAttribute("role","dialog"); ov.setAttribute("aria-label","Search");
    ov.innerHTML=`<div class="sv-top"><div class="sv-box">${ICO_SEARCH}<input id="svInput" type="search" autocomplete="off" placeholder="Search players, teams, news… or ask a question" aria-label="Search North Huddle"></div><button class="tbtn" data-svclose="1">Cancel</button></div><div class="sv-body" id="svBody"></div>`;
    document.body.appendChild(ov);
    $("svInput").addEventListener("input",e=>{ SR.q=e.target.value; renderSearch(); });
    $("svInput").addEventListener("keydown",e=>{ if(e.key==="Enter"){ e.preventDefault(); const q=SR.q.trim(); if(!q) return; const r=searchAll(q); if(SR.aiMode||looksLikeQuestion(q)||!r.length) askAI(q); else r[0].act(); } });
  }
  ov.hidden=false; document.body.classList.add("sv-open"); SR.open=true;
  $("svInput").placeholder=SR.aiMode?"Ask Huddle AI anything about football…":"Search players, teams, news… or ask a question";
  $("svInput").value=prefill||SR.q||""; SR.q=$("svInput").value; renderSearch(); setTimeout(()=>$("svInput").focus(),30);
  loadLeaguePlayers().then(()=>{ if(SR.open) renderSearch(); });
  aiReady();
}
function closeSearch(){ const ov=$("searchView"); if(ov) ov.hidden=true; document.body.classList.remove("sv-open"); SR.open=false; }
const looksLikeQuestion=q=>/\?$|^(who|what|when|where|why|how|is|are|can|should|will|do|does|did|which|tell|explain)\b/i.test(q.trim());
function renderSearch(){
  const b=$("svBody"); if(!b) return;
  const q=SR.q.trim(), res=SR.aiMode?[]:searchAll(q);
  const aiRow=q.length>=2&&SR.ai.ready!==false?`<button class="sv-row sv-ai" data-svask="1"><span class="sv-ico">${ICO_SPARK}</span><div class="grow"><div class="t1">Ask Huddle AI</div><div class="t2">“${esc(q)}”</div></div><span class="chev">›</span></button>`:"";
  const groups={}; res.forEach(r=>(groups[r.type]=groups[r.type]||[]).push(r));
  const order=["Section","Team","Player","Game","News"];
  const rows=order.filter(t=>groups[t]).map(t=>`<div class="sv-h">${t==="Section"?"On the site":t+"s"}</div>${groups[t].map(r=>`<button class="sv-row" data-svi="${res.indexOf(r)}">${r.badge?`<span class="sv-b">${badge(r.badge)}</span>`:`<span class="sv-ico">${ICO_SEARCH}</span>`}<div class="grow"><div class="t1">${esc(r.label)}</div>${r.sub?`<div class="t2">${esc(r.sub)}</div>`:""}</div></button>`).join("")}`).join("");
  const chat=SR.ai.msgs.length?`<div class="sv-h">${ICO_SPARK} Huddle AI</div><div class="ai-thread" id="aiThread">${SR.ai.msgs.map(m=>`<div class="ai-msg ${m.role}">${esc(m.content).replace(/\n/g,"<br>")}</div>`).join("")}${SR.ai.busy?'<div class="ai-msg assistant ai-typing"><span></span><span></span><span></span></div>':""}</div><div class="t2 ai-note">AI answers can be wrong. Check scores and stats on the site.</div><button class="tbtn" data-aiclear="1">Clear conversation</button>`:"";
  const empty=!SR.aiMode&&!q&&!SR.ai.msgs.length?`<div class="sv-tips"><div class="sv-h">Try</div>${["Justin Jefferson","Standings","Packers","Sleeper","When is the next game?","What is a safety in football?"].map(s=>`<button class="chip sv-chip" data-svq="${esc(s)}">${esc(s)}</button>`).join("")}${SR.ai.ready===false?"":`<p class="t2">Type a question and press Enter to ask <b>Huddle AI</b>, the site's assistant.</p>`}</div>`:"";
  const aiHello=SR.aiMode&&!SR.ai.msgs.length?`<div class="ai-hello"><div class="ai-badge">${ICO_SPARK}</div><div class="t1">Ask Huddle AI</div><p class="t2">Your football assistant. It knows the site's latest scores, schedule, stats, injuries and standings, and can explain rules and fantasy strategy.</p>${SR.ai.ready===false?'<p class="t2"><b>The assistant is being set up.</b> Check back soon!</p>':["When is the next Vikings game?","Who leads the team in receiving yards?","Who's injured right now?","Explain what a two-point conversion is","Who should I start in fantasy this week?"].map(x=>`<button class="sv-row sv-sugg" data-svq="${esc(x)}">${ICO_SPARK}<span>${esc(x)}</span></button>`).join("")}</div>`:"";
  b.innerHTML=aiHello+chat+(SR.aiMode?"":aiRow)+(q&&!res.length?`<div class="t2 sv-none">No matches on the site for “${esc(q)}”.</div>`:"")+rows+empty;
  SR.last=res; const th=$("aiThread"); if(th) th.scrollTop=th.scrollHeight;
}
document.addEventListener("click",e=>{
  if(e.target.closest("#searchBtn")) return openSearch();
  if(e.target.closest("[data-svclose]")) return closeSearch();
  const r=e.target.closest("[data-svi]"); if(r){ SR.last?.[Number(r.dataset.svi)]?.act(); return; }
  const c=e.target.closest("[data-svq]"); if(c){ $("svInput").value=c.dataset.svq; SR.q=c.dataset.svq; if(SR.aiMode||looksLikeQuestion(SR.q)) askAI(SR.q); else renderSearch(); return; }
  if(e.target.closest("[data-hsai]")) return openSearch("",true);
  if(e.target.closest("[data-svask]")) return askAI(SR.q.trim());
  if(e.target.closest("[data-aiclear]")){ SR.ai.msgs=[]; renderSearch(); }
});
document.addEventListener("keydown",e=>{ if(e.key==="Escape"&&SR.open) closeSearch(); if((e.key==="/"&&!e.target.closest("input,textarea"))||((e.ctrlKey||e.metaKey)&&e.key==="k")){ e.preventDefault(); openSearch(); } });

/* ---------- Huddle AI ---------- */
async function aiReady(){ if(SR.ai.ready!==null) return SR.ai.ready; try{ const r=await fetch("/api/ask"); const d=await r.json(); SR.ai.ready=!!d.ready; }catch(e){ SR.ai.ready=false; } if(SR.open) renderSearch(); return SR.ai.ready; }
function aiContext(){
  const m=S.meta||{}, L=[];
  L.push(`Team being viewed: ${TEAMS[CUR][0]} ${TEAMS[CUR][1]} (${CUR}). Record ${m.record||"?"} (home ${m.recordHome||"?"}, away ${m.recordAway||"?"}), ${m.divisionRank||""}, streak ${m.streak||"?"}, points for ${m.pf??"?"}, against ${m.pa??"?"}.`);
  if(m.alert) L.push(`Top headline: ${m.alert}`);
  L.push("Schedule: "+(S.games||[]).map(g=>g.status==="bye"?`Wk${g.week} BYE`:`Wk${g.week} ${g.home?"vs":"at"} ${g.oppAbbr} ${g.status==="final"?`${g.result} ${g.us}-${g.them}`:g.status==="live"?`LIVE ${g.us}-${g.them} ${g.note||""}`:(g.kickoff?new Date(g.kickoff).toLocaleString("en-US",{timeZone:"America/Chicago",weekday:"short",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})+" CT":"")}${g.tv?" "+g.tv:""}`).join("; "));
  L.push("Players (season stats): "+(S.players||[]).slice(0,30).map(p=>{ const s=p.stats||{}, x=[]; if(s.pass) x.push(`${s.pass.cmp}/${s.pass.att} ${s.pass.yds} pass yds ${s.pass.td} TD ${s.pass.int} INT`); if(s.rush?.yds) x.push(`${s.rush.att??"?"} car ${s.rush.yds} rush yds ${s.rush.td} TD`); if(s.rec?.yds) x.push(`${s.rec.rec} rec ${s.rec.yds} yds ${s.rec.td} TD`); if(s.def&&(s.def.tkl||s.def.sacks)) x.push(`${s.def.tkl} tkl ${s.def.sacks} sacks ${s.def.int} INT`); if(s.kick) x.push(`FG ${s.kick.fgm}/${s.kick.fga}`); return `${p.name} (${p.pos}${p.status?", "+p.status:""}): ${x.join(", ")||"no stats"}`; }).join(" | "));
  if(S.injuries?.length) L.push("Injuries: "+S.injuries.slice(0,15).map(i=>`${i.player} ${i.pos} – ${i.status}${i.injury?" ("+i.injury+")":""}`).join("; "));
  if(S.depth?.length) L.push("Starters: "+S.depth.filter(d=>d.unit!=="special").map(d=>`${d.pos} ${d.players?.[0]||""}`).join(", "));
  if(S.news?.length) L.push("Recent news: "+S.news.slice(0,10).map(n=>`${n.headline}${n.summary?" — "+n.summary:""} (${ago(n.date)})`).join(" | "));
  const D=GM.stand?.divisions||LEAGUE.standings; if(D){ const div=D[TEAMS[CUR][2]]; if(div) L.push(`${TEAMS[CUR][2]} standings: `+div.map(r=>`${r.abbr} ${r.w}-${r.l}${r.t?"-"+r.t:""}`).join(", ")); const seeds=Object.values(D).flat().filter(r=>r.seed&&r.seed<=7); if(seeds.length) L.push("Playoff seeds: "+["NFC","AFC"].map(c=>c+": "+Object.entries(D).filter(([n])=>n.startsWith(c)).flatMap(([,rs])=>rs).filter(r=>r.seed&&r.seed<=7).sort((a,b)=>a.seed-b.seed).map(r=>`${r.seed}.${r.abbr}`).join(" ")).join("; ")); }
  const lg=LIVE.data?.games; if(lg?.length) L.push(`This week's NFL games (week ${LIVE.data.week||"?"}): `+lg.map(x=>`${x.away} ${x.state==="pre"?"":x.as} @ ${x.home} ${x.state==="pre"?"":x.hs} (${x.state==="pre"?new Date(x.kickoff).toLocaleString("en-US",{timeZone:"America/Chicago",weekday:"short",hour:"numeric",minute:"2-digit"})+" CT":x.detail})`).join("; "));
  const wk=typeof fdoc==="function"?fdoc("week"):null; if(wk) L.push(`Fantasy ${wk.title||""}: ${wk.summary||""} Byes: ${(wk.byes||[]).join(", ")}`);
  return L.join("\n");
}
async function askAI(q){
  if(!q||SR.ai.busy) return;
  if(SR.ai.ready===false) return toast("The assistant isn't turned on yet.");
  SR.ai.msgs.push({role:"user",content:q}); SR.ai.busy=true; $("svInput").value=""; SR.q=""; renderSearch();
  try{
    const r=await fetch("/api/ask",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({q, context:aiContext(), history:SR.ai.msgs.slice(0,-1).slice(-6)})});
    const d=await r.json().catch(()=>({}));
    SR.ai.msgs.push({role:"assistant",content:d.answer||(d.error==="rate_limited"?"You've asked a lot this hour. Try again a bit later!":d.error==="not_configured"?"The assistant isn't turned on yet.":"Sorry, I couldn't answer that right now. Try again in a moment.")});
  }catch(e){ SR.ai.msgs.push({role:"assistant",content:"Sorry, I couldn't reach the assistant. Check your connection and try again."}); }
  SR.ai.busy=false; if(SR.open) renderSearch();
}

/* ---------- voice: talk to Huddle AI ---------- */
const SpeechRec=window.SpeechRecognition||window.webkitSpeechRecognition;
const ICO_MIC=`<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
const ICO_SPEAK=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
const VOICE={rec:null, on:false, speak:store.get("nh_speak")==="1"};
function micButtons(){
  const box=document.querySelector("#searchView .sv-box"); if(!box||box.querySelector(".sv-mic")) return;
  if(SpeechRec) box.insertAdjacentHTML("beforeend",`<button class="sv-mic" data-mic="1" aria-label="Ask by voice" title="Ask by voice">${ICO_MIC}</button>`);
  if("speechSynthesis" in window) box.insertAdjacentHTML("beforeend",`<button class="sv-spk${VOICE.speak?" on":""}" data-speak="1" aria-label="Read answers out loud" aria-pressed="${VOICE.speak}" title="Read answers out loud">${ICO_SPEAK}</button>`);
}
function startVoice(){
  if(!SpeechRec) return toast("Voice isn't supported in this browser. Try Chrome.");
  if(VOICE.on){ VOICE.rec?.stop(); return; }
  const r=new SpeechRec(); VOICE.rec=r; r.lang="en-US"; r.interimResults=true; r.maxAlternatives=1;
  const inp=$("svInput"), mic=document.querySelector(".sv-mic"); let finalText="";
  r.onstart=()=>{ VOICE.on=true; mic?.classList.add("listening"); inp.placeholder="Listening… ask your question"; };
  r.onresult=e=>{ let t=""; for(let i=0;i<e.results.length;i++){ t+=e.results[i][0].transcript; if(e.results[i].isFinal) finalText=t; } inp.value=t; SR.q=t; if(!SR.aiMode) renderSearch(); };
  r.onerror=e=>{ if(e.error==="not-allowed"||e.error==="service-not-allowed") toast("Allow microphone access to ask by voice."); else if(e.error==="no-speech") toast("Didn't catch that. Tap the mic and try again."); };
  r.onend=()=>{ VOICE.on=false; mic?.classList.remove("listening"); inp.placeholder=SR.aiMode?"Ask Huddle AI anything about football…":"Search players, teams, news… or ask a question"; const q=(finalText||inp.value).trim(); if(q){ SR.aiMode=true; askAI(q); } };
  try{ r.start(); }catch(e){ toast("Couldn't start the microphone."); }
}
function speakAnswer(text){
  if(!VOICE.speak||!("speechSynthesis" in window)||!text) return;
  speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(text); u.lang="en-US"; u.rate=1.03; speechSynthesis.speak(u);
}
document.addEventListener("click",e=>{
  if(e.target.closest("[data-mic]")){ e.preventDefault(); startVoice(); return; }
  const s=e.target.closest("[data-speak]"); if(s){ e.preventDefault(); VOICE.speak=!VOICE.speak; store.set("nh_speak",VOICE.speak?"1":"0"); s.classList.toggle("on",VOICE.speak); s.setAttribute("aria-pressed",String(VOICE.speak)); if(!VOICE.speak) speechSynthesis.cancel(); else toast("Huddle AI will read answers out loud."); }
  if(e.target.closest("[data-svclose]")&&"speechSynthesis" in window) speechSynthesis.cancel();
});
const _openSearchV=openSearch;
openSearch=function(prefill,ai){ _openSearchV(prefill,ai); micButtons(); };
const _askAIV=askAI;
askAI=async function(q){ const n=SR.ai.msgs.length; await _askAIV(q); const last=SR.ai.msgs[SR.ai.msgs.length-1]; if(SR.ai.msgs.length>n&&last?.role==="assistant") speakAnswer(last.content); };
// mic shortcut right on the header bar
(function(){ const f=$("searchBtn"); if(f&&SpeechRec&&!document.querySelector(".hs-mic")) f.insertAdjacentHTML("beforeend",`<span class="hs-mic" data-hsmic="1" role="button" aria-label="Ask by voice">${ICO_MIC}</span>`); })();
document.addEventListener("click",e=>{ if(e.target.closest("[data-hsmic]")){ e.stopPropagation(); e.preventDefault(); openSearch("",true); setTimeout(startVoice,150); } },true);
