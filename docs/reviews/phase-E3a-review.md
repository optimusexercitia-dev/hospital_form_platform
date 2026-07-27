# QA Review — S5 · ETH·E3a (Ethics terminology/UX surfacing)

**Reviewer:** `qa` · **Date:** 2026-07-27 · **Commits reviewed:** `e61fa3c`..`70fd5ed`
**Baseline:** ARCHITECTURE.md, `docs/phases/ethics-e3-surfacing.md` §4/§6, `docs/progress/eth-e3a-surfacing.md`,
ADR 0072/0073/0079. All catalog claims verified against the **LIVE local catalog** (`pg_proc`/`pg_policies`),
not migration files.

## Verdict: ❌ CHANGES REQUESTED

One **P0** RLS confidentiality hole in the `case_events` visibility model — the `coordinator_only`
narrowing (the phase's own Rule-12 tripwire, plan §6) is **defeated for any non-coordinator
write-grantee**, empirically proven live. Everything else in scope is correct and, notably, the
highest-scrutiny item — `getEthicsDashboard` RLS-scoping — is genuinely load-bearing and non-vacuous
(neutralization-proven). The gate cannot pass until P0-1 is closed and a keystone that fails under
neutralization is added.

**Severity count:** P0 = 1 · MAJOR = 0 · MINOR = 0 · INFO = 3.

---

## P0-1 — `coordinator_only` case-events leak to non-coordinator write-grantees (RLS hole; ADR-0079 reader-non-writer blindness)

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

Blocked on **P0-1**. On fix + a mutation-proven write-grantee keystone (green under `supabase test db` on a
fresh reset) + `tester` re-verification, this returns to APPROVED. No other blocking issues found.
