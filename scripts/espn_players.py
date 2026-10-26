#!/usr/bin/env python3
"""Season stat leaders for all 32 teams from ESPN, as the site's player list shape.
Runs in GitHub Actions (ESPN's core API blocks Cloudflare). Output: JSON on stdout."""
import json, re, sys, urllib.request, datetime, concurrent.futures as cf

A = "https://site.api.espn.com/apis/site/v2/sports/football/nfl"
C = "https://sports.core.api.espn.com/v2/sports/football/leagues/nfl"
SEASON = 2026
TEAMS = "ARI ATL BAL BUF CAR CHI CIN CLE DAL DEN DET GB HOU IND JAX KC LV LAC LAR MIA MIN NE NO NYG NYJ PHI PIT SF SEA TB TEN WSH".split()

def get(u):
    r = urllib.request.Request(u, headers={"user-agent": "Mozilla/5.0 (NorthHuddle data job)"})
    try:
        with urllib.request.urlopen(r, timeout=40) as f: return json.load(f)
    except Exception as e:
        print("fail", u, e, file=sys.stderr); return None

def slug(s): return re.sub(r"^-|-$", "", re.sub(r"[^a-z0-9]+", "-", (s or "").lower()))

def team_players(abbr):
    ros = get(f"{A}/teams/{abbr.lower()}/roster")
    if not ros: return abbr, None
    tid = ros.get("team", {}).get("id")
    R = {}
    for g in ros.get("athletes", []):
        unit = {"offense": "offense", "defense": "defense", "specialTeam": "special"}.get(g.get("position"), "")
        for a in g.get("items", []):
            inj = (a.get("injuries") or [{}])[0].get("status", "")
            if g.get("position") == "injuredReserveOrOut" and not inj: inj = "Injured reserve"
            R.setdefault(a["id"], {"name": a.get("displayName"), "pos": (a.get("position") or {}).get("abbreviation", ""), "unit": unit, "status": inj, "number": a.get("jersey")})
    lead = get(f"{C}/seasons/{SEASON}/types/2/teams/{tid}/leaders") or {}
    P = {}
    for cat in lead.get("categories", []):
        for l in cat.get("leaders", []):
            m = re.search(r"athletes/(\d+)", (l.get("athlete") or {}).get("$ref", ""))
            r = R.get(m.group(1)) if m else None
            if not r: continue
            p = P.setdefault(m.group(1), {"id": slug(r["name"]), "name": r["name"], "pos": r["pos"], "unit": r["unit"] or "offense", "status": r["status"] or None, "number": r["number"], "stats": {}})
            s, v, dv = p["stats"], l.get("value"), str(l.get("displayValue", ""))
            n = cat.get("name")
            if n == "passingYards": s.setdefault("pass", {})["yds"] = v
            elif n == "passingTouchdowns": s.setdefault("pass", {})["td"] = v
            elif n == "quarterbackRating": s.setdefault("pass", {})["rate"] = v
            elif n == "passingLeader":
                mm = re.search(r"(\d+)/(\d+).*?(\d+)\s*INT", dv)
                if mm: s.setdefault("pass", {}).update(cmp=int(mm[1]), att=int(mm[2]), int=int(mm[3]))
            elif n == "rushingYards": s.setdefault("rush", {})["yds"] = v
            elif n == "rushingTouchdowns": s.setdefault("rush", {})["td"] = v
            elif n == "rushingLeader":
                mm = re.search(r"(\d+)\s*CAR", dv)
                if mm: s.setdefault("rush", {})["att"] = int(mm[1])
            elif n == "receptions": s.setdefault("rec", {})["rec"] = v
            elif n == "receivingYards": s.setdefault("rec", {})["yds"] = v
            elif n == "receivingTouchdowns": s.setdefault("rec", {})["td"] = v
            elif n == "totalTackles": s.setdefault("def", {})["tkl"] = v
            elif n == "sacks": s.setdefault("def", {})["sacks"] = v
            elif n == "interceptions": s.setdefault("def", {})["int"] = v
    out = []
    for p in P.values():
        s = p["stats"]
        if "pass" in s and not s["pass"].get("yds"): del s["pass"]
        if "pass" in s: s["pass"] = {"cmp": 0, "att": 0, "yds": 0, "td": 0, "int": 0, "rate": None, **s["pass"]}
        if "rush" in s: s["rush"] = {"att": None, "yds": 0, "td": 0, **s["rush"]}
        if "rec" in s: s["rec"] = {"rec": 0, "tgt": None, "yds": 0, "td": 0, **s["rec"]}
        if "def" in s:
            s["def"] = {"tkl": 0, "sacks": 0, "int": 0, "ff": 0, **s["def"]}
            if p["unit"] == "offense": p["unit"] = "defense"
        g = lambda grp, k: (s.get(grp) or {}).get(k) or 0
        p["rank"] = g("pass", "yds") + g("rush", "yds") + g("rec", "yds") + 5 * g("def", "tkl") + 20 * g("def", "sacks")
        out.append(p)
    out.sort(key=lambda p: -p["rank"])
    return abbr, out

if __name__ == "__main__":
    with cf.ThreadPoolExecutor(8) as ex:
        res = dict(ex.map(team_players, TEAMS))
    teams = {k: v for k, v in res.items() if v}
    print(json.dumps({"updatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"), "teams": teams}, separators=(",", ":")))
    print(f"teams with data: {len(teams)}", file=sys.stderr)
