-- =============================================================================
-- ETH·E1 — QA fix loop round 2: MAJOR-3 (docs/reviews/phase-ETH-E1-review.md).
--
-- `meeting_cases` is the THIRD shape. Its policies key entirely on the MEETING
-- dimension with NO case predicate at any layer — so it matched neither QA's
-- `can_read_case` grep nor the round-1 `*_staff_admin_write` enumeration, and
-- `is_case_excluded` was never applied to it. It carries `summary` + `decision`:
-- actual deliberation content, not a mere link. It needs only PLAIN STAFF, which is
-- ADR 0072's canonical persona verbatim ("even though they are a commission member").
--
-- WHY NOT QA'S LITERAL FIX. QA recommended `and app.can_read_case_or_admin(case_id, …)`
-- on both policies. That closes both proofs but REGRESSES ordinary meetings, verified
-- empirically against the seed: `staff4.ccih` is a CCIH member (is_member_of = true)
-- holding no grant/attribution on the seeded meeting-linked commission_default case, so
-- `can_read_case_or_admin` = FALSE for them — today they read that meeting's case
-- deliberation, and the literal conjunct would silently take it away. `can_read_case`
-- has NO plain-member arm on the case_access-ON path by design (member-wide reach for
-- an ordinary case comes from the member-facing surfaces, not from can_read_case).
--
-- THE CORRECT SEMANTICS ARE ALREADY IN THE ADR. 0072 D2·8 names this exact surface —
-- "the member-facing reach surfaces … (board, Meus Casos, MEETING CASE-LABELS, timeline
-- case refs) … gate on cases.visibility_policy so an explicit_grants_only case is
-- grant/attribution-only there, while NO commission_default case loses reach". This
-- migration implements that predicate and applies it here:
--   excluded (respondent/recused)  → false                          [Proof 1]
--   explicit_grants_only           → can_read_case_or_admin only    [Proof 2]
--   commission_default             → member-wide reach (unchanged)  [the no-op]
--
-- The write policy keeps the stricter `can_read_case_or_admin` (a staff_admin surface —
-- no member-reach concern, and it subsumes the deny).
--
-- Forward-only; no schema change ⇒ `database.ts` unaffected.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1 · The member-facing reach predicate (ADR 0072 D2·8).
-- -----------------------------------------------------------------------------
create or replace function app.can_reach_case_on_member_surface(p_case_id uuid, p_uid uuid)
  returns boolean
  language plpgsql stable security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_policy text;
  v_commission uuid;
begin
  if p_uid is null then
    return false;
  end if;
  select visibility_policy, commission_id into v_policy, v_commission
  from public.cases where id = p_case_id;
  if v_commission is null then
    return false;                       -- unknown case: fail closed
  end if;

  -- ⟵ HARD DENY FIRST (ADR 0072 D2). Must precede the member arm below, which would
  -- otherwise hand an excluded member the row (MAJOR-3 Proof 1).
  if app.is_case_excluded(p_case_id, p_uid) then
    return false;
  end if;

  -- explicit_grants_only: ethics deliberation is NOT open to every member — grant /
  -- attribution / coordinator only (MAJOR-3 Proof 2; m2-flip checklist item 3).
  if v_policy = 'explicit_grants_only' then
    return app.can_read_case_or_admin(p_case_id, p_uid);
  end if;

  -- commission_default: today's member-wide reach, preserved verbatim. This is the arm
  -- a bare can_read_case_or_admin conjunct would have destroyed.
  return app.is_member_of_for(v_commission, p_uid)
      or app.can_read_case_or_admin(p_case_id, p_uid);
end;
$$;
comment on function app.can_reach_case_on_member_surface(uuid, uuid) is
  'ADR 0072 D2·8 — may p_uid see that this case is referenced (and its deliberation) on a '
  'MEMBER-FACING surface? Denies the excluded FIRST; explicit_grants_only ⇒ '
  'can_read_case_or_admin (grant/attribution/coordinator only); commission_default ⇒ '
  'today''s member-wide reach. Use this — NOT can_read_case_or_admin — on member-facing '
  'case-reach surfaces, which have no plain-member arm on the case_access-ON path and '
  'would therefore lose reach for ordinary cases.';
alter function app.can_reach_case_on_member_surface(uuid, uuid) owner to postgres;
revoke all on function app.can_reach_case_on_member_surface(uuid, uuid) from public;
grant execute on function app.can_reach_case_on_member_surface(uuid, uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 2 · meeting_cases — gate the CASE dimension on both policies. The meeting-dimension
--     arms are preserved verbatim; only the case conjunct is added.
-- -----------------------------------------------------------------------------
drop policy if exists meeting_cases_select on public.meeting_cases;
create policy meeting_cases_select on public.meeting_cases
  for select to authenticated
  using (
    (app.is_member_of(app.commission_of_meeting(meeting_id))
     or app.is_commission_admin_of(app.commission_of_meeting(meeting_id)))
    and app.can_reach_case_on_member_surface(case_id, auth.uid())
  );

drop policy if exists meeting_cases_staff_admin_write on public.meeting_cases;
create policy meeting_cases_staff_admin_write on public.meeting_cases
  for all to authenticated
  using (
    (app.is_staff_admin_of(app.commission_of_meeting(meeting_id))
     or app.is_commission_admin_of(app.commission_of_meeting(meeting_id)))
    and app.can_read_case_or_admin(case_id, auth.uid())
  )
  with check (
    (app.is_staff_admin_of(app.commission_of_meeting(meeting_id))
     or app.is_commission_admin_of(app.commission_of_meeting(meeting_id)))
    and app.can_read_case_or_admin(case_id, auth.uid())
  );
