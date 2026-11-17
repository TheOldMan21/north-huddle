# Data access for North Huddle scheduled tasks

North Huddle (https://north-huddle.pages.dev) is the user's unofficial Minnesota football fan site. Its data lives in Supabase.
Never use the ArtifactData or Artifact tools (the old Claude artifact hub is retired). Never edit or push the repo from a scheduled task.

Setup (once per run):
    git clone --depth 1 https://github.com/TheOldMan21/north-huddle /tmp/nh 2>/dev/null || git -C /tmp/nh pull -q
    date -u          # the real current time; use it for every timestamp and never write a time in the future

## Free updater check (do this FIRST, before anything else)
The site now updates itself for free from GitHub (scripts/updater.py writes sys/status after every run). Run:

    python3 /tmp/nh/scripts/nh.py get sys/status

If it returns a document whose "at" is within the last 90 minutes of the real time (`date -u`), the free updater is running. Then:
- Refresh task on a Tuesday (America/Chicago) that is NOT a TEAM RUN or TRACKER-ONLY RUN: do ONLY step F (the fantasy tab docs) from tasks/refresh.md, then end with exactly "No new Vikings updates."
- Every other task and run: stop immediately without writing anything, and end with exactly "No new Vikings updates."
Only if sys/status is missing or older than 90 minutes, continue with the task as written.

`NH_BOT_PW` is given in the task prompt; export it before using the tool:

    python3 /tmp/nh/scripts/nh.py get <collection>/<doc_id>
    python3 /tmp/nh/scripts/nh.py list <collection> [--where field=value]   -> [{id, data}, ...]
    python3 /tmp/nh/scripts/nh.py set <collection>/<doc_id> @file.json      (replace whole doc)
    python3 /tmp/nh/scripts/nh.py update <collection>/<doc_id> @file.json   (deep-merge nested objects; arrays replace; doc must exist)
    python3 /tmp/nh/scripts/nh.py delete <collection>/<doc_id>
    python3 /tmp/nh/scripts/nh.py batch @ops.json    ops = [{"op":"set|update|delete","path":"<collection>/<doc_id>","data":{...}}, ...]

Write JSON to local files and pass `@file`. Documents are plain JSON objects (no version wrappers, no if_version). To remove a field, `set` the whole document without it.
Collections owned by site users — never write them: leagues, chat, profiles, scores, data/… (requests only as the request task says).
