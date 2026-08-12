# QA Review — Referral detail page redesign (RDR)

- **Reviewer:** `qa` (Phase Gate step 3)
- **Date:** 2026-08-11
- **Branch:** `worktree-referral-detail-redesign` (21 commits, `main..HEAD`)
- **Contract:** [docs/plans/referral-detail-redesign.md](../plans/referral-detail-redesign.md)
  (decisions D1–D10 + **binding amendments A1–A12, which override the phase text**) ·
  [ADR 0109](../decisions/0109-referral-registros-and-case-access-summary.md)
- **Migration:** `supabase/migrations/20260919010000_referral_registros_case_access_summary.sql`

## Verdict

# APPROVED

No blocking finding. Every decision D1–D10 and every amendment A1–A12 is implemented or
correctly waived; the K-R5-1 keystone survives the `body` → `body_md` rename; the new
`SECURITY DEFINER` door is gated, audited, revoked from `public`/`anon` and keystoned by a
mutation-proven, non-vacuous pgTAP assertion; **A11 / Rule 7 holds** (proof in §2). Three
non-blocking follow-ups are recorded below — two of them pre-existing platform gaps that this
phase inherits rather than creates, one of which A11 materially raises the stakes on.

Method note: every security conclusion below was re-derived from the **live catalog**
(`pg_proc` incl. `prosecdef`, `pg_policies`, `pg_class.relacl`,
`information_schema.column_privileges`, `pg_constraint`, `pg_trigger`), never from migration
file text. The gate results supplied by the lead (`test:db` 183/5870, `ARM=census`/`hat`/`floor`,
typecheck, lint, vitest, `e2e:prod`) were taken as given and not re-run.

---

## 1. Requirements — D1–D10 and A1–A12

| Item | Status | Evidence |
|---|---|---|
| D1 minimal header | ✅ | `…/encaminhamentos/[referralId]/page.tsx:304–325` — back link, code, `h1`, Status + Type chips only. `<dl>`, chip tail, created/sent line and the decline banner all moved to the Detalhes card. Direction chip removed. |
| D2 Responsáveis on the rail | ✅ | `page.tsx:473–481`, `order-6`. Heading "Responsáveis" retained. |
| D3 case card (as amended by **A12**) | ✅ | `referral-case-card.tsx:73–103`. |
| D4 Casos relacionados kept, on rail | ✅ | `page.tsx:505–513`, `order-11`. |
| D5 access-dialog roster (as amended by **A7**) | ✅ | `referral-case-access-dialog.tsx:41–73`. |
| D6 Registros internos | ✅ | `referral-internal-notes-panel.tsx:157` heading + `:196–200` side-privacy disclaimer. |
| D7 messenger Diálogo + inline system events | ✅ | `referral-thread.tsx:64,105–106` (alignment by `senderCommissionId === viewerCommissionId`), `:74` heading "Diálogo" preserved. No new tables — `synthesizeThreadEvents` is pure. |
| D8 compact composer, Ctrl/Cmd+Enter | ✅ | `referral-composer.tsx:150–151`; mode pills kept; no attachments. |
| D9 no new feature flag | ✅ | `app.assert_referrals_enabled()` in every new door; no new flag key in the catalog. |
| D10 redaction unchanged, no reopen | ✅ | `referral-note-card.tsx:333` (`canRedact && !redacted` — open **and** concluded). No reopen RPC exists in `pg_proc`. |
| A1 migration timestamp | ✅ | `20260919010000_*` sorts after the merged ETH·E4 chain. |
| A2 pgTAP suite `322` | ✅ | `supabase/tests/322_referral_registros.sql`. |
| A3 RPC signature / row-type return / grant re-issue | ✅ | Catalog: `create_referral_internal_note(p_referral_id uuid, p_committee_id uuid, p_body_md text, p_title text, p_note_type_id uuid, p_assigned_to uuid)`, `proacl` carries `authenticated=X`. No stale 3-arg overload survives. |
| A4 column-list grants | ✅ | See §3.1 — verified column by column. |
| A5 audit helpers / error codes | ✅ | Writes use `app.audit_write`, the read uses `public.log_audit_access`; `42501` / `HC0A9` / `no_data_found` in use. |
| A6 vocabulary mirrors the LIVE sibling | ✅ | `referral_note_types` has `_select` + `_staff_admin_write` (`FOR ALL`) policies, table-level `authenticated=arwd`, and **only** `reorder_referral_note_types` as an RPC. The planned create/update/archive RPCs are correctly absent; actions write the table directly. |
| **A7 five groups, S2/S5 excluded** | ✅ | See §3.3. Five groups present in SQL, TS and UI; exclusion proven structurally *and* by pgTAP `5.9` / `5.10`. |
| A8 `case_access_grants` | ✅ | The door reads `public.case_access_grants` directly for candidacy; no `list_case_access` dependency. |
| A9 direction bug | ✅ | `page.tsx:108` passes `myCommissionId`. Hardened beyond the amendment: commit `b8555ef` made the parameter **required**, so the defective call shape is now a compile error (pinned by `src/lib/queries/referrals.test.ts:140`). Verified the parameter is presentational only — it feeds the `direction` derivation at `queries/referrals.ts:666` and is never sent to the RPC, so authority is unchanged. |
| **A10 "Ação solicitada" row** | ✅ | `referral-details-card.tsx:48`. |
| **A11 Rule 7 at render** | ✅ | See §2. |
| **A12 two-state case control** | ✅ | `referral-case-card.tsx:73–95` — `canRead` → `<Link>` "Abrir registro do caso"; else muted "Você não tem acesso a este caso." + outline "Quem tem acesso?". Headings differ by side (`page.tsx:489`: "Caso de origem" / "Caso em análise"). Empty state at `:106–109`. |

**Two defects closed by this phase, both verified live:**
- The `create_referral_internal_note` NULL-hole. The gate now reads
  `p_committee_id is distinct from source … and is distinct from target …` (catalog-confirmed) —
  on a `technical_director` referral the old `not in` expression evaluated NULL, which plpgsql's
  `if` treats as false, so the raise never fired.
- The rename orphan in `dispose_referral_phi`. Catalog-confirmed writing `body_md`; its one
  remaining bare `body` is `referral_messages.body`, a different table. A catalog-wide sweep for
  functions touching `referral_internal_notes` with a bare `body` and no `body_md` returned
  **zero** rows — the rename propagated completely.

---

## 2. 🔴 A11 / Rule 7 — the highest-value check

**Rule 7 holds.** Registro bodies are stored verbatim (there is no write-time sanitizer, and
A11 is correct that the plan's instruction to "reuse the sanitizer `saveNarrativeBody` uses" had
no referent). The single render-time defense is intact and no path bypasses it.

**How this was proven — by the property, not by grepping one identifier:**

1. **Enumerated every producer of a stored registro body.** `listReferralInternalNotes` — the
   only read path (the `body_md` column is grant-REVOKED, so no direct SELECT exists) — has
   exactly **one** call site: `page.tsx:220`. From there the array flows to
   `ReferralInternalNotesPanel` and nowhere else.
2. **Enumerated every consumer.** The panel renders **no** body: it maps each note through
   `renderNote` → `ReferralNoteCard` (`referral-internal-notes-panel.tsx:131–143`); its own
   composer binds a fresh empty `body` string to a textarea.
3. **Enumerated every display branch inside the card** (`referral-note-card.tsx:216–306`) — the
   ternary is exhaustive, three arms:
   - *editing* → `SectionTextEditor` (`:270`). Its edit mode is a `<textarea value=…>` (React
     escapes; no HTML context) and its preview mode routes through `MarkdownRenderer`
     (`section-text-editor.tsx:87`) — verified, not assumed.
   - *redacted* → the literal string `[redigido]` plus `note.redactedReason` (`:293–300`). The
     body is never touched on this arm.
   - *otherwise* → `<MarkdownRenderer content={note.bodyMd} />` (`:304`).
4. **Swept for the three failure modes A11 names, repo-wide.** `dangerouslySetInnerHTML` appears
   in `src/` only inside four doc comments — **zero** call sites. No bare interpolation of
   `bodyMd` into HTML-bearing markup exists on any referral surface.
5. **Proved there is no second renderer.** `package.json` declares exactly one Markdown
   dependency pair — `react-markdown` + `rehype-sanitize`. **No `rehype-raw`, no `marked`, no
   `markdown-it`, no `dompurify`** anywhere in the manifest or in `src/`.
6. **Read the renderer itself** (`markdown-renderer.tsx:79–98`): `ReactMarkdown` with
   `rehypePlugins={[[rehypeSanitize, SANITIZE_SCHEMA]]}`, no `rehype-raw`, and a hardened schema
   that restricts `href` to `http|https|mailto` and `src` to `http|https`. react-markdown emits a
   React element tree, never an HTML string, so raw HTML in the source is inert text.

**What would have found a hole and did not:** the enumeration was driven from the *read door*
(step 1) rather than from the string `bodyMd`, so a surface that renamed the field on the way to
the DOM would still have been caught. The `referral-send-wizard.tsx:835` `{n.bodyMd}` hit that
the grep surfaced was chased down and is a **case-narrative** body (via
`build-case-referrals-module.ts`), untouched by this branch, and is a bare JSX interpolation —
React-escaped, therefore not an XSS surface.

E2E pins the positive half at `e2e/referral-registros.spec.ts:518–521` (`**markdown**` must
arrive as a `<strong>`), which is a real net against the "plain `{note.bodyMd}`" regression. The
negative half is not pinned anywhere — see **MINOR-2**.

---

## 3. Security / RLS — verified against the live catalog

### 3.1 K-R5-1 survives the rename (A4)

`information_schema.column_privileges` for `public.referral_internal_notes`, all 18 columns:

- `body_md` — **no `authenticated` grant.** Only `postgres` and `service_role`. That absence *is*
  the keystone.
- All 17 other columns — `authenticated | SELECT` present, including every one of the nine new
  ones (`title`, `note_type_id`, `type_label`, `assigned_to`, `status`, `concluded_at`,
  `concluded_by`, `updated_at`, `updated_by`). No column was left off, so no direct read 42501s.
- `pg_class.relacl` = `{postgres=arwdDxtm/postgres, service_role=arwdDxtm/postgres}` — **no
  table-level `authenticated` ACL**, exactly as A4 requires.
- RLS enabled; the sole policy is `referral_internal_notes_select` on
  `app.can_read_referral_internal_note(id, auth.uid())`. No INSERT/UPDATE/DELETE policy and no
  write grant — every write is forced through a DEFINER door.

### 3.2 `referral_note_types` (A6)

- RLS enabled. `referral_note_types_select` = `app.is_member_of(commission_id) OR
  app.is_tenancy_admin_of(commission_id)`; `referral_note_types_staff_admin_write` `FOR ALL` with
  matching `USING` **and** `WITH CHECK` = `app.is_staff_admin_of(...) OR
  app.is_tenancy_admin_of(...)`. Table grant `authenticated=arwd`. This mirrors the live
  `case_narrative_types` exactly.
- **Rule 11 is satisfied for the direct-table writes** by trigger, not by the actions:
  `AFTER INSERT OR UPDATE ... EXECUTE FUNCTION app.trg_audit_referral_note_types()`, mirroring the
  sibling's `audit_case_narrative_types_trg`. This was checked because A6's direct-write pattern
  otherwise routes around any RPC-level audit.

### 3.3 `get_referral_case_access_summary` — the new DEFINER door

- `prosecdef = t`; `SET search_path TO 'app','public','pg_catalog'`;
  `proacl = {postgres=X, service_role=X, authenticated=X}` — **revoked from `PUBLIC` and `anon`**.
- **Gate (42501, raised before any work):** three conjuncts — `p_commission_id` is one of the
  referral's two sides (NULL-safe `is distinct from`, so a `technical_director` NULL target does
  not open a hole), the caller is an active member of *that* side, and
  `app.can_read_referral(p_referral_id, auth.uid())`. The case is **side-derived**, never
  caller-chosen (D4).
- **A7 is satisfied structurally, which is stronger than satisfying it by enumeration.** The five
  arms only produce *candidates*; membership is then decided by
  `app.has_case_capability(v_case, uid, 'read_case_content')`. I confirmed against `app._case_caps`
  that **S2 org_admin confers `manage_case_access` only** and **S5 plain member confers
  `read_case_deliberation` only** — neither confers `read_case_content`, so neither can appear
  even if it were enumerated. The hard denies (respondent, recusal, `is_active`) and the S6/S7
  side conditions ride inside the resolver.
- **Candidate-arm parity checked helper by helper** (an under-enumerating arm would silently
  under-report the roster): S1 mirrors `is_staff_admin_of_for` → `has_role('commission', …,
  'staff_admin')`; S6 mirrors `is_pqs_operator_of_for` → `nsp_coordinator ∪ pqs_member` at
  hospital scope; S7 mirrors `is_quality_reviewer_of_for` → `quality_reviewer` at hospital scope.
  All three match the SQL's `union all` arms term for term.
- **PHI-free:** `full_name` only, plus the case id the caller's own card already displays. No
  grant reason, no expiry, no identifier. Pinned by `322` §5.18.
- **Rule 11:** emits `referral.case_access_summary_viewed` via `public.log_audit_access`, with
  the registry's allow-list *and* the `app._audit_access_authorized` dispatch arm both extended
  (ADR 0109 D6). Pinned by `322` §5.19.
- **Keystone quality is good, and one of its own tests was caught vacuous by the team.** `322`
  §5.1/5.2 originally matched on SQLSTATE `42501` alone and stayed **green** when the door's gate
  was neutralized, because `log_audit_access` refuses the same caller with the same code. They now
  pin the door's own pt-BR message. `5.10` is a genuine PARITY assertion (every name in the roster
  must satisfy `app.can_read_case`), and `5.16` is an explicit non-vacuity control on the
  hard-deny test. This is the standard the repo's ADR-0079 lessons ask for.

### 3.4 `reorder_referral_note_types` is INVOKER — and that is safe

`prosecdef = f`, confirming ADR 0109 D2 (the catalog beat amendment A6's prediction; the live
sibling `reorder_case_narrative_types` is also INVOKER). Because it is INVOKER, its `UPDATE` runs
as the caller against `referral_note_types_staff_admin_write` — **RLS remains the boundary
(Rule 1)**, and the inline `is_staff_admin_of OR is_tenancy_admin_of` check only converts a silent
zero-row update into a pt-BR `42501`. Correct: a non-coordinator gets zero rows from RLS
regardless of the inline check. This phase therefore adds **one** new `prosecdef` door class, not
two.

### 3.5 Audit emission on every new mutation (Rule 11)

Catalog-verified: `create` / `update` / `assign` / `unassign` / `conclude` /
`redact_referral_note` / `list_referral_internal_notes` / `get_referral_case_access_summary` all
emit. `reorder_referral_note_types` does not emit inline — it is covered by the
`audit_referral_note_types_trg` AFTER UPDATE trigger (§3.2).

### 3.6 Secrets

No service-role client or `SUPABASE_SERVICE_ROLE_KEY` reference reachable from `src/components/`
or from any client component on this branch. The single repo hit is a doc comment in
`src/app/(public)/verificar/page.tsx`.

---

## 4. Known-open items — all four correctly characterised, none buried

| Item | Assessment |
|---|---|
| **BUG-RDR-001** (dialog focus not restored) | ✅ Correctly characterised. PROGRESS.md:447–470 states severity (major, a11y), states it is **pre-existing and platform-wide, not an RDR regression**, and — critically — *measures* that claim against an RDR-untouched dialog rather than asserting it. Root cause is named precisely (Radix restores only to a `DialogPrimitive.Trigger`; 20+ components drive `<Dialog open onOpenChange>` from their own `<Button onClick>`), including that `dialog.tsx`'s own doc comment is false on the restore half. Pinned executably by `e2e/referral-registros.spec.ts` KB-3 under `test.fail()`, with an explicit instruction not to "fix" it by deleting KB-3. |
| **BUG-MIN-E2E-1** (`meeting-audio-minutes`) | ✅ Correctly characterised. Filed separately, severity stated (major — a whole feature's E2E unproven), reproduced **in isolation on a fresh reset**, and blast radius established by `git log main..HEAD --name-only` rather than by assumption. The 9 did-not-run are traced to it, not left as an unexplained gap. |
| **Door sweep covered 4 of 5 cases** | ✅ Correctly characterised, and in the right place. Recorded **inside `docs/reviews/authz-door-audit-findings.md` itself** (not only in PROGRESS.md), with the exact mechanism (`p0-authz-door-audit.sh:176` worklist regex `^(is_\|can_\|has_\|…)` cannot match a leading-underscore name), the compensating targeted mutation (`322` §5.19), and the explicit instruction *"Do not cite that run as 5-of-5 coverage."* The findings file was correctly restored with `git checkout --` before merging the subset, per ADR 0079 Amendment 1 hazard 1. |
| **`perf-sweep-wave2` 26 leaked referrals** | ✅ Correctly characterised as a **pre-existing fragility observed while running, not caused by RDR** (PROGRESS.md:193–199), with the mechanism (hub paginates at 25 by recency) and the reason it was left alone (out of RDR's scope to change another spec's fixture strategy; `RESET=1` masks it batch-to-batch). |

I looked specifically for a known-open item that had been softened or omitted between the
teammates' notes and the phase record, and found none. The lead's independent re-verification of
the Phase 1 gate (PROGRESS.md:240–248) re-derives the load-bearing catalog facts personally
rather than relaying them, which is the correct posture.

---

## 5. Conventions

- **TypeScript strict / no unjustified `any`** — ✅ zero `any` in the new modules
  (`thread-events.ts`, `referrals.ts` additions, `actions.ts` additions, and all six new/modified
  components). The one deliberate loosening is `ReferralCaseAccessSummaryJson`'s
  `unknown`-typed fields at `queries/referrals.ts`, narrowed by `nameList()` — a *tightening*, not
  a cast, so a future SQL edit that drops a key degrades to `[]` instead of producing `undefined`
  inside a `string[]`. Good judgement.
- **Rule 8 (types from `src/lib/types/`)** — ✅ `database.ts` regenerated (+262 lines); no
  hand-written DB types.
- **Rule 9 (data access via `src/lib/queries/`)** — ✅ all three new reads
  (`listReferralInternalNotes`, `listReferralNoteTypes`, `getReferralCaseAccessSummary`) live in
  `src/lib/queries/referrals.ts`; no inline supabase-js in components.
- **Server Components by default** — ✅ `referral-details-card.tsx`, `referral-thread.tsx`,
  `referral-thread-event.tsx` and the page are all server. `"use client"` appears only where
  interaction requires it (note card, case card, access dialog, type manager, composer, thread
  item).
- **pt-BR user-facing / English code** — ✅ throughout, including every new error message. Raw
  Postgres errors cannot reach the UI: `mapReferralError` ends in a `default:` returning the
  generic pt-BR string, and `getReferralCaseAccessSummary` folds all three failure causes to
  `null`.
- **Accessibility** — ✅ notably good. Labels associate by explicit `htmlFor`/`id` rather than
  wrapping (with the reason documented at `referral-internal-notes-panel.tsx:212–216`: a `<label>`
  wrapping a `<select>` folds every option's text into the computed accessible name — a real
  defect the team hit and fixed in commit `36ca1c0`). `aria-describedby` wired to the field error,
  `role="alert"` on it, `aria-expanded` on the composer toggle, `aria-pressed` on the mode pills,
  per-item `aria-label`s on the icon-only reorder buttons, `aria-labelledby` on every card region,
  visible focus rings on the custom field class. Dialog focus **trap** is asserted green by KB-2;
  restoration is BUG-RDR-001.
- **`loading.tsx` lockstep** — ✅ grid template, `contents lg:flex` wrappers and `order-N
  lg:order-none` all mirrored, in the same commit.
- **ADR present for the non-trivial choices** — ✅ ADR 0109, which is unusually honest: it records
  where the catalog *overruled* the plan (D2) and documents both closed defects.

---

## 6. Findings

### MINOR-1 — reordering registro types breaks after archiving a non-last type (reproduced live)

**Requirement touched:** plan §"Phase 3 · `referral-note-type-manager.tsx` … create/rename/
describe/reorder/archive" — reorder must work on a vocabulary that has had a type archived.

`referral_note_types` carries `UNIQUE (commission_id, "position") DEFERRABLE`
(`referral_note_types_commission_position_key`). The manage dialog is fed **non-archived types
only** — `page.tsx:223` calls `listReferralNoteTypes(myNoteCommitteeId)`, whose signature is
`(commissionId, includeArchived = false)` — and `referral-note-type-manager.tsx:144–156`'s
`move()` sends exactly those ids. `reorder_referral_note_types` then assigns positions `1..n`
over that subset while archived rows keep their old positions, so any archived type that was not
last collides.

**Reproduced against the live database**, not inferred:

```
types A(pos 1), B(pos 2, archived), C(pos 3)  →  reorder [C, A]  →
ERROR: duplicate key value violates unique constraint "referral_note_types_commission_position_key"
DETAIL: Key (commission_id, "position")=(…, 2) already exists.
```

The user sees `vocabDuplicateKey` — *"Já existe um item com este identificador."* — which is
**misleading** (it reads as a duplicate *label*), though no raw Postgres string reaches the UI.

**Why this is MINOR and not blocking:** it is a faithful mirror of a live pre-existing defect,
not an RDR judgement error. Amendment **A6** mandates mirroring `case_narrative_types`, and the
sibling has the identical shape today — `manage/forms/narrativas/page.tsx:48` also calls
`listNarrativeTypes(commissionId)` with the archived default, and
`case_narrative_types_commission_position_key` is unique too (and *not* deferrable). Fixing it
here alone would introduce the drift A6 exists to prevent.

**Suggested follow-up (platform-wide, both modules together):** pass `includeArchived = true`
to the manager and have `move()` send the full ordered set, **or** have the reorder RPC
renumber archived rows after the supplied ids. Either fix belongs in one change across
`referral_note_types` and `case_narrative_types`.

### MINOR-2 — the platform's only Rule 7 defense has zero automated coverage

**Requirement touched:** Architecture Rule 7, as sharpened by amendment **A11**.

A11 states that `MarkdownRenderer` is *"the ONLY thing standing between a pasted `<script>` and
execution — there is no write-time net behind it."* That is correct, and it is exactly why the
component's total lack of test coverage matters more after this phase than before it.

- `src/components/forms/markdown/markdown-renderer.tsx` has **no sibling test file** — the
  `src/components/forms/markdown/` directory contains only the component.
- A repo-wide sweep of `*.test.ts`/`*.test.tsx` in `src/` and `e2e/` for `rehype`/`sanitiz`
  returns three files, none of which test it: `minutes-jobs/sanitize.test.ts` and
  `minutes-jobs/draft-roundtrip.test.ts` cover `stripHtmlTags`/`containsHtmlTag` in the **minutes**
  module, and `case-narratives.test.ts:17` only *mentions* it (see INFO-1).
- No E2E anywhere asserts that a stored `<script>` renders inert; the only two `<script>` hits in
  `e2e/` are comments about the RSC flight payload.

**Consequence:** deleting `rehypeSanitize` from the plugin array, or adding `rehypeRaw`, would
leave lint, typecheck, vitest, pgTAP **and** the full E2E suite green. The one assertion that
touches this path — `e2e/referral-registros.spec.ts:521`, `expect(card.locator('strong'))
.toHaveText('markdown')` — survives **both** mutations by construction, because react-markdown
renders `**markdown**` as `<strong>` with or without either plugin. That assertion proves the body
is *rendered as Markdown* (a real net against the bare-interpolation regression A11 warns about);
it does not and cannot prove HTML is *inert*.

**This is a missing test, not a live vulnerability** — the shipped code is correct, verified in
§2, and the frontend additionally confirmed it in a browser by storing
`Corpo **markdown** do registro. <script>alert(1)</script>` and observing a `<strong>` with no
`<script>` node. The gap is pre-existing and platform-wide (it predates this branch), so it is
recorded as a follow-up rather than a change request.

**Suggested follow-up:** a small vitest suite beside `markdown-renderer.tsx` asserting that
`<script>alert(1)</script>`, `<img src=x onerror=…>`, `javascript:` hrefs and `data:` srcs all
render inert, plus a positive control that `**bold**` still yields `<strong>` — so the suite is
provably able to go red.

### INFO-1 — a stale comment asserts coverage that does not exist

`src/lib/queries/case-narratives.test.ts:17` reads *"Markdown sanitization is covered by the
`MarkdownRenderer` tests"*. There are no `MarkdownRenderer` tests (MINOR-2). Pre-existing, and a
textbook instance of the repo's own *"a comment is an assertion that goes stale silently"* —
worth deleting or fixing alongside MINOR-2.

### INFO-2 — duplicate icon in the access dialog

`referral-case-access-dialog.tsx:45` and `:70` both use `ShieldCheck`, for **Coordenadores** and
**Qualidade**. The labels disambiguate and nothing depends on the icon, but two groups sharing a
glyph slightly weakens the scan. Cosmetic.

### INFO-3 — roster/hat asymmetry (deliberate, documented, worth restating)

`app.has_role`'s final conjunct applies the ADR-0106 active hat **only when `p_user_id =
auth.uid()`**. So other people appear in the roster regardless of the hat they are currently
wearing, while the caller's own `can_read` reflects their hat — and the caller may therefore be
absent from a group they hold a role in. ADR 0109's Consequences section states this deliberately
("the roster answers *who can you ask*, `can_read` answers *what can I do right now*"). Recorded
here only so it is not rediscovered as a bug.

---

## 7. What I could not verify

- **The supplied gate results were taken as given, not re-run:** `npm run test:db` (183 files /
  5870 tests), `ARM=census` (454/465), `ARM=hat`, `ARM=floor`, `npm run typecheck`, `npm run
  lint`, `npm run test` (1238), and the full `npm run e2e:prod` (1074 passed · 1 failed · 2 flaky
  · 9 did-not-run). Everything I relied on for a **security** conclusion was independently
  re-derived from the live catalog.
- **The `app._audit_access_authorized` dispatch arm** is covered by a targeted mutation
  (`322` §5.19) rather than by the diff-scoped sweep, for the harness reason recorded in
  §4. I confirmed the caveat is written down in the findings file itself; I did not re-run that
  mutation.
- **Runtime behaviour of the redesigned page** (bubble alignment, rail order at each breakpoint,
  motion) was reviewed from source and from the E2E specs, not by driving a browser.
</content>
</invoke>
