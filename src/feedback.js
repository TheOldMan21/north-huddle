/* ===================== North Huddle: feedback button + owner inbox ===================== */
const FB={kind:"idea", sending:false, rows:[], err:"", loaded:false, filter:"new", unread:0};
const ICO_FB=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M8 9h8M8 12h5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
const FB_KINDS=[["idea","💡 Idea"],["bug","🐞 Something's broken"],["other","💬 Other"]];
function openFeedback(kind){
  if(kind) FB.kind=kind;
  const nm=ACC.id?personName(ACC.id):"";
  $("sheet").innerHTML=`<div class="sheet-head"><div><div class="label">Feedback</div><div class="nm" style="font-size:26px">Send a suggestion</div></div><button class="x" id="closeSheet" aria-label="Close">×</button></div>
    <p class="acct-p">Ideas, bugs, anything. It goes straight to the person who runs North Huddle.</p>
    <form id="fbForm" class="fb-form">
      <div class="fb-kinds" role="group" aria-label="What kind of feedback">${FB_KINDS.map(([k,l])=>`<button type="button" data-fbkind="${k}" aria-pressed="${FB.kind===k}">${l}</button>`).join("")}</div>
      <label class="fb-l"><span>Your message</span><textarea name="text" maxlength="2000" rows="5" required placeholder="${FB.kind==="bug"?"What happened, and what were you doing when it happened?":"What would make North Huddle better?"}"></textarea></label>
      ${ACC.id?`<div class="t2">Sending as <b>${esc(nm)}</b></div>`:`<label class="fb-l"><span>Name <span class="t2">(optional)</span></span><input name="name" maxlength="60" autocomplete="nickname"></label>`}
      <label class="fb-l"><span>Email for a reply <span class="t2">(optional)</span></span><input name="contact" type="email" maxlength="120" autocomplete="email" inputmode="email" value="${esc(ACC.id?(ACC.me?.email||""):"")}"></label>
      <button class="btn-gold" type="submit" id="fbGo">Send feedback</button>
    </form>`;
  $("sheetBg").hidden=false; setTimeout(()=>$("fbForm")?.querySelector("textarea")?.focus(),60);
}
document.addEventListener("click",e=>{
  if(e.target.closest("[data-feedback]")){ e.preventDefault(); openFeedback(); return; }
  const k=e.target.closest("[data-fbkind]"); if(k){ FB.kind=k.dataset.fbkind; document.querySelectorAll("[data-fbkind]").forEach(b=>b.setAttribute("aria-pressed",String(b===k))); const ta=$("fbForm")?.querySelector("textarea"); if(ta) ta.placeholder=FB.kind==="bug"?"What happened, and what were you doing when it happened?":"What would make North Huddle better?"; }
});
document.addEventListener("submit",async e=>{
  if(e.target.id!=="fbForm") return; e.preventDefault(); e.stopImmediatePropagation();
  if(FB.sending) return;
  const fd=new FormData(e.target), text=String(fd.get("text")||"").trim();
  if(text.length<3) return toast("Add a little more detail first.");
  try{ const last=Number(localStorage.getItem("nh_fb_last")||0); if(Date.now()-last<30e3) return toast("Thanks! Give it a few seconds before sending another."); }catch(err){}
  FB.sending=true; $("fbGo").disabled=true; $("fbGo").textContent="Sending…";
  const row={uid:ACC.id||null, name:ACC.id?personName(ACC.id).slice(0,60):String(fd.get("name")||"").trim().slice(0,60), contact:String(fd.get("contact")||"").trim().slice(0,120),
    kind:FB.kind, text:text.slice(0,2000), page:String(S.tab||"").slice(0,40), device:(typeof deviceKind==="function"?deviceKind():"").slice(0,40)};
  const {error}=await NH.sb.from("feedback").insert(row);
  FB.sending=false;
  if(error){ $("fbGo").disabled=false; $("fbGo").textContent="Send feedback"; return toast(/relation|schema|does not exist/i.test(error.message)?"Feedback isn't set up yet. Try again later.":/Too many/i.test(error.message)?"Too many messages. Try again in a few minutes.":"Couldn't send. Try again."); }
  try{ localStorage.setItem("nh_fb_last",String(Date.now())); }catch(err){}
  $("sheet").innerHTML=`<div class="sheet-head"><div><div class="label">Feedback</div><div class="nm" style="font-size:26px">Thanks! 🙌</div></div><button class="x" id="closeSheet" aria-label="Close">×</button></div>
    <p class="acct-p">Your message was sent. Every suggestion gets read.</p><button class="btn-gold" id="closeSheet">Done</button>`;
});
// entry points: footer link + account sheet
function feedbackLinks(){
  const f=$("nhFoot")?.querySelector(".nf-links"); if(f&&!f.querySelector("[data-feedback]")) f.insertAdjacentHTML("beforeend",`<a href="#" data-feedback="1">Send feedback</a>`);
}
const _renderHomeFB=renderHome; renderHome=function(){ _renderHomeFB(); feedbackLinks(); };
setTimeout(feedbackLinks,1500);
const _openAcctFB=openAcct;
openAcct=function(){ _openAcctFB(); const sh=$("sheet"); if(sh.querySelector(".fb-acct")) return;
  const anchor=sh.querySelector("[data-signout]")||sh.querySelector(".acct-install");
  const html=`<button class="tbtn fb-acct" data-feedback="1">${ICO_FB} Send feedback or an idea</button>`;
  if(anchor) anchor.insertAdjacentHTML("beforebegin",html); else sh.insertAdjacentHTML("beforeend",html); };

/* ---------- owner inbox (admin page → Inbox) ---------- */
async function loadInbox(){
  const {data,error}=await NH.sb.from("feedback").select("*").order("at",{ascending:false}).limit(300);
  if(error){ FB.err=/relation|schema|does not exist/i.test(error.message)?"setup":error.message; }
  else { FB.err=""; FB.rows=data||[]; }
  FB.loaded=true; FB.unread=FB.rows.filter(r=>r.status==="new").length; inboxBadge();
  if(!$("adminView")?.hidden&&ADM.tab==="inbox") renderAdmin();
}
function inboxBadge(){
  const n=FB.unread, b=$("admHdrBtn"); if(b){ b.querySelector(".fb-dot")?.remove(); if(n) b.insertAdjacentHTML("beforeend",`<span class="fb-dot" aria-label="${n} new feedback">${n>9?"9+":n}</span>`); }
  const t=document.querySelector('[data-adm-tab="inbox"]'); if(t) t.textContent=n?`Inbox (${n})`:"Inbox";
}
function admInbox(){
  if(FB.err==="setup") return `<div class="card"><b>One-time setup needed.</b><p class="acct-p">Copy github.com/TheOldMan21/north-huddle/blob/main/supabase/round4.sql and run it in Supabase → SQL Editor. Then tap Refresh.</p></div>`;
  if(FB.err) return `<div class="card empty">Couldn't load feedback: ${esc(FB.err)}</div>`;
  if(!FB.loaded) return skelRows(4);
  const rows=FB.rows.filter(r=>FB.filter==="all"?true:FB.filter==="done"?r.status==="done":r.status!=="done");
  const label={idea:"💡 Idea",bug:"🐞 Bug",other:"💬 Other"};
  const who=r=>r.uid?`<span data-uname="${esc(r.uid)}">${esc(personName(r.uid)||r.name||"Member")}</span>`:esc(r.name||"Guest");
  const list=rows.map(r=>`<div class="card fb-item${r.status==="new"?" new":""}">
      <div class="fb-top">${r.uid?av(r.uid):`<img class="av" src="${BLANK_AV}" alt="">`}<div class="grow"><div class="t1">${who(r)} ${r.status==="new"?'<span class="chip new">NEW</span>':""}</div>
        <div class="t2">${esc(label[r.kind]||r.kind)} · ${esc(new Date(r.at).toLocaleString("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit",timeZone:"America/Chicago"}))} CT${r.device?` · ${esc(r.device)}`:""}${r.page?` · on ${esc(r.page)}`:""}</div></div></div>
      <div class="fb-text">${esc(r.text)}</div>
      <div class="pa-btns">${r.contact?`<a class="tbtn" href="mailto:${encodeURIComponent(r.contact)}?subject=${encodeURIComponent("Re: your North Huddle feedback")}">Reply by email</a>`:""}
        ${r.status!=="done"?`<button class="tbtn" data-fbset="${r.id}" data-st="done">Mark done</button>`:`<button class="tbtn" data-fbset="${r.id}" data-st="read">Reopen</button>`}
        ${r.status==="new"?`<button class="tbtn" data-fbset="${r.id}" data-st="read">Mark read</button>`:""}
        ${ADM.arm==="fb:"+r.id?`<button class="tbtn adm-danger" data-fbdel="${r.id}">Tap to confirm delete</button>`:`<button class="tbtn" data-adm-arm="fb:${r.id}">Delete</button>`}</div></div>`).join("");
  return `<div class="sb-head"><h2>Feedback inbox</h2><div class="auth-seg">${[["new","Open"],["done","Done"],["all","All"]].map(([k,l])=>`<button data-fbfilter="${k}" aria-pressed="${FB.filter===k}">${l}</button>`).join("")}</div></div>
    ${list||`<div class="card empty">${FB.filter==="done"?"Nothing marked done yet.":"No open feedback. You're all caught up!"}</div>`}
    <div class="foot">Members and guests send these from "Send feedback" in the footer or their account menu. Only admins can see them.</div>`;
}
const _renderAdminFB=renderAdmin;
renderAdmin=function(){
  const ov=$("adminView");
  if(ov&&!ov.querySelector('[data-adm-tab="inbox"]')) ov.querySelector(".adm-tabs")?.insertAdjacentHTML("afterbegin",`<button data-adm-tab="inbox">Inbox</button>`);
  if(ADM.tab!=="inbox"){ _renderAdminFB(); inboxBadge(); return; }
  ov.querySelectorAll("[data-adm-tab]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.admTab===ADM.tab)));
  ov.querySelector(".adm-body").innerHTML=admInbox(); inboxBadge();
};
document.addEventListener("click",async e=>{
  const t=e.target;
  if(t.closest("[data-adm-tab]")?.dataset.admTab==="inbox"||t.closest("[data-adm-refresh]")){ loadInbox(); }
  const f=t.closest("[data-fbfilter]"); if(f){ FB.filter=f.dataset.fbfilter; renderAdmin(); return; }
  const s=t.closest("[data-fbset]"); if(s){ const id=Number(s.dataset.fbset), st=s.dataset.st; const {error}=await NH.sb.from("feedback").update({status:st}).eq("id",id); if(error) return toast("Couldn't update."); const r=FB.rows.find(x=>x.id===id); if(r) r.status=st; FB.unread=FB.rows.filter(x=>x.status==="new").length; renderAdmin(); return; }
  const d=t.closest("[data-fbdel]"); if(d){ const id=Number(d.dataset.fbdel); const {error}=await NH.sb.from("feedback").delete().eq("id",id); if(error) return toast("Couldn't delete."); FB.rows=FB.rows.filter(x=>x.id!==id); FB.unread=FB.rows.filter(x=>x.status==="new").length; ADM.arm=null; renderAdmin(); toast("Deleted."); }
});
// open the inbox first when there's something new; keep the header count fresh
const _openAdminFB=openAdmin;
openAdmin=function(){ if(FB.unread) ADM.tab="inbox"; _openAdminFB(); renderAdmin(); loadInbox(); };
accReady.then(()=>{ if(!ACC.owner) return; setTimeout(loadInbox,1500); setInterval(()=>{ if(!document.hidden) loadInbox(); },120e3); });
