# QO·A Review — Quality-office oversight, Phase A (ADR 0100 D1–D11)

**Reviewer:** `qa` · **Date:** 2026-08-07 · **Branch:** `feat/quality-office-oversight` @ `9bb789b`
**Scope:** ADR [0100](../decisions/0100-quality-office-oversight.md) **Phase A only** — D1–D11.
D12/D13/D14 (Phases B/C) are out of scope and were not audited.

# VERDICT: ⛔ CHANGES REQUESTED

One blocker (**B1**), two majors (**M1**, **M2**), three minors. The blocker is a
**D7 breach**: three `authenticated`-executable SECURITY DEFINER **write** doors gate on
`app.can_read_case` alone, which the S7 arm now satisfies — so the quality reviewer can
write into a committee's case, today, on the seeded data.

Everything else in this phase is unusually strong, and I say so with detail in §5. The
blocker is not a quality problem; it is a **scope-of-enumeration** problem, and it is
BUG-QO-001 repeated one layer up.

---

## 0. Evidence discipline — what is verified, read, and inferred

This phase has repeatedly punished inference reported as verification. Every claim below
carries its provenance.

| Marker | Meaning |
|---|---|
| **[CAT]** | Read from the **live catalog** (`docker exec supabase_db_azkbbhskturikxpgmafq psql`) on 2026-08-07, before the reset noted in §6. `pg_proc` (incl. `prosecdef`, `proacl`, `proconfig`), `pg_policies` (**both `qual` and `with_check`**), `pg_constraint`, `pg_trigger`, `information_schema.*_privileges`, plus read-only evaluation of predicates against seeded principals. |
| **[SRC]** | Read in the repository working tree (source, migrations-as-text, tests, plans). Migration text is **not** treated as truth for schema facts. |
| **[INF]** | Reasoned, not observed. Called out explicitly every time. |

**Stack constraint honoured in full.** I ran **zero** mutating statements — no INSERT /
UPDATE / DELETE, none inside a transaction, no `db reset`, no `supabase test db`, no
mutation harness, no Playwright, no dev server, no migration apply. §6 lists exactly what
that cost this review.

---

## 1. BLOCKER

### B1 — D7 is breached: three write doors gate on `can_read_case`, which S7 now satisfies

> **Requirement violated — ADR 0100 D7:** *"Strictly read-only (Phase A). No write
> capability, no new write doors — the exclusion-perimeter family stays closed."*
> **and D10:** *"Write affordances hidden by role; **the DB arm is the boundary**."*
> **and Architecture Rule 1:** *"RLS is the security boundary … never rely on UI hiding."*

The threading analysis (plan §A.2, buildnotes §2–4) enumerates every arm that must
**change**. It has no axis for *"which existing doors consume the bit we are about to
confer."* Three of them are writes.

**[CAT]** — all three are `SECURITY DEFINER`, all three carry `authenticated` EXECUTE, and
in all three the **only** authority predicate is `app.can_read_case`:

| Door (`public.`) | Authority expression, verbatim from `pg_get_functiondef` | Writes |
|---|---|---|
| `file_correction_request(text,uuid,uuid,text,text,uuid)` | `-- Authority: any case-content reader may file.`<br>`if not app.can_read_case(v_case_id, auth.uid()) then raise … '42501'` | `case_correction_requests` |
| `declare_conflict(uuid,text,text)` | `-- Self-service: any case READER may declare their OWN conflict.`<br>`if not app.can_read_case(p_case_id, auth.uid()) then raise … 'P0002'` | `case_conflict_declarations` |
| `record_recusal(uuid,uuid,text,uuid)` | `if not (v_is_coord_raw or app.can_read_case(p_case_id, auth.uid())) then raise … 'P0002'`, then `if p_user_id = auth.uid() then v_source := 'self'` | `case_recusals` (+ `case_conflict_declarations` UPDATE) |

**[CAT] The reviewer satisfies that gate on live seeded data.** Read-only probe as
`postgres`, passing the uid explicitly (no role switch, no mutation):

```
quality.a@test.local on the 5 seeded CCIH cases:
  can_read_case = t · _case_caps = 5 · can_read_case_patient = f
  has_case_capability(…,'read_case_deliberation') = f · is_case_excluded = f · is_active = t
```

**[CAT] It is not hypothetical for `file_correction_request`** — the flag is on and targets
exist:

```
app.feature_flags: case_corrections = t   (also case_participants = t)
completed phase targets, with an assignee, on non-terminal reviewer-readable CCIH cases: 7
```

Walk the rest of that door's body against a reviewer **[CAT]** for the gate predicates,
**[INF]** for the arithmetic of the business rules: `assert_not_case_excluded` passes
(reviewer is neither respondent nor recused), `is_active` passes, case status is not
terminal, target status is `completed`, no open request exists, reason is non-empty, and
`v_corrector := v_assignee` — an assignee who is by construction a member with
`can_read_case`, so the `HC0M4` check passes. **The write lands.**

**Failure scenario.** A hospital quality reviewer — a principal ADR 0100 defines as holding
no membership, no write capability, and no standing in the committee — opens the browser
console on a case page they legitimately read and calls
`supabase.rpc('file_correction_request', …)`. A completed phase of an active CCIH case
enters the correction workflow, the assignee is designated corrector, and
`case_correction.requested` is written to the hash-chained audit trail **attributed to the
reviewer**. The committee sees a correction demand from outside itself. Nothing in the
platform refuses it. The same principal can file a conflict declaration and a self-recusal
into the committee's registers by the same route.

**Nothing in the estate would notice.** **[SRC]** — I grepped the five new pgTAP suites, the
`q1` audit, `e2e/quality-oversight.spec.ts`, both plan documents and PROGRESS.md for
`file_correction_request` / `declare_conflict` / `record_recusal`: **zero hits.** The
assertion that *reads* like the D7 pin is vacuous with respect to these doors:

```sql
-- 308_case_caps_s7.sql:106
select ok(not app.can_write_case_content(…),
  '1.4 strictly read-only (D7): no write bit');
```

`can_write_case_content` projects `write_case_content`. **None of the three doors consults
that bit.** 1.4 would still pass with all three doors wide open — it is a
green-for-the-wrong-reason assertion sitting exactly where a reader looks for the D7 proof.

**The frontend saw one third of this and said so.** `case-detail-view.tsx` L313 and the
frontend plan §3 row 2 both name `correctionCaps.canFile` a live write and a D7 breach, and
suppress it — in the UI. That is the correct UI change and it is **not** the boundary; D10
and Rule 1 both say so in as many words. Rows 1 and 2 of that matrix were closed in the UI;
the *doors behind them* were never examined.

**[CAT] Scope check, so the ask is precise.** I re-ran the policy sweep over `with_check` as
well as `qual` (my first pass looked only at `qual`, which cannot see an INSERT policy). The
only write policies in the blast radius are `meeting_cases_staff_admin_{insert,update,delete}`,
and all three carry `app.is_staff_admin_of(...) AND app.can_read_case(...)` — the reviewer
is refused by the first conjunct. **The exposure is exactly the three DEFINER doors, no
more.**

**Ask.**
1. Close all three at the DB: add an authority conjunct that the S7 arm does not satisfy
   (membership / participation / an explicit capability bit), re-emitted from live
   `pg_get_functiondef` and property-diffed per the buildnotes §3 discipline.
2. If the PO rules any of the three acceptable for an oversight reader (`declare_conflict`
   self-service is the only one with a plausible case), that is an **amendment to D7**, and
   it needs a keystone pinning the ruling in the direction chosen.
3. Add a pgTAP section — reviewer calling each door on a readable case → denied, each paired
   with a **coordinator non-vacuity twin** that succeeds — plus a `q1` case that neutralizes
   the new conjunct and REDs it.
4. **Generalize the enumeration.** Plan §A.2's threading list is "what must change". Add
   "what already consumes the bit": derive from the catalog, `prosrc ~ 'can_read_case'` and
   `pg_policies` over **both** `qual` and `with_check`, then classify each hit **read vs
   write** — a boundary that is a property, not a remembered list.

---

## 2. MAJOR

### M1 — Class-2 professional identity is reachable by the arm; D5 says it is not

> **Requirement — ADR 0100 D5:** *"PHI NONE. … **The reviewer never enters the Rule 12
> modules.**"* **CLAUDE.md Rule 12** names *"a distinct **Class-2 professional-identity**
> class (`professional_profiles`; case-scoped RLS + audited reads …)"* as one of those
> modules.

**[CAT]**

```
professional_profiles      | professional_profiles_select      | SELECT | USING app.can_read_professional_profile(id, auth.uid())
professional_participants  | professional_participants_select  | SELECT | USING app.can_read_professional_profile(...)
```

and `app.can_read_professional_profile` (STABLE SECURITY DEFINER) is, verbatim, a DEFINER
traversal over base tables ending in the broad case predicate:

```sql
return exists (
  select 1 from public.professional_participants pp
  join public.case_participants cp on cp.participant_id = pp.participant_id
                                  and cp.removed_at is null
  where pp.professional_profile_id = p_profile_id
    and app.can_read_case(cp.case_id, p_uid) );   -- ← S7 satisfies this
```

**[CAT] Today it returns 0 rows for `quality.a` — for a reason that is a coincidence, not a
boundary.** The seed has exactly one professional-profile-bearing CCIH participant, and it
sits on **case 6, `visibility_policy = 'explicit_grants_only'`** — locked, so D6 closes it:

```
case_number | visibility_policy      | live | reviewer_reads_case | reviewer_reads_profile
6           | explicit_grants_only   | t    | f                   | f
```

Move that participant to any non-locked case of an oversight-visible commission — i.e. the
ordinary case — and the reviewer reads the professional identity store. No pgTAP, no E2E,
no plan line covers it; `308` touches `professional_profiles` only as a *fixture* for the
respondent hard-deny (L190–193), never as a reach assertion. A pilot with real data
instantiates this immediately.

**This is genuinely arguable on the merits** — a case reviewer arguably should see who the
participants are, and Class-2 is designed to be case-scoped. I am not ruling it. I am
saying **D5's sentence is categorical, the build contradicts it latently, and nobody
decided.** Needs a PO ruling recorded as an ADR amendment plus a keystone in whichever
direction — currently the "boundary" is one seed row's visibility policy.

### M2 — Interviews are open at the DB and closed only in the UI (Rule 1 inversion)

**[CAT]** `app.can_read_interview(f2000000-0000-0000-0000-0000000000e1, quality.a)` =
**true** on the seeded CCIH interview (`confidentiality_level = non_phi_internal`). Its
policy family is seven tables, all routed through that one predicate → `can_read_case`:
`case_interviews`, `interview_sessions`, `interview_summaries`, `interview_topics`,
`interview_session_attendance`, `case_interview_interviewers`, `case_interview_subjects`.

**[SRC]** The build's answer (Q4, `casos/[caseId]/page.tsx` L142–150) is to **not fetch**
them, with this rationale in-code:

> *"interviews and meetings are DELIBERATION, which the oversight arm deliberately does not
> confer. Skipped entirely rather than fetched-and-hidden … a count without content would
> leak the very volume D4 withholds."*

If that reasoning is right — and I think it is — then the **DB** should not confer them
either. As shipped, the only thing standing between the reviewer and full interview content
(including `interview_summaries`) is a Server Component choosing not to call a query. That
is precisely the UI-only access control Rule 1 forbids, and precisely the lesson M8→M9 just
taught at the bytes layer: *a policy-level (here, a UI-level) cut says nothing about the
other door.* A reviewer with the anon key and their own session can `select * from
case_interviews` through PostgREST.

**Same shape, lower confidence on intent:** `case_votes_select` and `case_decisions_select`
are both `app.can_read_case(case_id, auth.uid())` **[CAT]**. Votes and decisions read as
deliberation in substance. **[CAT]** the reviewer-readable population of `case_votes` in the
seed is **0**, so neither pgTAP nor E2E would ever surface this — the same
zero-rows-for-the-wrong-reason trap as M1.

**Ask.** Decide interviews (and votes/decisions) at the DB, in either direction, and pin the
decision. If they stay open, remove the Q4 UI suppression's D4 rationale — a comment that
justifies a UI cut on a security ground the DB does not hold is the stale-assertion class
this project has paid for repeatedly.

---

## 3. MINOR

### m1 — `isQualityViewer`'s documented invariant is already false

**[SRC]** `src/lib/queries/session.ts` L534–540:

> *"No oversight-visibility re-check here — … for a bare reviewer the ONLY admitting arm of
> `commissions_select_member_or_admin` is `is_quality_reviewer_of(hospital) AND
> quality_oversight = 'visible'` (M6), so an excluded commission never reaches this line."*

**[CAT]** the policy has six arms:

```
is_member_of(id) OR is_org_admin_of(organization_id) OR is_hospital_admin_of(hospital_id)
OR is_pqs_operator_of(hospital_id) OR is_nsp_org_admin_of(organization_id)
OR (is_quality_reviewer_of(hospital_id) AND quality_oversight = 'visible')
```

A `pqs_member` or `nsp_org_admin` who **also** holds a `quality_reviewer` seat sees the
**excluded** commission row through their own arm, resolves `role === null`, and gets
`isQualityViewer === true` → `layout.tsx` renders `QualityViewerShell` instead of
`notFound()`. **No data leaks** (S7 still requires `quality_oversight = 'visible'`, so every
read comes back empty), but the shell is wrong and the load-bearing comment is stale on the
day it shipped. Fix the comment, or add the `qualityOversight === 'visible'` conjunct —
`OrgCommissionDetail.qualityOversight` already exists.

### m2 — buildnotes §6(f) names an error code the door does not raise

**[SRC]** buildnotes §6(f) proposes `HC0Q0` for the invalid-classification value.
**[CAT]** the shipped door raises **`HC0L0`**; `src/lib/quality/actions.ts` and pgTAP `307`
both use `HC0L0`, so nothing is broken. But the discrepancy table is the artifact a future
reader consults as ground truth. One-line correction.

### m3 — `canDownload`'s comment survives the fix it predates

**[SRC]** `case-documents-panel.tsx` justifies `canDownload` by saying the reviewer would
otherwise be offered `OpenAttachmentButton`, *"the audited door, which signs with the SERVICE
ROLE and therefore does not consult the storage policy M8 cut at all."* **[CAT]** after M9
the door itself refuses. Keeping the prop is correct defence-in-depth; the comment should
record M9, or it reads as though the UI is the only defence.

---

## 4. Audit checklist — where each item landed

| # | Item | Verdict |
|---|---|---|
| 1 | **Requirements** — D1–D11 deliverables + acceptance | D1/D2/D3/D6/D8/D9/D10/D11 ✅ · **D7 ⛔ B1** · **D5 ⚠ M1** · **D4 ⚠ M2** |
| 2 | **Security / RLS** — `prosecdef` beside `pg_policies`, DEFINER gates, no service-role client-side | Bytes layer ✅ complete (§5) · blast radius ⛔ B1/M1/M2 |
| 3 | **Code quality** — `strict`, Rule 9, Server Components, ownership | ✅ (§5) |
| 4 | **UX & a11y** — pt-BR, no raw Postgres, sanitized MD, accessible inputs | ✅ (§5) |
| 5 | **Hygiene** — ADRs, PROGRESS reality, secrets | ✅ · m2 doc drift |

---

## 5. What holds — verified, not assumed

These were audited to the same depth as the findings and are recorded so a re-review need
not redo them.

**M8+M9 bytes cut is complete, and I re-derived the enumeration rather than taking it.**
**[CAT]** I swept **every** function in `app`/`public`/`storage` whose comment-stripped
`prosrc` matches `storage_path|storage_bucket|storage\.objects|foldername` — a **property**,
not a filename or a remembered list — yielding 21 functions, and dumped **all 17**
`storage` policies. The only routes to case-owned bytes are `attachments_obj_select_readable`
(M8: case/interview objects additionally require `read_case_deliberation`, which every
content source **except** S7 confers) and `public.open_attachment` (M9: the same conjunct
in-body). `app.can_read_snapshot_document`, `get_referral_attachment_path` and
`get_referral_snapshot_document_path` gate on `can_read_referral_phi`, which **[CAT]** does
not appear in the `can_read_case` consumer set at all. **[SRC]** on the client layer:
`listAttachments` and `getCaseDocumentDownloadUrl` mint through the **user-scoped**
`createClient()` (storage RLS applies), and `openAttachment` — the sole `createAdminClient()`
storage signer reachable by a user request — calls the RPC **first** and returns
`{signedUrl: null}` on an empty result. **The enumeration was complete.** The lead's two
ruled non-defects both hold: the documents panel renders no links because of a **DB**
boundary at *both* layers, and FUP-QO-4's KPI-strip scope is a genuine design ambiguity now
pinned as constant behaviour by E2E.

**ACLs survived the M3 DROP+CREATE — the documented over-grant trap.** **[CAT]**
`grant_role` `{postgres,service_role,authenticated}` · `grant_role_for`
`{postgres,service_role}` (**no `authenticated`**) · `app.grant_role_impl` `{postgres}` only.
**No PUBLIC anywhere, and no stale overload left behind** — exactly one signature per name.
All five QO helpers carry the explicit `REVOKE PUBLIC → GRANT authenticated, service_role`
shape, `prosecdef = t`, `provolatile = s`, `search_path = app, public, pg_catalog`.

**D11's six/three split is a catalog fact.** **[CAT]** exactly six `dashboard_*` doors carry
`can_read_quality_dashboards` (`distributions`, `entity_references`, `form_totals`,
`matrix_cells`, `risk_scores`, `submissions_over_time`); `export_rows`, `free_text`,
`completion_by_member` carry none. All nine deny by silent `return;` — correctly recorded in
buildnotes row 17 against the plan's wrong "42501". **[SRC]** the FE strips the row-level
arrays locally (`toAggregatesOnly`) *rather than trusting the denial*, with the reasoning
written down. That is the right instinct, applied in the right place — and it is the exact
instinct B1 needed and did not get.

**Authz gate integrity.** **[SRC]** `p0-authz-invariant.sh`, `authz-blind-allowlist.txt` and
`authz-neverclled-door-allowlist.txt` are **byte-identical to `main`**, and `grep -ci quality`
returns **0** in both allowlists. **Nothing from this phase was allowlisted to make an arm
green.** The three modified harnesses (`w3`, `w4`, `p0-writepath`) change only regprocedure
signatures to follow M3's new `timestamptz` argument, add the `quality_reviewer` arm to w4's
scope-shape rebuild so the mutation does not ABORT instead of proving something, and scope
`set_commission_oversight` into the frozen write-path list per ADR 0079 Amendment 5 — all
strengthenings, no weakenings.

**Keystone quality is the best I have reviewed here.** `308`'s 1.1 is an **exact-mask
equality** (`= read_case_content | view_case_overview`), so the deliberate absences are
asserted in the same number as the presences; 1.6 is a discriminating coordinator twin; 3.3
re-proves reach *after* every deny fixture is removed, so the §2/§3 zeros cannot ride a
leftover deny; 5.4 and 5.7 are explicit non-vacuity twins for the two bytes-layer zeros. The
`q1` header reasons about **which** cases matter and why, and names the two mechanisms that
defeat the generic sweeps (M8 lives outside the door audit's `public` population; M9's
CASE-expression makes the rowdoor neutralizer ERROR, and "ERROR is not a pass"). The one
vacuity risk I probed for — a keystone that would pass with the feature deleted — I found in
**308 1.4**, and it is B1.

**Guard trigger and classification door.** **[CAT]** `guard_commission_oversight` fires
`BEFORE INSERT OR UPDATE`, puts the INSERT branch first (OLD does not exist there), and uses
`IS DISTINCT FROM` on the UPDATE branch — the `guard_case_visibility` fires-on-mention trap,
avoided. `set_commission_oversight` is authority-first (42501) → validation (HC0L0) →
txn-local GUC bracket → `app.audit_write` with the previous value; **no platform_admin arm**
(noun rule, D9). `memberships_scope_shape` gained a `quality_reviewer` arm with
org+hospital NOT NULL / commission NULL and kept its `ELSE false`; `memberships_title_scope`
untouched; both constraints re-added under their original names.

**Must-NOT-change set held.** **[CAT]** `is_org_level_admin_within` is unwidened (visible in
the `organizations_select` qual it feeds); the three new policy arms are exactly the three
planned; `session_context` needed no SQL change.

**Frontend.** **[SRC]** The `viewerKind` discriminator is argued from
`architecture-avoid-boolean-props` / `patterns-explicit-variants`, and is **doubled** on
purpose — the host resolves the same affordances off, so neither side alone is load-bearing.
The F1 early return means `AppSidebar` never mounts, so `role === null`'s show-everything
branch is structurally unreachable rather than hidden. `isQualityViewer` is a flag; the
`CommissionRole` union is still `'staff' | 'staff_admin'`, so no `role === 'staff_admin'`
write gate can open (matrix row 9 — the one D10 exists to protect). Rule 9 respected
(`src/lib/queries/quality.ts` is the only read seam, no inline supabase-js in the route
group), Rule 10 respected (pt-BR throughout; `mapOversightError` maps 42501/HC0L0/P0002 so
no raw SQLSTATE reaches the UI), Server Components by default with `"use client"` only on
the four interactive pieces. **[SRC]** No `any` introduced; no `NEXT_PUBLIC_` service-role
exposure (the only `createAdminClient()` in the QO path is `openAttachment`, server-side).

**Hygiene.** ADR 0100 exists and is PO-ratified; the plan, buildnotes and frontend plan all
carry their own discrepancy/ruling records rather than leaving stale "lead call" markers;
PROGRESS.md's QO·A rows reflect what I found in the tree, including an honest amendment
recording that M8's record was incomplete when written. FUP-QO-1..4 are filed with owners.

---

## 6. What I could not check, and what it costs

Stated plainly, because a review that quietly skips something reads as coverage it does not
have.

1. **No test execution of any kind.** pgTAP (171 files / 5311 PASS), `q1` (12/12
   RED-PROVEN, 6 controls), `ARM=census` + `ARM=floor` (HOLD), the diff-scoped door sweep,
   vitest 1158, and `e2e/quality-oversight.spec.ts` 16/16 are **reported in PROGRESS.md and
   read by me in source — not reproduced.** I reviewed what those suites *assert*; I did not
   observe them pass. B1 and M2 are findings about **what the suites do not assert**, which
   is unaffected by whether they pass.
2. **No mutating probe.** I could not execute `file_correction_request` as `quality.a` and
   watch the row land. B1 is established from the door's own authority expression plus
   read-only evaluation of **every** predicate in its gate chain against the seeded reviewer
   — which is stronger than a single successful call, but it is not the call.
   **The probe I want run when the stack is free** (in a transaction, rolled back):
   ```sql
   begin;
   select test_helpers.claims_for((select id from auth.users where email='quality.a@test.local'), false);
   set local role authenticated;
   select public.file_correction_request('phase', <a completed CCIH phase id>, null,
                                         'probe', 'clerical');   -- expect: a uuid. Want: 42501.
   select public.declare_conflict(<a readable CCIH case id>, 'other', 'probe');
   rollback;
   ```
   If any of the three returns a value instead of raising, B1 is confirmed by execution.
3. **The local DB entered a `db reset` at ~02:48 UTC mid-review** (the lead's `e2e:prod`
   gate). Every **[CAT]** fact above was captured before that; three trailing confirmations
   I had queued (the `professional_profiles` column list, a second votes/decisions
   population probe, and a re-read of `is_commission_admin_of` for m1) were not completed,
   and none of them changes a finding — m1's mechanism is visible in the policy text alone,
   and M1/M2 rest on predicate bodies I already have verbatim.
4. **Not audited:** D12/D13/D14 (Phases B/C, explicitly out of scope), the perf measurement
   the plan lists as a gate item (§A.5 "Perf (A5-style)") — **[SRC]** I found no
   before/after `list_cases_board` measurement recorded in PROGRESS.md's A.1 row or
   elsewhere, and I could not run one; flagging it as an **unrecorded gate item**, not a
   defect.

---

## 7. Re-review scope

On the fix round I will re-audit: the three doors' new authority (from
`pg_get_functiondef`, property-diffed), the new keystones + `q1` case, whatever the PO rules
on M1/M2 and its pin, m1–m3, and a fresh **read-vs-write** consumer sweep of
`can_read_case` / `has_case_capability` over `pg_proc` and both `pg_policies` columns. Nothing
else needs re-deriving — §5 stands.
