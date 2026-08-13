-- FF-3 (ADR 0090) — B2: the WRITER door + the two missing policy arms + the
-- clone deep-copy block, all in ONE wave.
--
-- They ship together on purpose. `form_item_validations` has been write-inert
-- since F3, and three obligations are correct ONLY while it holds zero rows:
--   · the Rule 5 clone gap (a published version's rules are lost on edit),
--   · the missing `can_access_targeted_version` SELECT arm (ETH targeted
--     respondents cannot read the rules of the version they are filling),
--   · the missing `staff_admin` write arm.
-- The instant a writer exists all three become live defects, so the writer may
-- not land without them. (FF-2 handed this phase the last two as a named
-- obligation; the first is INFO-1's remainder.)
--
-- DOOR PARITY, measured against `pg_policies` at authoring time — NOT asserted:
--
--   shape                            | form_item_options | form_matrix_rows/_columns | form_item_validations
--   ---------------------------------|-------------------|---------------------------|----------------------
--   base member/admin SELECT         | own policy        | OR-arm of the one policy  | own policy (had it)
--   can_access_targeted_version READ | own policy        | OR-arm of the same policy | ADDED HERE
--   staff_admin FOR ALL write        | own policy        | NONE                      | ADDED HERE
--   `authenticated` DML grant        | FULL (arwdDxtm)   | SELECT ONLY               | SELECT ONLY (kept)
--
-- ⚠ The last row is the one that matters and it corrects ADR 0090 §6, which
-- records the matrix tables as carrying a write policy. They do not: they carry
-- ONE policy each, and their write boundary is the GRANT plus the DEFINER door.
-- `form_item_options` is the odd one out — it holds a full DML grant, so for it
-- the FOR-ALL policy IS the boundary.
--
-- We take the STRICTER shape: the grant stays SELECT-only, so K9 ("direct DML
-- denied") holds by privilege and this writer is the only door. The FOR-ALL
-- policy is added anyway, per the ADR, as the documented intent and as
-- defence-in-depth should a DML grant ever be added — but it is NOT today's
-- boundary, and a keystone asserts BOTH facts so no future reader mistakes the
-- policy for the gate.

begin;

-- ---------------------------------------------------------------------------
-- 1 · The two missing policy arms.
-- ---------------------------------------------------------------------------

-- Targeted respondents (ETH lane): a filler who reaches a version through
-- `can_access_targeted_version` rather than commission membership must be able
-- to read that version's rules — otherwise the wizard renders no inline
-- validation for exactly the users the targeted lane exists to serve, while
-- `submit_response` still blocks them. Mirrors
-- `form_item_options_select_targeted` verbatim.
create policy form_item_validations_select_targeted
  on public.form_item_validations
  for select
  to authenticated
  using (
    app.can_access_targeted_version(form_version_id, (select auth.uid()))
  );

-- Mirrors `form_item_options_staff_admin_write` verbatim. Inert today (no DML
-- grant); see the header.
create policy form_item_validations_staff_admin_write
  on public.form_item_validations
  for all
  to authenticated
  using (
    app.is_staff_admin_of(app.commission_of_version(form_version_id))
    or app.is_commission_admin_of(app.commission_of_version(form_version_id))
  )
  with check (
    app.is_staff_admin_of(app.commission_of_version(form_version_id))
    or app.is_commission_admin_of(app.commission_of_version(form_version_id))
  );

-- ---------------------------------------------------------------------------
-- 2 · The writer door.
-- ---------------------------------------------------------------------------

create or replace function public.set_item_validations(
  p_item_id uuid,
  p_rules jsonb
)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_version_id uuid;
  v_item_type text;
  v_parent_type text;
  v_status text;
  v_commission uuid;
  v_bad text;
begin
  if not app.feature_enabled('item_validations') then
    raise exception 'o recurso de validações não está disponível'
      using errcode = 'HC0Q0';
  end if;

  select i.form_version_id, i.item_type, p.item_type
    into v_version_id, v_item_type, v_parent_type
  from public.form_items i
  left join public.form_items p on p.id = i.parent_item_id
  where i.id = p_item_id;

  if v_version_id is null then
    raise exception 'pergunta % não encontrada', p_item_id
      using errcode = 'HC0Q1';
  end if;

  v_commission := app.commission_of_version(v_version_id);

  -- AUTHORITY FIRST — '42501', never an HC0* domain code (ADR 0079). "You may
  -- not" must never be reachable through a branch that says "your data is
  -- wrong", or the two become indistinguishable to a caller and to a test.
  if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then
    raise exception 'você não pode editar formulários nesta comissão'
      using errcode = '42501';
  end if;

  select status into v_status from public.form_versions where id = v_version_id;
  if v_status <> 'draft' then
    raise exception 'apenas versões em rascunho podem ser editadas'
      using errcode = 'HC0P4';
  end if;

  if p_rules is null or jsonb_typeof(p_rules) <> 'array' then
    raise exception 'lista de validações inválida'
      using errcode = 'HC0Q2';
  end if;

  -- Entry shape. Every key test resolves the ABSENT case (FF-2 defect 1).
  if exists (
    select 1
    from jsonb_array_elements(p_rules) e
    where jsonb_typeof(e.value) <> 'object'
       or coalesce(jsonb_typeof(e.value -> 'rule_type'), 'missing') <> 'string'
       or coalesce(jsonb_typeof(e.value -> 'severity'), 'missing') <> 'string'
       or (e.value ->> 'severity') not in ('error', 'warn')
       or coalesce(jsonb_typeof(e.value -> 'message'), 'missing') <> 'string'
       or btrim(coalesce(e.value ->> 'message', '')) = ''
       or coalesce(jsonb_typeof(e.value -> 'position'), 'missing') <> 'number'
  ) then
    raise exception 'lista de validações inválida'
      using errcode = 'HC0Q2';
  end if;

  -- Coverage BEFORE config, so an author who picked the wrong rule for the
  -- field type is told that, not "your bounds are wrong".
  select e.value ->> 'rule_type' into v_bad
  from jsonb_array_elements(p_rules) e
  where not app.validation_rule_allowed(
    e.value ->> 'rule_type', v_item_type, v_parent_type
  )
  limit 1;

  if v_bad is not null then
    raise exception 'a pergunta do tipo "%" não aceita a validação "%"',
      v_item_type, v_bad
      using errcode = 'HC0Q1';
  end if;

  select e.value ->> 'rule_type' into v_bad
  from jsonb_array_elements(p_rules) e
  where not app.is_valid_validation_config(
    e.value ->> 'rule_type', e.value -> 'config'
  )
  limit 1;

  if v_bad is not null then
    raise exception 'a configuração da validação "%" está incompleta ou inválida', v_bad
      using errcode = 'HC0Q2';
  end if;

  -- REPLACE semantics: the payload is the complete desired list for this item.
  -- Unlike a matrix axis there is no author-visible key to match on (a rule is
  -- not an aggregation key), so the replacement is wholesale.
  delete from public.form_item_validations where item_id = p_item_id;

  insert into public.form_item_validations (
    item_id, form_version_id, position, rule_type, config, severity, message
  )
  select
    p_item_id,
    v_version_id,
    (e.value ->> 'position')::integer,
    e.value ->> 'rule_type',
    coalesce(e.value -> 'config', '{}'::jsonb),
    e.value ->> 'severity',
    btrim(e.value ->> 'message')
  from jsonb_array_elements(p_rules) e;

  perform app.audit_write(
    'form_item_validations.set', 'form_item', p_item_id, v_commission,
    'Validações da pergunta atualizadas',
    jsonb_build_object(
      'rules', jsonb_array_length(p_rules),
      'item_type', v_item_type
    )
  );
end;
$$;

revoke all on function public.set_item_validations(uuid, jsonb) from public;
grant execute on function public.set_item_validations(uuid, jsonb) to authenticated;

comment on function public.set_item_validations(uuid, jsonb) is
  'FF-3 (ADR 0090): DEFINER door writing form_item_validations (SELECT-only for '
  'authenticated, so RLS cannot gate the write and this RPC is the boundary). '
  'Draft-only, staff_admin-gated, audited, REPLACE semantics per item.';

-- ---------------------------------------------------------------------------
-- 3 · The clone deep-copy block (INFO-1 remainder).
--
--     `app.copy_version_children` is FF-2's extracted helper, called by
--     `clone_form_version`. Rewritten here with the validations block appended;
--     everything above it is byte-identical to the shipped body, including the
--     `v_actor is not null` scoping that FF-2 needed to keep this helper from
--     being STRICTER than the RLS it displaces (a DEFINER gate must be neither
--     weaker NOR stronger, and the stricter version broke three suites that
--     drive `clone_form_version` with no JWT, as the owner).
-- ---------------------------------------------------------------------------

create or replace function app.copy_version_children(
  p_source_version_id uuid,
  p_target_version_id uuid
)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_source_commission uuid;
  v_target_commission uuid;
  v_target_status text;
  v_actor uuid := (select auth.uid());
begin
  v_source_commission := app.commission_of_version(p_source_version_id);
  v_target_commission := app.commission_of_version(p_target_version_id);

  if v_source_commission is null or v_target_commission is null then
    raise exception 'versão de formulário não encontrada'
      using errcode = 'no_data_found';
  end if;

  if v_actor is not null and not (
    (app.is_staff_admin_of(v_source_commission) or app.is_commission_admin_of(v_source_commission))
    and
    (app.is_staff_admin_of(v_target_commission) or app.is_commission_admin_of(v_target_commission))
  ) then
    raise exception 'você não pode editar formulários nesta comissão'
      using errcode = '42501';
  end if;

  select status into v_target_status
  from public.form_versions where id = p_target_version_id;

  if v_target_status <> 'draft' then
    raise exception 'apenas versões em rascunho podem ser editadas'
      using errcode = 'HC0P4';
  end if;

  create temp table _clone_section_map (old_id uuid, new_id uuid) on commit drop;
  create temp table _clone_item_map (old_id uuid, new_id uuid) on commit drop;

  with src as (
    select id, position, title, description, is_default,
           visible_when, requires_signoff, signoff_role
    from public.form_sections
    where form_version_id = p_source_version_id
  ),
  ins as (
    insert into public.form_sections (
      form_version_id, position, title, description, is_default,
      visible_when, requires_signoff, signoff_role
    )
    select p_target_version_id, position, title, description, is_default,
           visible_when, requires_signoff, signoff_role
    from src
    order by position
    returning id, position
  )
  insert into _clone_section_map (old_id, new_id)
  select src.id, ins.id
  from src
  join ins on ins.position = src.position;

  with src as (
    select i.id, m.new_id as new_section_id, i.position, i.item_type,
           i.question_key, i.label, i.question_explanation, i.config,
           i.visible_when, i.required, i.content, i.default_value, i.parent_item_id,
           i.required_if
    from public.form_items i
    join public.form_sections s on s.id = i.section_id
    join _clone_section_map m on m.old_id = i.section_id
    where s.form_version_id = p_source_version_id
  ),
  ins as (
    insert into public.form_items (
      section_id, position, item_type,
      question_key, label, question_explanation, config, visible_when,
      required, content, default_value, required_if
    )
    select new_section_id, position, item_type,
           question_key, label, question_explanation, config, visible_when,
           required, content, default_value, required_if
    from src
    returning id, section_id, position
  )
  insert into _clone_item_map (old_id, new_id)
  select src.id, ins.id
  from src
  join ins on ins.section_id = src.new_section_id and ins.position = src.position;

  update public.form_items c
  set parent_item_id = pm.new_id
  from public.form_items src
  join _clone_item_map im on im.old_id = src.id
  join _clone_item_map pm on pm.old_id = src.parent_item_id
  where c.id = im.new_id
    and src.parent_item_id is not null;

  insert into public.form_item_options (
    item_id, position, code, label, color_token, score, analytics_code, flagged, is_other,
    is_exclusive, risk_weight
  )
  select m.new_id, o.position, o.code, o.label, o.color_token, o.score,
         o.analytics_code, o.flagged, o.is_other, o.is_exclusive, o.risk_weight
  from public.form_item_options o
  join _clone_item_map m on m.old_id = o.item_id;

  insert into public.form_matrix_rows (
    item_id, form_version_id, position, code, label, weight
  )
  select m.new_id, p_target_version_id, r.position, r.code, r.label, r.weight
  from public.form_matrix_rows r
  join _clone_item_map m on m.old_id = r.item_id;

  insert into public.form_matrix_columns (
    item_id, form_version_id, position, code, label, weight
  )
  select m.new_id, p_target_version_id, c.position, c.code, c.label, c.weight
  from public.form_matrix_columns c
  join _clone_item_map m on m.old_id = c.item_id;

  -- FF-3 (ADR 0090): validations. LAST, after the parent_item_id re-link above,
  -- because `app.guard_item_validation_row` resolves the new item's PARENT type
  -- to check `unique_within_group` coverage — copying before the re-link would
  -- see a NULL parent and refuse the row.
  insert into public.form_item_validations (
    item_id, form_version_id, position, rule_type, config, severity, message
  )
  select m.new_id, p_target_version_id, v.position, v.rule_type, v.config,
         v.severity, v.message
  from public.form_item_validations v
  join _clone_item_map m on m.old_id = v.item_id;

  drop table _clone_section_map;
  drop table _clone_item_map;
end;
$$;

commit;
