-- AFF4 B4 (increment 3 of 3) — the five new doors and the self-only person record.
-- ADR 0151 D2/D3/D5/D7/D8/D11/D14.
--
-- ⚠ EVERY MUTATION DOOR IS AN ACTOR-KERNEL TRIPLE (ADR 0098 §W2.1). The shape IS the
-- security property, not a convention:
--     app.*_impl   owner-only (`postgres=X`)  — takes an EXPLICIT actor, so anyone able to
--                                               call it could name someone else as actor.
--     public.*     authenticated + service    — the `auth.uid()` wrapper; the actor is the
--                                               session, not an argument.
--     public.*_for service_role ONLY          — the service twin. ⛔ `authenticated` must
--                                               NEVER hold EXECUTE on a `_for`.
-- `app` has no default ACL, so a new function there inherits PUBLIC EXECUTE; every impl
-- carries an explicit revoke below.
--
-- SQLSTATE budget. Reused where the semantics are identical, so the pt-BR mapper does not
-- grow a synonym per door: 42501 authority · HC0R0 wrong organisation · HC0R2 not found /
-- not yours · HC0R3 date order · HC0R4 deactivated account. New, from the reserved block:
--     HC0R6  org offboarding refused — active ties remain (blockers in DETAIL)
--     HC0R7  a void with no reason
--     HC0R8  already voided
--     HC0R9  void refused — a membership was EVER attached under that scope
--     HC0RA  void refused — hospital affiliations still recorded in the organisation
-- Per ADR 0152 D4 no P-class code is used for an authored refusal: `HC***` answers HTTP
-- 400, `42501` answers 403.
--
-- ⛔ ORACLE-KILL, and it is why several refusals look duplicated. In both void doors
-- "row does not exist" and "row exists but is not yours" raise the SAME code with the SAME
-- message, byte-identical. Splitting them would turn either door into a cross-tenant
-- existence oracle over affiliation ids for any admin of any tenant. The refusals read as
-- redundant precisely because they must not be distinguishable.
--
-- ⚠ `get_own_person_record` DELIBERATELY HAS NO `_for` TWIN, and no `_impl`. It takes NO
-- target parameter and keys on `auth.uid()`, so "self-only" is a property of its SHAPE
-- rather than of a check a later edit could weaken. A `get_own_person_record_for(p_actor)`
-- would by definition be "fetch any person's column-locked fields" — the exact door this
-- design exists to not build. Prose cannot defend a deliberate absence, so pgTAP asserts
-- the twin does not exist in the catalog.
--
-- ⚠ Types are `text`, never `extensions.citext`, in every signature and return column
-- here. The COLUMNS stay citext; but a citext parameter or return type must resolve
-- against the SESSION search_path at CREATE time, which is the 42704 that hit
-- 20260911000600 on the remote db-push role after six migrations had already landed.
--
-- NOT IN THIS MIGRATION, deliberately: the D4 containment BACKSTOP trigger. It lands after
-- B5's backfill — before that backfill it would reject legitimate writes against
-- pre-existing hospital affiliations that have no org parent yet.
--
-- Proof: supabase/tests/379_org_affiliation_doors.sql (authority grids, every refusal arm,
-- the no-`_for`-twin assertion, and the D6 expired-seat differential).

-- =============================================================================================
-- 1. affiliate_person_to_org — D2 (org_admin only), D11 (cross-org conflated with not-found)
-- =============================================================================================

create function app.affiliate_person_to_org_impl(
  p_actor uuid, p_user uuid, p_organization uuid, p_started_on date default null)
returns uuid
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_person_org    uuid;
  v_person_active boolean;
  v_existing      uuid;
  v_id            uuid;
begin
  if p_actor is null then
    raise exception 'ator não identificado' using errcode = '42501';
  end if;

  -- AUTHORITY (D2). org_admin of THAT organisation, and nothing else: no platform_admin
  -- arm (the noun rule — platform_admin administers tenancy and identity, not employment)
  -- and no hospital_admin arm (a hospital admin has no claim at the organisation tier).
  -- A non-existent organisation also fails here, which is correct: it is indistinguishable
  -- from one the caller does not administer.
  if not app.is_org_admin_of_for(p_organization, p_actor) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  -- TENANT CHECK (D11). ⚠ "not found" and "wrong organisation" are DELIBERATELY the same
  -- error: splitting them makes this door a cross-tenant existence oracle over
  -- `profiles.id` for any org admin of any tenant.
  select home_organization_id, is_active into v_person_org, v_person_active
  from public.profiles where id = p_user;

  if v_person_org is null or v_person_org is distinct from p_organization then
    raise exception 'pessoa não pertence a esta organização' using errcode = 'HC0R0';
  end if;

  -- `profiles.is_active`, the MASTER SWITCH — not `app.is_active`, which also folds
  -- `suspended_until`. A suspension is temporary and reversible; refusing to record
  -- someone's employment because they are suspended this week would turn an HR record
  -- into a disciplinary one.
  if not coalesce(v_person_active, false) then
    raise exception 'conta desativada' using errcode = 'HC0R4';
  end if;

  -- Idempotent over the ACTIVE row (D6). The partial unique would reject a duplicate
  -- anyway, and a 23505 surfacing as a generic pt-BR error is a worse answer.
  select id into v_existing
  from public.organization_affiliations
  where principal_id = p_user and organization_id = p_organization
    and ended_on is null and voided_at is null;

  if v_existing is not null then
    return v_existing;
  end if;

  insert into public.organization_affiliations
    (principal_id, organization_id, started_on, created_by)
  values
    (p_user, p_organization, coalesce(p_started_on, current_date), p_actor)
  returning id into v_id;

  return v_id;
end;
$$;

create function public.affiliate_person_to_org(
  p_user uuid, p_organization uuid, p_started_on date default null)
returns uuid
language sql
security definer
set search_path = app, public, pg_catalog
as $$
  select app.affiliate_person_to_org_impl((select auth.uid()), p_user, p_organization, p_started_on);
$$;

create function public.affiliate_person_to_org_for(
  p_actor uuid, p_user uuid, p_organization uuid, p_started_on date default null)
returns uuid
language sql
security definer
set search_path = app, public, pg_catalog
as $$
  select app.affiliate_person_to_org_impl(p_actor, p_user, p_organization, p_started_on);
$$;

-- =============================================================================================
-- 2. end_org_affiliation — D3 (refuses while ties remain), D6 (an expired seat never blocks)
-- =============================================================================================

create function app.end_org_affiliation_impl(
  p_actor uuid, p_user uuid, p_organization uuid, p_ended_on date default null)
returns uuid
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_id       uuid;
  v_started  date;
  v_end      date := coalesce(p_ended_on, current_date);
  v_blockers jsonb;
begin
  if p_actor is null then
    raise exception 'ator não identificado' using errcode = '42501';
  end if;

  if not app.is_org_admin_of_for(p_organization, p_actor) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  select id, started_on into v_id, v_started
  from public.organization_affiliations
  where principal_id = p_user and organization_id = p_organization
    and ended_on is null and voided_at is null;

  if v_id is null then
    -- Not an existence oracle: the caller has already proven authority OVER THIS
    -- ORGANISATION, so "nobody by that id is employed here" is information they hold.
    raise exception 'vínculo ativo não encontrado' using errcode = 'HC0R2';
  end if;

  -- D3 — THE BLOCKERS, ENUMERATED RATHER THAN COUNTED. There is deliberately NO CASCADE:
  -- the wizard composes the steps (D12), so revoking someone's seats is always a decision
  -- a human took and never a side effect of an HR action. The caller is told exactly what
  -- still holds the person, which is the difference between an actionable refusal and
  -- "it did not work".
  --
  -- ⚠ ALL THREE MEMBERSHIP TIERS resolve to an organisation differently: org-tier carries
  -- `organization_id` directly, hospital-tier resolves through `hospitals`, and
  -- commission-tier through `commissions.hospital_id` -> `hospitals`
  -- (`memberships_scope_shape`). Checking only the first would let a commission seat keep
  -- someone employed invisibly.
  --
  -- ⚠ D6: an EXPIRED seat never blocks. Offboarding blockers are active-only, while the
  -- read-visibility legs stay ever-held — the two are different questions and this ruling
  -- closes FUP-AFF2-ACTIVE-MEANS-TWO-THINGS.
  select jsonb_agg(jsonb_build_object(
           'kind',       x.kind,
           'role',       x.role,
           'hospital',   x.hospital,
           'commission', x.commission)
         order by x.kind, x.role nulls first, x.hospital nulls first, x.commission nulls first)
    into v_blockers
  from (
    select 'hospital_affiliation'::text as kind,
           null::text                   as role,
           h.name                       as hospital,
           null::text                   as commission
      from public.hospital_affiliations ha
      join public.hospitals h on h.id = ha.hospital_id
     where ha.principal_id = p_user
       and ha.organization_id = p_organization
       and ha.ended_on is null
       and ha.voided_at is null
    union all
    select 'membership'::text,
           m.role,
           h.name,
           c.name
      from public.memberships m
      left join public.commissions c on c.id = m.commission_id
      left join public.hospitals   h on h.id = coalesce(m.hospital_id, c.hospital_id)
     where m.principal_id = p_user
       and (m.expires_at is null or m.expires_at > now())
       and coalesce(m.organization_id, h.organization_id) = p_organization
  ) x;

  if v_blockers is not null then
    raise exception 'não é possível desligar da organização: a pessoa ainda possui vínculos ativos'
      using errcode = 'HC0R6', detail = v_blockers::text;
  end if;

  if v_end < v_started then
    raise exception 'data de encerramento anterior ao início do vínculo'
      using errcode = 'HC0R3';
  end if;

  update public.organization_affiliations
     set ended_on = v_end, ended_by = p_actor
   where id = v_id;

  return v_id;
end;
$$;

create function public.end_org_affiliation(
  p_user uuid, p_organization uuid, p_ended_on date default null)
returns uuid
language sql
security definer
set search_path = app, public, pg_catalog
as $$
  select app.end_org_affiliation_impl((select auth.uid()), p_user, p_organization, p_ended_on);
$$;

create function public.end_org_affiliation_for(
  p_actor uuid, p_user uuid, p_organization uuid, p_ended_on date default null)
returns uuid
language sql
security definer
set search_path = app, public, pg_catalog
as $$
  select app.end_org_affiliation_impl(p_actor, p_user, p_organization, p_ended_on);
$$;

-- =============================================================================================
-- 3. update_org_affiliation — start-date corrections only
-- =============================================================================================

create function app.update_org_affiliation_impl(
  p_actor uuid, p_user uuid, p_organization uuid, p_started_on date)
returns uuid
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_id    uuid;
  v_ended date;
begin
  if p_actor is null then
    raise exception 'ator não identificado' using errcode = '42501';
  end if;

  if not app.is_org_admin_of_for(p_organization, p_actor) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  select id, ended_on into v_id, v_ended
  from public.organization_affiliations
  where principal_id = p_user and organization_id = p_organization
    and ended_on is null and voided_at is null;

  if v_id is null then
    raise exception 'vínculo ativo não encontrado' using errcode = 'HC0R2';
  end if;

  -- Active rows have `ended_on IS NULL` so this cannot fire today, but the CHECK exists
  -- and the door must not be the thing that discovers it: an explicit refusal beats a raw
  -- 23514 reaching the UI. Mirrors `update_affiliation`.
  if p_started_on is not null and v_ended is not null and p_started_on > v_ended then
    raise exception 'data de início posterior ao encerramento do vínculo'
      using errcode = 'HC0R3';
  end if;

  update public.organization_affiliations
     set started_on = coalesce(p_started_on, started_on)
   where id = v_id;

  return v_id;
end;
$$;

create function public.update_org_affiliation(
  p_user uuid, p_organization uuid, p_started_on date)
returns uuid
language sql
security definer
set search_path = app, public, pg_catalog
as $$
  select app.update_org_affiliation_impl((select auth.uid()), p_user, p_organization, p_started_on);
$$;

create function public.update_org_affiliation_for(
  p_actor uuid, p_user uuid, p_organization uuid, p_started_on date)
returns uuid
language sql
security definer
set search_path = app, public, pg_catalog
as $$
  select app.update_org_affiliation_impl(p_actor, p_user, p_organization, p_started_on);
$$;

-- =============================================================================================
-- 4. void_affiliation — D7/D8, the hospital tier. THE MECHANISM THAT CLOSES C5.
-- =============================================================================================

create function app.void_affiliation_impl(
  p_actor uuid, p_affiliation uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_id        uuid;
  v_org       uuid;
  v_hospital  uuid;
  v_principal uuid;
  v_voided    timestamptz;
  v_reason    text := nullif(btrim(coalesce(p_reason, '')), '');
  v_seats     jsonb;
begin
  if p_actor is null then
    raise exception 'ator não identificado' using errcode = '42501';
  end if;

  select id, organization_id, hospital_id, principal_id, voided_at
    into v_id, v_org, v_hospital, v_principal, v_voided
  from public.hospital_affiliations
  where id = p_affiliation;

  -- ⛔ THESE TWO REFUSALS ARE BYTE-IDENTICAL ON PURPOSE. "No such row" and "not yours"
  -- must be indistinguishable, or this door becomes a cross-tenant existence oracle over
  -- affiliation ids for any hospital admin of any tenant.
  if v_id is null then
    raise exception 'vínculo não encontrado' using errcode = 'HC0R2';
  end if;

  -- AUTHORITY (D8) — CREATION-SYMMETRIC: whoever could have created this row may revoke
  -- it. org_admin of its organisation, or hospital_admin of THAT hospital.
  if not (app.is_org_admin_of_for(v_org, p_actor)
          or app.is_hospital_admin_of_for(v_hospital, p_actor)) then
    raise exception 'vínculo não encontrado' using errcode = 'HC0R2';
  end if;

  -- D7 — the reason is MANDATORY. A void asserts the employment was never true; an
  -- unexplained assertion of that kind is not auditable, and the trigger writes the reason
  -- into the audit record, not merely into the row.
  if v_reason is null then
    raise exception 'motivo da anulação é obrigatório' using errcode = 'HC0R7';
  end if;

  -- Refused rather than re-voided: a second void would overwrite the original actor and
  -- reason, destroying the record of who revoked what and why.
  if v_voided is not null then
    raise exception 'vínculo já anulado' using errcode = 'HC0R8';
  end if;

  -- D8 — THE NEVER-EMPLOYED CONSISTENCY CHECK. A record with seats attached is not
  -- consistent with "this employment never happened"; the honest verb there is `end`.
  -- ⚠ "EVER", so there is deliberately NO `expires_at` FILTER here — unlike the D3
  -- blockers, which are active-only. The two ask different questions: D3 asks "is this
  -- person still working", D8 asks "did this row ever grant anything".
  select jsonb_agg(jsonb_build_object('role', x.role, 'commission', x.commission)
                   order by x.role, x.commission nulls first)
    into v_seats
  from (
    select m.role, c.name as commission
      from public.memberships m
      left join public.commissions c on c.id = m.commission_id
     where m.principal_id = v_principal
       and coalesce(m.hospital_id, c.hospital_id) = v_hospital
  ) x;

  if v_seats is not null then
    raise exception 'vínculo com funções registradas não pode ser anulado; use o encerramento'
      using errcode = 'HC0R9', detail = v_seats::text;
  end if;

  -- An ENDED row is still voidable (D7: the tenses may coexist, and voided takes
  -- precedence). `ended_on` is left exactly as it is.
  update public.hospital_affiliations
     set voided_at = now(), voided_by = p_actor, void_reason = v_reason
   where id = v_id;

  return v_id;
end;
$$;

create function public.void_affiliation(p_affiliation uuid, p_reason text)
returns uuid
language sql
security definer
set search_path = app, public, pg_catalog
as $$
  select app.void_affiliation_impl((select auth.uid()), p_affiliation, p_reason);
$$;

create function public.void_affiliation_for(p_actor uuid, p_affiliation uuid, p_reason text)
returns uuid
language sql
security definer
set search_path = app, public, pg_catalog
as $$
  select app.void_affiliation_impl(p_actor, p_affiliation, p_reason);
$$;

-- =============================================================================================
-- 5. void_org_affiliation — D7/D8, the organisation tier
-- =============================================================================================

create function app.void_org_affiliation_impl(
  p_actor uuid, p_org_affiliation uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_id        uuid;
  v_org       uuid;
  v_principal uuid;
  v_voided    timestamptz;
  v_reason    text := nullif(btrim(coalesce(p_reason, '')), '');
  v_hosp      jsonb;
  v_seats     jsonb;
begin
  if p_actor is null then
    raise exception 'ator não identificado' using errcode = '42501';
  end if;

  select id, organization_id, principal_id, voided_at
    into v_id, v_org, v_principal, v_voided
  from public.organization_affiliations
  where id = p_org_affiliation;

  -- Byte-identical, same reasoning as the hospital-tier door.
  if v_id is null then
    raise exception 'vínculo não encontrado' using errcode = 'HC0R2';
  end if;

  -- AUTHORITY (D8): org_admin of that organisation ONLY. There is no hospital-admin arm
  -- at this tier — creation-symmetric with `affiliate_person_to_org`.
  if not app.is_org_admin_of_for(v_org, p_actor) then
    raise exception 'vínculo não encontrado' using errcode = 'HC0R2';
  end if;

  if v_reason is null then
    raise exception 'motivo da anulação é obrigatório' using errcode = 'HC0R7';
  end if;

  if v_voided is not null then
    raise exception 'vínculo já anulado' using errcode = 'HC0R8';
  end if;

  -- A person cannot have "never belonged to this organisation" while a hospital
  -- affiliation inside it still stands. Voided hospital rows are excluded — they make the
  -- same claim this void is making.
  select jsonb_agg(jsonb_build_object('hospital', x.hospital) order by x.hospital)
    into v_hosp
  from (
    select h.name as hospital
      from public.hospital_affiliations ha
      join public.hospitals h on h.id = ha.hospital_id
     where ha.principal_id = v_principal
       and ha.organization_id = v_org
       and ha.voided_at is null
  ) x;

  if v_hosp is not null then
    raise exception 'a pessoa possui vínculos hospitalares registrados nesta organização'
      using errcode = 'HC0RA', detail = v_hosp::text;
  end if;

  -- D8, "ever" again: no expiry filter, all three tiers.
  select jsonb_agg(jsonb_build_object('role', x.role, 'commission', x.commission)
                   order by x.role, x.commission nulls first)
    into v_seats
  from (
    select m.role, c.name as commission
      from public.memberships m
      left join public.commissions c on c.id = m.commission_id
      left join public.hospitals   h on h.id = coalesce(m.hospital_id, c.hospital_id)
     where m.principal_id = v_principal
       and coalesce(m.organization_id, h.organization_id) = v_org
  ) x;

  if v_seats is not null then
    raise exception 'vínculo com funções registradas não pode ser anulado; use o encerramento'
      using errcode = 'HC0R9', detail = v_seats::text;
  end if;

  update public.organization_affiliations
     set voided_at = now(), voided_by = p_actor, void_reason = v_reason
   where id = v_id;

  return v_id;
end;
$$;

create function public.void_org_affiliation(p_org_affiliation uuid, p_reason text)
returns uuid
language sql
security definer
set search_path = app, public, pg_catalog
as $$
  select app.void_org_affiliation_impl((select auth.uid()), p_org_affiliation, p_reason);
$$;

create function public.void_org_affiliation_for(p_actor uuid, p_org_affiliation uuid, p_reason text)
returns uuid
language sql
security definer
set search_path = app, public, pg_catalog
as $$
  select app.void_org_affiliation_impl(p_actor, p_org_affiliation, p_reason);
$$;

-- =============================================================================================
-- 6. get_own_person_record — D14. SELF-ONLY BY CONSTRUCTION. No _impl, no _for twin.
-- =============================================================================================

create function public.get_own_person_record()
returns table(
  full_name                  text,
  email                      text,
  professional_category_id   uuid,
  professional_category      text,
  cpf                        text,
  date_of_birth              date,
  phone                      text)
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'ator não identificado' using errcode = '42501';
  end if;

  -- ⛔ HAND-PICKED PROJECTION, NEVER `to_jsonb(pr)`. A SECURITY DEFINER function bypasses
  -- the column grants that make `cpf`, `date_of_birth` and `phone` unreadable even to
  -- their owner, so `to_jsonb` would publish every column this table ever gains — the
  -- `get_case_professional` lesson. Adding a column to `profiles` must not silently widen
  -- this door; that requires an edit here, which is a reviewable event.
  --
  -- The CPF is returned in full, and that is correct: it is the caller's own, and masking
  -- is a shoulder-surfing mitigation applied at the query boundary (ADR 0147's single
  -- `maskCpf`), not a confidentiality boundary against the subject. ⛔ Do not add a second
  -- masking here.
  return query
  select pr.full_name,
         pr.email::text,
         pr.professional_category_id,
         pc.label_pt,
         pr.cpf,
         pr.date_of_birth,
         pr.phone
    from public.profiles pr
    left join public.professional_categories pc on pc.id = pr.professional_category_id
   where pr.id = v_uid;
end;
$$;

-- =============================================================================================
-- 7. ACLs — the triple shape, applied explicitly. See the header.
-- =============================================================================================

revoke all on function app.affiliate_person_to_org_impl(uuid,uuid,uuid,date) from public;
revoke all on function app.end_org_affiliation_impl(uuid,uuid,uuid,date) from public;
revoke all on function app.update_org_affiliation_impl(uuid,uuid,uuid,date) from public;
revoke all on function app.void_affiliation_impl(uuid,uuid,text) from public;
revoke all on function app.void_org_affiliation_impl(uuid,uuid,text) from public;

revoke all on function public.affiliate_person_to_org(uuid,uuid,date) from public;
grant execute on function public.affiliate_person_to_org(uuid,uuid,date) to authenticated, service_role;
revoke all on function public.affiliate_person_to_org_for(uuid,uuid,uuid,date) from public;
grant execute on function public.affiliate_person_to_org_for(uuid,uuid,uuid,date) to service_role;

revoke all on function public.end_org_affiliation(uuid,uuid,date) from public;
grant execute on function public.end_org_affiliation(uuid,uuid,date) to authenticated, service_role;
revoke all on function public.end_org_affiliation_for(uuid,uuid,uuid,date) from public;
grant execute on function public.end_org_affiliation_for(uuid,uuid,uuid,date) to service_role;

revoke all on function public.update_org_affiliation(uuid,uuid,date) from public;
grant execute on function public.update_org_affiliation(uuid,uuid,date) to authenticated, service_role;
revoke all on function public.update_org_affiliation_for(uuid,uuid,uuid,date) from public;
grant execute on function public.update_org_affiliation_for(uuid,uuid,uuid,date) to service_role;

revoke all on function public.void_affiliation(uuid,text) from public;
grant execute on function public.void_affiliation(uuid,text) to authenticated, service_role;
revoke all on function public.void_affiliation_for(uuid,uuid,text) from public;
grant execute on function public.void_affiliation_for(uuid,uuid,text) to service_role;

revoke all on function public.void_org_affiliation(uuid,text) from public;
grant execute on function public.void_org_affiliation(uuid,text) to authenticated, service_role;
revoke all on function public.void_org_affiliation_for(uuid,uuid,text) from public;
grant execute on function public.void_org_affiliation_for(uuid,uuid,text) to service_role;

revoke all on function public.get_own_person_record() from public;
grant execute on function public.get_own_person_record() to authenticated;
