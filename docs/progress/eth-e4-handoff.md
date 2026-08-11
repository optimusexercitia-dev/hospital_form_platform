# ETH·E4 — session handoff (2026-08-11)

> ⬛ **SUPERSEDED 2026-08-11 — the phase is COMPLETE.** This was a mid-phase resume document;
> its "PAUSED / resume from here" framing is **historical, not live**. The durable record is
> **[eth-e4-participant-seating.md](./eth-e4-participant-seating.md)**; the backend surface is
> [backend-state.md § ETH·E4](../backend-state.md).
>
> Every open item below was discharged: **§3's 7 unproven specs all ran GREEN** (140 passed ·
> 0 failed · 0 did-not-run), **§7's checklist is done**, and **QA r3 APPROVED**. Kept unedited
> because §6's traps are the useful part and rewriting them would lose the record of what it
> cost to learn them. ⚠ **§7 item 6 is still LIVE**: the remote duplicate check on
> `professional_participants.professional_profile_id` before any `db push`.

**Branch:** `worktree-ethics-committee-completion` (worktree `.claude/worktrees/ethics-committee-completion`), ~30 commits ahead of `main` @ `9fbc69d`. **Nothing merged, nothing pushed.**

**Phase Gate state:** step 1 ✅ · step 2 ⚠ **RED (UNRUN only, zero assertion failures)** · step 3 QA **r2 CHANGES REQUESTED → all 3 blockers fixed, r3 not yet run** · step 4 not reached.

**The single most important line in this document:** the last gate run is red **only** because 69 tests in one batch never produced a verdict after two server deaths. **No assertion failed anywhere, in any run, at any point.** But see §3 — the unproven set overlaps the riskiest uncovered change, so this is *not* safe to wave through.

---

## 1. What was built

Closes **FUP-ETH-1** (and **FUP-FF5-2**). Binding model: ADR
[0108](../decisions/0108-eth-e4-participant-seating.md) · plan
[ethics-e4-participant-seating.md](../phases/ethics-e4-participant-seating.md) · locator contract
[ethics-e4-locator-contract.md](../phases/ethics-e4-locator-contract.md) (lead-owned; the three
teammates built against it **in parallel**, which is why E2E debugging arrived as a tail).

**6 migrations** (`20260919000100`–`…000600`): `public.ensure_professional_participant`
(get-or-create + unique index + targeted `on conflict`) · `public.create_external_participant`
(create-always) · `create or replace` of the shipped, thrice-keystoned `public.set_primary_subject`
(move semantics + linkage re-run) · the D5 disjunct on `app.can_read_professional_profile` ·
`case_type_terminology` audit trigger · **the P0 column-list grant + DEFINER projection**.

**App:** `src/lib/queries/participants.ts`, all 7 previously-stubbed actions in
`src/lib/participants/actions.ts` + `createExternalParticipant`, `src/lib/vocabulary/actions.ts`,
`src/lib/queries/members.ts` `listLinkableOrgUsers`, the roster + dialogs in
`src/components/cases/`, T5 vocabulary admin in `src/components/org/`.

**Tests:** pgTAP `321` · `e2e/ethics-e4-participants.spec.ts` (12) · rewrite of
`e2e/ethics-e3a-surfacing.spec.ts`'s three raw `dbInsert` sites (**the acceptance criterion for
FUP-ETH-1**) · new `lint:client-server-imports` gate.

## 2. Verified, and how

| Claim | Evidence |
| --- | --- |
| pgTAP | **5794/5794 ×2**, 182 files, on a fresh reset. QA re-verified independently. |
| Both `create or replace`d doors unchanged in properties | `prosecdef`/`proconfig`/`proacl` (incl. entry order)/volatility/owner diffed **from the catalog**, before vs after |
| D5 keystone is falsifiable | QA reverted the arm itself → K3a RED |
| The 3 write doors are covered | **Neutralization oracle, hand-run** — open each gate → 321 FAILs → restore → PASSes. ⛔ **NOT `ARM=census`** (see §6) |
| Write doors are covered *standing* | now in `p0-authz-writepath-audit.sh` ARM 1 — COVERED, 0 BLIND, 0 ERROR |
| `ARM=hat` / `ARM=floor` / diff-scoped door sweep | HOLD · 0 BLIND · 0 ERROR (QA re-ran) |
| P0 fix needs **both** halves | **Measured:** grant applied + DEFINER projection reverted ⇒ all 5 columns leak again |
| Full E2E at `7e55f01` | **GREEN — 1068 passed · 0 failed · 0 infra · 0 did-not-run**, batches 1–17 no gaps, all `accounted N/N` reconcile |
| Build | `npm run build` exit 0 · lint 0/0 · typecheck clean · vitest 1218/1218 |

## 3. ⚠ WHAT IS NOT VERIFIED — read before resuming

The **final** run (at `2efa691`, i.e. including the last three commits) was:

```
999 passed · 0 failed · 52 infra · 2 flaky · 17 did-not-run · 17 batches
accounted 1070/1076 (6 = legitimate skips)
GATE RED (UNRUN) — zero assertion failures observed
```

Integrity checks all clean: **0 `reset FAILED`**, batches **1–17 present with no gaps**, every
batch's own `accounted N/N` reconciles. Failure is isolated to **`b16(infra-unproven(52),
did-not-run(17))`** — batch 16 hit `server_dead=1` (104 conn errors), its automatic `INFRA_RETRY`
**also** died. Batches 5 and 17 died too but recovered on retry.

**The 7 unproven specs:** `platform-org-admin-provisioning` · `process-template-narrative-slot-crud`
· `process-template-versioning` · `processless-cases` · `qob-org-admin-content-wall` ·
`quality-oversight` · `recommend-result`.

> ### ⛔ The real risk, stated plainly
> `45e68c5` changed **5 PostgREST reads in `getCaseDetail` to THROW instead of silently degrading.**
> Four of the seven unproven specs exercise case-detail routes heavily — `process-template-versioning`
> (11 refs), `quality-oversight` (8), `recommend-result` (8), `processless-cases` (1).
> **The specs most likely to exercise the new throw behaviour are exactly the ones that never ran.**
> A red there would most likely be a **previously-hidden defect surfacing, not a regression** — those
> reads were failing invisibly before by construction — but it is unproven either way.
> **Re-run batch 16's 7 specs first, before anything else.**

Recipe (smaller batches; this worked when batch 5 died the same way earlier):

```bash
RESET=1 BATCH_TESTS=22 SPECS="e2e/platform-org-admin-provisioning.spec.ts e2e/process-template-narrative-slot-crud.spec.ts e2e/process-template-versioning.spec.ts e2e/processless-cases.spec.ts e2e/qob-org-admin-content-wall.spec.ts e2e/quality-oversight.spec.ts e2e/recommend-result.spec.ts" bash scripts/e2e-prod-gate.sh
```

**Not verified beyond that:** the remote duplicate check on
`professional_participants.professional_profile_id` that plan §6 step 3 requires **before any
`db push`** (local `count=1` proves nothing about the remote); and QA r3.

### The environment is degrading, and it is not the code
`server_dead=1` recurred in **3 of 17 batches** in the final run, versus 1 of 17 earlier the same
day. The Flexible-Forms group (batch 5) and now batch 16 kill the standalone server under load.
`BATCH_TESTS=22` has twice been sufficient to get a dead group green. **This is an infra
characteristic to fix or budget for, not an ETH·E4 defect** — worth its own follow-up.

## 4. QA state

`docs/reviews/eth-e4-review.md` — **r1** (1 P0 · 6 MAJOR · 11 MINOR) and **r2**
(CHANGES REQUESTED, narrow: B-1/B-2/B-3). r1 and r2 are both preserved; the loop is visible by design.

**All r1 and r2 findings are fixed.** r3 has **not** run. QA's own words: it expects r3 to be
"a read of three diffs, not a re-audit" — those diffs are `45e68c5` (B-3), `2efa691` (B-1 + B-2),
and this handoff's §3.

### The P0, because it must not be lost
ADR 0108 D5's exposure argument was **false as written**. It promised "no case linkage" — true of
`professional_participants`, and irrelevant. `app.trg_pin_respondent_retention` is the **sole**
writer of `retention_pinned_at`/`retention_pin_reason`, fires only on `case_decisions → 'issued'`
for a seated `respondent_doctor`, and those columns sat in a **table-wide** `authenticated` grant.
QA measured a sibling-commission `staff_admin` with no case access reading `full_name` **and**
`cpf` **and** `retention_pin_reason` — a disclosed ethics proceeding. **ETH·E4 opened the write and
widened the read together.**

Closed by `0882296`: column-list grant (revoked `cpf`, `retention_pinned_at`,
`retention_pin_reason`, `user_id`, `redacted_by`) **plus** an explicit projection in the
`prosecdef` `get_case_professional` — *both halves are load-bearing; a grant alone leaks, and this
was measured, not argued.* `redacted_at` deliberately **kept** because `searchParticipants` filters
on it and PostgREST requires SELECT on a filtered column. A `set_eq` keystone pins projection ≡
grant so a future column added to one reds until added to the other. ADR 0108 D5 is amended with
the false clause struck through and the reason recorded.

## 5. Open decisions — PO only, none blocking

1. **Picker scope limit.** The *possui conta* roster rides `profiles_select_self_or_admin`'s
   co-membership arm, so for a plain `staff_admin` it is *their perimeter ∩ the org*, not the whole
   org. QA r1 said close pre-pilot; **QA r2 downgraded it to non-blocking** after a catalog check —
   case read resolves through commission membership, so a respondent on the coordinator's own
   commission is already in the picker, making the biting population near-disjoint from where the
   impedimento is load-bearing. Closing it fully needs a `profiles_select_self_or_admin` widening —
   a security decision, deliberately not taken by an agent.
2. **Class-2 audit posture (QA m2).** `searchParticipants`'s invoker-rights read cannot be audited
   through RLS, and D5 widened its population to every org manager. ADR 0064/0065 calls Class-2
   "case-scoped RLS + audited reads"; after D5 neither half fully holds. The P0 fix **shrank** this
   (the unaudited path now reaches only the 12 granted columns). Non-blocking; **wants one ADR line**
   so the next phase inherits a ratified position rather than an assumption.
3. **`department` / `institution` / `other`** are mintable but have **no seeded role**, so they are
   unseatable out of the box. T5's vocabulary admin lets an org admin add roles. Accept or seed.

## 6. Traps that cost real time — do not re-derive these

- ⛔ **Never cite `ARM=census` for this track's write doors.** ADR 0108 and plan §7 originally did;
  both are now **corrected in-file**. ADR 0079 **Amendment 5** + open **FUP-AFF-1**: the census
  domain is `prosecdef AND (returns bool OR returns setof)`; all three E4 doors return `uuid`/`void`,
  so it reports HOLDS **because they are invisible to it**. Coverage came from the neutralization
  oracle and now the standing write-path harness.
- **A DEFINER function bypasses column grants.** The P0's grant half alone would have shipped the
  leak wearing a green check. `prosecdef` belongs beside `pg_policies`.
- **The precedent is not the instance.** Cost three separate misses: the `Remover` alertdialog
  (present in a sibling component, absent here), `pickFromTypeahead`'s page-wide scope (Radix portals
  in `ff5-references`, but `TypeaheadField` renders inline), and `create_professional_profile`
  assumed get-or-create (it is a **bare insert** — `ensure_professional_participant` is the
  get-or-create one).
- **The union of scoped sweeps is not a sweep.** Three instances in one day: the tester enumerated
  vacuity by assertion *syntax* not the property; backend swept *the table whose grant changed* not
  *reads whose failure is indistinguishable from empty* (1 → 5 when re-scoped to the function
  exhaustively); and I scoped backend to `professional_profiles` in the first place.
- **"Void, not flaky."** pgTAP short counts (5583/5614 vs 5794) under a PASS-shaped summary were
  **E2E-mutated-DB**, not infra noise — `252_authz_p0_isolation` planned 48 / ran 0 is the sharp
  signal; the aggregate count is not. "Flaky" invites re-running until green; "void" says the run
  proved nothing. Always `supabase db reset --local` first.
- **A component's own handler can be correct and still lose.** `BUG-ETHE4-FOCUS-1` symptom 2: Radix
  `DismissableLayer` handles Escape on `document` in the **capture phase**, so a bubble-phase
  `stopPropagation()` is structurally too late. Read the library source, not just yours.
- **A green bar hides the wired seam.** Three defects passed lint + typecheck + vitest + pgTAP
  5794/5794 + every authz ARM: the a11y focus trap, the *possui conta* picker fed a roster that
  **excludes** commission members (plan §0 specified the wrong source — and the consequence was
  coordinators pushed to `no_account`, making the case exclusion vacuously satisfied), and a
  `server-only` module value-imported into a client component (aborts `next build` alone).
- **`npm run build` is now part of the engineers' green bar.** Lint and typecheck structurally
  cannot see the client/server boundary. `lint:client-server-imports` (`7dc2a72`, widened in
  `0882296` to key on the **module set**, 30 → 124, plus `export … from` edges) now gates it.
- **Don't pipe the gate through `tail`** — the pipeline returns `tail`'s status and masks `exit 2`.

## 7. Resume checklist

1. `supabase db reset --local` (mandatory — see "void, not flaky").
2. **Re-run batch 16's 7 specs** with the §3 recipe. Triage any red as *previously-hidden defect*
   before *regression* (§3).
3. If green → **QA r3** (resume the `qa` teammate; it expects a diff read).
4. If r3 APPROVED → Phase Gate **step 4**: present built / tests / QA verdict / open risks and
   **wait for explicit human approval**. Nothing merges or pushes before that.
5. Record step (lead): PROGRESS.md, **rotate FUP-ETH-1 out of both live files moving the marker in
   the same edit**, `docs/backend-state.md` for the 6 new/changed doors, `graphify update` **only
   after merge to `main`**, in its own `chore(graphify):` commit.
6. Before **any** `db push`: the remote duplicate check on
   `professional_participants.professional_profile_id` (plan §6 step 3).

**Open follow-ups:** `FUP-ETH-CPF-1` (closed in-phase by the P0; keep live until r3 confirms) ·
`FUP-SILENT-READ-1` (~207/773 unchecked PostgREST reads — ⛔ **not** a bug count; needs per-site
triage) · the E2E `server_dead` infra characteristic (§3, unfiled).
