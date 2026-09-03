# FUP-BULK-GRID-MODEL-IMPORTS-UPWARD — a `src/lib` → `src/components` dependency no gate can see (owner: frontend)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-02 · status open

> `src/lib/cases/bulk-grid-model.ts:22` imports `CustomFieldValueDraft` from
> `@/components/cases/custom-field-input` — a real **`src/lib` → `src/components`** dependency, the
> layering inversion F3 and F4 exist to remove.
>
> ⚠ **It is an `import type`, so it erases at build and NOTHING can report it.**
> `lint:client-server-imports` checks **value** imports only, by design; `tsc` is satisfied because
> the type resolves; nothing at runtime is affected. So the inversion is real, permanent, and
> invisible to every gate in `npm run lint`.
>
> ⛔ Do not "fix" it by widening `lint:client-server-imports` to type imports — that gate exists for a
> different defect (a client value-import from a server query module **aborts `next build`** while
> tsc/lint/vitest stay green) and widening it would blur what a red from it means.
>
> **Fix:** the F3/F4 shape — the type belongs in `src/lib/cases/types.ts`, with the component
> re-exporting if it needs the name. Unrelated to printing; found while censusing for F4.
> **Owner:** `frontend`.

---
