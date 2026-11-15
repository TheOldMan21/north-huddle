/* ===================== North Huddle: Chain Gang (QB throwing game) ===================== */
// You're the QB, seen from just above and behind his head. Your receiver runs a route; swipe up to throw:
// the swipe's direction aims the ball and its length sets how deep it goes. Lead your receiver.
// Every completion adds a gold chain around your QB's neck, and deeper throws earn more Huddle Bucks.
// 3 strikes (incomplete, pick, or sack) and the drive is over.
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
function cgBest(){ try{ return JSON.parse(localStorage.getItem("nh_cgbest")||"{}"); }catch(e){ return {}; } }
const CG_HELP="Swipe up toward your receiver. Green ring = open, yellow = contested, red = covered. Longer swipe = deeper.";
function openChainGame(){
  let ov=$("cgGame");
  if(!ov){
    ov=document.createElement("div"); ov.id="cgGame"; ov.setAttribute("role","dialog"); ov.setAttribute("aria-label","Kirko Chainz");
    ov.innerHTML=`<div class="fg-top cg-top"><div class="fg-stat"><span class="label">Chains</span><b id="cgChains" class="num">0</b></div><div class="fg-stat"><span class="label">Huddle Bucks</span><b id="cgBucks" class="num">$0</b></div><div class="fg-stat"><span class="label">Strikes</span><b id="cgStrikes" class="num"></b></div><button class="cg-snd" data-cgshop="1" aria-label="Ball Shop">🛒</button><button class="cg-snd" id="cgSnd" aria-label="Announcer sound" aria-pressed="true">🔊</button><button class="x" id="cgClose" aria-label="Close game">×</button></div>
      <div class="fg-stage"><canvas id="cgCanvas"></canvas><div class="fg-msg" id="cgMsg"></div><div class="cg-shop" id="cgShop" hidden></div></div>
      <div class="fg-help" id="cgHelp">${CG_HELP}</div>`;
    document.body.appendChild(ov);
    $("cgClose").addEventListener("click",closeChainGame);
    $("cgSnd").addEventListener("click",()=>{ CG.mute=!CG.mute; try{ localStorage.setItem("nh_cgmute",CG.mute?"1":""); }catch(e){} cgSndBtn(); if(CG.mute) try{ speechSynthesis.cancel(); }catch(e){} else cgSay("Kirko Chainz is in the building!"); });
    const cv=$("cgCanvas"), pt=e=>{ const r=cv.getBoundingClientRect(); return [e.clientX-r.left,e.clientY-r.top,performance.now()]; };
    cv.addEventListener("pointerdown",e=>{ e.preventDefault(); if(CG.phase!=="route") return; try{ cv.setPointerCapture(e.pointerId); }catch(err){} const q=pt(e); CG.drag={x0:q[0],y0:q[1],x:q[0],y:q[1],hist:[q]}; });
    cv.addEventListener("pointermove",e=>{ if(!CG.drag) return; e.preventDefault(); const q=pt(e); Object.assign(CG.drag,{x:q[0],y:q[1]}); CG.drag.hist.push(q); if(CG.drag.hist.length>8) CG.drag.hist.shift(); });
    const up=e=>{ if(!CG.drag) return; const q=pt(e); Object.assign(CG.drag,{x:q[0],y:q[1]}); CG.drag.hist.push(q); cgRelease(); };
    cv.addEventListener("pointerup",up); cv.addEventListener("pointercancel",()=>{ CG.drag=null; });
    ov.addEventListener("click",e=>{ if(e.target.closest("[data-cgagain]")) cgStart(); });
  }
  try{ CG.mute=localStorage.getItem("nh_cgmute")==="1"; }catch(e){} cgSndBtn(); cgVoiceWarm();
  ov.hidden=false; document.body.style.overflow="hidden"; CG.on=true; CG.paused=false; if($("cgShop")) $("cgShop").hidden=true; cgResize(); cgStart(); cgWPull();
  window.addEventListener("resize",cgResize);
}
function closeChainGame(){ cgShopClose(); try{ speechSynthesis.cancel(); }catch(e){} CG.on=false; CG.drag=null; cancelAnimationFrame(CG.raf); const ov=$("cgGame"); if(ov) ov.hidden=true; document.body.style.overflow=""; window.removeEventListener("resize",cgResize); }
function cgResize(){ const c=$("cgCanvas"); if(!c) return; const st=c.parentElement.getBoundingClientRect(), dpr=Math.min(2,window.devicePixelRatio||1); c.width=st.width*dpr; c.height=st.height*dpr; c.style.width=st.width+"px"; c.style.height=st.height+"px"; CG.w=st.width; CG.h=st.height; CG.dpr=dpr; cgCam(); }
function cgStart(){ Object.assign(CG,{chains:0, bucks:0, strikes:0, comps:0, longest:0, phase:"set", t:0, ball:null, wrs:null, cbs:null, sf:null, flash:null, drag:null, thrown:0, streak:0, post:null, fx:[]}); $("cgMsg").innerHTML=""; $("cgHelp").textContent=CG_HELP; cgHud(); cgSnap(); cancelAnimationFrame(CG.raf); CG.last=performance.now(); CG.raf=requestAnimationFrame(cgLoop); }
function cgHud(){ $("cgChains").textContent=CG.chains; $("cgBucks").textContent="$"+CG.bucks.toLocaleString(); $("cgStrikes").textContent="✕".repeat(CG.strikes)+"·".repeat(Math.max(0,3-CG.strikes)); }

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
  CG.phase="air"; CG.thrown=performance.now();
}
// three receivers: one wide on each side plus a slot, each with his own route and cornerback; one deep safety
function cgSnap(){
  const names=Object.keys(CG_ROUTES).sort(()=>Math.random()-0.5).slice(0,3);
  const side=Math.random()<0.5?-1:1, starts=[-side*(7+Math.random()*2), side*(7+Math.random()*2), side*(3.4+Math.random()*1.2)];
  const lvl=CG.comps;
  CG.wrs=starts.map((sx,i)=>{ const sg=Math.sign(sx)||1, pts=CG_ROUTES[names[i]].map(([x,y])=>[sx+x*-sg, y]);
    // keep the whole route on screen: squeeze it sideways if any point (or where he keeps running after) would leave the view
    const last=pts[pts.length-1], prev=pts[pts.length-2], dl=Math.hypot(last[0]-prev[0],last[1]-prev[1])||1, ext=[last[0]+(last[0]-prev[0])/dl*6, last[1]+(last[1]-prev[1])/dl*6];
    let k=1; [...pts,ext].forEach(([x,y])=>{ if(Math.abs(x)>0.01) k=Math.min(k,cgXmax(y)/Math.abs(x)); }); pts.forEach(p=>{ p[0]*=k; });
    return {i, pts, seg:0, x:pts[0][0], y:0, speed:7.0+Math.random()*0.9, route:names[i], track:false, num:[18,11,84][i]}; });
  CG.cbs=CG.wrs.map((w,i)=>({i, x:w.x-Math.sign(w.x||1)*1.2, y:(i===2?4:5)+Math.random()*2, speed:6.3+Math.min(1.6,lvl*0.08), react:Math.max(0.12,0.45-lvl*0.02), lag:[], track:false, num:[24,21,26][i]}));
  CG.sf={x:side*2, y:17+Math.random()*4, speed:5.4+Math.min(1.2,lvl*0.06), track:false, num:31};
  CG.phase="route"; CG.t=0; CG.ball=null; CG.drag=null; CG.post=null; CG.pocket=4.4-Math.min(1.4,lvl*0.05);
}
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
  S.wrs.forEach(w=>{
    if(w.track) cgMove(w,land[0],land[1],w.speed*1.12,dt);
    else { const tgt=w.pts[w.seg+1]; if(tgt){ if(cgMove(w,tgt[0],tgt[1],w.speed,dt)) w.seg++; } else {
        const a=w.pts[w.pts.length-2], z=w.pts[w.pts.length-1], dx=z[0]-a[0], dy=z[1]-a[1], d=Math.hypot(dx,dy)||1; w.x+=dx/d*w.speed*dt*0.85; w.y+=dy/d*w.speed*dt*0.85; } }
    const xm=cgXmax(w.y); w.x=Math.max(-xm,Math.min(xm,w.x)); });
  S.cbs.forEach(c=>{ const w=S.wrs[c.i];
    if(b&&!c.track&&rem<0.7&&Math.hypot(c.x-land[0],c.y-land[1])<=3) c.track=true;
    if(c.track) cgMove(c,land[0],land[1],c.speed,dt);
    else { c.lag.push([S.t,w.x,w.y]); while(c.lag.length&&c.lag[0][0]<S.t-c.react) c.lag.shift(); const aim=c.lag[0]||[0,w.x,w.y]; cgMove(c,aim[1]+(c.x<w.x?-0.6:0.6),aim[2]+0.4,c.speed,dt); } });
  if(b&&!f.track&&rem<1.2&&Math.hypot(f.x-land[0],f.y-land[1])<=6) f.track=true;
  if(f.track) cgMove(f,land[0],land[1],f.speed*1.05,dt);
  else { const deep=S.wrs.reduce((m,w)=>w.y>m.y?w:m,S.wrs[0]); const t2=deep.y>f.y-6?[deep.x*0.8,deep.y+3]:[f.x*0.97,f.y]; cgMove(f,t2[0],t2[1],f.speed*0.6,dt); }
  if(b) b.t+=dt;
}
// what happens when the ball comes down
function cgJudge(S){
  const b=S.ball, dist=m=>Math.hypot(m.x-b.tx,m.y-b.ty);
  const wr=S.wrs.reduce((m,w)=>dist(w)<dist(m)?w:m,S.wrs[0]), defs=[...S.cbs,S.sf], who=defs.reduce((m,d)=>dist(d)<dist(m)?d:m,defs[0]);
  const dw=dist(wr), dd=dist(who), wrIn=dw<=2.0, defIn=dd<=1.4;
  if(wrIn&&!defIn) return {kind:dw>1.1?"dive":"open",dw,dd,wr,who};
  if(wrIn&&defIn) return {kind:"contested",dw,dd,wr,who,p:Math.max(0.2,Math.min(0.8,0.55+(dd-dw)*0.35))};
  if(defIn) return {kind:"covered",dw,dd,wr,who};
  return {kind:"miss",dw,dd,wr,who};
}
function cgClone(){ return {t:CG.t, wrs:CG.wrs.map(w=>({...w})), cbs:CG.cbs.map(c=>({...c,lag:c.lag.slice()})), sf:{...CG.sf}, ball:null}; }
function cgPredict(a){ const S=cgClone(), dist=Math.hypot(a.tx-0.5,a.ty-CG_QBY); S.ball={tx:a.tx,ty:a.ty,t:0,T:cgFlight(dist)}; let n=0; while(S.ball.t<S.ball.T&&n++<400) cgStep(S,1/60); return cgJudge(S); }
function cgFlight(dist){ return 0.3+dist/23; }
function cgLoop(now){
  if(!CG.on) return;
  const dt=Math.min(0.05,(now-CG.last)/1000); CG.last=now;
  if(CG.paused){ CG.raf=requestAnimationFrame(cgLoop); return; }
  if(CG.phase==="route"||CG.phase==="air"){
    cgStep(CG,dt);
    if(CG.phase==="route"&&CG.t>CG.pocket){ CG.drag=null; cgResult("sack"); }
    else if(CG.phase==="air"&&CG.ball.t>=CG.ball.T) cgLand();
  } else if(CG.phase==="result") cgPost(dt);
  cgDraw(); CG.raf=requestAnimationFrame(cgLoop);
}
function cgLand(){
  const j=cgJudge(CG), b=CG.ball, yds=Math.max(1,Math.round(b.ty));
  if(j.kind==="open"||j.kind==="dive") return cgResult("catch",yds,j.kind==="dive"?"DIVING CATCH!":"COMPLETE!",j.wr);
  if(j.kind==="contested") return Math.random()<j.p?cgResult("catch",yds,"CONTESTED CATCH!",j.wr):cgResult(Math.random()<0.3?"pick":"broken",0,"",j.who);
  if(j.kind==="covered") return cgResult(j.dd<0.8&&Math.random()<0.55?"pick":"broken",0,"",j.who);
  cgResult("incomplete");
}
// after the ball arrives: the catch and run, the deflection, the pick, or the ball bouncing away
function cgPost(dt){
  const P=CG.post; if(!P) return; P.t+=dt; const b=P.ball;
  if(P.carrier){ const m=P.carrier; m.y+=P.dir*m.speed*0.8*dt; b.x=m.x+0.3; b.y=m.y; b.z=1.2; return; }
  b.vz-=22*dt; b.x+=b.vx*dt; b.y+=b.vy*dt; b.z+=b.vz*dt;
  if(b.z<0.15){ b.z=0.15; b.vz=Math.abs(b.vz)*0.45; b.vx*=0.6; b.vy*=0.6; b.bounce=(b.bounce||0)+1; }
}
function cgMult(){ return CG.streak>=5?2:CG.streak>=3?1.5:1; }
function cgResult(kind,yds,label,who){
  CG.phase="result"; CG.res=kind; let html; const b=CG.ball;
  const at=b?{x:b.tx,y:b.ty,z:1.2}:null, dir=b?[b.tx-b.x0,b.ty-b.y0]:[0,1], dl=Math.hypot(dir[0],dir[1])||1;
  if(kind==="catch"){
    CG.comps++; CG.chains++; CG.streak=(CG.streak||0)+1; const mult=cgMult();
    const bucks=Math.round((yds*5+Math.max(0,yds-15)*10+Math.max(0,yds-30)*15)*mult); CG.bucks+=bucks; CG.longest=Math.max(CG.longest,yds); cgW().bank+=bucks; cgWSave(false);
    const fire=CG.streak>=3?` · 🔥 ×${mult}`:CG.streak===2?" · heating up…":"";
    html=`<b>${label||"COMPLETE!"}</b><span>${yds} yards · +$${bucks}${fire}</span><span>New chain: ${CG_CHAINS[(CG.chains-1)%CG_CHAINS.length].name} ⛓️</span>`; cgSound(true); cgCall(label,yds);
    CG.flash={t:performance.now()}; CG.post={t:0,carrier:who,dir:1,ball:{...at}};
  } else {
    const hadFire=(CG.streak||0)>=3; CG.streak=0; CG.strikes++; cgSound(false); cgCallMiss(kind,hadFire);
    html=`<b class="miss">${kind==="pick"?"PICKED OFF!":kind==="broken"?"BROKEN UP!":kind==="sack"?"SACKED!":"INCOMPLETE"}</b><span>${kind==="sack"?"Get it out faster!":"Strike "+CG.strikes+" of 3"}${hadFire?" · fire's out 🧯":""}</span>`;
    if(kind==="pick") CG.post={t:0,carrier:who,dir:-1,ball:{...at}};
    else if(kind==="broken") CG.post={t:0,ball:{...at,vx:(Math.random()-0.5)*8,vy:-2-Math.random()*2,vz:6}};
    else if(kind==="incomplete") CG.post={t:0,ball:{...at,z:1.0,vx:dir[0]/dl*9,vy:dir[1]/dl*9,vz:-2}};
    else CG.post=null;
  }
  cgHud(); $("cgMsg").innerHTML=`<div class="fg-pop">${html}</div>`;
  setTimeout(()=>{ if(!CG.on) return; $("cgMsg").innerHTML=""; if(CG.strikes>=3) cgOver(); else cgSnap(); },1500);
}
/* ---------- announcer: the device's own voice, pitched up and fast, over a crowd roar ---------- */
const CG_PICK=a=>a[(Math.random()*a.length)|0];
function cgSndBtn(){ const b=$("cgSnd"); if(b){ b.textContent=CG.mute?"🔇":"🔊"; b.setAttribute("aria-pressed",String(!CG.mute)); } }
function cgVoiceWarm(){ try{ speechSynthesis.getVoices(); speechSynthesis.onvoiceschanged=()=>{ CG.voice=null; }; }catch(e){} }
function cgVoice(){ if(CG.voice) return CG.voice; try{ const vs=speechSynthesis.getVoices().filter(v=>/^en[-_]US/i.test(v.lang)||/^en/i.test(v.lang)); if(!vs.length) return null;
  const rank=v=>(/male|guy|david|alex|daniel|aaron|fred|google us english|en-us-x-iom|en-us-x-tpd|en-us-x-iol/i.test(v.name)?4:0)+(/natural|enhanced|premium|neural|online/i.test(v.name)?3:0)+(/^en[-_]US/i.test(v.lang)?2:0)+(/female|samantha|victoria|zira/i.test(v.name)?-2:0);
  CG.voice=vs.sort((a,b)=>rank(b)-rank(a))[0]; }catch(e){} return CG.voice; }
function cgSay(text,hype){ if(CG.mute) return; try{ if(!("speechSynthesis" in window)) return; speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(text), v=cgVoice(); if(v) u.voice=v; u.lang=v?v.lang:"en-US"; u.rate=hype?1.22:1.12; u.pitch=hype?1.25:1.08; u.volume=1; speechSynthesis.speak(u); }catch(e){}
  cgRoar(hype?1:0.6); }
function cgRoar(amt){ if(CG.mute) return; try{ const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return; const ctx=CG.ctx||(CG.ctx=new AC()); if(ctx.state==="suspended") ctx.resume();
  const len=ctx.sampleRate*2.2, buf=ctx.createBuffer(1,len,ctx.sampleRate), d=buf.getChannelData(0); let last=0; for(let i=0;i<len;i++){ last=last*0.97+(Math.random()*2-1)*0.03; d[i]=last*6+(Math.random()*2-1)*0.08; }
  const src=ctx.createBufferSource(), bp=ctx.createBiquadFilter(), g=ctx.createGain(), t=ctx.currentTime; src.buffer=buf; bp.type="bandpass"; bp.frequency.value=900; bp.Q.value=0.6;
  g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.22*amt,t+0.35); g.gain.exponentialRampToValueAtTime(0.0001,t+2.1); src.connect(bp); bp.connect(g); g.connect(ctx.destination); src.start(t); src.stop(t+2.2); }catch(e){} }
function cgCall(label,yds){
  const st=CG.streak, chain=CG_CHAINS[(CG.chains-1)%CG_CHAINS.length].name;
  let line;
  if(st===3) line="His chainz are on fire!!!";
  else if(st===5) line=CG_PICK(["Somebody call the fire department! Kirko Chainz is blazing!","He is BLAZING! Those chains are white hot!"]);
  else if(st>5) line=CG_PICK(["Still on fire! Kirko cannot miss!","Another one! The chains are melting!","Unstoppable! Kirko Chainz is cooking!","You cannot cool him down!"]);
  else if(st===2) line=CG_PICK(["Kirko is heating up!","Back to back! He's warming up!"]);
  else if(/DIVING/.test(label||"")) line=CG_PICK(["Oh what a diving grab!","He lays out and HAULS it in!"]);
  else if(/CONTESTED/.test(label||"")) line=CG_PICK(["He wins the jump ball!","Right in traffic! What a catch!"]);
  else if(yds>=35) line=CG_PICK(["He went deep and he got it!","Bombs away! Kirko lets it fly!","What a strike downfield!"]);
  else line=CG_PICK(["Complete! Another chain for Kirko!","Kirko dials it up! That's the "+chain+"!","Right on the money!","Kirko Chainz delivers!","Money! Pay the man!"]);
  cgSay(line,st>=3||yds>=35);
}
function cgCallMiss(kind,hadFire){ if(hadFire) return cgSay(CG_PICK(["And the fire is out!","Ice cold! The fire's out!"]),false);
  if(kind==="pick") cgSay(CG_PICK(["Oh no! Picked off!","Intercepted!"]),false); else if(kind==="sack") cgSay("Down goes Kirko!",false); }
function cgSound(good){ try{ const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return; const ctx=CG.ctx||(CG.ctx=new AC()); const t=ctx.currentTime;
  (good?[523.25,659.25,783.99,1046.5]:[220,165]).forEach((f,i)=>{ const o=ctx.createOscillator(), g=ctx.createGain(); o.type=good?"square":"triangle"; o.frequency.value=f; g.gain.setValueAtTime(0.0001,t+i*.08); g.gain.exponentialRampToValueAtTime(0.08,t+i*.08+.02); g.gain.exponentialRampToValueAtTime(0.0001,t+i*.08+.2); o.connect(g); g.connect(ctx.destination); o.start(t+i*.08); o.stop(t+i*.08+.25); }); }catch(e){} }
async function cgOver(){
  CG.phase="over";
  const prev=cgBest(), best={chains:Math.max(prev.chains||0,CG.chains), bucks:Math.max(prev.bucks||0,CG.bucks)};
  try{ localStorage.setItem("nh_cgbest",JSON.stringify(best)); }catch(e){}
  let board="";
  if(ACC.db&&ACC.id){
    try{
      const ref=ACC.db.doc("scores/"+ACC.id), cur=await ref.get(), d=cur.exists?cur.data():{}, old=d.chain||{};
      const w=cgW(); await ref.set({...d, ...(CG.bucks>(old.bucks||0)?{chain:{bucks:CG.bucks, chains:CG.chains, longest:CG.longest, t:nowIso()}}:{}), wallet:{bank:w.bank, owned:w.owned, skin:w.skin, t:nowIso()}});
      const q=await ACC.db.collection("scores").limit(500).get();
      const rows=q.docs.map(x=>({id:x.id,c:x.data().chain})).filter(x=>x.c&&x.c.bucks>0).sort((a,b)=>b.c.bucks-a.c.bucks).slice(0,10);
      board=`<div class="fg-board"><div class="label">Kirko Chainz leaderboard</div>${rows.map((r,i)=>`<div class="fg-row${r.id===ACC.id?" me":""}"><span class="num">${i+1}</span>${av(r.id,"sm")}<span class="fg-nm" data-uname="${esc(r.id)}">${esc(personName(r.id))}</span><span class="t2">${r.c.chains}⛓️</span><b class="num">$${Number(r.c.bucks).toLocaleString()}</b></div>`).join("")||'<div class="fg-note">Be the first on the board!</div>'}</div>`;
    }catch(e){ console.warn("cg scores",e); }
  } else board=`<div class="fg-note">Sign in to get on the leaderboard.</div>`;
  $("cgMsg").innerHTML=`<div class="fg-over"><div class="lg-ft">Kirko Chainz · Drive over</div><div class="fg-big num">$${CG.bucks.toLocaleString()}</div><div class="t2">${CG.chains} chain${CG.chains===1?"":"s"} · longest ${CG.longest} yds${CG.bucks>(prev.bucks||0)&&CG.bucks>0?" · <b>New best!</b>":""}</div><div class="cg-over-bank">Bank <b class="num">${cgMoney(cgW().bank)}</b>${CG_SKINS.some(k=>!cgW().owned.includes(k.id)&&cgW().bank>=k.price)?` · <span class="cg-new">new ball unlocked!</span>`:""}</div>${board}<div class="cg-over-btns"><button class="btn-gold" data-cgagain="1">Run it back</button><button class="tbtn" data-cgshop="1">🛒 Ball Shop</button></div></div>`;
  $("cgHelp").textContent="";
}
/* ---------- bank + Ball Shop ----------
   Every completion's Huddle Bucks also go into a bank that carries over between drives.
   The bank buys football skins. Kept on the device; members also sync it to scores/<uid>.wallet. */
const CG_SKINS=[
  {id:"classic",name:"Classic Leather",price:0,base:["#9a5428","#5e2c10"],lace:"#fff"},
  {id:"purple",name:"Purple Reign",price:750,base:["#7a48c8","#3b1a70"],lace:"#FFC62F",stripe:"#FFC62F"},
  {id:"gold",name:"Gold Rush",price:1500,base:["#ffe27a","#c08a00"],lace:"#4F2683",stripe:"#4F2683"},
  {id:"arctic",name:"Arctic White",price:2500,base:["#ffffff","#c3d2e2"],lace:"#4F2683",stripe:"#4F2683"},
  {id:"neon",name:"Neon Volt",price:4000,base:["#d8ff5a","#5ea800"],lace:"#111",stripe:"#111"},
  {id:"aurora",name:"Northern Lights",price:7500,grad:["#2EE6C5","#7C5CFF"],lace:"#fff",glow:"rgba(94,242,214,.9)",trail:"#5EF2D6"},
  {id:"galaxy",name:"Galaxy",price:15000,base:["#3a1e6e","#0b0820"],lace:"#fff",stars:1,glow:"rgba(155,123,255,.9)",trail:"#9b7bff"},
  {id:"diamond",name:"Diamond Iced",price:30000,base:["#f2fdff","#86d3ee"],lace:"#fff",facets:1,glow:"rgba(191,243,255,1)",trail:"#dff8ff"},
  {id:"firechain",name:"Chainz on Fire",price:50000,base:["#9a5428","#4a200a"],lace:"#fff",chain:1,fire:1,glow:"rgba(255,120,20,1)",trail:"fire"}
];
function cgW(){ if(CG.wallet) return CG.wallet; let w={}; try{ w=JSON.parse(localStorage.getItem("nh_cgwallet")||"{}"); }catch(e){}
  CG.wallet={bank:Number(w.bank)||0, owned:Array.isArray(w.owned)?w.owned:["classic"], skin:w.skin||"classic"}; if(!CG.wallet.owned.includes("classic")) CG.wallet.owned.unshift("classic"); return CG.wallet; }
function cgWSave(remote){ const w=cgW(); try{ localStorage.setItem("nh_cgwallet",JSON.stringify(w)); }catch(e){} if(remote) cgWPush(); }
async function cgWPush(extra){ if(!(ACC.db&&ACC.id)) return; try{ const ref=ACC.db.doc("scores/"+ACC.id), cur=await ref.get(), d=cur.exists?cur.data():{}; const w=cgW();
  await ref.set({...d, ...(extra||{}), wallet:{bank:w.bank, owned:w.owned, skin:w.skin, t:nowIso()}}); }catch(e){ console.warn("cg wallet",e); } }
async function cgWPull(){ if(!(ACC.db&&ACC.id)||CG.wPulled===ACC.id) return; CG.wPulled=ACC.id; try{ const cur=await ACC.db.doc("scores/"+ACC.id).get(), r=cur.exists&&cur.data().wallet; if(!r) return;
  const w=cgW(); w.bank=Math.max(w.bank,Number(r.bank)||0); w.owned=[...new Set([...w.owned,...(r.owned||[])])]; if(r.skin&&w.owned.includes(r.skin)&&w.skin==="classic") w.skin=r.skin; cgWSave(false); cgShopRender(); }catch(e){} }
function cgSkin(){ const w=cgW(); return CG_SKINS.find(k=>k.id===w.skin)||CG_SKINS[0]; }
// draw a football centered at 0,0 pointing along +x
function cgFootball(x,rx,ry,sk,t){
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
  // laces
  x.strokeStyle=sk.lace; x.lineCap="round"; x.lineWidth=Math.max(1,rx*0.08); x.beginPath(); x.moveTo(-rx*0.36,-ry*0.32); x.lineTo(rx*0.36,-ry*0.32); x.stroke();
  x.lineWidth=Math.max(0.8,rx*0.055); for(let k=-3;k<=3;k++){ x.beginPath(); x.moveTo(k*rx*0.1,-ry*0.5); x.lineTo(k*rx*0.1,-ry*0.14); x.stroke(); } x.lineCap="butt";
  if(sk.facets){ x.strokeStyle="#fff"; x.lineWidth=Math.max(0.8,rx*0.04); for(let i=0;i<3;i++){ const a=(t*2+i*2.1)%6.28, px=Math.cos(a)*rx*0.6, py=Math.sin(a*1.3)*ry*0.5, r=rx*0.12*Math.abs(Math.sin(t*4+i)); x.beginPath(); x.moveTo(px-r,py); x.lineTo(px+r,py); x.moveTo(px,py-r); x.lineTo(px,py+r); x.stroke(); } }
  // gold chain wrapped around the ball
  if(sk.chain){ x.shadowColor="rgba(255,140,30,.9)"; x.shadowBlur=rx*0.25; const n=16; for(let k=0;k<=n;k++){ const u=k/n, px=-rx*0.95+u*rx*1.9, py=Math.sin(u*Math.PI*2.2+0.4)*ry*0.78*Math.sqrt(Math.max(0,1-(px/rx)**2));
      x.save(); x.translate(px,py); x.rotate(Math.cos(u*Math.PI*2.2+0.4)*0.9+(k%2?Math.PI/2:0)); x.strokeStyle=k%2?"#FFE27A":"#D99A00"; x.lineWidth=Math.max(1,rx*0.07); x.beginPath(); x.ellipse(0,0,rx*0.1,rx*0.06,0,0,7); x.stroke(); x.restore(); } x.shadowBlur=0; }
  x.restore();
}
function cgMoney(n){ return "$"+Math.round(n).toLocaleString(); }
function cgShopOpen(){ const sh=$("cgShop"); if(!sh) return; CG.paused=true; sh.hidden=false; cgShopRender(); cgWPull(); cancelAnimationFrame(CG.shopRaf); const tick=()=>{ if(sh.hidden) return; cgShopPaint(); CG.shopRaf=requestAnimationFrame(tick); }; tick(); }
function cgShopClose(){ const sh=$("cgShop"); if(sh) sh.hidden=true; CG.paused=false; CG.last=performance.now(); cancelAnimationFrame(CG.shopRaf); }
function cgShopRender(){ const sh=$("cgShop"); if(!sh||sh.hidden) return; const w=cgW();
  sh.innerHTML=`<div class="cg-shop-head"><div><div class="label">Ball Shop</div><div class="cg-bank">Bank <b class="num">${cgMoney(w.bank)}</b></div></div><button class="x" data-cgshopx aria-label="Close shop">×</button></div>
    <div class="cg-shop-grid">${CG_SKINS.map(k=>{ const own=w.owned.includes(k.id), on=w.skin===k.id, can=w.bank>=k.price;
      return `<div class="cg-skin${on?" on":""}${k.id==="firechain"?" legend":""}"><canvas data-skinpv="${k.id}" width="240" height="150"></canvas><div class="cg-skin-nm">${esc(k.name)}</div>
        ${on?`<button class="cg-skin-b eq" disabled>Equipped</button>`:own?`<button class="cg-skin-b" data-cgequip="${k.id}">Use it</button>`:`<button class="cg-skin-b buy" data-cgbuy="${k.id}" ${can?"":"disabled"}>${cgMoney(k.price)}</button>`}</div>`; }).join("")}</div>
    <p class="cg-shop-note">Every completion adds its Huddle Bucks to your bank, and the bank keeps growing between drives.${ACC.id?"":" Sign in to keep your bank and balls on any device."}</p>`;
  cgShopPaint(); }
function cgShopPaint(){ const t=performance.now()/1000; document.querySelectorAll("[data-skinpv]").forEach(cv=>{ const k=CG_SKINS.find(s=>s.id===cv.dataset.skinpv), x=cv.getContext("2d"); x.setTransform(1,0,0,1,0,0); x.clearRect(0,0,240,150); x.translate(120,82); x.rotate(-0.35); cgFootball(x,72,44,k,t); }); }
document.addEventListener("click",e=>{
  if(e.target.closest("[data-cgshop]")){ e.preventDefault(); if(!$("cgGame")||$("cgGame").hidden){ openChainGame(); } cgShopOpen(); return; }
  if(e.target.closest("[data-cgshopx]")){ cgShopClose(); return; }
  const b=e.target.closest("[data-cgbuy]"); if(b){ const k=CG_SKINS.find(s=>s.id===b.dataset.cgbuy), w=cgW(); if(!k||w.owned.includes(k.id)) return; if(w.bank<k.price) return toast("Not enough Huddle Bucks yet.");
    w.bank-=k.price; w.owned.push(k.id); w.skin=k.id; cgWSave(true); cgShopRender(); toast(`${k.name} unlocked! 🏈`); if(k.id==="firechain") cgSay("Oh my! He bought the Chainz on Fire ball!",true); return; }
  const q=e.target.closest("[data-cgequip]"); if(q){ const w=cgW(); w.skin=q.dataset.cgequip; cgWSave(true); cgShopRender(); }
});
/* ---------- drawing ---------- */
function cgBall(x,bx,by,z,m,hx,hy,spin){
  const [sx,sy,ss]=cgP(bx,by); x.fillStyle="rgba(0,0,0,.3)"; x.beginPath(); x.ellipse(sx,sy,0.3*ss+1,0.12*ss+1,0,0,7); x.fill();
  let [px,py,ps]=cgP(bx,by,z); if(m<1){ px=hx+(px-hx)*m; py=hy+(py-hy)*m; } const r=Math.max(4,Math.min(16,0.32*ps*(1+(1-m)*1.5)));
  const sk=cgSkin(), now=performance.now(); CG.trail=(CG.trail||[]).filter(p=>now-p.t<(sk.trail==="fire"?420:300)); if(sk.trail&&m>0.15) CG.trail.push({x:px,y:py,r,t:now});
  if(sk.trail){ x.save(); x.globalCompositeOperation="lighter"; CG.trail.forEach(p=>{ const f=1-(now-p.t)/(sk.trail==="fire"?420:300);
    if(sk.trail==="fire"){ x.fillStyle=f>0.6?`rgba(255,220,100,${f*0.5})`:`rgba(255,100,20,${f*0.45})`; x.beginPath(); x.arc(p.x+(Math.random()-0.5)*3,p.y+(Math.random()-0.5)*3,p.r*(0.4+f*0.6),0,7); x.fill(); }
    else { x.globalAlpha=f*0.5; x.fillStyle=sk.trail; x.beginPath(); x.arc(p.x,p.y,p.r*0.5*f,0,7); x.fill(); x.globalAlpha=1; } }); x.restore(); }
  x.save(); x.translate(px,py); x.rotate(-0.5+spin*0.3); cgFootball(x,r,r*0.62,sk,now/1000); x.restore(); }
function cgPoly(x,pts,fill){ x.fillStyle=fill; x.beginPath(); pts.forEach((p,i)=>{ const q=cgP(p[0],p[1],p[2]); i?x.lineTo(q[0],q[1]):x.moveTo(q[0],q[1]); }); x.closePath(); x.fill(); }
function cgLine(x,a,b,col,lw){ const p=cgP(a[0],a[1],a[2]), q=cgP(b[0],b[1],b[2]); x.strokeStyle=col; x.lineWidth=lw; x.beginPath(); x.moveTo(p[0],p[1]); x.lineTo(q[0],q[1]); x.stroke(); }
function cgDraw(){
  const c=$("cgCanvas"); if(!c||!CG.cam) return; const x=c.getContext("2d"), W=CG.w, H=CG.h, cam=CG.cam; x.setTransform(CG.dpr,0,0,CG.dpr,0,0);
  const NEAR=cam.y+1.2, FAR=150;
  // night sky + aurora glow
  let g=x.createLinearGradient(0,0,0,cam.hy); g.addColorStop(0,"#070b16"); g.addColorStop(1,"#18213a"); x.fillStyle=g; x.fillRect(0,0,W,cam.hy+2);
  g=x.createRadialGradient(W*0.3,cam.hy*0.15,0,W*0.3,cam.hy*0.15,W*0.7); g.addColorStop(0,"rgba(46,230,197,.18)"); g.addColorStop(1,"rgba(46,230,197,0)"); x.fillStyle=g; x.fillRect(0,0,W,cam.hy);
  g=x.createRadialGradient(W*0.8,cam.hy*0.3,0,W*0.8,cam.hy*0.3,W*0.6); g.addColorStop(0,"rgba(124,92,255,.2)"); g.addColorStop(1,"rgba(124,92,255,0)"); x.fillStyle=g; x.fillRect(0,0,W,cam.hy);
  // ground beyond the field
  x.fillStyle="#1d4a28"; x.fillRect(0,cam.hy,W,H-cam.hy);
  // far stands behind the end zone (rising away from the field)
  cgPoly(x,[[-90,92,0],[90,92,0],[90,FAR,40],[-90,FAR,40]],"#241a3d");
  for(let r=0;r<14;r++){ const y=94+r*4; cgLine(x,[-90,y,(y-92)*0.69],[90,y,(y-92)*0.69],r%2?"rgba(255,255,255,.07)":"rgba(255,198,47,.08)",1); }
  // field: 5-yard mowing stripes, LOS at your own 25 so the far end zone is 75 yards out
  for(let y=-15;y<75;y+=5){ const y0=Math.max(NEAR,y), y1=y+5; if(y1<=NEAR) continue; cgPoly(x,[[-26.7,y0],[26.7,y0],[26.7,y1],[-26.7,y1]],((y+15)/5)%2?"#2f7f3c":"#2b7437"); }
  cgPoly(x,[[-26.7,75],[26.7,75],[26.7,85],[-26.7,85]],"#3a2a6b");
  // end zone lettering
  { const [ex,ey,es]=cgP(0,80); const [,ey2]=cgP(0,82); x.save(); x.translate(ex,ey); x.scale(1,Math.max(0.12,(ey-ey2)/(2*es))); x.fillStyle="rgba(255,255,255,.55)"; x.font=`800 ${4*es}px "Barlow Condensed",system-ui`; x.textAlign="center"; x.textBaseline="middle"; x.fillText("NORTH HUDDLE",0,0); x.restore(); x.textBaseline="alphabetic"; }
  // sidelines, yard lines, hashes, numbers
  cgLine(x,[-26.7,NEAR],[-26.7,85],"#fff",2); cgLine(x,[26.7,NEAR],[26.7,85],"#fff",2);
  for(let y=-15;y<=75;y+=5){ if(y<NEAR) continue; cgLine(x,[-26.7,y],[26.7,y],"rgba(255,255,255,.75)",Math.max(1,cgP(0,y)[2]*0.12)); }
  for(let y=Math.ceil(NEAR);y<75;y++){ if(y%5===0) continue; for(const hx of [-3.1,3.1,-25.9,25.9]) cgLine(x,[hx-0.35,y],[hx+0.35,y],"rgba(255,255,255,.6)",1); }
  for(let y=-15;y<75;y+=10){ if(y<NEAR+2) continue; const fy=25+y, lab=String(fy<=50?fy:100-fy); if(fy%10) continue;
    for(const nx of [-19,19]){ const [px,py,ps]=cgP(nx,y), [,py2]=cgP(nx,y+1); x.save(); x.translate(px,py); x.scale(1,Math.max(0.1,(py-py2)/ps)); x.fillStyle="rgba(255,255,255,.7)"; x.font=`800 ${2*ps}px "Barlow Condensed",system-ui`; x.textAlign="center"; x.textBaseline="middle"; x.fillText(lab.split("").join(" "),0,0); x.restore(); } }
  x.textBaseline="alphabetic";
  cgLine(x,[-26.7,0],[26.7,0],"#3b82f6",Math.max(2,cgP(0,0)[2]*0.18));
  cgLine(x,[-26.7,10],[26.7,10],"#FFD54A",Math.max(2,cgP(0,10)[2]*0.16));
  // goal post
  { const Y=85; cgLine(x,[0,Y,0],[0,Y,3.3],"#FFD54A",3); cgLine(x,[-3.1,Y,3.3],[3.1,Y,3.3],"#FFD54A",3); cgLine(x,[-3.1,Y,3.3],[-3.1,Y,11],"#FFD54A",2.5); cgLine(x,[3.1,Y,3.3],[3.1,Y,11],"#FFD54A",2.5); }
  // side stands rising away from each sideline
  for(const sd of [-1,1]){ cgPoly(x,[[sd*31,NEAR,0],[sd*31,FAR,0],[sd*95,FAR,44],[sd*95,NEAR,44]],"#20183a");
    for(let r=0;r<16;r++){ const X=sd*(32+r*3.5); cgLine(x,[X,NEAR,(r*3.5+1)*0.69],[X,FAR,(r*3.5+1)*0.69],r%2?"rgba(255,255,255,.06)":"rgba(124,92,255,.14)",1); }
    cgPoly(x,[[sd*26.7,NEAR],[sd*26.7,FAR],[sd*31,FAR],[sd*31,NEAR]],"#22552f"); }
  // stadium lights
  for(const lx of [0.08,0.92]){ const gx=W*lx, gy=cam.hy*0.38; g=x.createRadialGradient(gx,gy,0,gx,gy,W*0.18); g.addColorStop(0,"rgba(255,255,240,.55)"); g.addColorStop(1,"rgba(255,255,240,0)"); x.fillStyle=g; x.fillRect(gx-W*0.2,gy-W*0.2,W*0.4,W*0.4); x.fillStyle="#fffbe6"; x.fillRect(gx-12,gy-4,24,8); }
  // faint route
  // routes: each receiver's own color, dark outline for contrast on the grass, arrow + name at the end
  if(CG.wrs&&(CG.phase==="route"||CG.phase==="air")){ const fade=CG.phase==="air"?0.35:1;
    CG.wrs.forEach(w=>{ const col=CG_WRCOL[w.i], q=w.pts.map(p=>cgP(p[0],p[1])); x.globalAlpha=fade; x.lineJoin="round"; x.lineCap="round";
      x.strokeStyle="rgba(5,20,10,.55)"; x.lineWidth=7; x.beginPath(); q.forEach((p,i)=>i?x.lineTo(p[0],p[1]):x.moveTo(p[0],p[1])); x.stroke();
      x.strokeStyle=col; x.lineWidth=3.5; x.beginPath(); q.forEach((p,i)=>i?x.lineTo(p[0],p[1]):x.moveTo(p[0],p[1])); x.stroke();
      const a=q[q.length-2], z=q[q.length-1], ang=Math.atan2(z[1]-a[1],z[0]-a[0]);
      x.fillStyle=col; x.strokeStyle="rgba(5,20,10,.6)"; x.lineWidth=2; x.beginPath(); x.moveTo(z[0]+Math.cos(ang)*9,z[1]+Math.sin(ang)*9); x.lineTo(z[0]+Math.cos(ang+2.5)*9,z[1]+Math.sin(ang+2.5)*9); x.lineTo(z[0]+Math.cos(ang-2.5)*9,z[1]+Math.sin(ang-2.5)*9); x.closePath(); x.stroke(); x.fill();
      if(CG.phase==="route"){ x.font='800 12px "Barlow Condensed",system-ui'; x.textAlign="center"; const t=w.route.toUpperCase(), tw=x.measureText(t).width+10, lx=Math.max(tw/2+2,Math.min(CG.w-tw/2-2,z[0])), ly=z[1]-12;
        x.fillStyle="rgba(11,18,32,.8)"; x.fillRect(lx-tw/2,ly-11,tw,15); x.fillStyle=col; x.fillText(t,lx,ly); }
      x.globalAlpha=1; x.lineCap="butt"; }); }
  // players, far to near. The pass rush pushes the pocket back as the clock runs.
  const prog=CG.phase==="route"?Math.min(1,CG.t/CG.pocket):CG.phase==="air"?Math.min(1,(CG.t)/CG.pocket):CG.res==="sack"?1:0.4;
  const run=performance.now()/1000, men=[];
  const OFF={j:"#4F2683",t:"#FFC62F",h:"#4F2683",p:"#E9E4D4"}, DEF={j:"#B3202A",t:"#fff",h:"#C9CCD3",p:"#fff"};
  for(let i=-2;i<=2;i++) men.push({X:i*1.5,Y:-1-prog*3.2,c:OFF,face:"back",num:[77,63,56,64,71][i+2],ph:0});
  for(let i=0;i<4;i++) men.push({X:(i-1.5)*2.1,Y:0.9-prog*3.4+(i%3?0.3:0),c:DEF,face:"front",num:[97,93,99,90][i],ph:prog>0.05?run*9+i:0});
  if(CG.wrs){ const live=CG.phase==="route"||CG.phase==="air", car=CG.phase==="result"&&CG.post&&CG.post.carrier;
    [...CG.cbs,CG.sf].forEach(d=>men.push({X:d.x,Y:d.y,c:DEF,face:"front",num:d.num,ph:live||car===d?run*11:0,up:car===d}));
    CG.wrs.forEach(w=>men.push({X:w.x,Y:w.y,c:OFF,face:"back",num:w.num,rc:CG_WRCOL[w.i],ph:live||car===w?run*12:0,wr:1,up:(CG.phase==="air"&&w.track&&CG.ball.T-CG.ball.t<0.45)||car===w})); }
  men.sort((a,b)=>b.Y-a.Y).forEach(m=>cgMan(x,m));
  // aim preview while swiping: the ring says what will happen if you let go now
  if(CG.drag&&CG.phase==="route"){ const a=cgAim(CG.drag);
    if(a){ const now=performance.now(); if(!CG.pred||now-CG.pred.at>60||Math.hypot(CG.pred.tx-a.tx,CG.pred.ty-a.ty)>0.6) CG.pred={at:now,tx:a.tx,ty:a.ty,j:cgPredict(a)};
      const k0=CG.pred.j.kind, col={open:"#3BE37A",dive:"#3BE37A",contested:"#FFC62F",covered:"#FF5A4F",miss:"rgba(255,255,255,.9)"}[k0], lab={open:"OPEN",dive:"DIVE FOR IT",contested:"CONTESTED",covered:"COVERED",miss:"NO ONE THERE"}[k0];
      const [hx,hy]=cgHand(); x.setLineDash([3,6]); x.strokeStyle=col; x.globalAlpha=0.85; x.lineWidth=2.5; x.beginPath(); x.moveTo(hx,hy);
      for(let i=1;i<=24;i++){ const k=i/24, bx=0.5+(a.tx-0.5)*k, by=CG_QBY+(a.ty-CG_QBY)*k, z=2.2+(1.3-2.2)*k+Math.sin(Math.PI*k)*Math.min(11,a.yds/3.6), q=cgP(bx,by,z), m=Math.min(1,k*4); x.lineTo(hx+(q[0]-hx)*m,hy+(q[1]-hy)*m); } x.stroke(); x.setLineDash([]); x.globalAlpha=1;
      const [tx,ty,ts]=cgP(a.tx,a.ty); x.globalAlpha=0.22; x.fillStyle=col; x.beginPath(); x.ellipse(tx,ty,1.9*ts,0.7*ts,0,0,7); x.fill(); x.globalAlpha=1;
      x.strokeStyle=col; x.lineWidth=3.5; x.beginPath(); x.ellipse(tx,ty,1.9*ts,0.7*ts,0,0,7); x.stroke();
      x.font='800 15px "Barlow Condensed",system-ui'; x.textAlign="center"; const txt=Math.round(a.ty)+" YDS · "+lab, tw=x.measureText(txt).width+14;
      x.fillStyle="rgba(11,18,32,.82)"; x.fillRect(tx-tw/2,ty-1.2*ts-24,tw,20); x.fillStyle=col; x.fillText(txt,tx,ty-1.2*ts-9); } }
  // ball in the air
  if(CG.phase==="air"&&CG.ball){ const b=CG.ball, k=Math.min(1,b.t/b.T), bx=b.x0+(b.tx-b.x0)*k, by=b.y0+(b.ty-b.y0)*k, z=2.2+(1.3-2.2)*k+Math.sin(Math.PI*k)*Math.min(11,b.dist/3.6);
    const [tx,ty,ts]=cgP(b.tx,b.ty); x.strokeStyle="rgba(255,255,255,.45)"; x.lineWidth=2; x.beginPath(); x.ellipse(tx,ty,1.6*ts,0.6*ts,0,0,7); x.stroke();
    const [hx,hy]=cgHand(), m=Math.min(1,k*5); cgBall(x,bx,by,z,m,hx,hy,k); }
  if(CG.phase==="result"&&CG.post){ const b=CG.post.ball; cgBall(x,b.x,b.y,b.z,1,0,0,CG.post.t*3); }
  // pocket clock
  if(CG.phase==="route"){ const left=Math.max(0,CG.pocket-CG.t), f=left/CG.pocket; x.fillStyle="rgba(0,0,0,.45)"; x.fillRect(W-112,12,100,10); x.fillStyle=f>0.4?"#5EF2D6":f>0.2?"#FFC62F":"#ff5a4f"; x.fillRect(W-112,12,100*f,10); x.fillStyle="#fff"; x.font='700 11px "Barlow Condensed",system-ui'; x.textAlign="right"; x.fillText("POCKET",W-12,36); }
  if(CG.wrs){ x.fillStyle="rgba(255,255,255,.8)"; x.font='700 13px "Barlow Condensed",system-ui'; x.textAlign="left"; x.fillText("3 RECEIVERS",12,22);
    const st=CG.streak||0; if(st>=2){ const t=st>=5?"🔥🔥 BLAZING  ×2":st>=3?"🔥 ON FIRE  ×1.5":"♨ HEATING UP"; x.font='800 16px "Barlow Condensed",system-ui'; const tw=x.measureText(t).width+16; const gr=x.createLinearGradient(10,30,10+tw,30); gr.addColorStop(0,st>=3?"#ff3d00":"#ff9a3c"); gr.addColorStop(1,st>=5?"#ffd000":"#ff6a00"); x.fillStyle=gr; x.beginPath(); x.roundRect?x.roundRect(10,32,tw,24,12):x.rect(10,32,tw,24); x.fill(); x.fillStyle="#fff"; x.fillText(t,18,49); } }
  cgQB(x,W,H);
}
// a player seen from behind (offense) or the front (defense), sized by distance
function cgMan(x,m){
  const [px,py,s0]=cgP(m.X,m.Y), dep=m.Y-CG.cam.y, s=s0*(1+Math.max(0,dep-14)/28), c=m.c, Y=z=>py-z*s;
  if(px<-40||px>CG.w+40) return;
  if(m.wr){ x.strokeStyle=m.rc||"#5EF2D6"; x.lineWidth=3; x.beginPath(); x.ellipse(px,py,0.75*s+3,0.28*s+2,0,0,7); x.stroke(); }
  x.fillStyle="rgba(0,0,0,.32)"; x.beginPath(); x.ellipse(px,py,0.5*s,0.17*s,0,0,7); x.fill();
  const sw=Math.sin(m.ph||0)*0.22*s, lw=Math.max(1.5,0.2*s);
  x.lineCap="round"; x.strokeStyle=c.p; x.lineWidth=lw; x.beginPath(); x.moveTo(px-0.12*s,Y(0.95)); x.lineTo(px-0.16*s+sw,Y(0.05)); x.moveTo(px+0.12*s,Y(0.95)); x.lineTo(px+0.16*s-sw,Y(0.05)); x.stroke();
  x.strokeStyle="#111"; x.lineWidth=lw*1.1; x.beginPath(); x.moveTo(px-0.16*s+sw,Y(0.05)); x.lineTo(px-0.16*s+sw,Y(0)); x.moveTo(px+0.16*s-sw,Y(0.05)); x.lineTo(px+0.16*s-sw,Y(0)); x.stroke();
  // arms
  x.strokeStyle=c.j; x.lineWidth=Math.max(1.5,0.17*s); x.beginPath();
  if(m.up){ x.moveTo(px-0.33*s,Y(1.5)); x.lineTo(px-0.28*s,Y(2.35)); x.moveTo(px+0.33*s,Y(1.5)); x.lineTo(px+0.28*s,Y(2.35)); }
  else { x.moveTo(px-0.33*s,Y(1.5)); x.lineTo(px-0.4*s-sw*0.5,Y(1.0)); x.moveTo(px+0.33*s,Y(1.5)); x.lineTo(px+0.4*s+sw*0.5,Y(1.0)); }
  x.stroke(); x.lineCap="butt";
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
function cgHeat(){ const st=CG.streak||0; return st>=5?1:st>=3?0.7:st===2?0.3:0; }
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
  x.save(); x.translate(cx,base); x.scale(s,s);
  const lg=(x0,y0,x1,y1,stops)=>{ const g=x.createLinearGradient(x0,y0,x1,y1); stops.forEach(([o,c])=>g.addColorStop(o,c)); return g; };
  // off arm: out to the side for balance (mostly hidden behind the body)
  { const S=[-112,-104], E=follow?[-146,-96]:[-150,-122], Hd=follow?[-118,-104]:[-128,-150];
    cgLimb(x,E[0],E[1],Hd[0],Hd[1],25,18,SK,SKL,SKD,1.1); x.fillStyle=SK; x.beginPath(); x.ellipse(Hd[0],Hd[1],10,11,0,0,7); x.fill();
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
  if(follow){ cgLimb(x,96,-176,62,-238,24,17,SK,SKL,SKD,1.1); x.fillStyle=SK; x.beginPath(); x.ellipse(58,-248,9,11,-0.4,0,7); x.fill(); cgLimb(x,114,-108,96,-176,38,27,SK,SKL,SKD,1.18); }
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
    const wx=Wr[0], wy=Wr[1]; x.fillStyle=SK; x.beginPath(); x.ellipse(wx-3,wy-8,9,11,-0.2,0,7); x.fill();
    if(CG.phase!=="route"){ x.fillStyle=SK; x.beginPath(); x.ellipse(wx-4,wy-16,10,9,-0.2,0,7); x.fill(); x.strokeStyle=SKD; x.lineWidth=1; for(let f=0;f<3;f++){ x.beginPath(); x.moveTo(wx-11+f*5,wy-22); x.lineTo(wx-10+f*5,wy-13); x.stroke(); } }
    else { x.lineCap="round"; x.strokeStyle=SK; x.lineWidth=5.5; for(let f=0;f<4;f++){ x.beginPath(); x.moveTo(wx-7+f*3.4,wy-14); x.quadraticCurveTo(wx-13+f*3,wy-24-f, wx-19+f*4.5,wy-28-f*2); x.stroke(); }
    x.strokeStyle=SKD; x.lineWidth=1; for(let f=1;f<4;f++){ x.beginPath(); x.moveTo(wx-8.7+f*3.4,wy-14); x.quadraticCurveTo(wx-14.7+f*3,wy-24-f, wx-20.7+f*4.5,wy-28-f*2); x.stroke(); } x.lineCap="butt"; } }
  else { x.fillStyle=PU; x.beginPath(); x.ellipse(116,-112,24,20,-0.4,0,7); x.fill(); }
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
/* ---------- Home card + keyboard ---------- */
const _renderHomeCG=renderHome;
renderHome=function(){ _renderHomeCG(); const el=$("v-home"); if(!S.meta||!el||el.querySelector(".cg-card")) return;
  const fg=el.querySelector(".fg-card"); const b=cgBest();
  const html=`<button class="card fg-card cg-card" data-chaingame="1"><span class="fg-ico">⛓️</span><span class="grow"><span class="lg-ft">Kirko Chainz</span><span class="t2">Hit your receiver, stack the chains, rack up Huddle Bucks.${b.bucks?` Best $${Number(b.bucks).toLocaleString()}`:""}${cgW().bank?` · Bank ${cgMoney(cgW().bank)}`:""}</span></span><span class="tbtn">Play</span></button>`;
  if(fg) fg.insertAdjacentHTML("afterend",html); };
document.addEventListener("click",e=>{ if(e.target.closest("[data-chaingame]")&&!e.target.closest("[data-cgshop]")) openChainGame(); });
document.addEventListener("keydown",e=>{ if(CG.on&&e.key==="Escape") closeChainGame(); if(CG.on&&CG.phase==="over"&&(e.key==="Enter"||e.key===" ")){ e.preventDefault(); cgStart(); } });
