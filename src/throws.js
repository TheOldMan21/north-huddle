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
  // the quarterback's headshot at the line of scrimmage
  const qbPh=cur?.qbPhoto||list.find(t=>t.qbPhoto)?.qbPhoto||"";
  if(qbPh) g+=`<defs><clipPath id="tf-cq"><circle cx="${qx}" cy="${qy}" r="17"/></clipPath><clipPath id="tf-cw"><circle cx="36" cy="44" r="25"/></clipPath></defs>`
    +`<circle cx="${qx}" cy="${qy}" r="17" class="tf-qbbg"/><image href="${esc(qbPh)}" x="${qx-23}" y="${qy-19}" width="46" height="46" preserveAspectRatio="xMidYMin slice" clip-path="url(#tf-cq)"/><circle cx="${qx}" cy="${qy}" r="17" class="tf-qbring"/>`;
  else g+=`<circle cx="${qx}" cy="${qy}" r="7" class="tf-qb"/>`;
  // intended receiver of the current throw, in the top-left corner
  if(cur?.target){ const tp=cur.tPhoto, last=String(cur.target).split(" ").slice(-1)[0];
    g+=`<text x="36" y="12" class="tf-tl" text-anchor="middle">TARGET</text>`
      +(tp?`${qbPh?"":`<defs><clipPath id="tf-cw"><circle cx="36" cy="44" r="25"/></clipPath></defs>`}<circle cx="36" cy="44" r="25" class="tf-qbbg"/><image href="${esc(tp)}" x="2" y="17" width="68" height="68" preserveAspectRatio="xMidYMin slice" clip-path="url(#tf-cw)"/>`:`<circle cx="36" cy="44" r="25" class="tf-qbbg"/>`)
      +`<circle cx="36" cy="44" r="25" class="tf-wring ${cur.res==="C"?"ok":cur.res==="INT"?"int":"no"}"/><text x="36" y="84" class="tf-tn" text-anchor="middle">${esc(last.length>11?last.slice(0,10)+"…":last)}</text>`; }
  return `<svg viewBox="0 0 ${TF.W} ${TF.H}" class="tf-svg" role="img" aria-label="Where each pass went">${g}</svg>`;
}
function thrStar(x,y,r){ let p=""; for(let i=0;i<10;i++){ const a=-Math.PI/2+i*Math.PI/5, rr=i%2?r*0.45:r; p+=(i?"L":"M")+(x+Math.cos(a)*rr).toFixed(1)+","+(y+Math.sin(a)*rr).toFixed(1); } return p+"Z"; }
const thrPct=(c,a)=>a?`${c}/${a}`:"0/0";
function thrData(){
  if(THR.mode==="season") return THR.season?.[CUR]?.d||null;
  return THR.cache[THR.ev]?.d||null;
}
function thrRender(){
  const el=THR.el; if(!el) return; const d=thrData();
  const tt=el.querySelector(".thr-title"); if(tt){ const g=THR.cache[THR.ev]?.d, txt=THR.mode==="season"?`${NICK()} · ${new Set((d?.throws||[]).map(t=>t.wk)).size} games this season`:g?`${g.away?.abbr||""} ${g.away?.score??""} at ${g.home?.abbr||""} ${g.home?.score??""}${g.detail?` · ${g.detail}`:""}`:""; if(tt.textContent!==txt) tt.textContent=txt; }
  const body=el.querySelector(".thr-body"), season=THR.mode==="season";
  const modeBar=`<div class="thr-mode" role="group" aria-label="View"><button data-thrmode="game" aria-pressed="${!season}">This game</button><button data-thrmode="season" aria-pressed="${season}">${esc(NICK())} season</button><button class="thr-share" data-thrshare aria-label="Share this chart">Share</button></div>`;
  if(!d){ body.innerHTML=modeBar+`<div class="thr-empty">${season?"Loading the season's throws…":"Loading the throws…"}</div>`; return; }
  const qbs=thrQBs(d); if(!qbs.length){ body.innerHTML=modeBar+`<div class="thr-empty">No passes yet${season?" this season":" in this game"}.</div>`; return; }
  if(body.querySelector(".thr-empty")) body.innerHTML="";
  if(!qbs.find(q=>q.team+"|"+q.qb===THR.qb)) THR.qb=qbs[0].team+"|"+qbs[0].qb;
  const [team,qbName]=THR.qb.split("|"), mine=d.throws.filter(t=>t.team===team&&t.qb===qbName);
  // receivers he threw to (tap one to see only those throws)
  const rc={}; mine.forEach(t=>{ if(!t.target) return; const r=rc[t.target]||(rc[t.target]={name:t.target,pos:t.tPos,n:0,c:0}); r.n++; if(t.res==="C") r.c++; });
  const rcvs=Object.values(rc).sort((a,b)=>b.n-a.n);
  if(THR.rcv&&!rc[THR.rcv]) THR.rcv="";
  const all=THR.rcv?mine.filter(t=>t.target===THR.rcv):mine;
  if(!THR.k||THR.k>all.length) THR.k=all.length;
  const upto=all.slice(0,THR.k), cur=upto[upto.length-1];
  const c=upto.filter(t=>t.res==="C"), yds=c.reduce((a,t)=>a+t.yds,0), td=upto.filter(t=>t.td).length, ints=upto.filter(t=>t.res==="INT").length;
  const ab=a=>a?esc(a.abbr):"", sc=t=>!t?"":season?`Week ${esc(t.wk)} ${t.home?"vs":"at"} ${esc(t.opp)}`:`${ab(d.away)} ${t.away??0} · ${ab(d.home)} ${t.home??0}`;
  const split=f=>{ const l=upto.filter(f); return thrPct(l.filter(t=>t.res==="C").length,l.length); };
  const zones=new Set(upto.filter(t=>t.res==="C"&&t.dir).map(t=>t.depth+t.dir)).size;
  const head=cur?(cur.res==="INT"?`Intercepted${cur.by?` by ${esc(cur.by)}`:""}`:cur.td?`Touchdown to ${esc(cur.target)}`:cur.res==="C"?`Completion to ${esc(cur.target)}`:`Incomplete${cur.target?`, intended for ${esc(cur.target)}`:""}`):"";
  const big=cur?(cur.res==="C"?`<b class="thr-yds ${cur.yds<0?"neg":""}">${cur.yds>0?"+":""}${cur.yds}</b><span>yards</span>`:`<b class="thr-yds ${cur.res==="INT"?"neg":"inc"}">${cur.res==="INT"?"INT":"—"}</b>`):"";
  const ph=(u,alt)=>u?`<img src="${esc(u)}" alt="${esc(alt)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">`:"";
  const homeSide=!season&&d.home&&team===d.home.abbr, sw=t=>t.wpa==null||t.wpb==null?null:(t.wpa-t.wpb)*(homeSide?1:-1);
  const evs=season?[]:(d.events||[]).filter(e=>e.team===team&&e.qb===qbName), lastPi=cur?.pi??Infinity;
  const sacks=evs.filter(e=>e.kind==="sack"&&e.pi<=lastPi), runs=evs.filter(e=>e.kind==="run"&&e.pi<=lastPi);
  const A=`${modeBar}
    <div class="thr-qbs" role="group" aria-label="Quarterback">${qbs.map(q=>`<button data-thrqb="${esc(q.team+"|"+q.qb)}" aria-pressed="${q.team+"|"+q.qb===THR.qb}">${badge(q.team)}<span>${esc(q.qb)}</span><small>${q.c}/${q.att}</small></button>`).join("")}</div>
    ${rcvs.length?`<div class="thr-rcv" role="group" aria-label="Receiver"><button data-thrrcv="" aria-pressed="${!THR.rcv}">Everyone</button>${rcvs.map(r=>`<button data-thrrcv="${esc(r.name)}" aria-pressed="${THR.rcv===r.name}">${esc(r.name.split(" ").slice(-1)[0])} <small>${r.c}/${r.n}</small></button>`).join("")}</div>`:""}
    <div class="thr-stats"><div><b>${thrPct(c.length,upto.length)}</b><span>${THR.rcv?"Catches / Targets":"Comp / Att"}</span></div><div><b>${yds}</b><span>${THR.rcv?"Rec yards":"Pass yards"}</span></div><div><b>${td}</b><span>TD</span></div><div><b>${ints}</b><span>INT</span></div></div>
    <div class="thr-score"><span>${sc(cur)}</span><span>${cur?`Q${cur.q} · ${esc(cur.clock)}`:""}</span></div>
    ${thrField(upto,cur)}
    <div class="thr-key"><span><i class="k-c"></i>Complete</span><span><i class="k-i"></i>Incomplete</span><span><i class="k-int"></i>INT</span><span><i class="k-td"></i>TD</span></div>
    ${!season&&d.wp?.length>2?thrWP(d,team,homeSide,cur,evs,mine):""}`;
  const best=season||THR.rcv?[]:mine.map(t=>({t,s:sw(t)})).filter(x=>x.s!=null&&Math.abs(x.s)>=0.03).sort((a,b)=>Math.abs(b.s)-Math.abs(a.s)).slice(0,5);
  const B=`<div class="thr-pos">${THR.rcv?`Target ${THR.k} of ${all.length} to ${esc(THR.rcv)}`:`Throw ${THR.k} of ${all.length}`}</div>
    ${cur?`<div class="thr-cur"><div class="thr-ph">${ph(cur.qbPhoto,cur.qb)}</div><div class="thr-mid">
      <div class="thr-meta">${season?`Week ${esc(cur.wk)} · `:""}Q${cur.q} · ${esc(cur.clock)}${cur.dd?` · ${esc(cur.dd)}`:""}</div>
      <div class="thr-what">${head}</div><div class="thr-big">${big}</div>
      <div class="thr-meta">${cur.depth?`${esc(cur.depth)} ${esc(cur.dir)}`:"no direction given"}${sw(cur)!=null&&Math.abs(sw(cur))>=0.01?` · win chance ${sw(cur)>0?"+":""}${Math.round(sw(cur)*100)}%`:""}</div></div>
      <div class="thr-ph">${ph(cur.tPhoto,cur.target)}</div></div>`:""}
    ${best.length?`<div class="thr-best"><div class="clp-h">Biggest plays <span>by win-chance swing</span></div>${best.map(({t,s})=>`<button class="thr-bp" data-thrjump="${t.n}"><b class="${s>0?"up":"down"}">${s>0?"+":""}${Math.round(s*100)}%</b><span><span class="thr-bpt">${t.res==="INT"?`INT${t.by?` by ${esc(t.by)}`:""}`:t.td?`TD to ${esc(t.target)}`:t.res==="C"?`${esc(t.target)} ${t.yds>0?"+":""}${t.yds} yds`:`Incomplete to ${esc(t.target)}`}</span><small>Q${t.q} · ${esc(t.clock)}${t.dd?` · ${esc(t.dd)}`:""}</small></span></button>`).join("")}</div>`:""}
    <div class="thr-split">
      <div><span>Short</span><b>${split(t=>t.depth==="short")}</b></div><div><span>Deep</span><b>${split(t=>t.depth==="deep")}</b></div>
      <div><span>Zones hit</span><b>${zones}/6</b></div>
      <div><span>Left</span><b>${split(t=>t.dir==="left")}</b></div><div><span>Middle</span><b>${split(t=>t.dir==="middle")}</b></div><div><span>Right</span><b>${split(t=>t.dir==="right")}</b></div>
      ${season?"":`<div><span>Sacked</span><b>${sacks.length}${sacks.length?` <small>${sacks.reduce((a,e)=>a+e.yds,0)} yds</small>`:""}</b></div><div><span>QB runs</span><b>${runs.length}${runs.length?` <small>${runs.reduce((a,e)=>a+e.yds,0)} yds</small>`:""}</b></div>`}</div>
    <p class="thr-note">Spots are approximate: the play-by-play gives each throw's direction and short or deep, not the exact catch point.${season?" Season view covers every finished game on the schedule.":""}</p>`;
  // the slider is kept between redraws so dragging it never gets interrupted
  let a=body.querySelector(".thr-a"), sc2=body.querySelector(".thr-scrub"), b=body.querySelector(".thr-b");
  if(!a||!sc2||!b){ body.innerHTML=`<div class="thr-a"></div><div class="thr-scrub">
      <button class="thr-step" data-thrstep="-1" aria-label="Previous throw">‹</button>
      <input type="range" min="1" data-thrk>
      <button class="thr-step" data-thrstep="1" aria-label="Next throw">›</button>
      <button class="thr-play" data-thrplay></button></div><div class="thr-b"></div>`; a=body.querySelector(".thr-a"); sc2=body.querySelector(".thr-scrub"); b=body.querySelector(".thr-b"); }
  a.innerHTML=A; b.innerHTML=B;
  const r=sc2.querySelector("[data-thrk]"); r.max=String(all.length); if(Number(r.value)!==THR.k) r.value=String(THR.k); r.setAttribute("aria-label",`Throw ${THR.k} of ${all.length}`);
  const pb=sc2.querySelector("[data-thrplay]"); pb.textContent=THR.play?"❚❚":"▶"; pb.setAttribute("aria-label",THR.play?"Pause":"Replay");
}
// win-chance line for the quarterback's team, with the current throw, sacks (red) and QB runs (blue) marked
function thrWP(d,team,homeSide,cur,evs,mine){
  const W=340, H=64, n=d.wp.length-1, X=i=>(i/n)*W, Y=v=>H-4-(homeSide?v:1-v)*(H-8);
  const line=d.wp.map((v,i)=>`${i?"L":"M"}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join("");
  const area=line+`L${W},${H}L0,${H}Z`;
  const cx=cur?.pi!=null?X(cur.pi+1):null, pct=cur?.wpa!=null?Math.round((homeSide?cur.wpa:1-cur.wpa)*100):null;
  const qs=[1,2,3,4].map(q=>{ const t=mine.find(x=>x.q===q)||(d.throws||[]).find(x=>x.q===q); return t?.pi!=null?`<line x1="${X(t.pi)}" x2="${X(t.pi)}" y1="0" y2="${H}" class="wp-q"/><text x="${X(t.pi)+3}" y="10" class="wp-qt">Q${q}</text>`:""; }).join("");
  const marks=evs.map(e=>`<circle cx="${X(e.pi+1)}" cy="${H-3}" r="3.2" class="wp-${e.kind}"><title>${e.kind==="sack"?"Sacked":"QB run"} · Q${e.q} ${esc(e.clock)} · ${e.yds} yds</title></circle>`).join("")
    +mine.filter(t=>t.td).map(t=>`<circle cx="${X(t.pi+1)}" cy="3" r="3" class="wp-td"/>`).join("");
  return `<div class="thr-wp"><div class="thr-wph"><span>${esc(team)} win chance</span>${pct!=null?`<b>${pct}%</b>`:""}<span class="thr-wpk"><i class="wp-sack"></i>sacked <i class="wp-run"></i>QB run <i class="wp-td"></i>TD</span></div>
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="wp-svg" role="img" aria-label="${esc(team)} win chance through the game"><line x1="0" x2="${W}" y1="${Y(homeSide?0.5:0.5)}" y2="${Y(0.5)}" class="wp-mid"/>${qs}<path d="${area}" class="wp-area"/><path d="${line}" class="wp-line"/>${cx!=null?`<line x1="${cx}" x2="${cx}" y1="0" y2="${H}" class="wp-now"/>`:""}${marks}</svg></div>`;
}
// season view: every finished game's throws for the team being shown
async function thrSeason(){
  THR.season=THR.season||{}; const have=THR.season[CUR]; if(have&&Date.now()-have.at<600e3) return have.d;
  const gs=(S.games||[]).filter(g=>g.status==="final"&&g.espnId).sort((a,b)=>a.week-b.week);
  const ds=await Promise.all(gs.map(g=>thrLoad(g.espnId)));
  let n=0; const throws=[];
  ds.forEach((d,i)=>{ if(!d) return; const g=gs[i]; d.throws.filter(t=>t.team===CUR).forEach(t=>throws.push({...t,n:++n,wk:g.week,opp:g.oppAbbr,home:g.home,wpa:null,wpb:null,pi:null})); });
  const out={final:true, throws, events:[], wp:[]}; THR.season[CUR]={d:out,at:Date.now()}; return out;
}
// share card: the chart as an image for group chats and socials
async function thrShare(){
  const svg=THR.el?.querySelector(".tf-svg"), d=thrData(); if(!svg||!d) return;
  const clone=svg.cloneNode(true), src=[svg,...svg.querySelectorAll("*")], dst=[clone,...clone.querySelectorAll("*")];
  const props=["fill","fill-opacity","stroke","stroke-width","stroke-dasharray","stroke-linecap","opacity","font-family","font-size","font-weight"];
  src.forEach((el,i)=>{ const cs=getComputedStyle(el); dst[i].setAttribute("style",props.map(p=>`${p}:${cs.getPropertyValue(p)}`).join(";")); });
  clone.setAttribute("xmlns","http://www.w3.org/2000/svg"); clone.setAttribute("width","900"); clone.setAttribute("height",String(Math.round(900*TF.H/TF.W)));
  const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)],{type:"image/svg+xml"}));
  const img=new Image(); await new Promise((ok,no)=>{ img.onload=ok; img.onerror=no; img.src=url; }).catch(()=>{});
  const cv=document.createElement("canvas"); cv.width=1080; cv.height=1350; const x=cv.getContext("2d");
  const gr=x.createLinearGradient(0,0,0,1350); gr.addColorStop(0,"#2a1450"); gr.addColorStop(1,"#120a24"); x.fillStyle=gr; x.fillRect(0,0,1080,1350);
  const [team,qb]=THR.qb.split("|"), st=[...THR.el.querySelectorAll(".thr-stats div")].map(dv=>[dv.querySelector("b")?.textContent||"",dv.querySelector("span")?.textContent||""]);
  x.fillStyle="#FFC62F"; x.fillRect(60,56,90,8);
  x.fillStyle="#fff"; x.font='800 64px "Barlow Condensed", Arial Narrow, sans-serif'; x.fillText("THROW CHART",60,140);
  x.font='700 40px "Barlow Condensed", Arial Narrow, sans-serif'; x.fillText(`${qb}${THR.rcv?` → ${THR.rcv}`:""}`.toUpperCase(),60,196);
  x.fillStyle="#D6C8EE"; x.font='500 28px Barlow, Arial, sans-serif'; x.fillText(THR.mode==="season"?`${NICK()} · ${new Date().getFullYear()} season`:(THR.el.querySelector(".thr-title")?.textContent||""),60,240);
  st.forEach(([v,l],i)=>{ const bx=60+i*245; x.fillStyle="rgba(255,255,255,.08)"; x.fillRect(bx,272,225,120); x.fillStyle="#fff"; x.font='800 56px "Barlow Condensed", Arial Narrow, sans-serif'; x.textAlign="center"; x.fillText(v,bx+112,340); x.fillStyle="#D6C8EE"; x.font='700 20px "Barlow Condensed", Arial Narrow, sans-serif'; x.fillText(l.toUpperCase(),bx+112,375); x.textAlign="left"; });
  if(img.width) x.drawImage(img,150,412,780,Math.round(780*TF.H/TF.W));
  URL.revokeObjectURL(url);
  x.fillStyle="#D6C8EE"; x.font='600 26px Barlow, Arial, sans-serif'; x.fillText("north-huddle.pages.dev · unofficial fan site",60,1310);
  const blob=await new Promise(ok=>cv.toBlob(ok,"image/png")); if(!blob) return toast("Couldn't make the image.");
  const file=new File([blob],`throw-chart-${slugify(qb)}.png`,{type:"image/png"});
  try{ if(navigator.canShare&&navigator.canShare({files:[file]})){ await navigator.share({files:[file],title:"Throw chart",text:`${qb} throw chart on North Huddle`}); return; } }catch(e){ if(e?.name==="AbortError") return; }
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=file.name; document.body.appendChild(a); a.click(); a.remove(); toast("Image saved.");
}
const slugify=s=>String(s||"chart").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
async function openThrows(ev){
  if(!ev) return;
  if(THR.ev!==String(ev)) THR.qb="";   // a different game starts on its own quarterback
  THR.mode="game"; THR.rcv="";
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
function thrCount(){ const d=thrData(); return d?d.throws.filter(t=>t.team+"|"+t.qb===THR.qb&&(!THR.rcv||t.target===THR.rcv)).length:0; }
function thrStop(){ clearInterval(THR.play); THR.play=0; }
document.addEventListener("click",e=>{
  const o=e.target.closest("[data-throws]"); if(o){ e.preventDefault(); e.stopPropagation(); openThrows(o.dataset.throws); return; }
  if(!THR.el||THR.el.hidden) return;
  if(e.target.closest("[data-thrx]")) return closeThrows();
  const q=e.target.closest("[data-thrqb]"); if(q){ thrStop(); THR.qb=q.dataset.thrqb; THR.k=0; THR.rcv=""; return thrRender(); }
  const rv=e.target.closest("[data-thrrcv]"); if(rv){ thrStop(); THR.rcv=rv.dataset.thrrcv; THR.k=0; return thrRender(); }
  const md=e.target.closest("[data-thrmode]"); if(md){ thrStop(); THR.mode=md.dataset.thrmode; THR.k=0; THR.rcv=""; THR.qb="";
    if(THR.mode==="season"){ thrRender(); thrSeason().then(()=>{ if(THR.mode==="season") thrRender(); }); } else thrRender(); return; }
  if(e.target.closest("[data-thrshare]")){ thrStop(); thrShare(); return; }
  const jp=e.target.closest("[data-thrjump]"); if(jp){ thrStop(); THR.rcv=""; const d=thrData(), [tm,qn]=THR.qb.split("|"), all=d.throws.filter(t=>t.team===tm&&t.qb===qn); const ix=all.findIndex(t=>String(t.n)===jp.dataset.thrjump); if(ix>=0) THR.k=ix+1; thrRender(); THR.el.querySelector(".thr-a")?.scrollIntoView({behavior:"smooth",block:"start"}); return; }
  const s=e.target.closest("[data-thrstep]"); if(s){ thrStop(); const n=thrCount()||1; THR.k=Math.max(1,Math.min(n,THR.k+Number(s.dataset.thrstep))); return thrRender(); }
  if(e.target.closest("[data-thrplay]")){
    if(THR.play){ thrStop(); return thrRender(); }
    const n=thrCount(); if(!n) return;
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
thrRender=function(){ _thrRenderCL(); const el=THR.el; if(!el||el.hidden||THR.mode==="season") return; const ev=THR.ev, d=THR.cache[ev]?.d; if(!d) return;
  const vids=CLP[ev]?.v; if(!vids){ clipsLoad(ev).then(()=>{ if(THR.ev===ev) thrRender(); }); return; }
  const [team,qb]=THR.qb.split("|"), all=d.throws.filter(t=>t.team===team&&t.qb===qb&&(!THR.rcv||t.target===THR.rcv)), cur=all[Math.max(0,(THR.k||all.length)-1)];
  const b=el.querySelector(".thr-b"); if(!b) return;
  const v=cur&&clipFor(cur,vids), mid=b.querySelector(".thr-mid");
  if(mid&&v&&!mid.querySelector(".clp-watch")) mid.insertAdjacentHTML("beforeend",`<a class="clp-watch" href="${esc(v.url)}" target="_blank" rel="noopener">▶ Watch the play</a>`);
  if(!b.querySelector(".clp-sec")) b.querySelector(".thr-note")?.insertAdjacentHTML("beforebegin",clipsHtml(vids));
  b.querySelectorAll(".thr-bp[data-thrjump]").forEach(bp=>{ const t=d.throws.find(x=>String(x.n)===bp.dataset.thrjump), cv=t&&clipFor(t,vids); if(cv&&!bp.nextElementSibling?.classList.contains("clp-mini")) bp.insertAdjacentHTML("afterend",`<a class="clp-mini" href="${esc(cv.url)}" target="_blank" rel="noopener">▶ Watch</a>`); });
};
// keep clips fresh while a live game's chart is open
setInterval(()=>{ if(THR.el&&!THR.el.hidden&&!THR.cache[THR.ev]?.d?.final) clipsLoad(THR.ev,true).then(()=>thrRender()); },120e3);
// box-score sheet: the game's highlights
if(typeof renderGameSheet==="function"){ const _rgsCL=renderGameSheet; renderGameSheet=function(){ _rgsCL(); const s=GM.sheet; if(!s) return;
  const sh=$("sheet"), id=String(s.id), vids=CLP[id]?.v;
  if(!vids){ clipsLoad(id).then(v=>{ if(v.length&&GM.sheet&&String(GM.sheet.id)===id&&!$("sheetBg").hidden) renderGameSheet(); }); return; }
  sh.querySelector(".clp-sec")?.remove(); const h=clipsHtml(vids); if(!h) return;
  const a=sh.querySelector(".thr-open"); if(a) a.insertAdjacentHTML("afterend",h); else sh.insertAdjacentHTML("beforeend",h); }; }
