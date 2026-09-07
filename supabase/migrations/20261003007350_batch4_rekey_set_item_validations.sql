-- 20261003007350 — pre-AE5 Batch 4: re-key the ONE DEFINER door whose policy backstop is
-- unreachable, `public.set_item_validations`, from layer 1 onto the layer-3 authorizer.
--
-- WHY THIS ONE AND NOT THE OTHER SEVEN (ADR 0193 D5).
-- Population, stated before the number (LEARN-009): `prosecdef` functions in `app` or `public`
-- whose comment-stripped `prosrc` writes any of the nine form-family tables. Measured at head
-- 20261003007340: EXACTLY EIGHT, 0 of 8 carrying a permission-code literal, 0 of 8 on the
-- permission — the manifest row's own "D 8 form fns", reproduced against the live catalog.
-- (⚠ `docs/design/authz-ae43-staff-admin-permission-matrix.md`'s 22 is the wider READ-AND-WRITE
-- population and is also correct; neither figure is a correction of the other — LEARN-079.)
--
-- Seven of the eight sit behind a policy `authenticated` CAN reach, so `commission.forms.edit` is
-- load-bearing there and the split (re-keyed policy, legacy DEFINER writer) is recorded as DATA in
-- the manifest row's `definerSurface` and left to AE5. `form_item_validations` is the single
-- exception in the tree: `authenticated` holds SELECT and nothing else on it (409 § 2.6d), so its
-- re-keyed `_staff_admin_write` policy is a backstop NO statement can reach, and until this
-- migration the permission was inert for the whole table. Recording that split would have recorded
-- a permission that does nothing.
--
-- EQUIVALENCE — the same move the six policies already made, and its differential already exists.
-- `app.is_staff_admin_of(cid)` is `authz.holds_role((select auth.uid()),'staff_admin','commission',cid)`;
-- `app.can_edit_commission_forms(cid,uid)` is
-- `authz.has_permission(uid,'commission',cid,'commission.forms.edit') OR app.is_tenancy_admin_of_for(cid,uid)`.
-- Measured at this head: `authz.role_permissions` grants `commission.forms.edit` to exactly ONE
-- role, `staff_admin`, and `staff_admin` is the only `authoritative` role in `authz.roles` (the
-- other 11 are `legacy`, their grants inert). The tenancy arm is preserved INSIDE the authorizer.
--
-- ⛔ THE BODY BELOW WAS REGENERATED FROM THE LIVE CATALOG
-- (`pg_get_functiondef('public.set_item_validations(uuid,jsonb)'::regprocedure)` at head
-- 20261003007340), NOT retyped from migration text: some migrations rewrite function bodies at
-- runtime, so migration text is stale by design (ADR 0078), and a hand-retyped body silently
-- reverts intervening patches. Exactly ONE line differs from the live definition — the gate. The
-- signature, `SECURITY DEFINER`, and `search_path = app, public, pg_catalog` are unchanged, so
-- this is a `create or replace` with no DROP, no dependent policy to restore, no new public RPC
-- (hence no `REVOKE ALL FROM PUBLIC` owed) and no `citext` in the signature.
--
-- PINS THIS MOVES, all updated in the same change:
--   * `409` § 2.10c expected `layer1/no-code` -> `moved/no-code` (⛔ NOT the `moved/carries-the-code`
--     its own prescription named — that would push a second permission-code literal into `public`,
--     breaking the "only place the code appears" claim and moving `410` § 8.6's carrier count
--     4 -> 5; the wrong prescription is corrected as a dated note beside the original, LEARN-088).
--   * `409` § 2.6f / § 2.10e — the behavioural differential, both polarities, red-first before this
--     file existed: § 2.10e caught "no exception" on the un-migrated catalog.
--   * the manifest row's `definerSurface` entry for this function flips to the authorizer gate.
--   * `docs/deployment/authz-rollback-runbook.md` § 6.2 gains it as a revert artifact.

CREATE OR REPLACE FUNCTION public.set_item_validations(p_item_id uuid, p_rules jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
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
  if not app.can_edit_commission_forms(v_commission, (select auth.uid())) then
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
$function$;
