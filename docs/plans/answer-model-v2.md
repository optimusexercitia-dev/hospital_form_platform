# Answer-Model v2 & Form-Definition Forward-Compatibility

> **Status:** Planned, not started (2026-07-01). ADRs
> [0045](../decisions/0045-answer-model-v2.md) (answer model) +
> [0046](../decisions/0046-forward-compat-form-capabilities.md) (forward-compat contract +
> default values). This doc is the implementation plan; it is self-contained so a fresh session on
> another machine can execute it without re-exploring. Run as a **mini-phase** per CLAUDE.md §6.

## Context

The `form-model-normalization` work put the form model on a sound relational spine (options as
rows with stable `code`; selections in `answer_selected_options`; `app.answer_map` as the
evaluator's single rehydration layer). This package makes the **pre-launch, cheap-now / expensive-
later** schema-shape decisions that follow from the 2026-07-01 forms data-model review, and ships
one small builder feature (default values). It builds **no** repeating-group or new-answer-block UX
— only the structure that makes them additive later (ADR 0046).

Four improvements, all pre-launch (no users, no data backfill):

- **P0.1** — instance-ready answer key + group scaffolding (**shape only, no repeating-group UX**).
- **P0.2** — typed scalar answer columns (`value_number`/`value_date`/`value_time`).
- **P1.3** — uniform answer entity (choice items get a parent `answers` row) + `answered_at` +
  reserved `confidentiality_level`.
- **P2.4** — question **default values**.

**Non-negotiable invariants** (acceptance gates, not aspirations): evaluator parity byte-for-byte
(Rule 3), published + submitted immutability trigger-enforced (Rules 5/3), RLS on every new
surface (Rule 1), types regenerated (Rule 8), data access via `src/lib/queries` (Rule 9), pt-BR UI
(Rule 10). Blast radius ≈ the normalization — reuse that playbook.

### Locked decisions (lead-recommended defaults, 2026-07-01; re-confirm with the human at kickoff)

| # | Decision |
|---|----------|
| 1 | **Migration style** = additive, forward-only migrations layered on the existing baseline (do **not** edit the pushed `20260620000000_baseline.sql`); **optional** end-of-package re-squash to one clean baseline (as normalization did). |
| 2 | **Add the reserved `answers.confidentiality_level`** now (`not null default 'standard'`, **unenforced**) — free forward-compat for field-level confidentiality. |
| 3 | **Default values** = schema + **minimal builder UI** + wizard prefill (make it usable), not backend-only. |
| 4 | **Add `form_items.parent_item_id`** now (always NULL) so the definition model is coherent with the answer model. |
| 5 | **No feature flag** — transparent answer-model refactor + additive builder feature (matches `form-model-normalization` / `form-builder-enhancements`). |
| 6 | **No `value_text`** column now (free_text is sampled, not aggregated); deferred. `answered_by` deferred (single-author responses). |

---

## Current schema (verified 2026-07-01 — the starting point)

From `supabase/migrations/20260620000000_baseline.sql`:

- **`answers`** `(id, response_id, item_id, question_key NOT NULL, value jsonb, observation text)`
  — `unique(response_id, item_id)`. Scalars only in `value`; choice items store nothing here
  **unless** they carry an `observation` (then a row with `value = NULL`).
- **`answer_selected_options`** `(response_id, item_id, option_id)` — `PK(response_id, item_id,
  option_id)`; `option_id → form_item_options(id) ON DELETE CASCADE`. One row per selected option.
- **`response_section_signoffs`** `(id, response_id, section_id, signed_by, signed_at, note)`.
- **`form_items`** `(id, section_id, form_version_id, position, item_type, question_key, label,
  question_explanation, required, content jsonb, config jsonb, visible_when jsonb, created_at)`;
  `item_type ∈ {multiple_choice, dropdown, checkbox, free_text, short_text, number, date, time,
  section_text, image}`; `unique(section_id, position)` deferrable; partial
  `unique(form_version_id, question_key)`.
- **`form_item_options`** `(id, item_id, form_version_id, position, code, label, color_token, score,
  analytics_code, created_at)` — `code` immutable, `unique(item_id, code)`.
- **Rehydration:** `app.answer_map(response)` / `app.answer_map_by_item(response)` /
  `app.case_phase_answer_map(case_phase)` build `question_key→jsonb`: scalars from `answers.value`;
  single-select → `to_jsonb(min(code))`; checkbox → `jsonb_agg(code order by position)` — read from
  `answer_selected_options ⋈ form_item_options ⋈ form_items`.
- **Immutability:** `guard_submitted_children_trg` (answers / answer_selected_options /
  response_section_signoffs, keyed on `responses.status='submitted'` unless `app.in_submit_rpc`);
  `guard_published_structure_trg` (form_sections / form_items / form_item_options on published/archived).
- **Key RPCs:** `save_section_answers(p_response_id, p_section_id, p_answers, p_clear_item_ids,
  p_observations, p_selections)`; `submit_response` (answered = scalar value OR ≥1 selection;
  hidden-cleanup deletes both tables); `clone_form_version` (copies sections/items/options; `code`
  + `question_key` verbatim; `visible_when`/`config` copied); `publish_form_version`
  (`validate_visible_when`; ≥1 option per choice item).

---

## Target schema (what this package lands)

```sql
-- answers: ONE row per (response, item, instance) for EVERY answered item (scalar or choice)
answers (
  id                    uuid pk,
  response_id           uuid not null → responses on delete cascade,
  item_id               uuid not null → form_items,
  group_instance_id     uuid null → response_group_instances on delete cascade,  -- NEW (null=top-level)
  question_key          text not null,
  value                 jsonb,        -- canonical scalar; the evaluator STILL reads only this
  value_number          numeric,      -- NEW: derived by trigger (number items)
  value_date            date,         -- NEW: derived by trigger (date items)
  value_time            time,         -- NEW: derived by trigger (time items)
  observation           text,
  answered_at           timestamptz not null default now(),   -- NEW
  confidentiality_level text not null default 'standard'       -- NEW: reserved, UNENFORCED
)
-- replaces unique(response_id,item_id) — partial indexes dodge the NULL-in-unique trap:
create unique index answers_uq_top  on answers(response_id,item_id) where group_instance_id is null;
create unique index answers_uq_inst on answers(response_id,item_id,group_instance_id) where group_instance_id is not null;

-- selections hang off the parent answer → instance/item/response inherited; clean PK, no NULLs
answer_selected_options (
  answer_id  uuid not null → answers on delete cascade,        -- CHANGED (was response_id,item_id)
  option_id  uuid not null → form_item_options on delete cascade,
  primary key (answer_id, option_id)
)
create index on answer_selected_options(answer_id);

-- NEW: created + RLS'd + immutability-guarded now, but INERT until repeating groups ship
response_group_instances (
  id                 uuid pk,
  response_id        uuid not null → responses on delete cascade,
  group_item_id      uuid not null → form_items,                      -- future repeating_group container
  parent_instance_id uuid null → response_group_instances on delete cascade,  -- nesting
  position           int not null,
  created_at         timestamptz not null default now()
)   -- RLS mirrors answers (member read via commission_of_response; creator write while in_progress)

-- form_items: two additive columns
form_items
  + parent_item_id  uuid null → form_items(id) on delete cascade   -- always NULL now; future group children
  + default_value   jsonb null                                     -- P2.4 (input-only; CHECK display=null)
```

Design notes:
- **`value` jsonb stays the canonical evaluator input**; typed columns are derived denormalizations.
  This is what guarantees zero evaluator drift.
- **Two partial unique indexes**, not a composite unique with a nullable column (Postgres NULLs are
  distinct → would allow duplicate top-level answers).
- **`answer_selected_options → answer_id`** is the single highest-touch change (RLS, immutability,
  dashboards, save, `answer_map` all reference it).

---

## Backend work (owner: `backend`; owns `supabase/**`, `src/lib/{queries,forms,responses,types}`)

**Contract-first: post BE-0 signatures before implementing** so `frontend` builds the defaults UI
in parallel.

### BE-0 — contracts (post as typed stubs)
`src/lib/queries/forms.ts`:
```ts
export interface Item {
  // ...existing
  defaultValue: Json | null        // scalar, or option code(s) for choice
  parentItemId: string | null      // always null until repeating groups ship
}
```
`src/lib/queries/responses.ts` (or wherever `Answer`/read shapes live):
```ts
export interface AnswerRecord {
  // ...existing
  answeredAt: string
  // value stays the canonical scalar; typed columns are read-only analytics, not surfaced in fill
}
```
`src/lib/forms/actions.ts` — `addItem`/`updateItem` FormData gains `defaultValue` (JSON). Server
clears/validates it per type. `src/lib/responses/actions.ts` — `saveSection` shape unchanged
(selections still by option **code**; the RPC now writes through the uniform row).

### BE-1 — migration: definition-side (additive)
- `form_items` += `parent_item_id uuid null → form_items(id) on delete cascade`;
  += `default_value jsonb null`; CHECK `default_value is null OR item_type not in (section_text,image)`.
- New `response_group_instances` table + RLS (member read via `app.commission_of_response`; INSERT/
  UPDATE/DELETE by `created_by` while `responses.status='in_progress'` — clone the `answers` policies).
- No new item_type, no group semantics. (BE-1 is additive → light plan review.)

### BE-2 — migration: answer-side (the core; **full plan review**)
- `answers` += `group_instance_id uuid null → response_group_instances on delete cascade`,
  `value_number numeric`, `value_date date`, `value_time time`,
  `answered_at timestamptz not null default now()`,
  `confidentiality_level text not null default 'standard'`.
- Drop `unique(response_id,item_id)`; add the two partial unique indexes.
- `answer_selected_options`: drop `PK(response_id,item_id,option_id)` + the `response_id`/`item_id`
  columns; add `answer_id uuid not null → answers on delete cascade`; `PK(answer_id, option_id)`;
  index `answer_id`; rewrite RLS to re-derive response/commission via `answer_id → answers`.
- Trigger `app.sync_answer_typed_values` `BEFORE INSERT/UPDATE ON answers`: look up `item_type` by
  `item_id`; set `value_number`/`value_date`/`value_time` from `value` for number/date/time; NULL
  otherwise. `search_path` pinned.
- Extend `guard_submitted_children_trg` to cover `response_group_instances`.

### BE-3 — rehydration + write RPCs (keep OUTPUT identical)
- `app.answer_map` / `app.answer_map_by_item` / `app.case_phase_answer_map`: re-source selections via
  `answer_id → answers`; scalars from `answers.value`. **Output byte-for-byte unchanged.**
- `save_section_answers`: for **every** answered item (scalar or choice), upsert the parent `answers`
  row (`group_instance_id = null` for now; set `answered_at = now()` on change) → get `id`; scalars set
  `value` (trigger derives typed); choices replace `answer_selected_options` **by `answer_id`**;
  observations set on the same row; orphan-clear deletes `answers` rows (cascade drops selections).
  Preserve the HC013 cross-version guards + `in_progress` guard.
- `submit_response` + `app.response_required_complete`: "answered" = scalar `value` non-null OR
  (choice ≥1 selection) — **semantics identical**; hidden-cleanup deletes `answers` rows (cascade) +
  any `response_group_instances`.

### BE-4 — dashboards / export / clone / publish
- `dashboard_distributions` / `dashboard_export_rows` / the other `dashboard_*`: join selections via
  `answer_id`; **verify identical aggregates** (checkbox unnest, per-section denominators, `;`-joined
  export). Optionally use `value_number`/`value_date` for numeric distributions.
- `clone_form_version`: copy `default_value` + `parent_item_id` (remap parent to the new item id);
  option `code`s verbatim (unchanged).
- `publish_form_version`: validate `default_value` (type matches item; choice codes exist via
  `app.version_has_option_code`) → new `HC0xx` with a pt-BR message.

### BE-5 — types + query layer
`supabase gen types typescript --local > src/lib/types/database.ts`; update `src/lib/queries` readers
(`getResponseForFill` / `getSubmissionDetail` / `buildAnswerMaps` TS twin — **output unchanged**);
expose `defaultValue`/`parentItemId` on the item type.

---

## Frontend work (owner: `frontend`; owns `src/app/**`, `src/components/**`) — defaults only

Run the `frontend-design` skill before building the defaults control.

- **Builder** (`item-editor-dialog.tsx` / `options-editor.tsx`): a per-input **"Valor padrão"**
  control — scalar input for free_text/short_text/number/date/time; option-picker (single or
  checkbox-set) for choice items; none for display items. Persist via `forms/actions.ts`
  (`defaultValue` JSON: scalar, or code / code[]).
- **Wizard** (`use-wizard.ts` / `input-item.tsx`): when an item is **visible** and has no saved
  answer, seed the field state from `default_value`; the user can change it; a kept default saves as
  a normal answer. **Defaults never auto-write hidden items** (respect `computeEffectiveVisibility`).
- **No** repeating-group UI, **no** new item types, **no** answer-block UI.

---

## Immutability / RLS / constraints checklist

- [ ] `guard_submitted_children_trg` covers `response_group_instances`; `answer_selected_options`
      guard still fires via `answer_id → answers`.
- [ ] Typed columns + `answered_at` + `confidentiality_level` inherit the whole-row submitted guard.
- [ ] `form_items.parent_item_id` / `default_value` inherit the published-structure guard.
- [ ] New RLS on `response_group_instances` (member read; creator write in_progress).
- [ ] Rewritten `answer_selected_options` RLS re-derives via `answer_id`; index on `answer_id`.
- [ ] Table grants: `authenticated` DML covers the new columns/tables (Supabase grants are
      table-wide — verify the new table + rewritten selections table).
- [ ] CHECK: `default_value` NULL for display items; `parent_item_id` self-consistency (same
      section/version) deferred behind a note while all values are NULL.

---

## Migration & deployment (memory-aware)

- Branch `feat/answer-model-v2` off `main`. **Additive forward-only** migrations on the baseline —
  do **not** edit the pushed baseline (`supabase-db-push-migration-history-block`).
- Local schema changes apply with `supabase migration up` (the app's `.env.local` points at **local**
  Supabase — `app-reads-local-migrations-push-remote`); validate a clean rebuild with
  `supabase db reset --local`.
- **Remote `supabase db push` is user-run** — background agents are auto-denied
  (`remote-db-push-needs-user-auth`).
- Pre-launch → **full local+remote reset is acceptable** (`prelaunch-db-reset-ok`); no back-compat
  data migration. Optional end-of-package **re-squash 2→1** into a fresh baseline (deliberate,
  user-authorized remote re-baseline) as `form-model-normalization` did.
- **At implementation (the §6 Record step) update the current-state docs** — deliberately *not*
  touched now: `ARCHITECTURE.md` Rule 2 canonical schema (answers/selections/`response_group_instances`
  /`form_items` columns) and `docs/backend-state.md` (new tables/columns, changed RPCs, the trigger).

---

## Risks & sequencing

**Highest-risk:** (a) evaluator drift from re-sourced `answer_map` — never touch the evaluators;
golden-vector + a new golden-output test are blocking gates; (b) nullable-key uniqueness trap —
partial indexes + `(answer_id, option_id)` PK; (c) immutability/RLS gaps on new surfaces — the §
checklist + per-surface pgTAP; (d) dashboards/export aggregate changes via the new join — pre/post
equality tests on seeded data; (e) `save_section_answers` ordering (upsert parent → then selections
by `answer_id`) — FK forces order; reuse the normalization's structure.

**Order (contract-first):**
1. **BE-0** post contracts (item `defaultValue`/`parentItemId`; `AnswerRecord.answeredAt`).
2. **BE-1** definition migration (+`response_group_instances` RLS).
3. **BE-2** answer migration (+typed trigger, +partial indexes, selections→`answer_id`, RLS).
4. **BE-3** `answer_map`(+twins) + `save_section_answers` + `submit_response` + guard extension.
5. **BE-4** dashboards/export/clone/publish-validation.
6. **BE-5** regen types + query layer.
7. **FE-1/FE-2** (parallel after BE-0): defaults builder + wizard prefill.
8. **Tester → QA** per §6.

No shared-file collisions if `forms.ts`/`responses.ts`/`actions.ts` land via Backend first.

---

## Verification

- **pgTAP:** `answer_map` **golden parity** (identical outputs pre/post — the keystone); partial-
  unique rejects dup top-level / allows per-instance; choice save now creates a parent `answers`
  row; selections FK `answer_id`; typed-trigger correctness (number/date/time derive; text/choice
  NULL); submitted/published immutability on all new surfaces; RLS on `response_group_instances` +
  rewritten selections (non-creator denied, cross-commission denied); default-value publish
  validation (`HC0xx` on bad type / non-existent code); clone copies `default_value`/`parent_item_id`.
- **Vitest:** `buildAnswerMaps` twin parity vs `condition-vectors.json` + `visibility-vectors.json`
  (unchanged); default-prefill respects visibility.
- **E2E (Playwright):** regression green (fill / submit / sign-off / observation / dashboards / export
  outputs unchanged); default prefill visible + editable; ≥1 keyboard-only flow (§8).
- **Gate hygiene (memory):** full suite is green only on **local Docker**; run the declaring suite
  against a **prod build** using the **standalone server** (`node .next/standalone/server.js` +
  copy static/public — `e2e-standalone-server-not-next-start`), triaged vs the flaky baseline
  (`e2e-prod-build-flaky-baseline`). The **lead** runs the full suite as a background command
  (`subagent-cannot-run-full-e2e`).
- `npm run lint && npm run typecheck` clean; regenerated `database.ts` committed.

---

## Forward-compatibility (what this unlocks — full contract in ADR 0046)

Hooks landed here (`answers.group_instance_id`, `response_group_instances`, the uniform `answers.id`,
`form_items.parent_item_id`, reserved `confidentiality_level`, the typed-column pattern) make these
**additive-only later, with no data backfill**: repeating groups; file/signature/matrix/rating answer
blocks (child tables on `answers.id`); field-level confidentiality; rich_text/datetime/decimal/%.
None are built now.

**Branch:** `feat/answer-model-v2` (off `main`).
**Execution:** spawn the standing `backend`/`frontend` teammates contract-first, then `tester`, then
`qa`, following the CLAUDE.md §6 Phase Gate (mini-phase; full plan review on BE-2/BE-3).
