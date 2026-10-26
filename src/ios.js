/* ===================== North Huddle: iPhone / iPad support ===================== */
const IOS=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
const IOS_STANDALONE=IOS&&(navigator.standalone||matchMedia("(display-mode: standalone)").matches);
const ICO_IOS_SHARE=`<svg viewBox="0 0 24 24" aria-hidden="true" class="ios-share"><path d="M12 3v12M8 7l4-4 4 4M6 11H5v10h14V11h-1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/* install hint: iPhone has no install prompt, so explain Share → Add to Home Screen */
function iosInstallHint(force){
  if(!IOS||IOS_STANDALONE) return;
  if(!force&&(store.get("nh_install_x")||document.getElementById("installBar"))) return;
  document.getElementById("installBar")?.remove();
  document.body.insertAdjacentHTML("beforeend",`<div class="install-bar ios-bar" id="installBar" role="region" aria-label="Add to Home Screen"><img src="/apple-touch-icon.png" alt=""><div class="grow"><b>Add North Huddle to your iPhone</b><span>Tap ${ICO_IOS_SHARE} <b>Share</b> below, then <b>Add to Home Screen</b>. Needed for game alerts.</span></div><button class="x" data-install-x="1" aria-label="Dismiss">×</button></div>`);
}
if(IOS) setTimeout(()=>iosInstallHint(false),4000);
const _doInstallI=doInstall;
doInstall=function(){ if(IOS) return iosInstallHint(true); return _doInstallI(); };

/* alerts panel: on iPhone, notifications only work from the Home Screen app (iOS 16.4+) */
const _pushPanelI=pushPanel;
pushPanel=function(){
  if(IOS&&!IOS_STANDALONE) return `<div class="card push-panel"><div class="t1">${ICO_BELL} Game alerts</div><div class="t2">On iPhone, alerts work from the Home Screen app:</div><ol class="ios-steps"><li>Tap ${ICO_IOS_SHARE} <b>Share</b> at the bottom of Safari</li><li>Choose <b>Add to Home Screen</b> → <b>Add</b></li><li>Open North Huddle from your Home Screen and turn on alerts here</li></ol><div class="t2">Requires iOS 16.4 or newer.</div></div>`;
  return _pushPanelI();
};

/* voice: if the browser can't do speech-to-text (or it's blocked), use the keyboard's dictation mic */
function iosDictationHint(){ const i=$("svInput"); if(i){ i.focus(); } toast("Tap the 🎤 microphone on your keyboard and ask your question.",6000); }
const _micButtonsI=micButtons;
micButtons=function(){
  _micButtonsI();
  const box=document.querySelector("#searchView .sv-box");
  if(IOS&&box&&!box.querySelector(".sv-mic")) box.querySelector(".sv-spk")?.insertAdjacentHTML("beforebegin",`<button class="sv-mic" data-mic="1" aria-label="Ask by voice">${ICO_MIC}</button>`);
};
const _startVoiceI=startVoice;
startVoice=function(){
  if(!SpeechRec) return IOS?iosDictationHint():toast("Voice isn't supported in this browser. Try Chrome.");
  _startVoiceI();
  // iPhone home-screen apps often block speech recognition; fall back to keyboard dictation
  if(IOS&&VOICE.rec){ const r=VOICE.rec, prev=r.onerror; r.onerror=e=>{ if(["not-allowed","service-not-allowed","audio-capture","network"].includes(e.error)) iosDictationHint(); else prev&&prev(e); }; }
};
// header mic on iPhone even without speech recognition
(function(){ const f=$("searchBtn"); if(IOS&&f&&!f.querySelector(".hs-mic")) f.insertAdjacentHTML("beforeend",`<span class="hs-mic" data-hsmic="1" role="button" aria-label="Ask by voice">${ICO_MIC}</span>`); })();
// in the AI screen, Enter on the iPhone keyboard ("Go") sends to the assistant (dictation ends with Go)
