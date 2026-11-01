#!/usr/bin/env python3
"""Builds index.html from src/hub.html (the app) + src/shim.js + src/site.js + src/site.css."""
import pathlib, re
R = pathlib.Path(__file__).parent
SITE = "https://north-huddle.pages.dev"   # change here (and in worker/alerts.js) when moving to a custom domain
h = (R / "src/hub.html").read_text()

def rep(old, new, count=1, must=True):
    global h
    n = h.count(old)
    if must and n == 0:
        raise SystemExit("pattern not found: " + old[:80])
    h = h.replace(old, new) if count == 0 else h.replace(old, new, count)

# --- branding ---
rep("<title>Vikings Gameday Hub</title>",
    '<title>North Huddle</title>\n<meta name="description" content="Unofficial Minnesota football fan hub: news, stats, live scores, fantasy leagues and fan chat.">\n'
    '<meta name="theme-color" content="#0B1220">\n<link rel="icon" href="/icon.svg?v=3" type="image/svg+xml">\n<link rel="icon" href="/favicon-32.png?v=3" sizes="32x32" type="image/png">\n<link rel="apple-touch-icon" href="/apple-touch-icon.png?v=3">\n<link rel="manifest" href="/manifest.webmanifest?v=3">\n'
    '<meta property="og:type" content="website">\n<meta property="og:site_name" content="North Huddle">\n<meta property="og:title" content="North Huddle">\n'
    '<meta property="og:description" content="Live scores, fantasy leagues, game picks and fan chat. An unofficial Minnesota football fan hub.">\n'
    '<meta property="og:image" content="' + SITE + '/og.png">\n<meta property="og:url" content="' + SITE + '/">\n'
    '<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:image" content="' + SITE + '/og.png">\n<meta name="mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-title" content="North Huddle">\n<meta name="apple-mobile-web-app-status-bar-style" content="default">')

# --- Claude-specific wording ---
rep("Live data can't load in this view. Open the hub from your Claude app while signed in.", "Live data couldn't load. Check your connection and refresh.")
rep('toast("Tracking needs the Claude app or claude.ai while signed in.")', 'toast("Tracking is managed by the site owner.")')
rep("Your account can't be identified on this page, so leagues aren't available. Ask the hub owner to invite your email.",
    "Sign in or create a free account to play.")
rep('''${isC?"Invite each friend's email to this hub: open the Share menu, add their email, and set them as <b>Editor</b>.":"You're in. Friends need an invite to this hub from its owner."}''',
    '''Friends create a free North Huddle account (person icon, top right).''')
rep("Couldn't send the request. Ask the hub owner to invite you as an Editor.", "Couldn't send the request. Try signing out and back in.")
rep("Couldn't send. Ask the hub owner to invite you as an Editor.", "Couldn't send. Try signing out and back in.")

# --- reactions need message ids on fan chat rows ---
rep('''`<div class="fc-msg${m.uid===ACC.id?" me":""}">${av(m.uid)}''', '''`<div class="fc-msg${m.uid===ACC.id?" me":""}" data-mid="${esc(m.id)}" data-mcol="chat">${av(m.uid)}''')

# --- trim the built-in data snapshot (other teams and fantasy load live), refresh its meta when online ---
def trim_snapshot():
    global h
    import json, urllib.request
    m = re.search(r'(<script id="hub-snapshot" type="application/json">)(.*?)(</script>)', h, re.S)
    if not m: return
    d = json.loads(m.group(2))
    for k in ("teams", "fantasy", "videos", "pstats"): d.pop(k, None)
    if isinstance(d.get("news"), list): d["news"] = sorted(d["news"], key=lambda n: str(n.get("date", "")), reverse=True)[:12]
    try:
        req = urllib.request.Request("https://hoxcsdtbljhfappkshya.supabase.co/rest/v1/docs?select=data&path=eq.hub%2Fmeta",
                                     headers={"apikey": "sb_publishable_KON7uG5HO_MW7fi2JVo9aw_-mpduqIe"})
        rows = json.load(urllib.request.urlopen(req, timeout=8))
        if rows and rows[0].get("data"): d["meta"] = rows[0]["data"]
    except Exception as e:
        print("(snapshot meta not refreshed:", e, ")")
    h = h[:m.start(2)] + json.dumps(d, separators=(",", ":"), ensure_ascii=False).replace("</", "<\\/") + h[m.end(2):]
trim_snapshot()

# --- inject data layer before the app scripts ---
shim = (R / "src/shim.js").read_text()
rep('<script id="hub-snapshot"', '<script src="/js/supabase.js"></script>\n<script>\n' + shim + '\n</script>\n<script id="hub-snapshot"')

# --- styles + site script at the end ---
css = (R / "src/site.css").read_text()
site = "\n".join((R / f).read_text() for f in ["src/site.js", "src/teams.js", "src/live.js", "src/league.js", "src/sleeper.js", "src/social.js", "src/community.js", "src/thumbs.js", "src/talk.js", "src/app.js", "src/search.js", "src/activity.js", "src/ios.js", "src/round3.js", "src/highlights.js", "src/fieldgoal.js", "src/polish.js", "src/stadium.js", "src/admin.js"])
h = h + "\n<style>\n" + css + "\n</style>\n<script>\n" + site + "\n</script>\n"

if not h.lstrip().lower().startswith("<!doctype"):
    h = '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n' + h
    if "</html>" not in h: h += "\n</html>\n"
# --- minify inline scripts/styles when esbuild is available (falls back to the readable build) ---
def minify(html):
    import shutil, subprocess, os
    exe = os.environ.get("NH_ESBUILD") or shutil.which("esbuild")
    if not exe:
        print("(esbuild not found: index.html left unminified)"); return html
    def run(code, loader):
        r = subprocess.run([exe, "--minify", "--loader=" + loader, "--target=es2020,safari15", "--log-level=error"], input=code, capture_output=True, text=True)
        if r.returncode != 0: raise SystemExit("esbuild failed: " + r.stderr[:500])
        return r.stdout
    out, n0 = [], len(html)
    pos = 0
    for m in re.finditer(r'(<script(?![^>]*\bsrc=)(?![^>]*type="application/json")[^>]*>)(.*?)(</script>)|(<style[^>]*>)(.*?)(</style>)', html, re.S):
        out.append(html[pos:m.start()])
        if m.group(1): out.append(m.group(1) + run(m.group(2), "js").strip() + m.group(3))
        else: out.append(m.group(4) + run(m.group(5), "css").strip() + m.group(6))
        pos = m.end()
    out.append(html[pos:])
    html = "".join(out); print(f"minified {n0} -> {len(html)} bytes"); return html
h = minify(h)
(R / "index.html").write_text(h)
print("index.html", len(h), "bytes")
