/* ===================== North Huddle: Throw chart (every pass in a game) =====================
   Data: /api/throws?event=ID (functions/api/throws.js, ESPN play-by-play).
   Opens full screen from the game sheet, the home last-game card and the game-day card.
   Pick a quarterback, then drag the slider (or press play) to replay his throws in order:
   stats, score and clock follow the slider; the field shows where each ball went.
   ESPN gives direction (left/middle/right) and depth (short = under ~15 air yards / deep),
   not the exact catch point, so spots inside a zone are estimated from the gain. */
const THR={cache:{}, ev:null, qb:"", k:0, play:0, el:null};
async function thrLoad(ev,force){
  const c=THR.cache[ev]; if(c&&!force&&(c.d?.final||Date.now()-c.at<30e3)) return c.d;
  try{ const r=await fetch("/api/throws?event="+encodeURIComponent(ev)); const d=r.ok?await r.json():null; if(d&&!d.error){ THR.cache[ev]={d,at:Date.now()}; return d; } }catch(e){}
  return c?.d||null;
}
function thrQBs(d){
  const m={}; d.throws.forEach(t=>{ const k=t.team+"|"+t.qb; (m[k]=m[k]||{team:t.team,qb:t.qb,photo:t.qbPhoto,att:0,c:0}).att++; if(t.res==="C") m[k].c++; });
  const mine=typeof CUR!=="undefined"?CUR:"";
  return Object.values(m).sort((a,b)=>(b.team===mine)-(a.team===mine)||b.att-a.att);
}
const thrHash=n=>{ let x=Math.imul(n+7,2654435761)>>>0; return (x%1000)/1000; };
function thrSpot(t){
  const h=thrHash(t.n), h2=thrHash(t.n*3+1);
  let d;
  if(t.depth==="deep") d=t.res==="C"?Math.max(16,Math.min(48,t.yds-2)):18+h*22;
  else d=t.res==="C"?Math.max(-3,Math.min(14,t.yds>12?11+h*3:t.yds)):3+h*9;
  if(t.toGo!=null) d=Math.min(d,Math.max(1,t.toGo));
  const col=t.dir==="left"?-1:t.dir==="right"?1:0;
  return {d, col, j:(h2-0.5)};
}
// field geometry (behind the quarterback, line of scrimmage near the bottom)
const TF={W:340, H:372, los:318, top:28, back:-8, far:50};
const tfY=d=>TF.los-(d/TF.far)*(TF.los-TF.top);
const tfHW=d=>150-((d-TF.back)/(TF.far-TF.back))*70;
const tfX=(col,frac,d)=>170+tfHW(d)*(col*2/3+frac);
function thrField(list,cur){
  const pts=(a,b,c,e)=>`${a[0]},${a[1]} ${b[0]},${b[1]} ${c[0]},${c[1]} ${e[0]},${e[1]}`;
  const corner=(d,side)=>[170+side*tfHW(d),tfY(d)];
  let g=`<polygon points="${pts(corner(TF.back,-1),corner(TF.back,1),corner(TF.far,1),corner(TF.far,-1))}" class="tf-turf"/>`;
  // zones: short (0-15) and deep (15-50) x left/middle/right, shaded by completions so far
  const zc={}; list.forEach(t=>{ if(t.res==="C"&&t.dir) zc[(t.depth==="deep"?"d":"s")+t.dir]=(zc[(t.depth==="deep"?"d":"s")+t.dir]||0)+1; });
  const mx=Math.max(1,...Object.values(zc));
  [["s",0,15],["d",15,TF.far]].forEach(([k,a,b])=>[["left",-1],["middle",0],["right",1]].forEach(([dir,c])=>{
    const x1=t=>170+tfHW(t)*(c*2/3-1/3), x2=t=>170+tfHW(t)*(c*2/3+1/3), n=zc[k+dir]||0;
    g+=`<polygon points="${x1(a)},${tfY(a)} ${x2(a)},${tfY(a)} ${x2(b)},${tfY(b)} ${x1(b)},${tfY(b)}" class="tf-zone" style="fill-opacity:${n?0.12+0.38*n/mx:0}"/>`; }));
  for(let d=-5; d<=TF.far; d+=5){ const y=tfY(d), hw=tfHW(d);
    g+=`<line x1="${170-hw}" x2="${170+hw}" y1="${y}" y2="${y}" class="${d===0?"tf-los":d===15?"tf-15":"tf-line"}"/>`;
    if(d>0) g+=`<text x="${170-hw-6}" y="${y+4}" class="tf-num" text-anchor="end">${d}</text><text x="${170+hw+6}" y="${y+4}" class="tf-num">${d}</text>`; }
  [-1/3,1/3].forEach(f=>{ g+=`<line x1="${170+tfHW(TF.back)*f}" y1="${tfY(TF.back)}" x2="${170+tfHW(TF.far)*f}" y2="${tfY(TF.far)}" class="tf-col"/>`; });
  g+=`<text x="${170-tfHW(0)-6}" y="${tfY(0)+4}" class="tf-num" text-anchor="end">LOS</text><text x="${170+tfHW(0)-14}" y="${tfY(TF.far)-9}" class="tf-num">DEEP</text><text x="${170+tfHW(0)-10}" y="${tfY(15)+16}" class="tf-num">SHORT</text>`;
  const qx=170, qy=tfY(0);
  list.forEach(t=>{ if(!t.dir) return; const s=thrSpot(t), x=tfX(s.col,s.j*0.42,s.d), y=tfY(s.d), on=t===cur;
    if(on) g+=`<path d="M${qx},${qy} Q${(qx+x)/2},${Math.min(qy,y)-40-s.d*1.5} ${x},${y}" class="tf-arc"/>`;
    const r=on?9:6;
    if(t.td) g+=`<path d="${thrStar(x,y,r+3)}" class="tf-td${on?" on":""}"/>`;
    else if(t.res==="C") g+=`<circle cx="${x}" cy="${y}" r="${r}" class="tf-c${on?" on":""}"/>`;
    else if(t.res==="INT") g+=`<circle cx="${x}" cy="${y}" r="${r}" class="tf-int${on?" on":""}"/>`;
    else g+=`<g class="tf-i${on?" on":""}"><circle cx="${x}" cy="${y}" r="${r}"/><path d="M${x-r/2.2},${y-r/2.2}L${x+r/2.2},${y+r/2.2}M${x+r/2.2},${y-r/2.2}L${x-r/2.2},${y+r/2.2}"/></g>`; });
  g+=`<circle cx="${qx}" cy="${qy}" r="7" class="tf-qb"/>`;
  return `<svg viewBox="0 0 ${TF.W} ${TF.H}" class="tf-svg" role="img" aria-label="Where each pass went">${g}</svg>`;
}
function thrStar(x,y,r){ let p=""; for(let i=0;i<10;i++){ const a=-Math.PI/2+i*Math.PI/5, rr=i%2?r*0.45:r; p+=(i?"L":"M")+(x+Math.cos(a)*rr).toFixed(1)+","+(y+Math.sin(a)*rr).toFixed(1); } return p+"Z"; }
const thrPct=(c,a)=>a?`${c}/${a}`:"0/0";
function thrRender(){
  const el=THR.el, d=THR.cache[THR.ev]?.d; if(!el) return;
  const body=el.querySelector(".thr-body");
  if(!d){ body.innerHTML=`<div class="thr-empty">Loading the throws…</div>`; return; }
  const qbs=thrQBs(d); if(!qbs.length){ body.innerHTML=`<div class="thr-empty">No passes yet in this game.</div>`; return; }
  if(body.querySelector(".thr-empty")) body.innerHTML="";
  if(!qbs.find(q=>q.team+"|"+q.qb===THR.qb)) THR.qb=qbs[0].team+"|"+qbs[0].qb;
  const [team,qbName]=THR.qb.split("|"), all=d.throws.filter(t=>t.team===team&&t.qb===qbName);
  if(!THR.k||THR.k>all.length) THR.k=all.length;
  const upto=all.slice(0,THR.k), cur=upto[upto.length-1];
  const c=upto.filter(t=>t.res==="C"), yds=c.reduce((a,t)=>a+t.yds,0), td=upto.filter(t=>t.td).length, ints=upto.filter(t=>t.res==="INT").length;
  const ab=a=>a?esc(a.abbr):"", sc=t=>t?`${ab(d.away)} ${t.away??0} · ${ab(d.home)} ${t.home??0}`:"";
  const split=f=>{ const l=upto.filter(f); return thrPct(l.filter(t=>t.res==="C").length,l.length); };
  const zones=new Set(upto.filter(t=>t.res==="C"&&t.dir).map(t=>t.depth+t.dir)).size;
  const head=cur?(cur.res==="INT"?`Intercepted${cur.by?` by ${esc(cur.by)}`:""}`:cur.td?`Touchdown to ${esc(cur.target)}`:cur.res==="C"?`Completion to ${esc(cur.target)}`:`Incomplete${cur.target?`, intended for ${esc(cur.target)}`:""}`):"";
  const big=cur?(cur.res==="C"?`<b class="thr-yds ${cur.yds<0?"neg":""}">${cur.yds>0?"+":""}${cur.yds}</b><span>yards</span>`:`<b class="thr-yds ${cur.res==="INT"?"neg":"inc"}">${cur.res==="INT"?"INT":"—"}</b>`):"";
  const ph=(u,alt)=>u?`<img src="${esc(u)}" alt="${esc(alt)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">`:"";
  const A=`
    <div class="thr-qbs" role="group" aria-label="Quarterback">${qbs.map(q=>`<button data-thrqb="${esc(q.team+"|"+q.qb)}" aria-pressed="${q.team+"|"+q.qb===THR.qb}">${badge(q.team)}<span>${esc(q.qb)}</span><small>${q.c}/${q.att}</small></button>`).join("")}</div>
    <div class="thr-stats"><div><b>${thrPct(c.length,upto.length)}</b><span>Comp / Att</span></div><div><b>${yds}</b><span>Pass yards</span></div><div><b>${td}</b><span>TD</span></div><div><b>${ints}</b><span>INT</span></div></div>
    <div class="thr-score"><span>${sc(cur)}</span><span>${cur?`Q${cur.q} · ${esc(cur.clock)}`:""}</span></div>
    ${thrField(upto,cur)}
    <div class="thr-key"><span><i class="k-c"></i>Complete</span><span><i class="k-i"></i>Incomplete</span><span><i class="k-int"></i>INT</span><span><i class="k-td"></i>TD</span></div>`;
  const B=`<div class="thr-pos">Throw ${THR.k} of ${all.length}</div>
    ${cur?`<div class="thr-cur"><div class="thr-ph">${ph(cur.qbPhoto,cur.qb)}</div><div class="thr-mid">
      <div class="thr-meta">Q${cur.q} · ${esc(cur.clock)}${cur.dd?` · ${esc(cur.dd)}`:""}</div>
      <div class="thr-what">${head}</div><div class="thr-big">${big}</div>
      <div class="thr-meta">${cur.depth?`${esc(cur.depth)} ${esc(cur.dir)}`:"no direction given"}</div></div>
      <div class="thr-ph">${ph(cur.tPhoto,cur.target)}</div></div>`:""}
    <div class="thr-split">
      <div><span>Short</span><b>${split(t=>t.depth==="short")}</b></div><div><span>Deep</span><b>${split(t=>t.depth==="deep")}</b></div>
      <div><span>Left</span><b>${split(t=>t.dir==="left")}</b></div><div><span>Middle</span><b>${split(t=>t.dir==="middle")}</b></div><div><span>Right</span><b>${split(t=>t.dir==="right")}</b></div>
      <div><span>Zones hit</span><b>${zones}/6</b></div></div>
    <p class="thr-note">Spots are approximate: the play-by-play gives each throw's direction and short or deep, not the exact catch point.</p>`;
  // the slider is kept between redraws so dragging it never gets interrupted
  let a=body.querySelector(".thr-a"), sc2=body.querySelector(".thr-scrub"), b=body.querySelector(".thr-b");
  if(!a||!sc2||!b){ body.innerHTML=`<div class="thr-a"></div><div class="thr-scrub">
      <button class="thr-step" data-thrstep="-1" aria-label="Previous throw">‹</button>
      <input type="range" min="1" data-thrk>
      <button class="thr-step" data-thrstep="1" aria-label="Next throw">›</button>
      <button class="thr-play" data-thrplay></button></div><div class="thr-b"></div>`; a=body.querySelector(".thr-a"); sc2=body.querySelector(".thr-scrub"); b=body.querySelector(".thr-b"); }
  a.innerHTML=A; b.innerHTML=B;
  const r=sc2.querySelector("[data-thrk]"); r.max=String(all.length); if(Number(r.value)!==THR.k) r.value=String(THR.k); r.setAttribute("aria-label",`Throw ${THR.k} of ${all.length}`);
  const pb=sc2.querySelector("[data-thrplay]"); pb.textContent=THR.play?"❚❚":"▶"; pb.setAttribute("aria-label",THR.play?"Pause":"Replay the game");
}
async function openThrows(ev){
  if(!ev) return;
  if(THR.ev!==String(ev)) THR.qb="";   // a different game starts on its own quarterback
  THR.ev=String(ev); THR.k=0; clearInterval(THR.play); THR.play=0;
  if(!THR.el){ const el=document.createElement("div"); el.id="thr"; el.setAttribute("role","dialog"); el.setAttribute("aria-label","Throw chart");
    el.innerHTML=`<div class="thr-wrap"><div class="thr-top"><div><div class="thr-kick">THROW CHART</div><div class="thr-title"></div></div><button class="x" data-thrx aria-label="Close">×</button></div><div class="thr-body"></div></div>`;
    document.body.appendChild(el); THR.el=el; }
  THR.el.hidden=false; document.body.classList.add("thr-on"); thrRender();
  const d=await thrLoad(THR.ev); const g=d?`${d.away?.abbr||""} ${d.away?.score??""} at ${d.home?.abbr||""} ${d.home?.score??""}${d.detail?` · ${d.detail}`:""}`:"";
  THR.el.querySelector(".thr-title").textContent=g; thrRender();
  clearInterval(THR.live); if(d&&!d.final) THR.live=setInterval(async()=>{ if(THR.el.hidden) return clearInterval(THR.live); const cnt=x=>x?.throws.filter(t=>t.team+"|"+t.qb===THR.qb).length||0; const before=cnt(THR.cache[THR.ev]?.d), atEnd=THR.k>=before; const dd=await thrLoad(THR.ev,true); const n=cnt(dd);
      // follow new throws only if you were already watching the latest one (don't yank you away while scrolling back)
      if(atEnd&&n&&!THR.play) THR.k=n; thrRender(); if(dd?.final) clearInterval(THR.live); },30e3);
}
function closeThrows(){ if(!THR.el) return; THR.el.hidden=true; document.body.classList.remove("thr-on"); clearInterval(THR.play); THR.play=0; clearInterval(THR.live); }
function thrStop(){ clearInterval(THR.play); THR.play=0; }
document.addEventListener("click",e=>{
  const o=e.target.closest("[data-throws]"); if(o){ e.preventDefault(); e.stopPropagation(); openThrows(o.dataset.throws); return; }
  if(!THR.el||THR.el.hidden) return;
  if(e.target.closest("[data-thrx]")) return closeThrows();
  const q=e.target.closest("[data-thrqb]"); if(q){ thrStop(); THR.qb=q.dataset.thrqb; THR.k=0; return thrRender(); }
  const s=e.target.closest("[data-thrstep]"); if(s){ thrStop(); const n=THR.cache[THR.ev]?.d?.throws.filter(t=>t.team+"|"+t.qb===THR.qb).length||1; THR.k=Math.max(1,Math.min(n,THR.k+Number(s.dataset.thrstep))); return thrRender(); }
  if(e.target.closest("[data-thrplay]")){
    if(THR.play){ thrStop(); return thrRender(); }
    const n=THR.cache[THR.ev]?.d?.throws.filter(t=>t.team+"|"+t.qb===THR.qb).length||0; if(!n) return;
    if(THR.k>=n) THR.k=1; thrRender();
    THR.play=setInterval(()=>{ if(THR.k>=n){ thrStop(); return thrRender(); } THR.k++; thrRender(); },1100); thrRender();
  }
},true);
document.addEventListener("input",e=>{ const r=e.target.closest("[data-thrk]"); if(!r) return; thrStop(); THR.k=Number(r.value)||1; thrRender(); });
document.addEventListener("keydown",e=>{ if(!THR.el||THR.el.hidden) return; if(e.key==="Escape") closeThrows(); });

/* ---------- entry points ---------- */
// game sheet: a button under the score for any game that has started
if(typeof renderGameSheet==="function"){ const _rgsTHR=renderGameSheet; renderGameSheet=function(){ _rgsTHR(); const s=GM.sheet; if(!s) return;
  const x=(s.data?.games||LIVE.data?.games||[]).find(g=>String(g.id)===String(s.id)); if(!x||x.state==="pre") return;
  const sh=$("sheet"); if(sh.querySelector(".thr-open")) return;
  const html=`<button class="btn-gold thr-open" data-throws="${esc(s.id)}">🎯 Throw chart: every pass, play by play</button>`;
  const a=sh.querySelector("#gsFlags")||sh.querySelector(".foot"); if(a) a.insertAdjacentHTML("beforebegin",html); else sh.insertAdjacentHTML("beforeend",html); }; }
// home: last game card + live game-day card
function thrHome(){
  const acts=document.querySelector("#v-home .hf-last .hf-acts"), id=acts?.querySelector("[data-sbgame]")?.dataset.sbgame;
  const tb=acts?.querySelector("[data-throws]"); if(tb&&tb.dataset.throws!==id) tb.remove();
  if(acts&&id&&!acts.querySelector("[data-throws]")) acts.insertAdjacentHTML("beforeend",`<button class="tbtn" data-throws="${esc(id)}">Throws</button>`);
  const gd=document.querySelector("#v-home .gameday"), lg=typeof liveGameNow==="function"?liveGameNow():null, live=(LIVE.data?.games||[]).find(g=>g.state==="in"&&(g.home===CUR||g.away===CUR));
  if(gd&&live&&!gd.querySelector("[data-throws]")) gd.insertAdjacentHTML("beforeend",`<button class="tbtn thr-gd" data-throws="${esc(live.id)}">🎯 Live throw chart</button>`);
}
(()=>{ const h=$("v-home"); if(!h||typeof MutationObserver==="undefined") return; let q=0; new MutationObserver(()=>{ if(q) return; q=setTimeout(()=>{ q=0; thrHome(); },80); }).observe(h,{childList:true,subtree:true}); })();

/* ---------- game clips: ESPN highlight videos, kept per game by the updater (clips/<event>) ---------- */
const CLP={};
async function clipsLoad(ev,force){
  const c=CLP[ev]; if(c&&!force&&Date.now()-c.at<120e3) return c.v;
  let v=[];
  try{ const db=await claude.use("db"); const s=await db.doc("clips/"+ev).get(); v=(s.exists&&s.data().videos)||[]; }catch(e){}
  try{ if(typeof HL!=="undefined"&&HL.data){ const g=(HL.data.games||[]).find(x=>String(x.id)===String(ev)); (g?.videos||[]).forEach(x=>{ if(!v.find(y=>String(y.id)===String(x.id))) v.push(x); }); } }catch(e){}
  v.sort((a,b)=>String(a.at).localeCompare(String(b.at)));
  CLP[ev]={v,at:Date.now()}; return v;
}
const clLast=n=>String(n||"").replace(/\s+(Jr|Sr|II|III|IV)\.?$/,"").trim().split(/\s+/).pop().toLowerCase();
// the clip that best matches a throw: names the receiver (or interceptor), ideally the yardage, posted soon after the play
function clipFor(t,vids){
  if(!vids?.length||t.res==="I") return null;
  const who=clLast(t.res==="INT"?t.by:t.target); if(!who||who.length<3) return null;
  let best=null, bs=0;
  for(const v of vids){ const ti=String(v.title||"").toLowerCase(); if(!ti.includes(who)) continue;
    let s=1; if(t.res==="C"&&t.yds>=5&&new RegExp(`\\b${Math.abs(t.yds)}[- ]?(yard|yd)`).test(ti)) s+=3;
    if(t.td&&/touchdown|\btd\b/.test(ti)) s+=2; if(t.res==="INT"&&/intercept|pick/.test(ti)) s+=2;
    if(t.at&&v.at){ const m=(Date.parse(v.at)-Date.parse(t.at))/6e4; if(m>-2&&m<25) s+=2; else if(m<-2) s-=2; }
    if(s>bs){ bs=s; best=v; } }
  return bs>=2?best:null;
}
function clipsHtml(vids){
  if(!vids?.length) return "";
  const tile=typeof hlVid==="function"?v=>hlVid(v,null,false):v=>`<a class="hl-vid" href="${esc(v.url)}" target="_blank" rel="noopener"><span class="hl-t">${esc(v.title)}</span></a>`;
  return `<div class="clp-sec"><div class="clp-h">Game highlights <span>${vids.length} ${vids.length===1?"clip":"clips"}</span></div><div class="hl-row">${vids.slice().reverse().map(tile).join("")}</div></div>`;
}
// Throw chart: "Watch the play" on the current throw + the game's clips under the chart
const _thrRenderCL=thrRender;
thrRender=function(){ _thrRenderCL(); const el=THR.el; if(!el||el.hidden) return; const ev=THR.ev, d=THR.cache[ev]?.d; if(!d) return;
  const vids=CLP[ev]?.v; if(!vids){ clipsLoad(ev).then(()=>{ if(THR.ev===ev) thrRender(); }); return; }
  const [team,qb]=THR.qb.split("|"), all=d.throws.filter(t=>t.team===team&&t.qb===qb), cur=all[Math.max(0,(THR.k||all.length)-1)];
  const b=el.querySelector(".thr-b"); if(!b) return;
  const v=cur&&clipFor(cur,vids), mid=b.querySelector(".thr-mid");
  if(mid&&v&&!mid.querySelector(".clp-watch")) mid.insertAdjacentHTML("beforeend",`<a class="clp-watch" href="${esc(v.url)}" target="_blank" rel="noopener">▶ Watch the play</a>`);
  if(!b.querySelector(".clp-sec")) b.querySelector(".thr-note")?.insertAdjacentHTML("beforebegin",clipsHtml(vids));
};
// keep clips fresh while a live game's chart is open
setInterval(()=>{ if(THR.el&&!THR.el.hidden&&!THR.cache[THR.ev]?.d?.final) clipsLoad(THR.ev,true).then(()=>thrRender()); },120e3);
// box-score sheet: the game's highlights
if(typeof renderGameSheet==="function"){ const _rgsCL=renderGameSheet; renderGameSheet=function(){ _rgsCL(); const s=GM.sheet; if(!s) return;
  const sh=$("sheet"), id=String(s.id), vids=CLP[id]?.v;
  if(!vids){ clipsLoad(id).then(v=>{ if(v.length&&GM.sheet&&String(GM.sheet.id)===id&&!$("sheetBg").hidden) renderGameSheet(); }); return; }
  sh.querySelector(".clp-sec")?.remove(); const h=clipsHtml(vids); if(!h) return;
  const a=sh.querySelector(".thr-open"); if(a) a.insertAdjacentHTML("afterend",h); else sh.insertAdjacentHTML("beforeend",h); }; }
