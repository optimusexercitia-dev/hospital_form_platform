# 0198 — A backend seam carries two layers: a REPLACEABLE current state above its append-only history

**Status:** Accepted (2026-09-09)
**Area:** documentation / backend surface map / gates
**Related:** [0078](./0078-authorization-capability-model.md) · [0185](./0185-documentation-restructure-feature-hubs-and-gated-registers.md) · [0186](./0186-documentation-consolidation-one-home-per-fact.md) · [0195](./0195-a-committed-number-needs-one-home-and-a-gated-mirror.md) · [0197](./0197-data-access-registries-are-generated-not-maintained.md)
**Amends:** [0196](./0196-backend-state-split-on-the-module-seam-axis.md) — 0196 split the map onto the module-seam axis and conceded, in its own Consequences, that this fixed the FILING and not the CONTENT: *"A reader of `document-model.md` still replays 12 DM slices in order — but 12, not 53 … The remaining reduction has to come from D5 being used."* That reduction did not arrive by itself, and this decision stops waiting for it: instead of hoping corrections replace slices one at a time, every domain seam gains a second, explicitly REPLACEABLE layer above its frozen history. 0196 D5 is untouched and re-affirmed — the new layer sits above the posted sections, and never rewrites one.

## Context

> ⛔ **This ADR does not delete, edit, reorder or summarise away a single posted section.** Every
> frozen slice is exactly where 0196 left it, byte for byte. What is added is a layer ABOVE them.
> The measurable form of that claim: the work-unit slice count is **57 before and 57 after**.

The split re-filed 742 KB onto the seam axis and gated the shape in six checks, later seven. None of
those checks looks at what a seam file SAYS. Measured at the split commit `e4ac95e5` with
`node scripts/measure-state-layer.mjs e4ac95e5`:

| | at `e4ac95e5` |
| --- | --- |
| `##` sections under `docs/backend-state/` (excluding the router) | **67** |
| …that are date-stamped or unit-coded work-unit slices | **57 (85%)** |
| …that are axis-free statements of current state | **10** |
| files carrying NO axis-free section at all | **8** — of which 7 are seam files and the 8th is the pre-split archive |

Alongside that: ~49 `SUPERSEDED`, ~68 `STALE` and ~17 `HISTORICAL` occurrences, and deployment
verdicts (`NOT PUSHED`, `LOCAL ONLY`, `✅ PUSHED <date>`) frozen into headings written months ago.

So the module was **shallow** in the precise sense: its interface — what you must read to use it —
was nearly as large as its implementation. A caller asking *"what is true about printing right
now"* had to replay three dated slices and apply their supersessions by hand. That is an event log
with no materialised view, and 0196 named it while shipping it.

⚠ **The seven existing checks were not wrong; they were about a different thing.** A/B/C/D/E/F hold
the filing — one preamble, a routed file, a resolving marker, a bounded size, a noun for a name, a
resolving link. A file can satisfy every one of them and still be unreadable as a state document.

## Decision

**D1 — Every DOMAIN seam file opens with a replaceable `## Current state` block.** It is the FIRST
`##` section: a reader must not scroll past history to reach the state. Below it, the frozen slices
are untouched and continue to be appended to under 0196 D5. Two layers, opposite disciplines, in one
file: the top one is REPLACED in place and never appended to; the bottom one is APPENDED to and never
edited. ⛔ A line never moves upward from history into the projection — the projection is written
from the history, not cut out of it.

**D2 — The SHAPE is the hub's; the VOCABULARY is the seam's.** ADR 0186 D3 already settled what a
replaceable state block looks like — one block, a `**Updated:** YYYY-MM-DD` stamp, a fixed ordered
section list, a line cap, replaced every time. All of that is reused, and the cap constant is
IMPORTED from `check-docs-registers.mjs` rather than re-declared, so the number keeps one home. The
five section NAMES differ, deliberately: gate 13's `CURRENT_STATE_SECTIONS` (Objective · Done since
start · In progress · Next · Blockers) describes a unit of WORK over time, and a seam is a SURFACE.
Forcing work words onto a surface would re-import the very axis this layer exists to remove. The seam
sections are **Surface · Invariants · Rollout · Open edges · Where the detail lives**.

**D3 — The projection is CITED when it is written.** The whole layer is a paraphrase of frozen text,
and a paraphrase can invert the sentence it summarises. So each block is drafted against the seam
file with a per-bullet citation map — bullet, source line, and the source sentence verbatim — and a
bullet with no citable source sentence is DELETED rather than softened. ⚠ The citation maps are
session evidence recorded in `docs/progress/backend-state-current-state.md`, not a committed corpus:
a twelfth register nobody maintains would be the drift this directory exists to retire.

**D4 — Exemption is by DECLARED, PROVEN kind — and it is printed and ratcheted.** A file escapes D1
only by declaring itself `⚙ **GENERATED FILE**` (naming both a rebuild command and the gate that reds
on drift) or `⛔ **ARCHIVE**` (naming its live successor). A declaration that names no proof is a
FINDING, not an exemption — the three states are kept apart: exempt-and-proven, domain, and
declared-but-unproven. Every exemption is printed on every gate run, clean or not, and the count is a
ratchet. ⛔ Without this, D1 would be an escape hatch, and an escape hatch for the unmeasurable also
silences the measured.

**D5 — Deployment status is NOT state, and leaves this map.** Whether a migration reached the remote
is a claim about an EXTERNAL system: true for an instant, then silently false. The existing frozen
verdicts STAY where they are — they are dated statements about a moment, which is what history is for
— but a `## Current state` block may not carry one, in either polarity, and the gate reds on
`NOT PUSHED`, `LOCAL ONLY` and `PUSHED` alike. The home for the question is unchanged and already
correct: `conventions.md` § Remote discipline, which carries the re-measure recipes and says
*"Any claim about the remote is a measurement, not a quote."* The state layer names the measurement;
it never records the result.

**D6 — Staleness is gated against the newest heading BELOW, never against a ratio.** A block's
`**Updated:**` stamp may not be older than the newest date in any heading beneath it. That fires on
exactly the thing worth firing on: history was appended and the projection was not refreshed. A
historical/current RATIO — the shape the review suggested — is REJECTED as a gate and kept as a
printed statistic; see § Considered options.

**D7 — Gate 16 grows four checks, and its ratchets may only be lowered.** G (present, first, stamped,
five sections in order, within the line ratchet), H (no supersession marker, no deployment verdict,
no date but the stamp), I (D6), J (D4). Two ratchets: `SEAM_STATE_MAX_LINES` and `MAX_STATE_EXEMPT`.
The line ratchet is bounded above by `SEAM_STATE_CEILING`, DERIVED as twice the imported hub cap
rather than chosen, so it can never be argued upward to an arbitrary number.

**D8 — The canonical form is EMITTED, and the procedure has ONE home.** `node scripts/check-backend-state.mjs --scaffold`
prints the empty block from `SEAM_STATE_SECTIONS` — the same constant checks G and H read — so the
template cannot drift from the checker, and a self-test arm asserts that what it prints passes G, H and
I (a scaffold its own gate would reject is worse than none). ⛔ No markdown template file: a second copy
of a shape is exactly the drift 0196 D6 names about the preamble, and the reason the ADR index is
generated rather than hand-listed. The HOW is written ONCE, in `docs/backend-state/README.md`
§ Writing and refreshing a current-state block, which gate 16's failure footer names by heading so a
reader who just got a [G]/[H]/[I]/[J] finding is sent to it. Everywhere else POINTS at that section and
states only what is local to itself: CLAUDE.md §7 carries the invariant (a phase **APPENDS** its slice
*and* **REPLACES** the block), the lead-playbook Record step carries the TRIGGER, `docs/INDEX.md`
carries the routing row.

⛔ **`.claude/rules/` was considered and is the WRONG home.** ADR 0127's admission filter rejects a rule
a gate already enforces — G/H/I/J enforce the shape — and it requires a tight `paths:` glob, which "a
phase changed the backend surface" does not have. Admitting it would be, in 0127's own words, a
downgrade dressed as a cleanup.

## Considered options

1. **Leave it; wait for D5 corrections to replace the slices.** Rejected — this is 0196's own stated
   plan, and it is the plan that produced the finding. A correction replaces a *sentence*; nothing in
   it ever produces a *summary*, so the slice count falls only as fast as somebody happens to be
   wrong. 57 of 67 says how fast that is.
2. **Rewrite the slices into one state document per seam.** Rejected, and not close: 0196 D5 forbids
   editing a posted section, and the audit value of the record is the reason. It would also destroy
   the only surviving account of several decisions — 0196 D9 kept `stamp-history.md` for exactly that.
3. **Gate the historical/current-state RATIO.** Rejected as a GATE, adopted as a REPORT. History is
   append-only by D5, so the ratio necessarily degrades as the corpus grows CORRECTLY; a gate on it
   would come to red for correct behaviour, and its only available remedy would be deleting posted
   sections — which D5 forbids and maintenance rule 4 calls out by name. A gate whose remedy is
   forbidden teaches people to work around gates. D6 gates the falsifiable half of the same worry.
   The ratio is printed on every run so the concern stays observable without being enforced.
4. **Generate the state layer from the live catalog**, as [0197](./0197-data-access-registries-are-generated-not-maintained.md)
   did for the four registries. Rejected for this layer, and the boundary is the same one 0197 drew:
   a catalog knows an ACL; it does not know what a door is FOR, which of its arms is load-bearing, or
   that re-ordering an enum would open legal-privileged documents. `### Surface` could be generated
   and largely is — it points at the generated registries. `### Invariants` cannot be.
5. **Put the projection in a separate `<seam>-state.md` file.** Rejected — it doubles the file count,
   needs its own router row, and above all it can be missed. The projection must be what a reader
   hits first in the file they were routed to, which is why D1 fixes its position rather than only
   its existence.
6. **Reuse gate 13's five hub section names verbatim.** Rejected; see D2. "Done since start" and
   "In progress" are work-axis words, and writing them at the top of a surface map would re-create
   the phase axis inside the layer built to retire it.

## Consequences

- ⭐ **A reader's entry cost for "what is true here now" drops from a whole seam file to one block.**
  Measured after: **83** `##` sections, **26** axis-free (was 10), **0** seam files without one, and
  the slice count **unchanged at 57** — the layer was added, no history was rewritten. Reproduce with
  `node scripts/measure-state-layer.mjs`.
- ⚠ **The layer costs about 1,050 lines and cannot be right by construction.** Gate 16 proves a block
  EXISTS, is SHAPED, is AXIS-FREE and is NOT STALE. ⛔ It cannot prove the block is TRUE: a wrong
  sentence in a well-formed block passes every check. That is why D3 exists and why it is a drafting
  discipline rather than a gate — truth here is a review property.
- ⚠ **Two blocks came in over the line ratchet and were TRIMMED to fit; the ratchet was not raised to
  meet them.** That is the discipline applied to its own introduction. ⛔ But note the risk it carries:
  compressing to fit a cap selects against QUALIFIERS, so the trims were made against an explicit
  rule — cut paraphrase, never a negation, a bound or an exception; where a bullet could not be
  shortened safely it was deleted whole and the reader is left the pointer.
- ⛔ **The `**Updated:**` stamp is now a real obligation on every future phase.** A phase that appends
  a dated slice and does not re-stamp the block above it reds gate 16 check I. This is deliberate
  friction: it is the moment at which the projection would otherwise start rotting.
- ⚠ **The drafting surfaced defects in the frozen text that this ADR does NOT fix**, because D5
  forbids editing them: `authorization-and-audit.md` carries two different privilege ceilings with
  nothing gating the pair; its zero-policy class is headed "seven tables" while a later slice says
  eight, with no forward marker; `printing.md` contains "**NOT PUSHED** … ✅ **PUSHED**" in one
  sentence; `conventions.md` points at a "correction record at the top of this file" that the split
  left behind. Each is recorded in `docs/progress/backend-state-current-state.md`; the corrections are
  APPENDS somebody must still write.
- ⚠ **ARCHITECTURE.md §2 was found stale against a seam file** on the case patient-mode booleans, and
  is outside this unit's scope. Recorded, not fixed.
- ⚠ **The instruction now has four homes, and three of them are pointers by design** — mitigated, not
  removed. The shape is emitted from one constant, the procedure is written once, and the gate's
  failure text names the heading; but **nothing gates the agreement** between CLAUDE.md, the
  lead-playbook and the README. The pre-existing "ONE seam file / never a new file" clause already
  sits in four places, two of them byte-identical parentheticals — the same failure at small scale.
  ⛔ If they are ever found to disagree, `README.md` § Writing and refreshing a current-state block is
  the one that is right, and the others are stale.
- **Cost, stated:** eleven blocks to keep current, one more obligation per phase, and four more checks
  to run. The alternative was a map that answers "what happened" and not "what is".
