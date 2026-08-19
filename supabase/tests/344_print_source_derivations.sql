-- =============================================================================
-- The four PRINT-SOURCE DERIVATION DISPATCHES — vector-driven keystones.
-- ADR 0125 D1/D5/D8 + Amendment 2 · ADR 0126 D5/D7/D8/D9/D10 + the disposal
-- conjunct. Migration 20260928001000.
--
-- ⭐ WHAT MAKES THIS SUITE NON-VACUOUS, stated up front because the assertions
-- below are cheap to fake:
--
--  1. THE VECTORS ARE LOADED, NOT RESTATED. `\ir` pulls the SAME generated file
--     the TS side hashes. If the fixture were restated here, this suite could
--     agree with itself while the two sides drifted — which is the exact hole
--     ADR 0126 D3 refuses and the whole reason the fixture exists.
--     ⚠ `.psql`, not `.sql`: pg_prove collects every `*.sql` under tests/ AS A
--     TEST, and a plan-less fixture fails the whole run.
--
--  2. THE VECTOR TABLE IS COUNTED (t1). A `\ir` that silently loaded nothing
--     would leave the loops below iterating zero rows and every `is()` emitting
--     nothing — a suite that passes having asserted nothing. The fixed `plan()`
--     is the second half of that guard: 0 rows means 0 tests means plan failure.
--
--  3. EVERY CONSTRUCTED FIXTURE IS RE-READ AND COMPARED TO THE VECTOR'S DECLARED
--     INPUTS (t3 family) BEFORE the predicate is asked. This is the wrong-arm
--     fixture guard. Without it a builder that quietly failed to open the
--     correction request would hand the predicate a plain submitted response,
--     which returns `true` — and the vector expecting `false` would red for the
--     right reason by accident, or worse, a builder bug in the other direction
--     would make a row pass while testing a state nobody constructed.
--
--  4. THE STATE IS BUILT THROUGH THE REAL CONSTRAINTS. Meetings are walked
--     `scheduled -> held -> in_signature -> ...` because `app.guard_meeting_status`
--     admits no jumps; a fixture that set `status` directly would prove the
--     predicate reads a column, not that the product can reach the state.
--
-- ⚠ ONE ARM IS SYNTHETIC AND SAYS SO — see §5 (meeting head / revision).
-- =============================================================================

begin;
select plan(68);

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
create temp table k on commit drop as
  select (v->>'st_x')::uuid   as st_x,
         (v->>'sa_x')::uuid   as sa_x,
         (v->>'comm_x')::uuid as comm_x,
         (v->>'ver_u')::uuid  as ver_u
  from ctx;

-- The SHARED vectors — same bytes the TS suite hashes (consumer 1 of 4).
\ir vectors/print_source_registers_vectors.psql

-- ── 1. Non-vacuity: the fixture actually loaded ─────────────────────────────
select is((select count(*)::int from print_source_vectors), 20,
  't1 ⭐ NON-VACUITY: the shared vector table loaded 20 rows. A \ir that resolved '
  'to nothing would leave every loop below iterating zero rows and every is() '
  'emitting nothing — a green suite that asserted nothing');

-- ── 2. The fixture builder ──────────────────────────────────────────────────
-- Returns the source id for a vector's declared state, or a random uuid for the
-- kinds that have no table (case/interview/unknown) — where "no row" IS the
-- state under test: the dispatch must fail closed before it ever looks.
create function pg_temp.mk_source(
  p_kind text, p_status text,
  p_correction_open boolean, p_phase_voided boolean, p_meeting_disposed boolean
) returns uuid language plpgsql as $fn$
declare
  v_id uuid := gen_random_uuid();
  v_case uuid; v_phase uuid; v_form uuid; v_org uuid; v_st text;
begin
  if p_kind = 'form_response' then
    select f.form_id into v_form from public.form_versions f where f.id = (select ver_u from k);
    select c.organization_id into v_org from public.commissions c where c.id = (select comm_x from k);

    -- A phase is needed only when a flag demands one. The plain rows stay
    -- STANDALONE on purpose: `responses_one_draft_per_user_idx` is
    -- (form_version_id, created_by) WHERE in_progress AND case_phase_id IS NULL,
    -- so two standalone in_progress fixtures would collide — and the tempting
    -- fix (reuse one response) would silently make two vectors assert one state.
    if p_correction_open or p_phase_voided then
      insert into public.cases (id, commission_id, organization_id, case_number)
      values (gen_random_uuid(), (select comm_x from k), v_org,
              (select coalesce(max(case_number), 0) + 1 from public.cases))
      returning id into v_case;

      perform set_config('app.in_case_rpc', 'on', true);
      insert into public.case_phases (id, case_id, position, form_id, form_version_id, status)
      values (gen_random_uuid(), v_case, 1, v_form, (select ver_u from k),
              case when p_phase_voided then 'voided' else 'active' end)
      returning id into v_phase;
      perform set_config('app.in_case_rpc', 'off', true);
    end if;

    insert into public.responses
      (id, form_version_id, commission_id, created_by, status, case_phase_id,
       started_at, submitted_at)
    values (v_id, (select ver_u from k), (select comm_x from k), (select st_x from k),
            p_status, v_phase, now(),
            case when p_status = 'submitted' then now() end);

    if p_correction_open then
      perform set_config('app.in_correction_rpc', 'on', true);
      insert into public.case_correction_requests
        (case_id, commission_id, case_phase_id, kind, reason, classification,
         requested_by, permitted_corrector, draft_response_id, status)
      values (v_case, (select comm_x from k), v_phase, 'correction',
              'vetor de teste', 'clerical', (select sa_x from k), (select st_x from k),
              v_id, 'resubmitted');
      perform set_config('app.in_correction_rpc', 'off', true);
    end if;
    return v_id;

  elsif p_kind = 'meeting' then
    insert into public.meetings (id, commission_id, title, scheduled_start)
    values (v_id, (select comm_x from k), 'Reunião de vetor', now());

    -- WALKED, NOT SET. guard_meeting_status admits no jumps, so a fixture that
    -- assigned `status` directly would be testing a state the product cannot
    -- reach — and would keep passing if the transition graph tightened.
    perform set_config('app.in_meeting_rpc', 'on', true);
    if p_status = 'cancelled' then
      update public.meetings set status = 'cancelled' where id = v_id;
    else
      foreach v_st in array array['held', 'in_signature', 'signed', 'distributed'] loop
        exit when v_st = 'held' and p_status = 'scheduled';
        update public.meetings set status = v_st where id = v_id;
        exit when v_st = p_status;
      end loop;
    end if;
    if p_meeting_disposed then
      update public.meetings set phi_disposed_at = now() where id = v_id;
    end if;
    perform set_config('app.in_meeting_rpc', 'off', true);
    return v_id;
  end if;

  return v_id;                       -- case | interview | unknown: no row, by design
end $fn$;

-- ── 3. Build every vector's state and evaluate both predicates ──────────────
create temp table vres (
  ord int, kind text, status text, co boolean, pv boolean, md boolean,
  exp_reg boolean, exp_wm text, src uuid,
  act_reg boolean, act_wm text,
  built_status text, built_co boolean, built_pv boolean, built_md boolean, built_found boolean
) on commit drop;

do $$
declare v record; i int := 0; v_src uuid; s record;
begin
  for v in select * from print_source_vectors loop
    i := i + 1;
    v_src := pg_temp.mk_source(v.kind, v.status, v.correction_open, v.phase_voided, v.meeting_disposed);
    s := app.resolve_print_source_state(v.kind, v_src);
    insert into vres values (
      i, v.kind, v.status, v.correction_open, v.phase_voided, v.meeting_disposed,
      v.registers, v.watermark, v_src,
      app.print_source_registers(v.kind, v_src),
      app.print_source_watermark(v.kind, v_src),
      s.o_status, s.o_correction_open, s.o_phase_voided, s.o_meeting_disposed, s.o_found);
  end loop;
end $$;

select is((select count(*)::int from vres), 20,
  't2 ⭐ NON-VACUITY: the builder produced a row for every vector. A loop that '
  'raised or skipped would emit fewer is() calls below and the fixed plan would '
  'fail — this asserts it directly rather than leaving it to the plan count');

-- ── 4. THE WRONG-ARM FIXTURE GUARD ──────────────────────────────────────────
-- Re-read the state the builder actually created and compare it to the vector's
-- DECLARED inputs, BEFORE trusting any predicate answer below. For the three
-- provider-less kinds the declared state is "no row at all", and that is what is
-- asserted — `o_found = false` is the state under test, not a fixture failure.
-- ⚠ THE EXPECTATION IS PER-KIND, AND THE CROSS-KIND FLAGS EXPECT **false** — not
-- the vector's declared value. This control initially compared the built state to
-- the vector's inputs verbatim and RED on exactly the two cross-kind rows, which
-- was the control being wrong rather than the builder: `meeting_disposed` is not a
-- constructible fact ABOUT a response, and `correction_open`/`phase_voided` are not
-- facts about a meeting. Those rows exist to prove each dispatch IGNORES the other
-- kind's flags, so the state the builder can honestly produce for them is
-- out-of-kind-flags-false. Comparing verbatim would have forced a "fix" that
-- either invented an impossible fixture or deleted the assertion.
-- ⭐ And it is STRONGER this way: it now also pins that `resolve_print_source_state`
-- does not LEAK cross-kind state into its out-params.
select is(
  case when kind in ('form_response', 'meeting')
       then built_found::text || '|' || built_status || '|' || built_co::text || '|'
            || built_pv::text || '|' || built_md::text
       else built_found::text end,
  case when kind = 'form_response'
         then 'true|' || status || '|' || co::text || '|' || pv::text || '|false'
       when kind = 'meeting'
         then 'true|' || status || '|false|false|' || md::text
       else 'false' end,
  't3.' || ord || ' FIXTURE CONTROL ' || kind || '/' || status
    || case when co then '+correction_open' else '' end
    || case when pv then '+phase_voided' else '' end
    || case when md then '+meeting_disposed' else '' end
    || ': the CONSTRUCTED state matches the vector''s declared inputs'
) from vres order by ord;

-- ── 5. The two predicates, over every vector ────────────────────────────────
select is(act_reg, exp_reg,
  't4.' || ord || ' registers ' || kind || '/' || status
    || case when co then '+correction_open' else '' end
    || case when pv then '+phase_voided' else '' end
    || case when md then '+meeting_disposed' else '' end
) from vres order by ord;

select is(act_wm, exp_wm,
  't5.' || ord || ' watermark ' || kind || '/' || status
    || case when co then '+correction_open' else '' end
    || case when pv then '+phase_voided' else '' end
    || case when md then '+meeting_disposed' else '' end
) from vres order by ord;

-- ── 6. SERIES (0126 D1) ─────────────────────────────────────────────────────
select is(
  app.print_source_series('meeting', (select src from vres where kind = 'meeting' limit 1)),
  (select src from vres where kind = 'meeting' limit 1),
  't6 series/meeting: its own id — meetings have no revision CHAIN, which is '
  'exactly why they needed a revision EPOCH instead (D9)');

select is(
  app.print_source_series('form_response', (select src from vres where kind = 'form_response' and not co and not pv limit 1)),
  (select src from vres where kind = 'form_response' and not co and not pv limit 1),
  't7 series/form_response: a chainless response is its own series root');

-- ── 7. HEAD (0126 D8/D9) ────────────────────────────────────────────────────
select is(
  app.print_source_head('form_response', (select src from vres where kind = 'form_response' and status = 'submitted' and not co and not pv and not md limit 1), 0),
  true,
  't8 head/form_response: a chainless submitted response is trivially head — and '
  'this is also the ETH·E2 shape (a targeted-respondent defense is phase-attached '
  'but never pointed at, so pointer equality would have made it permanently '
  'not-current; the successor rule leaves it head)');

-- ⚠⚠ SYNTHETIC — AND THE REAL PATH DOES NOT EXIST YET. `printed_documents` has
-- no `source_revision` column until B3/#3, and nothing stores a revision, so the
-- mismatch below is CONSTRUCTED BY HAND rather than reached by the product. It
-- pins the comparison, NOT the corridor.
-- ⛔ OBLIGATION, carried deliberately: after #3 lands, re-run this arm against a
-- print carrying a REAL stored `source_revision` produced by
-- `reopen_meeting` -> re-mint, and re-confirm it REDS when the comparison is
-- neutralized. A keystone written against a synthetic input and never
-- re-verified against the real one is how a green arm ends up pinning nothing —
-- and this arm is the one closing D9's reopen -> edit -> re-sign corridor, which
-- is the corridor ADR 0126 exists for.
select is(
  app.print_source_head('meeting', (select src from vres where kind = 'meeting' limit 1), 0),
  true,
  't9 head/meeting: revision MATCH is head (synthetic — see the block comment; '
  'no print stores a revision until #3)');

select is(
  app.print_source_head('meeting', (select src from vres where kind = 'meeting' limit 1), 1),
  false,
  't10 ⭐ head/meeting DIFFERENTIAL: revision MISMATCH is NOT head. Without this '
  't9 is equally satisfied by a stub returning constant true — which is precisely '
  'the fiat constant 0126 D9 was written to remove');

select is(
  app.print_source_head('bogus_kind', gen_random_uuid(), 0), false,
  't11 head fail-closed: an unhandled kind is NOT head (not-head = not-current)');

select * from finish();
rollback;
