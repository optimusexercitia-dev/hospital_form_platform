# FUP-MOJIBAKE-GATE-BLIND-TO-UNTRACKED-FILES — a brand-new file is in no `ls-files` set, so gate 10 passes it vacuously (owner: backend)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-02 · status open

> `scripts/check-mojibake.mjs:144` sources its file list from `git ls-files`. That lists the
> **index**, so a *staged* file is covered — but an **untracked** one is outside the gate's domain
> entirely. The blind window is therefore "authored but never `git add`-ed", which is **exactly the
> state a phase's new files are in when `npm run lint` runs at Phase Gate step 1.**
>
> **Measured 2026-08-25 (PDF·P3).** `lint:mojibake` printed
> `OK (self-test passes; 2825 tracked text files clean)` at exit 0 while **four artifacts of the phase
> being gated** were not in the 2825: ADR [0144](../decisions/0144-case-printing-dossier-lock-and-phi-fork.md)
> (496 lines), [case-printing-p3.md](../plans/case-printing-p3.md) (218),
> [case-printing-p3-substrate.md](../plans/case-printing-p3-substrate.md) (329) and
> `e2e/pdf-printing-cases.spec.ts` (1183) — **2,226 lines**. Scanned separately by importing the
> module's own `hasMojibake` (positive control fired on a known-corrupt line; negative control clean on
> valid pt-BR): **0 hits**. So the files are clean — but they were clean **unproven by the gate whose
> green line reads as having checked them.**
>
> ⭐ **Same structural shape as ADR [0079](../decisions/0079-authz-door-blindness-standing-invariant.md)
> Amendment 3** — *"a brand-new gate is in no BLIND set, so it passes `ARM=policy` vacuously."* Here a
> brand-new **file** is in no `ls-files` set. In both, the thing most likely to be wrong is the thing
> the domain excludes.
>
> ⚠ **The direction is the hazard.** The gate is blind precisely at authoring time — when a fresh
> shell round-trip is most likely to have corrupted the bytes — and ADR
> [0143](../decisions/0143-mojibake-gate-double-encoded-utf8.md) records that the corruption **COMPOUNDS**
> per repeat. A layer added while the file was untracked is already permanent at first commit; the
> gate then starts watching a file it can no longer save.
>
> **Suggested fix:** union the list with `git ls-files --others --exclude-standard`. ⛔ **Prove it can
> fire** — red the new arm on a deliberately corrupted *untracked* file before trusting it, or the fix
> is the same vacuity one level along.
>
> **Owner:** `backend`.

---
