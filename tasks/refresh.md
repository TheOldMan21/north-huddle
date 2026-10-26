# Hub refresh (full refresh, TEAM RUN, TRACKER-ONLY RUN)

Follow tasks/common.md for data access. "Read/list/write" below means nh.py.

Run modes, decided by this run's extra message:
- Starts with "TRACKER-ONLY RUN": do only step T for the players it names (read tracked and pstats first), then update hub/meta.updatedAt, and finish with exactly "No new Vikings updates."
- Starts with "TEAM RUN: <ABBR>" (e.g. "TEAM RUN: PHI"): do only step H for that team, and finish with exactly "No new Vikings updates." Never touch the Minnesota collections in a TEAM RUN. If ABBR is MIN, do a full refresh instead.
- Otherwise do the full refresh (steps 1–3, T, F, 4). The full refresh does NOT refresh other teams' hubs; they refresh only via TEAM RUN when someone opens them.

Never read or write leagues, fstats, fweeks, chat, requests, profiles, scores, the doc fantasy/ros, or anything under data/.

1. Read the current data first: get hub/meta, and list games, players, news, videos, standings, injuries, depth, tracked, pstats, fantasy. Do NOT read the nfl collection (large player directory used for search).
2. Research the latest Minnesota Vikings info with WebSearch and WebFetch. Good sources: https://www.pro-football-reference.com/teams/min/2026.htm (results, schedule, season player stats), https://www.pro-football-reference.com/years/2026/ (NFC North standings), https://cbssports.com/nfl/teams/MIN/minnesota-vikings (news and injury notes), https://www.ourlads.com/nfldepthcharts/depthchart/MIN (depth chart), https://www.lineups.com/nfl/roster/minnesota-vikings (jersey numbers), https://www.vikings.com/video/ (coach and player interviews / press conferences), https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/min (record, next game), plus news searches like "Minnesota Vikings news". Confirm scores with two sources when possible; ignore low-quality or AI-generated sites. Only report things that have actually happened as of the real current time (`date -u`); never describe future events as done.
3. Write only what changed, using batch (prefer "update" for existing docs so other fields are kept). Schemas (keep them exactly):
 - hub/meta: {updatedAt ISO (real now), season, record "W-L", recordHome, recordAway, divisionRank, streak, pf, pa, alert (one short headline sentence for the most important current item, or ""), alertAt ISO, statsAsOf "Week N", standingsNote, depthAsOf "Mon D, YYYY"}. ALWAYS update updatedAt on every run.
 - games/wNN (w01..w18): {week, opp, oppAbbr, home bool, status "final"|"scheduled"|"live"|"bye", kickoff ISO UTC (when known), date YYYY-MM-DD, venue, tv, note (key performers for finals), us, them, result "W"|"L"|"T", plays (optional array of scoring-play lines; keep it if present)}. The site shows live scores itself from ESPN every minute, so you only need final results and schedule details.
 - players/<slug>: {name, pos, unit offense|defense|special, status (omit or e.g. "IR","Out","Questionable"), rank (pass yds + rush yds + rec yds + 5*tackles + 20*sacks), stats:{pass:{cmp,att,yds,td,int,rate}, rush:{att,yds,td}, rec:{rec,tgt,yds,td}, def:{tkl,sacks,int,ff}, kick:{fgm,fga,xpm,xpa,note}}, log:[{wk:"Wk 5", opp:"@ NO · W 23-13", line:"6 rec, 79 yds, 1 TD"}]} — season totals; only stat groups that apply. log = last 6 games newest first from his 2026 Pro-Football-Reference game log, for QBs, RBs, WRs, TEs, the kicker and the top 10 defenders by rank. Names without Jr./Sr., common first names (e.g. "Josh Metellus", "Byron Murphy", "Ivan Pace", "Aaron Jones").
 - depth/<pos lowercase>: {unit "offense"|"defense"|"special", pos, order (keep existing), players:[names, starter first], numbers:[jersey number of each player, same order; null if unknown]}. Offense pos: LWR, LT, LG, C, RG, RT, TE, RWR, SWR, QB, RB, FB. Defense: LDE, NT, RDE, LOLB, WLB, MLB, ROLB, LCB, SS, FS, RCB, NB. Special: PK, PT, LS, H, KO, PR, KR. Whenever you change players, rewrite numbers to match.
 - news/<slug of headline, ≤60 chars>: {headline, summary (one sentence in your own words, never copied), date ISO, source, url}. Add new Vikings-specific stories; delete news older than 21 days.
 - videos/<short slug>: {who, role, title (own words), date ISO, label (e.g. "Postgame · Week 7"), source, url}. Only coach/player interviews and press conferences, never highlights. Keep at most 20; delete any older than 21 days.
 - standings/<abbr lowercase> for MIN, GB, DET, CHI: {team, abbr, w, l, t, pf, pa}.
 - injuries/<slug>: {player, pos, status (Questionable, Doubtful, Out, Injured reserve, PUP, Concussion protocol, Day-to-day), injury (body part and side when known, e.g. "Left ankle"), note}. Delete entries for players who are healthy again.

H. Other team's hub (TEAM RUN only). Build or refresh ONE document teams/<abbr lowercase> with `set` from a local JSON file. Also refresh league/standings.
 Team abbreviations: ARI ATL BAL BUF CAR CHI CIN CLE DAL DEN DET GB HOU IND JAX KC LV LAC LAR MIA MIN NE NO NYG NYJ PHI PIT SF SEA TB TEN WSH.
 Pro-Football-Reference codes (https://www.pro-football-reference.com/teams/<code>/2026.htm): ARI crd, ATL atl, BAL rav, BUF buf, CAR car, CHI chi, CIN cin, CLE cle, DAL dal, DEN den, DET det, GB gnb, HOU htx, IND clt, JAX jax, KC kan, LV rai, LAC sdg, LAR ram, MIA mia, MIN min, NE nwe, NO nor, NYG nyg, NYJ nyj, PHI phi, PIT pit, SF sfo, SEA sea, TB tam, TEN oti, WSH was. Depth chart: https://www.ourlads.com/nfldepthcharts/depthchart/<ABBR> (ARZ for Arizona, WAS for Washington). Jersey numbers: https://www.lineups.com/nfl/roster/<team-name-slug>. Injuries and news: https://www.cbssports.com/nfl/teams/<ABBR>/ plus WebSearch. Interviews: the team's official site video page or WebSearch "<team> press conference". Record/next game: https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/<abbr lowercase>. 2026 season only.
 Team doc schema (same field formats as step 3; every array item needs an "id"):
 {abbr, updatedAt ISO,
  meta:{updatedAt (same), season 2026, record, recordHome, recordAway, divisionRank, streak, pf, pa, alert, alertAt, statsAsOf, depthAsOf},
  games:[{id:"w01".."w18", week, opp, oppAbbr, home, status, kickoff, date, venue, tv, note, us, them, result}] (all 18 weeks incl. bye; "us" = this team's score),
  players:[{id (slug), name, pos, unit, status, rank, stats:{…}}] (top ~35 contributors, plus starting QB/K),
  depth:[{id (pos lowercase), unit, pos, order, players:[…], numbers:[…]}] — offense LWR, RWR, SWR, LT, LG, C, RG, RT, TE, QB, RB, FB; defense EITHER 3-4 (LDE, NT, RDE, LOLB, WLB, MLB, ROLB) OR 4-3 (LDE, LDT, RDT, RDE, WLB, MLB, SLB) matching the team's base, plus LCB, RCB, SS, FS, NB; special PK, PT, LS, H, KO, PR, KR,
  injuries:[{id, player, pos, status, injury, note}],
  news:[{id, headline, summary, date, source, url}] (8–15 recent stories, own words),
  videos:[{id, who, role, title, date, label, source, url}] (up to 12 interviews/pressers)}.
 league/standings: {divisions:{"AFC East":[{team, abbr, w, l, t, pf, pa}, …], … all 8 …}, updatedAt} from https://www.pro-football-reference.com/years/2026/.

T. Tracked players. tracked/<id> = {name, abbr, team, pos, addedAt}. For EACH, write pstats/<same id>:
 {name, abbr, team, pos, season "2026", status ("" if healthy), injury ("" if none), headline (one compact line of key season numbers), groups:[{title:"Passing"|"Rushing"|"Receiving"|"Defense"|"Kicking"|"Punting"|"Returns", stats:[{l:"Yds", v:"1,037"}, …]}] (2026 totals, 3–8 stats each, games played "G" in the first group), lastGame:{label like "Wk 6 vs DEN · W 27-20", line} (omit if none), news:[{headline, summary (own words), date ISO, source, url}] (up to 6, newest first), updatedAt ISO}.
 Stats from the player's Pro-Football-Reference page; news via WebSearch "<name> news". If a player changed teams, update abbr/team in pstats and tracked. Delete pstats docs whose id is no longer in tracked.

F. Fantasy tab (for ANY fantasy player in any league; never Vikings-focused). Docs you maintain: fantasy/week, startsit, waivers, rankings, injuries (never fantasy/ros). Refresh all five when the upcoming NFL week changed (rolls over Tuesday morning) or fantasy/week.updatedAt is over 24 hours old; otherwise update only fantasy/injuries if a notable injury happened. Research current 2026-week articles (4for4, FantasyPros, CBS, ESPN, ClutchPoints, Rotoballer, Yahoo, FanDuel Research); verify players' teams. Reasons in your own words, short, concrete, with a key number. Schemas:
 - fantasy/week: {week, title "Week N", dates "Oct 22–26", scoring "PPR", byes:[abbr…], summary (league-wide, 1–2 sentences), lockNote (first kickoff in CT, Sunday/Monday starts), updatedAt, sources:[{name, url}] (3–5)}.
 - fantasy/startsit: {items:[{name, abbr, pos, opp ("vs DAL"/"at TB"), call "start"|"sit"|"flex", reason}], updatedAt}. 4–6 per position.
 - fantasy/waivers: {items:[{name, abbr, pos, rostered, priority 1|2|3, label, reason}], updatedAt}. 10–14 players, mostly under 50% rostered.
 - fantasy/rankings: {QB:[{name, abbr, opp}] top 12, RB top 20, WR top 20, TE top 10, note, updatedAt}.
 - fantasy/injuries: {items:[{name, abbr, pos, status, impact}], updatedAt}. 6–10.

4. Notify (full refresh only): if something important happened since the last run (a final score, a big injury, a trade/signing/release, a key depth-chart change, kickoff within 3 hours, or a tracked player injured or traded), finish with a short notification-style summary starting with the most important item, e.g. "FINAL: Vikings 27, Colts 20 (6-0). Jefferson 8-112, 2 TD." Otherwise end with exactly "No new Vikings updates."
