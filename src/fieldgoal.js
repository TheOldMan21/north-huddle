/* ===================== North Huddle: Field Goal Challenge, realistic 3D view ===================== */
// Same game rules as before; this redraws the scene with a real perspective camera behind the holder:
// mowed stripes, yard lines and numbers, hash marks, painted end zone, regulation goalposts, a stadium bowl
// with a crowd under the lights, and a ball that flies end over end with a shadow.
const FG3={crowd:null, cw:0, ch:0};
const YD_HALF=3.083, BAR_H=3.333, UP_TOP=BAR_H+11.67, SIDE=26.67;
function fgCam(W,H){ const f=Math.min(H*1.1,W*2.2); return {f, hz:H*0.36, cx:W/2, cy:3.4, cz:-9}; }
function fgP(c,x,y,z){ const d=Math.max(1.5,z-c.cz); return {x:c.cx+c.f*x/d, y:c.hz-c.f*(y-c.cy)/d, s:c.f/d}; }
function fgQuad(x,c,a,b,cc,d,fill){ const p=[a,b,cc,d].map(q=>fgP(c,q[0],q[1],q[2])); x.beginPath(); x.moveTo(p[0].x,p[0].y); for(let i=1;i<4;i++) x.lineTo(p[i].x,p[i].y); x.closePath(); x.fillStyle=fill; x.fill(); }
function fgCrowd(W,H){
  if(FG3.crowd&&FG3.cw===W&&FG3.ch===H) return FG3.crowd;
  const cv=document.createElement("canvas"); cv.width=Math.ceil(W); cv.height=Math.ceil(H*0.4); const g=cv.getContext("2d");
  const cs=getComputedStyle(document.documentElement), purple=cs.getPropertyValue("--purple").trim()||"#4F2683", gold=cs.getPropertyValue("--gold").trim()||"#FFC62F";
  const cols=[purple,purple,purple,gold,"#ffffff","#2a2a35","#8a5a3c","#d9b38c",purple];
  for(let i=0;i<cv.width*cv.height/9;i++){ g.fillStyle=cols[(Math.random()*cols.length)|0]; g.globalAlpha=0.35+Math.random()*0.5; const s=1+Math.random()*1.6; g.fillRect(Math.random()*cv.width,Math.random()*cv.height,s,s); }
  for(let i=0;i<90;i++){ g.globalAlpha=0.8; g.fillStyle="#fff"; g.fillRect(Math.random()*cv.width,Math.random()*cv.height,1,1); } // camera flashes
  FG3.crowd=cv; FG3.cw=W; FG3.ch=H; return cv;
}
function fgTraj(D,lat,good,short,power,need){
  // returns {R (landing z), apex}
  if(short){ const R=D*Math.max(0.45,Math.min(0.93,power/need)); return {R, apex:Math.max(2.2,R*0.22)}; }
  const R=D*1.45, margin=1.2+Math.max(0,(power-need))*14; return {R, apex:(BAR_H+margin)/(4*(D/R)*(1-D/R))};
}
function fgBallAt(D,b,need,t){
  const tr=fgTraj(D,b.x,b.good,b.short,FG.power,need), zEnd=b.short?tr.R:D+6, z=zEnd*t;
  const latEnd=b.x*1.1*2*YD_HALF, lat=latEnd*Math.pow(Math.min(1.2,z/D),1.5);
  const y=Math.max(0.12,4*tr.apex*(z/tr.R)*(1-z/tr.R)+0.12);
  return {x:lat,y,z};
}
fgDraw=function(){
  const c=$("fgCanvas"); if(!c) return; const x=c.getContext("2d"), W=FG.w, H=FG.h; x.setTransform(FG.dpr,0,0,FG.dpr,0,0);
  const cs=getComputedStyle(document.documentElement), purple=cs.getPropertyValue("--purple").trim()||"#4F2683", gold=cs.getPropertyValue("--gold").trim()||"#FFC62F";
  const cam=fgCam(W,H), D=FG.dist, G=D-10, need=0.22+FG.dist*0.0115;
  // night sky + stadium lights
  const sky=x.createLinearGradient(0,0,0,cam.hz); sky.addColorStop(0,"#05070f"); sky.addColorStop(1,"#1a2236"); x.fillStyle=sky; x.fillRect(0,0,W,cam.hz+2);
  [[0.08,0.06],[0.92,0.06],[0.32,0.02],[0.68,0.02]].forEach(([fx,fy])=>{ const gx=W*fx, gy=H*fy+8, r=W*0.28; const rg=x.createRadialGradient(gx,gy,0,gx,gy,r); rg.addColorStop(0,"rgba(255,250,230,.55)"); rg.addColorStop(.12,"rgba(255,250,230,.18)"); rg.addColorStop(1,"rgba(255,250,230,0)"); x.fillStyle=rg; x.fillRect(gx-r,gy-r,r*2,r*2);
    x.fillStyle="#fffbe8"; for(let i=-2;i<=2;i++) for(let j=0;j<2;j++) x.fillRect(gx+i*5-2,gy+j*5-2,3.5,3.5); });
  // stands: back wall behind the end zone + sideline bowls
  const crowd=fgCrowd(W,H), far=D+14;
  const wallTop=fgP(cam,0,10,far).y, wallBot=fgP(cam,0,0,far).y;
  x.save(); x.beginPath(); x.rect(0,wallTop,W,wallBot-wallTop); x.clip(); x.drawImage(crowd,0,wallTop,W,wallBot-wallTop); x.restore();
  const shade=x.createLinearGradient(0,wallTop,0,wallBot); shade.addColorStop(0,"rgba(5,7,15,.55)"); shade.addColorStop(1,"rgba(5,7,15,.15)"); x.fillStyle=shade; x.fillRect(0,wallTop,W,wallBot-wallTop);
  // ribbon board on the wall
  const rb1=fgP(cam,0,2.4,far-0.5).y, rb0=fgP(cam,0,1.2,far-0.5).y; x.fillStyle=purple; x.fillRect(0,rb1,W,rb0-rb1); x.fillStyle="rgba(255,255,255,.85)"; x.font=`800 ${Math.max(7,(rb0-rb1)*0.75)}px "Barlow Condensed",system-ui`; x.textAlign="center"; x.textBaseline="middle"; const nb=Math.max(2,Math.round(W/ Math.max(90,(rb0-rb1)*9))); for(let i=0;i<nb;i++) x.fillText("NORTH HUDDLE", W*(i+0.5)/nb, (rb0+rb1)/2); x.textBaseline="alphabetic";
  [-1,1].forEach(sd=>{ const p=[[sd*31,0,-8],[sd*31,0,far],[sd*58,16,far],[sd*58,16,-8]].map(q=>fgP(cam,q[0],q[1],q[2]));
    x.save(); x.beginPath(); x.moveTo(p[0].x,p[0].y); p.slice(1).forEach(q=>x.lineTo(q.x,q.y)); x.closePath(); x.clip();
    const minY=Math.min(...p.map(q=>q.y)), maxY=Math.max(...p.map(q=>q.y)); x.drawImage(crowd,0,minY,W,maxY-minY); x.fillStyle="rgba(5,7,15,.35)"; x.fillRect(0,minY,W,maxY-minY); x.restore(); });
  // ground beyond the field (sideline area)
  fgQuad(x,cam,[-31,0,-7],[31,0,-7],[31,0,far],[-31,0,far],"#1d4a26");
  // field: mowed 5-yard stripes
  for(let z=G-60, k=0; z<D+4; z+=5, k++){ if(z+5<-7) continue; fgQuad(x,cam,[-SIDE-2,0,Math.max(-7,z)],[SIDE+2,0,Math.max(-7,z)],[SIDE+2,0,Math.min(D+4,z+5)],[-SIDE-2,0,Math.min(D+4,z+5)],k%2?"#2f7d3b":"#29703a"); }
  // end zone painted
  fgQuad(x,cam,[-SIDE,0,G],[SIDE,0,G],[SIDE,0,D],[-SIDE,0,D],purple);
  const ez=fgP(cam,0,0,G+5); x.save(); x.fillStyle="rgba(255,255,255,.85)"; x.font=`800 ${Math.max(8,ez.s*3.2)}px "Barlow Condensed",system-ui`; x.textAlign="center"; const sq=Math.max(0.12,(fgP(cam,0,0,G+3.5).y-fgP(cam,0,0,G+6.5).y)/(ez.s*3)); x.translate(ez.x,ez.y); x.scale(1,sq); x.fillText("NORTH HUDDLE",0,ez.s*1.1); x.restore();
  // lines
  const line=(x1,z1,x2,z2,w)=>{ const a=fgP(cam,x1,0,z1), b=fgP(cam,x2,0,z2); x.lineWidth=Math.max(0.6,w*Math.min(a.s,b.s)); x.beginPath(); x.moveTo(a.x,a.y); x.lineTo(b.x,b.y); x.stroke(); };
  x.strokeStyle="rgba(255,255,255,.9)"; x.lineCap="butt";
  line(-SIDE,-7,-SIDE,D,0.12); line(SIDE,-7,SIDE,D,0.12); line(-SIDE,D,SIDE,D,0.12); line(-SIDE,G,SIDE,G,0.2);
  for(let k=1; G-5*k>-7; k++){ const z=G-5*k; line(-SIDE,z,SIDE,z,0.1); }
  // hash marks (every yard) in line with the uprights, and along the sidelines
  x.strokeStyle="rgba(255,255,255,.75)";
  for(let k=1; G-k>-7; k++){ const z=G-k; if(k%5===0) continue; line(-YD_HALF-0.33,z,-YD_HALF+0.33,z,0.1); line(YD_HALF-0.33,z,YD_HALF+0.33,z,0.1); line(-SIDE,z,-SIDE+0.7,z,0.1); line(SIDE-0.7,z,SIDE,z,0.1); }
  // yard numbers
  for(let k=1; G-10*k>-1; k++){ const z=G-10*k, n=Math.min(50,10*k); if(10*k>50) break; [-1,1].forEach(sd=>{ const p=fgP(cam,sd*(SIDE-11),0,z); if(p.y>H+20) return;
    const sz=p.s*2, sq2=Math.max(0.1,(fgP(cam,0,0,z-1).y-fgP(cam,0,0,z+1).y)/sz); x.save(); x.translate(p.x,p.y); x.scale(1,sq2); x.fillStyle="rgba(255,255,255,.85)"; x.font=`700 ${Math.max(5,sz)}px "Barlow Condensed",system-ui`; x.textAlign="center"; x.textBaseline="middle"; x.fillText(String(n),0,0); x.restore(); }); }
  // goalposts: padded base, gooseneck, crossbar, uprights, wind ribbons
  const P=(px,py,pz)=>fgP(cam,px,py,pz), postCol="#F7D034";
  const base0=P(0,0,D+1.6), base1=P(0,BAR_H-0.5,D+1.6), neck=P(0,BAR_H,D+0.6), barM=P(0,BAR_H,D);
  const pw=Math.max(2,0.17*barM.s);
  x.strokeStyle=postCol; x.lineCap="round"; x.lineWidth=pw*1.2; x.beginPath(); x.moveTo(base0.x,base0.y); x.lineTo(base1.x,base1.y); x.quadraticCurveTo(neck.x,neck.y-pw,barM.x,barM.y); x.stroke();
  const pad=P(0,2.0,D+1.6); x.strokeStyle=purple; x.lineWidth=pw*2.4; x.lineCap="butt"; x.beginPath(); x.moveTo(base0.x,base0.y); x.lineTo(pad.x,pad.y); x.stroke();
  const L0=P(-YD_HALF,BAR_H,D), R0=P(YD_HALF,BAR_H,D), L1=P(-YD_HALF,UP_TOP,D), R1=P(YD_HALF,UP_TOP,D);
  x.strokeStyle="rgba(0,0,0,.25)"; x.lineWidth=pw; x.lineCap="round"; x.beginPath(); x.moveTo(L0.x+1.5,L0.y+1.5); x.lineTo(R0.x+1.5,R0.y+1.5); x.stroke();
  x.strokeStyle=postCol; x.beginPath(); x.moveTo(L0.x,L0.y); x.lineTo(R0.x,R0.y); x.moveTo(L0.x,L0.y); x.lineTo(L1.x,L1.y); x.moveTo(R0.x,R0.y); x.lineTo(R1.x,R1.y); x.stroke();
  const flutter=Math.sin(performance.now()/120)*0.25, wl=Math.min(1,Math.abs(FG.wind)/12), dir=FG.wind>=0?1:-1;
  [L1,R1].forEach(t=>{ const len=Math.max(6,1.6*barM.s)*(0.35+wl); x.strokeStyle="#e5322b"; x.lineWidth=Math.max(1.5,pw*0.7); x.beginPath(); x.moveTo(t.x,t.y); x.quadraticCurveTo(t.x+dir*len*0.5,t.y+len*(0.55-wl*0.45)+flutter*len*0.4,t.x+dir*len,t.y+len*(0.9-wl*0.8)); x.stroke(); });
  // HUD text
  x.fillStyle="#fff"; x.font='700 15px "Barlow Condensed",system-ui'; x.textAlign="left"; x.shadowColor="rgba(0,0,0,.6)"; x.shadowBlur=4;
  x.fillText(FG.wind===0?"No wind":`Wind ${Math.abs(FG.wind)} mph ${FG.wind>0?"→":"←"}`,12,24); x.textAlign="right"; x.fillText(`${FG.dist}-yard attempt`,W-12,24); x.shadowBlur=0;
  // aim guide: dotted flight path toward where you're aiming
  if(FG.phase==="aim"||FG.phase==="power"){
    const lat=FG.aim*1.1*2*YD_HALF, tr=fgTraj(D,0,true,false,need+0.04,need);
    x.fillStyle=FG.phase==="aim"?gold:"#fff";
    for(let i=1;i<=26;i++){ const z=D*i/26, y=4*tr.apex*(z/tr.R)*(1-z/tr.R)+0.12, p=fgP(cam,lat*Math.pow(z/D,1.5),y,z); x.globalAlpha=0.35+0.6*(i/26); x.beginPath(); x.arc(p.x,p.y,Math.max(1.2,Math.min(4,p.s*0.08)),0,7); x.fill(); }
    x.globalAlpha=1; const tp=fgP(cam,lat,BAR_H+1.5,D); x.strokeStyle=x.fillStyle; x.lineWidth=2; x.beginPath(); x.arc(tp.x,tp.y,7,0,7); x.stroke(); x.beginPath(); x.arc(tp.x,tp.y,2,0,7); x.fill();
  }
  // power meter
  if(FG.phase==="aim"||FG.phase==="power"){
    const bw=16, bh=H*0.34, bx=W-30, by=H-60-bh;
    x.fillStyle="rgba(0,0,0,.5)"; x.beginPath(); x.roundRect?x.roundRect(bx-3,by-3,bw+6,bh+6,8):x.rect(bx-3,by-3,bw+6,bh+6); x.fill();
    const p=Math.min(1,FG.power/1.05); const grad=x.createLinearGradient(0,by+bh,0,by); grad.addColorStop(0,"#4cc38a"); grad.addColorStop(.75,gold); grad.addColorStop(1,"#e5322b");
    x.fillStyle=grad; x.fillRect(bx,by+bh*(1-p),bw,bh*p);
    const ny=by+bh*(1-Math.min(1,need/1.05)); x.fillStyle="#fff"; x.fillRect(bx-6,ny-1,bw+12,2);
    x.font='700 11px "Barlow Condensed",system-ui'; x.textAlign="right"; x.fillText("POWER",bx+bw,by-9);
  }
  // ball + shadow
  let b={x:0,y:0.15,z:0}, spin=0;
  if(FG.ball){ b=fgBallAt(D,FG.ball,need,FG.ball.t); spin=FG.ball.t*22; }
  const sh=fgP(cam,b.x,0,b.z), bp=fgP(cam,b.x,b.y,b.z), r=Math.max(1.6,0.19*bp.s);
  x.fillStyle=`rgba(0,0,0,${Math.max(0.08,0.35-b.y*0.03)})`; x.beginPath(); x.ellipse(sh.x,sh.y,r*1.3,r*0.35,0,0,7); x.fill();
  if(!FG.ball){ // holder's hand + tee spot
    x.fillStyle="#f4f4f4"; x.beginPath(); x.ellipse(bp.x,bp.y-r*1.1,r*0.38,r*0.55,0,0,7); x.fill(); }
  x.save(); x.translate(bp.x,bp.y); x.rotate(FG.ball?0:-0.25);
  const squash=FG.ball?Math.abs(Math.cos(spin))*0.55+0.45:1;
  const bg=x.createLinearGradient(-r,-r,r,r); bg.addColorStop(0,"#9a5428"); bg.addColorStop(1,"#5a2a10");
  x.fillStyle=bg; x.beginPath(); x.ellipse(0,0,r*0.82,r*1.28*squash,0,0,7); x.fill();
  if(r>4){ x.strokeStyle="#fff"; x.lineWidth=Math.max(1,r*0.1); x.beginPath(); x.moveTo(0,-r*0.5*squash); x.lineTo(0,r*0.5*squash); x.stroke();
    for(let i=-2;i<=2;i++){ x.beginPath(); x.moveTo(-r*0.18,i*r*0.17*squash); x.lineTo(r*0.18,i*r*0.17*squash); x.stroke(); }
    x.strokeStyle="rgba(255,255,255,.7)"; [-1,1].forEach(e=>{ x.beginPath(); x.moveTo(-r*0.6,e*r*0.95*squash); x.lineTo(r*0.6,e*r*0.95*squash); x.stroke(); }); }
  x.restore();
};
// make sure the canvas fills the stage on open
const _openGameFG3=openGame; openGame=function(){ _openGameFG3(); FG3.crowd=null; };
