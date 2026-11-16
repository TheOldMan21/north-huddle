/* ===================== North Huddle: flags breakdown (every penalty, per team) in the game sheet ===================== */
const FLG={};   // event id -> {d, at, loading}
async function loadFlags(id){ const f=FLG[id]||(FLG[id]={}); if(f.loading) return; f.loading=true;
  try{ const r=await fetch("/api/penalties?event="+encodeURIComponent(id)); if(r.ok){ f.d=await r.json(); f.at=Date.now(); } else f.err=1; }catch(e){ f.err=1; }
  f.loading=false; if(GM.sheet&&String(GM.sheet.id)===String(id)&&!$("sheetBg").hidden) renderGameSheet(); }
function flagsHtml(id){
  const f=FLG[id]; if(!f||(!f.d&&!f.err)) return `<div class="gs-sec" id="gsFlags"><div class="label">🚩 Flags</div>${skelRows(2)}</div>`;
  if(!f.d) return "";
  const teams=[...f.d.teams].sort((a,b)=>(b.abbr===CUR)-(a.abbr===CUR));
  if(!teams.some(t=>t.flags.length)) return `<div class="gs-sec" id="gsFlags"><div class="label">🚩 Flags</div><div class="t2">No flags ${f.d.final?"in this game":"yet"}.</div></div>`;
  const qn=q=>q>4?"OT":["1st","2nd","3rd","4th"][q-1]||"";
  const tbl=t=>`<div class="fl-team"><div class="fl-h">${badge(t.abbr)}<b>${esc(t.name)}</b><span class="fl-sum">${t.count} for ${t.yards} yds</span></div>
    ${t.flags.length?`<div class="fl-rows"><div class="fl-row fl-head"><span>Qtr</span><span>Time</span><span>Player</span><span>Infraction</span><span>Yds</span></div>
    ${t.flags.map(x=>`<details class="fl-d${x.status!=="accepted"?" fl-off":""}"><summary class="fl-row"><span>${qn(x.q)}</span><span class="num">${esc(x.clock)}</span><span class="fl-pl">${x.teamFlag?"Team":esc(x.player||"")}${x.pos?` <i>${esc(x.pos)}${x.jersey?" #"+esc(x.jersey):""}</i>`:""}</span><span>${esc(x.infraction)}${x.status!=="accepted"?` <em class="fl-st">${esc(x.status)}</em>`:""}</span><span class="num">${x.status==="accepted"?x.yards:"–"}</span></summary>
      <div class="fl-text">${x.dd?`<b>${esc(x.dd)}</b> · `:""}${esc(x.text)}</div></details>`).join("")}</div>`:`<div class="t2">No flags.</div>`}</div>`;
  return `<div class="gs-sec" id="gsFlags"><div class="label">🚩 Flags${f.d.final?"":" · live"}</div>${teams.map(tbl).join("")}<div class="t2 fl-note">Tap a flag to read the full play. Totals count accepted penalties.</div></div>`;
}
const _renderGameSheetFL=renderGameSheet;
renderGameSheet=function(){ _renderGameSheetFL(); const s=GM.sheet; if(!s) return;
  const x=(s.data?.games||LIVE.data?.games||[]).find(g=>String(g.id)===String(s.id)); if(!x||x.state==="pre") return;
  const f=FLG[s.id]; if(!f||(!f.loading&&!f.d?.final&&Date.now()-(f.at||0)>60e3)) loadFlags(s.id);
  const sh=$("sheet"); sh.querySelector("#gsFlags")?.remove();
  const open=[...sh.querySelectorAll("#gsFlags details[open]")].length;
  const anchor=sh.querySelector(".foot"); const html=flagsHtml(s.id); if(!html) return;
  if(anchor) anchor.insertAdjacentHTML("beforebegin",html); else sh.insertAdjacentHTML("beforeend",html);
  if(FLG.jump&&FLG[s.id]?.d){ FLG.jump=false; setTimeout(()=>$("gsFlags")?.scrollIntoView({behavior:"smooth",block:"start"}),60); } };
// "Flags" button on the home recap card jumps straight to the breakdown
document.addEventListener("click",e=>{ if(e.target.closest("[data-flagsgo]")) FLG.jump=true; },true);
if(typeof placeRecapCard==="function"){ const _placeRecapFL=placeRecapCard; placeRecapCard=function(){ _placeRecapFL(); const c=$("rcpCard"); if(!c||c.querySelector("[data-flagsgo]")) return;
  const b=c.querySelector("button[data-sbgame]"); if(b) b.insertAdjacentHTML("afterend",`<button class="tbtn" data-sbgame="${esc(b.dataset.sbgame)}" data-flagsgo="1">🚩 Flags</button>`); }; }
