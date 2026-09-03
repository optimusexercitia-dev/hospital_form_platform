# FUP-AFF-2 — D7's "documented escape for a foreign professional" is unreachable (2026-08-06)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-06 · status parked

Raised by `backend` at W3 close-out. ADR 0097 **D7** makes `profiles.cpf` nullable *specifically* so a
foreign professional without a CPF can be registered "without a later schema change" — and then
requires CPF **at the action layer**. W3 implemented the requirement (correctly: without it the
identifier-first flow creates people no later CPF lookup can find, and the feature is inert on exactly
the population it exists for). **Net effect: the nullable column's escape has no product path.**

That is D7's own design, not a defect, and it is the right default — but it is recorded here because
the day the first customer has one foreign professional it becomes a real gap, and the fix should be a
**deliberate "sem CPF" affordance** (audited, org_admin-only, with the person still findable by name)
rather than a panicked schema change. Blocks nothing. Decide before the pilot onboards clinical staff,
not after.
