# North Huddle

Unofficial Minnesota football fan hub (owner: TheOldMan21). Hosted on Cloudflare Pages from this repo's `main` branch; every push redeploys in about a minute.

## Layout
- `src/hub.html` — the app (markup, CSS, all feature scripts). Edit this for features/UI.
- `src/shim.js` — data layer: implements the `claude.use("db"|"user")` API the app was written against, on top of Supabase (`docs` table: path → JSON).
- `src/site.js` / `src/site.css` — North Huddle overrides: email sign-in sheet, branding + disclaimer footer, update requests, live scores polling `/api/scores`.
- `build.py` — assembles `index.html` from the above. **Always run `python3 build.py` after editing anything in `src/`, and commit `index.html`.**
- `functions/api/scores.js` — Cloudflare Pages Function proxying ESPN's scoreboard + scoring plays (30 s edge cache).
- `js/supabase.js` — vendored supabase-js 2.45.4 UMD.
- `supabase/admin.sql` — admin page support (banned table, admin_users RPC, can_write with ban check). Run AFTER setup.sql whenever setup.sql is re-run.
- `src/round3.js` — spam filter (no links/repeats), pick'em, fan power rankings, member profiles, AI recaps (`functions/api/recap.js`), watch party.
- `src/admin.js` — owner-only admin page (Members / Chat / Leagues), opened from the account sheet or /#admin.
- `supabase/setup.sql` — database schema, access rules, RPCs (`doc_update` deep merge, `doc_acquire` lease). Re-runnable in the Supabase SQL Editor.
- `scripts/nh.py` — CLI for scheduled updates to read/write docs as the bot (`NH_BOT_PW` env var).

## Data
Collections (doc paths like `players/justin-jefferson`): hub/meta, news, players, games, standings, injuries, depth, videos, nfl, fantasy, tracked, pstats, league/standings, teams/<abbr>, fstats/wNN, fweeks/wNN (bot/admin write only) and leagues(+/chat), chat, gamechat, comments, reactions, predictions, votes, pickem, ranks, profiles/<uid> (bio, fav), scores/<uid>, requests, data/users/<uid>/settings (user-writable per rules in setup.sql).

## Trademark care
Public site: no team logos, no team names in the site name. Keep the footer disclaimer.

## Build notes
- `build.py` minifies inline JS/CSS when esbuild is available (`NH_ESBUILD=/path/to/esbuild` or `esbuild` on PATH); otherwise it writes a readable, unminified index.html (also fine to deploy). It also trims the built-in data snapshot and refreshes its meta from Supabase.
- Share previews: `functions/g/[id].js` (game links) and `functions/api/og.js` (1200x630 score image) use `lib/og/` (resvg wasm + Barlow Condensed fonts, OFL).
- Static pages: `privacy.html`, `terms.html` (#rules), `404.html`. Email templates to paste into Supabase: `supabase/emails/`.

## Moving to a custom domain
Update `SITE` in build.py and worker/alerts.js, the links in supabase/emails/*.html and privacy.html, then: Supabase → Authentication → URL Configuration (Site URL + redirect URLs), Google Cloud OAuth client (authorized JavaScript origins), re-paste the worker.
