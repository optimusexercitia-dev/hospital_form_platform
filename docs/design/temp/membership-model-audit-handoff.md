# Membership model external-audit handoff (2026-08-04)

> **⛔ NOT ephemeral resume-state — DO NOT SWEEP.** This is a **durable design/audit
> record** (3 inbound links, incl. ADR 0094), named "handoff" before the convention
> existed. Under the handoff convention
> ([.claude/skills/handoff/SKILL.md](../../../.claude/skills/handoff/SKILL.md)),
> ephemeral resume-state lives in `docs/handoffs/`, may not be cited, and is deleted at
> its branch's Record step — none of which applies to this file. Classified 2026-08-26.

> **Purpose.** Self-contained continuation note for the external review of the
> platform's single `public.memberships` table versus separate platform,
> organization, hospital, and commission membership tables. This handoff records
> verified catalog evidence, the auditor's conclusion, and recommended follow-up
> work. It is **analysis only**: no schema, application, seed, or test changes were
> made as part of the audit.

## TL;DR

**Retain the single tenant `memberships` table. Do not replace it with four tables
now.** The current table is small, strongly constrained, and correctly indexed for
its authorization lookup shapes. Splitting it would trade one authorization kernel
for four RLS/ACL/audit surfaces, duplicate write-door logic, and require unions or
multiple requests for cross-scope session context. There is no measured performance
case for that trade.

The recommended long-term shape is **hybrid**:

1. Keep one authoritative tenant-role-grant table.
2. Add one-to-one scope-specific satellite tables only when a scope acquires real
   additional data or lifecycle rules.
3. Keep non-membership authorization planes (`case_access`, surveyor grants,
   participant roles, delegated capabilities) separate.
4. Add a separate audited platform-role relation only if the vendor develops more
   than one meaningful global operational role.

Before adding more roles or activating membership expiry, address four material
design gaps:

- effective/expired membership parity across PostgreSQL and the session layer;
- one-role-per-principal-per-commission cardinality;
- application service-role DML that bypasses the advertised single write door;
- trigger-only relational integrity that can be expressed as composite FKs.

## Audit boundary and method

The audit was performed read-only against the running local Supabase stack on
2026-08-04:

- PostgreSQL **17.6**;
- live `pg_constraint`, `pg_index`/`pg_indexes`, `pg_policy`/`pg_policies`,
  `pg_class.relacl`, `pg_trigger`, `pg_proc.prosecdef`, routine ACLs, table/index
  statistics, and `pg_stat_statements`;
- live definitions of `app.has_role`, `app.has_role_any`, the surviving
  `app.is_*_of` wrappers, `public.grant_role`, `public.revoke_role`, membership
  guards, and `app.trg_audit_memberships`;
- representative `EXPLAIN` plans for organization-, hospital-, commission-, and
  principal-scoped membership lookups;
- Supabase local performance and security advisors;
- TypeScript query and service-role mutation paths;
- the original external audit, collapse plan, ADR 0075, and the completed MEM QA
  review.

**Important limitation:** the row counts and timings below describe the seeded
local stack, not production volume. The catalog facts are authoritative for the
current local schema; production sizing must be measured separately before any
physical partitioning decision.

Per [AGENTS.md](../../AGENTS.md), migration text was not treated as schema truth.
All schema/RLS/RPC claims below came from the live catalog. The Supabase changelog
was checked on 2026-08-04; no current database change invalidates the conclusions.
The relevant operational change is that public tables increasingly require
explicit Data API grants, reinforcing that each extra public table adds a separate
ACL/RLS exposure decision:
[Supabase changelog](https://supabase.com/changelog).

## Current model — verified catalog snapshot

### Table contract

`public.memberships` has ten columns:

```text
id, principal_id,
organization_id, hospital_id, commission_id,
role, title_id,
granted_by, granted_at, expires_at
```

Seven tenant roles are admitted:

| Scope | Roles | Required scope columns |
| --- | --- | --- |
| Organization | `org_admin`, `nsp_org_admin` | organization only |
| Hospital | `hospital_admin`, `nsp_coordinator`, `pqs_member` | organization + hospital |
| Commission | `staff_admin`, `staff` | commission only |

Three CHECK constraints enforce the role vocabulary, exhaustive role-to-scope
shape, and commission-only `title_id`. The table has FKs to profiles,
organizations, hospitals, commissions, and commission titles.

### Security posture

- RLS is enabled.
- Exactly one policy exists: `memberships_select`, for `authenticated` SELECT.
- `authenticated` holds SELECT only; it has no direct INSERT/UPDATE/DELETE grant.
- `public.grant_role` and `public.revoke_role` are `SECURITY DEFINER`, search-path
  pinned, and executable only by `authenticated` and `service_role` (plus owner).
- Membership changes emit `membership.granted`, `membership.role_changed`, or
  `membership.revoked` via the blanket trigger.
- Thirty-six live functions directly reference `memberships`; 32 of them are
  `SECURITY DEFINER`. This is a reason to preserve a deep, stable authorization
  seam rather than multiply storage surfaces.

### Physical and planner evidence

Seeded local state:

| Metric | Value |
| --- | ---: |
| Membership rows | 32 |
| Distinct principals | 25 |
| Organizations / hospitals / commissions represented | 2 / 3 / 4 |
| Heap / indexes / total | 8 KB / 104 KB / 120 KB |
| Average physical row size | 109.9 bytes |
| Recorded sequential / index scans | 7 / 57,676 |

Seven indexes exist: PK, exact-grant unique, scope indexes for commission/hospital/
organization, principal lookup, and title lookup. With sequential scans disabled to
reveal the intended access path, representative authorization predicates use:

- `memberships_organization_idx` for organization role checks;
- `memberships_hospital_idx` for hospital role checks;
- `memberships_commission_idx` for commission membership checks;
- `memberships_principal_idx` for all grants belonging to a principal.

The current sparse columns are not a meaningful storage concern. PostgreSQL stores
row nullability in a bitmap rather than reserving a full UUID payload for each NULL:
[PostgreSQL page layout](https://www.postgresql.org/docs/17/storage-page-layout.html).

The Supabase security advisor returned no membership-specific finding. Its
membership-specific performance output was informational:

- `memberships_granted_by_fkey` lacks a covering index;
- `memberships_hospital_idx` and `memberships_title_idx` were unused in the local
  observation window.

Do not drop the latter indexes solely from demo statistics; validate production
query frequency first.

## Decision analysis: one table versus four

| Criterion | Single table | Four scope tables |
| --- | --- | --- |
| Point authorization checks | Indexed and direct | Slightly simpler local table, no demonstrated latency win |
| All roles for a principal | One indexed relation | Four reads or `UNION ALL` |
| RLS/ACL surface | One table and policy family | Four table grants and policy sets |
| Mutation audit | One trigger/verb family | Four triggers or a cross-table subsystem |
| Role/predicate drift | Centralized | Higher unless every table delegates to a shared kernel |
| Scope-specific attributes | Nullable columns or satellites | Naturally local columns |
| New role in an existing scope | Update central vocabulary/door/tests | Update that table/door/tests |
| Entirely new scope | Add a scope shape or a separate authorization plane | Add table, ACL, RLS, audit, queries, tests |
| Cross-scope session/reporting | Natural | Requires aggregation |
| Operational complexity | Lower | Higher |

The original July external audit recommended consolidation because three membership
tables had already produced drift across roughly 30 predicates and about 145 policy/
function call sites. The completed design deliberately preserved one predicate
family and one audit stream:

- [original external audit](../reviews/external-db-audit-2026-07.md#61-collapse-the-role-stack-into-one-audited-memberships-table)
- [MEM design plan](../plans/memberships-collapse-s6-1.md)
- [ADR 0075](../decisions/0075-memberships-collapse-write-path-split.md)
- [completed MEM QA review](../reviews/memberships-collapse-review.md)

Four tables would recover some local schema clarity, but would reintroduce the
failure mode the collapse was created to remove. The flexibility concern is better
addressed with satellites and explicit separate authorization planes.

## Findings and recommendations

### M1 — `expires_at` is not an end-to-end authority contract (medium, latent)

**Verified state:**

- `app.has_role` and `app.has_role_any` reject expired rows.
- Every current membership has `expires_at IS NULL`.
- `public.grant_role` has no expiry parameter.
- `app.trg_audit_memberships` ignores an UPDATE unless `role` changes, so an expiry
  change emits no audit event.
- The session bundle reads commission, org-admin, hospital-admin, and NSP-org-admin
  rows without filtering expiry:
  [session.ts](../../src/lib/queries/session.ts#L148).
- No application membership query implements effective-grant filtering.
- Several server actions trust the session bundle and then write with the service
  role, where RLS is not a backstop; one example is
  [members/actions.ts](../../src/lib/members/actions.ts#L66).

**Risk:** there is no active expired-row exploit because all grants are permanent and
no supported door creates an expiry. If a future feature starts populating
`expires_at`, an expired admin may disappear from database predicates yet remain in
TypeScript authorization context. A service-role-backed action could then accept the
stale role.

**Recommendation:** do not activate membership expiry incrementally. Deliver it as
one atomic package:

1. Define a single database authority for an **effective membership**.
2. Make the session context return only effective grants.
3. Add explicit grant-expiry and change-expiry commands.
4. Audit every expiry mutation with before/after non-PHI metadata.
5. Revalidate effective actor authority inside every service-role-backed membership
   mutation.
6. Add positive/negative tests for active, expired, renewed, suspended, and
   deactivated actors at both base-table/RLS and product-called RPC/action layers.

If no expiry feature is planned, remove the reserved column rather than letting it
look supported.

### M2 — commission role cardinality is not enforced (medium)

`memberships_grant_uq` includes `role`, so the database permits one principal to hold
both `staff` and `staff_admin` for the same commission. Current seed data has no such
duplicates, but application behavior is inconsistent:

- some paths delete-then-insert because they assume one commission role;
- other service-role paths can insert the second role;
- session/navigation code represents each row as a membership and can therefore
  duplicate one commission or resolve the weaker row first.

**Recommendation:** enforce one commission membership row per
`(principal_id, commission_id)` with a partial unique index:

```sql
create unique index memberships_one_commission_role_uq
  on public.memberships (principal_id, commission_id)
  where commission_id is not null;
```

Then implement role replacement as one audited transaction. Preserve multiple roles
within organization or hospital scope only where the domain explicitly allows them.
PostgreSQL supports subset uniqueness through partial unique indexes:
[PostgreSQL constraints](https://www.postgresql.org/docs/current/ddl-constraints.html).

### M3 — the advertised single write door has service-role bypasses (medium)

Authenticated clients cannot write `memberships` directly, but several application
actions use `createAdminClient()` and insert/delete the table after TypeScript
authorization. This is documented by ADR 0075 and currently audited, but it means
membership authority is duplicated between PostgreSQL and application code.

The service-role paths are the highest-risk future-change surface: adding a new role,
expiry rule, anti-lockout rule, or scope constraint to the database door does not
automatically update them.

**Recommendation:**

- Prefer calling `grant_role`/`revoke_role` with the authenticated cookie client even
  when a separate service client is needed for GoTrue invitation/provisioning.
- Where a service-only mutation is unavoidable, expose a service-only database
  command that accepts the actor id, revalidates that actor against live database
  authority, applies the mutation, and audits atomically.
- End state: application service-role code performs no raw membership INSERT,
  UPDATE, or DELETE.

### M4 — replace trigger-only cross-scope integrity with composite FKs (low)

Two trigger guards can be strengthened declaratively:

1. `(hospital_id, organization_id)` should reference
   `hospitals(id, organization_id)`. The referenced unique key already exists.
2. `(title_id, commission_id)` should reference
   `commission_member_titles(id, commission_id)` after adding the required unique
   referenced key.

Keep the shape CHECKs; they express a different invariant. Composite FKs make the
cross-entity relationship visible to the catalog, schema tools, and future auditors.

Also evaluate an index on `granted_by`. PostgreSQL does not automatically index the
referencing side of a foreign key, and grantor deletion or grantor-based reporting
otherwise scans the table:
[PostgreSQL foreign-key indexing guidance](https://www.postgresql.org/docs/current/ddl-constraints.html).

### I1 — session membership reads should be one authority snapshot (improvement)

`getSessionContext` currently performs four parallel membership queries, separated
by scope/role. Splitting the storage tables would not reduce this; it would make the
separation permanent.

Prefer one narrowly scoped database RPC that returns the caller's effective tenant
role context in one snapshot. It should:

- filter expiry once;
- enforce `is_active` consistently;
- return commission/org/hospital references needed by routing;
- remain PHI-free;
- have an explicit authenticated-only ACL;
- be tested as the product-called surface, not inferred from base-table RLS.

This is a latency and correctness improvement, not a prerequisite for retaining the
single table.

## Recommended target architecture

```text
profiles
├── is_admin                         # keep while platform_admin is one global role
└── memberships                     # authoritative TENANT role grants
    ├── organization roles
    ├── hospital roles
    ├── commission roles
    └── commission_membership_details?  # add only when scope-specific data grows

Separate authorization planes (do not fold into memberships):
├── case_access                      # per-case involvement + level/expiry/reason
├── case participants/assignments   # domain participation, not tenancy
├── surveyor_grants                  # time-boxed token access
└── delegated capabilities          # finite capabilities layered on membership

Future only, when multiple vendor roles exist:
└── platform_role_grants             # audited global operational roles
```

`platform_admin` is currently stored in `profiles.is_admin` and surfaced through a
JWT claim. It intentionally holds no tenant membership. Do **not** create
`platform_membership` merely for symmetry. If future vendor roles such as support,
billing, security-auditor, or deployment-operator appear, introduce a separate
audited `platform_role_grants` relation and decide live-revocation/session semantics
at the same time. The current JWT-first `app.is_admin()` path can retain a demoted
claim until token refresh; richer global roles must not inherit that behavior by
accident.

## Suggested implementation packages

These are recommendations, not authorized work. Each package involving schema/RLS/
authorization must follow the phase gate and begin by reading
[authz-handoff §7](authz-handoff.md#7--the-lessons).

### Package A — membership invariants

- Add one-role-per-commission partial uniqueness.
- Replace hospital/org and title/commission guards with composite FK coverage.
- Evaluate/add `granted_by` index.
- Add catalog-driven pgTAP for constraints, ACLs, and direct-DML denial.

### Package B — one real mutation door

- Inventory every product-reachable membership mutator.
- Move cookie-authenticated actions to `grant_role`/`revoke_role`.
- Replace remaining raw service-role DML with an actor-validating database door.
- Mutation-test grant/revoke authority and anti-lockout keystones.

### Package C — effective memberships / expiry

- Proceed only if expiry is a committed feature.
- Define effective-membership semantics and the single session-context RPC.
- Add expiry mutation/audit commands.
- Verify database, service-role action, session, navigation, and teardown behavior.

### Package D — scope satellites, only on demand

- Trigger: a second or third scope-exclusive attribute, or a materially different
  lifecycle/retention rule.
- Add a 1:1 scope detail table keyed to `memberships.id`.
- Do not split the core role-grant table unless production evidence shows that a
  scope has become a genuinely independent aggregate.

## Acceptance criteria for any follow-up

1. `authenticated` still has no direct membership DML grant or write policy.
2. PUBLIC/anon cannot execute any membership `SECURITY DEFINER` door.
3. Every product-reachable mutation validates the live actor in PostgreSQL.
4. Every grant, revoke, role replacement, and expiry change emits exactly one
   PHI-free audit event.
5. One principal cannot hold both `staff` and `staff_admin` in one commission.
6. Legitimate multiple hospital/org roles remain possible where explicitly allowed.
7. Expired, suspended, and deactivated actors fail at both database and
   service-role-backed product surfaces.
8. Session context and database predicates agree on the same effective grants.
9. Cross-org and cross-hospital negative twins remain green only when the protection
   is present; mutation-testing must prove the keystones can fail.
10. The full pgTAP, unit, and `npm run e2e:prod` gates pass before QA review.

## Explicit non-goals

- Do not fold `case_access` into `memberships`.
- Do not turn tenant authorization roles into a tenant-extensible catalog; each role
  is code/security-coupled.
- Do not add `case_id` or a generic un-FK'd `scope_id` to `memberships`.
- Do not create four public membership tables for naming symmetry.
- Do not partition at current scale. Revisit physical partitioning only with
  production row-count, latency, and scope-skew evidence. PostgreSQL partitioning
  can preserve a unified logical interface if that threshold is ever reached:
  [PostgreSQL partitioning](https://www.postgresql.org/docs/current/ddl-partitioning.html).
- Do not treat a green policy-only test as proof for a product path implemented by a
  `SECURITY DEFINER` or service-role door.

## Resume checklist for a future lead

1. Confirm human authorization and phase placement before implementation.
2. Re-read the live catalog; do not trust this snapshot after later migrations.
3. Read [ARCHITECTURE.md](../../ARCHITECTURE.md) in full and
   [authz-handoff §7](authz-handoff.md#7--the-lessons).
4. Re-run the membership column/constraint/index/policy/ACL/function census.
5. Re-run the product-mutator inventory, including cookie clients, service-role
   clients, RPCs, triggers, and SQL callers.
6. Record current production-scale evidence before considering any split or
   partition.
7. Build Package A first. Packages B and C may be separate gated units; C must not
   partially activate expiry.
8. Have tester exercise both base-table and product-called surfaces, then send the
   completed package to read-only QA review.

## Auditor's final verdict

The single `memberships` table is an appropriate design and is likely safer than the
four-table alternative for this platform. Its nullable scope columns are not the
meaningful efficiency problem. The real future-flexibility risks are incomplete
expiry semantics, duplicated authority on service-role write paths, unenforced
commission-role cardinality, and scope-specific metadata accumulating in the core
row. Address those directly while preserving one deep tenant-authorization module.
