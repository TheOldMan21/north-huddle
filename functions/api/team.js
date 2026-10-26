// Cloudflare Pages Function: GET /api/team?abbr=GB
// Builds a team hub document (same shape the site uses for teams/<abbr>) straight from ESPN.
// Cached at the edge for 10 minutes.
const A = "https://site.api.espn.com/apis/site/v2/sports/football/nfl";
const FIX = { WAS: "WSH", LA: "LAR" };
const ESPN_ABBR = { WSH: "wsh", LAR: "lar" };
const ab = (x) => { const a = String(x || "").toUpperCase(); return FIX[a] || a; };
const slug = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const idOf = (ref) => (String(ref || "").match(/athletes\/(\d+)/) || [])[1] || "";
const H = { "user-agent": "Mozilla/5.0 (NorthHuddle)" };
const j = async (u) => { try { const r = await fetch(u, { headers: H }); return r.ok ? await r.json() : null; } catch (e) { return null; } };
// Season player stats come from a GitHub job (ESPN's stats API blocks Cloudflare).
const PLAYERS_URL = "https://github.com/TheOldMan21/north-huddle/releases/download/espn-data/players.json";
async function allPlayers(origin) {
  const key = new Request(origin + "/api/_players"), cache = caches.default;
  const hit = await cache.match(key); if (hit) return hit.json();
  const d = await j(PLAYERS_URL);
  if (d) await cache.put(key, new Response(JSON.stringify(d), { headers: { "content-type": "application/json", "cache-control": "public, max-age=900" } }));
  return d;
}

const OFF = new Set(["wr", "lt", "lg", "c", "rg", "rt", "qb", "te", "rb", "fb"]);
const SPEC = new Set(["pk", "p", "h", "pr", "kr", "ls", "ko"]);
const MAP34 = { wlb: "LOLB", lilb: "WLB", rilb: "MLB", slb: "ROLB" };

export async function onRequest(ctx) {
  const url = new URL(ctx.request.url);
  const abbr = ab((url.searchParams.get("abbr") || "").replace(/[^A-Za-z]/g, "").slice(0, 4));
  if (!abbr) return new Response('{"error":"abbr"}', { status: 400, headers: { "content-type": "application/json" } });
  const key = new Request(url.origin + "/api/team?abbr=" + abbr);
  const cache = caches.default;
  const hit = await cache.match(key);
  if (hit) return hit;

  const ea = (ESPN_ABBR[abbr] || abbr).toLowerCase();
  const teamJ = await j(`${A}/teams/${ea}`);
  const team = teamJ?.team;
  if (!team) return new Response('{"error":"not_found"}', { status: 404, headers: { "content-type": "application/json" } });
  const tid = team.id;
  const [sched, roster, news, depth, pl] = await Promise.all([
    j(`${A}/teams/${ea}/schedule`), j(`${A}/teams/${ea}/roster`), j(`${A}/news?team=${tid}&limit=40`),
    j(`${A}/teams/${tid}/depthcharts`), allPlayers(url.origin)
  ]);
  const now = new Date().toISOString();

  // ---- roster lookup ----
  const R = {}; // espn athlete id -> {name, pos, jersey, unit, status}
  const injuries = [];
  for (const g of roster?.athletes || []) {
    const unit = g.position === "offense" ? "offense" : g.position === "defense" ? "defense" : g.position === "specialTeam" ? "special" : "";
    for (const a of g.items || []) {
      const inj = (a.injuries || [])[0];
      let status = inj?.status || (g.position === "injuredReserveOrOut" ? "Injured reserve" : "");
      if (/^IR$|reserve/i.test(status)) status = "Injured reserve";
      if (!R[a.id]) R[a.id] = { name: a.displayName, pos: a.position?.abbreviation || "", jersey: a.jersey ? Number(a.jersey) : null, unit, status };
      else if (status && !R[a.id].status) R[a.id].status = status;
      if (status && !injuries.some((x) => x.player === a.displayName)) injuries.push({ id: slug(a.displayName), player: a.displayName, pos: a.position?.abbreviation || "", status, injury: "", note: "" });
    }
  }

  // ---- record / meta ----
  const recItems = team.record?.items || [];
  const rec = (t) => recItems.find((x) => x.type === t)?.summary || "";
  const st = Object.fromEntries((recItems.find((x) => x.type === "total")?.stats || []).map((s) => [s.name, s.value]));
  const streakN = Number(st.streak || 0);
  const NFC = new Set(["ARI","ATL","CAR","CHI","DAL","DET","GB","LAR","MIN","NO","NYG","PHI","SEA","SF","TB","WSH"]);
  const confName = NFC.has(abbr) ? "NFC" : "AFC";

  // ---- games ----
  const games = [];
  for (const e of sched?.events || []) {
    const c = (e.competitions || [])[0] || {};
    const me = (c.competitors || []).find((x) => String(x.team?.id) === String(tid));
    const op = (c.competitors || []).find((x) => String(x.team?.id) !== String(tid));
    if (!me || !op) continue;
    const state = c.status?.type?.state || "pre";
    const wk = e.week?.number;
    const us = me.score?.value ?? (me.score != null ? Number(me.score) : null), them = op.score?.value ?? (op.score != null ? Number(op.score) : null);
    const g = {
      id: "w" + String(wk).padStart(2, "0"), week: wk, opp: op.team?.displayName || "", oppAbbr: ab(op.team?.abbreviation),
      home: me.homeAway === "home", status: state === "post" ? "final" : state === "in" ? "live" : "scheduled",
      kickoff: e.date ? new Date(e.date).toISOString() : null, date: (e.date || "").slice(0, 10),
      venue: c.venue?.fullName || "", tv: (c.broadcasts || []).map((b) => b.media?.shortName).filter(Boolean).join(", "), note: ""
    };
    if (state !== "pre") { g.us = us; g.them = them; }
    if (state === "post") g.result = me.winner ? "W" : op.winner ? "L" : "T";
    games.push(g);
  }
  if (sched?.byeWeek) games.push({ id: "w" + String(sched.byeWeek).padStart(2, "0"), week: sched.byeWeek, status: "bye", opp: "", oppAbbr: "" });
  games.sort((a, b) => a.week - b.week);
  const lastFinal = games.filter((g) => g.status === "final").slice(-1)[0];

  // ---- players (season leaders, from the GitHub job) ----
  const players = (pl?.teams?.[abbr] || []).map((p) => {
    const r = Object.values(R).find((x) => x.name === p.name);
    return r && r.status ? { ...p, status: r.status } : p;
  });

  // ---- depth chart ----
  const depthOut = [];
  const WR = { wr1: "LWR", wr2: "RWR", wr3: "SWR" };
  for (const it of depth?.depthchart || []) {
    const keys = Object.keys(it.positions || {});
    const is34 = keys.includes("nt") || keys.includes("lilb");
    for (const k of keys) {
      const base = k.replace(/\d+$/, "");
      const unit = OFF.has(base) ? "offense" : SPEC.has(base) ? "special" : "defense";
      let pos = WR[k] || k.toUpperCase();
      if (pos === "P") pos = "PT";
      if (is34 && MAP34[k]) pos = MAP34[k];
      if (depthOut.some((d) => d.pos === pos)) continue;
      const list = (it.positions[k].athletes || []).map((a) => R[a.id] || { name: a.displayName, jersey: null }).filter((r) => r.name);
      if (list.length) depthOut.push({ id: pos.toLowerCase(), unit, pos, players: list.map((r) => r.name), numbers: list.map((r) => r.jersey) });
    }
  }
  depthOut.forEach((d, i) => (d.order = i));

  // ---- news (team-specific stories only) ----
  const newsOut = [];
  for (const a of news?.articles || []) {
    const teams = (a.categories || []).filter((c) => c.type === "team").map((c) => String(c.teamId || c.team?.id || ""));
    if (!teams.includes(String(tid)) || teams.length > 3 || a.type === "Media") continue;
    const href = a.links?.web?.href; if (!href) continue;
    newsOut.push({ id: slug(a.headline).slice(0, 60), headline: a.headline, summary: "", date: a.published, source: "ESPN", url: href });
    if (newsOut.length >= 15) break;
  }
  const alertItem = (news?.articles || []).find((a) => a.type === "HeadlineNews" && (a.categories || []).some((c) => c.type === "team" && String(c.teamId) === String(tid)));

  const doc = {
    abbr, updatedAt: now, source: "espn",
    meta: {
      updatedAt: now, season: 2026, record: rec("total"), recordHome: rec("home"), recordAway: rec("road"),
      divisionRank: st.playoffSeed ? `No. ${st.playoffSeed} seed in the ${confName}` : "",
      streak: streakN ? (streakN > 0 ? "W" + streakN : "L" + -streakN) : "",
      pf: st.pointsFor ?? null, pa: st.pointsAgainst ?? null,
      alert: alertItem?.headline || "", alertAt: alertItem?.published || "",
      statsAsOf: lastFinal ? "Week " + lastFinal.week : "", depthAsOf: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Chicago" })
    },
    games, players, depth: depthOut, injuries, news: newsOut, videos: []
  };
  const resp = new Response(JSON.stringify(doc), { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=300" } });
  ctx.waitUntil(cache.put(key, new Response(JSON.stringify(doc), { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=600" } })));
  return resp;
}
