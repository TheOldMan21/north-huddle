// Loads one game from ESPN's summary feed for share previews.
const SUM = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=";
const FIX = { WAS: "WSH", LA: "LAR" };
const ab = (t) => { const a = String(t?.abbreviation || "").toUpperCase(); return FIX[a] || a; };
export async function loadGame(id) {
  const r = await fetch(SUM + id, { headers: { "user-agent": "Mozilla/5.0 (NorthHuddle)" }, cf: { cacheTtl: 30 } });
  if (!r.ok) return null;
  const s = await r.json(), c = s.header?.competitions?.[0] || {}, cs = c.competitors || [];
  const h = cs.find((x) => x.homeAway === "home"), a = cs.find((x) => x.homeAway === "away"), st = c.status?.type || {};
  if (!h?.team || !a?.team) return null;
  const when = c.date ? new Date(c.date).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" }).replace(/,/g, "").replace(/ (\d+:\d\d)/, " · $1") + " CT" : "";
  return {
    id, state: st.state || "pre", detail: st.shortDetail || st.detail || "", when,
    home: ab(h.team), away: ab(a.team), hs: Number(h.score || 0), as: Number(a.score || 0),
    homeName: h.team.name || h.team.shortDisplayName || ab(h.team), awayName: a.team.name || a.team.shortDisplayName || ab(a.team),
    homeFull: h.team.displayName || "", awayFull: a.team.displayName || "",
    sub: s.header?.week ? `Week ${s.header.week}` : "", venue: s.gameInfo?.venue?.fullName || ""
  };
}
