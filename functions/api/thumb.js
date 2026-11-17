// GET /api/thumb?u=<article url> — finds the article's preview image (og:image / twitter:image) and redirects to it.
// Cached at the edge for a week, so each article page is only fetched once. Returns 404 when there's no image.
const IMG_RE = [
  /<meta[^>]+(?:property|name)=["'](?:og:image(?::secure_url)?|twitter:image(?::src)?)["'][^>]*content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:image(?::secure_url)?|twitter:image(?::src)?)["']/i,
  /<link[^>]+rel=["']image_src["'][^>]*href=["']([^"']+)["']/i,
];
const SB = "https://hoxcsdtbljhfappkshya.supabase.co", SBK = "sb_publishable_KON7uG5HO_MW7fi2JVo9aw_-mpduqIe";
const TRUSTED = /(^|\.)(espn\.com|vikings\.com|nfl\.com)$/i;
async function allowed(t) {
  if (TRUSTED.test(t.hostname)) return true;
  try { // is this URL one of the site's news/interview links?
    const q = `${SB}/rest/v1/docs?select=path&limit=1&col=in.(news,videos)&data->>url=eq.${encodeURIComponent(t.href)}`;
    const r = await fetch(q, { headers: { apikey: SBK, authorization: "Bearer " + SBK } });
    if (r.ok && (await r.json()).length) return true;
    const r2 = await fetch(`${SB}/rest/v1/docs?select=path&limit=1&col=in.(pstats,teams)&data::text=ilike.${encodeURIComponent("*" + t.href.replace(/[*,()]/g, "") + "*")}`, { headers: { apikey: SBK, authorization: "Bearer " + SBK } });
    return r2.ok && (await r2.json()).length > 0;
  } catch (e) { return false; }
}
const decode = (s) => s.replace(/&amp;/g, "&").replace(/&#x2F;/gi, "/").replace(/&#47;/g, "/").replace(/&quot;/g, '"');
export async function onRequest(ctx) {
  const url = new URL(ctx.request.url);
  let target;
  try { target = new URL(url.searchParams.get("u") || ""); } catch (e) { return new Response("bad url", { status: 400 }); }
  if (!/^https?:$/.test(target.protocol) || target.port || /^(localhost|\[|\d+$|\d+\.\d+\.\d+\.\d+$)/.test(target.hostname) || !target.hostname.includes(".")) return new Response("bad url", { status: 400 });
  const key = new Request(url.origin + "/api/thumb?u=" + encodeURIComponent(target.href)), cache = caches.default;
  const hit = await cache.match(key); if (hit) return hit;
  // Only articles the site itself links to (or ESPN), so this can't be used as an open redirect or URL fetcher.
  if (!(await allowed(target))) return new Response("not allowed", { status: 403, headers: { "cache-control": "public, max-age=3600" } });
  let img = "";
  try {
    const r = await fetch(target.href, { headers: { "user-agent": "Mozilla/5.0 (compatible; NorthHuddleBot/1.0; link preview)", accept: "text/html" }, redirect: "follow", cf: { cacheTtl: 86400 } });
    if (r.ok && /html/i.test(r.headers.get("content-type") || "")) {
      // only read the top of the page, where the meta tags live
      const reader = r.body.getReader(), dec = new TextDecoder(); let html = "";
      while (html.length < 300000) { const { done, value } = await reader.read(); if (done) break; html += dec.decode(value, { stream: true }); if (/<\/head>/i.test(html)) break; }
      try { reader.cancel(); } catch (e) {}
      for (const re of IMG_RE) { const m = html.match(re); if (m) { img = new URL(decode(m[1].trim()), r.url || target.href).href; break; } }
    }
  } catch (e) {}
  if (img && img.startsWith("http://")) img = "https://" + img.slice(7);
  if (img && !/^https:\/\//.test(img)) img = "";
  // skip team logos and generic placeholder art (the site shows no team logos)
  if (/teamlogos|\/logos?\/|logo[-_.]|default[-_]?(article|image|share)|placeholder|fallback/i.test(img)) img = "";
  const resp = img
    ? new Response(null, { status: 302, headers: { location: img, "cache-control": "public, max-age=604800" } })
    : new Response("no image", { status: 404, headers: { "cache-control": "public, max-age=86400" } });
  ctx.waitUntil(cache.put(key, resp.clone()));
  return resp;
}
