# FUP-C2-TIER1-FLOOR-ARM-HAS-ZERO-SLACK

**Filed:** 2026-09-04 (C2 closure review) · **Owner:** backend
**Severity:** medium — no gate is wrong today; the arm is one lost allow leg away from a red that
will read as a regression in whatever change happens to remove it.

## The finding

C2 retired **10** entries from `supabase/tests/mutation/authz-neverclled-door-allowlist.txt`. Each
is **earned** — `ARM=floor` confirms every one of the ten doors now has a recorded call in
`pg_stat_user_functions`. But the margin is nil: **8 of the 10 sit at exactly ONE recorded call**
(`nsp_org_capa_rollup` has 2, `conclude_referral` 4).

`pg_stat_user_functions` does **not** count a call that raises, so only a door's *successful* leg
keeps it off the offender list. ⇒ **Any change that removes or breaks a single allow leg reds
`ARM=floor`**, and the red will surface in an unrelated phase, pointing at a test file rather than
at the allowlist retirement that made the door load-bearing.

⛔ **Re-allowlisting is prohibited as the remedy** — the file's own header says so, and
`allowlisting-a-door-as-e2e-only-is-what-makes-it-blind` is why: an allowlist entry plus a BLIND
verdict is two instruments agreeing while both measure nothing.

## Closes when

Either the eight single-call doors gain a second independent successful call, **or** the arm's
output names its at-risk set — doors whose call count is 1 — so a future red is diagnosable from the
arm's own output instead of by archaeology. The second is cheaper and is probably the right one:
the risk is not that one call is insufficient, it is that nothing announces the fragility.

## Related

- `docs/reviews/c2-tier1-closure-review.md` — where it was raised.
- `supabase/tests/mutation/authz-neverclled-door-allowlist.txt` — its header carries the
  deny-only-keystone warning that makes the allow leg load-bearing.
