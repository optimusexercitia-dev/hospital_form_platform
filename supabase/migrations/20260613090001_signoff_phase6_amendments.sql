-- Phase 6 / M12: sign-off enforcement flag flip + Phase-5 QA fold-ins.
--
-- This migration is data + a CREATE OR REPLACE of one existing RPC; it adds no
-- new tables or policies. It is forward-only and does NOT edit any applied
-- migration. Three changes:
--
--   (a) Flip the signoff_enforcement feature flag to TRUE (ADR 0004). This turns
--       on submit_response's already-written P0012 check (every VISIBLE
--       requires_signoff section needs a sign-off row). No code change to
--       submit_response — it has consulted app.feature_enabled('signoff_enforcement')
--       since Phase 1, gated OFF until now.
--
--   (b) Phase-5 QA MINOR-2: save_section_answers' "already submitted" status
--       guard and its cross-version item guard BOTH raised check_violation
--       (23514), so src/lib/responses/actions.ts mapped the cross-version case to
--       the misleading "Esta resposta já foi enviada." Give the cross-version
--       family a DISTINCT app-defined SQLSTATE (P0013). The status guard keeps
--       check_violation. (The action-layer map update is task B3 — B1 is SQL-only.)
--
--   (c) Phase-5 QA MINOR-1: save_section_answers must also guard that
--       p_section_id belongs to the response's form_version_id (mirror of the
--       existing item cross-version guard), so a malformed client cannot point
--       last_section_id at a foreign-version section. Same P0013 family.
--
-- See docs/decisions/0004-signoff-feature-flag.md (flag flip recorded there) and
-- docs/decisions/0015-response-fill-rpcs.md (the original cross-version guard).

-- ---------------------------------------------------------------------------
-- (a) Flag flip — ADR 0004
-- ---------------------------------------------------------------------------
update app.feature_flags set enabled = true where key = 'signoff_enforcement';

-- ---------------------------------------------------------------------------
-- (b)+(c) save_section_answers: distinct cross-version SQLSTATE + section guard
-- ---------------------------------------------------------------------------
-- CREATE OR REPLACE keeps the signature and grants. Only the cross-version
-- guards change: a new section-version guard (MINOR-1) and a distinct SQLSTATE
-- P0013 for BOTH cross-version guards (MINOR-2). Everything else is verbatim
-- from migration 20260612100011.
create or replace function public.save_section_answers(
  p_response_id uuid,
  p_section_id uuid,
  p_answers jsonb default '{}'::jsonb,
  p_clear_item_ids uuid[] default null
)
returns public.responses
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_version_id uuid;
  v_status text;
  v_result public.responses;
  v_bad_item uuid;
  v_section_version uuid;
begin
  -- Existence + status guard. RLS already confines this SELECT to rows the
  -- caller may read (their own response, or a submitted one in their commission
  -- if staff_admin) — so a foreign in_progress draft reads as "not found".
  select form_version_id, status into v_version_id, v_status
  from public.responses
  where id = p_response_id;

  if v_version_id is null then
    raise exception 'resposta % não encontrada', p_response_id
      using errcode = 'no_data_found';
  end if;

  if v_status <> 'in_progress' then
    raise exception 'esta resposta já foi enviada e não pode mais ser editada'
      using errcode = 'check_violation';
  end if;

  -- Cross-version section guard (Phase-5 QA MINOR-1): the saved section (which
  -- becomes last_section_id) must belong to this response's version. The FK
  -- guarantees the section EXISTS; this rejects a section from a DIFFERENT
  -- version of the same (or any) form. Distinct SQLSTATE P0013 so the action
  -- layer no longer mislabels it "já enviada".
  select form_version_id into v_section_version
  from public.form_sections
  where id = p_section_id;

  if v_section_version is null or v_section_version <> v_version_id then
    raise exception 'a seção % não pertence a esta versão do formulário', p_section_id
      using errcode = 'P0013';
  end if;

  -- Cross-version item guard: reject any answered item that does not belong to
  -- this response's version. (Display items are rejected separately by the M4
  -- trigger on insert.) Distinct SQLSTATE P0013 (Phase-5 QA MINOR-2).
  if p_answers is not null and p_answers <> '{}'::jsonb then
    select (e.key)::uuid into v_bad_item
    from jsonb_each(p_answers) e
    where not exists (
      select 1 from public.form_items i
      where i.id = (e.key)::uuid
        and i.form_version_id = v_version_id
    )
    limit 1;

    if v_bad_item is not null then
      raise exception 'o item % não pertence a esta versão do formulário', v_bad_item
        using errcode = 'P0013';
    end if;

    -- Upsert one answer row per input item. question_key is taken from the
    -- target item; value is stored as provided (the wizard sends only answered
    -- inputs — clearing is done via p_clear_item_ids, not by sending nulls).
    insert into public.answers (response_id, item_id, question_key, value)
    select p_response_id, i.id, i.question_key, e.value
    from jsonb_each(p_answers) e
    join public.form_items i on i.id = (e.key)::uuid
    on conflict (response_id, item_id)
    do update set value = excluded.value,
                  question_key = excluded.question_key;
  end if;

  -- Orphan-clear (warn-and-clear): delete answers of items the wizard reported
  -- as now-hidden. RLS (answers_write_own_draft) confines this to the caller's
  -- own in_progress response.
  if p_clear_item_ids is not null and array_length(p_clear_item_ids, 1) is not null then
    delete from public.answers
    where response_id = p_response_id
      and item_id = any (p_clear_item_ids);
  end if;

  -- Persist wizard position + touch updated_at (resume lands here).
  update public.responses
  set last_section_id = p_section_id,
      updated_at = now()
  where id = p_response_id
  returning * into v_result;

  return v_result;
end;
$$;

grant execute on function public.save_section_answers(uuid, uuid, jsonb, uuid[])
  to authenticated, service_role;
