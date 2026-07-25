-- Case Correction Lifecycle — INFO-1 follow-up: defensive completed-filter parity.
--
-- QA finding INFO-1 (docs/reviews/case-corrections-review.md): app.case_phase_answer_map
-- resolves the phase's current revision only while the phase is `completed` (a voided /
-- non-completed phase yields an empty map), but its sibling
-- app.case_phase_option_aggregates resolved current_response_id with NO status filter.
-- On a voided phase it would therefore still report the retained pointer's old
-- score / flagged counts.
--
-- LATENT ONLY today: the sole caller, app.compute_case_phase_result, is invoked only
-- when the phase is `completed` — sync_case_phase_on_submit sets `completed` in the same
-- UPDATE immediately before the call; set_case_phase_result_override calls it only in its
-- `completed` branch; approve_correction's void arm does not call it at all, and its
-- correction/addendum arm re-points + computes on a phase that is necessarily already
-- `completed`. So there is no live double-count or leak. This adds the
-- `status = 'completed'` guard so the two readers have IDENTICAL pointer/status
-- resolution — future-proofing against a NEW caller reading a stale aggregate off a
-- voided phase, and making compute's own two inputs (answer_map + option_aggregates)
-- consistent (today, on a hypothetical non-completed phase, answer_map returns `{}` while
-- the injected __total_score__ / __flagged_count__ carried the stale values).
--
-- Body authored from the LIVE local catalog (pg_get_functiondef), not migration file
-- text (stale by design — CLAUDE.md graphify exception / ADR 0078 A28). The ONLY change
-- vs the live body is the added `and cp.status = 'completed'` line in the `resp` CTE.

create or replace function app.case_phase_option_aggregates(p_case_phase_id uuid)
returns table(total_score numeric, flagged_options integer)
language sql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
  with resp as (
    -- The phase's CURRENT revision (BE-2): the pointer, and only while completed —
    -- now mirrors app.case_phase_answer_map (INFO-1). A voided / non-completed phase
    -- yields no rows → zero aggregates.
    select cp.current_response_id as id
    from public.case_phases cp
    where cp.id = p_case_phase_id
      and cp.status = 'completed'
      and cp.current_response_id is not null
  ),
  sel as (
    select o.score, o.flagged
    from public.answer_selected_options s
    join public.answers a on a.id = s.answer_id
    join resp on resp.id = a.response_id
    join public.form_items i on i.id = a.item_id
    join public.form_item_options o on o.id = s.option_id
    where i.item_type = any (array['multiple_choice','dropdown','checkbox'])
  )
  select
    coalesce(sum(coalesce(score, 0)), 0)::numeric as total_score,
    coalesce(count(*) filter (where flagged), 0)::int as flagged_options
  from sel;
$function$;
