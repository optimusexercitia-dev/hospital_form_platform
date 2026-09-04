---
id: C2-TIER1
title: Command-door Tier 1 sweep — PHI-touching command doors, gate-aware closure
status: complete
kind: feature
program: AUTHZ
phase: "ADR 0162 §3 — C2 Tier 1 (pilot cutline, pre-Gate-AE4 PO approval)"
branch: ~   # landed on main; CLOSED 2026-09-04 at 170/1/0, QA APPROVED, Gate AE4 PO-approved on it
plan: ../plans/authz-evolution.md
progress: ../progress/c2-tier1.md
reviews: ["../reviews/c2-tier1-closure-review.md", "../reviews/c2-command-door-findings.md", "../reviews/c2-suite-abort-diagnosis.md"]
adrs: ["0188", "0187", "0171", "0162", "0079", "0184", "0153"]
handoff: ~
fup: ~
---

# C2-TIER1 — Command-door Tier 1 sweep

## Acceptance criteria

Full ruling: `FUP-AUTHZ-COMMAND-DOOR-UNSWEPT` / Critical FUP C2 (PO ruling 2026-08-18;
⭕ entry and Critical row both **rotated to `docs/followups/follow-ups-archive.md` 2026-09-04**) and the re-grained predicate in
[authz-c2-tier1-sizing.md § 8b](../design/authz-c2-tier1-sizing.md). Still open:

- [x] "Sizing closed nothing here — no door has a verdict" — **superseded**: the full sweep has
      since run, 171/171 enforcers now carry a verdict (docs/progress/2026-Q3.md, "C2 FULL SWEEP
      COMPLETE 2026-09-02")
- [x] "8 of 171 measured — the FULL SWEEP HAS NOT RUN, no door has a verdict, C2 stays OPEN" —
      **superseded**: full sweep ran — COVERED 109 · BLIND 40 · ERROR 22 (docs/progress/2026-Q3.md;
      [findings](../reviews/c2-command-door-findings.md))
- [x] `FUP-C2-THREE-BLIND-COMMAND-DOOR-GUARDS` — ✅ **39/39 keystones written and swept COVERED 2026-09-04** (`400b6d2c`, `2cefae8e`); 16 D2 property labels. Original text: — "the first 8 measurements ... found 3 BLIND:
      `public.nsp_org_capa_rollup`, `public.cancel_event` (both **0** pgTAP mentions) and
      `public.cancel_session`" — each needs a keystone; still true of the larger BLIND set from the
      full sweep — **39** keystones, 40 BLIND less `app.print_source_series` (ADR 0187 D3). (docs/followups/follow-ups-open.md — entry ROTATED to follow-ups-archive.md 2026-09-04)
- [x] ✅ **`assume_role` scores COVERED 2026-09-04** at full-suite scale (`97ff9f22`), discharging this within Tier 1. Original text: "`assume_role` remains ERROR-shaped, not COVERED, and must be resolved *within* Tier 1"
      (docs/design/authz-c2-tier1-sizing.md § 10) — it is one of the **18** suite-abort ERROR rows,
      not an anchor casualty, so the anchor fix could not reach it
- [x] ✅ **CLOSED 2026-09-04** — 170 COVERED · 1 BLIND · 0 ERROR = 171; all four arms hold. Original text: "the C2 subset closed (pilot cutline)" before Gate AE4's PO approval — **still open despite
      the full sweep**: "C2 IS NOT CLOSED" (docs/progress/2026-Q3.md; ADR 0184 points 4–5;
      docs/plans/authz-evolution.md:1066; ADR 0162 §3, amended by ADR 0184 on branch-order only)
- [x] ✅ **STATED 2026-09-04** in the record's disclosure block — and there are now **four**, the fourth being trigger enforcers. Original text: The three uncovered populations named in ADR 0184 point 4 must be **STATED** in every gate
      record citing this sweep — a disclosure obligation, **not** a closure blocker (PO ruling
      2026-09-04, ADR 0187 D1; the hub's former "must be resolved" was a drafting error). ⛔ Tier 2's
      **190 doors stay deferred by ADR 0171 and are NOT cleared** — say so verbatim. The other two:
      the `HCDS*`/`28000` lane — **8 functions**, all raising an anchored `42501`, so **none** is
      excluded by the `:153` gate-fn filter (ADR 0184's "structurally absent" diagnosis does not
      hold; 4 already carry verdicts, 4 are absent for a **Tier-1 membership** reason — ADR 0187
      C3); and **22** ERROR enforcers with no verdict (16 suite-abort + 5 semicolon-spanning + 1
      `save_block_to_library`; the "~10" was an in-flight extrapolation — ADR 0187 C2)
- [x] ✅ **Operationalised 2026-09-04** — 14 class-B keystones carry `[PROPERTY: … — NOT authorization]`; the 106 pre-existing COVERED rows stay unclassified and 0184 point 5 stands for them. Original text: "A COVERED/BLIND verdict from this run means `HC0*`-coded-guard coverage, NOT authorization
      coverage" (ADR 0184 point 5) — operationalised by ADR 0187 D2: the **14** BLIND doors with no
      authorization raise in their own body close via state-guard keystones carrying an **EXPLICIT
      PROPERTY LABEL** (state / lifecycle / validation), ⛔ never recorded as authorization coverage.
      The label is the condition of the closure. ⚠ Denominators, added 2026-09-04 and NOT part of
      the quoted text: classes count **doors** (A1 12 / A2 13 / B 14 = 39), labels count **arms**
      (16 across 15 doors — `cancel_event` is A2 with a state-labelled second arm)
