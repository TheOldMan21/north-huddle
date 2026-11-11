// GET /api/predict — ESPN's Matchup Predictor (pre-game win chances) for this week's upcoming games.
// { week, games: { <eventId>: { home, away, homePct, awayPct } } }   Cached for an hour.
const SB = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";
const SUM = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=";
const FIX = { WAS: "WSH", LA: "LAR" };
const ab = (t) => { const a = String(t?.abbreviation || "").toUpperCase(); return FIX[a] || a; };
const UA = { headers: { "user-agent": "Mozilla/5.0 (NorthHuddle)" } };
export async function onRequest(ctx) {
  const url = new URL(ctx.request.url), key = new Request(url.origin + "/api/predict"), cache = caches.default;
  const hit = await cache.match(key); if (hit) return hit;
  const out = { at: new Date().toISOString(), week: null, games: {} };
  try {
    const sb = await (await fetch(SB, UA)).json(); out.week = sb?.week?.number ?? null;
    const evs = (sb.events || []).filter((e) => e.competitions?.[0]?.status?.type?.state === "pre");
    await Promise.all(evs.map(async (e) => {
      try {
        const s = await (await fetch(SUM + e.id, UA)).json(), p = s.predictor; if (!p) return;
        const cs = e.competitions[0].competitors || [], h = cs.find((x) => x.homeAway === "home"), a = cs.find((x) => x.homeAway === "away");
        let hp = Number(p.homeTeam?.gameProjection), ap = Number(p.awayTeam?.gameProjection);
        if (!(hp >= 0) || !(ap >= 0)) return;
        const tot = hp + ap || 100; hp = Math.round(hp / tot * 1000) / 10; ap = Math.round((100 - hp) * 10) / 10; // ties pushed into the two sides
        out.games[e.id] = { home: ab(h?.team), away: ab(a?.team), homePct: hp, awayPct: ap };
      } catch (err) {}
    }));
  } catch (e) { out.error = "upstream"; }
  const resp = new Response(JSON.stringify(out), { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=1800" } });
  if (!out.error) ctx.waitUntil(cache.put(key, resp.clone()));
  return resp;
}
