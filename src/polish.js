/* ===================== North Huddle: polish (theme toggle, chat rules link) ===================== */
const ICO_MOON=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>`;
const ICO_SUN=`<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/></svg>`;
function isDark(){ return THEME==="dark"||(THEME==="auto"&&matchMedia("(prefers-color-scheme: dark)").matches); }
function themeBtnPaint(){ const b=$("themeBtn"); if(!b) return; const d=isDark(); b.innerHTML=d?ICO_SUN:ICO_MOON; b.setAttribute("aria-label",d?"Switch to light mode":"Switch to dark mode"); b.title=b.getAttribute("aria-label"); }
(function(){
  const r=$("refreshBtn"); if(!r||$("themeBtn")) return;
  r.insertAdjacentHTML("beforebegin",`<button class="refresh hdr-ico" id="themeBtn"></button>`);
  themeBtnPaint();
  $("themeBtn").addEventListener("click",()=>{ setTheme(isDark()?"light":"dark"); themeBtnPaint(); });
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change",themeBtnPaint);
})();
const _setThemeP=setTheme; setTheme=function(v,f){ _setThemeP(v,f); themeBtnPaint(); };
// community rules link next to the chat boxes
function addRulesLinks(){
  document.querySelectorAll(".fc-head:not([data-rules]),.wpv-ch:not([data-rules])").forEach(h=>{ h.dataset.rules="1"; h.insertAdjacentHTML("beforeend",`<a class="rules-link" href="/terms.html#rules" target="_blank" rel="noopener">Rules</a>`); });
}
const _renderHomePL=renderHome; renderHome=function(){ _renderHomePL(); addRulesLinks(); };
setTimeout(addRulesLinks,1500);

/* ---------- Season trends, redesigned: stat tiles + point-margin chart ---------- */
trendsHtml=function(){
  const g=S.games.filter(x=>x.status==="final"&&x.us!=null).sort((a,b)=>a.week-b.week); if(g.length<2) return "";
  const n=g.length, pf=g.reduce((a,x)=>a+x.us,0), pa=g.reduce((a,x)=>a+x.them,0), diff=pf-pa;
  const w=g.filter(x=>x.us>x.them).length, l=g.filter(x=>x.us<x.them).length, t=n-w-l;
  const maxM=Math.max(7,...g.map(x=>Math.abs(x.us-x.them)));
  const allWins=g.every(x=>x.us>=x.them);
  const col=(x,i)=>{ const m=x.us-x.them, h=Math.max(4,Math.abs(m)/maxM*100), res=m>0?"w":m<0?"l":"t";
    const tip=`Week ${x.week} ${x.home?"vs":"at"} ${TEAMS[x.oppAbbr]?.[1]||x.oppAbbr}: ${res==="w"?"Won":res==="l"?"Lost":"Tied"} ${x.us}–${x.them}`;
    return `<button class="tr-col tr-${res}" data-trg="${i}" data-tip="${esc(tip)}" aria-label="${esc(tip)}">
      <span class="tr-up">${m>0?`<span class="tr-m num">+${m}</span><i style="height:${h}%"></i>`:""}</span>
      <span class="tr-dn${allWins?" tr-none":""}">${m<0?`<i style="height:${h}%"></i><span class="tr-m num">${m}</span>`:""}${m===0?`<span class="tr-m num">0</span>`:""}</span>
      <span class="tr-opp">${esc(x.oppAbbr)}</span></button>`; };
  const last=g[n-1];
  return `<h2>Season trends</h2><div class="card tr-card">
    <div class="tr-tiles">
      <div><b class="num">${w}-${l}${t?"-"+t:""}</b><span>Record</span></div>
      <div><b class="num">${(pf/n).toFixed(1)}</b><span>Avg scored</span></div>
      <div><b class="num">${(pa/n).toFixed(1)}</b><span>Avg allowed</span></div>
      <div><b class="num ${diff>0?"tr-pos":diff<0?"tr-neg":""}">${diff>0?"+":""}${diff}</b><span>Point diff</span></div>
    </div>
    <div class="tr-label">Point margin by game</div>
    <div class="tr-chart${allWins?" tr-allwin":""}" role="group" aria-label="Point margin for each game">${g.map(col).join("")}</div>
    <div class="tr-tip" id="trTip">Week ${last.week} ${last.home?"vs":"at"} ${esc(TEAMS[last.oppAbbr]?.[1]||last.oppAbbr)}: ${last.us>last.them?"Won":last.us<last.them?"Lost":"Tied"} ${last.us}–${last.them}</div>
  </div>`;
};
function trSelect(b){ document.querySelectorAll(".tr-col.on").forEach(x=>x.classList.remove("on")); b.classList.add("on"); const t=$("trTip"); if(t) t.textContent=b.dataset.tip; }
document.addEventListener("pointerover",e=>{ const b=e.target.closest(".tr-col"); if(b&&e.pointerType==="mouse") trSelect(b); });
document.addEventListener("click",e=>{ const b=e.target.closest(".tr-col"); if(b) trSelect(b); });

/* ---------- "Get the app" buttons: footer + account sheet, with step-by-step help when the browser can't prompt ---------- */
function installHelpHtml(){
  const u=navigator.userAgent, ios=/iPhone|iPad|iPod/.test(u)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
  const samsung=/SamsungBrowser/.test(u), android=/Android/.test(u), edge=/Edg\//.test(u), firefox=/Firefox|FxiOS/.test(u), safariMac=/Macintosh/.test(u)&&/Safari/.test(u)&&!/Chrome|Edg/.test(u);
  let steps;
  if(ios) steps=["Open this site in <b>Safari</b> (it won't work from inside other apps).","Tap the <b>Share</b> button at the bottom of the screen.","Scroll down and tap <b>Add to Home Screen</b>, then <b>Add</b>."];
  else if(samsung) steps=["Tap the <b>☰ menu</b> at the bottom right.","Tap <b>Add page to</b> → <b>Home screen</b>.","Tap <b>Add</b>."];
  else if(android) steps=["Tap the <b>⋮</b> menu at the top right of Chrome.","Tap <b>Add to Home screen</b> (or <b>Install app</b>).","Tap <b>Install</b>."];
  else if(safariMac) steps=["In the menu bar, click <b>File</b> → <b>Add to Dock</b>.","Click <b>Add</b>."];
  else if(firefox) steps=["Firefox can't install sites as apps on computers.","Open <b>north-huddle.pages.dev</b> in <b>Chrome</b> or <b>Edge</b>, then use the install button there."];
  else if(edge) steps=["Click the <b>…</b> menu at the top right of Edge.","Click <b>Apps</b> → <b>Install this site as an app</b>.","Click <b>Install</b>."];
  else steps=["Click the <b>install icon</b> at the right end of the address bar (a monitor with a down arrow), or","Click the <b>⋮</b> menu → <b>Cast, save and share</b> → <b>Install page as app</b>.","Click <b>Install</b>."];
  return `<div class="sheet-head"><div class="acct-hd"><img src="/icon-192.png?v=3" alt="" style="width:46px;height:46px;border-radius:12px"><div><div class="label">Get the app</div><div class="nm" style="font-size:24px">Install North Huddle</div></div></div><button class="x" id="closeSheet" aria-label="Close">×</button></div>
    <p class="acct-p">Opens full screen from your home screen or taskbar, loads faster, and gets game alerts.</p>
    <ol class="inst-steps">${steps.map(s=>`<li>${s}</li>`).join("")}</ol>
    <div class="foot">It's free, takes a few seconds, and you stay signed in.</div>`;
}
const _doInstallP=doInstall;
doInstall=async function(){
  if(isStandalone()) return toast("You're already using the app!");
  if(APP.prompt) return _doInstallP();
  $("sheet").innerHTML=installHelpHtml(); $("sheetBg").hidden=false;
};
function installButtons(){
  const show=!isStandalone();
  const f=$("nhFoot")?.querySelector(".nf-links");
  if(f&&show&&!f.querySelector("[data-install]")) f.insertAdjacentHTML("afterbegin",`<button class="nf-app" data-install="1"><img src="/icon.svg?v=3" alt="" width="18" height="18">Get the app</button>`);
}
const _openAcctIB=openAcct;
openAcct=function(){
  _openAcctIB();
  if(isStandalone()) return;
  const sh=$("sheet"); if(sh.querySelector(".acct-install")) return;
  sh.querySelector(".push-panel [data-install]")?.remove();
  const anchor=sh.querySelector(".push-panel")||sh.querySelector("[data-signout]");
  const html=`<button class="card acct-install" data-install="1"><img src="/icon-192.png?v=3" alt=""><span class="grow"><b>Get the North Huddle app</b><span class="t2">Home screen icon, full screen, game alerts</span></span><span class="tbtn">Install</span></button>`;
  if(anchor) anchor.insertAdjacentHTML("beforebegin",html); else sh.insertAdjacentHTML("beforeend",html);
};
const _renderHomeIB=renderHome; renderHome=function(){ _renderHomeIB(); installButtons(); };
setTimeout(installButtons,1200);

/* ---------- Starters on the field: player photos in place of the helmet ---------- */
let PHOTO_MODE=(()=>{ try{ return localStorage.getItem("nh_fieldphotos")!=="0"; }catch(e){ return true; } })();
function photoFor(name){
  const ph=QUICK[CUR]?.photos; if(!ph||!name) return "";
  if(ph[name]) return ph[name];
  const k=nmz(name); for(const n in ph) if(nmz(n)===k) return ph[n];
  const lastOf=s=>String(s).toLowerCase().replace(/\b(jr|sr|ii|iii|iv)\b\.?/g,"").trim().split(/\s+/).pop().replace(/[^a-z]/g,"");
  const last=lastOf(name); const hits=Object.keys(ph).filter(n=>lastOf(n)===last&&nmz(n)[0]===k[0]); return hits.length===1?ph[hits[0]]:"";
}
const _fieldSvgPH=fieldSvg;
fieldSvg=function(unit){
  let h=_fieldSvgPH(unit); if(!h) return h;
  const hasPhotos=QUICK[CUR]?.photos&&Object.keys(QUICK[CUR].photos).length;
  const toggle=hasPhotos?`<div class="fp-toggle auth-seg" role="group" aria-label="Player view"><button data-fieldph="1" aria-pressed="${PHOTO_MODE}">Photos</button><button data-fieldph="0" aria-pressed="${!PHOTO_MODE}">Figures</button></div>`:"";
  if(!hasPhotos||!PHOTO_MODE) return toggle+h;
  const c1=(TEAM[CUR]||["#4F2683","#FFC62F"])[0], c2=(TEAM[CUR]||["#4F2683","#FFC62F"])[1];
  let n=0, defs="";
  // keep the body (so injured body parts still light up red) and put the player's headshot where the helmet was
  h=h.replace(/(<g class="pl([^"]*)" data-pname="([^"]+)"[^>]*tabindex="0"[^>]*><g class="fig" transform="translate\([^)]*\)">)([\s\S]*?)(<text class="pos[^"]*"[^>]*>[^<]*<\/text>)([\s\S]*?<\/g><\/g>)/g,(m,open,cls,nameEsc,fig,numText,tail)=>{
    const name=nameEsc.replace(/&amp;/g,"&").replace(/&#39;/g,"'").replace(/&quot;/g,'"'), src=photoFor(name); if(!src) return m;
    const id="fph"+(n++), R=10.5, cy=-20.5; defs+=`<clipPath id="${id}"><circle cx="0" cy="${cy}" r="${R}"/></clipPath>`;
    const headHurt=/class="helm injured"/.test(fig);
    const body=fig.replace(/<path class="helm[^>]*\/>\s*<rect class="stripe[^>]*\/>\s*<path class="mask"[^>]*\/>/,"");
    const head=`<circle class="hs-ring" cx="0" cy="${cy}" r="${R+1.6}" fill="${headHurt?"var(--hurt)":c2}"/><circle cx="0" cy="${cy}" r="${R}" fill="${c1}"/>`
      +`<image href="${esc(src)}" x="${-R*1.75}" y="${cy-R-0.5}" width="${R*3.5}" height="${R*2.55}" preserveAspectRatio="xMidYMin slice" clip-path="url(#${id})"/>`;
    return open+body+numText+head+tail.replace('<g class="itag">','<g class="itag" transform="translate(13.5,4)">');
  });
  if(defs) h=h.replace(/(<svg viewBox="0 0 360 \d+"[^>]*>)/,`$1<defs>${defs}</defs>`);
  return toggle+h;
};
document.addEventListener("click",e=>{ const b=e.target.closest("[data-fieldph]"); if(!b) return; PHOTO_MODE=b.dataset.fieldph==="1"; try{ localStorage.setItem("nh_fieldphotos",PHOTO_MODE?"1":"0"); }catch(err){} renderDepth(); });

/* ---------- more realistic player bodies (same injury zones: head, torso, arms, hands, thighs, knees, shins) ---------- */
figureSvg=function(parts){
  const c=(name,base)=>`class="${base}${parts.has(name)?" injured":""}"`;
  const leg=(s,k)=>`
    <path ${c("thigh"+s,"pant")} d="M${k*0.4} 4.6 L${k*7.9} 4.6 C${k*8.3} 7.6 ${k*7.6} 10.6 ${k*6.9} 12.6 L${k*2.1} 12.6 C${k*1.3} 10 ${k*0.5} 7.4 ${k*0.4} 4.6 Z"/>
    <path class="pstripe" d="M${k*7.6} 5.2 C${k*7.9} 8 ${k*7.4} 10.4 ${k*6.8} 12.3"/>
    <rect ${c("knee"+s,"kneepad")} x="${k>0?1.9:-6.9}" y="11.4" width="5" height="3.4" rx="1.6"/>
    <path ${c("shin"+s,"sock")} d="M${k*2.1} 14.4 L${k*6.7} 14.4 C${k*7.3} 16 ${k*6.9} 18.6 ${k*6.1} 20.6 L${k*2.7} 20.6 C${k*2.2} 18.6 ${k*1.8} 16.2 ${k*2.1} 14.4 Z"/>
    <path ${c("shin"+s,"shoe")} d="M${k*2.2} 20.2 L${k*6.4} 20.2 C${k*7.6} 20.4 ${k*8.6} 21.4 ${k*8.4} 22.6 L${k*1.8} 22.8 C${k*1.6} 21.8 ${k*1.7} 20.8 ${k*2.2} 20.2 Z"/>`;
  const arm=(s,k)=>`
    <path ${c("arm"+s,"sleeve")} d="M${k*9.6} -7 C${k*12.4} -6.8 ${k*14.2} -4.8 ${k*14.6} -1.8 L${k*14.9} 2.4 C${k*14.8} 4.8 ${k*14.2} 6.6 ${k*13.6} 8 L${k*10.8} 8 C${k*10.8} 6.2 ${k*10.9} 4.2 ${k*10.6} 2.6 L${k*9.4} -1.4 Z"/>
    <path ${c("hand"+s,"glove")} d="M${k*10.7} 7.6 L${k*13.7} 7.6 C${k*14.2} 8.6 ${k*14.1} 10.4 ${k*13} 11 C${k*12.2} 11.4 ${k*11.2} 10.8 ${k*10.9} 9.8 Z"/>`;
  return `${leg("R",-1)}${leg("L",1)}${arm("R",-1)}${arm("L",1)}
    <rect class="belt" x="-7.6" y="3.8" width="15.2" height="1.6" rx=".6"/>
    <path ${c("torso","jer")} d="M-12.8 -6.4 C-13 -10.4 -10.2 -12.6 -6.2 -12.8 L-2.6 -12.8 L0 -10.6 L2.6 -12.8 L6.2 -12.8 C10.2 -12.6 13 -10.4 12.8 -6.4 L11.2 -2.6 L8.4 -1.8 L7.8 4.4 L-7.8 4.4 L-8.4 -1.8 L-11.2 -2.6 Z"/>
    <path class="shade" d="M-8.4 -1.8 L-7.8 4.4 L-5.6 4.4 L-6.6 -2.4 Z M8.4 -1.8 L7.8 4.4 L5.6 4.4 L6.6 -2.4 Z"/>
    <path class="collar" d="M-2.6 -12.6 L0 -10.4 L2.6 -12.6"/>
    <path class="shade" d="M-12.8 -6.4 C-12.6 -4.6 -12 -3.4 -11.2 -2.6 L-8.4 -1.8 L-9.4 -5 Z M12.8 -6.4 C12.6 -4.6 12 -3.4 11.2 -2.6 L8.4 -1.8 L9.4 -5 Z"/>
    <path ${c("head","helm")} d="M-6 -13.4 C-6.8 -20.6 -3.6 -23.2 0 -23.2 C3.6 -23.2 6.8 -20.6 6 -13.4 C5.8 -11.8 4 -10.6 0 -10.6 C-4 -10.6 -5.8 -11.8 -6 -13.4 Z"/>
    <rect class="stripe${parts.has("head")?" injured-stripe":""}" x="-0.8" y="-23" width="1.6" height="6.2" rx="0.8"/>
    <path class="mask" d="M-4.2 -15.4 L4.2 -15.4 M-3.8 -13.3 L3.8 -13.3 M0 -15.4 L0 -11"/>`;
};
