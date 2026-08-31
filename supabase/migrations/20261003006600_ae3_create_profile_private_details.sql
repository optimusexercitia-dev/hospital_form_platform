-- =====================================================================================
-- AE3.2 step 1 -- public.profile_private_details: the restricted personal-detail table.
--
-- ADR 0155 D4, plan docs/plans/authz-evolution.md "Phase AE3".
-- Census (the reader/writer set this migration is answerable to):
--   docs/design/authz-evolution-census-ae3.md   -- instrument scripts/authz-census-ae3.sql
--
-- WHAT MOVES:  profiles.cpf, profiles.date_of_birth, profiles.phone
-- WHAT DOES NOT:  professional_profiles.cpf (Class-2 professional identity, ADR 0064/0065)
--                 and event_patient / referral_patient / patient_identifiers.date_of_birth
--                 (Class-1 patient PHI, Rule 12). Three OTHER tables carry columns of these
--                 names; after AE3 "CPF lives in one place" is still FALSE. Census section 0.
--
-- WHY A TABLE AND NOT COLUMN GRANTS:  today's confidentiality rests on a CONJUNCTION --
-- table-level SELECT/INSERT/UPDATE revoked from `authenticated`, per-column `arw` granted
-- to the ten ordinary columns, and these three withheld by having no column ACL at all.
-- An empty `attacl` means "the table grant applies"; it denies only because the table grant
-- was removed. That is a two-part invariant no single assertion states, and a future
-- `grant select on public.profiles to authenticated` silently republishes all three.
-- A separate door-only table makes the boundary a RELATION, which the arms can see.
-- =====================================================================================

create table public.profile_private_details (
  profile_id    uuid primary key references public.profiles (id) on delete cascade,
  cpf           text,
  date_of_birth date,
  phone         text,
  updated_at    timestamptz not null default now(),

  -- ⛔ MOVED, NOT RE-INVENTED. Byte-identical predicate to `profiles_cpf_valid`, and it
  -- calls the SAME `app.is_valid_cpf` -- not a copy. Re-typing a CHECK is how semantics
  -- drift silently: the constraint still exists, so nothing reds, and only the rejected
  -- values differ.
  constraint profile_private_details_cpf_valid
    check (cpf is null or app.is_valid_cpf(cpf))
);

-- ⛔ RLS ENABLED IN THE SAME STATEMENT BLOCK AS CREATION (plan AE3.2 step 2). A table that
-- exists for even one migration without RLS is a table whose grants are the only boundary.
alter table public.profile_private_details enable row level security;

-- ⛔ MOVED, NOT RE-INVENTED -- and the PARTIAL predicate is the load-bearing half.
-- A plain `cpf text unique` would coincide behaviourally (Postgres permits many NULLs in a
-- unique constraint) while changing the index shape, its name and its plan. Same statement,
-- same collation, same normalisation.
create unique index profile_private_details_cpf_key
  on public.profile_private_details using btree (cpf)
  where (cpf is not null);

-- Fast admin lookup path is the PK; no other index is added on speculation.

-- =====================================================================================
-- GRANTS -- the AE1.6 door-only class, and it is MEASURED rather than assumed.
--
-- Census section 7 asked, positively, whether the application needs any `authenticated`
-- reach: it does not. Every `authenticated` read of these three values already goes
-- through a SECURITY DEFINER door (get_own_person_record, list_org_people) and every raw
-- read is `service_role` (getPersonAdminView, the change-detection read in
-- users/actions.ts). So NO grant is issued to `authenticated` -- not even self-read.
--
-- Zero policies + RLS enabled is deliberate, and pgTAP 382 pins the MEMBERSHIP of that set,
-- so this table entering it is an asserted event rather than a silent one.
-- =====================================================================================
revoke all on public.profile_private_details from anon, authenticated;
grant select, insert, update, delete on public.profile_private_details to service_role;

comment on table public.profile_private_details is
  'AE3 (ADR 0155 D4). Restricted personal details extracted from public.profiles: cpf, '
  'date_of_birth, phone. Door-only: RLS enabled with ZERO policies and no grant to '
  'authenticated/anon -- reachable through SECURITY DEFINER doors and service_role only. '
  'This is the LGPD data-subject-request pointer table for these fields.';

comment on column public.profile_private_details.cpf is
  'Digits-only (11), normalised BY THE WRITER, not only by the comparison. Partial-unique '
  'while not null; validated by app.is_valid_cpf.';

-- =====================================================================================
-- BACKFILL + VERIFICATION
--
-- ⚠ ON A FRESH `supabase db reset` THIS MATCHES ZERO ROWS, BY DESIGN. Migrations run
-- before seed.sql, so local has no profiles at this point and the verification below
-- passes VACUOUSLY. That is not evidence the backfill works -- the remote push is where it
-- does its real work. The non-vacuous proof is pgTAP (AE3.3), which constructs rows and
-- exercises the same predicate.
--
-- Only rows carrying at least one value are materialised: absence of a row MEANS "no
-- restricted details on file", and every reader left-joins accordingly (minimum-necessary,
-- and it keeps the table's meaning crisp for a DSR).
-- =====================================================================================
insert into public.profile_private_details (profile_id, cpf, date_of_birth, phone)
select p.id, p.cpf, p.date_of_birth, p.phone
  from public.profiles p
 where p.cpf is not null
    or p.date_of_birth is not null
    or p.phone is not null;

do $$
declare
  v_bad_id   uuid;
  v_src      bigint;
  v_dst      bigint;
  v_cpf_rows bigint;
  v_cpf_uniq bigint;
begin
  -- =========================================================================
  -- PRIMARY CONTROL: KEYED PER-ROW EQUALITY (ADR 0155 G2's row-hash requirement).
  -- Counts, per-column null parity and uniqueness all pass a value SWAP, a moved
  -- phone, and any permutation among rows. Keyed equality does not.
  -- The LEFT JOIN is what makes a MISSING row a mismatch too: an absent row reads as
  -- three NULLs, which is only correct when the source is also all-NULL.
  -- ⛔ The raise names the profile_id and NOTHING ELSE. A CPF in an error message is a
  -- disclosure that outlives the migration in every log that captured it.
  -- =========================================================================
  select p.id into v_bad_id
    from public.profiles p
    left join public.profile_private_details d on d.profile_id = p.id
   where p.cpf           is distinct from d.cpf
      or p.date_of_birth is distinct from d.date_of_birth
      or p.phone         is distinct from d.phone
   limit 1;

  if found then
    raise exception
      'AE3 backfill mismatch at profile_id=%  (values deliberately omitted from this message)',
      v_bad_id
      using errcode = 'data_exception';
  end if;

  -- SECONDARY CONTROLS. Weaker individually -- kept because a backfill that silently
  -- wrote nothing would also satisfy the primary control if the source were empty, and
  -- these say out loud how many rows were actually involved.
  select count(*) into v_src
    from public.profiles p
   where p.cpf is not null or p.date_of_birth is not null or p.phone is not null;

  select count(*) into v_dst from public.profile_private_details;

  if v_src <> v_dst then
    raise exception 'AE3 backfill row-count parity failed: source=% destination=%', v_src, v_dst
      using errcode = 'data_exception';
  end if;

  select count(*), count(distinct cpf) into v_cpf_rows, v_cpf_uniq
    from public.profile_private_details where cpf is not null;

  if v_cpf_rows <> v_cpf_uniq then
    raise exception 'AE3 backfill CPF uniqueness failed: % rows, % distinct', v_cpf_rows, v_cpf_uniq
      using errcode = 'data_exception';
  end if;

  raise notice 'AE3 backfill verified: % row(s) moved, % with a CPF (0/0 is EXPECTED on a fresh local reset -- see the header)',
    v_dst, v_cpf_rows;
end;
$$;
