# FUP-PREVIA-MINT-FLAG-ASYMMETRY — `HC0DV` refuses a prévia on the premise that the mint is reachable, and the mint's preconditions are a STRICT SUPERSET (owner: backend; found by `qa` in the r2 re-review of the ADR 0125/0126 build)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-18 · status parked

Filed 2026-08-18 (lead), on `qa`'s **O1** — graded an observation, not a blocker, and the grading is right.
Measured from the live catalog by `qa` and **re-measured independently by the lead**:

```
public.log_document_previa    asserts:  document_printing
public.mint_printed_document  asserts:  document_printing + documents_wave_d
```

**The state that bites: `document_printing = on`, `documents_wave_d = off`.** A **locked** source then has
**no paper at all** — the prévia raises `HC0DV` (*"this source registers; emit it instead"*) and the mint
raises `HC0D7` (wave D disabled). Before `HC0DV` landed, the prévia was available in that state.

⚠ **The message actively misdirects.** Whoever disables wave D during an incident loses the accreditation
print surface **and is told to use the door they just turned off**. That is worse than a plain refusal,
because it sends the operator to a dead end with confidence.

⭐ **The class is adjacent to this build's dominant one, not the same, and the distinction is the useful
part:** the caller/door class is *a keystone proving a door works while the action cannot reach it*. This is
**a refusal added to door A on the premise that door B is available, without checking that B's preconditions
are a SUPERSET of A's.** Both are "a claim about a neighbour that nobody measured", one at the call site and
one at the precondition.

⇒ **A refusal that redirects to another door owes a check that the other door is reachable under every state
in which the refusal fires.**

**Why it is not a blocker** (and do not re-grade it without re-deriving these):
- It needs a **non-deployed flag state** — both flags are `true` today.
- Killing the document substrate arguably *should* stop printing, so the *behaviour* is defensible even
  though the *message* is not.
- No PHI or authorization consequence: it fails **closed** in both directions.

**Options, none chosen:** align the prévia door's assertions with the mint's; or make `HC0DV`'s message
conditional on the mint actually being reachable; or accept it and record the flag interaction where an
incident responder will find it. ⚠ Aligning the assertions is a **widening of refusal** — it would stop
prévias for *unlocked* sources too when wave D is off, which is a different and larger behaviour change than
it first appears.

**Two smaller records from the same review, neither filed separately:**
- **O2** — the refusal fires **after** the render, so a locked source burns a Gotenberg semaphore permit per
  request. Correctness is unaffected (no bytes leave); it is a contention cost under ADR 0125 D9's shared pool.
- **O3** — C5's 404-collapse comment now describes two refusal paths where it names one.
