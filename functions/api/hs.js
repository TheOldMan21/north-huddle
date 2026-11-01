// GET /api/hs?u=<ESPN headshot url> — serves the headshot from our own address so the browser can
// draw it into the field graphic (and read its skin tone). Only ESPN's image host is allowed. Cached a week.
export async function onRequest(ctx) {
  const url = new URL(ctx.request.url); let t;
  try { t = new URL(url.searchParams.get("u") || ""); } catch (e) { return new Response("bad url", { status: 400 }); }
  if (t.protocol !== "https:" || !/^a\.espncdn\.com$/.test(t.hostname) || !/\.(png|jpg|jpeg)$/i.test(t.pathname)) return new Response("not allowed", { status: 403 });
  const key = new Request(url.origin + "/api/hs?u=" + encodeURIComponent(t.href)), cache = caches.default;
  const hit = await cache.match(key); if (hit) return hit;
  const r = await fetch(t.href, { cf: { cacheTtl: 604800 } });
  if (!r.ok) return new Response("not found", { status: 404, headers: { "cache-control": "public, max-age=3600" } });
  const resp = new Response(r.body, { headers: { "content-type": r.headers.get("content-type") || "image/png", "cache-control": "public, max-age=604800" } });
  ctx.waitUntil(cache.put(key, resp.clone()));
  return resp;
}
