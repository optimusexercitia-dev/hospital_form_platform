# FUP-E2E-REPEAT-FLAKY — ⭕ **DOWN TO TWO members 2026-08-17, and the "one root cause" hypothesis is now EVIDENCED, not merely suspected** (owner: lead + tester)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-02 · status parked

- 🟡 **FUP-E2E-REPEAT-FLAKY** — `act-role-assumption:157` + `phase2-auth-shell:268` flaked in **BOTH** DM3 `e2e:prod` runs ⇒ a pattern, not noise; outside the DM3 diff. **Both flaked again in DM5·S3's gate (3rd + 4th occurrence) — the pattern is now established, not suspected.** Both flaked again at DM5·S6's green gate. ~~Third member added 2026-08-14: `dm5-nsp-evidence.spec.ts:347` EVID-KBD-1~~ — **REMOVED 2026-08-17: root-caused and fixed (BUG-DM5-S6-EVID-KBD-1), so it was never a flake.** All were focus/navigation-timing shaped, matching the standing *"`.focus()` is not auto-waiting — it races RSC streaming"* class, which suggested **one** root cause rather than three flaky tests — lead/tester

> **⭐ 2026-08-17 — the hypothesis in the last sentence above got its first real test, and it held.**
> EVID-KBD-1 was pursued as a *defect* rather than accepted as a flake, and it had a precise
> mechanism: a readiness helper treated the **ancestor layout's `<main>`** as proof of rendered
> content, but that `<main>` persists across the `loading.tsx` → `page.tsx` Suspense swap, so a
> fixed-budget `focusByTabbing` could start counting Tab presses against a near-inert skeleton.
> Load-dependent, hence "flaky"-looking. It is exactly the predicted family — **one layer above where
> the class was being looked for** (the check that decides *when it is safe to start*, not the
> `.focus()` call itself).
>
> **What this changes for the surviving two:** they are no longer "two tests that flake". There is now
> a **named, reproducible mechanism** to test them against, and a working method: reproduce at
> **batch composition** (they pass in isolation — the isolated run is the trap), run at `RETRIES=0`,
> and fix the *precondition* rather than the budget.
> ⭐ **Concrete unverified lead, from the tester, worth writing down before it is lost:**
> `phase2-auth-shell.spec.ts` calls a **bare `.focus()` shortly after a navigation** — the same
> anti-pattern, in one of the two survivors. **Not investigated and not confirmed** (it is unknown
> whether that route even has a `loading.tsx` boundary). *A lead, not a finding.*
> ⚠ **Do not close this FUP on EVID-KBD-1's fix** — one member's root cause is evidence about the
> class, not a closure of the other two.

> ### ✅ 2026-08-27 — FINGERPRINTS, OWNER AND EXPIRY ADDED (AE1 close condition #5 / PA-F16)
>
> PA-F16: *"a name-matched failure with a novel fingerprint is a red, not a flake."* Until now
> these two entries carried a NAME and an owner and nothing else, so any failure of either test
> — for any reason — could be waved through as "the known flake".
>
> ⚠ **What these fingerprints ARE, stated so they are not over-trusted:** the failing **step**,
> derived from the spec source. The **message pattern** half is deliberately left OWED, because
> `e2e:prod` has not run this phase and inventing an error string nobody observed would be the
> exact defect this condition exists to close. Fill it in at the next observed occurrence.
> Even step-only, the discriminator already works: a failure at a different step is a red.
>
> **M1 — `act-role-assumption.spec.ts:157`** *"The switch: assuming a hat then switching changes
> the landing route AND real authorization"* · owner **tester** · expiry **2026-10-31**
> - FLAKE fingerprint: a Playwright **timeout** on the landing-route assertion
>   `expect(page).toHaveURL(/\/o\/rede-a\/manage$/)` (:160), the first assertion after
>   `cachedSignIn(… 'dualhat.a@test.local', … 'org_admin')` — navigation not settled.
> - ⛔ RED, not a flake: a URL **mismatch** rather than a timeout (that is a routing defect, not
>   timing) · a failure at any later assertion in the test · any auth/permission error.
>
> **M2 — `phase2-auth-shell.spec.ts:268`** *"logging out via user menu redirects to /login and
> clears session"* · owner **tester** · expiry **2026-10-31**
> - FLAKE fingerprint: a **timeout** inside `signOutViaMenu` (:51–62) at either
>   `expect(sairButton).toBeVisible({ timeout: 5_000 })` (:58) or
>   `page.waitForURL('**/login', { timeout: 15_000 })` (:61).
> - ⛔ RED, not a flake: a failure at the post-logout re-visit assertion (:274+) — that is
>   session clearing, a different claim · any non-timeout error.
>
> ⛔ **At expiry an entry is root-caused or re-justified in writing, never silently renewed** —
> a baseline that only ever grows is how "two pre-existing flakes" became a floor rather than a
> count.
>
> ### ⛔ 2026-08-27 — THE "CONCRETE UNVERIFIED LEAD" ABOVE IS WRONG AT THE GRAIN THAT MATTERS
>
> It reads: *"`phase2-auth-shell.spec.ts` calls a bare `.focus()` shortly after a navigation —
> the same anti-pattern, **in one of the two survivors**."* Measured: the file does contain a bare
> `.focus()`, at **:375** — but that line is inside
> `test('user can sign in and log out using only the keyboard')` (**:341**), which is **NOT** the
> flaking test. The survivor is `'logging out via user menu…'` at **:268**, and neither it nor
> its `signOutViaMenu` helper calls `.focus()` at all.
>
> ⭐ A true fact about the FILE was cited for a conclusion about the TEST. The lead was correctly
> labelled unverified; what made it durable is that the sentence reads as though it had been
> checked at the grain it is used at. ⚠ The `.focus()`-races-RSC-streaming class may still explain
> M1 or M2 — this removes the only *evidence* offered for it, not the hypothesis.

> ### ⭐ 2026-08-27, SAME DAY — THE FINGERPRINTS MET THEIR FIRST RUN, AND SPLIT 1 FOR 2
>
> `e2e:prod` on `120478bf`: **GATE GREEN**, 1249 passed · 0 failed · 0 did-not-run · **3 flaky**
> · 11 skipped · 21 batches; accounted **1263/1263** on the final batch lines (the summary's
> "1252 of 1263" excludes the 11 skips — the arithmetic closes, nothing went unrun).
>
> **M2 — EXACT MATCH.** `phase2-auth-shell.spec.ts:268` failed at
> `expect(sairButton).toBeVisible({ timeout: 5_000 })` — **line 58**, one of the two steps the
> fingerprint named hours earlier from reading the spec. The method works.
>
> **M1 — MISMATCH, and the fingerprint is CORRECTED FROM THE MEASUREMENT.**
> `act-role-assumption.spec.ts:157` was fingerprinted as a `toHaveURL` timeout at **:160**. It
> actually failed at **:168** — `getByRole('menuitem', { name: /revisor\(a\) da qualidade/i })
> .click()`, `locator.click: Test timeout of 30000ms exceeded`.
> - New M1 fingerprint: **a timeout clicking a `menuitem` inside the "abrir menu da conta"
>   dropdown at :168**, after the trigger click at :167.
> - ⛔ **Why this is a correction and not the baseline absorbing a defect** — the distinction
>   matters, because "the fingerprint did not match, so widen it" is exactly how a baseline eats a
>   real failure. The :160 step was an explicitly-labelled **guess** with no evidential basis (the
>   entry said so: *"the message pattern half is deliberately left OWED"*). Replacing a placeholder
>   with the first observation is not the same act as widening a fingerprint that was ever
>   measured. ⚠ It cost something real: M1's fingerprint provided **zero discrimination** on the
>   one run it existed for. From here it is measured, and a further move is a red.
>
> ### ⭐⭐ ONE ROOT CAUSE — BUT NOT THE ONE THIS FUP HAS HYPOTHESISED FOR MONTHS
>
> M1 fails clicking `menuitem` *"revisor(a) da qualidade"*; M2 fails on `menuitem` *"sair"* not
> visible. **Both are Radix dropdown items inside the SAME `"abrir menu da conta"` menu, and both
> fail because the item is absent after the trigger was clicked.** That is one shared, concrete
> mechanism across both survivors — which is the "one root cause rather than two flaky tests"
> this FUP has predicted all along.
>
> ⛔ **It is not the `.focus()`-races-RSC-streaming class.** Neither failing step calls `.focus()`;
> the earlier note in this FUP pointing at a bare `.focus()` in `phase2-auth-shell.spec.ts` was
> already corrected today (it is at **:375**, inside a *different* test). The hypothesis now has no
> supporting evidence and a positive alternative: **the account dropdown's items are not reliably
> present after its trigger click**. ⚠ Still a mechanism, not a fix — nobody has established
> *why* the menu is empty (Radix portal mount vs. RSC hydration vs. the trigger's own readiness).
>
> ### ⛔ A THIRD FLAKE APPEARED, AND IT IS **NOT** ADMITTED TO THIS BASELINE
>
> `ethics-e4-participants.spec.ts:765` (PROF-CREATE) flaked in batch 6, failing at **:787**:
> `getByRole('region', { name: 'Participantes' }).locator('li').filter({ hasText: 'Dr. Novo
> Respondente (E4)' })` not visible within 10s — a **roster row after an inline create**, a
> different mechanism from the dropdown class above.
>
> ⛔ **Not added as a member here, deliberately.** *"The two pre-existing flakes are a floor, not
> a guarantee"* is a warning about the count, not permission to grow it: a baseline that absorbs
> every new name on sight is how a defect becomes furniture. It needs an owner, an expiry and a
> disposition (flake vs. defect) **decided**, not assumed — filed as
> `FUP-E2E-PROF-CREATE-ROSTER-FLAKE` for the lead/PO, with this run as its first and only
> observation.
