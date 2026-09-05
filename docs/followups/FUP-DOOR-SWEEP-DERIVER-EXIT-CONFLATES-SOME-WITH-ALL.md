# FUP-DOOR-SWEEP-DERIVER-EXIT-CONFLATES-SOME-WITH-ALL — exit 0 means "at least one case was derived", never "every case this diff owes was derived"

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-05 · status open

**What is wrong.** `scripts/door-sweep-cases.sh` ends its successful path at `finish 0`
(`:1379`), unconditionally, whenever the case list is non-empty. Two blocks it prints on the way
there — `⚠ UNRESOLVED — named by the diff, ABSENT from the live catalog` (`:1129`) and
`⛔ EXCLUDED BY NAME — A REVIEW LIST, NOT A DROP. Rule on each one:` (`:1159`) — are **obligations
the deriver is telling the operator it could not discharge**, and neither reaches the exit code.
`finish 1` exists (`:831`, `:1265`) and `finish 3` exists (`:414`), so the graded vocabulary is
already there; the *incomplete* case simply has no code.

So the run that says `RESULT: DERIVED (0)` says "**some** cases", and a gate record reading the
exit code alone reads it as "**all** cases".

**How it was measured.** Recorded in `FUP-DOOR-SWEEP-DOMAIN-GAP-WIDENED-BY-SET-VALUED-RESOLVERS`
(2026-09-03) and re-confirmed by reading the exit paths at `388d24f6`:

- Over migration `20261003007320`, the deriver returned **exit 0 (DERIVED, 1 case)** — the altered
  policy `professional_profiles_select` — while printing **all three** new `SETOF uuid` resolvers
  on its EXCLUDED list with its own ruling that each *"owes a TARGETED mutation case"*.
- ⭐ Over the follow-on `20261003007330`, which `create or replace`s the **same** door with no
  policy change, it returned **exit 1 — FINDING**, with an empty case list.

**The same door produced exit 0 and exit 1 from the same apparatus**, and the only thing that
moved was whether an unrelated policy happened to be in the diff beside it. The door was invisible
to the selector in both runs; only the company it kept moved the code. ⚠ **A non-empty derivation
is not evidence that the derivation was complete** — and today the exit code cannot say which it
was.

**Why it matters more after ADR 0191.** The excluded list is where the arm's own bound surfaces at
gate time, and PRED-DOMAIN widened that bound rather than removing it (35 `prosecdef` booleans and
the whole `SETOF uuid` family remain outside the read arm). The list will keep being non-empty by
design; what must stop is it being non-empty *at exit 0*.

**What would close it.** A distinct exit code for "derived, but with UNRESOLVED and/or
EXCLUDED-BY-NAME obligations outstanding" — so a gate record cannot read a partial derivation as a
complete one — with the ruling for each named item recorded where the gate record can cite it.
⛔ **Proven able to fire, both directions**: a diff that leaves the two blocks empty must still
exit 0, and a diff that populates either must not. A code that has only ever been observed on one
side of that boundary has not been shown to discriminate.

⛔ **What must NOT be mistaken for closing it.** Making the blocks louder in the output. They are
already loud, correctly worded, and printed above the result line — and the 2026-09-03 measurement
happened *with them printing*. The defect is that the machine-readable half does not carry what
the human-readable half says.
