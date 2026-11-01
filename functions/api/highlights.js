// GET /api/highlights — this week's game highlight videos from ESPN, standout games first. Cached 10 minutes.
const SB = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";
const SUM = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=";
const FIX = { WAS: "WSH", LA: "LAR" };
const ab = (t) => { const a = String(t?.abbreviation || "").toUpperCase(); return FIX[a] || a; };
const UA = { headers: { "user-agent": "Mozilla/5.0 (NorthHuddle)" } };
export async function onRequest(ctx) {
  const url = new URL(ctx.request.url), key = new Request(url.origin + "/api/highlights"), cache = caches.default;
  const hit = await cache.match(key); if (hit) return hit;
  const out = { at: new Date().toISOString(), week: null, games: [] };
  try {
    const sb = await (await fetch(SB, UA)).json();
    out.week = sb?.week?.number ?? null;
    const evs = (sb.events || []).filter((e) => ["post", "in"].includes(e.competitions?.[0]?.status?.type?.state));
    const res = await Promise.all(evs.map(async (e) => {
      const c = e.competitions[0], cs = c.competitors || [];
      const h = cs.find((x) => x.homeAway === "home") || {}, a = cs.find((x) => x.homeAway === "away") || {};
      const g = { id: e.id, home: ab(h.team), away: ab(a.team), hs: Number(h.score || 0), as: Number(a.score || 0), state: c.status?.type?.state, detail: c.status?.type?.shortDetail || "", date: e.date };
      let vids = [];
      try {
        const s = await (await fetch(SUM + e.id, UA)).json();
        vids = (s.videos || []).map((v) => ({
          id: String(v.id), title: v.headline || "", dur: v.duration || 0, thumb: v.thumbnail || "",
          url: v.links?.web?.href || "", type: v.tracking?.coverageType || "", at: v.originalPublishDate || ""
        })).filter((v) => v.url && v.thumb);
      } catch (err) {}
      // what makes a game stand out: close finish, overtime, lots of points
      const margin = Math.abs(g.hs - g.as), ot = /OT/.test(g.detail);
      g.standout = (g.state === "post" ? 0 : 5) + (margin <= 3 ? 30 : margin <= 7 ? 18 : margin <= 10 ? 8 : 0) + (ot ? 25 : 0) + Math.min(20, Math.max(0, (g.hs + g.as - 35) / 2));
      g.tag = ot ? "Overtime thriller" : margin <= 3 ? "Down to the wire" : g.hs + g.as >= 60 ? "Shootout" : margin >= 21 ? "Blowout" : "";
      g.videos = vids;
      return g;
    }));
    out.games = res.filter((g) => g.videos.length).sort((x, y) => y.standout - x.standout || String(y.date).localeCompare(String(x.date)));
  } catch (e) { out.error = "upstream"; }
  const resp = new Response(JSON.stringify(out), { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=600" } });
  if (!out.error) ctx.waitUntil(cache.put(key, resp.clone()));
  return resp;
}
