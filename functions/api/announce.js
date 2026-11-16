// GET /api/announce?t=<line> — the Kirko Chainz announcer line as an MP3, voiced by Workers AI text-to-speech.
// Only lines from announce_lines.js (generated from src/chaingame.js) are allowed. Each is generated once and edge-cached for a year.
import { LINES } from "./announce_lines.js";
const OK = new Set(LINES);
const VOICES = [
  ["@cf/deepgram/aura-1", (t) => ({ text: t, speaker: "zeus", encoding: "mp3" })],
  ["@cf/myshell-ai/melotts", (t) => ({ prompt: t, lang: "en" })],
];
async function toBytes(r) {
  if (!r) return null;
  if (r instanceof ArrayBuffer) return new Uint8Array(r);
  if (r instanceof Uint8Array) return r;
  if (typeof r.getReader === "function") return new Uint8Array(await new Response(r).arrayBuffer());
  if (r.audio) { const b = atob(r.audio); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  return null;
}
export async function onRequest(ctx) {
  const { request, env } = ctx, url = new URL(request.url), t = (url.searchParams.get("t") || "").slice(0, 160);
  if (url.searchParams.get("list")) return new Response(JSON.stringify(LINES), { headers: { "content-type": "application/json", "cache-control": "public, max-age=600" } });
  if (!OK.has(t)) return new Response("unknown line", { status: 404 });
  const key = new Request(url.origin + "/api/announce?v=1&t=" + encodeURIComponent(t)), cache = caches.default;
  const hit = await cache.match(key); if (hit) return hit;
  if (!env.AI) return new Response("not configured", { status: 503 });
  let bytes = null, used = "";
  for (const [model, input] of VOICES) { try { bytes = await toBytes(await env.AI.run(model, input(t))); if (bytes && bytes.length > 500) { used = model; break; } } catch (e) {} }
  if (!bytes || bytes.length <= 500) return new Response("tts unavailable", { status: 502 });
  const res = new Response(bytes, { headers: { "content-type": "audio/mpeg", "cache-control": "public, max-age=31536000, immutable", "x-voice": used } });
  ctx.waitUntil(cache.put(key, res.clone()));
  return res;
}
