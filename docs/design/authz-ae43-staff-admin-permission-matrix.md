# AE4.3 — the `staff_admin` permission matrix

**Phase:** AE4 · **plan:** [`docs/plans/authz-evolution.md`](../plans/authz-evolution.md) § AE4.3 ·
**authority:** ADR [0155](../decisions/0155-post-aff4-tenancy-and-person-model-evolution-sequence.md) D7,
ADR [0162](../decisions/0162-authz-evolution-plan-audit-corrections.md) §2 (PA-F8) ·
**owner:** backend · **status:** ✅ **PO-APPROVED 2026-09-01 — AT 42 ROWS**; the REGRESSION ORACLE from cutover. ⚠ **AMENDED 2026-09-01: row 30 splits by operation, +1 row (43) — § 12.8**, ✅ **BUILT in AE4.7c (§ 12.8.1)**; the live catalog holds **43** permissions and `staff_admin` holds **42 of 43** ·
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

⚠ **A LINE-RANGE CITATION IS A CLAIM ABOUT WHERE EVIDENCE ENDS, and it can be wrong in the
direction that manufactures a gap.** § 7.2 cited `ff2-matrix-views.spec.ts:132-268` and concluded a
capability was unpinned; the test actually runs to ~335 and pins it at 320–335. The range stopped
one section short of its own subject, and the derivation inherited that boundary as if it were the
evidence's. Same shape as `grep -A` on a declaration missing its docstring: **the window, not the
file, decided the answer.** ⛔ Cite a TEST by name (`FF2V-1`) and let the range be an aid — a
derivation that keys on a slice is only as true as the slice, and a too-narrow slice reads exactly
like a real gap.

⭐⭐ **WRITE DOORS GET NAMES; READ GATES GET PREDICATES — so a name-keyed derivation finds writes
systematically and misses reads systematically.** Not bad luck twice: by construction. `dispose_case_phi`
and `set_event_patient` are *named for what they do* and a name sweep finds them. `can_read_case_patient`
and `can_read_event_patient` are *predicates* consumed by policies and bitmasks, and a coordinator often
reaches them **transitively** (`can_read_case` → `has_case_capability` → `_case_caps`), so no function
name contains the capability at all. Every read gap in this matrix — rows 35, 39, 41, 42 — has this
shape, and every one was invisible bottom-up and immediate top-down. ⛔ **AE5's eleven matrices must
enumerate READ PREDICATES as a population in their own right**, not expect a name sweep to surface them.

⭐⭐ **KEEP A VERIFICATION INSTRUCTION INDEPENDENT OF THE REASONING THAT MOTIVATES IT.** A "check
X anyway" survives its own justification being wrong; a check derived FROM the justification dies
with it. Measured (AE4.6, 2026-09-01): the delegation ruling asserted that delegating to
`authz.assignment_facts` would inherit **all four** of `app.has_role`'s gates. It carries **three** —
the active-role filter lives in `has_direct_permission`, not the adapter — so building on the claim
would have dropped the hat gate for the 151 self-check sites, the exact defect § 6A exists to
prevent, introduced by the ruling meant to avoid it. ⭐ What caught it was the one clause attached to
that same ruling: *"inheriting a property is not evidence you inherited it — assert both polarities
at the wrapper level anyway."* The instruction held while the claim it was attached to did not.
⛔ So: never let a verification step be conditional on the argument for why it should pass.

⭐⭐ **EACH ARM OF A MULTI-ARM DETECTOR MUST BE SHOWN TO FIRE ON ITS OWN MESSAGE.** An arm that
reds because *something* broke when you removed its subject is not proven — another arm may be
catching it. Measured (AE4.5, 2026-09-01): the differential generator's "a declared representative
was never emitted" arm appeared to work, but the self-test removed `org.professionals.read` from the
cells, which also removes the only member of its legacy-equivalence class — so the *class-count* arm
fired and the representative arm was never exercised. Isolated by declaring a representative that is
simply never emitted. ⛔ Read the failing message, not the exit code.

⭐⭐ **A STATEFUL TEST HARNESS OWES A REPEAT-RUN CONTROL.** If the driver mutates state per case,
a green suite may be green by iteration luck. Measured: AE4.5's driver reset only the *current*
case's principal, leaving deactivated/suspended state on principals a previous case had touched, so
answers depended on iteration order. The control is one assertion — **a second sweep with nothing
changed must return identical answers** — and it is what makes a suite trustworthy rather than
merely *observed once*.

⛔ **A FAIL-PROOF THAT FIRES FOR A REASON OTHER THAN THE ONE IT NAMES IS NOT A FAIL-PROOF** — the
proof-of-sensitivity passing vacuously, which is the most dangerous shape in this family because it
is the thing you were relying on to catch the others. Measured: AE4.5's cleanup ran *before* the
fail-proof section, deactivating every fixture principal, so "flipping a grant reds the oracle"
passed because **every** cell denied. Ordering inside a suite is load-bearing.

⚠ **THE HONEST COST FIGURE, for AE5's eleven matrices: AE4.5 cost SIX driver defects, and every one
produced a plausible failure pointing at the resolver** — claims not reset per case; a third-party
case whose caller was the principal (a self-check wearing a third-party label); `absent`
active-context asserted where it is unconstructible for a single-role principal; order-dependent
state; cleanup before the fail-proofs; and cleanup itself blocked by the claims guard. **Estimate a
differential suite's cost as mostly harness, not subject.**

⭐⭐ **A COMPARISON IS A DETECTOR, AND A GREEN COMPARISON MUST BE PROVEN TO HAVE HAD SUBJECTS ON
BOTH SIDES.** Every other vacuity rule here is about a *test* finding nothing. This one is about a
*diff* finding nothing — which reads even more like success, because "no change" is the answer a
regression check is supposed to give. Measured instance (2026-09-01, the ADR 0173 deriver
amendment): a 60-range orig-vs-amended regression returned **identical on all 60**, and every one
was **empty on both sides** — the script copies were running outside the repo and failing with
`FATAL: not a git repository`. *Identical* meant *identically broken*. ⛔ Before believing a
comparison, ask what each side actually produced, not merely whether they matched — and re-run it
against inputs known to produce output.

⚠ **Its sibling, from the same pass: AN INDEX IS A CLAIM ABOUT A POPULATION.** § 7's header
promised "the residue" and would have been counted as six open gaps; adding a status index fixed
the *count* but inherited the *boundary* — an open item was living outside § 7 entirely, in a
carry-forward list, and the index's own existence made it easier to miss by inviting the inference
that everything unlisted was covered. ⛔ The next reader's question is not only **"is this list
right"** but **"is this list ALL of it"**, and only the second one catches a register whose
boundary is wrong.

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

**42 rows** — 38 commission-scoped (1–29, 34–42) + 4 org-scoped (30–33, § 11). ⚠ **The PO approved this matrix at 33 rows (`e3297dad`). Rows 34–38 are OUTSIDE that approval**: row 34 came from the § 7.4 verification, rows 35–38 from the § 13 site reconciliation. **Nine rows of delta (34–42), for one PO pass** — 34 from the § 7.4 verification, 35–38 from § 13's bottom-up reconciliation, 39–40 from § 14's top-down one, 41–42 from § 15's read/write pairing pass. ⚠ The org-scoped four were
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
| 7 | `commission.signoffs.sign` | commission_content | write | none | **D** `app.can_sign_section` · **E2E** `ff2-matrix-views.spec.ts:132-335` (FF2V-1 — `chefe.ccih` clicks "Assinar seção", `signed_by` verified in `response_section_signoffs`), `ff1-repeating-groups.spec.ts:1212-1284` |
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
| 25 | `commission.accreditation.manage` | commission_content | write | none | ⚠ **indicators split out to row 40.** **D** the standards/frameworks/evidence fns · **E2E** `phase16-accreditation-restricted.spec.ts:180-207` (⚠ requires staff_admin **AND** an ACL row) |
| 26 | `commission.referrals.manage` | commission_content | write | none | **D** 10 referral fns · **R** `case_referral_insert_source_coord` (**`_for` variant**) |
| 27 | `commission.referrals.phi.read` | **phi** | read | **phi** | **D** `app.can_read_referral_phi` · **E2E** `nsp-per-hospital.spec.ts:834-850` — a **sanctioned cross-hospital** read, not a leak |
| 28 | `commission.safety_events.report` | commission_content | write | none | **D** safety-event door from case detail · **E2E** `phase14a-safety-events.spec.ts:188-233` |
| 29 | `commission.audit.read` | audit | read | none | **R** `audit_log_select` (**SELECT only**) |
| **34** | `commission.charter.manage` | commission_content | write | none | ⭐ **ADDED 2026-09-01 by the § 7.4 verification — this row was MISSING.** **D** `upsert_commission_charter` (`is_staff_admin_of` + re-raises `HC0K0`) · **T** `manage/charter/page.tsx:80` · ⚠ **write-only**: `commission_charters_select` is member-level, not `staff_admin` |
| **35** | `commission.safety_events.phi.read` | **phi** | read | **phi** | ⭐ **ADDED 2026-09-01 by the § 13 reconciliation — a PHI capability with NO row.** **R** `event_patient.event_patient_select` · **D** `public.get_event_patient`, gate `app.can_read_event_patient` (`is_staff_admin_of_for(e.current_owner_commission_id)`) · PHI-access-audited via `app._audit_access_authorized`. ⚠ Rule 12 Class-1 module `event_patient` |
| **36** | `commission.safety_events.phi.write` | **phi** | write | **phi** | ⭐ **ADDED.** **D** `set_event_patient` — the **only** custody door that writes `event_patient`. Split from row 37 because a code may not span a sensitivity boundary (§ 12.1) |
| **37** | `commission.safety_events.custody` | commission_content | write | none | ⭐ **ADDED.** **D** `acknowledge_event`, `cancel_event`, `update_event`, `transfer_event_custody` — gate `app.event_current_custodian`, live only when `current_owner_kind = 'commission'`. All write `patient_safety_event` / `event_custody`, never `event_patient` |
| **38** | `commission.dsr.execute` | audit | write | none | ⭐ **ADDED.** **R** `dsr_tasks.dsr_tasks_select` · **D** `attest_dsr_task`, `complete_dsr_task`, `list_my_dsr_hospitals`, `list_my_dsr_task_commissions`, `list_my_executable_dsr_tasks` — gate `app.can_execute_dsr_task`, feature-flagged `dsr` (LGPD data-subject requests) |
| **39** | `commission.cases.phi.read` | **phi** | read | **phi** | ⭐ **ADDED 2026-09-01 by the § 14 top-down pass — Rule 12's THIRD module had no read row.** **D** `app._case_caps` coordinator branch — `if v_coord then` ORs in `read_standard_phi` — reached by `app.can_read_case_patient` → `has_case_capability(…, 'read_standard_phi')`. Module: `patient_identifiers` / `patient_participants`. ⚠ **standard tier only** — `read_restricted_phi` needs an explicit grant, and the domain cannot yet express that difference (§ 9's deferred ordering) |
| **40** | `commission.indicators.manage` | commission_content | write | none | ⭐ **ADDED — split out of row 25.** CLAUDE.md § 1 lists *quality indicator* and *accreditation standard/evidence* as **separate** governance modules with separate flags (`quality_indicators` / `accreditation`) and separate tables; § 3's family classifier had folded them into one. **D** `create/update/archive_indicator`, `set_indicator_target`, `record_indicator_measurement`, `compute_derived_measurement`, `indicator_kpis` |
| **41** | `commission.cases.read` | commission_content | read | none | ⭐ **ADDED by § 15's audited-read register pass.** **D** `app.can_read_case` → `has_case_capability` → `_case_caps` coordinator branch (`view_case_overview`, `read_case_deliberation`, `read_case_content`); **audited** as `case.opened`. Row 16 covered the WRITE only |
| **42** | `commission.meetings.minutes.transcript.read` | commission_content | read | none | ⭐ **ADDED.** **D** `public.read_minutes_transcript`, gate `app.can_read_minutes_transcript` — `is_staff_admin_of_for(commission_of_meeting(j.meeting_id))` and `j.status = 'done'`; **audited** as `minutes_transcript.read`; flag `audio_minutes`. Row 11 covered meeting WRITES only |
| **30** | `org.professionals.manage` ⛔ **`staff_admin` LOSES THIS — § 12.8** | identity | **authority** | **class2_professional_identity** | ⚠ **ORG-SCOPED — § 11.** **D** `create/update/redact_professional_profile`, `set_professional_link_state`, **`ensure_professional_participant`**. Reach: **ADR 0078 §B7** ("any org `staff_admin`", the respondent twin's precondition, closed by the `HC0F2` linkage freeze) |
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

⚠ **Not everything below is still open — a reader counting subsections would overcount the
gaps.** The PO's approval of this matrix (2026-09-01) explicitly does **not** cover the ones that
remain.

⛔ **THIS INDEX IS A CLAIM ABOUT A POPULATION, AND THE CLAIM IS: these are ALL of this matrix's
open evidence gaps.** An open item recorded anywhere else is a defect *in this index*, not a
footnote elsewhere — because a reader who sees "the approval does not cover § 7's open gaps"
reasonably concludes everything outside § 7 **is** covered. § 7.7 was travelling in a carry-forward
list for exactly that reason and has been relocated here.

✅ **AS OF 2026-09-01 THIS POPULATION IS EMPTY — § 7 HAS ZERO OPEN EVIDENCE GAPS**, so the matrix's
evidence base is closed. ⛔ **That changes what the PO's carve-out excludes**: it was recorded as
covering-all-but *"§ 7's two open evidence gaps"*, and there are now none. Re-record it — the
carve-out no longer subtracts anything.
⚠ **But the closure surfaced something the approval does not cover: row 34** (§ 7.4), a
`staff_admin` permission with no code. The matrix is now **34 rows**, approved at **33**.

| § | status |
| --- | --- |
| 7.1 five cross-commission denials pinned by UI text | ✅ **CLOSED 2026-09-01** — `tester` built all four sites (`1068e9fc`) |
| 7.4 three identically-worded sibling gates | ✅ **CLOSED 2026-09-01** — verified individually; ⭐ **yielded missing row 34** |
| 7.7 self-lift of one's own recusal | ✅ **CLOSED 2026-09-01** — closed on the **differential**, not the deny |
| 7.2 `signoffs.sign` "unpinned" | ✅ resolved — the **citation** was the defect, not the coverage |
| 7.3 `BUG-STAGEC-READER` | ✅ not a difference — premise measured false |
| 7.5 `CorrectionCaps.canApprove` | ✅ resolved — wired all along |
| 7.6 no column expresses PHI sensitivity | ✅ resolved — shipped as `20261003007130` |

### 7.1 ✅ CLOSED — five denials were pinned by UI TEXT, not by a status or an RPC error

> ✅ **CLOSED 2026-09-01.** `tester` built all four sites (`1068e9fc`), **non-uniformly, as scoped**
> — real `.toBe(404)` at the two layout-level denials; a **data-layer PostgREST assertion** at
> `phase8-dashboard.spec.ts`, where a status check would have been actively *wrong* (a page-level
> denial under a streamed layout returns **200**, so the live-checked shape is HTTP 200 + empty
> array, not 403); and the one missing sibling assertion in `act-role-assumption.spec.ts`. Each was
> proven able to fail by a wrong-direction flip with the received value recorded, and two got live
> positive controls. ⭐ Every site carries the **"same-org, cross-commission — none is cross-org"**
> classification, which is what stops a future reader "strengthening" one into a cross-org test
> that would pass while proving nothing (§ 6.1, and there is no seeded cross-org persona).

**The original finding, retained:**

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

### 7.2 `commission.signoffs.sign` — RESOLVED, and the defect was MY CITATION, not the coverage

⛔ **This entry was wrong and is corrected in place.** It claimed the "Assinar seção" click-through
was pinned only for a *different* persona (`chefe.farm`) and that `chefe.ccih`'s evidence stopped
at the review screen. Measured by `tester` 2026-09-01: **false.**

`ff2-matrix-views.spec.ts` FF2V-1 runs to ~line **335**, not 268. Within that same test, with no
persona switch in between, `chefe.ccih` clicks **"Assinar seção"** at **320–335**, the spec polls
`response_section_signoffs` until count = 1, and asserts `signed_by` = `00000000-…-0002` —
confirmed against the live catalog as `chefe.ccih@test.local`, not a placeholder. It further
asserts the answers were undisturbed by signing.

So the capability is **fully pinned, persona-attributed and DB-verified**. There was never a gap.
⛔ No new spec was requested or is wanted; `tester` correctly declined to build a duplicate.

⚠ **This is the fourth premise on this branch to measure false** — after `unfillable`'s stated
cause, `BUG-STAGEC-READER`'s misquoted copy, and the § 7.4 dashboard comment. Every one of them
read as diligence, which is why none would have been re-checked without being measured.

### 7.3 Row 12's pinned entry — ⛔ NOT a defect after all — and one now-vacuous pin

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
contradiction; they were **not individually re-verified** when this was written. **They now have been — see
§ 7.4.1.**

### 7.4.1 ✅ The three sibling gates, verified INDIVIDUALLY — and they are not uniform

⛔ **Verified one at a time, never one-and-generalise** — "they share a pattern" is what produced
the near-miss above, and the dashboard family had already proved uniformity is the wrong
assumption (3 of its 9 functions omit the tenancy arm). The three **do** differ, and one of them
exposed a missing row.

**All three route gates are textually identical and all three are CORRECT:**
`if (!access || access.role !== "staff_admin") notFound();`

| gate | its own claim | verdict |
| --- | --- | --- |
| `manage/documentos/layout.tsx:30` | authoring surface is `staff_admin`; the approval queue is ORG-level "because an approver may be OUTSIDE this commission" | ✅ **verifies** — authoring writes (`create_controlled_document`, `publish_document`, `mark_document_obsolete`, `attach_controlled_document_version_file`) are `is_staff_admin_of`-gated, and `approve_document` is deliberately **not**, exactly as its own comment explains. ⚠ carries the stale coercion claim |
| `manage/charter/page.tsx:80` | flag + role gate the route; "the write RPC re-enforces `HC0K0`" | ✅ **verifies completely, including its catalog claim** — `upsert_commission_charter` is `is_staff_admin_of`-gated **and** raises `HC0K0`. ⭐ **And it does NOT carry the stale coercion claim** — so the "identically-worded" premise was itself imprecise |
| `manage/acreditacao/layout.tsx:33` | route is `staff_admin` "even though the underlying RLS is broader — any commission member may READ …; only WRITES are `staff_admin`-only" | ⚠ **read half VERIFIES, write half is IMPRECISE.** All four SELECT policies (`accreditation_frameworks`, `accreditation_standards`, `evidence_links`, `standard_assessments`) gate on `is_member_of`, not `staff_admin` — claim true. But `set_standard_ownership` is an accreditation **write** gated on `is_hospital_admin_of OR is_org_admin_of`, so "only writes are staff_admin-only" overstates it. Also carries the stale coercion claim |

**Conclusion on the rows they support: all correct.** No matrix row changes. `set_standard_ownership`
is a hospital/org-admin capability and correctly has **no** `staff_admin` row — assigning which
commission owns a standard is a tenancy decision, not a coordinator one.

⭐ **What the verification DID find: `commission.charter.manage` had no row at all.**
`upsert_commission_charter` is a `staff_admin`-gated DEFINER door with its own route surface, and
the matrix had no code for it — **now row 34**. ⛔ This is why "verify each separately" was the
right instruction: the charter gate is the one whose comment was *clean*, so a reader
spot-checking the two suspicious siblings would have skipped precisely the one hiding the gap.

⚠ **Documentation defect carried by two of the three** (`documentos`, `acreditacao`, not
`charter`): the same stale *"or an org/hospital-admin resolved to that role"* coercion claim as
§ 7.4's dashboard comment — removed in `4dd5cfa2`. Behaviour is correct in all three; the comments
need correcting.

### 7.5 `CorrectionCaps.canApprove` — RESOLVED, not a gap

Explore A reported it declared-but-unwired. **Measured: it is wired.** Computed at
`src/components/cases/case-detail-view.tsx:502` as `canApprove: caps.canManageLifecycle`, consumed
at `case-corrections-panel.tsx:175-203` and `file-correction-control.tsx:109`. The approve surface
is live (`manage/cases/[caseId]/correcoes/[requestId]/page.tsx`, `src/lib/corrections/actions.ts`)
and the server door `approve_correction` carries a bare `is_staff_admin_of` gate. Defence in depth,
correct, no work item. Recorded because "a declared thing no caller passes" is a real class and the
negative result is worth having on the record.

### 7.6 No column expresses PHI sensitivity — ✅ RESOLVED, shipped

Was a PO decision (§ 9); **ruled and shipped 2026-09-01** as migration `20261003007130`.
`authz.permissions.sensitivity_ceiling` now carries the class as a column, so AE4.1's
PHI-separation invariant joins on a column rather than degrading to a substring test on a
permission code. ⛔ The **ordering / comparison rule** remains deferred, and pgTAP 401 §13.6–13.7
gates that abstinence with a constructed detector.


### 7.7 ✅ CLOSED — self-lift of one's own recusal now has a SESSION-LEVEL witness

Relocated into § 7 on 2026-09-01. It had been travelling in a carry-forward list, i.e. outside the
register the PO's approval carves out from — the precise inverse-inference this index exists to
prevent. It belongs here by § 7's own definition (evidence weaker than the claim) and it is
matrix-scoped: it is **row 18**, `commission.cases.recusal.manage`.

⛔ **STATED PRECISELY, BECAUSE THE OBVIOUS PHRASING IS WRONG.** It is **not** "nothing pins this".
The mutation layer pins it, and pins it well — `supabase/tests/229_authz_m1_exclusion_durability.sql`
(verified at source, lines 300–314):

- a **precondition** assertion that `app.is_recused_from_case(...)` is `true` first, commented
  *"the deny has something to read"* — a vacuity control, so the refusal cannot pass against an
  absent subject;
- `throws_ok(public.lift_recusal(...), 'HC0F1')` — *"a recused coordinator cannot lift HER OWN
  recusal (A27's headline)"*;
- a **durability** assertion after it that `is_recused_from_case` is still `true`.

**The gap is narrower and should be described as exactly that: no spec exercises the refusal
through a logged-in session.** The pgTAP acts as `authenticated` via `set local role` +
`test_helpers.claims_for`, which simulates the session at the DB layer — it is not a witness that
the app's own path refuses it. That distinction matters here because this is the least-covered
corner of the § 5 exception the PO dated to 2026-12-01.

> ✅ **CLOSED 2026-09-01, and closed on the DIFFERENTIAL rather than the deny.** Measured by the
> lead: `SB-6` (`case-access.spec.ts:1622`) — **1 passed, `PW_EXIT=0`**, `--workers=1`. ⭐ **And the
> positive control**, which is what makes the closure mean anything: the **same RPC, same actor**
> (`chefe.ccih`) at `ethics-e1-access-spine.spec.ts:427`, where `lift_recusal` **restores** access —
> **1 passed, `PW_EXIT=0`**. Without that second run, SB-6 passing would have been equally
> consistent with *"she can never lift anything"* — a green deny that proves nothing. The refusal is
> now attributable to the **self-exclusion**, not to a broken RPC or a powerless actor.

⛔ **This entry was held 🔴 OPEN while `tester` built the witness, and closed only on the lead's
measurement.** Closing it on the strength of someone building it would have been the same shape as
the four premises in § 0 — an expectation wearing the clothes of a result.
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

---

### 12.8 ⭐ Row 30 SPLIT BY OPERATION — `staff_admin` may ADD a professional, never MODIFY one

**Ruled 2026-09-01, after TWO reversals, each forced by a measurement — the trail is in
§ 12.8.5 and is worth reading before re-opening this.** Final: row 30 **splits by OPERATION**.
`staff_admin` keeps a new **row 43 `org.professionals.create`** (add / seat / complete linkage) and
**loses row 30** (`update`, `redact`). Timing: **AE4.7c, after AE4.7b** — ✅ **BUILT 2026-09-01**, § 12.8.1. Row 30 above was approved
*as today only*, and this is the change it was waiting for.

⛔ **This subsection exists because the approval's scope lived in exactly one place, and it was the
wrong place.** The provisionality was a parenthetical inside a PROGRESS.md § Decisions row about a
*different* subject (the 42-row approval). This document — the one AE4.5 asserts
`catalog == approved matrix` against — carried row 30 as an ordinary approved row: no marker, no
owner, no follow-up. A reader auditing the oracle would have found an approved over-grant and no
reason to doubt it. ⚠ The same failure hit this file's own **status line**, which still read
*"DRAFT — awaiting PO approval"* several increments after approval.

⚠ **§ 12.7 above is the necessary companion to this one:** removing row 30 does **not** dissolve
the org-scope anomaly, because rows 31 and 32 stay org-scoped permissions held through a
commission-scoped role. Whatever § 12.8.5 rules, that anomaly outlives it.

#### 12.8.1 What is actually built — live catalog, 2026-09-01

✅ **ALL THREE ROWS ARE NOW BUILT — AE4.7c, 2026-09-01** (migrations `20261003007220` +
`20261003007230`). The table below is kept as the state it was ruled *from*, with each row's
closure beside it, because the "two-thirds catalog / zero enforcement" state is the one that makes
the split-first rule legible.

| | state as ruled | closure |
| --- | --- | --- |
| **Catalog codes** (§ 12.3's cut) | ✅ **SHIPPED.** All four exist and are granted to `staff_admin`: `org.professionals.manage` (30), `org.participants.external.manage` (31), `org.case_vocabulary.manage` (32), `org.professionals.read` (33) | ✅ + **row 43** `org.professionals.create`, granted; **row 30 REVOKED** from `staff_admin`. 43 permissions / 42 grants |
| **Gate split** | ⛔ **NOT BUILT.** `app.can_manage_professional` is still **one function gating all 13 doors**; no external-participant gate and no vocabulary gate exist in `app` or `public` | ✅ **BUILT.** `app.can_manage_external_participant` (31), `app.can_manage_case_vocabulary` (32), `app.can_create_professional` (43), and `app.is_org_commission_staff_admin` — **the ascent, isolated to ONE site** so the three widened gates share it rather than hand-copying it |
| **The revoke** | ⚠ **NARROWED IN SCOPE, not cancelled.** `staff_admin` loses row 30 (`update`/`redact`) but gains row 43 for the ADD doors — § 12.8.5 | ✅ **LANDED**, in the same migration as the gate change (403 § 4.1 asserts `legacy == catalog`, so a split transition would red the oracle) |

⭐ **Two-thirds done in the CATALOG, zero done in ENFORCEMENT** — that was precisely the state in
which a naive revoke is most tempting and most wrong. Deleting the grant then would have removed
`staff_admin` from **all 13 doors**, including external-participant minting (row 31) and the
case/ethics vocabularies (row 32), both of which `staff_admin` **KEEPS**. That is what the
*split-first* rule protects, and why it is stated as an order rather than a preference.

⚠ **What the build measured that this ruling did not predict**, recorded because each was found by
a red rather than by reading:
- **`app.can_read_professional_profile` had to move too.** Row 33 `org.professionals.read` is a
  code `staff_admin` KEEPS, and its only enforcement site is that function's arm 1 — which was
  `can_manage_professional`. Leaving it would have denied every `staff_admin` the org-wide read the
  matrix grants them, and 403 § 4.1 would have red on a divergence the split never intended. It now
  follows the POPULATION (`can_create_professional`), not the gate name.
- **The differential's row-33 substitution had to move with it** (403's `else` branch). That branch
  stands in for the real door under QA finding F3 — still open — so the substituted gate must be
  the ARM it stands for, or the red is a substitution artifact.
- **pgTAP 229's over-grant twin went vacuous exactly as § 12.8.5 predicted**, and 257's `HC0J7`
  expectations collided with their own `42501` control exactly as predicted. Both were split rather
  than re-coded: authority and freeze are now separate assertions with separate callers.
- **The three new gates carry NO `authenticated` EXECUTE**, because they post-date AE1.2's default
  revoke — a tightening the split delivered for free, and the reason pgTAP 318's PART 2 no longer
  switches database role.

#### 12.8.2 The over-grant being closed, stated plainly

`app.can_manage_professional(p_org, p_uid)` grants to `platform_admin`, to an `org_admin` of
`p_org`, **or**:

```
exists (select 1 from public.commissions c
         where c.organization_id = p_org
           and app.is_active(p_uid)
           and app.is_staff_admin_of_for(c.id, p_uid))
```

The `exists` ascends from **any** commission in the org. So one commission's `staff_admin` can
create, update, redact and link-state **org-wide** professional-identity records — org authority
from a commission seat, on **Class-2** data. Not a labelling question. (pgTAP `321:193-194` pins
exactly this arm: a `staff_admin` of a *sibling* commission with no case reach is an org manager.)

#### 12.8.3 ⛔⛔ BLOCKER — "it becomes org-admin-only" is NOT IMPLEMENTABLE AS STATED

Measured 2026-09-01 against `src/` and `e2e/`, both claims verified directly rather than taken from
a report:

- **The only UI reaching these doors is gated on `staff_admin`, and tenancy admins are locked OUT
  of it BY DESIGN.** `canOpenCaseManagement` (`src/lib/queries/cases.ts:791`) has three arms —
  commission `staff_admin` (from `memberships` alone), `administrativo` of that commission, or a
  per-case content-write grant. Its own comment records that **ADR 0100 D12 / BUG-QOB-003 deleted
  the tenancy-admin → `staff_admin` coercion**, "so no tenancy or platform admin can arrive here".
- **E2E asserts the denial**, with positive controls proving it is not a broken-persona artifact:
  `e2e/case-manage-entry-gate.spec.ts` runs `assertManageDenied` for `orgadmin.a@test.local` and
  `hospitaladmin.a1@test.local` after confirming each one's own tenancy surface loads.
- **There is no professionals surface under `/o/[org]/manage/` at all** — no `src/app` path matches
  `*profession*`.

| principal | passes the door after the revoke | can reach the surface |
| --- | --- | --- |
| `staff_admin` (commission) | ✗ | ✓ |
| `org_admin` / `platform_admin` | ✓ | ✗ — denied, and asserted |

⛔ **The intersection is EMPTY.** The revoke does not move the capability to `org_admin`; it strands
the feature for everyone. "Adicionar participante" (professional lane) and "Resolver vínculo"
become unreachable by any principal. ✅ **RESOLVED — this measurement is what overturned ruling 1** (§ 12.8.5). The final answer keeps
`staff_admin` on the ADD doors, so nothing is stranded. ⛔ Keep this subsection: without it the
reversal reads as a softening rather than the correction of a premise that measured false.

#### 12.8.4 The split is ANSWER-PRESERVING but NOT test-neutral — and that is the tripwire working

All three codes are granted to `staff_admin` today, so splitting the gate changes **no
authorization answer**, and AE4.5's `is(legacy, catalog)` half must stay green **across** it. ⛔ But
it is not a silent refactor:

- **`320:112` pins the door population at exactly 12** public RPCs whose comment-stripped `prosrc`
  contains `can_manage_professional`, with an explicit instruction: *"Do not just bump the number —
  the point is that someone looks at the new door and confirms it wants this gate's semantics."*
  A split drops that count and **reds 320 by design**. Re-derive from the catalog and re-argue each
  door; never bump.
- `401` maps the `org.*` codes to `can_manage_professional` and pins its signature; `404:35` and
  `318:177` assert the gate is TRUE for a live `staff_admin` — these survive a *split* (new
  predicate for row 30's five doors) but die if `can_manage_professional` itself is re-aimed.

#### 12.8.5 Disposition — ✅ RULED 2026-09-01: **SPLIT BY OPERATION.** `staff_admin` may ADD, never MODIFY

⛔ **This is the THIRD ruling on row 30, and each reversal was forced by a measurement, not by
preference.** The trail matters, because the final answer looks obvious and the first two did too:

| # | ruling | what overturned it |
| --- | --- | --- |
| 1 | `staff_admin` **loses** `org.professionals.manage` — "it becomes org-admin-only" | § 12.8.3: `org_admin` **cannot reach the surface** (ADR 0100 D12). Door ∩ surface = ∅ — the revoke strands the feature |
| 2 | **narrow** the gate by **case reach**, mirroring `can_read_professional_profile`'s arm 3 | The PO stated the product fact: **a `staff_admin` only ever ADDS a professional — never modifies, never deletes.** Case reach was solving a harder problem than the one that exists |
| 3 | ⭐ **SPLIT BY OPERATION** — below | *(current)* |

⭐ **Why ruling 3 beats ruling 2 on every axis.** Case reach is a **per-RESOURCE** condition, which
a role→permission→**scope** catalog structurally cannot express — it would have lived in the door
body with `authz` still answering TRUE, and the gate record would have needed a permanent "the
catalog is not the whole story here" caveat. *Add vs modify* is a **CAPABILITY** distinction, which
is exactly what a catalog models. It also needs no DEFINER traversal (so no fail-open risk from a
mis-written join, no `removed_at is null` to forget), no `p_case_id` signature change, and it
matches the product's real usage instead of approximating it.

##### The cut, and it lands almost exactly on the bootstrap boundary

| door | operation | code | `staff_admin` |
| --- | --- | --- | --- |
| `create_professional_profile` | mint a profile | **43** `org.professionals.create` | ✅ keeps |
| `ensure_professional_participant` | seat it in the participants registry | **43** | ✅ keeps |
| `set_professional_link_state` | complete its platform linkage | **43**, ⚠ bounded — below | ✅ keeps, bounded |
| `update_professional_profile` | alter an existing identity record | **30** `org.professionals.manage` | ⛔ **LOSES** |
| `redact_professional_profile` | redact an existing identity record | **30** | ⛔ **LOSES** |

⭐ **The two doors `staff_admin` loses have ZERO product callers.** Measured across `src/`:
`updateProfessionalProfile` (`src/lib/participants/actions.ts:460`) and `redactProfessionalProfile`
(`src/lib/ethics/actions.ts:637`) are exported and **never called** — no component, no page, no
route. So the removal costs the product **nothing**; it only reds pgTAP suites that pin the current
over-broad behaviour. ⛔ That is a reason the change is cheap, **never** a reason to skip the tests:
a door with no caller today is a door with no caller *today*.

##### ⚠ `set_professional_link_state` — kept, but bounded to transitions OUT of `unknown`

It belongs on the ADD side because it *completes* an add rather than altering an established
record: `add-participant-dialog.tsx:959` sets the initial linkage immediately after creating, and
the "Resolver vínculo" affordance (`resolve-linkage-dialog.tsx`) **only renders while the row's
link state is `unknown`** — its own header calls it remediation for a profile "already sitting at
platform-account linkage `unknown`", reusing the add dialog's fieldset.

⛔ **But the DOOR accepts transitions the UI never offers.** `link_state` is
`linked | no_account | unknown`, and the RPC will move an **established `linked`** profile to
`no_account` — flipping a real account association — because nothing in the door reads the *current*
state. **RULED: for the `staff_admin` arm only, require the profile's current `link_state` to be
`unknown`.** `org_admin` / `platform_admin` keep it unrestricted. Shape:

```
app.can_manage_professional(v_org, auth.uid())                 -- org admin: unrestricted
or ( app.can_create_professional(v_org, auth.uid())            -- staff_admin: completing an add
     and v_profile.link_state = 'unknown' )
```

⭐ This is the *"no UI ≠ not reachable"* class, closed at the door instead of trusted to the
component that happens to hide the button today.

##### What moves in the catalog — and unlike ruling 2, the oracle DOES move

✅ **A 43RD MATRIX ROW IS APPROVED (PO, 2026-09-01)** — the first amendment to the 42-row approval,
made under its own stated rule that "a 43rd row needs its own approval".

| | change |
| --- | --- |
| **New** row 43 `org.professionals.create` | org-scoped, `class2_professional_identity`. Granted to **`staff_admin`** and **`org_admin`** |
| Row 30 `org.professionals.manage` | ⛔ **`staff_admin`'s grant is REVOKED.** Retained by `org_admin` / `platform_admin` |
| Rows 31 / 32 / 33 | unchanged — `staff_admin` keeps external-participant minting, the case vocabularies, and the read code |
| New gate `app.can_create_professional(p_org, p_uid)` | carries the `staff_admin` org-ascent arm that `can_manage_professional` loses |
| `app.can_manage_professional` | ⛔ **loses its `staff_admin` arm entirely** once § 12.3's family split has moved rows 31/32/33 off it |

⛔ **ORDER IS LOAD-BEARING, and getting it wrong is a live over-grant window.** The § 12.3 family
split must land **first**: while `can_manage_professional` still gates external-participant minting
and the vocabularies, dropping its `staff_admin` arm strips `staff_admin` from rows 31 and 32,
which it **KEEPS**. Family split → operation split → grant change, in that order.

##### ⚠ The differential oracle needs a new representative, or its org-scoped class goes single-polarity

`scripts/gen-authz-differential-cells.py`'s `REPS` uses **`org.professionals.manage`** as the
representative of the `can_manage_professional` legacy-equivalence class. Once `staff_admin` loses
that code, **every one of its cells becomes a denial**, and the class stops exercising the granted
polarity at all — a real coverage loss that no arm currently names, because arm2 and arm5 are
satisfied globally by other reps.

⭐ **AE4.7c must re-point that rep to `org.professionals.create`**, which `staff_admin` *does* hold,
and regenerate. ⛔ Both halves move in the same migration: 403 §4.1 asserts `legacy == catalog`, so
the grant change and the gate change must land together or the oracle reds on its own transition.

##### ⚠ pgTAP that reds BY DESIGN — every one pins the behaviour being removed

- `228_ethics_e1:615-617` — `update_professional_profile` under `sa_x`
- `257_ethics_e2_retention:119-153,179-185` — `redact_professional_profile` under `sa_x`. ⛔ Its
  `HC0J7` expectation becomes `42501` and **collides with its own `42501` negative twin at
  `:140-146`** — a negative test whose error code drifts onto its control's code can go green for
  the wrong reason. Re-argue both, do not just re-code one
- `229_authz_m1_exclusion_durability:161-229` — `set_professional_link_state` under `sa_x`; `:187`
  promotes a member to `staff_admin` *so that* the gate admits him, then pins `HC0F2`. Under the
  `unknown` bound that over-grant twin may go **vacuous** — the failure mode to watch, not the red
- `321_eth_e4_participant_seating:193-194` — **K3 PRE asserts a SIBLING-commission `staff_admin` IS
  an org manager.** ⭐ For the ADD doors that stays true (row 43 keeps the ascent); for the MODIFY
  doors it must flip. Split the assertion rather than delete it — it is the sharpest statement of
  the arm in the whole suite
- `320:112` — the *exactly 12 doors* tripwire reds on the family split and again on the operation
  split. ⛔ Re-derive from the catalog and re-argue each door; never bump the number

⛔ **And the fail-open direction still needs its own arm.** Everything above measures access being
*removed*. Nothing would notice `can_create_professional` being written too wide, or the
`link_state = 'unknown'` bound being dropped. AE4.7c owes a positive/negative pair on each: a
`staff_admin` adds (passes) and modifies (denied); sets link state from `unknown` (passes) and from
`linked` (denied).

##### Naming note

`org.professionals.create` is the code the PO approved by name. ⚠ It covers create **plus** seating
**plus** initial linkage, so the name is narrower than its contents; `org.professionals.register`
would read truer. Recorded as a flag, not a change — § 12.4 already ruled that a code's name should
say what it covers, and this is the one place that rule is being bent knowingly.

## 13. Site→row reconciliation — ENUMERATION IS NOT MAPPING

§ 0 counted the sites. It never confirmed each one lands in a row, and **row 34 proved that gap is
real**: a `staff_admin`-gated DEFINER door with its own route surface, missing from a derivation
that ran five planes, passed review, and was approved. One missing row does not imply exactly one,
so this is the full mapping — every site to a row, or an explicitly classed exclusion.

⛔ **This is the check AE4.5's coverage report is specced to perform** ("fails when any catalog
permission, role, wrapper, or approved cell has no test mapping"). Finding these at AE4.5 would be
finding them at the worst possible time — after the differential suite is built against an
incomplete oracle.

### 13.1 Function sites — 178, and the parts sum

| bucket | count | disposition |
| --- | --- | --- |
| mapped to a row by resource family | 168 | — |
| **regex misses** — genuinely map to an existing row | 5 | `app.copy_version_children` → 1 · `insert_block_from_library` → 1 · `save_block_to_library` → 1 · `app.guard_supersession_coherent` → 23/24 · `list_approver_candidates` → 23 |
| **excluded: `staff_admin` is the ADMINISTERED VALUE, not the acting role** (§ 4.1) | 2 | `app.grant_role_impl`, `app.revoke_role_impl` — both use `p_role in ('staff','staff_admin')` as a *scope dispatch*. Granting the role belongs to AE5's `org_admin`/`hospital_admin` matrices |
| ⭐ **NEW ROWS** | 3 predicates → **4 rows** | `app.can_read_event_patient` → **35** · `app.event_current_custodian` → **36 + 37** (split at the sensitivity boundary) · `app.can_execute_dsr_task` → **38** |

**168 + 5 + 2 + 3 = 178.** ✅ The parts sum.

⚠ **Neither exclusion class is a singleton** — the administered-value class has 2 members and the
regex-miss class has 5. A class with one occupant would be a hand-list wearing a label, and would
need justifying individually rather than by class.

### 13.2 Policy sites — 65, zero residue

Every one of the 65 policies maps to a row by table family: forms (7 + storage), responses (7),
process templates (9), meetings (15), staff (3), action items (2), audit (1), cases (20).
**Residue: 0.** No new rows from the policy plane.

### 13.3 Plane 4 (routes) — 34 surfaces, one orphan, already fixed

34 route files gate on `access.role === "staff_admin"`. All map to rows —
dashboard (4) → 8 · `encaminhamentos` → 26 · `itens-de-acao` → 22 · `acreditacao` (5) → 25 ·
`assinaturas` (2) → 6/7 · `cases` (8) → 16–19 · `documentos` (7) → 23/24 · `meetings` (2) → 11 ·
`respostas` → 4 — except two:

- `manage/charter/page.tsx` — **this was the orphan**, and it is now row 34.
- `layout.tsx` — the commission shell gate. **Not a capability**: it resolves the shell and admits
  the coordinator area as a whole; every capability inside it has its own row.

⚠ **Explore A's deduplicated capability list held 22 items; the matrix holds 38 rows.** Those two
numbers were never reconciled and it is worth stating why they differ rather than leaving the gap:
a capability list does not split at the **reversibility** boundary (`forms.edit` / `forms.publish`)
or the **sensitivity** boundary (`safety_events.custody` / `.phi.write`), and it does not carry the
four **org-scoped** rows (30–33), which are not commission routes at all.

### 13.4 ⭐ What the new rows say about the derivation that missed them

Rows 35–37 are the **patient-safety custody chain**, and row 35 is a **Class-1 PHI read** (Rule 12's
`event_patient`). The original derivation reached the safety module through `phase14a-safety-events`
and recorded row 28 (`safety_events.report`) — the *filing* capability — and stopped. **The
custody-side capabilities a coordinator holds once an event is transferred to her commission were
never enumerated**, because no plane's entry point led there: the E2E spec exercises filing, the
policy sweep sees `event_patient_select` as a safety-module policy rather than a `staff_admin` one,
and the function sweep found the predicates but the family classifier had no bucket for them.

⛔ **A PHI capability with no row is the most serious gap this matrix can have** — it is exactly
what AE4.1's PHI-separation invariant and `sensitivity_ceiling` exist to make checkable, and neither
can constrain a permission that does not exist. Row 35 now carries `sensitivity_ceiling = phi`.

⚠ Row 38 (`commission.dsr.execute`) is feature-flagged `dsr`. A flag that is OFF in production does
not make the permission absent — it makes it **unexercised**, which is precisely how a capability
avoids every plane's attention.

---

## 14. TOP-DOWN reconciliation — against populations this project already declares

⛔ **§ 13 is still bottom-up.** It proves every site that *names* the role maps to a row. It cannot
prove every capability the role *holds* has one — and the proof that this matters is that § 13
itself was run, passed, and still left three gaps.

**The shape of the failure, stated plainly because it indicts the method rather than the effort:**
the approved matrix carried exactly **two** PHI rows (20, 27). **Rule 12 names THREE isolated PHI
modules.** Two of three. That is answerable in thirty seconds by anyone asking *"is there a row per
declared module?"* — and **no plane asked, because all five are bottom-up.** Each sweeps the code
and collects sites; none reconciles against a population the architecture already declares.

Each population below is a **closed list written by someone else**. A self-authored population
would be a hand-list wearing a label.

### 14.1 Rule 12's three PHI modules — source: `CLAUDE.md` § 1 / Architecture Rule 12

| module | row | verdict |
| --- | --- | --- |
| `referral_patient` | 27 | ✅ covered |
| `event_patient` | 35, 36 | ⚠ **was missing** — added by § 13 |
| `patient_identifiers` / `patient_participants` | 20 (dispose), **39 (read)** | ⛔ **read was missing** — row 20 covered only *disposal* |

⭐ **The same shape twice: the module's PHI *write/dispose* had a row and its *read* did not.** For
the case module the coordinator's read arrives through the `_case_caps` bitmask, so no function is
named `..._read_case_phi` for a name-keyed sweep to find. **This check is now explicit so it cannot
fail silently a third time: one row minimum per Rule 12 module, per operation.**

### 14.2 CLAUDE.md § 1's governance modules — source: `CLAUDE.md` § 1

| module | row(s) | verdict |
| --- | --- | --- |
| audit trail | 29 | ✅ |
| patient-safety / NSP | 28, 35, 36, 37 | ✅ (three added this pass) |
| inter-committee referrals | 26, 27 | ✅ |
| **quality indicator** | **40** | ⛔ **was folded into row 25.** § 1 lists it as a **separate** module; it has its own flag (`quality_indicators`) and its own tables. § 3's name-keyed family classifier merged `indicator|measurement` into `accreditation` |
| accreditation standard & evidence | 25 | ✅ |
| controlled document | 23, 24 | ✅ |
| internal audit / mock tracer | — | ✅ **legitimate absence, stated**: zero functions match; the module is not built (Phases 13+) |

### 14.3 Canonical schema — source: `ARCHITECTURE.md` Rule 2

`forms` / `form_versions` / `form_sections` / `form_items` → rows 1–2 · `responses` / `answers` →
rows 4–5 · `response_section_signoffs` → rows 6–7 (⚠ **0 policies** — its path is DEFINER-gated, so
a policy-only reconciliation would have shown a false gap here).

**Legitimate absences, each with a reason:** `profiles` and `commissions` carry **0**
`staff_admin`-gated policies — tenancy-level, AE5's `org_admin`/`hospital_admin` matrices;
`memberships` is § 13.1's administered-value exclusion. **0 new rows.**

### 14.4 Feature flags — source: `app.feature_flags` (42 keys)

Nine flags gate `staff_admin` doors inline, and every one maps: `action_items`→22,
`case_corrections`→5, `case_narratives`→16, `case_referrals`→26, `case_types`→16/21, `dsr`→**38**,
`item_validations`→1, `matrix_fields`→1, `power_authoring`→1. **0 new rows.**

⚠ **Bound on this check, stated rather than glossed:** it matches flags asserted *inline* in a
`staff_admin`-gated body. A flag asserted in a helper (`assert_charters_enabled`) called by the door
does not match, so the nine is a floor, not the population.

✅ **The one flag that is OFF — `attachments` — has no `staff_admin` surface at all**, and neither
does `patient_index`. So row 38's lesson (*an OFF flag makes a permission unexercised, not absent*)
was checked against the only live instance and found clean.

### 14.5 Result

**Two further rows: 39 and 40.** Populations 3 and 4 returned **0**, which is the first *top-down*
evidence for those two surfaces — a different and stronger claim than "the sweep was thorough".

⛔ **What this pass changes about the method, for AE5's eleven matrices:** a bottom-up sweep can
only find capabilities that *name* the role. Every gap found today — charter, the safety custody
chain, the case PHI read, indicators — was invisible to a name-keyed sweep and visible immediately
against a declared population. **AE5 should run § 14 FIRST and § 13 second**, because the top-down
pass is cheap, is answerable from documents that already exist, and bounds what the expensive sweep
then has to confirm.

---

## 15. Read/write pairing — and a FIFTH declared population

Scoped narrowly to the § 0 pattern: **for every write row, is there a read row or a stated reason
there is none?** Two confirmed instances existed where the write was rowed and the read was not;
the question was whether that asymmetry is confined to PHI. **It is not.**

⛔ **A row created to make a pairing symmetric would be worse than a stated asymmetry** — it asserts
a permission the system does not have, the failure § 11.1 option C and § 12 both closed. Every fold
below is justified by a mechanism, not by tidiness.

### 15.1 Read-shaped predicates consulting `staff_admin` — 8, all dispositioned

| predicate | disposition |
| --- | --- |
| `can_read_signoff` | row 6 ✅ already paired with row 7 |
| `can_read_event_patient` | row 35 ✅ |
| `can_read_referral_phi` | row 27 ✅ |
| `can_read_action_item` | **folded into row 22** — gates 5 child-table SELECT policies of the *same* resource (`action_item_assignments/status_history/reminders/updates/checklists`); one family, one door set |
| `can_read_document_hold` | **folded into row 23** — `document_legal_holds_select` is the documents family's read side. ⚠ Note the converse asymmetry: `place_document_hold` / `release_document_hold` are **not** `staff_admin`-gated, so this is a read *without* a matching write, which is correct and deliberate |
| `can_view_printed_document` | **folded into rows 23/24** — printed documents are the documents family's read/verify side |
| `can_read_full_case_content` | **not an independent surface** — its only consumer is `app.can_view_printed_document` |
| `can_read_minutes_transcript` | ⛔ **UNCOVERED → row 42** |

### 15.2 ⭐ The fifth population: `app._audit_access_authorized` — the audited-sensitive-read register

**A closed list, authored by someone else, that § 14 did not use.** It is the register of reads the
platform considers sensitive enough to audit, and it is *exactly* the class the § 0 pattern predicts
a name-keyed sweep will miss. Ten predicates:

| predicate | `staff_admin` reach | row |
| --- | --- | --- |
| `can_read_case_patient` | via `_case_caps` coordinator branch | 39 ✅ |
| `can_read_event_patient` | direct | 35 ✅ |
| `can_read_referral_phi` | direct | 27 ✅ |
| `can_read_professional_profile` | via `can_manage_professional` | 33 ✅ |
| `can_read_case` | **transitive** — `has_case_capability` → `_case_caps` | ⛔ **UNCOVERED → row 41** |
| `can_read_minutes_transcript` | direct | ⛔ **UNCOVERED → row 42** |
| `can_read_capa` | ❌ no `staff_admin` arm — reaches it as `is_member_of_for` | ✅ member baseline, no row |
| `can_read_event` | ❌ no `staff_admin` arm — `is_member_of_for` / `is_pqs_operator_of_for` | ✅ member baseline, no row |
| `can_read_referral` | ❌ no `staff_admin` arm — `can_read_referral_metadata` | ✅ member baseline, no row |
| `can_read_referral_internal_notes` | ❌ no `staff_admin` arm — `is_active` + `is_member_of_for` | ✅ member baseline, no row (the *write* side, `can_edit`/`can_manage_referral_internal_note`, **is** `staff_admin` and is row 26) |

**Four legitimate absences, all one mechanism: the coordinator reaches them as a MEMBER, not as a
coordinator.** That is the same reason row 33 needs no sibling (§ 12.5) — a member-level baseline is
not a `staff_admin` grant, and rowing it would over-grant.

### 15.3 ⚠ What the register says about `sensitivity_ceiling`, feeding § 9's deferred half

Rows 41 and 42 carry `sensitivity_ceiling = none` — correctly, since neither is a Rule 12 module nor
Class-2 professional identity. **But both are in the audited-sensitive-read register.** So the
platform already distinguishes a sensitivity the domain's three values cannot express: *audited
because sensitive, yet neither PHI nor professional identity*.

⛔ This is **not** an argument to widen the domain now — that is § 9's deferred ordering question, and
widening it here would answer it by accident. It is recorded as a **subject** for that decision: when
AE5 rules the ladder, `_audit_access_authorized`'s register is the closed population it should be
ruled against, not a fresh enumeration.

### 15.4 Result

**Two further rows: 41 and 42.** Both are reads; both were invisible to every name-keyed plane; one
is reached only transitively through a bitmask. ⭐ **Every read gap this matrix has had — 35, 39, 41,
42 — has the § 0 shape**, which is now stated there as a method rule rather than as four war stories.
