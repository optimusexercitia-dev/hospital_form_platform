-- Form Builder Enhancements (QA MAJOR-1 safety net) — publish-time guard that a
-- NUMBER condition carries a NUMERIC value.
-- ----------------------------------------------------------------------------
-- app.assert_condition_op_target already validates operator<->target-TYPE. It
-- did NOT validate the value's JSON type, so a condition targeting a `number`
-- question with a STRING value (e.g. the builder emitting "5" instead of 5)
-- published silently and then mis-compared lexically at eval time
-- (orderedCompare falls back to text when the operands aren't both JSON numbers).
--
-- This adds the value-type check: for a `number` target, the scalar ops
-- (equals/not_equals/gt/gte/lt/lte) require `jsonb_typeof(value) = 'number'`.
-- `in` is already rejected against a number target (it is choice-only), so the
-- only ops that reach the new check are the scalar ones. date/time stay TEXT
-- (ISO strings) and choice targets are unchanged.
--
-- Additive: only the helper is replaced; validate_visible_when calls it
-- unchanged. This is the safety net behind the FE fix (the builder now emits
-- JSON numbers); a string-valued number condition can no longer ship.
-- ----------------------------------------------------------------------------

set search_path = public, pg_catalog;

create or replace function app.assert_condition_op_target(
  p_op text, p_target_type text, p_value jsonb, p_context text
)
returns void
language plpgsql
immutable
set search_path = pg_catalog
as $$
begin
  if p_op = 'in' then
    if p_target_type is null
       or p_target_type <> all (array['multiple_choice','dropdown','checkbox']) then
      raise exception
        '% usa o operador "está em", que exige uma pergunta de múltipla escolha',
        p_context
        using errcode = 'check_violation';
    end if;
    if p_value is null or jsonb_typeof(p_value) <> 'array' then
      raise exception
        '% usa o operador "está em" com um valor inválido (esperada uma lista)',
        p_context
        using errcode = 'check_violation';
    end if;
  elsif p_op in ('gt','gte','lt','lte') then
    if p_target_type is null
       or p_target_type <> all (array['number','date','time']) then
      raise exception
        '% usa um operador de comparação, que exige uma pergunta de número, data ou hora',
        p_context
        using errcode = 'check_violation';
    end if;
  end if;

  -- Value-TYPE guard for NUMBER targets (QA MAJOR-1 safety net): the scalar ops
  -- (equals/not_equals/gt/gte/lt/lte — everything except the choice-only `in`)
  -- must carry a JSON number, else the eval-time comparison silently falls back
  -- to a lexical text compare.
  if p_target_type = 'number' and p_op <> 'in' then
    if p_value is null or jsonb_typeof(p_value) <> 'number' then
      raise exception
        '% é uma condição numérica e exige um valor numérico',
        p_context
        using errcode = 'check_violation';
    end if;
  end if;
  -- equals / not_equals on choice/date/time targets: value stays as-is.
end;
$$;

alter function app.assert_condition_op_target(text, text, jsonb, text) owner to postgres;
