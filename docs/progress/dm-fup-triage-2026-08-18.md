# DM follow-up triage — 2026-08-18 (session narrative, rotated)

> Rotated verbatim from `PROGRESS.md` on 2026-08-18 during the live-state restructure
> (link prefixes mechanically rewritten for this directory: `](docs/progress/` → `](`,
> `](docs/{decisions,plans,reviews}/` → `](../{decisions,plans,reviews}/`; nothing else
> edited). The *live residue* of these blocks — next actions, held migrations, the
> "must not trip over" facts — was distilled into `PROGRESS.md § Now`; the rulings are
> one line each in `PROGRESS.md § Decisions`; C1/C2 live in `PROGRESS.md § Critical
> FUP`. This file preserves the full narrative and its lessons.

## 🛑 START HERE — **DM5's seven decisions are ANSWERED; a DM FOLLOW-UP TRIAGE then ruled eight more and shipped four. Both blocks below are live.**

> ## ⭐ LATEST — DM follow-up triage, 2026-08-18 (read this before the DM5 block)
>
> The 18 open DM follow-ups were grouped and triaged. **Eleven rulings** — § Decisions, the
> `DM-FUP TRIAGE #N` rows — and **five items built and gate-green**. ⚠ *There were 18, not 17:*
> `FUP-DM5-SETLOCAL-MIGRATION` had a body and five doc mentions but **no index line**, so `grep`
> could not see it and the next rotation would have dropped it. It has one now.
>
> **✅ Shipped** — `BYTE-PROOF-NOT-ATTEMPTED` · `ATTACHMENTS-MODULE` (⚠ `actions.ts` only —
> `constants.ts` is live) · `DVF-FILEOBJ` (`20260928000600`) · ⬛ **`DANGLING-PRINT` CLOSED**
> (`20260928000700` prevention **+ `20260928000800`** widening/race — ADR 0123) · ⬛ **`SETLOCAL-MIGRATION`** — `lint:set-local`, the **6th** lint gate, validated
> against Postgres's own `25P01` ground truth (4 files / 6 sites, line numbers included).
> Gates: pgTAP **194f/6397** · lint **6/6** · tsc 0 · vitest **1305** · 4 authz ARMs HOLD.
> ⛔ **`e2e:prod` NOT run.** All work is **committed** (8 commits, `main`, **unpushed**).
>
> ## ⛔⛔ THE BIG ONE — THE PRODUCTION DB IS EMPTY, AND IT WAS RESET ON 2026-08-17 11:37:35Z
> Read-only census + logs. Head `20260928000500` / 411 migrations; **every table 0 rows**, `auth.users`
> 0, all **4** buckets (was 12 — S4's retirement IS deployed) hold **0 objects**. Log signature:
> `CREATE TABLE IF NOT EXISTS schema_migrations` → all `CREATE EXTENSION` → migrations from `20260711…`
> **re-applied** (old migrations only re-run on an empty history table; a `db push` skips them).
> ⭐ **It EXONERATES everyone and indicts the RECORD: the reset preceded TRIAGE #6 by ~14 h, so #6 was
> ruled on STALE FACTS** — it sequenced "reset last, it would destroy the surface" against a remote where
> that surface was already gone. 🔴 **`storage.objects` 96 ins / 47 del / 0 live ⇒ ~49 objects vanished
> with no DELETE**, bytes likely orphaned (CLI-version dependent), unenumerable. Census + deriving
> queries: `docs/backend-state.md` § REMOTE CENSUS 2026-08-18.
>
> **⛔ Three things a next session must not trip over:**
> 1. **`20260928000600`/`…000700` are HELD, not blocked** (TRIAGE #11). The census lifted the *safety*
>    bar — 0 rows, 0 duplicate groups, so `UNIQUE` applies cleanly — but `e2e:prod` has not run and the
>    remote is empty, so there is no drift pressure. *A bar lifting is not a reason to act.*
> 2. ⬛ **`DANGLING-PRINT` is now CLOSED (2026-08-18, ADR
>    [0123](../decisions/0123-discarding-a-draft-that-has-emitted-documents.md), `20260928000800`)** —
>    and this row's own warning was right twice over. The guard alone *was* a partial fix, and re-deriving
>    it found **two more defects the item never named**: the `active`-only predicate opened on
>    `superseded` (a live page by ADR 0120 D6/D8), and the mint read its source **unlocked**, so a
>    concurrent discard raced the guard (**measured**: orphan created). Both remainders are answered —
>    orphans **by measurement** (0 local, 0 remote; the "6 of 9" figure was E2E residue in a since-reset
>    DB), the securable **by recorded semantics** (D5: deleting it would revoke the print's only
>    disposition authority). ⚠ **A THIRD defect was found and NOT fixed here** — a draft print is
>    invisible to every coordinator but its creator → `FUP-DM5-DRAFT-PRINT-INVISIBLE-TO-COORDINATION`.
> 3. **`C1` is now `C1a` (local) + `C1b` (Cloud)**, and **the pilot bound is C1b** — the runbook says
>    a local rehearsal cannot exercise the Cloud paths.
>
> **▶ Next, in order:** the **Cloud constructed-orphan probe** (needs S3 keys minted in the dashboard;
> it settles FIVE items — and **`PRODROW` now blocks on it** by PO ruling, with ~49 real likely-orphaned
> objects as its subject) → **C1a** →
> **C2 Tier 1 sizing** (which now absorbs `Q1-OPEN-BYTES-CUT` and `SIBLING-GUARD-DIFF`).
>
> ⚠ **Two lessons from this batch that cost real rounds.** A ruling was **withdrawn before
> implementation** because the follow-up's own option list carried a justification ADR 0104 D7 had
> already refuted — *an option list is an assertion, and one authored inside its item is the least
> likely to be re-derived.* And this batch's own migration shipped a **PUBLIC-executable
> `SECURITY DEFINER`** function, caught by pgTAP `320` U1 at **237→238** — invisible in the diff, in
> review, and in a fully green `312`.

## 🛑 DM5 gate step 4 — the seven PO decisions: ✅ **ALL ANSWERED 2026-08-18** (docket discharged)

> Full docket rotated 2026-08-18 → **[dm5-po-decisions.md](dm5-po-decisions.md)**.
> Rulings are one line each in § Decisions (the `2026-08-18` rows); verbose forms in
> [decisions-log.md](decisions-log.md).
>
> ⛔ **DO NOT READ "ANSWERED" AS "DONE".** Two rulings created obligations that outlive the
> phase and stay live in **[§ Critical FUP](#-critical-fup--the-must-not-be-forgotten-list)**:
> **C1** the PHI-disposal runbook must run end-to-end **before any real patient record is loaded**
> (the pilot risk acceptance is *bounded by that rehearsal*), and **C2** Tier 1 of the 407-door
> sweep is **sized but not counted**.

## PROGRESS.md § State as it stood at rotation (2026-08-18)

> Rotated verbatim from `PROGRESS.md` on 2026-08-18 (same restructure as the blocks
> above; no link transform was needed — the block contains no relative markdown
> links). Its concluded measurements live in `docs/backend-state.md` § REMOTE CENSUS
> 2026-08-18; its standing rules moved to § "Remote discipline — standing rules"
> there; only the three still-live facts remain in `PROGRESS.md § State`.

## ⛔⛔ State — re-measured **2026-08-18**. This block has now gone stale THREE times; measure, never quote.

_(It has twice carried a confident falsehood in the line a new session reads to decide whether the
remote is safe to touch — first "NOT pushed, no `db push`" when both were done, then "0 ahead /
local-only: NONE" while commits and migrations accumulated. →
[[a-records-claim-about-an-external-system-goes-stale-silently]])_

| fact | measured **2026-08-18** | how |
|---|---|---|
| branch / git push | `main`. ✅ **Pushed to `origin/main` 2026-08-18 through `1a15391f`** (the rotation commit). ⛔ **This row states no live count** — any number here is false at the next commit, which is how it has gone stale three times. **Re-measure:** `git rev-list --count origin/main..HEAD` | measured, never quoted |
| `db push`? | ✅ through **`20260928000500`**, **411** applied | `supabase_migrations.schema_migrations` |
| local-only migrations | ⚠ **2** — `20260928000600` (DVF unique) · `20260928000700` (active-print guard). **HELD, not blocked** (TRIAGE #11). ⛔⛔ **A GIT PUSH IS NOT A `db push`** — the 2026-08-18 git push did **NOT** put these on the database; the remote is still at `20260928000500` | `ls` vs `schema_migrations` |
| 🔴 remote DATA | **EMPTY** — every table 0 rows, `auth.users` 0, **0** storage objects in all **4** buckets | census → `docs/backend-state.md` |
| 🔴 why | **A REMOTE RESET AT `2026-08-17 11:37:35Z`** — `CREATE TABLE IF NOT EXISTS schema_migrations` → all `CREATE EXTENSION` → migrations from `20260711…` **re-applied**. No `TRUNCATE`/`DROP SCHEMA` in the window | `query_logs` |
| remote buckets | **4** (was 12) — the 8 legacy buckets are **GONE**; S4's retirement IS deployed | `storage.buckets` |
| recusal PHI fix | ✅ **LIVE** — `prosecdef = t`, `can_read_case` in the body read from `pg_get_functiondef` | `pg_proc` |
| DM flags | local **all six ON** (from `seed.sql`); **shipped OFF** — `db push` never applies the seed | flag table + remote read |

⛔ **THE CONSEQUENCE THAT SURVIVES:** applied migrations may **NOT** be edited in place — that is the
drift that blocks a future `db push`. **Nothing at or below `20260928000500` may be touched.** The
editable window did not move forward; it closed.

⚠ **"Flags ship OFF" is NOT a security boundary.** ✅ The load-bearing half is re-verified 2026-08-18:
**ZERO RLS policies read a flag** (0 rows over `pg_policies` matching
`feature_flag|documents_wave|documents_foundation|document_printing|assert_document`). The conclusion
stands on that half alone — it is an **app-layer** gate. ⛔ The function-count half is **CONTESTED**:
**6 of 75** document functions read a flag (the DM5 phase QA + `docs/backend-state.md`, independently
reproduced) — *not* the "51 of 52" this block carried for weeks. ⭐ **The figures disagree because each
uses a different BOUND, not because one is a typo** → [[enumeration-boundary-is-a-syntax-not-a-property]];
whoever re-derives it **states the predicate beside the number**.

⭐ **The load-bearing reason the remote is safe today is that it holds no data and no users** — a
stronger reason than any flag argument, and one that **expires the moment the pilot loads data**.
