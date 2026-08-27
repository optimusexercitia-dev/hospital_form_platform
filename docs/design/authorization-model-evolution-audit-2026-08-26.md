# Authorization model evolution audit

- **Date:** 2026-08-26
- **Scope:** current database and application authorization model; review of ADR
  [0155](../decisions/0155-post-aff4-tenancy-and-person-model-evolution-sequence.md);
  recommended implementation sequence
- **Nature:** architecture and migration-planning report, not a production security attestation

## Executive conclusion

The current model is not broken. It has unusually strong database enforcement, clinical versus
administrative separation, controlled mutation doors, explicit hard denies, live expiry and account
checks, and a serious regression-test culture. The focused authorization suite run for this review
passed **402 tests across 14 pgTAP files**. All **170/170** current `public` tables have RLS enabled.

The model has nevertheless reached its maintainability limit. The main problem is not the shape of
`memberships` by itself. It is that the same authorization knowledge is repeated across:

- the `memberships` role CHECK and role-to-scope CHECK;
- the separate `platform_role` enum;
- role-specific grant/revoke branches;
- 41 database functions that read `memberships`;
- 117 RLS policies that call role-helper families;
- the TypeScript session partition, landing routes, labels, and action guards; and
- separate case-grant, Administrativo, affiliation, relationship, and service-role mechanisms.

ADR 0155 is therefore **sound as a sequencing and risk-control ADR, but insufficient as the planned
authorization upgrade**. D0-D4 should proceed with amendments. D5 is useful as an inventory and
compatibility seam but must be benchmarked and must not become the final authorization interface.
D6 should remain deferred, but its forcing function is defined too narrowly. Most importantly, the
ADR should reverse its provisional rejection of a migration-managed role/permission catalog. Because
the platform is not live, the catalog should be adopted through test-gated, role-by-role direct
substitution rather than runtime shadow evaluation. This can retain the current three-column scope
storage and every existing RLS wrapper; it does not require a `scopes` table or tenant-configurable
roles.

The recommended direction is a staged hybrid:

```text
authenticated principal + live account state
  -> selected authorization context
  -> existing scoped memberships (initially unchanged)
  -> migration-managed role-to-permission bundles
  + domain relationship adapters
  + explicit resource grants
  - hard restrictions
  -> typed domain authorization wrappers
  -> RLS / controlled RPC / Storage enforcement
```

This keeps the current security posture while making a new role primarily a catalog, exceptional
validator, routing, and test change—not a rewrite across policies and helpers.

## 1. Evidence and limitations

This review used the effective local PostgreSQL catalog after migration `20261003003800`, current
application source, ADRs 0078/0097/0106/0151/0154/0155, existing reviews and plans, Supabase's local
security/performance advisors, and focused tests.

### Measured catalog snapshot

| Measure | Current local value | Interpretation |
| --- | ---: | --- |
| `public` tables with RLS | 170/170 | Strong baseline; RLS coverage alone does not cover definer doors |
| `public` policies | 278 | Large enforcement surface |
| Policies calling role-helper families | 117 | Role semantics are a hot-path dependency |
| Policies directly mentioning `memberships` | 4 | ADR 0155's unverified assumption is substantially confirmed: most policies delegate |
| Functions reading `memberships` | 41 | Scope/role migration blast radius is concentrated but material |
| `app.can_*` functions | 51 | Domain authorization is fragmented across many predicate families |
| `SECURITY DEFINER` functions in `public` + `app` | 842 | Privileged implementation surface is very large |
| Executable by `authenticated` | 752 | 432 in `public`, 320 in `app` |
| Executable by `anon` | 0 effectively | 167 `app` functions have EXECUTE but `anon` lacks schema USAGE; this is latent ACL debt, not a current RPC route |
| Definer functions without pinned `search_path` | 0 | Strong hardening result |
| Tables with an FK to `profiles` | 93 | Confirms ADR 0155's reason not to re-key person identity wholesale |
| FK constraints pointing to `profiles` | 145 | Shows why “93 FKs” must be stated as 93 tables, not 93 constraints |

ADR 0155 recorded 283 policies and 119 role-helper policies before AFF4 completed. The effective
catalog already reports 278 and 117. That difference validates D0's requirement to re-measure rather
than treating design-review figures as durable facts.

### Verification performed

- Repository raw-DML gate: passed for `memberships` and `hospital_affiliations`.
- Migration `SET LOCAL` gate: passed; its self-test was 23/23.
- Focused pgTAP set: 14 files, 402 tests, all passed. It covered membership constraints, session
  context, actor-validating role doors, affiliation substrate/lifecycle/voiding, active-role
  enforcement, expiry/ACL hardening, and organization-affiliation policies/doors.
- Supabase security advisor: seven intentional-or-review-required RLS-with-no-policy findings and
  nine mutable-search-path warnings; no current definer function lacks a pinned search path.
- Supabase performance advisor: 113 `auth_rls_initplan`, 96 multiple-permissive-policy, and 202
  unindexed-FK warnings. These are candidates for measurement, not instructions to change every item
  mechanically.

The local database includes AFF4 migrations, but the repository records AFF4 as paused before its
full release gate. Production catalog, production cardinalities, concurrency, and query statistics
were not inspected. Findings below describe the current source/local state and must be revalidated
against the deployment target.

## 2. How authorization currently works

### 2.1 Identity, account state, and session responsibility

`auth.users.id` is also `profiles.id`, and that identifier is the person/principal key throughout the
application. `profiles` carries display/contact data, account lifecycle (`is_active`,
`suspended_until`), the global `is_admin` entitlement, and three specially protected fields (`cpf`,
`date_of_birth`, `phone`).

`app.is_active` is the universal fail-closed account gate. `platform_admin` remains outside tenant
membership and is represented by `profiles.is_admin`. This is intentional and supports the project's
“noun rule”: platform administration does not automatically confer clinical content access.

The session chooses an active **role type**. `public.assume_role` verifies a live entitlement,
stores the selection by `session_id`, audits the switch, and the custom access-token hook mints an
`active_role` claim. `app.has_role`, `app.has_role_any`, and `app.is_admin` live-check both the
underlying entitlement and the caller's active role. A stale or forged role name in the JWT is not
enough to preserve revoked authority.

This design has one deliberate limitation: choosing `staff_admin` activates that role across every
commission in which the caller holds it. It selects a responsibility type, not one assignment or one
scope.

### 2.2 Standing tenant authority

`public.memberships` stores standing roles at exactly three scope kinds:

| Scope | Current roles |
| --- | --- |
| Organization | `org_admin`, `nsp_org_admin` |
| Hospital | `hospital_admin`, `nsp_coordinator`, `pqs_member`, `technical_director`, `technical_director_deputy`, `quality_reviewer` |
| Commission | `staff_admin`, `staff` |

The role is authoritative. `memberships_scope_shape` constrains which scope columns must accompany
that role. The table also has composite hospital/organization and title/commission FKs, one
commission-role-per-person uniqueness, one titular technical director per hospital, expiry-aware
indexes/predicates, RLS, and SELECT-only access for `authenticated`.

Writes go through actor-validating grant/revoke functions. Service-role variants take an explicit
actor and re-derive authority in PostgreSQL. This is a deep and valuable write seam and should be
preserved.

### 2.3 Affiliation and person visibility

`hospital_affiliations` and `organization_affiliations` describe where a person works or has worked.
They are visibility and lifecycle inputs, not permission grants. AFF4 adds an active/ended/voided
tense and per-hospital employment data. `home_organization_id` is now a legacy anchor: roster queries
are moving to affiliations, while several RLS legs and the tenant trigger intentionally still depend
on the old column until the named Phase 2 follow-up.

This split is correct. Affiliation must not be folded back into authorization assignments.

### 2.4 Domain and exception authorization

Standing roles are only one positive source:

- `commission_administrativos` plus `commission_administrativo_capabilities` form a delegated
  commission-permission plane.
- `case_access_grants` carries per-case Boolean permissions, expiry, revocation, reason, and source.
- case assignments, referral participation, meeting seating, document placement, and other domain
  relationships create relationship entitlements.
- recusals and respondent status are hard denies.
- sensitivity, lifecycle, and PHI classifications apply ceilings.

The case authorization module is the best model in the codebase. `app._case_caps` evaluates account
state, tenancy, positive sources, hard denies, implications, expiry, and sensitivity once, returning
a bitmask consumed through typed wrappers. It explicitly preserves critical separations: content
read does not imply PHI, PHI does not imply write, and restrictions are evaluated before positive
sources.

The weakness is that this depth is case-specific. Other domains maintain 51 `app.can_*` functions
without a shared permission vocabulary or explanation shape.

### 2.5 Enforcement planes

Authorization is enforced through four cooperating planes:

1. PostgreSQL grants decide whether a role can reach a table/view/function.
2. RLS policies constrain rows on exposed tables.
3. `SECURITY DEFINER` doors replace RLS for protected reads/writes that require a single audited
   decision point.
4. Server-side service-role paths bypass RLS and must revalidate a named actor or call a controlled
   database command.

This is more accurate than saying “RLS is the security boundary.” RLS is a primary boundary, but a
policy-only audit is structurally blind to the privileged-door and service-role planes.

## 3. What should be preserved

- RLS on every exposed table and explicit table/function grants.
- `app.is_active` as the universal outer gate.
- Administrative versus clinical/PHI separation and the platform-admin noun rule.
- The case capability lattice, hard-deny-first ordering, and typed case wrappers.
- Actor-validating grant/revoke doors and exactly-once, PHI-free authorization audit events.
- The session-context RPC as the application's own effective-grant projection.
- The distinction between affiliation, standing authority, domain relationship, resource grant, and
  hard restriction.
- Mutation-tested keystones, same-tenant wrong-scope personas, door census, and static source gates.
- Domain-specific invariants such as physician qualification, one titular technical director, last
  administrator protection, recusal, and clinical lifecycle rules.

## 4. Current limitations and recommendations

### F1 — High: duplicated role knowledge is the dominant change cost

Adding a role currently requires coordinated changes to the role CHECK, scope-shape CHECK,
`platform_role` enum, grant/revoke kernel, role helpers, session partition, route selection, UI
labels, and tests. The comments in `session-grants.ts` record that new roles have crossed the database
without crossing the application landing seam multiple times.

**Recommendation:** introduce migration-managed `authz.roles`, `authz.permissions`, and
`authz.role_permissions`, then migrate one role at a time by direct substitution. Before each
substitution, compare the legacy and catalog-backed decisions exhaustively in pgTAP; do not run two
authoritative evaluators in application or RLS traffic. System permission codes remain code-coupled
and migration-managed; tenant-defined permissions remain forbidden. Existing membership storage and
RLS function names remain unchanged during adoption.

### F2 — High: there is no shared permission seam across authorization planes

Membership role strings, Administrativo capability rows, case grant Boolean columns,
`profiles.is_admin`, and domain relationships answer similar questions with different vocabularies
and provenance.

**Recommendation:** add one action-oriented permission vocabulary and a small decision interface.
Typed domain wrappers should adapt their resource and relationship facts to that interface; they
must not be replaced by a generic dynamic-SQL policy engine.

### F3 — High: the legacy home-organization anchor remains authorization-adjacent

AFF4 separates affiliation from authorization, but its accepted ADR explicitly leaves RLS legs and a
tenant trigger on `profiles.home_organization_id` until Phase 2. ADR 0155 does not schedule that
follow-up.

**Recommendation:** add a post-AFF4 step before any multi-organization feature to migrate every
remaining visibility/containment decision off `home_organization_id`, define lifecycle authority for
fully offboarded people, and then demote or remove the column. This is more important to a coherent
person/tenancy model than D5's helper refactor.

### F4 — Medium-high: service-role code remains a second authorization implementation

The repository now routes membership and affiliation writes through actor-validating doors, but the
static raw-DML gate only covers those two table names. Other service-role paths still rely on
TypeScript authorization before an RLS-bypassing operation.

**Recommendation:** maintain a catalog/source manifest of every service-role DML target. Every entry
must name its owner, reason, actor-revalidation function, audit event, and mutation test. Application
service-role code should orchestrate; authorization-bearing mutation should occur in an
actor-validating database command.

### F5 — Medium-high: privileged function reach is too broad

The current catalog contains 842 definer functions; 752 are executable by `authenticated` through
SQL privileges. The 432 in `public` are the most important Data API/RPC surface. The 320 in `app` are
not PostgREST RPCs under the current exposed-schema configuration, but remain executable by an
authenticated database role and increase review cost. `app` also has no explicit default-privilege
entry, so historical PUBLIC EXECUTE residue must be actively controlled.

**Recommendation:** classify each definer as public command door, policy predicate, trigger, or
internal helper; revoke execution from application roles unless the classification requires it; and
set explicit default privileges for every object owner in `public`, `app`, and future `authz`
schemas. Track reachable definer count as a security budget.

### F6 — Medium: role-type session context may be too coarse

Role-type selection is currently deliberate and safe, but it cannot express “act as the coordinator
of Commission A only,” a custom role bundle, or a context spanning an approved scope set. The enum in
the JWT also couples token infrastructure to the closed role vocabulary.

**Recommendation:** obtain a product decision before changing semantics. If exact-scope assumption
is required, mint an opaque, session-bound `authorization_context_id` and validate its live
assignment/scope in PostgreSQL. Do not place an effective permission list in the JWT. If role-type
semantics remain desired, record that explicitly and make the context reference the role catalog
rather than a PostgreSQL enum.

### F7 — Medium: appointment integrity is incomplete

`commission_administrativo_capabilities` correctly references its appointment with a composite FK,
but `commission_administrativos` itself has no FK from `commission_id` to `commissions` and no FK
from `user_id` to `profiles` in the effective catalog.

**Recommendation:** preflight for orphans, repair them deliberately, then add both FKs using a
production-safe validation sequence. This should not wait for the authorization redesign.

### F8 — Medium: RLS performance debt exists before any scope abstraction

The performance advisor reports 113 policies with non-initplan auth-function patterns and 96
multiple-permissive-policy warnings. These do not prove a production latency problem, but they show
that the current baseline is not clean enough to attribute regressions from D5/D6 confidently.

**Recommendation:** measure and repair the hot, high-cardinality authorization paths first. Wrap
row-independent functions in scalar subqueries where semantically valid, consolidate only genuinely
equivalent permissive policies, index authorization FK/filter paths, and preserve query-plan
baselines.

### F9 — Medium: PII extraction needs a precise name and migration contract

D4 calls `cpf`, `date_of_birth`, and `phone` “the PII columns,” while `full_name` and `email` also
identify a person. The actual distinction is that the three fields are the current
**restricted personal-detail columns** withheld by column grants.

**Recommendation:** proceed with the extraction but name the new relation after that narrower
meaning, for example `profile_private_details`. Do not claim that all PII has been isolated. Keep
`profiles.id` as the person/principal key and keep `is_active` on the hot account-state path.

## 5. Audit of ADR 0155

| Decision | Verdict | Recommendation |
| --- | --- | --- |
| D0 — AFF4 first | **Accept** | The catalog figures already changed after AFF4 migrations. Preserve the no-concurrent-redesign gate. |
| D1 — finish/release held work | **Accept** | Operational sequencing, not an authorization-model decision. |
| D2 — harvest AFF4 rulings | **Accept** | Record boundary filtering and footprint INTERSECTION/SUBSET semantics as reusable authorization design rules. |
| D3 — document affiliation ≠ authorization | **Accept with note** | `CONTEXT.md` already says this; add the binding architecture rule and state that affiliations may affect visibility without granting capabilities. |
| Missing post-AFF4 Phase 2 | **Add** | Migrate RLS/containment decisions off `home_organization_id` before multi-org. This omission is the ADR's largest tenancy gap. |
| D4 — extract restricted profile fields | **Accept with amendments** | Use a precise table name, dual-read/write migration, exact ACLs, preserved CPF uniqueness, and controlled read/write doors. Keep `is_active` in `profiles`. |
| D5 — introduce `scope_chain` | **Accept only as a discovery/compatibility step** | Define its interface, prove equivalence, and benchmark it. “Same reads/indexes” does not prove “no performance change”; function/SRF shape affects planning and invocation count. |
| D6 — defer generic scopes | **Accept the deferral; amend the triggers** | A new tenancy level is one forcing function, not the only one. Exact assignment context, permission inheritance, or a second standing non-tenancy scope can also justify it. Require closure/hoisted-reachable-scope designs and real-data plans. |
| Reject role/capability catalogs | **Do not accept as written** | Preserve static proof by making permissions migration-managed and greppable in typed wrappers. Upgrade the gates to validate catalog completeness and wrapper coverage. Do not enable tenant-authored roles yet. |
| Reject wholesale persons/accounts split | **Accept** | A 93-table re-key buys little now. Revisit only for non-login people, service principals, merged identities, or independent account/person lifecycle. |

### Specific corrections to ADR 0155

1. Replace “D4 extracts the PII columns” with “D4 extracts the three restricted personal-detail
   columns.”
2. Replace D5's unconditional “No RLS performance change” with a performance hypothesis and a gate.
3. Add the AFF4 Phase 2 legacy-anchor migration to the sequence.
4. Split “roles/capabilities as data” from “generic scopes.” The former can be introduced through
   test-gated, role-by-role direct substitution without the latter.
5. Add current privileged-function and service-role hardening as preconditions, not late D6 cleanup.
6. Broaden D6's forcing functions beyond a new tenancy level.

## 6. Recommended target modules and interfaces

### 6.1 Private authorization catalog

Create a non-exposed `authz` schema with explicit default privileges:

```text
authz.permissions
  code PK
  resource_kind
  risk_class
  sensitivity_ceiling
  assignable

authz.roles
  code PK
  allowed_scope_kind
  system_managed
  session_selectable

authz.role_permissions
  role_code FK
  permission_code FK
  applies_to_descendants

authz.permission_implications
  implying_permission FK
  implied_permission FK
```

Catalog rows are inserted by migrations. Application roles receive no DML. Permission codes are
stable, action-oriented strings such as `case.content.read`, `case.phi.standard.read`,
`commission.membership.manage`, and `organization.people.manage`. An implication graph must be
acyclic and must preserve the current PHI/write separations.

### 6.2 Compatibility assignment adapter

Do not replace `memberships` initially. Expose an internal read adapter that projects:

- each live `memberships` row as a role assignment;
- `profiles.is_admin` as the current `platform_admin` entitlement; and
- current active-role semantics as a caller-context constraint.

Then add a small interface:

```text
authz.has_direct_permission(principal_id, scope_kind, scope_id, permission_code)
authz.explain_direct_permission(principal_id, scope_kind, scope_id, permission_code)
```

The explanation result contains only source codes, scope ids, assignment/grant ids, and deny codes;
it must never include names, case titles, narratives, answers, or PHI.

Existing public/domain wrappers remain the RLS interface:

```text
app.is_org_admin_of(...)
app.can_read_case(...)
app.can_manage_meeting(...)
app.can_read_referral_phi(...)
```

Their implementations delegate incrementally to the catalog resolver. This preserves locality and
the static names that existing tests and policies depend on.

### 6.3 Domain adapters, not one universal policy interpreter

- Keep case assignments and recusals in case tables.
- Keep affiliations separate and non-authorizing.
- Keep clinical qualification and single-office constraints in explicit domain validators.
- Map Administrativo capabilities to shared permission codes without immediately merging its
  appointment tables into memberships.
- Keep `case_access_grants` until a second compatible resource-grant use case or new grantable case
  permission makes normalization pay for itself.
- Never query an arbitrary table based on a caller-provided resource type.

### 6.4 Future scope registry

When a forcing function exists, add:

```text
authz.scopes(id, kind, tenant_root_id, parent_id, active)
authz.scope_closure(ancestor_id, descendant_id, depth)
```

Each domain owner (organization, hospital, commission, or future scope) should hold a unique FK to
its scope row. Scope creation occurs only through typed, kind-aware commands. Do not use an
unreferenced `(scope_type, scope_id)` pair.

Authorization reads should use either a closure-table lookup or a row-independent
`my_reachable_scopes()` result hoisted once per statement. A recursive CTE or `ltree` ancestry
function invoked once per protected row is not acceptable without contrary production evidence.

The technical-director uniqueness rule should not become a racy generic trigger. Prefer keeping a
domain office relation with `UNIQUE(hospital_id)` and adapting that office to permissions, or use a
stable seeded role key that permits a real partial unique index.

## 7. Implementation sequence

### Phase 0 — finish AFF4 and establish an attributable baseline

1. Complete AFF4's declared gate and merge it before starting schema evolution.
2. Re-measure local and production catalogs: RLS, policies, ACLs, definer functions, role-helper
   callers, service-role DML, FKs, and table cardinalities.
3. Capture `EXPLAIN (ANALYZE, BUFFERS)` baselines for session context, case lists, meeting lists,
   commission dashboards, person rosters, and grant/revoke commands.
4. Approve a current authorization matrix by persona, role, active context, scope, operation,
   resource lifecycle, and sensitivity.

**Gate:** no unexplained local/target differences; existing authorization and mutation gates green.

### Phase 1 — close independent integrity and privilege debt

1. Add the two missing FKs on `commission_administrativos` after orphan preflight.
2. Classify every authenticated-executable definer; revoke unnecessary EXECUTE.
3. Set explicit default privileges for `public`, `app`, and `authz` for every migration owner.
4. Expand the authorization-bearing/service-role DML registry beyond two tables.
5. Triage the 113 initplan warnings and benchmark/fix the hot subset.
6. Record all intentional zero-policy tables as door-only/default-deny, with exact ACL tests.

**Gate:** no unexplained privileged door, no raw authorization DML, no unowned service-role bypass.

### Phase 2 — complete the affiliation/person-tenancy split

1. Implement the accepted AFF4 Phase 2 migration away from `home_organization_id` for remaining RLS
   and containment decisions.
2. Define fully-offboarded-person visibility and lifecycle authority explicitly.
3. Shadow old/new person-visibility decisions and block every unexplained widening.
4. Demote or remove the legacy home-organization anchor only after all callers are inventoried.

**Gate:** affiliations are the only employment/belonging source; they still grant no capabilities.

### Phase 3 — extract restricted personal details

1. Create `profile_private_details(profile_id PK/FK, cpf, date_of_birth, phone, updated_at)` in
   `public` or a non-exposed identity schema. Preserve the CPF validation and uniqueness semantics.
2. Enable RLS immediately, revoke default access, and expose only the exact controlled doors needed
   for self and authorized administrator reads/writes.
3. Backfill idempotently. During rollout, use one controlled dual-write path or compatibility trigger;
   do not allow application writers to choose which copy is authoritative.
4. Update SQL functions and service-role application readers. Compare null counts, CPF uniqueness,
   and per-row hashes in a non-PHI audit output.
5. Stop dual writes, revoke old column privileges, and drop the old columns only after one release
   proves there are no readers.

**Gate:** raw restricted fields never appear in list/aggregate/session paths; access tests cover self,
same-scope admin, wrong hospital, wrong organization, inactive actor, and service-role orchestration.

### Phase 4 — establish the catalog and directly substitute the first role

1. Create the private catalog tables, seed the stable identifiers for every current role, and keep
   every role on the legacy evaluator initially. Seed permission mappings only when their complete
   current behavior has been approved.
2. Select `staff_admin` as the first vertical slice. Keep this canonical database role key unless a
   separate, deliberate rename from the UI label “staff coordinator” is approved.
3. Derive the complete `staff_admin` permission matrix from memberships, RLS policies, helper
   functions, mutation commands, session selection, routes, and UI guards.
4. Build the compatibility assignment adapter over the current `memberships` table and implement the
   permission and explanation functions with exact ACLs and pinned search paths.
5. In pgTAP, evaluate the legacy and catalog-backed implementations against the same exhaustive
   fixtures. The comparison is a pre-cutover test oracle, not a runtime authorization mode.
6. After zero unexplained differences, atomically change the stable `staff_admin` wrapper family to
   use only the new resolver. Inventory and replace or explicitly allowlist every direct
   `has_role(..., 'staff_admin')` call that bypasses those wrappers.
7. Remove or disable the legacy `staff_admin` decision branch after cutover. Never authorize with
   `legacy_allowed OR new_allowed`, and do not permit callers to select their evaluator.

**Gate:** zero unexplained decision differences; the existing authorization suite and new catalog,
ACL, mutation, migration-replay, and performance tests are green; `staff_admin` has exactly one
runtime evaluator; explanation output is PHI-free.

### Phase 5 — repeat direct substitution role by role

1. Leave every unmigrated role entirely on the legacy path. For rollout purposes, roles have only
   three states: `legacy`, `test_validation`, and `authoritative`; `test_validation` does not affect
   runtime decisions.
2. For each selected role, approve its permission matrix, seed its bundle, and run legacy-versus-new
   differential tests against identical fixtures.
3. Change one stable role-helper family at a time to delegate exclusively to the permission resolver,
   preserving function names used by RLS and all caller-versus-third-party active-context semantics.
4. Move common grantability into catalog-backed rules while retaining exceptional domain validators.
   Ensure cookie and service-role writers use one actor-validating mutation kernel and emit one audit
   event.
5. Replace role-name grep gates with catalog completeness, wrapper coverage, direct-call census, ACL,
   and mutation tests; keep permission codes statically greppable at enforcement wrappers.
6. Remove each role's legacy branch only after its callers and tests prove the new path authoritative.
   Retain a forward rollback migration that can restore the stable wrapper to the legacy adapter
   without deleting catalog data.

**Gate for each role:** zero unexplained old/new differences before substitution; no mixed evaluator
or bypass afterward; wrong-scope and hard-deny cases remain denied; full authorization and mutation
suites are green.

### Phase 6 — decide authorization-context granularity

Product and security must choose between:

- role-type context across all matching scopes (current behavior); or
- one exact role assignment/scope; or
- one role definition plus an explicit approved scope set.

If the current behavior is retained, document it as final and move the session selection from the
enum to the role catalog. If it changes, introduce a session-bound opaque context id, validate it
live, migrate the token hook, and prove revocation/suspension/session rotation behavior.

### Phase 7 — introduce generic scopes only when justified

Valid forcing functions include a new tenancy level, a new standing non-tenancy scope, exact
assignment context that cannot be represented safely, or repeated inheritance logic whose measured
cost exceeds the registry migration cost.

Use shadow backfill, closure/hoisted reachability, real-data benchmarks, and compatibility adapters.
Do not rewrite all policies or drop existing scope columns in the same release.

## 8. Required decision and test matrix

Before enforcement cutover, resolve these product/security questions:

1. Can a principal hold multiple roles at one scope, especially a commission?
2. Is active responsibility role-wide or assignment/scope-specific?
3. Which permissions inherit from organization to hospital/commission, and which never do?
4. Which roles are permission bundles versus domain offices with qualification/lifecycle rules?
5. Which high-risk permissions require expiry, reason, second approval, or purpose?
6. Is tenant-defined role composition a real requirement? It should remain off until grant ceilings
   and system-role equivalence are proven.
7. What is the revocation propagation SLA for ordinary, clinical, and PHI access?

For every permission and migrated wrapper, test at least:

- legacy-versus-new equivalence under the same fixtures before substitution;
- legitimate allow;
- same-tenant wrong-scope deny;
- cross-hospital and cross-organization deny;
- inactive/suspended principal;
- expired/revoked assignment;
- wrong or absent active context;
- hard-restriction override;
- lifecycle/sensitivity ceiling;
- service-role path with actor revalidation; and
- mutation proof that neutralizing the intended gate turns the test red.

Also require catalog referential-integrity and completeness tests, a census proving there are no
unapproved direct checks for the role being substituted, and a post-cutover assertion that exactly
one evaluator can decide each migrated wrapper. Once a role is authoritative, its approved permission
matrix—not a permanently retained runtime shadow path—becomes the regression oracle.

## 9. Final recommendation

Adopt ADR 0155 as an amended sequencing decision, not as the complete authorization design.

Proceed immediately after AFF4 with baseline/hardening, the legacy home-organization follow-up, and
the restricted-profile-field extraction. Introduce a private, migration-managed role/permission
catalog while keeping `memberships`, its three concrete scope columns, existing domain tables, and
stable RLS wrappers. Since the platform is not live, validate equivalence in CI and substitute one
role atomically, beginning with `staff_admin`; unmigrated roles remain legacy until their own gated
cutover. This obtains most of the future-role benefit without the complexity of runtime shadowing or
D6's scope-migration cost.

Defer the generic scope registry until a real requirement or measured inheritance problem justifies
it. When that point arrives, use a closure table or a per-statement reachable-scope set, not a
per-row recursive ancestry function. Keep hard domain constraints outside the generic assignment
engine.

The correct future-proofing target is not “everything configurable.” It is a smaller, typed,
explainable authorization interface in front of strong relational storage and domain-specific
invariants.

## References

- [Project architecture](../../ARCHITECTURE.md)
- [Project domain language](../../CONTEXT.md)
- [ADR 0078 — authorization capability model](../decisions/0078-authorization-capability-model.md)
- [ADR 0097 — hospital affiliation and person identity](../decisions/0097-hospital-affiliation-person-identity.md)
- [ADR 0106 — active role assumption](../decisions/0106-act-as-role-assumption.md)
- [ADR 0151 — AFF4](../decisions/0151-aff4-organization-affiliation-staff-data-voided-tense.md)
- [ADR 0154 — roster predicate correction](../decisions/0154-roster-predicate-is-the-query-filter-not-list-org-people.md)
- [ADR 0155 — proposed post-AFF4 sequence](../decisions/0155-post-aff4-tenancy-and-person-model-evolution-sequence.md)
- [Previous database design audit](../design/temp/authorization-database-audit-handoff-2026-08-11.md)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase securing the Data API](https://supabase.com/docs/guides/api/securing-your-api)
- [Supabase database functions](https://supabase.com/docs/guides/database/functions)
- [Supabase 2026 Data API exposure change](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically)
- [PostgreSQL row security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [PostgreSQL function security](https://www.postgresql.org/docs/current/perm-functions.html)
