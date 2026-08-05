-- PCI/H2 (process-case integrity audit, finding H2) — complete the audit mesh over
-- the case cluster. Architecture Rule 11 says "every mutation emits a row"; the
-- catalog said otherwise.
--
-- ── WHAT WAS ACTUALLY MISSING ──────────────────────────────────────────────────
--
-- Read from pg_trigger (not from the migrations that wrote them):
--
--   audit_case_phases_trg   AFTER DELETE, UPDATE   -> phase INSERTs unaudited
--   audit_cases_trg         AFTER INSERT, UPDATE   -> case DELETEs unaudited
--   case_phase_allowed_results   (no triggers at all)
--   case_phase_offered_results   (no triggers at all)
--   case_offered_outcomes        (no triggers at all)
--   case_custom_field_values     (no triggers at all)
--
-- All four bare tables are `authenticated`-writable under a FOR ALL policy, so
-- they were directly mutable with zero trace. The case-DELETE gap is the sharpest:
-- `guard_case_status` blocks deleting a TERMINAL case, so the deletable case is
-- precisely the non-terminal one — an in-flight investigation — and it cascades
-- phases, narratives, outcomes and custom fields away without a single audit row.
--
-- ── THE CASCADE-SILENCE RULE ───────────────────────────────────────────────────
--
-- ⚠ Every arm below returns NULL when the owning commission cannot be resolved.
-- That is not defensive noise: when a case is deleted its children cascade, and a
-- child's AFTER-DELETE trigger then cannot see the parent. Emitting one audit row
-- per cascaded child would bury the single meaningful `case.deleted` row under
-- dozens of derivative ones. The existing trg_audit_case_phases DELETE arm already
-- established this convention ("case cascade; see the note above") and this
-- migration follows it rather than inventing a second one.
--
-- Consequence, stated rather than hidden: a cascaded child delete is audited at
-- the CASE level (one `case.deleted` row) and not per child. The case row carries
-- the case number and status, which is what a reviewer reconstructs from.
--
-- ── MUTATION PROOF ─────────────────────────────────────────────────────────────
-- supabase/tests/296_process_case_integrity.sql §H2. Each new arm has a keystone
-- that counts audit_log rows before/after; drop the arm and the count assertion
-- goes red. Counting rows (not just "a row exists") is deliberate — an audit test
-- that asserts >= 1 passes on a pre-existing unrelated row.

-- ── case_phases: add the INSERT arm ────────────────────────────────────────────
-- The DELETE and UPDATE arms are unchanged from the deployed body.
create or replace function app.trg_audit_case_phases()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_comm uuid;
begin
  -- PCI/H2 — NEW ARM.
  if tg_op = 'INSERT' then
    v_comm := app.commission_of_case(new.case_id);
    if v_comm is null then
      return null;
    end if;
    perform app.audit_write('case_phase.created', 'case_phase', new.id, v_comm,
      case when new.is_ad_hoc
           then 'Fase avulsa ' || new.position || ' criada'
           else 'Fase ' || new.position || ' criada'
      end,
      app.audit_diff(null, to_jsonb(new),
        array['status', 'position', 'title', 'is_ad_hoc', 'assigned_to', 'form_version_id']));
    return null;
  end if;

  if tg_op = 'DELETE' then
    v_comm := app.commission_of_case(old.case_id);
    if v_comm is null then
      return null;  -- case cascade; see the note above
    end if;
    perform app.audit_write('case_phase.deleted', 'case_phase', old.id, v_comm,
      'Fase avulsa ' || old.position || ' excluída',
      app.audit_diff(to_jsonb(old), null,
        array['status', 'position', 'title', 'is_ad_hoc', 'assigned_to']));
    return null;
  end if;

  -- Unchanged UPDATE arm (the trigger stays AFTER UPDATE for status changes).
  if new.status is distinct from old.status then
    v_comm := app.commission_of_case(new.case_id);
    perform app.audit_write('case_phase.status_changed', 'case_phase', new.id, v_comm,
      'Status da fase ' || new.position || ': ' || old.status || ' → ' || new.status,
      app.audit_diff(to_jsonb(old), to_jsonb(new),
        array['status', 'position', 'result_id', 'result_override_id']));
  end if;
  return null;
end;
$function$;

drop trigger if exists audit_case_phases_trg on public.case_phases;
create trigger audit_case_phases_trg
  after insert or update or delete on public.case_phases
  for each row execute function app.trg_audit_case_phases();

-- ── cases: add the DELETE arm ──────────────────────────────────────────────────
create or replace function app.trg_audit_cases()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_cols constant text[] := array['status', 'outcome_id'];
begin
  -- PCI/H2 — NEW ARM. Must be first: `new` is NULL on DELETE, so the pre-existing
  -- `new.status is distinct from old.status` test below would raise.
  if tg_op = 'DELETE' then
    perform app.audit_write('case.deleted', 'case', old.id, old.commission_id,
      'Caso nº ' || old.case_number || ' excluído (status ' || old.status || ')',
      app.audit_diff(to_jsonb(old), null,
        array['status', 'outcome_id', 'case_number', 'template_id', 'label']));
    return null;
  end if;

  if tg_op = 'INSERT' then
    perform app.audit_write('case.created', 'case', new.id, new.commission_id,
      'Caso criado nº ' || new.case_number,
      app.audit_diff(null, to_jsonb(new), v_cols));
  elsif new.status is distinct from old.status then
    perform app.audit_write('case.status_changed', 'case', new.id, new.commission_id,
      'Status do caso nº ' || new.case_number || ': ' || old.status || ' → ' || new.status,
      app.audit_diff(to_jsonb(old), to_jsonb(new), v_cols));
  end if;
  return null;
end;
$function$;

drop trigger if exists audit_cases_trg on public.cases;
create trigger audit_cases_trg
  after insert or update or delete on public.cases
  for each row execute function app.trg_audit_cases();

-- ── The four bare child tables ─────────────────────────────────────────────────
--
-- One function, branching on tg_table_name, rather than four near-identical ones.
-- The owning case is resolved through jsonb rather than record-field access so the
-- same body can serve a case_id-keyed table and the phase-keyed one without
-- referencing a column that does not exist on the other.
create or replace function app.trg_audit_case_child()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_json    jsonb;
  v_case_id uuid;
  v_comm    uuid;
  v_action  text;
  v_summary text;
  v_label   text;
  v_verb    text;
begin
  v_json := to_jsonb(case when tg_op = 'DELETE' then old else new end);

  -- case_phase_allowed_results is keyed by phase; the other three by case.
  v_case_id := coalesce(
    nullif(v_json ->> 'case_id', '')::uuid,
    app.case_of_case_phase(nullif(v_json ->> 'case_phase_id', '')::uuid)
  );

  v_comm := app.commission_of_case(v_case_id);
  if v_comm is null then
    return null;  -- cascade; see the cascade-silence rule in this migration's header
  end if;

  v_verb := case tg_op when 'INSERT' then 'added'
                       when 'DELETE' then 'removed'
                       else 'updated' end;

  if tg_table_name in ('case_phase_allowed_results', 'case_phase_offered_results') then
    select label into v_label from public.phase_results
    where id = (v_json ->> 'result_id')::uuid;
    v_label := coalesce(v_label, '(desconhecido)');
  elsif tg_table_name = 'case_offered_outcomes' then
    select label into v_label from public.case_outcomes
    where id = (v_json ->> 'outcome_id')::uuid;
    v_label := coalesce(v_label, '(desconhecido)');
  else
    v_label := coalesce(nullif(v_json ->> 'label', ''), v_json ->> 'key', '(campo)');
  end if;

  if tg_table_name = 'case_phase_allowed_results' then
    v_action  := 'case_phase_allowed_result.' || v_verb;
    v_summary := 'Resultado permitido "' || v_label || '" '
                 || case tg_op when 'INSERT' then 'adicionado à fase'
                               when 'DELETE' then 'removido da fase'
                               else 'alterado na fase' end;
    perform app.audit_write(v_action, 'case_phase',
      (v_json ->> 'case_phase_id')::uuid, v_comm, v_summary,
      app.audit_diff(
        case when tg_op = 'INSERT' then null else to_jsonb(old) end,
        case when tg_op = 'DELETE' then null else to_jsonb(new) end,
        array['result_id', 'position']));
    return null;
  end if;

  if tg_table_name = 'case_phase_offered_results' then
    v_action  := 'case_offered_result.' || v_verb;
    v_summary := 'Resultado alcançável "' || v_label || '" '
                 || case tg_op when 'INSERT' then 'adicionado ao caso'
                               when 'DELETE' then 'removido do caso'
                               else 'alterado no caso' end;
  elsif tg_table_name = 'case_offered_outcomes' then
    v_action  := 'case_offered_outcome.' || v_verb;
    v_summary := 'Desfecho disponível "' || v_label || '" '
                 || case tg_op when 'INSERT' then 'adicionado ao caso'
                               when 'DELETE' then 'removido do caso'
                               else 'alterado no caso' end;
  else
    v_action  := 'case_custom_field.' || v_verb;
    v_summary := 'Campo personalizado "' || v_label || '" '
                 || case tg_op when 'INSERT' then 'adicionado'
                               when 'DELETE' then 'removido'
                               else 'alterado' end;
  end if;

  perform app.audit_write(v_action, 'case', v_case_id, v_comm, v_summary,
    app.audit_diff(
      case when tg_op = 'INSERT' then null else to_jsonb(old) end,
      case when tg_op = 'DELETE' then null else to_jsonb(new) end,
      array['result_id', 'outcome_id', 'key', 'label', 'value', 'position']));
  return null;
end;
$function$;

comment on function app.trg_audit_case_child() is
  'PCI/H2 — shared AFTER-ROW audit arm for the four case child tables that carried no triggers at all (case_phase_allowed_results, case_phase_offered_results, case_offered_outcomes, case_custom_field_values). Returns NULL when the owning commission is unresolvable, which is the parent-cascade case — those are audited once at the case level.';

drop trigger if exists audit_case_phase_allowed_results_trg on public.case_phase_allowed_results;
create trigger audit_case_phase_allowed_results_trg
  after insert or update or delete on public.case_phase_allowed_results
  for each row execute function app.trg_audit_case_child();

drop trigger if exists audit_case_phase_offered_results_trg on public.case_phase_offered_results;
create trigger audit_case_phase_offered_results_trg
  after insert or update or delete on public.case_phase_offered_results
  for each row execute function app.trg_audit_case_child();

drop trigger if exists audit_case_offered_outcomes_trg on public.case_offered_outcomes;
create trigger audit_case_offered_outcomes_trg
  after insert or update or delete on public.case_offered_outcomes
  for each row execute function app.trg_audit_case_child();

drop trigger if exists audit_case_custom_field_values_trg on public.case_custom_field_values;
create trigger audit_case_custom_field_values_trg
  after insert or update or delete on public.case_custom_field_values
  for each row execute function app.trg_audit_case_child();
