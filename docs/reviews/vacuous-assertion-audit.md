# Vacuous-assertion audit — FUP-VACUOUS-AUDIT-1 ✅ CLOSED

> The repo-wide pass that **BUG-VACUOUS-ASSERT-1 explicitly deferred**: *"a repo-wide
> vacuous-pass audit … That is real, standalone work, and belongs in its own pass."*
>
> **Status: 89 raw → 33 real → 0 remaining.** Now a standing gate: `npm run lint`
> includes `lint:vacuous`, which exits non-zero on any finding.
> Report manually with `node scripts/check-vacuous-assertions.mjs`
> (`--json` machine output · `--self-test` fixtures only · `--gate` build gate).

## The property

    every test must carry at least ONE assertion that executes UNCONDITIONALLY.

A test that satisfies it may still be weak. A test that **fails** it is provably able to
pass having checked nothing — indistinguishable in the report from one that verified the
real thing. That is the shape being hunted, and it is invisible to every other gate here:
ESLint does not flag it, `tsc` does not either (both branches are valid TypeScript), and a
green Playwright/Vitest run cannot tell you which branch ran.

### What counts as unconditional

Reached without passing a conditional boundary, **and** with no silent `return` before it.
These genuinely always assert and are accepted:

- exhaustive `if`/`else` where **every** branch asserts (incl. `else if` chains ending in a real `else`)
- a guard clause that **asserts before returning** (`if (bad) { expect(...); return }`)
- `await test.step(...)` bodies
- `try`/`finally` with **no** `catch` (a `finally` cannot swallow the failure)
- `await waitFor(() => expect(...))` and friends — the callback always runs and its failure propagates
- `for…of` over a non-empty array **literal**, incl. `as const` and a `const` bound to one
- calls to local helpers that themselves assert unconditionally (resolved transitively)
- a conditional **`test.skip()`** — a skipped test is reported as skipped, which is honest

Only a silent `return`, or assertions reachable solely through an un-elsed conditional,
count as findings.

## How the detector was validated — read this before trusting any number

**Positive control.** Against the *pre-fix* `e2e/phase22-referrals.spec.ts` (git `a0e7e9f`)
it reports exactly the four instances BUG-VACUOUS-ASSERT-1 found by hand — Flows 4c, 5c,
5d, 8c — and nothing else.

> ⚠ **Retraction.** An earlier revision of this document claimed the detector found "three
> more the manual check missed" (Flows 1c, 2c, 8b). **That was wrong.** Those three were
> false positives from the detector not yet understanding exhaustive `if`/`else`. The
> tester's original count of four was correct.

**Negative control — the load-bearing half.** The first run reported **89**. Hand-checking
flagged tests found **seven** distinct detector defects, each a whole class of false positive:

| defect | false positives | why it was wrong |
| --- | --- | --- |
| `.tsx` parsed as `ScriptKind.TS` | 18 | `createSourceFile` does **not** throw on a syntax error — it returns a best-effort tree, so every JSX test was silently analysed as garbage. The parse is now asserted via `parseDiagnostics`. |
| `try`/`finally` treated as conditional | 16 | a `try` body runs unconditionally when no `catch` swallows the failure |
| exhaustive `if`/`else` treated as conditional | 12 | asserts on every path; the standard shape of a deny-test accepting either a 403 or an empty result |
| `for…of` over an array **literal** | 10 | a literal with ≥1 element cannot be empty; `as const` also hid the literal |
| guard clause that asserts then returns | 5 | its exit path *does* assert; only a silent `return` leaves a bare path |
| conditional `test.skip()` | 3 | reported as skipped, not green |
| `await waitFor(() => expect(...))` | 2 | the callback always runs; failure propagates out of the wrapper |

**Well over half the first report was the tool's own fault.** That is the same lesson the
audit exists to teach, in the other direction: *a detector that finds a lot needs proving
just as much as one that finds nothing.* The self-test pins every fix (**42 fixtures**, both
polarities), runs on every invocation, and the script **refuses to report** if it fails its
own fixtures. The gate itself was proven able to fail by introducing a vacuous probe test
(exit 1, offender named) before being wired in.

## What fixing these actually turned up

Not cosmetics. **Six real defects**, none of which any gate had ever reported:

1. **`phase22-referrals.spec.ts` Flow 4c** — ran as an `org_admin` that
   `create_referral_draft` has always refused (HC071; tenancy authority is not
   commission-content authority). **Every run since the test was written** took the silent
   `return` and asserted nothing. A second gate (`send_referral` refuses a contentless
   draft) had never been reached either.
2. **`phase14c-rca.spec.ts` R8** — probed the relation `interviews`, which **does not
   exist**. Catalog-verified: `interviews` is the feature-flag key; the table is
   `case_interviews` — the same flag-key-is-not-a-table trap CLAUDE.md §1 flags for
   `case_patient`. The probe always returned empty, so the test always took its link
   fallback and the CITATION arm named in its own title had **never executed once**.
3. **`phase14c-rca.spec.ts` R6/R9/R10/R11** — four tests sharing one RCA row's status
   machine, each silently `return`ing when the row wasn't in the state it wanted. R11's
   bail fired precisely when R10 had failed to complete the RCA, so **one broken test
   silently disarmed the next**. The file also relied on sequential ordering it never
   declared.
4. **`hospital-admin-tier.spec.ts`** — the badge test's locator
   (`getByRole('link').filter({ hasText: /Reuni|.../ })`) matched the **sidebar "Reuniões"
   nav link**, because a meeting row's link text is the meeting *number*, not its title.
   The test clicked navigation and never opened a meeting detail page at all — which is
   exactly why its badge assertion had to be "soft". Its cleanup test also had no
   assertion, so a cleanup that failed left the next run's fixture dirty, silently.
5. **`rollups.test.ts`** — `assertNeverCollapsed` opened with
   `if (!hasAnyEvidenceField) return`, exempting the most complete collapse there is, and
   was the *only* check in one test.
6. **`door-error-arms.test.ts`** — the test written **by name** as the guard against an
   empty domain was itself sweeping a constant that could empty.

Two further tests were found to **never run**: `phi-remediation.spec.ts` REM-8 and REM-9
skip on every run (no seeded RCA for EV-0001; the only CAPA has a NULL `source_event_id`).
These are honest skips, not silent greens, so they are outside this property — recorded
under **FUP-VACUOUS-COVERAGE-1** rather than fixed here, since closing them means new
fixture work against a shared seed.

## The shapes the fixes took

- **Cardinality pins** (most unit findings) — tests whose every assertion sits inside
  `for (const x of SOME_CONSTANT)`, where an emptied constant makes claims like *"every
  answerable type is also creatable"* true for free. Several titles name a count, so the
  count is now asserted rather than described.
- **Establish, don't hope** — replace `read state → bail if wrong` with a helper that
  *drives* the state and asserts each transition (`ensureRcaStatus`).
- **Outcome discriminants** — for deny-tests with several acceptable outcomes, fold every
  path into one asserted value (`'denied' | 'no-rows' | 'null-column' | 'LEAKED'`), which
  also records *which* path ran.
- **Declare the ordering you rely on** — two files assumed sequential execution in their
  comments while the project runs `fullyParallel: true`.
- **Annotation → skip** — `test.info().annotations.push(...)` then `return` reports the test
  as **PASSED**. Where the condition is a genuine environmental limit, `test.skip()` makes
  it visible instead.
- **One honest exception** — `session-grants`' `KNOWN_UNROUTED` is empty *by design* (the
  goal state), so its assertion is one that still earns its keep when empty: a ledger entry
  naming a role the catalog lacks.

## The gate

`npm run lint` now runs `lint:vacuous` (`--gate`), which exits non-zero on any finding and
names the offending test. Reporting mode (no flag) always exits 0, for triaging a backlog.
