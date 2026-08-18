# PHI disposal runbook — manual completion + reconciliation

> **Status:** operational procedure. Created DM5 · S5.D, 2026-08-17.
> **Binding decisions:** ADR 0120 (D9 + the S5.D ruling) · ADR 0099 D10 (the "no new
> cron infrastructure" precedent) · Architecture Rule 12 (LGPD / ANVISA-RDC / CFM
> 1821-2007).
> **PO ruling this document implements:** *document the gap, do NOT build the job.*
> No `pg_cron`, no scheduled sweep, no second execution context with service-role
> reach.
>
> ## ⛔⛔ THIS PROCEDURE HAS NEVER BEEN EXECUTED END-TO-END
>
> **Status: UNREHEARSED — a BINDING open gap of DM5, not a caveat.** Added 2026-08-17 at the DM5
> phase QA (M1), which found the document carried only a *Cloud-scoped* disclaimer further down —
> so a reader of this header would reasonably assume the sequence had been run. It has not.
> *Naming an owner is not a rehearsal, and writing a runbook is not running it.*
>
> **What this means for the first operator: you are the rehearsal.** Expect to find defects in
> *these instructions*, not only in the data. Before starting, read the **20** NOT-COVERED items in
> [the S5 record](../progress/dm5-s5-operational-closure.md) § 6 — **item 18 names itself as the
> first thing to check in the first rehearsal**, and it sits in the out-of-order tail that a
> pointer-count undercount was hiding until the same review.
>
> ⚠ Rehearse locally first (`node scripts/storage-manifest.mjs rehearse`, **22 controls**) — and
> note that a green local rehearsal does **not** license the Cloud sequence; the domain limits are
> in § "Practical consequence for a Cloud disposal run".

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

> ⛔ **DO NOT CYCLE THE LOCAL STACK DURING A RUN — `supabase stop` followed by
> `supabase start` SILENTLY DESTROYS THE STORAGE VOLUME.** Measured, not suspected:
> this is how this program lost **221 files, 15 of them PHI-tier**. There is no
> warning, no prompt and no error; `docker ps` afterwards shows a healthy stack, and
> `storage.objects` still lists every row, so the loss is invisible to every SQL-side
> check — the metadata survives and the bytes do not, which is the orphan class in
> §4 arriving from the opposite direction.
>
> ⚠ **The mechanism is still undetermined** (`FUP-DM5-STACK-CYCLE-DESTROYS-BYTES`),
> so treat this as a rule, not a diagnosis to reason around. If the stack must be
> cycled, take the §6b backup **first** and verify it catalog-compared afterwards.
> ⚠ A restart of individual containers is not the same operation and has not been
> shown to do this — but it has not been shown safe either.

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

> ⛔ **TWO WAYS `supabase storage rm` LIES TO YOU. Both were hit in one hour on
> 2026-08-17, on the remote, and they fail in OPPOSITE directions.**
>
> **1 · Without `--yes` it deletes NOTHING and still exits 0.** The command hits an
> interactive `[y/N]` prompt, reads EOF in any non-interactive context (a loop, a
> script, an agent), and returns success having done nothing. A loop over 38 paths
> reported clean and removed zero objects. **Always pass `--yes`, and always
> re-`ls` before believing a deletion happened** — the exit code is not evidence.
>
> **2 · `-r ss:///<bucket>` deletes the BUCKET ITSELF, not just its contents.** The
> `-r` reads as "recursive into the contents"; it is not. The bucket was destroyed
> and had to be restored from `baseline.sql`. ⚠ **And the wreckage is invisible to
> the obvious audit**: the bucket's RLS policies live on `storage.objects`, so they
> SURVIVE the bucket's deletion and `pg_policies` still shows a complete, healthy
> policy set for a bucket that no longer exists. To delete contents, enumerate the
> paths from step A and delete them individually.
>
> Neither hazard is theoretical and neither is caught by any gate — this runbook is
> the only place they are recorded before an operator meets them.

### Step C — complete the disposal

⚠ **The signature changed on 2026-08-17 (ADR 0121 D4, migration `20260928000400`).**
The door is now `complete_document_disposal(p_file_object_id uuid, p_byte_proof text)`
and it **records what it actually verified** beside the state it writes. Passing one
argument still works — the default is `not_attempted` — but that default is the
**honest** value, not a convenient one, and using it throws away a byte proof you may
have just performed. **Pass the proof explicitly.**

```sql
-- LOCAL, and you ran the volume walk in step D and it showed the bytes gone:
select public.complete_document_disposal('<file_object_id>'::uuid, 'local_volume_verified');

-- CLOUD, where no orphan-visible surface has been found (§4):
select public.complete_document_disposal('<file_object_id>'::uuid, 'unavailable_on_platform');

-- You did not attempt a byte proof at all:
select public.complete_document_disposal('<file_object_id>'::uuid, 'not_attempted');
```

The vocabulary is **closed** — exactly those three values, enforced in the body. An
unconstrained free-text field would let an operator write anything into a
regulator-facing record, which is the same defect one layer up. Anything else raises
`check_violation` (*"prova de exclusão de bytes inválida"*).

⭐ **This does not manufacture a proof that does not exist.** On Cloud there still is
none. It stops the record from CLAIMING one — read §4, which is the whole reason this
parameter exists.

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

```sql
-- ⭐ READ THE EVIDENCE, NEVER THE STATE ALONE (ADR 0121 D4). `disposed` means
-- "the metadata row is absent"; what was verified about the BYTES is here.
select id, disposal_state, disposal_evidence
  from public.file_objects
 where id = '<file_object_id>';
```

`disposal_evidence.byte_proof` is the field a regulator-facing export must carry.
A run where every row reads `unavailable_on_platform` is a **valid** run — it is
an honest record of a Cloud disposal — but it is *not* a record that the bytes
were destroyed, and it must never be summarised as one.

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

> ### ⛔⛔ HARD STOP — ✅ PO-RATIFIED 2026-08-18 (ADR 0120 D9 amendment). Three refusals, and they are RULES, not cautions.
>
> **The under-count class is ACCEPTED AS UNVERIFIED on Cloud.** No Cloud verification step exists,
> none is being added, and the PO has ratified that limit in writing. What follows is therefore not
> advice about a weakness the tooling might later close — it is **how you are required to operate
> inside a limit that is staying.**
>
> 1. ⛔ **NEVER run `capture` against a Cloud project from a machine with a local Supabase stack
>    running.** Stop the local stack first, or run from a machine that has none. ⚠ *The tool already
>    refuses this (the `locateVolume()` origin guard, pinned by selftest C17) — this rule exists so the
>    procedure does not DEPEND on that guard.* A guard and a rule protect against different failures:
>    the guard covers this tool, the rule covers the operator's judgement about every future one.
> 2. ⛔ **NEVER treat exit 0 or the `CAPTURE CLEAN` headline as a byte-level result on Cloud.** Read
>    `manifest.residuals` and the per-bucket verdict column. `--allow-orphans` is the only route to
>    exit 0 and it **silences genuine orphan verdicts** — it buys a green bar by conflating *"I could
>    not look"* with *"I looked and found nothing"*.
> 3. ⛔ **NEVER record a Cloud byte deletion as verified.** Record it as **asserted**. ADR 0121 **D4**
>    already provides the vocabulary — `unavailable on this platform` is a true statement and
>    `local volume proof` would be a false one.
>
> ⭐ **Why the emphasis lands on a FAKE proof rather than a missing one.** A missing proof fails
> visibly and refuses. A proof computed against the wrong project's bytes **passes, with identical
> confidence** — and the configuration that produces it (a dev machine with `supabase start` up, a
> client pointed at Cloud) is the *normal* state for anyone able to run this repo's gates. **The
> failure mode is not rare; it is the default posture of the person most likely to be doing this.**
>
> ⚠ **One fact that made the 2026-08-18 ratification safe and does NOT generalise:** the remote held
> **0 `storage.objects` rows in all 12 buckets** at that date, and the under-count class needs objects
> to under-count. The eight legacy buckets were retired the same day against that empty state (remote
> now: **4 buckets, 0 objects**). ⛔ **Both figures are point-in-time and expire the moment the pilot
> loads data.** Re-measure before any run; never quote either as current — *a claim about an external
> system goes stale silently, and this runbook's whole subject is an external system.*

**Provenance, per claim, because an earlier version of this section claimed
"measured, not inferred" for all of it and one half was neither.** (b) is
**measured** (rehearsal arms R6 / R6b, local). (a)'s exit-code behaviour is
**measured**; (a)'s **Cloud** consequence is an **INFERENCE** from source, and it
has **never been executed against Cloud.** Labelled per paragraph below.

**(a) The danger on Cloud is not a MISSING proof — it is a FAKE one.**

⛔ **The sentence that used to be here was false, and it was false in the most
likely operator configuration.** It said the proof requires `STORAGE_BACKEND=file`
plus a `supabase_storage` container *"on the operator's own machine"* and that
**"neither can hold for a Cloud project"** — conflating two conditions at
different grains. The backend is a property **of the project**; the running
container is a property **of the operator's machine**. A developer machine with
`supabase start` up — the normal state for anyone who can run this repo's gates —
satisfies the container condition **while the client points at Cloud.**

**Source-level fact (certain):** `locateVolume()` finds the container **by name
pattern via `docker ps`** and derives the root from that container's own env. It
is never given the project URL, and nothing cross-checks the two — the manifest
prints `supabaseUrl` and `localProof.container` side by side and compares neither.

**Inference (NOT executed against Cloud, and it must not be recorded as though it
were):** an operator running this tool against Cloud from a machine with a local
stack up would get `localProof.available = true`, a census of the **wrong
project's** volume, and — for any manifest bucket absent locally — a printed
**byte-level assurance for a Cloud deletion that was never checked.** *No proof
refuses visibly; a proof about the wrong bytes passes.* That is strictly worse
than losing the proof.

✅ **NOW GUARDED IN THE TOOL, so this is no longer left to operator discipline.**
`locateVolume()` refuses when `NEXT_PUBLIC_SUPABASE_URL` is not a local origin
while a local container is running, and downgrades the proof to unavailable with
the reason printed. Measured 2026-08-17 with a Cloud URL against a running local
stack:

```
⚠ LOCAL PROOF UNAVAILABLE — the Storage client points at https://<ref>.supabase.co,
which is not a local origin, while a local supabase_storage container is running.
REFUSING to attribute this machine's volume to that project: the container is found
by name via `docker ps` and has NO project affinity, so the census would be a
byte-level proof about the WRONG bytes.
```

The guard lives in `locateVolume()` itself, so **every** subcommand inherits it,
and both polarities are pinned by selftest **C17** (every local origin local,
every remote/malformed origin not).

**So the exit-code rule, correctly stated:** `UNVERIFIED_NO_LOCAL_PROOF` and exit
**1** for every bucket is what a Cloud run yields **when no local stack is
running** — and now also when one *is*, because the guard downgrades it. Either
way the only route to exit 0 is `--allow-orphans`, which **also silences genuine
orphan verdicts**: it conflates *"I could not look"* with *"I looked and found
something"*, so buying a green exit code buys blindness to the finding you care
about (FUP-DM5-NO-ANSWER-VS-NOTHING). **Read `manifest.residuals` and the
per-bucket verdict column. Never automate on the exit code or the "CAPTURE CLEAN"
headline.**

**(b) The count comparison alone cannot certify the under-count class.** A
manifest that lists 4 of 5 present keys deletes all 4, and reports `deleted=4
manifest=4 MATCH` — **the comparison passes.** The reason is structural: the
comparison is between the manifest and *itself as executed*, never between the
manifest and reality. Only the local volume proof turns that into a failure; with
the proof unavailable the identical scenario exits **0 while a real file
survives** (rehearsal arm R6, measured). The **over-count** refusal does transfer
intact, because it is a Storage-API-only comparison (R6b). So of D9's four
controls, the two byte-side ones do not survive the loss of local proof.

**(c) A bucket whose bytes are gone while its metadata survives.** ⛔ Until
2026-08-17 this verdicted `CONSISTENT_EMPTY` → **CAPTURE CLEAN → exit 0**, and it
was **non-monotonic**: losing *some* of a bucket's bytes was dirty (exit 1), losing
*all* of them was clean (exit 0) — the worse state reported better. ⚠ *Both halves
of that comparison are now measured — R7 (total loss) and R9 (partial loss); until
QA r2 the partial half was asserted here and observed by nobody, which is half a
claim in the sentence that justified the fix.* That is what a
storage-volume loss with the database intact produces. **Fixed** (it is now
`MISSING_BYTES`, dirty) and pinned by rehearsal **R7** with its permissive twin,
plus selftest **C14/C15**. Named here because it is the direction an operator is
least likely to suspect: the metadata still advertises the PHI file as present and
servable, and `document-reconciliation.mjs` lists from that same API, so it cannot
see it either.

**Practical consequence for a Cloud disposal run:** treat the byte half as
*asserted, not verified*, and record it that way. Rehearse the sequence locally
(`node scripts/storage-manifest.mjs rehearse` — **22 controls**; ⭕ this line said **18** until the
DM5 phase QA, which is the **`selftest`** count, not `rehearse`'s — *citing a sibling command's total
means an operator who sees 22 pass cannot tell whether the doc is stale or the tool changed*. Verified
by running it: `R0 R1 R1x R2 R2b R3a R3b R3b-diagnosis R3c R3d R4a R4b R5 R6 R6-capture R6-residual
R6b R7 R7-twin R8 R9 R9-monotonic` = 22; `selftest` is `C1`–`C18`) before running it
against Cloud. ⚠ And note what the local rehearsal does **not** cover: it runs
against a local stack by construction, so it cannot exercise the Cloud paths above
— the guard in (a) is what makes the "LOCAL stack only" domain enforceable rather
than advisory.

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

Paste this as a **function** and call it. ⛔ Three defects in the first version of
this snippet, all found by QA r1, all of which made it *look* like a check:
`exit 1` inside a pasted snippet **kills the operator's interactive shell** (so it
gets deleted rather than fixed); the git half only **echoed** and never failed, so
"inside the repo" was advisory while OneDrive was fatal, with **no visible
difference**; and the patterns were **case-sensitive**, so a lowercased path
matched nothing.

```bash
phi_backup_dir_ok() {                      # returns 1 — never exits your shell
  d=$(cd "$1" 2>/dev/null && pwd -P) || { echo "⛔ REFUSE: no such directory: $1"; return 1; }
  # Case-INSENSITIVE match, and the resolved physical path (`pwd -P`), so a
  # symlink into a sync root cannot slip past.
  lower=$(printf '%s' "$d" | tr '[:upper:]' '[:lower:]')
  for s in onedrive dropbox icloud "google drive" "creative cloud" nextcloud \
           syncthing pcloud box\ sync mega tresorit "yandex.disk" seadrive; do
    case "$lower" in *"$s"*) echo "⛔ REFUSE: '$d' is inside a sync root ($s)"; return 1;; esac
  done
  if git -C "$d" rev-parse --show-toplevel >/dev/null 2>&1; then
    echo "⛔ REFUSE: '$d' is inside a git work tree"; return 1   # now FAILS, not echoes
  fi
  echo "✅ '$d' is acceptable — record this exact path in the run log"
}

phi_backup_dir_ok "$BACKUP_DIR" || echo "STOP — do not write PHI here"
```

⚠ **The list is not exhaustive and cannot be.** A sync client with a custom folder
name defeats it. The check is a floor, not a proof — if you are unsure whether a
directory is synced, **look in the sync client**, not only here.

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
# 3. VERIFY THE ARCHIVE — mandatory, and the two sides must have the SAME
#    denominator by construction. Compare the archive against a count taken over
#    the SAME tree the archive was built from:
docker exec supabase_storage_<ref> sh -c "find /mnt/stub -type f | wc -l"   # source of truth
7z l -p "$BACKUP_DIR/storage-<date>.7z" | tail -3                          # must match it
```

⚠ **Do NOT compare the archive against `walk`'s TOTAL** — QA r1 caught this. `walk`
counts over `ALL_KNOWN_BUCKETS` (12 names), while the archive contains **everything
under `/mnt/stub`**. Today the two agree (**245 = 245**, measured) *only because*
the volume root happens to hold nothing but the four survivor directories. Add a
thirteenth bucket, or any stray directory, and the numbers diverge for a perfectly
benign reason — **and a mandatory verification whose two numbers can disagree
harmlessly is a verification that will be waived.** The `find` form above has the
same denominator as the archive by construction, so it cannot drift.

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

⛔ **But the load-bearing act needs a MECHANISM, or the log line attests to nothing.** QA r1: the
first version of this section said only *"key stored separately"* and *"Destroy the KEY first"* — so
the mandated line *"key destroyed"* had **no verifiable referent**, which re-instantiates the very
class it resolves, one level down. **Choose ONE custody mode before you take the backup, record which,
and use its log wording. They are not interchangeable.**

| custody mode | how it is destroyed | what the log line may claim |
| --- | --- | --- |
| **A · Passphrase typed at the `-p` prompt and never written down** (the default for a same-day drill) | nothing to destroy — it only ever existed in the operator's head and the process's memory | ⛔ **NOT** "key destroyed". Log: *"no key copy existed to destroy (passphrase never persisted); recoverability of the archive ends with the operator's memory of it."* ⚠ This mode makes the archive **unrecoverable by anyone else** — never use it for a backup someone else may need to restore. |
| **B · Keyfile at a stated path** (e.g. `age` identity file, or a passphrase in a file) | delete the keyfile, and record the path | *"keyfile `<path>` deleted (directory entry removed; block-level residue not claimed). Any residual ciphertext is unrecoverable without it."* |
| **C · Password-manager entry** (named vault + entry title) | delete the entry **and** empty that tool's trash/deleted-items | ⚠ *"entry `<vault>/<title>` deleted and its trash emptied."* **This inherits the manager's sync, backup and undelete semantics** — a synced vault may retain it server-side or in another device's cache, so it is **exactly as unverifiable as `rm` was** unless you can confirm the tool's retention behaviour. Say which you confirmed. |

Then, in order:

1. **Destroy the KEY first**, by the mode you chose above. Cryptographic erasure is the act that
   counts: residual ciphertext is unrecoverable without the key **regardless of what the filesystem
   did with the blocks**.
2. **Then delete the archive.** This is hygiene, not the proof.
3. **Log BOTH, and state what each one proves** — the key line in the exact wording its custody mode
   permits (table above), and *"archive deleted (directory entry removed; block-level residue not
   claimed)"*. **Never write a line that asserts an act that did not occur** — that is the defect
   here, not the phrasing.

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
it, and when it was destroyed** (§6b).

**The template, with the one slot this document cannot fill for you:**

```
run date / executor:
step-A pending count:
per-row outcome (id → byte_proof value passed in step C):
step-D pending count (must be 0):
byte half:  local_volume_verified | unavailable_on_platform | not_attempted
BACKUP DESTINATION (absolute path):  ______________________________________
    ⛔ MUST be filled at first execution and MUST have passed phi_backup_dir_ok
       (§6b). Deliberately blank here: it is per-machine, and a path invented by
       this document is a path nobody checked. An empty slot is a blocked run,
       NOT an optional field — the §6b decision "Location: exact path recorded in
       the run log at first execution" is discharged HERE or nowhere.
backup destroyed (key first, then archive) — date + what each act proves:
``` A backup with no destruction record is an
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
