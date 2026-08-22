-- ADR 0134 D6 (as amended) — M1: the `administrativo` capability vocabulary gains a
-- FIFTH entry, `read_cases`, and appointing an administrativo now grants it.
--
-- ⚠ NAMING HAZARD, stated once here because two vocabularies in this codebase are both
-- called "capability" and sit one word apart:
--   * THIS one — `commission_administrativo_capabilities.capability`, a `text` column
--     with a CHECK, consumed by `app.member_can(commission, capability)`. Five values
--     after this migration.
--   * The ADR-0078 CASE bitmask — `app._cap_bit(text)`: `view_case_overview`,
--     `read_case_deliberation`, `read_case_content`, `read_standard_phi`,
--     `read_restricted_phi`, `write_case_content`, `manage_case_access`. Unrelated
--     table, unrelated function, and `app.has_case_capability` RAISES `HC0A2` on an
--     unknown label there.
-- `read_cases` belongs to the FIRST vocabulary. It is NOT `read_case_content`, and this
-- migration does not touch `app._cap_bit` or `app._case_caps` (the S8 arm that consumes
-- `read_cases` is M2, a separate migration).
--
-- ── WHAT THE ALLOWED SET IS ENFORCED BY ─────────────────────────────────────────────
-- Measured 2026-08-22 against the LIVE catalog by property, never by recalling a
-- migration file (bodies in this repo are rewritten at runtime; file text is stale by
-- design). The set is asserted in exactly THREE places, only TWO of which enforce:
--   1. CHECK `commission_administrativo_capabilities_capability_check`   [enforces]
--   2. `public.grant_member_capability`'s `not in (...)` whitelist        [enforces]
--   3. `app.feature_flags` row `key='administrativo'`, column `description` [prose]
-- All three are extended below. A validator left behind means the table and the door
-- silently disagree — and until this change NOTHING anywhere asserted that an invalid
-- capability is refused (measured over `supabase/tests/`, `src/`, `e2e/`: zero
-- assertions; the only hits were the pt-BR message string). `supabase/tests/205`
-- now pins both validators in both directions.
--   Deliberately NOT extended: `public.revoke_member_capability`, which has NO
--   whitelist at all (confirmed from `pg_get_functiondef`) — it deletes by equality, so
--   an unknown literal is a silent no-op. Adding one is out of scope for this change.
--
-- ⛔ READ THIS BEFORE ADDING A SIXTH CAPABILITY — the two validators share an errcode,
-- so the obvious test for one of them silently tests the other. `grant_member_capability`
-- raises `check_violation` (= 23514) from its whitelist; the INSERT it guards raises
-- 23514 from the CHECK constraint underneath. Delete the whitelist and the call STILL
-- raises 23514 — measured, not reasoned:
--     caught: 23514: new row for relation "commission_administrativo_capabilities"
--             violates check constraint "…_capability_check"
--     wanted: 23514: capacidade inválida
-- So a `throws_ok(…, '23514', null, …)` on the RPC is GREEN with the validator gone: it
-- proves the table refuses the literal, never that the door does. The pin in
-- `supabase/tests/205_administrativo.sql` § (VOC) asserts the pt-BR MESSAGE for exactly
-- this reason. Same shape as `FUP-42501-CONFLATES-GRANT-WITH-RLS`, one errcode over —
-- a door can have two locks, and the second one answers in the same voice.
-- Sweeps that returned ZERO, so nothing else needs extending (each by its own property
-- over the catalog, with a positive control): column DEFAULTs, views/matviews,
-- triggers, index expressions. The 3 RLS policies matching a literal are the
-- `meetings_staff_admin_*` policies, which CONSUME `'schedule_meetings'` — they are not
-- vocabulary validators and are untouched.
--
-- ── ADR 0134 AMENDMENT 5 — appointing GRANTS `read_cases` ────────────────────────────
-- D6's parenthetical "(default-checked in the appoint dialog)" was ruled by the PO on
-- 2026-08-22 to mean a GRANT, not a pre-ticked box: the dialog has no client-side
-- defaults (`checked = caps.has(key)` off server state), so the only way to make the box
-- checked is for the row to exist. A ticked box with no grant behind it — a mirror wider
-- than its door — was rejected outright.
--
-- ⛔ NO BACKFILL. ADR 0134 Amendment 1 §A1.1 still governs EXISTING appointees: this
-- migration writes NO rows into `commission_administrativo_capabilities`, and the
-- auto-grant fires only when an appointment row is actually INSERTED (`GET DIAGNOSTICS`
-- on the `on conflict do nothing`). Re-appointing someone who is already an
-- administrativo is therefore still a no-op and grants nothing — per §A5.3, "A1.1's
-- no-backfill ruling governs existing appointees, who stay as they are; A5.2 governs new
-- appointments only." Pinned in `supabase/tests/205_administrativo.sql` § (A5).
--
-- ⚠ The seed appoints `staff2.ccih` by DIRECT INSERT, bypassing the DEFINER doors, so it
-- gains nothing from this auto-grant and must grant `read_cases` explicitly. The two
-- paths are asserted separately in 205 — otherwise the seed's row would be read as
-- evidence about the door.
--
-- ⚠ `npm run gen:types` is BLIND to this change: `capability` is `text` with a CHECK, so
-- `database.ts` types it `string` and regenerating produces no diff for this table. A
-- clean `gen:types` is NOT confirmation. The TypeScript vocabulary lives in four
-- hand-lists (`MemberCapability`, `CAPABILITIES` in `src/lib/members/actions.ts`, the
-- appoint dialog's menu, and the mirror test's `ALL`), each updated in this delivery.

-- ── 1. The CHECK constraint ─────────────────────────────────────────────────────────
alter table public.commission_administrativo_capabilities
  drop constraint if exists commission_administrativo_capabilities_capability_check;

alter table public.commission_administrativo_capabilities
  add constraint commission_administrativo_capabilities_capability_check
  check (capability = any (array[
    'schedule_meetings'::text,
    'create_cases'::text,
    'assign_case_phases'::text,
    'view_signoffs'::text,
    'read_cases'::text
  ]));

-- ── 2. The grant door's whitelist ───────────────────────────────────────────────────
-- Body taken from `pg_get_functiondef('public.grant_member_capability'::regproc)` on
-- 2026-08-22; the ONLY edit is the added literal in the `not in (...)` list.
create or replace function public.grant_member_capability(
  p_commission_id uuid, p_user_id uuid, p_capability text
) returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
begin
  perform app.assert_administrativo_enabled();
  if not (app.is_staff_admin_of(p_commission_id) or app.is_tenancy_admin_of(p_commission_id)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if p_capability not in ('schedule_meetings', 'create_cases', 'assign_case_phases',
                          'view_signoffs', 'read_cases') then
    raise exception 'capacidade inválida' using errcode = 'check_violation';
  end if;
  -- The appointment-first FK guarantees the member is an Administrativo; a missing
  -- appointment surfaces as a foreign_key_violation (mapped to a pt-BR error by the
  -- action layer). Idempotent.
  insert into public.commission_administrativo_capabilities (commission_id, user_id, capability, granted_by)
  values (p_commission_id, p_user_id, p_capability, auth.uid())
  on conflict (commission_id, user_id, capability) do nothing;
end;
$function$;

-- ── 3. The appointment door — ADR 0134 Amendment 5's auto-grant ─────────────────────
-- Body taken from `pg_get_functiondef('public.appoint_administrativo'::regproc)` on
-- 2026-08-22; the ONLY edits are the `v_appointed` local, the `GET DIAGNOSTICS`, and the
-- guarded capability insert. Every authority check above it is unchanged and still
-- precedes any write.
create or replace function public.appoint_administrativo(
  p_commission_id uuid, p_user_id uuid
) returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_appointed int;
begin
  perform app.assert_administrativo_enabled();
  if not (app.is_staff_admin_of(p_commission_id) or app.is_tenancy_admin_of(p_commission_id)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  perform app._deny_self_grant(p_user_id);
  if not app.is_member_of_for(p_commission_id, p_user_id) then
    raise exception 'o membro deve pertencer à comissão' using errcode = 'HC021';
  end if;
  if not exists (
    select 1 from public.memberships
    where commission_id = p_commission_id and principal_id = p_user_id and role = 'staff'
  ) then
    raise exception 'apenas um membro comum (staff) pode ser designado Administrativo'
      using errcode = '42501';
  end if;
  insert into public.commission_administrativos (commission_id, user_id, appointed_by)
  values (p_commission_id, p_user_id, auth.uid())
  on conflict (commission_id, user_id) do nothing;

  -- ADR 0134 Amendment 5 (PO-ruled 2026-08-22): a NEW appointment confers `read_cases`,
  -- attributed to the appointing coordinator, so D6's "default-checked" is a grant
  -- rather than a cosmetic tick. `read_cases` and NOTHING else — the other four stay
  -- opt-in per ADR 0061's curated-menu contract.
  -- ⛔ Guarded on an appointment actually having been INSERTED. Without this guard,
  -- re-appointing an existing administrativo would backfill `read_cases` onto them, and
  -- Amendment 1 §A1.1's no-backfill ruling still governs everyone appointed before this
  -- migration. (Pinned: 205 § (A5) "an appointee who already existed keeps exactly their
  -- original capabilities".)
  get diagnostics v_appointed = row_count;
  if v_appointed > 0 then
    insert into public.commission_administrativo_capabilities
      (commission_id, user_id, capability, granted_by)
    values (p_commission_id, p_user_id, 'read_cases', auth.uid())
    on conflict (commission_id, user_id, capability) do nothing;
  end if;
end;
$function$;

-- ── 4. The flag row's prose (non-enforcing, and a "text is not truth" trap if left) ──
-- Only `description` moves. `enabled` is NOT touched here — the flag was flipped ON by
-- 20260715000300_enable_administrativo.sql and stays as it is.
update app.feature_flags
   set description = 'When true, the Administrativo delegated-capability role is live: '
                  || 'a coordinator may appoint a non-coordinator staff member and grant '
                  || 'a curated capability subset (schedule_meetings/create_cases/'
                  || 'assign_case_phases/view_signoffs/read_cases) admitted through '
                  || 'guarded DEFINER doors. Appointing grants read_cases automatically '
                  || '(ADR 0134 Amendment 5); the other four stay opt-in. ADR 0061.'
 where key = 'administrativo';
