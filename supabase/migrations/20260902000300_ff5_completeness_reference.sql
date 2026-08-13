-- =============================================================================
-- FF-5 (ADR 0091 ruling 6) — Entity Reference, part 4 of 7: COMPLETENESS.
--
-- Two predicates, both of which FF-2 left an explicit in-code note about, both
-- of which are structurally blind to a new answer shape until someone adds the
-- arm:
--
--   1. `app.item_required_satisfied` — the FF-1 dispatch / FF-2 predicate that
--      `app.response_required_complete` consults for EVERY item type. Without a
--      `reference` arm a required reference falls into the `else` branch, which
--      tests `answers.value` and `answer_selected_options` — a reference row
--      populates NEITHER, so a required reference would be permanently
--      unsatisfiable and would DEADLOCK submit for any form carrying one.
--
--   2. `app.instance_is_empty` — consulted by both the minInstances count and
--      the per-instance walk in `response_required_complete`, and by
--      `submit_response`'s pruning. Without the arm, an instance whose only
--      content is a reference reads as EMPTY, so submit prunes the instance and
--      the `on delete cascade` on answer_id takes the reference with it. The
--      user's answer is silently destroyed at submit. FF-2 hit exactly this and
--      left the warning in the body ("FF-5 must add the identical arm for
--      answer_references; the blindness is structural, not matrix-specific").
--
-- Note what is NOT here: visibility. A hidden item is excluded by the CALLERS,
-- before this predicate is ever reached (`app.eval_visibility` conjuncts in both
-- arms of `response_required_complete`), which is what makes "visibility wins"
-- structural rather than a rule this function has to remember. The
-- deadlock-negative keystones assert it from the outside.
--
-- The two arms below are additive: every prior arm is carried over byte-for-byte
-- from the live pg_proc bodies read on 2026-07-28.
--
-- SQLSTATE: allocates none.
-- =============================================================================

create or replace function app.item_required_satisfied(
  p_response_id uuid,
  p_item_id uuid,
  p_item_type text,
  p_instance_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  select case
    -- ROW-COMPLETE (ADR 0089 ruling 3): every row of the grid has a cell. The
    -- weaker "at least one cell anywhere" reading would let a 20-row checklist
    -- satisfy `required` with a single tick.
    --
    -- Axis rows carry no visibility conditions, so "every VISIBLE row" reduces
    -- to "every row". Item visibility still wins, and is applied by the CALLERS
    -- before they ever reach this predicate.
    --
    -- The `exists (rows)` guard is load-bearing: without it a grid with zero
    -- rows would vacuously satisfy `not exists (row without a cell)` and report
    -- complete. (validate_matrix_axes prevents publishing one, so this is the
    -- draft-fill belt to that braces.)
    when p_item_type = 'matrix' then (
      exists (
        select 1 from public.form_matrix_rows r where r.item_id = p_item_id
      )
      and not exists (
        select 1
        from public.form_matrix_rows r
        where r.item_id = p_item_id
          and not exists (
            select 1
            from public.answer_matrix_cells c
            join public.answers a on a.id = c.answer_id
            where a.response_id = p_response_id
              and a.item_id = p_item_id
              and a.group_instance_id is not distinct from p_instance_id
              and c.row_id = r.id
          )
      )
    )

    -- A risk_matrix is complete when its single answer row exists (ADR 0089
    -- ruling 3, final clause).
    when p_item_type = 'risk_matrix' then exists (
      select 1
      from public.answer_risk_matrix rm
      join public.answers a on a.id = rm.answer_id
      where a.response_id = p_response_id
        and a.item_id = p_item_id
        and a.group_instance_id is not distinct from p_instance_id
    )

    -- FF-5 (ADR 0091 ruling 6): a reference is satisfied by the presence of a
    -- target row. "At least one" rather than "exactly one" deliberately —
    -- answer_references_one_target_per_answer already pins the cardinality at
    -- one (ruling 9), so this arm needs no change if that constraint is later
    -- dropped to allow multi-target.
    when p_item_type = 'reference' then exists (
      select 1
      from public.answer_references ar
      join public.answers a on a.id = ar.answer_id
      where a.response_id = p_response_id
        and a.item_id = p_item_id
        and a.group_instance_id is not distinct from p_instance_id
    )

    -- The eight scalar/choice types — byte-for-byte the test that was inlined
    -- in four places before the FF-2 migration.
    else (
      exists (
        select 1 from public.answers a
        where a.response_id = p_response_id
          and a.item_id = p_item_id
          and a.group_instance_id is not distinct from p_instance_id
          and a.value is not null
          and a.value <> 'null'::jsonb
      )
      or exists (
        select 1
        from public.answer_selected_options s
        join public.answers a on a.id = s.answer_id
        where a.response_id = p_response_id
          and a.item_id = p_item_id
          and a.group_instance_id is not distinct from p_instance_id
      )
    )
  end;
$$;

create or replace function app.instance_is_empty(
  p_response_id uuid,
  p_instance_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  select not (
    exists (
      select 1 from public.answers a
      where a.response_id = p_response_id
        and a.group_instance_id = p_instance_id
        and a.value is not null
        and a.value <> 'null'::jsonb
    )
    or exists (
      select 1
      from public.answer_selected_options s
      join public.answers a on a.id = s.answer_id
      where a.response_id = p_response_id
        and a.group_instance_id = p_instance_id
    )
    -- FF-2 (ADR 0089 §A): a matrix answer is content. Without this arm
    -- submit_response prunes the instance and cascades the cells away.
    or exists (
      select 1
      from public.answer_matrix_cells c
      join public.answers a on a.id = c.answer_id
      where a.response_id = p_response_id
        and a.group_instance_id = p_instance_id
    )
    or exists (
      select 1
      from public.answer_risk_matrix rm
      join public.answers a on a.id = rm.answer_id
      where a.response_id = p_response_id
        and a.group_instance_id = p_instance_id
    )
    -- FF-5 (ADR 0091 ruling 6): the arm FF-2's body asked for by name. A
    -- reference is content; an instance holding only a reference must survive
    -- submit with its reference intact.
    or exists (
      select 1
      from public.answer_references ar
      join public.answers a on a.id = ar.answer_id
      where a.response_id = p_response_id
        and a.group_instance_id = p_instance_id
    )
  );
$$;
