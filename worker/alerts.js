// North Huddle game alerts — a Cloudflare Worker that runs every minute (Cron Trigger "* * * * *").
// Watches ESPN's scoreboard and sends phone notifications (Web Push) for scoring plays, final scores and kickoff.
// Secrets to add in the Worker's Settings → Variables and Secrets:
//   VAPID_PRIVATE  — the private push key (given to the site owner)
//   NH_BOT_PW      — the update bot's password
const SB_URL = "https://hoxcsdtbljhfappkshya.supabase.co";
const SB_KEY = "sb_publishable_KON7uG5HO_MW7fi2JVo9aw_-mpduqIe";
const BOT = "huddlebot@northhuddle.app";
const VAPID_PUBLIC = "BEFdln3zV7LK4fnUTaxsN4B5k5an8fVcTNIOWeBflafUW4_MXyI9ycPVRy54rDAm37873iC9y5xTs-aRp6k1VJ0";
const SITE = "https://north-huddle.pages.dev";
const SCOREBOARD = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";
const NICK = { ARI:"Cardinals",ATL:"Falcons",BAL:"Ravens",BUF:"Bills",CAR:"Panthers",CHI:"Bears",CIN:"Bengals",CLE:"Browns",DAL:"Cowboys",DEN:"Broncos",DET:"Lions",GB:"Packers",HOU:"Texans",IND:"Colts",JAX:"Jaguars",KC:"Chiefs",LV:"Raiders",LAC:"Chargers",LAR:"Rams",MIA:"Dolphins",MIN:"Vikings",NE:"Patriots",NO:"Saints",NYG:"Giants",NYJ:"Jets",PHI:"Eagles",PIT:"Steelers",SF:"49ers",SEA:"Seahawks",TB:"Buccaneers",TEN:"Titans",WSH:"Commanders" };
const FIX = { WAS: "WSH", LA: "LAR" };
const ab = (t) => { const a = String(t?.abbreviation || "").toUpperCase(); return FIX[a] || a; };

// ---------- small helpers ----------
const enc = new TextEncoder();
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s) => { s = s.replace(/-/g, "+").replace(/_/g, "/"); s += "=".repeat((4 - (s.length % 4)) % 4); return Uint8Array.from(atob(s), (c) => c.charCodeAt(0)); };
const cat = (...a) => { const n = a.reduce((x, y) => x + y.length, 0), o = new Uint8Array(n); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };
async function hkdf(salt, ikm, info, len) {
  const k = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, k, len * 8));
}

// ---------- Web Push (RFC 8291 aes128gcm + RFC 8292 VAPID) ----------
export async function encryptPayload(sub, payload) {
  const uaPublic = unb64u(sub.keys.p256dh), auth = unb64u(sub.keys.auth);
  const as = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", as.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const secret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, as.privateKey, 256));
  const ikm = await hkdf(auth, secret, cat(enc.encode("WebPush: info\0"), uaPublic, asPublic), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);
  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, cat(enc.encode(payload), new Uint8Array([2]))));
  const header = new Uint8Array(21 + asPublic.length);
  header.set(salt, 0); new DataView(header.buffer).setUint32(16, 4096); header[20] = asPublic.length; header.set(asPublic, 21);
  return cat(header, ct);
}
async function vapidKey(priv) {
  const pub = unb64u(VAPID_PUBLIC);
  return crypto.subtle.importKey("jwk", { kty: "EC", crv: "P-256", d: priv, x: b64u(pub.slice(1, 33)), y: b64u(pub.slice(33, 65)), ext: true }, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}
export async function vapidAuth(endpoint, key) {
  const aud = new URL(endpoint).origin;
  const h = b64u(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const p = b64u(enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: SITE })));
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(h + "." + p));
  return `vapid t=${h}.${p}.${b64u(sig)}, k=${VAPID_PUBLIC}`;
}
async function sendPush(sub, msg, key) {
  const body = await encryptPayload(sub, JSON.stringify(msg));
  return fetch(sub.endpoint, { method: "POST", body, headers: { Authorization: await vapidAuth(sub.endpoint, key), "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream", TTL: "3600", Urgency: "high" } });
}

// ---------- Supabase (as the update bot) ----------
async function sbToken(env) {
  const r = await fetch(`${SB_URL}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: SB_KEY, "content-type": "application/json" }, body: JSON.stringify({ email: BOT, password: env.NH_BOT_PW }) });
  if (!r.ok) throw new Error("bot sign-in failed " + r.status);
  return (await r.json()).access_token;
}
const sb = (tok, path, init = {}) => fetch(SB_URL + path, { ...init, headers: { apikey: SB_KEY, authorization: "Bearer " + tok, "content-type": "application/json", ...(init.headers || {}) } });

// ---------- the watcher ----------
function gamesFrom(sbJson) {
  return (sbJson.events || []).map((e) => {
    const c = (e.competitions || [])[0] || {}, cs = c.competitors || [];
    const h = cs.find((x) => x.homeAway === "home") || {}, a = cs.find((x) => x.homeAway === "away") || {};
    const st = c.status?.type || {};
    return { id: e.id, kickoff: e.date, state: st.state, detail: st.shortDetail || "", home: ab(h.team), away: ab(a.team), hs: Number(h.score || 0), as: Number(a.score || 0), last: c.situation?.lastPlay?.text || "" };
  });
}
function scoreLine(g, team) { const us = team === g.home ? g.hs : g.as, them = team === g.home ? g.as : g.hs, opp = team === g.home ? g.away : g.home; return { us, them, opp }; }
function eventsFor(g, prev) {
  const ev = [];
  const mins = (Date.parse(g.kickoff) - Date.now()) / 60000;
  if (g.state === "pre" && mins <= 60 && mins > 0 && !prev?.kick) ev.push({ type: "kickoff" });
  if (prev && g.state === "in") {
    const dh = g.hs - (prev.hs || 0), da = g.as - (prev.as || 0);
    if (dh > 0) ev.push({ type: "score", team: g.home, pts: dh });
    if (da > 0) ev.push({ type: "score", team: g.away, pts: da });
  }
  if (prev && prev.state !== "post" && g.state === "post") ev.push({ type: "final" });
  return ev;
}
function message(ev, g, fan) {
  const { us, them, opp } = scoreLine(g, fan), mine = NICK[fan] || fan, other = NICK[opp] || opp;
  if (ev.type === "kickoff") return { title: `Kickoff soon: ${mine} ${fan === g.home ? "vs" : "at"} ${other}`, body: `Starts at ${new Date(g.kickoff).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" })} CT. Make your picks before kickoff!`, tag: `kick-${g.id}`, url: SITE + "/" };
  if (ev.type === "final") return { title: `FINAL: ${mine} ${us}, ${other} ${them}`, body: us > them ? `${mine} win! Tap for the box score.` : us < them ? `Tough loss. Tap for the box score.` : `It ends in a tie.`, tag: `final-${g.id}`, url: `${SITE}/#game/${g.id}` };
  const what = ev.pts >= 6 ? "TOUCHDOWN" : ev.pts === 3 ? "Field goal" : ev.pts === 2 ? "Safety" : "Score";
  const who = NICK[ev.team] || ev.team, good = ev.team === fan;
  return { title: `${good ? "🏈 " : ""}${who} ${what}${good && ev.pts >= 6 ? "!" : ""}`, body: `${mine} ${us}, ${other} ${them} · ${g.detail}${g.last ? " · " + g.last.slice(0, 90) : ""}`, tag: `score-${g.id}`, url: `${SITE}/#game/${g.id}` };
}
async function run(env) {
  const r = await fetch(SCOREBOARD, { headers: { "user-agent": "Mozilla/5.0 (NorthHuddle alerts)" } });
  if (!r.ok) return "scoreboard " + r.status;
  const games = gamesFrom(await r.json());
  const tok = await sbToken(env);
  const stRes = await sb(tok, "/rest/v1/docs?select=data&path=eq.push%2Fstate");
  const stRows = stRes.ok ? await stRes.json() : [];
  const first = !stRows.length, state = stRows[0]?.data || { games: {} };
  const todo = [];
  for (const g of games) {
    const prev = state.games[g.id];
    const evs = first ? [] : eventsFor(g, prev);
    for (const ev of evs) todo.push({ ev, g });
    state.games[g.id] = { hs: g.hs, as: g.as, state: g.state, kick: prev?.kick || evs.some((e) => e.type === "kickoff") || (g.state !== "pre") };
  }
  for (const id of Object.keys(state.games)) if (!games.some((g) => g.id === id)) delete state.games[id];
  let sent = 0, gone = 0;
  if (todo.length) {
    const subsRes = await sb(tok, "/rest/v1/push_subs?select=endpoint,sub,prefs");
    const subs = subsRes.ok ? await subsRes.json() : [];
    const key = await vapidKey(env.VAPID_PRIVATE);
    for (const { ev, g } of todo) {
      for (const s of subs) {
        const p = { scores: true, final: true, kickoff: true, team: "MIN", ...(s.prefs || {}) };
        if (p.team !== g.home && p.team !== g.away) continue;
        if ((ev.type === "score" && !p.scores) || (ev.type === "final" && !p.final) || (ev.type === "kickoff" && !p.kickoff)) continue;
        try {
          const res = await sendPush(s.sub, message(ev, g, p.team), key);
          if (res.status === 404 || res.status === 410) { gone++; await sb(tok, "/rest/v1/push_subs?endpoint=eq." + encodeURIComponent(s.endpoint), { method: "DELETE" }); }
          else if (res.ok) sent++;
        } catch (e) {}
      }
    }
  }
  await sb(tok, "/rest/v1/docs?on_conflict=path", { method: "POST", headers: { prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ path: "push/state", col: "push", id: "state", data: { ...state, at: new Date().toISOString() } }) });
  return `events ${todo.length}, sent ${sent}, removed ${gone}${first ? " (first run: started watching)" : ""}`;
}
export default {
  async scheduled(event, env, ctx) { ctx.waitUntil(run(env).then((m) => console.log(m)).catch((e) => console.log("error", e.message))); },
  async fetch(req, env) { // visiting the worker's address runs one check and shows the result
    try { return new Response("North Huddle alerts: " + (await run(env))); } catch (e) { return new Response("error: " + e.message, { status: 500 }); }
  }
};
