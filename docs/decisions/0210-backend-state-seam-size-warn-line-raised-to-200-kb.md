# ADR 0210 — The backend-state seam size warn line is raised to 200 KB (hard cap 250 KB)

**Status:** Accepted (PO ruling 2026-09-12, unit `DEFINER-UNDECLARED-CLASS-REMEDY`)
**Area:** docs / lint gates (gate 16, `scripts/check-backend-state.mjs` check D)
**Amends:** 0196
**Related:** 0198, 0186

## Context

ADR 0196 D4 split the backend surface map into seam files and gated each file's size: warn at
**160 KB**, FAIL at **200 KB**, with the remedy stated as *"never to raise the cap, never to open a
phase-named overflow file, and never to delete a posted section — it is to find the seam inside the
file that wants its own home"*. At the split the largest file, `authorization-and-audit.md`, was
114.6 KB. Since then every AUTHZ unit has appended a frozen slice to that one file (ADR 0198's
append-slice / replace-current-state shape), and on 2026-09-12 unit `DEFINER-UNDECLARED-CLASS-REMEDY`
appended one more, taking it from 157.1 KB to **163.2 KB** — the first crossing of the warn line.
Gate 16 printed `WARN — [D] … 163.2 KB is over the 160 KB warn line (cap 200 KB). Plan the next
seam.` and exited 0.

## Problem

The warn fired on a file that is still 37 KB under its hard cap, in the middle of a remediation
program that appends to this seam at roughly 5–6 KB per unit. A warn that fires every unit for the
next six or seven units, each time with the same *"plan the next seam"* remedy, becomes a line the
lead reads past — which is the failure mode ADR 0196 D4 was written to avoid. The alternative D4
names, splitting the seam, is real work with its own risk (a move rebases every relative path in the
moved text; LEARN-090) and the PO does not want it scheduled inside a follow-up-fix unit.

## Decision

1. **The warn line moves from 160 KB to 200 KB.** `WARN_BYTES = 200 * 1024`.
2. **The hard cap moves from 200 KB to 250 KB** so that the warn stays a warn — a warn line equal to
   the cap would make check D red before it could ever warn. The 50 KB headroom keeps the ratio D4
   chose (warn at 80 % of the cap).
3. **D4's remedy sentence is unchanged and still binding**: an over-cap file is never fixed by raising
   the cap again, never by an overflow file, never by deleting a posted section. This ADR is a
   one-time re-basing of the thresholds by explicit PO ruling, and the ruling's scope is these two
   numbers. A second raise needs a second ADR.
4. **The carriers move together**: the script header comment (check D), `docs/backend-state/README.md`
   § Maintenance rules 4, and `docs/lint-gates.md` gate 16, in the same commit as the constants.

## Considered options

- **Split `authorization-and-audit.md` now** (D4's named remedy). Rejected for this unit by the PO:
  a seam split is a unit of its own, not a Record-step side effect, and the file's next natural seam
  (the DEFINER `search_path` family: `419`/`420`/`421`/`414` slices) is still being written to.
- **Silence check D for this one file.** Rejected: an escape hatch for one file silences the
  measurement for every file (an escape hatch for the unmeasurable also silences the measured).
- **Raise the warn line to 200 KB and leave the cap at 200 KB.** Rejected: warn ≥ cap makes the warn
  unreachable; the gate would go straight from silent to red.
- **Raise both (chosen).**

## Consequences

- `authorization-and-audit.md` at 163.2 KB is under the new warn line; gate 16 is quiet again. ⚠ The
  file is still the largest seam and still grows per AUTHZ unit; at the current rate it reaches
  200 KB in roughly six units, at which point D4's remedy — a split — is due, and this ADR does not
  pre-authorise a further raise.
- The follow-up `DEFINER-UNDECLARED-CLASS-REMEDY` would otherwise have filed for the warn is NOT
  filed; this ADR is the disposition.
- ADR 0196 D4's numbers are superseded by this ADR's; its remedy sentence stands. The generated
  back-pointer banner in 0196 records the amendment (`npm run adr:index`).
