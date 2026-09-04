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

---

## ↩ Retired 2026-09-04 — `c2-neutralizer-has-no-crash-safety.md`

**Why it stopped being true: its resolution event arrived.** Every claim the rule made about
`supabase/tests/mutation/c2-command-door-neutralizer.sh` was inverted in the same commit that
retires it (unit HARNESS-CRASH-SAFETY, ADR 0189):

- *"`restore_inflight` truncates `$INFLIGHT` unconditionally"* — it now clears the sentinel only
  when **psql rc = 0 AND** the live `md5(pg_get_functiondef(oid))` equals the snapshot taken before
  the mutation. A failed restore **keeps** the sentinel and returns 2. Proven able to fire: with a
  real enforcer mutated and the restore SQL corrupted, `*** RESTORE FAILED (psql rc=3, body hash
  live=c787e3dd… want=1636bd89…)`, sentinel intact.
- *"`RECOVER=1` does not exist in this script"* — it exists, ported from
  `p0-authz-door-audit.sh:272-297`, and runs before worklist derivation and any suite run.
- *"`DEGEN` matches only a whole body replaced by a constant"* — a fourth arm now matches the
  neutralizer's own residue.

**ADR 0127 precondition satisfied**: the surviving operational line ("launch outside the tool's job
tree, own `WORK` + sentinel path, no timeout; full C2 sweep ≈ 9.5 h") was **moved verbatim in
substance** into the sibling `.claude/rules/mutation-harnesses-are-not-killable.md`, which is
path-scoped to the same `supabase/tests/mutation/*.sh` glob and therefore loads for exactly the same
work. Nothing is lost by the retirement. Full text of the retired rule:

```markdown
---
paths:
  - "supabase/tests/mutation/c2-command-door-neutralizer.sh"
anchors:
  - supabase/tests/mutation/c2-command-door-neutralizer.sh
  - docs/followups/FUP-C2-TIER1-INFLIGHT-SENTINEL-ERASED-BY-ITS-OWN-RESTORE.md
source: C2 Phase B2a incident 2026-09-04 — a sweep killed by a 10-minute tool timeout left cancel_event's HC044 custody gate open ~4 min, with no sentinel and no preflight red
---

# ⛔ Run this harness DETACHED — never under a tool timeout

Its sibling rule says a kill is *caught*. **Not here.** Measured 2026-09-04:

- `restore_inflight` (`:88-93`) truncates `$INFLIGHT` **unconditionally**. A kill takes the
  restoring `psql` too, so the restore never happens **and the sentinel is erased with it**.
- **`RECOVER=1` does not exist** in this script.
- `DEGEN` matches only a whole body replaced by a constant; a `raise → null;` rewrite matches none.

⇒ A kill leaves **an open authorization gate and no trace**. "Do not kill it" is the only defence,
and a tool timeout breaks it without anyone choosing to.

✅ Launch outside the tool's job tree, own `WORK` + `C2_INFLIGHT`, no timeout. Full sweep ≈ 8 h.
✅ Detector, if you suspect a strand: live anchored-raise count vs `worklist.tsv`'s `nraise`.
```

⚠ The retired rule's last line (*"live anchored-raise count vs `worklist.tsv`'s `nraise`"*) was
**measured vacuous** while retiring it: both columns are derived from the live `pg_proc.prosrc` in
the same instant, so on a stranded stack they compare a number to itself, and a fully stranded
enforcer leaves the derivation's population entirely. The replacement detector is the harness's
`DEGEN` arm 4 (residue shape **and** zero errcodes of the anchor class) plus a persisted worklist
baseline — see ADR 0189 and the record `docs/progress/harness-crash-safety.md`.
