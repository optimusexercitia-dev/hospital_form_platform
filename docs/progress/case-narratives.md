# Archive — Increment: Case Narratives

> Archived verbatim from PROGRESS.md on 2026-06-25 at the §7 progress-tracker cleanup.
> This is the durable detail; PROGRESS.md keeps only a one-line pointer.

### Increment: Case Narratives (feature-flagged; plan `on-this-platform-a-zazzy-waterfall.md`)

Frontend tasks (owned by `frontend`; build against the FROZEN contract in
`src/lib/queries/case-narratives.ts` + `src/lib/case-narratives/actions.ts`):

| # | Frontend task | Status |
| - | ------------- | ------ |
| FE-1 | `case-narrative-card.tsx` — inline expand-to-edit (clone interview-summary-editor) | ✅ done |
| FE-2 | Case detail left column → `mergeCaseLayout` interleave (phase/narrative) + page filter + flag gate | ✅ done |
| FE-3 | Process builder — combined reorderable phase/narrative list + slot card/dialog + flag gate | ✅ done |
| FE-4 | Settings — `narrativas` route + `narrative-type-manager` + Narrativas tab | ✅ done |
| FE-5 | Advisory soft close warning (expected+empty narratives) in conclude dialog | ✅ done |
| FE-6 | Flag-gate everything via `narrativesEnabled()`; `npm run lint` + `npm run typecheck` clean | ✅ done |

> Verification (preview/E2E) deferred until lead confirms backend RPCs deployed to remote.
>
> **Frontend build complete.** All FE tasks done. `src/app/**` + `src/components/**` are
> lint-clean (0/0) and typecheck-clean. The only `tsc` errors are in BACKEND-owned
> `src/lib/case-narratives/actions.ts` + `src/lib/queries/case-narratives.ts` (+ the
> `.test.ts`): their in-flight bodies reference tables/RPCs/`CaseStatus 'aberto'` not yet in
> the generated `database.ts` — i.e. backend must push the migrations + regenerate types.
> The frozen SIGNATURES my code consumes resolve fine. Flagged to lead.
>
> **QA CHANGES REQUESTED — addressed (2026-06-19):**
> - BLOCK-1 (rename bug) FIXED in `narrative-type-dialog.tsx`: the edit branch now sets
>   `narrativeTypeId` (was `id`), matching `updateNarrativeType`'s `formData.get('narrativeTypeId')`.
>   Create path was already correct (`commissionId`/`label`/`description`).
> - BLOCK-2 (a11y on the narrative-slot Editar button): NO CHANGE NEEDED — the button already
>   has `aria-label={`Editar a narrativa ${slotLabel}`}` (line 122), matching the up/down/remove
>   siblings. QA's diagnosis didn't match the committed code; flagged to lead, did not diverge.
>   Lint + typecheck re-confirmed clean on my surface.

> **Open follow-up (not a blocker):** the E2E *regression* suite is not green against a prod
> build — pre-existing ≤13 test-harness debt (animation-timing flakiness + shared-DB retry
> pollution), tracked under Follow-ups. Phase-14 specs are clean (65/65). Next phase should
> consider the harness fix (`reducedMotion` in the Playwright config + per-test DB isolation).

> **Completed-phase detail is archived** under [`docs/progress/`](docs/progress/) to
> keep this file small (every teammate spawn reads it). The cross-phase logs below —
> Bug Log, Test Run Summary, QA Verdicts, Decisions, Follow-ups — stay here.
>
> - Phase 0 — [docs/progress/phase-0.md](docs/progress/phase-0.md)
> - Phase 1 — [docs/progress/phase-1.md](docs/progress/phase-1.md)
> - Phase 2 — [docs/progress/phase-2.md](docs/progress/phase-2.md)
> - Phase 3 — [docs/progress/phase-3.md](docs/progress/phase-3.md)
> - Phase 4 — [docs/progress/phase-4.md](docs/progress/phase-4.md)
> - Phase 5 — [docs/progress/phase-5.md](docs/progress/phase-5.md)
> - Phase 6 — [docs/progress/phase-6.md](docs/progress/phase-6.md)
> - Phase 7 — [docs/progress/phase-7.md](docs/progress/phase-7.md)
> - Phase 8 — [docs/progress/phase-8.md](docs/progress/phase-8.md)
> - Phase 10 — [docs/progress/phase-10.md](docs/progress/phase-10.md)
> - Phase 11 — [docs/progress/phase-11.md](docs/progress/phase-11.md)
> - Phase 12 — [docs/progress/phase-12.md](docs/progress/phase-12.md)
> - Phase 13 — [docs/progress/phase-13.md](docs/progress/phase-13.md)
> - Phase 14a — [docs/progress/phase-14a.md](docs/progress/phase-14a.md)
> - Phase 14b–d — [docs/progress/phase-14bcd.md](docs/progress/phase-14bcd.md)

