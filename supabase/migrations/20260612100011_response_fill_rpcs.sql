-- Phase 5 / M11: Response-fill mutation entry points (wizard save + resume).
--
-- Phase 1 already laid the response lifecycle (M4: responses/answers/sign-offs,
-- the submitted-immutability triggers, the display-item answer-rejection
-- trigger, and responses_one_draft_per_user_idx), the condition evaluator +
-- submit_response RPC (M5), and the response/answer RLS (M6). This migration
-- adds the two missing *mutation entry points* the wizard needs, mirroring the
-- builder RPCs (M10): each is SECURITY INVOKER, so RLS remains the authority
-- (Architecture Rule 1) and no RPC bypasses it.
--
--   * save_section_answers   — atomic per-section save: upsert one answers row
--                              per input item, optionally clear orphaned answers
--                              of a now-hidden section, and bump
--                              responses.last_section_id + updated_at — one
--                              round trip, one transaction.
--   * start_or_resume_response — the wizard entry point: return the caller's
--                              existing in_progress draft for a version, or
--                              create one, tolerating the one-draft unique index
--                              under a double-click race.
--
-- submit_response (M5) is reused VERBATIM and is the only submission authority;
-- the condition evaluator is untouched. See
-- docs/decisions/0015-response-fill-rpcs.md.

-- ---------------------------------------------------------------------------
-- (A) save_section_answers(response_id, section_id, answers, clear_item_ids)
-- ---------------------------------------------------------------------------
-- `p_answers` is a flat jsonb object { "<item_id>": <value>, ... } carrying the
-- answered input items of the section being saved. Each entry is upserted into
-- public.answers keyed on (response_id, item_id); question_key is resolved from
-- the target form_item (denormalized per the schema so dashboards aggregate by
-- key without a join). The display-item answer-rejection trigger (M4) backstops
-- any display item_id that slips through.
--
-- `p_clear_item_ids` is the warn-and-clear path: when a controlling answer hides
-- an already-answered section mid-wizard, the wizard confirms then passes the
-- answered item ids of the now-hidden section(s) here; their answers are deleted
-- in the SAME call (same transaction) so navigation + orphan-clear is atomic.
--
-- Cross-version hardening (ADR 0015, lead note 2): every upserted item_id must
-- belong to the response's own form_version_id. A hostile/malformed client could
-- otherwise scatter answer rows referencing items from a DIFFERENT version of
-- the same form. This is not a security hole (RLS still confines writes to the
-- caller's own response, and submit_response only walks the response's own
-- version, so stray cross-version rows are inert), but rejecting them keeps the
-- data clean and dashboards honest. The check reuses the question_key join.
--
-- SECURITY INVOKER: the upsert/delete run under answers_write_own_draft (creator
-- of an in_progress response) and the responses UPDATE under
-- responses_update_own_draft — foreign users, cross-commission callers, and
-- submitted responses are all rejected by RLS + the submitted-immutability
-- triggers. The explicit existence/status guard below gives a clean pt-BR error
-- before RLS would otherwise surface a confusing "0 rows" outcome.
create function public.save_section_answers(
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

  -- Cross-version guard: reject any item that does not belong to this response's
  -- version. (Display items are rejected separately by the M4 trigger on insert.)
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
        using errcode = 'check_violation';
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

-- ---------------------------------------------------------------------------
-- (B) start_or_resume_response(form_version_id)
-- ---------------------------------------------------------------------------
-- The wizard entry point. Returns the caller's existing in_progress draft for
-- the version (resume) or creates a fresh one, respecting
-- responses_one_draft_per_user_idx (one in_progress per (version, user)).
--
-- Double-click race: two near-simultaneous calls both miss the SELECT, both
-- attempt the INSERT, and the unique index lets exactly one win. The loser
-- catches unique_violation and re-reads the now-existing draft, so the caller
-- always gets a single consistent draft id rather than an error.
--
-- SECURITY INVOKER: the INSERT runs under responses_insert_own (created_by =
-- auth.uid() AND member of the commission), so a non-member / cross-commission
-- caller is rejected by RLS. started_at/updated_at default to now().
create function public.start_or_resume_response(p_form_version_id uuid)
returns public.responses
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_commission_id uuid;
  v_status text;
  v_uid uuid := auth.uid();
  v_result public.responses;
begin
  -- Resolve the version's form/commission and its lifecycle status.
  select f.commission_id, v.status
    into v_commission_id, v_status
  from public.form_versions v
  join public.forms f on f.id = v.form_id
  where v.id = p_form_version_id;

  if v_commission_id is null then
    raise exception 'versão % não encontrada', p_form_version_id
      using errcode = 'no_data_found';
  end if;

  -- Server backstop: only published versions are fillable (the query layer
  -- lists published only, but a hand-crafted call must not start a draft on an
  -- unpublished/archived version).
  if v_status <> 'published' then
    raise exception 'este formulário não está publicado'
      using errcode = 'check_violation';
  end if;

  -- Resume: hand back the caller's existing in_progress draft if one exists.
  select * into v_result
  from public.responses
  where form_version_id = p_form_version_id
    and created_by = v_uid
    and status = 'in_progress';

  if v_result.id is not null then
    return v_result;
  end if;

  -- Create. The unique index guards against a concurrent create winning the
  -- race; on conflict, re-read and return the surviving draft.
  begin
    insert into public.responses (form_version_id, commission_id, created_by, status)
    values (p_form_version_id, v_commission_id, v_uid, 'in_progress')
    returning * into v_result;
  exception
    when unique_violation then
      select * into v_result
      from public.responses
      where form_version_id = p_form_version_id
        and created_by = v_uid
        and status = 'in_progress';
  end;

  return v_result;
end;
$$;

grant execute on function public.start_or_resume_response(uuid)
  to authenticated, service_role;
