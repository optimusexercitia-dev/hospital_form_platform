# FUP-MEETING-CASES-SELECT-OMITS-RECUSAL — the read policy hand-rolls a weaker predicate than its three siblings (owner: backend/PO; filed 2026-08-26 by the AFF4 lead, found by a peer session auditing `can_reach_meeting`; NOT AFF4's work and not absorbed by it)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-26 · status open

`public.meeting_cases` has four policies and they **split on which denials they inherit**. Confirmed
from `pg_policies` on 2026-08-26 (catalog, not migration text):

| cmd | predicate | inherits recusal? |
| --- | --- | --- |
| UPDATE | `app.is_staff_admin_of(app.commission_of_meeting(meeting_id)) AND app.can_read_case(case_id, auth.uid())` | **yes** — via the ADR 0078 bitmask |
| DELETE | same as UPDATE | **yes** |
| INSERT | `WITH CHECK` only | — |
| SELECT | `app.can_reach_meeting(meeting_id, auth.uid()) AND NOT app.is_case_respondent(case_id, auth.uid())` | ⛔ **NO** |

The write paths go through `can_read_case`, so they inherit all five of `app._case_caps`' hard
denies **by position**. `meeting_cases_select` does not call it at all — it **re-states ONE deny by
hand** (respondent) and **omits recusal**. Zero of the five policies consuming `can_reach_meeting`
check recusal.

⛔ **This matters because `meeting_cases` carries `summary` and `decision` — case TEXT, not just a
link row.** Predicate-level evidence (read-only, seed user `staff1.ccih` recused from case
`ca000000-…e1`): `is_recused_from_case` = **t**, `_case_caps` = **0**, `can_reach_meeting` = **t**,
`is_case_respondent` = **f** — so the SELECT predicate evaluates **TRUE for a case the user is
recused from**.

⚠ **NOT CONFIRMED END TO END, and the reason is the finding's own shape:** in the current seed the
recused case is **on no meeting at all** (the only `meeting_cases` row is for case `d0000000-…c1`),
so **the failing state does not exist in the fixture**. This is a *latent asymmetry*, not a
demonstrated leak — and it is a textbook instance of *a green gate meaning the fixture cannot reach
the failing state*. ⛔ Confirming it requires **constructing the state nobody constructed**: recuse a
member from a case, put that case on a meeting they can reach, assert SELECT returns zero rows.

~~⭐ **Why this reads as an oversight rather than a decision:** a deliberate ruling that *"recusal does
not apply in the meeting context"* would have applied to the **write** policies too. The 3-of-4
split is the tell.~~ ⚠ But that is an inference — **the PO rules it**, and the ruling is needed before
any fix, because "add recusal to the SELECT policy" is only correct if the asymmetry is unintended.

---

### ⛔ RULED 2026-08-31 (PO) — and the inference above measured **FALSE**. → ADR [0169](../decisions/0169-meeting-content-recusal-divergence-is-a-time-boxed-exception.md)

**It was already ruled, twice, and in the opposite direction.** ADR 0078 Amendment 1 **O6**:
*"the **recused still sees the number**"* — the propriety tier gates on `is_case_respondent`
**alone**, which is exactly what this policy implements. ADR 0078 **A5** then sets three tiers:
*procedural shell* (item exists, process number, who withdrew and why, times) → **all members,
including the recused**, because *"the shell must be visible — it is the proof of propriety"*;
*substance* → case authority; *decision* → **member AND NOT excluded**.

⛔ **So the remedy this item proposed would have tripped a guard built to prevent it.**
`20260816000300_authz_gate2_228_meeting_cases_respondent.sql` raises if the row-layer qual ever
contains `is_case_excluded`, because that *"blinds every RECUSED member to her own recusal
(keystone 10)"*. ⭐ This item cites neither O6 nor A5 — the contradiction stood unnoticed for five
days, and the inference read as care because it argued for the **tighter** rule.

**The defect, re-characterised** (live catalog, head `20261003006800`): `meeting_cases` has seven
columns. Row visibility is **correct**. `summary` (substance tier) and `decision` (decision tier)
are **over-granted** — `is_case_excluded = is_case_respondent OR is_recused_from_case`, and the
policy carries only the respondent half.

**Disposition: NAMED COMPATIBILITY EXCEPTION** (ADR 0162 / PA-F8 **b**) — first-class in AE4.3's
`staff_admin` matrix, mutation-tested like any other cell. Owner `backend`; ⚠ **expiry date owed
from the PO** (the trigger is post-pilot, at the first increment touching meeting content, and a
trigger-only expiry is the shape that never fires).

⛔ **Stays OPEN — an accepted exception is an acceptance, not a fix.** ⛔ And the matrix cell must
record the **corrected** characterisation: a cell authored from this item's original text would
encode the wrong fix and make it the regression oracle. Fix shape when the exception expires:
`summary` on case authority, `decision` on `NOT is_case_excluded`, shell untouched — RLS cannot
deny per-column, so it needs a view or column-grant split, plus a keystone that constructs the
state the seed cannot reach.

⚠ **NOT dispositioned:** the *"zero of the five `can_reach_meeting` consumers check recusal"*
observation below. A5 governs meeting content generally, so the same under-implementation may stand
at other meeting tables — **derive that population as a property**, never from this one table.
