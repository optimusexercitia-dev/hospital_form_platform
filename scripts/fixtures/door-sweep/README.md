# door-sweep selftest fixtures

Committed inputs for `SELFTEST=1 bash scripts/door-sweep-cases.sh`. Each file is copied,
UNTRACKED, into a throwaway `git init` repo under `$TMPDIR` that also holds `cmp`-verified
copies of the real `scripts/door-sweep-cases.sh` and the two audit harnesses. ⛔ Nothing
here is ever placed in `supabase/migrations/`, and the selftest touches no database except
read-only catalog queries the deriver itself makes.

⚠ Every function and policy named below EXISTS in the live catalog, deliberately: the
deriver classifies by the catalog, so a made-up name would only ever exercise the
UNRESOLVED branch. The fixtures pin what each catalog fact makes the deriver do.

⚠ The numbering is contiguous, `01`–`15`. It was `01`–`08`, `10`–`13` until 2026-09-05:
`09` had simply never been written — `git log --diff-filter=D -- scripts/fixtures/door-sweep/`
is empty and no fixture here has ever been deleted — but a gap "reads as a deleted fixture"
(QA F-REC-8), so the slot was closed rather than explained.
`09-marker-dangling-prefix.sql` fills it with QA F-MAJOR-3's own four-line example.

## `merge/` — inputs for `scripts/lib/merge-findings-baseline.sh`

These need neither the fake repo nor the catalog: the merge helper is pure text. Each
scenario is `<name>.baseline.md` (what is committed) against `<name>.generated.md` (what a
run's generator produced). Their content is REAL where it can be — the door and invoker
rows are byte-exact extracts of the committed findings baselines, because the bytes are
what broke.

| pair | what it pins |
|---|---|
| `A-escaped-pipe` | a markdown-escaped `\|` inside a note. The pre-fix helper split the row on it and truncated: 727 B → 579 B and 1106 B → 570 B, at rc 0, reporting everything preserved. |
| `B-hand-table` | a HAND-WRITTEN 3-column table inside a hand-written section. The pre-fix helper deleted header, delimiter and both rows, with no carry: 165 lines → 161, rc 0. |
| `C-empty-note-row` | a correctly-shaped hand row whose column 5 is EMPTY. The pre-fix carry was gated on a non-empty note, so it vanished from the table AND from CARRIED. |
| `D-real-generator` | ⭐ the REAL generator's rows for those two gates, from a 2-case door run on 2026-09-05. Settles QA could-not-verify #2: the generated file list is **not** a byte prefix of the committed note — one row differs by a hand-added space (spliced) and one by real content (carried whole). |
| `E-four-row-cases` | unchanged · verdict changed · gate disappeared · newcomer, in one pair. |

`*.prefix-output.md` are **frozen artefacts, not expectations**: each is what
`git show de955981:scripts/lib/merge-findings-baseline.sh` — the helper as QA reviewed it —
actually wrote for that pair. The self-test feeds them to the CURRENT verifier through
`MERGE_VERIFY` and requires exit 2. ⛔ Do not regenerate them to make a run pass: they are
three measured historical losses, and a verifier that stops seeing them is the finding.
