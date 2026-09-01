-- AE4.1 (Increment 1 of 2) — the `authz` catalog schema and its four tables.
-- Plan: docs/plans/authz-evolution.md § "Phase AE4" (slicing rule PA-F18) · ADR 0155 D7 ·
-- ADR 0162 §2 · rulings and rationale: ADR 0172.
--
-- This migration is INERT. Nothing reads these tables at runtime; the wrappers do not
-- delegate until AE4.6. It lands as its own mergeable increment so that a failure inside
-- the cutover is attributable to the cutover.
--
-- ============================================================================
-- ⛔ WHY THERE IS NO `alter default privileges` STATEMENT IN THIS FILE.
--
-- Two separate reasons, both MEASURED in rolled-back transactions on 2026-09-01 rather
-- than reasoned from doctrine. This block exists because the obvious "harden the new
-- schema" statements are, here, no-ops that would read in review as controls.
--
--   FUNCTIONS — already covered, globally. AE1.2
--   (20261003005300_adp_global_revoke_public_execute.sql) issued the GLOBAL `FOR ROLE`
--   form: `alter default privileges for role postgres revoke execute on functions from
--   public`, with `defaclnamespace = 0`. Its own header predicted it "will cover `authz`
--   too when AE4 creates it". Re-issuing it `IN SCHEMA authz` is precisely the trap that
--   migration documents: the schema-scoped form cannot remove the built-in global PUBLIC
--   default, so it succeeds and changes nothing. Suite 401 §4 turns AE1.2's PREDICTION
--   into a MEASUREMENT by probing effective privilege on a function created in `authz`.
--
--   TABLES AND SEQUENCES — nothing to revoke. The `public`-schema ADP revokes elsewhere in
--   this tree exist because the baseline GRANTED ALL on tables in `public` to
--   authenticated/service_role; there is no such grant rule for `authz`, and PostgreSQL's
--   built-in default for TABLES grants nothing to anyone (unlike FUNCTIONS, where a NULL
--   `proacl` includes PUBLIC). Measured in a fresh throwaway schema, no grants issued:
--       has_table_privilege('anon','probez.t','SELECT')           = false
--       has_table_privilege('authenticated','probez.t','SELECT')  = false
--       has_table_privilege('service_role','probez.t','SELECT')   = false
--       has_schema_privilege('anon','probez','USAGE')             = false
--       has_schema_privilege('service_role','probez','USAGE')     = false
--       pg_class.relacl                                           = NULL (owner-only)
--   So `... revoke all on tables from anon, authenticated` would change no bit while
--   reading as a boundary. The absence is instead PINNED by effective-privilege
--   assertions in suite 401 §4, which is a control that can actually fail.
--
-- ⛔ AND NO `grant usage on schema authz` TO ANYONE. No migration in this tree has ever
-- granted schema usage (`app` got its USAGE inside the baseline dump). Without USAGE a
-- caller cannot name an object here at all. The AE4.4 resolver is SECURITY DEFINER with a
-- pinned search_path and therefore needs no caller-side USAGE; granting `authenticated`
-- SELECT speculatively now would be a privilege nobody has justified (plan AE4.1:
-- "default: no direct grants").
-- ============================================================================

create schema authz;

comment on schema authz is
  'AE4 authorization catalog (ADR 0155 D7). Not exposed via PostgREST — deliberately '
  'absent from config.toml''s `schemas` and `extra_search_path`. No application role holds '
  'USAGE here; the AE4.4 resolver reaches it as SECURITY DEFINER. AUTHORITY-ELECT until '
  'AE5-complete (ADR 0162 §2): the legacy memberships CHECKs still stand beside it.';

-- ============================================================================
-- Classification vocabularies: DOMAINs over text, deliberately NOT native enums.
--
-- ⭐ THE RULING, and it binds AE5 as much as AE4 (ADR 0172). PostgreSQL has no
-- `ALTER TYPE ... DROP VALUE`. A native enum whose value set is invented BEFORE its
-- subjects exist is therefore effectively permanent — and AE5 substitutes eleven roles,
-- each of which may widen these vocabularies. A domain's constraint is replaceable in a
-- normal forward-only migration:
--     alter domain authz.risk_class drop constraint risk_class_check;
--     alter domain authz.risk_class add  constraint risk_class_check check (...);
-- Measured 2026-09-01: both statements accepted, and a DOMAIN-typed generated column
-- still backs a MATCH FULL composite foreign key. This satisfies the plan-audit's
-- "an enum/domain/check for every state and classification column" requirement via the
-- branch that stays amendable.
-- ============================================================================

create domain authz.scope_kind as text
  constraint scope_kind_check check (
    value in ('organization', 'hospital', 'commission', 'none', 'capability_plane')
  );

comment on domain authz.scope_kind is
  'Which scope a role is assignable at. ⭐ THE LAST TWO VALUES ARE STRUCTURALLY '
  'UNREACHABLE BY ANY memberships ROW, and that is the whole point (ADR 0172). '
  '`memberships.scope_kind` is GENERATED from the three scope columns and can therefore '
  'only ever produce organization | hospital | commission | NULL. So a catalog row '
  'carrying `none` (platform_admin, which has no memberships row at all) or '
  '`capability_plane` (administrativo, which is not a role and never appears in '
  'memberships) can never be matched by the composite FK. It neither breaks the FK nor '
  'vacuously satisfies it — it is simply never a referent. ⛔ This is what keeps '
  'role = ''administrativo'' out of memberships AFTER memberships_role_check retires at '
  'AE5-complete: the safety survives the retirement WITHOUT DEPENDING ON IT.';

create domain authz.role_state as text
  constraint role_state_check check (value in ('legacy', 'test_validation', 'authoritative'));

comment on domain authz.role_state is
  'Which evaluator owns this role — a CATALOG FACT, not a code-reading exercise '
  '(plan AE4.2). `legacy` = the current hand-written evaluator decides; '
  '`test_validation` = the differential oracle runs both; `authoritative` = the catalog '
  'resolver decides alone. Every role is `legacy` at the end of AE4 Increment 1.';

create domain authz.resource_kind as text
  constraint resource_kind_check check (
    value in ('tenancy', 'identity', 'vocabulary', 'audit', 'commission_content', 'phi')
  );

comment on domain authz.resource_kind is
  'The NOUN a permission acts on. Value set derived from ADR 0078 A35''s noun rule — the '
  'four nouns platform_admin MAY administer (tenancy, identity, vocabulary, audit) and '
  'the two it may NEVER touch (commission_content, phi). Chosen so that AE5.7''s '
  '"encode the noun rule as hard restrictions" is a predicate over this column rather '
  'than a hand-list.';

create domain authz.risk_class as text
  constraint risk_class_check check (
    value in ('read', 'write', 'authority', 'irreversible')
  );

comment on domain authz.risk_class is
  '⚠ PROVENANCE, STATED HONESTLY (ADR 0172, PO override 2026-09-01). NO AUTHORITY IN '
  'THIS TREE DEFINES A VALUE SET FOR risk_class — not ADR 0155, not the plan, not the '
  'audit, which introduces the column without defining "types, ordering, null semantics, '
  'or enforcement". THIS SET IS PROPOSED BY THE AUTHOR, not derived. It is presented as a '
  'proposal so that AE4.3 may replace it wholesale via ALTER DOMAIN when the first real '
  'permission rows exist. Each value is nonetheless ANCHORED to a distinction the '
  'platform already enforces, so it is a proposal rather than an invention: '
  '`read` / `write` / `authority` mirror the _case_caps bitmask''s own three-way split '
  '(read_* bits · write_case_content · manage_case_access), and `irreversible` names the '
  'immutability crossings Architecture Rules 5 and 6 already make one-way (published '
  'versions, submitted responses, storage objects). ⛔ RISK IS DELIBERATELY ORTHOGONAL TO '
  'SENSITIVITY: how far a wrong grant reaches, not how sensitive the data is. Axis 7 '
  'sensitivity belongs to `sensitivity_ceiling`, which is DEFERRED (see the permissions '
  'table comment).';

-- ============================================================================
-- The four tables.
-- ============================================================================

create table authz.roles (
  code               text               not null,
  allowed_scope_kind authz.scope_kind   not null,
  system_managed     boolean            not null,
  session_selectable boolean            not null,
  state              authz.role_state   not null default 'legacy',
  constraint roles_pkey primary key (code),
  -- ⛔ NOT REDUNDANT WITH THE PRIMARY KEY, despite reading that way. A composite FOREIGN
  -- KEY requires a unique constraint on EXACTLY its referenced column pair; the PK on
  -- (code) alone cannot serve `(role, scope_kind) -> (code, allowed_scope_kind)`. This is
  -- the FK's target (ADR 0162 §2 item 1, plan integrity contract PA-F5). Dropping it as
  -- "cleanup" breaks the binding in 20261003007120.
  constraint roles_code_scope_kind_key unique (code, allowed_scope_kind)
);

comment on table authz.roles is
  'AE4 role catalog. AUTHORITY-ELECT (ADR 0162 §2): an ADDITIONAL role authority beside '
  'memberships_role_check, memberships_scope_shape, public.platform_role, the TypeScript '
  'manifest and the grant/revoke branches — NOT a replacement for them. Those retire only '
  'at AE5-complete. ⛔ The phrase "the catalog is the authority" may not appear in a gate '
  'record before that retirement; the honest claim is "one catalog, bound by FK, with '
  'legacy CHECKs still standing."';

comment on column authz.roles.system_managed is
  'TRUE when assignment does NOT flow through the memberships grant doors. Derived from '
  'the live catalog, not assumed: platform_admin is assigned via profiles.is_admin, and '
  'administrativo via commission_administrativos — neither passes app.grant_role_impl, '
  'which is the ONLY function in the database that inserts into public.memberships.';

comment on column authz.roles.session_selectable is
  'TRUE when public.assume_role accepts this code. Derived from that function''s live '
  'body, not assumed: all ELEVEN platform_role values are accepted (platform_admin via a '
  'profiles.is_admin branch, the other ten via a memberships lookup). `administrativo` is '
  'FALSE because assume_role''s parameter is typed `platform_role` and cannot carry it.';

create table authz.permissions (
  code          text                 not null,
  resource_kind authz.resource_kind  not null,
  risk_class    authz.risk_class     not null,
  constraint permissions_pkey primary key (code)
);

comment on table authz.permissions is
  'AE4 permission catalog. ⛔ ZERO ROWS UNTIL AE4.3 — this increment creates the table, '
  'not its contents. '
  '⚠ THREE SPECCED COLUMNS ARE DELIBERATELY ABSENT: `sensitivity_ceiling`, `assignable` '
  '(here) and `applies_to_descendants` (on role_permissions). The plan permits a column '
  'whose semantics are deferred to the audit §8 residue to be EITHER not created yet OR '
  'CHECK-pinned to its single legal value. Not-created is chosen for all three because '
  'BOTH tables hold zero rows through this increment, so a CHECK pinning a value that no '
  'row holds is ITSELF vacuous — it would add exactly the label the rule exists to '
  'forbid. Per column: `sensitivity_ceiling` has no defined ordering and therefore no '
  'identifiable bottom to pin to; `applies_to_descendants` would assert a proposition '
  'about a scope-ancestry relation that does not exist (deferred to AE7); `assignable` '
  'has no decided subject relation (grant / hold / surface). AE4.3 adds all three in the '
  'same migration that seeds the rows giving them meaning. ADR 0172.';

create table authz.role_permissions (
  role_code       text not null,
  permission_code text not null,
  constraint role_permissions_pkey primary key (role_code, permission_code),
  constraint role_permissions_role_code_fkey
    foreign key (role_code) references authz.roles (code)
    on update restrict on delete restrict,
  constraint role_permissions_permission_code_fkey
    foreign key (permission_code) references authz.permissions (code)
    on update restrict on delete restrict
);

-- Reverse-direction index (plan integrity contract PA-F5). The PRIMARY KEY's index leads
-- on role_code, so the resolver's "which roles grant permission P" lookup has no usable
-- index without this one.
create index role_permissions_permission_code_idx
  on authz.role_permissions (permission_code);

comment on table authz.role_permissions is
  'Role -> permission grants. ⛔ ZERO ROWS in this increment; AE4.3 seeds staff_admin''s.';

create table authz.permission_implications (
  implying text not null,
  implied  text not null,
  constraint permission_implications_pkey primary key (implying, implied),
  constraint permission_implications_no_self_implication check (implying <> implied),
  constraint permission_implications_implying_fkey
    foreign key (implying) references authz.permissions (code)
    on update restrict on delete restrict,
  constraint permission_implications_implied_fkey
    foreign key (implied) references authz.permissions (code)
    on update restrict on delete restrict
);

create index permission_implications_implied_idx
  on authz.permission_implications (implied);

comment on table authz.permission_implications is
  'Permission -> permission implication edges. ⛔ ZERO ROWS in this increment. '
  '⚠ ACYCLICITY IS MIGRATION-GATE LAW, NOT A DATABASE CONSTRAINT (plan AE4.1, explicitly). '
  'This table will accept a cycle at runtime without complaint. The ONLY thing that '
  'refuses one is the recursive check in pgTAP suite 401 §6, which runs at the migration '
  'gate. That is a deliberate, documented gap, recorded here because the next reader will '
  'otherwise assume a trigger exists. `CHECK (implying <> implied)` catches ONLY the '
  '1-cycle; every longer cycle is the suite''s job.';

-- ============================================================================
-- RLS: enabled with ZERO policies on all four tables — deny-all by design.
--
-- Architecture Rule 1 requires RLS on every table. Here there are no policies BY DESIGN:
-- no application role holds USAGE on the schema or any table privilege, so the grants are
-- already the boundary and RLS is the second one. Asserting "RLS enabled AND policy count
-- = 0" in suite 401 is what makes a future well-meaning permissive policy RED rather than
-- silently widening the catalog.
--
-- ⚠ Note for the §6 door sweep: a table with zero policies contributes ZERO gates to a
-- diff-scoped sweep. That is not the sweep failing to find something — there is no gate to
-- neutralize. Stated so the derived-zero is attributable rather than mysterious.
-- ============================================================================

alter table authz.roles                  enable row level security;
alter table authz.permissions            enable row level security;
alter table authz.role_permissions       enable row level security;
alter table authz.permission_implications enable row level security;
