---
paths:
  - "src/lib/queries/conditions.ts"
  - "src/lib/queries/responses.ts"
  - "src/lib/queries/submissions.ts"
  - "src/lib/queries/responses.test.ts"
anchors:
  - src/lib/queries/responses.ts#buildAnswerMaps
  - docs/bugs/archive.md#BUG-FF4-001
source: BUG-FF4-001
---

# `buildAnswerMaps` — read BUG-FF4-001 first

⛔ The obvious one-line fix to `buildAnswerMaps` **breaks Architecture Rule 3**
(condition-evaluator parity, SQL ↔ TS). The evaluator is mirrored in Postgres and in
TypeScript; changing one side silently desynchronizes conditional visibility between
what the DB enforces and what the wizard renders.

Read the **BUG-FF4-001** entry in `docs/bugs/archive.md` before editing,
and change both sides together or neither.
