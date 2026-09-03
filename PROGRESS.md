# PROGRESS.md — Live Project State

> **LIVE STATE ONLY — the roll-up.** Two things live here and nothing else: **§ Phase Status**
> (the phase rows not yet complete) and **§ State** (the remote facts still awaiting a concluding
> event); live feature state is a pointer, not a copy — see
> [docs/features/INDEX.md](docs/features/INDEX.md) (ADR
> [0186](docs/decisions/0186-documentation-consolidation-one-home-per-fact.md) D1–D2). Everything
> that used to accrete here has a gated home (ADR [0185](docs/decisions/0185-documentation-restructure-feature-hubs-and-gated-registers.md)
> D6): the working state of a unit → its hub `docs/features/<code>.md`, listed in
> [docs/features/INDEX.md](docs/features/INDEX.md) · bugs → [docs/bugs/BUGS.md](docs/bugs/BUGS.md) ·
> follow-ups, the ⭐⭐ Critical list included → [docs/followups/follow-ups-open.md](docs/followups/follow-ups-open.md) ·
> decisions → [docs/decisions/INDEX.md](docs/decisions/INDEX.md) · gate results and QA verdicts → the
> owning hub and its review file. **A retired section that comes back reds `npm run lint:progress`.**
> What the retired sections said on the day they were cut is preserved verbatim in the
> `docs/progress/` archives (2026-09-03).
>
> **The contract lives elsewhere, deliberately** — judgment in
> [progress-contract.md](.claude/rules/progress-contract.md), mechanics in
> `npm run lint:progress` (gate 7) and `npm run lint:registers` (gate 13), and **those scripts are
> the authority**. Restating a check here creates the second copy that drifts, which is what this
> file has been recovering from since 2026-08.

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
| DLB | **Deliberation & Voting Model** [0115](docs/decisions/0115-deliberation-and-voting-model.md) ([plan](docs/plans/deliberations.md)) | 🔜 planned — state in its [hub](docs/features/dlb.md) | – | – | – | ⛔ **not ratified** | – | taken |

**Live feature state:** [docs/features/INDEX.md](docs/features/INDEX.md) — generated from hub
frontmatter, sorted in-progress first (ADR 0186 D1–D2).

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
| ⚠ **Remote storage byte-loss is UNQUANTIFIED — the "~49 vanished" figure is WITHDRAWN 2026-08-18.** `n_tup_ins − n_tup_del` compares two units: 5 uploads move `ins` by **+6**, 5 deletes move `del` by **+5** (measured). And by the probe below, any surviving bytes are **unobservable** anyway | a magnitude re-derived from something other than the `pg_stat` counters — or PO ruling that it cannot be ([FUP-DM4-PRODROW](docs/followups/follow-ups-open.md)) |
| ⛔ **CORRECTED 2026-08-21 — the remote holds the E2E SEED FIXTURE, not nothing.** This row said *"it holds no data and no users"* (census 2026-08-18). **Measured 2026-08-21 against the linked project: `auth.users` = 36, all `@test.local`, created 2026-08-19 — i.e. AFTER that census; 0 non-test accounts; 1 pre-promoted `platform_admin`; `cases` 10, `responses` 17; synthetic PHI `patient_identifiers` 2 / `event_patient` 3 / `referral_patient` 3.** ⭐ **No real customer data** — so the *conclusion* (safe to touch) survives; the *premise* did not, and the premise is what other decisions were resting on. ⚠ This is the **fifth** time a claim about the remote has gone stale in this file. ⛔ **Re-measure `auth.users` and `schema_migrations` before citing this row — never quote it.** | **expires at pilot data-load**, when it must be REPLACED by the rehearsed C1b disposal bound (Critical C1, pinned at the top of the follow-up register), never just deleted |
