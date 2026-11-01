/* ===================== North Huddle: game highlights (ESPN clips, standout games first) ===================== */
const HL={data:null, at:0, busy:false};
async function loadHL(force){
  if(HL.busy||(!force&&HL.data&&Date.now()-HL.at<10*60e3)) return;
  HL.busy=true;
  try{ const r=await fetch("/api/highlights"); if(r.ok){ HL.data=await r.json(); HL.at=Date.now(); } }catch(e){}
  HL.busy=false; hlRefresh();
}
function hlRefresh(){
  if(S.tab==="news"&&S.ntype==="highlights") renderNews();
  if(S.tab==="home") placeHLCard();
  if(GM.sheet&&!$("sheetBg").hidden&&$("sheet").querySelector(".gs-score")) renderGameSheet();
}
const hlDur=s=>s?`${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`:"";
const hlLine=g=>`${esc(g.away)} ${g.as} @ ${esc(g.home)} ${g.hs}`;
function hlVid(v,g,showGame){
  return `<a class="hl-vid" href="${esc(v.url)}" target="_blank" rel="noopener"><span class="hl-th"><img src="${esc(v.thumb)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"><span class="hl-play">${PLAY}</span>${v.dur?`<span class="hl-dur num">${hlDur(v.dur)}</span>`:""}</span>
    <span class="hl-t">${esc(v.title)}</span>${showGame&&g?`<span class="hl-g">${hlLine(g)}${g.state==="post"?" · Final":""}</span>`:""}</a>`;
}
function hlGameHtml(g){
  const mine=g.home===CUR||g.away===CUR;
  return `<section class="card hl-game${mine?" mine":""}"><div class="hl-gh"><span class="hl-score">${badge(g.away)}<b class="num">${g.as}</b><span class="t2">@</span><b class="num">${g.hs}</b>${badge(g.home)}</span>
    <span class="t2">${esc(g.state==="post"?(g.detail||"Final"):"LIVE · "+g.detail)}</span>${g.tag?`<span class="chip up">${esc(g.tag)}</span>`:""}<button class="tbtn hl-box" data-sbgame="${esc(g.id)}">Box score</button></div>
    <div class="hl-row">${g.videos.map(v=>hlVid(v,g,false)).join("")}</div></section>`;
}
function hlPick(g){ return g.videos.find(v=>/Final Game Highlight/i.test(v.type))||g.videos[0]; }
const _renderNewsHL=renderNews;
renderNews=function(){
  if(S.ntype!=="highlights") return _renderNewsHL();
  const el=$("newsBody"), d=HL.data;
  if(!d){ loadHL(); el.innerHTML=skelRows(4); return; }
  const gs=d.games||[], mine=gs.filter(g=>g.home===CUR||g.away===CUR), rest=gs.filter(g=>!(g.home===CUR||g.away===CUR));
  if(!gs.length){ el.innerHTML=`<div class="card empty">Highlights show up here after games are played. Check back Sunday!</div>`; return; }
  el.innerHTML=(mine.length?`<h2>${esc(NICK())} highlights</h2>${mine.map(hlGameHtml).join("")}`:"")
    +(rest.length?`<h2>Games that stood out${d.week?` · Week ${esc(d.week)}`:""}</h2>${rest.map(hlGameHtml).join("")}`:"")
    +`<div class="foot">Highlights from ESPN. Videos open on ESPN.</div>`;
};
// News tab: add the Highlights button
(function(){ const seg=$("newsSeg"); if(seg&&!seg.querySelector('[data-ntype="highlights"]')) seg.insertAdjacentHTML("beforeend",`<button data-ntype="highlights" aria-pressed="false">Highlights</button>`); })();

// Home: top highlights strip
function placeHLCard(){
  const el=$("v-home"); if(!el||!S.meta) return;
  const d=HL.data; if(!d){ loadHL(); return; }
  const gs=d.games||[]; el.querySelector("#hlCard")?.remove(); if(!gs.length) return;
  const order=[...gs.filter(g=>g.home===CUR||g.away===CUR), ...gs.filter(g=>!(g.home===CUR||g.away===CUR))].slice(0,6);
  const html=`<section class="card hl-card" id="hlCard" style="order:6"><div class="pred-head"><div><div class="label">Highlights${d.week?` · Week ${esc(d.week)}`:""}</div><div class="t1">Games that stood out</div></div><button class="tbtn" data-hlall="1">See all</button></div>
    <div class="hl-row">${order.map(g=>hlVid(hlPick(g),g,true)).join("")}</div></section>`;
  const a=el.querySelector("#rcpCard")||el.querySelector(".sb-row")||el.querySelector(".upd-line"); a?.insertAdjacentHTML("afterend",html);
}
document.addEventListener("click",e=>{ if(e.target.closest("[data-hlall]")){ S.ntype="highlights"; setTab("news"); document.querySelectorAll("#newsSeg button").forEach(x=>x.setAttribute("aria-pressed",String(x.dataset.ntype==="highlights"))); renderNews(); } });
const _renderHomeHL=renderHome; renderHome=function(){ _renderHomeHL(); placeHLCard(); };

// Game sheet: that game's clips
const _renderGameSheetHL=renderGameSheet;
renderGameSheet=function(){
  _renderGameSheetHL();
  const s=GM.sheet; if(!s) return; if(!HL.data){ loadHL(); return; }
  const g=(HL.data.games||[]).find(x=>String(x.id)===String(s.id)); if(!g||!g.videos.length) return;
  const sec=`<div class="gs-sec hl-sec"><div class="label">Highlights</div><div class="hl-row">${g.videos.map(v=>hlVid(v,g,false)).join("")}</div></div>`;
  const after=$("sheet").querySelector(".rcp-sec")||$("sheet").querySelector(".sheet-head"); after?.insertAdjacentHTML("afterend",sec);
};
setInterval(()=>{ if(!document.hidden&&(S.tab==="home"||S.ntype==="highlights")) loadHL(); },10*60e3);
