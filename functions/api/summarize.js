// POST /api/summarize {prompt, max_tokens} — short summaries for the free updater (scripts/updater.py).
// Uses the site's Cloudflare Workers AI. Only admins (the updater bot signs in as one) may call it.
const SB = "https://hoxcsdtbljhfappkshya.supabase.co", SBK = "sb_publishable_KON7uG5HO_MW7fi2JVo9aw_-mpduqIe";
const MODELS = ["@cf/meta/llama-3.3-70b-instruct-fp8-fast", "@cf/meta/llama-3.1-8b-instruct"];
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });
async function isAdmin(auth) {
  if (!auth || !/^Bearer\s+\S+/.test(auth)) return false;
  try { const r = await fetch(`${SB}/rest/v1/rpc/is_admin`, { method: "POST", headers: { apikey: SBK, authorization: auth, "content-type": "application/json" }, body: "{}" }); return r.ok && (await r.json()) === true; } catch (e) { return false; }
}
export async function onRequestPost({ request, env }) {
  if (!env.AI) return json({ error: "not_configured" }, 503);
  if (!(await isAdmin(request.headers.get("authorization")))) return json({ error: "forbidden" }, 403);
  let b; try { b = await request.json(); } catch (e) { return json({ error: "bad_json" }, 400); }
  const prompt = String(b.prompt || "").slice(0, 3000), max = Math.min(Math.max(Number(b.max_tokens) || 120, 20), 300);
  if (!prompt) return json({ error: "prompt" }, 400);
  const messages = [{ role: "system", content: "You write short, accurate notes for a Minnesota football fan site. Use your own words, never copy sentences, never invent facts. Reply with the note only." }, { role: "user", content: prompt }];
  for (const m of MODELS) { try { const r = await env.AI.run(m, { messages, max_tokens: max, temperature: 0.4 }); const t = String(r?.response || "").trim(); if (t) return json({ text: t, model: m }); } catch (e) {} }
  return json({ error: "unavailable" }, 502);
}
export const onRequestGet = () => json({ error: "use POST" }, 405);
