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

**⛔ Shared local stack — CLOSED BY DEFAULT.** Ask the lead and **wait for an answer** before anything
touches the DB. Writing code needs no permission; touching the DB does. Resets so far: `backend`
2026-08-23 ×2 (441==441, then 444==444 / `20261003001200`).

> ⚠ **This rule was tightened after it failed on 2026-08-23, and the earlier version is worth knowing
> because it *sounded* sufficient.** It read "ping me when you want the stack" — which puts the
> scheduling decision on the party who **cannot see the other track**, so it fails in exactly the case
> it exists for. The lead released `frontend` for Playwright while telling `backend` to start the phase
> gate, and F3 verification inserted **10 rows** into the database the gate was running against
> (`auth.users` 36 → 46). ⭐ **The recorded lesson is that a `db reset` lands silently in another
> agent's evidence; the inverse is equally real and less obvious — ordinary E2E *writes* contaminate a
> GATE.** No reset, no crash, nothing to notice, and it runs **both ways**: a data-dependent assertion
> can go spuriously *green* as readily as red.
>
> ✅ **Fully attributed, by two independent instruments that share no path:** the lead's catalog read
> (`auth.users` 46 vs a 36 baseline = 10) and `frontend`'s UI read (Rede A directory 29 → 39 = 10),
> reconciling exactly against their own 6 `f3.wizard.*` + 4 `f3.skip.*`. Established: **pure inserts,
> no seeded row mutated** (fresh CPFs, `f3.*@test.local`), **no commissions/memberships/credentials
> created**, all in **Rede A**. So only *counts* and *"list everyone"* reads can have moved — anything
> keyed on a seeded identity, and the fixed-id B2 fixtures, are out of reach. That narrowed `backend`'s
> question from "what moved?" to "did any assertion read Rede A cardinality?" — classify, don't
> reflexively re-run. ⭐ **It reconciled only because the delta was reported as a NUMBER.** "A few test
> users" would have left the two measurements unmatched, and the honest conclusion would then have been
> *"something unexplained also moved"* — far more expensive to chase than the truth.

**⛔ B4 GATES F3 SHIPPING — not just F3 finishing.** `RegisterUserInput` carries no
`dateOfBirth`/`phone` (measured), so rendering those inputs before B4 is **silent data loss**: the
admin types a birth date, sees it accepted, gets a success redirect, and the value is dropped.
⭐ **The F1 "model it optional, absorb later" pattern does NOT transfer from DISPLAY fields to
INPUTS** — for display, absent data renders a documented placeholder and nothing is lost; for input,
the same shape is a lie with a success message. F3 therefore ships **"complete except two fields"**
with a marked insertion point. ⚠ ADR 0133 D9 says both columns are *"optional at registration"*, so
F3 without them is **incomplete against the ADR**, not merely deferred — F3 must not merge with the
insertion point empty.

**⛔ THREE actions-layer gaps block F3's completion — all the same class, found by `frontend` while
wiring the submit.** Each is a marked insertion point in committed code, not a silent omission:
1. **`registerUser` accepts no `dateOfBirth`/`phone`** (B4) — the fields are not rendered; see above.
2. **`registerUser` returns `Promise<ActionState>` = `{ok, error?, fieldErrors?}` and NOT the created
   id**, so the plan's *"Success → redirect to the new profile"* is **unimplementable**. No URL was
   invented: the submit lands on the directory **filtered to the new e-mail**, so the admin still sees
   exactly the person they created. One line (`orgHref(org,"manage","usuarios",id)`) the day the action
   returns an id — offered to `backend` as an option while they are in `actions.ts` for B4, not imposed.
3. **`registerUser` accepts no affiliation start date** ("Data de início"), so the affiliation begins
   today — which is also the correct default for someone registered today, so this one costs nothing.
   ⚠ Note the asymmetry is in the **actions layer, not the UI**: `affiliatePerson` (the existing-person
   path) *does* accept a start date.

**Known E2E breakage inventory (for `tester`, enumerated 2026-08-23 by `frontend` before building).**
The wizard moves **Hospital + Matrícula to step 2** and **committees to step 3**, so every spec that
registers a person on one screen needs a `Continuar` walk inserted:
- `aff-hospital-affiliation.spec.ts` — walks at **:176, :221, :379, :403, :546, :705**; **:196** is the
  exact breaking line (`getByLabel(/^hospital/i)` while still on step 1).
- `hospital-admin-tier.spec.ts` — **:743, :761** · `phase3-admin-members.spec.ts` — **:136**.
- `user-registration.spec.ts:488` — `getByLabel('Buscar por nome, e-mail ou categoria')`; the F1 label
  is now **"Buscar por nome ou e-mail"**.
- ⛔ **NOT affected:** the `getByLabel('Buscar pessoa')` hits in those files are `AddMemberPicker`, a
  different component. Recorded because the negative stops three files being "fixed" that never broke.
- ✅ **Deliberately preserved anchors** (correct semantics *and* free spec compatibility, in that order):
  **"Comece pelo CPF"** as step 1's region name (`aff-hospital-affiliation.spec.ts:77`,
  `hospital-admin-tier.spec.ts:145`) and **"Dados pessoais"** as the revealed create-group heading
  (`form-name-attribute-invariant.spec.ts:564` — the paired positive proving the CPF lookup reached
  the server).

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
| B1 · `profiles.date_of_birth` + `phone` | ✅ **built 2026-08-23** — `20261003001000`; pgTAP `359` 18/18, red-first observed |
| B2 · `professional_credentials` SELECT widening | ✅ **built 2026-08-23** (mirror form, Amdt 2 r1) — `20261003001100`; pgTAP `360` 21/21, red-first observed |
| B3 · `list_org_people` payload + `date_of_birth` | ✅ **built 2026-08-23** — `20261003001200` (DROP+CREATE); pgTAP `361` 23/23, red-first observed |
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
| F2 · Profile page | ✅ **complete + VERIFIED 2026-08-23** — lint 8/8, `tsc` 0, **21/21** browser checks incl. the Amdt-1 split on one target |
| F3 · Register wizard | ✅ **complete 2026-08-23** — all three B4 insertion points closed (Nascimento, Telefone, redirect-to-profile). lint 8/8, `tsc` 0. ✅ **VERIFIED 2026-08-23**, 10/10 — including that the values SURVIVE the submit |
| F4 · Copy + a11y pass | ⏳ **partial** — `error.tsx` ✅ built **and verified** 2026-08-23 (pulled forward, lead-approved); the copy/a11y sweep itself waits on F2/F3 being final |

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

### F3 — built, and why it must not merge yet

Files: `usuarios/novo/page.tsx` (centered column) ·
`components/users/register-person-flow.tsx` (outcome A now hands off to the wizard) ·
`components/users/register-person-wizard.tsx` (new) · **`register-user-form.tsx` RETIRED** —
the wizard supersedes it and `register-person-flow` was its only consumer.

⛔ **THREE FIELDS THE PLAN/HANDOFF SPECIFY ARE NOT BUILT, because the action cannot accept
them.** All three are the same class: `RegisterUserInput` has no such field, so rendering the
control would take input, show it accepted, and drop it under a success redirect.
1. **Nascimento / Telefone** (step 1) — needs **B4**. ⛔ **This is why F3 must not merge**:
   ADR 0133 D9 says both columns are *"optional at registration"*, so the wizard is supposed
   to collect them and F3 without them is **incomplete against the ADR, not merely deferred**.
   Insertion point is marked in both the payload and the step-1 JSX.
2. **Data de início** (step 2) — `registerUser` takes `homeHospitalId` + `hospitalEmployeeId`
   and no start date, so the affiliation begins today (also the right default for someone
   registered today). `affiliatePerson`, on the existing-person path, does accept one.
3. **"Redirect to the new profile"** — `registerUser` returns `ActionState`
   (`{ ok, error?, fieldErrors? }`) and **does not return the id it created**, so there is no
   profile URL to go to. Lands on the directory filtered to the new e-mail instead: the admin
   still sees exactly the person they made, one click from their page. A one-line change if
   the action ever returns the id.

**✅ ALL THREE CLOSED 2026-08-23 against B4 (`fe701251`), verified from the signatures, not
the message announcing them:** `RegisterUserState extends ActionState { userId?: string }` and
`RegisterUserInput` carrying `dateOfBirth?: string | null` / `phone?: string | null`.
- **Nascimento** — `DatePicker`, `max={todayIso()}` so a future birth date is unstorable.
  `todayIso` is built from LOCAL date parts, not `toISOString()`, which converts to UTC and
  would hand back tomorrow west of Greenwich late in the day — a ceiling one day too loose.
- **Telefone** — new `components/users/phone-field.tsx`, a deliberate sibling of `CpfField`:
  digits-only in state, mask only in the rendered value, and ⛔ **no DOM `name`** for the same
  measured pre-hydration-native-submit reason (a phone number is LGPD personal data on the
  same footing as the CPF that leaked). ⛔ **No format validation** — the column has no CHECK
  by decision (Amdt 1 r6), and a UI stricter than its own schema rejects numbers the database
  accepts.
- **Redirect** — now `orgHref(org, manage, usuarios, result.userId)`. ⚠ Guarded, because
  `userId` is `string | undefined` and `ok: true` does **not** narrow it; the type admits an
  ok-without-id, and the fallback keeps the admin on the filtered directory rather than
  routing them to `/usuarios/undefined`.

✅ **VERIFIED 2026-08-23 — 10/10, end to end.** The point was never that the fields render; it
is that what the admin types **survives the submit**, because an input the action silently drops
is the exact failure the deferral existed to prevent and only a round trip distinguishes the two.
Measured: phone masks to `(11) 98765-4321` while state stays digits-only and the input carries
**no `name`** · a birth date is pickable · submit lands on **`/usuarios/<uuid>`**, the created
person's own page, not the filtered directory · and on that page the rail shows **`15/08/1985`**
and **`(11) 98765-4321`**, with CPF **presence-only**.

⭐ **The generalisable lesson, stated because the instruction that produced it was reasonable:**
"model the missing fields optional and absorb the backend as a type change" was carried over
from F1/B7 and **does not transfer from DISPLAY fields to INPUTS**. A display field with no
data renders a documented placeholder and loses nothing; an input whose value the action
discards is silent data loss with a success message on top.

**Verified in a real browser** (headless Playwright vs `npm run dev`), 24/24: full org_admin
three-step walk → person created with the step-2 hospital as a real affiliation; step 1
refuses Continuar with per-field messages rather than a bare block; Voltar preserves input;
CPF never reaches the URL (fill **and** keyboard-Enter paths); focus lands on the new step
heading; stepper renders 3 steps; 0 console errors.
⭐ **The D8 keystone passed:** `hospitaladmin.a1` **skipping step 2 entirely** still yields
"Hospital Central A" on the directory row — the skip drops the matrícula, never the vínculo.
⭐ **The default-config copy check passed:** exactly one `Registrar pessoa` button and **zero**
`enviar convite` buttons, so the screen does not promise an e-mail nothing sends.

**Deliberate deviations, each with a reason:**
- Final button branches on `emailVerificationEnabled` (ON → "Registrar e enviar convite",
  OFF → "Registrar pessoa") instead of the handoff's fixed invite wording, which is false in
  the default deployment. Spec compatibility is a side effect, not the reason.
- **No "Pular etapa" on the last step** — skipping committees and submitting with none are
  the same act; two controls with one effect make the admin work out whether they differ.
- Committee chips/labels use the codebase's `ROLE_LABEL`, not the mock's gendered copy.
- **"Comece pelo CPF"** and **"Dados pessoais"** kept as headings — correct semantics
  independently of the three specs that key off them.
- No escape hatch (D8): "Enviar convite agora" is not built.

⚠ **Two harness bugs of mine, recorded because both read exactly like app defects.**
`.focus()` is **not** auto-waiting — focusing before attach sent every keystroke nowhere and
the empty submit looked like a broken lookup. And `isVisible()` does **not** auto-wait, so the
first assertion after `goto` raced a cold Turbopack compile and returned false. A third
"failure" was a 20 s bound too tight under load; proved by running the same flow in isolation
(it rendered fine) before raising it — not written off as flake.

⚠ **My verification left 10 people in the shared local DB** (measured, not counted from
memory): 6 `f3.wizard.*` + 4 `f3.skip.*`, Rede A 29 → 39. No spec asserts an exact person
count (checked), and the pre-gate `db reset` clears them — flagged so nobody attributes the
delta to seed drift.

### F4 (partial) — `error.tsx`, and the gap it turned out to close

File: `usuarios/error.tsx`. lint 8/8, `tsc` 0, and ✅ **VERIFIED 2026-08-23 by thrown
render** — 8/8 on the directory **and** 8/8 again from a throwing `[userId]`, which is the
child-coverage claim measured rather than read off the route tree. Both probes reverted;
`git status -- src/` empty, no `BOUNDARYPROBE` residue.

⭐ **Run in DEV deliberately, and that is the stronger test.** In production Next redacts
the message before the boundary ever sees it, so a prod pass would prove nothing about
this component. In dev the real `error.message` IS handed to the boundary — so *not*
rendering it is a property of my code.
⭐ **With a positive control, because the redaction assertion is otherwise vacuous.** A
synthetic message shaped like leaked Postgres detail (`relation "public.profiles" does not
exist; permission denied for table memberships`) was thrown, then asserted absent from the
UI **and** asserted *present in the page payload* — proving the string reached the client
and was still not rendered, rather than an error that never fired.

**What the probes pinned:** the boundary renders · both actions present · the second one
resolves to `/o/rede-a/manage` (not the failed route) · **the manage shell SURVIVES** —
9 sidebar nav links still rendered, which is the entire reason the file exists · no
Postgres-shaped text anywhere in the UI · focus on the heading.

⭐ **It closes a real gap, not just a scaffold slot.** Measured, not assumed: there is no
`error.tsx` at `manage/` either, so before this file a render failure anywhere in the
`usuarios` subtree propagated past the manage shell to the **root** `src/app/error.tsx` —
taking the sidebar, org switcher and DSR console entry with it. It is now contained to the
content column.

**Scope, decided rather than inherited:** a segment's `error.tsx` never catches its own
layout, so `manage/layout.tsx` survives and the person is never trapped. It also covers
**`[userId]` and `novo`**, which have no boundary of their own (verified against the tree,
not assumed) — so the copy has to be true for all three surfaces and says *"esta página de
usuários"*, never *"a lista"*.

**Two calls worth recording:**
- ⛔ **Nothing from `error` is rendered** — not `message`, not `digest`, not a code. A
  Postgres error string can carry table, column and constraint names; it goes to the
  console, and the person gets a sentence.
- The second action is **"Ir para Visão geral"**, deliberately *not* "voltar para a lista".
  When it is the directory itself that failed, a link to the directory is the page the
  person is already on and Next may not navigate at all — a control that does nothing. The
  manage root is a different route from all three covered surfaces, so it always goes
  somewhere. Label copied from `org-manage-sidebar`, not invented.
- Focus moves to the heading on mount: React swaps the tree **in place**, so without it a
  keyboard user is left focused on a control that no longer exists.

---

### F2 — built against B6's posted contract, not yet exercised

Files: `usuarios/[userId]/page.tsx` (rebuilt to the identity band + rail) ·
`components/users/personal-data-card.tsx` (new) · `person-avatar.tsx` (new, shared) ·
`user-profile-edit-form.tsx` (form-only now) · `user-directory-list.tsx` (refactored onto
the shared avatar).

**Contract verified from the module, not from the message announcing it** —
`person-footprint.ts` exports `getPersonAdminView`, `PersonAdminView`,
`PersonPersonalData`, `PersonAdminAuthority` exactly as posted, and carries **no**
`'use server'` directive, so the page imports it as an ordinary server-side function.

⭐ **The three-state distinction is carried by the TYPE and is branched on first.**
`personalData === null` = **WITHHELD**; a `null` *inside* it = **NOT INFORMED**.
`PersonalDataCard` checks the outer null before any value renders, so a person who has a
birth date can never show "Não informado" because the caller lacked the capability —
which is the "empty means no-permission" state ADR 0133's Alternatives table names as the
reason B2 exists.

⭐ **Per-capability, not per-person.** `canEditPerson` (INTERSECTION) gates the Dados
pessoais / Registros "Editar"; `canManageAccountLifecycle` (SUBSET) gates
Desativar/Suspender/Reativar **and the CPF field inside the edit form**. Both computed
server-side and passed down; never re-derived client-side. The cross-hospital case —
where the two disagree — renders **editable fields plus** a note naming which half is out
of reach. The "somente organização" absolute is gone from this page.

⚠ **`UserProfileEditForm` is now form-only.** Its read-only branch moved to
`PersonalDataCard`, because after Amdt 1 "can see the values" and "can edit them" stopped
being the same question, and one component answering both by swapping trees was the wrong
shape. It also gained Nascimento/Telefone (D9 person-level fields, now writable via B4)
and `canEditCpf` as a **separate** prop rather than inheriting the form's own gate.

⛔ **The server comparison is the CPF gate, not this form.** The form omits `cpf` when
untouched as defence in depth; `updateUserProfile` compares against the current row, so an
absent key and an unchanged value reach the same verdict. If the form were the mechanism,
the bound would not be enforced.

✅ **VERIFIED 2026-08-23 — 21/21, and the fixtures were COMPUTED, not guessed.** A catalog
query classified every Rede A person by footprint against `hospitaladmin.a1`'s administered
hospital, which is how the three targets were chosen: `dr.john` (footprint 2, incl. Central A),
`staff1.ccih` (footprint {Central A}), `dt.a` (**technical_director @ Central A** — the tier
case at the caller's OWN hospital, D2's sharp one). Picking by persona name would have been a
guess about the exact property under test.

⭐ **The amendment measured on ONE target, two verdicts** — cross-hospital, as `hospitaladmin.a1`:
"Editar" offered · **0** lifecycle buttons · **no CPF field** inside the form · Nascimento and
Telefone editable · the note names which half is out of reach · the retired "somente
organização" absolute absent.
⭐ **Bounded on both sides by the same caller:** sole-hospital → Editar + **2** lifecycle buttons
+ CPF field present. Tier → no Editar, no lifecycle, withheld note, and ⛔ **not** collapsed into
"Não informado".
⭐ **The strongest differential — same target, two callers:** `orgadmin.a` on the *same*
cross-hospital person gets **2 lifecycle buttons and a CPF field** where the hospital admin had
neither. That is what proves the split tracks the CALLER's footprint rather than something
about the person.
Also pinned: `getByRole('region', { name: 'Vínculos hospitalares' })` still resolves, and **no
CPF digits appear anywhere** on the page (D12).

⚠ **One spec will break and is `tester`'s:** `hospital-admin-tier.spec.ts:822` asserts a
heading **"Situação da conta"**. That card is gone — the handoff moves lifecycle actions
into the identity band, which has no such heading. Not worth keeping a heading alive purely
to satisfy a locator. `getByRole('region', { name: 'Vínculos hospitalares' })`
(`aff-hospital-affiliation.spec.ts:655,689`) **still resolves** — that section kept its
name.

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
- **2026-08-23 · TWO premises in the LEAD's own brief measured FALSE by `backend`**, both caught by
  running a control expected to be a formality, and both of which would have shipped as *passing*
  keystones on security properties:
  1. ⛔ **"A `DROP` resets `proacl` to NULL, which means PUBLIC" is FALSE here — and the detector that
     wording produces is CONSTANT-TRUE.** Measured: `pg_default_acl` carries a rule for `public`
     (`postgres | {postgres=X,service_role=X}`) storing only the *explicitly configured* grants, with
     Postgres' built-in default (owner **+ `EXECUTE` to PUBLIC**) applied **on top** — so a fresh
     `CREATE FUNCTION` returns `{=X/postgres, postgres=X/postgres, service_role=X/postgres}`, populated
     and `anon`-executable. Census: **0 of 531** functions in `public` are NULL-`proacl` and **0 of 531**
     carry a PUBLIC entry. So `ok(proacl is not null)` **cannot fail**, and the 0-of-531 clean figure is
     evidence the `revoke … from public` step is **load-bearing, not ceremony**. Replaced with an exact
     ACL differential against the measured pre-`DROP` set (reds on NULL, on a gained PUBLIC/`anon`, and
     on a lost `service_role`) plus a direct `anon` arm. `prosecdef` stayed `t`, so `ARM=wrapper`'s
     domain is unaffected.
  2. ⚠ **"The default for a new column is *absent*" is FALSE as stated.** `profiles` carries a
     table-level `REFERENCES` grant, so `date_of_birth`/`phone` each show a `REFERENCES` row exactly as
     `cpf` does — value-blind, harmless, pre-existing, but a reviewer applying the literal rule would
     **red a correct migration**. The keystone now asserts D10's actual words — column-locked **like
     `cpf`**, as a differential against `cpf`, plus no SELECT/UPDATE/INSERT.
  ⭐ Both are the class already recorded below: *a carried-forward lesson stated about the wrong subject,
  in the most trusted register in the document* — here the register was a **lead brief**. Neither came
  from reading; both came from running a control.
- **2026-08-23 · No "Pular etapa" on the wizard's LAST step** (deliberate handoff deviation, `frontend`'s
  call, lead-approved). Skipping committees and submitting with none assigned are **the same act**, so
  offering both is two controls with one effect and the admin must work out a distinction that does not
  exist. The step caption carries the skip. ⛔ Recorded so it is not later "restored" as a fidelity fix.
- **2026-08-23 · `error.tsx` PULLED FORWARD from F4** — it is the only item in Track F needing neither
  the database nor a backend contract, and `frontend` was otherwise fully blocked. Bounded: route-level
  boundary for `usuarios` only (not the manage shell, and **not** `[userId]`/`novo`, whose boundaries
  are F2/F3 decisions), pt-BR, a `reset()` retry, and ⛔ **no raw Supabase/Postgres text reaching the
  UI** — CLAUDE.md §8, the rule the file exists to honour.
- **2026-08-23 · A NEW MODULE cannot be temporally red-first — its red proves absence, not discrimination.**
  B6's keystones could not be run "before the change": the file did not exist, so every arm would have failed
  on *cannot resolve import*, which says nothing about whether the assertions discriminate. `backend` used
  **mutation evidence** instead — four mutations, each required to red, all observed, restore byte-identical
  (M1 both capabilities evaluated as `'fields'` → 1 red · M2 withheld returns a zeroed object instead of
  `null` → **4** · M3 CPF digits returned → 3 · M4 footprint resolved twice → 1). ⭐ **M4 is the instructive
  one:** resolving twice is *functionally correct* and every other arm stays green, but it widens the TOCTOU
  residual ADR 0133 D4 accepted at **exactly one write** — a correctness-preserving change that silently
  degrades a stated invariant, catchable only by a **counting** assertion. ⛔ Red-first and mutation-proof are
  not interchangeable: pick by whether the subject can exist in the "before" state at all.
- **⚠ 2026-08-23 · GATE-SNAPSHOT DISCIPLINE — a per-track gate is not a tree gate.** `backend`'s B6 typecheck
  hit exit 2 on `usuarios/[userId]/page.tsx`, `frontend`'s in-flight F2 edit; it cleared on its own when the
  call site was updated. They correctly did **not** touch the file and did **not** stash the tree (a stash
  during another agent's active edit can destroy in-flight work). Attribution was conclusive — zero `tsc`
  errors in any file they own, both runs. ⛔ **But a gate run taken against a tree another agent is editing
  establishes only that the task is correct in isolation, not that the tree is.** The authoritative full-gate
  run for AFF2 is the **lead's, with both tracks still** — and it is a §6 step 1 obligation, not a formality
  discharged by two green per-track runs.
- **2026-08-23 · ⚖ ADR 0133 Amdt 1's "whenever the input includes `cpf`" ruled CHANGE-based (ADR 0133
  Amdt 3) — LEAD-ruled, not PO-escalated.** Read literally (presence-based), the subset bound applies to
  every `updateUserProfile` call carrying the key, so a hospital_admin editing the **name** of a
  cross-hospital person is denied — **the exact case Amdt 1 r1 exists to ALLOW**, failing invisibly as
  `orgAdminOnly`. Escalation declined on one ground: unlike the Amdt-2 rulings, both readings were not
  defensible — the literal one defeats the stated purpose of the amendment it appears in. ⭐ **A trap for
  the NEXT author, not a live bug:** the current form already omits the key when untouched
  (`user-profile-edit-form.tsx:86`), so presence-based works today and breaks when F2 is rebuilt — which
  is why it was settled before F2 exists. Pinned both ways, plus a keystone that an **absent key** and an
  **identically-valued key in different formatting** reach the **same** verdict (`frontend`'s question:
  *if F2's form is what keeps the bound correct, the bound isn't enforced* — the client cannot be the
  mechanism; the differing formatting is what proves `normalizeCpf` is in the comparison).
- **2026-08-23 · The error boundary is VERIFIED, 16/16 (`dc92dfc4`)** — two probes, the second throwing
  from `[userId]/page.tsx`, which converts the child-coverage claim from *read off the route tree* to
  *measured*. Pinned: the manage shell **survives** with its 9 sidebar links (the whole reason the file
  exists), no Postgres-shaped text in the UI, focus on the heading, second action resolving to a route
  other than the failed one. ⭐⭐ **Run in DEV deliberately, and that is the STRONGER test:** in prod Next
  redacts `error.message` before the boundary sees it, so a prod pass would have measured the framework,
  not the component. *Before running a negative assertion, ask who would satisfy it if the code under test
  were deleted.* Paired with a positive control — the leaked-looking string asserted **absent from the UI
  and present in the payload** — because "the bad string is absent" passes identically if the error never
  fired.
- **2026-08-23 · `TaskStop`'s success message carries NO information about whether a process is gone** —
  **three occurrences this session, zero misses**, the third holding PID 40932 while reporting
  "Successfully stopped". Only `curl` (exit 7) settled it each time. ⚠ Matters to the DB: a surviving dev
  server holds connections, the recorded mechanism by which a `db reset` half-applies into phantom greens.
- **2026-08-23 · Two F3 rulings, both agreeing with `frontend` against the handoff and against my own
  prior instruction.** (a) **Nascimento/Telefone are not rendered until B4** — see § Cross-track; my
  "model them optional" instruction was transplanted from display fields to inputs, where it means
  silent data loss. (b) **The wizard's final button branches on `isEmailVerificationEnabled()`** —
  verification ON → "Registrar e enviar convite" (the handoff's copy, now true), OFF →
  "Registrar pessoa". Measured: the helper is documented **DEFAULT OFF** and both `.env.example:26`
  and `.env.production.example:31` set `off`, so the handoff's copy promises an e-mail the default
  deployment never sends — while the page description on the same screen already branches on that
  flag. A **new adaptation from handoff fidelity**, in the same family as ADR 0133 Amdt 2's honest
  search label. ⭐ Spec compatibility is a **side effect, not the reason**: the copy would be right
  even if it broke every spec.
- **2026-08-23 · The B7 naming contract is CLOSED before it could drift.** F1 committed placeholder
  exports (`DirectoryRowExtras` with `hospitalNames: string[]` / `committees[]` / `councilRegistration`,
  plus `UserDirectoryStatusFilter` and `UserDirectoryStatusCounts`). These must **die** when B7 lands
  rather than become a parallel vocabulary — relayed to `backend` as *converge or object before writing
  the types*, since a post-hoc rename converts a type change into the rewrite F1's structure exists to
  avoid. Types live in `src/lib/users/types.ts` (backend-owned); the **names** are the contract.
- **2026-08-23 · One spec-breakage mechanism CORRECTED (lead).** `aff-hospital-affiliation.spec.ts`
  was predicted to break because "the container changes from a card `<li>` to a grid row" — it
  does not; the F1 design keeps `<ul>`/`<li>`, so `page.locator('li').filter()` still resolves.
  The real risk is the `sr-only` cell prefixes fusing with the visible string under
  `exact: true`. Keeping each empty-state string in **its own element** means the spec does not
  break at all. ⭐ A wrong mechanism produces a wrong fix — handed on as stated, `tester` would
  have rewritten a working locator.
