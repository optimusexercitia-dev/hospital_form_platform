-- FF-1 · BE-1 — Repeating Groups: schema, container shape, depth-1 cap, layout gate.
-- ADR 0087 (+ Amendment 1) · docs/plans/flexible-forms-program.md §3 (FF-1).
--
-- Wave 1 of 6. Everything here is structural and dark behind `repeating_groups`
-- (seeded OFF; flipped by 20260828000900 at the FF-1 gate).
--
-- WHAT THIS MIGRATION DECIDES, and why each is a CONSTRAINT and not a convention:
--
--  (a) ruling 4 — `form_items_conditional_not_required` is DROPPED PLATFORM-WIDE.
--      `app.response_required_complete` already carries the "a per-item condition
--      can hide a required item; honour it" branch, and that branch has been
--      UNREACHABLE DEAD CODE for as long as the CHECK existed. FF-1 must prove
--      exactly that path for group children ("se tipo = medicação, nome do
--      medicamento é obrigatório"), so proving it only there would ship a builder
--      that offers *obrigatório* beside a condition in one place and refuses it in
--      another. This is a WIDENING: BE-5's deadlock-negative keystones are what
--      make it safe, and they are mutation-proven (restore this CHECK and
--      `conditional_required_honoured` can no longer even be constructed).
--
--  (b) container shape — a `group`/`repeating_group` now REQUIRES
--      `question_key IS NULL` (+ `label NOT NULL`, `default_value NULL`).
--      A container collects no answer, so giving it a key would put it in the way
--      of every key-driven path: `app.answer_map`, the dashboards' explode, the
--      condition-target resolution in `validate_visible_when`, and
--      `submit_response`'s `question_key is not null` item filter. Pinning the key
--      to NULL makes containers structurally invisible to all of them at once,
--      instead of each path defensively remembering to skip a type. Same
--      protection display items already get. A TIGHTENING, free today (zero
--      container rows).
--
--  (c) ruling 1 — depth is capped at 1, DECLARATIVELY (no trigger):
--        · `is_container` / `parent_is_container` generated columns,
--        · the self-FK RE-CUT (same name) to (parent_item_id, form_version_id,
--          parent_is_container) → (id, form_version_id, is_container), which pins
--          "parent exists" ∧ "parent IS a container" ∧ "same version" in one object,
--        · `form_items_no_nested_container` CHECK for "child is NOT a container".
--      Two SEPARATE objects for two SEPARATE facts, deliberately: either one alone
--      would let the other's keystone pass vacuously (ADR 0079). Declarative beats
--      a trigger here because it survives `session_replication_role = replica` and
--      needs no "is the trigger still enabled" proof of its own.
--      NOTE: exactly ONE self-FK still exists on form_items, and it keeps its
--      original NAME — a second self-relationship would make PostgREST self-embeds
--      ambiguous (PGRST201, the scar that broke `listHospitalsForOrg`).
--
--  (d) collision-free reorder — `response_group_instances_parent_position_uniq`
--      becomes DEFERRABLE INITIALLY IMMEDIATE, exactly as
--      `form_items_section_id_position_key` already is. Semantics are unchanged
--      outside an explicit `set constraints … deferred` (BE-3's reorder). Verified
--      safe: the only writers today are two DELETEs (`submit_response`,
--      `discard_response`) and NOTHING uses this constraint for `ON CONFLICT`
--      inference — which is the one thing a deferrable unique would break.
--
--  (e) layout — children must sit in the parent's section, contiguously
--      immediately after it, in the flat (section_id, position) space. That flat
--      ordinal space is what keeps `validate_visible_when`'s "pergunta anterior"
--      rule meaningful across a container boundary. Enforced at PUBLISH, not on
--      every write, because a draft mid-edit legitimately passes through
--      non-contiguous states.
--
-- SQLSTATEs: none here (publish-time gates raise `check_violation`, consistent
-- with their `validate_visible_when` siblings). The RPC codes HC0N0+ land in BE-3.
-- Live high-water is HC0M9, NOT HC098 — ADR 0087 Amendment 1.

-- ---------------------------------------------------------------------------
-- 1 · Feature flag — seeded OFF (two-migration flag pattern).
-- ---------------------------------------------------------------------------
insert into app.feature_flags (key, enabled, description)
values (
  'repeating_groups',
  false,
  'Repeating groups (FF-1, ADR 0087): repeating_group/group container items, the response_group_instances write RPCs, and instance-aware condition evaluation. Ships OFF; flipped by 20260828000900 at the FF-1 gate. Resolve the VALUE in the enabled column, never this sentence.'
)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- 2 · ruling 4 — drop the conditional-vs-required CHECK, platform-wide.
-- ---------------------------------------------------------------------------
alter table public.form_items
  drop constraint if exists form_items_conditional_not_required;

-- ---------------------------------------------------------------------------
-- 3 · Container shape — re-cut the group/repeating_group arm.
--     The other three arms are carried over VERBATIM from the live definition.
-- ---------------------------------------------------------------------------
alter table public.form_items
  drop constraint form_items_input_vs_display;

alter table public.form_items
  add constraint form_items_input_vs_display check (
    case
      when item_type = any (array[
        'multiple_choice','dropdown','checkbox',
        'free_text','short_text','number','date','time'
      ]) then
        question_key is not null and label is not null and content is null
      when item_type = any (array['matrix','risk_matrix','reference']) then
        question_key is not null and label is not null and content is null
          and required = false
      -- FF-1 (b): containers collect NO answer. `question_key IS NULL` is what
      -- makes them invisible to every question_key-keyed path by construction.
      -- `required` stays false — a repeating group's required-ness is
      -- `config.minInstances`, enforced by submit_response, never this flag.
      when item_type = any (array['group','repeating_group']) then
        content is null and required = false
          and question_key is null and label is not null
          and default_value is null
      when item_type = any (array['section_text','image']) then
        content is not null and question_key is null and label is null
          and question_explanation is null and required = false
      else false
    end
  );

-- ---------------------------------------------------------------------------
-- 4 · ruling 1 — the depth-1 cap, declarative.
-- ---------------------------------------------------------------------------

-- (i) The two generated discriminators. Both expressions are IMMUTABLE.
--     `parent_is_container` is NULL for a top-level item ON PURPOSE: a MATCH
--     SIMPLE composite FK is not enforced when any of its columns is NULL, which
--     is precisely how top-level items opt out of the parent check.
alter table public.form_items
  add column is_container boolean
    generated always as (item_type = any (array['group','repeating_group'])) stored;

alter table public.form_items
  add column parent_is_container boolean
    generated always as (case when parent_item_id is null then null else true end) stored;

comment on column public.form_items.is_container is
  'FF-1 (ADR 0087 ruling 1), generated: true for group/repeating_group. Referenced side of the parent FK — this is what makes "a parent must be a container" a constraint rather than a convention.';
comment on column public.form_items.parent_is_container is
  'FF-1 (ADR 0087 ruling 1), generated: true when this item has a parent, NULL when it does not. NULL is load-bearing — it is how a top-level item opts out of the MATCH SIMPLE composite parent FK.';

-- (ii) The referenced key for the composite parent FK.
alter table public.form_items
  add constraint form_items_container_uq unique (id, form_version_id, is_container);

-- (iii) Re-cut the self-FK. SAME NAME (nothing downstream churns; `database.ts`
--       carries `foreignKeyName: "form_items_parent_item_id_fkey"`), and still
--       exactly ONE self-relationship → no PGRST201 ambiguity.
--       ON UPDATE NO ACTION (the default) is deliberate: it blocks flipping a
--       container's item_type to a non-container while it still has children.
alter table public.form_items
  drop constraint form_items_parent_item_id_fkey;

alter table public.form_items
  add constraint form_items_parent_item_id_fkey
  foreign key (parent_item_id, form_version_id, parent_is_container)
  references public.form_items (id, form_version_id, is_container)
  on delete cascade;

-- (iv) The other half of the cap: no container INSIDE a container. Separate
--      object from (iii) so neither keystone can satisfy the other vacuously.
alter table public.form_items
  add constraint form_items_no_nested_container check (
    parent_item_id is null
      or item_type <> all (array['group','repeating_group'])
  );

-- ---------------------------------------------------------------------------
-- 5 · Collision-free reorder — DEFERRABLE, mirroring form_items' precedent.
-- ---------------------------------------------------------------------------
alter table public.response_group_instances
  drop constraint response_group_instances_parent_position_uniq;

alter table public.response_group_instances
  add constraint response_group_instances_parent_position_uniq
  unique nulls not distinct (response_id, group_item_id, parent_instance_id, "position")
  deferrable initially immediate;

-- ---------------------------------------------------------------------------
-- 6 · Publish-time layout gate.
-- ---------------------------------------------------------------------------
create or replace function app.validate_group_layout(p_form_version_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public', 'pg_catalog'
as $$
declare
  r record;
begin
  for r in
    select c.id,
           c.label,
           c.section_id,
           c.position,
           count(ch.id)                                    as child_count,
           min(ch.position)                                as min_child_pos,
           max(ch.position)                                as max_child_pos,
           coalesce(bool_and(ch.section_id = c.section_id), true) as same_section
    from public.form_items c
    left join public.form_items ch on ch.parent_item_id = c.id
    where c.form_version_id = p_form_version_id
      and c.item_type = any (array['group','repeating_group'])
    group by c.id, c.label, c.section_id, c.position
    order by c.position
  loop
    if r.child_count = 0 then
      raise exception 'o bloco "%" não contém nenhuma pergunta',
        coalesce(r.label, '(sem título)')
        using errcode = 'check_violation';
    end if;

    if not r.same_section then
      raise exception 'as perguntas do bloco "%" devem estar na mesma seção do bloco',
        coalesce(r.label, '(sem título)')
        using errcode = 'check_violation';
    end if;

    -- Contiguity: with (section_id, position) unique and every child in the
    -- parent's section, min = pos+1 AND max = pos+count implies the children
    -- occupy exactly the n slots immediately after the parent, with nothing
    -- interleaved. This is what keeps validate_visible_when's ordinal
    -- "pergunta anterior" comparison meaningful across the container boundary.
    if r.min_child_pos <> r.position + 1
       or r.max_child_pos <> r.position + r.child_count then
      raise exception
        'as perguntas do bloco "%" devem vir imediatamente após ele, sem outros itens intercalados',
        coalesce(r.label, '(sem título)')
        using errcode = 'check_violation';
    end if;
  end loop;

  return true;
end;
$$;

comment on function app.validate_group_layout(uuid) is
  'FF-1 (ADR 0087): publish-time layout gate for container items — children in the parent''s section, contiguously immediately after it. Publish-time rather than a trigger because a draft mid-edit legitimately passes through non-contiguous states. Called by publish_form_version beside validate_visible_when.';

-- ---------------------------------------------------------------------------
-- 7 · Wire the gate into publish_form_version.
--     Signature UNCHANGED → body rewritten in place via the established
--     pg_get_functiondef + replace + execute pattern (grants preserved). Fails
--     loudly if the anchor drifts.
-- ---------------------------------------------------------------------------
do $rewrite$
declare
  v_def text := pg_get_functiondef(
    'public.publish_form_version(uuid,uuid,date,integer,date)'::regprocedure);
  v_from text := E'  perform public.validate_visible_when(p_form_version_id);';
  v_to   text := E'  perform public.validate_visible_when(p_form_version_id);\n\n  -- FF-1 (ADR 0087): container layout — children in the parent''''s section,\n  -- contiguously immediately after it.\n  perform app.validate_group_layout(p_form_version_id);';
begin
  if position(v_from in v_def) = 0 then
    raise exception 'publish_form_version validate_visible_when anchor not found — body drifted; migration must be revised';
  end if;
  v_def := replace(v_def, v_from, v_to);
  execute v_def;
end;
$rewrite$;
