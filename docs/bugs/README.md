# Per-bug documents — template and rules

`docs/bugs/BUGS.md` holds one row per bug. A bug earns its **own file**,
`docs/bugs/<ID>.md`, only when (ADR 0185 D3): severity is `high` or above, root
cause needed investigation, or the bug reopened. Otherwise the row's
Description cell is the whole record; do not pre-create files for it.

**Gate:** a `BUGS.md` row may not carry `fixed` or `verified` while its
`docs/bugs/<ID>.md` document exists with an empty `Root cause` or
`Regression protection` section. Forward-only — archived bodies in
`docs/bugs/archive.md` are not split into this shape retroactively.

## Frontmatter

```yaml
---
id: BUG-<CODE>-<short-slug>
status: open | fixed | verified | wontfix | duplicate | untriaged
severity: catastrophic | critical | high | medium | low | unrated
area: <short noun, e.g. authz, forms, cases, nsp>
opened: YYYY-MM-DD
closed: YYYY-MM-DD | null
feature: <program/feature code, e.g. DM5, AE4 — links to docs/features/<code>.md>
related_adrs: [NNNN, ...]
---
```

## Body sections (exact `## ` headings, in this order)

1. **Symptom** — what a user or operator observes.
2. **Expected behavior** — what should happen instead.
3. **Actual behavior** — what happens, precisely.
4. **Reproduction** — steps or a command that reaches the failing state.
5. **Impact** — who/what is affected, and how badly.
6. **Investigation** — what was tried, ruled out, and measured.
7. **Root cause** — the mechanism, not the symptom. Non-empty before `fixed`.
8. **Fix** — the change that resolved it (commit/migration reference).
9. **Regression protection** — the test/gate/keystone that now guards this.
   Non-empty before `fixed`.
10. **Related code** — files, functions, migrations touched or implicated.
11. **Lesson** — the one-sentence takeaway, if any (mirrors a memory entry).
12. **Resolution** — final disposition and date; who verified it and how.

A section with nothing to say yet is kept with its heading and `_TBD_` —
never deleted — so the empty-section gate can tell "not written" from
"deliberately blank".
