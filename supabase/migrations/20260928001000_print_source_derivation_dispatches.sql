-- The four PRINT-SOURCE DERIVATION DISPATCHES (ADR 0125 D1/D8 + Amendment 2 ·
-- ADR 0126 D5/D7/D8/D9/D10 + the lead-ruled disposal conjunct).
--
-- ═══════════════════════════════════════════════════════════════════════════
-- WHY FOUR SEPARATE FUNCTIONS AND NOT FOUR MORE `if p_source_kind = …` BLOCKS
-- INSIDE THE MINT.
-- ═══════════════════════════════════════════════════════════════════════════
-- `public.mint_printed_document` carries this in its own body, and it is a
-- constraint, not a style note:
--
--   "the REGISTRATION-MIRROR TRIO, site 3 of exactly 3 (template coherence ·
--    commission resolution · PHI capability). A FOURTH kind-conditional site in
--    this door is the abstraction-leak signal — stop and re-plan, never extend."
--
-- So each derivation lands as its OWN dispatch with a per-kind CASE and a
-- fail-closed ELSE — the shape `app.can_view_printed_document` already uses —
-- and the mint calls them ONCE, kind-agnostically. That satisfies the trio
-- constraint and ADR 0126 D7's "every kind declares FOUR concepts separately"
-- in the same move: the constraint and the ADR want the same structure.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- THE FOUR CONCEPTS, AND WHY NONE OF THEM IS DERIVABLE FROM ANOTHER
-- ═══════════════════════════════════════════════════════════════════════════
--   registers  — is the source LOCKED, so printing yields a REGISTERED emission?
--   watermark  — is the CONTENT final?
--   series     — which logical document does a print belong to?
--   head       — is this source still the current revision of that series?
--
-- 0125 D8 and 0126 D7 require separate declaration EVEN WHERE THEY COINCIDE, and
-- the history is the argument: `form_response` collapses registers and watermark
-- onto `submitted`, and that coincidence is exactly what made a single predicate
-- look sufficient until meetings were examined — where they genuinely separate at
-- `in_signature` (registers, stamped RASCUNHO). Round 1 then derived `head` from
-- `series` by fiat; for meetings that fiat was constant-true, and 0126 D9 records
-- what it cost. ⛔ Do not factor these into a shared helper.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- THE VECTORS ARE THE AUTHORITY, AND THEY ARE WHY THIS SQL/TS MIRROR IS LEGAL
-- ═══════════════════════════════════════════════════════════════════════════
-- `registers` and `watermark` exist TWICE — here, and as `printSourceRegisters` /
-- `printSourceWatermark` in `src/lib/pdf/documents/print-source.ts`. ADR 0126 D3
-- REJECTS "both mechanisms" on the grounds that two computations of one property
-- can disagree with nothing going red. That rejection stands. It does not bite
-- here SOLELY because
-- `src/lib/queries/__fixtures__/print-source-registers-vectors.json` drives both
-- sides and reds on divergence — the same answer Architecture Rule 3 gives for
-- the condition evaluator. ⛔ Anyone deleting that fixture re-opens the D3 hole.
--
-- ⚠ `app.print_source_watermark` has NO production caller: the RENDERING
-- authority is the TS `printSourceWatermark`. It exists so the pgTAP side can
-- assert 0125 D5's fourth-cell invariant against an EXECUTABLE PREDICATE over
-- CONSTRUCTED sources, rather than against the literal fixture table — asserting
-- a fixture against itself is the vacuity shape, and D5 says "Pin it, don't
-- reason it." Lead-ratified. ⛔ Do not "fix" a divergence by pointing the
-- renderer at this function.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- SCOPE NOTE: `meetings.revision` LANDS HERE, ONE TASK EARLY, AND DELIBERATELY
-- ═══════════════════════════════════════════════════════════════════════════
-- 0126 D9's head test for meetings IS the revision match, so `print_source_head`
-- cannot be written without the column. Adding it here keeps the dispatch whole
-- rather than shipping a half-built one that reads a column added later. The
-- BEHAVIOUR that makes it meaningful — the `reopen_meeting` bump, the stored
-- `printed_documents.source_revision`, and the mint's registration gate — is the
-- next migration's, and until it lands `revision` is 0 everywhere and the meeting
-- head test is trivially true. That is a correct interim state, not a gap: no
-- print stores a revision yet either.

-- ---------------------------------------------------------------------------
-- 0. `meetings.revision` — the monotonic epoch (0126 D9)
-- ---------------------------------------------------------------------------
-- ⭐ WHY AN EPOCH AND NOT A SET-MEMBERSHIP TEST. The corridor D2 could not see:
-- mint at `signed` -> `reopen_meeting` -> edit -> re-advance -> re-sign -> nobody
-- re-mints. The registration predicate is satisfied AGAIN, so any predicate
-- phrased as "is the source in a registering state" reads TRUE and the old print
-- — whose `content_hash` pins content that no longer exists — reads current. A
-- monotonic counter is the only thing that distinguishes "the same state" from
-- "this state again, with different content".
alter table public.meetings
  add column if not exists revision integer not null default 0;

comment on column public.meetings.revision is
  'ADR 0126 D9. Monotonic edit epoch, bumped ONLY by public.reopen_meeting — the '
  'platform''s one backwards door on meetings.status. A meeting print stores the '
  'revision it was minted from; HEAD for a meeting print is the revision match. '
  '⛔ A second writer of this column breaks the epoch: it must only ever advance '
  'when the minutes re-enter an editable state.';

-- `meetings` carries TABLE-level grants for authenticated/service_role, so this
-- column inherits them. (Contrast `printed_documents`, which carries a curated
-- COLUMN-list SELECT grant — a new column there needs its own GRANT or reads
-- fail 42501. Verified against information_schema.column_privileges, not assumed.)

-- ---------------------------------------------------------------------------
-- 1. THE ONE STATE RESOLVER
-- ---------------------------------------------------------------------------
-- `registers` and `watermark` read the same four facts. Resolving them ONCE and
-- letting both dispatches decide from the result is not a shared *predicate* —
-- the D8/D7 separation is about the DECISION, not about the row fetch — and it
-- keeps the two axes reading identical inputs, so a divergence between them can
-- only ever be a real difference of rule.
--
-- ⚠ SECURITY DEFINER, and that is load-bearing: it must answer truthfully about
-- source state regardless of who is asking. Every caller is itself a DEFINER door
-- running as the owner, so this is never an amplification. An INVOKER version
-- would silently return "does not register" for a source the caller merely cannot
-- SEE — a wrong answer in the fail-open direction for any future invoker caller.
create or replace function app.resolve_print_source_state(
  p_source_kind text,
  p_source_id uuid,
  out o_found boolean,
  out o_status text,
  out o_correction_open boolean,
  out o_phase_voided boolean,
  out o_meeting_disposed boolean
)
returns record
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_phase uuid;
begin
  o_found            := false;
  o_status           := null;
  o_correction_open  := false;
  o_phase_voided     := false;
  o_meeting_disposed := false;

  if p_source_id is null then
    return;
  end if;

  case p_source_kind
    when 'form_response' then
      select r.status, r.case_phase_id into o_status, v_phase
      from public.responses r where r.id = p_source_id;
      if o_status is null then
        return;                                  -- no row: fail closed
      end if;
      o_found := true;

      -- 0126 D10, operationally: the EXACT set `reject_correction` accepts. In
      -- requested/in_progress/rejected the draft is not `submitted` anyway; in
      -- approved/withdrawn the request is closed — and BOTH of those were
      -- measured terminal (all 7 writers of the column swept; `review_correction`
      -- requires resubmitted/requested, `withdraw_correction` requires
      -- requested/in_progress/rejected).
      o_correction_open := exists (
        select 1 from public.case_correction_requests cr
         where cr.draft_response_id = p_source_id
           and cr.status in ('resubmitted', 'under_review'));

      -- 0126 D10. `approve_correction(kind='void')` sets the PHASE to voided,
      -- clears its result, moves no pointer and never touches the response — so
      -- without this the request closes, both currency conjuncts read true again,
      -- and the print of a formally annulled phase reads "autêntico e atual"
      -- forever. Measured terminal: `activate_phase` refuses anything but
      -- `pending` (HC019) and no other door leaves `voided`.
      if v_phase is not null then
        o_phase_voided := exists (
          select 1 from public.case_phases cp
           where cp.id = v_phase and cp.status = 'voided');
      end if;

    when 'meeting' then
      select m.status, m.phi_disposed_at is not null
        into o_status, o_meeting_disposed
      from public.meetings m where m.id = p_source_id;
      if o_status is null then
        return;
      end if;
      o_found := true;

    else
      -- ELSE_FAIL_CLOSED. `case` (P3) / `interview` (P4) are in the source_kind
      -- CHECK but have no provider; an unhandled kind resolves to NOT FOUND, so
      -- every dispatch below fails shut rather than quietly registering.
      return;
  end case;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 2. REGISTERS — 0125 D1, refined by 0126 D5 + D10 + the disposal conjunct
-- ---------------------------------------------------------------------------
create or replace function app.print_source_registers(
  p_source_kind text,
  p_source_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  s record;
begin
  s := app.resolve_print_source_state(p_source_kind, p_source_id);
  if not s.o_found then
    return false;
  end if;

  case p_source_kind
    when 'form_response' then
      -- THREE conjuncts. `submitted` alone is NOT a lock point: a state a door
      -- can walk back out of is not a lock point (0126 D5). `reject_correction`
      -- walks a submitted correction draft back to `in_progress` — the corridor
      -- that raised HC069 (0125 Amendment 1 §A) — and the void door annuls the
      -- phase without touching the response at all (D10).
      -- ⚠ o_meeting_disposed is a MEETING fact and is IGNORED here, by design.
      -- Pinned by a cross-kind vector, not by this comment.
      return s.o_status = 'submitted'
         and not s.o_correction_open
         and not s.o_phase_voided;

    when 'meeting' then
      -- 0125 D1 — the LOCK point, NOT the watermark's finality point. An ata
      -- circulating for signature is a document of record: undeletable from that
      -- moment, and it is what the committee is being asked to attest to.
      --
      -- ⛔ `cancelled` is EXCLUDED even though it sits in the lock set
      -- (`guard_meeting_status` refuses a DELETE there). The lock exists to
      -- preserve the audit trail of a cancellation, not because an ata of record
      -- was produced — there are no minutes to pin. This is the ONE place the
      -- registering set is a strict subset of the lock set, and it is a decision.
      -- It is also why nothing here is named `is_locked`: that name would have to
      -- return TRUE at `cancelled` and would be a lie about what this decides.
      --
      -- The disposal conjunct is the meeting analogue of D10's voided phase — a
      -- deliberate, authorized, terminal annulment of the record's CONTENT.
      -- `dispose_meeting_minutes` nulls `minutes_md` and redacts the agenda
      -- WITHOUT touching status or revision, so without this a disposed ata both
      -- keeps reading "atual" AND can mint NEW registered paper for a record the
      -- platform was just obligated to destroy. Currency falls out of D2's first
      -- conjunct for free — no second site, no new writer (D3 intact).
      -- ⚠ o_correction_open / o_phase_voided are FORM_RESPONSE facts and are
      -- IGNORED here. Also pinned by a cross-kind vector.
      return s.o_status in ('in_signature', 'signed', 'distributed')
         and not s.o_meeting_disposed;

    else
      return false;
  end case;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 3. WATERMARK — 0104 D7, refined for form_response by 0125 Amendment 2, and
--    for meeting by the disposal conjunct (the SAME tandem move, second time)
-- ---------------------------------------------------------------------------
create or replace function app.print_source_watermark(
  p_source_kind text,
  p_source_id uuid
)
returns text
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  s record;
begin
  s := app.resolve_print_source_state(p_source_kind, p_source_id);
  if not s.o_found then
    return 'draft';
  end if;

  case p_source_kind
    when 'form_response' then
      -- ⚠ The three conjuncts are REPEATED from print_source_registers ON
      -- PURPOSE (0125 D8 / 0126 D7 — declared separately; "the coincidence is
      -- recorded, not exploited"). Factoring them out would make one edit move
      -- both axes silently, which is the coupling 0125 D1 exists to break.
      --
      -- 0125 Amendment 2: the watermark moves IN TANDEM with the refined lock,
      -- and THAT is what keeps D5's fourth cell unreachable. Keyed on `submitted`
      -- alone, a submitted draft of an open correction would print FINAL while
      -- carrying the prévia footer — a page the platform disclaims whose
      -- watermark claims it is settled.
      return case
        when s.o_status = 'submitted'
         and not s.o_correction_open
         and not s.o_phase_voided then 'final'
        else 'draft'
      end;

    when 'meeting' then
      -- ⛔ The STATUS half is unchanged by 0125 D1 — an `in_signature` ata
      -- registers stamped RASCUNHO on purpose (printing FINAL there would put a
      -- lie on the page: the signature footer still renders "— não assinado —",
      -- and 312 + E2E pin the mark). The TS twin delegates to
      -- `meetingWatermarkFor`, which likewise does not change.
      --
      -- ⭐ THE DISPOSAL TERM IS THE TANDEM MOVE, AND IT IS FORCED. With the
      -- conjunct in registration ONLY, a `signed` + disposed meeting would be
      -- registers=false + watermark='final' — 0125 D5's forbidden fourth cell,
      -- REACHED. This is Amendment 2's shape recurring for the meeting kind, so
      -- it takes Amendment 2's answer. Pinned by the signed+disposed vector.
      return case
        when s.o_status in ('signed', 'distributed')
         and not s.o_meeting_disposed then 'final'
        else 'draft'
      end;

    else
      return 'draft';
  end case;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 4. SERIES — 0126 D1
-- ---------------------------------------------------------------------------
-- ⚠ STORED AT MINT, NOT DERIVED, AND THAT IS FORCED rather than preferred: the
-- one-active partial unique index needs a stored column, and this function reads
-- tables so it can never be IMMUTABLE and can never be indexed.
--
-- The defect the series closes is live today and was invisible:
-- `start_correction_draft` inserts a NEW `responses` row carrying
-- `supersedes_id`, so after one correction R1 and R2 are unrelated as far as the
-- registry is concerned and BOTH can hold an `active` print — one logical
-- document, two current papers, no constraint violated.
create or replace function app.print_source_series(
  p_source_kind text,
  p_source_id uuid
)
returns uuid
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_cursor uuid;
  v_prev   uuid;
  v_depth  int := 0;
begin
  if p_source_id is null then
    return null;
  end if;

  case p_source_kind
    when 'form_response' then
      -- Walk to the ROOT of the supersedes_id chain. The chain is linear:
      -- `guard_supersession_coherent` requires a case-bound successor to point at
      -- `case_phases.current_response_id`, and
      -- `responses_one_successor_per_superseded` backstops the standalone lane.
      select r.id, r.supersedes_id into v_cursor, v_prev
      from public.responses r where r.id = p_source_id;
      if v_cursor is null then
        return null;                             -- no row: the mint raises
      end if;

      -- ⚠ BOUNDED, and it RAISES rather than returning a wrong root. A cycle is
      -- unconstructible today (the guard + the unique index), but "unconstructible"
      -- is a claim about today's writers; an unbounded walk would hang the mint
      -- instead of failing it, and a silent bail would store a WRONG series — which
      -- the one-active index would then enforce against the wrong group.
      while v_prev is not null loop
        v_depth := v_depth + 1;
        if v_depth > 1000 then
          raise exception
            'cadeia de correção inconsistente (profundidade excessiva) para a resposta %',
            p_source_id using errcode = 'HC0H4';
        end if;
        v_cursor := v_prev;
        select r.supersedes_id into v_prev
        from public.responses r where r.id = v_cursor;
      end loop;
      return v_cursor;

    when 'meeting' then
      -- Meetings have no revision CHAIN — a reopen edits the same row rather than
      -- spawning a successor, which is exactly why they needed `revision` (D9)
      -- and why the series alone was not enough for them.
      return (select m.id from public.meetings m where m.id = p_source_id);

    else
      return null;                               -- fail closed; the mint raises
  end case;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 5. HEAD — 0126 D8 (form_response) + D9 (meeting), incl. the lead-ratified
--    STANDALONE-lane extension
-- ---------------------------------------------------------------------------
create or replace function app.print_source_head(
  p_source_kind text,
  p_source_id uuid,
  p_source_revision integer default 0
)
returns boolean
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
begin
  if p_source_id is null then
    return false;
  end if;

  case p_source_kind
    when 'form_response' then
      if not exists (select 1 from public.responses r where r.id = p_source_id) then
        return false;
      end if;

      -- NOT-head ⇔ a direct successor exists that has TAKEN EFFECT.
      --
      -- ⭐ THE GRAIN IS THE APPROVAL DOOR, NOT THE CHAIN TIP (0126 D8).
      -- Chain-tip semantics ("head ⇔ no successor row exists") would flip the
      -- original's print to "não é mais a atual" the moment
      -- `start_correction_draft` inserts R2 — before any content is approved —
      -- and flip it BACK on withdrawal or rejection: currency flapping on a
      -- public page, driven by a low-authority act, disclosing an in-flight
      -- correction to any paper-holder.
      --
      -- ⚠ TWO LANES, because 0126 D8 only defined one and the other is real.
      -- D8 measured `case_phases.current_response_id` moving only in
      -- `approve_correction`, which is the PHASE-BOUND corridor. But
      -- `public.supersede_response` creates a STANDALONE successor with no
      -- correction request at all (it raises HC0H1 when case_phase_id is not
      -- null, so the two lanes are cleanly disjoint) — under D8 as written a
      -- corrected standalone original would be head FOREVER and its stale print
      -- would read "atual", which is D4's own named defect. Lead-ratified
      -- extension; recorded as an ADR 0126 amendment.
      --
      -- The standalone arm reuses the platform's EXISTING effectiveness rule
      -- rather than inventing one: `app.submitted_form_responses` — the
      -- dashboard choke-point Architecture Rule 9 binds new aggregation paths to
      -- — excludes a row with a SUBMITTED successor, and its own comment states
      -- the principle: "A merely in_progress successor does NOT exclude the
      -- predecessor". So this arm does not flip on draft creation either
      -- (`supersede_response` inserts the successor `in_progress`), which is
      -- D8's stated requirement.
      --
      -- ⚠ Chosen over raw pointer equality (head ⇔ id = current_response_id) on
      -- D8's measured edge: an ETH·E2 targeted-respondent DEFENSE response is
      -- phase-attached but the pointer never references it
      -- (`sync_case_phase_on_submit` returns early for
      -- `target_case_participant_id` rows), so pointer equality would leave every
      -- registered defense print permanently not-current. Under the rule below a
      -- defense response has no successor and is therefore trivially head, as are
      -- all phase-less and chainless responses.
      return not exists (
        select 1
        from public.responses succ
        where succ.supersedes_id = p_source_id
          and (
            -- phase-bound lane (D8 verbatim)
            exists (
              select 1 from public.case_correction_requests cr
               where cr.draft_response_id = succ.id
                 and cr.status = 'approved')
            -- standalone lane (the ratified extension)
            or (succ.case_phase_id is null and succ.status = 'submitted')
          ));

    when 'meeting' then
      -- 0126 D9. The revision match, NOT constant-true. Round 1 declared meetings
      -- always-head as a by-product of "series = own id", and that fiat constant
      -- is the hole the reopen -> edit -> re-sign round trip walks through.
      return exists (
        select 1 from public.meetings m
         where m.id = p_source_id
           and m.revision = coalesce(p_source_revision, 0));

    else
      -- Fail closed = NOT head = not current. An unknown kind cannot hold a print
      -- anyway (the mint's own dispatch refuses it first).
      return false;
  end case;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 6. THE PUBLIC READ SEAM — state only, never the verdicts
-- ---------------------------------------------------------------------------
-- ⭐ THIS RETURNS THE STATE AND NOT `registers`/`watermark`, DELIBERATELY. The
-- client derives with `printSourceRegisters`/`printSourceWatermark`; the server
-- derives with the dispatches above; the shared vectors red on divergence. If
-- this door returned the verdicts, the TS predicate would have nothing to do and
-- its suite would go vacuous while looking green — and the mirror that makes ADR
-- 0126 D3 survivable would quietly become decoration.
--
-- Authority: `app.can_view_printed_document`, the same gate the mint uses (0125
-- D6 — the prévia's authority IS source-read authority). Returns ZERO ROWS when
-- unauthorized rather than raising, mirroring `open_printed_document`: not-found
-- and not-authorized are one indistinguishable answer, so there is no existence
-- oracle.
--
-- ⚠ For `meeting` this gate is NARROWER than `meetings_select`: it also requires
-- `app.can_read_full_meeting_content`, which is false for a case respondent on a
-- linked agenda item, or for a member lacking `read_case_deliberation` where
-- deliberation text exists. That is DELIBERATE — `buildMeetingPayload` has no
-- masked rendering path, so serving that persona would produce an ata with
-- content silently removed and no indication of it, which is worse than a
-- refusal. Recorded as an ADR 0125 D6 correction: prévia authority for meetings
-- is source-read AND unmasked-content.
create or replace function public.print_source_state(
  p_source_kind text,
  p_source_id uuid
)
returns table (
  status           text,
  correction_open  boolean,
  phase_voided     boolean,
  meeting_disposed boolean
)
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  s record;
begin
  perform app.assert_document_printing_enabled();

  if not app.can_view_printed_document(p_source_kind, p_source_id, auth.uid()) then
    return;                                      -- no row: no oracle
  end if;

  s := app.resolve_print_source_state(p_source_kind, p_source_id);
  if not s.o_found then
    return;
  end if;

  return query select s.o_status, s.o_correction_open, s.o_phase_voided, s.o_meeting_disposed;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 7. ACLs — EXPLICIT, because the DEFAULT is PUBLIC
-- ---------------------------------------------------------------------------
-- ⛔ A new function enters the catalog with a NULL `proacl`, and NULL is not
-- "no access" — it is the DEFAULT, which grants EXECUTE to PUBLIC. The `app`
-- schema grants USAGE to `authenticated`, so a NULL-proacl function there really
-- is reachable by every logged-in user. That exact class shipped live in
-- `20260928000700` with the feature's own suite fully green and was caught only
-- by the `320` U1 ACL census. 228 `app` functions currently sit at NULL.
--
-- The five `app.*` dispatches get NO `authenticated` grant — unlike their
-- `app.can_*` siblings — because every caller is itself a DEFINER door running as
-- the owner. Nothing invoker-side needs them, so nothing invoker-side gets them.
revoke all on function app.resolve_print_source_state(text, uuid) from public;
revoke all on function app.print_source_registers(text, uuid)     from public;
revoke all on function app.print_source_watermark(text, uuid)     from public;
revoke all on function app.print_source_series(text, uuid)        from public;
revoke all on function app.print_source_head(text, uuid, integer) from public;

-- The public read seam is the ONE thing a session calls directly.
revoke all on function public.print_source_state(text, uuid) from public;
grant execute on function public.print_source_state(text, uuid) to authenticated, service_role;

-- ⚠ VERIFY FROM THE CATALOG, NOT FROM THE TEXT ABOVE. A `revoke` the caller is
-- not entitled to make is a silent no-op (no error, privilege unchanged), so the
-- statements having "run" proves nothing. This block re-reads `pg_proc.proacl`
-- and RAISES if any of the six is still PUBLIC-executable — the migration fails
-- rather than recording a hardening it did not perform.
do $$
declare
  v_bad text;
begin
  select string_agg(p.proname, ', ' order by p.proname) into v_bad
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where (n.nspname, p.proname) in (
          ('app', 'resolve_print_source_state'), ('app', 'print_source_registers'),
          ('app', 'print_source_watermark'),     ('app', 'print_source_series'),
          ('app', 'print_source_head'),          ('public', 'print_source_state'))
    and has_function_privilege('public', p.oid, 'execute');

  if v_bad is not null then
    raise exception
      'ACL REGRESSION: still PUBLIC-executable after the revokes: %', v_bad;
  end if;

  raise notice 'print-source dispatches: PUBLIC execute revoked on all 6 (catalog-verified).';
end $$;
