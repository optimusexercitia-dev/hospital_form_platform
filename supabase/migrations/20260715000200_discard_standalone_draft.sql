-- ============================================================================
-- Discard a STANDALONE in-progress draft response (F9 / B1).
--
-- Lets a user permanently discard their OWN in_progress draft response for a
-- STANDALONE form — a response NOT linked to a case (`case_phase_id IS NULL`,
-- the same standalone predicate `app.submitted_form_responses` uses). Submitted
-- responses stay immutable: `guard_submitted_response` (BEFORE DELETE) already
-- blocks deleting a submitted row and is left untouched. Case-bound responses
-- (a draft case phase) are refused here so a phase can't be discarded via the
-- standalone path — the case module owns that lifecycle.
--
-- Two parts, both additive / forward-only:
--   1. RLS DELETE policy `responses_delete_own_draft` — there was NO member
--      DELETE policy, so a regular member could not delete their own draft even
--      through a SECURITY INVOKER RPC. Scoped to `created_by = auth.uid() AND
--      status = 'in_progress'` (org/hospital admins already have FOR ALL via
--      `responses_admin_all`).
--   2. RPC `public.discard_response(uuid)` — SECURITY INVOKER (RLS-enforced):
--      re-checks owner + in_progress + standalone, writes ONE audit row
--      (`response.discarded`, no answer payload — Rule 11), then DELETEs. Answers
--      / selections / group instances / sign-offs cascade (FK ON DELETE CASCADE).
--
-- Errcodes (custom HC class → PostgREST 400 with the JSON body, ADR 0018):
--   HC065 — not an in_progress draft (already submitted / wrong status)
--   HC066 — case-bound (case_phase_id set) → refuse the standalone path
--   no_data_found — row not visible/owned under RLS (the action maps → not found)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. RLS DELETE policy: a member may delete their OWN in_progress draft.
-- ---------------------------------------------------------------------------
create policy "responses_delete_own_draft" on public.responses
  for delete to authenticated
  using (created_by = auth.uid() and status = 'in_progress');

-- ---------------------------------------------------------------------------
-- 2. RPC: discard_response — the single authority for the standalone discard.
-- ---------------------------------------------------------------------------
create or replace function public.discard_response(p_response_id uuid)
returns void
  language plpgsql security invoker
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_created_by uuid;
  v_status text;
  v_case_phase_id uuid;
  v_commission_id uuid;
begin
  -- RLS-scoped read: a non-owner (and any non-admin) sees nothing → no_data_found,
  -- leaking nothing about whether the row exists.
  select created_by, status, case_phase_id, commission_id
    into v_created_by, v_status, v_case_phase_id, v_commission_id
  from public.responses
  where id = p_response_id;

  if not found then
    raise exception 'resposta % não encontrada', p_response_id
      using errcode = 'no_data_found';
  end if;

  -- Only an in_progress draft may be discarded (submitted rows are immutable;
  -- guard_submitted_response backstops the DELETE regardless).
  if v_status <> 'in_progress' then
    raise exception 'apenas rascunhos podem ser descartados'
      using errcode = 'HC065';
  end if;

  -- Standalone only: a case-bound response is the case module's to manage.
  if v_case_phase_id is not null then
    raise exception 'esta resposta pertence a um caso e não pode ser descartada aqui'
      using errcode = 'HC066';
  end if;

  -- Audit BEFORE the delete (the row + its cascade are gone afterward). Rule 11:
  -- record the fact + who, NEVER the answer payload.
  perform app.audit_write(
    'response.discarded', 'response', p_response_id, v_commission_id,
    'Rascunho descartado');

  -- DELETE authorized by responses_delete_own_draft; answers / answer_selected_options
  -- / response_group_instances / response_section_signoffs cascade.
  delete from public.responses where id = p_response_id;
end;
$$;

alter function public.discard_response(uuid) owner to postgres;

revoke all on function public.discard_response(uuid) from public;
grant execute on function public.discard_response(uuid) to authenticated, service_role;

comment on function public.discard_response(uuid) is
  'Permanently discard the caller''s OWN in_progress draft response for a STANDALONE form (case_phase_id IS NULL). SECURITY INVOKER — RLS-enforced (responses_delete_own_draft). Refuses submitted (HC065) + case-bound (HC066) responses; writes a payload-free response.discarded audit row (Rule 11). Answers/selections/sign-offs cascade.';
