# FUP-CASE-NUMBER-FORMAT-HAS-EIGHT-AUTHORITIES — `padStart(4,'0')` is reimplemented at 8 sites (owner: frontend)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-02 · status open

> `formatCaseNumber` (`src/components/cases/format.ts:10`) is the intended canonical zero-pad, but the
> rule is **reimplemented inline at 7+ further sites that never call it**:
> `itens-de-acao/[itemId]/page.tsx:262,276` · `nsp/[eventId]/page.tsx:131` ·
> `action-items-table.tsx:334,367` · `interviews/format.ts:33,38` · `meetings/action-item-form.tsx:49`.
>
> ⚠ **Why it is filed rather than folded into PDF·P3:** moving `format.ts` down to `src/lib/cases/` so
> the dossier can use it (the F4 move) makes the printed record consistent with **one of eight**
> implementations. That is a real improvement and it is **not** single-authority — and describing the
> move as "the dossier now uses the canonical formatter" would over-claim exactly the way a partial fix
> reads as a complete one.
>
> Surfaced by PDF·P3: the dossier printed `Caso 1` while the app and the mint dialog printed `Caso 0001`
> — and page 5 of that same PDF carried a user-authored interview titled *"Entrevista sobre o Caso
> 0001"* directly beneath a header reading *"Caso 1"*. Both forms, one page.
>
> **Fix:** repoint the seven inline sites at the shared formatter, then keep new ones out. ⛔ A ninth
> `padStart` is the failure mode, not the eight existing ones. **Owner:** `frontend`.
>
> ⛔ **TWO TRAPS FOR WHOEVER PLANS THIS SWEEP — added 2026-08-25, both measured.**
>
> **1. One of the eight is NOT substitutable.** `src/components/referrals/format.ts:18` defines its own
> `formatCaseNumber` with a **different signature** — `(n: number | null | undefined)`, returning
> `"—"` on null. Repointing it at the shared formatter **changes its null behaviour**, so this entry
> needs a null-handling decision, not a find-and-replace. A mechanical sweep that treats all eight as
> duplicates will silently change what a referral renders for an absent case number.
>
> **2. `formatCaseNumber` is a PREFIX of `formatCaseNumberWithTerm`**, so a naive search for the short
> name matches both and double-counts — measured live during F4, where the first extractor reported
> "NOT A PURE MOVE" for exactly this reason before being anchored on the `(`. Same family as the
> `\y`/`_for` trap that has cost this repo two sweeps: **the boundary is a property, not a syntax.**

---
