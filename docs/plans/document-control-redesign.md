# Controlled Documents — Frontend Redesign + Feature Gaps · Implementation Plan

**Branch:** `feat/document-control-redesign` (worktree `worktrees/feat/document-control-redesign/`, dev port 3000)
**Source design:** [`docs/design/temp/document_control_frontend.md`](../design/temp/document_control_frontend.md) (prototype handoff — "Concord Review"; a *different* design system we translate, not adopt verbatim).
**Redesigns:** the shipped **Phase 17 — Controlled-Document Lifecycle** ([record](../progress/phase-17.md); ADR [0057](../decisions/0057-indicators-doc-control-replan.md)). Flag `controlled_docs`, prod-OFF until the pilot.
**New ADR to write at build start:** **0081 — Controlled-Document Redesign + Reviewer Notifications** (create-flow change, schema additions, notification wiring, retire/supersede distinction, **enum-key anglicization** — extends ADR [0069](../decisions/0069-status-key-anglicization.md)'s deliberately-deferred scope for this module).
**PHI:** none (Rule 12 N/A) — unchanged.

## Decisions locked (PO interview, 2026-07-21)

1. **Create flow → all-in-one wizard.** One guided flow (Details → Document/file → Reviewers → Confirm) whose final step submits for review; a **Save as draft** exit is kept. No new atomic RPC required — a server action chains the existing `create → attach-file → submit` RPCs.
2. **Build all four feature gaps:** approver **notifications + Remind**, version **compare** view, **category + tags**, **retired vs superseded** distinction.
3. **Register → full adopt:** KPI strip + filter chips + search + table rows with the approval-progress bar.
4. **Process → full Phase Gate** (§6): backend contract-first → frontend → tester E2E → QA review → human approval → record.
5. **Anglicize the residual controlled-docs enum keys** (`doc_type`, `decision`) in this work — free in the reset-OK pre-pilot window, per ADR [0069](../decisions/0069-status-key-anglicization.md)'s exact method; recorded in ADR 0081. Labels stay pt-BR (Rule 10). **Scope = the controlled-docs module only.** Platform-wide residual enums in other modules (`classification`/`role`/`kind`/…) stay **out of scope** — a separate initiative if wanted.

## Reconciliations already decided (not open)

- **Keep the platform's localized vocabulary.** Doc types stay `politica/pop/protocolo/regimento/manual/outro`; statuses stay `draft → in_approval → effective → obsolete`. The doc's generic `protocol/charter/sop/guideline` and `draft/review/approved/revision/superseded/retired` are the prototype's set — we map the doc's UI concepts onto ours (e.g. the doc's "In review" = `in_approval`/*Em aprovação*; "Effective" = `effective`/*Vigente*; "Under revision" = an open `draft` over an `effective` version — a **derived** filter, not a new status; "Archived" = `obsolete`).
- **Keep the existing `DOC-####` code scheme** (per-commission mint; referenced by `commission_charters.controlled_document_id`). No per-type prefix change.
- **Enum-key language:** all identifiers (tables/columns/RPCs) are already English; **status** keys were Anglicized by ADR [0069](../decisions/0069-status-key-anglicization.md) (`draft/in_approval/effective/obsolete`). The two **non-status** enum *values* left pt-BR by that ADR — `doc_type` (`politica/pop/…`) and approval `decision` (`aprovado/rejeitado`) — **are Anglicized by this work** (decision 5 / task **B0**). All new enums (e.g. `obsolete_kind`) are English. **Labels stay pt-BR** (Rule 10) regardless.
- **Drop the doc's 3-theme system** (calm/command/ledger). This platform ships light/dark only; the doc's "calm" ≈ our default. **Typography needs no change** — both use the IBM Plex trio.
- **Ship one density** (comfortable) and the wizard layout only — do **not** build the doc's design-time "tweak" preference system (density toggle, wizard/single-form toggle).

---

## 0. Scope at a glance

| Area | Today | Target | Owner |
| --- | --- | --- | --- |
| Create flow | staged: header-only draft → detail: add file → detail: name approvers + submit | **all-in-one 4-step wizard** ending in submit; Save-as-draft exit | FE + BE (chained action) |
| Register | dropdown filters + stacked cards | **KPI strip + filter chips + search + table** + approval-progress bar | FE |
| Detail | single column; per-version summary only | two-column + **right-rail cards** + **version compare modal** + **Remind** + retire/supersede chip | FE |
| Reviewer picker | `<select>` + add | **member-card grid** (multi-select) | FE |
| File upload | plain `<input type=file>` | **drag-drop dropzone** | FE |
| Category / tags | absent | new columns + register filters | **BE** + FE |
| Retire vs supersede | both → `obsolete` | recorded `obsolete_kind` + displayed | **BE** + FE |
| Notifications | none wired | notify-on-submit, review-due/expiry, **Remind** | **BE** + FE |

---

## 1. Design-system translation (doc `mm.css` → platform tokens)

The handoff is written against `mm.css` tokens; every one maps to an existing semantic token — **never** import IBM Plex CDN, `mm.css`, or the theme classes.

| Doc token / concept | Platform equivalent |
| --- | --- |
| `--accent` / `--accent-soft` | `bg-primary` / `bg-accent` (calm blue `#1f5c9e`) — keep it precious |
| `--st-closed` (Effective/green) | `text-success` / `bg-success/12` |
| `--st-review` (In review/purple) | our in_approval chip tone (keep current) |
| `--st-action` (Under revision/amber) | `text-warning` / `bg-warning/12` |
| `--st-screen` / `--ink-3` (Draft/Superseded) | `text-muted-foreground` / `bg-muted` |
| `--sev-death` (danger) | `text-destructive` |
| pills 999px / cards 12–14px | `rounded-full` / `rounded-2xl` (`--radius`) |
| `.tnum` | already global (`font-feature-settings: "tnum"`) |
| Stepper / Dropzone / ReviewerPicker / TagField / Segmented | build as new **token-based** shared components (see §3) |

**Cleanup folded in:** replace the two hardcoded emerald spots (`document-badges.tsx:22` effective chip; `approvals-panel.tsx:83` aprovado badge) with `text-success`/`bg-success` tokens.

---

## 2. Backend workstream (contract-first — lands before FE)

### B0 · Enum-key anglicization (controlled-docs module only; lands FIRST, coupled with B1/B2 as one migration set)
Rename the two residual pt-BR enum keys **1:1** (semantics identical), following ADR 0069's D11 method. Keys change; **pt-BR labels are unchanged** (`DOC_TYPE_LABELS`/`APPROVAL_DECISION_LABELS` keep their pt-BR *values*, only their *map keys* change).

**Dictionary** (label in parens, unchanged):
- `doc_type`: `politica → policy` (Política) · `pop → sop` (POP) · `protocolo → protocol` (Protocolo) · `regimento → bylaws` (Regimento) · `manual → manual` (Manual, already English) · `outro → other` (Outro).
- `decision`: `aprovado → approved` · `rejeitado → rejected`.
- **Confirmed (PO, 2026-07-21):** `pop → sop` and `regimento → bylaws` (chosen over `charter` to avoid name overlap with the `commission_charters` *feature*, a different domain object). The other four are unambiguous transliterations.

**Method (per ADR 0069 — the failure mode is a *missed literal*):**
- Rewrite CHECK constraints, column defaults, and **function bodies** that write/compare these literals — `create_/update_controlled_document` (`p_doc_type`), `publish_document` (checks all `= 'aprovado'`), `approve_/reject_document` (write `aprovado`/`rejeitado`), `submit_document_for_approval`, `hospital_document_register` / `documents_due_for_review` (type filters). **Re-emit each DEFINER body from live `pg_get_functiondef`** (Risks).
- **Function/module-scoped `replace`, never blanket** — `aprovado`/`rejeitado` and words like `regimento` may appear in *other* modules' enums or in charter code; a global replace is unsafe (ADR 0069 §Decision). **Sweep the whole codebase** for these literals but change only controlled-docs-scoped occurrences: notably `commission_charters` code that creates/filters `regimento`-type docs, and the frontend `?docType=` prefill + filter-chip values + `DocType`/`ApprovalDecision` TS unions + label-map keys + seed + pgTAP fixtures.
- Regenerate types after.

### B1 · Migration — schema additions (next-dated)
- `controlled_documents`: add `category text NULL`, `tags text[] NOT NULL DEFAULT '{}'`.
- `controlled_document_versions`: add `obsolete_kind text NULL CHECK (...)` — **value language per O4** (recommend English `'superseded'|'retired'`); add `proposed_effective_date date NULL` (the wizard's "proposed effective date", defaulted into `publish_document`). *(Optional — see Open decision O2 — `approval_due_date date NULL` for the reviewer-response deadline that feeds the Remind/overdue-approval reminder.)*
- RLS: new columns ride existing table policies (no new policy). Audit AFTER-triggers: `category`/`tags` are low-sensitivity metadata like `title` — keep them **out of the audit payload** (mutation still emits a row); never audit bodies (unchanged posture).
- Regenerate `src/lib/types/database.ts` (Rule 8).

### B2 · RPC updates (⚠ re-emit each DEFINER body from live `pg_get_functiondef`, not migration text — see Risks)
- `create_controlled_document` / `update_controlled_document`: accept `p_category`, `p_tags`.
- `publish_document`: when it retires the prior effective version, stamp `obsolete_kind='superseded'`; default `p_effective_date` from the version's `proposed_effective_date` when the caller omits it.
- `supersede_document`: unchanged logic; the eventual publish stamps `superseded` (above).
- `mark_document_obsolete`: stamp the retired version `obsolete_kind='retired'`.
- `submit_document_for_approval`: persist `proposed_effective_date`/`approval_due_date` on the version if collected; **enqueue an approver notification per named approver** (see §4).

### B3 · New app-layer action (no new RPC) — the all-in-one create
- `createAndSubmitDocument(payload)` in `src/lib/documents/actions.ts`: `create_controlled_document` → `uploadDocumentFile` → `set_document_version_file` → `submit_document_for_approval`. Return the new document id for the redirect to its detail.
- `createDraftOnly(payload)`: create (+ optional file), no submit — the "Save as draft" exit.
- **Partial-failure UX:** any step after create fails → land the user on the created draft's detail with a mapped pt-BR banner explaining what to finish (the draft is recoverable; nothing is lost). Reuse `mapDocumentError`. *(If this proves rough in testing, promote to a single orchestration RPC in a follow-up — noted, not built now.)*

### B4 · Reads & filters
- `listDocuments`: add `category` + `tags` to `DocumentListFilters`; return `category`/`tags`/`obsolete_kind` on the list item.
- **KPIs** computed in the register **server component** from the already-fetched list (counts by status + overdue) — no new RPC.
- **Compare** needs no backend — the detail bundle already returns all versions + approvals.
- Any **new public RPC** (e.g. `remind_document_approver`, §4) → `REVOKE ALL ON FUNCTION … FROM PUBLIC` before `GRANT` (t19 guard).

---

## 3. Frontend workstream (all on platform tokens/shadcn; Server-first)

### New shared components (token-based, reduced-motion-safe, keyboard-first)
- **`Stepper`** — 4-step header, `aria-current="step"`, visited-steps clickable (gated by max-reached), connector lines shrink so it never bleeds into the rail.
- **`Dropzone`** — drag-drop over the existing file input; filled-state file card (glyph + mono name + size + Remove). Keyboard/click still opens the native picker.
- **`ReviewerPicker`** — member-card grid (avatar + name + role + check), multi-select, replaces the current `<select>`+add; per-approver editable *Cargo*. Sourced from `listApproverCandidates`.
- **`TagField`** — chip input (Enter to add, × to remove).
- **`Segmented`** — inline segmented control (version increment Major/Minor; reused where the doc uses it).
- **`ChecklistRail`** — "Pronto para enviar" progress + "Como funciona a aprovação" explainer.

### F-A · Register / library (`manage/documentos/page.tsx` + components)
- **KPI strip** (4 cards): Documentos controlados · Aguardando aprovação · Vigentes · Em revisão/rascunho (+ overdue accent). Reuse the dashboard KPI card pattern; stagger `--rise-delay`.
- **Filter chips** replace the dropdowns: `Todos · Aguardando aprovação · Vigentes · Rascunhos · Em revisão · Arquivados`; URL-driven; "Em revisão" = derived (open draft over effective), "Arquivados" = `obsolete`.
- **Search box** — title/code filter (URL param).
- **Table grid** (Documento · Comissão/Categoria · Versão · Situação/aprovação · chevron) with truncation (`minWidth:0` + `overflow:hidden`), zebra rows, whole-row link. `in_approval` rows show the **approval-progress mini-bar** (`signed/total`, amber if any rejection). Surface `category` + `tags`.

### F-B · Create / new-version wizard (`novo/` + supersede entry)
- **`CreateWizard`** client component, 4 steps + sticky `ChecklistRail`; server page loads candidates/prefill and binds the server actions (WizardRunner boundary pattern — client imports `src/lib/**` type-only).
  - **Step 1 Details** (create mode): Título*, Tipo (`Segmented`), Categoria, Ciclo de revisão (meses), Descrição, Tags (`TagField`). Committee is **implicit** from the route — no selector. Código shown read-only.
  - **Step 1 Details** (newversion mode): **locked identity** panel + "Você está criando a v{next}; ao aprovar substitui a v{current}" callout.
  - **Step 2 Document**: `Dropzone`* (PDF/DOCX ≤25 MB), version increment `Segmented` (newversion), proposed effective date, change-summary* (`Textarea` markdown).
  - **Step 3 Reviewers**: `ReviewerPicker`* (≥1), review/approval due date, read-only "Aprovação unânime".
  - **Step 4 Confirm**: summary + attached-file echo + reviewers + change summary.
- Footer: Cancelar · Voltar · Continuar (per-step validity gating) · **Enviar para aprovação** (terminal) + **Salvar rascunho**.
- Motion: step cross-fades via `animate-fade-in`; focus moves to the new step heading each transition.

### F-C · Detail (`[documentId]/page.tsx`)
- Two-column: **left** version history (`VersionCard`s, newest-first, current one accent-bordered), **right rail** = *Detalhes do documento* card (ID/type/committee/category/owner/effective/next-review/tags) + *Documento controlado* info card (the three read-only guarantees).
- **Compare**: a select-toggle on each `VersionCard`; exactly 2 selected enables **Comparar** → **`CompareModal`** (metadata + change-summary side-by-side, changed "After" cells highlighted). Pure client over loaded data; **focus-trapped** dialog.
- **Remind**: on pending approvers of the current version → calls `remind_document_approver` (§4). Rate-limit copy ("Lembrete enviado").
- Obsolete versions show a **retired vs superseded** chip from `obsolete_kind`.

### F-D · Approver sign page + queue (`documentos-pendentes/**`)
- Restyle to match; give the sign page the same file panel + approvals roster. **Notification deep-links** land here (and on detail).

### F-E · Token cleanup
- The two hardcoded-emerald fixes (§1).

---

## 4. Notifications workstream (Phase-20 substrate — currently zero doc integration)

- **Extend the enums** (`src/lib/queries/notifications.ts` + producer SQL): `NotificationKind += 'document_approval' | 'document_review_due'`; `NotificationEntityType += 'controlled_document_version' | 'controlled_document'`. ⚠ shared contract — coordinate with any in-flight notifications work.
- **Producers:**
  - *Submit* → one notification per named approver ("Documento {code} aguarda sua aprovação"), deep-linking to the sign page. Inside `submit_document_for_approval`.
  - *Decision / publish* (optional, low cost) → notify author/staff_admin of approve/reject and of *vigente*.
  - *Review-due / expiry* → a **scan arm** modeled on `charter_notifications.sql` / `action_item_reminder_scan_arm.sql`, reusing `documents_due_for_review`, enqueuing to the doc's staff_admin.
  - *Remind* → `remind_document_approver(p_version_id, p_approver_id)` DEFINER, **staff_admin-gated**, re-enqueues to a still-pending approver (REVOKE-FROM-PUBLIC first).
- **Frontend:** `NotificationBell` already renders; add link routing for the two new entity types.

---

## 5. Sequencing & file ownership

**Waves (contract-first):**
1. **Backend** — **B0 anglicization** (coupled with) → B1 migration → B2 RPCs → B4 reads/filters → §4 producers + Remind RPC → regen types → pgTAP. B0 rewrites the same function bodies B2 edits, so land them as one coherent migration set (one re-emit-from-live pass). *Freeze `src/lib/documents/types.ts` + `database.ts` before FE starts.* FE picks up the English `DocType`/`ApprovalDecision` unions + label-map keys from the frozen types.
2. **Frontend** — shared components → F-A register → F-B wizard → F-C detail+compare → F-D sign/queue → F-E cleanup, against frozen types.
3. **Gate** — tester E2E + full `e2e:prod` green → QA review → human approval → record.

**File ownership (binding — no two teammates share a file in a wave):**
- **backend:** `supabase/migrations/**`, `src/lib/queries/documents.ts`, `src/lib/documents/{actions,types}.ts`, `src/lib/notifications/**` + `src/lib/queries/notifications.ts`, generated `database.ts`, pgTAP `supabase/tests/**`.
- **frontend:** `src/app/o/[org]/**/documentos*/**`, `src/app/o/[org]/documentos-pendentes/**`, `src/components/documents/**`, new `src/components/ui/**` composites.
- **tester:** `e2e/*document*` specs. **qa:** `docs/reviews/document-control-redesign-review.md`.

---

## 6. Test plan (Phase Gate §6)

**E2E (Playwright, incl. one keyboard-only pass):**
- All-in-one wizard: Details→file→reviewers→confirm→**submit** creates a doc **already in `in_approval`**; **Save as draft** exits at `draft`; per-step validity gating.
- Register: KPI counts reflect data; chips filter (incl. derived "Em revisão" + "Arquivados"); search; table + approval-progress bar; category/tags filter.
- Detail: select two versions → CompareModal shows the diff; **Remind** enqueues a notification the approver receives; obsolete chip distinguishes superseded vs retired.
- Notifications: notify-on-submit reaches the named approver; review-due scan enqueues to staff_admin.
- **Regression (must stay green):** approver isolation + no-leak, publish-all-must-sign gate, reject→resubmit, supersede retains + downloads prior, immutable per-version paths, foreign-hospital HC091, hospital register scope, audit no-leak, flag gate.
- a11y: `aria-current` stepper, focus moves between steps, CompareModal focus-trap, labelled controls.

**pgTAP:** new-column RLS/scoping; `obsolete_kind` set correctly by publish (superseded) vs mark-obsolete (retired); notification enqueue rows on submit + review-due; `remind_document_approver` authority (staff_admin only) + REVOKE-FROM-PUBLIC; `proposed_effective_date` defaulting in publish. **B0 anglicization:** NEG/POS on the renamed CHECK values (old pt-BR key rejected, new English key accepted) for `doc_type` + `decision`; the full lifecycle still drives to `effective` with English `decision` keys; a whole-project `tsc` + the E2E gate are the missed-literal backstop (ADR 0069's caught-3-stale-assertions lesson). **UI still renders pt-BR labels** — assert a chip/badge shows *Protocolo*/*Aprovado*, not the key.

**Declare green** via `npm run e2e:prod` on a fresh `supabase db reset` (memory: e2e-gate-run-mechanics; run the full suite from the lead's background Bash).

---

## 7. Open micro-decisions (resolve at build start; low-stakes)

- **O1 · Category vocabulary** — free-text `category` with autocomplete from existing values (pragmatic, recommended) **vs** a seeded controlled list per org (adds a management surface). *Lean: free-text now.*
- **O2 · Reviewer-response deadline** — add `approval_due_date` that feeds the Remind/overdue-approval reminder (ties the doc's "Review due date" step to something real) **vs** drop that field. *Lean: add it — it makes Remind and the overdue-approval reminder meaningful.*
- **O3 · Notify on decision/publish** — include the low-cost author/staff_admin notifications, or ship only submit + review-due + Remind first. *Lean: include; they're cheap once the producer exists.*
- **O4 · RESOLVED (decision 5 / B0)** — new enums are English (`obsolete_kind = 'superseded'|'retired'`), and the residual pt-BR `doc_type`/`decision` keys are Anglicized in this work. All renames confirmed by PO: `pop → sop`, `regimento → bylaws`.

---

## 8. Deferred / explicitly out of scope

- **True document-body text diff** (PDF/DOCX text extraction) — CompareModal covers metadata + change-summary only.
- **Scheduled / future-dated effective activation** — effective is set at publish; `proposed_effective_date` is a default, not a scheduler.
- **Expiry auto-obsolete enforcement** — `expiry_date` stays display + review-due-feed; no auto-transition.
- **In-browser document preview/viewer** — download-to-review stays (approver flow unchanged).
- **Design-time tweak preferences** (density, wizard/single toggle) — ship wizard + comfortable.

---

## 9. Risks & keystone cautions (from project memory / ADR 0078 lessons)

- **⚠ Re-emit every edited DEFINER body from live `pg_get_functiondef`** (publish/supersede/submit/mark-obsolete), never from stale migration text — else a create-or-replace silently reverts intervening patches (memory: `re-emit-definer-body-from-live-def`).
- **⚠ Every new `public.*` RPC** (`remind_document_approver`) — `REVOKE ALL FROM PUBLIC` before `GRANT`, or the t19 pgTAP guard fails (memory: `new-public-rpc-revoke-from-public`).
- **Schema truth = live catalog / generated types**, never migration file text (graphify does not index SQL; some bodies are rewritten at runtime).
- **Notification enum changes are a shared contract** — a concurrent notifications change could collide; serialize.
- **Chained create action is not transactional** across storage + DB — the partial-failure UX (B3) is the mitigation; escalate to an orchestration RPC only if testing shows it's needed.
- Prod flag `controlled_docs` stays **OFF until the pilot** (unchanged); this redesign rides the same flag and the same deferred remote `db push`.
