/* ===================== North Huddle: install as app, share links, phone alerts ===================== */
const VAPID_PUBLIC="BEFdln3zV7LK4fnUTaxsN4B5k5an8fVcTNIOWeBflafUW4_MXyI9ycPVRy54rDAm37873iC9y5xTs-aRp6k1VJ0";
const APP={prompt:null, reg:null, sub:null, prefs:null};
if("serviceWorker" in navigator){ navigator.serviceWorker.register("/sw.js").then(r=>{ APP.reg=r; return r.pushManager?.getSubscription(); }).then(s=>{ APP.sub=s||null; }).catch(()=>{}); }
window.addEventListener("beforeinstallprompt",e=>{ e.preventDefault(); APP.prompt=e; showInstallBanner(); });
window.addEventListener("appinstalled",()=>{ APP.prompt=null; document.getElementById("installBar")?.remove(); toast("North Huddle is on your home screen!"); });
const isStandalone=()=>matchMedia("(display-mode: standalone)").matches||navigator.standalone;
function showInstallBanner(){
  if(isStandalone()||store.get("nh_install_x")||document.getElementById("installBar")) return;
  document.body.insertAdjacentHTML("beforeend",`<div class="install-bar" id="installBar" role="region" aria-label="Install app"><img src="/icon-192.png" alt=""><div class="grow"><b>Get the North Huddle app</b><span>Home screen icon, full screen, game alerts.</span></div><button class="btn-gold" data-install="1">Install</button><button class="x" data-install-x="1" aria-label="Dismiss">×</button></div>`);
}
async function doInstall(){ if(!APP.prompt) return toast("Open your browser menu (⋮) and choose Add to Home screen."); APP.prompt.prompt(); try{ await APP.prompt.userChoice; }catch(e){} APP.prompt=null; document.getElementById("installBar")?.remove(); }
document.addEventListener("click",e=>{
  if(e.target.closest("[data-install]")) return doInstall();
  if(e.target.closest("[data-install-x]")){ store.set("nh_install_x","1"); document.getElementById("installBar")?.remove(); }
});

/* ---------- share links ---------- */
async function shareLink(hash,title){
  const url=location.origin+"/"+hash;
  try{ if(navigator.share){ await navigator.share({title:title||"North Huddle", url}); return; } }catch(e){ if(e?.name==="AbortError") return; }
  try{ await navigator.clipboard.writeText(url); toast("Link copied!"); }catch(e){ prompt("Copy this link:",url); }
}
const ICO_SHARE=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5M5 13v6h14v-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
document.addEventListener("click",e=>{ const b=e.target.closest("[data-share]"); if(b){ e.preventDefault(); shareLink(b.dataset.share,b.dataset.stitle); } });
// add share buttons to the game sheet, player sheets and league invites
const _renderGameSheetA=renderGameSheet;
renderGameSheet=function(){ _renderGameSheetA(); const f=$("sheet").querySelector(".foot"); if(f&&GM.sheet&&!$("sheet").querySelector("[data-share]")) f.insertAdjacentHTML("beforebegin",`<button class="tbtn nh-share" data-share="#game/${esc(GM.sheet.id)}" data-stitle="Live on North Huddle">${ICO_SHARE} Share this game</button>`); };
document.addEventListener("click",e=>{ const row=e.target.closest("[data-lp]"); if(!row||e.target.closest("button")) return; setTimeout(()=>{ const [abbr,name]=row.dataset.lp.split(/\|(.+)/); const f=$("sheet").querySelector(".foot"); if(f&&!$("sheet").querySelector("[data-share]")) f.insertAdjacentHTML("beforebegin",`<button class="tbtn nh-share" data-share="#player/${esc(abbr)}/${esc(encodeURIComponent(name))}" data-stitle="${esc(name)} on North Huddle">${ICO_SHARE} Share player</button>`); },0); });
if(typeof renderSetup==="function"){ const _rs=renderSetup; renderSetup=function(L,isC){ return _rs(L,isC).replace(/(<li>Send them this league code:[^<]*<b class="lg-code">[^<]*<\/b>)/,`$1 <button class="tbtn nh-share" data-share="#league/${esc(L.id)}" data-stitle="Join my North Huddle fantasy league">${ICO_SHARE} Share invite link</button>`); }; }

/* ---------- deep links: #game/ID  #team/GB  #player/GB/Name  #league/CODE  #scores  #standings  #news ---------- */
async function route(){
  const h=decodeURIComponent(location.hash.slice(1)); if(!h) return;
  const [k,a,b]=h.split("/");
  if(k==="game"&&a){ setTab("games"); GM.mode="scores"; renderGames(); openGameSheet(a); }
  else if(k==="team"&&TEAMS[(a||"").toUpperCase()]) setTeam(a.toUpperCase());
  else if(k==="player"&&a&&b){ setTab("players"); setPmode("tracker"); await loadLeaguePlayers(); const p=lpFind(b,a.toUpperCase()); if(p){ const fake=document.createElement("div"); fake.dataset.lp=a.toUpperCase()+"|"+p.name; fake.setAttribute("data-lp",fake.dataset.lp); document.body.appendChild(fake); fake.click(); fake.remove(); } }
  else if(k==="league"&&a){ setTab("fantasy"); FX.sec="league"; renderFantasy(); setTimeout(()=>{ const i=document.querySelector('form[data-lform=join] input[name=code]'); if(i){ i.value=a; i.closest("form").scrollIntoView({block:"center"}); toast("Enter a team name and tap Join."); } else if(!ACC.id){ toast("Sign in to join the league."); } },600); }
  else if(k==="scores"||k==="standings"){ setTab("games"); GM.mode=k; renderGames(); }
  else if(k==="news") setTab("news");
  else return;
  history.replaceState(null,"",location.pathname);
}
window.addEventListener("hashchange",route);
accReady.then(()=>setTimeout(route,300));

/* ---------- phone alerts (web push) ---------- */
const b64u=s=>{ const p="=".repeat((4-s.length%4)%4), b=atob((s+p).replace(/-/g,"+").replace(/_/g,"/")); return Uint8Array.from(b,c=>c.charCodeAt(0)); };
const PUSH_DEF={scores:true, final:true, kickoff:true, digest:true};
async function loadPushPrefs(){
  if(!ACC.id||!APP.sub) return null;
  try{ const {data}=await NH.sb.from("push_subs").select("prefs").eq("endpoint",APP.sub.endpoint).maybeSingle(); APP.prefs=data?.prefs||null; }catch(e){}
  return APP.prefs;
}
async function enablePush(){
  if(!ACC.id) return openAcct();
  if(!("Notification" in window)||!APP.reg?.pushManager) return toast("Your browser can't do notifications here. Install the app first, then try again.");
  const perm=await Notification.requestPermission(); if(perm!=="granted") return toast("Notifications are blocked. Allow them in your browser settings.");
  try{
    APP.sub=await APP.reg.pushManager.getSubscription()||await APP.reg.pushManager.subscribe({userVisibleOnly:true, applicationServerKey:b64u(VAPID_PUBLIC)});
    const prefs={...PUSH_DEF, ...(APP.prefs||{}), team:CUR};
    const {error}=await NH.sb.from("push_subs").upsert({endpoint:APP.sub.endpoint, uid:ACC.id, sub:APP.sub.toJSON(), prefs});
    if(error) throw error; APP.prefs=prefs; toast("Game alerts are on!"); openAcct();
  }catch(e){ console.warn(e); toast("Couldn't turn on alerts. Try again."); }
}
async function setPushPref(k,v){ if(!APP.sub) return; APP.prefs={...PUSH_DEF,...(APP.prefs||{}),[k]:v, team:CUR}; await NH.sb.from("push_subs").update({prefs:APP.prefs}).eq("endpoint",APP.sub.endpoint); }
async function disablePush(){ try{ if(APP.sub){ await NH.sb.from("push_subs").delete().eq("endpoint",APP.sub.endpoint); await APP.sub.unsubscribe(); } }catch(e){} APP.sub=null; APP.prefs=null; toast("Game alerts are off."); openAcct(); }
function pushPanel(){
  const on=!!(APP.sub&&APP.prefs), p={...PUSH_DEF,...(APP.prefs||{})};
  const row=(k,l)=>`<label class="pa-row"><span>${l}</span><input type="checkbox" data-pushpref="${k}" ${p[k]?"checked":""}></label>`;
  return `<div class="card push-panel"><div class="t1">${ICO_BELL} Game alerts</div>
    ${on?`<div class="t2">For the ${esc(TEAMS[p.team||CUR]?.[1]||"Vikings")}. Switch teams and alerts follow.</div>${row("scores","Scoring plays (touchdowns & field goals)")}${row("final","Final scores")}${row("kickoff","Kickoff reminders (1 hour before)")}${row("digest","Monday morning digest")}<div class="pa-btns"><button class="tbtn" data-pushtest="1">Send me a test alert</button><button class="tbtn" data-pushoff="1">Turn off alerts</button></div>`
      :`<div class="t2">Get a phone notification for touchdowns, final scores, kickoff and a Monday morning digest.${isStandalone()?"":" Works best after you install the app."}</div><button class="btn-gold" data-pushon="1">Turn on game alerts</button>`}
    ${!isStandalone()&&APP.prompt?`<button class="tbtn" data-install="1">Install the app</button>`:""}</div>`;
}
const ICO_BELL=`<svg viewBox="0 0 24 24" aria-hidden="true" class="ico-bell"><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`;
const _openAcctP=openAcct;
openAcct=function(){
  _openAcctP();
  if(!ACC.id) return;
  const sh=$("sheet"), anchor=sh.querySelector(".adm-btn")||sh.querySelector("[data-signout]");
  const ins=()=>{ sh.querySelector(".push-panel")?.remove(); (anchor?anchor:sh.lastElementChild).insertAdjacentHTML(anchor?"beforebegin":"afterend",pushPanel()); };
  ins(); if(APP.sub&&!APP.prefs) loadPushPrefs().then(()=>{ if(!$("sheetBg").hidden) ins(); });
};
document.addEventListener("click",async e=>{ if(e.target.closest("[data-pushtest]")){ try{ await ACC.db.doc("requests/pushtest-"+ACC.id).set({kind:"pushtest", by:ACC.id, status:"pending", at:nowIso()}); toast("Test alert is on its way. It should arrive within a minute.",6000); }catch(err){ toast("Couldn't request a test alert."); } return; } });
document.addEventListener("click",e=>{ if(e.target.closest("[data-pushon]")) enablePush(); else if(e.target.closest("[data-pushoff]")) disablePush(); });
document.addEventListener("change",e=>{ const c=e.target.closest("[data-pushpref]"); if(c) setPushPref(c.dataset.pushpref,c.checked); });
const _setTeamP=setTeam;
setTeam=function(a){ _setTeamP(a); if(APP.sub&&APP.prefs&&APP.prefs.team!==a) setPushPref("team",a).catch(()=>{}); };
