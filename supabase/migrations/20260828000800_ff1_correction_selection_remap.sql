-- FF-1 · P0-1 — correcting a response destroyed every CHOICE answer inside a
--                repeating group. Introduced by Amendment 1.3, in this phase.
--
-- WHAT HAPPENED, because the mechanism matters more than the patch.
--
-- Both correction paths copy `answer_selected_options` by re-finding the new
-- answer row that corresponds to each old one:
--
--     join public.answers new_a
--       on  new_a.response_id = <successor>
--       and new_a.item_id = old_a.item_id
--       and new_a.group_instance_id is not distinct from old_a.group_instance_id
--
-- That third clause was correct — and its own comment said so: "the
-- one-row-per-item key WHILE REPEATING GROUPS ARE INERT". With no instances in
-- existence both sides were always NULL, so it read as "match top-level to
-- top-level" and never did anything else.
--
-- Amendment 1.3 then gave the successor its OWN instance rows and remapped the
-- copied answers onto them (`map.new_id`). That is correct and necessary — the
-- successor must not point at the predecessor's frozen, cascade-deleted
-- instances. But it also made `new_a.group_instance_id` DIFFERENT BY
-- CONSTRUCTION from `old_a.group_instance_id` for every instance-scoped answer,
-- which makes the join clause above UNSATISFIABLE for exactly those rows.
-- Top-level answers still match (NULL vs NULL), so the damage is invisible
-- outside repeating groups: the answers copy, the selections vanish.
--
-- THE LESSON THIS PHASE KEEPS TEACHING: the join did not rot, its PREMISE was
-- repealed. Same species as `form_items_conditional_not_required` (a CHECK that
-- made a live branch dead code) and the visibility-wins branch it kept
-- unreachable. When a phase falsifies a premise, the work is not "write the new
-- code" — it is GREP FOR THE CODE THAT ASSUMED THE OLD ONE. "while repeating
-- groups are inert" was sitting in the source, in English, naming its own
-- expiry condition, and I read past it while editing the statement two lines up.
--
-- THE FIX. Resolve old→new through the instance ROWS instead of comparing ids
-- that are now deliberately unequal. The copy preserves (group_item_id,
-- position), so that pair is the stable identity across the correction — the
-- same technique `clone_form_version` uses to map sections and items. A NULL
-- `old_a.group_instance_id` makes the scalar subquery NULL, so
-- `is not distinct from` still matches top-level to top-level: one expression,
-- both cases, no branch to get wrong.
--
-- Signatures UNCHANGED → bodies rewritten in place; each raises loudly if its
-- anchor has drifted.

do $rewrite$
declare
  v_def text := pg_get_functiondef('public.start_correction_draft(uuid)'::regprocedure);
  v_from text := E'   and new_a.group_instance_id is not distinct from old_a.group_instance_id\n  where old_a.response_id = v_predecessor;';
  v_to text := E'   -- FF-1 (P0-1): the successor''''s instance ids differ BY CONSTRUCTION from\n   -- the predecessor''''s (Amendment 1.3 gives it its own rows), so comparing the\n   -- ids directly can never match an instance-scoped answer. Resolve through\n   -- the instance rows on the preserved (group_item_id, position) identity.\n   -- NULL in = NULL out, so top-level answers still match top-level.\n   and new_a.group_instance_id is not distinct from (\n         select ngi.id\n         from public.response_group_instances ogi\n         join public.response_group_instances ngi\n           on ngi.response_id = v_draft\n          and ngi.group_item_id = ogi.group_item_id\n          and ngi.position = ogi.position\n         where ogi.id = old_a.group_instance_id\n       )\n  where old_a.response_id = v_predecessor;';
begin
  if position(v_from in v_def) = 0 then
    raise exception 'start_correction_draft selections-copy anchor not found — body drifted; migration must be revised';
  end if;
  execute replace(v_def, v_from, v_to);
end;
$rewrite$;

do $rewrite$
declare
  v_def text := pg_get_functiondef('public.supersede_response(uuid,text)'::regprocedure);
  v_from text := E'   and new_a.group_instance_id is not distinct from old_a.group_instance_id\n  where old_a.response_id = p_response_id;';
  v_to text := E'   -- FF-1 (P0-1): see start_correction_draft — resolve old->new through the\n   -- instance rows, not through ids Amendment 1.3 made unequal on purpose.\n   and new_a.group_instance_id is not distinct from (\n         select ngi.id\n         from public.response_group_instances ogi\n         join public.response_group_instances ngi\n           on ngi.response_id = v_new.id\n          and ngi.group_item_id = ogi.group_item_id\n          and ngi.position = ogi.position\n         where ogi.id = old_a.group_instance_id\n       )\n  where old_a.response_id = p_response_id;';
begin
  if position(v_from in v_def) = 0 then
    raise exception 'supersede_response selections-copy anchor not found — body drifted; migration must be revised';
  end if;
  execute replace(v_def, v_from, v_to);
end;
$rewrite$;
