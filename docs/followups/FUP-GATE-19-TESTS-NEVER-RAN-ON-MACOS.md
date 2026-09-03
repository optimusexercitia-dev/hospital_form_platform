# FUP-GATE-19-TESTS-NEVER-RAN-ON-MACOS — the failure count understates what went unexercised (owner: lead/tester; filed 2026-08-25)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-25 · status open

The 2026-08-25 full `e2e:prod` returned **1172 passed · 18 failed · 2 flaky · 19 did-not-run · 114
batches**, accounting for **1211 of 1222** collected tests. A failure aborts the remainder of its
spec, so 19 tests were never executed:

| spec | never ran |
|---|---|
| `ethics-e1-access-spine` | 5 |
| `ethics-e2-procedure` | 5 |
| `dm4-referral-documents` | 5 |
| `case-referral-usability-batch` | 3 |
| `ethics-e4-participants` | 1 |

⛔ **Nothing is proven for those 19 in either direction.** They are hostage to the two clusters that
caused the reds — [[FUP-OPEN-DOCUMENT-VERSION-500-ON-EVERY-RAISE]] and the macOS native-`<select>`
`ArrowDown` no-op, which cannot pass on this OS at all — and stay unexercised until those are fixed.
⚠ **The gate is not at fault here and must not be "fixed":** it reports the condition loudly and
correctly (`!! 19 test(s) NEVER RAN — nothing is proven for them`) and refuses to count them as
passes. The defect is that reds gate the coverage, not that the gate conceals it.

⭐ **The lesson that outlives this run: a green gate row can be uncomparable while looking current.**
The row cited as the baseline (`77b0a467`, 2026-08-24, GATE GREEN 1227p/0f/**21 batches**) was
**11 commits stale** — a whole phase plus a Node 20→24 pin had landed with no gate row in between —
and was run under a different configuration; `scripts/e2e-prod-gate.sh:38` says the gate "is primarily
for the LOCAL **Windows** prod-standalone run". 21 batches against 114 was the visible tell, walked
past. Before citing any gate row as a baseline, run `git log <baseline>..HEAD` and compare the batch
count.

---
