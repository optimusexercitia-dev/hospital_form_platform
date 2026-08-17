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

## 1 · ⚠ OWNER AND PERIODICITY — PROPOSED, AWAITING PO CONFIRMATION

**These two values are the only things in this document that are not measured.
They are proposals. Do not treat them as settled.** Everything else here was
verified against the live catalog or executed; these cannot be, because they are
organizational facts, not technical ones. Same handling as ADR 0114 O1/O2.

| | Proposal | Rationale | Status |
| --- | --- | --- | --- |
| **Accountable owner** | The controller's **DPO / encarregado de dados** | A PHI disposal is a controller obligation, not an infrastructure task. Whoever answers for the deletion to a data subject or a regulator should own that it happened. | ⚠ **PO to confirm the named individual** |
| **Executor** | A **named technical operator** with service-role / Cloud-dashboard reach | Not a choice — a constraint. `complete_document_disposal` grants EXECUTE to `postgres` and `service_role` only, never `authenticated`, so no user-facing role can complete a disposal however it is delegated in the org chart. | ⚠ **PO to name the individual** |
| **Periodicity** | **Weekly**, plus an out-of-band run on any `subject_request`-category disposal | Weekly bounds worst-case byte retention after an approved disposal to ~7 days. Subject-initiated requests plausibly carry a tighter statutory response window than routine retention expiry, so they should not wait for the weekly slot. | ⚠ **PO to confirm, ideally with counsel — the interval and any statutory deadline are legal determinations, not engineering ones** |

**Why the accountable owner and the executor are proposed as different people:**
the ACL forces the executor to hold service-role reach, and service-role reach
bypasses RLS entirely. Concentrating "decides what is destroyed" and "can destroy
anything" in one person removes the only separation available here. If the PO
prefers a single owner, that is a legitimate call — but it should be a decision,
not a default.

**If the PO does not confirm these values, this runbook is incomplete**, and the
reconciler's premise (§0.1) stays false in practice even though the procedure
exists on paper. A procedure with no named owner is not a mitigation.

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

## 7 · Records to keep per run

Nothing here writes an operational log automatically, so the run leaves no trace
unless the operator makes one. Keep, per run: the date, the executor, the step-A
row count, the per-row outcome (including any `HC0DR` escalation), the step-D
count, and — explicitly — **whether the byte half was verified or only asserted**
(§4). The database's own audit trail records `document.disposed` and
`document.retention_override`, which covers *that* a disposal completed and
*who*; it does not record that the bytes were proven gone.

## 8 · When this document should be deleted

When an automated completion path exists. The two pins in §0.2 will go red on
that day. At that point: delete this runbook, delete both pins, correct the
comment above `requestDocumentDisposition` in `src/lib/documents/actions.ts`, and
close FUP-DM5-DISPOSAL-JOB — **in the same change**. A manual runbook left
standing beside a working automation is worse than no runbook, because an
operator will follow it.
