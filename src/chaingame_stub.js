/* Kirko Chainz — the light part that always loads: home card, profile badges, and a loader.
   The game itself (src/chaingame.js, ~100 KB) is built to /js/chaingame.js and only downloads when someone taps Play or Shop. */
function cgBest(){ try{ return JSON.parse(localStorage.getItem("nh_cgbest")||"{}"); }catch(e){ return {}; } }
function cgMoney(n){ return "$"+Math.round(n).toLocaleString(); }
function cgBankLite(){ try{ return (JSON.parse(localStorage.getItem("nh_cgwallet")||"{}").bank)||0; }catch(e){ return 0; } }
let CG_LOADP=null;
function cgLoad(){ return CG_LOADP=CG_LOADP||new Promise((ok,no)=>{ const s=document.createElement("script"); s.src="/js/chaingame.js?v=__CGV__"; s.onload=ok; s.onerror=()=>{ CG_LOADP=null; s.remove(); no(); }; document.head.appendChild(s); }); }
document.addEventListener("pointerdown",e=>{ if(e.target.closest("[data-chaingame],[data-cgshop]")) cgLoad().catch(()=>{}); },{passive:true});
document.addEventListener("click",e=>{ if(window.openChainGame) return; const sh=e.target.closest("[data-cgshop]"), pl=e.target.closest("[data-chaingame]"); if(!sh&&!pl) return; e.preventDefault();
  const card=e.target.closest(".cg-card"), t=card&&card.querySelector(".tbtn"); if(t) t.textContent="Loading…";
  cgLoad().then(()=>{ if(t) t.textContent="Play"; openChainGame(); if(sh) cgShopOpen(); }).catch(()=>{ if(t) t.textContent="Play"; toast("Couldn't load the game. Check your connection and try again."); }); });
const CG_ACH=[
  ["td","🏈","First Touchdown","Score a touchdown",250],["hat","🎩","Hat Trick","3 touchdowns in one game",500],["five","🖐️","Five Spot","5 touchdowns in one game",1500],
  ["deep40","🎯","Deep Threat","Complete a 40-yard pass",300],["deep50","🚀","Fifty Burger","Complete a 50-yard pass",750],["dive","🤸","Highlight Reel","Make a diving catch",250],
  ["ch10","⛓️","Ten Chains","10 chains in one game",400],["ch20","👑","Chain Gang","20 chains in one game",1000],["fire","🔥","On Fire","3 completions in a row",250],
  ["blaze","☄️","Blazing","5 completions in a row",500],["ten","⚡","Unstoppable","10 completions in a row",1500],["daily","📅","Daily Grinder","Finish a Daily Challenge",300],
  ["rich","💰","Ten Grand","Earn $10,000 all-time",500],["mil","🏦","Big Bank","Earn $100,000 all-time",2500],["shop","🛒","First Purchase","Buy something in the shop",100],
  ["trail","✨","Trailblazer","Buy a trail",200],["fireball","🔥","Chainz on Fire","Buy the Chainz on Fire ball",2500],["gameday","📺","Game Day Baller","Play during a live game",500]
];
const CGPF={};
if(typeof renderProfile==="function"){ const _rpCG=renderProfile; renderProfile=function(){ _rpCG(); const uid=PF.uid; if(!uid) return;
  if(CGPF[uid]===undefined){ CGPF[uid]=null; if(ACC.db) ACC.db.doc("scores/"+uid).get().then(s=>{ CGPF[uid]=s.exists?s.data():{}; if(PF.uid===uid&&!$("sheetBg").hidden&&$("sheet").querySelector(".pf-card")) renderProfile(); }).catch(()=>{ CGPF[uid]={}; }); return; }
  const d=CGPF[uid]; if(!d) return; const ach=(d.wallet&&d.wallet.ach)||{}, got=CG_ACH.filter(a=>ach[a[0]]), c=d.chain; if(!got.length&&!c) return;
  const h=$("sheet").querySelector("h2"); const html=`<h2>Kirko Chainz</h2><div class="cg-pf">${c?`<div class="t2">Best game <b>${cgMoney(c.bucks)}</b>${c.tds!=null?` · ${c.tds} TD`:""} · ${c.chains} chains</div>`:""}${got.length?`<div class="cg-pf-badges">${got.map(a=>`<span title="${esc(a[3])}">${a[1]} ${esc(a[2])}</span>`).join("")}</div>`:""}</div>`;
  if(h) h.insertAdjacentHTML("beforebegin",html); else $("sheet").insertAdjacentHTML("beforeend",html); }; }
const _renderHomeCG=renderHome;
renderHome=function(){ _renderHomeCG(); const el=$("v-home"); if(!S.meta||!el||el.querySelector(".cg-card")) return;
  const fg=el.querySelector(".fg-card"); const b=cgBest();
  const html=`<button class="card fg-card cg-card" data-chaingame="1"><span class="fg-ico">⛓️</span><span class="grow"><span class="lg-ft">Kirko Chainz</span><span class="t2">Hit your receiver, stack the chains, rack up Huddle Bucks.${b.bucks?` Best $${Number(b.bucks).toLocaleString()}`:""}${cgBankLite()?` · Bank ${cgMoney(cgBankLite())}`:""}</span></span><span class="tbtn">Play</span></button>`;
  if(fg){ fg.insertAdjacentHTML("afterend",html); const cg=el.querySelector(".cg-card"); if(cg) cg.style.order=fg.style.order||""; } };
