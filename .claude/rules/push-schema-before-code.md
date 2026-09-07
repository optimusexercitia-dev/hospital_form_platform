---
paths:
  - "supabase/migrations/**"
broad: >-
  The whole directory IS the subject: this rule fires when someone is writing the migration
  they are about to push, which is the only moment the order can still be chosen.
anchors:
  - docs/deployment/coolify.md
  - package.json#db:push
  - docs/progress/phase-ledger.md#schema first, then code
source: AFF4 Record step 2026-08-26 — the order was documented, read, and violated · rotated from PROGRESS.md's Now section (retired 2026-09-03, ADR 0185)
---

# Push SCHEMA before CODE — `db push` first, DEPLOY second

⛔ **Code must never reach the server before the migrations it needs** — deployed code
querying objects the remote lacks is a live outage.

✅ Order: `npm run db:push` → verify **in the remote catalog** → then ship the code.

⚠ **2026-09-07: Coolify auto-deploy is OFF** (`coolify.md` Step 5) — a `git push` deploys
nothing; the window opens at the **manual Deploy click**. The ordering rule is unchanged.

## Non-obvious parts

- ⚠ **"Additive, so old-code/new-schema is safe" is NOT a general excuse to reverse it.**
  That clause was written into an earlier record and is **false** whenever a migration
  *drops* something the deployed build still selects. The order holds regardless, because
  the reverse breaks sooner and wider (ADR 0137 Amendment 2).
- **`git push` ≠ `db push` ≠ deploy.** None implies another; the deploy outcome is
  measured only in Coolify (which builds the branch HEAD at the click).
- Verify in the remote CATALOG, never from `db push`'s own report.
- ⛔ **Nothing to push is not a reason to skip the check** — confirm the remote head.

## Why it is load-bearing

No gate enforces this and none can: the order is an operator action leaving no artifact
in the tree. AFF4 shipped the violation — the warning existed, was read, and was violated
anyway: it sat under a heading about an unmerged branch rather than beside the push. Hence
the path-scope — a warning is only as good as its position relative to its action.
