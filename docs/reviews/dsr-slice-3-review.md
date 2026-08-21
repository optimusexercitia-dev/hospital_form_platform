# QA review — DSR Slice 3 (adjudication, attested tier, the one named widening)

**Reviewer:** `qa` · **Date:** 2026-08-20 · **Subject:** ADR
[0130](../decisions/0130-dsr-subject-request-workflow.md) (Decisions 1–13 + Amendments 1–3),
[plan](../plans/dsr-workflow-plan.md) § Slice 3, build record
[dsr-slice-3.md](../progress/dsr-slice-3.md).

# VERDICT: CHANGES REQUESTED

Two blocking items. Both are the same failure this slice already filed twice and
declared fixed — **a claim that is true in the layer that computes it and false in
the layer that carries it**, and **an assertion that goes green having proved
nothing**. Neither is a security hole; the authorization work in this slice is the
strongest part of it. Everything else below is Major / Minor and can follow.

---

## ⛔ Method bound — read this before citing any finding

The local database was **unusable** for the whole of this review (the lead's
`e2e:prod` gate resets it between batches). **No catalog read, no pgTAP run, no
dev server, no Playwright run happened.** Per CLAUDE.md's binding exception,
migration text is stale by design and the live catalog is the sole truth for
schema / RLS / `prosecdef` / ACL questions — so **no schema or authorization
conclusion in this report is stated as measured.** Everything of that class is on
the deferred list at the end, which is a work item, not a gap.

**Attribution key**, applied to every finding:

- **[V]** — I read the file myself and quote the line. The claim is about the
  source as committed.
- **[R]** — reported to me by a delegated read or by a teammate's record, and I
  have **not** independently confirmed it.
- **[D]** — deferred: needs the catalog.

---

# BLOCKING

## B1 · The console list counts a RETIRED task as a COMPLETED one — the `blocked` reader sweep is not complete **[V]**

`src/components/dsr/dsr-request-panel.tsx:71,83`:

```tsx
const done = request.totalTasks - request.pendingTasks;
...
{done}/{request.totalTasks} tarefas concluídas
```

fed by `src/lib/queries/dsr.ts:326-331`, which counts **only** `pending`:

```ts
c.total += 1
if (t.status === 'pending') c.pending += 1
```

A `blocked` (retired-by-decision) task therefore increments `total` and not
`pending`, and falls into `done` by subtraction.

**Measured consequence, by construction:** after a `refused_retention` close on
the six-task fan-out that BUG-DSR-S3-006 documents, the Encarregado's own console
card renders **"6/6 tarefas concluídas"** — beside the outcome badge
`Recusada — retenção` (`:100-104`) — asserting that six PHI erasures were carried
out when **zero** were. The detail page one click away says "Retirados pela
decisão: 6". Two surfaces of the same record, contradicting each other, in the
direction that over-claims erasure.

**Why this is blocking and not Minor:**

1. It is **BUG-DSR-S3-007 exactly**, one surface over. -007 was filed 🔴 for
   `dsr-outcome-record.tsx` rendering the retirement as work *abandoned*; this
   renders it as work *completed*, which is strictly worse.
2. **ADR 0130 Amendment 3 item 7 asserts the sweep was exhaustive** — *"all nine
   SQL readers plus the TS and UI readers were swept first"*, and
   `20261002000300`'s header enumerates two non-SQL readers by name
   (`getDsrOutcomeRecord`, the task card). This reader is in neither list. The
   ADR's completeness claim is therefore false as written, and an ADR that says
   a sweep is done is how the next reader stops looking.
3. It is the over-claim family (`FUP-DISPOSE-DIALOG-OVERCLAIM`, ADR 0056 (b))
   that this whole program exists to end.

**It cannot be fixed in the component alone.** `DsrRequestRow`
(`src/lib/queries/dsr.ts:93-108`) exposes only `pendingTasks` / `totalTasks`;
there is no `doneTasks` / `retiredTasks`. The fix is a data-layer change plus the
render. ⛔ **Do not fix it by relabelling `done` to "não pendentes"** — that
preserves the collapse and hides it behind vaguer copy.

⚠ **And the instrument, not just the fix.** The tier arithmetic on the detail
page is guarded by `TierSum`; this card has a two-part subtraction that is an
identity and can never disagree with itself. Whatever replaces it should be
counted from rows the way `getDsrOutcomeRecord` now counts them
(`src/lib/queries/dsr.ts:433-444`), for the reason stated at `:153-159`.

## B2 · The PHI-disposal corridor's keystone assertion passes when the row is absent **[V]**

`e2e/dsr-subject-requests.spec.ts:83-93` carries a **local copy** of `svcSelect`
that swallows a failed read:

```ts
async function svcSelect<T = Record<string, unknown>>(...): Promise<T[]> {
  const res = await req.get(`${SUPABASE_URL}/rest/v1/${table}?${qs}`, { headers: svcHeaders() })
  if (!res.ok()) return []
  return (await res.json()) as T[]
}
```

and `:290-295` consumes it through an optional chain:

```ts
const [event] = await svcSelect<{ phi_disposed_at: string | null }>(
  request, 'patient_safety_event', `select=phi_disposed_at&id=eq.${fixtureEventId}`,
)
expect(event?.phi_disposed_at).not.toBeNull()
```

If the read errors **or the row does not exist**, `event` is `undefined`,
`event?.phi_disposed_at` is `undefined`, and `expect(undefined).not.toBeNull()`
**passes**. The same helper feeds `:297-302`'s `expect(patient).toHaveLength(0)`,
which a swallowed `[]` satisfies for the wrong reason.

This is the assertion that proves the PHI was actually erased — the corridor
pilot-gate item 0 was discharged on.

**What makes it blocking rather than a nit:** the repo already wrote the fix and
the reasoning down. `e2e/helpers/service-role.ts:48-64` exports an asserting
`svcSelect` whose docblock says, verbatim, *"⚠ ASSERTS `res.ok()` RATHER THAN
RETURNING `[]` ON FAILURE… the silent-return family this repo has already paid
for."* The sibling spec `e2e/dsr-slice3-adjudication.spec.ts:113-123` uses the
correct form. **Only this file — the PHI-erasure one — carries the forbidden
copy.**

Fix: import the shared helper, drop the local copy, and destructure without `?.`
so an absent row throws instead of passing. ⚠ Note also that `lint:vacuous`
(gate 5) did **not** catch this; whether its detector should grow an
`expect(x?.y).not.toBeNull()` rule is a separate question for the lead, not a
blocker here.

---

# MAJOR — fix in this slice or file with an owner

## M1 · `mapDsrError` returns raw Postgres constraint text for every `dsr_tasks_*` CHECK **[V]**

`src/lib/dsr/messages.ts:266-272`:

```ts
case '23514':
  return error.message && !error.message.includes('dsr_requests_')
    ? error.message
    : DSR_MESSAGES.unexpected
```

The filter recognises a bare table CHECK by the substring `dsr_requests_`. Slice 3
added **three CHECK constraints on the other table** (`20261002000100:94-122`):
`dsr_tasks_attested_redactions_nonneg`, `dsr_tasks_attestation_shape`,
`dsr_tasks_attestation_only_on_attest`. Postgres's message for any of them
(`… violates check constraint "dsr_tasks_attestation_shape"`) does not contain
`dsr_requests_`, so it is returned **verbatim to the UI** — a raw Postgres error
reaching a user, against CLAUDE.md §8.

All three are currently pre-empted by `attest_dsr_task`'s own pt-BR checks
(`20261002000300:350-363`), so this is a degraded backstop rather than a live
leak today. It is still the "guard one of a pair" omission class this slice's own
record celebrates catching elsewhere. Fix: recognise the constraint-name shape for
both tables (`dsr_requests_` **or** `dsr_tasks_`), or invert to an allowlist of
the doors' own SQLSTATE/message pairs.

## M2 · An escalated meeting keeps a LIVE attestation telling the executor to reopen and re-sign the ata the decision ordered erased **[V]**

`adjudicate_dsr_request` (`20261002000100:513-529`) mints a `dispose_meeting`
task for each escalated meeting and **does nothing to the `attest_review` task the
fan-out already minted for that same meeting** (`20261002000100:291-307`). I read
the whole function; there is no update, no completion, no retirement.

Consequences, all on the granting path:

- Both tasks sit in the inbox for the same meeting. `close_dsr_request`'s HCDS4
  gate (`20261002000300:159-167`) counts **every** pending task, so a granted
  close requires the reviewer to complete the attestation for an ata that the
  same decision ordered fully erased.
- `src/components/dsr/dsr-task-inbox.tsx:256` prints the minted procedure on any
  non-retired task, and `dsr-attest-form.tsx:133-147` renders
  `DSR_ATTEST_PROCEDURE_MEETING` — *"reabra a reunião, edite o trecho e assine
  novamente"*. **An executor who follows it reopens and re-signs a meeting,
  bumping the revision and invalidating registered prints (ADR 0126)**, on a
  meeting the workflow is about to erase wholesale.

That harm is **BUG-DSR-S3-008's**, on the granting path instead of the refusal
path. -008 was fixed by suppressing the corridor text on `blocked`; this sibling
case has no suppression and no test. `e2e/dsr-slice3-meeting-escalation.spec.ts`
asserts the mint (`:152-157`) and says nothing about the surviving attestation.

Options (backend's call, not mine): retire the sibling `attest_review` to a
settled state on escalation, or leave it and suppress/replace its corridor copy
when a `dispose_meeting` task exists for the same `entity_id`. ⛔ Whichever is
chosen, it needs its own pin — the current state is reachable from the seed the
escalation spec constructs.

## M3 · The Rule-12 control the migration NAMES does not exist in the shipped copy **[V]**

`20261002000100:50-53` states, as the reason the new columns are Rule-12-safe:

> *"The UI copy and the minted procedure both instruct the reviewer to record WHAT
> THEY DID, never to quote the passage they found."*

What actually ships:

- The minted procedures (`20261002000100:296-298`, `:325-329`) and
  `DSR_ATTEST_PROCEDURE_COMMON` (`src/lib/dsr/messages.ts:94-99`) say *"Registre o
  seu nome e a quantidade de menções removidas"* and *"a plataforma nunca exibe a
  identidade do titular"*. **Neither contains any instruction not to write the
  subject's identity into the note.**
- The note field's own placeholder (`src/components/dsr/dsr-attest-form.tsx:201`)
  reads **"Quais conteúdos foram lidos e o que foi encontrado."** — which invites
  recording *what was found*, i.e. the passage.

`dsr_tasks.completion_note` is free text in a `dsr_*` table. A reviewer following
the placeholder literally writes cleartext patient identity into it, which is the
fourth-PHI-module state Rule 12 forbids. The **column** pins (350 t11/t12) are
correct and hold; the **content** control is copy, and the copy does not say it.

Fix is one string plus one sentence of field description. The finding is not the
missing copy — it is that a migration comment asserts a control as existing, on
the exact axis it was written to protect. (The "a comment is an assertion" family;
CLAUDE.md's own memory index carries four prior instances.)

## M4 · `canExecute` does not mean "can pass the door's gate" for two of the four kinds **[V for the code, D for the live gates]**

`src/components/dsr/dsr-task-inbox.tsx:313-323` asserts:

> *"A disposal affordance fires a module door, so it is shown only to someone who
> can pass that door's gate."*

`canExecute` comes from `list_my_executable_dsr_tasks`
(`20261002000300:397-410`), whose predicate is `app.can_execute_dsr_task`. Read
from Slice 2's migration text (`20261001000100:147-165` — **[D]**, catalog not
consulted), that predicate admits, for a commission-scoped task:
`is_staff_admin_of_for` **or** `is_tenancy_admin_of_for` **or**
`is_pqs_operator_of_for`.

The plan's measured gate table (§0) gives `dispose_case_phi` → `is_staff_admin_of`
**only**, and `dispose_meeting_minutes` → `is_staff_admin_of` **or**
`is_tenancy_admin_of`. So a PQS operator (and, for cases, a tenancy admin) is
offered "Executar descarte" / "Descartar a ata" on tasks whose door will refuse
them.

The failure is **safe** — the door refuses, no gate is bypassed — but it is
exactly the offered-button-the-door-refuses defect that ADR 0130 Amendment 2 item
5 introduced `list_my_executable_dsr_tasks` to eliminate. It removed the
Encarregado and stopped. `20261002000100:832-834` acknowledges the predicate's
"deliberate coarseness" at the door; the UI comment claims the stronger property
the predicate does not deliver. Either narrow the predicate per kind, or correct
the comment and say what `canExecute` actually means.

---

# MINOR / hygiene

## m1 · `TierSum`'s unreachability canary is at the wrong grain, and the arm is not actually unconstructible **[V]**

`e2e/dsr-subject-requests.spec.ts:699-718`. The docblock claims it *"pins the
PRECONDITION of unreachability"* and cites `dsr_tasks_status_check` read from the
catalog. The code reads `select=status&request_id=eq.${requestId}` — **the
statuses present on the one request this spec drove**, every one of which the spec
itself wrote. It cannot observe a fourth value admitted by the CHECK but not
produced by this fixture — which is *precisely* the scenario the docblock says it
exists to catch (`blocked` sat admitted-but-unwritten for a whole slice). The
canary fires only after the defect is already in this fixture's data.

The anti-vacuity guard at `:708` is present and correct; the grain is the problem.
Two better instruments, both cheap:

1. **pgTAP** on `pg_get_constraintdef` of `dsr_tasks_status_check` — reds the
   moment the domain widens, regardless of data. That is the claim the docblock
   makes.
2. **A Vitest unit test of `TierSum`.** It is a pure function of `{total, parts}`
   (`src/components/dsr/dsr-outcome-record.tsx:242-260`). `TierSum({total: 5,
   parts: [1,1,1]})` renders the alert arm directly. Calling the arm "unexercised"
   under-claims: it is unreachable through the *data*, not through the
   *component*. Export it and test it.

⛔ Consequence for the record: `:664-667`'s
`getByRole('alert')).toHaveCount(0)` is a **declared-unfalsifiable assertion** —
the spec proves in its own comments that it cannot fail. It is honestly labelled
(`:663-664`), which is why this is Minor and not Major.

## m2 · Two rewritten doors carry INHERITED neutralization verdicts **[V]**

Suite `350`'s header states the doctrine itself: *"t33 and t39 are REWRITES of 349
t28 and t24. A rewritten pin is a NEW pin and is in no BLIND set, so it inherits
NOTHING from the verdict its predecessor carried."* The same logic is symmetric
for a rewritten **door**, and two of them were not re-probed in this slice's
battery:

| door | rewritten in S3 | gate probe in S3 battery | verdict source |
|---|---|---|---|
| `create_dsr_request` | yes (`…000100`) | no `gate opened` probe | 349's list (Slice 2 body) |
| `complete_dsr_task` | **twice** (`…000100`, `…000300`) | only `attest refusal off`, `blocked arm removed` | 349's list (Slice 2 body) |

`complete_dsr_task`'s **EFFECT check** is the structural embodiment of ADR 0130
Decision 2 ("the DSR never fires a door") — Amendment 2 item 2 calls it *"strictly
stronger… structural rather than promised"*. Its only neutralization verdict
(`349`: `complete_dsr_task effect check … RED (t19)`) is against a body that has
since been rewritten twice, and the rewrite inserted **two new early raises**
(the `attest_review` refusal and the `blocked` arm) *before* the check. I have no
reason to believe t19 went vacuous — the check is present and unchanged at
`20261002000300:257-271` — but the verdict is inherited, and this project's own
doctrine says an inherited verdict is not a verdict.

Cost to close: two probes (`create_dsr_request` gate opened; `complete_dsr_task`
effect check removed) against the current bodies. ~4 minutes.

## m3 · The battery covers bodies, not ACLs — and there is no standing pin for the new doors' grants **[V]**

The 46-probe battery mutates function **bodies**. The one ACL defect this slice
produced (`app.patient_trajectory_bundle` over-granted to `authenticated`) was
caught by an **existing** pin in suite `152` §M1 — which covers that one function.
The other seventeen created-or-rewritten functions were verified by a **one-time
manual re-measurement** by the lead (recorded in `dsr-slice-3.md:39-41`) — **[R]**,
I did not re-run it. A one-time measurement is not a gate: a future migration
re-granting one of the six new `public.` doors to `anon` reds nothing.

Note also that `20261002000000:229-230` restates
`revoke … from public, anon; grant … to authenticated, service_role` on
`search_patient_xref`, which is a **rewrite** — the exact idiom-on-a-rewrite the
same file spends fifteen lines warning about at `:145-162`. It is almost certainly
a no-op restatement of the pre-existing ACL, but that is **[D]**, not measured.

## m4 · PROGRESS.md contradicts itself about whether Slice 3 exists **[V]**

`PROGRESS.md:40` — *"✅ Slices 1 AND 2 SHIPPED (19th / 20th); **Slices 3–4 NOT
started**."* `PROGRESS.md:78` — *"🔵 **SLICE 3 — backend half + UI COMPLETE
2026-08-20**"*. The live-state file, which §7 makes the single source of truth for
status, says both. `lint:progress` cannot see it. Fix in the Record step.

## m5 · The uncaptured unit-test failure is not in the record at all **[V]**

Searched `PROGRESS.md`, `docs/progress/dsr-slice-3.md` and `docs/reviews/`: every
occurrence is a flat **"vitest 1447"** (`PROGRESS.md:63`, `:297`,
`dsr-slice-3.md:18`). There is **no mention anywhere** of a 1448-test run, a
1447/1 result, or an undiagnosed failure. A reader of the record sees a clean
pass count.

That anomaly needs a line — a follow-up if it is to be diagnosed later, or a
sentence in the gate row if it is being accepted. An anomaly that only one
session remembers is not recorded.

## m6 · `listMyDsrTasks`'s ordering docblock is false **[V]**

`src/lib/queries/dsr.ts:216` promises *"pending first then most recent"*; `:248`
orders `status` ascending, which for text is `blocked` < `done` < `pending` — so
retired tasks come **first** out of PostgREST. No user impact today because
`dsr-task-inbox.tsx:55-56,78` re-partitions, but the query layer's contract is
wrong and a second consumer inherits it. (Pre-existing shape; `blocked` made it
visible.)

## m7 · The inbox header states pendentes with no retired figure **[V]**

`dsr-task-inbox.tsx:63` renders `{pending.length} pendentes`. After a refusal
close that reads **"0 pendentes"** with nothing beside it — the same
"silence reads as completion" shape the outcome record spends forty lines of
comment guarding against, on the surface the executor actually looks at. The
per-card `Encerrada` badge carries the fact; the header summary does not.

## m8 · ADR 0056's follow-up (a) still says the affordance does not exist **[V]**

`docs/decisions/0056-phi-disposal-closure-narrowed-claim.md:82` still reads
*"(a) a `dispose_meeting_minutes` action + UI (none exists)"*. Slice 3 built both
(`src/lib/meetings/actions.ts:481-504`, `src/components/dsr/dsr-meeting-dispose-dialog.tsx`,
reachable at `dsr-task-inbox.tsx:374-383`). ADR 0130 Amdt 3 and the plan record the
discharge; ADR 0056 does not. One line, in the Record step.

## m9 · Two DEFINER listers read across the caller's commission boundary without an audit row **[V for the code, D for the precedent]**

`list_dsr_disposable_meetings` and `list_my_dsr_task_commissions` are `prosecdef`
and return governance identifiers (meeting number/date, commission name) from
commissions the caller is not a member of. Neither calls `app.audit_write`. Rule 11
requires *"reads of another member's data"* to be logged. The payloads are
low-sensitivity and non-PHI, and the precedent (`list_my_nsp_hospitals`) may not
audit either — **[D]**. Raising it so the answer is decided rather than inherited.

## m10 · The reviewer's full name is stated to be delivered to the data subject **[V]**

`src/lib/dsr/messages.ts:99` and `dsr-attest-form.tsx:162-163` both tell the
reviewer their name *"entra no registro de desfecho entregue ao titular"*, and
`dsr-outcome-record.tsx:185-198` renders the reviewer list. ADR 0130 Decision 6
says the tier is *"reviewed by a named human, with the redaction count
recorded"* — recorded, not delivered. Disclosing staff names to a data subject
(who may be in dispute with the institution) is a decision, and it is currently
made in a copy string. Worth one PO confirmation and one ADR line either way.

## m11 · The unroutable-row refusal is the one cross-hospital signal in the intake door **[V]**

`create_dsr_request` (`20261002000100:211-218`) counts unroutable `patient_xref`
rows **without a hospital filter** — it cannot filter, since such rows have no
hospital. A DPO of Hospital A therefore learns, via HCDS2, that the platform holds
a commission-less record for that patient key. Because an unroutable row belongs
to *no* controller, this names no hospital and I do not read it as an ADR 0130
Decision 4 breach — but it is the only place in the door where a fact outside the
caller's hospital reaches them, and the migration's comment at `:208-210` discusses
only the *other* (correctly silent) case. Recording it so the next reader does not
have to re-derive it.

---

# Findings on the E2E specs, ranked **[V for the four quoted; R for the rest]**

Beyond B2, an adversarial pass over the four specs (delegated breadth, spot-verified
by me):

1. **[V]** `form-name-attribute-invariant.spec.ts:100-106` and `:135-140` — the
   two "paired positives" are
   `getByText(/nenhum registro encontrado/i).or(getByText(/registros? localizados?/i))`
   and `getByRole('region', {name:/trajetória/i}).or(getByText(/nenhum registro/i))`.
   The comment says this is *"the control that tells the two apart"*. **It does
   not**: a search that submitted an empty payload renders exactly *"nenhum
   registro encontrado"* — the left branch. Both tests use `SEEDED_MRN =
   'PRT-0099123'`, documented at `:58-59` as a subject **with** records, so the hit
   branch was available and was not asserted. These are the two surfaces whose
   URL-leak fix the spec exists to protect.
2. **[V]** Same file, `:423-424` — *"The four rows carrying `note` above are
   skipped"*. There are **five** (`:278`, `:310`, `:316`, `:320`, `:325`), and the
   sentence's own enumeration names all five. Coverage lost is **5 of 16 surfaces
   and 9 of the 30 declared call sites** — `expect(total).toBe(30)` at `:337` still
   asserts 30 while only 21 are ever inspected.
3. **[V]** Same file, `:328-339` — the "arithmetic guard" compares a literal in
   the file against a sum of literals in the same file. It runs no browser, reads
   no source, executes no grep. It cannot detect the drift it is named for
   (a `nameRequiredFor` call site added or removed in `src/`). The docblock
   half-admits this at `:333-335`; the test title does not.
4. **[R]** Same file, `:539-544` — `if (!userId || !originalName) return` in
   `afterAll`, against a docblock promising restoration *"UNCONDITIONALLY"*
   (`:518-523`). A seeded profile with a falsy `full_name` keeps its E2E-mangled
   name for the rest of the ~900-test suite.
5. **[R]** `dsr-slice3-adjudication.spec.ts:730-733` —
   `expect(item.description).not.toBe(AGENDA_PROSE)` is satisfied by any altered
   value, including the original prose with one character changed, while the
   docblock claims *"every agenda item's prose is gone"*. The sibling assertion
   `expect(meeting.minutes_md).toBeNull()` (`:713`) is the correct shape.
6. **[R]** `dsr-slice3-adjudication.spec.ts:883` — `.every()` on an array that
   would be `true` if empty; saved only by the ordering of `:881`. And `:861`/`:881`
   `.sort()` numeric arrays lexicographically (latent; fixture digits are single).
7. **[R]** `dsr-slice3-meeting-escalation.spec.ts:159-173` — the terminal
   "affordance is reachable" assertion is **not scoped to this fixture's meeting or
   request**; a leaked `dispose_meeting` task from the sibling spec's in-body
   cleanup (`dsr-slice3-adjudication.spec.ts:1090`) satisfies it, and two such
   cards make it a strict-mode failure reported as a product defect. Otherwise this
   is the cleanest of the four files by a wide margin, and its helper
   (`e2e/helpers/dsr-fixture.ts:194-219`) is the only fixture in the set that
   **proves itself**.
8. **[R]** `dsr-slice3-adjudication.spec.ts:202-285` duplicates
   `helpers/dsr-fixture.ts` **minus** those three self-proof assertions — the file
   whose corridor most depends on the xref existing is the one that does not check
   it. Its four bare `const [x] = await svcSelect(...)` seed destructures abort all
   eleven serial tests behind one red, which is the fixture-abort failure this very
   slice already paid for once (`349` aborted, 37 tests unrun).
9. **[R]** Vacuous-by-implication pairs:
   `dsr-slice3-adjudication.spec.ts:367` (implied by `:366`), `:387` (implied by
   `:354-360`); `form-name…:98`, `:491`, `:492` (each implied by the `$`-anchored
   `toHaveURL` above it); `:106` duplicates `:98`.
10. **[R]** `dsr-subject-requests.spec.ts:526-556` — the terminal test's
    *"CURRENTLY RED / DO NOT FIX BY ASSERTING THE CURRENT NUMBERS"* docblock is
    **stale**: `retired` is now rendered in both tiers
    (`dsr-outcome-record.tsx:123,157`), so the test it describes as red should be
    green. A stale "this is broken" banner is as misleading as a stale "this is
    fixed" one.

⛔ **None of 1–10 is blocking**, but items 1 and 2 mean the invariant spec's green
is narrower than its own summary states, and the summary is what a future session
will read.

---

# Item-by-item answers to the audit brief

**A · Requirements.** Plan § Slice 3 items 2, 3, 4 and ADR 0056 Consequence (a)
are all **delivered** [V]: the widening (`20261002000000:170-230`), the intake +
adjudication lanes (`dsr-intake-panel.tsx`, `dsr-adjudication-panel.tsx`,
`/o/[org]/titulares/[requestId]`), the attested tier with a named reviewer and a
required count (`attest_dsr_task`, `dsr-attest-form.tsx`), and the meetings-dispose
action + dialog. Plan item 5 (counsel integration) is delivered with the copy
behind constants (`DSR_REFUSAL_RETENTION_BASIS`, `messages.ts`) as the plan asked.

**Delivered beyond what any criterion asked for**, and correctly so: the
`adjudicate_dsr_request` door itself (the plan assumed adjudication was a UI step
on `close_dsr_request` — measurement showed `adjudicated` was unreachable),
`list_my_dsr_task_commissions` (BUG-DSR-S3-002), the refusal-retirement mechanism
(BUG-DSR-S3-006), and two out-of-scope defect fixes
(`BUG-XREF-CASE-ENTITYCODE-NULL`, `BUG-DSR-COMPLETE-OVERWRITES-NOTE`). Each is
recorded in ADR 0130 Amendment 3 with its measurement. **Nothing is claimed but
undelivered.**

**B · The named widening — no second widening found. [V for the migration text, D
for the catalog.]** Grepped all four Slice-3 migrations for
`create|alter|drop policy`, `enable row level security`, `create role` and
`alter default`: **zero matches**. `search_patient_xref`'s body gains exactly one
disjunct, `or app.is_dpo_of(p_hospital_id)` (`20261002000000:198`), and nothing
else in that body changes. `commissions`, `hospitals`, `dsr_requests` and
`dsr_tasks` read policies are untouched in text.

The two DEFINER listers both re-use the policies' own predicates rather than
copying them, and — importantly — the mirror is **asserted, not promised**: `350`
t59 pins the differential (the lister's set must equal the set derived from what
`dsr_tasks_select` actually returns) and t60 is the over-list twin. The author's
own recorded caveat is correct and worth repeating: **t58 and t60 are
complementary and neither is sufficient**, because at that point in the suite the
hospital's commission set and the visible-tasks' set coincide, so the differential
alone cannot separate them. That is exactly the right way to report a pin's limit.

⚠ `list_dsr_disposable_meetings` and `list_my_dsr_task_commissions` **do** return
rows the caller could not read directly (a sibling commission's name, a sibling
commission's meeting number/date). That is not a *widening* — it is the ADR 0052
lister pattern the ADR authorises — but it is a real, if narrow, read expansion,
and calling it "returns nothing the caller could not already reach" is imprecise.
The precise statement is: *nothing beyond the governance identity of rows the
`dsr_tasks_select` policy already returns to them.*

**C · Rule 12 — structurally intact, one control claimed that is not there.**
`350` t11/t12 pin the **positive** column list of both tables via `set_eq` [V] —
the right instrument, and exactly what the plan's § 4 risk note asked for.
`create_dsr_request` hashes the MRN server-side and never persists it; the audit
metadata carries counts and `file_ref`, never the key or a name
(`20261002000100:368-376`); the intake copy explicitly states that the reference,
not the identity, is what the platform holds (`dsr-intake-panel.tsx:231-234`).
`attested_by_name` is a staff attestor's signature with a named precedent
(`meeting_attendees.external_name`), not subject data. **The residual is M3**: the
free-text `completion_note` has only copy standing between it and cleartext
identity, and the copy does not say what the migration says it says.

**D · The authz coverage claim — audited, and it holds, with three bounded gaps.**

The finding itself is stated correctly and prominently, in three places
(`dsr-slice-3.md:21-33`, plan § Slice 3, `350`'s header): **all four ARMs hold and
none can see this slice's gate change**, because every changed object is a
`prosecdef` scalar non-bool command door outside every arm's domain
(`FUP-AUTHZ-COMMAND-DOOR-UNSWEPT` / Critical FUP C2), and the diff-scoped recipe
returns an empty case list. The instruction *"Do not read a green arm as a verdict
for this class"* is exactly right.

**Does the battery cover what the arms cannot?** Substantially yes. Mapped against
the arms' questions:

| the arm's question | covered by the battery? |
|---|---|
| `ARM=policy`-style: *would anything notice if this gate opened?* | **Yes** — this is what 45 of the 46 probes ask, across 8 functions and 2 policies, one at a time, every restore hash-verified. |
| `ARM=census`: *has anything ever asked about this door?* | **Yes**, by construction — each door has ≥1 probe. |
| `ARM=floor`: *was every door called?* | **Yes** — every new door is exercised by `350`. |
| `ARM=hat`: *does a door read `memberships` without the caller's hat?* | **Not applicable** — grep of all four migrations for `memberships`: **zero matches** [V]; every gate delegates to `app.is_dpo_of` / `app.can_execute_dsr_task`. **[D]** to confirm those predicates from the catalog. |
| `ARM=wrapper`: *a `public` INVOKER wrapper in front of an `app` DEFINER body?* | **Not applicable** — grep for `security invoker`: **zero matches** [V]; all new doors are themselves DEFINER. **[D]**. |

**Honesty of the limits: high, and better than most.** Four are recorded rather
than papered over, and I could not find a fifth being hidden:

- the **GREEN probe** (retirement guard inverted → suite fully PASS) is reported
  as *"the most important line here"*, and the unconstructible over-grant twin was
  **deleted rather than left green** — the correct call, and the lead's instruction
  to write it is correctly recorded as wrong;
- the **second green** (`attest_dsr_task`'s `blocked` arm, un-keystoned because
  the author invented the fix and nobody was owed a test for it) is named as such;
- **t17 cannot be isolated** (`ON CONFLICT` infers the index it drops → 44 reds
  together), stated with the reason no mutation separates them;
- **t7's verdict comes from CTL3**, not the scope probe, because its principal is
  stopped at the search door — attributing it to the scope probe would have
  recorded a verdict for the wrong mechanism.

The census arithmetic is also **derived, not typed**: I ran the header's own
`grep -cE '^--   [a-z_].*\.\.+ RED'` and got **45** [V], which with the one GREEN
sums to the stated 46. The header records that this same line previously said 37
beside a heading saying 46, through two edits that "updated the count".

**The three gaps** are m2 (two rewritten doors carry inherited gate/effect
verdicts), m3 (ACLs are outside the battery and have a one-time manual measurement
rather than a pin), and the standing **[D]** that none of this was catalog-verified
by me.

**E · The `blocked` reader sweep is NOT complete.** One SQL-side and TS-side
reader was missed — `listDsrRequests` + `dsr-request-panel` (**B1**). Everything
else in the enumeration checks out against the source [V]: `complete_dsr_task` and
`attest_dsr_task` both carry the arm (`20261002000300:247-250`, `:345-348`),
`list_my_executable_dsr_tasks` is filtered to the actionable domain
(`= 'pending'`, correctly chosen over `<> 'blocked'`), `getDsrOutcomeRecord`
counts `retired` on both tiers from rows, the task card branches
`isDone`/`isRetired`/`isSettled` and suppresses the corridor text, and
`dsr-adjudication-panel.tsx:398-400`'s `outstanding` subtracts `retired`. The
sweep's *method* was right; its *boundary* was the files the brief and the bug
named, and the console-list card sat outside them. (The "enumeration bounded by a
syntax rather than a property" family, one more time.)

**F · Test quality — see the ranked list above.** B2 is the blocking one. m1 is
the answer on `TierSum`: the tester's unreachability pin is the **right idea and
the wrong instrument** — it samples this fixture's data where it claims to pin a
catalog constraint, and the arm is directly constructible in a unit test, so
"unexercised" understates what is available. Two cheap instruments named.

**G · Honesty of the record — mostly real, three corrections.** The
"could not verify" lists are genuine, unusually detailed, and mostly accurate:
`350`'s two verdict limits, the deleted over-grant twin, the ARM-coverage bound,
the layer-2 asymmetry, and the affordance-census gap (*"Nothing currently plays
the `census` role for rendered affordances"*, with both teammates deliberately
declining to invent an unenforceable rule — the right call). Corrections:

- **5 declared skips [V]** — correct as a total, but the spec's own prose says
  "four" (finding 2 above), and the arithmetic guard still asserts 30 call sites
  while 21 are inspected.
- **"of 16 opt-in surfaces only 3 submitted for real"** — I cannot reproduce that
  number. **Zero** of the 16 table surfaces submit; the file's own gap block says
  *"`login-form` is already exercised by every spec's `cachedSignIn`, so 15
  remain"* (`:421-422`) [V], and the four real submissions elsewhere in the file
  are the DSR search, the NSP search (neither of which proves arrival — finding 1),
  the CPF lookup, and the profile edit [R]. The honest figure is **2 surfaces with
  arrival evidence, plus login implicitly**.
- **The uncaptured unit-test failure is not in the record at all** — m5.
- `TierSum`'s discrepancy arm unexercised: **stated** [V], correctly, at
  `dsr-subject-requests.spec.ts:663-698`.

**H · The lead's own record — accurate, and complete on all three items I could
check.**

- **BUG-DSR-S3-007's deleted row.** The live row is present at `PROGRESS.md:218`,
  and `:219` carries a dedicated line recording that the row *"was DELETED by the
  lead's own -006 rotation and restored on discovery"*, with the mechanism
  (lookahead-bounded regex), the reason `cmp` did not catch it (*"proves the MOVE,
  not the CUT"*), and the gate gap (*"`lint:progress` has no 'a row that existed
  must still exist' check"*). `dsr-slice-3.md:108-115` carries the same, marked as
  an accident whose lesson outweighs the record. **Accurate and complete** [V].
  ⭐ The one thing not yet done is the obvious one: nothing prevents a recurrence.
  A rotation that diffs `git show HEAD:PROGRESS.md` against the post-edit file for
  *removed lines that were not appended anywhere* is a five-line check; a
  `lint:progress` row-survival rule may not be admissible, but the mechanic is.
- **The unconstructible over-grant twin.** Recorded honestly, in both the suite
  header (*"the lead's instruction was wrong"*) and `dsr-slice-3.md:122`, and the
  twin was deleted rather than kept green. That is the correct outcome; asking for
  it was a reasonable instruction that measurement refuted, and the refutation is
  what got written down. **Accurate** [V].
- **The `entityHref` fix.** The shipped code shows the root cause was in fact
  found and fixed, not patched: `dsr-task-inbox.tsx:135-177` replaces the whole
  `commissionSlug && entityId` precondition with a per-module switch, and its
  docblock states the precise mechanism (*"events are NOT commission-scoped, so
  they never have a commission href to build"*) plus the reason it went unnoticed
  (*"the run proved the disposal BUTTON fires; nothing asserted the link beside
  it"*). **The record is accurate and the code is better than the fix that was
  approved** [V].

---

# What checked out — stated so the CHANGES REQUESTED verdict is not read as a
# judgement on the whole slice

- **Zero policy statements and zero disposal-gate changes** across four
  migrations [V, D for the catalog]. The one authorised widening is one disjunct,
  isolated in its own migration so the diff-scoped case list is two objects.
- **The widening's keystone is a content differential, not an absence of raise** —
  and the header says why `lives_ok` would have been vacuous *by construction*
  here, plus why the negative arms are only meaningful beside t4. That reasoning is
  the standard the rest of the repo should be held to.
- **Rule 12 pinned positively** (`set_eq` on both column lists), which is the
  shape the plan's risk note specified and the one that survives a column being
  removed.
- **The harness was proven in both directions before any verdict was believed** —
  three controls, including the lowercase `security definer` probe that correctly
  matched nothing.
- **`close` consuming the decision** (`HCDS5` on mismatch, `granted` requiring a
  prior adjudication, the direct path still stamping `adjudicated_at`) is a clean
  piece of design, and `350` t16/t35/t38 pin all three arms.
- **`0` as a required answer** on `attested_redactions`, with `NULL` reserved for
  "nobody said", and the CHECK preventing attestation columns on the other five
  kinds. The outcome record then sums `redactions` over completed attestations
  only, and says why coalescing would be wrong (`queries/dsr.ts:445-448`).
- **`attested.pending` counted from rows rather than derived**, which is what makes
  the exact-sum check falsifiable rather than an identity — with the note that it
  must revert if `pending` ever goes back to being a remainder.
- **a11y** [V]: the outcome record's animated numeral is `aria-hidden` with the
  true value in an `sr-only` sibling, so assistive tech never announces an
  intermediate tally; every DSR input goes through `useFieldIds` with
  `FieldLabel`/`FieldDescription`/`FieldError` wiring; `noValidate` with pt-BR
  field errors.
- **pt-BR throughout**, with the refusal basis behind a constant and no CFM
  1821/2007 anywhere in the copy — including a pin on the negative
  (`dsr-subject-requests.spec.ts:363-365`).

---

# ⛔ Deferred — needs catalog verification

Everything below is a question I could not answer without the live catalog. None
is a finding; each is a check to run once the DB is free. **[D]** throughout.

1. **`pg_policies` diff for the whole slice.** Confirm that no policy on
   `commissions`, `hospitals`, `meetings`, `dsr_requests`, `dsr_tasks`,
   `patient_xref` changed. Migration text shows zero policy statements; the catalog
   is the authority.
2. **`prosecdef` census for the 18 created-or-rewritten functions**, beside
   `pg_policies`, per the standing invariant.
3. **ACLs (`proacl`) for all 18**, diffed from the catalog, specifically:
   - `app.patient_trajectory_bundle` and `app.derive_patient_key` are
     `service_role`-only;
   - **`public.search_patient_xref`'s ACL is unchanged by the restated grant at
     `20261002000000:229-230`** — that is a rewrite, and the restatement is the
     idiom-on-a-rewrite this slice already paid for once;
   - no function carries a NULL `proacl` (a NULL default includes PUBLIC);
   - `anon` holds EXECUTE on none of the six `public.` DSR doors.
4. **`app.can_execute_dsr_task`'s live body** vs `dispose_case_phi`'s and
   `dispose_meeting_minutes`'s live gates — the M4 mismatch, and whether the
   over-admission is per-kind or uniform.
5. **`app.is_dpo_of` / `is_dpo_of_for` live bodies** — confirm the `is_active` arm
   and the grant-row arm are both present (349's battery covered them against
   Slice 2's body).
6. **`dsr_tasks_status_check`'s live definition** — the exact admitted value set,
   for m1's proposed pgTAP pin.
7. **`dsr_requests` / `dsr_tasks` column lists from `information_schema`** — confirm
   `350` t11/t12's `set_eq` expectations match the live tables.
8. **The two inherited neutralization verdicts (m2)** — re-probe
   `create_dsr_request`'s gate and `complete_dsr_task`'s EFFECT check against the
   **current** bodies.
9. **B1's rendered numbers** — construct a `refused_retention` close on a full
   fan-out and read the console card. I derived "6/6 tarefas concluídas"
   arithmetically from the source; confirm it in a browser before writing the fix,
   so the fix is pinned on the *corrected* value rather than on "not wrong".
10. **M2's duplicate-task state** — escalate one meeting on a granted adjudication
    and confirm both the `dispose_meeting` and the sibling `attest_review` are
    pending, and that the attestation card still renders the revoke-corridor text.
11. **Rule 11 precedent for m9** — does `list_my_nsp_hospitals` (or any ADR-0052
    lister) emit an audit row? The answer decides whether the two new listers are
    consistent with the pattern or a gap in it.
12. **The pgTAP counts.** `350` declares `select plan(69)` and `349`
    `select plan(53)` [V, read from the files]; `dsr-slice-3.md:16` says
    "suite `350` (56 tests)". Confirm the live run's count and correct the record —
    a prose number about a machine-checkable fact, which is precisely what `350`'s
    own header refuses to restate.

---

**CHANGES REQUESTED** — B1 and B2 block. M1–M4 should be fixed or filed with an
owner before the Record step; the Minor items and the deferred list can travel with
the phase.

---
---

# ROUND 2 — 2026-08-20

# VERDICT: APPROVED

Both blockers are closed at the source, all four Majors are closed, and **all twelve
deferred items are now settled against the live catalog — every one of them
favourably.** The new findings below are documentation-grade: a stale count inside
the paragraph that warns about stale counts, an ADR instruction the fix superseded,
and one of the lead's three self-reported process errors that reached the record
only as an ambient condition. None blocks. They belong in the §6 step-5 Record edit,
which is the next thing that happens anyway.

## Method — what I actually did this round

The DB was free, so **[D]** is now **[V]** for the whole deferred list. I ran `psql`
against the local stack for every catalog claim below.

⛔ **What I did NOT do, so no verdict here rests on it:** I did not re-run the
neutralization battery (it writes to the shared stack, and the tree is frozen), did
not run `e2e:prod`, did not start a dev server, and did not run the full pgTAP
suite. The gate numbers and the two re-earned battery verdicts are **[R]** —
assessed below on their structure, not re-measured.

---

## The two blockers — both CLOSED **[V]**

**B1 · CLOSED.** `DsrRequestRow` now carries four counts and
`src/lib/queries/dsr.ts:358-361` counts each from rows:

```ts
c.total += 1
if (t.status === 'pending') c.pending += 1
else if (t.status === 'done') c.done += 1
else if (t.status === 'blocked') c.retired += 1
```

`dsr-request-panel.tsx:96-108` renders `done · pending · [retired] de total` with no
subtraction. I grepped the whole DSR surface for surviving `total −` arithmetic:
**one match, and it is inside a comment explaining why not to derive**
(`dsr-outcome-record.tsx:164`). The docblock at `queries/dsr.ts:109-122` states the
"6/6 tarefas concluídas" defect and — the part that matters more — states *why the
instrument changed*: a two-part subtraction is an identity, so no assertion over it
can fail. That is the correct generalisation, not just the correct number.

**B2 · CLOSED, and better than the fix I asked for.** All three DSR specs now import
the asserting helper (`e2e/dsr-subject-requests.spec.ts:3`,
`dsr-slice3-adjudication.spec.ts:3`, `dsr-slice3-meeting-escalation.spec.ts:6`). The
keystone at `:255-264` now asserts existence **first**:

```ts
expect(events, 'the fixture event row is gone — an absent row must not be read as "disposed"').toHaveLength(1)
expect(events[0].phi_disposed_at).not.toBeNull()
```

⭐ **The second vacuity was independent of the first and I only found one of them.**
`tester` found that `event?.` yields `undefined` for an absent row and `undefined`
passes `.not.toBeNull()` — so fixing only the swallowing helper would have left a
legitimately empty result set still reporting that PHI was erased. Two independent
vacuities stacked on the same assertion, and the review caught one. Recording that
because it is the honest attribution and because it is the more useful half: *a
vacuity found is not a vacuity class cleared.*

⚠ **The relay correction is confirmed and it sharpens the finding.** The adjudication
spec did not import the shared helper in r1 — it carried its own **asserting** copy,
so my r1 sentence "the sibling uses the correct form" was right about the behaviour
and wrong about the mechanism.

⛔ **But the census attached to that correction is wrong, and wrong in the direction
that closes the question — see r2-B3 immediately below.**

### r2-B3 · "14 spec files carry private copies, and exactly one other swallows" is materially wrong — I measured it **[V]**

This is the one thing in the r2 hand-off I could not confirm, and it is the item I
most needed to. My own measurements over `e2e/`:

| claim | stated | measured **[V]** |
|---|---|---|
| files importing the shared asserting helper | — | **3** (`dsr-subject-requests`, `dsr-slice3-adjudication`, `form-name-attribute-invariant`) **+1 transitively** — `helpers/dsr-fixture.ts:9` re-exports it to `dsr-slice3-meeting-escalation` |
| private read helpers that **swallow** | "exactly one other" | **≥ 49 by two grep shapes alone**: 8 matching `if (!res.ok…) return []`, and 41 matching the no-check `Array.isArray(data) ? (data as T[]) : []` form |

A delegated exhaustive sweep puts the full figure at **85 private copies, 67
swallowing, 11 asserting, and zero files that define a copy *and* import the shared
helper** — that total is **[R]**, but the ≥49 floor and the 3+1 import count are
mine.

**Three spot-checks I read myself [V]:**

1. `e2e/administrativo.spec.ts:110-121` — `dbQuery`, ending `if (!res.ok()) return []`.
   Confirmed; the lead's `:121` is the swallow line, the function opens at `:110`.
2. `e2e/ethics-e2-procedure.spec.ts:201` and its three sibling `ethics-*` files carry
   a `fetch`-based `dbQuery` with the same `if (!res.ok) return []`.
3. ⛔ **`e2e/pdf-printing-meetings.spec.ts:331-335` is B2's exact defect — both
   halves — in another PHI-disposal assertion:**

```ts
const [row] = await serviceQuery<{ phi_disposed_at: string | null; status: string }>(
  page, `meetings?id=eq.${meetingId}&select=phi_disposed_at,status`,
)
expect(row?.phi_disposed_at, 'the RPC actually disposed this fixture').not.toBeNull()
```

A swallowing helper feeding an optional chain into `.not.toBeNull()` — and its own
failure message, *"the RPC actually disposed this fixture"*, is precisely the
statement an absent row makes it assert falsely.

**This does not block Slice 3**, and I want that boundary stated plainly: the three
DSR specs are clean, the pattern is pre-existing everywhere else, and a frozen tree
is not where you touch eighty unrelated specs. **What must not survive is the
number.** "Exactly one other" is a closed question; "≥49, one of them a live PHI
assertion" is an open one, and the difference decides whether anyone ever looks
again. This is the partial-fix-reads-as-a-complete-one family: B2 was blocking
*because* of this pattern, and a census that shrinks the pattern to a single
grandfathered line retires the lesson along with the bug.

**Disposition:** file it with the measured numbers, name
`pdf-printing-meetings.spec.ts:331` explicitly as a second instance of the blocking
class (not a stylistic one), and correct the standing-gap line before the Record
step. ⚠ Also worth noting for whoever picks it up: `lint:vacuous` (gate 5) sees none
of this — its subject is the assertion, and the vacuity here is manufactured one
call frame away in the helper.

---

## The four Majors — all CLOSED **[V]**, three with a residual worth naming

**M1 · CLOSED, and the fix is the direction rather than the enumeration.**
`mapDsrError`'s 23514 branch is now an allowlist over `DSR_DOOR_CHECK_MESSAGES`. The
comment states the reasoning I would have wanted and did not ask for: *"A denylist of
things that are unsafe fails OPEN on anything new… An allowlist of the doors' OWN
messages fails CLOSED."* Adding `dsr_tasks_` would have fixed today's three and left
the next table's leaking.

⭐ **And I checked the allowlist against the doors, which is now cheap.** Extracting
every `check_violation` message from every `public.*dsr*` function via
`pg_get_functiondef` returns exactly five strings, and they are exactly the five in
the TS set — **no stale entry, no missing entry.** Nothing keeps them in sync, but
the inversion is what makes that acceptable: drift degrades to a generic pt-BR
sentence, never to a raw Postgres string. That is the payoff of the allowlist and
should be recorded as such rather than as an open gap.

**M2 · CLOSED on the mint path, verified in the live catalog.**
`adjudicate_dsr_request`'s body now carries, after the `dispose_meeting` mint, an
update setting the sibling `attest_review` for the same meeting to `blocked`. Three
things about it are right beyond the fix itself: (a) it is bounded to
`status = 'pending'`, so a **completed** attestation keeps its named statement and
redaction count — retiring those would erase evidence, not moot work; (b) it retires
rather than hides, because suppressing the UI copy would leave a `pending` task
blocking the granted close via HCDS4 — *"hiding an instruction while leaving its
blocking effect is worse than the instruction"*; (c) the stranding bound is reasoned
rather than waved off, and lands on the right side: an unexecuted escalation surfaces
as an **open request**, never as a closed one falsely claiming completion.
**Visible-and-wrong is recoverable; closed-and-wrong is not.**

**M3 · CLOSED, with one residual.** `DSR_ATTEST_PROCEDURE_COMMON` gained a final
step: *"⚠ Descreva apenas O QUE FOI FEITO. Não transcreva o trecho encontrado nem
qualquer dado que identifique o titular…"*, placed last so it is read last before
writing, with the reason stated at the site (*"Copy is the ONLY control on this
axis"*). The migration comment now describes a control that exists.

⚠ **Residual [V]:** the note field's placeholder at `dsr-attest-form.tsx:201` still
reads **"Quais conteúdos foram lidos e o que foi encontrado."** — the procedure now
forbids exactly what the placeholder invites, four lines apart on the same screen.
One string. Not blocking; the instruction is the prominent one and is rendered in a
numbered corridor box above the fields.

**M4 · CLOSED, and correctly resolved in the direction I did not prescribe.** The
false guarantee is gone and replaced with an accurate statement:
`canExecute === true` means *"worth offering"*, not *"will succeed"*; the module door
is the only authority. Narrowing the predicate would have meant mirroring four gate
expressions in a fifth place, which ADR 0130 Amdt 2 item 2 rejected outright.

**And the over-admission is now measured, not inferred [V].** From the live bodies:

| task kind | door's live gate | `can_execute_dsr_task` (commission branch) | over-admits |
|---|---|---|---|
| `dispose_case` | `is_staff_admin_of` **only** | staff_admin ∪ tenancy_admin ∪ pqs_operator | tenancy_admin, pqs_operator |
| `dispose_meeting` | staff_admin ∪ tenancy_admin | same | pqs_operator |
| `dispose_event` | tenancy_admin ∪ pqs_operator | same | staff_admin |
| `dispose_referral` | tenancy_admin ∪ pqs_operator | same | staff_admin |

It over-admits on **all four** kinds, in different directions — wider than the
comment's "in particular" suggests, and the failure stays safe in every case (the
door refuses, in its own pt-BR).

---

## ⛔ The twelve deferred items — ALL SETTLED **[V]**

| # | Question | Measured result |
|---|---|---|
| 1 | Did any policy move? | **No.** `pg_policies` over the seven relevant tables: `commissions_select_member_or_admin`, `hospitals_select`, `meetings_select`, `patient_xref_select_pqs` carry **no `is_dpo_of` arm**; `dsr_requests_select` / `dsr_tasks_select` are Slice 2's verbatim. **No second widening at the policy layer.** |
| 2 | `prosecdef` beside `pg_policies`? | All 23 DSR-adjacent functions are `prosecdef = t`. |
| 3 | ACLs | `app.patient_trajectory_bundle` and `app.derive_patient_key` are **`postgres` + `service_role` only** — the over-grant is genuinely reverted. **No NULL `proacl` anywhere. No `anon`. No PUBLIC** (every entry has an explicit grantee). `search_patient_xref` = `authenticated` + `service_role`; the restated grant on the rewrite was a no-op, as suspected. |
| 4 | `can_execute_dsr_task` vs the door gates | Measured — see the M4 table. Over-admits on all four kinds. |
| 5 | `is_dpo_of_for`'s arms | Both present: `app.is_active(p_user_id)` **and** the grant row (`hospital_dpos … revoked_at is null`), plus a commission-membership floor. |
| 6 | `dsr_tasks_status_check` | `CHECK (status = ANY (ARRAY['pending','done','blocked']))` — exactly three. `TierSum`'s discrepancy arm is unreachable through the data, confirmed at the constraint. |
| 7 | Column lists | `dsr_requests`: 18 columns, `patient_key`/`encounter_key` hashes, **no name, no MRN, no cleartext identifier**. `dsr_tasks`: 15 columns, matching `350` t12's `set_eq` list exactly. **Rule 12's "exactly three PHI modules" survives.** |
| 8 | The two inherited verdicts | Re-earned — see the judgment below. |
| 9 | B1's rendered numbers | Moot: the subtraction is gone from the code path. |
| 10 | M2's duplicate-task state | Moot: the sibling attestation is retired on the mint path. |
| 11 | Rule 11 precedent for the listers | **Carried, see item 8 below** — not settled, and I am saying so rather than dropping it. |
| 12 | pgTAP counts | `350` now `select plan(75)` (was 69), `349` `plan(53)`. The lead's run reports 6678/6678 across 201 files **[R]**. |

⭐ **Item 3 is the one worth reading twice.** The single live ACL defect this slice
produced was caught by an existing pin, and the catalog now shows the tight state
restored on the raw PHI assembler with nothing else widened. That is the check most
likely to have gone wrong quietly, and it did not.

---

## The two judgments the lead asked for

### 1 · Is the retirement-cause rule held everywhere? **Yes — in all six code sites. The ADR is now the one place it is not.**

I verified every surface that can see a `blocked` task **[V]**:

| site | copy | verdict |
|---|---|---|
| task card, `dsr-task-inbox.tsx:279` | *"Encerrada pela decisão registrada — esta tarefa não deve ser executada."* | cause-neutral ✅ |
| outcome record, mechanical `:135` | *"Registros retirados pela decisão registrada…"* | cause-neutral ✅ |
| outcome record, attested `:189` | *"Revisões retiradas pela decisão registrada…"* | cause-neutral ✅ |
| `complete_dsr_task` (live body) | *"esta tarefa foi encerrada pela decisão registrada…"* | cause-neutral ✅ |
| `attest_dsr_task` (live body) | identical | cause-neutral ✅ |
| the negative pin, `dsr-slice3-adjudication.spec.ts:598` | `not.toContain('não determinou eras')` | falsifiable ✅ |

Grepping the old cause-naming strings across `src/`, `e2e/`, `supabase/`: **zero live
occurrences**; every remaining hit is inside a comment explaining the fix or the E2E
negative assertion. The rule holds.

⛔ **And the reason it had to hold is now structural, which is the part worth
stating.** M2's fix gave `blocked` a **second writer** — adjudication-escalation, not
just a non-granting close. So the two causes are no longer distinguishable even by
the join that r1 was told to use, because for an escalation-retired attestation the
request is **not closed** and the outcome **is granting**. Any surface naming the
cause is now wrong for one of the two paths, and cause-neutral copy is not merely
tidier — it is the only thing that stays true. The five falsified strings were a
consequence of the mechanism, not an oversight, and generalising the copy was the
right fix rather than resolving a richer join.

⚠ **Where it is NOT held: the ADR itself.** ADR 0130 Amdt 3 item 7 still reads, at
the top of the very item that carries the QA r1 correction:

> *"Any surface showing a blocked task must resolve that join and say why."*

That instruction is now **live-false**. A future author who follows it writes exactly
the falsified string class this round removed. Fix: replace it with the rule as
shipped — *no surface may name the cause of a retirement from `status` alone;
`blocked` has two writers* — and name the second writer. One sentence, in the section
a future reader of the retirement mechanism lands on. That is also the cheapest
durable home for the rule, which currently lives only in two code comments
(`dsr-outcome-record.tsx:186`, `20261002000300:248`) and one negative E2E pin.

### 2 · Are the re-earned verdicts trustworthy? **Yes, and the reason is structural, not deference.**

Both near-misses failed in the **PASS/BLIND direction** — a verdict over a red
baseline, and a verdict over a domain (`350` alone) that did not contain the
keystones (which live in `349`). Neither could produce a false RED.

**A RED verdict is self-authenticating in a way a PASS is not.** For the suite to go
red under a mutation, all three of the FUP's preconditions must have held: a green
baseline, a keystone present in the swept domain, and a keystone that observed the
difference. The failure mode `FUP-AUTHZ-HARNESS-PRECONDITIONS` describes — *"nothing
noticed"* being indistinguishable from *"nothing that could notice was running"* —
produces a PASS, never a RED. So the harness's known defect cannot reach these two
verdicts.

Three things make that argument concrete rather than theoretical:

1. Both re-earned verdicts are **RED**, and both **name the tests**
   (`349` t6/t7/t8 + t32p; `349` t19, t21) — attributable, not "suite went red".
2. The preconditions were checked for these specifically: baseline verified green
   first, the harness control caught a dead write channel, both restores
   hash-verified, post-battery clean run green.
3. ⭐ **No verdict in this slice rests on a PASS.** The battery is 47 RED + 1 GREEN,
   and the single GREEN was treated as a finding — the twin deleted rather than
   banked. There is no BLIND/COVERED verdict here for the harness defect to have
   corrupted.

`FUP-AUTHZ-HARNESS-PRECONDITIONS` is filed 🔴 with the right remedy (*"A `PASS` with
the subject absent must be an ERROR"*), which is ADR 0128's clean/unproven/dirty
partition applied to a second instrument. **One scoping request:** the FUP should say
explicitly that its blast radius is **PASS/BLIND verdicts only**, and that RED
verdicts are unaffected. Without that sentence a future reader may re-open verdicts
that never needed it — the "absence of a verdict is not absence of coverage" trap
running the other way.

---

## New in r2 — three findings, all Minor

### r2-m1 · The battery census stopped summing, inside the paragraph that documents that failure **[V]**

`350`'s header still reads *"46 probes … 46 = 45 RED + 1 GREEN"* and instructs the
reader to derive it with `grep -cE` over the verdict lines. **I ran that grep. It
returns 46, not 45.**

The two re-earned probes were appended in a different format, and the pattern (which
requires two or more dots before ` RED`) sees exactly one of them: the
`create_dsr_request GATE opened ..... RED` line matches, while
`complete_dsr_task EFFECT check off . RED` — one dot — does not. True total is
**48 probes = 47 RED + 1 GREEN**.

This is the same file that says:

> *"⛔ THIS LINE ITSELF WENT STALE AND SAID '37' WHILE THE HEADING SAID 46… Both
> numbers are now DERIVED from this file by the grep above rather than typed, which
> is the only version of this discipline that has ever held."*

It held for one edit. ⭐ **The generalisable half:** deriving a count from a grep does
not survive an append in a different format — the derivation is only as stable as the
shape it scans, and nothing asserts the shape. Fix: bring both re-earned lines into
the same dotted format and re-derive both numbers.

### r2-m2 · ADR 0130 Amdt 3 item 7 still instructs the behaviour the fix removed **[V]**

See judgment 1 above. Highest-value of the three because an ADR is what the next
author reads.

### r2-m3 · One of the lead's three self-reported process errors reached the record only as an ambient condition **[V]**

- **Contaminated first declaring run** — recorded, with cause (teammates told to
  write during the run), remedy (48 files hashed before and after), and the rule
  (*"'frozen' has to be measured"*). ✅
- **typecheck against a deleted `.next`** — recorded, with the generalisable half
  (*"`npm run typecheck` is silently order-dependent on a prior build, which
  CLAUDE.md §6 step 1 does not say"*). ✅ That last clause is a CLAUDE.md
  review-queue candidate, not just a note.
- **The killed listener whose parent kept respawning servers** — **not recorded as an
  incident.** What exists is the symptom, in another follow-up's body:
  `FUP-PGTAP-184-T11-FLAKE` mentions *"an orphaned server was reaped"* and *"the
  window when a stray standalone server was deadlocking pgTAP"*, offered as a
  candidate cause for a different flake. The cause (a process tree declared dead
  while its parent respawned it), the misjudgement, and the cost (three deadlocked
  pgTAP runs) are nowhere.

That third one is the one whose generalisable half is most valuable and most
familiar: *a process tree is not dead because the child you named is.* It belongs
beside the contamination paragraph in the gate narrative — one sentence, same place,
same voice.

---

## Standing gaps — confirmed, with one correction **[V]**

| gap | status |
|---|---|
| 5 declared skips, **9 of 30 call sites**, census inspects **21** | ✅ **Accurate, and now machine-checked.** I summed the skipped rows' keys: 2+2+1+1+3 = 9. The prose "four rows" is corrected to five, and `:383` now asserts `toBe(21)` — so the inspected count is derived, not narrated. This was r1's finding 2 and it is fully closed. |
| `mapDsrError`'s deny arm unexercised | ✅ Honestly stated. Failure direction is closed, so this is a helpfulness gap, not a leak. |
| `TierSum`'s discrepancy arm untested | ✅ Honestly restated — the canary docblock now says *"THIS IS A DATA CANARY, NOT COVERAGE"* and names the instrument (`<TierSum total={3} parts={[1,1,0]} />`). Still needs the export + Vitest; open, correctly labelled. |
| `administrativo.spec.ts:121` | ⛔ **The line is right; the census around it is wrong.** Leaving it untouched under the freeze is correct, but it is not "exactly one other" — see **r2-B3**: ≥49 swallowing helpers measured, one of them a live PHI-disposal assertion. Correct this line before the Record step. |
| `184` t11 | ✅ Filed as `FUP-PGTAP-184-T11-FLAKE`, named and actionable, with the honest *"passed three times since is not a diagnosis"*. |
| uncaptured unit failure | ✅ Filed as `FUP-VITEST-UNCAPTURED-FAILURE` — r1's m5 closed. |
| 11 tests unaccounted (1165/1176) | ✅ Filed as `FUP-E2E-GATE-CENSUS-AND-CRASH-CLASSIFIER`, and its analysis refuses the naive fix: *"the fix is not 'add crash to the INFRA list', it is classify a crash as its own third category… REQUIRING a re-run before any verdict."* Correct — ADR 0128's partition on a second instrument. |
| **"zero of the 16 opt-in surfaces submit anything"** | ⚠ **Two grains, both true, and they should be reconciled.** No table-driven test submits (true). The spec's own gap block says *"`login-form` is exercised by every spec's `cachedSignIn`, so it alone has arrival evidence"* — 1 of 16 (also true, by a different mechanism). One statement should absorb the other so a reader does not have to reconcile them. |
| r1's `.or()` paired positives | ✅ **Fixed, and better than asked.** The empty state is now asserted **ABSENT** and the hit **PRESENT**, justified against `350` t4 pinning `matchCount >= 1` for that exact MRN and hospital. The comment names why the old shape *"passed on exactly the outcome it claimed to rule out"*. |

---

## Carried forward — open, non-blocking, for the Record step or the next slice

1. **r2-B3** — the swallowing-helper census. File with the measured numbers, name
   `e2e/pdf-printing-meetings.spec.ts:331` as a second instance of B2's blocking
   class, and correct the "exactly one other" line. *(highest value — it is the one
   item here that, left as stated, closes a question that is open)*
2. **r2-m2** — ADR 0130 Amdt 3 item 7's superseded instruction.
3. **r2-m1** — `350`'s census arithmetic.
4. **r2-m3** — the missing process-error paragraph.
5. **m4** — `PROGRESS.md:40` still says *"Slices 3–4 NOT started"* while `:87` and the
   `:297` gate row say built and gated. Record-step edit.
6. **m8** — ADR 0056 follow-up (a) still reads *"(none exists)"*. One line.
7. **m6** — `queries/dsr.ts:242` still promises *"pending first"* while `:274` orders
   `status` ascending (`blocked` < `done` < `pending`). The inbox re-partitions, so no
   user impact; the query layer's contract is still false.
8. **m7** — the inbox header still shows only `{pending} pendente(s)`; after a refusal
   close it reads "0 pendentes" with the retirement carried per-card only.
9. **m9** — the two DEFINER listers still emit no audit row for a cross-commission
   read (Rule 11). **Genuinely unsettled** — I did not check the
   `list_my_nsp_hospitals` precedent. Decide it rather than inherit it.
10. **m10** — the reviewer's full name is still stated in copy as delivered to the data
   subject; ADR 0130 D6 says *recorded*. One PO confirmation, one ADR line.
11. **M3 residual** — the attest note placeholder still invites what the procedure now
    forbids.
12. **r1 spec items 5 and 7** — `expect(item.description).not.toBe(AGENDA_PROSE)` is
    still absence-shaped (bounded by the `title` assertion beside it); the escalation
    spec's terminal affordance assertion is still unscoped to its own fixture's
    meeting.
13. ⚠ **New, small [V]:** the mechanical tier's retirement copy says retired records
    *"não foram descartados e permanecem preservados"*, inferred from task status. An
    executor holds the four doors independently of the DSR and could dispose after a
    refusal close; the task stays `blocked` and the record would then claim
    preservation of an erased row. It requires acting against a recorded refusal, so
    it is remote — but the truthful source is the module row's `phi_disposed_at`,
    which `complete_dsr_task` already reads for exactly this reason. Same family as
    the rule in judgment 1, one level down.

---

**APPROVED.** Nothing above blocks the gate. Items 1–3 are the ones I would not let
travel past the Record step, because all three are documentation that a future
session will read and believe.
