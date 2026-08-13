-- FF-3 (ADR 0090) — B3: `app.eval_validation`, the SQL half of the phase's
-- dual evaluator pair.
--
-- Mirrored byte-for-byte by `evalValidation` in src/lib/queries/validations.ts
-- (ARCHITECTURE Rule 3). The shared golden vectors live in
-- src/lib/queries/__fixtures__/validation-vectors.json and run against BOTH —
-- Vitest there, pgTAP in supabase/tests/274_ff3_validations.sql. Drift is
-- phase-blocking.
--
-- Deliberately PURE / IMMUTABLE. Everything a rule needs is an argument, which
-- is what lets the same vectors drive both sides with no fixture. The one rule
-- that is not locally decidable — `unique_within_group` — takes its
-- cross-instance peers as `p_peer_values` instead of reaching into the database;
-- the WALKER (app.response_validation_errors, B4) computes them.
--
-- TWO CONVENTIONS THAT ARE LOAD-BEARING:
--
-- 1. `p_value` is the value FROM THE ANSWER MAP IN SCOPE, never `answers.value`.
--    A choice item stores NULL in `answers.value` and keeps its payload in
--    `answer_selected_options`; `app.answer_map_scoped` already resolves that to
--    a code string (or an array of codes for a checkbox). Feeding the map value
--    makes scalars and choices one case, and gives `datetime_order` its
--    same-instance sibling for free (the map in scope IS the instance map).
--
-- 2. An EMPTY value always SATISFIES. Presence is the job of `required` /
--    `required_if`; a validation rule that also rejected emptiness would make
--    every optional field secretly mandatory. "Empty" is the SAME notion
--    `app.eval_condition`'s `is_empty` operator uses — absent / JSON null / `""`
--    / `[]` — so the platform has one definition of empty, not two.

begin;

create or replace function app.validation_value_is_empty(p_value jsonb)
returns boolean
language sql
immutable
set search_path to 'pg_catalog'
as $$
  select p_value is null
      or p_value = 'null'::jsonb
      or p_value = '""'::jsonb
      or p_value = '[]'::jsonb;
$$;

comment on function app.validation_value_is_empty(jsonb) is
  'FF-3: the ONE notion of empty, shared with app.eval_condition''s is_empty operator. '
  'An empty value satisfies every validation rule — presence belongs to required/required_if.';

create or replace function app.eval_validation(
  p_rule_type text,
  p_config jsonb,
  p_value jsonb,
  p_answers jsonb default '{}'::jsonb,
  p_peer_values jsonb default '[]'::jsonb
)
returns boolean
language plpgsql
immutable
set search_path to 'pg_catalog'
as $$
declare
  v_text text;
  v_len integer;
  v_sibling jsonb;
  v_op text;
  v_cmp integer;
begin
  -- Presence is not this evaluator's business (see header, convention 2).
  if app.validation_value_is_empty(p_value) then
    return true;
  end if;

  if p_rule_type = 'number_range' then
    -- A non-number value cannot violate a numeric range. The item type is the
    -- contract that makes this unreachable in practice (`number_range` only
    -- attaches to `number`); returning true rather than false keeps a corrupt
    -- value from being reported as a RANGE problem it is not.
    if jsonb_typeof(p_value) <> 'number' then
      return true;
    end if;
    if jsonb_typeof(p_config -> 'min') = 'number'
       and (p_value)::text::numeric < (p_config ->> 'min')::numeric then
      return false;
    end if;
    if jsonb_typeof(p_config -> 'max') = 'number'
       and (p_value)::text::numeric > (p_config ->> 'max')::numeric then
      return false;
    end if;
    return true;

  elsif p_rule_type = 'text_length' then
    if jsonb_typeof(p_value) <> 'string' then
      return true;
    end if;
    v_len := char_length(p_value #>> '{}');
    if jsonb_typeof(p_config -> 'min') = 'number'
       and v_len < (p_config ->> 'min')::integer then
      return false;
    end if;
    if jsonb_typeof(p_config -> 'max') = 'number'
       and v_len > (p_config ->> 'max')::integer then
      return false;
    end if;
    return true;

  elsif p_rule_type = 'regex' then
    if jsonb_typeof(p_value) <> 'string' then
      return true;
    end if;
    v_text := p_value #>> '{}';
    -- coalesce(..., false) = fail CLOSED. A NULL pattern would make `~` return
    -- NULL, and every caller tests `not eval_validation(...)`, where `not NULL`
    -- is NULL and the violation silently disappears. The config CHECK makes a
    -- NULL pattern unstorable, so this is the belt to that brace — but the same
    -- three-valued read already fooled app.validation_rule_allowed once in this
    -- phase, so no arm of this function is allowed to return NULL.
    if coalesce((p_config ->> 'caseInsensitive')::boolean, false) then
      return coalesce(v_text ~* (p_config ->> 'pattern'), false);
    end if;
    return coalesce(v_text ~ (p_config ->> 'pattern'), false);

  elsif p_rule_type = 'date_range' then
    -- ISO literals compare correctly as text — the same property
    -- `app.eval_condition` relies on for gt/gte/lt/lte over dates and times.
    if jsonb_typeof(p_value) <> 'string' then
      return true;
    end if;
    v_text := p_value #>> '{}';
    if jsonb_typeof(p_config -> 'min') = 'string'
       and v_text < (p_config ->> 'min') then
      return false;
    end if;
    if jsonb_typeof(p_config -> 'max') = 'string'
       and v_text > (p_config ->> 'max') then
      return false;
    end if;
    return true;

  elsif p_rule_type = 'datetime_order' then
    v_sibling := coalesce(p_answers, '{}'::jsonb) -> (p_config ->> 'question_key');
    -- Nothing to compare against: the rule is inert, not violated. The sibling
    -- being required is the sibling's own business.
    if app.validation_value_is_empty(v_sibling) then
      return true;
    end if;
    if jsonb_typeof(p_value) <> 'string' or jsonb_typeof(v_sibling) <> 'string' then
      return true;
    end if;
    v_op := p_config ->> 'op';
    v_cmp := case
      when (p_value #>> '{}') < (v_sibling #>> '{}') then -1
      when (p_value #>> '{}') > (v_sibling #>> '{}') then 1
      else 0
    end;
    if v_op = 'before' then
      return v_cmp < 0;
    elsif v_op = 'after' then
      return v_cmp > 0;
    elsif v_op = 'not_before' then
      return v_cmp >= 0;
    elsif v_op = 'not_after' then
      return v_cmp <= 0;
    else
      raise exception 'unknown datetime_order op: %', v_op;
    end if;

  elsif p_rule_type = 'unique_within_group' then
    -- Peers are the SAME child's value in every OTHER non-empty instance of its
    -- group. Exact jsonb equality, mirroring the TS `jsonEquals`.
    return not exists (
      select 1
      from jsonb_array_elements(coalesce(p_peer_values, '[]'::jsonb)) e
      where e.value = p_value
    );

  else
    -- Unreachable from a stored row (the rule_type allowlist CHECK pins the
    -- vocabulary). Raising rather than returning true mirrors
    -- `app.eval_condition`'s unknown-op arm: an unknown rule must never
    -- degrade to "no rule", which is the silent-failure shape the allowlist
    -- exists to prevent.
    raise exception 'unknown validation rule_type: %', p_rule_type;
  end if;
end;
$$;

comment on function app.eval_validation(text, jsonb, jsonb, jsonb, jsonb) is
  'FF-3 (ADR 0090): does the value SATISFY the rule? true = no violation. '
  'PURE — p_value is the answer-map value in scope, p_peer_values carries the '
  'cross-instance peers for unique_within_group. TS mirror: evalValidation in '
  'src/lib/queries/validations.ts, locked by __fixtures__/validation-vectors.json.';

commit;
