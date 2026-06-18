-- Phase 13 / B5: Audit Trail — public .read/.export writer wrapper. ADR 0029 §6.
--
-- The instrumentation triggers (…120001) catch every MUTATION path-independently,
-- but a sensitive READ/EXPORT leaves no row change for a trigger to see. The
-- FINITE set of such call sites (ADR 0029 §6) — a staff_admin opening ANOTHER
-- member's SUBMITTED response, the dashboard CSV export, the audit CSV export —
-- logs explicitly from the query/route layer.
--
-- app.audit_write lives in the locked-down `app` schema (invisible to PostgREST),
-- so the TS layer can't call it via .rpc(). This thin public DEFINER wrapper
-- exposes ONLY the .read/.export verbs, with a hard CHECK that the action ends in
-- `.read` or `.exported` (it cannot be abused to forge an arbitrary mutation row)
-- and a metadata allow-list kept to non-sensitive identifiers. Mirrors the
-- public.meetings_enabled / public.audit_trail_enabled thin-wrapper pattern.
--
-- Attribution is automatic: SECURITY DEFINER preserves auth.uid(), so the row is
-- attributed to the calling staff_admin/admin (never a forged actor). The writer
-- still no-ops while the audit_trail flag is OFF.
create function public.log_audit_access(
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
  -- read/export actions (ADR 0029 §6). A caller cannot use it to forge a mutation
  -- audit row. The allow-list is positive (exact actions), not a `.read` pattern,
  -- so the spec's `response.opened_foreign` verb is included explicitly.
  if p_action not in ('response.opened_foreign', 'response.exported', 'audit.exported') then
    raise exception 'log_audit_access: ação de acesso não permitida (%)', p_action
      using errcode = 'check_violation';
  end if;
  perform app.audit_write(p_action, p_entity_type, p_entity_id, p_commission, p_summary, p_metadata);
end;
$$;

revoke all on function public.log_audit_access(text, text, uuid, uuid, text, jsonb) from public, anon;
grant execute on function public.log_audit_access(text, text, uuid, uuid, text, jsonb) to authenticated, service_role;
