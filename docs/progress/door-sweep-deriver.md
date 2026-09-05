# DOOR-SWEEP-DERIVER — progress record

Door-sweep case deriver: pre-AE5 remediation Batch 1. The unit's **summary** is its hub,
[docs/features/door-sweep-deriver.md](../features/door-sweep-deriver.md) § Current state; this file
is its **log** (ADR 0186 D3): one dated subsection per session, appended.

Subjects: `scripts/door-sweep-cases.sh` (721 lines at open) and the full-run emit path that writes
`docs/reviews/authz-door-audit-findings.md` (in `supabase/tests/mutation/p0-authz-door-audit.sh`;
the sibling harnesses print the same hand-merged-block warning). Decisions: ADR
[0079](../decisions/0079-authz-door-blindness-standing-invariant.md) (Amendment 8 — the recipe's
rulings 1–3; ruling 4 in the script header), [0173](../decisions/0173-door-sweep-deriver-blind-to-runtime-rewrite-migrations.md)
(the `door-sweep-targets:` declaration), [0153](../decisions/0153-subset-sweeps-write-to-scratch-not-the-committed-baseline.md)
(subset → scratch; the full run is the residual), [0148](../decisions/0148-ever-held-affiliation-read-visibility.md)
(AFF3 re-derived the diagnosis because the ruling lived in prose), [0182](../decisions/0182-statement-scoped-authorized-scope-ids.md)
(the gate `9a4bbd22` added that the name filter dropped).

## Session log

### 2026-09-05 — unit opened (lead)

**Why now.** Batch 1 of the pre-AE5 batches ruled 2026-09-04. The deriver is §6 step 1 for every
phase and every AE5 per-role increment, and today it: derives **zero cases for a diff that added a
gate** (`BASE=9a4bbd22^ TIP=9a4bbd22` → exit 1, the sweep ran on a hand-widened list
indistinguishable downstream from a derived one); reads only the first line of a multi-line
`door-sweep-targets:` declaration (`…007250` survives on a *different* code path); cannot see
`alter function … security definer` (the exact analogue of ADR 0079 Amendment 8 ruling 1, one
branch over); and selects over the whole working tree so two in-flight increments report a union
(53 derived where AE1.3 owned 1). Batches 2 and 3 each need a **full** re-baseline run, and today a
full run silently destroys the committed findings file's hand-authored material — so that fix is
here, ahead of them.

**Scope.** Five follow-ups, closure on each one's own `Closes when` clause (hub § Acceptance
criteria). Explicitly NOT: `PRED_DOMAIN` (Batch 2); the write-arm 33-of-107 re-baseline and
`FUP-DIFF-SCOPED-SWEEP-IS-HALF-AIMED` Parts 2–4 (Batch 3 — Part 1 is already ruling 4 in the
script header); any change to a production function, policy or migration; any full sweep (the fix
that makes a full run safe is proven on a **copy** of the baseline, never by running one).

**Mechanisms at open** (from the follow-up bodies; every line number to be re-measured by the
builder against the file at HEAD, since the script has grown since each was filed):
- name filter in the recipe excludes `app.current_professional_read_organizations` → 0 cases,
  exit 1 (measured 2026-09-04 on a fresh reset at head `20261003007340`);
- marker grep `^[[:space:]]*--[[:space:]]*door-sweep-targets:` is per-line; continuation lines
  `--    app.foo()` unread, no warning;
- function branch selects on the `create function` body matching `security definer` + `returns
  boolean` + the identity regex; an `ALTER` has no body → invisible;
- file set = committed range ∪ `git diff --name-only HEAD` ∪ `git ls-files --others
  --exclude-standard`, reported as one diff with no provenance;
- full run emits the findings file through a truncating redirect; the file carries a hand-merged
  `<!-- … -->` subset block (~line 569), a trailing RENAME note, and annotated skipped-policy
  bullets that no run reproduces.

**Branch:** `authz-door-sweep-deriver` off `main` @ `76d87a4f`.
