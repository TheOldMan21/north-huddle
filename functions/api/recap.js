// GET /api/recap?event=ESPN_ID — a short AI-written recap of a finished game (cached for 7 days once final).
const SUM = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=";
const MODELS = ["@cf/meta/llama-3.3-70b-instruct-fp8-fast", "@cf/meta/llama-3.1-8b-instruct"];
const json = (o, s = 200, h = {}) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", ...h } });
export async function onRequest(ctx) {
  const { request, env } = ctx;
  const url = new URL(request.url), id = (url.searchParams.get("event") || "").replace(/\D/g, "").slice(0, 14);
  if (!id) return json({ error: "event" }, 400);
  const key = new Request(url.origin + "/api/recap?event=" + id), cache = caches.default;
  const hit = await cache.match(key); if (hit) return hit;
  if (!env.AI) return json({ error: "not_configured" }, 503);
  let s; try { const r = await fetch(SUM + id, { headers: { "user-agent": "Mozilla/5.0 (NorthHuddle)" } }); s = r.ok ? await r.json() : null; } catch (e) {}
  if (!s) return json({ error: "upstream" }, 502);
  const comp = s.header?.competitions?.[0] || {}, st = comp.status?.type || {};
  const cs = comp.competitors || [], h = cs.find((x) => x.homeAway === "home") || {}, a = cs.find((x) => x.homeAway === "away") || {};
  const name = (c) => c.team?.displayName || c.team?.abbreviation || "";
  if (st.state !== "post") return json({ final: false, error: "not_final" });
  const lines = [];
  lines.push(`FINAL: ${name(a)} ${a.score} at ${name(h)} ${h.score}${st.detail && /OT/.test(st.detail) ? " (OT)" : ""}. Venue: ${s.gameInfo?.venue?.fullName || ""}.`);
  lines.push("Scoring plays: " + (s.scoringPlays || []).map((p) => `Q${p.period?.number} ${p.clock?.displayValue} ${p.team?.abbreviation}: ${p.text} (${p.awayScore}-${p.homeScore})`).join(" | "));
  for (const t of s.leaders || []) lines.push(`${t.team?.abbreviation} leaders: ` + (t.leaders || []).map((c) => `${c.displayName}: ${c.leaders?.[0]?.athlete?.displayName} ${c.leaders?.[0]?.displayValue}`).join("; "));
  for (const t of s.boxscore?.teams || []) lines.push(`${t.team?.abbreviation} team stats: ` + (t.statistics || []).filter((x) => ["totalYards", "netPassingYards", "rushingYards", "turnovers", "possessionTime", "thirdDownEff"].includes(x.name)).map((x) => `${x.label} ${x.displayValue}`).join(", "));
  const prompt = `Write a short, lively game recap (90-130 words, 1-2 paragraphs, plain text, no headline) for fans, using ONLY these facts. Mention the final score, the key turning points and top performers. Do not invent anything.\n\n${lines.join("\n")}`;
  let recap = "";
  for (const m of MODELS) { try { const r = await env.AI.run(m, { messages: [{ role: "system", content: "You are a concise NFL beat writer. Accurate, upbeat, never invent stats." }, { role: "user", content: prompt }], max_tokens: 380, temperature: 0.4 }); recap = String(r?.response || "").trim(); if (recap) break; } catch (e) {} }
  if (!recap) return json({ error: "unavailable" }, 502);
  const out = { final: true, event: id, title: `${name(a)} ${a.score}, ${name(h)} ${h.score}`, home: h.team?.abbreviation, away: a.team?.abbreviation, hs: Number(h.score), as: Number(a.score), recap, at: new Date().toISOString() };
  const body = JSON.stringify(out);
  ctx.waitUntil(cache.put(key, new Response(body, { headers: { "content-type": "application/json", "cache-control": "public, max-age=604800" } })));
  return new Response(body, { headers: { "content-type": "application/json", "cache-control": "public, max-age=3600" } });
}
