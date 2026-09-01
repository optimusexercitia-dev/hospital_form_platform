# PHI backup run log

> Companion to [`phi-disposal-runbook.md`](./phi-disposal-runbook.md) § 7 ("Records to keep per
> run"). One `##` section per run, newest first. **The runbook says the backup destination path is
> "recorded in the run log at first execution" — this file is that log, and it is where the § 6b
> *Location* decision is discharged or nowhere.**
>
> ⛔ **A run recorded here is scoped to the half it actually executed.** The runbook has two halves
> that are independently executable: the **disposal** half (§ 3 steps A–D) and the **backup** half
> (§ 6b). A backup-half run does **not** discharge Critical FUP **C1a**, and no local run of either
> half discharges **C1b** — see the § 6 domain limits. Say which half ran, in the heading.

---

## 2026-08-31 (second run) — DISPOSAL HALF (§ 3), local stack — ✅ COMPLETED END-TO-END, twice

**Scope.** § 3 steps A–D, run to completion on **two** constructed file objects — one
`documents-standard` (tier `standard`), one `documents-phi` (tier **`phi`**) — through the
**`subject_request` exemption lane**, which is the lane ADR 0118 § 10 provides *for exactly this
case*: an LGPD Art. 18 request passes a provisional retention policy. No backup (§ 6b) was taken.

⭐ **This discharges C1a** — the sequence has now been executed end-to-end, which is what the
runbook's `⛔⛔ THIS PROCEDURE HAS NEVER BEEN EXECUTED END-TO-END` banner was about. **That banner
should now be revised** (it is the first thing a reader sees and it is no longer true of § 3).
⛔ It does **not** discharge **C1b** (Cloud) — the byte proof is local-only by construction — and
it says nothing about **column** PHI (`phi-column-disposal-procedure.md`).

⚠ **What it did NOT prove, stated plainly.** The provisional retention policy is **still
unratified**, and the pre-existing `entered_in_error` row was **still blocked** (see the run below). This
run went *around* the retention gate by the lane that is designed to be gone around; it did not
open it. Any file whose reason is neither `subject_request` nor `duplicate` remains undisposable
until ADR 0114 O1's three open questions are ruled.

**Executor:** lead session, service-role reach via `psql -U postgres`. Local, `main` `34a0e854`.

### The record

| field | standard-tier run | PHI-tier run |
| --- | --- | --- |
| **file_object** | `37f782f3-8436-4522-a636-9720a39b5790` | `6eff8f83-1d47-4e45-b971-8544b4a49488` |
| **bucket / tier** | `documents-standard` / `standard` | `documents-phi` / **`phi`** |
| **reason** | `subject_request` | `subject_request` |
| **step-A pending count** | 2 (this row + the blocked pre-existing row) | 2 |
| **step B** | `storage rm … --yes` → `{"deleted":[…]}`; **re-`ls` → `{"paths":[]}`** | same |
| **byte proof (walk)** | 244 → **243** files, 3 897 226 → **3 897 058** B | 109 → **108** files, 2 732 346 → **2 732 178** B |
| **step C** | `complete_document_disposal(…, 'local_volume_verified')` → OK | OK |
| **byte half** | **`local_volume_verified`** — earned, not asserted | **`local_volume_verified`** |
| **document cascade** | `disposed` · title `[removido]` · description NULL · `deleted_at` set | same |
| **audit** | `document.disposition_requested` → **`document.retention_override`** → `document.disposed` | same |
| **BACKUP DESTINATION** | n/a — no backup taken | n/a |

Exactly **168 bytes** — the file's size — left the volume in each run. The delta is the proof;
`disposal_state = 'disposed'` on its own would have been satisfied by a metadata-only delete.

⭐ **The `document.retention_override` audit row is the artifact that matters.** The exemption lane
does not bypass the retention gate silently — it records that it was taken, with the lane name, on
the hash-chained trail. That is the difference between an exemption and a hole.

### Fidelity — how the state was constructed

The pending rows were **not** hand-set with an `UPDATE`. Each was created as a real document
(`securable_resources` → `documents` → `document_versions` → `file_objects` →
`document_version_files`), its file object walked through the **real D9 upload machine**
(`reserved → uploaded → verifying → scan_pending → clean` — the guard rejects any other birth or
transition), its bytes uploaded through the **Storage API**, and then parked at `disposal_pending`
by the **real inflow door** `request_document_disposition(document, 'subject_request')`. Only § 3
itself was the thing under test.

### ⚠ Defects found in the instructions — the rehearsal's actual yield

1. ⛔ **`supabase storage cp` does not work on the local stack.** The CLI answers
   `LegacyStorageUnsupportedOperationError: Unsupported operation`, suggesting `cp -r` between
   local directories. There is **no documented way to put an object into local Storage through the
   CLI**; a `@supabase/supabase-js` service-role client is required. Anyone rehearsing has to
   construct fixture bytes and will hit this immediately.
2. ⛔ **A helper script must live inside the repo.** Run from a scratch directory it dies on
   `ERR_MODULE_NOT_FOUND: @supabase/supabase-js` — Node resolves `node_modules` upward from the
   *script's* path, not the cwd.
3. ⚠ **`new Blob([…])` is rejected.** Both document buckets enforce `allowed_mime_types`; a typeless
   Blob arrives as `application/octet-stream` and is refused, and supabase-js does **not** let the
   `contentType` option override the Blob's own type. Pass `new Blob([…], { type: 'text/plain' })`.
4. ⛔ **Impersonation needs the `active_role` hat, and the failure is misleading.**
   `set local request.jwt.claims` with only `sub` + `role` resolves `auth.uid()` correctly, and
   `app.can_write_document(doc, uid)` called directly as `postgres` returns **true** — yet the door
   refuses with *"apenas a coordenação pode solicitar o descarte"*. The flip is in
   `app.is_staff_admin_of_for`, which is hat-dependent (ADR 0106): **true** as `postgres`, **false**
   as `authenticated` with no `active_role` claim. Add `"active_role":"staff_admin"` — the shape
   `test_helpers.claims_for` builds. ⚠ A rehearser who tests the predicate directly gets a green
   that the door then contradicts.
5. ⚠ **The runbook's header says the local rehearsal is "22 controls"; it is 25.**
6. ⛔ **§ 3 Step B needs a retention-gate warning** — carried from the blocked run below, and this
   run is why it matters: had that row's bytes been deleted before `HC0DR` was discovered, they
   would be gone with the row still `disposal_pending`. **Check the retention gate before Step B.**

### Residue — cleaned up, and what the cleanup revealed

The run left two scratch documents (`[removido]`), two `disposed` file objects and their audit
rows. The trail is append-only and hash-chained, so none of it was deleted by hand; **`supabase db
reset --local` was run afterwards** (501/501 migrations, exit 0) and cleared all of it —
`[removido]` documents **0**, `disposed` file objects **0**.

⛔ **Two corrections the reset forced, both of which change what the next operator should expect.**

1. **`seed.sql` creates ZERO `file_objects`** — `grep` count 0, and `file_objects` is **0** after a
   clean reset. The `entered_in_error` row that blocked the first run was therefore **pre-existing
   residue from earlier sessions, not fixture**. Earlier wording in this log and in PROGRESS.md
   called it "the seeded row"; that was wrong and is corrected above. **Consequence: after a fresh
   reset there is NOTHING in the disposal queue at all**, so § 3 cannot be rehearsed as written —
   constructing the pending state is a mandatory first step, not an optional convenience. The
   runbook does not say this and should.
2. **The reset converted every remaining metadata row into an orphan.** `storage.objects` is now
   **0** while the volume still holds **372 files / 6 637 672 B, 108 of them PHI-tier**. This is the
   exact mechanism `storage-manifest.mjs` documents (699-vs-0 at DM5 step 0) — observed live here:
   the orphan population **grows monotonically with every reset**, because the metadata is truncated
   and the bytes are not. ⚠ On a developer machine that resets often, "PHI bytes on disk with no
   row pointing at them" is the steady state, not an anomaly.

## 2026-08-31 — DISPOSAL HALF (§ 3), local stack — ⛔ BLOCKED AT STEP C, `HC0DR`

**Scope.** This run executed the **§ 3 disposal half**, steps A–D, on the local stack. It took
**no backup** (§ 6b not executed), so no backup destination, reader-set check or destruction
record applies to it.

⛔ **This run does NOT discharge C1a.** The sequence did not complete: the single pending row is
blocked by a provisional retention policy, and the runbook's own Step-C table says the correct
response to `HC0DR` is **stop and escalate to the accountable owner**, not force. C1a stays open.
⛔ It discharges nothing about **C1b** (Cloud) either, and nothing about **column** PHI — this
runbook is the Storage-bytes substrate only (see its header; `phi-column-disposal-procedure.md`
is the other one).

**Executor:** lead session, service-role reach via `psql -U postgres` in
`supabase_db_azkbbhskturikxpgmafq`. Local catalog at `main` `34a0e854`, 501/501 migrations.

### The record

| field | value |
| --- | --- |
| **run date / executor** | 2026-08-31 · lead session, local |
| **half executed** | § 3 **disposal** (steps A–D); § 6b backup: not executed |
| **preconditions** | documents flags all `t` (7 of 7) · unreleased legal holds **0** · service-role reach ✅ · door signature `(p_file_object_id uuid, p_byte_proof text)` confirmed against `pg_proc`, matching Step C |
| **step-A pending count** | **1** — `8a1ab843-add6-4de9-b6dc-ff99c5ea117c`, bucket `documents-standard`, tier `standard`, reason `entered_in_error`, 242 bytes |
| **per-row outcome** | ⛔ **`HC0DR` — "política de retenção provisória — descarte bloqueado até ratificação"**. No `byte_proof` was passed; Step C never completed. |
| **step-D pending count** | **1** (must be 0) — run not closed |
| **byte half** | **not_attempted** — and deliberately so; see "Why Step B was not run" |
| **BACKUP DESTINATION** | n/a — no backup taken this run |
| **backup destroyed** | n/a |

### Why Step B was NOT run — the order matters in the other direction too

The runbook mandates Storage-delete **first**, door **second**, because the door verifies absence.
⚠ **The converse hazard is not stated in § 3 and cost nothing here only because the retention gate
was checked first:** had Step B run before the `HC0DR` block was known, the bytes would be gone
while the row stayed at `disposal_pending` and its `storage.objects` row vanished — manufacturing
exactly the invisible-orphan class § 4 is about, by following the procedure as written. **Check the
retention gate before deleting anything.** Recommend folding this into § 3 Step B.

### Evidence — the block was measured, not inferred

Both probes ran inside `begin; … rollback;`; a post-check confirmed the row still reads
`disposal_pending` / `entered_in_error` / evidence `null`.

| probe | input | result |
| --- | --- | --- |
| 1 | the row as-is | **`HC0DR`** raised at body line 69 — the retention block |
| 2 | same row, reason forced to `subject_request` (rolled back) | **`HC0D9` "objeto ainda presente"** at line 84 |

Probe 2 is the differential: it reaches a *later* check, proving the retention block is the **only**
thing standing in this row's way, that the `subject_request` exemption lane works, and that the
absence check is live. `v_bound` = `t`, `v_provisional` = `t` (`document_retention` holds one
`is_provisional` catch-all, `applies_to_tier` NULL — ADR 0114 O1, values still awaiting PO +
legal/clinical sign-off), `reason` = `entered_in_error`, which is neither exemption lane. So
`v_bound ∧ v_provisional ∧ ¬v_exempt` → raise.

### Step D — the volume walk ran, and it found something

`node scripts/storage-manifest.mjs walk` (read-only, exit 0):

| | volume | `storage.objects` |
| --- | ---: | ---: |
| `documents-standard` | 243 | 20 |
| `documents-phi` | **108** | **2** |
| `form-assets` | 12 | 0 |
| `meeting-audio` | 9 | 0 |
| **total** | **372 files / 6,637,672 bytes** | **22** |

⚠ **350 files on the local volume carry no metadata row, 108 of them PHI-tier.** This is the known
`db reset` orphan mechanism the tool was built for (its header records 699 vs 0 at DM5 step 0, and
the 2026-08-19 backup run censused 812 / 231) — recorded here because the *current* magnitude was
not on file, and because it means **the local volume is not a clean substrate for a disposal
rehearsal**. Not a live exposure: every Storage read path resolves metadata first, so orphans are
unservable. It is a data-at-rest / disposal-assertion problem (Rule 12, LGPD) and this is **synthetic
E2E seed PHI**, not patient data.

### Rehearsal harness — green

`node scripts/storage-manifest.mjs rehearse` → **25/25 controls passed**, exit 0, against its own
disposable bucket. ⚠ **The runbook's header says "22 controls"** — stale; it is 25. Domain limit
restated by the harness itself: a green local rehearsal does **not** license the Cloud sequence.

### What this run owes the PO

**A retention ruling.** `document_retention`'s only row is the provisional catch-all from ADR 0114
O1 ("*values await PO + legal/clinical sign-off*"). Until it is ratified, **every** bound file whose
reason is not `subject_request` or `duplicate` is undisposable — so this is not a property of the
one pre-existing row, it is the gate's steady state. Three ways forward, in the runbook's own terms:
ratify the policy; or rehearse through an exemption lane by constructing a `subject_request` pending
row; or rehearse on an unbound file object, where `v_bound` is false and the block cannot fire.

## 2026-08-19 — BACKUP HALF ONLY (§ 6b), local stack, first execution

**Scope, stated before anything else.** This run executed **§ 6b only** — census → encrypted-at-
creation archive → catalog-compared verification → key-first destruction. It did **not** execute
§ 3 steps A–D.

| this run does NOT discharge | why |
| --- | --- |
| **C1a** (local disposal rehearsal) | § 3 was not run. ⚠ This row previously added *"and is separately blocked by `FUP-DISPOSAL-CHILD-LOCK-BLOCKS-PHI-ERASURE`"* — **corrected 2026-08-19: it never was** (that defect is on the meeting-minutes path; this runbook is the `file_objects`/Storage path, and the two are disjoint in the catalog). § 3 is un-run for its own reasons. |
| **C1b** (Cloud) | the mechanism exercised here is **local-only by construction** — finding **F5** below is that it has no Cloud form at all. |
| the § 3 UNREHEARSED banner | it is about the disposal sequence, and stays accurate. |

**Executor:** repo owner (PO), local session. ⭐ Note the backup half needs **docker reach**, not
service-role reach — a different capability from the § 1 executor constraint, which is about
`complete_document_disposal`'s ACL.

### The record

| field | value |
| --- | --- |
| **run date / executor** | 2026-08-19 · repo owner (PO), local session |
| **half executed** | § 6b **backup** only (§ 3 disposal: not executed) |
| **target** | local stack, container `supabase_storage_azkbbhskturikxpgmafq`, volume path `/mnt/stub` |
| **census (source of truth)** | **812 files / 14,691,282 bytes**, of which **231 PHI-tier** (`documents-phi`) |
| **per-bucket** | `documents-standard` 534 · `documents-phi` 231 · `form-assets` 24 · `meeting-audio` 23 |
| **BACKUP DESTINATION (absolute path)** | **`D:\phi-backups`** — passed `phi_backup_dir_ok` **and** the new reader-set check (F1). Deliberately a **separate volume** from the C: drive that holds the Docker storage volume it protects. |
| **key custody mode** | **B — keyfile at a stated path** |
| **keyfile path** | `C:\Users\micha\phi-backup-keys\storage-20260819.key` (66 bytes, `openssl rand -base64 48`) — **a different volume from the archive**, discharging "key stored separately" |
| **archive** | `D:\phi-backups\storage-20260819.tar.enc` · 17,963,040 bytes · `sha256 57ad37630f8b91d056046afd7074d55a4dba7dc39f8c2390a6aecb19a663a244` |
| **encryption** | `aes-256-cbc`, PBKDF2 `-iter 600000 -md sha512 -salt`, **encrypted at creation** — `tar` streamed straight into `openssl enc`; **no plaintext intermediate ever existed on disk** |
| **verified good** | ✅ **CATALOG-COMPARED**: archive regular files **812** == `find /mnt/stub -type f` **812**; per-bucket tally inside the archive reproduces the census exactly |
| **content proof** | one `documents-phi` object restored **to a pipe** (never to disk): `sha256 c0d5f778640fc2018cc22991ed6919dcd9e7f1b6d31d6d176e2865141ffc5b9b` equal on both sides — the archive restores **bytes**, not just names |
| **retention** | **none — no recovery point retained.** This was a drill; the destruction step is part of what was being rehearsed and cannot be rehearsed without performing it. The 30-day clock therefore never started. |
| **backup destroyed** | **key first, then archive** — wording below |

**Destruction, in the exact wording custody mode B permits:**

> *"keyfile `C:\Users\micha\phi-backup-keys\storage-20260819.key` deleted (directory entry removed;
> block-level residue not claimed). Any residual ciphertext is unrecoverable without it."*
>
> *"archive `D:\phi-backups\storage-20260819.tar.enc` deleted (directory entry removed; block-level
> residue not claimed)."*

Both directories were confirmed **empty** afterwards. Between the two acts, a decrypt attempt with a
freshly generated key returned `bad decrypt` — recorded because it is the only outcome available once
the key is gone, **not** because it proves anything about the deleted blocks.

### Controls run, and what each proves

⭐ The verification is the whole load-bearing step (the retention rule authorises destroying the only
other copy). So it was **proven able to refuse** before it was believed:

| control | result |
| --- | --- |
| **empty-source archive** — tar of an empty directory, encrypted the same way | built a **valid, well-formed 10,272-byte** archive with pipe status `0 0`; the count comparison **REFUSED** it (0 ≠ 812) ✅ |
| **runbook trap #1** — `docker exec … tar -cf - -C /mnt stub` | still reproduces exactly as documented: `can't change directory to 'C:/Program Files/Git/mnt'`, **0 bytes**, tar rc=1 ✅ |
| **wrong-key decrypt** | fails `bad decrypt` ✅ (padding check, **not** authentication — see the integrity note under F4) |
| **reader-set check** (new, F1) | 3 controls: unhardened dir on D: **REFUSED** · a dir with an extra named group **REFUSED** · nonexistent path **REFUSED**; the two hardened subjects **ACCEPTED** ✅ |

Also measured, and recorded because the runbook warns it can drift: today `walk`'s TOTAL and
`find /mnt/stub -type f` **both** report 812. That is today's coincidence, not a rule — the
same-denominator `find` form is still the one the verification uses.

---

## Findings — six, all measured, all folded back into the runbook

### F1 · ⛔ The mandatory sync check green-lit a world-readable destination

`phi_backup_dir_ok "D:\phi-backups"` returned **✅ "acceptable — record this exact path in the run
log"**. The directory's actual ACL, inherited from the D: root, was:

```
BUILTIN\Administrators:(I)(F)
NT AUTHORITY\SYSTEM:(I)(F)
NT AUTHORITY\Authenticated Users:(I)(M)      <-- every authenticated user can MODIFY
BUILTIN\Users:(I)(RX)                        <-- every local account can READ
```

So the encrypted PHI archive sat where **every local user could read it**, with the runbook's own
mandatory check reading as sign-off. The check asks two questions — *is it synced? is it in git?* —
and answers a third the operator hears: *is it safe to write PHI here?* That is this program's
dominant failure class (an observable proxy substituted for the property that matters, failing in the
reassuring direction), inside the control written to prevent exactly this.

⭐ **And note which choice exposed it.** `C:\Users\micha\<anything>` inherits owner + SYSTEM +
Administrators only, so the C: candidate would have been quietly fine and the defect invisible.
Putting the backup on a **separate volume** — the better backup practice — is what surfaced it. A
data-drive root grants `Users:(RX)` by Windows default.

**Fixed:** inheritance broken on both directories, owner-only (`icacls /inheritance:r /grant:r`), and
a `phi_backup_dir_readers_ok` check added to § 6b beside the sync check.

⚠ The new check is an **allow-list, not a deny-list** — my first version was a deny-list of known-bad
principals and it **passed its own positive control**, printing `BUILTIN\Users:(RX)` and returning ✅.
The calibration run then found `MIKE_PC\CodexSandboxUsers:(RX)` on an unrelated directory — a
principal no hand-written list would ever contain. Enumerate what is *permitted*; report everything
else.

### F2 · The documented `7z` command cannot be run non-interactively at all

`7z a -si` consumes the tar stream on **stdin**, so the passphrase can only come from the interactive
`-p` prompt — and § 6b (correctly) forbids `-p<password>` on the command line, which leaks to shell
history and the process list. There is no third option: no keyfile flag, no fd, no env var. So the
one mechanism the runbook printed is **unusable by any script, any automation, and any operator not
sitting at the terminal** — which the item itself flags as the likely future (*"any future automated
backup will be built on one of these two mechanisms"*).

**Fixed:** § 6b now carries an `openssl enc … -pass file:` form as the mechanism for **custody mode
B**, which streams, takes no interactive prompt, and puts no secret in `argv`. `7z`/`age` remain for
mode A. The mechanism is now stated **per custody mode**, because they were never interchangeable.

### F3 · `-pass file:` needs a Windows-form path — an MSYS path yields a 0-byte archive, `tar` exit 0

Measured. With `-pass "file:/c/Users/…/key"` openssl cannot open the keyfile, and the pipeline writes
a **0-byte** archive while `PIPESTATUS[0]` (tar) is **0**. This is the **third** instance of the
runbook's own path-translation trap class, after `-C /mnt` → `C:/Program Files/Git/mnt`. Use
`cygpath -m` for every path handed to a native binary; use shell redirection (`> "$ARCHIVE"`) rather
than `-out` so the archive path never crosses that boundary at all.

### F4 · `set -o pipefail` is required — "don't suppress stderr" is necessary but NOT sufficient

Trap #2 in § 6b says never suppress tar's stderr, because the failure goes silent and the encryptor
reports success. Measured with stderr **fully visible**:

```
tar: can't change directory to 'C:/Program Files/Git/mnt': No such file or directory
PIPELINE EXIT STATUS: $?=0        <-- what a script would branch on
archive size: 32 bytes            <-- well-formed, entirely empty inside
```

A human sees the stderr line. A script sees `0`. Both get a 32-byte "archive". stderr visibility
protects only the operator who is watching — **the exit status is the part that lies**, and it lies to
the automation this item predicts will be built.

⚠ Related, stated so it is not over-read: `aes-256-cbc` is **not authenticated**. The wrong-key
failure above is a padding check, not integrity. The archive's integrity anchor is the recorded
`sha256` of the ciphertext plus the count comparison — not the cipher.

### F5 · 🔴 The procedure has NO Cloud form, and Cloud has no Storage backup at all

`docker exec` against a Supabase-managed project is impossible, so § 6b's mechanism is **local-only by
construction**. What is available on Cloud, measured against Supabase's own documentation:

- **Managed daily backups and PITR do not cover Storage.** *"Database backups do not include objects
  you store via the Storage API, as the database only includes metadata about these objects."*
  ([Database Backups](https://supabase.com/docs/guides/platform/backups))
- **"Restore to a new project" does not copy them either** — storage objects and bucket settings are
  listed under *what needs manual reconfiguration*.
- **The CLI has no streaming form.** `supabase storage cp` takes a destination **path**; `-r` writes
  plaintext files to disk. So on Cloud the § 6b decision *"encrypted AT CREATION, never plaintext on
  disk at any point"* is **unsatisfiable with the available tooling**, and the docs' own advice
  ("download storage objects… store in a secure location") is precisely the plaintext export this
  item exists to govern.

⇒ On the platform the pilot actually runs on, there is **no Storage backup** — not a governed one, not
an ungoverned one, not a managed one. The § 2 instruction *"if the stack must be cycled, take the
§ 6b backup first"* has no Cloud analogue, and neither does the retention rule's premise that a
previous recovery point exists. Filed as **`FUP-DM5-BACKUP-HAS-NO-CLOUD-FORM`**.

### F6 · 🟠 The DB half's own artifacts are ungoverned

§ 6b is titled *"PHI handling for the backup half"* but its five values are scoped to **"a Storage
backup" / "the archive"**. The same section instructs the operator to `supabase db dump` and restore
into a **scratch database** to establish "verified good". Both artifacts are plaintext PHI on Cloud,
and **neither has a location, reader-set, retention or destruction rule**:

- the **dump file** — a plaintext `.sql` containing every narrative, identifier and answer;
- the **scratch database** — which the runbook itself describes as *a database missing two thirds of
  its RLS*, and never says to destroy.

*A procedure whose correct execution produces an undocumented plaintext PHI copy is not a complete
procedure* — this item's own sting, one level down, in the section that resolved it. Filed as
**`FUP-DM5-DB-DUMP-AND-SCRATCH-DB-UNGOVERNED`**.
