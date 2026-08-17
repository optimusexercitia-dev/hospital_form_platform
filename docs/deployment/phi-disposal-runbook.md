# PHI disposal runbook — manual completion + reconciliation

> **Status:** operational procedure. Created DM5 · S5.D, 2026-08-17.
> **Binding decisions:** ADR 0120 (D9 + the S5.D ruling) · ADR 0099 D10 (the "no new
> cron infrastructure" precedent) · Architecture Rule 12 (LGPD / ANVISA-RDC / CFM
> 1821-2007).
> **PO ruling this document implements:** *document the gap, do NOT build the job.*
> No `pg_cron`, no scheduled sweep, no second execution context with service-role
> reach.

## 0 · Why this document exists, and what it IS

`request_document_disposition`, `dispose_case_phi` and `dispose_referral_phi` all
park a `file_objects` row at `disposal_state = 'disposal_pending'`. Reads fail
closed from that moment — that half is enforced in the database and needs no
operator. **Nothing completes it.** `complete_document_disposal` — the only door
that can move a row to `disposed` — has exactly one caller in the repository, and
it is `reclassifyDocument`, an unrelated copy-then-retire lane. Nothing is
scheduled; `pg_cron` is not installed.

So **this document is the mechanism.** Two consequences that are easy to miss:

1. **This runbook is the operational owner that
   `scripts/document-reconciliation.mjs` already assumes exists.** That script
   classifies `disposal_pending` rows as permanently `indeterminate` — never
   drift — and its own header explains why: *"a stuck pending row is disposal-job
   latency, not an accounting hole — the completion door is its owner."* Until
   this document existed, that premise was **false**, and a row could sit in
   `disposal_pending` with its PHI bytes intact, invisible to the one tool built
   to find accounting holes. If this runbook stops being executed, the
   reconciler goes quiet again — it will not tell you.
2. **The gap is pinned executably**, so this document cannot silently become
   obsolete: `supabase/tests/343_dm5_s5_disposal_gap.sql` (catalog side) and
   `src/lib/documents/disposal-gap.test.ts` (TypeScript side). If either goes
   red, an automated completion path may now exist — **read their headers before
   changing anything, and retire this runbook in the same change.**

## 1 · OWNER AND PERIODICITY — ✅ DECIDED (PO, 2026-08-17)

**Set by the PO. These are decisions, not proposals.**

| | Decision |
| --- | --- |
| **Accountable owner** | **The PO (repo owner).** ⭐ Deliberately *not* a DPO / encarregado role: naming a DPO pre-pilot names a role that may not be staffed, and **an unstaffed owner is the same as no owner.** Revisit when the role is actually filled. |
| **Executor** | **Whoever holds service-role reach.** Not a choice — an ACL constraint: `complete_document_disposal` grants EXECUTE to `postgres` and `service_role` only, never `authenticated`, so no user-facing role can complete a disposal however it is delegated in the org chart. |
| **Periodicity** | **Monthly**, plus **out-of-band on any data-subject request.** A DSR does not wait for the monthly slot. |

Note the two roles may currently be the same person; that is a consequence of
pre-pilot scale, not a design goal. The separation to preserve, whenever staffing
allows, is that service-role reach bypasses RLS entirely — so "decides what is
destroyed" and "can destroy anything" are worth splitting once there is more than
one candidate.

⭐ **This runbook, with these values set, is now the operational owner that
`scripts/document-reconciliation.mjs` assumes exists** (§0.1). That premise was
false until this document; it is true only for as long as the monthly run actually
happens.

## 2 · Preconditions (all verified against the live catalog)

- **The documents feature flag must be enabled.** The door's first statement is
  `perform app.assert_documents_enabled()`; with the flag off it raises and
  nothing is disposed.
- **Service-role reach.** Local: `psql` as `postgres`. Cloud: the SQL editor
  (runs as `postgres`) or a client using the service-role key. Never from app
  code — there is deliberately no request path to this door.
- **No open legal hold.** `app.guard_file_object_transition()` (BEFORE INSERT OR
  UPDATE, DEFINER, enabled) blocks entry into either disposal state while an
  unreleased `document_legal_holds` row exists on any document the file is bound
  to. `request_document_disposition` also refuses while an `active` print exists.
- **Order matters and is enforced.** The door *verifies absence* before it marks
  anything: delete the Storage object **first**, call the door **second**. In the
  other order the door raises `HC0D9`.

## 3 · The procedure

### Step A — enumerate the pending work

```sql
select fo.id            as file_object_id,
       fo.storage_bucket,
       fo.storage_path,
       fo.sensitivity_tier,
       fo.disposal_reason_category,
       fo.size_bytes,
       fo.sha256
  from public.file_objects fo
 where fo.disposal_state = 'disposal_pending'
 order by fo.sensitivity_tier desc, fo.id;
```

Record the row count before you start. It is the denominator for step D.

### Step B — delete the Storage object through the API

Per row, using the bucket and path from step A:

```bash
# Cloud (the real target). --experimental is REQUIRED or the CLI refuses.
supabase storage rm "ss:///<storage_bucket>/<storage_path>" --linked --experimental

# Local rehearsal of the same command
supabase storage rm "ss:///<storage_bucket>/<storage_path>" --local --experimental
```

The URI scheme and the `--experimental` requirement were verified by running
`supabase storage ls ss:/// --local --experimental` (returned the four surviving
buckets). **Go through the Storage API, never raw SQL against
`storage.objects`** — a metadata-only delete is precisely how bytes become
unreachable orphans, and `storage.protect_objects_delete` blocks the raw route
anyway.

### Step C — complete the disposal

```sql
select public.complete_document_disposal('<file_object_id>'::uuid);
```

On success the row becomes `disposed` with `disposed_at = now()`, and **if every
file of the document is disposed** the document itself is marked `disposed`, its
title replaced with `[removido]`, its description nulled, and an audit row
`document.disposed` is written. The governance record survives; the content does
not.

**Errors you should expect, and what each means:**

| SQLSTATE | Meaning | Correct response |
| --- | --- | --- |
| `HC0D9` "arquivo não está aguardando descarte" | the row is not in `disposal_pending` | someone already completed it, or it was never requested — re-run step A, do not force |
| `HC0D9` "objeto ainda presente no armazenamento" | step B did not happen or did not take | re-run step B for that path and confirm, then retry |
| `HC0DR` "política de retenção provisória" | a **provisional** retention policy covers this tier and the file is bound to a document | ⛔ **stop.** This is a retention decision, not an operational error. It needs ratification of the retention policy, or one of the two exemption lanes below. Escalate to the accountable owner (§1). |

The door admits exactly two exemptions to a provisional retention block, both
audited as `document.retention_override`: `disposal_reason_category =
'subject_request'`, and `'duplicate'` where a live, servable, same-`sha256`
sibling bound to the **same** document proves the record survives. The last copy
of a record has no sibling and therefore stays behind the gate — that is
deliberate, not a bug to work around.

### Step D — verify, and know what the verification is worth

```sql
-- Expect 0. If not, some rows were not completed; do not close the run.
select count(*) from public.file_objects where disposal_state = 'disposal_pending';
```

```bash
# LOCAL ONLY — the byte-level proof. Compare against the count you recorded.
node scripts/storage-manifest.mjs walk
```

## 4 · ⛔ What "verified deletion" does NOT prove

This is the most important paragraph in this document, and it is quoted from the
door's own body in the live catalog rather than paraphrased:

```sql
-- Verify ABSENCE: the Storage-API delete must already have happened.
if exists (select 1 from storage.objects o
            where o.bucket_id = v_f.storage_bucket and o.name = v_f.storage_path) then
  raise exception 'objeto ainda presente no armazenamento — descarte não confirmado'
```

The check reads **`storage.objects` — the metadata table.** It proves the
metadata row is gone. **It does not prove the bytes are gone.** A file marked
`disposed` can still have its bytes present on the storage substrate as a
metadata-less orphan, and this program has already lost 221 files (15 PHI-tier)
to exactly that state, outside any gate.

Therefore:

- **Locally**, the byte claim is provable — `node scripts/storage-manifest.mjs
  walk` reads the storage volume directly, and it is the only surface that can
  see an orphan.
- **On Cloud**, the byte claim is **not provable from any surface probed so far**
  (see FUP-DM5-CLOUD-ORPHAN-SURFACE — the S3 endpoint is the specific unprobed
  measurement that could settle it). A `disposed` state on Cloud is an assertion
  about metadata, and under Rule 12 that distinction is the whole point of a
  disposal record. **Say so in the disposal record; do not record "bytes
  destroyed" when what was verified was "metadata row absent."**

> 🔴 **LEAD RULING 2026-08-17 — this is the most serious finding in the whole
> slice, and it is tracked as FUP-DM5-NO-ANSWER-VS-NOTHING instance 3.** Unlike the
> tool-output instances of that class, which an operator reads and can second-guess,
> this one is **persisted** and **asserts a fact to a regulator**: a `disposed` row
> meaning *"metadata absent, bytes unknown"* is a **false compliance assertion**
> under LGPD / ANVISA-RDC / CFM 1821 in a 20-year-retention system.
>
> ⛔ **And on Cloud it is not merely unchecked — it is unverifiable by the method we
> have**, because the local volume proof cannot exist there. **So `disposed` can
> never mean more than "metadata gone" on Cloud unless FUP-DM5-CLOUD-ORPHAN-SURFACE
> settles that an orphan-visible surface exists, or the door's contract is amended
> to say what it actually verifies.** Every Cloud disposal record made before then
> carries a claim the platform cannot substantiate.

## 5 · Reconciliation

```bash
node scripts/document-reconciliation.mjs      # no subcommands, no flags
```

Exit 0 clean / 1 drift / 2 error; prints a full JSON report plus a one-line
verdict. It compares `public.file_objects` against Storage-API listings of
`documents-standard` and `documents-phi` in both directions, and census-counts
the eight retired + two out-of-scope buckets.

**Three things to know before you trust its verdict:**

1. **It MUTATES as an intrinsic part of running** — not opt-in, not a flag. It
   expires lapsed `reserved` upload sessions (→ `expired`, and their
   `file_objects.upload_state` → `abandoned`) and marks rows stuck in
   `verifying` for >60 min → `failed`. It never writes `disposal_state`. Do not
   run it somewhere you need a read-only observation.
2. **It lists through the Storage API, so it is blind to volume orphans.**
   Measured on 2026-08-17: `storage.objects` held 0 rows while the volume held
   245 files / 2,456,666 bytes across the four surviving buckets — a run in that
   state reports `RECONCILIATION CLEAN` while 224 real files sit under
   `documents-standard`/`documents-phi` with no metadata row at all.
3. **Its classifier is narrower than the drift it is trusted to rule out.** It
   reasons only from `file_objects` columns, with no join to
   `document_version_files` / `document_versions` / evidence tables. A file that
   is verified, servable and byte-present but bound to nothing — the
   FUP-DM5-FINALIZE-ATOMIC shape — produces **no finding at all**. And
   `disposal_pending` is classified `indeterminate` on this runbook's existence
   (§0.1).

**A clean reconciliation is therefore not evidence that disposal is complete.**
It is evidence that the metadata and the Storage API agree with each other.

## 6 · ⚠ Cloud caveats — do NOT gate a Cloud run on `capture`'s exit code

Both caveats below were measured in the S5.R rehearsal, not inferred.

**(a) `capture`'s exit code is meaningless on Cloud, and the flag that "fixes"
it is worse.** The local volume proof requires `STORAGE_BACKEND=file` plus a
`supabase_storage` Docker container on the operator's own machine. Neither can
hold for a Cloud project, so **every** bucket verdicts
`UNVERIFIED_NO_LOCAL_PROOF` and `capture` exits **1** — on a perfectly healthy
project. The only route to exit 0 is `--allow-orphans`, and that flag **also
silences genuine orphan verdicts**: it conflates *"I could not look"* with *"I
looked and found something"*, so buying a green exit code buys blindness to the
finding you actually care about (FUP-DM5-NO-ANSWER-VS-NOTHING). **Read
`manifest.residuals` and the per-bucket verdict column. Never automate on the
exit code or the "CAPTURE CLEAN" headline.**

**(b) The count comparison alone cannot certify the under-count class.** A
manifest that lists 4 of 5 present keys deletes all 4, and reports `deleted=4
manifest=4 MATCH` — **the comparison passes.** The reason is structural: the
comparison is between the manifest and *itself as executed*, never between the
manifest and reality. Only the local volume proof turns that into a failure; with
the proof unavailable the identical scenario exits **0 while a real file
survives** (rehearsal arm R6, measured). The **over-count** refusal does transfer
intact, because it is a Storage-API-only comparison (R6b). So of D9's four
controls, the two byte-side ones do not survive the loss of local proof.

**Practical consequence for a Cloud disposal run:** treat the byte half as
*asserted, not verified*, and record it that way. Rehearse the sequence locally
(`node scripts/storage-manifest.mjs rehearse` — 16 controls, all three classifier
arms) before running it against Cloud.

## 6b · ⛔ PHI HANDLING FOR THE BACKUP HALF — read BEFORE taking any Storage backup

**A Storage backup is a PHI export.** This is not a caution about a hypothetical: the S5 drill took
one, and it contained **245 files / 2,456,666 bytes including 68 PHI-tier files, in plaintext**,
outside every platform control — no RLS, no `open_document_version` door, no PHI-access audit row, no
signed-URL TTL. That is inherent to the mechanism, not a mistake in it: a whole-volume snapshot is
Supabase-unaware, which is exactly why it is the only mechanism that can capture orphans.

So the backup half of any drill or recovery **creates the widest PHI egress path this system has**.

### ✅ DECIDED (PO, 2026-08-17) — the five values

| | Decision |
| --- | --- |
| **Encryption** | **Encrypted archive** (`age`, or **7z-AES** with encrypted headers), **encrypted AT CREATION** so the bytes are **never plaintext on disk at any point**. ⛔ *Not* "`docker cp` then encrypt" — that leaves a plaintext window, and a window is all an incident needs. The **key is stored separately from the archive.** |
| **Location** | **Outside the repository AND outside any synced folder** (OneDrive, Dropbox, iCloud, Google Drive). Exact path recorded in the run log at first execution — see the sync check below, which is mandatory. |
| **Permitted reader set** | **The accountable owner alone** (§1), pre-pilot. Not shared, not uploaded, **not attached to an issue or a support ticket.** |
| **Retention** | **Until the next backup is verified good, and never more than 30 days** — whichever comes first. **Exactly one recovery point at a time.** |
| **Destruction** | **Destroy the KEY first, then delete the archive.** Log both, and what each one proves. See "Destruction" below. |

⛔ **The sync check is mandatory, and it is not paranoia.** A `docker cp` (or an archive written) into
a synced directory **silently replicates 68 PHI-tier files to a third-party cloud, and nothing in this
platform would notice** — no RLS, no audit row, no alert. The platform cannot defend a path it does
not know about. Before writing anything, confirm the destination is not inside a sync root:

```bash
# The destination must NOT be under any of these. Check the ACTUAL resolved path.
echo "$BACKUP_DIR"
case "$BACKUP_DIR" in
  *OneDrive*|*Dropbox*|*iCloud*|*"Google Drive"*|*Creative\ Cloud*)
    echo "⛔ REFUSE: destination is inside a sync root"; exit 1;;
esac
# Also confirm it is not inside the repo working tree:
git -C "$BACKUP_DIR" rev-parse --show-toplevel 2>/dev/null && echo "⛔ REFUSE: inside a git work tree"
```

### ⭐ Why retention is SHORT — read this before "fixing" 30 days upward

**The 20-year LGPD / ANVISA-RDC / CFM 1821 obligation belongs to the SYSTEM OF RECORD, not to backup
copies.** A backup retained for 20 years satisfies **nothing** and creates two decades of plaintext-
equivalent PHI liability in a second location with **no RLS, no audit trail, and no access control**.

**Short backup retention is a SAFETY property, not a compromise.** It is written here explicitly
because the obvious reading inverts it: a future reader who sees "30 days" beside a 20-year retention
regime will be tempted to "fix" the inconsistency by raising it, and would be making the system
materially less safe while believing they were improving compliance. **The two clocks are different
clocks.** Do not reconcile them.

### Taking the backup — encrypted at creation

```bash
# 1. Census FIRST — this is the number the archive will be verified against.
node scripts/storage-manifest.mjs walk        # e.g. TOTAL files=245 bytes=2456666

# 2. Stream tar straight into the encryptor. No plaintext intermediate ever exists.
#    (7-Zip: -si reads stdin, -mhe=on encrypts the file NAMES too — paths are PHI-adjacent.
#     Use the interactive -p prompt: a password on the command line leaks to shell history
#     and to the process list.)
docker exec supabase_storage_<ref> sh -c "cd /mnt && tar -cf - stub" \
  | 7z a -si -p -mhe=on "$BACKUP_DIR/storage-$(date +%Y%m%d).7z"

#    age equivalent, if installed:
# docker exec supabase_storage_<ref> sh -c "cd /mnt && tar -cf - stub" \
#   | age -p > "$BACKUP_DIR/storage-$(date +%Y%m%d).tar.age"
```

⛔ **Two traps in that one command, both measured on 2026-08-17, both of which produce a VALID,
EMPTY archive that reports success:**

1. **Use the `sh -c "cd /mnt && …"` form.** The apparently equivalent
   `docker exec … tar -cf - -C /mnt stub` **fails on Git Bash for Windows**: MSYS path translation
   rewrites `-C /mnt` to `C:/Program Files/Git/mnt`, and tar exits 1 having written **0 bytes**
   (`tar: can't change directory to 'C:/Program Files/Git/mnt'`). Alternatively set
   `MSYS_NO_PATHCONV=1`.
2. **Never suppress tar's stderr in this pipeline.** With `2>/dev/null` the failure above is silent,
   the encryptor happily consumes an empty stream, and 7-Zip prints **"Everything is Ok"**. You would
   hold an encrypted, well-formed, entirely empty backup, created by a command that reported success.
   *That is this program's `FUP-DM5-NO-ANSWER-VS-NOTHING` class — an action performed recorded as the
   state achieved — and it is why step 3 is not optional.*

```bash
# 3. VERIFY THE ARCHIVE — mandatory. Compare against the census from step 1.
7z l -p "$BACKUP_DIR/storage-<date>.7z" | tail -3     # file count must match `walk`
```

A backup whose file count has not been compared to the census is **not** a verified backup, and under
the retention rule above it may **not** be used to justify destroying the previous one.

### ⛔ "VERIFIED GOOD" MEANS CATALOG-COMPARED — never an exit code

The retention rule ("keep until the next backup is **verified good**") authorises **destroying the
only other copy**. So the word carries the weight of the whole rule, and it must not be satisfied by a
signal already proven false.

**The citation is this project's own drill, 2026-08-17.** A `supabase db dump` replayed into a bare
database:

| signal | said | truth |
| --- | --- | --- |
| `psql` exit code | **0** | 490 statements failed |
| `grep -c '^ERROR'` | **0** | psql prefixes `psql:file:line:` — the anchor matches nothing |
| catalog comparison | — | **90 of 274 RLS policies restored**, 161 of 165 tables |

An operator who replays a dump, sees exit 0, and destroys the previous backup would have destroyed a
good copy on the strength of a signal that was wrong twice over. **`psql` does not fail on statement
errors without `ON_ERROR_STOP`, and a restored database missing two thirds of its RLS is not a
database — it is a data leak wearing one.**

So, for the DB half, "verified good" is **this comparison**, run against the restored copy and the
source, with **every row equal**:

```sql
select (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
         where n.nspname='public' and c.relkind='r')                                  as tables,
       (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
         where n.nspname='public' and c.relkind='r' and c.relrowsecurity)             as rls_enabled,
       (select count(*) from pg_policies where schemaname='public')                   as policies,
       (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
         where n.nspname in ('public','app'))                                         as functions,
       (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
         where n.nspname in ('public','app') and p.prosecdef)                         as definers,
       (select count(*) from pg_trigger where not tgisinternal)                        as triggers;
```

Restore into a **scratch database**, never over the live one, and note the drill's other finding: the
dump only restores faithfully onto a target where `auth`, `storage` and `extensions` already exist
(pre-creating them plus stub `auth.uid()`/`auth.role()` took errors 490 → 10 and both tables and
policies to full parity). A bare-Postgres target is not a valid restore test.

### Destruction — cryptographic erasure is the load-bearing act

⭐ **This resolves the recursion that §4 exposes.** Deleting a file proves the **directory entry** is
gone; it does **not** prove the bytes are unrecoverable — the same substitution of an observable proxy
for the property that matters. The PO's encryption decision resolves it:

1. **Destroy the KEY first.** Cryptographic erasure is the act that counts: residual ciphertext is
   unrecoverable without the key **regardless of what the filesystem did with the blocks**.
2. **Then delete the archive.** This is hygiene, not the proof.
3. **Log BOTH, and state what each one proves** — "key destroyed (renders any residual ciphertext
   unrecoverable)" and "archive deleted (directory entry removed; block-level residue not claimed)".

That form is deliberately more honest than a `shred` claim, which we could not verify on this platform
anyway (and which is meaningless on copy-on-write filesystems, SSDs with wear levelling, and any
volume that has ever been snapshotted).

Tracked as **FUP-DM5-BACKUP-IS-PHI-EXPORT** (🔴).

## 7 · Records to keep per run

Nothing here writes an operational log automatically, so the run leaves no trace
unless the operator makes one. Keep, per run: the date, the executor, the step-A
row count, the per-row outcome (including any `HC0DR` escalation), the step-D
count, — explicitly — **whether the byte half was verified or only asserted**
(§4), and **if any Storage backup was taken: where it was written, who could read
it, and when it was destroyed** (§6b). A backup with no destruction record is an
open PHI export, not a completed step. The database's own audit trail records `document.disposed` and
`document.retention_override`, which covers *that* a disposal completed and
*who*; it does not record that the bytes were proven gone.

## 8 · When this document should be deleted

When an automated completion path exists. The two pins in §0.2 will go red on
that day. At that point: delete this runbook, delete both pins, correct the
comment above `requestDocumentDisposition` in `src/lib/documents/actions.ts`, and
close FUP-DM5-DISPOSAL-JOB — **in the same change**. A manual runbook left
standing beside a working automation is worse than no runbook, because an
operator will follow it.
