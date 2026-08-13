-- ETH·E4 §4 — `case_type_terminology` gets the audit trigger it never had.
--
-- WHY THIS MIGRATION EXISTS AT ALL. The ETH·E4 plan §4 scopes the vocabulary admin
-- (the `case_participant_roles` + `case_type_terminology` editors) as "frontend-only
-- — no substrate work", and the plan review verified that claim. What was verified was
-- GRANTS and the org-admin `FOR ALL` policy. Auditability was not. Re-derived from the
-- live catalog:
--
--   case_participant_roles  → trg_audit_case_participant_role (AFTER INSERT OR UPDATE
--                             OR DELETE) + trg_guard_case_participant_role_key.  AUDITED.
--   case_type_terminology   → ZERO non-internal triggers.                        NOT.
--
-- And zero functions in `app` or `public` write `case_type_terminology` today, so the
-- T5 editor is its FIRST write path. Shipping it as specified would have created an
-- unaudited mutation surface on org-level vocabulary — a direct violation of
-- Architecture Rule 11 ("every mutation emits a row"), reachable by every org_admin,
-- and invisible to the authz gates because nothing leaks: the write is authorized, it
-- is simply unrecorded.
--
-- So plan §4's "no substrate work" is true for AUTHORIZATION and false for
-- AUDITABILITY. This migration closes the second half.
--
-- SHAPE: a byte-for-byte mirror of `app.audit_case_participant_role`, with the two
-- differences the table forces:
--   1. `case_type_terminology` has NO surrogate key — its identity is the composite
--      (case_type_id, term_key). `audit_log.entity_id` is a single uuid, so it carries
--      `case_type_id` and the metadata carries `term_key`. The entity is therefore the
--      CASE TYPE whose vocabulary changed, which is also the object an auditor reasons
--      about.
--   2. It has no `organization_id` column; the org is resolved through `case_types`.
--      That read happens inside a SECURITY DEFINER trigger, so it is not subject to
--      `case_types_select` and cannot silently drop the org (which would push the row
--      onto the PLATFORM audit chain instead of the org chain — a chain misassignment
--      is not detectable after the fact).

create or replace function app.audit_case_type_terminology()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_row public.case_type_terminology := coalesce(new, old);
  v_org uuid;
begin
  select ct.organization_id into v_org
  from public.case_types ct
  where ct.id = v_row.case_type_id;

  perform app.audit_write(
    'case_type_terminology.' || lower(tg_op),
    'case_type_terminology', v_row.case_type_id, null,
    'Terminologia do tipo de caso alterada',
    jsonb_build_object('term_key', v_row.term_key, 'op', tg_op),
    v_org);
  return null;
end;
$$;

drop trigger if exists trg_audit_case_type_terminology on public.case_type_terminology;
create trigger trg_audit_case_type_terminology
  after insert or update or delete on public.case_type_terminology
  for each row execute function app.audit_case_type_terminology();

comment on function app.audit_case_type_terminology() is
  'ETH·E4: Rule 11 audit trigger for case_type_terminology — the table had none, and '
  'the T5 vocabulary editor is its first write path.';
