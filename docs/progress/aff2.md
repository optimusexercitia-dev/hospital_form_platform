# AFF2 — workstream task detail (live)

Task-level state for **AFF2** (affiliation-scoped administration + user-management
redesign). Created 2026-08-23 at build start because the tracker had nowhere for three
parallel tracks to report: PROGRESS.md § Now and § Phase Status are both **lead-owned**
under CLAUDE.md §7, so a teammate writing into either would violate *"every teammate
updates only their own rows/sections"*. Found by `frontend` asking instead of guessing.

**Authority:** ADR [0133](../decisions/0133-aff2-affiliation-scoped-administration-um-redesign.md)
(+ **Amendment 1**, 2026-08-21 — the capability split; + **Amendment 2**, 2026-08-23 —
D13's contradiction resolved toward the artifact, the read/write asymmetry stated, B8
added) · plan [aff2-user-management.md](../plans/aff2-user-management.md).

**Ownership.** Each track owns **its own section below** and edits no other. The lead owns
this header, § Cross-track, and PROGRESS.md § Now. ⛔ This file is **task detail, not live
state** — the workstream's headline status stays in PROGRESS.md § Now; when AFF2 completes,
this file is where its detail already lives (no rotation needed at the Record step).

⛔ **Do not restate the gate contract here.** `npm run lint:progress` governs PROGRESS.md,
not this file; the §6 phase gate is in CLAUDE.md. A second copy is what drifts.

---

## Cross-track — sequencing and shared facts *(lead-owned)*

**Branch:** `feat/aff2-user-management`, cut from `main` at `16b40c62` (all 8 lint gates
green at the cut).

**Migrations number from `20261003001000`.** Local and remote are both **441 /
`20261003000900`** (measured 2026-08-23, both sides). ⛔ Re-measure, never re-read.

**Contract-first sequence.** B1–B3 land before F needs new data. F1 builds against today's
`org-users.ts` shape with the new fields optional. B7 is what makes the pills and the
Registro/Comissões columns real; **B2 is what makes the Registro cell non-empty for a
hospital admin**, so B2 must precede any hospital-admin verification pass.

**Sequencing constraint the tester must respect:** the F1 status pills ship **URL-wired but
inert** until B7 merges. Pill filtering and pill counts are **not testable** before then, and
a pill renders its label alone rather than a fabricated "· 0" — a fabricated zero is a false
measurement, which this repo treats as worse than a missing one.

**Shared local stack — one owner at a time.** Ask the lead before `supabase db reset --local`;
a reset lands silently in another agent's evidence, and a half-applied one produces phantom
reds *and* phantom greens. Resets so far: `backend`, 2026-08-23 (exit 0, 441 registered ==
441 files).

**The e2e:prod baseline pin** for this workstream is the 2026-08-23 run at `d885f621`
(1185 p · 2 f · 2 flaky · 8 DNR · 20 batches, no batch gaps). Both failures are retry
artifacts on non-idempotent tests — re-run alone they are 25 p / 0 f, exit 0. Diff the
gate against that pin, with the stash-discipline re-run for anything new.
⛔ The plan's risk list names **BUG-QO-STALE-CASOS** as the thing to resolve first; that bug
was **RESOLVED 2026-08-21** and the line is stale. The live baseline residue is
`FUP-RETRY-CHANGES-THE-FAILURE-MODE-ON-NON-IDEMPOTENT-TESTS`.

---

## Track B — backend *(backend-owned)*

| Task | State |
| --- | --- |
| B1 · `profiles.date_of_birth` + `phone` | plan ACKed 2026-08-23 |
| B2 · `professional_credentials` SELECT widening | plan ACKed 2026-08-23 (mirror form, Amdt 2 r1) |
| B3 · `list_org_people` payload + `date_of_birth` | plan ACKed 2026-08-23 |
| B4 · `authorizePersonScopedAdmin` + action rewiring | not started |
| B5 · Vitest keystone matrix | not started |
| B6 · Detail-page locked-column read | not started |
| B7 · Directory query widening | not started |
| **B8 · org-hospitals list + `hospital` filter arg** | **NEW — PO-ruled 2026-08-23 (Amdt 2 r4)**; after B7 |

---

## Track F — frontend *(frontend-owned)*

| Task | State |
| --- | --- |
| F1 · Directory table | ✅ **built 2026-08-23** — lint 8/8, `tsc` 0, 24/24 browser checks. ⚠ Two arms inert pending B7 (below) |
| F2 · Profile page | blocked on B6 |
| F3 · Register wizard | blocked on B3 |
| F4 · Copy + a11y pass (**incl. the deferred `error.tsx`**) | not started |

### F1 — what shipped, and what is still inert

Files (5): `usuarios/page.tsx` · `usuarios/loading.tsx` (new) ·
`components/users/user-directory-list.tsx` · `user-directory-search.tsx` ·
`user-directory-status-pills.tsx` (new). Nothing under `src/lib/**` or `supabase/**` touched.

⛔ **Two arms are URL-wired but INERT until B7 lands, by design — not defects:**
1. **`?status=` does not filter.** Parsed, rendered, `aria-current` correct, params
   preserved — but not passed to the query, which does not accept it. Deriving it page-side
   needs either a second copy of `deriveUserStatus` or an unpaged read. Pills show their
   label alone; **no fabricated "· 0"**.
2. **Registro is "—" for every row and Comissões shows counts, not named chips.** Both fall
   back to the current row's data; neither is ever blank. Registro additionally needs **B2**
   before a hospital admin sees anything.

**Verified in a real browser** (headless Playwright vs `npm run dev`; never the Browser pane,
which composites nothing). 24/24 — org_admin **29 people / 20 rows**, hospital_admin
**15 rows** (scope holds); search 20 → 1; pill sets `?status=`, keeps `?search=`, drops
`?page=`; empty copy is *"none found"* and the word *permiss* appears nowhere; Tab walks
pills → search → Buscar → rows; Enter on a row opens the profile; **0px** horizontal
overflow at 375px; 0 console errors.

⭐ **The `exact: true` risk the lead flagged is measured CLOSED, not reasoned closed.**
`getByText('Sem comissão', { exact: true })` resolves **11 matches** (one per committee-less
row) and `'Sem vínculo hospitalar'` **17** — so the `sr-only` prefixes are *not* fusing and
`aff-hospital-affiliation.spec.ts:206,425,436` **does not break**. Each empty-state string
sits in its own element, which is what makes that true; it is load-bearing, not tidiness.

**Row accessible name, from the aria tree** (not `textContent`): *"Admin Hospital A1
hospitaladmin.a1@test.local Situação: Ativo Vínculo hospitalar: Hospital Central A Comissões:
Sem comissão Registro profissional: sem registro"* — every cell self-labels, the avatar
initials and chevron are excluded, and "—" is replaced by *"sem registro"*.

**Deliberate deviations from the handoff, each with a reason:**
- Pills are server-rendered `<Link>`s, not `<button onClick>` — zero JS, native keyboard,
  real `aria-current`.
- Not a `<table>`: an `<a>` may not wrap a `<tr>` and the whole row is one link. `<ul>`/`<li>`
  + grid; the header strip is `aria-hidden` decoration because every cell self-labels.
- **Stacked below `lg`, 6-col grid at `lg`+.** The handoff's track needs ~866px; an
  `overflow-x-auto` trough would need its own keyboard-scrollable region.
- CSS `.animate-rise-in` (40ms stagger), **not** `RiseInGroup` — that is a Client Component,
  and wrapping 20 decorative rows in GSAP would push `"use client"` around the whole table.
- Search keeps its "Buscar" button (existing affordance; the handoff draws input-only).

⚠ **One spec still breaks and is `tester`'s:** `user-registration.spec.ts:488` uses
`getByLabel('Buscar por nome, e-mail ou categoria')`; the label is now
**"Buscar por nome ou e-mail"** (Amdt 2 r4 — say only what the query searches).

⚠ **The DSR "Direitos do Titular" console entry is NOT regressed** — established by
non-modification (`manage/layout.tsx` is untouched), not by test. It did not render for
`orgadmin.a@`, which is its own eligibility gate, not this change.

---

## Track T — tester *(tester-owned)*

Not yet spawned. Spawns when F lands per-screen and the dev server runs.

---

## Rulings & corrections made during the build *(lead-owned)*

Decisions live in the ADR; this is the index so a reader finds them without re-deriving.

- **2026-08-23 · Four PO rulings** → ADR 0133 **Amendment 2**: D13's mirror-vs-commission-tier
  contradiction resolved toward the artifact; `expires_at` mirrored (absent); B8 built; search
  label honest now with the registro leg deferred.
- **2026-08-23 · Two plan premises measured STALE at build start.** B3's *"signatures keep
  `extensions.citext`"* is wrong for this door — `list_org_people(uuid,text,text)` has one
  overload, all `pg_catalog.text`; obeying it would `CREATE` a **second overload** beside the
  real door. And B3 cannot use `CREATE OR REPLACE` at all: adding a column changes the return
  type, so it is `DROP`+`CREATE`, which resets `proacl` to **NULL = PUBLIC** and destroys the
  function COMMENT. ⭐ Class: *a plan's carried-forward "remember the X lesson" is a hand-copied
  claim about a specific subject, written in the most trusted register in the document.*
- **2026-08-23 · Four prompt/handoff premises measured FALSE by `frontend`** before building:
  the search box is not a `FormData` caller (no `nameRequiredFor`); the org_admin hospital
  select was unbuildable (→ B8); the search doc comment and the visible `aria-label` both
  over-promise *"ou categoria"*, which is never searched; the mock's chip copy is gendered
  where the codebase's `ROLE_LABEL` is not (ship "Coordenação"/"Membro").
- **2026-08-23 · One spec-breakage mechanism CORRECTED (lead).** `aff-hospital-affiliation.spec.ts`
  was predicted to break because "the container changes from a card `<li>` to a grid row" — it
  does not; the F1 design keeps `<ul>`/`<li>`, so `page.locator('li').filter()` still resolves.
  The real risk is the `sr-only` cell prefixes fusing with the visible string under
  `exact: true`. Keeping each empty-state string in **its own element** means the spec does not
  break at all. ⭐ A wrong mechanism produces a wrong fix — handed on as stated, `tester` would
  have rewritten a working locator.
