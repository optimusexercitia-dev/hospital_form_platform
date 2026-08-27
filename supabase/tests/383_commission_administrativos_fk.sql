-- AE1.1 (audit finding F7; ADR 0155 D9) — `commission_administrativos` FKs.
-- Migration: 20261003004400_commission_administrativos_fk.sql.
-- Contract: docs/design/authz-ae1-fk-preflight.md.
--
-- The lock: this suite fails if either FK is removed, or if either FK's
-- ON DELETE is changed away from CASCADE (the derived, non-default behaviour —
-- see the design doc §3), or if an orphan insert on either identifying column
-- stops being rejected.
--
-- ⚠ VACUITY GUARD, stated because the design doc calls it out explicitly: an FK
-- existence check alone passes for an FK with the WRONG `ON DELETE` — so §1 below
-- asserts `confdeltype` (the actual catalog fact), not just that a constraint by
-- that name exists. And an orphan INSERT that merely "throws" proves nothing if
-- it throws for an unrelated reason (a different FK, a NOT NULL, an RLS denial) —
-- so §2 pins BOTH the SQLSTATE (23503 = foreign_key_violation) AND the exact
-- constraint name Postgres names in its own error message (not a substring: pgTAP
-- throws_ok's message arg is an EXACT match against SQLERRM).
--
-- Covers:
--   §1 both FKs exist by name AND carry confdeltype = 'c' (CASCADE).
--   §2 a rejected-orphan insert for each identifying column (23503 + constraint
--      name), plus a positive control proving the FK shape does not block a
--      correctly-formed appointment.

begin;
select plan(10);

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;
create temp table k on commit drop as
  select (v->>'sa_x')::uuid   as sa_x,
         (v->>'st_x')::uuid   as st_x,
         (v->>'comm_x')::uuid as comm_x
  from ctx;
grant select on k to authenticated;

-- Fresh, guaranteed-absent ids for the orphan probes — never a hardcoded literal,
-- so absence does not depend on what else happens to be seeded on this stack.
create temp table absent on commit drop as
  select gen_random_uuid() as no_commission, gen_random_uuid() as no_user;
grant select on absent to authenticated;

-- ============================================================================
-- §1: both FKs exist by name, and each is ON DELETE CASCADE (not merely present).
-- ============================================================================
select ok(
  exists (select 1 from pg_constraint
          where conname = 'commission_administrativos_commission_id_fkey'
            and conrelid = 'public.commission_administrativos'::regclass
            and contype = 'f'),
  '1.1: commission_administrativos_commission_id_fkey exists');
select is(
  (select confdeltype from pg_constraint
    where conname = 'commission_administrativos_commission_id_fkey'
      and conrelid = 'public.commission_administrativos'::regclass and contype = 'f'),
  'c'::"char",
  '1.2: …and is ON DELETE CASCADE (confdeltype = c, not merely existence)');

select ok(
  exists (select 1 from pg_constraint
          where conname = 'commission_administrativos_user_id_fkey'
            and conrelid = 'public.commission_administrativos'::regclass
            and contype = 'f'),
  '1.3: commission_administrativos_user_id_fkey exists');
select is(
  (select confdeltype from pg_constraint
    where conname = 'commission_administrativos_user_id_fkey'
      and conrelid = 'public.commission_administrativos'::regclass and contype = 'f'),
  'c'::"char",
  '1.4: …and is ON DELETE CASCADE (confdeltype = c, not merely existence)');

-- ============================================================================
-- §2: orphan rejection (per column) + a positive control.
-- Table owner (postgres), bypassing RLS entirely, so the ONLY thing that can
-- raise here is the FK itself — never an RLS denial.
-- ============================================================================

-- Positive control: a correctly-formed appointment (comm_x / st_x, both real,
-- appointed_by = sa_x, also real) inserts cleanly. Proves the two new FKs do not
-- block a legitimate row — the orphan throws below are the FK doing its job, not
-- the FK being overly strict.
select lives_ok(
  format($$ insert into public.commission_administrativos (commission_id, user_id, appointed_by)
            values (%L, %L, %L) $$,
         (select comm_x from k), (select st_x from k), (select sa_x from k)),
  '2.1: CONTROL — a real (commission_id, user_id, appointed_by) inserts cleanly');

-- Clean up the control row by IDENTITY (never positionally, never TRUNCATE) so
-- it cannot shadow or interact with the orphan probes below.
delete from public.commission_administrativos
  where commission_id = (select comm_x from k) and user_id = (select st_x from k);

-- Orphan #1: commission_id points at nothing. user_id/appointed_by are real, so
-- the ONLY FK that can fire is commission_administrativos_commission_id_fkey.
select throws_ok(
  format($$ insert into public.commission_administrativos (commission_id, user_id, appointed_by)
            values (%L, %L, %L) $$,
         (select no_commission from absent), (select st_x from k), (select sa_x from k)),
  '23503',
  'insert or update on table "commission_administrativos" violates foreign key constraint "commission_administrativos_commission_id_fkey"',
  '2.2: an orphaned commission_id is rejected — 23503 AND the commission_id FK by name');

-- Orphan #2: user_id points at nothing. commission_id/appointed_by are real, so
-- the ONLY FK that can fire is commission_administrativos_user_id_fkey.
select throws_ok(
  format($$ insert into public.commission_administrativos (commission_id, user_id, appointed_by)
            values (%L, %L, %L) $$,
         (select comm_x from k), (select no_user from absent), (select sa_x from k)),
  '23503',
  'insert or update on table "commission_administrativos" violates foreign key constraint "commission_administrativos_user_id_fkey"',
  '2.3: an orphaned user_id is rejected — 23503 AND the user_id FK by name');


-- ── §3 SUPPORTING INDEX (plan close condition #4 / PA-F15) ────────────────────
-- ⚠ §3.3 is not decoration. The index below is justified by the RLS self-read leg,
-- NOT by cascade support, and the reason cascade support is moot is that a `profiles`
-- row can never be deleted. If that guard is ever dropped, the cascade premise becomes
-- live again and this table's index story must be re-derived — so the guard is pinned
-- HERE, next to the conclusion that depends on it, rather than left implicit.

select ok(
  exists (select 1 from pg_index x
            join pg_class i on i.oid = x.indexrelid
           where i.relname = 'commission_administrativos_user_idx'),
  '3.1: commission_administrativos_user_idx exists');

select is(
  (select a.attname
     from pg_index x
     join pg_class i on i.oid = x.indexrelid
     join pg_attribute a on a.attrelid = x.indrelid and a.attnum = x.indkey[0]
    where i.relname = 'commission_administrativos_user_idx'),
  'user_id',
  '3.2: its LEADING column is user_id — a composite starting elsewhere would not serve '
  'the policy''s user_id-only self-read, so presence alone is not the property');

select ok(
  exists (select 1 from pg_trigger t
           where t.tgrelid = 'public.profiles'::regclass
             and t.tgname = 'guard_profile_no_delete_trg'
             and not t.tgisinternal
             and (t.tgtype::int & 8) > 0),
  '3.3: profiles still carries its BEFORE DELETE guard — the fact that makes the '
  'user_id CASCADE unreachable and the cascade-support argument moot');

select * from finish();
rollback;
