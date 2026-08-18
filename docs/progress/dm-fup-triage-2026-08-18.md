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
