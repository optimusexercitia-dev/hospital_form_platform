# Referral Detail Page Redesign — Implementation Plan

> **Handoff note:** this plan is self-contained for a future session. First implementation step:
> copy this file into the repo as `docs/plans/referral-detail-redesign.md` (worktree
> `.claude/worktrees/referral-detail-redesign`, branch `worktree-referral-detail-redesign`)
> and commit it, so progress can be tracked beside the code. Re-enter the worktree with
> `EnterWorktree {path: ".claude/worktrees/referral-detail-redesign"}`.

## Context

The referral detail page (`src/app/o/[org]/c/[commission]/encaminhamentos/[referralId]/page.tsx`,
~540-line server component) crams all referral facts into a dense header, keeps owners and case
links in the main column, and renders the Diálogo as a flat list of uniform cards. The user wants
a calmer, messenger-style page with a fact rail. All decisions below were agreed with the user
(grilling session, 2026-08-11).

### Agreed decisions (binding)

| # | Decision |
|---|----------|
| D1 | **Minimal header**: back link, referral code, subject h1, Status + Type chips ONLY. Everything else moves to a Details card at the top of the rail region. Fix the direction bug (see Bug below) and drop the direction chip entirely. |
| D2 | **Owners**: the existing `ReferralAssignmentPanel` ("Responsáveis") moves to the rail below the Details card, full management retained, restyled compactly for the 340px rail. |
| D3 | **Case under review card** (rail): sending side sees the originating case (`case_referral.source_case_id`, NOT NULL — always present); receiving side sees a symmetric card for its linked `target_case_id` (empty state pointing to "Vincular caso" in Ações when unset). "Abrir registro do caso" button → `/casos/{caseId}` when the viewer can read the case; otherwise the button opens a dialog listing who has access. |
| D4 | **Keep the manual "Casos relacionados" panel** (typed pointers: related/follow_up/escalated/duplicate), moved to the rail. Both case cards + links live on the rail. |
| D5 | **Access dialog roster**: full effective roster, grouped — Coordenadores (commission staff_admins) / Acesso concedido (explicit grants) / Atribuídos (phase+narrative assignees), minus live recusals, names only (no reasons/expiry). Requires a new gated DEFINER RPC (below). |
| D6 | **Internal notes → Registros**: adopt the case-narratives core model **plus the type vocabulary**; **no** correction/revision flow. Side privacy (K-R5-1) preserved: each committee sees only its own notes. Panel renamed "Registros internos". |
| D7 | **Diálogo messenger layout**: bubbles aligned by committee (viewer's side right, other left), sender name + committee badge, keep read/ciência receipts + Tarjar in a compact footer. **Inline system events** synthesized from existing detail fields — no new tables. |
| D8 | **Composer**: compact box, Ctrl/Cmd+Enter to send, mode pills kept (Responder / Solicitar informação / Comentar), **no attachments**. |
| D9 | **Feature flag**: reuse `case_referrals`; no new flag (pre-pilot, in-place table extension; a second flag would force dual-mode rendering of one mutated table). |
| D10 | **Redaction kept unchanged** on notes (open + concluded, side-coordinator gate). On concluded/frozen notes it is the only correction mechanism (LGPD escape hatch). No reopen RPC. |

## ✅ Phase 0 — COMPLETE (2026-08-11). Binding amendments A1–A9

Verified against the **live catalog** (`pg_proc` incl. `prosecdef`, `pg_policies`,
`information_schema.column_privileges`) after merging `main` (ETH·E4) into this worktree.
**Where these amendments conflict with the phase text below, the amendment wins.**

| # | Amendment |
|---|---|
| A1 | **Migration is `supabase/migrations/20260919010000_referral_registros_case_access_summary.sql`.** The plan's `20260918010000` would sort *before* the merged ETH·E4 migrations (highest registered version is `20260919000600`, 353 registered = 353 files). |
| A2 | **New pgTAP suite is `322_referral_registros.sql`** — 320 (`act_expiry_and_acl_hardening`) and 321 (`eth_e4_participant_seating`) are taken. |
| A3 | **Live `create_referral_internal_note` is `(p_referral_id uuid, p_committee_id uuid, p_body text)` and `RETURNS referral_internal_notes`** (the table row type), not `returns uuid`. Keep `p_committee_id` as param 2 — the body gates on it (`p_committee_id in (source,target)` **and** `app.is_member_of_for(p_committee_id, auth.uid())`). Because it returns the row type, the `body`→`body_md` rename **changes the RPC's returned JSON key** — update the TS caller in lockstep. A param add/rename is a privilege reset: **re-issue the EXECUTE grant** and verify from the catalog. |
| A4 | **`referral_internal_notes` is on COLUMN-LIST grants.** `body` is the *only* column with no `authenticated` SELECT — that IS the K-R5-1 REVOKE. Therefore **every new column needs its own explicit `GRANT SELECT (col) ON public.referral_internal_notes TO authenticated`** or direct reads fail 42501; `body_md` must receive **no** grant. Verify the full column-privilege matrix post-apply. |
| A5 | **`list_referral_internal_notes` returns `jsonb`** (not `json`), currently ordered `created_at` ASC. Read audit uses `public.log_audit_access`; writes use `app.audit_write`. Flag assert is `app.assert_referrals_enabled()`. Error codes in use: `42501` authority, `HC0A9` domain, `no_data_found`. |
| A6 | **PO DECISION — vocabulary writes mirror the live sibling, NOT the plan's §1c.** `case_narrative_types` uses **direct RLS-gated writes** (`case_narrative_types_staff_admin_write`, `FOR ALL`, `app.is_staff_admin_of(commission_id) OR app.is_tenancy_admin_of(commission_id)`) plus **one** DEFINER RPC for reorder. So `referral_note_types` gets: read policy `app.is_member_of(commission_id) OR app.is_tenancy_admin_of(commission_id)`, a `FOR ALL` staff_admin write policy, table-level grants to `authenticated`, and **only** `reorder_referral_note_types` as a DEFINER RPC. **Drop** `create/update/archive_referral_note_type` RPCs — actions write the table directly. Net new prosecdef doors: **2** (`reorder_referral_note_types`, `get_referral_case_access_summary`) + the note-lifecycle doors in §1c. |
| A7 | **PO DECISION — the access-summary roster gains two groups.** `app.can_read_case` is a thin projection of `app.has_case_capability(…,'read_case_content')` → `app._case_caps`. The arms that actually confer `read_case_content` are **S1** coordinator (`is_staff_admin_of_for`), **S3** `case_access_grants` (active, unexpired, `read_case_content` or `write_case_content`), **S4** assignee (`case_phases.assigned_to` ∪ `case_narratives.assigned_to`), **S6** PQS/NSP operator (`is_pqs_operator_of_for(hospital_of_commission(...))` on a referral-touched case, flag `case_referrals`), **S7** quality reviewer (`is_quality_reviewer_of_for(hospital…)` **and** `commissions.quality_oversight = 'visible'` **and** not `explicit_grants_only`). Hard denies applied **before** every positive arm: `is_case_respondent`, `is_recused_from_case`, and `app.is_active(uid)`. **S2 org_admin and S5 plain member do NOT confer `read_case_content`** — they must NOT appear. Dialog groups become five: Coordenadores / Acesso concedido / Atribuídos / **Segurança do paciente** (S6) / **Qualidade** (S7). De-dupe a person into the highest group in that order. |
| A8 | Table name confirmed **`case_access_grants`** (`source` ∈ `manual_grant, nsp_investigation, referral, break_glass`; `list_case_access` filters `source='manual_grant'` and is coordinator-gated — hence the new RPC is still required). |
| A9 | **Direction bug re-verified post-merge.** Only `encaminhamentos/[referralId]/page.tsx:111` needs the fix; `direcao-tecnica/[referralId]/page.tsx:85` also omits the arg but never consumes `detail.direction` (its "direction" hits are prose about *technical direction*). Signature confirmed at `src/lib/queries/referrals.ts:637`. |

### ✅ A10 — requested action keeps a home (PO decision, 2026-08-11)

Raised by the E2E locator survey: `ReferralRequestedActionChip` (`page.tsx:294–296`) renders
`detail.requestedActionLabel` in the header chip tail. D1 reduces the header to Status + Type
chips only, but D1 also says "everything else moves to a Details card" — and the enumerated
`referral-details-card.tsx` field list omitted it, so as written the field vanished from the
page. **Resolved: the omission was an enumeration slip, not an intent to delete.** Add an
**"Ação solicitada"** row to the Details card (null-hidden like every other row) and re-point
the detail-page assertion at `e2e/phase22-referrals-governance.spec.ts:552` to the card scope.
The sibling hub-page assertion is unaffected. Detail:
`docs/testing/referral-detail-redesign-locator-survey.md` §5.1.

### Live bug fixed as part of this work

`page.tsx` line ~111 calls `getReferralDetail(referralId)` **without** `viewerCommissionId`
(signature at `src/lib/queries/referrals.ts:637` accepts it, default null), so `direction`
always resolves `'outgoing'` and the header chip reads "saída" even for the receiving
committee. Fix: pass `access.commission.id`. Verified: list pages pass it correctly; no other
consumer of detail-page direction; after D1 the chip is dropped anyway, but the correct value
matters for any direction-dependent logic and the E2E regression spec.

## Current-state map (verified against code)

- **Page structure**: `SafetyMotion` wrapper; header (lines ~270–356) with chips + `<dl>` meta
  block; body grid `flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-8`.
  Main column: Descrição → `ReferralSnapshot` → `ReferralThread`(+`ReferralComposer` slot) →
  `ReferralReplyView` → `ReferralResolutions` → `ReferralAssignmentPanel` →
  `ReferralRelatedCasesPanel` → `ReferralInternalNotesPanel`. Rail (`lg:sticky lg:top-8`):
  `ReferralLineageCard` → `ReferralActions` → `ReferralDraftDelete` → `ReferralPatientPanel` →
  `ReferralDisposeDialog`. Sibling `loading.tsx` (33 lines) mirrors the grid — **lockstep rule**.
- **Components** all in `src/components/referrals/`: `referral-thread.tsx`,
  `referral-thread-item.tsx` (flat bordered `<li>` cards, `#seq · committee · type-chip · time`,
  "por {name}", plain-text body, receipts footer), `referral-composer.tsx` (mode pills + 4-row
  textarea), `referral-internal-notes-panel.tsx`, `referral-related-cases-panel.tsx`,
  `referral-assignment-panel.tsx`, `referral-chips.tsx`, `format.ts`.
- **Card convention**: `section aria-labelledby`, `flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs`;
  header row = lucide icon `size-4 text-muted-foreground` + `h2 text-base font-semibold` + count
  pill; inner rows `rounded-xl border border-border/70 bg-muted/20 p-3`; empty state dashed.
- **Data**: `getReferralDetail` wraps RPC `get_referral_detail` → `ReferralDetail`
  (`src/lib/referrals/types.ts:469`) carrying code/status/priority/responseDueAt/overdue/
  sourceCommissionId+Name/targetCommissionId+Name (null for DT-target referrals!)/
  sourceCaseId+Number/targetCaseId+Number/createdAt/sentAt/receivedAt/decidedAt/concludedAt/
  withdrawnAt/declineReasonCode/assignments/links/messages/readReceipts/resolutions/
  canComposeAsSource+Target/waitingOn*.
- **Notes today**: table `referral_internal_notes` (`id, referral_id, committee_id,
  author_user_id, body, created_at, redacted_at/by/reason`), side-private keystone **K-R5-1**
  (RLS + column-REVOKED body + `app.can_read_referral_internal_note`); RPCs
  `list_referral_internal_notes(p_referral_id) returns json`, create via
  `createReferralInternalNote`, `redactReferralNote` in `src/lib/referrals/actions.ts`.
- **Registros pattern source** (Casos): `case_narratives` (+`case_narrative_types` vocabulary:
  `id, commission_id, label, description, position, archived, created_at, updated_at`),
  actions in `src/lib/case-narratives/actions.ts` (`addAdHocNarrative`, `saveNarrativeBody`,
  `assignNarrative`, `unassignNarrative`, `concludeNarrative`, `createNarrativeType`,
  `updateNarrativeType`, `reorderNarrativeTypes`, `archiveNarrativeType`), UI
  `src/components/cases/case-narrative-card.tsx`, `narrative-type-manager.tsx`,
  `narrative-status-pill.tsx`, `use-narrative-action.ts`, editor pair
  `@/components/forms/section-text-editor` + `@/components/forms/markdown/markdown-renderer`.
- **Case access**: effective read = commission staff_admins (role) ∪ explicit grants (table
  `case_access_grants` per generated types — TS docs say `case_access`; **verify name in
  catalog**) ∪ phase/narrative assignees (derived inside `app.can_read_case`, never stored),
  minus live recusals. `list_case_access` RPC is coordinator-gated (returns `[]` otherwise) —
  hence the new RPC. Existing roster UI to crib: `src/components/cases/case-access-panel.tsx`.
  Non-coordinator case route: `/o/{org}/c/{commission}/casos/{caseId}` via
  `commissionHref(org, slug, "casos", caseId)` (`src/lib/routing.ts:37`); `manage/cases/…` is
  coordinator-only. Referral case links are **pointer-only — no access granted**.
- **Rail pattern to adopt** (mobile interleaving), from `src/components/cases/case-detail-view.tsx:560`:
  column wrappers `className="contents lg:flex lg:flex-col lg:gap-6"` (rail `lg:gap-4` +
  `lg:sticky lg:top-8`) with per-card `order-N lg:order-none`.
- Migration timestamps currently end at `20260918003100_*` — new migration must sort after.
  `graphify query` first for any code exploration (repo hook). For any schema/RLS fact, the
  **live catalog** (pg_proc incl. prosecdef, pg_policies, ACLs) is the sole truth — never
  migration file text.

## Phase 0 — Preconditions

1. Invoke the **frontend-design** skill before any UI work (binding design system).
2. **Live-catalog verification** — capture current bodies/gates for:
   `list_referral_internal_notes`, `create_referral_internal_note`, `redact_referral_note`,
   `get_referral_detail`, `app.can_read_referral*`, `app.can_read_case` (pg_proc + prosecdef);
   policies on `referral_internal_notes` and `case_narrative_types` (pg_policies — the latter is
   the pattern to mirror); column privileges on `referral_internal_notes.body`
   (information_schema.column_privileges — REVOKE-hardened keystone column); the audit-emit
   helper the referral RPCs actually call (name it from pg_proc).
3. Respect the shared-local-stack rules: one owner of the local DB at a time; allocate the
   migration timestamp above the highest **registered** version.

## Phase 1 — Backend

Single migration: `supabase/migrations/20260919010000_referral_registros_case_access_summary.sql`
(corrected by **A1** — the original `20260918010000` sorted before the merged ETH·E4 chain).

### 1a. New table `referral_note_types` (mirror `case_narrative_types`)

```sql
create table public.referral_note_types (
  id            uuid primary key default gen_random_uuid(),
  commission_id uuid not null references public.commissions(id) on delete cascade,
  label         text not null check (btrim(label) <> ''),
  description   text,
  position      integer not null,
  archived      boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on public.referral_note_types (commission_id, position);
```
RLS enabled; SELECT policy = commission members read their own commission's vocabulary (copy the
**live** `case_narrative_types` read-policy predicate); no write policies — writes via DEFINER
RPCs only. Grants: revoke all from public/anon, grant select to authenticated (match live
pattern). Mirror the composite tenant FK if `case_narrative_types` carries one (check catalog).

### 1b. Extend `referral_internal_notes` (extend, do NOT replace)

Rationale: pre-pilot data is trivial; the K-R5-1 lattice (RLS + column REVOKE + audited single
door) and its pgTAP coverage evolve in place instead of being rebuilt and re-keystoned.

```sql
alter table public.referral_internal_notes rename column body to body_md;
alter table public.referral_internal_notes
  add column title        text,
  add column note_type_id uuid references public.referral_note_types(id),
  add column type_label   text,          -- snapshot at pick time; null = untyped/legacy
  add column assigned_to  uuid references public.profiles(id),
  add column status       text not null default 'open' check (status in ('open','concluded')),
  add column concluded_at timestamptz,
  add column concluded_by uuid references public.profiles(id),
  add column updated_at   timestamptz not null default now(),
  add column updated_by   uuid references public.profiles(id),
  add constraint referral_notes_concluded_shape
      check ((status = 'concluded') = (concluded_at is not null));
```
- No backfill: existing rows become untitled, untyped, open notes (agreed legacy semantics).
- **Re-issue the column REVOKE on `body_md` explicitly** in the migration and verify post-apply
  (privileges follow a rename, but this is a keystone column — belt and suspenders).

### 1c. RPCs (all SECURITY DEFINER, set search_path, Rule 11 audit rows, pt-BR errors)

Modified:
- `list_referral_internal_notes(p_referral_id uuid) returns json` — same K-R5-1 gate + audit;
  elements now: `id, referral_id, committee_id, author_user_id, author_name, title,
  note_type_id, type_label, body_md (null / redaction semantics unchanged), assigned_to,
  assigned_to_name, status, concluded_at, concluded_by, concluded_by_name, created_at,
  updated_at, redacted_at, redacted_reason`. Order: open first, then concluded; created_at desc
  within group (mapper must match).
- `create_referral_internal_note(p_referral_id uuid, p_body_md text, p_title text default null,
  p_note_type_id uuid default null, p_assigned_to uuid default null) returns uuid` — existing
  side-member gate; new validations: type belongs to caller's-side commission and not archived
  (snapshot label → `type_label`); assignee is an active member of the caller's-side commission.
- `redact_referral_note` — unchanged.

New (gates in parentheses; every one audited):
- `update_referral_internal_note(p_note_id, p_title, p_body_md, p_note_type_id)` (note open AND
  caller is author OR assignee OR side staff_admin; re-snapshot type_label; bump updated_at/by).
- `assign_referral_internal_note(p_note_id, p_user_id)` / `unassign_referral_internal_note(p_note_id)`
  (side staff_admin; open notes only; assignee must be active side member).
- `conclude_referral_internal_note(p_note_id)` (author OR assignee OR side staff_admin; open →
  sets status/concluded_at/concluded_by; freezes).
- Vocabulary CRUD, mirroring the narrative-type RPC gates (staff_admin of the commission):
  `create_referral_note_type(p_commission_id, p_label, p_description default null) returns uuid`
  (position = max+1), `update_referral_note_type(p_type_id, p_label, p_description)`,
  `archive_referral_note_type(p_type_id)` (archive-only, no delete),
  `reorder_referral_note_types(p_commission_id, p_type_ids uuid[])`.
- `get_referral_case_access_summary(p_referral_id uuid, p_commission_id uuid) returns json` —
  explicit side param (a user can belong to both commissions; the UI knows its hub). Gate:
  can-read-referral AND active member of `p_commission_id` AND `p_commission_id` ∈
  {source_commission_id, target_commission_id}. Case is side-derived: source → source_case_id,
  target → target_case_id (null → return null). Returns
  `{ "can_read": <app.can_read_case for caller>, "coordinators": text[], "grantees": text[],
  "assignees": text[] }` — full_name only, PHI-free; roster = staff_admins ∪ case-access grants
  ∪ phase/narrative assignees (same derivation arms as `app.can_read_case` — parity is a stated
  goal), minus live recusals; de-dupe person into highest group (coordinator > grantee > assignee).
- Grants for every new RPC: revoke all from public/anon; grant execute to authenticated (match
  the live grant-hardening pattern).

⚠ **`get_referral_case_access_summary` is a new prosecdef gate** → it MUST get a pgTAP
keystone (neutralize an arm → a test goes red). A brand-new gate passes `ARM=policy` vacuously;
`ARM=census` is what catches it (ADR 0079 Am. 3).

### 1d. Mechanics
Fresh `supabase db reset` → `npm run gen:types` (Rule 8) → pgTAP. Seed: **no changes** (the E2E
spec creates vocabulary through the manage dialog — better coverage; add seed types later only
if flake demands).

### 1e. pgTAP
- Update `supabase/tests/150_referrals.sql` (list/create shape assertions), check
  `295_technical_director_referrals.sql` and `298_authz_p0_isolation.sql` (reference old column
  `body`), extend `supabase/tests/mutation/p0b-isolation-mutation-audit.sh` coverage — extend,
  **never allowlist a reachable gate**.
- New suite `supabase/tests/322_referral_registros.sql` (**A2** — 320/321 are taken): K-R5-1
  preserved across new fields (target member cannot read source note title/type/assignee);
  lifecycle gates (non-author member denied update; assignee allowed; conclude freezes;
  coordinator-only assign; archived type rejected; cross-commission type rejected); vocabulary
  CRUD gates; access-summary side gates (source member → source-case summary; target member →
  target summary or null; neither-side denied), can_read truthiness grantee vs plain member,
  recused person excluded; **the keystone** for the new door.

### Phase 1 gate
`ARM=census` (~2 s) + `ARM=hat` (~10 s) + `ARM=floor` (~1 min) of
`supabase/tests/mutation/p0-authz-invariant.sh`, plus the **diff-scoped door sweep** over exactly
the new/changed prosecdef functions (derive the list from the migration diff — ADR 0079 Am. 1).
BLIND blocks.

## Phase 2 — TS layer

- `src/lib/referrals/types.ts`: extend `ReferralInternalNote` (~line 598): `title`,
  `noteTypeId`, `typeLabel`, `body → bodyMd`, `assignedTo`, `assignedToName`,
  `status: 'open' | 'concluded'`, `concludedAt`, `concludedByName`, `updatedAt`. New types:
  `ReferralNoteType { id, commissionId, label, description, position, archived }`;
  `ReferralCaseAccessSummary { canRead, coordinators: string[], grantees: string[], assignees: string[] }`;
  `ReferralThreadEvent` discriminated union — kinds: `sent | received | decided_accepted |
  decided_declined | assignment | case_linked | resolution | concluded | withdrawn`, each with
  `at: string` + per-kind payload (assignee name + side; decline reason label; resolution info;
  target case number).
- New pure module `src/lib/referrals/thread-events.ts`:
  `synthesizeThreadEvents(detail: ReferralDetail): ReferralThreadEvent[]` from sentAt /
  receivedAt / decidedAt(+status+declineReasonCode) / assignments[].createdAt / target-case link
  (no stored timestamp — anchor at best-available and document the approximation; do NOT invent
  a column) / resolutions[].createdAt / concludedAt / withdrawnAt. **Vitest unit tests** beside
  it (mirror repo test placement).
- `src/lib/queries/referrals.ts`: update `listReferralInternalNotes` mapper; add
  `listReferralNoteTypes(commissionId)` (RLS table read, mirroring how narrative types are
  listed) and `getReferralCaseAccessSummary(referralId, commissionId)` (null on error/denial).
- `src/lib/referrals/actions.ts`: update `createReferralInternalNote` input (title/noteTypeId/
  assignedTo; body→bodyMd — **Rule 7**: reuse the exact sanitizer `saveNarrativeBody` uses in
  `src/lib/case-narratives/actions.ts`); add `updateReferralInternalNote`, `assignReferralNote`,
  `unassignReferralNote`, `concludeReferralNote`, `createReferralNoteType`,
  `updateReferralNoteType`, `archiveReferralNoteType`, `reorderReferralNoteTypes` — `"use
  server"` wrappers mirroring case-narratives patterns, `revalidatePath` on the detail route,
  pt-BR errors, no raw PG errors to UI.

## Phase 3 — UI (frontend-design skill first)

### `page.tsx`
- Fix `getReferralDetail(referralId, access.commission.id)`; drop `ReferralDirectionChip`.
- Header → back link, code, h1, Status + Type chips. Remove chip tail, `<dl>` block, created/
  sent line; decline-reason banner becomes a destructive-toned row in the Details card (status
  chip already shows "rejeitado" in the header).
- Compute `sideCaseId` (source side → sourceCaseId; target side → targetCaseId) and fetch
  `getReferralCaseAccessSummary(detail.id, myCommissionId)` only when `myNoteCommitteeId &&
  sideCaseId`.
- Main column: Descrição → Snapshot → Diálogo(+composer) → Reply → Resolutions → Registros.
- Rail order (Actions kept on top as primary CTAs — user fixed only Details-before-Owners):
  Actions → DraftDelete → **Details** → **Owners** → **Case under review** → Casos relacionados
  → Lineage → Patient → Dispose.
- Adopt case-detail mobile interleaving: wrappers `contents lg:flex lg:flex-col …`, per-card
  `order-N lg:order-none`; rail `lg:sticky lg:top-8` retained.
- **`loading.tsx` updated in the same commit** (grid + order classes in lockstep).

### New components (`src/components/referrals/`)
- `referral-details-card.tsx` (server): dt/dd rows — De, Para (DT-target: composed DT name;
  null-guard `targetCommissionId` everywhere), **Ação solicitada (A10)**, Prioridade (chip), Criado (+ "por {name}"),
  Enviado, Recebido, Status (chip + overdue chip), Prazo de resposta (destructive when overdue),
  Decidido, Concluído/Retirado, Motivo da recusa (destructive, rejected only), Resposta
  esperada. Null rows hidden.
- `referral-case-card.tsx` (client): props `{ heading, caseNumber, caseId, caseHref,
  summary }`. `summary.canRead` → primary button "Abrir registro do caso" →
  `commissionHref(org, commission, 'casos', caseId)`; else opens the access dialog. Receiving
  side, no link: empty state "Nenhum caso vinculado ainda" + muted pointer to "Vincular caso"
  in Ações (no duplicate mutation button).
- `referral-case-access-dialog.tsx`: grouped lists Coordenadores / Acesso concedido /
  Atribuídos (names only, empty groups hidden) + line "Você não tem acesso a este caso.
  Solicite acesso a um coordenador."
- `referral-thread-event.tsx`: centered muted system row, icon per kind, small text.
- `referral-note-card.tsx`: mirrors `case-narrative-card.tsx` — status pill (crib
  `narrative-status-pill.tsx`), `SectionTextEditor` while open+editable, `MarkdownRenderer`
  read-only, assign select (coordinators), conclude, redact. Props: `{ note, canEdit, canAssign,
  canRedact, members, referralId }`. Edit rights (UI mirror of the RPC gate): open AND (author
  OR assignee OR side staff_admin).
- `referral-note-type-manager.tsx`: mirrors `narrative-type-manager.tsx` — dialog from the
  panel header, staff_admin only; create/rename/describe/reorder/archive.

### Modified components
- `referral-internal-notes-panel.tsx` → heading **"Registros internos"**: note-card list (open
  then concluded), "Adicionar registro" composer (title + type select + Markdown editor +
  optional assignee), manage-types button when `canManage`. New props: `noteTypes`, `members`,
  `canManage`.
- `referral-thread.tsx` / `referral-thread-item.tsx`: bubble alignment by
  `senderCommissionId === viewerCommissionId` (mine → right), sender name + committee badge,
  compact receipts + Tarjar footer, interleave `events` by timestamp. New props:
  `viewerCommissionId`, `events`. **Keep aria/heading "Diálogo"** (E2E anchors on it).
- `referral-composer.tsx`: compact single box, mode pills kept, Ctrl/Cmd+Enter submits.
- `referral-assignment-panel.tsx` (keep heading "Responsáveis") and
  `referral-related-cases-panel.tsx` (keep "Casos relacionados"): compact rail restyles.

## Phase 4 — E2E

**Sweep-first rule**: moving cards re-scopes container-chained locators — sweep ALL card-scoped
locators in ONE pass (repo failure mode: fixing one at a time), across:
- `e2e/phase22-referrals.spec.ts` (~234 hits): removed header `<dl>` assertions ("Origem →",
  "Prazo de resposta:", "Enviado em"/"Criado em", decline banner) → Details card scope; thread/
  composer; notes heading rename "Notas internas" → "Registros internos".
- `e2e/phase22-referrals-governance.spec.ts` (~164): Responsáveis (~:880), Casos relacionados
  (~:964), Notas internas (~:1048, redact ~:1097), Diálogo (~:1122, :1152).
- `e2e/technical-direction-referrals.spec.ts`: DT referrals have null target commission — Details
  "Para" shows composed DT name; never a target-side case card.
- Detail-page visitors: `e2e/patient-index.spec.ts`, `e2e/perf-sweep-wave2.spec.ts`,
  `e2e/case-patient.spec.ts` — verify their locators survive.

**New specs** (`e2e/referral-registros.spec.ts` or appended to governance):
1. Registros lifecycle: coordinator creates type via manage dialog → typed note with assignee →
   assignee edits body → conclude → frozen → redact → `[redigido]`; other-side login sees nothing.
2. Details card: rows render; rejected referral shows Motivo da recusa in the card; correct
   content for BOTH sides (direction-bug regression).
3. Case access dialog: no-access member clicks button → grouped names dialog; grantee clicks →
   lands on `/casos/{caseId}`.
4. Thread events: after accept + assign + resolution, system rows interleave in Diálogo.
5. Keep one keyboard-only flow (repo a11y rule) — e.g. composer Ctrl+Enter + dialog focus trap.

## Verification (in order)

1. Phase 1: fresh `supabase db reset` → `npm run test:db`; `ARM=census` + `ARM=hat` +
   `ARM=floor`; diff-scoped door sweep over the migration's gates; keystone proven (neutralize
   → red).
2. `npm run lint` && `npm run typecheck` && `npm run test` (incl. thread-events units).
3. Manual dev-server pass as `chefe.ccih@test.local` (sending side) AND a target-side persona
   (seed roster in `supabase/seed.sql` header; password `Test1234!`): header, rail order, case
   card both states (button vs dialog), bubbles left/right, inline events, registro lifecycle.
4. Full E2E via `npm run e2e:prod` (Git Bash; serialize with any other worktree's DB-mutating
   runs; triage failures against the known ~18–27 flaky baseline before calling regression).

## Risks / gotchas

- `body → body_md` rename: REVOKE must survive (verify catalog post-apply); pgTAP 298 + the
  mutation sweep reference the old column name.
- New prosecdef door without a keystone = ARM=census red; build the keystone with the suite.
- Case-link event has no stored timestamp — document the approximation; no new column.
- `loading.tsx` lockstep with the page grid/order classes (same commit).
- DT-target referrals: null-guard `targetCommissionId` in every new rail card.
- `case_access` vs `case_access_grants` naming drift in TS docs — trust the catalog; prefer
  going through RPCs, never a direct table read for the roster.
- Locator sweep BEFORE rerunning specs; `.env.local` must be sourced for hand-run standalone
  servers.
