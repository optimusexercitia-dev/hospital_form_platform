# HARNESS-CRASH-SAFETY — progress record

Mutation-harness crash safety: pre-AE5 remediation Batch 0. The unit's **summary** is its hub,
[docs/features/harness-crash-safety.md](../features/harness-crash-safety.md) § Current state; this
file is its **log** (ADR 0186 D3): one dated subsection per session, appended.

Subjects: `supabase/tests/mutation/c2-command-door-neutralizer.sh`,
`supabase/tests/mutation/p0-authz-door-audit.sh`, `supabase/tests/mutation/p0-authz-writepath-audit.sh`,
and whichever sibling harness `FUP-AUTHZ-HARNESS-PRECONDITIONS` names (its `SUITE` defaulted to
`00_setup + 350`). Decisions: ADR [0079](../decisions/0079-authz-door-blindness-standing-invariant.md),
[0153](../decisions/0153-subset-sweeps-write-to-scratch-not-the-committed-baseline.md),
[0171](../decisions/0171-c2-tier1-regrain-and-the-command-door-neutralizer.md).

## Session log

### 2026-09-04 — unit opened (lead)

**Why now.** Batch 0 of the pre-AE5 follow-up batches ruled this day: the batches that follow
(deriver, `PRED_DOMAIN`, write-arm baseline) each need a multi-hour full sweep, and on
2026-09-04 a sweep killed by a 10-minute tool timeout left `public.cancel_event`'s two anchored
raises at `null;` for ~4 min with **no sentinel and no preflight red**
(`FUP-C2-TIER1-INFLIGHT-SENTINEL-ERASED-BY-ITS-OWN-RESTORE`). Running those sweeps first on a
harness that can strand a door silently is the realised risk, not a hypothetical one.

**Scope.** Four follow-ups, closure on each one's own `Closes when` clause (hub § Acceptance
criteria). Explicitly NOT: the door-sweep deriver (`scripts/door-sweep-cases.sh`, Batch 1),
`PRED_DOMAIN` (Batch 2), the write-arm re-baseline (Batch 3), the 296-site value-assertion
triage (`FUP-C2-TIER1-VALUE-ASSERTIONS-ABORT-ON-AN-INLINE-RAISE` — a lint pass may ride along
only if it costs nothing), any change to a production function, policy or migration.

**Mechanisms measured at open** (catalog-independent; read from the scripts at `7c85e713`):
- `c2-command-door-neutralizer.sh:88-93` — `restore_inflight` truncates `$INFLIGHT`
  unconditionally after `psql_f`, ignoring its exit status; traps at `:94-95` cover
  `EXIT INT TERM HUP` only. `:101-106` — `DEGEN` matches three whole-body constant shapes; the
  neutralizer's own `raise … ;` → `null;` rewrite matches none. `BASE_S` captured once at `:299`.
- `p0-authz-door-audit.sh:263-298` — the sibling's crash sentinel with `RECOVER=1`; `:300-351`
  the §7.16 degenerate-body preflight over `app`/`public`/`authz`, three forms. This is the
  design the neutralizer lacks.

**Branch:** `authz-harness-crash-safety` off `main` @ `7c85e713`.
