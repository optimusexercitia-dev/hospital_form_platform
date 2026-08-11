# Vacuous-assertion audit — FUP-VACUOUS-AUDIT-1

> The repo-wide pass that **BUG-VACUOUS-ASSERT-1 explicitly deferred**: *"a repo-wide
> vacuous-pass audit … That is real, standalone work, and belongs in its own pass."*
> Run with `node scripts/check-vacuous-assertions.mjs` (`--json` for machine output,
> `--self-test` for the fixtures alone).

## The property being checked

    every test must carry at least ONE assertion that executes UNCONDITIONALLY.

A test that satisfies it may still be weak. A test that **fails** it is provably able to
pass having checked nothing — indistinguishable in the report from one that verified the
real thing. That is the shape being hunted, and it is invisible to every other gate here:
ESLint does not flag it, `tsc` does not either (both branches are valid TypeScript), and a
green Playwright/Vitest run cannot tell you which branch ran.

An assertion counts as unconditional when it is reached without passing a conditional
boundary **and** no conditional `return` precedes it. Deliberate exceptions, because these
genuinely always assert: exhaustive `if`/`else` where **every** branch asserts (including
`else if` chains ending in a real `else`), `await test.step(…)` bodies, `try`/`finally`
without a `catch` (a `finally` cannot swallow the failure), `await waitFor(() => expect(…))`
and friends (the callback always runs and its failure propagates), `for…of` over a non-empty
array **literal** (including `as const`), and calls to local helpers that themselves assert
unconditionally. A conditional `test.skip()` is **not** a bail-out: a skipped test is
reported as skipped, which is honest — a silent `return` is not.

## How the detector was validated — read this before trusting a number

**Positive control.** Against the *pre-fix* `e2e/phase22-referrals.spec.ts` (git `a0e7e9f`)
it reports exactly the four instances BUG-VACUOUS-ASSERT-1 found by hand — Flows 4c, 5c, 5d,
8c — and nothing else. It agrees precisely with the hand classification.

⚠ **An earlier revision of this document claimed the detector found "three more the manual
check missed" (Flows 1c, 2c, 8b). That claim was WRONG and is retracted.** Those three were
false positives from the detector not yet understanding exhaustive `if`/`else`. The tester's
original count of four was correct.

**Negative control — this is the load-bearing half.** The first run reported **89** findings.
Hand-checking the flagged tests found **four** distinct detector defects, each a whole class
of false positive:

| defect | false positives | why |
| --- | --- | --- |
| exhaustive `if`/`else` treated as conditional | 12 | `if (x) { assert } else { assert }` asserts on every path; this is the standard shape of a deny-test that accepts either a 403 or an empty result |
| `.tsx` parsed as `ScriptKind.TS` | 18 | `createSourceFile` does **not** throw on a syntax error — it returns a best-effort tree, so every JSX test was silently analysed as garbage. The parse is now asserted (`parseDiagnostics`), not assumed. |
| `try`/`finally` treated as conditional | 16 | a `try` body runs unconditionally when no `catch` swallows the failure |
| `for…of` over an array **literal** treated as conditional | 10 | a literal with ≥1 element cannot be empty; `as const` was also hiding the literal |

Plus `await waitFor(() => expect(…))`, which flagged correctly-asserting component tests.

**89 → 33 after false-positive elimination.** Well over half the original report was the
tool's own fault, which is the same lesson the audit exists to teach: *a detector that finds
a lot needs proving just as much as one that finds nothing.* The self-test now pins every
fix (34 fixtures, both polarities), runs on every invocation, and the script **refuses to
report** if it fails its own fixtures.

## Status

- **Unit tests: 16 findings → 0. CLOSED.** Full Vitest suite green (82 files, 1218 tests).
- **E2E: 17 remaining** of the 29 that survived false-positive elimination.

## What fixing these actually turns up

Not cosmetics. Every file worked so far has produced a real defect:

1. **`phase22-referrals.spec.ts` Flow 4c** — ran as an `org_admin` that
   `create_referral_draft` has always refused (HC071). Every run since the test was written
   took the silent `return` and asserted nothing.
2. **`phase14c-rca.spec.ts` R8** — probed the relation `interviews`, which **does not
   exist** (catalog-verified; `interviews` is the feature-flag key, the table is
   `case_interviews`). The probe always came back empty, so the test always took its link
   fallback and the CITATION arm named in its own title had never executed once.
3. **`phase14c-rca.spec.ts` R6/R9/R10/R11** — four tests sharing one RCA row's status
   machine, each silently `return`ing when the row wasn't in the state it wanted. R11's bail
   fired precisely when R10 had failed to complete the RCA, so one broken test silently
   disarmed the next. The file also relied on sequential ordering it never declared.
4. **`rollups.test.ts`** — `assertNeverCollapsed` opened with
   `if (!hasAnyEvidenceField) return`, exempting the most complete collapse there is.
5. **`door-error-arms.test.ts`** — the test written BY NAME as the guard against an empty
   domain was itself sweeping a constant that could empty.

## Remaining E2E findings — 17 tests across 12 files

1 have **no assertion anywhere in the test body**; 10 bail out
through a conditional `return` — the Flow 4c shape, which is the one that has produced a
real defect every time so far.

⚠ **Candidates, not confirmed defects.** The check is conservative about what it *admits* as
unconditional, so a finding means "this test CAN pass having asserted nothing". One known-benign
entry remains and should be dispositioned rather than fixed: a test whose title declares it a
cleanup step (`hospital-admin-tier.spec.ts:567`).

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
| `e2e/phase10-meetings.spec.ts` | 460 | all conditional · early-return | AC2 — signing flow: pending badge, sign, badge clears, auto-flip to assinada, Distribuir |
| `e2e/phase10-meetings.spec.ts` | 949 | all conditional · early-return | AC4e — Reabrir revokes signatures and unlocks editing |
| `e2e/phase14b-triage.spec.ts` | 308 | all conditional · early-return | T5: non-PSE triage routes event to closed with closure reason |
| `e2e/phi-remediation.spec.ts` | 367 | all conditional · early-return | REM-8: opening RCA detail emits rca.viewed audit row |
| `e2e/phi-remediation.spec.ts` | 411 | all conditional · early-return | REM-9: opening CAPA detail emits capa_plan.viewed audit row |

## Not wired into `npm run lint`

Deliberately, while findings remain open: a permanently-red gate is one people learn to
ignore. Once the list is empty, adding `check-vacuous-assertions.mjs` to the lint chain
makes the count monotonically non-increasing. That is a lead/PO call.
