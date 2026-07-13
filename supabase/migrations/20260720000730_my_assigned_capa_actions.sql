-- ============================================================================
-- S1·N · BUG-N-001 fix — a personal, PHI-free surface for CAPA-action
-- assignees (ADR 0076; PO decision Option A). A capa_action may be assigned to
-- ANY platform user, but the only CAPA view (/o/[org]/nsp/capa/[capaId]) is
-- PQS-gated — so a non-PQS assignee had no reachable surface and the
-- capa/assigned notification deep-link dead-'#'d. This adds the self-scoped
-- reader the new global page /conta/itens-de-acao consumes; the notification
-- href retargets to that static route (TS side).
--
-- list_my_assigned_capa_actions() — DEFINER, self-scoped on
-- assignee_user_id = auth.uid() (the list_my_action_items pattern). Returns
-- CONFIG-LEVEL columns ONLY (Rule 12): id, capa_id, title, owner,
-- action_strength, due_date, status, updated_at. NO rca/root-cause narrative,
-- event, or patient text — title is the same config-level snapshot the N
-- notification body already uses, owner is the governance "responsible party"
-- string. No capa_plan / rca / event / patient joins at all.
--
-- The assignee's ability to ADVANCE their own action is UNCHANGED and needs no
-- new grant: public.advance_capa_action / complete_capa_action ->
-- app.advance_capa_action_core, whose assignee branch
-- (v_assignee = auth.uid()) has NO PQS gate (HC050 only bites a
-- non-assignee/non-writer). This RPC is READ-only.
-- ============================================================================

create or replace function public.list_my_assigned_capa_actions()
  returns table(
    id uuid,
    capa_id uuid,
    title text,
    owner text,
    action_strength text,
    due_date date,
    status text,
    updated_at timestamptz
  )
  language sql stable security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
  select ca.id, ca.capa_id, ca.title, ca.owner, ca.action_strength,
         ca.due_date, ca.status, ca.updated_at
  from public.capa_action ca
  where auth.uid() is not null
    and ca.assignee_user_id = auth.uid()
  -- Soonest-due first, undated last, then most-recently-touched.
  order by (ca.due_date is null), ca.due_date asc, ca.updated_at desc;
$$;
alter function public.list_my_assigned_capa_actions() owner to postgres;

comment on function public.list_my_assigned_capa_actions() is
  'S1·N BUG-N-001 (ADR 0076): the caller''s OWN assigned CAPA actions (assignee_user_id = auth.uid()), for the global personal page /conta/itens-de-acao that a non-PQS assignee reaches from a capa/assigned notification. DEFINER + self-scoped (the list_my_action_items pattern). PHI-FREE by construction (Rule 12) — returns only config-level columns (id/capa_id/title/owner/action_strength/due_date/status/updated_at); no rca/root-cause/event/patient join. Read-only; advancing an action still routes through advance_capa_action (assignee branch, no PQS gate).';

revoke all on function public.list_my_assigned_capa_actions() from public;
grant execute on function public.list_my_assigned_capa_actions() to authenticated, service_role;
