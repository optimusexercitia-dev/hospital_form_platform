-- =============================================================================
-- Widen `public.dispose_meeting_minutes`' redaction set to the free text it
-- claims to clear (FUP-MEETING-DISPOSAL-LEAVES-CHILD-TEXT; ADR 0056 Amendment 1).
--
-- WHY. The door's copy — `DSR_MEETING_DISPOSAL_WARNING` and `DSR_RESIDUE_NOTICE`
-- line 1 — tells a data subject the meeting's database PHI was erased. It redacted
-- three of `meeting_agenda_items`' four text columns and nothing on any other child
-- table. The follow-up's rule: either the columns join the redaction set or the
-- residue language names them as retained; the forbidden state is the one we were
-- in, where neither is true. PO ruled: widen the door.
--
-- ⭐ THE COLUMN SET IS DERIVED FROM A PROPERTY, NOT A LIST. The filing named four
-- columns from one census run for another purpose. Re-derived here from the live
-- catalog as: every free-text column on the COMPOSITION CLOSURE of `meetings`.
-- Composition is a catalog fact, not a judgement — an FK that is
-- `NOT NULL + ON DELETE CASCADE` cannot exist without its meeting. The naive FK
-- closure is 25 tables and is WRONG: it drags in `capa_plan`, `action_items`,
-- `rca_evidence`, `ethics_hearings` and `case_votes`, which merely CITE a meeting
-- (nullable / SET NULL / RESTRICT) and carry their own lifecycles and disposal
-- owners. `action_items.source_meeting_id` is CASCADE but NULLABLE — provenance,
-- not composition. The closure is 9 tables.
--
-- ⚠ FREE TEXT IS NOT A TYPE. The first census here filtered on
-- `text/varchar/citext` and so missed `meeting_minutes_jobs.{draft,result}`, which
-- are JSONB carrying the generated minutes text. A type list is a syntax, and this
-- program has been bitten by syntax-shaped boundaries before.
--
-- WHAT THIS ADDS (10 columns over the 4 that were redacted):
--   meeting_agenda_items.title                       -- the sharp one: 3 of 4 were
--                                                       redacted and `title` survived
--   meeting_attendees.{note, external_name, external_org}
--   meeting_closed_sessions.label
--   meeting_closed_session_items.{substance, decision, withdrawals}  -- depth-2
--   meeting_minutes_jobs.{transcript, draft, result} -- see the note below
--
-- ⭐ `meeting_minutes_jobs.transcript` IS THE LARGEST RESERVOIR AND IT IS NOT WHAT
-- IT FIRST LOOKS LIKE. `apply_minutes_review`, `cancel_minutes_job` and
-- `fail_minutes_job` all null `transcript`/`draft`/`result` and stamp `purged_at`,
-- so the transcript is transient by design — it is NOT a standing reservoir, and an
-- escalation that skipped this check would have been wrong. But only three of
-- `audio_job_status`' six values purge. A job resting in **`done`** — transcribed,
-- draft ready, awaiting human review, the ordinary resting state — keeps the
-- verbatim transcript of everything said in the meeting indefinitely, as do
-- `uploading` and `processing`. That is inside ADR 0056 §4's "disposal erases all
-- DB-side PHI", so it falsified the ADR's central claim, not merely the UI copy.
-- Nulled UNCONDITIONALLY here rather than per-status: a predicate over the
-- transition graph would go stale the next time a state is added, and nulling an
-- already-null column costs nothing.
-- ⚠ There is NO unique constraint on `meeting_minutes_jobs.meeting_id` — a meeting
-- may have MANY jobs. Every update below is set-based over the meeting; none may
-- become a `limit 1`.
--
-- DELIBERATELY OUT OF SCOPE, each for a stated reason:
--   meeting_cases.{summary,decision}  -- ADR 0056 §2's decoupling: one meeting
--     discusses many cases, so these are `dispose_case_phi`'s, per case. Re-confirmed
--     against the live ADR text, not assumed.
--   meetings.{title, location_text, meeting_url}  -- the governance skeleton the
--     residue notice promises SURVIVES (numbering, status, audit trail). Redacting
--     `title` would blank the meeting's identity in every list. Referred to PO.
--   meeting_signatures.{note, content_hash, provider_ref, provider_payload,
--     user_agent}  -- signature integrity evidence; redacting it would weaken the
--     legal validity of the signature the disposal is recorded under.
--   meeting_minutes_jobs.{audio_path, error_message}  -- `audio_path` is a Storage
--     pointer under Rule 6 retention with its own `audio_deleted_at` lifecycle
--     (ADR 0056 §4's narrowed claim); it is not DB-side PHI.
--
--   meeting_closed_session_items.{substance, decision, withdrawals}  -- depth-2; see
--     part 1 below. Covering these required teaching `app.guard_reserved_child_lock`
--     the named stand-aside, so `app.in_disposal_rpc` now has TWO readers and still ONE
--     setter. ADR 0129 is amended in the same change — its Decision 1 says "No other
--     guard reads it", and that sentence is now false.
--
-- ⛔ NO GRANT STATEMENTS IN THIS FILE. `CREATE OR REPLACE FUNCTION` does not reset
-- an ACL. The live ACL was diffed from `pg_proc.proacl` BEFORE this rewrite and is
--   postgres=X/postgres | service_role=X/postgres | authenticated=X/postgres
-- — `authenticated` and `service_role` already hold EXECUTE, so the house
-- `revoke ... grant ...` idiom would be a no-op at best and an over-grant at worst
-- (it was exactly that on a Slice 3 rewrite, caught by suite 152 §M1). That idiom is
-- a rule about NEW functions. No column is added, so no column-list GRANT is owed
-- either (`pg_attribute.attacl` checked, not just `pg_class.relacl`).
--
-- Signature, gate, reason allow-list, HC056 one-shot and audit row are UNCHANGED.
-- =============================================================================

-- ── 1 · THE SIBLING GUARD LEARNS THE NAMED STAND-ASIDE ──────────────────────────────
-- `app.guard_reserved_child_lock` protects `meeting_closed_session_items` and
-- `..._item_readers`. It is a DIFFERENT function from `app.guard_meeting_child_lock` and
-- it had NO bypass branch at all, so on a locked meeting — precisely the population
-- disposal targets — the widened UPDATE below would raise `check_violation` and roll the
-- whole erasure back. That is the exact failure shape ADR 0129 fixed for agenda items,
-- one table over.
--
-- ⛔ THIS CHANGES A STATED BOUND, AND ADR 0129 IS AMENDED IN THE SAME BREATH. ADR 0129
-- Decision 1 says of `app.in_disposal_rpc`: "read only by `app.guard_meeting_child_lock`
-- … No other guard reads it". After this migration the flag has **TWO readers** and still
-- exactly **ONE setter** (`public.dispose_meeting_minutes`). The invariant ADR 0129
-- actually protects — *only the disposal door bypasses the child lock* — is preserved;
-- the arithmetic in its prose is not, and is corrected there rather than left to rot.
-- The rejected shape stays rejected: this is NOT widened to `app.in_meeting_rpc`, which
-- 26 doors set.
create or replace function app.guard_reserved_child_lock()
returns trigger
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
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
    -- THE SAME NAMED STAND-ASIDE the sibling guard already honours (ADR 0129, amended).
    -- `public.dispose_meeting_minutes` is still the ONLY function that sets this flag,
    -- and only around its own child UPDATEs. Everything else -- including all 26 doors
    -- that set `app.in_meeting_rpc` -- still falls through to the raise below.
    -- Do NOT widen this to `app.in_meeting_rpc`.
    if coalesce(current_setting('app.in_disposal_rpc', true), '') = 'on' then
      return case when tg_op = 'DELETE' then old else new end;
    end if;

    raise exception 'o conteúdo desta reunião está bloqueado (%)', v_status
      using errcode = 'check_violation';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$function$;

-- ── 2 · THE ORIGINAL GUARD'S COMMENT IS CORRECTED (behaviour byte-identical) ────────
-- ⛔ COMMENT-ONLY, AND IT IS NOT COSMETIC. `app.guard_meeting_child_lock`'s body states
-- "this guard is its only reader" — an invariant that part 1 of this migration just
-- falsified. That sentence sits INSIDE the function whose behaviour it describes, which
-- is the one place a reader is most entitled to trust it and the one place an ADR
-- amendment cannot reach. A comment is an assertion, and this one had gone stale
-- silently in the catalog while the ADR was being dutifully amended.
--
-- Every executable line below is reproduced verbatim from the live
-- `pg_get_functiondef` output — the logic does not move. `CREATE OR REPLACE` preserves
-- the ACL (this function carries the house-norm NULL `proacl`, as 129 of 158 `app`
-- trigger guards do), so no GRANT statement appears here either.
create or replace function app.guard_meeting_child_lock()
returns trigger
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
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
    -- THE ONE NAMED STAND-ASIDE (ADR 0129, amended). `public.dispose_meeting_minutes`
    -- is the only function that sets this flag, and only around its own child UPDATEs.
    --
    -- ⚠ THIS GUARD IS NO LONGER ITS ONLY READER — `app.guard_reserved_child_lock`
    -- reads it too, so that the same disposal can reach `meeting_closed_session_items`
    -- (ADR 0056 Amendment 1). TWO readers, ONE setter. The bound ADR 0126 section E
    -- rests on is the SETTER count, not the reader count: everything else -- including
    -- all 26 doors that set `app.in_meeting_rpc` -- still falls through to the raise
    -- below. Do NOT widen this to `app.in_meeting_rpc`.
    if coalesce(current_setting('app.in_disposal_rpc', true), '') = 'on' then
      return case when tg_op = 'DELETE' then old else new end;
    end if;

    raise exception 'o conteúdo desta reunião está bloqueado (%)', v_status
      using errcode = 'check_violation';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$function$;

-- ── 3 · THE DOOR ────────────────────────────────────────────────────────────────────
create or replace function public.dispose_meeting_minutes(p_meeting_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_meeting public.meetings;
  v_redacted constant text := '[PHI removido]';
begin
  perform app.assert_meetings_enabled();

  select * into v_meeting from public.meetings where id = p_meeting_id;
  if v_meeting.id is null then
    raise exception 'reunião não encontrada' using errcode = 'P0002';
  end if;
  -- Gate: staff_admin of the meeting's commission OR its commission-admin.
  if not (app.is_staff_admin_of(v_meeting.commission_id)
          or app.is_tenancy_admin_of(v_meeting.commission_id)) then
    raise exception 'apenas a coordenação da comissão ou um administrador da organização pode descartar a ata'
      using errcode = '42501';
  end if;
  if p_reason is null or p_reason not in
       ('retention_expired', 'subject_request', 'entered_in_error', 'duplicate', 'other') then
    raise exception 'motivo de descarte inválido' using errcode = 'check_violation';
  end if;
  if v_meeting.phi_disposed_at is not null then
    raise exception 'a ata desta reunião já foi descartada' using errcode = 'HC056';
  end if;

  -- `app.in_meeting_rpc` stands aside the PARENT-table freeze guards
  -- (`app.guard_meeting_status`) ONLY. It does not reach `app.guard_meeting_child_lock`,
  -- which reads a different flag -- see the child UPDATEs below. The comment that used to
  -- sit here claimed it bypassed "the meeting freeze guards" (plural, unqualified); that
  -- was false for the children and is the defect ADR 0129 fixes.
  perform set_config('app.in_meeting_rpc', 'on', true);
  perform set_config('app.phi_dispose_reason', p_reason, true);

  update public.meetings set minutes_md = null where id = p_meeting_id;

  -- The child lock refuses EVERY writer on a locked meeting, which is exactly the
  -- population carrying PHI. This is the single named exception (ADR 0129): set
  -- immediately before the child UPDATEs and reset immediately after, so the stand-aside
  -- cannot span the audit write or anything else in the caller's transaction.
  --
  -- ⚠ FOUR tables are updated inside this window, and they do NOT share one guard.
  -- Verified from `pg_trigger`, not assumed from the table names: `meeting_agenda_items`,
  -- `meeting_attendees` and `meeting_closed_sessions` carry
  -- `app.guard_meeting_child_lock`; `meeting_closed_session_items` carries
  -- `app.guard_reserved_child_lock`. Both read `app.in_disposal_rpc` as of this
  -- migration — TWO readers, still exactly ONE setter (this function), which is the
  -- half that bounds the bypass. ADR 0129 Amendment 1.
  --
  -- ⛔ An earlier version of this comment said "all three tables … which is the flag's
  -- ONLY reader". It was true when written and false four lines later, in the same
  -- migration that added the fourth table. Left uncorrected it would have been a stale
  -- assertion inside the function whose behaviour it describes.
  perform set_config('app.in_disposal_rpc', 'on', true);

  update public.meeting_agenda_items
     set title = v_redacted, description = v_redacted,
         discussion_notes = v_redacted, resolution = v_redacted
   where meeting_id = p_meeting_id;

  -- ⛔ NULL IS PRESERVED AS NULL, AND THAT BRANCH IS LOAD-BEARING FOR CORRECTNESS —
  -- not merely for data hygiene. `meeting_attendees_identity_xor` is
  --   CHECK ((user_id is not null and external_name is null)
  --       or (user_id is null and nullif(btrim(external_name),'') is not null))
  -- so a blanket `set external_name = v_redacted` would stamp a name onto every
  -- INTERNAL attendee (whose `user_id` is set and whose `external_name` must stay
  -- NULL), violate the CHECK, and abort the WHOLE disposal — a legal obligation
  -- failing closed on any meeting that had an internal attendee, which is all of them.
  -- Read from `pg_constraint`; it is not visible in the column list.
  -- Preserving NULL also avoids fabricating the appearance of an external attendee, or
  -- of a note, on rows that never had one — which would corrupt the governance record
  -- the residue notice promises survives and inflate any later "how much was redacted"
  -- count.
  update public.meeting_attendees
     set note          = case when note          is not null then v_redacted end,
         external_name = case when external_name is not null then v_redacted end,
         external_org  = case when external_org  is not null then v_redacted end
   where meeting_id = p_meeting_id
     and (note is not null or external_name is not null or external_org is not null);

  update public.meeting_closed_sessions
     set label = v_redacted
   where meeting_id = p_meeting_id
     and label is not null;

  -- Depth-2. Reached through `meeting_closed_sessions` because these rows key on
  -- `closed_session_id`, not on `meeting_id` — the closure is not flat, and a census that
  -- stops at the meeting's direct children never sees this table. Guarded by
  -- `app.guard_reserved_child_lock`, which honours the stand-aside as of this migration.
  update public.meeting_closed_session_items i
     set substance   = case when i.substance   is not null then v_redacted end,
         decision    = case when i.decision    is not null then v_redacted end,
         withdrawals = case when i.withdrawals is not null then v_redacted end
   where i.closed_session_id in (
           select s.id from public.meeting_closed_sessions s where s.meeting_id = p_meeting_id)
     and (i.substance is not null or i.decision is not null or i.withdrawals is not null);

  perform set_config('app.in_disposal_rpc', 'off', true);

  -- Outside the stand-aside window ON PURPOSE: `meeting_minutes_jobs` carries no lock
  -- guard (only `touch_updated_at`), so it needs no bypass, and the window stays as
  -- narrow as ADR 0129 intends.
  update public.meeting_minutes_jobs
     set transcript = null,
         draft      = null,
         result     = null,
         purged_at  = coalesce(purged_at, now())
   where meeting_id = p_meeting_id
     and (transcript is not null or draft is not null or result is not null);

  update public.meetings
     set phi_disposed_at = now(), phi_disposed_by = auth.uid(), phi_disposed_reason = p_reason
   where id = p_meeting_id;

  perform app.audit_write(
    'meeting_minutes.disposed', 'meeting', p_meeting_id, v_meeting.commission_id,
    'Ata da reunião ' || v_meeting.meeting_number || ' descartada',
    jsonb_build_object('reason', p_reason));

  perform set_config('app.in_meeting_rpc', 'off', true);
end;
$function$;

comment on function public.dispose_meeting_minutes(uuid, text) is
  'Erases the DB-side PHI of one meeting''s minutes across the composition closure of '
  '`meetings` (NOT NULL + CASCADE children, transitively). Redaction set derived from '
  'the catalog by property, not from a list — see ADR 0056 Amendment 1 for what is '
  'deliberately retained and why (meetings.title is retained and must be DISCLOSED as '
  'retained by the UI copy). Sole setter of app.in_disposal_rpc.';
