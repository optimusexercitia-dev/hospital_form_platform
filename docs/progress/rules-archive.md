# Rules archive — retired `.claude/rules/` entries

Where a rule goes when it stops being true. `npm run lint:rules` (gate 8,
`scripts/check-rules-staleness.mjs`) reds when a rule's `paths:` glob matches nothing or
an `anchors:` entry no longer resolves; the disposition is **repoint it, or retire it
here**. A rule is never deleted outright — same discipline as every other rotation in
`docs/progress/`.

**Retiring a rule**

0. ⛔ **PRECONDITION — is the lesson still true and still unenforced?** Retire only when
   the rule's subject is **gone** (renamed, deleted, superseded), or when **something else
   already carries the lesson**: a gate, a test, or CLAUDE.md. **Nothing reads this file.**
   Retiring a rule that is still true and enforced nowhere does not file it — it *deletes*
   it, and `lint:rules` goes green either way, so nothing will tell you which one happened.
   `print-door.md` was safe to retire **only** because pgTAP `342` S3c3 already reds on the
   thing it prohibited.
   *A rule that is too broad but still needed is not a retirement* — it is a gate waiting to
   be built, or content that belongs in CLAUDE.md / ARCHITECTURE.md where always-on review
   reaches it.
1. Append the rule file's full text here **verbatim**, under a dated heading, with the
   reason it stopped being true (the renamed symbol, the deleted file, the superseding ADR).
2. Delete the file from `.claude/rules/`.
3. Re-run `npm run lint:rules` — the finding is gone because the rule is gone, not
   because the check was loosened.

**Why a rule can go stale and nothing notices.** A rule has no resolution event: nothing
ever closes it. Path-scoped, it is also invisible until it fires, so a rule describing a
symbol that was renamed two months ago keeps loading and keeps being believed. That is
the gap the anchors exist to close, and this file is where the closure lands.

---


## ↩ Retired 2026-08-19 — `print-door.md`

**Why it stopped qualifying: it failed both of the admission criteria in ADR 0127, and the
measurement that showed it came after admission.**

- **Breadth.** Its globs matched **659 files** (`supabase/migrations/**` 423 + `supabase/tests/**`
  236), so it loaded on essentially every backend task — a de-facto always-on rule wearing a
  path-scoped costume. The supersession candidate was REJECTED at admission for spanning 8.
- **A tight glob is impossible in principle here.** Its audience is whoever next edits the print
  door, which happens in a migration whose filename does not exist yet. Not a fixable glob.
- **Already enforced.** pgTAP `342` S3c3 reds if anyone adds `is_active` to
  `app.can_view_printed_document`. ADR 0127 rejects a rule a gate already enforces; at Q12 this
  was called borderline and admitted anyway.

The prohibition itself is NOT lost: it is pinned by pgTAP `342` S3c3 and recorded in
`docs/bugs/archive.md` (BUG-ACT-ACL-1 closure notes). Full text of the retired rule:

```markdown
---
paths:
  - "supabase/migrations/**"
  - "supabase/tests/**"
anchors:
  - supabase/tests/342_dm5_s3_printed_renditions.sql#S3c3
  - supabase/tests/342_dm5_s3_printed_renditions.sql#can_view_printed_document
source: BUG-ACT-ACL-1 closure notes
---

# The print door admits a deactivated account BY DECISION

⛔ **Do NOT add `is_active` to `app.can_view_printed_document`.** The admission of a
deactivated account is deliberate, and pgTAP `342` **S3c3** pins it — adding the check
reds that keystone.

The authority is the **conjunction** the door already computes. A second copy of the
same predicate is the *two-locks-that-are-one-lock* trap: it reads like defence in
depth and is one lock, tested twice.

⚠ Verify against the **live catalog** (`pg_proc`, `prosecdef`, `pg_policies`), never
against migration text — migration files here are stale by design, since several rewrite
function bodies at runtime. Source: **BUG-ACT-ACL-1** closure notes.
```
