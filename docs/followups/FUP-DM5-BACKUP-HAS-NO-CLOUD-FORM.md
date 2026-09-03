# FUP-DM5-BACKUP-HAS-NO-CLOUD-FORM — the § 6b procedure is **local-only by construction**, and on Cloud there is **no Storage backup at all** (owner: PO decision, then backend + lead; **Rule 12 / LGPD / ANVISA-RDC**)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-19 · status open

Filed 2026-08-19, from the § 6b first execution (finding **F5**;
[run log](../deployment/phi-backup-run-log.md)). **This is the residue that
`FUP-DM5-BACKUP-IS-PHI-EXPORT`'s close does not absorb**, named rather than dropped.

> ⭐⭐ **PROMOTED TO the ⭐⭐ Critical list as C3 on 2026-08-19, by explicit PO instruction** — the only way
> an entry may land in that section. Its **trigger** lives there: ⛔ *before any real patient record
> is loaded.* ⚠ That is the same instant as **C1**'s trigger and for the **opposite** reason — C1 is
> about *destroying* bytes on request, C3 about *not being able to get them back*. Two items, one
> deadline, easy to conflate; the ⭐⭐ Critical rows say so on both sides.

The mechanism § 6b prescribes is `docker exec supabase_storage_<ref> … tar`. That cannot reach a
Supabase-managed project. What is available on Cloud instead, **measured against Supabase's own
documentation, not inferred**:

| candidate | verdict |
| --- | --- |
| managed **daily backups / PITR** | *"Database backups do not include objects you store via the Storage API"* — the DB holds only metadata ([platform/backups](https://supabase.com/docs/guides/platform/backups)) |
| **"Restore to a new project"** | storage objects and bucket settings are listed under *what needs manual reconfiguration* — **not copied** |
| `supabase storage cp -r --linked` | takes a destination **path**; there is no stdout/streaming form, so it writes **plaintext PHI files to disk** |

⇒ Three consequences, each of which invalidates a sentence that currently reads as settled:

1. **On the platform the pilot runs on, there is no Storage recovery point** — not governed, not
   ungoverned, not managed. § 2's *"if the stack must be cycled, take the § 6b backup first"* has no
   Cloud analogue.
2. **The § 6b "encrypted AT CREATION, never plaintext on disk at any point" decision is
   unsatisfiable on Cloud with available tooling** — and the vendor's own advice ("download storage
   objects… store in a secure location") is *exactly* the ungoverned plaintext export this whole
   item family exists to prevent. The PO decision stands; the means to obey it does not exist.
3. ⚠ **`FUP-DM5-BACKUP-IS-PHI-EXPORT`'s production framing was premised on a mechanism that is not
   available in production.** It graded *"the mechanism as it applies to production, where the same
   command over `documents-phi` yields real records"* — the same command cannot be issued there. The
   Cloud risk is **not** an over-wide export; it is an **absent** backup plus whatever the operator
   improvises. Different risk, different remedy, and it needed its own item to stay visible.

**Decision owed from the PO** (this is a risk acceptance, not an engineering call): either
(a) accept that Storage has no recovery point pre-pilot and say so where a pilot decision is made, or
(b) name a Cloud mechanism — S3-protocol client against the Storage endpoint piped into an
encryptor is the only shape that could satisfy "encrypted at creation" — and then it must be
rehearsed like any other. ⚠ Note (b) overlaps **`FUP-DM5-CLOUD-ORPHAN-SURFACE`**: the S3 endpoint is
**UNPROBED**, and a backup taken through it inherits whatever that probe answers about orphans.


**From the Critical pin, 2026-09-03 (compacted at ADR 0186 D4, plan 5.6):**

- **Item (was):** 🔴 **`FUP-DM5-BACKUP-HAS-NO-CLOUD-FORM`** — § 6b's backup mechanism is `docker exec … tar`, **local-only by construction**. On Cloud: managed backups + PITR **exclude Storage objects by documented design**, *"Restore to a new project"* does not copy them, and `supabase storage cp -r` has **no streaming form** ⇒ **the pilot platform has NO Storage recovery point at all**, and § 6b's *"encrypted AT CREATION"* is **unsatisfiable** there. ⭐ **It INVERTS its parent**: `FUP-DM5-BACKUP-IS-PHI-EXPORT` graded an over-wide copy **existing**; this grades **no copy existing** — opposite failure, opposite remedy, which is why it is a separate item and not absorbed into that close.
- **What must happen (was):** **PO decision, two shapes:** (a) accept no Storage recovery point pre-pilot and say so **where the pilot decision is made**, not only here; or (b) **name a mechanism** — ⭐ only one shape can satisfy "encrypted at creation": the **S3 protocol endpoint** streamed into a client-side encryptor (`rclone crypt` and peers), which makes this **the same measurement as `FUP-DM5-CLOUD-ORPHAN-SURFACE`** (that endpoint is **UNPROBED**). ⛔ **Any destination inherits the SOURCE's blindness** — changing the bucket cannot change what the endpoint can enumerate, and a source-count ↔ destination-count check compares **metadata to metadata**. Then rehearse it **restore included**, and prove the restore recreates `storage.objects` rows and not merely bytes. Also owed for any new processor: **BAA posture + LGPD cross-border basis**.
- **Trigger — the point it can no longer wait (was):** ⛔ **BEFORE ANY REAL PATIENT RECORD IS LOADED.** From the moment the pilot holds data with no recovery point, every day is unrecoverable-loss exposure. ⚠ **Distinct from C1's trigger, and they are easy to conflate:** C1 is about **destroying** bytes on request; this is about **not being able to get them back**.
- **Owner (pin's own column):** PO decision, then backend + lead
