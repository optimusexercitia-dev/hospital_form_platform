---
id: C2-TIER1
title: Command-door Tier 1 sweep — PHI-touching command doors, gate-aware closure
status: gated
kind: feature
program: AUTHZ
phase: "ADR 0162 §3 — C2 Tier 1 (pilot cutline, pre-Gate-AE4 PO approval)"
branch: ~   # landed on main with AE4 2026-09-03; authz-ae4-catalog deleted; not closed (ADR 0184 pts 4–5)
plan: ../plans/authz-evolution.md
progress: ../progress/c2-tier1.md
reviews: ["../reviews/c2-command-door-findings.md"]
adrs: ["0187", "0171", "0162", "0079", "0184", "0153"]
handoff: ~
fup: ~
---

# C2-TIER1 — Command-door Tier 1 sweep

## Acceptance criteria

Full ruling: `FUP-AUTHZ-COMMAND-DOOR-UNSWEPT` / Critical FUP C2
(docs/followups/follow-ups-open.md, PO ruling 2026-08-18) and the re-grained predicate in
[authz-c2-tier1-sizing.md § 8b](../design/authz-c2-tier1-sizing.md). Still open:

- [x] "Sizing closed nothing here — no door has a verdict" — **superseded**: the full sweep has
      since run, 171/171 enforcers now carry a verdict (docs/progress/2026-Q3.md, "C2 FULL SWEEP
      COMPLETE 2026-09-02")
- [x] "8 of 171 measured — the FULL SWEEP HAS NOT RUN, no door has a verdict, C2 stays OPEN" —
      **superseded**: full sweep ran — COVERED 109 · BLIND 40 · ERROR 22 (docs/progress/2026-Q3.md;
      [findings](../reviews/c2-command-door-findings.md))
- [ ] `FUP-C2-THREE-BLIND-COMMAND-DOOR-GUARDS` — "the first 8 measurements ... found 3 BLIND:
      `public.nsp_org_capa_rollup`, `public.cancel_event` (both **0** pgTAP mentions) and
      `public.cancel_session`" — each needs a keystone; still true of the larger BLIND set from the
      full sweep — **39** keystones, 40 BLIND less `app.print_source_series` (ADR 0187 D3). All 39
      are now **specified** per door ([specs](../design/authz-c2-blind-keystone-specs.md),
      2026-09-04); **none is written**. ⛔ Two are blocked on a catalog read before any keystone may
      be written (specs § 6.4) (docs/followups/follow-ups-open.md)
- [ ] "`assume_role` remains ERROR-shaped, not COVERED, and must be resolved *within* Tier 1"
      (docs/design/authz-c2-tier1-sizing.md § 10) — it is one of the **18** suite-abort ERROR rows,
      not an anchor casualty, so the anchor fix could not reach it
- [ ] "the C2 subset closed (pilot cutline)" before Gate AE4's PO approval — **still open despite
      the full sweep**: "C2 IS NOT CLOSED" (docs/progress/2026-Q3.md; ADR 0184 points 4–5;
      docs/plans/authz-evolution.md:1066; ADR 0162 §3, amended by ADR 0184 on branch-order only)
- [ ] The three uncovered populations named in ADR 0184 point 4 must be **STATED** in every gate
      record citing this sweep — a disclosure obligation, **not** a closure blocker (PO ruling
      2026-09-04, ADR 0187 D1; the hub's former "must be resolved" was a drafting error). ⛔ Tier 2's
      **190 doors stay deferred by ADR 0171 and are NOT cleared** — say so verbatim. The other two:
      the `HCDS*`/`28000` lane — **8 functions**, all raising an anchored `42501`, so **none** is
      excluded by the `:153` gate-fn filter (ADR 0184's "structurally absent" diagnosis does not
      hold; 4 already carry verdicts, 4 are absent for a **Tier-1 membership** reason — ADR 0187
      C3); and **22** ERROR enforcers with no verdict (16 suite-abort + 5 semicolon-spanning + 1
      `save_block_to_library`; the "~10" was an in-flight extrapolation — ADR 0187 C2)
- [ ] "A COVERED/BLIND verdict from this run means `HC0*`-coded-guard coverage, NOT authorization
      coverage" (ADR 0184 point 5) — operationalised by ADR 0187 D2: the **14** BLIND doors with no
      authorization raise in their own body close via state-guard keystones carrying an **EXPLICIT
      PROPERTY LABEL** (state / lifecycle / validation), ⛔ never recorded as authorization coverage.
      The label is the condition of the closure

## Current state

**Updated:** 2026-09-04

### Objective

Sweep the 237 command doors that touch PHI (Tier 1, gate-aware closure over `ARM=census`'s population), then close C2 on **three** items — the anchor fix, the ERROR class re-swept, and 39 keystones — before Gate AE4's PO approval (ADR 0162 §3; branch-order amended by ADR 0184, closure condition set by ADR 0187 D1). The three uncovered populations are **stated**, not resolved.

### Done since start

- Full sweep ran 2026-09-02 — 171/171 enforcers swept (COVERED 109 · BLIND 40 · ERROR 22; see acceptance criteria above and the record).
- PO ruling 2026-09-02 lifted the branch-order HOLD — the sweep ran against the branch's own schema, not `main`'s (ADR 0184).
- C2's commits merged into `authz-ae4-catalog` 2026-09-03; a duplicate-ADR-number collision was resolved by renumbering C2's sweep ADR to 0184 (detail: record).
- **2026-09-04, ADR 0187** — three PO rulings (Tier 2 = disclosure not blocker; state-guard keystones carry an explicit property label; `app.print_source_series` ruled OUT of the BLIND set, 40 → **39** keystones) and six corrections re-measured against the live catalog. Detail + method: the record.
- ✅ **Closure item 1 LANDED 2026-09-04** (`ca328539`) — the anchor fix, and it is **larger than the fix that was on record**: that one was validated against migration text, not `pg_proc`, against a denominator that excluded the shape it misses. Worklist column 6 now **is** the anchor byte-for-byte. Tally moves to **COVERED 113 · BLIND 40 · ERROR 18**.
- ✅ **Per-door keystone spec written 2026-09-04** (`40c3c588`) for all 39 — `docs/design/authz-c2-blind-keystone-specs.md`.
- ✅ **PO ruling 2026-09-04** — the 3 doors where the caller-input rule and a message reading disagree are labelled **B**, provisionally; the conservative call cannot commit the promotion ADR 0184 point 5 forbids.

### In progress

- **Phase A** — diagnosing the **18** suite-abort ERROR enforcers and 2 catalog reads that block two keystones (`docs/reviews/c2-suite-abort-diagnosis.md`).

### Next

- **Phase B** — write the 39 keystones + the suite-abort fixes + delete the **10** owed `authz-neverclled-door-allowlist.txt` lines. Cluster order (specs §6.6): 9 → 6 → 1 → 3 → 5 → 7 → 4 → 2 → 8.
- **Phase C** — verification subset sweep over 39 + 18, rows **merged** into the findings file, never copied over it (ADR 0153). ⚠ Budget at the measured **~100–106 s/run**, not the 53 s on record.
- **Phase D** — `ARM=census`, `ARM=floor` (its offender list changes by up to 10), `ARM=hat`, `FROMFINDINGS=1 ARM=wrapper`; then the records.
- ⛔ The waves **serialize**: nothing under `supabase/tests/**` may be edited while a sweep runs — it changes the suite shape and voids the in-flight baseline.

### Blockers

- C2 does **not** close yet — of ADR 0187 D1's three items the anchor fix is **done**; the ERROR class is unswept and 39 keystones unwritten. ⚠ Tier 2's 190 doors are **NOT** a blocker: they stay deferred by ADR 0171 and must be **stated** in every gate record, never cleared.
- ⭐ The anchor fix **converts** part of the semicolon-spanning ERROR class into the suite-abort class rather than into verdicts, so that population **grew 16 → 18**. Landing a mutation is not the same as producing a verdict.
- 39 BLIND findings need keystones; allowlisting is prohibited — it would make `ARM=floor` and this harness agree while both measure nothing.
- ~~`main` is not pushed~~ — **struck 2026-09-04** (ADR 0187 C4). C2's remaining work lands on `main`; no branch is owed.
