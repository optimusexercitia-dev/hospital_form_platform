# FUP-LEDGER-COMPLETENESS-ROWS-NOT-MACHINE-READABLE — the ledger answers column queries wrongly, and nothing checks a row ARRIVED (owner: lead)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-08 · status open

Filed by `LEDGER-COMPLETENESS` (2026-09-08) for the hazards it **measured but was not ruled to
fix**. Derivation and witnesses: [ledger-completeness.md](../progress/ledger-completeness.md)
§ 2026-09-08. The 8-cell `0136` row — the worst of these — **was** fixed in that unit; these are
what remain.

- 🟡 **A row parses as 11 cells, not 9, under a naive splitter.** The `ENFORCEMENT-MANIFEST` row
  carries backslash-escaped pipes inside a code span. A splitter that ignores `\|` reads **11**
  cells and silently mis-assigns every column after the first escape. ⛔ This is not hypothetical:
  it is the same class as the `0136` row that put a **commit sha in the `Completed` column** and
  went unnoticed long enough to be reported as "the malformed row" in a brief. **Any tool that
  reads this table by column index must split on `(?<!\\)\|`.**

- 🟡 **Six rows have an ODD number of `**` markers** — `hospital-admin`, `nsp-per-hospital`,
  `f-cleanup`, `referrals-v2`, `interviews-v2`, `ETH·E1`. Any "is this row already bold?" test that
  counts asterisks answers **wrong** on exactly those six. ⚠ The trap is that such a test looks
  right and is right on the other 80.

- 🟡 **Bolding of the id cell is inconsistent** — the ledger runs unbolded ids for its first stretch
  and bolded ones later, lapsing again near the tail. It is cosmetic *until* someone keys a rule on
  it; recorded so nobody derives meaning from it.

- ⭐ **The real remedy, and why it is bigger than the above.** `FUP-AE2-MISSING-FROM-THE-PHASE-LEDGER`
  already states the asymmetry: `lint:progress` enforces that a completed row **left**
  `PROGRESS.md`, and **nothing checks that it ARRIVED** in the ledger. That is why five rows were
  missing for weeks, and why finding them needed a hand-built derivation. A gate could close it:
  **every `phase(<token>): complete` commit token, and every `docs/features/*.md` hub with
  `status: complete`, must resolve to a ledger row — or to a row that explicitly declares it covers
  that token** (the umbrella clauses `LEDGER-COMPLETENESS` added to `14`, `DM`, `ff-program` and
  `AUTHZ` are written to be machine-readable for exactly this). ⛔ **Do not build it from the
  ledger's id cells alone** — the id namespace and the commit-token namespace differ
  (`e1`↔`ETH·E1`, `f2`↔`14e`, `a`↔`hospital-admin`, `p3`↔`PDF·P3`, `pci+tv`↔`PCI`+`TV`), so an
  id-keyed gate would red on ~30 correct rows and be switched off. The alias map is the work.

- **Owed:** (a) a ruling on whether the arrival gate is worth building, and if so the alias map it
  needs; (b) failing that, a note in the ledger's header telling readers to split on `(?<!\\)\|` —
  cheap, and it removes the column-index trap for every future reader — lead
