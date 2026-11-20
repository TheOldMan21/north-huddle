#!/usr/bin/env python3
"""Keeps North Huddle fresh without relying on GitHub's cron (which on free repos often fires only every few hours).

Run by .github/workflows/site-update-loop.yml: one GitHub Actions job that runs scripts/updater.py every
20 minutes (every 10 during game windows) and refreshes the league-wide stats release file hourly (every
20 min in game windows) for ~5h40m, then the workflow starts its own next run.
Public repos get unlimited free Actions minutes, so this costs nothing.
"""
import datetime as dt, os, subprocess, sys, time

LIMIT = float(os.environ.get("LOOP_SECONDS", 5 * 3600 + 40 * 60))

def game_window(now):
    # UTC: Sunday 17:00-23:59, and 00:00-04:59 on Mon/Tue/Fri (Sun/Mon/Thu night games in Central time)
    wd, h = now.weekday(), now.hour   # Mon=0 … Sun=6
    return (wd == 6 and h >= 17) or (wd in (0, 1, 4) and h < 5)

STATS_CMD = ("python3 scripts/espn_players.py > players.json && python3 scripts/sleeper_players.py > sleeper.json && "
             "(gh release view espn-data >/dev/null 2>&1 || gh release create espn-data --title 'ESPN data (auto)' --notes 'Updated automatically. Used by the site.' --latest=false) && "
             "gh release upload espn-data players.json sleeper.json --clobber")
last_stats = 0.0

def stats_due(now):
    # league-wide stats file: hourly, every 20 min during game windows
    return time.time() - last_stats >= (1200 if game_window(now) else 3600) - 30

start = time.time(); n = 0; fails = 0
while True:
    n += 1
    now = dt.datetime.now(dt.timezone.utc)
    print(f"--- update #{n} at {now:%H:%M:%S}Z", flush=True)
    r = subprocess.run([sys.executable, "scripts/updater.py"])
    fails = fails + 1 if r.returncode else 0
    if os.environ.get("GH_TOKEN") and stats_due(now):
        print("--- stats file", flush=True)
        sr = subprocess.run(STATS_CMD, shell=True)
        if sr.returncode == 0: last_stats = time.time()
        else: print("stats file update failed; will retry next round", flush=True)
    if fails >= 5:
        print("5 failed updates in a row; stopping this loop (the next scheduled run starts a new one).", flush=True)
        sys.exit(1)
    wait = 600 if game_window(dt.datetime.now(dt.timezone.utc)) else 1200
    if time.time() - start + wait > LIMIT:
        print(f"loop done after {n} updates", flush=True)
        break
    time.sleep(wait)
