-- =============================================================================
-- Phase 17 — Controlled-Document Lifecycle · B4
-- Forms-as-controlled-documents = METADATA ONLY. Additive approved_by/approved_at/
-- effective_date/review_due_date on form_versions, captured INSIDE publish_form_version
-- (no e-sign workflow on forms). Overdue published form versions join the review-due
-- list (B3 form arm).
--
-- MECHANISM (verified against the live publish path):
--  - guard_published_version() (baseline) permits a form_versions UPDATE that changes
--    status ONLY while current_setting('app.in_publish_rpc')='on', and forbids any
--    non-status update once status<>'draft'. So the four new columns are set INSIDE the
--    SAME status-flipping UPDATE the publish RPC already runs under app.in_publish_rpc=
--    'on' — they ride that permitted write. After publish, any later UPDATE touching
--    them is a non-status update on a non-draft row → the immutability error. Result:
--    settable ONLY via publish_form_version. NO change to guard_published_version.
--
-- LEAD DECISION 1 — PURE PASS-THROUGH: store exactly what the caller passes; NULL when
--  unset. No params → all four columns NULL and publish behaves byte-for-byte as today
--  (a form not treated as a controlled doc must not silently acquire an effective date).
--  effective_date = p_effective_date verbatim. review_due_date = coalesce(override,
--  effective-base + cycle) where the base defaults to current_date ONLY for the cycle
--  math (decoupled from the stored effective_date column).
--
-- Additive, forward-only. The RPC signature widens (1 → 5 args); the old 1-arg overload
-- is dropped and recreated so existing 1-arg call sites resolve to the new defaults.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1 · Additive columns on form_versions (all nullable, no default — pure additive).
-- -----------------------------------------------------------------------------
alter table public.form_versions
  add column if not exists approved_by uuid references public.profiles(id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists effective_date date,
  add column if not exists review_due_date date;

comment on column public.form_versions.approved_by is
  'Phase 17: the named approver captured at publish (metadata-only — forms have NO '
  'e-signature workflow). Settable ONLY inside publish_form_version; immutable after '
  '(guard_published_version). NULL when not treated as a controlled document.';
comment on column public.form_versions.effective_date is
  'Phase 17: effective date captured at publish (verbatim pass-through; NULL when unset). '
  'Settable ONLY via publish_form_version.';
comment on column public.form_versions.review_due_date is
  'Phase 17: scheduled review-due date (override wins, else effective-base + cycle). An '
  'overdue published form joins documents_due_for_review (B3 form arm). Settable ONLY via '
  'publish_form_version.';

-- -----------------------------------------------------------------------------
-- 2 · Recreate publish_form_version with the four optional metadata params. The body
--     is IDENTICAL to the baseline through the validation block; the only change is the
--     final publish UPDATE, which stamps the metadata within the same
--     app.in_publish_rpc='on' status-flipping write.
-- -----------------------------------------------------------------------------
drop function if exists public.publish_form_version(uuid);

create or replace function public.publish_form_version(
  p_form_version_id uuid,
  p_approved_by uuid default null,
  p_effective_date date default null,
  p_review_cycle_months integer default null,
  p_review_due_date date default null)
  returns public.form_versions
  language plpgsql
  set search_path to 'public', 'pg_catalog'
as $$
declare
  v_form_id uuid;
  v_status text;
  v_result public.form_versions;
  v_bad_item text;
  v_bad_default text;
  v_review_due date;
begin
  select form_id, status into v_form_id, v_status
  from public.form_versions
  where id = p_form_version_id
  for update;

  if v_form_id is null then
    raise exception 'versão % não encontrada', p_form_version_id
      using errcode = 'no_data_found';
  end if;

  if v_status <> 'draft' then
    raise exception 'apenas versões em rascunho podem ser publicadas'
      using errcode = 'check_violation';
  end if;

  perform public.validate_visible_when(p_form_version_id);

  -- form-model-normalization: every CHOICE item must carry >= 1 option.
  select coalesce(i.label, i.question_key) into v_bad_item
  from public.form_items i
  where i.form_version_id = p_form_version_id
    and i.item_type in ('multiple_choice', 'dropdown', 'checkbox')
    and not exists (
      select 1 from public.form_item_options o where o.item_id = i.id
    )
  limit 1;

  if v_bad_item is not null then
    raise exception
      'a pergunta "%" precisa de ao menos uma opção de resposta', v_bad_item
      using errcode = 'check_violation';
  end if;

  -- answer-model-v2 (HC080): validate each item's default_value against its type.
  select coalesce(i.label, i.question_key) into v_bad_default
  from public.form_items i
  where i.form_version_id = p_form_version_id
    and i.default_value is not null
    and (
      case
        when i.item_type in ('multiple_choice','dropdown') then
          jsonb_typeof(i.default_value) <> 'string'
          or not app.version_has_option_code(
               p_form_version_id, i.question_key, i.default_value #>> '{}')
        when i.item_type = 'checkbox' then
          jsonb_typeof(i.default_value) <> 'array'
          or exists (
            select 1
            from jsonb_array_elements(i.default_value) c
            where jsonb_typeof(c) <> 'string'
               or not app.version_has_option_code(
                    p_form_version_id, i.question_key, c #>> '{}')
          )
        when i.item_type = 'number' then
          jsonb_typeof(i.default_value) <> 'number'
        when i.item_type in ('date','time','short_text','free_text') then
          jsonb_typeof(i.default_value) <> 'string'
        else true   -- any other type must not carry a default
      end
    )
  limit 1;

  if v_bad_default is not null then
    raise exception 'o valor padrão da pergunta "%" é inválido', v_bad_default
      using errcode = 'HC080';
  end if;

  -- Phase 17 (pure pass-through): effective_date is stored verbatim (NULL when unset);
  -- review_due_date = override, else effective-base + cycle (base defaults to
  -- current_date ONLY for the cycle math — decoupled from the stored effective_date).
  v_review_due := coalesce(
    p_review_due_date,
    case when p_review_cycle_months is not null
         then (coalesce(p_effective_date, current_date) + make_interval(months => p_review_cycle_months))::date
         else null end);

  perform set_config('app.in_publish_rpc', 'on', true);

  update public.form_versions
  set status = 'archived'
  where form_id = v_form_id
    and status = 'published';

  update public.form_versions
  set status = 'published',
      published_at = now(),
      approved_by = p_approved_by,
      approved_at = case when p_approved_by is not null then now() else null end,
      effective_date = p_effective_date,
      review_due_date = v_review_due
  where id = p_form_version_id
  returning * into v_result;

  perform set_config('app.in_publish_rpc', 'off', true);

  return v_result;
end;
$$;

alter function public.publish_form_version(uuid, uuid, date, integer, date) owner to postgres;

-- -----------------------------------------------------------------------------
-- 3 · Grants (widened signature — mirror the baseline REVOKE/GRANT for this RPC).
-- -----------------------------------------------------------------------------
revoke all on function public.publish_form_version(uuid, uuid, date, integer, date) from public;
grant execute on function public.publish_form_version(uuid, uuid, date, integer, date)
  to authenticated, service_role;
