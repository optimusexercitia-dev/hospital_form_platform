-- ADR 0078 D7 / F1 defect ②: the referral_patient snapshot WRITE was gated on
-- `app.can_read_referral_phi`, which OR-s `app.referral_target_analyst` — so a
-- receiving-side reader (any unexpired case_access grant / phase / narrative assignment
-- on the TARGET case) could OVERWRITE the transmitted patient identity, the one thing a
-- disclosure snapshot exists to make immutable. This migration:
--   (a) re-gates the write on SOURCE-coordinator disclosure/amend authority (read never
--       implies write), and
--   (b) takes `public.set_referral_patient` OFF the public API (REVOKE authenticated),
--       leaving it a private DEFINER helper behind a NEW source-coord-gated public door
--       `public.save_referral_patient`.
-- `referral_patient` keeps its single-door posture (RLS on / 0 policies / no authenticated
-- DML) — both functions write as the DEFINER owner. Body re-emitted from the live
-- pg_get_functiondef (ADR 0078 A28) with ONLY the entitlement gate swapped.

create or replace function public.set_referral_patient(
  p_referral_id uuid,
  p_name text default null::text,
  p_mrn text default null::text,
  p_date_of_birth date default null::date,
  p_age_years integer default null::integer,
  p_sex text default 'unknown'::text,
  p_encounter_ref text default null::text,
  p_unit text default null::text,
  p_attending text default null::text)
 returns void
 language plpgsql
 security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_status text;
  v_exists boolean;
begin
  perform app.assert_referrals_enabled();

  select status into v_status from public.case_referral where id = p_referral_id;
  if v_status is null then
    raise exception 'encaminhamento não encontrado' using errcode = 'P0002';
  end if;

  -- ADR 0078 D7 defect ②: WRITE authority is SOURCE-coordinator only. A brand-new
  -- snapshot requires disclosure authority; amending an existing one requires amend
  -- authority (both source-coordinator for F-min). NEVER a target-side reader/analyst:
  -- read (can_read_referral_phi) must not imply write.
  select exists (select 1 from public.referral_patient where referral_id = p_referral_id)
    into v_exists;
  if v_exists then
    if not app.can_amend_referral_phi_snapshot(p_referral_id, auth.uid()) then
      raise exception 'você não pode alterar os dados do paciente neste encaminhamento'
        using errcode = 'HC078';
    end if;
  else
    if not app.can_manage_referral_phi_disclosure(p_referral_id, auth.uid()) then
      raise exception 'você não pode registrar dados do paciente neste encaminhamento'
        using errcode = 'HC078';
    end if;
  end if;

  if v_status in ('completed', 'rejected', 'withdrawn') then
    raise exception 'encaminhamento concluído; os dados do paciente não podem mais ser alterados'
      using errcode = 'HC078';
  end if;
  if p_sex is not null and p_sex not in ('female', 'male', 'other', 'unknown') then
    raise exception 'sexo inválido' using errcode = 'check_violation';
  end if;

  insert into public.referral_patient (
    referral_id, name, mrn, date_of_birth, age_years, sex, encounter_ref, unit, attending
  ) values (
    p_referral_id, p_name, p_mrn, p_date_of_birth, p_age_years, coalesce(p_sex, 'unknown'),
    p_encounter_ref, p_unit, p_attending
  )
  on conflict (referral_id) do update
  set name = excluded.name, mrn = excluded.mrn, date_of_birth = excluded.date_of_birth,
      age_years = excluded.age_years, sex = excluded.sex,
      encounter_ref = excluded.encounter_ref, unit = excluded.unit,
      attending = excluded.attending, updated_at = now();

  update public.case_referral set has_patient = true, updated_at = now() where id = p_referral_id;
end;
$function$;

-- (b) set_referral_patient LEAVES the public API. It survives only as a private DEFINER
--     helper; the named exploit entrypoint is gone (defense in depth on top of the gate).
revoke execute on function public.set_referral_patient(uuid, text, text, date, integer, text, text, text, text) from public;
revoke execute on function public.set_referral_patient(uuid, text, text, date, integer, text, text, text, text) from authenticated;

comment on function public.set_referral_patient(uuid, text, text, date, integer, text, text, text, text) is
  'ADR 0078 D7/F1: PRIVATE DEFINER write helper for the referral PHI snapshot. Gated on source-coordinator disclosure/amend authority. NOT on the public API (authenticated EXECUTE revoked) — callers use public.save_referral_patient.';

-- The public, source-coordinator-gated door the application calls. Delegates ALL gating
-- to the private helper above (single source of truth). NEW public.* RPC → REVOKE PUBLIC
-- before GRANT authenticated (project rule).
create or replace function public.save_referral_patient(
  p_referral_id uuid,
  p_name text default null::text,
  p_mrn text default null::text,
  p_date_of_birth date default null::date,
  p_age_years integer default null::integer,
  p_sex text default 'unknown'::text,
  p_encounter_ref text default null::text,
  p_unit text default null::text,
  p_attending text default null::text)
 returns void
 language plpgsql
 security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
begin
  perform public.set_referral_patient(
    p_referral_id, p_name, p_mrn, p_date_of_birth, p_age_years, p_sex,
    p_encounter_ref, p_unit, p_attending);
end;
$function$;

revoke all on function public.save_referral_patient(uuid, text, text, date, integer, text, text, text, text) from public;
grant execute on function public.save_referral_patient(uuid, text, text, date, integer, text, text, text, text) to authenticated, service_role;

comment on function public.save_referral_patient(uuid, text, text, date, integer, text, text, text, text) is
  'ADR 0078 D7/F1: public door for the SOURCE coordinator to write/amend the referral PHI snapshot. Delegates gating to public.set_referral_patient (source-coordinator disclosure/amend). Read never implies write.';
