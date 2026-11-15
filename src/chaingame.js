/* ===================== North Huddle: Chain Gang (QB throwing game) ===================== */
// You're the QB. Your receiver runs a route; tap where you want the ball to land and lead him.
// Every completion adds a gold chain around your QB's neck, and deeper throws earn more Huddle Bucks.
// 3 strikes (incomplete, pick, or sack) and the drive is over.
const CG={on:false, raf:0};
// route points in yards: x = toward the middle of the field (+) or the sideline (−), y = downfield
const CG_ROUTES={
  slant:[[0,0],[0,4],[7,11],[16,19]],
  out:[[0,0],[0,10],[-9,10],[-16,10]],
  go:[[0,0],[-1,14],[-2,40]],
  post:[[0,0],[0,12],[8,26],[14,36]],
  corner:[[0,0],[0,12],[-9,24],[-13,32]],
  curl:[[0,0],[0,13],[1.5,10.5]],
  wheel:[[0,0],[-4,2],[-7,8],[-7,36]],
  dig:[[0,0],[0,14],[14,14],[22,14]]
};
function cgBest(){ try{ return JSON.parse(localStorage.getItem("nh_cgbest")||"{}"); }catch(e){ return {}; } }
function openChainGame(){
  let ov=$("cgGame");
  if(!ov){
    ov=document.createElement("div"); ov.id="cgGame"; ov.setAttribute("role","dialog"); ov.setAttribute("aria-label","Kirko Chainz");
    ov.innerHTML=`<div class="fg-top cg-top"><div class="fg-stat"><span class="label">Chains</span><b id="cgChains" class="num">0</b></div><div class="fg-stat"><span class="label">Huddle Bucks</span><b id="cgBucks" class="num">$0</b></div><div class="fg-stat"><span class="label">Strikes</span><b id="cgStrikes" class="num"></b></div><button class="x" id="cgClose" aria-label="Close game">×</button></div>
      <div class="fg-stage"><canvas id="cgCanvas"></canvas><div class="fg-msg" id="cgMsg"></div></div>
      <div class="fg-help" id="cgHelp">Tap where you want to throw. Lead your receiver!</div>`;
    document.body.appendChild(ov);
    $("cgClose").addEventListener("click",closeChainGame);
    $("cgCanvas").addEventListener("pointerdown",e=>{ e.preventDefault(); const r=e.target.getBoundingClientRect(); cgTap(e.clientX-r.left,e.clientY-r.top); });
    ov.addEventListener("click",e=>{ if(e.target.closest("[data-cgagain]")) cgStart(); });
  }
  ov.hidden=false; document.body.style.overflow="hidden"; CG.on=true; cgResize(); cgStart();
  window.addEventListener("resize",cgResize);
}
function closeChainGame(){ CG.on=false; cancelAnimationFrame(CG.raf); const ov=$("cgGame"); if(ov) ov.hidden=true; document.body.style.overflow=""; window.removeEventListener("resize",cgResize); }
function cgResize(){ const c=$("cgCanvas"); if(!c) return; const st=c.parentElement.getBoundingClientRect(), dpr=Math.min(2,window.devicePixelRatio||1); c.width=st.width*dpr; c.height=st.height*dpr; c.style.width=st.width+"px"; c.style.height=st.height+"px"; CG.w=st.width; CG.h=st.height; CG.dpr=dpr; }
function cgStart(){ Object.assign(CG,{chains:0, bucks:0, strikes:0, comps:0, longest:0, phase:"set", t:0, ball:null, wr:null, cb:null, flash:null}); $("cgMsg").innerHTML=""; $("cgHelp").textContent="Tap where you want to throw. Lead your receiver!"; cgHud(); cgSnap(); cancelAnimationFrame(CG.raf); CG.last=performance.now(); CG.raf=requestAnimationFrame(cgLoop); }
function cgHud(){ $("cgChains").textContent=CG.chains; $("cgBucks").textContent="$"+CG.bucks.toLocaleString(); $("cgStrikes").textContent="✕".repeat(CG.strikes)+"·".repeat(Math.max(0,3-CG.strikes)); }
// yards → pixels. x: −26.7..26.7 across the screen; y: yards past the line of scrimmage (LOS sits low on screen)
function cgPx(x,y){ const W=CG.w, H=CG.h, ypp=H/52; return [W/2+x*(W/53.3), H*0.76-y*ypp]; }
function cgYd(px,py){ const W=CG.w, H=CG.h, ypp=H/52; return [(px-W/2)/(W/53.3), (H*0.76-py)/ypp]; }
function cgSnap(){
  const names=Object.keys(CG_ROUTES), name=names[(Math.random()*names.length)|0];
  const side=Math.random()<0.5?-1:1, startX=side*(8+Math.random()*10);
  const pts=CG_ROUTES[name].map(([x,y])=>[startX+x*-side, y]);
  // keep routes on the field
  pts.forEach(p=>{ p[0]=Math.max(-24,Math.min(24,p[0])); });
  const lvl=CG.comps;
  CG.wr={pts, seg:0, x:pts[0][0], y:0, speed:7.2+Math.random()*0.8, route:name, done:false};
  CG.cb={x:startX+side*-1.2, y:5+Math.random()*2, speed:6.3+Math.min(1.6,lvl*0.08), react:Math.max(0.12,0.45-lvl*0.02), lag:[]};
  CG.phase="route"; CG.t=0; CG.ball=null; CG.pocket=4.2-Math.min(1.4,lvl*0.05);
}
function cgTap(px,py){
  if(CG.phase!=="route") return;
  const [tx,ty]=cgYd(px,py); if(ty<1) return;
  const qb=[0,-6], dist=Math.hypot(tx-qb[0],ty-qb[1]);
  CG.ball={x0:qb[0],y0:qb[1],tx,ty,t:0,T:0.25+dist/24,dist};
  CG.phase="air";
}
function cgMove(ent,tx,ty,spd,dt){ const dx=tx-ent.x, dy=ty-ent.y, d=Math.hypot(dx,dy); if(d<1e-3) return true; const s=Math.min(d,spd*dt); ent.x+=dx/d*s; ent.y+=dy/d*s; return s>=d-1e-3; }
function cgLoop(now){
  if(!CG.on) return;
  const dt=Math.min(0.05,(now-CG.last)/1000); CG.last=now;
  if(CG.phase==="route"||CG.phase==="air"){
    CG.t+=dt;
    const w=CG.wr; if(!w.done){ const tgt=w.pts[w.seg+1]; if(tgt){ if(cgMove(w,tgt[0],tgt[1],w.speed,dt)) w.seg++; } else { // keep running the last direction
        const a=w.pts[w.pts.length-2], b=w.pts[w.pts.length-1], dx=b[0]-a[0], dy=b[1]-a[1], d=Math.hypot(dx,dy)||1; w.x+=dx/d*w.speed*dt*0.85; w.y+=dy/d*w.speed*dt*0.85; w.x=Math.max(-26,Math.min(26,w.x)); } }
    // corner trails where the receiver was a moment ago
    const c=CG.cb; c.lag.push([CG.t,w.x,w.y]); while(c.lag.length&&c.lag[0][0]<CG.t-c.react) c.lag.shift(); const aim=c.lag[0]||[0,w.x,w.y];
    cgMove(c,aim[1]+(c.x<w.x?-0.6:0.6),aim[2]+0.4,c.speed,dt);
    if(CG.phase==="route"&&CG.t>CG.pocket){ cgResult("sack"); }
  }
  if(CG.phase==="air"){ const b=CG.ball; b.t+=dt; if(b.t>=b.T){ cgCatch(); } }
  cgDraw(); CG.raf=requestAnimationFrame(cgLoop);
}
function cgCatch(){
  const b=CG.ball, w=CG.wr, c=CG.cb;
  const dw=Math.hypot(w.x-b.tx,w.y-b.ty), dc=Math.hypot(c.x-b.tx,c.y-b.ty);
  if(dc<1.3&&dc<dw) return cgResult(dc<0.8&&Math.random()<0.55?"pick":"broken");
  if(dw<1.9) return cgResult("catch",Math.max(1,Math.round(b.ty)));
  cgResult("incomplete");
}
function cgResult(kind,yds){
  CG.phase="result"; let html;
  if(kind==="catch"){
    CG.comps++; CG.chains++; const bucks=yds*5+Math.max(0,yds-15)*10+Math.max(0,yds-30)*15; CG.bucks+=bucks; CG.longest=Math.max(CG.longest,yds);
    html=`<b>COMPLETE!</b><span>${yds} yards · +$${bucks} · new chain ⛓️</span>`; cgSound(true);
    CG.flash={t:performance.now()};
  } else {
    CG.strikes++; cgSound(false);
    html=`<b class="miss">${kind==="pick"?"PICKED OFF!":kind==="broken"?"BROKEN UP!":kind==="sack"?"SACKED!":"INCOMPLETE"}</b><span>${kind==="sack"?"Get it out faster!":"Strike "+CG.strikes+" of 3"}</span>`;
  }
  cgHud(); $("cgMsg").innerHTML=`<div class="fg-pop">${html}</div>`;
  setTimeout(()=>{ if(!CG.on) return; $("cgMsg").innerHTML=""; if(CG.strikes>=3) cgOver(); else cgSnap(); },1200);
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
function cgDraw(){
  const c=$("cgCanvas"); if(!c) return; const x=c.getContext("2d"), W=CG.w, H=CG.h; x.setTransform(CG.dpr,0,0,CG.dpr,0,0);
  // turf with stripes
  for(let i=0;i<14;i++){ x.fillStyle=i%2?"#2f7d3b":"#2a7235"; const [,y0]=cgPx(0,-10+i*5), [,y1]=cgPx(0,-5+i*5); x.fillRect(0,y1,W,y0-y1+1); }
  x.strokeStyle="rgba(255,255,255,.55)"; x.lineWidth=2; for(let yd=-10; yd<=45; yd+=5){ const [,yy]=cgPx(0,yd); x.beginPath(); x.moveTo(0,yy); x.lineTo(W,yy); x.stroke(); }
  x.strokeStyle="rgba(255,255,255,.6)"; x.lineWidth=1.5; for(let yd=-10; yd<=45; yd++){ if(yd%5===0) continue; const [,yy]=cgPx(0,yd); for(const hx of [-3.1,3.1]){ const [xx]=cgPx(hx,0); x.beginPath(); x.moveTo(xx-4,yy); x.lineTo(xx+4,yy); x.stroke(); } }
  const [,los]=cgPx(0,0); x.strokeStyle="#3b82f6"; x.lineWidth=3; x.beginPath(); x.moveTo(0,los); x.lineTo(W,los); x.stroke();
  // offensive line + QB pocket
  for(let i=-2;i<=2;i++){ const [px,py]=cgPx(i*1.6,-0.8); cgPlayer(x,px,py,10,"#4F2683","#FFC62F",""); }
  for(let i=-1;i<=1;i++){ const [px,py]=cgPx(i*2.2,0.9); cgPlayer(x,px,py,10,"#C8102E","#fff",""); }
  // route preview (faint) + receiver + corner
  if(CG.wr){ x.setLineDash([4,6]); x.strokeStyle="rgba(255,255,255,.28)"; x.lineWidth=2; x.beginPath(); CG.wr.pts.forEach((p,i)=>{ const [px,py]=cgPx(p[0],p[1]); i?x.lineTo(px,py):x.moveTo(px,py); }); x.stroke(); x.setLineDash([]);
    const [cx,cy]=cgPx(CG.cb.x,CG.cb.y); cgPlayer(x,cx,cy,12,"#C8102E","#fff","CB");
    const [wx,wy]=cgPx(CG.wr.x,CG.wr.y); cgPlayer(x,wx,wy,13,"#4F2683","#FFC62F","WR");
    x.fillStyle="rgba(255,255,255,.75)"; x.font='700 13px "Barlow Condensed",system-ui'; x.textAlign="left"; x.fillText(CG.wr.route.toUpperCase()+" ROUTE",12,22); }
  // pocket clock
  if(CG.phase==="route"){ const left=Math.max(0,CG.pocket-CG.t), f=left/CG.pocket; x.fillStyle="rgba(0,0,0,.4)"; x.fillRect(W-112,12,100,10); x.fillStyle=f>0.4?"#5EF2D6":f>0.2?"#FFC62F":"#ff5a4f"; x.fillRect(W-112,12,100*f,10); x.fillStyle="#fff"; x.font='700 11px "Barlow Condensed",system-ui'; x.textAlign="right"; x.fillText("POCKET",W-12,36); }
  // ball in the air
  if(CG.ball){ const b=CG.ball, k=Math.min(1,b.t/b.T), bx=b.x0+(b.tx-b.x0)*k, by=b.y0+(b.ty-b.y0)*k, arc=Math.sin(Math.PI*k)*Math.min(5,b.dist/7);
    const [tx,ty]=cgPx(b.tx,b.ty); x.strokeStyle="rgba(255,255,255,.7)"; x.lineWidth=2; x.beginPath(); x.arc(tx,ty,9,0,7); x.stroke();
    const [sx,sy]=cgPx(bx,by); x.fillStyle="rgba(0,0,0,.3)"; x.beginPath(); x.ellipse(sx,sy,6,3,0,0,7); x.fill();
    const [px,py]=cgPx(bx,by+arc); x.save(); x.translate(px,py); x.rotate(-Math.PI/2+k*0.4); x.fillStyle="#7a3e1d"; x.beginPath(); x.ellipse(0,0,8+arc*0.5,5+arc*0.3,0,0,7); x.fill(); x.strokeStyle="#fff"; x.lineWidth=1.2; x.beginPath(); x.moveTo(-3,0); x.lineTo(3,0); x.stroke(); x.restore(); }
  cgQB(x,W,H);
}
function cgPlayer(x,px,py,r,c1,c2,lab){ x.fillStyle="rgba(0,0,0,.3)"; x.beginPath(); x.ellipse(px,py+r*0.8,r*0.9,r*0.35,0,0,7); x.fill(); x.fillStyle=c1; x.beginPath(); x.arc(px,py,r,0,7); x.fill(); x.lineWidth=2.5; x.strokeStyle=c2; x.stroke(); if(lab){ x.fillStyle="#fff"; x.font=`800 ${r*0.85}px "Barlow Condensed",system-ui`; x.textAlign="center"; x.textBaseline="middle"; x.fillText(lab,px,py+1); x.textBaseline="alphabetic"; } }
// our QB: an original cartoon passer at the bottom of the screen who piles on gold chains
function cgQB(x,W,H){
  const s=Math.min(0.95,Math.max(0.62,W/560)), cx=70*s+8, base=H+4, n=CG.chains;
  const flash=CG.flash&&performance.now()-CG.flash.t<600?1-(performance.now()-CG.flash.t)/600:0;
  x.save(); x.translate(cx,base); x.scale(s,s);
  // shoulders / jersey
  x.fillStyle="#4F2683"; x.beginPath(); x.moveTo(-70,0); x.quadraticCurveTo(-68,-62,-24,-70); x.lineTo(24,-70); x.quadraticCurveTo(68,-62,70,0); x.closePath(); x.fill();
  x.strokeStyle="#FFC62F"; x.lineWidth=3; x.stroke();
  x.fillStyle="#FFC62F"; x.font='800 30px "Barlow Condensed",system-ui'; x.textAlign="center"; x.fillText("8",0,-22);
  // neck + head
  x.fillStyle="#e2b48f"; x.fillRect(-11,-86,22,20);
  x.beginPath(); x.ellipse(0,-108,23,27,0,0,7); x.fill();
  x.fillStyle="#3b2a20"; x.beginPath(); x.ellipse(0,-126,24,12,0,Math.PI,0); x.fill();               // hair
  x.fillStyle="#fff"; x.fillRect(-24,-122,48,7); x.fillStyle="#4F2683"; x.fillRect(-24,-120,48,2);     // headband
  x.fillStyle="#1b1324"; x.beginPath(); x.arc(-8,-108,2.6,0,7); x.arc(8,-108,2.6,0,7); x.fill();        // eyes
  x.strokeStyle="#1b1324"; x.lineWidth=2.4; x.beginPath(); x.arc(0,-98,8,0.15*Math.PI,0.85*Math.PI); x.stroke(); // grin
  x.fillStyle="#2a1c14"; x.fillRect(-12,-114,9,2.5); x.fillRect(3,-114,9,2.5);                          // brows
  // gold chains: one per completion, each a row of links hanging a little lower on the chest
  const shown=Math.min(n,12);
  for(let i=0;i<shown;i++){ const big=(i+1)%5===0, drop=8+i*5.2, half=20+i*3.4, links=12+i*2, lr=big?3.4:2.6;
    for(let k=0;k<=links;k++){ const t=k/links, ang=Math.PI*(0.08+0.84*t), lx=-Math.cos(ang)*half, ly=-74+Math.sin(ang)*drop;
      x.save(); x.translate(lx,ly); x.rotate(ang+(k%2?Math.PI/2:0)); x.strokeStyle=k%2?"#FFE27A":"#E8A800"; x.lineWidth=big?2.4:1.8; x.beginPath(); x.ellipse(0,0,lr*1.3,lr*0.8,0,0,7); x.stroke(); x.restore(); }
    if(big){ const py=-74+drop+5; x.fillStyle="#FFD54A"; x.beginPath(); x.arc(0,py,7,0,7); x.fill(); x.strokeStyle="#B88400"; x.lineWidth=1.5; x.stroke(); x.fillStyle="#4F2683"; x.font='800 10px "Barlow Condensed",system-ui'; x.textAlign="center"; x.fillText("$",0,py+3.5); } }
  if(n>12){ x.fillStyle="#FFD54A"; x.font='800 18px "Barlow Condensed",system-ui'; x.textAlign="left"; x.fillText("×"+n,48,-30); }
  if(flash){ x.globalAlpha=flash; x.fillStyle="#FFF3B0"; for(let k=0;k<8;k++){ const a=k/8*Math.PI*2+performance.now()/300; x.beginPath(); x.arc(Math.cos(a)*48,-80+Math.sin(a)*20,3,0,7); x.fill(); } x.globalAlpha=1; }
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
