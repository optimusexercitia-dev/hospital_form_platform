# FUP-ROTATION-BREAKS-LINKS — **every §6-step-5 rotation silently 404s its own links; 474 are broken today** (owner: lead)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-17 · status parked

Filed 2026-08-17 (lead), **measured, not inferred** — a link-resolution sweep over the four rotation
destinations after this pass's own rotation.

**The mechanism, and it is structural rather than careless.** PROGRESS.md sits at the **repo root**,
so its links are root-relative (`](docs/decisions/0120-….md)`). Every rotation destination lives in
**`docs/progress/`**. The §6 step-5 protocol says to preserve the block **verbatim** — and a verbatim
copy of a root-relative link **404s from one directory down**. ⛔ **The protocol's own correctness
requirement is what breaks the links.**

**Measured, per destination** (broken relative links, excluding this pass's appends, which were
repointed):

| destination | broken |
|---|---|
| `phase-status-archive.md` | **167** |
| `qa-verdicts-archive.md` | **154** |
| `decisions-log.md` | **144** |
| `dm5-wave-d-retirement.md` | **9** |
| **total** | **474** |

⭐ **Why this is worth a follow-up and not a cleanup commit.** These files are the *destination of
every rotation* — the place the live file points a reader when it says *"detail lives in the
record."* A 404 there means the rotation **moved the text out of reach while reading as though it
archived it**, which is the same shape as this phase's dominant class: an action performed
(*rotated*) recorded as the state achieved (*preserved and reachable*).
→ [[a-records-claim-about-an-external-system-goes-stale-silently]]

⚠ **This pass reproduced the defect before catching it** — 77 fresh broken links across three
archives, found only because a link check ran *after* the rotation rather than being part of it.
They are fixed (`](docs/…)` → `](../…)`); the 474 above are the pre-existing backlog.

**Remedy, in order of value:**
1. ⭐ **Make the transform part of the rotation recipe** in `docs/lead-playbook.md` §§4–5 — one
   `](docs/` → `](../` pass after the append, *before* the cut. Cheap, and it stops the growth.
2. A one-off sweep to repair the 474. ⚠ **Mechanical but not blind** — a few links legitimately point
   at root files (`CLAUDE.md`, `PROGRESS.md`) and need `../../`, so the transform is two rules, not one.
3. ⛔ **Do NOT "fix" this by rewriting links in PROGRESS.md itself** — they are correct *there*. The
   defect belongs to the copy, not the source.

⚠ **The verification claim needs the same care.** Four rotation headings in this pass originally read
*"preserved byte-for-byte, `cmp`-verified"*, which stopped being true the moment the links were
repointed. All four now state exactly what holds: **prose verbatim, link targets repointed.**
*An almost-true verification claim is the thing this whole register exists to catch.*
