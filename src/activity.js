/* ===================== North Huddle: visit log (admin Activity tab) ===================== */
// Records one row when someone opens the site (and again if they're still around 30 minutes later).
const DEVICE=(()=>{ try{ let d=localStorage.getItem("nh_dev"); if(!d){ d=Math.random().toString(36).slice(2,10); localStorage.setItem("nh_dev",d); } return d; }catch(e){ return "x"+Math.random().toString(36).slice(2,8); } })();
function deviceKind(){ const u=navigator.userAgent; return /iPhone/.test(u)?"iPhone":/iPad/.test(u)?"iPad":/Android/.test(u)?(/Mobile/.test(u)?"Android phone":"Android tablet"):/Mac/.test(u)?"Mac":/Windows/.test(u)?"Windows PC":/CrOS/.test(u)?"Chromebook":/Linux/.test(u)?"Computer":"Device"; }
async function logVisit(){
  try{
    const last=Number(sessionStorage.getItem("nh_vlog")||0); if(Date.now()-last<30*60e3) return;
    sessionStorage.setItem("nh_vlog",String(Date.now()));
  }catch(e){}
  await accReady;
  try{ await NH.sb.from("visits").insert({uid:ACC.id||null, device:DEVICE, kind:deviceKind(), app:!!(matchMedia("(display-mode: standalone)").matches||navigator.standalone), team:CUR}); }catch(e){}
}
logVisit();
setInterval(()=>{ if(!document.hidden) logVisit(); }, 5*60e3);
document.addEventListener("visibilitychange",()=>{ if(!document.hidden) logVisit(); });

/* ---------- admin tab ---------- */
const ACT={rows:[], err:"", loading:false, days:7};
async function loadActivity(){
  ACT.loading=true; ACT.err="";
  const since=new Date(Date.now()-ACT.days*864e5).toISOString();
  const {data,error}=await NH.sb.from("visits").select("at,uid,device,kind,app,team").gte("at",since).order("at",{ascending:false}).limit(1000);
  if(error) ACT.err=/visits|relation|schema/i.test(error.message)?"setup":error.message; else ACT.rows=data||[];
  ACT.loading=false; if(ADM.tab==="activity") renderAdmin();
}
function actName(r){ if(r.uid){ const u=ADM.users.find(x=>x.id===r.uid); return u?.name||(u?.email||"").split("@")[0]||"Member"; } return "Guest "+String(r.device||"").slice(0,4).toUpperCase(); }
function admActivity(){
  if(ACT.err==="setup") return `<div class="card"><b>One-time setup needed.</b><p class="acct-p">Copy github.com/TheOldMan21/north-huddle/blob/main/supabase/activity.sql and run it in Supabase → SQL Editor. Then tap Refresh.</p></div>`;
  if(ACT.err) return `<div class="card empty">Couldn't load activity: ${esc(ACT.err)}</div>`;
  if(ACT.loading&&!ACT.rows.length) return skelRows(5);
  const rows=ACT.rows.filter(r=>!(r.uid&&ADM.users.find(u=>u.id===r.uid&&/huddlebot@/i.test(u.email))));
  const dayKey=t=>new Date(t).toLocaleDateString("en-US",{timeZone:"America/Chicago"});
  const today=dayKey(Date.now()), todays=rows.filter(r=>dayKey(r.at)===today);
  const uniq=a=>new Set(a.map(r=>r.uid||("g"+r.device))).size;
  const members=new Set(rows.filter(r=>r.uid).map(r=>r.uid)).size, guests=new Set(rows.filter(r=>!r.uid).map(r=>r.device)).size;
  const stats=`<div class="adm-stats">${[["Visitors today",uniq(todays)],["Visits today",todays.length],[`Visitors (${ACT.days} days)`,uniq(rows)],["Members / guests",`${members} / ${guests}`]].map(([l,v])=>`<div class="adm-stat"><b class="num">${v}</b><span>${l}</span></div>`).join("")}</div>`;
  // per-day bar list
  const days=[]; for(let i=ACT.days-1;i>=0;i--){ const d=dayKey(Date.now()-i*864e5); days.push([d, uniq(rows.filter(r=>dayKey(r.at)===d))]); }
  const max=Math.max(1,...days.map(d=>d[1]));
  const chart=`<div class="card act-days">${days.map(([d,n])=>`<div class="act-day"><span class="act-d">${esc(new Date(d).toLocaleDateString("en-US",{weekday:"short",month:"numeric",day:"numeric"}))}</span><span class="act-bar"><span style="width:${n/max*100}%"></span></span><b class="num">${n}</b></div>`).join("")}</div>`;
  // latest visits, newest first (collapse repeats from the same person within an hour)
  const seen={}, list=[];
  rows.forEach(r=>{ const k=r.uid||r.device; if(seen[k]&&Date.parse(seen[k])-Date.parse(r.at)<36e5) return; seen[k]=r.at; list.push(r); });
  const avatar=r=>{ const u=r.uid&&ADM.users.find(x=>x.id===r.uid); return `<img class="av" src="${esc(u?.photo||BLANK_AV)}" alt="">`; };
  const feed=list.slice(0,150).map(r=>`<div class="row act-row">${avatar(r)}<div class="grow"><div class="t1">${esc(actName(r))}${r.uid?"":' <span class="chip">guest</span>'}</div><div class="t2">${esc(r.kind||"Device")}${r.app?" · app":""}${r.team&&r.team!=="MIN"?" · viewing "+esc(r.team):""}</div></div><div class="act-when"><div class="t1 num">${esc(new Date(r.at).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit",timeZone:"America/Chicago"}))}</div><div class="t2">${esc(dayKey(r.at)===today?"Today":new Date(r.at).toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric",timeZone:"America/Chicago"}))}</div></div></div>`).join("");
  return stats+`<div class="sb-head"><h2>Visitors per day</h2><div class="auth-seg act-range">${[1,7,30].map(d=>`<button data-actdays="${d}" aria-pressed="${ACT.days===d}">${d===1?"Today":d+" days"}</button>`).join("")}</div></div>${chart}<h2>Who opened the site</h2><div class="list">${feed||'<div class="card empty">No visits yet in this period.</div>'}</div><div class="foot">Members show by name. Guests (not signed in) show as a random code per device, with no personal info. Times are Central.</div>`;
}
document.addEventListener("click",e=>{ const b=e.target.closest("[data-actdays]"); if(b){ ACT.days=Number(b.dataset.actdays); loadActivity(); } });
