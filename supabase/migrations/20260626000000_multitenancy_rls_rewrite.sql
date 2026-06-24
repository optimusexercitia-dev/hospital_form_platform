-- ----------------------------------------------------------------------------
-- Multi-tenancy Phase B — RLS rewrite (the security core). Forward-only.
--
-- Scopes the blanket platform-admin (`app.is_admin()`) reach down to the org
-- level: in tenant-GOVERNANCE policies and RPC gates, `OR app.is_admin()`
-- becomes `OR app.is_org_admin_of_commission(<commission_expr>)` (the `_for`
-- variant where the predicate takes p_user_id). platform_admin is walled off
-- from tenant data (it keeps ONLY the management surface + the audit platform
-- chain). See ADR 0041, the Phase B plan, and the binding PHI ruling below.
--
-- BINDING PHI / NSP PRINCIPLE (lead ruling): org_admin is a tenant-GOVERNANCE
-- super-user, NOT a PHI/NSP actor. It NEVER gains PHI access by being org_admin
-- (same duty separation as platform_admin / pqs_members; ADR 0030/0035/0037/0038).
-- Therefore in the NSP / referral / case-PHI modules the `is_admin()` term is
-- DROPPED (no org swap) — identical to nsp-evidence storage and pqs_members.
-- Two ADR-documented admin exceptions are KEPT: PHI DISPOSAL (dispose_event_phi
-- / dispose_case_phi — admin-or-staff_admin erasure, reads no PHI) and PQS
-- ROSTER management (add/remove/list_pqs_members + pqs_members_admin_all).
--
-- Packaging: ONE reviewable migration. `CREATE OR REPLACE` for functions/RPCs,
-- `DROP POLICY` + `CREATE POLICY` for policies. The audit 3-tier canonical +
-- verify are redefined together (lockstep) in this same file.
-- ----------------------------------------------------------------------------
SET check_function_bodies = false;
SET client_min_messages = warning;

-- ===========================================================================
-- SECTION 1 — Cases PHI fork (ADR 0038): DECOUPLE can_read_case_patient from
-- can_read_case so an org_admin reads case GOVERNANCE but NEVER case PHI
-- identifiers (the MRN/name on case_patient).
--
--   can_read_case          : DROP `or is_admin_for` ; ADD org-governance term
--                            `or is_org_admin_of_commission_for(v_commission, p_uid)`
--   can_read_case_patient  : REDEFINE to the case-WORKER scope only (staff_admin
--                            + case_access + phase/narrative assignee + the PQS
--                            referral-macro term) — WITHOUT the org-admin term
--                            and WITHOUT admin. No longer delegates to
--                            can_read_case. Honors the flag-OFF member-read
--                            fallback identically.
-- ===========================================================================
CREATE OR REPLACE FUNCTION "app"."can_read_case"("p_case_id" "uuid", "p_uid" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission uuid;
begin
  select commission_id into v_commission from public.cases where id = p_case_id;
  if v_commission is null then
    return false;
  end if;

  -- QPS macro-view of any referral-touched case (unchanged; PQS, org-orthogonal).
  if app.feature_enabled('case_referrals') and app.is_pqs_member(p_uid)
     and exists (
       select 1 from public.case_referral r
       where r.source_case_id = p_case_id or r.target_case_id = p_case_id
     ) then
    return true;
  end if;

  -- Flag-OFF fallback: member-read (today's behavior). Plus the org-governance
  -- term so an org_admin reads cases in their org even with the flag off.
  if not app.feature_enabled('case_access') then
    return app.is_member_of_for(v_commission, p_uid)
        or app.is_org_admin_of_commission_for(v_commission, p_uid);
  end if;

  return
    app.is_staff_admin_of_for(v_commission, p_uid)
    -- Phase B: platform-admin term DROPPED; org-governance term ADDED.
    or app.is_org_admin_of_commission_for(v_commission, p_uid)
    or exists (
      select 1 from public.case_access ca
      where ca.case_id = p_case_id and ca.user_id = p_uid
    )
    or exists (
      select 1 from public.case_phases cp
      where cp.case_id = p_case_id and cp.assigned_to = p_uid
    )
    or exists (
      select 1 from public.case_narratives cn
      where cn.case_id = p_case_id and cn.assigned_to = p_uid
    );
end;
$$;

-- can_read_case_patient: case-WORKER scope ONLY. NO org-admin term, NO admin.
-- This is can_read_case's worker set minus the org-governance/admin terms, so an
-- org_admin (or platform admin) never reads case PHI identifiers. Writes stay
-- coordinator-only (set_case_patient / dispose_case_phi gates, Section 5).
CREATE OR REPLACE FUNCTION "app"."can_read_case_patient"("p_case_id" "uuid", "p_uid" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission uuid;
begin
  select commission_id into v_commission from public.cases where id = p_case_id;
  if v_commission is null then
    return false;
  end if;

  -- QPS macro-view of any referral-touched case (parity with can_read_case).
  if app.feature_enabled('case_referrals') and app.is_pqs_member(p_uid)
     and exists (
       select 1 from public.case_referral r
       where r.source_case_id = p_case_id or r.target_case_id = p_case_id
     ) then
    return true;
  end if;

  -- Flag-OFF fallback: member-read (matches the historical case_patient posture)
  -- but WITHOUT the org-admin term — PHI identifiers never follow org governance.
  if not app.feature_enabled('case_access') then
    return app.is_member_of_for(v_commission, p_uid);
  end if;

  return
    app.is_staff_admin_of_for(v_commission, p_uid)
    or exists (
      select 1 from public.case_access ca
      where ca.case_id = p_case_id and ca.user_id = p_uid
    )
    or exists (
      select 1 from public.case_phases cp
      where cp.case_id = p_case_id and cp.assigned_to = p_uid
    )
    or exists (
      select 1 from public.case_narratives cn
      where cn.case_id = p_case_id and cn.assigned_to = p_uid
    );
end;
$$;

-- ===========================================================================
-- SECTION 2 — Forms domain tenant policies. Mechanical swap: the additive
-- `OR is_admin()` becomes `OR is_org_admin_of_commission(<commission_expr>)`,
-- the SAME commission expression the sibling is_member_of / is_staff_admin_of
-- already uses. DROP + CREATE (RLS policies cannot be CREATE OR REPLACEd).
-- ===========================================================================
DROP POLICY "form_items_select" ON "public"."form_items";
CREATE POLICY "form_items_select" ON "public"."form_items" FOR SELECT TO "authenticated" USING (("app"."is_member_of"("app"."commission_of_version"("form_version_id")) OR "app"."is_org_admin_of_commission"("app"."commission_of_version"("form_version_id"))));

DROP POLICY "form_items_staff_admin_write" ON "public"."form_items";
CREATE POLICY "form_items_staff_admin_write" ON "public"."form_items" TO "authenticated" USING (("app"."is_staff_admin_of"("app"."commission_of_version"("form_version_id")) OR "app"."is_org_admin_of_commission"("app"."commission_of_version"("form_version_id")))) WITH CHECK (("app"."is_staff_admin_of"("app"."commission_of_version"("form_version_id")) OR "app"."is_org_admin_of_commission"("app"."commission_of_version"("form_version_id"))));

DROP POLICY "form_sections_select" ON "public"."form_sections";
CREATE POLICY "form_sections_select" ON "public"."form_sections" FOR SELECT TO "authenticated" USING (("app"."is_member_of"("app"."commission_of_version"("form_version_id")) OR "app"."is_org_admin_of_commission"("app"."commission_of_version"("form_version_id"))));

DROP POLICY "form_sections_staff_admin_write" ON "public"."form_sections";
CREATE POLICY "form_sections_staff_admin_write" ON "public"."form_sections" TO "authenticated" USING (("app"."is_staff_admin_of"("app"."commission_of_version"("form_version_id")) OR "app"."is_org_admin_of_commission"("app"."commission_of_version"("form_version_id")))) WITH CHECK (("app"."is_staff_admin_of"("app"."commission_of_version"("form_version_id")) OR "app"."is_org_admin_of_commission"("app"."commission_of_version"("form_version_id"))));

DROP POLICY "form_versions_select" ON "public"."form_versions";
CREATE POLICY "form_versions_select" ON "public"."form_versions" FOR SELECT TO "authenticated" USING (("app"."is_member_of"("app"."commission_of_version"("id")) OR "app"."is_org_admin_of_commission"("app"."commission_of_version"("id"))));

DROP POLICY "form_versions_staff_admin_write" ON "public"."form_versions";
CREATE POLICY "form_versions_staff_admin_write" ON "public"."form_versions" TO "authenticated" USING (("app"."is_org_admin_of_commission"(( SELECT "f"."commission_id" FROM "public"."forms" "f" WHERE ("f"."id" = "form_versions"."form_id"))) OR "app"."is_staff_admin_of"(( SELECT "f"."commission_id" FROM "public"."forms" "f" WHERE ("f"."id" = "form_versions"."form_id"))))) WITH CHECK (("app"."is_org_admin_of_commission"(( SELECT "f"."commission_id" FROM "public"."forms" "f" WHERE ("f"."id" = "form_versions"."form_id"))) OR "app"."is_staff_admin_of"(( SELECT "f"."commission_id" FROM "public"."forms" "f" WHERE ("f"."id" = "form_versions"."form_id")))));

DROP POLICY "forms_select" ON "public"."forms";
CREATE POLICY "forms_select" ON "public"."forms" FOR SELECT TO "authenticated" USING (("app"."is_member_of"("commission_id") OR "app"."is_org_admin_of_commission"("commission_id")));

DROP POLICY "forms_staff_admin_write" ON "public"."forms";
CREATE POLICY "forms_staff_admin_write" ON "public"."forms" TO "authenticated" USING (("app"."is_staff_admin_of"("commission_id") OR "app"."is_org_admin_of_commission"("commission_id"))) WITH CHECK (("app"."is_staff_admin_of"("commission_id") OR "app"."is_org_admin_of_commission"("commission_id")));

-- ===========================================================================
-- SECTION 3 — Responses domain. Tenant-governance swaps on the sign-off read
-- predicate, the dashboard DEFINER RPCs, and the standalone admin policy; plus
-- a DEFINER re-scope of public.commission_overview() so platform_admin no longer
-- sees every commission (an org_admin sees only commissions in orgs they admin).
-- ===========================================================================

-- can_read_signoff: swap `or app.is_admin()` -> `or app.is_org_admin_of_commission(r.commission_id)`.
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
        or app.is_org_admin_of_commission(r.commission_id)
        or app.is_staff_admin_of(r.commission_id)
      )
  );
$$;

ALTER FUNCTION "app"."can_read_signoff"("p_response_id" "uuid") OWNER TO "postgres";

-- commission_overview: DEFINER re-scope. The platform-admin early-return is
-- REMOVED; the main query is scoped to commissions whose organization the
-- caller org-admins (a non-org-admin sees zero rows). Body otherwise identical.
CREATE OR REPLACE FUNCTION "public"."commission_overview"() RETURNS TABLE("commission_id" "uuid", "commission_name" "text", "slug" "text", "form_count" bigint, "submitted_count" bigint, "submitted_last_30_days" bigint)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
begin
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
  where c.organization_id in (
    select om.organization_id
    from public.organization_members om
    where om.user_id = auth.uid()
      and om.role = 'org_admin'
  )
  order by c.name;
end;
$$;

ALTER FUNCTION "public"."commission_overview"() OWNER TO "postgres";

-- dashboard_completion_by_member: swap `app.is_admin()` -> `app.is_org_admin_of_commission(v_commission_id)`.
CREATE OR REPLACE FUNCTION "public"."dashboard_completion_by_member"("p_form_id" "uuid", "p_from" "date" DEFAULT NULL::"date", "p_to" "date" DEFAULT NULL::"date") RETURNS TABLE("member_id" "uuid", "name" "text", "count" bigint)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission_id uuid;
begin
  select commission_id into v_commission_id from public.forms where id = p_form_id;
  if v_commission_id is null or not (app.is_staff_admin_of(v_commission_id) or app.is_org_admin_of_commission(v_commission_id)) then
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

-- dashboard_distributions: swap `app.is_admin()` -> `app.is_org_admin_of_commission(v_commission_id)`.
CREATE OR REPLACE FUNCTION "public"."dashboard_distributions"("p_form_id" "uuid", "p_from" "date" DEFAULT NULL::"date", "p_to" "date" DEFAULT NULL::"date") RETURNS TABLE("question_key" "text", "label" "text", "section_title" "text", "section_position" integer, "item_position" integer, "item_type" "text", "option_value" "text", "option_count" bigint, "denominator" bigint, "n" bigint)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission_id uuid;
  v_latest uuid;
begin
  select commission_id into v_commission_id from public.forms where id = p_form_id;
  if v_commission_id is null or not (app.is_staff_admin_of(v_commission_id) or app.is_org_admin_of_commission(v_commission_id)) then
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

-- dashboard_export_rows: swap `app.is_admin()` -> `app.is_org_admin_of_commission(v_commission_id)`.
CREATE OR REPLACE FUNCTION "public"."dashboard_export_rows"("p_form_id" "uuid", "p_from" "date" DEFAULT NULL::"date", "p_to" "date" DEFAULT NULL::"date") RETURNS TABLE("response_id" "uuid", "member_name" "text", "submitted_at" timestamp with time zone, "version_number" integer, "answers" "jsonb", "signoffs" "jsonb")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission_id uuid;
begin
  select commission_id into v_commission_id from public.forms where id = p_form_id;
  if v_commission_id is null or not (app.is_staff_admin_of(v_commission_id) or app.is_org_admin_of_commission(v_commission_id)) then
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

-- dashboard_form_totals: swap `app.is_admin()` -> `app.is_org_admin_of_commission(p_commission_id)`.
CREATE OR REPLACE FUNCTION "public"."dashboard_form_totals"("p_commission_id" "uuid", "p_from" "date" DEFAULT NULL::"date", "p_to" "date" DEFAULT NULL::"date") RETURNS TABLE("form_id" "uuid", "title" "text", "total_submitted" bigint, "last_submitted_at" timestamp with time zone)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
begin
  if not (app.is_staff_admin_of(p_commission_id) or app.is_org_admin_of_commission(p_commission_id)) then
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

-- dashboard_free_text: swap `app.is_admin()` -> `app.is_org_admin_of_commission(v_commission_id)`.
CREATE OR REPLACE FUNCTION "public"."dashboard_free_text"("p_form_id" "uuid", "p_from" "date" DEFAULT NULL::"date", "p_to" "date" DEFAULT NULL::"date", "p_limit" integer DEFAULT 50) RETURNS TABLE("question_key" "text", "label" "text", "section_title" "text", "section_position" integer, "item_position" integer, "total" bigint, "sample_value" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission_id uuid;
  v_latest uuid;
begin
  select commission_id into v_commission_id from public.forms where id = p_form_id;
  if v_commission_id is null or not (app.is_staff_admin_of(v_commission_id) or app.is_org_admin_of_commission(v_commission_id)) then
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

-- dashboard_submissions_over_time: swap `app.is_admin()` -> `app.is_org_admin_of_commission(v_commission_id)`.
CREATE OR REPLACE FUNCTION "public"."dashboard_submissions_over_time"("p_form_id" "uuid", "p_from" "date" DEFAULT NULL::"date", "p_to" "date" DEFAULT NULL::"date") RETURNS TABLE("day" "date", "count" bigint)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission_id uuid;
begin
  select commission_id into v_commission_id from public.forms where id = p_form_id;
  if v_commission_id is null or not (app.is_staff_admin_of(v_commission_id) or app.is_org_admin_of_commission(v_commission_id)) then
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

-- responses_admin_all: standalone admin ALL policy -> org-governance scope.
DROP POLICY "responses_admin_all" ON "public"."responses";
CREATE POLICY "responses_admin_all" ON "public"."responses" TO "authenticated" USING ("app"."is_org_admin_of_commission"("commission_id")) WITH CHECK ("app"."is_org_admin_of_commission"("commission_id"));


-- ===========================================================================
-- SECTION 4 — Cases / Meetings / Interviews / Phase-results tenant governance.
-- Every additive admin OR-term beside an is_member_of / is_staff_admin_of /
-- can_read_case term is swapped to the matching org-governance predicate over
-- the SAME commission expression (the `_for` variant where p_uid is in play).
-- Each object reproduced verbatim from its latest-wins source. DROP+CREATE for
-- policies; CREATE OR REPLACE for functions.
-- ===========================================================================
CREATE OR REPLACE FUNCTION "public"."archive_case_narrative_type"("p_narrative_type_id" "uuid") RETURNS "public"."case_narrative_types"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission_id uuid;
  v_result public.case_narrative_types;
begin
  perform app.assert_narratives_enabled();

  select commission_id into v_commission_id
  from public.case_narrative_types where id = p_narrative_type_id;
  if v_commission_id is null then
    raise exception 'narrativa não encontrada' using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission_id) or app.is_org_admin_of_commission(v_commission_id)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  update public.case_narrative_types set archived = true
  where id = p_narrative_type_id returning * into v_result;
  return v_result;
end;
$$;

ALTER FUNCTION "public"."archive_case_narrative_type"("p_narrative_type_id" "uuid") OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."archive_case_outcome"("p_outcome_id" "uuid") RETURNS "public"."case_outcomes"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission_id uuid;
  v_result public.case_outcomes;
begin
  perform app.assert_extras_enabled();

  select commission_id into v_commission_id
  from public.case_outcomes where id = p_outcome_id;
  if v_commission_id is null then
    raise exception 'desfecho não encontrado' using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission_id) or app.is_org_admin_of_commission(v_commission_id)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  update public.case_outcomes set archived = true, updated_at = now()
  where id = p_outcome_id returning * into v_result;
  return v_result;
end;
$$;

ALTER FUNCTION "public"."archive_case_outcome"("p_outcome_id" "uuid") OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."archive_case_tag"("p_tag_id" "uuid") RETURNS "public"."case_tags"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission_id uuid;
  v_result public.case_tags;
begin
  perform app.assert_extras_enabled();

  select commission_id into v_commission_id from public.case_tags where id = p_tag_id;
  if v_commission_id is null then
    raise exception 'etiqueta não encontrada' using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission_id) or app.is_org_admin_of_commission(v_commission_id)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  update public.case_tags set archived = true where id = p_tag_id returning * into v_result;
  return v_result;
end;
$$;

ALTER FUNCTION "public"."archive_case_tag"("p_tag_id" "uuid") OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."assign_narrative"("p_narrative" "uuid", "p_assignee" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_case_id uuid;
  v_commission uuid;
  v_case_status text;
  v_status text;
begin
  perform app.assert_case_access_enabled();

  select cn.case_id, c.commission_id, c.status, cn.status
    into v_case_id, v_commission, v_case_status, v_status
  from public.case_narratives cn
  join public.cases c on c.id = cn.case_id
  where cn.id = p_narrative;

  if v_case_id is null then
    raise exception 'narrativa % não encontrada', p_narrative using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission) or app.is_org_admin_of_commission(v_commission)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if v_case_status in ('concluido', 'cancelado') then
    raise exception 'este caso está em um estado final e não pode mais ser alterado'
      using errcode = 'HC020';
  end if;
  if v_status <> 'aberta' then
    raise exception 'a narrativa não está no estado necessário para esta ação'
      using errcode = 'HC055';
  end if;
  if not app.is_member_of_for(v_commission, p_assignee) then
    raise exception 'o responsável deve ser membro da comissão' using errcode = 'HC021';
  end if;

  perform set_config('app.in_narrative_rpc', 'on', true);
  update public.case_narratives set assigned_to = p_assignee, updated_by = auth.uid()
  where id = p_narrative;
  perform set_config('app.in_narrative_rpc', 'off', true);
end;
$$;

ALTER FUNCTION "public"."assign_narrative"("p_narrative" "uuid", "p_assignee" "uuid") OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."case_action_items_kpis"("p_commission_id" "uuid") RETURNS TABLE("open" bigint, "overdue" bigint, "completed_ytd" bigint)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
begin
  if not (app.is_staff_admin_of(p_commission_id) or app.is_org_admin_of_commission(p_commission_id)) then
    return query select 0::bigint, 0::bigint, 0::bigint;
    return;
  end if;

  return query
  select
    count(*) filter (where ai.status in ('open', 'in_progress')) as open,
    count(*) filter (
      where ai.status in ('open', 'in_progress')
        and ai.due_date is not null
        and ai.due_date < current_date
    ) as overdue,
    count(*) filter (
      where ai.status = 'done'
        and ai.completed_at is not null
        and date_trunc('year', ai.completed_at) = date_trunc('year', now())
    ) as completed_ytd
  from public.case_action_items ai
  join public.cases c on c.id = ai.case_id
  where c.commission_id = p_commission_id;
end;
$$;

ALTER FUNCTION "public"."case_action_items_kpis"("p_commission_id" "uuid") OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."case_tag_report"("p_commission_id" "uuid", "p_from" "date" DEFAULT NULL::"date", "p_to" "date" DEFAULT NULL::"date") RETURNS TABLE("tag_id" "uuid", "name" "text", "color_token" "text", "case_count" bigint)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
begin
  if not (app.is_staff_admin_of(p_commission_id) or app.is_org_admin_of_commission(p_commission_id)) then
    return;
  end if;

  return query
  select t.id,
         t.name,
         t.color_token,
         count(distinct c.id) as case_count
  from public.case_tags t
  left join public.case_tag_assignments ta on ta.tag_id = t.id
  left join public.cases c
    on c.id = ta.case_id
   and (p_from is null or c.created_at::date >= p_from)
   and (p_to   is null or c.created_at::date <= p_to)
  where t.commission_id = p_commission_id
    and not t.archived
  group by t.id, t.name, t.color_token
  order by count(distinct c.id) desc, t.name;
end;
$$;

ALTER FUNCTION "public"."case_tag_report"("p_commission_id" "uuid", "p_from" "date", "p_to" "date") OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."create_case_narrative_type"("p_commission_id" "uuid", "p_label" "text", "p_description" "text" DEFAULT NULL::"text") RETURNS "public"."case_narrative_types"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_position integer;
  v_result public.case_narrative_types;
begin
  perform app.assert_narratives_enabled();
  if not (app.is_staff_admin_of(p_commission_id) or app.is_org_admin_of_commission(p_commission_id)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if nullif(btrim(p_label), '') is null then
    raise exception 'informe o nome da narrativa' using errcode = 'check_violation';
  end if;

  select coalesce(max(position), 0) + 1 into v_position
  from public.case_narrative_types where commission_id = p_commission_id;

  insert into public.case_narrative_types
    (commission_id, label, description, position)
  values
    (p_commission_id, btrim(p_label), nullif(btrim(p_description), ''), v_position)
  returning * into v_result;

  return v_result;
end;
$$;

ALTER FUNCTION "public"."create_case_narrative_type"("p_commission_id" "uuid", "p_label" "text", "p_description" "text") OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."create_case_outcome"("p_commission_id" "uuid", "p_label" "text", "p_color_token" "text" DEFAULT 'muted'::"text", "p_requires_action_plan" boolean DEFAULT false, "p_is_adverse" boolean DEFAULT false) RETURNS "public"."case_outcomes"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_position integer;
  v_result public.case_outcomes;
begin
  perform app.assert_extras_enabled();
  if not (app.is_staff_admin_of(p_commission_id) or app.is_org_admin_of_commission(p_commission_id)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if nullif(btrim(p_label), '') is null then
    raise exception 'informe o nome do desfecho' using errcode = 'check_violation';
  end if;

  select coalesce(max(position), 0) + 1 into v_position
  from public.case_outcomes where commission_id = p_commission_id;

  insert into public.case_outcomes
    (commission_id, label, color_token, requires_action_plan, is_adverse, position)
  values
    (p_commission_id, btrim(p_label), p_color_token,
     coalesce(p_requires_action_plan, false), coalesce(p_is_adverse, false), v_position)
  returning * into v_result;

  return v_result;
end;
$$;

ALTER FUNCTION "public"."create_case_outcome"("p_commission_id" "uuid", "p_label" "text", "p_color_token" "text", "p_requires_action_plan" boolean, "p_is_adverse" boolean) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."create_case_tag"("p_commission_id" "uuid", "p_name" "text", "p_color_token" "text" DEFAULT 'muted'::"text") RETURNS "public"."case_tags"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_result public.case_tags;
begin
  perform app.assert_extras_enabled();
  if not (app.is_staff_admin_of(p_commission_id) or app.is_org_admin_of_commission(p_commission_id)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if nullif(btrim(p_name), '') is null then
    raise exception 'informe o nome da etiqueta' using errcode = 'check_violation';
  end if;

  insert into public.case_tags (commission_id, name, color_token)
  values (p_commission_id, btrim(p_name), p_color_token)
  returning * into v_result;

  return v_result;
end;
$$;

ALTER FUNCTION "public"."create_case_tag"("p_commission_id" "uuid", "p_name" "text", "p_color_token" "text") OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."grant_case_access"("p_case" "uuid", "p_user" "uuid", "p_level" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission uuid;
begin
  perform app.assert_case_access_enabled();

  select commission_id into v_commission from public.cases where id = p_case;
  if v_commission is null then
    raise exception 'caso % não encontrado', p_case using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission) or app.is_org_admin_of_commission(v_commission)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if p_level not in ('read', 'write') then
    raise exception 'nível de acesso inválido' using errcode = 'check_violation';
  end if;
  -- The grantee must be a current member of the case's commission (HC021).
  if not app.is_member_of_for(v_commission, p_user) then
    raise exception 'o responsável deve ser membro da comissão' using errcode = 'HC021';
  end if;

  insert into public.case_access (case_id, user_id, level, granted_by, granted_at)
  values (p_case, p_user, p_level, auth.uid(), now())
  on conflict (case_id, user_id)
  do update set level = excluded.level, granted_by = excluded.granted_by,
                granted_at = excluded.granted_at;
end;
$$;

ALTER FUNCTION "public"."grant_case_access"("p_case" "uuid", "p_user" "uuid", "p_level" "text") OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."rename_case_tag"("p_tag_id" "uuid", "p_name" "text", "p_color_token" "text") RETURNS "public"."case_tags"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission_id uuid;
  v_result public.case_tags;
begin
  perform app.assert_extras_enabled();

  select commission_id into v_commission_id from public.case_tags where id = p_tag_id;
  if v_commission_id is null then
    raise exception 'etiqueta não encontrada' using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission_id) or app.is_org_admin_of_commission(v_commission_id)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if nullif(btrim(p_name), '') is null then
    raise exception 'informe o nome da etiqueta' using errcode = 'check_violation';
  end if;

  update public.case_tags
  set name = btrim(p_name), color_token = p_color_token
  where id = p_tag_id
  returning * into v_result;

  return v_result;
end;
$$;

ALTER FUNCTION "public"."rename_case_tag"("p_tag_id" "uuid", "p_name" "text", "p_color_token" "text") OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."reopen_narrative"("p_narrative" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission uuid;
  v_case_status text;
  v_status text;
begin
  perform app.assert_case_access_enabled();

  select c.commission_id, c.status, cn.status
    into v_commission, v_case_status, v_status
  from public.case_narratives cn
  join public.cases c on c.id = cn.case_id
  where cn.id = p_narrative;

  if v_status is null then
    raise exception 'narrativa % não encontrada', p_narrative using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission) or app.is_org_admin_of_commission(v_commission)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if v_case_status in ('concluido', 'cancelado') then
    raise exception 'este caso está em um estado final e não pode mais ser alterado'
      using errcode = 'HC020';
  end if;
  if v_status <> 'concluida' then
    raise exception 'a narrativa não está no estado necessário para esta ação'
      using errcode = 'HC055';
  end if;

  perform set_config('app.in_narrative_rpc', 'on', true);
  update public.case_narratives
  set status = 'aberta', concluded_at = null, concluded_by = null, updated_by = auth.uid()
  where id = p_narrative;
  perform set_config('app.in_narrative_rpc', 'off', true);
end;
$$;

ALTER FUNCTION "public"."reopen_narrative"("p_narrative" "uuid") OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."reorder_case_narrative_types"("p_commission_id" "uuid", "p_ordered_ids" "uuid"[]) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
begin
  perform app.assert_narratives_enabled();
  if not (app.is_staff_admin_of(p_commission_id) or app.is_org_admin_of_commission(p_commission_id)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  update public.case_narrative_types d
  set position = o.ord
  from (
    select id, ordinality::integer as ord
    from unnest(p_ordered_ids) with ordinality as t(id, ordinality)
  ) o
  where d.commission_id = p_commission_id and d.id = o.id;
end;
$$;

ALTER FUNCTION "public"."reorder_case_narrative_types"("p_commission_id" "uuid", "p_ordered_ids" "uuid"[]) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."reorder_case_outcomes"("p_commission_id" "uuid", "p_ordered_ids" "uuid"[]) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
begin
  perform app.assert_extras_enabled();
  if not (app.is_staff_admin_of(p_commission_id) or app.is_org_admin_of_commission(p_commission_id)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  update public.case_outcomes d
  set position = o.ord, updated_at = now()
  from (
    select id, ordinality::integer as ord
    from unnest(p_ordered_ids) with ordinality as t(id, ordinality)
  ) o
  where d.commission_id = p_commission_id and d.id = o.id;
end;
$$;

ALTER FUNCTION "public"."reorder_case_outcomes"("p_commission_id" "uuid", "p_ordered_ids" "uuid"[]) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."revoke_case_access"("p_case" "uuid", "p_user" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission uuid;
begin
  perform app.assert_case_access_enabled();

  select commission_id into v_commission from public.cases where id = p_case;
  if v_commission is null then
    raise exception 'caso % não encontrado', p_case using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission) or app.is_org_admin_of_commission(v_commission)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  delete from public.case_access where case_id = p_case and user_id = p_user;
end;
$$;

ALTER FUNCTION "public"."revoke_case_access"("p_case" "uuid", "p_user" "uuid") OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."set_case_outcome"("p_case_id" "uuid", "p_outcome_id" "uuid" DEFAULT NULL::"uuid") RETURNS "public"."cases"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission_id uuid;
  v_status text;
  v_result public.cases;
begin
  perform app.assert_extras_enabled();

  select commission_id, status into v_commission_id, v_status
  from public.cases where id = p_case_id;
  if v_commission_id is null then
    raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission_id) or app.is_org_admin_of_commission(v_commission_id)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if v_status in ('concluido', 'cancelado') then
    raise exception 'este caso está em um estado final e não pode mais ser alterado'
      using errcode = 'HC025';
  end if;

  -- A non-null outcome must be one this case's process OFFERED (frozen set).
  if p_outcome_id is not null and not exists (
    select 1 from public.case_offered_outcomes
    where case_id = p_case_id and outcome_id = p_outcome_id
  ) then
    raise exception 'este desfecho não está disponível para este caso'
      using errcode = 'HC029';
  end if;

  update public.cases
  set outcome_id = p_outcome_id
  where id = p_case_id
  returning * into v_result;

  return v_result;
end;
$$;

ALTER FUNCTION "public"."set_case_outcome"("p_case_id" "uuid", "p_outcome_id" "uuid") OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."set_process_outcomes"("p_template_id" "uuid", "p_outcome_ids" "uuid"[]) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission_id uuid;
  v_status text;
begin
  perform app.assert_extras_enabled();

  select commission_id, status into v_commission_id, v_status
  from public.process_templates where id = p_template_id;
  if v_commission_id is null then
    raise exception 'processo % não encontrado', p_template_id using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission_id) or app.is_org_admin_of_commission(v_commission_id)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if v_status <> 'draft' then
    raise exception 'apenas processos em rascunho podem ser editados'
      using errcode = 'check_violation';
  end if;

  delete from public.process_template_outcomes where template_id = p_template_id;

  insert into public.process_template_outcomes (template_id, outcome_id, position)
  select p_template_id, oid, ord::integer
  from unnest(p_outcome_ids) with ordinality as t(oid, ord);
end;
$$;

ALTER FUNCTION "public"."set_process_outcomes"("p_template_id" "uuid", "p_outcome_ids" "uuid"[]) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."unassign_narrative"("p_narrative" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_case_id uuid;
  v_commission uuid;
  v_case_status text;
begin
  perform app.assert_case_access_enabled();

  select cn.case_id, c.commission_id, c.status
    into v_case_id, v_commission, v_case_status
  from public.case_narratives cn
  join public.cases c on c.id = cn.case_id
  where cn.id = p_narrative;

  if v_case_id is null then
    raise exception 'narrativa % não encontrada', p_narrative using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission) or app.is_org_admin_of_commission(v_commission)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if v_case_status in ('concluido', 'cancelado') then
    raise exception 'este caso está em um estado final e não pode mais ser alterado'
      using errcode = 'HC020';
  end if;

  perform set_config('app.in_narrative_rpc', 'on', true);
  update public.case_narratives set assigned_to = null, updated_by = auth.uid()
  where id = p_narrative;
  perform set_config('app.in_narrative_rpc', 'off', true);
end;
$$;

ALTER FUNCTION "public"."unassign_narrative"("p_narrative" "uuid") OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."update_case_narrative_body"("p_narrative_id" "uuid", "p_body_md" "text") RETURNS "public"."case_narratives"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_case_id uuid;
  v_commission_id uuid;
  v_status text;
  v_result public.case_narratives;
begin
  perform app.assert_narratives_enabled();

  select n.case_id, c.commission_id, c.status
    into v_case_id, v_commission_id, v_status
  from public.case_narratives n
  join public.cases c on c.id = n.case_id
  where n.id = p_narrative_id;

  if v_case_id is null then
    raise exception 'narrativa % não encontrada', p_narrative_id using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission_id) or app.is_org_admin_of_commission(v_commission_id)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if v_status in ('concluido', 'cancelado') then
    raise exception 'as narrativas deste caso estão bloqueadas' using errcode = 'HC054';
  end if;

  perform set_config('app.in_narrative_rpc', 'on', true);
  update public.case_narratives
  set body_md = p_body_md, updated_by = auth.uid()
  where id = p_narrative_id
  returning * into v_result;
  perform set_config('app.in_narrative_rpc', 'off', true);

  return v_result;
end;
$$;

ALTER FUNCTION "public"."update_case_narrative_body"("p_narrative_id" "uuid", "p_body_md" "text") OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."update_case_narrative_type"("p_narrative_type_id" "uuid", "p_label" "text", "p_description" "text") RETURNS "public"."case_narrative_types"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission_id uuid;
  v_result public.case_narrative_types;
begin
  perform app.assert_narratives_enabled();

  select commission_id into v_commission_id
  from public.case_narrative_types where id = p_narrative_type_id;
  if v_commission_id is null then
    raise exception 'narrativa não encontrada' using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission_id) or app.is_org_admin_of_commission(v_commission_id)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if nullif(btrim(p_label), '') is null then
    raise exception 'informe o nome da narrativa' using errcode = 'check_violation';
  end if;

  update public.case_narrative_types
  set label = btrim(p_label),
      description = nullif(btrim(p_description), '')
  where id = p_narrative_type_id
  returning * into v_result;

  return v_result;
end;
$$;

ALTER FUNCTION "public"."update_case_narrative_type"("p_narrative_type_id" "uuid", "p_label" "text", "p_description" "text") OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."update_case_outcome"("p_outcome_id" "uuid", "p_label" "text", "p_color_token" "text", "p_requires_action_plan" boolean, "p_is_adverse" boolean) RETURNS "public"."case_outcomes"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission_id uuid;
  v_result public.case_outcomes;
begin
  perform app.assert_extras_enabled();

  select commission_id into v_commission_id
  from public.case_outcomes where id = p_outcome_id;
  if v_commission_id is null then
    raise exception 'desfecho não encontrado' using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission_id) or app.is_org_admin_of_commission(v_commission_id)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if nullif(btrim(p_label), '') is null then
    raise exception 'informe o nome do desfecho' using errcode = 'check_violation';
  end if;

  update public.case_outcomes
  set label = btrim(p_label),
      color_token = p_color_token,
      requires_action_plan = coalesce(p_requires_action_plan, false),
      is_adverse = coalesce(p_is_adverse, false),
      updated_at = now()
  where id = p_outcome_id
  returning * into v_result;

  return v_result;
end;
$$;

ALTER FUNCTION "public"."update_case_outcome"("p_outcome_id" "uuid", "p_label" "text", "p_color_token" "text", "p_requires_action_plan" boolean, "p_is_adverse" boolean) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."conclude_narrative"("p_narrative" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission uuid;
  v_case_status text;
  v_status text;
  v_assigned uuid;
begin
  perform app.assert_case_access_enabled();

  select c.commission_id, c.status, cn.status, cn.assigned_to
    into v_commission, v_case_status, v_status, v_assigned
  from public.case_narratives cn
  join public.cases c on c.id = cn.case_id
  where cn.id = p_narrative;

  if v_status is null then
    raise exception 'narrativa % não encontrada', p_narrative using errcode = 'no_data_found';
  end if;
  -- The assignee OR a coordinator/admin may conclude.
  if not (v_assigned = auth.uid()
          or app.is_staff_admin_of(v_commission) or app.is_org_admin_of_commission(v_commission)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if v_case_status in ('concluido', 'cancelado') then
    raise exception 'este caso está em um estado final e não pode mais ser alterado'
      using errcode = 'HC020';
  end if;
  if v_status <> 'aberta' then
    raise exception 'a narrativa não está no estado necessário para esta ação'
      using errcode = 'HC055';
  end if;

  perform set_config('app.in_narrative_rpc', 'on', true);
  update public.case_narratives
  set status = 'concluida', concluded_at = now(), concluded_by = auth.uid(),
      updated_by = auth.uid()
  where id = p_narrative;
  perform set_config('app.in_narrative_rpc', 'off', true);
end;
$$;

ALTER FUNCTION "public"."conclude_narrative"("p_narrative" "uuid") OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."case_viewer_capabilities"("p_case_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_commission uuid;
begin
  select commission_id into v_commission from public.cases where id = p_case_id;
  if v_commission is null then
    return jsonb_build_object(
      'can_read', false, 'can_write_content', false, 'can_manage_lifecycle', false);
  end if;

  return jsonb_build_object(
    'can_read', app.can_read_case(p_case_id, v_uid),
    'can_write_content', app.can_write_case_content(p_case_id, v_uid),
    'can_manage_lifecycle',
      app.is_staff_admin_of_for(v_commission, v_uid) or app.is_org_admin_of_commission_for(v_commission, v_uid)
  );
end;
$$;

ALTER FUNCTION "public"."case_viewer_capabilities"("p_case_id" "uuid") OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."list_my_cases"("p_commission" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_result jsonb;
begin
  perform app.assert_case_access_enabled();

  if v_uid is null then
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(row_obj order by created_at desc, case_number desc), '[]'::jsonb)
    into v_result
  from (
    select
      c.id,
      c.created_at,
      c.case_number,
      jsonb_build_object(
        'case_id', c.id,
        'case_number', c.case_number,
        'label', c.label,
        'status', c.status,
        'my_role',
          case
            when app.is_staff_admin_of_for(c.commission_id, v_uid)
                 or app.is_org_admin_of_commission_for(c.commission_id, v_uid) then 'coordinator'
            when exists (
              select 1 from public.case_access ca
              where ca.case_id = c.id and ca.user_id = v_uid and ca.level = 'write'
            ) then 'collaborator'
            else 'viewer'
          end,
        'items', (
          select coalesce(jsonb_agg(item order by display_position), '[]'::jsonb)
          from (
            -- the caller's PHASES of this case
            select
              coalesce(cp.display_position, cp.position) as display_position,
              jsonb_build_object(
                'kind', 'phase',
                'id', cp.id,
                'title', coalesce(nullif(btrim(cp.title), ''), f.title, 'Fase ' || cp.position),
                'status', cp.status,
                'display_position', coalesce(cp.display_position, cp.position),
                'actionable', (cp.status = 'ativa')
              ) as item
            from public.case_phases cp
            join public.forms f on f.id = cp.form_id
            where cp.case_id = c.id and cp.assigned_to = v_uid
            union all
            -- the caller's NARRATIVES of this case
            select
              cn.display_position,
              jsonb_build_object(
                'kind', 'narrative',
                'id', cn.id,
                'title', cn.type_label,
                'status', cn.status,
                'display_position', cn.display_position,
                'actionable', (cn.status = 'aberta')
              ) as item
            from public.case_narratives cn
            where cn.case_id = c.id and cn.assigned_to = v_uid
          ) items
        )
      ) as row_obj
    from public.cases c
    where c.commission_id = p_commission
      -- "Meus Casos" is the caller's PERSONAL list: cases they are attributed to
      -- (phase/narrative assignee) OR granted (ADR 0033 D7). A coordinator/admin is
      -- NOT auto-included for every case (the board is their management surface) —
      -- they appear here only when personally attributed/granted, and then carry the
      -- 'coordinator' role chip.
      and (
        exists (select 1 from public.case_access ca
                where ca.case_id = c.id and ca.user_id = v_uid)
        or exists (select 1 from public.case_phases cp
                   where cp.case_id = c.id and cp.assigned_to = v_uid)
        or exists (select 1 from public.case_narratives cn
                   where cn.case_id = c.id and cn.assigned_to = v_uid)
      )
  ) rows;

  return v_result;
end;
$$;

ALTER FUNCTION "public"."list_my_cases"("p_commission" "uuid") OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."get_case_detail"("p_case_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_case public.cases;
  v_outcome jsonb;
  v_is_coordinator boolean;
  v_result jsonb;
begin
  select * into v_case from public.cases where id = p_case_id;
  if v_case.id is null then
    raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
  end if;
  if app.feature_enabled('case_access') then
    if not app.can_read_case(p_case_id, auth.uid()) then
      raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
    end if;
  else
    if not app.is_staff_admin_of(v_case.commission_id) then
      raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
    end if;
  end if;

  v_is_coordinator :=
    app.is_staff_admin_of(v_case.commission_id) or app.is_org_admin_of_commission(v_case.commission_id);

  if app.feature_enabled('case_access') and not v_is_coordinator then
    perform public.log_audit_access(
      'case.opened', 'case', p_case_id, v_case.commission_id,
      'Caso aberto por participante/concedido', '{}'::jsonb);
  end if;

  select case when o.id is null then null else jsonb_build_object(
           'id', o.id,
           'label', o.label,
           'color_token', o.color_token,
           'requires_action_plan', o.requires_action_plan,
           'is_adverse', o.is_adverse
         ) end
    into v_outcome
  from (select v_case.outcome_id as oid) s
  left join public.case_outcomes o on o.id = s.oid;

  select jsonb_build_object(
    'id', v_case.id,
    'commission_id', v_case.commission_id,
    'template_id', v_case.template_id,
    'case_number', v_case.case_number,
    'label', v_case.label,
    'status', v_case.status,
    'outcome_id', v_case.outcome_id,
    'outcome', v_outcome,
    'has_patient', v_case.has_patient,
    'patient_enabled', v_case.patient_enabled,
    'viewer_capabilities', jsonb_build_object(
      'can_read', true,
      'can_write_content', app.can_write_case_content(p_case_id, auth.uid()),
      'can_manage_lifecycle', v_is_coordinator
    ),
    'offered_outcomes', coalesce(
      (select jsonb_agg(jsonb_build_object(
          'id', o.id,
          'label', o.label,
          'color_token', o.color_token,
          'requires_action_plan', o.requires_action_plan,
          'is_adverse', o.is_adverse
        ) order by o.position)
       from public.case_offered_outcomes coo
       join public.case_outcomes o on o.id = coo.outcome_id
       where coo.case_id = p_case_id),
      '[]'::jsonb),
    'created_at', v_case.created_at,
    'closed_at', v_case.closed_at,
    'phases', coalesce(
      (select jsonb_agg(jsonb_build_object(
          'id', cp.id,
          'position', cp.position,
          'form_id', cp.form_id,
          'form_version_id', cp.form_version_id,
          'form_title', f.title,
          'title', cp.title,
          'status', cp.status,
          'recommended', cp.recommended,
          'assigned_to', cp.assigned_to,
          'assignee_name', pr.full_name,
          'is_ad_hoc', cp.is_ad_hoc,
          'blocks', cp.blocks,
          'recommend_when', cp.recommend_when,
          'due_date', cp.due_date,
          'default_due_days', cp.default_due_days,
          'display_position', coalesce(cp.display_position, cp.position),
          'response_id', sub.response_id,
          'submitted_at', sub.submitted_at,
          -- phase-results: the effective result id/stamp + a LIVE-resolved object.
          'result_id', cp.result_id,
          'result_computed_at', cp.result_computed_at,
          'result', case when prr.id is null then null else jsonb_build_object(
            'id', prr.id,
            'label', prr.label,
            'color_token', prr.color_token,
            'is_adverse', prr.is_adverse,
            'source', cp.result_source
          ) end
        ) order by cp.position)
       from public.case_phases cp
       join public.forms f on f.id = cp.form_id
       left join public.profiles pr on pr.id = cp.assigned_to
       left join public.phase_results prr on prr.id = cp.result_id
       left join lateral (
         select r.id as response_id, r.submitted_at
         from public.responses r
         where r.case_phase_id = cp.id
           and r.status = 'submitted'
           and cp.status = 'concluida'
         limit 1
       ) sub on true
       where cp.case_id = p_case_id),
      '[]'::jsonb),
    'narratives', coalesce(
      (select jsonb_agg(jsonb_build_object(
          'id', cn.id,
          'narrative_type_id', cn.narrative_type_id,
          'type_label', cn.type_label,
          'display_position', cn.display_position,
          'title', cn.title,
          'instructions', cn.instructions,
          'is_expected', cn.is_expected,
          'body_md', cn.body_md,
          'assigned_to', cn.assigned_to,
          'assignee_name', npr.full_name,
          'status', cn.status,
          'concluded_at', cn.concluded_at,
          'concluded_by', cn.concluded_by,
          'updated_at', cn.updated_at
        ) order by cn.display_position)
       from public.case_narratives cn
       left join public.profiles npr on npr.id = cn.assigned_to
       where cn.case_id = p_case_id),
      '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

ALTER FUNCTION "public"."get_case_detail"("p_case_id" "uuid") OWNER TO "postgres";
DROP POLICY "case_access_select" ON "public"."case_access";
CREATE POLICY "case_access_select" ON "public"."case_access" FOR SELECT TO "authenticated" USING (("app"."is_staff_admin_of"("app"."commission_of_case"("case_id")) OR "app"."is_org_admin_of_commission"("app"."commission_of_case"("case_id")) OR ("user_id" = "auth"."uid"())));
DROP POLICY "case_action_items_select" ON "public"."case_action_items";
CREATE POLICY "case_action_items_select" ON "public"."case_action_items" FOR SELECT TO "authenticated" USING (("app"."can_read_case"("case_id", "auth"."uid"()) OR "app"."is_org_admin_of_commission"("app"."commission_of_case"("case_id"))));
DROP POLICY "case_documents_select" ON "public"."case_documents";
CREATE POLICY "case_documents_select" ON "public"."case_documents" FOR SELECT TO "authenticated" USING (("app"."can_read_case"("case_id", "auth"."uid"()) OR "app"."is_org_admin_of_commission"("app"."commission_of_case"("case_id"))));
DROP POLICY "case_events_select" ON "public"."case_events";
CREATE POLICY "case_events_select" ON "public"."case_events" FOR SELECT TO "authenticated" USING (("app"."can_read_case"("case_id", "auth"."uid"()) OR "app"."is_org_admin_of_commission"("app"."commission_of_case"("case_id"))));
DROP POLICY "case_narratives_select" ON "public"."case_narratives";
CREATE POLICY "case_narratives_select" ON "public"."case_narratives" FOR SELECT TO "authenticated" USING (("app"."can_read_case"("case_id", "auth"."uid"()) OR "app"."is_org_admin_of_commission"("app"."commission_of_case"("case_id"))));
DROP POLICY "case_offered_outcomes_select" ON "public"."case_offered_outcomes";
CREATE POLICY "case_offered_outcomes_select" ON "public"."case_offered_outcomes" FOR SELECT TO "authenticated" USING (("app"."can_read_case"("case_id", "auth"."uid"()) OR "app"."is_org_admin_of_commission"("app"."commission_of_case"("case_id"))));
DROP POLICY "case_phases_select" ON "public"."case_phases";
CREATE POLICY "case_phases_select" ON "public"."case_phases" FOR SELECT TO "authenticated" USING (("app"."can_read_case"("case_id", "auth"."uid"()) OR "app"."is_org_admin_of_commission"("app"."commission_of_case"("case_id"))));
DROP POLICY "case_tag_assignments_select" ON "public"."case_tag_assignments";
CREATE POLICY "case_tag_assignments_select" ON "public"."case_tag_assignments" FOR SELECT TO "authenticated" USING (("app"."can_read_case"("case_id", "auth"."uid"()) OR "app"."is_org_admin_of_commission"("app"."commission_of_case"("case_id"))));
DROP POLICY "cases_select" ON "public"."cases";
CREATE POLICY "cases_select" ON "public"."cases" FOR SELECT TO "authenticated" USING (("app"."can_read_case"("id", "auth"."uid"()) OR "app"."is_org_admin_of_commission"("app"."commission_of_case"("id"))));
DROP POLICY "case_narrative_types_select" ON "public"."case_narrative_types";
CREATE POLICY "case_narrative_types_select" ON "public"."case_narrative_types" FOR SELECT TO "authenticated" USING (("app"."is_member_of"("commission_id") OR "app"."is_org_admin_of_commission"("commission_id")));
DROP POLICY "case_outcomes_select" ON "public"."case_outcomes";
CREATE POLICY "case_outcomes_select" ON "public"."case_outcomes" FOR SELECT TO "authenticated" USING (("app"."is_member_of"("commission_id") OR "app"."is_org_admin_of_commission"("commission_id")));
DROP POLICY "case_tags_select" ON "public"."case_tags";
CREATE POLICY "case_tags_select" ON "public"."case_tags" FOR SELECT TO "authenticated" USING (("app"."is_member_of"("commission_id") OR "app"."is_org_admin_of_commission"("commission_id")));
DROP POLICY "process_template_narratives_select" ON "public"."process_template_narratives";
CREATE POLICY "process_template_narratives_select" ON "public"."process_template_narratives" FOR SELECT TO "authenticated" USING (("app"."is_member_of"("app"."commission_of_template"("template_id")) OR "app"."is_org_admin_of_commission"("app"."commission_of_template"("template_id"))));
DROP POLICY "process_template_outcomes_select" ON "public"."process_template_outcomes";
CREATE POLICY "process_template_outcomes_select" ON "public"."process_template_outcomes" FOR SELECT TO "authenticated" USING (("app"."is_member_of"("app"."commission_of_template"("template_id")) OR "app"."is_org_admin_of_commission"("app"."commission_of_template"("template_id"))));
DROP POLICY "process_template_phases_select" ON "public"."process_template_phases";
CREATE POLICY "process_template_phases_select" ON "public"."process_template_phases" FOR SELECT TO "authenticated" USING (("app"."is_member_of"("app"."commission_of_template"("template_id")) OR "app"."is_org_admin_of_commission"("app"."commission_of_template"("template_id"))));
DROP POLICY "process_templates_select" ON "public"."process_templates";
CREATE POLICY "process_templates_select" ON "public"."process_templates" FOR SELECT TO "authenticated" USING (("app"."is_member_of"("commission_id") OR "app"."is_org_admin_of_commission"("commission_id")));
DROP POLICY "case_action_items_staff_admin_write" ON "public"."case_action_items";
CREATE POLICY "case_action_items_staff_admin_write" ON "public"."case_action_items" TO "authenticated" USING (("app"."is_staff_admin_of"("app"."commission_of_case"("case_id")) OR "app"."is_org_admin_of_commission"("app"."commission_of_case"("case_id")))) WITH CHECK (("app"."is_staff_admin_of"("app"."commission_of_case"("case_id")) OR "app"."is_org_admin_of_commission"("app"."commission_of_case"("case_id"))));
DROP POLICY "case_documents_staff_admin_write" ON "public"."case_documents";
CREATE POLICY "case_documents_staff_admin_write" ON "public"."case_documents" TO "authenticated" USING (("app"."is_staff_admin_of"("app"."commission_of_case"("case_id")) OR "app"."is_org_admin_of_commission"("app"."commission_of_case"("case_id")))) WITH CHECK (("app"."is_staff_admin_of"("app"."commission_of_case"("case_id")) OR "app"."is_org_admin_of_commission"("app"."commission_of_case"("case_id"))));
DROP POLICY "case_events_staff_admin_write" ON "public"."case_events";
CREATE POLICY "case_events_staff_admin_write" ON "public"."case_events" TO "authenticated" USING (("app"."is_staff_admin_of"("app"."commission_of_case"("case_id")) OR "app"."is_org_admin_of_commission"("app"."commission_of_case"("case_id")))) WITH CHECK (("app"."is_staff_admin_of"("app"."commission_of_case"("case_id")) OR "app"."is_org_admin_of_commission"("app"."commission_of_case"("case_id"))));
DROP POLICY "case_narrative_types_staff_admin_write" ON "public"."case_narrative_types";
CREATE POLICY "case_narrative_types_staff_admin_write" ON "public"."case_narrative_types" TO "authenticated" USING (("app"."is_staff_admin_of"("commission_id") OR "app"."is_org_admin_of_commission"("commission_id"))) WITH CHECK (("app"."is_staff_admin_of"("commission_id") OR "app"."is_org_admin_of_commission"("commission_id")));
DROP POLICY "case_narratives_staff_admin_write" ON "public"."case_narratives";
CREATE POLICY "case_narratives_staff_admin_write" ON "public"."case_narratives" TO "authenticated" USING (("app"."is_staff_admin_of"("app"."commission_of_case"("case_id")) OR "app"."is_org_admin_of_commission"("app"."commission_of_case"("case_id")))) WITH CHECK (("app"."is_staff_admin_of"("app"."commission_of_case"("case_id")) OR "app"."is_org_admin_of_commission"("app"."commission_of_case"("case_id"))));
DROP POLICY "case_offered_outcomes_staff_admin_write" ON "public"."case_offered_outcomes";
CREATE POLICY "case_offered_outcomes_staff_admin_write" ON "public"."case_offered_outcomes" TO "authenticated" USING (("app"."is_staff_admin_of"("app"."commission_of_case"("case_id")) OR "app"."is_org_admin_of_commission"("app"."commission_of_case"("case_id")))) WITH CHECK (("app"."is_staff_admin_of"("app"."commission_of_case"("case_id")) OR "app"."is_org_admin_of_commission"("app"."commission_of_case"("case_id"))));
DROP POLICY "case_outcomes_staff_admin_write" ON "public"."case_outcomes";
CREATE POLICY "case_outcomes_staff_admin_write" ON "public"."case_outcomes" TO "authenticated" USING (("app"."is_staff_admin_of"("commission_id") OR "app"."is_org_admin_of_commission"("commission_id"))) WITH CHECK (("app"."is_staff_admin_of"("commission_id") OR "app"."is_org_admin_of_commission"("commission_id")));
DROP POLICY "case_phases_staff_admin_write" ON "public"."case_phases";
CREATE POLICY "case_phases_staff_admin_write" ON "public"."case_phases" TO "authenticated" USING (("app"."is_staff_admin_of"("app"."commission_of_case"("case_id")) OR "app"."is_org_admin_of_commission"("app"."commission_of_case"("case_id")))) WITH CHECK (("app"."is_staff_admin_of"("app"."commission_of_case"("case_id")) OR "app"."is_org_admin_of_commission"("app"."commission_of_case"("case_id"))));
DROP POLICY "case_tag_assignments_staff_admin_write" ON "public"."case_tag_assignments";
CREATE POLICY "case_tag_assignments_staff_admin_write" ON "public"."case_tag_assignments" TO "authenticated" USING (("app"."is_staff_admin_of"("app"."commission_of_case"("case_id")) OR "app"."is_org_admin_of_commission"("app"."commission_of_case"("case_id")))) WITH CHECK (("app"."is_staff_admin_of"("app"."commission_of_case"("case_id")) OR "app"."is_org_admin_of_commission"("app"."commission_of_case"("case_id"))));
DROP POLICY "case_tags_staff_admin_write" ON "public"."case_tags";
CREATE POLICY "case_tags_staff_admin_write" ON "public"."case_tags" TO "authenticated" USING (("app"."is_staff_admin_of"("commission_id") OR "app"."is_org_admin_of_commission"("commission_id"))) WITH CHECK (("app"."is_staff_admin_of"("commission_id") OR "app"."is_org_admin_of_commission"("commission_id")));
DROP POLICY "cases_staff_admin_write" ON "public"."cases";
CREATE POLICY "cases_staff_admin_write" ON "public"."cases" TO "authenticated" USING (("app"."is_staff_admin_of"("commission_id") OR "app"."is_org_admin_of_commission"("commission_id"))) WITH CHECK (("app"."is_staff_admin_of"("commission_id") OR "app"."is_org_admin_of_commission"("commission_id")));
DROP POLICY "process_template_narratives_staff_admin_write" ON "public"."process_template_narratives";
CREATE POLICY "process_template_narratives_staff_admin_write" ON "public"."process_template_narratives" TO "authenticated" USING (("app"."is_staff_admin_of"("app"."commission_of_template"("template_id")) OR "app"."is_org_admin_of_commission"("app"."commission_of_template"("template_id")))) WITH CHECK (("app"."is_staff_admin_of"("app"."commission_of_template"("template_id")) OR "app"."is_org_admin_of_commission"("app"."commission_of_template"("template_id"))));
DROP POLICY "process_template_outcomes_staff_admin_write" ON "public"."process_template_outcomes";
CREATE POLICY "process_template_outcomes_staff_admin_write" ON "public"."process_template_outcomes" TO "authenticated" USING (("app"."is_staff_admin_of"("app"."commission_of_template"("template_id")) OR "app"."is_org_admin_of_commission"("app"."commission_of_template"("template_id")))) WITH CHECK (("app"."is_staff_admin_of"("app"."commission_of_template"("template_id")) OR "app"."is_org_admin_of_commission"("app"."commission_of_template"("template_id"))));
DROP POLICY "process_template_phases_staff_admin_write" ON "public"."process_template_phases";
CREATE POLICY "process_template_phases_staff_admin_write" ON "public"."process_template_phases" TO "authenticated" USING (("app"."is_staff_admin_of"("app"."commission_of_template"("template_id")) OR "app"."is_org_admin_of_commission"("app"."commission_of_template"("template_id")))) WITH CHECK (("app"."is_staff_admin_of"("app"."commission_of_template"("template_id")) OR "app"."is_org_admin_of_commission"("app"."commission_of_template"("template_id"))));
DROP POLICY "process_templates_staff_admin_write" ON "public"."process_templates";
CREATE POLICY "process_templates_staff_admin_write" ON "public"."process_templates" TO "authenticated" USING (("app"."is_staff_admin_of"("commission_id") OR "app"."is_org_admin_of_commission"("commission_id"))) WITH CHECK (("app"."is_staff_admin_of"("commission_id") OR "app"."is_org_admin_of_commission"("commission_id")));
CREATE OR REPLACE FUNCTION "app"."advance_meeting_action_item_core"("p_action_item_id" "uuid", "p_status" "text") RETURNS "public"."meeting_action_items"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission_id uuid;
  v_assigned_to uuid;
  v_uid uuid := auth.uid();
  v_result public.meeting_action_items;
begin
  if p_status not in ('open', 'in_progress', 'done', 'cancelled') then
    raise exception 'estado de item inválido' using errcode = 'check_violation';
  end if;

  select commission_id, assigned_to into v_commission_id, v_assigned_to
  from public.meeting_action_items where id = p_action_item_id;
  if v_commission_id is null then
    raise exception 'item de ação não encontrado' using errcode = 'no_data_found';
  end if;

  if not (
    (v_assigned_to is not null and v_assigned_to = v_uid)
    or app.is_staff_admin_of(v_commission_id)
    or app.is_org_admin_of_commission(v_commission_id)
  ) then
    raise exception 'você não pode alterar este item de ação' using errcode = 'HC037';
  end if;

  update public.meeting_action_items
  set status = p_status,
      completed_at = case when p_status = 'done' then coalesce(completed_at, now()) else null end,
      completed_by = case when p_status = 'done' then coalesce(completed_by, v_uid) else null end,
      updated_at = now()
  where id = p_action_item_id returning * into v_result;

  return v_result;
end;
$$;

ALTER FUNCTION "app"."advance_meeting_action_item_core"("p_action_item_id" "uuid", "p_status" "text") OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "app"."assert_meeting_staff_admin"("p_meeting_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission_id uuid;
begin
  v_commission_id := app.commission_of_meeting(p_meeting_id);
  if v_commission_id is null then
    raise exception 'reunião % não encontrada', p_meeting_id using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission_id) or app.is_org_admin_of_commission(v_commission_id)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  return v_commission_id;
end;
$$;

ALTER FUNCTION "app"."assert_meeting_staff_admin"("p_meeting_id" "uuid") OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."archive_meeting_type"("p_type_id" "uuid") RETURNS "public"."commission_meeting_types"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission_id uuid;
  v_result public.commission_meeting_types;
begin
  perform app.assert_meetings_enabled();
  select commission_id into v_commission_id
  from public.commission_meeting_types where id = p_type_id;
  if v_commission_id is null then
    raise exception 'tipo de reunião não encontrado' using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission_id) or app.is_org_admin_of_commission(v_commission_id)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  update public.commission_meeting_types set archived = true, updated_at = now()
  where id = p_type_id returning * into v_result;
  return v_result;
end;
$$;

ALTER FUNCTION "public"."archive_meeting_type"("p_type_id" "uuid") OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."conclude_meeting"("p_meeting_id" "uuid") RETURNS "public"."meetings"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission_id uuid;
  v_status text;
  v_rule text;
  v_value numeric;
  v_present integer;
  v_eligible integer;
  v_quorum_met boolean;
  v_result public.meetings;
  r_link record;
begin
  perform app.assert_meetings_enabled();

  select commission_id, status into v_commission_id, v_status
  from public.meetings where id = p_meeting_id;
  if v_commission_id is null then
    raise exception 'reunião % não encontrada', p_meeting_id using errcode = 'no_data_found';
  end if;
  -- DEFINER: internal staff_admin gate (the RLS bypass is intentional, so the
  -- gate is the authority).
  if not (app.is_staff_admin_of(v_commission_id) or app.is_org_admin_of_commission(v_commission_id)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  -- Conclude is reachable from agendada OR realizada. The lifecycle is
  -- agendada -> realizada -> em_assinatura; "Concluir" is the single staff action
  -- that records the meeting as HELD and sends the ata to signature, so when the
  -- meeting is still agendada it is first advanced through realizada (a guarded
  -- step) before the conclusion flip. This keeps the frozen frontend contract
  -- (concludeMeeting(meetingId), no separate "mark held" action) intact.
  if v_status not in ('agendada', 'realizada') then
    raise exception 'apenas reuniões agendadas ou realizadas podem ser concluídas'
      using errcode = 'HC033';
  end if;

  -- Quorum math (snapshot at conclusion; resolved design decision 7).
  -- present_count counts PRESENT PLATFORM attendees only: external guests
  -- (user_id is null) never count toward quorum (ADR 0025 / plan §7), and this
  -- must match the sign_meeting auto-flip's "required signers" set, which is
  -- likewise `user_id is not null and attendance = 'presente'`.
  select count(*) into v_eligible
  from public.commission_members where commission_id = v_commission_id;
  select count(*) into v_present
  from public.meeting_attendees
  where meeting_id = p_meeting_id and attendance = 'presente' and user_id is not null;

  if v_present < 1 then
    raise exception 'registre ao menos um participante presente antes de concluir'
      using errcode = 'HC034';
  end if;

  select quorum_rule_type, quorum_value into v_rule, v_value
  from public.commission_meeting_settings where commission_id = v_commission_id;
  v_rule := coalesce(v_rule, 'maioria_simples');

  v_quorum_met := case v_rule
    when 'maioria_simples' then v_present > v_eligible / 2.0
    when 'fixed_count' then v_present >= coalesce(v_value, 0)
    when 'percentage' then v_present >= ceil(v_eligible * coalesce(v_value, 0) / 100.0)
    else false
  end;

  perform set_config('app.in_meeting_rpc', 'on', true);

  -- The guard permits agendada->realizada and realizada->em_assinatura, but NOT
  -- agendada->em_assinatura directly. If still agendada, step through realizada
  -- first (under the flag) so both legal transitions are honoured.
  if v_status = 'agendada' then
    update public.meetings set status = 'realizada', updated_at = now()
    where id = p_meeting_id;
  end if;

  update public.meetings
  set status = 'em_assinatura',
      quorum_rule_type = v_rule,
      quorum_value = v_value,
      present_count = v_present,
      eligible_member_count = v_eligible,
      quorum_met = v_quorum_met,
      concluded_at = now(),
      concluded_by = auth.uid(),
      updated_at = now()
  where id = p_meeting_id
  returning * into v_result;

  -- Write a case_events (kind='meeting') row per linked case (resolved design
  -- decision 4) so the discussion shows on the case timeline.
  for r_link in
    select mc.case_id, mc.summary, mc.decision, m.meeting_number
    from public.meeting_cases mc
    join public.meetings m on m.id = mc.meeting_id
    where mc.meeting_id = p_meeting_id
  loop
    insert into public.case_events (case_id, kind, title, body, occurred_at, created_by)
    values (
      r_link.case_id,
      'meeting',
      'Discutido na Reunião nº ' || r_link.meeting_number,
      coalesce(
        nullif(btrim(concat_ws(E'\n\n',
          nullif(btrim(r_link.summary), ''),
          case when nullif(btrim(r_link.decision), '') is not null
               then 'Decisão: ' || btrim(r_link.decision) end
        )), ''),
        'Caso discutido nesta reunião.'
      ),
      current_date,
      auth.uid()
    );
  end loop;

  perform set_config('app.in_meeting_rpc', 'off', true);
  return v_result;
end;
$$;

ALTER FUNCTION "public"."conclude_meeting"("p_meeting_id" "uuid") OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."create_meeting"("p_commission_id" "uuid", "p_title" "text", "p_meeting_type_id" "uuid" DEFAULT NULL::"uuid", "p_scheduled_start" timestamp with time zone DEFAULT "now"(), "p_scheduled_end" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_modality" "text" DEFAULT 'presencial'::"text", "p_location_text" "text" DEFAULT NULL::"text", "p_meeting_url" "text" DEFAULT NULL::"text") RETURNS "public"."meetings"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_result public.meetings;
  v_attempt integer := 0;
begin
  perform app.assert_meetings_enabled();
  if not (app.is_staff_admin_of(p_commission_id) or app.is_org_admin_of_commission(p_commission_id)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if nullif(btrim(p_title), '') is null then
    raise exception 'informe um título para a reunião' using errcode = 'check_violation';
  end if;
  -- A given type must belong to this commission.
  if p_meeting_type_id is not null and not exists (
    select 1 from public.commission_meeting_types
    where id = p_meeting_type_id and commission_id = p_commission_id
  ) then
    raise exception 'tipo de reunião inválido' using errcode = 'check_violation';
  end if;

  perform set_config('app.in_meeting_rpc', 'on', true);

  -- Bounded unique_violation retry for the per-commission number race (mirror
  -- create_case_from_template).
  loop
    v_attempt := v_attempt + 1;
    begin
      insert into public.meetings
        (commission_id, meeting_type_id, title, scheduled_start, scheduled_end,
         modality, location_text, meeting_url, created_by)
      values
        (p_commission_id, p_meeting_type_id, btrim(p_title),
         p_scheduled_start, p_scheduled_end, coalesce(p_modality, 'presencial'),
         nullif(btrim(p_location_text), ''), nullif(btrim(p_meeting_url), ''), auth.uid())
      returning * into v_result;
      exit;
    exception
      when unique_violation then
        if v_attempt >= 3 then raise; end if;
    end;
  end loop;

  perform set_config('app.in_meeting_rpc', 'off', true);
  return v_result;
end;
$$;

ALTER FUNCTION "public"."create_meeting"("p_commission_id" "uuid", "p_title" "text", "p_meeting_type_id" "uuid", "p_scheduled_start" timestamp with time zone, "p_scheduled_end" timestamp with time zone, "p_modality" "text", "p_location_text" "text", "p_meeting_url" "text") OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."create_meeting_type"("p_commission_id" "uuid", "p_name" "text", "p_color_token" "text" DEFAULT 'slate'::"text") RETURNS "public"."commission_meeting_types"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_position integer;
  v_result public.commission_meeting_types;
begin
  perform app.assert_meetings_enabled();
  if not (app.is_staff_admin_of(p_commission_id) or app.is_org_admin_of_commission(p_commission_id)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if nullif(btrim(p_name), '') is null then
    raise exception 'informe o nome do tipo de reunião' using errcode = 'check_violation';
  end if;

  select coalesce(max(position), 0) + 1 into v_position
  from public.commission_meeting_types where commission_id = p_commission_id;

  insert into public.commission_meeting_types (commission_id, name, color_token, position)
  values (p_commission_id, btrim(p_name), coalesce(p_color_token, 'slate'), v_position)
  returning * into v_result;

  return v_result;
end;
$$;

ALTER FUNCTION "public"."create_meeting_type"("p_commission_id" "uuid", "p_name" "text", "p_color_token" "text") OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."rename_meeting_type"("p_type_id" "uuid", "p_name" "text", "p_color_token" "text") RETURNS "public"."commission_meeting_types"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission_id uuid;
  v_result public.commission_meeting_types;
begin
  perform app.assert_meetings_enabled();
  select commission_id into v_commission_id
  from public.commission_meeting_types where id = p_type_id;
  if v_commission_id is null then
    raise exception 'tipo de reunião não encontrado' using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission_id) or app.is_org_admin_of_commission(v_commission_id)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if nullif(btrim(p_name), '') is null then
    raise exception 'informe o nome do tipo de reunião' using errcode = 'check_violation';
  end if;

  update public.commission_meeting_types
  set name = btrim(p_name),
      color_token = coalesce(p_color_token, color_token),
      updated_at = now()
  where id = p_type_id returning * into v_result;

  return v_result;
end;
$$;

ALTER FUNCTION "public"."rename_meeting_type"("p_type_id" "uuid", "p_name" "text", "p_color_token" "text") OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."reopen_meeting"("p_meeting_id" "uuid") RETURNS "public"."meetings"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission_id uuid;
  v_status text;
  v_result public.meetings;
begin
  perform app.assert_meetings_enabled();

  select commission_id, status into v_commission_id, v_status
  from public.meetings where id = p_meeting_id;
  if v_commission_id is null then
    raise exception 'reunião % não encontrada', p_meeting_id using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission_id) or app.is_org_admin_of_commission(v_commission_id)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if v_status not in ('em_assinatura', 'assinada') then
    raise exception 'apenas reuniões em assinatura ou assinadas podem ser reabertas'
      using errcode = 'HC033';
  end if;

  perform set_config('app.in_meeting_rpc', 'on', true);

  update public.meeting_signatures
  set status = 'revoked'
  where meeting_id = p_meeting_id and status = 'signed';

  update public.meetings
  set status = 'realizada', concluded_at = null, concluded_by = null, updated_at = now()
  where id = p_meeting_id
  returning * into v_result;

  perform set_config('app.in_meeting_rpc', 'off', true);
  return v_result;
end;
$$;

ALTER FUNCTION "public"."reopen_meeting"("p_meeting_id" "uuid") OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."update_meeting_action_item"("p_action_item_id" "uuid", "p_title" "text", "p_description" "text" DEFAULT NULL::"text", "p_assigned_to" "uuid" DEFAULT NULL::"uuid", "p_due_date" "date" DEFAULT NULL::"date") RETURNS "public"."meeting_action_items"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission_id uuid;
  v_result public.meeting_action_items;
begin
  perform app.assert_meetings_enabled();
  select commission_id into v_commission_id
  from public.meeting_action_items where id = p_action_item_id;
  if v_commission_id is null then
    raise exception 'item de ação não encontrado' using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission_id) or app.is_org_admin_of_commission(v_commission_id)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if nullif(btrim(p_title), '') is null then
    raise exception 'informe o título do item' using errcode = 'check_violation';
  end if;
  if p_assigned_to is not null and not app.is_member_of_for(v_commission_id, p_assigned_to) then
    raise exception 'o responsável deve ser membro da comissão' using errcode = 'HC021';
  end if;

  update public.meeting_action_items
  set title = btrim(p_title),
      description = nullif(btrim(p_description), ''),
      assigned_to = p_assigned_to,
      due_date = p_due_date,
      updated_at = now()
  where id = p_action_item_id returning * into v_result;

  return v_result;
end;
$$;

ALTER FUNCTION "public"."update_meeting_action_item"("p_action_item_id" "uuid", "p_title" "text", "p_description" "text", "p_assigned_to" "uuid", "p_due_date" "date") OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."update_meeting_settings"("p_commission_id" "uuid", "p_quorum_rule_type" "text", "p_quorum_value" numeric DEFAULT NULL::numeric) RETURNS "public"."commission_meeting_settings"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_result public.commission_meeting_settings;
begin
  perform app.assert_meetings_enabled();
  if not (app.is_staff_admin_of(p_commission_id) or app.is_org_admin_of_commission(p_commission_id)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if p_quorum_rule_type not in ('maioria_simples', 'fixed_count', 'percentage') then
    raise exception 'regra de quórum inválida' using errcode = 'check_violation';
  end if;

  -- The value-shape CHECK (…090000) rejects a bad rule/value combination with
  -- check_violation; normalize maioria_simples's value to null here for clarity.
  insert into public.commission_meeting_settings (commission_id, quorum_rule_type, quorum_value, updated_at)
  values (
    p_commission_id, p_quorum_rule_type,
    case when p_quorum_rule_type = 'maioria_simples' then null else p_quorum_value end,
    now()
  )
  on conflict (commission_id) do update
  set quorum_rule_type = excluded.quorum_rule_type,
      quorum_value = excluded.quorum_value,
      updated_at = now()
  returning * into v_result;

  return v_result;
end;
$$;

ALTER FUNCTION "public"."update_meeting_settings"("p_commission_id" "uuid", "p_quorum_rule_type" "text", "p_quorum_value" numeric) OWNER TO "postgres";
DROP POLICY "meeting_action_items_select" ON "public"."meeting_action_items";
CREATE POLICY "meeting_action_items_select" ON "public"."meeting_action_items" FOR SELECT TO "authenticated" USING (("app"."is_member_of"("commission_id") OR "app"."is_org_admin_of_commission"("commission_id")));
DROP POLICY "meeting_agenda_items_select" ON "public"."meeting_agenda_items";
CREATE POLICY "meeting_agenda_items_select" ON "public"."meeting_agenda_items" FOR SELECT TO "authenticated" USING (("app"."is_member_of"("app"."commission_of_meeting"("meeting_id")) OR "app"."is_org_admin_of_commission"("app"."commission_of_meeting"("meeting_id"))));
DROP POLICY "meeting_attachments_select" ON "public"."meeting_attachments";
CREATE POLICY "meeting_attachments_select" ON "public"."meeting_attachments" FOR SELECT TO "authenticated" USING (("app"."is_member_of"("app"."commission_of_meeting"("meeting_id")) OR "app"."is_org_admin_of_commission"("app"."commission_of_meeting"("meeting_id"))));
DROP POLICY "meeting_attendees_select" ON "public"."meeting_attendees";
CREATE POLICY "meeting_attendees_select" ON "public"."meeting_attendees" FOR SELECT TO "authenticated" USING (("app"."is_member_of"("app"."commission_of_meeting"("meeting_id")) OR "app"."is_org_admin_of_commission"("app"."commission_of_meeting"("meeting_id"))));
DROP POLICY "meeting_cases_select" ON "public"."meeting_cases";
CREATE POLICY "meeting_cases_select" ON "public"."meeting_cases" FOR SELECT TO "authenticated" USING (("app"."is_member_of"("app"."commission_of_meeting"("meeting_id")) OR "app"."is_org_admin_of_commission"("app"."commission_of_meeting"("meeting_id"))));
DROP POLICY "meeting_settings_select" ON "public"."commission_meeting_settings";
CREATE POLICY "meeting_settings_select" ON "public"."commission_meeting_settings" FOR SELECT TO "authenticated" USING (("app"."is_member_of"("commission_id") OR "app"."is_org_admin_of_commission"("commission_id")));
DROP POLICY "meeting_signatures_select" ON "public"."meeting_signatures";
CREATE POLICY "meeting_signatures_select" ON "public"."meeting_signatures" FOR SELECT TO "authenticated" USING (("app"."is_member_of"("app"."commission_of_meeting"("meeting_id")) OR "app"."is_org_admin_of_commission"("app"."commission_of_meeting"("meeting_id"))));
DROP POLICY "meeting_types_select" ON "public"."commission_meeting_types";
CREATE POLICY "meeting_types_select" ON "public"."commission_meeting_types" FOR SELECT TO "authenticated" USING (("app"."is_member_of"("commission_id") OR "app"."is_org_admin_of_commission"("commission_id")));
DROP POLICY "meetings_select" ON "public"."meetings";
CREATE POLICY "meetings_select" ON "public"."meetings" FOR SELECT TO "authenticated" USING (("app"."is_member_of"("commission_id") OR "app"."is_org_admin_of_commission"("commission_id")));
DROP POLICY "meeting_action_items_staff_admin_write" ON "public"."meeting_action_items";
CREATE POLICY "meeting_action_items_staff_admin_write" ON "public"."meeting_action_items" TO "authenticated" USING (("app"."is_staff_admin_of"("commission_id") OR "app"."is_org_admin_of_commission"("commission_id"))) WITH CHECK (("app"."is_staff_admin_of"("commission_id") OR "app"."is_org_admin_of_commission"("commission_id")));
DROP POLICY "meeting_agenda_items_staff_admin_write" ON "public"."meeting_agenda_items";
CREATE POLICY "meeting_agenda_items_staff_admin_write" ON "public"."meeting_agenda_items" TO "authenticated" USING (("app"."is_staff_admin_of"("app"."commission_of_meeting"("meeting_id")) OR "app"."is_org_admin_of_commission"("app"."commission_of_meeting"("meeting_id")))) WITH CHECK (("app"."is_staff_admin_of"("app"."commission_of_meeting"("meeting_id")) OR "app"."is_org_admin_of_commission"("app"."commission_of_meeting"("meeting_id"))));
DROP POLICY "meeting_attachments_staff_admin_write" ON "public"."meeting_attachments";
CREATE POLICY "meeting_attachments_staff_admin_write" ON "public"."meeting_attachments" TO "authenticated" USING (("app"."is_staff_admin_of"("app"."commission_of_meeting"("meeting_id")) OR "app"."is_org_admin_of_commission"("app"."commission_of_meeting"("meeting_id")))) WITH CHECK (("app"."is_staff_admin_of"("app"."commission_of_meeting"("meeting_id")) OR "app"."is_org_admin_of_commission"("app"."commission_of_meeting"("meeting_id"))));
DROP POLICY "meeting_attendees_staff_admin_write" ON "public"."meeting_attendees";
CREATE POLICY "meeting_attendees_staff_admin_write" ON "public"."meeting_attendees" TO "authenticated" USING (("app"."is_staff_admin_of"("app"."commission_of_meeting"("meeting_id")) OR "app"."is_org_admin_of_commission"("app"."commission_of_meeting"("meeting_id")))) WITH CHECK (("app"."is_staff_admin_of"("app"."commission_of_meeting"("meeting_id")) OR "app"."is_org_admin_of_commission"("app"."commission_of_meeting"("meeting_id"))));
DROP POLICY "meeting_cases_staff_admin_write" ON "public"."meeting_cases";
CREATE POLICY "meeting_cases_staff_admin_write" ON "public"."meeting_cases" TO "authenticated" USING (("app"."is_staff_admin_of"("app"."commission_of_meeting"("meeting_id")) OR "app"."is_org_admin_of_commission"("app"."commission_of_meeting"("meeting_id")))) WITH CHECK (("app"."is_staff_admin_of"("app"."commission_of_meeting"("meeting_id")) OR "app"."is_org_admin_of_commission"("app"."commission_of_meeting"("meeting_id"))));
DROP POLICY "meeting_settings_staff_admin_write" ON "public"."commission_meeting_settings";
CREATE POLICY "meeting_settings_staff_admin_write" ON "public"."commission_meeting_settings" TO "authenticated" USING (("app"."is_staff_admin_of"("commission_id") OR "app"."is_org_admin_of_commission"("commission_id"))) WITH CHECK (("app"."is_staff_admin_of"("commission_id") OR "app"."is_org_admin_of_commission"("commission_id")));
DROP POLICY "meeting_types_staff_admin_write" ON "public"."commission_meeting_types";
CREATE POLICY "meeting_types_staff_admin_write" ON "public"."commission_meeting_types" TO "authenticated" USING (("app"."is_staff_admin_of"("commission_id") OR "app"."is_org_admin_of_commission"("commission_id"))) WITH CHECK (("app"."is_staff_admin_of"("commission_id") OR "app"."is_org_admin_of_commission"("commission_id")));
DROP POLICY "meetings_staff_admin_write" ON "public"."meetings";
CREATE POLICY "meetings_staff_admin_write" ON "public"."meetings" TO "authenticated" USING (("app"."is_staff_admin_of"("commission_id") OR "app"."is_org_admin_of_commission"("commission_id"))) WITH CHECK (("app"."is_staff_admin_of"("commission_id") OR "app"."is_org_admin_of_commission"("commission_id")));
CREATE OR REPLACE FUNCTION "app"."can_write_interview"("p_interview_id" "uuid", "p_uid" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select exists (
    select 1
    from public.case_interviews i
    where i.id = p_interview_id
      and (
        app.is_staff_admin_of_for(i.commission_id, p_uid)
        or app.is_org_admin_of_commission_for(i.commission_id, p_uid)
        or exists (
          select 1 from public.case_interview_interviewers iv
          where iv.interview_id = i.id and iv.user_id = p_uid
        )
      )
  );
$$;

ALTER FUNCTION "app"."can_write_interview"("p_interview_id" "uuid", "p_uid" "uuid") OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."create_interview"("p_case_id" "uuid", "p_title" "text" DEFAULT NULL::"text", "p_case_phase_id" "uuid" DEFAULT NULL::"uuid", "p_modality" "text" DEFAULT 'presencial'::"text", "p_scheduled_start" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_scheduled_end" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_location_text" "text" DEFAULT NULL::"text", "p_meeting_url" "text" DEFAULT NULL::"text") RETURNS "public"."case_interviews"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission_id uuid;
  v_result public.case_interviews;
  v_attempt integer := 0;
begin
  perform app.assert_interviews_enabled();

  select commission_id into v_commission_id from public.cases where id = p_case_id;
  if v_commission_id is null then
    raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
  end if;
  -- Bootstrap is staff_admin/admin only (resolved decision 14).
  if not (app.is_staff_admin_of(v_commission_id) or app.is_org_admin_of_commission(v_commission_id)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  perform set_config('app.in_interview_rpc', 'on', true);

  loop
    v_attempt := v_attempt + 1;
    begin
      insert into public.case_interviews
        (commission_id, case_id, case_phase_id, title, modality,
         scheduled_start, scheduled_end, location_text, meeting_url, created_by)
      values
        (v_commission_id, p_case_id, p_case_phase_id, nullif(btrim(p_title), ''),
         coalesce(p_modality, 'presencial'), p_scheduled_start, p_scheduled_end,
         nullif(btrim(p_location_text), ''), nullif(btrim(p_meeting_url), ''), auth.uid())
      returning * into v_result;
      exit;
    exception
      when unique_violation then
        if v_attempt >= 3 then raise; end if;
    end;
  end loop;

  perform set_config('app.in_interview_rpc', 'off', true);
  return v_result;
end;
$$;

ALTER FUNCTION "public"."create_interview"("p_case_id" "uuid", "p_title" "text", "p_case_phase_id" "uuid", "p_modality" "text", "p_scheduled_start" timestamp with time zone, "p_scheduled_end" timestamp with time zone, "p_location_text" "text", "p_meeting_url" "text") OWNER TO "postgres";
DROP POLICY "case_interview_attachments_select" ON "public"."case_interview_attachments";
CREATE POLICY "case_interview_attachments_select" ON "public"."case_interview_attachments" FOR SELECT TO "authenticated" USING (("app"."is_member_of"("app"."commission_of_interview"("interview_id")) OR "app"."is_org_admin_of_commission"("app"."commission_of_interview"("interview_id"))));
DROP POLICY "case_interview_attachments_write" ON "public"."case_interview_attachments";
CREATE POLICY "case_interview_attachments_write" ON "public"."case_interview_attachments" TO "authenticated" USING (("app"."can_write_interview"("interview_id", "auth"."uid"()) OR "app"."is_org_admin_of_commission"("app"."commission_of_interview"("interview_id")))) WITH CHECK (("app"."can_write_interview"("interview_id", "auth"."uid"()) OR "app"."is_org_admin_of_commission"("app"."commission_of_interview"("interview_id"))));
DROP POLICY "case_interview_interviewers_select" ON "public"."case_interview_interviewers";
CREATE POLICY "case_interview_interviewers_select" ON "public"."case_interview_interviewers" FOR SELECT TO "authenticated" USING (("app"."is_member_of"("app"."commission_of_interview"("interview_id")) OR "app"."is_org_admin_of_commission"("app"."commission_of_interview"("interview_id"))));
DROP POLICY "case_interview_interviewers_write" ON "public"."case_interview_interviewers";
CREATE POLICY "case_interview_interviewers_write" ON "public"."case_interview_interviewers" TO "authenticated" USING (("app"."can_write_interview"("interview_id", "auth"."uid"()) OR "app"."is_org_admin_of_commission"("app"."commission_of_interview"("interview_id")))) WITH CHECK (("app"."can_write_interview"("interview_id", "auth"."uid"()) OR "app"."is_org_admin_of_commission"("app"."commission_of_interview"("interview_id"))));
DROP POLICY "case_interview_subjects_select" ON "public"."case_interview_subjects";
CREATE POLICY "case_interview_subjects_select" ON "public"."case_interview_subjects" FOR SELECT TO "authenticated" USING (("app"."is_member_of"("app"."commission_of_interview"("interview_id")) OR "app"."is_org_admin_of_commission"("app"."commission_of_interview"("interview_id"))));
DROP POLICY "case_interview_subjects_write" ON "public"."case_interview_subjects";
CREATE POLICY "case_interview_subjects_write" ON "public"."case_interview_subjects" TO "authenticated" USING (("app"."can_write_interview"("interview_id", "auth"."uid"()) OR "app"."is_org_admin_of_commission"("app"."commission_of_interview"("interview_id")))) WITH CHECK (("app"."can_write_interview"("interview_id", "auth"."uid"()) OR "app"."is_org_admin_of_commission"("app"."commission_of_interview"("interview_id"))));
DROP POLICY "case_interviews_delete" ON "public"."case_interviews";
CREATE POLICY "case_interviews_delete" ON "public"."case_interviews" FOR DELETE TO "authenticated" USING (("app"."can_write_interview"("id", "auth"."uid"()) OR "app"."is_org_admin_of_commission"("app"."commission_of_interview"("id"))));
DROP POLICY "case_interviews_insert" ON "public"."case_interviews";
CREATE POLICY "case_interviews_insert" ON "public"."case_interviews" FOR INSERT TO "authenticated" WITH CHECK (("app"."is_staff_admin_of"("commission_id") OR "app"."is_org_admin_of_commission"("commission_id")));
DROP POLICY "case_interviews_select" ON "public"."case_interviews";
CREATE POLICY "case_interviews_select" ON "public"."case_interviews" FOR SELECT TO "authenticated" USING (("app"."is_member_of"("commission_id") OR "app"."is_org_admin_of_commission"("commission_id")));
DROP POLICY "case_interviews_update" ON "public"."case_interviews";
CREATE POLICY "case_interviews_update" ON "public"."case_interviews" FOR UPDATE TO "authenticated" USING (("app"."can_write_interview"("id", "auth"."uid"()) OR "app"."is_org_admin_of_commission"("app"."commission_of_interview"("id")))) WITH CHECK (("app"."can_write_interview"("id", "auth"."uid"()) OR "app"."is_org_admin_of_commission"("app"."commission_of_interview"("id"))));
DROP POLICY "phase_results_select" ON "public"."phase_results";
CREATE POLICY "phase_results_select" ON "public"."phase_results"
  FOR SELECT TO "authenticated"
  USING (("app"."is_member_of"("commission_id") OR "app"."is_org_admin_of_commission"("commission_id")));
DROP POLICY "case_phase_offered_results_select" ON "public"."case_phase_offered_results";
CREATE POLICY "case_phase_offered_results_select" ON "public"."case_phase_offered_results"
  FOR SELECT TO "authenticated"
  USING (("app"."can_read_case"("case_id", "auth"."uid"()) OR "app"."is_org_admin_of_commission"("app"."commission_of_case"("case_id"))));
DROP POLICY "phase_results_staff_admin_write" ON "public"."phase_results";
CREATE POLICY "phase_results_staff_admin_write" ON "public"."phase_results"
  TO "authenticated"
  USING (("app"."is_staff_admin_of"("commission_id") OR "app"."is_org_admin_of_commission"("commission_id")))
  WITH CHECK (("app"."is_staff_admin_of"("commission_id") OR "app"."is_org_admin_of_commission"("commission_id")));
DROP POLICY "case_phase_offered_results_staff_admin_write" ON "public"."case_phase_offered_results";
CREATE POLICY "case_phase_offered_results_staff_admin_write" ON "public"."case_phase_offered_results"
  TO "authenticated"
  USING (("app"."is_staff_admin_of"("app"."commission_of_case"("case_id")) OR "app"."is_org_admin_of_commission"("app"."commission_of_case"("case_id"))))
  WITH CHECK (("app"."is_staff_admin_of"("app"."commission_of_case"("case_id")) OR "app"."is_org_admin_of_commission"("app"."commission_of_case"("case_id"))));
CREATE OR REPLACE FUNCTION "public"."create_phase_result"("p_commission_id" "uuid", "p_label" "text", "p_color_token" "text" DEFAULT 'muted'::"text", "p_is_adverse" boolean DEFAULT false) RETURNS "public"."phase_results"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_position integer;
  v_result public.phase_results;
begin
  perform app.assert_phase_results_enabled();
  if not (app.is_staff_admin_of(p_commission_id) or app.is_org_admin_of_commission(p_commission_id)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if nullif(btrim(p_label), '') is null then
    raise exception 'informe o nome do resultado' using errcode = 'check_violation';
  end if;

  select coalesce(max(position), 0) + 1 into v_position
  from public.phase_results where commission_id = p_commission_id;

  insert into public.phase_results
    (commission_id, label, color_token, is_adverse, position)
  values
    (p_commission_id, btrim(p_label), p_color_token, coalesce(p_is_adverse, false), v_position)
  returning * into v_result;

  perform app.audit_write('phase_result.created', 'phase_result', v_result.id,
    p_commission_id, 'Resultado de fase criado: ' || v_result.label, '{}'::jsonb);

  return v_result;
end;
$$;

ALTER FUNCTION "public"."create_phase_result"("p_commission_id" "uuid", "p_label" "text", "p_color_token" "text", "p_is_adverse" boolean) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."update_phase_result"("p_result_id" "uuid", "p_label" "text", "p_color_token" "text", "p_is_adverse" boolean) RETURNS "public"."phase_results"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission_id uuid;
  v_result public.phase_results;
begin
  perform app.assert_phase_results_enabled();

  select commission_id into v_commission_id
  from public.phase_results where id = p_result_id;
  if v_commission_id is null then
    raise exception 'resultado não encontrado' using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission_id) or app.is_org_admin_of_commission(v_commission_id)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if nullif(btrim(p_label), '') is null then
    raise exception 'informe o nome do resultado' using errcode = 'check_violation';
  end if;

  update public.phase_results
  set label = btrim(p_label), color_token = p_color_token,
      is_adverse = coalesce(p_is_adverse, false), updated_at = now()
  where id = p_result_id returning * into v_result;

  perform app.audit_write('phase_result.updated', 'phase_result', v_result.id,
    v_commission_id, 'Resultado de fase atualizado: ' || v_result.label, '{}'::jsonb);

  return v_result;
end;
$$;

ALTER FUNCTION "public"."update_phase_result"("p_result_id" "uuid", "p_label" "text", "p_color_token" "text", "p_is_adverse" boolean) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."reorder_phase_results"("p_commission_id" "uuid", "p_ordered_ids" "uuid"[]) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
begin
  perform app.assert_phase_results_enabled();
  if not (app.is_staff_admin_of(p_commission_id) or app.is_org_admin_of_commission(p_commission_id)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  update public.phase_results d
  set position = o.ord, updated_at = now()
  from (
    select id, ordinality::integer as ord
    from unnest(p_ordered_ids) with ordinality as t(id, ordinality)
  ) o
  where d.commission_id = p_commission_id and d.id = o.id;
end;
$$;

ALTER FUNCTION "public"."reorder_phase_results"("p_commission_id" "uuid", "p_ordered_ids" "uuid"[]) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."archive_phase_result"("p_result_id" "uuid") RETURNS "public"."phase_results"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission_id uuid;
  v_result public.phase_results;
begin
  perform app.assert_phase_results_enabled();

  select commission_id into v_commission_id
  from public.phase_results where id = p_result_id;
  if v_commission_id is null then
    raise exception 'resultado não encontrado' using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission_id) or app.is_org_admin_of_commission(v_commission_id)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  update public.phase_results set archived = true, updated_at = now()
  where id = p_result_id returning * into v_result;

  perform app.audit_write('phase_result.archived', 'phase_result', v_result.id,
    v_commission_id, 'Resultado de fase arquivado: ' || v_result.label, '{}'::jsonb);

  return v_result;
end;
$$;

ALTER FUNCTION "public"."archive_phase_result"("p_result_id" "uuid") OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."set_case_phase_result_override"("p_case_phase_id" "uuid", "p_result_id" "uuid", "p_reason" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_case_id uuid;
  v_commission_id uuid;
  v_phase_status text;
  v_case_status text;
  v_assigned_to uuid;
  v_position integer;
  v_is_staff_admin boolean;
  v_allowed jsonb;
  v_ruleset jsonb;
  v_emits boolean;
  v_is_manual boolean;
begin
  perform app.assert_phase_results_enabled();

  select cp.case_id, cp.status, cp.assigned_to, cp.position, c.commission_id, c.status,
         cp.allowed_result_ids, cp.result_ruleset, cp.emits_result
    into v_case_id, v_phase_status, v_assigned_to, v_position, v_commission_id, v_case_status,
         v_allowed, v_ruleset, v_emits
  from public.case_phases cp
  join public.cases c on c.id = cp.case_id
  where cp.id = p_case_phase_id;

  if v_case_id is null then
    raise exception 'fase % não encontrada', p_case_phase_id using errcode = 'no_data_found';
  end if;

  v_is_staff_admin := app.is_staff_admin_of(v_commission_id) or app.is_org_admin_of_commission(v_commission_id);
  v_is_manual := coalesce(v_emits, false) and v_ruleset is null;

  if v_phase_status not in ('ativa', 'concluida') then
    raise exception 'o resultado só pode ser ajustado em uma fase ativa ou concluída'
      using errcode = 'HC057';
  end if;

  if v_phase_status = 'ativa' then
    if not (v_assigned_to = auth.uid() or v_is_staff_admin) then
      raise exception 'sem permissão' using errcode = '42501';
    end if;
  else
    if not v_is_staff_admin then
      raise exception 'sem permissão' using errcode = '42501';
    end if;
    if v_case_status in ('concluido', 'cancelado') then
      raise exception 'este caso está em um estado final e não pode mais ser alterado'
        using errcode = 'HC060';
    end if;
  end if;

  -- MANUAL phase: the result is the filler's pick over the ALLOWED subset, so it
  -- is MANDATORY (cannot be cleared) and must be one of the allowed options. An
  -- AUTOMATIC phase's override is a staff adjustment with full flexibility (any
  -- active result, clearable → revert to the computed result).
  if v_is_manual then
    if p_result_id is null then
      raise exception 'o resultado desta fase é obrigatório e não pode ser removido'
        using errcode = 'HC062';
    end if;
    if v_allowed is not null and not exists (
      select 1 from jsonb_array_elements_text(v_allowed) as e(id)
      where e.id::uuid = p_result_id
    ) then
      raise exception 'o resultado escolhido não está entre as opções permitidas para esta fase'
        using errcode = 'HC058';
    end if;
  end if;

  -- A non-null result must resolve to a NON-ARCHIVED option in the commission.
  if p_result_id is not null and not exists (
    select 1 from public.phase_results
    where id = p_result_id and commission_id = v_commission_id and archived = false
  ) then
    raise exception 'opção de resultado inválida para esta comissão'
      using errcode = 'HC058';
  end if;

  perform set_config('app.in_case_rpc', 'on', true);
  update public.case_phases
  set result_override_id = p_result_id,
      result_override_by = case when p_result_id is null then null else auth.uid() end,
      result_override_at = case when p_result_id is null then null else now() end,
      result_override_reason = case when p_result_id is null then null else nullif(btrim(p_reason), '') end,
      updated_at = now()
  where id = p_case_phase_id;
  perform set_config('app.in_case_rpc', 'off', true);

  perform app.audit_write(
    'case_phase.result_override_set', 'case_phase', p_case_phase_id, v_commission_id,
    'Resultado da fase ' || v_position || ' ajustado manualmente',
    jsonb_build_object('result_override_id', p_result_id));

  if v_phase_status = 'concluida' then
    perform app.compute_case_phase_result(p_case_phase_id);
  end if;
end;
$$;

ALTER FUNCTION "public"."set_case_phase_result_override"("p_case_phase_id" "uuid", "p_result_id" "uuid", "p_reason" "text") OWNER TO "postgres";


-- ===========================================================================
-- SECTION 5 — PHI / NSP / referral / case-PHI modules. The binding PHI ruling:
-- org_admin is a tenant-GOVERNANCE super-user, NOT a PHI actor. The additive
-- admin OR-term is DROPPED (no org swap) — identical to nsp-evidence storage and
-- pqs_members. Disposal (dispose_event_phi / dispose_case_phi) and PQS-roster
-- management keep their admin terms and are NOT reproduced here (see report).
-- Each object below is reproduced verbatim from its latest-wins source minus the
-- dropped admin OR-term.
-- ===========================================================================
CREATE OR REPLACE FUNCTION "app"."can_write_case_content"("p_case_id" "uuid", "p_uid" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission uuid;
begin
  select commission_id into v_commission from public.cases where id = p_case_id;
  if v_commission is null then
    return false;
  end if;

  return
    app.is_staff_admin_of_for(v_commission, p_uid)
    or exists (
      select 1 from public.case_access ca
      where ca.case_id = p_case_id and ca.user_id = p_uid and ca.level = 'write'
    );
end;
$$;

ALTER FUNCTION "app"."can_write_case_content"("p_case_id" "uuid", "p_uid" "uuid") OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "app"."can_write_case_narrative"("p_narrative_id" "uuid", "p_uid" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_case_id     uuid;
  v_commission  uuid;
  v_assigned_to uuid;
begin
  select cn.case_id, c.commission_id, cn.assigned_to
    into v_case_id, v_commission, v_assigned_to
  from public.case_narratives cn
  join public.cases c on c.id = cn.case_id
  where cn.id = p_narrative_id;

  if v_case_id is null then
    return false;
  end if;

  return
    app.is_staff_admin_of_for(v_commission, p_uid)
    -- NULL-safe assignee check: an UN-assigned narrative (v_assigned_to IS NULL)
    -- must NOT make this term NULL (which would poison the boolean OR and yield
    -- NULL instead of a clean false). `is not distinct from` would be true for
    -- (null, null) — wrong — so require non-null explicitly.
    or (v_assigned_to is not null and v_assigned_to = p_uid)
    or (v_assigned_to is null
        and app.can_write_case_content(v_case_id, p_uid));
end;
$$;

ALTER FUNCTION "app"."can_write_case_narrative"("p_narrative_id" "uuid", "p_uid" "uuid") OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "app"."can_manage_referral_source"("p_referral_id" "uuid", "p_uid" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select exists (
    select 1
    from public.case_referral r
    where r.id = p_referral_id
      and (app.is_staff_admin_of_for(r.source_commission_id, p_uid))
  );
$$;

ALTER FUNCTION "app"."can_manage_referral_source"("p_referral_id" "uuid", "p_uid" "uuid") OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "app"."can_manage_referral_target"("p_referral_id" "uuid", "p_uid" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select exists (
    select 1
    from public.case_referral r
    where r.id = p_referral_id
      and (app.is_staff_admin_of_for(r.target_commission_id, p_uid))
  );
$$;

ALTER FUNCTION "app"."can_manage_referral_target"("p_referral_id" "uuid", "p_uid" "uuid") OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."create_referral_draft"("p_source_case_id" "uuid", "p_target_commission_id" "uuid", "p_referral_type_id" "uuid", "p_subject" "text", "p_response_expected" boolean DEFAULT NULL::boolean, "p_description_md" "text" DEFAULT NULL::"text") RETURNS "public"."case_referral"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_source_commission uuid;
  v_type public.referral_types;
  v_response_expected boolean;
  v_row public.case_referral;
begin
  perform app.assert_referrals_enabled();

  select commission_id into v_source_commission from public.cases where id = p_source_case_id;
  if v_source_commission is null then
    raise exception 'caso não encontrado' using errcode = 'no_data_found';
  end if;
  -- Authority: staff_admin of the SOURCE case's commission (same authority as
  -- close_case) OR platform admin.
  if not (app.is_staff_admin_of_for(v_source_commission, auth.uid())) then
    raise exception 'apenas a coordenação da comissão de origem pode encaminhar o caso'
      using errcode = 'HC071';
  end if;
  if v_source_commission = p_target_commission_id then
    raise exception 'a comissão de destino deve ser diferente da origem' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.commissions where id = p_target_commission_id) then
    raise exception 'comissão de destino não encontrada' using errcode = 'no_data_found';
  end if;
  if btrim(coalesce(p_subject, '')) = '' then
    raise exception 'informe um assunto para o encaminhamento' using errcode = 'check_violation';
  end if;

  select * into v_type from public.referral_types where id = p_referral_type_id;
  if v_type.id is null or not v_type.is_active then
    raise exception 'tipo de encaminhamento inválido' using errcode = 'check_violation';
  end if;
  v_response_expected := coalesce(p_response_expected, v_type.default_response_expected);

  insert into public.case_referral (
    source_case_id, source_commission_id, target_commission_id, referral_type_id,
    type_label, subject, description_md, response_expected, created_by
  ) values (
    p_source_case_id, v_source_commission, p_target_commission_id, v_type.id,
    v_type.label, btrim(p_subject), nullif(btrim(coalesce(p_description_md, '')), ''),
    v_response_expected, auth.uid()
  )
  returning * into v_row;

  return v_row;
end;
$$;

ALTER FUNCTION "public"."create_referral_draft"("uuid", "uuid", "uuid", "text", boolean, "text") OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."list_referral_target_commissions"("p_source_commission_id" "uuid") RETURNS TABLE("id" "uuid", "name" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
begin
  perform app.assert_referrals_enabled();
  if not (app.is_staff_admin_of(p_source_commission_id)) then
    raise exception 'apenas a coordenação da comissão de origem pode listar destinos'
      using errcode = 'HC071';
  end if;
  return query
    select c.id, c.name
    from public.commissions c
    where c.id <> p_source_commission_id
    order by c.name asc;
end;
$$;

ALTER FUNCTION "public"."list_referral_target_commissions"("p_source_commission_id" "uuid") OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."set_case_patient"("p_case_id" "uuid", "p_name" "text" DEFAULT NULL::"text", "p_mrn" "text" DEFAULT NULL::"text", "p_date_of_birth" "date" DEFAULT NULL::"date", "p_age_years" integer DEFAULT NULL::integer, "p_sex" "text" DEFAULT 'unknown'::"text", "p_encounter_ref" "text" DEFAULT NULL::"text", "p_unit" "text" DEFAULT NULL::"text", "p_attending" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_case public.cases;
begin
  perform app.assert_case_patient_enabled();

  select * into v_case from public.cases where id = p_case_id;
  if v_case.id is null then
    raise exception 'caso não encontrado' using errcode = 'P0002';
  end if;
  -- COORDINATOR-ONLY write gate (not can_read_case — that is the broad READ scope).
  if not (app.is_staff_admin_of(v_case.commission_id)) then
    raise exception 'apenas a coordenação da comissão pode registrar dados do paciente'
      using errcode = '42501';
  end if;
  if not v_case.patient_enabled then
    raise exception 'este caso não coleta identificação do paciente'
      using errcode = 'check_violation';
  end if;
  if v_case.phi_disposed_at is not null then
    raise exception 'os dados do paciente deste caso foram descartados e não podem mais ser alterados'
      using errcode = 'check_violation';
  end if;
  if p_sex is not null and p_sex not in ('female', 'male', 'other', 'unknown') then
    raise exception 'sexo inválido' using errcode = 'check_violation';
  end if;

  insert into public.case_patient (
    case_id, name, mrn, date_of_birth, age_years, sex, encounter_ref, unit, attending
  ) values (
    p_case_id, p_name, p_mrn, p_date_of_birth, p_age_years, coalesce(p_sex, 'unknown'),
    p_encounter_ref, p_unit, p_attending
  )
  on conflict (case_id) do update
  set name = excluded.name, mrn = excluded.mrn, date_of_birth = excluded.date_of_birth,
      age_years = excluded.age_years, sex = excluded.sex,
      encounter_ref = excluded.encounter_ref, unit = excluded.unit,
      attending = excluded.attending, updated_at = now();

  -- Maintain the denormalized has_patient flag. Runs under the case-RPC guard
  -- bypass so it works even on a terminal case (cases has no updated_at).
  if not v_case.has_patient then
    perform set_config('app.in_case_rpc', 'on', true);
    update public.cases set has_patient = true where id = p_case_id;
    perform set_config('app.in_case_rpc', 'off', true);
  end if;
end;
$$;

ALTER FUNCTION "public"."set_case_patient"("p_case_id" "uuid", "p_name" "text", "p_mrn" "text", "p_date_of_birth" "date", "p_age_years" integer, "p_sex" "text", "p_encounter_ref" "text", "p_unit" "text", "p_attending" "text") OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."set_template_collects_patient"("p_template_id" "uuid", "p_collects" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission_id uuid;
  v_status text;
begin
  perform app.assert_case_patient_enabled();

  select commission_id, status into v_commission_id, v_status
  from public.process_templates where id = p_template_id;
  if v_commission_id is null then
    raise exception 'processo % não encontrado', p_template_id using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission_id)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if v_status <> 'draft' then
    raise exception 'apenas processos em rascunho podem ser editados'
      using errcode = 'check_violation';
  end if;

  update public.process_templates
  set collects_patient = coalesce(p_collects, false), updated_at = now()
  where id = p_template_id;
end;
$$;

ALTER FUNCTION "public"."set_template_collects_patient"("p_template_id" "uuid", "p_collects" boolean) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."notify_safety_event"("p_reporting_commission_id" "uuid", "p_title" "text", "p_description_md" "text" DEFAULT NULL::"text", "p_suspected_harm_level" "text" DEFAULT 'unknown'::"text", "p_case_id" "uuid" DEFAULT NULL::"uuid", "p_event_type_id" "uuid" DEFAULT NULL::"uuid", "p_location" "text" DEFAULT NULL::"text", "p_discovered_at" "date" DEFAULT NULL::"date") RETURNS "public"."patient_safety_event"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_event public.patient_safety_event;
  v_attempts int := 0;
  v_case_commission uuid;
begin
  perform app.assert_patient_safety_enabled();

  -- Authorize: ANY member of the reporting commission (just-culture), or admin.
  if not (app.is_member_of(p_reporting_commission_id)) then
    raise exception 'apenas membros da comissão notificante podem registrar um evento'
      using errcode = '42501';
  end if;

  if btrim(coalesce(p_title, '')) = '' then
    raise exception 'informe um título para o evento' using errcode = 'check_violation';
  end if;

  -- A case-linked event's case must belong to the reporting commission (honesty).
  if p_case_id is not null then
    select commission_id into v_case_commission from public.cases where id = p_case_id;
    if v_case_commission is null then
      raise exception 'caso não encontrado' using errcode = 'P0002';
    end if;
    if v_case_commission <> p_reporting_commission_id then
      raise exception 'o caso não pertence à comissão notificante' using errcode = 'check_violation';
    end if;
  end if;

  perform set_config('app.in_safety_rpc', 'on', true);

  -- Insert with a bounded retry over the minted code (the trigger mints it; the
  -- unique(code) backstops a rare concurrent collision).
  loop
    begin
      insert into public.patient_safety_event (
        reporting_commission_id, case_id, discovered_at, location, reported_by,
        event_type_id, suspected_harm_level, title, description_md,
        status, current_owner_kind, current_owner_commission_id
      ) values (
        p_reporting_commission_id, p_case_id, p_discovered_at, p_location, auth.uid(),
        p_event_type_id, coalesce(p_suspected_harm_level, 'unknown'), p_title, p_description_md,
        'reported', 'pqs', null
      )
      returning * into v_event;
      exit;
    exception when unique_violation then
      v_attempts := v_attempts + 1;
      if v_attempts >= 5 then raise; end if;
    end;
  end loop;

  -- Open the initial custody interval at the NSP.
  insert into public.event_custody (event_id, owner_kind, owner_commission_id, assigned_by, note)
  values (v_event.id, 'pqs', null, auth.uid(), 'Notificação inicial ao NSP');

  -- Case-linked: write the Phase-12 timeline entry (body is NOT NULL).
  if p_case_id is not null then
    insert into public.case_events (case_id, kind, title, body, occurred_at, created_by)
    values (
      p_case_id, 'safety_event',
      'Evento de segurança ' || v_event.code,
      'Evento ' || v_event.code || ' notificado ao NSP: ' || p_title,
      coalesce(p_discovered_at, current_date), auth.uid()
    );
  end if;

  perform set_config('app.in_safety_rpc', 'off', true);
  return v_event;
end;
$$;

ALTER FUNCTION "public"."notify_safety_event"("p_reporting_commission_id" "uuid", "p_title" "text", "p_description_md" "text", "p_suspected_harm_level" "text", "p_case_id" "uuid", "p_event_type_id" "uuid", "p_location" "text", "p_discovered_at" "date") OWNER TO "postgres";
DROP POLICY "case_referral_insert_source_coord" ON "public"."case_referral";
CREATE POLICY "case_referral_insert_source_coord" ON "public"."case_referral"
  FOR INSERT TO "authenticated"
  WITH CHECK (
    "app"."is_staff_admin_of_for"("source_commission_id", "auth"."uid"())
  );

-- ===========================================================================
-- SECTION 6 — Storage object policies. The 8 commission-scoped buckets swap
-- their admin OR-term to is_org_admin_of_commission over seg[1] (commission_id);
-- the case-documents SELECT is reproduced from its latest-wins (referrals.sql,
-- the snapshot-aware version). The PHI buckets (nsp-evidence x3, referral-
-- attachments x2) DROP the admin term with no org swap (PHI is not org-governed).
-- DROP+CREATE each.
-- ===========================================================================
DROP POLICY IF EXISTS "form_assets_select_member" ON "storage"."objects";
create policy form_assets_select_member on storage.objects
  for select to authenticated
  using (
    bucket_id = 'form-assets'
    and (
      app.is_org_admin_of_commission(((storage.foldername(name))[1])::uuid)
      or app.is_member_of(((storage.foldername(name))[1])::uuid)
    )
  );
DROP POLICY IF EXISTS "form_assets_insert_staff_admin" ON "storage"."objects";
create policy form_assets_insert_staff_admin on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'form-assets'
    and (
      app.is_org_admin_of_commission(((storage.foldername(name))[1])::uuid)
      or app.is_staff_admin_of(((storage.foldername(name))[1])::uuid)
    )
  );
DROP POLICY IF EXISTS "case_documents_insert_staff_admin" ON "storage"."objects";
create policy case_documents_insert_staff_admin on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'case-documents'
    and (
      app.is_org_admin_of_commission(((storage.foldername(name))[1])::uuid)
      or app.is_staff_admin_of(((storage.foldername(name))[1])::uuid)
    )
  );
DROP POLICY IF EXISTS "meeting_attachments_select_member" ON "storage"."objects";
create policy meeting_attachments_select_member on storage.objects
  for select to authenticated
  using (
    bucket_id = 'meeting-attachments'
    and (
      app.is_org_admin_of_commission(((storage.foldername(name))[1])::uuid)
      or app.is_member_of(((storage.foldername(name))[1])::uuid)
    )
  );
DROP POLICY IF EXISTS "meeting_attachments_insert_staff_admin" ON "storage"."objects";
create policy meeting_attachments_insert_staff_admin on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'meeting-attachments'
    and (
      app.is_org_admin_of_commission(((storage.foldername(name))[1])::uuid)
      or app.is_staff_admin_of(((storage.foldername(name))[1])::uuid)
    )
  );
DROP POLICY IF EXISTS "interview_attachments_obj_select_member" ON "storage"."objects";
create policy interview_attachments_obj_select_member on storage.objects
  for select to authenticated
  using (
    bucket_id = 'interview-attachments'
    and (
      app.is_org_admin_of_commission(((storage.foldername(name))[1])::uuid)
      or app.is_member_of(((storage.foldername(name))[1])::uuid)
    )
  );
DROP POLICY IF EXISTS "interview_attachments_obj_insert_writable" ON "storage"."objects";
create policy interview_attachments_obj_insert_writable on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'interview-attachments'
    and (
      app.is_org_admin_of_commission(((storage.foldername(name))[1])::uuid)
      or app.can_write_interview(((storage.foldername(name))[2])::uuid, auth.uid())
    )
  );
DROP POLICY IF EXISTS "case_documents_select_member" ON "storage"."objects";
CREATE POLICY "case_documents_select_member" ON "storage"."objects"
  FOR SELECT TO "authenticated"
  USING (
    bucket_id = 'case-documents'
    and (
      app.is_org_admin_of_commission(((storage.foldername(name))[1])::uuid)
      or app.is_member_of(((storage.foldername(name))[1])::uuid)
      or app.can_read_snapshot_document(name, auth.uid())
    )
  );
DROP POLICY IF EXISTS "nsp_evidence_obj_select_member" ON "storage"."objects";
create policy nsp_evidence_obj_select_member on storage.objects
  for select to authenticated
  using (
    bucket_id = 'nsp-evidence'
    and (
      app.can_read_event(((storage.foldername(name))[1])::uuid, auth.uid())
    )
  );
DROP POLICY IF EXISTS "nsp_evidence_obj_insert_writable" ON "storage"."objects";
create policy nsp_evidence_obj_insert_writable on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'nsp-evidence'
    and (
      app.can_write_rca(((storage.foldername(name))[2])::uuid, auth.uid())
    )
  );
DROP POLICY IF EXISTS "capa_evidence_obj_select_member" ON "storage"."objects";
create policy capa_evidence_obj_select_member on storage.objects
  for select to authenticated
  using (
    bucket_id = 'nsp-evidence'
    and (
      app.can_read_capa(((storage.foldername(name))[1])::uuid, auth.uid())
    )
  );
DROP POLICY IF EXISTS "referral_attachments_obj_select" ON "storage"."objects";
create policy referral_attachments_obj_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'referral-attachments'
    and (
      app.can_read_referral_phi(((storage.foldername(name))[2])::uuid, auth.uid())
    )
  );
DROP POLICY IF EXISTS "referral_attachments_obj_insert" ON "storage"."objects";
create policy referral_attachments_obj_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'referral-attachments'
    and (
      app.can_manage_referral_target(((storage.foldername(name))[2])::uuid, auth.uid())
    )
  );

-- ===========================================================================
-- SECTION 7 — Identity standalone management policies. commissions_admin_write
-- gains an org-admin write path (foreign-hospital control: org_admin writes only
-- commissions in their own org); commission_members_admin_all + the OR-term
-- SELECT policies (commission_members_select, commissions_select_member_or_admin,
-- profiles_admin_select, profiles_select_self_or_admin) gain the matching org
-- term. profiles_admin_insert/update stay platform-only (lead decision).
-- ===========================================================================
DROP POLICY "commissions_admin_write" ON "public"."commissions";
CREATE POLICY "commissions_admin_write" ON "public"."commissions" TO "authenticated" USING (("app"."is_admin"() OR "app"."is_org_admin_of"("organization_id"))) WITH CHECK (("app"."is_admin"() OR "app"."is_org_admin_of"("organization_id")));
DROP POLICY "commission_members_admin_all" ON "public"."commission_members";
CREATE POLICY "commission_members_admin_all" ON "public"."commission_members" TO "authenticated" USING (("app"."is_admin"() OR "app"."is_org_admin_of_commission"("commission_id"))) WITH CHECK (("app"."is_admin"() OR "app"."is_org_admin_of_commission"("commission_id")));
DROP POLICY "profiles_admin_select" ON "public"."profiles";
CREATE POLICY "profiles_admin_select" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("app"."is_admin"() OR EXISTS (SELECT 1 FROM public.commission_members cm JOIN public.commissions c ON c.id = cm.commission_id WHERE cm.user_id = "profiles"."id" AND app.is_org_admin_of(c.organization_id))));
DROP POLICY "commission_members_select" ON "public"."commission_members";
CREATE POLICY "commission_members_select" ON "public"."commission_members" FOR SELECT TO "authenticated" USING (("app"."is_member_of"("commission_id") OR "app"."is_org_admin_of_commission"("commission_id")));
DROP POLICY "commissions_select_member_or_admin" ON "public"."commissions";
CREATE POLICY "commissions_select_member_or_admin" ON "public"."commissions" FOR SELECT TO "authenticated" USING (("app"."is_member_of"("id") OR "app"."is_org_admin_of"("organization_id")));
DROP POLICY "profiles_select_self_or_admin" ON "public"."profiles";
CREATE POLICY "profiles_select_self_or_admin" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((("id" = "auth"."uid"()) OR EXISTS (SELECT 1 FROM public.commission_members cm JOIN public.commissions c ON c.id = cm.commission_id WHERE cm.user_id = "profiles"."id" AND app.is_org_admin_of(c.organization_id)) OR (EXISTS ( SELECT 1
   FROM ("public"."commission_members" "me"
     JOIN "public"."commission_members" "them" ON (("them"."commission_id" = "me"."commission_id")))
  WHERE (("me"."user_id" = "auth"."uid"()) AND ("them"."user_id" = "profiles"."id"))))));

-- ===========================================================================
-- SECTION 8 — Audit 3-tier hash chain (AUTHOR: backend lead; lockstep-critical).
--
-- Greenfield (decision #2): no rows to preserve, the chain restarts on reseed,
-- so we may freely change the canonical tuple shape. Three MUTUALLY-EXCLUSIVE
-- chains keyed by the (organization_id, commission_id) pair:
--   platform   : org NULL  AND commission NULL
--   org        : org SET   AND commission NULL
--   commission : org SET   AND commission SET   (org derived from the commission)
--
-- LOCKSTEP INVARIANT (the critical risk): the canonical tuple that audit_write
-- HASHES at insert time and the one verify_audit_chain RECONSTRUCTS at verify
-- time must be byte-identical. Both are redefined HERE, in one migration, and
-- both now include organization_id in the SAME tuple position. A pgTAP writes a
-- row per tier and asserts verify_audit_chain returns ok per tier.
-- ===========================================================================

-- 8.1 — add the organization_id column (nullable; NULL = platform-tier rows).
ALTER TABLE "public"."audit_log"
  ADD COLUMN "organization_id" "uuid";

COMMENT ON COLUMN "public"."audit_log"."organization_id" IS
  'Tenant org for this audit row. NULL+commission NULL = platform chain; SET+commission NULL = org chain; SET+commission SET = commission chain (org derived from the commission). Part of the hashed canonical tuple.';

-- 8.2 — replace the 2 partial unique seq indexes with 3 (one per tier).
DROP INDEX "public"."audit_log_commission_seq_key";
DROP INDEX "public"."audit_log_global_seq_key";

CREATE UNIQUE INDEX "audit_log_platform_seq_key" ON "public"."audit_log" USING "btree" ("seq")
  WHERE ("organization_id" IS NULL AND "commission_id" IS NULL);
CREATE UNIQUE INDEX "audit_log_org_seq_key" ON "public"."audit_log" USING "btree" ("organization_id", "seq")
  WHERE ("organization_id" IS NOT NULL AND "commission_id" IS NULL);
CREATE UNIQUE INDEX "audit_log_commission_seq_key" ON "public"."audit_log" USING "btree" ("commission_id", "seq")
  WHERE ("commission_id" IS NOT NULL);

-- 8.2b — DROP the OLD function signatures FIRST. Appending a trailing param via
-- CREATE OR REPLACE would otherwise leave the old overload in place (a second
-- audit_write/audit_canonical/verify_audit_chain), and the 62 existing 6-arg
-- callers would resolve to the STALE overload (no org logic). Dropping the old
-- exact signatures removes that overload so the new ones are the only match.
-- verify_audit_chain is dropped because adding p_organization changes its arity;
-- callers (the app + pgTAP) move to the new 2-arg form.
DROP FUNCTION IF EXISTS "app"."audit_canonical"("p_seq" bigint, "p_occurred_at" timestamp with time zone, "p_actor_id" "uuid", "p_actor_is_admin" boolean, "p_commission_id" "uuid", "p_action" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_summary" "text", "p_metadata" "jsonb");
DROP FUNCTION IF EXISTS "app"."audit_write"("p_action" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_commission" "uuid", "p_summary" "text", "p_metadata" "jsonb");
DROP FUNCTION IF EXISTS "public"."verify_audit_chain"("p_commission" "uuid");

-- 8.3 — audit_canonical gains p_organization_id (appended, hashed). The tuple
-- order is FIXED here and MUST match verify exactly. organization_id is placed
-- immediately AFTER commission_id in the tuple.
CREATE OR REPLACE FUNCTION "app"."audit_canonical"("p_seq" bigint, "p_occurred_at" timestamp with time zone, "p_actor_id" "uuid", "p_actor_is_admin" boolean, "p_commission_id" "uuid", "p_action" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_summary" "text", "p_metadata" "jsonb", "p_organization_id" "uuid" DEFAULT NULL::"uuid") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'app', 'pg_catalog'
    AS $$
  select concat_ws(
    chr(30),  -- U+001E record separator
    p_seq::text,
    to_char(p_occurred_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    coalesce(p_actor_id::text, ''),
    case when p_actor_is_admin then 'true' else 'false' end,
    coalesce(p_organization_id::text, ''),
    coalesce(p_commission_id::text, ''),
    p_action,
    p_entity_type,
    p_entity_id::text,
    p_summary,
    app.jsonb_canonical(p_metadata)
  );
$$;

ALTER FUNCTION "app"."audit_canonical"("p_seq" bigint, "p_occurred_at" timestamp with time zone, "p_actor_id" "uuid", "p_actor_is_admin" boolean, "p_commission_id" "uuid", "p_action" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_summary" "text", "p_metadata" "jsonb", "p_organization_id" "uuid") OWNER TO "postgres";

-- 8.4 — audit_write gains p_organization as the LAST param (DEFAULT NULL) so the
-- 62 existing 4-6 arg callers are UNCHANGED. Org is derived from the commission
-- when a commission is passed; the lock key + tail query are keyed on the
-- (org, commission) tuple; the hash includes organization_id.
CREATE OR REPLACE FUNCTION "app"."audit_write"("p_action" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_commission" "uuid", "p_summary" "text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb", "p_organization" "uuid" DEFAULT NULL::"uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_actor uuid := auth.uid();
  v_actor_is_admin boolean := false;
  v_seq bigint;
  v_prev_hash text;
  v_occurred timestamptz := now();
  v_lock_key text;
  v_row_hash text;
  v_org uuid := p_organization;
begin
  if not app.feature_enabled('audit_trail') then
    return;
  end if;

  if v_actor is not null then
    v_actor_is_admin := coalesce(app.is_admin(), false);
  end if;

  -- Derive the org from the commission when only a commission was passed (the
  -- 62 trg_audit_* callers do exactly this). A commission ALWAYS belongs to an
  -- org (post-reseed), so the commission chain is always org-set + commission-set.
  if v_org is null and p_commission is not null then
    select organization_id into v_org from public.commissions where id = p_commission;
  end if;

  -- The CHAIN is identified by PRECEDENCE, not the raw (org, commission) tuple:
  --   commission row -> the commission chain (keyed on commission_id alone)
  --   org row        -> the org chain        (keyed on organization_id, commission NULL)
  --   platform row   -> the platform chain   (both NULL)
  -- Keying the commission chain on commission_id ALONE (not the tuple) keeps seq
  -- monotonic per commission even if a row's org is backfilled later, matching
  -- the audit_log_commission_seq_key unique index (commission_id, seq). The lock
  -- + tail use the SAME chain identity so seq never collides.
  if p_commission is not null then
    v_lock_key := 'audit:c:' || p_commission::text;
    perform pg_advisory_xact_lock(hashtextextended(v_lock_key, 0));
    select seq, row_hash into v_seq, v_prev_hash
    from public.audit_log
    where commission_id = p_commission
    order by seq desc
    limit 1;
  elsif v_org is not null then
    v_lock_key := 'audit:o:' || v_org::text;
    perform pg_advisory_xact_lock(hashtextextended(v_lock_key, 0));
    select seq, row_hash into v_seq, v_prev_hash
    from public.audit_log
    where organization_id = v_org and commission_id is null
    order by seq desc
    limit 1;
  else
    v_lock_key := 'audit:p';
    perform pg_advisory_xact_lock(hashtextextended(v_lock_key, 0));
    select seq, row_hash into v_seq, v_prev_hash
    from public.audit_log
    where organization_id is null and commission_id is null
    order by seq desc
    limit 1;
  end if;

  v_seq := coalesce(v_seq, 0) + 1;

  v_row_hash := encode(
    extensions.digest(
      coalesce(v_prev_hash, '') || app.audit_canonical(
        v_seq, v_occurred, v_actor, v_actor_is_admin, p_commission,
        p_action, p_entity_type, p_entity_id, p_summary,
        coalesce(p_metadata, '{}'::jsonb), v_org
      ),
      'sha256'
    ),
    'hex'
  );

  insert into public.audit_log (
    occurred_at, organization_id, commission_id, actor_id, actor_is_admin,
    action, entity_type, entity_id, summary, metadata,
    seq, prev_hash, row_hash
  ) values (
    v_occurred, v_org, p_commission, v_actor, v_actor_is_admin,
    p_action, p_entity_type, p_entity_id, p_summary,
    coalesce(p_metadata, '{}'::jsonb),
    v_seq, v_prev_hash, v_row_hash
  );
end;
$$;

ALTER FUNCTION "app"."audit_write"("p_action" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_commission" "uuid", "p_summary" "text", "p_metadata" "jsonb", "p_organization" "uuid") OWNER TO "postgres";

-- 8.5 — verify_audit_chain: reconstruct with organization_id (lockstep with 8.3),
-- 3-tier chain enumeration, per-tier authorization.
--   p_commission set        -> that commission chain ; authz staff_admin|org_admin
--   p_organization set      -> that org chain (commission NULL) ; authz org_admin
--   both NULL               -> platform chain ; authz is_admin (platform_admin)
CREATE OR REPLACE FUNCTION "public"."verify_audit_chain"("p_commission" "uuid" DEFAULT NULL::"uuid", "p_organization" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("ok" boolean, "broken_seq" bigint)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_rec record;
  v_prev_hash text;
  v_expected text;
  v_chain_org uuid;
  v_chain_comm uuid;
begin
  perform app.assert_audit_enabled();

  -- Authorization, per tier.
  if p_commission is not null then
    if not (app.is_staff_admin_of(p_commission) or app.is_org_admin_of_commission(p_commission)) then
      raise exception 'não autorizado' using errcode = '42501';
    end if;
  elsif p_organization is not null then
    if not app.is_org_admin_of(p_organization) then
      raise exception 'não autorizado' using errcode = '42501';
    end if;
  else
    -- platform chain: platform_admin only.
    if not app.is_admin() then
      raise exception 'não autorizado' using errcode = '42501';
    end if;
  end if;

  -- Build the chain identities to verify, BY PRECEDENCE (matching audit_write):
  --   v_chain_comm set        -> commission chain (enumerate by commission_id alone)
  --   v_chain_org set, comm 0 -> org chain        (organization_id, commission NULL)
  --   both 0                  -> platform chain   (both NULL)
  -- A sentinel ('0' uuid) marks "not this tier" since a plain NULL is ambiguous
  -- with the platform tier; we use a separate boolean column instead.
  for v_chain_org, v_chain_comm in
    select o, c from (
      -- a specific commission chain (org irrelevant — keyed on commission_id)
      select null::uuid as o, p_commission as c
      where p_commission is not null
      union all
      -- a specific org chain (commission NULL)
      select p_organization as o, null::uuid as c
      where p_commission is null and p_organization is not null
      union all
      -- platform chain (org NULL, commission NULL)
      select null::uuid as o, null::uuid as c
      where p_commission is null and p_organization is null
    ) chains
  loop
    v_prev_hash := null;
    for v_rec in
      select * from public.audit_log
      where (
              -- commission tier: keyed on commission_id ALONE
              (v_chain_comm is not null and commission_id = v_chain_comm)
              -- org tier: organization_id set, commission NULL
              or (v_chain_comm is null and v_chain_org is not null
                  and organization_id = v_chain_org and commission_id is null)
              -- platform tier: both NULL
              or (v_chain_comm is null and v_chain_org is null
                  and organization_id is null and commission_id is null)
            )
      order by seq asc
    loop
      v_expected := encode(
        extensions.digest(
          coalesce(v_prev_hash, '') || app.audit_canonical(
            v_rec.seq, v_rec.occurred_at, v_rec.actor_id, v_rec.actor_is_admin,
            v_rec.commission_id, v_rec.action, v_rec.entity_type, v_rec.entity_id,
            v_rec.summary, v_rec.metadata, v_rec.organization_id
          ),
          'sha256'
        ),
        'hex'
      );
      if v_rec.prev_hash is distinct from v_prev_hash or v_rec.row_hash <> v_expected then
        ok := false;
        broken_seq := v_rec.seq;
        return next;
        return;
      end if;
      v_prev_hash := v_rec.row_hash;
    end loop;
  end loop;

  ok := true;
  broken_seq := null;
  return next;
end;
$$;

ALTER FUNCTION "public"."verify_audit_chain"("p_commission" "uuid", "p_organization" "uuid") OWNER TO "postgres";

-- 8.6 — audit_log_select: 3-tier read.
DROP POLICY "audit_log_select" ON "public"."audit_log";
CREATE POLICY "audit_log_select" ON "public"."audit_log" FOR SELECT TO "authenticated"
  USING (
    "app"."is_staff_admin_of"("commission_id")
    OR "app"."is_org_admin_of"("organization_id")
    OR ("organization_id" IS NULL AND "commission_id" IS NULL AND "app"."is_admin"())
  );

-- 8.7 — grants for the new function signatures (mirror the prior REVOKE/GRANT).
REVOKE ALL ON FUNCTION "app"."audit_canonical"("p_seq" bigint, "p_occurred_at" timestamp with time zone, "p_actor_id" "uuid", "p_actor_is_admin" boolean, "p_commission_id" "uuid", "p_action" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_summary" "text", "p_metadata" "jsonb", "p_organization_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."audit_canonical"("p_seq" bigint, "p_occurred_at" timestamp with time zone, "p_actor_id" "uuid", "p_actor_is_admin" boolean, "p_commission_id" "uuid", "p_action" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_summary" "text", "p_metadata" "jsonb", "p_organization_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "app"."audit_canonical"("p_seq" bigint, "p_occurred_at" timestamp with time zone, "p_actor_id" "uuid", "p_actor_is_admin" boolean, "p_commission_id" "uuid", "p_action" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_summary" "text", "p_metadata" "jsonb", "p_organization_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "app"."audit_write"("p_action" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_commission" "uuid", "p_summary" "text", "p_metadata" "jsonb", "p_organization" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."audit_write"("p_action" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_commission" "uuid", "p_summary" "text", "p_metadata" "jsonb", "p_organization" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "app"."audit_write"("p_action" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_commission" "uuid", "p_summary" "text", "p_metadata" "jsonb", "p_organization" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."verify_audit_chain"("p_commission" "uuid", "p_organization" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."verify_audit_chain"("p_commission" "uuid", "p_organization" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."verify_audit_chain"("p_commission" "uuid", "p_organization" "uuid") TO "service_role";

-- ===========================================================================
-- SECTION 3b — Responses/answers SELECT policies (caught by the live-schema
-- grep assertion; the bulk pass missed these two tenant-data SELECT terms).
-- The bare `OR is_admin()` -> `OR is_org_admin_of_commission(commission_id)`,
-- in the SAME position so an org_admin reads ALL responses/answers in their org
-- (parity with today's platform-admin reach, now org-scoped).
-- ===========================================================================
DROP POLICY "responses_select" ON "public"."responses";
CREATE POLICY "responses_select" ON "public"."responses" FOR SELECT TO "authenticated" USING ((("created_by" = "auth"."uid"()) OR "app"."is_org_admin_of_commission"("commission_id") OR (("status" = 'submitted'::"text") AND "app"."is_staff_admin_of"("commission_id"))));

DROP POLICY "answers_select" ON "public"."answers";
CREATE POLICY "answers_select" ON "public"."answers" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."responses" "r"
  WHERE (("r"."id" = "answers"."response_id") AND (("r"."created_by" = "auth"."uid"()) OR "app"."is_org_admin_of_commission"("r"."commission_id") OR (("r"."status" = 'submitted'::"text") AND "app"."is_staff_admin_of"("r"."commission_id")))))));
