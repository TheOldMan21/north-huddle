/* ===================== North Huddle: Chain Gang (QB throwing game) ===================== */
// You're the QB, seen from just above and behind his head. Your receiver runs a route; swipe up to throw:
// the swipe's direction aims the ball and its length sets how deep it goes. Lead your receiver.
// Every completion adds a gold chain around your QB's neck, and deeper throws earn more Huddle Bucks.
// Real drives: 4 downs to gain 10, chains move on a first down, touchdown at the end zone. Three turnovers ends the game.
// Before each snap you can tap a receiver to change his route (hot route), then HIKE (or the play clock snaps it).
const CG={on:false, raf:0};
// route points in yards: x = toward the middle of the field (+) or the sideline (−), y = downfield
const CG_ROUTES={
  slant:[[0,0],[0,4],[7,11],[16,19]],
  out:[[0,0],[0,10],[-9,10],[-16,10]],
  go:[[0,0],[-1,14],[-2,44]],
  post:[[0,0],[0,12],[8,26],[14,36]],
  corner:[[0,0],[0,12],[-9,24],[-13,32]],
  curl:[[0,0],[0,13],[1.5,10.5]],
  wheel:[[0,0],[-4,2],[-7,8],[-7,36]],
  dig:[[0,0],[0,14],[14,14],[22,14]]
};
const CG_HELP="Swipe up toward your receiver. Green ring = open, yellow = contested, red = covered. Longer swipe = deeper.";
const CG_HELP_SET="Tap a receiver to change his route, then HIKE.";
// gameplay randomness: Math.random normally, a seeded generator in the Daily Challenge (same plays for everyone)
function cgHash(str){ let h=1779033703^str.length; for(let i=0;i<str.length;i++){ h=Math.imul(h^str.charCodeAt(i),3432918353); h=h<<13|h>>>19; } return ()=>{ h=Math.imul(h^h>>>16,2246822507); h=Math.imul(h^h>>>13,3266489909); return (h^=h>>>16)>>>0; }; }
function cgSeed(tag){ if(!CG.daily){ CG.rng=Math.random; return; } let a=cgHash(CG.daily+":"+CG.playNo+":"+tag)(); CG.rng=()=>{ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function cgR(){ return (CG.rng||Math.random)(); }
const CG_ORD=["1st","2nd","3rd","4th"];
function cgSpot(b){ b=Math.round(b); return b<50?"OWN "+b:b===50?"MIDFIELD":"OPP "+(100-b); }
function openChainGame(){
  let ov=$("cgGame");
  if(!ov){
    ov=document.createElement("div"); ov.id="cgGame"; ov.setAttribute("role","dialog"); ov.setAttribute("aria-label","Kirko Chainz");
    ov.innerHTML=`<div class="fg-top cg-top"><div class="fg-stat"><span class="label">Chains</span><b id="cgChains" class="num">0</b></div><div class="fg-stat"><span class="label">Huddle Bucks</span><b id="cgBucks" class="num">$0</b></div><div class="fg-stat"><span class="label">Down</span><b id="cgDown" class="num">1st & 10</b></div><button class="cg-snd" data-cgshop="1" aria-label="Ball Shop">🛒</button><button class="cg-snd" id="cgSnd" aria-label="Announcer sound" aria-pressed="true">🔊</button><button class="x" id="cgClose" aria-label="Close game">×</button></div>
      <div class="fg-stage"><canvas id="cgCanvas"></canvas><button class="cg-hike" id="cgHike" hidden>HIKE <span id="cgClock"></span></button><div class="fg-msg" id="cgMsg"></div><div class="cg-shop cg-menu" id="cgMenu" hidden></div><div class="cg-shop" id="cgShop" hidden></div></div>
      <div class="fg-help" id="cgHelp">${CG_HELP}</div>`;
    document.body.appendChild(ov);
    $("cgClose").addEventListener("click",closeChainGame);
    $("cgSnd").addEventListener("click",()=>{ CG.mute=!CG.mute; try{ localStorage.setItem("nh_cgmute",CG.mute?"1":""); }catch(e){} cgSndBtn(); if(CG.mute){ try{ speechSynthesis.cancel(); }catch(e){} cgMusStop(); } else { cgMusStart(); cgSay("Kirko Chainz is in the building!"); } });
    const cv=$("cgCanvas"), pt=e=>{ const r=cv.getBoundingClientRect(); return [e.clientX-r.left,e.clientY-r.top,performance.now()]; };
    $("cgHike").addEventListener("click",e=>{ e.preventDefault(); cgHike(); });
    cv.addEventListener("pointerdown",e=>{ e.preventDefault(); if(CG.phase==="set"){ const q=pt(e); cgTapRoute(q[0],q[1]); return; } if(CG.phase!=="route") return; try{ cv.setPointerCapture(e.pointerId); }catch(err){} const q=pt(e); CG.drag={x0:q[0],y0:q[1],x:q[0],y:q[1],hist:[q]}; });
    cv.addEventListener("pointermove",e=>{ if(!CG.drag) return; e.preventDefault(); const q=pt(e); Object.assign(CG.drag,{x:q[0],y:q[1]}); CG.drag.hist.push(q); if(CG.drag.hist.length>8) CG.drag.hist.shift(); });
    const up=e=>{ if(!CG.drag) return; const q=pt(e); Object.assign(CG.drag,{x:q[0],y:q[1]}); CG.drag.hist.push(q); cgRelease(); };
    cv.addEventListener("pointerup",up); cv.addEventListener("pointercancel",()=>{ CG.drag=null; });
    ov.addEventListener("click",e=>{ if(e.target.closest("[data-cgagain]")) cgStart(CG.daily?"daily":"classic");
      const m=e.target.closest("[data-cgmode]"); if(m) cgStart(m.dataset.cgmode);
      if(e.target.closest("[data-cgmenu]")) cgMenuOpen(); if(e.target.closest("[data-cgbadges]")){ CG.menuView="badges"; cgMenuRender(); } if(e.target.closest("[data-cgmback]")){ CG.menuView="main"; cgMenuRender(); }
      if(e.target.closest("[data-cgsharebtn]")) cgShare(); });
  }
  try{ CG.mute=localStorage.getItem("nh_cgmute")==="1"; }catch(e){} cgSndBtn(); cgVoiceWarm(); setTimeout(cgVoiceLoad,1200);
  ov.hidden=false; document.body.style.overflow="hidden"; CG.on=true; CG.paused=false; if($("cgShop")) $("cgShop").hidden=true; cgResize(); cgMenuOpen(); cgWPull(); cgMusStart();
  window.addEventListener("resize",cgResize);
}
function closeChainGame(){ cgShopClose(); cgMusStop(); try{ speechSynthesis.cancel(); }catch(e){} CG.on=false; CG.drag=null; cancelAnimationFrame(CG.raf); const ov=$("cgGame"); if(ov) ov.hidden=true; document.body.style.overflow=""; window.removeEventListener("resize",cgResize); }
function cgResize(){ const c=$("cgCanvas"); if(!c) return; const st=c.parentElement.getBoundingClientRect(), dpr=Math.min(2,window.devicePixelRatio||1); c.width=st.width*dpr; c.height=st.height*dpr; c.style.width=st.width+"px"; c.style.height=st.height+"px"; CG.w=st.width; CG.h=st.height; CG.dpr=dpr; cgCam(); }
function cgStart(mode){ $("cgMenu").hidden=true; CG.paused=false; CG.daily=mode==="daily"?cgToday():null; if(cgGameDay()) cgAch("gameday"); Object.assign(CG,{newAch:[],chains:0, bucks:0, strikes:0, turnovers:0, tds:0, firsts:0, comps:0, longest:0, phase:"set", t:0, ball:null, wrs:null, cbs:null, sf:null, flash:null, drag:null, thrown:0, streak:0, post:null, fx:[], playNo:0, hotI:-1, dr:{ballOn:25,down:1,toGo:10}, drNext:null}); $("cgMsg").innerHTML=""; $("cgHelp").textContent=CG_HELP; cgHud(); cgSnap(); if(CG.daily) toast("📅 Daily Challenge: same plays for everyone today"); cancelAnimationFrame(CG.raf); CG.last=performance.now(); CG.raf=requestAnimationFrame(cgLoop); }
function cgHud(){ $("cgChains").textContent=CG.chains||0; $("cgBucks").textContent="$"+(CG.bucks||0).toLocaleString(); const d=CG.drNext||CG.dr; $("cgDown").textContent=CG_ORD[Math.min(3,d.down-1)]+" & "+(d.ballOn+d.toGo>=100?"Goal":d.toGo); }

/* ---------- camera: just above and behind the QB, looking downfield ----------
   World units are yards: X across (−26.7..26.7), Y downfield (line of scrimmage = 0, QB at −6), Z up.
   A softened perspective (depth^0.55) keeps deep routes readable on a tall phone screen. */
const CG_QBY=-6, CG_GAM=0.55, CG_WRCOL=["#5EF2D6","#FFD54A","#FF8FD8"];
function cgZe(d){ return 10*Math.pow(Math.max(d,0.25)/10,CG_GAM); }
function cgCam(){ const W=CG.w, H=CG.h, cam={x:0, y:-12.5};
  cam.fx=Math.min(W*0.52, H*0.62); cam.cx=W/2; cam.hy=H*(W>H?0.17:0.19);
  cam.kv=(H*(W>H?0.6:0.69)-cam.hy)*cgZe(0-cam.y);   // line of scrimmage sits ~60% down the screen
  CG.cam=cam; }
function cgP(X,Y,Z){ const c=CG.cam, z=cgZe(Y-c.y), s=c.fx/z; return [c.cx+(X-c.x)*s, c.hy+c.kv/z-(Z||0)*s, s]; }
function cgUnP(sx,sy){ const c=CG.cam; const z=c.kv/Math.max(1,sy-c.hy); const d=10*Math.pow(z/10,1/CG_GAM); return [c.x+(sx-c.cx)*z/c.fx, c.y+d]; }
// swipe → landing spot: direction from the swipe (aimed through the camera), distance from its length
function cgAim(d){
  const dx=d.x-d.x0, dy=d.y-d.y0, len=Math.hypot(dx,dy); if(len<24||dy>-8) return null;
  const c=CG.cam, [hx,hy]=cgHand(), ux=dx/len, uy=dy/len, rowY=c.hy+(c.kv/cgZe(-c.y))*0.35;
  const k=(rowY-hy)/uy, [gx,gy]=cgUnP(hx+ux*k,rowY);
  let ang=Math.atan2(gx,gy-CG_QBY); ang=Math.max(-1.3,Math.min(1.3,ang));
  const yds=Math.max(4,Math.min(62, 3+len/(CG.h*0.5)*50));
  return {tx:Math.sin(ang)*yds, ty:CG_QBY+Math.cos(ang)*yds, yds};
}
function cgRelease(){
  const d=CG.drag; CG.drag=null; if(CG.phase!=="route"||!d) return;
  const a=cgAim(d); if(!a) return;
  const h=d.hist, q0=h[0], q1=h[h.length-1], v=Math.hypot(q1[0]-q0[0],q1[1]-q0[1])/Math.max(16,q1[2]-q0[2]); // px per ms
  const zip=v>1.1?0.82:1, dist=a.yds;
  CG.ball={x0:0.5,y0:CG_QBY,tx:a.tx,ty:a.ty,t:0,T:cgFlight(dist,zip<1),dist,zip:zip<1};
  CG.phase="air"; CG.thrown=performance.now(); cgVibe(18);
}
// build a receiver's route from his start spot, squeezed sideways so it (and where he keeps running after) stays on screen
function cgRoute(sx,name){ const sg=Math.sign(sx)||1, pts=CG_ROUTES[name].map(([x,y])=>[sx+x*-sg, y]);
  const last=pts[pts.length-1], prev=pts[pts.length-2], dl=Math.hypot(last[0]-prev[0],last[1]-prev[1])||1, ext=[last[0]+(last[0]-prev[0])/dl*6, last[1]+(last[1]-prev[1])/dl*6];
  let k=1; [...pts,ext].forEach(([x,y])=>{ if(Math.abs(x)>0.01) k=Math.min(k,cgXmax(y)/Math.abs(x)); }); pts.forEach(p=>{ p[0]*=k; }); return pts; }
// three receivers (wide on each side + a slot), a corner on each, a safety. Defense gets tougher as you complete passes:
// blitzes (shorter pocket), zone corners (sit in an area and jump routes), and a double-team on your hot receiver.
function cgSnap(){
  CG.playNo++; cgSeed("snap"); const R=cgR;
  const names=Object.keys(CG_ROUTES).map(n=>[n,R()]).sort((a,b)=>a[1]-b[1]).map(a=>a[0]).slice(0,3);
  const side=R()<0.5?-1:1, starts=[-side*(7+R()*2), side*(7+R()*2), side*(3.4+R()*1.2)];
  const lvl=CG.comps, L=Math.floor(lvl/3);
  CG.ybk=110-CG.dr.ballOn;   // back line of the end zone, in yards past the line of scrimmage
  CG.wrs=starts.map((sx,i)=>({i, sx, pts:cgRoute(sx,names[i]), seg:0, x:sx, y:0, speed:7.0+R()*0.9, route:names[i], track:false, num:[18,11,84][i]}));
  CG.cbs=CG.wrs.map((w,i)=>{ const zone=R()<Math.min(0.5,0.15+L*0.06); return {i, x:w.x-Math.sign(w.x||1)*1.2, y:zone?8+R()*3:(i===2?4:5)+R()*2, speed:6.3+Math.min(1.6,lvl*0.08), react:Math.max(0.12,0.45-lvl*0.02), lag:[], track:false, num:[24,21,26][i],
    zone:zone?{x:w.x*0.8,y:9+R()*4}:null}; });
  const dbl=CG.hotI>=0&&L>=2&&R()<Math.min(0.5,0.25+L*0.05)?CG.hotI:null;
  CG.sf={x:dbl!=null?CG.wrs[dbl].x*0.9:side*2, y:dbl!=null?9:17+R()*4, speed:5.4+Math.min(1.2,lvl*0.06), track:false, num:31, dbl};
  const blitz=R()<Math.min(0.4,0.08+L*0.05);
  CG.blz=blitz?{x:(R()-0.5)*6, y:4.5, speed:6.2+R()}:null;
  CG.ball=null; CG.drag=null; CG.post=null; CG.pocket=(4.4-Math.min(1.4,lvl*0.05))*(blitz?0.62:1);
  CG.contestRoll=R(); CG.pickRoll=R();
  CG.phase="set"; CG.t=0; CG.clock=7; $("cgHike").hidden=false; $("cgHelp").textContent=CG_HELP_SET; cgHud();
}
function cgHike(){ if(CG.phase!=="set") return; CG.phase="route"; CG.t=0; $("cgHike").hidden=true; $("cgHelp").textContent=CG_HELP; cgVibe(12); }
// pre-snap: tap a receiver (or his route label) to cycle his route
function cgTapRoute(px,py){ const names=Object.keys(CG_ROUTES); let best=null, bd=38;
  CG.wrs.forEach(w=>{ const [wx,wy]=cgP(w.x,w.y), q=w.pts[w.pts.length-1], [lx,ly]=cgP(q[0],q[1]); const d=Math.min(Math.hypot(px-wx,py-wy+14),Math.hypot(px-lx,py-ly+12)); if(d<bd){ bd=d; best=w; } });
  if(!best) return; const used=CG.wrs.filter(w=>w!==best).map(w=>w.route); let k=names.indexOf(best.route);
  do{ k=(k+1)%names.length; }while(used.includes(names[k])); best.route=names[k]; best.pts=cgRoute(best.sx,best.route); CG.clock=Math.max(CG.clock,3); cgVibe(8); }
function cgVibe(p){ if(CG.mute) return; try{ navigator.vibrate&&navigator.vibrate(p); }catch(e){} }
// widest |X| (yards) that still fits on screen at a given distance downfield
function cgXmax(Y){ const c=CG.cam; if(!c) return 16; const s=c.fx/cgZe(Y-c.y); return Math.max(3,(CG.w/2-30)/s); }
function cgMove(ent,tx,ty,spd,dt){ const dx=tx-ent.x, dy=ty-ent.y, d=Math.hypot(dx,dy); if(d<1e-3) return true; const s=Math.min(d,spd*dt); ent.x+=dx/d*s; ent.y+=dy/d*s; return s>=d-1e-3; }
/* One step of the play. The live game and the aim preview both run this, so the ring's
   OPEN / CONTESTED / COVERED call matches what actually happens when the ball lands.
   Late in the ball's flight the nearest receiver adjusts to it (up to ~3.5 yds), and defenders break on it. */
function cgStep(S,dt){
  S.t+=dt; const f=S.sf, b=S.ball;
  const rem=b?b.T-b.t:9, land=b?[b.tx,b.ty]:null;
  if(b&&!S.wrs.some(w=>w.track)&&rem<0.95){ let best=null, bd=3.5; S.wrs.forEach(w=>{ const d=Math.hypot(w.x-land[0],w.y-land[1]); if(d<=bd){ bd=d; best=w; } }); if(best) best.track=true; }
  if(S.blz) cgMove(S.blz,0,CG_QBY+0.8,S.blz.speed,dt);
  S.wrs.forEach(w=>{
    if(w.track) cgMove(w,land[0],land[1],w.speed*1.12,dt);
    else { const tgt=w.pts[w.seg+1]; if(tgt){ if(cgMove(w,tgt[0],tgt[1],w.speed,dt)) w.seg++; } else {
        const a=w.pts[w.pts.length-2], z=w.pts[w.pts.length-1], dx=z[0]-a[0], dy=z[1]-a[1], d=Math.hypot(dx,dy)||1; w.x+=dx/d*w.speed*dt*0.85; w.y+=dy/d*w.speed*dt*0.85; } }
    const xm=cgXmax(w.y); w.x=Math.max(-xm,Math.min(xm,w.x)); if(S.ybk) w.y=Math.min(w.y,S.ybk-0.8); });
  S.cbs.forEach(c=>{ const w=S.wrs[c.i];
    if(b&&!c.track&&rem<0.7&&Math.hypot(c.x-land[0],c.y-land[1])<=3) c.track=true;
    if(c.track) cgMove(c,land[0],land[1],c.speed,dt);
    else if(c.zone){ // zone: sit in the area, mirror whoever runs through it (with a beat of lag), drift back when it's empty
      const near=S.wrs.reduce((m,v)=>Math.hypot(v.x-c.zone.x,v.y-c.zone.y)<Math.hypot(m.x-c.zone.x,m.y-c.zone.y)?v:m,S.wrs[0]), dz=Math.hypot(near.x-c.zone.x,near.y-c.zone.y);
      c.lag.push([S.t,near.x,near.y]); while(c.lag.length&&c.lag[0][0]<S.t-c.react-0.15) c.lag.shift(); const aim=c.lag[0]||[0,near.x,near.y];
      if(dz<7) cgMove(c,aim[1],aim[2]+0.6,c.speed*0.95,dt); else cgMove(c,c.zone.x,c.zone.y,c.speed*0.5,dt); }
    else { c.lag.push([S.t,w.x,w.y]); while(c.lag.length&&c.lag[0][0]<S.t-c.react) c.lag.shift(); const aim=c.lag[0]||[0,w.x,w.y]; cgMove(c,aim[1]+(c.x<w.x?-0.6:0.6),aim[2]+0.4,c.speed,dt); } });
  if(b&&!f.track&&rem<1.2&&Math.hypot(f.x-land[0],f.y-land[1])<=6) f.track=true;
  if(f.track) cgMove(f,land[0],land[1],f.speed*1.05,dt);
  else if(f.dbl!=null){ const w=S.wrs[f.dbl]; cgMove(f,w.x*0.92,w.y+2.6,f.speed*1.05,dt); }
  else { const deep=S.wrs.reduce((m,w)=>w.y>m.y?w:m,S.wrs[0]); const t2=deep.y>f.y-6?[deep.x*0.8,deep.y+3]:[f.x*0.97,f.y]; cgMove(f,t2[0],t2[1],f.speed*0.6,dt); }
  if(b) b.t+=dt;
}
// what happens when the ball comes down
function cgJudge(S){
  const b=S.ball, dist=m=>Math.hypot(m.x-b.tx,m.y-b.ty);
  if((S.ybk&&b.ty>S.ybk-0.3)||Math.abs(b.tx)>26.5){ const wr=S.wrs[0]; return {kind:"miss",dw:9,dd:9,wr,who:S.sf,out:1}; }
  const wr=S.wrs.reduce((m,w)=>dist(w)<dist(m)?w:m,S.wrs[0]), defs=[...S.cbs,S.sf], who=defs.reduce((m,d)=>dist(d)<dist(m)?d:m,defs[0]);
  const dw=dist(wr), dd=dist(who), wrIn=dw<=2.0, defIn=dd<=1.4;
  if(wrIn&&!defIn) return {kind:dw>1.1?"dive":"open",dw,dd,wr,who};
  if(wrIn&&defIn) return {kind:"contested",dw,dd,wr,who,p:Math.max(0.2,Math.min(0.8,0.55+(dd-dw)*0.35))};
  if(defIn) return {kind:"covered",dw,dd,wr,who};
  return {kind:"miss",dw,dd,wr,who};
}
function cgClone(){ return {t:CG.t, wrs:CG.wrs.map(w=>({...w})), cbs:CG.cbs.map(c=>({...c,lag:c.lag.slice()})), sf:{...CG.sf}, blz:CG.blz?{...CG.blz}:null, ybk:CG.ybk, ball:null}; }
function cgPredict(a){ const S=cgClone(), dist=Math.hypot(a.tx-0.5,a.ty-CG_QBY); S.ball={tx:a.tx,ty:a.ty,t:0,T:cgFlight(dist)}; let n=0; while(S.ball.t<S.ball.T&&n++<400) cgStep(S,1/60); return cgJudge(S); }
function cgFlight(dist){ return 0.3+dist/23; }
function cgLoop(now){
  if(!CG.on) return;
  const dt=Math.min(0.05,(now-CG.last)/1000); CG.last=now;
  if(CG.paused){ CG.raf=requestAnimationFrame(cgLoop); return; }
  if(CG.phase==="set"){ CG.clock-=dt; const c=$("cgClock"); if(c) c.textContent=Math.max(0,Math.ceil(CG.clock)); if(CG.clock<=0) cgHike(); }
  else if(CG.phase==="route"||CG.phase==="air"){
    cgStep(CG,dt);
    if(CG.phase==="route"&&CG.t>CG.pocket){ CG.drag=null; cgResult("sack"); }
    else if(CG.phase==="air"&&CG.ball.t>=CG.ball.T) cgLand();
  } else if(CG.phase==="result") cgPost(dt);
  cgChainsStep(dt);
  cgDraw(); CG.raf=requestAnimationFrame(cgLoop);
}
function cgLand(){
  const j=cgJudge(CG), b=CG.ball, yds=Math.max(1,Math.round(b.ty));
  if(j.kind==="open"||j.kind==="dive") return cgResult("catch",yds,j.kind==="dive"?"DIVING CATCH!":"COMPLETE!",j.wr);
  if(j.kind==="contested") return CG.contestRoll<j.p?cgResult("catch",yds,"CONTESTED CATCH!",j.wr):cgResult(CG.pickRoll<0.3?"pick":"broken",0,"",j.who);
  if(j.kind==="covered") return cgResult(j.dd<0.8&&CG.pickRoll<0.55?"pick":"broken",0,"",j.who);
  cgResult("incomplete",0,j.out?"OUT OF BOUNDS":"");
}
// after the ball arrives: the catch and run, the deflection, the pick, or the ball bouncing away
function cgPost(dt){
  const P=CG.post; if(!P) return; P.t+=dt; const b=P.ball;
  if(P.carrier){ const m=P.carrier, hold=P.t<0.4, cel=P.big&&P.dir>0&&P.t>1.0;
    if(cel&&!P.cel){ P.cel={type:cgCel().id,t0:P.t}; if(P.cel.type==="spike"){ P.spiked=1; Object.assign(b,{z:2.0,vx:0.6,vy:0.4,vz:-16}); } cgVibe(30); }
    if(cel){ if(P.cel.type==="moon") m.y-=1.6*dt; if(P.spiked){ b.vz-=22*dt; b.x+=b.vx*dt; b.y+=b.vy*dt; b.z+=b.vz*dt; if(b.z<0.15){ b.z=0.15; b.vz=Math.abs(b.vz)*0.55; } } else { b.x=m.x+(P.cel.type==="point"?-0.25:0.3); b.y=m.y; b.z=P.cel.type==="flex"||P.cel.type==="swing"?2.15:1.3; } return; }
    if(P.big&&P.dir>0&&P.t>0.75) m.y+=P.dir*m.speed*0.25*dt; else m.y+=P.dir*m.speed*(hold?0.35:0.8)*dt;
    b.x=m.x+(hold?0:0.3); b.y=m.y; b.z=hold?2.2:1.3; return; }
  b.vz-=22*dt; b.x+=b.vx*dt; b.y+=b.vy*dt; b.z+=b.vz*dt;
  if(b.z<0.15){ b.z=0.15; b.vz=Math.abs(b.vz)*0.45; b.vx*=0.6; b.vy*=0.6; b.bounce=(b.bounce||0)+1; }
}
function cgMult(){ return CG.streak>=5?2:CG.streak>=3?1.5:1; }
function cgResult(kind,yds,label,who){
  CG.phase="result"; CG.res=kind; CG.big=false; let html; const b=CG.ball, d={...CG.dr}; CG.drNext=d;
  const at=b?{x:b.tx,y:b.ty,z:2.2}:null, dir=b?[b.tx-b.x0,b.ty-b.y0]:[0,1], dl=Math.hypot(dir[0],dir[1])||1;
  let next="", turnover=false, td=false;
  if(kind==="catch"){
    const gain=Math.min(yds,100-d.ballOn); td=d.ballOn+gain>=100; yds=gain;
    CG.comps++; CG.chains++; CG.streak=(CG.streak||0)+1; const mult=cgMult()*(cgGameDay()?2:1); CG.hotI=who&&who.i!=null?who.i:-1;
    let bucks=Math.round((yds*5+Math.max(0,yds-15)*10+Math.max(0,yds-30)*15)*mult); if(td) bucks+=Math.round(250*mult);
    CG.bucks+=bucks; CG.longest=Math.max(CG.longest,yds); cgW().bank+=bucks; cgW().earned+=bucks; cgWSave(false);
    if(td){ CG.tds++; next="td"; }
    else if(yds>=d.toGo){ CG.firsts++; d.ballOn+=yds; d.down=1; d.toGo=Math.min(10,100-d.ballOn); next="first"; }
    else { d.ballOn+=yds; d.toGo-=yds; d.down++; }
    if(td) cgAch("td"); if(CG.tds>=3) cgAch("hat"); if(CG.tds>=5) cgAch("five"); if(yds>=40) cgAch("deep40"); if(yds>=50) cgAch("deep50"); if(/DIVING/.test(label||"")) cgAch("dive");
    if(CG.chains>=10) cgAch("ch10"); if(CG.chains>=20) cgAch("ch20"); if(CG.streak>=3) cgAch("fire"); if(CG.streak>=5) cgAch("blaze"); if(CG.streak>=10) cgAch("ten"); if(cgW().earned>=10000) cgAch("rich"); if(cgW().earned>=100000) cgAch("mil");
    const fire=CG.streak>=3?` · 🔥 ×${cgMult()}`:CG.streak===2?" · heating up…":"";
    html=`<b>${td?"TOUCHDOWN!":label||"COMPLETE!"}</b><span>${yds} yards · +$${bucks.toLocaleString()}${fire}${cgGameDay()?" · 📺 game day ×2":""}</span>${next==="first"?'<span class="cg-first">FIRST DOWN ⛓</span>':""}<span>New chain: ${CG_CHAINS[(CG.chains-1)%CG_CHAINS.length].name} ⛓️</span>`;
    cgSound(true); cgCall(td?"TOUCHDOWN":next==="first"?"FIRST":label,yds); cgVibe(td?[40,60,40,60,120]:[25,40,25]);
    if(CG.streak>=3) setTimeout(()=>{ if(CG.on) cgThrowChains(at.x,at.y); },350);
    CG.flash={t:performance.now()}; CG.post={t:0,carrier:who,dir:1,ball:{...at},td,big:td||yds>=25||CG.streak>=3}; CG.big=CG.post.big;
  } else {
    const hadFire=(CG.streak||0)>=3; CG.streak=0;
    if(kind==="sack"){ const loss=Math.min(6,d.ballOn-1); d.ballOn-=loss; d.toGo+=loss; }
    if(kind==="pick") turnover=true; else { d.down++; if(d.down>4) turnover=true; }
    cgSound(false); cgCallMiss(turnover&&kind!=="pick"?"downs":kind,hadFire); cgVibe(kind==="sack"?90:kind==="pick"?[60,40,60]:20);
    const head=kind==="pick"?"PICKED OFF!":kind==="broken"?"BROKEN UP!":kind==="sack"?"SACKED!":label||"INCOMPLETE";
    const sub=turnover?(kind==="pick"?"Turnover":"Turnover on downs"):kind==="sack"?"Loss of yardage · get it out faster!":`${CG_ORD[d.down-1]} & ${d.ballOn+d.toGo>=100?"Goal":d.toGo}`;
    html=`<b class="miss">${head}</b><span>${sub}${hadFire?" · fire's out 🧯":""}</span>`;
    if(kind==="pick") CG.post={t:0,carrier:who,dir:-1,ball:{...at}};
    else if(kind==="broken") CG.post={t:0,ball:{...at,vx:(Math.random()-0.5)*8,vy:-2-Math.random()*2,vz:6}};
    else if(kind==="incomplete") CG.post={t:0,ball:{...at,z:2.0,vx:dir[0]/dl*9,vy:dir[1]/dl*9,vz:-2}};
    else CG.post=null;
    if(turnover){ CG.turnovers++; next="turnover"; html+=`<span>${3-CG.turnovers>0?`${3-CG.turnovers} possession${3-CG.turnovers===1?"":"s"} left`:"That's the game"}</span>`; }
  }
  cgHud(); $("cgMsg").innerHTML=`<div class="fg-pop${td?" td":""}">${html}</div>`; CG.strikes=CG.turnovers;
  setTimeout(()=>{ if(!CG.on) return; $("cgMsg").innerHTML=""; CG.dr=next==="td"||next==="turnover"?{ballOn:25,down:1,toGo:10}:CG.drNext; CG.drNext=null; if(CG.turnovers>=3) cgOver(); else cgSnap(); },td?2900:CG.big&&kind==="catch"?2300:1700);
}
function cgGameDay(){ return !CG.daily&&!!CG.gdLive; }
/* ---------- game-day mode: while the real game is live, double bucks; a real touchdown sets every player's stadium on fire ---------- */
function cgGameDayCheck(){
  try{ const g=(typeof LIVE!=="undefined"&&LIVE.data&&LIVE.data.games||[]).find(x=>(x.home===CUR||x.away===CUR)&&x.state==="in");
    const was=CG.gdLive; CG.gdLive=!!g; if(was!==CG.gdLive&&CG.on&&CG.phase==="menu") cgMenuRender();
    if(!g){ CG.gdScore=null; return; }
    const ours=g.home===CUR?g.hs:g.as, key=g.id||(g.home+g.away);
    if(CG.gdKey===key&&CG.gdScore!=null&&ours-CG.gdScore>=6&&CG.on){
      CG.gdFire=performance.now()+45000; cgSay("Touchdown in the real game! The whole stadium is on fire!",true); toast("🔥 Real touchdown! The stadium's on fire for everyone playing.");
      if(CG.wrs){ const w=CG.wrs[0]; cgThrowChains(w.x,Math.max(6,w.y)); } cgVibe([40,60,40,60,120]); }
    CG.gdKey=key; CG.gdScore=ours; }catch(e){} }
setInterval(cgGameDayCheck,5000);
/* ---------- background music: an original stadium beat built live with Web Audio ----------
   Am–F–C–G, drums + bass + offbeat synth stabs over a low crowd murmur. Fire mode adds 16th hats
   and opens the filter; it ducks while the announcer talks. Muted with the same 🔊 button. */
const CG_MUS={bpm:104, prog:[[57,60,64],[53,57,60],[48,52,55],[55,59,62]], roots:[45,41,36,43]};
function cgMusStart(){ if(CG.mute||CG.mus) return; try{ const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return; const ctx=CG.ctx||(CG.ctx=new AC()); if(ctx.state==="suspended") ctx.resume();
  const out=ctx.createGain(); out.gain.value=0.0001; out.connect(ctx.destination); out.gain.exponentialRampToValueAtTime(0.5,ctx.currentTime+1.5);
  const comp=ctx.createDynamicsCompressor(); comp.threshold.value=-18; comp.ratio.value=4; comp.connect(out);
  const duck=ctx.createGain(); duck.gain.value=1; duck.connect(comp);
  const nb=ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate), nd=nb.getChannelData(0); for(let i=0;i<nd.length;i++) nd[i]=Math.random()*2-1;
  // crowd murmur bed
  const cn=ctx.createBufferSource(), cl=ctx.createBiquadFilter(), cg=ctx.createGain(), lfo=ctx.createOscillator(), lg=ctx.createGain(); cn.buffer=nb; cn.loop=true; cl.type="bandpass"; cl.frequency.value=700; cl.Q.value=0.5; cg.gain.value=0.05; lfo.frequency.value=0.13; lg.gain.value=0.025; lfo.connect(lg); lg.connect(cg.gain); cn.connect(cl); cl.connect(cg); cg.connect(comp); cn.start(); lfo.start();
  CG.mus={ctx,out,duck,nb,step:0,next:ctx.currentTime+0.1,stop:[cn,lfo]};
  CG.mus.timer=setInterval(cgMusTick,25); }catch(e){} }
function cgMusStop(){ const m=CG.mus; if(!m) return; CG.mus=null; clearInterval(m.timer); try{ const t=m.ctx.currentTime; m.out.gain.cancelScheduledValues(t); m.out.gain.setValueAtTime(m.out.gain.value,t); m.out.gain.exponentialRampToValueAtTime(0.0001,t+0.4); setTimeout(()=>{ m.stop.forEach(n=>{ try{ n.stop(); }catch(e){} }); m.out.disconnect(); },500); }catch(e){} }
function cgMusDuck(on){ const m=CG.mus; if(!m) return; try{ const t=m.ctx.currentTime; m.duck.gain.cancelScheduledValues(t); m.duck.gain.setTargetAtTime(on?0.35:1,t,0.12); }catch(e){} }
function cgMusTick(){ const m=CG.mus; if(!m) return; const ctx=m.ctx, sp=60/CG_MUS.bpm/4;
  while(m.next<ctx.currentTime+0.12){ cgMusStep(m,m.step,m.next); m.step=(m.step+1)%64; m.next+=sp; } }
function cgMusNote(m,t,f,dur,type,vol,cut){ const ctx=m.ctx, o=ctx.createOscillator(), g=ctx.createGain(), fl=ctx.createBiquadFilter(); o.type=type; o.frequency.value=f; fl.type="lowpass"; fl.frequency.value=cut||2000;
  g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(vol,t+0.008); g.gain.exponentialRampToValueAtTime(0.0001,t+dur); o.connect(fl); fl.connect(g); g.connect(m.duck); o.start(t); o.stop(t+dur+0.02); }
function cgMusNoise(m,t,dur,vol,type,freq){ const ctx=m.ctx, n=ctx.createBufferSource(), fl=ctx.createBiquadFilter(), g=ctx.createGain(); n.buffer=m.nb; fl.type=type; fl.frequency.value=freq;
  g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.0001,t+dur); n.connect(fl); fl.connect(g); g.connect(m.duck); n.start(t,Math.random()*0.5); n.stop(t+dur+0.02); }
function cgMusStep(m,st,t){ const ctx=m.ctx, b=st%16, bar=(st/16)|0, heat=cgHeat(), hz=n=>440*Math.pow(2,(n-69)/12);
  // kick
  if(b===0||b===8||b===10&&bar%2){ const o=ctx.createOscillator(), g=ctx.createGain(); o.frequency.setValueAtTime(140,t); o.frequency.exponentialRampToValueAtTime(42,t+0.12); g.gain.setValueAtTime(0.9,t); g.gain.exponentialRampToValueAtTime(0.0001,t+0.28); o.connect(g); g.connect(m.duck); o.start(t); o.stop(t+0.3); }
  // clap/snare on 2 and 4
  if(b===4||b===12){ cgMusNoise(m,t,0.16,0.45,"bandpass",1800); cgMusNoise(m,t+0.012,0.12,0.3,"bandpass",1200); }
  // hats: 8ths, 16ths when on fire
  if(b%2===0||heat>=0.7) cgMusNoise(m,t,b%2?0.03:0.05,(b%4===2?0.16:0.09)*(b%2?0.7:1),"highpass",8000);
  // bass: root on 8ths with an octave pop
  const root=CG_MUS.roots[bar%4]; if(b%2===0) cgMusNote(m,t,hz(root+(b===6||b===14?12:0)),0.2,"sawtooth",0.16,380+heat*300);
  // offbeat chord stabs
  if(b===2||b===6||b===10||b===14||(heat>=1&&b===15)){ CG_MUS.prog[bar%4].forEach(n=>cgMusNote(m,t,hz(n+12),0.16,"square",0.035,1200+heat*2400)); }
  // little lead hook every other bar, brighter when hot
  if(bar%2===1&&(b===0||b===3||b===6)){ const ch=CG_MUS.prog[bar%4]; cgMusNote(m,t,hz(ch[[2,1,0][b/3|0]]+24),0.22,"triangle",0.06+heat*0.03,4000); }
}
/* ---------- announcer: the device's own voice, pitched up and fast, over a crowd roar ---------- */
const CG_PICK=a=>a[(Math.random()*a.length)|0];
function cgSndBtn(){ const b=$("cgSnd"); if(b){ b.textContent=CG.mute?"🔇":"🔊"; b.setAttribute("aria-pressed",String(!CG.mute)); } }
function cgVoiceWarm(){ try{ speechSynthesis.getVoices(); speechSynthesis.onvoiceschanged=()=>{ CG.voice=null; }; }catch(e){} }
function cgVoice(){ if(CG.voice) return CG.voice; try{ const vs=speechSynthesis.getVoices().filter(v=>/^en[-_]US/i.test(v.lang)||/^en/i.test(v.lang)); if(!vs.length) return null;
  const rank=v=>(/male|guy|david|alex|daniel|aaron|fred|google us english|en-us-x-iom|en-us-x-tpd|en-us-x-iol/i.test(v.name)?4:0)+(/natural|enhanced|premium|neural|online/i.test(v.name)?3:0)+(/^en[-_]US/i.test(v.lang)?2:0)+(/female|samantha|victoria|zira/i.test(v.name)?-2:0);
  CG.voice=vs.sort((a,b)=>rank(b)-rank(a))[0]; }catch(e){} return CG.voice; }
// AI-voiced clips from /api/announce (prefetched once, then cached by the browser); the phone's voice is the fallback
async function cgVoiceLoad(){ if(CG.vcLoading||CG.vcOff) return; CG.vcLoading=true; CG.vc=CG.vc||{};
  try{ const AC=window.AudioContext||window.webkitAudioContext; if(!AC) throw 0; const ctx=CG.ctx||(CG.ctx=new AC());
    const list=await (await fetch("/api/announce?list=1")).json(); let fails=0, i=0;
    const one=async()=>{ while(i<list.length&&!CG.vcOff){ const t=list[i++]; if(CG.vc[t]) continue; try{ const r=await fetch("/api/announce?t="+encodeURIComponent(t)); if(!r.ok) throw 0; CG.vc[t]=await ctx.decodeAudioData(await r.arrayBuffer()); fails=0; }catch(e){ if(++fails>=4) CG.vcOff=true; } } };
    await Promise.all([one(),one(),one()]); }catch(e){ CG.vcOff=true; } }
function cgSay(text,hype){ if(CG.mute) return;
  const buf=CG.vc&&CG.vc[text]; if(buf&&CG.ctx){ try{ speechSynthesis.cancel(); }catch(e){} try{ if(CG.vcSrc) CG.vcSrc.stop(); }catch(e){}
    const src=CG.ctx.createBufferSource(), g=CG.ctx.createGain(); src.buffer=buf; g.gain.value=1.15; src.playbackRate.value=hype?1.06:1; src.connect(g); g.connect(CG.ctx.destination); cgMusDuck(true); src.onended=()=>cgMusDuck(false); src.start(); CG.vcSrc=src; cgRoar(hype?1:0.6); return; }
  try{ if(!("speechSynthesis" in window)) return; speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(text), v=cgVoice(); if(v) u.voice=v; u.lang=v?v.lang:"en-US"; u.rate=hype?1.22:1.12; u.pitch=hype?1.25:1.08; u.volume=1; u.onstart=()=>cgMusDuck(true); u.onend=u.onerror=()=>cgMusDuck(false); speechSynthesis.speak(u); setTimeout(()=>cgMusDuck(false),4000); }catch(e){}
  cgRoar(hype?1:0.6); }
function cgRoar(amt){ if(CG.mute) return; try{ const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return; const ctx=CG.ctx||(CG.ctx=new AC()); if(ctx.state==="suspended") ctx.resume();
  const len=ctx.sampleRate*2.2, buf=ctx.createBuffer(1,len,ctx.sampleRate), d=buf.getChannelData(0); let last=0; for(let i=0;i<len;i++){ last=last*0.97+(Math.random()*2-1)*0.03; d[i]=last*6+(Math.random()*2-1)*0.08; }
  const src=ctx.createBufferSource(), bp=ctx.createBiquadFilter(), g=ctx.createGain(), t=ctx.currentTime; src.buffer=buf; bp.type="bandpass"; bp.frequency.value=900; bp.Q.value=0.6;
  g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.22*amt,t+0.35); g.gain.exponentialRampToValueAtTime(0.0001,t+2.1); src.connect(bp); bp.connect(g); g.connect(ctx.destination); src.start(t); src.stop(t+2.2); }catch(e){} }
function cgCall(label,yds){
  const st=CG.streak, chain=CG_CHAINS[(CG.chains-1)%CG_CHAINS.length].name;
  let line;
  if(label==="TOUCHDOWN") line=st>=3?CG_PICK(["Touchdown! And his chainz are on fire!","Touchdown! The whole stadium is on fire!"]):CG_PICK(["Touchdown! Kirko Chainz finds the end zone!","He takes it to the house! Touchdown!","Touchdown! Pay the man!"]);
  else if(st===3) line="His chainz are on fire!!!";
  else if(st===5) line=CG_PICK(["Somebody call the fire department! Kirko Chainz is blazing!","He is BLAZING! Those chains are white hot!"]);
  else if(st===4) line=CG_PICK(["The fans are throwing chains on the field!","It's raining chains in here!"]);
  else if(st>5) line=CG_PICK(["Still on fire! Kirko cannot miss!","Another one! The chains are melting!","Unstoppable! Kirko Chainz is cooking!","The whole stadium is on fire!","Chains are flying out of the stands!"]);
  else if(st===2) line=CG_PICK(["Kirko is heating up!","Back to back! He's warming up!"]);
  else if(label==="FIRST"&&cgR()<0.6) line=CG_PICK(["First down! Move the chains!","Moving the chains!","That's a first down!"]);
  else if(/DIVING/.test(label||"")) line=CG_PICK(["Oh what a diving grab!","He lays out and HAULS it in!"]);
  else if(/CONTESTED/.test(label||"")) line=CG_PICK(["He wins the jump ball!","Right in traffic! What a catch!"]);
  else if(yds>=35) line=CG_PICK(["He went deep and he got it!","Bombs away! Kirko lets it fly!","What a strike downfield!"]);
  else line=CG_PICK(["Complete! Another chain for Kirko!","Kirko dials it up! That's the "+chain+"!","Right on the money!","Kirko Chainz delivers!","Money! Pay the man!"]);
  cgSay(line,st>=3||yds>=35);
}
function cgCallMiss(kind,hadFire){ if(hadFire) return cgSay(CG_PICK(["And the fire is out!","Ice cold! The fire's out!"]),false);
  if(kind==="pick") cgSay(CG_PICK(["Oh no! Picked off!","Intercepted!"]),false); else if(kind==="sack") cgSay("Down goes Kirko!",false); else if(kind==="downs") cgSay("Turnover on downs!",false); }
function cgSound(good){ try{ const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return; const ctx=CG.ctx||(CG.ctx=new AC()); const t=ctx.currentTime;
  (good?[523.25,659.25,783.99,1046.5]:[220,165]).forEach((f,i)=>{ const o=ctx.createOscillator(), g=ctx.createGain(); o.type=good?"square":"triangle"; o.frequency.value=f; g.gain.setValueAtTime(0.0001,t+i*.08); g.gain.exponentialRampToValueAtTime(0.08,t+i*.08+.02); g.gain.exponentialRampToValueAtTime(0.0001,t+i*.08+.2); o.connect(g); g.connect(ctx.destination); o.start(t+i*.08); o.stop(t+i*.08+.25); }); }catch(e){} }
async function cgOver(){
  CG.phase="over"; $("cgHike").hidden=true;
  const prev=cgBest(), best={chains:Math.max(prev.chains||0,CG.chains), bucks:Math.max(prev.bucks||0,CG.bucks)};
  if(!CG.daily) try{ localStorage.setItem("nh_cgbest",JSON.stringify(best)); }catch(e){}
  let dprev={}; if(CG.daily){ cgAch("daily"); try{ dprev=JSON.parse(localStorage.getItem("nh_cgdaily")||"{}"); }catch(e){} if(dprev.d!==CG.daily) dprev={}; if(CG.bucks>(dprev.bucks||0)) try{ localStorage.setItem("nh_cgdaily",JSON.stringify({d:CG.daily,bucks:CG.bucks,tds:CG.tds})); }catch(e){} }
  let board="";
  if(ACC.db&&ACC.id){
    try{
      const ref=ACC.db.doc("scores/"+ACC.id), cur=await ref.get(), d=cur.exists?cur.data():{}, old=d.chain||{}, od=d.daily&&d.daily.d===CG.daily?d.daily:{};
      const upd=CG.daily?(CG.bucks>(od.bucks||0)?{daily:{d:CG.daily,bucks:CG.bucks,tds:CG.tds,chains:CG.chains,t:nowIso()}}:{}):(CG.bucks>(old.bucks||0)?{chain:{bucks:CG.bucks, chains:CG.chains, longest:CG.longest, tds:CG.tds, t:nowIso()}}:{});
      await ref.set({...d, ...upd, wallet:cgWData()});
      const q=await ACC.db.collection("scores").limit(500).get();
      const rows=CG.daily?q.docs.map(x=>({id:x.id,c:x.data().daily})).filter(x=>x.c&&x.c.d===CG.daily&&x.c.bucks>0).sort((a,b)=>b.c.bucks-a.c.bucks).slice(0,10)
        :q.docs.map(x=>({id:x.id,c:x.data().chain})).filter(x=>x.c&&x.c.bucks>0).sort((a,b)=>b.c.bucks-a.c.bucks).slice(0,10);
      board=`<div class="fg-board"><div class="label">${CG.daily?"Today's Daily Challenge":"Kirko Chainz leaderboard"}</div>${rows.map((r,i)=>`<div class="fg-row${r.id===ACC.id?" me":""}"><span class="num">${i+1}</span>${av(r.id,"sm")}<span class="fg-nm" data-uname="${esc(r.id)}">${esc(personName(r.id))}</span><span class="t2">${r.c.tds!=null?r.c.tds+" TD":r.c.chains+"⛓️"}</span><b class="num">$${Number(r.c.bucks).toLocaleString()}</b></div>`).join("")||'<div class="fg-note">Be the first on the board!</div>'}</div>`;
    }catch(e){ console.warn("cg scores",e); }
  } else board=`<div class="fg-note">Sign in to get on the leaderboard.</div>`;
  const pb=CG.daily?CG.bucks>(dprev.bucks||0):CG.bucks>(prev.bucks||0);
  const ach=(CG.newAch||[]).map(id=>CG_ACH.find(a=>a[0]===id)).filter(Boolean);
  $("cgMsg").innerHTML=`<div class="fg-over"><div class="lg-ft">${CG.daily?"📅 Daily Challenge":"Kirko Chainz"} · Final</div><div class="fg-big num">$${CG.bucks.toLocaleString()}</div><div class="t2">${CG.tds} TD${CG.tds===1?"":"s"} · ${CG.chains} chain${CG.chains===1?"":"s"} · longest ${CG.longest} yds${pb&&CG.bucks>0?" · <b>New best!</b>":""}</div>
    ${ach.length?`<div class="cg-over-ach">${ach.map(a=>`<span title="${esc(a[3])}">${a[1]} ${esc(a[2])}</span>`).join("")}</div>`:""}
    <div class="cg-over-bank">Bank <b class="num">${cgMoney(cgW().bank)}</b>${cgAffordable()?` · <span class="cg-new">you can afford something new!</span>`:""}</div>${board}
    <div class="cg-over-btns"><button class="btn-gold" data-cgagain="1">${CG.daily?"Try again":"Run it back"}</button><button class="tbtn" data-cgsharebtn="1">📤 Share</button><button class="tbtn" data-cgshop="1">🛒 Shop</button><button class="tbtn" data-cgmenu="1">Menu</button></div></div>`;
  $("cgHelp").textContent="";
}
function cgAffordable(){ const w=cgW(); return Object.values(cgCats()).some(([list,own])=>list.some(k=>!w[own].includes(k.id)&&w.bank>=k.price)); }
function cgToday(){ return new Date().toLocaleDateString("en-CA",{timeZone:"America/Chicago"}); }
/* ---------- share card: an image of your game to post or text ---------- */
async function cgShare(){
  try{
    const W=1080, H=1350, c=document.createElement("canvas"); c.width=W; c.height=H; const x=c.getContext("2d");
    let g=x.createLinearGradient(0,0,0,H); g.addColorStop(0,"#0B1220"); g.addColorStop(1,"#1a1340"); x.fillStyle=g; x.fillRect(0,0,W,H);
    const glow=(gx,gy,r,col)=>{ const q=x.createRadialGradient(gx,gy,0,gx,gy,r); q.addColorStop(0,col); q.addColorStop(1,"rgba(0,0,0,0)"); x.fillStyle=q; x.fillRect(0,0,W,H); };
    glow(250,180,700,"rgba(46,230,197,.28)"); glow(880,320,650,"rgba(124,92,255,.32)"); if(CG.streak>=3||CG.tds>=3) glow(540,1150,700,"rgba(255,110,20,.35)");
    x.textAlign="center"; x.fillStyle="#FFD54A"; x.font='800 96px "Barlow Condensed",system-ui'; x.fillText("⛓ KIRKO CHAINZ",W/2,150);
    x.fillStyle="#9fb0c8"; x.font='700 40px "Barlow Condensed",system-ui'; x.fillText(CG.daily?`DAILY CHALLENGE · ${CG.daily}`:"FINAL",W/2,210);
    x.fillStyle="#fff"; x.font='800 190px "Barlow Condensed",system-ui'; x.fillText(cgMoney(CG.bucks),W/2,400);
    x.font='700 52px "Barlow Condensed",system-ui'; x.fillStyle="#5EF2D6"; x.fillText(`${CG.tds} TD${CG.tds===1?"":"s"}  ·  ${CG.chains} CHAINS  ·  LONG ${CG.longest} YDS`,W/2,480);
    // the QB with his chain stack
    const ow=CG.w, oh=CG.h; CG.w=450; CG.h=560; x.save(); x.translate(0,H-560*2.4+20); x.scale(2.4,2.4); cgQB(x,450,560); x.restore(); CG.w=ow; CG.h=oh;
    x.fillStyle="rgba(11,18,32,.85)"; x.fillRect(0,H-96,W,96); x.fillStyle="#fff"; x.font='700 40px "Barlow Condensed",system-ui'; x.fillText("Can you beat it?  north-huddle.pages.dev",W/2,H-36);
    const blob=await new Promise(r=>c.toBlob(r,"image/png")); const file=new File([blob],"kirko-chainz.png",{type:"image/png"});
    const text=`I stacked ${CG.chains} chains for ${cgMoney(CG.bucks)} (${CG.tds} TD) in Kirko Chainz on North Huddle. Can you beat it? https://north-huddle.pages.dev`;
    if(navigator.canShare&&navigator.canShare({files:[file]})){ await navigator.share({files:[file],text}); return; }
    const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="kirko-chainz.png"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),4000);
    try{ await navigator.clipboard.writeText(text); toast("Image saved. Caption copied!"); }catch(e){ toast("Image saved!"); }
  }catch(e){ if(e&&e.name==="AbortError") return; console.warn("cg share",e); toast("Couldn't make the share image."); }
}
/* ---------- badges ---------- */
function cgAch(id){ const w=cgW(); if(w.ach[id]) return; const a=CG_ACH.find(x=>x[0]===id); if(!a) return; w.ach[id]=cgToday(); w.bank+=a[4]; (CG.newAch=CG.newAch||[]).push(id); cgWSave(false);
  toast(`🏅 Badge unlocked: ${a[1]} ${a[2]} (+${cgMoney(a[4])})`); }
/* ---------- start menu ---------- */
function cgMenuOpen(){ const m=$("cgMenu"); if(!m) return; Object.assign(CG,{phase:"menu", wrs:null, cbs:null, sf:null, blz:null, ball:null, post:null, streak:0, chains:0, dr:{ballOn:25,down:1,toGo:10}, drNext:null}); CG.paused=false;
  $("cgMsg").innerHTML=""; $("cgHike").hidden=true; $("cgHelp").textContent=""; CG.menuView="main"; m.hidden=false; cgMenuRender(); cgHud();
  cancelAnimationFrame(CG.raf); CG.last=performance.now(); CG.raf=requestAnimationFrame(cgLoop); cgDailyBoard(); }
async function cgDailyBoard(){ if(!(ACC.db&&ACC.id)) return; try{ const q=await ACC.db.collection("scores").limit(500).get(), d=cgToday();
  CG.dBoard=q.docs.map(x=>({id:x.id,c:x.data().daily})).filter(x=>x.c&&x.c.d===d&&x.c.bucks>0).sort((a,b)=>b.c.bucks-a.c.bucks).slice(0,5); cgMenuRender(); }catch(e){} }
function cgMenuRender(){ const m=$("cgMenu"); if(!m||m.hidden) return; const w=cgW(), got=CG_ACH.filter(a=>w.ach[a[0]]).length;
  if(CG.menuView==="badges"){ m.innerHTML=`<div class="cg-shop-head"><div><div class="label">Kirko Chainz</div><div class="cg-bank">Badges <b class="num">${got}/${CG_ACH.length}</b></div></div><button class="x" data-cgmback aria-label="Back">←</button></div>
      <div class="cg-badges">${CG_ACH.map(a=>`<div class="cg-badge${w.ach[a[0]]?" got":""}"><div class="cg-badge-i">${a[1]}</div><b>${esc(a[2])}</b><span>${esc(a[3])}</span><em>${w.ach[a[0]]?"Earned "+esc(w.ach[a[0]]):"+"+cgMoney(a[4])}</em></div>`).join("")}</div>`; return; }
  let dl={}; try{ dl=JSON.parse(localStorage.getItem("nh_cgdaily")||"{}"); }catch(e){} const today=cgToday(), mine=dl.d===today?dl:null;
  m.innerHTML=`<div class="cg-menu-in"><div class="cg-logo">⛓️ KIRKO CHAINZ</div><div class="cg-bank">Bank <b class="num">${cgMoney(w.bank)}</b></div>
    ${CG.gdLive?`<div class="cg-gd">📺 GAME DAY: the real game is live. Double Huddle Bucks, and every real touchdown sets the stadium on fire!</div>`:""}
    <button class="cg-mbtn play" data-cgmode="classic"><b>▶ Play</b><span>4 downs, 3 turnovers. Score as much as you can.</span></button>
    <button class="cg-mbtn daily" data-cgmode="daily"><b>📅 Daily Challenge</b><span>Same plays for everyone today${mine?` · your best ${cgMoney(mine.bucks)}`:""}</span></button>
    <div class="cg-mrow"><button class="cg-mbtn sm" data-cgshop="1"><b>🛒 Shop</b></button><button class="cg-mbtn sm" data-cgbadges="1"><b>🏅 Badges ${got}/${CG_ACH.length}</b></button></div>
    ${CG.dBoard&&CG.dBoard.length?`<div class="fg-board cg-mboard"><div class="label">Today's Daily leaders</div>${CG.dBoard.map((r,i)=>`<div class="fg-row${r.id===ACC.id?" me":""}"><span class="num">${i+1}</span>${av(r.id,"sm")}<span class="fg-nm" data-uname="${esc(r.id)}">${esc(personName(r.id))}</span><span class="t2">${r.c.tds||0} TD</span><b class="num">$${Number(r.c.bucks).toLocaleString()}</b></div>`).join("")}</div>`:""}
    <p class="cg-shop-note">Tap a receiver before the snap to change his route. Swipe up to throw.</p></div>`; }
/* ---------- badges + best drive on member profiles ---------- */
/* ---------- bank + Ball Shop ----------
   Every completion's Huddle Bucks also go into a bank that carries over between drives.
   The bank buys football skins. Kept on the device; members also sync it to scores/<uid>.wallet. */
const CG_SKINS=[
  {id:"classic",name:"Classic Leather",price:0,base:["#9a5428","#5e2c10"],lace:"#fff"},
  {id:"purple",name:"Purple Reign",price:750,base:["#7a48c8","#3b1a70"],lace:"#FFC62F",stripe:"#FFC62F"},
  {id:"gold",name:"Gold Rush",price:1500,base:["#ffe27a","#c08a00"],lace:"#4F2683",stripe:"#4F2683"},
  {id:"arctic",name:"Arctic White",price:2500,base:["#ffffff","#c3d2e2"],lace:"#4F2683",stripe:"#4F2683"},
  {id:"neon",name:"Neon Volt",price:4000,base:["#d8ff5a","#5ea800"],lace:"#111",stripe:"#111"},
  {id:"aurora",name:"Northern Lights",price:7500,grad:["#2EE6C5","#7C5CFF"],lace:"#fff",glow:"rgba(94,242,214,.9)"},
  {id:"galaxy",name:"Galaxy",price:15000,base:["#3a1e6e","#0b0820"],lace:"#fff",stars:1,glow:"rgba(155,123,255,.9)"},
  {id:"diamond",name:"Diamond Iced",price:30000,base:["#f2fdff","#86d3ee"],lace:"#fff",facets:1,glow:"rgba(191,243,255,1)"},
  {id:"firechain",name:"Chainz on Fire",price:50000,base:["#9a5428","#4a200a"],lace:"#fff",chain:1,fire:1,glow:"rgba(255,120,20,1)"}
];
// trails behind the ball in flight, bought separately from footballs
const CG_TRAILS=[
  {id:"none",name:"No Trail",price:0},
  {id:"smoke",name:"Smoke",price:500,life:650},
  {id:"gold",name:"Gold Streak",price:1000,col:"#FFD54A"},
  {id:"purple",name:"Purple Haze",price:2000,col:"#9b6bff"},
  {id:"sparkle",name:"Sparkles",price:3500,life:500},
  {id:"rainbow",name:"Rainbow",price:6000},
  {id:"aurora",name:"Northern Lights",price:10000,life:480},
  {id:"lightning",name:"Lightning",price:20000,life:260},
  {id:"fire",name:"Fire Trail",price:30000,life:450},
  {id:"chainz",name:"Chain Reaction",price:45000,life:520}
];
function cgTrail(){ const w=cgW(); return CG_TRAILS.find(k=>k.id===w.trail)||CG_TRAILS[0]; }
// draw a trail from recent ball positions [{x,y,r,t}] (oldest first)
function cgTrailDraw(x,pts,tr,now,L){
  if(tr.id==="none"||pts.length<2) return; const life=(tr.life||380)*(L||1), age=p=>Math.min(1,(now-p.t)/life);
  x.save(); x.lineCap="round"; x.lineJoin="round";
  const ribbon=(colFn,wMul,comp)=>{ x.globalCompositeOperation=comp||"source-over"; for(let i=1;i<pts.length;i++){ const a=pts[i-1], b=pts[i], f=1-age(b); if(f<=0) continue; x.strokeStyle=colFn(f,i/pts.length); x.lineWidth=Math.max(1,b.r*wMul*f); x.beginPath(); x.moveTo(a.x,a.y); x.lineTo(b.x,b.y); x.stroke(); } };
  if(tr.id==="smoke"){ pts.forEach((p,i)=>{ const a=age(p), f=1-a; if(f<=0) return; x.fillStyle=`rgba(200,205,215,${f*0.35})`; x.beginPath(); x.arc(p.x+Math.sin(i*1.7)*a*6,p.y-a*8,p.r*(0.5+a*1.4),0,7); x.fill(); }); }
  else if(tr.id==="gold"||tr.id==="purple"){ x.shadowColor=tr.col; x.shadowBlur=8; ribbon(f=>tr.col+Math.round(f*200).toString(16).padStart(2,"0"),1.1,"lighter"); }
  else if(tr.id==="rainbow"){ ribbon((f,u)=>`hsla(${(u*300+now/6)%360},95%,60%,${f*0.85})`,1.3); }
  else if(tr.id==="aurora"){ x.shadowColor="#5EF2D6"; x.shadowBlur=12; ribbon((f,u)=>{ const c=[[46,230,197],[124,92,255]], k=1-u; return `rgba(${c[0].map((v,j)=>Math.round(v+(c[1][j]-v)*k)).join(",")},${f*0.8})`; },1.6,"lighter"); }
  else if(tr.id==="sparkle"){ x.globalCompositeOperation="lighter"; pts.forEach((p,i)=>{ const f=1-age(p); if(f<=0) return; const r=p.r*0.5*f*(0.6+0.4*Math.sin(now/60+i*2)), ox=Math.sin(i*12.9)*p.r*0.8, oy=Math.cos(i*7.3)*p.r*0.8;
      x.strokeStyle=`rgba(255,250,220,${f})`; x.lineWidth=Math.max(1,r*0.25); x.beginPath(); x.moveTo(p.x+ox-r,p.y+oy); x.lineTo(p.x+ox+r,p.y+oy); x.moveTo(p.x+ox,p.y+oy-r); x.lineTo(p.x+ox,p.y+oy+r); x.stroke(); }); }
  else if(tr.id==="lightning"){ x.globalCompositeOperation="lighter"; x.shadowColor="#8fe8ff"; x.shadowBlur=14; for(const [w,c] of [[3,"rgba(140,220,255,.55)"],[1.4,"rgba(255,255,255,.95)"]]){ x.strokeStyle=c; x.lineWidth=w; x.beginPath(); pts.forEach((p,i)=>{ const j=(i%2?1:-1)*p.r*0.7*(1-age(p)); i?x.lineTo(p.x+j,p.y-j):x.moveTo(p.x,p.y); }); x.stroke(); } }
  else if(tr.id==="fire"){ x.globalCompositeOperation="lighter"; pts.forEach(p=>{ const f=1-age(p); if(f<=0) return; x.fillStyle=f>0.6?`rgba(255,220,100,${f*0.55})`:`rgba(255,100,20,${f*0.5})`; x.beginPath(); x.arc(p.x+(Math.random()-0.5)*3,p.y+(Math.random()-0.5)*3-(1-f)*4,p.r*(0.45+f*0.65),0,7); x.fill(); }); }
  else if(tr.id==="chainz"){ x.globalCompositeOperation="lighter"; pts.forEach((p,i)=>{ const f=1-age(p); if(f<=0||i%2) return; x.fillStyle=`rgba(255,110,20,${f*0.35})`; x.beginPath(); x.arc(p.x,p.y-(1-f)*5,p.r*(0.4+f*0.5),0,7); x.fill(); });
    x.globalCompositeOperation="source-over"; x.shadowColor="rgba(255,190,40,.9)"; x.shadowBlur=6; pts.forEach((p,i)=>{ const f=1-age(p); if(f<=0) return; const nx=pts[Math.min(i+1,pts.length-1)], an=Math.atan2(nx.y-p.y,nx.x-p.x)+(i%2?Math.PI/2:0);
      x.save(); x.translate(p.x,p.y); x.rotate(an); x.globalAlpha=f; x.strokeStyle=i%2?"#FFE27A":"#D99A00"; x.lineWidth=Math.max(1.2,p.r*0.22); x.beginPath(); x.ellipse(0,0,p.r*0.45,p.r*0.28,0,0,7); x.stroke(); x.restore(); }); }
  x.restore();
}
// shop categories: [catalog, owned-list field, equipped field] (ball + trail keep their original field names)
function cgCats(){ return {ball:[CG_SKINS,"owned","skin"], trail:[CG_TRAILS,"ownedT","trail"], cel:[CG_CELS,"ownedC","cel"], stad:[CG_STADS,"ownedS","stad"], glove:[CG_GLOVES,"ownedG","glove"], ez:[CG_EZ,"ownedE","ez"]}; }
function cgW(){ if(CG.wallet) return CG.wallet; let w={}; try{ w=JSON.parse(localStorage.getItem("nh_cgwallet")||"{}"); }catch(e){}
  const W={bank:Number(w.bank)||0, earned:Number(w.earned)||Number(w.bank)||0, ach:w.ach&&typeof w.ach==="object"?w.ach:{}, best:w.best||{}};
  Object.values(cgCats()).forEach(([list,own,eq])=>{ W[own]=Array.isArray(w[own])?w[own]:[list[0].id]; if(!W[own].includes(list[0].id)) W[own].unshift(list[0].id); W[eq]=w[eq]&&W[own].includes(w[eq])?w[eq]:list[0].id; });
  CG.wallet=W; return W; }
function cgWData(){ const w=cgW(), o={bank:w.bank, earned:w.earned, ach:w.ach, t:nowIso()}; Object.values(cgCats()).forEach(([,own,eq])=>{ o[own]=w[own]; o[eq]=w[eq]; }); return o; }
function cgWSave(remote){ const w=cgW(); try{ localStorage.setItem("nh_cgwallet",JSON.stringify(w)); }catch(e){} if(remote) cgWPush(); }
async function cgWPush(extra){ if(!(ACC.db&&ACC.id)) return; try{ const ref=ACC.db.doc("scores/"+ACC.id), cur=await ref.get(), d=cur.exists?cur.data():{};
  await ref.set({...d, ...(extra||{}), wallet:cgWData()}); }catch(e){ console.warn("cg wallet",e); } }
async function cgWPull(){ if(!(ACC.db&&ACC.id)||CG.wPulled===ACC.id) return; CG.wPulled=ACC.id; try{ const cur=await ACC.db.doc("scores/"+ACC.id).get(), r=cur.exists&&cur.data().wallet; if(!r) return;
  const w=cgW(); w.bank=Math.max(w.bank,Number(r.bank)||0); w.earned=Math.max(w.earned,Number(r.earned)||0); w.ach={...(r.ach||{}),...w.ach};
  Object.values(cgCats()).forEach(([list,own,eq])=>{ w[own]=[...new Set([...w[own],...(r[own]||[])])]; if(r[eq]&&w[own].includes(r[eq])&&w[eq]===list[0].id) w[eq]=r[eq]; });
  cgWSave(false); cgShopRender(); cgMenuRender(); }catch(e){} }
function cgSkin(){ const w=cgW(); return CG_SKINS.find(k=>k.id===w.skin)||CG_SKINS[0]; }
// draw a football centered at 0,0 pointing along +x
function cgFootball(x,rx,ry,sk,t,roll){
  t=t||0; x.save();
  // flames burning up behind the ball
  if(sk.fire){ x.globalCompositeOperation="lighter";
    for(let i=0;i<9;i++){ const u=i/8, px=-rx*0.85+u*rx*1.7, fl=0.6+0.4*Math.sin(t*11+i*2.3)*Math.sin(t*7+i), h=ry*(1.1+1.1*(1-Math.abs(u-0.5)*1.4))*fl, w=rx*0.2, top=-h-ry*0.2, sway=Math.sin(t*6+i)*rx*0.06;
      const g=x.createLinearGradient(0,ry*0.2,0,top); g.addColorStop(0,"rgba(255,235,140,.85)"); g.addColorStop(0.45,"rgba(255,140,30,.6)"); g.addColorStop(1,"rgba(200,30,0,0)"); x.fillStyle=g;
      x.beginPath(); x.moveTo(px-w,ry*0.2); x.bezierCurveTo(px-w*1.1,-ry*0.4,px+sway-w*0.3,top*0.7,px+sway,top); x.bezierCurveTo(px+sway+w*0.3,top*0.7,px+w*1.1,-ry*0.4,px+w,ry*0.2); x.closePath(); x.fill(); }
    x.globalCompositeOperation="source-over"; }
  if(sk.glow){ x.shadowColor=sk.glow; x.shadowBlur=rx*0.9; }
  let g; if(sk.grad){ g=x.createLinearGradient(-rx,0,rx,0); g.addColorStop(0,sk.grad[0]); g.addColorStop(1,sk.grad[1]); } else { g=x.createLinearGradient(0,-ry,0,ry); g.addColorStop(0,sk.base[0]); g.addColorStop(1,sk.base[1]); }
  x.fillStyle=g; x.beginPath(); x.ellipse(0,0,rx,ry,0,0,7); x.fill(); x.shadowBlur=0;
  x.save(); x.beginPath(); x.ellipse(0,0,rx,ry,0,0,7); x.clip();
  if(sk.stripe){ x.fillStyle=sk.stripe; x.fillRect(-rx*0.66,-ry,rx*0.07,ry*2); x.fillRect(rx*0.59,-ry,rx*0.07,ry*2); }
  if(sk.stars){ x.fillStyle="#fff"; for(let i=0;i<14;i++){ const px=Math.sin(i*12.9898)*rx*0.85, py=Math.cos(i*78.233)*ry*0.8, tw=0.4+0.6*Math.abs(Math.sin(t*3+i)); x.globalAlpha=tw; x.beginPath(); x.arc(px,py,Math.max(0.6,rx*0.03),0,7); x.fill(); } x.globalAlpha=1;
    const neb=x.createRadialGradient(rx*0.2,ry*0.2,1,rx*0.2,ry*0.2,rx*0.7); neb.addColorStop(0,"rgba(255,90,200,.35)"); neb.addColorStop(1,"rgba(255,90,200,0)"); x.fillStyle=neb; x.fillRect(-rx,-ry,rx*2,ry*2); }
  if(sk.facets){ x.strokeStyle="rgba(80,170,210,.55)"; x.lineWidth=Math.max(0.6,rx*0.03); for(let i=-4;i<=4;i++){ x.beginPath(); x.moveTo(i*rx*0.25-rx*0.3,-ry); x.lineTo(i*rx*0.25+rx*0.3,ry); x.stroke(); x.beginPath(); x.moveTo(i*rx*0.25+rx*0.3,-ry); x.lineTo(i*rx*0.25-rx*0.3,ry); x.stroke(); } }
  // shading + seam
  const sh=x.createLinearGradient(0,-ry,0,ry); sh.addColorStop(0,"rgba(255,255,255,.28)"); sh.addColorStop(0.45,"rgba(255,255,255,0)"); sh.addColorStop(1,"rgba(0,0,0,.25)"); x.fillStyle=sh; x.fillRect(-rx,-ry,rx*2,ry*2);
  x.strokeStyle="rgba(0,0,0,.22)"; x.lineWidth=Math.max(0.6,rx*0.04); x.beginPath(); x.ellipse(0,ry*0.1,rx*0.98,ry*0.55,0,Math.PI*1.05,Math.PI*1.95); x.stroke();
  x.restore();
  // laces: on a spiral they roll around the long axis (visible on the near side only)
  { const th=roll==null?0.35:roll, ly=-ry*0.62*Math.cos(th), face=roll==null?1:Math.sin(th), vis=roll==null?1:Math.max(0,Math.min(1,(face+0.25)/0.5)), sl=ry*0.18*(roll==null?1:Math.max(0.3,Math.abs(face)));
    if(vis>0){ x.globalAlpha=vis; x.strokeStyle=sk.lace; x.lineCap="round"; x.lineWidth=Math.max(1,rx*0.08); x.beginPath(); x.moveTo(-rx*0.36,ly); x.lineTo(rx*0.36,ly); x.stroke();
      x.lineWidth=Math.max(0.8,rx*0.055); for(let k=-3;k<=3;k++){ x.beginPath(); x.moveTo(k*rx*0.1,ly-sl); x.lineTo(k*rx*0.1,ly+sl); x.stroke(); } x.lineCap="butt"; x.globalAlpha=1; }
    if(roll!=null){ x.save(); x.beginPath(); x.ellipse(0,0,rx,ry,0,0,7); x.clip(); x.fillStyle="rgba(255,255,255,.12)"; x.fillRect(-rx,-ry*0.9*Math.cos(th+1.2)-ry*0.12,rx*2,ry*0.24); x.restore(); } }
  if(sk.facets){ x.strokeStyle="#fff"; x.lineWidth=Math.max(0.8,rx*0.04); for(let i=0;i<3;i++){ const a=(t*2+i*2.1)%6.28, px=Math.cos(a)*rx*0.6, py=Math.sin(a*1.3)*ry*0.5, r=rx*0.12*Math.abs(Math.sin(t*4+i)); x.beginPath(); x.moveTo(px-r,py); x.lineTo(px+r,py); x.moveTo(px,py-r); x.lineTo(px,py+r); x.stroke(); } }
  // gold chain wrapped around the ball
  if(sk.chain){ x.shadowColor="rgba(255,140,30,.9)"; x.shadowBlur=rx*0.25; const n=16; for(let k=0;k<=n;k++){ const u=k/n, px=-rx*0.95+u*rx*1.9, py=Math.sin(u*Math.PI*2.2+0.4)*ry*0.78*Math.sqrt(Math.max(0,1-(px/rx)**2));
      x.save(); x.translate(px,py); x.rotate(Math.cos(u*Math.PI*2.2+0.4)*0.9+(k%2?Math.PI/2:0)); x.strokeStyle=k%2?"#FFE27A":"#D99A00"; x.lineWidth=Math.max(1,rx*0.07); x.beginPath(); x.ellipse(0,0,rx*0.1,rx*0.06,0,0,7); x.stroke(); x.restore(); } x.shadowBlur=0; }
  x.restore();
}
// receiver celebrations after touchdowns and big plays
const CG_CELS=[
  {id:"spike",name:"Ball Spike",price:0},
  {id:"point",name:"Point to the Sky",price:1500},
  {id:"flex",name:"Double Flex",price:3000},
  {id:"spin",name:"Spin Move",price:5000},
  {id:"moon",name:"Moonwalk",price:9000},
  {id:"swing",name:"Chain Swing",price:15000}
];
// stadium looks (sky, stands, weather)
const CG_STADS=[
  {id:"night",name:"Night Game",price:0,sky:["#070b16","#18213a"],stand:"#20183a",far:"#241a3d"},
  {id:"day",name:"Day Game",price:2000,sky:["#4f9be8","#bfe3ff"],stand:"#3a3550",far:"#433c5c",sun:1},
  {id:"sunset",name:"Sunset Kickoff",price:5000,sky:["#2b1b4a","#ff8a4c"],stand:"#2c1b3a",far:"#341f44"},
  {id:"snow",name:"Snow Game",price:8000,sky:["#5d6b80","#c9d3e0"],stand:"#2f3446",far:"#363b4f",snow:1},
  {id:"aurora",name:"Aurora Borealis",price:12000,sky:["#03060f","#0d1a2a"],stand:"#151a33",far:"#191e3a",aurora:1}
];
// QB gloves
const CG_GLOVES=[
  {id:"none",name:"Bare Hands",price:0},
  {id:"white",name:"Classic White",price:800,col:"#f2f2f4",dk:"#c7c9d1"},
  {id:"purple",name:"Purple",price:1500,col:"#6a3cb0",dk:"#3d1b72"},
  {id:"gold",name:"Gold",price:2500,col:"#FFD54A",dk:"#c08a00"},
  {id:"black",name:"Blackout",price:2500,col:"#25252c",dk:"#0d0d10"},
  {id:"diamond",name:"Diamond",price:10000,col:"#dff8ff",dk:"#86d3ee",shine:1}
];
// end zone art
const CG_EZ=[
  {id:"nh",name:"North Huddle",price:0,col:"#3a2a6b",txt:"NORTH HUDDLE"},
  {id:"kirko",name:"Kirko Chainz",price:2000,col:"#111118",txt:"KIRKO CHAINZ",txtCol:"#FFD54A"},
  {id:"money",name:"Money Zone",price:4000,col:"#0f5a35",txt:"$ MONEY $",txtCol:"#b6ffcf"},
  {id:"aurora",name:"Aurora",price:6000,grad:["#2EE6C5","#7C5CFF"],txt:"NORTH HUDDLE",txtCol:"rgba(255,255,255,.85)"},
  {id:"fire",name:"On Fire",price:10000,grad:["#ff3d00","#ffb300"],txt:"ON FIRE",txtCol:"rgba(255,255,255,.9)"}
];
function cgEq(cat){ const [list,,eq]=cgCats()[cat]; return list.find(k=>k.id===cgW()[eq])||list[0]; }
function cgCel(){ return cgEq("cel"); }
function cgEZ(){ return cgEq("ez"); }
function cgStad(){ return cgEq("stad"); }
function cgGlove(){ return cgEq("glove"); }
const CG_TABS=[["ball","🏈 Footballs"],["trail","✨ Trails"],["cel","🎉 Celebrations"],["stad","🏟 Stadiums"],["glove","🧤 Gloves"],["ez","🏁 End Zone"]];
function cgShopOpen(){ const sh=$("cgShop"); if(!sh) return; CG.paused=true; sh.hidden=false; cgShopRender(); cgWPull(); cancelAnimationFrame(CG.shopRaf); const tick=()=>{ if(sh.hidden) return; cgShopPaint(); CG.shopRaf=requestAnimationFrame(tick); }; tick(); }
function cgShopClose(){ const sh=$("cgShop"); if(sh) sh.hidden=true; CG.paused=false; CG.last=performance.now(); cancelAnimationFrame(CG.shopRaf); }
function cgShopRender(){ const sh=$("cgShop"); if(!sh||sh.hidden) return; const w=cgW(), tab=CG.shopTab||"ball", [list,own,eq]=cgCats()[tab], top=list[list.length-1].id;
  sh.innerHTML=`<div class="cg-shop-head"><div><div class="label">Shop</div><div class="cg-bank">Bank <b class="num">${cgMoney(w.bank)}</b></div></div><button class="x" data-cgshopx aria-label="Close shop">×</button></div>
    <div class="cg-tabs" role="tablist">${CG_TABS.map(([k,l])=>`<button role="tab" data-cgtab="${k}" aria-selected="${tab===k}">${l}</button>`).join("")}</div>
    <div class="cg-shop-grid">${list.map(k=>{ const has=w[own].includes(k.id), on=w[eq]===k.id, can=w.bank>=k.price;
      return `<div class="cg-skin${on?" on":""}${k.id===top?" legend":""}"><canvas data-pv="${tab}:${k.id}" width="240" height="150"></canvas><div class="cg-skin-nm">${esc(k.name)}</div>
        ${on?`<button class="cg-skin-b eq" disabled>Equipped</button>`:has?`<button class="cg-skin-b" data-cgequip="${tab}:${k.id}">Use it</button>`:`<button class="cg-skin-b buy" data-cgbuy="${tab}:${k.id}" ${can?"":"disabled"}>${cgMoney(k.price)}</button>`}</div>`; }).join("")}</div>
    <p class="cg-shop-note">Every completion adds its Huddle Bucks to your bank, and the bank keeps growing between games.${ACC.id?"":" Sign in to keep your bank and gear on any device."}</p>`;
  const sel=sh.querySelector('[aria-selected="true"]'); if(sel) sel.scrollIntoView({block:"nearest",inline:"center"});
  cgShopPaint(); }
function cgShopPaint(){ const t=performance.now()/1000, now=performance.now();
  const pos=tt=>{ const u=((tt/1000)%1.6)/1.6; return {x:20+u*200, y:120-Math.sin(u*Math.PI)*85, u}; };
  document.querySelectorAll("[data-pv]").forEach(cv=>{ const [cat,id]=cv.dataset.pv.split(":"), k=cgCats()[cat][0].find(s=>s.id===id), x=cv.getContext("2d"); x.setTransform(1,0,0,1,0,0); x.clearRect(0,0,240,150);
    if(cat==="ball"){ x.translate(120,82); x.rotate(-0.35); cgFootball(x,72,44,k,t); }
    else if(cat==="trail"){ const L=2.6, life=(k.life||380)*L, cur=pos(now), pts=[]; for(let dt=life;dt>=0;dt-=16){ const q=pos(now-dt); if(q.u<=cur.u) pts.push({x:q.x,y:q.y,r:16,t:now-dt}); }
      cgTrailDraw(x,pts,k,now,L); x.save(); x.translate(cur.x,cur.y); x.rotate(-0.6+cur.u*1.2); cgFootball(x,22,13.5,cgSkin(),t); x.restore(); }
    else if(cat==="cel"){ x.fillStyle="#2b7437"; x.fillRect(0,110,240,40); const cam=CG.cam, ww=CG.w; CG.cam={x:0,y:-12.5,fx:560,cx:120,hy:0,kv:132*cgZe(12.5)}; CG.w=240;
      const ct=(t%2.2); cgMan(x,{X:0,Y:0,c:{j:"#4F2683",t:"#FFC62F",h:"#4F2683",p:"#E9E4D4"},face:"back",num:18,cel:{type:k.id,t:ct}}); CG.cam=cam; CG.w=ww;
      if(k.id==="spike"){ const u=Math.min(1,ct/0.5); x.save(); x.translate(132+u*8,30+u*95-(ct>0.5?Math.abs(Math.sin((ct-0.5)*9))*20*Math.exp(-(ct-0.5)*3):0)); x.rotate(1.2); cgFootball(x,12,7.5,cgSkin(),t); x.restore(); } }
    else if(cat==="stad"){ cgSky(x,240,150,95,k,t); x.fillStyle=k.far; x.fillRect(0,95,240,22); x.fillStyle="#2b7437"; x.beginPath(); x.moveTo(0,150); x.lineTo(60,117); x.lineTo(180,117); x.lineTo(240,150); x.fill(); x.fillStyle=k.stand; x.beginPath(); x.moveTo(0,117); x.lineTo(60,117); x.lineTo(0,150); x.fill(); x.beginPath(); x.moveTo(240,117); x.lineTo(180,117); x.lineTo(240,150); x.fill(); if(k.snow) cgSnow(x,240,150,t,40); }
    else if(cat==="glove"){ x.translate(120,78); x.rotate(-0.3); cgFootball(x,46,28,cgSkin(),t); const gc=k.col||"#c98d66", gd=k.dk||"#9a603f"; x.fillStyle=gc; x.beginPath(); x.ellipse(14,26,26,20,-0.2,0,7); x.fill();
      x.strokeStyle=gc; x.lineCap="round"; x.lineWidth=11; for(let f=0;f<4;f++){ x.beginPath(); x.moveTo(-4+f*10,14); x.quadraticCurveTo(-14+f*9,-6-f*2,-26+f*12,-14-f*3); x.stroke(); } x.strokeStyle=gd; x.lineWidth=1.5; for(let f=1;f<4;f++){ x.beginPath(); x.moveTo(-9+f*10,14); x.quadraticCurveTo(-19+f*9,-6-f*2,-31+f*12,-14-f*3); x.stroke(); }
      if(k.shine){ x.strokeStyle="#fff"; x.lineWidth=1.5; for(let i=0;i<3;i++){ const a=(t*2+i*2)%6.28, px=Math.cos(a)*24, py=10+Math.sin(a)*12, r=6*Math.abs(Math.sin(t*4+i)); x.beginPath(); x.moveTo(px-r,py); x.lineTo(px+r,py); x.moveTo(px,py-r); x.lineTo(px,py+r); x.stroke(); } } }
    else if(cat==="ez"){ x.fillStyle="#2b7437"; x.fillRect(0,0,240,150); x.beginPath(); x.moveTo(36,32); x.lineTo(204,32); x.lineTo(232,122); x.lineTo(8,122); x.closePath(); x.fillStyle=k.grad?(()=>{ const g=x.createLinearGradient(8,0,232,0); g.addColorStop(0,k.grad[0]); g.addColorStop(1,k.grad[1]); return g; })():k.col; x.fill();
      x.strokeStyle="#fff"; x.lineWidth=2; x.stroke(); x.fillStyle=k.txtCol||"rgba(255,255,255,.6)"; x.font='800 30px "Barlow Condensed",system-ui'; x.textAlign="center"; x.save(); x.translate(120,88); x.scale(1,0.7); x.fillText(k.txt,0,0); x.restore(); }
  }); }
document.addEventListener("click",e=>{
  if(e.target.closest("[data-cgshop]")){ e.preventDefault(); if(!$("cgGame")||$("cgGame").hidden){ openChainGame(); } cgShopOpen(); return; }
  if(e.target.closest("[data-cgshopx]")){ cgShopClose(); return; }
  const tb=e.target.closest("[data-cgtab]"); if(tb){ CG.shopTab=tb.dataset.cgtab; cgShopRender(); return; }
  const b=e.target.closest("[data-cgbuy]"); if(b){ const [cat,id]=b.dataset.cgbuy.split(":"), [list,own,eq]=cgCats()[cat], k=list.find(s=>s.id===id), w=cgW(); if(!k||w[own].includes(k.id)) return; if(w.bank<k.price) return toast("Not enough Huddle Bucks yet.");
    w.bank-=k.price; w[own].push(k.id); w[eq]=k.id; cgWSave(true); cgShopRender(); toast(`${k.name} unlocked! 🛒`); cgAch("shop"); if(cat==="ball"&&k.id==="firechain"){ cgAch("fireball"); cgSay("Oh my! He bought the Chainz on Fire ball!",true); } if(cat==="trail") cgAch("trail"); return; }
  const q=e.target.closest("[data-cgequip]"); if(q){ const [cat,id]=q.dataset.cgequip.split(":"), [,,eq]=cgCats()[cat]; cgW()[eq]=id; cgWSave(true); cgShopRender(); return; }
});
/* ---------- fire mode: the stadium burns, and fans throw chains onto the field ---------- */
function cgStadiumFire(x,W,H,NEAR,FAR,SB){
  const heat=Math.max(cgHeat(),CG.gdFire>performance.now()?1:0), t=performance.now()/1000, cam=CG.cam, big=heat>=1?1.35:1;
  // orange glow over the sky and stands
  let g=x.createLinearGradient(0,0,0,cam.hy*1.15); g.addColorStop(0,"rgba(255,70,0,0)"); g.addColorStop(0.55,`rgba(255,90,10,${0.18*big})`); g.addColorStop(1,`rgba(255,140,30,${0.35*big})`); x.fillStyle=g; x.fillRect(0,0,W,cam.hy*1.15);
  x.save(); x.globalCompositeOperation="lighter";
  const tongue=(px,py,h,w,i)=>{ const fl=0.55+0.45*Math.sin(t*9+i*1.9)*Math.sin(t*5.3+i*0.7), hh=h*fl*big, sway=Math.sin(t*4+i)*w*0.35;
    const gg=x.createLinearGradient(0,py,0,py-hh); gg.addColorStop(0,"rgba(255,230,120,.75)"); gg.addColorStop(0.5,"rgba(255,120,20,.5)"); gg.addColorStop(1,"rgba(200,20,0,0)"); x.fillStyle=gg;
    x.beginPath(); x.moveTo(px-w,py); x.bezierCurveTo(px-w,py-hh*0.5,px+sway-w*0.2,py-hh*0.8,px+sway,py-hh); x.bezierCurveTo(px+sway+w*0.2,py-hh*0.8,px+w,py-hh*0.5,px+w,py); x.closePath(); x.fill(); };
  // orange heat washing over the stand surfaces
  x.globalCompositeOperation="source-over";
  for(const sd of [-1,1]){ const q=[[sd*31,NEAR+4,0],[sd*31,FAR,0],[sd*95,FAR,44],[sd*95,NEAR+4,44]].map(p=>cgP(p[0],p[1],p[2])); const gr=x.createLinearGradient(0,cam.hy,0,0); gr.addColorStop(0,`rgba(255,110,20,${0.22*big})`); gr.addColorStop(1,`rgba(255,60,0,${0.32*big})`); x.fillStyle=gr; x.beginPath(); q.forEach((p,i)=>i?x.lineTo(p[0],p[1]):x.moveTo(p[0],p[1])); x.closePath(); x.fill(); }
  { const q=[[-90,SB,0],[90,SB,0],[90,FAR,40],[-90,FAR,40]].map(p=>cgP(p[0],p[1],p[2])); x.fillStyle=`rgba(255,90,10,${0.25*big})`; x.beginPath(); q.forEach((p,i)=>i?x.lineTo(p[0],p[1]):x.moveTo(p[0],p[1])); x.closePath(); x.fill(); }
  x.globalCompositeOperation="lighter";
  // rows of flames across the far stands
  for(const [Y,Z,k] of [[SB+2,1,0],[SB+28,19,1],[FAR,40,2]]) for(let i=0;i<=30;i++){ const X=-90+i*6, [px,py,ps]=cgP(X+(k%2)*3,Y,Z); if(px<-20||px>W+20) continue; tongue(px,py+2,Math.max(8,ps*(6+k*2)),Math.max(4,ps*2.6),i+k*31); }
  // rows of flames climbing each side stand, receding into the distance
  for(const sd of [-1,1]) for(const [X,Z] of [[33,1],[52,14],[72,28],[94,43]]) for(let i=0;i<20;i++){ const Y=cam.y+12+i*i*0.34+(Z%2), [px,py,ps]=cgP(sd*X,Y,Z); if(px<-30||px>W+30||py<-20||py>cam.hy+60) continue; tongue(px,py+2,Math.max(9,ps*7),Math.max(4,ps*2.8),i+X*sd); }
  // embers drifting up
  for(let i=0;i<(heat>=1?60:36);i++){ const u=(i*0.6180339)%1, sp=0.12+((i*0.37)%1)*0.25, ph=(t*sp+u)%1, ex=(u*W+Math.sin(t*1.3+i)*20+W)%W, ey=cam.hy*1.05-ph*cam.hy*1.1;
    x.fillStyle=`rgba(255,${150+((i*37)%80)},40,${(1-ph)*0.8})`; x.beginPath(); x.arc(ex,ey,1.2+(i%3)*0.7,0,7); x.fill(); }
  x.restore();
}
// chains flung from the stands after a fire-mode catch; they land on the field and fade before the next snap
function cgThrowChains(cx,cy){
  const n=cgHeat()>=1?26:14, now=performance.now();
  CG.thrownChains=(CG.thrownChains||[]).filter(c=>!c.landed||now-c.landed<1500);
  for(let i=0;i<n;i++){ const sd=Math.random()<0.5?-1:1, sx=sd*(31+Math.random()*10), sy=cy-8+Math.random()*30, tx=cx+(Math.random()-0.5)*22, ty=cy+(Math.random()-0.5)*14, T=0.9+Math.random()*0.6;
    CG.thrownChains.push({x:sx,y:sy,z:6+Math.random()*6,vx:(tx-sx)/T,vy:(ty-sy)/T,vz:0,T,delay:now+i*(1100/n),st:(Math.random()*CG_CHAINS.length)|0,spin:Math.random()*6,spinv:(Math.random()-0.5)*14,landed:0}); }
  CG.thrownChains.forEach(c=>{ if(!c.landed&&c.vz===0) c.vz=(-c.z+0.5*22*c.T*c.T)/c.T; });
}
function cgChainsStep(dt){ const now=performance.now(); (CG.thrownChains||[]).forEach(c=>{ if(c.landed||now<c.delay) return; c.x+=c.vx*dt; c.y+=c.vy*dt; c.vz-=22*dt; c.z+=c.vz*dt; c.spin+=c.spinv*dt; if(c.z<=0.05){ c.z=0.05; c.landed=now; } }); }
function cgChainsDraw(x){ const now=performance.now(); CG.thrownChains=(CG.thrownChains||[]).filter(c=>!c.landed||now-c.landed<2600);
  CG.thrownChains.forEach(c=>{ if(now<c.delay) return; const [gx,gy,gs]=cgP(c.x,c.y), [px,py,ps]=cgP(c.x,c.y,c.z), r=Math.max(3.5,0.5*ps), st=CG_CHAINS[c.st], a=c.landed?Math.max(0,1-(now-c.landed)/2600):1;
    x.globalAlpha=a*0.35; x.fillStyle="#000"; x.beginPath(); x.ellipse(gx,gy,r,r*0.3,0,0,7); x.fill(); x.globalAlpha=a;
    const sq=c.landed?0.32:0.35+0.65*Math.abs(Math.sin(c.spin)), rot=c.landed?0:c.spin*0.3, links=12;
    if(!c.landed){ x.shadowColor="rgba(255,200,60,.9)"; x.shadowBlur=5; }
    for(let k=0;k<links;k++){ const an=k/links*Math.PI*2, lx=px+Math.cos(an+rot)*r, ly=py+Math.sin(an+rot)*r*sq;
      x.save(); x.translate(lx,ly); x.rotate(an+rot+(k%2?Math.PI/2:0)); x.strokeStyle=k%2?st.c1:st.c2; x.lineWidth=Math.max(1.4,r*0.18); x.beginPath(); x.ellipse(0,0,r*0.24,r*0.14,0,0,7); x.stroke(); x.restore(); }
    x.shadowBlur=0; if(!c.landed){ x.fillStyle="rgba(255,240,180,.8)"; x.beginPath(); x.arc(px+Math.cos(now/90+c.st)*r,py-r*sq,Math.max(1,r*0.12),0,7); x.fill(); }
    x.globalAlpha=1; }); }
function cgEZFill(x){ const k=cgEZ(); if(!k.grad) return k.col; const g=x.createLinearGradient(0,0,CG.w,0); g.addColorStop(0,k.grad[0]); g.addColorStop(1,k.grad[1]); return g; }
function cgSky(x,W,H,hy,st,t){
  let g=x.createLinearGradient(0,0,0,hy); g.addColorStop(0,st.sky[0]); g.addColorStop(1,st.sky[1]); x.fillStyle=g; x.fillRect(0,0,W,hy+2);
  const glow=(gx,gy,r,c)=>{ const q=x.createRadialGradient(gx,gy,0,gx,gy,r); q.addColorStop(0,c); q.addColorStop(1,"rgba(0,0,0,0)"); x.fillStyle=q; x.fillRect(0,0,W,hy); };
  if(st.id==="night"){ glow(W*0.3,hy*0.15,W*0.7,"rgba(46,230,197,.18)"); glow(W*0.8,hy*0.3,W*0.6,"rgba(124,92,255,.2)"); }
  else if(st.sun){ glow(W*0.82,hy*0.18,W*0.35,"rgba(255,250,210,.9)"); x.fillStyle="#fffbe6"; x.beginPath(); x.arc(W*0.82,hy*0.18,Math.max(6,W*0.03),0,7); x.fill(); }
  else if(st.id==="sunset"){ glow(W*0.5,hy,W*0.6,"rgba(255,170,80,.75)"); glow(W*0.2,hy*0.3,W*0.4,"rgba(255,90,140,.25)"); }
  else if(st.snow){ glow(W*0.5,hy*0.6,W*0.7,"rgba(255,255,255,.2)"); }
  else if(st.aurora){ x.save(); x.globalCompositeOperation="lighter"; for(let i=0;i<3;i++){ const col=["rgba(46,230,197,","rgba(80,255,150,","rgba(124,92,255,"][i];
      for(let k=0;k<3;k++){ x.strokeStyle=col+(0.12-k*0.03)+")"; x.lineWidth=hy*(0.07+k*0.05); x.beginPath(); for(let px=-10;px<=W+10;px+=8){ const py=hy*(0.22+i*0.14)+Math.sin(px*0.012+t*0.5+i*1.7)*hy*0.08+Math.sin(px*0.03-t*0.8)*hy*0.02; px<0?x.moveTo(px,py):x.lineTo(px,py); } x.stroke(); } }
    x.fillStyle="#fff"; for(let i=0;i<40;i++){ x.globalAlpha=0.3+0.5*Math.abs(Math.sin(t+i)); x.fillRect((i*137.5)%W,(i*71.3)%(hy*0.9),1.3,1.3); } x.globalAlpha=1; x.restore(); }
}
function cgSnow(x,W,H,t,n){ x.fillStyle="rgba(255,255,255,.85)"; for(let i=0;i<n;i++){ const sp=24+(i%7)*9, px=((i*97.3)+t*(8+(i%3)*6)+Math.sin(t+i)*10)%W, py=((i*53.1)+t*sp)%H, r=0.8+(i%4)*0.5; x.beginPath(); x.arc((px+W)%W,py,r,0,7); x.fill(); } }
/* ---------- drawing ---------- */
function cgBoost(Y){ return 1+Math.max(0,Y-CG.cam.y-14)/28; }
function cgPB(X,Y,Z){ const [gx,gy,s0]=cgP(X,Y), b=cgBoost(Y); return [gx,gy-(Z||0)*s0*b,s0*b]; }
function cgBallZ(k,dist){ return 2.2+Math.sin(Math.PI*k)*Math.min(11,dist/3.6); }   // leaves his hand and arrives at the receiver's hands
function cgBall(x,bx,by,z,m,hx,hy,spin,nxt){
  const [sx,sy,ss]=cgP(bx,by); x.fillStyle="rgba(0,0,0,.3)"; x.beginPath(); x.ellipse(sx,sy,0.3*ss+1,0.12*ss+1,0,0,7); x.fill();
  let [px,py,ps]=cgPB(bx,by,z); if(m<1){ px=hx+(px-hx)*m; py=hy+(py-hy)*m; } const r=Math.max(4,Math.min(16,0.32*ps*(1+(1-m)*1.5)));
  // spiral: nose points along the flight path; seen end-on the ball looks rounder
  let ang=-0.5+spin*0.3, rx=r, roll=null;
  if(nxt){ let [qx,qy]=cgPB(nxt[0],nxt[1],nxt[2]); if(m<1){ const m2=Math.min(1,m+0.05); qx=hx+(qx-hx)*m2; qy=hy+(qy-hy)*m2; } const sl=Math.hypot(qx-px,qy-py), wl=Math.hypot(nxt[0]-bx,nxt[1]-by,nxt[2]-z)*ps;
    ang=Math.atan2(qy-py,qx-px)+Math.sin(performance.now()/70)*0.04; rx=r*(0.68+0.32*Math.min(1,sl/Math.max(1e-3,wl)*1.6)); roll=performance.now()/1000*26; }
  const sk=cgSkin(), tr=cgTrail(), now=performance.now(), L=1.8, life=(tr.life||380)*L, rr=Math.max(7,r); CG.trail=(CG.trail||[]).filter(p=>now-p.t<life); if(tr.id!=="none"&&m>0.12) CG.trail.push({x:px,y:py,r:rr,t:now});
  cgTrailDraw(x,[...CG.trail,{x:px,y:py,r:rr,t:now}],tr,now,L);
  x.save(); x.translate(px,py); x.rotate(ang); cgFootball(x,rx,r*0.62,sk,now/1000,roll); x.restore(); }
function cgPoly(x,pts,fill){ x.fillStyle=fill; x.beginPath(); pts.forEach((p,i)=>{ const q=cgP(p[0],p[1],p[2]); i?x.lineTo(q[0],q[1]):x.moveTo(q[0],q[1]); }); x.closePath(); x.fill(); }
function cgLine(x,a,b,col,lw){ const p=cgP(a[0],a[1],a[2]), q=cgP(b[0],b[1],b[2]); x.strokeStyle=col; x.lineWidth=lw; x.beginPath(); x.moveTo(p[0],p[1]); x.lineTo(q[0],q[1]); x.stroke(); }
function cgDraw(){
  const c=$("cgCanvas"); if(!c||!CG.cam) return; const x=c.getContext("2d"), W=CG.w, H=CG.h, cam=CG.cam; x.setTransform(CG.dpr,0,0,CG.dpr,0,0);
  const NEAR=cam.y+1.2, FAR=150;
  // sky for the chosen stadium
  let g; cgSky(x,W,H,cam.hy,cgStad(),performance.now()/1000);
  // ground beyond the field
  x.fillStyle="#1d4a28"; x.fillRect(0,cam.hy,W,H-cam.hy);
  const BO=CG.dr?CG.dr.ballOn:25, GL=100-BO, YB=GL+10, OG=-BO;   // goal line, back line, own goal line (yards past the LOS)
  CG.ybk=YB; const SB=YB+7;                                        // far stands start just behind the end zone
  // far stands behind the end zone (rising away from the field)
  cgPoly(x,[[-90,SB,0],[90,SB,0],[90,FAR+YB,40],[-90,FAR+YB,40]],cgStad().far);
  for(let r=0;r<14;r++){ const y=SB+2+r*4; cgLine(x,[-90,y,(y-SB)*0.69],[90,y,(y-SB)*0.69],r%2?"rgba(255,255,255,.07)":"rgba(255,198,47,.08)",1); }
  // field: 5-yard mowing stripes by real field position
  const F0=Math.max(NEAR,OG-10);
  for(let k=-2;k<20;k++){ const y=OG+k*5, y0=Math.max(F0,y), y1=Math.min(GL,y+5); if(y1<=y0||y1<=NEAR) continue; cgPoly(x,[[-26.7,y0],[26.7,y0],[26.7,y1],[-26.7,y1]],(k+20)%2?"#2f7f3c":"#2b7437"); }
  cgPoly(x,[[-26.7,GL],[26.7,GL],[26.7,YB],[-26.7,YB]],cgEZFill(x));
  if(OG>NEAR-10){ const a0=Math.max(NEAR,OG-10); if(OG>a0) cgPoly(x,[[-26.7,a0],[26.7,a0],[26.7,OG],[-26.7,OG]],"#3a2a6b"); }
  // end zone lettering
  { const [ex,ey,es]=cgP(0,GL+5); const [,ey2]=cgP(0,GL+7); x.save(); x.translate(ex,ey); x.scale(1,Math.max(0.12,(ey-ey2)/(2*es))); x.fillStyle=cgEZ().txtCol||"rgba(255,255,255,.55)"; x.font=`800 ${4*es}px "Barlow Condensed",system-ui`; x.textAlign="center"; x.textBaseline="middle"; x.fillText(cgEZ().txt,0,0); x.restore(); x.textBaseline="alphabetic"; }
  // sidelines, yard lines, hashes, numbers
  cgLine(x,[-26.7,F0],[-26.7,YB],"#fff",2); cgLine(x,[26.7,F0],[26.7,YB],"#fff",2); cgLine(x,[-26.7,YB],[26.7,YB],"#fff",2);
  for(let f=0;f<=100;f+=5){ const y=f-BO; if(y<NEAR||y>GL) continue; cgLine(x,[-26.7,y],[26.7,y],f===0||f===100?"#fff":"rgba(255,255,255,.75)",Math.max(1,cgP(0,y)[2]*(f%100?0.12:0.2))); }
  for(let f=1;f<100;f++){ const y=f-BO; if(f%5===0||y<NEAR) continue; for(const hx of [-3.1,3.1,-25.9,25.9]) cgLine(x,[hx-0.35,y],[hx+0.35,y],"rgba(255,255,255,.6)",1); }
  for(let f=10;f<=90;f+=10){ const y=f-BO; if(y<NEAR+2) continue; const lab=String(f<=50?f:100-f);
    for(const nx of [-19,19]){ const [px,py,ps]=cgP(nx,y), [,py2]=cgP(nx,y+1); x.save(); x.translate(px,py); x.scale(1,Math.max(0.1,(py-py2)/ps)); x.fillStyle="rgba(255,255,255,.7)"; x.font=`800 ${2*ps}px "Barlow Condensed",system-ui`; x.textAlign="center"; x.textBaseline="middle"; x.fillText(lab.split("").join(" "),0,0); x.restore(); } }
  x.textBaseline="alphabetic";
  cgLine(x,[-26.7,0],[26.7,0],"#3b82f6",Math.max(2,cgP(0,0)[2]*0.18));
  if(CG.dr&&BO+CG.dr.toGo<100) cgLine(x,[-26.7,CG.dr.toGo],[26.7,CG.dr.toGo],"#FFD54A",Math.max(2,cgP(0,CG.dr.toGo)[2]*0.16));
  // goal post
  { const Y=YB; cgLine(x,[0,Y,0],[0,Y,3.3],"#FFD54A",3); cgLine(x,[-3.1,Y,3.3],[3.1,Y,3.3],"#FFD54A",3); cgLine(x,[-3.1,Y,3.3],[-3.1,Y,11],"#FFD54A",2.5); cgLine(x,[3.1,Y,3.3],[3.1,Y,11],"#FFD54A",2.5); }
  // side stands rising away from each sideline
  for(const sd of [-1,1]){ cgPoly(x,[[sd*31,NEAR,0],[sd*31,FAR,0],[sd*95,FAR,44],[sd*95,NEAR,44]],cgStad().stand);
    for(let r=0;r<16;r++){ const X=sd*(32+r*3.5); cgLine(x,[X,NEAR,(r*3.5+1)*0.69],[X,FAR,(r*3.5+1)*0.69],r%2?"rgba(255,255,255,.06)":"rgba(124,92,255,.14)",1); }
    cgPoly(x,[[sd*26.7,NEAR],[sd*26.7,FAR],[sd*31,FAR],[sd*31,NEAR]],"#22552f"); }
  // stadium lights
  for(const lx of [0.08,0.92]){ const gx=W*lx, gy=cam.hy*0.38; g=x.createRadialGradient(gx,gy,0,gx,gy,W*0.18); g.addColorStop(0,"rgba(255,255,240,.55)"); g.addColorStop(1,"rgba(255,255,240,0)"); x.fillStyle=g; x.fillRect(gx-W*0.2,gy-W*0.2,W*0.4,W*0.4); x.fillStyle="#fffbe6"; x.fillRect(gx-12,gy-4,24,8); }
  if(cgHeat()>=0.7||CG.gdFire>performance.now()) cgStadiumFire(x,W,H,NEAR,FAR+YB,SB);
  // faint route
  // routes: each receiver's own color, dark outline for contrast on the grass, arrow + name at the end
  if(CG.wrs&&(CG.phase==="set"||CG.phase==="route"||CG.phase==="air")){ const fade=CG.phase==="air"?0.35:1;
    CG.wrs.forEach(w=>{ const col=CG_WRCOL[w.i], q=w.pts.map(p=>cgP(p[0],p[1])); x.globalAlpha=fade; x.lineJoin="round"; x.lineCap="round";
      x.strokeStyle="rgba(5,20,10,.55)"; x.lineWidth=7; x.beginPath(); q.forEach((p,i)=>i?x.lineTo(p[0],p[1]):x.moveTo(p[0],p[1])); x.stroke();
      x.strokeStyle=col; x.lineWidth=3.5; x.beginPath(); q.forEach((p,i)=>i?x.lineTo(p[0],p[1]):x.moveTo(p[0],p[1])); x.stroke();
      const a=q[q.length-2], z=q[q.length-1], ang=Math.atan2(z[1]-a[1],z[0]-a[0]);
      x.fillStyle=col; x.strokeStyle="rgba(5,20,10,.6)"; x.lineWidth=2; x.beginPath(); x.moveTo(z[0]+Math.cos(ang)*9,z[1]+Math.sin(ang)*9); x.lineTo(z[0]+Math.cos(ang+2.5)*9,z[1]+Math.sin(ang+2.5)*9); x.lineTo(z[0]+Math.cos(ang-2.5)*9,z[1]+Math.sin(ang-2.5)*9); x.closePath(); x.stroke(); x.fill();
      if(CG.phase==="route"||CG.phase==="set"){ x.font=`800 ${CG.phase==="set"?14:12}px "Barlow Condensed",system-ui`; x.textAlign="center"; const t=w.route.toUpperCase(), tw=x.measureText(t).width+10, lx=Math.max(tw/2+2,Math.min(CG.w-tw/2-2,z[0])), ly=z[1]-12;
        x.fillStyle="rgba(11,18,32,.8)"; x.fillRect(lx-tw/2,ly-11,tw,15); x.fillStyle=col; x.fillText(t,lx,ly); }
      x.globalAlpha=1; x.lineCap="butt"; }); }
  // players, far to near. The pass rush pushes the pocket back as the clock runs.
  const prog=CG.phase==="route"?Math.min(1,CG.t/CG.pocket):CG.phase==="air"?Math.min(1,(CG.t)/CG.pocket):CG.res==="sack"?1:0.4;
  const run=performance.now()/1000, men=[];
  const OFF={j:"#4F2683",t:"#FFC62F",h:"#4F2683",p:"#E9E4D4"}, DEF={j:"#B3202A",t:"#fff",h:"#C9CCD3",p:"#fff"};
  for(let i=-2;i<=2;i++) men.push({X:i*1.5,Y:-1-prog*3.2,c:OFF,face:"back",num:[77,63,56,64,71][i+2],ph:0});
  for(let i=0;i<4;i++) men.push({X:(i-1.5)*2.1,Y:0.9-prog*3.4+(i%3?0.3:0),c:DEF,face:"front",num:[97,93,99,90][i],ph:prog>0.05?run*9+i:0});
  if(CG.wrs){ const live=CG.phase==="route"||CG.phase==="air", car=CG.phase==="result"&&CG.post&&CG.post.carrier;
    [...CG.cbs,CG.sf].forEach(d=>men.push({X:d.x,Y:d.y,c:DEF,face:"front",num:d.num,ph:live||car===d?run*11:0,up:car===d&&CG.post.t<0.4}));
    if(CG.blz) men.push({X:CG.blz.x,Y:CG.blz.y,c:DEF,face:"front",num:54,ph:live?run*12:0});
    const cel=CG.post&&CG.post.cel, celT=cel?CG.post.t-cel.t0:0;
    CG.wrs.forEach(w=>men.push({cel:car===w&&cel?{type:cel.type,t:celT}:null,X:w.x,Y:w.y,c:OFF,face:"back",num:w.num,rc:CG_WRCOL[w.i],ph:live||car===w?run*12:0,wr:1,up:(CG.phase==="air"&&w.track&&CG.ball.T-CG.ball.t<0.45)||(car===w&&CG.post.t<0.4)})); }
  // pre-snap read: zone areas, the double-team, the blitz
  if(CG.phase==="set"&&CG.cbs){ x.setLineDash([4,5]); x.lineWidth=2; x.strokeStyle="rgba(255,90,80,.75)";
    CG.cbs.forEach(c=>{ if(!c.zone) return; const [zx,zy,zs]=cgP(c.zone.x,c.zone.y); x.beginPath(); x.ellipse(zx,zy,5*zs,1.9*zs,0,0,7); x.stroke(); }); x.setLineDash([]);
    const tag=(X,Y,t)=>{ const [px,py,ps]=cgPB(X,Y,2.6); x.font='800 12px "Barlow Condensed",system-ui'; x.textAlign="center"; const tw=x.measureText(t).width+10; x.fillStyle="#C8102E"; x.fillRect(px-tw/2,py-14,tw,16); x.fillStyle="#fff"; x.fillText(t,px,py-2); };
    CG.cbs.forEach(c=>{ if(c.zone) tag(c.x,c.y,"ZONE"); }); if(CG.sf.dbl!=null) tag(CG.sf.x,CG.sf.y,"DOUBLE"); if(CG.blz) tag(CG.blz.x,CG.blz.y,"BLITZ!"); }
  men.sort((a,b)=>b.Y-a.Y).forEach(m=>cgMan(x,m));
  cgChainsDraw(x);
  if(cgStad().snow) cgSnow(x,W,H,performance.now()/1000,110);
  // aim preview while swiping: the ring says what will happen if you let go now
  if(CG.drag&&CG.phase==="route"){ const a=cgAim(CG.drag);
    if(a){ const now=performance.now(); if(!CG.pred||now-CG.pred.at>60||Math.hypot(CG.pred.tx-a.tx,CG.pred.ty-a.ty)>0.6) CG.pred={at:now,tx:a.tx,ty:a.ty,j:cgPredict(a)};
      const k0=CG.pred.j.kind, col={open:"#3BE37A",dive:"#3BE37A",contested:"#FFC62F",covered:"#FF5A4F",miss:"rgba(255,255,255,.9)"}[k0], lab={open:"OPEN",dive:"DIVE FOR IT",contested:"CONTESTED",covered:"COVERED",miss:"NO ONE THERE"}[k0];
      const [hx,hy]=cgHand(); x.setLineDash([3,6]); x.strokeStyle=col; x.globalAlpha=0.85; x.lineWidth=2.5; x.beginPath(); x.moveTo(hx,hy);
      for(let i=1;i<=24;i++){ const k=i/24, bx=0.5+(a.tx-0.5)*k, by=CG_QBY+(a.ty-CG_QBY)*k, z=cgBallZ(k,a.yds), q=cgPB(bx,by,z), m=Math.min(1,k*4); x.lineTo(hx+(q[0]-hx)*m,hy+(q[1]-hy)*m); } x.stroke(); x.setLineDash([]); x.globalAlpha=1;
      const [tx,ty,ts]=cgP(a.tx,a.ty); x.globalAlpha=0.22; x.fillStyle=col; x.beginPath(); x.ellipse(tx,ty,1.9*ts,0.7*ts,0,0,7); x.fill(); x.globalAlpha=1;
      x.strokeStyle=col; x.lineWidth=3.5; x.beginPath(); x.ellipse(tx,ty,1.9*ts,0.7*ts,0,0,7); x.stroke();
      x.font='800 15px "Barlow Condensed",system-ui'; x.textAlign="center"; const txt=Math.round(a.ty)+" YDS · "+lab, tw=x.measureText(txt).width+14;
      x.fillStyle="rgba(11,18,32,.82)"; x.fillRect(tx-tw/2,ty-1.2*ts-24,tw,20); x.fillStyle=col; x.fillText(txt,tx,ty-1.2*ts-9); } }
  // ball in the air
  if(CG.phase==="air"&&CG.ball){ const b=CG.ball, k=Math.min(1,b.t/b.T), bx=b.x0+(b.tx-b.x0)*k, by=b.y0+(b.ty-b.y0)*k, z=cgBallZ(k,b.dist), k2=Math.min(1.02,k+0.02), nxt=[b.x0+(b.tx-b.x0)*k2,b.y0+(b.ty-b.y0)*k2,cgBallZ(k2,b.dist)];
    const [tx,ty,ts]=cgP(b.tx,b.ty); x.strokeStyle="rgba(255,255,255,.45)"; x.lineWidth=2; x.beginPath(); x.ellipse(tx,ty,1.6*ts,0.6*ts,0,0,7); x.stroke();
    const [hx,hy]=cgHand(), m=Math.min(1,k*5); cgBall(x,bx,by,z,m,hx,hy,k,nxt); }
  if(CG.phase==="result"&&CG.post){ const b=CG.post.ball; cgBall(x,b.x,b.y,b.z,1,0,0,CG.post.t*3); }
  // pocket clock
  if(CG.phase==="route"){ const left=Math.max(0,CG.pocket-CG.t), f=left/CG.pocket; x.fillStyle="rgba(0,0,0,.45)"; x.fillRect(W-112,12,100,10); x.fillStyle=f>0.4?"#5EF2D6":f>0.2?"#FFC62F":"#ff5a4f"; x.fillRect(W-112,12,100*f,10); x.fillStyle="#fff"; x.font='700 11px "Barlow Condensed",system-ui'; x.textAlign="right"; x.fillText("POCKET",W-12,36); }
  if(CG.wrs){ x.fillStyle="rgba(255,255,255,.8)"; x.font='700 13px "Barlow Condensed",system-ui'; x.textAlign="left"; const d=CG.dr||{ballOn:25}; x.fillText(`BALL ON ${cgSpot(d.ballOn)} · TD ${CG.tds||0} · TURNOVERS ${"✕".repeat(CG.turnovers||0)}${"·".repeat(Math.max(0,3-(CG.turnovers||0)))}`,12,22);
    const st=CG.streak||0; if(st>=2){ const t=st>=5?"🔥🔥 BLAZING  ×2":st>=3?"🔥 ON FIRE  ×1.5":"♨ HEATING UP"; x.font='800 16px "Barlow Condensed",system-ui'; const tw=x.measureText(t).width+16; const gr=x.createLinearGradient(10,30,10+tw,30); gr.addColorStop(0,st>=3?"#ff3d00":"#ff9a3c"); gr.addColorStop(1,st>=5?"#ffd000":"#ff6a00"); x.fillStyle=gr; x.beginPath(); x.roundRect?x.roundRect(10,32,tw,24,12):x.rect(10,32,tw,24); x.fill(); x.fillStyle="#fff"; x.fillText(t,18,49); } }
  cgQB(x,W,H);
}
// a player seen from behind (offense) or the front (defense), sized by distance
function cgMan(x,m){
  const [px,py,s0]=cgP(m.X,m.Y), dep=m.Y-CG.cam.y, s=s0*(1+Math.max(0,dep-14)/28), c=m.c, Y=z=>py-z*s;
  if(px<-40||px>CG.w+40) return;
  if(m.wr){ x.strokeStyle=m.rc||"#5EF2D6"; x.lineWidth=3; x.beginPath(); x.ellipse(px,py,0.75*s+3,0.28*s+2,0,0,7); x.stroke(); }
  x.fillStyle="rgba(0,0,0,.32)"; x.beginPath(); x.ellipse(px,py,0.5*s,0.17*s,0,0,7); x.fill();
  const C=m.cel; if(C){ if(C.type==="spin"&&Math.floor(C.t/0.13)%2) m.face="front"; if(C.type==="moon") m.ph=C.t*14; else m.ph=0; }
  const sw=Math.sin(m.ph||0)*0.22*s, lw=Math.max(1.5,0.2*s);
  x.lineCap="round"; x.strokeStyle=c.p; x.lineWidth=lw; x.beginPath(); x.moveTo(px-0.12*s,Y(0.95)); x.lineTo(px-0.16*s+sw,Y(0.05)); x.moveTo(px+0.12*s,Y(0.95)); x.lineTo(px+0.16*s-sw,Y(0.05)); x.stroke();
  x.strokeStyle="#111"; x.lineWidth=lw*1.1; x.beginPath(); x.moveTo(px-0.16*s+sw,Y(0.05)); x.lineTo(px-0.16*s+sw,Y(0)); x.moveTo(px+0.16*s-sw,Y(0.05)); x.lineTo(px+0.16*s-sw,Y(0)); x.stroke();
  // arms
  x.strokeStyle=c.j; x.lineWidth=Math.max(1.5,0.17*s); x.beginPath();
  const pose=C?({spike:"up",point:"point",flex:"flex",spin:"out",moon:"down",swing:"swing"})[C.type]:m.up?"up":null;
  if(pose==="up"){ x.moveTo(px-0.33*s,Y(1.5)); x.lineTo(px-0.28*s,Y(2.35)); x.moveTo(px+0.33*s,Y(1.5)); x.lineTo(px+0.28*s,Y(2.35)); }
  else if(pose==="point"){ x.moveTo(px+0.33*s,Y(1.5)); x.lineTo(px+0.45*s,Y(2.5)); x.moveTo(px-0.33*s,Y(1.5)); x.lineTo(px-0.42*s,Y(1.05)); }
  else if(pose==="flex"){ x.moveTo(px-0.33*s,Y(1.5)); x.lineTo(px-0.62*s,Y(1.55)); x.lineTo(px-0.55*s,Y(2.0)); x.moveTo(px+0.33*s,Y(1.5)); x.lineTo(px+0.62*s,Y(1.55)); x.lineTo(px+0.55*s,Y(2.0)); }
  else if(pose==="out"){ x.moveTo(px-0.33*s,Y(1.5)); x.lineTo(px-0.75*s,Y(1.55)); x.moveTo(px+0.33*s,Y(1.5)); x.lineTo(px+0.75*s,Y(1.55)); }
  else if(pose==="swing"){ x.moveTo(px-0.33*s,Y(1.5)); x.lineTo(px-0.42*s,Y(1.05)); x.moveTo(px+0.33*s,Y(1.5)); x.lineTo(px+0.2*s,Y(2.4)); }
  else { x.moveTo(px-0.33*s,Y(1.5)); x.lineTo(px-0.4*s-sw*0.5,Y(1.0)); x.moveTo(px+0.33*s,Y(1.5)); x.lineTo(px+0.4*s+sw*0.5,Y(1.0)); }
  x.stroke(); x.lineCap="butt";
  if(C&&C.type==="swing"){ const a=C.t*14, cx2=px+0.2*s, cy2=Y(2.55); for(let k=0;k<12;k++){ const an=k/12*Math.PI*2+a, lx=cx2+Math.cos(an)*0.8*s, ly=cy2+Math.sin(an)*0.26*s; x.strokeStyle=k%2?"#FFE27A":"#D99A00"; x.lineWidth=Math.max(1,0.07*s); x.beginPath(); x.ellipse(lx,ly,0.08*s,0.05*s,an,0,7); x.stroke(); } }
  // torso with shoulder pads
  x.fillStyle=c.j; x.beginPath(); x.moveTo(px-0.42*s,Y(1.6)); x.lineTo(px+0.42*s,Y(1.6)); x.lineTo(px+0.27*s,Y(0.92)); x.lineTo(px-0.27*s,Y(0.92)); x.closePath(); x.fill();
  x.fillStyle=c.t; x.fillRect(px-0.42*s,Y(1.6),0.84*s,Math.max(1,0.06*s));
  if(s>13){ x.fillStyle=c.t; x.font=`800 ${0.42*s}px "Barlow Condensed",system-ui`; x.textAlign="center"; x.fillText(m.num,px,Y(1.12)); }
  // helmet
  const hy=Y(1.85), hr=0.21*s; x.fillStyle=c.h; x.beginPath(); x.arc(px,hy,hr,0,7); x.fill();
  if(m.face==="front"){ x.fillStyle="#d9b38c"; x.beginPath(); x.arc(px,hy+hr*0.2,hr*0.62,0,7); x.fill(); x.strokeStyle="#777"; x.lineWidth=Math.max(1,hr*0.16); x.beginPath(); x.moveTo(px-hr*0.7,hy+hr*0.25); x.lineTo(px+hr*0.7,hy+hr*0.25); x.moveTo(px-hr*0.6,hy+hr*0.6); x.lineTo(px+hr*0.6,hy+hr*0.6); x.stroke(); }
  else { x.fillStyle=c.t; x.fillRect(px-hr*0.12,hy-hr,hr*0.24,hr*1.7); }
  if(m.wr&&s<26){ x.fillStyle=m.rc||"#5EF2D6"; x.font='800 12px "Barlow Condensed",system-ui'; x.textAlign="center"; x.fillText("WR",px,Y(2.2)-4); }
}
function cgQBs(){ return Math.min(1.0,Math.max(0.6,Math.min(CG.w,CG.h*0.7)/450)); }
// every completion adds the next chain in this rotation, so each one looks different
const CG_CHAINS=[
  {name:"Gold Cuban",type:"cuban",c1:"#FFD54A",c2:"#B8860B",w:1},
  {name:"Silver Rope",type:"rope",c1:"#F4F6FA",c2:"#8C94A3",w:1},
  {name:"Iced-Out Tennis",type:"tennis",c1:"#FFFFFF",c2:"#8FDFFF",w:0.9},
  {name:"Rose Gold Figaro",type:"figaro",c1:"#F9B9A2",c2:"#B5654F",w:1},
  {name:"Big Gold Cuban",type:"cuban",c1:"#FFE27A",c2:"#C99400",w:1.55},
  {name:"Purple & Gold Beads",type:"beads",c1:"#FFC62F",c2:"#7C4FD0",w:1},
  {name:"Black Onyx Box",type:"box",c1:"#2b2b33",c2:"#FFD54A",w:1},
  {name:"Gold Rope",type:"rope",c1:"#FFE48A",c2:"#B8860B",w:1.2}
];
function cgMix(a,b,t){ const p=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)), A=p(a), B=p(b); return "rgb("+A.map((v,i)=>Math.round(v+(B[i]-v)*t)).join(",")+")"; }
function cgHeat(){ const st=CG.streak||0; return Math.max(st>=5?1:st>=3?0.7:st===2?0.3:0, CG.gdFire>performance.now()?0.7:0); }
function cgChain(x,st,yy,half,sag,heat,seed){
  const c1=heat?cgMix(st.c1,heat>=1?"#FFE08A":"#FF8A2A",heat*0.75):st.c1, c2=heat?cgMix(st.c2,"#E0400A",heat*0.7):st.c2, w=st.w*1.3;
  const P=t=>[-half+2*half*t, yy+Math.sin(Math.PI*t)*sag], ang=t=>{ const a=P(Math.max(0,t-0.01)), b=P(Math.min(1,t+0.01)); return Math.atan2(b[1]-a[1],b[0]-a[0]); };
  const len=2*half+sag*1.5;
  x.save(); if(heat){ x.shadowColor=`rgba(255,${heat>=1?150:100},20,${0.5+heat*0.5})`; x.shadowBlur=6+heat*14; }
  if(st.type==="cuban"){ const n=Math.round(len/(5.2*w)); for(let k=0;k<=n;k++){ const t=k/n, [lx,ly]=P(t); x.save(); x.translate(lx,ly); x.rotate(ang(t)+(k%2?Math.PI/2:0)); x.strokeStyle=k%2?c1:c2; x.lineWidth=2.6*w; x.beginPath(); x.ellipse(0,0,3.4*w,2.1*w,0,0,7); x.stroke(); x.restore(); } }
  else if(st.type==="rope"){ x.strokeStyle=c2; x.lineWidth=5*w; x.lineCap="round"; x.beginPath(); for(let k=0;k<=30;k++){ const [lx,ly]=P(k/30); k?x.lineTo(lx,ly):x.moveTo(lx,ly); } x.stroke();
    const n=Math.round(len/3.2); x.strokeStyle=c1; x.lineWidth=1.8*w; for(let k=0;k<=n;k++){ const t=k/n, [lx,ly]=P(t), a=ang(t)+0.9; x.beginPath(); x.moveTo(lx-Math.cos(a)*2.6*w,ly-Math.sin(a)*2.6*w); x.lineTo(lx+Math.cos(a)*2.6*w,ly+Math.sin(a)*2.6*w); x.stroke(); } }
  else if(st.type==="tennis"){ x.strokeStyle=c2; x.lineWidth=1.4; x.beginPath(); for(let k=0;k<=30;k++){ const [lx,ly]=P(k/30); k?x.lineTo(lx,ly):x.moveTo(lx,ly); } x.stroke();
    const n=Math.round(len/5.4), tw=performance.now()/180; for(let k=0;k<=n;k++){ const [lx,ly]=P(k/n); x.fillStyle=c1; x.beginPath(); x.arc(lx,ly,2.7*w,0,7); x.fill(); x.strokeStyle=c2; x.lineWidth=1; x.stroke();
      if((k+seed)%5===Math.floor(tw)%5){ x.strokeStyle="#fff"; x.lineWidth=1.2; x.beginPath(); x.moveTo(lx-5,ly); x.lineTo(lx+5,ly); x.moveTo(lx,ly-5); x.lineTo(lx,ly+5); x.stroke(); } } }
  else if(st.type==="figaro"){ const n=Math.round(len/4.6); for(let k=0;k<=n;k++){ const t=k/n, [lx,ly]=P(t), long=k%4===0; x.save(); x.translate(lx,ly); x.rotate(ang(t)); x.strokeStyle=k%2?c1:c2; x.lineWidth=2.2*w; x.beginPath(); x.ellipse(0,0,long?5.5:2.6,long?2.2:1.9,0,0,7); x.stroke(); x.restore(); } }
  else if(st.type==="beads"){ const n=Math.round(len/7); for(let k=0;k<=n;k++){ const [lx,ly]=P(k/n); x.fillStyle=k%2?c1:c2; x.beginPath(); x.arc(lx,ly,3.3*w,0,7); x.fill(); x.fillStyle="rgba(255,255,255,.45)"; x.beginPath(); x.arc(lx-1,ly-1.2,1.1,0,7); x.fill(); } }
  else { const n=Math.round(len/6.4); for(let k=0;k<=n;k++){ const t=k/n, [lx,ly]=P(t); x.save(); x.translate(lx,ly); x.rotate(ang(t)); x.fillStyle=c1; x.fillRect(-2.8,-2.8,5.6,5.6); x.strokeStyle=c2; x.lineWidth=1.3; x.strokeRect(-2.8,-2.8,5.6,5.6); x.restore(); } }
  // clasp at the back of the neck
  const [cx0,cy0]=P(0.5); x.fillStyle=c1; x.fillRect(cx0-3.5*w,cy0-2*w,7*w,4*w);
  x.restore();
}
function cgHand(){ const W=CG.w, H=CG.h, s=cgQBs(), pull=CG.drag?12:0; return [W/2+(122+pull*0.5)*s, H+8-(218-pull)*s]; }
// a tapered, shaded limb (shoulder→elbow, elbow→wrist) with a little muscle bulge
function cgLimb(x,ax,ay,bx,by,wa,wb,c0,c1,c2,bulge){
  const dx=bx-ax, dy=by-ay, L=Math.hypot(dx,dy)||1, nx=-dy/L, ny=dx/L, mx=(ax+bx)/2, my=(ay+by)/2, wm=Math.max(wa,wb)*(bulge||1.1)/2;
  const g=x.createLinearGradient(mx-nx*wm,my-ny*wm,mx+nx*wm,my+ny*wm); g.addColorStop(0,c2); g.addColorStop(0.35,c0); g.addColorStop(0.55,c1); g.addColorStop(1,c2); x.fillStyle=g;
  const a0=Math.atan2(ny,nx);
  x.beginPath(); x.moveTo(ax+nx*wa/2,ay+ny*wa/2); x.quadraticCurveTo(mx+nx*wm,my+ny*wm,bx+nx*wb/2,by+ny*wb/2);
  x.arc(bx,by,wb/2,a0,a0+Math.PI,true); x.quadraticCurveTo(mx-nx*wm,my-ny*wm,ax-nx*wa/2,ay-ny*wa/2); x.arc(ax,ay,wa/2,a0+Math.PI,a0,true); x.closePath(); x.fill(); }
// our QB from just above and behind: helmet, thick neck under the chain stack, pads tapering to the waist, real arms
function cgQB(x,W,H){
  const s=cgQBs(), n=CG.chains, cx=W/2, base=H+8, now=performance.now(), heat=cgHeat();
  const flash=CG.flash&&now-CG.flash.t<700?1-(now-CG.flash.t)/700:0;
  const since=CG.thrown?(now-CG.thrown)/1000:9, follow=CG.phase!=="route"&&since<1.0, pull=CG.drag?12:0;
  const SK="#c98d66", SKD="#9a603f", SKL="#e2ad86", PU="#4F2683", PUD="#2c1252", PUL="#6a3cb0";
  const flex=CG.phase==="result"&&CG.res==="catch"&&(CG.streak||0)>=3&&since>0.7, GL=cgGlove(), HC=GL.col||SK, HD=GL.dk||SKD;
  x.save(); x.translate(cx,base); x.scale(s,s);
  const lg=(x0,y0,x1,y1,stops)=>{ const g=x.createLinearGradient(x0,y0,x1,y1); stops.forEach(([o,c])=>g.addColorStop(o,c)); return g; };
  // off arm: out to the side for balance (mostly hidden behind the body)
  if(!flex){ const S=[-112,-104], E=follow?[-146,-96]:[-150,-122], Hd=follow?[-118,-104]:[-128,-150];
    cgLimb(x,E[0],E[1],Hd[0],Hd[1],25,18,SK,SKL,SKD,1.1); x.fillStyle=HC; x.beginPath(); x.ellipse(Hd[0],Hd[1],10,11,0,0,7); x.fill();
    cgLimb(x,S[0],S[1],E[0],E[1],38,27,SK,SKL,SKD,1.18); }
  // torso: shoulder pads tapering into the lats and waist
  x.fillStyle=lg(-140,0,140,0,[[0,PUD],[0.18,PU],[0.42,PUL],[0.6,PU],[0.85,PU],[1,PUD]]);
  x.beginPath(); x.moveTo(-82,12); x.bezierCurveTo(-88,-10,-92,-34,-100,-56); x.bezierCurveTo(-112,-74,-132,-82,-138,-98);
  x.bezierCurveTo(-144,-118,-128,-134,-102,-136); x.bezierCurveTo(-82,-138,-62,-132,-44,-124); x.quadraticCurveTo(0,-110,44,-124);
  x.bezierCurveTo(62,-132,82,-138,102,-136); x.bezierCurveTo(128,-134,144,-118,138,-98); x.bezierCurveTo(132,-82,112,-74,100,-56); x.bezierCurveTo(92,-34,88,-10,82,12); x.closePath(); x.fill();
  // pad domes, seams, shoulder-blade folds, spine
  for(const sd of [-1,1]){ const g=x.createRadialGradient(sd*100-sd*10,-128,2,sd*100,-118,48); g.addColorStop(0,"rgba(255,255,255,.22)"); g.addColorStop(0.5,"rgba(255,255,255,.06)"); g.addColorStop(1,"rgba(255,255,255,0)"); x.fillStyle=g; x.beginPath(); x.ellipse(sd*100,-114,46,26,sd*-0.12,0,7); x.fill();
    x.strokeStyle="rgba(15,5,35,.35)"; x.lineWidth=2.5; x.beginPath(); x.moveTo(sd*138,-98); x.bezierCurveTo(sd*118,-90,sd*84,-94,sd*58,-104); x.stroke();
    x.strokeStyle="rgba(15,5,35,.22)"; x.lineWidth=2; x.beginPath(); x.moveTo(sd*30,-92); x.bezierCurveTo(sd*52,-80,sd*66,-62,sd*62,-40); x.stroke();
    x.fillStyle="#fff"; x.save(); x.translate(sd*126,-106); x.rotate(sd*0.55); x.fillRect(-9,-2.5,18,5); x.fillStyle="#FFC62F"; x.fillRect(-9,3.5,18,4); x.restore(); }
  x.strokeStyle="rgba(15,5,35,.25)"; x.lineWidth=2.5; x.beginPath(); x.moveTo(0,-100); x.bezierCurveTo(-3,-66,3,-30,0,10); x.stroke();
  x.font='800 62px "Barlow Condensed",system-ui'; x.textAlign="center"; x.lineJoin="round"; x.strokeStyle="#FFC62F"; x.lineWidth=7; x.strokeText("8",0,-26); x.fillStyle="#fff"; x.fillText("8",0,-26);
  // thick neck + traps
  x.fillStyle=lg(-46,0,46,0,[[0,SKD],[0.3,SK],[0.5,SKL],[0.7,SK],[1,SKD]]);
  x.beginPath(); x.moveTo(-46,-121); x.quadraticCurveTo(-32,-128,-30,-142); x.lineTo(-28,-160); x.lineTo(28,-160); x.lineTo(30,-142); x.quadraticCurveTo(32,-128,46,-121); x.quadraticCurveTo(0,-108,-46,-121); x.fill();
  x.strokeStyle="rgba(110,60,35,.35)"; x.lineWidth=2; x.beginPath(); x.moveTo(-6,-152); x.quadraticCurveTo(-8,-134,-4,-118); x.moveTo(6,-152); x.quadraticCurveTo(8,-134,4,-118); x.stroke();
  // collar trim
  x.strokeStyle="#FFC62F"; x.lineWidth=5; x.beginPath(); x.moveTo(-44,-124); x.quadraticCurveTo(0,-109,44,-124); x.stroke(); x.strokeStyle="#fff"; x.lineWidth=2; x.beginPath(); x.moveTo(-44,-120); x.quadraticCurveTo(0,-105,44,-120); x.stroke();
  if(heat){ const g=x.createRadialGradient(0,-128,4,0,-128,90+heat*40); g.addColorStop(0,`rgba(255,120,20,${0.25+heat*0.35})`); g.addColorStop(1,"rgba(255,80,0,0)"); x.fillStyle=g; x.beginPath(); x.arc(0,-128,130,0,7); x.fill(); }
  // chain stack: first four climb the neck, the rest drape out over the pads
  const shown=Math.min(n,16);
  for(let i=shown-1;i>=0;i--){ const st=CG_CHAINS[i%CG_CHAINS.length], up=i<4;
    const yy=up?-120-i*7.5:-118+(i-4)*2, half=up?33+i*0.8:46+(i-4)*9, sag=up?4:13+(i-4)*7; cgChain(x,st,yy,half,sag,heat,i); }
  // follow-through arm reaches out in front, so it goes behind the helmet
  if(follow&&!flex){ cgLimb(x,96,-176,62,-238,24,17,SK,SKL,SKD,1.1); x.fillStyle=HC; x.beginPath(); x.ellipse(58,-248,9,11,-0.4,0,7); x.fill(); cgLimb(x,114,-108,96,-176,38,27,SK,SKL,SKD,1.18); }
  // helmet from behind: glossy shell, center stripe, ear holes, facemask edges, bumper
  { const hy=-190;
    x.strokeStyle="#9aa0aa"; x.lineWidth=4; x.lineCap="round"; for(const sd of [-1,1]){ x.beginPath(); x.moveTo(sd*40,hy+8); x.lineTo(sd*50,hy+14); x.lineTo(sd*46,hy+30); x.stroke(); }
    x.fillStyle="#111"; x.beginPath(); x.ellipse(0,hy+40,34,10,0,0,7); x.fill();
    const g=x.createRadialGradient(-14,hy-22,4,0,hy,52); g.addColorStop(0,"#9a72e0"); g.addColorStop(0.35,PUL); g.addColorStop(0.75,PU); g.addColorStop(1,PUD); x.fillStyle=g;
    x.beginPath(); x.moveTo(-44,hy+20); x.bezierCurveTo(-50,hy-20,-34,hy-48,0,hy-48); x.bezierCurveTo(34,hy-48,50,hy-20,44,hy+20); x.bezierCurveTo(38,hy+42,-38,hy+42,-44,hy+20); x.closePath(); x.fill();
    x.save(); x.clip(); x.fillStyle="#fff"; x.beginPath(); x.moveTo(-9,hy-50); x.lineTo(9,hy-50); x.lineTo(12,hy+44); x.lineTo(-12,hy+44); x.fill(); x.fillStyle="#FFC62F"; x.beginPath(); x.moveTo(-5.5,hy-50); x.lineTo(5.5,hy-50); x.lineTo(7.5,hy+44); x.lineTo(-7.5,hy+44); x.fill();
    const sh=x.createLinearGradient(0,hy-48,0,hy+40); sh.addColorStop(0,"rgba(255,255,255,0)"); sh.addColorStop(0.75,"rgba(0,0,0,0)"); sh.addColorStop(1,"rgba(0,0,0,.35)"); x.fillStyle=sh; x.fillRect(-60,hy-60,120,110);
    x.fillStyle="rgba(255,255,255,.35)"; x.beginPath(); x.ellipse(-20,hy-26,9,16,-0.5,0,7); x.fill(); x.restore();
    for(const sd of [-1,1]){ x.fillStyle="#1b0b33"; x.beginPath(); x.ellipse(sd*39,hy+4,4,7,0,0,7); x.fill(); x.strokeStyle="#ddd"; x.lineWidth=2; x.beginPath(); x.moveTo(sd*40,hy+12); x.quadraticCurveTo(sd*36,hy+34,sd*26,hy+42); x.stroke(); }
    x.fillStyle="#222"; x.beginPath(); x.roundRect?x.roundRect(-16,hy+30,32,9,4):x.rect(-16,hy+30,32,9); x.fill(); x.lineCap="butt"; }
  // throwing arm cocked by the helmet, ball in hand
  if(!follow){ const S=[114,-108], E=[150+pull*0.5,-136+pull*0.4], Wr=[134+pull*0.5,-196+pull], B=[122+pull*0.5,-218+pull];
    cgLimb(x,E[0],E[1],Wr[0],Wr[1],26,17,SK,SKL,SKD,1.12);
    cgLimb(x,S[0],S[1],E[0],E[1],40,28,SK,SKL,SKD,1.2);
    x.fillStyle=PU; x.beginPath(); x.ellipse(118,-112,24,20,0.5,0,7); x.fill(); x.fillStyle="rgba(255,255,255,.12)"; x.beginPath(); x.ellipse(114,-118,14,9,0.5,0,7); x.fill();
    x.save(); x.translate(Wr[0],Wr[1]); x.rotate(Math.atan2(Wr[1]-E[1],Wr[0]-E[0])+Math.PI/2); x.fillStyle="#f2f2f2"; x.fillRect(-10,-2,20,9); x.restore();
    if(CG.phase==="route"){ x.save(); x.translate(B[0],B[1]); x.rotate(-1.15); cgFootball(x,22,13.5,cgSkin(),now/1000); x.restore(); }
    const wx=Wr[0], wy=Wr[1]; x.fillStyle=HC; x.beginPath(); x.ellipse(wx-3,wy-8,9,11,-0.2,0,7); x.fill();
    if(CG.phase!=="route"){ x.fillStyle=HC; x.beginPath(); x.ellipse(wx-4,wy-16,10,9,-0.2,0,7); x.fill(); x.strokeStyle=HD; x.lineWidth=1; for(let f=0;f<3;f++){ x.beginPath(); x.moveTo(wx-11+f*5,wy-22); x.lineTo(wx-10+f*5,wy-13); x.stroke(); } }
    else { x.lineCap="round"; x.strokeStyle=HC; x.lineWidth=5.5; for(let f=0;f<4;f++){ x.beginPath(); x.moveTo(wx-7+f*3.4,wy-14); x.quadraticCurveTo(wx-13+f*3,wy-24-f, wx-19+f*4.5,wy-28-f*2); x.stroke(); }
    x.strokeStyle=HD; x.lineWidth=1; for(let f=1;f<4;f++){ x.beginPath(); x.moveTo(wx-8.7+f*3.4,wy-14); x.quadraticCurveTo(wx-14.7+f*3,wy-24-f, wx-20.7+f*4.5,wy-28-f*2); x.stroke(); } x.lineCap="butt"; } }
  else if(!flex){ x.fillStyle=PU; x.beginPath(); x.ellipse(116,-112,24,20,-0.4,0,7); x.fill(); }
  // chain flex: both arms up, biceps out, fists by the helmet
  if(flex){ const bob=Math.sin(now/120)*3; for(const sd of [-1,1]){ const S=[sd*112,-106], E=[sd*162,-128+bob], Hd=[sd*136,-196+bob];
      cgLimb(x,E[0],E[1],Hd[0],Hd[1],26,19,SK,SKL,SKD,1.15); cgLimb(x,S[0],S[1],E[0],E[1],42,30,SK,SKL,SKD,1.3);
      x.fillStyle=SKL; x.beginPath(); x.ellipse(sd*140,-134+bob,13,9,sd*-0.3,0,7); x.globalAlpha=0.5; x.fill(); x.globalAlpha=1;
      x.fillStyle=PU; x.beginPath(); x.ellipse(sd*118,-112,24,20,sd*0.5,0,7); x.fill(); x.fillStyle=HC; x.beginPath(); x.arc(Hd[0],Hd[1]-6,12,0,7); x.fill(); x.strokeStyle=HD; x.lineWidth=1.2; x.beginPath(); x.arc(Hd[0],Hd[1]-6,12,Math.PI*0.9,Math.PI*1.6); x.stroke(); } }
  // fire: flames rising off the chains
  const last=CG.fxLast||now, dt=Math.min(0.05,(now-last)/1000); CG.fxLast=now; CG.fx=CG.fx||[];
  if(heat>=0.7){ const rate=heat>=1?46:26; let k=rate*dt+(Math.random()<(rate*dt)%1?1:0); while(k-->=1) CG.fx.push({x:(Math.random()-0.5)*(80+Math.min(n,16)*8),y:-112-Math.random()*34,vx:(Math.random()-0.5)*14,vy:-(40+Math.random()*50),life:0,max:0.5+Math.random()*0.5,r:5+Math.random()*7}); }
  x.globalCompositeOperation="lighter";
  CG.fx=CG.fx.filter(p=>(p.life+=dt)<p.max); CG.fx.forEach(p=>{ p.x+=p.vx*dt; p.y+=p.vy*dt; const f=p.life/p.max, r=p.r*(1-f*0.6);
    x.fillStyle=f<0.3?`rgba(255,220,110,${0.75-f})`:f<0.65?`rgba(255,130,25,${0.75-f})`:`rgba(210,45,10,${0.8-f})`;
    x.beginPath(); x.moveTo(p.x,p.y-r*2.2); x.quadraticCurveTo(p.x+r*0.9,p.y-r*0.4,p.x+r*0.7,p.y+r*0.3); x.arc(p.x,p.y+r*0.3,r*0.7,0,Math.PI); x.quadraticCurveTo(p.x-r*0.9,p.y-r*0.4,p.x,p.y-r*2.2); x.fill(); });
  x.globalCompositeOperation="source-over";
  if(n){ x.fillStyle=heat>=0.7?"rgba(120,30,0,.85)":"rgba(11,18,32,.8)"; x.beginPath(); x.roundRect?x.roundRect(-214,-70,70,32,16):x.rect(-214,-70,70,32); x.fill(); x.fillStyle=heat>=0.7?"#FFB347":"#FFD54A"; x.font='800 21px "Barlow Condensed",system-ui'; x.textAlign="center"; x.fillText("⛓ "+n,-179,-47); }
  if(flash){ x.globalAlpha=flash; x.fillStyle="#FFF3B0"; for(let k=0;k<10;k++){ const a=k/10*Math.PI*2+now/260; x.beginPath(); x.arc(Math.cos(a)*74,-136+Math.sin(a)*28,4,0,7); x.fill(); } x.globalAlpha=1; }
  x.restore();
}
/* ---------- keyboard (the home card and loader live in chaingame_stub.js) ---------- */
document.addEventListener("click",e=>{ if(e.target.closest("[data-chaingame]")&&!e.target.closest("[data-cgshop]")) openChainGame(); });
document.addEventListener("keydown",e=>{ if(CG.on&&e.key==="Escape") closeChainGame(); if(CG.on&&CG.phase==="over"&&(e.key==="Enter"||e.key===" ")){ e.preventDefault(); cgStart(); } });
