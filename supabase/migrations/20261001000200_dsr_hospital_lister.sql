-- =============================================================================
-- DSR Slice 2, addendum — `list_my_dsr_hospitals()`, the console-entry lister.
--
-- WHY A DOOR AND NOT A POLICY ARM. `hospitals_select` (measured 2026-08-20)
-- admits platform_admin, org_admin, hospital_admin, nsp_org_admin and
-- quality_reviewer — and NOBODY else. The Encarregado is typically a plain
-- commission member (that is the whole point of ADR 0130 Decision 2's power
-- split), so they cannot read the name of the hospital they serve, and neither
-- can a PQS executor holding a routed task. Two ways to fix it:
--
--   (a) add `or app.is_dpo_of(id)` to `hospitals_select` — a policy widening on a
--       shared directory table, and a SECOND widening in a program whose ADR
--       names exactly one (Decision 3, the PHI search door);
--   (b) a DEFINER lister returning only the caller's OWN hospitals — which is
--       the pattern this codebase already uses for exactly this need
--       (`list_my_nsp_hospitals`, ADR 0052).
--
-- (b), on both counts. No shared table's read boundary moves.
--
-- ⚠ THIS DOOR INTRODUCES NO AUTHORIZATION OF ITS OWN. Both arms call the SAME
-- predicates the RLS policies call — `app.is_dpo_of_for` and
-- `app.can_execute_dsr_task` — so it can never report a hospital whose rows the
-- caller could not already read. One definition, not a copy: a copy is what goes
-- stale when a policy changes.
-- =============================================================================

create or replace function public.list_my_dsr_hospitals()
returns jsonb
language sql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  with me as (
    -- The outer activity gate, mirroring every sibling lister: an inactive
    -- (deactivated or currently suspended) caller resolves to NO rows here, which
    -- collapses both arms and returns the '[]' safe default.
    select (select auth.uid()) as uid
     where app.feature_enabled('dsr')
       and app.is_active((select auth.uid()))
  ),
  scopes as (
    -- Arm 1: hospitals where the caller holds the Encarregado office.
    select d.hospital_id, true as is_dpo
      from public.hospital_dpos d
      join me on d.user_id = me.uid
     where d.revoked_at is null
       and app.is_dpo_of_for(d.hospital_id, me.uid)
    union all
    -- Arm 2: hospitals where the caller has at least one routed task.
    select distinct t.hospital_id, false
      from public.dsr_tasks t
      cross join me
     where app.can_execute_dsr_task(t.hospital_id, t.commission_id, me.uid)
  ),
  rolled as (
    select hospital_id, bool_or(is_dpo) as is_dpo from scopes group by hospital_id
  )
  select coalesce(jsonb_agg(
           jsonb_build_object(
             'hospitalId', h.id,
             'hospitalName', h.name,
             'orgId', h.organization_id,
             'isDpo', r.is_dpo
           ) order by h.name
         ), '[]'::jsonb)
  from rolled r
  join public.hospitals h on h.id = r.hospital_id;
$$;

revoke all on function public.list_my_dsr_hospitals() from public, anon;
grant execute on function public.list_my_dsr_hospitals() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- `list_my_executable_dsr_tasks(hospital)` — which of the tasks I can SEE can I
-- also ACT on.
--
-- WHY THIS EXISTS. `dsr_tasks_select` admits the Encarregado to every task of
-- their hospital, because they must be able to watch the work. But the
-- Encarregado is a plain member by design (ADR 0130 Decision 2's power split) and
-- holds NO disposal-door arm — so the inbox was offering them "Executar descarte"
-- on a PHI erasure that `dispose_event_phi` would refuse. Caught by the E2E
-- corridor. The GATE was never wrong; the AFFORDANCE was, and a screen that
-- invites the Encarregado to execute contradicts the very split the ADR draws.
--
-- ⚠ IT ADDS NO AUTHORIZATION AND LEAKS NOTHING. It answers "may I act here?" with
-- the SAME predicate the RLS policy and the doors use — one definition, not a
-- copy — over rows the caller can already read, and returns nothing but their ids.
-- The answer is one the caller would learn by clicking anyway.
-- ---------------------------------------------------------------------------
create or replace function public.list_my_executable_dsr_tasks(p_hospital_id uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  select coalesce(jsonb_agg(t.id), '[]'::jsonb)
  from public.dsr_tasks t
  where app.feature_enabled('dsr')
    and t.hospital_id = p_hospital_id
    and app.can_execute_dsr_task(t.hospital_id, t.commission_id, (select auth.uid()));
$$;

revoke all on function public.list_my_executable_dsr_tasks(uuid) from public, anon;
grant execute on function public.list_my_executable_dsr_tasks(uuid) to authenticated, service_role;
