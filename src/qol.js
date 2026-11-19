/* ===================== North Huddle: quality of life (Nov 2026) =====================
   1. Guests can make game picks and score predictions. They're saved on the phone (nh_gpicks); after the game
      the card says how they did and invites them to join. When they sign up, picks for games that haven't
      started are copied to their account.
   2. Add to calendar: Google Calendar link or an .ics file for the next game, or the whole season.
   3. Player names in the alert, recaps and fantasy notes open that player's card. */

/* ---------- 1. guest picks ---------- */
const GP={ get(){ try{ return JSON.parse(localStorage.getItem("nh_gpicks")||"{}"); }catch(e){ return {}; } },
           set(o){ try{ localStorage.setItem("nh_gpicks",JSON.stringify(o)); }catch(e){} } };
const gpGuest=()=>!(ACC.id&&ACC.db);
function gpResult(g,p){
  if(!p||g.status!=="final"||g.us==null) return null;
  const win=g.us>g.them?CUR:g.us<g.them?g.oppAbbr:"", out=[];
  if(p.pick) out.push(p.pick===win?"✓ You picked the winner":"✗ Your winner pick missed");
  if(p.us!=null){ const sc=typeof predScore==="function"?predScore({us:p.us,them:p.them},g):null; out.push(`Your score ${p.us}–${p.them}${sc!=null?` · ${sc} pts`:""}`); }
  return {right:p.pick===win, text:out.join(" · ")};
}
function gpLastResultHtml(){
  const all=GP.get(), done=S.games.filter(g=>g.status==="final"&&all[gameKey(g)]).sort((a,b)=>b.week-a.week)[0]; if(!done) return "";
  const r=gpResult(done,all[gameKey(done)]); if(!r) return "";
  return `<div class="gp-last ${r.right?"ok":"no"}"><b>Week ${esc(done.week)} ${done.home?"vs":"at"} ${esc(done.oppAbbr)}:</b> ${esc(r.text)}. <button class="hf-link" data-acct="1">Create a free account</button> to keep score on the season leaderboard.</div>`;
}
const _predCardHtmlQ=predCardHtml;
predCardHtml=function(){
  if(!gpGuest()) return _predCardHtmlQ();
  const g=nextGameForPred(); if(!g) return "";
  const k=gameKey(g), mine=GP.get()[k]||{}, locked=Date.now()>=Date.parse(g.kickoff)||g.status!=="scheduled";
  const name=a=>a===CUR?NICK():(oppName(g).split(" ").slice(-1)[0]);
  const btn=a=>`<button class="wp-pick${mine.pick===a?" mine":""}" ${locked?"disabled":""} data-gpick="${esc(k)}" data-pickteam="${esc(a)}" aria-pressed="${mine.pick===a}">${badge(a)}<span class="wpk-name">${esc(name(a))}</span></button>`;
  const form=locked?(mine.us!=null?`<div class="t2">Your prediction: <b>${esc(CUR)} ${esc(mine.us)}–${esc(mine.them)}</b></div>`:`<div class="t2">Predictions are locked.</div>`)
    :`<form class="pred-form" data-gpred="${esc(k)}"><label>${badge(CUR)}<input name="us" type="number" inputmode="numeric" min="0" max="99" value="${mine.us??""}" required aria-label="${esc(CUR)} points"></label><span class="pred-dash">–</span><label><input name="them" type="number" inputmode="numeric" min="0" max="99" value="${mine.them??""}" required aria-label="${esc(g.oppAbbr)} points">${badge(g.oppAbbr)}</label><button class="btn-gold" type="submit">${mine.us!=null?"Update":"Save"}</button></form>`;
  const vs=`${g.home?"vs":"at"} ${esc(oppName(g))}`;
  return `<section class="card pred-card gp-card" id="predCard" style="order:7"><div class="pred-head"><div><div class="label">Game picks · Week ${esc(g.week)}</div><div class="t1">${esc(NICK())} ${vs}</div></div><button class="tbtn" data-predlb="1">Leaderboard</button></div>
    ${gpLastResultHtml()}
    <div class="wpk"><div class="label">Who wins?</div><div class="wpk-btns">${btn(CUR)}${btn(g.oppAbbr)}</div><div class="t2">${locked?"Picks are locked.":mine.pick?"Tap the other team to switch":"Tap a team to make your pick"}</div></div>
    <div class="pred-sub label">Predict the score</div>${form}
    <div class="t2 gp-note">Saved on this phone. <button class="hf-link" data-acct="1">Create a free account</button> to join the leaderboard.</div></section>`;
};
document.addEventListener("click",e=>{
  const b=e.target.closest("[data-gpick]"); if(!b||b.disabled) return;
  const k=b.dataset.gpick, g=S.games.find(x=>gameKey(x)===k); if(g&&Date.now()>=Date.parse(g.kickoff)) return toast("Picks are locked.");
  const all=GP.get(); all[k]={...(all[k]||{}), pick:b.dataset.pickteam, t:nowIso()}; GP.set(all);
  toast(`You picked ${b.dataset.pickteam===CUR?NICK():b.dataset.pickteam}!`); renderHome();
});
document.addEventListener("submit",e=>{
  const f=e.target.closest("[data-gpred]"); if(!f) return; e.preventDefault(); e.stopImmediatePropagation();
  const us=parseInt(f.us.value,10), them=parseInt(f.them.value,10);
  if(!(us>=0&&us<100&&them>=0&&them<100)) return toast("Enter both scores.");
  const k=f.dataset.gpred, g=S.games.find(x=>gameKey(x)===k); if(g&&Date.now()>=Date.parse(g.kickoff)) return toast("Predictions are locked.");
  const all=GP.get(); all[k]={...(all[k]||{}), us, them, t:nowIso()}; GP.set(all);
  toast("Prediction saved on this phone!"); document.activeElement?.blur?.(); renderHome();
},true);
// after signing up / in: copy picks for games that haven't started yet into the account
accReady.then(async()=>{
  if(gpGuest()) return; const all=GP.get(), keys=Object.keys(all); if(!keys.length) return; let n=0;
  for(const k of keys){ const g=S.games.find(x=>gameKey(x)===k), p=all[k]; if(!g||Date.now()>=Date.parse(g.kickoff)) continue;
    try{ if(p.pick){ await ACC.db.doc(`predictions/pick-${k}__${ACC.id}`).set({uid:ACC.id, game:k, kind:"pick", pick:p.pick, t:nowIso()}); n++; }
         if(p.us!=null){ await ACC.db.doc(`predictions/${k}__${ACC.id}`).set({uid:ACC.id, game:k, us:p.us, them:p.them, t:nowIso()}); n++; } }catch(e){} }
  GP.set({}); if(n) toast("Your picks were added to your account.");
});

/* ---------- 2. add to calendar ---------- */
const calStamp=t=>new Date(t).toISOString().replace(/[-:]/g,"").replace(/\.\d{3}/,"");
const calEsc=s=>String(s||"").replace(/[\\;,]/g,m=>"\\"+m).replace(/\n/g,"\\n");
function calTitle(g){ return `${NICK()} ${g.home?"vs":"at"} ${g.opp||g.oppAbbr}`; }
function calEvent(g){ const s=Date.parse(g.kickoff), e=s+3.5*36e5;
  return ["BEGIN:VEVENT",`UID:nh-${CUR.toLowerCase()}-${g.id||g.week}@north-huddle`,`DTSTAMP:${calStamp(Date.now())}`,`DTSTART:${calStamp(s)}`,`DTEND:${calStamp(e)}`,
    `SUMMARY:${calEsc(calTitle(g))}`,`LOCATION:${calEsc(g.venue||"")}`,`DESCRIPTION:${calEsc(`Week ${g.week}${g.tv?" · TV: "+g.tv:""}\nhttps://north-huddle.pages.dev/`)}`,"END:VEVENT"].join("\r\n"); }
function calFile(games,name){
  const body=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//North Huddle//Schedule//EN","CALSCALE:GREGORIAN","X-WR-CALNAME:North Huddle games",...games.map(calEvent),"END:VCALENDAR"].join("\r\n");
  const url=URL.createObjectURL(new Blob([body],{type:"text/calendar"})), a=document.createElement("a"); a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),5000);
}
function calGoogle(g){ const s=Date.parse(g.kickoff); return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(calTitle(g))}&dates=${calStamp(s)}/${calStamp(s+3.5*36e5)}&details=${encodeURIComponent(`Week ${g.week}${g.tv?" · TV: "+g.tv:""}\nhttps://north-huddle.pages.dev/`)}&location=${encodeURIComponent(g.venue||"")}`; }
const calNext=()=>S.games.filter(g=>g.status==="scheduled"&&g.kickoff&&Date.parse(g.kickoff)>Date.now()).sort((a,b)=>Date.parse(a.kickoff)-Date.parse(b.kickoff));
function openCal(){
  const up=calNext(), g=up[0]; if(!g) return toast("No upcoming games to add.");
  $("sheet").innerHTML=`<div class="sheet-head"><div><div class="label">Add to calendar</div><div class="nm">${esc(calTitle(g))}</div></div><button class="x" id="closeSheet" aria-label="Close">×</button></div>
    <p class="t2">${esc(gameWhen(g))}${g.tv?" · "+esc(g.tv):""}</p>
    <div class="cal-opts"><a class="hf-btn hf-grad cal-btn" href="${esc(calGoogle(g))}" target="_blank" rel="noopener">Google Calendar</a>
    <button class="hf-btn cal-btn cal-sec" data-calics="next">Apple or Outlook (.ics file)</button>
    ${up.length>1?`<button class="hf-btn cal-btn cal-sec" data-calics="all">All ${up.length} remaining games (.ics file)</button>`:""}</div>
    <div class="foot">An .ics file opens in your phone's calendar app. Game times can change; check back before kickoff.</div>`;
  $("sheetBg").hidden=false; $("closeSheet").focus();
}
document.addEventListener("click",e=>{
  if(e.target.closest("[data-cal]")){ e.preventDefault(); return openCal(); }
  const b=e.target.closest("[data-calics]"); if(!b) return; const up=calNext(); if(!up.length) return;
  if(b.dataset.calics==="all") calFile(up,"north-huddle-games.ics"); else calFile([up[0]],`north-huddle-week-${up[0].week}.ics`);
});
function qolCal(){
  const n=document.querySelector("#v-home .hf-next .hf-acts"); if(n&&!n.querySelector("[data-cal]")) n.insertAdjacentHTML("beforeend",`<button class="hf-calbtn" data-cal="1">Add to calendar</button>`);
  const s=document.querySelector("#v-games .pg-sched"); if(s&&!s.querySelector("[data-cal]")&&calNext().length) s.querySelector(".pg-next")?.insertAdjacentHTML("afterend",`<button class="pg-calrow" data-cal="1">Add games to your calendar</button>`);
}

/* ---------- 3. player names open their card ---------- */
let QN={sig:"", re:null, map:{}};
function qolNameRe(){
  const ps=(S.players||[]).filter(p=>p.name&&/\s/.test(p.name)), sig=ps.length+":"+(ps[0]?.id||""); if(sig===QN.sig) return QN.re;
  QN.map={}; ps.forEach(p=>{ QN.map[p.name.toLowerCase()]=p.id; const short=p.name.replace(/\s+(Jr\.?|Sr\.?|II|III|IV)$/,""); QN.map[short.toLowerCase()]=p.id; });
  const names=Object.keys(QN.map).sort((a,b)=>b.length-a.length).map(n=>n.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"));
  QN.re=names.length?new RegExp(`\\b(${names.join("|")})\\b`,"gi"):null; QN.sig=sig; return QN.re;
}
function qolLinkNames(root){
  const re=qolNameRe(); if(!re||!root) return;
  const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:n=>n.parentElement.closest("a,button,input,textarea,.qn,script,style")?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT});
  const nodes=[]; while(w.nextNode()) nodes.push(w.currentNode);
  nodes.forEach(t=>{ re.lastIndex=0; if(!re.test(t.nodeValue)) return; re.lastIndex=0;
    const frag=document.createDocumentFragment(); let last=0, m;
    while((m=re.exec(t.nodeValue))){ const id=QN.map[m[1].toLowerCase()]; if(!id) continue;
      frag.appendChild(document.createTextNode(t.nodeValue.slice(last,m.index)));
      const b=document.createElement("button"); b.className="qn"; b.dataset.player=id; b.textContent=m[1]; frag.appendChild(b); last=m.index+m[1].length; }
    frag.appendChild(document.createTextNode(t.nodeValue.slice(last))); t.replaceWith(frag); });
}
function qolNames(){
  document.querySelectorAll("#v-home .alert, #v-home .hf-sum, #v-fantasy .freason, #sheet .rcp-p, #v-home .gd-alert").forEach(qolLinkNames);
}

/* ---------- 4. "Checked X ago" instead of "Updated" (when the data last changed) ---------- */
let QS_AT=null;
claude.use("db").then(db=>db.doc("sys/status").onSnapshot(x=>{ QS_AT=x.data()?.at||null; qolUpd(); },()=>{})).catch(()=>{});
function qolUpd(){
  const u=document.querySelector("#v-home .upd-line"); if(!u) return;
  const m=S.meta?.updatedAt, t=[QS_AT,m].filter(Boolean).sort((a,b)=>Date.parse(a)-Date.parse(b)).pop(); if(!t) return;
  let sp=u.querySelector(".qu-t");
  if(!sp){ [...u.childNodes].forEach(n=>{ if(n.nodeType===3) n.remove(); }); sp=document.createElement("span"); sp.className="qu-t"; const ic=u.querySelector("svg"); if(ic) ic.after(sp); else u.prepend(sp); }
  const txt=`Checked ${ago(t)}`; if(sp.textContent!==txt) sp.textContent=txt;
  sp.title=m?`Data last changed ${fmtDate(m,{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})} CT`:"";
}
setInterval(()=>{ if(!document.hidden&&S.tab==="home") qolUpd(); },60000);

/* ---------- hooks ---------- */
function qolApply(){ try{ qolCal(); qolNames(); qolUpd(); }catch(e){ console.warn("qol",e); } }
(()=>{ let q=0, busy=false; if(typeof MutationObserver==="undefined") return;
  const mo=new MutationObserver(()=>{ if(busy||q) return; q=setTimeout(()=>{ q=0; busy=true; qolApply(); setTimeout(()=>busy=false,0); },60); });
  ["v-home","v-games","v-fantasy","sheet"].forEach(id=>{ const el=$(id); if(el) mo.observe(el,{childList:true,subtree:true}); }); })();
accReady.then(()=>{ try{ renderHome(); }catch(e){} qolApply(); });
