# ADR 0023 — Configurable per-committee case status

**Status:** Accepted · **Date:** 2026-06-14 · **Phase:** post-Phase-8 Cases-Extras batch (R2)

## Context

Phase 7 modelled a case's macro status as a fixed 3-state CHECK on `cases.status`
(`aberto` / `concluido` / `cancelado`), separate from the per-phase status. The
Cases-Extras requirement R2 needs each **committee (commission)** to define its
own ordered, richer status set — which also drives the kanban columns and a
drag-to-set-status board. The structural macro/micro separation already existed;
only the hard-coded vocabulary had to become data-driven.

A load-bearing hazard sat behind the rename: the literal string `'aberto'` was
the hard-coded "this case is live" test in **8 server objects** — the
submit→advance trigger and the phase RPCs. If any kept comparing to `'aberto'`, a
case in a *custom* non-terminal status (e.g. `em_revisao`) would silently fail to
advance phases on submit and reject phase activation.

## Decision

**New table `public.case_status_defs`** — the per-commission vocabulary: ASCII
`key` (stored in `cases.status`), pt-BR `label`, `position`, constrained
`color_token` (resolved to CSS in the UI, never raw CSS), `is_initial`,
`is_terminal`, `archived`. Constraints: `unique(commission_id, key)`,
DEFERRABLE `unique(commission_id, position)` (reorder swap, ADR 0011), and a
partial unique index enforcing **exactly one non-archived `is_initial`** per
commission. RLS member-read / staff_admin-write.

**Validation is a trigger, not an FK.** `cases_status_check` is dropped;
`cases.status` stays `text NOT NULL` (default flipped to `em_andamento`). A
composite FK would fight the "archive, don't delete" ethos and complicate
ordering, so `app.guard_case_status` validates the key against `case_status_defs`.

**Rewritten `app.guard_case_status` (configurable model).** Same `app.in_case_rpc`
chokepoint as Phase 7; the rules became data-driven: a status change requires the
flag; the OLD status must be non-terminal (else **HC025** — a terminal case is
frozen); the NEW status must be a defined key of the case's commission (else
**HC024**); **any non-terminal → any defined status** is allowed (board moves; no
transition matrix). DELETE only while non-terminal.

**The liveness sweep.** `app.case_status_is_terminal(commission_id, key)` replaces
every `= 'aberto'` / `<> 'aberto'` liveness check across `guard_case_status`,
`sync_case_phase_on_submit`, `activate_phase`, `skip_phase`, `add_ad_hoc_phase`,
`reassign_phase`, and `create_case_from_template` (the latter also sets the new
case's status from the commission's `is_initial` key). `start_or_resume_phase`
never compared to `'aberto'` (it gates on the *phase* being `ativa`), so it is
unchanged. The literals in the superseded `create function` bodies of the Phase-7
migrations are inert — `CREATE OR REPLACE` in this batch is the live definition.

**`set_case_status` + the `app.apply_case_status` definer core.** The shared
status-flip logic (validate key/terminal, flip open phases to `nao_necessaria` and
stamp `closed_at/by` on terminal entry, all under `app.in_case_rpc`) lives in a
SECURITY DEFINER `app.apply_case_status`. This lets the PUBLIC `set_case_status`
gate `cases_extras` while the `close_case` / `cancel_case` back-compat wrappers
keep gating **only** `cases_multi_phase` — so the existing close/cancel buttons
never broke when the flag was OFF. Because the core bypasses RLS, every public
entry point (`set_case_status`, `close_case`, `cancel_case`) carries its own
`is_staff_admin_of OR is_admin` gate.

**Seeding via a trigger.** Commissions are created by a bare `INSERT`
(`src/lib/admin/actions.ts`), not an RPC, so an `AFTER INSERT` trigger on
`public.commissions` calls `app.seed_default_case_statuses()` — covering both
`seed.sql` and runtime-created commissions. Default set: `rascunho`,
`em_andamento` [initial], `em_revisao`, `concluido` [terminal], `cancelado`
[terminal]. `concluido`/`cancelado` keep today's keys, so only
`aberto → em_andamento` is a key rename (propagated to `seed.sql` + the pgTAP
fixtures). **No data migration** (pre-launch, from-scratch reset).

**Status CRUD + read.** `create/update/reorder/archive_case_status` (invoker RPCs,
`is_staff_admin_of`-gated, `cases_extras`-gated; the key is slugified from the
label on create and is immutable thereafter). `list_case_status_defs` is a
SECURITY DEFINER, `is_staff_admin_of`-gated read; its `position` column is aliased
`status_position` (`position` is reserved in a SQL `RETURNS TABLE`), remapped in
the TS query layer.

## Consequences

- **New SQLSTATEs** HC024 (invalid key for this commission) / HC025 (terminal,
  frozen), registered in `src/lib/cases/actions.ts` and `status-actions.ts`.
- **TS contract:** `CaseStatus` relaxed to `CaseStatusKey = string` (the union
  removed compile-time exhaustiveness; the badge must carry a guaranteed `muted`
  fallback). `caseStatusIsTerminal(defs, key)` is the TS twin of the SQL helper.
- **Phase-7 invariants preserved:** `case_phases` still carries no answers; no new
  cross-member answer surface; every status write still funnels through a vetted
  RPC that sets `app.in_case_rpc`.
- **Hardening:** the batch re-revokes anon/PUBLIC EXECUTE on every public function
  it creates or replaces (and closes a pre-existing leak from the 091000/091001
  due-date migrations).
- Migrations `20260614092000` (table/helpers/seed/drop-check) + `20260614092001`
  (guards/RPCs/liveness sweep); the `cases_extras` flag flips ON in
  `20260614092006`. Verified live: submit advances a phase while the case is in a
  custom non-terminal status (the top risk).
