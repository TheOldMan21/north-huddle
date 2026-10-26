// GET /api/data?f=players|sleeper — serves the files the GitHub data job publishes (15-minute edge cache).
const FILES = { players: "players.json", sleeper: "sleeper.json" };
export async function onRequest(ctx) {
  const url = new URL(ctx.request.url), f = FILES[url.searchParams.get("f")];
  if (!f) return new Response('{"error":"file"}', { status: 400, headers: { "content-type": "application/json" } });
  const key = new Request(url.origin + "/api/data?f=" + f), cache = caches.default;
  const hit = await cache.match(key); if (hit) return hit;
  const r = await fetch("https://github.com/TheOldMan21/north-huddle/releases/download/espn-data/" + f);
  if (!r.ok) return new Response('{"error":"missing"}', { status: 502, headers: { "content-type": "application/json" } });
  const body = await r.text();
  ctx.waitUntil(cache.put(key, new Response(body, { headers: { "content-type": "application/json", "cache-control": "public, max-age=900" } })));
  return new Response(body, { headers: { "content-type": "application/json", "cache-control": "public, max-age=600" } });
}
