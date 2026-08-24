-- ============================================================================
-- ADR 0137 D1/D2 — Migration A: the process PHI switch becomes a three-mode
-- setting, with an explicit required-field set.
--
-- ADDITIVE ONLY. This migration adds the columns, backfills them mechanically
-- from the retiring booleans, and constrains them. It does NOT re-emit any
-- function body and it does NOT drop anything — that is Migration B
-- (20261003001400), which must not run before this one has landed.
--
-- ⛔ BACKFILL IS `true -> 'optional'`, NEVER `'required'` (ADR 0137 D1). A
--    boolean carries no evidence that any existing process intended MANDATORY
--    collection, and guessing `required` would retroactively make every live
--    case of that process un-createable.
--
-- ⚠ `age_years` and `unit` are excluded from the required-field vocabulary BY
--    THE CONSTRAINT below, not merely by omission from the picker. ADR 0137 D2
--    (the set) and D9 (the removal of those two inputs from every case surface)
--    are two halves of one decision; a CHECK is the only thing that stops them
--    drifting apart one field at a time.
--
-- ⛔ NO TOP-LEVEL `set local` HERE. Outside an explicit transaction it is a
--    silent no-op (Postgres warns 25P01 and continues), so it passes every
--    local gate while doing nothing. This file needs none.
-- ============================================================================

-- ── 1. process_template_versions: the authored setting ──────────────────────

alter table public.process_template_versions
  add column patient_mode text not null default 'none',
  add column patient_required_fields text[] not null default '{}';

comment on column public.process_template_versions.patient_mode is
  'ADR 0137 D1. How this template VERSION collects patient identifiers: '
  '''none'' (no PHI block at all), ''optional'' (offered, may be left empty), '
  '''required'' (must be filled to create the case). Replaces the retired '
  'boolean `collects_patient`; a case snapshots it as `cases.patient_mode`.';

comment on column public.process_template_versions.patient_required_fields is
  'ADR 0137 D2. When `patient_mode = ''required''`, the identifier fields that '
  'must carry a value. `mrn` is ALWAYS a member (welded by the CHECK below) '
  'because the MRN is the LGPD erasure key. `age_years` and `unit` are '
  'excluded by the domain CHECK, not merely absent from the picker (D9).';

-- ── 2. cases: the snapshot ──────────────────────────────────────────────────

alter table public.cases
  add column patient_mode text not null default 'none',
  add column patient_required_fields text[] not null default '{}';

comment on column public.cases.patient_mode is
  'ADR 0137 D1. Snapshotted at case creation from the template version''s '
  '`patient_mode` (immutable per case), so flipping a live process to '
  '''required'' cannot strand cases that already exist. A process-less case '
  '(`create_case`) maps its boolean argument: true -> ''optional'', false -> ''none''.';

comment on column public.cases.patient_required_fields is
  'ADR 0137 D2. Snapshotted alongside `patient_mode`. Read as a WHOLE by three '
  'layers (trigger, RPC, action); never split into per-field columns, or those '
  'layers could disagree one field at a time.';

-- ── 3. Backfill — total and mechanical (ADR 0137 D1) ────────────────────────
-- One statement per table. Every pre-existing `true` becomes 'optional', every
-- `false` becomes 'none', and NOTHING becomes 'required'.

-- ⛔ THE TRIGGERS MUST BE STOOD ASIDE, AND FOR TWO INDEPENDENT REASONS — the
--    second one is the quiet one and it is why a scoped `app.in_*_rpc` bypass
--    flag is NOT enough here:
--
--    1. CORRECTNESS. `app.guard_published_template_version` refuses ANY
--       non-status update to a published or archived version (Architecture
--       Rule 5), and it honours no bypass flag at all — measured, not assumed:
--       the first run of this migration failed on it with 23514. A published
--       version must still receive its `patient_mode`, because live cases
--       inherit from exactly those rows.
--    2. AUDIT HYGIENE (Rule 11). `audit_cases_trg` and
--       `audit_template_versions_trg` emit one row PER ROW TOUCHED. A schema
--       backfill is not a state change any actor performed, so leaving them
--       armed would write a `case.updated` / `process_template_version.updated`
--       row for every case and every version in the database, attributed to
--       nobody, and permanently — the log is append-only. `touch_cases_updated_at`
--       would likewise rewrite `updated_at` on every case, corrupting the
--       "recently touched" ordering the board sorts by.
--
--    `disable trigger user` leaves FK/internal triggers armed, so referential
--    integrity is unaffected. The whole thing is ONE plpgsql block, which is a
--    single statement and therefore atomic even though the Supabase CLI does
--    not wrap a migration file in a transaction — an interrupted top-level
--    sequence could otherwise leave the triggers disabled.
do $backfill$
begin
  alter table public.process_template_versions disable trigger user;
  alter table public.cases disable trigger user;

  update public.process_template_versions
     set patient_mode = case when collects_patient then 'optional' else 'none' end;

  update public.cases
     set patient_mode = case when patient_enabled then 'optional' else 'none' end;

  alter table public.cases enable trigger user;
  alter table public.process_template_versions enable trigger user;
end;
$backfill$;

-- ── 4. Constraints ──────────────────────────────────────────────────────────

-- 4a. The mode vocabulary.
alter table public.process_template_versions
  add constraint process_template_versions_patient_mode_check
  check (patient_mode in ('none', 'optional', 'required'));

alter table public.cases
  add constraint cases_patient_mode_check
  check (patient_mode in ('none', 'optional', 'required'));

-- 4b. The DOMAIN of the required-field set. This is the constraint that welds
--     ADR 0137 D2 to D9: `age_years` and `unit` are not members, so no picker,
--     RPC or action can reintroduce them without failing here first.
alter table public.process_template_versions
  add constraint process_template_versions_patient_required_fields_domain
  check (patient_required_fields
         <@ array['name', 'mrn', 'date_of_birth', 'sex', 'encounter_ref', 'attending']::text[]);

alter table public.cases
  add constraint cases_patient_required_fields_domain
  check (patient_required_fields
         <@ array['name', 'mrn', 'date_of_birth', 'sex', 'encounter_ref', 'attending']::text[]);

-- 4c. The MRN is the erasure key (ADR 0137 Context + D2): a `required` mode
--     that does not require the MRN would produce exactly the un-erasable
--     record the whole decision exists to prevent.
alter table public.process_template_versions
  add constraint process_template_versions_required_implies_mrn
  check (patient_mode <> 'required' or 'mrn' = any (patient_required_fields));

alter table public.cases
  add constraint cases_required_implies_mrn
  check (patient_mode <> 'required' or 'mrn' = any (patient_required_fields));

-- ── 5. The shared required-field predicate (ONE place, four callers) ────────
-- Every layer that asks "is this PHI payload complete for this case?" asks it
-- HERE. Duplicating the field-by-field test into each door is the drift class
-- ARCHITECTURE.md Rule 3 generalizes ("any predicate that exists twice needs a
-- single shared fixture"); one function needs no fixture.
--
-- Returns the MISSING field names, in the canonical order, or `{}` when the
-- payload satisfies the set. `p_patient` is a jsonb object keyed by the field
-- names above; a NULL payload means "no PHI supplied at all".

create or replace function app.patient_required_missing(
  p_mode text,
  p_required text[],
  p_patient jsonb
) returns text[]
language sql
immutable
set search_path to 'app', 'public', 'pg_catalog'
as $function$
  select coalesce(array_agg(f order by ord), '{}'::text[])
  from unnest(
         array['name', 'mrn', 'date_of_birth', 'sex', 'encounter_ref', 'attending'],
         array[1, 2, 3, 4, 5, 6]
       ) as v(f, ord)
  where p_mode = 'required'
    and f = any (coalesce(p_required, '{}'::text[]))
    and (
      p_patient is null
      or coalesce(btrim(p_patient ->> f), '') = ''
      -- `sex` is the one field with a non-empty "unknown" sentinel: the column
      -- defaults to it and every writer coalesces to it, so treating a present
      -- 'unknown' as satisfied would make a required `sex` unfalsifiable.
      or (f = 'sex' and btrim(p_patient ->> f) = 'unknown')
    );
$function$;

comment on function app.patient_required_missing(text, text[], jsonb) is
  'ADR 0137 D2/D3. THE single required-field predicate. Returns the missing '
  'field names for a PHI payload against a case/version''s mode + required set, '
  'or {} when satisfied. Called by the minting RPCs, by the shared PHI writer '
  'app._set_participant_patient_unchecked, and by the cases guard trigger, so '
  'those four layers cannot disagree.';

create or replace function app.assert_patient_required_fields(
  p_mode text,
  p_required text[],
  p_patient jsonb
) returns void
language plpgsql
immutable
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_missing text[] := app.patient_required_missing(p_mode, p_required, p_patient);
  v_labels text;
begin
  if cardinality(v_missing) = 0 then
    return;
  end if;
  select string_agg(
           case f
             when 'name' then 'nome'
             when 'mrn' then 'prontuário'
             when 'date_of_birth' then 'data de nascimento'
             when 'sex' then 'sexo'
             when 'encounter_ref' then 'atendimento'
             when 'attending' then 'profissional responsável'
             else f
           end, ', ' order by ord)
    into v_labels
  from unnest(v_missing) with ordinality as u(f, ord);

  -- ADR 0135: an AUTHORED refusal gets its own SQLSTATE. Not `23514` and not
  -- `42501` — a mapper may surface an HC*** message unconditionally, and
  -- `throws_ok(..., 'HC0T1')` can only pass on the refusal this door wrote.
  raise exception 'este processo exige a identificação do paciente: preencha %', v_labels
    using errcode = 'HC0T1';
end;
$function$;

comment on function app.assert_patient_required_fields(text, text[], jsonb) is
  'ADR 0137 D3 / ADR 0135. Raises HC0T1 (pt-BR, naming the missing fields) when '
  'a PHI payload does not satisfy a required-mode case. Thin wrapper over '
  'app.patient_required_missing so the PREDICATE stays single-sourced.';

-- ── 6. The structural backstop: a DEFERRED constraint trigger on `cases` ────
--
-- ⭐ THIS IS NOT MERELY DEFENCE IN DEPTH, AND THE MEASUREMENT IS THE REASON.
--    `public.cases` grants `authenticated` `arwdm` and `cases_staff_admin_write`
--    is a `FOR ALL` policy, so a staff_admin can INSERT a case DIRECTLY over
--    PostgREST without ever calling a creation RPC — and `app.guard_case_status`
--    is BEFORE DELETE OR UPDATE only, with no INSERT arm. An argument-shaped
--    check inside the three minting RPCs therefore leaves that path completely
--    unguarded. This is precisely the "a DEFINER RPC gate is not table-level
--    enforcement" lesson (BUG-SUP-002) that ADR 0137 D3 cites.
--
-- ⚠ DEFERRED, and the deferral is load-bearing rather than cosmetic. The PHI
--    row is written AFTER the case row in every door (the participant chain
--    needs `cases.organization_id`), and `bulk_create_cases` writes it later
--    still — after `activate_phase`. An IMMEDIATE check would fire between the
--    two and refuse every legitimate creation.
--
-- ⚠ INSERT ONLY, deliberately. An UPDATE arm would break `dispose_case_phi`,
--    which legitimately DELETEs `patient_identifiers` from an existing case:
--    an LGPD Art. 18 erasure must never be blocked by the collection rule.
--
-- ⚠ pgTAP runs inside a transaction that is rolled back, so a deferred trigger
--    never fires on its own there. Tests must force it with
--    `set constraints all immediate;` — see supabase/tests/362.

create or replace function app.guard_case_patient_required()
returns trigger
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_payload jsonb;
begin
  if new.patient_mode <> 'required' then
    return null;
  end if;

  -- The case's patient identifiers, resolved through the participant chain
  -- (ADR 0064 re-key: `patient_identifiers` hangs off `patient_participants`,
  -- there is no `case_patient` relation). A required-mode case must carry at
  -- least one live patient whose identifiers satisfy the whole set.
  --
  -- The BEST candidate is chosen (fewest missing fields) rather than an
  -- arbitrary one, purely so the refusal names what is actually absent: a
  -- `limit 1` over an unordered set would report a second patient's gaps while
  -- the coordinator looks at the first.
  select to_jsonb(pi) into v_payload
  from public.case_participants cp
  join public.participants p on p.id = cp.participant_id
  join public.patient_identifiers pi on pi.participant_id = cp.participant_id
  where cp.case_id = new.id
    and cp.removed_at is null
    and p.participant_type = 'patient'
  order by cardinality(
             app.patient_required_missing(
               new.patient_mode, new.patient_required_fields, to_jsonb(pi))) asc
  limit 1;

  -- Satisfied payload -> returns silently. Incomplete or absent -> HC0T1
  -- naming the missing fields. A NULL payload (no patient at all) reports the
  -- whole set, which is the correct answer.
  perform app.assert_patient_required_fields(
    new.patient_mode, new.patient_required_fields, v_payload);
  return null;
end;
$function$;

comment on function app.guard_case_patient_required() is
  'ADR 0137 D3 — the TABLE-LEVEL half. Deferred constraint trigger body: at '
  'commit, a `required`-mode case must carry a live patient whose identifiers '
  'satisfy its required set. Covers the direct-table INSERT path that the '
  'minting RPCs cannot (cases grants authenticated arwdm and its write policy '
  'is FOR ALL), i.e. the BUG-SUP-002 shape. INSERT-only so dispose_case_phi '
  'stays possible.';

create constraint trigger guard_case_patient_required_trg
  after insert on public.cases
  deferrable initially deferred
  for each row execute function app.guard_case_patient_required();

-- ── 7. The sibling half: the SNAPSHOT is immutable after INSERT ─────────────
--
-- ⛔ WITHOUT THIS, SECTION 6 IS BYPASSABLE IN TWO STEPS, by the very same
--    `FOR ALL` policy that made section 6 necessary:
--      (a) a staff_admin INSERTs a case with `patient_mode = 'none'` — the
--          deferred trigger fires, sees 'none', and correctly passes;
--      (b) the same staff_admin UPDATEs that row to `patient_mode = 'required'`
--          — and NOTHING fires, because section 6 is INSERT-only.
--    The result is a `required`-mode case carrying no PHI at all: exactly the
--    state ADR 0137 D1–D3 exist to forbid, reached without ever touching a
--    creation RPC.
--
-- ⛔ THE FIX IS NOT AN UPDATE ARM ON SECTION 6. That would break
--    `public.dispose_case_phi`, whose final statement updates `cases` after
--    having DELETEd the patient identifiers — an LGPD Art. 18 erasure would
--    then be refused by the collection rule. A narrow immutability guard gets
--    the same closure without that collision, because (measured) the disposal
--    path writes only `has_patient` / `phi_disposed_at` / `phi_disposed_by` /
--    `phi_disposed_reason` and never these two columns.
--
-- ⭐ This is also what ADR 0137 D1 ALREADY CLAIMS. D1 justifies snapshotting
--    the mode onto the case on the grounds that a mode change is "a versioned,
--    publishable change ... so live cases are unaffected". If a live case's
--    snapshot could be updated in place, live cases WOULD be affected. The
--    guard is what makes that sentence true rather than aspirational.
--
-- ⚠ RECORDED ASYMMETRY — THIS IS A DECISION, NOT AN OVERSIGHT. Section 6 binds
--   the required-field invariant at CREATION, not for the case's lifetime. A
--   `required`-mode case whose PHI has since been erased by `dispose_case_phi`
--   therefore sits, legitimately and permanently, missing fields its own mode
--   demands. That is correct and deliberate: erasure outranks a collection
--   rule (ADR 0035/0131), and a lifetime invariant would make an Art. 18
--   request un-honourable for exactly the cases that most need it. A future
--   reader WILL read this state as a hole; it is not one.

create or replace function app.guard_case_patient_mode_immutable()
returns trigger
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
begin
  if new.patient_mode is distinct from old.patient_mode
     or new.patient_required_fields is distinct from old.patient_required_fields then
    raise exception
      'o modo de identificação do paciente é definido na criação do caso e não pode ser alterado'
      using errcode = 'HC0T3';
  end if;
  return new;
end;
$function$;

comment on function app.guard_case_patient_mode_immutable() is
  'ADR 0137 D1. cases.patient_mode / patient_required_fields are a SNAPSHOT and '
  'are immutable after INSERT. Closes the two-step bypass of '
  'app.guard_case_patient_required (insert as ''none'', then update to '
  '''required''), which the INSERT-only deferred trigger cannot see. Narrow on '
  'purpose: dispose_case_phi updates other columns of the same row and must '
  'keep working.';

create trigger guard_case_patient_mode_immutable_trg
  before update of patient_mode, patient_required_fields on public.cases
  for each row execute function app.guard_case_patient_mode_immutable();

-- ── 8. ACLs on the four new `app` functions ────────────────────────────────
--
-- ⛔ A FUNCTION WITH NO EXPLICIT GRANT IS PUBLIC-EXECUTABLE. `proacl` is NULL by
--    default and a NULL ACL means the owner's default, which INCLUDES `PUBLIC` —
--    so "I granted nothing" is not "nobody may call it". `supabase/tests/320`
--    §U1 pins the `app` PUBLIC-executable population at an exact count for this
--    reason, and these four moved it 237 -> 241 on the first run.
--
-- None of them needs PUBLIC:
--   * the two trigger bodies are invoked by the trigger machinery, which does
--     NOT check EXECUTE against the triggering user;
--   * the two predicate helpers are only ever called from bodies owned by
--     `postgres` (the DEFINER minting doors, the DEFINER trigger, and the
--     INVOKER `app._set_participant_patient_unchecked` — itself callable only by
--     `postgres`), so the effective user is always the owner.

revoke all on function app.patient_required_missing(text, text[], jsonb) from public;
revoke all on function app.assert_patient_required_fields(text, text[], jsonb) from public;
revoke all on function app.guard_case_patient_required() from public;
revoke all on function app.guard_case_patient_mode_immutable() from public;
