# PROGRESS.md — Live Project State

> **Live state only.** Two things live here: **§ Phase Status** (rows not yet complete) and
> **§ State** (remote facts awaiting a concluding event). Everything else has one home — the
> table in [docs/INDEX.md](docs/INDEX.md) § Where a line belongs; units in
> [docs/features/INDEX.md](docs/features/INDEX.md). Gates 7 and 13 red on a retired section
> that comes back (ADR [0186](docs/decisions/0186-documentation-consolidation-one-home-per-fact.md)).

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
