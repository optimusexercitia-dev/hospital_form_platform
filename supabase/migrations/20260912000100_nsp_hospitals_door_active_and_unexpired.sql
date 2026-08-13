-- =============================================================================
-- QO·FUP F8 — `public.list_my_nsp_hospitals()` honours `is_active` and expiry.
-- Closes FUP-QO-8. Mirror-sibling tightening; no new shape.
--
-- THE DEFECT. This DEFINER door read `public.memberships` RAW: no `app.is_active`
-- gate and no `expires_at is null or expires_at > now()` filter. Every sibling
-- predicate carries both —
--   app.is_pqs_member_of_for      -> is_active + has_role (has_role filters expiry)
--   app.is_pqs_member_of_any      -> is_active + explicit expiry filter
--   app.is_pqs_operator_in_org_for-> is_active + explicit expiry filter + hospital_id
-- — so this door was the single place in the NSP lane where a DEACTIVATED or EXPIRED
-- principal still resolved operator hospitals.
--
-- ⚠ WHY IT WAS NOT MERELY COSMETIC. In the console path
-- (`getNspAccessByOrg` -> `organizations_select`) the org read carries the correct
-- filters, so the shell was saved by the ORG READ rather than by this door — the
-- laxity was invisible there. But `src/components/indicators/capa-operator-gate.ts:26`
-- calls `listMyNspHospitals()` DIRECTLY, outside that cover: an expired or
-- deactivated `pqs_member` kept the "Abrir plano de ação (CAPA)" affordance. Display
-- only (`open_capa_plan` re-gates, 42501), so no data leak — but a door whose own
-- gate is weaker than every sibling's is exactly the shape that becomes a leak the
-- next time someone reads from it, and it is invisible to a policy-shaped audit
-- because prosecdef REPLACES RLS.
--
-- CALLER SWEEP (catalog + repo, done before writing this):
--   • SQL: ZERO. No function in app/public and no RLS policy references it
--     (comment-stripped prosrc scan + pg_policies scan).
--   • TS: exactly one RPC site — src/lib/queries/pqs.ts:223 (`listMyNspHospitals`),
--     consumed by src/lib/queries/session.ts (getNspAccessByOrg) and
--     src/components/indicators/capa-operator-gate.ts.
--   • NOBODY depends on seeing expired or inactive rows: both consumers ask "may this
--     caller operate here NOW". The laxity is not load-bearing.
--
-- SHAPE. `is_active` lives in the `me` CTE rather than a CASE in the target list, so
-- an inactive caller yields an EMPTY `me`, both arms return no rows, and the existing
-- `coalesce(jsonb_agg(...), '[]')` produces `[]` — the documented safe default, with
-- no second exit path to keep in sync. `hospital_id is not null` is added to the
-- `pqs_member` arm for symmetry with its sibling (the join to `hospitals` already
-- dropped NULLs, so this changes no row; it stops the two arms from LOOKING different
-- for no reason).
--
-- Rebuild posture: `create or replace`, unchanged signature — ACL / owner / proconfig
-- / prosecdef / volatility preserved by construction (a DROP+CREATE silently loses the
-- ACL, and this door's `authenticated=X/postgres` grant IS its reachability). Catalog
-- snapshot taken before:
--   public.list_my_nsp_hospitals() secdef=true owner=postgres
--   cfg=search_path=app, public, pg_catalog vol=s lang=sql rettype=jsonb
--   acl=postgres=X/postgres authenticated=X/postgres service_role=X/postgres
-- pgTAP 145 §I re-asserts the ACL and the behaviour.
-- =============================================================================

create or replace function public.list_my_nsp_hospitals()
returns jsonb
language sql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
  with me as (
    -- QO·FUP F8: the outer activity gate, mirroring every sibling predicate. An
    -- inactive (deactivated or currently suspended) caller resolves to NO rows here,
    -- which collapses both arms below and returns the '[]' safe default.
    select (select auth.uid()) as uid
     where app.is_active((select auth.uid()))
  ),
  grants as (
    select m.hospital_id, false as is_coord
      from public.memberships m
      join me on m.principal_id = me.uid
     where m.role = 'pqs_member'
       and m.hospital_id is not null
       -- QO·FUP F8: an expired enrollment is not an enrollment. `app.has_role` has
       -- always applied this filter; this door never did.
       and (m.expires_at is null or m.expires_at > now())
    union all
    select m.hospital_id, true as is_coord
      from public.memberships m
      join me on m.principal_id = me.uid
     where m.role = 'nsp_coordinator'
       and m.hospital_id is not null
       and (m.expires_at is null or m.expires_at > now())
  ),
  rolled as (
    select hospital_id, bool_or(is_coord) as is_coord from grants group by hospital_id
  )
  select coalesce(jsonb_agg(
           jsonb_build_object(
             'hospitalId', h.id, 'hospitalName', h.name, 'orgId', h.organization_id,
             'role', case when r.is_coord then 'coordinator' else 'member' end
           ) order by h.name
         ), '[]'::jsonb)
  from rolled r join public.hospitals h on h.id = r.hospital_id;
$function$;

comment on function public.list_my_nsp_hospitals() is
  'The hospitals whose NSP the CURRENT user operates (pqs_member OR nsp_coordinator), '
  'name-sorted, coordinator winning when both are held. QO·FUP F8 / FUP-QO-8: gated on '
  'app.is_active and on unexpired grants, matching app.is_pqs_operator_in_org_for — it '
  'read memberships raw until 2026-08-07, and capa-operator-gate.ts calls it outside '
  'the org-read cover that was masking that. Safe default: [].';
