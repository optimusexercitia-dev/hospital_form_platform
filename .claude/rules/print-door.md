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
