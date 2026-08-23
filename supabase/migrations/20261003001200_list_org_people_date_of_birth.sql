-- AFF2 B3 — `list_org_people` payload gains `date_of_birth`.
-- ADR 0133 D11, as corrected by Amendment 1 ruling 4.
--
-- WHY DOB REACHES THIS DOOR AT ALL. D10 as first written said the new columns were
-- "readable only on the admin management surface". Amendment 1 ruling 4 corrected it: DOB
-- has TWO read paths — the profile rail behind the person-scope authorizer, AND this
-- audited directory door, whose gate is org_admin OR any hospital_admin of the org. D11's
-- homonym rationale REQUIRES exactly that reach, because the colliding same-named person
-- is typically at another hospital in the network. `phone` keeps ONE path and stays out of
-- this payload: it differentiates nothing in a homonym match.
--
-- ⛔ THIS CANNOT BE `CREATE OR REPLACE`. Adding a column to a `RETURNS TABLE` changes the
-- function's return type, which `CREATE OR REPLACE FUNCTION` refuses. It is a DROP+CREATE,
-- and a DROP silently discards four things the CREATE must put back:
--   1. the ACL,  2. SECURITY DEFINER,  3. the pinned `SET search_path`,  4. the COMMENT.
-- All four are restored below and each is asserted independently in
-- `supabase/tests/361_list_org_people_dob.sql` §2 and §5 — "the function exists and the
-- body looks right" would notice none of them.
--
-- ⛔ THE ACL RESTORE IS NOT OPTIONAL AND ITS OBVIOUS TEST DOES NOT WORK. Measured in a
-- scratch transaction on this database before writing this file: a fresh `create function`
-- in `public` comes back with
--     =X/postgres | postgres=X/postgres | service_role=X/postgres
-- The acl is NOT NULL — so a `proacl is not null` check passes — and the leading
-- `=X/postgres` is the PUBLIC grant, which `anon` holds by inheritance. Hence the explicit
-- `revoke ... from public` below, and hence 361's 2.1 being an EXACT acl differential
-- rather than a null-check. Measured pre-DROP acl, which is what the grants below restore:
--     postgres=X/postgres | service_role=X/postgres | authenticated=X/postgres
--
-- ⛔ THE BODY IS RE-EMITTED FROM THE LIVE `pg_get_functiondef`, never from migration text.
-- Migration files are stale by design in this repo — several rewrite function bodies at
-- runtime via `pg_get_functiondef` + `replace` + `execute`, so no file can be trusted to
-- match the live body. Three prior migrations have written this function
-- (20260909000600 created it, 20260909001300 added the CPF audit, 20260918002500 added the
-- ACT active-hat conjunct); the text below is the LIVE composition of all three, with
-- exactly two anchored edits:
--   (a) `date_of_birth date` appended to the RETURNS TABLE, and
--   (b) `pr.date_of_birth` appended to the final SELECT list.
-- Appended rather than inserted mid-list so the existing columns keep their ordinal
-- positions — reads are by name (PostgREST, and `src/lib/queries/affiliations.ts` maps by
-- key), but a positional consumer arriving later inherits an unchanged prefix.
--
-- ⚠ FUP-SIGNATURE-STRING-CALLERS-ABORT-ON-A-DROP-CREATE was SWEPT before this drop.
-- Property swept: every textual `list_org_people(<types>)` signature string across
-- supabase/tests, supabase/migrations, src/, e2e/ and seed.sql. ~45 hits, exactly ONE
-- executable — `supabase/tests/302_affiliation_doors.sql:79`, which names
-- `'public.list_org_people(uuid,text,text)'`. This change alters the RETURN type only and
-- leaves the argument list identical, so that string keeps resolving and the abort hazard
-- does not fire. Pinned going forward by 361's 1.2, which asserts the exact
-- `oid::regprocedure::text` so a FUTURE arity change reds beside its reason instead of
-- aborting an unrelated suite with a "Bad plan" that names no function.
--
-- No new door, no new role, no `prosecdef` flip: the gate, the CPF exact-match block and
-- the audit emission are byte-identical to the live body.

drop function public.list_org_people(uuid, text, text);

create function public.list_org_people(
  p_org_id uuid,
  p_search text default null::text,
  p_cpf text default null::text
)
returns table(
  user_id uuid,
  full_name text,
  email text,
  professional_category text,
  is_active boolean,
  affiliations jsonb,
  date_of_birth date          -- AFF2 B3 / ADR 0133 D11 (edit (a))
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
           '[]'::jsonb),
         pr.date_of_birth          -- AFF2 B3 / ADR 0133 D11 (edit (b))
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

-- Restore the ACL the DROP discarded. REVOKE precedes GRANT: the fresh CREATE above
-- carries a PUBLIC entry (measured — see the header), which anon inherits.
revoke all on function public.list_org_people(uuid, text, text) from public;
grant execute on function public.list_org_people(uuid, text, text) to authenticated;
grant execute on function public.list_org_people(uuid, text, text) to service_role;

-- Restore the COMMENT the DROP discarded, updated for the new payload (a comment that
-- still described the old one would be a fresh stale-record instance).
comment on function public.list_org_people(uuid, text, text) is
  'ADR 0097 D10/D11 — the org-scoped people directory. Gated by an INLINE '
  'org_admin-or-hospital_admin predicate (NOT app.is_org_level_admin_within, which also '
  'admits nsp_org_admin and is load-bearing in organizations_select). Returns EMPTY, never '
  'raises, for an unauthorized caller. cpf is an exact-match INPUT and is NEVER in the '
  'payload; every p_cpf call emits an audit row carrying matched-or-not and never the '
  'digits. Deactivated people ARE returned (with is_active) so the identifier-first flow '
  'cannot offer to affiliate an account it should warn about. '
  'AFF2 B3 (ADR 0133 D11 / Amdt 1 ruling 4): the payload also carries date_of_birth — this '
  'door is DOB''s SECOND read path, and D11''s homonym rationale requires that reach because '
  'the colliding same-named person is typically at another hospital. `phone` is '
  'deliberately NOT in the payload: it differentiates nothing in a homonym match.';
