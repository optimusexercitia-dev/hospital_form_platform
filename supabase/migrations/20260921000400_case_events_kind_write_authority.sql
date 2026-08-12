-- =============================================================================
-- BUG-CASEKIND-001 — `case_events.kind` was enforced in TypeScript ONLY.
--
-- Catalog-verified mechanism: a 16-value CHECK on the column, ZERO triggers, and
-- NO `kind` arm in either INSERT policy. The CHECK constrains the DOMAIN of
-- `kind`; nothing constrained WHO MAY WRITE WHICH VALUE. An ordinary committee
-- writer could therefore mint `kind = 'decision_issued'` straight through
-- PostgREST — an event the timeline presents as a governance decision.
-- (The recorded "a correct predicate != correct policies" family: the fix belongs
-- in the policy layer, NOT in a wider or narrower CHECK.)
--
-- THE FIX: the six MANUAL kinds are the only values a hand-authored write may
-- carry. The ten system kinds (2 registry echoes + 8 E3a ethics procedural) are
-- emitted exclusively by SECURITY DEFINER RPCs — `notify_safety_event`,
-- `conclude_meeting`, `conclude_interview`, `decide_admissibility`,
-- `add_ethics_allegation`, `record_ethics_finding`, `issue_ethics_notification`,
-- `schedule_ethics_hearing`, `cast_case_vote`, `issue_decision`,
-- `submit_ethics_appeal` — all owned by `postgres`, which OWNS `case_events`
-- and the table is NOT `force row level security`. Those doors therefore bypass
-- RLS entirely and are unaffected by the arm added here. Verified in the catalog
-- (`relowner`/`relforcerowsecurity`/`proowner`), not inferred from migration text.
--
-- WEAKEST-MUTATOR NOTE: the arm goes on all FOUR write policies — both INSERTs
-- AND both UPDATEs. An INSERT-only arm is defeated by insert-then-update
-- (`kind='note'` -> `kind='decision_issued'`), which is the same shape as the
-- recorded "an exclusion is only as strong as its weakest mutator" finding.
-- WITH CHECK cannot see OLD, so this also means a user-role UPDATE of a
-- procedural row must land on a manual kind — the app never does otherwise
-- (`updateCaseEvent` guards with `isCaseEventKind`), so no app path regresses.
--
-- NOT covered here (deliberate, separate obligations): DELETE of a procedural
-- event is still open to a case writer, and no audit row distinguishes a forged
-- kind from an authentic one. Neither is a MINTING path; see the PROGRESS.md
-- follow-up rather than widening this migration.
--
-- The four policies are amended with `alter policy ... with check (<existing>
-- and <arm>)` read back OUT OF THE CATALOG — never restated by hand. A
-- DROP+CREATE would silently drop the E3a `coordinator_only` narrowing and the
-- `is_case_excluded` arm (the recorded "a REBUILD loses what the original
-- carried" class).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. The SQL mirror of `src/lib/cases/registro-kinds.ts` — one place, so a
--    seventh manual kind is a one-line widen instead of four policy edits.
-- ---------------------------------------------------------------------------
create or replace function app.is_manual_case_event_kind(p_kind text)
returns boolean
language sql
immutable
parallel safe
security invoker
set search_path = ''
as $$
  select p_kind = any (array[
    'note', 'meeting', 'decision', 'update', 'follow_up', 'other'
  ]);
$$;

comment on function app.is_manual_case_event_kind(text) is
  'BUG-CASEKIND-001. True for the SIX hand-authorable registro kinds (the SQL mirror of src/lib/cases/registro-kinds.ts). Used as the `kind` arm of every user-role write policy on case_events, so the ten system kinds (registry echoes + E3a ethics procedural) can only be written by the SECURITY DEFINER RPCs that bypass RLS. Widening the manual vocabulary means widening this function, case_events_kind_check, referral_internal_notes_kind_check and the TS module together.';

revoke all on function app.is_manual_case_event_kind(text) from public;
grant execute on function app.is_manual_case_event_kind(text)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Append the arm to all four user-role WRITE policies, preserving every
--    existing arm verbatim.
-- ---------------------------------------------------------------------------
do $$
declare
  v_policy text;
  v_check  text;
begin
  foreach v_policy in array array[
    'case_events_writer_insert',
    'case_events_staff_admin_insert',
    'case_events_writer_update',
    'case_events_staff_admin_update'
  ] loop
    select pg_get_expr(pol.polwithcheck, pol.polrelid)
      into v_check
      from pg_policy pol
     where pol.polrelid = 'public.case_events'::regclass
       and pol.polname  = v_policy;

    if v_check is null then
      raise exception
        'BUG-CASEKIND-001: policy % on public.case_events has no WITH CHECK (or does not exist) — re-read the catalog before amending.',
        v_policy;
    end if;

    -- Idempotent: re-running must not nest the arm.
    if v_check like '%is_manual_case_event_kind%' then
      raise notice 'BUG-CASEKIND-001: % already carries the kind arm — skipped.', v_policy;
      continue;
    end if;

    execute format(
      'alter policy %I on public.case_events with check (%s and app.is_manual_case_event_kind(kind))',
      v_policy, v_check
    );
    raise notice 'BUG-CASEKIND-001: kind arm added to %.', v_policy;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Postconditions — a silent no-op here is the failure mode this class of
--    migration actually has.
-- ---------------------------------------------------------------------------
do $$
declare
  v_armed int;
begin
  select count(*) into v_armed
    from pg_policies
   where schemaname = 'public'
     and tablename  = 'case_events'
     and with_check like '%is_manual_case_event_kind%';

  if v_armed <> 4 then
    raise exception
      'BUG-CASEKIND-001 postcondition: expected 4 case_events write policies carrying the kind arm, found %.',
      v_armed;
  end if;

  -- The arm must actually discriminate: manual in, procedural out.
  if not app.is_manual_case_event_kind('note')
     or app.is_manual_case_event_kind('decision_issued')
     or app.is_manual_case_event_kind('safety_event') then
    raise exception
      'BUG-CASEKIND-001 postcondition: app.is_manual_case_event_kind does not discriminate manual from system kinds.';
  end if;

  raise notice 'BUG-CASEKIND-001: 4 write policies armed; helper discriminates.';
end $$;
