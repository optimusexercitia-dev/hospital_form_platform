-- AE1.3 (2/3) — the four `profiles` person-authority doors.
-- Contract: docs/plans/authz-ae1-person-doors.md §§2, 4.2-4.5, as ruled in its §12
-- (R0 shape, R1 Option A for the invite path, R3 audit precedent).
--
-- ⭐ EACH DOOR IS TWO OBJECTS, and the split is not decoration (design §10.1b):
--   public.<name>_for  — thin wrapper, SECURITY DEFINER, EXECUTE for service_role only.
--                        Marshals arguments and does nothing else.
--   app.<name>_impl    — the kernel: SECURITY DEFINER, VOLATILE, EXECUTE granted to
--                        NOBODY. All authority, precondition, write and audit logic.
-- That is what puts both halves inside the ADR 0156 door-SQLSTATE gate (pgTAP 304 §6):
-- the kernels enter its `kernel` clause (app + prosecdef + volatile + no client EXECUTE)
-- and the `public` wrappers enter as calling wrappers, with no edit to the gate's domain.
-- The `_impl` suffix is load-bearing too: 304 §6.1 is a REVERSE pin — any `app.%_impl`
-- not reached by the structural derivation reds and names itself, so a kernel that is
-- accidentally STABLE, or accidentally granted to `service_role`, fails loudly instead
-- of silently leaving the gate.
--
-- ⛔ SERVICE-ROLE ONLY, AND THAT IS LOAD-BEARING (design §6, F-E). `profiles` carries
-- `guard_profile_privileged_columns_trg`, whose trusted-caller arm is
-- `if auth.uid() is null then return new`. `auth.uid()` reads only the `request.jwt.*`
-- GUCs, a service-role JWT carries no `sub`, and SECURITY DEFINER changes `current_user`
-- and never a GUC — so a service-role-invoked door passes the guard untouched and NO
-- change to the guard is required.
--   ⛔ If any of these doors were ever granted to `authenticated`, all four would break
--      (`v_identity_changed` / `v_privilege_changed` -> check_violation) and the obvious
--      "fix" — exempting them via a transaction-local GUC — is a PRIVILEGE-ESCALATION
--      VULNERABILITY: `authenticated` already holds column UPDATE on
--      `profiles.is_admin` and `profiles_update_self` already permits `id = auth.uid()`,
--      so the guard is the ONLY thing stopping self-elevation, and any custom GUC is
--      forgeable with `set_config` by the very caller it would exclude.
--      Keystoned in pgTAP 386; restated as a standing rule in `.claude/rules/`.
--
-- ⛔ NO `home_organization_id` IS EVER WRITTEN by any door here. It is seeded by
-- `handle_new_user` from user metadata, and writing it would fire the deferred constraint
-- trigger `profiles_tenant_has_org_trg` (design §6.5).
--
-- ⚠ AUDIT — actor_id will be NULL and that is the PRE-EXISTING PLATFORM GAP, not a new
-- one (design §5 item 3, lead ruling R3). `app.audit_write` derives its actor from
-- `auth.uid()`, which is NULL on every service-role path; `public.log_cpf_probe_for`
-- states the same thing in its own body. The actor rides in `metadata.actor_user_id`, so
-- it is a QUERYABILITY gap, not a Rule 11 loss. ⛔ Do not mint `app.audit_write_as` here:
-- fixing it only here would leave `actor_id` PARTIALLY populated, which is worse for a
-- reader than uniformly null. Tracked as a platform-wide follow-up.
--
-- ⚠ Rule 11 / Rule 12: metadata carries ids, column NAMES, booleans and timestamps.
-- ⛔ NEVER `cpf`, `date_of_birth`, `phone`, `full_name` or any before/after value of them.
-- pgTAP 385 asserts this STRUCTURALLY, by scanning emitted metadata for the fixture's
-- literal values.

-- ===========================================================================
-- 1. finalize_invited_person — the invite-flow profile patch (design §4.2)
-- ===========================================================================
-- ⭐ AUTHORITY IS THE ORDINARY PREDICATE, `cpf_change` (SUBSET), because the write
-- includes `cpf`. There is NO special inviter predicate (lead ruling R1 / Option A):
-- `registerUser` is reordered so the affiliation rows exist BEFORE this call, which makes
-- the target's footprint exactly {the registrar's hospital} and satisfies SUBSET for a
-- hospital_admin registrar and an org_admin registrar alike.
--   ⛔ Do NOT restore the old ordering. With the patch running first the target's
--      footprint is EMPTY, `can_administer_person_for` denies an empty footprint for
--      every capability, and every hospital_admin registration becomes a 42501 — a total
--      outage of a supported product path (design F-A).
create or replace function app.finalize_invited_person_impl(
  p_actor                     uuid,
  p_user                      uuid,
  p_full_name                 text,
  p_professional_category_id  uuid,
  p_cpf                       text,
  p_date_of_birth             date,
  p_phone                     text,
  p_must_change_password      boolean
) returns void
language plpgsql
volatile
security definer
set search_path = app, public, pg_catalog
as $fn$
declare
  v_org uuid;
begin
  if p_actor is null then
    raise exception 'ator não identificado' using errcode = '42501';
  end if;

  if not app.can_administer_person_for('cpf_change', p_user, p_actor) then
    -- Also the not-found answer (design F-B): a missing person and an unauthorized
    -- caller are indistinguishable here, deliberately.
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  select pr.home_organization_id into v_org from public.profiles pr where pr.id = p_user;

  -- ⚠ NORMALISED ON THE WRITE, mirroring `registerUser`'s own coercions
  -- (`normalizeCpf(...) || null`, `phone.replace(/\D/g,'') || null`). See
  -- `app.update_person_fields_impl` for why the WRITER must normalise and not only the
  -- comparison: pgTAP 385 §1.5 found a formatted CPF tripping `profiles_cpf_valid`.
  update public.profiles
     set full_name                = p_full_name,
         professional_category_id = p_professional_category_id,
         cpf                      = nullif(regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g'), ''),
         date_of_birth            = p_date_of_birth,
         phone                    = nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), ''),
         must_change_password     = coalesce(p_must_change_password, false)
   where id = p_user;

  perform app.audit_write(
    p_action        => 'person.registered',
    p_entity_type   => 'profile',
    p_entity_id     => p_user,
    p_commission    => null,
    p_summary       => 'Cadastro de pessoa finalizado',
    p_metadata      => jsonb_build_object(
                         'actor_user_id', p_actor,
                         'must_change_password', coalesce(p_must_change_password, false)),
    p_organization  => v_org,
    p_hospital      => null
  );
end;
$fn$;

create or replace function public.finalize_invited_person_for(
  p_actor                     uuid,
  p_user                      uuid,
  p_full_name                 text,
  p_professional_category_id  uuid,
  p_cpf                       text,
  p_date_of_birth             date default null,
  p_phone                     text default null,
  p_must_change_password      boolean default false
) returns void
language sql
volatile
security definer
set search_path = app, public, pg_catalog
as $fn$
  select app.finalize_invited_person_impl(
    p_actor, p_user, p_full_name, p_professional_category_id,
    p_cpf, p_date_of_birth, p_phone, p_must_change_password);
$fn$;

-- ===========================================================================
-- 2. update_person_fields — the person-edit write (design §4.3)
-- ===========================================================================
-- ⚠ THE `p_set_*` BOOLEANS ARE LOAD-BEARING, NOT CEREMONY. The TS distinguishes an
-- ABSENT key from an EXPLICIT null (`...(cpf === undefined ? {} : { cpf })`); a nullable
-- parameter alone cannot carry that distinction, and collapsing it would let an edit form
-- that does not carry the field NULL IT OUT. pgTAP 385 pins
-- `p_set_cpf => false, p_cpf => null` leaving the stored CPF unchanged.
--
-- ⭐ TWO ARMS IN ONE DOOR — the single most important behaviour in this migration:
--   always                     -> 'fields'      (INTERSECTION)
--   only when the CPF CHANGES  -> 'cpf_change'  (SUBSET)
-- ⚠ "ACTUALLY CHANGES", NOT "THE KEY IS PRESENT" (ADR 0133 Amendment 3). Taken as
-- presence, the tighter bound would deny exactly the cross-hospital field edit that
-- Amendment 1 ruling 1 exists to permit — it would DEFEAT the amendment it appears in.
-- The comparison normalises DIGITS-ONLY ON BOTH SIDES because the TS normalises both
-- sides and a comparison that disagrees with its own writer is the defect. Clearing a
-- stored CPF to null IS a change and correctly hits the tighter bound.
create or replace function app.update_person_fields_impl(
  p_actor                     uuid,
  p_user                      uuid,
  p_full_name                 text,
  p_professional_category_id  uuid,
  p_set_cpf                   boolean,
  p_cpf                       text,
  p_set_date_of_birth         boolean,
  p_date_of_birth             date,
  p_set_phone                 boolean,
  p_phone                     text
) returns void
language plpgsql
volatile
security definer
set search_path = app, public, pg_catalog
as $fn$
declare
  v_org         uuid;
  v_cur         record;
  v_cpf_norm    text;
  v_phone_norm  text;
  v_cpf_changed boolean;
  v_fields      text[];
begin
  if p_actor is null then
    raise exception 'ator não identificado' using errcode = '42501';
  end if;

  if not app.can_administer_person_for('fields', p_user, p_actor) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  -- Authority has already been proven over this person, so the row exists.
  select pr.home_organization_id, pr.full_name, pr.professional_category_id,
         pr.cpf, pr.date_of_birth, pr.phone
    into v_cur
    from public.profiles pr
   where pr.id = p_user;
  v_org := v_cur.home_organization_id;

  -- ⛔ NORMALISE ONCE, THEN COMPARE **AND** WRITE THE SAME VALUE. The design specified
  -- digits-only normalisation for the COMPARISON only, and pgTAP 385 §1.5 caught what
  -- that leaves open: a formatted CPF ('111.444.777-35') normalises EQUAL to the stored
  -- one — so it is correctly NOT a change and correctly does not escalate to the SUBSET
  -- arm — and was then stored verbatim, tripping `profiles_cpf_valid` (`^[0-9]{11}$`).
  -- The recorded lesson runs in this direction too: a WRITER that disagrees with its own
  -- comparison is the defect. These two expressions are exactly `normalizeCpf(x) || null`
  -- and `phone.replace(/\D/g,'') || null` from the TS half.
  v_cpf_norm   := nullif(regexp_replace(coalesce(p_cpf, ''),   '\D', '', 'g'), '');
  v_phone_norm := nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), '');

  v_cpf_changed := coalesce(p_set_cpf, false)
    and nullif(regexp_replace(coalesce(v_cur.cpf, ''), '\D', '', 'g'), '')
        is distinct from v_cpf_norm;

  if v_cpf_changed and not app.can_administer_person_for('cpf_change', p_user, p_actor) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  v_fields := array_remove(array[
    case when p_full_name is distinct from v_cur.full_name then 'full_name' end,
    case when p_professional_category_id is distinct from v_cur.professional_category_id
         then 'professional_category_id' end,
    case when coalesce(p_set_cpf, false) and v_cpf_norm is distinct from v_cur.cpf then 'cpf' end,
    case when coalesce(p_set_date_of_birth, false)
          and p_date_of_birth is distinct from v_cur.date_of_birth then 'date_of_birth' end,
    case when coalesce(p_set_phone, false) and v_phone_norm is distinct from v_cur.phone
         then 'phone' end
  ], null);

  update public.profiles
     set full_name                = p_full_name,
         professional_category_id = p_professional_category_id,
         cpf           = case when coalesce(p_set_cpf, false) then v_cpf_norm else cpf end,
         date_of_birth = case when coalesce(p_set_date_of_birth, false)
                              then p_date_of_birth else date_of_birth end,
         phone         = case when coalesce(p_set_phone, false) then v_phone_norm else phone end
   where id = p_user;

  perform app.audit_write(
    p_action        => 'person.fields_updated',
    p_entity_type   => 'profile',
    p_entity_id     => p_user,
    p_commission    => null,
    p_summary       => 'Dados pessoais atualizados',
    -- ⛔ the NAMES of the changed columns, never their values (Rule 11 / Rule 12).
    p_metadata      => jsonb_build_object(
                         'actor_user_id', p_actor,
                         'fields', to_jsonb(coalesce(v_fields, array[]::text[])),
                         'cpf_changed', v_cpf_changed),
    p_organization  => v_org,
    p_hospital      => null
  );
end;
$fn$;

create or replace function public.update_person_fields_for(
  p_actor                     uuid,
  p_user                      uuid,
  p_full_name                 text,
  p_professional_category_id  uuid,
  p_set_cpf                   boolean default false,
  p_cpf                       text default null,
  p_set_date_of_birth         boolean default false,
  p_date_of_birth             date default null,
  p_set_phone                 boolean default false,
  p_phone                     text default null
) returns void
language sql
volatile
security definer
set search_path = app, public, pg_catalog
as $fn$
  select app.update_person_fields_impl(
    p_actor, p_user, p_full_name, p_professional_category_id,
    p_set_cpf, p_cpf, p_set_date_of_birth, p_date_of_birth, p_set_phone, p_phone);
$fn$;

-- ===========================================================================
-- 3. set_person_active — deactivate / reactivate (design §4.4)
-- ===========================================================================
-- ⭐ ONE DOOR, BOTH DIRECTIONS. Deactivate and reactivate are the same authority and the
-- same audit family; two doors would be two places to forget an arm. `suspended_until` is
-- cleared on reactivation ONLY, mirroring `reactivateUser`'s
-- `{ is_active: true, suspended_until: null }`.
-- Authority is `lifecycle` (SUBSET) because `app.is_active` is folded into every
-- membership predicate: this is a PLATFORM-WIDE kill switch, not a local offboarding.
-- A hospital admin's local offboarding is `end_affiliation`, never this.
create or replace function app.set_person_active_impl(
  p_actor  uuid,
  p_user   uuid,
  p_active boolean
) returns void
language plpgsql
volatile
security definer
set search_path = app, public, pg_catalog
as $fn$
declare
  v_org uuid;
begin
  if p_actor is null then
    raise exception 'ator não identificado' using errcode = '42501';
  end if;

  if not app.can_administer_person_for('lifecycle', p_user, p_actor) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  select pr.home_organization_id into v_org from public.profiles pr where pr.id = p_user;

  update public.profiles
     set is_active       = p_active,
         suspended_until = case when p_active then null else suspended_until end
   where id = p_user;

  perform app.audit_write(
    -- Branch on the direction so the trail reads without decoding metadata.
    p_action        => case when p_active then 'person.reactivated' else 'person.deactivated' end,
    p_entity_type   => 'profile',
    p_entity_id     => p_user,
    p_commission    => null,
    p_summary       => case when p_active then 'Pessoa reativada' else 'Pessoa desativada' end,
    p_metadata      => jsonb_build_object('actor_user_id', p_actor, 'is_active', p_active),
    p_organization  => v_org,
    p_hospital      => null
  );
end;
$fn$;

create or replace function public.set_person_active_for(
  p_actor  uuid,
  p_user   uuid,
  p_active boolean
) returns void
language sql
volatile
security definer
set search_path = app, public, pg_catalog
as $fn$
  select app.set_person_active_impl(p_actor, p_user, p_active);
$fn$;

-- ===========================================================================
-- 4. suspend_person — temporary, auto-reinstating suspension (design §4.5)
-- ===========================================================================
-- ⚠ KEPT AS A SEPARATE DOOR FROM 3 DELIBERATELY. The two write DISJOINT columns; merging
-- them into one `p_active` + `p_until` door creates a call shape where passing the wrong
-- combination silently REACTIVATES a suspended person.
-- ⛔ `is_active` IS NOT TOUCHED HERE. A door that "helpfully" also flipped it would be a
-- silent widening of what suspension means; pgTAP 385 asserts `is_active` is unchanged.
-- `null` means indefinite; a past instant reads as active again — the DB stores exactly
-- what it is given, unchanged from `suspendUser` today.
create or replace function app.suspend_person_impl(
  p_actor           uuid,
  p_user            uuid,
  p_suspended_until timestamptz
) returns void
language plpgsql
volatile
security definer
set search_path = app, public, pg_catalog
as $fn$
declare
  v_org uuid;
begin
  if p_actor is null then
    raise exception 'ator não identificado' using errcode = '42501';
  end if;

  -- Suspension routes through the same `app.is_active` kill switch, so it is `lifecycle`
  -- (SUBSET) too, not a lesser act.
  if not app.can_administer_person_for('lifecycle', p_user, p_actor) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  select pr.home_organization_id into v_org from public.profiles pr where pr.id = p_user;

  update public.profiles
     set suspended_until = p_suspended_until
   where id = p_user;

  perform app.audit_write(
    p_action        => 'person.suspended',
    p_entity_type   => 'profile',
    p_entity_id     => p_user,
    p_commission    => null,
    p_summary       => 'Suspensão de acesso registrada',
    -- A schedule, not PHI.
    p_metadata      => jsonb_build_object('actor_user_id', p_actor, 'until', p_suspended_until),
    p_organization  => v_org,
    p_hospital      => null
  );
end;
$fn$;

create or replace function public.suspend_person_for(
  p_actor           uuid,
  p_user            uuid,
  p_suspended_until timestamptz default null
) returns void
language sql
volatile
security definer
set search_path = app, public, pg_catalog
as $fn$
  select app.suspend_person_impl(p_actor, p_user, p_suspended_until);
$fn$;

-- ===========================================================================
-- ACLs — POSITIVE, never inferred (design §1). `proacl = NULL` means PUBLIC EXECUTE.
-- The `app` schema carries NO default function ACL, so every kernel below would be
-- PUBLIC-executable without its `revoke`. `public` DOES carry one for `postgres`
-- (`{postgres=X/postgres, service_role=X/postgres}`), so the wrappers' grants are
-- restated explicitly rather than inherited silently.
-- ===========================================================================
revoke all on function app.finalize_invited_person_impl(uuid, uuid, text, uuid, text, date, text, boolean) from public;
revoke all on function app.update_person_fields_impl(uuid, uuid, text, uuid, boolean, text, boolean, date, boolean, text) from public;
revoke all on function app.set_person_active_impl(uuid, uuid, boolean) from public;
revoke all on function app.suspend_person_impl(uuid, uuid, timestamptz) from public;

revoke all on function public.finalize_invited_person_for(uuid, uuid, text, uuid, text, date, text, boolean) from public;
revoke all on function public.update_person_fields_for(uuid, uuid, text, uuid, boolean, text, boolean, date, boolean, text) from public;
revoke all on function public.set_person_active_for(uuid, uuid, boolean) from public;
revoke all on function public.suspend_person_for(uuid, uuid, timestamptz) from public;

grant execute on function public.finalize_invited_person_for(uuid, uuid, text, uuid, text, date, text, boolean) to service_role;
grant execute on function public.update_person_fields_for(uuid, uuid, text, uuid, boolean, text, boolean, date, boolean, text) to service_role;
grant execute on function public.set_person_active_for(uuid, uuid, boolean) to service_role;
grant execute on function public.suspend_person_for(uuid, uuid, timestamptz) to service_role;
