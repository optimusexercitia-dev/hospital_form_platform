-- ============================================================================
-- PDF·P3 (ADR 0144 D3/D4/D7) — the `case` arm of the print-source dispatch.
--
-- Seven functions gain one branch each, mirroring how `meeting` was done in P2.
-- Nothing here is new machinery: the lock point (D3), the currency counter
-- (D4/D15, built in 20261003002200) and the full-content predicate (D8, built in
-- 20261003002300) already exist. This file wires them into the dispatch.
--
-- ⛔ **TWO DROP+CREATEs IN THIS FILE, AND BOTH ARE ACL HAZARDS. READ THIS.**
--    `create or replace` PRESERVES a function's ACL. `drop` + `create` RESETS it
--    to NULL — and for a FUNCTION, **a NULL `proacl` is the DEFAULT, and the
--    default is `EXECUTE TO PUBLIC`**. Measured on the live catalog 2026-08-25,
--    before this file was written:
--
--      app.resolve_print_source_state  proacl = {postgres=X/postgres}
--      app.print_source_*              proacl = {postgres=X/postgres}
--      public.print_source_state       proacl = {postgres=X,service_role=X,authenticated=X}
--
--    Every one of those is an EXPLICIT, non-default ACL — somebody revoked
--    PUBLIC, and none of them carries a `=X/` (PUBLIC) entry. Measured in a
--    rolled-back transaction: a freshly created `app.*` function comes back with
--    `proacl = NULL` and BOTH `has_function_privilege('authenticated', …)` and
--    `has_function_privilege('anon', …)` = **true**. No `pg_default_acl` row
--    covers schema `app` (the nine that exist cover `public`, `storage`, `auth`,
--    `graphql*`, `extensions`, `supabase_functions`, `realtime`), so a fresh
--    function falls through to the PUBLIC default rather than to a Supabase
--    default grant. `authenticated` also holds USAGE on schema `app`.
--
--    ⇒ A naive DROP+CREATE of `app.resolve_print_source_state` silently resets a
--    deliberate ACL to EXECUTE TO PUBLIC, on a SECURITY DEFINER state oracle
--    that has **no gate of its own** — its `app.can_view_printed_document` gate
--    lives one level up, in `public.print_source_state`.
--
--    ⚠ **SEVERITY, STATED HONESTLY AND BOUNDED — do not quote this as a live
--    hole.** It is NOT reachable over the API today: `supabase/config.toml`
--    `[api] schemas = ["public", "graphql_public"]`, so schema `app` is not
--    PostgREST-exposed and `app.*` answers 404 at ANY ACL. The boundary that
--    actually holds is schema exposure; this ACL is **defence in depth**. Nor is
--    the hazard something P3 introduces — 159 `app.*` DEFINER functions already
--    sit at NULL `proacl` (111 trigger functions, which cannot be called
--    directly at all, plus **48 callable helpers** including `app.audit_write`).
--    And the one door here that IS exposed, `public.print_source_state`, gates
--    internally on `auth.uid()` and fails closed for a null one, so even an
--    accidental `anon` grant there yields no rows.
--
--    That is exactly why the revokes are still mandatory: a defence-in-depth
--    layer that silently evaporates during an unrelated refactor is worth less
--    than no layer at all, because everyone downstream believes it is there.
--    Every DROP+CREATE below is followed by an explicit REVOKE (and, for the
--    `public` door, by the GRANT that restores what it had). pgTAP 368 pins
--    `has_function_privilege(...)` = false for **both `authenticated` and
--    `anon`** rather than trusting this comment — `anon` is the role that would
--    matter if schema exposure ever changed. ⚠ No authz ARM can see this
--    regression: `ARM=wrapper` bounds its domain on gates, and these functions
--    have no probe in front of them at all.
--
--    ⛔ The general invariant ("every callable `app.*` DEFINER function has a
--    non-NULL `proacl`") is deliberately NOT built here — it belongs in pgTAP
--    with a `lint:set-local`-style WATERMARK grandfathering the 48 current
--    violators, and it is out of scope for P3. Filed as a follow-up.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. The state resolver — a sixth OUT parameter.
--
-- ⚠ DROP+CREATE is FORCED: Postgres refuses to `create or replace` a function
-- whose OUT parameter list changed (the OUT params are part of the result type).
-- ---------------------------------------------------------------------------

drop function if exists app.resolve_print_source_state(text, uuid);

create or replace function app.resolve_print_source_state(
  p_source_kind text,
  p_source_id uuid,
  out o_found boolean,
  out o_status text,
  out o_correction_open boolean,
  out o_phase_voided boolean,
  out o_meeting_disposed boolean,
  out o_case_disposed boolean)
returns record
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_phase uuid;
begin
  o_found            := false;
  o_status           := null;
  o_correction_open  := false;
  o_phase_voided     := false;
  o_meeting_disposed := false;
  o_case_disposed    := false;

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

    when 'case' then
      -- PDF·P3 (ADR 0144 D3). `cases.status` is one of not_started / in_review /
      -- pending / completed / cancelled, and `phi_disposed_at` is the disposal
      -- stamp `dispose_case_phi` sets in its block (h).
      --
      -- ⚠ The two are read TOGETHER and reported SEPARATELY on purpose.
      -- `dispose_case_phi` guts everything the dossier renders — it DELETES
      -- `patient_identifiers` and the phases' `answers`, nulls
      -- `case_narratives.body_md` and `case_interviews.summary_md`, and redacts
      -- `case_events.body`/`.title`, the interview-subject notes, `cases.label`,
      -- `documents.title`/`.description` and `meeting_cases.summary`/`.decision`
      -- — while leaving `status` **untouched**. So the status term alone cannot
      -- see a disposal, exactly as it cannot for a disposed meeting. Same shape,
      -- same answer: a second, separately-reported fact.
      select c.status, c.phi_disposed_at is not null
        into o_status, o_case_disposed
      from public.cases c where c.id = p_source_id;
      if o_status is null then
        return;
      end if;
      o_found := true;

    else
      -- ELSE_FAIL_CLOSED. `interview` (P4) is in the source_kind CHECK but has
      -- no provider; an unhandled kind resolves to NOT FOUND, so every dispatch
      -- below fails shut rather than quietly registering.
      return;
  end case;
end;
$$;

-- ⛔ THE REVOKE IS THE POINT OF THIS LINE — see the file header. Without it the
-- DROP above has already handed `authenticated` (which holds USAGE on schema
-- `app`) EXECUTE on an ungated DEFINER oracle.
revoke execute on function app.resolve_print_source_state(text, uuid) from public;

comment on function app.resolve_print_source_state(text, uuid) is
  'ONE read of the print source''s lifecycle facts, per kind — the single place '
  'that touches the source tables, so the registers/watermark/series/head '
  'dispatches each stay a pure decision over an already-resolved record. '
  '⛔ UNGATED BY DESIGN: it is postgres-only (PUBLIC revoked) and its '
  'authorization gate lives in public.print_source_state, one level up. Any '
  'DROP+CREATE of this function MUST re-issue that revoke — a NULL proacl is '
  'the default and the default is EXECUTE TO PUBLIC. Pinned by pgTAP 368.';

-- ---------------------------------------------------------------------------
-- 2. Registration — does printing this source produce a REGISTERED emission?
-- ---------------------------------------------------------------------------

create or replace function app.print_source_registers(p_source_kind text, p_source_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
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
      -- ⚠ o_meeting_disposed and o_case_disposed are OTHER KINDS' facts and are
      -- IGNORED here, by design. Pinned by cross-kind vectors, not by comments.
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
      -- ⚠ o_correction_open / o_phase_voided / o_case_disposed are OTHER KINDS'
      -- facts and are IGNORED here. Also pinned by cross-kind vectors.
      return s.o_status in ('in_signature', 'signed', 'distributed')
         and not s.o_meeting_disposed;

    when 'case' then
      -- ⭐ PDF·P3 (ADR 0144 D3) — the lock point is TERMINALITY, two conjuncts.
      --
      -- `completed` is a lock point because `reopen_case` is the ONLY door out
      -- of it. Catalog-measured 2026-08-25: exactly 4 functions write
      -- `cases.status` — `app.recompute_case_status` returns early under an
      -- explicit "Never override a manual terminal status" guard; `cancel_case`
      -- raises HC025 on any terminal, making completed→cancelled unconstructible;
      -- `close_case` is the entry INTO completed; `reopen_case` requires
      -- completed and refuses cancelled with HC0M8. A state a door can walk back
      -- out of is not a lock point — and the one door that does walk it back
      -- changes `status`, which the D15 trigger set bumps on, so the head
      -- conjunct catches the round trip.
      --
      -- ⭐ `cancelled` REGISTERS, and that is a deliberate DIVERGENCE from the
      -- meeting arm above rather than an oversight. A cancelled meeting has no
      -- minutes to pin; a cancelled case has a COMPLETE PROCESS RECORD worth
      -- attesting to, and it is terminal-FOREVER (HC0M8, no reopen), so its
      -- currency claim is unconditional. It is the STRONGER of the two terminal
      -- states here, where it is the excluded one there.
      --
      -- ...AND NOT disposed — the tandem term, forced by 0125 D5 (see the
      -- watermark twin). ⚠ o_correction_open / o_phase_voided / o_meeting_disposed
      -- are OTHER KINDS' facts and are IGNORED here. Cross-kind vectors, not
      -- this comment, are what pin that.
      --
      -- ⚠ THIS STATUS SET MUST EQUAL `app.case_is_terminal`'s. They are declared
      -- separately because 0125 D8 / 0126 D7 forbid factoring the print axes into
      -- a shared helper, and pgTAP 368 pins the set-equality. If this widens
      -- without that widening, content drift on the new status goes unbumped and
      -- /verificar starts lying.
      return s.o_status in ('completed', 'cancelled')
         and not s.o_case_disposed;

    else
      return false;
  end case;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Watermark — is the CONTENT final?
-- ---------------------------------------------------------------------------

create or replace function app.print_source_watermark(p_source_kind text, p_source_id uuid)
returns text
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
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

    when 'case' then
      -- ⚠ THE SAME TWO CONJUNCTS AS THE `case` ARM OF print_source_registers,
      -- WRITTEN OUT AGAIN. This is the case 0125 Amendment 2 was written for:
      -- the two axes COINCIDE for this kind, and *"the coincidence is recorded,
      -- not exploited"*. ⛔ Do not factor them into a shared helper or a shared
      -- status list — for `meeting` one line up the axes genuinely SEPARATE
      -- (`in_signature` registers stamped RASCUNHO), which is the standing proof
      -- that a shared declaration would be a coupling, not a cleanup.
      --
      -- ⭐ THE DISPOSAL TERM IS THE TANDEM MOVE, AND IT IS FORCED. Drop it from
      -- the registration arm alone and a `completed` + disposed case becomes
      -- registers=false + watermark='final': 0125 D5's forbidden FOURTH CELL —
      -- a page stamped FINAL carrying the "PRÉVIA — sem valor de registro"
      -- footer. Third kind, same shape, same answer. The fourth-cell probe sweep
      -- is what catches a regression here.
      return case
        when s.o_status in ('completed', 'cancelled')
         and not s.o_case_disposed then 'final'
        else 'draft'
      end;

    else
      return 'draft';
  end case;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Series — the LOGICAL document this print belongs to (ADR 0126 D1).
-- ---------------------------------------------------------------------------

create or replace function app.print_source_series(p_source_kind text, p_source_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
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

    when 'case' then
      -- ⭐ PDF·P3. The series is the CASE ID for **both** D5 variants, and the
      -- variant is carried by `template_key`, NOT here.
      --
      -- ADR 0144 D7 wants a de-identified dossier and an identified one to be
      -- SIMULTANEOUSLY CURRENT — sharing one series would make /verificar report
      -- a valid identified dossier as "superseded" the moment someone printed the
      -- de-identified variant for an auditor, a false statement on an
      -- unauthenticated surface. Measured 2026-08-25: the one-active index is
      -- `printed_documents_one_active (source_kind, source_series_id,
      -- template_key) WHERE status = 'active'`, and `mint_printed_document`'s
      -- supersede statement is likewise scoped `and template_key =
      -- p_template_key`. ⇒ **The carrier already exists.** The two keys
      -- ('case' / 'case_identified') supersede independently over one series.
      --
      -- ⛔ This is why `print_source_series` takes no variant argument and needs
      -- none, and why the mint door required NO signature change and NO new
      -- kind-conditional site. D7's wording ("the series keys on
      -- (case_id, variant)") is amended to (case_id, template_key); lead ruling
      -- 2026-08-25, ADR 0144 Amendment 1.
      --
      -- Like meetings, cases have no successor CHAIN: a reopen edits the same
      -- row, which is exactly why they needed a revision counter (D4/D15).
      return (select c.id from public.cases c where c.id = p_source_id);

    else
      return null;                               -- fail closed; the mint raises
  end case;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Revision — the monotonic currency counter (ADR 0126 D9).
-- ---------------------------------------------------------------------------

create or replace function app.print_source_revision(p_source_kind text, p_source_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  if p_source_id is null then
    return 0;
  end if;

  case p_source_kind
    when 'meeting' then
      return coalesce(
        (select m.revision from public.meetings m where m.id = p_source_id), 0);

    when 'case' then
      -- ⭐ PDF·P3 (ADR 0144 D4, as built by 20261003002200). The counter is a
      -- SIDE TABLE, not a column on `cases`, and the reason is a hard conflict:
      -- `app.guard_case_status` freezes `cases` against any non-status update in
      -- exactly the terminal states D15 needs the counter to move in. An absent
      -- row reads 0 — which is precisely what `meetings.revision`'s default
      -- gives, and what a never-superseded print must match.
      --
      -- ⚠ `coalesce(..., 0)` is the ONE definition of "a case that has never
      -- been bumped", and `app.print_source_head` reuses THIS FUNCTION rather
      -- than restating it. See the note there.
      return coalesce(
        (select r.revision from public.case_print_revisions r
          where r.case_id = p_source_id), 0);

    when 'form_response' then
      -- Responses have no epoch and need none: their reversal machinery spawns a
      -- NEW ROW (`start_correction_draft` / `supersede_response`), so the head
      -- conjunct does the real work there. A counter would be a second, silent
      -- authority for a fact the chain already carries.
      return 0;
    else
      return 0;                                   -- fail closed: 0 matches nothing stored
  end case;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Head — is a stored print still the CURRENT one? (ADR 0126 D8/D9)
-- ---------------------------------------------------------------------------

create or replace function app.print_source_head(
  p_source_kind text, p_source_id uuid, p_source_revision integer default 0)
returns boolean
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
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

    when 'case' then
      -- ⭐ PDF·P3 (ADR 0144 D4/D15) — the revision match, same rule as meetings.
      --
      -- ⚠ SHAPED DIFFERENTLY FROM THE MEETING ARM ON PURPOSE, and the difference
      -- is load-bearing. A meeting's revision is a NOT NULL column with a
      -- default, so `m.revision = coalesce(p_source_revision, 0)` compares two
      -- present values. A case's revision lives in a SIDE TABLE where **an
      -- absent row means 0** — so an inline `exists (select 1 from
      -- case_print_revisions ...)` would return FALSE for every case that has
      -- never been bumped, i.e. would report every fresh print as not-current.
      --
      -- The absent-row-is-0 rule therefore has exactly ONE definition, in
      -- `app.print_source_revision`, and this arm CALLS it instead of restating
      -- it. That is deliberate and is not the "shared helper" 0125 D8 forbids:
      -- D8 forbids sharing between the REGISTRATION and WATERMARK axes, which
      -- are two decisions that must be able to diverge. This is one decision
      -- (what revision is this case at?) consumed by the two sites that must
      -- NEVER diverge — the mint stores `print_source_revision`'s answer, and
      -- this compares against it. If they disagreed, every case print would land
      -- not-current the instant it succeeded.
      --
      -- The existence check stays separate: an unknown case is not head, and
      -- without this it would compare 0 = 0 and answer TRUE.
      if not exists (select 1 from public.cases c where c.id = p_source_id) then
        return false;
      end if;
      return app.print_source_revision('case', p_source_id)
             = coalesce(p_source_revision, 0);

    else
      -- Fail closed = NOT head = not current. An unknown kind cannot hold a print
      -- anyway (the mint's own dispatch refuses it first).
      return false;
  end case;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. The A7 visibility arm — mint AND download alike.
-- ---------------------------------------------------------------------------

create or replace function app.can_view_printed_document(
  p_source_kind text, p_source_id uuid, p_uid uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_resp public.responses;
begin
  if p_uid is null or p_source_id is null then
    return false;
  end if;

  case p_source_kind
    when 'form_response' then
      select * into v_resp from public.responses where id = p_source_id;
      if v_resp.id is null then
        return false;
      end if;
      -- Mirror of the LIVE responses read policies (parity, not improvement —
      -- over-reach breaks legitimate surface). As of QO·B M1 those are:
      --   responses_select:          own row OR (submitted AND staff_admin)
      --                              OR correction-corridor
      --   responses_select_targeted: targeted-respondent corridor
      --   responses_admin_all:       DELETED by M1 (was the tenancy-admin FOR ALL grant)
      -- No app.is_tenancy_admin_of_for arm: ADR 0100 D12.
      return v_resp.created_by = p_uid
          or (v_resp.status = 'submitted'
              and app.is_staff_admin_of_for(v_resp.commission_id, p_uid))
          or app.can_read_correction_response(p_source_id, p_uid)
          or app.can_access_targeted_response(p_source_id, p_uid);
    when 'meeting' then
      -- A7 FULL-SIGHT CONJUNCTION: reach (member AND (commission_default OR
      -- attendee); NO admin arm — C7) AND unmasked full-content sight. Unchanged
      -- by QO·B: this arm never carried a tenancy-admin term.
      return app.can_reach_meeting(p_source_id, p_uid)
         and app.can_read_full_meeting_content(p_source_id, p_uid);
    when 'case' then
      -- ⭐ PDF·P3 (ADR 0144 D8) — A7 FULL-SIGHT CONJUNCTION for the case kind:
      -- REACH (`app.can_read_case` → the `read_case_content` capability) AND
      -- UNMASKED SIGHT (`app.can_read_full_case_content`, the seven measured
      -- masking axes: deliberation · coordinator-only events · phase answers ·
      -- interviews · action items · meeting links · referrals).
      --
      -- Applied to MINT and DOWNLOAD alike, because the canonical bytes are
      -- always the COMPLETE artifact: a PDF is ONE frozen view, and arm-parity
      -- is not content-parity. Accepted consequence, stated by D8 itself: a
      -- RECUSED member and a PHASE-ONLY RESPONDENT can neither mint nor download
      -- the dossier — not even the de-identified variant. `app._case_caps` STEP 4
      -- hard-denies both, so the first conjunct already refuses them.
      --
      -- ⛔ NO PHI TERM HERE, DELIBERATELY. `can_read_case_patient` gates the
      -- IDENTIFIED VARIANT, not the kind, and this function receives no template
      -- key — it cannot tell the two variants apart and must not pretend to. The
      -- variant gate lives at the two places that DO know the template key:
      -- `mint_printed_document`'s trio site 3, and `open_printed_document`.
      -- Putting a PHI term here would refuse the DE-IDENTIFIED dossier to
      -- everyone without the PHI door, destroying the point of D5's fork.
      return app.can_read_case(p_source_id, p_uid)
         and app.can_read_full_case_content(p_source_id, p_uid);
    else
      -- `interview` arm lands in P4.
      -- ELSE_FAIL_CLOSED: an unhandled kind is UNREADABLE, not exposed
      -- (ADR 0104 D3) — a new printable kind that forgets its arm fails shut.
      return false;
  end case;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. The public read door — two new columns.
--
-- ⚠ DROP+CREATE is FORCED (the RETURNS TABLE shape changed), and this one HAS a
-- non-default ACL to restore. See the file header: the DROP resets `proacl` to
-- NULL, which for a function means EXECUTE TO PUBLIC. Both halves are reissued
-- below — the GRANT (or the app 404s with a door that looks perfect in the
-- catalog) and the REVOKE (or `anon` gains a gated-but-public state door).
-- ---------------------------------------------------------------------------

drop function if exists public.print_source_state(text, uuid);

create or replace function public.print_source_state(p_source_kind text, p_source_id uuid)
returns table(
  status text,
  correction_open boolean,
  phase_voided boolean,
  meeting_disposed boolean,
  case_disposed boolean,
  source_revision integer)
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
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

  -- ⚠ `source_revision` is NOT one of the resolver's OUT params, and that is not
  -- an inconsistency. The resolver reads the SOURCE ROW's lifecycle facts; the
  -- revision lives in a per-kind place (a column for meetings, a side table for
  -- cases, nowhere for responses) whose "absent means 0" rule is defined once,
  -- in `app.print_source_revision`. Reading it through that dispatch keeps ONE
  -- definition — the same one the mint stores and `print_source_head` compares
  -- — instead of a second copy that could drift.
  --
  -- ⭐ WHY THIS DOOR CARRIES IT AT ALL: `getCasePrintContext` needs the revision
  -- to feed compare-and-mint, and it must NOT read it under the caller's own
  -- RLS. A fact the caller cannot see comes back ABSENT, the value would default
  -- to 0, and the door would then compare 0 against 0 — HC0DU vacuous while
  -- looking correct. Resolved here, behind the same gate, the answer is either
  -- correct or absent.
  return query select
    s.o_status, s.o_correction_open, s.o_phase_voided,
    s.o_meeting_disposed, s.o_case_disposed,
    app.print_source_revision(p_source_kind, p_source_id);
end;
$$;

revoke execute on function public.print_source_state(text, uuid) from public;
grant execute on function public.print_source_state(text, uuid)
  to authenticated, service_role;

comment on function public.print_source_state(text, uuid) is
  'The gated read of a print source''s derivation inputs (status · the two '
  'form_response refinement flags · meeting disposal · case disposal · the '
  'currency revision). Gated on app.can_view_printed_document BEFORE resolving '
  'anything, so a caller who cannot view the source gets NO ROW rather than a '
  'wrong answer — the fail direction matters: read under the caller''s own RLS '
  'these flags would default FALSE and reach ADR 0125 D5''s forbidden fourth '
  'cell by a permissions accident. ⚠ Any DROP+CREATE must reissue BOTH the '
  'grant to authenticated/service_role AND the revoke from PUBLIC.';
