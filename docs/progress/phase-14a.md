# Phase 14a — NSP Foundation, Event Intake & Hand-off (archived task detail)

✅ complete 2026-06-18 (§6 gate: E2E 211/211 + pgTAP 409/409, QA **APPROVED** re-verified, human ✅).
First sub-phase of **Phase 14 — Patient-Safety / NSP** (sub-phases 14a–14d). Establishes the
PHI/HIPAA foundation (Architecture **Rule 12**) plus the first patient-safety event pipeline.
Feature-flagged `patient_safety` (OFF→ON in-phase). Build committed `1d26999`.

## What shipped

- **NSP entity + event intake.** Singleton `pqs_department` (Núcleo de Segurança do Paciente) +
  `patient_safety_event` with a per-NSP minted code `EV-0001…` (global advisory-lock mint, mirrors
  meeting/interview numbering). Any committee member may notify an event ("Notificar evento ao NSP")
  from a case (`c/[slug]/manage/cases/[caseId]`) or stand-alone (`/c/[slug]/eventos/novo`) —
  **just-culture**, no role gate. State machine via `app.guard_event_status` (HC043 wrong-state /
  HC044 not-the-current-custodian, freeze-at-triaged, gated by the `app.in_safety_rpc` GUC).
  `case_events.kind += 'safety_event'`.
- **First PHI in the platform, isolated (Rule 12).** Patient identifiers live ONLY in `event_patient`
  (PK = event_id, a 0..1 satellite), behind the tightest RLS, and **never** appear on any
  queue/list/aggregate/timeline path. Every PHI read (`getEventPatient`) emits a Phase-13
  `event_patient.read` audit row with **empty (PHI-free) metadata**; list/queue reads and
  missing-patient events emit none (the `hasPatient` guard, P14a-003).
- **Access-follows-custody.** Append-only `event_custody` ledger (partial-unique open interval;
  `app.guard_event_custody` → HC043 on any closed-interval edit, non-`held_until` column edit, or
  DELETE). A single `app.can_read_event(event,uid)` predicate gates event + both children: current
  custodian OR reporting committee (provenance) OR PQS/admin. A foreign committee sees nothing
  (route gating + RLS, not UI hiding).
- **RPCs** (all `SECURITY DEFINER`, `search_path` pinned, anon/PUBLIC EXECUTE revoked):
  `notify_safety_event`, `acknowledge_event`, `transfer_event_custody`, `update_event`,
  `set_event_patient` (PHI), `cancel_event`, `pqs_inbox` (PHI-free), `patient_safety_enabled`.
  3 mutation-audit triggers (event / custody / event_patient) with PHI-free allow-lists (Rule 11).
- **UI.** `/admin/nsp` inbox (filters: status / priority / reporting committee) + `/admin/nsp/[eventId]`
  detail (custody history, acknowledge while `reported`, PHI panel rendered in-scope only); committee
  read-back `/c/[slug]/eventos`; PHI-free `safety_event` rows on the Phase-12 case timeline. pt-BR,
  GSAP, reduced-motion-safe; one keyboard-only flow.

## Migrations
`20260618121000` patient_safety_core · `121001` event_patient_custody_rls · `121002` safety_rpcs ·
`121003` enable_patient_safety · `121004` phi_read_audit · `121005` pqs_department_rls (QA M1).

## Tests / Gate
- E2E `e2e/phase14a-safety-events.spec.ts` **16/16**; full cross-phase regression **211/211** (8.5m);
  pgTAP `140_patient_safety.sql` **35/35** / overall **409/409**.
- QA: initial **CHANGES REQUESTED** — M1 (MAJOR: `pqs_department` had RLS on but zero SELECT policies →
  Rule 1) + N1 (MINOR: success text returned in `ActionState.error`) → both fixed (additive mig `…121005`
  `select to authenticated using(true)` + `ActionState.message`) → **APPROVED** (re-verified; all 8
  security-crux items pass under live probes).
- 2 in-pass app bugs found + fixed by backend: P14a-002 (client/server `next/headers` boundary crash →
  client-safe `src/lib/safety/types.ts` extraction); P14a-003 (`hasPatient` always-false, PostgREST
  1:1-embed object shape).

## Data-access & action modules
`src/lib/queries/{safety-events,pqs}.ts`, `src/lib/safety/{actions,messages,types}.ts` (the import-free
`types.ts` is the client-safe contract), `src/lib/audit/access.ts` (`event_patient.read` wiring),
`src/lib/queries/case-timeline.ts` (PHI-free `safety_event` composition + echo dedup).

## ADRs
Umbrella [0030 — patient-safety PHI & PQS architecture](../decisions/0030-patient-safety-phi-and-pqs-architecture.md)
(reverses the former "no patient data" stance; PHI posture + PQS/NSP architecture);
[0031 — event custody ledger & PHI isolation](../decisions/0031-event-custody-ledger-and-phi-isolation.md)
(custody-ledger access model + PHI isolation + state machine + PHI `.read` Phase-13 integration).
Review: [phase-14a-review.md](../reviews/phase-14a-review.md).

## Deferred (carried as a follow-up, not gate-blocking)
- INFO nit: `transferEventCustody` / `updateEvent` / `setEventPatient` / `cancelEvent` still return their
  success string in `ActionState.error` (harmless — all consumers gate on `!result.ok`); sweep them into
  the new `message` field on the next `src/lib/safety/actions.ts` touch.
