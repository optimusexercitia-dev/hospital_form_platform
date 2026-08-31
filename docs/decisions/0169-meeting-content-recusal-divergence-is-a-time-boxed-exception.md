# 0169 — the meeting-content recusal divergence is a time-boxed EXCEPTION, not a new rule

**Status:** Accepted · 2026-08-31 (PO ruling)
**Amends:** 0078 (A5's three tiers gain a named, time-boxed implementation exception at
`meeting_cases` for the pilot — the model itself is unchanged, and the shell tier is not in question)
**Relates:** 0072 (the exclusion perimeter), 0155 / 0162 (the PA-F8 diff rule this exception is
taken under), 0025 (meetings)

## Context — the follow-up's premise measured FALSE

`FUP-MEETING-CASES-SELECT-OMITS-RECUSAL` was filed 2026-08-26 on the inference that the 3-of-4
policy asymmetry on `public.meeting_cases` was an oversight, closing *"the PO rules it, and the
ruling is needed before any fix."* Measured 2026-08-31 against ADR 0078: **it was already ruled,
twice, and in the opposite direction.**

- **Amendment 1, O6** — *"the **recused still sees the number**"*; the propriety tier gates on
  `app.is_case_respondent` **alone**. That is exactly what `meeting_cases_select` implements.
- **A5 — three tiers of meeting content**: *procedural shell* (item exists, process number, who
  withdrew and why, times) → **all members, including the recused**; *substance* → case authority;
  *decision* → **member AND NOT excluded**. A5's rationale is explicit: *"The shell must be visible
  — it is the proof of propriety."*

⛔ The follow-up's proposed remedy — routing SELECT through `app.can_read_case` — would therefore
**trip a guard built to prevent it**: `supabase/migrations/20260816000300_authz_gate2_228_meeting_cases_respondent.sql`
raises if the row-layer qual ever contains `is_case_excluded`, because that *"blinds every RECUSED
member to her own recusal (keystone 10)"*. The follow-up cites neither O6 nor A5.

## The divergence, re-characterised (live catalog, head `20261003006800`)

`meeting_cases` carries seven columns: `id`, `meeting_id`, `case_id`, `agenda_item_id`,
`created_at` — the shell — plus **`summary`** and **`decision`**. The policy is
`app.can_reach_meeting(meeting_id, auth.uid()) AND NOT app.is_case_respondent(case_id, auth.uid())`,
and it returns all seven columns. Against A5:

| tier | column(s) | required reach | actual | verdict |
| --- | --- | --- | --- | --- |
| shell | `id`, `meeting_id`, `case_id`, `agenda_item_id`, `created_at` | all members incl. recused | row visible | ✅ **correct** |
| substance | `summary` | `has_case_capability(…, 'read_case_content')` | returned | ⛔ **over-granted** |
| decision | `decision` | member AND `NOT is_case_excluded` | returned | ⛔ **over-granted** |

`app.is_case_excluded = is_case_respondent OR is_recused_from_case`, so the **recusal half is absent
on both content tiers** while the respondent half is present. The three sibling policies reach
recusal by position through `can_read_case → has_case_capability → _case_caps`.

⚠ **Latent, not demonstrated.** The seed holds no recused case on a reachable meeting, so the
failing state does not exist in the fixture; confirming it requires constructing that state.

## Decision

1. **ADR 0078 A5 stands unchanged.** The shell tier's visibility to the recused is correct and is
   not reopened. Keystone 10 and the `20260816000300` guard remain in force.
2. **The divergence is carried as a NAMED COMPATIBILITY EXCEPTION** — ADR 0162 / PA-F8 disposition
   (b). It is **first-class in AE4.3's `staff_admin` matrix**, mutation-tested like any other cell,
   not a footnote to it.
   - **Owner:** backend.
   - **Expiry trigger:** post-pilot, at the first increment that touches meeting content.
     ⚠ **A calendar date is owed and is the PO's to set** — PA-F8 requires one, and a
     trigger-only expiry is the shape that never fires.
3. **The matrix cell records the CORRECTED characterisation**, not the follow-up's: an over-grant of
   `summary` and `decision`, **not** a missing row-level deny. A cell authored from the follow-up's
   text would encode the wrong fix and make it the regression oracle.
4. **The fix shape, for when the exception expires:** implement A5's tiers at this table — `summary`
   on case authority, `decision` on `NOT is_case_excluded`, shell untouched. RLS cannot deny
   per-column, so this needs a view or a column-grant split, and a keystone that constructs the
   state the seed cannot reach.
5. **The follow-up is corrected in place and stays OPEN.** An accepted exception is an acceptance,
   not a fix; it may not be closed on this ADR.

## Consequences

- AE4 proceeds with exactly one named exception in the `staff_admin` matrix, satisfying PA-F8
  without approving a legacy defect into the oracle unlabelled.
- ADR 0078 gains an inbound `Amends` edge, so a session opening A5 or O6 sees from the back-pointer
  banner that a live exception exists — the failure mode where only the amending document knows
  about the amendment.
- ⛔ **Not dispositioned here:** the follow-up's wider observation that **zero of the five policies
  consuming `can_reach_meeting` check recusal**. A5 governs meeting content generally, so the same
  under-implementation may stand at other meeting tables. That population must be **derived as a
  property**, not inferred from this one table, and is its own sizing.
