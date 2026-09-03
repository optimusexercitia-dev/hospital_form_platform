# FUP-ACTIVE-PHASE-STASHED-OVERRIDE-IS-INVISIBLE — the write succeeds and nothing shows it (owner: backend; filed 2026-08-22 from the phase-result widening)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-22 · status open

On an **active** phase the door *stashes* the override (no recompute — that is the documented difference
between the `set` and `correct` kinds). But `getCaseDetail` does **not** select `result_override_id`;
only `getCasePhaseForFill` does. So after a successful save: **no badge renders, and reopening the
dialog shows no pre-selection.** The write landed; the surface cannot show it.

⚠ **Mitigated with copy, not fixed** — the dialog now says the choice *"fica guardado e passa a valer
quando a fase for concluída"*. The data gap is real and is a query-layer change (`src/lib/queries/`),
which is backend's.

⭐ **It produced a false defect report during the build**, which is the reason it is worth a line: a
first-draft assertion demanded a result badge after a successful `set`, so a **correct save read exactly
like a live defect**. Caught only by checking the catalog instead of believing the UI —
[[a-wrong-matcher-reads-exactly-like-a-live-defect]].

**Cosmetic, same area:** `PhaseResultCorrectButton` now renders *"Definir resultado"* as well, so its
name is a misnomer. One import site.
