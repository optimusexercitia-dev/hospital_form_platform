-- =============================================================================
-- F3 (ADR 0060 §2 "the one live feature" / Rec D / Rule 3) — Flexible-Forms
-- Foundation, part 3 of 3: dual-evaluator operator expansion (SQL side).
--
-- Adds contains / not_contains / is_empty / is_not_empty to app.eval_condition. The
-- TypeScript mirror (src/lib/queries/conditions.ts evalCondition) is changed in lockstep;
-- the two MUST agree byte-for-byte (Rule 3), enforced by the shared golden vectors
-- (src/lib/queries/__fixtures__/condition-vectors.json <-> supabase/tests/20_conditions.sql).
-- Drift is phase-blocking.
--
-- Pinned semantics (ADR 0060 Rec D):
--   * contains: membership-on-choice-array (answer @> [target]; same as array-aware equals)
--     vs substring-on-text (strpos > 0, case-sensitive, mirrors JS String.includes); every
--     other value type (number/date/time scalar, type mismatch) -> false. NO number->text
--     coercion (avoids "12 contains 2"). not_contains = NOT contains (mirrors not_equals).
--   * is_empty: true iff absent-key / null / '' / [] (identical both sides). UNARY — the
--     `value` field is ignored. is_not_empty = NOT is_empty.
--
-- NOT touched: the storage-side validators (assert_condition_op_target / is_valid_visibility /
-- validate_visible_when) — the new ops stay NON-AUTHORABLE in stored visible_when (the builder
-- picker can't emit them; full authoring UX defers to FF). The golden vectors call
-- app.eval_condition directly, so parity is proven without making the ops storable. visible_when
-- stays visibility-only. is_true/is_false are NOT added (no boolean answer type).
--
-- Forward-only CREATE OR REPLACE of the baseline authority (20260620000000_baseline.sql
-- L1865); the function stays IMMUTABLE + search_path 'pg_catalog' (all ops used —
-- strpos, jsonb operators, jsonb_typeof — live in pg_catalog).
-- =============================================================================

create or replace function app.eval_condition(p_visible_when jsonb, p_answers jsonb)
  returns boolean
  language plpgsql immutable
  set search_path to 'pg_catalog'
  as $$
declare
  v_key text;
  v_op text;
  v_target jsonb;
  v_answer jsonb;
  v_present boolean;
  v_match boolean;
  v_cmp integer;
  v_a_text text;
  v_b_text text;
  v_contains boolean;
  v_empty boolean;
begin
  if p_visible_when is null then
    return true;
  end if;

  v_key := p_visible_when ->> 'question_key';
  v_op := p_visible_when ->> 'op';
  v_target := p_visible_when -> 'value';

  v_present := (p_answers ? v_key);
  v_answer := p_answers -> v_key;

  if not v_present or v_answer is null or v_answer = 'null'::jsonb then
    v_match := false;
  elsif jsonb_typeof(v_answer) = 'array' then
    v_match := v_answer @> jsonb_build_array(v_target);
  else
    v_match := (v_answer = v_target);
  end if;

  if v_op = 'equals' then
    return v_match;
  elsif v_op = 'not_equals' then
    return not v_match;
  elsif v_op = 'in' then
    if not v_present or v_answer is null or jsonb_typeof(v_target) <> 'array' then
      return false;
    end if;
    if jsonb_typeof(v_answer) = 'array' then
      return exists (
        select 1
        from jsonb_array_elements(v_answer) sel
        where v_target @> jsonb_build_array(sel.value)
      );
    else
      return v_target @> jsonb_build_array(v_answer);
    end if;
  elsif v_op in ('contains','not_contains') then
    -- Rec D: membership on a choice array; substring on text; everything else false.
    if not v_present or v_answer is null or v_answer = 'null'::jsonb then
      v_contains := false;
    elsif jsonb_typeof(v_answer) = 'array' then
      v_contains := v_answer @> jsonb_build_array(v_target);
    elsif jsonb_typeof(v_answer) = 'string' and jsonb_typeof(v_target) = 'string' then
      v_contains := strpos(v_answer #>> '{}', v_target #>> '{}') > 0;
    else
      v_contains := false;
    end if;
    if v_op = 'contains' then
      return v_contains;
    else
      return not v_contains;
    end if;
  elsif v_op in ('gt','gte','lt','lte') then
    -- Ordered comparison: undefined (no order) -> false for every op.
    if not v_present or v_answer is null or v_answer = 'null'::jsonb
       or jsonb_typeof(v_answer) = 'array' or jsonb_typeof(v_target) = 'array'
       or jsonb_typeof(v_answer) = 'object' or jsonb_typeof(v_target) = 'object' then
      return false;
    end if;

    if jsonb_typeof(v_answer) = 'number' and jsonb_typeof(v_target) = 'number' then
      v_cmp := sign((v_answer)::text::numeric - (v_target)::text::numeric)::integer;
    else
      v_a_text := v_answer #>> '{}';
      v_b_text := v_target #>> '{}';
      if v_a_text < v_b_text then
        v_cmp := -1;
      elsif v_a_text > v_b_text then
        v_cmp := 1;
      else
        v_cmp := 0;
      end if;
    end if;

    if v_op = 'gt' then
      return v_cmp > 0;
    elsif v_op = 'gte' then
      return v_cmp >= 0;
    elsif v_op = 'lt' then
      return v_cmp < 0;
    else -- 'lte'
      return v_cmp <= 0;
    end if;
  elsif v_op in ('is_empty','is_not_empty') then
    -- Rec D: unary. Empty iff absent-key / JSON null / '' / [] (identical SQL<->TS). The
    -- `value` field is ignored. Only the exact empty string / empty array count as empty
    -- (no trimming; number 0 and [null] are NON-empty).
    v_empty := (not v_present)
            or v_answer is null
            or v_answer = 'null'::jsonb
            or v_answer = '""'::jsonb
            or v_answer = '[]'::jsonb;
    if v_op = 'is_empty' then
      return v_empty;
    else
      return not v_empty;
    end if;
  else
    raise exception 'unknown condition op: %', v_op;
  end if;
end;
$$;
