# FUP-C2-TIER1-INFLIGHT-SENTINEL-ERASED-BY-ITS-OWN-RESTORE

**Filed:** 2026-09-04 (C2 Phase B2a — after a killed sweep stranded a live authorization gate)
**Owner:** backend
**Severity:** critical — both of this harness's crash-safety mechanisms fail for **its own mutation
shape**, so a killed run can leave an authorization door open **and leave no trace that it did**.
Realised, not hypothetical: it happened on 2026-09-04.

## What happened

A subset sweep of 18 enforcers, estimated at ~60 minutes, was launched under a 10-minute tool
timeout. The tool killed it mid-run. `public.cancel_event` was left with **both** anchored raises
rewritten to `null;` — baseline 2 → 0 — leaving its `HC044` custody gate open to any authenticated
caller who could read the event, for roughly four minutes.

⚠ **Scope: the local development database only.** No remote or production database was touched, and
the local stack had a single owner. The exposure is not the finding; **the silence is.**

Restored by `supabase db reset --local`, then re-verified against the catalog: `cancel_event` back
to 2 anchored raises, **all 171/171** worklist enforcers at their full baseline counts, 0 degenerate
non-SELECT policies.

## Finding 1 — `restore_inflight()` erases the sentinel even when the restore failed

`supabase/tests/mutation/c2-command-door-neutralizer.sh:88-93`, verbatim:

```sh
restore_inflight () {
  [ -s "$INFLIGHT" ] || return 0
  echo "    !! INFLIGHT mutation found — restoring $INFLIGHT" >&2
  psql_f "$INFLIGHT" >/dev/null 2>&1
  : > "$INFLIGHT"
}
```

The truncation is **unconditional**. It does not test `psql_f`'s exit status. When the harness is
killed, the restoring `psql` is killed in the same process group by the same signal — so the restore
does not happen, and the sentinel that would have told the *next* run to redo it is erased in the
same breath. `restore_inflight` is called at startup (`:96`) precisely to "replay anything a previous
killed run left behind"; that replay is disarmed by the very failure it exists to survive.

Observed directly in the file timestamps: `INFLIGHT.sql.body` still held `cancel_event`'s real
1194-byte body at 09:38, while `INFLIGHT.sql` was truncated to 0 bytes at 09:39.

⚠ The `trap` lines at `:94-95` cover `EXIT INT TERM HUP`. A `SIGKILL`, or a job-tree teardown that
kills the whole process group, runs no trap at all — so the traps are not a mitigation for this case.

## Finding 2 — the `DEGEN` preflight is structurally blind to this harness's own rewrite

`:101-106`, the preflight whose comment reads *"A degenerate body means a previous harness died
mid-mutation. Every verdict below would be measured against a tree that is already open."*

```
p.prosrc ~ '^\s*begin\s+return\s+(true|false)\s*;\s*end'
p.prosrc ~ '^\s*select\s+(true|false)\s*;?\s*\$'
p.prosrc ~ '^\s*begin\s+return\s*;\s*end'
```

All three match a **whole body** replaced by a constant — the shape the *boolean-gate* mutation
audits produce. The C2 neutralizer does not do that. It rewrites `raise … ;` → `null;` **inside** an
otherwise intact body, which matches none of the three. **So this harness's preflight cannot detect
this harness's own strand**, and the run after a kill would have proceeded and reported verdicts
measured against an open tree — the exact scenario the comment describes, with the detector unable
to see it.

⭐ Together the two findings compose into the worst case: the sentinel is erased **and** the
preflight cannot see the damage, so a killed run leaves an open door with no evidence in either
mechanism designed to catch it.

## Closes when

1. `restore_inflight` verifies the restore before clearing the sentinel — check `psql_f`'s exit
   status, and re-verify the function's body hash against `$INFLIGHT.body` — and leaves
   `$INFLIGHT` **intact** on any failure so the next run replays it.
2. The `DEGEN` preflight gains an arm that detects **this** harness's shape — for the C2 anchor, an
   enforcer in the derived worklist whose current anchored-raise count is **below** its recorded
   `nraise`. That is a per-run derivable property and needs no hand-list.
3. Both arms are proven able to fire: strand a function deliberately, confirm the preflight reds and
   the sentinel survives. ⛔ A detector that has never been shown to fire is exactly what this
   register keeps finding.

## Related

- `.claude/rules/mutation-harnesses-are-not-killable.md` — the standing rule that was broken. This
  entry is the evidence that **the rule alone is not a mitigation**: the harness's own recovery path
  is what failed, so "do not kill it" is the only line of defence, and a tool timeout can break it
  without anyone choosing to.
- ADR [0153](../decisions/0153-subset-sweeps-write-to-scratch-not-the-committed-baseline.md) — the
  committed baseline was correctly untouched throughout; that guard worked.
- `docs/progress/c2-tier1.md` — the incident, and the three verdicts voided because of it.
