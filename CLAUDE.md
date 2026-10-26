# North Huddle

Unofficial Minnesota football fan hub (owner: TheOldMan21). Hosted on Cloudflare Pages from this repo's `main` branch; every push redeploys in about a minute.

## Layout
- `src/hub.html` — the app (markup, CSS, all feature scripts). Edit this for features/UI.
- `src/shim.js` — data layer: implements the `claude.use("db"|"user")` API the app was written against, on top of Supabase (`docs` table: path → JSON).
- `src/site.js` / `src/site.css` — North Huddle overrides: email sign-in sheet, branding + disclaimer footer, update requests, live scores polling `/api/scores`.
- `build.py` — assembles `index.html` from the above. **Always run `python3 build.py` after editing anything in `src/`, and commit `index.html`.**
- `functions/api/scores.js` — Cloudflare Pages Function proxying ESPN's scoreboard + scoring plays (30 s edge cache).
- `js/supabase.js` — vendored supabase-js 2.45.4 UMD.
- `supabase/setup.sql` — database schema, access rules, RPCs (`doc_update` deep merge, `doc_acquire` lease). Re-runnable in the Supabase SQL Editor.
- `scripts/nh.py` — CLI for scheduled updates to read/write docs as the bot (`NH_BOT_PW` env var).

## Data
Collections (doc paths like `players/justin-jefferson`): hub/meta, news, players, games, standings, injuries, depth, videos, nfl, fantasy, tracked, pstats, league/standings, teams/<abbr>, fstats/wNN, fweeks/wNN (bot/admin write only) and leagues(+/chat), chat, profiles/<uid>, scores/<uid>, requests, data/users/<uid>/settings (user-writable per rules in setup.sql).

## Trademark care
Public site: no team logos, no team names in the site name. Keep the footer disclaimer.
