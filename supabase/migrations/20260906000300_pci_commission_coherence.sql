-- PCI/H3 (process-case integrity audit, finding H3) — move cross-commission
-- referential integrity out of the RPC doors and into the substrate.
--
-- ── THE DEFECT ─────────────────────────────────────────────────────────────────
--
-- Commission-coherence guards existed for exactly three things — template
-- narratives, template outcomes, and the template's case_type — and nowhere else.
-- Every table below accepted a FOREIGN commission's row on a direct PostgREST
-- write, because its FK only says "some row in that table exists", never "a row
-- belonging to THIS commission":
--
--   cases.outcome_id                        -> case_outcomes      (any commission)
--   case_narratives.narrative_type_id       -> case_narrative_types
--   case_offered_outcomes.outcome_id        -> case_outcomes
--   case_phase_allowed_results.result_id    -> phase_results
--   case_phase_offered_results.result_id    -> phase_results
--   case_phases.result_id / result_override_id -> phase_results
--   case_phases.form_id                     -> forms
--   process_template_phases.form_id         -> forms
--
-- The RPCs check. The tables did not. That is the ADR 0079 failure class inverted:
-- not "a door nothing tests", but "a door the substrate does not back", so any
-- write that bypasses the door bypasses the check. Since all eight tables carry a
-- FOR ALL policy plus full DML grants to `authenticated`, bypassing the door is a
-- single PostgREST call.
--
-- ── THE "ONLY WHEN CHANGING" DISCIPLINE ────────────────────────────────────────
--
-- ⚠ Two guards below fire only when the guarded column actually CHANGES, and this
-- is deliberate, not laziness:
--
--   * `cases.outcome_id` membership in case_offered_outcomes mirrors the
--     `set_case_outcome` door exactly. But `set_case_offered_outcomes` can REMOVE
--     an outcome that a case already carries, leaving a legitimately inconsistent
--     row. An unconditional guard would then block every later UNRELATED update to
--     that case — turning a data-quality wrinkle into a frozen case.
--
--   * `process_template_phases.result_ruleset` content is validated by
--     `app.validate_template_result_ruleset`, which demands the phase's form be
--     PUBLISHED. A form archived after the ruleset was authored would make every
--     later update to that phase fail.
--
-- Guarding the transition rather than the state is what makes a substrate guard
-- safe to add to a live table. Commission-coherence itself is guarded
-- UNCONDITIONALLY — it can never be legitimately violated, so there is no
-- pre-existing-inconsistency hazard to accommodate.
--
-- ── EVERY GUARD HERE IS *AFTER*, AND THAT IS ARCHITECTURAL ─────────────────────
--
-- ⚠ These started as BEFORE triggers and `supabase/tests/177_processless_cases.sql`
-- rejected that — correctly, and for a reason worth stating.
--
-- Its assertion 31 pins WHICH LAYER denies a forged cross-commission INSERT into
-- `case_offered_outcomes`: it expects 42501 from the RLS policy, by name. Postgres
-- runs BEFORE triggers ahead of the RLS WITH CHECK, so a BEFORE guard pre-empted
-- the policy and returned HC030 instead. The row was still refused — but the test
-- that PINS THE POLICY would have gone green for the wrong reason forever after,
-- and a later regression in `case_offered_outcomes_staff_admin_write` would have
-- been invisible. That is coverage loss disguised as defence in depth, and it is
-- exactly the ADR 0079 failure mode.
--
-- Architecture Rule 1 says RLS is THE security boundary. Integrity guards must
-- therefore catch what RLS PERMITS, never answer before RLS has spoken. AFTER
-- triggers give that ordering — RLS denies first, these guards catch the rest —
-- and still abort the transaction on raise, which is all they need to do.
--
-- It is also required for one of them on its own merits: `app.validate_template_
-- result_ruleset(template_id, position, ruleset)` resolves the phase by SELECTing
-- `process_template_phases` on (template_id, position). In a BEFORE INSERT that row
-- does not exist yet, so it raises "fase % não encontrada no processo" and would
-- reject EVERY template phase insert, including the RPC's own.
--
-- ── INVARIANTS BIND EVERYONE; DOOR MIRRORS BIND THE CLIENT ─────────────────────
--
-- The distinction that survived the pgTAP suite, and the one to preserve:
--
--   * COMMISSION-COHERENCE is an INVARIANT — a case referencing another tenant's
--     outcome/result/form/narrative-type is incoherent no matter who wrote it. It
--     is enforced unconditionally, for every role.
--   * OFFERED-MEMBERSHIP is a DOOR MIRROR — it re-states a rule `set_case_outcome`
--     enforces. Privileged fixtures legitimately construct states that violate it
--     (265_reopen_void_narrative.sql assigns an outcome with no offered row to set
--     up the reopen path). It is scoped to `authenticated`/`anon`, the boundary the
--     door actually defends.
--
-- Blurring these two is what makes substrate guards break test suites and seeds.
--
-- ── MUTATION PROOF ─────────────────────────────────────────────────────────────
-- supabase/tests/296_process_case_integrity.sql §H3 — one cross-commission write
-- attempt per guarded column, each paired with a same-commission control that must
-- SUCCEED. Without the control pair a deny test passes on a broken fixture.

-- ── A · cases.outcome_id ───────────────────────────────────────────────────────
create or replace function app.guard_case_outcome_coherent()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_outcome_commission uuid;
begin
  if new.outcome_id is null then
    return new;
  end if;

  select commission_id into v_outcome_commission
  from public.case_outcomes where id = new.outcome_id;

  if v_outcome_commission is distinct from new.commission_id then
    raise exception 'este desfecho não pertence à comissão deste caso'
      using errcode = 'HC030';
  end if;

  -- Offered-membership mirrors set_case_outcome. See the header for the two
  -- scopings below; both were forced by real failures, not chosen a priori.
  --
  -- ⚠ UPDATE-ONLY, and INSERT is excluded DELIBERATELY. `case_offered_outcomes` is
  -- populated AFTER the case row exists (create_case_from_template inserts the
  -- case, then the offered set; the seed's terminal Caso 0002 does the same), so
  -- an INSERT can never satisfy this check — requiring it there fails `db reset`
  -- at the seed and would reject every legitimate creation that pre-sets an
  -- outcome. The door being mirrored, `set_case_outcome`, is itself an UPDATE
  -- path; matching its scope exactly is the point. The commission check above
  -- still applies to INSERT, which is the arm that carries the cross-tenant risk.
  --
  -- ⚠ CLIENT-ROLE-ONLY. This is a DOOR MIRROR, not an invariant: a case carrying an
  -- outcome outside its offered set is untidy, not incoherent, and privileged
  -- fixtures legitimately create that state (265_reopen_void_narrative.sql inserts
  -- a case_outcomes row and assigns it directly, with no offered row, to set up the
  -- reopen path). Commission-coherence above binds EVERYONE because it can never be
  -- legitimately violated; this one binds the boundary the door defends.
  if tg_op = 'UPDATE'
     and new.outcome_id is distinct from old.outcome_id
     and app.is_client_role() then
    if not exists (
      select 1 from public.case_offered_outcomes
      where case_id = new.id and outcome_id = new.outcome_id
    ) then
      raise exception 'este desfecho não está disponível para este caso'
        using errcode = 'HC030';
    end if;
  end if;

  return new;
end;
$function$;

drop trigger if exists guard_case_outcome_coherent_trg on public.cases;
create trigger guard_case_outcome_coherent_trg
  after insert or update on public.cases
  for each row execute function app.guard_case_outcome_coherent();

-- ── B · case_narratives.narrative_type_id ──────────────────────────────────────
create or replace function app.guard_case_narrative_type_coherent()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_case_commission uuid;
  v_type_commission uuid;
begin
  if new.narrative_type_id is null then
    return new;  -- the FK is ON DELETE SET NULL; a detached narrative is legal.
  end if;

  v_case_commission := app.commission_of_case(new.case_id);
  select commission_id into v_type_commission
  from public.case_narrative_types where id = new.narrative_type_id;

  if v_case_commission is null
     or v_type_commission is distinct from v_case_commission then
    raise exception 'este tipo de narrativa não pertence à comissão deste caso'
      using errcode = 'HC054';
  end if;

  return new;
end;
$function$;

drop trigger if exists guard_case_narrative_type_coherent_trg on public.case_narratives;
create trigger guard_case_narrative_type_coherent_trg
  after insert or update on public.case_narratives
  for each row execute function app.guard_case_narrative_type_coherent();

-- ── C · case_offered_outcomes.outcome_id ───────────────────────────────────────
create or replace function app.guard_case_offered_outcome_coherent()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_case_commission uuid;
  v_outcome_commission uuid;
begin
  v_case_commission := app.commission_of_case(new.case_id);
  select commission_id into v_outcome_commission
  from public.case_outcomes where id = new.outcome_id;

  if v_case_commission is null
     or v_outcome_commission is distinct from v_case_commission then
    raise exception 'este desfecho não pertence à comissão deste caso'
      using errcode = 'HC030';
  end if;

  return new;
end;
$function$;

drop trigger if exists guard_case_offered_outcome_coherent_trg on public.case_offered_outcomes;
create trigger guard_case_offered_outcome_coherent_trg
  after insert or update on public.case_offered_outcomes
  for each row execute function app.guard_case_offered_outcome_coherent();

-- ── D · the two case↔phase_results join tables ─────────────────────────────────
-- One body, keyed off tg_table_name: case_phase_allowed_results is phase-keyed,
-- case_phase_offered_results is case-keyed (its name says phase; its PK says case —
-- see the ADR on that misnaming).
create or replace function app.guard_case_result_link_coherent()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_case_id uuid;
  v_case_commission uuid;
  v_result_commission uuid;
begin
  if tg_table_name = 'case_phase_allowed_results' then
    v_case_id := app.case_of_case_phase(new.case_phase_id);
  else
    v_case_id := new.case_id;
  end if;

  v_case_commission := app.commission_of_case(v_case_id);
  select commission_id into v_result_commission
  from public.phase_results where id = new.result_id;

  if v_case_commission is null
     or v_result_commission is distinct from v_case_commission then
    raise exception 'este resultado não pertence à comissão deste caso'
      using errcode = 'HC030';
  end if;

  return new;
end;
$function$;

drop trigger if exists guard_case_phase_allowed_results_coherent_trg on public.case_phase_allowed_results;
create trigger guard_case_phase_allowed_results_coherent_trg
  after insert or update on public.case_phase_allowed_results
  for each row execute function app.guard_case_result_link_coherent();

drop trigger if exists guard_case_phase_offered_results_coherent_trg on public.case_phase_offered_results;
create trigger guard_case_phase_offered_results_coherent_trg
  after insert or update on public.case_phase_offered_results
  for each row execute function app.guard_case_result_link_coherent();

-- ── E · case_phases.result_id / result_override_id / form_id ───────────────────
create or replace function app.guard_case_phase_refs_coherent()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_case_commission uuid;
  v_other uuid;
begin
  v_case_commission := app.commission_of_case(new.case_id);
  if v_case_commission is null then
    return new;  -- parent not visible (cascade); nothing to compare against.
  end if;

  if new.result_id is not null then
    select commission_id into v_other from public.phase_results where id = new.result_id;
    if v_other is distinct from v_case_commission then
      raise exception 'este resultado não pertence à comissão deste caso'
        using errcode = 'HC030';
    end if;
  end if;

  if new.result_override_id is not null then
    select commission_id into v_other from public.phase_results where id = new.result_override_id;
    if v_other is distinct from v_case_commission then
      raise exception 'este resultado não pertence à comissão deste caso'
        using errcode = 'HC030';
    end if;
  end if;

  if new.form_id is not null then
    select commission_id into v_other from public.forms where id = new.form_id;
    if v_other is distinct from v_case_commission then
      raise exception 'este formulário não pertence à comissão deste caso'
        using errcode = 'HC030';
    end if;
  end if;

  return new;
end;
$function$;

drop trigger if exists guard_case_phase_refs_coherent_trg on public.case_phases;
create trigger guard_case_phase_refs_coherent_trg
  after insert or update on public.case_phases
  for each row execute function app.guard_case_phase_refs_coherent();

-- ── F · process_template_phases.form_id ────────────────────────────────────────
create or replace function app.guard_template_phase_form_coherent()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_template_commission uuid;
  v_form_commission uuid;
begin
  select commission_id into v_template_commission
  from public.process_templates where id = new.template_id;
  select commission_id into v_form_commission
  from public.forms where id = new.form_id;

  if v_template_commission is null
     or v_form_commission is distinct from v_template_commission then
    raise exception 'este formulário não pertence à comissão deste processo'
      using errcode = 'HC030';
  end if;

  return new;
end;
$function$;

drop trigger if exists guard_template_phase_form_coherent_trg on public.process_template_phases;
create trigger guard_template_phase_form_coherent_trg
  after insert or update on public.process_template_phases
  for each row execute function app.guard_template_phase_form_coherent();

-- ── G · process_template_phases.result_ruleset CONTENT ─────────────────────────
-- AFTER, and transition-only. Both properties are load-bearing — see the header.
create or replace function app.guard_template_phase_ruleset_content()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
begin
  if new.result_ruleset is null then
    return null;
  end if;

  if tg_op = 'INSERT' or new.result_ruleset is distinct from old.result_ruleset then
    perform app.validate_template_result_ruleset(
      new.template_id, new.position, new.result_ruleset
    );
  end if;

  return null;
end;
$function$;

comment on function app.guard_template_phase_ruleset_content() is
  'PCI/H3 — backs app.validate_template_result_ruleset with a table-level guard, so a direct write cannot plant a ruleset the add_/update_template_phase RPCs would have rejected. AFTER (the validator resolves the phase by (template_id, position), which does not exist yet in a BEFORE INSERT) and transition-only (the validator requires a PUBLISHED form; a form archived after authoring would otherwise freeze the row).';

drop trigger if exists guard_template_phase_ruleset_content_trg on public.process_template_phases;
create trigger guard_template_phase_ruleset_content_trg
  after insert or update on public.process_template_phases
  for each row execute function app.guard_template_phase_ruleset_content();
