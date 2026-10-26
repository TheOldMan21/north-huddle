# Game-day check (hourly on game days)

Follow tasks/common.md for data access. The site already shows live scores from ESPN every minute; this task records results in the database.

List games. Find any Minnesota game whose kickoff is within the next 3 hours, in progress, or ended within the last 3 hours (use the real time from `date -u`). If none, stop and end with exactly "No Vikings game right now." without writing anything.

Otherwise get the current score, status and scoring plays (https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard, the game's https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=<id>, or WebSearch "Vikings score today") and update that games/wNN doc: status "live" with us/them and note like "Q3 8:12 · Jones 2 TD", or status "final" with us, them, result W/L/T and a note of key performers. Also set plays: up to 12 scoring plays, newest first, short lines in your own words like "Q3 9:40 MIN — Jones 3-yd TD run". When the game is final, also update hub/meta (record, recordHome/recordAway, streak, pf, pa, updatedAt, alert = one sentence with the final score) and standings/min. Always set hub/meta.updatedAt to the real current time.

End with a short notification-style line: kickoff reminder ("Kickoff in 2 hrs: Vikings vs Colts, FOX"), live score ("Q3: Vikings 17, Colts 10"), or "FINAL: Vikings 27, Colts 20 (6-0)". Only send each final once: if the game doc was already "final" before this run, end with exactly "No Vikings game right now."
