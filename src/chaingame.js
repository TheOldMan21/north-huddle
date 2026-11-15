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
const CG_HELP="Swipe up toward your receiver to throw. Longer swipe = deeper ball.";
function openChainGame(){
  let ov=$("cgGame");
  if(!ov){
    ov=document.createElement("div"); ov.id="cgGame"; ov.setAttribute("role","dialog"); ov.setAttribute("aria-label","Kirko Chainz");
    ov.innerHTML=`<div class="fg-top cg-top"><div class="fg-stat"><span class="label">Chains</span><b id="cgChains" class="num">0</b></div><div class="fg-stat"><span class="label">Huddle Bucks</span><b id="cgBucks" class="num">$0</b></div><div class="fg-stat"><span class="label">Strikes</span><b id="cgStrikes" class="num"></b></div><button class="x" id="cgClose" aria-label="Close game">×</button></div>
      <div class="fg-stage"><canvas id="cgCanvas"></canvas><div class="fg-msg" id="cgMsg"></div></div>
      <div class="fg-help" id="cgHelp">${CG_HELP}</div>`;
    document.body.appendChild(ov);
    $("cgClose").addEventListener("click",closeChainGame);
    const cv=$("cgCanvas"), pt=e=>{ const r=cv.getBoundingClientRect(); return [e.clientX-r.left,e.clientY-r.top,performance.now()]; };
    cv.addEventListener("pointerdown",e=>{ e.preventDefault(); if(CG.phase!=="route") return; try{ cv.setPointerCapture(e.pointerId); }catch(err){} const q=pt(e); CG.drag={x0:q[0],y0:q[1],x:q[0],y:q[1],hist:[q]}; });
    cv.addEventListener("pointermove",e=>{ if(!CG.drag) return; e.preventDefault(); const q=pt(e); Object.assign(CG.drag,{x:q[0],y:q[1]}); CG.drag.hist.push(q); if(CG.drag.hist.length>8) CG.drag.hist.shift(); });
    const up=e=>{ if(!CG.drag) return; const q=pt(e); Object.assign(CG.drag,{x:q[0],y:q[1]}); CG.drag.hist.push(q); cgRelease(); };
    cv.addEventListener("pointerup",up); cv.addEventListener("pointercancel",()=>{ CG.drag=null; });
    ov.addEventListener("click",e=>{ if(e.target.closest("[data-cgagain]")) cgStart(); });
  }
  ov.hidden=false; document.body.style.overflow="hidden"; CG.on=true; cgResize(); cgStart();
  window.addEventListener("resize",cgResize);
}
function closeChainGame(){ CG.on=false; CG.drag=null; cancelAnimationFrame(CG.raf); const ov=$("cgGame"); if(ov) ov.hidden=true; document.body.style.overflow=""; window.removeEventListener("resize",cgResize); }
function cgResize(){ const c=$("cgCanvas"); if(!c) return; const st=c.parentElement.getBoundingClientRect(), dpr=Math.min(2,window.devicePixelRatio||1); c.width=st.width*dpr; c.height=st.height*dpr; c.style.width=st.width+"px"; c.style.height=st.height+"px"; CG.w=st.width; CG.h=st.height; CG.dpr=dpr; cgCam(); }
function cgStart(){ Object.assign(CG,{chains:0, bucks:0, strikes:0, comps:0, longest:0, phase:"set", t:0, ball:null, wr:null, cb:null, sf:null, flash:null, drag:null, thrown:0}); $("cgMsg").innerHTML=""; $("cgHelp").textContent=CG_HELP; cgHud(); cgSnap(); cancelAnimationFrame(CG.raf); CG.last=performance.now(); CG.raf=requestAnimationFrame(cgLoop); }
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
function cgHand(){ const W=CG.w, H=CG.h, s=cgQBs(); return [W/2+58*s, H-150*s+(CG.drag?10*s:0)]; }
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
  CG.ball={x0:0.5,y0:CG_QBY,tx:a.tx,ty:a.ty,t:0,T:(0.3+dist/23)*zip,dist,zip:zip<1};
  CG.phase="air"; CG.thrown=performance.now();
}
function cgSnap(){
  const names=Object.keys(CG_ROUTES), name=names[(Math.random()*names.length)|0];
  const side=Math.random()<0.5?-1:1, startX=side*(5+Math.random()*4);
  const pts=CG_ROUTES[name].map(([x,y])=>[startX+x*-side, y]);
  pts.forEach(p=>{ p[0]=Math.max(-16,Math.min(16,p[0])); });
  const lvl=CG.comps;
  CG.wr={pts, seg:0, x:pts[0][0], y:0, speed:7.2+Math.random()*0.8, route:name, done:false};
  CG.cb={x:startX+side*-1.2, y:5+Math.random()*2, speed:6.3+Math.min(1.6,lvl*0.08), react:Math.max(0.12,0.45-lvl*0.02), lag:[]};
  CG.sf={x:-side*4, y:17+Math.random()*4, speed:5.4+Math.min(1.2,lvl*0.06)};
  CG.phase="route"; CG.t=0; CG.ball=null; CG.drag=null; CG.pocket=4.4-Math.min(1.4,lvl*0.05);
}
function cgMove(ent,tx,ty,spd,dt){ const dx=tx-ent.x, dy=ty-ent.y, d=Math.hypot(dx,dy); if(d<1e-3) return true; const s=Math.min(d,spd*dt); ent.x+=dx/d*s; ent.y+=dy/d*s; return s>=d-1e-3; }
function cgLoop(now){
  if(!CG.on) return;
  const dt=Math.min(0.05,(now-CG.last)/1000); CG.last=now;
  if(CG.phase==="route"||CG.phase==="air"){
    CG.t+=dt;
    const w=CG.wr; if(!w.done){ const tgt=w.pts[w.seg+1]; if(tgt){ if(cgMove(w,tgt[0],tgt[1],w.speed,dt)) w.seg++; } else {
        const a=w.pts[w.pts.length-2], b=w.pts[w.pts.length-1], dx=b[0]-a[0], dy=b[1]-a[1], d=Math.hypot(dx,dy)||1; w.x+=dx/d*w.speed*dt*0.85; w.y+=dy/d*w.speed*dt*0.85; w.x=Math.max(-25,Math.min(25,w.x)); } }
    const c=CG.cb; c.lag.push([CG.t,w.x,w.y]); while(c.lag.length&&c.lag[0][0]<CG.t-c.react) c.lag.shift(); const aim=c.lag[0]||[0,w.x,w.y];
    cgMove(c,aim[1]+(c.x<w.x?-0.6:0.6),aim[2]+0.4,c.speed,dt);
    // the safety sits deep, then breaks on the ball (or on a receiver who gets behind him)
    const f=CG.sf, tgtS=CG.ball?[CG.ball.tx,CG.ball.ty]:w.y>f.y-6?[w.x,w.y+3]:[f.x*0.97,f.y]; cgMove(f,tgtS[0],tgtS[1],CG.ball?f.speed*1.05:f.speed*0.6,dt);
    if(CG.phase==="route"&&CG.t>CG.pocket){ CG.drag=null; cgResult("sack"); }
  }
  if(CG.phase==="air"){ const b=CG.ball; b.t+=dt; if(b.t>=b.T){ cgCatch(); } }
  cgDraw(); CG.raf=requestAnimationFrame(cgLoop);
}
function cgCatch(){
  const b=CG.ball, w=CG.wr;
  const dw=Math.hypot(w.x-b.tx,w.y-b.ty), dd=[CG.cb,CG.sf].map(d=>Math.hypot(d.x-b.tx,d.y-b.ty)), dc=Math.min(...dd);
  if(dc<1.3&&dc<dw) return cgResult(dc<0.8&&Math.random()<0.55?"pick":"broken");
  if(dw<1.9) return cgResult("catch",Math.max(1,Math.round(b.ty)));
  cgResult("incomplete");
}
function cgResult(kind,yds){
  CG.phase="result"; CG.res=kind; let html;
  if(kind==="catch"){
    CG.comps++; CG.chains++; const bucks=yds*5+Math.max(0,yds-15)*10+Math.max(0,yds-30)*15; CG.bucks+=bucks; CG.longest=Math.max(CG.longest,yds);
    html=`<b>COMPLETE!</b><span>${yds} yards · +$${bucks} · new chain ⛓️</span>`; cgSound(true);
    CG.flash={t:performance.now()};
  } else {
    CG.strikes++; cgSound(false);
    html=`<b class="miss">${kind==="pick"?"PICKED OFF!":kind==="broken"?"BROKEN UP!":kind==="sack"?"SACKED!":"INCOMPLETE"}</b><span>${kind==="sack"?"Get it out faster!":"Strike "+CG.strikes+" of 3"}</span>`;
  }
  cgHud(); $("cgMsg").innerHTML=`<div class="fg-pop">${html}</div>`;
  setTimeout(()=>{ if(!CG.on) return; $("cgMsg").innerHTML=""; if(CG.strikes>=3) cgOver(); else cgSnap(); },1300);
}
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
    men.push({X:CG.wr.x,Y:CG.wr.y,c:OFF,face:"back",num:18,ph:live?run*12:0,wr:1}); }
  men.sort((a,b)=>b.Y-a.Y).forEach(m=>cgMan(x,m));
  // aim preview while swiping
  if(CG.drag&&CG.phase==="route"){ const a=cgAim(CG.drag);
    if(a){ const [hx,hy]=cgHand(); x.setLineDash([3,6]); x.strokeStyle="rgba(255,255,255,.85)"; x.lineWidth=2.5; x.beginPath(); x.moveTo(hx,hy);
      for(let i=1;i<=24;i++){ const k=i/24, bx=0.5+(a.tx-0.5)*k, by=CG_QBY+(a.ty-CG_QBY)*k, z=2.2+(1.3-2.2)*k+Math.sin(Math.PI*k)*Math.min(11,a.yds/3.6), q=cgP(bx,by,z), m=Math.min(1,k*4); x.lineTo(hx+(q[0]-hx)*m,hy+(q[1]-hy)*m); } x.stroke(); x.setLineDash([]);
      const [tx,ty,ts]=cgP(a.tx,a.ty); x.strokeStyle="#5EF2D6"; x.lineWidth=3; x.beginPath(); x.ellipse(tx,ty,1.9*ts,0.7*ts,0,0,7); x.stroke();
      x.fillStyle="#fff"; x.font='800 14px "Barlow Condensed",system-ui'; x.textAlign="center"; x.fillText(Math.round(a.ty)+" YDS",tx,ty-1.2*ts-4); } }
  // ball in the air
  if(CG.ball){ const b=CG.ball, k=Math.min(1,b.t/b.T), bx=b.x0+(b.tx-b.x0)*k, by=b.y0+(b.ty-b.y0)*k, z=2.2+(1.3-2.2)*k+Math.sin(Math.PI*k)*Math.min(b.zip?7:11,b.dist/(b.zip?5:3.6));
    const [tx,ty,ts]=cgP(b.tx,b.ty); x.strokeStyle="rgba(255,255,255,.5)"; x.lineWidth=2; x.beginPath(); x.ellipse(tx,ty,1.6*ts,0.6*ts,0,0,7); x.stroke();
    const [sx,sy,ss]=cgP(bx,by); x.fillStyle="rgba(0,0,0,.3)"; x.beginPath(); x.ellipse(sx,sy,0.3*ss+1,0.12*ss+1,0,0,7); x.fill();
    let [px,py,ps]=cgP(bx,by,z); const [hx,hy]=cgHand(), m=Math.min(1,k*5); px=hx+(px-hx)*m; py=hy+(py-hy)*m; const r=Math.max(4,Math.min(16,0.32*ps*(1+(1-m)*1.5)));
    x.save(); x.translate(px,py); x.rotate(-0.5+k*0.3+performance.now()/90%6.28*0.02); x.fillStyle="#7a3e1d"; x.beginPath(); x.ellipse(0,0,r,r*0.62,0,0,7); x.fill(); x.strokeStyle="#fff"; x.lineWidth=Math.max(1,r*0.12); x.beginPath(); x.moveTo(-r*0.35,0); x.lineTo(r*0.35,0); x.stroke(); x.restore(); }
  // pocket clock
  if(CG.phase==="route"){ const left=Math.max(0,CG.pocket-CG.t), f=left/CG.pocket; x.fillStyle="rgba(0,0,0,.45)"; x.fillRect(W-112,12,100,10); x.fillStyle=f>0.4?"#5EF2D6":f>0.2?"#FFC62F":"#ff5a4f"; x.fillRect(W-112,12,100*f,10); x.fillStyle="#fff"; x.font='700 11px "Barlow Condensed",system-ui'; x.textAlign="right"; x.fillText("POCKET",W-12,36); }
  if(CG.wr){ x.fillStyle="rgba(255,255,255,.8)"; x.font='700 13px "Barlow Condensed",system-ui'; x.textAlign="left"; x.fillText(CG.wr.route.toUpperCase()+" ROUTE",12,22); }
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
  x.strokeStyle=c.j; x.lineWidth=Math.max(1.5,0.17*s); x.beginPath(); x.moveTo(px-0.33*s,Y(1.5)); x.lineTo(px-0.4*s-sw*0.5,Y(1.0)); x.moveTo(px+0.33*s,Y(1.5)); x.lineTo(px+0.4*s+sw*0.5,Y(1.0)); x.stroke(); x.lineCap="butt";
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
// our QB from just above and behind: head, headband, a growing stack of gold chains, #8 on the back, throwing arm
function cgQB(x,W,H){
  const s=cgQBs(), n=CG.chains, cx=W/2, base=H+8;
  const flash=CG.flash&&performance.now()-CG.flash.t<700?1-(performance.now()-CG.flash.t)/700:0;
  const since=CG.thrown?(performance.now()-CG.thrown)/1000:9, follow=CG.phase!=="route"&&since<0.9;
  x.save(); x.translate(cx,base); x.scale(s,s);
  // shoulder pads + jersey back
  x.fillStyle="#4F2683"; x.beginPath(); x.moveTo(-118,0); x.quadraticCurveTo(-126,-92,-60,-108); x.lineTo(60,-108); x.quadraticCurveTo(126,-92,118,0); x.closePath(); x.fill();
  x.strokeStyle="rgba(0,0,0,.25)"; x.lineWidth=3; x.beginPath(); x.moveTo(-58,-104); x.quadraticCurveTo(-40,-70,-46,0); x.moveTo(58,-104); x.quadraticCurveTo(40,-70,46,0); x.stroke();
  x.fillStyle="#FFC62F"; x.fillRect(-120,-78,22,8); x.fillRect(98,-78,22,8);
  x.fillStyle="#FFC62F"; x.font='800 64px "Barlow Condensed",system-ui'; x.textAlign="center"; x.fillText("8",0,-14);
  x.strokeStyle="#FFC62F"; x.lineWidth=3; x.beginPath(); x.moveTo(-60,-108); x.lineTo(60,-108); x.stroke();
  // neck
  x.fillStyle="#d8a986"; x.fillRect(-22,-138,44,34);
  // chains stack up the neck (back half of each loop), the newest on top; big ones drape over the pads
  const shown=Math.min(n,14);
  for(let i=0;i<shown;i++){ const big=(i+1)%5===0, yy=-106-i*(i<6?5:3.2), half=24+(i<6?i*1.2:7+(i-6)*5), sag=i<6?6:9+(i-6)*2.2, links=10+i*2, lr=big?4.2:3;
    for(let k=0;k<=links;k++){ const t=k/links, lx=-half+2*half*t, ly=yy+Math.sin(Math.PI*t)*sag;
      x.save(); x.translate(lx,ly); x.rotate(k%2?Math.PI/2:0.2); x.strokeStyle=k%2?"#FFE27A":"#D99A00"; x.lineWidth=big?2.8:2.1; x.beginPath(); x.ellipse(0,0,lr*1.3,lr*0.8,0,0,7); x.stroke(); x.restore(); }
    if(big){ x.fillStyle="#FFD54A"; x.fillRect(-4,yy+sag-3,8,6); } }
  // head from behind: hair, headband with tails
  x.fillStyle="#d8a986"; x.beginPath(); x.ellipse(-36,-170,6,10,0,0,7); x.ellipse(36,-170,6,10,0,0,7); x.fill();
  x.fillStyle="#3b2a20"; x.beginPath(); x.ellipse(0,-172,36,40,0,0,7); x.fill();
  x.fillStyle="#4a3528"; x.beginPath(); x.ellipse(-6,-186,22,16,-0.3,0,7); x.fill();
  x.fillStyle="#fff"; x.fillRect(-37,-192,74,12); x.fillStyle="#4F2683"; x.fillRect(-37,-188,74,3);
  x.fillStyle="#fff"; x.beginPath(); x.moveTo(-4,-186); x.lineTo(-14,-150); x.lineTo(-6,-150); x.lineTo(2,-184); x.fill(); x.beginPath(); x.moveTo(4,-186); x.lineTo(16,-156); x.lineTo(22,-160); x.lineTo(8,-186); x.fill();
  // throwing arm (right): cocked with the ball, extended after the throw
  x.lineCap="round";
  if(follow){ x.strokeStyle="#4F2683"; x.lineWidth=30; x.beginPath(); x.moveTo(84,-96); x.lineTo(70,-190); x.stroke(); x.fillStyle="#d8a986"; x.beginPath(); x.arc(68,-206,14,0,7); x.fill(); }
  else { const pull=CG.drag?14:0; x.strokeStyle="#4F2683"; x.lineWidth=30; x.beginPath(); x.moveTo(86,-96); x.lineTo(98+pull*0.4,-150+pull*0.3); x.stroke(); x.strokeStyle="#d8a986"; x.lineWidth=22; x.beginPath(); x.moveTo(98+pull*0.4,-150+pull*0.3); x.lineTo(64,-150+pull); x.stroke();
    if(CG.phase==="route"){ x.save(); x.translate(58,-158+pull); x.rotate(-0.6); x.fillStyle="#7a3e1d"; x.beginPath(); x.ellipse(0,0,20,12,0,0,7); x.fill(); x.strokeStyle="#fff"; x.lineWidth=2; x.beginPath(); x.moveTo(-7,0); x.lineTo(7,0); x.stroke(); x.restore(); } }
  x.lineCap="butt";
  // chain count badge
  if(n){ x.fillStyle="rgba(11,18,32,.75)"; x.beginPath(); x.roundRect?x.roundRect(-150,-150,62,30,15):x.rect(-150,-150,62,30); x.fill(); x.fillStyle="#FFD54A"; x.font='800 20px "Barlow Condensed",system-ui'; x.textAlign="center"; x.fillText("⛓ "+n,-119,-128); }
  if(flash){ x.globalAlpha=flash; x.fillStyle="#FFF3B0"; for(let k=0;k<10;k++){ const a=k/10*Math.PI*2+performance.now()/260; x.beginPath(); x.arc(Math.cos(a)*70,-125+Math.sin(a)*26,4,0,7); x.fill(); } x.globalAlpha=1; }
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
