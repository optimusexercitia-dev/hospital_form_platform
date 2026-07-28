-- FF-3 (ADR 0090 ruling 5) — B5 DEFECT: the unary operators were made STORABLE
-- but left UNPUBLISHABLE.
--
-- `20260901000500` widened `app.is_valid_condition` — the CHECK deciding what an
-- author may SAVE — to `contains` / `not_contains` / `is_empty` / `is_not_empty`,
-- and relaxed the `value` requirement for the two unary ops. It did NOT touch the
-- two publish-time assertions `public.validate_visible_when` runs over every
-- condition, both of which predate the unary ops and assume every operator
-- carries a meaningful `value`:
--
--   · `app.assert_condition_op_target` — for a NUMBER target it requires
--     `jsonb_typeof(p_value) = 'number'` for every op except `in`. A unary op has
--     no number to give, so `is_empty` on a number question raised
--     "é uma condição numérica e exige um valor numérico".
--   · `app.assert_condition_value_codes` — for a CHOICE target it normalizes the
--     value into candidate codes and requires each to exist. Both spellings of
--     "no value" (JSON null and SQL NULL) collapse to a NULL candidate, so
--     `is_empty` on a choice question raised 'referencia a opção "nula", que não
--     existe nesta pergunta' — naming an option the author never wrote and cannot
--     go and fix.
--
-- The author's experience: build "quando Alergias estiver vazio", save the draft
-- fine, then fail PUBLISH with a nonsense message after the form is fully built.
-- It fails CLOSED so nothing is corrupted, but it is a dead end — and it lands on
-- the pairing with the most authoring value, since `is_empty` on a choice question
-- is the natural way to say "required only if they picked nothing".
--
-- This is the door-parity rule pointed downstream: a WIDENED door must also be
-- inherited by the arms BEHIND it. FF-2 was bitten by a DEFINER gate stricter than
-- the RLS it replaced; this is the same mistake one layer along — storage widened,
-- publish left narrow. Reported by `frontend`, reproduced against the live catalog
-- before this fix was written.
--
-- Both fixes are EXEMPT-BY-NAME early returns, deliberately not "the value is
-- optional now" — the latter would also wave through `{"op":"equals"}` with no
-- value, exactly what `is_valid_condition`'s own comment refuses to do.
--
-- ⚠ `app.assert_condition_value_codes` GAINS A REQUIRED `p_op` PARAMETER, and the
-- requiredness is the point. It has THREE callers (`validate_visible_when` plus
-- the two Phase-7 template validators) and the decision genuinely depends on the
-- operator, so the knowledge belongs in the function, not copied into each caller
-- where the next one forgets it. A DEFAULTED parameter would let a caller silently
-- keep the old behaviour — the `declared-param-no-caller` shape this repo has been
-- bitten by three times. Required means an un-updated caller fails loudly. All
-- three are wired below, in this transaction.

begin;

-- ---------------------------------------------------------------------------
-- 1 · op/target coherence — exempt the unary ops before every value guard.
-- ---------------------------------------------------------------------------

create or replace function app.assert_condition_op_target(
  p_op text,
  p_target_type text,
  p_value jsonb,
  p_context text
)
returns void
language plpgsql
immutable
set search_path to 'pg_catalog'
as $$
begin
  -- FF-3: the UNARY operators take no value on ANY target type —
  -- `app.eval_condition` ignores `value` for them entirely. Exempted by name,
  -- ahead of every value guard below, never by loosening those guards.
  if p_op in ('is_empty', 'is_not_empty') then
    return;
  end if;

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

-- ---------------------------------------------------------------------------
-- 2 · option-code existence — same exemption, via a REQUIRED p_op.
-- ---------------------------------------------------------------------------

drop function if exists app.assert_condition_value_codes(uuid, text, text, jsonb, text);

create function app.assert_condition_value_codes(
  p_version_id uuid,
  p_question_key text,
  p_target_type text,
  p_value jsonb,
  p_context text,
  p_op text
)
returns void
language plpgsql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_code text;
begin
  -- FF-3: a unary operator references NO option code. Without this the value —
  -- JSON null or SQL NULL, both — normalized to one NULL candidate and the loop
  -- raised 'referencia a opção "nula"'.
  if p_op in ('is_empty', 'is_not_empty') then
    return;
  end if;

  -- Only choice targets carry codes; others compare a scalar/bound.
  if p_target_type is null
     or p_target_type <> all (array['multiple_choice','dropdown','checkbox']) then
    return;
  end if;

  -- Normalize the value to an array of candidate codes (scalar -> 1-element).
  for v_code in
    select e #>> '{}'
    from jsonb_array_elements(
           case when jsonb_typeof(p_value) = 'array'
                then p_value else jsonb_build_array(p_value) end
         ) e
  loop
    if v_code is null or not app.version_has_option_code(p_version_id, p_question_key, v_code) then
      raise exception
        '% referencia a opção "%", que não existe nesta pergunta',
        p_context, coalesce(v_code, 'nula')
        using errcode = 'check_violation';
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3 · Wire ALL THREE callers, here, in this transaction.
--
--     Surgical body rewrites rather than 300 lines of copied definition: the two
--     template validators are Phase-7 code FF-3 has no business restating, and a
--     restatement is a chance to change something by accident. Each rewrite
--     ASSERTS it matched — a silent no-op replace would leave a caller on the
--     dropped 5-argument signature, which now fails at runtime rather than
--     quietly keeping the old behaviour.
-- ---------------------------------------------------------------------------

do $wire$
declare
  d text;
  d2 text;
begin
  -- 3a · public.validate_visible_when — TWO call sites, and the second one is the
  --      whole reason this block asserts per-site instead of per-function.
  --      The SECTION loop and the ITEM loop each call the helper; they do not
  --      share a call text (the section loop inlines its `format(...)` context,
  --      the item loop passes `v_ctx`). A first cut rewrote only the item site,
  --      and because plpgsql resolves function calls at EXECUTION time, nothing
  --      failed at migration — it failed the first time anyone published a form
  --      with a SECTION condition, with a raw 42883 and no pt-BR mapping. Both
  --      sites have `v_op` in scope; both are rewritten, and both are asserted.
  select pg_get_functiondef(oid) into d
  from pg_proc where oid = 'public.validate_visible_when(uuid)'::regprocedure;

  -- the SECTION loop
  d2 := replace(
    d,
    'p_form_version_id, v_ref_key, v_target_type, rc.cond -> ''value'',
        format(''a condição da seção "%s"'', coalesce(r.title, ''(padrão)''))',
    'p_form_version_id, v_ref_key, v_target_type, rc.cond -> ''value'',
        format(''a condição da seção "%s"'', coalesce(r.title, ''(padrão)'')), v_op'
  );
  if d2 = d then
    raise exception 'FF-3 wiring: validate_visible_when SECTION call site did not match';
  end if;
  d := d2;

  -- the ITEM loop
  d2 := replace(
    d,
    'p_form_version_id, v_ref_key, v_target_type, rc.cond -> ''value'', v_ctx
      );',
    'p_form_version_id, v_ref_key, v_target_type, rc.cond -> ''value'', v_ctx, v_op
      );'
  );
  if d2 = d then
    raise exception 'FF-3 wiring: validate_visible_when ITEM call site did not match';
  end if;
  execute d2;

  -- 3b · app.validate_template_recommend_when — the condition object is `rc`.
  select pg_get_functiondef(p.oid) into d
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'app' and p.proname = 'validate_template_recommend_when';
  d2 := replace(
    d,
    'format(''a recomendação da fase %s'', p_position)
      );',
    'format(''a recomendação da fase %s'', p_position), rc ->> ''op''
      );'
  );
  if d2 = d then
    raise exception 'FF-3 wiring: validate_template_recommend_when call site did not match';
  end if;
  execute d2;

  -- 3c · app.validate_template_result_ruleset — the condition is `r_rule->'when'`.
  select pg_get_functiondef(p.oid) into d
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'app' and p.proname = 'validate_template_result_ruleset';
  d2 := replace(
    d,
    'format(''o resultado da fase %s'', p_position)
    );',
    'format(''o resultado da fase %s'', p_position), r_rule -> ''when'' ->> ''op''
    );'
  );
  if d2 = d then
    raise exception 'FF-3 wiring: validate_template_result_ruleset call site did not match';
  end if;
  execute d2;
end
$wire$;

-- Belt: every CALL SITE must pass the operator.
--
-- The first version of this check counted FUNCTIONS that mention the helper and
-- found the expected 3 — while one of those functions still held a 5-argument
-- call. Counting callers cannot see a caller that calls twice, which is exactly
-- the shape that shipped. This counts SITES and inspects each one's arguments.
do $check$
declare
  r record;
  m text;
  v_sites int := 0;
begin
  for r in
    select n.nspname || '.' || p.proname as fn, p.prosrc as src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('app','public')
      and p.proname <> 'assert_condition_value_codes'
      and p.prosrc like '%assert_condition_value_codes%'
  loop
    for m in
      select (regexp_matches(r.src, 'assert_condition_value_codes\s*\(([^;]{0,200})', 'g'))[1]
    loop
      v_sites := v_sites + 1;
      -- (200, not 300: Postgres ARE caps a bounded repetition at 255.)
      -- Every rewritten site ends in an operator expression: `v_op`, `rc ->> 'op'`
      -- or `r_rule -> 'when' ->> 'op'`. A 5-argument site has none of them.
      if m !~ '\yv_op\y' and m !~ '''op''' then
        raise exception
          'FF-3 wiring: % still has a call to assert_condition_value_codes with no operator argument: %',
          r.fn, left(m, 160);
      end if;
    end loop;
  end loop;

  if v_sites < 4 then
    raise exception 'FF-3 wiring: expected at least 4 call sites, found %', v_sites;
  end if;
end
$check$;

commit;
