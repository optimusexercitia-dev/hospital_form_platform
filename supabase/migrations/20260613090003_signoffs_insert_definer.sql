-- Phase 6 / M14: fix signoffs_insert AND signoffs_select so the staff_admin
-- counter-sign path works (both had the same RLS-subquery-filtering bug).
--
-- The original signoffs_insert (migration 100006) encoded the signer-role rule
-- inline as a cross-table EXISTS over public.responses. That subquery is itself
-- evaluated under the INVOKER's RLS, and responses_select deliberately hides
-- another member's in_progress response from a staff_admin. So when the
-- legitimate staff_admin counter-signer evaluated the WITH CHECK, the EXISTS read
-- of the in_progress response returned no row and the insert was rejected (42501)
-- — the staff_admin path could never succeed. (The respondent path worked because
-- the creator can read their own response.) Phase 1's seed sidestepped this by
-- inserting sign-off rows as the superuser; Phase 6 is the first time a
-- staff_admin actually signs through RLS, which is what surfaced this.
--
-- Fix: move the response/section fact-finding into a SECURITY DEFINER predicate
-- so it is NOT re-filtered by responses_select, and rewrite signoffs_insert to
-- call it. The signer-role rule stays exactly the same and stays in the DB (RLS
-- remains the authority for WHO may sign); only the evaluation context changes.
-- is_staff_admin_of / the respondent (created_by) check are unchanged.

create function app.can_sign_section(
  p_response_id uuid,
  p_section_id uuid,
  p_signer uuid
)
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
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

revoke all on function app.can_sign_section(uuid, uuid, uuid) from public;
grant execute on function app.can_sign_section(uuid, uuid, uuid) to authenticated, service_role;

-- Rewrite the insert policy to delegate the role rule to the definer predicate.
-- signed_by must still be the acting user (a staff_admin cannot sign on behalf of
-- someone else; the predicate's staff_admin branch already requires the signer to
-- be a staff_admin of the commission, and the respondent branch requires the
-- signer to be the creator).
drop policy signoffs_insert on public.response_section_signoffs;

create policy signoffs_insert on public.response_section_signoffs
  for insert to authenticated
  with check (
    signed_by = auth.uid()
    and app.can_sign_section(response_id, section_id, auth.uid())
  );

-- ---------------------------------------------------------------------------
-- signoffs_select: same RLS-subquery-filtering problem.
-- ---------------------------------------------------------------------------
-- The original signoffs_select (migration 100006) read public.responses inline
-- to authorize. That subquery is also RLS-filtered under the invoker, so a
-- staff_admin reading a sign-off row of another member's IN_PROGRESS response
-- saw responses_select hide the parent and the row read as invisible. This broke
-- two things: (1) sign_section's `INSERT ... RETURNING *` (the read-back of the
-- just-signed row failed RLS for the staff_admin signer), and (2) any direct
-- read of sign-off rows on an in_progress response by the reviewing staff_admin.
--
-- The original intent (per the policy's own comment) was that a staff_admin may
-- read sign-off rows of responses in their commission — including in_progress
-- ones, which is correct and necessary for the review-to-sign flow. Move the
-- response fact-finding into a SECURITY DEFINER predicate so it is not
-- re-filtered. NOTE: this exposes sign-off METADATA (who/when/note) of
-- in_progress responses to the commission's staff_admins — NOT the answers. The
-- "staff_admin cannot read another member's in_progress ANSWERS" invariant
-- (responses_select / answers_select) is untouched; answers remain reachable only
-- through the narrow, pending-section-gated get_response_for_signoff definer RPC.
create function app.can_read_signoff(p_response_id uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
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

revoke all on function app.can_read_signoff(uuid) from public;
grant execute on function app.can_read_signoff(uuid) to authenticated, service_role;

drop policy signoffs_select on public.response_section_signoffs;

create policy signoffs_select on public.response_section_signoffs
  for select to authenticated
  using (app.can_read_signoff(response_id));
