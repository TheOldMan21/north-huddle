/* ===================== North Huddle: pre-game win chances (ESPN Matchup Predictor) ===================== */
const PRD={data:null, at:0};
async function loadPredict(){ try{ const r=await fetch("/api/predict"); if(r.ok){ PRD.data=await r.json(); PRD.at=Date.now(); prdRefresh(); } }catch(e){} }
function prdFor(id){ return PRD.data?.games?.[String(id)]||null; }
function prdBar(id,opt={}){
  const p=prdFor(id); if(!p) return "";
  const ch=TEAM[p.home]||["#555","#999"], ca=TEAM[p.away]||["#555","#999"];
  const fav=p.homePct>=p.awayPct?p.home:p.away, favPct=Math.max(p.homePct,p.awayPct);
  return `<div class="prd${opt.compact?" compact":""}" title="ESPN Matchup Predictor">
    ${opt.compact?"":`<div class="prd-head"><span class="label">Win chance</span><span class="t2">${esc(TEAMS[fav]?.[1]||fav)} favored</span></div>`}
    <div class="prd-bar" role="img" aria-label="${esc(p.away)} ${p.awayPct}%, ${esc(p.home)} ${p.homePct}%"><span style="width:${p.awayPct}%;background:${ca[0]}"></span><span style="width:${p.homePct}%;background:${ch[0]}"></span></div>
    <div class="prd-lab"><b class="${p.awayPct>=p.homePct?"fav":""}">${esc(p.away)} ${Math.round(p.awayPct)}%</b>${opt.compact?"":`<span class="t2">ESPN projection</span>`}<b class="${p.homePct>p.awayPct?"fav":""}">${esc(p.home)} ${Math.round(p.homePct)}%</b></div></div>`;
}
function curPreId(){ const g=(LIVE.data?.games||[]).find(x=>(x.home===CUR||x.away===CUR)&&x.state==="pre"); return g?.id||null; }
function prdRefresh(){
  if(S.tab==="home") placePrdHome();
  if(S.tab==="games"&&(GM.mode==="scores"||GM.mode==="pickem")) renderGames();
  if(GM.sheet&&!$("sheetBg").hidden&&$("sheet").querySelector(".gs-score")) renderGameSheet();
}
// Home: under the next-game countdown
function placePrdHome(){
  const id=curPreId(), cd=$("v-home")?.querySelector("#countdown"); if(!cd) return;
  const card=cd.closest(".game-card"); card.querySelector(".prd")?.remove();
  const p=id&&prdFor(id), nxt=S.games.find(g=>g.status==="scheduled"&&g.kickoff&&Date.parse(g.kickoff)>Date.now());
  if(!p||(nxt&&![p.home,p.away].includes(nxt.oppAbbr))) return;   // only when it's the same game the card shows
  const h=prdBar(id); if(h) cd.insertAdjacentHTML("afterend",h);
}
const _renderHomePR=renderHome; renderHome=function(){ _renderHomePR(); placePrdHome(); };
// All scores: a slim bar under each upcoming game
const _gameRowPR=gameRow;
gameRow=function(x){ const h=_gameRowPR(x); if(x.state!=="pre") return h; const b=prdBar(x.id,{compact:true}); return b?h.replace(/<\/button>\s*$/,b+"</button>"):h; };
// Game details: a full bar before kickoff
const _renderGameSheetPR=renderGameSheet;
renderGameSheet=function(){ _renderGameSheetPR(); const s=GM.sheet; if(!s) return; const x=(s.data?.games||LIVE.data?.games||[]).find(g=>String(g.id)===String(s.id)); if(!x||x.state!=="pre") return;
  const b=prdBar(x.id); if(!b) return; const hd=$("sheet").querySelector(".sheet-head"); hd?.insertAdjacentHTML("afterend",`<div class="gs-sec">${b}</div>`); };
// Pick'em: a hint under each open game
if(typeof pkRow==="function"){ const _pkRowPR=pkRow; pkRow=function(x){ const h=_pkRowPR(x); if(x.state!=="pre") return h; const b=prdBar(x.id,{compact:true}); return b?h.replace(/<\/div>\s*$/,b+"</div>"):h; }; }
loadPredict(); setInterval(()=>{ if(!document.hidden) loadPredict(); },30*60e3);
