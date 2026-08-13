-- W1 / Package A (ADR 0094, decision 2) — cross-scope integrity becomes catalog-visible.
--
-- T1.4 + T1.5. Two BEFORE-row trigger guards enforce integrity that the relational
-- model can state directly:
--
--   app.guard_membership_hospital_org      — memberships.hospital_id must belong to
--                                            memberships.organization_id
--   app.guard_membership_title_commission  — memberships.title_id must belong to
--                                            memberships.commission_id
--
-- A trigger is invisible to the planner, to `\d`, to schema diffing, and to every
-- reviewer who reads pg_constraint. A composite FK says the same thing where readers
-- and tools already look. Both trigger guards are retired IN THIS MIGRATION — the two
-- enforcement paths never coexist (a belt-and-braces pair is two things to keep in
-- sync, and the plan forbids leaving both).
--
-- ── WHY THE FKs REPLACE THE SINGLE-COLUMN ONES INSTEAD OF JOINING THEM ─────────
--
-- ⚠ This is the load-bearing design decision, and the plan does not make it.
-- ADDING (hospital_id, organization_id) -> hospitals alongside the existing
-- (hospital_id) -> hospitals would give `memberships` a SECOND foreign key to
-- `hospitals`, which is exactly the shape that produces PostgREST **PGRST201**
-- ("Could not embed because more than one relationship was found"). This project has
-- already shipped that outage twice, and the un-hinted embeds are live today:
--
--   src/lib/queries/session.ts:189   hospital:hospitals(id, slug, name, organization_id)
--   src/lib/queries/members.ts:66    commission_member_titles(name)
--   src/lib/queries/meetings.ts:731  commission_member_titles(name)
--
-- session.ts is the session bootstrap — an ambiguous embed there fails EVERY page for
-- every hospital-tier principal. `supabase/tests/186_member_titles.sql` (§4a) already
-- pins "exactly one FK backs the members->titles embed" for precisely this reason, so
-- an additive design would also turn that suite red.
--
-- Replacing keeps the count at one FK per target, so no embed becomes ambiguous.
-- The new constraints deliberately REUSE THE OLD NAMES so the one FK-hinted embed in
-- the codebase — `admins:memberships!memberships_hospital_id_fkey(...)`
-- (src/lib/queries/org.ts:198) — keeps resolving without a source change.
--
-- Verified empirically against this stack before writing (PostgREST 12 / PG 17):
-- all three embeds above resolve over the composite FKs, with a hospital_admin row
-- returning a real hospital object and a titled membership a real title object (a
-- null embed would have proved nothing).
--
-- ── WHY THE SHAPE CHECK IS NOW LOAD-BEARING ────────────────────────────────────
--
-- A multi-column FK defaults to MATCH SIMPLE: if ANY referencing column is NULL the
-- constraint is satisfied without a lookup. So (hospital_id = <garbage>,
-- organization_id = NULL) would pass the FK. It is unreachable only because
-- `memberships_scope_shape` requires organization_id NOT NULL for every role that
-- permits a non-null hospital_id. MATCH FULL cannot be used instead: org-tier rows are
-- legitimately (organization_id NOT NULL, hospital_id NULL), a mixed tuple that
-- MATCH FULL rejects outright.
--
-- => `memberships_scope_shape` and `memberships_title_scope` are NOT redundant with
-- these FKs; they are what makes MATCH SIMPLE sound. They stay, and
-- supabase/tests/291 pins the implication so it cannot regress silently.

-- ── The referenced keys ────────────────────────────────────────────────────────
-- hospitals already carries `hospitals_id_org_uq UNIQUE (id, organization_id)`.
-- commission_member_titles does not have the matching key yet.
alter table public.commission_member_titles
  add constraint commission_member_titles_id_commission_uq unique (id, commission_id);

comment on constraint commission_member_titles_id_commission_uq on public.commission_member_titles is
  'ADR 0094 W1/T1.4 — referenced key for memberships_title_id_fkey (title must belong to the membership''s commission). Redundant with the PK for uniqueness; required because a composite FK needs a matching unique constraint.';

-- ── T1.4a — title integrity as an FK ───────────────────────────────────────────
--
-- ⚠ `on delete set null (title_id)` — the COLUMN LIST IS MANDATORY (PG 15+).
-- A bare `on delete set null` on a multi-column FK nulls EVERY referencing column, so
-- deleting a title would also null `commission_id`, which `memberships_scope_shape`
-- then rejects: the delete fails with 23514 and commission titles become undeletable.
-- Verified by execution on this stack — the bare form produced exactly that failure
-- ("new row for relation memberships violates check constraint memberships_scope_shape",
-- with the cascade UPDATE setting both columns), and `186_member_titles.sql` §"ON
-- DELETE SET NULL" is the suite that would have caught it.
--
-- ON UPDATE is left at the default (NO ACTION), matching the constraint being
-- replaced. Re-parenting a title to another commission is not a supported operation;
-- NO ACTION refuses it loudly rather than silently dragging memberships across
-- commissions, which ON UPDATE CASCADE would do.
alter table public.memberships drop constraint memberships_title_id_fkey;
alter table public.memberships
  add constraint memberships_title_id_fkey
  foreign key (title_id, commission_id)
  references public.commission_member_titles (id, commission_id)
  on delete set null (title_id);

comment on constraint memberships_title_id_fkey on public.memberships is
  'ADR 0094 W1/T1.4 — composite: the assigned title must belong to the membership''s own commission. Replaces app.guard_membership_title_commission (retired below). Cross-commission assignment now raises 23503, previously 23514.';

-- ── T1.4b — hospital/org integrity as an FK ────────────────────────────────────
--
-- ON DELETE CASCADE preserved verbatim from the constraint being replaced: deleting a
-- hospital still removes its hospital-tier memberships.
alter table public.memberships drop constraint memberships_hospital_id_fkey;
alter table public.memberships
  add constraint memberships_hospital_id_fkey
  foreign key (hospital_id, organization_id)
  references public.hospitals (id, organization_id)
  on delete cascade;

comment on constraint memberships_hospital_id_fkey on public.memberships is
  'ADR 0094 W1/T1.4 — composite: a hospital-tier membership''s hospital must belong to its organization. Replaces app.guard_membership_hospital_org (retired below). Name reused so the FK-hinted embed in src/lib/queries/org.ts keeps resolving. Cross-org assignment now raises 23503, previously 23514.';

-- ── Retire the trigger guards (same migration — never both paths) ──────────────
--
-- Both functions are trigger-only and referenced by no other trigger and no other
-- function body (catalog-verified: 0 rows in pg_trigger beyond these two, 0 prosrc
-- matches outside their own definitions), so the functions are dropped with their
-- triggers rather than left orphaned in the catalog.
drop trigger if exists guard_membership_title_commission_trg on public.memberships;
drop trigger if exists guard_membership_hospital_org_trg on public.memberships;
drop function if exists app.guard_membership_title_commission();
drop function if exists app.guard_membership_hospital_org();

-- ── T1.5 — index the audit/attribution FK ──────────────────────────────────────
--
-- `granted_by` is the only FK column on memberships with no index. Unindexed FKs make
-- the referenced side's DELETE do a sequential scan per row; here that is
-- `profiles`, whose deletion cascades widely. Partial: granted_by is NULL for
-- seeded/provisioned rows, and those are never the lookup target.
create index memberships_granted_by_idx
  on public.memberships (granted_by)
  where granted_by is not null;

comment on index public.memberships_granted_by_idx is
  'ADR 0094 W1/T1.5 — supports the profiles-side FK check on delete and grant-attribution lookups.';
