-- ACT program (ADR 0106) — Stage 0: the role enum (FUP-AFF-4, scoped).
--
-- Introduces public.platform_role, an enum carrying the full platform role vocabulary.
-- Consumers arrive in later stages: app.active_role_selections.role (Stage 3), the
-- active-role JWT claim, and the role picker (via generated types, Stage 3 frontend).
-- Stage 0 creates the type and NOTHING ELSE — no function, policy, or table references
-- it yet (docs/plans/act-as-role-assumption.md §4 "Stage 0").
--
-- SCHEMA PLACEMENT — corrected same day, before this migration was ever pushed
-- (standing no-push rule; origin never had the app-schema version). Originally
-- created as `app.platform_role`; the LEAD found that build-time and moved it to
-- `public` in place (never as a follow-up ALTER TYPE … SET SCHEMA — nothing consumed
-- the type yet, and this project is pre-launch, where a clean migration beats
-- back-compat cruft). Reason: `supabase/config.toml` exposes only
-- `schemas = ["public", "graphql_public"]` to `gen:types`/PostgREST, so an `app`-schema
-- type is invisible to the generated TypeScript union the picker (Stage 3) and the
-- `metadata.acting_as` audit stamp need. Exposing `app` in config.toml was rejected —
-- that would put every `app` DEFINER door on PostgREST, an attack-surface change, not
-- a typing fix. A hand-maintained TS mirror was rejected too — a second, unchecked copy
-- of the value list is exactly the drift FUP-AFF-4 exists to close. A bare enum TYPE in
-- `public` is not a relation: no endpoint, no RLS surface, nothing to authorize —
-- `public.audio_job_status` (20260910000100_audio_minutes_schema.sql) is the existing
-- precedent for exactly this shape. Schema placement was never one of the PO-locked
-- P1–P6 decisions in the plan, so this is a build-time correction, not a plan reversal.
--
-- Derivation (binding, not editorial): the value list is read from the LIVE CATALOG
-- CHECK constraint `memberships_role_check`, verified 2026-08-09 via:
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--     where conname = 'memberships_role_check';
-- which returned exactly:
--   org_admin, nsp_org_admin, hospital_admin, nsp_coordinator, staff_admin, staff,
--   pqs_member, technical_director, technical_director_deputy, quality_reviewer
-- (10 values). CLAUDE.md / ARCHITECTURE.md / the ADR's own prose are NOT the source —
-- per the project's binding "migration file text is stale, the catalog is truth" rule,
-- so is this file itself the moment a future migration touches `memberships_role_check`
-- again: re-derive from pg_constraint at that time, never copy this comment forward.
--
-- 'platform_admin' is added on top of that list, DELIBERATELY. It is not a `memberships`
-- row — it lives in `profiles.is_admin` — so it is invisible to the CHECK constraint.
-- ADR 0106 D11 nonetheless requires it representable as a role value:
--   (a) the implicit break-glass hat (a single-role platform_admin account gets a claim
--       with no picker in the path — D11's break-glass composition),
--   (b) `app.active_role_selections.role` (Stage 3) must be able to store it when an
--       admin explicitly holds the hat during a session,
--   (c) the `metadata.acting_as` audit stamp (D8) must be able to name it.
-- This was QA r1 BLOCKER on the plan review: omitting it here would let Stage 3
-- re-derive the decision silently. It is included exactly once, here, on purpose.
--
-- Deliberately OUT OF SCOPE for this migration (see plan §4 Stage 0):
--   - Converting `memberships.role` (text + CHECK) to this enum. That is a re-key-class
--     change with its own risk profile (see the D11-anglicization lesson: a prior enum
--     rekey rewrote pg_proc but stranded pg_policy — re-sweep pg_policies after ANY
--     future enum change touching a live column). `memberships` is untouched here.
--   - Any function, policy, or table consuming this type. Consumers land in Stage 3.

create type public.platform_role as enum (
  'org_admin',
  'nsp_org_admin',
  'hospital_admin',
  'nsp_coordinator',
  'staff_admin',
  'staff',
  'pqs_member',
  'technical_director',
  'technical_director_deputy',
  'quality_reviewer',
  'platform_admin'
);

comment on type public.platform_role is
  'ACT program (ADR 0106) Stage 0. Full platform role vocabulary: the 10 '
  'memberships_role_check values (re-derive from pg_constraint, never from this '
  'comment) plus platform_admin (profiles.is_admin, added deliberately per D11 — '
  'break-glass hat, active_role_selections.role, metadata.acting_as audit stamp). '
  'Lives in public (not app) so gen:types/PostgREST can see it without exposing the '
  'app schema — see the header note above. Not yet consumed by any function/policy/'
  'table as of Stage 0.';
