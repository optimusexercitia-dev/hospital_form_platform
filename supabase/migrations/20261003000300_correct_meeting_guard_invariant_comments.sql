-- =============================================================================
-- QA blocker C2 — the invariant this round TRIPLED was still stated at its old value
-- INSIDE THE GUARDS THEMSELVES.
--
-- Migration 20261003000000 extended the `app.in_disposal_rpc` stand-aside to the three
-- sibling child locks, taking the setter count from ONE to THREE. It corrected the false
-- comment in a DOOR (`dispose_case_phi`'s `-- for meeting_cases child-lock`) and never
-- asked which STATEMENT OF THE INVARIANT it had just falsified. Two of those live in the
-- two meeting-side guards below; a third lived in ADR 0126 §E and was fixed in 90f56f62.
--
-- ⭐ WHY A COMMENT IS WORTH A MIGRATION HERE. The invariant statement is the CONTROL: it
-- is the only thing telling a future engineer not to add a setter. A wrong statement of
-- it is precisely the shape that produced the tenth erasure statement in the first place
-- — a comment asserting a bypass the guard it named did not implement. Leaving a stale
-- bound inside the guard that enforces it plants the next instance of the same defect.
--
-- ⛔ COMMENT TEXT ONLY. THE EXECUTABLE BODY OF BOTH FUNCTIONS IS UNCHANGED, and that is
-- proved rather than asserted. `pg_get_functiondef` hashes comments and code TOGETHER, so
-- "the definition hash moved" cannot distinguish the two. Three independent methods ran,
-- and a POSITIVE CONTROL ran FIRST to prove they can see a real body change (one
-- executable token mutated on a scratch copy; both methods had to notice or the run
-- aborts — a detector nobody has watched find something proves nothing):
--   1. line-level — unified-diff the before/after definitions; every changed line must be
--      a comment or blank;
--   2. hash-level — strip comments, normalise whitespace, md5; must be IDENTICAL;
--   3. attributes — prosecdef / provolatile / proconfig / prorettype / proargtypes /
--      proisstrict / proparallel / procost / prolang / proacl; must be IDENTICAL.
-- The same checks also ran at AUTHORING time: the text below was generated from the live
-- catalog with only the two comment blocks substituted, so a transcription slip cannot
-- masquerade as a comment fix.
--
-- ⚠ This file is deliberately the FULL LITERAL function text, NOT a runtime
-- `pg_get_functiondef() + replace() + execute` rewrite. That pattern would have made
-- body-invariance structural, but it is the pattern ADR 0078's METHODOLOGY FINDING blames
-- for migration files being stale by design — it has already produced a confident false
-- P0 in this repo, and CLAUDE.md's binding graphify exception exists because of it. The
-- proof above buys the same assurance without making one more migration unreadable.
--
-- The measured bound is re-derived from `pg_proc` in the same commit, so the corrected
-- comment and the measured reality verify each other rather than one asserting the other.
-- Detectability: pgTAP `355_disposal_bypass_invariant.sql` — `set_eq` on the setter SET
-- (a count could be silenced by editing a digit; a set forces a human to NAME a new
-- door), plus the property that every reader is a trigger function — so the next drift
-- REDS instead of rotting.
-- =============================================================================

CREATE OR REPLACE FUNCTION app.guard_meeting_child_lock()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_meeting_id uuid;
  v_status text;
begin
  v_meeting_id := case when tg_op = 'DELETE' then old.meeting_id else new.meeting_id end;
  select status into v_status from public.meetings where id = v_meeting_id;

  -- The parent meeting may already be gone (a cascade delete of the meeting also
  -- cascades its children); nothing to lock in that case.
  if v_status is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if v_status in ('in_signature', 'signed', 'distributed', 'cancelled') then
    -- THE NAMED STAND-ASIDE (ADR 0129 Decision 1, as amended). Set ONLY by the LGPD
    -- PHI-erasure doors, and only around their own guarded child writes.
    --
    -- ⛔ THE BOUND IS THE SETTER COUNT, NOT THE READER COUNT, and it is written as a
    -- PROPERTY on purpose: ONLY THE DISPOSAL DOORS BYPASS A CHILD LOCK. A count goes
    -- stale at the next change; the property does not. Everything else -- including all
    -- 26 doors that set `app.in_meeting_rpc` -- still falls through to the raise below.
    -- Do NOT widen this to `app.in_meeting_rpc`: that is shape 1, and it is rejected.
    --
    -- Measured 2026-08-21 (re-derive from pg_proc; never quote a count): 3 setters --
    -- dispose_meeting_minutes, dispose_event_phi, dispose_case_phi, every one a disposal
    -- door -- and 5 readers, every one a child-lock guard. Pinned by pgTAP 355; ADR 0126
    -- section E states the same rule for the print-currency bound that rests on it.
    --
    -- ⚠ Until 2026-08-21 this comment named a single setter and a two-reader bound.
    -- That was true when written and was falsified by the very migration that extended
    -- the stand-aside to the sibling child locks -- which corrected every false comment
    -- it could find in a DOOR and revisited no statement of the invariant itself.
    if coalesce(current_setting('app.in_disposal_rpc', true), '') = 'on' then
      return case when tg_op = 'DELETE' then old else new end;
    end if;

    raise exception 'o conteúdo desta reunião está bloqueado (%)', v_status
      using errcode = 'check_violation';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$function$;

CREATE OR REPLACE FUNCTION app.guard_reserved_child_lock()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_key        uuid;
  v_meeting_id uuid;
  v_status     text;
begin
  if tg_table_name = 'meeting_closed_session_items' then
    if tg_op = 'DELETE' then v_key := old.closed_session_id; else v_key := new.closed_session_id; end if;
    select s.meeting_id into v_meeting_id
      from public.meeting_closed_sessions s
     where s.id = v_key;

  elsif tg_table_name = 'meeting_closed_session_item_readers' then
    if tg_op = 'DELETE' then v_key := old.item_id; else v_key := new.item_id; end if;
    select s.meeting_id into v_meeting_id
      from public.meeting_closed_session_items i
      join public.meeting_closed_sessions s on s.id = i.closed_session_id
     where i.id = v_key;

  else
    raise exception 'app.guard_reserved_child_lock attached to unexpected table %', tg_table_name;
  end if;

  -- The ancestor may already be gone (a cascade delete of the meeting / session
  -- also cascades these children); nothing to lock in that case. Mirrors
  -- app.guard_meeting_child_lock's own cascade branch.
  if v_meeting_id is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  select status into v_status from public.meetings where id = v_meeting_id;
  if v_status is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if v_status in ('in_signature', 'signed', 'distributed', 'cancelled') then
    -- THE SAME NAMED STAND-ASIDE the sibling guard honours (ADR 0129 Decision 1, as
    -- amended). Set ONLY by the LGPD PHI-erasure doors, and only around their own
    -- guarded child writes. Everything else -- including all 26 doors that set
    -- `app.in_meeting_rpc` -- still falls through to the raise below.
    -- Do NOT widen this to `app.in_meeting_rpc`: that is shape 1, and it is rejected.
    --
    -- ⛔ The bound is the SETTER count, written as a property: ONLY THE DISPOSAL
    -- DOORS BYPASS A CHILD LOCK. Measured 2026-08-21 (re-derive from pg_proc; never
    -- quote a count): 3 setters, every one a disposal door; 5 readers, every one a
    -- child-lock guard. Pinned by pgTAP 355.
    --
    -- ⚠ Until 2026-08-21 this comment asserted a single setter. True when written,
    -- falsified by the migration that extended this stand-aside to the sibling child
    -- locks without revisiting any statement of the bound.
    if coalesce(current_setting('app.in_disposal_rpc', true), '') = 'on' then
      return case when tg_op = 'DELETE' then old else new end;
    end if;

    raise exception 'o conteúdo desta reunião está bloqueado (%)', v_status
      using errcode = 'check_violation';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$function$;
