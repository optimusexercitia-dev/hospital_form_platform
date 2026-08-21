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
