# FUP-PROGRESS-INDEX-LINES-HAVE-OUTGROWN-THE-CONTRACT — the de-duplication pass ran; 23 PARTIAL lines remain (owner: lead)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-29 · status open

> ## ⭕ DOWNGRADED 🟡→🟢 2026-08-31 — THE DE-DUPLICATION PASS RAN
>
> **What was done, and how it was bounded.** Every over-400-byte index line was classified by
> whether its distinctive claims (backticked spans + figures) already appear in its own body
> section here: **NO-BODY 0 · FULLY-CARRIED 55 · PARTIAL 23**. Only the 55 FULLY-CARRIED were cut,
> to `severity · id · title-clause · body pointer · owner` — the form the section header already
> mandates. ⛔ This was **de-duplication, not compression**: nothing was cut that the body could
> not be shown to carry, which is the distinction the original filing insisted on.
>
> **Result (re-derive, never quote):** index lines **117** (unchanged — nothing was dropped),
> over-400 **78 → 23**, excess **~20.0 KB → ~9.1 KB**, `PROGRESS.md` **96,352 → 76,629** bytes,
> **under the 81,920 target for the first time since this was filed**.
>
> ⚠ **Two verification findings worth keeping**, both caught by diffing markers rather than trusting
> the pass: (1) a bare `FUP-P3-` "lost name" was a **glob in prose** (the prose reads *"two `FUP-P3-*`
> are findable"*), not an item; (2) **4 inline severity markers vanished** — they were
> **severity-downgrade records** (`🔴→🟠`, `🟠→🟡`) with "still open" residue clauses attached.
> Both were verified present in their own body sections before the cut was accepted. ⭐ A marker
> census across the edit is a cheap detector for exactly this class and is why the loss was looked
> at rather than assumed benign.
>
> ⛔ **NOT CLOSED. The remaining 23 are PARTIAL** — each carries at least one fact that appears
> **only** in the index line. For those the work is **move the fact into the body, THEN cut** —
> a two-step per item, and the step order matters: cutting first destroys the only copy.


> Filed 2026-08-29 at the Record step, from a size warning that could not be discharged by
> rotating concluded material — because nothing concluded was left.
>
> **Measured** (`PROGRESS.md`, **re-derived 2026-08-31**, re-derive rather than quote): **116** OPEN
> index lines holding **59,501 bytes** — mean **513**, median **521**, max **1,699**. **76** exceed
> 400 bytes, and those 76 alone carry **~18.4 KB** above a 400-byte form. The file is **~89,000**
> bytes against an **81,920** target (hard cap 102,400), so the surplus is entirely inside a
> population that rotation cannot touch.
>
> ⛔ **The 2026-08-29 filing read 108 lines / 53,419 bytes / 70 over / ~15.5 KB / 88,209-byte file.**
> Every term moved in **two days** and the item's own headline carried the stale pair; the median
> and max did not move at all, so the growth is **new lines**, not existing ones fattening. ⚠ The
> file-size term is the trap the rest of this repo already names: a byte count written inside the
> commit that changes the file is off by construction, which is why it is given to the nearest
> thousand here and the **share** (~65% of the file) is the figure to argue from.
>
> ⛔ **THE TENSION, STATED PLAINLY.** The lead-playbook §5 says PROGRESS.md carries a *"one-line
> index only (severity · id · title · owner)"*. It ALSO says *"NEVER compress or drop an OPEN
> index line at any file size"*. Most lines have drifted into the first rule's violation, and the
> second rule forbids the obvious remedy. Both rules are right: the second exists because
> compressing under cap pressure cuts qualifiers first, and the qualifier is the half that
> carries the bound.
>
> ⭐ **The resolution is DE-DUPLICATION, which is not compression.** Where an index line's detail
> is *already in its body*, moving it out loses nothing — the body is where the contract puts
> detail. Three lines were done this way at this Record step (`FUP-DIFF-SCOPED-SWEEP-IS-HALF-AIMED`,
> `FUP-E2E-ABSENT-ROW-ASSERTIONS`, `FUP-AE2-CATALOG-SUPERSET-OF-CHAIN`), recovering **4,214 bytes**
> with every fact verified present in the body first.
>
> ⛔ **AND THAT VERIFICATION IS THE WORK — it cannot be skipped or batched.** On those same three,
> a first pass flagged two facts as missing from the body; both were false alarms from a
> case-sensitive matcher. ⚠ Had the check been trusted in the other direction — assumed present
> without looking — a bound would have been deleted from the only place it existed. So: **70
> items × one verification each**, not a regex sweep.
>
> **Owed:** a dedicated pass (not a Record-step side effect), item by item, cutting from the index
> ONLY what the body demonstrably carries. ⚠ A line whose detail exists NOWHERE else is not a
> candidate — it is a body that was never written, and the fix there is to write the body.
