-- ----------------------------------------------------------------------------
-- form-model-normalization (BE-6) — dashboards/export aggregate by option CODE.
-- ----------------------------------------------------------------------------
-- Choice distributions + the CSV export now source their selections from
-- answer_selected_options -> form_item_options (the normalized model), GROUP BY
-- the stable option.code, and resolve the CURRENT display label from the latest
-- published version's option carrying that code. A renamed label no longer
-- fragments historical analytics (the whole point of the refactor).
--
-- dashboard_distributions: emits option_code + option_label (replacing the old
--   label-only option_value). The denominator/n logic is preserved (now over the
--   selection-bearing responses). free_text path unchanged (scalar).
-- dashboard_export_rows: the answers map renders choice answers as the current
--   label(s) (checkbox joined with '; '); scalars unchanged.
--
-- Forward-only / additive (CREATE OR REPLACE). The contract for dashboard.ts is
-- DistributionOption { code, label, count } (already adopted in BE-1).
-- ----------------------------------------------------------------------------

SET check_function_bodies = false;
SET client_min_messages = warning;

-- ===========================================================================
-- dashboard_distributions — by option.code, current label resolved server-side.
-- The return type changes (option_value -> option_code + option_label), so DROP
-- the old signature first (CREATE OR REPLACE cannot alter a return type). The
-- REVOKE/GRANT surface is re-applied at the foot of this file.
-- ===========================================================================
DROP FUNCTION IF EXISTS "public"."dashboard_distributions"("uuid", "date", "date");

CREATE OR REPLACE FUNCTION "public"."dashboard_distributions"("p_form_id" "uuid", "p_from" "date" DEFAULT NULL::"date", "p_to" "date" DEFAULT NULL::"date") RETURNS TABLE("question_key" "text", "label" "text", "section_title" "text", "section_position" integer, "item_position" integer, "item_type" "text", "option_code" "text", "option_label" "text", "option_count" bigint, "denominator" bigint, "n" bigint)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission_id uuid;
  v_latest uuid;
begin
  select commission_id into v_commission_id from public.forms where id = p_form_id;
  if v_commission_id is null or not (app.is_staff_admin_of(v_commission_id) or app.is_admin()) then
    return;
  end if;

  v_latest := app.latest_published_version(p_form_id);

  return query
  with
  -- In-scope (submitted, standalone, date-bounded) responses.
  resp as (
    select sr.id, sr.form_version_id
    from app.submitted_form_responses(p_form_id) sr
    where (p_from is null or sr.submitted_at::date >= p_from)
      and (p_to   is null or sr.submitted_at::date <= p_to)
  ),
  -- Every CHOICE selection of those responses, joined to its authoring item (for
  -- the section/denominator) and the selected option (for code + version-local
  -- label). question_key carries cross-version; code carries cross-version too.
  sel as (
    select s.response_id,
           fi.question_key,
           fi.item_type,
           fi.section_id,
           o.code as option_code
    from public.answer_selected_options s
    join resp on resp.id = s.response_id
    join public.form_items fi on fi.id = s.item_id
    join public.form_item_options o on o.id = s.option_id
    where fi.item_type in ('multiple_choice', 'dropdown', 'checkbox')
  ),
  -- Per-question denominator: distinct responses with ANY selection in the SAME
  -- section (smaller applicability base for conditional-section questions).
  section_answered as (
    select distinct response_id, section_id from sel
  ),
  key_section as (
    select distinct fi.question_key, fi.section_id
    from sel af
    join public.form_items fi on fi.question_key = af.question_key
    where fi.form_version_id in (select distinct form_version_id from resp)
      and fi.item_type in ('multiple_choice', 'dropdown', 'checkbox')
  ),
  denom as (
    select ks.question_key,
           count(distinct sa.response_id) as denominator
    from key_section ks
    join section_answered sa on sa.section_id = ks.section_id
    group by ks.question_key
  ),
  -- Tally selections per (question_key, code). Each selected option counts once
  -- per response (checkbox contributes several codes for one response).
  tally as (
    select e.question_key,
           e.option_code,
           count(*) as option_count
    from sel e
    group by e.question_key, e.option_code
  ),
  n_per_key as (
    select sel.question_key as qk, count(distinct sel.response_id) as cnt
    from sel
    group by sel.question_key
  ),
  -- Current-wording metadata from the latest published version: the question
  -- label/section + the CURRENT label of each code (a renamed option resolves to
  -- its new label; a code absent from the latest version falls back to the code).
  meta as (
    select fi.question_key,
           fi.label,
           fs.title as section_title,
           fs.position as section_position,
           fi.position as item_position,
           fi.item_type
    from public.form_items fi
    join public.form_sections fs on fs.id = fi.section_id
    where fi.form_version_id = v_latest
      and fi.item_type in ('multiple_choice', 'dropdown', 'checkbox')
  ),
  code_label as (
    select fi.question_key, o.code, o.label
    from public.form_items fi
    join public.form_item_options o on o.item_id = fi.id
    where fi.form_version_id = v_latest
      and fi.item_type in ('multiple_choice', 'dropdown', 'checkbox')
  )
  select t.question_key,
         coalesce(m.label, t.question_key) as label,
         m.section_title,
         coalesce(m.section_position, 0) as section_position,
         coalesce(m.item_position, 0) as item_position,
         coalesce(m.item_type, 'multiple_choice') as item_type,
         t.option_code,
         coalesce(cl.label, t.option_code) as option_label,
         t.option_count,
         coalesce(d.denominator, 0) as denominator,
         coalesce(np.cnt, 0) as n
  from tally t
  left join meta m on m.question_key = t.question_key
  left join code_label cl on cl.question_key = t.question_key and cl.code = t.option_code
  left join denom d on d.question_key = t.question_key
  left join n_per_key np on np.qk = t.question_key
  order by coalesce(m.section_position, 0),
           coalesce(m.item_position, 0),
           t.question_key,
           coalesce(cl.label, t.option_code);
end;
$$;

ALTER FUNCTION "public"."dashboard_distributions"("p_form_id" "uuid", "p_from" "date", "p_to" "date") OWNER TO "postgres";

-- ===========================================================================
-- dashboard_export_rows — choice answers render as CURRENT label(s); scalars
-- unchanged. Re-stated with the answers map sourced from both tables.
-- ===========================================================================
CREATE OR REPLACE FUNCTION "public"."dashboard_export_rows"("p_form_id" "uuid", "p_from" "date" DEFAULT NULL::"date", "p_to" "date" DEFAULT NULL::"date") RETURNS TABLE("response_id" "uuid", "member_name" "text", "submitted_at" timestamp with time zone, "version_number" integer, "answers" "jsonb", "signoffs" "jsonb")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission_id uuid;
  v_latest uuid;
begin
  select commission_id into v_commission_id from public.forms where id = p_form_id;
  if v_commission_id is null or not (app.is_staff_admin_of(v_commission_id) or app.is_admin()) then
    return;
  end if;

  v_latest := app.latest_published_version(p_form_id);

  return query
  select r.id,
         pr.full_name as member_name,
         r.submitted_at,
         fv.version_number,
         -- answers: question_key -> display text. Scalars take answers.value as
         -- text; CHOICE answers resolve each selected code to its CURRENT label
         -- (from the latest published version, falling back to the response's own
         -- version, then the code) and join checkbox labels with '; '.
         (
           select coalesce(jsonb_object_agg(qk, txt), '{}'::jsonb)
           from (
             -- scalar answers
             select a.question_key as qk, a.value #>> '{}' as txt
             from public.answers a
             join public.form_items fi on fi.id = a.item_id
             where a.response_id = r.id and a.value is not null
               and fi.item_type in ('free_text','short_text','number','date','time')
             union all
             -- choice answers: join selected codes -> current label, agg per key
             select fi.question_key as qk,
                    string_agg(
                      coalesce(cur.label, own.label, o.code), '; '
                      order by o.position
                    ) as txt
             from public.answer_selected_options s
             join public.form_items fi on fi.id = s.item_id
             join public.form_item_options o on o.id = s.option_id
             -- current label from the latest published version (by code)
             left join public.form_items cfi
               on cfi.form_version_id = v_latest and cfi.question_key = fi.question_key
             left join public.form_item_options cur
               on cur.item_id = cfi.id and cur.code = o.code
             -- own-version label (the option row itself)
             left join public.form_item_options own on own.id = s.option_id
             where s.response_id = r.id
               and fi.item_type in ('multiple_choice','dropdown','checkbox')
             group by fi.question_key
           ) m
         ) as answers,
         coalesce(
           (select jsonb_object_agg(
              coalesce(s.title, 'Seção ' || s.position::text),
              case when exists (
                select 1 from public.response_section_signoffs so
                where so.response_id = r.id and so.section_id = s.id
              ) then 'Assinada' else 'Pendente' end)
            from public.form_sections s
            where s.form_version_id = r.form_version_id
              and s.requires_signoff = true),
           '{}'::jsonb) as signoffs
  from app.submitted_form_responses(p_form_id) r
  join public.form_versions fv on fv.id = r.form_version_id
  left join public.profiles pr on pr.id = r.created_by
  where (p_from is null or r.submitted_at::date >= p_from)
    and (p_to   is null or r.submitted_at::date <= p_to)
  order by r.submitted_at desc;
end;
$$;

ALTER FUNCTION "public"."dashboard_export_rows"("p_form_id" "uuid", "p_from" "date", "p_to" "date") OWNER TO "postgres";

-- Re-apply the grant surface dropped with the old dashboard_distributions
-- signature (mirrors the original block in 20260620004000_responses.sql).
REVOKE ALL ON FUNCTION "public"."dashboard_distributions"("p_form_id" "uuid", "p_from" "date", "p_to" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."dashboard_distributions"("p_form_id" "uuid", "p_from" "date", "p_to" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."dashboard_distributions"("p_form_id" "uuid", "p_from" "date", "p_to" "date") TO "service_role";
