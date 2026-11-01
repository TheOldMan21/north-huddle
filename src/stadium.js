/* ===================== North Huddle: stadium depth view ===================== */
// Starters lined up on a stadium photo, seen from behind, each built in the browser from one body model:
// uniform recolored to the team, skin tone matched to the player's ESPN headshot, headshot in a ring on the head,
// jersey number on the back, and injured body parts glowing red.
const STAD={view:(()=>{ try{ return localStorage.getItem("nh_fieldview")||"stadium"; }catch(e){ return "stadium"; } })(),
  meta:null, body:null, layers:null, skinBase:null, ready:null, cache:{}, pending:{}};
const CAM={vx:591, hz:320, f:929, ch:5.77, W:1170, top:40, H:872};
function camP(X,d){ const s=CAM.f/d; return {x:CAM.vx+X*s, y:CAM.hz+s*CAM.ch-CAM.top, s}; }
// field spots (X = yards from the middle, + is the right side of the screen; d = distance from the camera)
const STAD_FORM={
  offense:{LWR:[-7.6,15.7],SWR:[-5.2,14.7],LT:[-2.8,16.0],LG:[-1.4,15.9],C:[0,15.85],RG:[1.4,15.9],RT:[2.8,16.0],TE:[4.4,16.2],RWR:[7.6,16.2],QB:[0.4,10.0],RB:[-2.5,10.3]},
  defense34:{LCB:[-8,15.5],LOLB:[-5.6,15.8],LDE:[-2.9,16.0],NT:[0,15.9],RDE:[2.9,16.0],ROLB:[5.6,15.8],RCB:[8,15.5],WLB:[-1.7,13.2],MLB:[1.7,13.2],SS:[-3.6,11.0],FS:[3.6,11.2]},
  defense43:{LCB:[-8,15.5],LDE:[-4.2,16.0],LDT:[-1.4,15.9],RDT:[1.4,15.9],RDE:[4.2,16.0],RCB:[8,15.5],WLB:[-4.4,13.4],MLB:[0,13.0],SLB:[4.4,13.4],SS:[-3.6,11.0],FS:[3.6,11.2]}
};
const STAD_LINE_D=15.3, BODY_YD=2.05*0.9;
function hex2rgb(h){ const m=String(h||"").replace("#",""); const n=parseInt(m.length===3?m.split("").map(c=>c+c).join(""):m,16); return [(n>>16)&255,(n>>8)&255,n&255]; }
function loadImg(src){ return new Promise((res,rej)=>{ const i=new Image(); i.crossOrigin="anonymous"; i.onload=()=>res(i); i.onerror=rej; i.src=src; }); }
function stadReady(){
  if(STAD.ready) return STAD.ready;
  STAD.ready=(async()=>{
    const [meta,b,l]=await Promise.all([fetch("/img/field/body.json").then(r=>r.json()),loadImg("/img/field/body.png"),loadImg("/img/field/body-layers.png")]);
    const cv=document.createElement("canvas"); cv.width=meta.w; cv.height=meta.h; const g=cv.getContext("2d",{willReadFrequently:true});
    g.drawImage(b,0,0); const bd=g.getImageData(0,0,meta.w,meta.h);
    g.clearRect(0,0,meta.w,meta.h); g.drawImage(l,0,0); const ld=g.getImageData(0,0,meta.w,meta.h);
    let sr=0,sg=0,sb=0,n=0; for(let i=0;i<ld.data.length;i+=4) if(ld.data[i]===3&&bd.data[i+3]>200){ sr+=bd.data[i]; sg+=bd.data[i+1]; sb+=bd.data[i+2]; n++; }
    STAD.meta=meta; STAD.body=bd; STAD.layers=ld; STAD.skinBase=n?[sr/n,sg/n,sb/n]:[145,112,94];
    try{ await document.fonts?.load?.('800 40px "Barlow Condensed"'); }catch(e){}
  })();
  return STAD.ready;
}
async function headshotSample(src){
  if(!src) return {img:null, skin:null};
  try{
    const img=await loadImg("/api/hs?u="+encodeURIComponent(src));
    const c=document.createElement("canvas"); c.width=img.naturalWidth; c.height=img.naturalHeight; const g=c.getContext("2d",{willReadFrequently:true}); g.drawImage(img,0,0);
    const sx=c.width/600, sy=c.height/436, d=g.getImageData(Math.round(250*sx),Math.round(215*sy),Math.round(110*sx),Math.round(50*sy)).data;
    let r=0,gg=0,b=0,n=0; for(let i=0;i<d.length;i+=4) if(d[i+3]>200){ r+=d[i]; gg+=d[i+1]; b+=d[i+2]; n++; }
    return {img, skin:n>50?[r/n,gg/n,b/n]:null};
  }catch(e){ return {img:null, skin:null}; }
}
// build one player: returns {body, glow} image URLs
async function stadPlayer(key,o){
  if(STAD.cache[key]) return STAD.cache[key];
  if(STAD.pending[key]) return STAD.pending[key];
  STAD.pending[key]=(async()=>{
    await stadReady();
    const M=STAD.meta, B=STAD.body.data, L=STAD.layers.data, W=M.w, H=M.h;
    const hs=await headshotSample(o.photo);
    const c1=hex2rgb(o.c1), c2=hex2rgb(o.c2), pants=[244,236,214];
    const ratio=hs.skin?hs.skin.map((v,i)=>v/STAD.skinBase[i]):[1,1,1];
    const cv=document.createElement("canvas"); cv.width=W; cv.height=H; const g=cv.getContext("2d");
    const out=g.createImageData(W,H), O=out.data;
    const glow=document.createElement("canvas"); glow.width=W; glow.height=H; const gg=glow.getContext("2d");
    const red=gg.createImageData(W,H), R=red.data; let anyRed=false;
    const hurt=new Set(); (o.parts||[]).forEach(p=>{ const i=M.zones.indexOf(p); if(i>0) hurt.add(i+1); });
    for(let i=0;i<B.length;i+=4){
      const a=B[i+3]; if(!a) continue;
      const reg=L[i], zone=L[i+1], lum=(B[i]+B[i+1]+B[i+2])/765;
      let r=B[i], gC=B[i+1], b=B[i+2];
      if(reg===1){ const f=0.25+1.2*Math.pow(lum,1.6); r=c1[0]*f; gC=c1[1]*f; b=c1[2]*f; }
      else if(reg===2){ const f=0.55+0.53*lum; r=pants[0]*f; gC=pants[1]*f; b=pants[2]*f; }
      else if(reg===3){ r*=ratio[0]; gC*=ratio[1]; b*=ratio[2]; }
      else if(reg===5){ r=c2[0]; gC=c2[1]; b=c2[2]; }
      O[i]=Math.min(255,r); O[i+1]=Math.min(255,gC); O[i+2]=Math.min(255,b); O[i+3]=a;
      if(zone&&hurt.has(zone)){ const f=0.6+0.75*lum; R[i]=Math.min(255,255*f); R[i+1]=Math.min(255,40*f); R[i+2]=Math.min(255,36*f); R[i+3]=Math.min(255,a*0.95); anyRed=true; }
    }
    g.putImageData(out,0,0);
    // jersey number on the back
    const N=M.number; g.font=`800 ${N.size}px "Barlow Condensed","Arial Narrow",sans-serif`; g.textAlign="center"; g.textBaseline="middle";
    g.lineJoin="round"; g.lineWidth=N.size*0.06; g.strokeStyle="rgba(255,255,255,.85)"; g.strokeText(String(o.num??""),N.x,N.y); g.fillStyle=`rgb(${c2})`; g.fillText(String(o.num??""),N.x,N.y);
    // headshot in a ring where the head is
    const Hd=M.head, headHurt=(o.parts||[]).includes("head");
    g.beginPath(); g.arc(Hd.cx,Hd.cy,Hd.r+Hd.ring,0,7); g.fillStyle=headHurt?"#ff3b30":`rgb(${c2})`; g.fill();
    g.beginPath(); g.arc(Hd.cx,Hd.cy,Hd.r,0,7); g.fillStyle=`rgb(${c1})`; g.fill();
    if(hs.img){ g.save(); g.beginPath(); g.arc(Hd.cx,Hd.cy,Hd.r,0,7); g.clip(); const fs=3.5*Hd.r/600*(600/hs.img.naturalWidth), w=hs.img.naturalWidth*fs, h=hs.img.naturalHeight*fs; g.drawImage(hs.img,Hd.cx-w/2,Hd.cy-Hd.r-4*M.scale,w,h); g.restore(); }
    else { g.fillStyle=`rgb(${c2})`; g.font=`800 ${Hd.r*0.9}px "Barlow Condensed",sans-serif`; g.fillText(String(o.num??""),Hd.cx,Hd.cy); }
    let glowURL=null;
    if(anyRed||headHurt){
      const rc=document.createElement("canvas"); rc.width=W; rc.height=H; rc.getContext("2d").putImageData(red,0,0);
      if(headHurt){ const x=rc.getContext("2d"); x.beginPath(); x.arc(Hd.cx,Hd.cy,Hd.r+Hd.ring*0.5,0,7); x.lineWidth=Hd.ring*1.8; x.strokeStyle="#ff3b30"; x.stroke(); }
      gg.shadowColor="rgba(255,255,255,.95)"; gg.shadowBlur=3; gg.drawImage(rc,0,0);
      gg.shadowColor="rgba(255,30,30,1)"; gg.shadowBlur=22; gg.drawImage(rc,0,0); gg.drawImage(rc,0,0); gg.shadowBlur=10; gg.drawImage(rc,0,0);
      gg.shadowBlur=0; gg.drawImage(rc,0,0);
      glowURL=glow.toDataURL("image/png");
    }
    const res={body:cv.toDataURL("image/png"), glow:glowURL};
    STAD.cache[key]=res; delete STAD.pending[key]; return res;
  })();
  return STAD.pending[key];
}
function stadLast(n){ const t=String(n||"").replace(/\s+(Jr\.?|Sr\.?|II|III|IV|V)$/i,"").trim().split(/\s+/); let i=t.length-1; while(i>1&&/^(van|von|de|del|der|da|di|du|la|le|st\.?|mc)$/i.test(t[i-1])) i--; return t.slice(Math.max(1,i)).join(" "); }
function stadiumHtml(unit){
  const form=unit==="offense"?STAD_FORM.offense:(is43()?STAD_FORM.defense43:STAD_FORM.defense34);
  const byPos=Object.fromEntries(S.depth.map(d=>[d.pos,d]));
  const ps=[]; for(const [pos,[X,d]] of Object.entries(form)){ const dp=byPos[pos]; const name=dp?.players?.[0]; if(!name) continue; const num=dp.numbers?.[0]; ps.push({pos,X,d,name,num:(num===0||num)?num:"",inj:findInjury(name)}); }
  if(!ps.length) return "";
  const pct=(v,of)=>(v/of*100).toFixed(3)+"%";
  // geometry in photo pixels
  ps.forEach(p=>{ const c=camP(p.X,p.d); p.x=c.x; p.y=c.y; p.s=c.s; p.bh=BODY_YD*c.s; p.h=p.bh*(STAD.meta?STAD.meta.h/(STAD.meta.h-STAD.meta.pad):1.45); p.w=p.h*(STAD.meta?STAD.meta.w/STAD.meta.h:0.475); p.top=p.y-p.h*0.985; });
  const line=ps.filter(p=>p.d>=STAD_LINE_D).sort((a,b)=>a.x-b.x), back=ps.filter(p=>p.d<STAD_LINE_D);
  const row0=Math.min(...line.map(p=>p.top))-44, row1=row0-46;
  const lines=(unit==="offense"?[[16.6,"los"],[26.6,"fd"]]:[[16.6,"los"]]).map(([d,cls])=>{ const a=camP(-26.7,d), b=camP(26.7,d); return `<i class="st-line st-${cls}" style="left:${pct(Math.max(0,a.x),CAM.W)};width:${pct(Math.min(CAM.W,b.x)-Math.max(0,a.x),CAM.W)};top:${pct(a.y,CAM.H)}"></i>`; }).join("");
  const tag=(p,ty,ptr)=>`${ptr?`<i class="st-ptr" style="left:${pct(p.x,CAM.W)};top:${pct(ty+36,CAM.H)};height:${pct(p.top+6-(ty+36),CAM.H)}"></i>`:""}<button class="st-tag" data-pname="${esc(p.name)}" data-dpos="${esc(p.pos)}" style="left:${pct(p.x,CAM.W)};top:${pct(ty,CAM.H)};z-index:${ptr?1100:Math.round(1000-p.d*10)+1}"><span class="pos">${esc(CIRCLE[p.pos]||p.pos)}</span><span class="nm">${esc(stadLast(p.name))}</span></button>`;
  let tags=""; line.forEach((p,i)=>{ tags+=tag(p,i%2?row1:row0,true); }); back.forEach(p=>{ const lf=p.X<-3.5; tags+=`<button class="st-tag st-side${lf?" st-left":""}" data-pname="${esc(p.name)}" data-dpos="${esc(p.pos)}" style="left:${pct(lf?p.x-p.w*0.36:p.x+p.w*0.36,CAM.W)};top:${pct(p.y-p.bh*0.62,CAM.H)};z-index:${Math.round(1000-p.d*10)+1}"><span class="pos">${esc(CIRCLE[p.pos]||p.pos)}</span><span class="nm">${esc(stadLast(p.name))}</span></button>`; });
  const sprites=ps.slice().sort((a,b)=>b.d-a.d).map(p=>{ const parts=[...injuryParts(p.inj)]; const key=[CUR,p.name,p.num,parts.join("+"),photoFor(p.name)].join("|");
    return `<span class="st-pl${p.inj?" hurt":""}" data-pname="${esc(p.name)}" data-dpos="${esc(p.pos)}" data-stkey="${esc(key)}" data-parts="${esc(parts.join(","))}" data-num="${esc(p.num)}" data-itag="${esc(injuryTag(p.inj)||"")}" role="button" tabindex="0" aria-label="${esc(DLABEL[p.pos]||p.pos)}: ${esc(p.name)}${p.inj?", "+esc(p.inj.status+" "+(p.inj.injury||"")):""}" style="left:${pct(p.x-p.w/2,CAM.W)};top:${pct(p.top,CAM.H)};width:${pct(p.w,CAM.W)};z-index:${Math.round(1000-p.d*10)}"><i class="st-shadow"></i></span>`; }).join("");
  const legend=ps.slice().sort((a,b)=>(b.d>=STAD_LINE_D)-(a.d>=STAD_LINE_D)||a.x-b.x).map(p=>`<button class="st-chip" data-pname="${esc(p.name)}" data-dpos="${esc(p.pos)}"><b>${esc(CIRCLE[p.pos]||p.pos)}</b> ${esc(stadLast(p.name))}${p.inj?' <span class="st-hurtdot" aria-label="injured"></span>':""}</button>`).join("");
  return `<div class="st-wrap"><div class="stadium" role="img" aria-label="${unit==="offense"?"Offense":"Defense"} lined up on the field, seen from behind">${lines}${sprites}${tags}<div class="st-loading">Lining up the starters…</div></div><div class="st-legend">${legend}</div></div>`;
}
async function fillStadium(root){
  const el=root?.querySelector?.(".stadium"); if(!el) return;
  await stadReady();
  const c=TEAM[CUR]||["#4F2683","#FFC62F","#fff"];
  await Promise.all([...el.querySelectorAll(".st-pl[data-stkey]")].map(async sp=>{
    const name=sp.dataset.pname, parts=sp.dataset.parts?sp.dataset.parts.split(","):[];
    const r=await stadPlayer(sp.dataset.stkey,{num:sp.dataset.num, c1:c[0], c2:c[1], parts, photo:photoFor(name)}); const tg=sp.dataset.itag;
    if(!sp.isConnected) return;
    sp.insertAdjacentHTML("beforeend",`<img class="st-body" src="${r.body}" alt="">${r.glow?`<img class="st-glow" src="${r.glow}" alt="">`:""}${tg?`<b class="st-itag">${esc(tg)}</b>`:""}`);
  }));
  el.classList.add("ready");
}
const _fieldSvgST=fieldSvg;
fieldSvg=function(unit){
  const toggle=`<div class="fp-toggle auth-seg st-toggle" role="group" aria-label="Field view"><button data-fieldview="stadium" aria-pressed="${STAD.view==="stadium"}">Stadium</button><button data-fieldview="classic" aria-pressed="${STAD.view!=="stadium"}">Classic</button></div>`;
  if(STAD.view!=="stadium"){ const h=_fieldSvgST(unit); return h?toggle+h:h; }
  if(!STAD.meta){ stadReady().then(()=>{ if(S.tab==="depth"||$("depthBody")?.querySelector(".stadium")) renderDepth(); }); }
  const h=stadiumHtml(unit); if(!h) return _fieldSvgST(unit);
  const hurt=S.depth.some(d=>{ const n=d.players?.[0]; return n&&findInjury(n)&&Object.keys(unit==="offense"?STAD_FORM.offense:(is43()?STAD_FORM.defense43:STAD_FORM.defense34)).includes(d.pos); });
  return toggle+h+(hurt?`<div class="foot"><span class="hurt-key"></span>Glowing red shows where a starter is hurt. Tap any player for details.</div>`:`<div class="foot">Tap any player for stats.</div>`);
};
const _renderDepthST=renderDepth;
renderDepth=function(){ _renderDepthST(); if(STAD.view==="stadium") fillStadium($("depthBody")); };
document.addEventListener("click",e=>{ const b=e.target.closest("[data-fieldview]"); if(!b) return; STAD.view=b.dataset.fieldview; try{ localStorage.setItem("nh_fieldview",STAD.view); }catch(err){} renderDepth(); });
document.addEventListener("keydown",e=>{ if((e.key==="Enter"||e.key===" ")&&e.target.classList?.contains("st-pl")){ e.preventDefault(); openByName(e.target.dataset.pname,e.target.dataset.dpos); } });
