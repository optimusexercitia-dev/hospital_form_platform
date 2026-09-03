# FUP-SERVICE-ROLE-WRITE-SITES-NO-GUARD-VANISH-TEST — 19 of 44 service-role write sites have no test that would notice their guard vanish (owner: backend/tester)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-27 · status open

> Filed 2026-08-27 at the AE1 Record step (obligation 4, AE1.4). ⛔ **The obligation table's
> "26 of 45" is retired here — it does not reproduce.** The registry is **44** rows post-AE1.3, and 26
> is not derivable from them in either direction.
>
> **Re-derived from [`../backend-state.md`](../backend-state.md) § "Service-role DML registry"** by
> classifying each row's **Test** cell on its LEADING verdict token — the rule the registry's own
> Summary states — over all 44 `Key`-bearing rows in Groups A–H:
> **20 `YES` · 5 `PARTIAL` · 15 `NONE` · 4 `UNCONFIRMED` = 44**, which reproduces that Summary exactly.
>
> - **19 of 44 (43%) have no test at all** that would notice the mechanism vanish = 15 `NONE` + 4
>   `UNCONFIRMED`.
> - **24 of 44 (55%) are not fully covered** once the 5 `PARTIAL` half-gaps are counted.
> - ⚠ **The live not-fully-covered figure is 22, not 24.** Two of the five `PARTIAL` rows are the
>   `minutes-jobs/webhook.ts` pair, whose cells now record the route half **LANDED 2026-08-27**
>   (`src/app/api/webhooks/audio-jobs/route.rpc-boundary.test.ts`, red-first proven) with
>   `FUP-MINUTES-WEBHOOK-HMAC-DENY-TEST` closed. They stay `PARTIAL` under the leading-token rule while
>   being covered in fact, so the Summary prose still reading *"route half `NONE` until … lands"* is
>   stale against its own rows.
>
> ⛔ **`PARTIAL` must never be collapsed into `NONE`.** The registry's own correction paragraph records
> that doing so silently is what made AE1.4's first tally (`19 / 22 / 4` over 45 rows) irreproducible.
> A later re-count that reported "20 no-test" repeated exactly that collapse (15 `NONE` + 5 `PARTIAL`),
> and 20 happens to equal the `YES` count, so the error reads as a coincidence rather than a mistake.
> State all four tokens, or state none.
>
> **Where the 15 `NONE` sit:** 4 Group E role grant/revoke sites (`assignOrgAdmin`,
> `assignCommitteeRole`, `registerUser` → `grant_role_for`; `removeCommittee` → `revoke_role_for`) · 4
> Group F storage sites (`documents.reclassifyDocument` ×2, `pdf-mint.mintPrintedDocument` ×2) · 4
> Group G sign-upload wrappers · 2 Group C `minutes-jobs/reconcile.ts` · 1 Group B `updatePassword`.
> The 4 `UNCONFIRMED` are one shape — `registerUser`'s shared entry gate, whose denial path was not
> found in the reported coverage and is **not proven absent**.
>
> **Discharged when** every `NONE` and `UNCONFIRMED` row either gains a named test that goes red when
> its stated mechanism is removed, or carries a recorded ruling that it does not need one — and the
> tally paragraph is **re-derived from the rows**. ⛔ Never adjust these numbers arithmetically; that
> is how a direction gets fixed while the magnitude stays wrong.
