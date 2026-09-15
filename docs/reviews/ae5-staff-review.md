# AE5 staff — external QA review

**Verdict: CHANGES REQUESTED**

**Date:** 2026-09-15  
**Reviewed commit:** `cea431c7`  
**Comparison baseline:** `a02487bc`  
**Scope:** the four AE5 staff migrations, their live policies and function call chains, generated authorization vectors, suites 424–427, and the recorded acceptance claims. Application TypeScript is unchanged in this comparison.

## Summary

The functional work has substantial coverage, but the new list authorization path repeats an expensive permission lookup for every protected row. A warmed, three-run comparison measured **4.71× the median execution time** of the former membership check. The repository already contains a statement-scoped resolver that avoids this multiplication.

There are also two concrete QA defects: the grant-deletion suite remains green with a voting authorization guard disabled, and its signing fixture can select an unrelated, ineligible attendee. These are coverage and reproducibility findings; this review did **not** establish a new exploitable authorization bypass in the committed implementation.

| ID | Priority | Finding |
| --- | --- | --- |
| F1 | P1 | Batch reads pay the catalog authorization cost once per row |
| F2 | P2 | The write-path grant-deletion coverage does not prove enforcement |
| F3 | P2 | The signing differential selects an arbitrary attendee instead of its seeded fixture |

P1 should be resolved before sign-off. F2 needs behavioral coverage or an explicit narrowing of AC-7's claimed scope. F3 has an existing deterministic fixture and should be corrected directly.

## F1 — P1: Compute the permission scope set once for batch reads

**Locations:** `supabase/migrations/20261003007470_ae5_staff_t7_rekey.sql:516–545`, especially the `form_items_select` substitution at **524–525**; roster substitutions at **620–637**; analogous commission-keyed read policies throughout Part 2.

The new predicates call `app.can_forms_read(commission, uid)` and the other scalar domain authorizers with a row-dependent scope. Each call enters:

```text
domain authorizer
  -> authz.has_permission
     -> authz.entailed_grants
        -> authz.assignment_facts
        -> role / permission / implication-closure joins
        -> authz.scope_reaches
```

Wrapping `auth.uid()` in a scalar subquery only reuses the caller ID. It does not reuse the permission result. Live plans retain the authorizer in the row filter, and function statistics confirm repeated execution even when every row belongs to the same commission.

### Measured evidence

PostgreSQL 17.6, local database `supabase_db_azkbbhskturikxpgmafq`, migration head `20261003007470`. One active staff principal, one permitted commission, 1,000 repeated scope IDs from `unnest(array_fill(...))`. Every variant returned 1,000. All variants were warmed before three sequential comparison rounds in one session, with `EXPLAIN (ANALYZE, BUFFERS, TIMING OFF)` and session-local `track_functions=all`.

| Path | Run 1 | Run 2 | Run 3 | Median | Shared buffer hits per statement |
| --- | ---: | ---: | ---: | ---: | ---: |
| Former `app.is_member_of(id)` | 142.588 ms | 140.722 ms | 156.276 ms | 142.588 ms | 5,000 |
| New `app.can_forms_read(id, uid)` | 633.629 ms | 671.886 ms | 732.802 ms | 671.886 ms | 23,000 |
| Existing `authz.authorized_scope_ids` with set membership | 1.691 ms | 1.575 ms | 1.586 ms | 1.586 ms | 32 |

The new scalar path is **4.71× slower at the median**, with **4.6× the buffer hits**. The set-based comparison uses the same catalog permission authority. Its plan builds the scope set once (`ProjectSet`, `loops=1`) and joins the repeated IDs against it.

Actual RLS queries corroborate the invocation pattern:

- Reading the ten options of seeded form version `50000000-0000-0000-0000-00000000a001` as `authenticated` called `can_forms_read` ten times. The plan uses `form_item_options_version_idx`, then applies the permission function in its filter.
- Reading the 45-row `profiles` table as that staff principal returned 12 rows and called `can_roster_read` **117 times**. The membership subquery inside the profile policy also receives `memberships_select` RLS; commission joins receive commission RLS. The new scalar check is repeated within that existing nested policy structure.

**Bounds:** the timing table isolates authorization over synthetic repeated IDs; it is not an end-to-end page benchmark or a production latency prediction. The actual RLS measurements used the existing post-E2E local dataset. Other form and roster policy costs predate AE5. The regression attributable to AE5 is routing those repeated checks through the more expensive catalog chain.

### Required change

Use narrow, caller-bound, fixed-permission set-returning authorizers for batch policy paths, backed by the existing `authz.authorized_scope_ids`. Its generic API currently has no `authenticated` EXECUTE grant; preserve that boundary and follow the narrow wrapper pattern already used by `app.current_professional_read_organizations`.

Keep resource-specific restrictions and approved independent grant paths in their proper positions. In particular, a scope-set optimization must still enforce meeting visibility, case exclusions, and targeted-access semantics. Reuse the permission answer within a statement; recompute it on the next statement so revocations remain effective.

Add a staff-specific performance acceptance on the final policy paths: form items/options, roster reads, and a commission list. Measure growing protected-row counts with fixed caller assignments, both grant polarities, and record function counts and plans. Require permission resolution to scale with distinct scopes rather than protected rows. Keep scalar authorizers for genuinely scalar checks.

**Basis:** the user's explicit lookup-performance requirement. ADR 0182 and migration `20261003007320` already document and solve this same invocation problem on another surface. Their prior acceptance is not evidence that the newly converted staff surfaces are fast. The relevant membership and catalog indexes already exist; the actionable issue is repeated execution. Supabase likewise documents statement-level reuse of row-independent RLS work in its [RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security).

## F2 — P2: Exercise permission withdrawal through the actual write doors

**Locations:** `supabase/tests/425_ae5_staff_rekey_differential.sql:399–400`, **492–495**, and **927–955**. The voting guard being audited is at `supabase/migrations/20261003007470_ae5_staff_t7_rekey.sql:1226`.

Suite 425 deliberately returns NULL for:

- `responses_insert_own` and `meeting_signatures_insert`;
- `cast_case_vote`, `create_referral_internal_note`, `notify_safety_event`, `get_referral_case_access_summary`, and `sign_meeting`.

The function-side static checks then assert that the permission-code literal is **absent** from the caller's body. Absence is expected because the code lives in its callee, but it proves nothing about whether the caller actually enforces that callee's answer. It cannot replace an allow/delete-grant/deny/restore/allow experiment through the operation itself. The candidate oracle also explicitly excludes the voting guard and points to T12 for that coverage (`424`, final assertion).

### Mutation witness

First, I pinned only the attendee selection in an in-memory copy of 425 to remove F3. That copy passed **21/21**.

Then, inside a transaction that was rolled back, I changed the live voting guard from:

```sql
if not app.can_cases_vote(v_commission, auth.uid()) then
```

to:

```sql
if false and not app.can_cases_vote(v_commission, auth.uid()) then
```

The same fixture-corrected suite again passed **21/21**, with no SQL errors. The permission call remains visible in the body, while its refusal branch cannot execute. No vote was submitted by this experiment. The committed function was restored by rollback and its body was checked afterwards.

**Bound:** this establishes a blind spot in suite 425, not that every other project gate would accept this mutation. It also does not claim that the committed guard is disabled.

### Required change

Add transactionally isolated behavioral probes for the skipped operations. Each must establish a valid operation with the grant present, remove only the relevant role-permission row, verify authorization denial through the real policy/RPC, restore the grant, and verify success again. Assert database effects and audit effects as applicable. Use separate rollback-safe operation attempts so duplicate votes or signatures do not impersonate authorization denial.

**Basis:** AC-7 says the grant-deletion differential flips every policy door in both polarities. The current suite does not fulfill that clause for the two INSERT policies. The declared writer exclusions are honest documentation, but their negative literal checks provide materially weaker assurance than the surrounding acceptance language suggests.

## F3 — P2: Bind the signing test to the existing valid attendee

**Location:** `supabase/tests/425_ae5_staff_rekey_differential.sql:175–178`.

`f425r.attendee_id` selects the first attendee belonging to the staff principal in CCIH, with `LIMIT 1`, no ordering, and no attendance or meeting-status condition. `app.can_sign_meeting` requires **attendance = present** and **meeting status = in_signature**. The fixture query does not establish either precondition.

On the existing local stack following E2E work, it selected attendee `60c5e4ef-19a6-404f-86f7-29d67c53d4e2`, whose meeting was `held` and whose attendance was `summoned`. The guard correctly returned false. Suite 425 consequently produced:

```text
not ok 11: baseline granted sites — have 53, want 54
not ok 13: sites failing to discriminate — have 1, want 0
```

The intended seeded attendee, `a5f30000-0000-0000-0000-0000000000a2`, was present simultaneously, with `present` / `in_signature`. Adding that identity constraint to the fixture query in memory made all **21/21** assertions pass, without changing any permission or production function.

### Required change

Bind this fixture to that dedicated seeded attendee and assert its signer, commission, attendance, and meeting status before the differential. Apply the same review to the other unconstrained `LIMIT 1` selections in `f425r`: their business preconditions should be explicit.

**Bound:** the declared full DB gate requires a fresh reset. This failure was reproduced on the existing post-E2E stack and does not contradict the recorded fresh-reset pass. It demonstrates that a routine scoped re-run can report an authorization regression because it selected unrelated test data. A dedicated fixture already exists, so this ambiguity is unnecessary.

## Additional performance debt: Skip an impossible case member arm

At `supabase/migrations/20261003007470_ae5_staff_t7_rekey.sql:699–702`, `_case_caps` eagerly computes `v_member` using the new catalog authorizer before checking `not v_eg` at the S5 grant. For `explicit_grants_only` cases, this permission result cannot contribute a capability.

A read-only function-counter probe made 100 `_case_caps` calls for active, non-excluded staff principal `00000000-0000-0000-0000-000000000004` on locked case `ca000000-0000-0000-0000-0000000000e1`. All returned capability mask 0. It nevertheless made **100 calls to `can_cases_deliberation_read_in_commission`**. Those calls accounted for approximately 92 ms within approximately 227 ms of total `_case_caps` time in that diagnostic run; nested timings are inclusive.

Compute the S5 membership permission only when `not v_eg`. Prove that the capability mask remains unchanged for locked cases, including cases with explicit grants, and verify zero calls to that sibling authorizer for the locked branch. The eager evaluation order predates AE5; replacing its inexpensive membership predicate with the catalog resolver amplifies the cost. This is an additional optimization opportunity, not a newly introduced control-flow defect.

## Verification and limitations

| Check executed independently | Result |
| --- | --- |
| Matrix generator self-test and `--check` | Passed |
| Differential generator self-test and `--check` | Passed; generated output in sync, 4,788 total cells |
| Suite 424 | 23/23 passed; 3,060 staff cells loaded |
| Suite 425, unchanged | 19 passed / 2 failed, localized to F3 |
| Suite 425, in-memory attendee pin only | 21/21 passed |
| Suite 425, same attendee pin plus disabled voting guard | 21/21 passed, demonstrating F2 |
| Suite 426 | 38/38 passed |
| Suite 427 | 12/12 passed |
| Warmed old/new/set lookup comparisons | Three rounds; F1 table above |
| Live RLS plans and session-local function counters | Form, profile, and locked-case paths inspected |
| Post-audit state | Voting mutation absent; staff and staff_admin authoritative; 20 staff permission grants retained |

The pgTAP extension and test helpers were installed inside each suite's outer transaction and rolled back with it. The first 424 attempt lacked pgTAP and aborted before assertions; the corrected run supplied it transactionally and passed. TAP failures were counted explicitly: `psql` exit 0 alone does not establish a passing suite.

No reset was performed, no application code was edited, and no persistent database change was made. The separate `*_escalume` stack was left untouched. The full 9,231-test DB run and 1,268-passing E2E declaration were reviewed as recorded evidence and were not independently rerun in this audit. No production workload or remote database was measured.

Previously documented risks remain distinct from these findings: role-free access surviving account deactivation; response ownership surviving membership revocation; the hard-deny closure check's inability to prove dominance over every OR branch; deferred offboarding expectations; and the caller-less staff wrapper under its recorded deferral. This review does not relabel accepted exceptions as newly discovered regressions or treat them as resolved.

### Reproduce the lookup comparison

Run as an auditor with access to the private helpers on the local fixture. Repeat the three EXPLAIN statements after warming all three paths. No mutation is required.

```sql
begin read only;
set local statement_timeout = '15s';
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated","active_role":"staff"}', true);

explain (analyze, buffers, timing off)
select count(*)
from unnest(array_fill('a0000000-0000-0000-0000-0000000000a1'::uuid, array[1000])) c(id)
where app.is_member_of(c.id);

explain (analyze, buffers, timing off)
select count(*)
from unnest(array_fill('a0000000-0000-0000-0000-0000000000a1'::uuid, array[1000])) c(id)
where app.can_forms_read(c.id, (select auth.uid()));

explain (analyze, buffers, timing off)
select count(*)
from unnest(array_fill('a0000000-0000-0000-0000-0000000000a1'::uuid, array[1000])) c(id)
where c.id in (
  select authz.authorized_scope_ids(
    (select auth.uid()), 'commission', 'commission.forms.read')
);
rollback;
```
