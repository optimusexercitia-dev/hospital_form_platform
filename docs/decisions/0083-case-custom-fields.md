# 0083 — Case Custom Fields (Template-Defined Administrative Descriptors)

**Date:** 2026-07-23 · **Status:** accepted. **Owner:** lead → backend/frontend/tester.
**Flag:** `case_custom_fields` (new, default off). **PHI:** none — administrative
references only; Rule 12 stays intact (`cases` is non-PHI outside the sanctioned
`case_patient` block). The non-PHI boundary is a **fill-time warning**, not a schema
guarantee — residual risk accepted (D4). **Relates to:** ADR
[0038](0038-case-patient-identifiers.md) (the case-attribute + atomic-create pattern this
mirrors), [0044](0044-processless-cases.md) (process-less cases — excluded here, D9),
[0060](0060-flexible-forms-foundation.md) (the form input-type vocabulary reused, D3),
[0064](0064-case-subject-generalization-participants.md) (the generalized `cases` model
this extends). **Build status:** design only — implementation is a later gated phase
(CLAUDE.md §5/§6); this ADR records the decision + the surface to build.

## Context

Commissions need a few **structured descriptor fields** on a Case that the generic
`cases` table intentionally does not model. The motivating example: Morbidade &
Mortalidade wants every case to carry a "Número da Declaração de Óbito" (death-certificate
number) as a locator/descriptor. Different committees want different descriptors, so the
field set must be **configurable per process**, not hard-coded — and captured up front, in
the "Novo caso" dialog, when the case is minted from its process template.

The create dialog already supports this exact interaction shape. `CreateCaseDialog`
(`src/components/cases/create-case-dialog.tsx`) reactively reveals a block based on the
selected template's config — today the optional PHI block, gated by
`selectedTemplate.collectsPatient` (ADR 0038). Custom fields are the same
"detect-on-select → reveal a block" mechanism, one sibling over from department /
outcomes / PHI. The template already snapshots config onto each case at creation (phases
pin `form_version_id`; offered outcomes copy into `case_offered_outcomes`), so a
snapshot-on-create field model fits the established grain.

This design was grilled to resolve the forks the one-line brief left open — the storage
model, the PHI boundary, the type menu, the value lifecycle, and the v1 surfaces.

## Decisions

1. **Dedicated case-attribute model — NOT the form/response engine.** Two new relations:
   `process_template_custom_fields` (definitions, on the template) and
   `case_custom_field_values` (per-case). Reuse only the input-type **vocabulary** + the
   `input-item` **controls** — never `responses`/`answers`. Rationale: a descriptor is a
   case *attribute* (like tags / outcomes / department), which the platform models as
   dedicated relational children — not a *submission*. Folding it into the form engine
   would make a 1–3-field header descriptor a full `response` carrying an
   `in_progress → submitted` lifecycle and surfacing in phase/response lists. Rejected.
2. **Snapshot-on-create.** Each case freezes the defs it was created with (key / label /
   field_type / options) onto its value rows, mirroring `case_offered_outcomes`. Later
   re-drafting or renaming a template field never rewrites historical cases — which is why
   the value row carries frozen copies, not just a FK to the live def.
3. **Minimal field-type subset:** `short_text`, `number`, `date`, and single-select
   (`dropdown` / `multiple_choice`). **Excluded:** `checkbox` (multi-select), `free_text`
   (long paragraph — invites narratives/PHI and is not a "descriptor"), `time`, and both
   display items (`section_text` / `image` — they collect nothing). The value is stored as
   **jsonb** so a number serializes as a JSON number, not a lexically-compared string (the
   known `value_number` pitfall). Vocabulary + per-type controls are reused verbatim from
   `src/lib/queries/forms.ts` and `src/components/responses/wizard/input-item.tsx`.
4. **Non-PHI administrative references only, enforced by a fill-time warning.** The values
   live in an ordinary case-attribute table — NOT behind the audited PHI single-door — so
   the boundary cannot be a schema guarantee. It is a **pt-BR fill-time warning** mirroring
   the existing rótulo PII warning (`LabelPiiWarning` in the create dialog). No author
   attestation. Rule 12 is unchanged: `cases` remains non-PHI outside the sanctioned
   `case_patient` block. **Residual risk accepted:** a warning is a soft boundary; a user
   could still type an identifier. The motivating field (a death-certificate *document*
   number) is an administrative reference, not a direct patient identifier. If a future
   field genuinely needs PHI, it must go through the patient module (ADR 0038), not this
   feature.
5. **Template-authored, draft-only editable.** Defs are created/edited in the
   process-template builder while the template is `status = 'draft'`, and frozen on
   publish — mirroring `collects_patient` (`CollectsPatientPicker`). staff_admin (the
   template author) holds definition authority.
6. **Captured in "Novo caso", written atomically.** When the selected **published**
   template has fields, the dialog reveals them (the `collectsPatient` pattern). Values
   submit **with** the create request (hidden inputs, like `PatientHiddenFields`) and are
   written **in the same transaction** inside the `create_case_from_template` RPC — extend
   it with a `p_custom_fields` jsonb param that both snapshots the defs and writes the
   values. (Unlike PHI, which is a *second* RPC because of its single-door, these values
   have no such constraint, so they ride the create transaction like outcomes do.) A
   **required** field **blocks creation** — extend the existing `outcomeBlocked` submit
   gate. A value that legitimately arrives late (a DO number issued after the case opens)
   is handled by marking that field optional (D7 lets it be filled later).
7. **Editable after creation, audited.** staff_admin can correct/complete values from the
   case detail via a path modeled on `update_case_meta`; every change emits an audit row
   (Rule 11).
8. **v1 surfaces = case detail + opt-in list column/filter.** Values render on the
   case-detail header cluster (`case-detail-view.tsx`, beside department / tags / outcome)
   and, for defs flagged `show_in_list`, as a column + filter in the cases list (extends
   `listCasesBoard` / `CaseBoardRow` / `cases-table` / `cases-kanban`). `show_in_list` is
   **opt-in** (default false) so a template with many fields does not bloat the table.
9. **Process-less cases get no custom fields.** There is no template to define them —
   consistent with process-less cases having no phases and no narratives.
10. **Feature-flagged** behind a new DB flag `case_custom_fields` (default off), added to
    the hand-maintained `FeatureFlags` interface and seeded on for local/E2E.

## Data model

**`process_template_custom_fields`** (definition; on the template):
`id`, `template_id` → `process_templates`, `key` (slug, unique per template — reuse
`slugifyLabel` + `shortSuffix` from `src/lib/forms/option-code.ts`), `label` (pt-BR),
`field_type` (the D3 subset), `options` jsonb (single-select only, `{code,label}[]`),
`required` bool, `show_in_list` bool, `position` int, `created_at`.

**`case_custom_field_values`** (per-case snapshot + value):
`id`, `case_id` → `cases`, `template_field_id` → `process_template_custom_fields`
(nullable — provenance only; the case does not depend on it surviving), frozen `key` /
`label` / `field_type` / `options`, `value` jsonb (nullable), `position` int,
`created_at`, `updated_at`.

**RLS (mirror existing case-attribute patterns; verify live bodies first — see
Follow-ups):**
- `process_template_custom_fields` → the `process_template_*` pattern: SELECT for members
  of the commission; write for `app.is_staff_admin_of(commission_id)`.
- `case_custom_field_values` → the `case_offered_outcomes` / `case_tag_assignments`
  pattern: SELECT via `app.can_read_case(case_id, auth.uid())`; write via
  `app.is_staff_admin_of(app.commission_of_case(case_id))`.

## The concrete surface (for the build phase)

- **Vocabulary/controls (reuse):** `InputItemType` / `INPUT_ITEM_TYPES` /
  `CHOICE_ITEM_TYPES` (`src/lib/queries/forms.ts:62-89`); the per-type control switch
  (`src/components/responses/wizard/input-item.tsx:167-260`); type metadata
  (`src/components/forms/item-type-meta.tsx`).
- **Authoring UI:** a `CustomFieldsCard` + slot dialog in
  `src/components/process-templates/template-builder-shell.tsx`, beside
  `ProcessOutcomesPicker` / `CollectsPatientPicker`; hydrate `customFields` in `mapTemplate`
  (`src/lib/queries/process-templates.ts`).
- **Create flow:** `create_case_from_template` RPC gains `p_custom_fields`;
  `createCaseFromTemplate` (`src/lib/cases/actions.ts:372-421`) reads the dialog values and
  passes them through. Dialog reveal + submit-gate in
  `src/components/cases/create-case-dialog.tsx` (mirror `showTemplatedPatientBlock` +
  `outcomeBlocked`).
- **Edit flow:** an `update_case_meta`-style RPC + action (`src/lib/cases/actions.ts:493+`).
- **Display:** `src/components/cases/case-detail-view.tsx` header cluster (~L262-492); list
  `src/components/cases/cases-view.tsx` + `cases-table.tsx` / `cases-kanban.tsx` via
  `listCasesBoard` / `CaseBoardRow` (`src/lib/queries/cases.ts`).
- **Flag:** add `case_custom_fields` to `FeatureFlags`
  (`src/lib/queries/feature-flags.ts:20-49`) + an `insert into app.feature_flags …`
  migration; seed on for local/E2E.
- **Types:** regenerate `src/lib/types/database.ts` after the migration (Rule 8); access
  only via `src/lib/queries/` (Rule 9).

## Consequences

- **Positive:** clean "case attribute" semantics; lightweight (no response lifecycle);
  reuses the field vocabulary + controls; descriptors are findable via the list
  column/filter; snapshot-on-create keeps history stable; the create flow is a near
  drop-in of an existing pattern.
- **Negative / accepted:**
  - **Dashboards are not free.** The dedicated-table model means statistics/aggregation is
    deferred work (the dashboard RPCs key off form-answer `question_key`), not a free ride.
    Deferred by design (D8).
  - **The PHI boundary is soft** (D4) — a warning, not a wall — with the escape hatch that
    true PHI must use the patient module.
  - **A parallel per-type value path** to maintain alongside the form engine (validation,
    rendering) — bounded by the minimal D3 subset.

## Deferred (out of scope)

- Dashboard / statistics aggregation over custom-field values.
- Author attestation on the PHI boundary (D4 chose warning-only).
- The excluded types: `checkbox`, `free_text`, `time`.
- Uniqueness constraints, format masks, and cross-field validation.
- Process-less or commission-level (template-independent) field sets.
- Conditional field visibility (`visible_when`) — custom fields are always shown.
