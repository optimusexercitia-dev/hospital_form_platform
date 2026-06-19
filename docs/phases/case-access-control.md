# Increment Plan — Case Access Control & "Meus Casos"

**Status:** 📝 Plan — awaiting human approval (no code until approved) · **Date:** 2026-06-19
· **Flag:** `case_access` (ships OFF → permissive fallback; flipped ON in-increment)
· **ADR:** [0033](../decisions/0033-case-access-control.md) · **Branch:** `feat/case-narratives`
(or a fresh `feat/case-access`).

This is an additive, feature-flagged increment over Cases (Phases 7/12 + Case Narratives, ADR
0032), tracked like the **Cases-Extras** / **Case-Narratives** increments (a named PROGRESS.md
increment, not a roadmap phase number). It clears the §6 gate bar — new migration, a **new RLS
shape**, a `SECURITY DEFINER` read-path change, and a **new route group** — so it runs the full
gate: contract-first plan → build → tester → qa → human approval.

## 1. Goal

Make case access **adjustable and attribution-driven**: phase/narrative attribution auto-grants
full-case read + item write; the coordinator can grant read/write to any commission member; and
staff get **"Meus Casos"** (replacing "Minhas fases") with a capability-gated full-case view.
The 14 interview decisions are recorded in ADR 0033 §Decision; read it before building.

**Invariants that MUST hold (regression-guard these):**
- Phase-7 submitted-only: no viewer ever sees another member's *in-progress* answers.
- Phase-fill identity-bound: only `case_phases.assigned_to` fills a phase; a case-write grant does
  not change that.
- PHI-free: `can_read_event` untouched; case access never reaches `event_patient`.
- Flag OFF ⇒ byte-for-byte today's behavior (`can_read_case` falls back to `is_member_of`).

## 2. Canonical contract (BACKEND posts these typed stubs FIRST — FE builds against them)

Per CLAUDE.md §Lead protocol (contract-first), `backend` commits the **signatures** below as typed
stubs in `src/lib/queries/**` + the relevant `actions.ts` BEFORE implementing, so `frontend` builds
in parallel against real types.

### 2.1 Data model (migration, additive)

```sql
-- NEW: per-case ACL
create table public.case_access (
  case_id    uuid not null references public.cases(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  level      text not null check (level in ('read','write')),  -- write implies read
  granted_by uuid references public.profiles(id),
  granted_at timestamptz not null default now(),
  primary key (case_id, user_id)
);

-- case_narratives: single assignee + minimal lifecycle (ADR 0033 D5)
alter table public.case_narratives
  add column assigned_to  uuid references public.profiles(id),
  add column status       text not null default 'aberta' check (status in ('aberta','concluida')),
  add column concluded_at timestamptz,
  add column concluded_by uuid references public.profiles(id);
```

### 2.2 Predicates / helpers (`app` schema, DEFINER, uid-pure — mirror `can_read_event`)

- `app.can_read_case(p_case uuid, p_uid uuid) returns boolean`
- `app.can_write_case_content(p_case uuid, p_uid uuid) returns boolean`
- `app.can_write_case_narrative(p_narrative uuid, p_uid uuid) returns boolean`
  (= coordinator/admin OR `assigned_to = uid` OR (`can_write_case_content` AND `assigned_to IS NULL`))
- `public.case_viewer_capabilities(p_case uuid) returns jsonb` — DEFINER TS-layer read returning
  `{ can_read, can_write_content, can_manage_lifecycle }` for `auth.uid()` (mirror
  `interview_viewer_can_write`).

### 2.3 RPCs (all gate `case_access`; DEFINER unless noted)

**New — grants** (`staff_admin`/admin only; target must be a member → `HC021`):
- `public.grant_case_access(p_case uuid, p_user uuid, p_level text) returns void` — upsert.
- `public.revoke_case_access(p_case uuid, p_user uuid) returns void`.

**New — narrative attribution + lifecycle** (case non-terminal; freeze window via
`app.in_narrative_rpc`):
- `public.assign_narrative(p_narrative uuid, p_assignee uuid) returns void` — coordinator; member
  check (`HC021`); narrative `aberta` (`HC055`).
- `public.unassign_narrative(p_narrative uuid) returns void` — coordinator.
- `public.save_narrative_body(p_narrative uuid, p_body_md text) returns void` — auth =
  `can_write_case_narrative` (else 42501); `aberta` + case non-terminal (`HC054`/`HC055`).
  *(Generalizes the existing `update_case_narrative_body`; keep the old name as a thin alias if
  simpler.)*
- `public.conclude_narrative(p_narrative uuid) returns void` — assignee or coordinator; `aberta`→
  `concluida`, stamp `concluded_*`, freeze (`HC055`).
- `public.reopen_narrative(p_narrative uuid) returns void` — coordinator; `concluida`→`aberta`.

**New — read**:
- `public.list_my_cases(p_commission uuid) returns jsonb` — DEFINER; cases where `auth.uid()` is
  attributed (phase/narrative assignee) **or** has a `case_access` row; each row →
  `{ case_id, case_number, label, status, my_role: 'viewer'|'collaborator'|'coordinator',
  items: [{ kind:'phase'|'narrative', id, title, status, display_position, actionable:boolean }] }`.

**Modified**:
- `public.get_case_detail(p_case uuid)` — gate `is_staff_admin_of` → `can_read_case`; add
  `viewer_capabilities` + per-narrative `assigned_to`/`status`; **answers stay submitted-only**;
  emit `case.opened` audit when the caller is not a coordinator.
- Content writes broaden `staff_admin` → `can_write_case_content`: `create/update_action_item`,
  `advance/complete_action_item` (assignee-or-writer), `case_documents` insert + soft-delete,
  `assign/unassign_case_tag`, `case_events` create/edit/delete. **Tag/outcome *vocabulary* CRUD and
  all lifecycle stay coordinator-only.**
- `log_audit_access` allow-list gains `case.opened`.

### 2.4 RLS

- `cases_select`, `case_phases_select`, `case_narratives_select`, and the child-table SELECTs
  (`case_action_items`, `case_documents`, `case_events`, `case_tags`(+assignments),
  `case_offered_outcomes`) → `app.can_read_case(... , auth.uid())`. *(Interviews deferred — D2.)*
- `case_access` — SELECT `staff_admin`/admin + self; **no** INSERT/UPDATE/DELETE policy (DEFINER-only).
- Narrative/content base WRITE policies stay `staff_admin`-write; staff writes flow through the
  DEFINER RPCs (which re-check `can_write_case_narrative` / `can_write_case_content`), mirroring the
  meetings/interviews pattern.

### 2.5 TS layer (`backend`-owned)

- `src/lib/queries/cases.ts`: `listMyCases(commissionId)`, `getCaseDetail` return type gains
  `viewerCapabilities`; types `CaseViewerCapabilities`, `MyCase`, `MyCaseItem`.
- `src/lib/case-access/actions.ts` (new): `grantCaseAccess`, `revokeCaseAccess`.
- `src/lib/case-narratives/actions.ts`: `assignNarrative`, `unassignNarrative`, `saveNarrativeBody`,
  `concludeNarrative`, `reopenNarrative`.

## 3. Backend tasks (`backend`)

| # | Task | Depends | Plan review |
| - | ---- | ------- | ----------- |
| BE-1 | **Post the §2 contract** as typed stubs (queries + actions + types) and commit, unblocking FE. | — | one-line ack |
| BE-2 | Migration: `case_access` table + `case_narratives` columns + `case_access` flag (OFF) + new SQLSTATEs (`HC055`+). | BE-1 | **full** (new table + flag) |
| BE-3 | Predicates `can_read_case` / `can_write_case_content` / `can_write_case_narrative` + `case_viewer_capabilities`; **RLS tighten** (§2.4) with the OFF-flag permissive fallback. | BE-2 | **full** (new RLS shape) |
| BE-4 | RPCs: grants, narrative attribution+lifecycle, `list_my_cases`; `get_case_detail` re-gate + capability/narrative fields (submitted-only preserved); content-write broadening. | BE-3 | **full** (DEFINER read-path) |
| BE-5 | Audit: `case.opened` in `log_audit_access` + emit on non-coordinator `get_case_detail`; curated PHI-free mutation triggers for `case_access` + narrative assign/conclude. | BE-4 | one-line ack (mirrors Rule 11) |
| BE-6 | Flag flip `case_access` → ON; regen `database.ts`; pgTAP (predicate truth-table, RLS boundary, narrative lifecycle, Q14, flag-OFF fallback, audit allow-list, PHI-free). Seed personas (attributed + granted cases). | BE-5 | one-line ack |

## 4. Frontend tasks (`frontend`) — build against the frozen §2 contract

| # | Task | Depends |
| - | ---- | ------- |
| FE-1 | Nav: "Minhas fases" → "Meus Casos" in `app-sidebar.tsx` (count = `listMyCases`); redirect `/c/[slug]/minhas-fases` → `/c/[slug]/meus-casos`. | BE-1 |
| FE-2 | `/c/[slug]/meus-casos/page.tsx` + `MyCaseCard` (header + role chip + inline item list with Preencher/Abrir/Concluir + "Ver caso completo"). | BE-1 |
| FE-3 | **Capability-gate the case-detail component**: thread `CaseViewerCapabilities` through the existing detail components (lifecycle/assignment hidden unless `canManageLifecycle`; content editors shown for `canWriteContent`; read-only otherwise). Mount at staff route `/c/[slug]/casos/[caseId]`; keep `/manage/...` on the same component with full caps. | BE-1 |
| FE-4 | Focused narrative editor page `/c/[slug]/casos/[caseId]/narrativa/[narrativeId]` (Markdown + Salvar + Concluir); reuse the inline narrative editor for browsing writers on the detail page. | BE-1 |
| FE-5 | **Access panel** on the detail page (coordinator-only): member roster with read/write toggles + revoke; narrative-assignment control. | BE-1 |
| FE-6 | Flag-gate everything via `case_access`; empty/edge states (no accessible cases; read-only banners); `npm run lint` + `npm run typecheck` clean. | FE-1..5 |

## 5. Tester — acceptance criteria (E2E `chromium` + pgTAP)

1. **Attribution → read:** an assigned-phase staff member opens the full case (read-only) and sees
   other phases' **submitted** answers + narratives; sees **no** in-progress draft of others.
2. **Restrictive boundary:** a member with no attribution + no grant gets `notFound()` on the case
   detail and the case is absent from "Meus Casos".
3. **Grant read / write:** coordinator grants read (viewer; editors hidden) and write (collaborator
   can edit an *un-attributed* narrative + action items/docs/tags; cannot run lifecycle; cannot fill
   a phase they don't own). Revoke removes access.
4. **Q14 ownership:** a write-grantee **cannot** edit/conclude a narrative attributed to someone
   else; the assignee can.
5. **Meus Casos:** unified list (attributed + granted); per-case card; "Preencher" (phase) and
   "Abrir"/"Concluir" (narrative) and "Ver caso completo" all work; multi-item case shows one card.
6. **Narrative lifecycle:** assignee fills via the focused editor, concludes (frozen), coordinator
   reopens.
7. **PHI boundary:** a case read-grantee sees the linked safety event's PHI-free chip but
   click-through to event detail is denied unless custodian/PQS.
8. **Audit:** opening a case as a non-coordinator writes a `case.opened` access row; coordinator
   opens do not.
9. **Flag OFF:** with `case_access` OFF, behavior is unchanged (coordinator-only detail; no grant UI).
10. **Keyboard-only** flow through Meus Casos → narrative editor (one per increment, §8 a11y).
11. **Full regression** suite green to declare done (§6 gate).

## 6. QA scope

Requirements audit vs ADR 0033 + this plan; **RLS review** of the tightened SELECTs + the three
predicates (truth-table coverage, no anon/PUBLIC leak, OFF-flag fallback); confirm submitted-only
answer projection and PHI isolation are preserved; verdict to `docs/reviews/`.

## 7. Risks & ripples

- **Read ripples (D2):** audit every member-facing path that reads case data — `meeting_cases`
  labels, case references in meetings/timeline — for `can_read_case` tolerance (show "restrito" or
  omit). Enumerate during BE-3.
- **`get_case_detail` regression surface:** it currently carries outcomes + blocks + narratives
  (ADR 0024/0032 finals); re-gating must preserve every existing field + the submitted-only rule.
- **Performance:** `can_read_case` runs per-row on tightened SELECTs; keep it index-friendly
  (`case_phases_assigned_to_idx` exists; add a `case_narratives(assigned_to)` + `case_access`
  PK covers grants).
- **Test-harness debt** (carried from case-narratives): run the gate on a **prod build** (see
  memory `e2e-gate-prod-build`); the ≤13 flaky regression specs need the `reducedMotion` + DB
  isolation fix — fold in if it blocks green.

## 8. Sequencing & gate

Contract-first: **BE-1 first** (unblocks all FE). Then BE-2→BE-6 serial (migration → predicates/RLS
→ RPCs → audit → flag/seed); FE-1..5 in parallel off BE-1, FE-6 last. `backend` and `frontend` own
disjoint files (no overlap — `app-sidebar.tsx`, pages, components = FE; migrations, `lib/queries`,
`lib/**/actions.ts`, types = BE). Tester spawned when the dev server runs green locally; QA after
tester green. Then human approval, then §6 Record (PROGRESS.md → ✅, `docs/backend-state.md` update,
archive task detail, commit `feat(case-access): …`).
