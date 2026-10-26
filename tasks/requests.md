# Member update requests (hourly)

Follow tasks/common.md for data access. Also load the Claude Code Remote fire_trigger tool (ToolSearch "fire_trigger"). Do nothing else.

1. list requests. Each doc is {kind "update"|"team", abbr, status "pending"|"done", by, at}. If none is "pending", stop and end with exactly "No update requests."
2. requests/update when pending: get hub/meta. If hub/meta.updatedAt is later than the request's "at", just mark it done. Otherwise fire_trigger trigger_id "trig_01QhAg2Td7zqN1x1udWmFfKx" with text "Manual update requested by a site member. Do a full refresh now, including the depth chart." then mark it done.
3. Each pending requests/team-<abbr>: get teams/<abbr lowercase> (may not exist). If its meta.updatedAt is later than the request's "at", mark it done. Otherwise fire_trigger trigger_id "trig_01QhAg2Td7zqN1x1udWmFfKx" with text "TEAM RUN: <ABBR uppercase>", then mark it done. At most 3 team runs per run; leave others pending.
4. "Mark done" = update that doc with {"status":"done","handledAt":"<now ISO>"}.

End with one short line like "Started 1 hub update and 1 team run." Never write anything notification-worthy.
