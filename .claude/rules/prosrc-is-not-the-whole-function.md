---
paths:
  - "supabase/tests/mutation/p0-authz-*.sh"
anchors:
  - docs/decisions/0078-authorization-capability-model.md
  - docs/learning/LESSONS.md
source: LEARN-096 · pre-AE5 Batch 9 (unit AE5-OPENING-ADR), lead spot-check 2026-09-09 · ADR 0201
---

# ⛔ `prosrc` is not the whole function

A function's **result type is not in `prosrc`**. For
`returns table (… hat_ok boolean)`, `prosrc ~ 'hat_ok'` is **false** while three consumers of that
column return **true** — which reads as *"the claim named the wrong function."* It did not.
⚠ 2026-09-09: this nearly refuted the correct finding a whole batch's ratification rested on.

⛔ **Never conclude a function does not mention a symbol from `prosrc` alone.**

| what you need | the source that holds it |
| --- | --- |
| the body | `prosrc`, **comments stripped** |
| result-type column names | `pg_get_function_result(oid)` |
| argument names | `proargnames` |
| ⭐ all of the above | `pg_get_functiondef(oid)` |

⭐ **Default to `pg_get_functiondef`** — the one source that cannot give this false negative.

## The wider class: a LOCATION is measured, never remembered

A section number, a line number, a column name and a function name are all **measurements**.
`sed -n` the file or query the catalog. ⚠ `grep` is not enough either: a sentence split across a
**SQL string-literal concatenation** is invisible to a search for the whole sentence.

⛔ No gate catches any of this — that is why it is a rule, and a rule is a hint, never a substitute
for a gate (ADR 0127).
