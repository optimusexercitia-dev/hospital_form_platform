-- =============================================================================
-- ETH·E1 — QA fix loop, INFO-1 (review docs/reviews/phase-ETH-E1-review.md).
--
-- Both confidentiality-clearance helpers carried an `is_admin()` grant arm that ADR
-- 0072 D5 never specified. QA verified it is INERT today: both are applied as an AND
-- conjunct AFTER `can_read_attachment` / `can_read_case`, neither of which grants
-- `platform_admin` (the vendor superuser is walled off from tenant data — §1 / ADR
-- 0041), so the first conjunct always denies first and the arm can never cause a read.
--
-- Dropping it is therefore a ZERO-behaviour-change removal of a latent footgun: if any
-- future arm ever gave `platform_admin` case reach, this would have silently become a
-- privileged-document grant (legal_privileged / credentialing_sensitive), which is
-- precisely what D5's grant-based clearance model is meant to prevent. Clearance now
-- rides case_access.max_confidentiality ONLY — one plane, no exceptions.
--
-- Bodies reproduced from 20260720001000 / 20260720001020 with ONLY the is_admin arm
-- removed. Forward-only; no schema change ⇒ `database.ts` unaffected.
-- =============================================================================

create or replace function app.attachment_confidentiality_ok(
  p_owner_type text, p_owner_id uuid, p_label text, p_uid uuid)
  returns boolean
  language plpgsql stable security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_case uuid;
begin
  if p_uid is null then
    return false;
  end if;
  -- O2: only these two labels gate above ordinary case-read; everything else passes.
  if p_label is null
     or p_label not in ('legal_privileged', 'credentialing_sensitive') then
    return true;
  end if;
  -- ⟵ INFO-1: the is_admin() bypass is GONE. Clearance rides case_access ONLY.
  -- Resolve the case that owns the clearance plane (case-scoped owners only).
  v_case := case p_owner_type
    when 'case' then p_owner_id
    when 'interview' then app.case_of_interview(p_owner_id)
    else null
  end;
  if v_case is null then
    return false;                                     -- gated label, no clearance plane: fail closed
  end if;
  return exists (
    select 1 from public.case_access ca
    where ca.case_id = v_case and ca.user_id = p_uid
      and (ca.expires_at is null or ca.expires_at > now())
      and ca.max_confidentiality is not null
      and app.confidentiality_rank(ca.max_confidentiality) >= app.confidentiality_rank(p_label)
  );
end;
$$;
comment on function app.attachment_confidentiality_ok(text, uuid, text, uuid) is
  'ADR 0072 D5 · E1 — the document confidentiality ceiling. true unless the label is '
  'legal_privileged/credentialing_sensitive (O2) AND the reader lacks a case_access '
  'clearance (max_confidentiality rank >= label). NO admin bypass (QA INFO-1): clearance '
  'rides case_access ONLY. Applied at open_attachment + the attachments SELECT policy '
  '(NOT inside can_read_attachment, which is owner-keyed and cannot see a row label).';
alter function app.attachment_confidentiality_ok(text, uuid, text, uuid) owner to postgres;
revoke all on function app.attachment_confidentiality_ok(text, uuid, text, uuid) from public;
grant execute on function app.attachment_confidentiality_ok(text, uuid, text, uuid) to authenticated, service_role;

create or replace function app.confidentiality_clearance_ok(p_case_id uuid, p_label text, p_uid uuid)
  returns boolean language plpgsql stable security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  if p_uid is null then
    return false;
  end if;
  if p_label is null
     or p_label not in ('legal_privileged', 'credentialing_sensitive') then
    return true;
  end if;
  -- ⟵ INFO-1: the is_admin() bypass is GONE. Clearance rides case_access ONLY.
  return exists (
    select 1 from public.case_access ca
    where ca.case_id = p_case_id and ca.user_id = p_uid
      and (ca.expires_at is null or ca.expires_at > now())
      and ca.max_confidentiality is not null
      and app.confidentiality_rank(ca.max_confidentiality) >= app.confidentiality_rank(p_label)
  );
end;
$$;
comment on function app.confidentiality_clearance_ok(uuid, text, uuid) is
  'ADR 0072 D5 · E1 — the clearance check given an already-resolved case (the interview '
  'ceiling''s half of the doc ceiling). NO admin bypass (QA INFO-1).';
alter function app.confidentiality_clearance_ok(uuid, text, uuid) owner to postgres;
revoke all on function app.confidentiality_clearance_ok(uuid, text, uuid) from public;
grant execute on function app.confidentiality_clearance_ok(uuid, text, uuid) to authenticated, service_role;
