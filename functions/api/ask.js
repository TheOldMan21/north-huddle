// POST /api/ask — the North Huddle assistant ("Huddle"), powered by Cloudflare Workers AI.
// Needs a Workers AI binding named "AI" on the Pages project (Settings → Bindings → Add → Workers AI).
const MODELS = ["@cf/meta/llama-3.3-70b-instruct-fp8-fast", "@cf/meta/llama-3.1-8b-instruct"];
const LIMIT_PER_HOUR = 30;
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json" } });

const SYSTEM = `You are Huddle, the friendly assistant on North Huddle, an unofficial fan site focused on Minnesota football (not affiliated with any team or the NFL).
- Keep answers short: usually 2-5 sentences, under 120 words. Plain text, no markdown headers.
- For facts about records, schedules, scores, stats, injuries, standings and news, use ONLY the SITE DATA below. If the answer is not there, say you don't have that info right now instead of guessing. Never invent stats or scores.
- You can explain football rules, positions, strategy and fantasy football concepts from general knowledge.
- You can point people to parts of the site: Home (scores, game picks, fan chat), Schedule (team schedule, all scores, standings), Players (roster, depth chart, tracker/search, compare), Fantasy (league, Sleeper, start/sit, waivers, rankings), News.
- No betting or gambling advice. Be upbeat, never rude, and keep it family friendly.`;

export async function onRequestPost(ctx) {
  const { request, env } = ctx;
  if (!env.AI) return json({ error: "not_configured" }, 503);
  let body;
  try { body = await request.json(); } catch (e) { return json({ error: "bad_request" }, 400); }
  const q = String(body.q || "").trim().slice(0, 500);
  if (!q) return json({ error: "empty" }, 400);
  const context = String(body.context || "").slice(0, 14000);
  const history = (Array.isArray(body.history) ? body.history : []).slice(-6)
    .map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content || "").slice(0, 800) }));

  // simple per-visitor hourly limit (best effort)
  const ip = request.headers.get("cf-connecting-ip") || "x";
  const hour = Math.floor(Date.now() / 3600e3);
  const key = new Request(`https://limits.north-huddle/ask/${encodeURIComponent(ip)}/${hour}`);
  const cache = caches.default, hit = await cache.match(key);
  const used = hit ? Number(await hit.text()) || 0 : 0;
  if (used >= LIMIT_PER_HOUR) return json({ error: "rate_limited" }, 429);
  ctx.waitUntil(cache.put(key, new Response(String(used + 1), { headers: { "cache-control": "max-age=3600" } })));

  const today = new Date().toLocaleString("en-US", { timeZone: "America/Chicago", weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });
  const messages = [{ role: "system", content: `${SYSTEM}\n\nRight now it is ${today} (Central time).\n\nSITE DATA:\n${context}` }, ...history, { role: "user", content: q }];
  for (const model of MODELS) {
    try {
      const r = await env.AI.run(model, { messages, max_tokens: 450, temperature: 0.3 });
      const answer = String(r?.response || "").trim();
      if (answer) return json({ answer });
    } catch (e) { /* try the next model */ }
  }
  return json({ error: "unavailable" }, 502);
}
export const onRequestGet = ({ env }) => json({ ready: !!env.AI });
