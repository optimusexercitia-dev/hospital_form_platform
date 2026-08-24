-- =============================================================================
-- ADR 0136 — Deferred `staff_admin` sign-off: attest a FROZEN response, block
-- the PHASE not the SUBMIT.
--
-- Plan: docs/plans/deferred-staff-admin-signoff.md (read §1 — the re-derivation
-- found FOUR things the ADR's Consequences do not name, every one of them in the
-- reassuring direction).
--
-- Shape: `active → awaiting_signoff → completed`. `submit_response` stops
-- blocking on unsigned `staff_admin` sections of a CASE-PHASE response (D1/D2);
-- the phase parks in a new non-settled status; the last signature completes it
-- and only then computes the phase result (D5). `responses.status` keeps its two
-- values (D4) — attestation state lives on the PHASE.
--
-- ⚠ Bodies are re-emitted from `pg_get_functiondef`, never from migration text
-- (CLAUDE.md's binding SQL exception — several of these have been rewritten at
-- runtime already). `create or replace` preserves ACLs, so no re-GRANT is owed
-- except where a RETURNS TABLE changes and a DROP is unavoidable (§M12).
--
-- ⚠ LINE-ENDING DISCIPLINE. The house idiom is a SINGLE-LINE anchor, because a
-- multi-line one is hostage to CR drift in the stored body. Several patches here
-- genuinely need multi-line anchors, so both sides are CR-STRIPPED before
-- matching (`replace(x, chr(13), '')`) — which makes a multi-line anchor as safe
-- as a single-line one, in either direction of drift.
--
-- ⚠ Every patch asserts its HIT COUNT before applying and re-reads the catalog
-- after. A mutation that did not fully apply otherwise reports green.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- M1 — the flag. Ships DISABLED: today's behaviour stays selectable and the
-- change lands dark (ADR 0136 Consequences; ADR 0004's table-backed rationale).
-- `seed.sql` forces it ON for local/E2E. ⛔ The PRODUCTION flip is its own
-- migration at the gate — a flag flipped only by seed.sql is OFF in production
-- while local and E2E are green.
--
-- ⚠ Targeted ON CONFLICT: an untargeted one swallows a new constraint.
-- -----------------------------------------------------------------------------
insert into app.feature_flags (key, enabled, description)
values (
  'deferred_staff_signoff',
  false,
  'ADR 0136 — a staff_admin section''s signature is collected AFTER the response '
  'freezes and gates the PHASE, not the SUBMIT. When true: submit_response stops '
  'blocking on unsigned signoff_role=''staff_admin'' sections of a CASE-PHASE '
  'response (standalone responses keep today''s HC012 — D2), the phase parks in '
  'case_phases.status = ''awaiting_signoff'' (NOT in activate_phase''s settled '
  'set, so downstream phases stay blocked), and the last signature completes the '
  'phase + computes its result. responses.status is UNCHANGED (D4) — a '
  'submitted-but-unattested response counts in dashboards. Ships OFF; seed.sql '
  'forces ON for local/E2E. Resolve the VALUE in the enabled column, never this '
  'sentence.'
)
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- M2 — the 6th phase status. `case_phases.status` is `text` + a CHECK (measured:
-- not an enum), so this is a constraint swap, not an ALTER TYPE.
-- -----------------------------------------------------------------------------
alter table public.case_phases drop constraint case_phases_status_check;
alter table public.case_phases add constraint case_phases_status_check
  check (status = any (array[
    'pending'::text, 'active'::text, 'completed'::text,
    'not_required'::text, 'voided'::text,
    -- ADR 0136 D3 — between `active` and `completed`. Deliberately NOT added to
    -- activate_phase's settled set ('completed','not_required','voided'), which
    -- is how "downstream phases stay blocked" costs zero new gating logic.
    'awaiting_signoff'::text
  ]));

-- -----------------------------------------------------------------------------
-- M3 — `app.pending_staff_signoffs` — THE single answer to "which visible
-- sections of this response still owe a staff_admin signature?".
--
-- ⛔ The ADR says this is "computed independently in submit_response and
-- list_signoff_queue today, and D5's trigger would be a third copy". Measured
-- from pg_proc: there are SIX, and five of them evaluate the section's
-- `visible_when` with `app.eval_condition` —
--   list_signoff_queue · get_response_for_signoff · sign_section (×2) ·
--   compute_due_notifications · save_section_answers
-- — while `submit_response` uses `app.eval_visibility`.
--
-- ⛔ AND THE DRIFT HAS ALREADY BITTEN (BUG-SIGNOFF-GROUPCOND-001). A section may
-- carry the GROUP shape `{match, conditions[]}`: `form_sections_visible_when_shape`
-- calls `app.is_valid_visibility`, which accepts it, and the section settings
-- dialog authors it. `app.eval_condition` handles only the legacy single shape
-- and RAISES `unknown condition op: <NULL>` on the group shape — so today a
-- `requires_signoff` section with a grouped condition makes the sign-off queue,
-- the review-to-sign door, `sign_section` and every SAVE on that form throw.
-- Unifying on `eval_visibility` — the evaluator `submit_response` already uses —
-- is what fixes it, and is why the extraction is mandated FIRST.
--
-- SECURITY DEFINER because `sign_section` is INVOKER and the respondent's
-- `in_progress` response is unreadable to the signing coordinator (the whole
-- ADR-0016 premise). Payload is section METADATA only — no answers, no PHI —
-- strictly narrower than its nearest sibling `app.signoff_target`, which is
-- DEFINER, granted to `authenticated`, and returns `status` + `form_version_id`
-- + `visible_when` for any (response, section) pair with no gate at all. Schema
-- `app` is not PostgREST-exposed, so this is not a callable API surface; every
-- caller applies its own authority gate.
-- -----------------------------------------------------------------------------
create or replace function app.pending_staff_signoffs(p_response_id uuid)
returns table (section_id uuid, section_title text, section_position integer)
language sql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $fn$
  with a as (select app.answer_map(p_response_id) as answers)
  select s.id, s.title, s.position
  from public.responses r
  cross join a
  join public.form_sections s
    on s.form_version_id = r.form_version_id
   and s.requires_signoff = true
   and s.signoff_role = 'staff_admin'
  where r.id = p_response_id
    and app.eval_visibility(s.visible_when, a.answers)
    and not exists (
      select 1 from public.response_section_signoffs so
      where so.response_id = r.id and so.section_id = s.id
    )
  order by s.position;
$fn$;

revoke all on function app.pending_staff_signoffs(uuid) from public;
grant execute on function app.pending_staff_signoffs(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- M3b — `app.is_signoff_deferral_open` — THE single answer to "is this response
-- frozen but still open for its deferred staff_admin attestation?".
--
-- ⛔ THE `is_` PREFIX IS LOAD-BEARING, NOT STYLE. The ADR-0079 door sweep's
-- predicate arm bounds its domain with a NAME REGEX — `^(is_|can_|has_|…)` —
-- standing in for the property "is an authorization predicate", which no regex
-- decides. This function was first written as `app.signoff_deferred_open` and
-- `ARM=census` flagged it as never-swept; the diff-scoped sweep then matched
-- ZERO gates, because the name put it outside the arm's domain while the
-- property put it squarely inside. Renaming is the fix that lasts: the gate now
-- falls in the standing sweep's domain for every future run, instead of needing
-- a backlog entry that only records the gap.
--
-- Extracted for the same reason as M3, one predicate later: it is needed by
-- `app.can_sign_section` (an RLS WITH CHECK), `public.guard_submitted_signoffs`
-- (an immutability trigger), and `public.sign_section` (the RPC) — three
-- independent gates that MUST agree, plus the two widened reads. Three copies of
-- an authorization predicate drift; one does not.
--
-- `cp.current_response_id = r.id` is load-bearing, not defensive: after
-- `approve_correction` re-points the phase at a correction successor, the
-- attestation is owed on the SUCCESSOR — signing the superseded response must
-- neither be admitted nor complete the phase.
-- -----------------------------------------------------------------------------
create or replace function app.is_signoff_deferral_open(p_response_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $fn$
  select app.feature_enabled('deferred_staff_signoff')
     and exists (
       select 1
       from public.responses r
       join public.case_phases cp on cp.id = r.case_phase_id
       where r.id = p_response_id
         and r.status = 'submitted'
         and cp.status = 'awaiting_signoff'
         and cp.current_response_id = r.id
     );
$fn$;

revoke all on function app.is_signoff_deferral_open(uuid) from public;
grant execute on function app.is_signoff_deferral_open(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- M4 — `app.assert_phase_result_ready`, extracted from
-- `app.compute_case_phase_result` UNCHANGED.
--
-- ⛔ WHY THIS EXISTS AND WHY IT IS NOT COSMETIC. `compute_case_phase_result`
-- raises HC061 `selecione o resultado da fase % antes de enviar` when a phase is
-- manual-emitting with no `result_override_id`. Today that raise aborts the
-- SUBMIT, while the filler is present and `set_case_phase_result_override` still
-- admits their `active` phase.
--
-- D5 moves the compute call onto the SIGNATURE. Moved naively, that raise lands
-- on the COORDINATOR — for something only the filler can fix, and can no longer
-- fix, because the override door admits ('active','completed') only and refuses
-- an `awaiting_signoff` phase to everybody. That is a deadlock, not a nuisance.
--
-- So D5 moves the COMPUTATION, not the PRECONDITION: the assertion stays on the
-- submit path (M7's deferred arm), where the message "antes de enviar" is true.
-- One definition, two call sites.
-- -----------------------------------------------------------------------------
create or replace function app.assert_phase_result_ready(p_case_phase_id uuid)
returns void
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $fn$
declare
  v_ruleset jsonb;
  v_override_id uuid;
  v_emits boolean;
  v_position integer;
begin
  if not app.feature_enabled('case_phase_results') then
    return;
  end if;

  select result_ruleset, result_override_id, emits_result, position
    into v_ruleset, v_override_id, v_emits, v_position
  from public.case_phases where id = p_case_phase_id;

  if v_position is null then
    return;
  end if;

  if coalesce(v_emits, false) and v_ruleset is null and v_override_id is null then
    raise exception
      'selecione o resultado da fase % antes de enviar', v_position
      using errcode = 'HC061';
  end if;
end;
$fn$;

revoke all on function app.assert_phase_result_ready(uuid) from public;
grant execute on function app.assert_phase_result_ready(uuid) to authenticated, service_role;

-- `app.compute_case_phase_result` delegates its HC061 block to M4. Behaviour is
-- identical; the point is that the submit path and the compute path can never
-- disagree about what "ready" means.
do $mig$
declare
  v_def  text := replace(pg_get_functiondef('app.compute_case_phase_result(uuid)'::regprocedure), chr(13), '');
  v_from text := replace($anchor$  v_is_manual := coalesce(v_emits, false) and v_ruleset is null;
  if v_is_manual and v_override_id is null then
    raise exception
      'selecione o resultado da fase % antes de enviar', v_position
      using errcode = 'HC061';
  end if;$anchor$, chr(13), '');
  v_to   text := replace($anchor$  -- ADR 0136 §1.5 — the HC061 precondition is now ONE definition, shared with
  -- `sync_case_phase_on_submit`'s deferred arm so the two can never disagree.
  v_is_manual := coalesce(v_emits, false) and v_ruleset is null;
  perform app.assert_phase_result_ready(p_case_phase_id);$anchor$, chr(13), '');
  v_hits int;
begin
  v_hits := (length(v_def) - length(replace(v_def, v_from, ''))) / length(v_from);
  if v_hits <> 1 then
    raise exception 'ADR0136/M4: compute_case_phase_result anchor found % time(s), expected 1 — RE-READ pg_proc and RE-ANCHOR', v_hits;
  end if;
  execute replace(v_def, v_from, v_to);

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = 'compute_case_phase_result'
      and p.prosrc like '%assert_phase_result_ready%'
  ) then
    raise exception 'ADR0136/M4: the delegation did not land';
  end if;
  -- ...and the raise it replaced is gone from THIS body (it now lives in M4 only).
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = 'compute_case_phase_result'
      and p.prosrc like '%errcode = ''HC061''%'
  ) then
    raise exception 'ADR0136/M4: the inline HC061 block survived — two definitions now exist';
  end if;
end;
$mig$;

-- -----------------------------------------------------------------------------
-- M5 — `app.guard_case_phase_status` is the state machine's AUTHORITY. Three new
-- transitions:
--   active           → awaiting_signoff   (D3, the deferral)
--   awaiting_signoff → completed          (D5, the last signature)
--   awaiting_signoff → not_required       (the cancel_case sweep — M17)
--   awaiting_signoff → voided             (the correction VOID arm — see M19)
--
-- ⛔ `awaiting_signoff → active` is DELIBERATELY ABSENT. D7 rules shape (a): a
-- declining coordinator routes through the correction/supersession machinery. A
-- submitted response never returns to `in_progress`; shape (b) is REJECTED and
-- must not be re-opened without a new PO ruling.
--
-- Patched by anchor rather than re-emitted whole, so the INSERT arm's standing
-- ⚠ comment ("DO NOT ADD new.status must be 'pending' HERE ... written and
-- reverted once already") survives byte-for-byte.
-- -----------------------------------------------------------------------------
do $mig$
declare
  v_def  text := replace(pg_get_functiondef('app.guard_case_phase_status()'::regprocedure), chr(13), '');
  v_from text := replace($anchor$      or (old.status = 'active' and new.status in ('completed', 'not_required'))$anchor$, chr(13), '');
  v_to   text := replace($anchor$      or (old.status = 'active' and new.status in ('completed', 'not_required', 'awaiting_signoff'))
      -- ADR 0136 D3/D5. `not_required` carries the cancel_case sweep; `voided`
      -- carries the correction VOID arm, which D7 makes reachable from here.
      -- ⛔ NO `awaiting_signoff -> active`: D7 rejected the unfreeze (shape b).
      or (old.status = 'awaiting_signoff' and new.status in ('completed', 'not_required', 'voided'))$anchor$, chr(13), '');
  v_hits int;
begin
  v_hits := (length(v_def) - length(replace(v_def, v_from, ''))) / length(v_from);
  if v_hits <> 1 then
    raise exception 'ADR0136/M5: guard_case_phase_status anchor found % time(s), expected 1', v_hits;
  end if;
  execute replace(v_def, v_from, v_to);

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = 'guard_case_phase_status'
      and p.prosrc like '%old.status = ''awaiting_signoff''%'
      and p.prosrc like '%''not_required'', ''awaiting_signoff''%'
  ) then
    raise exception 'ADR0136/M5: the widened transition matrix did not land';
  end if;
  -- The standing ⚠ comment is the reason this was patched and not re-emitted.
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = 'guard_case_phase_status'
      and p.prosrc like '%DO NOT ADD%new.status must be ''pending''%'
  ) then
    raise exception 'ADR0136/M5: the INSERT-arm standing comment was lost';
  end if;
  -- And the unfreeze must NOT have crept in.
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = 'guard_case_phase_status'
      and p.prosrc like '%''awaiting_signoff'' and new.status in (''active%'
  ) then
    raise exception 'ADR0136/M5: an awaiting_signoff -> active transition exists (D7 rejected it)';
  end if;
end;
$mig$;

-- -----------------------------------------------------------------------------
-- M6 — `public.submit_response`: D1's role-split, D2's case-phase scope.
--
-- ⭐ D1 needs the section cursor WIDENED, not merely a predicate added:
-- `s.signoff_role` is NOT selected today (measured). And `submit_response` never
-- references `case_phase_id` — it is absent from all 42 routines that touch
-- `case_phases` — but `v_response` is a `public.responses` rowtype, so D2's
-- scoping is a field read, not a new lookup.
--
-- HC012 SURVIVES for the respondent arm (the filler is present; no coordination
-- cost) and for every standalone response (D2 — deferring where there is no
-- phase would downgrade the attestation to advisory).
-- -----------------------------------------------------------------------------
do $mig$
declare
  v_def text := replace(pg_get_functiondef('public.submit_response(uuid)'::regprocedure), chr(13), '');
  v_new text;
  a1 text := replace($anchor$    select s.id, s.position, s.visible_when, s.requires_signoff$anchor$, chr(13), '');
  b1 text := replace($anchor$    select s.id, s.position, s.visible_when, s.requires_signoff, s.signoff_role$anchor$, chr(13), '');
  a2 text := replace($anchor$  v_validations_on boolean;$anchor$, chr(13), '');
  b2 text := replace($anchor$  v_validations_on boolean;
  -- ADR 0136 D1/D2 — is the staff_admin sign-off DEFERRED for this response?
  v_defer_staff_signoff boolean;$anchor$, chr(13), '');
  a3 text := replace($anchor$  v_validations_on := app.feature_enabled('item_validations');$anchor$, chr(13), '');
  b3 text := replace($anchor$  v_validations_on := app.feature_enabled('item_validations');
  -- ADR 0136 D2: CASE-PHASE responses only. A standalone response keeps today's
  -- blocking behaviour — the mechanism that blocks dependent work IS the
  -- case_phases.blocks array, so deferring where there is no phase would
  -- silently downgrade the attestation to advisory.
  v_defer_staff_signoff := v_response.case_phase_id is not null
                           and app.feature_enabled('deferred_staff_signoff');$anchor$, chr(13), '');
  a4 text := replace($anchor$    if r_section.requires_signoff and app.feature_enabled('signoff_enforcement') then$anchor$, chr(13), '');
  b4 text := replace($anchor$    -- ADR 0136 D1 — the gate SPLITS BY SIGNER ROLE. The respondent arm keeps
    -- HC012 unchanged; the staff_admin arm stops blocking the submit on a case
    -- phase and becomes a PHASE gate instead (sync_case_phase_on_submit parks
    -- the phase in `awaiting_signoff`).
    if r_section.requires_signoff and app.feature_enabled('signoff_enforcement')
       and not (v_defer_staff_signoff and r_section.signoff_role = 'staff_admin') then$anchor$, chr(13), '');
  v_hits int;
begin
  foreach v_new in array array[a1, a2, a3, a4] loop
    v_hits := (length(v_def) - length(replace(v_def, v_new, ''))) / length(v_new);
    if v_hits <> 1 then
      raise exception 'ADR0136/M6: submit_response anchor %... found % time(s), expected 1', left(v_new, 40), v_hits;
    end if;
  end loop;

  v_new := replace(v_def, a1, b1);
  v_new := replace(v_new, a2, b2);
  v_new := replace(v_new, a3, b3);
  v_new := replace(v_new, a4, b4);
  execute v_new;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'submit_response'
      and p.prosrc like '%s.requires_signoff, s.signoff_role%'
      and p.prosrc like '%v_defer_staff_signoff := v_response.case_phase_id is not null%'
      and p.prosrc like '%not (v_defer_staff_signoff and r_section.signoff_role = ''staff_admin'')%'
  ) then
    raise exception 'ADR0136/M6: submit_response patch did not fully land';
  end if;
  -- HC012 must SURVIVE — the respondent arm is D1's whole point.
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'submit_response'
      and p.prosrc like '%errcode = ''HC012''%'
  ) then
    raise exception 'ADR0136/M6: HC012 was removed — D1 keeps it for the respondent arm';
  end if;
end;
$mig$;

-- -----------------------------------------------------------------------------
-- M7 — `public.sync_case_phase_on_submit`: D3's `awaiting_signoff` arm, and D5's
-- move of the result computation OFF the submit path.
--
-- Re-emitted whole from pg_get_functiondef (the pre-existing comments are
-- reproduced verbatim). The early-return guards are UNCHANGED: a correction
-- successor (BE-2) and a targeted respondent's defense (ETH·E2 §D13) still take
-- no phase effect at all.
-- -----------------------------------------------------------------------------
create or replace function public.sync_case_phase_on_submit()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $fn$
declare
  v_case_id uuid;
  v_case_status text;
begin
  if new.case_phase_id is null
     or new.status <> 'submitted'
     or old.status = 'submitted' then
    return new;
  end if;

  -- BE-2: a correction successor's submit must have ZERO effect on the phase —
  -- approval (BE-3) owns effect-taking (re-point + compute + recompute). Without
  -- this, an unapproved successor would recompute the result from unapproved
  -- answers and prematurely re-complete the phase.
  if new.supersedes_id is not null then
    return new;
  end if;

  -- ETH·E2 §D13: a targeted respondent's defense does not advance the committee workflow.
  if new.target_case_participant_id is not null then
    return new;
  end if;

  select cp.case_id, c.status
    into v_case_id, v_case_status
  from public.case_phases cp
  join public.cases c on c.id = cp.case_id
  where cp.id = new.case_phase_id;

  if v_case_status in ('completed', 'cancelled') then
    return new;
  end if;

  -- ---- ADR 0136 D3 — DEFERRED arm. -------------------------------------------
  -- A visible staff_admin section still owes a signature, so the phase parks in
  -- `awaiting_signoff` instead of completing. It is NOT in activate_phase's
  -- settled set, so every downstream phase stays blocked with no new gating
  -- logic (D3) — and `close_case`/`recompute_case_status` were widened to match,
  -- because that guarantee otherwise stops at the case boundary.
  if app.feature_enabled('deferred_staff_signoff')
     and exists (select 1 from app.pending_staff_signoffs(new.id)) then

    -- ⛔ The HC061 PRECONDITION stays HERE, on the submit. D5 moves the result
    -- COMPUTATION to the signature; moving the precondition with it would land
    -- the raise on the coordinator, for something only the filler can fix and
    -- can no longer fix (set_case_phase_result_override refuses an
    -- `awaiting_signoff` phase to everybody). See the plan §1.5.
    perform app.assert_phase_result_ready(new.case_phase_id);

    perform set_config('app.in_case_rpc', 'on', true);
    update public.case_phases
    set status = 'awaiting_signoff', updated_at = now(),
        current_response_id = new.id
    where id = new.case_phase_id and status = 'active';
    perform set_config('app.in_case_rpc', 'off', true);

    -- ⛔ NO compute_case_phase_result and NO recompute_recommendations here.
    -- D5: the phase RESULT moves onto the signature — where it belonged, since
    -- today a phase result is computed from answers nobody has countersigned.
    -- `app.trg_complete_phase_on_signoff` runs both when the last one lands.
    return new;
  end if;

  -- First-submit arm: complete the phase AND set the current-revision pointer.
  perform set_config('app.in_case_rpc', 'on', true);
  update public.case_phases
  set status = 'completed', completed_at = now(), updated_at = now(),
      current_response_id = new.id
  where id = new.case_phase_id and status = 'active';
  perform set_config('app.in_case_rpc', 'off', true);

  perform app.compute_case_phase_result(new.case_phase_id);

  perform public.recompute_recommendations(v_case_id);

  return new;
end;
$fn$;

-- -----------------------------------------------------------------------------
-- M8 — `app.can_sign_section` IS the `WITH CHECK` of the `signoffs_insert`
-- policy, so this is a LIVE AUTHORIZATION CHANGE, not a convenience edit.
--
-- The widening is BOUNDED by `app.is_signoff_deferral_open` (M3b): `submitted` is
-- admitted ONLY while the response's own case phase is still `awaiting_signoff`
-- AND is the phase's `current_response_id`. An unbounded widening would let a
-- staff_admin sign a completed phase forever.
--
-- The `respondent` arm is UNCHANGED and stays `in_progress`-only: that signer is
-- the response's own creator, signing their own draft before it freezes.
--
-- ⚠ `app.is_staff_admin_of` reads the CURRENT user, not `p_signer` — pre-existing
-- and deliberate (the policy separately asserts `signed_by = auth.uid()`); this
-- re-emission does not change it.
-- -----------------------------------------------------------------------------
create or replace function app.can_sign_section(p_response_id uuid, p_section_id uuid, p_signer uuid)
returns boolean
language sql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $fn$
  select exists (
    select 1
    from public.responses r
    join public.form_sections s
      on s.id = p_section_id
     and s.form_version_id = r.form_version_id
    where r.id = p_response_id
      and s.requires_signoff = true
      and (
        (s.signoff_role = 'respondent'
         and r.status = 'in_progress'
         and r.created_by = p_signer)
        or (s.signoff_role = 'staff_admin'
            and app.is_staff_admin_of(r.commission_id)
            and (r.status = 'in_progress'
                 or app.is_signoff_deferral_open(r.id)))
      )
  );
$fn$;

-- -----------------------------------------------------------------------------
-- M9 — a SEPARATE `public.guard_submitted_signoffs`, per the ADR: one function
-- (`public.guard_submitted_children`) currently backs the `answers`, the
-- `response_group_instances` AND the `response_section_signoffs` triggers, so
-- branching the shared body would touch THREE tables and make "the answers guard
-- is untouched" a review argument instead of a structural fact.
--
-- The carve-out is INSERT-only, signoff-only, and STRUCTURAL — it asks whether
-- the phase still awaits attestation, never who the caller is. Authority remains
-- with the `signoffs_insert` policy (Rule 1: RLS is the security boundary).
-- `guard_submitted_children` is left byte-identical.
-- -----------------------------------------------------------------------------
create or replace function public.guard_submitted_signoffs()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $fn$
declare
  v_response_id uuid;
  v_status text;
begin
  v_response_id := case when tg_op = 'DELETE' then old.response_id else new.response_id end;

  select status into v_status from public.responses where id = v_response_id;

  -- Not submitted, or inside submit_response's own window: unchanged pass-through.
  if v_status is distinct from 'submitted'
     or coalesce(current_setting('app.in_submit_rpc', true), 'off') = 'on' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  -- ADR 0136 D5 — the ONLY carve-out. INSERT only: an UPDATE or DELETE of a
  -- recorded signature stays blocked on a submitted response, exactly as before,
  -- because the attestation itself must be as immutable as what it attests to.
  if tg_op = 'INSERT' and app.is_signoff_deferral_open(new.response_id) then
    return new;
  end if;

  raise exception '% on a submitted response is blocked (immutable)', tg_op
    using errcode = 'check_violation';
end;
$fn$;

revoke all on function public.guard_submitted_signoffs() from public;
grant execute on function public.guard_submitted_signoffs() to authenticated, service_role;

drop trigger if exists guard_submitted_signoffs_trg on public.response_section_signoffs;
create trigger guard_submitted_signoffs_trg
before insert or update or delete on public.response_section_signoffs
for each row execute function public.guard_submitted_signoffs();

-- -----------------------------------------------------------------------------
-- M10 — D5: the LAST signature completes the phase, and only then computes the
-- result + re-flips recommendations.
-- -----------------------------------------------------------------------------
create or replace function app.trg_complete_phase_on_signoff()
returns trigger
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $fn$
declare
  v_phase_id uuid;
  v_case_id uuid;
  v_status text;
  v_current uuid;
  -- The caller's window, captured BEFORE this function opens its own. RESTORE,
  -- never force 'off' (the app.recompute_case_status precedent).
  v_prev_rpc text := coalesce(current_setting('app.in_case_rpc', true), 'off');
begin
  if not app.feature_enabled('deferred_staff_signoff') then
    return null;
  end if;

  select r.case_phase_id into v_phase_id
  from public.responses r where r.id = new.response_id;

  -- D2's standalone lane: no phase, nothing to complete.
  if v_phase_id is null then
    return null;
  end if;

  select cp.case_id, cp.status, cp.current_response_id
    into v_case_id, v_status, v_current
  from public.case_phases cp where cp.id = v_phase_id;

  -- Only the deferred park state completes this way. An `active` phase still
  -- completes on SUBMIT (the respondent lane and the flag-off lane both).
  if v_status is distinct from 'awaiting_signoff' then
    return null;
  end if;

  -- A SUPERSEDED response's signature never completes the phase: once
  -- approve_correction re-points current_response_id at the correction
  -- successor, the attestation is owed on the successor.
  if v_current is distinct from new.response_id then
    return null;
  end if;

  -- Not the LAST one yet — a response with several visible staff_admin sections
  -- stays parked until every one is signed.
  if exists (select 1 from app.pending_staff_signoffs(new.response_id)) then
    return null;
  end if;

  perform set_config('app.in_case_rpc', 'on', true);
  update public.case_phases
  set status = 'completed', completed_at = now(), updated_at = now()
  where id = v_phase_id and status = 'awaiting_signoff';
  perform set_config('app.in_case_rpc', v_prev_rpc, true);

  -- D5 — the phase RESULT is computed HERE, from countersigned answers, and the
  -- downstream recommendation flip follows it.
  perform app.compute_case_phase_result(v_phase_id);
  perform public.recompute_recommendations(v_case_id);

  return null;
end;
$fn$;

revoke all on function app.trg_complete_phase_on_signoff() from public;
grant execute on function app.trg_complete_phase_on_signoff() to authenticated, service_role;

drop trigger if exists complete_phase_on_signoff_trg on public.response_section_signoffs;
create trigger complete_phase_on_signoff_trg
after insert on public.response_section_signoffs
for each row execute function app.trg_complete_phase_on_signoff();

-- -----------------------------------------------------------------------------
-- M11 — `public.sign_section`, the RPC the UI actually calls.
--
-- ⛔ THE ADR DOES NOT NAME THIS DOOR. Its Consequences name `app.can_sign_section`
-- (the WITH CHECK) and `guard_submitted_signoffs_trg`. This INVOKER RPC carries a
-- THIRD `in_progress` gate of its own — widen the two the ADR names and every
-- deferred signature is still refused here, with every policy/trigger assertion
-- green. `prosecdef` belongs beside `pg_policies`, and an INVOKER RPC in front of
-- an RLS-gated insert is a third place to look.
--
-- Also switches BOTH of this body's `eval_condition` reads to the M3 helper /
-- `eval_visibility` — this door is one of the five that RAISE today on a
-- group-shaped section condition (BUG-SIGNOFF-GROUPCOND-001).
-- -----------------------------------------------------------------------------
create or replace function public.sign_section(p_response_id uuid, p_section_id uuid, p_note text default null::text)
returns response_section_signoffs
language plpgsql
set search_path to 'public', 'pg_catalog'
as $fn$
declare
  v_status text;
  v_version_id uuid;
  v_requires_signoff boolean;
  v_visible_when jsonb;
  v_found boolean := false;
  v_answers jsonb;
  v_result public.response_section_signoffs;
begin
  -- Definer-rights metadata read (see header). No row -> response not found.
  for v_status, v_version_id, v_requires_signoff, v_visible_when in
    select t.status, t.version_id, t.requires_signoff, t.visible_when
    from app.signoff_target(p_response_id, p_section_id) t
  loop
    v_found := true;
  end loop;

  if not v_found then
    raise exception 'resposta % não encontrada', p_response_id
      using errcode = 'no_data_found';
  end if;

  -- ADR 0136 D5 — a FROZEN response is still signable while its case phase awaits
  -- attestation. `app.is_signoff_deferral_open` is the ONE definition of that
  -- window, shared with app.can_sign_section (the RLS WITH CHECK) and
  -- public.guard_submitted_signoffs, so the three gates can never disagree.
  if v_status <> 'in_progress' and not app.is_signoff_deferral_open(p_response_id) then
    raise exception 'esta resposta já foi enviada e não pode mais ser assinada'
      using errcode = 'check_violation';
  end if;

  if v_requires_signoff is null then
    raise exception 'seção % não pertence a esta resposta', p_section_id
      using errcode = 'check_violation';
  end if;

  if not v_requires_signoff then
    raise exception 'esta seção não exige assinatura'
      using errcode = 'check_violation';
  end if;

  v_answers := app.answer_map(p_response_id);
  -- ADR 0136 / BUG-SIGNOFF-GROUPCOND-001: `eval_visibility`, not `eval_condition`.
  -- A section may carry the GROUP shape {match, conditions[]}, which
  -- `eval_condition` does not handle — it RAISED `unknown condition op: <NULL>`
  -- here, refusing every signature on such a form.
  if not app.eval_visibility(v_visible_when, v_answers) then
    raise exception 'esta seção não está disponível para assinatura'
      using errcode = 'HC014';
  end if;

  begin
    insert into public.response_section_signoffs (response_id, section_id, signed_by, note)
    values (p_response_id, p_section_id, auth.uid(), nullif(btrim(p_note), ''))
    returning * into v_result;
  exception
    when unique_violation then
      raise exception 'esta seção já foi assinada'
        using errcode = 'HC015';
  end;

  -- S1·N (ADR 0076 decision 9): auto-resolve the response's signoff reminders
  -- once no staff_admin-role visible pending section remains (a response with
  -- MULTIPLE such sections keeps its reminder alive until the last one is
  -- signed). Harmless no-op when this sign was a respondent-role section (no
  -- 'requested' notification exists for those in the first place).
  -- ADR 0136: the pending set is now app.pending_staff_signoffs — ONE definition
  -- (this was the 4th of six independent copies).
  if not exists (select 1 from app.pending_staff_signoffs(p_response_id)) then
    perform app.resolve_notifications_for('response_section_signoff', p_response_id);
  end if;

  return v_result;
end;
$fn$;

-- -----------------------------------------------------------------------------
-- M12 — `public.list_signoff_queue` widens past `r.status = 'in_progress'`.
--
-- Its `app.response_required_complete` filter already makes it a READY-TO-SIGN
-- queue, and a submitted response satisfies that trivially — so the filter is
-- short-circuited for the frozen lane rather than paid for on every row.
--
-- ⚠ The RETURNS TABLE gains `case_phase_id`, so this needs DROP + CREATE:
-- `create or replace` cannot change a return type. The DROP takes the ACLs with
-- it, so the grants are re-issued below. No policy depends on this function
-- (measured: RLS policies referencing it = 0).
-- -----------------------------------------------------------------------------
drop function if exists public.list_signoff_queue(uuid);

create function public.list_signoff_queue(p_commission_id uuid)
returns table (
  response_id uuid, form_id uuid, form_title text, version_number integer,
  respondent_id uuid, respondent_name text, section_id uuid, section_title text,
  pending_count integer, started_at timestamp with time zone,
  updated_at timestamp with time zone,
  -- ADR 0136: non-null when this row is a FROZEN case-phase response awaiting
  -- its deferred attestation. The queue mixes two lanes now, and the reviewer
  -- must be told which one they are looking at before they sign.
  case_phase_id uuid
)
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $fn$
begin
  -- Internal gate: coordinator OR an Administrativo with view_signoffs; anyone
  -- else gets an empty set (no leak, no error). Read-only — never a sign action.
  if not (app.is_staff_admin_of(p_commission_id)
          or app.member_can(p_commission_id, 'view_signoffs')) then
    return;
  end if;

  return query
  with candidate as (
    select r.id,
           r.form_version_id,
           r.created_by,
           r.started_at,
           r.updated_at,
           r.status,
           r.case_phase_id
    from public.responses r
    where r.commission_id = p_commission_id
      -- ADR 0136 D5: the draft lane, PLUS the frozen case-phase lane while its
      -- phase still awaits attestation.
      and (r.status = 'in_progress' or app.is_signoff_deferral_open(r.id))
  ),
  pending_sections as (
    select c.id as response_id,
           ps.section_id,
           ps.section_title,
           ps.section_position as position
    from candidate c
    -- ADR 0136: the ONE pending-set definition (M3). This replaces an inline
    -- copy that called `eval_condition` and therefore RAISED on a group-shaped
    -- section condition (BUG-SIGNOFF-GROUPCOND-001).
    cross join lateral app.pending_staff_signoffs(c.id) ps
  ),
  ranked as (
    select ps.response_id,
           ps.section_id,
           ps.section_title,
           count(*) over (partition by ps.response_id) as pending_count,
           row_number() over (partition by ps.response_id order by ps.position) as rn
    from pending_sections ps
  )
  select c.id,
         fv.form_id,
         f.title,
         fv.version_number,
         c.created_by,
         p.full_name,
         rk.section_id,
         rk.section_title,
         rk.pending_count::integer,
         c.started_at,
         c.updated_at,
         case when c.status = 'submitted' then c.case_phase_id else null end
  from candidate c
  join ranked rk on rk.response_id = c.id and rk.rn = 1
  join public.form_versions fv on fv.id = c.form_version_id
  join public.forms f on f.id = fv.form_id
  join public.profiles p on p.id = c.created_by
  -- A submitted response passed this at submit time; re-running the full
  -- required-completeness walk on every frozen row would be pure cost.
  where c.status = 'submitted' or app.response_required_complete(c.id)
  order by c.updated_at desc;
end;
$fn$;

revoke all on function public.list_signoff_queue(uuid) from public;
grant execute on function public.list_signoff_queue(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- M13 — `public.get_response_for_signoff`: the review-to-sign door. Two patches:
-- Gate 1 admits the frozen lane, and Gate 3's inline pending-set copy (the 2nd
-- of six, on `eval_condition`) becomes the M3 helper.
--
-- ⚠ ADR 0016's door STAYS. A coordinator reviewing a SUBMITTED case-phase
-- response is already served by ordinary RLS, but this DEFINER path remains
-- necessary for the standalone `in_progress` lane D2 keeps and for the
-- per-response visibility evaluation. ⛔ Not licence to delete it.
-- -----------------------------------------------------------------------------
do $mig$
declare
  v_def text := replace(pg_get_functiondef('public.get_response_for_signoff(uuid)'::regprocedure), chr(13), '');
  v_new text;
  a1 text := replace($anchor$  if v_response.id is null or v_response.status <> 'in_progress' then$anchor$, chr(13), '');
  b1 text := replace($anchor$  -- ADR 0136 D5: the frozen lane is reviewable too, bounded by
  -- app.is_signoff_deferral_open (phase still `awaiting_signoff` AND this response
  -- is its current one).
  if v_response.id is null
     or (v_response.status <> 'in_progress'
         and not app.is_signoff_deferral_open(p_response_id)) then$anchor$, chr(13), '');
  a2 text := replace($anchor$  select exists (
    select 1
    from public.form_sections s
    where s.form_version_id = v_response.form_version_id
      and s.requires_signoff = true
      and s.signoff_role = 'staff_admin'
      and app.eval_condition(s.visible_when, v_answers)
      and not exists (
        select 1 from public.response_section_signoffs so
        where so.response_id = p_response_id
          and so.section_id = s.id
      )
  ) into v_has_pending;$anchor$, chr(13), '');
  b2 text := replace($anchor$  -- ADR 0136: the ONE pending-set definition (M3). The inline copy this replaces
  -- called `eval_condition` and therefore RAISED on a group-shaped section
  -- condition (BUG-SIGNOFF-GROUPCOND-001).
  select exists (select 1 from app.pending_staff_signoffs(p_response_id))
    into v_has_pending;$anchor$, chr(13), '');
  v_hits int;
begin
  foreach v_new in array array[a1, a2] loop
    v_hits := (length(v_def) - length(replace(v_def, v_new, ''))) / length(v_new);
    if v_hits <> 1 then
      raise exception 'ADR0136/M13: get_response_for_signoff anchor %... found % time(s), expected 1', left(v_new, 40), v_hits;
    end if;
  end loop;

  v_new := replace(v_def, a1, b1);
  v_new := replace(v_new, a2, b2);
  execute v_new;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_response_for_signoff'
      and p.prosrc like '%app.is_signoff_deferral_open(p_response_id)%'
      and p.prosrc like '%app.pending_staff_signoffs(p_response_id)%'
  ) then
    raise exception 'ADR0136/M13: get_response_for_signoff patch did not fully land';
  end if;
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_response_for_signoff'
      and p.prosrc like '%eval_condition(s.visible_when%'
  ) then
    raise exception 'ADR0136/M13: an eval_condition section read survived';
  end if;
  -- Gate 2 (the authority gate) must be untouched — this patch widens STATE, never
  -- WHO. Its absence would be a silent authorization regression.
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_response_for_signoff'
      and p.prosrc like '%app.is_staff_admin_of(v_response.commission_id)%'
      and p.prosrc like '%app.member_can(v_response.commission_id, ''view_signoffs'')%'
  ) then
    raise exception 'ADR0136/M13: the authority gate was lost';
  end if;
end;
$mig$;

-- -----------------------------------------------------------------------------
-- M14 — `public.compute_due_notifications`: the sign-off reminder ladder.
--
-- ⚠ NOT optional polish. Its candidate CTE filters `c.status = 'in_progress'`, so
-- once a signature is DEFERRED past submit the pending/still_open reminders stop
-- firing for exactly the section that now needs chasing most — a silent
-- regression against today's behaviour for the same section. The initial
-- `requested` notification is unaffected (save_section_answers raises it while
-- the response is still a draft).
--
-- The pending-set copy (the 5th of six) becomes the M3 helper in the same patch.
-- -----------------------------------------------------------------------------
do $mig$
declare
  v_def text := replace(pg_get_functiondef('public.compute_due_notifications()'::regprocedure), chr(13), '');
  v_new text;
  a1 text := replace($anchor$    with candidate as (
      select c.id as response_id, c.commission_id, c.form_version_id,
             app.answer_map(c.id) as answers
      from public.responses c
      where c.status = 'in_progress'
        and app.response_required_complete(c.id)
    )
    select distinct cd.response_id, cd.commission_id
    from candidate cd
    join public.form_sections s
      on s.form_version_id = cd.form_version_id
     and s.requires_signoff = true
     and s.signoff_role = 'staff_admin'
    where app.eval_condition(s.visible_when, cd.answers)
      and not exists (
        select 1 from public.response_section_signoffs so
        where so.response_id = cd.response_id and so.section_id = s.id
      )$anchor$, chr(13), '');
  b1 text := replace($anchor$    -- ADR 0136: the draft lane PLUS the frozen case-phase lane. Without the
    -- second disjunct the reminder ladder stops at submit, for exactly the
    -- section that now needs chasing. `response_required_complete` is
    -- short-circuited for the frozen lane — submit already enforced it.
    -- The pending set is the ONE definition (M3), replacing an inline copy that
    -- called `eval_condition` and RAISED on a group-shaped section condition.
    select distinct c.id as response_id, c.commission_id
    from public.responses c
    where (c.status = 'in_progress' or app.is_signoff_deferral_open(c.id))
      and (c.status = 'submitted' or app.response_required_complete(c.id))
      and exists (select 1 from app.pending_staff_signoffs(c.id))$anchor$, chr(13), '');
  v_hits int;
begin
  v_hits := (length(v_def) - length(replace(v_def, a1, ''))) / length(a1);
  if v_hits <> 1 then
    raise exception 'ADR0136/M14: compute_due_notifications anchor found % time(s), expected 1', v_hits;
  end if;
  v_new := replace(v_def, a1, b1);
  execute v_new;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'compute_due_notifications'
      and p.prosrc like '%app.is_signoff_deferral_open(c.id)%'
      and p.prosrc like '%app.pending_staff_signoffs(c.id)%'
  ) then
    raise exception 'ADR0136/M14: compute_due_notifications patch did not land';
  end if;
  -- The OTHER ladders (CAPA / meeting / action item) must be intact — this body
  -- carries four and only one was touched.
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'compute_due_notifications'
      and p.prosrc like '%''capa''%' and p.prosrc like '%''meeting''%'
      and p.prosrc like '%''signoff''%'
  ) then
    raise exception 'ADR0136/M14: a sibling notification ladder was lost';
  end if;
end;
$mig$;

-- -----------------------------------------------------------------------------
-- M15 — `public.save_section_answers`: the 6th and last inline copy. Behaviour is
-- otherwise unchanged (this arm only ever runs on a draft), but the swap is what
-- clears BUG-SIGNOFF-GROUPCOND-001 on the SAVE path — where it is worst: today a
-- grouped condition on a `requires_signoff` section makes EVERY save on that form
-- raise, not just the sign-off surfaces.
-- -----------------------------------------------------------------------------
do $mig$
declare
  v_def text := replace(pg_get_functiondef(
    'public.save_section_answers(uuid,uuid,jsonb,uuid[],jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb)'::regprocedure), chr(13), '');
  a1 text := replace($anchor$    select s.id, s.title into v_pending_section_id, v_pending_section_title
    from public.form_sections s
    where s.form_version_id = v_version_id
      and s.requires_signoff = true and s.signoff_role = 'staff_admin'
      and app.eval_condition(s.visible_when, app.answer_map(p_response_id))
      and not exists (
        select 1 from public.response_section_signoffs so
        where so.response_id = p_response_id and so.section_id = s.id
      )
    order by s.position
    limit 1;$anchor$, chr(13), '');
  b1 text := replace($anchor$    -- ADR 0136: the ONE pending-set definition (M3). The inline copy this
    -- replaces called `eval_condition`, so a group-shaped section condition made
    -- EVERY save on that form raise (BUG-SIGNOFF-GROUPCOND-001).
    select ps.section_id, ps.section_title
      into v_pending_section_id, v_pending_section_title
    from app.pending_staff_signoffs(p_response_id) ps
    limit 1;$anchor$, chr(13), '');
  v_hits int;
begin
  v_hits := (length(v_def) - length(replace(v_def, a1, ''))) / length(a1);
  if v_hits <> 1 then
    raise exception 'ADR0136/M15: save_section_answers anchor found % time(s), expected 1', v_hits;
  end if;
  execute replace(v_def, a1, b1);

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'save_section_answers'
      and p.prosrc like '%app.pending_staff_signoffs(p_response_id)%'
  ) then
    raise exception 'ADR0136/M15: save_section_answers patch did not land';
  end if;
  -- The notification enqueue it feeds must still be there.
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'save_section_answers'
      and p.prosrc like '%''Assinatura solicitada''%'
  ) then
    raise exception 'ADR0136/M15: the signoff.requested enqueue was lost';
  end if;
end;
$mig$;

-- -----------------------------------------------------------------------------
-- M16/M17 — ⛔ THE ONE HOLE IN THIS DESIGN THAT IS SILENT RATHER THAN LOUD.
--
-- `close_case` would otherwise let you CONCLUDE a case over an unattested phase:
-- its HC031 gate reads `status in ('pending','active')`. And the line is
-- IDENTICAL in two places — the gate AND a post-update sweep to `not_required` —
-- with `cancel_case` carrying a third. Adding the status to the gate but not the
-- sweeps leaves the hole; the hit-count assertions below pin all three.
-- -----------------------------------------------------------------------------
do $mig$
declare
  a1 text := replace($anchor$  where case_id = p_case_id and status in ('pending', 'active');$anchor$, chr(13), '');
  b1 text := replace($anchor$  -- ADR 0136 D3: `awaiting_signoff` is unsettled work. Without it here, D3's
  -- "downstream stays blocked" guarantee stops at the case boundary.
  where case_id = p_case_id and status in ('pending', 'active', 'awaiting_signoff');$anchor$, chr(13), '');
  v_def text;
  v_hits int;
  v_fn text;
  v_expected int;
begin
  foreach v_fn in array array['public.close_case(uuid)', 'public.cancel_case(uuid)'] loop
    -- close_case carries the line TWICE (gate + sweep); cancel_case once (sweep).
    v_expected := case when v_fn like '%close_case%' then 2 else 1 end;
    v_def := replace(pg_get_functiondef(v_fn::regprocedure), chr(13), '');
    v_hits := (length(v_def) - length(replace(v_def, a1, ''))) / length(a1);
    if v_hits <> v_expected then
      raise exception 'ADR0136/M16: % anchor found % time(s), expected %', v_fn, v_hits, v_expected;
    end if;
    execute replace(v_def, a1, b1);
  end loop;

  -- Prove all THREE sites landed, from the catalog.
  if (select (length(prosrc) - length(replace(prosrc, '''pending'', ''active'', ''awaiting_signoff''', ''))) / length('''pending'', ''active'', ''awaiting_signoff''')
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'close_case') <> 2 then
    raise exception 'ADR0136/M16: close_case has fewer than 2 widened sites — the gate/sweep pair is incomplete';
  end if;
  if (select (length(prosrc) - length(replace(prosrc, '''pending'', ''active'', ''awaiting_signoff''', ''))) / length('''pending'', ''active'', ''awaiting_signoff''')
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'cancel_case') <> 1 then
    raise exception 'ADR0136/M17: cancel_case sweep did not widen';
  end if;
  -- HC031 must survive: this widens the gate, it does not remove it.
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'close_case' and p.prosrc like '%HC031%'
  ) then
    raise exception 'ADR0136/M16: close_case lost its HC031 gate';
  end if;
end;
$mig$;

-- -----------------------------------------------------------------------------
-- M18 — `app.recompute_case_status` must count `awaiting_signoff` as
-- work-in-progress. Left alone, a case whose only live phase awaits a signature
-- falls to `pending`/`not_started` and disappears from the coordinator's view at
-- exactly the moment it needs their attention.
--
-- ⭐ This body reads TWO `bool_or`s and the ADR's Consequences quote only the
-- first. The SECOND (`= 'completed'`, deciding `pending` vs `not_started`) is
-- inspected and DELIBERATELY LEFT ALONE: an unattested phase is not concluded,
-- and the first disjunct already claims every case that has one, so adding it
-- there would be dead code that also lies about what `completed` means.
-- -----------------------------------------------------------------------------
create or replace function app.recompute_case_status(p_case_id uuid)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $fn$
declare
  v_old_status text;
  v_new_status text;
  v_has_active boolean;
  v_has_concluded boolean;
  -- PCI/H1-b — the caller's window, captured BEFORE this function opens its own.
  v_prev_rpc text := coalesce(current_setting('app.in_case_rpc', true), 'off');
begin
  select status into v_old_status from public.cases where id = p_case_id;
  if v_old_status is null then
    return;  -- case gone (e.g. mid-cascade); nothing to do.
  end if;

  -- Never override a manual terminal status.
  if v_old_status in ('completed', 'cancelled') then
    return;
  end if;

  -- ADR 0136 D3: `awaiting_signoff` is LIVE work — the case is in review, waiting
  -- on a coordinator's attestation. ⛔ It is deliberately NOT added to the second
  -- bool_or: an unattested phase is not `completed`, and the first disjunct
  -- already claims every case that has one.
  select bool_or(status in ('active', 'awaiting_signoff')), bool_or(status = 'completed')
    into v_has_active, v_has_concluded
  from public.case_phases
  where case_id = p_case_id;

  if coalesce(v_has_active, false) then
    v_new_status := 'in_review';
  elsif coalesce(v_has_concluded, false) then
    v_new_status := 'pending';
  else
    v_new_status := 'not_started';
  end if;

  if v_new_status is distinct from v_old_status then
    perform set_config('app.in_case_rpc', 'on', true);
    update public.cases set status = v_new_status where id = p_case_id;
    -- RESTORE, never force 'off' — see this migration's header.
    perform set_config('app.in_case_rpc', v_prev_rpc, true);
  end if;
end;
$fn$;

-- -----------------------------------------------------------------------------
-- M19 — D7's ruled decline path DOES NOT EXIST until this patch.
--
-- D7 rules shape (a): a coordinator who declines to sign "routes through the
-- existing correction/supersession machinery". Measured, `file_correction_request`
-- gates `if v_target_status is distinct from 'completed' then raise HC0M0` — so an
-- `awaiting_signoff` phase is NOT a correctable target. With no unfreeze (D7
-- rejects shape (b)) and no correction, a declined phase is stuck forever, and
-- M16's widened HC031 then blocks the case permanently. ⛔ That is a deadlock,
-- not the "heavier for a typo in field 3" cost D7 accepted.
--
-- The widening is PHASE-ONLY by construction (narratives have no such status, but
-- the predicate says so rather than relying on it).
--
-- `approve_correction`'s impact snapshot is widened in the same breath: it records
-- which downstream phases a void/correction may affect, and an `awaiting_signoff`
-- one was silently under-reported.
-- -----------------------------------------------------------------------------
do $mig$
declare
  v_def text := replace(pg_get_functiondef(
    'public.file_correction_request(text,uuid,uuid,text,text,uuid)'::regprocedure), chr(13), '');
  a1 text := replace($anchor$  if v_target_status is distinct from 'completed' then$anchor$, chr(13), '');
  b1 text := replace($anchor$  -- ADR 0136 D7: an `awaiting_signoff` PHASE is correctable too — it is the ONLY
  -- decline path, since D7 rejected the unfreeze. Phase-only by construction.
  if v_target_status is distinct from 'completed'
     and not (p_case_phase_id is not null and v_target_status = 'awaiting_signoff') then$anchor$, chr(13), '');
  v_hits int;
begin
  v_hits := (length(v_def) - length(replace(v_def, a1, ''))) / length(a1);
  if v_hits <> 1 then
    raise exception 'ADR0136/M19: file_correction_request anchor found % time(s), expected 1', v_hits;
  end if;
  execute replace(v_def, a1, b1);

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'file_correction_request'
      and p.prosrc like '%p_case_phase_id is not null and v_target_status = ''awaiting_signoff''%'
  ) then
    raise exception 'ADR0136/M19: file_correction_request patch did not land';
  end if;
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'file_correction_request'
      and p.prosrc like '%HC0M0%'
  ) then
    raise exception 'ADR0136/M19: HC0M0 was removed — this widens the gate, it does not delete it';
  end if;
end;
$mig$;

do $mig$
declare
  v_def text := replace(pg_get_functiondef('public.approve_correction(uuid,text)'::regprocedure), chr(13), '');
  a1 text := replace($anchor$        and cp2.status in ('active', 'completed');$anchor$, chr(13), '');
  b1 text := replace($anchor$        and cp2.status in ('active', 'completed', 'awaiting_signoff');$anchor$, chr(13), '');
  v_hits int;
begin
  -- Both arms (void and correction) stamp the same snapshot.
  v_hits := (length(v_def) - length(replace(v_def, a1, ''))) / length(a1);
  if v_hits <> 2 then
    raise exception 'ADR0136/M19b: approve_correction anchor found % time(s), expected 2', v_hits;
  end if;
  execute replace(v_def, a1, b1);

  if (select (length(prosrc) - length(replace(prosrc, '''active'', ''completed'', ''awaiting_signoff''', ''))) / length('''active'', ''completed'', ''awaiting_signoff''')
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'approve_correction') <> 2 then
    raise exception 'ADR0136/M19b: approve_correction has fewer than 2 widened impact snapshots';
  end if;
end;
$mig$;

-- -----------------------------------------------------------------------------
-- M20 — `public.get_case_detail`'s response deep-link lateral is gated on
-- `cp.status = 'completed'`, so an `awaiting_signoff` phase would emit no
-- `response_id` — hiding the frozen content from the case surface at exactly the
-- moment a coordinator lands there to review it before signing.
--
-- Emitting the id is not a widening of access: the id is only a route, and the
-- destination is RLS-gated (`responses_select` grants a staff_admin the submitted
-- responses of their commission — the ADR's own Consequence).
-- -----------------------------------------------------------------------------
do $mig$
declare
  v_def text := replace(pg_get_functiondef('public.get_case_detail(uuid)'::regprocedure), chr(13), '');
  a1 text := replace($anchor$           and cp.status = 'completed'$anchor$, chr(13), '');
  b1 text := replace($anchor$           and cp.status in ('completed', 'awaiting_signoff')$anchor$, chr(13), '');
  v_hits int;
begin
  v_hits := (length(v_def) - length(replace(v_def, a1, ''))) / length(a1);
  if v_hits <> 1 then
    raise exception 'ADR0136/M20: get_case_detail anchor found % time(s), expected 1', v_hits;
  end if;
  execute replace(v_def, a1, b1);

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_case_detail'
      and p.prosrc like '%cp.status in (''completed'', ''awaiting_signoff'')%'
  ) then
    raise exception 'ADR0136/M20: get_case_detail patch did not land';
  end if;
end;
$mig$;

-- -----------------------------------------------------------------------------
-- Final catalog assertions — the migration proves its own postconditions rather
-- than trusting that every statement above ran.
-- -----------------------------------------------------------------------------
do $mig$
begin
  if not exists (select 1 from app.feature_flags where key = 'deferred_staff_signoff' and enabled = false) then
    raise exception 'ADR0136: the flag row is missing or did not ship DISABLED';
  end if;

  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'app'
        and p.proname in ('pending_staff_signoffs', 'is_signoff_deferral_open',
                          'assert_phase_result_ready', 'trg_complete_phase_on_signoff')) <> 4 then
    raise exception 'ADR0136: one of the four new app routines is missing';
  end if;

  -- ⚠ NULL proacl is the DEFAULT and INCLUDES PUBLIC. Assert the revoke landed.
  -- ⛔ The PUBLIC grantee renders as an aclitem whose grantee half is EMPTY —
  -- `=X/postgres`. Matching `'%=X/%'` against the flattened array is WRONG: every
  -- named grant (`postgres=X/postgres`) contains that substring too, so the
  -- detector fires on a correctly-revoked routine. Match per-aclitem on a LEADING
  -- `=`. Positive control (measured): this form finds `app.eval_condition`
  -- (explicit `=X/postgres`) and `app.compute_case_phase_result` (NULL proacl),
  -- and finds none of the four below.
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app'
      and p.proname in ('pending_staff_signoffs', 'is_signoff_deferral_open',
                        'assert_phase_result_ready', 'trg_complete_phase_on_signoff')
      and (p.proacl is null
           or exists (select 1 from unnest(p.proacl) g where g::text like '=%'))
  ) then
    raise exception 'ADR0136: a new app routine is PUBLIC-executable (NULL proacl is the default)';
  end if;

  if not exists (
    select 1 from pg_trigger where tgname = 'complete_phase_on_signoff_trg'
      and tgrelid = 'public.response_section_signoffs'::regclass and not tgisinternal
  ) then
    raise exception 'ADR0136/M10: the completion trigger is not installed';
  end if;

  if not exists (
    select 1 from pg_trigger t join pg_proc p on p.oid = t.tgfoid
    where t.tgname = 'guard_submitted_signoffs_trg'
      and t.tgrelid = 'public.response_section_signoffs'::regclass
      and p.proname = 'guard_submitted_signoffs'
  ) then
    raise exception 'ADR0136/M9: guard_submitted_signoffs_trg still points at the shared guard';
  end if;

  -- ⛔ The shared guard must be PROVABLY untouched: it still backs `answers` and
  -- `response_group_instances`, and the carve-out must not have leaked into it.
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'guard_submitted_children'
      and (p.prosrc like '%signoff%' or p.prosrc like '%awaiting%')
  ) then
    raise exception 'ADR0136/M9: the carve-out leaked into guard_submitted_children';
  end if;

  -- `activate_phase`'s settled set must be UNCHANGED — D3''s "zero new gating
  -- logic" is exactly the fact that `awaiting_signoff` is absent from it.
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'activate_phase'
      and p.prosrc like '%awaiting_signoff%'
  ) then
    raise exception 'ADR0136/D3: awaiting_signoff was added to activate_phase — downstream phases would UNBLOCK';
  end if;
end;
$mig$;
