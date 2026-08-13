-- FF-3 (ADR 0090) — B5: operator AUTHORABILITY.
--
-- `app.eval_condition` has implemented `contains`, `not_contains`, `is_empty` and
-- `is_not_empty` since F3 (ADR 0060 Rec D) and the golden vectors have covered
-- them since. `app.is_valid_condition` — the gate every `visible_when` /
-- `required_if` CHECK runs through — refused to STORE them, so they were
-- evaluator vocabulary an author could never reach.
--
-- This widens the gate ONLY. Evaluation semantics are untouched, so stored
-- published conditions are unaffected: this migration can add no behaviour to any
-- row that exists today, because no row could have contained one of these
-- operators.
--
-- `is_empty` / `is_not_empty` are UNARY — `app.eval_condition` ignores their
-- `value` entirely. The `p ? 'value'` requirement is therefore relaxed for
-- exactly those two, and for nothing else: an author who omits `value` on an
-- `equals` is still refused.

begin;

create or replace function app.is_valid_condition(p jsonb)
returns boolean
language sql
immutable
set search_path to 'pg_catalog'
as $$
  select p is not null
     and jsonb_typeof(p) = 'object'
     and (p ? 'question_key')
     and (p ? 'op')
     and jsonb_typeof(p -> 'question_key') = 'string'
     and (p ->> 'op') = any (array[
       'equals','not_equals','in','gt','gte','lt','lte',
       -- FF-3: the four F3 operators become authorable.
       'contains','not_contains','is_empty','is_not_empty'
     ])
     -- `value` stays REQUIRED for every operator that reads one. The two unary
     -- operators are exempted by name rather than by "value is optional now",
     -- which would have silently accepted `{"op":"equals"}`.
     and ((p ->> 'op') in ('is_empty','is_not_empty') or (p ? 'value'));
$$;

comment on function app.is_valid_condition(jsonb) is
  'The AUTHORABILITY gate for a single condition (visible_when, required_if). FF-3 '
  'widened it to the four F3 operators app.eval_condition already implements; '
  'is_empty/is_not_empty are unary and exempt from the `value` requirement. '
  'Evaluation semantics live in app.eval_condition and were NOT touched.';

commit;
