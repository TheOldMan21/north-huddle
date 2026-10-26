// Cloudflare Pages Function: GET /api/scores?team=MIN
// Current NFL week scoreboard from ESPN, plus scoring plays for the chosen team's game.
// Cached at the edge for 30 seconds so every visitor shares one upstream request.
const SB = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";
const SUM = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=";
const FIX = { WAS: "WSH", LA: "LAR" };
const ab = (t) => { const a = String(t?.abbreviation || "").toUpperCase(); return FIX[a] || a; };

// Latest plays, newest first.
function playsOf(s) {
  try {
    const d = s.drives || {};
    const drives = [...(d.previous || []), ...(d.current ? [d.current] : [])];
    const seen = new Set(), all = [];
    const tm = {};
    for (const c of s.header?.competitions?.[0]?.competitors || []) tm[String(c.team?.id || c.id)] = ab(c.team);
    for (const dr of drives) {
      const team = ab(dr.team);
      for (const p of dr.plays || []) {
        if (!p || seen.has(p.id)) continue; seen.add(p.id);
        all.push({
          id: p.id, q: p.period?.number, clock: p.clock?.displayValue || "", team: tm[String(p.start?.team?.id)] || team,
          dd: p.start?.shortDownDistanceText || p.start?.downDistanceText || "",
          text: p.text || p.type?.text || "", type: p.type?.text || "",
          scoring: !!p.scoringPlay, yards: p.statYardage ?? null
        });
      }
    }
    return all.slice(-40).reverse();
  } catch (e) { return []; }
}
// Home-team win probability over the game (0..1), thinned to ~80 points.
function winProb(s, g) {
  try {
    const wp = (s.winprobability || []).map((x) => Number(x.homeWinPercentage)).filter((x) => x >= 0 && x <= 1);
    if (!wp.length) return null;
    const step = Math.max(1, Math.ceil(wp.length / 80)), pts = [];
    for (let i = 0; i < wp.length; i += step) pts.push(Math.round(wp[i] * 1000) / 1000);
    const last = Math.round(wp[wp.length - 1] * 1000) / 1000;
    if (pts[pts.length - 1] !== last) pts.push(last);
    return { home: g.home, away: g.away, now: last, pts };
  } catch (e) { return null; }
}
// Compact live box score: top passers, rushers, receivers per team.
const BOX = { passing: ["C/ATT", "YDS", "TD", "INT"], rushing: ["CAR", "YDS", "TD", "LONG"], receiving: ["REC", "YDS", "TD", "TGTS"] };
function boxOf(s) {
  try {
    return (s.boxscore?.players || []).map((t) => {
      const cats = {};
      for (const st of t.statistics || []) {
        const want = BOX[st.name]; if (!want) continue;
        const labels = st.labels || [];
        const idx = want.map((l) => labels.indexOf(l));
        cats[st.name] = {
          labels: want.filter((_, i) => idx[i] >= 0),
          rows: (st.athletes || []).slice(0, 4).map((a) => ({
            name: a.athlete?.shortName || a.athlete?.displayName || "",
            stats: idx.filter((i) => i >= 0).map((i) => (a.stats || [])[i] ?? "")
          }))
        };
      }
      return { team: ab(t.team), cats };
    });
  } catch (e) { return []; }
}

export async function onRequest(ctx) {
  const url = new URL(ctx.request.url);
  const team = (url.searchParams.get("team") || "MIN").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
  const event = (url.searchParams.get("event") || "").replace(/\D/g, "").slice(0, 14);
  const week = (url.searchParams.get("week") || "").replace(/\D/g, "").slice(0, 2);
  const key = new Request(url.origin + "/api/scores?team=" + team + (event ? "&event=" + event : "") + (week ? "&week=" + week : ""));
  const cache = caches.default;
  const hit = await cache.match(key);
  if (hit) return hit;

  let out = { at: new Date().toISOString(), week: null, games: [], focus: null };
  try {
    const sb = await (await fetch(week ? `${SB}?seasontype=2&week=${week}&dates=2026` : SB, { headers: { "user-agent": "NorthHuddle/1.0" } })).json();
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
        possession: poss, downDist: sit.downDistanceText || "", shortDD: sit.shortDownDistanceText || "",
        posText: sit.possessionText || "", down: sit.down ?? null, distance: sit.distance ?? null,
        lastPlay: sit.lastPlay?.text || "",
        redZone: !!sit.isRedZone, tv: (c.broadcasts || []).flatMap((b) => b.names || []).join(", ")
      };
    });
    const g = event ? out.games.find((x) => String(x.id) === event) : out.games.find((x) => x.home === team || x.away === team);
    if (g && g.state !== "pre" && !week) {
      try {
        const s = await (await fetch(SUM + g.id, { headers: { "user-agent": "NorthHuddle/1.0" } })).json();
        out.focus = {
          id: g.id,
          scoring: (s.scoringPlays || []).map((p) => ({
            q: p.period?.number, clock: p.clock?.displayValue || "", team: ab(p.team),
            text: p.text || p.type?.text || "", hs: p.homeScore, as: p.awayScore
          })),
          plays: playsOf(s),
          wp: winProb(s, g),
          box: boxOf(s)
        };
      } catch (e) {}
    }
  } catch (e) {
    out.error = "upstream";
  }
  const resp = new Response(JSON.stringify(out), {
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": week ? "public, max-age=300" : "public, max-age=30" }
  });
  if (!out.error) ctx.waitUntil(cache.put(key, resp.clone()));
  return resp;
}
