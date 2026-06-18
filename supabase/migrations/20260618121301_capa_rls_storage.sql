-- Phase 14d / B2: Patient-Safety / NSP — CAPA RLS + the CAPA-scoped nsp-evidence
-- object policies. ADR 0030/0034. RLS is the security boundary (Rule 1).
--
-- READ = the SOURCE's scope, via app.can_read_capa (event/rca-sourced → can_read_event;
-- meeting/indicator/audit/manual → PQS/admin only — the non-event scopes arrive in
-- Phases 15/18). Child tables resolve their plan id (action/measure/effectiveness via a
-- direct capa_id; task/evidence via capa_action; result via capa_measure) and reuse the
-- same predicate.
--
-- WRITE = PQS/admin (CAPA management is an NSP activity — NOT a participant grant like
-- RCA). capa_plan has NO client INSERT (open_capa_plan mints it, DEFINER). The assignee's
-- narrow status advance is the DEFINER exception (app.advance_capa_action_core, internally
-- gated → HC050) — so a plain-`staff` assignee has NO table-level write but CAN advance.
-- All policies OR app.is_admin() for the live JWT-claim admin path.
--
-- Evidence reuses the immutable nsp-evidence bucket (14c) with a CAPA path shape
-- {capa_id}/{action_id}/{uuid}. seg[1] is a UUID (the capa_id, no literal prefix) so the
-- RCA policy's can_read_event(seg[1]) returns FALSE for a CAPA object (exists-check, no
-- cast error) and the CAPA policy's can_read_capa(seg[1]) returns FALSE for an RCA object
-- — the two policy pairs are mutually exclusive BY CONSTRUCTION and OR-compose safely.

-- ===========================================================================
-- app.is_pqs_writer() — the PQS/admin write predicate (DRY helper for the policies)
-- ===========================================================================
create function app.is_pqs_writer()
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select app.is_pqs_member(auth.uid()) or app.is_admin();
$$;

revoke all on function app.is_pqs_writer() from public;
grant execute on function app.is_pqs_writer() to authenticated, service_role;

-- ===========================================================================
-- capa_plan — member SELECT via can_read_capa; PQS/admin UPDATE/DELETE; no client INSERT
-- ===========================================================================
create policy capa_plan_select on public.capa_plan
  for select to authenticated
  using (app.can_read_capa(id, auth.uid()) or app.is_admin());

create policy capa_plan_update on public.capa_plan
  for update to authenticated
  using (app.is_pqs_writer())
  with check (app.is_pqs_writer());

create policy capa_plan_delete on public.capa_plan
  for delete to authenticated
  using (app.is_pqs_writer());

-- ===========================================================================
-- capa_action — member SELECT; PQS/admin write (the assignee advances via DEFINER)
-- ===========================================================================
create policy capa_action_select on public.capa_action
  for select to authenticated
  using (app.can_read_capa(capa_id, auth.uid()) or app.is_admin());

create policy capa_action_write on public.capa_action
  for all to authenticated
  using (app.is_pqs_writer())
  with check (app.is_pqs_writer());

-- ===========================================================================
-- capa_action_task — member SELECT (via the action's plan); PQS/admin write
-- ===========================================================================
create policy capa_action_task_select on public.capa_action_task
  for select to authenticated
  using (
    app.is_admin()
    or app.can_read_capa((select capa_id from public.capa_action where id = action_id), auth.uid())
  );

create policy capa_action_task_write on public.capa_action_task
  for all to authenticated
  using (app.is_pqs_writer())
  with check (app.is_pqs_writer());

-- ===========================================================================
-- capa_action_evidence — member SELECT (via the action's plan); PQS/admin write
-- ===========================================================================
create policy capa_action_evidence_select on public.capa_action_evidence
  for select to authenticated
  using (
    app.is_admin()
    or app.can_read_capa((select capa_id from public.capa_action where id = action_id), auth.uid())
  );

create policy capa_action_evidence_write on public.capa_action_evidence
  for all to authenticated
  using (app.is_pqs_writer())
  with check (app.is_pqs_writer());

-- ===========================================================================
-- capa_measure — member SELECT; PQS/admin write
-- ===========================================================================
create policy capa_measure_select on public.capa_measure
  for select to authenticated
  using (app.can_read_capa(capa_id, auth.uid()) or app.is_admin());

create policy capa_measure_write on public.capa_measure
  for all to authenticated
  using (app.is_pqs_writer())
  with check (app.is_pqs_writer());

-- ===========================================================================
-- capa_measure_result — member SELECT (via the measure's plan); PQS/admin write
-- ===========================================================================
create policy capa_measure_result_select on public.capa_measure_result
  for select to authenticated
  using (
    app.is_admin()
    or app.can_read_capa((select capa_id from public.capa_measure where id = measure_id), auth.uid())
  );

create policy capa_measure_result_write on public.capa_measure_result
  for all to authenticated
  using (app.is_pqs_writer())
  with check (app.is_pqs_writer());

-- ===========================================================================
-- capa_effectiveness — member SELECT; PQS/admin write
-- ===========================================================================
create policy capa_effectiveness_select on public.capa_effectiveness
  for select to authenticated
  using (app.can_read_capa(capa_id, auth.uid()) or app.is_admin());

create policy capa_effectiveness_write on public.capa_effectiveness
  for all to authenticated
  using (app.is_pqs_writer())
  with check (app.is_pqs_writer());

-- ===========================================================================
-- nsp-evidence — CAPA-scoped object policies (the bucket already exists, 14c)
-- ===========================================================================
-- Path {capa_id}/{action_id}/{uuid}: foldername[1] = capa_id (READ boundary,
-- can_read_capa), foldername[2] = action_id (unused by policy). SELECT = members in the
-- plan's source scope; INSERT = PQS-write (CAPA write is PQS/admin, not a participant
-- grant). These OR-compose with the RCA policies; a CAPA object's seg[1] (a capa_id) is
-- not a readable event for the RCA policy and vice versa, so the pairs never overlap.
create policy capa_evidence_obj_select_member on storage.objects
  for select to authenticated
  using (
    bucket_id = 'nsp-evidence'
    and (
      app.is_admin()
      or app.can_read_capa(((storage.foldername(name))[1])::uuid, auth.uid())
    )
  );

create policy capa_evidence_obj_insert_writable on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'nsp-evidence'
    and app.is_pqs_writer()
  );

-- No UPDATE/DELETE policies — nsp-evidence objects are immutable (Rule 6; established 14c).
