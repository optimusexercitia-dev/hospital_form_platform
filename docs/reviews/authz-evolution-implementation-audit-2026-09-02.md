# Authorization evolution implementation audit

**Date:** 2026-09-02  
**Reviewed branch:** `authz-ae4-catalog` at `a0b27f3c` against `main` at `145aa796`  
**Primary authority:** [ADR 0155](../decisions/0155-post-aff4-tenancy-and-person-model-evolution-sequence.md) and the [authorization evolution plan](../plans/authz-evolution.md)  
**Implementation state reviewed:** AE0–AE3 as landed history; AE4.1–AE4.8 as currently built on the branch  
**Verdict:** **CHANGES REQUESTED — do not merge AE4 and do not begin AE5**

## Executive verdict

The branch has built a substantial, well-defended **role-assignment catalog and test oracle**, but it has **not built the permission-based runtime authorization model that ADR 0155 D7 and AE4.6 specify**.

The decisive defect is simple:

- production `staff_admin` wrappers call `authz.holds_role(...)`;
- `authz.holds_role(...)` reads assignment facts and role state, but no permission code or permission grant;
- `authz.has_direct_permission(...)` is the only production function that reads `authz.role_permissions` for an allow decision;
- no production function calls `authz.has_direct_permission(...)`.

Consequently, deleting `staff_admin`'s `commission.forms.edit` grant makes the catalog resolver deny while the product wrapper continues to allow. Changing permission implications has the same non-effect on production. The approved permission matrix therefore cannot be the post-cutover regression oracle for the authorization actually shipped.

This is not an unfinished gate record around an otherwise correct cutover. It is an architectural contradiction between the declared model and the implemented authority path. The branch should stay unmerged while that contradiction is resolved.

## Evidence and validation performed

The audit used a fresh local catalog (`supabase db reset --local`) before the behavioral probes. I reviewed the plan, ADRs, migrations, production call sites, generated vector inputs and outputs, pgTAP, TypeScript role seams, progress records, and existing AE4 review.

Fresh verification on the reviewed tree:

| Check | Result |
|---|---:|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS, 12/12 gates; progress-size warning remains |
| `npm run test` | PASS, 151 files / 2,058 tests |
| `npm run test:db` | PASS, 254 files / 8,504 tests |
| Fresh-catalog production-function census | No caller of `authz.has_direct_permission`; only the resolver and explanation read `authz.role_permissions` |
| `e2e:prod` | Not repeated in this audit; the recorded gate is already RED and is summarized under F10 |

The green suites are real evidence for the behavior they cover. They do not rebut the findings below because the central defect is the boundary between the tested evaluator and the production enforcement path.

### Phase conformance snapshot

| Phase | Audit assessment |
|---|---|
| AE0 | Baseline/census and matrix-axis groundwork is present and remains useful. No new blocking defect found in the local artifacts. This audit did not re-run the historical linked-remote census, so it does not renew any time-sensitive remote figure. |
| AE1 | Hardening and measurement work is present, but the phase deliberately classified rather than executed 233 revokes; 137 of the recorded forms are silent no-ops. The C2 enforcement blind spot also remains a pre-pilot obligation. “Complete” must not be read as “the reachable authorization surface is closed.” |
| AE2 | Affiliation/tenancy changes replay and test green locally. The last-affiliation containment error remains unmapped and its apparent regression guard does not cover the trigger path. |
| AE3 | Restricted-detail cutover replays and tests green locally. This audit did not repeat the historical remote cutover; its runbook still contains a count-observability defect summarized below. |
| AE4 | Substrate, seeds, candidate resolver, differential machinery, `staff_admin` wrapper rewrite, gate re-pointing, and app role refactor are built. The production permission cutover is not. **Do not merge.** |
| AE5–AE7 | Not implemented; do not start AE5 until the AE4 authority seam is corrected. |

## Findings summary

| ID | Severity | Finding | Merge disposition |
|---|---|---|---|
| F1 | **BLOCKER** | The permission catalog is disconnected from production authorization | Redesign/correct before merge |
| F2 | **BLOCKER** | The claimed exhaustive differential is not bound to the live permission catalog or enforcement sites | Replace the coverage contract before merge |
| F3 | **MAJOR** | The resolver interface ignores scope kind and authority state, and its explanation can be false or nondeterministic | Correct before any runtime caller is added |
| F4 | **MAJOR** | `session_selectable` is inert; AE4.8 explicitly did not implement G4 | Implement in `assume_role` before Gate AE4 |
| F5 | **MAJOR** | Positive entitlements, hard denies, lifecycle, and sensitivity are not separated into a safe final-authorization seam | Decide and encode the model before AE5 |
| F6 | **MAJOR opportunity** | Active context selects a role type, not an exact assignment; audit scope can disagree with effective authority | Decide now, while context storage can still break compatibly |
| F7 | **MODERATE** | The TypeScript “single manifest” is still several mirrored maps, and its DB binding test is non-hermetic | Deepen the module before adding roles |
| F8 | **MODERATE** | `authz.roles` deliberately contains `administrativo`, which the implementation says is not a role | Split role and capability-provider concepts now |
| F9 | **MAJOR** | The runtime shape has no scaled plan evidence, while the branch adds 15,050 lines around an unused permission evaluator | Measure only after F1 is corrected; block merge meanwhile |
| F10 | **BLOCKER (readiness)** | Gate AE4 remains red/incomplete independently of F1–F9 | Finish the recorded gate work after redesign |

---

## F1 — BLOCKER: the permission catalog is not production authority

### Required behavior

ADR 0155 D7 requires permission codes to be statically visible at enforcement wrappers, legacy-versus-catalog equivalence over the same fixtures, and an atomic cutover of the stable wrapper family **to the resolver** ([ADR 0155 lines 211–242](../decisions/0155-post-aff4-tenancy-and-person-model-evolution-sequence.md#L211)). The plan repeats that requirement in AE4.6 ([plan lines 845–863](../plans/authz-evolution.md#L845)).

### Implemented behavior

The cutover migration explicitly says its target is `authz.assignment_facts`, “NOT a permission code” ([AE4.6 migration line 7](../../supabase/migrations/20261003007200_ae46_cutover_staff_admin.sql#L7)). The later chokepoint migration makes both wrappers one-line calls to `authz.holds_role(...)` ([lines 79–149](../../supabase/migrations/20261003007210_ae47b_holds_role_chokepoint.sql#L79)). `holds_role` evaluates:

- a live assignment;
- role code;
- assignment scope;
- active-role context for self checks;
- `authz.roles.state = 'authoritative'`.

It does **not** read:

- `authz.permissions`;
- `authz.role_permissions`;
- `authz.permission_implication_closure`;
- a permission code.

The fresh-catalog function census produced:

```text
has_direct_permission_callers|<none>
role_permissions_readers|authz.has_direct_permission, authz.explain_direct_permission
```

That census excludes the resolver and explanation from the first row. There is no production authorization caller beyond those definitions.

### Behavioral proof

The following rollback-contained probe used the seeded `staff_admin` subject after a fresh reset:

| Probe state | Product wrapper | Catalog resolver | Explanation/result |
|---|---:|---:|---|
| Baseline | `true` | `true` | — |
| Same commission UUID, caller says scope kind `hospital` | — | `true` | Wrong kind accepted |
| Delete `staff_admin → commission.forms.edit` | `true` | `false` | `scope_unreachable` |
| Restore grant; set `staff_admin.state = 'legacy'` | `false` | `true` | Evaluators disagree in the opposite direction |

The probe was wrapped in `BEGIN … ROLLBACK`; it did not alter the catalog.

### Impact

1. Revoking a permission grant does not revoke the corresponding product authority.
2. Granting a new permission does not grant product authority.
3. Permission implications do not affect product authority.
4. Most catalog metadata cannot affect product authority.
5. The catalog-versus-matrix half of the differential tests an unused candidate evaluator, not the post-cutover runtime evaluator.
6. A role can be marked `authoritative` while its approved permission bundle remains observationally irrelevant to authorization.

ADR 0174 records the current `holds_role` design and says AE4.6 cut `staff_admin` to the catalog through assignment facts ([ADR 0174 lines 15–33](../decisions/0174-authz-holds-role-chokepoint-and-authoritative-state-gate.md#L15)). It explicitly amends ADRs 0106 and 0079, but only **relates** to 0155 D7 ([lines 3–13](../decisions/0174-authz-holds-role-chokepoint-and-authoritative-state-gate.md#L3)). The plan's authority order says ADR 0155 wins over conflicting execution detail. Calling a role-state/assignment predicate “the catalog” does not satisfy D7's permission-resolver decision.

### Required correction

Make an explicit product/architecture decision before editing more roles:

**Recommended:** retain a permission model, but make it real.

- Treat `authz.has_entitlement(principal, permission, scope)` as an internal positive-grant evaluator.
- Put explicit, statically greppable permission codes in domain authorization wrappers such as `app.can_edit_commission_form(...)`.
- Have those domain wrappers compose hard restrictions before positive entitlements.
- Make `authz.roles.state` load-bearing in the runtime entitlement entry point.
- Keep `app.is_staff_admin_of*` only if the product genuinely needs a role-assignment predicate; do not call it a permission cutover seam.
- Re-run the direct-call census over **permission enforcement sites**, not merely literal `staff_admin` role sites.

The alternative is to admit that this is intentionally a role-assignment registry, delete or defer the unused permission/implication/explanation substrate, and amend ADR 0155 and the plan. Shipping both models is the worst option: it preserves all complexity while only one side has authority.

---

## F2 — BLOCKER: the differential is not exhaustive over the implemented catalog

AE4.5 requires a generated mapping from every permission to current enforcement sites and a report that fails if any catalog permission, non-legacy role, wrapper, or approved cell lacks a test mapping ([plan lines 817–843](../plans/authz-evolution.md#L817)). The current artifacts do not meet that contract.

### Vacuous catalog coverage arms

The general generator contains apparently correct failure loops:

```js
for (const permission of spec.catalogPermissions ?? []) { /* fail if unmapped */ }
for (const role of spec.nonLegacyRoles ?? []) { /* fail if no suite */ }
```

See [generator lines 246–255](../../scripts/gen-authz-matrix-cells.mjs#L246). However, the real input defines neither `catalogPermissions` nor `nonLegacyRoles` ([axes input](../../supabase/tests/vectors/authz-matrix-axes.json)). Both loops execute over empty arrays.

The generator's self-test proves that hypothetical populated fields would fail. It does not prove that the production input populates them. This is exactly the shape of a control that passes because its subject is absent.

### The “seven-axis” grid uses the pre-catalog operation vocabulary

The axes input enumerates 13 operations:

- one `role_at_scope` predicate;
- seven `_case_caps` bits;
- five `administrativo` capabilities.

It does not enumerate the 43 live permission codes ([axes lines 62–68](../../supabase/tests/vectors/authz-matrix-axes.json#L62)). Its generated coverage report says 117,000 expected, 2,002 executed, and 114,998 skipped, but that count is a cross-product of the old operation vocabulary, not evidence that all 43 permissions have an enforcement mapping.

### The actual differential reduces the permission axis to three representatives

The separate Python generator hard-codes only:

- `commission.forms.edit`;
- `org.professionals.create`;
- `org.professionals.read`.

See [lines 35–47](../../scripts/gen-authz-differential-cells.py#L35). It explicitly marks `operation`, `resourceLifecycle`, and `sensitivity` as **not swept** ([lines 49–69](../../scripts/gen-authz-differential-cells.py#L49)). Its current output is 648 executed cells and 1,152 skipped cells.

Representative reduction can be valid when the equivalence partition is itself load-bearing and production uses the same equivalence classes. Here it is insufficient because:

- production does not use the permission resolver at all (F1);
- lifecycle and sensitivity have no runtime reader (F5);
- the enforcement-site mapping is a hand-authored SQL `CASE` with an `ELSE is_staff_admin_of_for` default ([pgTAP 401 lines 1163–1179](../../supabase/tests/401_ae4_authz_catalog.sql#L1163)).

A newly inserted permission automatically falls into the default role gate instead of forcing an explicit enforcement decision. The suite can therefore report a total mapping while the new permission has no code-specific product site.

### Required correction

Create one committed, generated **permission-enforcement manifest** with no default arm. Each catalog permission must explicitly declare:

- its domain authorizer or enforcement wrapper;
- every direct enforcement site, or a generated call-graph boundary with a reviewed reason;
- applicable axes;
- hard-deny classes that remain outside positive entitlement evaluation;
- expected legacy equivalence during its role's cutover;
- owner and expiry for any compatibility exception.

Generate the permission set from migration-owned source or a committed catalog extract. Fail on set difference in both directions:

```text
catalog permissions − manifest permissions = failure
manifest permissions − catalog permissions = failure
authoritative roles − approved differential suites = failure
```

Remove the `ELSE` mapping. A 44th permission must break generation until somebody explicitly names its product enforcement path.

---

## F3 — MAJOR: the resolver is an unsafe, mixed-purpose interface

The existing AE4 review already identified part of this as F9. The current implementation retains the unresolved defects and adds a state mismatch that becomes critical if the resolver is connected to runtime.

### `p_scope_kind` is accepted and ignored

`authz.has_direct_permission(principal, scope_kind, scope_id, permission)` never uses `p_scope_kind`; its own comment calls the parameter “call-shape symmetry” ([resolver lines 212–245](../../supabase/migrations/20261003007170_ae44b_adapter_resolver_explanation.sql#L212)). The fresh probe confirmed that a commission UUID with caller-supplied kind `hospital` still grants a commission permission.

This interface invites a caller to believe an input was validated when it was not. Either:

- validate that the declared kind agrees with the permission's resolution kind and with the ID's namespace; or
- remove caller-supplied kind and derive it completely from the permission.

Do not keep a security parameter for aesthetic symmetry.

### Runtime state and candidate-evaluator state are conflated

`has_direct_permission` ignores `authz.roles.state`. That is useful for a pre-cutover candidate oracle, which must evaluate a `test_validation` role. It is unsafe for a runtime function with a general authorization name. The fresh probe showed the contradiction directly: setting the role to `legacy` made `holds_role` deny while `has_direct_permission` continued to allow.

Split the interfaces:

- a private/test-only candidate evaluator that may evaluate `test_validation`;
- an authoritative runtime evaluator that requires `state = 'authoritative'` and fails closed otherwise.

The caller must not select which evaluator authorizes a request.

### The name is false

`has_direct_permission` joins the reflexive-transitive implication closure. It answers effective/entailed permission, not direct permission. Rename it to `has_entitlement` or `has_permission` before it becomes a widely copied API.

### The explanation can lie

When the assignment can reach the correct scope but the role lacks the requested grant, `explain_direct_permission` returns `scope_unreachable`. The grant-deletion probe reproduced that result. The function only tests reachability through rows that already grant or imply the requested permission, so “no permission grant” collapses into “scope unreachable” ([explanation lines 320–347](../../supabase/migrations/20261003007170_ae44b_adapter_resolver_explanation.sql#L320)).

Add a distinct `permission_not_granted` result and calculate assignment/scope reachability independently of the permission join.

Additional defects:

- the composite declares `denied_reason text` despite creating `authz.denial_reason` immediately above it ([lines 261–283](../../supabase/migrations/20261003007170_ae44b_adapter_resolver_explanation.sql#L261));
- `LIMIT 1` has no `ORDER BY`, so the reported granting role and permission are nondeterministic when multiple grants or implication paths qualify ([line 327](../../supabase/migrations/20261003007170_ae44b_adapter_resolver_explanation.sql#L327));
- explanation is not an authorization decision and must not be exposed as one;
- if explanations become remotely callable, auditing must be inside the diagnostic door rather than a convention imposed on every caller.

Use the typed denial domain in the composite. Either return all granting paths in deterministic order or define and test one explicit precedence rule.

---

## F4 — MAJOR: `session_selectable` is inert and G4 was not implemented

AE4.8 explicitly requires `assume_role` to read `authz.roles.session_selectable` rather than validate against the TypeScript/enum vocabulary ([plan lines 874–890](../plans/authz-evolution.md#L874)). The implementation records this as “not implementable” and moves only a manifest comparison to Vitest ([role catalog lines 123–135](../../src/lib/role/role-catalog.ts#L123)).

The fresh-catalog census found:

```text
session_selectable_readers|<none>
```

`public.assume_role` still accepts `public.platform_role`, special-cases `platform_admin`, and otherwise checks memberships ([function lines 40–86](../../supabase/migrations/20260918002600_act_assume_role_audit_scope.sql#L40)). Changing a catalog row's `session_selectable` value has no effect.

The “not implementable” rationale confuses **client table access** with **server-side authorization**. `public.assume_role` is already `SECURITY DEFINER`; it can query the sealed `authz.roles` table without granting `anon`, `authenticated`, or `service_role` schema access. If preferred, a private adapter can encapsulate that read. No general public catalog door is required.

Required correction:

- enforce `session_selectable` inside `assume_role`;
- prove a true→false mutation prevents selection while other roles still work;
- decide whether selection also requires an allowed catalog state, and encode that rule once;
- keep the UI manifest check as a presentation-drift guard, not as a substitute for server authority.

Because there are no live users, seriously consider retiring the `platform_role` parameter enum now and accepting a validated catalog code (`text` or a catalog-backed domain) in the same migration. Waiting until AE5 creates a second compatibility migration for no user-facing benefit.

---

## F5 — MAJOR: positive entitlement is being mistaken for final authorization

The current resolver answers only whether a live assignment plus permission grant reaches a scope under the active-role rule. It does not make the final domain decision. In particular, it does not enforce:

- recusal/respondent hard denies;
- record lifecycle rules;
- resource-specific immutability;
- sensitivity ceilings;
- any domain restriction that must beat a positive grant.

That separation can be good design, but the current API and plan language call the positive result a “permission” and the explanation an authorization explanation. A future caller can easily use `has_direct_permission(...) = true` as final allow and omit the restriction layer.

The catalog confirms the risk. A fresh production-function census found no readers of `risk_class`, `sensitivity_ceiling`, or `resource_kind`. `resolution_scope_kind` is load-bearing; the other classification columns are labels today.

Recommended model:

```text
assignment providers
        ↓
positive entitlement resolver (`authz.has_entitlement`)
        ↓
domain authorizer (`app.can_*`) combines hard denies, lifecycle, sensitivity, and entitlement
        ↓
RLS policy / command door / server action
```

Rules:

- hard restrictions run before positive sources;
- enforcement sites call a domain authorizer, not the generic table interpreter;
- `explain_entitlement` describes only the positive RBAC component;
- any final authorization explanation is produced by the domain authorizer and identifies which hard restriction won;
- classification columns must either become load-bearing with mutation tests or be removed until they have a defined consumer.

Do not preserve inert metadata merely because it makes the catalog look complete. A field with no decision consumer is documentation, not policy.

---

## F6 — MAJOR opportunity: select an exact assignment, not only a role type

`app.active_role_selections` stores only `(session_id, user_id, role, chosen_at)` ([table lines 37–42](../../supabase/migrations/20260918002000_act_stage3_active_role_infrastructure.sql#L37)). If a person holds the same role in several commissions, selecting `staff_admin` activates that role across every qualifying assignment because authorization compares only the role code.

Meanwhile, `assume_role` chooses the most recently granted matching membership to stamp organization/hospital/commission into the audit event ([lines 73–99](../../supabase/migrations/20260918002600_act_assume_role_audit_scope.sql#L73)). Effective authority can span multiple commissions while the audit event implies one selected scope.

The current plan deliberately defers exact-scope context, so this is not an AE4 implementation violation. It is a pre-live modeling opportunity with a shrinking window.

Decide explicitly between:

1. **Role-wide hat:** selecting a role intentionally activates all current assignments of that role. If retained, document that semantics and stop recording one arbitrary membership scope as if it were the selected authority.
2. **Exact-assignment hat (recommended):** store an assignment identity or `(role_code, scope_kind, scope_id)` in the server-side selection. Authorizers require the active selection to match the assignment that grants the entitlement. Audit the same exact coordinate.

The second option gives revocation, explanation, and audit a common subject and removes ambiguity before real sessions or compatibility expectations exist.

---

## F7 — MODERATE: the TypeScript seam is shallower than advertised

AE4.8's useful achievement is that landing precedence is no longer copied between `page.tsx` and `landingRouteForRole`. Preserve that improvement. However, a future role still crosses multiple declarations:

- `ROLE_LABELS` ([line 32](../../src/lib/role/role-catalog.ts#L32));
- `ROLE_SCOPE_KIND` ([line 57](../../src/lib/role/role-catalog.ts#L57));
- `ROLE_ORDER` ([line 89](../../src/lib/role/role-catalog.ts#L89));
- `ROLE_BRANCH` ([line 184](../../src/lib/role/role-catalog.ts#L184));
- the role-group switch in `scopeSummary` ([line 338](../../src/lib/role/role-catalog.ts#L338)).

`ROLE_MANIFEST` merely zips the first three sources ([lines 103–115](../../src/lib/role/role-catalog.ts#L103)). Type exhaustiveness and tests catch many omissions, but they do not provide one local extension seam.

Deepen the module: define one ordered manifest entry with code, label, assignment scope, selection status, landing branch, fallback/summary strategy, and precedence. Derive the compatibility exports and branch lists from it. Shared behavior should be an internal strategy, not another role-keyed map.

The DB-binding test also shells synchronously into the current Docker database during Vitest ([test lines 43–93](../../src/lib/role/role-catalog.test.ts#L43)). It is intentionally loud, but it is non-hermetic and can compare the checked-out TypeScript to a stale schema left by a bisect or earlier task. That exact stale-catalog class has already affected this phase's reasoning.

Prefer one of:

- generate a checked TypeScript artifact from migration-owned catalog data and verify it is current; or
- run the live-catalog binding as a database/integration gate immediately after a fresh reset, not as a unit test.

---

## F8 — MODERATE: the role table contains something explicitly declared not to be a role

The role seed inserts 12 rows: 11 platform roles plus `administrativo`. Its own comments say `administrativo` is “NOT A ROLE” and assign the structurally unreachable `capability_plane` scope kind to keep it out of memberships ([seed lines 66–74](../../supabase/migrations/20261003007110_ae4_seed_authz_roles_legacy.sql#L66)).

This makes `authz.roles` and `role_permissions.role_code` lie about their domain. It already causes special filtering in the TypeScript catalog binding (12 database rows versus 11 selectable roles), and future constraints must remember the exception.

Separate the concepts while schema compatibility is cheap:

- `authz.roles`: assignable/session role types only;
- assignment-provider adapters: membership, platform-admin profile flag, commission appointment/capability facts;
- entitlement bundles: the reusable permission set those providers confer.

`administrativo` can be a named capability provider or bundle without masquerading as a role. `platform_admin` can remain a system-managed role backed by the profile adapter.

Avoid solving this with more sentinel scope kinds. The need for an unreachable value is evidence that the table's abstraction is wrong.

---

## F9 — MAJOR: no performance evidence for a high-frequency RLS path

`authz.assignment_facts` is a `STABLE SECURITY DEFINER` set-returning SQL function that unions membership and profile scans ([resolver migration lines 28–53](../../supabase/migrations/20261003007170_ae44b_adapter_resolver_explanation.sql#L28)). `authz.holds_role` calls it, and the stable `staff_admin` wrappers are used throughout policies and helper closure. A security-definer SRF cannot be assumed to inline into the surrounding policy query.

The future permission resolver adds implication joins and `scope_reaches` lookups. Direct function correctness says nothing about per-row RLS plan shape, nested-loop amplification, or repeated evaluation.

The plan correctly requires a scaled, `ANALYZE`d fixture and nested-plan acceptance before cutover ([plan lines 788–815](../plans/authz-evolution.md#L788)). I found no completed AE4 scaled-plan artifact or acceptance record. Do not waive it because unit-size pgTAP is fast.

The branch currently changes 90 files and adds roughly 15,050 lines against `main`. Much of that is valuable evidence and documentation, so line count alone is not a defect. The architectural inefficiency is that deleting the unused permission evaluator would currently leave production authorization almost unchanged. That is low leverage for this much model and gate surface.

Order matters:

1. correct F1–F5;
2. then measure the actual final enforcement path under realistic RLS queries;
3. capture `EXPLAIN (ANALYZE, BUFFERS)` for representative allow and deny shapes at realistic membership, case, form, and policy cardinalities;
4. set explicit acceptance bounds against the AE0 baselines;
5. only then optimize or approve.

Optimizing `holds_role` before deciding whether it is the correct authorization seam would make the wrong design faster.

---

## F10 — BLOCKER: Gate AE4 is independently not ready

Even if F1–F9 did not exist, the repository's own live record says Gate AE4 cannot be declared.

### Recorded blockers

- `e2e:prod` is RED: 1,183 passed, 1 failed, 62 infrastructure-unproven, 3 flaky, and 13 did not run. The remaining deterministic regression is `BUG-AE47C-LINKAGE-001`, attributed to AE4.7c with mechanism still unknown ([PROGRESS line 91](../../PROGRESS.md#L91), [bug line 124](../../PROGRESS.md#L124)).
- C2 Tier 1 is a pre-Gate-AE4 PO-approval prerequisite. The adopted population is 237 doors sharing 243 enforcers; 171 enforcers are new to the arm, and only 8 of those 171 have been measured. Three of the first eight are BLIND ([PROGRESS lines 41–73](../../PROGRESS.md#L41)).
- `docs/backend-state.md` still has no `authz` Record-step section ([AE4 progress line 370](../progress/authz-ae4.md#L370)).
- The plan requires a reviewed AE4 rollback runbook and out-of-chain SQL template ([plan lines 853–860](../plans/authz-evolution.md#L853)). I found no AE4 rollback/runbook artifact.
- The scaled performance evidence required by AE4.4/Gate AE4 is absent (F9).
- Tester signoff on two changed E2E specs and a genuinely green E2E run remain owed by the phase's own handoff ([handoff lines 215–230](../handoffs/authz-ae4-catalog.md#L215)).

Do not relabel these as “gate paperwork.” C2 has already found real blind guards; the E2E gate has already found a real regression; the rollback and performance artifacts constrain operational risk.

## Cross-phase debt that should be closed before pilot

AE0–AE3 are recorded as complete and were not reopened wholesale by this audit. Their full pgTAP suite plus the current type, lint, and unit gates still pass on the AE4 head; the browser gate does not. These open items materially weaken the confidence story around a new authorization core:

| Debt | Why it matters now |
|---|---|
| `FUP-AE1-REVOKE-SET-EXECUTION` | AE1 classified 233 revokes and executed none; 137 are silent no-ops as written because privilege remains reachable through PUBLIC ([follow-up](../progress/follow-ups.md#-fup-ae1-revoke-set-execution--233-classified-revokes-are-held-partitioned-and-137-of-them-are-a-silent-no-op-as-written-owner-backendpo)). The new sealed schema does not compensate for old reachable doors. |
| `FUP-AUTHZ-HARNESS-TRANSACTIONAL` | The mutation harness neutralizes live gates outside a transaction; process death can leave an unconditional allow installed ([follow-up lines 1597–1610](../progress/follow-ups.md#L1597)). More AE5 mutations multiply this operational risk. |
| `FUP-AE2-VOID-LAST-ORG-AFFILIATION-UNMAPPED` | A containment denial still reaches the user as a generic retryable error, and the apparent test is bounded to doors rather than triggers ([follow-up](../progress/follow-ups.md#-fup-ae2-void-last-org-affiliation-unmapped--the-containment-triggers-23514-reaches-the-user-as-tente-novamente-and-the-guard-that-looks-like-it-covers-this-is-bounded-to-doors-owner-backend-filed-2026-08-31-from-the-ae24-residue-the-plan-said-to-assign-before-the-drop)). |
| `FUP-DBPUSH-SWALLOWS-NOTICE` | AE3's prescribed push command hides the only non-vacuous moved-row count; a 0/0 parity can pass ([follow-up lines 7103–7112](../progress/follow-ups.md#L7103)). Treat this as a warning against relying on console-only cutover evidence in AE4. |

These should not distract from F1. They are not reasons to leave the permission model disconnected; they are pre-live liabilities to retire while the same team is already touching authorization.

## Recommended redesign and execution order

### 1. Freeze the current cutover

- Do not merge `authz-ae4-catalog`.
- Do not seed or substitute another role.
- Do not spend time completing the current E2E/performance gate against an authorization seam likely to change.

### 2. Reconcile the authority documents

Hold one explicit architecture/PO decision:

- amend ADR 0174 and the implementation to satisfy ADR 0155 D7; or
- formally amend/supersede ADR 0155 and remove/defer permission machinery.

Do not leave “catalog” meaning role state in one document and permission resolution in another.

### 3. Establish three distinct interfaces

1. **Assignment projection** — which providers give which role/bundle at which exact scope.
2. **Positive entitlement** — which permission codes those assignments confer, including implication.
3. **Domain authorization** — hard denies, lifecycle, sensitivity, tenant/resource rules, then positive entitlement.

Only the third interface should be called from RLS policies and command doors for product decisions.

### 4. Make state and selection real

- Runtime entitlement requires `authoritative` state.
- Candidate/differential evaluation is private and cannot authorize a request.
- `assume_role` enforces `session_selectable` from the database catalog.
- Decide role-wide versus exact-assignment active context; prefer exact assignment and align audit scope.

### 5. Replace hand partitions with one generated enforcement manifest

- Source it from the 43 migration-owned permission rows.
- No default mapping.
- Generate coverage, differential fixtures, and static call-site checks from it.
- Require a code-specific product enforcement path for every permission.
- Make lifecycle/sensitivity applicable axes explicit per permission; “not applicable” must be data, not a global omission.

### 6. Simplify before scaling

- Split `administrativo` from roles.
- Collapse the TypeScript role maps into one real manifest.
- Rename misleading resolver/explanation APIs.
- Remove inert classification fields unless the redesigned runtime consumes them in this phase.
- Consider retiring `platform_role` and migrating active context now, with no live-user compatibility burden.

### 7. Rebuild evidence around the final path

- Fresh reset.
- Catalog↔manifest set-equality tests.
- Legacy↔candidate differential before cutover.
- Candidate↔approved matrix for every applicable cell.
- Mutation: grant deletion must flip the **production domain authorizer**, not only the generic resolver.
- State mutation must prove the candidate can be tested while runtime remains fail-closed.
- Wrong scope-kind/ID tests.
- Hard-deny-beats-entitlement tests.
- Scaled RLS plan evidence.
- C2 sweep, rollback rehearsal, backend-state record, and genuinely green E2E.

## What is worth preserving

The requested verdict is severe, but the branch contains several good foundations that should survive the redesign:

- the `authz` schema is sealed from direct application-role DML;
- catalog rows are migration-managed;
- role state provides a useful single cutover switch when read by the correct runtime evaluator;
- stable enforcement wrapper names are valuable audit seams;
- implication closure avoids recursive runtime traversal;
- assignment facts centralize expiry and principal-state projection;
- the mutation and coverage machinery frequently proves itself able to fail;
- AE4.8 removed duplicated landing precedence and added missing landing regression tests;
- the project records uncertainty and known gate failures unusually explicitly.

Preserve those mechanisms, but attach them to a production permission decision. The current branch has strong scaffolding around the wrong runtime seam.

## Handoff acceptance criteria

This review can move from **CHANGES REQUESTED** only when all of the following are demonstrated on a fresh catalog:

- deleting one seeded permission grant changes the corresponding production authorization result;
- every authoritative role's product path uses the approved permission model, not only role-state/assignment checks;
- every catalog permission has an explicit, generated enforcement mapping with no default arm;
- the runtime evaluator rejects non-authoritative roles while the candidate oracle remains testable and non-callable from product paths;
- scope kind is validated or removed from the resolver contract;
- missing grant, unreachable scope, wrong active context, and inactive/unassigned principal explain distinctly and deterministically;
- `assume_role` reads and enforces `session_selectable`;
- the role-wide versus exact-assignment context decision is recorded and audit semantics match it;
- classification metadata is either enforced or removed/deferred explicitly;
- scaled RLS plans meet recorded bounds;
- C2 Tier 1, rollback, backend-state, tester signoff, and E2E Gate AE4 are genuinely complete.

Until then, AE4 is not a permission-catalog cutover. It is a role-check refactor plus an unused permission oracle.
