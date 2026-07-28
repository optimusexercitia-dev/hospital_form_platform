-- FF-3 (ADR 0090) — B1: the validation-engine SCHEMA wave.
--
-- Pins the `rule_type` vocabulary, the (rule_type x item_type) coverage matrix,
-- and the per-rule `config` shape; adds `form_items.required_if`; seeds the
-- `item_validations` flag OFF.
--
-- `form_item_validations` has existed since F3 (2026-07-12) and has never been
-- written to. Its `rule_type` was `not blank` and nothing more, which is exactly
-- the shape that lets a TYPO evaluate to "no rule" — an author writes
-- `number_rang`, the row stores, the evaluator has no arm for it, and the field
-- is silently unvalidated. Every other vocabulary in this schema (`severity`,
-- `item_type`) is pinned by an allowlist; this one now is too.
--
-- ⚠ COVERAGE CANNOT BE A CHECK CONSTRAINT. A CHECK may not subquery, and
-- coverage is a statement about the JOINED `form_items` row (`item_type`, and
-- for `unique_within_group` the PARENT's type). It is therefore a trigger — the
-- same mechanism FF-2 used for matrix cross-item coherence.

begin;

-- ---------------------------------------------------------------------------
-- 1 · The coverage predicate (ADR 0090 ruling 2), mirrored in TS as
--     `isValidationRuleAllowed` in src/lib/queries/validations.ts.
-- ---------------------------------------------------------------------------

create or replace function app.validation_rule_allowed(
  p_rule_type text,
  p_item_type text,
  p_parent_item_type text
)
returns boolean
language sql
immutable
set search_path to 'pg_catalog'
as $$
  -- ⚠ THE OUTER `coalesce(..., false)` IS LOAD-BEARING, and it is here because
  -- the version without it FAILED OPEN on the very first keystone run.
  --
  -- A top-level item has `p_parent_item_type = NULL`, so the
  -- `unique_within_group` arm evaluated to `NULL and true` = NULL — not false.
  -- Every caller then wrote `if not app.validation_rule_allowed(...)`, and
  -- `not NULL` is NULL, so the `if` never fired and the forbidden pair was
  -- ACCEPTED. Same family as FF-2 defect 1: a three-valued predicate read as if
  -- it were two-valued. A coverage predicate must be total.
  select coalesce(
    case p_rule_type
      when 'number_range' then p_item_type = 'number'
      when 'text_length'  then p_item_type in ('short_text', 'free_text')
      when 'regex'        then p_item_type in ('short_text', 'free_text')
      when 'date_range'   then p_item_type in ('date', 'time')
      when 'datetime_order' then p_item_type in ('date', 'time')
      -- Any SCALAR child of a repeating group. The parent clause is the second
      -- half of this rule's coverage: "unique across the instances of its group"
      -- is meaningless for an item that has no instances.
      when 'unique_within_group' then
        p_parent_item_type is not null
        and p_parent_item_type = 'repeating_group'
        and p_item_type in (
          'short_text', 'free_text', 'number', 'date', 'time',
          'multiple_choice', 'dropdown'
        )
      else false
    end,
    false
  );
$$;

comment on function app.validation_rule_allowed(text, text, text) is
  'FF-3 (ADR 0090 ruling 2): may this rule_type attach to this item_type? '
  'Containers, display items, matrix/risk_matrix and reference carry no rules in v1. '
  'TS mirror: isValidationRuleAllowed in src/lib/queries/validations.ts.';

-- ---------------------------------------------------------------------------
-- 2 · The per-rule `config` shape validator.
--
--     `coalesce(jsonb_typeof(x -> 'k'), 'missing')` THROUGHOUT, and the reason
--     is a defect this repo already paid for (FF-2 defect 1): `x -> 'absent'`
--     is SQL NULL, `jsonb_typeof(NULL)` is NULL, so `jsonb_typeof(x -> 'k') <>
--     'number'` evaluates to NULL — never TRUE. Such a guard rejects a value of
--     the WRONG TYPE and waves through a value that is ABSENT, which is the case
--     it exists for. Every type test below resolves the missing case explicitly.
-- ---------------------------------------------------------------------------

create or replace function app.is_valid_validation_config(
  p_rule_type text,
  p_config jsonb
)
returns boolean
language sql
immutable
set search_path to 'pg_catalog'
as $$
  select case
    when p_config is null or jsonb_typeof(p_config) <> 'object' then false

    when p_rule_type = 'number_range' then (
      -- Bounds are optional individually but at least one is required: a range
      -- with neither bound is a rule that can never fire.
      (p_config ? 'min' or p_config ? 'max')
      and (not (p_config ? 'min') or jsonb_typeof(p_config -> 'min') = 'number')
      and (not (p_config ? 'max') or jsonb_typeof(p_config -> 'max') = 'number')
      and (
        not (p_config ? 'min' and p_config ? 'max')
        or (p_config ->> 'min')::numeric <= (p_config ->> 'max')::numeric
      )
    )

    when p_rule_type = 'text_length' then (
      (p_config ? 'min' or p_config ? 'max')
      and (not (p_config ? 'min') or (
        jsonb_typeof(p_config -> 'min') = 'number'
        and (p_config ->> 'min')::numeric >= 0
        and (p_config ->> 'min')::numeric = trunc((p_config ->> 'min')::numeric)
      ))
      and (not (p_config ? 'max') or (
        jsonb_typeof(p_config -> 'max') = 'number'
        and (p_config ->> 'max')::numeric >= 0
        and (p_config ->> 'max')::numeric = trunc((p_config ->> 'max')::numeric)
      ))
      and (
        not (p_config ? 'min' and p_config ? 'max')
        or (p_config ->> 'min')::numeric <= (p_config ->> 'max')::numeric
      )
    )

    when p_rule_type = 'regex' then (
      coalesce(jsonb_typeof(p_config -> 'pattern'), 'missing') = 'string'
      and btrim(coalesce(p_config ->> 'pattern', '')) <> ''
      -- ReDoS blast-radius bound (ADR 0090 ruling 1, consequence). The author is
      -- a staff_admin acting inside their own commission, so the exposure is
      -- their own fillers; the cap plus statement_timeout bounds it.
      and char_length(p_config ->> 'pattern') <= 200
      and (
        not (p_config ? 'caseInsensitive')
        or jsonb_typeof(p_config -> 'caseInsensitive') = 'boolean'
      )
    )

    when p_rule_type = 'date_range' then (
      (p_config ? 'min' or p_config ? 'max')
      and (not (p_config ? 'min') or (
        jsonb_typeof(p_config -> 'min') = 'string'
        and btrim(p_config ->> 'min') <> ''
      ))
      and (not (p_config ? 'max') or (
        jsonb_typeof(p_config -> 'max') = 'string'
        and btrim(p_config ->> 'max') <> ''
      ))
      -- ISO literals sort correctly as text — the same property `eval_condition`
      -- relies on for gt/gte/lt/lte over dates and times.
      and (
        not (p_config ? 'min' and p_config ? 'max')
        or (p_config ->> 'min') <= (p_config ->> 'max')
      )
    )

    when p_rule_type = 'datetime_order' then (
      coalesce(jsonb_typeof(p_config -> 'op'), 'missing') = 'string'
      and (p_config ->> 'op') in ('before', 'after', 'not_before', 'not_after')
      and coalesce(jsonb_typeof(p_config -> 'question_key'), 'missing') = 'string'
      and btrim(coalesce(p_config ->> 'question_key', '')) <> ''
    )

    -- Takes no configuration. Accept only the empty object, so a stray key can
    -- never read as configuration that is silently ignored.
    when p_rule_type = 'unique_within_group' then p_config = '{}'::jsonb

    else false
  end;
$$;

comment on function app.is_valid_validation_config(text, jsonb) is
  'FF-3 (ADR 0090): per-rule_type shape of form_item_validations.config. '
  'Every key test resolves the ABSENT case explicitly (coalesce(jsonb_typeof(..),''missing'')) '
  '— the FF-2 defect-1 fail-open shape.';

-- ---------------------------------------------------------------------------
-- 3 · The `rule_type` allowlist + a non-blank `message`.
--
--     `message` is REQUIRED (non-blank). A validation with no message is a dead
--     end for the filler, and requiring it means the SQL and TS evaluators never
--     have to agree on a GENERATED string — one fewer parity surface on the
--     phase whose parity surface is already the largest.
-- ---------------------------------------------------------------------------

alter table public.form_item_validations
  add constraint form_item_validations_rule_type_allowed
  check (rule_type = any (array[
    'number_range',
    'text_length',
    'regex',
    'date_range',
    'datetime_order',
    'unique_within_group'
  ]));

alter table public.form_item_validations
  add constraint form_item_validations_message_present
  check (message is not null and btrim(message) <> '');

alter table public.form_item_validations
  add constraint form_item_validations_config_valid
  check (app.is_valid_validation_config(rule_type, config));

create index if not exists form_item_validations_item_id_idx
  on public.form_item_validations (item_id, position);

create index if not exists form_item_validations_version_idx
  on public.form_item_validations (form_version_id);

-- ---------------------------------------------------------------------------
-- 4 · Coverage + version-coherence trigger.
-- ---------------------------------------------------------------------------

create or replace function app.guard_item_validation_row()
returns trigger
language plpgsql
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_item_type text;
  v_item_version uuid;
  v_parent_type text;
  v_probe boolean;
begin
  select i.item_type, i.form_version_id, p.item_type
    into v_item_type, v_item_version, v_parent_type
  from public.form_items i
  left join public.form_items p on p.id = i.parent_item_id
  where i.id = new.item_id;

  if v_item_type is null then
    raise exception 'pergunta % não encontrada', new.item_id
      using errcode = 'HC0Q1';
  end if;

  -- Coherence: the rule's denormalized version must be the item's own. Without
  -- this, a rule could be filed against a version its item does not belong to
  -- and would be invisible to every version-scoped read.
  if new.form_version_id <> v_item_version then
    raise exception 'a validação não pertence à mesma versão da pergunta'
      using errcode = 'HC0Q1';
  end if;

  if not app.validation_rule_allowed(new.rule_type, v_item_type, v_parent_type) then
    raise exception 'a pergunta do tipo "%" não aceita a validação "%"',
      v_item_type, new.rule_type
      using errcode = 'HC0Q1';
  end if;

  -- A pattern that does not COMPILE would raise at evaluation time, inside
  -- submit_response, as a raw Postgres error — after the author has published.
  -- Reject it at write time instead. (The shape CHECK has already established
  -- that `pattern` is a non-blank string of bounded length.)
  if new.rule_type = 'regex' then
    begin
      select ('x' ~ (new.config ->> 'pattern')) into v_probe;
    exception when others then
      raise exception 'a expressão regular da validação é inválida'
        using errcode = 'HC0Q2';
    end;
  end if;

  return new;
end;
$$;

create trigger guard_item_validation_row_trg
  before insert or update on public.form_item_validations
  for each row execute function app.guard_item_validation_row();

-- Rule 5 parity with the `form_item_options` sibling: a published version's
-- structure is frozen at the TABLE, not only inside the writer. `form_items`,
-- `form_sections`, `form_versions` and `form_item_options` all carry this guard;
-- `form_item_validations` did not, because it had no writer.
create trigger guard_published_validations_trg
  before insert or delete or update on public.form_item_validations
  for each row execute function public.guard_published_structure();

-- The other direction: an item's TYPE (or its container) changing out from
-- under an existing rule. `updateItem` never writes `item_type`, but
-- `authenticated` holds full DML on `form_items` (unlike form_item_validations),
-- so a staff_admin could do it directly through PostgREST and orphan a rule into
-- a pair the coverage trigger would have refused.
create or replace function app.guard_item_type_vs_validations()
returns trigger
language plpgsql
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_parent_type text;
  v_bad text;
begin
  if new.item_type is not distinct from old.item_type
     and new.parent_item_id is not distinct from old.parent_item_id then
    return new;
  end if;

  select p.item_type into v_parent_type
  from public.form_items p where p.id = new.parent_item_id;

  select v.rule_type into v_bad
  from public.form_item_validations v
  where v.item_id = new.id
    and not app.validation_rule_allowed(v.rule_type, new.item_type, v_parent_type)
  limit 1;

  if v_bad is not null then
    raise exception 'a pergunta tem a validação "%", incompatível com o tipo "%"',
      v_bad, new.item_type
      using errcode = 'HC0Q1';
  end if;

  return new;
end;
$$;

create trigger guard_item_type_vs_validations_trg
  before update of item_type, parent_item_id on public.form_items
  for each row execute function app.guard_item_type_vs_validations();

-- ---------------------------------------------------------------------------
-- 5 · `form_items.required_if` (ADR 0090 ruling 4).
--
--     A SINGLE condition, validated by `app.is_valid_condition` — NOT the
--     `{match, conditions[]}` group shape `visible_when` accepts. The evaluation
--     side uses `app.eval_visibility`, which delegates to `app.eval_condition`
--     for the single shape, so widening this CHECK later needs no evaluator
--     change.
-- ---------------------------------------------------------------------------

alter table public.form_items
  add column if not exists required_if jsonb;

alter table public.form_items
  add constraint form_items_required_if_shape
  check (required_if is null or app.is_valid_condition(required_if));

comment on column public.form_items.required_if is
  'FF-3 (ADR 0090 ruling 4): a single condition making this item required when it '
  'evaluates true against the map IN SCOPE (top-level, or instance_answer_map inside '
  'a repeating group). VISIBILITY WINS UNCONDITIONALLY — a hidden item is never '
  'required, whatever this says.';

-- The `input_vs_display` arm. Containers and display items cannot be required at
-- all (`required = false` is pinned for them), so a conditional requirement is
-- meaningless there. `reference` is included because FF-2 pinned `required =
-- false` for it until FF-5 rules on it — allowing `required_if` would be a back
-- door around that pin.
alter table public.form_items drop constraint form_items_input_vs_display;
alter table public.form_items add constraint form_items_input_vs_display check (
  case
    when item_type = any (array[
      'multiple_choice', 'dropdown', 'checkbox', 'free_text',
      'short_text', 'number', 'date', 'time'
    ]) then question_key is not null and label is not null and content is null
    when item_type = any (array['matrix', 'risk_matrix'])
      then question_key is not null and label is not null and content is null
    when item_type = 'reference'
      then question_key is not null and label is not null and content is null
       and required = false and required_if is null
    when item_type = any (array['group', 'repeating_group'])
      then content is null and required = false and question_key is null
       and label is not null and default_value is null and required_if is null
    when item_type = any (array['section_text', 'image'])
      then content is not null and question_key is null and label is null
       and question_explanation is null and required = false
       and required_if is null
    else false
  end
);

-- ---------------------------------------------------------------------------
-- 6 · The feature flag — seeded OFF. The gate flip is its own migration
--     (`*_enable_item_validations.sql`), authored at the FF-3 gate.
-- ---------------------------------------------------------------------------

insert into app.feature_flags (key, enabled, description)
values (
  'item_validations',
  false,
  'FF-3 (ADR 0090): per-item validation rules (six rule types) + required_if.'
)
on conflict (key) do nothing;

commit;
