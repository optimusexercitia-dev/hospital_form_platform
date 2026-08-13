-- =============================================================================
-- FF-5 (ADR 0091) — Entity Reference, part 6 of 7: the SIGN-OFF PROJECTION and
-- the DASHBOARD AGGREGATION.
--
-- These are the two READ ends of the lane. Without part 6 a reference is
-- WRITE-ONLY: stored, immutable, carried through clones and corrections — and
-- visible to nobody who matters.
--
-- ⚠ 1 · THE SIGN-OFF PROJECTION IS AN ATTESTATION SURFACE, NOT A NICE-TO-HAVE.
-- `get_response_for_signoff` projects every answer shape except references, so a
-- staff_admin reviewing a section holding a reference sees the rest of the
-- response, an EMPTY field where the referenced participant/commission/person
-- should be — and then signs. FF-1 shipped that defect for `instances`, FF-2
-- shipped it for the two matrix tables, and FF-2's own migration body named the
-- successor by name: "Every new answer shape owes this projection; FF-5 will owe
-- it for `answer_references`." This migration is the payment of that debt.
--
-- ⚠ 2 · AGGREGATE ON THE TARGET ID, NEVER ON THE LABEL (ADR 0091 ruling 4).
-- Labels are resolved by LIVE JOIN and kept in no snapshot: a participant is
-- renamed, a commission is retitled, a person marries — and every historical
-- series must stay whole. This is the same argument FF-2 made for axis `code`
-- over `row_id`, arrived at from the opposite direction: there the id was
-- unstable and the code stable; here the id is the stable thing and the LABEL is
-- what drifts. Grouping by `target_label` would silently FORK a series on a
-- rename, and the failure would surface months later as "the chart split in
-- March".
--
-- ⚠ 3 · SUPERSESSION. Both reads are built on `app.submitted_form_responses`,
-- the canonical "dashboard-countable responses" helper (Rule 9: submitted AND
-- standalone AND not superseded by a SUBMITTED successor). ADR 0091's gate
-- keystone `supersession_references_excluded` asserts it. Reusing the helper —
-- rather than hand-rolling a sixth latest-in-chain exclusion — is what keeps this
-- identical to the five aggregations already shipped.
--
-- The `get_response_for_signoff` body below is carried over BYTE-FOR-BYTE from
-- the LIVE pg_proc text read on 2026-07-28, not retyped from
-- 20260830001000_ff2_signoff_matrix_projection.sql. That distinction is
-- load-bearing and not pedantry: the FF-2 migration's per-instance filters read
-- `<> ''''` (a literal APOSTROPHE, which it flagged in its own header as a
-- pre-existing defect), and 20260830001100_ff1_signoff_empty_observation_filter
-- later corrected them to `<> ''`. Rebuilding from the migration file would have
-- silently REVERTED that fix. This is CLAUDE.md's graphify exception in its most
-- ordinary form — the file is not stale because anything rewrote it at runtime,
-- it is stale because a later migration moved past it.
--
-- SQLSTATE: allocates none.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1 · The scope-parameterised projection helper, mirroring
--     `app.matrix_cells_by_item` / `app.risk_matrix_by_item` exactly:
--     `p_instance_id` null = top level, else that instance, so ONE definition
--     serves both the top-level and the per-instance projections instead of two
--     inline expressions that can drift.
--
--     Shape: `{ "<item_id>": { "kind", "target_id", "label", "sublabel" } }`.
--
--     `kind` and `target_id` are the DURABLE facts (ruling 4: identity is the
--     id). `label` is presentation, resolved by live join at read time.
--
--     `sublabel` is a DELIBERATE SUPERSET of the three keys the projection was
--     specified with, and it exists for one reason: on the patient lane every
--     label is the identical surrogate string 'Paciente' (ADR 0091 §Substrate —
--     `set_participant_patient` hardcodes it and accepts no caller-supplied
--     name). A signer shown three fields all reading "Paciente" cannot tell which
--     patient they are attesting to, which is the very failure this projection
--     exists to prevent, one level down. `public.reference_candidates` already
--     solved it with the case-participant ROLE as a disambiguator; projecting the
--     same pair means the sign-off view reuses the picker's renderer unchanged,
--     which is the stated reason these helpers are scope-parameterised at all.
--
--     SECURITY DEFINER, like both matrix siblings: `get_response_for_signoff` is
--     itself DEFINER and has already applied its own three gates (commission
--     authority + a pending visible sign-off section) before it calls this, so
--     this helper carries no gate of its own.
--
--     ⚠ WHAT ACTUALLY CONTAINS IT — stated precisely, because the obvious
--     sentence ("authenticated has no EXECUTE on it") IS FALSE, and I wrote it
--     here before checking. Verified against the catalog on 2026-07-28:
--     `authenticated` HAS USAGE on schema `app`, and this function's `proacl` is
--     NULL — the Postgres default, which grants PUBLIC EXECUTE. So under a
--     DIRECT database session `set local role authenticated` this helper does
--     return another tenant's data, and so do `app.matrix_cells_by_item`,
--     `app.answer_map` and every other `app.*` helper: all carry the same
--     default ACL. That is a DEFINER gate REPLACING RLS with no gate at all,
--     which a policy-shaped audit is structurally blind to (ADR 0079).
--
--     The boundary is not an ACL, it is SCHEMA EXPOSURE: PostgREST runs with
--     `PGRST_DB_SCHEMAS=public,graphql_public` (supabase/config.toml
--     `[api].schemas`), so nothing in `app` is callable over the HTTP API at
--     all. An application user holds a JWT, not database credentials, and has no
--     path to a direct session. The exposure is therefore defence-in-depth, not
--     a live hole — which is exactly why it must be written down accurately
--     rather than either ignored or over-claimed as a P0.
--
--     This function deliberately does NOT add a lone `revoke`: diverging from
--     every sibling would buy nothing reachable while making the next reader
--     believe the ACL is the boundary. If that posture changes it must change
--     for the whole `app` schema at once, as its own decision.
--
--     No PHI (ADR 0091 ruling 1): `participants.display_name`, `commissions.name`
--     and `profiles.full_name` only. `patient_identifiers` and
--     `professional_profiles` are never touched.
-- -----------------------------------------------------------------------------
create or replace function app.references_by_item(
  p_response_id uuid,
  p_instance_id uuid default null
)
returns jsonb
language sql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  select coalesce(
    jsonb_object_agg(
      x.item_id::text,
      jsonb_build_object(
        'kind', x.reference_kind,
        'target_id', x.target_id,
        'label', x.label,
        'sublabel', x.sublabel
      )
    ),
    '{}'::jsonb
  )
  from (
    select
      a.item_id,
      ar.reference_kind,
      coalesce(ar.participant_id, ar.commission_id, ar.profile_id) as target_id,
      case ar.reference_kind
        when 'participant' then pt.display_name
        when 'commission'  then cm.name
        when 'user'        then pr.full_name
      end as label,
      case ar.reference_kind
        when 'participant' then coalesce(
          -- The patient disambiguator: this participant's role in the case that
          -- owns the response. Null for an org-scoped type, which falls back to
          -- the type itself.
          (select cpr.display_name
           from public.case_participants cp
           join public.case_participant_roles cpr on cpr.id = cp.role_id
           join public.responses r2 on r2.id = a.response_id
           join public.case_phases cph on cph.id = r2.case_phase_id
           where cp.participant_id = pt.id
             and cp.case_id = cph.case_id
             and cp.removed_at is null
           limit 1),
          pt.participant_type
        )
        when 'commission' then (select h.name from public.hospitals h where h.id = cm.hospital_id)
        when 'user'       then (pr.email)::text
      end as sublabel
    from public.answer_references ar
    join public.answers a on a.id = ar.answer_id
    left join public.participants pt on pt.id = ar.participant_id
    left join public.commissions  cm on cm.id = ar.commission_id
    left join public.profiles     pr on pr.id = ar.profile_id
    where a.response_id = p_response_id
      and a.group_instance_id is not distinct from p_instance_id
  ) x;
$$;

comment on function app.references_by_item(uuid, uuid) is
  'FF-5 (ADR 0091) — the sign-off projection of reference answers, scope-parameterised '
  'like app.matrix_cells_by_item (null = top level, else that instance). Returns '
  '{ "<item_id>": { kind, target_id, label, sublabel } }. `target_id` is the identity; '
  '`label`/`sublabel` are resolved by LIVE JOIN and never snapshotted (ruling 4). '
  '`sublabel` disambiguates the patient lane, whose labels are all the surrogate '
  '''Paciente''. Reads display_name / name / full_name only — no PHI (ruling 1).';

-- -----------------------------------------------------------------------------
-- 2 · The projection, wired into BOTH scopes.
--
--     Body verbatim from the live catalog apart from the two new keys. A
--     reference inside a repeating group goes through the per-instance call ONLY
--     — wiring just the top-level key would leave the signer blind to exactly the
--     composition the per-instance writer arm exists for (the FF-2/FF-3 "a new
--     door must inherit EVERY sibling arm" lesson, whose whole point is that the
--     enumeration's boundary is never a filename).
-- -----------------------------------------------------------------------------
create or replace function public.get_response_for_signoff(p_response_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_catalog'
as $function$
declare
  v_response public.responses;
  v_answers jsonb;
  v_has_pending boolean;
  v_result jsonb;
begin
  select * into v_response
  from public.responses
  where id = p_response_id;

  -- Gate 1: exists + in_progress. (unchanged)
  if v_response.id is null or v_response.status <> 'in_progress' then
    raise exception 'resposta % não encontrada', p_response_id
      using errcode = 'no_data_found';
  end if;

  -- Gate 2: coordinator/commission-admin of the response's commission OR a
  -- view_signoffs Administrativo (ADR 0061 — read-only parity with the queue).
  if not (app.is_staff_admin_of(v_response.commission_id)
          or app.is_commission_admin_of(v_response.commission_id)
          or app.member_can(v_response.commission_id, 'view_signoffs')) then
    raise exception 'resposta % não encontrada', p_response_id
      using errcode = 'no_data_found';
  end if;

  v_answers := app.answer_map(p_response_id);

  -- Gate 3: there is a pending (visible + unsigned) staff_admin sign-off
  -- section. The read right is scoped to the act of signing. (unchanged)
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
    'answers_by_item', app.answer_map_by_item(p_response_id),
    -- FF-2 (ADR 0089): the matrix grids. Without these the signer reviews a
    -- section whose matrix renders EMPTY, and signs it — the FF-1 `instances`
    -- lesson, one answer shape later.
    'matrix_cells_by_item', app.matrix_cells_by_item(p_response_id, null),
    'risk_matrix_by_item', app.risk_matrix_by_item(p_response_id, null),
    -- FF-5 (ADR 0091): the reference targets. Same lesson, one answer shape
    -- later again — a reference field renders EMPTY to the signer without this.
    'references_by_item', app.references_by_item(p_response_id, null),
    -- FF-1 (ADR 0087): the repeating-group instances. Without these the signer
    -- reviews a response with every instance answer missing, and signs it.
    'instances', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', gi.id,
               'group_item_id', gi.group_item_id,
               'position', gi.position,
               'answers', app.instance_answer_map(p_response_id, gi.id),
               'answers_by_item', app.answer_map_by_item_scoped(p_response_id, gi.id),
               'matrix_cells_by_item', app.matrix_cells_by_item(p_response_id, gi.id),
               'risk_matrix_by_item', app.risk_matrix_by_item(p_response_id, gi.id),
               -- FF-5: the per-instance arm. A reference inside a repeating group
               -- reaches the signer through HERE and nowhere else.
               'references_by_item', app.references_by_item(p_response_id, gi.id),
               'observations_by_item', coalesce((
                 select jsonb_object_agg(a.item_id::text, a.observation)
                 from public.answers a
                 where a.response_id = p_response_id
                   and a.group_instance_id = gi.id
                   and a.observation is not null and a.observation <> ''
               ), '{}'::jsonb),
               'other_text_by_item', coalesce((
                 select jsonb_object_agg(a.item_id::text, a.other_text)
                 from public.answers a
                 where a.response_id = p_response_id
                   and a.group_instance_id = gi.id
                   and a.other_text is not null and a.other_text <> ''
               ), '{}'::jsonb)
             ) order by gi.group_item_id, gi.position)
      from public.response_group_instances gi
      where gi.response_id = p_response_id
    ), '[]'::jsonb),
    'observations_by_item', coalesce(
      (select jsonb_object_agg(a.item_id::text, a.observation)
       from public.answers a
       where a.response_id = p_response_id
         and a.observation is not null
         and btrim(a.observation) <> ''),
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
$function$;

-- -----------------------------------------------------------------------------
-- 3 · The dashboard aggregation — `(question_key, reference_kind, target_id)`.
--
--     Shape mirrors `public.dashboard_matrix_cells` deliberately: same gate, same
--     date window, same latest-published-version label resolution, same
--     flat-vs-repeating denominator split, same `n` unit. A reader who knows one
--     knows this one.
--
--     `target_label` is resolved from the LIVE target row (ruling 4), which is
--     why it is a `left join` per lane and not a stored column: `on delete
--     restrict` on all three FKs makes a dangling reference impossible, so the
--     join cannot lose a row — that guarantee is exactly what made snapshotting
--     unnecessary.
--
--     DEFINER, `is_staff_admin_of`-or-`is_admin` gated, like every sibling
--     aggregation. Reading the three label columns without RLS is safe by ADR
--     0091 ruling 1: `participants.display_name` is a non-PHI surrogate for
--     patients by construction. Raw identity lives in `patient_identifiers`,
--     which has zero policies and is reachable only through its audited door;
--     this function never names it.
-- -----------------------------------------------------------------------------
create or replace function public.dashboard_entity_references(
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
  reference_kind text,
  target_id uuid,
  target_label text,
  ref_count bigint,
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
  -- Every reference of those responses. A reference inside a repeating group
  -- contributes one row PER INSTANCE, which is why group_instance_id is carried
  -- through — the FF-2 precedent, for the same reason.
  refs as (
    select a.response_id,
           a.group_instance_id,
           fi.question_key,
           fi.section_id,
           ar.reference_kind,
           coalesce(ar.participant_id, ar.commission_id, ar.profile_id) as target_id
    from public.answer_references ar
    join public.answers a on a.id = ar.answer_id
    join resp on resp.id = a.response_id
    join public.form_items fi on fi.id = a.item_id
    where fi.item_type = 'reference'
  ),
  section_answered as (
    select distinct response_id, section_id from refs
  ),
  key_section as (
    select distinct fi.question_key, fi.section_id
    from refs rf
    join public.form_items fi on fi.question_key = rf.question_key
    where fi.form_version_id in (select distinct form_version_id from resp)
      and fi.item_type = 'reference'
  ),
  -- FF-1 precedent: a repeating-group child's eligible base is the INSTANCES
  -- that exist, not the responses that reached the section.
  rg_key as (
    select distinct fi.question_key, fi.parent_item_id as group_item_id
    from public.form_items fi
    join public.form_items p on p.id = fi.parent_item_id
    where fi.form_version_id in (select distinct form_version_id from resp)
      and p.item_type = 'repeating_group'
      and fi.item_type = 'reference'
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
  -- ⚠ THE GROUPING KEY. `target_id`, never a label — see the header. Grouping by
  -- the resolved name would fork the series the day someone is renamed.
  tally as (
    select rf.question_key, rf.reference_kind, rf.target_id, count(*) as ref_count
    from refs rf
    group by rf.question_key, rf.reference_kind, rf.target_id
  ),
  n_per_key as (
    -- The unit is the ANSWERED REFERENCE, one per (response, instance) —
    -- row-DISTINCT treats a NULL group_instance_id as a value, so a top-level
    -- reference still yields exactly one unit per response.
    select rf.question_key as qk,
           count(distinct (rf.response_id, rf.group_instance_id)) as cnt
    from refs rf
    group by rf.question_key
  ),
  meta as (
    select fi.question_key, fi.label,
           fs.title as section_title,
           fs.position as section_position,
           fi.position as item_position
    from public.form_items fi
    join public.form_sections fs on fs.id = fi.section_id
    where fi.form_version_id = v_latest and fi.item_type = 'reference'
  )
  select t.question_key,
         coalesce(m.label, t.question_key) as label,
         m.section_title,
         coalesce(m.section_position, 0) as section_position,
         coalesce(m.item_position, 0) as item_position,
         t.reference_kind,
         t.target_id,
         -- Presentation only. Falls back to the id rather than to NULL so a
         -- chart legend can never render a blank slice.
         coalesce(pt.display_name, cm.name, pr.full_name, t.target_id::text) as target_label,
         t.ref_count,
         coalesce(d.denominator, 0) as denominator,
         coalesce(np.cnt, 0) as n
  from tally t
  left join meta m on m.question_key = t.question_key
  left join public.participants pt
    on t.reference_kind = 'participant' and pt.id = t.target_id
  left join public.commissions cm
    on t.reference_kind = 'commission' and cm.id = t.target_id
  left join public.profiles pr
    on t.reference_kind = 'user' and pr.id = t.target_id
  left join denom d on d.question_key = t.question_key
  left join n_per_key np on np.qk = t.question_key
  order by coalesce(m.section_position, 0),
           coalesce(m.item_position, 0),
           t.question_key,
           t.ref_count desc,
           coalesce(pt.display_name, cm.name, pr.full_name, t.target_id::text);
end;
$$;

comment on function public.dashboard_entity_references(uuid, date, date) is
  'FF-5 (ADR 0091 ruling 4): reference aggregation, keyed (question_key, reference_kind, '
  'target_id). The TARGET ID is the identity — never the label, which is resolved by live '
  'join for display and would fork every series on a rename. Supersession-tolerant via '
  'app.submitted_form_responses. Shape mirrors public.dashboard_matrix_cells.';

revoke all on function public.dashboard_entity_references(uuid, date, date) from public;
grant execute on function public.dashboard_entity_references(uuid, date, date) to authenticated;
