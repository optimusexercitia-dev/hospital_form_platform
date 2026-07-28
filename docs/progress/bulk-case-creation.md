# Bulk Case Creation — "Múltiplos casos" (ADR 0084) — task ledger

> **COMPLETE + MERGED 2026-07-23** — flag `cases_bulk_create` flipped **ON permanently**
> (`255a8e9`), branch `feat/bulk-case-creation` merged and deleted, migrations
> `20260823000000` + `20260824000000` tracked in `main`. Durable pointers: the PROGRESS.md
> phase-status row · [review](../reviews/bulk-case-creation-review.md) · ADR
> [0084](../decisions/0084-bulk-case-creation.md).
>
> ⚠ **Why this file exists.** This track shipped, passed QA, and merged **without ever being
> recorded in PROGRESS.md at all** — no phase-status row, no task block, no bug-log entry.
> CLAUDE.md §7 makes PROGRESS.md the single source of truth for status; for five days it had
> nothing to say about a merged, flag-ON feature. Reconstructed from git + the QA review on
> 2026-07-28. Because it was rebuilt after the fact rather than rotated from a live ledger,
> this file is **thinner than the sibling tracks** — it records what git and the review attest,
> not a contemporaneous account.

---

### ✅ Bulk case creation — COMPLETE + MERGED 2026-07-23 (ADR 0084)

Committees open many Cases at once (e.g. an audit sample of admitted patients), each analyzed
as a Case and distributed across committee members. One Process → per-case data pre-filled in a
grid → an automatic fair deal across chosen members → created in a single atomic operation.
Design: [ADR 0084](../decisions/0084-bulk-case-creation.md) (10 decisions + E1), design-grilled
2026-07-23; composition contract verified against the **live catalog**, not migration text (ADR 0078).

**Commit chain** (oldest → newest, all on `main`):

| Commit | Scope |
| ------ | ----- |
| `91b32d7` | `public.bulk_create_cases` RPC + server action — the atomic composing door |
| `8ecf6c7` | regenerate `database.ts` for the new RPC (Rule 8) |
| `87b7c47` | balanced-deal + grid model |
| `88857d9` | "Múltiplos casos" wizard UI + route |
| `01cb187` | selectable PHI columns in the wizard (E1) |
| `1b0e931` | lighten Step-1 PHI/PII warnings |
| `197a504` | type `cases_bulk_create` in the feature-flags surface |
| `ebf04bc` | ADR 0084 recorded |
| `e3cd6eb` | E2E specs — `e2e/bulk-case-creation.spec.ts` (883 lines) |
| `142b798` | E2E fix: precise-target the deal-card count |
| `49661e0` | QA review — APPROVED |
| `b948c9f` | address the QA MINORs on `bulk_create_cases` |
| `255a8e9` | **flip `cases_bulk_create` ON permanently** |

**Design core (D1).** `public.bulk_create_cases` (`prosecdef = t`, 4 args) is one atomic RPC
that **composes the existing doors rather than re-implementing them** — per row it calls
`create_case_from_template` (snapshotting phases / form version / custom fields per ADR 0083),
then the existing assignment and audited case-patient single door. No new PHI store: PHI never
persists until the atomic commit, so **Rule 12's "exactly three PHI modules" invariant is
untouched**.

**Gates.**
- [x] pgTAP **29/29**; `next build` + typecheck + lint + vitest **390** green.
- [x] **E2E** `e2e/bulk-case-creation.spec.ts` — **8/8 prod-standalone**.
- [x] **QA review** (`qa`, 2026-07-23) — ✅ **APPROVED**, 4 MINOR/OBSERVATION, none blocking;
      all 10 decisions + E1 + the 8 acceptance criteria implemented **and exercised**. Security
      dimension verified against the live local catalog on a freshly-reset stack per ADR 0078.
      MINORs addressed in `b948c9f`. → [review](../reviews/bulk-case-creation-review.md)
- [x] **merge to `main`** + flag ON permanently (`255a8e9`), 2026-07-23. *Git-attested; as with
      ADR 0083, no explicit human-approval event is recorded — treat the permanent flag flip as
      the lead's closure signal.*
