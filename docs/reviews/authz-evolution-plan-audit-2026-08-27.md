# Authorization-evolution plan audit — 2026-08-27 (CHANGES REQUESTED)

> Development-team audit of the execution plan, delivered 2026-08-27; imported verbatim
> (title added). Dispositions: PO-ruled the same day → ADR
> [0162](../decisions/0162-authz-evolution-plan-audit-corrections.md); the plan cites these
> findings as `[PA-F#]` to avoid colliding with the original audit's F-numbers.

- **Date:** 2026-08-27
- **Audited artifact:** [`docs/plans/authz-evolution.md`](../plans/authz-evolution.md)
- **Governing decision:** [ADR 0155](../decisions/0155-post-aff4-tenancy-and-person-model-evolution-sequence.md)
- **Evidence inputs:** the plan, ADR 0155 and ADR 0160, the original authorization-model audit,
  committed AE0 catalog-derived findings, live progress state, current application/test source, and
  authoritative PostgreSQL/Supabase documentation


## Executive conclusion

The proposed direction contains one genuinely strong choice: keep stable domain authorization
wrappers and substitute role evaluators one role at a time, rather than introducing a second runtime
authorization engine. That preserves a useful seam and reduces cutover risk.

The execution plan is nevertheless not safe enough to authorize as written. Its most serious
problems are structural rather than editorial:

1. the proposed catalog is not bound to the existing assignment storage, so it does not actually
   retire the duplicated role and scope-shape authorities it was introduced to replace;
2. the restricted-detail migration has both an inadequate data-integrity proof and no coherent
   schema-first deployment sequence;
3. the default-privilege instruction is ambiguous in a way that can make it a no-op on PostgreSQL;
4. the catalog schema omits keys, indexes, and enforceable semantics needed by its resolver;
5. the performance gate cannot detect the most likely resolver regression;
6. the promised “exhaustive” differential is not specified in an executable form;
7. the zero-difference rule can force known legacy authorization defects into the new catalog;
8. the rollback-migration instruction is incompatible with a forward-only migration chain; and
9. AE0 has already invalidated AE1's original sizing, yet the plan has not been re-planned around
   the newly unresolved authorization decisions.

The plan should not proceed into AE3 or AE4 until the blocking findings below are corrected in the
plan and, where they change ratified decisions, in the ADR. Narrow AE1 integrity fixes may continue
only where they do not depend on the unresolved service-role or default-privilege design.

## Severity convention

- **BLOCKING:** capable of defeating a stated invariant, corrupting data, breaking deployment, or
  making the advertised architecture untrue. Must be resolved before the affected phase starts.
- **MAJOR:** material false-assurance, maintainability, coverage, or performance risk. Must be
  resolved before the affected phase closes.
- **MINOR:** incomplete acceptance detail or avoidable operational risk. May be corrected inside the
  owning phase if explicitly tracked.

## Scope and method

This review treated the repository's stated authority order seriously:

1. ADR 0155 controls ratified decisions.
2. `authz-evolution.md` controls execution detail.
3. the earlier audit is analysis input.
4. for schema facts, the committed AE0 catalog-derived artifacts were preferred over migration
   source text.

The repository knowledge graph was not used for SQL conclusions. Current source was inspected for
the TypeScript role seam, service-role call paths, and test contracts. Relevant direct references
include:

- [`src/lib/role/role-catalog.ts`](../../src/lib/role/role-catalog.ts), particularly lines 24–27,
  83, and 162;
- [`src/lib/queries/session-grants.ts`](../../src/lib/queries/session-grants.ts), particularly the
  `getSelectableRoles` implementation beginning near line 238;
- [`src/lib/role-selection/actions.ts`](../../src/lib/role-selection/actions.ts), where the app calls
  `public.assume_role` near line 53;
- [`src/lib/users/actions.ts`](../../src/lib/users/actions.ts), which contains the current
  service-role person-management paths;
- [`scripts/service-role-dml-census.mjs`](../../scripts/service-role-dml-census.mjs), including its
  service-client tracing, RPC, Storage, signed-upload, Auth-admin, and mutation-self-test logic;
- [`supabase/tests/292_session_context.sql`](../../supabase/tests/292_session_context.sql), whose
  role/scope grid explicitly remains hand-maintained;
- [`supabase/tests/304_affiliation_lifecycle.sql`](../../supabase/tests/304_affiliation_lifecycle.sql),
  which positively records that `memberships.role` is text behind a CHECK; and
- [`supabase/config.toml`](../../supabase/config.toml), which currently exposes `public` and
  `graphql_public` and declares PostgreSQL 17.

No schema, application, test, or plan behavior was changed by this audit.

## What the plan gets right

These choices should be preserved while correcting the plan:

- stable, typed domain wrappers remain the enforcement interface;
- catalog rows are migration-managed rather than tenant-authored;
- unmigrated roles retain the existing evaluator;
- legacy-vs-catalog evaluation is a pre-cutover test oracle, not a runtime OR path;
- affiliations remain visibility/lifecycle facts rather than permission assignments;
- person-authority service-role writes move toward actor-validating database commands;
- restricted personal details are named narrowly rather than misrepresented as “all PII”;
- generic scopes remain deferred until there is a forcing function and real performance evidence;
- every cutover is expected to carry catalog completeness, wrapper coverage, ACL, direct-call, and
  mutation checks; and
- platform administration remains constrained by the administrative-versus-clinical noun rule.

Those are sound intentions. The findings below concern whether the proposed implementation can
actually enforce them.

---

## Findings

### F1 — BLOCKING: the catalog does not replace the existing role/scope authorities

**Plan claims**

AE4 creates `authz.roles(code, allowed_scope_kind, ...)` and later moves role selection vocabulary
to the catalog. ADR 0155 states that `allowed_scope_kind` carries the current tier knowledge more
cheaply than the ten-way membership scope CHECK.

**Evidence**

- Plan schema: [`authz-evolution.md:401–415`](../plans/authz-evolution.md).
- ADR claim: [`0155:374–379`](../decisions/0155-post-aff4-tenancy-and-person-model-evolution-sequence.md).
- Catalog-derived current-state record:
  [`authz-persona-matrix-axes-ae0.md:91–110`](../design/authz-persona-matrix-axes-ae0.md).
- TypeScript remains enum-typed:
  [`role-catalog.ts:24–27`](../../src/lib/role/role-catalog.ts).
- The app submits a string to the existing enum-typed database door:
  [`role-selection/actions.ts:53`](../../src/lib/role-selection/actions.ts).
- The session test still builds a manual `role_scope` map and says adding a role must be wired:
  [`292_session_context.sql:245–282`](../../supabase/tests/292_session_context.sql).
- The affiliation test explicitly says `memberships_role_check` is a CHECK over text:
  [`304_affiliation_lifecycle.sql:495–547`](../../supabase/tests/304_affiliation_lifecycle.sql).

**Why this is unacceptable**

`allowed_scope_kind` in another table does not constrain a `memberships` row. PostgreSQL CHECK
constraints cannot query another table. Under the plan, the following remain independent
authorities:

1. `memberships_role_check`;
2. `memberships_scope_shape`;
3. `public.platform_role`;
4. `authz.roles`;
5. the TypeScript role manifest; and
6. grant/revoke branching until each legacy path is retired.

That means adding a role still changes essentially the same surfaces that F1 was meant to collapse.
Worse, the catalog can say a role is hospital-scoped while the storage CHECK admits it only at a
commission. The resolver may fail closed, but the schema no longer has one coherent authority.

**Required correction**

The plan must specify the assignment-to-catalog integrity mechanism. A plausible relational design
is:

1. add a carried `scope_kind` discriminator to assignment storage;
2. add `UNIQUE (code, allowed_scope_kind)` to `authz.roles`;
3. add a composite FK `(role, scope_kind) → authz.roles(code, allowed_scope_kind)`;
4. enforce the actual scope-column shape independently of the role name;
5. replace the enum-typed `assume_role` input with a validated catalog code when the enum retires;
6. define a generated or runtime projection so TypeScript scope declarations cannot drift from the
   database catalog; and
7. provide a migration and rollback contract for the existing membership CHECKs.

If the project deliberately retains the old CHECKs, then the claimed F1 benefit must be reduced to
“one additional catalog,” not “the catalog becomes the authority.”

### F2 — BLOCKING: AE3's backfill proof can pass after value corruption

**Plan claims**

AE3 verifies row-count parity, per-column null counts, and CPF uniqueness before dropping the old
columns.

**Evidence**

- Plan verification: [`authz-evolution.md:345–361`](../plans/authz-evolution.md).
- Governing ADR requires a row-hash comparison:
  [`0155:159–165`](../decisions/0155-post-aff4-tenancy-and-person-model-evolution-sequence.md).

**Why this is unacceptable**

Counts and uniqueness do not prove that each value stayed attached to the same person. The
following corruptions can pass every planned assertion:

- two people's CPF values are swapped;
- phone numbers move between rows while null counts stay equal;
- a date is changed to another non-null date;
- normalized values change but remain unique; or
- a subset of values is permuted among rows.

The plan therefore conflicts with its higher authority and can destroy identity data while
reporting green.

**Required correction**

Inside the migration transaction, assert keyed per-profile equality using `IS NOT DISTINCT FROM`
for all three fields. A keyed hash is acceptable only if it includes `profile_id`, uses a stable
canonical representation, and never emits raw values. Keep the row/null/uniqueness checks as
secondary controls, not the primary proof.

### F3 — BLOCKING: AE3 has no coherent schema-first deployment cutover

**Plan claims**

The global migration rule requires schema first, then code. AE3 performs one migration set that
creates the new table, backfills, re-points SQL consumers, and drops the old columns. Application
consumers are deployed afterward.

**Evidence**

- Global push order: [`authz-evolution.md:52–56`](../plans/authz-evolution.md).
- Column drop and application re-pointing:
  [`authz-evolution.md:345–363`](../plans/authz-evolution.md).
- G2 authorizes a single-shot data migration, not an atomic database/application deployment:
  [`0155:148–167`](../decisions/0155-post-aff4-tenancy-and-person-model-evolution-sequence.md).

**Why this is unacceptable**

Once the database drops `profiles.cpf`, `date_of_birth`, and `phone`, the currently deployed
application still selects or writes those columns until the code deployment completes. That creates
a guaranteed compatibility window in which the old application fails. “Pre-live” reduces audience;
it does not make two deployment systems atomic.

**Required correction**

Choose and document one deployable shape:

- an explicit maintenance-window cutover with the application stopped and a rollback trigger;
- an expand/contract rollout retaining compatibility reads through one application deployment; or
- a temporary compatibility view/function seam that does not introduce two authoritative writers.

G2 forbids an unnecessary dual-write window. It does not forbid read compatibility or authorize an
unplanned outage.

### F4 — BLOCKING: the default-privilege instruction can be a PostgreSQL no-op

**Plan claims**

AE1.2 directs explicit `ALTER DEFAULT PRIVILEGES` “in `public`, `app`, and `authz`” for every
migration owner.

**Evidence**

- Plan instruction: [`authz-evolution.md:116–145`](../plans/authz-evolution.md).
- Project database version: [`supabase/config.toml:42`](../../supabase/config.toml).
- PostgreSQL 17/18 documentation states that schema-specific default privileges are added to global
  defaults, and a schema-scoped REVOKE cannot remove the built-in global `PUBLIC EXECUTE` default:
  [PostgreSQL — ALTER DEFAULT PRIVILEGES](https://www.postgresql.org/docs/current/sql-alterdefaultprivileges.html).
- Supabase's function guide currently shows a schema-scoped form, which makes an effective-ACL test
  necessary rather than optional:
  [Supabase — Database Functions](https://supabase.com/docs/guides/database/functions).

**Why this is unacceptable**

If the implementer translates “in each schema” into:

```sql
alter default privileges in schema authz
revoke execute on functions from public;
```

PostgreSQL documents that the command cannot undo the global default grant unless it is reversing a
matching schema-specific grant. The migration can execute successfully while the next function is
still executable by `PUBLIC`.

**Required correction**

The plan must give the effective property, not merely a command sketch:

```sql
alter default privileges for role <actual_creator_role>
revoke execute on functions from public;
```

For every actual creator role, create a probe function after the default change and positively
assert effective EXECUTE for `PUBLIC`, `anon`, `authenticated`, and intended roles. Inspect
`pg_default_acl` and `has_function_privilege`; do not infer success from command exit status.

### F5 — BLOCKING: the catalog schema permits duplicate facts and underspecifies integrity

**Plan claims**

AE4.1 lists four tables and tests implication acyclicity plus PHI/write separation.

**Evidence**

- Proposed schema: [`authz-evolution.md:401–415`](../plans/authz-evolution.md).
- ADR catalog description:
  [`0155:211–250`](../decisions/0155-post-aff4-tenancy-and-person-model-evolution-sequence.md).

**Why this is unacceptable**

The listed schema gives primary keys only to roles and permissions. It does not state a key for
`role_permissions` or `permission_implications`. It therefore appears to allow:

- duplicate permission rows for one role;
- duplicate implication edges;
- self-implication;
- duplicate explanation provenance;
- multiplicative resolver joins; and
- ambiguous upsert/rollback behavior.

It also introduces `risk_class`, `sensitivity_ceiling`, `assignable`, and
`applies_to_descendants` without defining their types, ordering, null semantics, or enforcement.
Columns that appear only in reports are labels, not controls.

**Required correction**

At minimum specify and test:

- `PRIMARY KEY (role_code, permission_code)`;
- `PRIMARY KEY (implying_permission, implied_permission)`;
- `CHECK (implying_permission <> implied_permission)`;
- reverse-direction indexes needed by resolver queries;
- an enum/domain/check for every state and classification column;
- whether implication acyclicity is enforced in the database or accepted as migration-gate law;
- the operational meaning of `assignable` and who may act on it;
- the ordering and comparison rule for `sensitivity_ceiling`; and
- the exact inheritance semantics of `applies_to_descendants` while generic scopes remain deferred.

### F6 — BLOCKING: the performance gate cannot validate the new resolver

**Plan claims**

Resolver functions will be `STABLE`, wrappers retain their current call shape, and AE0 plans remain
comparable.

**Evidence**

- Resolver performance claim: [`authz-evolution.md:441–450`](../plans/authz-evolution.md).
- AE0 found no planner statistics and warns that costs/estimates are not reliable:
  [`authz-evolution-ae0-findings.md:290–314`](../design/authz-evolution-ae0-findings.md).
- AE0 also records that several DEFINER paths expose only an outer Function Scan/Result unless
  nested statements are captured:
  [`authz-evolution-ae0-findings.md`](../design/authz-evolution-ae0-findings.md), § H.
- Supabase warns that row-dependent security functions cannot be hoisted like caller-constant
  functions and require performance testing:
  [Supabase — RLS performance and best practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv).
- PostgreSQL documents that `STABLE` is a volatility promise, not a per-statement cache:
  [PostgreSQL — CREATE FUNCTION](https://www.postgresql.org/docs/current/sql-createfunction.html).

**Why this is unacceptable**

`STABLE` does not prevent a function whose arguments vary by protected row from running once per
row. Replacing a membership `EXISTS` probe with bundle joins and recursive implication traversal can
multiply the cost under every RLS wrapper while leaving the outer plan superficially unchanged.
AE0's small, unanalyzed seed database has almost no power to expose that failure.

The plan is especially inconsistent here: it rejects per-row recursive scope ancestry in AE7, yet
does not rule out per-row recursive permission implication in AE4.

**Required correction**

Before cutover:

1. define the exact resolver SQL shape;
2. decide whether migration-managed bundles should be flattened or implication closure materialized;
3. add an analyzed, scaled fixture representing realistic membership, permission, and resource
   cardinalities;
4. capture nested plans for the protected query bodies, not only the outer RPC;
5. compare loops, buffers, rows removed, and execution shape; and
6. establish explicit regression thresholds for each hot path.

### F7 — BLOCKING: the “exhaustive” authorization matrix is not executable

**Plan claims**

AE4.5 tests every matrix row × persona × scope × deny class. The approved template contains seven
axes.

**Evidence**

- Differential promise: [`authz-evolution.md:452–461`](../plans/authz-evolution.md).
- Seven-axis matrix definition:
  [`authz-persona-matrix-axes-ae0.md`](../design/authz-persona-matrix-axes-ae0.md).
- The same artifact records 36 seeded personas, 11 roles, role/absent contexts, several scope kinds,
  multiple operation vocabularies, lifecycle transitions, and sensitivity classes.

**Why this is unacceptable**

The raw Cartesian product is enormous and contains both impossible and redundant combinations. The
plan does not define:

- a machine-readable matrix format;
- which combinations are valid;
- equivalence classes;
- pairwise/constrained generation;
- stable cell identifiers;
- how approved values map to tests; or
- a coverage report.

Without those, “exhaustive” becomes a review adjective. A hand-authored pgTAP file can omit a whole
class while still looking comprehensive.

**Required correction**

Create a generated decision-table artifact. It should:

- define constrained equivalence classes per axis;
- reject impossible combinations explicitly;
- assign stable IDs to every required cell;
- generate or validate pgTAP vectors;
- link each permission to current enforcement sites and expected cells;
- report expected/executed/skipped counts; and
- fail when a catalog permission, role, wrapper, or approved cell has no test mapping.

### F8 — BLOCKING: zero-difference cutover can canonize known legacy defects

**Plan claims**

The differential checks `legacy = catalog` per cell, includes recusal-class hard denies, and requires
zero diff before cutover.

**Evidence**

- Differential comparison: [`authz-evolution.md:452–461`](../plans/authz-evolution.md).
- Gate says “zero-diff”: [`authz-evolution.md:503–506`](../plans/authz-evolution.md).
- Live progress contains open authorization findings, including the meeting-case recusal omission:
  [`PROGRESS.md`](../../PROGRESS.md), open follow-up index.

**Why this is unacceptable**

If the approved matrix correctly says “deny” while legacy currently allows, the two stated gates
conflict:

- catalog must equal the approved matrix; and
- catalog must equal legacy.

The easiest way to make both green is to approve the legacy defect into the matrix. That converts a
known bug into the new system's regression oracle.

**Required correction**

Every legacy-versus-intended difference must be classified before matrix approval:

1. fix legacy in an earlier independently gated increment;
2. approve a temporary compatibility exception with an expiry; or
3. block the role cutover.

Change the gate language from an ambiguous mix of “zero unexplained differences” and “zero diff” to
one precise rule. Intentional differences must be first-class, named, and mutation-tested.

### F9 — BLOCKING: the retained “forward rollback migration” cannot exist in the live chain

**Plan claims**

Each role cutover retains a forward rollback migration that re-points wrappers to the legacy adapter.

**Evidence**

- AE4 rollback language: [`authz-evolution.md:463–475`](../plans/authz-evolution.md).
- AE5 repeats it: [`authz-evolution.md:539–548`](../plans/authz-evolution.md).
- Repository convention is forward-only applied migrations; see the migration rules cited by the
  AE1 FK preflight: [`authz-ae1-fk-preflight.md`](../design/authz-ae1-fk-preflight.md), § 5.

**Why this is unacceptable**

A SQL file committed under `supabase/migrations` is part of the ordered migration chain. If the
rollback file is committed after the cutover file, it applies immediately and undoes the cutover. If
it is kept uncommitted, it is not a retained repository artifact. If it is hidden with a future
timestamp, it will eventually apply unexpectedly.

**Required correction**

Retain a reviewed rollback **runbook and SQL template outside the live migration directory**. If
rollback is invoked, create a new migration through the normal migration command, revalidate the
current catalog/signatures, apply it, and record the event. State code/database compatibility in
both deploy and rollback directions.

### F10 — MAJOR: AE0 has already invalidated AE1's original scope

**Plan claims**

AE0.4 begins from a 12-site raw-DML census, while AE1.4 registers table DML, RPC, Storage, and Auth
admin paths.

**Evidence**

- Original plan row: [`authz-evolution.md:77–83`](../plans/authz-evolution.md).
- AE0 property-based result: 45 in-scope sites, not 12:
  [`authz-evolution-ae0-findings.md:93–120`](../design/authz-evolution-ae0-findings.md).
- Eleven of nineteen RPC sites have an undecidable revalidation mechanism in that artifact.
- Live state marks the issue PO-open while AE1 is building:
  [`PROGRESS.md:81–87`](../../PROGRESS.md).
- The census explicitly includes signed upload capability minting, not merely byte writes:
  [`service-role-dml-census.mjs:14`](../../scripts/service-role-dml-census.mjs) and
  [`service-role-dml-census.mjs:72–81`](../../scripts/service-role-dml-census.mjs).

**Why this matters**

AE1.4 is not documentation work. Eleven RPCs require an authorization ruling before the registry can
truthfully name their revalidation mechanism. A registry row that says “undecidable” is useful
evidence but does not close the bypass.

**Required correction**

- resize AE1 against 45 sites;
- split census completeness from authorization disposition;
- make the registry machine-readable and diffable against the census output;
- classify the eleven RPCs before AE1 closes; and
- require a test or explicitly accepted system/self-scoped invariant for every entry.

### F11 — MAJOR: the SECURITY DEFINER review is only classification, not security review

**Plan claims**

Each authenticated-executable DEFINER is classified as command door, policy predicate, trigger body,
or internal helper; EXECUTE is revoked where the class does not need it.

**Evidence**

- AE1.2: [`authz-evolution.md:116–145`](../plans/authz-evolution.md).
- Supabase states that DEFINER functions run as their creator, can bypass RLS, must pin an empty
  search path, and are remotely callable when placed in an exposed schema:
  [Supabase — Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security).
- This project exposes `public`: [`supabase/config.toml:13`](../../supabase/config.toml).

**Why this is insufficient**

“Needs EXECUTE” does not prove a privileged function is safe to execute. The review omits:

- owning role and `BYPASSRLS` effect;
- whether the schema is exposed through PostgREST;
- caller identity binding;
- arbitrary-principal parameters;
- authority-before-existence ordering;
- overload/default-argument reach;
- dynamic SQL and fully qualified object references;
- output minimization and enumeration behavior;
- audit behavior; and
- exact grants to `PUBLIC`, `anon`, `authenticated`, and `service_role`.

The proposed reachable-definer “budget” also has no ceiling, target, or merge gate. Recording a
number is inventory, not a budget.

**Required correction**

Expand the classification artifact into a threat-oriented review table and define a target. Public
command doors should be individually justified. Internal/predicate functions should live in a
non-exposed schema where feasible, with only the minimum schema USAGE/EXECUTE chain required by
their caller.

### F12 — MAJOR: green ARM gates do not cover the advertised authorization surface

**Plan claims**

Every phase runs four ARM gates, and AE4's green re-pointed arms form part of the pilot authorization
milestone.

**Evidence**

- Program-wide gate rule: [`authz-evolution.md:27–44`](../plans/authz-evolution.md).
- AE0 found 407 reachable scalar non-boolean command doors outside every ARM domain:
  [`authz-evolution-ae0-findings.md:188–197`](../design/authz-evolution-ae0-findings.md).
- The live follow-up remains open in [`PROGRESS.md`](../../PROGRESS.md) as
  `FUP-AUTHZ-COMMAND-DOOR-UNSWEPT`.

**Why this matters**

Four green arms cannot be summarized as “authorization is covered” when hundreds of reachable
command doors are structurally outside all four populations. This does not prove those doors are
vulnerable; it proves the gate result has a narrower meaning than the plan's milestone language.

**Required correction**

- every AE gate record must state the uncovered population and scope;
- new command-door classes must enter a structural census;
- the already prioritized tenant-boundary/PHI subset should close before the pilot authz milestone;
  and
- “all arms green” must never be reported without the domain qualifier.

### F13 — MAJOR: AE2 differentials cover reads but the phase changes write containment

**Plan claims**

AE2 compares old and new person visibility per persona/target pair and treats every newly visible pair
as unexplained widening.

**Evidence**

- AE2 migration design and differential:
  [`authz-evolution.md:271–292`](../plans/authz-evolution.md).
- The same phase changes a containment trigger and policy predicates, not only SELECT behavior.

**Why this is insufficient**

The differential does not cover:

- INSERT `WITH CHECK`;
- UPDATE `USING` versus `WITH CHECK` behavior;
- containment-trigger acceptance and rejection;
- affiliation lifecycle transitions;
- concurrent last-affiliation termination versus an admin mutation; or
- time-boxed retention if AE2.0 chooses that option.

The widening rule is also misstated. A person with legitimate affiliations in two organizations may
intentionally become visible to both. The binding principle is “every widening must be enumerated and
approved,” not “every widening is inherently unexplained.”

**Required correction**

Create operation-specific old/new decision vectors for SELECT, INSERT, UPDATE-old-row,
UPDATE-new-row, trigger containment, and lifecycle transitions. Record intended widenings as explicit
matrix cells rather than making them ad hoc exceptions to the gate.

### F14 — MAJOR: retaining `home_organization_id` preserves a stale security-adjacent anchor

**Plan claims**

After proving zero consumers, AE2 stops writing the column but retains it for a release cycle because
generated types and old branches may read it.

**Evidence**

- Demotion decision: [`authz-evolution.md:294–300`](../plans/authz-evolution.md).

**Why this is the wrong tradeoff**

Old branches are not runtime consumers. Generated types can be regenerated. A live, stale tenancy
column is more dangerous than a clean schema break because future code can silently revive it as an
authority source while all current tests remain green.

**Required correction**

Prefer dropping the column in the same gated phase after the zero-consumer census. Preserve rollback
SQL outside the live schema. If retention is mandatory, add a hard source/catalog gate forbidding new
reads and explicitly prove no policy, function, trigger, view, or app query can consume it.

### F15 — MAJOR: the new FK acceptance criteria omit supporting-index proof

**Plan claims**

AE1.1 adds two FKs and tests their presence and orphan rejection.

**Evidence**

- Plan: [`authz-evolution.md:102–114`](../plans/authz-evolution.md).
- Detailed preflight derives cascade behavior but does not make supporting indexes part of the
  migration contract: [`authz-ae1-fk-preflight.md`](../design/authz-ae1-fk-preflight.md).
- PostgreSQL does not automatically create indexes on referencing columns:
  [PostgreSQL — Foreign Keys](https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-FK).

**Why this matters**

The appointment key may cover `commission_id` as its leading column, but a cascade from
`profiles(id)` can require a full scan if `user_id` has no supporting index. The current one-row
fixture cannot reveal the production locking/cost consequence.

**Required correction**

Inspect `pg_index` for prefix-compatible indexes on both referencing paths. Add only the missing
index, then assert it in pgTAP and include parent-delete/cascade plan evidence.

### F16 — MAJOR: named-flake matching can accept a real regression

**Plan claims**

The full E2E gate is compared to a named-flake baseline rather than only a failure count.

**Evidence**

- Gate rule: [`authz-evolution.md:64–67`](../plans/authz-evolution.md).

**Why this is insufficient**

Matching the test name does not match the failure cause. A historically flaky authorization spec can
begin failing deterministically because of the current change and still be accepted because its name
is allowlisted.

**Required correction**

Known flakes should be fixed or quarantined with bounded retries, owner, expiry, and error
fingerprint. An authorization phase must not call a run green when a relevant covered spec failed for
an unverified reason.

### F17 — MAJOR: the explanation-output privacy test is string-negative, not schema-positive

**Plan claims**

`authz.explain_direct_permission` returns codes and IDs only. A test supplies a PHI-bearing fixture and
asserts that known name/title/narrative strings are absent.

**Evidence**

- Explanation design and test:
  [`authz-evolution.md:441–448`](../plans/authz-evolution.md).

**Why this is insufficient**

A denylist of fixture strings cannot prove output minimization. A newly added PHI field, a transformed
value, or an identifier with external linkage can escape without containing any forbidden literal.
Codes and IDs may also be personal data under LGPD even when they are not raw PHI.

**Required correction**

Return a fixed composite type with an allowlisted set of typed fields, not arbitrary JSON. Assert the
exact output keys/types, restrict direct EXECUTE, and decide whether explanation calls themselves
need authorization-access auditing.

### F18 — MINOR: phase slicing contradicts attributable-change goals

AE1 combines unrelated FK additions, hundreds of function privilege decisions, multiple new person
doors, a 45-site service-role registry, policy rewrites, performance triage, and zero-policy
assertions on one phase branch. AE4 similarly combines catalog schema, first-role substitution, gate
tooling, and frontend manifest changes.

One phase-level gate cannot make failures attributable inside a change set that broad. Split each
phase into independently mergeable increments while retaining the same pilot cutline. In particular,
the non-runtime catalog substrate can land and be tested before the `staff_admin` cutover without
creating a second authoritative evaluator.

---

## Cross-cutting architectural assessment

The intended deep module is not yet deep enough. The proposed interface:

```text
authz.has_direct_permission(principal_id, scope_kind, scope_id, permission_code)
authz.explain_direct_permission(principal_id, scope_kind, scope_id, permission_code)
```

is small, but callers and maintainers still need to know too much:

- which legacy role/scope CHECKs remain authoritative;
- whether the role exists in the enum, database catalog, and TypeScript manifest;
- whether active context applies to self checks or third-party checks;
- whether inheritance and implication closure apply;
- whether lifecycle, sensitivity, and hard restrictions are handled inside or outside the resolver;
- which evaluator owns each role;
- which direct `has_role` calls are permitted to bypass wrappers; and
- whether explanation IDs are safe to disclose.

That is a large effective interface. Complexity has moved into conventions spread across the plan,
catalog, wrappers, and gate scripts instead of disappearing behind one enforceable seam.

The deletion test illustrates the issue: deleting `authz.roles.allowed_scope_kind` would currently
leave the membership CHECKs, enum, TypeScript manifest, grant/revoke branches, and session tests still
carrying the same role knowledge. The catalog is therefore not yet earning the leverage claimed for
it.

## Required plan amendments before AE3

1. Restore ADR-mandated per-row equality/hash verification to AE3.
2. Choose an executable database/application cutover shape.
3. Decide whether `home_organization_id` drops or receives a machine-enforced no-reader rule.
4. Expand AE2 differentials to write/transition semantics.
5. Correct the default-privilege mechanism and add effective-ACL positive controls.

## Required plan amendments before AE4

1. Define assignment-to-role-catalog referential integrity.
2. Define enum retirement and the future `assume_role` input contract.
3. Eliminate or gate database-versus-TypeScript scope-manifest duplication.
4. Complete keys, checks, indexes, and types for all catalog tables.
5. Define implication/inheritance semantics and their performance shape.
6. Replace the prose “exhaustive matrix” with a generated coverage contract.
7. Define how known legacy defects are dispositioned before equivalence approval.
8. Replace the impossible retained migration with a rollback runbook/template.
9. Add scaled, analyzed nested-plan evidence.
10. Qualify ARM milestone claims with their actual door population.

## Required amendments before AE1 closes

1. Re-plan the service-role registry around 45 sites and resolve the eleven undecidable RPCs.
2. Convert the registry into a machine-readable artifact checked against the census.
3. Expand DEFINER classification into a security review and give the budget a target.
4. Verify supporting indexes for both new FKs.
5. Prevent named-flake matching from silently accepting new failure causes.
6. Normalize or explicitly rule on the six `TO public` process-template policies reported by AE0.

## Suggested revised gate language

The following language would remove several ambiguities:

> Before a role cutover, every required decision-table cell has a stable ID, approved expected
> result, and executed test result. Every observed legacy/catalog difference is either fixed in a
> preceding gated increment or listed as an approved compatibility exception with owner and expiry.
> After cutover, each migrated role has exactly one evaluator, every assignment is referentially
> valid against the role catalog, and every enforcement wrapper reaches the resolver through a
> catalog-derived, mutation-proven path. Performance acceptance uses nested plans over an analyzed,
> scaled fixture. Gate records state both covered and structurally uncovered door populations.

## Evidence index

### Repository design and live-state evidence

- [Authorization evolution execution plan](../plans/authz-evolution.md)
- [ADR 0155](../decisions/0155-post-aff4-tenancy-and-person-model-evolution-sequence.md)
- [ADR 0160 corrections](../decisions/0160-ae0-corrections-to-adr-0155-measured-figures.md)
- [Original authorization-model audit](../design/authorization-model-evolution-audit-2026-08-26.md)
- [AE0 findings and decision list](../design/authz-evolution-ae0-findings.md)
- [AE0 authorization matrix axes](../design/authz-persona-matrix-axes-ae0.md)
- [AE1 FK preflight](../design/authz-ae1-fk-preflight.md)
- [Live project state](../../PROGRESS.md)

### Application and test evidence

- [TypeScript role catalog](../../src/lib/role/role-catalog.ts)
- [Session-grant projection](../../src/lib/queries/session-grants.ts)
- [Role-selection action](../../src/lib/role-selection/actions.ts)
- [Person administration actions](../../src/lib/users/actions.ts)
- [Service-role DML census](../../scripts/service-role-dml-census.mjs)
- [Session-context role/scope grid](../../supabase/tests/292_session_context.sql)
- [Membership-role CHECK parity test](../../supabase/tests/304_affiliation_lifecycle.sql)
- [Supabase local configuration](../../supabase/config.toml)

### Authoritative external references

- [PostgreSQL — ALTER DEFAULT PRIVILEGES](https://www.postgresql.org/docs/current/sql-alterdefaultprivileges.html)
- [PostgreSQL — CREATE FUNCTION](https://www.postgresql.org/docs/current/sql-createfunction.html)
- [PostgreSQL — Row Security Policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [PostgreSQL — Constraints and Foreign Keys](https://www.postgresql.org/docs/current/ddl-constraints.html)
- [Supabase — Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase — Database Functions](https://supabase.com/docs/guides/database/functions)
- [Supabase — RLS performance and best practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv)
- [Supabase — Securing the Data API](https://supabase.com/docs/guides/api/securing-your-api)
- [Supabase changelog](https://supabase.com/changelog)
- [Supabase — tables not automatically exposed to Data/GraphQL APIs](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically)

## Final disposition

**CHANGES REQUESTED.** Preserve the stable-wrapper and direct-substitution strategy, but do not treat
the current plan as an executable security contract. AE3 and AE4 remain blocked on the findings
above. AE1 may continue only through independently safe increments and must not close until its
post-AE0 scope, default privileges, DEFINER review, FK indexes, and gate-coverage claims are made
truthful.
