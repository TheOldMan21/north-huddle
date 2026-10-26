#!/usr/bin/env python3
"""Builds index.html from src/hub.html (the app) + src/shim.js + src/site.js + src/site.css."""
import pathlib, re
R = pathlib.Path(__file__).parent
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
    '<meta name="theme-color" content="#4F2683">\n<link rel="icon" href="/icon.svg" type="image/svg+xml">\n<link rel="apple-touch-icon" href="/apple-touch-icon.png">\n<link rel="manifest" href="/manifest.webmanifest">\n'
    '<meta property="og:type" content="website">\n<meta property="og:site_name" content="North Huddle">\n<meta property="og:title" content="North Huddle">\n'
    '<meta property="og:description" content="Live scores, fantasy leagues, game picks and fan chat. An unofficial Minnesota football fan hub.">\n'
    '<meta property="og:image" content="https://north-huddle.pages.dev/og.png">\n<meta property="og:url" content="https://north-huddle.pages.dev/">\n'
    '<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:image" content="https://north-huddle.pages.dev/og.png">\n<meta name="mobile-web-app-capable" content="yes">')

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

# --- inject data layer before the app scripts ---
shim = (R / "src/shim.js").read_text()
rep('<script id="hub-snapshot"', '<script src="/js/supabase.js"></script>\n<script>\n' + shim + '\n</script>\n<script id="hub-snapshot"')

# --- styles + site script at the end ---
css = (R / "src/site.css").read_text()
site = "\n".join((R / f).read_text() for f in ["src/site.js", "src/teams.js", "src/live.js", "src/league.js", "src/sleeper.js", "src/social.js", "src/community.js", "src/talk.js", "src/app.js", "src/search.js", "src/admin.js"])
h = h + "\n<style>\n" + css + "\n</style>\n<script>\n" + site + "\n</script>\n"

if not h.lstrip().lower().startswith("<!doctype"):
    h = '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n' + h
    if "</html>" not in h: h += "\n</html>\n"
(R / "index.html").write_text(h)
print("index.html", len(h), "bytes")
