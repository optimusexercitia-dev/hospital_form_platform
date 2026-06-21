-- ----------------------------------------------------------------------------
-- Consolidated baseline — responses
-- ----------------------------------------------------------------------------
SET check_function_bodies = false;
SET client_min_messages = warning;

CREATE OR REPLACE FUNCTION "app"."answer_map"("p_response_id" "uuid") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select coalesce(jsonb_object_agg(question_key, value), '{}'::jsonb)
  from public.answers
  where response_id = p_response_id
    and value is not null;
$$;

ALTER FUNCTION "app"."answer_map"("p_response_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."can_read_signoff"("p_response_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select exists (
    select 1
    from public.responses r
    where r.id = p_response_id
      and (
        r.created_by = auth.uid()
        or app.is_admin()
        or app.is_staff_admin_of(r.commission_id)
      )
  );
$$;

ALTER FUNCTION "app"."can_read_signoff"("p_response_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."can_sign_section"("p_response_id" "uuid", "p_section_id" "uuid", "p_signer" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select exists (
    select 1
    from public.responses r
    join public.form_sections s
      on s.id = p_section_id
     and s.form_version_id = r.form_version_id
    where r.id = p_response_id
      and r.status = 'in_progress'
      and s.requires_signoff = true
      and (
        (s.signoff_role = 'respondent' and r.created_by = p_signer)
        or (s.signoff_role = 'staff_admin' and app.is_staff_admin_of(r.commission_id))
      )
  );
$$;

ALTER FUNCTION "app"."can_sign_section"("p_response_id" "uuid", "p_section_id" "uuid", "p_signer" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."eval_condition"("p_visible_when" "jsonb", "p_answers" "jsonb") RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'pg_catalog'
    AS $$
declare
  v_key text;
  v_op text;
  v_target jsonb;
  v_answer jsonb;
  v_present boolean;
  v_match boolean;
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
  else
    raise exception 'unknown condition op: %', v_op;
  end if;
end;
$$;

ALTER FUNCTION "app"."eval_condition"("p_visible_when" "jsonb", "p_answers" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."latest_published_version"("p_form_id" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select id
  from public.form_versions
  where form_id = p_form_id
  order by (status = 'published') desc, version_number desc
  limit 1;
$$;

ALTER FUNCTION "app"."latest_published_version"("p_form_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."response_required_complete"("p_response_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_version_id uuid;
  v_answers jsonb;
  r_section record;
  v_missing integer;
begin
  select form_version_id into v_version_id
  from public.responses
  where id = p_response_id;

  if v_version_id is null then
    return false;
  end if;

  v_answers := app.answer_map(p_response_id);

  for r_section in
    select s.id, s.visible_when
    from public.form_sections s
    where s.form_version_id = v_version_id
    order by s.position
  loop
    -- Hidden sections require nothing.
    if not app.eval_condition(r_section.visible_when, v_answers) then
      continue;
    end if;

    select count(*) into v_missing
    from public.form_items i
    where i.section_id = r_section.id
      and i.required = true
      and i.question_key is not null
      and not exists (
        select 1 from public.answers a
        where a.response_id = p_response_id
          and a.item_id = i.id
          and a.value is not null
          and a.value <> 'null'::jsonb
      );

    if v_missing > 0 then
      return false;
    end if;
  end loop;

  return true;
end;
$$;

ALTER FUNCTION "app"."response_required_complete"("p_response_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."signoff_target"("p_response_id" "uuid", "p_section_id" "uuid") RETURNS TABLE("status" "text", "version_id" "uuid", "requires_signoff" boolean, "visible_when" "jsonb")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select r.status, r.form_version_id, s.requires_signoff, s.visible_when
  from public.responses r
  left join public.form_sections s
    on s.id = p_section_id
   and s.form_version_id = r.form_version_id
  where r.id = p_response_id;
$$;

ALTER FUNCTION "app"."signoff_target"("p_response_id" "uuid", "p_section_id" "uuid") OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."responses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "form_version_id" "uuid" NOT NULL,
    "commission_id" "uuid" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "status" "text" DEFAULT 'in_progress'::"text" NOT NULL,
    "last_section_id" "uuid",
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "submitted_at" timestamp with time zone,
    "case_phase_id" "uuid",
    CONSTRAINT "responses_status_check" CHECK (("status" = ANY (ARRAY['in_progress'::"text", 'submitted'::"text"])))
);

ALTER TABLE "public"."responses" OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."submitted_form_responses"("p_form_id" "uuid") RETURNS SETOF "public"."responses"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select r.*
  from public.responses r
  join public.form_versions fv on fv.id = r.form_version_id
  where fv.form_id = p_form_id
    and r.status = 'submitted'
    and r.case_phase_id is null;
$$;

ALTER FUNCTION "app"."submitted_form_responses"("p_form_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."commission_overview"() RETURNS TABLE("commission_id" "uuid", "commission_name" "text", "slug" "text", "form_count" bigint, "submitted_count" bigint, "submitted_last_30_days" bigint)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
begin
  if not app.is_admin() then
    return;
  end if;

  return query
  select c.id,
         c.name,
         c.slug::text,
         (select count(distinct f.id)
            from public.forms f
            join public.form_versions fv on fv.form_id = f.id and fv.status = 'published'
            where f.commission_id = c.id) as form_count,
         (select count(r.id)
            from public.responses r
            where r.commission_id = c.id
              and r.status = 'submitted'
              and r.case_phase_id is null) as submitted_count,
         (select count(r.id)
            from public.responses r
            where r.commission_id = c.id
              and r.status = 'submitted'
              and r.case_phase_id is null
              and r.submitted_at >= now() - interval '30 days') as submitted_last_30_days
  from public.commissions c
  order by c.name;
end;
$$;

ALTER FUNCTION "public"."commission_overview"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."dashboard_completion_by_member"("p_form_id" "uuid", "p_from" "date" DEFAULT NULL::"date", "p_to" "date" DEFAULT NULL::"date") RETURNS TABLE("member_id" "uuid", "name" "text", "count" bigint)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission_id uuid;
begin
  select commission_id into v_commission_id from public.forms where id = p_form_id;
  if v_commission_id is null or not (app.is_staff_admin_of(v_commission_id) or app.is_admin()) then
    return;
  end if;

  return query
  select sr.created_by as member_id,
         pr.full_name as name,
         count(*) as count
  from app.submitted_form_responses(p_form_id) sr
  left join public.profiles pr on pr.id = sr.created_by
  where (p_from is null or sr.submitted_at::date >= p_from)
    and (p_to   is null or sr.submitted_at::date <= p_to)
  group by sr.created_by, pr.full_name
  order by count desc, pr.full_name;
end;
$$;

ALTER FUNCTION "public"."dashboard_completion_by_member"("p_form_id" "uuid", "p_from" "date", "p_to" "date") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."dashboard_distributions"("p_form_id" "uuid", "p_from" "date" DEFAULT NULL::"date", "p_to" "date" DEFAULT NULL::"date") RETURNS TABLE("question_key" "text", "label" "text", "section_title" "text", "section_position" integer, "item_position" integer, "item_type" "text", "option_value" "text", "option_count" bigint, "denominator" bigint, "n" bigint)
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
  -- The in-scope (submitted, standalone, date-bounded) responses of the form.
  resp as (
    select sr.id, sr.form_version_id
    from app.submitted_form_responses(p_form_id) sr
    where (p_from is null or sr.submitted_at::date >= p_from)
      and (p_to   is null or sr.submitted_at::date <= p_to)
  ),
  -- Every answer of those responses, joined to its authoring item so we know the
  -- item's section (for the denominator) and type (scalar vs checkbox).
  ans as (
    select a.response_id,
           a.question_key,
           a.value,
           fi.item_type,
           fi.section_id
    from public.answers a
    join resp on resp.id = a.response_id
    join public.form_items fi
      on fi.id = a.item_id
    where a.value is not null
      and fi.item_type in ('multiple_choice', 'dropdown', 'checkbox')
  ),
  -- Per-question_key denominator: distinct responses that answered ANY question
  -- in the SAME section (as authored in that response's own version). This gives
  -- the smaller applicability base for conditional-section questions.
  -- Map (response, section) -> answered-in-that-section, then attach to each
  -- question_key that lives in that section.
  section_answered as (
    select distinct response_id, section_id
    from ans
  ),
  -- question_key -> the set of (version, section) it appears in (from items of
  -- the in-scope responses' versions), so the denominator counts responses with
  -- an answer in THAT question's section for THAT version.
  key_section as (
    select distinct fi.question_key, fi.section_id
    from ans af
    join public.form_items fi on fi.question_key = af.question_key
    -- restrict to items in the versions actually used by in-scope responses
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
  -- Unnest checkbox values; pass scalar choice values through. Checkbox answers
  -- store a jsonb ARRAY (each selected option counts individually); scalar choice
  -- answers store a jsonb string. jsonb_array_elements_text would error on a
  -- scalar, so the lateral is fed an array ONLY for array-typed values and an
  -- empty array otherwise — scalars take the else branch.
  exploded as (
    select ans.question_key,
           case
             when jsonb_typeof(ans.value) = 'array' then elem.opt
             else ans.value #>> '{}'
           end as option_value,
           ans.response_id
    from ans
    left join lateral jsonb_array_elements_text(
      case when jsonb_typeof(ans.value) = 'array' then ans.value else '[]'::jsonb end
    ) as elem(opt)
      on jsonb_typeof(ans.value) = 'array'
    where jsonb_typeof(ans.value) <> 'array' or elem.opt is not null
  ),
  tally as (
    select e.question_key,
           e.option_value,
           count(*) as option_count
    from exploded e
    group by e.question_key, e.option_value
  ),
  n_per_key as (
    select ans.question_key as qk, count(distinct ans.response_id) as cnt
    from ans
    group by ans.question_key
  ),
  -- Current-wording metadata from the latest published version.
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
  )
  select t.question_key,
         coalesce(m.label, t.question_key) as label,
         m.section_title,
         coalesce(m.section_position, 0) as section_position,
         coalesce(m.item_position, 0) as item_position,
         coalesce(m.item_type, 'multiple_choice') as item_type,
         t.option_value,
         t.option_count,
         coalesce(d.denominator, 0) as denominator,
         coalesce(np.cnt, 0) as n
  from tally t
  left join meta m on m.question_key = t.question_key
  left join denom d on d.question_key = t.question_key
  left join n_per_key np on np.qk = t.question_key
  order by coalesce(m.section_position, 0),
           coalesce(m.item_position, 0),
           t.question_key,
           t.option_value;
end;
$$;

ALTER FUNCTION "public"."dashboard_distributions"("p_form_id" "uuid", "p_from" "date", "p_to" "date") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."dashboard_export_rows"("p_form_id" "uuid", "p_from" "date" DEFAULT NULL::"date", "p_to" "date" DEFAULT NULL::"date") RETURNS TABLE("response_id" "uuid", "member_name" "text", "submitted_at" timestamp with time zone, "version_number" integer, "answers" "jsonb", "signoffs" "jsonb")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission_id uuid;
begin
  select commission_id into v_commission_id from public.forms where id = p_form_id;
  if v_commission_id is null or not (app.is_staff_admin_of(v_commission_id) or app.is_admin()) then
    return;
  end if;

  return query
  select r.id,
         pr.full_name as member_name,
         r.submitted_at,
         fv.version_number,
         -- answers: question_key -> display text. Arrays (checkbox) are joined
         -- with '; '; scalars are taken as text. Display items have no
         -- question_key (excluded by the join to answers).
         coalesce(
           (select jsonb_object_agg(
              a.question_key,
              case
                when jsonb_typeof(a.value) = 'array'
                  then (select string_agg(elem, '; ')
                        from jsonb_array_elements_text(a.value) as elem)
                else a.value #>> '{}'
              end)
            from public.answers a
            where a.response_id = r.id and a.value is not null),
           '{}'::jsonb) as answers,
         -- signoffs: section title -> 'Assinada' for every requires_signoff
         -- section of THIS response's version that has a sign-off row; 'Pendente'
         -- otherwise. Keyed by a stable label so the route can build columns.
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

CREATE OR REPLACE FUNCTION "public"."dashboard_form_totals"("p_commission_id" "uuid", "p_from" "date" DEFAULT NULL::"date", "p_to" "date" DEFAULT NULL::"date") RETURNS TABLE("form_id" "uuid", "title" "text", "total_submitted" bigint, "last_submitted_at" timestamp with time zone)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
begin
  if not (app.is_staff_admin_of(p_commission_id) or app.is_admin()) then
    return;
  end if;

  return query
  select f.id,
         f.title,
         count(sr.id) as total_submitted,
         max(sr.submitted_at) as last_submitted_at
  from public.forms f
  cross join lateral app.submitted_form_responses(f.id) sr
  where f.commission_id = p_commission_id
    and (p_from is null or sr.submitted_at::date >= p_from)
    and (p_to   is null or sr.submitted_at::date <= p_to)
  group by f.id, f.title
  having count(sr.id) > 0
  order by max(sr.submitted_at) desc nulls last, f.title;
end;
$$;

ALTER FUNCTION "public"."dashboard_form_totals"("p_commission_id" "uuid", "p_from" "date", "p_to" "date") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."dashboard_free_text"("p_form_id" "uuid", "p_from" "date" DEFAULT NULL::"date", "p_to" "date" DEFAULT NULL::"date", "p_limit" integer DEFAULT 50) RETURNS TABLE("question_key" "text", "label" "text", "section_title" "text", "section_position" integer, "item_position" integer, "total" bigint, "sample_value" "text")
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
  resp as (
    select sr.id
    from app.submitted_form_responses(p_form_id) sr
    where (p_from is null or sr.submitted_at::date >= p_from)
      and (p_to   is null or sr.submitted_at::date <= p_to)
  ),
  ans as (
    select a.question_key, a.value, a.response_id
    from public.answers a
    join resp on resp.id = a.response_id
    join public.form_items fi on fi.id = a.item_id
    where a.value is not null
      and fi.item_type = 'free_text'
  ),
  totals as (
    select ans.question_key as qk, count(*) as total from ans group by ans.question_key
  ),
  ranked as (
    select ans.question_key as qk,
           ans.value #>> '{}' as sample_value,
           row_number() over (partition by ans.question_key order by ans.response_id) as rn
    from ans
  ),
  meta as (
    select fi.question_key, fi.label, fs.title as section_title,
           fs.position as section_position, fi.position as item_position
    from public.form_items fi
    join public.form_sections fs on fs.id = fi.section_id
    where fi.form_version_id = v_latest
      and fi.item_type = 'free_text'
  )
  select r.qk as question_key,
         coalesce(m.label, r.qk) as label,
         m.section_title,
         coalesce(m.section_position, 0) as section_position,
         coalesce(m.item_position, 0) as item_position,
         coalesce(tt.total, 0) as total,
         r.sample_value
  from ranked r
  left join totals tt on tt.qk = r.qk
  left join meta m on m.question_key = r.qk
  where r.rn <= greatest(p_limit, 1)
  order by coalesce(m.section_position, 0),
           coalesce(m.item_position, 0),
           r.qk,
           r.rn;
end;
$$;

ALTER FUNCTION "public"."dashboard_free_text"("p_form_id" "uuid", "p_from" "date", "p_to" "date", "p_limit" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."dashboard_submissions_over_time"("p_form_id" "uuid", "p_from" "date" DEFAULT NULL::"date", "p_to" "date" DEFAULT NULL::"date") RETURNS TABLE("day" "date", "count" bigint)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission_id uuid;
begin
  select commission_id into v_commission_id from public.forms where id = p_form_id;
  if v_commission_id is null or not (app.is_staff_admin_of(v_commission_id) or app.is_admin()) then
    return;
  end if;

  return query
  select sr.submitted_at::date as day, count(*) as count
  from app.submitted_form_responses(p_form_id) sr
  where (p_from is null or sr.submitted_at::date >= p_from)
    and (p_to   is null or sr.submitted_at::date <= p_to)
  group by sr.submitted_at::date
  order by day;
end;
$$;

ALTER FUNCTION "public"."dashboard_submissions_over_time"("p_form_id" "uuid", "p_from" "date", "p_to" "date") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_response_for_signoff"("p_response_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_response public.responses;
  v_answers jsonb;
  v_has_pending boolean;
  v_result jsonb;
begin
  select * into v_response
  from public.responses
  where id = p_response_id;

  -- Gate 1: exists + in_progress.
  if v_response.id is null or v_response.status <> 'in_progress' then
    raise exception 'resposta % não encontrada', p_response_id
      using errcode = 'no_data_found';
  end if;

  -- Gate 2: caller is a staff_admin of the response's commission.
  if not app.is_staff_admin_of(v_response.commission_id) then
    raise exception 'resposta % não encontrada', p_response_id
      using errcode = 'no_data_found';
  end if;

  v_answers := app.answer_map(p_response_id);

  -- Gate 3: there is a pending (visible + unsigned) staff_admin sign-off
  -- section. The read right is scoped to the act of signing — no pending
  -- staff_admin section means no definer read.
  select exists (
    select 1
    from public.form_sections s
    where s.form_version_id = v_response.form_version_id
      and s.requires_signoff = true
      and s.signoff_role = 'staff_admin'
      and app.eval_condition(s.visible_when, v_answers)
      and not exists (
        select 1 from public.response_section_signoffs so
        where so.response_id = p_response_id
          and so.section_id = s.id
      )
  ) into v_has_pending;

  if not v_has_pending then
    raise exception 'resposta % não encontrada', p_response_id
      using errcode = 'no_data_found';
  end if;

  select jsonb_build_object(
    'response_id', v_response.id,
    'form_version_id', v_response.form_version_id,
    'commission_id', v_response.commission_id,
    'status', v_response.status,
    'form_id', (select fv.form_id from public.form_versions fv where fv.id = v_response.form_version_id),
    'form_title', (
      select f.title from public.forms f
      join public.form_versions fv on fv.form_id = f.id
      where fv.id = v_response.form_version_id),
    'respondent_id', v_response.created_by,
    'respondent_name', (select full_name from public.profiles where id = v_response.created_by),
    'started_at', v_response.started_at,
    'updated_at', v_response.updated_at,
    'answers', v_answers,
    'answers_by_item', coalesce(
      (select jsonb_object_agg(a.item_id::text, a.value)
       from public.answers a
       where a.response_id = p_response_id and a.value is not null),
      '{}'::jsonb),
    'signoffs', coalesce(
      (select jsonb_agg(jsonb_build_object(
          'section_id', so.section_id,
          'signed_by', so.signed_by,
          'signed_by_name', sp.full_name,
          'signed_at', so.signed_at,
          'note', so.note
        ) order by so.signed_at)
       from public.response_section_signoffs so
       join public.profiles sp on sp.id = so.signed_by
       where so.response_id = p_response_id),
      '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

ALTER FUNCTION "public"."get_response_for_signoff"("p_response_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."guard_published_structure"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_version_id uuid;
  v_status text;
begin
  v_version_id := case when tg_op = 'DELETE' then old.form_version_id else new.form_version_id end;

  select status into v_status from public.form_versions where id = v_version_id;

  if v_status is distinct from 'draft' then
    raise exception '% on a % version''s structure is blocked (immutable)', tg_op, v_status
      using errcode = 'check_violation';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

ALTER FUNCTION "public"."guard_published_structure"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."guard_published_version"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'published' then
      raise exception 'published versions are immutable (delete blocked)'
        using errcode = 'check_violation';
    end if;
    return old;
  end if;

  -- UPDATE. Status transitions are only permitted inside publish_form_version.
  if new.status is distinct from old.status then
    if coalesce(current_setting('app.in_publish_rpc', true), 'off') <> 'on' then
      raise exception 'version status changes must go through publish_form_version()'
        using errcode = 'check_violation';
    end if;
    return new;
  end if;

  -- Non-status update: forbidden once the version is no longer a draft.
  if old.status <> 'draft' then
    raise exception 'published/archived versions are immutable (update blocked)'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

ALTER FUNCTION "public"."guard_published_version"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."guard_response_version_commission"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_commission uuid;
begin
  select f.commission_id into v_commission
  from public.form_versions v
  join public.forms f on f.id = v.form_id
  where v.id = new.form_version_id;

  if v_commission is null then
    raise exception 'form_version % does not exist', new.form_version_id
      using errcode = 'foreign_key_violation';
  end if;

  if v_commission <> new.commission_id then
    raise exception 'response.form_version_id % does not belong to commission %',
      new.form_version_id, new.commission_id
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

ALTER FUNCTION "public"."guard_response_version_commission"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."guard_submitted_children"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_response_id uuid;
  v_status text;
begin
  v_response_id := case when tg_op = 'DELETE' then old.response_id else new.response_id end;

  select status into v_status from public.responses where id = v_response_id;

  if v_status = 'submitted'
     and coalesce(current_setting('app.in_submit_rpc', true), 'off') <> 'on' then
    raise exception '% on a submitted response is blocked (immutable)', tg_op
      using errcode = 'check_violation';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

ALTER FUNCTION "public"."guard_submitted_children"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."guard_submitted_response"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'submitted' then
      raise exception 'submitted responses are immutable (delete blocked)'
        using errcode = 'check_violation';
    end if;
    return old;
  end if;

  -- UPDATE: allow the RPC's in_progress -> submitted transition.
  if old.status = 'submitted'
     and coalesce(current_setting('app.in_submit_rpc', true), 'off') <> 'on' then
    raise exception 'submitted responses are immutable (update blocked)'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

ALTER FUNCTION "public"."guard_submitted_response"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."list_signoff_queue"("p_commission_id" "uuid") RETURNS TABLE("response_id" "uuid", "form_id" "uuid", "form_title" "text", "version_number" integer, "respondent_id" "uuid", "respondent_name" "text", "section_id" "uuid", "section_title" "text", "pending_count" integer, "started_at" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
begin
  -- Internal gate: non-staff_admins get an empty set (no leak, no error).
  if not app.is_staff_admin_of(p_commission_id) then
    return;
  end if;

  return query
  with candidate as (
    select r.id,
           r.form_version_id,
           r.created_by,
           r.started_at,
           r.updated_at,
           app.answer_map(r.id) as answers
    from public.responses r
    where r.commission_id = p_commission_id
      and r.status = 'in_progress'
  ),
  pending_sections as (
    -- Visible, unsigned, staff_admin-role sign-off sections of each candidate.
    select c.id as response_id,
           s.id as section_id,
           s.title as section_title,
           s.position
    from candidate c
    join public.form_sections s
      on s.form_version_id = c.form_version_id
     and s.requires_signoff = true
     and s.signoff_role = 'staff_admin'
    where app.eval_condition(s.visible_when, c.answers)
      and not exists (
        select 1 from public.response_section_signoffs so
        where so.response_id = c.id
          and so.section_id = s.id
      )
  ),
  ranked as (
    -- One representative pending section per response (lowest position) + count.
    select ps.response_id,
           ps.section_id,
           ps.section_title,
           count(*) over (partition by ps.response_id) as pending_count,
           row_number() over (partition by ps.response_id order by ps.position) as rn
    from pending_sections ps
  )
  select c.id,
         fv.form_id,
         f.title,
         fv.version_number,
         c.created_by,
         p.full_name,
         rk.section_id,
         rk.section_title,
         rk.pending_count::integer,
         c.started_at,
         c.updated_at
  from candidate c
  join ranked rk on rk.response_id = c.id and rk.rn = 1
  join public.form_versions fv on fv.id = c.form_version_id
  join public.forms f on f.id = fv.form_id
  join public.profiles p on p.id = c.created_by
  -- Submit-readiness: don't surface drafts that can't be submitted even once
  -- the staff_admin signs (missing required answers in visible sections).
  where app.response_required_complete(c.id)
  order by c.updated_at desc;
end;
$$;

ALTER FUNCTION "public"."list_signoff_queue"("p_commission_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."publish_form_version"("p_form_version_id" "uuid") RETURNS "public"."form_versions"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_form_id uuid;
  v_status text;
  v_result public.form_versions;
begin
  select form_id, status into v_form_id, v_status
  from public.form_versions
  where id = p_form_version_id
  for update;

  if v_form_id is null then
    raise exception 'versão % não encontrada', p_form_version_id
      using errcode = 'no_data_found';
  end if;

  if v_status <> 'draft' then
    raise exception 'apenas versões em rascunho podem ser publicadas'
      using errcode = 'check_violation';
  end if;

  perform public.validate_visible_when(p_form_version_id);

  perform set_config('app.in_publish_rpc', 'on', true);

  update public.form_versions
  set status = 'archived'
  where form_id = v_form_id
    and status = 'published';

  update public.form_versions
  set status = 'published', published_at = now()
  where id = p_form_version_id
  returning * into v_result;

  perform set_config('app.in_publish_rpc', 'off', true);

  return v_result;
end;
$$;

ALTER FUNCTION "public"."publish_form_version"("p_form_version_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."reject_answer_on_display_item"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_item_type text;
begin
  select item_type into v_item_type
  from public.form_items
  where id = new.item_id;

  if v_item_type is null then
    raise exception 'answers.item_id % does not exist', new.item_id;
  end if;

  if v_item_type in ('section_text', 'image') then
    raise exception 'cannot record an answer for display item % (type %)',
      new.item_id, v_item_type
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

ALTER FUNCTION "public"."reject_answer_on_display_item"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."save_section_answers"("p_response_id" "uuid", "p_section_id" "uuid", "p_answers" "jsonb" DEFAULT '{}'::"jsonb", "p_clear_item_ids" "uuid"[] DEFAULT NULL::"uuid"[]) RETURNS "public"."responses"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_version_id uuid;
  v_status text;
  v_result public.responses;
  v_bad_item uuid;
  v_section_version uuid;
begin
  -- Existence + status guard. RLS already confines this SELECT to rows the
  -- caller may read (their own response, or a submitted one in their commission
  -- if staff_admin) — so a foreign in_progress draft reads as "not found".
  select form_version_id, status into v_version_id, v_status
  from public.responses
  where id = p_response_id;

  if v_version_id is null then
    raise exception 'resposta % não encontrada', p_response_id
      using errcode = 'no_data_found';
  end if;

  if v_status <> 'in_progress' then
    raise exception 'esta resposta já foi enviada e não pode mais ser editada'
      using errcode = 'check_violation';
  end if;

  -- Cross-version section guard (Phase-5 QA MINOR-1): the saved section (which
  -- becomes last_section_id) must belong to this response's version. The FK
  -- guarantees the section EXISTS; this rejects a section from a DIFFERENT
  -- version of the same (or any) form. Distinct SQLSTATE P0013 so the action
  -- layer no longer mislabels it "já enviada".
  select form_version_id into v_section_version
  from public.form_sections
  where id = p_section_id;

  if v_section_version is null or v_section_version <> v_version_id then
    raise exception 'a seção % não pertence a esta versão do formulário', p_section_id
      using errcode = 'HC013';
  end if;

  -- Cross-version item guard: reject any answered item that does not belong to
  -- this response's version. (Display items are rejected separately by the M4
  -- trigger on insert.) Distinct SQLSTATE P0013 (Phase-5 QA MINOR-2).
  if p_answers is not null and p_answers <> '{}'::jsonb then
    select (e.key)::uuid into v_bad_item
    from jsonb_each(p_answers) e
    where not exists (
      select 1 from public.form_items i
      where i.id = (e.key)::uuid
        and i.form_version_id = v_version_id
    )
    limit 1;

    if v_bad_item is not null then
      raise exception 'o item % não pertence a esta versão do formulário', v_bad_item
        using errcode = 'HC013';
    end if;

    -- Upsert one answer row per input item. question_key is taken from the
    -- target item; value is stored as provided (the wizard sends only answered
    -- inputs — clearing is done via p_clear_item_ids, not by sending nulls).
    insert into public.answers (response_id, item_id, question_key, value)
    select p_response_id, i.id, i.question_key, e.value
    from jsonb_each(p_answers) e
    join public.form_items i on i.id = (e.key)::uuid
    on conflict (response_id, item_id)
    do update set value = excluded.value,
                  question_key = excluded.question_key;
  end if;

  -- Orphan-clear (warn-and-clear): delete answers of items the wizard reported
  -- as now-hidden. RLS (answers_write_own_draft) confines this to the caller's
  -- own in_progress response.
  if p_clear_item_ids is not null and array_length(p_clear_item_ids, 1) is not null then
    delete from public.answers
    where response_id = p_response_id
      and item_id = any (p_clear_item_ids);
  end if;

  -- Persist wizard position + touch updated_at (resume lands here).
  update public.responses
  set last_section_id = p_section_id,
      updated_at = now()
  where id = p_response_id
  returning * into v_result;

  return v_result;
end;
$$;

ALTER FUNCTION "public"."save_section_answers"("p_response_id" "uuid", "p_section_id" "uuid", "p_answers" "jsonb", "p_clear_item_ids" "uuid"[]) OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."response_section_signoffs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "response_id" "uuid" NOT NULL,
    "section_id" "uuid" NOT NULL,
    "signed_by" "uuid" NOT NULL,
    "signed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "note" "text"
);

ALTER TABLE "public"."response_section_signoffs" OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."sign_section"("p_response_id" "uuid", "p_section_id" "uuid", "p_note" "text" DEFAULT NULL::"text") RETURNS "public"."response_section_signoffs"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_status text;
  v_version_id uuid;
  v_requires_signoff boolean;
  v_visible_when jsonb;
  v_found boolean := false;
  v_answers jsonb;
  v_result public.response_section_signoffs;
begin
  -- Definer-rights metadata read (see header). No row -> response not found.
  for v_status, v_version_id, v_requires_signoff, v_visible_when in
    select t.status, t.version_id, t.requires_signoff, t.visible_when
    from app.signoff_target(p_response_id, p_section_id) t
  loop
    v_found := true;
  end loop;

  if not v_found then
    raise exception 'resposta % não encontrada', p_response_id
      using errcode = 'no_data_found';
  end if;

  if v_status <> 'in_progress' then
    raise exception 'esta resposta já foi enviada e não pode mais ser assinada'
      using errcode = 'check_violation';
  end if;

  -- requires_signoff null means the section does not belong to this response's
  -- version (the LEFT JOIN found no matching section).
  if v_requires_signoff is null then
    raise exception 'seção % não pertence a esta resposta', p_section_id
      using errcode = 'check_violation';
  end if;

  if not v_requires_signoff then
    raise exception 'esta seção não exige assinatura'
      using errcode = 'check_violation';
  end if;

  -- Visibility precondition (Architecture Rule 4): a section hidden under the
  -- response's saved answers collects no sign-off. RLS cannot cheaply evaluate
  -- this (it would have to read answers from within a signoffs policy), so the
  -- RPC owns it.
  v_answers := app.answer_map(p_response_id);
  if not app.eval_condition(v_visible_when, v_answers) then
    raise exception 'esta seção não está disponível para assinatura'
      using errcode = 'HC014';
  end if;

  -- The insert is the authority for WHO may sign (signoffs_insert WITH CHECK:
  -- respondent -> creator, staff_admin -> is_staff_admin_of, signed_by =
  -- auth.uid(), in_progress). The unique(response_id, section_id) index turns a
  -- double-sign race into a discriminated "already signed".
  begin
    insert into public.response_section_signoffs (response_id, section_id, signed_by, note)
    values (p_response_id, p_section_id, auth.uid(), nullif(btrim(p_note), ''))
    returning * into v_result;
  exception
    when unique_violation then
      raise exception 'esta seção já foi assinada'
        using errcode = 'HC015';
  end;

  return v_result;
end;
$$;

ALTER FUNCTION "public"."sign_section"("p_response_id" "uuid", "p_section_id" "uuid", "p_note" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."start_or_resume_response"("p_form_version_id" "uuid") RETURNS "public"."responses"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_commission_id uuid;
  v_status text;
  v_uid uuid := auth.uid();
  v_result public.responses;
begin
  -- Resolve the version's form/commission and its lifecycle status.
  select f.commission_id, v.status
    into v_commission_id, v_status
  from public.form_versions v
  join public.forms f on f.id = v.form_id
  where v.id = p_form_version_id;

  if v_commission_id is null then
    raise exception 'versão % não encontrada', p_form_version_id
      using errcode = 'no_data_found';
  end if;

  -- Server backstop: only published versions are fillable (the query layer
  -- lists published only, but a hand-crafted call must not start a draft on an
  -- unpublished/archived version).
  if v_status <> 'published' then
    raise exception 'este formulário não está publicado'
      using errcode = 'check_violation';
  end if;

  -- Resume: hand back the caller's existing in_progress draft if one exists.
  select * into v_result
  from public.responses
  where form_version_id = p_form_version_id
    and created_by = v_uid
    and status = 'in_progress';

  if v_result.id is not null then
    return v_result;
  end if;

  -- Create. The unique index guards against a concurrent create winning the
  -- race; on conflict, re-read and return the surviving draft.
  begin
    insert into public.responses (form_version_id, commission_id, created_by, status)
    values (p_form_version_id, v_commission_id, v_uid, 'in_progress')
    returning * into v_result;
  exception
    when unique_violation then
      select * into v_result
      from public.responses
      where form_version_id = p_form_version_id
        and created_by = v_uid
        and status = 'in_progress';
  end;

  return v_result;
end;
$$;

ALTER FUNCTION "public"."start_or_resume_response"("p_form_version_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."submit_response"("p_response_id" "uuid") RETURNS "public"."responses"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_response public.responses;
  v_answers jsonb;
  r_section record;
  v_visible boolean;
  v_missing_count integer;
  v_signoff_exists boolean;
  v_result public.responses;
begin
  -- Read without FOR UPDATE first: a submitted response is readable by its
  -- creator (responses_select) but is NOT lockable under the in_progress-only
  -- update policy, so a FOR UPDATE here would hide an already-submitted row and
  -- mask the double-submit case as "not found".
  select * into v_response
  from public.responses
  where id = p_response_id;

  if v_response.id is null then
    raise exception 'resposta % não encontrada', p_response_id
      using errcode = 'no_data_found';
  end if;

  if v_response.status = 'submitted' then
    raise exception 'esta resposta já foi enviada'
      using errcode = 'HC010';
  end if;

  -- Lock the in_progress row for the duration of the submission.
  perform 1 from public.responses
  where id = p_response_id and status = 'in_progress'
  for update;

  v_answers := app.answer_map(p_response_id);

  -- Walk sections in position order; a hidden section requires nothing and its
  -- answers are stray.
  for r_section in
    select s.id, s.position, s.visible_when, s.requires_signoff
    from public.form_sections s
    where s.form_version_id = v_response.form_version_id
    order by s.position
  loop
    v_visible := app.eval_condition(r_section.visible_when, v_answers);

    if not v_visible then
      -- Stray-answer cleanup: remove any answers saved while the section was
      -- visible but now hidden under final answers.
      perform set_config('app.in_submit_rpc', 'on', true);
      delete from public.answers a
      using public.form_items i
      where a.response_id = p_response_id
        and a.item_id = i.id
        and i.section_id = r_section.id;
      perform set_config('app.in_submit_rpc', 'off', true);
      continue;
    end if;

    -- Required-answer check: every required input item must have a non-null
    -- answer.
    select count(*) into v_missing_count
    from public.form_items i
    where i.section_id = r_section.id
      and i.required = true
      and i.question_key is not null
      and not exists (
        select 1 from public.answers a
        where a.response_id = p_response_id
          and a.item_id = i.id
          and a.value is not null
          and a.value <> 'null'::jsonb
      );

    if v_missing_count > 0 then
      raise exception 'há perguntas obrigatórias sem resposta'
        using errcode = 'HC011';
    end if;

    -- Sign-off check (feature-flagged; OFF until Phase 6).
    if r_section.requires_signoff and app.feature_enabled('signoff_enforcement') then
      select exists (
        select 1 from public.response_section_signoffs so
        where so.response_id = p_response_id
          and so.section_id = r_section.id
      ) into v_signoff_exists;

      if not v_signoff_exists then
        raise exception 'há seções pendentes de assinatura'
          using errcode = 'HC012';
      end if;
    end if;
  end loop;

  -- Atomic status flip (permitted by the submitted-immutability guard).
  perform set_config('app.in_submit_rpc', 'on', true);
  update public.responses
  set status = 'submitted', submitted_at = now(), updated_at = now()
  where id = p_response_id
  returning * into v_result;
  perform set_config('app.in_submit_rpc', 'off', true);

  return v_result;
end;
$$;

ALTER FUNCTION "public"."submit_response"("p_response_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."validate_visible_when"("p_form_version_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  r record;
  v_first_position integer;
  v_ref_min_position integer;
begin
  select min(position) into v_first_position
  from public.form_sections
  where form_version_id = p_form_version_id;

  for r in
    select id, position, title, visible_when
    from public.form_sections
    where form_version_id = p_form_version_id
      and visible_when is not null
    order by position
  loop
    if r.position = v_first_position then
      raise exception
        'a primeira seção não pode ter condição de visibilidade (seção "%")',
        coalesce(r.title, '(padrão)')
        using errcode = 'check_violation';
    end if;

    -- The referenced key must exist as an input item in some EARLIER section.
    select min(s.position) into v_ref_min_position
    from public.form_items i
    join public.form_sections s on s.id = i.section_id
    where i.form_version_id = p_form_version_id
      and i.question_key = (r.visible_when ->> 'question_key');

    if v_ref_min_position is null then
      raise exception
        'a condição da seção "%" referencia a pergunta "%", que não existe nesta versão',
        coalesce(r.title, '(padrão)'), (r.visible_when ->> 'question_key')
        using errcode = 'check_violation';
    end if;

    if v_ref_min_position >= r.position then
      raise exception
        'a condição da seção "%" deve referenciar uma pergunta de uma seção anterior',
        coalesce(r.title, '(padrão)')
        using errcode = 'check_violation';
    end if;
  end loop;

  return true;
end;
$$;

ALTER FUNCTION "public"."validate_visible_when"("p_form_version_id" "uuid") OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."answers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "response_id" "uuid" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "question_key" "text" NOT NULL,
    "value" "jsonb"
);

ALTER TABLE "public"."answers" OWNER TO "postgres";

ALTER TABLE ONLY "public"."answers"
    ADD CONSTRAINT "answers_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."answers"
    ADD CONSTRAINT "answers_response_id_item_id_key" UNIQUE ("response_id", "item_id");

ALTER TABLE ONLY "public"."response_section_signoffs"
    ADD CONSTRAINT "response_section_signoffs_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."response_section_signoffs"
    ADD CONSTRAINT "response_section_signoffs_response_id_section_id_key" UNIQUE ("response_id", "section_id");

ALTER TABLE ONLY "public"."responses"
    ADD CONSTRAINT "responses_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."answers"
    ADD CONSTRAINT "answers_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."form_items"("id");

ALTER TABLE ONLY "public"."answers"
    ADD CONSTRAINT "answers_response_id_fkey" FOREIGN KEY ("response_id") REFERENCES "public"."responses"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."response_section_signoffs"
    ADD CONSTRAINT "response_section_signoffs_response_id_fkey" FOREIGN KEY ("response_id") REFERENCES "public"."responses"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."response_section_signoffs"
    ADD CONSTRAINT "response_section_signoffs_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "public"."form_sections"("id");

ALTER TABLE ONLY "public"."response_section_signoffs"
    ADD CONSTRAINT "response_section_signoffs_signed_by_fkey" FOREIGN KEY ("signed_by") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."responses"
    ADD CONSTRAINT "responses_commission_id_fkey" FOREIGN KEY ("commission_id") REFERENCES "public"."commissions"("id");

ALTER TABLE ONLY "public"."responses"
    ADD CONSTRAINT "responses_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."responses"
    ADD CONSTRAINT "responses_form_version_id_fkey" FOREIGN KEY ("form_version_id") REFERENCES "public"."form_versions"("id");

ALTER TABLE ONLY "public"."responses"
    ADD CONSTRAINT "responses_last_section_id_fkey" FOREIGN KEY ("last_section_id") REFERENCES "public"."form_sections"("id");

CREATE INDEX "answers_item_idx" ON "public"."answers" USING "btree" ("item_id");

CREATE INDEX "answers_question_key_idx" ON "public"."answers" USING "btree" ("question_key");

CREATE INDEX "answers_response_idx" ON "public"."answers" USING "btree" ("response_id");

CREATE INDEX "responses_case_phase_idx" ON "public"."responses" USING "btree" ("case_phase_id");

CREATE INDEX "responses_commission_idx" ON "public"."responses" USING "btree" ("commission_id");

CREATE INDEX "responses_created_by_idx" ON "public"."responses" USING "btree" ("created_by");

CREATE UNIQUE INDEX "responses_one_draft_per_user_idx" ON "public"."responses" USING "btree" ("form_version_id", "created_by") WHERE (("status" = 'in_progress'::"text") AND ("case_phase_id" IS NULL));

CREATE UNIQUE INDEX "responses_one_per_case_phase_idx" ON "public"."responses" USING "btree" ("case_phase_id") WHERE ("case_phase_id" IS NOT NULL);

CREATE INDEX "responses_version_idx" ON "public"."responses" USING "btree" ("form_version_id");

CREATE INDEX "signoffs_response_idx" ON "public"."response_section_signoffs" USING "btree" ("response_id");

CREATE OR REPLACE TRIGGER "guard_published_items_trg" BEFORE INSERT OR DELETE OR UPDATE ON "public"."form_items" FOR EACH ROW EXECUTE FUNCTION "public"."guard_published_structure"();

CREATE OR REPLACE TRIGGER "guard_published_sections_trg" BEFORE INSERT OR DELETE OR UPDATE ON "public"."form_sections" FOR EACH ROW EXECUTE FUNCTION "public"."guard_published_structure"();

CREATE OR REPLACE TRIGGER "guard_published_version_trg" BEFORE DELETE OR UPDATE ON "public"."form_versions" FOR EACH ROW EXECUTE FUNCTION "public"."guard_published_version"();

CREATE OR REPLACE TRIGGER "guard_response_version_commission_trg" BEFORE INSERT OR UPDATE OF "form_version_id", "commission_id" ON "public"."responses" FOR EACH ROW EXECUTE FUNCTION "public"."guard_response_version_commission"();

CREATE OR REPLACE TRIGGER "guard_submitted_answers_trg" BEFORE INSERT OR DELETE OR UPDATE ON "public"."answers" FOR EACH ROW EXECUTE FUNCTION "public"."guard_submitted_children"();

CREATE OR REPLACE TRIGGER "guard_submitted_response_trg" BEFORE DELETE OR UPDATE ON "public"."responses" FOR EACH ROW EXECUTE FUNCTION "public"."guard_submitted_response"();

CREATE OR REPLACE TRIGGER "guard_submitted_signoffs_trg" BEFORE INSERT OR DELETE OR UPDATE ON "public"."response_section_signoffs" FOR EACH ROW EXECUTE FUNCTION "public"."guard_submitted_children"();

CREATE OR REPLACE TRIGGER "reject_answer_on_display_item_trg" BEFORE INSERT OR UPDATE ON "public"."answers" FOR EACH ROW EXECUTE FUNCTION "public"."reject_answer_on_display_item"();

ALTER TABLE "public"."answers" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."response_section_signoffs" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."responses" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "answers_select" ON "public"."answers" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."responses" "r"
  WHERE (("r"."id" = "answers"."response_id") AND (("r"."created_by" = "auth"."uid"()) OR "app"."is_admin"() OR (("r"."status" = 'submitted'::"text") AND "app"."is_staff_admin_of"("r"."commission_id")))))));

CREATE POLICY "answers_write_own_draft" ON "public"."answers" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."responses" "r"
  WHERE (("r"."id" = "answers"."response_id") AND ("r"."created_by" = "auth"."uid"()) AND ("r"."status" = 'in_progress'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."responses" "r"
  WHERE (("r"."id" = "answers"."response_id") AND ("r"."created_by" = "auth"."uid"()) AND ("r"."status" = 'in_progress'::"text")))));

CREATE POLICY "responses_admin_all" ON "public"."responses" TO "authenticated" USING ("app"."is_admin"()) WITH CHECK ("app"."is_admin"());

CREATE POLICY "responses_insert_own" ON "public"."responses" FOR INSERT TO "authenticated" WITH CHECK ((("created_by" = "auth"."uid"()) AND "app"."is_member_of"("commission_id")));

CREATE POLICY "responses_select" ON "public"."responses" FOR SELECT TO "authenticated" USING ((("created_by" = "auth"."uid"()) OR "app"."is_admin"() OR (("status" = 'submitted'::"text") AND "app"."is_staff_admin_of"("commission_id"))));

CREATE POLICY "responses_update_own_draft" ON "public"."responses" FOR UPDATE TO "authenticated" USING ((("created_by" = "auth"."uid"()) AND ("status" = 'in_progress'::"text"))) WITH CHECK (("created_by" = "auth"."uid"()));

CREATE POLICY "signoffs_insert" ON "public"."response_section_signoffs" FOR INSERT TO "authenticated" WITH CHECK ((("signed_by" = "auth"."uid"()) AND "app"."can_sign_section"("response_id", "section_id", "auth"."uid"())));

CREATE POLICY "signoffs_select" ON "public"."response_section_signoffs" FOR SELECT TO "authenticated" USING ("app"."can_read_signoff"("response_id"));

GRANT ALL ON FUNCTION "app"."answer_map"("p_response_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "app"."answer_map"("p_response_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "app"."can_read_signoff"("p_response_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."can_read_signoff"("p_response_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "app"."can_read_signoff"("p_response_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "app"."can_sign_section"("p_response_id" "uuid", "p_section_id" "uuid", "p_signer" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."can_sign_section"("p_response_id" "uuid", "p_section_id" "uuid", "p_signer" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "app"."can_sign_section"("p_response_id" "uuid", "p_section_id" "uuid", "p_signer" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "app"."eval_condition"("p_visible_when" "jsonb", "p_answers" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "app"."eval_condition"("p_visible_when" "jsonb", "p_answers" "jsonb") TO "service_role";

GRANT ALL ON FUNCTION "app"."latest_published_version"("p_form_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "app"."latest_published_version"("p_form_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "app"."response_required_complete"("p_response_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."response_required_complete"("p_response_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "app"."response_required_complete"("p_response_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "app"."signoff_target"("p_response_id" "uuid", "p_section_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."signoff_target"("p_response_id" "uuid", "p_section_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "app"."signoff_target"("p_response_id" "uuid", "p_section_id" "uuid") TO "service_role";

GRANT ALL ON TABLE "public"."responses" TO "authenticated";
GRANT ALL ON TABLE "public"."responses" TO "service_role";

GRANT ALL ON FUNCTION "app"."submitted_form_responses"("p_form_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "app"."submitted_form_responses"("p_form_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."commission_overview"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."commission_overview"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."commission_overview"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."dashboard_completion_by_member"("p_form_id" "uuid", "p_from" "date", "p_to" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."dashboard_completion_by_member"("p_form_id" "uuid", "p_from" "date", "p_to" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."dashboard_completion_by_member"("p_form_id" "uuid", "p_from" "date", "p_to" "date") TO "service_role";

REVOKE ALL ON FUNCTION "public"."dashboard_distributions"("p_form_id" "uuid", "p_from" "date", "p_to" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."dashboard_distributions"("p_form_id" "uuid", "p_from" "date", "p_to" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."dashboard_distributions"("p_form_id" "uuid", "p_from" "date", "p_to" "date") TO "service_role";

REVOKE ALL ON FUNCTION "public"."dashboard_export_rows"("p_form_id" "uuid", "p_from" "date", "p_to" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."dashboard_export_rows"("p_form_id" "uuid", "p_from" "date", "p_to" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."dashboard_export_rows"("p_form_id" "uuid", "p_from" "date", "p_to" "date") TO "service_role";

REVOKE ALL ON FUNCTION "public"."dashboard_form_totals"("p_commission_id" "uuid", "p_from" "date", "p_to" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."dashboard_form_totals"("p_commission_id" "uuid", "p_from" "date", "p_to" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."dashboard_form_totals"("p_commission_id" "uuid", "p_from" "date", "p_to" "date") TO "service_role";

REVOKE ALL ON FUNCTION "public"."dashboard_free_text"("p_form_id" "uuid", "p_from" "date", "p_to" "date", "p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."dashboard_free_text"("p_form_id" "uuid", "p_from" "date", "p_to" "date", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."dashboard_free_text"("p_form_id" "uuid", "p_from" "date", "p_to" "date", "p_limit" integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."dashboard_submissions_over_time"("p_form_id" "uuid", "p_from" "date", "p_to" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."dashboard_submissions_over_time"("p_form_id" "uuid", "p_from" "date", "p_to" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."dashboard_submissions_over_time"("p_form_id" "uuid", "p_from" "date", "p_to" "date") TO "service_role";

REVOKE ALL ON FUNCTION "public"."get_response_for_signoff"("p_response_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_response_for_signoff"("p_response_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_response_for_signoff"("p_response_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."guard_published_structure"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."guard_published_structure"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."guard_published_structure"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."guard_published_version"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."guard_published_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."guard_published_version"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."guard_response_version_commission"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."guard_response_version_commission"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."guard_response_version_commission"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."guard_submitted_children"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."guard_submitted_children"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."guard_submitted_children"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."guard_submitted_response"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."guard_submitted_response"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."guard_submitted_response"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."list_signoff_queue"("p_commission_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."list_signoff_queue"("p_commission_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_signoff_queue"("p_commission_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."publish_form_version"("p_form_version_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."publish_form_version"("p_form_version_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."publish_form_version"("p_form_version_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."reject_answer_on_display_item"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reject_answer_on_display_item"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."reject_answer_on_display_item"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."save_section_answers"("p_response_id" "uuid", "p_section_id" "uuid", "p_answers" "jsonb", "p_clear_item_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."save_section_answers"("p_response_id" "uuid", "p_section_id" "uuid", "p_answers" "jsonb", "p_clear_item_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."save_section_answers"("p_response_id" "uuid", "p_section_id" "uuid", "p_answers" "jsonb", "p_clear_item_ids" "uuid"[]) TO "service_role";

GRANT ALL ON TABLE "public"."response_section_signoffs" TO "authenticated";
GRANT ALL ON TABLE "public"."response_section_signoffs" TO "service_role";

REVOKE ALL ON FUNCTION "public"."sign_section"("p_response_id" "uuid", "p_section_id" "uuid", "p_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sign_section"("p_response_id" "uuid", "p_section_id" "uuid", "p_note" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sign_section"("p_response_id" "uuid", "p_section_id" "uuid", "p_note" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."start_or_resume_response"("p_form_version_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."start_or_resume_response"("p_form_version_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."start_or_resume_response"("p_form_version_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."submit_response"("p_response_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."submit_response"("p_response_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."submit_response"("p_response_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."validate_visible_when"("p_form_version_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."validate_visible_when"("p_form_version_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_visible_when"("p_form_version_id" "uuid") TO "service_role";

GRANT ALL ON TABLE "public"."answers" TO "authenticated";
GRANT ALL ON TABLE "public"."answers" TO "service_role";
