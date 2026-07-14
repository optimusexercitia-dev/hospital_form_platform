# QA Review — RV2·R1 (Referrals v2 — Dialogue Core)

**Reviewer:** `qa` · **Date:** 2026-07-14 · **Branch:** `pre-pilot-release-s0`
**Scope:** S2 track 2 of the Pre-Pilot Release Scope Expansion (ADR 0071); ADR 0037
**Amendment 1**; build spec `docs/plans/referrals-v2-dialogue-governance.md` §3 R1 + §2 spine.
**Commits reviewed:** `5220b29` (R1 backend), `307e038` (compose flags), `350a7d7`
(column-grant fix), `0d8e424` (R1 UI), `e65b494` (composer regate), `d93bcfc`/`c3cbd0f`
(E2E + graphify).
**Flag:** `case_referrals` (OFF in prod, forced ON in seed). Additive / reset-OK.

## Verdict: ✅ APPROVED

**0 Blocker · 0 Major · 1 Minor · 2 Info.** The security core — Option B body PHI-lockdown,
audit routing, close-gate correction, DEFINER-only writes, compose-authority parity — is
implemented correctly and pgTAP/E2E-locked. No RLS, immutability, or PHI hole. The single
Minor and two Info items are hardening notes, none blocking.

---

## Dimension 1 — Requirements (§R1 acceptance)

Every §R1 acceptance bullet is met and tested:

| Requirement | Status | Evidence |
|---|---|---|
| `referral_messages` thread (sequence, sender, type, body) | ✅ | `20260720000900` table + `UNIQUE(referral_id, sequence_number)`; type CHECK ∈ {general, information_request, information_response, clarification}; body NOT NULL + not-blank CHECK. |
| `awaiting_information` status + `waiting_on_committee_id` | ✅ | status CHECK widened; `waiting_on_committee_id` + CHECK ∈ {source,target}; `guard_referral_status` gains `in_review ⇄ awaiting_information` arcs. |
| `post` / `request` / `provide` state machine | ✅ | Three DEFINER RPCs (`20260720000910`); request `in_review→awaiting_information` waiting_on=source; provide `awaiting_information→in_review` waiting_on=target. pgTAP + E2E R1-2/R1-3. |
| `get_referral_detail` extension (ordered thread, waiting-on, last-activity) | ✅ | thread ordered by `sequence_number`; body nulled for metadata reader; `waiting_on_committee_id`/`last_message_at` returned PHI-free. |
| `close_case` correction (blocks `awaiting_information`) | ✅ | inclusion-list gate now `('sent','received','accepted','in_review','awaiting_information')`; pgTAP HC076 + E2E R1-5. |

Sequence-number concurrency, non-participant rejection, and the metadata/PHI body split are
all locked in `150_referrals.sql` (44→80) and `e2e/phase22-referrals.spec.ts` (29→40, 40/40).

## Dimension 2 — Security / PHI (load-bearing)

**Body PHI-gating "Option B" (§2.1) — CONFIRMED STRICTER than siblings.**
`referral_messages` protection is belt-and-suspenders: (a) row SELECT policy =
`app.can_read_referral_phi` (mirrors `referral_reply`/`referral_shared_item`); PLUS (b)
column-level lockdown — `revoke all … from authenticated` then a per-column `grant select`
that **omits `body`** (`20260720000900:75-81`). A PHI-cleared reader therefore **cannot**
direct-`select body` — pgTAP asserts `has_column_privilege(...,'body','SELECT')=false` and a
target-coordinator's direct `select body` throws `42501`. The only path to a body is the
audited `get_referral_detail` DEFINER door, which nulls it for a metadata-only reader. This
closes the un-audited direct-`select` that `result_md`/`frozen_body_md` still permit — the
intended audit-coverage improvement.

**PHI-free projections (§2.2) — CONFIRMED.** `REFERRAL_LIST_SELECT` / `listCommissionReferrals`
add only `last_message_at` (a timestamp) — no body, no last-message text preview
(`queries/referrals.ts`; `ReferralListItem.lastMessageAt` documented "Never a body preview").
The detail thread renders `body === null` → "Conteúdo restrito — você não tem acesso ao teor
desta mensagem." (`referral-thread.tsx:94-98`). E2E R1-4a/R1-4c lock the restricted render and
the hub no-preview.

**Audit routing (§2.4 / S0 §D) — CONFIRMED.** `referral.message_created` is emitted via
`app.audit_write` (Rule-11 mutation trail, hash chain) in all three RPCs with PHI-free metadata
(`message_id`, `sequence_number`, `message_type`, `sender_commission_id` — no body). It is
**not** added to the `log_audit_access` read door: no R1 migration touches
`_audit_access_authorized`, and the only `log_audit_access` call is the pre-existing,
already-authorized `referral.viewed` (fired once for an entitled non-originator PHI read;
message bodies ride it). Verified `audit_log.action` carries only a shape CHECK
(`POSITION('.' IN action) > 1`), no verb allowlist — so the new verb is accepted with no
registry change. Matches the IV2 ruling.

**Write path — CONFIRMED.** Direct DML on `referral_messages` is revoked (no INSERT/UPDATE/DELETE
grant; no write policy); writes go only through the three DEFINER RPCs, each `select … for update`
on the parent `case_referral`. Each new `public.*` RPC does `revoke all … from public` then
`grant execute … to authenticated, service_role` (t19; pgTAP locks PUBLIC-cannot-execute).
`guard_referral_message` (BEFORE INSERT trigger) enforces `sender_commission_id ∈ {source,target}`
(HC0A0) as defence-in-depth. pgTAP locks direct-INSERT `42501`.

**Compose-authority parity — CONFIRMED byte-for-gate.** `get_referral_detail`
(`20260720000920`) returns `can_compose_as_source = is_staff_admin_of(source)` and
`can_compose_as_target = is_staff_admin_of(target) OR referral_target_analyst(referral)` — the
exact gates of `provide` and `post`/`request` respectively. Both are PHI-free booleans on the
broad `can_read_referral` door. The UI composer gates on these
(`referral-composer.tsx` + host `page.tsx:186-192,286-294`); `ReferralActions` (decline/conclude)
stays on `canManageTarget`/`canManageSource` (staff_admin coordinator-only), unchanged. pgTAP
proves the analyst arm (case_access grantee, not coordinator) gets `can_compose_as_target=true`
while a plain member gets both false; E2E R1-7a/R1-7b confirm end-to-end.

**Column-grant completeness — CONFIRMED.** The `350a7d7` fix grants `authenticated` SELECT on
the two new PHI-free `case_referral` columns (`last_message_at`, `waiting_on_committee_id`),
pgTAP-guarded via `has_column_privilege` + a positive hub-shaped `lives_ok`. No other new column
lacks a grant (`referral_messages` non-body columns are granted; `body` is intentionally omitted).

**Disposal (§2.5).** `dispose_referral_phi` extended to redact `referral_messages.body` to the
`[PHI removido]` marker (NOT NULL column, so redact not null) alongside the existing bodies.

## Dimension 3 — Conformance to R0 ratifications

Both lead-reviewed catches are honoured:
- **Option B (not the plan's literal hybrid mis-description).** Implemented as row-`can_read_referral_phi`
  **AND** column-REVOKE — the stricter reading. Migration header and commit message both name it
  Option B; pgTAP proves the column lockdown.
- **`close_case` inclusion-list fix (the plan wrongly said "no change needed").** The RPC comment
  documents the correction; `awaiting_information` was added to the actual inclusion list, and
  pgTAP + E2E R1-5 prove the block. The plan's §3-R1 "no change needed" text is superseded by
  this correct implementation.

## Dimension 4 — Code quality

- **Rule 8 (types):** `database.ts` regenerated; the door booleans/thread ride jsonb from
  `get_referral_detail` (expected — the door returns `jsonb`, mapped in `getReferralDetail`).
  New domain types (`ReferralMessage`, `MessageType`, inputs) live in `src/lib/referrals/types.ts`.
- **Rule 9 (data access):** all writes route through `src/lib/referrals/actions.ts` → RPC; reads
  through `src/lib/queries/referrals.ts`. No inline supabase-js in components. Client composer calls
  the `"use server"` actions.
- **Rule 10 (pt-BR / English keys):** English enum keys; pt-BR labels (`MESSAGE_TYPE_LABELS`,
  `REFERRAL_STATUS_LABELS['awaiting_information']='Aguardando informação'`); HC0A0/HC0A1 mapped to
  pt-BR in `messages.ts` (`mapReferralError`), raw PG never surfaced.
- **No unjustified `any`.** Message-type cast is `as MessageType` on a DB-constrained value.
- Server-Component thread shell + a client composer island (correct RSC boundary).

## Dimension 5 — UX & a11y

Composer is accessible: `aria-invalid`/`aria-describedby` on the textarea, `role="alert"` error,
`sr-only` legend, `aria-pressed` on mode toggles; keyboard-only flow proven (E2E R1-9). Chips convey
kind by icon + text + tone (not colour alone). Reduced-motion-safe `animate-rise-in` staggering. The
composer carries a PHI-minimisation hint ("Nunca inclua dados de paciente…"). No raw PG in the UI.

---

## Findings

### Minor

- **M-1 · `post_referral_message` accepts `information_request`/`information_response` types without
  driving the state machine.** `post_referral_message` (`20260720000910:63-64`) validates
  `p_message_type` against all four types, so a coordinator calling the RPC directly with
  `information_request` posts a message typed as a formal request that does **not** flip
  `awaiting_information`/`waiting_on` (only the dedicated `request`/`provide` RPCs do). Not
  exploitable and not PHI-relevant — the UI composer only ever sends `general`, and the dedicated
  RPCs are the sole state-machine authority. Recommend (non-blocking, R2+ or a one-line tweak):
  restrict `post_referral_message` to `{general, clarification}` so the request/response types are
  produced exclusively by the state-driving RPCs, preventing a mislabeled-but-inert "request".

### Info

- **I-1 · Reserved-inert `in_reply_to_message_id` / `supersedes_message_id` have no FK** to
  `referral_messages(id)` (plain `uuid`). Consistent with "reserved-inert until R5"; the FK + behaviour
  land when R5 implements threading/redaction. Recorded so R5 adds them.
- **I-2 · `get_referral_detail` recreated twice in the R1 batch** (`…000910` then `…000920` for the
  compose flags). Forward-only, latest-wins — correct, but the two-step is worth noting for anyone
  diffing the door body; `…000920` is the authoritative version.

## What was verified but NOT re-flagged (per task "known/intentional")

- Option B being stricter than the shipped `result_md`/`frozen_body_md` siblings is the intended
  audit-coverage improvement — confirmed, not a defect.
- Hub shows the `awaiting_information` status chip but no per-row waiting-on-committee label —
  accepted (PHI-free projection; the chip conveys the state).
- R2–R5 (triage/resolution/assignments/notes) are out of R1 scope — absence not flagged.
