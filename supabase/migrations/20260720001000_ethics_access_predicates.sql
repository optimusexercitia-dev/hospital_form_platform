-- =============================================================================
-- ETH·E1 (ADR 0072 D2/D3/D5) — BE-4: the m2 access-predicate core.
--
-- Adds respondent-exclusion + recusal-exclusion HARD-DENY terms (evaluated FIRST,
-- before every grant arm) to can_read_case / can_read_case_patient /
-- can_write_case_content, suppresses the flag-OFF member fallback for
-- explicit_grants_only cases, and adds the document confidentiality ceiling at the
-- attachment READ paths (open_attachment + the attachments SELECT policy).
--
-- R6 (ADR 0064): every participant/recusal-derived term is computed INSIDE a SECURITY
-- DEFINER helper over BASE tables — never an RLS-gated read of case_participants (which
-- would recurse). Identical pattern to the shipped can_read_professional_profile.
--
-- commission_default cases are BYTE-FOR-BYTE unchanged: the deny helpers short-circuit
-- false on empty participant/recusal tables, and the flag-OFF arm's else-branch is the
-- exact prior expression. Only the explicit_grants_only branch (a new cases column
-- defaulting to commission_default) is new.
--
-- New SQLSTATE (ADR 0072 D9): HC0E6 (attachment confidentiality ceiling — raised by
-- open_attachment below).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1 · Factored deny-term helpers (R6-safe, base-table traversal).
-- -----------------------------------------------------------------------------

-- The respondent traversal (ADR 0072 D2): p_uid is the user behind a respondent_doctor
-- participant of THIS case. DEFINER ⇒ bypasses RLS ⇒ no case_participants recursion.
create or replace function app.is_case_respondent(p_case_id uuid, p_uid uuid)
  returns boolean
  language sql stable security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
  select p_uid is not null and exists (
    select 1
    from public.case_participants cp
    join public.case_participant_roles r on r.id = cp.role_id
    join public.professional_participants pp on pp.participant_id = cp.participant_id
    join public.professional_profiles prof on prof.id = pp.professional_profile_id
    where cp.case_id = p_case_id
      and cp.removed_at is null
      and r.key = 'respondent_doctor'
      and prof.user_id = p_uid
  );
$$;
comment on function app.is_case_respondent(uuid, uuid) is
  'ADR 0072 D2 · E1 — true iff p_uid is the platform user behind a live respondent_doctor '
  'participant of the case. R6-safe (DEFINER over base tables). The m2 keystone: fed as a '
  'HARD-DENY term into can_read_case / _patient / can_write_case_content.';
alter function app.is_case_respondent(uuid, uuid) owner to postgres;
revoke all on function app.is_case_respondent(uuid, uuid) from public;
grant execute on function app.is_case_respondent(uuid, uuid) to authenticated, service_role;

-- A LIVE recusal (lifted_at is null) for (case, user). Base-table existence.
create or replace function app.is_recused_from_case(p_case_id uuid, p_uid uuid)
  returns boolean
  language sql stable security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
  select p_uid is not null and exists (
    select 1 from public.case_recusals cr
    where cr.case_id = p_case_id and cr.user_id = p_uid and cr.lifted_at is null
  );
$$;
comment on function app.is_recused_from_case(uuid, uuid) is
  'ADR 0072 D2 · E1 — true iff a LIVE case_recusals row exists for (case, user). HARD-DENY '
  'term in can_read_case / _patient / can_write_case_content.';
alter function app.is_recused_from_case(uuid, uuid) owner to postgres;
revoke all on function app.is_recused_from_case(uuid, uuid) from public;
grant execute on function app.is_recused_from_case(uuid, uuid) to authenticated, service_role;

-- Perf (ADR 0072 §6): the respondent traversal filters professional_profiles by user_id.
create index if not exists professional_profiles_user_id_idx
  on public.professional_profiles (user_id) where user_id is not null;

-- -----------------------------------------------------------------------------
-- 2 · can_read_case — + 2 hard-deny terms FIRST; explicit_grants_only suppression
--     of the flag-OFF member fallback. Every grant arm is preserved verbatim from
--     20260710000000 L569.
-- -----------------------------------------------------------------------------
create or replace function app.can_read_case(p_case_id uuid, p_uid uuid)
returns boolean
language plpgsql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_commission uuid;
begin
  select commission_id into v_commission from public.cases where id = p_case_id;
  if v_commission is null then
    return false;
  end if;

  -- ⟵E1 HARD DENY (evaluated FIRST, before every grant): a respondent or a recused
  -- user is denied even if some positive arm (staff_admin / grant / QPS) would grant.
  -- This is the m2 keystone — exclusion cannot be out-voted.
  if app.is_case_respondent(p_case_id, p_uid) then
    return false;
  end if;
  if app.is_recused_from_case(p_case_id, p_uid) then
    return false;
  end if;

  -- QPS macro-view of any referral-touched case — per-HOSPITAL (unchanged).
  if app.feature_enabled('case_referrals')
     and app.is_pqs_operator_of_for(app.hospital_of_commission(v_commission), p_uid)
     and exists (
       select 1 from public.case_referral r
       where r.source_case_id = p_case_id or r.target_case_id = p_case_id
     ) then
    return true;
  end if;

  if not app.feature_enabled('case_access') then
    -- ⟵E1 belt: an explicit_grants_only case must not leak to every member even with
    -- case_access OFF; coordinators keep read, plain members are dropped.
    if (select visibility_policy from public.cases where id = p_case_id) = 'explicit_grants_only' then
      return app.is_staff_admin_of_for(v_commission, p_uid)
          or app.is_commission_admin_of_for(v_commission, p_uid);
    end if;
    return app.is_member_of_for(v_commission, p_uid)
        or app.is_commission_admin_of_for(v_commission, p_uid);
  end if;

  return
    app.is_staff_admin_of_for(v_commission, p_uid)
    or app.is_commission_admin_of_for(v_commission, p_uid)
    or exists (
      select 1 from public.case_access ca
      where ca.case_id = p_case_id and ca.user_id = p_uid
        and (ca.expires_at is null or ca.expires_at > now())
    )
    or exists (
      select 1 from public.case_phases cp
      where cp.case_id = p_case_id and cp.assigned_to = p_uid
    )
    or exists (
      select 1 from public.case_narratives cn
      where cn.case_id = p_case_id and cn.assigned_to = p_uid
    );
end;
$$;
alter function app.can_read_case(uuid, uuid) owner to postgres;

-- -----------------------------------------------------------------------------
-- 3 · can_read_case_patient — same 2 deny-terms + explicit_grants_only suppression
--     (lead ruling BE-4 §c: defense-in-depth on the PHI door). Grant arms verbatim.
-- -----------------------------------------------------------------------------
create or replace function app.can_read_case_patient(p_case_id uuid, p_uid uuid)
returns boolean
language plpgsql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_commission uuid;
begin
  select commission_id into v_commission from public.cases where id = p_case_id;
  if v_commission is null then
    return false;
  end if;

  -- ⟵E1 HARD DENY (respondent must not reach the PHI door either; recused likewise).
  if app.is_case_respondent(p_case_id, p_uid) then
    return false;
  end if;
  if app.is_recused_from_case(p_case_id, p_uid) then
    return false;
  end if;

  -- QPS macro-view of any referral-touched case — per-HOSPITAL.
  if app.feature_enabled('case_referrals')
     and app.is_pqs_operator_of_for(app.hospital_of_commission(v_commission), p_uid)
     and exists (
       select 1 from public.case_referral r
       where r.source_case_id = p_case_id or r.target_case_id = p_case_id
     ) then
    return true;
  end if;

  if not app.feature_enabled('case_access') then
    -- ⟵E1 belt: explicit_grants_only PHI door → coordinators only, no member-wide read.
    if (select visibility_policy from public.cases where id = p_case_id) = 'explicit_grants_only' then
      return app.is_staff_admin_of_for(v_commission, p_uid);
    end if;
    return app.is_member_of_for(v_commission, p_uid);
  end if;

  return
    app.is_staff_admin_of_for(v_commission, p_uid)
    or exists (
      select 1 from public.case_access ca
      where ca.case_id = p_case_id and ca.user_id = p_uid
        and (ca.expires_at is null or ca.expires_at > now())
    )
    or exists (
      select 1 from public.case_phases cp
      where cp.case_id = p_case_id and cp.assigned_to = p_uid
    )
    or exists (
      select 1 from public.case_narratives cn
      where cn.case_id = p_case_id and cn.assigned_to = p_uid
    );
end;
$$;
alter function app.can_read_case_patient(uuid, uuid) owner to postgres;

-- -----------------------------------------------------------------------------
-- 4 · can_write_case_content — + the 2 hard-deny terms (ADR 0072 D3). Grant arms
--     verbatim from 20260708000000 L165.
-- -----------------------------------------------------------------------------
create or replace function app.can_write_case_content(p_case_id uuid, p_uid uuid)
returns boolean
language plpgsql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_commission uuid;
begin
  select commission_id into v_commission from public.cases where id = p_case_id;
  if v_commission is null then
    return false;
  end if;

  -- ⟵E1 HARD DENY: a recused or respondent user cannot WRITE case content either.
  if app.is_case_respondent(p_case_id, p_uid) then
    return false;
  end if;
  if app.is_recused_from_case(p_case_id, p_uid) then
    return false;
  end if;

  return
    app.is_staff_admin_of_for(v_commission, p_uid)
    or exists (
      select 1 from public.case_access ca
      where ca.case_id = p_case_id and ca.user_id = p_uid and ca.level = 'write'
        and (ca.expires_at is null or ca.expires_at > now())
    );
end;
$$;
alter function app.can_write_case_content(uuid, uuid) owner to postgres;

-- -----------------------------------------------------------------------------
-- 5 · Document confidentiality ceiling (ADR 0072 D5 / O2). can_read_attachment is
--     owner-keyed and cannot see a row's label (lead ruling BE-4 §d), so the ceiling
--     lives at the per-row read paths: open_attachment + the attachments SELECT policy.
--     Only legal_privileged + credentialing_sensitive gate above ordinary case-read;
--     clearance rides case_access.max_confidentiality (rank >= label). Grant-based:
--     even a coordinator needs a clearance grant (or admin) to open a gated document.
-- -----------------------------------------------------------------------------
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
  if coalesce(app.is_admin(), false) then
    return true;
  end if;
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
  'clearance (max_confidentiality rank >= label) — admin bypasses. Applied at '
  'open_attachment + the attachments SELECT policy (NOT inside can_read_attachment, '
  'which is owner-keyed and cannot see a row label).';
alter function app.attachment_confidentiality_ok(text, uuid, text, uuid) owner to postgres;
revoke all on function app.attachment_confidentiality_ok(text, uuid, text, uuid) from public;
grant execute on function app.attachment_confidentiality_ok(text, uuid, text, uuid) to authenticated, service_role;

-- 5a · open_attachment — add the ceiling AFTER the owner-auth gate. Body reproduced
--      verbatim from 20260717000200 L121 + the new HC0E6 check.
create or replace function public.open_attachment(p_id uuid)
  returns table(bucket text, path text)
  language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_row public.attachments;
begin
  perform app.assert_attachments_enabled();

  select * into v_row from public.attachments where id = p_id;
  if v_row.id is null then
    return;                                          -- not found
  end if;
  if v_row.deleted_at is not null then
    return;                                          -- soft-deleted: gone
  end if;
  if v_row.scan_status = 'infected' then
    return;                                          -- never serve an infected object
  end if;
  if not app.can_read_attachment(v_row.owner_type, v_row.owner_id, auth.uid()) then
    return;                                          -- NULL-out-of-scope: no row, no audit
  end if;
  -- ⟵E1 confidentiality ceiling: a known-id open of a gated document without clearance
  -- is a distinct, explicit denial (HC0E6) — contrast the list, which simply hides it.
  if not app.attachment_confidentiality_ok(
       v_row.owner_type, v_row.owner_id, v_row.confidentiality_label, auth.uid()) then
    raise exception 'sem autorização para abrir este documento confidencial'
      using errcode = 'HC0E6';
  end if;

  if v_row.sensitivity_tier = 'phi' then
    -- the single audited PHI open (Rule 11/12) — records THAT + WHO, never the blob.
    perform public.log_audit_access(
      'attachment.read', 'attachment', p_id,
      app.commission_of_attachment(v_row.owner_type, v_row.owner_id),
      'Anexo (PHI) aberto', '{}'::jsonb);
  end if;

  return query select v_row.storage_bucket, v_row.storage_path;
end;
$$;
alter function public.open_attachment(uuid) owner to postgres;
revoke all on function public.open_attachment(uuid) from public;
grant execute on function public.open_attachment(uuid) to authenticated, service_role;

-- 5b · attachments SELECT policy — add the ceiling so a gated doc is ABSENT from the
--      list for a below-clearance reader (Postgres has no CREATE OR REPLACE POLICY).
drop policy if exists attachments_select on public.attachments;
create policy attachments_select on public.attachments
  for select to authenticated
  using (
    app.can_read_attachment(owner_type, owner_id, auth.uid())
    and app.attachment_confidentiality_ok(owner_type, owner_id, confidentiality_label, auth.uid())
  );
