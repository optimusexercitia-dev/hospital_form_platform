-- AFF W1 / T1.2 — `profiles.cpf` is the person key, and it is COLUMN-LOCKED.
--
-- ADR 0097 D7 + the external audit's HIGH-1. Two independent things land here:
--
--  1. **The column + its integrity.** `cpf` is nullable in schema (the documented
--     escape for a foreign professional) and REQUIRED at the action layer; stored
--     digits-only; unique platform-wide via a partial unique index mirroring
--     `profiles_email_key`'s shape (`unique (email) where email is not null`).
--     Check digits are validated in **BOTH** SQL and TS and the two must agree — a
--     mirrored rule of the same class as the condition evaluator (Rule 3). The single
--     authority is `app.is_valid_cpf` here / `isValidCpf` in
--     `src/lib/users/cpf.ts`; the shared golden vectors are
--     `src/lib/users/__fixtures__/cpf-vectors.json`, embedded in pgTAP `301` and
--     asserted byte-equal by Vitest, so neither side can be edited alone.
--
--  2. **The read lock — the whole point of HIGH-1.** `authenticated` holds a
--     TABLE-level grant on `profiles`, and a table-level grant covers new columns
--     automatically. `profiles_select_self_or_admin` carries a **co-member leg**
--     (anyone sharing any commission with you reads your row), so a plain `cpf`
--     column would hand every colleague a national ID via PostgREST `select=cpf`.
--     This migration therefore converts `profiles` to **column-list grants** (the
--     `case_referral` precedent): revoke table-level SELECT/INSERT/UPDATE from
--     `authenticated`, re-grant explicit column lists EXCLUDING `cpf`.
--
-- ⚠⚠ STANDING CONSEQUENCE, from this migration onward: **every new `profiles` column
-- needs its own GRANT or it reads 42501.** The `case_referral` lesson now applies to
-- `profiles`. Adding a column and forgetting the grant fails at RUNTIME, not at
-- migration time. (Also recorded on the table comment below and in ADR 0097's
-- Consequences.)
--
-- NOT touched here: DELETE / TRUNCATE / TRIGGER / REFERENCES stay table-level exactly
-- as they were — a rebuild that silently drops a privilege the original carried is the
-- recorded failure mode, so the revoke names the three privileges it means and no
-- more. REFERENCES therefore still covers `cpf`; that is inert, and pgTAP `301` pins
-- the premise it is inert BY (`authenticated` holds no CREATE on schema `public`, so
-- it cannot build a referencing table to use as an existence oracle) rather than
-- leaving it as a comment that can go stale in silence.

-- ---------------------------------------------------------------------------
-- The SQL half of the mirrored CPF rule.
-- ---------------------------------------------------------------------------
create or replace function app.is_valid_cpf(p_cpf text)
returns boolean
language plpgsql
immutable
parallel safe
set search_path to 'pg_catalog'
as $$
declare
  v_d   smallint[];
  v_sum integer;
  v_dv  integer;
  i     integer;
begin
  -- NULL is not "valid"; the CHECK constraint spells the nullable case itself, so a
  -- caller can never mistake `is_valid_cpf(null) is null` for a pass.
  if p_cpf is null then
    return false;
  end if;

  -- Digits-only, exactly 11 (storage form — the action layer strips punctuation).
  if p_cpf !~ '^[0-9]{11}$' then
    return false;
  end if;

  -- The eleven repdigits (00000000000 ... 99999999999) satisfy the check-digit
  -- arithmetic and are not issuable CPFs. Rejected explicitly by every real
  -- implementation, including the TS mirror.
  if p_cpf ~ '^([0-9])\1{10}$' then
    return false;
  end if;

  v_d := array(select substr(p_cpf, g, 1)::smallint from generate_series(1, 11) as g);

  -- First check digit: weights 10..2 over digits 1..9.
  v_sum := 0;
  for i in 1..9 loop
    v_sum := v_sum + v_d[i] * (11 - i);
  end loop;
  v_dv := v_sum % 11;
  v_dv := case when v_dv < 2 then 0 else 11 - v_dv end;
  if v_dv <> v_d[10] then
    return false;
  end if;

  -- Second check digit: weights 11..2 over digits 1..10.
  v_sum := 0;
  for i in 1..10 loop
    v_sum := v_sum + v_d[i] * (12 - i);
  end loop;
  v_dv := v_sum % 11;
  v_dv := case when v_dv < 2 then 0 else 11 - v_dv end;
  if v_dv <> v_d[11] then
    return false;
  end if;

  return true;
end;
$$;

comment on function app.is_valid_cpf(text) is
  'SQL half of the mirrored CPF rule (ADR 0097 D7; Rule 3 class). TS half: isValidCpf in src/lib/users/cpf.ts. Shared vectors: src/lib/users/__fixtures__/cpf-vectors.json, embedded in pgTAP 301. Drift is phase-blocking.';

revoke all on function app.is_valid_cpf(text) from public;
-- EXECUTE is needed by every role that WRITES profiles/professional_profiles, because
-- the CHECK constraint below evaluates as the writing role.
grant execute on function app.is_valid_cpf(text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- The column.
-- ---------------------------------------------------------------------------
alter table public.profiles add column cpf text;

alter table public.profiles
  add constraint profiles_cpf_valid
  check (cpf is null or app.is_valid_cpf(cpf));

-- Unique PLATFORM-WIDE (ADR 0097 D7), mirroring profiles_email_key's partial shape.
create unique index profiles_cpf_key
  on public.profiles (cpf)
  where cpf is not null;

comment on column public.profiles.cpf is
  'Person key (ADR 0097 D7). Digits-only, check-digit validated, unique platform-wide. NULLable in schema (documented escape for a foreign professional), REQUIRED at the action layer. NOT granted to `authenticated` — all reads/writes go through the service client and the DEFINER doors.';

comment on table public.profiles is
  'One row per auth user. Never deleted; deactivate via is_active. ⚠ `authenticated` holds COLUMN-LIST grants here since 20260909000200 (ADR 0097 D7 / audit HIGH-1, so `cpf` is unreadable to colleagues): EVERY NEW COLUMN NEEDS ITS OWN GRANT or it reads 42501 at runtime.';

-- ---------------------------------------------------------------------------
-- The lock: table-level SELECT/INSERT/UPDATE -> explicit column lists without `cpf`.
-- ---------------------------------------------------------------------------
revoke select, insert, update on public.profiles from authenticated;

grant select (
  id, full_name, is_admin, is_active, created_at, email,
  home_organization_id, home_hospital_id, hospital_employee_id,
  professional_category_id, email_confirmed_at, suspended_until,
  must_change_password
) on public.profiles to authenticated;

grant insert (
  id, full_name, is_admin, is_active, created_at, email,
  home_organization_id, home_hospital_id, hospital_employee_id,
  professional_category_id, email_confirmed_at, suspended_until,
  must_change_password
) on public.profiles to authenticated;

grant update (
  id, full_name, is_admin, is_active, created_at, email,
  home_organization_id, home_hospital_id, hospital_employee_id,
  professional_category_id, email_confirmed_at, suspended_until,
  must_change_password
) on public.profiles to authenticated;
