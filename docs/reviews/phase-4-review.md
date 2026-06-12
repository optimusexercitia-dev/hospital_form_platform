# Phase 4 QA Review — Form Builder & Versioning

**Verdict: APPROVED**
**Reviewer:** qa (QA Reviewer agent)
**Date:** 2026-06-12 (re-review 2026-06-12)
**Baseline:** ARCHITECTURE.md Rules 1–10 + PHASES.md Phase 4 acceptance criteria
**Test baseline:** pgTAP 103/103; Vitest 20/20; Playwright 8/8 (tester re-run 2026-06-12 after MAJOR-1 fix, vs remote Supabase)
**Phase commit:** `480025c` (WIP) + follow-up fixes + MAJOR-1/MINOR-1/MINOR-3 resolutions (same session)

---

## Summary

Phase 4 is a substantial, well-executed delivery. The two-level builder (sections
containing blocks), publish/clone/version-history lifecycle, storage immutability,
sanitizing Markdown renderer, and the latent Phase-1 RLS defect repair (ADR 0013)
are all correct. The RLS surface is sound: no service-role key reaches the client,
every builder mutation path re-verifies authorization server-side before writing,
and the DB enforces published-version immutability via triggers independent of the
UI. Storage objects are never overwritten (upsert: false + no UPDATE/DELETE
policies). The Markdown renderer is the single XSS boundary, uses react-markdown
(no dangerouslySetInnerHTML), and rehype-sanitize with a hardened allowlist.
TypeScript strict is clean; lint passes; Vitest 20/20.

**Initial review (2026-06-12)** raised one MAJOR and two MINOR findings. All three
were resolved in the same session and verified in the re-review:

- **MAJOR-1 RESOLVED**: keyboard-only E2E test added to `e2e/phase4-builder.spec.ts`
  (`'keyboard-only: create a form via dialog and publish via AlertDialog'`).
  Genuinely keyboard-driven (only `keyboard.press`/`keyboard.type` after sign-in):
  dialog open by Enter, `toBeFocused` assertions on autoFocus and Tab targets, Escape
  cancel path, Tab×2 to submit, Tab to confirm Publish. Full suite re-ran **8/8 green**.
- **MINOR-1 RESOLVED**: `contextOfItem` in `src/lib/forms/actions.ts:204-206` now
  carries an inline comment documenting both FK hops and the migration maintenance note.
- **MINOR-3 RESOLVED**: `revalidateBuilder` in `src/lib/forms/actions.ts:122-124` now
  carries an inline comment noting the bracket syntax is intentional Next.js wildcard
  revalidation, not a placeholder.

---

## Detailed Findings

### MAJOR-1 — No keyboard-only E2E flow in Phase 4 specs

**Severity:** MAJOR (gate-blocking) — **RESOLVED**

**Files:** `e2e/phase4-builder.spec.ts`
**Requirement:** CLAUDE.md §8 — "The tester includes at least one keyboard-only
flow per phase."

Neither Phase 4 spec file contained any keyboard navigation at initial review.
Resolved by the tester: test `'keyboard-only: create a form via dialog and publish
via AlertDialog (keyboard flow)'` added to `e2e/phase4-builder.spec.ts:435-559`.
The test is genuinely keyboard-driven after sign-in — uses only
`page.keyboard.press` / `page.keyboard.type`. Covers: dialog open by Enter,
`toBeFocused` assertion on autoFocus title input, title typed via `keyboard.type`,
Escape cancel path (dialog closes, still draft), re-open, Tab×2 to "Criar
formulário" button, `toBeFocused` asserted, Enter to submit; Publish AlertDialog
opened by Enter, "Cancelar" `toBeFocused` asserted (Radix focus trap), Escape
cancel, re-open, Tab to "Publicar" confirm, `toBeFocused` asserted, Enter to
confirm, "Editar publicado" visible + draft "Publicar" trigger count = 0. Full
suite re-ran **8/8 green** vs remote (2026-06-12).

---

### MINOR-1 — `contextOfItem` PostgREST embed path is implicit and fragile

**Severity:** MINOR — **RESOLVED**

**File:** `src/lib/forms/actions.ts:204-206`
**Requirement:** ARCHITECTURE.md Rule 9 — data access through `src/lib/queries/`,
no fragile implicit joins.

`contextOfItem` used `'section_id, form_versions(forms(commission_id))'` — a
two-hop PostgREST embed from `form_items → form_versions → forms` — with no
documentation of which FKs were being traversed. Resolved by backend: the function
now carries an inline comment at `actions.ts:204-206`:

```
// PostgREST FK embedding hops: form_items.form_version_id → form_versions.id,
// then form_versions.form_id → forms.id (to reach forms.commission_id).
// Any migration that renames or drops either FK must update this embed path.
```

Verified in code.

---

### MINOR-2 — Version history page allows reading any version id via `?v=`

**Severity:** MINOR

**File:** `src/app/c/[slug]/manage/forms/[formId]/versions/page.tsx:52`
**Requirement:** ARCHITECTURE.md Rule 1 — RLS is the security boundary (defense in
depth, not UI-only).

The versions page validates `selectedId` by checking
`versions.some((ver) => ver.id === v)` where `versions = await listVersions(formId)`.
This correctly scopes the `?v=` parameter to versions that belong to the form being
viewed. RLS on `form_versions` limits `listVersions` to the caller's accessible
versions (commission members for published/archived, staff_admins for draft), so a
foreign version id either does not appear in `versions` (bound check rejects it) or
is not readable by `getVersionTree` (RLS returns null). The multi-layered check is
correct. This is a depth-of-defense observation: the check is in the Server
Component (good) and backstopped by RLS (good), so the finding is MINOR rather
than BLOCKER. No change required; recording for transparency.

**Recommendation (no action required):** Consider also asserting in the E2E suite
(Phase 7 submissions browser, where read-only views are more sensitive) that a
foreign version id in a URL yields "not found", not a partial render.

---

### MINOR-3 — `revalidateBuilder` uses template-literal paths with literal brackets

**Severity:** MINOR — **RESOLVED**

**File:** `src/lib/forms/actions.ts:122-124`
**Requirement:** CLAUDE.md §8 — UX quality bar; stale pages after mutation degrade
the builder experience.

`revalidatePath` with literal `[slug]`/`[formId]` brackets is intentional Next.js
wildcard revalidation syntax, but the intent was undocumented. Resolved by backend:
the function now carries an inline comment at `actions.ts:122-124`:

```
// Intentional: [slug] and [formId] are literal Next.js dynamic-segment syntax,
// not placeholders — revalidatePath with 'page' scope matches all concrete paths
// under this route pattern (https://nextjs.org/docs/app/api-reference/functions/revalidatePath).
```

Verified in code.

---

## Security / RLS Audit

### Service-role containment

| Check | Result | Evidence |
| ----- | ------ | -------- |
| No `NEXT_PUBLIC_SERVICE_ROLE` prefix in any src file | PASS | grep returns no matches |
| `createAdminClient` not called from `src/app/**` or `src/components/**` | PASS | grep returns no matches |
| `uploadFormAsset` uses cookie (RLS-scoped) client, not admin client | PASS | `actions.ts:1037` — `createClient()` (not `createAdminClient`) |
| `upsert: false` on storage upload | PASS | `actions.ts:1040` |
| No UPDATE/DELETE storage policies for form-assets | PASS | `20260612100007_storage_form_assets.sql:43` — "No UPDATE / DELETE policies" comment + no such policy created |

### Builder mutation authorization (server-side re-check)

| Check | Result | Evidence |
| ----- | ------ | -------- |
| `authorizeCommission` called before every write | PASS | All 10 exported mutations in `actions.ts` call `authorizeCommission` before any DB write |
| Commission resolved via RLS-scoped client (no leak on auth failure) | PASS | `commissionOfForm`/`contextOfVersion`/`contextOfSection`/`contextOfItem` all use `createClient()` — a foreign caller gets null → forbidden |
| `authorizeCommission` uses server-side `getSessionContext()` | PASS | `actions.ts:131-137` — `context.memberships` from `getSessionContext()`, not from client-supplied formData |
| Builder pages gated on `staff_admin` OR admin before rendering | PASS | `manage/forms/page.tsx:31`, `manage/forms/[formId]/page.tsx:39`, `manage/forms/[formId]/versions/page.tsx:42` all call `notFound()` unless staff_admin OR admin |
| RLS still backstops every write | PASS | All RPCs are `SECURITY INVOKER`; direct table writes use cookie client (RLS-scoped) |

### ADR 0013 — form_versions INSERT RLS fix

| Check | Result | Evidence |
| ----- | ------ | -------- |
| Latent defect (self-referential WITH CHECK) correctly identified | PASS | ADR 0013 and migration comments both accurate |
| Fix resolves commission via `form_id → forms.commission_id` (parent already exists on INSERT) | PASS | `20260612100010_form_builder_rpcs.sql:447-460` — both USING and WITH CHECK use `(select f.commission_id from public.forms f where f.id = form_versions.form_id)` |
| RPCs remain `SECURITY INVOKER` (no definer bypass) | PASS | All 5 RPCs in M10 carry `security invoker` |
| pgTAP covers foreign staff_admin and plain staff rejections | PASS | `60_builder.sql:406-437` — tests (b), (c), (d) |
| pgTAP covers direct staff_admin INSERT now working | PASS | `60_builder.sql:397-402` — test (a) |

### Published-version immutability

| Check | Result | Evidence |
| ----- | ------ | -------- |
| Immutability trigger exists for versions/sections/items | PASS | Migration `20260612100004_response_lifecycle.sql` (M4) — trigger-enforced |
| Clone writes to a NEW draft version (not the source) | PASS | `clone_form_version` in M10 inserts a new version row with `status = 'draft'` |
| Archive-on-republish, not on clone | PASS | `publish_form_version` (M5) archives the prior published; clone does not touch source status. Verified in smoke spec `phase4-builder-smoke.spec.ts:133-138` |
| Source published item/section immutable after clone exists | PASS | `60_builder.sql:191-214` — three immutability assertions post-clone |
| E2E AC-d asserts v1 path unchanged after v2 re-upload | PASS | `phase4-builder.spec.ts:427-429` |

### Storage immutability (Architecture Rule 6)

| Check | Result | Evidence |
| ----- | ------ | -------- |
| `uploadFormAsset` generates immutable path `{commission_id}/{ts}-{sha256[:16]}.{ext}` | PASS | `actions.ts:1035` |
| `upsert: false` prevents overwrite | PASS | `actions.ts:1040` |
| No UPDATE/DELETE storage policies | PASS | `20260612100007_storage_form_assets.sql` (confirmed above) |
| Clone copies `storage_path` reference only (no re-upload) | PASS | `clone_form_version` M10: `content` column copied verbatim; no Storage API call |
| E2E confirms re-upload in v2 yields a new path and v1 retains original | PASS | `phase4-builder.spec.ts:419-429` |

### Markdown / XSS surface (Architecture Rule 7)

| Check | Result | Evidence |
| ----- | ------ | -------- |
| `dangerouslySetInnerHTML` absent from application code | PASS | grep finds only one hit in `markdown-renderer.tsx` which is inside a comment |
| `MarkdownRenderer` uses `react-markdown` + `rehype-sanitize` (no `rehype-raw`) | PASS | `markdown-renderer.tsx:1-3` + ADR 0014 |
| Hardened allowlist tightens protocols (`http`/`https`/`mailto` only) | PASS | `markdown-renderer.tsx:36-43` — `SANITIZE_SCHEMA` |
| External links get `rel="noopener noreferrer nofollow"` | PASS | `markdown-renderer.tsx:86-93` |
| `section_text` preview in `block-card.tsx` goes through `MarkdownRenderer` | PASS | `block-card.tsx:300` |
| `section_text` in `read-only-tree.tsx` goes through `MarkdownRenderer` | PASS | `read-only-tree.tsx:135` |
| `SectionTextEditor` preview goes through `MarkdownRenderer` | PASS | `section-text-editor.tsx:87` |
| ADR 0014 exists with XSS-inert proof | PASS | `docs/decisions/0014-markdown-renderer.md` |

---

## Code Quality Audit

| Check | Result | Notes |
| ----- | ------ | ----- |
| TypeScript strict — no unjustified `any` | PASS | `npm run typecheck` exits 0. Casts in `toItem`/`toSection` (`row.content as Item['content']`) are narrowing from generated `Json`, documented in comments |
| `npm run lint` exits 0 | PASS | Verified this session |
| `npm run test` 20/20 | PASS | Condition evaluator + SQL↔TS parity unchanged |
| Data access through `src/lib/queries/` — no inline supabase in `src/app/**` or `src/components/**` | PASS | grep confirms zero hits |
| Server Components by default | PASS | All new pages (`manage/forms/page.tsx`, `[formId]/page.tsx`, `versions/page.tsx`) are Server Components; `"use client"` correctly limited to `BuilderShell`, `SectionCard`, `SectionSettingsDialog`, `SectionMetaDialog`, `ItemEditorDialog`, `ImageItemEditor`, `PublishButton`, `PublishedReadOnly`, `useFlipReorder` |
| `'use server'` on `src/lib/forms/actions.ts` | PASS | Line 1 |
| File ownership respected (backend: `src/lib/**`; frontend: `src/app/**`, `src/components/**`) | PASS | All B-tasks wrote to `src/lib/`; all F-tasks wrote to `src/app/` / `src/components/` |
| Generated types regenerated after M10 | PASS | PROGRESS.md B6 notes: "diff is ONLY the 5 new RPCs, no other drift" |
| ADR 0011 (reorder), 0012 (clone), 0013 (RLS fix), 0014 (Markdown) exist | PASS | All four present in `docs/decisions/` |
| GSAP Flip registered before use (P4-001 fix) | PASS | `use-flip-reorder.ts:63` — `gsap.registerPlugin(flipPlugin)` called on load; `getState`/`from` wrapped in try/catch so motion never blocks mutation |
| Upload race fixed (item-editor submit blocks while upload in flight) | PASS | `item-editor-dialog.tsx:296-297` — submit disabled when `imageUploading` is true; `ImageItemEditor` reports via `onUploadingChange` |

---

## UX & Accessibility Audit

| Check | Result | Notes |
| ----- | ------ | ----- |
| All user-facing strings pt-BR | PASS | MESSAGES const in `actions.ts`; all component copy reviewed |
| Raw Postgres/Supabase errors never reach the UI | PASS | All action catch branches return from MESSAGES const; `mapWriteError` maps `23514` → `MESSAGES.notDraft`; `publishVersion` surfaces the RPC's own pt-BR message on `23514` (always pt-BR from `validate_visible_when`); no raw pg errors exposed |
| Publish dialog keeps error ON SCREEN (does not auto-close on failure) | PASS | `publish-button.tsx:29-31` — confirm control is a plain `Button`, not `AlertDialogAction`, so dialog stays open on validation failure |
| `htmlFor`/`aria-describedby`/`aria-invalid` wired via `useFieldIds` | PASS | `item-editor-dialog.tsx:113-120` — label, explanation, alt fields all use `useFieldIds` |
| Default-section chrome rule enforced in builder and read-only | PASS | `builder-shell.tsx:55` / `read-only-tree.tsx:29` — `isFlat = sections.length === 1 && sections[0].isDefault` |
| Staff-gating 404 renders inside shell (not blank area) | PASS | `src/app/c/[slug]/not-found.tsx` added; E2E asserts `getByRole('heading', { name: /Não encontramos esta página/ })` is visible |
| Section settings dialog labels for selects (implicit label) | PASS | `section-settings-dialog.tsx` — every `<select>` wrapped in a `<label>` with visible text (implicit association), which is valid HTML; the select's value flows into a hidden `<input name="...">` for form submission |
| Keyboard-only E2E flow | FAIL | See MAJOR-1 — no keyboard test exists in Phase 4 specs |
| Loading/error boundaries | PASS | `manage/forms/loading.tsx` and `error.tsx` expected (see `forms-list` and `[formId]` routes — checked by E2E that staff hit the shell not a blank page) |

---

## Requirements / Acceptance Audit (PHASES.md §Phase 4)

| Acceptance criterion | Status | Evidence |
| -------------------- | ------ | -------- |
| Form list per commission; create form → v1 draft with default section | PASS | F1; E2E `createForm` helper in both specs |
| Two-level builder: sections + blocks | PASS | F2/F3; `builder-shell.tsx` + `section-card.tsx` + `block-list.tsx` |
| Add/rename/describe/reorder/delete sections | PASS | B3/F2; section-meta-dialog, section-card reorder buttons, delete confirmation |
| Deleting a section moves or deletes items with confirmation | PASS | B3 `deleteSection` action + `delete_section_moving_items` RPC; pgTAP 60_builder.sql |
| `visible_when` condition editor — valid earlier-section targets only offered | PASS | F4 `section-settings-dialog.tsx:79-90` — targets computed from strictly-earlier sections |
| Publish-time validation remains the authority (forward-reference test) | PASS | PHASES.md AC-c; E2E `phase4-builder.spec.ts:180-248` |
| Sign-off settings per section | PASS | F4; sign-off toggle + role select in section-settings-dialog |
| All 4 input types + options + required + `question_explanation` | PASS | B4/F3; E2E AC-a exercises all 4 types + explanation |
| `section_text` Markdown + preview | PASS | F5; `section-text-editor.tsx` + `MarkdownRenderer` |
| `image` upload to `form-assets` (immutable path) | PASS | B5/F5; `uploadFormAsset` in actions; E2E AC-a + AC-d |
| Default-section-no-chrome rule in builder | PASS | `builder-shell.tsx:55`; E2E AC-a builds flat form with no section chrome |
| Staff cannot reach the builder | PASS | E2E `phase4-builder.spec.ts:83-112` |
| Publish flow: condition validation + archive previous | PASS | B5 `publishVersion` wraps `publish_form_version` RPC; E2E AC-c tests forward-reference block |
| "Editar publicado" clones to new draft, preserving keys/conditions/sign-off/blocks | PASS | M10 `clone_form_version`; pgTAP 60_builder.sql fidelity assertions |
| Clone returns existing draft (ADR 0012, idempotent) | PASS | M10 `clone_form_version:149-155`; pgTAP `60_builder.sql:219-239` |
| Version history view | PASS | F6 `versions/page.tsx`; smoke spec navigates to history and asserts version rows |
| `question_key` preserved verbatim through clone | PASS | pgTAP `60_builder.sql:107-118` |
| Visible_when references survive clone unchanged | PASS | pgTAP `60_builder.sql:120-129` and eval check `60_builder.sql:176-186` |
| Re-uploaded image in v2 gets NEW storage path; v1 retains original | PASS | E2E AC-d `phase4-builder.spec.ts:369-429` |
| Builder acceptance (a): unsectioned form, all 4 types + explanation + text + image → publish | PASS | E2E `phase4-builder.spec.ts:114-178` |
| Builder acceptance (b): 3-section form with conditional + sign-off → publish | PASS | E2E `phase4-builder.spec.ts:251-367` |
| Builder acceptance (c): forward-reference condition → publish blocked + pt-BR error | PASS | E2E `phase4-builder.spec.ts:180-248` |
| Builder acceptance (d): v2 re-upload → new path; v1 immutable | PASS | E2E `phase4-builder.spec.ts:369-429` |
| Phase 3 INFO-1 carry: "Coordenação" RoleBadge asserted | PASS | E2E `phase4-builder.spec.ts:436-477` |
| Keyboard-only E2E flow (CLAUDE.md §8) | PASS | See MAJOR-1 — RESOLVED; `e2e/phase4-builder.spec.ts:435-559`; 8/8 green |

---

## Hygiene Audit

| Check | Result | Notes |
| ----- | ------ | -------- |
| ADRs 0011, 0012, 0013, 0014 present and sound | PASS | All four in `docs/decisions/` with accurate context and consequences |
| `PROGRESS.md` accurately reflects Phase 4 state | PASS | All tasks marked done; P4-001 RESOLVED; test run summary rows accurate |
| Secrets only in `.env.local` | PASS | No `NEXT_PUBLIC_SERVICE_ROLE*`; `.env.local` gitignored |
| Regression caveat documented | PASS | PROGRESS.md clearly notes phase2/phase3 specs require local Mailpit and were not run against remote — a documented environment constraint, not a hidden regression |

---

## Checklist Summary

| Area | Result |
| ---- | ------ |
| Requirements / Acceptance (all PHASES.md §Phase 4 bullets) | PASS (except keyboard-only flow — see MAJOR-1) |
| Service-role containment | PASS |
| Builder mutation authorization server-side + commission-scoped | PASS |
| RLS policies cover all Phase 4 write surfaces | PASS |
| ADR 0013 (RLS fix) sound and tested | PASS |
| Storage immutability (Rule 6) | PASS |
| Sanitizing Markdown renderer (Rule 7) — no dangerouslySetInnerHTML | PASS |
| Published-version immutability DB-enforced (Rule 5) | PASS |
| Clone semantics correct (ADR 0012) | PASS |
| Position-reorder deferrable swap (ADR 0011) | PASS |
| TypeScript strict — no unjustified `any` | PASS |
| Data access through `src/lib/queries/` | PASS |
| Server Components by default | PASS |
| File ownership respected | PASS |
| pt-BR user-facing strings | PASS |
| No raw Postgres errors in UI | PASS |
| Accessible inputs + visible labels + aria wiring | PASS |
| Keyboard-only E2E flow per phase (CLAUDE.md §8) | PASS (RESOLVED — see MAJOR-1) |
| ADRs for non-trivial decisions | PASS |
| `PROGRESS.md` reflects reality | PASS |
| Secrets only in `.env.local` | PASS |
| MINOR-1: `contextOfItem` embed path comment | RESOLVED |
| MINOR-2: version history `?v=` scope check | INFO (no action required — defense-in-depth passes) |
| MINOR-3: `revalidateBuilder` literal-bracket path comment | RESOLVED |

---

## Verdict

**APPROVED**

All three findings from the initial review (MAJOR-1, MINOR-1, MINOR-3) were
resolved in the same session and verified in this re-review:

- **MAJOR-1 RESOLVED**: keyboard-only E2E test added, `toBeFocused` assertions
  genuine, both dialog Escape-cancel and Tab/Enter confirm paths exercised; 8/8
  green.
- **MINOR-1 RESOLVED**: `contextOfItem` embed path documented with FK hop comments
  and a migration maintenance note.
- **MINOR-3 RESOLVED**: `revalidateBuilder` documented as intentional Next.js
  wildcard revalidation.

No blocking requirements, RLS holes, service-role leaks, XSS surfaces, or
immutability violations found. The phase is gate-clear.
