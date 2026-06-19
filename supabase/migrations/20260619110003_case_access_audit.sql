-- Case Access Control (BE-5): audit-trail integration. ADR 0033 D8 + Architecture
-- Rule 11. Three strictly-additive pieces:
--   (1) log_audit_access gains the 'case.opened' access verb (mirrors the …121004
--       event_patient.read extension — a CREATE OR REPLACE that adds ONE allow-list
--       entry and changes nothing else). get_case_detail (…110002) emits it on a
--       non-coordinator open.
--   (2) a PHI-free mutation-audit trigger on public.case_access (grant/revoke). The
--       allow-list is { level } ONLY — a short enum, never anything sensitive; the
--       row's user_id is the entity context (a profile id, not PHI).
--   (3) the existing case_narratives mutation-audit trigger's allow-list GAINS
--       { status, assigned_to } so a narrative assign / conclude / reopen is
--       captured — both are safe (an enum + a profile id). It STILL NEVER includes
--       body_md / title / instructions (the free-text/Markdown no-fly zone — Rule
--       11). A pgTAP assertion (144_case_access) proves body_md never appears in any
--       audit_log.metadata across the narrative triggers.
--
-- Capture is TRIGGER-ONLY (path-independent). app.audit_write no-ops while the
-- audit_trail flag is OFF and is INDEPENDENT of case_access, so these are
-- unconditional — they emit once audit_trail is on (already enabled here). The
-- case.opened ACCESS row is the one query-layer-emitted exception (a read leaves no
-- row change for a trigger to see), gated through the public.log_audit_access
-- wrapper exactly like response.opened_foreign / event_patient.read.

-- ===========================================================================
-- (1) log_audit_access — add 'case.opened' to the positive allow-list.
-- ===========================================================================
-- STRICTLY ADDITIVE vs …121004: adds ONE action ('case.opened') and changes nothing
-- else (the hash-chain, the append-only guard, the existing entries, the grants are
-- all untouched). The wrapper still forwards to app.audit_write (no-op while
-- audit_trail OFF; attributes auth.uid()) and NEVER copies body/PHI — only THAT the
-- case was opened + WHO.
create or replace function public.log_audit_access(
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_commission uuid,
  p_summary text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
begin
  -- Positive allow-list (exact actions). 'case.opened' is the ONLY new entry vs
  -- …121004 (ADR 0033 D8). A caller cannot forge a mutation row through this surface.
  if p_action not in (
    'response.opened_foreign', 'response.exported', 'audit.exported',
    'event_patient.read', 'case.opened'
  ) then
    raise exception 'log_audit_access: ação de acesso não permitida (%)', p_action
      using errcode = 'check_violation';
  end if;
  perform app.audit_write(p_action, p_entity_type, p_entity_id, p_commission, p_summary, p_metadata);
end;
$$;

revoke all on function public.log_audit_access(text, text, uuid, uuid, text, jsonb) from public, anon;
grant execute on function public.log_audit_access(text, text, uuid, uuid, text, jsonb) to authenticated, service_role;

-- ===========================================================================
-- (2) case_access — mutation-audit (grant created/updated/revoked). PHI-free.
-- ===========================================================================
-- Allow-list: level ONLY (a 'read'|'write' enum). NEVER granted_by (a uid is fine
-- as the entity, but we keep the diff to the access LEVEL — the meaningful change).
-- commission resolved via app.commission_of_case. Entity = the case_access "row"
-- keyed by the CASE id (the table has no surrogate id; user_id rides in the summary
-- as context, which is a profile id, not PHI).
create function app.trg_audit_case_access()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_cols constant text[] := array['level'];
  v_case uuid;
  v_user uuid;
  v_action text;
  v_meta jsonb;
begin
  if tg_op = 'DELETE' then
    v_case := old.case_id; v_user := old.user_id; v_action := 'case_access.revoked';
    v_meta := app.audit_diff(to_jsonb(old), null, v_cols);
  elsif tg_op = 'INSERT' then
    v_case := new.case_id; v_user := new.user_id; v_action := 'case_access.granted';
    v_meta := app.audit_diff(null, to_jsonb(new), v_cols);
  else
    v_case := new.case_id; v_user := new.user_id; v_action := 'case_access.updated';
    v_meta := app.audit_diff(to_jsonb(old), to_jsonb(new), v_cols);
  end if;

  perform app.audit_write(v_action, 'case_access', v_case,
    app.commission_of_case(v_case),
    'Acesso ao caso ' || tg_op || ' (membro ' || coalesce(v_user::text, '?') || ')',
    v_meta);
  return null;
end;
$$;

create trigger audit_case_access_trg
  after insert or update or delete on public.case_access
  for each row execute function app.trg_audit_case_access();

-- ===========================================================================
-- (3) case_narratives — extend the audit allow-list with status + assigned_to.
-- ===========================================================================
-- CREATE OR REPLACE of app.trg_audit_case_narratives (…100003). The ONLY change is
-- the allow-list: ['type_label','display_position','is_expected'] gains 'status' and
-- 'assigned_to' so a narrative assign / unassign / conclude / reopen is captured.
-- BOTH additions are safe (an enum + a profile id). body_md / title / instructions
-- remain EXCLUDED (the no-fly zone). The 144_case_access pgTAP proves body_md never
-- appears in metadata across these triggers.
create or replace function app.trg_audit_case_narratives()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_cols constant text[] := array['type_label', 'display_position', 'is_expected',
                                  'status', 'assigned_to'];
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
