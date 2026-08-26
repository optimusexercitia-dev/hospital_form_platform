-- ============================================================================
-- AFF4 · B6a — `list_org_people` moves off `profiles.home_organization_id` onto the
-- org-affiliation predicate. ADR 0151 D10, as amended by ADR 0154.
--
-- ⚠ ADR 0151 D10 NAMES THIS FUNCTION AS "THE ROSTER PREDICATE" AND IT IS NOT. Measured
--    2026-08-26, this door has exactly ONE caller — `lookupOrgPeople`
--    (`src/lib/affiliations/actions.ts`), the add-a-person CPF/name search. The actual
--    directory roster is `listOrgUsers`/`listHospitalUsers`, which move in B6b. ADR 0154
--    records the correction; both surfaces move, and they move with DIFFERENT DEFAULTS —
--    see the `p_include_ended` note below.
--
-- ⛔ WHAT DOES **NOT** CHANGE, stated so a later reader does not "finish the job":
--    * The RLS legs and the tenant trigger STAY on `home_organization_id`. D10 names that
--      a Phase 2 follow-on. The split being applied: "roster predicate" = the application
--      query's filter; "existing legs" = the policies.
--    * The GATE predicate (org_admin OR active hospital_admin hat) is byte-identical.
--    * The CPF-lookup audit behaviour is byte-identical — `person.cpf_lookup`, one row per
--      p_cpf call, match and miss alike, NEVER the digits (Rule 11). This door is the one
--      place that emits it, which is exactly why B6b does NOT route the directory through
--      here (ADR 0154's rejected alternative: it would emit a lookup-audit row on every
--      directory page view).
--
-- ⭐ `p_include_ended` DEFAULTS TO FALSE, AND THE ONE CALLER PASSES TRUE. The default is
--    active-only because narrowing can be wrong and safe while widening cannot. The single
--    explicit widener is `lookupOrgPeople`: D5's one-step rehire is impossible if a hospital
--    admin cannot FIND the person they are trying to re-employ. `true` means EVER HELD, not
--    "ended only" — an active affiliation is still a match.
--
-- ⛔ VOIDED IS EXCLUDED IN BOTH MODES. A voided affiliation is a record that the employment
--    never should have existed (D7/D8); it is not a weaker form of "ended", and it must not
--    make a person findable.
--
-- ⚠ DROP + CREATE, not CREATE OR REPLACE: the RETURNS TABLE gains two columns, and the
--    argument list gains `p_include_ended`. Every `has_function_privilege('…(uuid,text,text)')`
--    string naming the old arity is updated in the same change
--    (`FUP-SIGNATURE-STRING-CALLERS-ABORT-ON-A-DROP-CREATE`: a stale one ABORTS a suite as a
--    plan mismatch that names no function). The grants are re-issued below — a DROP takes
--    the ACL with it, and `list_org_people` running ungranted is a 404, not an error anyone
--    would trace back to here.
--
-- ⚠ THE BODY BELOW WAS AUTHORED FROM THE LIVE `pg_get_functiondef`, not from migration
--    text; the two differ on this project by design (ADR 0078 A28).
-- ============================================================================

drop function if exists public.list_org_people(uuid, text, text);

create function public.list_org_people(
  p_org_id         uuid,
  p_search         text    default null,
  p_cpf            text    default null,
  p_include_ended  boolean default false
)
returns table(
  user_id                  uuid,
  full_name                text,
  email                    text,
  professional_category    text,
  is_active                boolean,
  affiliations             jsonb,
  date_of_birth            date,
  org_affiliation_status   text,
  org_affiliation_ended_on date
)
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
  -- THE GATE (D10). Inline, deliberately — see the header. UNCHANGED by AFF4.
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
  if v_cpf is not null then
    select pr.id into v_matched
    from public.profiles pr
    where not pr.is_admin
      and pr.cpf = v_cpf
      -- AFF4 D10: was `pr.home_organization_id = p_org_id`.
      and exists (
        select 1 from public.organization_affiliations oa
         where oa.principal_id = pr.id
           and oa.organization_id = p_org_id
           and oa.voided_at is null
           and (p_include_ended or oa.ended_on is null)
      );

    -- D11 / audit LOW-2: EVERY CPF-parameterised call emits an audit row — actor, org,
    -- and whether it matched (with the matched user_id when it did). NEVER the digits:
    -- Rule 11 records THAT and WHO, never the payload. Name/email searches do not emit,
    -- matching the existing directory door. ⛔ BYTE-IDENTICAL TO THE PRE-AFF4 BODY.
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
         pr.date_of_birth,         -- AFF2 B3 / ADR 0133 D11 (edit (b))
         -- AFF4 D10: the ORG-affiliation tense, so the one caller that widens to ended
         -- people can SAY which ones are ended instead of presenting them identically.
         -- 'ativo' whenever ANY non-voided active row exists; otherwise 'encerrado'.
         case when oa.ended_on is null then 'ativo' else 'encerrado' end,
         oa.ended_on
    from public.profiles pr
    left join public.professional_categories pc on pc.id = pr.professional_category_id
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
     -- qualifying affiliation, so it IS the predicate — there is no second copy of it to
     -- drift from this one.
     and (v_matched is null or pr.id = v_matched)
     and (v_q is null
          or pr.full_name ilike '%' || v_q || '%'
          or pr.email ilike '%' || v_q || '%')
   order by pr.full_name nulls last, pr.email
   limit 500;
end;
$function$;

-- The DROP took the ACL with it. Re-issued to exactly the pre-AFF4 audience
-- (`postgres=X, service_role=X, authenticated=X`), measured before the drop.
revoke execute on function public.list_org_people(uuid, text, text, boolean) from public;
grant execute on function public.list_org_people(uuid, text, text, boolean) to authenticated;
grant execute on function public.list_org_people(uuid, text, text, boolean) to service_role;

comment on function public.list_org_people(uuid, text, text, boolean) is
  'AFF W3 / ADR 0097 D10-D11, re-predicated by AFF4 (ADR 0151 D10 as amended by ADR '
  '0154). The org-scoped people directory behind the add-a-person search. Membership of '
  'the org is an ORG AFFILIATION, not `profiles.home_organization_id`; voided '
  'affiliations never match. `p_include_ended` defaults to FALSE (active only) and is '
  'passed TRUE by `lookupOrgPeople` so D5''s one-step rehire can find an offboarded '
  'person. Gated on org_admin OR an active hospital_admin hat; an unauthorized caller '
  'receives an EMPTY set, never an error. Every p_cpf call emits `person.cpf_lookup` '
  'naming the actor and never the digits. PAYLOAD (9 columns): user_id, full_name, '
  'email, professional_category, is_active, affiliations, date_of_birth, '
  'org_affiliation_status (''ativo''/''encerrado'') and org_affiliation_ended_on. '
  '⛔ `cpf` and `phone` are NOT returned and must stay out (D11/D12).';
