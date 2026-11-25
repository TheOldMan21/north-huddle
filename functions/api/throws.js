// GET /api/throws?event=ESPN_ID — every pass attempt in a game, for the Throw chart:
// passer, target, quarter + clock, down & distance, result (complete / incomplete / INT / TD), yards,
// direction (left / middle / right) and depth (short / deep) as ESPN's play-by-play describes them,
// plus the score after each play. Short names are expanded from both rosters (with headshots).
// Final games are cached for 7 days, live ones for 30 seconds.
const SUM = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=";
const ROS = (id) => `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${id}/roster`;
const UA = { "user-agent": "Mozilla/5.0 (NorthHuddle)" };
const json = (o, s = 200, cc = "no-store") => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", "cache-control": cc } });
async function getJSON(u) { try { const r = await fetch(u, { headers: UA }); return r.ok ? await r.json() : null; } catch (e) { return null; } }
const NAME = "([A-Z][A-Za-z]*\\.\\s?[A-Za-z'\\-\\.]+(?:\\s(?:Jr|Sr|II|III|IV)\\.?)?)";
const RX_PASS = new RegExp(`${NAME}\\s+pass\\s+(incomplete\\s+)?(?:(short|deep)\\s+(left|middle|right))?(?:\\s+(?:to|intended for)\\s+${NAME})?`);
export async function onRequest(ctx) {
  const url = new URL(ctx.request.url), id = (url.searchParams.get("event") || "").replace(/\D/g, "").slice(0, 14);
  if (!id) return json({ error: "event" }, 400);
  const key = new Request(url.origin + "/api/throws?v=1&event=" + id), cache = caches.default;
  const hit = await cache.match(key); if (hit) return hit;
  const s = await getJSON(SUM + id); if (!s) return json({ error: "upstream" }, 502);
  const comp = s.header?.competitions?.[0] || {}, state = comp.status?.type?.state || "pre";
  const teams = (comp.competitors || []).map((c) => ({ id: c.team?.id, abbr: c.team?.abbreviation, name: c.team?.displayName, home: c.homeAway === "home", score: Number(c.score || 0) }));
  const abbrOf = Object.fromEntries(teams.map((t) => [t.id, t.abbr]));
  const rosters = {};
  await Promise.all(teams.map(async (t) => { const r = await getJSON(ROS(t.id));
    rosters[t.abbr] = (r?.athletes || []).flatMap((g) => g.items || []).map((a) => ({ first: a.firstName || "", last: a.lastName || "", name: a.displayName, pos: a.position?.abbreviation || "", jersey: a.jersey || "", photo: a.headshot?.href || "" })); }));
  const who = (abbr, short) => {
    if (!short) return null; const clean = short.trim().replace(/\.+$/, ""); const m = clean.replace(/\s+(Jr|Sr|II|III|IV)\.?$/, "").match(/^([A-Za-z]+)\.\s*(.+)$/); if (!m) return { name: clean };
    const [, pre, last] = m, list = rosters[abbr] || [];
    const h = list.find((a) => a.last.toLowerCase() === last.toLowerCase() && a.first.toLowerCase().startsWith(pre.toLowerCase())) || list.find((a) => a.last.toLowerCase() === last.toLowerCase());
    return h ? { name: h.name, pos: h.pos, jersey: h.jersey, photo: h.photo } : { name: clean };
  };
  const plays = [...(s.drives?.previous || []), ...(s.drives?.current ? [s.drives.current] : [])].flatMap((d) => d.plays || []);
  const throws = [];
  for (const p of plays) {
    const text = (p.text || "").replace(/^\([^)]*\)\s*/, "");
    if (/No Play|two-point|TWO-POINT|PASS ATTEMPT/i.test(text)) continue;
    const m = text.match(RX_PASS); if (!m) continue;
    const team = abbrOf[p.start?.team?.id] || abbrOf[p.end?.team?.id] || "", opp = teams.find((t) => t.abbr !== team)?.abbr || "";
    const int = /INTERCEPTED/i.test(text), inc = !!m[2] || /pass incomplete/i.test(text);
    const g = text.match(/for (-?\d+) yards?/i), gain = int || inc ? 0 : g ? Number(g[1]) : /no gain/i.test(text) ? 0 : (p.statYardage || 0);
    const qb = who(team, m[1]), tgt = who(team, m[5]);
    throws.push({ n: throws.length + 1, team, q: p.period?.number || 0, clock: p.clock?.displayValue || "", at: p.wallclock || "",
      qb: qb?.name || m[1], qbPhoto: qb?.photo || "", target: tgt?.name || (m[5] || ""), tPos: tgt?.pos || "", tPhoto: tgt?.photo || "",
      res: int ? "INT" : inc ? "I" : "C", td: !int && /TOUCHDOWN/i.test(text), depth: m[3] || "", dir: m[4] || "", yds: gain,
      toGo: p.start?.yardsToEndzone ?? null, dd: p.start?.downDistanceText || "", by: int ? who(opp, (text.match(/INTERCEPTED by ([A-Z][A-Za-z]*\.\s?[A-Za-z'\-]+)/) || [])[1])?.name || "" : "",
      away: p.awayScore ?? null, home: p.homeScore ?? null, text: text.slice(0, 300) });
  }
  const t = teams.sort((a, b) => (a.home ? 1 : 0) - (b.home ? 1 : 0));
  const out = { event: id, state, final: state === "post", detail: comp.status?.type?.detail || "", away: t[0] || null, home: t[1] || null, throws };
  const res = json(out, 200, out.final ? "public, max-age=3600" : "public, max-age=30");
  if (out.final) ctx.waitUntil(cache.put(key, new Response(JSON.stringify(out), { headers: { "content-type": "application/json", "cache-control": "public, max-age=604800" } })));
  return res;
}
