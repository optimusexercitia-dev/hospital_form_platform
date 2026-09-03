# FUP-RETRY-CHANGES-THE-FAILURE-MODE-ON-NON-IDEMPOTENT-TESTS — the gate's verdict is unreadable where a test poisons its own re-run (owner: tester/lead; filed 2026-08-23 from the first full `e2e:prod` since Increment 2)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-23 · status open

⭐ **Found by triaging a RED gate whose two "real failures" were neither real nor failures of the code.**

`e2e:prod` runs with `RETRIES=1`. Where a test **mutates shared state and is not idempotent**, a
transient first-attempt failure (server death, connection collapse — the known Windows prod-standalone
family) leaves that state behind, and the **retry then fails DIFFERENTLY** — on an assertion about the
state its own first attempt created. Measured, both instances from the 2026-08-23 run:

| test | reported failure | why the retry produced it |
| --- | --- | --- |
| `ethics-e4-participants.spec.ts:918` | `expect(seatedTwice.length).toBe(2)` → **1** | attempt 1 already seated the participant |
| `user-registration.spec.ts:506` | strict-mode: `getByLabel('Comissão')` matches the `<select>` **and** a `Remover Comissão…` button | attempt 1 already assigned the commission, so the Remover button exists |

Both error-context directories end in **`-retry1`** — the tell, and the only thing in the output that
distinguishes this from a hard defect. **Re-run alone with `RETRIES=0`: 25 passed / 0 failed, GREEN,
exit 0**, including the 8-test serial tail the first run reported as `did-not-run`.

⛔ **Why this is worse than flake, and rates 🟠 rather than 🟡.** A flake reads as noise and invites a
re-run. This reads as a **deterministic product defect** — a wrong participant count, an ambiguous
locator — and it points at the feature under test rather than at the harness. It cost a full triage
cycle to establish that neither failure said anything about the code, and the next reader gets no hint:
`GATE RED — 2 real failure(s)` is exactly what a genuine regression prints.

⚠ **Do NOT "fix" this by setting `RETRIES=0`.** The retry exists to absorb the documented Windows
server-death family, which is real and frequent (this run: five batches hit `server_dead=1` with 4–75
connection errors, plus one `exit 127` crash). Removing it trades an unreadable RED for a much noisier
one.

**Directions, none free:** make the tests idempotent (delete-by-identity setup — ⛔ never positional,
`seed.sql` is a contract with ~900 tests); or have the gate classify a retry-only failure distinctly, so
`RED — 2 real failures` cannot be printed for a pair that passed alone; or run the retry against a fresh
`db reset`, which is the batch's own recovery model applied one level down.

⭐ Class: **a repair mechanism that changes what it is repairing.** Same family as the recorded lesson
that a positive control can contaminate its own subject.

⭐ **RE-CONFIRMED 2026-09-02, GENERALIZED BEYOND RETRIES (tester, AE4 gate spec review).** Two plain,
back-to-back `npx playwright test e2e/ethics-e4-participants.spec.ts --project=chromium --workers=1`
invocations against the SAME un-reset DB (no `RETRIES`, no server death) reproduced the identical
symptom on the SECOND invocation alone: `EXT-REUSE` failed at the same assertion
(`expect(seatedTwice.length).toBe(2)` → received 1, now `:944`), aborting the serial file and leaving
the remaining 8 tests did-not-run. The first invocation (fresh reset) was 13/13 green — exit code read
directly both times. ⛔ **The mechanism is therefore NOT retry-specific** — it fires on ANY re-run
against an un-reset DB, of which a Playwright retry is only one trigger. This is corroboration of the
SAME already-filed item, not a new one (identical test, identical assertion, identical failure shape) —
filed here rather than as a new bug per that distinction.

⭐ **INDEPENDENTLY CONFIRMED 2026-09-02 (frontend) — AND THE MECHANISM NAMED PRECISELY, NOT AS A
CODE PATH.** With the PROF-CREATE fix (`add-participant-dialog.tsx`) STASHED, on the same polluted
DB, `EXT-REUSE` fails identically (expected 2, received 1) — showing the fix is non-causal (fails
identically without it) and, since the fix's `linkageDecidedAtCreation` guard sits inside the
`professional` lane and cannot execute on `EXT-REUSE`'s external-lane path, that lane separation is
why. ⛔ **That does NOT mean the defect lives in external-lane CODE** — the tester's fresh-reset
13/13 is the positive control that rules that out: same external-lane code on disk, `EXT-REUSE`
PASSED. Same code, different DB state, opposite verdict — so the mechanism is **accumulated DB row
state across runs** (the spec asserts an exact seat count for a `participant_id` on a case that, on
a second run, already carries a seat from the prior run), not a code path at all. Two independent
people, two independent runs, zero retries involved in either — the strongest evidence yet that
this is a deterministic fixture defect. ⚠ **Named for the next sweep:** this class — a spec
asserting an absolute row/seat count, valid only on a fresh reset — is almost certainly not limited
to `EXT-REUSE`; a future audit should grep for exact-count assertions on rows a create-always door
can duplicate, not for anything lane-specific. It sharpens the "Directions" above: "make the
tests idempotent" is the only one that closes the class; "run the retry against a fresh db reset" only
patches the retry-specific trigger, and a gate-level retry-classifier would still misreport a genuine
non-retry re-run (e.g. a local `e2e:prod` re-invocation without an intervening reset) as a real failure.
