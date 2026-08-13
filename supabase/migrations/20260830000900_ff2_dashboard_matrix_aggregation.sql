-- FF-2 (ADR 0089 §Consequences · FUP-FF2-2) — matrix aggregation for the dashboard.
--
-- Until this lands a filled matrix is WRITE-ONLY: the grid is stored, immutable,
-- carried through clones and corrections — and appears in no dashboard, on a
-- platform whose stated purpose is that statistics come from dashboards instead
-- of manual tabulation (CLAUDE.md §1).
--
-- ⚠ AGGREGATE THROUGH `code`, NEVER THROUGH `row_id` / `col_id`. Axis ids are
-- per-VERSION; codes are not (ADR 0089 ruling 4, which is the entire reason the
-- code-immutability trigger exists). Keying on ids would silently split every
-- series at each new version — the failure would look like "the chart reset in
-- March", months after the cause.
--
-- Both RPCs are built on `app.submitted_form_responses(p_form_id)`, the canonical
-- supersession-tolerant "dashboard-countable responses" helper (Rule 9): submitted
-- AND standalone AND not superseded by a SUBMITTED successor. That is the "own
-- supersession-tolerant predicate" the ADR requires, and reusing the helper is
-- what keeps it identical to the four existing aggregations rather than a fifth
-- hand-rolled copy.
--
-- Shape mirrors `dashboard_distributions` deliberately — same gate, same date
-- window, same latest-published-version label resolution, same flat-vs-repeating
-- denominator split, same `n` unit — so a reader who knows one knows both.

-- ---------------------------------------------------------------------------
-- 1 · `matrix` — the CELL unit, `(question_key, row_code, col_code)`.
-- ---------------------------------------------------------------------------
create or replace function public.dashboard_matrix_cells(
  p_form_id uuid,
  p_from date default null,
  p_to date default null
)
returns table(
  question_key text,
  label text,
  section_title text,
  section_position integer,
  item_position integer,
  row_code text,
  row_label text,
  row_position integer,
  col_code text,
  col_label text,
  col_position integer,
  cell_count bigint,
  denominator bigint,
  n bigint
)
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
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
    select sr.id, sr.form_version_id
    from app.submitted_form_responses(p_form_id) sr
    where (p_from is null or sr.submitted_at::date >= p_from)
      and (p_to   is null or sr.submitted_at::date <= p_to)
  ),
  -- Every cell of those responses, resolved to CODES on both axes. A matrix
  -- inside a repeating group contributes one cell set PER INSTANCE, which is
  -- why group_instance_id is carried through.
  cells as (
    select a.response_id,
           a.group_instance_id,
           fi.question_key,
           fi.section_id,
           r.code as row_code,
           c.code as col_code
    from public.answer_matrix_cells amc
    join public.answers a on a.id = amc.answer_id
    join resp on resp.id = a.response_id
    join public.form_items fi on fi.id = a.item_id
    join public.form_matrix_rows r on r.id = amc.row_id
    join public.form_matrix_columns c on c.id = amc.col_id
    where fi.item_type = 'matrix'
  ),
  section_answered as (
    select distinct response_id, section_id from cells
  ),
  key_section as (
    select distinct fi.question_key, fi.section_id
    from cells cl
    join public.form_items fi on fi.question_key = cl.question_key
    where fi.form_version_id in (select distinct form_version_id from resp)
      and fi.item_type = 'matrix'
  ),
  -- FF-1 precedent: a repeating-group child's eligible base is the INSTANCES
  -- that exist, not the responses that reached the section.
  rg_key as (
    select distinct fi.question_key, fi.parent_item_id as group_item_id
    from public.form_items fi
    join public.form_items p on p.id = fi.parent_item_id
    where fi.form_version_id in (select distinct form_version_id from resp)
      and p.item_type = 'repeating_group'
      and fi.item_type = 'matrix'
      and fi.question_key is not null
  ),
  denom_rg as (
    select rk.question_key, count(*) as denominator
    from rg_key rk
    join public.response_group_instances gi on gi.group_item_id = rk.group_item_id
    join resp on resp.id = gi.response_id
    group by rk.question_key
  ),
  denom_flat as (
    select ks.question_key, count(distinct sa.response_id) as denominator
    from key_section ks
    join section_answered sa on sa.section_id = ks.section_id
    where not exists (select 1 from rg_key rk where rk.question_key = ks.question_key)
    group by ks.question_key
  ),
  denom as (
    select df.question_key, df.denominator from denom_flat df
    union all
    select dr.question_key, dr.denominator from denom_rg dr
  ),
  tally as (
    select cl.question_key, cl.row_code, cl.col_code, count(*) as cell_count
    from cells cl
    group by cl.question_key, cl.row_code, cl.col_code
  ),
  n_per_key as (
    -- The unit is the ANSWERED GRID, one per (response, instance) — row-DISTINCT
    -- treats a NULL group_instance_id as a value, so a top-level matrix still
    -- yields exactly one unit per response.
    select cl.question_key as qk,
           count(distinct (cl.response_id, cl.group_instance_id)) as cnt
    from cells cl
    group by cl.question_key
  ),
  meta as (
    select fi.question_key, fi.label,
           fs.title as section_title,
           fs.position as section_position,
           fi.position as item_position
    from public.form_items fi
    join public.form_sections fs on fs.id = fi.section_id
    where fi.form_version_id = v_latest and fi.item_type = 'matrix'
  ),
  -- Display labels come from the LATEST published version, resolved BY CODE —
  -- so relabelling an axis entry (which ruling 4 explicitly permits) never
  -- fragments the historical series.
  row_meta as (
    select fi.question_key, r.code, r.label, r.position
    from public.form_items fi
    join public.form_matrix_rows r on r.item_id = fi.id
    where fi.form_version_id = v_latest and fi.item_type = 'matrix'
  ),
  col_meta as (
    select fi.question_key, c.code, c.label, c.position
    from public.form_items fi
    join public.form_matrix_columns c on c.item_id = fi.id
    where fi.form_version_id = v_latest and fi.item_type = 'matrix'
  )
  select t.question_key,
         coalesce(m.label, t.question_key) as label,
         m.section_title,
         coalesce(m.section_position, 0) as section_position,
         coalesce(m.item_position, 0) as item_position,
         t.row_code,
         coalesce(rm.label, t.row_code) as row_label,
         coalesce(rm.position, 0) as row_position,
         t.col_code,
         coalesce(cm.label, t.col_code) as col_label,
         coalesce(cm.position, 0) as col_position,
         t.cell_count,
         coalesce(d.denominator, 0) as denominator,
         coalesce(np.cnt, 0) as n
  from tally t
  left join meta m on m.question_key = t.question_key
  left join row_meta rm on rm.question_key = t.question_key and rm.code = t.row_code
  left join col_meta cm on cm.question_key = t.question_key and cm.code = t.col_code
  left join denom d on d.question_key = t.question_key
  left join n_per_key np on np.qk = t.question_key
  order by coalesce(m.section_position, 0),
           coalesce(m.item_position, 0),
           t.question_key,
           coalesce(rm.position, 0),
           coalesce(cm.position, 0);
end;
$$;

comment on function public.dashboard_matrix_cells(uuid, date, date) is
  'FF-2 (ADR 0089): matrix cell-unit aggregation, keyed (question_key, row_code, col_code). Codes, never ids — axis ids are per-version. Supersession-tolerant via app.submitted_form_responses.';

-- ---------------------------------------------------------------------------
-- 2 · `risk_matrix` — `risk_score` AS A NUMBER.
--
-- Rows are keyed by the (severity_code, likelihood_code) PAIR and carry the
-- score, rather than being a bare score histogram. The pair is what a risk
-- matrix is rendered as (a heatmap), the score rides along as the number the ADR
-- asks for, and a caller wanting only the score distribution can group by it.
-- The per-key statistics repeat on every row of that key, exactly as
-- `denominator`/`n` already do in `dashboard_distributions`.
-- ---------------------------------------------------------------------------
create or replace function public.dashboard_risk_scores(
  p_form_id uuid,
  p_from date default null,
  p_to date default null
)
returns table(
  question_key text,
  label text,
  section_title text,
  section_position integer,
  item_position integer,
  severity_code text,
  severity_label text,
  severity_position integer,
  likelihood_code text,
  likelihood_label text,
  likelihood_position integer,
  score numeric,
  pair_count bigint,
  n bigint,
  average numeric,
  minimum numeric,
  maximum numeric
)
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
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
    select sr.id, sr.form_version_id
    from app.submitted_form_responses(p_form_id) sr
    where (p_from is null or sr.submitted_at::date >= p_from)
      and (p_to   is null or sr.submitted_at::date <= p_to)
  ),
  risks as (
    select a.response_id,
           a.group_instance_id,
           fi.question_key,
           sr.code as severity_code,
           sc.code as likelihood_code,
           arm.risk_score
    from public.answer_risk_matrix arm
    join public.answers a on a.id = arm.answer_id
    join resp on resp.id = a.response_id
    join public.form_items fi on fi.id = a.item_id
    join public.form_matrix_rows sr on sr.id = arm.severity_row_id
    join public.form_matrix_columns sc on sc.id = arm.likelihood_col_id
    where fi.item_type = 'risk_matrix'
  ),
  tally as (
    select rk.question_key, rk.severity_code, rk.likelihood_code,
           -- The score is a property of the PAIR (severity.weight *
           -- likelihood.weight), so max() is just "the value", not a reduction.
           max(rk.risk_score) as score,
           count(*) as pair_count
    from risks rk
    group by rk.question_key, rk.severity_code, rk.likelihood_code
  ),
  stats as (
    select rk.question_key as qk,
           count(distinct (rk.response_id, rk.group_instance_id)) as cnt,
           avg(rk.risk_score) as average,
           min(rk.risk_score) as minimum,
           max(rk.risk_score) as maximum
    from risks rk
    group by rk.question_key
  ),
  meta as (
    select fi.question_key, fi.label,
           fs.title as section_title,
           fs.position as section_position,
           fi.position as item_position
    from public.form_items fi
    join public.form_sections fs on fs.id = fi.section_id
    where fi.form_version_id = v_latest and fi.item_type = 'risk_matrix'
  ),
  sev_meta as (
    select fi.question_key, r.code, r.label, r.position
    from public.form_items fi
    join public.form_matrix_rows r on r.item_id = fi.id
    where fi.form_version_id = v_latest and fi.item_type = 'risk_matrix'
  ),
  lik_meta as (
    select fi.question_key, c.code, c.label, c.position
    from public.form_items fi
    join public.form_matrix_columns c on c.item_id = fi.id
    where fi.form_version_id = v_latest and fi.item_type = 'risk_matrix'
  )
  select t.question_key,
         coalesce(m.label, t.question_key) as label,
         m.section_title,
         coalesce(m.section_position, 0) as section_position,
         coalesce(m.item_position, 0) as item_position,
         t.severity_code,
         coalesce(sm.label, t.severity_code) as severity_label,
         coalesce(sm.position, 0) as severity_position,
         t.likelihood_code,
         coalesce(lm.label, t.likelihood_code) as likelihood_label,
         coalesce(lm.position, 0) as likelihood_position,
         t.score,
         t.pair_count,
         coalesce(st.cnt, 0) as n,
         st.average,
         st.minimum,
         st.maximum
  from tally t
  left join meta m on m.question_key = t.question_key
  left join sev_meta sm on sm.question_key = t.question_key and sm.code = t.severity_code
  left join lik_meta lm on lm.question_key = t.question_key and lm.code = t.likelihood_code
  left join stats st on st.qk = t.question_key
  order by coalesce(m.section_position, 0),
           coalesce(m.item_position, 0),
           t.question_key,
           coalesce(sm.position, 0),
           coalesce(lm.position, 0);
end;
$$;

comment on function public.dashboard_risk_scores(uuid, date, date) is
  'FF-2 (ADR 0089): risk_matrix aggregation — one row per (severity_code, likelihood_code) pair carrying risk_score as a NUMBER, plus per-key n/average/min/max. Supersession-tolerant via app.submitted_form_responses.';

revoke all on function public.dashboard_matrix_cells(uuid, date, date) from public;
revoke all on function public.dashboard_risk_scores(uuid, date, date) from public;
grant execute on function public.dashboard_matrix_cells(uuid, date, date) to authenticated;
grant execute on function public.dashboard_risk_scores(uuid, date, date) to authenticated;
