# PCI + Process-Template Versioning — phase detail (archived)

Rotated out of PROGRESS.md at the §6 Record step on **2026-08-05** (CLAUDE.md §7 keeps the live
file small; every spawn reads it). Status, verdicts and the gate record stay in PROGRESS.md —
this file holds only the per-task detail.

- **PCI** — ADR [0095](../decisions/0095-process-case-integrity-audit-remediation.md) · originating [audit](../reviews/process-case-integrity-audit.md)
- **TV** — ADR [0096](../decisions/0096-process-template-versioning.md) (+ Amendments 1.1-1.7)
- **QA** — [review](../reviews/process-integrity-and-template-versioning-review.md) (r1 CHANGES REQUESTED -> r2 APPROVED)

---
### ▶ TV — Process-Template Versioning (ADR [0096](docs/decisions/0096-process-template-versioning.md)) · `frontend` rows

Branch `db/process-case-integrity`. Contract-first: built against `backend`'s committed
signatures in `src/lib/queries/process-templates.ts` + `src/lib/process-templates/actions.ts`.
Lead split the work 2026-08-04 — **components now, page re-pointing HELD** until backend's
implementations land, so the branch stays runnable and E2E-meaningful.

| Task | State |
| ---- | ----- |
| `TemplateVersionStatusBadge` — version lifecycle badge (Rascunho/Publicada/Arquivada) | ✅ complete — new file; the old `TemplateStatusBadge` is left intact for the not-yet-re-pointed pages and is deleted in the flip pass |
| `VersionHistoryPanel` — version picker/history (number · status · date · `caseCount`) | ✅ complete — Server Component, `?v=` links only, staggered via the shared `RiseInGroup` |
| `VersionWorkflowBanner` — the D2 workflow made visible (draft / published / archived) | ✅ complete — three mutually-exclusive states; the draft state names the version still in force |
| `BeginTemplateEditButton` — clone-or-resume entry point | ✅ complete — confirm dialog when it FORKS; straight-through when a draft already exists (the action is idempotent) |
| `PublishTemplateVersionButton` / `DiscardTemplateDraftButton` / `ArchiveTemplateVersionsButton` | ✅ complete — draft affordances; each dialog names what happens to the incumbent version |
| `CaseTemplateProvenance` — which version a case ran under | ✅ complete — `null` (processless) is the FIRST rendered branch, as "Sem processo", never an error path |
| Authoring seam re-keyed `templateId` → `templateVersionId` (lead ruling 2026-08-04) | ✅ complete — `PhaseSlotDialog` + `NarrativeSlotDialog` props **and** the `addTemplatePhase` FormData field; `phase-slot-card` / `narrative-slot-card` read the renamed type field |
| Page re-pointing (4 pages + case-detail layout) → versioned queries | ✅ **complete** (flip pass) |
| `TemplateBuilderShell` → `ProcessTemplateWithVersion` + version chrome | ✅ **complete** (flip pass) |

**Flip pass — ✅ COMPLETE 2026-08-05, one commit.** All eight items landed; nothing transitional
survives. Every `tsc` error the lead handed over as the map was worked, none cast past.

1. ✅ 4 pages + `(detail)/layout.tsx` re-pointed; `TemplateBuilderShell` → `ProcessTemplateWithVersion`, wiring `VersionHistoryPanel` + `VersionWorkflowBanner` + the draft affordances.
2. ✅ Both create-mode dialog values → `version.id`; both transitional comment blocks deleted.
3. ✅ `custom-field-slot-dialog.tsx` → `formData.set("templateVersionId", …)`. **Verified the read side first** (`createCustomFieldDef` reads `templateVersionId`) rather than trusting the hand-off — this seam is silent on mismatch.
4. ✅ `Sem processo` badge DELETED from `(detail)/layout.tsx`; `CaseTemplateProvenance` owns the fact.
5. ✅ Deleted `template-status-badge.tsx` — **and two more the sweep found**: `publish-template-button.tsx` + `archive-template-button.tsx`, both orphaned by the version-grain replacements and neither on the checklist.
6. ✅ Every child-authoring picker re-keyed to `version.id` (`CaseTypePicker`, `CollectsPatientPicker`, `ProcessOutcomesPicker`, `CustomFieldsCard`) — all four backing actions are version-grained now.
7. ✅ The two create-case paths keep the **TEMPLATE identity** (`create_case_from_template` resolves the published version itself via `app.published_version_of_template`) — verified against the action body, since passing a version id here would have been a plausible and wrong "consistency" edit.
8. ✅ Rail is now unconditional (version history is the point of the screen); `hasRail` removed.

**Column-name sweep** (the lead's warning: `.select()` strings are not type-checked and
`.maybeSingle<T>()` is an assertion, not a check): **N/A by construction in frontend scope** — Rule 9
means `src/app` + `src/components` contain no `.select()` / `.from()` / supabase client at all.
Swept and confirmed zero. The residual `status === "active"` hits in `src/app`/`src/components` are
**case-phase** and **indicator** status, unrelated vocabularies.

⚠ **E2E locator deltas for `tester`** (I did not touch `e2e/` — tester's scope):
| Was | Now | Sites |
| --- | --- | ----- |
| publish trigger `^Publicar$` | **`Publicar versão {N}`** (confirm button *inside* the dialog is still `Publicar`) | `phase7-cases.spec.ts:451`, `cases-outcomes-blockers.spec.ts:526` |
| post-publish banner `/ativo/i` | **`Versão {N} — em vigor`** | `phase7-cases.spec.ts:458,463,823` · `cases-outcomes-blockers.spec.ts:530` |
| archive trigger `Arquivar` | **`Arquivar processo`** (confirm still `Arquivar`) | template builder |
| card CTA `Continuar edição` | **`Continuar rascunho`** (`Ver processo` unchanged) | template list |
| `Sem processo` **badge** in the case header | same text, now the provenance meta line — **exactly one occurrence**, so strict mode is satisfied | `(detail)/layout.tsx` |
| — | **NEW** `Editar processo` button on a published version | template builder |

⚠ The `Publicar` locators in `answer-model-v2` / `ff1` / `ff2` / `ff3` specs are the **FORM**
builder's publish button, untouched. Only the two process-template sites above moved.

**Staff-route provenance — ✅ COMPLETE 2026-08-05** (lead RULING: D3 says "on the case", not "on the
coordinator case screen"; the flip checklist scoped by FILE instead of by REQUIREMENT). Two files:
`casos/[caseId]/page.tsx` (fetch added to the existing `Promise.all`) and `case-detail-view.tsx`
(new optional **header-only** prop, mirroring the existing `myRole` convention, so the coordinator
page needed no edit).

The staff view is the one that most needed this: staff FILL the phases, so "my case is running v2
while the process moved to v4" is their confusion to have. The coordinator can already open the
builder.

⚠ **It is a MOVE, not a copy.** The `Sem processo` badge left the header's badge row and the fact now
lives in the provenance meta line, mirroring the coordinator's placement. Rendering it in both places
is exactly what produced the strict-mode collision this phase already removed once.

**Verified, not assumed** (I asserted "exactly one occurrence" once before without checking, and was
right only by luck): the render sits at `case-detail-view.tsx:406`, inside the `{withHeader && …}`
block spanning 363–462. Coordinator mounts `withHeader={false}` → its copy comes from the layout.
**One occurrence per route, both routes.** The remaining `Sem processo` literal is
`create-case-dialog.tsx:323`, a `<select>` option on the cases LIST page — a different route, no
collision.

⚠ **E2E locator delta — STAFF route (`/o/[org]/c/[commission]/casos/[caseId]`):**
| Was | Now |
| --- | --- |
| `Sem processo` as a **badge** in the header badge row | same text, now the **provenance meta line** beside `Criado em` — still exactly one occurrence |
| *(nothing)* on a case WITH a process | **NEW**: `{título} · versão {N}` |
| — | ⚠ **No link on this route** — `templateVersionHref` is omitted because the builder is coordinator-gated, so it renders as plain text. A spec reaching for `getByRole('link')` here finds nothing **by design**, not by defect |

Green bar (frontend, 2026-08-04): lint **0 errors / 0 warnings** (incl. `lint:css-vars` +
`lint:memberships-door`) · `typecheck` clean · Vitest **945/945** (was 901; +44 new component tests)
· real `next build` ✅ (run with `NEXT_SCRATCH_DIST_DIR` so it could not disturb the lead's
in-flight E2E gate).

> ⚠ **Read that green bar narrowly — it is still not evidence the screens work.** The components are
> now mounted (flip pass complete), but **none of the four gates executes a page**: `tsc` does not
> render, `next build` only compiles + prerenders 18 static routes, and every screen here is dynamic
> (`ƒ`), so no version picker, workflow banner, publish flow or provenance row has ever run against a
> real row. The 44 component tests cover pure props, not the wiring. This is the FF-1 shape (3 live
> bugs survived lint + tsc + build + 457 unit + 3919 pgTAP; only E2E caught them) and the Phase-16
> shape (throwing stubs + two RSC boundary crashes cleared a full green bar).
> **`tester` is the first execution of this phase.** Expect defects there, not here.

**Component tests added (frontend-owned, co-located, DB-free)** — 4 files, **44 tests**, all
**mutation-proven** rather than merely green. Each pins a claim that otherwise lived only in a doc
comment, where this repo has repeatedly watched them go stale in silence.

| File | Tests | The claim it pins | Load-bearing assertion (verified by mutation) |
| ---- | ----- | ----------------- | --------------------------------------------- |
| `case-template-provenance.test.tsx` | 9 | `null` provenance = "Sem processo", never an error/empty (the ADR 0096 D3 trap) | the `textContent` one. ⚠ The two `queryByRole` assertions pass **vacuously** under a `return null` mutation — they guard a *different* regression (branch turned into an alert banner) |
| `version-workflow-banner.test.tsx` | 14 | the DRAFT state names the version still in force; pt-BR agreement at 0/1/many | the draft "versão N em vigor" assertion; the singular-agreement one |
| `begin-template-edit-button.test.tsx` | 9 | confirm-before-fork vs straight-through-on-resume | **the negative** — "clicking the trigger did NOT call the action". Proven against BOTH collapses: always-confirm reds the resume arm (4 tests), never-confirm reds the fork arm (3) |
| `version-history-panel.test.tsx` | 12 | order is preserved verbatim (never re-sorted); the per-version title shows only on a rename | the two ordering tests are **complementary, not redundant** — verified: an *ascending* sort reds only #1, a *descending* sort reds only #2. Deleting either opens a real hole |

Probes reverted after every round; `grep MUTATION PROBE` clean and `git diff src/components/` empty
(components byte-identical to HEAD).

⭐ **Vacuity rule — one mutation is not sufficient evidence of vacuity** → ADR
[0079](docs/decisions/0079-authz-door-blindness-standing-invariant.md) **Amendment 2** (lifted there
2026-08-04; repo-wide, pgTAP and Vitest alike). The table above is the per-file application of it.

> ⚠ **Two transitional sites in `template-builder-shell.tsx`, and they are OPPOSITE.** Both create-mode
> dialogs take the version-grain prop name while still being passed `template.id`, but for different
> reasons, and a reader who assumes one rule will get the other wrong:
>
> - **`PhaseSlotDialog`** → `addTemplatePhase` is **unwired** (`throw new Error(TV_NOT_IMPLEMENTED)`,
>   `_formData` unused). Adding a phase does not work at all until M5. The value is **inert**, and
>   nothing will fail at flip time to remind anyone to swap it.
> - **`NarrativeSlotDialog`** → `addTemplateNarrative` (in `case-narratives/actions.ts`) is **wired** and
>   passes its first argument through as `p_template_id`. The value is **live**, and `template.id` is
>   genuinely what that RPC wants today. Flip must move the value *and* backend must re-key the action.
>
> ⚠ **A third seam is not yet re-keyed and is silent:** `custom-field-slot-dialog.tsx` still submits
> `formData.set("templateId", …)`, while `createCustomFieldDef` will read `templateVersionId` at M5.
> It throws today so nothing breaks — but when M5 wires it, the field arrives as `undefined` unless the
> dialog is renamed in the same pass. Added to the flip checklist.
>
> **Correction (2026-08-04, lead-caught):** the first version of this note, and the commit message of
> `513f1d5`, both claimed `addTemplatePhase` "still sends `p_template_id`". It never did. That claim came
> from a grep hit on a *comment inside the unwired body* explaining why it was left unwired — the repo's
> own "text is not truth / resolve the VALUE, not the noun" lesson, reproduced exactly. Comments in the
> three affected files now state the mechanism as verified from the function bodies.



## Phase Status rows + gate caveats (rotated verbatim from PROGRESS.md 2026-08-08)

Caveat 1 (un-runnable `ARM=census`) was DISCHARGED 2026-08-05 — the arm landed with the
membership-hardening merge and was run against the merged catalog; residue registered in
FUP-PCITV-1 row 1. Caveat 2 was ruled VOID by the PO 2026-08-05. Rotated for the record:

### PCI row

| **PCI** | **Process/Case integrity audit remediation** [0095](docs/decisions/0095-process-case-integrity-audit-remediation.md) · [audit](docs/reviews/process-case-integrity-audit.md) · [detail](docs/progress/process-case-integrity-and-template-versioning.md) | ✅ complete | ✅ lint 0/0 · tsc · vitest 945 | ✅ pgTAP **158f/4860** fresh reset · 4 guards neutralization-proven · `ARM=floor` HOLDS · diff-scoped `ARM=policy` **0 BLIND** · `e2e:prod` **GATE GREEN 965p** (shared with TV) | ✅ **APPROVED** r2 [review](docs/reviews/process-integrity-and-template-versioning-review.md) (r1 CHANGES REQUESTED → BUG-TV-001 fixed) | ✅ 2026-08-05 | 2026-08-05 | `44cd9bb`…`f6c847d` → ff `main` |

### TV row

| **TV** | **Process-Template Versioning** [0096](docs/decisions/0096-process-template-versioning.md) (+ Amendments 1.1–1.7) — PO-directed full remodel · [detail](docs/progress/process-case-integrity-and-template-versioning.md) | ✅ complete | ✅ lint 0/0 · tsc · vitest 945 · `db reset` 284=284 | ✅ pgTAP **158f/4860 PASS** · `297` 37 assertions all mutation-proven · `ARM=floor` HOLDS · diff-scoped `ARM=policy` **6 COVERED / 0 BLIND** (was 6 BLIND) · `e2e:prod` **GATE GREEN — 965 passed · 0 failed · 0 infra · 0 flaky · 0 did-not-run · 16 batches · 0 reset FAILED · accounted 965/970** | ✅ **APPROVED** r2 [review](docs/reviews/process-integrity-and-template-versioning-review.md) | ✅ 2026-08-05 | 2026-08-05 | `6b9314c`…`f6c847d` → ff `main` |

> ⚠ **Two PCI/TV caveats survive the ✅ above — read them before treating this as deployable.**
>
> 1. **`ARM=census` was never run, and could not be.** The script on this branch supports only
>    `policy|floor|all`; the census arm — the one that catches a *newly added* gate, which passes
>    `ARM=policy` vacuously by being in no BLIND set — exists solely as uncommitted work in the
>    `feat/membership-hardening-technical-director` session, as does the CLAUDE.md §6 text requiring
>    it. QA covered the substance by hand (all 6 new policies carry ALLOW **and** DENY arms; the
>    apparent 7th gap traces to suite `188`). **Re-run `ARM=census` over these two workstreams once
>    that branch lands** — this is the one gate arm this phase's record cannot claim.
> 2. ~~**The TV backfill has never been exercised and structurally cannot be, locally** — rehearsal
>    + remote snapshot blocking before `db push`.~~ **VOID (PO, 2026-08-05): the remote database is
>    EMPTY.** The backfill therefore runs against zero rows there too — the same path `db reset` has
>    exercised green on every local run — so `scripts/verify-tv-backfill.sh` and the snapshot are
>    **no longer blocking**. ⚠ Keep the *mechanism* though, because it recurs: `db reset` applies
>    migrations **then** `seed.sql`, so a backfill is invisible to local testing **forever** (ADR
>    0096 A1.3) — a green reset is not weak evidence of a backfill, it is *no* evidence. The
>    rehearsal script stays in the repo for the first `db push` that ever meets populated data.
>
>    ⚠ **The error to learn from is mine, not the code's.** ADR 0096 justified the whole
>    backfill-not-reset strategy with one clause — *"the remote carries demo/pilot-prep data"* — and
>    it was **never verified**. It then propagated into the ADR, the migration design, this table,
>    and a lead risk assessment that called it "the largest residual risk on this branch". One
>    unchecked premise, restated four times, reads as four confirmations. **Ask what is actually in
>    an environment before designing around it** — the check took one question.
>
> *Historical:* PCI's first `e2e:prod` exited **0** while reporting `GATE RED (UNRUN)` — 655 of 962
> tests never ran, because TV migration files landed on disk mid-gate and the gate resets per batch.
> Superseded by the 965/965 run above. The lesson lives in `docs/testing/e2e-prod-build-gate.md`:
> **authoring a migration during a gate is not inert, and the exit code is not the signal.**
