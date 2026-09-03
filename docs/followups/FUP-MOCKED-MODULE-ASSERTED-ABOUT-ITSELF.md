# FUP-MOCKED-MODULE-ASSERTED-ABOUT-ITSELF — suites that mock a module and then assert a property OF that module (owner: backend + qa)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-25 · status open

> **Filed 2026-08-25 (PDF·P3), from a live instance rather than a hypothesis.**
>
> `src/lib/cases/pdf-payload.test.ts` mocked `@/lib/queries/cases` wholesale and then asserted a
> property of `getCasePatients` — that an unentitled caller and an entitled-but-empty one produce
> **different** messages. Re-introducing the exact defect (`if (!data) return []`, collapsing the
> door's three answers into two) left **every assertion green**, including that one.
>
> ⭐ **Why this is worse than an ordinary weak test: the assertion NAMES the defect.** A reviewer —
> the lead, who wrote the specification the test satisfied — reads a test that spells out the symptom
> and concludes it is covered. **The mock boundary is invisible at the assertion line:**
> `expect(unentitled).not.toBe(empty)` reads as a complete claim, and nothing at the point of reading
> says the module producing both values was replaced by a stub three imports up.
>
> **Closed for that instance** by `src/lib/queries/case-patients-door.test.ts`, which mocks the
> Supabase client one layer lower so the real door body runs (same mutation reds it, restore greens
> it) — and, the durable half, by **retitling the first suite "provider half only" with a ⛔ naming
> the file that covers the root cause.** The second file closes the instance; the title stops the next
> reader drawing the wrong conclusion.
>
> **The open work is the sweep, and it is deliberately narrow and greppable:** find suites that
> `vi.mock` a `@/lib/queries/*` module and then assert a property **of that module**. ⛔ Not an
> open-ended test audit — that predicate is the whole reason this is actionable.
>
> ⚠ **A green suite is not evidence here.** Every instance of this class is green by construction; the
> only detection is re-introducing a defect in the mocked module and checking whether anything reds.
>
> **Owner:** `backend` (the sweep) + `qa` (review focus).

---
