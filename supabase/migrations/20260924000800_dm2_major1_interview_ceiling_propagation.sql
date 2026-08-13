-- =============================================================================
-- DM2 QA r1 MAJOR-1 / S1-O4 — propagate the INTERVIEW's confidentiality ceiling
-- to its documents (PO ruling 2026-08-13: PROPAGATE; ADR 0117 Amendment 1;
-- governing frame ADR 0114 Amendment 1 D15/D16).
--
-- The defect (lead-reproduced as a differential probe — same member, same
-- interview, one variable): app.can_read_interview(iv, member) = false while
-- app.can_read_document(doc_homed_on_iv, member) = true. The kernel's
-- interview arm dispatched
--   can_read_case_committee(case_of_interview(v_resource), p_uid)
-- which SKIPS A LEVEL — it asks who may read the case, never who may read
-- THIS interview, so case_interviews.confidentiality_level was never
-- consulted for documents. The interview row was hidden; its transcript was
-- not (the F-01 shape: authorized from a path without joining the row).
--
-- The fix: dispatch the arm to app.can_read_interview(v_resource, p_uid),
-- which IS (catalog-verified 2026-08-13, pg_get_functiondef):
--   exists (select 1 from case_interviews ci where ci.id = p_interview_id
--     and can_read_case_committee(ci.case_id, p_uid)
--     and confidentiality_clearance_ok(ci.case_id, ci.confidentiality_level, p_uid))
-- i.e. exactly the current arm's predicate PLUS the missing clearance
-- conjunct, row-joined. It cannot over-narrow: confidentiality_clearance_ok
-- returns true for every non-enforcing label (328 K15t twins pin that), and
-- for a missing interview row both old and new arms fail closed. All
-- functions involved are STABLE SECURITY DEFINER with pinned search_path —
-- the nesting mirrors the sibling arms (can_read_case, can_read_action_item).
--
-- DISTINCT from the D15 arm below the dispatch (which gates on the DOCUMENT's
-- own label): this is the INTERVIEW's label. Both must hold; the D15 arm is
-- untouched (its `when 'interview' then app.case_of_interview(v_resource)`
-- case-resolution text does not match the dispatch string edited here).
--
-- Method (ADR 0117 decision 5 precedent): re-emit derived from the LIVE
-- pg_get_functiondef — never from migration file text, which is stale by
-- design — guarded by in-migration drift asserts (pre: the level-skipping
-- dispatch present exactly once, no can_read_interview reference; post: new
-- arm present, old arm gone, prosecdef, pinned search_path, ACL unchanged).
--
-- Keystones: supabase/tests/328_dm1_document_substrate.sql K15 (authored
-- red-first; K15k1–k4 + K15s1 observed RED on the real pre-fix catalog —
-- output quoted in docs/progress/dm2-orchestration-wave-a.md).
-- Blast radius (censused, not assumed): local pre-fix, every interview
-- carries non_phi_internal (13 rows incl. E2E artifacts; the seed mints 1);
-- ZERO enforcing-label interviews exist locally, production is pre-pilot
-- empty — the keystones plant their own enforcing fixture.
-- =============================================================================

do $$
declare
  v_oid  oid;
  v_def  text;
  v_new  text;
  v_acl_pre  aclitem[];
  v_acl_post aclitem[];
  v_secdef boolean;
  v_config text;
  v_cnt  int;
  v_target text :=
    $t$when 'interview' then app.can_read_case_committee(app.case_of_interview(v_resource), p_uid)$t$;
  v_replacement text :=
    $t$when 'interview' then app.can_read_interview(v_resource, p_uid)$t$;
begin
  select p.oid, pg_get_functiondef(p.oid), p.proacl
    into v_oid, v_def, v_acl_pre
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'app' and p.proname = 'can_read_document';

  if v_oid is null then
    raise exception 'DRIFT: app.can_read_document not found in the catalog';
  end if;

  -- Pre-edit drift asserts against the LIVE body.
  v_cnt := (length(v_def) - length(replace(v_def, v_target, ''))) / length(v_target);
  if v_cnt <> 1 then
    raise exception 'DRIFT: expected the level-skipping interview dispatch exactly once in app.can_read_document, found % — live body has diverged from what this migration was written against; re-derive before applying', v_cnt;
  end if;
  if v_def like '%can_read_interview%' then
    raise exception 'DRIFT: app.can_read_document already references can_read_interview pre-edit';
  end if;
  if position('confidentiality_clearance_ok' in v_def) = 0 then
    raise exception 'DRIFT: the D15 ceiling arm is missing from the kernel pre-edit (this migration assumes it is present and leaves it untouched)';
  end if;

  v_new := replace(v_def, v_target, v_replacement);
  if v_new = v_def then
    raise exception 'DRIFT: the edit was a no-op';
  end if;
  execute v_new;

  -- Post-edit asserts, from the catalog (never from this file's text).
  select pg_get_functiondef(p.oid), p.proacl, p.prosecdef,
         array_to_string(p.proconfig, '|')
    into v_def, v_acl_post, v_secdef, v_config
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'app' and p.proname = 'can_read_document';

  if position(v_replacement in v_def) = 0 then
    raise exception 'POST: the can_read_interview dispatch arm is absent after the edit';
  end if;
  if position(v_target in v_def) > 0 then
    raise exception 'POST: the level-skipping dispatch survived the edit';
  end if;
  if position('confidentiality_clearance_ok' in v_def) = 0 then
    raise exception 'POST: the D15 ceiling arm was lost by the edit';
  end if;
  if not v_secdef then
    raise exception 'POST: the kernel lost SECURITY DEFINER through the re-emit';
  end if;
  if v_config !~ 'search_path=app, public, pg_catalog' then
    raise exception 'POST: the kernel lost its pinned search_path through the re-emit (proconfig: %)', v_config;
  end if;
  if v_acl_post is distinct from v_acl_pre then
    raise exception 'POST: the kernel ACL changed through the re-emit (pre: %, post: %)', v_acl_pre, v_acl_post;
  end if;
end $$;
