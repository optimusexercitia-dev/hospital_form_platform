# DM5·S6 — QA review (canon rewrite + program exit sweep)

**Date:** 2026-08-17 · **Commit under review:** `e1c74529` (diff = `ARCHITECTURE.md` ·
`PROGRESS.md` · `docs/backend-state.md`; **0** `src/` files, **0** migrations — verified from the
diff, which is what makes the recorded "diff-scoped `ARM=policy` NOT APPLICABLE" claim true).

## Verdict

**r1: ⛔ CHANGES REQUESTED** — six findings, **all record defects** (the DM5 pattern holds: six QA
rounds across S4/S5 and now S6, and not one code change has ever been requested).
**r2: ✅ APPROVED** — all six fixed same-day (docs-only edits, verified below); gate step 1 was
re-measured in full by this QA rather than argued unaffected.

### Scope of this verdict — written down so it cannot be inferred wrong

This is the **S6 SLICE verdict**. It authorizes S6's build work and nothing else:

- **Gate step 2 (`e2e:prod`) is NOT covered** — not run, PO-scheduled separately.
- **Gate step 4 (PO approval) is owed**, and must surface the items in §5 below.
- **DM5's PHASE QA remains owed.** S3/S4/S5/S6 verdicts are slice verdicts; none of them, nor
  their sum, is the phase verdict. The phase QA follows step 2, per gate order.
- 🔴 `FUP-DM5-SUPERSEDE-SERVING-COLLISION` is untouched and open; S6 correctly did not close over
  it. 🔒 The UNREHEARSED-runbook condition still binds.

## 1. Method

Everything S6 calls "measured" was **re-derived independently**, not read: fresh
`supabase db reset --local` (exit 0, unpiped), then catalog queries against `pg_class`,
`pg_policy`, `pg_proc` (+ `prosecdef`), `pg_attribute`, `pg_constraint`, `pg_index`,
`storage.buckets`, `pg_policies`, `supabase_migrations.schema_migrations`; the exit sweep re-run
by identifier over `src/`+`e2e/`; and the full gate step 1 re-run (pgTAP, vitest, lint×5, tsc,
four authz ARMs, named by ARM).

## 2. What reproduced exactly (the positive census)

| S6 claim | re-measured | verdict |
| --- | --- | --- |
| registry 411 == 411 | 411 (DB) == 411 (files) | ✅ |
| RLS 165/165 via the Rule 1 inline SQL | 165/165 · `relkind='p'` count **0** (the `'r'` bound hides nothing) | ✅ |
| 13 DM tables, exactly 1 policy each | 13 rows, all `count=1`, names exactly the §2 list | ✅ |
| §2 column lists "derived from `pg_attribute`" | all six substrate tables match column-for-column, in order | ✅ |
| 38 document doors / 5 service-role-only | 38 / 5, the five names exact | ✅ |
| 4 buckets | `documents-standard` · `documents-phi` · `form-assets` · `meeting-audio` | ✅ |
| `storage.objects` 3 INSERT + 1 SELECT | 3×`polcmd='a'` + 1×`'r'`, names exact; both document INSERT policies bind `bucket_id` **and** `app.storage_upload_reserved(...)` | ✅ |
| census re-derivation 141 `public` / 145 `app`+`public` | public 141, app 4 | ✅ |
| kernel delegation (the falsified-then-corrected Rule 9 story) | `open_document_version` + `open_printed_document` → `app.resolve_document_version_bytes` **true/true**; `open_referral_snapshot_document` **false**; all four DEFINER | ✅ |
| two coordinate-resolving signers, exhaustive | `documents/actions.ts:253-267` reads `document_version_files⋈file_objects` admin-side then signs; `referrals/actions.ts:568-578` reads `file_objects` admin-side then signs; no other module signs document bytes (`minutes-jobs`:175 signs `meeting-audio`, `queries/forms.ts`:1328 signs `form-assets` — both out-of-scope, D13, and neither reads `file_objects`) | ✅ |
| `route.ts` reads no table | confirmed — coordinates come from `open_printed_document`'s return | ✅ |
| `.from('form-assets')` ×2 | forms.ts:1327 + forms/actions.ts:2159 | ✅ |
| exit-sweep count: 28 retired-bucket literals in `src/`+`e2e/`, all comments, 1 live `domId` | reproduces **exactly** — but only under an undisclosed bound (finding F4) | ⚠ |
| DVF: nothing makes `file_object_id` unique | unique indexes are `(id)` and `(document_version_id, rendition_kind)` only | ✅ |
| `disposal_state` = ADR 0121 lifecycle | `none/disposal_pending/disposed` | ✅ |
| ZERO RLS policies read a flag | 0 | ✅ |
| gate step 1 numbers | pgTAP **194f/6392 PASS** (0 `not ok`) · vitest **89f/1304** · lint **5/5 exit 0** · tsc **0** · `ARM=census` **546/570 HOLDS** · `ARM=hat` **3 allowlisted** · `ARM=floor` **74 allowlisted, all resolve** · `FROMFINDINGS=1 ARM=wrapper` **BLIND 41 ⊆ allowlist** | ✅ |

## 3. Findings (r1) — and the fix each received

**F1 · BLOCKING — the END STATE block INVERTED its source measurement.**
`backend-state.md:46` read *"measured: 51 of 52 document functions … read a flag."* The source
(`FUP-DM5-REMOTE-STATE-MEASURED`, follow-ups.md) measured the opposite direction: **51 do NOT read
a flag — exactly one does** (`app.compute_due_document_review_notifications`). Re-measured at QA:
under the door-name regex, 6 of 75 `app`+`public` functions read `feature_enabled`; the "51 DO"
direction is not reproducible under any bound. The block's own rule is *"every figure here carries
the query that produces it"* — this figure carried none, and the same inverted phrasing sat in
**two sibling records** (`dm5-handoff.md:794`, `dm5-wave-d-retirement.md:1600`), making this the
third-writer instance of describing a control wrong while citing it. **Fixed in all three places**,
direction corrected, query + source attached, inversion recorded loudly.

**F2 · BLOCKING — §2 named an `upload_state` that does not exist.**
`ARCHITECTURE.md:300` ended the D9 machine at `→ active`. The live vocabulary
(`file_objects_upload_state_check`) is `reserved/uploaded/verifying/scan_pending/clean/`
`unscanned_accepted/infected/rejected/abandoned/failed` — **no `active`**; `'active'` belongs to
`documents.status`. A canon sentence borrowing a state from a different column's vocabulary, in
the slice whose purpose was canon-vs-catalog fidelity. **Fixed**: chain ends at `clean`, the
borrow is named.

**F3 · MAJOR — the "servable predicate" was half-enforced.**
§2 asserted *"`status = 'active'` plus `deleted_at is null` is the servable predicate."* Measured:
neither `app.resolve_document_version_bytes` (refuses on `status <> 'active'` and file-grain
`disposal_state <> 'none'`), nor either serve door, nor any documents-module query reads
`deleted_at` at all. The only guard is `documents_soft_delete_stamped` (stamp forced when
`status='soft_deleted'`); nothing forbids `active`+stamped. **Fixed**: canon now states the
enforced predicate (`status` alone + file-grain disposal), calls `deleted_at` the stamp, and
flags the unconstructed corner explicitly instead of implying a check that exists nowhere.

**F4 · MINOR — the sweep's 28 reproduces only under an undisclosed bound.**
The count is exact **iff** the pattern covers the 7 hyphenated retired-bucket names and excludes
the bare name `attachments` — which is also a feature-flag key and appears **live** three times as
`featureEnabled('attachments')` (attachments/actions.ts:35, interviews/actions.ts:798/:834).
Those are flag keys, not bucket references (the `case_patient` name-collision class), so the
sweep's conclusion stands — but the exclusion was silent, and a re-runner using all 8 names finds
"live hits" the record says don't exist. **Fixed** in the PROGRESS.md sweep record: bound stated,
the three hits dispositioned.

**F5 · MINOR — Rule 9's rationale over-generalized at its own grain.**
*"The DB doors … return IDs only"* is DM2's fact, and false today for `open_printed_document`,
which returns `TABLE(storage_bucket, storage_path, status, contains_phi)` since ADR 0120 D7/D12 —
the very reason the same rule's route.ts sentence ("takes coordinates from the door's return
value") is true. The two sentences contradicted each other three paragraphs apart. **Fixed**: the
D7/D12 exception is named inline.

**F6 · MAJOR — the scope promise and the delivery were left contradicting each other.**
`backend-state.md` still declared *"The full document-surface rewrite is an explicit DM5·S6
deliverable, not optional cleanup"* while the S6-authored END STATE block says the S2/S3/S5
per-slice sections remain unwritten. Delivered ≠ promised, disclosed in one place and contradicted
in another — the shape that lets an obligation die silently when S6 closes. **Fixed**: the promise
line now records what S6 actually delivered (the measured END STATE block) and that the per-slice
sections are an explicitly unowned item, not an S6 leftover.

## 4. QA-added coverage — the declared hole, closed at the right layer

S6 declared *"NOT COVERED: `supabase/` SQL was not swept."* Sweeping migration **files** would have
been the wrong instrument anyway (stale by design). This QA swept the **live catalog** instead:
`pg_get_functiondef` over every `app`+`public` function and all of `pg_policies` for
quote-bounded retired-bucket literals → **0 functions, 0 policies**. Together with
`storage.buckets` = the 4 expected rows, the retirement is clean at every layer that executes.

## 5. Carried forward to gate step 4 (PO) — none of these are S6 defects

1. **ADR 0120 D9's Cloud question** (amend with a Cloud-specific verification step, or ratify the
   under-count class as unverified) — deferred "to when S6 reaches it"; S6 has now reached it.
2. ADR 0114 **O1 / O2 / O4** + **S1-O3**, and **FUP-DM5-D11** ("decide later") — PO decisions owed.
3. 🔴 `FUP-DM5-SUPERSEDE-SERVING-COLLISION` — open, PO-owned; S6 did not (and may not) close it.
4. F6's re-homed question: are the per-slice S2/S3/S5 `backend-state.md` sections still wanted,
   and owned by whom?
5. F3's unmeasured corner: can any writer produce `documents.status='active'` with `deleted_at`
   set? If the corner matters, it wants a CHECK (backend, 🟡).

## 6. r2 — verification of the fixes

Each fix re-read in place; F1's three sites re-grepped (`51 of 52` now appears only inside
corrected sentences that state the true direction); F2/F3/F5 re-checked against the catalog facts
they now assert; F4's bound reproduces the 28 exactly as now stated; F6's two passages no longer
contradict. The fixes are docs-only (0 `src/`, 0 migrations), and gate step 1 was **re-measured
green in full by this QA on today's fresh reset** (table in §2), so the "changes loop to step 1"
requirement is discharged by measurement, not by argument.

**r2: ✅ APPROVED** — slice scope only, as bounded above.
