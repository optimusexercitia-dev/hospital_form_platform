# FUP-AE1-REVOKE-SET-EXECUTION — 233 classified revokes are HELD, partitioned, and 137 of them are a silent no-op as written (owner: backend/PO)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-27 · status open

> Filed 2026-08-27 at AE1's RV0 completion. Full decision record:
> [authz-ae1-revoke-partition.md](../design/authz-ae1-revoke-partition.md). ⛔ **AE1 executed
> none of these** — the phase produced the partition, not the revokes.
>
> **The partition** (head `20261003005300`, read-only, verdicts are a DELTA in arm-domain
> membership, not an absolute): PROCEED property-rescued **44** · PROCEED name-rescued **5**
> · **HOLD 23** · UNCHANGED **161** = 233 ✓.
>
> - **HOLD = 23** is the set a revoke would make sweep-blind: 3 `app` set-returning
>   (`case_phase_option_aggregates`, `eligible_voters`, `submitted_form_responses`) + 20 `public`
>   leaving `ARM=floor`, being 19 trigger bodies and **`set_participant_patient`** (Rule 12 PHI).
> - **The 5 name-rescued** are rescued *only* by `p0-authz-writepath-audit.sh`'s 11-name
>   `GUARD_KEYS` hand list. A rename silently evicts them from the sweep — the
>   *a-rename-orphans-a-name-keyed-verdict* shape. Never merge them into property-rescued.
> - **UNCHANGED = 161 is NOT a clean bill.** Those were in zero arms' domains before the revoke
>   and stay at zero after; they are unexamined, not cleared.
>
> ⛔⛔ **Whoever executes these batches must probe, not trust the exit code.** **137 of the 233**
> reach `authenticated` **only via `PUBLIC`** (`proacl IS NULL`), so `revoke execute … from
> authenticated` leaves `has_function_privilege` **true** and nothing observable changes — and
> **no arm would notice**, because every arm returns an identical verdict for the honest reason
> that the privilege never moved. Re-proved by the lead as an *effective* probe rather than an ACL
> reading (rolled back, with a positive control): `app.can_read_event_patient` (`proacl` NULL)
> stayed `true` after the revoke while `app.commission_of_case` (explicit ACL) went `false`. The
> materialised ACL is the tell — `=X/postgres,…`, whose **leading `=X/` with an empty grantee IS
> the surviving PUBLIC grant**. ⚠ The probe landed on a **Rule 12 PHI read predicate**, so the
> no-op class is not confined to inert helpers. Fifth sighting of *a NULL `proacl` includes PUBLIC*.
> ✅ All **23 HOLD** rows carry a direct grant and no PUBLIC grant, so the revoke is fully
> effective on exactly the rows the verdict is about; the no-ops concentrate in UNCHANGED (130/137).
>
> **2026-09-08 note (Track A re-derivation, adopted by Track D per R26 — beside the figure, not a
> rewrite of it):** re-measured at head `20261003007350`. `proacl IS NULL` reproduces at exactly
> **137** — that half of the claim above is unchanged. But the *operational* question is "for how
> many is `revoke execute … from authenticated` a silent no-op?", and the answer is **138**:
> **`app.latest_published_version`** has a **non-NULL** `proacl` that nonetheless carries an explicit
> PUBLIC grant (`{=X/postgres,postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}`,
> where the empty-grantee `=X` **is** PUBLIC), so revoking `authenticated` leaves EXECUTE arriving via
> PUBLIC exactly as it does for the other 137. **137 and 138 are different predicates, not a stale
> figure and a fresh one**: 137 is `proacl IS NULL`; 138 is the effective silent-no-op class.
> *"`proacl IS NULL` includes PUBLIC"* is true and is why the 137 exist; its converse — *"`proacl IS
> NOT NULL` therefore excludes PUBLIC"* — is **false**, and keying the class on the ACL-text predicate
> instead of the effective one is what hid the 138th. Six further `app` DEFINER functions share this
> shape (`answer_map`, `can_read_correction_response`, `commission_of_version`, `is_admin`,
> `is_member_of`, `is_org_admin_of`) — outside the 233 and so outside this partition, but the same
> class and the same trap. Full re-derivation: `docs/design/authz-ae1-revoke-partition.md` §9.4;
> session log: `docs/progress/privilege-surface.md`.
>
> ⚠ **Batch 1's "lowest-consequence" framing is half false.** True at runtime (EXECUTE on a
> trigger function is checked at `CREATE TRIGGER`, never at fire time); false for observability —
> `ARM=floor` applies no return-type filter, so those 19 trigger bodies are in its domain **today**
> and the revoke evicts all 19.
>
> ✅ **RV3 is answered and is a hard input to any future revoke**: PostgreSQL **does** re-check
> EXECUTE at write time on a function referenced inside a stored CHECK expression — `42501`, not
> the constraint's `23514` — on both `plpgsql` and inlinable `sql`. Revoking EXECUTE on a
> constraint-referenced function therefore **breaks writes to the constrained table**.
>
> **Before any batch runs:** re-derive the partition at the then-current head (⛔ never reuse these
> numbers — the file's own header forbids it), scope each revoke to the route that actually holds
> the privilege, and assert `has_function_privilege` **moved** after each batch. An unmoved
> predicate is a failure, not idempotence.
