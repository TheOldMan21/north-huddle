// GET /api/og?event=ESPN_ID — 1200x630 share image for a game (score, status, team colors; no logos).
import { gameSvg, svgToPng } from "../../lib/og/og.js";
import { loadGame } from "../../lib/og/game.js";
export async function onRequest(ctx) {
  const url = new URL(ctx.request.url), id = (url.searchParams.get("event") || "").replace(/\D/g, "").slice(0, 14);
  if (!id) return Response.redirect(url.origin + "/og.png", 302);
  const key = new Request(url.origin + "/api/og?event=" + id + "&v=" + (url.searchParams.get("v") || "")), cache = caches.default;
  const hit = await cache.match(key); if (hit) return hit;
  let g = null; try { g = await loadGame(id); } catch (e) {}
  if (!g) return Response.redirect(url.origin + "/og.png", 302);
  let png; try { png = await svgToPng(gameSvg(g)); } catch (e) { return Response.redirect(url.origin + "/og.png", 302); }
  const age = g.state === "post" ? 604800 : g.state === "in" ? 60 : 3600;
  const resp = new Response(png, { headers: { "content-type": "image/png", "cache-control": `public, max-age=${age}` } });
  ctx.waitUntil(cache.put(key, resp.clone()));
  return resp;
}
