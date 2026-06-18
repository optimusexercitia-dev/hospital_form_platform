-- Phase 14a / B5: PHI `.read` audit integration (Architecture Rule 11 + Rule 12;
-- ADR 0030's explicit "14a integration item" + ADR 0031). HIPAA requires logging
-- every PHI access — this INVERTS the Phase-13 "don't log reads" default for the
-- isolated event_patient table: the query-layer getEventPatient (src/lib/queries/
-- safety-events.ts) emits an explicit `event_patient.read` audit row on a successful
-- scoped PHI load, via the public.log_audit_access DEFINER wrapper.
--
-- STRICTLY ADDITIVE: this CREATE OR REPLACE adds ONE new action — 'event_patient.read'
-- — to the positive allow-list, and changes NOTHING else. It does NOT touch the
-- hash-chain (app.audit_write / app.audit_canonical), the append-only guard
-- (app.guard_audit_immutable), the existing allow-list entries, or any other audit
-- surface. The wrapper still forwards to app.audit_write (which no-ops while the
-- audit_trail flag is OFF and attributes auth.uid()), so the row is correctly
-- attributed to the viewing custodian/PQS user and the log still NEVER copies PHI /
-- description_md / any free-text body — only THAT the PHI was read + WHO.
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
  -- Hard guard: this public surface may ONLY emit the FINITE set of sensitive
  -- read/export actions (ADR 0029 §6; extended for 14a's PHI read — ADR 0030/0031).
  -- The allow-list is positive (exact actions), not a `.read` pattern, so a caller
  -- cannot use it to forge a mutation audit row. 'event_patient.read' is the ONLY
  -- new entry vs migration …120004 (strictly additive).
  if p_action not in (
    'response.opened_foreign', 'response.exported', 'audit.exported',
    'event_patient.read'
  ) then
    raise exception 'log_audit_access: ação de acesso não permitida (%)', p_action
      using errcode = 'check_violation';
  end if;
  perform app.audit_write(p_action, p_entity_type, p_entity_id, p_commission, p_summary, p_metadata);
end;
$$;

-- Re-assert grants (CREATE OR REPLACE preserves them, but be explicit + idempotent).
revoke all on function public.log_audit_access(text, text, uuid, uuid, text, jsonb) from public, anon;
grant execute on function public.log_audit_access(text, text, uuid, uuid, text, jsonb) to authenticated, service_role;
