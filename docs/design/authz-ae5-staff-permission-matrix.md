# AE5 increment 1 — the `staff` permission matrix

**Phase:** AE5 increment 1 · **unit:** [`AE5-STAFF`](../features/ae5-staff.md) ·
**plan:** [`docs/plans/authz-evolution.md`](../plans/authz-evolution.md) § Phase AE5, Proposed order
item 1 · **authority:** ADR [0155](../decisions/0155-post-aff4-tenancy-and-person-model-evolution-sequence.md) D7,
ADR [0162](../decisions/0162-authz-evolution-plan-audit-corrections.md) §2 (PA-F8),
ADR [0193](../decisions/0193-definer-writers-and-the-policy-rekey.md) D5 (`definerSurface` as data),
ADR [0200](../decisions/0200-professional-identity-predicates-answer-about-their-subject.md) (declare the SUBJECT),
ADR [0201](../decisions/0201-the-keying-asymmetry-is-the-model.md) D3 (declare the HAT),
ADR [0207](../decisions/0207-the-role-catalog-holds-roles-administrativo-is-a-capability-provider.md) D6 (item 1 is `staff`) ·
**owner:** backend · **status:** ⛔ **PROVISIONAL — NOT PO-APPROVED. 22 lines, 20 held rows, 18 new codes.** ·
**derived:** 2026-09-13 · **stack:** local, fresh reset; `authz.roles` = 11 rows, `staff` `legacy`,
`staff_admin` the only `authoritative`; `authz.permissions` = 43 codes; `authz.role_permissions` =
42 rows, all `staff_admin` · **sibling:** [`authz-ae5-staff-deny-class-effects.md`](authz-ae5-staff-deny-class-effects.md) ·
**template copied from:** [`authz-ae43-staff-admin-permission-matrix.md`](authz-ae43-staff-admin-permission-matrix.md).

> ⛔ **ON APPROVAL THIS MATRIX BECOMES THE REGRESSION ORACLE** — from cutover, `424` asserts
> `catalog = this document`, not `catalog = whatever legacy did`. Every row below carries a **named
> enforcement site** and every legacy divergence carries an **a/b/c disposition**. A row without a
> site is not a row; it is in § 8's findings list.
>
> ⛔ **The trap this document exists to avoid (PA-F8):** with "catalog = legacy" and "catalog =
> approved matrix" both required, the cheapest green is to approve a legacy defect *into* the
> matrix. **Working rule applied throughout: when a site looks wrong, the default disposition is
> (c) BLOCKS until argued otherwise.** The burden sits on *keeping* the behaviour.

---

## 0. Method, and the correction the `staff` sweep forces on the plan's stated method

Derived from all five planes. **Every SQL claim is from the live catalog** (`pg_policies`, `pg_proc`
incl. **`prosecdef`**, `pg_constraint`, `pg_indexes`, the ACLs), comment-stripped; ⛔ **no migration
file was read for any SQL claim, by rule** (CLAUDE.md § graphify; ADR 0078; LEARN-057). Transport:
`docker exec supabase_db_azkbbhskturikxpgmafq psql -U postgres -d postgres -At -v ON_ERROR_STOP=1`
— ⚠ `ON_ERROR_STOP=1` is load-bearing: without it `psql` exits **0** on a failed statement and a
sweep reads as an empty result set rather than as an error (hit once during this derivation).

### 0.1 ⭐⭐ THE NAME SWEEP FINDS ALMOST NOTHING, AND THAT IS THE FINDING

The plan's method — *match the name **UNANCHORED ONCE**, then **classify** each hit* (plan `:812`) —
was applied literally. Result, and it inverts the AE4.3 experience:

| plane | hits matching `staff` unanchored | of which the ROLE `staff` | of which `staff_admin` | of which an unrelated token |
| --- | ---: | ---: | ---: | ---: |
| `pg_policies` (`qual` ‖ `with_check`, comment-stripped) | **59** | **0** | **59** | 0 |
| `pg_proc` (`app`+`public`+`authz`, comment-stripped bodies) | **213** | **3** | **210** | 0 |
| `src/**` (occurrences of the maximal identifier token) | **1047** | **185** (72 executable) | **790** | 72 |
| `e2e/**` (same) | **1994** | **329** (51 literals) | **483** | 1182 |

Every partition sums with no residue bucket (`0 + 59 = 59`; `3 + 210 = 213`; `185 + 790 + 64 + 8 =
1047`; `329 + 483 + 1182 + 0 = 1994`).

**Predicates that produced the SQL figures**, so the denominators can be re-checked rather than
trusted. Domain: `pg_proc ⋈ pg_namespace`, `nspname in ('app','public','authz')`, `prokind='f'`,
body comment-stripped with `regexp_replace(prosrc, '--[^<LF>]*', '', 'g')`. Classifier: role =
`src ~ '''staff'''` (the closing quote is what excludes `'staff_admin'`); the policy plane uses the
identical classifier over `coalesce(qual,'')||' '||coalesce(with_check,'')`.

⛔ **ZERO policies and THREE functions name the role `staff` on the whole live catalog**, and all
three name it to *administer* it, never to exercise it:

| function | `prosecdef` | what the literal does | class |
| --- | --- | --- | --- |
| `app.grant_role_impl` | `t` | `elsif p_scope_type = 'commission' and p_role in ('staff','staff_admin')` — the grant dispatch | **administered value** — § 6's exclusion |
| `app.revoke_role_impl` | `t` | the same dispatch on revoke | **administered value** — § 6's exclusion |
| `public.appoint_administrativo` | `t` | `… and role = 'staff'` — the *appointee* must be a plain member (`apenas um membro comum`) | **managed-row value** — a precondition on someone else's row |

⇒ **`staff` has no name-keyed enforcement surface at all.** Its entire permission surface is
reached through a **role-SET predicate**, `app.is_member_of(_for)` → `app.has_role_any('commission',
…)`, which is satisfied by *any* commission-tier role. AE4.3 § 0 warned that *"a name-keyed
derivation finds writes systematically and misses reads systematically"* and told AE5's matrices to
enumerate read predicates as a population in their own right. For `staff` the warning is stronger
than it was written: **a name-keyed derivation finds nothing at all, and would have reported the
role as unenforced.** The derivation below is therefore **predicate-keyed from the start**, and
§ 9's reconciliation supplies the inverse control the name sweep would normally give — a top-down
pass over the *write* surface, which is the half a predicate-keyed derivation misses.

### 0.2 The classification the plan requires, applied

Plan `:845-852` requires each hit classified. Four classes were used, and every enumerated site
below carries one:

| class | meaning | in the matrix? |
| --- | --- | --- |
| **permission-shaped** | the caller must hold the role for the operation to proceed | ✅ a row |
| **administered value** | the string names the role being granted/revoked/rendered | ⛔ excluded, § 6 |
| **managed-row value** | the *subject of the row being written* must be a member (an assignee, a corrector, a reader, an approver) | ⛔ excluded, § 3.3 |
| **allowlisted** | out of scope by ruling — the `administrativo` capability plane (ADR 0207 D5 step 6; plan Proposed-order item 6) | ⛔ excluded, § 3.4 |

### 0.3 Lessons carried in from AE4.3's § 0, and the one that fired here

AE4.3's § 0 lessons are inherited whole, not restated. **One fired during this derivation and is
recorded because it changed a conclusion:** the first behavioural spot-check of *"can a plain
`staff` read `public.cases`?"* was run as `staff1.ccih@test.local` and returned **2 visible rows**,
apparently refuting the derivation from `app._case_caps`. It did not: that persona is **phase-assigned**
on those two cases, and the reach is S4 (assignment), not S5 (membership) — measured per-case in
§ 8.2. ⛔ **A behavioural check is only as clean as its persona**, and the persona whose name reads
most like "a plain staff" was the most contaminated one in the seed.

⚠ **A location is a measurement** (LEARN-099). Every `file:line` below was `sed -n`'d or produced by
a `grep -n` in this derivation. Where a figure differs from one a committed document states, both
are given.

---

## 1. Plane 1 — assignment shape, and the two structural facts the cutover depends on

`staff` is **commission-scoped**, verified against `pg_constraint` on 2026-09-13:

```
memberships_role_check     CHECK (role = ANY (ARRAY['org_admin','nsp_org_admin','hospital_admin',
                                 'nsp_coordinator','staff_admin','staff','pqs_member',
                                 'technical_director','technical_director_deputy','quality_reviewer']))
memberships_scope_shape    … WHEN 'staff' THEN (commission_id IS NOT NULL AND organization_id IS NULL
                                                AND hospital_id IS NULL) …
```

⇒ the **commission tier is exactly `{staff_admin, staff}`** — the CHECK's `WHEN` arms are the only
two requiring `commission_id NOT NULL`. `authz.roles.staff.allowed_scope_kind = 'commission'`,
`state = 'legacy'`, `session_selectable = true`.

### 1.1 ⭐ ONE ROLE PER USER PER COMMISSION — and this is what makes the R-1 cutover safe

```
memberships_one_commission_role_uq
  UNIQUE (principal_id, commission_id) WHERE (commission_id IS NOT NULL)
```

Measured by attempting to insert a second commission row for a principal who already holds one: the
insert **raises `23505`**. ⇒ **the "holds both `staff` and `staff_admin` in the same commission"
state is UNCONSTRUCTIBLE.** § 7.2 shows this is the fact that collapses the R-2 hat divergence to
zero. ⛔ It is a fact about an **index**, not about a policy: dropping the index re-opens the
divergence silently, so the cutover owes it an assertion rather than an assumption.

### 1.2 Expiry is applied on both sides of the cutover

`app.has_role_any` carries `(m.expires_at is null or m.expires_at > now())`; so does
`authz.assignment_facts`, which additionally re-applies `app.is_active(p_principal)`.
`app.is_member_of(_for)` applies `app.is_active` a second time in its own body. ⇒ the legacy and
catalog sides agree on expiry and on account state **by construction**, not by coincidence —
unlike AE4.3 § 1.2, which found five `staff_admin` resolution sites missing the expiry term. ✅ **No
`staff` analogue of that finding exists**: every `staff` reach in § 2 and § 3 goes through
`is_member_of(_for)` or `has_role_any`, and both carry the term.

---

## 2. Plane 2 — the RLS surface

**40 policies** reference `app.is_member_of` (bare form only — `is_member_of_for` appears in **0**
policies, so the plan's rule-3 pair trap has a *third* direction here: on the policy plane the
`_for` form is entirely absent). Aggregated by command:

| command | policies | tables |
| --- | ---: | --- |
| **SELECT** | **39** | forms ×8 + `storage.objects` ×1 · process templates ×8 + `phase_results` ×1 · accreditation ×4 · documents ×2 + `securable_resources` ×1 · roster ×4 (`memberships`, `commissions`, `profiles`, `commission_member_titles`) · meetings ×3 · cases-vocabulary ×3 (`case_narrative_types`, `case_outcomes`, `case_tags`) · indicators ×2 · `commission_charters` ×1 · `action_items` ×1 |
| **INSERT** | **1** | `responses` (`responses_insert_own`) |
| UPDATE / DELETE / ALL | **0** | — |

`8+1+8+1+4+2+1+4+3+3+2+1+1 = 39`, and `39 + 1 = 40`; the bucketing sums with no residue.
⚠ `phase_results` sits with the process templates (it is a template's result vocabulary) and
`securable_resources` with the documents (ADR 0114 D4: *"one row per document-bearing domain row"*)
— **an earlier draft of this table put both under "cases-vocabulary" and the buckets still summed to
39**, which is exactly why the sum is not the check: a partition can total correctly and classify
wrongly, and the classification is what decides which row each policy lands on.

⭐⭐ **`staff`'s ENTIRE role-derived policy surface is 39 reads and ONE write.** The single write is
`responses_insert_own`, `with_check = (created_by = auth.uid() AND app.is_member_of(commission_id))`
— creating a response draft in a commission you belong to. That is the role, in one policy.

⚠ **Three of the 39 are NOT free disjuncts, and each is an arm-3-shaped coordinate** (the ⚠⚠ block
at plan `:1216-1234`: *a role whose door carries a non-permission arm that no axis varies owes the
same treatment*):

| policy | the non-permission conjunct, verbatim from `pg_policies` |
| --- | --- |
| `meetings.meetings_select` | `app.is_member_of(commission_id) AND ((visibility_policy = 'commission_default') OR EXISTS(… meeting_attendees a … a.user_id = auth.uid()))` |
| `action_items.action_items_select` | `(visibility_scope = 'committee') AND app.is_member_of(commission_id)` — the member leg is one of three, and the other two are case-restricted / assignee-only |
| `accreditation_frameworks.accreditation_frameworks_select` | `(owner_commission_id IS NULL) OR app.is_member_of(owner_commission_id)` — ⚠ the NULL-owner arm grants to **every authenticated caller**, member or not |

A fourth is shaped differently and matters for § 5 row 4: `profiles.profiles_select_self_or_admin`'s
member leg is `app.is_active(auth.uid()) AND EXISTS(… them.principal_id = profiles.id AND
app.is_member_of(them.commission_id))` — a **co-member** read, not a roster read: a `staff` sees the
profile of anyone who shares any commission with them.

---

## 3. Plane 3 — doors, and the classification that decides which are rows

**42 functions** in `app`/`public`/`authz` call `is_member_of` or `is_member_of_for`. Partition, by
call form (the classifier is `src ~ 'is_member_of\('` vs `src ~ 'is_member_of_for\('`):

| | functions | `prosecdef = t` |
| --- | ---: | ---: |
| bare `is_member_of(` only | **9** | 9 |
| `is_member_of_for(` only | **32** | 30 |
| **both forms** | **1** (`app._audit_access_authorized`) | 1 |
| matching the name but neither call form | **0** | — |
| **total** | **42** | **40** |

`9 + 32 + 1 = 42`; the partition sums. The two INVOKER members are `public.add_ad_hoc_phase` and
`public.add_meeting_attendee`. ⚠ **`prosecdef` is quoted beside every one of these because a
DEFINER's gate *replaces* RLS** (LEARN-074) — 40 of the 42 are the only control on their own path.

### 3.1 ⛔ `_for` AT A SITE DOES NOT MEAN THIRD-PARTY — two grains, and they are not interchangeable

Extracting the second argument of every `is_member_of_for(` call:

| grain | total | caller-keyed (`auth.uid()` or a variable bound to it) | third-party |
| --- | ---: | ---: | ---: |
| **call sites** | **39** | **4** | **35** |
| **distinct functions** | **33** | **4** | **30** |

`4 + 30 − 1 = 33` — `public.create_referral_internal_note` contains one of each, so the function
partition overlaps by exactly one and still sums.

The **4 caller-keyed `_for` sites**, named because a subject-blind count would mis-report them as
third-party: `app._audit_access_authorized` (`p_commission, v_uid` where `v_uid := auth.uid()`) ·
`public.cast_case_vote` (`v_commission, auth.uid()`) · `public.create_referral_internal_note`
(`p_committee_id, auth.uid()` — its *other* site passes `p_assigned_to`) ·
`public.get_referral_case_access_summary` (`p_commission_id, auth.uid()`).

⚠ **`app._audit_access_authorized` uses BOTH call forms and is NOT an ADR 0201 D3 violation.** Its
`is_member_of(…)` arms and its `is_member_of_for(…, v_uid)` arm sit in **different `case` branches**,
and `v_uid` is `auth.uid()`, so **every** arm answers about the caller. ⛔ A grep that pairs the two
forms and calls it a mixed-keying disjunction would be wrong here; the body had to be read.

### 3.2 The permission-shaped doors — 15 functions, the ones that become rows

Caller-keyed unless the **subject** column says otherwise.

| function | `prosecdef` | subject | what it gates | row |
| --- | --- | --- | --- | --- |
| `public.notify_safety_event` | `t` | caller | *"apenas membros da comissão notificante podem registrar um evento"* | 18 |
| `public.cast_case_vote` | `t` | caller (`_for` + `auth.uid()`) | casting an ethics-case vote | 12 |
| `public.create_referral_internal_note` | `t` | caller (arm 1) | authoring a referral internal note | 21 |
| `public.get_referral_case_access_summary` | `t` | caller | the referral case-access summary | 20 |
| `public.documents_due_for_review` · `public.list_commission_documents` | `t` | caller | controlled-document lists | 16 |
| `public.get_standard_assessment` · `public.readiness_evidence` · `public.readiness_report` | `t` | caller | accreditation reads | 15 |
| `public.indicator_series` | `t` | caller | indicator series | 14 |
| `public.meeting_cadence_status` · `public.suggest_carry_forward` | `t` | caller | charter cadence / carry-forward (`HC0K2` on non-members) | 5 |
| `app.can_reach_meeting` | `t` | `p_uid` | meeting reach (+ the visibility/attendee conjunct) | 6 |
| `app.can_sign_meeting` | `t` | `p_signer` | minutes signature (+ present attendee + `status='in_signature'`) | 8 |
| `app.can_read_action_item` | `t` | `p_uid` | committee-visibility action items | 11 |
| `app.can_read_document` · `app.can_read_document_of_version` | `t` | `p_uid` | document/version read | 16 |
| `app.can_read_event` | `t` | `p_user_id` | safety-event read (owner **or** reporting commission) | 17 |
| `app.can_read_capa` | `t` | `p_user_id` | indicator-sourced CAPA read | 19 |
| `app.can_read_referral_metadata` · `app.can_read_referral_internal_note(s)` | `t` | `p_uid` | referral metadata / notes | 20, 21 |
| `app._case_caps` | `t` | `p_uid` | the S5 arm — `read_case_deliberation` **only** | 9 |
| `app._audit_access_authorized` | `t` | caller | the audited-read registry; its member legs **mirror** rows 6 and 20 | — (§ 8.4) |

### 3.3 ⛔ MANAGED-ROW VALUE — 18 functions that are NOT rows

In each, `is_member_of_for` is a **precondition on the row being written** — the assignee, corrector,
reader, interviewer, attendee, appointee or approver must be a member. The **caller's** authority
comes from a *different* predicate in the same body (usually `is_staff_admin_of`). ⛔ Recording any of
these as a `staff` permission would convert *being assignable* into *being authorised*:

`public.activate_phase` · `add_ad_hoc_narrative` · `add_ad_hoc_phase` (INVOKER) · `add_interview_interviewer` ·
`add_meeting_attendee` (INVOKER) · `add_reserved_item` · `apply_minutes_review` · `assign_narrative` ·
`assign_referral_internal_note` · `assign_referral_reviewer` · `bulk_create_cases` ·
`create_committee_action_item` · `create_referral_internal_note` (its `p_assigned_to` arm) ·
`file_correction_request` · `grant_case_access` · `reassign_phase` · `update_committee_action_item` ·
`appoint_administrativo`.

⚠ **One more of this class sits on a DIFFERENT predicate and at a DIFFERENT scope**, and it is the
only place a commission-scoped role's membership is consumed at hospital grain:
`app.is_entitled_document_approver(p_hospital, p_user)` = `app.is_active(p_user) AND EXISTS(select 1
from public.commissions c where c.hospital_id = p_hospital and app.has_role_any('commission', c.id,
p_user))`. Its **one** live consumer is `public.submit_document_for_approval`, which raises `HC091`
*"aprovador não pertence a este hospital ou está inativo"*. ⇒ a `staff` of **any** commission in the
hospital is an eligible approver. Managed-row value, not a row — but see § 8.5, because it is a
commission→hospital ascent that `authz.candidate_has_permission` structurally cannot express.

### 3.4 ⛔ ALLOWLISTED — the capability plane

`app.member_can(p_commission_id, p_capability)` = `app.member_can_for(…, auth.uid())`, and
`app.member_can_for` = `app.feature_enabled('administrativo') AND app.is_active(p_user_id) AND
app.is_member_of_for(p_commission_id, p_user_id) AND EXISTS(… commission_administrativo_capabilities
…)`. Live flag value, resolved rather than assumed: **`app.feature_flags.administrativo.enabled =
true`.** Consumers: **12** functions, **3** policies (`meetings_staff_admin_{insert,update,delete}`).

⛔ **Out of scope by ruling** — ADR 0207 D5 step 6 and the plan's Proposed-order item 6 (*"mapped,
not merged"*); the authorization seam records `member_can` / `member_can_for` as **byte-unchanged
and md5-pinned in `422 § 5`**. Recorded here because it is a genuine `staff` reach that a reader
will otherwise re-derive, and because § 8.2 measures that it **contaminates the seed fixture**.
⛔ Nothing in this unit may map `schedule_meetings` / `create_cases` / `assign_case_phases` to
`commission.meetings.manage` / `commission.cases.manage`.

---

## 4. Planes 4 and 5 — the TS enforcement surface and the E2E behavioural surface

Folded into the site column of § 5, with the load-bearing structure recorded here.

### 4.1 ⭐⭐ THERE IS NO POSITIVE `staff` BRANCH IN `src/**`

```
grep -rnE "(===|!==)\s*['\"]staff['\"]" src --include=*.ts --include=*.tsx | grep -v "\.test\."   → 6 lines
grep -rnE "access\.role\s*(===|!==)\s*['\"]staff['\"]" src/app                                    → 0 lines
```

All six test something other than the caller: two test the **listed** member
(`src/components/members/member-list.tsx:68,123`) and four are two-role **admission filters**
(`src/lib/queries/members.ts:122`, `org-users.ts:356,743`, `session-grants.ts:93`). ⇒ **`staff` is a
FLOOR in the TS plane, never a discriminator** — every route either admits `access.role !== null`
(**24** sites) or narrows to `staff_admin` (**44** sites across 35 files) / `canConfigureCommission`
(**20** sites). The only role-keyed caller branch in the whole tree is the sidebar allowlist
`roles: ["staff","staff_admin"]` (`src/components/shell/app-sidebar.tsx:193,208,214,222,231,240,248,257,264`,
consumed at `:574`) — display only, ⛔ **T** in § 5.0's taxonomy.

Two server guards are genuinely membership-keyed (stricter than "authenticated", not owner-of-row):
`src/lib/responses/actions.ts:282-287` (`authorizeMember`, gating 9 call sites incl.
`start_or_resume_response` at `:347`, `save_section_answers`, `submit_response`, `sign_section`) and
`src/lib/cases/result-actions.ts:142-146` (`authorizeCommissionMember`, gating
`set_case_phase_result_override` at `:398`). The capability seam is
`src/lib/queries/session.ts:771-775` — `canInCommission`, whose `access.role !== null` conjunct is
the membership floor under an Administrativo capability row.

### 4.2 Session partition and landing

`ROLE_MANIFEST` entry, `src/lib/role/role-catalog.ts:182-190`, verbatim:

```ts
  {
    code: "staff",
    label: "Membro de comissão",
    scopeKind: "commission",
    sessionSelectable: true,
    branch: "memberships",
    branchEmptyFallback: "/c",
    scopeSummary: "commission",
  },
```

Precedence is array index; `staff_admin` is the entry immediately above (`:173-181`), so it outranks
`staff` when a caller holds both. Landing chain, each link verified: `:187` `branch:"memberships"`
→ `ROLE_BRANCH` derived at `:278-280` → the branch body at `:429-436` (0 memberships → `null`; >1 →
`/c`; exactly 1 → `commissionHref(...)`) → `BRANCH_EMPTY_FALLBACK` at `:377-379`. Consumers:
`landingRouteForRole` (`:474-483`) and `src/app/page.tsx:102`. The shell partition that makes
`access.role` non-null is `src/lib/queries/session-grants.ts:93`.

⚠ **Measured divergence, filed not fixed:** `getSelectableRoles` (`session-grants.ts:238-248`) counts
grant rows by `g.role` and **does not read `sessionSelectable`**; the field's only consumers are
`src/lib/role/role-catalog.test.ts` and the two generator scripts. So the manifest's selectability
column is a drift pin, not a runtime input.

### 4.3 E2E — the personas, and the deny signal

Plain-`staff` seed personas (from the `memberships` INSERT, `supabase/seed.sql:602-641`, cross-checked
against the live table): 12 grants across 12 principals; beyond `multi@test.local` there are **11
further** plain-`staff` personas, of which three are composites and are ⛔ **not** clean subjects —
`staff1.qual.b` (also `staff_admin` of Farmácia B, `:631`), `pqsdual.a` (also NSP), `dr.john` (two
commissions). § 8.2 measures four more contaminations the seed line numbers do not show.

⚠ **The deny signal is UI text 186 times and an HTTP status 34 times** (`grep -rno "não encontr"
e2e --include=*.spec.ts | wc -l` → 186 across 54 files; `grep -rnoE
"status\(\)\)\.toBe\((404|403|401)\)" e2e --include=*.spec.ts | wc -l` → 34). The reason is stated
in the tree, not inferred: `e2e/case-access.spec.ts:372-374` records that a Next.js `notFound()`
inside a nested segment renders the boundary but returns **HTTP 200** in prod, so an in-shell route
denial is structurally unassertable by status. Only `e2e/case-surface-split-increment-2.spec.ts`
uses `expectNotFoundKind` (`e2e/helpers/not-found.ts:75`), which distinguishes *which* boundary
rendered. ⚠ `e2e/phase13-audit.spec.ts:883`'s title claims *"route guard returns 404"* while its
body asserts only page text — **title and assertion disagree**, filed in § 8.6.

Denials with a strong signal, which are the ones a `staff` differential can lean on:
`phase13-audit.spec.ts:851` (REST+JWT, zero audit rows) · `phase15-indicators.spec.ts:725` (**403**)
· `phase22-referrals-governance.spec.ts:822` (**42501**) · `phase22-referrals.spec.ts:1196,1214`
(**HC071/HC072**) · `action-items-satellites.spec.ts:609,717,774` (**HC0I0/HC0I1/HC0I2**) ·
`phase3-admin-members.spec.ts:494,520` (**404** via `page.request.get`).

---

## 5. The matrix

### 5.0 Enforcement sites come in THREE kinds — the taxonomy is AE4.3 § 4.0's, unchanged

**R** = RLS policy (the door may be INVOKER with no gate of its own) · **D** = DEFINER door body
(`prosecdef = t`; the gate **replaces** RLS) · **T** = TS guard (⛔ defence in depth **only**; a
T-only row is a finding).

⭐ **The measured instance that forces the distinction for `staff` is `public.submit_response`**:
`prosecdef = f` (**INVOKER**) and its body contains **no membership gate of any kind**. Submission
is gated entirely by `responses_update_own_draft` (`created_by = auth.uid() AND status =
'in_progress'`) — an **R** site with an ownership predicate. Reading only door bodies would record
submission as ungated; reading only policies would miss every DEFINER read in § 3.2.

### 5.1 Scope exclusions, stated so the next reader does not re-derive them

⛔ **"Who may grant or revoke `staff`" is NOT in this matrix.** `app.grant_role_impl` /
`app.revoke_role_impl` dispatch on `p_role in ('staff','staff_admin')` and are gated on
`is_staff_admin_of_for` / the tenancy admins; that belongs to the `staff_admin`, `org_admin` and
`hospital_admin` matrices. The whole of § 4's "administered value" list in `src/**` (the
`grant_role` / `revoke_role` doors at `src/lib/members/actions.ts:285,329`, the role `<select>` at
`src/components/users/committee-role-assigner.tsx:185`, the badges and rosters) is excluded by the
same rule.

⛔ **OWNERSHIP-KEYED capabilities are NOT rows.** Measured, not assumed: in the whole response
family exactly **one** policy carries a membership term (`responses_insert_own`). Every other
lifecycle step — `responses_update_own_draft`, `responses_delete_own_draft`, `answers_write_own_draft`,
`response_group_instances_write_own_draft`, `answer_selected_options_write_own_draft`,
`answer_matrix_cells_select`, `responses_select`, `app.can_read_signoff`, and the *respondent* arm of
`app.can_sign_section` (`s.signoff_role = 'respondent' AND r.created_by = p_signer`) — is keyed on
`created_by = auth.uid()`. § 8.1 measures what that means and disposes of it as a PA-F8 divergence.

⛔ **PERSONAL ASSIGNMENT and EXPLICIT GRANTS are NOT rows** — the same exclusion AE4.3 applied to
`legal_privileged` clearance and `/casos` phase-filling. S3 (`case_access_grants`) and S4
(phase/narrative assignment) in `app._case_caps` confer content+deliberation to *anyone*, member or
not; they are not role-derived. § 8.2 shows the seed makes this trap easy to fall into.

⛔ **The `administrativo` capability plane is NOT in this matrix** — § 3.4.

### 5.2 The matrix — 21 proposed rows

**18 codes are NEW** (they do not exist in `authz.permissions`, measured: 43 codes, listed in full
by `select code from authz.permissions order by code`) and **2 already exist and are held by
`staff_admin`** — rows 7 and 18, marked ⭐SHARED. `18 + 2 = 20` held rows. Every code resolves at `commission`, matching
`authz.roles.staff.allowed_scope_kind`; ⛔ no row is org- or hospital-scoped (contrast AE4.3 rows
30–33), which is what makes `authz.candidate_has_permission`'s scope-kind gate a no-op for this
increment.

`risk_class` values are the live domain's (`read` · `write` · `authority` · `irreversible`);
`sensitivity` is `authz.permissions.sensitivity_ceiling`'s three-class partition. **arm-3** marks a
row whose door carries a non-permission conjunct that no existing axis varies (plan `:1216-1234`).

| # | proposed permission code | resource_kind | risk_class | sensitivity | arm-3 | enforcement sites (R / D / T) |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `commission.forms.read` | commission_content | read | none | — | **R** 8 SELECT policies (`forms`, `form_versions`, `form_sections`, `form_items`, `form_item_options`, `form_item_validations`, `form_matrix_rows`, `form_matrix_columns`) + **R** `storage.objects.form_assets_select_member` · **T** `src/app/o/[org]/c/[commission]/forms/page.tsx:32` · **E2E** `phase-multitenancy.spec.ts:345,355` |
| 2 | `commission.responses.fill` | commission_content | write | none | — | **R** `responses.responses_insert_own` (`with_check = created_by = auth.uid() AND app.is_member_of(commission_id)`) — ⭐ **the ONLY membership-gated write policy in the database** · **T** `src/lib/responses/actions.ts:282-287` gating `:347` `start_or_resume_response` · **E2E** `phase5-wizard.spec.ts` · ⛔ see § 8.1 |
| 3 | `commission.responses.own.read` | commission_content | read | none | — | ⛔ **PROPOSED AS A NON-ROW** — kept in the table so the omission is visible. `responses_select`'s first leg is `created_by = auth.uid()`; there is **no** membership leg. § 5.1 |
| 4 | `commission.roster.read` | identity | read | none | — | **R** `memberships.memberships_select` · **R** `commissions.commissions_select_member_or_admin` · **R** `commission_member_titles.member_titles_select` · **R** `profiles.profiles_select_self_or_admin` (the **co-member** leg, § 2) · **T** `src/lib/queries/members.ts:122` |
| 5 | `commission.charter.read` | commission_content | read | none | — | **R** `commission_charters.commission_charters_select` (member-only — no tenancy arm) · **D** `public.meeting_cadence_status`, `public.suggest_carry_forward` (both raise `HC0K2` *"você não é membro desta comissão"*) |
| 6 | `commission.meetings.read` | commission_content | read | none | ⚠ **yes** | **R** `meetings.meetings_select` — `is_member_of AND (visibility_policy = 'commission_default' OR attendee)` · **R** `meeting_settings_select`, `meeting_types_select` · **D** `app.can_reach_meeting` (subject `p_uid`; same conjunct) · **D** `app._audit_access_authorized` `'meeting.viewed'` leg · **E2E** `phase10-meetings.spec.ts:1025` 🚩UI-text |
| 7 | `commission.meetings.cases.shell.read` ⭐SHARED | commission_content | read | none | — | **R** `meeting_cases.meeting_cases_select` = `app.can_reach_meeting(meeting_id, auth.uid()) AND NOT app.is_case_respondent(case_id, auth.uid())`. ⭐ **`staff` holds AE4.3's row 13 in full** — the shell is member-wide; rows 14/15 (substance, decision) are **NOT** held, and § 8.3 measures the projection that strips them |
| 8 | `commission.meetings.minutes.sign` | commission_content | write | none | ⚠ **yes** | **R** `meeting_signatures.meeting_signatures_insert` — `signer_id = auth.uid() AND app.can_sign_meeting(attendee_id, auth.uid())` · **D** `app.can_sign_meeting` = `is_member_of_for(m.commission_id, p_signer) AND a.attendance = 'present' AND m.status = 'in_signature'`. The attendance + status conjuncts are the arm-3 coordinate |
| 9 | `commission.cases.deliberation.read` | commission_content | read | none | ⚠ **yes** | **D** `app._case_caps` **S5** — `if v_member and not v_eg then read_case_deliberation`. `v_eg` (`visibility_policy = 'explicit_grants_only'`) is the arm-3 coordinate. Consumers of the bit: `app._project_meeting_case`, `app._project_meeting_agenda_item`, `public.get_reserved_session_items`, `app.resolve_document_version_bytes`. ⛔ **`app.can_reach_case_on_member_surface` is the NAMED authorizer for exactly this bit and has ZERO production callers** — § 8.3 |
| 10 | `commission.cases.read` | commission_content | read | none | — | ⛔ **NOT HELD — and this is the most counter-intuitive row in the matrix.** AE4.3 row 41's site is `app.can_read_case`, which is `has_case_capability(…, 'read_case_content')`. S5 confers **only** `read_case_deliberation`, so `cases.cases_select` (= `can_read_case`) **denies a plain member on every case**. Measured in § 8.2 |
| 11 | `commission.action_items.read` | commission_content | read | none | ⚠ **yes** | **R** `action_items.action_items_select`, the `visibility_scope = 'committee'` leg · **D** `app.can_read_action_item` (subject `p_uid`; `if v_scope = 'committee' then return app.is_member_of_for(...)`, behind an `is_case_excluded` hard deny) · **E2E** `action-items-satellites.spec.ts:504,577` 🚩UI-text |
| 12 | `commission.cases.vote` | commission_content | write | none | — | **D** `public.cast_case_vote` — `is_member_of_for(v_commission, auth.uid())`, `42501` on failure. Caller-keyed via the `_for` form (§ 3.1) |
| 13 | `commission.process_templates.read` | commission_content | read | none | — | **R** 9 SELECT policies (`process_templates`, `process_template_versions`, `process_template_phases`, `..._custom_fields`, `..._narratives`, `..._outcomes`, `..._phase_allowed_results`, `..._phase_offered_results`, `phase_results`) |
| 14 | `commission.indicators.read` | commission_content | read | none | — | **R** `indicators.indicators_select`, `indicator_measurements.indicator_measurements_select` · **D** `public.indicator_series` · **E2E** `phase15-indicators.spec.ts:725` (**403** on the write — a strong-signal deny) |
| 15 | `commission.accreditation.read` | commission_content | read | none | — | **R** `accreditation_frameworks_select` (⚠ NULL-owner arm, § 2), `accreditation_standards_select`, `evidence_links_select`, `standard_assessments_select` · **D** `public.get_standard_assessment`, `public.readiness_evidence`, `public.readiness_report` · **E2E** `phase16-accreditation-core.spec.ts:492` |
| 16 | `commission.documents.read` | commission_content | read | none | — | **R** `controlled_documents_select`, `controlled_document_versions_select` · **D** `public.list_commission_documents`, `public.documents_due_for_review`, `app.can_read_document`, `app.can_read_document_of_version` (subject `p_uid`). ⚠ `app.resolve_document_version_bytes` additionally requires the row-9 bit for case-homed documents |
| 17 | `commission.safety_events.read` | commission_content | read | none | — | **D** `app.can_read_event` — `is_member_of_for(e.current_owner_commission_id, p_user_id) OR is_member_of_for(e.reporting_commission_id, p_user_id)`; ⭐ **two commissions reach one event**, which is a scope shape no single `scope_id` cell can express (§ 8.5) |
| 18 | `commission.safety_events.report` ⭐SHARED | commission_content | write | none | — | **D** `public.notify_safety_event` — `if not app.is_member_of(p_reporting_commission_id) then raise …`. ⭐ **`staff` holds AE4.3's row 28 in full**: reporting a safety event is a MEMBER act, not a coordinator act · **E2E** `phase14a-safety-events.spec.ts` |
| 19 | `commission.capa.read` | commission_content | read | none | — | **D** `app.can_read_capa`, third arm — an **indicator-sourced** CAPA is readable by the indicator's commission members (`cp.source = 'indicator' AND is_member_of_for(i.commission_id, p_user_id)`). ⛔ The event-sourced arm is `can_read_event`'s, i.e. row 17, not this one |
| 20 | `commission.referrals.metadata.read` | commission_content | read | none | ⚠ **yes** | **D** `app.can_read_referral_metadata`, `app.can_read_referral_internal_note(s)` (subject `p_uid`), `public.get_referral_case_access_summary` (caller-keyed), `app._audit_access_authorized` `'referral.case_access_summary_viewed'` leg. Arm-3 coordinate: the **target** side reaches only when `r.status <> 'draft'`; the source side always. ⛔ **PHI is NOT here** — `commission.referrals.phi.read` (AE4.3 row 27) gates on `app.can_read_referral_phi`, which has no member arm |
| 21 | `commission.referrals.notes.author` | commission_content | write | none | — | **D** `public.create_referral_internal_note` — arm 1 is `is_member_of_for(p_committee_id, auth.uid())` plus *"apenas um membro da comissão de origem ou destino"* · **E2E** `phase22-referrals.spec.ts:1520,1714` 🚩UI-text |
| 22 | `commission.cases.vocabulary.read` | vocabulary | read | none | — | ⭐ **ADDED by § 9.1's reconciliation — these three policies had NO row until the parts were forced to sum.** **R** `case_narrative_types.case_narrative_types_select`, `case_outcomes.case_outcomes_select`, `case_tags.case_tags_select`, each `app.is_member_of(commission_id) OR app.is_tenancy_admin_of(commission_id)`. ⛔ **Not** the same code as the existing org-scoped `org.case_vocabulary.manage` (AE4.3 row 32), which governs *ethics allegation categories / sanction types / case assignment roles* at `organization` scope — different tables, different resolution scope |

**Row count: 22 lines, of which 20 are held rows** — rows 3 and 10 are **non-rows kept visible on
purpose**, because their absence is the surprising half and a matrix that simply omits them invites
the next reader to add them back. ⇒ the codes proposed for `authz.role_permissions` are the **20**
in rows 1–2, 4–9, 11–22.

⭐ **Row 22 is the derivation's own near-miss, recorded rather than quietly fixed.** The first draft
of § 5.2 had 21 lines and the § 9.1 reconciliation showed 39 SELECT policies mapping to 36. Three
were unmapped — and the *aggregation table in § 2 still summed to 39*, because they had been bucketed
under a family whose row existed. ⇒ **a count that sums is not a mapping**, and the check that caught
it was asking each policy which row it lands on, one at a time.

⚠ **Two capabilities the planes show that are NOT role-derived and therefore not rows**, recorded so
the exclusion is auditable: RCA authorship (`e2e/phase14c-rca.spec.ts:607` — an *assigned* plain-staff
SME writes, via `rca_members`, not via membership) and interview authorship
(`e2e/phase11-interviews.spec.ts:833` — a *registered interviewer*, via `case_interview_interviewers`).
`app.can_write_rca` and `app.can_write_interview` were read in full: **neither contains
`is_member_of`**, and their non-admin arms are explicit membership tables of their own.

---

## 6. Deny classes: what this matrix's shape CAN and CANNOT express

Values are in [`authz-ae5-staff-deny-class-effects.md`](authz-ae5-staff-deny-class-effects.md); this
section is the *shape* statement, mirroring AE4.3 § 6.

| deny class | expressible as a permission? | why / where it must live instead |
| --- | --- | --- |
| **wrong scope** | ✅ **yes** | it *is* the `scope_id` argument |
| **cross-org** | ⛔ **NO — third category: enforced by nothing, unreachable by id-space** | AE4.3 § 6.1's finding is inherited **and widened**: `app.has_role_any`'s whole scope test is `m.commission_id = p_scope_id`, with no org term, and it admits the *union* of commission-tier roles. Deny-class doc § 2 |
| **inactive** | ❌ no | `app.is_active`, a property of the principal, applied in `is_member_of(_for)` **and** in `authz.assignment_facts` |
| **suspended** | ❌ no | same predicate, same place; **not independently observable** (deny-class doc § 3 Limitation A) |
| **expired seat** | ❌ no | a property of the assignment row; ✅ applied on **both** sides (§ 1.2) — no `staff` analogue of AE4.3 § 1.2's five-site gap |
| **wrong active context** | ❌ no | a session property carrying the § 6A asymmetry |

**2 of 6 expressible; 3 owned by the adapter; 1 (cross-org) enforced by nothing.** ⛔ It may not
enter the gate record as a property the catalog expresses.

---

## 6A. ⭐ THE ACTIVE-CONTEXT ASYMMETRY FOR `staff` — and it is ALREADY ENFORCED

Given its own section, matching AE4.3 § 6A, because the increment's opening brief says the opposite
and a reader who trusts the brief will build the wrong cutover.

`app.has_role_any`'s active-context term, **verbatim from `pg_get_functiondef` on the live catalog**:

```sql
and (p_user_id is distinct from auth.uid() or m.role is not distinct from app.active_role())
```

`app.is_member_of(p_commission_id)` is `app.is_active(auth.uid()) and app.has_role_any('commission',
p_commission_id, auth.uid())` — so **the hat term is present, one level down**, and it applies with
exactly the AE4.3 asymmetry: **only to self-checks**.

**Measured behaviourally**, caller `staff4.ccih@test.local` (a clean `staff` of CCIH), each in a
rolled-back transaction with `set local role authenticated` and a synthesised `request.jwt.claims`:

| coordinate | `is_member_of(CCIH)` | `is_member_of_for(CCIH, dr.john)` |
| --- | --- | --- |
| `activeContext = matching` (`active_role = 'staff'`) | **true** | — |
| `activeContext = other_role` (`active_role = 'staff_admin'`) | **false** | **true** |
| `activeContext = absent` (no `active_role` claim) | **false** — `app.active_role()` is NULL and `is not distinct from` fails closed | **true** |

⇒ **the hat gate for `staff` fires today, and a third-party check skips it today.** Both facts are
required and both are measured.

**REQUIREMENT for the cutover.** The substitution must **preserve** the asymmetry, not introduce it.
`authz.holds_role`'s own term is `p_principal is distinct from (select auth.uid()) or af.role_code is
not distinct from app.active_role()` — the same shape with one difference of grain, and § 7.2 shows
that difference is unreachable. ⛔ **A caller-keyed arm is never placed beside a `p_uid`-keyed one in
a single disjunction** (ADR 0201 D3); § 3.1 confirms the one function using both forms
(`app._audit_access_authorized`) puts them in different `case` branches, both answering about the
caller, so no existing site violates the rule and no new one may.

⚠ **`424` must cover both polarities**: the `wrong_active_context` deny class needs a self-check cell
(where it denies) **and** a third-party cell (where it must not). A generator emitting only the first
passes while pinning the uniform-apply bug, which would break **35** third-party call sites.

---

## 7. R-1 and R-2, RE-MEASURED ON THE LIVE CATALOG

The record's § Open rulings state both from **migration text**. Both were re-measured. **R-1 is
confirmed. R-2's stated premise is REFUTED, and what survives is a different and much smaller
divergence.** Where the catalog contradicts the record, both readings are given below.

### 7.1 R-1 — ✅ CONFIRMED: `staff` has no single-role wrapper, and no predicate names it

**Record's claim** (`docs/progress/ae5-staff.md` § R-1, from `20260720000100:66-68`): `is_member_of`
/ `is_member_of_for` are role-SET predicates; `holds_role` takes one `p_role_code`; no `is_staff_of*`
exists.

**Measured, live**: exact, from `pg_get_functiondef`.

```sql
app.is_member_of(p_commission_id uuid)                       -- prosecdef=t, STABLE, search_path='app, public, pg_catalog'
  select app.is_active((select auth.uid()))
     and app.has_role_any('commission', p_commission_id, (select auth.uid()));

app.is_member_of_for(p_commission_id uuid, p_user_id uuid)   -- prosecdef=t, same volatility/path
  select app.is_active(p_user_id)
     and app.has_role_any('commission', p_commission_id, p_user_id);
```

Neither names a role. `app.has_role_any` selects any `memberships` row in the scope. ✅ Confirmed,
and three facts are added that the migration text could not give:

1. **No commission-scope predicate names `staff`.** `select proname … where prosrc ~ '''staff'''`
   over `app`/`public`/`authz` returns **3**, all administering (§ 0.1). **Zero** policies.
2. **The complete commission-scope predicate population is 4**, derived from the callers of
   `app.has_role_any` (`select proname … where prosrc ~ 'has_role_any\('` → 7, of which
   `is_member_of`, `is_member_of_for`, `is_entitled_document_approver` and `public.appoint_hospital_dpo`
   reach the commission tier; `is_hospital_member_of`, `is_org_member`, `is_dpo_of_for` are other
   tiers). Keying: `is_member_of` **caller** · `is_member_of_for` **`p_user_id`** ·
   `is_entitled_document_approver` **`p_user`, at HOSPITAL scope** (§ 3.3, § 8.5) ·
   `public.appoint_hospital_dpo` **`p_user_id`**, a managed-row value.
3. **`authz.holds_role` has exactly TWO live dependents** — `app.is_staff_admin_of` and
   `app.is_staff_admin_of_for`, each a one-line delegation. That is the shape the `staff` cutover
   must mirror, and it is the shape R-1 proposes a wrapper for.

⛔ **One consequence for the T6 plan that neither the record nor the plan states:**
`authz.holds_role` requires `r.state = 'authoritative'` — there is **no `candidate_holds_role`**
(measured: the `authz` schema holds 10 functions and none is a candidate twin of `holds_role`).
`authz.candidate_has_permission` is the only `test_validation`-aware evaluator. ⇒ **the wrapper
cutover cannot be pre-flighted under `test_validation` the way the permission differential can**;
its before/after is provable only inside the cutover migration's own snapshot/assert block.

### 7.2 R-2 — ⛔ REFUTED AS STATED, and the surviving divergence is UNREACHABLE

**Record's claim** (§ R-2): *"`holds_role` applies the active-role filter on self-checks
(`20261003007210:110-114`); `is_member_of` carries no `active_role` term."*

**Measured, live: the second half is FALSE.** `is_member_of` carries the term — in
`app.has_role_any`, the function it delegates to (§ 6A, with the behavioural table). The record's
reading came from `is_member_of`'s own two-line body, which does not contain the string; the term is
one delegation away. ⇒ **cutting `staff` over to `holds_role` does not "add a hat gate it lacks
today".**

**What actually differs is the GRAIN of the hat conjunct**, and it is a real difference:

| | hat conjunct | satisfied by |
| --- | --- | --- |
| `app.has_role_any` | `m.role is not distinct from app.active_role()` | **any** membership row *in that commission* whose role equals the hat |
| `authz.holds_role` | `af.role_code is not distinct from app.active_role()` | only the role code **being asked about** |

These diverge on exactly one state: **a caller holding BOTH `staff` and `staff_admin` in the SAME
commission, wearing the `staff_admin` hat** — `is_member_of` would be true, `holds_role('staff')`
false. ⛔ **That state is UNCONSTRUCTIBLE.** `memberships_one_commission_role_uq` is
`UNIQUE (principal_id, commission_id) WHERE commission_id IS NOT NULL`; the attempt raises `23505`
(§ 1.1). ⇒ on the commission tier, `is_member_of(C)` and `holds_role(u,'staff',…) OR
holds_role(u,'staff_admin',…)` are **hat-equivalent by structure**, not by argument.

Measured for the single-role case, `staff` forced to `test_validation` inside a rolled-back
transaction (`update authz.roles set state='test_validation' where code='staff'`; state re-read as
`legacy` after rollback):

```
hat = staff        : is_member_of = true   holds_role(staff) = false   ← the STATE gate, not the hat
hat = staff_admin  : is_member_of = false  holds_role(staff) = false
hat = absent       : is_member_of = false  holds_role(staff) = false
```

The `holds_role` column is uniformly false because `test_validation` is not `authoritative` — which
is § 7.1's last point, restated as evidence.

**Live dependent count for the re-key, from the catalog and not from migration text.** The record's
provisional figures were *"83 `app.is_member_of(` in 53 files, 123 `_for(` in 59"* — those are
**file-text** counts over `supabase/migrations`, i.e. history. Live:

| plane | bare `is_member_of` | `is_member_of_for` | distinct objects |
| --- | ---: | ---: | ---: |
| `pg_policies` | **40** | **0** | 40 |
| `pg_proc` (functions) | **10** | **33** | **42** (1 uses both) |
| **total distinct dependents** | | | **82** |

⇒ the re-key population is **82 catalog objects**, not ~200 text hits. ⛔ Both readings are recorded
because they answer different questions; the migration figures are not wrong, they are not live.

### 7.3 What this means for the two rulings

⛔ **Proposals, not decisions.** R-1's recommendation (introduce `app.is_commission_staff_of(_for)`
and cut *it* over) is **still needed** — a set predicate cannot be routed through a single-role
resolver — but § 7.2 removes the reason to fear it: re-expressing `is_member_of` as
`holds_role(staff) OR holds_role(staff_admin)` is answer-preserving on the hat axis **by index**, and
becomes available the moment `staff` is `authoritative`. **The disposition this matrix proposes for
R-2 is therefore (a) — no divergence to except — conditional on two things being asserted rather
than assumed:** (i) `memberships_one_commission_role_uq` exists and has the quoted definition;
(ii) the commission tier is exactly `{staff, staff_admin}` per `memberships_scope_shape`. ⛔ If
either is ever relaxed the divergence becomes real and silent, so both belong in the cutover's
pgTAP, not in this prose.

---

## 8. Findings — the could-not-verify list, as work items

⛔ **Every held row in § 5.2 has at least one R or D site.** No row is T-only. What follows is the
residue.

### 8.1 ⛔⛔ MEASURED: a revoked `staff` keeps, edits and SUBMITS their draft

The sharpest finding in this matrix, and a PA-F8 divergence the PO must dispose of. Executed inside
a rolled-back transaction as `staff4.ccih@test.local`:

```
1. as authenticated, member of CCIH : insert into public.responses(...) → INSERT 0 1      (responses_insert_own)
2. as postgres : delete from public.memberships where principal_id = <staff4> and commission_id = <CCIH>   → DELETE 1
3. as authenticated again          : app.is_member_of(CCIH) = false
4.                                  : the draft is still visible                          (responses_select, created_by leg)
5.                                  : update public.responses set updated_at = now() …    → UPDATE 1
6.                                  : select public.submit_response(<draft>)               → status = 'submitted'
```

A **submitted, immutable, dashboard-counted** response authored by a non-member. The mechanism is
not a bug in any one policy: `responses_insert_own` is the only membership gate in the family, and
every later step is ownership-keyed (§ 5.1). ⇒ under the catalog, `commission.responses.fill` would
**deny** at steps 5–6 while the legacy path **grants**.

**Proposed disposition: (b) — a named compatibility exception with owner and expiry**, encoded in
`424`'s **`expected_legacy_granted`** column and ⛔ never in `expected_granted` (the ⚠⚠ block, plan
`:1223-1227`: the catalog is *right* to deny where a legacy arm grants for a reason it has no
mechanism for). ⛔ **Not (a)** — nothing has fixed it. ⛔ **Not (c)** unless the PO reads
"finish the form you started" as a defect rather than a feature; that is the PO's call, not the
lead's and not mine. ⚠ Whichever way it goes, the *reason* must travel with the cell: a reviewer
seeing "legacy grants, catalog denies" on a response write will otherwise try to widen the catalog.

### 8.2 ⛔ THE SEED'S PLAIN-`staff` PERSONAS ARE CONTAMINATED IN FIVE DIFFERENT WAYS

Measured over `app._case_caps(case, uid)` for every `staff` of CCIH on `visibility_policy =
'commission_default'` cases. Bit values: `1` overview · `2` deliberation · `4` content · `32` write.

| persona | caps | contaminating source |
| --- | --- | --- |
| `ativo.registro@test.local` | `2` | ✅ none |
| `dr.john@test.local` | `2` | ✅ none (but holds `staff` in a **second** commission) |
| `staff4.ccih@test.local` | `2` | ✅ none |
| `staff1.ccih@test.local` | `2, 6` | a **phase assignment** and a case grant |
| `staff2.ccih@test.local` | `6` | the full **`administrativo`** bundle (5 capabilities, incl. `read_cases` → S8) and a narrative assignment |
| `staff3.ccih@test.local` | `2, 38` | a case grant conferring `write_case_content` |
| `multi@test.local` | `2, 6` | a case grant |
| `pqsdual.a@test.local` | `2, 6` | the **S6 NSP/PQS** arm (a second role) |
| `suspenso.temp@test.local` | `0` | the `is_active` gate — correct, and this one is a *deliberate* fixture |

⇒ **3 of 9 are usable as `424`'s `subject_holder`.** ⛔ `staff1.ccih@test.local` is the name a reader
reaches for first and is the worst choice. This is a **T11 / T13** item, and it is also the proof of
row 10: on the three clean personas the role-derived reach is uniformly `2` — deliberation only —
so `app.can_read_case` (= `read_case_content`) is **false** and `cases.cases_select` denies.

### 8.3 ⛔ `app.can_reach_case_on_member_surface` IS A DESIGNATED AUTHORITY WITH ZERO CALLERS

The predicate is `select app.has_case_capability(p_case_id, p_uid, 'read_case_deliberation')` — row
9's bit, exactly — and its own header comment (live, `obj_description`) says: *"Use this — NOT
can_read_case_or_admin — on member-facing case-reach surfaces."*

Measured: **0** function bodies and **0** policies call it. A repo-wide sweep
(`grep -rn "can_reach_case_on_member_surface" --include=*.sql --include=*.ts --include=*.tsx
--include=*.mjs --include=*.py .`) returns hits in **11 files**, all of them migrations (its own
definition and history) or pgTAP (`231`, `233`, `249`). Its last production conjunct was dropped by
`20260805000000_authz_c1_meeting_cases_projection.sql:16`. It still holds `grant execute … to
authenticated`. Meanwhile the bit it names is tested **inline** at four sites
(`app._project_meeting_case`, `app._project_meeting_agenda_item`, `public.get_reserved_session_items`,
`app.resolve_document_version_bytes`).

⚠ Its comment additionally warns against `can_read_case_or_admin`, a predicate **retired** by
`20260814000000`. ⇒ **a stale instruction beside a dead authority.**

⇒ **T7 work item:** row 9's re-key target is this predicate, and re-keying it is not enough — it must
be **WIRED**. A layer-3 authorizer carrying `commission.cases.deliberation.read` as a greppable
literal that nothing calls satisfies the grep and enforces nothing.

### 8.4 The audited-read registry MIRRORS two rows and must not become a third

`app._audit_access_authorized`'s member legs (`'meeting.viewed'`, `'interview.viewed'`,
`'referral.case_access_summary_viewed'`) restate rows 6 and 20 so the registry cannot be laxer than
the door it records. ⛔ Not a row of its own. ⚠ But note its `if coalesce(app.is_admin(), false) then
return true;` short-circuit sits **above** every leg — a pre-existing property of all its arms,
recorded in its own comment, and unchanged by this increment.

### 8.5 Two scope shapes no single-`scope_id` cell can express

1. **Row 17** — `app.can_read_event` reaches through **either** `current_owner_commission_id` **or**
   `reporting_commission_id`. One event, two commissions. A cell keyed on one `scope_id` measures one
   arm; a differential that sweeps only the owner arm leaves custody transfer unmeasured.
2. **`app.is_entitled_document_approver`** (§ 3.3) ascends **commission → hospital**: a `staff` of any
   commission in the hospital is an eligible approver. `authz.candidate_has_permission` rejects a
   `p_scope_kind` that disagrees with the permission's `resolution_scope_kind`, so this ascent is
   **structurally inexpressible** for a commission-scoped role. It stays a managed-row value and is
   ⛔ **not** proposed as a row — recorded so a later increment does not invent
   `hospital.documents.approve` and hang it on `staff`.

### 8.6 Filed, not fixed — three observations with their measurements

- **`app.is_member_of` carries an unreachable PUBLIC EXECUTE ACL entry** (`proacl` = `{=X/postgres,
  postgres=X/…, authenticated=X/…, service_role=X/…}`) that its own `_for` twin does **not**. `anon`
  holds no USAGE on schema `app`, so it is unreachable today. This is a **second member** of a class
  `docs/backend-state/authorization-and-audit.md` § Open edges records for `app.is_admin()` as one of
  three Batch-10 items filed-not-fixed. ⛔ No revoke in this unit.
- **`is_member_of`, `is_member_of_for` and `has_role_any` carry NO header comment at all**
  (`obj_description` = NULL for all three). ADR 0201 `:425-426` tells increment 1 to look first at
  `app.can_manage_professional`'s live header comment, *"which states its own keying **and** its own
  template obligation."* ⚠ **Measured, the live comment states the keying and carries no template
  obligation clause**; neither does `app.can_read_professional_profile`'s. Both readings are recorded.
  ⇒ the three-deep clause (ADR 0193 D5 · ADR 0200 · ADR 0201 D3) has **no carrier** on the very
  predicates this increment cuts over, and T6/T7 must write one rather than copy one.
- **`e2e/phase13-audit.spec.ts:883`'s title and assertion disagree** — the title claims *"route guard
  returns 404"*, the body asserts page text only. Not this unit's to fix; named so a `staff` gate
  record does not cite it as a status-level deny.

---

## 9. Reconciliation — enumeration is not mapping, and the parts must sum

### 9.1 Bottom-up: every live `staff` reach is accounted for

| population | count | disposition |
| --- | ---: | --- |
| policies calling `is_member_of` | **40** | 39 SELECT → rows **1** (9) · **4** (4) · **5** (1) · **6** (3) · **11** (1) · **13** (9) · **14** (2) · **15** (4) · **16** (3) · **22** (3) = `9+4+1+3+1+9+2+4+3+3` = **39** ✓ ; 1 INSERT (`responses_insert_own`) → row **2**. ⚠ **Row 7's site is NOT in this population** — `meeting_cases_select` reaches membership only transitively, through `app.can_reach_meeting`, and contains no `is_member_of` text of its own; a policy-text sweep is blind to it |
| functions calling `is_member_of(_for)` | **42** | **15** permission-shaped → rows (§ 3.2) · **18** managed-row value (§ 3.3) · **1** allowlisted (`app.member_can_for`, § 3.4) · **8** are the same functions counted once in § 3.2's multi-row groups (`can_read_document` ×2 sites, `can_read_referral_*` ×3, `readiness_*` ×2, `list_commission_documents`/`documents_due_for_review`) |
| functions naming the literal `'staff'` | **3** | 2 administered value (§ 5.1) · 1 managed-row value |
| other commission-tier `has_role_any` callers | **2** | `is_entitled_document_approver` (§ 8.5) · `appoint_hospital_dpo` (managed-row value) |
| policies naming the literal `'staff'` | **0** | — |

⚠ `15 + 18 + 1 = 34`, not 42. The residue is **8 functions that appear in more than one § 3.2 group
or in none** — resolved by listing them rather than by adjusting a total: `app.can_read_document`
(2 call sites, 1 row), `app.can_read_referral_internal_note` / `_notes` / `_metadata` (3 functions,
2 rows), `public.readiness_evidence` / `readiness_report` (2 functions, 1 row),
`public.documents_due_for_review` / `list_commission_documents` (2 functions, 1 row), and
`app._audit_access_authorized` (a registry, § 8.4). ⛔ A count that "sums" by silently folding these
would hide exactly the mapping the § header names.

### 9.2 Top-down: the write surface, which a predicate-keyed derivation misses systematically

The inverse control AE4.3 § 0 demands. Over `pg_policies` with `cmd in ('INSERT','UPDATE','DELETE','ALL')`
and `'authenticated' = any(roles)`: **107** write policies, of which **50** carry no admin predicate
(`is_staff_admin_of|is_tenancy_admin_of|is_admin|is_org_admin_of|is_hospital_admin_of|is_nsp|is_pqs|is_quality_reviewer|is_platform`).
Of those 50, exactly **two** are reachable by a plain `staff` through the role:

- `responses.responses_insert_own` → **row 2** (`is_member_of`);
- `meeting_signatures.meeting_signatures_insert` → **row 8** (`app.can_sign_meeting`, which contains
  `is_member_of_for`).

The other 48 partition into: ownership (`created_by` / `user_id = auth.uid()` / `id = auth.uid()`) —
the response family, notifications, notification preferences, profiles; **targeted-response**
(`app.can_write_targeted_response`, which requires `can_access_targeted_response`, not membership);
**case capability** (`app.can_write_case_content` = `has_case_capability(…,'write_case_content')` —
S5 confers no write bit, so a plain member fails); **PQS/NSP or explicit-membership tables**
(`app.can_write_capa` = `is_pqs_operator_of_for`; `app.can_write_rca` = PQS **or** an `rca_members`
row; `app.can_write_interview` = `is_staff_admin_of_for` **or** a `case_interview_interviewers` row);
**referral coordinator** (`can_manage_referral_source/target` = `is_staff_admin_of_for`);
**`can_edit_commission_forms`** (the re-keyed layer-3 for `staff_admin`); and
**`app.storage_upload_reserved`** (an `upload_sessions` reservation, not a role).

✅ **The top-down pass adds ONE row the bottom-up pass had already found (row 8) and no row it had
missed** — which is the result that makes § 5.2 a mapping rather than an enumeration.

### 9.3 Against `authz.permissions` as it stands

43 codes exist; `staff_admin` holds 42. **`staff` shares exactly 2** (rows 7 and 18) and needs **18
new codes**. ⚠ That is a large addition and the PO should see it as such: `staff_admin`'s matrix
enumerated *management* verbs, and the read verbs a member exercises were folded into them
implicitly. Rows 1, 4, 5, 13, 14, 15, 16 are the read halves of `staff_admin` codes that never had a
separate read code (`commission.forms.edit` has no `.read`; `commission.process_templates.manage` has
no `.read`; and so on). ⇒ approving this matrix implies `staff_admin` will hold those read codes too
at the moment they are seeded, or a coordinator will lose a read the day the sites re-key. ⛔ **That
is a consequence of approval, not a side effect to discover at T7** — it is item 4 of § 11.

---

## 10. Did the `.manage` reversibility rule bite?

Plan `:826-830`: `authz.permissions.risk_class` is per-permission, so **a code may not span a
reversibility boundary**, and every `.manage` shorthand needs the check.

**Result: `staff` proposes no `.manage` code at all**, so the rule bites in only one place — and it
bites the other way, on a **read** split:

- **Row 9 vs row 10** — `commission.cases.deliberation.read` and `commission.cases.read` are proposed
  as **two codes** because `app._case_caps` confers them from different arms with different reach
  (S5 vs S1/S3/S4) and `app.is_oversight_only_reader` already treats "content without deliberation"
  as a distinguishable state. Both are `risk_class = read`, so this is **not** a reversibility split;
  it is a **reach** split, and it is the one place this matrix asks the PO to divide an existing
  `staff_admin` code (AE4.3 row 41). ⚠ The alternative — `staff` holds `commission.cases.read` with a
  narrower reach — makes one code mean two different things depending on who holds it, which the
  differential cannot express. § 11 item 2.
- **Rows 20 vs 21** — `commission.referrals.metadata.read` (read) and
  `commission.referrals.notes.author` (write) are split at the read/write boundary, not bundled as
  `commission.referrals.member.participate`.
- **Row 8** — `commission.meetings.minutes.sign` is *not* folded into row 6: a signature is a write
  and, once `m.status` leaves `in_signature`, effectively terminal.

⚠ **Not checked, and deliberately out of scope:** whether any *existing* `staff_admin` `.manage` code
spans a boundary. AE4.3 § 8 owns that question.

---

## 11. § For PO approval

The PO is asked to rule **six** things. ⛔ Everything below is a **proposal**, not a decision, and
nothing in this file may be cited as approved until the ruling is recorded in
[`docs/progress/ae5-staff.md`](../progress/ae5-staff.md).

1. **The 20 held rows and their codes** — rows 1–2, 4–9, 11–22 of § 5.2, each with its
   `resource_kind`, `risk_class` and `sensitivity_ceiling`. These become
   `authz.role_permissions` rows for `staff` at T4 and the oracle's first input at T11.
2. **The row 9 / row 10 split** (§ 10) — does `staff` hold a **new**
   `commission.cases.deliberation.read`, or a **narrower reach** of the existing
   `commission.cases.read`? The matrix proposes the split; the alternative makes one code mean two
   things.
3. **The two non-rows kept visible** — row 3 (`commission.responses.own.read`) and row 10
   (`commission.cases.read`): confirm they are **NOT** held, so a later reader cannot add them back
   as an oversight correction.
4. **The read-code consequence for `staff_admin`** (§ 9.3) — 7 of the new codes are read halves of
   codes `staff_admin` holds only in `.manage`/`.edit` form. Approving them implies `staff_admin`
   receives them too, or loses a read at T7's re-key.
5. **The five arm-3 coordinates** (rows 6, 8, 9, 11, 20 — five marks, five distinct mechanisms:
   meeting `visibility_policy`/attendee · signature attendance+status · case `explicit_grants_only` ·
   action-item `visibility_scope` · referral target-side `status <> 'draft'`). Each needs a
   **PO expected value per class**, per the ⚠⚠ block at plan `:1229-1234`. ⛔ Without them the cells
   are satisfied by an empty join rather than by the predicate.
6. **The PA-F8 divergences.** Two were found; both are proposals:

| id | divergence | proposed disposition |
| --- | --- | --- |
| **PA-F8-STAFF-1** | § 8.1 — a revoked member keeps, edits and **submits** their draft; the catalog would deny, the legacy path grants | **(b)** named compatibility exception, owner **backend**, expiry to be set by the PO; encoded in `424`'s `expected_legacy_granted`, ⛔ never in `expected_granted` |
| **PA-F8-STAFF-2** | § 7.2 — the hat-grain difference between `has_role_any` and `holds_role` | **(a)** no divergence to except — it is unreachable under `memberships_one_commission_role_uq`; ⛔ conditional on that index and on `memberships_scope_shape`'s two-value commission tier being **asserted in the cutover's pgTAP**, not assumed |

**And two rulings this matrix hands back to the record** (R-1 / R-2, § 7): R-1 is **confirmed** and
its recommendation stands; **R-2's stated premise is refuted** and the surviving divergence is
structurally unreachable, so R-2 is proposed for closure as **(a)** rather than the planner's **(b)**.
⛔ Both remain PO rulings; § 7 is measurement, not a decision.
