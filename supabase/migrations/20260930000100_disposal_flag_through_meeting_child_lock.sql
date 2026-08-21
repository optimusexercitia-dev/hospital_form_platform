-- ---------------------------------------------------------------------------
-- ADR 0129 — a narrow disposal flag through the meeting child lock.
--
-- THE DEFECT (measured from the live catalog at build time; never from migration
-- text — CLAUDE.md graphify exception):
--
--   `public.dispose_meeting_minutes` — the LGPD erasure door for meeting minutes
--   (ADR 0056 §2) — sets `app.in_meeting_rpc` with the comment "bypass the meeting
--   freeze guards". `app.guard_meeting_child_lock` contains NO reference to that flag.
--   So the door nulls `minutes_md` (the parent guard does honour the flag), then RAISES
--   on the `meeting_agenda_items` UPDATE, and the whole transaction rolls back.
--
--   Constructed, not inferred, against the seeded locked-with-agenda meeting:
--     - child UPDATE, no flag                   -> RAISES 23514 (correct; load-bearing)
--     - child UPDATE, `app.in_meeting_rpc = on` -> RAISES 23514 (the defect)
--
--   The population that cannot be erased is exactly the population that carries PHI:
--   a locked meeting WITH agenda items. The comment asserts a mechanism the guard it
--   names does not implement -- the guards-that-read-right family, except this one
--   fails CLOSED, against a legal obligation.
--
-- THE FIX — shape 2 of the three on the table, PO-ruled (ADR 0129 Decision 1):
--   a new transaction-local GUC `app.in_disposal_rpc`, SET only by
--   `dispose_meeting_minutes` (immediately before its child UPDATE, reset immediately
--   after) and READ only by `app.guard_meeting_child_lock`.
--
-- WHY NOT shape 1 (teach the guard to honour `app.in_meeting_rpc`). Measured: 26
-- `public.*` doors set `app.in_meeting_rpc` (28 functions mention it -- 26 setters, 1
-- reader `app.guard_meeting_status`, 1 comment-only `app.guard_professional_linkage`).
-- Shape 1 would therefore hand child-write power over locked meetings to 26 doors at
-- once, and ADR 0126 section E's bound -- that agenda/attendee/closed-session content is
-- not a currency exposure BECAUSE the guard refuses even inside RPCs -- rests on their
-- being refused. A widening cannot be wrong-and-safe. Shape 3 (a DEFINER path around
-- the trigger) duplicates redaction outside the door that audits it.
--
-- SCOPE: this migration amends nothing else (ADR 0129 Decision 1). Both functions are
-- recreated WHOLLY from their live catalog definitions.
-- ---------------------------------------------------------------------------

-- 1 .  The guard gains exactly one stand-aside. Its refusal stays total for every other
--      writer; the raise set (in_signature/signed/distributed/cancelled) is unchanged,
--      and `revoked` stays outside it -- that omission is the lawful surgical-redaction
--      corridor (reopen_meeting -> edit -> re-sign, ADR 0130 Decision 7).
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
    -- THE ONE NAMED STAND-ASIDE (ADR 0129). `public.dispose_meeting_minutes` is the
    -- only function that sets this flag, and only around its own child UPDATE; this
    -- guard is its only reader. Everything else -- including all 26 doors that set
    -- `app.in_meeting_rpc` -- still falls through to the raise below, which is what
    -- ADR 0126 section E's bound rests on. Do NOT widen this to `app.in_meeting_rpc`.
    if coalesce(current_setting('app.in_disposal_rpc', true), '') = 'on' then
      return case when tg_op = 'DELETE' then old else new end;
    end if;

    raise exception 'o conteúdo desta reunião está bloqueado (%)', v_status
      using errcode = 'check_violation';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$function$;

-- 2 .  The door sets the new flag around its child UPDATE, and the false comment on
--      `app.in_meeting_rpc` is corrected (ADR 0129 Decision 2). The in_meeting_rpc
--      set/reset pair STAYS -- the parent-table guards do honour it.
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
  -- which reads a different flag -- see the child UPDATE below. The comment that used to
  -- sit here claimed it bypassed "the meeting freeze guards" (plural, unqualified); that
  -- was false for the children and is the defect ADR 0129 fixes.
  perform set_config('app.in_meeting_rpc', 'on', true);
  perform set_config('app.phi_dispose_reason', p_reason, true);

  update public.meetings set minutes_md = null where id = p_meeting_id;

  -- The child lock refuses EVERY writer on a locked meeting, which is exactly the
  -- population carrying PHI. This is the single named exception (ADR 0129): set
  -- immediately before the child UPDATE and reset immediately after, so the stand-aside
  -- cannot span the audit write or anything else in the caller's transaction.
  perform set_config('app.in_disposal_rpc', 'on', true);
  update public.meeting_agenda_items
     set description = v_redacted, discussion_notes = v_redacted, resolution = v_redacted
   where meeting_id = p_meeting_id;
  perform set_config('app.in_disposal_rpc', 'off', true);

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
