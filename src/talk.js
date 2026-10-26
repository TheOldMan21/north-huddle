/* ===================== North Huddle: news comments + polls ===================== */
const nid=h=>{ let x=0; const s=String(h||""); for(let i=0;i<s.length;i++){ x=(x*31+s.charCodeAt(i))|0; } return "n"+(x>>>0).toString(36); };

/* ---------- comments on news ---------- */
const CMT={all:[], open:null, last:0};
function cmtFor(id){ return CMT.all.filter(c=>c.nid===id).sort((a,b)=>String(a.t).localeCompare(String(b.t))); }
const _newsItemT=newsItem;
newsItem=function(n){
  const id=nid(n.headline), c=cmtFor(id).length;
  return `<div class="news-wrap" data-nid="${id}">${_newsItemT(n)}<button class="nc-btn" data-ncom="${id}" data-nhead="${esc(n.headline)}">${ICO_CHAT}<span>${c?`${c} ${c===1?"comment":"comments"}`:"Comment"}</span></button></div>`;
};
const ICO_CHAT=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H8l-4 4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`;
function openComments(id,head){
  CMT.open={id,head}; renderComments(); $("sheetBg").hidden=false;
  setTimeout(()=>$("ncList")&&($("ncList").scrollTop=1e6),30);
}
function renderComments(){
  const o=CMT.open; if(!o) return;
  const list=cmtFor(o.id), inp=$("ncForm")?.querySelector("input"), keep=inp&&document.activeElement===inp, val=inp?.value||"";
  $("sheet").innerHTML=`<div class="sheet-head"><div><div class="label">Comments</div><div class="nm nc-title">${esc(o.head)}</div></div><button class="x" id="closeSheet" aria-label="Close">×</button></div>
    <div class="fc-list nc-list" id="ncList">${list.length?list.map(m=>`<div class="fc-msg${m.uid===ACC.id?" me":""}" data-mid="${esc(m.id)}" data-mcol="comments">${av(m.uid)}<div class="fc-body"><div class="fc-who"><b data-uname="${esc(m.uid)}">${esc(personName(m.uid))}</b> · ${esc(ago(m.t))}${ACC.owner||m.uid===ACC.id?` <button class="fc-del" data-ncdel="${esc(m.id)}" aria-label="Delete comment">×</button>`:""}</div><div class="fc-text">${esc(m.text)}</div></div></div>`).join(""):`<div class="fc-empty">No comments yet. Start the conversation!</div>`}</div>
    ${ACC.db&&ACC.id?`<form class="chat-in fc-form" id="ncForm">${av(ACC.id,"me")}<input maxlength="400" autocomplete="off" placeholder="Add a comment…" aria-label="Your comment"><button class="tbtn" type="submit">Post</button></form>`:`<button class="btn-gold" data-acct="1">Sign in to comment</button>`}`;
  const ni=$("ncForm")?.querySelector("input"); if(ni){ ni.value=val; if(keep) ni.focus(); }
  const l=$("ncList"); if(l) l.scrollTop=l.scrollHeight;
  if(typeof decorateReactions==="function") decorateReactions($("sheet"));
}
document.addEventListener("click",async e=>{
  const b=e.target.closest("[data-ncom]"); if(b){ e.preventDefault(); openComments(b.dataset.ncom,b.dataset.nhead); return; }
  const d=e.target.closest("[data-ncdel]"); if(d){ try{ await ACC.db.doc("comments/"+d.dataset.ncdel).delete(); }catch(err){ toast("Couldn't delete."); } }
  if(e.target.closest("#closeSheet")) CMT.open=null;
});
document.addEventListener("submit",async e=>{
  if(e.target.id!=="ncForm") return; e.preventDefault(); e.stopImmediatePropagation();
  const i=e.target.querySelector("input"), t=i.value.trim().slice(0,400); if(!t||!CMT.open) return;
  if(Date.now()-CMT.last<2500) return toast("Slow down a sec.");
  CMT.last=Date.now(); i.value="";
  try{ await ACC.db.collection("comments").add({uid:ACC.id, nid:CMT.open.id, head:CMT.open.head.slice(0,140), text:t, t:nowIso()}); }catch(err){ toast("Couldn't post. Try again."); }
},true);
(async()=>{
  await accReady; if(!ACC.db) return;
  ACC.db.collection("comments").orderBy("t","desc").limit(800).onSnapshot(s=>{
    CMT.all=s.docs.map(d=>({id:d.id,...d.data()}));
    document.querySelectorAll("[data-ncom]").forEach(b=>{ const c=cmtFor(b.dataset.ncom).length; b.querySelector("span").textContent=c?`${c} ${c===1?"comment":"comments"}`:"Comment"; });
    if(CMT.open&&!$("sheetBg").hidden) renderComments();
  },e=>console.warn("comments",e));
})();

/* ---------- polls ---------- */
// polls/<id> = {q, options:[...], open:bool, t}   (admin only)   votes/<pollId>__<uid> = {uid, poll, choice}
const POLL={polls:[], votes:[]};
function curPoll(){ return POLL.polls.filter(p=>p.open!==false).sort((a,b)=>String(b.t).localeCompare(String(a.t)))[0]||POLL.polls.slice().sort((a,b)=>String(b.t).localeCompare(String(a.t)))[0]||null; }
function pollHtml(){
  const p=curPoll(); if(!p) return "";
  const vs=POLL.votes.filter(v=>v.poll===p.id), mine=vs.find(v=>v.uid===ACC.id)?.choice, total=vs.length;
  const showRes=mine!=null||p.open===false||!ACC.id;
  const opts=(p.options||[]).map((o,i)=>{ const n=vs.filter(v=>v.choice===i).length, pct=total?Math.round(n/total*100):0;
    return `<button class="pl-opt${mine===i?" mine":""}" data-vote="${esc(p.id)}" data-choice="${i}" ${p.open===false||!ACC.id?"disabled":""}>${showRes?`<span class="pl-bar" style="width:${pct}%"></span>`:""}<span class="pl-txt">${esc(o)}</span>${showRes?`<span class="num pl-pct">${pct}%</span>`:""}</button>`; }).join("");
  return `<section class="card poll-card" id="pollCard" style="order:7"><div class="pred-head"><div><div class="label">Fan poll${p.open===false?" · closed":""}</div><div class="t1">${esc(p.q)}</div></div></div>${opts}
    <div class="t2">${total} ${total===1?"vote":"votes"}${!ACC.id&&p.open!==false?' · <button class="linkish" data-acct="1">Sign in to vote</button>':mine!=null&&p.open!==false?" · tap another answer to change":""}</div></section>`;
}
function placePoll(){ const el=$("v-home"); el?.querySelector("#pollCard")?.remove(); const h=pollHtml(); if(!h) return; const a=el.querySelector("#predCard")||el.querySelector(".sb-row")||el.querySelector(".upd-line"); a?.insertAdjacentHTML("afterend",h); }
const _renderHomeT=renderHome;
renderHome=function(){ _renderHomeT(); if(S.meta) placePoll(); };
document.addEventListener("click",async e=>{
  const b=e.target.closest("[data-vote]"); if(!b||b.disabled) return;
  if(!ACC.db||!ACC.id) return openAcct();
  try{ await ACC.db.doc(`votes/${b.dataset.vote}__${ACC.id}`).set({uid:ACC.id, poll:b.dataset.vote, choice:Number(b.dataset.choice), t:nowIso()}); }catch(err){ toast("Couldn't save your vote."); }
});
(async()=>{
  await accReady; if(!ACC.db) return;
  ACC.db.collection("polls").onSnapshot(s=>{ POLL.polls=s.docs.map(d=>({id:d.id,...d.data()})); if(S.tab==="home") placePoll(); if(!$("adminView")?.hidden&&ADM.tab==="polls") renderAdmin(); },e=>console.warn("polls",e));
  ACC.db.collection("votes").orderBy("t","desc").limit(1000).onSnapshot(s=>{ POLL.votes=s.docs.map(d=>({id:d.id,...d.data()})); if(S.tab==="home") placePoll(); if(!$("adminView")?.hidden&&ADM.tab==="polls") renderAdmin(); },e=>console.warn("votes",e));
})();
