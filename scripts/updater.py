#!/usr/bin/env python3
"""North Huddle free auto-updater (runs in GitHub Actions; no Claude usage).

Keeps the Minnesota hub current from ESPN (+ vikings.com news, YouTube interviews):
  games/wNN, hub/meta, standings/<abbr>, players/<slug>, depth/<pos>, injuries/<slug>,
  news/<slug>, videos/<slug>, pstats/<id> (tracked players), fweeks/wNN, fstats/wNN,
  pending requests, and sys/status (what ran, when, what changed — shown on the admin System tab).

Short summaries (news, injury notes) are written by a small AI model through GitHub Models
(free with the workflow's GITHUB_TOKEN). Without it, summaries are left blank.

  NH_BOT_PW=... python3 scripts/updater.py            # run and write
  NH_BOT_PW=... python3 scripts/updater.py --dry      # show what would change, write nothing
  ... --only games,news                               # run some parts only
"""
import json, os, re, sys, time, html, hashlib, datetime as dt, urllib.request, urllib.parse, urllib.error, concurrent.futures as cf
import xml.etree.ElementTree as ET
sys.path.insert(0, os.path.dirname(__file__))
import nh  # noqa: E402

A = "https://site.api.espn.com/apis/site/v2/sports/football/nfl"
C = "https://sports.core.api.espn.com/v2/sports/football/leagues/nfl"
SEASON, TEAM, TID = 2026, "MIN", "16"
FIX = {"WAS": "WSH", "LA": "LAR"}
DIV = ["MIN", "GB", "DET", "CHI"]
UA = {"user-agent": "Mozilla/5.0 (NorthHuddle updater)"}
YT_CHANNEL = "UCM7-22N3kT7T0IFUlhoHKIQ"     # Minnesota Vikings
DRY = "--dry" in sys.argv
ONLY = set(sys.argv[sys.argv.index("--only") + 1].split(",")) if "--only" in sys.argv else None
NOW = dt.datetime.now(dt.timezone.utc)
ISO = NOW.strftime("%Y-%m-%dT%H:%M:%SZ")
CT = dt.timezone(dt.timedelta(hours=-6))   # Central (standard time is fine for labels)
LOG, CHANGES, ERRORS = [], [], []

def log(*a): s = " ".join(str(x) for x in a); LOG.append(s); print(s, flush=True)
def ab(x): x = str(x or "").upper(); return FIX.get(x, x)
def slug(s): return re.sub(r"^-|-$", "", re.sub(r"[^a-z0-9]+", "-", (s or "").lower()))
def nmz(s): return re.sub(r"[^a-z]", "", re.sub(r"\b(jr|sr|ii|iii|iv)\b\.?", "", str(s or "").lower()))
def want(part): return ONLY is None or part in ONLY
def clean(n): return re.sub(r"\s+(Jr\.?|Sr\.?|II|III|IV|V)$", "", (n or "").strip())
NICK = {"joshua": "josh", "joseph": "joe", "michael": "mike", "christopher": "chris", "william": "will", "matthew": "matt", "nicholas": "nick", "daniel": "dan", "anthony": "tony", "robert": "rob", "jonathan": "jon"}
def match_old(name, old):
    """Find an existing doc id for this player even when ESPN spells the name a bit differently."""
    n = clean(name); sid = slug(n)
    if sid in old: return sid
    first, last = (n.split(" ", 1) + [""])[:2]; f = NICK.get(first.lower(), first.lower())
    for k, v in old.items():
        on = clean(v.get("name") or v.get("player") or ""); of, ol = (on.split(" ", 1) + [""])[:2]
        if nmz(ol) == nmz(last) and (NICK.get(of.lower(), of.lower()) == f or of[:1].lower() == first[:1].lower() and len(of) <= 3): return k
    return sid

def get(u, as_text=False, tries=3):
    u = u.replace("http://", "https://")
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=40) as f:
                b = f.read()
                return b.decode("utf-8", "replace") if as_text else json.loads(b)
        except Exception as e:
            if i == tries - 1: log("  fetch failed:", u[:120], e); return None
            time.sleep(1.5 * (i + 1))

def pget(urls, n=10):
    with cf.ThreadPoolExecutor(n) as ex: return list(ex.map(get, urls))

# ---------------- writes (only when something actually changed) ----------------
OPS = []
def same(a, b): return json.dumps(a, sort_keys=True) == json.dumps(b, sort_keys=True)
def put(path, data, old=None, why=""):
    if old is not None and same(old, data): return False
    OPS.append(("set", path, data)); CHANGES.append(f"{path}{' — ' + why if why else ''}"); return True
def drop(path, why=""):
    OPS.append(("delete", path, None)); CHANGES.append(f"deleted {path}{' — ' + why if why else ''}")
def flush():
    if DRY:
        log(f"[dry] {len(OPS)} writes:"); [log("   ", o[0], o[1]) for o in OPS]; return
    sets = [(p, d) for op, p, d in OPS if op == "set"]
    if sets: nh.set_many(sets)
    for op, p, _ in OPS:
        if op == "delete": nh.delete(p)
    log(f"wrote {len(sets)} docs, deleted {sum(1 for o in OPS if o[0] == 'delete')}")

def coll(name): return {x["id"]: x["data"] for x in nh.lst(name)}

# ---------------- small AI helper (GitHub Models, free in Actions) ----------------
AI_USED = 0
def ai(prompt, max_tokens=120):
    global AI_USED
    tok = os.environ.get("GITHUB_TOKEN")
    if not tok or AI_USED >= 40: return ""
    body = {"model": os.environ.get("NH_AI_MODEL", "openai/gpt-4o-mini"), "max_tokens": max_tokens, "temperature": 0.4,
            "messages": [{"role": "system", "content": "You write short, accurate, neutral sentences for a football fan site. Never invent facts. Never copy phrases from the source; use your own words. No quotes, no emojis."},
                         {"role": "user", "content": prompt}]}
    try:
        r = urllib.request.Request("https://models.github.ai/inference/chat/completions", data=json.dumps(body).encode(),
                                   headers={"authorization": "Bearer " + tok, "content-type": "application/json", "accept": "application/json"})
        with urllib.request.urlopen(r, timeout=40) as f: raw = f.read().decode("utf-8", "replace"); code = f.status
        try: out = json.loads(raw)
        except Exception: log(f"  ai unavailable: HTTP {code}, not JSON: {raw[:200]!r}"); AI_USED = 99; return ""
        AI_USED += 1
        return re.sub(r"\s+", " ", out["choices"][0]["message"]["content"]).strip().strip('"')
    except urllib.error.HTTPError as e:
        log(f"  ai unavailable: HTTP {e.code}: {e.read().decode('utf-8', 'replace')[:300]}"); AI_USED = 99; return ""
    except Exception as e:
        log("  ai unavailable:", repr(e)); AI_USED = 99; return ""

# ======================================================================================
def roster():
    d = get(f"{A}/teams/{TEAM.lower()}/roster") or {}
    R = {}
    for g in d.get("athletes", []):
        unit = {"offense": "offense", "defense": "defense", "specialTeam": "special"}.get(g.get("position"), "")
        for a in g.get("items", []):
            inj = (a.get("injuries") or [{}])[0].get("status", "")
            if g.get("position") == "injuredReserveOrOut" and not inj: inj = "Injured reserve"
            R[str(a["id"])] = {"name": clean(a.get("displayName")), "pos": (a.get("position") or {}).get("abbreviation", ""), "unit": unit,
                               "status": inj, "jersey": int(a["jersey"]) if str(a.get("jersey", "")).isdigit() else None}
    return R

def schedule():
    d = get(f"{A}/teams/{TEAM.lower()}/schedule?season={SEASON}&seasontype=2") or {}
    out = []
    for e in d.get("events", []):
        c = (e.get("competitions") or [{}])[0]
        me = next((x for x in c.get("competitors", []) if str(x.get("team", {}).get("id")) == TID), None)
        op = next((x for x in c.get("competitors", []) if str(x.get("team", {}).get("id")) != TID), None)
        if not me or not op: continue
        st = (c.get("status") or {}).get("type") or {}
        sc = lambda x: (x.get("score") or {}).get("value") if isinstance(x.get("score"), dict) else (float(x["score"]) if x.get("score") not in (None, "") else None)
        out.append({"espnId": e["id"], "week": e.get("week", {}).get("number"), "date": e.get("date"), "state": st.get("state", "pre"), "detail": st.get("shortDetail", ""),
                    "opp": op["team"].get("displayName", ""), "oppAbbr": ab(op["team"].get("abbreviation")), "home": me.get("homeAway") == "home",
                    "venue": (c.get("venue") or {}).get("fullName", ""), "tv": ", ".join(b.get("media", {}).get("shortName", "") for b in c.get("broadcasts", []) if b.get("media")),
                    "us": sc(me), "them": sc(op), "win": me.get("winner"), "loss": op.get("winner")})
    return out, d.get("byeWeek")

# ---------------- box scores -> per-game player lines ----------------
def box_lines(summary):
    """{athlete id: {pass:{...}, rush:{...}, rec:{...}, def:{...}, kick:{...}}} for Minnesota in one game."""
    P = {}
    for t in (summary.get("boxscore") or {}).get("players", []):
        if ab(t.get("team", {}).get("abbreviation")) != TEAM: continue
        for cat in t.get("statistics", []):
            keys = cat.get("keys") or []
            for a in cat.get("athletes", []):
                aid = str(a.get("athlete", {}).get("id")); s = dict(zip(keys, a.get("stats") or []))
                p = P.setdefault(aid, {"name": a.get("athlete", {}).get("displayName")})
                n = lambda k: float(str(s.get(k, "0")).replace("--", "0") or 0)
                nm = cat.get("name")
                if nm == "passing":
                    c_, at = (s.get("completions/passingAttempts", "0/0").split("/") + ["0"])[:2]
                    p["pass"] = {"cmp": int(c_ or 0), "att": int(at or 0), "yds": int(n("passingYards")), "td": int(n("passingTouchdowns")), "int": int(n("interceptions"))}
                elif nm == "rushing": p["rush"] = {"att": int(n("rushingAttempts")), "yds": int(n("rushingYards")), "td": int(n("rushingTouchdowns"))}
                elif nm == "receiving": p["rec"] = {"rec": int(n("receptions")), "tgt": int(n("receivingTargets")), "yds": int(n("receivingYards")), "td": int(n("receivingTouchdowns"))}
                elif nm == "defensive": p.setdefault("def", {}).update(tkl=int(n("totalTackles")), sacks=n("sacks"))
                elif nm == "interceptions": p.setdefault("def", {})["int"] = int(n("interceptions"))
                elif nm == "fumbles": p.setdefault("def", {})["fr"] = int(n("fumblesRecovered"))
                elif nm == "kicking":
                    fm, fa = (s.get("fieldGoalsMade/fieldGoalAttempts", "0/0").split("/") + ["0"])[:2]
                    xm, xa = (s.get("extraPointsMade/extraPointAttempts", "0/0").split("/") + ["0"])[:2]
                    p["kick"] = {"fgm": int(fm or 0), "fga": int(fa or 0), "xpm": int(xm or 0), "xpa": int(xa or 0)}
    return P

def line_for(g):
    parts = []
    if g.get("pass") and g["pass"]["att"]: x = g["pass"]; parts.append(f"{x['cmp']}/{x['att']}, {x['yds']} yds" + (f", {x['td']} TD" if x["td"] else "") + (f", {x['int']} INT" if x["int"] else ""))
    if g.get("rush") and g["rush"]["att"]: x = g["rush"]; parts.append(f"{x['att']} rush, {x['yds']} yds" + (f", {x['td']} TD" if x["td"] else ""))
    if g.get("rec") and (g["rec"]["rec"] or g["rec"]["tgt"]): x = g["rec"]; parts.append(f"{x['rec']} rec, {x['yds']} yds" + (f", {x['td']} TD" if x["td"] else ""))
    d = g.get("def") or {}
    dp = [f"{d['tkl']} tkl"] if d.get("tkl") else []
    if d.get("sacks"): dp.append(f"{d['sacks']:g} sack" + ("s" if d["sacks"] > 1 else ""))
    if d.get("int"): dp.append(f"{d['int']} INT")
    if d.get("fr"): dp.append(f"{d['fr']} FR")
    if dp: parts.append(", ".join(dp))
    if g.get("kick") and (g["kick"]["fga"] or g["kick"]["xpa"]): x = g["kick"]; parts.append(f"{x['fgm']}/{x['fga']} FG, {x['xpm']}/{x['xpa']} XP")
    return " · ".join(parts)

def merge_log(old, new):
    wk = lambda e: int(re.sub(r"\D", "", e.get("wk", "0")) or 0)
    have = {e["wk"]: e for e in (old or [])}; have.update({e["wk"]: e for e in new})
    return sorted(have.values(), key=wk, reverse=True)[:6]

def passer_rating(c, a, y, t, i):
    if not a: return None
    f = lambda v: max(0, min(2.375, v))
    return round((f((c / a - 0.3) * 5) + f((y / a - 3) * 0.25) + f(t / a * 20) + f(2.375 - i / a * 25)) / 6 * 100, 1)

# ======================================================================================
def run_hub():
    R = roster(); sched, bye = schedule()
    if not sched: ERRORS.append("ESPN schedule unavailable"); return
    old_games, old_meta = coll("games"), nh.get("hub/meta") or {}
    finals = [g for g in sched if g["state"] in ("post", "in")]
    sums = dict(zip([g["espnId"] for g in finals], pget([f"{A}/summary?event={g['espnId']}" for g in finals], 6)))

    # ---- games/wNN ----
    for g in sched:
        wid = f"w{g['week']:02d}"; old = old_games.get(wid, {}); s = sums.get(g["espnId"]) or {}
        kick = g["date"] and dt.datetime.fromisoformat(g["date"].replace("Z", "+00:00"))
        doc = {**old, "week": g["week"], "opp": g["opp"], "oppAbbr": g["oppAbbr"], "home": g["home"], "venue": old.get("venue") or g["venue"],
               "tv": old.get("tv") or g["tv"], "kickoff": kick.strftime("%Y-%m-%dT%H:%M:%SZ") if kick else old.get("kickoff"),
               "date": kick.astimezone(CT).strftime("%Y-%m-%d") if kick else old.get("date", ""),
               "status": {"post": "final", "in": "live"}.get(g["state"], "scheduled")}
        for k in ("us", "them", "result"): doc.pop(k, None) if g["state"] == "pre" else None
        if g["state"] != "pre":
            doc["us"], doc["them"] = int(g["us"] or 0), int(g["them"] or 0)
            if g["state"] == "post": doc["result"] = "W" if g["win"] else "L" if g["loss"] else "T"
            plays = []
            for p in reversed(s.get("scoringPlays") or []):
                plays.append(f"Q{p.get('period', {}).get('number')} {p.get('clock', {}).get('displayValue', '')} {ab(p.get('team', {}).get('abbreviation'))} — {re.sub(r'\s+', ' ', p.get('text', '')).strip()}")
            if plays and (g["state"] == "in" or old.get("status") != "final" or not old.get("plays")): doc["plays"] = plays[:12]
            if g["state"] == "in": doc["note"] = g["detail"]
            elif not old.get("note") or old.get("status") != "final":
                lead = []
                for cat in (s.get("leaders") or []):
                    if ab(cat.get("team", {}).get("abbreviation")) != TEAM: continue
                    for L in cat.get("leaders", [])[:3]:
                        top = (L.get("leaders") or [{}])[0]
                        if top: lead.append(f"{top.get('athlete', {}).get('shortName', '')} {top.get('displayValue', '')}".strip())
                doc["note"] = " · ".join(lead[:3])
        put(f"games/{wid}", doc, old)
    if bye:
        wid = f"w{int(bye):02d}"; old = old_games.get(wid, {})
        put(f"games/{wid}", {**old, "week": int(bye), "status": "bye", "opp": old.get("opp", "Bye"), "oppAbbr": old.get("oppAbbr", "")}, old)

    # ---- standings ----
    sd = get("https://site.api.espn.com/apis/v2/sports/football/nfl/standings?level=3") or {}
    old_st, rows = coll("standings"), {}
    for conf in sd.get("children", []):
        for div in conf.get("children", []):
            for e in (div.get("standings") or {}).get("entries", []):
                s = {x.get("name") or x.get("type"): x for x in e.get("stats", [])}
                num = lambda k: int(float(s[k].get("value", 0))) if k in s else 0
                rows[ab(e["team"]["abbreviation"])] = {"team": e["team"]["displayName"], "abbr": ab(e["team"]["abbreviation"]), "w": num("wins"), "l": num("losses"), "t": num("ties"), "pf": num("pointsFor"), "pa": num("pointsAgainst"),
                                                     "seed": num("playoffSeed") or None}
    for a in DIV:
        if a in rows:
            r = {k: v for k, v in rows[a].items() if k != "seed"}; put(f"standings/{a.lower()}", {**old_st.get(a.lower(), {}), **r}, old_st.get(a.lower()))

    # ---- hub/meta ----
    fin = [g for g in sched if g["state"] == "post"]
    w = sum(1 for g in fin if g["win"]); l = sum(1 for g in fin if g["loss"]); t = len(fin) - w - l
    rec = lambda gs: f"{sum(1 for g in gs if g['win'])}-{sum(1 for g in gs if g['loss'])}" + (f"-{sum(1 for g in gs if not g['win'] and not g['loss'])}" if any(not g['win'] and not g['loss'] for g in gs) else "")
    streak, last = 0, None
    for g in reversed(fin):
        r = "W" if g["win"] else "L" if g["loss"] else "T"
        if last in (None, r): last = r; streak += 1
        else: break
    div = sorted([rows[a] for a in DIV if a in rows], key=lambda r: (-(r["w"] + r["t"] / 2) / max(1, r["w"] + r["l"] + r["t"]), r.get("seed") or 99))
    place = next((i for i, r in enumerate(div) if r["abbr"] == TEAM), None)
    meta = {**old_meta, "season": SEASON, "record": f"{w}-{l}" + (f"-{t}" if t else ""), "recordHome": rec([g for g in fin if g["home"]]), "recordAway": rec([g for g in fin if not g["home"]]),
            "streak": f"{last}{streak}" if last else "", "pf": int(sum(g["us"] or 0 for g in fin)), "pa": int(sum(g["them"] or 0 for g in fin)),
            "statsAsOf": f"Week {fin[-1]['week']}" if fin else old_meta.get("statsAsOf", "")}
    if place is not None: meta["divisionRank"] = f"{['1st', '2nd', '3rd', '4th'][place]} in NFC North"
    if div:
        lead = div[0]; tied = [r for r in div if (r["w"], r["l"]) == (lead["w"], lead["l"])]
        meta["standingsNote"] = (f"{' and '.join(r['team'].split()[-1] for r in tied)} share the NFC North lead at {lead['w']}-{lead['l']}." if len(tied) > 1
                                 else f"The {lead['team'].split()[-1]} lead the NFC North at {lead['w']}-{lead['l']}.") + " " + \
                                ", ".join(f"{r['team'].split()[-1]} {r['w']}-{r['l']}" for r in div if r not in tied) + ("." if len(div) > len(tied) else "")
        meta["standingsNote"] = meta["standingsNote"].strip()
    # alert: a fresh final, or ESPN's top team headline when newer than ours
    just = [g for g in fin if old_games.get(f"w{g['week']:02d}", {}).get("status") != "final"]
    if just:
        g = just[-1]; res = "beat" if g["win"] else "lost to" if g["loss"] else "tied"
        meta["alert"] = f"FINAL: Vikings {res} the {g['opp'].split()[-1]} {int(g['us'])}-{int(g['them'])} and are {meta['record']}."; meta["alertAt"] = ISO
    else:
        nd = get(f"{A}/news?team={TID}&limit=20") or {}
        top = next((a for a in nd.get("articles", []) if a.get("type") == "HeadlineNews"), None)
        if top and top.get("published") and (not old_meta.get("alertAt") or top["published"] > old_meta["alertAt"]):
            meta["alert"] = top["headline"]; meta["alertAt"] = top["published"]
    meta["depthAsOf"] = NOW.astimezone(CT).strftime("%b %-d, %Y")
    changed_meta = not same({k: v for k, v in meta.items() if k not in ("updatedAt", "depthAsOf")}, {k: v for k, v in old_meta.items() if k not in ("updatedAt", "depthAsOf")})

    # ---- players ----
    old_pl = coll("players")
    games_by = [(g, box_lines(sums.get(g["espnId"]) or {})) for g in fin]
    tot, logs, ids = {}, {}, {}
    for g, B in games_by:
        opp = f"{'vs' if g['home'] else '@'} {g['oppAbbr']} · {'W' if g['win'] else 'L' if g['loss'] else 'T'} {int(g['us'])}-{int(g['them'])}"
        for aid0, s in B.items():
            aid = nmz(clean(s["name"])) or aid0; ids.setdefault(aid, aid0)   # one player can show up under two ESPN ids
            T = tot.setdefault(aid, {"name": s["name"]})
            for grp in ("pass", "rush", "rec", "def", "kick"):
                for k, v in (s.get(grp) or {}).items(): T.setdefault(grp, {})[k] = round(T.get(grp, {}).get(k, 0) + v, 1)
            ln = line_for(s)
            if ln: logs.setdefault(aid, []).append({"wk": f"Wk {g['week']}", "opp": opp, "line": ln})
    # spellings that land on the same existing player (e.g. "Jacob"/"Jakobe" Thomas) are one person
    grouped = {}
    for aid, T in list(tot.items()):
        sid = match_old(T["name"], old_pl); g = grouped.get(sid)
        if not g: grouped[sid] = aid; continue
        G0 = tot[g]
        for grp in ("pass", "rush", "rec", "def", "kick"):
            for k, v in (T.get(grp) or {}).items(): G0.setdefault(grp, {})[k] = round(G0.get(grp, {}).get(k, 0) + v, 1)
        logs[g] = logs.get(g, []) + logs.get(aid, []); del tot[aid]
    cand = []
    for aid, T in tot.items():
        r = R.get(ids.get(aid)) or next((x for x in R.values() if nmz(x["name"]) == aid), {})
        st = {k: dict(v) for k, v in T.items() if k in ("pass", "rush", "rec", "def", "kick")}
        if "pass" in st: st["pass"]["rate"] = passer_rating(st["pass"]["cmp"], st["pass"]["att"], st["pass"]["yds"], st["pass"]["td"], st["pass"]["int"])
        if "def" in st:
            st["def"] = {"tkl": 0, "sacks": 0, "int": 0, "ff": 0, **st["def"]}; st["def"].pop("fr", None)
            st["def"]["sacks"] = float(st["def"]["sacks"]); st["def"]["sacks"] = int(st["def"]["sacks"]) if st["def"]["sacks"].is_integer() else st["def"]["sacks"]
        G = lambda grp, k: (st.get(grp) or {}).get(k) or 0
        rank = int(G("pass", "yds") + G("rush", "yds") + G("rec", "yds") + 5 * G("def", "tkl") + 20 * G("def", "sacks"))
        cand.append((rank, aid, T["name"], r, st))
    cand.sort(key=lambda x: -x[0])
    keep_ids = set()
    for i, (rank, aid, name, r, st) in enumerate(cand):
        name = clean(name); sid = match_old(name, old_pl); old = old_pl.get(sid)
        if old: name = old.get("name") or name
        if "def" in st and not (st["def"].get("tkl") or st["def"].get("sacks") or st["def"].get("int")) or ("def" in st and (r.get("unit") or (old or {}).get("unit")) in ("offense", "special") and st["def"].get("tkl", 0) < 3): st.pop("def")
        if not old and i >= 40 and r.get("pos") not in ("QB", "PK", "K"): continue
        keep_ids.add(sid)
        merged = json.loads(json.dumps((old or {}).get("stats") or {}))
        for grp, vals in st.items():
            M = merged.setdefault(grp, {})
            fuller = grp == "pass" and (M.get("att") or 0) > (vals.get("att") or 0)   # old totals include games for another team
            for k, v in vals.items():
                if k == "rate" and fuller: continue
                if k == "rate" or not isinstance(M.get(k), (int, float)) or (isinstance(v, (int, float)) and v >= M[k]): M[k] = v
        G = lambda grp, k: (merged.get(grp) or {}).get(k) or 0
        doc = {**(old or {}), "name": name, "pos": (r.get("pos") or (old or {}).get("pos") or ""), "unit": r.get("unit") or (old or {}).get("unit") or "offense",
               "status": r.get("status") or (old or {}).get("status") or "", "stats": merged, "log": merge_log((old or {}).get("log"), list(reversed(logs.get(aid, [])))),
               "rank": int(G("pass", "yds") + G("rush", "yds") + G("rec", "yds") + 5 * G("def", "tkl") + 20 * G("def", "sacks"))}
        if doc["pos"] == "PK": doc["pos"] = "K"
        if doc["unit"] == "special" and doc["pos"] not in ("K", "P"): doc["unit"] = "defense" if "def" in merged else "offense"
        put(f"players/{sid}", doc, old)
    # status updates for listed players with no box score this year (injured all season, etc.)
    by_name = {nmz(r["name"]): r for r in R.values()}
    for sid, old in old_pl.items():
        if sid in keep_ids: continue
        r = by_name.get(nmz(old.get("name")))
        if r and (r.get("status") or "") != (old.get("status") or "") and not (r.get("status") in ("", None) and old.get("status") is None): put(f"players/{sid}", {**old, "status": r.get("status") or ""}, old)

    # ---- depth chart ----
    dc = get(f"{A}/teams/{TID}/depthcharts") or {}
    MAP = {"wr1": "LWR", "wr2": "RWR", "wr3": "SWR", "lt": "LT", "lg": "LG", "c": "C", "rg": "RG", "rt": "RT", "qb": "QB", "te": "TE", "rb": "RB", "fb": "FB",
           "lde": "LDE", "nt": "NT", "rde": "RDE", "wlb": "LOLB", "lilb": "WLB", "rilb": "MLB", "slb": "ROLB", "lcb": "LCB", "ss": "SS", "fs": "FS", "rcb": "RCB", "nb": "NB",
           "pk": "PK", "p": "PT", "h": "H", "pr": "PR", "kr": "KR", "ls": "LS"}
    old_dp = coll("depth"); seen = set()
    for chart in dc.get("depthchart", []):
        for k, v in (chart.get("positions") or {}).items():
            pos = MAP.get(k)
            if not pos or pos in seen: continue
            names, nums = [], []
            for a in v.get("athletes", []):
                m = re.search(r"athletes/(\d+)", (a.get("athlete") or {}).get("$ref", "")) or re.search(r"(\d+)", str((a.get("athlete") or {}).get("id", "")))
                r = R.get(m.group(1)) if m else None
                if r and r["name"] not in names: names.append(r["name"]); nums.append(r["jersey"])
            if not names: continue
            seen.add(pos); did = pos.lower(); old = old_dp.get(did) or {}
            unit = "special" if pos in ("PK", "PT", "H", "PR", "KR", "LS") else "defense" if pos in ("LDE", "NT", "RDE", "LOLB", "WLB", "MLB", "ROLB", "LCB", "SS", "FS", "RCB", "NB") else "offense"
            put(f"depth/{did}", {**old, "unit": unit, "pos": pos, "order": old.get("order", 99), "players": names[:4], "numbers": nums[:4]}, old)
    if "PK" in seen and "ko" in old_dp:   # kickoff specialist follows the kicker unless ESPN says otherwise
        k = next((o for p, o in [(op[1], op[2]) for op in OPS if op[1] == "depth/pk"]), None)
        if k: put("depth/ko", {**old_dp["ko"], "players": k["players"][:1], "numbers": k["numbers"][:1]}, old_dp["ko"])

    # ---- injuries ----
    inj = get(f"{C}/teams/{TID}/injuries?limit=100") or {}
    det = pget([i["$ref"] for i in inj.get("items", [])], 10)
    old_in, latest = coll("injuries"), {}
    for x in det:
        if not x: continue
        aid = (re.search(r"athletes/(\d+)", (x.get("athlete") or {}).get("$ref", "")) or [None, None])[1]
        if aid and (aid not in latest or (x.get("date") or "") > (latest[aid].get("date") or "")): latest[aid] = x
    live = set()
    for aid, x in latest.items():
        status = x.get("status") or ""; r = R.get(aid) or {}
        if not r or status in ("Active", ""): continue
        status = {"Injured Reserve": "Injured reserve", "Physically Unable to Perform": "PUP", "Day-To-Day": "Day-to-day"}.get(status, status)
        dd = x.get("details") or {}
        part = dd.get("type") or ""
        if dd.get("side") and dd["side"] not in ("Not Specified", ""): part = f"{dd['side']} {part.lower()}"
        sid = match_old(r["name"], old_in); live.add(sid); old = old_in.get(sid) or {}
        src = hashlib.md5((x.get("shortComment") or "").encode()).hexdigest()[:10]
        doc = {**old, "player": old.get("player") or r["name"], "pos": r.get("pos", ""), "status": status, "injury": part or old.get("injury", "")}
        if old.get("src") != src:
            note = ai(f"In one short sentence (max 25 words), say what this injury update means for the player, in your own words:\n{x.get('shortComment','')}\n{x.get('longComment','')[:400]}")
            if note: doc["note"] = note
            doc["src"] = src
        put(f"injuries/{sid}", doc, old)
    if latest:
        for sid in old_in:
            if sid not in live: drop(f"injuries/{sid}", "healthy again")

    stamp = {"meta": meta, "changed": changed_meta}
    return stamp

# ======================================================================================
def run_news():
    old = coll("news"); have = {nmz(v.get("headline")) for v in old.values()} | {v.get("url") for v in old.values()}
    items = []
    nd = get(f"{A}/news?team={TID}&limit=30") or {}
    for a in nd.get("articles", []):
        if a.get("type") not in ("HeadlineNews", "Story", "Recap", "Preview"): continue
        cats = a.get("categories") or []
        if not any(c.get("type") == "team" and str(c.get("teamId")) == TID for c in cats): continue
        if not re.search(r"vikings|minnesota", a.get("headline", "") + " " + a.get("description", ""), re.I): continue
        items.append({"headline": a.get("headline", ""), "desc": a.get("description", ""), "date": a.get("published", ISO), "source": "ESPN", "url": ((a.get("links") or {}).get("web") or {}).get("href", "")})
    rss = get("https://www.vikings.com/rss/news", as_text=True) or ""
    try:
        for it in ET.fromstring(rss.encode()).iter("item"):
            pub = it.findtext("pubDate") or ""
            try: d = dt.datetime.strptime(pub[:25].strip(), "%a, %d %b %Y %H:%M:%S").replace(tzinfo=dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
            except Exception: d = ISO
            items.append({"headline": html.unescape(it.findtext("title") or ""), "desc": re.sub(r"<[^>]+>", " ", html.unescape(it.findtext("description") or ""))[:500], "date": d, "source": "Vikings.com", "url": it.findtext("link") or ""})
    except Exception as e: log("  vikings.com rss:", e)
    cutoff = (NOW - dt.timedelta(days=21)).strftime("%Y-%m-%dT%H:%M:%SZ")
    added = 0
    for it in sorted(items, key=lambda x: x["date"], reverse=True):
        if not it["headline"] or not it["url"] or it["date"] < cutoff or nmz(it["headline"]) in have or it["url"] in have or added >= 12: continue
        sid = slug(it["headline"])[:60].strip("-")
        if sid in old: continue
        summ = ai(f"Write ONE sentence (max 30 words) summarizing this Minnesota Vikings story for fans, in your own words.\nHeadline: {it['headline']}\nDetails: {it['desc']}")
        put(f"news/{sid}", {"headline": it["headline"], "summary": summ, "date": it["date"], "source": it["source"], "url": it["url"]}, None, "new story")
        have.add(nmz(it["headline"])); added += 1
    recent = (NOW - dt.timedelta(days=4)).strftime("%Y-%m-%dT%H:%M:%SZ")
    for sid, v in sorted(old.items(), key=lambda kv: kv[1].get("date", ""), reverse=True)[:30]:
        if v.get("summary") or (v.get("date") or "") < recent or AI_USED >= 40: continue
        summ = ai(f"Write ONE sentence (max 30 words) summarizing this Minnesota Vikings story for fans, in your own words.\nHeadline: {v.get('headline','')}")
        if summ: put(f"news/{sid}", {**v, "summary": summ}, v, "summary added")
    for sid, v in old.items():
        if (v.get("date") or "") < cutoff: drop(f"news/{sid}", "older than 21 days")

def run_videos():
    feed = get(f"https://www.youtube.com/feeds/videos.xml?channel_id={YT_CHANNEL}", as_text=True)
    if not feed: return
    ns = {"a": "http://www.w3.org/2005/Atom", "m": "http://search.yahoo.com/mrss/"}
    old = coll("videos"); urls = {v.get("url") for v in old.values()}
    try: root = ET.fromstring(feed.encode())
    except Exception as e: log("  youtube feed:", e); return
    added = 0
    for e in root.findall("a:entry", ns):
        title = e.findtext("a:title", "", ns); link = (e.find("a:link", ns).get("href") if e.find("a:link", ns) is not None else "")
        pub = e.findtext("a:published", "", ns)[:19] + "Z"
        if not re.search(r"press conference|postgame|media|availability|interview|speaks|locker room|presser|on the|talks", title, re.I): continue
        if link in urls or added >= 6: continue
        who = re.split(r"\s+(?:on|talks|speaks|discusses|after|says|recaps|previews|:|\|)\s+", title, 1, flags=re.I)[0].strip()[:40]
        coach = re.search(r"o'connell|flores|coach|adofo|brzezinski", title, re.I)
        put(f"videos/{slug(title)[:50]}", {"who": who, "role": "Coach" if coach else "", "title": re.sub(r"\s*\|\s*Minnesota Vikings.*$", "", title)[:100], "date": pub,
                                          "label": "Postgame" if re.search("postgame", title, re.I) else "Press conference", "source": "YouTube", "url": link}, None, "new video")
        added += 1
    vs = sorted(old.items(), key=lambda kv: kv[1].get("date", ""), reverse=True)
    cutoff = (NOW - dt.timedelta(days=21)).strftime("%Y-%m-%dT%H:%M:%SZ")
    for i, (vid, v) in enumerate(vs):
        if (v.get("date") or "") < cutoff or i >= 20 - added: drop(f"videos/{vid}", "old")

# ---------------- tracked players (other teams) ----------------
def run_tracked():
    tr, ps = coll("tracked"), coll("pstats")
    for tid_, t in tr.items():
        ros = get(f"{A}/teams/{t.get('abbr', '').lower()}/roster") or {}
        aid, info = None, None
        for g in ros.get("athletes", []):
            for a in g.get("items", []):
                if nmz(a.get("displayName")) == nmz(t.get("name")): aid, info = a["id"], a
        if not aid: continue
        ov = get(f"https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/athletes/{aid}/overview") or {}
        groups = []
        st = ov.get("statistics") or {}
        labels, names = st.get("labels") or [], st.get("names") or []
        for sp in (st.get("splits") or [])[:1]:
            vals = sp.get("stats") or []
            if vals: groups.append({"title": "Season", "stats": [{"l": l, "v": v} for l, v in list(zip(labels, vals))[:8]]})
        inj = (info.get("injuries") or [{}])[0]
        old = ps.get(tid_) or {}
        doc = {**old, "name": t.get("name"), "abbr": t.get("abbr"), "team": t.get("team"), "pos": t.get("pos"), "season": str(SEASON),
               "status": inj.get("status", "") if inj.get("status") != "Active" else "", "injury": ((inj.get("details") or {}).get("type") or "") if inj.get("status") not in (None, "Active") else ""}
        if groups: doc["groups"] = groups; doc["headline"] = " · ".join(f"{s['v']} {s['l']}" for s in groups[0]["stats"][:4])
        put(f"pstats/{tid_}", doc, old)
    for pid in ps:
        if pid not in tr: drop(f"pstats/{pid}", "no longer tracked")

# ---------------- fantasy league support (schedule + scoring) ----------------
def run_fantasy():
    fw = coll("fweeks"); leagues = [l for l in nh.lst("leagues") if (l["data"] or {}).get("status") == "season"]
    week = (nh.get("fantasy/week") or {}).get("week") or 1
    weeks = {}
    for wk in range(max(1, int(week) - 1), 19):
        wid = f"w{wk:02d}"
        if wid in fw and wk > int(week) + 1: continue
        d = get(f"{A}/scoreboard?seasontype=2&week={wk}&dates={SEASON}") or {}
        games = []
        for e in d.get("events", []):
            c = (e.get("competitions") or [{}])[0]; cs = c.get("competitors", [])
            h = next((x for x in cs if x.get("homeAway") == "home"), {}); a = next((x for x in cs if x.get("homeAway") == "away"), {})
            st = (c.get("status") or {}).get("type") or {}
            g = {"home": ab(h.get("team", {}).get("abbreviation")), "away": ab(a.get("team", {}).get("abbreviation")), "kickoff": e.get("date", "").replace(":00Z", ":00Z"), "espnId": e["id"]}
            if st.get("state") != "pre":
                g.update(hs=int(float(h.get("score") or 0)), **{"as": int(float(a.get("score") or 0))}, status="Final" if st.get("state") == "post" else st.get("shortDetail", ""), final=st.get("state") == "post")
            games.append(g)
        if games:
            old = fw.get(wid) or {}; doc = {**old, "week": wk, "games": games}
            if not same({k: v for k, v in doc.items() if k != "updatedAt"}, {k: v for k, v in old.items() if k != "updatedAt"}): doc["updatedAt"] = ISO; put(f"fweeks/{wid}", doc, old)
            weeks[wk] = games
    if not leagues: return
    # scoring for the current week from box scores (keys match the site's scoring code)
    started = [w for w, gs in weeks.items() if any(g.get("kickoff", "9") <= ISO for g in gs)]
    if not started: return
    W = max(started); gs = [g for g in weeks[W] if g.get("kickoff", "9") <= ISO]
    stats = {}
    for g, s in zip(gs, pget([f"{A}/summary?event={g['espnId']}" for g in gs], 6)):
        if not s: continue
        for t in (s.get("boxscore") or {}).get("players", []):
            ta = ab(t.get("team", {}).get("abbreviation"))
            for cat in t.get("statistics", []):
                keys = cat.get("keys") or []
                for a in cat.get("athletes", []):
                    nm = a.get("athlete", {}).get("displayName", ""); v = dict(zip(keys, a.get("stats") or []))
                    pid = f"{ta.lower()}-{slug(re.sub(r' (Jr|Sr|II|III|IV)\.?$', '', nm))}"; P = stats.setdefault(pid, {})
                    n = lambda k: float(str(v.get(k, "0")).replace("--", "0") or 0)
                    c = cat.get("name")
                    if c == "passing": P.update(pass_yd=n("passingYards"), pass_td=n("passingTouchdowns"), int=n("interceptions"))
                    elif c == "rushing": P.update(rush_yd=n("rushingYards"), rush_td=n("rushingTouchdowns"))
                    elif c == "receiving": P.update(rec=n("receptions"), rec_yd=n("receivingYards"), rec_td=n("receivingTouchdowns"))
                    elif c == "fumbles": P["fum"] = n("fumblesLost")
                    elif c == "kicking":
                        fm, fa = (v.get("fieldGoalsMade/fieldGoalAttempts", "0/0") + "/0").split("/")[:2]; xm, xa = (v.get("extraPointsMade/extraPointAttempts", "0/0") + "/0").split("/")[:2]
                        P.update(xp=int(xm or 0), xpmiss=int(xa or 0) - int(xm or 0), fg0_39=int(fm or 0), fgmiss=int(fa or 0) - int(fm or 0))
            D = stats.setdefault(f"def-{ta.lower()}", {})
            for cat in t.get("statistics", []):
                if cat.get("name") == "defensive": D["sack"] = sum(float(x.get("stats", [0, 0, 0])[2] or 0) for x in cat.get("athletes", []))
                if cat.get("name") == "interceptions": D["def_int"] = sum(float(x.get("stats", [0])[0] or 0) for x in cat.get("athletes", []))
        comp = (s.get("header") or {}).get("competitions", [{}])[0]
        for c in comp.get("competitors", []):
            other = next((o for o in comp.get("competitors", []) if o is not c), {})
            stats.setdefault(f"def-{ab(c['team']['abbreviation']).lower()}", {})["pa"] = int(float(other.get("score") or 0))
    stats = {k: {kk: (int(vv) if float(vv).is_integer() else vv) for kk, vv in v.items() if vv} for k, v in stats.items()}
    old = nh.get(f"fstats/w{W:02d}") or {}
    doc = {"week": W, "final": all(g.get("final") for g in weeks[W]) and NOW.astimezone(CT).weekday() == 1, "updatedAt": ISO, "players": {**(old.get("players") or {}), **stats}}
    put(f"fstats/w{W:02d}", doc, None, f"scored week {W}")

# ---------------- member requests: everything is automatic now, so just mark them handled ----------------
def run_requests():
    for r in nh.lst("requests"):
        d = r["data"] or {}
        if d.get("status") == "pending" and d.get("kind") in ("update", "team"):
            put(f"requests/{r['id']}", {**d, "status": "done", "handledAt": ISO, "by_updater": True}, d)

# ======================================================================================
if __name__ == "__main__":
    t0 = time.time(); parts = {}
    for name, fn in [("hub", run_hub), ("news", run_news), ("videos", run_videos), ("tracked", run_tracked), ("fantasy", run_fantasy), ("requests", run_requests)]:
        if not want(name): continue
        n0 = len(OPS)
        try:
            out = fn(); parts[name] = {"ok": True, "changes": len(OPS) - n0}
            if name == "hub" and out:
                if out["changed"] or len(OPS) > n0: out["meta"]["updatedAt"] = ISO
                put("hub/meta", out["meta"], nh.get("hub/meta"))
        except Exception as e:
            import traceback; traceback.print_exc(); ERRORS.append(f"{name}: {e}"); parts[name] = {"ok": False, "error": str(e)[:200]}
    status = {"at": ISO, "secs": round(time.time() - t0, 1), "parts": parts, "changes": CHANGES[:60], "changeCount": len(CHANGES), "errors": ERRORS[:10],
              "ai": AI_USED if AI_USED < 99 else "unavailable", "run": os.environ.get("GITHUB_RUN_ID", "local"), "trigger": os.environ.get("GITHUB_EVENT_NAME", "manual")}
    if not DRY:
        prev = nh.get("sys/status") or {}
        hist = ([{"at": ISO, "changes": len(CHANGES), "ok": not ERRORS, "secs": status["secs"]}] + (prev.get("history") or []))[:48]
        status["history"] = hist
        OPS.append(("set", "sys/status", status))
    flush()
    log(f"done in {status['secs']}s · {len(CHANGES)} changes · {len(ERRORS)} errors")
