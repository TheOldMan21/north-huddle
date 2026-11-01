// /g/<ESPN game id> — shareable game link. Link previews (texts, social apps) get the game's score image and recap;
// people are sent straight to the game on North Huddle.
import { loadGame } from "../../lib/og/game.js";
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export async function onRequest(ctx) {
  const url = new URL(ctx.request.url), id = String(ctx.params.id || "").replace(/\D/g, "").slice(0, 14);
  if (!id) return Response.redirect(url.origin + "/", 302);
  let g = null; try { g = await loadGame(id); } catch (e) {}
  const target = `/#game/${id}`;
  let title = "Game on North Huddle", desc = "Live scores, plays, box score and fan chat on North Huddle.", ver = "";
  if (g) {
    ver = g.state + g.hs + "-" + g.as;
    if (g.state === "pre") { title = `${g.awayName} at ${g.homeName} · ${g.when}`; desc = `${g.sub ? g.sub + " · " : ""}${g.venue}. Make your picks and join the game chat on North Huddle.`; }
    else {
      const lead = g.hs >= g.as ? [g.homeName, g.hs, g.awayName, g.as] : [g.awayName, g.as, g.homeName, g.hs];
      title = `${lead[0]} ${lead[1]}, ${lead[2]} ${lead[3]}${g.state === "post" ? " · Final" : " · LIVE " + g.detail}`;
      desc = g.state === "in" ? "Follow every play live with win probability, box score and fan chat." : "Box score, every play and win probability on North Huddle.";
      if (g.state === "post") { try { const r = await fetch(`${url.origin}/api/recap?event=${id}`); const d = r.ok ? await r.json() : null; if (d?.recap) desc = d.recap.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ").slice(0, 280); } catch (e) {} }
    }
  }
  const img = `${url.origin}/api/og?event=${id}&v=${encodeURIComponent(ver)}`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · North Huddle</title><meta name="description" content="${esc(desc)}">
<meta property="og:type" content="website"><meta property="og:site_name" content="North Huddle"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(img)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:url" content="${esc(url.origin + "/g/" + id)}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${esc(img)}">
<meta http-equiv="refresh" content="0;url=${target}"><link rel="icon" href="/icon.svg"></head>
<body style="font-family:system-ui;background:#4F2683;color:#fff;text-align:center;padding:40px"><p>Opening the game on North Huddle…</p><p><a style="color:#FFC62F" href="${target}">Tap here if it doesn't open</a></p>
<script>location.replace(${JSON.stringify(target)})</script></body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": g?.state === "post" ? "public, max-age=3600" : "public, max-age=60" } });
}
