-- =========================================================================
-- FUP-0137-POSTSEND-PHI-AMEND-IS-DEAD — PO-ruled 2026-08-24, shape (a):
-- post-send PHI amendment on a referral is NOT intended. Make that a STATED
-- rule instead of an incidental one.
--
-- ⛔ WHAT WAS ACTUALLY WRONG. Nothing was reachable — and that was the problem.
-- `public.set_referral_patient` refused only `completed`/`rejected`/`withdrawn`
-- explicitly. For `sent` / `received` / `accepted` / `in_review` / … the door ran
-- all the way through the PHI upsert and only then hit its own last statement,
-- `update public.case_referral set has_patient = true`, which
-- `app.guard_referral_status` refuses with **HC070** for any non-`draft` referral
-- outside `app.in_referral_rpc`. The upsert rolled back with it.
--
-- Three things followed, all bad:
--   1. The caller was told *"mudanças de estado do encaminhamento devem passar
--      pelas RPCs"* — a sentence about STATUS TRANSITIONS — for a PHI edit. It
--      reads as a platform bug, not as a rule.
--   2. `app.can_amend_referral_phi_snapshot` (ADR 0078 D7) gated a branch that
--      could not complete for any status it was written for. The predicate only
--      ever governed `draft` re-saves, which is the one case it was NOT written
--      for, and a later reader would take it for live protection.
--   3. ⛔ THE CLOSURE WAS THREE OBJECTS AWAY FROM THE THING IT PROTECTED.
--      Nothing in `set_referral_patient` protected the MRN; a trigger placed
--      there for STATUS IMMUTABILITY did. `365` §1.2 red-proves that the single
--      obvious edit — adding `set_config('app.in_referral_rpc','on')` so
--      post-send amends "work" — blanks the LGPD erasure key (`have: NULL`).
--      An accidental guard is one refactor from being removed by someone who
--      cannot see what it is holding up.
--
-- WHAT THIS CHANGES: the door now refuses a non-`draft` referral ITSELF, before
-- any row is written, with its own authored HC078 and a message about PATIENT
-- DATA. Behaviour is otherwise identical — every call this refuses already
-- failed, it just failed later, by rollback, wearing the wrong sentence.
--
-- ⚠ AND THE MRN IS NOW PROTECTED BY THE DOOR, NOT BY A TRIGGER'S SIDE EFFECT.
-- Adding `in_referral_rpc` no longer opens the blanking hole, because the status
-- arm runs first. `365` §2.2 keeps pinning the absence of that flag as
-- defence-in-depth, but it is no longer the ONLY thing standing there.
--
-- ⛔ IF POST-SEND AMENDMENT IS EVER WANTED, this is the decision to reverse, and
-- reversing it is NOT just deleting the arm below: `365` §1.2 shows the flag
-- alone lets an amend that omits the MRN blank it. Build the MRN persistence
-- floor in the same change.
-- =========================================================================

create or replace function public.set_referral_patient(
  p_referral_id uuid,
  p_name text default null,
  p_mrn text default null,
  p_date_of_birth date default null,
  p_age_years integer default null,
  p_sex text default 'unknown',
  p_encounter_ref text default null,
  p_unit text default null,
  p_attending text default null
) returns void
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
  --
  -- ⚠ AUTHORITY IS CHECKED BEFORE STATUS, deliberately: a caller with no business
  -- touching this referral must not learn its lifecycle state from the refusal.
  --
  -- ⚠ Given the status arm below, `can_amend_referral_phi_snapshot` governs exactly
  -- one thing: re-saving PHI on a DRAFT. That is narrower than ADR 0078 D7's prose
  -- implies, and it is the rule as of the 2026-08-24 PO ruling — see the header.
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

  -- ⛔ THE PHI SNAPSHOT IS DRAFT-ONLY (FUP-0137-POSTSEND-PHI-AMEND-IS-DEAD, PO ruling
  -- 2026-08-24). Two messages, because they are two different facts to a coordinator:
  -- a terminal referral is over, a sent one is frozen. Both raise the door's OWN
  -- HC078 — never the status trigger's HC070, which talks about state transitions and
  -- is meaningless here.
  --
  -- ⛔ THIS ARM RUNS BEFORE THE UPSERT. That placement IS the protection: it is what
  -- stops a full-replace amend from blanking the MRN (the LGPD erasure key) on
  -- anything already sent. Moving it below the insert restores the old shape, in which
  -- the only thing standing between an omitted MRN and a blanked one was a status
  -- trigger firing on an unrelated statement.
  if v_status in ('completed', 'rejected', 'withdrawn') then
    raise exception 'encaminhamento concluído; os dados do paciente não podem mais ser alterados'
      using errcode = 'HC078';
  end if;
  if v_status <> 'draft' then
    raise exception 'encaminhamento já enviado; os dados do paciente não podem mais ser alterados'
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

comment on function app.can_amend_referral_phi_snapshot(uuid, uuid) is
  'ADR 0078 D7/F1: source-coordinator amend authority for an existing PHI snapshot. '
  '⚠ SCOPE, as of the FUP-0137-POSTSEND-PHI-AMEND-IS-DEAD PO ruling (2026-08-24): this '
  'governs ONLY re-saving PHI on a DRAFT referral. `public.set_referral_patient` refuses '
  'every non-draft status itself (HC078), so the post-send amend this predicate reads as '
  'authorising does not exist — post-send PHI amendment is NOT a product capability. Do '
  'not cite this function as evidence that a sent referral''s PHI can be corrected.';
