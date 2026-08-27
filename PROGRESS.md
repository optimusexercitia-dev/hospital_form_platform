# PROGRESS.md — Live Project State

> **LIVE STATE ONLY** — current phase and next actions, non-complete phase rows, OPEN
> bugs, the measured State block, Critical FUP, and the OPEN follow-up index. An entry
> leaves the moment its work merges and is recorded. Update state here first.
>
> **The contract lives elsewhere, deliberately** — judgment in
> [progress-contract.md](.claude/rules/progress-contract.md), mechanics in
> `npm run lint:progress` (gate 7), and **that script is the authority**. Restating a
> check here creates the second copy that drifts, which is what this file is recovering
> from: one claim about it was replicated into four documents and true in none.

## Now — current phase & next actions

_Lead-owned. This section replaces the old "Current Phase Tasks" + "🛑 START HERE"
banners; the full DM-FUP triage narrative those banners carried is preserved verbatim
in [dm-fup-triage-2026-08-18.md](docs/progress/dm-fup-triage-2026-08-18.md)._

- **✅ Six concluded programs — fully rotated** → [2026-Q3.md](docs/progress/2026-Q3.md) +
  [phase-ledger.md](docs/progress/phase-ledger.md). ⛔ **Only the two LIVE residues stay here:**
  **(1)** ⭕ **ROTATED 2026-08-27 → `.claude/rules/authz-gate-results-need-a-current-baseline.md`**
  (path-scoped, gate-verified; it also now carries AE0's trusted baseline).
  **(2)** ⭕ **CONVERTED 2026-08-27 to `FUP-QA-FINDINGS-N3-N4-UNACCOUNTED`** (indexed below) — it
  was an actionable item wearing a narrative, which the contract's three-way test says is a body
  plus one index line. ⛔ N-3 and N-4 still have **ZERO hits**; the recovery is owed, not done.
- **🟠 nvm still defaults to Node 20, and `npm run lint` DIES AT GATE 8 there** (`globSync` needs 22).
  `.nvmrc` + `engines` are set; **`nvm alias default 22` is not**. ⛔ Kept live deliberately when the
  gate-tooling bullet was rotated 2026-08-25: it is the one item in that ✅-marked bullet with an
  unfired resolution event, it exists in **no other file**, and rotating the bullet whole would have
  buried an open action under a completed heading — owner: whoever next hits it.
- **⚠ AE1 IS BUILDING (AE0 closed 2026-08-26; see the ADR 0155 bullet) — and
  AFF4 IS MERGED, PUSHED, AND ITS SCHEMA IS APPLIED REMOTELY**
  (`main` @ `e8abaeec`; branch deleted; 12 migrations pushed 2026-08-26). ⛔ **Do not compress the
  clauses into one; the second is what this line has destroyed four times, and "complete" has meant
  four different things here — built / merged / pushed / schema-applied.** ⛔ **Re-measure, never
  read**: `git branch --merged main` and `supabase migration list --linked`. **AFF4** is the most
  recent complete program; before it, **ADR 0144 (PDF·P3)** and the **user-profile redesign +
  AFF3/AUD1/AUD2** batch (ADRs 0147–0150). 0136 and 0137 are both complete. ⛔ This line's own
  history — it read "NO PHASE IS ACTIVE" **three times while phases ran**, and the correction that
  replaced it is rotated **verbatim** → [now-concluded-2026-08.md](docs/progress/now-concluded-2026-08.md)
  and [2026-Q3.md](docs/progress/2026-Q3.md). ⛔ **Do not add a fifth warning here.** The durable
  fix is not another warning: **re-measure** — `git branch --merged main` and § Phase Status — rather
  than reading this line.
  ⛔ **One thing must not be read as closure, and it has no other live line:** the ethics lane is
  *non-erasable by decision with two known open removal paths* — a worse state than "no path exists".
- **✅ AFF4 COMPLETE — §6 gate GREEN, QA APPROVED, human-approved 2026-08-26; Critical FUP C5 is
  closed and has left § Critical FUP.** Row → [phase-ledger.md](docs/progress/phase-ledger.md) ·
  detail → [aff4.md](docs/progress/aff4.md) · authority is still the
  [plan](docs/plans/aff4-org-affiliation.md). Concluded narrative rotated →
  [2026-Q3.md](docs/progress/2026-Q3.md). ⛔ **THE THREE RESIDUES — only (2) is still live here:**
  **(1)** ✅ **DISCHARGED — merged, pushed, schema applied remotely 2026-08-26.** The standing rule
  it broke — **push SCHEMA before CODE** — is now path-scoped so it fires while you write the
  migration: `.claude/rules/push-schema-before-code.md`. Record → [2026-Q3.md](docs/progress/2026-Q3.md);
  **(2)** ⚠ **~16 QA-review obligations + ~20 plan-discovered follow-ups were NOT converted into
  `FUP-*` index lines at the Record step** — several say in their own words that they need one, so
  they are invisible to the register the PO reads from until they are filed (pointer list:
  [aff4.md](docs/progress/aff4.md) § "Residue this Record step did NOT file");
  **(3)** ⛔ **TWELVE instruments in this build reported success while measuring nothing**, two of them
  **constants** — never believe a counting instrument’s zero until it has been run once against a
  known failure. Record → [2026-Q3.md](docs/progress/2026-Q3.md).
- **📐 ADR 0155 ACCEPTED (as amended) 2026-08-26 — the post-AFF4 authorization-evolution program is
  the plan of record; ▶ **AE0 ✅ COMPLETE + human-approved 2026-08-26** (row → ledger, detail →
  [authz-ae0.md](docs/progress/authz-ae0.md)); **AE1 IS BUILDING** on `authz-ae1-hardening`.**
  Role/permission catalog adopted via
  role-by-role **direct substitution** (`staff_admin` first — reverses the draft's own rejection);
  **pilot gate = implementation Phases 0–4**, Phase 5 (remaining roles) post-pilot; D4 →
  `profile_private_details`, single-shot pre-live; D5 demoted; D6 stays deferred with broadened
  triggers; 0151 D10's Phase 2 promoted to pre-pilot and **finally registered**
  (`FUP-AFF4-HOMEORG-PHASE2`). Eleven PO decisions recorded as G1–G11 in the ADR — the approval's
  scope is written there, not remembered. Authority: ADR
  [0155](docs/decisions/0155-post-aff4-tenancy-and-person-model-evolution-sequence.md) (decisions) +
  the [plan](docs/plans/authz-evolution.md) (execution — phases **AE0–AE7**, gates, PO decision
  points) + the [audit](docs/design/authorization-model-evolution-audit-2026-08-26.md) (analysis).
  ⚠ **C1a keeps its queue position (G10)** — Phases 0–1 may run in parallel with the ▶ queue below
  but do not preempt it; re-checked 2026-08-26, C1a still heads the queue and AE0 did not displace it.
  ▶ **AE1 STATUS 2026-08-27 (16 unpushed on `authz-ae1-hardening`; NOT merged, NOT pushed):**
  **AE1.1/.2/.3/.4/.5/.6 all built**; close conditions **#1 #2 #4 #5 #6 done**, **#3 HALF** (budget
  ceiling 752 + merge rule written; its **tiered threat review is SIZED, NOT DONE** — 432 Tier 1
  functions × 10 columns + 384 command doors, and it is **not** the small item the list implies).
  Gates on that tree, all measured, exit codes read directly: `test:db` **237/7,870 PASS** · `lint`
  **10/10** · `typecheck` **0** · vitest **144/1,964** · all four ARM arms **0** · the 63-case
  diff-scoped sweep re-run and merged (**BLIND 74⇒69, COVERED 296⇒316**; 54 of 63 measured, the 9
  named in the live record) · **`e2e:prod` GATE GREEN** (1249 passed, 0 failed, 3 flaky, 11 skipped;
  accounted 1263/1263 on the final batch lines). ⛔ **Still owed before Record:** #3's review · RV0
  partition · `FUP-MINUTES-WEBHOOK-HMAC-DENY-TEST` · AE1.5's AFTER capture · **QA review** · the
  Record step itself (⚠ rotate this file — it is over the 82 KB target).
  ⛔ **AE1's live record — task state, operational facts, fixture traps, and the FUP obligations it
  owes — is [authz-ae1.md](docs/progress/authz-ae1.md); read it before touching this phase.** Two
  AE0 results still bind: this DB has **NO planner statistics** (⛔ never `ANALYZE` before comparing
  against the AE0 baselines; a **cost-only** diff is autovacuum, not a finding), and the service-role
  surface is **45 sites, not 12**. ADR
  [0160](docs/decisions/0160-ae0-corrections-to-adr-0155-measured-figures.md) corrects two refuted
  0155 figures.
- **▶ Next, in order** (PO-sequenced 2026-08-18; **the 0125/0126 build that jumped this queue
  has SHIPPED**, so these resume their order):
  1. **C1a** — local end-to-end run of
     [`phi-disposal-runbook.md`](docs/deployment/phi-disposal-runbook.md).
     ⛔ **STILL UN-RUN, and nothing about it changed on 2026-08-19.**
     ⭐ Its 2026-08-19 correction — a real defect had been cited as blocking C1a and did **not** bound it — rotated 2026-08-22 → [now-concluded-2026-08.md](docs/progress/now-concluded-2026-08.md). ⚠ The error ran in the **reassuring** direction: it made C1a read as blocked-then-released rather than simply never started.
     ⚠ Whoever runs C1a: the fixture caveat belongs to **meeting** disposal, which this runbook does
     not cover at all — see 🟠 `FUP-DISPOSAL-RUNBOOK-COVERS-ONLY-BYTES`.
  2. **C2 Tier 1 sizing** (absorbs `Q1-OPEN-BYTES-CUT` + `SIBLING-GUARD-DIFF`).
  3. **`FUP-DM4-PRODROW`** — now actionable: re-derive a magnitude, or rule that it
     cannot be (TRIAGE #9 already forbids closing it as "reconciled").
- **⚠ Two facts a session must not trip over** (full context in the
  [triage narrative](docs/progress/dm-fup-triage-2026-08-18.md)):
  1. The remote DB holds **NO REAL CUSTOMER DATA** — but ⛔ it is **NOT empty**: it carries the E2E
     SEED FIXTURE (measured 2026-08-21: `auth.users` = 36, all `@test.local`, plus synthetic PHI).
     This line said *"is EMPTY"* until 2026-08-23 and was contradicted by § State's own correction
     the whole time — the **conclusion** (safe to touch) survives, the **premise** did not, and the
     premise is what other decisions rested on. ⛔ **Re-measure, never quote** (stale 5×). It
     **expires when the pilot loads data**.
  2. **C1 split into C1a (local) + C1b (Cloud); the pilot bound is C1b** — a green
     local rehearsal does NOT release the pilot (§ Critical FUP C1).
- **Worktrees — ⛔ NEVER read a count from this file.** It has been wrong **three times running**
  (NONE while three existed → TWO while one did), and no warning ever fixed that; the count is
  gone rather than re-stated. `git worktree list --porcelain` is the only source.
  ⚠ In a worktree, check `.env.local` **and** a **non-empty** `node_modules` before any gate
  ([worktrees.md](docs/worktrees.md)) — the second fails silently by borrowing the parent's.
## Phase Status — live rows only

> **Completed rows live in [phase-ledger.md](docs/progress/phase-ledger.md)** —
> append-only, every phase forever, moved there 2026-08-18. Only rows **not yet
> `✅ complete`** stay here; at the §6 Record step the completing phase's row moves
> to the ledger **verbatim** (the gate fails on a `✅ complete` row here). Verbose
> cell prose for old rows: [phase-status-archive.md](docs/progress/phase-status-archive.md).

| Phase | Name                          | Status | Build | Tests | QA | Human ✓ | Completed | Commit |
| ----- | ----------------------------- | ------ | ----- | ----- | -- | ------- | --------- | ------ |
| 9 | Deployment | 🔜 not started | – | – | – | – | – | – |
| 18 | Self-Assessment & Internal Audit | 🔜 not started | – | – | – | – | – | – |
| 19 | Surveyor Access & Evidence Export | 🔜 not started | – | – | – | – | – | – |
| DLB | **Deliberation & Voting Model** [0115](docs/decisions/0115-deliberation-and-voting-model.md) ([plan](docs/plans/deliberations.md)) | ADR PROPOSED — NOT ratified; nothing built and nothing may start | – | – | – | ⛔ **not ratified** | – | taken |
| AE1 | **Authz evolution — integrity & privilege hardening** ([plan](docs/plans/authz-evolution.md) · ADR [0155](docs/decisions/0155-post-aff4-tenancy-and-person-model-evolution-sequence.md) D9) | 🔵 building 2026-08-26 — first AE phase that writes migrations; branch `authz-ae1-hardening` | AE1.6 ✅ (382) · AE1.1 ✅ **BUILT** (both FKs CASCADE + 383) · AE1.2 classified 752 fns, **233 revokes HELD** (RV0: a revoke may not create sweep blindness) · AE1.3 **approved R0–R6**. ⛔ In flight: AE1.3, AE1.4 (**45 sites, not 12**), AE1.5 | – | – | – | – | – |

## Bug Log

### 🔴 OPEN — the live bugs

⛔ **OPEN bugs only — closed rows rotate to the archive (or the owning phase's record) at each §6
Record step, and you derive that boundary by the PROPERTY (is this CLOSED?), never by markup.** Open bugs here
carry bold markers, not headings, so a sweep bounded by heading syntax archives them; this heading
exists because without it an open production blocker (BUG-BOOTSTRAP-001) read as filed under
*Closed*. Its provenance, and the three closed rows that were still listed here after the
2026-08-18 rotation put them in the archive, rotated 2026-08-19 →
[archive § "Rotated 2026-08-19"](docs/progress/bug-log-archive.md).

⛔ **No live bug count appears in this section, deliberately.** Two attempts already went stale inside
a single day — first the heading, then a note saying "back to three" — in the one paragraph of this
file whose whole subject is that a count is wrong the moment after it is right. Count the rows below.

🔴 **BUG-SUSPENSION-DATE-RENDERS-A-DAY-EARLY — the banner tells a suspended user their suspension
already ended; every product-written value, the whole target market.** Filed 2026-08-26 (lead);
**pre-existing, not AFF4-introduced, deliberately not fixed there.** `profiles.suspended_until` is
**`timestamptz`** (catalog-measured); the write path stores the dialog's bare `YYYY-MM-DD` unnormalised
→ **midnight UTC**, and `formatSuspensionDate` (`account-situation-banner.tsx:84-88`) formats with
`Intl.DateTimeFormat("pt-BR")` and **no `timeZone`** → in `America/Sao_Paulo` `2026-09-25 00:00:00+00`
renders **24/09**.
⭐ **PO RULING 2026-08-26 — "suspended until D" = until `23:59:59` of D in `America/Sao_Paulo`.**
Both fixes are now mechanical: explicit `timeZone` on the formatter, **and** normalise the write to
end-of-day in that zone. ⚠ Stated, not hidden: this pins one zone app-wide and Brazil spans four —
a hospital outside UTC−3 makes it a per-tenant setting.
⛔ **THE SEED DOES NOT REPRODUCE IT — carry this or triage kills the bug.** `seed.sql` writes a real
timestamp (`…10:08:42+00`), not a date string, so the seeded row renders **correctly**: the fixture
reaches a *passing* state the product never produces.
⚠ **POSSIBLY TWO SITES:** `backend` measured *no normalisation* at the write (`users/actions.ts:1176`);
`tester` read a `${date}T00:00:00.000Z` construction — both can be true of **different lines**, the
construction being upstream in the dialog. Patching one alone still renders the wrong day.

🔴 **BUG-CASEEVT-KIND-001 — a case writer can DELETE, or silently RE-KIND, a procedural `case_events`
row: the UPDATE/DELETE policies carry no `kind` gate.** Filed 2026-08-23 (lead). Surfaced by ADR 0137
D12's `CaseEvent.kind` widening, **not caused by it. Measured from the live catalog:**
`case_events_writer_update` / `…_staff_admin_update` hold `app.is_manual_case_event_kind(kind)` in
**`WITH CHECK` only** — that constrains the **new** kind, never **which rows may be touched**; their
`USING` is `app.can_write_case_content(case_id, auth.uid())` alone. `case_events_writer_delete` /
`…_staff_admin_delete` have **no kind gate at all**. So `decision_issued → note` satisfies both clauses
and the row is silently re-kinded, and any procedural row can simply be deleted. ⛔ **No second lock — and this line's EVIDENCE was corrected 2026-08-25 (QA N-5): it said "zero
non-internal triggers on `case_events`", which was true when filed and is now FALSE.** P3/D15 added
`bump_case_print_revision` (AFTER ROW I/D/U) — tamper-**evidence**, not a lock, and it writes no
audit row. **No** routine references both `case_events` and `audit_log`, and writes go
**direct-table** over PostgREST — so the deletion is still **unaudited** (a Rule 11 gap). ⭐ P3 also
**raised the stakes**: it seals these rows into a hash-verified artifact with a public verification
URL, so a silent re-kind before a mint yields an *authentically signed* dossier that misrepresents a
procedural decision. ⚠ **The only control today is the UI suppression D12 added, which Rule 1
forbids counting as one.** ⛔ **Deliberately NOT fixed in this batch:** changing two RLS policies is a
live authz change owing its own keystone + diff-scoped door sweep. **Bounded:** requires
`can_write_case_content` on that case — in-case records integrity, **not** a tenant-isolation break.
⭐ The review lesson: three real filters were cited as refusing this write; all three gate the **new**
kind, so **none** of them bounds the claim they were cited for.
⭕ **SECOND AXIS, added 2026-08-24 (QA r2, re-measured from `pg_policies` by the lead): the writer
policies carry no VISIBILITY conjunct either — write is reachable where READ is not.**
`case_events_select` is `can_read_case(…) AND (visibility = 'case_readers' OR is_staff_admin_of(…))`,
but `case_events_writer_delete` / `…_writer_update` are `can_write_case_content(case_id, auth.uid())`
**alone**. So a plain writer who is not a `staff_admin` can **DELETE or EDIT a `coordinator_only` row
they cannot SELECT** — unauditedly, per the no-second-lock finding above. ⚠ The `…_staff_admin_*`
variants at least carry `NOT app.is_case_excluded(…)`; the writer pair carries nothing.
⛔ This is a **distinct property from the `kind` gate** — fixing `kind` alone leaves it standing, so
the eventual fix owes **two** keystones, not one.

🔴 **BUG-BOOTSTRAP-001 — there is no in-app path to create the FIRST `platform_admin`; production
onboarding has an undocumented manual SQL step.** Filed 2026-08-06 (lead) when the AFF completion
narrative was rotated — **this was the one open item in it that existed in no other tracked place**,
which is why it is here rather than in Follow-ups. Surfaced during AFF, **not caused by it**.
**Mechanism:** `is_admin` is set only by direct SQL, and the promote guard requires an **existing**
admin to promote another — so the set is closed under the product. On a fresh production database it
starts empty and nothing in the app can open it. **Impact:** the first production `platform_admin` is
a manual `update profiles set is_admin = true …` that **appears in no runbook** — not in
`docs/deployment/`, and not in any pre-pilot checklist. Whoever runs the pilot deploy hits this
with no written instruction.
⚠ **Not a security defect — the closure is deliberate** (it is what stops self-promotion, and the
guard is correct). The defect is that the bootstrap is undocumented and unautomated, so do **not**
"fix" it by weakening the guard.
**Status:** OPEN, unassigned. Two candidate dispositions, PO's call: (a) document it as an explicit
step in the pilot-deploy runbook — cheapest, and sufficient for one pilot tenant; (b) a
seed/CLI-driven bootstrap that mints the first admin idempotently. **Blocks nothing today** (local +
E2E get `platform@test.local` from `seed.sql`, which is exactly why the gap is invisible to every
gate), but it is on the critical path of the **first production deploy**.

🔴 **BUG-MEUSDADOS-HOSPITAL-NAME-001 — a non-admin's own `/conta/meus-dados` cannot name the
hospital in "Vínculos hospitalares"; every row reads "Hospital não identificado".** Filed
2026-08-26 (`tester`, AFF4 T4). Repro: sign in as a plain-`staff` persona with a hospital
affiliation (e.g. `dr.john@test.local`) and open `/conta/meus-dados`. Expected: the hospital
name renders (F5's own acceptance, "own affiliations with work data"; plan AC4). Actual:
matrícula/dates/status all render; only the name is missing. **Cause, measured against the live
catalog:** `listAffiliationsFor` (`src/lib/queries/affiliations.ts:64,72`, feeds
`getOwnPersonRecord`) embeds `hospital:hospitals!...(name)`, RLS-gated by `hospitals_select` —
which admits only admin/reviewer tiers (`pg_policies`, live), no clause for a plain affiliate
reading their OWN hospital. The embed silently nulls for any such caller — F5's primary
audience; an admin viewing SOMEONE ELSE's profile is unaffected. Not a leak — over-restrictive,
not under. **Severity:** Major. **Owner:** backend — add a self-affiliation `EXISTS` arm to
`hospitals_select`, or resolve the name inside the self-only door rather than an RLS-gated
embed. Regression guard: `e2e/aff4-meus-dados.spec.ts`, deliberately left red, not weakened.

### Closed → [bug-log-archive.md](docs/progress/bug-log-archive.md)

Closed rows, their closure narratives, and the 2026-08-19 record of where this section's old
standing warnings were re-homed (rule files, retirements, and the one not admitted for want of a
verifiable anchor) all live in the archive → § "Rotated 2026-08-25".

## Test Run Summary

> **Retention: the most recent gate only, ONE ROW each.** Prior gate rows and their triage
> narratives (dispositions, mutation proofs; full history Phases 0 → ACT) rotate at each §6 Record
> → [test-run-archive.md](docs/progress/test-run-archive.md) (each rotation recorded there).

| Date | Run | Result |
| --- | --- | --- |
| 2026-08-26 | **AFF4 `e2e:prod`** — `1250p · 0f · 0 infra · 2 flaky · 0 DNR · 21 batches`; 1252/1263, 11 skip. ⚠ Flaky NAMED + both pre-existing: `act-role-assumption:157` · `phase2-auth-shell:268` ⇒ **0 new**. ⛔ `0 infra` is POST-RERUN: batch 9 died, 21 unrun, rerun 67/67. [aff4.md](docs/progress/aff4.md) | ✅ **GREEN, exit 0** |

## QA Verdicts

<!-- ONE LINE per phase/feature: verdict + date + link. The full analysis lives in
     docs/reviews/*.md — never restate rationale here or in the archive.
     Struck-through rows are superseded rounds, kept only to show a phase looped.
     Retention: current milestone only. Older concluded rows move VERBATIM to
     qa-verdicts-archive.md's "Collapsed one-line index" (the index is not rationale —
     it preserves the feature-name → review-file mapping). -->

| Phase / Feature | Verdict | Date | Report |
| --- | --- | --- | --- |
| AFF4 — org affiliation, staff data, voided tense | APPROVED | 2026-08-26 | [review](docs/reviews/aff4-review.md) |
| _Six prior rotations_ (the 2026-08-25 pair: PDF·P3 + user-profile · ADR 0136 · ADR 0137 · the AFF2 pair · the seven DM rows · the 2026-08-14 verbose collapse) — each rotation's own date is recorded at the destination | — | — | [archive](docs/progress/qa-verdicts-archive.md) |
| 118 concluded rows | — | — | [collapsed index](docs/progress/qa-verdicts-archive.md) |

## Decisions

<!-- One line per decision; full rationale in docs/decisions/ (ADR) + docs/progress/decisions-log.md -->

| Date | Decision | Ref |
| --- | --- | --- |
| 2026-08-27 | **The 11 `.rpc()` UNDECIDED sites RULED** (approved as-is + 4 observations): 1 in-function door, 10 system-actor; R1 ACL pins = pgTAP 388, R2 HMAC deny test = FUP, R3 re-measure **discharged** (local+remote body-md5 parity, 0 refs in unregistered migrations); minutes latch made atomic (`…005000`) | [rulings](docs/design/authz-ae1-rpc-rulings.md) |
| 2026-08-27 | **Plan-audit rulings, authz evolution** — F1–F18 dispositioned (`[PA-F#]` plan tags): rollback = runbook, never a migration; catalog **authority-elect** + FK binding; **C2 subset joins the pilot gate**; `home_organization_id` **drops** in AE2; tiered DEFINER review; AE1 close amended | ADR [0162](docs/decisions/0162-authz-evolution-plan-audit-corrections.md) — **amends 0155** |
| 2026-08-27 | **PROGRESS.md size is now TWO thresholds** (PO): 80 KB **target** — non-fatal warning, printed every run, rotate here — and a 100 KB **hard cap**. 2nd raise; Amdt 2 refused to be a precedent, so the pressure MOVED to the target rather than being deleted. Handoff cap 12→24 KB in the same instruction | ADR [0124](docs/decisions/0124-progress-live-state-contract.md) **Amdt 3** |
| 2026-08-26 | **ADR 0155 ACCEPTED as amended — authz evolution is a staged program**: role/permission catalog by role-by-role direct substitution (`staff_admin` first); D4 = `profile_private_details` single-shot pre-live; D5 demoted; D6 stays deferred; pilot gate = Phases 0–4; PO decisions G1–G11 in the ADR | ADR [0155](docs/decisions/0155-post-aff4-tenancy-and-person-model-evolution-sequence.md) — **amends 0151 D10** |
| 2026-08-26 | **An invariant backstop runs as DEFINER** — the discriminator is *does it read caller identity?*, not *is it a trigger?* Closes `BUG-D5-REHIRE-HOSPADMIN-001` | ADR [0159](docs/decisions/0159-invariant-backstops-run-as-definer.md) — **amends 0151 D4** |
| 2026-08-26 | **The hospital directory keeps its predicate** — `listHospitalUsers` does NOT move; filtering it would blank the page for the only role it serves. Toggle absent there; T2 org-scoped | ADR [0158](docs/decisions/0158-hospital-directory-keeps-its-predicate.md) — **amends 0154 D1** |
| 2026-08-26 | **The dominance grid's population was bounded by SCHEMA, not the property** — 19 doors, incl. `grant_role`/`revoke_role`, adjudicated by nothing for three weeks. Blind, not vulnerable | ADR [0157](docs/decisions/0157-dominance-grid-population-bounded-by-schema.md) — **amends 0079** |
| 2026-08-26 | **The door-SQLSTATE gate's domain is a structural property, not a list of names** — a name-derived domain would have missed `public.appoint_technical_director` | ADR [0156](docs/decisions/0156-door-sqlstate-gate-domain-is-structural.md) — **amends 0098 W3.5** |
| 2026-08-26 | **The org roster predicate is the application query filter (`listOrgUsers`/`listHospitalUsers`), NOT `list_org_people`** — which has one caller, the add-a-person CPF search. Both surfaces move to the org-affiliation predicate; the RLS legs stay on `home_organization_id` (0151 D10's Phase 2) | ADR [0154](docs/decisions/0154-roster-predicate-is-the-query-filter-not-list-org-people.md) — **amends 0151 D10** |
| 2026-08-26 | **PostgREST maps SQLSTATE class `P0*` → HTTP 500** (`P0001` excepted), refuting AFF4 pre-step P1’s premise. P1 re-scoped *fix* → *diagnose + re-file*; the live defect is a **73-function `public` P-class class**, NOT built here | ADR [0152](docs/decisions/0152-postgrest-p-class-sqlstate-maps-to-500.md) — **amends 0151 D16a** |
| 2026-08-26 | **A subset door-sweep writes to SCRATCH; the committed `authz-door-audit-findings.md` is never opened for write** — retires ADR 0079 Amdt 1’s `git checkout --` restore. Fixed in **four** sweeps, not one | ADR [0153](docs/decisions/0153-subset-sweeps-write-to-scratch-not-the-committed-baseline.md) — **amends 0079 Amdt 1** |
| 2026-08-25 | **AFF4 ruled** — `organization_affiliations`: org belonging becomes a row with a lifecycle; staff data ON `hospital_affiliations`, no parallel table; the **voided tense** closes C5 on both tables; "active" defined once (D6); `home_organization_id` demoted, Phase 2 named | ADR [0151](docs/decisions/0151-aff4-organization-affiliation-staff-data-voided-tense.md) |

> ↩ **This table is the HEAD of the log, not the log.** Eight rotations (2026-08-04 · 08-17 · 08-18 · 08-20 ×2 · 08-24 · 08-25 ×2) moved **125 concluded/superseded rows** verbatim → **[decisions-log.md](docs/progress/decisions-log.md)**, each under its own dated § heading there. The 7 per-rotation notes that stood here — **including the two corrections they carried** — were themselves rotated 2026-08-26 → § "Rotated from PROGRESS.md § Decisions 2026-08-26".

## State — the three live remote facts (measure, never quote)

_Concluded measurements → [backend-state.md](docs/backend-state.md) § REMOTE CENSUS
2026-08-18 (every figure with its deriving query); standing rules — the re-measure
recipes, the editable window, "a git push is not a `db push`", the flags posture —
→ backend-state.md § "Remote discipline — standing rules". The block's full narrative
and its three-times-stale correction history →
[dm-fup-triage-2026-08-18.md](docs/progress/dm-fup-triage-2026-08-18.md). Only facts
still awaiting a concluding event stay here:_

| live fact | concludes when |
| --- | --- |
| ⚠ **Remote storage byte-loss is UNQUANTIFIED — the "~49 vanished" figure is WITHDRAWN 2026-08-18.** `n_tup_ins − n_tup_del` compares two units: 5 uploads move `ins` by **+6**, 5 deletes move `del` by **+5** (measured). And by the probe below, any surviving bytes are **unobservable** anyway | a magnitude re-derived from something other than the `pg_stat` counters — or PO ruling that it cannot be ([FUP-DM4-PRODROW](docs/progress/follow-ups.md)) |
| ⛔ **CORRECTED 2026-08-21 — the remote holds the E2E SEED FIXTURE, not nothing.** This row said *"it holds no data and no users"* (census 2026-08-18). **Measured 2026-08-21 against the linked project: `auth.users` = 36, all `@test.local`, created 2026-08-19 — i.e. AFTER that census; 0 non-test accounts; 1 pre-promoted `platform_admin`; `cases` 10, `responses` 17; synthetic PHI `patient_identifiers` 2 / `event_patient` 3 / `referral_patient` 3.** ⭐ **No real customer data** — so the *conclusion* (safe to touch) survives; the *premise* did not, and the premise is what other decisions were resting on. ⚠ This is the **fifth** time a claim about the remote has gone stale in this file. ⛔ **Re-measure `auth.users` and `schema_migrations` before citing this row — never quote it.** | **expires at pilot data-load**, when it must be REPLACED by the rehearsed C1b disposal bound (§ Critical FUP C1), never just deleted |
| ✅ **REMOTE IS CURRENT — the PDF·P3 + user-profile merge PUSHED 2026-08-25** (`db:push` FIRST per coolify.md's order, then `git push`; `main` == `origin/main` == `7c09e8ce`). ⭐ **Measured in the REMOTE CATALOG, never from `db push`'s report** (2026-08-25): `schema_migrations` = **463**, head **`20261003003100`**; registry closure holds — **463** registered == **463** files. The ten versions above `20261003002100` are P3's `…002200`–`…002800` then the user-profile batch's `…002900`–`…003100`. ⚠ **Data, same measurement:** `auth.users` = **36**, **0** non-`@test.local` — still the E2E seed fixture, no real customer data. `app.feature_flags` enabled = **42**. ✅ Production runs the **node 24** toolchain (PO-confirmed 2026-08-25) — ⛔ testimony, not a measurement; no gate can read Coolify. ⛔ **Coolify auto-deploys on the `git push` and its outcome is NOT measured here** — check Coolify, never this row. ⛔ Superseded by the next remote-affecting change — **re-measure, do not quote.** The superseded 2026-08-24 row was rotated verbatim → [2026-Q3.md](docs/progress/2026-Q3.md) § "Rotated from PROGRESS.md § State 2026-08-25". |


## ⭐⭐ Critical FUP — the must-not-be-forgotten list

_**PO-curated. Entries land here ONLY on the PO's explicit instruction.** No implementer, reviewer or
lead may promote an item into this section, and nothing arrives here as a side effect of a review
round. It is the short list of follow-ups whose loss would be materially costly, kept **separate from
the general register precisely so that register's length cannot bury them**._

⛔ **NEVER ROTATE THIS SECTION — at any file size.** The general § Follow-ups index is
rotation-eligible under the §7 size discipline; this one is not. ⚠ An entry leaves only when the work
has **landed**, which is not the same as the phase it was filed in closing — *a deliverable assigned
to a slice disappears when that slice closes cleanly* (ADR 0120's own O1/O2 correction, and the reason
this section exists). Full bodies stay in
[follow-ups.md](docs/progress/follow-ups.md); these lines are the standing index.

| # | item | what must happen | trigger — the point it can no longer wait | owner |
|---|---|---|---|---|
| **C1** | 🔒 **`FUP-DM5-DISPOSAL-JOB`** — the PHI-disposal path is **manual and UNREHEARSED**. `disposal_state` records an **intent, not a destruction guarantee**: **4 SET-form writers** put rows into `disposal_pending` — 3 `authenticated`-reachable (`request_document_disposition`, `dispose_case_phi`, `dispose_referral_phi`) **plus `complete_document_reclassification`, service-role-only** — against **exactly ONE** outflow door, and **nothing automated calls it** (no `pg_cron`, no cron schema, single-process Dockerfile). ⚠ *Corrected 2026-08-18: this said "three inflow doors", which is right only bounded to JWT-reachable doors — **the queue is fed wider than the item said**.* | ⭕ **SPLIT IN TWO 2026-08-18 (DM-FUP TRIAGE #3) — and C1 does NOT close on C1a.** **C1a (local)** — execute [`phi-disposal-runbook.md`](docs/deployment/phi-disposal-runbook.md) end-to-end against local test data, once, and record the run. ⭕ **PARTIAL 2026-08-19: the § 6b BACKUP half is DONE** — executed, verified, destroyed, recorded in [`phi-backup-run-log.md`](docs/deployment/phi-backup-run-log.md), which discharged `FUP-DM5-BACKUP-IS-PHI-EXPORT`'s destination path. ⛔ **The § 3 DISPOSAL half — which is what C1a is FOR — has still not run.** ⭐ **CORRECTED 2026-08-19:** it was recorded as blocked by `FUP-DISPOSAL-CHILD-LOCK-BLOCKS-PHI-ERASURE`; **it never was** — the runbook is the `file_objects`/Storage path and `dispose_meeting_minutes` is disjoint from it in the catalog (writes no `file_objects` row, never sets `disposal_pending`; the runbook says "meeting" zero times). That FUP is resolved anyway (ADR 0129), but § 3 is un-run for its own reasons, not newly released. The two halves are independently executable; do not read the backup run as C1a. **C1b (Cloud)** — the same run against the linked project; ⚠ it **cannot inherit** the backup half, which has no Cloud form at all (`FUP-DM5-BACKUP-HAS-NO-CLOUD-FORM`). ⛔ **Why the split is not bookkeeping:** the runbook itself says a local rehearsal *"runs against a local stack by construction, so it cannot exercise the Cloud paths"* (§6) — so a local-only run discharges this row's **wording** while leaving its **purpose** undischarged, which is [[a-predicate-quoted-at-the-wrong-grain]] in the highest-severity item in the register. | ⛔ **BEFORE ANY REAL PATIENT RECORD IS LOADED.** PO-accepted 2026-08-18 as a pilot risk **bounded by this rehearsal** (ADR 0121 **Amdt 3**) — the acceptance is not open-ended, and the pilot may not admit real PHI ahead of it. ⭐ **The bound is C1b, not C1a**: the pilot runs on Cloud, so a green local rehearsal does **not** release it. | PO (executor = whoever holds service-role reach — an ACL fact, not a choice) |
| **C2** | 🟠 **`FUP-AUTHZ-COMMAND-DOOR-UNSWEPT`** — **407** reachable command doors sit outside **every** authz arm's domain (`ARM=census` is bounded to `bool`/set-returning; these return `jsonb`/`void`). ⚠ **Covered-but-UNPINNED, not blind** — a 3-door neutralization sample found all three COVERED. ⛔ **The sample may NOT be used to close it.** | **Tier 1 — sweep the subset that touches PHI or crosses a tenant boundary**, derived as a property over the catalog, never hand-listed ([[enumeration-boundary-is-a-syntax-not-a-property]]). **Tier 2 — the remainder is DEFERRED.** Each swept door gets a recorded verdict, so a regression reds and a **new** door cannot pass by absence. ⭕ **Tier 1 ABSORBED TWO ITEMS 2026-08-18** — `FUP-DM5-Q1-OPEN-BYTES-CUT-BROKEN` (successor named: `app.resolve_document_version_bytes`) and `FUP-DM5-SIBLING-GUARD-DIFF`. All three want the same door-mutation machinery over `prosecdef` gates; building it three times was declined. ⚠ **Absorption is not closure** — each keeps its own index line and its own verdict. | **Tier 1: next, as its own scoped workstream** — sizing is step one and is not yet done. **Tier 2: after the pilot ships, once there are real customers.** | lead + backend |
| **C3** | 🔴 **`FUP-DM5-BACKUP-HAS-NO-CLOUD-FORM`** — § 6b's backup mechanism is `docker exec … tar`, **local-only by construction**. On Cloud: managed backups + PITR **exclude Storage objects by documented design**, *"Restore to a new project"* does not copy them, and `supabase storage cp -r` has **no streaming form** ⇒ **the pilot platform has NO Storage recovery point at all**, and § 6b's *"encrypted AT CREATION"* is **unsatisfiable** there. ⭐ **It INVERTS its parent**: `FUP-DM5-BACKUP-IS-PHI-EXPORT` graded an over-wide copy **existing**; this grades **no copy existing** — opposite failure, opposite remedy, which is why it is a separate item and not absorbed into that close. | **PO decision, two shapes:** (a) accept no Storage recovery point pre-pilot and say so **where the pilot decision is made**, not only here; or (b) **name a mechanism** — ⭐ only one shape can satisfy "encrypted at creation": the **S3 protocol endpoint** streamed into a client-side encryptor (`rclone crypt` and peers), which makes this **the same measurement as `FUP-DM5-CLOUD-ORPHAN-SURFACE`** (that endpoint is **UNPROBED**). ⛔ **Any destination inherits the SOURCE's blindness** — changing the bucket cannot change what the endpoint can enumerate, and a source-count ↔ destination-count check compares **metadata to metadata**. Then rehearse it **restore included**, and prove the restore recreates `storage.objects` rows and not merely bytes. Also owed for any new processor: **BAA posture + LGPD cross-border basis**. | ⛔ **BEFORE ANY REAL PATIENT RECORD IS LOADED.** From the moment the pilot holds data with no recovery point, every day is unrecoverable-loss exposure. ⚠ **Distinct from C1's trigger, and they are easy to conflate:** C1 is about **destroying** bytes on request; this is about **not being able to get them back**. | PO decision, then backend + lead |
| **C4** | 🟠 **`FUP-DM5-DB-DUMP-AND-SCRATCH-DB-UNGOVERNED`** — § 6b's five values are scoped **literally** to *"a Storage backup" / "the archive"*, yet the same section requires a `supabase db dump` restored into a **scratch database** to earn the words *"verified good"*. **Neither artifact has a location, reader-set, retention or destruction rule**, and nothing tells the operator to drop the scratch DB — which this same page calls *"a data leak wearing one"* (**90 of 274** RLS policies restored). ⭐ The parent item's own sting one level down, **inside the section that resolved it**. | **PO extends the five values explicitly to both artifacts, OR rules the restore test out of the procedure.** ⚠ The interim mitigation already written into the runbook — apply the values by analogy, **drop the scratch DB as soon as the comparison is recorded**, record both in the run log — is a stopgap and **is not the decision**. | **The first time anyone runs `supabase db dump --linked`** — ⚠ **reachable on Cloud TODAY** (it needs only the DB password, unlike C3), and it is the natural next step of a C1b rehearsal. ⛔ Do not let a C1b run be the first execution of an ungoverned procedure. | PO decision, then backend |

## Follow-ups / Deferred Items

_**ONE-LINE INDEX ONLY** (severity · id · title · owner). Full bodies of OPEN items rotated 2026-08-08 → **[follow-ups.md](docs/progress/follow-ups.md)** — update BOTH (the body there, the line here) when an item changes state. Resolved items → [follow-ups-archive.md](docs/progress/follow-ups-archive.md). Compressed 2026-08-18 at the size rotation; every entry was verified to HAVE a body first._

⭐ **FOUR items also carry a [§ Critical FUP](#-critical-fup--the-must-not-be-forgotten-list) entry** — `FUP-DM5-DISPOSAL-JOB` (C1), `FUP-AUTHZ-COMMAND-DOOR-UNSWEPT` (C2), and — **promoted by the PO 2026-08-19** — `FUP-DM5-BACKUP-HAS-NO-CLOUD-FORM` (C3) + `FUP-DM5-DB-DUMP-AND-SCRATCH-DB-UNGOVERNED` (C4). Their lines below stay put; the Critical entry adds a **trigger and a deadline**, it does not replace the index line.

- 🟡 **FUP-E2E-PROF-CREATE-ROSTER-FLAKE** — `ethics-e4-participants.spec.ts:765` PROF-CREATE roster row absent after inline create (:787, 10 s); ONE observation, AE1's `e2e:prod` 2026-08-27, passed on retry. ⛔ NOT admitted to `FUP-E2E-REPEAT-FLAKY` — a different mechanism, and one occurrence is not a pattern; disposition undecided → [body](docs/progress/follow-ups.md) — lead/tester
- 🟠 **FUP-MINUTES-WEBHOOK-HMAC-DENY-TEST** — rider R2 of the AE1.4 rpc rulings, a **condition** of the `complete_minutes_job` ruling: `verifyCallbackSignature` at the route is the sole gate and `route.test.ts` mocks the handler out, so no test notices the HMAC vanish. Both directions needed (deny without reaching the RPC; allow reaches it) → [body](docs/progress/follow-ups.md) — backend/tester
- 🟡 **FUP-DOC-RECLASS-OPERATION-ID** — bind reclassification completion to a DB-minted single-use operation id carrying the (version, new, old, sha) tuple; four loose params today — relational checks bound abuse but don't prove one-invocation provenance (PO obs #2 at the rulings, 2026-08-27) → [body](docs/progress/follow-ups.md) — backend
- 🟡 **FUP-DOC-DISPOSAL-PROVENANCE-SPLIT** — `complete_document_disposal` serves automated duplicate retirement AND human DSR/manual disposal through one generic door, erasing their different authz/evidence/audit requirements; lane (b) should name the human authority (PO obs #3, 2026-08-27) → [body](docs/progress/follow-ups.md) — backend/PO
- 🟠 **FUP-AFF4-HOMEORG-PHASE2** — 0151 D10's named Phase 2 (RLS legs + tenant trigger off `home_organization_id`; lifecycle authority over fully-offboarded persons) had **no register line anywhere** — filed 2026-08-26 at ADR 0155's acceptance, which also **promotes it to PRE-PILOT** (was "before multi-org, not pilot-blocking") as implementation Phase 2 → [body](docs/progress/follow-ups.md) — backend/PO
- 🔴 **FUP-MEETING-CASES-SELECT-OMITS-RECUSAL** — the SELECT policy hand-rolls a weaker predicate than its three siblings and inherits **no recusal deny**; the table carries case `summary`/`decision`. Predicate measured TRUE for a recused user, but the seed cannot reach the state — **latent, not demonstrated**. PO rules it before any fix → [body](docs/progress/follow-ups.md) — backend/PO
- 🔴 **FUP-DIFF-SCOPED-SWEEP-IS-HALF-AIMED** — the sweep CLAUDE.md §6 step 1 mandates every phase has a **FOUR-part hole**, all four measured during AE1.5. **(1)** `scripts/door-sweep-cases.sh` derives **read AND write** policies but names only `p0-authz-door-audit.sh`, so an operator following the deriver’s own output sweeps half the list. **(2)** ⛔ arm 2 (`p0-authz-writepath-audit.sh`) computes `(COVERED = the rest)` over an **empty set** and exits **0** having measured nothing — the `ARM=census` failure **recurring in a second harness**, where the sibling returns exit 3 UNPROVEN for the identical case. **(3)** ⛔ that harness **cannot distinguish "I swept your case" from "your case is not in my worklist", and reports the second as the first** — 9 write policies sit in NEITHER arm’s domain and are dropped silently. **(4)** ⛔ **it is not safe to kill**: it opens gates and restores from an `EXIT` trap, so a killed run leaves a policy WIDE OPEN with no warning (measured 2026-08-27: `meeting_cases_staff_admin_update` at `qual=true wc=true`, ~4 min, local) → [body](docs/progress/follow-ups.md) — backend/lead
- 🟡 **FUP-QA-FINDINGS-N3-N4-UNACCOUNTED** — a § Now line claimed five QA findings + four P3 follow-ups were indexed; measured, only **N-1/N-2/N-5** and **two** `FUP-P3-*` are findable. ⛔ **N-3 and N-4 have ZERO hits** — recover from the originating review. ⚠ The error ran **wider** than reality, concealing two items by asserting they were tracked → [body](docs/progress/follow-ups.md) — lead
- 🟡 **FUP-ZERO-ARG-APP-PREDICATES-NOT-HOISTED** — the advisor's initplan rule is blind to `app.*()`, so zero-arg RLS predicates still evaluate **per row** (`organizations` twice per row); 26-table census → [body](docs/progress/follow-ups.md) — backend
- 🟡 **FUP-READ-ACCESS-RIDES-ON-A-WRITE-POLICY** — `commissions` + `commission_meeting_types` grant tenancy-admin **reads** from `…_write` policies (a `FOR ALL` policy **is** a read policy), so the only identity-preserving dedup would make read depend on a write policy surviving. Lead-ruled 2026-08-27: leave both; restructure is its own decision. ⚠ Wider than these 2 — derive as a **property** → [body](docs/progress/follow-ups.md) — backend/PO
- 🔴 **FUP-ETHICS-CASE-DELETE-CASCADE** — a commission `staff_admin` can `DELETE /rest/v1/cases` an **in-flight** ethics case, cascading all **7** `ethics_*` tables; the lane's deliberate SELECT-only lockdown (9 tables, 14 DEFINER writers, **no DELETE in any**) is defeated by a parent that was never locked down — same JWT gets **403** on `ethics_case_details`, **200** on `cases`. `guard_case_status` bars DELETE only for `completed`/`cancelled`. ⛔ **3** audit rows emitted, **0** naming any ethics entity (no `ethics_*` table has an audit trigger). Confirmed by execution, rolled back. **PO-ruled RECORD-ONLY 2026-08-21** — accepted and OPEN — backend/PO
- 🟠 **FUP-ETHICS-RESPONDENT-PIN-FIRES-TOO-LATE** — `redact_professional_profile` erases the accused doctor from an **undecided** ethics case: the `HC0J7` bar needs an `issued` decision and `trg_pin_respondent_retention` fires only on the transition **into** `issued`, so both halves are false all through intake/findings/hearings. Executed by a plain commission `staff_admin`. ⚠ **No UI calls it — that is not the control**; the RPC is `EXECUTE`-granted to `authenticated` and answers over PostgREST. Existing pgTAP `257` + E2E pin only the **pinned** case, so nothing is red. **PO-ruled RECORD-ONLY 2026-08-21** — backend/PO
- 🟠 **FUP-DM5-SUPERSEDE-SERVING-COLLISION** — ✅ **PO-RULED 2026-08-18 as option (b): supersession no longer marks bytes; the trigger moves to RETENTION EXPIRY** — backend
- 🟠 **FUP-AUTHZ-COMMAND-DOOR-UNSWEPT** — ⭐ **⭐ CRITICAL FUP C2. `ARM=census`'s DEFINER clause is bounded to `bool`/set-returning, so 407 reachable non-trigger command doors (326 RPC-callable) sit outside every arm's domain. ⭕…** ⭕ **EXTENDED 2026-08-23 (AFF2 B1): `trigger`-returning `prosecdef` gates are in no arm's domain EITHER, and this item's own word "non-trigger" excluded them** — `guard_profile_privileged_columns` is now the only in-DB control over the two new person columns. ⛔ Not a live hole (no PUBLIC/`anon` grant; a direct call outside trigger context raises) — a **measurement-domain** gap — lead + backend
- 🟠 **FUP-AUTHZ-HARNESS-TRANSACTIONAL** — **PARTIALLY RESOLVED 2026-08-17 (`4102149b`); the filed remedy was WITHDRAWN as unbuildable** — lead/backend
- 🟠 **FUP-FORM-IDENTIFIER-IN-URL** — ✅ **4 leaks FIXED + control-proven both directions** (`cpf-field` CPF, `user-profile-edit-form`, `affiliations-panel`, `patient-search-view` MRN/PHI); 4 more measured NOT-REACHABLE-PRE-HYDRATION. ⛔ `name` is **INJECTED by `useFieldIds().controlProps`** — a `name=` grep cannot find it. ⛔ **STILL OPEN:** the standing detector must be a **route crawler**, not a re-run of this 8-file list; `<select>` coverage is weaker; and the PO-RULED 2026-08-20 inversion of `useFieldIds`' `name` default (**10/51** failure rate) is a **SEPARATE change after Slice 3**, only after enumerating the 4 classes that BREAK without `name` — frontend/lead
- 🟡 **FUP-E2E-SUBMITTED-POOL-UNSCOPED** — the shared submitted-response pool has no `case_phase_id is null` filter and the one-line fix BREAKS a peer spec — lead/tester
- 🟡 **FUP-PREVIA-MINT-FLAG-ASYMMETRY** — `HC0DV` refuses a prévia on the premise the mint is reachable; the mint’s preconditions are a strict superset — lead
- 🟡 **FUP-TITLE-ERASURE-REACH-IS-NOT-UNIFORM** — six of the ten annotated `*.title` columns ARE inside a `dispose_*` door's reach and four are NOT, so the loose reading of ADR 0131 Amdt 1's "title invariant" (*titles are outside erasure*) is false for six of them. ⛔ The helper-text constants therefore give **visibility**, never erasure, as the reason — pinned by assertion. Open: whether the ADR names the split — PO/lead
- 🟡 **FUP-EXIT-CODE-MASKING-HAS-NO-MECHANISM** — **a pipe erases the exit status of everything left of it, and NO gate here can catch it.** **2 occurrences in one day**, both by an operator who knew the narrow form; one landed a commit on a FAILING gate. ⛔ **ACCEPTED RESIDUAL, not resolved** — no gate can verify an exit code never captured, and a `.claude/rules/` entry fails ADR 0127 admission. The control is a habit. Measurements + why every mechanical fix fails → [body](docs/progress/follow-ups.md) — lead
- 🟡 **FUP-HOSPITAL-DIRECTORY-EXPIRED-SEAT-STALE-ROSTER** — `hospitalPeopleIds()`'s commission leg has **no `expires_at` predicate**, so an expired seat-holder still shows on the hospital directory after org-offboarding. ⛔ **Stale roster, NOT an authorization leak** — conflating them would justify the widening ADR 0158 refuses. Fix + rationale → [body](docs/progress/follow-ups.md); unscheduled, needs a PO go — backend/PO
- 🟡 **FUP-RULES-VOLUME-CAPS-BIND-IN-OPPOSITE-DIRECTIONS** — ADR 0127’s two volume caps bind DIFFERENT rules in opposite directions (measured 2026-08-21: the 2 rules with ~no byte headroom (92 B / 68 B of 2048) are the 2 nobody would call broad; the one that IS broad matches **125** files against a soft cap of 40 and has it waived by `broad:`, leaving bytes as its only live bound). ⛔ The gate’s success line reports NEITHER headroom, so proximity is invisible until an edit reds it — a 1-line path add left **31 bytes** and still printed `OK`. Fix shape: report the TIGHTER headroom per rule; ⛔ filed, NOT built — a gate change needs its own decision — lead
- 🟡 **FUP-LINT-VECTOR-DIMENSION-DRIFT** — a proposed lint gate over shared SQL↔TS vector fixtures (filed, deliberately NOT built) — backend
- ⛔ **The three lines above were ADDED 2026-08-20**: each had a live 🟡 body in [follow-ups.md](docs/progress/follow-ups.md) and **no index line here** — invisible to the register the PO reads from. `lint:progress` checks index→body and **never body→index**, so nothing could contradict it — lead
- ⛔ **`FUP-DISPOSE-DIALOG-OVERCLAIM`'s closure instrument was SWAPPED 2026-08-20** — grep over `src/` → a rendered-output assertion (`referral-dispose-dialog.test.tsx` claim 2, property now shared from [`disposal-copy-property.ts`](src/components/dsr/disposal-copy-property.ts)). The grep's measured record was **0 true positives / 4 false positives** (every match was prose *about* the defect — `FUP-GREP-VERIFIED-FOLLOWUP-IS-SELF-DEFEATING`, **closed 2026-08-20 by dissolution**, body in [follow-ups-archive.md](docs/progress/follow-ups-archive.md); its instrument lesson is now `.claude/rules/ui-copy-forbidden-strings.md`); its "nothing, comments included, may contain those strings" prohibition **dissolves with it**. Do not re-run it to re-verify that item — lead
- 🟡 **FUP-VITEST-UNCAPTURED-FAILURE** — a unit test failed once (**1447/1 of 1448**) and **nobody captured which**; passing since is not a diagnosis. ⛔ Filed only because QA found the lead had acknowledged it verbally twice and never recorded it — every trace read a flat "vitest 1447". If it recurs, **capture the output before re-running** — backend/lead
- 🟡 **FUP-E2E-GATE-CENSUS-AND-CRASH-CLASSIFIER** — ⭕ **ARITHMETIC HALF RESOLVED 2026-08-21 by measurement: the census DOES sum.** A full 19/19 run gave `1166 p · 2 f · 3 flaky · 11 skipped` = **1182 collected, exactly**, while the gate printed `accounted for 1171` — because `accounted` **omits the skipped bucket**. ⭐ The *"11 tests in no bucket"* were always skips; the defect is the reporting definition, not lost tests. ⚠ **STAYS OPEN for the other half**: the INFRA classifier still has no notion of a worker exit code, so a crash scores as an assertion failure — ⛔ and the fix is still not "add crash to INFRA", a crash is a third category needing a re-run before any verdict. ⭐ `did-not-run` was **0 on all 19 batches** — that field, not the pass count, is what answers "was anything swallowed?" — lead/tester
- 🔴 **FUP-E2E-ABSENT-ROW-ASSERTIONS** — `expect(row?.field).not.toBeNull()` **passes when the row is absent**, live on PHI-erasure assertions (`pdf-printing-meetings:335`, `case-patient:1193`). ⭐ FOURTH CORRECTION 2026-08-20 (measured): the defect is the **MATCHER**, not the optional chaining — the population must be re-derived as *matcher ∈ accepts-`undefined`* × possibly-absent subject, ⛔ never as a grep for `?.`. ⚠ A second, matcher-independent mechanism stays unswept. ⛔ Three counts claimed, none survived. `lint:vacuous` is blind — tester/lead
- 🔴 **FUP-AUTHZ-HARNESS-PRECONDITIONS** — a neutralization verdict rests on **≥2 preconditions** (baseline green · **keystone present in the swept domain**) and the harness asserts **only the first**. ⛔ *"Nothing noticed the gate opening"* and *"nothing that could notice was running"* are **indistinguishable in the output**. Two near-miss **false BLINDs on the same live PHI-adjacent door in one session**, by different broken preconditions; caught by intuition, not by the instrument. A `PASS` with the subject absent must be an **ERROR**. ⚠ **Scope: a RED is sound IFF the baseline was verified green** — a red baseline also yields a red post-probe run, which reads as COVERED (a **false RED, failing in the reassuring direction**). Slice 3's 47 RED + 1 GREEN all clear that bar — backend/harness
- 🟡 **FUP-PGTAP-184-T11-FLAKE** — `184_hospital_admin_isolation.sql` t11 failed once on a full run, passed in isolation + two full runs since. Runs **before** `350`, unrelated to DSR. Not diagnosed — but **named**, so actionable — unassigned
- 🔴 **FUP-PGTAP-VACUOUS** — `lint:vacuous` scans TS specs only; ~6348 pgTAP assertions unscanned, live specimen in a PHI-boundary suite. The sweep must be **proven able to fail** first — lead/backend
- 🔴 **FUP-AFF-1** — the census is BLIND to write-path doors (ADR 0079 Am. 5); ⛔ cite `302`'s keystones, **never `ARM=census`** — backend/harness
- 🔴 **FUP-PCITV-1** — what QA APPROVED **over**, ranked: 5 open (TRUNCATE revoke residue · audit-mesh 2/7 arms · unexercised org-admin disjunct · resolver/GUC semantics · 10 bare `for select` policies) — unassigned
- 🔴 **FUP-ETH-ROLES-1** — no production bootstrap of `case_participant_roles`; the bundle lives only in `seed.sql` and `role_id` is NOT NULL, so a real org starts with zero roles and every participant type dead-ends. Decide before a second org onboards — product/backend
- 🔴 **FUP-FF5-1** — patient-lane sublabel degenerate on the READ path (PO DEFERRED; resolve before the lane reaches a real committee) — backend
- 🟠 **FUP-DM5-STORAGE-ORPHANS** — ✅ **Local half CLOSED empty by measurement 2026-08-17** — lead/backend
- 🟠 **FUP-DM5-STACK-CYCLE-DESTROYS-BYTES** — **a `supabase stop`/`start` recovery destroyed 221 storage objects (15 PHI-tier) with no manifest, no count comparison, no audit — the event ADR 0120 D9 exists to prevent, inside the slice tha** — lead/backend
- 🟠 **FUP-DM5-D9-NO-ARM-SEES-A-BYTE-POST-RETIREMENT** — **once `…000400` applies, `capture` prints `CAPTURE CLEAN` and the only arm that can still see a surviving byte is the volume `walk`, which is `STORAGE_BACKEND=file` local-only ⇒ on Cloud, pos** — backend
- 🔴 **FUP-DM5-BACKUP-HAS-NO-CLOUD-FORM** — ⭐ **CRITICAL FUP C3 (PO-promoted 2026-08-19).** § 6b's mechanism is `docker exec … tar`, local-only; managed backups **exclude Storage objects by documented design** ⇒ **the pilot platform has NO Storage recovery point at all**. ⭐ It **inverts** its parent: an *absent* backup, not an over-wide one — PO/backend/lead
- 🟠 **FUP-DM5-DB-DUMP-AND-SCRATCH-DB-UNGOVERNED** — ⭐ **CRITICAL FUP C4 (PO-promoted 2026-08-19).** § 6b's five values are scoped to *"the archive"*, yet the same section mandates a `db dump` + **scratch database** to earn *"verified good"* — neither governed, and nothing says to drop the scratch DB. ⚠ **Reachable on Cloud today** — PO/backend
- 🟠 **FUP-DM5-DISPOSAL-JOB** — ⭐ **CRITICAL FUP C1, split into C1a (local) + C1b (Cloud) on 2026-08-18; the pilot bound is C1b.**
- 🟠 **FUP-CORRECTION-CORRIDOR-COVERAGE-UNMEASURED** — ✅ all seven lanes MEASURED 2026-08-20 (59-probe executed differential): only **rca** is fully covered; the other six each have a structurally terminal state no door reverses, and the referral corridor never restores the SOURCE's own free text. ⛔ The erasure fallback this item assumed is BROKEN (`BUG-DISPOSAL-CHILD-LOCK-RCA-CAPA-INTERVIEW`). Residue: PO ruling per frozen state; manual-source capa has NO erasure door — backend/PO
- 🟠 **FUP-E2E-HELPERS-SWALLOW-FAILED-READS** — the **matcher-independent** half of `FUP-E2E-ABSENT-ROW-ASSERTIONS`: a helper returning `[]` on a **failed read** makes *"the request errored"* and *"the table is empty"* indistinguishable. **3 fixed 2026-08-21** (two local `restGet`s + the **shared** `serviceQuery` used by 6 specs, 47/47 re-run green, safe because every call site uses the service role). ⛔ Population is **~48 spec files + 2 helpers** carrying the same `Array.isArray(data) ? data : []` shape, deliberately **not** swept — ⭐ *a fix count is not a population count*. ⚠ Where a helper is used with an RLS-scoped key, `ok()` is the **wrong** assertion, which is what makes this per-helper rather than a codemod — tester/lead
- 🟡 **FUP-DISPOSE-REFERRAL-HAS-NO-INBOX-BROWSER-COVERAGE** — `dispose_case`/`dispose_event`/`dispose_meeting` all gained inbox-driven browser coverage this round; **`dispose_referral_phi`'s live pathway has no browser test anywhere** (the only `e2e/` hit is a direct RPC POST, which proves the door and says nothing about the card, the confirm flow or the server action). ⚠ The named residual of `BUG-DISPOSE-DIALOG-NO-BROWSER-COVERAGE`, which closed **on removal of its subject, not on achieved coverage** — so the lane whose UI was deleted is the lane with the least coverage, and that close is the document a future reader finds first — tester
- 🟡 **FUP-CHILD-LOCK-REGRESSION-GUARD-COVERS-ONE-LANE** — the browser-level P0 guard (`dsr-disposal-child-lock-regression.spec.ts`) drives a **locked interview** and asserts by count: that is item **9 of the P0's ten** statements. ⛔ The **`meeting_cases`** lane (item 10) and the **RCA/CAPA** lanes have no browser coverage; both are pgTAP-`353`-covered and mutation-proven, so this is a **layer** gap, not an unproven fix. ⭐ Filed by the guard's own author in the report delivering it — the alternative is a green spec whose name implies it covers the bug — tester
- 🟠 **FUP-COPY-PROPERTY-CANNOT-SEE-ITS-OWN-SURFACE-SET** — `disposal-copy-property.ts` is iterated by two suites and **nothing asserts which surfaces exist or how many import it**. Removing one surface would have dropped **three** coverage items, **two silently** — the residue-CLASS content pin **1 → 0** (a cardinality pin and a content pin are different properties, and the cheaper one gets written) and the type-to-confirm arming pin **1 → 0** on a live control. ⛔ `lint:vacuous` is structurally blind — the assertions were **removed**, not made vacuous. Fix: a declared surface roster with a floor — lead/frontend
- 🟠 **FUP-DSR-OUTCOME-RECORD-HAS-NO-DELIVERY** — ADR 0130 D1 owes the data subject a written answer with its legal basis (Art. 18 §4), and `dsr-outcome-record.tsx` **renders on screen only**: measured 2026-08-20, the DSR module has **no export, print, PDF or download path anywhere**, and no document says how the record reaches the subject. ⛔ **PO-DEFERRED 2026-08-20 with the gap named — not closed, not descoped.** Two shapes when taken up (minimal print vs registered emission under ADR 0125/0126); ⛔ do not let the screen render stand in for delivery in any status claim — PO/frontend
- 🟡 **FUP-DSR-ENCARREGADO-MUST-BE-A-COMMISSION-MEMBER** — `app.is_dpo_of_for` requires a commission role in the hospital as a **hard conjunct**, and `organizations_select` has no DPO arm, so a pure LGPD data-protection officer **cannot reach `/o/[org]/titulares` at all**. ⛔ **BY DESIGN** (ADR 0130 D2, *"a plain member of ONE commission BY DESIGN"*) — filed as the product question it is: onboarding a real compliance officer today means granting a commission membership they do not need, which is a read grant over that commission's content. ⭐ Found 2026-08-20 when `frontend` measured a lead spawn premise false **before** building dead nav code against it — PO/product
- 🟡 **FUP-XREF-PEPPER-ROTATION-ORPHANS** — rotating `mrn_pepper` permanently orphans DISPOSED `patient_xref` rows (raw MRN gone, key unrecomputable); ADR 0039 logged it as "follow-up", never registered. Every granted erasure widens the unrotatable population. Decide before any rotation task is scoped — backend
- 🔵 **FUP-ADR0121-REASON-VALUE-DRIFT** — ADR 0121 Amdt 2 deliberately left the `superseded`-vs-`retention_expired` reason value OPEN; the D11 register body already states `'superseded'` as if chosen (live CHECK still admits only the original five). The D11 implementing slice decides explicitly + records in the ADR's reserved slot; neither value citable as decided until then — lead
- 🔵 **FUP-DM5-Q1-OPEN-BYTES-CUT-BROKEN** — **⚠ HALF RESOLVED 2026-08-17 (`24cee179`): the fail-open half is fixed and proven; the arm is still a no-op pending a NAMED successor (deliberately not re-pointed — a successor must be named,…** — backend
- 🟠 **FUP-DM5-D11-SUPERSEDED-NEVER-RETIRES** — ✅ **DECIDED 2026-08-18: BUILD IT, at retention expiry** — backend
- 🟠 **FUP-DM5-SIBLING-GUARD-DIFF** — **no authz arm can see a door that OMITS a check its siblings all make** — lead/backend
- 📦 **Deferred backlog — 33 open items (🟡 24 · 🟢 1 · ▶ 8)**, moved out of the live index 2026-08-19: open, but not actionable next session. Severity · id · claim preserved verbatim → [deferred-backlog.md](docs/progress/deferred-backlog.md)
- 🔴 **FUP-DM4-PRODROW** — ⭕ **UNBLOCKED 2026-08-18: the probe answered its blocker (no Cloud orphan surface), and this item's "~49 vanished" figure is WITHDRAWN as unsound arithmetic.** The subject is still erased, not reconciled — lead/backend
- 🟠 **FUP-RETRY-CHANGES-THE-FAILURE-MODE-ON-NON-IDEMPOTENT-TESTS** — `e2e:prod` runs `RETRIES=1`; where a test mutates shared state, a **transient** first-attempt failure leaves that state behind and the **retry fails DIFFERENTLY**, on an assertion about the state attempt 1 created. Measured 2026-08-23 on both of the run's "real" failures (`ethics-e4-participants:918` count 2→1; `user-registration:506` strict-mode on a `Remover…` button that only exists once assigned) — **both `-retry1`, both GREEN alone (25 p / 0 f)**. ⛔ **Worse than flake:** it prints `GATE RED — 2 real failure(s)` and points at the FEATURE, not the harness. ⚠ Do NOT fix by `RETRIES=0` — the retry absorbs the real Windows server-death family (5 batches hit it this run) — tester/lead
- 🟡 **FUP-PLAIN-STAFF-ASSIGNEE-CANNOT-REACH-THE-MANAGE-HOST** — the phase-result arm is now surfaced, but `canOpenCaseManagement` admits only coordinator ∨ administrativo ∨ write-grantee, so a **plain-staff assignee 404s before any phase renders** (measured in a browser: `staff1.ccih`, `staff3.ccih` → root 404). ⭐ Filed **by the fix's own author as a stated bound**, because the alternative is a close note that reads as completeness. ⛔ Widening the gate is ADR 0134 **routing** territory (D1's read/manage split) and needs a PO ruling, not a patch. ⚠ Do not close it by noting the wizard path exists — frontend/PO
- 🟡 **FUP-ACTIVE-PHASE-STASHED-OVERRIDE-IS-INVISIBLE** — on an `active` phase the door *stashes* the override, but `getCaseDetail` does not select `result_override_id` (only `getCasePhaseForFill` does), so **no badge renders and reopening the dialog shows no pre-selection**. The write landed; the surface cannot show it. Mitigated with **copy, not a fix**. ⭐ It produced a **false defect report** mid-build — a correct save read exactly like a live defect — caught only by checking the catalog instead of believing the UI. Cosmetic sibling: `PhaseResultCorrectButton` is now a misnomer — backend
- 🟠 **FUP-SUPERSESSION-BADGE-LANE-BLIND** — `resolveSupersessionBadge` (`queries/submissions.ts`) mirrors `app.submitted_form_responses`' exclusion but **drops that rule's own `case_phase_id is null`**, so phase-bound rows take the chain-tip grain ADR 0126 D8 examined and REJECTED. ⭐⭐ The lane conjunct already exists in TS one file away (`isDashboardCountable`). ⛔ Read ADR 0074/0085 before fixing. Class: **a mirror inherits its source's PREDICATE, not just its shape** — frontend/backend
- 🟡 **FUP-CLAIMS-SURVIVAL-DIFFERENTIAL-IS-NOT-RUN-BY-ANYTHING** — `claims_for` claims outlive `reset role`, so a pgTAP test can assert an owner-context property while still running as the last persona. ⭐ **The class is empty as of 2026-08-24** — emptied by a one-off differential (claims-clear after all 2171 `reset role` sites, 172 files; **six** false premises found and fixed, closing `FUP-RESET-ROLE-DOES-NOT-CLEAR-JWT-CLAIMS`). ⛔ **Nothing runs that comparison**, so tomorrow's test can reintroduce it green. Not lint-able (ADR 0127 bound: DB anchors); it is a full-suite-with-tree-edit run, i.e. periodic-sweep shape. Has a ready positive control — `358` G4 MUST fail while the instrument is applied, or the run proved nothing — backend/tester
- 🟠 **FUP-DEV-SERVER-SERVED-STALE-CODE-FOR-HOURS** — a `next dev` started 11:20 served pre-Increment-2 code for files committed at 12:33/12:45/14:30. ⭐ One step from being filed as a **product bug**; the tester's clear-`.next`-rebuild discipline is why it wasn't. ⛔ **Mechanism NOT established** — the old console was not captured before the kill; *restarting fixed it* is a remedy, not a diagnosis. ⛔ **The suspect population is every GREEN run** — a failing spec gets investigated (that is how this surfaced), a passing one never does; size unestablished. ✅ **`e2e:prod` builds prod-standalone, so the phase gate is unaffected.** Cheap close, no mechanism needed: a **read** proof-of-life asserting something only HEAD has, before anything else — tester/lead
- 🟡 **FUP-CS2-QA-RESIDUE** — ⭕ **12 → 6** (2026-08-22, [record](docs/progress/case-split-assertion-integrity.md)); ⛔ **remaining SIX: M-1, M-8, M-11, M-12, M-13, M-17** — full statements in the [r2 review](docs/reviews/case-surface-split-increment-2-review.md). ⭐ Four are ONE class, **an assertion that proves less than its name claims**: count-keyed door pins (a SWAP passes) · an `app`-bounded "one body" (a `public` copy passes) · a 2-item hand-list against a 16-member derived class · a 404 matcher that cannot say WHICH gate fired — backend/tester/frontend
- 🟠 **FUP-42501-AUTHORED-MESSAGES-FLATTENED-BY-EVERY-MAPPER** — the DB authors **103 informative** `42501` refusals and the app layer flattens essentially all of them (of **63** `src/lib/**` mappers, only **2** recognise any message). ⛔ The flattening is the only safe DEFAULT — undoing it is a **decision, not a fix**. ⭐ RULED 2026-08-22 (ADR [0135](docs/decisions/0135-authored-refusals-get-their-own-sqlstate.md)): authored refusals get their own `HCxxx`, `42501` stays RESERVED; build DEFERRED. ⛔ Ruled ≠ discharged — backend/frontend
- 🟠 **FUP-DOOR-SWEEP-DERIVER-BLIND-TO-ALTER-FUNCTION** — the deriver matches only a `create function` body, so an `alter function … security definer` on an existing **boolean** gate derives **zero cases** and its exit-1 reads as "no gates touched". ⭐ The exact analogue of ADR 0079 Amdt 8, **surviving one branch over after the policy branch was fixed**. ⛔ Not a live hole today → [body](docs/progress/follow-ups.md) — backend/lead
- 🟡 **FUP-SIGNATURE-STRING-CALLERS-ABORT-ON-A-DROP-CREATE** — a caller naming a function's **old arity** in a `has_function_privilege('…(uuid,text,…)')` string does not fail an assertion; it **ABORTS the suite** as a plan mismatch, in an unrelated file, naming no function — the never-ran shape wearing its opposite. ⛔ Open on the **class**, not the two doors fixed: any gate built must go **RED on a deliberately stale signature**, or it cannot be told from one that finds nothing. Sweep counts + the `regprocedure` pin → [body](docs/progress/follow-ups.md) — backend
- 🟡 **FUP-APP-SCHEMA-PUBLIC-EXECUTE-IS-CONFIG-BOUNDED** — ⭐ RAISED 🟢→🟡 2026-08-22 (the schema it bounds now hosts a PHI writer). ⛔ **Informational, NOT a live hole; do not report it as one.** Of **467** `app` functions, **237 are `anon`-executable** — 228 by the `proacl IS NULL` default, 9 explicit, four of those authz predicates; the ONLY bound is one config line (`supabase/config.toml:13`). Needs a **decision**, not a patch; ⛔ never smuggled into a feature migration — backend/PO
- 🟡 **FUP-AFF2-ACTIVE-MEANS-TWO-THINGS** — *"active membership"* is asserted by ADR 0133 D13 and the AFF2 plan, and **no policy implements it**: neither live `profiles` SELECT policy filters `expires_at`. ⚠ NARROWED 2026-08-25 by ADR 0148 (AFF3) — the intra-policy asymmetry is GONE, in the **permissive** direction. ⛔ Not this item's closure: the open question is whether the **membership** leg should ADD `expires_at`, answerable only for all **three** policies at once. ⛔ Not a live hole. ⭕ **PO-RULED 2026-08-25 (ADR 0151 D6): the membership legs do NOT gain `expires_at`** — ever-held reads make read-side expiry filtering incoherent. ⛔ **IT DID NOT CLOSE AT THE AFF4 RECORD STEP — that clause is retracted 2026-08-26 by PO ruling, and the retraction is CONTESTED, so read both sides.** ADR 0151 § Consequences names it among ELEVEN discharging here and the QA review marks it **DONE** (AC6 row 2 — *"the deliverable was 'ruling + the build recording it', and the build records it in SQL (`…003400`)"*). The PO **overrode that** on a Record-step catalog measurement: **both `profiles` SELECT policies still return `f` for `expires_at` filtering.** ⚠ **State the disagreement, do not resolve it here:** that measurement is *also exactly what D6 RULED should be true* (the membership legs never gain `expires_at`), so it is evidence the ruling shipped, not evidence a defect survives — the item stays OPEN on the PO's call, not on a demonstrated hole. ⛔ **TEN discharged at AFF4, not eleven.** ⭐ The class: *a decision document forecasts what a build will discharge BEFORE the build, and nothing in it can notice when the build scopes an item out* — backend/PO
- 🟡 **FUP-WAITFORURL-SATISFIED-BY-ITS-OWN-STARTING-URL** — `aff-hospital-affiliation.spec.ts:764` (AFF-K) waits on a pattern its **starting** URL already matches, so the wait returns with **zero navigation**. ⭐ A wait predicate already true does not wait at all, and its symptom surfaces somewhere else entirely; green today only because the next assertion's timeout absorbs the real navigation — **racing silently**. Swept: 9 loose forms in `e2e/`, 8 safe by structure, this the only unsafe one. Fix: the positive `[0-9a-f-]{36}` UUID form — tester/lead
- 🟠 **FUP-E2E-PIN-RECORDS-COUNTS-NOT-IDENTITIES** — an `e2e:prod` baseline pin can only be diffed **arithmetically**: nothing records *which* tests were flaky, and the raw logs are destroyed before the next run can read them. ⛔ *A total that matches is not a list that matches* — here built into the **instrument**, since `GATE_LOGDIR` is not run-scoped and each run overwrites the last by batch number. ⚠ So a **new** flake and a **recurring** one are indistinguishable in the gate record forever. Measurements + fix → [body](docs/progress/follow-ups.md) — tester/lead
_**Three items RESOLVED 2026-08-24 (gate-tooling round), index lines rotated** → [follow-ups-archive.md](docs/progress/follow-ups-archive.md): **FUP-AUTHZ-CENSUS-PRUNE-NOTE-IS-WRONG** (shipped with THREE states, not the two it asked for. ⛔ The first closure claimed the two-state run had exposed a RENAMED live PHI door and re-pointed the backlog — **that was false and is corrected**: the run was against a DB that had not been reset and was missing six functions the backlog names; all six are present on a fresh reset, the entry is restored) · **FUP-VACUOUS-DETECTOR-FALSE-POSITIVE** (root-caused in the code, fixed red-first, self-test 44/44) · **FUP-42501-CONFLATES-GRANT-WITH-RLS** (closed on measurement — the fix predated the filing by ONE DAY and the item stayed open six days; the class-level mechanical check is a NAMED residual, not built). ⛔ **Found in the same round and fixed, but read this before trusting any pre-2026-08-24 authz gate record produced on macOS:** all three `p0-authz-*.sh` scripts hardcoded a foreign Windows scratchpad as the `WORK` default, so `mkdir` failed, every arm read empty files, and `ARM=census` printed `INVARIANT HOLDS` **at exit 0 having enumerated zero gates**; and `act-hat-blind-sweep.sh` could not be PARSED by bash 3.2 (the `/bin/bash` macOS ships), so `ARM=hat` could not run at all. Both fixed and all four step-1 arms now hold — census 546 gates, hat 6/6 self-tests, wrapper, floor 0 unallowlisted. ⚠ `ARM=floor` reads 35 unallowlisted doors on a stale DB and **0 on a fresh reset** — never run it without one._
- 🟡 **FUP-UI-AUTHZ-WRAPPERS-DUPLICATE-THE-ENFORCING-PREDICATE** — **six** `public` `prosecdef` bool wrappers mirror an `app.*` authorization rule that RLS calls **directly**, and **no gate can see them stop**. ⛔ NOT redundant (`app` is not PostgREST-exposed) — do not "simplify" them away. ⚠ Not a live hole. Measurement, coverage breakdown and why both gate families are blind → [body](docs/progress/follow-ups.md) — backend + PO
- 🟡 **FUP-DOOR-SWEEP-BROAD-GATE-ABORTS-A-FILE** — the door sweep cannot classify a gate whose opening makes a pgTAP file **ABORT**: the run shape moves and §7.15 withholds a verdict, correctly. Measured on `app.event_current_custodian` (`140_patient_safety.sql` reds its test 11, then "planned 35, ran 11"). ⚠ ERROR here means *unclassifiable*, not *unprotected* — the suite DID notice — but ⛔ ERROR is not a pass, and the newly-admitted broad gates are the likeliest to hit it — backend
- 🟠 **FUP-P-CLASS-SQLSTATE-ANSWERS-500-ON-DENIAL** — PostgREST v14.5 maps SQLSTATE class `P0*` to **HTTP 500** (`P0001` excepted), so an authored refusal raised as `P0002` answers **5xx on an ordinary denial**. Measured 2026-08-26: status is a **pure function of the SQLSTATE** (`HC***`→400, `42501`→403, `P0002`→500), not media-type handling. ⚠ **A CLASS: 73 `public` functions with EXECUTE for `authenticated` raise a P-class code** — the document corridor is 2 of them. ⛔ **No partial fix** (ADR [0152](docs/decisions/0152-postgrest-p-class-sqlstate-maps-to-500.md) D3); cost is observability + the defensive `[403,404,500]` E2E oracle, **not** §8. ⭕ Own increment; 0152 D4 rules the shape. ↩ Replaces FUP-OPEN-DOCUMENT-VERSION-500-ON-EVERY-RAISE, archived 2026-08-26 — backend
- 🟡 **FUP-GATE-19-TESTS-NEVER-RAN-ON-MACOS** — the 2026-08-25 full `e2e:prod` (1172p/18f) left **19 tests NEVER RUN**: `ethics-e1`(5), `ethics-e2`(5), `dm4-referral-documents`(5), `case-referral-usability-batch`(3), `ethics-e4`(1). A failure aborts the remainder of its spec, so the 18 understates what went unexercised — real coverage was **1211 of 1222**. ⛔ Nothing is proven for those 19 either way; they are hostage to the two clusters (the `open_document_version` 500 above, and the macOS native-`<select>` `ArrowDown` no-op that cannot pass on this OS) and stay unexercised until those are fixed. ⚠ The gate itself reports this loudly and correctly — the defect is that the reds gate the coverage, not that the gate hides it — lead/tester
- 🟡 **FUP-DOOR-SWEEP-FULL-RUN-DESTROYS-HAND-MERGED-ANNOTATIONS** — the SUBSET half is closed (ADR [0153](docs/decisions/0153-subset-sweeps-write-to-scratch-not-the-committed-baseline.md)), but a **FULL** sweep still writes `docs/reviews/authz-door-audit-findings.md` through a truncating redirect, destroying hand-merged annotations that file carries. ⚠ **Same class as the closed item, different RUN MODE** — so "the truncation is fixed" is true of one half only. What is destroyed, and the option-(b) fix → [body](docs/progress/follow-ups.md) — backend
- 🟡 **FUP-E2E-CREATEFRESHCASE-SILENT-NULL** — `case-narratives.spec.ts`'s `createFreshCase()` returns `null` on any setup failure with no thrown error and no reason, so a broken fixture reads as "nothing to test". ⚠ **Pre-existing, NOT caused by ADR 0137** — tester
- 🟡 **FUP-VITEST-CATALOG-DRIVEN-CASE-COUNT** — 2 suites generate cases from `memberships_role_check` read LIVE at import, so vitest's total tracks DB state; §292 pins a durable shrink but not the transient mid-reset one. Assert the role SET against one shared literal, exported as a FUNCTION not a `const` — backend + frontend
- 🟡 **FUP-AFF2-DIRECTORY-SEARCH-HAS-NO-REGISTRO-LEG** — the handoff promises *"nome, e-mail ou **registro**"*; the live search matches **name and e-mail only** (`org-users.ts:401` **and** `:487`, so a one-site fix splits org- from hospital-admin semantics against D14). PO-deferred in ADR 0133 Amdt 2, and measured 2026-08-24 it was in **no register at all**. ✅ Nothing user-visibly false today. ⛔ The registro leg crosses into `professional_credentials` (1→N) — a **join filter**, never another `.or()` — and must respect **D13**'s widened SELECT. ⚠ **A decision is owed** — backend/PO

- 🟡 **FUP-P3-MINT-AFFORDANCE-WIDER-THAN-ITS-DOOR** — the mint/prévia card admits a wider class (ADR 0134 D3: `administrativo`s + per-case write-grantees) than D8's door arm allows, so a caller can reach the screen and be refused at the door. ⭕ **NARROWED 2026-08-25 by catalog measurement — de-identified axis CLOSED, IDENTIFIED axis SURVIVES** (no PHI bit on `case_viewer_capabilities`, so no free fix; shape (c) stays forbidden). Full detail, both shapes, and the *refusal ⇒ null* vs *non-null ⇒ passed* direction note in the [body](docs/progress/follow-ups.md) — frontend/qa
- 🟠 **FUP-CASE-CONFIDENTIALITY-VS-PHI** — `cases.confidentiality_level` and `has_patient` are **unconstrained against each other**; **2 of 8** seed cases are `non_phi_internal` **with** patient data, and that level's label asserts *"(sem dados de paciente)"* — a claim about CONTENT the platform never enforces. ⚠ The print side is mitigated (ADR 0144 Amdt 3), so ⛔ **do not close this by pointing at that fix**. Three candidate answers, none chosen; the level also drives access, so re-labelling is not cosmetic — backend + PO
- 🔴 **FUP-E2E-GATE-CLASSIFIER-BLIND-TO-WORKER-CRASHES** — the infra classifier keys on `server_dead`/`conn_errors`/`pgrst_unready`; a dead Playwright **worker** matches none, so a host collapse is booked against the phase under test. Measured 2026-08-25: verdict said **34 real failures**, attributable was **6** — 27 charged to 3 untouched files; inflates `did-not-run` too — tester + backend
- 🟡 **FUP-MOCKED-MODULE-ASSERTED-ABOUT-ITSELF** — a suite that `vi.mock`s a module and then asserts a property **OF that module** is green by construction. Live instance: `pdf-payload.test.ts` asserted the unentitled/empty distinction while mocking the module the defect lived in — re-introducing the defect reddened **nothing**. ⭐ Worse than ordinary vacuity because **the assertion NAMES the defect** and the mock boundary is invisible at that line. Sweep predicate is narrow + greppable; ⚠ a green suite is not evidence — only a re-introduced defect is — backend + qa
- 🟡 **FUP-BULK-GRID-MODEL-IMPORTS-UPWARD** — `bulk-grid-model.ts:22` imports a type from `@/components/**`: a real `src/lib`→`src/components` inversion. ⚠ `import type`, so it **erases at build and NO gate can see it** (`lint:client-server-imports` is value-imports only, by design) — frontend
- 🟡 **FUP-CASE-NUMBER-FORMAT-HAS-EIGHT-AUTHORITIES** — `padStart(4,'0')` is reimplemented inline at **7+ sites** that never call `formatCaseNumber`. ⚠ The P3 move makes the dossier consistent with **one of eight**, so calling it "now uses the canonical formatter" would over-claim — frontend
- 🟡 **FUP-REFERRAL-WIZARD-TEST-HAS-NO-TIMEOUT-MARGIN** — `referral-send-wizard-mrn-warning.test.tsx` passes **alone in 5.05 s against a 5000 ms** per-test timeout, so it reds under parallel load. ⚠ The cost is **misattribution** — it fails during someone else's change and reads as their regression, then gets dismissed as "the flaky one" on the day it is genuine. ⛔ Not fixable by raising the timeout: a 5.05 s unit test IS the finding — frontend
- 🔴 **FUP-CASE-DOCS-DEAD-READER** — `listCaseDocuments` delegates to the PARKED `listAttachments` (body: `return []`), so **three live surfaces render zero case documents to every user** — the timeline, the staff case page and the coordinator detail page, none with a fallback. ⚠ **No gate can see it:** an empty array is legal at every layer, so a fixture with zero documents and a reader returning zero are indistinguishable. Predates P3, found while sourcing D2's manifest, deliberately not fixed in it — frontend + backend
- 🟡 **FUP-P3-DOSSIER-HAS-NO-RECUSAL-ROSTER** — `CaseDetail.myRecusal` is the **caller's own** recusal only and no per-participant roster reader exists, so `recusalDisplay` could be populated for the minter and nobody else — an artifact that varies by who printed it (ADR 0104 **A7**), and a **second** A7 exception with none of the D5 justification the first one has. Dropped from the v1 payload type (D2 never enumerated recusals). ⚠ Filed rather than closed by scope because **ADR 0144 D8's Consequences paragraph discusses recused members by name**, so the silence is a gap someone re-discovers from the artifact instead of from a file. ⛔ Any fix must render for EVERY participant or none — backend
- 🔴 **FUP-E2E-GATE-DISCARDS-SERVER-LOG-ON-MID-BATCH-DEATH** — `e2e-prod-gate.sh:308` truncates a fixed `server.log` per batch and tails it only on `start_server` failure, so a server dying **mid-batch** leaves **no server-side evidence**. ⛔ Heap ceiling · unhandled app exception · capacity are indistinguishable from the client side, and the middle one is a PRODUCT DEFECT booked as INFRA. ⭐ Body carries a second finding of the same class (`GATE_EXIT` lost in both runs). ⭐ PO-AUTHORISED 2026-08-25 to fix the harness's own defects; ⛔ NOT authority to change what the gate MEASURES — tester + backend
- 🟠 **FUP-E2E-CLEANUP-LEAVES-STORAGE-BYTES** — measured 2026-08-25: **9** `printed/*.pdf` objects in `documents-phi` with **0** registry rows, so `dispose_case_phi` block (f) cannot reach them. ⛔ A reset does not clean a bucket — tester + backend
- 🟡 **FUP-CASE-PRINT-REVISIONS-COMMENTS-CLAIM-ONE-WRITER** — two COMMENTs claim one writer; measured, there are **two**. ⛔ A COMMENT lives IN THE CATALOG — no grep and no gate can contradict it — backend
- 🟠 **FUP-DOSSIER-CAN-SILENTLY-OMIT-CONTENT** — QA N-2: `getResponseForFill` never inspects `error` on **eight** reads, so a transient failure yields an answer-less phase ⇒ **a hash-sealed dossier can silently omit content** under a verification URL. Also owed: a vector pinning the door↔policy parity Axis C rests on — backend
- 🟡 **FUP-MINT-KIND-TIER-RULE-ONE-DIRECTION** — QA N-1: the mint door refuses `contains_phi = TRUE` for `form_response` but has **no mirror** refusing FALSE for `case`; Amdt 5's invariant holds via the **D3 registration gate**, not a tier check. ⛔ Not reachable is not protected — backend
- 🟡 **FUP-GOTENBERG-EGRESS-UNRESTRICTED** — no network backstop for the print sidecar: dev is a bare `docker run`, Coolify constrains **inbound only**, so ADR 0145's schema narrowing is the **only** mitigation for an author-controlled fetch. ⛔ **PO-DEFERRED 2026-08-25 to a follow-up, NOT descoped** — owed: measure what the sidecar can actually reach in dev and on Coolify, then deny outbound — backend
- 🟡 **FUP-MOJIBAKE-GATE-BLIND-TO-UNTRACKED-FILES** — `check-mojibake.mjs:144` sources `git ls-files`, so a **staged** file is covered and an **untracked** one is outside the domain. Measured: gate 10 printed `OK (2825 tracked text files clean)` while **2,226 lines across 4 new P3 artifacts** were not in the 2825 (scanned separately, controls fired, 0 hits — clean but **unproven by the green line**). ⭐ Same shape as ADR 0079 Amdt 3: the thing most likely wrong is what the domain excludes. Fix = union `--others --exclude-standard`, ⛔ red it on a corrupt untracked file first — backend

_**Five items RESOLVED 2026-08-24 (ADR 0136 follow-up round), index lines rotated** → [follow-ups-archive.md](docs/progress/follow-ups-archive.md): **FUP-DSS-STANDALONE-ROUTE-DISABLES-SUBMIT** · **FUP-DSS-PENDING-SIGNOFFS-WALKTHROUGH-KEYSTONE** · **FUP-DSS-SIGN-SECTION-INVOKER-VERDICT-STALE** · **FUP-DOOR-AUDIT-PREDICATE-ARM-BOUNDED-BY-A-NAME** (ADR 0079 **Amdt 9**) · **FUP-DSS-KEYBOARD-FLOW-IS-THIN**. Each body in [follow-ups.md](docs/progress/follow-ups.md) carries its resolution + evidence._

_**FUP-RCA-WRITER-CAN-WRITE-IS-BLIND RESOLVED 2026-08-24 (keystone `142_rca.sql` §K, re-swept COVERED), index line + evidence rotated** → [follow-ups-archive.md](docs/progress/follow-ups-archive.md); body in [follow-ups.md](docs/progress/follow-ups.md). ⛔ Its sibling **FUP-DOOR-SWEEP-BROAD-GATE-ABORTS-A-FILE stays OPEN** above — filed together, only one closed._

_**FUP-DM5-NO-ANSWER-VS-NOTHING** — ✅ resolved 2026-08-19, index in [follow-ups-archive.md](docs/progress/follow-ups-archive.md); its body deliberately STAYS in [follow-ups.md](docs/progress/follow-ups.md) as a review lens, not archived — see the archive's own rotation note._

_Parked / deferred backlog — full detail (owner, rationale, repro) relocated to **[deferred-backlog.md](docs/progress/deferred-backlog.md)** to keep this tracker scannable; titles + pointers kept live below._

- 📦 **Parked backlog — 27 items**, index and full detail (owner, rationale, repro) → [deferred-backlog.md](docs/progress/deferred-backlog.md)

