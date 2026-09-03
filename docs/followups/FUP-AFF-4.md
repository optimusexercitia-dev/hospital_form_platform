# FUP-AFF-4 — make the membership-role list a Postgres ENUM (2026-08-06)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-06 · status parked

Raised by `backend`, and it is the durable fix for N1. `memberships_role_check` is a `CHECK` over
`text`, so the role list reaches **no** generated type (`grep technical_director_deputy
src/lib/types/database.ts` → 0 hits) and **no unit test can see the authority**. N1's remedy is a
committed fixture with a gate at each end (pgTAP `304` §10 ↔ fixture ↔ the pt-BR label test) — which
closes the drift hole, but is a **build-time gate, not a guard**: widen the CHECK, never regenerate
the fixture, ship without `npm run test:db`, and an English snake_case identifier still reaches a
pt-BR `role="alert"` through `roleLabel`'s `?? role` fallback.

As an **enum**, the list lands in `database.ts` and `tsc` enforces exhaustiveness — the check moves
from "a suite someone must run" to "the build". Deferred because it is a schema change with real
blast radius (`memberships_scope_shape`, every `role` comparison, the ADR-0094 completeness grid).
Decide before the role set next changes, not after.
