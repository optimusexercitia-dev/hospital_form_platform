# FUP-E2E-AE3-TWO-NOVEL-FLAKES — two names outside the baseline, ONE observation each, disposition UNDECIDED (owner: lead + tester)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-02 · status open

- 🟡 **FUP-E2E-AE3-TWO-NOVEL-FLAKES** — AE3's first full `e2e:prod` (2026-08-31, branch
  `authz-ae3-private-details`) ended `1240 passed · 4 failed · 4 flaky`. **Three of the four
  failures were AE3's own** and were fixed (E2E specs still reading `profiles.cpf` /
  `.date_of_birth` after the columns moved). This item is about the rest, which were **not**
  AE3's and are **not** in `FUP-E2E-REPEAT-FLAKY`'s named baseline:

  **(a) `ethics-e4-participants.spec.ts:1247` — KBD-2, keyboard-only professional lane.**
  Failed BOTH attempts in batch 6: `tabTo: target never received focus via keyboard Tab`
  (helper at `:701`, which throws after its own bounded Tab loop). It then **passed cleanly**
  in a targeted re-run of the same spec minutes later, on the same build.

  **(b) `phase14a-safety-events.spec.ts:543` — AC-8a.**
  `worker process exited unexpectedly (code=3221226505)` — Windows
  `STATUS_STACK_BUFFER_OVERRUN`, i.e. **the browser worker died**, not an assertion failing.
  Passed on retry, so the run counted it flaky rather than failed.

- ⛔ **DELIBERATELY NOT ADMITTED TO `FUP-E2E-REPEAT-FLAKY`.** That baseline has exactly TWO
  members (`act-role-assumption:157`, `phase2-auth-shell:268`), each carrying a step
  fingerprint, an owner and an expiry, and both behaved exactly to fingerprint in this run.
  Plan rule 11 (PA-F16 / ADR 0162) makes the comparison **name + fingerprint**, never a count —
  and the same rule that refuses to call a novel failure a flake also refuses to grow the
  baseline on one sighting. A baseline that absorbs each new name on sight is how a defect
  becomes furniture (the `FUP-E2E-PROF-CREATE-ROSTER-FLAKE` reasoning, applied again).

- ⚠ **(a) is the same SHAPE as both established members** — focus/navigation timing — which is
  a reason to **watch** it, not to merge it. ⛔ It is also a *different* shape from
  `FUP-E2E-PROF-CREATE-ROSTER-FLAKE`, which is a roster-row-after-inline-create in the same
  file: three separate observations in `ethics-e4-participants.spec.ts` do not make one item.

- ⚠ **(b) may not be a test problem at all.** A worker segfault is infrastructure, and this
  suite already carries an `infra` bucket the gate counts separately; that this one landed in
  `flaky` instead of `infra` is itself worth checking before any disposition is written.

- **Entry criteria, stated in advance so the next run can decide without re-litigating:** a
  **second** occurrence of either, with a matching fingerprint, promotes it into
  `FUP-E2E-REPEAT-FLAKY` with its own fingerprint/owner/expiry. Silence across the next two
  full runs closes this item as noise. ⛔ Neither disposition may be taken on the strength of
  this single run — lead + tester

- ⭐⭐ **SECOND RUN, SAME DAY (2026-08-31, after AE3's three real E2E failures were fixed):
  `1251 passed · 0 failed · 0 infra · 5 flaky`. NEITHER (a) NOR (b) RECURRED — and THREE
  DIFFERENT novel names flaked instead**, none of them AE3-relevant:
  `case-patient.spec.ts:433` (builder `collects_patient` toggle) · `ff3-validations.spec.ts:2079`
  (regex rule, submit-time enforcement) · `phase7-cases.spec.ts:539` (AC-HappyPath board).
  The two established `FUP-E2E-REPEAT-FLAKY` members — `act-role-assumption:157` and
  `phase2-auth-shell:268` — flaked in BOTH runs, exactly to fingerprint.

- ⭐⭐ **THIRD RUN, 2026-08-31 (pre-AE4 clearance batch, a DIFFERENT tree): the pattern held a
  FOURTH time, and the one-shot set churned AGAIN with zero overlap.** 5 flaky = the same two
  stable members (`act-role-assumption:157`, `phase2-auth-shell:268`) + **three novel names**:
  `case-corrections:403`, `documents-redesign:518`, `dsr-subject-requests:91`. None overlaps
  AE3's novel set (`case-patient:433`, `ff3-validations:2079`, `phase7-cases:539`).
  ⚠ **The environment reading strengthened**: this run took **4 INFRA re-runs** and
  **6 × `server_dead=1`** (conn_errors 3–48), and ended `GATE_EXIT=5` RED (UNRUN) with 18 tests
  never executed — while recording **0 assertion failures anywhere**. The host was carrying two
  Supabase stacks plus Gotenberg throughout.
  ⭐ **One of the three novel names is an AUTHORIZATION assertion** — `dsr-subject-requests:91`
  (*"a plain member and a platform admin both get 404 on the console"*). Plan rule 11 forbids an
  authorization phase calling a run green while a relevant covered spec failed for an unverified
  reason, so it was **not** waved through on the environment story: all three novel specs were
  in the b2+b5 re-run and came back **0 flaky, 0 failed**. That re-run is the verification;
  the environment reading is the explanation, and they are not the same claim.
  ⛔ **Still NOT admitted to `FUP-E2E-REPEAT-FLAKY`'s baseline** — one observation each, and the
  entry criteria above are unchanged. Recorded because *the churn itself* is now a four-run
  property, which is what the instrument cannot represent.

- ⭐⭐ **THAT PATTERN IS THE ACTUAL FINDING, and it is bigger than these five names.** Across two
  full runs hours apart on the same tree: **2 names are stable and 5 are one-shot**, with zero
  overlap between the two one-shot sets. A churning population is evidence of an
  ENVIRONMENT-level cause (worker scheduling, server restart timing, connection pressure —
  batch 2's own first attempt was classified `server_dead=1, conn_errors=33` and re-run), not of
  five independent per-spec defects. ⛔ **Consequence for the instrument:** plan rule 11 keys the
  comparison on NAME + fingerprint, and a name-keyed baseline cannot represent "any one of ~1250
  tests may flake once per run". Promoting each one-shot name would grow the baseline without
  bound and make it mean nothing; refusing to promote any leaves rule 11 with nothing to say
  about them. **Neither branch of the rule fits, which is a gap in the rule, not a verdict on
  these tests.**

- ⛔ **What this does NOT license.** It is not a reason to call novel flakes acceptable, and it is
  not a reason to widen the baseline. A run with `0 failed` is still green by the gate's own
  definition; the caveat is recorded so the next reader is not told a clean number and left to
  discover the churn themselves. ⚠ **The environment hypothesis is UNTESTED** — it is the shape
  the two samples suggest, not a measured cause, and it must not be cited as one.

- **Owed next:** a third full run's flaky list, to test the churn hypothesis against a third
  sample; and a PO/lead decision on whether rule 11 needs a per-run flake BUDGET (a count-based
  arm) beside its name-based one — lead + tester + PO
