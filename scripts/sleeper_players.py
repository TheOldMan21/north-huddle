#!/usr/bin/env python3
"""Compact Sleeper player directory (id -> [name, pos, team, injury]) for the site's Sleeper league view."""
import json, sys, urllib.request
r = urllib.request.Request("https://api.sleeper.app/v1/players/nfl", headers={"user-agent": "NorthHuddle data job"})
with urllib.request.urlopen(r, timeout=120) as f: P = json.load(f)
out = {}
for pid, p in P.items():
    pos = p.get("position") or ""
    if pos not in ("QB", "RB", "WR", "TE", "K", "DEF"): continue
    if pos != "DEF" and not p.get("team") and not p.get("active"): continue
    name = p.get("full_name") or f"{p.get('first_name','')} {p.get('last_name','')}".strip()
    out[pid] = [name, pos, p.get("team") or "", p.get("injury_status") or ""]
json.dump(out, sys.stdout, separators=(",", ":"))
print(f"sleeper players: {len(out)}", file=sys.stderr)
