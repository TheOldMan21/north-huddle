# Data access for North Huddle scheduled tasks

North Huddle (https://north-huddle.pages.dev) is the user's unofficial Minnesota football fan site. Its data lives in Supabase.
Never use the ArtifactData or Artifact tools (the old Claude artifact hub is retired). Never edit or push the repo from a scheduled task.

Setup (once per run):
    git clone --depth 1 https://github.com/TheOldMan21/north-huddle /tmp/nh 2>/dev/null || git -C /tmp/nh pull -q
    date -u          # the real current time; use it for every timestamp and never write a time in the future

`NH_BOT_PW` is given in the task prompt; export it before using the tool:

    python3 /tmp/nh/scripts/nh.py get <collection>/<doc_id>
    python3 /tmp/nh/scripts/nh.py list <collection> [--where field=value]   -> [{id, data}, ...]
    python3 /tmp/nh/scripts/nh.py set <collection>/<doc_id> @file.json      (replace whole doc)
    python3 /tmp/nh/scripts/nh.py update <collection>/<doc_id> @file.json   (deep-merge nested objects; arrays replace; doc must exist)
    python3 /tmp/nh/scripts/nh.py delete <collection>/<doc_id>
    python3 /tmp/nh/scripts/nh.py batch @ops.json    ops = [{"op":"set|update|delete","path":"<collection>/<doc_id>","data":{...}}, ...]

Write JSON to local files and pass `@file`. Documents are plain JSON objects (no version wrappers, no if_version). To remove a field, `set` the whole document without it.
Collections owned by site users — never write them: leagues, chat, profiles, scores, data/… (requests only as the request task says).
