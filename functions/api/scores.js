// Cloudflare Pages Function: GET /api/scores?team=MIN
// Current NFL week scoreboard from ESPN, plus scoring plays for the chosen team's game.
// Cached at the edge for 30 seconds so every visitor shares one upstream request.
const SB = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";
const SUM = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=";
const FIX = { WAS: "WSH", LA: "LAR" };
const ab = (t) => { const a = String(t?.abbreviation || "").toUpperCase(); return FIX[a] || a; };

export async function onRequest(ctx) {
  const url = new URL(ctx.request.url);
  const team = (url.searchParams.get("team") || "MIN").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
  const key = new Request(url.origin + "/api/scores?team=" + team);
  const cache = caches.default;
  const hit = await cache.match(key);
  if (hit) return hit;

  let out = { at: new Date().toISOString(), week: null, games: [], focus: null };
  try {
    const sb = await (await fetch(SB, { headers: { "user-agent": "NorthHuddle/1.0" } })).json();
    out.week = sb?.week?.number ?? null;
    out.games = (sb.events || []).map((e) => {
      const c = (e.competitions || [])[0] || {};
      const cs = c.competitors || [];
      const h = cs.find((x) => x.homeAway === "home") || {}, a = cs.find((x) => x.homeAway === "away") || {};
      const st = c.status?.type || e.status?.type || {};
      const sit = c.situation || {};
      const poss = sit.possession ? (String(h.team?.id) === String(sit.possession) ? ab(h.team) : String(a.team?.id) === String(sit.possession) ? ab(a.team) : "") : "";
      return {
        id: e.id, kickoff: e.date, state: st.state || "pre", detail: st.shortDetail || st.detail || "",
        home: ab(h.team), away: ab(a.team), hs: Number(h.score || 0), as: Number(a.score || 0),
        possession: poss, downDist: sit.downDistanceText || "", lastPlay: sit.lastPlay?.text || "",
        redZone: !!sit.isRedZone, tv: (c.broadcasts || []).flatMap((b) => b.names || []).join(", ")
      };
    });
    const g = out.games.find((x) => x.home === team || x.away === team);
    if (g && g.state !== "pre") {
      try {
        const s = await (await fetch(SUM + g.id, { headers: { "user-agent": "NorthHuddle/1.0" } })).json();
        out.focus = {
          id: g.id,
          scoring: (s.scoringPlays || []).map((p) => ({
            q: p.period?.number, clock: p.clock?.displayValue || "", team: ab(p.team),
            text: p.text || p.type?.text || "", hs: p.homeScore, as: p.awayScore
          }))
        };
      } catch (e) {}
    }
  } catch (e) {
    out.error = "upstream";
  }
  const resp = new Response(JSON.stringify(out), {
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=30" }
  });
  if (!out.error) ctx.waitUntil(cache.put(key, resp.clone()));
  return resp;
}
