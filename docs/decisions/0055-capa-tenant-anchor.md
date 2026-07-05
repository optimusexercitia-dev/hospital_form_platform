# ADR 0055 — CAPA tenant anchor: hospital-scope every CAPA, close the cross-hospital write hole

**Status:** Accepted (planned) · **Date:** 2026-07-05 · **Feature:** Pre-Pilot DB
Hardening — WS-3c (D4/H-8 + P8). Closes the one §5 item that is a genuinely reachable
cross-tenant WRITE hole. Part of the pre-pilot program
([pre-pilot-db-hardening-program.md](../plans/pre-pilot-db-hardening-program.md) §1 WS-3);
triage in [external-db-audit-2026-07-evaluation.md](../reviews/external-db-audit-2026-07-evaluation.md)
§3 (H-8) and
[external-db-audit-2026-07-perf-datamodel-analysis.md](../reviews/external-db-audit-2026-07-perf-datamodel-analysis.md)
§2 (D4, P8). Builds on NSP-per-hospital (ADR
[0052](./0052-nsp-per-hospital.md)) — CAPA joins the per-hospital PQS operator model.

## Context

`capa_plan` had **no tenant anchor**. `app.can_write_capa(capa, uid)` had two branches:

- **event-sourced** (`event_of_capa` resolves): `is_pqs_operator_of_for(hospital_of_event(...))`
  — correctly per-hospital.
- **non-event** (manual / indicator / audit_finding / meeting): fell back to
  **`is_pqs_member_of_any(uid)`** — *any* PQS member of *any* hospital.

That predicate gates the write policies on `capa_plan` (update/delete) **and**
`capa_action`, `capa_action_task`, `capa_action_evidence`, `capa_effectiveness`,
`capa_measure`, `capa_measure_result` — the whole non-event CAPA action tree — plus
`advance_capa_action_core` / `assert_capa_writable`. So **a PQS member of hospital A could
PATCH hospital B's manual CAPA and its entire action subtree** (H-8, confirmed reachable via
PostgREST). Separately (P8), `mint_capa_code` serialized **every** hospital on the literal
advisory lock `'pqs:capa_code'` with an unfiltered `MAX` scan, and the code UNIQUE was global
(`UNIQUE(code)`).

## Decision

1. **`capa_plan.hospital_id NOT NULL`** — the tenant anchor (FK to `hospitals`, `ON DELETE
   RESTRICT`). Populated by a `BEFORE INSERT` derive trigger (`derive_capa_hospital`, mirroring
   WS-3a's `derive_answer_version`) for the **derivable** sources — `event`
   (`hospital_of_event`), `rca` (`hospital_of_event(event_of_rca)`), `meeting`
   (`hospital_of_commission(commission_of_meeting)`) — so the anchor is robust across all
   insert paths (RPC, seed, direct). Non-derivable sources must supply it (NOT NULL rejects
   otherwise).

2. **Manual-CAPA hospital derivation** (`open_capa_plan` gains `p_hospital_id uuid DEFAULT
   NULL`): for derivable sources the hospital is derived server-side and `p_hospital_id` is
   **ignored** (a caller can't misattribute an event-CAPA). For `manual` /
   `indicator` / `audit_finding`: use `p_hospital_id` if supplied; else **auto-derive when the
   caller is a PQS operator of exactly ONE hospital** (resolved by `is_pqs_operator_of` over
   the caller's `pqs_members` ∪ `nsp_coordinator` grants — a hospital they can actually
   *operate*, not merely hold a grant in); else raise **HC083** (`informe o hospital do plano
   de ação`). This keeps the single-hospital operator's UI unchanged (the common case) while
   forcing a multi-hospital operator to pick. Authority throughout is
   `is_pqs_operator_of(the resolved hospital)` — replacing the leaky `is_pqs_member_of_any`
   else-branch.

3. **Collapse `can_write_capa`** to a single hospital-scoped predicate:
   `is_pqs_operator_of_for((select hospital_id from capa_plan where id = capa), uid)`. Because
   an event-sourced CAPA's `hospital_id = hospital_of_event(event)`, the collapsed predicate is
   **provably equivalent** on the event path (the `196` event-path positive control confirms
   it); on the non-event path it replaces `is_pqs_member_of_any` with the proper hospital
   scope. A hospital-A PQS operator can no longer update/delete a hospital-B CAPA, write any of
   its action-tree children, or advance its actions — all now `42501`.

4. **`mint_capa_code` per-hospital** (closes P8): per-hospital advisory lock
   (`'pqs:capa_code:'||hospital_id`) + `MAX` filtered by `hospital_id`, mirroring
   `mint_event_code`. The code keeps the `CAPA-####` format (per-hospital-numbered, not
   hospital-prefixed). **The code UNIQUE is flipped `UNIQUE(code)` → `UNIQUE(hospital_id,
   code)`** — otherwise two hospitals both minting `CAPA-0001` would collide against a global
   unique.

## Consequences

- **Behavioural change with teeth:** a previously-allowed cross-hospital manual-CAPA write now
  `403`s (RLS 42501). Intended. No `src/lib` caller relied on cross-hospital writes (they call
  the RPCs as the acting user, RLS-scoped).
- **FE follow-up** (like WS-3b D7): the manual-CAPA UI should pass `p_hospital_id` for
  **multi-hospital** operators; single-hospital operators auto-derive, so the current
  `openCapaPlan` call is unchanged (backward-compatible via the `p_hospital_id` default).
- **`capa_kpis` is intentionally left on its coarse `is_pqs_member_of_any` READ gate** — it
  already row-filters returned CAPAs to the caller's own hospitals, so it is a "show the panel"
  gate, not a cross-tenant data leak. This is deliberate, not an oversight (noted here so QA
  doesn't flag it).
- Locked by pgTAP (`196`): cross-hospital write denied (CAPA + action + action-task, 42501);
  same-hospital write allowed; event-path write by the event's-hospital operator still succeeds
  (the collapse-equivalence proof); per-hospital code (two hospitals both start `CAPA-0001`);
  manual auto-derive for a single-hospital operator.
- HC083 allocated for the manual-CAPA-needs-hospital raise (following HC081 WS-1 anti-lockout /
  HC082 WS-3b hospital-repoint).
