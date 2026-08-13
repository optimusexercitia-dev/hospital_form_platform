-- FF-2 — QA r1 B-1 + B-2: the matrix doors and policies match the authorization
-- surface beside them.
--
-- ⚠ THIS IS THE THIRD TIME IN ONE PHASE that an FF-2 gate failed to match its
-- neighbouring surface, each in a different direction:
--   1. Wave 2 — `app.copy_version_children` was STRICTER than the RLS it
--      displaced (no-JWT owner callers refused; broke 61/203/209).
--   2. B-1 — `app.assert_matrix_answer_writable` is NARROWER than the `answers`
--      write policies (a targeted respondent cannot save a cell).
--   3. B-2 — the two matrix SELECT policies are NARROWER than
--      `answer_selected_options_select` (a designated corrector reads 0 cells).
-- The rule was named in PROGRESS.md after (1) — "a DEFINER gate must be neither
-- weaker nor stronger than the RLS it replaces" — and then never swept for. The
-- systematic arm-by-arm sweep is recorded in PROGRESS.md alongside this change.

-- ---------------------------------------------------------------------------
-- B-1 · the write door takes the UNION of the `answers` write arms.
--
-- Live `answers` policies (read from pg_policies, not from the review):
--   answers_write_own_draft (ALL)    : created_by = auth.uid() AND status = 'in_progress'
--   answers_insert_targeted (INSERT) : app.can_write_targeted_response(response_id, auth.uid())
--   answers_update_targeted (UPDATE) : app.can_write_targeted_response(response_id, auth.uid())
--
-- `app.save_instance_answers` is INVOKER, so it runs under RLS and inherited the
-- targeted arm for free — which is exactly why a targeted respondent could save a
-- SCALAR answer and was refused a MATRIX cell in the same transaction, same RPC.
-- The DEFINER writers reconstructed the rule and dropped an arm.
--
-- `app.can_write_targeted_response` already contains the `in_progress` test, so
-- the union below is arm-for-arm identical to the policies above — not merely
-- similar. Ordering matters for the ERROR the caller sees: the ownership/target
-- test comes first (42501, an authority denial), then the lifecycle test
-- (check_violation, "already submitted"), preserving the discrimination the
-- existing callers map.
-- ---------------------------------------------------------------------------
create or replace function app.assert_matrix_answer_writable(p_response_id uuid)
returns void
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_owner uuid;
  v_status text;
  v_uid uuid := (select auth.uid());
begin
  if not app.feature_enabled('matrix_fields') then
    raise exception 'o recurso de matrizes não está disponível'
      using errcode = 'HC0P2';
  end if;

  select created_by, status into v_owner, v_status
  from public.responses where id = p_response_id;

  if v_owner is null then
    raise exception 'você não pode editar esta resposta'
      using errcode = '42501';
  end if;

  -- ARM 2 first, because it is self-contained (it re-checks in_progress itself)
  -- and a targeted respondent is NOT the creator — testing ownership first would
  -- reject them before this arm is ever reached.
  if app.can_write_targeted_response(p_response_id, v_uid) then
    return;
  end if;

  -- ARM 1 — the creator's own draft.
  if v_owner is distinct from v_uid then
    raise exception 'você não pode editar esta resposta'
      using errcode = '42501';
  end if;

  if v_status <> 'in_progress' then
    raise exception 'esta resposta já foi enviada e não pode mais ser editada'
      using errcode = 'check_violation';
  end if;
end;
$$;

comment on function app.assert_matrix_answer_writable(uuid) is
  'FF-2 (QA r1 B-1): the matrix answer writers'' gate. The UNION of the answers write policies — (creator AND in_progress) OR app.can_write_targeted_response — because these writers are DEFINER (K9 denies direct DML) and therefore replace RLS rather than run under it. A DEFINER gate must be neither weaker nor stronger than the policy it displaces.';

-- ---------------------------------------------------------------------------
-- B-2 · the matrix SELECT policies take the arms their sibling carries.
--
-- `answer_selected_options_select` — the direct sibling, same `answer_id` shape,
-- and the table ADR 0089 §B says to model the copy blocks on — carries a second
-- OR-arm the two matrix tables lacked, so a designated corrector opened the
-- response they were asked to correct and saw every text answer and every choice
-- selection, with every grid empty. That is FUP-FF2-1's blank grid reappearing on
-- the one surface the correction is compared against.
--
-- ⚠ A THIRD ARM, NOT IN THE REVIEW, found by sweeping `answers` rather than the
-- report: `answers_select_targeted` grants `app.can_access_targeted_response`.
-- Without it B-1's fix would be half a feature — a targeted respondent could
-- WRITE a cell and then not read it back, so the wizard would redraw an empty
-- grid on the next navigation. It is included here for that reason, and §O
-- asserts the round trip rather than just the write.
-- ---------------------------------------------------------------------------
drop policy if exists answer_matrix_cells_select on public.answer_matrix_cells;
create policy answer_matrix_cells_select on public.answer_matrix_cells
  for select to authenticated
  using (
    exists (
      select 1
      from public.answers a
      join public.responses r on r.id = a.response_id
      where a.id = answer_matrix_cells.answer_id
        and (
          r.created_by = (select auth.uid())
          or app.is_commission_admin_of(r.commission_id)
          or (r.status = 'submitted' and app.is_staff_admin_of(r.commission_id))
        )
    )
    or exists (
      select 1 from public.answers a2
      where a2.id = answer_matrix_cells.answer_id
        and app.can_read_correction_response(a2.response_id, (select auth.uid()))
    )
    or exists (
      select 1 from public.answers a3
      where a3.id = answer_matrix_cells.answer_id
        and app.can_access_targeted_response(a3.response_id, (select auth.uid()))
    )
  );

drop policy if exists answer_risk_matrix_select on public.answer_risk_matrix;
create policy answer_risk_matrix_select on public.answer_risk_matrix
  for select to authenticated
  using (
    exists (
      select 1
      from public.answers a
      join public.responses r on r.id = a.response_id
      where a.id = answer_risk_matrix.answer_id
        and (
          r.created_by = (select auth.uid())
          or app.is_commission_admin_of(r.commission_id)
          or (r.status = 'submitted' and app.is_staff_admin_of(r.commission_id))
        )
    )
    or exists (
      select 1 from public.answers a2
      where a2.id = answer_risk_matrix.answer_id
        and app.can_read_correction_response(a2.response_id, (select auth.uid()))
    )
    or exists (
      select 1 from public.answers a3
      where a3.id = answer_risk_matrix.answer_id
        and app.can_access_targeted_response(a3.response_id, (select auth.uid()))
    )
  );

-- K9 is UNCHANGED by this migration: both tables keep SELECT-only grants for
-- `authenticated` (no INSERT/UPDATE/DELETE grant is added), so every write still
-- goes through a DEFINER RPC. Widening a SELECT policy cannot create a write
-- path; §A re-proves the denial half after this change.
