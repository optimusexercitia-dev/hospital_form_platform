# FUP-DOOR-SWEEP-DERIVER-BLIND-TO-ALTER-FUNCTION — a `prosecdef` flip on an existing boolean gate derives ZERO cases and reads as clean (owner: backend/lead; filed 2026-08-26, found by `backend` while fixing BUG-D5-REHIRE-HOSPADMIN-001)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-26 · status open

`scripts/door-sweep-cases.sh`'s function branch (~lines 290-292) selects a gate only when its
**`create function` body** matches all three of: literal `security definer`, `returns boolean`, and
the predicate-identity regex. An **`alter function … security definer`** produces no such body, so
the deriver cannot see it **at all**.

⛔ **Consequence, and it is the reason this is filed rather than noted:** flipping `prosecdef` on an
**existing boolean gate** via `ALTER` would derive **zero cases**, and a zero-case derivation is
reported as *exit 1 / FINDING* that a tired reader rules "no gates touched — clean". The gate would
be newly DEFINER, newly bypassing RLS, and in **no** sweep's case list.

⭐ **This is the exact analogue of ADR [0079](../decisions/0079-authz-door-blindness-standing-invariant.md)
Amendment 8 ruling 1** — *`alter policy` is not `create policy`* — which exists because the recipe
grepped only `create policy` and was blind to alterations. **The same defect survived one level over,
in the function branch, after the policy branch was fixed.** ⚠ That is the durable finding: a
correction applied to one branch of a deriver is not evidence the sibling branch was swept.

**Not a live hole today.** The migration that surfaced it flips a **`trigger`**-returning function,
which is outside the door audit's predicate-arm domain by construction (bounded by `t.typname='bool'`,
plus the one named exception `assert_not_case_excluded`), and `ARM=census` independently reports it
outside its domain for the same reason. The blindness is **measurement-domain**, not an unguarded door.

**Fix shape:** the deriver must grep `alter function … security definer` the way it now greps
`alter policy`, and resolve the altered function's return type from the **live catalog** rather than
from the migration text it cannot parse.
