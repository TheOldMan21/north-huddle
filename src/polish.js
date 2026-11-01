/* ===================== North Huddle: polish (theme toggle, chat rules link) ===================== */
const ICO_MOON=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>`;
const ICO_SUN=`<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/></svg>`;
function isDark(){ return THEME==="dark"||(THEME==="auto"&&matchMedia("(prefers-color-scheme: dark)").matches); }
function themeBtnPaint(){ const b=$("themeBtn"); if(!b) return; const d=isDark(); b.innerHTML=d?ICO_SUN:ICO_MOON; b.setAttribute("aria-label",d?"Switch to light mode":"Switch to dark mode"); b.title=b.getAttribute("aria-label"); }
(function(){
  const r=$("refreshBtn"); if(!r||$("themeBtn")) return;
  r.insertAdjacentHTML("beforebegin",`<button class="refresh hdr-ico" id="themeBtn"></button>`);
  themeBtnPaint();
  $("themeBtn").addEventListener("click",()=>{ setTheme(isDark()?"light":"dark"); themeBtnPaint(); });
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change",themeBtnPaint);
})();
const _setThemeP=setTheme; setTheme=function(v,f){ _setThemeP(v,f); themeBtnPaint(); };
// community rules link next to the chat boxes
function addRulesLinks(){
  document.querySelectorAll(".fc-head:not([data-rules]),.wpv-ch:not([data-rules])").forEach(h=>{ h.dataset.rules="1"; h.insertAdjacentHTML("beforeend",`<a class="rules-link" href="/terms.html#rules" target="_blank" rel="noopener">Rules</a>`); });
}
const _renderHomePL=renderHome; renderHome=function(){ _renderHomePL(); addRulesLinks(); };
setTimeout(addRulesLinks,1500);
