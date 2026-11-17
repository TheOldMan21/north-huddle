// POST /api/kick — wakes the free GitHub updater when the site's data is getting old (GitHub's own schedule runs late).
// Anyone's visit can trigger it, but only when sys/status is more than 25 minutes old, and at most once every 10 minutes.
// The site owner (an admin, sent with their sign-in token) can force a run any time from the admin System tab.
// Needs a Pages environment variable GH_DISPATCH_TOKEN: a GitHub fine-grained token for this repo with "Actions: Read and write".
const SB = "https://hoxcsdtbljhfappkshya.supabase.co", SBK = "sb_publishable_KON7uG5HO_MW7fi2JVo9aw_-mpduqIe";
const REPO = "TheOldMan21/north-huddle", WF = "site-update.yml";
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });
async function isAdmin(auth) {
  if (!auth || !/^Bearer\s+\S+/.test(auth)) return false;
  try { const r = await fetch(`${SB}/rest/v1/rpc/is_admin`, { method: "POST", headers: { apikey: SBK, authorization: auth, "content-type": "application/json" }, body: "{}" }); return r.ok && (await r.json()) === true; } catch (e) { return false; }
}
export async function onRequestPost(ctx) {
  const { request, env } = ctx, url = new URL(request.url);
  if (!env.GH_DISPATCH_TOKEN) return json({ ok: false, reason: "not_configured" });
  if (request.headers.get("x-probe")) return json({ ok: false, reason: "ready" });   // admin setup check only
  const force = url.searchParams.get("force") === "1" && (await isAdmin(request.headers.get("authorization")));
  const cache = caches.default, lock = new Request(url.origin + "/api/_kick_lock");
  if (!force) {
    if (await cache.match(lock)) return json({ ok: false, reason: "recently_started" });
    try {
      const r = await fetch(`${SB}/rest/v1/docs?select=data&path=eq.sys%2Fstatus`, { headers: { apikey: SBK, authorization: "Bearer " + SBK } });
      const at = r.ok ? (await r.json())[0]?.data?.at : null;
      if (at && Date.now() - Date.parse(at) < 25 * 60e3) return json({ ok: false, reason: "fresh" });
    } catch (e) {}
  }
  const g = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${WF}/dispatches`, {
    method: "POST", body: JSON.stringify({ ref: "main" }),
    headers: { authorization: "Bearer " + env.GH_DISPATCH_TOKEN, accept: "application/vnd.github+json", "user-agent": "north-huddle-kick", "x-github-api-version": "2022-11-28" }
  });
  if (g.status !== 204) return json({ ok: false, reason: "github_" + g.status }, 502);
  ctx.waitUntil(cache.put(lock, new Response("1", { headers: { "cache-control": "public, max-age=600" } })));
  return json({ ok: true, forced: force });
}
export async function onRequestGet() { return json({ ok: false, reason: "use POST" }, 405); }
