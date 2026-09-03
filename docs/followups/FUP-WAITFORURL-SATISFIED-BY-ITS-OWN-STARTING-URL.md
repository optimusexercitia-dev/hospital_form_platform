# FUP-WAITFORURL-SATISFIED-BY-ITS-OWN-STARTING-URL — a wait that is already true does not wait, and fails somewhere else (owner: tester/lead; filed 2026-08-23, found by `tester` sweeping their own fix)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-23 · status open

`e2e/aff-hospital-affiliation.spec.ts:764` (AFF-K, the keyboard test) does:

```ts
await page.keyboard.press('Enter')                              // client-side nav FROM /usuarios/novo
await page.waitForURL(/\/usuarios\/[^/]+$/, { timeout: 10_000 })
```

The starting URL **`/…/usuarios/novo` already satisfies that pattern** — `/usuarios/` followed by one or more
non-slash characters, then end. So the wait resolves **immediately, with zero navigation**, and the test races
ahead of the real transition.

⭐ **The class, which is the reason this is filed rather than shrugged at: the symptom appears somewhere else.**
The same mistake elsewhere in this sweep did not fail at the wait — it failed one step later with a misleading
*"person not found in search"*, sending the reader to look at search. A wait that no-ops is invisible at the
place it is wrong.

⚠ **It is GREEN today, and that is the problem.** Nothing interrupts it with a fresh `page.goto` before the next
assertion, whose own 10 s timeout absorbs the real navigation's delay. So it passes while **racing silently** —
the precise shape that becomes an unattributable flake months later, on a slower machine or a colder compile.

**Swept, so the boundary is known rather than assumed:** **9** loose `[^/]+` forms remain across `e2e/`
(`aff-hospital-affiliation` ×3, `hospital-admin-tier` ×1, `user-registration` ×5). **Eight are safe by
structure** — each is a `card.click()` from `/usuarios?search=…`, and that URL has **no slash after
`usuarios`**, so the pattern cannot match it. Verified on three of the eight by reading the preceding lines,
not inferred from the count. **`:764` is the only one whose starting URL matches.**

**Fix:** the positive form `/\/usuarios\/[0-9a-f-]{36}$/i` — assert what the destination **is**, not merely
what it is not.

⛔ **Pre-existing and out of AFF2's scope.** `tester` found it while sweeping a bug of their own making, and
correctly declined to fix it: the file is fully green and untouched by this workstream. **How to apply beyond
this instance: a `waitForURL` pattern must be checked against the STARTING url, not only the destination.**
