-- AE4.2 — seed the role identifiers. Everything `legacy`; ZERO permissions.
-- Plan: docs/plans/authz-evolution.md § AE4.2 · rulings: ADR 0172.
--
-- ============================================================================
-- ⛔ WHY A MIGRATION AND NOT `seed.sql`. Not a close call, for a reason stronger than the
-- usual one. These rows are a FOREIGN KEY REFERENT: 20261003007120 binds
-- public.memberships to them. Rows living only in `seed.sql` are ABSENT IN PRODUCTION
-- while local and E2E are green — the standing lesson — but here the consequence is not a
-- silent behaviour difference, it is that the FK is added against an empty catalog and
-- EVERY production membership row violates it. AE4's purpose line says migration-managed;
-- this is what that means operationally. `seed.sql` gets nothing.
--
-- TWELVE ROWS = the 10 membership-bearing roles + platform_admin + administrativo.
--
-- ⚠ EVERY COLUMN VALUE BELOW IS DERIVED FROM THE LIVE CATALOG, NOT ASSUMED. Sources:
--
--   allowed_scope_kind -- public.memberships' `memberships_scope_shape` CHECK, read from
--     pg_constraint on 2026-09-01, which pins exactly one shape per role:
--       org only          -> org_admin, nsp_org_admin
--       org + hospital    -> hospital_admin, nsp_coordinator, pqs_member,
--                            technical_director, technical_director_deputy,
--                            quality_reviewer
--       commission only   -> staff_admin, staff
--     Confirmed against DATA as well as the constraint: all 43 live memberships rows
--     derive exactly these 10 (role, scope_kind) pairs, and ZERO rows are scopeless.
--
--   session_selectable -- public.assume_role's live body (comment-stripped prosrc). It
--     accepts all ELEVEN platform_role values: platform_admin through a
--     profiles.is_admin branch, the other ten through a memberships lookup.
--     `administrativo` is FALSE because assume_role's parameter is typed `platform_role`,
--     which cannot carry it.
--
--   system_managed -- "assignment does NOT flow through the memberships grant doors."
--     app.grant_role_impl is the ONLY function in the database that inserts into
--     public.memberships (verified against pg_proc, comment-stripped). platform_admin is
--     assigned via profiles.is_admin and administrativo via commission_administrativos,
--     so neither passes it.
--
--   state -- 'legacy' for ALL TWELVE. This increment changes no evaluator.
-- ============================================================================

insert into authz.roles (code, allowed_scope_kind, system_managed, session_selectable, state) values
  -- The 10 membership-bearing roles. `allowed_scope_kind` is DERIVABLE by
  -- memberships.scope_kind, so every one of these is a live FK referent.
  ('org_admin',                 'organization', false, true,  'legacy'),
  ('nsp_org_admin',             'organization', false, true,  'legacy'),
  ('hospital_admin',            'hospital',     false, true,  'legacy'),
  ('nsp_coordinator',           'hospital',     false, true,  'legacy'),
  ('pqs_member',                'hospital',     false, true,  'legacy'),
  ('technical_director',        'hospital',     false, true,  'legacy'),
  ('technical_director_deputy', 'hospital',     false, true,  'legacy'),
  ('quality_reviewer',          'hospital',     false, true,  'legacy'),
  ('staff_admin',               'commission',   false, true,  'legacy'),
  ('staff',                     'commission',   false, true,  'legacy'),

  -- ⭐ THE TWO NON-MEMBERSHIP ROWS. Their allowed_scope_kind values are STRUCTURALLY
  -- UNREACHABLE by memberships.scope_kind, which is GENERATED and can only ever produce
  -- organization | hospital | commission | NULL. So neither row can ever be matched by
  -- the composite FK in 20261003007120 — they are never referents, which is different
  -- from being vacuous referents.
  --
  -- platform_admin: zero-scope is a REAL value, not a gap (AE0.5 Axis 4). It holds no
  -- memberships row at all; profiles.is_admin is its entire assignment mechanism.
  ('platform_admin',            'none',            true,  true,  'legacy'),

  -- administrativo: ⛔ NOT A ROLE and not an Axis-2 value. It is an appointment
  -- (commission_administrativos) plus a capability child table (ADR 0061, amended 0134),
  -- and it requires the appointee to independently hold commission membership. It is
  -- catalogued because AE5.6 maps its capability plane to permission codes, and because
  -- giving it an unreachable scope kind is what keeps role = 'administrativo' out of
  -- memberships AFTER memberships_role_check retires at AE5-complete. Today that CHECK
  -- blocks it; afterwards the FK does, because no derivable scope_kind pairs with
  -- `capability_plane`. session_selectable = false: assume_role cannot carry it.
  ('administrativo',            'capability_plane', true, false, 'legacy');
