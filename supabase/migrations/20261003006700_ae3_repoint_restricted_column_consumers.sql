-- =====================================================================================
-- AE3.2 step 4 -- re-point every SQL consumer from the AE3.1 census onto
-- public.profile_private_details.
--
-- ADR 0155 D4, plan docs/plans/authz-evolution.md "Phase AE3".
-- Census: docs/design/authz-evolution-census-ae3.md section 3 -- FIVE qualifying objects,
-- all SECURITY DEFINER, closed by asking "names a token AND names profiles" rather than
-- "names a token" (which also returns nine Class-1 patient-PHI handlers and the
-- hospital_affiliations `work_phone` family -- neither is in scope).
--
-- ⛔ EVERY BODY BELOW WAS TAKEN FROM THE LIVE CATALOG (`pg_get_functiondef`), NOT FROM A
-- MIGRATION FILE. Some migrations in this tree rewrite function bodies at runtime via
-- pg_get_functiondef() + replace() + execute, so migration text is stale by design and
-- reading it has already produced a confident false P0 here (CLAUDE.md, graphify exception).
--
-- ⛔ THIS MIGRATION MUST LAND BEFORE THE COLUMN DROP. plpgsql resolves `new.cpf` at
-- EXECUTION time, so a guard still naming a dropped column fails on the next UPDATE of
-- profiles -- at runtime, with no migration or test having reddened.
--
-- Nothing here changes an authorization decision. The gates (`can_administer_person_for`
-- with its 'fields' and 'cpf_change' arms, list_org_people's inline D10 gate), the audit
-- writes, the normalisation expressions and the returned shapes are byte-identical; only
-- the RELATION the values live in changes. Signatures are unchanged, so every one is a
-- plain CREATE OR REPLACE and no grant or door registration moves.
-- =====================================================================================


-- =====================================================================================
-- 1/5  app.finalize_invited_person_impl -- WRITER (all three)
-- =====================================================================================
create or replace function app.finalize_invited_person_impl(
  p_actor uuid, p_user uuid, p_full_name text, p_professional_category_id uuid,
  p_cpf text, p_date_of_birth date, p_phone text, p_must_change_password boolean)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
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

  v_org := app.person_audit_organization(p_actor, p_user);

  update public.profiles
     set full_name                = p_full_name,
         professional_category_id = p_professional_category_id,
         must_change_password     = coalesce(p_must_change_password, false)
   where id = p_user;

  -- ⚠ NORMALISED ON THE WRITE, mirroring `registerUser`'s own coercions
  -- (`normalizeCpf(...) || null`, `phone.replace(/\D/g,'') || null`). See
  -- `app.update_person_fields_impl` for why the WRITER must normalise and not only the
  -- comparison: pgTAP 385 §1.5 found a formatted CPF tripping the CPF CHECK.
  -- AE3: the three values now live in profile_private_details. UPSERT rather than UPDATE --
  -- a person invited before AE3, or created by any path that writes no restricted detail,
  -- has no row yet, and an UPDATE would silently write nothing.
  insert into public.profile_private_details as d (profile_id, cpf, date_of_birth, phone, updated_at)
  values (
    p_user,
    nullif(regexp_replace(coalesce(p_cpf, ''),   '\D', '', 'g'), ''),
    p_date_of_birth,
    nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), ''),
    now())
  on conflict (profile_id) do update
     set cpf           = excluded.cpf,
         date_of_birth = excluded.date_of_birth,
         phone         = excluded.phone,
         updated_at    = now();

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
$function$;


-- =====================================================================================
-- 2/5  app.update_person_fields_impl -- WRITER (partial, carries the cpf_change arm)
-- =====================================================================================
create or replace function app.update_person_fields_impl(
  p_actor uuid, p_user uuid, p_full_name text, p_professional_category_id uuid,
  p_set_cpf boolean, p_cpf text, p_set_date_of_birth boolean, p_date_of_birth date,
  p_set_phone boolean, p_phone text)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
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
  -- AE2.4 inc 3: `home_organization_id` left this select list; the audit organisation is
  -- resolved from the affiliation substrate instead.
  -- AE3: the three restricted values come from profile_private_details. ⛔ LEFT JOIN, not
  -- JOIN -- a person with no restricted details on file has NO row there, and an inner
  -- join would make `v_cur` unassigned and every subsequent `is distinct from` compare
  -- against NULL fields of a NULL record. The absent row must read as three NULLs, which
  -- is exactly what it means.
  select pr.full_name, pr.professional_category_id,
         d.cpf, d.date_of_birth, d.phone
    into v_cur
    from public.profiles pr
    left join public.profile_private_details d on d.profile_id = pr.id
   where pr.id = p_user;
  v_org := app.person_audit_organization(p_actor, p_user);

  -- ⛔ NORMALISE ONCE, THEN COMPARE **AND** WRITE THE SAME VALUE. The design specified
  -- digits-only normalisation for the COMPARISON only, and pgTAP 385 §1.5 caught what
  -- that leaves open: a formatted CPF ('111.444.777-35') normalises EQUAL to the stored
  -- one -- so it is correctly NOT a change and correctly does not escalate to the SUBSET
  -- arm -- and was then stored verbatim, tripping the CPF CHECK (`^[0-9]{11}$`).
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
         professional_category_id = p_professional_category_id
   where id = p_user;

  -- AE3: only touch the restricted table when the caller actually set one of the three.
  -- Without this guard a full_name-only edit would materialise an all-NULL row for a
  -- person who has no restricted details -- changing what "a row exists here" means for
  -- the DSR pointer, which is the table's stated purpose.
  if coalesce(p_set_cpf, false)
     or coalesce(p_set_date_of_birth, false)
     or coalesce(p_set_phone, false) then
    insert into public.profile_private_details as d (profile_id, cpf, date_of_birth, phone, updated_at)
    values (
      p_user,
      case when coalesce(p_set_cpf, false)           then v_cpf_norm     else null end,
      case when coalesce(p_set_date_of_birth, false) then p_date_of_birth else null end,
      case when coalesce(p_set_phone, false)         then v_phone_norm   else null end,
      now())
    on conflict (profile_id) do update
       -- Each column keeps its CURRENT value when its set-flag is false. This is the
       -- partial-update contract the three p_set_* booleans exist for: "not set" means
       -- LEAVE IT, and never "set it to NULL".
       set cpf           = case when coalesce(p_set_cpf, false)           then v_cpf_norm      else d.cpf end,
           date_of_birth = case when coalesce(p_set_date_of_birth, false) then p_date_of_birth else d.date_of_birth end,
           phone         = case when coalesce(p_set_phone, false)         then v_phone_norm    else d.phone end,
           updated_at    = now();
  end if;

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
$function$;


-- =====================================================================================
-- 3/5  public.get_own_person_record -- READER (self)
-- =====================================================================================
create or replace function public.get_own_person_record()
returns table(full_name text, email text, professional_category_id uuid,
              professional_category text, cpf text, date_of_birth date, phone text)
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'ator não identificado' using errcode = '42501';
  end if;

  -- ⛔ HAND-PICKED PROJECTION, NEVER `to_jsonb(pr)`. A SECURITY DEFINER function bypasses
  -- the grants that make `cpf`, `date_of_birth` and `phone` unreadable even to their
  -- owner, so `to_jsonb` would publish every column these tables ever gain -- the
  -- `get_case_professional` lesson. AE3 makes this stricter, not looser: the projection
  -- now spans TWO relations, so a column added to EITHER must not silently widen this
  -- door. Both require an edit here, which is a reviewable event.
  --
  -- The CPF is returned in full, and that is correct: it is the caller's own, and masking
  -- is a shoulder-surfing mitigation applied at the query boundary (ADR 0147's single
  -- `maskCpf`), not a confidentiality boundary against the subject. ⛔ Do not add a second
  -- masking here.
  --
  -- ⛔ LEFT JOIN on profile_private_details. A person with no restricted details on file
  -- has no row there; an inner join would return ZERO ROWS for them and the account page
  -- would render as "person not found" rather than as a person with empty fields.
  return query
  select pr.full_name,
         pr.email::text,
         pr.professional_category_id,
         pc.label_pt,
         d.cpf,
         d.date_of_birth,
         d.phone
    from public.profiles pr
    left join public.professional_categories pc on pc.id = pr.professional_category_id
    left join public.profile_private_details d on d.profile_id = pr.id
   where pr.id = v_uid;
end;
$function$;


-- =====================================================================================
-- 4/5  public.list_org_people -- READER (roster + the audited CPF probe)
-- =====================================================================================
create or replace function public.list_org_people(
  p_org_id uuid, p_search text default null::text, p_cpf text default null::text,
  p_include_ended boolean default false)
returns table(user_id uuid, full_name text, email text, professional_category text,
              is_active boolean, affiliations jsonb, date_of_birth date,
              org_affiliation_status text, org_affiliation_ended_on date)
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_uid     uuid := (select auth.uid());
  v_q       text := nullif(btrim(coalesce(p_search, '')), '');
  v_cpf     text := nullif(btrim(coalesce(p_cpf, '')), '');
  v_matched uuid;
begin
  -- THE GATE (D10). Inline, deliberately -- see the header. UNCHANGED by AFF4, and
  -- UNCHANGED by AE3: this migration moves storage, never an authorization decision.
  if not (
    app.is_org_admin_of(p_org_id)
    or (
      app.is_active(v_uid)
      and exists (
        select 1 from public.memberships m
        where m.organization_id = p_org_id
          and m.principal_id = v_uid
          and m.role = 'hospital_admin'
          and (m.expires_at is null or m.expires_at > now())
          -- ACT (ADR 0106) P0: the caller's ACTIVE hat must match this row's role.
          and m.role is not distinct from app.active_role()
      )
    )
  ) then
    return;   -- empty, never raises
  end if;

  -- CPF is EXACT-MATCH ONLY, and only at full storage length. A short or malformed
  -- value matches nothing rather than degrading to a prefix search.
  -- AE3: the CPF now lives in profile_private_details. INNER join here is correct and is
  -- NOT the left-join case above -- a person with no CPF on file cannot match an exact
  -- CPF probe, so "no row" and "no match" are the same answer.
  if v_cpf is not null then
    select pr.id into v_matched
    from public.profiles pr
    join public.profile_private_details d on d.profile_id = pr.id
    where not pr.is_admin
      and d.cpf = v_cpf
      -- AFF4 D10: was `pr.home_organization_id = p_org_id`.
      and exists (
        select 1 from public.organization_affiliations oa
         where oa.principal_id = pr.id
           and oa.organization_id = p_org_id
           and oa.voided_at is null
           and (p_include_ended or oa.ended_on is null)
      );

    -- D11 / audit LOW-2: EVERY CPF-parameterised call emits an audit row -- actor, org,
    -- and whether it matched (with the matched user_id when it did). NEVER the digits:
    -- Rule 11 records THAT and WHO, never the payload. Name/email searches do not emit,
    -- matching the existing directory door. ⛔ BYTE-IDENTICAL TO THE PRE-AFF4 BODY, and
    -- AE3 does not touch it: the probe's audit semantics must survive the storage move
    -- (plan AE3.1 names this explicitly, and AE3.3 asserts it still fires exactly once).
    perform app.audit_write(
      'person.cpf_lookup', 'organization', p_org_id, null,
      case when v_matched is null
           then 'Consulta de pessoa por CPF (sem correspondência)'
           else 'Consulta de pessoa por CPF (com correspondência)' end,
      jsonb_build_object('matched', v_matched is not null, 'user_id', v_matched,
                         'source', 'directory'),
      p_org_id, null);

    if v_matched is null then
      return;
    end if;
  end if;

  return query
  select pr.id,
         pr.full_name,
         pr.email::text,
         pc.label_pt,
         pr.is_active,
         coalesce(
           (select jsonb_agg(jsonb_build_object(
                     'hospital_id',   a.hospital_id,
                     'hospital_name', h.name,
                     'started_on',    a.started_on)
                   order by h.name)
              from public.hospital_affiliations a
              join public.hospitals h on h.id = a.hospital_id
             where a.principal_id = pr.id
               and a.ended_on is null
               and a.voided_at is null
               and a.organization_id = p_org_id),
           '[]'::jsonb),
         ppd.date_of_birth,        -- AFF2 B3 / ADR 0133 D11 (edit (b)); AE3: now from
                                   -- profile_private_details, LEFT joined so a person with
                                   -- no details on file stays ON the roster with a null DOB
                                   -- rather than vanishing from it.
         -- AFF4 D10: the ORG-affiliation tense, so the one caller that widens to ended
         -- people can SAY which ones are ended instead of presenting them identically.
         -- 'ativo' whenever ANY non-voided active row exists; otherwise 'encerrado'.
         case when oa.ended_on is null then 'ativo' else 'encerrado' end,
         oa.ended_on
    from public.profiles pr
    left join public.professional_categories pc on pc.id = pr.professional_category_id
    left join public.profile_private_details ppd on ppd.profile_id = pr.id
    -- The person's STANDING in this org, as one row: an active affiliation wins over any
    -- ended one, and among ended ones the most recent. A person may hold several rows over
    -- time (offboard, rehire), and picking arbitrarily would report a stale tense.
    cross join lateral (
      select o.ended_on
        from public.organization_affiliations o
       where o.principal_id = pr.id
         and o.organization_id = p_org_id
         and o.voided_at is null
         and (p_include_ended or o.ended_on is null)
       order by (o.ended_on is null) desc, o.ended_on desc
       limit 1
    ) oa
   where not pr.is_admin
     -- platform_admin is not a tenant person and never belongs on a tenant roster
     -- (the noun rule, ADR 0078 A35). The org membership itself is now carried by the
     -- LATERAL above: `cross join lateral … limit 1` yields no row for a person with no
     -- qualifying affiliation, so it IS the predicate -- there is no second copy of it to
     -- drift from this one.
     and (v_matched is null or pr.id = v_matched)
     and (v_q is null
          or pr.full_name ilike '%' || v_q || '%'
          or pr.email ilike '%' || v_q || '%')
   order by pr.full_name nulls last, pr.email
   limit 500;
end;
$function$;


-- =====================================================================================
-- 5/5  public.guard_profile_privileged_columns -- the IDENTITY HALF for the three
--      restricted columns RETIRES; every other arm stays.
--
-- ⛔ THE TRIGGER IS NOT DROPPED. Its lifecycle half (is_admin / is_active, the demotion
-- backstop) and its remaining identity arms (suspended_until, email_confirmed_at,
-- professional_category_id, must_change_password) are untouched and still load-bearing.
-- Only the three moved columns leave `v_identity_changed`, because after the next
-- migration those columns do not exist on this table and `new.cpf` would raise at
-- execution time on EVERY update of profiles.
--
-- ⚠ The protection those three arms provided is NOT dropped with them -- it is REPLACED
-- BY A STRONGER ONE, and this is the sentence to check rather than trust: they made the
-- columns service-role-only via a trigger that a signed-in caller reached and was then
-- refused. profile_private_details grants `authenticated` NOTHING and carries no policy,
-- so an in-session caller cannot reach the table to be refused. Refusal moves from a
-- trigger arm to the absence of a grant, which is the boundary `ARM=census`/`ARM=policy`
-- can see and a trigger arm never was. pgTAP 386/396 assert both halves.
-- =====================================================================================
create or replace function public.guard_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
declare
  v_actor_is_admin boolean;
  v_identity_changed boolean;
  v_privilege_changed boolean;
begin
  v_privilege_changed :=
       new.is_admin is distinct from old.is_admin
    or new.is_active is distinct from old.is_active;

  -- AE3 (ADR 0155 D4): `cpf`, `date_of_birth` and `phone` left this list with the columns
  -- themselves. The AFF2 B1 comment that stood here named the latter two as "service-role
  -- only, exactly like cpf directly above them" -- all three still are, enforced now by
  -- profile_private_details having no grant to `authenticated` at all.
  v_identity_changed :=
       new.suspended_until is distinct from old.suspended_until
    or new.email_confirmed_at is distinct from old.email_confirmed_at
    or new.professional_category_id is distinct from old.professional_category_id
    or new.must_change_password is distinct from old.must_change_password;

  if not v_privilege_changed and not v_identity_changed then
    return new;
  end if;

  -- service_role / postgres (no auth.uid) are trusted callers — the action path.
  if auth.uid() is null then
    return new;
  end if;

  -- Identity/lifecycle columns are service-role-only: NO signed-in caller edits them.
  if v_identity_changed then
    raise exception 'identity/lifecycle columns are service-role-only'
      using errcode = 'check_violation';
  end if;

  -- is_admin/is_active: admin-only in-session (legacy behavior preserved).
  select is_admin into v_actor_is_admin
  from public.profiles where id = auth.uid();

  if not coalesce(v_actor_is_admin, false) then
    raise exception 'only an admin may change is_admin/is_active'
      using errcode = 'check_violation';
  end if;

  -- ⭐ CNV-5 / R2-m3 — THE DEMOTION BACKSTOP.  Placed LAST, deliberately: it sits BEHIND
  -- the actor check rather than replacing it, so a non-admin caller still gets the
  -- cheaper `check_violation` above and never reaches this read (400 § 4.2 pins that).
  --
  -- Gated on true->false ONLY.  PROMOTION is untouched — an arm keyed on "is_admin
  -- changed" would refuse legitimate promotions of anchorless people, and would pass
  -- every other cell in 400 (§ 2.9 is the opposite-polarity cell that catches it).
  --
  -- `coalesce` is fail-closed rather than decorative: both columns are NOT NULL today,
  -- and if either ever became nullable a NULL `new.is_admin` reads as "no longer an
  -- admin" and is checked, instead of silently skipping the guard.
  if coalesce(old.is_admin, false)
     and not coalesce(new.is_admin, false)
     and app.person_is_anchorless(new.id)
  then
    raise exception
      'não é possível remover a condição de administrador de plataforma sem antes registrar um vínculo organizacional para esta pessoa'
      using errcode = 'HC0RB';
  end if;

  return new;
end;
$function$;
