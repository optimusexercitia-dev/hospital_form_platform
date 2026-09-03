# FUP-ACL-APP-POPULATION — ⭕ **RE-SCOPED 2026-08-17: the assertion is BUILT; the 237-function triage is what remains** (owner: backend + PO)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-14 · status parked

> **✅ The blind spot is closed.** `320` block U (+4, plan 10 → 14) replaces the 8-name
> allowlist with a **schema-bounded** population pin, so a new `app` door with a default
> ACL reds immediately instead of inheriting no coverage. U2/U2b are the t19c-style
> control: creating one probe function moves the count 237 → 238 and dropping it returns
> it to baseline — the detector is **shown to move**, not assumed to
> ([[detector-that-finds-nothing-must-be-proven-able-to-find-something]]).
>
> **⛔ What the first measurement actually found, and why it is NOT a mass revoke.**
> **237 of 454** `app` functions are PUBLIC-executable — 228 by default ACL (**159 of
> them SECURITY DEFINER**) plus 9 by an explicit PUBLIC grant — and `anon` resolves
> EXECUTE on all 237. The nine explicit ones name the hazard: `is_admin`,
> `is_member_of`, `is_staff_admin_of`, `is_org_admin_of`, `eval_condition`, `answer_map`,
> `latest_published_version`, `commission_of_version`, `can_read_correction_response`.
> **These are evaluated INSIDE RLS policies, which run as whatever role is reading —
> including `anon` on auth-flow paths.** Their PUBLIC grant is a decision, not drift, and
> a blanket revoke would break policy evaluation platform-wide. U3 pins that: a
> schema-wide revoke now reds in `320` rather than in production.
>
> **⬜ REMAINS OPEN — the triage, which is the real work and was never the query.** Walk
> the 159 default-ACL DEFINER functions and decide each: legitimately PUBLIC (RLS-
> evaluated) vs. should be revoked. Drive the baseline down as each batch lands.
> Calibration unchanged: `config.toml` exposes only `public`, so none of these is
> PostgREST-reachable — **defence-in-depth, not a leak path**, which is why the ratchet
> was the right increment and a rushed mass revoke was not.

<details><summary>Original filing (2026-08-14) — retained</summary>

Filed 2026-08-14 (lead) while verifying S3's `DROP`+`CREATE` PUBLIC-EXECUTE find. **Defence-in-depth,
not a leak path** — `config.toml` exposes only `public`, so an `app` function with PUBLIC EXECUTE is
not PostgREST-reachable. Recorded because the mechanism has now fired **three times** (TV, DM5·S2,
DM5·S3) and the `app` side has no generic net.

- `100_dashboard` **t19** — *"no FIRST-PARTY public function is anon-executable"* — is bounded by
  `nspname = 'public'`. Correct and well-built (it has control **t19c** proving the detector moves
  0→1, and it uses `has_function_privilege`, which **resolves** a default ACL).
- `320:170-180` — the only `app`-side check — is bounded by **8 hard-coded function names**. That is
  the "remembered-doors allowlist" that [[guards-that-read-right-but-fail-open]] itself warns is blind
  in precisely the case that matters, and a new `app` DEFINER door (e.g. S3's
  `app.resolve_document_version_bytes`, on a PHI byte path) inherits no coverage from it.

**Fix:** generalize `320`'s uniformity assertion from the 8 names to **all `app` functions**, keeping
its existing `p.proacl is null or exists(… grantee = 0)` shape (⚠ that `is null` arm is load-bearing —
`aclexplode(NULL)` returns **no rows**, so dropping it makes the check blind to exactly the default-ACL
case it exists for). Give it a **control** in t19c's style, and expect the first run to be **RED with a
list** — `app` almost certainly holds legitimate PUBLIC-executable helpers, and the real work is
triaging that list, not writing the query. Pair with the over-revoke twin (`authenticated`/`postgres`
retain EXECUTE) or a fix that over-reaches will pass the security half while breaking the app.

</details>
