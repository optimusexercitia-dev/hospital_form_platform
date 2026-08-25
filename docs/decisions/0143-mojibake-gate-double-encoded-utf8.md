# 0143 — A gate for double-encoded UTF-8 (mojibake) in tracked text

**Status:** Accepted · 2026-08-25
**Supersedes:** nothing. **Amends:** nothing.

## Context

Repairing one garbled heading in `follow-ups-archive.md` surfaced **2,059 double-encoded
lines across 3 files** — `follow-ups.md` (1,694), `docs/reviews/authz-a0-inventory-review.md`
(321), `follow-ups-archive.md` (44). All pre-existing; `HEAD~2` already carried 1,702 in
`follow-ups.md` alone. **No gate could see any of it**, and the affected files are ones a
session opens and believes.

The defect: a tool reads a UTF-8 file assuming cp1252, then writes it back as UTF-8. `⬛`
(bytes `E2 AC 9B`) is read as three chars `â` `¬` `›` and re-saved as six bytes. Nothing
errors, and afterwards **the file is valid UTF-8** — there is no invalid byte to detect.
The corruption is now really on disk, and it **compounds**: each repeat adds a layer. On
Windows the usual vector is a shell round-trip (`sed -i`, `>` through a cp1252 console),
which is why repo tooling edits these files with explicit UTF-8.

Consequences are not merely cosmetic. Searching the trackers for `✅` silently misses every
mojibake line, so recorded work reads as absent — the same failure family as a gate summary
hiding unrun tests.

## Decision

1. **`scripts/check-mojibake.mjs` becomes lint gate 10**, chained into `npm run lint`.
2. **The signature is derived from the UTF-8 grammar, never from examples**: a cp1252 char
   from byte `C2-F4` (a lead) followed by one or more from `80-BF` (continuations).
3. **A pattern match is a candidate, not a finding.** Each run must additionally *decode*
   to valid UTF-8 and *collapse* character count. This is the load-bearing rule — see below.
4. **Repair happens in place, per run**, so a line mixing a real emoji with mojibake has
   only the mojibake touched. Anything not safely reversible is left alone; refusing is
   always recoverable, mangling is not.
5. **`graphify-out/` is excluded** — generated, rewritten wholesale on refresh.
6. The one-time repair of all 2,059 lines is committed alongside the gate, so the gate is
   green from its first run and any future finding is a genuine regression.

## Why the decodability test is the whole decision

A pattern-only detector **false-positives on correct text**. `placeholder="…e por quê…"` is
valid pt-BR: `ê` (byte `EA`, a lead) followed by `…` (byte `85`, a continuation) matches the
shape while being nobody's mojibake. Two live instances sat in
`src/components/cases/file-correction-control.tsx` and
`src/components/dashboard/correct-submission-button.tsx`. A gate that reds on those is a gate
someone disables. The discriminator: real mojibake round-trips because it *was* valid UTF-8;
an accidental adjacency does not (`ê…` → `EA 85` is truncated and fails).

## Two errors the build made, both caught by controls, both worth keeping

- ⛔ **The first LEAD set was hand-picked (`Â Ã â Å Ä`) and missed every 4-byte emoji**,
  which starts at byte `F0` → `ð`. It reported a total that was really a **floor** — the
  same shape as [[e2e-prod-build-flaky-baseline]]'s "exactly 2 failures". Deriving the set
  from the grammar fixed it.
- ⛔ **Bytes `81/8D/8F/90/9D` are UNDEFINED in cp1252** and pass through as raw C1 controls.
  Omitting them from the continuation set missed every character whose UTF-8 contains one —
  `⭐` is `E2 AD 90`. The gate's own self-test red-proved this.

Both were found because the self-test **generates mojibake from truth** (encode UTF-8 → read
as cp1252) instead of using hand-typed examples. Hand-typed mojibake silently loses NBSP and
undefined-slot control characters, which is exactly what made the first two positive controls
fail for the wrong reason.

## Consequences

- `npm run lint` is now **TEN gates**; CLAUDE.md §8 updated.
- The self-test runs on every invocation and exits `2` (distinct from `1` = findings) if the
  detector is untrustworthy — a detector that finds nothing must be proven able to find
  something, and one that finds a lot must be proven not to fire on correct text.
- ⚠ **The gate detects, it does not attribute.** It cannot say which edit caused a
  regression, only that one exists. Origin of the original 2,059 was never established.
- ⚠ It reverses exactly **one** layer. Doubly-compounded text would need a second pass, and
  the gate would still red until clean — correct, but the message will not say "run it twice".
- ⛔ **Documenting the defect trips the gate**, and this is correct behaviour, not a bug: the
  CLAUDE.md §8 bullet written in the same change reddened gate 10 by containing a literal
  garbled example. **Do not add an allowlist or a magic "example" marker** — either is a hole
  the real defect can hide in. Break the adjacency instead: write the characters separately
  (`` `â`+`¬`+`›` ``), which the run-based matcher ignores and which reads no worse.
