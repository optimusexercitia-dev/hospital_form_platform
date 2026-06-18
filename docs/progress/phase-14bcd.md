# Phase 14b–14d — Patient-Safety / NSP: Triage, RCA & CAPA

Archived task detail (moved out of PROGRESS.md at the §6 Record step). Phase 14a
(NSP foundation) is archived separately in [phase-14a.md](phase-14a.md). Cross-phase
logs (Bug Log, Test Run Summary, QA Verdicts, Decisions, Follow-ups) stay in PROGRESS.md.

**Completed 2026-06-18** · QA **APPROVED** (`docs/reviews/phase-14-review.md`) · human-approved.

## Batch context

**Phase 14 batch — build 14b → 14c → 14d, then ONE combined §6 gate** (human-directed
scope, 2026-06-18). Sub-phases built in dependency order (14b's `confirm_triage` mints the
RCA shell; `capa_action.root_cause_id` → `rca_root_causes`); test pass + QA run ONCE after
all three were built. Contract-first per sub-phase (backend posted typed query/action
signatures before frontend built).

## Tasks

| ID | Owner | Task | Status |
| -- | ----- | ---- | ------ |
| 14b-BE | backend | **Triage & Disposition** — `event_triage`(1:1) + `event_triage_sentinel_flags` + configurable `pqs_sentinel_criteria`/`pqs_event_types` (JC/WHO seeds); fixed reach(5)/harm(6) enums; `save_triage`/`confirm_triage`(freeze + mint RCA shell when pathway=rca)/`reopen_triage` + vocab CRUD + `triage_disposition`; freeze guard `guard_event_triage`; HC045/HC046; RLS (event-scope read / PQS-write); pgTAP | ✅ mig `…121100–121103`; HC045/HC046; +due-window setter |
| 14b-FE | frontend | Triage three-pane workstation under `/admin/nsp` (inbox · 4-step guided flow · live disposition rail; real `event_patient` panel) + NSP config area (sentinel checklist, event types, RCA due-window). pt-BR, keyboard, GSAP | ✅ routes `/admin/nsp/triagem` + `/configuracoes`; PHI on detail path only; keyboard-only flow |
| 14c-BE | backend | **RCA Workspace** — `rca`(1:1) + `rca_members`/`rca_timeline_entries`/`rca_evidence`/`rca_factors`/`rca_why_chains`/`rca_root_causes`; `can_write_rca` DEFINER (PQS/admin OR assigned non-observer; mirror `can_write_interview`); freeze-on-completed child-lock; new **immutable `nsp-evidence` Storage bucket** (Rule 6); HC047/HC048; full RPC set; pgTAP | ✅ mig `…121200–121202`; observer read-only; child-lock; seed RCA on EV-0003 |
| 14c-FE | frontend | RCA workspace under `/admin/nsp` (4-stage stepper Problem → Causal [Fishbone ↔ 5-Whys] → Root causes → Corrective actions), team panel, incident timeline, evidence. pt-BR, keyboard, GSAP (fishbone/PDCA) | ✅ route `/admin/nsp/rca/[rcaId]`; "Abrir RCA" wired from triage |
| 14d-BE | backend | **CAPA & Closure** — `capa_plan`(reusable primitive: `source ∈ {rca,event,…}`) + `capa_action`(JC strength) + tasks/evidence/measures/results/`capa_effectiveness`; `guard_capa_status` + child-lock; `open_capa_plan`/action CRUD + `advance/complete_capa_action`(assignee-or-PQS narrow DEFINER)/measures+results/`record_capa_effectiveness`/`close_capa_plan`(conclude gate HC051/HC052)/`cancel`/`reopen`(revokes effectiveness)/`capa_kpis`; HC049–HC053; Phase-15 `source_indicator_id` FK NULL-safe; pgTAP | ✅ mig `…121300–121302`; source-polymorphic `capa_plan`; close→event auto-close; seed open CAPA-0001 |
| 14d-FE | frontend | CAPA workspace under `/admin/nsp` (PDCA wheel per action, measures→results grid, effectiveness panel, closure + lessons-learned editor; Phase-15 indicator picker rendered **disabled** w/ hint). pt-BR, keyboard | ✅ route `/admin/nsp/capa/[capaId]`; root-cause↔action linkage; Phase-15 picker disabled |

## Gate outcome (§6)

- **Step 1 — Build:** ✅ typecheck · lint · unit 24/24 · pgTAP 511/511 (at build-complete).
- **Step 2 — Test pass:** **freeze-proof method established** to stop the host freezes that
  had halted this gate — prod `next build`+`next start`, `--workers=1`, `--reporter=list`,
  `PW_TEST_HTML_REPORT_OPEN=never`, `supabase db reset` per run (full suite ~8 min, **no
  freeze**; previously `next dev` crawled and the dev server ballooned to 4.3 GB on the
  heavy NSP pages). **Phase-14 E2E 65/65 GREEN** (14a 16 · 14b 13 · 14c 17 · 14d 19;
  re-run still 65/65 after the QA fixes) + **pgTAP 516/516**.
  - **Caveat (NOT a 14b–d defect):** the full *regression* suite is not green against the
    prod build — pre-existing ≤13 harness debt (Radix dialog-close animation flakiness,
    since the older specs lack `reducedMotion`, + shared-DB retry/parallel pollution).
    Every failure is a pre-Phase-14 spec; the Phase-14 specs are clean. Tracked in
    PROGRESS.md Follow-ups (fix: `reducedMotion` in the Playwright config + per-test DB
    isolation).
- **Step 3 — QA: APPROVED** (`docs/reviews/phase-14-review.md`). Initial verdict was
  CHANGES REQUESTED with 2 findings, both closed by backend and re-verified:
  - **BLOCKER (BUG-14B-001):** `triage_disposition` raised SQLSTATE 42702 (bare `event_id`
    in the WHERE collided with the `RETURNS TABLE` output column). Fixed by qualifying
    `where event_triage.event_id = p_event_id`; pgTAP `141` strengthened (plan 39→44) to
    assert the RPC's own return values so it can't silently recur.
  - **MINOR:** `set_pqs_rca_due_window` emitted a mislabeled audit row
    (`triage.saved`/`event_triage`); retagged `pqs_config.rca_due_window_changed`/`pqs_department`.
  - All security-critical axes verified PASS: RLS on every 14b–14d table (writes only via
    `SECURITY DEFINER` RPCs), PHI isolation + PHI-read auditing, audit allow-lists exclude
    free-text/PHI, immutable `nsp-evidence` bucket, state machines + conclude-gates.
- **Step 4 — Human approval:** ✅ approved (with the regression-harness caveat acknowledged
  as a separate tracked follow-up).
