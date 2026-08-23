-- AFF2 B1 — `profiles.date_of_birth` + `profiles.phone`.
-- ADR 0133 D9/D10, as amended by Amendment 1 ruling 6.
--
-- Brazil's homonym rate makes date of birth the practical HUMAN differentiator between
-- same-named professionals — CPF differentiates at the system level but is deliberately
-- undisclosed (D12: presence-only on every admin surface). Phone lets an org_admin reach
-- a professional directly instead of routing through a hospital admin. Both are optional
-- at registration; neither is an identifier.
--
-- ⛔ THE ABSENCE OF A GRANT IS THE ACCESS CONTROL HERE, AND IT IS DELIBERATE.
-- `public.profiles` carries COLUMN-LIST grants for `authenticated` (since
-- 20260909000200), not table-wide ones. A new column is therefore ungranted by default,
-- which is exactly the D10 posture: excluded from every `authenticated` column-list grant
-- for SELECT and UPDATE alike. There is nothing to REVOKE — adding the column is the
-- whole of it.
--
-- ⚠ TO THE NEXT PERSON: this repo's standing rule is that every new column on a hardened
-- table needs its own GRANT or reads fail with 42501. THESE TWO ARE THE EXCEPTION, and
-- the 42501 is the intended behaviour, not a bug to fix. A co-commission member reading a
-- colleague's row must never receive their birth date or personal phone. If a future
-- change grants either column, it must cite a decision that supersedes D10 — the deferred
-- self-service view (FUP-AFF2-CONTA, LGPD titular access) is the only foreseen one, and
-- even that should go through an authorized service read, not a blanket grant.
-- Pinned by `supabase/tests/359_profiles_dob_phone.sql` §1 (catalog) and §2 (it bites).

alter table public.profiles
  add column date_of_birth date,
  add column phone         text;

comment on column public.profiles.date_of_birth is
  'ADR 0133 D9 — optional. LGPD minimum-necessary basis: Brazil''s high homonym rate makes '
  'date of birth the practical human differentiator between same-named professionals, where '
  'CPF (the system-level differentiator) is deliberately undisclosed. COLUMN-LOCKED per D10: '
  'excluded from every `authenticated` column-list grant, so it is unreadable and unwritable '
  'in-session; served only through the admin management surface (an authorized service read) '
  'and the audited `list_org_people` door (D11 / Amdt 1 ruling 4 — DOB has TWO read paths). '
  'Claims no independent retention basis: it follows the account lifecycle (Amdt 1 ruling 5).';

comment on column public.profiles.phone is
  'ADR 0133 D9 — optional. LGPD minimum-necessary basis: lets an org_admin reach a '
  'professional directly instead of routing through a hospital admin. Stored DIGITS-ONLY, '
  'with NO CHECK constraint (Amdt 1 ruling 6): this is optional contact data, not an '
  'identifier, and formatting is display-side. COLUMN-LOCKED per D10 exactly like '
  'date_of_birth, but with ONE read path, not two — phone is deliberately NOT in the '
  '`list_org_people` payload (D11: it differentiates nothing in a homonym match). Claims no '
  'independent retention basis: it follows the account lifecycle (Amdt 1 ruling 5).';

-- ---------------------------------------------------------------------------------------
-- Both columns join the privileged-column guard (Amdt 1 ruling 6 — the plan's build-time
-- hedge is struck; D10 already implied it).
--
-- ⛔ THEY JOIN `v_identity_changed`, NOT `v_privilege_changed`, AND THE CHOICE IS LOAD-
-- BEARING. The two limbs mean different things:
--   · `v_privilege_changed` (is_admin / is_active) is ADMIN-ALLOWED IN-SESSION.
--   · `v_identity_changed`  is SERVICE-ROLE-ONLY: no signed-in caller edits these at all.
-- D10 says these columns are "writable only through registerUser / updateUserProfile",
-- which are service paths — that is the identity limb, verbatim. Putting them on the
-- privilege limb would let a platform_admin write a person's birth date from a live
-- session, which D10 does not authorise and which collides with the noun rule (ADR 0078
-- A35): a platform_admin administers tenancy and identity infrastructure, not person data.
--
-- The body below is re-emitted from the LIVE `pg_get_functiondef` (migration text is stale
-- by design in this repo) with exactly two added disjuncts. The trigger itself is
-- unchanged and is NOT re-created — `guard_profile_privileged_columns_trg` (BEFORE UPDATE,
-- FOR EACH ROW) already points at this function, and plpgsql is late-bound, so replacing
-- the body is sufficient. Compare-by-name on a column that now exists is safe.
-- ---------------------------------------------------------------------------------------
create or replace function public.guard_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
declare
  v_actor_is_admin boolean;
  v_identity_changed boolean;
  v_privilege_changed boolean;
begin
  v_privilege_changed :=
       new.is_admin is distinct from old.is_admin
    or new.is_active is distinct from old.is_active;

  v_identity_changed :=
       new.suspended_until is distinct from old.suspended_until
    or new.email_confirmed_at is distinct from old.email_confirmed_at
    or new.home_organization_id is distinct from old.home_organization_id
    or new.cpf is distinct from old.cpf
    or new.professional_category_id is distinct from old.professional_category_id
    or new.must_change_password is distinct from old.must_change_password
    -- AFF2 B1 (ADR 0133 D10 / Amdt 1 ruling 6): the two new person columns are
    -- service-role-only, exactly like cpf directly above them.
    or new.date_of_birth is distinct from old.date_of_birth
    or new.phone is distinct from old.phone;

  if not v_privilege_changed and not v_identity_changed then
    return new;
  end if;

  -- service_role / postgres (no auth.uid) are trusted callers — the action path.
  if auth.uid() is null then
    return new;
  end if;

  -- Identity/lifecycle columns are service-role-only: NO signed-in caller edits them.
  if v_identity_changed then
    raise exception 'identity/lifecycle columns are service-role-only'
      using errcode = 'check_violation';
  end if;

  -- is_admin/is_active: admin-only in-session (legacy behavior preserved).
  select is_admin into v_actor_is_admin
  from public.profiles where id = auth.uid();

  if not coalesce(v_actor_is_admin, false) then
    raise exception 'only an admin may change is_admin/is_active'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$function$;
