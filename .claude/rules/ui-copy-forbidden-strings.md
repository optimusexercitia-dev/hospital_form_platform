---
paths:
  - "docs/progress/follow-ups.md"
  - "src/lib/dsr/messages.ts"
  - "src/components/dsr/dsr-meeting-residue.test.tsx"
  - "src/components/referrals/referral-dispose-dialog.test.tsx"
anchors:
  - src/components/referrals/referral-dispose-dialog.test.tsx#TOTALITY_QUANTIFIER
  - docs/progress/follow-ups-archive.md#FUP-GREP-VERIFIED-FOLLOWUP-IS-SELF-DEFEATING
source: FUP-GREP-VERIFIED-FOLLOWUP-IS-SELF-DEFEATING · FUP-OVERCLAIM-PROPERTY-ONE-SURFACE-ONLY
---

# Proving the UI does NOT say something

⛔ **Never verify a forbidden-UI-string property with a grep over source.** Source text
cannot separate live copy from prose *about* live copy, so the warning comment the fix
wants to write **is** a hit. Measured record of the one that shipped: **0 true, 4 false
positives in one day** — the fourth by the author who had fixed the other three, in the
docblock of the detecting regex.

**Assert on rendered output instead.** A component test reading `textContent` cannot see
comments, so the false-positive class is structurally impossible rather than discouraged.
Exemplar: `TOTALITY_QUANTIFIER` in `referral-dispose-dialog.test.tsx` (claim 2), with
proof-of-life asserted before the absence.

## Two corollaries

- **A prohibition is a symptom.** About to write *"never quote this string, comments
  included"*? The instrument is wrong — replace it, don't add the rule. It has no
  enforcer of its own and dissolves with the grep that needed it.
- ⚠ **A lexical pattern cannot carry this property, at either width.** A literal misses
  every paraphrase; the quantifier *family* false-positives on
  `DSR_MEETING_DISPOSAL_WARNING`, which ADR 0130 forbids softening — so the cheapest green
  is the edit its docblock bans. The distinction is **frame, not syntax**: a
  universal quantifier over the subject's data in a REASSURING frame is the defect; over
  other people's records in a WARNING frame is required. Scope the assertion to the
  reassurance region, never to a whole dialog.
