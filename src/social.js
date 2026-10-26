/* ===================== North Huddle: chat reactions + Google sign-in ===================== */

/* ---------- reactions ---------- */
const EMO=[["up","👍"],["fire","🔥"],["lol","😂"],["wow","😮"],["sad","😢"],["love","💜"]];
const RX={all:[], open:null};
function rxFor(mid){ const m={}; RX.all.forEach(r=>{ if(r.msg===mid){ (m[r.e]||(m[r.e]=[])).push(r.uid); } }); return m; }
function rxRow(mid){
  const m=rxFor(mid), chips=EMO.filter(([k])=>m[k]?.length).map(([k,e])=>{ const mine=m[k].includes(ACC.id); return `<button class="rx-chip${mine?" mine":""}" data-rx="${esc(mid)}" data-rxe="${k}" aria-pressed="${mine}" title="${esc(m[k].map(personName).join(", "))}">${e} <span class="num">${m[k].length}</span></button>`; }).join("");
  const can=ACC.db&&ACC.id;
  const pick=RX.open===mid?`<div class="rx-pick" role="group" aria-label="Add a reaction">${EMO.map(([k,e])=>`<button data-rx="${esc(mid)}" data-rxe="${k}" aria-label="React ${e}">${e}</button>`).join("")}</div>`:"";
  return `<div class="rx-row">${chips}${can?`<button class="rx-add" data-rxadd="${esc(mid)}" aria-label="Add reaction">${RX.open===mid?"×":"☺︎+"}</button>`:""}${pick}</div>`;
}
function decorateReactions(root){
  (root||document).querySelectorAll(".fc-msg[data-mid]").forEach(m=>{
    const body=m.querySelector(".fc-body"); if(!body) return;
    body.querySelector(".rx-row")?.remove(); body.insertAdjacentHTML("beforeend",rxRow(m.dataset.mid));
  });
}
async function toggleRx(mid,e,col){
  if(!ACC.db||!ACC.id) return openAcct();
  const id=`${mid}__${ACC.id}__${e}`, has=RX.all.some(r=>r.id===id);
  RX.open=null;
  try{ if(has) await ACC.db.doc("reactions/"+id).delete(); else await ACC.db.doc("reactions/"+id).set({uid:ACC.id, msg:mid, e, col:col||"chat", t:nowIso()}); }
  catch(err){ toast("Couldn't react. Try again."); }
}
document.addEventListener("click",e=>{
  const a=e.target.closest("[data-rxadd]"); if(a){ RX.open=RX.open===a.dataset.rxadd?null:a.dataset.rxadd; decorateReactions(); return; }
  const r=e.target.closest("[data-rx]"); if(r){ const col=r.closest(".fc-msg")?.dataset.mcol||"chat"; toggleRx(r.dataset.rx,r.dataset.rxe,col); return; }
  if(RX.open&&!e.target.closest(".rx-row")){ RX.open=null; decorateReactions(); }
});
const _renderFanChatRX=renderFanChat;
renderFanChat=function(){ _renderFanChatRX(); if(FC.el) decorateReactions(FC.el); };
(async()=>{
  await accReady;
  if(ACC.db) ACC.db.collection("reactions").orderBy("t","desc").limit(1000).onSnapshot(s=>{ RX.all=s.docs.map(d=>({id:d.id,...d.data()})); decorateReactions(); },e=>console.warn("reactions",e));
})();

/* ---------- Sign in with Google ---------- */
NH.google=fetch("https://hoxcsdtbljhfappkshya.supabase.co/auth/v1/settings",{headers:{apikey:"sb_publishable_KON7uG5HO_MW7fi2JVo9aw_-mpduqIe"}}).then(r=>r.json()).then(d=>!!d?.external?.google).catch(()=>false);
const GICON=`<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>`;
const _openAcctG=openAcct;
openAcct=function(){
  _openAcctG();
  if(ACC.id) return;
  NH.google.then(on=>{
    const f=$("authForm"); if(!on||!f||$("gBtn")) return;
    f.insertAdjacentHTML("beforebegin",`<button class="g-btn" id="gBtn" type="button">${GICON}<span>Continue with Google</span></button><div class="or-line"><span>or use email</span></div>`);
  });
};
document.addEventListener("click",async e=>{
  if(!e.target.closest("#gBtn")) return;
  const {error}=await NH.sb.auth.signInWithOAuth({provider:"google",options:{redirectTo:location.origin+"/"}});
  if(error) toast("Google sign-in isn't available right now.");
});
// First Google sign-in: create the public profile from the Google account.
(async()=>{
  await accReady; if(!ACC.id||!ACC.db) return;
  try{
    const s=await NH.session, md=s?.user?.user_metadata||{};
    const ref=ACC.db.doc("profiles/"+ACC.id), cur=await ref.get();
    if(!cur.exists){ await ref.set({name:(md.full_name||md.name||"").slice(0,24), photo:md.avatar_url||md.picture||"", updatedAt:nowIso()}); }
    else { const d=cur.data(); if(!d.photo&&(md.avatar_url||md.picture)) await ref.update({photo:md.avatar_url||md.picture}); }
  }catch(err){}
})();
