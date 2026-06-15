-- Case data-model adjustments (1 of 4): DROP the configurable per-commission
-- case-status system (decision D12).
--
-- The R2 "configurable case status" feature (migrations 092000/092001:
-- case_status_defs vocabulary + status CRUD RPCs + app.case_status_is_terminal +
-- the seed-on-commission trigger + apply_case_status/case_terminal_key +
-- slugify/unaccent helpers) is replaced by a FIXED, five-value, auto-computed
-- macro status. This migration tears the R2 system DOWN; 093001 lands the fixed
-- model (column CHECK + recompute trigger + guard rewrite + the re-replacement of
-- every function the R2 "liveness sweep" had pointed at the now-dropped helper).
--
-- ADDITIVE / forward-only (CLAUDE.md): we never edit the pushed 092000/092001
-- files — we drop their objects here in a NEW migration. No data remap (the
-- project is pre-launch; 093001 additionally normalizes any stray status on the
-- remote dev DB before re-adding the CHECK).
--
-- DROP ORDER: dependents (public RPCs) -> app helpers -> the commission seed
-- trigger + its function -> RLS policies -> the table. NO `cascade` anywhere
-- (surgical: if an unforeseen dependent exists, the migration fails loudly rather
-- than silently dropping it). guard_case_status is NOT dropped here — its trigger
-- on public.cases must keep firing; 093001 re-CREATE-OR-REPLACEs the function to
-- the fixed-enum form.

-- ---------------------------------------------------------------------------
-- Public status RPCs (the write surface + the definer board read)
-- ---------------------------------------------------------------------------
drop function if exists public.set_case_status(uuid, text);
drop function if exists public.create_case_status(uuid, text, text, boolean, boolean);
drop function if exists public.update_case_status(text, uuid, text, text, boolean, boolean);
drop function if exists public.reorder_case_status(uuid, text[]);
drop function if exists public.archive_case_status(text, uuid);
drop function if exists public.list_case_status_defs(uuid, boolean);

-- ---------------------------------------------------------------------------
-- app helpers that only the configurable-status system used
-- ---------------------------------------------------------------------------
-- apply_case_status / case_terminal_key were the close_case/cancel_case core in
-- 092001; 093001 rewrites close_case/cancel_case to write the terminal status
-- directly (no indirection), so these go.
drop function if exists app.apply_case_status(uuid, text);
drop function if exists app.case_terminal_key(uuid, text);
-- The "is this status terminal" helper (the liveness literal's replacement). Its
-- callers are all re-replaced in 093001 with a fixed-enum check.
drop function if exists app.case_status_is_terminal(uuid, text);
-- The label->key slug helpers (used ONLY by the status CRUD; tags do NOT use
-- them — verified: case_tags has no slug, its key is the raw name).
drop function if exists app.slugify_status_key(text);
drop function if exists app.unaccent_fallback(text);

-- ---------------------------------------------------------------------------
-- The seed-default-statuses trigger on public.commissions + its functions
-- ---------------------------------------------------------------------------
-- New commissions no longer seed a status vocabulary (the fixed model needs no
-- per-commission seed). Drop the trigger BEFORE its function.
drop trigger if exists seed_case_statuses_on_commission_insert_trg on public.commissions;
drop function if exists app.seed_case_statuses_on_commission_insert();
drop function if exists app.seed_default_case_statuses(uuid);

-- ---------------------------------------------------------------------------
-- The vocabulary table (policies first, then the table — no cascade)
-- ---------------------------------------------------------------------------
drop policy if exists case_status_defs_select on public.case_status_defs;
drop policy if exists case_status_defs_staff_admin_write on public.case_status_defs;
drop table if exists public.case_status_defs;
