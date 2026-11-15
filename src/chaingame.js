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
    ov.innerHTML=`<div class="fg-top cg-top"><div class="fg-stat"><span class="label">Chains</span><b id="cgChains" class="num">0</b></div><div class="fg-stat"><span class="label">Huddle Bucks</span><b id="cgBucks" class="num">$0</b></div><div class="fg-stat"><span class="label">Strikes</span><b id="cgStrikes" class="num"></b></div><button class="cg-snd" id="cgSnd" aria-label="Announcer sound" aria-pressed="true">🔊</button><button class="x" id="cgClose" aria-label="Close game">×</button></div>
      <div class="fg-stage"><canvas id="cgCanvas"></canvas><div class="fg-msg" id="cgMsg"></div></div>
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
  ov.hidden=false; document.body.style.overflow="hidden"; CG.on=true; cgResize(); cgStart();
  window.addEventListener("resize",cgResize);
}
function closeChainGame(){ try{ speechSynthesis.cancel(); }catch(e){} CG.on=false; CG.drag=null; cancelAnimationFrame(CG.raf); const ov=$("cgGame"); if(ov) ov.hidden=true; document.body.style.overflow=""; window.removeEventListener("resize",cgResize); }
function cgResize(){ const c=$("cgCanvas"); if(!c) return; const st=c.parentElement.getBoundingClientRect(), dpr=Math.min(2,window.devicePixelRatio||1); c.width=st.width*dpr; c.height=st.height*dpr; c.style.width=st.width+"px"; c.style.height=st.height+"px"; CG.w=st.width; CG.h=st.height; CG.dpr=dpr; cgCam(); }
function cgStart(){ Object.assign(CG,{chains:0, bucks:0, strikes:0, comps:0, longest:0, phase:"set", t:0, ball:null, wr:null, cb:null, sf:null, flash:null, drag:null, thrown:0, streak:0, post:null, fx:[]}); $("cgMsg").innerHTML=""; $("cgHelp").textContent=CG_HELP; cgHud(); cgSnap(); cancelAnimationFrame(CG.raf); CG.last=performance.now(); CG.raf=requestAnimationFrame(cgLoop); }
function cgHud(){ $("cgChains").textContent=CG.chains; $("cgBucks").textContent="$"+CG.bucks.toLocaleString(); $("cgStrikes").textContent="✕".repeat(CG.strikes)+"·".repeat(Math.max(0,3-CG.strikes)); }

/* ---------- camera: just above and behind the QB, looking downfield ----------
   World units are yards: X across (−26.7..26.7), Y downfield (line of scrimmage = 0, QB at −6), Z up.
   A softened perspective (depth^0.55) keeps deep routes readable on a tall phone screen. */
const CG_QBY=-6, CG_GAM=0.55;
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
function cgSnap(){
  const names=Object.keys(CG_ROUTES), name=names[(Math.random()*names.length)|0];
  const side=Math.random()<0.5?-1:1, startX=side*(5+Math.random()*4);
  const pts=CG_ROUTES[name].map(([x,y])=>[startX+x*-side, y]);
  pts.forEach(p=>{ p[0]=Math.max(-16,Math.min(16,p[0])); });
  const lvl=CG.comps;
  CG.wr={pts, seg:0, x:pts[0][0], y:0, speed:7.2+Math.random()*0.8, route:name, track:false};
  CG.cb={x:startX+side*-1.2, y:5+Math.random()*2, speed:6.3+Math.min(1.6,lvl*0.08), react:Math.max(0.12,0.45-lvl*0.02), lag:[], track:false};
  CG.sf={x:-side*4, y:17+Math.random()*4, speed:5.4+Math.min(1.2,lvl*0.06), track:false};
  CG.phase="route"; CG.t=0; CG.ball=null; CG.drag=null; CG.post=null; CG.pocket=4.4-Math.min(1.4,lvl*0.05);
}
function cgMove(ent,tx,ty,spd,dt){ const dx=tx-ent.x, dy=ty-ent.y, d=Math.hypot(dx,dy); if(d<1e-3) return true; const s=Math.min(d,spd*dt); ent.x+=dx/d*s; ent.y+=dy/d*s; return s>=d-1e-3; }
/* One step of the play. The live game and the aim preview both run this, so the ring's
   OPEN / CONTESTED / COVERED call matches what actually happens when the ball lands.
   Late in the ball's flight the receiver adjusts to it (up to ~3.5 yds), and defenders break on it. */
function cgStep(S,dt){
  S.t+=dt; const w=S.wr, c=S.cb, f=S.sf, b=S.ball;
  const rem=b?b.T-b.t:9, land=b?[b.tx,b.ty]:null;
  if(b&&!w.track&&rem<0.95&&Math.hypot(w.x-land[0],w.y-land[1])<=3.5) w.track=true;
  if(w.track) cgMove(w,land[0],land[1],w.speed*1.12,dt);
  else { const tgt=w.pts[w.seg+1]; if(tgt){ if(cgMove(w,tgt[0],tgt[1],w.speed,dt)) w.seg++; } else {
      const a=w.pts[w.pts.length-2], z=w.pts[w.pts.length-1], dx=z[0]-a[0], dy=z[1]-a[1], d=Math.hypot(dx,dy)||1; w.x+=dx/d*w.speed*dt*0.85; w.y+=dy/d*w.speed*dt*0.85; w.x=Math.max(-25,Math.min(25,w.x)); } }
  if(b&&!c.track&&rem<0.7&&Math.hypot(c.x-land[0],c.y-land[1])<=3) c.track=true;
  if(c.track) cgMove(c,land[0],land[1],c.speed,dt);
  else { c.lag.push([S.t,w.x,w.y]); while(c.lag.length&&c.lag[0][0]<S.t-c.react) c.lag.shift(); const aim=c.lag[0]||[0,w.x,w.y]; cgMove(c,aim[1]+(c.x<w.x?-0.6:0.6),aim[2]+0.4,c.speed,dt); }
  if(b&&!f.track&&rem<1.2&&Math.hypot(f.x-land[0],f.y-land[1])<=6) f.track=true;
  if(f.track) cgMove(f,land[0],land[1],f.speed*1.05,dt);
  else { const t2=w.y>f.y-6?[w.x,w.y+3]:[f.x*0.97,f.y]; cgMove(f,t2[0],t2[1],f.speed*0.6,dt); }
  if(b) b.t+=dt;
}
// what happens when the ball comes down
function cgJudge(S){
  const b=S.ball, dw=Math.hypot(S.wr.x-b.tx,S.wr.y-b.ty), dc=Math.hypot(S.cb.x-b.tx,S.cb.y-b.ty), ds=Math.hypot(S.sf.x-b.tx,S.sf.y-b.ty), dd=Math.min(dc,ds);
  const wrIn=dw<=2.0, defIn=dd<=1.4, who=dc<=ds?"cb":"sf";
  if(wrIn&&!defIn) return {kind:dw>1.1?"dive":"open",dw,dd,who};
  if(wrIn&&defIn) return {kind:"contested",dw,dd,who,p:Math.max(0.2,Math.min(0.8,0.55+(dd-dw)*0.35))};
  if(defIn) return {kind:"covered",dw,dd,who};
  return {kind:"miss",dw,dd,who};
}
function cgClone(){ return {t:CG.t, wr:{...CG.wr}, cb:{...CG.cb,lag:CG.cb.lag.slice()}, sf:{...CG.sf}, ball:null}; }
function cgPredict(a){ const S=cgClone(), dist=Math.hypot(a.tx-0.5,a.ty-CG_QBY); S.ball={tx:a.tx,ty:a.ty,t:0,T:cgFlight(dist,false)}; let n=0; while(S.ball.t<S.ball.T&&n++<400) cgStep(S,1/60); return cgJudge(S); }
function cgFlight(dist){ return 0.3+dist/23; }
function cgLoop(now){
  if(!CG.on) return;
  const dt=Math.min(0.05,(now-CG.last)/1000); CG.last=now;
  if(CG.phase==="route"||CG.phase==="air"){
    cgStep(CG,dt);
    if(CG.phase==="route"&&CG.t>CG.pocket){ CG.drag=null; cgResult("sack"); }
    else if(CG.phase==="air"&&CG.ball.t>=CG.ball.T) cgLand();
  } else if(CG.phase==="result") cgPost(dt);
  cgDraw(); CG.raf=requestAnimationFrame(cgLoop);
}
function cgLand(){
  const j=cgJudge(CG), b=CG.ball, yds=Math.max(1,Math.round(b.ty));
  if(j.kind==="open"||j.kind==="dive") return cgResult("catch",yds,j.kind==="dive"?"DIVING CATCH!":"COMPLETE!");
  if(j.kind==="contested") return Math.random()<j.p?cgResult("catch",yds,"CONTESTED CATCH!"):cgResult(Math.random()<0.3?"pick":"broken",0,"",j.who);
  if(j.kind==="covered") return cgResult(j.dd<0.8&&Math.random()<0.55?"pick":"broken",0,"",j.who);
  cgResult("incomplete");
}
// after the ball arrives: the catch and run, the deflection, the pick, or the ball bouncing away
function cgPost(dt){
  const P=CG.post; if(!P) return; P.t+=dt; const b=P.ball;
  if(P.carrier){ const m=CG[P.carrier]; m.y+=P.dir*m.speed*0.8*dt; b.x=m.x+0.3; b.y=m.y; b.z=1.2; return; }
  b.vz-=22*dt; b.x+=b.vx*dt; b.y+=b.vy*dt; b.z+=b.vz*dt;
  if(b.z<0.15){ b.z=0.15; b.vz=Math.abs(b.vz)*0.45; b.vx*=0.6; b.vy*=0.6; b.bounce=(b.bounce||0)+1; }
}
function cgMult(){ return CG.streak>=5?2:CG.streak>=3?1.5:1; }
function cgResult(kind,yds,label,who){
  CG.phase="result"; CG.res=kind; let html; const b=CG.ball;
  const at=b?{x:b.tx,y:b.ty,z:1.2}:null, dir=b?[b.tx-b.x0,b.ty-b.y0]:[0,1], dl=Math.hypot(dir[0],dir[1])||1;
  if(kind==="catch"){
    CG.comps++; CG.chains++; CG.streak=(CG.streak||0)+1; const mult=cgMult();
    const bucks=Math.round((yds*5+Math.max(0,yds-15)*10+Math.max(0,yds-30)*15)*mult); CG.bucks+=bucks; CG.longest=Math.max(CG.longest,yds);
    const fire=CG.streak>=3?` · 🔥 ×${mult}`:CG.streak===2?" · heating up…":"";
    html=`<b>${label||"COMPLETE!"}</b><span>${yds} yards · +$${bucks}${fire}</span><span>New chain: ${CG_CHAINS[(CG.chains-1)%CG_CHAINS.length].name} ⛓️</span>`; cgSound(true); cgCall(label,yds);
    CG.flash={t:performance.now()}; CG.post={t:0,carrier:"wr",dir:1,ball:{...at}};
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
      if(CG.bucks>(old.bucks||0)) await ref.set({...d, chain:{bucks:CG.bucks, chains:CG.chains, longest:CG.longest, t:nowIso()}});
      const q=await ACC.db.collection("scores").limit(500).get();
      const rows=q.docs.map(x=>({id:x.id,c:x.data().chain})).filter(x=>x.c&&x.c.bucks>0).sort((a,b)=>b.c.bucks-a.c.bucks).slice(0,10);
      board=`<div class="fg-board"><div class="label">Kirko Chainz leaderboard</div>${rows.map((r,i)=>`<div class="fg-row${r.id===ACC.id?" me":""}"><span class="num">${i+1}</span>${av(r.id,"sm")}<span class="fg-nm" data-uname="${esc(r.id)}">${esc(personName(r.id))}</span><span class="t2">${r.c.chains}⛓️</span><b class="num">$${Number(r.c.bucks).toLocaleString()}</b></div>`).join("")||'<div class="fg-note">Be the first on the board!</div>'}</div>`;
    }catch(e){ console.warn("cg scores",e); }
  } else board=`<div class="fg-note">Sign in to get on the leaderboard.</div>`;
  $("cgMsg").innerHTML=`<div class="fg-over"><div class="lg-ft">Kirko Chainz · Drive over</div><div class="fg-big num">$${CG.bucks.toLocaleString()}</div><div class="t2">${CG.chains} chain${CG.chains===1?"":"s"} · longest ${CG.longest} yds${CG.bucks>(prev.bucks||0)&&CG.bucks>0?" · <b>New best!</b>":""}</div>${board}<button class="btn-gold" data-cgagain="1">Run it back</button></div>`;
  $("cgHelp").textContent="";
}
/* ---------- drawing ---------- */
function cgBall(x,bx,by,z,m,hx,hy,spin){
  const [sx,sy,ss]=cgP(bx,by); x.fillStyle="rgba(0,0,0,.3)"; x.beginPath(); x.ellipse(sx,sy,0.3*ss+1,0.12*ss+1,0,0,7); x.fill();
  let [px,py,ps]=cgP(bx,by,z); if(m<1){ px=hx+(px-hx)*m; py=hy+(py-hy)*m; } const r=Math.max(4,Math.min(16,0.32*ps*(1+(1-m)*1.5)));
  x.save(); x.translate(px,py); x.rotate(-0.5+spin*0.3); x.fillStyle="#7a3e1d"; x.beginPath(); x.ellipse(0,0,r,r*0.62,0,0,7); x.fill(); x.strokeStyle="#fff"; x.lineWidth=Math.max(1,r*0.12); x.beginPath(); x.moveTo(-r*0.35,0); x.lineTo(r*0.35,0); x.stroke(); x.restore(); }
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
  if(CG.wr&&CG.phase==="route"){ x.setLineDash([5,7]); x.strokeStyle="rgba(255,255,255,.3)"; x.lineWidth=2; x.beginPath(); CG.wr.pts.forEach((p,i)=>{ const q=cgP(p[0],p[1]); i?x.lineTo(q[0],q[1]):x.moveTo(q[0],q[1]); }); x.stroke(); x.setLineDash([]); }
  // players, far to near. The pass rush pushes the pocket back as the clock runs.
  const prog=CG.phase==="route"?Math.min(1,CG.t/CG.pocket):CG.phase==="air"?Math.min(1,(CG.t)/CG.pocket):CG.res==="sack"?1:0.4;
  const run=performance.now()/1000, men=[];
  const OFF={j:"#4F2683",t:"#FFC62F",h:"#4F2683",p:"#E9E4D4"}, DEF={j:"#B3202A",t:"#fff",h:"#C9CCD3",p:"#fff"};
  for(let i=-2;i<=2;i++) men.push({X:i*1.5,Y:-1-prog*3.2,c:OFF,face:"back",num:[77,63,56,64,71][i+2],ph:0});
  for(let i=0;i<4;i++) men.push({X:(i-1.5)*2.1,Y:0.9-prog*3.4+(i%3?0.3:0),c:DEF,face:"front",num:[97,93,99,90][i],ph:prog>0.05?run*9+i:0});
  if(CG.wr){ const live=CG.phase==="route"||CG.phase==="air";
    men.push({X:CG.cb.x,Y:CG.cb.y,c:DEF,face:"front",num:24,ph:live?run*11:0});
    men.push({X:CG.sf.x,Y:CG.sf.y,c:DEF,face:"front",num:31,ph:live?run*10:0});
    const car=CG.phase==="result"&&CG.post&&CG.post.carrier; men.forEach(m=>{ if(car&&((car==="cb"&&m.num===24)||(car==="sf"&&m.num===31))){ m.up=1; m.ph=run*11; } });
    men.push({X:CG.wr.x,Y:CG.wr.y,c:OFF,face:"back",num:18,ph:live||car==="wr"?run*12:0,wr:1,up:(CG.phase==="air"&&CG.wr.track&&CG.ball.T-CG.ball.t<0.45)||car==="wr"}); }
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
  if(CG.wr){ x.fillStyle="rgba(255,255,255,.8)"; x.font='700 13px "Barlow Condensed",system-ui'; x.textAlign="left"; x.fillText(CG.wr.route.toUpperCase()+" ROUTE",12,22);
    const st=CG.streak||0; if(st>=2){ const t=st>=5?"🔥🔥 BLAZING  ×2":st>=3?"🔥 ON FIRE  ×1.5":"♨ HEATING UP"; x.font='800 16px "Barlow Condensed",system-ui'; const tw=x.measureText(t).width+16; const gr=x.createLinearGradient(10,30,10+tw,30); gr.addColorStop(0,st>=3?"#ff3d00":"#ff9a3c"); gr.addColorStop(1,st>=5?"#ffd000":"#ff6a00"); x.fillStyle=gr; x.beginPath(); x.roundRect?x.roundRect(10,32,tw,24,12):x.rect(10,32,tw,24); x.fill(); x.fillStyle="#fff"; x.fillText(t,18,49); } }
  cgQB(x,W,H);
}
// a player seen from behind (offense) or the front (defense), sized by distance
function cgMan(x,m){
  const [px,py,s0]=cgP(m.X,m.Y), dep=m.Y-CG.cam.y, s=s0*(1+Math.max(0,dep-14)/28), c=m.c, Y=z=>py-z*s;
  if(px<-40||px>CG.w+40) return;
  if(m.wr){ x.strokeStyle="#5EF2D6"; x.lineWidth=2.5; x.beginPath(); x.ellipse(px,py,0.75*s+3,0.28*s+2,0,0,7); x.stroke(); }
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
  if(m.wr&&s<26){ x.fillStyle="#5EF2D6"; x.font='800 12px "Barlow Condensed",system-ui'; x.textAlign="center"; x.fillText("WR",px,Y(2.2)-4); }
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
function cgHand(){ const W=CG.w, H=CG.h, s=cgQBs(), pull=CG.drag?12:0; return [W/2+(118+pull*0.5)*s, H+8-(212-pull)*s]; }
// our QB from just above and behind: shaded neck, fade haircut and headband, the chain stack, #8, and a real throwing arm
function cgQB(x,W,H){
  const s=cgQBs(), n=CG.chains, cx=W/2, base=H+8, now=performance.now(), heat=cgHeat();
  const flash=CG.flash&&now-CG.flash.t<700?1-(now-CG.flash.t)/700:0;
  const since=CG.thrown?(now-CG.thrown)/1000:9, follow=CG.phase!=="route"&&since<1.0, pull=CG.drag?12:0;
  const SK="#d39a74", SKD="#a96e4c", SKL="#e8b893";
  x.save(); x.translate(cx,base); x.scale(s,s);
  const lg=(x0,y0,x1,y1,stops)=>{ const g=x.createLinearGradient(x0,y0,x1,y1); stops.forEach(([o,c])=>g.addColorStop(o,c)); return g; };
  // off arm reaching toward the target (behind the body from this angle)
  x.lineCap="round"; { const ex=follow?-126:-134, ey=follow?-104:-118, hx=follow?-150:-116, hy=follow?-92:-142;
    x.strokeStyle=SKD; x.lineWidth=19; x.beginPath(); x.moveTo(ex,ey); x.lineTo(hx,hy); x.stroke(); x.fillStyle=SKD; x.beginPath(); x.arc(hx,hy,10,0,7); x.fill();
    x.strokeStyle="#43207a"; x.lineWidth=36; x.beginPath(); x.moveTo(-98,-100); x.lineTo(ex+6,ey+2); x.stroke(); x.strokeStyle="#FFC62F"; x.lineWidth=4; x.lineCap="butt"; x.beginPath(); x.moveTo(ex+4,ey-14); x.lineTo(ex+10,ey+16); x.stroke(); x.lineCap="round"; }
  // follow-through arm goes out in front, so it sits behind the head
  if(follow){ x.strokeStyle="#4F2683"; x.lineWidth=34; x.beginPath(); x.moveTo(94,-102); x.lineTo(78,-178); x.stroke(); x.strokeStyle=SK; x.lineWidth=19; x.beginPath(); x.moveTo(78,-178); x.lineTo(52,-246); x.stroke(); x.fillStyle=SK; x.beginPath(); x.ellipse(48,-256,9,12,-0.4,0,7); x.fill(); }
  // jersey over shoulder pads
  x.fillStyle=lg(-130,0,130,0,[[0,"#33175c"],[0.22,"#4F2683"],[0.5,"#5a2f95"],[0.78,"#4F2683"],[1,"#33175c"]]);
  x.beginPath(); x.moveTo(-126,0); x.lineTo(-130,-62); x.quadraticCurveTo(-130,-106,-96,-114); x.quadraticCurveTo(-60,-120,-30,-116); x.lineTo(30,-116); x.quadraticCurveTo(60,-120,96,-114); x.quadraticCurveTo(130,-106,130,-62); x.lineTo(126,0); x.closePath(); x.fill();
  // pad highlights + seams + sleeve stripes
  for(const sd of [-1,1]){ const g=x.createRadialGradient(sd*92,-104,2,sd*92,-104,40); g.addColorStop(0,"rgba(255,255,255,.16)"); g.addColorStop(1,"rgba(255,255,255,0)"); x.fillStyle=g; x.beginPath(); x.ellipse(sd*92,-100,40,18,0,0,7); x.fill();
    x.strokeStyle="rgba(0,0,0,.28)"; x.lineWidth=2.5; x.beginPath(); x.moveTo(sd*62,-116); x.quadraticCurveTo(sd*48,-60,sd*56,0); x.stroke();
    x.fillStyle="#fff"; x.fillRect(sd>0?112:-130,-80,18,5); x.fillStyle="#FFC62F"; x.fillRect(sd>0?112:-130,-74,18,4); }
  x.strokeStyle="rgba(0,0,0,.18)"; x.lineWidth=2; x.beginPath(); x.moveTo(-20,-60); x.quadraticCurveTo(0,-52,22,-62); x.moveTo(-34,-30); x.quadraticCurveTo(0,-20,36,-32); x.stroke();
  // number on the back: white with a gold outline
  x.font='800 66px "Barlow Condensed",system-ui'; x.textAlign="center"; x.lineJoin="round"; x.strokeStyle="#FFC62F"; x.lineWidth=7; x.strokeText("8",0,-18); x.fillStyle="#fff"; x.fillText("8",0,-18);
  // collar
  x.strokeStyle="#FFC62F"; x.lineWidth=5; x.beginPath(); x.moveTo(-34,-115); x.quadraticCurveTo(0,-100,34,-115); x.stroke(); x.strokeStyle="#fff"; x.lineWidth=2; x.beginPath(); x.moveTo(-34,-111); x.quadraticCurveTo(0,-96,34,-111); x.stroke();
  // neck + trapezius, shaded
  x.fillStyle=lg(-52,0,52,0,[[0,SKD],[0.28,SK],[0.5,SKL],[0.72,SK],[1,SKD]]);
  x.beginPath(); x.moveTo(-52,-108); x.quadraticCurveTo(-30,-114,-27,-132); x.lineTo(-26,-160); x.lineTo(26,-160); x.lineTo(27,-132); x.quadraticCurveTo(30,-114,52,-108); x.quadraticCurveTo(0,-98,-52,-108); x.fill();
  x.strokeStyle="rgba(120,70,45,.35)"; x.lineWidth=2; x.beginPath(); x.moveTo(-6,-156); x.quadraticCurveTo(-8,-134,-4,-112); x.moveTo(6,-156); x.quadraticCurveTo(8,-134,4,-112); x.stroke();
  // heat glow behind the chains
  if(heat){ const g=x.createRadialGradient(0,-122,4,0,-122,90+heat*40); g.addColorStop(0,`rgba(255,120,20,${0.25+heat*0.35})`); g.addColorStop(1,"rgba(255,80,0,0)"); x.fillStyle=g; x.beginPath(); x.arc(0,-122,130,0,7); x.fill(); }
  // the chain stack: first six climb the neck, the rest drape wider over the pads
  const shown=Math.min(n,16);
  for(let i=shown-1;i>=0;i--){ const st=CG_CHAINS[i%CG_CHAINS.length], up=i<6;
    const yy=up?-112-i*8:-112+(i-6)*2, half=up?30+i*0.8:40+(i-6)*9, sag=up?4:13+(i-6)*7;
    cgChain(x,st,yy,half,sag,heat,i); }
  // head from behind: ears, skull, short haircut with a faded neckline, headband with a knot
  for(const sd of [-1,1]){ x.fillStyle=SK; x.beginPath(); x.ellipse(sd*37,-190,8,15,sd*0.12,0,7); x.fill(); x.strokeStyle=SKD; x.lineWidth=2.2; x.beginPath(); x.ellipse(sd*37,-190,4.5,9.5,sd*0.12,sd>0?-1.3:1.8,sd>0?1.3:4.4); x.stroke(); }
  x.fillStyle=lg(-38,0,38,0,[[0,SKD],[0.5,SK],[1,SKD]]); x.beginPath(); x.ellipse(0,-192,37,44,0,0,7); x.fill();
  x.save(); x.beginPath(); x.ellipse(0,-192,37.5,44.5,0,0,7); x.clip();
  x.fillStyle=lg(0,-236,0,-156,[[0,"#24180f"],[0.7,"#2e2016"],[0.88,"rgba(46,32,22,.75)"],[1,"rgba(46,32,22,0)"]]);
  x.beginPath(); x.moveTo(-40,-240); x.lineTo(40,-240); x.lineTo(40,-180); x.quadraticCurveTo(30,-170,26,-162); x.quadraticCurveTo(0,-154,-26,-162); x.quadraticCurveTo(-30,-170,-40,-180); x.closePath(); x.fill();
  const hl=x.createRadialGradient(-10,-222,2,-10,-222,26); hl.addColorStop(0,"rgba(255,230,200,.16)"); hl.addColorStop(1,"rgba(255,230,200,0)"); x.fillStyle=hl; x.fillRect(-40,-240,80,50);
  x.strokeStyle="rgba(120,90,66,.35)"; x.lineWidth=1; for(let k=0;k<22;k++){ const ax=-30+k*2.9; x.beginPath(); x.moveTo(ax,-232+Math.abs(k-11)*0.8); x.lineTo(ax+1.5,-206+Math.abs(k-11)*0.5); x.stroke(); }
  x.fillStyle="#f4f4f6"; x.fillRect(-40,-222,80,13); x.fillStyle="#4F2683"; x.fillRect(-40,-217,80,3.5); x.restore();
  x.fillStyle="#e2e2e8"; x.beginPath(); x.ellipse(0,-215,6.5,5.5,0,0,7); x.fill(); x.beginPath(); x.moveTo(-3,-212); x.quadraticCurveTo(-7,-202,-6,-195); x.lineTo(-2,-196); x.quadraticCurveTo(-2,-204,1,-212); x.fill(); x.beginPath(); x.moveTo(2,-212); x.quadraticCurveTo(7,-204,8,-197); x.lineTo(12,-199); x.quadraticCurveTo(8,-206,5,-213); x.fill();
  // throwing arm: elbow up at shoulder height, forearm vertical, ball cocked by the ear
  if(!follow){ const ex=140+pull*0.5, ey=-130+pull*0.4, wx=128+pull*0.5, wy=-188+pull, bx=118+pull*0.5, by=-212+pull;
    x.strokeStyle=SKD; x.lineWidth=23; x.beginPath(); x.moveTo(ex,ey); x.lineTo(wx,wy); x.stroke(); x.strokeStyle=SK; x.lineWidth=15; x.beginPath(); x.moveTo(ex-3,ey-2); x.lineTo(wx-3,wy); x.stroke();
    x.strokeStyle="#4F2683"; x.lineWidth=36; x.beginPath(); x.moveTo(96,-104); x.lineTo(ex-12,ey+6); x.stroke();
    x.strokeStyle="#FFC62F"; x.lineWidth=4; x.lineCap="butt"; x.beginPath(); x.moveTo(ex-20,ey-10); x.lineTo(ex-10,ey+20); x.stroke(); x.lineCap="round";
    x.strokeStyle="#fff"; x.lineWidth=19; x.lineCap="butt"; x.beginPath(); x.moveTo(wx+0.5,wy+12); x.lineTo(wx,wy+2); x.stroke(); x.lineCap="round";
    if(CG.phase==="route"){ x.save(); x.translate(bx,by); x.rotate(-1.15); x.fillStyle="#7a3e1d"; x.beginPath(); x.ellipse(0,0,22,13.5,0,0,7); x.fill(); x.strokeStyle="rgba(0,0,0,.25)"; x.lineWidth=1.5; x.beginPath(); x.ellipse(0,0,22,13.5,0,0.2,2.6); x.stroke(); x.strokeStyle="#fff"; x.lineWidth=2.2; x.beginPath(); x.moveTo(-9,-4); x.lineTo(9,-4); x.stroke(); x.lineWidth=1.4; for(let k=-6;k<=6;k+=3){ x.beginPath(); x.moveTo(k,-6.5); x.lineTo(k,-1.5); x.stroke(); } x.restore(); }
    x.fillStyle=SK; x.beginPath(); x.ellipse(wx-2,wy-6,9,11,-0.2,0,7); x.fill();
    x.strokeStyle=SK; x.lineWidth=5.5; for(let f=0;f<4;f++){ x.beginPath(); x.moveTo(wx-6+f*3.4,wy-12); x.quadraticCurveTo(wx-12+f*3,wy-22-f, wx-18+f*4.5,wy-26-f*2); x.stroke(); }
    x.strokeStyle=SKD; x.lineWidth=1; for(let f=1;f<4;f++){ x.beginPath(); x.moveTo(wx-7.7+f*3.4,wy-12); x.quadraticCurveTo(wx-13.7+f*3,wy-22-f, wx-19.7+f*4.5,wy-26-f*2); x.stroke(); } }
  x.lineCap="butt";
  // fire: flames rising off the chains
  const last=CG.fxLast||now, dt=Math.min(0.05,(now-last)/1000); CG.fxLast=now; CG.fx=CG.fx||[];
  if(heat>=0.7){ const rate=heat>=1?46:26; let k=rate*dt+(Math.random()<(rate*dt)%1?1:0); while(k-->=1) CG.fx.push({x:(Math.random()-0.5)*(70+Math.min(n,16)*8),y:-106-Math.random()*36,vx:(Math.random()-0.5)*14,vy:-(40+Math.random()*50),life:0,max:0.5+Math.random()*0.5,r:5+Math.random()*7}); }
  x.globalCompositeOperation="lighter";
  CG.fx=CG.fx.filter(p=>(p.life+=dt)<p.max); CG.fx.forEach(p=>{ p.x+=p.vx*dt; p.y+=p.vy*dt; const f=p.life/p.max, r=p.r*(1-f*0.6);
    x.fillStyle=f<0.3?`rgba(255,220,110,${0.75-f})`:f<0.65?`rgba(255,130,25,${0.75-f})`:`rgba(210,45,10,${0.8-f})`;
    x.beginPath(); x.moveTo(p.x,p.y-r*2.2); x.quadraticCurveTo(p.x+r*0.9,p.y-r*0.4,p.x+r*0.7,p.y+r*0.3); x.arc(p.x,p.y+r*0.3,r*0.7,0,Math.PI); x.quadraticCurveTo(p.x-r*0.9,p.y-r*0.4,p.x,p.y-r*2.2); x.fill(); });
  x.globalCompositeOperation="source-over";
  // chain count badge
  if(n){ x.fillStyle=heat>=0.7?"rgba(120,30,0,.85)":"rgba(11,18,32,.8)"; x.beginPath(); x.roundRect?x.roundRect(-196,-150,70,32,16):x.rect(-196,-150,70,32); x.fill(); x.fillStyle=heat>=0.7?"#FFB347":"#FFD54A"; x.font='800 21px "Barlow Condensed",system-ui'; x.textAlign="center"; x.fillText("⛓ "+n,-161,-127); }
  if(flash){ x.globalAlpha=flash; x.fillStyle="#FFF3B0"; for(let k=0;k<10;k++){ const a=k/10*Math.PI*2+now/260; x.beginPath(); x.arc(Math.cos(a)*74,-130+Math.sin(a)*28,4,0,7); x.fill(); } x.globalAlpha=1; }
  x.restore();
}
/* ---------- Home card + keyboard ---------- */
const _renderHomeCG=renderHome;
renderHome=function(){ _renderHomeCG(); const el=$("v-home"); if(!S.meta||!el||el.querySelector(".cg-card")) return;
  const fg=el.querySelector(".fg-card"); const b=cgBest();
  const html=`<button class="card fg-card cg-card" data-chaingame="1"><span class="fg-ico">⛓️</span><span class="grow"><span class="lg-ft">Kirko Chainz</span><span class="t2">Hit your receiver, stack the chains, rack up Huddle Bucks.${b.bucks?` Best $${Number(b.bucks).toLocaleString()}`:""}</span></span><span class="tbtn">Play</span></button>`;
  if(fg) fg.insertAdjacentHTML("afterend",html); };
document.addEventListener("click",e=>{ if(e.target.closest("[data-chaingame]")) openChainGame(); });
document.addEventListener("keydown",e=>{ if(CG.on&&e.key==="Escape") closeChainGame(); if(CG.on&&CG.phase==="over"&&(e.key==="Enter"||e.key===" ")){ e.preventDefault(); cgStart(); } });
