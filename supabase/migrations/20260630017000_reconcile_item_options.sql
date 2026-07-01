-- ----------------------------------------------------------------------------
-- form-model-normalization (QA MAJOR-1) — atomic option-set reconcile RPC.
-- ----------------------------------------------------------------------------
-- BUG: reconcileOptionRows (src/lib/forms/actions.ts) reordered an item's option
-- rows by UPDATEing each row's `position` in a SEPARATE supabase-js call =
-- separate transaction. `unique(item_id, position)` is DEFERRABLE but not
-- INITIALLY DEFERRED, and deferral does not span transactions, so moving an
-- option UP into a still-occupied slot raised
-- form_item_options_item_id_position_key and the reorder was silently lost.
--
-- FIX: fold the whole reconcile (delete removed / update kept / insert new /
-- assign ALL positions) into ONE plpgsql RPC, so every position write lands in a
-- SINGLE transaction/statement where the DEFERRABLE constraint tolerates the
-- transient collisions (the proven reorder_phase_results `unnest … with
-- ordinality` pattern). App-side code generation for NEW rows is preserved
-- (Decision 2): the caller passes each desired option with a `code` — an existing
-- code (kept, code frozen) or a freshly-generated one for a new row.
--
-- staff_admin/RLS-gated and draft-only, like the other builder writes: the
-- underlying form_item_options RLS (staff_admin-write) + the guard_published_
-- structure trigger (blocks writes to a non-draft version's structure) are the
-- authority; this RPC is SECURITY INVOKER so those apply to the caller.
--
-- SQLSTATEs: HC013 (a submitted code collides with another item / duplicate code
-- in the payload) — reused, mapped to the generic builder error client-side.
-- ----------------------------------------------------------------------------

SET check_function_bodies = false;
SET client_min_messages = warning;

-- p_options is an ORDERED jsonb array; element i (0-based) becomes position i:
--   { "code": text, "label": text, "color_token": text|null,
--     "score": number|null, "analytics_code": text|null }
-- Every element MUST carry a `code` (the caller generates codes for new rows,
-- app-side, per Decision 2). Rows whose code is present are UPDATEd in place
-- (code frozen by the immutable-code trigger); codes absent from the payload are
-- DELETEd; codes not yet on the item are INSERTed. All positions are assigned in
-- one UPDATE so the DEFERRABLE unique(item_id, position) tolerates the reorder.
CREATE OR REPLACE FUNCTION "public"."reconcile_item_options"(
  "p_item_id" "uuid", "p_options" "jsonb"
) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_dup text;
begin
  if p_options is null or jsonb_typeof(p_options) <> 'array' then
    raise exception 'lista de opções inválida' using errcode = 'check_violation';
  end if;

  -- Reject a payload with duplicate codes (would make the reconcile ambiguous).
  select code into v_dup
  from (
    select e ->> 'code' as code, count(*) as n
    from jsonb_array_elements(p_options) e
    group by e ->> 'code'
    having count(*) > 1
  ) d
  limit 1;
  if v_dup is not null then
    raise exception 'código de opção duplicado: %', v_dup using errcode = 'HC013';
  end if;

  -- Normalize the payload to a working set with a 0-based target position.
  create temp table _reconcile_opts on commit drop as
  select (e.value ->> 'code')::text as code,
         (e.value ->> 'label')::text as label,
         nullif(e.value ->> 'color_token', '')::text as color_token,
         case when e.value -> 'score' is null or jsonb_typeof(e.value -> 'score') = 'null'
              then null else (e.value ->> 'score')::numeric end as score,
         nullif(e.value ->> 'analytics_code', '')::text as analytics_code,
         (e.ordinality - 1)::integer as position
  from jsonb_array_elements(p_options) with ordinality e;

  -- 1) DELETE existing rows whose code is no longer in the payload. Doing this
  -- FIRST frees any positions/codes so the subsequent inserts/reorder are clean.
  -- The staff_admin-write RLS + published-structure guard apply to the caller.
  delete from public.form_item_options o
  where o.item_id = p_item_id
    and not exists (select 1 from _reconcile_opts r where r.code = o.code);

  -- 2) UPDATE kept rows' content (NOT position yet — positions are assigned in a
  -- single statement in step 4 to avoid transient collisions with new rows).
  update public.form_item_options o
  set label = r.label,
      color_token = r.color_token,
      score = r.score,
      analytics_code = r.analytics_code
  from _reconcile_opts r
  where o.item_id = p_item_id and o.code = r.code;

  -- 3) INSERT new rows (codes not yet on the item) at a HIGH temporary position
  -- band (base + n) so they cannot collide with existing rows before the reorder.
  -- form_version_id is filled by the sync trigger; parent-is-choice + code
  -- immutability triggers still apply.
  insert into public.form_item_options
    (item_id, position, code, label, color_token, score, analytics_code)
  select p_item_id,
         1000000 + r.position,   -- temp band, well above any real position
         r.code, r.label, r.color_token, r.score, r.analytics_code
  from _reconcile_opts r
  where not exists (
    select 1 from public.form_item_options o
    where o.item_id = p_item_id and o.code = r.code
  );

  -- 4) Assign ALL final positions in ONE statement. The DEFERRABLE unique
  -- constraint tolerates the transient duplicate positions within this update
  -- (mirrors reorder_phase_results / reorder_item).
  update public.form_item_options o
  set position = r.position
  from _reconcile_opts r
  where o.item_id = p_item_id and o.code = r.code;

  drop table _reconcile_opts;
end;
$$;

ALTER FUNCTION "public"."reconcile_item_options"("p_item_id" "uuid", "p_options" "jsonb") OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."reconcile_item_options"("p_item_id" "uuid", "p_options" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reconcile_item_options"("p_item_id" "uuid", "p_options" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reconcile_item_options"("p_item_id" "uuid", "p_options" "jsonb") TO "service_role";

COMMENT ON FUNCTION "public"."reconcile_item_options"("p_item_id" "uuid", "p_options" "jsonb") IS 'form-model-normalization: atomically reconcile an item''s form_item_options to the ordered payload (delete removed / update kept / insert new / assign all positions in one statement). Fixes the cross-transaction DEFERRABLE-unique reorder bug. SECURITY INVOKER — staff_admin-write RLS + guard_published_structure (draft-only) apply. Caller supplies codes (app-side gen for new rows, Decision 2).';
