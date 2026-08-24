---
paths:
  - "supabase/migrations/**"
broad: >-
  The whole directory IS the subject. A narrower glob leaves most migrations unguarded,
  which is the defect — the rule must fire on whichever file someone is about to edit.
anchors:
  - supabase/tests/364_backfill_mapping_replay.sql#forward-only rule
  - docs/backend-state.md#Migrations (forward-only, additive)
  - scripts/check-migration-set-local.mjs
source: pgTAP 364 · CLAUDE.md review queue 2026-08-24
---

# An applied migration is NEVER edited — forward-only, additive

⛔ **Forbidden:** changing any statement in a migration applied anywhere, your own local DB
included. Fix it FORWARD, in a new migration.

✅ **Allowed:** a new migration that re-emits a body (`create or replace`) — the house
idiom; and editing a migration not yet applied anywhere.

⚠ **A comment-only edit is NOT free.** `364`'s argument is that *the file cannot
legitimately change*, and draws no comment/statement line. Prefer correcting a wrong header
in the next migration that touches the same object.

## Why it is load-bearing

- ⛔ **No gate enforces this** — nothing in `npm run lint` or pgTAP can see an edit to a
  file that already ran. A rule is a strong hint, never a substitute for a gate
  (CLAUDE.md §8). This rule is the only witness.
- **pgTAP `364` rests its durability on it** — and its citation, *"CLAUDE.md's forward-only
  rule"*, was **false when written**: CLAUDE.md never carried it, nor did ARCHITECTURE.md
  or the lead-playbook. The suite depended on a rule that existed nowhere.
- **`lint:set-local`'s watermark assumes it**, which is why it must never be bumped on a
  `db push`.
- **A remote that already ran the file never re-runs it**, so an edit makes repo and remote
  disagree with nothing able to report it: the catalog matches the OLD text.
