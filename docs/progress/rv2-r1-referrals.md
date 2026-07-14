# RV2·R1 — Referrals v2 · Dialogue Core — completed-track record

Rotated out of the live PROGRESS.md at Record (2026-07-14). **Second track of S2** (Pilot cores) in the
[Pre-Pilot Release Scope Expansion](../plans/pre-pilot-release-scope-expansion.md) (ADR 0071). Pre-pilot
expansion of the shipped Phase-22 referral module. Plan:
[referrals-v2-dialogue-governance.md](../plans/referrals-v2-dialogue-governance.md) · ADR
[0037](../decisions/0037-inter-committee-case-referrals.md) **Amendment 1**. Flag `case_referrals` (existing,
**OFF** in prod — seed forces ON for local/E2E). **Local-first; remote deploy DEFERRED to the pilot reset.**
Branch `pre-pilot-release-s0`. **R2–R5 governance = S4 (deferred).**

## What shipped (R0 → R1)
The shipped Phase-22 referral model couldn't do **mid-review two-way dialogue**. R1 adds a message **thread** on a
referral + an `awaiting_information` waiting state so target committee B can ask source A a clarifying question and
get an answer before concluding. Additive / forward-only.

- **R0 (design gate, lead-reviewed):** ratified SQLSTATE `HC0A0`/`HC0A1`, audit routing, R1 stubs. **Two
  live-vs-plan catches resolved** (the R0 gate's value):
  - **Body PHI-gating → Option B** — the plan's "column-REVOKE `body`" was a hybrid not shipped anywhere; the live
    PHI-row siblings (`referral_reply`) use row-RLS `can_read_referral_phi` with no column REVOKE. **Option B** =
    row-RLS `can_read_referral_phi` **+** column-REVOKE `body` → **stricter than shipped**: every body read (even by
    PHI-cleared users) goes through the audited `get_referral_detail` door, closing the un-audited direct-select
    that `result_md` still allows.
  - **`close_case` correction** — the plan wrongly assumed a `NOT IN` exclusion gate; live `close_case` uses an
    **inclusion** list, so `awaiting_information` would have silently *not* blocked case-closure. Fixed (added to the
    inclusion list).
  - **Audit routing** — `referral.message_created` via `app.audit_write` (Rule-11 mutation trail), **not** the
    `log_audit_access` read-door (S0 §D / IV2-consistent).
- **R1 backend** (migs `20260720000900` schema/RLS + `…000910` RPCs + `…000920` compose-flags + `…000930`
  column-grant + `…000940` M-1 guard): `referral_messages` (sequence, `message_type`, PHI `body`,
  R5-reserved-inert cols) + `case_referral += waiting_on_committee_id`/`last_message_at` + status `awaiting_information`;
  `guard_referral_message` sender∈{source,target} trigger; RPCs `post_referral_message` (HC0A0)/
  `request_referral_information` (HC0A1)/`provide_referral_information`; `get_referral_detail` extended (thread +
  `can_compose_as_source`/`can_compose_as_target` compose-authority flags, bodies nulled for metadata readers);
  `dispose_referral_phi` purges `body`.
- **R1 UI** (`src/components/referrals/*` + `encaminhamentos/[referralId]/page.tsx`): NEW `referral-thread.tsx`
  (PHI-safe — `body===null` → "Conteúdo restrito") + `referral-composer.tsx` (side×status gated: source→Responder@
  awaiting_information, target→Solicitar@in_review, either→Comentar while non-terminal); `awaiting_information`
  chip/waiting-on; hub metadata-only "Última atividade" column (no body preview — §2.2).

## Two runtime-caught fixes (both by the frontend's dev-server verification — pgTAP structurally couldn't)
1. **Analyst-composer parity** — the composer was gated `staff_admin`-only, but the RPCs also authorize
   `referral_target_analyst`. Backend exposed `canComposeAsSource`/`canComposeAsTarget` on `get_referral_detail`
   (byte-for-gate RPC-authority parity); composer regated onto them. (`307e038` + `e65b494`.)
2. **`case_referral` column-grant** ([[case-referral-column-grants]] trap) — R1 added `last_message_at`/
   `waiting_on_committee_id` without extending `case_referral`'s per-column `GRANT SELECT` → hub `42501` (empty for
   everyone). Fixed + pgTAP `has_column_privilege` + positive hub-shaped guard so it can't regress. (`350a7d7`.)

## SQLSTATE
`HC0A0` message shape/entitlement (incl. the M-1 non-state-type reject) · `HC0A1` request/provide wrong-status.
`HC0A2–9` reserved for R2–R5.

## Gate (CLAUDE.md §6) — all ✅ (human-approved 2026-07-14)
- **Build:** tsc / lint 0-0 / Vitest **369** / `next build` ok.
- **pgTAP `150_referrals.sql` 44→82; full pgTAP suite 2325 PASS** on fresh reset.
- **Phase E2E `phase22-referrals` 29→40, 40/40** (2× fresh-reset isolation + green in the full `e2e:prod` run).
- **QA APPROVED** — 0 B / 0 M / **1 Minor (M-1, fixed)** / 2 Info ([review](../reviews/rv2-r1-referrals-review.md)).
  M-1 = `post_referral_message` now rejects `information_request`/`information_response` (those come only from the
  state-driving RPCs); pgTAP-proven (`…000940`).
- **Full `e2e:prod`: 0 RV2 regressions.** Every E2E red across all runs was a **non-RV2** spec — `answer-model-v2`/
  `builder-dialog-ui` form-builder stragglers (proven **31/0 strict isolation**) + `ui-batch-2026-07` (documented
  BUG-F3E2E-002 cross-spec contamination) — plus transient **`reset FAILED`** infra (the local test stack degraded
  after ~40 resets this session; env, not code; the pilot uses remote Supabase). `phase22-referrals` itself proven
  40/40. **M-1 note:** the guard couldn't re-run on the final build due to the stack degradation, but it is
  **logically isolated from every path `phase22` exercises** (the spec's `post` only sends `general`; request/respond
  use the dedicated RPCs M-1 didn't touch) and is **directly proven by pgTAP 82**. **Env follow-up for the resuming
  session: `supabase stop && supabase start` to clear the degraded local stack before the next `e2e:prod`.**

## Collision conformance (S0 §E)
- Extends (never contradicts) the Phase-22 core: snapshot boundary, PHI single-door, QPS oversight, hash-chained
  audit. Option B is a deliberate audit-coverage improvement over the siblings.

## Commits (branch `pre-pilot-release-s0`)
`5220b29` R1 backend · `307e038` compose-flags · `350a7d7` column-grant fix · `0d8e424` UI · `e65b494` composer
regate · `d93bcfc` E2E spec · `1150ed4` M-1 guard · graphify chores · `phase(rv2-r1): complete` (Record).

## Open follow-ups (non-blocking)
- R2–R5 governance (triage/SLA · resolution/reopen/lineage · assignments/multi-link · private-notes/disclosure) →
  **S4**. R5 is the softest (trim to notes-only if the window compresses). QPS-reads-internal-notes default = **no**.
- RV2 **pilot-enable** (`case_referrals` ON for the pilot) is a **deferred deploy-time PO decision** — the flag stays
  OFF meanwhile.

Backend surface durably mapped in [backend-state.md](../backend-state.md).
