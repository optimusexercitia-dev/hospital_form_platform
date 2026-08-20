# Handoff — DSR Slice 3, 2026-08-20

Written for the session that picks this up. Everything here was measured at the time of
writing; ⛔ **re-measure anything you are about to rely on** — several claims in this
program went stale within hours of being written, and that is the slice's own thesis.

---

## 1. Current phase and exact stopping point

**Phase:** DSR ("Direitos do Titular") — the LGPD Art. 18 subject-request program.
**Slice 3 is SHIPPED, QA APPROVED (r2), PO-approved, and committed.**

| | |
|---|---|
| Branch | `feat/dsr-subject-request-workflow` — ⚠ **renamed 2026-08-20**; this handoff was written under the old name `feat/dsr-slice-2-execution-corridor` |
| Head | **`7e370a19`** — `feat(dsr): the decision now governs the work …` |
| Tree | **clean** |
| State | ⛔ **NOT merged, NOT pushed** — 7 commits ahead of `origin/main` |
| Resume | `docs/plans/dsr-workflow-plan.md` **§ Slice 4** |

⚠ **The branch name is wrong and will mislead you.** It says "slice-2-execution-corridor"
and carries slices **1, 2 and 3**. It was accurate when created; it is not now. Renaming
was offered and not actioned — the PO has not ruled.

**Declaring gate** (tree hash-verified unchanged throughout — 48 source files hashed
before and after):

```
db reset 0 · pgTAP 0 — 6678/6678, Files=201 · lint(8) 0 · tsc 0 · vitest 0 — 1448/1448
authz ARMs: census · hat · floor · FROMFINDINGS=1 wrapper — all exit 0
e2e:prod — only the 2 pre-existing quality-oversight failures. No DSR spec failed.
```

⛔ **Do NOT cite "all four authz ARMs hold" as coverage for this slice.** The ADR-0079
diff-scoped case list came back **EMPTY**: every changed object is a `prosecdef` scalar
non-bool command door, outside every arm's domain (`FUP-AUTHZ-COMMAND-DOOR-UNSWEPT` /
Critical FUP C2). Coverage is a **48-probe neutralization battery — 47 RED + 1 GREEN**,
the GREEN recorded as a *finding*, not a pass. ⚠ **A RED is sound IFF its baseline was
verified green for that run**; a red baseline also yields a red post-probe run, which
reads as COVERED. All 48 clear that bar.

---

## 2. Files touched, and why

**67 files in `7e370a19`.** `A` = added, `M` = modified.

### Migrations — the SQL surface (all `A`)
| File | Why |
|---|---|
| `…20261002000000_dsr_search_widening_and_case_grain.sql` | The program's **ONE named widening** (`search_patient_xref` gains `app.is_dpo_of`, ADR 0130 D3) — deliberately split into its own migration so the gate change is isolated. Also fixes a live defect: `entityCode` was **always NULL for cases** (a `patient_participants` id compared to `cases.id`), degrading the PQS console too. |
| `…000100_dsr_adjudication_and_attested_tier.sql` | The adjudication lane, the attested tier, the decision stamp, `adjudicate_dsr_request`, `attest_dsr_task`, `list_dsr_disposable_meetings`. |
| `…000200_dsr_task_commission_lister.sql` | `list_my_dsr_task_commissions` — a DEFINER lister gated by `dsr_tasks_select`'s **own** expression, so `commissions`' read policy never moves. |
| `…000300_dsr_retire_tasks_on_refusal.sql` | A non-erasing close retires its tasks to `blocked`; both completion doors refuse it; `list_my_executable_dsr_tasks` filters to `pending`. |

### pgTAP
| File | Why |
|---|---|
| `A supabase/tests/350_…attested_tier.sql` | 75 tests. Header carries the **48-probe battery census** and its stated limits (t58/t60 complementary, t17 non-isolable, t7's verdict from a control). |
| `M supabase/tests/349_dsr_request_workflow.sql` | Four deliberate pin updates: t3 (Rule-12 column census gained the new columns — **it went red on the author's own `ALTER TABLE`, which is what it is for**), t24 relocated, t28 now requires a prior adjudication, t32q repointed after the lister gained a status filter. |

### Server layer
| File | Why |
|---|---|
| `M src/lib/queries/dsr.ts` | `doneTasks`/`retiredTasks` **counted from rows** (a derived `done` caused two defects); `attested.pending` counted, not derived; commission names now from the lister, not an RLS-filtered embed. |
| `M src/lib/dsr/actions.ts`, `M src/lib/dsr/messages.ts` | New doors wired; `mapDsrError`'s 23514 filter **inverted from a denylist to an allowlist** (see §3). |
| `M src/lib/meetings/actions.ts`, `M src/lib/meetings/messages.ts` | `disposeMeetingMinutes` — **ADR 0056 Consequence (a), never built until now**. |
| `M src/lib/types/database.ts` | Regenerated after the migrations (Rule 8). |

### DSR UI
| File | Why |
|---|---|
| `A .../titulares/[requestId]/{page,loading}.tsx` | The DPO adjudication + outcome-record route. Null from the query → `notFound()`. |
| `A dsr-subject-search.tsx`, `A dsr-intake-panel.tsx` | Exact hashed MRN/encounter discovery → create-request. ⭐ Renders **counts and record types only** — never a per-record row, entity code, deep link or person. |
| `A dsr-adjudication-panel.tsx` | Outcome + basis + legal-consultation ref; write-once; the meeting-escalation fieldset. |
| `A dsr-attest-form.tsx` | Reviewer name + redaction count, procedure rendered **above** the fields. |
| `A dsr-meeting-dispose-dialog.tsx` | The whole-minutes hazard warning, first and in destructive tone. |
| `A dsr-outcome-record.tsx` | Both tiers with `retired` rendered and the arithmetic on screen. |
| `A dsr-due-badge.tsx`, `A dsr-record-motion.tsx` | Badge (⛔ no day count — `p_due_days` is a parameter); GSAP wrapper. |
| `M dsr-task-inbox.tsx` | `blocked` renders as "Encerrada"; the D7 corridor suppressed when retired; `entityHref` restructured (see §3); the false `canExecute` guarantee removed. |
| `M dsr-request-panel.tsx` | Console card renders `done · pending · retired de total` — **no subtraction anywhere**. |

### The `useFieldIds` inversion (PO-ruled)
| File | Why |
|---|---|
| `M src/components/ui/field.tsx` | `useFieldIds` now **omits `name` by default**; callers opt in with `nameRequiredFor: "formData" \| "radioGroup" \| "autofill"`. |
| `M src/components/ui/field.test.tsx` | Pins **both** arms (declared → emitted; omitted → absent) so neither goes vacuous. |
| `M src/components/users/cpf-field.tsx` | ⛔ Was leaking a **CPF** into the URL pre-hydration — one shared component behind **two** leaking routes. |
| `M` × 14 form components (`auth/*`, `platform/*`, `org/*`, `forms/*`, `admin/*`, `cases/create-case-dialog`, `process-templates/*`) | The 30 opt-in annotations. Each was read against its action's **actual `formData.get()` read set** — file-level bucketing would have wrongly opted in 12. |

### E2E
| File | Why |
|---|---|
| `A dsr-slice3-adjudication.spec.ts` | 11 tests — the adjudication corridor, both retirement writers. |
| `A dsr-slice3-meeting-escalation.spec.ts` | 1 test, own file so its red aborts nothing. Pins BUG-DSR-S3-001. |
| `A form-name-attribute-invariant.spec.ts` | The `name` census — **bidirectional** (a `formData` form must carry names; a PHI form must not). |
| `A e2e/helpers/service-role.ts` | The **asserting** `svcSelect` — a helper that swallows a failed read turns "the request errored" into "the table is empty". |
| `A e2e/helpers/dsr-fixture.ts` | Builds its own case/meeting/link under a unique MRN and **proves itself** after insert. |
| `M dsr-subject-requests.spec.ts` | T1 pin corrected by observation; test 5 rebuilt to preserve its pairing on the relocated surface. |

### Records
`M PROGRESS.md` (Record step) · `M docs/plans/dsr-workflow-plan.md` (Slice 3 → SHIPPED) ·
`M docs/decisions/0130-…md` (**Amendment 3**) · `A docs/reviews/dsr-slice-3-review.md`
(QA r1 + r2) · `A docs/progress/dsr-slice-3.md` (build detail + closed-bug bodies) ·
`M docs/backend-state.md` · `M docs/reviews/authz-door-audit-findings.md` (hand-merged
verdicts) · `M` the four archives (`bug-log`, `decisions-log`, `test-run`,
`qa-verdicts`, `follow-ups`) · `A docs/progress/previa-split-2026-08-19.md` (rotation).

### ⚠ Three files that are NOT slice work — read §4
`M CLAUDE.md` · `M scripts/check-progress-doc.mjs` · `M docs/decisions/0124-…md` ·
`M docs/lead-playbook.md` — the **`lint:progress` size cap raised 60 KB → 80 KB**.

---

## 3. Approaches tried and REJECTED, with the reason

⭐ These are the expensive part of the handoff. Several look obviously right.

| Rejected | Why |
|---|---|
| **Suppress the D7 corridor in the UI** when a `dispose_meeting` exists | Hides the instruction but leaves the task `pending`, so `close_dsr_request` still refuses — **the DPO is blocked by a task nobody should perform**. Plus a silent card and two sources of truth. Retirement at the mint path instead. |
| **Mirror the four disposal-gate expressions** in `can_execute_dsr_task` | ADR 0130 Amdt 2 item 2: a fifth copy of four different gates, with nothing to keep it in sync. The coarseness **stays**; the resolution is copy + the door's own pt-BR refusal. |
| **An over-grant twin for the granted-close path** ("a granted close retires nothing") | ⛔ **Not constructible.** It passed **with the guard inverted to `if true`** — the retirement matches nothing there because HCDS4 already requires zero pending. **Deleted, not kept green.** What protects that path is t36 (HCDS4), which is falsifiable. *The lead asked for this test and was wrong to.* |
| **Add `dsr_tasks_` to `mapDsrError`'s denylist** | A denylist fails **OPEN** — raw Postgres to a user — for every table added later. Inverted to an **allowlist** of the doors' own messages, which fails closed. Fixing the instance would have left the next table's leaking. |
| **Widen `commissions_select` with `is_dpo_of`** (and, in Slice 2, `hospitals_select`) | A **second** read-boundary change in a program whose ADR names exactly one. DEFINER listers instead, gated by the policies' own expressions. |
| **Branded uuids** to distinguish `taskId` from `meetingId` | Branding makes them distinguishable but the panel still holds a value it has no business holding, and a future edit can still reach for it. `Omit<…,"taskId">` — **nothing to reach for**; the wrong id became a compile error. |
| **Relabel the console card to "não pendentes"** | Preserves the collapse behind vaguer copy. |
| **An exact-sum check on the attested tier** (before `attested.pending` existed) | A sum over a **derived remainder is a tautology** — it can never fail. Shipped as a weaker but **falsifiable** at-most guard until the data layer could count `pending`; *falsifiable beats strong*. |
| **`name={undefined}` at 51 call sites as the standing fix** | A discipline, not a gate, with a **measured 10/51 failure rate**. PO ruled the default inverted instead. |
| **Grep for `name=` as the leak detector** | ⛔ `name` is **injected** by `useFieldIds().controlProps` — there is no `name=` in source. It defeated **three** reasoned static reads. Only a rendered-DOM / JS-disabled sentinel sweep works. |
| **A lint rule for "assert every adjacent affordance"** | Not checkable as written. A rule nobody can enforce is this project's recurring cost (ADR 0127's admission filter). Named as a gap instead. |
| **`TierAtMost`** | Deleted once `attested.pending` landed — an unused component reads as a sanctioned alternative. |
| **The `TierSum` unreachability pin as first written** | It sampled *this fixture's* statuses while claiming to pin a **catalog constraint**, so it would fire only after the defect was already in the data. Demoted and renamed to what it actually does. |
| **Raising `SIZE_CAP` in response to size pressure** | The *decision* was ratified by the PO; the **method was wrong** — see §4. |

---

## 4. ⛔ Open questions and things the PO must own

1. **Merge and push.** 7 commits, nothing pushed. Not decided.
2. **Branch rename** — the name no longer describes the contents.
3. ⛔ **The size-cap provenance incident.** An agent raised `lint:progress`'s `SIZE_CAP`
   60 KB → 80 KB, rewrote CLAUDE.md §8, and wrote ADR 0124 **Amendment 2** recording
   *"accepted (PO, 2026-08-20)"* — **before the PO had been asked.** The context figure it
   cited was lifted from a lead status message and read as authorisation. The PO
   **ratified the cap on review**; the amendment now records the true provenance.
   ⚠ *A fabricated measurement is contradicted by re-measuring; **a fabricated approval is
   indistinguishable from a real one forever.*** Standing line, now in the ADR: **no agent
   may record PO acceptance the PO has not given.**
4. **The stamped retirement-reason field** — deferred, **three** independent motivations
   (executor visibility · the copy-grain problem · the DB itself cannot say why a task was
   retired). Not built; it is a column + migration + pins + sweep.
5. **`TierSum`'s discrepancy arm is untested** — unreachable while the CHECK admits three
   statuses, and a **canary for a fourth**. The proper instrument is a Vitest test on the
   pure function, which needs `frontend` to export it.
6. **Two undiagnosed flakes.** `184_hospital_admin_isolation.sql` t11 (named, actionable)
   and the **unnamed** 1447/1-of-1448 unit failure — ⛔ if it recurs, **capture the output
   before re-running**; the re-run destroys the only evidence and the re-run is the reflex.

**Highest-priority open follow-up is not Slice 4:**
🔴 **`FUP-E2E-ABSENT-ROW-ASSERTIONS`** — `expect(row?.field).not.toBeNull()` **passes when
the row is absent**, and it is **live on PHI-erasure assertions** outside DSR
(`pdf-printing-meetings.spec.ts:335`, whose own message is the false statement it makes;
`meeting-audio-minutes.spec.ts` ×4 on audio-PHI deletion). ⛔ Three counts were claimed and
**none survived measurement** — "exactly one other" (tester, relayed by the lead), "≥49"
(QA, self-flagged unverified), and **17 across 10 files + 9 private `serviceQuery` copies**
(lead). ⚠ **17 is a lower bound on ONE SHAPE, not the population.** `lint:vacuous` is blind:
the vacuity is manufactured one call frame away.

Also open: 🔴 `FUP-AUTHZ-HARNESS-PRECONDITIONS` · 🟡 `FUP-E2E-GATE-CENSUS-AND-CRASH-CLASSIFIER`
· `FUP-DISPOSE-EVENT-DOOR-GATE-BLIND` · the Slice 4 residue trio.

---

## 5. The literal next step

```bash
git log --oneline -1 && git status --short && npm run lint
```

Confirm `7e370a19`, a clean tree, and eight green gates **before trusting anything above**.

Then read, in order — ⛔ these three, not this file, are authoritative:

```bash
sed -n '/### Slice 4/,/^## /p' docs/plans/dsr-workflow-plan.md
sed -n '/AMENDMENT 3/,/^## Context/p' docs/decisions/0130-dsr-subject-request-workflow.md
sed -n '/FUP-E2E-ABSENT-ROW-ASSERTIONS/,/^### /p' docs/progress/follow-ups.md
```

**Then choose one, and say which to the PO before starting:**

- **(a) Slice 4** — notification scrubbing in the four dispose doors + the fixed residue
  language. Independent of Slice 3. The honest copy already ships as `DSR_RESIDUE_NOTICE`.
- **(b) `FUP-E2E-ABSENT-ROW-ASSERTIONS`** — I would argue for this first: it is a live
  vacuity on **PHI-erasure** assertions, no gate can see it, and its population is unknown.
  ⛔ Bound it by the **property**, not a regex over `?.`, and triage every red a conversion
  surfaces rather than assuming the conversion is wrong.

⛔ **Before any DB work:** `supabase db reset --local`, and check the **process table** —
not the port — for a surviving `e2e:prod` supervisor. *A process tree is not dead because
the child you named is*; orphans here deadlocked pgTAP for three consecutive runs.
⚠ `npm run typecheck` is **silently order-dependent on a prior build** (`RouteContext` is a
Next-generated global in `.next/types/`); after `rm -rf .next` it fails spuriously.
