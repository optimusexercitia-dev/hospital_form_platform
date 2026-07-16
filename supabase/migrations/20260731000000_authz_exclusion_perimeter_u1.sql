-- =============================================================================
-- AUTHZ · EXCLUSION PERIMETER — Unit 1 (READ / ADMINISTER half). ADR 0078.
--
-- THE DEFECT (ADR 0072 restated). The hard deny `is_case_excluded` (=
-- `is_case_respondent OR is_recused_from_case`) lives INSIDE `can_read_case*`.
-- Every door that authorizes on case material WITHOUT routing a case-read /
-- exclusion predicate is outside the perimeter BY CONSTRUCTION. A recused
-- coordinator — who cannot read one byte of the case — could still administer
-- WHO ELSE reads it, and a recused member read the case-document bytes directly.
--
-- SCOPE — the READ / ADMINISTER seam only (the same seam that split the grant
-- door from A2). The CONTENT-WRITE DEFINER tail (`assign_narrative`,
-- `activate_phase`, … — proven leaking, e.g. `assign_narrative` SUCCEEDS for a
-- recused coordinator while `set_participant_patient` correctly raises HC0F1
-- because it carries `assert_not_case_excluded`) is Unit 2, closed behaviourally
-- per-RPC (a text sweep false-positived TWICE here, so it cannot be regex-closed).
--
-- WHAT SHIPS:
--   ①  grant_case_access / revoke_case_access / list_case_access
--        — add `assert_not_case_excluded` AFTER the authority gate (42501 first,
--          then HC0F1 — §7.1 structural defence, so an authority-less twin fails
--          loudly). A recused coordinator can no longer grant/revoke/list.
--   ②  create_interview (DEFINER RPC)  +  case_interviews_insert (RLS with_check)
--        — BOTH layers. The RPC alone is bypassable: `authenticated` holds table
--          INSERT, so a direct PostgREST INSERT walks around the DEFINER gate
--          (BUG-SUP-002). Guard the table too.
--   ③  storage — the LEGACY buckets. `case-documents` / `interview-attachments`
--          have NO product writer (all uploads route through `bucketForTier` →
--          `attachments`/`attachments-phi`, whose SELECT routes `can_read_attachment`
--          → `can_read_case`, already GUARDED). The leaky arm anchors on
--          `[1]=commission` and can NEVER resolve the case (wrong anchor, not a
--          missing AND). Since nothing legitimate READS these buckets via the
--          member arm (only referral snapshots read case-documents, via the OTHER
--          arm `can_read_snapshot_document`) and nothing WRITES them, the fix is to
--          REMOVE the dead arm — not route-through (a) (rests on an unverifiable
--          path convention for a dead bucket) nor add-exclusion (b) (nothing to
--          exclude from). Latent P1: reachability measured (bucket holds one seed
--          fixture, no writer), so this is closed before pilot, not an incident.
--
-- OUT (ruled correct, unchanged): `can_read_snapshot_document` (referral-scoped,
-- load-bearing for getReferralDocumentUrl); `can_read_attachment`/`can_write_attachment`
-- (case+interview arms already carry the deny); the PHI-participant doors and INVOKER
-- case-writers (RLS `cases`/`case_narratives` carry `AND NOT is_case_excluded`).
--
-- Forward-only. Functions re-emitted from LIVE pg_get_functiondef (not stale
-- migration text) + the one guard line. `create or replace` preserves ACLs.
-- =============================================================================

-- ① ── ACCESS ADMINISTRATION ─────────────────────────────────────────────────

create or replace function public.grant_case_access(
  p_case uuid, p_user uuid, p_level text,
  p_expires_at timestamptz default null, p_reason text default null)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_commission uuid;
begin
  perform app.assert_case_access_enabled();

  select commission_id into v_commission from public.cases where id = p_case;
  if v_commission is null then
    raise exception 'caso % não encontrado', p_case using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  -- EXCLUSION PERIMETER (Unit 1): recusal gates ADMINISTERING, not only reading.
  -- Authority (42501) is checked FIRST so a precondition-less twin fails loudly.
  perform app.assert_not_case_excluded(p_case);
  if p_level not in ('read', 'write') then
    raise exception 'nível de acesso inválido' using errcode = 'check_violation';
  end if;
  if not app.is_member_of_for(v_commission, p_user) then
    raise exception 'o responsável deve ser membro da comissão' using errcode = 'HC021';
  end if;
  if p_expires_at is not null and p_expires_at <= now() then
    raise exception 'a data de expiração deve ser futura' using errcode = 'check_violation';
  end if;

  perform app._grant_case_access_unchecked(p_case, p_user, p_level, p_expires_at, p_reason);
end;
$function$;

create or replace function public.revoke_case_access(p_case uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_commission uuid;
begin
  perform app.assert_case_access_enabled();

  select commission_id into v_commission from public.cases where id = p_case;
  if v_commission is null then
    raise exception 'caso % não encontrado', p_case using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  -- EXCLUSION PERIMETER (Unit 1): a recused coordinator cannot obstruct a grant
  -- on the case she is recused from.
  perform app.assert_not_case_excluded(p_case);

  delete from public.case_access where case_id = p_case and user_id = p_user;
end;
$function$;

create or replace function public.list_case_access(p_case uuid)
returns table(user_id uuid, level text, granted_at timestamptz, expires_at timestamptz, reason text)
language plpgsql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_commission uuid;
begin
  perform app.assert_case_access_enabled();

  select commission_id into v_commission from public.cases where id = p_case;
  if v_commission is null then
    raise exception 'caso % não encontrado', p_case using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  -- EXCLUSION PERIMETER (Unit 1): a recused coordinator cannot read the access
  -- roster of the case she is recused from.
  perform app.assert_not_case_excluded(p_case);

  return query
    select ca.user_id, ca.level, ca.granted_at, ca.expires_at, ca.reason
    from public.case_access ca
    where ca.case_id = p_case
    order by ca.granted_at;
end;
$function$;

-- ② ── INTERVIEW CREATION (both layers — BUG-SUP-002) ────────────────────────

create or replace function public.create_interview(
  p_case_id uuid, p_title text default null, p_case_phase_id uuid default null,
  p_interview_category text default null, p_confidentiality_level text default 'standard')
returns case_interviews
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_commission_id uuid;
  v_result public.case_interviews;
  v_attempt integer := 0;
begin
  perform app.assert_interviews_enabled();

  select commission_id into v_commission_id from public.cases where id = p_case_id;
  if v_commission_id is null then
    raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission_id) or app.is_commission_admin_of(v_commission_id)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  -- EXCLUSION PERIMETER (Unit 1): a recused coordinator cannot create an
  -- interview on the case she is recused from.
  perform app.assert_not_case_excluded(p_case_id);

  if p_interview_category is null
     or p_interview_category not in ('witness', 'subject', 'clinical_team', 'expert',
        'complainant', 'respondent', 'administrative', 'other') then
    raise exception 'informe uma categoria válida para a entrevista' using errcode = 'HC0B1';
  end if;

  perform set_config('app.in_interview_rpc', 'on', true);

  loop
    v_attempt := v_attempt + 1;
    begin
      insert into public.case_interviews
        (commission_id, case_id, case_phase_id, title, interview_category,
         confidentiality_level, created_by)
      values
        (v_commission_id, p_case_id, p_case_phase_id, nullif(btrim(p_title), ''),
         p_interview_category, coalesce(nullif(btrim(p_confidentiality_level), ''), 'standard'),
         auth.uid())
      returning * into v_result;
      exit;
    exception
      when unique_violation then
        if v_attempt >= 3 then raise; end if;
    end;
  end loop;

  perform set_config('app.in_interview_rpc', 'off', true);
  return v_result;
end;
$function$;

-- Direct-table guard: the RPC gate is bypassable because `authenticated` holds
-- INSERT on case_interviews. Mirror the exclusion on the RLS with_check so a raw
-- PostgREST INSERT cannot walk around the DEFINER (BUG-SUP-002).
alter policy case_interviews_insert on public.case_interviews
  with check (app.is_staff_admin_of(commission_id)
              and not app.is_case_excluded(case_id, auth.uid()));

-- ③ ── LEGACY STORAGE BUCKETS (remove the dead arm) ──────────────────────────

-- case-documents SELECT: drop the commission-anchored `is_member_of([1])` leak;
-- KEEP the referral-snapshot arm (correct-scoped, load-bearing).
drop policy if exists case_documents_select_member on storage.objects;
create policy case_documents_select_member on storage.objects
  for select to authenticated
  using (
    bucket_id = 'case-documents'
    and app.can_read_snapshot_document(name, (select auth.uid()))
  );

-- interview-attachments SELECT: the leaky `is_member_of([1])` arm was its ONLY
-- arm and NOTHING legitimately reads this bucket (interview attachments read via
-- the `attachments` bucket / the audited openAttachment door). Loser set = empty.
drop policy if exists interview_attachments_obj_select_member on storage.objects;

-- Legacy INSERT policies on the dead buckets: no product writer, and leaving the
-- commission-anchored INSERT open would let a hand-crafted storage POST re-light
-- the SELECT leak. Close both.
drop policy if exists case_documents_insert_staff_admin on storage.objects;
drop policy if exists interview_attachments_obj_insert_writable on storage.objects;
