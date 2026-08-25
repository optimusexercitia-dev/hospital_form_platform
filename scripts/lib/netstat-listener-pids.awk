# netstat-listener-pids.awk — the PIDs of processes LISTENING on a TCP port, read from
# the output of Windows `netstat -ano` on stdin.
#
#   netstat -ano | awk -v port=3000 -f scripts/lib/netstat-listener-pids.awk
#
# WHY IT EXISTS (`free_port()` in scripts/e2e-prod-gate.sh). The previous selector was
#
#     netstat -ano | grep ":$PORT " | awk '{print $NF}'
#
# and `grep` cannot tell WHICH COLUMN it matched. A client socket connected TO the port
# carries that port in the **Foreign Address** column, so on a machine with live clients
# the selector returned CLIENT pids — which `taskkill //F` then killed. During a gate run
# those clients are Playwright workers. That is the 2026-08-25 batch-13 signature
# (`worker process exited unexpectedly` x53). ⚠ Mechanism demonstrated, firing UNOBSERVED:
# this is a teardown-phase hazard, not a diagnosed root cause of that batch.
#
# TWO THINGS THIS DELIBERATELY DOES NOT DO
#
#  1. **It does not `grep LISTENING`.** `netstat`'s State column is LOCALIZED (a pt-BR
#     Windows prints ESCUTANDO), so a literal match selects NOTHING on a localized host.
#     That fails OPEN in the worst possible direction: `free_port` would stop killing the
#     stale server, `start_server`'s `curl /login` probe would then succeed against that
#     stale server, and the batch would run — and could go GREEN — against a stale build.
#     The listening state is instead identified STRUCTURALLY: LISTENING is the only TCP
#     state whose Foreign endpoint is the wildcard (`0.0.0.0:0`, `[::]:0`, `*:*`), i.e.
#     whose foreign PORT is `0` or `*`. That holds in every locale.
#     (A second `grep LISTENING` would not be equivalent for the same reason `grep` was
#     wrong to begin with — it still cannot say which column carried the port.)
#
#  2. **It does not locate the pid by field number.** The State token is absent on UDP
#     rows and could in principle be multi-word in some locale, so every read is
#     positional from an end that cannot move: proto `$1`, local `$2`, foreign `$3`,
#     pid `$NF`. Never `$4`/`$5`.
#
# Output: one pid per line, de-duplicated, order of first appearance. Exit 2 if no port
# was supplied — never a silent empty result, which would read exactly like "nothing to
# kill". Tested against captured real `netstat -ano` output by
# scripts/test-netstat-listener-pids.sh.

BEGIN {
  port = port ""                       # force string comparison; ports are not arithmetic
  if (port == "") {
    print "netstat-listener-pids.awk: -v port=N is required" > "/dev/stderr"
    exit 2
  }
}

{ sub(/\r$/, "") }                     # netstat writes CRLF; do not rely on the reader

$1 != "TCP" { next }                   # UDP has no listening state and cannot block a bind
NF < 5      { next }                   # every `netstat -ano` TCP row carries a State column

{
  lp = $2; sub(/.*:/, "", lp)          # greedy — survives [::]:3000 and [::1]:3000
  fp = $3; sub(/.*:/, "", fp)

  if (lp != port)             next     # the port is ours only in the LOCAL column
  if (fp != "0" && fp != "*") next     # ...and only on a row that is actually listening

  pid = $NF
  if (pid !~ /^[0-9]+$/)      next     # a malformed row must never become a kill target
  if (pid + 0 == 0)           next     # pid 0 = orphaned TIME_WAIT rows, not a process

  if (!(pid in seen)) { seen[pid] = 1; print pid }
}
