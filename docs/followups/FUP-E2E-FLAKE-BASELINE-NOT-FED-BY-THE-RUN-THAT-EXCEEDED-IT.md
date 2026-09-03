# FUP-E2E-FLAKE-BASELINE-NOT-FED-BY-THE-RUN-THAT-EXCEEDED-IT — plan rule 11's fingerprinted baseline exists, and the last full gate neither fed it nor reconciled against it (owner: lead/tester; filed 2026-08-31 while triaging AE3 readiness)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-31 · status open

⛔ **Not a duplicate of `FUP-E2E-PIN-RECORDS-COUNTS-NOT-IDENTITIES` above, and the distinction is the
point.** That item grades the **instrument** — the summary row records a count, `GATE_LOGDIR` is not
run-scoped, so evidence is destroyed *and* cross-contaminated. This grades the **record**: the mechanism
that item asked for now exists, was demonstrated once, and the next full gate did not use it. Both are
true at once; fixing the instrument does not discharge this, and this is actionable without waiting for it.

**What binds.** `docs/plans/authz-evolution.md` rule 11 makes it a gate requirement of **every** AE phase:
a full run is green only against the **named-flake baseline** (`FUP-E2E-REPEAT-FLAKY`), **not a count** —
and per PA-F16 (ADR [0162](../decisions/0162-authz-evolution-plan-audit-corrections.md)) each entry carries
an **error fingerprint (message/step pattern)** plus an owner and an expiry, so *"a name-matched failure
with a novel fingerprint is a red, not a flake."*

**Three measured facts, 2026-08-31, and they compound:**

1. **The baseline is real and current.** `FUP-E2E-REPEAT-FLAKY` § 2026-08-27 carries **M1**
   (`act-role-assumption.spec.ts:157`) and **M2** (`phase2-auth-shell.spec.ts:268`), each with a
   step-level flake fingerprint, an explicit ⛔ RED-not-flake list, owner **tester**, expiry
   **2026-10-31**. ⭐ So rule 11 is satisfiable, and ⛔ **reading it as "not constructible" is wrong** —
   the mechanism was built at AE1's close. The gap is downstream of the mechanism, which is why no
   tooling change closes it.
2. **Its own OWED half had its trigger fire, unnoticed.** That entry states the **message-pattern** half
   is deliberately owed *"because `e2e:prod` has not run this phase"*, and writes the trigger down:
   **"Fill it in at the next observed occurrence."** AE2's post-drop gate ran 2026-08-28 with **4 flaky**
   — four occurrences — and nothing was filled in.
3. **That run named none of them, and it exceeded the baseline.** `4 flaky` stands at
   `authz-ae2.md:3410` with no spec name beside it, there or in the Test Run Summary section of
   PROGRESS.md (retired 2026-09-03, ADR 0185), in
   `2026-Q3.md`, or in QA r3 (`authz-ae2-review-r3.md:399` records the counts and notes it was not
   re-run). ⛔ **4 > 2:** the baseline has two members, so at least two flakes are unaccounted for even
   **arithmetically** — and `action-items-satellites.spec.ts:609`, flaky at the 2026-08-24 gate, is in no
   baseline entry either. Rule 11's own warning — *"the two pre-existing flakes are a floor, not a
   guarantee"* — describes this run exactly, and went unremarked through the gate and the QA round.

⭐ **The discipline is not missing; it lapsed.** The 2026-08-24 gate row **did** name its three
(`2026-Q3.md:153`, flagged there as the first ever to do so). One gate later it was not repeated, and QA
accepted the counts. ⛔ That is the more dangerous shape: a practice demonstrated once reads as
established, so its absence reads as nothing at all rather than as a regression.

**Owed:**

1. ⛔ **AE3's gate may not record `e2e:prod` green on a count.** Name every flaky spec in the gate row and
   reconcile each against `FUP-E2E-REPEAT-FLAKY` by **fingerprint**, not name.
2. Fill in M1/M2's owed **message-pattern** half from AE3's run — the trigger the baseline set itself.
   ⛔ Do **not** back-fill it from AE2's run: those logs are gone (see the item above), and inventing a
   string nobody observed is the exact defect that condition exists to close.
3. Disposition the **unaccounted** flakes — new members (with fingerprint, owner, expiry), or reds.
   ⛔ Undecidable from AE2's record; only the next run can supply it, which is why this cannot wait.
4. ⚠ **M1/M2 expire 2026-10-31**, and at expiry an entry is root-caused or re-justified in writing, never
   silently renewed. If AE3 is the last full gate before that date, it is also the last cheap chance to
   gather the evidence.

⚠ **A record obligation, not a code change** — nothing to build, no sweep to re-arm. It costs one careful
gate row, and it is worth nothing written after the fact.
