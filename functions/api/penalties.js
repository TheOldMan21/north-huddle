// GET /api/penalties?event=ESPN_ID — every flag in a game, per team: quarter, clock, player, infraction, yards, accepted/declined/offsetting.
// Parsed from ESPN's play-by-play; short names (e.g. "W.Fries") are expanded to full names from both team rosters.
// Final games are cached for 7 days, live ones for a minute.
const SUM = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=";
const ROS = (id) => `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${id}/roster`;
const UA = { "user-agent": "Mozilla/5.0 (NorthHuddle)" };
const json = (o, s = 200, cc = "no-store") => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", "cache-control": cc } });
const RX = /PENALTY on ([A-Z]{2,4})(?:-([^,]+))?,\s*([^,.]+?)(?:,\s*(\d+) yards?|,\s*(declined|offsetting))/gi;
async function getJSON(u) { try { const r = await fetch(u, { headers: UA }); return r.ok ? await r.json() : null; } catch (e) { return null; } }
export async function onRequest(ctx) {
  const url = new URL(ctx.request.url), id = (url.searchParams.get("event") || "").replace(/\D/g, "").slice(0, 14);
  if (!id) return json({ error: "event" }, 400);
  const key = new Request(url.origin + "/api/penalties?v=1&event=" + id), cache = caches.default;
  const hit = await cache.match(key); if (hit) return hit;
  const s = await getJSON(SUM + id); if (!s) return json({ error: "upstream" }, 502);
  const comp = s.header?.competitions?.[0] || {}, state = comp.status?.type?.state || "pre";
  const teams = (comp.competitors || []).map((c) => ({ id: c.team?.id, abbr: c.team?.abbreviation, name: c.team?.displayName, home: c.homeAway === "home" }));
  // full names from both rosters, keyed by team
  const rosters = {};
  await Promise.all(teams.map(async (t) => { const r = await getJSON(ROS(t.id)); rosters[t.abbr] = (r?.athletes || []).flatMap((g) => g.items || []).map((a) => ({ first: a.firstName || "", last: a.lastName || "", name: a.displayName, pos: a.position?.abbreviation || "", jersey: a.jersey || "" })); }));
  const fullName = (abbr, short) => {
    if (!short) return null; const m = short.trim().match(/^([A-Za-z]+)\.\s*(.+)$/); if (!m) return { name: short.trim() };
    const [, pre, last] = m, list = rosters[abbr] || [];
    const hit = list.find((a) => a.last.toLowerCase() === last.toLowerCase() && a.first.toLowerCase().startsWith(pre.toLowerCase())) || list.find((a) => a.last.toLowerCase() === last.toLowerCase());
    return hit ? { name: hit.name, pos: hit.pos, jersey: hit.jersey } : { name: short.trim() };
  };
  const plays = [...(s.drives?.previous || []), ...(s.drives?.current ? [s.drives.current] : [])].flatMap((d) => d.plays || []);
  const seen = new Set(), flags = [];
  for (const p of plays) {
    const text = p.text || "", single = p.penalty?.status?.slug; let m, n = 0; RX.lastIndex = 0;
    const found = []; while ((m = RX.exec(text))) found.push(m);
    for (const m of found) {
      const [, abbr, short, infraction, yds, how] = m;
      const status = how ? how.toLowerCase() : found.length === 1 && single && single !== "accepted" ? single : /offsetting/i.test(text) ? "offsetting" : "accepted";
      const k = `${p.id || ""}|${abbr}|${short || ""}|${infraction}|${n++}`; if (seen.has(k)) continue; seen.add(k);
      const pl = fullName(abbr, short);
      flags.push({ team: abbr, q: p.period?.number || 0, clock: p.clock?.displayValue || "", player: pl?.name || null, pos: pl?.pos || "", jersey: pl?.jersey || "",
        teamFlag: !short, infraction: infraction.trim(), yards: yds ? Number(yds) : 0, status, dd: p.start?.downDistanceText || "", text: text.slice(0, 400) });
    }
  }
  const box = Object.fromEntries((s.boxscore?.teams || []).map((t) => [t.team?.abbreviation, (t.statistics || []).find((x) => x.name === "totalPenaltiesYards")?.displayValue || ""]));
  const out = { event: id, state, final: state === "post",
    teams: teams.sort((a, b) => (a.home ? 1 : 0) - (b.home ? 1 : 0)).map((t) => { const list = flags.filter((f) => f.team === t.abbr), acc = list.filter((f) => f.status === "accepted");
      const [bc, by] = (box[t.abbr] || "").split("-").map(Number);
      return { abbr: t.abbr, name: t.name, count: Number.isFinite(bc) ? bc : acc.length, yards: Number.isFinite(by) ? by : acc.reduce((a, f) => a + f.yards, 0), flags: list }; }) };
  const res = json(out, 200, out.final ? "public, max-age=3600" : "public, max-age=30");
  if (out.final) ctx.waitUntil(cache.put(key, new Response(JSON.stringify(out), { headers: { "content-type": "application/json", "cache-control": "public, max-age=604800" } })));
  return res;
}
