-- =============================================================================
-- QO·A M7 — the cross-committee board summary door (ADR 0100 D6/D10).
--
-- Per oversight-visible commission of hospitals the caller reviews: commission
-- ref + three PHI-FREE counts. Why a DEFINER door: the locked count tallies
-- `explicit_grants_only` rows that are RLS-INVISIBLE to the reviewer by design
-- (D6) — only a DEFINER body can count what the caller cannot read, and a count
-- is all it exposes (no ids, no labels, no content).
--
-- COUNT SEMANTICS (disjoint BY CONSTRUCTION — lead ruling g, pinned by pgTAP 310):
--   total_cases  = the READABLE population: per-row app.can_read_case — the
--                  single case-read boundary (never a policy re-derivation).
--                  Includes a locked case the caller holds an explicit grant on
--                  (S3 — exceptions ride grants).
--   open_cases   = readable AND status not in ('completed','cancelled') — the
--                  predicate REUSED from public.count_open_cases_for_board;
--                  never a second definition of "open". open ⊆ total.
--   locked_cases = explicit_grants_only rows the caller CANNOT read (NOT
--                  can_read_case). Disjoint from total_cases by construction:
--                  membership here requires the readability test to fail.
--                  total EXCLUDES locked.
--
-- ⛔ NEVER add a coordinator/admin/reviewer short-circuit around the per-row
-- can_read_case — the list_cases_board lesson: it reads as a cost saving and is
-- a boundary bypass. Cost is one resolver call per case of each visible
-- commission (~0.5 ms/row measured at A5), board-scale.
-- =============================================================================

create function public.quality_board_summary(p_organization_id uuid)
 returns table(
   commission_id   uuid,
   commission_name text,
   -- extensions.citext, SCHEMA-QUALIFIED deliberately: CREATE FUNCTION resolves
   -- parameter/return types against the SESSION search_path at creation time, not
   -- against this function's own `set search_path` below. The local apply path has
   -- `extensions` on its search_path and a bare `citext` worked; the remote
   -- `db push` login role does NOT, and it failed with 42704 "type citext does not
   -- exist" after M1-M6 had already landed. `commissions.slug` is citext on both
   -- sides — the type was never the divergence, the resolution path was.
   commission_slug extensions.citext,
   hospital_id     uuid,
   hospital_name   text,
   total_cases     integer,
   open_cases      integer,
   locked_cases    integer)
 language plpgsql
 stable security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_uid uuid := (select auth.uid());
begin
  -- Gate: an ACTIVE principal holding >= 1 unexpired quality_reviewer membership
  -- in THIS org (cross-org callers and expired reviewers take the same 42501).
  if not (app.is_active(v_uid) and exists (
      select 1 from public.memberships m
      where m.principal_id = v_uid
        and m.role = 'quality_reviewer'
        and m.organization_id = p_organization_id
        and (m.expires_at is null or m.expires_at > now()))) then
    raise exception 'apenas revisores da qualidade da organização podem acessar o painel'
      using errcode = '42501';
  end if;

  return query
  select c.id,
         c.name,
         c.slug,
         h.id,
         h.name,
         coalesce(agg.n_total, 0),
         coalesce(agg.n_open, 0),
         coalesce(agg.n_locked, 0)
  from public.commissions c
  join public.hospitals h on h.id = c.hospital_id
  left join lateral (
    select count(*) filter (where r.readable)::int                                                        as n_total,
           count(*) filter (where r.readable and r.status not in ('completed','cancelled'))::int          as n_open,
           count(*) filter (where r.visibility_policy = 'explicit_grants_only' and not r.readable)::int   as n_locked
    from (
      select ca.status, ca.visibility_policy,
             app.can_read_case(ca.id, v_uid) as readable
      from public.cases ca
      where ca.commission_id = c.id
    ) r
  ) agg on true
  where h.organization_id = p_organization_id
    and c.quality_oversight = 'visible'
    and app.is_quality_reviewer_of_for(h.id, v_uid)
  order by h.name, c.name;
end;
$function$;

revoke all on function public.quality_board_summary(uuid) from public;
grant execute on function public.quality_board_summary(uuid) to service_role;
grant execute on function public.quality_board_summary(uuid) to authenticated;
