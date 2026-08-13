-- =============================================================================
-- ETH·E2 (ADR 0073 D9) — BE-5: M2 professional-identity retention-pin + redaction.
--   The platform's FIRST professional-erasure path + a novel Class-2-identity trigger.
--   Amends ARCHITECTURE Rule 12's Class-2 erasure clause (ADR 0072 §7 → settled here).
--
-- guard_professional_linkage (verified live) interaction — the binding check:
--   • coherence CHECK professional_profiles_link_state_coherent:
--       (link_state = 'linked') = (user_id IS NOT NULL).
--   • guard's UPDATE path returns early when neither user_id NOR link_state changes
--       ("not a linkage change"), else RAISES HC0F2 if the profile is a LIVE
--       respondent_doctor ("o vínculo … está congelado").
--   ⇒ The PIN touches only retention_pinned_at/_reason → the early-return passes it
--     untouched (NO GUC needed). The REDACTION nulls user_id + sets link_state =
--     'no_account' → a linkage change that WOULD trip HC0F2 for a live respondent. So a
--     redaction-aware GUC exception `app.in_redaction_rpc` (mirroring app.in_meeting_rpc /
--     app.in_case_rpc) is added to the guard: it skips the freeze ONLY on the audited,
--     authority-gated, HC0J7-barred redaction path — the respondent-freeze is NOT
--     weakened for any ordinary linkage edit.
--
-- SQLSTATE (ADR 0073 D11): HC0J7 (a retention-pinned profile, OR a respondent in any
-- issued-decision case, cannot be redacted). HC000 (ethics flag OFF).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1 · retention-pin / redaction columns on professional_profiles.
-- -----------------------------------------------------------------------------
alter table public.professional_profiles
  add column if not exists retention_pinned_at timestamptz,   -- NULL = not pinned
  add column if not exists retention_pin_reason text,
  add column if not exists redacted_at timestamptz,
  add column if not exists redacted_by uuid references public.profiles(id);
comment on column public.professional_profiles.retention_pinned_at is
  'ADR 0073 D9 — set (once, idempotent) when an ethics case in which this profile is a '
  'respondent_doctor reaches an issued decision. A pinned profile is UN-erasable (CFM-'
  '1821/2007 20-yr defensibility overrides LGPD Art.18 — ADR 0035). HC0J7 guards it.';

create index if not exists professional_profiles_pinned_idx
  on public.professional_profiles (id) where retention_pinned_at is not null;

-- -----------------------------------------------------------------------------
-- 2 · guard_professional_linkage — add the app.in_redaction_rpc bypass. Re-emitted
--     VERBATIM from the live body + one early-return branch (the respondent-freeze,
--     INSERT derivation, and the linkage-change early-return are unchanged).
-- -----------------------------------------------------------------------------
create or replace function app.guard_professional_linkage()
  returns trigger language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  -- ON INSERT link_state is DERIVED (user_id ⇒ linked); unchanged from the shipped guard.
  if tg_op = 'INSERT' then
    if new.user_id is not null then
      new.link_state := 'linked';
    end if;
    return new;
  end if;

  -- ETH·E2 BE-5: the audited redact_professional_profile RPC is the ONE sanctioned path
  -- that nulls user_id + sets link_state='no_account' on a profile that may still hold a
  -- LIVE respondent_doctor link. It is independently gated (HC0J7 bars a pinned/issued-
  -- decision respondent), so the linkage-freeze must NOT block it — WITHOUT weakening the
  -- freeze for any ordinary linkage edit (mirrors app.in_meeting_rpc / app.in_case_rpc).
  if coalesce(current_setting('app.in_redaction_rpc', true), 'off') = 'on' then
    return new;
  end if;

  if new.user_id is not distinct from old.user_id
     and new.link_state is not distinct from old.link_state then
    return new;  -- not a linkage change; nothing to guard.
  end if;

  if exists (
    select 1
    from public.professional_participants pp
    join public.case_participants cp on cp.participant_id = pp.participant_id
    join public.case_participant_roles r on r.id = cp.role_id
    where pp.professional_profile_id = old.id
      and cp.removed_at is null
      and r.key = 'respondent_doctor'
  ) then
    raise exception
      'o vínculo deste profissional está congelado: ele é parte em um caso ativo'
      using errcode = 'HC0F2';
  end if;

  return new;
end;
$$;
alter function app.guard_professional_linkage() owner to postgres;

-- -----------------------------------------------------------------------------
-- 3 · app.trg_pin_respondent_retention — AFTER UPDATE on case_decisions. Pins every
--     respondent_doctor of the decision's case when the decision transitions INTO
--     'issued'. Base-table traversal (R6-safe). IDEMPOTENT: the SINGLE guard is the
--     UPDATE's `retention_pinned_at is null`; `if found` gates the audit to newly-pinned
--     rows only (a second issued decision re-runs the loop but pins/audits nothing).
-- -----------------------------------------------------------------------------
create or replace function app.trg_pin_respondent_retention()
  returns trigger language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  r record;
begin
  -- Only the transition INTO 'issued'.
  if new.status <> 'issued' or old.status = 'issued' then
    return new;
  end if;

  for r in
    select distinct prof.id as profile_id, prof.organization_id as org_id
    from public.case_participants cp
    join public.case_participant_roles rr on rr.id = cp.role_id
    join public.professional_participants pp on pp.participant_id = cp.participant_id
    join public.professional_profiles prof on prof.id = pp.professional_profile_id
    where cp.case_id = new.case_id
      and cp.removed_at is null
      and rr.key = 'respondent_doctor'
  loop
    update public.professional_profiles
      set retention_pinned_at = now(), retention_pin_reason = 'ethics_decision_issued'
    where id = r.profile_id and retention_pinned_at is null;
    if found then
      -- Rule 11: THAT + WHO + the profile id/org, NEVER the identity payload.
      perform app.audit_write('professional_profile.retention_pinned', 'professional_profile',
        r.profile_id, null, 'Perfil profissional protegido por retenção', '{}'::jsonb, r.org_id);
    end if;
  end loop;
  return new;
end;
$$;
alter function app.trg_pin_respondent_retention() owner to postgres;

create trigger trg_pin_respondent_retention
  after update on public.case_decisions
  for each row execute function app.trg_pin_respondent_retention();

-- -----------------------------------------------------------------------------
-- 4 · redact_professional_profile — the LGPD Art.18 erasure path (minimise, not destroy).
--     Coordinator/org-admin-gated (42501). HC0J7 if pinned OR a respondent in any
--     issued-decision case (belt). NULLs identity, PRESERVES the row + case_participants
--     linkage + audit — NEVER a DELETE. Sets link_state='no_account' (ruling; coherent
--     with the CHECK). Audited professional_profile.redacted (PHI-free).
-- -----------------------------------------------------------------------------
create or replace function public.redact_professional_profile(p_profile_id uuid, p_reason text)
  returns void language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_org uuid;
  v_pinned timestamptz;
begin
  perform app.assert_ethics_enabled();

  select organization_id, retention_pinned_at into v_org, v_pinned
  from public.professional_profiles where id = p_profile_id;
  if v_org is null then
    raise exception 'profissional não encontrado' using errcode = 'P0002';
  end if;

  -- Authority (distinct from the HC0J7 bar): coordinator / org-admin only.
  if not app.can_manage_professional(v_org, auth.uid()) then
    raise exception 'apenas a coordenação ou administração da organização pode eliminar dados profissionais'
      using errcode = '42501';
  end if;

  -- HC0J7 bar: retention-pinned, OR a respondent in ANY case with an issued decision
  -- (belt — holds even if the pin column were somehow clear).
  if v_pinned is not null or exists (
    select 1
    from public.case_participants cp
    join public.case_participant_roles rr on rr.id = cp.role_id
    join public.professional_participants pp on pp.participant_id = cp.participant_id
    join public.case_decisions cd on cd.case_id = cp.case_id
    where pp.professional_profile_id = p_profile_id
      and cp.removed_at is null
      and rr.key = 'respondent_doctor'
      and cd.status = 'issued'
  ) then
    raise exception 'perfil profissional protegido por retenção não pode ser eliminado'
      using errcode = 'HC0J7';
  end if;

  -- Minimise, not destroy. The GUC opens the linkage-freeze for THIS update only.
  perform set_config('app.in_redaction_rpc', 'on', true);
  update public.professional_profiles set
    full_name          = 'Profissional (dados removidos)',
    license_number     = null,
    license_region     = null,
    specialty          = null,
    professional_type  = null,
    affiliation_status = null,
    user_id            = null,
    link_state         = 'no_account',
    redacted_at        = now(),
    redacted_by        = auth.uid(),
    updated_at         = now()
  where id = p_profile_id;
  perform set_config('app.in_redaction_rpc', 'off', true);

  perform app.audit_write('professional_profile.redacted', 'professional_profile', p_profile_id, null,
    'Perfil profissional eliminado (minimização)', '{}'::jsonb, v_org);
end;
$$;
alter function public.redact_professional_profile(uuid, text) owner to postgres;
revoke all on function public.redact_professional_profile(uuid, text) from public;
grant execute on function public.redact_professional_profile(uuid, text) to authenticated, service_role;
