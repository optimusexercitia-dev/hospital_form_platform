# QA Review — Case Narratives Increment

**Date:** 2026-06-19
**Reviewer:** qa (QA Reviewer)
**Tester reported:** 270/270 E2E green (new `e2e/case-narratives.spec.ts` 16/16)
**Verdict: CHANGES REQUESTED**

---

## Summary

The Case Narratives increment is architecturally sound and well-executed across
most surfaces. The migrations, RLS, audit triggers, freeze guard, display_position
backfill, `create_case_from_template` replace, `get_case_detail` replace, the TS
data layer, and the frontend components all conform to the plan and the
architecture rules. One blocking functional bug was found in the settings UI that
causes every edit of a narrative type to silently fail, and one UX gap was found in
the `NarrativeSlotCard` accessibility. These are the only items requiring changes
before approval.

---

## Checklist Results

### 1. RLS on All Three New Tables

**PASS.** All three tables — `case_narrative_types`, `process_template_narratives`,
`case_narratives` — have RLS enabled
(`supabase/migrations/20260619100000_case_narratives_core.sql`, lines 64, 92, 128).
Policies follow the established pattern exactly:
- `SELECT` using `app.is_member_of(<commission>) or app.is_admin()`
- `FOR ALL` using/with check `app.is_staff_admin_of(<commission>) or app.is_admin()`

Commission resolution reuses the existing `app.commission_of_template` and
`app.commission_of_case` DEFINER helpers — no new RLS helper introduced, no gap.
Foreign-commission isolation is enforced both by RLS (commission resolved from the
row's parent) and by the `app.guard_template_narrative_type` INSERT guard (HC054
on a type/template commission mismatch). The pgTAP suite (test 4) explicitly
confirms a cross-commission staff member reads 0 rows from the other commission's
`case_narrative_types`.

### 2. Audit — body_md / title / instructions Exclusion

**PASS.**
`supabase/migrations/20260619100003_case_narratives_audit_triggers.sql` defines
three AFTER triggers, each SECURITY DEFINER with a pinned `search_path`. The
curated allow-lists are:
- `case_narrative_types`: `[label, position, archived]` — `description` excluded.
- `process_template_narratives`: `[display_position, narrative_type_id, is_expected]` — `title` and `instructions` excluded.
- `case_narratives`: `[type_label, display_position, is_expected]` — `body_md`, `title`, `instructions` all excluded.

The pgTAP test at `supabase/tests/116_case_narratives.sql`, test 11, asserts that
after a body save the `audit_log` rows for that `entity_id` do not contain the
literal body text, the key `body_md`, the key `title`, or the key `instructions`.
This is a genuine, non-trivial assertion — not just a metadata-not-null check.
Architecture Rule 11 is satisfied.

### 3. PHI Posture (Rule 12 / ADR 0030)

**PASS.** Case Narratives is correctly classified as a non-PHI module (ADR 0032,
decision 4). `body_md` is de-identified governance prose; the placeholder in
`CaseNarrativeCard` reads "Nunca inclua dados de paciente." (line 136 of
`case-narrative-card.tsx`). The `NarrativeSlotDialog` instructions field
placeholder also instructs "Mostradas ao coordenador ao redigir esta narrativa no
caso." — no PHI guidance needed there, but the authoring card carries the explicit
patient-data warning. `body_md` IS returned by `get_case_detail` — this is correct
and explicitly documented in both the plan and ADR 0032 (it is de-identified prose
for the coordinator, consistent with `case_events.body`; only the audit log
excludes it). The feature does not introduce any PHI; Rule 12 safeguards are
therefore not triggered by this increment. No `event_patient`-style PHI table is
added.

### 4. Freeze-on-Close and Backfill Guard

**PASS.** `app.guard_case_narrative_frozen` is a BEFORE INSERT/UPDATE/DELETE
trigger on `case_narratives`. It:
- reads the parent case status via SECURITY DEFINER (so RLS on `cases` is bypassed correctly for the guard's internal read);
- allows INSERT/UPDATE/DELETE if status is null (cascade delete in progress) or if `app.in_narrative_rpc = 'on'`;
- raises HC054 with pt-BR text if the case is `concluido` or `cancelado`.

The `case_phases` display_position backfill is correctly wrapped in
`app.in_case_rpc='on'` (migration lines 153–160), resolving the one known
collision risk. `process_template_phases` is unguarded and uses a plain UPDATE. The
pgTAP test 12 explicitly exercises the freeze path: concludes a case then asserts a
body write raises HC054.

The `update_case_narrative_body` RPC (invoker, staff_admin-gated) performs its own
terminal-status check before setting `app.in_narrative_rpc='on'`, providing a
second-layer defense before the trigger runs.

### 5. Advisory-Only Close

**PASS.** `close_case` is not present in the new migrations — no changes were made
to it. The conclude dialog in `CaseLifecycleActions` computes
`expectedEmptyNarrativeLabels` (from the layout's `detail.narratives` in the
layout) and surfaces a non-blocking `role="status" aria-live="polite"` warning
panel. The proceed button (`Concluir caso`) is never disabled by the narrative
warning — only `!canConfirm` (the outcome-selection gate) can disable it.
Decision 7 is correctly implemented.

### 6. Immutability / Regression on CREATE OR REPLACE

**PASS.** The `create_case_from_template` and `get_case_detail` replacements in
migration `20260619100002` are explicit about building on the `20260614093003`
bodies. Examination confirms:
- Every prior step of `create_case_from_template` (case insert, phase loop with version pin + recommend_when validation + blocks snapshot, case_offered_outcomes snapshot, recompute_recommendations call) is preserved verbatim. The narratives snapshot is additive, flag-gated, and runs inside the existing `app.in_case_rpc='on'` window.
- `get_case_detail` is unchanged except for `display_position := coalesce(cp.display_position, cp.position)` added to each phase object and the new top-level `narratives` array. Phase ordering is still by `cp.position` (the invariant for blocks/recommend logic).

### 7. display_position Integrity

**PASS.** `display_position` is strictly separate from `position` on both phase
tables (nullable column adds; `position` is never written by the narrative RPCs).
The `reorder_case_layout_template` RPC writes both `process_template_phases` and
`process_template_narratives` in a single transaction, with a belt-and-suspenders
matched-count check. The pgTAP test (test 6) explicitly confirms phase `position`
values are unchanged (still `[1, 2]`) after the reorder that sets
`display_position` to `[1, 3]`. `mergeCaseLayout` sorts defensively with a stable
tiebreaker and tolerates gaps/duplicates. The Vitest unit tests cover the full
matrix: phases-only, narratives-only, interleaved, equal-position tiebreaker,
within-kind stable sort, gaps, input-mutation safety.

### 8. Conventions

**PASS (mostly) — two items under CHANGES REQUESTED below.**

- All user-facing strings are pt-BR; code, comments, commits are in English.
- `HC054` is the next free SQLSTATE after Phase 14's `HC043–HC053` allocation.
  The plan document's §8 records this verification.
- `body_md` is rendered exclusively through `MarkdownRenderer`; no
  `dangerouslySetInnerHTML` is present in any of the new components.
- No service-role key in the case-narratives module; `actions.ts` uses `createClient()` (cookie-based RLS-scoped client) throughout.
- No unjustified `any` — the one `as unknown as Json` at `actions.ts:547` is justified by an inline comment.
- `NarrativeTypeDialog` and `NarrativeSlotDialog` use `<label>` wrappers on all interactive inputs.
- ADR 0032 exists, records the correct decisions, and is at the next free number (`0031` is the custody-ledger ADR).
- `PROGRESS.md` reflects the increment's task table accurately.

---

## CHANGES REQUESTED — Blocking Items

### BLOCK-1 (Functional Bug): Edit narrative type always fails silently

**File:** `src/components/cases/narrative-type-dialog.tsx`, line 80
**Violated requirement:** Plan §5 ("create/rename/reorder/archive a commission's narrative TYPES"); the rename action must work.

**What's wrong:** In `edit` mode, `handleSubmit` sets the FormData key as `"id"`:
```
form.set("id", narrativeType?.id ?? "");
```
But `updateNarrativeType` in `src/lib/case-narratives/actions.ts` (line 312) reads:
```
const narrativeTypeId = String(formData.get('narrativeTypeId') ?? '')
```
The key is `narrativeTypeId`, not `id`. Every edit call produces an empty string for `narrativeTypeId`, which immediately returns `{ ok: false, error: MESSAGES.missingType }` ("Tipo de narrativa não encontrado.") before any RPC is called.

**Fix:** Change line 80 from `form.set("id", ...)` to `form.set("narrativeTypeId", narrativeType?.id ?? "")`.

This is a phase-blocking bug — the rename functionality advertised by the settings manager is non-functional.

---

### BLOCK-2 (A11y Gap): NarrativeSlotCard edit button not wired to the dialog

**File:** `src/components/process-templates/narrative-slot-card.tsx`, lines 118–125

**Violated requirement:** CLAUDE.md §8 "Every form input accessible: labels, keyboard navigation, visible focus." The `NarrativeSlotDialog` rendered by this card is never opened via the Editar button — the button sets `setEditOpen(true)` but the dialog `open` prop receives `editOpen` only in the last block (lines 158–168, inside `editable && `). Inspecting the markup: the `NarrativeSlotDialog` IS rendered and receives `open={editOpen}`, so the dialog wiring is correct. However, the `Editar` `Button` (line 121, `onClick={() => setEditOpen(true)}`) has no accessible label — unlike the remove button which has `aria-label={...}`, the edit button carries only an icon (`<Pencil aria-hidden="true" />`). WCAG 2.1 SC 4.1.2 requires a name for all interactive elements. A screen-reader user activating this button would hear "button" with no context.

**Fix:** Add `aria-label={\`Editar a narrativa ${slotLabel}\`}` to the Editar `Button` at line 121, matching the pattern of the up/down/remove buttons in the same card.

Note: while reviewing this I confirmed the dialog IS rendered (`editable &&` block at line 159), so the button's click does open the dialog correctly — only the accessible name is missing.

---

## Non-Blocking Observations (no changes required)

**OBS-1: `reorder_case_narrative_types` does not validate completeness.**
The `reorder_case_narrative_types` RPC accepts a partial `uuid[]` and simply
updates matching rows, leaving the rest at their old positions. This is consistent
with `reorder_case_outcomes` (the pattern it mirrors) and does not introduce a
security gap (RLS confines writes to the caller's commission). The reorder action
in `actions.ts` sends the full non-archived set from the client. Acceptable for v1.

**OBS-2: `get_case_detail` is a DEFINER function using `search_path = public, pg_catalog` (no `app.`).**
The `app` schema is still reachable via the `app.is_staff_admin_of` call inside —
but note `search_path` is `public, pg_catalog` (line 403 of the migration), so
`app.` must be fully qualified inside. Examining the function body: all references
to `app.*` are fully qualified. No issue.

**OBS-3: `guard_case_narrative_frozen` passes when `v_status is null` (cascade delete).**
This is intentional and correct — a null parent status means the case row has been
deleted and the `cascade` FK is cleaning up. The trigger returns without raising,
which is the correct no-op behavior for a cascade-deleted row.

**OBS-4: `SettingsTabs` receives `narrativesEnabled` as a boolean prop hard-coded to `true` at the narrativas settings page.**
`src/app/c/[slug]/manage/settings/narrativas/page.tsx` line 60: `<SettingsTabs slug={slug} narrativesEnabled />`. This is correct — the page only renders if the flag is on (the `notFound()` gate is at line 38), so passing `true` here is accurate.

---

## Verdict: CHANGES REQUESTED

Two items must be fixed before approval:

1. **BLOCK-1** — `narrative-type-dialog.tsx` line 80: `form.set("id", ...)` must be `form.set("narrativeTypeId", ...)`. This makes the rename functionality work.
2. **BLOCK-2** — `narrative-slot-card.tsx` Editar button: add `aria-label` matching the surrounding button pattern.

Both are small, targeted fixes. After these two changes the increment may be re-submitted for approval without a full re-review — the lead may approve on diff inspection.
