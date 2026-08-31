-- BUG-MEUSDADOS-HOSPITAL-NAME-001 — a non-admin's own /conta/meus-dados cannot
-- name the hospital in "Vínculos hospitalares"; every row reads
-- "Hospital não identificado". PO-ruled 2026-08-31: FIX, remedy A (the RLS arm).
--
-- ── WHY ──────────────────────────────────────────────────────────────────────
-- `listAffiliationsFor` (src/lib/queries/affiliations.ts) feeds
-- `getOwnPersonRecord` and embeds
--   hospital:hospitals!hospital_affiliations_hospital_id_fkey(name)
-- That embed is RLS-gated by `hospitals_select`, which carried five arms and no
-- self-affiliate arm (measured live, not read off a migration):
--   app.is_admin() OR app.is_org_admin_of(organization_id)
--   OR app.is_hospital_admin_of(id) OR app.is_nsp_org_admin_of(organization_id)
--   OR app.is_quality_reviewer_of(id)
-- So for a plain affiliate reading their OWN record the embed silently nulls and
-- the page falls through to its placeholder. Over-restrictive, not a leak: an
-- admin viewing SOMEONE ELSE's profile was never affected.
--
-- ── RULE 12/13 POSTURE, STATED BECAUSE THE SHAPE INVITES THE WRONG READING ────
-- CLAUDE.md Rule 13: affiliations NEVER grant capabilities; they are VISIBILITY
-- and lifecycle inputs — an affiliation LOCATES a scope, a `memberships` row
-- GRANTS. This arm is squarely the visibility half, and ADR 0097 (AFF) already
-- established hospital affiliation as a read-visibility input. Nothing here
-- confers a capability: the caller gains the NAME of a hospital they are
-- recorded as working at, on a row they can already SELECT.
--
-- ── WHY NO `app.is_active` GUARD, DELIBERATELY ───────────────────────────────
-- Every sibling arm composes `app.is_active(p_user_id)`. This one does NOT, and
-- the deviation is the point. The row this name belongs to is already visible
-- through `hospital_affiliations_select`, whose FIRST arm is a bare
--   principal_id = (select auth.uid())
-- with no activity filter at all. `app.is_active` returns FALSE for a SUSPENDED
-- user (it reads `suspended_until`), so composing it here would render
-- "Hospital não identificado" for exactly the audience most likely to be
-- checking their own record — re-creating this bug for a subset instead of
-- closing it. The invariant chosen is: THE NAME IS VISIBLE EXACTLY WHEN THE ROW
-- IS. Any future activity gate belongs on both or neither.
--
-- ── SCOPE, STATED HONESTLY ───────────────────────────────────────────────────
-- Ended and voided affiliations are INCLUDED, because `listAffiliationsFor`
-- returns them and `hospital_affiliations_select`'s self arm shows them. An arm
-- narrower than the row's own visibility would name some of the caller's rows
-- and not others — the same defect at a smaller radius.
-- This migration does NOT touch:
--   * `hospitals_write` (ALL) — unchanged;
--   * any other tenancy policy;
--   * `organization_affiliations` — the bug is the hospital-name embed.
--
-- ── MUTATION PROOF ───────────────────────────────────────────────────────────
-- supabase/tests/301_hospital_affiliation_substrate.sql § SELF-NAME reds if this
-- arm is dropped (the affiliate stops seeing their hospital) AND if it is
-- over-widened (the affiliate starts seeing a hospital they hold no affiliation
-- to). Both directions, because a one-directional arm proves only that something
-- was added.
--
-- SQLSTATE: allocates none.

-- The `_for` twin carries the logic; the bare form is what policies call.
-- (Plan rule 3's pair trap: policies call the bare form, functions call `_for` —
-- probe BOTH names unanchored when sweeping.)
create or replace function app.is_affiliated_with_hospital_for(
  p_hospital_id uuid,
  p_user_id uuid
) returns boolean
  language sql
  stable
  security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
  select exists (
    select 1
      from public.hospital_affiliations ha
     where ha.hospital_id = p_hospital_id
       and ha.principal_id = p_user_id
  );
$$;

create or replace function app.is_affiliated_with_hospital(
  p_hospital_id uuid
) returns boolean
  language sql
  stable
  security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
  select app.is_affiliated_with_hospital_for(p_hospital_id, auth.uid());
$$;

-- Explicit ACLs. ⛔ A NULL `proacl` includes PUBLIC — never leave these implicit.
revoke all on function app.is_affiliated_with_hospital_for(uuid, uuid) from public;
revoke all on function app.is_affiliated_with_hospital(uuid) from public;
grant execute on function app.is_affiliated_with_hospital_for(uuid, uuid)
  to authenticated, service_role;
grant execute on function app.is_affiliated_with_hospital(uuid)
  to authenticated, service_role;

-- The sixth arm. The five existing ones are reproduced verbatim from the live
-- catalog, not retyped from memory.
alter policy hospitals_select on public.hospitals
  using (
    app.is_admin()
    or app.is_org_admin_of(organization_id)
    or app.is_hospital_admin_of(id)
    or app.is_nsp_org_admin_of(organization_id)
    or app.is_quality_reviewer_of(id)
    or app.is_affiliated_with_hospital(id)
  );
