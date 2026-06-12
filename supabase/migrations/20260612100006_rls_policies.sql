-- Phase 1 / M6: RLS helper functions + the full policy set.
--
-- RLS is the security boundary (Architecture Rule 1). Every table already has
-- RLS enabled (and is therefore deny-by-default); this migration adds the
-- explicit policies. Helpers are SECURITY DEFINER with a pinned search_path so
-- they can read membership without the caller having direct SELECT on the
-- membership tables, and so they cannot be hijacked via search_path.

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------

-- Global admin. Trusts the JWT claim set by custom_access_token_hook when
-- present, and falls back to the profiles row so correctness never depends on
-- the hook being configured (e.g. service-role calls, tests).
create function app.is_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_claim text;
begin
  v_claim := nullif(current_setting('request.jwt.claims', true), '');
  if v_claim is not null and (v_claim::jsonb ->> 'is_admin') = 'true' then
    return true;
  end if;

  return exists (
    select 1 from public.profiles
    where id = auth.uid() and is_admin = true
  );
end;
$$;

create function app.is_member_of(p_commission_id uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select exists (
    select 1 from public.commission_members
    where commission_id = p_commission_id
      and user_id = auth.uid()
  );
$$;

create function app.is_staff_admin_of(p_commission_id uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select exists (
    select 1 from public.commission_members
    where commission_id = p_commission_id
      and user_id = auth.uid()
      and role = 'staff_admin'
  );
$$;

grant execute on function app.is_admin() to authenticated, service_role;
grant execute on function app.is_member_of(uuid) to authenticated, service_role;
grant execute on function app.is_staff_admin_of(uuid) to authenticated, service_role;

-- Convenience: the commission_id behind a form_version (used by structure RLS).
create function app.commission_of_version(p_form_version_id uuid)
returns uuid
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select f.commission_id
  from public.form_versions v
  join public.forms f on f.id = v.form_id
  where v.id = p_form_version_id;
$$;

grant execute on function app.commission_of_version(uuid) to authenticated, service_role;

-- ===========================================================================
-- profiles
-- ===========================================================================
-- Read: self, admins, and co-members of any shared commission (so member lists
-- and response attributions resolve names). Update: self (but NOT is_admin /
-- is_active — those are admin-only) and admins. Insert is via the signup
-- trigger only (definer); no INSERT policy. No DELETE policy (never deleted).
create policy profiles_select_self_or_admin on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or app.is_admin()
    or exists (
      select 1
      from public.commission_members me
      join public.commission_members them
        on them.commission_id = me.commission_id
      where me.user_id = auth.uid()
        and them.user_id = profiles.id
    )
  );

-- A user may update their own profile. They may NOT change the privileged
-- columns (is_admin, is_active) — that is enforced by the
-- guard_profile_privileged_columns trigger (M2), which compares OLD vs NEW.
-- (Doing it here in WITH CHECK would require subquerying profiles from within a
-- profiles policy, which causes infinite RLS recursion.)
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy profiles_admin_all on public.profiles
  for all to authenticated
  using (app.is_admin())
  with check (app.is_admin());

-- ===========================================================================
-- commissions
-- ===========================================================================
-- Read: members + admin. Write: admin only.
create policy commissions_select_member_or_admin on public.commissions
  for select to authenticated
  using (app.is_member_of(id) or app.is_admin());

create policy commissions_admin_write on public.commissions
  for all to authenticated
  using (app.is_admin())
  with check (app.is_admin());

-- ===========================================================================
-- commission_members
-- ===========================================================================
-- Read: members of the same commission + admin. Write: staff_admin of that
-- commission + admin. A staff_admin manages STAFF only — they may not create or
-- promote staff_admins (escalation guard) and may not touch admin.
create policy commission_members_select on public.commission_members
  for select to authenticated
  using (app.is_member_of(commission_id) or app.is_admin());

create policy commission_members_admin_all on public.commission_members
  for all to authenticated
  using (app.is_admin())
  with check (app.is_admin());

create policy commission_members_staff_admin_insert on public.commission_members
  for insert to authenticated
  with check (app.is_staff_admin_of(commission_id) and role = 'staff');

create policy commission_members_staff_admin_update on public.commission_members
  for update to authenticated
  using (app.is_staff_admin_of(commission_id))
  with check (app.is_staff_admin_of(commission_id) and role = 'staff');

create policy commission_members_staff_admin_delete on public.commission_members
  for delete to authenticated
  using (app.is_staff_admin_of(commission_id) and role = 'staff');

-- ===========================================================================
-- forms
-- ===========================================================================
-- Read: members + admin. Write: staff_admin of the commission + admin.
create policy forms_select on public.forms
  for select to authenticated
  using (app.is_member_of(commission_id) or app.is_admin());

create policy forms_staff_admin_write on public.forms
  for all to authenticated
  using (app.is_staff_admin_of(commission_id) or app.is_admin())
  with check (app.is_staff_admin_of(commission_id) or app.is_admin());

-- ===========================================================================
-- form_versions  (immutability of published rows is enforced by triggers)
-- ===========================================================================
-- Read: any member of the commission (the wizard reads published; staff_admins
-- read drafts too) + admin. Write: staff_admin of the commission + admin.
create policy form_versions_select on public.form_versions
  for select to authenticated
  using (
    app.is_member_of(app.commission_of_version(id))
    or app.is_admin()
  );

create policy form_versions_staff_admin_write on public.form_versions
  for all to authenticated
  using (
    app.is_staff_admin_of(app.commission_of_version(id)) or app.is_admin()
  )
  with check (
    app.is_staff_admin_of(app.commission_of_version(id)) or app.is_admin()
  );

-- ===========================================================================
-- form_sections / form_items  (immutability by trigger)
-- ===========================================================================
create policy form_sections_select on public.form_sections
  for select to authenticated
  using (
    app.is_member_of(app.commission_of_version(form_version_id))
    or app.is_admin()
  );

create policy form_sections_staff_admin_write on public.form_sections
  for all to authenticated
  using (
    app.is_staff_admin_of(app.commission_of_version(form_version_id)) or app.is_admin()
  )
  with check (
    app.is_staff_admin_of(app.commission_of_version(form_version_id)) or app.is_admin()
  );

create policy form_items_select on public.form_items
  for select to authenticated
  using (
    app.is_member_of(app.commission_of_version(form_version_id))
    or app.is_admin()
  );

create policy form_items_staff_admin_write on public.form_items
  for all to authenticated
  using (
    app.is_staff_admin_of(app.commission_of_version(form_version_id)) or app.is_admin()
  )
  with check (
    app.is_staff_admin_of(app.commission_of_version(form_version_id)) or app.is_admin()
  );

-- ===========================================================================
-- responses
-- ===========================================================================
-- Read: the creator (any status); staff_admin of the commission (SUBMITTED
-- only — in_progress drafts of other members are never readable, so their
-- answers cannot leak); admin. Insert: the creator, into a commission they
-- belong to. Update: the creator while in_progress (the submit RPC flip is
-- permitted under app.in_submit_rpc by the immutability trigger, and runs as
-- the creator). No DELETE policy for non-admins.
create policy responses_select on public.responses
  for select to authenticated
  using (
    created_by = auth.uid()
    or app.is_admin()
    or (status = 'submitted' and app.is_staff_admin_of(commission_id))
  );

create policy responses_insert_own on public.responses
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and app.is_member_of(commission_id)
  );

create policy responses_update_own_draft on public.responses
  for update to authenticated
  using (created_by = auth.uid() and status = 'in_progress')
  with check (created_by = auth.uid());

create policy responses_admin_all on public.responses
  for all to authenticated
  using (app.is_admin())
  with check (app.is_admin());

-- ===========================================================================
-- answers  (scoped through the parent response)
-- ===========================================================================
-- A staff_admin may read answers only of SUBMITTED responses in their
-- commission; in_progress answers belong solely to the creator. Writes are the
-- creator's, while the response is in_progress.
create policy answers_select on public.answers
  for select to authenticated
  using (
    exists (
      select 1 from public.responses r
      where r.id = answers.response_id
        and (
          r.created_by = auth.uid()
          or app.is_admin()
          or (r.status = 'submitted' and app.is_staff_admin_of(r.commission_id))
        )
    )
  );

create policy answers_write_own_draft on public.answers
  for all to authenticated
  using (
    exists (
      select 1 from public.responses r
      where r.id = answers.response_id
        and r.created_by = auth.uid()
        and r.status = 'in_progress'
    )
  )
  with check (
    exists (
      select 1 from public.responses r
      where r.id = answers.response_id
        and r.created_by = auth.uid()
        and r.status = 'in_progress'
    )
  );

-- ===========================================================================
-- response_section_signoffs
-- ===========================================================================
-- Read: same visibility as the parent response. Insert: only while the response
-- is in_progress, and the signer-role rule holds:
--   respondent  -> the response creator signs their own section;
--   staff_admin -> a staff_admin of the commission counter-signs.
-- The signed_by must be the acting user. No UPDATE/DELETE policy (sign-offs are
-- effectively append-only; submitted-immutability triggers freeze them after
-- submission as well).
create policy signoffs_select on public.response_section_signoffs
  for select to authenticated
  using (
    exists (
      select 1 from public.responses r
      where r.id = response_section_signoffs.response_id
        and (
          r.created_by = auth.uid()
          or app.is_admin()
          or app.is_staff_admin_of(r.commission_id)
        )
    )
  );

create policy signoffs_insert on public.response_section_signoffs
  for insert to authenticated
  with check (
    signed_by = auth.uid()
    and exists (
      select 1
      from public.responses r
      join public.form_sections s on s.id = response_section_signoffs.section_id
      where r.id = response_section_signoffs.response_id
        and r.status = 'in_progress'
        and s.form_version_id = r.form_version_id
        and s.requires_signoff = true
        and (
          (s.signoff_role = 'respondent' and r.created_by = auth.uid())
          or (s.signoff_role = 'staff_admin' and app.is_staff_admin_of(r.commission_id))
        )
    )
  );
