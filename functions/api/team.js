// Cloudflare Pages Function: GET /api/team?abbr=GB
// Builds a team hub document (same shape the site uses for teams/<abbr>) straight from ESPN.
// Cached at the edge for 10 minutes.
const A = "https://site.api.espn.com/apis/site/v2/sports/football/nfl";
const C = "https://sports.core.api.espn.com/v2/sports/football/leagues/nfl";
const FIX = { WAS: "WSH", LA: "LAR" };
const ESPN_ABBR = { WSH: "wsh", LAR: "lar" };
const ab = (x) => { const a = String(x || "").toUpperCase(); return FIX[a] || a; };
const slug = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const idOf = (ref) => (String(ref || "").match(/athletes\/(\d+)/) || [])[1] || "";
const H = { "user-agent": "Mozilla/5.0 (NorthHuddle)" };
const j = async (u) => { try { const r = await fetch(u, { headers: H }); return r.ok ? await r.json() : null; } catch (e) { return null; } };

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
  const [sched, roster, news, depth, leaders] = await Promise.all([
    j(`${A}/teams/${ea}/schedule`), j(`${A}/teams/${ea}/roster`), j(`${A}/news?team=${tid}&limit=40`),
    j(`${C}/seasons/2026/teams/${tid}/depthcharts`), j(`${C}/seasons/2026/types/2/teams/${tid}/leaders`)
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

  // ---- players from season leaders ----
  const P = {};
  const touch = (ref) => {
    const id = idOf(ref); const r = R[id]; if (!r) return null;
    return P[id] || (P[id] = { id: slug(r.name), name: r.name, pos: r.pos, unit: r.unit || "offense", status: r.status || undefined, stats: {} });
  };
  const num = (v) => (v == null ? null : Number(v));
  for (const cat of leaders?.categories || []) {
    for (const l of cat.leaders || []) {
      const p = touch(l.athlete?.$ref); if (!p) continue;
      const s = p.stats, v = num(l.value), dv = String(l.displayValue || "");
      switch (cat.name) {
        case "passingYards": (s.pass ||= {}).yds = v; break;
        case "passingTouchdowns": (s.pass ||= {}).td = v; break;
        case "quarterbackRating": (s.pass ||= {}).rate = v; break;
        case "passingLeader": { const m = dv.match(/(\d+)\/(\d+).*?(\d+)\s*INT/); const ps = (s.pass ||= {}); if (m) { ps.cmp = +m[1]; ps.att = +m[2]; ps.int = +m[3]; } break; }
        case "rushingYards": (s.rush ||= {}).yds = v; break;
        case "rushingTouchdowns": (s.rush ||= {}).td = v; break;
        case "rushingLeader": { const m = dv.match(/(\d+)\s*CAR/); if (m) (s.rush ||= {}).att = +m[1]; break; }
        case "receptions": (s.rec ||= {}).rec = v; break;
        case "receivingYards": (s.rec ||= {}).yds = v; break;
        case "receivingTouchdowns": (s.rec ||= {}).td = v; break;
        case "totalTackles": (s.def ||= {}).tkl = v; break;
        case "sacks": (s.def ||= {}).sacks = v; break;
        case "interceptions": (s.def ||= {}).int = v; break;
      }
    }
  }
  const players = Object.values(P).map((p) => {
    const s = p.stats;
    if (s.pass && !s.pass.yds) delete s.pass; // rating-only entries for non-passers
    if (s.pass) s.pass = { cmp: 0, att: 0, yds: 0, td: 0, int: 0, rate: null, ...s.pass };
    if (s.rush) s.rush = { att: null, yds: 0, td: 0, ...s.rush };
    if (s.rec) s.rec = { rec: 0, tgt: null, yds: 0, td: 0, ...s.rec };
    if (s.def) { s.def = { tkl: 0, sacks: 0, int: 0, ff: 0, ...s.def }; if (p.unit === "offense") p.unit = "defense"; }
    p.rank = (s.pass?.yds || 0) + (s.rush?.yds || 0) + (s.rec?.yds || 0) + 5 * (s.def?.tkl || 0) + 20 * (s.def?.sacks || 0);
    return p;
  }).sort((a, b) => b.rank - a.rank);

  // ---- depth chart ----
  const depthOut = [];
  for (const it of depth?.items || []) {
    const keys = Object.keys(it.positions || {});
    const is34 = keys.includes("nt") || keys.includes("lilb");
    for (const k of keys) {
      const p = it.positions[k], unit = OFF.has(k) ? "offense" : SPEC.has(k) ? "special" : "defense";
      const ath = (p.athletes || []).slice().sort((a, b) => (a.slot || 0) - (b.slot || 0));
      if (k === "wr") {
        const slots = [...new Set(ath.map((a) => a.slot))].sort((a, b) => a - b);
        const ids = ["LWR", "RWR", "SWR"];
        // Some feeds put all receivers in one slot: deal them out across the three spots.
        let groups = slots.length >= 2 ? slots.map((s) => ath.filter((a) => a.slot === s)) : [[], [], []];
        if (slots.length < 2) ath.forEach((a, i) => groups[i % 3].push(a));
        groups.slice(0, 3).forEach((grp, i) => {
          const list = grp.map((a) => R[idOf(a.athlete?.$ref)]).filter(Boolean);
          if (list.length) depthOut.push({ id: ids[i].toLowerCase(), unit, pos: ids[i], players: list.map((r) => r.name), numbers: list.map((r) => r.jersey) });
        });
        continue;
      }
      let pos = k.toUpperCase();
      if (pos === "P") pos = "PT";
      if (is34 && MAP34[k]) pos = MAP34[k];
      const list = ath.map((a) => R[idOf(a.athlete?.$ref)]).filter(Boolean);
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
