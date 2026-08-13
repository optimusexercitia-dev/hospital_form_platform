-- TV — door feedback integrity: never report success for a mutation RLS ate.
--
-- MEASURED on the local stack as `staff1.ccih@test.local`, a plain `staff` of the
-- commission owning the template (persona resolved against `memberships`, not
-- assumed from a variable name):
--
--   clone_template_version   (INSERT arm)  -> 403 / 42501   loud, correct
--   publish_template_version               -> 500 / P0002   loud, correct
--                                             (`select ... for update` needs the
--                                              UPDATE policy, so it fails closed)
--   discard_template_draft                 -> 204 OK        SILENT, row survived
--   archive_process_template               -> 200 OK        SILENT, nothing archived
--
-- The last two are the defect. RLS held in every case — nothing was mutated, so
-- this is NOT a privilege leak — but an RLS-filtered DELETE/UPDATE that matches
-- zero rows raises nothing, so the door cannot distinguish "done" from "denied"
-- and reports the former. For an accreditation product, "processo arquivado"
-- returned while the versions stay published is a governance defect, not a UX
-- wrinkle.
--
-- The TypeScript actions do gate on `authorizeCommission` before calling either
-- RPC, so no user-facing bug shipped. That is deliberately NOT relied on:
-- Architecture Rule 1 makes RLS the boundary and the TS check an error-message
-- affordance, and `publish_process_template` already demonstrates that these
-- doors get reached from paths with no TS pre-check at all. "Unreachable" is not
-- a security property — the argument `20260906000600` refused.
--
-- PROVENANCE. `discard_template_draft` is new in ADR 0096, so that half is this
-- phase's own defect. `archive_process_template` PRE-DATES the phase; ADR 0096
-- re-keyed its body from `process_templates.status` to the version rows but did
-- not introduce the silent-success shape. Fixed together because they are one
-- defect class, recorded apart so the ADR does not claim this phase caused both.
--
-- ⚠ WHY THE ROW-COUNT CHECK IS NOT A BARE ONE. Zero rows changed has THREE
-- causes and collapsing them onto 42501 would replace this lie with a worse one:
--
--   (a) visible to the caller, WRITE policy denied it     -> 42501
--   (b) genuinely absent / already in the target state    -> P0002 / HC023
--   (c) exists but INVISIBLE to the caller (other tenant) -> P0002
--
-- ORDERING is what separates them, and it is already in both bodies: the
-- RLS-FILTERED existence read runs FIRST and raises P0002/HC023 for anyone who
-- cannot see the row — which covers (b) and (c) together, and is also the
-- tenant-isolation arm. Control reaches `get diagnostics` only once the caller
-- has demonstrated it can SEE the row, so a zero count there can only be (a),
-- and telling a reader "you may not write this" discloses nothing it does not
-- already hold.
--
-- Resolving existence through `app.commission_of_template_version` instead was
-- considered and REJECTED. It is SECURITY DEFINER; measured on this stack, it
-- returns a non-null commission for a version the caller cannot select, while
-- the RLS-filtered read returns 0 rows. Disambiguating with it would answer
-- "42501 — exists, denied" to a cross-tenant probe that today correctly answers
-- "não encontrada", turning every one of these doors into an existence oracle.
-- Held by `297` FI1d, which asserts the FOREIGN admin still gets P0002.
--
-- Both functions use CREATE OR REPLACE with UNCHANGED signatures, which PRESERVES
-- their ACLs (ADR 0096 A1.7: it is DROP + CREATE that resets EXECUTE to the
-- default PUBLIC grant). No new grants, no new revokes, no new DEFINER door.

create or replace function public.discard_template_draft(p_template_version_id uuid)
returns void
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_status text;
  v_rows integer;
begin
  perform app.assert_cases_enabled();

  -- RLS-FILTERED, and deliberately FIRST: a caller who cannot SEE the version
  -- gets "not found" and learns nothing about whether it exists (cause c).
  select status into v_status
  from public.process_template_versions
  where id = p_template_version_id;

  if v_status is null then
    raise exception 'versão % não encontrada', p_template_version_id
      using errcode = 'no_data_found';
  end if;

  if v_status <> 'draft' then
    raise exception 'apenas versões em rascunho podem ser descartadas'
      using errcode = 'check_violation';
  end if;

  -- RLS-gated delete; children cascade.
  delete from public.process_template_versions where id = p_template_version_id;

  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    -- The read above proved this row is visible to the caller, so the only way
    -- the delete matched nothing is the staff_admin write policy refusing it.
    raise exception 'sem permissão para descartar esta versão'
      using errcode = 'insufficient_privilege';
  end if;
end;
$$;

create or replace function public.archive_process_template(p_template_id uuid)
returns public.process_templates
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_result public.process_templates;
  v_rows integer;
begin
  perform app.assert_cases_enabled();

  -- Both existence reads below are RLS-filtered, and both run BEFORE the write:
  -- together they cover causes (b) and (c).
  if not exists (select 1 from public.process_templates where id = p_template_id) then
    raise exception 'processo % não encontrado', p_template_id
      using errcode = 'no_data_found';
  end if;

  if not exists (
    select 1 from public.process_template_versions
    where template_id = p_template_id and status <> 'archived'
  ) then
    raise exception 'este processo não pode ser arquivado'
      using errcode = 'HC023';
  end if;

  perform set_config('app.in_template_publish_rpc', 'on', true);

  update public.process_template_versions
  set status = 'archived'
  where template_id = p_template_id
    and status <> 'archived';

  get diagnostics v_rows = row_count;

  perform set_config('app.in_template_publish_rpc', 'off', true);

  if v_rows = 0 then
    -- The HC023 check above proved at least one non-archived version is VISIBLE
    -- to this caller, so matching zero rows here is the write policy refusing.
    -- Raising aborts the statement, so the GUC and the (empty) update roll back.
    raise exception 'sem permissão para arquivar este processo'
      using errcode = 'insufficient_privilege';
  end if;

  update public.process_templates set updated_at = now() where id = p_template_id;

  select * into v_result from public.process_templates where id = p_template_id;
  return v_result;
end;
$$;

comment on function public.discard_template_draft(uuid) is
  'Delete an open DRAFT version (ADR 0096 D2). Raises 42501 rather than reporting '
  'success when RLS filters the delete to zero rows; P0002 when the version is '
  'not visible or absent (which is also the tenant-isolation arm). Held by 297 FI1a-d.';

comment on function public.archive_process_template(uuid) is
  'Archive every non-archived version of a template (ADR 0096 A1.1 item 3). Raises '
  '42501 rather than reporting success when RLS filters the update to zero rows; '
  'HC023 when nothing is left to archive. Held by 297 FI2a-d.';
