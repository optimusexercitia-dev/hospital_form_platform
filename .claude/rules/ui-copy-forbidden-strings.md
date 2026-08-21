---
paths:
  - "docs/progress/follow-ups.md"
  - "src/lib/dsr/messages.ts"
  - "src/components/dsr/disposal-copy-property.ts"
  - "src/components/dsr/dsr-disposal-overclaim.test.tsx"
  - "src/components/dsr/dsr-meeting-dispose-dialog.test.tsx"
anchors:
  - src/components/dsr/disposal-copy-property.ts#TOTALITY_QUANTIFIER
  - docs/progress/follow-ups-archive.md#FUP-GREP-VERIFIED-FOLLOWUP-IS-SELF-DEFEATING
source: FUP-GREP-VERIFIED-FOLLOWUP-IS-SELF-DEFEATING · FUP-OVERCLAIM-PROPERTY-ONE-SURFACE-ONLY
---

# Proving the UI does NOT say something

⛔ **Never verify a forbidden-UI-string property with a grep over source.** Source cannot
separate live copy from prose *about* it, so the warning comment the fix wants to write
**is** a hit. Measured on the one that shipped: **0 true, 4 false positives in one day**.

**Assert on rendered output** — comments are not in it, so the false-positive class is
structurally impossible. Define the property ONCE (`disposal-copy-property.ts`), assert
proof-of-life before absence, and read via `renderedText()`: bare `textContent` fuses
sibling text, so a `\b` pattern silently misses anything at an element edge.

## Two corollaries

- **A prohibition is a symptom.** About to write *"never quote this string, comments
  included"*? The instrument is wrong — replace it. The prohibition has no enforcer of its
  own and dissolves with the grep that needed it.
- ⚠ **A lexical pattern cannot carry this property at either width.** A literal misses
  every paraphrase; the quantifier *family* false-positives on
  `DSR_MEETING_DISPOSAL_WARNING`, which ADR 0130 forbids softening — so the cheapest green
  becomes the edit its docblock bans. The distinction is **frame, not syntax**. Subtract
  the warning constants BY IDENTITY, paired with a positive pin that each still renders.
  ⛔ Do NOT scope to the residue region: measured, it holds only constants, and the defect
  lives in the bespoke copy outside it.
