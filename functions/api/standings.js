// GET /api/standings — all 8 divisions with playoff seeds, from ESPN (10-minute edge cache).
const FIX = { WAS: "WSH", LA: "LAR" };
const ab = (x) => { const a = String(x || "").toUpperCase(); return FIX[a] || a; };
export async function onRequest(ctx) {
  const url = new URL(ctx.request.url), key = new Request(url.origin + "/api/standings"), cache = caches.default;
  const hit = await cache.match(key); if (hit) return hit;
  let d = null;
  try { const r = await fetch("https://site.api.espn.com/apis/v2/sports/football/nfl/standings?level=3", { headers: { "user-agent": "Mozilla/5.0 (NorthHuddle)" } }); if (r.ok) d = await r.json(); } catch (e) {}
  if (!d) return new Response('{"error":"upstream"}', { status: 502, headers: { "content-type": "application/json" } });
  const divisions = {};
  for (const conf of d.children || []) for (const div of conf.children || []) {
    divisions[div.name] = (div.standings?.entries || []).map((e) => {
      const s = Object.fromEntries((e.stats || []).map((x) => [x.name || x.type, x]));
      const num = (k) => (s[k] ? Number(s[k].value ?? s[k].displayValue) : 0);
      return { team: e.team?.displayName, abbr: ab(e.team?.abbreviation), w: num("wins"), l: num("losses"), t: num("ties"),
        pf: num("pointsFor"), pa: num("pointsAgainst"), seed: s.playoffSeed ? Number(s.playoffSeed.value ?? s.playoffSeed.displayValue) || null : null,
        streak: s.streak?.displayValue || "", div: s.divisionRecord?.displayValue || s["vs. Div."]?.displayValue || "", pct: s.winPercent?.displayValue || "" };
    }).sort((a, b) => (b.w + b.t / 2) / Math.max(1, b.w + b.l + b.t) - (a.w + a.t / 2) / Math.max(1, a.w + a.l + a.t) || (a.seed || 99) - (b.seed || 99));
  }
  const body = JSON.stringify({ updatedAt: new Date().toISOString(), divisions });
  ctx.waitUntil(cache.put(key, new Response(body, { headers: { "content-type": "application/json", "cache-control": "public, max-age=600" } })));
  return new Response(body, { headers: { "content-type": "application/json", "cache-control": "public, max-age=300" } });
}
