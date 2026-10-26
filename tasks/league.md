# Fantasy league data (schedule, rankings, scoring)

Follow tasks/common.md for data access. Only write fweeks, fstats and the single doc fantasy/ros. Never write leagues (read only).

Team abbreviations (use exactly): ARI ATL BAL BUF CAR CHI CIN CLE DAL DEN DET GB HOU IND JAX KC LV LAC LAR MIA MIN NE NO NYG NYJ PHI PIT SF SEA TB TEN WSH. Normalize ESPN's "WAS" to WSH.

"Tuesday run" = it is Tuesday in America/Chicago now (`TZ=America/Chicago date`), or this run's extra message says SETUP RUN.

0. Read fantasy/week (its "week" is the current NFL week), fantasy/ros (may not exist), list fweeks, list leagues.

1. Schedule docs. Make sure fweeks/wNN (w01..w18) exists for every week from the current week through 18, as {week, games:[{home, away, kickoff (ISO UTC), espnId}], updatedAt}. Source: WebFetch https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week=N&dates=2026 (every event's id, home/away abbreviations, start time). Create only missing weeks, except on a Tuesday run also refresh the current and next week. 2026 regular season only.

2. Rankings. On a Tuesday run, or when fantasy/ros is missing or its updatedAt is more than 8 days old, set fantasy/ros = {updatedAt, note (sources and "PPR, rest of season"), players:[{name, abbr, pos}]}: about 180 QB/RB/WR/TE in rest-of-season PPR order, then the top 16 kickers (pos "K"), then all 32 defenses (pos "DEF", name "<Nickname> D/ST", abbr). Research current 2026 rest-of-season rankings (FantasyPros, ESPN, CBS, Yahoo); check current teams; names without Jr./Sr.

3. Scoring. If no league doc has status "season", stop and end with exactly "No league scoring needed."
 Scoring week W = the highest week in fweeks with at least one kickoff at or before now.
 On a non-Tuesday run, if no game of week W kicked off between 4.5 hours ago and now, stop and end with exactly "No games in progress."
 Player ids to score: the union of every in-season league's rosters ({uid:[pid,...]}) plus every pid in its lineups for week W (lineups.{uid}.wNN.{slot}:[pid|null]). Ids starting "def-" are defenses (abbr = rest, uppercased). Other ids start with the team abbreviation in lowercase (e.g. "min-justin-jefferson"); get nfl/<abbr lowercase>, whose players array holds [id, name, pos, status]. Match by name across box scores if a player changed teams.
 For each game of week W that has kicked off, get the box score (WebFetch https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=<espnId>: passing, rushing, receiving, fumbles, kicking, defensive and return stats, score and status; pro-football-reference.com as fallback/cross-check for finals).
 set fstats/wNN = {week: W, final: (true only on a Tuesday run when every game of week W is final), updatedAt, players:{<pid>:{...}}}. Player keys (nonzero only): pass_yd, pass_td, int, rush_yd, rush_td, rec, rec_yd, rec_td, fum (lost), two, ret_td, xp, xpmiss, fg0_39, fg40_49, fg50, fgmiss. Defense keys: sack, def_int, fr, def_td, safety, ret_td, pa (points allowed so far; always include once the game started). Keep existing entries for players no longer rostered.
 On a Tuesday run also make sure week W-1 is final; finish it the same way if not.
 Also update fweeks/wNN for week W: for every game that has kicked off set hs, as, status ("Q3 5:12", "Halftime", "Final") and final (true once over), keeping other fields.

Finish with one short line such as "Scored week 8: 112 players (live)." Never write anything notification-worthy.
