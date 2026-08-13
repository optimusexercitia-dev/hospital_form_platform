-- =============================================================================
-- FF-5 (ADR 0091) — Entity Reference, part 1 of 7: the SHAPE.
--
-- Widens the F3 frozen one-lane `answer_references` (participant only, write-
-- inert since 2026-07-12) to the three lanes ADR 0086 ruling 5 committed to:
-- participant | commission | user. Adds the two target columns, replaces the
-- one-sided participant CHECK with a true kind<->target XOR, relaxes the
-- `reference` arm of form_items_input_vs_display (ADR 0086 ruling 4), lands the
-- SELECT door parity F3 left short, and seeds the flag OFF.
--
-- ⚠ THE DOOR-PARITY ARMS ARE NOT A NICE-TO-HAVE (ADR 0091 §Substrate). F3 gave
-- `answer_references_select` ONLY the base arm (creator / commission-admin /
-- submitted+staff_admin). Its two siblings carry three arms:
--
--     answer_selected_options_select           base + can_read_correction_response
--     answer_selected_options_select_targeted  can_access_targeted_response
--     answer_matrix_cells_select               all three, folded into one policy
--
-- That gap IS FF-2's QA r1 blocker B-2, which shipped and had to be fixed in
-- 20260830001300. The rule it produced — "a door must be neither weaker NOR
-- stronger than the surface beside it" — is why the parity lands HERE, in the
-- same wave as the writer, instead of at review. Read arm-for-arm from
-- pg_policies on 2026-07-28, not from the sibling migration text.
--
-- SQLSTATE high-water at authoring time is HC0Q2; this migration allocates none.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1 · The two new target columns. `on delete restrict` mirrors the participant
--     lane F3 already chose: a reference must never be able to strand, because
--     ADR 0091 ruling 4 resolves labels by LIVE JOIN and keeps no snapshot. The
--     FK is what makes that safe, so it is load-bearing, not defensive.
-- -----------------------------------------------------------------------------
alter table public.answer_references
  add column if not exists commission_id uuid
    references public.commissions(id) on delete restrict,
  add column if not exists profile_id uuid
    references public.profiles(id) on delete restrict;

-- -----------------------------------------------------------------------------
-- 2 · reference_kind: the three committed lanes. Hospital/org stay deferred
--     (ADR 0086 ruling 5) — both this CHECK and the XOR below extend by one arm
--     when they land, which is the whole reason the shape is an explicit
--     enumeration rather than a nullable free-for-all.
-- -----------------------------------------------------------------------------
alter table public.answer_references
  drop constraint if exists answer_references_reference_kind_check;

alter table public.answer_references
  add constraint answer_references_reference_kind_check
  check (reference_kind in ('participant', 'commission', 'user'));

-- -----------------------------------------------------------------------------
-- 3 · kind <-> target XOR (ADR 0091 ruling 8).
--
--     The F3 constraint it replaces was one-sided: `reference_kind <>
--     'participant' OR participant_id is not null` constrained only the
--     participant arm and said nothing about the other columns — under it a
--     kind='commission' row with a participant_id AND a profile_id was legal.
--     This form pins BOTH directions for all three lanes: the kind's own target
--     is present AND the other two are null, so "exactly one target, matching
--     the kind" is a single constraint rather than four interacting ones.
--
--     Tenant containment (the target belongs to the response's organization) is
--     deliberately NOT here — it spans tables, which a CHECK cannot do. It is a
--     coherence trigger on the writer path (part 2), the
--     reject_invalid_selection / guard_matrix_cell_coherent precedent.
-- -----------------------------------------------------------------------------
alter table public.answer_references
  drop constraint if exists answer_references_participant_shape;

alter table public.answer_references
  add constraint answer_references_kind_target_xor check (
    (reference_kind = 'participant'
       and participant_id is not null and commission_id is null and profile_id is null)
    or
    (reference_kind = 'commission'
       and commission_id is not null and participant_id is null and profile_id is null)
    or
    (reference_kind = 'user'
       and profile_id is not null and participant_id is null and commission_id is null)
  );

-- -----------------------------------------------------------------------------
-- 4 · One target per reference item (v1, ADR 0091 ruling 9). Mirrors
--     answer_risk_matrix's `unique (answer_id)` rather than
--     answer_selected_options' multi-row shape. Multi-target is additive later:
--     dropping this constraint widens the lane without touching the writer's
--     REPLACE semantics, the completeness arm ("at least one row"), or the
--     aggregation (which already groups by target id).
-- -----------------------------------------------------------------------------
alter table public.answer_references
  drop constraint if exists answer_references_one_target_per_answer;

alter table public.answer_references
  add constraint answer_references_one_target_per_answer unique (answer_id);

-- Aggregation + RESTRICT-check support. The FK columns are the aggregation key
-- (ADR 0091 ruling 4: never the label), and each one is what an `on delete
-- restrict` probe scans when a target row is deleted.
create index if not exists answer_references_participant_idx
  on public.answer_references (participant_id) where participant_id is not null;
create index if not exists answer_references_commission_idx
  on public.answer_references (commission_id) where commission_id is not null;
create index if not exists answer_references_profile_idx
  on public.answer_references (profile_id) where profile_id is not null;

comment on table public.answer_references is
  'ADR 0060 §4 Rec A + ADR 0065 §7, ACTIVATED by FF-5 (ADR 0091). Reference-item answer '
  'bridging to one of three lanes: participant (the A/C bridge), commission, or user '
  '(profiles). Exactly one target column is populated and it matches reference_kind '
  '(answer_references_kind_target_xor). Aggregates on the stable target id, NEVER the '
  'label — labels are resolved by live join (ruling 4), and `on delete restrict` on all '
  'three FKs is what makes that safe. Holds NO PHI: the participant lane reads only '
  'participants.display_name, which is a SURROGATE for patients by construction '
  '(set_participant_patient hardcodes ''Paciente''); raw identity stays in '
  'patient_identifiers behind its audited door, which this module never touches. '
  'Rule 12 therefore still enumerates exactly three PHI modules (ADR 0091 ruling 1).';

comment on column public.answer_references.commission_id is
  'FF-5 commission lane. Candidates inherit commissions_select_member_or_admin '
  '(ADR 0091 ruling 3 — invoker-rights search, never a DEFINER door).';
comment on column public.answer_references.profile_id is
  'FF-5 user lane. Candidates inherit profiles_select_self_or_admin, whose co-member arm '
  'is what makes a commission colleague pickable (ADR 0091 ruling 3).';

-- -----------------------------------------------------------------------------
-- 5 · Required-capable (ADR 0086 ruling 4 / ADR 0091 ruling 6).
--
--     F3 pinned the `reference` arm to `required = false AND required_if IS
--     NULL` — the "never-required freeze" (pgTAP 209 §B) that each field-type
--     phase relaxes for its OWN arm and re-pins for the rest. The new arm is
--     byte-identical to the matrix arm; every other arm below is carried over
--     UNCHANGED from the live constraint definition (read from pg_constraint on
--     2026-07-28, not retyped from the F3 migration).
--
--     The freeze assertion is replaced by this phase's deadlock-negative
--     keystones (`completeness_reference_arm`), per the program plan §2.
-- -----------------------------------------------------------------------------
alter table public.form_items
  drop constraint if exists form_items_input_vs_display;

alter table public.form_items
  add constraint form_items_input_vs_display check (
    case
      when item_type = any (array[
        'multiple_choice', 'dropdown', 'checkbox', 'free_text',
        'short_text', 'number', 'date', 'time'
      ]) then
        question_key is not null and label is not null and content is null

      when item_type = any (array['matrix', 'risk_matrix']) then
        question_key is not null and label is not null and content is null

      -- FF-5: `required` + `required_if` released. Now identical to the matrix arm.
      when item_type = 'reference' then
        question_key is not null and label is not null and content is null

      when item_type = any (array['group', 'repeating_group']) then
        content is null and required = false and question_key is null
        and label is not null and default_value is null and required_if is null

      when item_type = any (array['section_text', 'image']) then
        content is not null and question_key is null and label is null
        and question_explanation is null and required = false and required_if is null

      else false
    end
  );

-- -----------------------------------------------------------------------------
-- 6 · SELECT door parity (see the header). Three arms, matching
--     answer_selected_options arm-for-arm:
--       a. base      — creator / commission-admin / submitted+staff_admin
--       b. corrector — app.can_read_correction_response
--       c. targeted  — app.can_access_targeted_response (its own policy, exactly
--                      as answer_selected_options_select_targeted is its own)
--
--     Still NO write policy and NO write grant: `authenticated` keeps SELECT
--     only, so every direct write fails 42501 and the only way in is the DEFINER
--     door in part 2. That is pgTAP 209 §C's K9 keystone, and it must stay green
--     with the writer LIVE — which is the whole point of K9.
-- -----------------------------------------------------------------------------
drop policy if exists answer_references_select on public.answer_references;

create policy answer_references_select on public.answer_references
  for select to authenticated
  using (
    exists (
      select 1
      from public.answers a
      join public.responses r on r.id = a.response_id
      where a.id = answer_references.answer_id
        and (r.created_by = (select auth.uid())
             or app.is_commission_admin_of(r.commission_id)
             or (r.status = 'submitted' and app.is_staff_admin_of(r.commission_id)))
    )
    or exists (
      select 1
      from public.answers a2
      where a2.id = answer_references.answer_id
        and app.can_read_correction_response(a2.response_id, (select auth.uid()))
    )
  );

drop policy if exists answer_references_select_targeted on public.answer_references;

create policy answer_references_select_targeted on public.answer_references
  for select to authenticated
  using (
    exists (
      select 1
      from public.answers a
      where a.id = answer_references.answer_id
        and app.can_access_targeted_response(a.response_id, (select auth.uid()))
    )
  );

-- The grant F3 already made; restated because a policy without a grant is an
-- inert boundary that denies reads (K9 / QA phase-F1 MAJOR-1).
grant select on public.answer_references to authenticated;

-- -----------------------------------------------------------------------------
-- 7 · The flag, seeded OFF. Flipped by 20260902000600_enable_entity_refs.sql at
--     the FF-5 gate — the two-migration convention. `db push` carries migrations,
--     not seed.sql, so a flag that is ON only in the seed is DARK in production
--     (FF-2 r1 B-3, then FF-3 r1 B-1 — twice).
-- -----------------------------------------------------------------------------
insert into app.feature_flags (key, enabled, description)
values (
  'entity_refs',
  false,
  'FF-5 (ADR 0091) — reference items: participant / commission / user lanes. '
  'Gates the reference answer writer, the candidate search and the builder type. '
  'Seeded OFF; flipped at the FF-5 gate.'
)
on conflict (key) do nothing;
