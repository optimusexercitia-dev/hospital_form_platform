-- =============================================================================
-- AUTHZ · M1 — EXCLUSION DURABILITY (ADR 0078 Amendment 4 / A29; review §W-6).
--
-- A0 + qa established that the program's central invariant — "no positive arm
-- can out-vote the hard-deny" — HOLDS and is BESIDE THE POINT: nothing stopped
-- the denied party from DELETING THE ROW THE DENY READS. This migration makes
-- the deny DURABLE. It buys exactly one thing (A29): the exclusion keystones
-- stop being vacuous.
--
-- SCOPE FENCE — exclusion durability ONLY. A21's admin-arm removal is EXCLUDED
-- (D4·3 requires the resolver first). No resolver, no case_access_grants, no
-- capability bitmask. A30 (the platform_admin arms) is BLOCKED pending an
-- exhaustive enumeration + a PO ruling, and is last in A29's order.
--
-- ⛔ DO NOT SWEEP the INVOKER RPCs (close_case / cancel_case / set_case_outcome
-- / update_case_narrative_body): prosecdef = f, so RLS already protects them.
-- Keystone 23 fails if the negatives over-reach (A32).
--
-- SQLSTATEs — the HC0F block. ⚠ DEVIATION FROM THE BRIEF, and the reason the
-- brief told me to collision-check: the prescribed HC0G0–HC0G9 block is ALREADY
-- OCCUPIED — HC0G0/HC0G1/HC0G2 belong to grant_role/revoke_role. HC0F was free
-- repo-wide and is adjacent to the HC0E case-participants family this work
-- extends.
--   HC0F0 — respondent linkage unresolved (B7 attach-time check)
--   HC0F1 — the actor is EXCLUDED from this case (the durability self-check)
--   HC0F2 — the professional linkage is frozen (load-bearing)
--   HC0F3 — case_participant_roles.key is immutable
--
-- ⭐ WHY HC0F1 IS A DISTINCT CODE FROM HC0E4 — this is a structural defence, not
-- cosmetics. Four times on this program a keystone was written whose principal
-- lacked the `staff_admin` precondition: the RPC then denied on AUTHORITY, the
-- test caught the exception, and it went GREEN while asserting NOTHING. Every
-- gate below therefore checks AUTHORITY FIRST (HC0E4) and EXCLUSION SECOND
-- (HC0F1). A twin that forgets the membership row now raises HC0E4 and FAILS.
-- The vacuous keystone is UNWRITABLE, not merely discouraged.
-- =============================================================================

-- =============================================================================
-- M1·1 — B7: respondent linkage. LANDS FIRST (A29): every gate below is
-- `AND NOT app.is_case_excluded(...)`, which is MEANINGLESS until
-- `is_case_respondent` resolves. is_case_respondent matches on
-- `professional_profiles.user_id = p_uid`, so a NULL user_id silently makes the
-- respondent NOT excluded — the gate passes for the very principal it must deny.
-- =============================================================================

alter table public.professional_profiles
  add column if not exists link_state text not null default 'unknown';

-- Backfill BEFORE the coherence CHECK: an existing user_id-bearing row is, by
-- definition, already resolved.
update public.professional_profiles set link_state = 'linked' where user_id is not null;

alter table public.professional_profiles
  drop constraint if exists professional_profiles_link_state_check;
alter table public.professional_profiles
  add constraint professional_profiles_link_state_check
  check (link_state in ('linked', 'no_account', 'unknown'));

-- The coherence invariant, enforced in the DB rather than by RPC etiquette:
--   linked     ⟺ user_id IS NOT NULL   (the deny resolves through this user)
--   no_account  ⇒ user_id IS NULL      (an audited human assertion: no account exists)
--   unknown     ⇒ user_id IS NULL      (fail-closed default: we do not know)
alter table public.professional_profiles
  drop constraint if exists professional_profiles_link_state_coherent;
alter table public.professional_profiles
  add constraint professional_profiles_link_state_coherent
  check ((link_state = 'linked') = (user_id is not null));

comment on column public.professional_profiles.link_state is
  'B7 (ADR 0078 A29). Whether this professional''s platform account is RESOLVED. '
  '`unknown` (default, fail-closed) = we do not know ⇒ CANNOT be attached as '
  'respondent_doctor, because app.is_case_respondent would silently not resolve. '
  '`linked` = user_id is set, the deny resolves. `no_account` = affirmed to have no '
  'platform account ⇒ the deny is VACUOUSLY satisfied. Frozen once load-bearing.';

-- ⚠ THE `ON DELETE SET NULL` RULING (A31·5 / A0 open ruling 5). I proved from
-- the catalog that this FK action is UNREACHABLE TODAY: `profiles.id → auth.users`
-- is ON DELETE RESTRICT and handle_new_user() guarantees a profiles row for every
-- auth user, so deleting an auth.users row ALWAYS fails on profiles_id_fkey before
-- professional_profiles.user_id is ever nulled (proven live: "update or delete on
-- table users violates foreign key constraint profiles_id_fkey").
--
-- So the hole is LATENT, not app-reachable — which makes the fail-closed choice
-- FREE, and that is why I am taking it rather than escalating. SET NULL is a
-- silent deny-dissolver the moment anyone relaxes profiles_id_fkey to CASCADE
-- (the conventional Supabase pattern!). RESTRICT removes that coupling, matches
-- the precedent profiles.id already sets for exactly this relationship, and
-- matches the retention-pinned posture update_professional_profile itself
-- documents ("No erasure path at E1 — ADR 0072 §7"). Offboarding is deactivation,
-- not deletion. ⛔ PO: this is reversible in one line if you disagree.
alter table public.professional_profiles
  drop constraint if exists professional_profiles_user_id_fkey;
alter table public.professional_profiles
  add constraint professional_profiles_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete restrict;

-- ---------------------------------------------------------------------------
-- The linkage freeze. ⭐ B7's OWN TRAP: adding a user_id write path (which A31·5
-- correctly says is REQUIRED, since update_professional_profile has none) creates
-- a SIXTH self-serving mutator of the exclusion plane unless the linkage freezes
-- once it is load-bearing. can_manage_professional admits any `staff_admin` in
-- the org — which is EXACTLY the precondition the respondent twin needs. Without
-- this trigger, M1·1 would hand back the hole M1·2 closes.
--
-- Invariant, not authority: it binds direct DML and every RPC alike, so no
-- in_case_rpc-style hatch is offered.
-- ---------------------------------------------------------------------------
create or replace function app.guard_professional_linkage()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
begin
  -- ⭐ ON INSERT link_state is DERIVED, not asserted. This is what the column
  -- actually is: user_id already tells us `linked`; the ONLY non-derivable bit is
  -- which of `unknown` / `no_account` applies when user_id IS NULL — and that bit
  -- is precisely the one a human must assert. Deriving it here keeps the strict
  -- coherence biconditional AND leaves every existing direct INSERT working
  -- (seed.sql, 207, 228, and create_professional_profile itself, which sets
  -- user_id and no link_state). Without this, a strict CHECK breaks all of them.
  if tg_op = 'INSERT' then
    if new.user_id is not null then
      new.link_state := 'linked';
    end if;
    -- (user_id NULL, link_state 'linked') stays incoherent and the CHECK rejects it.
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

drop trigger if exists trg_guard_professional_linkage on public.professional_profiles;
create trigger trg_guard_professional_linkage
  before insert or update on public.professional_profiles
  for each row execute function app.guard_professional_linkage();

-- ---------------------------------------------------------------------------
-- The resolution door. A31·5: `update_professional_profile` has NO user_id write
-- path, so `unknown → linked` had NO DOOR AT ALL — A20 is unimplementable as the
-- ADR specifies. This is that door. Kept OUT of update_professional_profile so
-- that routine LGPD Art. 18 corrections never touch the exclusion plane, and so
-- the existing signature (asserted by 228) stays stable.
-- ---------------------------------------------------------------------------
create or replace function public.set_professional_link_state(
  p_profile_id uuid,
  p_link_state text,
  p_user_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_org uuid;
begin
  perform app.assert_case_participants_enabled();

  select organization_id into v_org from public.professional_profiles where id = p_profile_id;
  if v_org is null then
    raise exception 'profissional não encontrado' using errcode = 'P0002';
  end if;

  if not app.can_manage_professional(v_org, auth.uid()) then
    raise exception 'apenas a coordenação ou administração da organização pode vincular profissionais'
      using errcode = '42501';
  end if;

  if p_link_state not in ('linked', 'no_account', 'unknown') then
    raise exception 'estado de vínculo inválido' using errcode = 'HC0F0';
  end if;
  if p_link_state = 'linked' and p_user_id is null then
    raise exception 'informe a conta do profissional para vinculá-lo' using errcode = 'HC0F0';
  end if;
  if p_link_state <> 'linked' and p_user_id is not null then
    raise exception 'somente o estado "linked" aceita uma conta' using errcode = 'HC0F0';
  end if;

  -- The freeze (HC0F2) is the trigger's job: it binds direct DML too, and putting
  -- the invariant in one place keeps this RPC about authority only.
  update public.professional_profiles
     set user_id    = case when p_link_state = 'linked' then p_user_id else null end,
         link_state = p_link_state,
         updated_at = now()
   where id = p_profile_id;

  -- Rule 11: record THAT + WHO, never the identity payload (Class-2 personal data).
  perform app.audit_write('professional_profile.link_state_changed', 'professional_profile',
    p_profile_id, null, 'Vínculo de conta do profissional alterado',
    jsonb_build_object('link_state', p_link_state), v_org);
end;
$$;

revoke all on function public.set_professional_link_state(uuid, text, uuid) from public;
grant execute on function public.set_professional_link_state(uuid, text, uuid) to authenticated;

comment on function public.set_professional_link_state(uuid, text, uuid) is
  'B7 (ADR 0078 A29 / A31·5). The account-linkage door update_professional_profile '
  'never had — `unknown → linked` was unreachable, so app.is_case_respondent could '
  'not resolve and every exclusion gate passed for the principal it must deny. '
  'Frozen once the profile is a live respondent (HC0F2) so this door cannot itself '
  'become a self-serving mutator of the exclusion plane.';

-- ---------------------------------------------------------------------------
-- The attach-time check. An `unknown` profile must never become a
-- respondent_doctor: is_case_respondent would silently not resolve for it, and
-- the deny would be decorative.
--
-- ⚠ SCOPE CORRECTION (mine, beyond §W-6's wording): §W-6 names ONLY
-- add_case_participant. That is a hole — set_case_participant_role can RE-KEY an
-- existing participant TO respondent_doctor, bypassing an attach-time check that
-- lives only in add_case_participant. Both doors carry it below.
-- ---------------------------------------------------------------------------
create or replace function app.assert_respondent_linkage_resolved(
  p_participant_id uuid,
  p_role_id uuid
)
returns void
language plpgsql
stable
security definer
set search_path = app, public, pg_catalog
as $$
begin
  if not exists (select 1 from public.case_participant_roles
                 where id = p_role_id and key = 'respondent_doctor') then
    return;  -- only the respondent role is load-bearing for the deny.
  end if;

  if exists (
    select 1
    from public.professional_participants pp
    join public.professional_profiles prof on prof.id = pp.professional_profile_id
    where pp.participant_id = p_participant_id
      and prof.link_state = 'unknown'
  ) then
    raise exception
      'resolva o vínculo de conta deste profissional antes de indicá-lo como denunciado'
      using errcode = 'HC0F0';
  end if;
end;
$$;

comment on function app.assert_respondent_linkage_resolved(uuid, uuid) is
  'B7. Refuses to seat a professional whose platform account is UNRESOLVED as '
  'respondent_doctor — app.is_case_respondent matches on professional_profiles.user_id, '
  'so an `unknown` respondent is silently NOT excluded from his own case.';

-- =============================================================================
-- M1·2 — the five exclusion-plane RPC mutators (A27). Each gains the deny.
--
-- ⛔ ORDER IS LOAD-BEARING: authority (HC0E4) FIRST, exclusion (HC0F1) SECOND.
-- See the HC0F1 note in the header — this is what makes the over-grant twins
-- falsifiable instead of vacuous.
-- =============================================================================

create or replace function public.lift_recusal(p_recusal_id uuid, p_reason_md text)
returns void
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_case_id uuid;
  v_commission uuid;
begin
  perform app.assert_case_participants_enabled();
  select cr.case_id, c.commission_id into v_case_id, v_commission
  from public.case_recusals cr
  join public.cases c on c.id = cr.case_id
  where cr.id = p_recusal_id and cr.lifted_at is null;
  if v_case_id is null then
    raise exception 'recusa não encontrada ou já suspensa' using errcode = 'HC0E1';
  end if;
  if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then
    raise exception 'apenas a coordenação pode suspender recusas deste caso'
      using errcode = 'HC0E4';
  end if;
  -- A27's headline: a recused coordinator lifted HER OWN recusal → is_case_excluded
  -- f → full reach, INCLUDING can_read_case_patient (D9: both arms are Rule 12 doors).
  if app.is_case_excluded(v_case_id, auth.uid()) then
    raise exception 'você está impedido neste caso e não pode exercer a coordenação sobre ele'
      using errcode = 'HC0F1';
  end if;
  update public.case_recusals
    set lifted_at = now(), lifted_by = auth.uid(), lift_reason_md = nullif(btrim(p_reason_md), '')
  where id = p_recusal_id;
  perform app.audit_write('case.recusal_lifted', 'case', v_case_id, v_commission,
    'Recusa suspensa no caso',
    jsonb_build_object('recusal_id', p_recusal_id));
end;
$$;

create or replace function public.remove_case_participant(p_case_participant_id uuid)
returns void
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_case_id uuid;
  v_commission uuid;
begin
  perform app.assert_case_participants_enabled();
  select cp.case_id, c.commission_id into v_case_id, v_commission
  from public.case_participants cp
  join public.cases c on c.id = cp.case_id
  where cp.id = p_case_participant_id and cp.removed_at is null;
  if v_case_id is null then
    raise exception 'participante não encontrado' using errcode = 'P0002';
  end if;
  if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then
    raise exception 'apenas a coordenação pode gerenciar participantes deste caso'
      using errcode = 'HC0E4';
  end if;
  -- A27: the respondent removed his OWN respondent_doctor row → is_case_respondent
  -- f → can_read_case_patient t → he read the PHI of the case in which he is the
  -- accused. Proven live in A0 (PROBE 3), rolled back.
  if app.is_case_excluded(v_case_id, auth.uid()) then
    raise exception 'você está impedido neste caso e não pode exercer a coordenação sobre ele'
      using errcode = 'HC0F1';
  end if;
  update public.case_participants set removed_at = now() where id = p_case_participant_id;
  perform app.audit_write('case.participant_removed', 'case', v_case_id, v_commission,
    'Participante removido do caso',
    jsonb_build_object('case_participant_id', p_case_participant_id));
end;
$$;

create or replace function public.set_case_participant_role(p_case_participant_id uuid, p_role_id uuid)
returns void
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_case_id uuid;
  v_commission uuid;
  v_ptype text;
  v_participant_id uuid;
  v_role_types text[];
begin
  perform app.assert_case_participants_enabled();
  select cp.case_id, c.commission_id, p.participant_type, cp.participant_id
    into v_case_id, v_commission, v_ptype, v_participant_id
  from public.case_participants cp
  join public.cases c on c.id = cp.case_id
  join public.participants p on p.id = cp.participant_id
  where cp.id = p_case_participant_id and cp.removed_at is null;
  if v_case_id is null then
    raise exception 'participante não encontrado' using errcode = 'P0002';
  end if;
  if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then
    raise exception 'apenas a coordenação pode gerenciar participantes deste caso'
      using errcode = 'HC0E4';
  end if;
  -- A27: re-keying his own row off respondent_doctor dissolves the deny just as
  -- surely as removing it.
  if app.is_case_excluded(v_case_id, auth.uid()) then
    raise exception 'você está impedido neste caso e não pode exercer a coordenação sobre ele'
      using errcode = 'HC0F1';
  end if;
  select allowed_participant_types into v_role_types from public.case_participant_roles where id = p_role_id;
  if v_role_types is null then
    raise exception 'papel inválido' using errcode = 'P0002';
  end if;
  if not (v_ptype = any (v_role_types)) then
    raise exception 'papel de participante inválido para o tipo de participante'
      using errcode = 'HC0E3';
  end if;
  -- B7: re-keying TO respondent_doctor is an attach — it needs the same linkage
  -- check add_case_participant carries, or it is a bypass of it.
  perform app.assert_respondent_linkage_resolved(v_participant_id, p_role_id);
  update public.case_participants set role_id = p_role_id where id = p_case_participant_id;
  perform app.audit_write('case.participant_role_changed', 'case', v_case_id, v_commission,
    'Papel do participante alterado',
    jsonb_build_object('case_participant_id', p_case_participant_id, 'role_id', p_role_id));
end;
$$;

create or replace function public.set_primary_subject(p_case_participant_id uuid)
returns void
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_case_id uuid;
  v_commission uuid;
begin
  perform app.assert_case_participants_enabled();
  select cp.case_id, c.commission_id into v_case_id, v_commission
  from public.case_participants cp
  join public.cases c on c.id = cp.case_id
  where cp.id = p_case_participant_id and cp.removed_at is null;
  if v_case_id is null then
    raise exception 'participante não encontrado' using errcode = 'P0002';
  end if;
  if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then
    raise exception 'apenas a coordenação pode gerenciar participantes deste caso'
      using errcode = 'HC0E4';
  end if;
  -- ⚠ A GATE fix, NOT a durability fix (§W-6): is_case_respondent does NOT read
  -- is_primary_subject, so this door cannot dissolve the deny. It is a CO-LOCATED
  -- defect — an excluded principal exercising coordinator authority — and its
  -- keystone must assert the gate, or it cannot falsify.
  if app.is_case_excluded(v_case_id, auth.uid()) then
    raise exception 'você está impedido neste caso e não pode exercer a coordenação sobre ele'
      using errcode = 'HC0F1';
  end if;
  begin
    update public.case_participants set is_primary_subject = true where id = p_case_participant_id;
  exception when unique_violation then
    raise exception 'não é possível definir mais de um sujeito principal ativo'
      using errcode = 'HC0E7';
  end;
  perform app.audit_write('case.primary_subject_set', 'case', v_case_id, v_commission,
    'Sujeito principal definido',
    jsonb_build_object('case_participant_id', p_case_participant_id));
end;
$$;

-- record_recusal — ⭐ THE ONE THAT MUST NOT GET A BLANKET TERM.
-- §W-6 says "follow record_recusal's shape"; its shape is the self-vs-other
-- split, and that split is exactly what must survive. Recusal is MONOTONICALLY
-- RESTRICTIVE: it can only ADD a deny, never remove one. Denying an excluded
-- party the ability to restrict herself further is not a security gain — it is a
-- regression, and it would be one this suite's positive twin catches. So the
-- exclusion term binds the COORDINATOR arm ONLY.
--
-- ⚠ And note the reach gate must keep using the RAW coordinator check: gating
-- reach on the excluded-aware value would deny an excluded coordinator P0002
-- ("caso não encontrado") and she could not even self-recuse.
-- ⚠ The DEFAULTs below are load-bearing: dropping one silently breaks every
-- caller that omits the argument (42P13 on replace). Preserved verbatim from
-- pg_get_function_arguments, not from the migration files (which are stale here
-- by design — several rewrite bodies via pg_get_functiondef+replace+execute).
create or replace function public.record_recusal(
  p_case_id uuid,
  p_user_id uuid,
  p_reason_md text,
  p_conflict_declaration_id uuid default null::uuid
)
returns uuid
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_commission uuid;
  v_is_coord_raw boolean;
  v_excluded boolean;
  v_source text;
  v_id uuid;
begin
  perform app.assert_case_participants_enabled();
  select commission_id into v_commission from public.cases where id = p_case_id;
  if v_commission is null then
    raise exception 'caso não encontrado' using errcode = 'P0002';
  end if;

  -- ⟵ QA MAJOR-2 REACH GATE (preserved verbatim in effect). A caller with no
  -- reach gets the same not-found posture as a non-existent case. RAW on purpose:
  -- see the note above — an excluded coordinator must still reach her own recusal.
  v_is_coord_raw := app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission);
  if not (v_is_coord_raw or app.can_read_case(p_case_id, auth.uid())) then
    raise exception 'caso não encontrado' using errcode = 'P0002';
  end if;

  v_excluded := app.is_case_excluded(p_case_id, auth.uid());

  -- Authority: a NON-EXCLUDED coordinator may recuse ANOTHER member; anyone with
  -- reach (excluded or not) may recuse THEMSELVES.
  if p_user_id = auth.uid() then
    v_source := 'self';
  elsif v_is_coord_raw and not v_excluded then
    v_source := 'coordinator';
  elsif v_is_coord_raw and v_excluded then
    raise exception 'você está impedido neste caso e não pode exercer a coordenação sobre ele'
      using errcode = 'HC0F1';
  else
    raise exception 'apenas a coordenação pode registrar recusas deste caso'
      using errcode = 'HC0E4';
  end if;

  begin
    insert into public.case_recusals
      (case_id, user_id, reason_md, source, conflict_declaration_id, recused_by)
    values
      (p_case_id, p_user_id, nullif(btrim(p_reason_md), ''),
       case when p_conflict_declaration_id is not null then 'conflict' else v_source end,
       p_conflict_declaration_id, auth.uid())
    returning id into v_id;
  exception when unique_violation then
    raise exception 'recusa já registrada para este usuário neste caso'
      using errcode = 'HC0E0';
  end;

  if p_conflict_declaration_id is not null then
    update public.case_conflict_declarations
      set status = 'recused', resolved_at = now(), resolved_by = auth.uid()
    where id = p_conflict_declaration_id and case_id = p_case_id;
  end if;

  perform app.audit_write('case.recusal_recorded', 'case', p_case_id, v_commission,
    'Recusa registrada no caso',
    jsonb_build_object('user_id', p_user_id, 'source', v_source));
  return v_id;
end;
$$;

-- add_case_participant — the deny + B7's attach-time check.
create or replace function public.add_case_participant(
  p_case_id uuid,
  p_participant_id uuid,
  p_role_id uuid,
  p_is_primary_subject boolean default false,
  p_involvement_summary text default null::text
)
returns uuid
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_case public.cases;
  v_role_types text[];
  v_ptype text;
  v_new uuid;
begin
  perform app.assert_case_participants_enabled();
  select * into v_case from public.cases where id = p_case_id;
  if v_case.id is null then
    raise exception 'caso não encontrado' using errcode = 'P0002';
  end if;
  if not (app.is_staff_admin_of(v_case.commission_id) or app.is_commission_admin_of(v_case.commission_id)) then
    raise exception 'apenas a coordenação pode gerenciar participantes deste caso'
      using errcode = 'HC0E4';
  end if;
  if app.is_case_excluded(p_case_id, auth.uid()) then
    raise exception 'você está impedido neste caso e não pode exercer a coordenação sobre ele'
      using errcode = 'HC0F1';
  end if;
  select allowed_participant_types into v_role_types from public.case_participant_roles where id = p_role_id;
  select participant_type into v_ptype from public.participants where id = p_participant_id;
  if v_role_types is null or v_ptype is null then
    raise exception 'papel ou participante inválido' using errcode = 'P0002';
  end if;
  if not (v_ptype = any (v_role_types)) then
    raise exception 'papel de participante inválido para o tipo de participante'
      using errcode = 'HC0E3';
  end if;

  -- B7: refuse to seat an UNRESOLVED professional as the respondent.
  perform app.assert_respondent_linkage_resolved(p_participant_id, p_role_id);

  begin
    insert into public.case_participants
      (case_id, participant_id, role_id, is_primary_subject, involvement_summary, added_by)
    values
      (p_case_id, p_participant_id, p_role_id, coalesce(p_is_primary_subject, false),
       nullif(btrim(p_involvement_summary), ''), auth.uid())
    returning id into v_new;
  exception when unique_violation then
    if coalesce(p_is_primary_subject, false) then
      raise exception 'não é possível definir mais de um sujeito principal ativo'
        using errcode = 'HC0E7';
    end if;
    raise;
  end;

  perform app.audit_write('case.participant_added', 'case', p_case_id, v_case.commission_id,
    'Participante adicionado ao caso',
    jsonb_build_object('participant_id', p_participant_id, 'role_id', p_role_id));
  return v_new;
end;
$$;

-- =============================================================================
-- M1·3 — case_participant_roles: the 6th exclusion-plane table (D1).
--
-- A0's A27 matrix: this is the ONLY deny-read table that fails ALL FOUR legs —
-- authenticated=arwd (direct DML grants) · 1 FOR ALL write policy · 0 triggers ·
-- NO RPC door writes `key`. So an org_admin (or platform_admin via is_admin())
-- re-keys `respondent_doctor` ORG-WIDE, over direct DML, WITH NO AUDIT ROW, and
-- THE RESPONDENT NEVER ACTS (A0 PROBE 5: 161 → 161). Rule 11 has a hole here.
--
-- The fix shape is an UPDATE-FREEZE ON `key`, NOT a write-freeze: qa verified the
-- premise in BOTH directions — 0 functions UPDATE this table, and
-- set_participant_patient INSERTs an `affected_patient` role row, so a blanket
-- write-freeze BREAKS PATIENT REGISTRATION (§W-5).
--
-- The freeze is UNCONDITIONAL rather than "once referenced": it costs nothing
-- (catalog-verified — nothing UPDATEs `key`), it cannot be raced, and DELETE of a
-- referenced role is ALREADY blocked by case_participants_role_id_fkey (NO ACTION).
-- Fixing a typo'd key on an UNREFERENCED role remains possible via DELETE+INSERT.
-- =============================================================================

create or replace function app.guard_case_participant_role_key()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
begin
  if new.key is distinct from old.key then
    raise exception
      'a chave do papel de participante é imutável (o impedimento do caso depende dela)'
      using errcode = 'HC0F3';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_case_participant_role_key on public.case_participant_roles;
create trigger trg_guard_case_participant_role_key
  before update on public.case_participant_roles
  for each row execute function app.guard_case_participant_role_key();

-- Rule 11: the table has NO RPC door, so the permitted path IS direct DML under
-- the FOR ALL policy — which means the audit can ONLY come from a trigger. Today
-- the mutation is invisible to the audit trail entirely (A0 D2a: 161 → 161).
create or replace function app.audit_case_participant_role()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_row public.case_participant_roles := coalesce(new, old);
begin
  perform app.audit_write(
    'case_participant_role.' || lower(tg_op),
    'case_participant_role', v_row.id, null,
    'Papel de participante de caso alterado',
    jsonb_build_object('key', v_row.key, 'op', tg_op),
    v_row.organization_id);
  return null;
end;
$$;

drop trigger if exists trg_audit_case_participant_role on public.case_participant_roles;
create trigger trg_audit_case_participant_role
  after insert or update or delete on public.case_participant_roles
  for each row execute function app.audit_case_participant_role();

comment on function app.guard_case_participant_role_key() is
  'ADR 0078 M1·3. case_participant_roles.key is read by app.is_case_respondent, and '
  'this table is the ONLY deny-read table with direct authenticated DML grants and no '
  'RPC door. Re-keying it dissolved the exclusion ORG-WIDE, unaudited, without the '
  'respondent acting at all (A0 PROBE 5). UPDATE-freeze, not write-freeze: '
  'set_participant_patient INSERTs here and must keep working.';
