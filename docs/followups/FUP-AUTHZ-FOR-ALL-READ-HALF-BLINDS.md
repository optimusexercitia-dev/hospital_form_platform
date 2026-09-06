# FUP-AUTHZ-FOR-ALL-READ-HALF-BLINDS — the `FOR ALL` policies whose read half no keystone exercises, disclosed by ADR 0191 D4 and owed a keystone each

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-05 · status open

**What this is.** ADR 0191 D4 made the door arm's policy sweep open `using (true)` **alone** on a
`FOR ALL` policy, instead of opening `using` and `with check` together. The change is **strictly
weaker**, so the only verdict movement it can produce is **COVERED → BLIND**, bounded by the 51
COVERED `(ALL)` rows in the committed baseline.

⛔ **Each flip is a FINDING, not a regression.** The policy is unchanged; what changed is that the
verdict now says what it always should have said. A row that flips was a `FOR ALL` policy whose
**read** half no keystone exercises, and whose COVERED was earned by a **write** keystone — the
mirror-ambiguity `FUP-DOOR-AUDIT-ALL-POLICY-COVERED-IS-MIRROR-AMBIGUOUS` named. ⛔ **A flipped row
is never relabelled to keep it COVERED** (PO ruling, 2026-09-05); it is disclosed here and
keystoned as its own increment.

**How to read the work-list.** Each row carries:

- **policy** — `table.polname (ALL)`, the key `p0-authz-invariant.sh`'s `verdicts_from_findings`
  uses, so a census arm can still find it.
- **write-half fixture** — the pgTAP file(s) named in column 5 of the row's **previous** COVERED
  verdict. Those files reddened when BOTH halves were open, so at least one of them exercises the
  policy's write half. They are the starting point for the read-half keystone, not the answer:
  ⚠ a file that reddened on the write half may have no read assertion in it at all.
- **what a read-half keystone must assert** — a SELECT through the policy that returns rows for a
  principal the `using` qual admits and **zero rows** for one it does not, with the discrimination
  half explicit. ⛔ Not "the query succeeds": a `FOR ALL` policy's `using` clause also gates the
  rows `UPDATE`/`DELETE` can see, so an assertion that only counts rows for the permitted principal
  passes with the qual opened to `true`, which is precisely the state this sweep constructs.

## The work-list — MEASURED, 2026-09-06, from the one full run (353 cases, 12 h 17 m)

> ⛔ **CORRECTION, 2026-09-06 later the same day (unit PRED-DOMAIN, ADR 0191 D8).** Left beside the
> paragraphs below rather than rewriting them, because what they say is what was measured — and the
> RUN they were measured from is **partly void**. Its last 79 cases all read `Files=262, Tests=8470`
> with the identical nine aborting files (tail drift, proven: those cases re-run on a fresh reset
> come back COVERED at the true shape). ⛔ **"Exactly FIVE" is a FLOOR, not a count**, and
> **"zero SELECT rows flipped" is a statement about 274 of 353 cases**:
>
> - **16 `(ALL)` policies that were COVERED in the committed baseline sit UNMEASURED in the void
>   tail** — `interview_sessions_write`, `organizations_admin_write`, `phase_results_…`, five
>   `process_template*_…`, six `rca_*_write`, two `response_group_instances_…`. Every one of them
>   is a candidate flip this run could not see, so the true bound today is **5 ≤ n ≤ 21**.
> - **56 further SELECT rows are in the same void tail**, so the "zero SELECT rows flipped"
>   discrimination holds over the run's clean prefix only.
>
> The five rows below are **not** in doubt: they are at ordinals 152–160, deep in the clean prefix,
> and their keystone specs stand. What is deferred is the CLAIM OF COMPLETENESS — settled by run 2,
> which sweeps with `RESET_EVERY` bounding the drift. ⚠ *Absence of a verdict is not absence of
> coverage*: an unmeasured `(ALL)` row is neither COVERED nor a flip, and must not be counted as
> either.

**Exactly FIVE rows flipped**, against a bound of 51, and the result is tighter than the bound in
two ways worth stating:

- ⭐ **All five COVERED → BLIND transitions in the entire run are `(ALL)` policies.** Zero SELECT
  rows flipped. That is the discrimination the 12-case subset could not produce — the fix is
  strictly weaker, so only `FOR ALL` rows *can* move, and only `FOR ALL` rows *did*.
- ⭐ **All five are the CAPA module's write policies, and all five were covered by the SAME file**,
  `252_authz_p0_isolation.sql`. This is one coherent gap, not five scattered ones: that file
  exercises the CAPA write path and nothing anywhere exercises the CAPA read path.

⚠ A sixth `(ALL)` row was BLIND in the baseline already (7 BLIND `(ALL)` rows this run vs 5 flips),
and **18 further `(ALL)` rows went COVERED → NOTICED** — those are *unclassifiable*, not flipped,
and they are not work items here; they belong to `FUP-DOOR-SWEEP-BROAD-GATE-ABORTS-A-FILE`'s class.

| policy | previous verdict + write-half fixture | what a read-half keystone must assert |
| --- | --- | --- |
| `capa_action_evidence.capa_action_evidence_write (ALL)` | COVERED via `252_authz_p0_isolation.sql` | `using` = `app.can_write_capa((select ca.capa_id from capa_action ca where ca.id = capa_action_evidence.action_id), auth.uid())`. A SELECT on `capa_action_evidence` must return the rows of a CAPA the caller may write **and zero rows** for a CAPA it may not — the denial half is the load-bearing one |
| `capa_action_task.capa_action_task_write (ALL)` | COVERED via `252_authz_p0_isolation.sql` | same shape, joined through `capa_action.action_id` |
| `capa_effectiveness.capa_effectiveness_write (ALL)` | COVERED via `252_authz_p0_isolation.sql` | `using` = `app.can_write_capa(capa_id, auth.uid())` — the direct form; assert a foreign CAPA's effectiveness rows are **invisible**, not merely un-writable |
| `capa_measure.capa_measure_write (ALL)` | COVERED via `252_authz_p0_isolation.sql` | `using` = `app.can_write_capa(capa_id, auth.uid())`, as above |
| `capa_measure_result.capa_measure_result_write (ALL)` | COVERED via `252_authz_p0_isolation.sql` | same shape, joined through `capa_measure.measure_id` |

⛔ **The trap these five share.** `app.can_write_capa` gates BOTH halves of each policy, so an
assertion that merely *reads back rows the caller may write* passes identically with the `using`
clause opened to `true` — which is the exact state the sweep constructs. Each keystone therefore
needs the **denial** half: a principal for whom `can_write_capa` is false must see **zero rows**.

## Closes when

Every row above has a keystone that **fails when the policy's `using` half is opened to `true`**,
proven by re-running the door arm's case for that policy and observing the verdict move BLIND →
COVERED. ⛔ Not closed by adding assertions and reading a green suite: a keystone that does not move
this arm's verdict is the vacuity this whole program exists to catch. ⛔ Not closed by the write
arm's coverage of the same policy — that is the ambiguity being separated.

## Related

- ADR [0191](../decisions/0191-the-door-arms-domain-gains-a-schema-axis-a-targeted-home-and-a-fourth-outcome.md) D4 / D4a / D4b
- `FUP-DOOR-AUDIT-ALL-POLICY-COVERED-IS-MIRROR-AMBIGUOUS` — the follow-up D4 closes
- ADR [0079](../decisions/0079-authz-door-blindness-standing-invariant.md) — a green arm bounds its
  own domain
