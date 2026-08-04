# Asserting route gates in E2E (flag gates, access gates, `notFound()`)

Two findings from Phase 16 that generalize to every gated route in this codebase. Both cost real
time to discover and neither is visible from reading a spec that looks correct.

---

## 1. `resp.status()` is NOT a valid 404 signal on any route with a sibling `loading.tsx`

**The trap.** A route that gates with `notFound()` inside an async Server Component *looks* like it
should answer HTTP 404. It does not, if the route has a `loading.tsx`. Next.js commits the response
— status **200** — as soon as the loading boundary begins streaming, which happens *before* the
async work that calls `notFound()` resolves. The not-found UI then arrives in the streamed body.

```ts
// ❌ Passes against a route that is rendering perfectly fine.
const resp = await page.goto(url)
expect(resp?.status()).toBe(404)
```

```ts
// ✅ Only the resolved DOM proves the gate.
await page.goto(url)
await expect(page.getByText('Não encontramos esta página.')).toBeVisible()
```

**Why it matters here.** Every `manage/acreditacao/**` route has a `loading.tsx`, and so do many
others in this codebase. A flag-gate or access-gate assertion written against the status code will
**pass whether the gate works or not** — it is not a weak test, it is a test of nothing.

**Rule:** assert the rendered not-found boundary, never the status code, for any route that has or
may later gain a `loading.tsx`. Adding a `loading.tsx` to a route silently invalidates a
status-code assertion elsewhere, and nothing will fail to tell you.

---

## 2. A flag-gated suite must prove it can fail, before any of its assertions are trusted

**The trap.** A feature behind a flag seeded **OFF** makes every one of its routes `notFound()`.
A spec suite run in that state passes by certifying 404s — the pages, queries and RPCs beneath are
never reached. This is not hypothetical: in Phase 16, **all seven query-layer functions still threw
`not implemented`** while `lint`, `typecheck`, 895 Vitest tests and a real `next build` were green,
because nothing ever called them (BUG-P16-002).

**Rule:** before trusting any assertion in a flag-gated suite, demonstrate **both** directions live:

```
flag OFF → the not-found boundary renders
flag ON  → real content renders
```

If you cannot make the suite fail on demand, it is not measuring the feature. Do this first, as its
own test, and route it at a page that does not depend on other in-flight work — otherwise a
concurrent bug can hold the proof hostage.

**Flip the flag at runtime only.** Never commit a flag flip to `seed.sql` or a migration from a
spec; the enable migration belongs at the phase's Record step (see the FF-program lesson: *no
enable migration = phase dark after `db push`*).

---

## 3. Corollary — "it compiles" and "it works" are unrelated claims for gated code

Phase 16 produced **four** separate instances of a full green bar covering code nothing reached:
throwing query stubs, stale generated types after a migration, and two Server→Client RSC crashes
that only render once a global framework exists. Every one was caught by **executing** the code —
a probe, a real E2E run, a fresh reset — and none by review, type-checking or a build.

When a phase is flag-gated, treat the build as evidence of syntax only. Coverage claims require the
gate open.

---

*Sources: PROGRESS.md BUG-P16-002; `e2e/phase16-accreditation-core.spec.ts` AC-0; ADR
[0093](../decisions/0093-phase-16-standards-crosswalk-replan.md). Companion doc:
[e2e-prod-build-gate.md](./e2e-prod-build-gate.md).*
