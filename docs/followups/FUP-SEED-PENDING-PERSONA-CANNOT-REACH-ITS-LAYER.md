# FUP-SEED-PENDING-PERSONA-CANNOT-REACH-ITS-LAYER

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-01 · status open

**The seed's "pending" persona cannot exercise the auth layer it appears to model.** Only the
MIRRORED column is unset: `public.profiles.email_confirmed_at` is NULL for
`novato.pendente@test.local`, while its `auth.users.email_confirmed_at` is **SET**. Measured on a
fresh reset: **1 of 36** profiles diverge that way, and **0** diverge the other way — it is the only
one in the seed.

⛔ **Why it matters.** A future test written against this persona to assert *"a pending user cannot
sign in"* would **fail against correct behaviour**, and the likely response is to "fix" the
application. That is the *fixture-cannot-reach-the-failing-state* class — the same shape that
produced `BUG-STAGEC-READER`, where a misquoted premise nearly drove a real over-grant.

⚠ Compounding it locally: `supabase/config.toml:246` (and `:298`) set **`enable_confirmations =
false`**, so GoTrue does not gate on confirmation on this stack at all. Even a *genuinely* pending
account signs in here. Production auth configuration is a separate setting and is **not measured**.

⛔ **DO NOT FIX `seed.sql` in passing.** It is a contract with ~900 tests; changing a persona's
lifecycle state is its own increment with its own gate run. Filed so the next author meets the
measurement instead of the appearance.

**Discharge:** either align the mirror at the seed (its own increment), or add a comment beside the
persona stating that it models the *profiles-mirror* state only and cannot be used for auth-layer
assertions.
