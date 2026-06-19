-- Case Access Control (2 of 3): the THREE access PREDICATES, the viewer-capability
-- read, the RLS SELECT tighten across the case tables, and the additive
-- write-grantee policies on case_documents / case_events. ADR 0033 (D1–D4, D6, D7).
--
-- This is the NOVEL, SECURITY-SENSITIVE core. It mirrors two settled precedents:
--   * app.can_read_event (access-follows-custody; 20260618121001) — uid-pure
--     SECURITY DEFINER predicate driving every SELECT policy of a feature family,
--     pgTAP-testable per user, bypassing RLS internally (no recursion).
--   * app.can_write_interview (participant-write; 20260615091000) — the row-level
--     write-grant shape (staff_admin/admin OR a per-row grant), uid-pure.
--
-- THE PHASE-7 INVARIANT IS UNTOUCHED HERE: this migration changes only WHO MAY
-- READ A CASE ROW AT ALL (cases / case_phases / narratives / child tables). It does
-- NOT touch responses / answers / signoffs policies, and the only cross-member
-- answer surface (case_phase_answer_map / get_case_detail) stays SUBMITTED-ONLY
-- (get_case_detail's answer projection is re-gated but preserved in …110002/BE-4).
--
-- FLAG-OFF PERMISSIVE FALLBACK (ADR 0033 D9): app.can_read_case's FIRST action is
-- `if not app.feature_enabled('case_access') then return app.is_member_of_for(...)`.
-- So while case_access is OFF the tightened SELECT policies evaluate to EXACTLY
-- today's member-read — the boundary does not bite until BE-6 flips the flag. The
-- pgTAP checkpoint proves this equivalence for every persona.

-- ===========================================================================
-- app.can_read_case(case_id, uid) -> boolean   (the read spine — ADR 0033 D1)
-- ===========================================================================
-- READ a case iff (with case_access ON):
--   * staff_admin/admin of the case's commission (coordinator), OR
--   * a case_access row (read|write) for uid, OR
--   * the assignee of ANY phase of the case, OR
--   * the assignee of ANY narrative of the case.
-- Attribution-derived read is COMPUTED here (the phase/narrative EXISTS terms),
-- never materialized — reassigning moves the read automatically (D6).
-- uid-PURE + SECURITY DEFINER: pgTAP asserts it per user, and the inner reads of
-- cases / case_access / case_phases / case_narratives BYPASS RLS, so the SELECT
-- policies that call it cannot recurse (same design as can_read_event).
-- FLAG-OFF FALLBACK: returns is_member_of_for(commission, uid) — byte-for-byte
-- today's member-read — so the boundary is dark until the flag flips (D9).
create function app.can_read_case(p_case_id uuid, p_uid uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_commission uuid;
begin
  select commission_id into v_commission from public.cases where id = p_case_id;
  if v_commission is null then
    return false;  -- unknown case → no access (and avoids is_member_of(NULL))
  end if;

  -- D9 permissive fallback: with the feature OFF, behave EXACTLY as today
  -- (member-read). This is what keeps "flag OFF ⇒ today's behavior" true at every
  -- tightened SELECT policy.
  if not app.feature_enabled('case_access') then
    return app.is_member_of_for(v_commission, p_uid);
  end if;

  return
    app.is_staff_admin_of_for(v_commission, p_uid)
    or app.is_admin_for(p_uid)
    or exists (
      select 1 from public.case_access ca
      where ca.case_id = p_case_id and ca.user_id = p_uid
    )
    or exists (
      select 1 from public.case_phases cp
      where cp.case_id = p_case_id and cp.assigned_to = p_uid
    )
    or exists (
      select 1 from public.case_narratives cn
      where cn.case_id = p_case_id and cn.assigned_to = p_uid
    );
end;
$$;

revoke all on function app.can_read_case(uuid, uuid) from public;
grant execute on function app.can_read_case(uuid, uuid) to authenticated, service_role;

-- ===========================================================================
-- app.can_write_case_content(case_id, uid) -> boolean   (ADR 0033 D4)
-- ===========================================================================
-- CONTENT-WRITE (case-wide "collaborator"): staff_admin/admin of the case's
-- commission OR a case_access row at level 'write'. This is the authority for
-- authoring UN-attributed narratives + managing non-identity-bound content (action
-- items, documents, tags, events). It does NOT grant phase-fill (identity-bound) or
-- lifecycle (coordinator-only). NO flag fallback is needed: this predicate is only
-- consulted by RPCs / additive write policies that ADD write-grantees on top of the
-- unchanged staff_admin policies, so with the flag OFF there are simply no 'write'
-- grant rows and it reduces to staff_admin/admin (today's behavior).
create function app.can_write_case_content(p_case_id uuid, p_uid uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_commission uuid;
begin
  select commission_id into v_commission from public.cases where id = p_case_id;
  if v_commission is null then
    return false;
  end if;

  return
    app.is_staff_admin_of_for(v_commission, p_uid)
    or app.is_admin_for(p_uid)
    or exists (
      select 1 from public.case_access ca
      where ca.case_id = p_case_id and ca.user_id = p_uid and ca.level = 'write'
    );
end;
$$;

revoke all on function app.can_write_case_content(uuid, uuid) from public;
grant execute on function app.can_write_case_content(uuid, uuid) to authenticated, service_role;

-- ===========================================================================
-- app.can_write_case_narrative(narrative_id, uid) -> boolean   (Q14 — ADR 0033 D4)
-- ===========================================================================
-- NARRATIVE-WRITE respects narrative OWNERSHIP:
--   coordinator/admin OR the narrative's assigned_to = uid
--   OR (can_write_case_content(case, uid) AND the narrative is UN-assigned).
-- So an ATTRIBUTED narrative is reserved to its assignee (a write-grantee cannot
-- touch it); an UN-attributed narrative is open to any content write-grantee. This
-- is the predicate save_narrative_body / conclude_narrative re-check (BE-4).
-- uid-pure + DEFINER (resolves the narrative's case + assignee bypassing RLS).
create function app.can_write_case_narrative(p_narrative_id uuid, p_uid uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_case_id     uuid;
  v_commission  uuid;
  v_assigned_to uuid;
begin
  select cn.case_id, c.commission_id, cn.assigned_to
    into v_case_id, v_commission, v_assigned_to
  from public.case_narratives cn
  join public.cases c on c.id = cn.case_id
  where cn.id = p_narrative_id;

  if v_case_id is null then
    return false;
  end if;

  return
    app.is_staff_admin_of_for(v_commission, p_uid)
    or app.is_admin_for(p_uid)
    -- NULL-safe assignee check: an UN-assigned narrative (v_assigned_to IS NULL)
    -- must NOT make this term NULL (which would poison the boolean OR and yield
    -- NULL instead of a clean false). `is not distinct from` would be true for
    -- (null, null) — wrong — so require non-null explicitly.
    or (v_assigned_to is not null and v_assigned_to = p_uid)
    or (v_assigned_to is null
        and app.can_write_case_content(v_case_id, p_uid));
end;
$$;

revoke all on function app.can_write_case_narrative(uuid, uuid) from public;
grant execute on function app.can_write_case_narrative(uuid, uuid) to authenticated, service_role;

-- ===========================================================================
-- public.case_viewer_capabilities(case_id) -> jsonb   (TS-layer read — ADR 0033 D7)
-- ===========================================================================
-- The query layer's "what can the CURRENT user do with this case?" signal,
-- generalizing public.interview_viewer_can_write. Returns
-- { can_read, can_write_content, can_manage_lifecycle } for auth.uid():
--   * can_read            = app.can_read_case
--   * can_write_content   = app.can_write_case_content
--   * can_manage_lifecycle= staff_admin/admin of the case's commission (lifecycle +
--     assignment + grants stay coordinator-only — ADR 0033 D1).
-- Thin DEFINER wrapper (the app-schema predicates are not PostgREST-callable). The
-- same descriptor is also folded directly into get_case_detail in BE-4 so the
-- detail page needs no extra round-trip; this standalone RPC backs capability reads
-- that don't fetch the full detail.
create function public.case_viewer_capabilities(p_case_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
  v_commission uuid;
begin
  select commission_id into v_commission from public.cases where id = p_case_id;
  if v_commission is null then
    return jsonb_build_object(
      'can_read', false, 'can_write_content', false, 'can_manage_lifecycle', false);
  end if;

  return jsonb_build_object(
    'can_read', app.can_read_case(p_case_id, v_uid),
    'can_write_content', app.can_write_case_content(p_case_id, v_uid),
    'can_manage_lifecycle',
      app.is_staff_admin_of_for(v_commission, v_uid) or app.is_admin_for(v_uid)
  );
end;
$$;

grant execute on function public.case_viewer_capabilities(uuid) to authenticated, service_role;
revoke all on function public.case_viewer_capabilities(uuid) from public, anon;

-- ===========================================================================
-- RLS SELECT TIGHTEN — is_member_of -> app.can_read_case (ADR 0033 D2)
-- ===========================================================================
-- Drop each base member-read SELECT policy and recreate it on can_read_case. A
-- member with no attribution and no grant can no longer see the case at all (route
-- + RLS, not UI hiding). Each ORs the live JWT-claim app.is_admin() alongside the
-- uid-pure predicate (which uses app.is_admin_for) so a current-session admin
-- authenticated via the claim is still permitted — mirroring the interviews/event
-- policies.
--
-- IMPORTANT SCOPING NOTE (lead-approved sub-decision 2): the per-commission
-- VOCABULARY tables (case_tags, case_outcomes) are NOT tightened — they have no
-- case_id and a member needs the whole library for the picker. Only the
-- case_id-CARRYING tables tighten: cases, case_phases, case_narratives,
-- case_action_items, case_documents, case_events, case_tag_assignments,
-- case_offered_outcomes. (case_interviews is deferred — ADR 0033 D2 / Consequences.)

-- cases — the root.
drop policy cases_select on public.cases;
create policy cases_select on public.cases
  for select to authenticated
  using (app.can_read_case(id, auth.uid()) or app.is_admin());

-- case_phases — scoped by the parent case.
drop policy case_phases_select on public.case_phases;
create policy case_phases_select on public.case_phases
  for select to authenticated
  using (app.can_read_case(case_id, auth.uid()) or app.is_admin());

-- case_narratives — scoped by the parent case.
drop policy case_narratives_select on public.case_narratives;
create policy case_narratives_select on public.case_narratives
  for select to authenticated
  using (app.can_read_case(case_id, auth.uid()) or app.is_admin());

-- case_action_items — scoped by the parent case.
drop policy case_action_items_select on public.case_action_items;
create policy case_action_items_select on public.case_action_items
  for select to authenticated
  using (app.can_read_case(case_id, auth.uid()) or app.is_admin());

-- case_documents — scoped by the parent case.
drop policy case_documents_select on public.case_documents;
create policy case_documents_select on public.case_documents
  for select to authenticated
  using (app.can_read_case(case_id, auth.uid()) or app.is_admin());

-- case_events — scoped by the parent case.
drop policy case_events_select on public.case_events;
create policy case_events_select on public.case_events
  for select to authenticated
  using (app.can_read_case(case_id, auth.uid()) or app.is_admin());

-- case_tag_assignments — scoped by the parent case (the ASSIGNMENTS carry case_id;
-- the case_tags vocabulary itself stays member-read, untouched).
drop policy case_tag_assignments_select on public.case_tag_assignments;
create policy case_tag_assignments_select on public.case_tag_assignments
  for select to authenticated
  using (app.can_read_case(case_id, auth.uid()) or app.is_admin());

-- case_offered_outcomes — scoped by the parent case (the FROZEN per-case offered
-- set carries case_id; the case_outcomes vocabulary itself stays member-read).
drop policy case_offered_outcomes_select on public.case_offered_outcomes;
create policy case_offered_outcomes_select on public.case_offered_outcomes
  for select to authenticated
  using (app.can_read_case(case_id, auth.uid()) or app.is_admin());

-- ===========================================================================
-- case_access — SELECT policy (coordinator/admin see all grants on their cases;
-- a member sees their OWN grant). NO write policy (DEFINER RPCs only — BE-4).
-- ===========================================================================
create policy case_access_select on public.case_access
  for select to authenticated
  using (
    app.is_staff_admin_of(app.commission_of_case(case_id))
    or app.is_admin()
    or user_id = auth.uid()
  );

-- ===========================================================================
-- ADDITIVE write-grantee policies on case_documents / case_events (ADR 0033 D4;
-- lead-approved sub-decision 3)
-- ===========================================================================
-- These two tables take DIRECT table writes (not RPCs — their actions gate the flag
-- in TS). To let a case-write GRANTEE author them, ADD a second write policy gated
-- on app.can_write_case_content alongside the EXISTING staff_admin policy (RLS ORs
-- multiple permissive policies, so a caller passes if EITHER holds — staff_admin is
-- unchanged). The WITH CHECK gates the NEW row's case_id via can_write_case_content
-- (lead requirement) so a grantee cannot insert/move a row into a case they cannot
-- write. The existing commission-honesty guards (the storage_path uniqueness on
-- case_documents; the case_events kind CHECK) are unaffected — they are table
-- constraints/triggers, orthogonal to RLS. With the flag OFF there are no 'write'
-- grants, so these policies admit exactly the same set as the staff_admin ones
-- (today's behavior).
create policy case_documents_writer_write on public.case_documents
  for all to authenticated
  using (app.can_write_case_content(case_id, auth.uid()))
  with check (app.can_write_case_content(case_id, auth.uid()));

create policy case_events_writer_write on public.case_events
  for all to authenticated
  using (app.can_write_case_content(case_id, auth.uid()))
  with check (app.can_write_case_content(case_id, auth.uid()));
