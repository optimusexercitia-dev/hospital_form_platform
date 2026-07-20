# S4·CH — Committee Charters & Meeting Cadence (Phase 21) — complete

**Status:** ✅ complete — human-approved 2026-07-20 → `main` (local; origin push + Coolify + remote
deploy deferred to the pilot, `charters` flag prod-OFF). **ADR:**
[0080](../decisions/0080-committee-charters-cadence-model.md) · **Plan:**
[charters-cadence.md](../plans/charters-cadence.md) · **QA:**
[phase-CH-review.md](../reviews/phase-CH-review.md) (APPROVED r1) · **Track:** S4 of the Pre-Pilot Release
Scope Expansion (ADR [0071](../decisions/0071-pre-pilot-release-scope-expansion.md)) — S4 = ETH·E2 + RV2
R2–R5 + **CH**, all now complete.

## What shipped

A per-commission **charter** = a `meeting_frequency` setting + an optional link to the commission's
**regimento** (a `doc_type='regimento'` Phase-17 controlled document — the regimento content/dates live on
the controlled doc, not inline: ADR 0080 D1–D3). A computed **4-state cadence** indicator, an agenda/action
**carry-forward** suggestion at meeting scheduling, and a **cadence-overdue** notification arm. Dark behind
flag `charters` (seed-ON for local/E2E; **prod-OFF**). **No PHI (Rule 12).**

## Backend surface (durable map in `docs/backend-state.md` §CH)

- **Table `public.commission_charters`** — `commission_id` PK (1:1 → `commissions`, ON DELETE CASCADE);
  `meeting_frequency` NOT NULL CHECK ∈ {semanal,quinzenal,mensal,bimestral,trimestral}; nullable
  `controlled_document_id` (→ `controlled_documents`, ON DELETE SET NULL); `created_by`, `created_at`,
  `updated_at` (D10 touch trigger `app.touch_updated_at`). RLS: **one** SELECT policy `app.is_member_of`,
  **no** INSERT/UPDATE/DELETE policy, `authenticated` = SELECT-only grant (sole write door = the DEFINER RPC).
- **RPCs** (all `public`, `prosecdef=t`, owner postgres, `search_path` pinned, t19 EXECUTE = authenticated +
  service_role, SQLSTATE `HC0K·` + `HC000` flag-off):
  - `upsert_commission_charter(p_commission, p_meeting_frequency, p_controlled_document_id default null)` —
    flag → **staff_admin `HC0K0` FIRST** (`app.is_staff_admin_of`, NOT the broader `is_commission_admin_of`)
    → then regimento-link validity `HC0K1` (same-commission + `doc_type='regimento'`) → upsert → audit
    `charter.upserted`. Returns the camelCase charter row.
  - `meeting_cadence_status(p_commission)` — flag → member `HC0K2` → `{status,lastHeldAt,meetingFrequency}`;
    `status` = `sem_regimento` (no row) / `sem_reunioes` (no qualifying meeting) / `em_dia` / `em_atraso`.
    Cadence over base tables: `max(held_at)` where `held_at IS NOT NULL AND
    visibility_policy='commission_default'`; calendar-interval windows; **inclusive** `em_dia` boundary.
  - `suggest_carry_forward(p_commission)` — flag → member `HC0K2` → `{agendaItems, actionItems}`: unresolved
    agenda (`resolution IS NULL`) from the most-recent held `commission_default` meeting + open non-terminal
    meeting-sourced action items, **each through `app.can_read_action_item`** (confidentiality filter). Pure read.
- **Notifications:** `app.compute_due_charter_notifications()` (X-ζ additive arm, wired into
  `public.compute_due_notifications`, gated on `feature_enabled('charters')`) — each `em_atraso` commission →
  each `staff_admin` gets `kind='charter'`/`entity_type='commission'`/`milestone='overdue'`/`is_reminder=true`,
  weekly-bucketed dedup `charter_cadence:{commission}:{IYYY-IW}` (idempotent via `on conflict (user_id,
  dedup_key)`), PHI-free body. `notifications` `kind` CHECK += `charter`, `entity_type` CHECK += `commission`.
  Delivery is opt-OUT (fires unless a `notification_preferences` row disables the kind) — no seed trap.
- **Data-access** (`src/lib/queries/charters.ts`, `server-only`): `getCharter`, `upsertCharter`,
  `getMeetingCadenceStatus`, `getCarryForwardSuggestions`; pure shapes in `src/lib/charters/types.ts` (client
  components import ONLY these — dodges BUG-FBE-005); `HC0K·` pt-BR map in `src/lib/charters/messages.ts`;
  `chartersEnabled()` in `feature-flags.ts`.
- **UI:** `manage/charter` page (frequency + regimento link/create-handoff + cadence badge) · meetings-list
  cadence indicator · schedule-flow carry-forward panel (ticked agenda items copied via the existing
  `create_meeting_agenda_item` server action; action items read-only).

## Task ledger (all lead-verified live; commits on `main`)

| # | Task | Commit | Verification |
|---|------|--------|--------------|
| CH-BE-1 | Typed contract stubs | `458aedb` | tsc/lint green; pure types split (BUG-FBE-005) |
| CH-BE-2 | Table + RLS + flag + audit verb | `565e2f6` | catalog: 1 SELECT policy, no write, SELECT-only grant; pgTAP `260` 11/11 |
| CH-BE-3 | 3 DEFINER RPCs | `109ef50` | t19; authority-first; pgTAP `261` 29/29; **KS_AUTHORITY/KS_MEMBER/KS_FILTER RED-PROVEN** (harness re-run by lead + QA) |
| CH-BE-4 | Cadence-overdue N arm | `37a63dc` | CHECK widened; opt-out delivery; pgTAP `262` 10/10 |
| CH-BE-5 | Wire `charters.ts` + regen types + seed | `13750b1` | 4 states independently recomputed; regimento linked; 0 pgtap pollution |
| CH-FE-1 | `manage/charter` page | `d982401` | preview-verified; flag+staff_admin gated; Phase-17 doc-editor prefill additive |
| CH-FE-2 | Meetings indicator + carry-forward | `5d366db` | preview-verified; reuses `createAgendaItem` server action |
| CH-TEST | `e2e/charters-cadence.spec.ts` | `14c4381` | 10/10 (AC-1a→AC-7); AC-7 covers the `case_restricted`+`case_id` branch pgTAP didn't |
| phase17 fix | scope DOC-0001 locator | `cb6a671` | see gate triage below |
| CH-QA | review | `45faa6b` | **APPROVED r1** (0 P0/MAJOR/MINOR, 3 INFO) |

## Test-pass gate — the `e2e:prod` triage (worth remembering)

The full gate came back RED **twice** (81 then 14 failures). Triaged to: **~80 infra + ONE real
spec-brittleness**, zero CH behavior defects.
- **Infra:** `supabase_vector` crash-loops and intermittently **502s the auth gateway** (both `/health`
  and `/auth/v1/token`) even while `docker ps` shows auth/kong "healthy" → `reset FAILED` batches +
  `net::ERR_CONNECTION_REFUSED` collapses (97 + 44 in one run; even `home.spec` failed). Fix: `supabase
  stop/start` + `db reset` + **verify a real token POST = 200 before running** (a `/health` 200 is NOT
  sufficient); ~4 batches per restart. Captured in memory `supabase-vector-crashloop-502`.
- **The lone real regression:** `phase17-documents.spec.ts` (AC-6 + AC-10) — controlled-doc codes are
  **per-commission**, so CH's seeded Farmácia regimento is legitimately `DOC-0001`, same as CCIH's
  pre-existing política. The hospital-admin rollup aggregates both central-a commissions → a bare
  `getByText('DOC-0001')` matched 2 rows. **App behavior is correct**; the spec assumed uniqueness. Fixed
  (`cb6a671`) by scoping to the overdue CCIH row (AC-6) / the DOC-0002-anchored CCIH table (AC-10).
- **Coverage:** all 62 spec files got a green run (gate-#1's 5 clean batches = 299 + the passing specs in the
  2 partial batches + the 23 collapsed-batch specs re-run green in two confirmation passes = 275p/0f). Every
  CH-adjacent spec (`hospital-admin-tier`/sidebar, `meeting-held-time` + `phase10-meetings`/modified pages,
  the form specs) green. `charters-cadence` 10/10 on the **prod build**.

## Non-blocking follow-ups (QA INFO — accepted/by-design)

1. `charter.upserted` audit metadata carries `{meeting_frequency, has_regimento}` (config context, non-PHI) —
   slightly broader than the minimal "commission + who". By design.
2. `mapCharterError` has no explicit pt-BR string for the flag-off `HC000` path (not user-reachable — the
   route + nav are flag-gated). Trivial-defer.
3. `getCharter`/`getMeetingCadenceStatus` collapse error and no-row both to `null` (the FE treats both as
   "omit the indicator"). By design.

## Deferred (additive, no rebuild — ADR 0080 Consequences)

Regimento **review-due** reminder (rides a future generic docs-review N arm) · a **stricter never-met**
cadence variant (anchor `em_atraso` on the doc `effective_date`) · **email** delivery · the pilot deploy
(origin push + Coolify + remote `db push` — this is when `charters` reaches prod). The **remote deploy-state
anomaly** (the live remote catalog appears to carry S1–S4 notification kinds, contra the "deferred to pilot"
note) stays open for verification at the pilot deploy step.
