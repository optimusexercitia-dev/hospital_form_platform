# RDR — Referral detail page redesign (record)

Rotated out of `PROGRESS.md` on 2026-08-12 at completion. Plan + binding amendments A1–A12:
[referral-detail-redesign.md](../plans/referral-detail-redesign.md). ADR
[0109](../decisions/0109-referral-registros-and-case-access-summary.md). QA:
[review](../reviews/referral-detail-redesign-review.md). Locator survey:
[survey](../testing/referral-detail-redesign-locator-survey.md).

Merged to `main` locally 2026-08-12 — merge `81e1dc9`, graphify refresh `dfc3e35`. **Not pushed.**

> ⚠ **PARTIALLY SUPERSEDED, same day (2026-08-12) — REG·KIND / ADR
> [0110](../decisions/0110-shared-registro-kind-vocabulary.md), merge `9a20c8a`.** This record is
> kept as the account of what RDR shipped; it is NOT a description of the live system. What
> changed: the per-commission **`referral_note_types`** vocabulary (task 1a, ADR 0109 D2) — the
> table, both policies, the audit trigger, `reorder_referral_note_types`, the four server actions
> and the "Tipos de registro" dialog — is **DELETED**. `referral_internal_notes.note_type_id` /
> `type_label` are one **`kind`** column carrying the fixed case-Registro list. Read every mention
> of a note TYPE below as history. Consequence for the open items: **MINOR-1 is moot on the
> referral side** (see below), and the `create_/update_referral_internal_note` signatures cited in
> the mutation-audit sections took a `uuid → text` parameter change.

---

### RDR — Referral detail redesign (worktree `worktree-referral-detail-redesign`)

Plan: [referral-detail-redesign.md](../plans/referral-detail-redesign.md). Owned rows only; the
lead owns the Phase Status table.

**PHASE STATUS: Phases 0–4 BUILT + GATED. Gate step 3 (QA) ✅ APPROVED
([review](../reviews/referral-detail-redesign-review.md), `862c782`). Gate step 4 (human
approval) — PENDING. NOT merged, NOT pushed.**

**QA verdict: APPROVED**, no blocking finding; 2 MINOR + 3 INFO. QA proved A11/Rule 7 holds by
enumerating from the **read door** (`body_md` is grant-REVOKED ⇒ `listReferralInternalNotes` is the
only read path ⇒ one call site ⇒ an exhaustive 3-arm ternary) rather than by grepping `bodyMd` —
so a surface that renamed the field on its way to the DOM would still have been caught. Zero
`dangerouslySetInnerHTML` in `src/`; exactly one Markdown pair declared, no `rehype-raw`.

- **MINOR-1 — live, reproduced, KNOWINGLY SHIPPED.** Reordering registro types raises `23505` after
  archiving any non-last type: the manager is fed non-archived types only, but the RPC renumbers
  `1..n` while archived rows keep their positions, colliding with
  `referral_note_types_commission_position_key`. The user sees a misleading pt-BR message; no raw
  PG string leaks. **Not fixed here on purpose**: amendment A6 mandates mirroring
  `case_narrative_types`, and the sibling carries the identical defect today — fixing one side
  creates exactly the drift A6 exists to prevent. Needs one platform-wide change.
  **→ MOOT on the referral side 2026-08-12 (ADR 0110):** `referral_note_types` and
  `reorder_referral_note_types` are deleted, so this defect now has exactly ONE site,
  `case_narrative_types`. ⚠ It is **still unfixed there** — what changed is the reason for not
  fixing it: there is no longer a sibling to drift from, so A6's mirroring argument no longer
  applies and a unilateral fix to `case_narrative_types` is now the right move.
- **MINOR-2 — the sole Rule 7 defense had zero automated coverage.** `markdown-renderer.tsx` had no
  test file (verified: the directory held only the component). Removing `rehypeSanitize` or adding
  `rehypeRaw` would have left lint, typecheck, vitest, pgTAP **and** E2E green. **Being closed now**
  with a unit test requiring both mutations to redden it.
- **INFO-1** — `case-narratives.test.ts:17` claims sanitization "is covered by the `MarkdownRenderer`
  tests"; it was not. Corrected alongside MINOR-2. ([[a-comment-is-an-assertion-that-goes-stale-silently]])

⚠ **Self-caught vacuous keystone, worth repeating**: `322` §5.1/5.2 originally matched on SQLSTATE
`42501` alone and stayed GREEN under the door's own neutralization — execution fell through to
`log_audit_access`, which refuses the same caller with the same code, so the keystone was measuring
the **backstop**. Both now pin the door's pt-BR message.

| # | Task | Owner | Status |
| --- | --- | --- | --- |
| 1a | `referral_note_types` + RLS (mirrors the LIVE `case_narrative_types`) | backend | ✅ 2026-08-11 |
| 1b | `referral_internal_notes` extended in place (`body`→`body_md`, title/type/assignee/lifecycle) + the A4 column-grant matrix | backend | ✅ 2026-08-11 |
| 1c | Note-lifecycle doors, `reorder_referral_note_types`, `get_referral_case_access_summary`, audit-registry arm | backend | ✅ 2026-08-11 |
| 1d | Fresh `db reset` → `gen:types` → `test:db` | backend | ✅ green |
| 1e | pgTAP `322` (72) + `150`/`298` updates + `p0b` BATCH 5 | backend | ✅ green |
| — | Phase 1 gate: `ARM=census` · `ARM=hat` · `ARM=floor` · diff-scoped door sweep | backend | ✅ all hold |
| 2a | `types.ts` — `ReferralInternalNote` extended (`body`→`bodyMd` + 9 fields), `ReferralNoteType`, `ReferralCaseAccessSummary` (**5 groups**), the `ReferralThreadEvent` union + input shapes | backend | ✅ 2026-08-11 |
| 2b | `thread-events.ts` — pure `synthesizeThreadEvents` + 11 Vitest units (tie-break mutation-proven red) | backend | ✅ 2026-08-11 |
| 2c | `queries/referrals.ts` — order-preserving notes mapper, `listReferralNoteTypes`, `getReferralCaseAccessSummary` | backend | ✅ 2026-08-11 |
| 2d | `actions.ts` — registro lifecycle (4 RPCs) + vocabulary CRUD (3 direct RLS writes + 1 RPC), pt-BR errors | backend | ✅ 2026-08-11 |
| 3.0 | Baseline: follow the `body`→`bodyMd` rename into the notes panel (tree was RED) | frontend | ✅ 2026-08-11 |
| 3a | `page.tsx` — A9 direction-bug fix, minimal header, rail reorder, mobile interleaving + `loading.tsx` in lockstep | frontend | ✅ 2026-08-11 |
| 3b | New: `referral-details-card` (incl. A10 "Ação solicitada"), `referral-case-card`, `referral-case-access-dialog` (5 groups, A7) | frontend | ✅ 2026-08-11 |
| 3c | New: `referral-note-card`, `referral-note-type-manager`, `referral-thread-event` | frontend | ✅ 2026-08-11 |
| 3d | Modified: "Registros internos" panel (heading **and** disclaimer), messenger `referral-thread`/`-thread-item`, compact composer (Ctrl/Cmd+Enter), compact `Responsáveis`/`Casos relacionados` | frontend | ✅ 2026-08-11 |
| 3e | Gates: `npm run lint` 0/0 · `npm run typecheck` 0 errors · `npm run test` 1229/1229 | frontend | ✅ green |
| 3f | Manual browser pass (source + target + plain-member personas), registro lifecycle end-to-end, A11 render path proven | frontend | ✅ 2026-08-11 |
| 4a | Locator sweep — ONE pass over `phase22-referrals`, `phase22-referrals-governance` (+ the 5 other detail-page visitors verified needing none) | tester | ✅ 2026-08-11 |
| 4b | New `e2e/referral-registros.spec.ts` — REG 1–6 · DET 1–4 · CASE 1–2 · EVT-1 · KB 1–3 (16 tests) | tester | ✅ 2026-08-11 |
| 4c | Targeted green: `referral-registros` 16/16 · `phase22-referrals-governance` 29/29 · `phase22-referrals` 40/40 · `technical-direction-referrals` 5/5 (unmodified) · `patient-index -g AC-3` 1/1 · `nsp-per-hospital -g "AC-6\|AC-7"` 6/6 | tester | ✅ 2026-08-11 |
| 4d | `npm run typecheck` 0 errors · `npm run lint` 0/0 (incl. `lint:vacuous`, 176 spec files / 0 findings) | tester | ✅ green |
| — | **FULL `npm run e2e:prod` gate** — lead's step, NOT run by the tester | lead | ⏳ pending |

**Phase 3 (UI) — frontend notes.** A11 holds: the ONLY display path for
`ReferralInternalNote.bodyMd` is `referral-note-card.tsx` → `MarkdownRenderer`; proven live by
storing `Corpo **markdown** do registro. <script>alert(1)</script>` and observing a `<strong>`
element with **no** `<script>` node in the card. `synthesizeThreadEvents` is now consumed by BOTH
referral detail routes (the `direcao-tecnica` page passes `viewerCommissionId={null}` — a DT
referral has no target commission to align bubbles against).

⚠ **For the tester (Phase 4) — breaks the locator survey did NOT list**, because it swept for
label/heading TEXT and these are structural or placeholder-based:
1. `phase22-referrals.spec.ts:1466/1468` — `thread.locator('li')` no longer means "a message": the
   Diálogo interleaves synthesized system rows, which are `li`s too. Both carry a stable
   `data-thread-row` attribute (`"message"` / `"event"`); scope to
   `li[data-thread-row="message"]`. `getByRole('region', { name: 'Diálogo' })` is unchanged.
2. `phase22-referrals-governance.spec.ts:1051/1070` — `getByPlaceholder(/Escreva uma nota visível
   apenas à sua comissão/)` is gone; the composer is a Markdown editor behind an **"Adicionar
   registro"** toggle (it is not in the DOM until that button is clicked).
3. Same spec — `getByRole('button', { name: /adicionar nota/i })` is now "Adicionar registro"
   (open the composer) + "Registrar" (submit).
4. `:1049`'s `getByText(/visíveis apenas à sua comissão/i)` **survives** — the disclaimer was
   renamed to "Registros internos — visíveis apenas à sua comissão…", keeping that substring.
5. `:1053` `getByRole('heading', { name: 'Notas internas' })` → `'Registros internos'`. Keep the
   `getByRole('heading', …)` scope — a bare `getByText` would silently anchor on the disclaimer
   (survey §4).

**Phase 4 (E2E) — tester notes (2026-08-11).** All 5 breaks above confirmed and fixed. Beyond
them, a **sixth break class the survey and Phase 3 both missed**, found only by running: the D7
event rows do not merely *add* `li`s — their pt-BR sentences **quote the strings the side panels
own**, so page-level queries that were unambiguous for a year now match two elements.
`getByText('Resolução 1')` also matches "Resolução 1 registrada por Chefe CCIH" (R3-4, R3-7), and
`page.locator('li').filter({ hasText: 'Revisor(a) principal' })` also matches "Enfermeiro CCIH Um
designado como Revisor(a) principal" (R4-2, R4-4 ×2, R4-5 ×2). Seven sites, all fixed by scoping
to the owning panel via a new `panel(page, name)` helper — **never `.first()`**, which would let a
timeline row silently satisfy a panel assertion. Sweep property used: *"text an event row emits"*
(the 9 `describe()` arms of `referral-thread-event.tsx` + `REFERRAL_ASSIGNMENT_ROLE_LABELS`),
not *"text the redesign deleted"*.

**Verified needing NO change** (each run, not reasoned): `technical-direction-referrals.spec.ts`
(5/5 — the DT route renders neither the Detalhes nor the case card; its `ReferralThread` has no
`li`-counting assertion), `patient-index.spec.ts` AC-3, `nsp-per-hospital.spec.ts` AC-6/AC-7,
`case-patient.spec.ts` (comment only), `perf-sweep-wave2.spec.ts` (hub only),
`qob-org-admin-content-wall.spec.ts`, `nsp-cross-org-isolation.spec.ts`.

⚠ **Two PRE-EXISTING fragilities observed while running — neither caused by RDR, both relevant to
triaging the full gate:**
1. ✅ **FIXED 2026-08-11 (gate-blocking; the lead's full `e2e:prod` hit it in batch 17).**
   `technical-direction-referrals.spec.ts` had **no `case_referrals` flag lifecycle of its own** and
   depended on ambient state. The new `referral-registros.spec.ts` ran before it in batch 17 and
   forced the flag OFF in `afterAll`; DT-1 then failed at "Encaminhar caso" and, because that file
   is `mode: 'serial'`, the other **four tests never ran** — 4 did-not-run, which proves nothing
   while reading like silence. The fragility was pre-existing but the new spec is what triggered
   it, so it was ours. **Both halves fixed, at the property level rather than the instance:**
   - *Teardown must restore, never force.* `case_referrals` is GLOBAL, the gate batches many specs
     onto one server, and the seed default (ON) does not reappear between specs of a batch. All
     three force-OFF teardowns now **read the flag in `beforeAll` and restore that exact value** —
     `referral-registros`, **and the two pre-existing offenders** `phase22-referrals` /
     `phase22-referrals-governance`. This matches what `case-patient.spec.ts` and
     `patient-index.spec.ts` already did; `perf-sweep-wave2.spec.ts` even carried a comment naming
     `phase22-referrals` as the cause, so the hazard was known and worked around locally but never
     fixed at source.
   - *Every spec owns its precondition.* `technical-direction-referrals.spec.ts` now asserts
     `case_referrals` ON in its own `beforeAll` (reading the value back, so a silent no-op cannot
     masquerade as a precondition) and restores what it found. This is the half that **survives
     someone adding another referral spec later** — the teardown fix alone would be re-armed by the
     next one.
2. `perf-sweep-wave2.spec.ts` creates **26 CCIH referrals and never deletes them**. The commission
   hub paginates at 25 by recency, so afterwards the seeded ENC-0001 is off page 1 and
   `phase22-referrals.spec.ts` **Flow 1a** fails — reading as a hub regression when it is fixture
   debt. Reproduced here at 45 CCIH-sourced referrals; green again on a fresh reset. The new
   `referral-registros.spec.ts` therefore **purges its own 4 referrals by subject prefix** in
   `afterAll` and asserts ENC-0001/ENC-0002 survive that delete. **Still open** — it is not in
   RDR's scope to change that spec's fixture strategy, and `RESET=1` masks it batch-to-batch.

⚠ **The A9 direction fix has NO observable surface left to regress against.** After D1 dropped the
direction chip, nothing on the detail page renders `detail.direction` — verified by tracing every
consumer (`encaminhamentos/page.tsx` hub only). DET-3 therefore tests **side derivation**
(`myCommissionId` vs source/target → "Caso de origem" / "Caso em análise", plus the absolute
De/Para), which is a different mechanism. Dropping `viewerCommissionId` again would **not** turn
DET-3 red. Pinning A9 itself would need a unit test on `getReferralDetail`, not E2E.

**Phase 1 gate record (name the ARM, not the script — CLAUDE.md §6 step 5).**
`ARM=census` HOLDS (454 live gates / 465 verdicts) — it flagged all 4 new gates as unswept before
they were swept, which is the arm working. `ARM=hat` HOLDS (self-test 6/6; 3 pre-existing
reasoned-allowlisted findings; the roster's raw `memberships` reads are third-party, not
caller-bound). `ARM=floor` HOLDS — **it first FAILED and the failure was real**: every call to
`assign_referral_internal_note` in `322` raised, so the door was recorded as never called and its
positive arm was genuinely unproven (fixed by `322` 4.20/4.21). Diff-scoped `ARM=policy` over the
4 gates derived from the migration: **0 BLIND, 0 ERROR, 4 COVERED**; verdicts merged into
`docs/reviews/authz-door-audit-findings.md` after restoring it (Amendment 1 hazard 1).

**FULL `e2e:prod` GATE — lead-run, 2026-08-11 (run 2, after fixes).**
`1074 passed · 1 failed · 0 infra · 2 flaky · 9 did-not-run · 17 batches`; coverage 1086/1092.
The **only** failing batch is b7 = **BUG-MIN-E2E-1** (`meeting-audio-minutes` test 1 stalls and
strands its 9 serial siblings) — pre-existing, outside this branch (`git log main..HEAD` touches no
meetings path), and green in another worktree the same morning. **Referral batch 17: 62 passed,
0 failed, 0 did-not-run.**

Run 1 was `1060 passed · 11 failed · 13 did-not-run`. All 11 triaged, none a product regression:
8 × PDF (the gotenberg sidecar was down — the gate's own preflight predicted them; re-run green
after `docker start gotenberg-pdf`), 1 × `administrativo` (10/10 green in isolation), 1 ×
`meeting-audio-minutes` (BUG-MIN-E2E-1), and 1 × `technical-direction-referrals` DT-1 — a **real
test-isolation defect introduced by this phase**, root-caused and fixed (`4adb987`).

⚠ **Two traps that nearly turned this red gate into a reported green — record them.**
1. `npm run e2e:prod | tail -N` returns **tail's** exit status, not the script's. Run 1 reported
   exit 0 while the script itself printed `GATE RED`. Never pipe the gate.
2. **`/tmp/e2e-prod-gate/` is shared across worktrees and is never cleaned.** During run-1 triage it
   held `batch-{1,7,8}-rerun.log` showing comfortable passes — timestamped 08:37–12:50, hours
   before the 18:25 run, and one referencing `worktrees\ethics-committee-completion`. Reading them
   as "my failures re-ran green" would have been a false green off another branch's log.
   **Timestamp-check every gate log before citing it.**

**LEAD RE-VERIFIED, independently (2026-08-11)** — not relayed from the teammate's report. On my
own fresh `supabase db reset --local`: `npm run test:db` → `Files=183, Tests=5870, Result: PASS`;
`ARM=census` HOLDS (454/465); `ARM=hat` HOLDS (self-test 6/6); `ARM=floor` HOLDS (79 never-called
doors, all allowlisted). Also re-verified from the live catalog: `body_md` carries **no**
`authenticated` grant while all 9 new columns do (K-R5-1 survived the rename); the NULL-hole fix
(`is distinct from`) is present in `create_referral_internal_note`; `dispose_referral_phi` writes
`body_md` (its remaining bare `body` is `referral_messages.body`, a different table);
`reorder_referral_note_types` is `prosecdef=f`; and no 3-arg `create_referral_internal_note`
overload survives the DROP+CREATE.

⚠ **The diff-scoped run swept 4 of the 5 cases it was given.** `app._audit_access_authorized`
(whose dispatch arm this phase changed) matches neither arm: the predicate worklist is bounded by
the name regex `^(is_|can_|has_|…)` at `p0-authz-door-audit.sh:176` and the name begins with `_`.
Amendment 5a/6's "the boundary of an enumeration must be the property, not the syntax", at the
harness level. Covered instead by a targeted mutation (red-proven). Do not cite that run as
5-of-5 coverage.

**Keystones, all mutation-proven red (`p0b` BATCH 5 + one targeted probe):** the door's own
authority gate · `reorder_referral_note_types` · `update_referral_internal_note` · the restored
NULL-hole defect · the audit-registry arm. **A fifth was found VACUOUS by its own mutation** —
`322` 5.1/5.2 matched on SQLSTATE `42501` alone and stayed green when the door's gate was
neutralized, because `log_audit_access` refuses the same caller with the same code. They now pin
the door's pt-BR message.

**Phase 2 handoff (TS).** `npm run typecheck` has exactly **one** new error —
`src/lib/referrals/actions.ts:695` passes `p_body`, now `p_body_md`. (`RouteContext` in
`src/app/api/documents/[id]/route.ts:22` is pre-existing — verified against the unmodified
`database.ts`.) Both `create_referral_internal_note` **and `redact_referral_note`** return the
table row type, so the rename changes their returned JSON key `body` → `body_md`; the
`list_referral_internal_notes` element key changes too, and its order is now open-first /
`created_at` DESC within group.

**Phase 2 done — the contract `frontend` builds against (2026-08-11).** Every shape below was
verified by CALLING the live doors as a seeded persona inside a rolled-back transaction, not by
reading migration text or trusting `tsc`. `npm run lint` green (0/0); `npm run test` green
(83 files / 1229 tests).

- Queries: `listReferralInternalNotes(referralId)` (**order-preserving — never re-sort**),
  `listReferralNoteTypes(commissionId, includeArchived = false)`,
  `getReferralCaseAccessSummary(referralId, commissionId) → ReferralCaseAccessSummary | null`.
- Actions: `createReferralInternalNote` · `updateReferralInternalNote` · `assignReferralNote` ·
  `unassignReferralNote` · `concludeReferralNote` · `createReferralNoteType` ·
  `updateReferralNoteType` · `archiveReferralNoteType` · `reorderReferralNoteTypes`.
- Pure: `synthesizeThreadEvents(detail) → ReferralThreadEvent[]` in `@/lib/referrals/thread-events`.

⛔ **`npm run typecheck` is RED on two lines `backend` does not own** —
`src/components/referrals/referral-internal-notes-panel.tsx:78` (`body:` → `bodyMd:`) and `:143`
(`note.body` → `note.bodyMd`). The `body`→`bodyMd` contract rename lands there; the Phase-1 handoff
predicted *one* new error and there are three. Phase 3 rewrites this panel anyway. (`RouteContext`
in `src/app/api/documents/[id]/route.ts:22` stays pre-existing and untouched.)

**Three places the plan/handoff were wrong on substrate** (all corrected in code, none blocking):
`ReferralAssignment` has **`assignedAt`**, not `createdAt`; `ReferralResolution` has **`resolvedAt`**,
not `createdAt`; and **`saveNarrativeBody` sanitizes nothing** — Rule 7 is enforced at RENDER time by
`@/components/forms/markdown/markdown-renderer` (react-markdown + `rehype-sanitize`, no `rehype-raw`),
so "reuse the sanitizer it uses" resolves to "store verbatim and render through that component". A
second write-time sanitizer would have been new divergent behaviour, not reuse.

⚠ **Archive-only is an app convention, not a DB guarantee.** `authenticated` holds table-level
DELETE on `referral_note_types` and the write policy is `FOR ALL`, so a coordinator could delete a
type; the FK is `ON DELETE SET NULL` (the registro silently goes untyped, keeping its `type_label`
snapshot). The LIVE `case_narrative_types` carries the **identical** grant, so this is a faithful
mirror rather than new drift — but it is platform-wide, not absent. Method note:
`information_schema.column_privileges` **cannot** show DELETE (not a column-level privilege), so an
absence there proves nothing — `table_privileges` is the view that answers it. I asserted the wrong
thing from the wrong view first and caught it only by re-querying.

