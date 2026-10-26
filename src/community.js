/* ===================== North Huddle: badges (VIP, donor, earned), who's watching ===================== */

/* ---------- badges ---------- */
// badges/<uid> = {vip:bool, donor:bool} — only the site admin can set these.
const BADGES={};
const EARNED={};
const ICO_STAR=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 16.8l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>`;
const ICO_HEART=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.2-9.4C1.6 7.6 3.8 4.5 7.1 4.5c2 0 3.6 1.1 4.9 2.8 1.3-1.7 2.9-2.8 4.9-2.8 3.3 0 5.5 3.1 4.3 6.6-1.7 4.8-9.2 9.4-9.2 9.4z"/></svg>`;
const ICO_TARGET=`<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="12" cy="12" r="1.3"/></svg>`;
const ICO_EYE=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5C6.5 5 2.7 9.4 1.5 12c1.2 2.6 5 7 10.5 7s9.3-4.4 10.5-7C21.3 9.4 17.5 5 12 5zm0 11.2A4.2 4.2 0 1 1 12 7.8a4.2 4.2 0 0 1 0 8.4z"/></svg>`;
function badgeList(uid){
  const b=BADGES[uid]||{}, e=EARNED[uid]||{}, out=[];
  if(b.vip) out.push({k:"vip",label:"VIP",ico:ICO_STAR,title:"VIP member"});
  if(b.donor) out.push({k:"donor",label:"Donor",ico:ICO_HEART,title:"Supports North Huddle"});
  if(e.exact) out.push({k:"exact",label:"",ico:ICO_TARGET,title:`Exact score called (${e.exact}×)`});
  if(e.called>=3) out.push({k:"called",label:"",ico:ICO_EYE,title:`Called ${e.called} winners`});
  return out;
}
function badgesHtml(uid){ return badgeList(uid).map(x=>`<span class="nb nb-${x.k}" title="${esc(x.title)}" aria-label="${esc(x.title)}">${x.ico}${x.label?`<span>${x.label}</span>`:""}</span>`).join(""); }
let nbBusy=false;
function decorateNames(root){
  if(nbBusy) return; nbBusy=true;
  try{
    (root||document).querySelectorAll("[data-uname]").forEach(n=>{
      const uid=n.dataset.uname, html=badgesHtml(uid), nx=n.nextElementSibling;
      const has=nx&&nx.classList.contains("nbs")&&nx.dataset.for===uid;
      if(!html){ if(has) nx.remove(); return; }
      if(has){ if(nx.innerHTML!==html) nx.innerHTML=html; return; }
      n.insertAdjacentHTML("afterend",`<span class="nbs" data-for="${esc(uid)}">${html}</span>`);
    });
    document.querySelectorAll("img.av[data-uid]").forEach(i=>i.classList.toggle("av-vip",!!BADGES[i.dataset.uid]?.vip));
  } finally { nbBusy=false; }
}
let nbT=0; new MutationObserver(()=>{ if(nbBusy) return; clearTimeout(nbT); nbT=setTimeout(()=>decorateNames(),80); }).observe(document.body,{childList:true,subtree:true});
function computeEarned(){
  if(typeof PRED==="undefined") return;
  const games=Object.fromEntries(S.games.map(g=>[gameKey(g),g]));
  for(const k in EARNED) delete EARNED[k];
  PRED.all.forEach(p=>{
    const g=games[p.game]; if(!g||g.status!=="final"||g.us==null) return;
    const e=EARNED[p.uid]||(EARNED[p.uid]={called:0,exact:0});
    const win=g.us>g.them?CUR:g.us<g.them?g.oppAbbr:"";
    if(p.kind==="pick"){ if(p.pick===win) e.called++; }
    else if(p.us===g.us&&p.them===g.them) e.exact++;
  });
}
(async()=>{
  await accReady; if(!ACC.db) return;
  ACC.db.collection("badges").onSnapshot(s=>{ for(const k in BADGES) delete BADGES[k]; s.docs.forEach(d=>BADGES[d.id]=d.data()); decorateNames(); if(!$("adminView")?.hidden&&typeof renderAdmin==="function") renderAdmin(); },e=>console.warn("badges",e));
  setInterval(()=>{ computeEarned(); decorateNames(); },15000); setTimeout(()=>{ computeEarned(); decorateNames(); },3000);
})();
async function setBadge(uid,key,on){
  const cur=BADGES[uid]||{};
  await ACC.db.doc("badges/"+uid).set({...cur,[key]:!!on,updatedAt:nowIso()});
}

/* ---------- who's watching (live presence) ---------- */
const PRES={n:0, faces:[], ch:null};
function presenceHtml(){
  if(PRES.n<1) return "";
  const faces=PRES.faces.slice(0,6).map(u=>u?av(u):`<img class="av" src="${BLANK_AV}" alt="">`).join("");
  return `<div class="presence" title="People on North Huddle right now"><span class="pr-dot"></span><span class="pr-faces">${faces}</span><b class="num">${PRES.n}</b> ${PRES.n===1?"fan":"fans"} here now</div>`;
}
function renderPresence(){ document.querySelectorAll(".presence-slot").forEach(s=>s.innerHTML=presenceHtml()); }
(async()=>{
  await accReady;
  const key=ACC.id||("anon-"+Math.random().toString(36).slice(2,10));
  const ch=NH.sb.channel("presence-site",{config:{presence:{key}}});
  ch.on("presence",{event:"sync"},()=>{
    const st=ch.presenceState(), keys=Object.keys(st);
    PRES.n=keys.length; PRES.faces=keys.filter(k=>!k.startsWith("anon-")); renderPresence();
  }).subscribe(async s=>{ if(s==="SUBSCRIBED") await ch.track({t:Date.now()}); });
  PRES.ch=ch;
})();
const _renderHomeCM=renderHome;
renderHome=function(){
  _renderHomeCM();
  const up=$("v-home")?.querySelector(".upd-line"); if(up&&!up.querySelector(".presence-slot")){ up.insertAdjacentHTML("beforeend",`<span class="presence-slot"></span>`); renderPresence(); }
  const gd=$("v-home")?.querySelector(".gameday .gd-top"); if(gd&&!gd.querySelector(".presence-slot")){ gd.insertAdjacentHTML("beforeend",`<span class="presence-slot gd-pres"></span>`); renderPresence(); }
};
