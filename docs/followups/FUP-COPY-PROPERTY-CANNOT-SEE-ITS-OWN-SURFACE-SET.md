# FUP-COPY-PROPERTY-CANNOT-SEE-ITS-OWN-SURFACE-SET — the shared disposal-copy property has no census of the surfaces it is asserted on (owner: lead/frontend; **filed 2026-08-21, found by reading 15 tests before deleting them**)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-21 · status open

`src/components/dsr/disposal-copy-property.ts` defines the residue / over-claim properties once and
is iterated by two suites. **Nothing asserts how many suites import it, or which surfaces exist.**

Measured 2026-08-21 while removing `ReferralDisposeDialog` (PO-ruled; no hat can reach it). Deleting
its 15-test suite would have caused **three coverage drops, two of them silent**:

| drop | detail |
|---|---|
| ⛔ **residue-CLASS content pin: 1 → 0** | A repo-wide search found `cifrad` / `PITR` / `impressas` in **exactly one file** — the one being deleted. Eight other assertions pin `DSR_RESIDUE_NOTICE.length === 4`; **none looks at what the four lines say.** ⭐ *A cardinality pin and a content pin are different properties, and the cheaper one is the one that gets written.* Relocated to constant-level tests — tying it to a component is what made it deletable |
| ⛔ **type-to-confirm arming: 1 → 0, on a LIVE control** | `toBeDisabled`/`toBeEnabled` existed **only** in that file. `DsrMeetingDisposeDialog` carries the identical `disabled={isPending \|\| !armed}` and had **no arming test at all** — so the deletion would have left the module's most dangerous button with zero behavioural coverage, and nothing would have gone red. Ported + mutation-proven (`disabled={isPending}` reds 3) |
| ⚠ `dsr-meeting-residue.test.tsx` negative arm: **5 → 4** surfaces | The referral arm proved `DSR_MEETING_RESIDUE_RETAINED` does not leak onto a non-meeting surface. The **lane** is still covered (the `dispose_referral` inbox card renders the shared notice through the same constant); what was lost is one *surface*. Recorded in-file |

⛔ **`lint:vacuous` is structurally blind to this.** The assertions were **removed**, not made vacuous —
a deleted test is not a test that asserts nothing. Neither gate can see a property whose surface set
silently shrinks, and the shared property file cannot see it either.

**The only thing that caught it was reading all 15 tests before deleting any of them.** That is not a
control; it is an unusually careful person. [[removing-a-subject-breaks-its-assertions-in-two-directions]]

**What would be a control:** the property module declares its expected surface roster and asserts a
**floor** on it, the way `dsr-disposal-overclaim.test.tsx`'s `SURFACES` roster already does with its
`>= 7` anti-vacuity guard. ⚠ That guard is why the over-claim property's 4 → 3 surface reduction is
**not** a loss here: the roster never contained the referral dialog, so nothing shrank. The two
properties that *did* drop had no roster. ⛔ Filed rather than built — a roster asserted at the wrong
grain (*"assert every adjacent affordance"*) is the un-checkable shape DSR Slice 3 already rejected;
naming the gap honestly is the first deliverable.

> ### ⭕ A THIRD INSTANCE, INSIDE THE MODULE ITSELF — found 2026-08-21 during the QA round-2 sweep
>
> `disposal-copy-property.ts`'s own docblock said the property *"is asserted from two files"*. Measured:
> **one** importer (`grep -rn "disposal-copy-property" src/` minus the module's own path). It had been
> stale for a day, and **nothing could contradict it** — the roster is prose and no gate reads it.
>
> ⭐ **The module whose entire job is to define a property once so it cannot drift carried a stale count
> OF ITS OWN CONSUMERS.** That is this item inside its own subject.
>
> ⚠ **The stale digit was load-bearing, so it was not quietly decremented.** The module's stated
> justification was *"two copies of a pattern drift"* — a premise that evaporates at one consumer. The
> docblock now states the two reasons the module still earns its place (it is the one place the property
> is *stated*, and the deleted surface's content pins were relocated *into* the survivor, which is
> auditable only because the property has a named home), with an explicit ⛔ against the obvious next
> move: **a count of one is not evidence the abstraction was wrong** — inlining is the state it was
> extracted *from*, and a second consumer is one dispose surface away.
>
> **Fix shape, proposed by `frontend` and deliberately NOT built:** a self-counting anti-vacuity test in
> the consuming suite, in the shape that file already uses for `SURFACES.length >= 7` — read `src/`,
> count importers, assert the number. It converts the roster from prose nothing can contradict into an
> assertion that reds when a consumer is added or deleted, which is exactly the failure that occurred.
> ⚠ Two caveats make it a decision rather than an obvious win: it is **a test that reads source**, the
> shape `.claude/rules/ui-copy-forbidden-strings.md` warns against (though here the subject is the import
> graph, not rendered copy, so that false-positive class does not apply); and it pins a number that
> *should* change when a dispose surface is added, so it must red **loudly** rather than become a digit
> someone bumps reflexively.
