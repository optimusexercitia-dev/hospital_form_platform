-- AFF W2 / T2.2 — `list_org_people`: the org-scoped people directory, RATIFIED.
--
-- ADR 0097 D10/D11. This does not invent a disclosure; it DECLARES one that already
-- ships undeclared (finding 1: `list_addable_commission_members` is DEFINER, granted to
-- `authenticated`, gated `is_staff_admin_of OR is_commission_admin_of` — whose hospital
-- leg admits a hospital_admin — and filters `profiles` on `home_organization_id`, so it
-- already returns the whole organisation's roster to any hospital admin, wider than the
-- `profiles` table policy permits). After this migration that reach has a named gate,
-- an ADR, and door coverage.
--
-- ⚠ THE GATE IS AN INLINE PREDICATE, NOT `app.is_org_level_admin_within`
-- (audit MEDIUM-5 + MINOR-1). Two independent reasons, both catalog-verified:
--   * that helper ALSO admits `nsp_org_admin` — handing the full people directory,
--     including the CPF-keyed lookup, to NSP is a disclosure this ADR does not make;
--   * it is NOT unused: it is a live leg of `organizations_select`, so borrowing or
--     editing it moves `organizations` visibility too.
--
-- ⚠ RETURNS EMPTY, NEVER RAISES, for an unauthorized caller — matching
-- `list_addable_commission_members` exactly, so a probe cannot distinguish "no results"
-- from "not allowed".
--
-- ⚠ `cpf` IS NEVER IN THE PAYLOAD (D11). It is an INPUT only, exact-match and
-- full-length, filtered SERVER-SIDE. Partial CPF matching is refused outright: it is an
-- enumeration oracle over national IDs and no workflow needs it.
--
-- ⚠ VOLATILE, not STABLE — unlike its sibling door, this one WRITES (the D11 audit row
-- on CPF-parameterised calls). A STABLE function cannot INSERT.

create or replace function public.list_org_people(
  p_org_id uuid,
  p_search text default null,
  p_cpf    text default null
)
returns table (
  user_id               uuid,
  full_name             text,
  email                 text,
  professional_category text,
  is_active             boolean,
  affiliations          jsonb
)
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
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
      jsonb_build_object('matched', v_matched is not null, 'user_id', v_matched),
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
$$;

revoke all on function public.list_org_people(uuid, text, text) from public;
grant execute on function public.list_org_people(uuid, text, text) to authenticated;

comment on function public.list_org_people(uuid, text, text) is
  'ADR 0097 D10/D11 — the org-scoped people directory. Gated by an INLINE org_admin-or-hospital_admin predicate (NOT app.is_org_level_admin_within, which also admits nsp_org_admin and is load-bearing in organizations_select). Returns EMPTY, never raises, for an unauthorized caller. cpf is an exact-match INPUT and is NEVER in the payload; every p_cpf call emits an audit row carrying matched-or-not and never the digits. Deactivated people ARE returned (with is_active) so the identifier-first flow cannot offer to affiliate an account it should warn about.';
