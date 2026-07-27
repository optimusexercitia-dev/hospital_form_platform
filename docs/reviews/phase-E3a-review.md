# QA Review — S5 · ETH·E3a (Ethics terminology/UX surfacing)

**Reviewer:** `qa` · **Date:** 2026-07-27 · **Commits reviewed:** `e61fa3c`..`70fd5ed`
**Baseline:** ARCHITECTURE.md, `docs/phases/ethics-e3-surfacing.md` §4/§6, `docs/progress/eth-e3a-surfacing.md`,
ADR 0072/0073/0079. All catalog claims verified against the **LIVE local catalog** (`pg_proc`/`pg_policies`),
not migration files.

## Verdict: ✅ APPROVED (r2, 2026-07-27)

**r1 (2026-07-27): CHANGES REQUESTED** — one P0 RLS confidentiality hole in `case_events`.
**r2 (2026-07-27): APPROVED** — P0-1 fixed at `a64e61a` (migration `20260827000400`) and
independently re-verified live (see the re-review box below). No write-authority regression from the
policy split. Full pgTAP 3852 PASS on a fresh reset. The 3 INFO items ride as non-blocking follow-ups.

**Severity count (r1):** P0 = 1 · MAJOR = 0 · MINOR = 0 · INFO = 3. **All blocking issues resolved in r2.**

---

## r2 re-review — P0-1 fix independently confirmed (2026-07-27)

The backend applied the recommended reader-non-writer split: both `case_events` `FOR ALL` write policies
were dropped and recreated as command-specific `INSERT`/`UPDATE`/`DELETE` policies (each `USING`/`WITH
CHECK` preserved), so **`case_events_select` is now the sole SELECT authority**. I verified against the
LIVE catalog + live fixtures (not the backend's self-report):

1. **P0 closed, live.** Write-grantee fixture (`can_write=true`, `is_staff_admin=false`,
   `is_commission_admin=false`): `coordinator_only` events visible = **0** (was 1); the `case_readers`
   event still visible = **1** (`can_write ⊆ can_read` via `_select`, no over-narrowing).
2. **Keystone non-vacuous — reproduced independently.** Re-creating the pre-fix un-narrowed arm
   (`create policy … for all using (app.can_write_case_content(case_id, auth.uid()))`) makes the same
   write-grantee see the `coordinator_only` event again (**count 1 → the keystone goes RED**); dropping it
   restores **0**. 267's own new keystones #14-17 (`plan(24)`) encode this same mutation and pass in-suite.
3. **No write-authority regression (the split's new risk).** `pg_policies` post-fix: **SELECT =
   `case_events_select` only**. INSERT = `_staff_admin_insert` (WITH CHECK `is_staff_admin AND NOT
   excluded`) + `_writer_insert` (WITH CHECK `can_write AND (visibility='case_readers' OR staff_admin OR
   commission_admin)` — the `coordinator_only` insert-gate preserved, 268 green). UPDATE/DELETE
   `_staff_admin_*` + `_writer_*` preserve the prior FOR-ALL `USING`/`WITH CHECK` verbatim. Every prior
   write path is intact.
4. **Full suite green.** `supabase test db` on a fresh reset: **Files=135, Tests=3852, PASS** (+4 vs r1 =
   267 #14-17).

---

## P0-1 — `coordinator_only` case-events leak to non-coordinator write-grantees (RLS hole; ADR-0079 reader-non-writer blindness) — ✅ RESOLVED r2 (`a64e61a`)

**Requirement violated:** plan §4 acceptance #4 ("a `coordinator_only` event is invisible to a
granted-but-non-coordinator reader"); plan §6 Rule-12 tripwire ("any implementation that could be
misread as a grant … is a Rule-12 regression"); ADR-0079 standing invariant (a `FOR ALL` policy's
`USING` **is** a read policy).

**Root cause (catalog).** `case_events` has three permissive policies. Permissive policies for the same
command are **OR-ed**, and a `cmd=ALL` policy's `USING` participates in **SELECT**:

| policy | cmd | USING |
|---|---|---|
| `case_events_select` | SELECT | `can_read_case AND (visibility='case_readers' OR is_staff_admin_of OR is_commission_admin_of)` |
| `case_events_staff_admin_write` | **ALL** | `is_staff_admin_of AND NOT is_case_excluded` |
| `case_events_writer_write` | **ALL** | `app.can_write_case_content(case_id, auth.uid())` |

The effective SELECT predicate is the OR of all three. `case_events_writer_write.USING` is bare
`can_write_case_content(...)` with **no visibility clause**, so it re-admits every event — including
`coordinator_only` — to anyone with a content-**write** grant. `case_events_select`'s careful
narrowing is bypassed. (Before E3a there was no `visibility` column, so this FOR-ALL read-arm was
harmless; E3a added the narrowing to `_select` but did not close the write policy's read-arm.)

**Live proof (local stack, `set local role authenticated`).** Fixture: an `explicit_grants_only` ethics
case with one `coordinator_only` `vote_cast` event; `st_x` given a **write** grant (not staff_admin):

```
can_write_case_content(st_x) = true
AS st_x: is_staff_admin_of = false   is_commission_admin_of = false
LEAK CHECK: coordinator_only events visible to WRITE-grantee non-coordinator = 1   <-- should be 0
```

The bypass arm is definitively `case_events_writer_write` (st_x is not staff_admin; the `_staff_admin_write`
arm is false). **All four E3a pgTAP files miss this** because 266/267 test only *read*-grantees
(`grant_ca(..., 'read', ...)`), whose `can_write_case_content` is false, so the write arm never fires; 268
tests the write **CHECK** gate (insert) but never a write-grantee's **SELECT** of a `coordinator_only` row.

**Impact / mitigation.** The two `coordinator_only` kinds are the deliberation-sensitive `finding_recorded`
and `vote_cast`. The auto-derived bodies are PHI-free templates (verified — see below), so the *currently*
leaked payload is milestone metadata ("a vote was cast"), not the vote/finding value. But the confidentiality
**mechanism** is structurally broken: it fails open for a realistic ethics persona (a write-granted
investigator who is not the coordinator), and any future `coordinator_only` content trusted to this gate
leaks. This is an access-spine defect in a Rule-12 phase, hence blocking.

**Fix direction (engineers; not prescriptive on shape).** Make the `coordinator_only` narrowing hold across
**every** policy that grants SELECT. Either (a) split `case_events_writer_write` into a write-only policy
(`FOR INSERT/UPDATE/DELETE`) so its `USING` no longer serves SELECT, leaving `case_events_select` the sole
SELECT authority; or (b) append the same visibility clause to the writer policy's `USING`. Then add a pgTAP
keystone: *a non-coordinator **write**-grantee sees 0 `coordinator_only` events*, and **mutation-prove it**
(neutralize the new clause → the keystone goes RED). Re-verify by `tester`.

---

## Positively verified (evidence, not assertion)

- **`getEthicsDashboard` RLS-scoping is real and load-bearing (the crux).** The reader
  (`src/lib/queries/ethics-dashboard.ts`) issues only ordinary `authenticated` `createClient()`
  `.from().select()` reads — no service-role, no `.rpc()` to a DEFINER (`server.ts` uses the anon key).
  The three source tables each have **exactly one** SELECT policy, all gating `app.can_read_case(case_id,
  auth.uid())`, and **no FOR-ALL read-arm** (writes are DEFINER-only) — so the dashboard scoping is airtight,
  unlike `case_events`.
  - **Neutralization-oracle:** redefining `app.can_read_case → true` and re-running 269's exact respondent
    `totalCases` query returns **3** (== coordinator), vs. **1** when scoped — i.e. 269's respondent/recused
    keystones go RED under neutralization. The scoping is the load-bearing filter; the keystones are
    **non-vacuous**.
- **Keystone-vacuity re-audit.** 266 isolates the respondent-deny by *also granting* the respondent read
  (so C3 tests the exclusion, not a missing grant — the backend's self-caught fix is real). 267
  mutation-proves both `coordinator_only` keystones in-file (flip → visible, revert → hidden). 268 proves the
  write **CHECK** gate (42501 for a non-coordinator `coordinator_only` insert). None pass by construction.
  *The one gap is coverage, not vacuity:* none exercise a write-grantee's SELECT (→ P0-1).
- **Rule 12 — auto-derived bodies PHI-free.** 267 feeds the `SEGREDOXYZ` token through every free-text arg
  of all 8 RPCs and asserts no emitted `body` contains it; bodies carry only controlled enums/catalog
  `display_name`. Full ordered pgTAP suite: **Files=135, Tests=3848, Result: PASS**.
- **Type-inheritance (O-1).** 268 proves processless `create_case` with the ethics type inherits
  `visibility_policy = explicit_grants_only` + `confidentiality_level = ethics_investigation`; a type-less
  case stays `commission_default` (byte-for-byte). `cases.case_type_id` FK confirmed additive/nullable.
- **Terminology resolver.** `getCaseTypeTerminology` is a fail-safe authenticated read (null / unreadable /
  missing `term_key` → platform default, never throws). `case_type_terminology`/`case_types` SELECT gate on
  `is_org_member OR is_admin` (org-config UI labels, non-PHI, non-case-content) — correct; FE renders
  `terminology.case.singular` on the detail heading + `terminology.primarySubject.singular` on the
  primary-subject panel (acceptance #1).
- **8 E2 RPCs remain `SECURITY DEFINER`** with the `case_events` insert added; the insert cannot leak PHI
  (controlled templates) and visibility-per-kind matches the O-3 mapping (267).

---

## INFO (non-blocking)

- **INFO-1** — `src/components/cases/case-events-timeline.tsx` (~L93-95) comments *"RLS never delivers a
  `coordinator_only` row to a non-coordinator, so the badge is a visibility cue, not a second gate."* This
  is falsified by P0-1 for write-grantees; it becomes true again once P0-1 is fixed. No code change beyond
  the P0 fix, but re-confirm the comment holds afterward.
- **INFO-2** — `src/components/cases/case-detail-view.tsx` (~L326-327) comment claims the frozen contract
  "does not project `primary_subject_kind` onto `CaseDetail`", yet L343 reads `detail.primarySubjectKind`.
  Stale comment; harmless.
- **INFO-3** — Audit (acceptance #9): I agree no new `log_audit_access` verb is needed for the dashboard /
  terminology reads. They are aggregate reads over `can_read_case`-gated **non-PHI** process tables
  (`ethics_case_details`/`case_decisions`/`ethics_decision_details` are not among the three Class-1 PHI
  modules) plus org-config labels; per-case detail reads are audited at their own doors (mirrors E2 D11).

---

## Gate status

**APPROVED (r2).** P0-1 fixed and independently re-verified (leak closed live, keystone mutation-proven
non-vacuous, no write-authority regression, full pgTAP 3852 PASS). No other blocking issues. INFO-1/2/3
ride as non-blocking follow-ups. Cleared for the lead's `e2e:prod` suite-green declaration + human approval.
