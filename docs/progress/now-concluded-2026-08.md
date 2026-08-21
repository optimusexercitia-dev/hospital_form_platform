# § Now — concluded bullets, rotated 2026-08-21

Moved **verbatim** out of [PROGRESS.md](../../PROGRESS.md) § Now at the DSR
operational-remediation Record step, under the §7 live-state discipline: both bullets describe work
that **merged and was recorded** days earlier, and their own narratives had already been rotated —
what remained in § Now was a summary of a summary, costing ~3.8 KB in a file whose gate hard-fails
at 80 KB (it stood at 77.5 KB).

> ⛔ **The `cmp` inverse-transform check prescribed by the rotation rules DOES NOT APPLY to this
> move, and saying so is the point.** That check assumes **one** source prefix. These bullets carry
> **two** — `](docs/decisions/…)` and `](docs/progress/…)` — which the rewrite collapses onto
> `](../decisions/…)` and `](…)` respectively. No single inverse can distinguish them, so an inverse
> `cmp` **fails on correct output**, and "make the cmp pass" would mean corrupting a link.
> **Verified by the property the check exists to protect instead: every rewritten link RESOLVES from
> `docs/progress/`.** 5 of 5 OK. ⚠ A mechanical check quoted outside the conditions it assumes is
> [[a-predicate-quoted-at-the-wrong-grain]] — name what you verified, not which ritual you ran.

---

- **✅ CONCLUDED 2026-08-19 — the `Imprimir prévia` / `Emitir documento` split** (ADR
  [0125](../decisions/0125-previa-ephemeral-and-emission-registered.md) +
  [0126](../decisions/0126-print-series-and-derived-currency.md)): shipped, QA **APPROVED** r2,
  **merged and pushed** (`9ed197d5`), branch gone. A locked source yields a registered emission; an
  editable one an **ephemeral prévia** — and the **door** enforces it, not the UI. ⭐ Its lesson,
  kept here because it is not print-specific: *a keystone proves the DOOR works and says nothing
  about whether the ACTION can reach it — the test is a **second caller**, and a second caller can
  satisfy a door the real one cannot even open.* ⚠ ADR 0126 **Amdt 1** carries eleven findings,
  **four of them corrections to claims the ADRs state AS MEASURED**. Full narrative rotated
  2026-08-20 → [previa-split-2026-08-19.md](previa-split-2026-08-19.md); residue
  (commission-level cascade path; `case`/`interview` lock declarations, 0126 D7) stays open there.
- **✅ SHIPPED 2026-08-19 — the documentation-stability refactor** (ADR
  [0127](../decisions/0127-standing-rules-home-and-staleness-gate.md); ADR
  [0124](../decisions/0124-progress-live-state-contract.md) **Amdt 1**). This file
  **56.6 KB → 40 KB**. Standing rules moved to `.claude/rules/` — **4 admitted, 5 of 9
  rejected** (already gate-enforced, dead anchor, or no tight glob). `lint:rules` is
  **gate 8**; `lint:progress` gained cell/bullet shape caps and now link-checks the
  rotation destinations, which immediately found **41 links already broken** in two of
  them plus 3 orphaned anchors.
  ⛔ **The premise the refactor was proposed on was FALSE** — this file is **not** loaded
  by any spawn and never was (no `@`-import has ever existed). Always-loaded is
  CLAUDE.md 32 KB + MEMORY.md 20 KB, so cutting *this* file buys nothing at session start.
  ✅ **MEASURED 2026-08-19 — rules FIRE.** A fresh session touched PROGRESS.md and the probe
  logged `RULE · progress-contract.md · reason=path_glob_match · globs=PROGRESS.md,docs/progress
  · trigger=…\PROGRESS.md`. The feature flag is on; the earlier non-load was the mid-session
  creation, as hypothesised. The CLAUDE.md §8 intake line is **unblocked** (ADR 0127 Amdt 4).
  ✅ **Confirmed twice, incl. a SOURCE glob** (ADR 0127 Amdt 5): a fresh `claude -p` session
  reading `src/lib/queries/responses.ts` loaded `answer-maps.md` by `path_glob_match`. That is
  the case the §8 intake rests on — standing lessons are discovered in source, not in the
  tracker. ⚠ **Bounded: fresh sessions 2/2 fired; the resumed session that built this 0/3.**
  Unexplained, not guessed at. A rule is a strong hint, **never a substitute for a gate**.
  ⭐ Incidental: every `session_start` entry names exactly **two** files — user CLAUDE.md and
  project CLAUDE.md, **no PROGRESS.md**. The harness independently confirms ADR 0124 Amdt 1.
  ✅ **`.claude/rules/` now has a COMPLETE lifecycle** — intake (CLAUDE.md §8, unheld once
  firing was measured), staleness gate, volume bounds, and a **conditional** exit. ⛔ The exit
  is conditional for a reason: **nothing reads `rules-archive.md`**, so retiring a rule that is
  still true and enforced nowhere deletes the lesson, and `lint:rules` goes green either way.
  "Too broad but still needed" is **not** a retirement — it is a gate waiting to be built, or
  content that belongs in CLAUDE.md (ADR 0127 Amdt 2).
  **Filed, not built:** the 42501 gate (15 `throws_ok` sites) · staleness **domain (b)**,
  the docs that make claims about repo mechanics · MEMORY.md compaction (19.6 / 24.4 KB) ·
  a CLAUDE.md context program — the file where cutting bytes actually pays.
