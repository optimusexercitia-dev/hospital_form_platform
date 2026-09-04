# FUP-DOOR-SWEEP-MARKER-BLIND-TO-CONTINUATION-LINES — a multi-line `door-sweep-targets:` declaration silently loses every target after the first

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-04 · status open

`scripts/door-sweep-cases.sh` reads the ADR 0173 § 2 declaration with a grep anchored per line:

```
^[[:space:]]*--[[:space:]]*door-sweep-targets:
```

A continuation line — `--    app.foo()` under a first `-- door-sweep-targets: app.bar()` — **does not
match, and is silently unread**. No warning, no exit code: the declaration looks complete in the file
and the deriver simply returns fewer targets than the author wrote.

**How it was found.** While clearing Gate AE4 review finding F-MAJOR-3 (adding the missing marker to
`20261003007180`), by writing **four separate marker lines** rather than one with continuations, and
then checking why the sibling declaration in `20261003007250` — which *does* use the continuation
form — has not visibly failed.

⚠ **It has not failed for a reason that is not the marker.** `20261003007250` is a DROP+CREATE
migration, so its `create or replace function` lines are picked up by the deriver's separate
**name-selection** block. Its three continuation targets survive on that path, not on the declaration
path. ⭐ So the declaration is already non-functional there and nothing shows it: the two code paths
happen to agree today, and the day a declaration-only migration uses the continuation form, its
targets vanish from the sweep with every gate green.

**Not a live defect.** Both migrations derive correctly today, verified both ways: the marker grep
alone recovers all four names from `…007180`, and `bash scripts/door-sweep-cases.sh` over the working
tree derives the same four cases, exit 0.

⭐ **The class:** a declaration whose *parser* is narrower than its *notation*. The file is valid to a
human reader and to any reviewer, and the machine reads a subset — the same shape as
[[FUP-DOOR-SWEEP-DERIVER-NAME-FILTER-DROPS-A-REAL-GATE]], one layer lower.

**Closes when:** the deriver either consumes continuation lines (so the notation the file uses is the
notation the parser reads), **or** rejects them loudly — an unmatched `--` line immediately following
a `door-sweep-targets:` line is a parse error the deriver names, not silence. Either way
`20261003007250`'s declaration must derive its three targets **from the declaration path**, provable
by removing its `create or replace` lines from consideration and re-deriving.

⛔ **What must NOT be mistaken for closing it.** Rewriting `…007250` into one-line-per-target form.
That repairs the one instance and leaves the parser narrower than the notation, so the next author
who formats a long declaration readably reproduces it exactly. ⛔ Nor does a green
`scripts/door-sweep-cases.sh`: it is green today precisely because a *different* code path is
covering for the declaration.
