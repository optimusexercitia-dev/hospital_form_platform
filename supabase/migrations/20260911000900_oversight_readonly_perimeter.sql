-- =============================================================================
-- QO·A M10 — the oversight READ-ONLY PERIMETER (QA B1 + M1 + M2; PO ruling
-- 2026-08-06: exclude all three write doors, no carve-out).
--
-- ⛔ THE ROOT CAUSE, stated once so the next author does not repeat it.
-- Plan §A.2's threading list enumerates the arms that must CHANGE. It has NO
-- axis for "who already CONSUMES the bit we are conferring." Conferring
-- `read_case_content` on S7 silently enrolled the oversight reviewer into every
-- existing consumer of that bit, wherever it lived. That is THREE misses of one
-- shape in a single phase — S7 → attachment bytes (M8), S7 → open_attachment
-- (M9), and now S7 → three write doors + five read families.
--
--   STANDING RULE: conferring a capability bit requires enumerating its
--   CONSUMERS, not just its producers. Phase B's org_admin wall is a far larger
--   instance of exactly this.
--
-- Derived from the LIVE catalog by PROPERTY (transitive closure over
-- comment-stripped prosrc + pg_policies seeded from `can_read_case(`,
-- 'read_case_content', 'view_case_overview'): 60 functions + 50 policies, then
-- classified PER DOOR. The per-door pass is load-bearing — 11 of the 14
-- authenticated DML doors in the closure are safe for reasons only visible
-- individually (`link_evidence` gates is_staff_admin_of FIRST;
-- `can_write_action_item_stake` requires assignee/staff_admin/assignment), so a
-- blanket predicate over the closure would have broken eleven working doors.
--
-- THE CUT, two shapes:
--   * WRITE doors → an EXPLICIT reviewer exclusion (`is_oversight_only_reader`).
--     A predicate correct for a read path is NOT automatically correct for a
--     write path, so the write side does not get a read predicate.
--   * READ families → `can_read_case_committee`, i.e. the PRE-QO meaning of
--     can_read_case: content reach through a committee-plane source.
--
-- THE LATTICE INVARIANT both rest on (verified per door, not assumed): every
-- content-conferring source EXCEPT S7 also confers read_case_deliberation —
-- S1 coordinator (all bits), S3 grant closure (content⇒deliberation), S4
-- assignment (content+deliberation), S6 NSP (content+deliberation). D4 makes S7
-- the sole exception BY DESIGN. So LOST = 0 for every pre-existing reader and
-- writer, and the only principal cut is the oversight reviewer.
--
-- PO reasoning for closing the two self-service doors, recorded so nobody
-- "fixes" it later: a conflict declaration or recusal record from a principal
-- who is excluded from deliberation (D4) and who neither votes nor decides has
-- NO CONSUMER in the current model. Closing them is not merely conservative, it
-- is semantically correct. D7 is ratified and reversible post-pilot.
-- =============================================================================

-- ── The two perimeter predicates ────────────────────────────────────────────
create function app.is_oversight_only_reader(p_case_id uuid, p_uid uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
  -- The principal reaches this case's CONTENT but holds no deliberation bit —
  -- which, by the lattice invariant above, is true of the S7 oversight arm and
  -- of nothing else. Named for the QUESTION it answers (is this reach
  -- oversight-only?), not for the bits it happens to test.
  select app.has_case_capability(p_case_id, p_uid, 'read_case_content')
     and not app.has_case_capability(p_case_id, p_uid, 'read_case_deliberation');
$function$;

create function app.can_read_case_committee(p_case_id uuid, p_uid uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
  -- `can_read_case` as it meant BEFORE the S7 arm existed: content reach through
  -- a committee-plane source. Every surface that predates QO·A and was written
  -- against "any case reader" wants THIS, not the widened can_read_case.
  select app.can_read_case(p_case_id, p_uid)
     and not app.is_oversight_only_reader(p_case_id, p_uid);
$function$;

revoke all on function app.is_oversight_only_reader(uuid, uuid) from public;
revoke all on function app.can_read_case_committee(uuid, uuid) from public;
grant execute on function app.is_oversight_only_reader(uuid, uuid) to authenticated, service_role;
grant execute on function app.can_read_case_committee(uuid, uuid) to authenticated, service_role;

-- ── A. THE THREE WRITE DOORS (D7) ───────────────────────────────────────────
-- Bodies re-emitted from LIVE pg_get_functiondef with a single needle each and
-- a single-replacement proof (the M5 discipline); CREATE OR REPLACE preserves
-- owner/ACL/prosecdef/search_path.
do $$
declare v_old text; v_new text; v_fn text; v_needle text; v_repl text;
begin
  -- declare_conflict
  v_fn := 'public.declare_conflict';
  v_old := pg_get_functiondef(
    (select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public' and p.proname='declare_conflict'));
  v_needle := 'if not app.can_read_case(p_case_id, auth.uid()) then';
  v_repl := 'if not app.can_read_case(p_case_id, auth.uid())'
         || ' or app.is_oversight_only_reader(p_case_id, auth.uid()) then';
  v_new := replace(v_old, v_needle, v_repl);
  if v_new = v_old then raise exception 'M10: needle not found in %', v_fn; end if;
  if length(v_new) - length(v_old) <> length(v_repl) - length(v_needle) then
    raise exception 'M10: more than one replacement landed in %', v_fn; end if;
  execute v_new;

  -- file_correction_request  (its own comment: "any case-content reader may file")
  v_fn := 'public.file_correction_request';
  v_old := pg_get_functiondef(
    (select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public' and p.proname='file_correction_request'));
  v_needle := 'if not app.can_read_case(v_case_id, auth.uid()) then';
  v_repl := 'if not app.can_read_case(v_case_id, auth.uid())'
         || ' or app.is_oversight_only_reader(v_case_id, auth.uid()) then';
  v_new := replace(v_old, v_needle, v_repl);
  if v_new = v_old then raise exception 'M10: needle not found in %', v_fn; end if;
  if length(v_new) - length(v_old) <> length(v_repl) - length(v_needle) then
    raise exception 'M10: more than one replacement landed in %', v_fn; end if;
  execute v_new;

  -- record_recusal — the coordinator arm (v_is_coord_raw) is PRESERVED; only the
  -- "any reader" arm is narrowed.
  v_fn := 'public.record_recusal';
  v_old := pg_get_functiondef(
    (select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public' and p.proname='record_recusal'));
  v_needle := 'if not (v_is_coord_raw or app.can_read_case(p_case_id, auth.uid())) then';
  v_repl := 'if not (v_is_coord_raw or (app.can_read_case(p_case_id, auth.uid())'
         || ' and not app.is_oversight_only_reader(p_case_id, auth.uid()))) then';
  v_new := replace(v_old, v_needle, v_repl);
  if v_new = v_old then raise exception 'M10: needle not found in %', v_fn; end if;
  if length(v_new) - length(v_old) <> length(v_repl) - length(v_needle) then
    raise exception 'M10: more than one replacement landed in %', v_fn; end if;
  execute v_new;
end $$;

-- ── B. THE READ FAMILIES ────────────────────────────────────────────────────
-- B1 · Class-2 professional identity (Rule 12 / D5 — the reviewer never enters).
-- B2 · Interviews (7 tables route can_read_interview).
-- B3 · Action items, case_restricted arm only (committee/assignees arms already
--      deny the reviewer — verified per arm).
do $$
declare v_old text; v_new text; v_fn text; v_n int;
begin
  foreach v_fn in array array[
    'app.can_read_professional_profile(uuid,uuid)',
    'app.can_read_interview(uuid,uuid)',
    'app.can_read_action_item(uuid,uuid)'
  ] loop
    v_old := pg_get_functiondef(v_fn::regprocedure);
    v_new := replace(v_old, 'app.can_read_case(', 'app.can_read_case_committee(');
    if v_new = v_old then raise exception 'M10: no can_read_case call in %', v_fn; end if;
    -- exactly ONE call site in each (verified against the live bodies)
    if length(v_new) - length(v_old) <> length('_committee') then
      raise exception 'M10: expected exactly one can_read_case call in %, found more', v_fn;
    end if;
    execute v_new;
  end loop;
end $$;

-- B4 · Deliberation-grade case tables: votes + decisions + the ethics family.
-- All nine carry the IDENTICAL qual `app.can_read_case(case_id, auth.uid())`
-- (verified from pg_policies), so the swap is uniform rather than nine bespoke
-- edits. ALTER POLICY preserves cmd/roles/permissive.
do $$
declare r record; v_new text;
begin
  for r in
    select tablename, policyname, qual
    from pg_policies
    where schemaname = 'public'
      and tablename in ('case_votes','case_decisions','ethics_allegations','ethics_appeals',
                        'ethics_case_details','ethics_decision_details','ethics_findings',
                        'ethics_hearings','ethics_notifications',
                        -- ⚠ action_items routes can_read_case DIRECTLY in its
                        -- case_restricted arm — cutting app.can_read_action_item
                        -- (B3) does NOT reach this policy. Caught by 311 §3.4,
                        -- which is precisely why each family got a behavioural
                        -- keystone and not just a catalog invariant.
                        'action_items')
      and cmd = 'SELECT'
  loop
    v_new := replace(r.qual, 'app.can_read_case(', 'app.can_read_case_committee(');
    if v_new = r.qual then
      raise exception 'M10: policy %.% does not route can_read_case as expected', r.tablename, r.policyname;
    end if;
    execute format('alter policy %I on public.%I using (%s)', r.policyname, r.tablename, v_new);
  end loop;
end $$;

-- ── Postconditions ──────────────────────────────────────────────────────────
do $$
declare v_n int;
begin
  -- the three write doors carry the explicit exclusion
  select count(*) into v_n from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in ('declare_conflict','file_correction_request','record_recusal')
    and regexp_replace(p.prosrc,'--[^\n]*','','g') ~ 'is_oversight_only_reader';
  if v_n <> 3 then raise exception 'M10 postcondition: % of 3 write doors carry the exclusion', v_n; end if;

  -- the three read predicates route the committee-plane predicate
  select count(*) into v_n from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='app' and p.proname in ('can_read_professional_profile','can_read_interview','can_read_action_item')
    and regexp_replace(p.prosrc,'--[^\n]*','','g') ~ 'can_read_case_committee';
  if v_n <> 3 then raise exception 'M10 postcondition: % of 3 read predicates re-pointed', v_n; end if;

  -- the nine deliberation-grade policies
  select count(*) into v_n from pg_policies
  where schemaname='public' and qual ~ 'can_read_case_committee'
    and tablename in ('case_votes','case_decisions','ethics_allegations','ethics_appeals',
                      'ethics_case_details','ethics_decision_details','ethics_findings',
                      'ethics_hearings','ethics_notifications','action_items');
  if v_n <> 10 then raise exception 'M10 postcondition: % of 10 policies re-pointed', v_n; end if;

  -- ⚠ cases_select must NOT be re-pointed: the board/case page is the reviewer's
  -- whole purpose (D3 confers read_case_content deliberately).
  if (select qual from pg_policies where schemaname='public' and tablename='cases' and policyname='cases_select')
     ~ 'can_read_case_committee' then
    raise exception 'M10 postcondition: cases_select was re-pointed — that revokes the feature itself';
  end if;
end $$;
