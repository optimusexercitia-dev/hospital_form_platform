-- =============================================================================
-- ADR 0078 · Gate 2 fix wave — the 228 adjudication, Proof 1: the CODE is wrong
-- (qa review §4).
--
-- `meeting_cases_select` was `app.can_reach_meeting(meeting_id, auth.uid())`
-- alone, so a RESPONDENT read the meeting_cases row for HIS OWN case. summary /
-- decision are correctly masked by `app._project_meeting_case`, so the payload
-- is safe — but the LINKAGE is not: meeting_cases has no stub role, and its
-- unmasked columns ARE the linkage (case_id / meeting_id / agenda_item_id), the
-- process number's UUID equivalent. A7/O6: the respondent gets the bare stub —
-- "no number, no withdrawal list, no times".
--
-- A6 does not license it: A6 licenses MEMBERS seeing that a case exists and
-- explicitly reserves the respondent question to A7/O6, which answers it NO.
-- Denying the row creates no gap — A7's stub-never-a-gap is satisfied by the
-- `meeting_agenda_items` row, which persists with `title` masked and renders as
-- "3. Sessão reservada".
--
-- ⛔ THE TRAP — the cut is `is_case_respondent`, NOT `is_case_excluded`.
-- Catalog-verified: app.is_case_excluded = is_case_respondent OR
-- is_recused_from_case. Using it at the ROW layer would silently blind every
-- RECUSED member to the record of her own recusal, breaking keystone 10 (the
-- recused Ana must see item 4's shell including her own recorded withdrawal).
-- The `is_case_excluded` term belongs on the `decision` COLUMN only, where
-- `app._project_meeting_case` already has it correctly. Nothing changes there.
--
-- The four properties this cut must satisfy (all verified by execution):
--   NO-OP     (228:834, plain member × ordinary case) → row visible, count 1
--   Proof 1   (115/116, respondent × own case)        → 0 rows
--   Proof 2   (117/118, non-granted member × ethics)  → row visible, masked
--   Keystone 10 (recused sees her own withdrawal)     → row visible, masked
-- =============================================================================

drop policy if exists meeting_cases_select on public.meeting_cases;
create policy meeting_cases_select on public.meeting_cases
  for select to authenticated
  using (
    app.can_reach_meeting(meeting_id, (select auth.uid()))
    -- A7/O6: the respondent reads no linkage for his own case. NOT
    -- is_case_excluded — see the header; that would break keystone 10.
    and not app.is_case_respondent(case_id, (select auth.uid()))
  );

-- GUARD -----------------------------------------------------------------------
do $$
declare
  v_qual text;
begin
  select qual into v_qual from pg_policies
   where schemaname = 'public' and tablename = 'meeting_cases' and policyname = 'meeting_cases_select';
  if v_qual !~ 'is_case_respondent' then
    raise exception 'Gate-2 228: meeting_cases_select lost the respondent deny';
  end if;
  -- The trap, asserted: is_case_excluded must NOT appear at the row layer.
  if v_qual ~ 'is_case_excluded' then
    raise exception 'Gate-2 228: meeting_cases_select uses is_case_excluded at the ROW layer — '
                    'this blinds every RECUSED member to her own recusal (keystone 10)';
  end if;
end $$;
