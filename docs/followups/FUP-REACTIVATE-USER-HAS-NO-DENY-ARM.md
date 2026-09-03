# FUP-REACTIVATE-USER-HAS-NO-DENY-ARM — the reactivate path's authority is proven only by its sibling's deny test (owner: backend/tester)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-27 · status open

> Filed 2026-08-27 at the AE1 Record step (obligation 6, AE1.4). `src/lib/users/actions.ts`'s
> `reactivateUser` calls `authorizePersonScopedAdmin(userId, 'lifecycle')` and then the
> `set_person_active_for` door — **the identical call** `deactivateUser` makes. The reported coverage
> names `d14-person-level.test.ts` §1 (allowed) and §6 (org_admin twin) for reactivate; the only
> exercised **deny** arm is §2, and §2 is written against `deactivateUser`.
>
> The registry states the shape in its own words: *"an incidental guard closing a hole the definition
> predicts, not an independently-proven one"* — the single row of 44 whose leading token is `YES` with
> a stated caveat.
>
> ⚠ **The guard genuinely covers both today**, because they share one call. The gap is that **nothing
> would notice if they stopped sharing it**: an edit giving `reactivateUser` its own path, or dropping
> the `personScopeAllows` call from it, is red nowhere.
>
> ⛔ **Do not discharge this by asserting the two call sites are identical** — that is the premise, not
> the test. **Discharged when** `d14-person-level.test.ts` carries a `reactivateUser` deny arm proven
> by a **differential**: neutralize `reactivateUser`'s own `authorizePersonScopedAdmin` call and the
> new arm must go red **while §2 stays green in the same run**. An arm that reds only when the shared
> call is removed is measuring the sibling, not this site.
