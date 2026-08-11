# Vacuous-assertion audit — FUP-VACUOUS-AUDIT-1

> The repo-wide pass that **BUG-VACUOUS-ASSERT-1 explicitly deferred**: *"a repo-wide
> vacuous-pass audit … That is real, standalone work, and belongs in its own pass."*
> Run with `node scripts/check-vacuous-assertions.mjs` (add `--json` for machine output).

## The property being checked

    every test must carry at least ONE assertion that executes UNCONDITIONALLY.

A test that satisfies it may still be weak. A test that **fails** it is provably able to
pass having checked nothing — indistinguishable in the report from one that verified the
real thing. That is the shape being hunted, and it is invisible to every other gate here:
ESLint does not flag it, `tsc` does not either (both branches are valid TypeScript), and a
green Playwright/Vitest run cannot tell you which branch ran.

An assertion counts as unconditional when it is reached without passing an `if`, `switch`,
`try`-with-`catch`, loop over a computed collection, `?:`, `||`/`&&`/`??`, or a callback that
may never fire — **and** no conditional `return` precedes it. Deliberate exceptions, because
these genuinely always run: `await test.step(…)` bodies, `try`/`finally` without a `catch`
(a `finally` cannot swallow the failure), `for…of` over a non-empty array **literal**, and
calls to local helpers that themselves assert unconditionally (resolved transitively).
A conditional `test.skip()` is **not** treated as a bail-out: a skipped test is reported as
skipped, which is honest — a silent `return` is not.

## How the detector was validated — read this before trusting a number

**Positive control.** Run against the *pre-fix* `e2e/phase22-referrals.spec.ts` (git
`a0e7e9f`), it independently rediscovers **all four** hand-found instances (Flows 4c, 5c, 5d,
8c) **plus three the manual bounded check missed** (1c, 2c, 8b) — 7 in the one file the
tester examined by hand. A detector that finds nothing must first be proven able to find
something.

**Negative control — and it mattered.** The first run reported **89** findings. Three
separate detector defects were then found and fixed, each removing a class of false positive:

| defect | false positives | why |
| --- | --- | --- |
| `.tsx` parsed as `ScriptKind.TS` | 18 | `createSourceFile` does **not** throw on a syntax error — it returns a best-effort tree, so every JSX test silently analysed as garbage. The parse is now asserted (`parseDiagnostics`), not assumed. |
| `try`/`finally` treated as conditional | 16 | a `try` body runs unconditionally when no `catch` swallows the failure; the `try { assert } finally { cleanup }` idiom is common in these specs |
| `for…of` over an array **literal** treated as conditional | 10 | a literal with ≥1 element cannot be empty |

**89 → 45.** Roughly half the original report was the detector's own fault, which is the
same lesson the audit exists to teach. The self-test now pins all three fixes (25 fixtures,
both polarities); it runs on every invocation and the script **refuses to report** if it
fails its own fixtures.

## Findings — 45 tests across 25 files

2 have **no assertion anywhere in the test body**;
14 bail out through a conditional `return` (the Flow 4c shape, the one that turned out to be
hiding a live defect).

⚠ **These are candidates, not confirmed defects.** The check is deliberately conservative in
what it *admits* as unconditional, so a finding means "this test CAN pass having asserted
nothing", not "this test is wrong". Two known-benign shapes are in the list and should be
dispositioned rather than fixed: a test whose title declares it a cleanup/fixture step
(`hospital-admin-tier.spec.ts:567`, `DASH-SETUP`-style rows), and a helper whose own early
`return` is a deliberate shape guard (`rollups.test.ts:319`).

⚠ **Fixing these is NOT mechanical.** The one instance whose fix is already known —
Flow 4c — turned red the moment its guard became an assertion, because it had been calling
an RPC as the wrong persona and being refused on **every run since it was written**. Expect
reds, and treat each as a find rather than as breakage. Budget accordingly.

## E2E specs

| file | line | shape | test |
| --- | --- | --- | --- |
| `e2e/case-access.spec.ts` | 1063 | all conditional · early-return | AC-7 PHI boundary: check if safety event linked to case; if so, read-grantee click-through is denied |
| `e2e/case-narratives.spec.ts` | 699 | all conditional · early-return | AC-7: after conclusion — read-only; no Editar; empty narratives hidden |
| `e2e/case-patient.spec.ts` | 410 | all conditional · early-return | AC-1a: builder toggle enables collects_patient on draft template |
| `e2e/case-patient.spec.ts` | 946 | all conditional · early-return | AC-4: referral wizard pre-fills from case_patient (source=case) |
| `e2e/case-patient.spec.ts` | 1041 | all conditional · early-return | AC-5: notify-NSP dialog pre-fills event_patient from case_patient |
| `e2e/case-phase-result.spec.ts` | 897 | all conditional | AC-K: keyboard-only flow — vocab settings page and "Corrigir resultado" dialog |
| `e2e/ff3-validations.spec.ts` | 1082 | all conditional | FF3-6 required_if with a unary operator saves and publishes on choice, number, date and time targets |
| `e2e/hospital-admin-tier.spec.ts` | 531 | all conditional | title badge renders on the meeting attendee list once assigned |
| `e2e/hospital-admin-tier.spec.ts` | 567 | **NO ASSERTIONS AT ALL** | cleanup: unassign the title from staff1.ccih (test hygiene) |
| `e2e/member-action-items-overview.spec.ts` | 711 | all conditional | AC-11: cards link to the correct member destinations |
| `e2e/nsp-per-hospital.spec.ts` | 853 | all conditional | target-hospital operator (pqs.a2, secundario-a) reads the referral (dual-hospital READ) |
| `e2e/patient-index.spec.ts` | 794 | all conditional | AC-8a: non-PQS admin (chefe.ccih) search_patient_xref → null/empty result |
| `e2e/patient-index.spec.ts` | 821 | all conditional | AC-8b: direct SELECT on patient_xref as authenticated → 0 rows (RLS REVOKE) |
| `e2e/phase-multitenancy.spec.ts` | 355 | all conditional | staff1.ccih can open a form to fill at the new route path |
| `e2e/phase10-meetings.spec.ts` | 460 | all conditional · early-return | AC2 — signing flow: pending badge, sign, badge clears, auto-flip to assinada, Distribuir |
| `e2e/phase10-meetings.spec.ts` | 949 | all conditional · early-return | AC4e — Reabrir revokes signatures and unlocks editing |
| `e2e/phase14b-triage.spec.ts` | 308 | all conditional · early-return | T5: non-PSE triage routes event to closed with closure reason |
| `e2e/phase14c-rca.spec.ts` | 315 | all conditional · early-return | R6: add_rca_root_cause adds a classified root cause |
| `e2e/phase14c-rca.spec.ts` | 389 | all conditional | R8: add_rca_evidence with citation type (interview target) |
| `e2e/phase14c-rca.spec.ts` | 435 | all conditional · early-return | R9: submit_rca_for_review transitions in_progress → in_review |
| `e2e/phase14c-rca.spec.ts` | 466 | all conditional · early-return | R10: complete_rca freezes the RCA; rejects if no root cause exists |
| `e2e/phase14c-rca.spec.ts` | 509 | all conditional · early-return | R11: reopen_rca transitions completed → in_progress and writes audit row |
| `e2e/phase22-referrals.spec.ts` | 480 | all conditional | Flow 1c: get_case_detail on B's target_case_id as an A user → no_data_found (RLS) |
| `e2e/phase22-referrals.spec.ts` | 551 | all conditional | Flow 2c: B cannot read A's live source case via get_case_detail (RLS) |
| `e2e/phase22-referrals.spec.ts` | 1214 | all conditional | Flow 8b: keyboard-only — send wizard button focus and label visibility |
| `e2e/phi-remediation.spec.ts` | 231 | all conditional | REM-4: direct REST read of event_patient is denied — returns 403/42501 |
| `e2e/phi-remediation.spec.ts` | 261 | all conditional | REM-5: non-PQS committee staff_admin (chefe.ccih) is denied event_patient read |
| `e2e/phi-remediation.spec.ts` | 367 | all conditional · early-return | REM-8: opening RCA detail emits rca.viewed audit row |
| `e2e/phi-remediation.spec.ts` | 411 | all conditional · early-return | REM-9: opening CAPA detail emits capa_plan.viewed audit row |

## Unit tests

| file | line | shape | test |
| --- | --- | --- | --- |
| `src/components/forms/condition-targets.test.ts` | 182 | all conditional | offers a target if and ONLY if the shared predicate allows it |
| `src/components/forms/validation-drafts.test.ts` | 237 | all conditional | round-trips every rule type through drafts and back to config |
| `src/components/forms/validation-drafts.test.ts` | 290 | all conditional | requires at least one bound on the bounded types |
| `src/components/forms/validation-drafts.test.ts` | 488 | all conditional | every other rule type IS client-evaluated |
| `src/components/process-templates/begin-template-edit-button.test.tsx` | 107 | all conditional | calls the action only after the confirm |
| `src/components/process-templates/begin-template-edit-button.test.tsx` | 137 | all conditional | navigates to the RETURNED draft id on an absolute path |
| `src/lib/accreditation/rollups.test.ts` | 319 | **NO ASSERTIONS AT ALL** | every GapItem (inside blockingGaps and gaps) carries the full four-way split |
| `src/lib/affiliations/door-error-arms.test.ts` | 201 | all conditional | the door migrations still exist under the names this test reads |
| `src/lib/affiliations/door-error-arms.test.ts` | 237 | all conditional | every arm maps to a DISTINCT message (no arm silently duplicates the generic one) |
| `src/lib/cases/distribute.test.ts` | 32 | all conditional | assigns every case exactly once, only to selected members |
| `src/lib/cases/distribute.test.ts` | 52 | all conditional | keeps per-member workloads within 1 of each other (balanced) |
| `src/lib/forms/item-type-sets.test.ts` | 85 | all conditional | every answerable type is also creatable |
| `src/lib/forms/participant-type-labels.test.ts` | 42 | all conditional | maps all seven types to the exact pt-BR strings the SQL twin emits |
| `src/lib/forms/participant-type-labels.test.ts` | 59 | all conditional | emits NO raw English identifier for any declared type |
| `src/lib/queries/session-grants.test.ts` | 264 | all conditional | the KNOWN_UNROUTED ledger has no stale entries (a fixed role must be removed) |
| `src/lib/queries/validations.test.ts` | 143 | all conditional | refuses containers, display items, matrices and references |

## Not wired into `npm run lint`

Deliberately. With 45 open findings a gate would red the build on day one, and a
permanently-red gate is one people learn to ignore. The sequence that would work: disposition
the list above, fix or accept each, **then** add `check-vacuous-assertions.mjs` to the lint
chain so the count can only go down. That is a PO/lead call, not the script's.
