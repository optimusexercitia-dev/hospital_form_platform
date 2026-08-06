-- AFF W2 / T2.1 — the affiliation doors, as an ACTOR KERNEL + two thin wrappers.
--
-- ADR 0097 D13 + ADR 0098 §W2.1. `authenticated` holds no DML on
-- `hospital_affiliations` (20260909000100), because a write that grants read access to
-- a person's profile is an authorization mutation regardless of its HR clothing.
--
-- ⚠ WHY A KERNEL AND NOT ONE DOOR. `registerUser` runs on the SERVICE-ROLE client and
-- has no `auth.uid()`. A single `auth.uid()`-only door would therefore leave the
-- bypass on the path that creates MOST affiliations, and D13's tenant check would
-- never run there — the recorded lesson being that a guard placed where only one
-- caller passes through it is not a guard. The precedent is exact:
-- `app.grant_role_impl` (kernel, `{postgres=X}` only) + `public.grant_role`
-- (`auth.uid()` wrapper, authenticated) + `public.grant_role_for` (explicit actor,
-- service_role). This mirrors that shape verbatim, including the ACLs — the kernel is
-- executable by NOBODY but its owner, so no caller can hand it a forged `p_actor`.
--
-- ⚠ EVERY refusal lives in the KERNEL. Nothing is checked in a wrapper.
--
-- ⚠ SELF-AFFILIATION IS ALLOWED, DELIBERATELY. Unlike a role grant it confers no
-- capability — affiliation is a visibility input only (D2) — and an administrator
-- absent from their own hospital's roster is a bug, not a safeguard. Do NOT add a
-- self-grant guard here by analogy with `grant_role_impl`: that guard exists because a
-- role grant is a capability, and this is not one.

-- ---------------------------------------------------------------------------
-- T2.1a — the affiliate kernel.
-- ---------------------------------------------------------------------------
create or replace function app.affiliate_person_impl(
  p_actor       uuid,
  p_user        uuid,
  p_hospital    uuid,
  p_employee_id text default null,
  p_started_on  date default null
)
returns uuid
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_org        uuid;
  v_person_org uuid;
  v_existing   uuid;
  v_id         uuid;
  v_emp        text := nullif(btrim(coalesce(p_employee_id, '')), '');
begin
  if p_actor is null then
    raise exception 'ator não identificado' using errcode = '42501';
  end if;

  v_org := app.org_of_hospital(p_hospital);
  if v_org is null then
    raise exception 'hospital inexistente' using errcode = 'check_violation';
  end if;

  -- AUTHORITY (D13). No `is_admin_for` arm: platform_admin administers tenancy and
  -- identity, but no decision of record extends that to employment rows.
  if not (app.is_org_admin_of_for(v_org, p_actor)
          or app.is_hospital_admin_of_for(p_hospital, p_actor)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  -- TENANT CHECK (D13) — the check `resolveOrInviteUser` was missing. A person may
  -- only be affiliated inside the organisation they are anchored to.
  --
  -- ⚠ "not found" and "wrong organisation" are DELIBERATELY the same error. Splitting
  -- them would make this door a cross-tenant existence oracle over `profiles.id` for
  -- any hospital admin of any tenant — the recorded TV lesson that a DEFINER helper is
  -- safe to CALL and unsafe to REPORT THROUGH.
  select home_organization_id into v_person_org from public.profiles where id = p_user;
  if v_person_org is null or v_person_org is distinct from v_org then
    raise exception 'pessoa não pertence a esta organização' using errcode = 'HC0R0';
  end if;

  -- Idempotent by (person, hospital) over the ACTIVE row: the partial unique index
  -- would reject a duplicate anyway, and a 23505 reaching the caller as a generic
  -- pt-BR error is a worse answer than the intended one.
  select id into v_existing
  from public.hospital_affiliations
  where principal_id = p_user and hospital_id = p_hospital and ended_on is null;

  if v_existing is not null then
    update public.hospital_affiliations
       set hospital_employee_id = coalesce(v_emp, hospital_employee_id)
     where id = v_existing;
    return v_existing;
  end if;

  insert into public.hospital_affiliations
    (principal_id, organization_id, hospital_id, hospital_employee_id, started_on, created_by)
  values
    (p_user, v_org, p_hospital, v_emp, coalesce(p_started_on, current_date), p_actor)
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- T2.1b — the end kernel. Refuses while the person holds ACTIVE seats of ANY tier
-- under the hospital (D5 / audit MEDIUM-3): a governance platform must not orphan a
-- sitting technical director as a side effect of an HR action. A commission-only
-- check would do exactly that.
-- ---------------------------------------------------------------------------
create or replace function app.end_affiliation_impl(
  p_actor    uuid,
  p_user     uuid,
  p_hospital uuid,
  p_ended_on date default null
)
returns uuid
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_org      uuid;
  v_id       uuid;
  v_started  date;
  v_end      date := coalesce(p_ended_on, current_date);
  v_blockers jsonb;
begin
  if p_actor is null then
    raise exception 'ator não identificado' using errcode = '42501';
  end if;

  v_org := app.org_of_hospital(p_hospital);
  if v_org is null then
    raise exception 'hospital inexistente' using errcode = 'check_violation';
  end if;

  if not (app.is_org_admin_of_for(v_org, p_actor)
          or app.is_hospital_admin_of_for(p_hospital, p_actor)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  select id, started_on into v_id, v_started
  from public.hospital_affiliations
  where principal_id = p_user and hospital_id = p_hospital and ended_on is null;

  if v_id is null then
    -- Not an existence oracle: the caller has already proven authority OVER THIS
    -- HOSPITAL, so "nobody by that id works here" is information they already hold.
    raise exception 'vínculo ativo não encontrado' using errcode = 'HC0R2';
  end if;

  -- ANY TIER. Hospital-tier rows carry `hospital_id` directly; commission-tier rows
  -- carry `organization_id IS NULL` and resolve through `commissions.hospital_id`
  -- (`memberships_scope_shape`). An EXPIRED seat is not an active seat.
  select jsonb_agg(jsonb_build_object('role', x.role, 'commission', x.commission_name)
                   order by x.role, x.commission_name)
    into v_blockers
  from (
    select m.role, c.name as commission_name
    from public.memberships m
    left join public.commissions c on c.id = m.commission_id
    where m.principal_id = p_user
      and coalesce(m.hospital_id, c.hospital_id) = p_hospital
      and (m.expires_at is null or m.expires_at > now())
  ) x;

  if v_blockers is not null then
    raise exception 'não é possível encerrar o vínculo: a pessoa ainda ocupa funções ativas neste hospital'
      using errcode = 'HC0R1', detail = v_blockers::text;
  end if;

  if v_end < v_started then
    raise exception 'data de encerramento anterior ao início do vínculo'
      using errcode = 'HC0R3';
  end if;

  update public.hospital_affiliations
     set ended_on = v_end, ended_by = p_actor
   where id = v_id;

  return v_id;
end;
$$;

-- The kernels are callable by their OWNER ONLY — never by authenticated or
-- service_role. That is what makes `p_actor` unforgeable: the only way in is through a
-- wrapper below, and each wrapper decides the actor itself.
revoke all on function app.affiliate_person_impl(uuid, uuid, uuid, text, date) from public;
revoke all on function app.end_affiliation_impl(uuid, uuid, uuid, date) from public;

-- ---------------------------------------------------------------------------
-- The wrappers. Every new public.* RPC: REVOKE ALL FROM PUBLIC *before* GRANT, or the
-- dashboard t19 / anon-execute guards fail.
-- ---------------------------------------------------------------------------
create or replace function public.affiliate_person(
  p_user        uuid,
  p_hospital    uuid,
  p_employee_id text default null,
  p_started_on  date default null
)
returns uuid
language sql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  select app.affiliate_person_impl((select auth.uid()), p_user, p_hospital, p_employee_id, p_started_on);
$$;

create or replace function public.affiliate_person_for(
  p_actor       uuid,
  p_user        uuid,
  p_hospital    uuid,
  p_employee_id text default null,
  p_started_on  date default null
)
returns uuid
language sql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  select app.affiliate_person_impl(p_actor, p_user, p_hospital, p_employee_id, p_started_on);
$$;

create or replace function public.end_affiliation(
  p_user     uuid,
  p_hospital uuid,
  p_ended_on date default null
)
returns uuid
language sql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  select app.end_affiliation_impl((select auth.uid()), p_user, p_hospital, p_ended_on);
$$;

create or replace function public.end_affiliation_for(
  p_actor    uuid,
  p_user     uuid,
  p_hospital uuid,
  p_ended_on date default null
)
returns uuid
language sql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  select app.end_affiliation_impl(p_actor, p_user, p_hospital, p_ended_on);
$$;

revoke all on function public.affiliate_person(uuid, uuid, text, date) from public;
revoke all on function public.affiliate_person_for(uuid, uuid, uuid, text, date) from public;
revoke all on function public.end_affiliation(uuid, uuid, date) from public;
revoke all on function public.end_affiliation_for(uuid, uuid, uuid, date) from public;

grant execute on function public.affiliate_person(uuid, uuid, text, date) to authenticated;
grant execute on function public.end_affiliation(uuid, uuid, date) to authenticated;
-- The `_for` twins take an explicit actor and are therefore SERVICE-ROLE ONLY: an
-- `authenticated` grant here would let any signed-in user name any actor. Exactly the
-- ACL split `grant_role_for` carries.
grant execute on function public.affiliate_person_for(uuid, uuid, uuid, text, date) to service_role;
grant execute on function public.end_affiliation_for(uuid, uuid, uuid, date) to service_role;

comment on function public.affiliate_person(uuid, uuid, text, date) is
  'ADR 0097 D13. Affiliate a person to a hospital. Self-affiliation is ALLOWED and that is deliberate — affiliation confers no capability, and an admin absent from their own roster is a bug. All refusals live in app.affiliate_person_impl.';
comment on function public.affiliate_person_for(uuid, uuid, uuid, text, date) is
  'Service-role twin of affiliate_person, taking an explicit actor (ADR 0098 W2.1). Exists because registerUser runs with no auth.uid(); without it the door would be bypassed on the path that creates most affiliations.';
comment on function public.end_affiliation(uuid, uuid, date) is
  'ADR 0097 D5. Soft-ends an affiliation. REFUSES (HC0R1) while the person holds active seats of ANY tier under the hospital — commission AND hospital tier — with the blockers returned in the error DETAIL as JSON.';
comment on function public.end_affiliation_for(uuid, uuid, uuid, date) is
  'Service-role twin of end_affiliation, taking an explicit actor (ADR 0098 W2.1). Required by the W3/T3.3 affiliation-management action, which runs on the service client.';

-- ---------------------------------------------------------------------------
-- RULING 2 — the delete guard, and the audit arm that makes a bypass visible.
--
-- ADR 0097 D4 says "never DELETE"; until now that was a convention with no
-- constraint. Two things verified live rather than reasoned about:
--
--  * `profiles` carries `guard_profile_no_delete`, so the
--    `principal_id -> profiles(id) ON DELETE CASCADE` path is UNREACHABLE in origin
--    mode — the parent delete raises first. Probed: `delete from public.profiles`
--    raises from that guard.
--  * Under `session_replication_role = replica` the FK cascade does NOT fire either:
--    probed, the parent row deletes and the affiliation row is left ORPHANED (count 1).
--    That is the recorded lesson — replica mode is the SAME switch for the immutability
--    guards and for Postgres's RI triggers. `supabase/demo/reset-revisao-prontuario.sql`
--    runs in exactly that mode, which is why this migration ships with an explicit
--    affiliation delete added to that file.
--
-- So the guard is `tgenabled = 'O'` (the default), mirroring `guard_profile_no_delete`
-- EXACTLY. An `ENABLE ALWAYS` guard would break the demo reset, which is a legitimate
-- superuser teardown — verified by reading it, not assumed.
--
-- ⚠ Which makes a DELETE arm on the audit trigger DEAD CODE unless that trigger is
-- ALWAYS: in origin mode the BEFORE guard raises before any AFTER trigger runs, and in
-- replica mode neither fires. The audit trigger is therefore promoted to ENABLE ALWAYS,
-- so the ONLY mode in which a hard delete can happen is the mode in which it is
-- recorded. An unreachable branch would have satisfied the letter of "add a DELETE arm"
-- and none of its intent.
-- ---------------------------------------------------------------------------
create or replace function app.guard_affiliation_no_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception 'vínculos hospitalares não são excluídos; encerre com end_affiliation (ADR 0097 D4)'
    using errcode = 'check_violation';
end;
$$;

revoke all on function app.guard_affiliation_no_delete() from public;

create trigger guard_affiliation_no_delete_trg
  before delete on public.hospital_affiliations
  for each row execute function app.guard_affiliation_no_delete();

create or replace function app.trg_audit_hospital_affiliations()
returns trigger
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_row     public.hospital_affiliations;
  v_action  text;
  v_summary text;
begin
  if tg_op = 'INSERT' then
    v_row     := new;
    v_action  := 'affiliation.created';
    v_summary := 'Vínculo hospitalar criado';
  elsif tg_op = 'DELETE' then
    -- Reachable ONLY under session_replication_role = replica (see the header): the
    -- BEFORE guard raises first in every other mode. This arm exists so that the one
    -- window in which D4 can be violated is not also invisible.
    v_row     := old;
    v_action  := 'affiliation.deleted';
    v_summary := 'Vínculo hospitalar EXCLUÍDO (contrário à ADR 0097 D4)';
  else
    -- Only the transition active -> ended is an event. A matrícula or date edit is
    -- not (same discipline as trg_audit_memberships' title_id-only update).
    if new.ended_on is not null and old.ended_on is null then
      v_row     := new;
      v_action  := 'affiliation.ended';
      v_summary := 'Vínculo hospitalar encerrado';
    else
      return null;
    end if;
  end if;

  perform app.audit_write(
    v_action, 'hospital_affiliation', v_row.id, null, v_summary,
    jsonb_build_object(
      'user_id',         v_row.principal_id,
      'organization_id', v_row.organization_id,
      'hospital_id',     v_row.hospital_id
    ),
    v_row.organization_id, v_row.hospital_id);

  return null;
end;
$$;

drop trigger if exists trg_audit_hospital_affiliations on public.hospital_affiliations;
create trigger trg_audit_hospital_affiliations
  after insert or update or delete on public.hospital_affiliations
  for each row execute function app.trg_audit_hospital_affiliations();

alter table public.hospital_affiliations
  enable always trigger trg_audit_hospital_affiliations;
