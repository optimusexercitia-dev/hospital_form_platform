-- AFF F4 — the CPF existence oracle is audited on BOTH of its halves.
--
-- ADR 0097 LOW-3 names TWO probes as forming the oracle: `list_org_people`'s exact-match
-- `p_cpf` lookup AND `registerUser`'s collision block. D11's audit row is the stated
-- compensating control for that oracle — but only the first half emitted one, while the
-- registration block is platform-wide, cleanly distinguishable (a collision returns a
-- field error, a miss proceeds), and left no trace at all. Auditing one half is
-- inconsistent with the reasoning that justified the control.
--
-- Two changes, and neither records the digits (Rule 11: that and who, never the payload):
--
--  1. a new service-role door for the registration probe, and
--  2. `list_org_people`'s metadata gains `'source': 'directory'` so the two halves are
--     told apart by a PRESENT value rather than by the ABSENCE of a key — an auditor
--     should never have to reason from what is missing.
--
-- `list_org_people`'s body regenerated from LIVE `pg_get_functiondef` with one anchored
-- replacement; the gate, the payload and the exact-match rule are untouched.

CREATE OR REPLACE FUNCTION public.list_org_people(p_org_id uuid, p_search text DEFAULT NULL::text, p_cpf text DEFAULT NULL::text)
 RETURNS TABLE(user_id uuid, full_name text, email text, professional_category text, is_active boolean, affiliations jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_uid     uuid := (select auth.uid());
  v_q       text := nullif(btrim(coalesce(p_search, '')), '');
  v_cpf     text := nullif(btrim(coalesce(p_cpf, '')), '');
  v_matched uuid;
begin
  -- THE GATE (D10). Inline, deliberately — see the header.
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
    where pr.home_organization_id = p_org_id
      and not pr.is_admin
      and pr.cpf = v_cpf;

    -- D11 / audit LOW-2: EVERY CPF-parameterised call emits an audit row — actor, org,
    -- and whether it matched (with the matched user_id when it did). NEVER the digits:
    -- Rule 11 records THAT and WHO, never the payload. Name/email searches do not emit,
    -- matching the existing directory door.
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
               and a.organization_id = p_org_id),
           '[]'::jsonb)
    from public.profiles pr
    left join public.professional_categories pc on pc.id = pr.professional_category_id
   where pr.home_organization_id = p_org_id
     -- platform_admin is not a tenant person and never belongs on a tenant roster
     -- (the noun rule, ADR 0078 A35).
     and not pr.is_admin
     and (v_matched is null or pr.id = v_matched)
     and (v_q is null
          or pr.full_name ilike '%' || v_q || '%'
          or pr.email ilike '%' || v_q || '%')
   order by pr.full_name nulls last, pr.email
   limit 500;
end;
$function$;

-- The registration-side probe. SERVICE-ROLE ONLY: `registerUser` runs on the admin
-- client, and the interactive probe is already audited inside `list_org_people` itself.
create or replace function public.log_cpf_probe_for(
  p_actor   uuid,
  p_org_id  uuid,
  p_matched uuid default null
)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  if p_actor is null or p_org_id is null then
    raise exception 'ator ou organização não identificados' using errcode = '42501';
  end if;

  -- ⚠ THE ACTOR RIDES IN THE METADATA, NOT IN `actor_id`, AND THAT IS A KNOWN GAP —
  -- stated here rather than left for an auditor to discover. `app.audit_write` takes no
  -- actor parameter; it derives `auth.uid()`, which is NULL on every service-role path.
  -- That is PLATFORM-WIDE and pre-existing (`membership.granted`, `form.created` and
  -- `affiliation.created` are all unattributed the same way), so it is NOT fixed here —
  -- it is a separate workstream. Threading the actor through the metadata means this
  -- probe records WHO without pretending the `actor_id` column is populated.
  perform app.audit_write(
    'person.cpf_lookup', 'organization', p_org_id, null,
    case when p_matched is null
         then 'Consulta de pessoa por CPF no cadastro (sem correspondência)'
         else 'Consulta de pessoa por CPF no cadastro (com correspondência)' end,
    jsonb_build_object('matched', p_matched is not null, 'user_id', p_matched,
                       'source', 'registration', 'actor_user_id', p_actor),
    p_org_id, null);
end;
$$;

revoke all on function public.log_cpf_probe_for(uuid, uuid, uuid) from public;
grant execute on function public.log_cpf_probe_for(uuid, uuid, uuid) to service_role;

comment on function public.log_cpf_probe_for(uuid, uuid, uuid) is
  'ADR 0097 LOW-3 / D11 — audits the REGISTRATION-side half of the CPF existence oracle (registerUser''s collision block). Never records the digits. Service-role only; the interactive half is audited inside list_org_people.';
