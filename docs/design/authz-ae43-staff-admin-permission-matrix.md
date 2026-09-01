# AE4.3 — the `staff_admin` permission matrix

**Phase:** AE4 · **plan:** [`docs/plans/authz-evolution.md`](../plans/authz-evolution.md) § AE4.3 ·
**authority:** ADR [0155](../decisions/0155-post-aff4-tenancy-and-person-model-evolution-sequence.md) D7,
ADR [0162](../decisions/0162-authz-evolution-plan-audit-corrections.md) §2 (PA-F8) ·
**owner:** backend · **status:** 🟡 **DRAFT — awaiting PO approval** ·
**derived:** 2026-09-01 · **stack:** local, fresh reset, head `20261003007120`.

> ⛔ **On approval this matrix becomes the REGRESSION ORACLE** — from cutover, AE4.5 asserts
> `catalog = this document`, not `catalog = whatever legacy did`. That is why every row below
> carries a **named enforcement site** and every legacy divergence carries an **a/b/c
> disposition**. A row without a site is not a row; it is in § 7's findings list.
>
> ⛔ **The trap this document exists to avoid (PA-F8):** with "catalog = legacy" and
> "catalog = approved matrix" both required, the cheapest green is to approve a legacy defect
> *into* the matrix — a known bug becomes the new system's oracle. **Working rule applied
> throughout: when a site looks wrong, the default disposition is (c) BLOCKS until argued
> otherwise.** The burden sits on *keeping* the behaviour, never on challenging it.

---

## 0. Method, and one correction to the plan's stated method

Derived from all five planes the plan names. **Every SQL claim is from the live catalog**
(`pg_policies`, `pg_proc` incl. `prosecdef`, ACLs), comment-stripped; no migration file was
read for any claim, by rule.

⭐ **The plan's rule-3 pair trap is real, but its stated DIRECTION is false in both halves.**
The plan says *"policies call the bare form; functions call `_for`"*. Measured unanchored, then
classified:

| plane | bare `is_staff_admin_of` | `is_staff_admin_of_for` | total |
| --- | --- | --- | --- |
| `pg_policies` | **63** | **2** (`case_recusals_select`, `case_referral_insert_source_coord`) | **65** |
| `pg_proc` (`app` + `public`) | **151** | **27** | **178** |

**Exact, not approximate — the predicate that produced every figure**, so the denominator can be
re-checked rather than trusted. Domain: `pg_proc` ⋈ `pg_namespace`, `nspname in ('app','public')`,
body comment-stripped with `regexp_replace(prosrc, '--[^<LF>]*', '', 'g')` (where `<LF>` is a
literal newline in the pattern), restricted to bodies
matching `is_staff_admin_of`. Classifier: bare = `src ~ 'is_staff_admin_of\('`, for-variant =
`src ~ 'is_staff_admin_of_for\('`. Policies use the identical classifier over
`coalesce(qual,'')||coalesce(with_check,'')`. **Functions calling BOTH forms: 0. Functions matching
the name but neither call form: 0.** So 151 + 27 = 178 and 63 + 2 = 65 — both partitions sum, with
no residue bucket.

Both planes are dominated by the **bare** form. Had this been swept as two anchored greps whose
union was trusted, the totals would still have come out right and the *classification* would have
been wrong — and the classification is what tells you whether a site checks the caller or a third
party. **Method that works, and the one used here: match the substring UNANCHORED ONCE (the bare
name is a prefix of `_for`, so one pass finds both), then classify each hit by whether `_for`
follows.** ⛔ A word-boundary match (`\mis_staff_admin_of\M`) is the thing that cannot see the
`_for` variant.

---

## 1. Plane 1 — assignment shape, and the `expires_at` question

`staff_admin` is **commission-scoped**: `memberships_scope_shape` pins `commission_id NOT NULL`
with `organization_id` and `hospital_id` NULL. Re-verified 2026-09-01 against `pg_constraint`
after AE4 Increment 1 added a column to that table — the one reused measurement this author had
an opportunity to perturb. Unchanged.

### 1.1 Is the expired seat enforced? ✅ YES — on every authorization path, in exactly one place

The whole of `staff_admin` authorization funnels through two predicates that are thin wrappers
over one:

```
app.is_staff_admin_of(p_commission_id)             -- self-check;  63 policies + 151 functions
app.is_staff_admin_of_for(p_commission_id, p_user) -- third-party;   2 policies +  27 functions
      both =  app.is_active(<user>) AND app.has_role('commission', <cid>, 'staff_admin', <user>)
```

and `app.has_role` carries **four** gates in one body:

| gate | term in `app.has_role` / `is_active` | deny class it implements |
| --- | --- | --- |
| seat expiry | `(m.expires_at is null or m.expires_at > now())` | **expired seat** |
| scope | `when 'commission' then m.commission_id = p_scope_id` | **wrong scope**, **cross-org** |
| principal state | `app.is_active` → `is_active AND (suspended_until is null or now() >= suspended_until)`, `coalesce(…, false)` | **inactive**, **suspended** |
| active context | `(p_user_id is distinct from auth.uid() or p_role is not distinct from app.active_role())` | **wrong active context** |

⛔ **So the answer to "does anything enforce `expires_at`" is YES, and the column is not
decorative** — but note *where*: **in a function, never in a policy.** Zero policies in the
database reference `expires_at` (measured: `pg_policies` sweep returns empty). Any future site
that checks `staff_admin` by querying `memberships` directly instead of calling the predicate
inherits **none** of these four gates. That is not hypothetical — see § 1.2.

⚠ `app.is_active` collapsing **inactive** and **suspended** into one predicate means those two
deny classes are not independently observable at any site. AE4.5 can construct them separately in
fixtures, but no enforcement site distinguishes them.

### 1.2 FINDING — five sites resolve `staff_admin` holders WITHOUT the expiry term

Census of every function whose comment-stripped body reads `memberships` with the literal
`'staff_admin'`:

| function | filters `expires_at` | what it does | verdict |
| --- | --- | --- | --- |
| `app.commission_staff_admin_of_case` | ✅ | resolves the case's owning coordinator | correct |
| `public.get_referral_case_access_summary` | ✅ | access summary | correct |
| `app.grant_role_impl` | ✅ | writes the column | n/a (write path) |
| `app.compute_due_charter_notifications` | ❌ | notification targeting | **over-notifies** |
| `app.compute_due_document_review_notifications` | ❌ | notification targeting | **over-notifies** |
| `public.compute_due_notifications` | ❌ | notification targeting | **over-notifies** |
| `public.save_section_answers` | ❌ | notification targeting | **over-notifies** |
| `public.list_approver_candidates` | ❌ | derives the label `Coordenador(a)` | **cosmetic** |
| `app.revoke_role_impl` | ❌ | `p_role in ('staff','staff_admin')` scope dispatch | **benign — not a holder resolution** |

⚠ **`list_approver_candidates` was nearly mis-filed as an authorization gap and is not one.** Its
`staff_admin` read derives a *display label*; eligibility is a separate `hospital_users` set, and
the door's own gate at the top **is** `app.is_staff_admin_of(p_commission)`, which filters
correctly. Reading the hit without reading its context would have produced a false P0 here.

**Disposition: (a) — fix in a preceding, independently gated increment before cutover.** Not (b):
an exception needs an owner and an expiry, and this is a one-line term added to four bodies to
match the canonical predicate, not a design decision anyone would defend. Not (c): the reachable
consequence is that a lapsed coordinator keeps receiving charter/document-review notifications —
governance **content**, not an access grant, and **PHI-free — measured, not inferred from the
function names** (§ 10.1 quotes the exact payloads). ⛔ It is content rather than a bare ping, so
it earns its own bug entry rather than riding along as a consistency fix.
⛔ It cannot simply be left: AE4.4's adapter must project *one* assignment fact per principal, and
it cannot do that while the legacy answer to "is this person a `staff_admin`" is internally
inconsistent across sites.

---

## 2. Plane 2 — the RLS surface, by resource family

65 policies over 51 tables. Aggregated:

| family | tables | policies | commands |
| --- | --- | --- | --- |
| cases | 15 | 20 | ALL, SELECT, INSERT, UPDATE, DELETE |
| meetings | 7 | 15 | ALL, SELECT, INSERT, UPDATE, DELETE |
| process templates | 9 | 9 | ALL |
| forms | 7 | 7 | ALL, SELECT |
| responses | 7 | 7 | **SELECT only** |
| staff | 3 | 3 | ALL, SELECT |
| action items | 1 | 2 | ALL, SELECT |
| forms (storage) | 1 | 1 | INSERT |
| audit | 1 | 1 | **SELECT only** |

⭐ **`responses` and `audit` are SELECT-only for this role, and that is a sourced read/write
split, not an inference.** `staff_admin` reads responses; it does not author them. It reads the
audit log; it cannot write it (Rule 11's append-only property is enforced elsewhere).

---

## 3. Plane 3 — doors branching on the role

189 function hits across 12 families (`prosecdef` split shown because a DEFINER's gate *replaces*
RLS, so a DEFINER door is the only control on its own path):

| family | functions | DEFINER | INVOKER |
| --- | --- | --- | --- |
| cases | 72 | 51 | 21 |
| accreditation | 16 | 16 | 0 |
| meetings | 15 | 9 | 6 |
| responses / sign-off | 13 | 12 | 1 |
| documents | 13 | 13 | 0 |
| dashboard | 12 | 12 | 0 |
| staff | 11 | 7 | 4 |
| referrals | 10 | 10 | 0 |
| action items | 9 | 9 | 0 |
| forms | 8 | 8 | 0 |
| ops / compliance | 6 | 6 | 0 |
| process templates | 4 | 4 | 0 |

---

## 4. The matrix

**33 rows** — 29 commission-scoped (1–29) + 4 org-scoped (30–33, § 11). ⚠ The org-scoped four were
**two** until § 12 re-derived row 30 into three codes; any figure quoting 31 rows, or "rows 30–31",
predates that and is stale.

*(Planes 4 and 5 — the TS enforcement surface and the E2E behavioural surface — are folded into
the site column below. Codes are derived from the existing Axis-5 vocabulary and the resource
families above; none is invented.)*

### 4.0 Enforcement sites come in THREE kinds, and the matrix must say which

⭐ Not a taxonomy for its own sake — **it decides what AE4.6 has to re-point.** Measured
instance that forced the distinction: `public.publish_form_version` is **`prosecdef = f`
(INVOKER) and its body contains no `is_staff_admin_of` call at all.** Publish is nonetheless
gated — by the `form_versions_staff_admin_write` **RLS policy**, which the invoker path runs
under. Reading only door bodies would have recorded this permission as ungated; reading only
policies would have missed every DEFINER door.

| kind | what enforces | consequence for AE4.6 |
| --- | --- | --- |
| **R** — RLS policy | the policy `qual` / `with_check`; the door may be INVOKER with no gate of its own | delegation happens in the policy's predicate |
| **D** — DEFINER door body | `prosecdef = t`; the body's gate **replaces** RLS entirely, so it is the only control on that path | these are the wrapper family AE4.6 re-points |
| **T** — TS action guard | `src/**` check before the call | ⛔ defence in depth **only** — never the sole control; a T-only row is a finding (§ 7) |

### 4.1 Scope exclusion, stated so the next reader does not re-derive it

⛔ **"Who may grant or revoke the `staff_admin` role itself" is NOT in this matrix.** That is
gated on `org_admin` / `hospital_admin` (`assignStaffAdmin`, `assignCommitteeRole`, and
`app.grant_role_impl`'s scope dispatch) and belongs to **AE5's** matrices for those roles. The
string `staff_admin` appears in ~185 files and most occurrences are about *administering* the
role, not *exercising* it; this exclusion is what keeps those out.

### 4.2 The matrix

Site kinds per § 4.0: **R** = RLS policy · **D** = DEFINER door body · **T** = TS guard (defence
in depth only). E2E column cites the spec that *pins* the behaviour; ⚠ marks a pin whose deny
signal is UI text rather than a status or RPC error (§ 7.1).

⭐ **Every code carries its `sensitivity_ceiling` from birth** (migration `20261003007130`; NOT NULL, **no default** — `none` is the permissive value, so a defaulted column would let a forgotten insert classify a PHI permission as unclassified). Values are the three-class partition; **no ordering is defined** and pgTAP 401 §13.6–13.7 gates that abstinence.

| # | permission code | resource_kind | risk_class | **sensitivity** | enforcement sites |
| --- | --- | --- | --- | --- | --- |
| 1 | `commission.forms.edit` | commission_content | write | none | **R** `forms/form_versions/form_sections/form_items/form_item_options/form_item_validations/form_block_library _staff_admin_write` (7 ALL) · **D** 8 form fns · **E2E** `phase4-builder.spec.ts:115-180`, `:261-389` |
| 2 | `commission.forms.publish` | commission_content | **irreversible** | none | **R** `form_versions_staff_admin_write` — ⭐ `publish_form_version` is **INVOKER with no body gate**; RLS is the whole control · immutability by `guard_published_version_trg` (Rule 5) · **E2E** `phase4-builder.spec.ts:180` |
| 3 | `commission.forms.assets.upload` | commission_content | write | none | **R** `storage.objects.form_assets_insert_staff_admin` (INSERT) · new path per upload (Rule 6) · **E2E** `phase4-builder.spec.ts:466-532` |
| 4 | `commission.responses.read` | commission_content | read | none | **R** 7 **SELECT-only** policies (`responses`, `answers`, `answer_*`, `response_group_instances`) · **E2E** `phase8-dashboard.spec.ts:720-735` |
| 5 | `commission.responses.correct` | commission_content | write | none | **D** `file/approve/reject/review/withdraw_correction`, `supersede_response` · **T** `caps.canApprove = canManageLifecycle` (`case-detail-view.tsx:502`) · **E2E** `case-void-reopen.spec.ts:409-483` |
| 6 | `commission.signoffs.read` | commission_content | read | none | **D** `get_response_for_signoff`, `list_signoff_queue`, `app.can_read_signoff`, `app.pending_staff_signoffs` · **E2E** `ff1-repeating-groups.spec.ts:1212-1284` |
| 7 | `commission.signoffs.sign` | commission_content | write | none | **D** `app.can_sign_section` · ⚠ **E2E pins the review screen, not the click** (§ 7.2) |
| 8 | `commission.dashboard.read` | commission_content | read | none | **D** all **9** `dashboard_*` fns · **E2E** `member-action-items-overview.spec.ts:862-870` · ⚠ see § 7.4 — the route comment is stale in two ways |
| 9 | `commission.staff.manage` | identity | **authority** | none | **R** `commission_administrativos`, `commission_administrativo_capabilities` · **D** `appoint/revoke_administrativo`, `grant/revoke_member_capability`, `list_addable_commission_members` · **E2E** `administrativo.spec.ts:687-796` |
| 10 | `commission.titles.manage` | vocabulary | write | none | **R** `member_titles_staff_admin_write` · **D** `create/rename/reorder/delete_member_title`, `assign_member_title` · **E2E** `hospital-admin-tier.spec.ts:433-545` |
| 11 | `commission.meetings.manage` | commission_content | write | none | **R** 15 policies over 7 tables · **D** 15 meeting fns · **E2E** `phase10-meetings.spec.ts:1099-1140`, `phase13-audit.spec.ts:628-696` |
| 12 | `commission.meetings.reserved.author` | commission_content | write | none | **D** `open_reserved_session`, `add_reserved_item` · **E2E** `meetings-reserved-sessions.spec.ts:301-414` · ⛔ **live pinned defect** — § 7.3 |
| 13 | `commission.meetings.cases.shell.read` | commission_content | read | none | **R** `meeting_cases_select` — granted **including when recused** (ADR 0078 A5) |
| 14 | `commission.meetings.cases.substance.read` | commission_content | read | none | ⛔ **EXCEPTION — over-granted today**, § 5 |
| 15 | `commission.meetings.cases.decision.read` | commission_content | read | none | ⛔ **EXCEPTION — over-granted today**, § 5 |
| 16 | `commission.cases.manage` | commission_content | write | none | **R** 20 policies over 15 tables · **D** 72 case fns · **E2E** `casos-reading-surface-differential.spec.ts:551-577` |
| 17 | `commission.cases.access.manage` | commission_content | **authority** | none | **D** `grant_case_access`, `revoke_case_access`, `list_case_access` · **E2E** `case-access.spec.ts:508-586`, `:1455-1615` |
| 18 | `commission.cases.recusal.manage` | commission_content | **authority** | none | **D** `record_recusal`, `lift_recusal` · **R** `case_recusals_select` (**`_for` variant**) · **E2E** `ethics-e1-access-spine.spec.ts:427-486` |
| 19 | `commission.cases.lifecycle` | commission_content | **irreversible** | none | **D** `close_case`, `cancel_case` (terminal-forever, `HC0M8`), `reopen_case` · **E2E** `case-void-reopen.spec.ts:495-574` |
| 20 | `commission.cases.phi.dispose` | **phi** | **irreversible** | **phi** | **D** `dispose_case_phi` · Rule 12 |
| 21 | `commission.process_templates.manage` | commission_content | write | none | **R** 9 ALL policies · **D** 4 template fns |
| 22 | `commission.action_items.manage` | commission_content | write | none | **R** `action_items_select`, `action_items_staff_admin_write` · **D** 9 fns · **E2E** `member-action-items-overview.spec.ts:384-405` |
| 23 | `commission.documents.manage` | commission_content | write | none | **D** 13 document fns |
| 24 | `commission.documents.publish` | commission_content | **irreversible** | none | **D** `publish_document`, `revoke_printed_document`, `supersede_document` |
| 25 | `commission.accreditation.manage` | commission_content | write | none | **D** 16 fns · **E2E** `phase16-accreditation-restricted.spec.ts:180-207` (⚠ requires staff_admin **AND** an ACL row) |
| 26 | `commission.referrals.manage` | commission_content | write | none | **D** 10 referral fns · **R** `case_referral_insert_source_coord` (**`_for` variant**) |
| 27 | `commission.referrals.phi.read` | **phi** | read | **phi** | **D** `app.can_read_referral_phi` · **E2E** `nsp-per-hospital.spec.ts:834-850` — a **sanctioned cross-hospital** read, not a leak |
| 28 | `commission.safety_events.report` | commission_content | write | none | **D** safety-event door from case detail · **E2E** `phase14a-safety-events.spec.ts:188-233` |
| 29 | `commission.audit.read` | audit | read | none | **R** `audit_log_select` (**SELECT only**) |
| **30** | `org.professionals.manage` | identity | **authority** | **class2_professional_identity** | ⚠ **ORG-SCOPED — § 11.** **D** `create/update/redact_professional_profile`, `set_professional_link_state`, **`ensure_professional_participant`**. Reach: **ADR 0078 §B7** ("any org `staff_admin`", the respondent twin's precondition, closed by the `HC0F2` linkage freeze) |
| **31** | `org.participants.external.manage` | identity | write | none | ⚠ **ORG-SCOPED.** **D** `create_external_participant` — writes `public.participants` with `sensitivity_class` hardcoded `non_sensitive`; **structurally bounded** (§ 12.2) |
| **32** | `org.case_vocabulary.manage` | vocabulary | write | none | ⚠ **ORG-SCOPED.** **D** `create/archive_ethics_allegation_category`, `create/archive_ethics_sanction_type`, `create/archive_case_assignment_role` |
| **33** | `org.professionals.read` | identity | read | **class2_professional_identity** | ⚠ **ORG-SCOPED.** **D** `app.can_read_professional_profile` — arm 1 delegates to the split gate and re-points to **row 30 only**; arm 2 is case-committee reach. § 12.4 |

⚠ **Two capabilities the E2E plane shows are NOT role-derived and are therefore not rows:**
reading `legal_privileged` case documents rides on a *seeded clearance grant*
(`ethics-e1-access-spine.spec.ts:578-599`), and `/casos` phase-filling rides on *personal
assignment* (`case-referral-usability-batch.spec.ts:173-196` — "narrowed exactly like everyone
else"). Recording either as a `staff_admin` permission would be a straight over-grant.

---

## 5. The recusal exception — shape ruling, and the expiry date owed

ADR [0169](../decisions/0169-meeting-content-recusal-divergence-is-a-time-boxed-exception.md)
carries this as a named compatibility exception, PA-F8 disposition **(b)**, **owner: backend**,
first-class in this matrix. Live policy, re-derived from the catalog rather than inherited from
the follow-up's framing (whose premise measured FALSE):

```
meeting_cases_select [SELECT]
  app.can_reach_meeting(meeting_id, auth.uid()) AND NOT app.is_case_respondent(case_id, auth.uid())
```
It returns **all seven columns**. `app.is_case_excluded = is_case_respondent OR is_recused_from_case`,
so **the recusal half is absent on the two content columns while the respondent half is present.**

### 5.1 RULING — shape: a narrower permission code whose ABSENCE is the deny (option iii)

⛔ **Not a negative/deny row (option i), and it is ruled out on CORRECTNESS before the resolver
argument even applies.** ADR 0169 §1 and the `20260816000300` guard both require the *row* to stay
visible to the recused — A5's shell tier is "the proof of propriety", and keystone 10 exists to
stop exactly that blinding. A deny row would encode a row-level deny, which is **the wrong fix**,
and ADR 0169 §3 warns that a cell authored from the follow-up's text would make that wrong fix the
regression oracle. The resolver argument is the second, independent reason: deny-precedence
semantics do not exist in AE4.4's planned `has_direct_permission`, and inventing them to fit a
matrix that assumed them is precisely the ordering failure this phase's slicing exists to prevent.

⛔ **Not a scope/predicate qualifier (option ii).** The qualifier would be `AND NOT
is_case_excluded(case_id, …)` — a **per-row** condition, not a scope. Scope in the resolver is a
commission id. Letting permissions carry arbitrary row predicates turns the catalog into a policy
engine, and AE4.1 deliberately built no predicate column.

✅ **Ruled: split the permission at ADR 0078 A5's own tier boundaries**, so the deny is the absence
of a grant — which a positive-grant resolver already expresses with **zero new semantics**:

| code | approved rule | columns |
| --- | --- | --- |
| `commission.meetings.cases.shell.read` | granted to every meeting-reaching member **including the recused** | `id`, `meeting_id`, `case_id`, `agenda_item_id`, `created_at` |
| `commission.meetings.cases.substance.read` | requires case authority (`read_case_content`) | `summary` |
| `commission.meetings.cases.decision.read` | requires member **AND NOT** `is_case_excluded` | `decision` |

**The exception row, first-class and mutation-testable:** legacy grants all three through one
policy; the approved matrix grants only `…shell.read` unconditionally. The difference is an
**over-grant of `summary` and `decision` to a recused member** — recorded as an over-grant, never
as a missing row deny.

⚠ **Enforcement mechanism is an obligation of the expiry increment, not a reason to change the
shape.** RLS cannot deny per column (ADR 0169 §4), so honouring these three codes needs a view or
a column-grant split, plus a keystone that **constructs** the state the seed cannot reach — the
seed holds no recused case on a reachable meeting, so the failing state does not exist in any
fixture today. That is what makes this latent rather than demonstrated, and it is also why the
exception is defensible in the interim.

### 5.2 Expiry date: **2026-12-01** — ✅ APPROVED BY PO 2026-09-01, and written into ADR 0169

ADR 0169 sets the trigger as *"post-pilot, at the first increment that touches meeting content"*
and states a calendar date is owed, because **a trigger-only expiry is the shape that never
fires**. Reasoning for this date rather than another:

- **Three months from today (2026-09-01).** The pilot gates on AE0–AE4, and AE4 is in flight now,
  so this lands after the pilot has actually run.
- **The divergence is latent**, so field observation during the pilot is the only way to learn
  whether it bites in practice — a shorter date would force the column-split before anyone knows
  whether the tier boundary is even right.
- **Short enough to not become permanent.** Long enough to schedule a view/column-grant split with
  its own keystone; short enough that it cannot quietly outlive the people who ruled it.

⭐ **With teeth, because a date that only triggers a re-review is the same failure one level up:**
on 2026-12-01 the exception either has a **merged fix**, or it **BLOCKS the next increment that
touches meeting content**. If the PO extends it, the extension is its own recorded ruling with its
own date — never a silent renewal.

---

## 6. Deny classes: what this matrix's shape CAN and CANNOT express

The plan makes the deny classes **axis values** in AE4.5's generator. But a permission code is a
**grant**, and several of these are conditions on *whether any grant applies at all*. Measured
against the resolver shape AE4.4 will build
(`authz.has_direct_permission(principal, scope_kind, scope_id, permission_code)`):

| deny class | expressible as a permission? | why / where it must live instead |
| --- | --- | --- |
| **wrong scope** | ✅ **yes** | it *is* the `scope_id` argument — a grant at commission A does not answer for commission B |
| **cross-org** | ⛔ **NO — third category: enforced by nothing, unreachable by id-space** | see § 6.1 |
| **inactive** | ❌ no | `app.is_active` is a property of the **principal**, evaluated before any permission. The adapter must apply it or every permission is over-granted to deactivated principals |
| **suspended** | ❌ no | same predicate, same place — and **not independently observable**, since `app.is_active` collapses it with `inactive` |
| **expired seat** | ❌ no | a property of the **assignment row** (`memberships.expires_at`). `app.has_role` applies it today; the adapter must project it into assignment facts (and see § 1.2 — five sites already fail to) |
| **wrong active context** | ❌ no | a **session** property, and it carries an asymmetry (below) |

**⭐ Finding for AE4.4, and it is the sharpest one here.** `app.has_role`'s active-context term is:

```
and (p_user_id is distinct from auth.uid() or p_role is not distinct from app.active_role())
```

The filter applies **only to self-checks**. A third-party check short-circuits it entirely. So an
adapter that applies active-role **uniformly** breaks every third-party check in the database
(~25 `_for` call sites), and one that **never** applies it silently drops the hat gate for the
~153 self-check sites. **Neither uniform choice is correct**, and this asymmetry is invisible in
the permission vocabulary — it must be encoded in the adapter deliberately. Discovering it
mid-resolver is the ordering failure; it is recorded here instead.

### 6.1 ⛔ Cross-org is a THIRD category, and calling it "expressible" was wrong

An earlier draft of this section listed cross-org as expressible, on the reasoning that a foreign
commission id is *"just a `scope_id` with no grant"*. **Read back, that says the resolver does not
enforce cross-org isolation — the UUID space makes it unreachable.** Those are different claims,
and only the first is a control.

This is the **"an incidental guard closes a hole the definition predicts"** shape: both premises
true (commission ids *are* globally unique; a foreign id *does* find no grant), conclusion false
(the catalog *expresses* org isolation). ⛔ **"Not reachable" is not "protected."** Tenant
isolation is the most load-bearing property in this system and it must not be banked on an
accident of identifier allocation — there is **no org term anywhere in
`has_direct_permission(principal, scope_kind, scope_id, permission_code)`**.

**Corrected tally: 2 of 6 expressible (wrong scope, and nothing else in this column); 3 not
expressible and owned by the adapter (inactive, suspended, expired seat) plus wrong-active-context
as a fourth; and cross-org in a category of its own — enforced by nothing, unreachable by
id-space.** If AE4.4's adapter is where cross-org gains a real term, that is a finding for AE4.4
to own. ⛔ **It may not enter Gate AE4's record as a property the catalog expresses.**

**Summary: 2 of 6 deny classes are expressible in this matrix's shape; 3 belong to AE4.4's
adapter; 1 (cross-org) is currently enforced by nothing.** That is not a defect in the matrix — it
is the boundary between the catalog and the adapter, and naming it now is what stops AE4.4
assuming the matrix already covered it.

---

## 6A. ⭐ BINDING REQUIREMENT ON AE4.4 — the active-context asymmetry

Given its own section, not a note, because it is a constraint that will otherwise be rediscovered
mid-cutover. `app.has_role`'s active-context term, verbatim from the catalog:

```sql
and (p_user_id is distinct from auth.uid() or p_role is not distinct from app.active_role())
```

**The filter applies ONLY to self-checks.** When `p_user_id <> auth.uid()` the first disjunct is
true and the active-role condition is never evaluated. Third-party checks skip the hat entirely —
by construction, and AE0.5 Axis 3 records this as a derived property of the grid.

**Both uniform adapter choices are wrong**, and the site counts are exact (§ 0):

| adapter choice | failure |
| --- | --- |
| apply active-role **uniformly** | breaks every third-party check — the **27** `is_staff_admin_of_for` call sites, each of which asks about someone who is not the caller and whose hat is irrelevant |
| **never** apply active-role | silently drops the hat gate for the **151** bare `is_staff_admin_of` self-check sites — a permission the caller holds but has not assumed becomes exercisable |

⛔ **REQUIREMENT: AE4.4's adapter must reproduce the asymmetry deliberately**, keyed on whether the
principal under test is the caller — not on the permission, and not on the scope. It cannot be
inferred from the catalog, because **the asymmetry is invisible in the permission vocabulary**: no
permission code, `resource_kind`, or `risk_class` value carries it, and no matrix cell can express
it. Discovering it mid-resolver is the ordering failure this phase's slicing exists to prevent.

⚠ AE4.5 must also cover it: the `wrong active context` deny class needs **both** a self-check cell
(where it denies) and a third-party cell (where it must **not** deny). A generator that emits only
the first would pass while pinning the uniform-apply bug.

---

## 7. Findings — the could-not-verify list, as work items

⛔ **Every row in § 4.2 has at least one R or D site.** No permission is T-only, so there is no
"UI hiding is the only control" row. What follows is the residue: places where the *evidence* is
weaker than the row, or where a divergence exists.

### 7.1 Five denials are pinned by UI TEXT, not by a status or an RPC error

`chefe.ccih`'s cross-commission denials assert the pt-BR not-found copy (`getByText(/não
encontr/i)`) with **no HTTP status checked**: `phase6-signoffs.spec.ts:647-671`,
`phase3-admin-members.spec.ts:446-467`, `phase8-dashboard.spec.ts:596-607`, plus the role-switch
absence in `act-role-assumption.spec.ts:131-154`. Two of them additionally check the body does not
contain the other commission's data, which is stronger than bare absence — but the deny *signal*
is DOM text. ⚠ The same persona's platform/org/NSP denials **do** check real 404s
(`phase-multitenancy.spec.ts:288-292`, `hospital-admin-tier.spec.ts:710-714`,
`nsp-cross-org-isolation.spec.ts:130-134`), so the weaker pattern is not house style — it is
localised to the cross-commission cases. **Work item for AE4.5:** the cross-scope deny cells need
a status or RPC assertion, or they pin a rendering rather than a boundary.

### 7.2 `commission.signoffs.sign` — the click is not pinned for this persona

E2E shows `chefe.ccih` reaching and reading the sign-off review screen
(`ff1-repeating-groups.spec.ts:1212-1284`, `ff2-matrix-views.spec.ts:132-268`) but the
"Assinar seção" click-through is demonstrated by a **different** persona (`chefe.farm`,
`phase6-signoffs.spec.ts:304-380`). The **D** site (`app.can_sign_section`) is real, so the row
stands on SQL evidence; the E2E evidence is generalised-by-pattern and is recorded as such rather
than cited as a pin.

### 7.3 A live pinned defect inside row 12, and one now-vacuous pin

- ⛔⛔ **`BUG-STAGEC-READER` IS NOT A DEFECT. Its premise measured FALSE, and an earlier revision
  of THIS document transcribed that premise instead of checking it.** Corrected 2026-09-01.
  The spec comment at `meetings-reserved-sessions.spec.ts:462` quotes the panel copy as
  *"itens sem caso, apenas os leitores indicados **e a coordenação**"* and derives a bug from the
  final clause. **That clause is not in the source.** Measured verbatim:
  - `reserved-sessions-panel.tsx:207` — *"itens sem caso, apenas os leitores indicados. **Os demais
    veem que houve deliberação reservada, sem seu conteúdo.**"* — no coordination promise, and the
  second sentence describes the observed behaviour **exactly**.
  - `reserved-item-form.tsx:246-249`, the copy shown **at the moment the author builds the reader
    list** — *"Apenas os membros marcados poderão ler este item. **A coordenação não tem acesso
    automático — adicione seu próprio nome à lista para manter o acesso.**"*

  So the product **explicitly documents the behaviour the test calls a bug, and instructs the
  author to do precisely what the test deliberately does not do.** Corroborating: there is **no
  `created_by` column on `meeting_closed_session_items`** — per-item authorship is not modelled at
  all, so "the author's own item" is not even expressible. The reader list is the sole mechanism,
  by design.

  ⛔ **Consequence, and it is the serious one: the planned "fix" would have been a real
  over-grant.** Widening the case-less branch to admit the coordination would contradict the
  documented promise and destroy the only exclusion mechanism case-less items have — there is no
  case, so no recusal machinery; the reader list is it. This is the PA-F8 trap running **in
  reverse**: not approving a legacy defect into the matrix, but *manufacturing* a defect to satisfy
  a fabricated expectation.

  **Disposition: NOT A DIFFERENCE.** Row 12's approved rule is the legacy behaviour. The work owed
  is documentary and belongs to `tester`, not to backend: correct the spec's misquoted comment, and
  convert the `test.fail()` into a **positive deny-assertion** (a non-reader, coordinator included,
  sees the row and **not** its content) — which turns a false-bug pin into the real regression guard
  that this boundary currently lacks.
- ⚠⚠ **A vacuous pin, flagged so nobody counts it as coverage:** the "non-entitled source
  staff_admin does not see the dispose control" assertion at `nsp-per-hospital.spec.ts:906-953` is
  **vacuous by construction** — `ReferralDisposeDialog` was removed from the page for *every*
  persona (commit `13610c0d`). It is not a permission boundary for this role at all.

### 7.4 ⭐ NEAR-MISS: the dashboard row was one comment away from a silent over-grant

Recorded because the value of catching it is mostly in it being written down.
`src/app/o/[org]/c/[commission]/dashboard/page.tsx:27-43` carries a doc comment asserting two
things. **Both are false, and each would have corrupted row 8 differently:**

1. *"`access.role === "staff_admin"` is WIDER than it reads: `getCommissionAccessByOrg` maps an
   `org_admin` … into the coordinator branch (ADR 0051 D1)."* — **the coercion is gone.** Removed
   in `4dd5cfa2` (BUG-QOB-003), with `1dfc3fbe` re-routing the KEEP surfaces through
   `canConfigureCommission`; this file was touched by neither. Verified in the current source:
   `session.ts:39` types `CommissionRole = 'staff' | 'staff_admin'` and `:591` assigns
   `const role: CommissionRole | null = memberRole` — straight from the membership, no coercion.
   Read uncritically it would have made row 8 read *"staff_admin **or** tenancy-admin"* — a
   silent over-grant sourced to a comment, becoming the regression oracle. **This is PA-F8's
   failure mode with a line number.**
2. *"The backing dashboard reads are … gated on `is_staff_admin_of(cid) OR is_tenancy_admin_of(cid)`
   — the SAME pair."* — **false for 3 of the 9.** Measured from `pg_proc`:
   `dashboard_completion_by_member`, `dashboard_export_rows` and `dashboard_free_text` gate on
   `is_staff_admin_of` **alone**. The comment claims a uniformity the catalog does not have. ⚠ This
   is the worse of the two: a **catalog claim living in a comment**, the class that goes stale
   silently and that no gate can contradict.

**Row 8 is therefore derived from the code and the catalog**: `staff_admin` holds
`commission.dashboard.read` and passes all nine functions. Whether tenancy admins also hold it is
**a different role's matrix** (AE5), and the 3-of-9 non-uniformity is a finding handed to AE5
rather than absorbed here.

⚠ **Plane-4 evidence hygiene, generalised:** Explore A's report is sourced partly to doc comments.
Where a capability's only evidence was a comment citing a DB predicate, the predicate was verified
in the catalog before it became a row. The three identically-worded strict gates
(`manage/documentos/layout.tsx:30`, `manage/charter/page.tsx:80`,
`manage/acreditacao/layout.tsx:33`) carry the same staleness risk **without** the blatant
contradiction; they are **not yet individually re-verified** and are listed here as an open check,
not as a clean bill.

### 7.5 `CorrectionCaps.canApprove` — RESOLVED, not a gap

Explore A reported it declared-but-unwired. **Measured: it is wired.** Computed at
`src/components/cases/case-detail-view.tsx:502` as `canApprove: caps.canManageLifecycle`, consumed
at `case-corrections-panel.tsx:175-203` and `file-correction-control.tsx:109`. The approve surface
is live (`manage/cases/[caseId]/correcoes/[requestId]/page.tsx`, `src/lib/corrections/actions.ts`)
and the server door `approve_correction` carries a bare `is_staff_admin_of` gate. Defence in depth,
correct, no work item. Recorded because "a declared thing no caller passes" is a real class and the
negative result is worth having on the record.

### 7.6 No column expresses PHI sensitivity — a PO decision, § 9

---

## 8. Did `risk_class`'s proposed value set survive contact with real subjects?

`authz.risk_class` was created in AE4 Increment 1 by PO override, with the value set
`read | write | authority | irreversible` **proposed by the author, not derived** — no authority
in the tree defines one (ADR 0172 §4). AE4.3 is its first contact with actual subjects.

✅ **Verdict: the value set SURVIVES. No `alter domain` amendment is needed.** All four values earn
their keep against real codes:

- `read` — `commission.responses.read`, `commission.dashboard.read`, `commission.audit.read`
- `write` — `commission.meetings.manage`, `commission.cases.manage`
- `authority` — `commission.staff.manage` (grants/revokes capability to other principals),
  and `manage_case_access`. ⭐ This value pulls real weight: it separates "changes content" from
  "changes who can change content", which no other axis captures.
- `irreversible` — `dispose_case_phi`, `revoke_printed_document`, and form-version **publish**
  (Architecture Rule 5: published versions are immutable)

⚠ **But contact surfaced a CONSTRAINT ON CODE DESIGN that nobody had stated, and it is a real
finding rather than a footnote.** `risk_class` is a per-permission column, so **a permission code
may not span a reversibility boundary.** The natural bundle `commission.forms.manage` does exactly
that: it covers reversible draft edits *and* the irreversible publish. Under this domain it cannot
be one code.

**Consequence, binding on § 4's code set:** codes must be **split at the reversibility boundary**,
e.g. `commission.forms.edit` (`write`) and `commission.forms.publish` (`irreversible`). This is a
*good* forcing function — it makes the riskiest operation in each family separately grantable and
separately mutation-testable — but it means the `.manage` shorthand the plan uses in its examples
(`commission.forms.manage`) is **not viable as a single code**, and that should be noted before
AE4.5 generates cells against it.

⚠ **One deliberate property, restated so it is not mistaken for an omission:** PHI reads carry
`risk_class = read`, not a special value. Risk is *how far a wrong grant reaches*; sensitivity is
*what the data is*. The latter is Axis 7's job and belongs to `sensitivity_ceiling` — which is
**deferred** (ADR 0172 §4). ⛔ So this matrix currently has **no column expressing PHI
sensitivity**, and AE4.3 is where `sensitivity_ceiling` must be added if the PHI codes are to be
distinguishable in the catalog rather than only by their code names. Recorded in § 7 as a work
item.

---

## 9. `sensitivity_ceiling` — ✅ RULED 2026-09-01, and the argument that turned around

> ✅ **RESOLVED — the PO ruled option (i), CREATE IT NOW**, with the ordering/comparison rule still
> deferred. Shipped as migration `20261003007130`; ADR 0172 § 4 amended. ⛔ **This section is
> retained as the REASONING that carried the decision, not as an open question** — it read
> "PO DECISION REQUIRED" until 2026-09-01, which is the shape where only the amending document
> knows about the amendment.
>
> ⚠ **And the option as WRITTEN below was superseded in the ruling.** (i) proposes a **binary**
> phi/non-phi domain. The shipped domain is **three-valued** —
> `none | class2_professional_identity | phi` — because checking the column's subjects before
> pinning it surfaced a Class-2 professional-identity capability that a binary would classify as
> `none`, dropping a real sensitivity (§ 12; ADR 0078 §B7). The binary framing below was written
> from an incomplete matrix; the table is left unedited so the correction is legible, but **do not
> implement from it.**

**Not a work item, and it must not ship as option (ii) by default.** A deferral that nobody
re-rules becomes a decision nobody made.

**What changed.** ADR 0172 §4 deferred `sensitivity_ceiling` because `authz.permissions` held
**zero rows** — a CHECK pinning a value no row holds is itself vacuous, which is the residue
rule's own logic. **This matrix creates the subjects.** So that specific reason has **expired**.
The *other* residue question — its **ordering and comparison rule** — genuinely has not been
answered, and is untouched by this.

**Why it now matters, and it is the residue rule's failure mode one level over.** AE4.1's required
invariant is *"`…phi…` codes never implied by content-read codes"*, and pgTAP 401 §7 implements it
by joining on `resource_kind = 'phi'`. Two rows here are PHI —
`commission.cases.phi.dispose` (20) and `commission.referrals.phi.read` (27). If PHI-ness lives
only in the **code name**, that invariant degrades to **a string match on an identifier**: a
label, not a control. A code renamed, or a PHI-reaching permission named *without* the substring,
defeats it silently and **no gate notices**.

⚠ Today the tree is better off than that — `resource_kind` already carries a `phi` value, so § 7's
test joins on a **column**, not a name. The exposure is the **ceiling**: `resource_kind` says
*what the permission touches*, not *how far up the sensitivity ladder a holder may reach*. Axis 7
distinguishes `phi_standard` from `phi_restricted` (the `_case_caps` bits `read_standard_phi` /
`read_restricted_phi`), and **nothing in the catalog can currently express that difference.**

| option | what it costs | what it buys | what stays open |
| --- | --- | --- | --- |
| **(i) create `sensitivity_ceiling` now, CHECK-pinned to a BINARY phi / non-phi domain** | one additive migration + a pgTAP arm; must be widened later when the ladder is ruled (cheap — it is a DOMAIN, `alter domain drop/add constraint`, ADR 0172 §5) | the PHI separation becomes a **column-level control** at the ceiling, not only at `resource_kind`; AE5's PHI roles inherit a real column | the **ordering / comparison rule** — deferred honestly, since a binary needs no ordering |
| **(ii) accept name-based classification for the ceiling** | zero now | nothing | ⛔ the gate record must then **say plainly** that the sensitivity ladder is enforced by *identifier convention*, and that a rename or an unconventionally-named PHI permission defeats it with no gate |

⛔ **The author does not decide this.** Recorded for PO ruling at Gate AE4, with the note that (ii)
is only acceptable if its sentence actually appears in the gate record — an unstated (ii) is the
deferral-becomes-a-decision shape.

---

## 10. Dispositions — every legacy-vs-matrix difference

| # | difference | disposition | reasoning |
| --- | --- | --- | --- |
| D1 | **`meeting_cases` recusal** — `summary` + `decision` over-granted to a recused member | **(b) named exception** | ADR 0169, owner `backend`, **expiry 2026-12-01 — ✅ SET BY PO 2026-09-01**, ADR 0169 amended to hold it (§ 5.2). Latent: the seed cannot reach the failing state |
| D2 | **4 notification bodies resolve `staff_admin` without `expires_at`** | **(a) fix in a preceding gated increment** | § 1.2. One term per body, matching the canonical predicate. Not (b) — nobody would defend it as a design choice. Cannot be left: AE4.4's adapter cannot project one assignment fact over inconsistent legacy answers |
| D3 | **`BUG-STAGEC-READER`** | ⛔ **NOT A DIFFERENCE — premise measured FALSE** | § 7.3. The spec comment misquotes the panel copy by adding *"e a coordenação"*; the real copy says the opposite, and the add-item dialog states *"A coordenação não tem acesso automático"*. Behaviour is correct and documented. ⛔ The proposed widening would have been a genuine **over-grant** destroying the only exclusion mechanism case-less items have. Work owed is documentary and is `tester`'s |
| D4 | **`dashboard/page.tsx` comment** claims an `org_admin` coercion that no longer exists, and RPC-gate uniformity that never held | **not a behavioural difference — a documentation defect** | § 7.4. The *code* is correct by current design. Filed so the comment is corrected; the matrix row is derived from code + catalog, not from it |
| D5 | **3 of 9 `dashboard_*` fns omit `is_tenancy_admin_of`** | **out of scope — handed to AE5** | `staff_admin` passes all nine, so row 8 is unaffected. The non-uniformity bites `org_admin` / `hospital_admin`, whose matrices are AE5's |
| D6 | **Referral-dispose deny pin is vacuous** | **not a difference — a dead test** | § 7.3. The control was removed for every persona; the pin proves nothing and should not be counted as coverage |

### 10.1 D2 — does a lapsed coordinator receive CONTENT or only a ping? **Content. Measured, not inferred.**

`app.enqueue_notification(p_user_id, p_commission_id, p_kind, p_milestone, p_is_reminder,
p_entity_type, p_entity_id, p_title, p_body, p_dedup_key)` — `public.notifications` stores
`title` and `body` as real columns. The two charter/document sites pass, verbatim:

- **charter:** title `'Reunião em atraso'`, body `'A comissão ' || r.commission_name || ' está com
  a cadência de reuniões em atraso.'` — the commission's **name** plus its meeting-cadence status.
- **document review:** title `'Revisão de documento atrasada'` / `'… em breve'`, body
  `r.code || ' — ' || r.title` — the controlled document's **code and title**.

**So a lapsed `staff_admin` keeps receiving governance content**: which commission is behind on
meetings, and which controlled documents are coming due, by code and title. ⛔ **This earns its own
bug entry** rather than riding along as a consistency fix.

✅ **No PHI, and no Rule 12 consideration.** Controlled documents are policies/POPs/protocols and
the platform is PHI-free outside the three isolated modules (Rule 12); no payload here touches
`event_patient`, `referral_patient`, or `patient_identifiers`. The exposure is **governance
metadata to a person whose seat has lapsed but who has not been offboarded** — real, bounded, and
not a patient-data incident.

---

## 11. ⛔ PROPOSAL, NOT BUILT — where a permission's RESOLUTION SCOPE lives

**The finding.** Rows 30–33 are **org-scoped permissions held via a commission-scoped role**.
`app.can_manage_professional(p_org, p_uid)` returns true when the caller holds `staff_admin` at
**any** commission in the org, so `chefe.ccih` — `staff_admin` of **one** commission — reaches
professional identity across all **four** commissions of Rede A. ⚠ **The reach itself is not new
and is already mitigated:** ADR 0078 §B7 names it ("any org `staff_admin`", "exactly the
respondent twin's precondition", a sixth self-serving mutator) and closes it with the `HC0F2`
linkage freeze binding direct DML. **What is new is the catalog-modelling consequence**, which no
prior document addresses.

**PO ruling 2026-09-01: model it honestly.** The clean "role scope == permission scope" assumption
is **dropped**, deliberately — it is already false in the running system, and a catalog encoding it
would be wrong on its very first real subject.

**Nothing in AE4.1 expresses this.** `authz.roles.allowed_scope_kind` says where a role may be
*assigned*; nothing says where a permission *resolves*.

⛔ **`applies_to_descendants` is NOT the answer and the name will tempt the next reader.** It means
*a permission held at org scope reaches DOWN into hospitals and commissions*. This is the
**inverse**: a permission held via a commission-scoped role reaching **UP** to the org. **Ascent is
not descent.** It is also a deferred residue column, so it is unavailable regardless.

### 11.1 Options, with trade-offs

| option | shape | for | against |
| --- | --- | --- | --- |
| **A — `resolution_scope_kind` on `authz.permissions`** | one column: the scope kind this permission resolves at, independent of the holder's role scope | simplest; a permission's resolution scope is genuinely a property *of the permission* (professional identity is org-wide **for everyone**, not just for `staff_admin`); one value per code, no combinatorics; the adapter reads it directly | asserts resolution scope is invariant across roles — true for every subject we have, unproven in general |
| **B — a column on `authz.role_permissions`** | resolution scope per (role, permission) pair | maximum fidelity; different roles could resolve the same permission at different scopes | ⛔ **no subject demands it** — this is a generality bought before its first use, and the join table is empty; it also multiplies the cells AE4.5 must enumerate by the scope-kind count |
| **C — encode it in the code name** (`org.professionals.manage` vs `commission.*`) | convention only | zero schema change; already visible in rows 30–33 | ⛔ **a label, not a control** — a string prefix no gate reads, defeated silently by a rename. Precisely the failure § 9 just closed for `sensitivity_ceiling` |

**Recommendation: A**, with the ascent made explicit rather than implied — the column states the
scope the permission resolves at, and the adapter's job is to walk from the holder's assignment
scope to that scope. ⛔ Recommendation only; **not built in 2b**, per the PO's instruction to
propose rather than add a column.

### 11.2 Why 2b did not build it, stated as a decision

`sensitivity_ceiling` lands cleanly and independently: it needs no resolution-scope concept, its
subjects exist now, and it upgrades the PHI-separation invariant from a substring test to a column
join today. Bundling an unresolved schema question into that increment would make a clean change
unattributable — the same slicing argument `[PA-F18]` used to split AE4 Increment 1 from the
cutover. **The resolution-scope question is therefore a stated finding here, and the resolver work
is AE4.4's regardless.**

### 11.3 BINDING REQUIREMENT ON AE4.4 — numbered alongside § 6A

**AE4.4 may not assume a permission resolves at its holder's role scope.** At least **four** permissions
(rows 30–33) resolve at the **organization** while being held via a **commission**-scoped role. An
adapter that derives the resolution scope from `authz.roles.allowed_scope_kind` will silently deny
**all four** — an under-grant that looks like correct tenant isolation and will therefore read as a
pass.

⚠ **AE4.5 must cover it too**: the cell set needs a case where the holder's assignment scope and
the permission's resolution scope **differ**, or the generator emits only same-scope cells and the
whole class goes untested. That is the same both-polarity requirement § 6A makes for active
context — a generator that emits one side passes while pinning the bug.

---

## 12. Row 30 re-derived — `can_manage_professional` gates three unrelated things

**Correcting this document, not partitioning it.** Row 30's earlier site list was the artifact under
correction, so each of the **13** dependents was re-read from `pg_proc` and assigned by **what it
writes and at what sensitivity** — never by its name or its table.

### 12.1 ⭐ The rule that forces the split is one this document already made

`public.participants` carries its own `sensitivity_class`, and constraint
`participants_sensitivity_derives_type` makes it a **function of `participant_type`**:
`patient → patient_phi`, `professional → professional_identity`, and
`external_person | department | institution | regulatory_body | other → non_sensitive`.

Old row 30 was classified `class2_professional_identity` while its sites included
`create_external_participant`, which can only ever write `non_sensitive` rows. **A permission code
may not span a sensitivity boundary** — the same constraint § 8 derived on the *reversibility*
axis (which is why `commission.forms.manage` had to split at publish), recurring here because
`sensitivity_ceiling` is per-permission. ⭐ The split is required by the column's semantics, not by
taste, and it is the second time this column has caught a bundled code.

### 12.2 The two non-obvious dispositions — both write `participants`, and they land on opposite sides

| function | writes | `participant_type` / `sensitivity_class` | lands on |
| --- | --- | --- | --- |
| `create_external_participant` | `participants` | `p_type` (caller) + **`'non_sensitive'` hardcoded** | **row 31** |
| `ensure_professional_participant` | `participants` **+ `professional_participants`** | **`'professional'` + `'professional_identity'`, both hardcoded** | **row 30** |

⭐ **`ensure_professional_participant` writes the same table as the external door and belongs with
professional identity anyway** — the bridge from a professional profile into the participants
registry emits a `professional_identity` row. Assigning by table, or by the fact that both are
"participant" functions, would have put it in row 31 and re-created the boundary-spanning defect
one row over.

⛔ **`create_external_participant` is STRUCTURALLY bounded, measured not argued.** Because it
hardcodes `sensitivity_class = 'non_sensitive'`, a caller passing `p_type => 'professional'` is
rejected by the CHECK, not merely by convention. Probed in a rolled-back transaction:
`insert … ('professional', 'non_sensitive')` → **REJECTED by
`participants_sensitivity_derives_type`**. So row 31 cannot leak into row 30's sensitivity class.

### 12.3 All 13 dependents, dispositioned

| function | writes | code |
| --- | --- | --- |
| `create_professional_profile` | `professional_profiles` | 30 |
| `update_professional_profile` | `professional_profiles` | 30 |
| `redact_professional_profile` | `professional_profiles` | 30 |
| `set_professional_link_state` | `professional_profiles` | 30 |
| `ensure_professional_participant` | `participants` (`professional_identity`) + `professional_participants` | **30** |
| `create_external_participant` | `participants` (`non_sensitive`) | **31** |
| `create_ethics_allegation_category` | `ethics_allegation_categories` | 32 |
| `archive_ethics_allegation_category` | `ethics_allegation_categories` | 32 |
| `create_ethics_sanction_type` | `ethics_sanction_types` | 32 |
| `archive_ethics_sanction_type` | `ethics_sanction_types` | 32 |
| `create_case_assignment_role` | `case_assignment_roles` | 32 |
| `archive_case_assignment_role` | `case_assignment_roles` | 32 |
| `app.can_read_professional_profile` | *(read gate, no write)* | **33** |

5 + 1 + 6 + 1 = **13**. The parts sum.

### 12.4 Where the derived cut differs from the proposed one

**The third code is `org.case_vocabulary.manage`, not `org.ethics.vocabulary.manage`** — the
proposed name is one table too narrow. `case_assignment_roles` is **not ethics-specific**: it is
consumed by `set_case_narrative_assignment_role` and `set_case_phase_assignment_role`, i.e. general
case machinery. All three vocabularies are structurally identical — same columns
(`id, organization_id, key, display_name, is_active, position`), same gate, same org scope, same
`none` sensitivity — so **nothing forces a split between them**, and splitting anyway would be
generality bought before its first use (§ 11.1's own argument against option B). One code; the name
says what it covers.

The other two names are taken as proposed.

### 12.5 Row 33 (was 31) — no sibling read code is needed

`app.can_read_professional_profile` has two arms: it delegates to `can_manage_professional`, else
falls back to case-committee reach. When the manage gate splits, **arm 1 re-points to row 30 only**
— reading a professional profile must not be granted by holding the external-participant or
vocabulary codes.

⛔ **No sibling read code for the `non_sensitive` registry.** Reads of `public.participants` are
governed by policy `participants_select` — `app.is_org_member(organization_id) OR app.is_admin()`
— an **org-member baseline**, not a `staff_admin` grant. External-participant reads are therefore
already covered, and inventing a code for them would assert a permission the system does not have.

⚠ **Flagged, not claimed, because it is outside this matrix's scope:** that same policy governs
`patient`-type rows, whose `display_name` is `patient_phi`-classed. Whether an org-membership gate
is the right reach for that is a Rule 12 question for the case/PHI module owner — it is not a
`staff_admin` question and I have not derived it.

### 12.6 Row 16 verification — case seating IS covered

Verified rather than presumed. `add_case_participant`, `remove_case_participant` and
`set_case_participant_role` are all `prosecdef = t`, gated on **`is_staff_admin_of`** (so they sit
in § 0's 151 bare-form set), write **`case_participants`**, and do **not** call
`can_manage_professional`. They are commission-scoped case seating and are covered by **row 16**.
✅ No missing row.

⚠ **One accounting correction while there:** § 3's family table is an aggregation aid whose
classifier keyed on function *names*, and it misfiled two of these —
`ensure_professional_participant` into `staff` and `create_external_participant` into `cases`. The
family counts are therefore approximate by construction and must not be cited as a code's site
list. **Rows 30–33 above are derived per function, not from that table**, and row 16's authority is
the named case-seating doors rather than the "72" aggregate.

### 12.7 ⛔ The scope anomaly does NOT dissolve — it redistributes

All four codes take `p_org` and resolve at the **organization** while being held via a
**commission**-scoped role. **§ 11.3's binding requirement on AE4.4 survives the split intact and
now covers four codes instead of two.** The obvious reading — that removing professional identity
from `staff_admin` dissolves the anomaly — is **false**: `org.participants.external.manage` and
`org.case_vocabulary.manage` remain org-scoped permissions held via a commission-scoped role
regardless of what happens to row 30.

⚠ **No domain change was needed.** All three sensitivity values used here
(`class2_professional_identity`, `none`) already exist in `authz.sensitivity_class`.
