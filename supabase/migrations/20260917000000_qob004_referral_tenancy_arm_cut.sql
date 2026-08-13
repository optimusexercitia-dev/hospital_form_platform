-- BUG-QOB-004 — CUT the referral-plane tenancy arms.
--
-- PO ruling 2026-08-09: CUT-the-DB-arms, following the ratified D5 precedent verbatim
-- ("a principal with zero PHI bits does not destroy Rule 12 data" — the same reasoning
-- that put `dispose_case_phi` on the CUT side of the Q1–Q9 classification). QO·B's UI
-- half already 404s a bare tenancy admin on `encaminhamentos/**`; this makes the DB
-- agree instead of leaving an authorized door nothing can reach.
--
-- POPULATION — derived from the live catalog BY PROPERTY, never from a remembered list.
-- Two sweeps, both run before this file was written:
--   (a) functions whose prosrc names `is_commission_admin_of` (the bare regex also
--       matches the `_for` variant — \y would NOT, it fails before `_`) AND touches the
--       referral plane  → 5 hits;
--   (b) every function whose NAME is referral-scoped, arms extracted → 69 hits.
-- Intersecting and classifying leaves EXACTLY THREE in scope. The two (a)-hits excluded
-- are excluded for a RATIFIED reason, not for convenience:
--   · app._audit_access_authorized — its tenancy arms sit on the AUDIT branches; the
--     referral branches delegate to can_read_referral_phi with no tenancy arm. Audit is
--     ruling ② KEEP (audit_log is on the §4.5 KEEP list).
--   · app._case_caps — its v_orgadmin arm confers `manage_case_access` ONLY (S2), the
--     case-ACCESS KEEP ratified 2026-08-08. Its referral branch (S6) gates on
--     is_pqs_operator_of_for, carrying no tenancy arm at all.
-- ZERO policies on the 13 referral-plane relations carry a tenancy arm, so the whole cut
-- is function-side; no policy is touched. No other tenancy helper (is_org_admin_of /
-- is_hospital_admin_of) reaches the plane.
--
-- CONSEQUENCE, stated plainly because it is a real narrowing: neither disposal door has
-- ever carried a staff_admin arm, so after this cut referral-PHI disposal is reachable
-- ONLY by a PQS operator of the source or target hospital. That is coherent with D5 (a
-- PQS operator holds PHI bits; a bare tenancy admin holds none) but it is a capability
-- reduction, not a no-op.
--
-- CREATE OR REPLACE throughout — never DROP+CREATE, which silently drops the ACL.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1/3 · can_dispose_referral_phi — the read-side probe behind the UI affordance.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.can_dispose_referral_phi(p_referral_id uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
  select
    -- ⬅ ADR 0078 A35 / M2 removed the platform-admin bypass; BUG-QOB-004 (PO ruling
    -- 2026-08-09) removed the tenancy tier. What remains is the NSP arm on either side.
    --
    -- ⚠ THIS COMMENT DELIBERATELY DOES NOT SPELL EITHER REMOVED ARM, and the convention
    -- is load-bearing rather than stylistic: this file's own postcondition greps prosrc,
    -- and prosrc INCLUDES comments. A previous author wrote the literal call into this
    -- comment and their catalog self-check then matched the COMMENT instead of an arm —
    -- the same false positive that inflated the A30 census (its "42" was really 40;
    -- three "matches" were comments documenting a removal). `text is not truth` holds
    -- for the text you write while removing the text. Sibling helpers dodge it the same
    -- way — see attachment_confidentiality_ok.
    exists (
      select 1 from public.case_referral r
      where r.id = p_referral_id
        and (
          app.is_pqs_operator_of(app.hospital_of_commission(r.source_commission_id))
          or app.is_pqs_operator_of(app.hospital_of_commission(r.target_commission_id))
        )
    );
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2/3 · dispose_referral_phi — the destructive door itself.
-- The pt-BR message moves WITH the arm: it promised "um administrador da organização ou
-- o NSP", and after this cut only the NSP qualifies. Leaving it would ship a user-facing
-- sentence that is simply false (Rule 10), and it is invisible to every gate that does
-- not read it.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.dispose_referral_phi(p_referral_id uuid, p_reason text)
 returns void
 language plpgsql
 security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_referral public.case_referral;
  v_redacted constant text := '[PHI removido]';
begin
  perform app.assert_referrals_enabled();

  if not (app.is_pqs_operator_of(app.hospital_of_commission((select source_commission_id from public.case_referral where id = p_referral_id)))
          or app.is_pqs_operator_of(app.hospital_of_commission((select target_commission_id from public.case_referral where id = p_referral_id)))) then
    raise exception 'apenas o NSP pode descartar dados do paciente'
      using errcode = '42501';
  end if;
  if p_reason is null or p_reason not in
       ('retention_expired', 'subject_request', 'entered_in_error', 'duplicate', 'other') then
    raise exception 'motivo de descarte inválido' using errcode = 'check_violation';
  end if;
  select * into v_referral from public.case_referral where id = p_referral_id;
  if v_referral.id is null then
    raise exception 'encaminhamento não encontrado' using errcode = 'P0002';
  end if;
  if v_referral.phi_disposed_at is not null then
    raise exception 'os dados do paciente deste encaminhamento já foram descartados'
      using errcode = 'HC056';
  end if;

  perform set_config('app.in_safety_rpc', 'on', true);
  perform set_config('app.in_referral_rpc', 'on', true);
  perform set_config('app.phi_dispose_reason', p_reason, true);

  delete from public.referral_patient where referral_id = p_referral_id;

  update public.case_referral
     set subject = v_redacted, description_md = null, decline_note = null
   where id = p_referral_id;
  update public.referral_reply set result_md = null where referral_id = p_referral_id;
  update public.referral_shared_item
     set frozen_title = v_redacted,
         frozen_body_md = case when frozen_body_md is not null then v_redacted else frozen_body_md end
   where referral_id = p_referral_id;
  update public.referral_reply_attachment set title = v_redacted where referral_id = p_referral_id;
  -- RV2 R1: message bodies are PHI (NOT NULL → redact to the marker).
  update public.referral_messages set body = v_redacted where referral_id = p_referral_id;
  -- RV2 R3: the resolution narrative is PHI — purge it.
  update public.referral_resolutions set summary_md = null where referral_id = p_referral_id;
  -- RV2 R5: internal-note bodies are PHI (NOT NULL → redact to the marker).
  update public.referral_internal_notes set body = v_redacted where referral_id = p_referral_id;

  update public.case_referral
     set has_patient = false, phi_disposed_at = now(), phi_disposed_by = auth.uid(),
         phi_disposed_reason = p_reason, updated_at = now()
   where id = p_referral_id;

  perform app.audit_write(
    'referral_patient.disposed', 'referral_patient', p_referral_id, v_referral.source_commission_id,
    'Dados do paciente do encaminhamento ' || v_referral.code || ' descartados',
    jsonb_build_object('reason', p_reason));

  perform set_config('app.in_safety_rpc', 'off', true);
  perform set_config('app.in_referral_rpc', 'off', true);
end;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3/3 · create_referral_draft — the compose-draft affordance.
-- Its HC071 message already reads "apenas a coordenação da comissão de origem", which
-- was an OVERSTATEMENT while the tenancy arm was live and becomes exactly true now. No
-- text change needed; recorded so the absence of one is a finding, not an oversight.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.create_referral_draft(p_source_case_id uuid, p_target_commission_id uuid, p_referral_type_id uuid, p_subject text, p_response_expected boolean default null::boolean, p_description_md text default null::text, p_priority text default 'routine'::text, p_requested_action_id uuid default null::uuid, p_response_due_at timestamp with time zone default null::timestamp with time zone, p_parent_referral_id uuid default null::uuid, p_target_hospital_id uuid default null::uuid)
 returns case_referral
 language plpgsql
 security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_source_commission uuid;
  v_source_hospital uuid;
  v_target_type text;
  v_type public.referral_types;
  v_response_expected boolean;
  v_parent public.case_referral;
  v_row public.case_referral;
begin
  perform app.assert_referrals_enabled();

  select commission_id into v_source_commission from public.cases where id = p_source_case_id;
  if v_source_commission is null then
    raise exception 'caso não encontrado' using errcode = 'no_data_found';
  end if;
  if not app.is_staff_admin_of_for(v_source_commission, auth.uid()) then
    raise exception 'apenas a coordenação da comissão de origem pode encaminhar o caso'
      using errcode = 'HC071';
  end if;

  -- EXACTLY ONE target, resolved before anything else uses it (D7). Stated as a
  -- two-sided test so neither "both" nor "neither" can slip through.
  if (p_target_commission_id is not null) = (p_target_hospital_id is not null) then
    raise exception 'informe exatamente um destino: uma comissão ou a direção técnica'
      using errcode = 'check_violation';
  end if;
  v_target_type := case when p_target_hospital_id is not null
                        then 'technical_director' else 'commission' end;

  if v_target_type = 'technical_director' then
    perform app.assert_technical_director_enabled();

    -- THE SAME-HOSPITAL RULE. The DT is technically responsible for the committees of
    -- ONE hospital; a committee of another hospital has no standing to address it, and
    -- admitting one would hand that DT the PHI of a hospital they are not responsible
    -- for.
    select hospital_id into v_source_hospital from public.commissions where id = v_source_commission;
    if p_target_hospital_id is distinct from v_source_hospital then
      raise exception 'a comissão só pode encaminhar à direção técnica do seu próprio hospital'
        using errcode = 'HC071';
    end if;
  else
    if v_source_commission = p_target_commission_id then
      raise exception 'a comissão de destino deve ser diferente da origem' using errcode = 'check_violation';
    end if;
    if not exists (select 1 from public.commissions where id = p_target_commission_id) then
      raise exception 'comissão de destino não encontrada' using errcode = 'no_data_found';
    end if;
    if app.org_of_commission(v_source_commission) is distinct from app.org_of_commission(p_target_commission_id) then
      raise exception 'o encaminhamento deve permanecer dentro da mesma organização'
        using errcode = 'check_violation';
    end if;
  end if;

  if btrim(coalesce(p_subject, '')) = '' then
    raise exception 'informe um assunto para o encaminhamento' using errcode = 'check_violation';
  end if;

  select * into v_type from public.referral_types where id = p_referral_type_id;
  if v_type.id is null or not v_type.is_active then
    raise exception 'tipo de encaminhamento inválido' using errcode = 'check_violation';
  end if;
  v_response_expected := coalesce(p_response_expected, v_type.default_response_expected);

  -- RV2 R2: PHI-free triage. Past-due → HC0A4; requested-action snapshot resolved.
  perform app.assert_referral_due_future(p_response_due_at);

  -- RV2 R3: parent lineage (ADR 0037 D15). Must exist, be same-organization, and be
  -- readable by the creator. The pointer is stored; NOTHING is copied from the parent.
  if p_parent_referral_id is not null then
    select * into v_parent from public.case_referral where id = p_parent_referral_id;
    if v_parent.id is null then
      raise exception 'encaminhamento de origem (lineage) não encontrado' using errcode = 'HC0A6';
    end if;
    if app.org_of_commission(v_parent.source_commission_id)
         is distinct from app.org_of_commission(v_source_commission) then
      raise exception 'o encaminhamento vinculado deve pertencer à mesma organização'
        using errcode = 'HC0A6';
    end if;
    if not app.can_read_referral_metadata(p_parent_referral_id, auth.uid()) then
      raise exception 'sem acesso ao encaminhamento vinculado' using errcode = 'HC0A6';
    end if;
  end if;

  insert into public.case_referral (
    source_case_id, source_commission_id, target_commission_id, referral_type_id,
    type_label, subject, description_md, response_expected, created_by,
    priority, requested_action_id, requested_action_label, response_due_at,
    parent_referral_id, target_type, target_hospital_id
  ) values (
    p_source_case_id, v_source_commission, p_target_commission_id, v_type.id,
    v_type.label, btrim(p_subject), nullif(btrim(coalesce(p_description_md, '')), ''),
    v_response_expected, auth.uid(),
    coalesce(nullif(btrim(coalesce(p_priority, '')), ''), 'routine'),
    p_requested_action_id, app.resolve_requested_action_label(p_requested_action_id),
    p_response_due_at,
    p_parent_referral_id, v_target_type, p_target_hospital_id
  )
  returning * into v_row;

  return v_row;
end;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- POSTCONDITION — asserts CORRESPONDENCE TO ENUMERATED NAMES, never a count.
--
-- QO·B's twice-proven lesson: a CUT executed by enumeration diverged from the ratified
-- list at two levels, and both times the postcondition validated a SIZE rather than a
-- correspondence. So this block names every function on both sides and checks each one:
--   · the three CUT doors must EXIST (non-vacuity — a typo'd name would otherwise pass
--     the negative assertion trivially) and must NOT carry the tenancy arm;
--   · their SURVIVING arms must still be present (no over-cut);
--   · no OTHER referral-named function may carry a tenancy arm (no leftover, no
--     regression) — derived from the catalog at runtime, not transcribed.
-- The regex is bare on purpose: `is_commission_admin_of` also matches the `_for`
-- variant. `\y` would NOT — the word boundary fails before `_`, which has already made
-- one sweep blind to every `_for` call site in this repo.
-- ─────────────────────────────────────────────────────────────────────────────
do $post$
declare
  v_cut constant text[] := array[
    'can_dispose_referral_phi', 'dispose_referral_phi', 'create_referral_draft'
  ];
  v_name text;
  v_src  text;
  v_leak text;
begin
  foreach v_name in array v_cut loop
    select p.prosrc into v_src
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = v_name;

    if v_src is null then
      raise exception 'QOB004 postcondition: public.% does not exist — the CUT list names a function the catalog does not have', v_name;
    end if;
    if v_src ~ 'is_commission_admin_of' then
      raise exception 'QOB004 postcondition: public.% still carries the tenancy arm', v_name;
    end if;
  end loop;

  -- No over-cut: each door must retain the arm that survives the ruling.
  select p.prosrc into v_src from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'can_dispose_referral_phi';
  if v_src !~ 'is_pqs_operator_of' then
    raise exception 'QOB004 postcondition: can_dispose_referral_phi lost its NSP arm (over-cut)';
  end if;

  select p.prosrc into v_src from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'dispose_referral_phi';
  if v_src !~ 'is_pqs_operator_of' then
    raise exception 'QOB004 postcondition: dispose_referral_phi lost its NSP arm (over-cut)';
  end if;

  select p.prosrc into v_src from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'create_referral_draft';
  if v_src !~ 'is_staff_admin_of_for' then
    raise exception 'QOB004 postcondition: create_referral_draft lost its coordinator arm (over-cut)';
  end if;

  -- Nothing else on the referral plane may carry a tenancy arm. Domain derived live.
  select string_agg(n.nspname || '.' || p.proname, ', ' order by p.proname) into v_leak
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where p.proname ~ '(referral|encaminh)'
     and p.prosrc ~ 'is_commission_admin_of';
  if v_leak is not null then
    raise exception 'QOB004 postcondition: referral-named function(s) still carry a tenancy arm: %', v_leak;
  end if;

  -- And no referral-plane POLICY may acquire one (there were zero before this file).
  select string_agg(tablename || '.' || policyname, ', ' order by tablename, policyname) into v_leak
    from pg_policies
   where tablename ~ '(referral|encaminh)'
     and (coalesce(qual, '') || coalesce(with_check, '')) ~ 'is_commission_admin_of';
  if v_leak is not null then
    raise exception 'QOB004 postcondition: referral-plane policy(ies) carry a tenancy arm: %', v_leak;
  end if;
end
$post$;
