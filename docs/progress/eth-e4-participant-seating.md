# ETH·E4 — Ethics participant seating & professional identity (phase record)

**Complete 2026-08-11.** Binding model: ADR
[0108](../decisions/0108-eth-e4-participant-seating.md) · plan
[ethics-e4-participant-seating.md](../phases/ethics-e4-participant-seating.md) · locator contract
[ethics-e4-locator-contract.md](../phases/ethics-e4-locator-contract.md) · review
[eth-e4-review.md](../reviews/eth-e4-review.md) (r1 ⛔ → r2 ⛔ → **r3 ✅ APPROVED**).

Closes **FUP-ETH-1** (nothing could seat a professional — "Médico denunciado" was an unfillable
panel; scope grew to the external lane too, where 4 of 7 seeded roles were unfillable) and
**FUP-FF5-2**. The durable backend surface is in
[backend-state.md § ETH·E4](../backend-state.md) — read that, not this file, for what the
backend provides.

---

## What shipped

**6 migrations**, window `20260919000100`–`…000600`: `ensure_professional_participant` + the 1:1
unique index · `create_external_participant` · `set_primary_subject` **`create or replace`** (MOVE
semantics + linkage re-run) · `can_read_professional_profile` **`create or replace`** (the D5
org-manager arm) · `case_type_terminology` audit trigger · **the P0 column-list grant + DEFINER
projection**.

**App:** `queries/participants.ts` · all 7 previously-stubbed actions in `participants/actions.ts`
+ `createExternalParticipant` · `vocabulary/actions.ts` (T5) · `queries/members.ts`
`listLinkableOrgUsers` · the roster + dialogs in `components/cases/` · T5 vocabulary admin in
`components/org/`.

**Tests:** pgTAP `321` · `e2e/ethics-e4-participants.spec.ts` (12) · the rewrite of
`ethics-e3a-surfacing.spec.ts`'s three raw `dbInsert` sites (**the FUP-ETH-1 acceptance
criterion**) · new `lint:client-server-imports` gate.

## Final gate record

| Step | Result |
| --- | --- |
| 1 · Build | lint **0/0** (incl. css-vars, memberships-door, client-server 0 findings, vacuous 174 files/0) · typecheck · vitest **1218/1218** · `next build` exit 0 · pgTAP **Files=182, Tests=5794, PASS** on a fresh reset (353 registered == 353 files) |
| 1 · Authz | `ARM=census` HOLDS (450 gates / 461 verdicts) · `ARM=hat` HOLDS (3 reasoned allowlists) · `ARM=floor` HOLDS (79 never-called, all allowlisted) · diff-scoped door sweep **0 BLIND, 0 ERROR** · the 3 write doors **COVERED** in the standing write-path harness |
| 2 · E2E | **GATE GREEN — 140 passed · 0 failed · 0 infra · 0 flaky · 0 did-not-run · 7 batches · accounted 140/141** (1 skip). Earlier full-suite run @ `7e55f01` was **GREEN 1068/0/0**. |
| 3 · QA | **APPROVED (r3)** — r1 (1 P0 · 6 MAJOR · 11 MINOR) → r2 (CHANGES REQUESTED, narrow) → r3 |
| 4 · Human | ✅ approved 2026-08-11 |

⛔ **Name the ARM, never the script.** `ARM=census` HOLDS here but is **NOT** coverage for the three
write doors — its live domain is `bool`/set-returning and they return `uuid`/`void` (ADR 0079
Amendment 5 · FUP-AFF-1). Their coverage is the neutralization oracle, now standing.

## The P0, because it must not be lost

ADR 0108 D5's exposure argument was **false as written**. It promised "no case linkage" — true of
`professional_participants`, and irrelevant. `app.trg_pin_respondent_retention` is the **sole**
writer of `retention_pinned_at`/`retention_pin_reason`, fires on `case_decisions → 'issued'` for a
seated `respondent_doctor`, and those columns sat in a **table-wide** `authenticated` grant. QA
measured a sibling-commission `staff_admin` with no case access reading `full_name` **and** `cpf`
**and** `retention_pin_reason` — **a disclosed ethics proceeding.** ETH·E4 opened the write and
widened the read together.

Closed by a **column-list grant (12 of 17)** *plus* an explicit projection in the `prosecdef`
`get_case_professional` — **both halves are load-bearing; a grant alone leaks, and that was
measured, not argued.** A `set_eq` keystone pins projection ≡ grant in both directions. ADR 0108 D5
is amended with the false clause struck through **verbatim** and the reason recorded.

## Method lessons — the expensive ones

- ⛔ **The catalog beats the finding, not just the claim.** QA r2's MAJOR-1 rested on *"no door
  raises `P0002` deliberately (zero `pg_proc` hits)"*. **Six do, in pt-BR.** Complying would have
  replaced *"papel inválido"* with a generic constant — **a regression prescribed as a compliance
  fix**. The real leak was the arm it was bundled with: `23514` is **MIXED** (ours pt-BR, the
  engine's English on the same SQLSTATE). When a finding rests on a *countable* claim, run the
  count — it is one query, and it is the half most likely to be wrong.
- **A first count is not a finding.** Three false counts in one phase, all caught by re-measuring:
  an *unanchored* grep said 16 client modules sat beyond a lint gate's byte window (**anchored: 0**,
  all comment mentions); a `prosrc` regex reported the P0 leak pattern **present** in a DEFINER door
  where it appears only inside a comment explaining why it is not used (**0** outside comments —
  *strip comments before asserting on function text*).
- **A guard nothing calls is not coverage.** The fix for the missing `possui_conta` gating assertion
  was itself **dead on arrival**: `assertLinkageGating` had exactly one caller and it took the
  *other* arm. Found by sweeping the spec for options no caller passes.
- **Prove the assertion can fail.** Neutralizing `Boolean(linkUserId)` out of `linkageOk` turned
  PROF-CREATE **RED** (`expect(locator).toBeDisabled() failed`, exit 1). Before the change, deleting
  that conjunct left the suite **green**.
- **A DEFINER bypasses column grants.** The P0's grant half alone would have shipped the leak wearing
  a green check. `prosecdef` belongs beside `pg_policies`.
- **The precedent is not the instance.** Three misses: the `Remover` alertdialog (in a sibling
  component, absent here), `pickFromTypeahead`'s page-wide scope (Radix portals elsewhere,
  `TypeaheadField` renders inline), and `create_professional_profile` assumed get-or-create — it is a
  **bare INSERT**.
- **The union of scoped sweeps is not a sweep.** Three instances in one day (vacuity enumerated by
  assertion *syntax* not the property; the table whose grant changed rather than *reads whose failure
  is indistinguishable from empty*, 1 → 5 when re-scoped; and the lead scoping backend to one table).
- **"Void, not flaky."** pgTAP short counts under a PASS-shaped summary were **E2E-mutated-DB**, not
  infra noise — `252_authz_p0_isolation` planned 48 / ran 0 is the sharp signal, the aggregate is not.
  Always `supabase db reset --local` first.
- **A component's own handler can be correct and still lose.** BUG-ETHE4-FOCUS-1 symptom 2: Radix
  `DismissableLayer` handles Escape on `document` in the **capture** phase, so a bubble-phase
  `stopPropagation()` is structurally too late.
- **A green bar hides the wired seam.** Three defects survived lint + typecheck + vitest + pgTAP
  5794/5794 + every authz ARM, and only E2E caught them: the a11y focus trap, the *possui conta*
  picker fed a roster that **excludes** commission members (plan §0 named the wrong source — and the
  consequence was coordinators pushed to `no_account`, making the case exclusion vacuously
  satisfied), and a `server-only` module value-imported into a client component (aborts `next build`
  while every other gate passes). `npm run build` is now in the engineers' green bar, gated by
  `lint:client-server-imports`.
- **Don't pipe the gate through `tail`** — the pipeline returns `tail`'s status and masks `exit 2`.
- ⚠ **Process, mine (lead):** starting `p0-authz-writepath-audit.sh` with **no `ARM`** begins the
  full ~5 h periodic sweep that CLAUDE.md §6 step 1 excludes from a phase gate; and a `git add -A`
  captured its findings file mid-rewrite (73 → 40 lines). Restored byte-identical. **Scope the audit
  by ARM, and never `git add -A` while a sweep owns a file.**

## Open at completion

- **FUP-ETH-A11Y-1** — m3 (`aria-describedby` never wired to error ids) + m4 (typeahead announces
  neither loading nor result count). Deliberately not fixed in-phase: m4's only two routes both
  collide with `pickFromTypeahead`'s locators, so it needs a coordinated **tester-owned** spec change.
- **FUP-E2E-SERVER-DEAD-1** — the prod-standalone server dies under load in ~3 of 17 batches;
  `BATCH_TESTS=22` is the known rescue. Infra, never an assertion failure.
- **FUP-SILENT-READ-1** — the pre-existing residue (all 3 ETH·E4-authored instances fixed).
- **PO, unratified:** the Class-2 audit posture after D5 (wants one ADR line); and
  `department`/`institution`/`other`, mintable but with **no seeded role** — the UI names the state
  ("Nenhum papel cadastrado aceita este tipo de participante"), so it is a seeding choice, not a
  defect.
- **MAJOR-2(b)** — the picker scope limit. r2 made it non-blocking **conditional on B-1 landing**;
  B-1 landed. Closing it fully needs a `profiles_select_self_or_admin` widening — a security decision
  deliberately escalated rather than taken by an agent. Two cheap items to attach: the `no_account`
  confirmation copy should say the roster may not include everyone in the org, and
  `listLinkableOrgUsers` anchors on `home_organization_id`, which ADR 0097 (AFF) made insufficient.
- ⚠ **Before any remote `db push`:** the duplicate check on
  `professional_participants.professional_profile_id` (plan §6 step 3). A local `count=1` proves
  nothing about the remote, and the new unique index will fail against data-bearing rows.
