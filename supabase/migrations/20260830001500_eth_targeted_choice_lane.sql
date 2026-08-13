-- ETH·E2 (ADR 0073 §D13) — OUT-OF-PHASE FIX, ruled in by the PO during FF-2's
-- gate. Not FF-2 scope: these are the CHOICE lane's tables, shipped long before
-- this phase. Surfaced by the FF-2 Wave-4 door-parity sweep.
--
-- ⚠ MIGRATION WINDOW. The instruction said `20260830001300+`, but 001300 and
-- 001400 are already applied (FF-2 Wave 4; max registered = 20260830001400).
-- This is 001500 — flagged rather than silently renumbered.
--
-- THE DEFECT. A targeted respondent (ETH·E2's whole point: an external
-- professional formally instructed to complete a form) resolves through
-- `app.can_access_targeted_*`. The version, its sections and its items all carry
-- a `_select_targeted` policy. Their CHILDREN do not:
--
--   form_versions            → form_versions_select_targeted        ✅
--   form_sections            → form_sections_select_targeted        ✅
--   form_items               → form_items_select_targeted           ✅
--   form_item_options        → (none)                               ❌  no options to pick
--   answer_selected_options  → (none, read AND write)               ❌  cannot save or re-read
--   response_group_instances → (none, read AND write)               ❌  cannot fill a repeating group
--
-- So `multiple_choice`, `dropdown` and `checkbox` — three of the eight input
-- types — render with an empty option list for that user class, and a selection
-- can be neither persisted nor read back. Fails closed; no data corruption.
--
-- CONVENTION. Separate `_targeted` policies, matching `form_items`,
-- `form_sections`, `form_versions`, `responses` and `answers` — NOT a widened
-- base `qual`. Permissive policies OR together, so the two shapes are
-- functionally equivalent; the repo's is the separate policy, and a reader
-- diffing `form_item_options` against `form_items` should see the same shape.
-- (FF-2's own matrix-axis fix in 20260830001400 widened the base qual instead —
-- functionally identical, cosmetically inconsistent. Noted in PROGRESS.md rather
-- than rewritten, since applied migrations are forward-only and a normalising
-- migration would be churn for zero behaviour change.)
--
-- READ **AND** WRITE. `answer_selected_options` and `response_group_instances`
-- get both arms. A read-only fix would be the exact half-feature trap the FF-2
-- sweep caught on the axis tables one round earlier, mirrored: there, a writable
-- surface the user could not read; here, a readable surface the user could not
-- write.

-- ---------------------------------------------------------------------------
-- 1 · form_item_options — the options themselves.
--     Byte-aligned with `form_items_select_targeted`, which this table's rows
--     hang off; `form_item_options.form_version_id` is denormalised for exactly
--     this kind of version-scoped predicate.
-- ---------------------------------------------------------------------------
create policy form_item_options_select_targeted on public.form_item_options
  for select to authenticated
  using (app.can_access_targeted_version(form_version_id, (select auth.uid())));

-- ---------------------------------------------------------------------------
-- 2 · answer_selected_options — the selection itself, read and write.
--
--     FOR ALL on the write side, mirroring this table's own
--     `answer_selected_options_write_own_draft` (also FOR ALL) rather than the
--     INSERT/UPDATE split `answers` uses. That is not cosmetic here:
--     `save_section_answers` implements REPLACE semantics as
--     DELETE-then-INSERT, so without DELETE a targeted respondent CHANGING a
--     single-select answer would have the delete silently filtered to 0 rows and
--     the insert add a second selection — two selections on a `multiple_choice`
--     item. An INSERT-only widening would have turned a fail-closed defect into
--     a data-corrupting one.
-- ---------------------------------------------------------------------------
create policy answer_selected_options_select_targeted on public.answer_selected_options
  for select to authenticated
  using (
    exists (
      select 1 from public.answers a
      where a.id = answer_selected_options.answer_id
        and app.can_access_targeted_response(a.response_id, (select auth.uid()))
    )
  );

create policy answer_selected_options_write_targeted on public.answer_selected_options
  for all to authenticated
  using (
    exists (
      select 1 from public.answers a
      where a.id = answer_selected_options.answer_id
        and app.can_write_targeted_response(a.response_id, (select auth.uid()))
    )
  )
  with check (
    exists (
      select 1 from public.answers a
      where a.id = answer_selected_options.answer_id
        and app.can_write_targeted_response(a.response_id, (select auth.uid()))
    )
  );

-- ---------------------------------------------------------------------------
-- 3 · response_group_instances — NOT in the reported finding; found by sweeping
--     the rest of the fill path, as instructed.
--
--     FF-1's repeating groups crossed with ETH·E2's targeted flow: the three
--     instance RPCs are INVOKER and run under RLS, so a targeted respondent
--     could not create, reorder, remove or even SEE an instance. A form
--     containing a repeating group was as unfillable for them as one containing
--     a choice question — the same defect, one feature over, and equally
--     unreported.
--
--     `app.can_write_targeted_response` already contains the `in_progress` test,
--     so this is arm-for-arm the same rule as `_write_own_draft`.
-- ---------------------------------------------------------------------------
create policy response_group_instances_select_targeted on public.response_group_instances
  for select to authenticated
  using (app.can_access_targeted_response(response_id, (select auth.uid())));

create policy response_group_instances_write_targeted on public.response_group_instances
  for all to authenticated
  using (app.can_write_targeted_response(response_id, (select auth.uid())))
  with check (app.can_write_targeted_response(response_id, (select auth.uid())));

-- ---------------------------------------------------------------------------
-- 4 · app.assert_group_writable — the RPC-side half of (3).
--
--     Widening the RLS policy alone would NOT have worked, and the keystone is
--     what exposed that: the three FF-1 instance RPCs all funnel through this
--     helper, which carries its own explicit creator-only test raising HC0N2. So
--     a targeted respondent would have passed RLS and still been refused by the
--     RPC — the policy fix silently doing nothing.
--
--     Its own comment says why it exists: *"RLS already confines the write to the
--     creator's own draft; this only turns that zero-row silence into a readable
--     pt-BR message."* That was true when written and is exactly the failure mode
--     this phase keeps meeting — a gate that RESTATES an RLS rule and then drifts
--     from it when the rule widens. It is restated here as the union, so it
--     tracks the policy instead of shadowing it.
--
--     This helper is SECURITY INVOKER, so RLS remains the real boundary and
--     widening it cannot over-grant: a caller who passes this check but fails the
--     policy still writes zero rows. It is a message door, not a security door —
--     which is precisely why it must not be NARROWER than the policy.
-- ---------------------------------------------------------------------------
create or replace function app.assert_group_writable(p_response_id uuid, p_group_item_id uuid)
returns jsonb
language plpgsql
stable
set search_path to 'public', 'pg_catalog'
as $function$
declare
  v_status text;
  v_creator uuid;
  v_version uuid;
  v_config jsonb;
  v_type text;
begin
  if not app.feature_enabled('repeating_groups') then
    raise exception 'recurso indisponível' using errcode = 'HC0N0';
  end if;

  select r.status, r.created_by, r.form_version_id
    into v_status, v_creator, v_version
  from public.responses r
  where r.id = p_response_id;

  if v_status is null then
    raise exception 'resposta % não encontrada', p_response_id
      using errcode = 'no_data_found';
  end if;

  if v_status <> 'in_progress' then
    raise exception 'esta resposta já foi enviada e não pode mais ser editada'
      using errcode = 'check_violation';
  end if;

  -- The UNION of the response_group_instances write policies: the creator's own
  -- draft OR a targeted respondent (ETH·E2). Mirrors the policy rather than
  -- restating half of it.
  if v_creator is distinct from auth.uid()
     and not app.can_write_targeted_response(p_response_id, auth.uid()) then
    raise exception 'apenas quem iniciou esta resposta pode editá-la'
      using errcode = 'HC0N2';
  end if;

  select i.item_type, i.config into v_type, v_config
  from public.form_items i
  where i.id = p_group_item_id
    and i.form_version_id = v_version;

  if v_type is distinct from 'repeating_group' then
    raise exception 'este item não é um bloco repetível deste formulário'
      using errcode = 'HC0N4';
  end if;

  return v_config;
end;
$function$;

-- ---------------------------------------------------------------------------
-- DELIBERATELY NOT TOUCHED — recorded so the gaps are not "found" again as new:
--
--   · `form_item_validations` (FF-3, reserved) and `answer_references` (FF-5)
--     both lack the arm and are WRITE-INERT (0 rows), so there is no live
--     impact. Each phase's writer landing is exactly when that stops being true;
--     both are carried in PROGRESS.md as binding obligations, the way FF-1's
--     P0-1 was carried to FF-2.
--
--   · `response_section_signoffs` lacks it too, and that appears CORRECT rather
--     than missing: the `respondent` sign-off role is defined as the response's
--     `created_by`, which for a targeted response is the COORDINATOR, not the
--     target. A targeted respondent is not a signer of their own targeted
--     response. Flagged for the lead rather than changed, because "appears
--     correct by design" is a claim about intent, not something the catalog
--     can settle.
-- ---------------------------------------------------------------------------
