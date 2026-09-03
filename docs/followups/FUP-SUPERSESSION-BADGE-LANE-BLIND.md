# FUP-SUPERSESSION-BADGE-LANE-BLIND — `resolveSupersessionBadge` mirrors an aggregation rule but drops that rule's OWN lane restriction, so a phase-bound response gets the grain ADR 0126 D8 rejected (owner: frontend + backend; **ADR 0074/0085 axis — NOT the print-currency axis**)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-18 · status open

Filed 2026-08-18 (lead). Found by `frontend` during the ADR 0126 Amendment 1 **§K sweep**, and **outside that
sweep's bound** — §K bounds on `printed_documents.status`; this is ADR 0074's supersession axis. It surfaced
because the sweep's vocabulary caught the word *"Atual"*, i.e. **by accident, not by coverage**. Measured from
the files by `frontend` and **re-measured independently by the lead** before filing.

**The derivation, measured** (`src/lib/queries/submissions.ts`):

```
resolveSupersessionBadge:  'substituido' ⇔ hasSubmittedSuccessor
                           'atual'       ⇔ isSuccessor
fed at :432/:433 by        hasSubmittedSuccessor: supersededIds.has(r.id)
                           isSuccessor:           r.supersedes_id != null
```

`grep "correction_request|approved|current_response_id"` in that file: **0 hits**. There is no approval join.

**⭐ The precise defect is NOT "wrong grain" — it is a MIRROR that dropped its source's WHERE clause.**
The function's own comment says the submitted grain is *"the 'latest-in-chain' signal, **mirroring the
aggregation exclusion**"* — i.e. mirroring `app.submitted_form_responses`. That mirror is **correct**, and
measured, the aggregation rule it copies is **standalone-only by its own predicate**:

```
and r.case_phase_id is null                                   -- app.submitted_form_responses
and not exists (select 1 from responses succ
                where succ.supersedes_id = r.id and succ.status = 'submitted')
```

But `listSubmissions` surfaces **both** lanes (`isCasePhase: r.case_phase_id != null`, `:449`) and applies the
badge unconditionally. So:

- **standalone lane — CORRECT.** Submitted-grain *is* the effectiveness rule there, and it is exactly what
  ADR 0126 **Amendment 1 §A** ratified for the standalone head lane.
- **phase-bound lane — WRONG.** ADR 0126 **D8** requires approval-grain: `case_phases.current_response_id`
  moves **only** in `approve_correction`, and `sync_case_phase_on_submit` returns early for successors with the
  comment *"approval owns effect-taking"*.

**Consequences on the phase-bound lane, all from D8's own analysis:**
1. The original flips to **"Substituído"** the moment a correction draft is *submitted* — **before approval**,
   while `current_response_id` still points at it, so it is still the effective response.
2. It flips **back** if `reject_correction` walks the draft to `in_progress` — the badge **flaps**, driven by a
   low-authority act.
3. A submitted-but-unapproved successor renders **"Atual"**, asserting it is the current one when the phase
   pointer does not reference it.

**⭐ The differential that makes this a defect rather than a definition.** The **same pill**, one file over at
`…/manage/cases/[caseId]/fase/[phaseId]/respostas/page.tsx:65`, is fed by
`corrections.some(r => r.status === "approved")` — **approval grain**, with a comment citing the pointer
(ADR 0085). **The platform already knows the right grain and uses the wrong one one file away, rendering the
identical badge.** That is what stops the submitted-grain version reading as an intentional dashboard semantic.

⚠ **Not established, and it must be before any fix:** whether ADR 0074 *deliberately* chose submitted-grain for
a list whose job is "show me what is in flight". The mirror-comment suggests the intent was aggregation parity,
not lifecycle truth — which would make the lane restriction an oversight rather than a decision — but that is
an inference, and this item must not be closed on it. **Read ADR 0074 (and 0085) first.**

⛔ **Deliberately NOT fixed in the prévia build.** Different axis, different ADR, and a fix is a lane-aware
rewrite of a shared pure function with its own test surface. ⚠ **D8's *disclosure* argument does NOT transfer**
— that concerned a public page leaking an in-flight correction; this is an internal coordinator surface where a
`staff_admin` is entitled to see one. Only the **wrong-grain and flapping** halves transfer. Do not import D8's
severity wholesale.

**⭐⭐ SHARPENED 2026-08-18 (lead, by measurement): the correct predicate ALREADY EXISTS IN TS, in the same
directory, and ARCHITECTURE.md names it as THE twin — singular.**

`src/lib/queries/dashboard.ts` exports `isDashboardCountable`, which ARCHITECTURE.md Rule 2 (line ~266) calls
*"the TS twin"* of the choke-point. Its body:

```ts
return r.status === 'submitted' && r.casePhaseId == null && !r.hasSubmittedSuccessor
//                                 ^^^^^^^^^^^^^^^^^^^^ the lane conjunct, present here
```

`resolveSupersessionBadge` sits one file away in the same directory and omits exactly that conjunct. So this is
**not** "nobody knew the rule" — it is **two TS derivations of one SQL choke-point, of which only one is
sanctioned and only one is complete.** ARCHITECTURE.md's binding instruction in the same paragraph is
*"**Any new aggregation path must reuse that choke-point, not re-derive `status = 'submitted'`,** or corrected
metrics double-count."*

⇒ **This narrows the fix and raises the confidence.** The repair is to make the badge consume the same lane
test rather than to invent one — and the "maybe ADR 0074 chose submitted-grain deliberately" caveat is now
**much weaker**, because the deliberate choice is visible in `isDashboardCountable` and it *includes* the lane
restriction. ⚠ Still read 0074/0085 before ruling: a *display* badge is arguably not an *aggregation* path, and
that is the one reading under which the omission could be intentional.

**⇒ The class, which is the reusable part:** *a mirror inherits its source's predicate, not just its shape.*
`app.submitted_form_responses` carries `case_phase_id is null` in the same `where` as the exclusion the badge
copied; copying one conjunct and not the other produced a rule that is right on one lane and wrong on the other,
with **one code path and one badge** so nothing distinguishes them. Same family as
[[a-predicate-quoted-at-the-wrong-grain]], and the direct sibling of ADR 0126 Amendment 1 **§A** — which is the
*same lane-blindness* found in the print-currency derivation and fixed there.
