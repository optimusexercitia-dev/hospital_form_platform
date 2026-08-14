-- =============================================================================
-- DM5 S2 · M2 — `app.can_read_document` gains the `rca` + `capa_action` arms
--
-- Executes ADR 0120 D2 (custody is a READ-TIME input, never a tenancy key) and
-- D14 (capa_action resolves through can_read_capa EXPLICITLY).
--
-- ⭐ THE REGRESSION THIS MIGRATION IS WRITTEN TO AVOID.
-- The `meeting` arm two lines above reads `v_commission` — the commission
-- SNAPSHOTTED on the securable_resources row. That shape is sitting right there
-- to copy, and copying it for `rca` would be the silent authorization
-- regression DM5 step 0 predicted: `patient_safety_event` custody MOVES
-- (`transfer_event_custody`), and a document bound to the commission recorded
-- at registry-mint time would keep serving the ORIGINAL commission's members
-- and refuse the CURRENT custodian's — forever, invisibly, with every static
-- gate green.
--
-- So the `rca` arm resolves `app.can_read_event(app.event_of_rca(...))` AT READ
-- TIME. `can_read_event` already follows custody:
--     is_member_of_for(current_owner_commission_id)      <- moves
--  OR is_member_of_for(reporting_commission_id)          <- stable
--  OR is_pqs_operator_of_for(hospital_of_event(id))      <- hospital tier
--
-- ⚠ The `capa_action` arm does NOT reach for `v_commission` either, and NOT
-- because it would be caught: under D14 that column is NULL for every
-- capa_action row, so such an arm would fail CLOSED. Fail-closed-by-accident is
-- not a design and must not be relied on — the arm names `app.can_read_capa`
-- explicitly, and 341 keystones that it does.
--
-- ⭐ MEASURED BEFORE BEING WRITTEN (the M1 discipline). The custody differential
-- was proven to DISCRIMINATE in a rolled-back txn before these arms existed —
-- one reader, one event, one variable:
--     custody NULL            -> staff1.farm can_read_event = false
--     transfer_event_custody  -> Farmácia    (the REAL RPC, not a raw UPDATE:
--                                `guard_event_status` blocks direct edits past
--                                'triado', so a raw-UPDATE fixture fails at
--                                setup and reads as a defect)
--     custody = Farmácia      -> staff1.farm can_read_event = TRUE
--     negative control        -> an other-hospital reader stays FALSE
--     registry commission_id  -> UNCHANGED at the reporting commission
--
-- ⚠ FIXTURE TRAP, checked and avoided: the reader must belong to the OWNER
-- commission and to NOTHING else that could carry the read. `multi@test.local`
-- is in BOTH CCIH and Farmácia, and `pqsdual.a@test.local` is a PQS member of
-- the event's hospital — either would turn the differential green while proving
-- nothing. `staff1.farm@test.local` was verified against all three arms:
--   is_pqs_operator_of_for(event hospital) = false
--   is_member_of_for(reporting CCIH)       = false
--   is_member_of_for(owner Farmácia)       = true
-- so ONLY the custody arm can make it true.
--
-- ⚠ CENSUS BLIND CLASS: both arms live inside a `prosecdef` boolean that every
-- §6 authz arm already covers as a NAME, so census/hat/floor/wrapper will pass
-- regardless of what these arms say. The bespoke 341 keystones are the ONLY
-- coverage that exists for them.
--
-- Rebuilt with CREATE OR REPLACE (never DROP+CREATE): a rebuild loses the ACL
-- and resets privileges. Properties re-asserted below from the catalog.
-- =============================================================================

begin;

create or replace function app.can_read_document(p_document_id uuid, p_uid uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_resource uuid;
  v_type text;
  v_commission uuid;
  v_conf text;
  v_case uuid;
begin
  if p_uid is null then
    return false;
  end if;
  if not app.is_active(p_uid) then
    return false;
  end if;
  select d.home_resource_id, s.resource_type, s.commission_id, d.confidentiality_level
    into v_resource, v_type, v_commission, v_conf
  from public.documents d
  join public.securable_resources s on s.id = d.home_resource_id
  where d.id = p_document_id;
  if v_resource is null then
    return false;
  end if;
  if not (case v_type
    when 'case' then app.can_read_case(v_resource, p_uid)
    when 'meeting' then app.is_member_of_for(v_commission, p_uid)
    when 'interview' then app.can_read_interview(v_resource, p_uid)
    when 'action_item' then app.can_read_action_item(v_resource, p_uid)
    -- DM3 Wave B: the owning commission's members, PLUS the entitled approver
    -- corridor inherited from the retiring bucket policy. v_resource IS the
    -- controlled_documents.id (shared-PK registry link, ADR 0114 D4).
    when 'controlled_document' then
      app.is_member_of_for(v_commission, p_uid)
      or app.is_document_approver_of(v_resource, p_uid)
    -- DM4 Wave C: the referral METADATA tier (broad half of the two-tier
    -- asymmetry — ADR 0119 D2). Bytes are gated separately, and narrower,
    -- in open_document_version.
    when 'case_referral' then app.can_read_referral_metadata(v_resource, p_uid)
    -- DM5 Wave D (ADR 0120 D2): CUSTODY-FOLLOWING, resolved at read time.
    -- ⚠ Deliberately NOT `v_commission` — see the header. The registry pins the
    -- REPORTING commission for tenancy; who may READ follows custody, and
    -- can_read_event is the single place that knows how.
    when 'rca' then app.can_read_event(app.event_of_rca(v_resource), p_uid)
    -- DM5 Wave D (ADR 0120 D14): EXPLICITLY through can_read_capa, which
    -- carries all three of its arms (PQS operator of the plan's hospital, the
    -- event corridor, and the Phase-15 indicator-commission escalation).
    -- v_resource IS the capa_action.id; can_read_capa takes the PLAN id.
    -- Inlined rather than given an `app.capa_of_action` helper on purpose: a
    -- new DEFINER function would have to join the census domain AND the
    -- committed findings file in this same phase (ADR 0079 Am. 7), and this
    -- resolves structure, not authority.
    when 'capa_action' then app.can_read_capa(
      (select ca.capa_id from public.capa_action ca where ca.id = v_resource), p_uid)
    else false
  end) then
    return false;
  end if;
  -- D15 ceiling (ADR 0114 Amendment 1; ADR 0072 D7 semantics): the two
  -- enforcing labels gate ABOVE home-resource read, as an AND-conjunct.
  -- Clearance = case_access_grants.max_confidentiality via the surviving
  -- app.confidentiality_clearance_ok (reused, never reimplemented).
  if v_conf in ('legal_privileged', 'credentialing_sensitive') then
    v_case := case v_type
      when 'case' then v_resource
      when 'interview' then app.case_of_interview(v_resource)
      else null
    end;
    if v_case is null then
      -- Fail-closed backstop: an enforcing label with no clearance plane is
      -- readable by NO ONE. Unrepresentable while the S1 seam guard stands;
      -- this arm governs any bypass and any future home type until the
      -- Phase-19 access plane (D16) absorbs the column. DM3 note: a
      -- controlled_document home lands HERE by design — Wave B documents can
      -- never carry an enforcing label, which is precisely why ethics letters
      -- home on the CASE resource instead (ADR 0114 Amendment 2). DM4 note:
      -- a case_referral home lands here too — and the FREEZE of an
      -- enforcing-labelled case document is refused outright (HC0DC,
      -- ADR 0119 D4), so the ceiling cannot be laundered through a referral.
      -- DM5 note: `rca` and `capa_action` land here too, deliberately — NSP
      -- evidence has no clearance plane, so an enforcing label on it is
      -- unreadable by everyone rather than silently downgraded.
      return false;
    end if;
    return app.confidentiality_clearance_ok(v_case, v_conf, p_uid);
  end if;
  return true;
end;
$function$;

-- Property re-assertion FROM THE CATALOG (the "a rebuild loses properties"
-- class: a DROP+CREATE loses the ACL, a param rename resets privileges).
-- CREATE OR REPLACE preserves them, and this proves it rather than assuming.
do $$
declare
  v_secdef boolean;
  v_vol "char";
  v_cfg text;
  v_acl text;
begin
  select p.prosecdef, p.provolatile, array_to_string(p.proconfig, ','),
         array_to_string(p.proacl, ',')
    into v_secdef, v_vol, v_cfg, v_acl
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'app' and p.proname = 'can_read_document';

  if not v_secdef then
    raise exception 'can_read_document lost SECURITY DEFINER';
  end if;
  if v_vol <> 's' then
    raise exception 'can_read_document is no longer STABLE (got %)', v_vol;
  end if;
  if v_cfg is distinct from 'search_path=app, public, pg_catalog' then
    raise exception 'can_read_document lost its search_path pin (got %)', v_cfg;
  end if;
  if v_acl not like '%authenticated=X/postgres%' then
    raise exception 'can_read_document lost the authenticated EXECUTE grant (got %)', v_acl;
  end if;
end $$;

commit;
