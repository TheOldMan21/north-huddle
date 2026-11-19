// GET /api/boot — every public, bot-written collection in ONE response (30 s edge cache).
// The site's data layer (src/shim.js) reads its first load from here instead of making ~15 separate database calls.
const SB = "https://hoxcsdtbljhfappkshya.supabase.co", SBK = "sb_publishable_KON7uG5HO_MW7fi2JVo9aw_-mpduqIe";
const BOOT_COLS = ["hub", "depth", "videos", "nfl", "fantasy", "tracked", "pstats", "games", "players", "news", "standings", "injuries", "league", "teams"];
const H = { "content-type": "application/json", "cache-control": "public, max-age=15" };
export async function onRequestGet(ctx) {
  const url = new URL(ctx.request.url), key = new Request(url.origin + "/api/boot"), cache = caches.default;
  const hit = await cache.match(key); if (hit) return hit;
  let rows;
  try {
    const r = await fetch(`${SB}/rest/v1/docs?select=path,col,id,data&col=in.(${BOOT_COLS.join(",")})&order=path.asc&limit=5000`, { headers: { apikey: SBK, authorization: "Bearer " + SBK } });
    if (!r.ok) throw new Error("db " + r.status);
    rows = await r.json();
  } catch (e) { return new Response(JSON.stringify({ error: "upstream" }), { status: 502, headers: { "content-type": "application/json", "cache-control": "no-store" } }); }
  const body = JSON.stringify({ at: new Date().toISOString(), cols: BOOT_COLS, rows });
  ctx.waitUntil(cache.put(key, new Response(body, { headers: { "content-type": "application/json", "cache-control": "public, max-age=30" } })));
  return new Response(body, { headers: H });
}
