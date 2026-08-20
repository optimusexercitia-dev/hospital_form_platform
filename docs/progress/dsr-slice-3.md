# DSR Slice 3 — build detail (rotated from PROGRESS.md § Now)

**Rotated 2026-08-20**, verbatim apart from the mechanical link repoint. Slice 3 is still
**IN PROGRESS** — this file holds the *task detail* (§7: PROGRESS.md carries live state, not
build narrative); the live one-line status stays in PROGRESS.md § Now and points here.

⛔ **Read the ARM paragraph below before citing any authz result for this slice.** All four
arms hold and **none of them can see the gate this program changes** — coverage is a targeted
neutralization battery, not the arms.

## Backend half — build record

  🔵 **SLICE 3 — BACKEND HALF COMPLETE 2026-08-20; `frontend` still building; NOT gate-passed.**
  Migrations `20261002000000` (the widening + the case-grain fix, split so the gate change is isolated)
  + `…000100` (decision stamp, attestation columns, `adjudicate_dsr_request`, `attest_dsr_task`,
  `list_dsr_disposable_meetings`); suite `350` (56 tests); `disposeMeetingMinutes` — **ADR 0056
  Consequence (a), never built until now**; ADR 0130 **Amdt 3**. Measured on a fresh reset: pgTAP
  **6659/6659, 201 files** · `tsc` clean · vitest **1447** · **7 of 8 lint gates** (⛔ 1 eslint error
  outstanding in `frontend`'s `dsr-intake-panel.tsx:118`) · all four authz ARMs HOLD. **Zero policies
  added or changed; zero disposal gates moved.**
  ⛔ **THE FINDING, and it must NOT be recorded as coverage: all four ARMs hold and NONE of them can
  see the one authorization gate this program changes.** The ADR-0079 Amdt 1 diff-scoped recipe returns
  an **EMPTY case list** (0 `^(is_|can_|has_)` functions, 0 `create policy`), and a `CASES=`-scoped
  row-door run swept **0** — every changed object is a `prosecdef` **scalar non-bool command door**
  (jsonb/void/integer, `proretset=f`): the `FUP-AUTHZ-COMMAND-DOOR-UNSWEPT` / **Critical FUP C2** class,
  where Slice 2's five also sit. ARMs 1/3/5 bound their domain by boolean-ness, the row-door sweep by
  row-returning-ness. *A syntax-derived case list is not the property.* Coverage is instead a **37-probe
  targeted neutralization battery, all RED**, harness-proven in **both directions** first (3 controls,
  incl. the lowercase `security definer` probe correctly matching nothing — `pg_get_functiondef` emits
  it uppercase). **BLIND 0 · ERROR 0.** Two verdict limits recorded rather than papered over: `350` t17
  cannot be isolated (`ON CONFLICT` infers the same index it drops, so 44 tests red together), and t7
  takes its verdict from a control because its principal is stopped at the search door and never
  reaches the bundle.
  ⛔ **A live over-grant was made during the build and an EXISTING pin caught it** — the house
  `grant to authenticated` idiom applied to `app.patient_trajectory_bundle`, the raw **ungated** PHI
  assembler that is deliberately `service_role`-only; suite `152` §M1 went red and named it. ⭐ Lesson:
  **`CREATE OR REPLACE FUNCTION` does not reset an ACL** — "every new function needs an explicit grant"
  is a rule about *new* functions, and applying it to a *rewrite* is how a tight ACL gets widened by a
  migration that meant to change nothing about it. ✅ **Re-measured independently by the lead** across
  all 18 functions the slice created or rewrote: `patient_trajectory_bundle` + `derive_patient_key` are
  `service_role`-only, and **no function carries a NULL `proacl`**.
  ⚠ **A pgTAP fixture abort hid 37 unrun tests behind "Failed 1"** (349 aborted at fixture time; 16 of
  53 ran). Fixed — but *"nothing failed" is not "everything ran"*, again.
  ⛔ **One E2E pin deliberately left RED** (`dsr-subject-requests.spec.ts` ~248, exact task-kind array):
  the fan-out now mints one `attest_review` per prose-bearing commission. `backend` did **not** edit
  `e2e/` (§6 step 2); the **+2 delta is measured**, the full array is only *derived*, and the tester must
  read the actual rather than adopt it. Four other DSR tests are **predicted** safe by reasoning — not run.

## ↩ Fixed-bug bodies, rotated from PROGRESS.md § Bug Log 2026-08-20 — VERBATIM apart from the link repoint

> BUG-DSR-S3-001 / -002 / -003, all ✅ fixed during the slice. They remain **live one-line rows**
> in PROGRESS.md until `tester` gives each an executed pin — only the bodies moved. ⛔ Nothing here
> is closed; the Record step closes them.

🔴 **BUG-DSR-S3-001 — ✅ FIXED 2026-08-20, browser+DB proven (unclosed until `tester` re-runs the corridor) — the meeting escalation COULD NOT FIRE; the meetings-dispose UI was a door nothing could reach.** Filed 2026-08-20 (`tester`), in the corridor nobody had executed. **Repro:** DPO → request
detail → Desfecho `Atendida` → tick the ata → "Registrar decisão" → **HCDS2**, *"1 reunião(ões) …
não pertence(m) à enumeração"*; nothing recorded, nothing minted. **Mechanism:**
`list_dsr_disposable_meetings` returns **both** `taskId` and `meetingId`; the panel posts `taskId`,
`adjudicate_dsr_request` validates and mints against **meeting ids**. A one-token slip. ⛔ **Because
adjudication is the ONLY minter of `dispose_meeting`** (ADR 0130 Amdt 2 item 3 deliberately removed it
from the fan-out), **ADR 0056 Consequence (a) is NOT discharged** — `DsrMeetingDisposeDialog` is
unreachable in the product. Owner: `frontend`. ⚠ Also re-shape `DsrDisposableMeeting`: a type carrying
two uuids where the consumer needs one is what made this possible. Pinned by
`e2e/dsr-slice3-meeting-escalation.spec.ts` (own file, so its red aborts nothing).
**Fix:** the panel no longer *has* `taskId` — `Omit<DsrDisposableMeeting,"taskId">`, so the wrong id is a **compile error, not a runtime refusal**. ⭐ Pass condition was the **minted row**, not the absence of an error toast: `dispose_meeting / meeting / 4c7a5f8d-… / pending`, `outcome=granted, adjudicated=t`, measured in the DB. **ADR 0056 Consequence (a) is therefore GENUINELY discharged.** ⚠ **The escalation fieldset does NOT render on seed data alone** — the seed's one `meeting_cases` row links a *different* patient's case, so a spec that does not CONSTRUCT the link passes **vacuously**.

🟠 **BUG-DSR-S3-002 — ✅ FIXED 2026-08-20 (unclosed until pinned in E2E) — the attested tier did not tell the reviewer WHICH commission to review.** Filed
2026-08-20 (`tester`). `listMyDsrTasks` reads the commission name through an **RLS-filtered PostgREST
embed**; the Encarregado is a plain member of one commission **by design** (ADR 0130 D2), so a sibling
commission's name is unreadable and the card renders *"Comissão fora do seu acesso"* — while the task's
own procedure says *"Revise o conteúdo em texto livre DESTA COMISSÃO"*. **A named human attesting to an
unnamed scope, in a legal record.** ⭐ Same class ADR 0130 **Amdt 2 item 5** solved for hospital names
with a DEFINER lister, recurring one grain down. Owner: `backend`. **Fix:** `20261002000200` — `list_my_dsr_task_commissions`, DEFINER, gated by **`dsr_tasks_select`'s USING expression**; `commissions`' read policy does NOT move. ⭐ *"It mirrors the policy"* was **not** left as a comment — `350` **t58** asserts the **differential** (the lister's set must EQUAL the set derived from the tasks the policy actually returns, computed live), so drift reds. ⚠ **t58 and t60 are COMPLEMENTARY, neither sufficient**: the over-list probe reds t60 but not t58, because at that point the two sets coincide — a suite carrying only the differential would have scored that mutation COVERED. t61 pins the *precondition* (the DPO is NOT a member of `farmacia`), or a seed change would make t57 pass with the fix removed.

🟡 **BUG-DSR-S3-003 — ✅ FIXED 2026-08-20 (unclosed until pinned) — a hospital-scoped task was labelled an access failure.** Filed 2026-08-20
(`tester`). `notify_scrub_check` has `commission_id = null` **by design** (Q12a) yet renders the same
*"Comissão fora do seu acesso"*, stating a permission problem where none exists and collapsing "has no
commission" into "you may not read its name". Owner: `frontend`.

## ↩ Two more fixed-bug bodies, rotated 2026-08-20 — VERBATIM apart from the link repoint

> Both found by MEASURING while building Slice 3, neither its subject. Live one-line rows remain in
> PROGRESS.md until the Record step.

🟠 **BUG-XREF-CASE-ENTITYCODE-NULL — ✅ FIX LANDED 2026-08-20 (pinned, unclosed until the slice gate passes) — the patient-trajectory bundle's `entityCode` was ALWAYS NULL for
`module='case'`, so every case in every patient search renders `—`.** Filed 2026-08-20 (`backend`)
while measuring the door DSR Slice 3 widens. **Mechanism:** `app.patient_trajectory_bundle` derives it
as `select 'Caso ' || case_number from cases where id = m.entity_id` — but that `entity_id` is a
**`patient_participants` id**, not a case id. It is the *same grain defect* Slice 2 found in the case
disposal lane, surviving in a second function; `app.case_of_patient_participant` already exists to
resolve it. **Measured, not inferred** — the bundle was called and the case entry returned
`"entityCode": "—"`. ⚠ **Display-only, and NOT confined to DSR: it degrades the existing PQS
patient-search console**, a surface outside this slice's subject. **Why it survived:** no pgTAP and no
E2E assertion pins that value at all. Fix in flight in Slice 3's widening migration, in its own
labelled section, pinned on the **corrected value** (not on "not null"). ⛔ Filed rather than fixed
silently: a live defect repaired inside a gate-widening migration must be visible as a defect, or the
record shows only an improvement that nobody can date.

🟠 **BUG-DSR-COMPLETE-OVERWRITES-NOTE — ✅ FIX LANDED 2026-08-20 (unclosed until the slice gate passes) — `complete_dsr_task` overwrote `dsr_tasks.note`, destroying
the procedure text minted with the task.** Filed 2026-08-20 (`backend`), same measurement pass.
**Impact:** the note is where an `attest_review` task carries its *instructions* — the Q10a revoke →
edit → re-sign corridor a reviewer is required to follow. Completing the task erases the record of
what the reviewer was told to do, in a workflow whose output is a legal document. Fix in flight in
Slice 3 (`note` becomes the procedure and survives completion; the completion statement gets its own
fields). **Neither of these two is Slice 3's subject** — both were found by measuring rather than by
reading, which is the only reason they were found at all.

## ↩ BUG-DSR-S3-006 **and -007** bodies, rotated 2026-08-20 — VERBATIM apart from the link repoint

> ⛔ **-007 IS HERE BY ACCIDENT, and the accident is worth more than the record.** The lead rotated -006
> with a regex bounded by a **lookahead to the NEXT bug row**. -007 had been filed *between* them, so the
> span silently covered both, and replacing it with -006's pointer **deleted -007's live row**.
> ⚠ **`cmp`-verifying the DESTINATION proves the MOVE, not the CUT** — the bytes removed were a superset
> of the bytes appended, and nothing compared those two. `lint:progress` cannot see it either: it has no
> notion of *"a row that existed must still exist"*. -007's live row was restored on discovery.

> The refusal-residue defect and its five-reader sweep. Live one-line row remains in PROGRESS.md
> until pinned in E2E. ⛔ Read the sweep table before touching `dsr_tasks.status`.

🔴 **BUG-DSR-S3-006 — ✅ FIXED 2026-08-20 (`20261002000300`); unclosed until pinned in E2E.** A refused close left **all six tasks `pending`** with a working "Executar descarte" and no closed-request guard — the workflow **instructing the opposite of its own decision**, failing **OPEN against a decision to RETAIN**. ⚠ The *asymmetry* that produced it is **INTENDED and stays** (a refusal erases nothing, so the disposal tasks are a census; requiring them `done` first would force erasing exactly what was retained). Fix: a non-erasing close retires its tasks to **`blocked`**; both completion doors refuse it. ⛔ **`blocked` means *retired by decision*, not *waiting*** — that distinction lives one join away in `dsr_requests`.
⭐ **The reader sweep was the valuable half, and found FIVE readers, not the one the brief named:** `complete_dsr_task` **and its sibling `attest_dsr_task`** (fixing one of a pair is the omission class); `getDsrOutcomeRecord`, where a retired task counted as **neither** `disposed` nor `pending` so **`total` stopped equalling its parts** in the one artifact that must not make false claims; the task card; and — ⛔ **PRE-EXISTING since Slice 2** — **`list_my_executable_dsr_tasks` had NO status filter at all**, so it has been offering **`done`** tasks as executable all along. The sweep exposed it; `blocked` did not cause it. Filtered to `= 'pending'` (the actionable domain survives the next new status; `<> 'blocked'` would not), which forced repointing `349` t32q.
⛔ **The over-grant twin the lead ASKED FOR is NOT CONSTRUCTIBLE and was DELETED, not kept green:** it passed with the guard inverted to `if true` — the retirement matches nothing on the granting path because HCDS4 already requires zero pending. What protects that path is **t36 (HCDS4)**, which is falsifiable. *A green test that cannot fail is worse than no test; the lead's instruction was wrong.*

🔴 **BUG-DSR-S3-007 — the outcome record DROPS the retired remainder; the census delivered to the data
subject does not sum.** Filed 2026-08-20 (`tester`, measured). `backend`'s retirement fix landed in the
**data layer only**: `getDsrOutcomeRecord` computes `retired` for both tiers and states the invariant in
its own comment (*"THE PARTS MUST SUM: `total === disposed + pending + retired`"*) — and
`dsr-outcome-record.tsx` renders **total / disposed / pending and never `retired`** (zero occurrences of
the field anywhere in `src/components/dsr/`). **Measured consequence:** after a refusal close the record
reads **"Revisões solicitadas 3 / Revisões concluídas 0"** with nothing accounting for the 3 withdrawn —
work that a documented decision deliberately retired, rendered as work abandoned. ⛔ **This is the
artifact delivered to the data subject**, and it is the over-claim family this program exists to end,
reappearing **one layer above where it was just fixed** — true in the code that computes it, false in the
document that carries it. Owner: `frontend`. ⚠ Its pin asserts a `Retiradas` row **and**
`completed + retired === total`, with `retired > 0` asserted first so it cannot pass vacuously — ⛔ **it
must not be satisfied by asserting the current numbers; the current numbers are the defect.**
⚠ *Filed by `tester` as "BUG-DSR-S3-004", which was already taken by the `:822` locator bug — renamed on
filing. Two defects sharing an id in one component, one spec and one product, is how the wrong one gets
marked resolved.*

## ↩ BUG-DSR-S3-004 and -005 bodies (the two SPEC defects), rotated 2026-08-20 — VERBATIM apart from the link repoint

> Both are `tester`'s own spec defects, self-classified from the gate artifacts. Repairs written but
> **UNRUN** at rotation time. Live one-line rows remain in PROGRESS.md.

🟠 **BUG-DSR-S3-004 — the DSR outcome-record spec cannot reach the values it asserts, and a second
failure hides behind the first.** Filed 2026-08-20 (`tester`, self-classified from the gate's own
`error-context.md`). `dsr-slice3-adjudication.spec.ts:822` fails `element(s) not found` on an
`.sr-only` locator chain **while the artifact shows every asserted value correct in the render**
(mechanical 2/2/0, attested 3/3/5, reviewer listed, close button enabled). **Spec-only — not the door,
not the panel.** ⛔ **Two things this does NOT mean:** (a) the test died on its **first assertion,
before the close click**, so **the close-SUCCESS path remains UNEXECUTED — neither proven nor
disproven**; repairing the locator makes it *reachable*, not green. (b) `Menções removidas` is **not
unique** on that page (4 matches — the outcome record plus each completed attestation card), so the
fixed locator then hits strict-mode ambiguity: a second failure masked by the first. Repair (written,
**unrun**): scope to the named `article` and assert `data-countup`, the **server-rendered** value the
animation never writes — immune by construction rather than by relying on `prefers-reduced-motion`.

🟡 **BUG-DSR-S3-005 — an attestation-loop spec builds its completion signal out of an ABSENCE.** Filed
2026-08-20 (`tester`). `dsr-slice3-adjudication.spec.ts:714` is flaky (`[2, -3, +null]` — the second
per-commission attestation had not persisted when the table was read). Mechanism: the loop exits on
`expect(openSweeps()).toHaveCount(n-i-1)`, but `router.refresh()` remounts the list, which passes
transiently through **0** — and `toHaveCount` succeeds on the first matching poll, so a **remount gap
is indistinguishable from completion**. ⭐ The removing-a-subject vacuity family, in a legal-record
corridor. Repair (written, **unrun**): an identity-keyed poll on that specific `dsr_tasks` row reaching
`status='done'` — asserting **persistence**, which is what the corridor is about. ⚠ Fallback if it does
not hold: the `revalidatePath` + `router.refresh()` stale-RSC-payload family, **not** the door.

## The gate-vocabulary framing for the affordance gap (2026-08-20)

`backend` translated `frontend`'s finding into vocabulary this project already reasons in, which is
worth more than either team's original phrasing:

> **The corridor E2E is our `ARM=floor`.** `ARM=floor` asks *"was every reachable door CALLED at least
> once?"* — pure execution. A door called by a test that asserts nothing about it **passes floor**. That
> is why it is a *floor*, and why `ARM=census` and the neutralization sweeps exist beside it: floor
> answers *did it run*, the others answer *would anything notice if it broke*.

The `dispose_event` affordance gap is that same split **one layer up**: the corridor proved
`dispose_event` **ran** (pilot-gate item 0 executed it), and nothing asked whether the affordances beside
it were present. ⛔ **Nothing currently plays the `census` role for rendered affordances.**

⛔ **Neither teammate proposed a gate, deliberately.** *"Assert every adjacent affordance"* is not
checkable as written, and a rule nobody can enforce is this project's recurring cost — the same reason
ADR 0127 requires declarable `anchors:` before a rule is admitted. **Naming the gap honestly is the
deliverable; inventing an unenforceable check for it would be worse.**

⭐ And the companion lesson, from the same exchange: **a bounded claim is honest and it does not sweep.**
Pilot-gate item 0 claimed two facts — `pqs.a` reaches the inbox, and passes `dispose_event_phi` — and both
remain true. Bounding it that way was correct. But the affordance gap sat *inside that exact lane* and the
discharge did not surface it. Honesty and coverage are different properties, and the temptation is to read
the first as implying the second.
