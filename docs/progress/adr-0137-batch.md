# ADR 0137 batch — MRN as erasure key; case/referral usability (D1–D14)

Rotated out of `PROGRESS.md § Now` at the §6 Record step, 2026-08-24. Live residue (if any)
stays in PROGRESS.md; everything here is the completed record.

- **Plan:** [case-referral-usability-batch.md](../plans/case-referral-usability-batch.md) — carries
  10+ plan defects found by pre-build measurement, each corrected **in place**. ⚠ Read the
  corrections, not the original claims; several original statements are false and marked so.
- **ADR:** [0137](../decisions/0137-mrn-erasure-key-and-case-referral-usability-batch.md)
- **Reviews:** [round 1](../reviews/adr-0137-batch-review.md) (`CHANGES REQUESTED`) ·
  [round 2](../reviews/adr-0137-batch-review-r2.md) (`APPROVED`)

---

## What shipped

Four migrations (`20261003001300`–`001600`), three pgTAP suites (**362–364**), one new E2E spec
(`e2e/patient-mode-required.spec.ts`), ~35 component/lib files.

| | |
| --- | --- |
| **D1–D3** | `patient_mode ∈ {none, optional, required}` + `patient_required_fields` replace the `collects_patient` / `patient_enabled` booleans. Enforcement point: **`app._set_participant_patient_unchecked`** (`prosecdef = f`, so **both** case write doors inherit it). Immutability via `app.guard_case_patient_mode_immutable`. |
| **D4** | MRN mandatory **at send** (`HC0T4`). The floor is on `send_referral`, **not** `save_referral_patient` — verified, and `app.guard_referral_status` makes `send_referral` the sole transition authority. |
| **D5–D7** | Referral wizard: deferred creation (step-1 "Continuar" no longer persists), explicit "Salvar rascunho". |
| **D8** | Attributed work is actionable — `canFillAssignedPhase`, keyed on **identity, never capability**, so `narrowToReadingSurface` cannot zero it. |
| **D9** | Field removals. |
| **D10** | `case_narratives.type_label` → **`display_label`** (a real column rename). |
| **D11–D13** | Narrative/process shell changes, incl. D13's `Trabalho do processo` container. |
| **D14** | `Tipo de caso` becomes draft-only on the Process detail page. |

---

## The blocker QA found, and why it mattered

Round 1 returned `CHANGES REQUESTED` on one measured fact:

```
patientMode / patient_required_fields in *.tsx : 0 files
collects-patient-picker.tsx                    : unmodified boolean toggle
live catalog, distinct patient_mode            : none, optional
rows with 'required'                           : 0 templates / 0 cases
```

⛔ **`required` was admitted by the CHECK constraint and written by nothing.** The schema, the
migrations and 7,125 pgTAP assertions all supported it — but pgTAP reached it only by **direct
INSERT as `postgres`**, and the 1,178 E2E assertions never reached it at all. So the ADR's
load-bearing half — the case-side MRN guarantee — was **dormant in the product** while § Now
recorded "all 4 increments BUILT".

⭐ **The lesson worth keeping is the shape, not the fix.** "The mechanism exists" and "the mechanism
is reachable" are different claims, and a schema-plus-pgTAP green cannot distinguish them: pgTAP
runs as `postgres` and can construct states no user can. **A value admitted by a CHECK and written
by no product path is an orphan**, and every downstream reader of it is *unexercised by
construction*. See [[keystone-measured-what-i-built-not-what-breaks]].

PO ruled **build** (2026-08-24). `collects-patient-picker.tsx` became the three-mode
`PatientModePicker`; `patient-fields.tsx` gained `requiredFields`; `create-case-dialog.tsx` got D3
layer 3. Per D2, `mrn` renders selected and **non-interactive as `aria-disabled` on a control that
keeps its tab-order place** — never `disabled`, never hidden. A required `Sexo` disables `unknown`,
because `app.patient_required_missing` counts that sentinel as *missing*.

**Reachability was then measured, not asserted:** a browser session as `chefe.ccih` wrote
`v2 | draft | required | {name,mrn}` — a row that did not previously exist and was not written by
`postgres` — then discarded the draft through the product's own affordance, DB back to baseline.

---

## Gate record (§6)

**Step 1** — fresh `supabase db reset --local`; lint **8/8 exit 0**; `tsc` **0**; vitest **121f /
1685t**; pgTAP **215f / 7126t PASS**; `ARM=census` · `ARM=hat` · `ARM=floor` ·
`FROMFINDINGS=1 ARM=wrapper` **all exit 0, INVARIANT HOLDS, zero `ERROR` lines**.

⚠ **Diff-scoped ARM 1 NOT TRIGGERED — a measured empty, not a clean sweep** (0 policy statements,
0 boolean-returning functions across all four migrations). ⛔ An empty domain and a clean sweep
print identically and are not the same claim.

⛔ **A correction to this batch's own gate record:** the compensating evidence was first written as
*"all 18 re-emitted bodies still hold their authz guards (2–7 refs each, none zeroed)"*. QA
re-measured: the range is **0–6** — `app.trg_audit_template_versions` **0**,
`clone_template_version` **1**, `get_case_detail` **6** — and **the zeros are correct by design**.
A uniform-sounding range hid that legitimate zeros exist and must be *named* as legitimate.

**Step 2** — full `e2e:prod` (`REBUILD=1`): **`GATE GREEN`, exit 0** — 1221 pass · 0 fail · 0 infra
· 0 did-not-run · 2 flaky · 11 documented skips; 113 spec files / 20 batches; 1223 of 1234
accounted.

The two earlier runs are part of the record because each failed differently:

1. **RED, exit 1 — 4 failures, ONE cause.** D10's rename was never swept into `e2e/` (13 sites / 4
   files; `src/` was measured correct). ⛔ **Not a string sweep** — `p_new_type_label` (an RPC
   parameter, excluded by the re-emission's `\mtype_label\M` word boundaries) and
   `case_referral.type_label` (a different column on a different table) had to survive untouched.
2. **Exit 5 (UNRUN) — zero assertion failures, 10 tests never run.** Batch 6's standalone server
   died and its retry died too. ⛔ **Exit 5 ≠ exit 1, deliberately:** the gate partitions
   clean / unproven / dirty so a stack death reads as neither a regression nor a pass.

⚠ **Today's green depended on four retries landing.** 4 of 20 batches hit `server_dead` (b5, b6,
b9, b12) and all four recovered — appended as a new data point to `FUP-E2E-SERVER-DEAD-1`, whose
rate is drifting **1/17 → 3/17 → 4/20**. Recovery is luck, not a property.

**Step 3** — QA `CHANGES REQUESTED` (r1) → `APPROVED` (r2). **Step 4** — PO approved 2026-08-24.

---

## Method notes that cost real time here

- ⭐ **Three separate scope errors came from bounding a sweep by a SYNTAX rather than a PROPERTY**,
  two of them the lead's: `grep send_referral` missed two UI-driven sends; a *batch* log was cited
  for a claim about a *file* (`HC0T4` in `batch-11.log` belonged to `perf-sweep-wave2`, not to any
  `pdf-printing*` spec); and "duplicate pgTAP prefixes are house practice" answered whether
  duplicates are *tolerated*, not whether **these** numbers are *cited* — they were, in AFF2's own
  records, so 359–361 were renumbered to **362–364**.
- ⭐ **`e2e:prod` batch membership is DECIDABLE, and settles cross-spec fixture collisions.** The
  gate packs `e2e/*.spec.ts` alphabetically, greedy first-fit, `BATCH_TESTS=70`, with a full reset
  **before every batch** — so specs in different batches cannot contaminate each other. Computing
  the packing also exposed that a verified pair had been run in the **opposite** order to the
  gate's, which is why the rule is *verify in batch context, in gate order*, not merely *reset
  first*.
- ⭐ **A dev-only failure is not a gate failure.** `case-corrections.spec.ts:659` (AC-3) failed ~78%
  under `next dev` and passed 3/3 under the production build — an upstream Radix
  `FocusScope`/`RovingFocusGroup` mount-order race. The gate had **never run it** (blocked by AC-1
  in `mode: 'serial'`). Fixed defensively in `src/components/ui/dropdown-menu.tsx` and shipped as
  its own `fix(ui):` commit, because a shared primitive behind every dropdown does not belong
  inside this batch's record.
- ⚠ **`lint:progress` enforces the follow-up index BIDIRECTIONALLY.** A body with no index line is
  invisible work; an index line with no body is a pointer to nothing. Both were hit in one session.
- ⚠ **PROGRESS.md's cap is `80 * 1024` = 81,920 bytes, not 80,000.** Believing the round decimal
  manufactures pressure to rotate protected content, which the contract forbids.

---

## Follow-ups filed (all OPEN, indexed in PROGRESS.md)

| id | note |
| --- | --- |
| 🟠 `FUP-0137-MRN-BLANKABLE-AFTER-SEND` | `sent` stays amendable, `p_mrn` defaults NULL → the erasure key can be blanked post-send. Read off live definitions, **no fixture driven**. |
| 🟠 `FUP-0137-RESUME-SWALLOW-SILENT-PHI-OVERWRITE` | QA r1 **R-3**, unfiled until r2 caught it. Swallowed load → next keystroke's full-replace upsert blanks `mrn`/`name`/`date_of_birth`. |
| 🟡 `FUP-0137-FLUSH-FAILS-OPEN` | Null re-read proceeds against a stale map; `HC0T4` made retries common. |
| 🟡 `FUP-0137-357-TWINS-ON-STALE-BODY` | Suite `357`'s twins red-proved the **pre-0137** body this batch re-emitted. |
| 🟡 `FUP-0137-BULK-WIZARD-STILL-BOOLEAN` | Bulk grid still reads `collectsPatient`. ⚠ This item **originally softened itself** — `HC0T1` is absent from `bulk-error-map.ts`, so the user gets the **generic** string, not the field-naming one. |
| 🟡 `FUP-0137-CASE-PATIENT-EDIT-NOT-MARKED` | `patientRequiredFields` not threaded page → panel → dialog. |
| 🟡 `FUP-0137-PERSIST-REFRESH-DROPS-FOCUS` | `persist()` + `router.refresh()` resets focus to `<body>`. ⚠ Scope by the **property** (refreshes the route on an input event), not this one file. |
| 🟡 `FUP-0137-KIND-VISUAL-NO-FALLBACK` | QA r1 **R-6**, unfiled until r2. |
| 🟡 `FUP-0137-ALERT-INSIDE-LABEL-MUTATES-NAME` | QA r1 **R-7**, unfiled until r2. |

⛔ **Three of the nine existed only in a superseded review file until QA r2 noticed.** A review's
open-risk list is a work item; once a later review supersedes the file, an unfiled risk is
indistinguishable from a deleted one.
