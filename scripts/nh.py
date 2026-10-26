#!/usr/bin/env python3
"""North Huddle data tool for scheduled updates (no packages needed).

Auth: set NH_BOT_PW (the update bot's password) in the environment.

  python3 nh.py get  <doc path>                  print one document's JSON
  python3 nh.py list <collection> [--where f=v]  print [{id, data}, ...]
  python3 nh.py set  <doc path> <json|@file>     replace a document
  python3 nh.py update <doc path> <json|@file>   deep-merge into a document (must exist)
  python3 nh.py delete <doc path>
  python3 nh.py batch <@file>                    file = [{"op":"set|update|delete","path":..., "data":{...}}, ...]

Paths look like "hub/meta", "players/jefferson", "leagues/ABC123", "teams/gb".
"""
import json, os, sys, urllib.request, urllib.parse, urllib.error

URL = "https://hoxcsdtbljhfappkshya.supabase.co"
KEY = "sb_publishable_KON7uG5HO_MW7fi2JVo9aw_-mpduqIe"
BOT = "huddlebot@northhuddle.app"
_tok = None

def _req(method, path, body=None, headers=None, auth=True):
    h = {"apikey": KEY, "content-type": "application/json"}
    if auth: h["authorization"] = "Bearer " + token()
    h.update(headers or {})
    data = None if body is None else json.dumps(body).encode()
    r = urllib.request.Request(URL + path, data=data, method=method, headers=h)
    try:
        with urllib.request.urlopen(r, timeout=60) as resp:
            t = resp.read().decode()
            return json.loads(t) if t.strip() else None
    except urllib.error.HTTPError as e:
        raise SystemExit(f"{method} {path} -> {e.code}: {e.read().decode()[:500]}")

def token():
    global _tok
    if _tok: return _tok
    pw = os.environ.get("NH_BOT_PW")
    if not pw: raise SystemExit("Set NH_BOT_PW")
    d = _req("POST", "/auth/v1/token?grant_type=password", {"email": BOT, "password": pw}, auth=False)
    _tok = d["access_token"]; return _tok

def norm(p): return "/".join(s for s in p.split("/") if s)
def q(v): return urllib.parse.quote(v, safe="")

def get(path):
    path = norm(path)
    r = _req("GET", f"/rest/v1/docs?select=data&path=eq.{q(path)}")
    return r[0]["data"] if r else None

def lst(col, where=None):
    col = norm(col); out = []; off = 0
    while True:
        extra = "".join(f"&data->>{q(k)}=eq.{q(v)}" for k, v in (where or {}).items())
        r = _req("GET", f"/rest/v1/docs?select=id,data&col=eq.{q(col)}&order=id{extra}&limit=1000&offset={off}")
        out += r
        if len(r) < 1000: return out
        off += 1000

def set_(path, data):
    path = norm(path); parts = path.split("/")
    _req("POST", "/rest/v1/docs?on_conflict=path", {"path": path, "col": "/".join(parts[:-1]), "id": parts[-1], "data": data},
         {"prefer": "resolution=merge-duplicates,return=minimal"})

def set_many(rows):
    body = []
    for path, data in rows:
        path = norm(path); parts = path.split("/")
        body.append({"path": path, "col": "/".join(parts[:-1]), "id": parts[-1], "data": data})
    for i in range(0, len(body), 200):
        _req("POST", "/rest/v1/docs?on_conflict=path", body[i:i+200], {"prefer": "resolution=merge-duplicates,return=minimal"})

def update(path, patch):
    _req("POST", "/rest/v1/rpc/doc_update", {"p_path": norm(path), "p_patch": patch})

def delete(path):
    _req("DELETE", f"/rest/v1/docs?path=eq.{q(norm(path))}", headers={"prefer": "return=minimal"})

def _load(arg):
    if arg.startswith("@"):
        with open(arg[1:]) as f: return json.load(f)
    return json.loads(arg)

if __name__ == "__main__":
    a = sys.argv[1:]
    if not a: print(__doc__); sys.exit(0)
    cmd = a[0]
    if cmd == "get": print(json.dumps(get(a[1]), indent=1))
    elif cmd == "list":
        w = {}
        if "--where" in a: k, v = a[a.index("--where") + 1].split("=", 1); w[k] = v
        print(json.dumps(lst(a[1], w), indent=1))
    elif cmd == "set": set_(a[1], _load(a[2])); print("ok")
    elif cmd == "update": update(a[1], _load(a[2])); print("ok")
    elif cmd == "delete": delete(a[1]); print("ok")
    elif cmd == "batch":
        ops = _load(a[1]); sets = [(o["path"], o["data"]) for o in ops if o["op"] == "set"]
        if sets: set_many(sets)
        for o in ops:
            if o["op"] == "update": update(o["path"], o["data"])
            elif o["op"] == "delete": delete(o["path"])
        print("ok", len(ops))
    else: print(__doc__); sys.exit(1)
