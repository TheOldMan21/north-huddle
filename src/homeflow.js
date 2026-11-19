/* ===================== North Huddle: home page flow (Nov 2026 redesign, single column) =====================
   Runs after every other home-page module and rearranges what they drew:
   1. record + next game read as one block at the top, with "Make your pick" and "Where to watch"
   2. guests get one "Join the huddle" card instead of separate sign-in buttons (picks card hidden for guests)
   3. the AI recap folds into the last-game card: two sentences + Full recap / Box score / Flags
   4. the site alert is a calm card with a label
   5. the top story gets a big photo; on wide screens stories sit three across
   6. Field Goal Challenge and Kirko Chainz become two tiles under a "Play" heading */
const HF={busy:false, recap:null};
const hfSent=t=>{ const m=String(t||"").match(/[^.!?]+[.!?]+(\s|$)/g)||[String(t||"")]; let out=""; for(const x of m){ if(out&&(out+x).length>170) break; out+=x; } return out.trim(); };
function hfApply(){
  const home=$("v-home"), grid=home?.querySelector(".home-grid"); if(!grid||HF.busy) return; HF.busy=true;
  try{
    const hero=grid.querySelector(".hero"); if(hero) hero.classList.add("hf-hero");
    const cards=[...grid.querySelectorAll(".sb-row .game-card")];
    const next=cards.find(c=>/next game/i.test(c.querySelector(".gc-head .label")?.textContent||""));
    const last=cards.find(c=>/last game/i.test(c.querySelector(".gc-head .label")?.textContent||""));
    const row=grid.querySelector(".sb-row");
    // 1. next game joins the record block
    if(next&&hero){
      next.classList.add("hf-next"); hero.classList.add("hf-joined");
      if(next.parentElement!==hero.parentElement||next.previousElementSibling!==hero) hero.insertAdjacentElement("afterend",next);
      if(!next.querySelector(".hf-acts")){
        const w=next.querySelector("[data-watch]");
        next.insertAdjacentHTML("beforeend",`<div class="hf-acts"><button class="hf-btn hf-gold" data-hfpick="1">Make your pick</button>${w?`<button class="hf-btn hf-ghost" data-watch="${esc(w.dataset.watch||"")}" data-wlabel="${esc(w.dataset.wlabel||"")}">Where to watch</button>`:""}</div>`);
      }
    } else if(hero) hero.classList.remove("hf-joined");
    // 3. last game + recap
    if(last){
      last.classList.add("hf-last");
      if(row&&last.parentElement===row) row.insertAdjacentElement("beforebegin",last);
      const rc=grid.querySelector("#rcpCard");
      if(rc){
        const ps=[...rc.querySelectorAll(".rcp-p")].map(p=>p.textContent.trim()), id=rc.querySelector("[data-sbgame]")?.dataset.sbgame||"";
        HF.recap={title:rc.querySelector(".t1")?.textContent||"Game recap", label:rc.querySelector(".label")?.textContent.trim()||"", ps, id};
        rc.classList.add("hf-gone");
      }
      const id=HF.recap?.id||"";
      if(!last.querySelector(".hf-sum")&&HF.recap?.ps?.length) last.querySelector(".statline")?.insertAdjacentHTML("beforebegin",`<p class="hf-sum">${esc(hfSent(HF.recap.ps[0]))}</p>`);
      if(!last.querySelector(".hf-acts")&&(id||HF.recap)) last.insertAdjacentHTML("beforeend",`<div class="hf-acts hf-small">${HF.recap?.ps?.length?`<button class="tbtn" data-hfrecap="1">Full recap</button>`:""}${id?`<button class="tbtn" data-sbgame="${esc(id)}">Box score</button><button class="tbtn" data-sbgame="${esc(id)}" data-flagsgo="1">Flags</button>`:""}</div>`);
    }
    if(row&&!row.querySelector(".game-card")) row.classList.add("hf-gone"); else row?.classList.remove("hf-gone");
    // 2. one join card for guests
    const guest=!(ACC.id&&ACC.db);
    grid.querySelector("#predCard")?.classList.toggle("hf-gone",guest);
    let join=grid.querySelector(".hf-join");
    if(guest&&ACC.ready!==false){
      if(!join){ grid.querySelector(".col-main")?.insertAdjacentHTML("afterbegin",`<section class="card hf-join"><div class="hf-jt">Join the huddle — it's free</div><p class="t2">One account unlocks game picks, score predictions, pick'em and fantasy leagues with friends.</p><div class="hf-jr"><button class="hf-btn hf-grad" data-acct="1">Create free account</button><button class="hf-link" data-acct="1">Sign in</button></div></section>`); }
    } else join?.remove();
    // 4. alert label
    const al=grid.querySelector(".alert");
    if(al&&!al.querySelector(".hf-tag")){ const inj=/injur|hamstring|ankle|knee|concussion|questionable|doubtful|\bout\b|\bIR\b/i.test(al.textContent); al.insertAdjacentHTML("afterbegin",`<span class="hf-tag">${inj?"INJURY":"HEADS UP"}</span>`); }
    // 5. lead story
    const list=grid.querySelector(".sec-head + .list")||[...grid.querySelectorAll(".list")].find(l=>l.querySelector(".news-item"));
    if(list){ list.classList.add("hf-news"); const first=list.querySelector(".news-item"); list.querySelectorAll(".hf-lead").forEach(x=>{ if(x!==first) x.classList.remove("hf-lead"); }); first?.classList.add("hf-lead"); }
    // 6. play tiles
    const fg=grid.querySelector(".fg-card:not(.cg-card)"), cg=grid.querySelector(".cg-card");
    if(fg||cg){
      let play=grid.querySelector(".hf-play");
      if(!play){ grid.querySelector(".col-side")?.insertAdjacentHTML("beforeend",`<section class="hf-play"><h2>Play</h2><div class="hf-tiles"></div></section>`); play=grid.querySelector(".hf-play"); }
      const tiles=play?.querySelector(".hf-tiles");
      if(tiles){ [fg,cg].forEach(c=>{ if(c&&c.parentElement!==tiles){ c.classList.add("hf-tile"); tiles.appendChild(c); } }); }
    }
  }catch(e){ console.warn("homeflow",e); }
  HF.busy=false;
}
// the full recap opens in the sheet
document.addEventListener("click",e=>{
  if(e.target.closest("[data-hfrecap]")&&HF.recap){
    const r=HF.recap;
    $("sheet").innerHTML=`<div class="label">${esc(r.label)}</div><h2>${esc(r.title)}</h2>${r.ps.map(p=>`<p class="rcp-p">${esc(p)}</p>`).join("")}<p class="t2">Written by Huddle AI from the official play-by-play.</p>${r.id?`<div class="hf-acts hf-small"><button class="tbtn" data-sbgame="${esc(r.id)}">Box score</button><button class="tbtn" data-sbgame="${esc(r.id)}" data-flagsgo="1">Flags</button></div>`:""}`;
    $("sheetBg").hidden=false; $("closeSheet").focus(); return;
  }
  if(e.target.closest("[data-hfpick]")){
    if(!(ACC.id&&ACC.db)) return openAcct();
    const c=$("predCard"); if(c){ c.scrollIntoView({behavior:"smooth",block:"center"}); c.classList.remove("hf-flash"); void c.offsetWidth; c.classList.add("hf-flash"); }
  }
});
const _renderHomeHF=renderHome;
renderHome=function(){ _renderHomeHF(); hfApply(); };
// cards that arrive later (recap, picks, pick'em, the game tiles) get the same treatment
(()=>{ const home=$("v-home"); if(!home||typeof MutationObserver==="undefined") return; let q=0;
  new MutationObserver(()=>{ if(HF.busy||q) return; q=setTimeout(()=>{ q=0; hfApply(); },30); }).observe(home,{childList:true,subtree:true}); })();
accReady.then(()=>hfApply());
setInterval(()=>{ if(!document.hidden&&S.tab==="home") hfApply(); },2000);   // safety net for cards that redraw themselves
