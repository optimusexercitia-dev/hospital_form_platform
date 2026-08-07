# QO·A Review — Quality-office oversight, Phase A (ADR 0100 D1–D11)

**Reviewer:** `qa` · **Scope:** ADR [0100](../decisions/0100-quality-office-oversight.md)
**Phase A only** — D1–D11. D12/D13/D14 (Phases B/C) out of scope, not audited.

| Round | Date | Commit | Verdict |
|---|---|---|---|
| **r3** | 2026-08-07 | `72f3dc7` (M11 = `a8450c2`) | ✅ **APPROVED** — R1 + R2 closed at the level that generalises. 1 MINOR + 2 INFO carried forward, none blocking. **[§9](#9-round-3--re-review-of-the-m11-closure)** |
| r2 | 2026-08-07 | `1f8c8a9` (M10 = `f6b622a`) | ⛔ CHANGES REQUESTED — r1 fully closed; **2 new**: R1 BLOCKER (interview-family cut incomplete), R2 MAJOR (the lattice invariant is unpinned). **[§8](#8-round-2--re-review-of-the-m10-remediation)** |
| r1 | 2026-08-07 | `9bb789b` | ⛔ CHANGES REQUESTED — 1 BLOCKER, 2 MAJOR, 3 MINOR (below) |

---

# ROUND 1 — VERDICT: ⛔ CHANGES REQUESTED

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

---

# 8. ROUND 2 — re-review of the M10 remediation

**Date:** 2026-08-07 · **Branch:** `feat/quality-office-oversight` @ `1f8c8a9` · **Delta under
review:** `f6b622a` (M10 `20260911000900_oversight_readonly_perimeter`), `efb498b` (308 §6
vacuity fix), `ad2e099` (m1 + m2 + perf record), pgTAP `311`, `q1` 12→17 cases.

## VERDICT: ⛔ CHANGES REQUESTED

**Round 1 is fully closed** — B1, M1, M2 and all three minors, and closed better than I
asked (§8.4). Two **new** findings, both in the remediation itself, both live on the seed
and verified against the live catalog:

| # | Severity | Finding |
|---|---|---|
| **R1** | ⛔ **BLOCKER** | The interview-family cut is **incomplete**. `case_interview_links` and interview-owned `attachments` still route the raw `can_read_case`, so the reviewer reads an interview's **external audio-recording URL** and its transcript's title while `can_read_interview` is **false** for that same interview. |
| **R2** | ⚠ **MAJOR** | The **lattice invariant** that M8, M9 and M10 all rest on ("content without deliberation ⟺ S7, and nothing else") is asserted in prose and in two-principal fixtures, but **pinned by no keystone**. A future content-conferring arm silently over-cuts ~20 surfaces with LOST ≠ 0 and nothing goes red. |

R1 is a narrow fix — two predicates in one migration — not a redesign. I am holding the
verdict because it is an RLS hole against a PO-ratified exclusion, which my own r1 standard
says blocks regardless of how much else is right; and because it is the **fourth** instance
of this phase's one failure class, which is precisely the thing the new standing rule exists
to stop.

---

## 8.1 R1 (BLOCKER) — the interview family has eight tables; M10 cut seven

> **Requirement:** ADR 0100 **D4** (no `read_case_deliberation`; deliberation rides
> `case_access_grants` only) as operationalised by the PO's M10 ruling and Q4 — *"a count
> without content leaks deliberation volume, which is precisely what D4 withholds."*
> **and Architecture Rule 1.**

**[CAT] — live catalog, fresh reset, post-M10 (312 migrations registered):**

```
case_interview_links / case_interview_links_select
  :: app.can_read_case(app.case_of_interview(interview_id), auth.uid())     <- raw, uncut

reviewer-reachable rows: 1 of 1   |  can_read_interview says: 0
seeded row -> title = 'Gravacao de audio (link externo)'
             external_url = 'https://example.com/recordings/caso-0001-entrevista.mp3'
authenticated SELECT cols: created_at, created_by, deleted_at, deleted_by,
                           external_url, id, interview_id, title      <- external_url granted

interview-owned attachments reviewer-reachable: 1 of 1
             title = 'Transcricao assinada (rascunho)'

CONTROL: can_read_interview(seeded CCIH interview, quality.a) = false
         can_read_case(that interview's case, quality.a)      = true
```

**Failure scenario, concrete.** `quality.a` opens a CCIH case they legitimately read.
`case_interviews` is invisible to them (`311` §3.2 proves it). They then
`select title, external_url from case_interview_links` through PostgREST and receive the
**URL of the interview's audio recording**, plus — from `attachments` — the title of its
signed transcript. They now know the case has an interview, what it is called, and where its
audio lives. If that external URL is a shareable cloud link (the column exists precisely so
it can be one), they have the recording itself. Interview **bytes** are cut by M8/M9 — but
`external_url` is not a storage object at all, so no storage policy governs it and M8/M9
never touched it.

**Second route, same family:** `can_read_attachment`'s `'interview'` arm is
`app.can_read_case(app.case_of_interview(p_owner_id), p_uid)` — also raw. M10 re-pointed
`can_read_interview`, `can_read_professional_profile` and `can_read_action_item`;
`can_read_attachment` was not in that set.

**Why the enumeration missed it, and why that is the important part.** M10's §B2 says
*"Interviews (7 tables route `can_read_interview`)"* — accurate, and **that is the bug**: the
boundary was a **predicate name**, so a family member that reaches the same object through a
*different* predicate was structurally outside it. The migration documents catching exactly
this shape one section later —

> *"⚠ `action_items` routes `can_read_case` DIRECTLY in its `case_restricted` arm — cutting
> `app.can_read_action_item` (B3) does NOT reach this policy."*

— and then repeats it for interviews. My own r1 policy sweep listed
`case_interview_links_select` (it matches `can_read_case\s*\(`), so it was inside the
50-policy population and was classified as leave-open; I find no record anywhere —
migration, `311`, `q1`, PROGRESS, plan — that it was considered. This is the project's
documented *"an enumeration's boundary must be the property, not a syntax"* lesson, hit
again.

**`311` cannot detect it.** §3 asserts `can_read_interview` is false and the
`case_interviews` row invisible — both true and both irrelevant to a table that does not
route that predicate. §5.1's catalog invariant counts a **hardcoded table list**
(`case_votes`, `case_decisions`, 7x `ethics_*`, `action_items`) against 10, so a family
member never in the list can never make it fail. A count against a literal is not an
invariant over a family.

**Ask.**
1. Re-point `case_interview_links_select` and `can_read_attachment`'s `'interview'` arm to
   `app.can_read_case_committee`, with M10's single-replacement proof and postconditions.
2. Add the behavioural keystone to `311` §3 — reviewer reads **zero** `case_interview_links`
   and zero interview-owned `attachments` on `case_a`, each with a coordinator twin — and a
   `q1` case that neutralises the new conjunct and REDs it.
3. **Replace §5.1's literal count with a property.** The durable form is a catalog assertion
   with no table list in it, e.g. *"every `authenticated` SELECT policy whose qual reaches
   `can_read_case` (directly or through `can_read_interview` / `can_read_action_item` /
   `can_read_attachment` / `can_read_professional_profile`) is either in the ratified
   oversight-VISIBLE set or routes `can_read_case_committee`"* — with the visible set as the
   short, reviewed literal and the consumer side derived. Then the next family member is
   caught by the suite instead of by the next review.
4. While there: `case_conflict_declarations_select` and `case_recusals_select` remain raw
   `can_read_case`. The PO has just ruled the reviewer may not **write** either record
   because "a conflict declaration or recusal from a principal excluded from deliberation
   has no consumer". Reading other members' conflict and recusal records is arguably the
   same register. **Not a finding** — I am not asserting D3 excludes them — but it is the
   one remaining pair whose classification is asymmetric with the ruling, and it should get
   an explicit yes/no rather than defaulting.

## 8.2 R2 (MAJOR) — the load-bearing invariant is prose, not a keystone

M8 (`attachments_obj_select_readable`), M9 (`open_attachment` in-body) and M10 (both
perimeter predicates, hence 3 write doors + 10 policies + 3 read predicates) **all** rest on
one claim, stated in M10's header:

> *"every content-conferring source EXCEPT S7 also confers `read_case_deliberation` … So
> LOST = 0 for every pre-existing reader and writer, and the only principal cut is the
> oversight reviewer."*

**[CAT]** I re-verified it holds today by reading the live `_case_caps`: S1 both · S2 no
content · S3 grant closure content⇒deliberation · S4 both · S5 deliberation only · S6 both ·
S7 content only. True.

**[SRC]** Nothing asserts it. `311` 0.2 and 0.3 assert it for *the reviewer* and *the
coordinator* on *one case* — two instances of a universal. `308` names it in a comment.
`q1` neutralises the cuts, not the invariant.

**Failure scenario.** Phase B is a subtractive change to `_case_caps`' org-admin plane; a
future S8, or an A4-style narrowing that removes a deliberation bit while leaving content,
produces a second content-without-deliberation principal. `is_oversight_only_reader` then
classifies that principal as an oversight reader and **silently cuts them** from interviews,
Class-2 identity, votes, decisions, the ethics family, action items, attachment bytes, the
`open_attachment` door and three write doors. That is LOST ≠ 0 across ~20 surfaces, and
every existing keystone still passes, because every one of them is written against the
reviewer (expects the cut) or the coordinator (holds both bits). The suite would report
green while the platform quietly revoked a working principal's reach — the
*no-regression-claim-needs-an-over-grant-twin* shape, inverted.

**Ask.** One executable pin, cheap: for a matrix of principal shapes on one case — plain
member (S5), phase assignee (S4), content-grantee (S3), NSP referral-touched (S6),
coordinator (S1), org-admin (S2) — assert `is_oversight_only_reader` is **false** for every
one of them, paired with `true` for the reviewer. Six `ok()`s and the invariant stops being
a comment. Phase B is the instance that will break it.

## 8.3 The three specific asks

**(1) Independent re-derivation — done, and it is what found R1.** I did not read
`backend`'s list. **[CAT]** I built a recursive closure over comment-stripped `prosrc`
(schemas `app`, `public`, `storage`, `prolang <> 12`), seeded from `can_read_case\s*\(` /
`read_case_content` / `view_case_overview`, depth 6 → **71 functions**, then swept
`pg_policies` over **both** `qual` and `with_check` → **46 policies**. Diff against the
shipped cut:

- **Agreement on every door M10 touched.** The three write doors are the complete set of
  `authenticated`-executable DML doors in the closure admitting on `can_read_case` alone; I
  spot-verified two of the eleven "safe" ones from their bodies (`link_evidence` gates
  `is_staff_admin_of` first; `can_write_interview` requires staff_admin or interviewer). The
  "11 of 14 safe for per-door reasons" claim is sound, and a blanket predicate would indeed
  have broken them.
- **One family incomplete** → R1.
- **One candidate I chased and cleared:** `case_participants_select` stays raw
  `can_read_case`, so the roster row is reviewer-visible — but `participants_select` and
  `case_participant_roles_select` both gate on `app.is_org_member`, whose body **[CAT]**
  requires `m.commission_id is not null` + a commission join, which a reviewer row
  (commission NULL) never satisfies. So `display_name` is closed and the reviewer sees
  opaque UUIDs. M10's Class-2 cut is **not** bypassed by this route, and `311` 4.3 correctly
  keeps the roster row as a not-over-cut control.
- **`meeting_cases`** write policies carry `is_staff_admin_of AND …` — reviewer refused by
  the first conjunct. Confirmed again post-M10.

**(2) Fixture placement — verified, and it is the best part of `311`.** Every fixture is on
`case_a`: `commission_default` (not locked), in an oversight-**visible** commission, of a
reviewed hospital. The precondition is **asserted, not inherited** — 0.1 (`can_read_case`
true), 0.2 (content without deliberation, expressed in the underlying **bits** so the file
runs and reds against the pre-M10 catalog where the helper does not exist), 0.3 (coordinator
control). Every negative has a coordinator twin (1.3, 2.4–2.6, 3.5, 3.6). §4 adds the
**over-cut** controls that a deny-everything patch would fail. The Class-2 fixture is
deliberately moved off the locked case with the reason written down; the ethics category is
**minted** rather than borrowed because `bootstrap()` truncates the org-scoped vocab and a
borrowed row would fail closed for the wrong reason. Coverage honesty is stated, not papered
over (6 of 7 ethics tables ride §5's catalog invariant, `ethics_allegations` is the
behavioural representative). I could not run it (§8.5), but by construction **none of these
assertions passes on a seed coincidence** — and PROGRESS records 11 observed REDs against
the pre-M10 catalog, which is the right evidence.

**(3) The §6 disarming pattern — swept, one instance, already the fixed one.** I traced
every mutation-between-assertions in all six QO suites:

| Suite | Shape found | Verdict |
|---|---|---|
| `308` §6 | `record_recusal` succeeded → flipped `is_case_excluded` → later keystones refused through the **exclusion** arm with the same 42501 | **The instance.** Fixed: correction door first, self-excluding door last; message-level assertions; 6.5 pins the second 42501 site apart. |
| `308` §2/§3 | expiry / deactivation / classification flips, and recusal+respondent inserts | Each restored immediately; **3.3 re-proves reach after every deny fixture is removed** — the discipline, applied. |
| `308` §6 tail | 6.4's `lives_ok(declare_conflict)` **succeeds** and writes a row | Checked: a conflict declaration does not flip `is_case_excluded` (= respondent ∨ recused), so 6.5 is unaffected. Safe. |
| `310` §3.6→§4 | §3.6 opts the last commission **out**, §4 then depends on it being visible | **Recognised and handled** — §4's bracket re-opts both commissions in, and the comment says so explicitly. |
| `310` §2/§3 | expiry, deactivation | Restored in place. |
| `307` | GUC-bracketed writes; §4.2 even asserts the fixture write emits **no** oversight verb | Clean. |
| `309` | classification flip and expiry | Both restored before the next section. |
| `306` | blanket `delete … where role='quality_reviewer'` (fixture reset between shape positive and negatives); §4.7 backdates `st_x` | Neither disarms a later assertion — the negatives need no reviewer row, and 4.10+ move to `st_x2` on a commission grant. |
| `311` | **no mutation after the fixture block at all** | Immune by construction. |

**No further instance.** The one that existed is fixed, and the fix is better than the bug:
message-level assertions were the right response to two 42501 sites in one door, and the
tell that found it — *"a keystone that does not red under its own cut is not pinning that
cut"* — is the transferable rule.

## 8.4 Round 1: closed, and how

| r1 | Status | Evidence |
|---|---|---|
| **B1** — 3 write doors on `can_read_case` | ✅ **CLOSED** | **[CAT]** all three carry `is_oversight_only_reader` (M10 postcondition asserts 3 of 3). `record_recusal`'s coordinator arm preserved — only the "any reader" arm narrowed. Behaviourally proven both directions on the seed per PROGRESS (pre-cut the reviewer **filed a real correction request**). PO ruled exclude all three, reasoning recorded in-migration. |
| **B1's vacuous pin** — `308` 1.4 | ✅ **CLOSED, correctly** | Kept and honestly relabelled *"no write BIT (necessary, NOT sufficient … consulted by no admitting door)"*, real pin moved to §6 per door. Deleting it would have lost the bit-level fact; this keeps both and removes the false certification. |
| **M1** — Class-2 identity | ✅ **CLOSED** | `can_read_professional_profile` routes `can_read_case_committee`; `311` §1 pins profiles + the satellite with a coordinator twin, fixture **moved off** the locked case. |
| **M2** — interviews DB-open / UI-hidden | ⚠ **PARTIAL** | 7 of 8 tables closed (`311` §3.1–3.2). Votes, decisions and the 7 ethics tables closed too — families my r1 named but did not pin. **The 8th is R1.** |
| **m1** — false `isQualityViewer` invariant | ✅ **CLOSED** (`ad2e099`) | Now an **explicit** `commissionRow.quality_oversight === 'visible'` conjunct, with the false invariant and the dual-hatted PQS/NSP counter-example written into the comment. `quality_oversight` added to the select (`session.ts:498`). |
| **m2** — `HC0Q0` drift | ✅ **CLOSED** | buildnotes §6(f) now states `HC0L0` as built. |
| **m3** — stale `canDownload` comment | ⚪ **OPEN**, frontend-owned, cosmetic. |
| **§A.5 perf, unrecorded** | ✅ **CLOSED** | Numbers now in PROGRESS A.1/A.5: reviewer `list_cases_board` 5.8 ms / 5 rows vs coordinator 14.4 ms / 6 · `quality_board_summary` 10.6 ms · member scan 5.4 ms · reviewer `storage.objects` scan 35.7 ms / 18 objects (0 visible) — inside the ~44 ms in-body envelope. |

**The standing rule** — *conferring a capability bit requires enumerating its CONSUMERS, not
just its producers* — is recorded in ADR 0100, in plan §A.2 as an explicit "⛔ THE MISSING
AXIS / this list was INCOMPLETE BY CONSTRUCTION", and in M10's own header, with the Phase B
warning attached. That is the right home for it and the right wording. R1 does not weaken
it; R1 is what happens when the rule is applied with the boundary still set one notch too
narrow.

**M10 as a migration** is the strongest in the phase: single-needle replacement with a
**length-delta proof** that exactly one substitution landed, `ALTER POLICY` (never
DROP+CREATE), four postconditions including the inverted one that `cases_select` must
**not** be re-pointed, and the two-shape split (an explicit exclusion for write paths, the
committee-plane predicate for read paths) with the reason — *"a predicate correct for a read
path is NOT automatically correct for a write path"* — stated rather than assumed.

## 8.5 What I could not check this round

- **No test execution, again.** pgTAP 172/5340, `q1` 17/17 with 7 controls, census+floor
  HOLD, vitest 1158, E2E 18/18, `phase14b-triage` 13/13 — all **read in source and reasoned
  about, not reproduced.** R1 and R2 are findings about what the suites do not assert, which
  is unaffected by whether they pass.
- **No mutating probe.** I did not call the three cut doors as the reviewer to watch them
  refuse; §8.1's R1 rests on read-only evaluation of the policy's own USING expression with
  the reviewer's uid substituted, plus the catalog grants. **The probe I would want run:**
  ```sql
  begin;
  select test_helpers.claims_for((select id from auth.users where email='quality.a@test.local'), false);
  set local role authenticated;
  select id, title, external_url from public.case_interview_links;   -- expect 0 rows. Observed predicate: TRUE.
  select id, title from public.attachments where owner_type='interview';
  rollback;
  ```
- **Allowlists:** confirmed at source level — `p0-authz-invariant.sh`,
  `authz-blind-allowlist.txt` and `authz-neverclled-door-allowlist.txt` are byte-identical to
  `main` and contain **0** `quality` tokens. Nothing from M10 was allowlisted.
- The local DB cycled through `db reset` twice mid-review (the gate). Every **[CAT]** fact in
  §8 was captured on a settled catalog at 312 registered migrations, and R1's probe was
  **re-run and re-confirmed after the second reset** on a fresh seed.
- **Out of scope for this verdict, and I agree with the classification:** FUP-QO-5 (`anon`
  EXECUTE grants left by sweep machinery that can mask a real leak in `100_dashboard` t19)
  and FUP-QO-6 (oversight-toggle confirmation flake). I did not audit either.

## 8.6 Re-review scope for r3

Only: the two re-pointed interview surfaces (from `pg_get_functiondef` / `pg_policies`),
their new keystones and `q1` case, `311` §5.1 rewritten as a property rather than a literal
count, the six-shape `is_oversight_only_reader` pin, and the ruling on §8.1 ask (4).
Everything in §8.4 and §5 stands and needs no re-derivation.

---

# 9. ROUND 3 — re-review of the M11 closure

**Date:** 2026-08-07 · **Branch:** `feat/quality-office-oversight` @ `72f3dc7` · **Delta:**
`a8450c2` (M11 `20260911001000_interview_family_closure`), `4300216` (`311` lattice fixture
fixes), pgTAP `311` §5.1/§5.2b/§5.2c/§6, `q1` 17→19.

## VERDICT: ✅ APPROVED

Both r2 findings are closed, and closed at the level that generalises rather than at the
level that passes today. Nothing is open, nothing is exposed, and I found no new blocker.

Carried forward as follow-ups, none blocking: **one MINOR** (§9.3 — the S3/S4 lattice
fixtures cannot isolate the arm they name; one-line fix, should land before **Phase B**,
which is the change that will exercise it) and **two INFO** (§9.5).

---

## 9.1 Ask ① — R1 is closed, and the `'case'` arm survived

**[CAT], live, 313 registered == 313 files:**

```
app.can_read_attachment:
  when 'case'        then app.can_read_case(p_owner_id, p_uid)                                  <- UNCHANGED
  when 'meeting'     then app.is_member_of_for(app.commission_of_meeting(p_owner_id), p_uid)    <- UNCHANGED
  when 'interview'   then app.can_read_case_committee(app.case_of_interview(p_owner_id), p_uid) <- CUT
  when 'action_item' then app.can_read_action_item(p_owner_id, p_uid)                           <- UNCHANGED

case_interview_links_select :: app.can_read_case_committee(app.case_of_interview(interview_id), auth.uid())
```

**Behavioural re-probe, read-only, with discriminating twins on the live seed:**

```
case_interview_links      reviewer=0   coordinator=1   of 1
interview attachments     reviewer=0   coordinator=1   of 1
case-owned attachments    reviewer=1   of 3      <- NOT over-cut: the earlier metadata ruling survives
```

Each zero is twinned against a coordinator reading the same row, so neither is "the table is
empty". The r2 disclosure — the interview's `external_url` pointing at
`…/caso-0001-entrevista.mp3`, and the `Transcrição assinada (rascunho)` attachment title — is
gone.

**Independent re-derivation, and I used a stronger property than last round.** Rather than
re-running my text closure, I derived the interview family by **recursive FK closure to
`case_interviews`** — a structural property that owes nothing to how any policy is spelled —
and classified each member's SELECT policy:

| Table (FK closure, depth ≤ 4) | Routes |
|---|---|
| `case_interviews` · `case_interview_interviewers` · `case_interview_subjects` · `interview_sessions` · `interview_summaries` · `interview_topics` · `interview_session_attendance` | `can_read_interview` → committee-plane |
| `case_interview_links` | **`can_read_case_committee` directly** (M11) |
| `attachments` (`owner_type='interview'`) | **`can_read_case_committee` via the dispatcher arm** (M11) |
| `rca_evidence` (FK outlier, NSP plane) | `app.can_read_event` — not in the reviewer's closure; 0 rows, structurally out of scope |

**Zero members still route the widened `can_read_case`.** The family is complete and closed.

The migration is built the way I asked: single-needle replacement with a **length-delta
proof**, and — the part that matters most — an **inverted postcondition** that fails if the
`'case'` arm is ever changed:

```sql
if (…prosrc of can_read_attachment…) !~ 'when ''case'' then\s+app\.can_read_case\(' then
  raise exception 'M11 postcondition: the case arm of can_read_attachment was changed
                   (metadata must stay visible — lead ruling)';
```

That is a guard against the *over-cut* direction, which is the one nobody usually writes.

## 9.2 Ask ② — `311` §5.1 genuinely generalises, within a stated anchor

The claim under test is not "it passes today" but "would a ninth member red it". **Yes, for
the shape that actually bit.**

```sql
select is(
  (select coalesce(string_agg(tablename||'.'||policyname, ', ' order by tablename), '')
     from pg_policies
    where schemaname='public' and qual ~ 'case_of_interview\(' and qual ~ 'app\.can_read_case\('),
  '', '5.1 DERIVED FAMILY CLOSURE …');

select cmp_ok((select count(*) from pg_policies where qual ~ 'case_of_interview\('), '>', 0,
  '5.1b NON-VACUITY for 5.1 …');
```

- **It is a derivation, not a count against a literal.** No table list appears. A ninth
  policy anchored on `case_of_interview(` and still routing the widened predicate is named in
  the failure message with no one having to remember it.
- **The regex distinction is sound** — `app\.can_read_case\(` cannot match
  `app.can_read_case_committee(` because of the trailing `\(`. Verified, not taken on trust.
- **5.1b is the empty-set twin**, so an empty result means "none leak", never "none found".
  This is the specific trap that ate two probes earlier in the phase; it is now closed in the
  guard itself.
- **The same derivation is a migration postcondition**, so the invariant holds at apply time
  and at test time, not just one of them.

**Residual, stated so the boundary is known rather than assumed (INFO, §9.5·a):** the anchor
is the token `case_of_interview(` in a policy `qual`. A future member that reaches the
interview by a *different* anchor — an inline `exists (select 1 from case_interviews i …)`, a
new `commission_of_interview()` helper, a new intermediate predicate, or a DEFINER **door**
(which `pg_policies` cannot see at all) — sits outside it. Concretely: **§5.1 would not have
caught the `attachments` half of R1**, whose qual contains neither token; that half needed
its own bespoke assertion (5.2b). So the guard is derivation-over-an-anchor plus one literal,
not a family-complete invariant. My FK-closure pass above confirms there is nothing to catch
today, so this is a note about future detection strength, not a gap.

The corollary now in ADR 0100 — *a guard whose boundary is a literal list cannot close a
family; derive the set, assert over the derivation, twin it against the empty set* — is the
right generalisation and correctly stated.

## 9.3 Ask ③ — R2's eight assertions: non-vacuous, with one isolation gap (MINOR)

**The twins you asked about are correct.** 6.2 and 6.3 are implications
(`NOT content OR deliberation`), which pass vacuously when the antecedent is false — and each
is paired with an explicit antecedent proof:

- **6.2b** asserts the assignment **does** confer `read_case_content`. `u_assignee` holds
  only `staff` (S5 = deliberation only), so the content bit can come from nowhere but S4. The
  antecedent is live.
- **6.3b** asserts the grant **does** confer `read_case_content`, and the grant row sets
  `read_case_deliberation = false` on purpose, so 6.3 is testing the resolver's read-closure
  rather than the row. That is exactly the right fixture.
- **6.1** (S1 = content ∧ deliberation) is a conjunction — cannot pass vacuously.
- **6.4 / 6.5** state S5 and S2 confer **no** content, which is what stops either from being
  misread as oversight-only. Correct claims.

PROGRESS records that all eight were **green pre-M11** on a true 312-migration catalog (M11
held out of `migrations/` to get one) while 3.7/3.8/5.1/5.2b were red. That is the right
evidence and the right shape: R2 pinned an invariant rather than repairing a break, and the
file proves it by not moving.

**⚠ MINOR — the S3/S4 fixtures cannot isolate the arm they name.** §6's header says
*"Asserted per SOURCE of `app._case_caps`, not per principal."* Both principals are also
inserted as `staff` of `comm_x`:

```sql
insert into public.memberships (commission_id, principal_id, role)
select k.comm_x, l.u_assignee, 'staff' from k, lat l union all
select k.comm_x, l.u_grantee,  'staff' from k, lat l;
```

**[CAT]** `_case_caps`' S5 arm (`if v_member and not v_eg`) confers `read_case_deliberation`,
and `case_a` is `commission_default`. So the deliberation half of 6.2 and 6.3 is supplied by
**S5**, not by S4 or S3. Remove S4's or S3's read-closure tomorrow and both assertions stay
**green** — the principal still holds deliberation through membership.

Why that matters, specifically: a grant's normal subject is **not** a member (granting access
to an existing member is the redundant case). Drop S3's `read_case_content ⇒
read_case_deliberation` closure and a real non-member grantee becomes
content-without-deliberation → `is_oversight_only_reader` classifies them as an oversight
reader → they are silently cut from ~20 surfaces with LOST ≠ 0 and a green suite. That is the
R2 scenario verbatim, at the one arm most likely to be edited.

**[CAT] the fix is a one-liner and nothing blocks it:** `case_access_grants.principal_id` and
`case_narratives.assigned_to` are FKs to `profiles` only — no constraint requires a
membership. Drop the two `memberships` inserts, or add a non-member `u_grantee2` /
`u_assignee2` twin beside them. Then 6.2/6.3 isolate the source and the header's claim
becomes true.

**Not blocking**: the invariant itself holds — I re-verified all seven arms directly against
the live `_case_caps` body (S1 both · S2 no content · S3 closure content⇒deliberation · S4
both · S5 deliberation only · S6 both · S7 content only). Nothing is exposed today. This
strengthens a new guard against a future change, and **Phase B is that change**, so it should
land before Phase B rather than after.

## 9.4 Ask ④ — the PO-ruling pins are real and would fail loudly

**[CAT] the catalog carries both comments**, verbatim and directive:

> `case_conflict_declarations_select` — *"ADR 0100 (PO ruling 2026-08-07): deliberately stays
> on the widened can_read_case … Do not 'fix' the asymmetry with the write doors; it is the
> ruling."*
>
> `case_recusals_select` — *"… while D7 forbids them RECORDING one. **Acknowledged
> consequence: reveals that a named member recused on a case.**"*

Naming the consequence rather than only the permission is the right way to write a ruling
down; it is what lets a future reader re-open the question on the merits.

**[SRC]** both `comment on policy` statements are in M11 (L101, L106), so they survive a
`db reset` — a catalog comment set outside a migration would silently vanish, and it does
not.

**Would it fail if someone cut those policies?** Yes. `311` §5.2c:

```sql
select is((select count(*)::int from pg_policies
           where policyname in ('case_conflict_declarations_select','case_recusals_select')
             and qual ~ 'app\.can_read_case\('), 2, '5.2c PO RULING PINNED …');
```

**[CAT]** both policies currently match (`case_recusals_select`'s qual is a three-arm
disjunction whose first arm is `app.can_read_case(case_id, auth.uid())`). Re-point either to
`can_read_case_committee` and the count drops to 1 → red. Delete either → red. Rename either
→ red. It fails in every direction a tidying sweep would take.

**One accuracy correction, not a defect:** the ruling is pinned **two** executable ways, not
three. The catalog comments are documentation (nothing fails when they drift), and M11's
postcondition block covers only the interview closure and the two attachment arms — there is
no postcondition for the conflict/recusal non-cut. `311` §5.2c is the single failing pin, and
it is sufficient. Worth correcting wherever "three ways" is written down, per this project's
own rule about load-bearing claims.

## 9.5 Carried forward (INFO, no action required for this phase)

- **(a)** `311` §5.1's anchor is the token `case_of_interview(` in a policy `qual`; DEFINER
  doors and differently-anchored policies fall outside it (§9.2). If the family grows, prefer
  an FK-closure derivation — `pg_constraint` recursion to `case_interviews` — which is what I
  used above and owes nothing to spelling.
- **(b)** `311` 6.4/6.5 (S5 and S2 confer no content) have **no positive twin**: if a future
  `test_helpers.bootstrap()` changed what `st_x`/`oa_b` are, both would pass vacuously as
  "this user has no capabilities at all". One `ok(has_case_capability(…, 'read_case_deliberation'))`
  beside 6.4 fixes it. Related: **6.6 is a marker, not a proof** — it counts occurrences of
  `is_quality_reviewer_of_for` in `_case_caps` (= 1), which a new S8 arm using a *different*
  predicate would not move. Its own label says so honestly ("this file is where that must be
  re-proven"), and the invariant is not statically decidable, so I regard the marker as the
  right pragmatic choice — recorded so nobody later mistakes it for the proof.
- **(c)** r1's **m3** (the `canDownload` comment in `case-documents-panel.tsx`, stale since
  M9) remains open. Cosmetic, frontend-owned.

## 9.6 What I did not check

Same constraint, same honesty. **I ran no tests this round either** — pgTAP 172/5355, `q1`
19/19 with 7 controls, `ARM=census` + `ARM=floor`, vitest 1158, `database.ts` no-diff, and
the `e2e:prod` triage (18/19 + 1 cold-start flaky; 6 non-QO failures cross-validated as
order-dependent; 97 did-not-run covered by follow-on runs) are **read in PROGRESS and
reasoned about, not reproduced**. Everything I assert in §9 is either **[CAT]** from the live
catalog at 313 registered migrations, or **[SRC]** from the tree. No mutating probe was run;
§9.1's zeros are read-only evaluations of each policy's own predicate with the reviewer's uid
substituted, twinned against the coordinator.

## 9.7 Verdict, plainly

**APPROVED.** Take it to the PO.

Three rounds found five real issues — a live D7 write breach, a Class-2 identity path, a
UI-only interview suppression, an incomplete family cut, and an unpinned load-bearing
invariant — and every one was closed at the level that generalises: the write doors by an
explicit exclusion rather than a role check, the read families by a predicate that names the
question, the family closure by a derivation rather than a list, and the invariant by
assertions rather than a comment. The standing rule the phase produced — *conferring a
capability bit requires enumerating its CONSUMERS, not just its producers* — is recorded in
the ADR, in the plan at the exact place that was wrong, and in the migration that fixed it,
with the Phase B warning attached. That rule is worth more than the feature.

Two things to carry into Phase B, in priority order: the §9.3 fixture isolation (before, not
after — Phase B is the change that exercises it), and the consumer enumeration run **before**
the migrations are written rather than after QA finds the misses.
