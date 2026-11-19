#!/usr/bin/env python3
"""Nightly North Huddle backup (run by .github/workflows/backup.yml).

Saves every document in the `docs` table, plus the feedback / guests / banned tables, into one
gzipped JSON file. The repo is public, so the workflow encrypts the file (AES-256, key = NH_BOT_PW)
before keeping it as a 30-day workflow artifact. Nothing readable is ever stored in the open.

  NH_BOT_PW=... python3 scripts/backup.py out.json.gz          make a backup
  NH_BOT_PW=... python3 scripts/backup.py --restore in.json.gz [--only news,players] [--dry]

Decrypt a downloaded artifact first:
  openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:NH_BOT_PW -in nh-backup.json.gz.enc -out nh-backup.json.gz
"""
import gzip, json, os, sys, datetime as dt
sys.path.insert(0, os.path.dirname(__file__))
import nh

def page(path):
    out, off = [], 0
    while True:
        sep = "&" if "?" in path else "?"
        r = nh._req("GET", f"{path}{sep}limit=1000&offset={off}") or []
        out += r
        if len(r) < 1000: return out
        off += 1000

def backup(fn):
    data = {"at": dt.datetime.now(dt.timezone.utc).isoformat(), "docs": page("/rest/v1/docs?select=path,col,id,data,updated_at&order=path")}
    for t in ("feedback", "guests", "banned"):
        try: data[t] = page(f"/rest/v1/{t}?select=*")
        except SystemExit as e: print(f"  (skipped {t}: {str(e)[:120]})")
    with gzip.open(fn, "wt") as f: json.dump(data, f, separators=(",", ":"))
    cols = {}
    for d in data["docs"]: cols[d["col"]] = cols.get(d["col"], 0) + 1
    print(f"backed up {len(data['docs'])} docs in {len(cols)} collections · " + ", ".join(f"{t} {len(data.get(t, []))}" for t in ("feedback", "guests", "banned")))
    if len(data["docs"]) < 50: raise SystemExit("Suspiciously small backup — failing so it gets noticed.")

def restore(fn, only=None, dry=False):
    with gzip.open(fn, "rt") as f: data = json.load(f)
    rows = [d for d in data["docs"] if not only or d["col"].split("/")[0] in only]
    print(f"backup from {data['at']}: restoring {len(rows)} docs" + (" (dry run)" if dry else ""))
    if dry: return
    for i in range(0, len(rows), 200):
        nh._req("POST", "/rest/v1/docs?on_conflict=path", [{k: r[k] for k in ("path", "col", "id", "data")} for r in rows[i:i + 200]],
                headers={"prefer": "resolution=merge-duplicates,return=minimal"})
    print("done")

if __name__ == "__main__":
    a = sys.argv[1:]
    if a and a[0] == "--restore":
        only = set(a[a.index("--only") + 1].split(",")) if "--only" in a else None
        restore(a[1], only, "--dry" in a)
    else:
        backup(a[0] if a else "nh-backup.json.gz")
