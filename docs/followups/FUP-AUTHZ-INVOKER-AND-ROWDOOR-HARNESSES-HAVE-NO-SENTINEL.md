# FUP-AUTHZ-INVOKER-AND-ROWDOOR-HARNESSES-HAVE-NO-SENTINEL — two mutation harnesses open live gates with no crash sentinel at all

**Filed:** 2026-09-04 (HARNESS-CRASH-SAFETY, found while fixing the class in the other three)
**Owner:** backend
**Severity:** high — a killed run leaves an authorization gate open with **no** record anywhere;
the two harnesses are ad-hoc/periodic rather than phase-gate arms, which is the only reason this
is not critical.

## The measurement

Taken 2026-09-04 by reading the `restore_inflight` + `trap` block of **every** harness in
`supabase/tests/mutation/` at `7c85e713`:

| harness | trap-path restore | verifies? | sentinel | `INT/TERM/HUP` trap |
|---|---|---|---|---|
| `c2-command-door-neutralizer.sh:88-93` | `psql_f …; : > "$INFLIGHT"` | no → **fixed** | `$INFLIGHT` **is** the sentinel | yes |
| `p0-authz-door-audit.sh:198-206` | `psql_f …; rm -f "$SENTINEL"` | no → **fixed** | separate file, `RECOVER=1` | yes |
| `p0-authz-writepath-audit.sh:803-811` | `psql_f …; cp → .attempted; rm -f "$SENTINEL"` | no → **fixed** | separate file, `RECOVER=1` | yes |
| **`p0-authz-invoker-audit.sh:211-217`** | `psql_f …` | **no** | **none** | **none** |
| **`p0-authz-rowdoor-audit.sh:152-158`** | `psql_f …` | **no** | **none** | **none** |

The first three were repaired under HARNESS-CRASH-SAFETY (ADR 0189): a restore is believed only
when the catalog agrees (psql rc **and** a probe re-read), and a failed restore **keeps** the
sentinel. The last two were deliberately left out of that unit's scope so the fix stayed reviewable.

## Why these two are worse, not merely unfixed

- They have **no sentinel**, so there is nothing for a *next* run to refuse on. A SIGKILL leaves
  the gate open and no artifact anywhere says so — the very silence
  `FUP-C2-TIER1-INFLIGHT-SENTINEL-ERASED-BY-ITS-OWN-RESTORE` is about.
- They trap **`EXIT` only**. `Ctrl-C` and an ordinary `kill` — which is what "killed a contaminated
  run" means in practice — do run an EXIT trap in bash, but a job-tree teardown that kills the
  `psql` child alongside the shell leaves the restore silently failed and unrecorded.
- `p0-authz-invoker-audit.sh` mutates **wrapper identity asserts**; `p0-authz-rowdoor-audit.sh`
  mutates **row doors**. Both are authorization surfaces.

⚠ **Not a claim that a gate is currently open.** Nothing here was measured as contaminated; the
finding is the *absence of the mechanism*, and the absence is what makes a future incident silent.

## Closes when

Both harnesses adopt the same three-part protocol the other three now carry, and each is **proven
able to fire** by a plant-A-shaped test (arm the trap on a real gate, corrupt the restore SQL,
observe the refusal and the surviving sentinel):

1. a fixed-path crash sentinel written **before** the gate is opened, distinct per harness;
2. `arm_inflight` / `disarm_inflight` with a **probe** recorded beside the sentinel, so the restore
   is verified against the **catalog** (psql rc **and** the probe's value), never from psql's
   message, and a failed restore **keeps** the sentinel;
3. `INT`/`TERM`/`HUP` traps plus a startup refusal with `RECOVER=1`, matching
   `p0-authz-door-audit.sh`.

⛔ A fix at four of five sites reads as a fix of the class. That is what this entry exists to
prevent.
