-- ============================================================================
-- SUP · Supersession correction engine — core (S1 of the Pre-Pilot Release,
-- ADR 0071 / ADR 0074). Build plan: docs/plans/supersession-correction.md.
--
-- Gives a STANDALONE submitted response (case_phase_id IS NULL) a controlled
-- correction path so a wrong submission and its fix do not both count. A new
-- in_progress SUCCESSOR row supersedes the submitted PREDECESSOR via
-- responses.supersedes_id; every submitted-answer rollup counts only the
-- latest-in-chain. The original submitted row is NEVER mutated — the existing
-- immutability guards (guard_submitted_response / guard_submitted_children /
-- app.guard_submitted_selections) stay unchanged and unexercised by this path.
--
-- This migration:
--   1. responses.supersedes_id (nullable self-FK) + the partial-unique
--      one-successor-per-superseded index.
--   2. app.guard_supersession_coherent() — BEFORE INSERT/UPDATE trigger that
--      enforces coherent aggregation (successor shares the predecessor's
--      form_version_id + commission_id) AND the standalone-only / submitted-
--      predecessor shape (HC0H4 / HC0H1).
--   3. Flag `response_correction`, inserted OFF (flips ON in the companion
--      migration 20260720000610 at the SUP gate).
--   4. app.assert_response_correction_enabled() — the assert_*_enabled
--      pattern (mirrors app.assert_controlled_docs_enabled).
--   5. public.supersede_response(uuid, text) — the DEFINER RPC. Preconditions
--      raise the SQLSTATE block HC0H0-HC0H4 (S0 §B); the body copies the
--      predecessor's answers + selections into the new draft (O-1: pre-
--      populate) and emits response.superseded via app.audit_write.
--   6. Aggregation retrofit: app.submitted_form_responses gains the successor
--      exclusion (the single choke-point — propagates to every dashboard RPC
--      + every Phase-15 derived-indicator path); public.commission_overview
--      gains the SAME predicate in both its submitted_count and
--      submitted_last_30_days sub-selects, built on the POST-MEM
--      (memberships-scoped) body from 20260720000300_repoint_read_functions.sql.
--      Both are shipped UNCONDITIONALLY (not flag-gated — inert until a
--      successor exists; keeps the hot aggregation path free of a per-query
--      flag read).
--
-- No RLS policy change: the successor row is created by the DEFINER RPC
-- (bypasses RLS); the existing member SELECT + creator-write-while-in_progress
-- policies already cover reading/editing it, and responses_delete_own_draft
-- already covers discarding it (the abandon path — O-2, no new RPC).
-- ============================================================================

-- -----------------------------------------------------------------------------
-- 1 · Self-referential correction link + one-successor-per-superseded.
-- -----------------------------------------------------------------------------
alter table public.responses
  add column supersedes_id uuid null references public.responses(id) on delete restrict;

comment on column public.responses.supersedes_id is
  'SUP (ADR 0074): set on the SUCCESSOR row at creation (supersede_response), pointing at the submitted predecessor it corrects. NULL for every ordinary response. The predecessor is never written. on delete restrict: a superseded row cannot be deleted out from under its successor (moot for submitted rows — already immutable).';

create unique index responses_one_successor_per_superseded
  on public.responses (supersedes_id)
  where supersedes_id is not null;

comment on index public.responses_one_successor_per_superseded is
  'SUP: at most one LIVE successor per superseded row — unambiguous latest-in-chain. Partial so the overwhelming majority of rows (supersedes_id IS NULL) are unconstrained.';

-- -----------------------------------------------------------------------------
-- 2 · Coherence + shape guard — BEFORE INSERT/UPDATE trigger (a CHECK cannot
--     subquery the parent row). HC0H4 (coherence) / HC0H1 (standalone+submitted
--     shape) on violation.
-- -----------------------------------------------------------------------------
create or replace function app.guard_supersession_coherent() returns trigger
  language plpgsql security definer set search_path to 'app','public','pg_catalog' as $$
declare v_pfv uuid; v_pcomm uuid; v_pstatus text; v_pphase uuid; v_uid uuid;
begin
  if new.supersedes_id is null then return new; end if;
  select form_version_id, commission_id, status, case_phase_id
    into v_pfv, v_pcomm, v_pstatus, v_pphase
  from public.responses where id = new.supersedes_id;
  if v_pfv is null then
    raise exception 'resposta anterior não encontrada' using errcode = 'HC0H4';
  end if;
  if new.form_version_id <> v_pfv or new.commission_id <> v_pcomm then
    raise exception 'a correção deve manter versão e comissão da resposta original'
      using errcode = 'HC0H4';
  end if;
  -- Predecessor must be a standalone submitted row; successor must be standalone.
  if v_pstatus <> 'submitted' or v_pphase is not null or new.case_phase_id is not null then
    raise exception 'apenas respostas enviadas e avulsas podem ser corrigidas'
      using errcode = 'HC0H1';
  end if;

  -- Write-door enforcement (BUG-SUP-002 / defense-in-depth): supersede_response
  -- gates flag + authority, but nothing forces supersession THROUGH the RPC — an
  -- ordinary staff member could direct-INSERT (or UPDATE their own draft to set)
  -- supersedes_id and, once submitted, silently exclude a colleague's genuine
  -- response from every dashboard/derived-indicator via the aggregation retrofit.
  -- So the guard ALSO enforces the flag + the RPC's authority (O-3) for any real
  -- authenticated writer. Skipped entirely for a service-role / NULL auth.uid()
  -- session (RLS-exempt / trusted per ADR 0075: migrations, seed, admin service
  -- ops — not a PostgREST threat vector). The legitimate RPC path still passes:
  -- it runs SECURITY DEFINER but auth.uid() reads the request JWT (not
  -- current_user), so the guard sees the real caller, whom the RPC already
  -- verified is a staff_admin/commission-admin with the flag ON.
  v_uid := auth.uid();
  if v_uid is not null then
    -- Flag must be ON (closes the flag-OFF direct-write path). Raises check_violation,
    -- matching the RPC's app.assert_response_correction_enabled() flag gate.
    perform app.assert_response_correction_enabled();
    -- Same authority the RPC enforces (O-3). Direct writes by a non-admin member
    -- are rejected here even though responses_insert_own/_update_own_draft would
    -- otherwise allow the row. 42501, matching the RPC's authority precondition.
    if not (app.is_staff_admin_of(new.commission_id) or app.is_commission_admin_of(new.commission_id)) then
      raise exception 'você não pode corrigir respostas nesta comissão' using errcode = '42501';
    end if;
  end if;

  return new;
end $$;
alter function app.guard_supersession_coherent() owner to postgres;

comment on function app.guard_supersession_coherent() is
  'SUP (ADR 0074 / BUG-SUP-002): BEFORE INSERT/UPDATE OF supersedes_id on responses. Enforces coherent aggregation (successor shares the predecessor''s form_version_id + commission_id, HC0H4), the standalone-only/submitted-predecessor shape (HC0H1), AND — for any real authenticated writer (auth.uid() NOT NULL) — the response_correction flag (check_violation) plus the RPC''s O-3 authority (staff_admin/commission-admin, 42501). This closes the direct-PostgREST write-door bypass of supersede_response; a service-role/NULL session is exempt (trusted, ADR 0075). The legitimate DEFINER RPC path still passes (auth.uid() reads the request JWT, so the guard sees the real, already-authorized caller).';

create trigger guard_supersession_coherent_trg
  before insert or update of supersedes_id on public.responses
  for each row execute function app.guard_supersession_coherent();

revoke all on function app.guard_supersession_coherent() from public;
grant all on function app.guard_supersession_coherent() to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3 · Feature flag (OFF) — flips ON in the companion migration …000610.
-- -----------------------------------------------------------------------------
insert into app.feature_flags (key, enabled, description)
values ('response_correction', false, 'Correção de envios avulsos por supersessão (Pré-piloto SUP)')
on conflict (key) do update set description = excluded.description;

-- -----------------------------------------------------------------------------
-- 4 · assert_response_correction_enabled() — mirrors assert_controlled_docs_enabled.
-- -----------------------------------------------------------------------------
create or replace function app.assert_response_correction_enabled() returns void
  language plpgsql stable
  set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  if not app.feature_enabled('response_correction') then
    raise exception 'o recurso de correção de envios não está disponível'
      using errcode = 'check_violation';
  end if;
end;
$$;
alter function app.assert_response_correction_enabled() owner to postgres;

revoke all on function app.assert_response_correction_enabled() from public;
grant execute on function app.assert_response_correction_enabled() to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 5 · supersede_response(p_response_id, p_reason) — DEFINER RPC. Returns the
--     NEW in_progress successor (pre-linked), so the caller routes the wizard
--     straight into it. Authority: staff_admin OR commission-admin of the
--     predecessor's commission (the supersede_document gate — O-3).
-- -----------------------------------------------------------------------------
create or replace function public.supersede_response(p_response_id uuid, p_reason text)
  returns public.responses
  language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_commission uuid;
  v_form_version uuid;
  v_status text;
  v_case_phase uuid;
  v_reason text;
  v_new public.responses;
begin
  perform app.assert_response_correction_enabled();

  -- Predecessor visible + exists → else no_data_found (RLS-safe not-found; this
  -- DEFINER function reads without RLS, so "visible" here means "exists" — the
  -- authority check right after is what actually gates who may act on it).
  select commission_id, form_version_id, status, case_phase_id
    into v_commission, v_form_version, v_status, v_case_phase
  from public.responses where id = p_response_id;

  if v_commission is null then
    raise exception 'resposta % não encontrada', p_response_id
      using errcode = 'no_data_found';
  end if;

  -- Authority: staff_admin or commission-admin of the predecessor's commission
  -- (the supersede_document gate). Checked BEFORE further preconditions so an
  -- unauthorized caller never learns anything about the row's state.
  if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then
    raise exception 'você não pode corrigir respostas nesta comissão' using errcode = '42501';
  end if;

  -- Predecessor status = submitted (HC0H0) — an in_progress draft is edited directly.
  if v_status <> 'submitted' then
    raise exception 'apenas respostas enviadas podem ser corrigidas' using errcode = 'HC0H0';
  end if;

  -- Standalone-only (HC0H1) — case-wrapped responses are the case-phase
  -- lifecycle's to correct.
  if v_case_phase is not null then
    raise exception 'esta resposta pertence a um caso; a correção é feita pela fase do caso'
      using errcode = 'HC0H1';
  end if;

  -- No existing LIVE successor for this predecessor (HC0H2) — the clean
  -- pt-BR error; responses_one_successor_per_superseded backstops a direct
  -- double-insert race.
  if exists (select 1 from public.responses where supersedes_id = p_response_id) then
    raise exception 'já existe uma correção em andamento para esta resposta'
      using errcode = 'HC0H2';
  end if;

  -- Mandatory reason (HC0H3).
  v_reason := nullif(btrim(coalesce(p_reason, '')), '');
  if v_reason is null then
    raise exception 'informe o motivo da correção' using errcode = 'HC0H3';
  end if;

  -- No live in_progress draft of THIS form version already owned by the caller
  -- (HC0H5). The platform's responses_one_draft_per_user_idx allows only ONE
  -- in_progress standalone response per (form_version_id, created_by); a normal
  -- fill-in-progress OR another open correction on the same version would make
  -- the successor INSERT below collide (raw 23505). Pre-empt it with a clean,
  -- actionable pt-BR message. The unique index stays as the backstop.
  if exists (
    select 1 from public.responses
    where created_by = auth.uid()
      and form_version_id = v_form_version
      and status = 'in_progress'
      and case_phase_id is null
  ) then
    raise exception 'você já tem um preenchimento em andamento para esta versão do formulário; conclua ou descarte-o antes de corrigir'
      using errcode = 'HC0H5';
  end if;

  -- Insert the successor — form_version_id + commission_id copied from the
  -- predecessor (the coherence trigger re-verifies this); case_phase_id is
  -- always null (standalone); supersedes_id pre-links the chain.
  insert into public.responses (
    form_version_id, commission_id, created_by, status, case_phase_id, supersedes_id
  ) values (
    v_form_version, v_commission, auth.uid(), 'in_progress', null, p_response_id
  )
  returning * into v_new;

  -- Pre-populate (O-1): copy the predecessor's saved scalar answers into the
  -- new draft (fresh ids, response_id repointed; answered_at reset to now() —
  -- it is a contemporaneous per-answer timestamp (ALCOA+), not a value to
  -- backdate). sync_answer_typed_values (BEFORE INSERT on answers) re-derives
  -- value_number/value_date/value_time from the copied value.
  insert into public.answers (
    response_id, item_id, question_key, value, observation, other_text,
    group_instance_id, confidentiality_level
  )
  select
    v_new.id, a.item_id, a.question_key, a.value, a.observation, a.other_text,
    a.group_instance_id, a.confidentiality_level
  from public.answers a
  where a.response_id = p_response_id;

  -- Copy choice selections (answer_selected_options hangs off answer_id, not
  -- response_id — join the just-copied answers back to their predecessor
  -- counterpart via (response_id, item_id, group_instance_id), which is the
  -- one-row-per-item key while repeating groups are inert).
  insert into public.answer_selected_options (answer_id, option_id)
  select new_a.id, aso.option_id
  from public.answer_selected_options aso
  join public.answers old_a on old_a.id = aso.answer_id
  join public.answers new_a
    on new_a.response_id = v_new.id
   and new_a.item_id = old_a.item_id
   and new_a.group_instance_id is not distinct from old_a.group_instance_id
  where old_a.response_id = p_response_id;

  perform app.audit_write(
    'response.superseded', 'response', p_response_id, v_commission,
    'Resposta corrigida',
    jsonb_build_object('reason', v_reason, 'successor_id', v_new.id)
  );

  return v_new;
end;
$$;
alter function public.supersede_response(uuid, text) owner to postgres;

comment on function public.supersede_response(uuid, text) is
  'SUP (ADR 0074): create an in_progress SUCCESSOR that supersedes a submitted STANDALONE predecessor (responses.supersedes_id), pre-populated with the predecessor''s answers+selections. SECURITY DEFINER; authority = staff_admin OR commission-admin of the predecessor''s commission. Never writes the predecessor. Preconditions: no_data_found (not visible), HC0H0 (not submitted), HC0H1 (case-bound), HC0H2 (live successor exists), HC0H3 (blank reason), HC0H5 (caller already holds an in_progress draft of this version — the one-draft-per-user-per-version invariant); HC0H4 from the coherence trigger. Emits response.superseded via app.audit_write (reason + successor_id only — no answer payload, Rule 11).';

revoke all on function public.supersede_response(uuid, text) from public;
grant execute on function public.supersede_response(uuid, text) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 6 · Aggregation retrofit (LOAD-BEARING) — the single choke-point +
--     commission_overview's inline counters. Shipped UNCONDITIONALLY (inert
--     until a successor exists; flag OFF ⇒ no successors ⇒ byte-for-byte pre-SUP).
-- -----------------------------------------------------------------------------

-- 6a. app.submitted_form_responses — every dashboard RPC + every Phase-15
--     derived-indicator path fans out from this ONE function.
create or replace function app.submitted_form_responses(p_form_id uuid) returns setof public.responses
  language sql stable security definer
  set search_path to 'app', 'public', 'pg_catalog'
  as $$
  select r.*
  from public.responses r
  join public.form_versions fv on fv.id = r.form_version_id
  where fv.form_id = p_form_id
    and r.status = 'submitted'
    and r.case_phase_id is null
    -- SUP: exclude a row pointed at by a SUBMITTED successor (latest-in-chain).
    -- A merely in_progress successor does NOT exclude the predecessor — a
    -- half-finished correction never blanks the metric.
    and not exists (
      select 1 from public.responses succ
      where succ.supersedes_id = r.id and succ.status = 'submitted'
    );
$$;
alter function app.submitted_form_responses(uuid) owner to postgres;

comment on function app.submitted_form_responses(uuid) is
  'The canonical "answerable submitted responses of a form" filter (Architecture Rule 9): status=submitted AND case_phase_id IS NULL AND not superseded by a SUBMITTED successor (SUP / ADR 0074 latest-in-chain retrofit). Every dashboard RPC and every Phase-15 compute_derived_measurement path fans out from this single choke-point.';

revoke all on function app.submitted_form_responses(uuid) from public;
grant all on function app.submitted_form_responses(uuid) to authenticated, service_role;

-- 6b. public.commission_overview — the ONE inline counter (does not route
--     through the helper). Rebuilt from the POST-MEM (memberships-scoped) body
--     in 20260720000300_repoint_read_functions.sql — copied verbatim, adding
--     ONLY the two NOT EXISTS predicates. Do NOT reintroduce
--     organization_members/commission_members (dropped by MEM).
create or replace function public.commission_overview()
returns table(commission_id uuid, commission_name text, slug text, form_count bigint, submitted_count bigint, submitted_last_30_days bigint)
language plpgsql stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  return query
  select c.id, c.name, c.slug::text,
         (select count(distinct f.id)
            from public.forms f
            join public.form_versions fv on fv.form_id = f.id and fv.status = 'published'
            where f.commission_id = c.id) as form_count,
         (select count(r.id) from public.responses r
            where r.commission_id = c.id and r.status = 'submitted' and r.case_phase_id is null
              and not exists (
                select 1 from public.responses succ
                where succ.supersedes_id = r.id and succ.status = 'submitted'
              )) as submitted_count,
         (select count(r.id) from public.responses r
            where r.commission_id = c.id and r.status = 'submitted' and r.case_phase_id is null
              and r.submitted_at >= now() - interval '30 days'
              and not exists (
                select 1 from public.responses succ
                where succ.supersedes_id = r.id and succ.status = 'submitted'
              )) as submitted_last_30_days
  from public.commissions c
  where c.organization_id in (
    select m.organization_id from public.memberships m
    where m.principal_id = auth.uid() and m.role = 'org_admin'
  )
  order by c.name;
end;
$$;
alter function public.commission_overview() owner to postgres;

comment on function public.commission_overview() is
  'Admin cross-commission overview (org_admin''s commissions; memberships-scoped per MEM 20260720000300). submitted_count/submitted_last_30_days exclude a response pointed at by a SUBMITTED successor (SUP / ADR 0074 latest-in-chain retrofit) — the one inline counter that does not route through app.submitted_form_responses.';

revoke all on function public.commission_overview() from public;
grant all on function public.commission_overview() to authenticated, service_role;
