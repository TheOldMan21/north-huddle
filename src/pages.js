/* ===================== North Huddle: Schedule / Players / Fantasy / News cleanup (Nov 2026) =====================
   Runs after the page modules and redraws parts of what they drew. Single column everywhere.
   Schedule: Up next card, "Still to play" + "Results" (newest first, 4 shown + Show all), one-line notes, compact standings.
   Players: grouped by position with headshots, injury chips by severity, an Injured filter, smaller leader tiles (CSS).
   Fantasy: section buttons all visible (CSS), shorter weekly card, settings folded into one line, Start/Sit grouped by call.
   News: big lead story, grouped by day, two-line blurbs (CSS), older stories behind a button. */
const PG={sRest:false, sDone:false, newsAll:false, fsetOpen:false};

/* ---------- Schedule ---------- */
const pgNote=n=>String(n||"").split(" · ")[0];
function pgCountdown(t){ const ms=Date.parse(t)-Date.now(); if(!(ms>0)) return ""; const d=Math.floor(ms/864e5), h=Math.floor(ms%864e5/36e5), m=Math.floor(ms%36e5/6e4); return d?`${d}d ${h}h`:h?`${h}h ${m}m`:`${m}m`; }
function pgSchedRow(x){
  const fin=x.status==="final", live=x.status==="live", id=x.espnId||"";
  const tag=id?"button":"div", attrs=id?` data-sbgame="${esc(id)}"`:"";
  const right=fin||live?`<div class="pg-res">${fin?`<span class="pg-wl ${x.result==="W"?"w":x.result==="L"?"l":"t"}">${esc(x.result||"")}</span>`:`<span class="chip live">LIVE</span>`}<b class="num">${esc(x.us)}-${esc(x.them)}</b></div>`:"";
  const sub=fin?pgNote(x.note):`${esc(gameWhen(x))}${x.tv?" · "+esc(x.tv):""}`;
  return `<${tag} class="pg-srow"${attrs}><span class="pg-wk">${x.week}</span>${badge(x.oppAbbr)}<span class="pg-sm"><span class="t1">${oppLine(x)}</span><span class="t2">${fin?esc(sub):sub}</span></span>${right}</${tag}>`;
}
function pgSchedule(){
  if(typeof GM!=="undefined"&&GM.mode!=="team") return;
  const el=$("v-games"); if(!el) return;
  const h2=[...el.querySelectorAll(":scope > h2")].find(h=>/schedule/i.test(h.textContent)), list=h2?.nextElementSibling;
  if(!h2||!list||!list.classList.contains("list")) return;
  const g=[...S.games].sort((a,b)=>a.week-b.week);
  const next=g.find(x=>x.status==="live")||g.find(x=>x.status==="scheduled");
  const rest=g.filter(x=>(x.status==="scheduled"||x.status==="bye")&&x!==next&&(!next||x.week>next.week));
  const done=g.filter(x=>x.status==="final").reverse();
  const nextHtml=next?`<button class="pg-next" ${next.espnId?`data-sbgame="${esc(next.espnId)}"`:""}>${badge(next.oppAbbr)}<span class="pg-sm"><span class="pg-lbl">${next.status==="live"?"LIVE NOW":"UP NEXT"} · WEEK ${next.week}</span><span class="pg-nt">${oppLine(next)}</span><span class="t2">${esc(gameWhen(next))}${next.tv?" · "+esc(next.tv):""}</span></span>${next.status==="scheduled"&&pgCountdown(next.kickoff)?`<span class="pg-cd">${esc(pgCountdown(next.kickoff))}</span>`:""}</button>`:"";
  const restRow=x=>x.status==="bye"?`<div class="pg-srow"><span class="pg-wk">${x.week}</span><span class="pg-sm"><span class="t1">Bye week</span></span></div>`:pgSchedRow(x);
  const sect=(title,sub,arr,key,row)=>arr.length?`<h2 class="pg-h">${title}${sub?` <span class="pg-hs">${sub}</span>`:""}</h2><div class="list pg-slist">${(PG[key]?arr:arr.slice(0,4)).map(row).join("")}${arr.length>4?`<button class="pg-more" data-pgmore="${key}">${PG[key]?"Show fewer":`Show all ${arr.length}`}</button>`:""}</div>`:"";
  const html=nextHtml+sect("Still to play","",rest,"sRest",restRow)+sect("Results","· tap a game for the box score",done,"sDone",pgSchedRow);
  h2.insertAdjacentHTML("beforebegin",`<div class="pg-sched stack">${html}</div>`); h2.remove(); list.remove();
}
// compact standings that fit a phone
standingsHtml=function(){
  const rows=[...S.standings].sort((a,b)=>(b.w-b.l)-(a.w-a.l)||(b.pf-b.pa)-(a.pf-a.pa)); if(!rows.length) return "";
  const lead=rows[0];
  return `<h2 class="pg-h">${esc(TEAMS[CUR][2])}</h2><div class="list pg-stand"><div class="pg-strow pg-sthead"><span>Team</span><span>W-L</span><span>GB</span><span>Diff</span></div>${rows.map(r=>{ const gb=((lead.w-r.w)+(r.l-lead.l))/2, d=r.pf-r.pa;
    return `<div class="pg-strow${r.abbr===CUR?" us":""}"><span class="pg-stt">${badge(r.abbr)}<span>${esc(r.team)}</span></span><span class="num">${r.w}-${r.l}${r.t?"-"+r.t:""}</span><span class="num">${gb?gb:"—"}</span><span class="num">${d>0?"+":""}${d}</span></div>`; }).join("")}</div>${S.meta?.standingsNote?`<div class="foot">${esc(S.meta.standingsNote)}</div>`:""}`;
};
const _renderGamesPG=renderGames;
renderGames=function(){ _renderGamesPG(); try{ pgSchedule(); }catch(e){ console.warn("pages/schedule",e); } };

/* ---------- Players ---------- */
const PG_GROUPS=[["Quarterbacks",["QB"]],["Running backs",["RB","FB"]],["Receivers & tight ends",["WR","TE"]],["Offensive line",["OL","OT","G","C","T","OG"]],["Defensive line",["DL","DT","DE","EDGE","NT"]],["Linebackers",["LB","OLB","ILB","MLB"]],["Secondary",["CB","S","DB","FS","SS"]],["Specialists",["K","P","LS"]]];
const pgHurt=s=>s&&s!=="Active";
function pgSev(s){ s=String(s||""); return /out|reserve|\bIR\b|pup|suspend/i.test(s)?"bad":/question|doubt|probable|limited|day/i.test(s)?"warn":"bad"; }
function pgInit(n){ return String(n||"").split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]).join("").toUpperCase(); }
function pgPlayers(){
  const L=$("plist"); if(!L||S.pmode&&S.pmode!=="vikings") return;
  const seg=$("unitSeg"); if(seg&&!seg.querySelector('[data-unit="hurt"]')) seg.insertAdjacentHTML("beforeend",`<button data-unit="hurt" aria-pressed="${S.unit==="hurt"}" class="pg-hurtbtn">Injured</button>`);
  const q=(S.q||"").trim().toLowerCase();
  const list=S.players.filter(p=>(S.unit==="all"||(S.unit==="hurt"?pgHurt(p.status):p.unit===S.unit))&&(!q||p.name.toLowerCase().includes(q)||(p.pos||"").toLowerCase()===q));
  if(!list.length){ L.innerHTML=`<div class="empty">${S.players.length?(S.unit==="hurt"?"No one is on the injury report.":"No players match that search."):"Player stats appear here once data loads."}</div>`; return; }
  const used=new Set(), groups=PG_GROUPS.map(([t,ps])=>[t,list.filter(p=>ps.includes(String(p.pos||"").toUpperCase())&&!used.has(p.id)&&used.add(p.id))]);
  const other=list.filter(p=>!used.has(p.id)); if(other.length) groups.push(["Other",other]);
  const row=p=>{ const [v,l]=keyStat(p), ph=typeof photoFor==="function"?photoFor(p.name):"", st=pgHurt(p.status)?`<span class="pg-inj ${pgSev(p.status)}">${esc(p.status)}</span>`:"";
    return `<button class="row pg-prow" data-player="${esc(p.id)}"><span class="pg-av">${ph?`<img src="${esc(ph)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()">`:""}<i>${esc(pgInit(p.name))}</i></span><div class="grow"><div class="t1">${esc(p.name)} <span class="chip pos">${esc(p.pos||"—")}</span>${st}</div><div class="statline">${esc(statLine(p))}</div></div><div class="keystat num">${esc(v)}<small>${esc(l)}</small></div></button>`; };
  L.classList.add("pg-plist");
  L.innerHTML=groups.filter(g=>g[1].length).map(([t,ps])=>`<div class="pg-grp">${esc(t)}</div>${ps.sort((a,b)=>(b.rank||0)-(a.rank||0)||a.name.localeCompare(b.name)).map(row).join("")}`).join("");
}
const _renderPlayersPG=renderPlayers;
renderPlayers=function(){ _renderPlayersPG(); try{ pgPlayers(); }catch(e){ console.warn("pages/players",e); } };

/* ---------- Fantasy ---------- */
function pgFantasy(){
  const v=$("v-fantasy"); if(!v) return;
  // shorter weekly card
  const sum=v.querySelector(".fh-sum"); if(sum&&!sum.dataset.pg){ const full=sum.textContent; sum.dataset.pg="1"; sum.title=full; sum.textContent=typeof hfSent==="function"?hfSent(full):full; }
  const lock=v.querySelector(".fh-lock"); if(lock&&!lock.dataset.pg){ const full=lock.textContent; lock.dataset.pg="1"; lock.title=full; const first=full.split(/;\s*/)[0].trim(); lock.textContent=first?first.replace(/\.$/,"")+".":full; }
  // settings in one line
  const set=$("fSetup");
  if(set){
    const pick=sel=>set.querySelector(`${sel}[aria-pressed="true"]`)?.textContent.trim()||"";
    const txt=[pick("[data-fscore]"),pick("[data-ffmt]"),pick("[data-flevel]")].filter(Boolean);
    let bar=v.querySelector(".pg-fset");
    if(!bar){ set.insertAdjacentHTML("beforebegin",`<div class="pg-fset"><span class="pg-fst"></span><button class="tbtn" data-pgfset="1">Change</button></div>`); bar=v.querySelector(".pg-fset"); }
    const t=bar.querySelector(".pg-fst"), html=txt.length?`<b>${esc(txt[0])}</b>${txt.slice(1).map(x=>" · "+esc(x)).join("")}`:"Your league settings";
    if(t.innerHTML!==html) t.innerHTML=html;
    set.classList.toggle("pg-closed",!PG.fsetOpen); const b=bar.querySelector("button"); if(b&&b.textContent!==(PG.fsetOpen?"Done":"Change")) b.textContent=PG.fsetOpen?"Done":"Change";
  }
  // Start/Sit grouped by the call
  const body=$("fantasyBody"), sec=$("fSeg")?.querySelector('[aria-pressed="true"]')?.dataset.fsec;
  if(body&&sec==="startsit"){
    const lst=[...body.querySelectorAll(":scope > .list")].find(l=>l.querySelector(".fcall")&&!l.classList.contains("pg-fgroup"));
    if(lst){
      const rows=[...lst.querySelectorAll(":scope > .frow")], by={start:[],flex:[],sit:[]};
      rows.forEach(r=>{ const c=r.querySelector(".fcall")?.textContent.trim().toLowerCase(); (by[c]||by.flex).push(r); });
      const frag=document.createDocumentFragment();
      [["start","Start them"],["flex","Flex plays"],["sit","Sit them"]].forEach(([k,t])=>{ if(!by[k].length) return;
        const h=document.createElement("h2"); h.className="pg-h pg-fh "+k; h.innerHTML=`<i></i>${t} <span class="pg-hs">${by[k].length}</span>`; frag.appendChild(h);
        const l=document.createElement("div"); l.className="list pg-fgroup"; by[k].forEach(r=>l.appendChild(r)); frag.appendChild(l); });
      lst.replaceWith(frag);
    }
  }
}
document.addEventListener("click",e=>{ if(e.target.closest("[data-pgfset]")){ PG.fsetOpen=!PG.fsetOpen; pgFantasy(); } },true);
const _renderFantasyPG=renderFantasy;
renderFantasy=function(){ _renderFantasyPG(); try{ pgFantasy(); }catch(e){ console.warn("pages/fantasy",e); } };
(()=>{ const v=$("v-fantasy"); if(!v||typeof MutationObserver==="undefined") return; let q=0, busy=false;
  new MutationObserver(()=>{ if(busy||q) return; q=setTimeout(()=>{ q=0; busy=true; try{ pgFantasy(); }catch(e){} setTimeout(()=>busy=false,0); },30); }).observe(v,{childList:true,subtree:true}); })();

/* ---------- News ---------- */
function pgDay(d){ const t=Date.parse(d); if(!t) return "Earlier"; const day=x=>new Date(x).toLocaleDateString("en-CA",{timeZone:"America/Chicago"});
  const today=day(Date.now()), yest=day(Date.now()-864e5), k=day(t);
  return k===today?"Today":k===yest?"Yesterday":Date.now()-t<7*864e5?"Earlier this week":"Older"; }
function pgNews(){
  if(S.ntype&&S.ntype!=="news"&&S.ntype!=="stories") return;
  const el=$("newsBody"); if(!el||!S.news.length||!el.querySelector(".list .news-item")) return;
  const ns=[...S.news].sort((a,b)=>Date.parse(b.date||0)-Date.parse(a.date||0));
  const lead=ns[0], rest=ns.slice(1), shown=PG.newsAll?rest:rest.slice(0,14);
  const groups=[]; shown.forEach(n=>{ const k=pgDay(n.date); let g=groups.find(x=>x[0]===k); if(!g) groups.push(g=[k,[]]); g[1].push(n); });
  el.innerHTML=`<div class="list pg-lead hf-news">${newsItem(lead)}</div>`
    +groups.map(([k,arr])=>`<h2 class="pg-h pg-day">${esc(k)}</h2><div class="list pg-nlist">${arr.map(newsItem).join("")}</div>`).join("")
    +(rest.length>14?`<button class="pg-more pg-newsmore" data-pgmore="newsAll">${PG.newsAll?"Show fewer stories":"Show older stories"}</button>`:"")
    +`<div class="foot">Tap a story to read the full article.</div>`;
  el.querySelector(".pg-lead .news-item")?.classList.add("hf-lead");
}
const _renderNewsPG=renderNews;
renderNews=function(){ _renderNewsPG(); try{ pgNews(); }catch(e){ console.warn("pages/news",e); } };

/* ---------- show more / fewer ---------- */
document.addEventListener("click",e=>{ const b=e.target.closest("[data-pgmore]"); if(!b) return; const k=b.dataset.pgmore; PG[k]=!PG[k];
  if(k==="newsAll") renderNews(); else renderGames(); });
// keep the Up next countdown fresh
setInterval(()=>{ if(!document.hidden&&S.tab==="games"&&(typeof GM==="undefined"||GM.mode==="team")){ const n=S.games.find(x=>x.status==="scheduled"), c=document.querySelector(".pg-next .pg-cd"); if(n&&c) c.textContent=pgCountdown(n.kickoff); } },60000);
// draw once now in case the pages rendered before this file loaded
try{ if(S.games?.length) renderGames(); if(S.players?.length) renderPlayers(); if(S.news?.length) renderNews(); }catch(e){}
