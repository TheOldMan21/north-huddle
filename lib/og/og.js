// Draws share-preview images (1200x630 PNG) for games. Used by /api/og and /g/<id>.
import { initWasm, Resvg } from "./resvg.mjs";
import wasm from "./resvg.wasm";
import f800 from "./bc-800.bin";
import f600 from "./bc-600.bin";
let ready = null;
const fonts = [new Uint8Array(f800), new Uint8Array(f600)];
export const TEAM = {ARI:["#97233F","#FFB612","#FFFFFF"],ATL:["#A71930","#101820","#FFFFFF"],BAL:["#241773","#9E7C0C","#FFFFFF"],BUF:["#00338D","#C60C30","#FFFFFF"],
  CAR:["#0085CA","#101820","#FFFFFF"],CHI:["#0B162A","#C83803","#FFFFFF"],CIN:["#FB4F14","#101820","#FFFFFF"],CLE:["#311D00","#FF3C00","#FFFFFF"],
  DAL:["#041E42","#869397","#FFFFFF"],DEN:["#FB4F14","#002244","#FFFFFF"],DET:["#0076B6","#B0B7BC","#FFFFFF"],GB:["#203731","#FFB612","#FFFFFF"],
  HOU:["#03202F","#A71930","#FFFFFF"],IND:["#002C5F","#A2AAAD","#FFFFFF"],JAX:["#006778","#D7A22A","#FFFFFF"],KC:["#E31837","#FFB81C","#FFFFFF"],
  LV:["#000000","#A5ACAF","#FFFFFF"],LAC:["#0080C6","#FFC20E","#FFFFFF"],LAR:["#003594","#FFA300","#FFFFFF"],MIA:["#008E97","#FC4C02","#FFFFFF"],
  MIN:["#4F2683","#FFC62F","#FFFFFF"],NE:["#002244","#C60C30","#FFFFFF"],NO:["#101820","#D3BC8D","#D3BC8D"],NYG:["#0B2265","#A71930","#FFFFFF"],
  NYJ:["#125740","#FFFFFF","#FFFFFF"],PHI:["#004C54","#A5ACAF","#FFFFFF"],PIT:["#101820","#FFB612","#FFB612"],SF:["#AA0000","#B3995D","#FFFFFF"],
  SEA:["#002244","#69BE28","#FFFFFF"],TB:["#D50A0A","#34302B","#FFFFFF"],TEN:["#0C2340","#4B92DB","#FFFFFF"],WSH:["#5A1414","#FFB612","#FFB612"]};
const MARK = `<defs><linearGradient id="nhg" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#2EE6C5"/><stop offset="1" stop-color="#7C5CFF"/></linearGradient></defs><circle cx="396.9" cy="178.5" r="20" fill="url(#nhg)"/><circle cx="422.2" cy="294.6" r="20" fill="url(#nhg)"/><circle cx="364.3" cy="398.4" r="20" fill="url(#nhg)"/><circle cx="252.2" cy="438.0" r="20" fill="url(#nhg)"/><circle cx="142.0" cy="393.4" r="20" fill="url(#nhg)"/><circle cx="88.9" cy="287.1" r="20" fill="url(#nhg)"/><circle cx="119.4" cy="172.3" r="20" fill="url(#nhg)"/><circle cx="218.2" cy="106.3" r="20" fill="url(#nhg)"/><path d="M190 352V196l130 156V150" fill="none" stroke="#fff" stroke-width="46" stroke-linejoin="round" stroke-linecap="round"/><path d="M320 70l-52 68h104z" fill="url(#nhg)" stroke="url(#nhg)" stroke-width="16" stroke-linejoin="round"/>`;
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function side(x, abbr, name, score, win, show) {
  const c = TEAM[abbr] || ["#555", "#999", "#fff"];
  return `<g transform="translate(${x},0)">
    <circle cx="0" cy="250" r="92" fill="${c[0]}" stroke="${c[1]}" stroke-width="10"/>
    <text x="0" y="276" text-anchor="middle" font-family="Barlow Condensed" font-weight="800" font-size="72" fill="${c[2]}">${esc(abbr)}</text>
    <text x="0" y="392" text-anchor="middle" font-family="Barlow Condensed" font-weight="600" font-size="38" fill="#fff" fill-opacity=".9">${esc(name)}</text>
    ${show ? `<text x="0" y="530" text-anchor="middle" font-family="Barlow Condensed" font-weight="800" font-size="150" fill="${win ? "#2EE6C5" : "#fff"}">${esc(score)}</text>` : ""}
  </g>`;
}
export function gameSvg(g) {
  const show = g.state !== "pre";
  const hw = g.state === "post" && g.hs > g.as, aw = g.state === "post" && g.as > g.hs;
  const status = g.state === "post" ? (g.detail || "Final") : g.state === "in" ? `LIVE · ${g.detail || ""}` : g.when || "Upcoming";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs><radialGradient id="bg" cx="0.8" cy="0.1" r="1"><stop offset="0" stop-color="#3a2d7a"/><stop offset=".45" stop-color="#121a33"/><stop offset="1" stop-color="#0B1220"/></radialGradient><linearGradient id="au" x1="0" x2="1"><stop offset="0" stop-color="#2EE6C5"/><stop offset="1" stop-color="#7C5CFF"/></linearGradient></defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <g transform="translate(48,34) scale(.125)">${MARK}</g>
  <text x="122" y="84" font-family="Barlow Condensed" font-weight="800" font-size="40" letter-spacing="2" fill="#fff">NORTH <tspan fill="#2EE6C5">HUDDLE</tspan></text>
  <text x="1152" y="84" text-anchor="end" font-family="Barlow Condensed" font-weight="600" font-size="34" fill="#fff" fill-opacity=".75">${esc(g.sub || "")}</text>
  ${side(330, g.away, g.awayName, g.as, aw, show)}
  ${side(870, g.home, g.homeName, g.hs, hw, show)}
  <text x="600" y="${show ? 470 : 280}" text-anchor="middle" font-family="Barlow Condensed" font-weight="800" font-size="${show ? 44 : 64}" fill="#fff" fill-opacity=".85">${show ? "" : "AT"}</text>
  <rect x="${600 - Math.max(120, status.length * 11)}" y="${show ? 228 : 450}" width="${Math.max(240, status.length * 22)}" height="58" rx="29" fill="${g.state === "in" ? "#B3261E" : "rgba(0,0,0,.28)"}"/>
  <text x="600" y="${show ? 270 : 492}" text-anchor="middle" font-family="Barlow Condensed" font-weight="800" font-size="36" letter-spacing="1" fill="#fff">${esc(status.toUpperCase())}</text>
  <text x="600" y="600" text-anchor="middle" font-family="Barlow Condensed" font-weight="600" font-size="24" fill="#fff" fill-opacity=".55">Unofficial fan site · not affiliated with the NFL or any team</text>
</svg>`;
}
export async function svgToPng(svg) {
  if (!ready) ready = initWasm(wasm);
  await ready;
  const r = new Resvg(svg, { fitTo: { mode: "width", value: 1200 }, font: { fontBuffers: fonts, loadSystemFonts: false, defaultFontFamily: "Barlow Condensed" } });
  return r.render().asPng();
}
