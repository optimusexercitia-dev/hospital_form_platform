-- Case Narratives (4 of 4): audit-trail INSTRUMENTATION triggers. ADR 0032 +
-- Architecture Rule 11. Three AFTER INSERT/UPDATE/DELETE triggers mirroring
-- 20260617120001 (the form_items / interviews examples that exclude content /
-- markdown). Each is DEFINER, returns null, resolves the row's commission_id, and
-- calls app.audit_write with a curated old->new diff over a NON-SENSITIVE
-- allow-list ONLY.
--
-- CRUX (Rule 1 + Rule 11): the allow-lists below NEVER include body_md, title, or
-- instructions (free-text / Markdown — the no-fly zone). A narrative TYPE's label
-- is a short vocabulary name (like case_outcomes.label) and is safe to diff; a
-- per-case type_label is the snapshot of that safe label, also safe.
--
-- Capture is TRIGGER-ONLY (path-independent; no double-logging). app.audit_write
-- no-ops while the audit_trail flag is OFF and is INDEPENDENT of the
-- case_narratives flag, so these triggers are unconditional — they simply start
-- emitting once audit_trail is on (already enabled in this codebase).

-- ===========================================================================
-- case_narrative_types — created / updated   (commission directly on the row)
-- ===========================================================================
-- Allow-list: label, position, archived. NEVER `description` (free-text-ish, like
-- form_sections.description which the audit deliberately excludes). No DELETE verb
-- — types are archived, not deleted.
create function app.trg_audit_case_narrative_types()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_cols constant text[] := array['label', 'position', 'archived'];
begin
  if tg_op = 'INSERT' then
    perform app.audit_write('case_narrative_type.created', 'case_narrative_type', new.id,
      new.commission_id, 'Tipo de narrativa criado: ' || coalesce(new.label, ''),
      app.audit_diff(null, to_jsonb(new), v_cols));
  else
    perform app.audit_write('case_narrative_type.updated', 'case_narrative_type', new.id,
      new.commission_id, 'Tipo de narrativa atualizado: ' || coalesce(new.label, ''),
      app.audit_diff(to_jsonb(old), to_jsonb(new), v_cols));
  end if;
  return null;
end;
$$;

create trigger audit_case_narrative_types_trg
  after insert or update on public.case_narrative_types
  for each row execute function app.trg_audit_case_narrative_types();

-- ===========================================================================
-- process_template_narratives — created / updated / deleted (commission via the
-- template)
-- ===========================================================================
-- Allow-list: display_position, narrative_type_id, is_expected. NEVER
-- title / instructions (free-text overrides + authoring guidance — Rule 11).
create function app.trg_audit_template_narratives()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_cols constant text[] := array['display_position', 'narrative_type_id', 'is_expected'];
  v_id uuid;
  v_template uuid;
  v_action text;
  v_meta jsonb;
begin
  if tg_op = 'DELETE' then
    v_template := old.template_id; v_id := old.id; v_action := 'case_template_narrative.deleted';
    v_meta := app.audit_diff(to_jsonb(old), null, v_cols);
  elsif tg_op = 'INSERT' then
    v_template := new.template_id; v_id := new.id; v_action := 'case_template_narrative.created';
    v_meta := app.audit_diff(null, to_jsonb(new), v_cols);
  else
    v_template := new.template_id; v_id := new.id; v_action := 'case_template_narrative.updated';
    v_meta := app.audit_diff(to_jsonb(old), to_jsonb(new), v_cols);
  end if;
  perform app.audit_write(v_action, 'case_template_narrative', v_id,
    app.commission_of_template(v_template), 'Narrativa do processo ' || tg_op, v_meta);
  return null;
end;
$$;

create trigger audit_template_narratives_trg
  after insert or update or delete on public.process_template_narratives
  for each row execute function app.trg_audit_template_narratives();

-- ===========================================================================
-- case_narratives — created / updated   (commission via the case)
-- ===========================================================================
-- Allow-list: type_label, display_position, is_expected. NEVER body_md (the
-- Markdown body no-fly zone), NEVER title, NEVER instructions. A pgTAP test
-- asserts the body value never appears in any audit_log.metadata row. No DELETE
-- verb — per-case narratives are template-fixed (created at case creation, never
-- removed in v1); they vanish only via the case cascade.
create function app.trg_audit_case_narratives()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_cols constant text[] := array['type_label', 'display_position', 'is_expected'];
begin
  if tg_op = 'INSERT' then
    perform app.audit_write('case_narrative.created', 'case_narrative', new.id,
      app.commission_of_case(new.case_id),
      'Narrativa do caso criada: ' || coalesce(new.type_label, ''),
      app.audit_diff(null, to_jsonb(new), v_cols));
  else
    perform app.audit_write('case_narrative.updated', 'case_narrative', new.id,
      app.commission_of_case(new.case_id),
      'Narrativa do caso atualizada: ' || coalesce(new.type_label, ''),
      app.audit_diff(to_jsonb(old), to_jsonb(new), v_cols));
  end if;
  return null;
end;
$$;

create trigger audit_case_narratives_trg
  after insert or update on public.case_narratives
  for each row execute function app.trg_audit_case_narratives();
