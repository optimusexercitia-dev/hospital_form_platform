-- ============================================================================
-- PDF·P3 (ADR 0144) — the case PRINT REVISION substrate: D4's currency counter
-- and D15's trigger-bump set.
--
-- ADR 0126 D9 gives printed documents their currency from a monotonic counter on
-- the source (`meetings.revision`), and `printed_documents.source_revision` is
-- NOT NULL. Cases had no counter, so D4 specified one. D15 then widened WHO may
-- move it: not only `reopen_case`, but every write that changes what the dossier
-- RENDERS — because a `completed` case's rendered text can drift with no
-- case-level door involved at all (`rename_case_tag`, `update_case_outcome`,
-- `archive_case_outcome` are commission-level and take NO case argument, so no
-- case-terminality guard COULD apply to them).
--
-- ⛔ **D4 SAID `cases.revision`. IT CANNOT LIVE THERE, AND THE REASON IS A HARD
--    CONFLICT, NOT A PREFERENCE.** `app.guard_case_status` (BEFORE UPDATE on
--    `public.cases`) raises `check_violation` — *"cases in a terminal state are
--    immutable (update blocked)"* — on ANY non-status update to a `completed` or
--    `cancelled` case unless `app.in_case_rpc` is on. D15 needs the counter to
--    move EXACTLY while the case is terminal. So a column on `cases` would be
--    writable precisely when the counter must not move, and refused precisely
--    when it must. The two clauses of the ADR are unsatisfiable on one table.
--
--    The rejected fix was to set `app.in_case_rpc` inside the bump trigger. That
--    flag is a BROAD bypass — it also unlocks status transitions on a frozen case
--    — and switching it on from a trigger that fires on ordinary content writes
--    would open the terminal-case freeze for the remainder of every such
--    transaction. It would also route every revision bump through
--    `audit_cases_trg`, filing a `case.updated` row for a tag rename.
--
--    A counter about PRINTABILITY is not case CONTENT, so it does not belong
--    under the content freeze. It gets its own table, with no guard, no audit
--    trigger and no freeze to fight. `app.print_source_revision` reads it with
--    `coalesce(..., 0)`, so a case that has never been bumped reads 0 — exactly
--    what `meetings.revision`'s default gives, and what a never-superseded print
--    must match.
--
-- ⚠ **THE TRIGGER SET IS COUPLED TO THE TEMPLATE** (ADR 0144 D15 build note).
--    Every table listed below is a table `src/lib/pdf/documents/case.ts` renders.
--    ⛔ ADDING A SECTION TO THAT TEMPLATE CAN REQUIRE ADDING A TRIGGER HERE — a
--    rendered table with no trigger drifts silently, which is the exact defect
--    D15 exists to prevent. The template module carries the mirror of this note.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- The counter
-- ---------------------------------------------------------------------------

create table if not exists public.case_print_revisions (
  case_id    uuid primary key references public.cases(id) on delete cascade,
  revision   integer not null default 0 check (revision >= 0),
  updated_at timestamptz not null default now()
);

comment on table public.case_print_revisions is
  'PDF·P3 (ADR 0144 D4/D15). Monotonic print-currency counter per case — the '
  '`meetings.revision` analogue, kept OFF `public.cases` because '
  'app.guard_case_status freezes that table in exactly the states this counter '
  'must move in. Absent row == revision 0. Written ONLY by '
  'app.bump_case_print_revision; read only through app.print_source_revision. '
  'No RLS policies and no authenticated grant by design (the '
  'patient_identifiers posture): every consumer is SECURITY DEFINER.';

alter table public.case_print_revisions enable row level security;

-- Supabase default privileges grant anon/authenticated ALL on new public tables.
-- This one is DEFINER-only substrate, so take that back explicitly rather than
-- relying on RLS-with-no-policies alone (two locks, and the ACL is the one an
-- ADR 0079 wrapper arm can see).
revoke all on public.case_print_revisions from anon, authenticated;

-- ---------------------------------------------------------------------------
-- The gate, and the single writer
-- ---------------------------------------------------------------------------

create or replace function app.case_is_terminal(p_case_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  select coalesce(
    (select c.status in ('completed', 'cancelled')
       from public.cases c where c.id = p_case_id),
    false);   -- unknown case: fail closed, nothing to bump
$$;

comment on function app.case_is_terminal(uuid) is
  'Is this case in a terminal status? Named for the FACT it tests, not for its '
  'use. ⚠ Its status set must equal `app.print_source_registers`'' case arm — '
  'declared SEPARATELY (ADR 0125 D8 / 0126 D7 forbid factoring the print axes '
  'into a shared helper) and pinned by set-equality in pgTAP 368, not by this '
  'comment. If the registering set ever widens without this widening, content '
  'drift on the new status goes unbumped and /verificar starts lying.';

create or replace function app.bump_case_print_revision(p_case_id uuid)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  if p_case_id is null then
    return;
  end if;
  -- ⛔ ONLY WHILE TERMINAL, and that is a correctness claim, not an optimization.
  -- A registered print can exist only on a terminal case (D3), and the ONLY door
  -- out of `completed` is `reopen_case` ([INF] #1, catalog-verified 2026-08-25:
  -- 4 writers of cases.status; recompute guards manual terminals; cancel_case
  -- raises HC025 on terminal; reopen_case refuses `cancelled` with HC0M8).
  -- `reopen_case` itself changes `status`, a dossier-visible column, so the
  -- `cases` trigger below bumps on the way out. Every content edit made during
  -- the non-terminal window is therefore BRACKETED by that bump: the print taken
  -- before the reopen is already not-head, and nothing minted after it can pin
  -- pre-reopen bytes.
  if not app.case_is_terminal(p_case_id) then
    return;
  end if;

  insert into public.case_print_revisions as r (case_id, revision, updated_at)
  values (p_case_id, 1, now())
  on conflict (case_id) do update
    set revision = r.revision + 1, updated_at = now();
end;
$$;

comment on function app.bump_case_print_revision(uuid) is
  'The ONE writer of public.case_print_revisions (ADR 0144 D15). Silently '
  'no-ops for a null case and for a non-terminal one. Monotonic: an absent row '
  'reads 0 and the first bump writes 1.';

-- ---------------------------------------------------------------------------
-- Trigger bodies
-- ---------------------------------------------------------------------------

/*
 * Generic ROW-level bump for a table that carries the case id in one column,
 * named by TG_ARGV[0]. Handles the row MOVING between cases on UPDATE by
 * bumping both sides — a rendered row leaving case A changes A's dossier just
 * as much as it changes B's.
 */
create or replace function app.trg_bump_case_revision()
returns trigger
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_col text := tg_argv[0];
begin
  if tg_op <> 'INSERT' then
    perform app.bump_case_print_revision(nullif(to_jsonb(old) ->> v_col, '')::uuid);
  end if;
  if tg_op <> 'DELETE' then
    perform app.bump_case_print_revision(nullif(to_jsonb(new) ->> v_col, '')::uuid);
  end if;
  return null;   -- AFTER trigger
end;
$$;

/*
 * STATEMENT-level bump for `public.answers`, via responses -> case_phases.
 *
 * ⚠ Statement-level, alone among these, and deliberately: `answers` is the
 * product's highest-volume write path (one statement per wizard keystroke-save,
 * bulk statements at submit). A row trigger there would run the join per answer
 * row. Transition tables collapse that to one query per statement whatever the
 * row count, so the hot path pays a single indexed probe.
 */
create or replace function app.trg_bump_case_revision_answers_new()
returns trigger
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  perform app.bump_case_print_revision(cp.case_id)
  from new_answers a
  join public.responses r on r.id = a.response_id
  join public.case_phases cp on cp.id = r.case_phase_id
  group by cp.case_id;
  return null;
end;
$$;

create or replace function app.trg_bump_case_revision_answers_old()
returns trigger
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  perform app.bump_case_print_revision(cp.case_id)
  from old_answers a
  join public.responses r on r.id = a.response_id
  join public.case_phases cp on cp.id = r.case_phase_id
  group by cp.case_id;
  return null;
end;
$$;

/* Interview children -> their interview's case. */
create or replace function app.trg_bump_case_revision_via_interview()
returns trigger
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_interview uuid;
begin
  v_interview := coalesce(
    nullif(to_jsonb(case when tg_op = 'DELETE' then old else new end) ->> 'interview_id', '')::uuid,
    null);
  perform app.bump_case_print_revision(i.case_id)
    from public.case_interviews i where i.id = v_interview;
  return null;
end;
$$;

/* Patient identifiers -> every case the participant is linked to (D5's
   identified variant renders these; the de-identified one renders age/sex/unit,
   which live on the same row). */
create or replace function app.trg_bump_case_revision_via_participant()
returns trigger
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_participant uuid;
begin
  v_participant := (to_jsonb(case when tg_op = 'DELETE' then old else new end)
                    ->> 'participant_id')::uuid;
  perform app.bump_case_print_revision(cp.case_id)
  from public.case_participants cp
  where cp.participant_id = v_participant
  group by cp.case_id;
  return null;
end;
$$;

/*
 * Case-homed documents -> the case (D2's uploaded-binary MANIFEST lines).
 *
 * ⛔ `printed_rendition` rows are EXCLUDED, and skipping that exclusion is a
 * self-invalidating mint. `mint_printed_document` inserts the print's own
 * `documents` row homed on the source — i.e. on the case — INSIDE the mint
 * transaction and AFTER the compare-and-mint check has already passed. A bump
 * there would advance the counter past the `source_revision` the same
 * transaction is storing, so every case mint would land NOT-CURRENT the instant
 * it succeeded, and `printed_document_currency` would report "não é mais a
 * atual" on paper whose ink is still wet.
 */
create or replace function app.trg_bump_case_revision_documents()
returns trigger
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_rec jsonb := to_jsonb(case when tg_op = 'DELETE' then old else new end);
begin
  if v_rec ->> 'kind' = 'printed_rendition' then
    return null;
  end if;
  perform app.bump_case_print_revision(c.id)
    from public.cases c where c.id = (v_rec ->> 'home_resource_id')::uuid;
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- The trigger set — one line per DOSSIER-VISIBLE table (D15's coupling)
-- ---------------------------------------------------------------------------

-- `cases` itself. AFTER UPDATE, column-scoped to what the template prints.
-- ⚠ Gated on OLD.status, which is what makes `reopen_case` bump for free:
-- completed -> pending is a change to a printed column on a case that WAS
-- terminal. D4's "bumped by reopen_case" is therefore satisfied by this one
-- rule rather than by a second, separate write inside that door — one mechanism,
-- no two authorities that can disagree.
create or replace function app.trg_bump_case_revision_self()
returns trigger
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  if old.status not in ('completed', 'cancelled') then
    return null;   -- was not locked: nothing registered, nothing to invalidate
  end if;
  insert into public.case_print_revisions as r (case_id, revision, updated_at)
  values (old.id, 1, now())
  on conflict (case_id) do update
    set revision = r.revision + 1, updated_at = now();
  return null;
end;
$$;

drop trigger if exists bump_case_print_revision_self on public.cases;
create trigger bump_case_print_revision_self
  after update of label, status, outcome_id, confidentiality_level, case_type_id,
                  closed_at, department_id, department_other, has_patient,
                  phi_disposed_at
  on public.cases
  for each row execute function app.trg_bump_case_revision_self();

-- Direct children keyed on `case_id`.
drop trigger if exists bump_case_print_revision on public.case_narratives;
create trigger bump_case_print_revision after insert or update or delete
  on public.case_narratives for each row
  execute function app.trg_bump_case_revision('case_id');

drop trigger if exists bump_case_print_revision on public.case_events;
create trigger bump_case_print_revision after insert or update or delete
  on public.case_events for each row
  execute function app.trg_bump_case_revision('case_id');

drop trigger if exists bump_case_print_revision on public.case_phases;
create trigger bump_case_print_revision after insert or update or delete
  on public.case_phases for each row
  execute function app.trg_bump_case_revision('case_id');

drop trigger if exists bump_case_print_revision on public.case_interviews;
create trigger bump_case_print_revision after insert or update or delete
  on public.case_interviews for each row
  execute function app.trg_bump_case_revision('case_id');

drop trigger if exists bump_case_print_revision on public.case_participants;
create trigger bump_case_print_revision after insert or update or delete
  on public.case_participants for each row
  execute function app.trg_bump_case_revision('case_id');

drop trigger if exists bump_case_print_revision on public.case_tag_assignments;
create trigger bump_case_print_revision after insert or update or delete
  on public.case_tag_assignments for each row
  execute function app.trg_bump_case_revision('case_id');

drop trigger if exists bump_case_print_revision on public.case_correction_requests;
create trigger bump_case_print_revision after insert or update or delete
  on public.case_correction_requests for each row
  execute function app.trg_bump_case_revision('case_id');

drop trigger if exists bump_case_print_revision on public.meeting_cases;
create trigger bump_case_print_revision after insert or update or delete
  on public.meeting_cases for each row
  execute function app.trg_bump_case_revision('case_id');

-- Direct children keyed on a differently-named column.
drop trigger if exists bump_case_print_revision on public.case_referral;
create trigger bump_case_print_revision after insert or update or delete
  on public.case_referral for each row
  execute function app.trg_bump_case_revision('source_case_id');

drop trigger if exists bump_case_print_revision on public.action_items;
create trigger bump_case_print_revision after insert or update or delete
  on public.action_items for each row
  execute function app.trg_bump_case_revision('source_case_id');

-- Indirect children.
drop trigger if exists bump_case_print_revision_ins on public.answers;
create trigger bump_case_print_revision_ins after insert on public.answers
  referencing new table as new_answers
  for each statement execute function app.trg_bump_case_revision_answers_new();

drop trigger if exists bump_case_print_revision_upd on public.answers;
create trigger bump_case_print_revision_upd after update on public.answers
  referencing new table as new_answers
  for each statement execute function app.trg_bump_case_revision_answers_new();

drop trigger if exists bump_case_print_revision_del on public.answers;
create trigger bump_case_print_revision_del after delete on public.answers
  referencing old table as old_answers
  for each statement execute function app.trg_bump_case_revision_answers_old();

drop trigger if exists bump_case_print_revision on public.case_interview_subjects;
create trigger bump_case_print_revision after insert or update or delete
  on public.case_interview_subjects for each row
  execute function app.trg_bump_case_revision_via_interview();

drop trigger if exists bump_case_print_revision on public.case_interview_interviewers;
create trigger bump_case_print_revision after insert or update or delete
  on public.case_interview_interviewers for each row
  execute function app.trg_bump_case_revision_via_interview();

drop trigger if exists bump_case_print_revision on public.patient_identifiers;
create trigger bump_case_print_revision after insert or update or delete
  on public.patient_identifiers for each row
  execute function app.trg_bump_case_revision_via_participant();

drop trigger if exists bump_case_print_revision on public.documents;
create trigger bump_case_print_revision after insert or update or delete
  on public.documents for each row
  execute function app.trg_bump_case_revision_documents();

-- ---------------------------------------------------------------------------
-- Vocabulary tables — D15's PROOF SET
--
-- These are the three writers the finding rested on: `rename_case_tag`,
-- `update_case_outcome` and `archive_case_outcome` are COMMISSION-level and take
-- NO case argument, so no case-terminality guard could ever apply to them. They
-- need no reachability argument. Renaming a tag or an outcome changes the
-- rendered text of every dossier that displays it, so the bump is set-based:
-- every terminal case that shows the renamed row.
-- ---------------------------------------------------------------------------

create or replace function app.trg_bump_case_revision_tag()
returns trigger language plpgsql security definer
set search_path to 'app', 'public', 'pg_catalog' as $$
begin
  perform app.bump_case_print_revision(ta.case_id)
  from public.case_tag_assignments ta where ta.tag_id = new.id group by ta.case_id;
  return null;
end; $$;

create or replace function app.trg_bump_case_revision_outcome()
returns trigger language plpgsql security definer
set search_path to 'app', 'public', 'pg_catalog' as $$
begin
  perform app.bump_case_print_revision(c.id)
  from public.cases c where c.outcome_id = new.id;
  return null;
end; $$;

create or replace function app.trg_bump_case_revision_narrative_type()
returns trigger language plpgsql security definer
set search_path to 'app', 'public', 'pg_catalog' as $$
begin
  perform app.bump_case_print_revision(n.case_id)
  from public.case_narratives n where n.narrative_type_id = new.id group by n.case_id;
  return null;
end; $$;

create or replace function app.trg_bump_case_revision_case_type()
returns trigger language plpgsql security definer
set search_path to 'app', 'public', 'pg_catalog' as $$
begin
  perform app.bump_case_print_revision(c.id)
  from public.cases c where c.case_type_id = new.id;
  return null;
end; $$;

create or replace function app.trg_bump_case_revision_participant_role()
returns trigger language plpgsql security definer
set search_path to 'app', 'public', 'pg_catalog' as $$
begin
  perform app.bump_case_print_revision(cp.case_id)
  from public.case_participants cp where cp.role_id = new.id group by cp.case_id;
  return null;
end; $$;

drop trigger if exists bump_case_print_revision on public.case_tags;
create trigger bump_case_print_revision after update of name on public.case_tags
  for each row execute function app.trg_bump_case_revision_tag();

drop trigger if exists bump_case_print_revision on public.case_outcomes;
create trigger bump_case_print_revision after update of label on public.case_outcomes
  for each row execute function app.trg_bump_case_revision_outcome();

drop trigger if exists bump_case_print_revision on public.case_narrative_types;
create trigger bump_case_print_revision after update of label on public.case_narrative_types
  for each row execute function app.trg_bump_case_revision_narrative_type();

drop trigger if exists bump_case_print_revision on public.case_types;
create trigger bump_case_print_revision after update of display_name on public.case_types
  for each row execute function app.trg_bump_case_revision_case_type();

drop trigger if exists bump_case_print_revision on public.case_participant_roles;
create trigger bump_case_print_revision after update of display_name
  on public.case_participant_roles
  for each row execute function app.trg_bump_case_revision_participant_role();
