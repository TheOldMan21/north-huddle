#!/usr/bin/env python3
"""Keeps North Huddle fresh without relying on GitHub's cron (which on free repos often fires only every few hours).

Run by .github/workflows/site-update-loop.yml: one GitHub Actions job that runs scripts/updater.py every
20 minutes (every 10 during game windows) for ~5h40m, then the workflow starts its own next run.
Public repos get unlimited free Actions minutes, so this costs nothing.
"""
import datetime as dt, os, subprocess, sys, time

LIMIT = float(os.environ.get("LOOP_SECONDS", 5 * 3600 + 40 * 60))

def game_window(now):
    # UTC: Sunday 17:00-23:59, and 00:00-04:59 on Mon/Tue/Fri (Sun/Mon/Thu night games in Central time)
    wd, h = now.weekday(), now.hour   # Mon=0 … Sun=6
    return (wd == 6 and h >= 17) or (wd in (0, 1, 4) and h < 5)

start = time.time(); n = 0; fails = 0
while True:
    n += 1
    now = dt.datetime.now(dt.timezone.utc)
    print(f"--- update #{n} at {now:%H:%M:%S}Z", flush=True)
    r = subprocess.run([sys.executable, "scripts/updater.py"])
    fails = fails + 1 if r.returncode else 0
    if fails >= 5:
        print("5 failed updates in a row; stopping this loop (the next scheduled run starts a new one).", flush=True)
        sys.exit(1)
    wait = 600 if game_window(dt.datetime.now(dt.timezone.utc)) else 1200
    if time.time() - start + wait > LIMIT:
        print(f"loop done after {n} updates", flush=True)
        break
    time.sleep(wait)
