# Follow-ups — live detail (OPEN items)

Full bodies of **open** follow-ups, rotated out of PROGRESS.md 2026-08-08 to keep the
tracker small (CLAUDE.md §7). PROGRESS.md keeps a one-line index (id · severity · title ·
owner) — **update BOTH when an item changes state**. Resolved items move to
[follow-ups-archive.md](./follow-ups-archive.md), same as before; the parked backlog stays
in [deferred-backlog.md](./deferred-backlog.md).

### ⬛ Resolved — rotated 2026-08-13 (the DM2 Record step): **FUP-DM1-CEILING** (D15 ceiling, DM2·S1 + S4) · **FUP-DM1-E2E** (6+1 specs rewritten, DM2·S4) · **FUP-DM1-DISPOSE** (`dispose_case_phi` arm restored, DM2·S2) — each verified independently, not accepted from a report → [follow-ups-archive.md](./follow-ups-archive.md)

### ⬛ FUP-DM5-NO-ANSWER-VS-NOTHING — ✅ **ALL SIX INSTANCES CLOSED 2026-08-19** — *"I could not look"* is not distinguished from *"I looked and found nothing"* (owner: backend + lead; **a design-level blind spot, filed as a CLASS**)

> ## ✅ CLOSED 2026-08-19 — the last open instance is fixed, and the class statement is KEPT
>
> **Instance 1 (`--allow-orphans`) — the item's own "remaining surface" — is FIXED**, by ADR
> [0128](../decisions/0128-unproven-is-not-clean-capture-outcome-classes.md): unproven and dirty
> are now separate classes with separate exit codes (**3** vs **1**) and separate acknowledgements
> (`--allow-unproven` / `--allow-dirty`), and **dirty outranks unproven** so a finding can never
> hide behind a no-answer. `--allow-orphans` is **refused by name, not aliased** — the muscle
> memory was the defect. ⭐ Fixing it surfaced a **second conflation nobody had filed**: the flag
> read *"allow ORPHANS"* while equally accepting `MISSING_BYTES` and `DIVERGED_BOTH_WAYS`. *A flag
> that accepts more than its name says is this class one layer up* — found by the sibling-guard
> diff, which is the method [[new-door-must-inherit-every-sibling-arm]] keeps earning.
>
> **Instance 3 is discharged, not merely downgraded** — and the closing fact is a MEASUREMENT, not
> a decision. ADR 0121 **D4** (shipped, `20260928000400`) made `disposed` record what it actually
> verified (`metadata_absent` + a closed `byte_proof` vocabulary), and `FUP-DM5-BYTE-PROOF-NOT-ATTEMPTED`
> then made the one lane that really deletes bytes declare `unavailable_on_platform` instead of
> riding the default. The open half was *"unless FUP-DM5-CLOUD-ORPHAN-SURFACE settles that an
> orphan-visible surface exists"* — it was probed on 2026-08-18 and **all five Cloud surfaces are
> metadata-bound** ([cloud-orphan-probe-2026-08-18.md](./cloud-orphan-probe-2026-08-18.md)). So
> `unavailable_on_platform` is not a placeholder awaiting a better proof; it is the **true and
> permanent** value there. The record no longer asserts more than the door verifies.
>
> ⛔ **What closing this item does NOT mean, stated because the class's own lesson predicts the
> misreading.** It does not mean orphaned bytes are absent on Cloud — the probe proves they are
> **unobservable**, which is the opposite of reassuring. It does not add a Cloud byte proof; none
> exists and none is being built (PO-ratified, ADR 0120 D9 amendment 2026-08-18). **What closed is
> the CONFLATION** — every surface that used to answer "I could not look" with a reassuring value
> now says which of the two things happened.
>
> **Kept, not archived-and-forgotten:** the one-sentence class statement below is the most
> productive review lens this program produced (six instances, three variants, four of them found
> *inside the fix for another one*). It is retained here in full for that reason.

> # ⭐ THE CLASS, IN ONE SENTENCE
>
> ## **An observable PROXY is substituted for the property that actually matters — and it always fails in the REASSURING direction.**
>
> ⛔ **Corrected at QA r1.** The previous headline was *"an action performed is recorded as the state
> achieved"*. QA was right that it fits instances 3/4/5 and **not 1/2**: *"I could not look"* is not an
> action performed, and the table's own first column contradicted its own header. The sentence that
> covers **all** of them was already sitting one line below, so it is promoted; *action → state* is
> kept as a **named sub-class**. This matters because the entire point of the reframe was
> recognisability in review — **a class that mis-describes two of its own instances will mis-train the
> next reader.**
>
> ### Three variants, six instances
>
> | # | variant | the proxy actually observed | the property it was recorded as | state |
> | --- | --- | --- | --- | --- |
> | 1 | **"I could not look"** | `--allow-orphans` — proof unavailable | *I looked and found nothing* | ✅ ADR 0128 |
> | 2 | **"I could not look"** | `.list('')` — absence of a **bucket** | absence of **keys** | ✅ `d2b19808` |
> | 3 | **action → state** | `complete_document_disposal` — **metadata row** gone | **bytes** gone | ✅ ADR 0121 D4 + the Cloud probe |
> | 4 | **action → state** | destruction — file **unlinked** | bytes **unrecoverable** | ✅ runbook §6b (key-first) |
> | 5 | **action → state** *(caught pre-ship)* | backup pipeline **ran, exit 0** | a backup **exists** | ✅ never shipped |
> | 6 | **"I looked at the WRONG THING"** | `verdictFor` — no volume **directory** | the bucket is **consistent and empty** | ✅ `verdictFor` + R7/C14–C16 |
>
> ⭐ **Instance 6 is QA's MAJOR-1 and it is a THIRD distinct variant** — not "I could not look" and not
> "an action recorded as a state", but **"I looked at the wrong thing."** The tool consulted the volume
> and reported honestly about it, while never consulting the API set that contradicted it. That variant
> is the hardest of the three to spot in review, because the measurement genuinely happened.
>
> **Severity 🔴 → ⬛ CLOSED 2026-08-19.** The ruling below stands as the reason it *was* 🔴; it is kept
> because the rule it states — *the class heading carries the severity of its worst instance* — is the
> part that transfers to the next class-shaped filing.
>
> **Severity 🔴** (lead ruling 2026-08-17, escalated from 🟠 on instance 3): the class heading carries
> the severity of its worst instance. Instances 1–2 are 🟠 — tool output an operator reads and can
> second-guess. **Instance 3 is 🔴**: a *persisted record asserting a fact to a regulator*. ⚠ Bound it
> precisely, per QA: instance 3 is a **latent** false assertion — it says the record *can assert more
> than it verifies*, not that it *asserts falsely today*; it becomes false only where an API delete
> removed metadata while bytes survived.

Filed 2026-08-17 (backend, S5.D) — **lead-ruled to be filed as a class, not as two bugs.** Two
independent instances in one tool, in unrelated code paths, found days apart by different means. Filed
as two items each gets fixed once and the shape stays open; filed as a class it gets a design answer.

**Instance 1 — `--allow-orphans`. ✅ FIXED 2026-08-19 (ADR 0128).** One flag muted two different
facts. On Cloud the local volume proof cannot exist, so every bucket verdicts
`UNVERIFIED_NO_LOCAL_PROOF` and `capture` exited **1 on a perfectly healthy project**; the only route
to exit 0 was `--allow-orphans`, which **also** silenced genuine `ORPHANED_BYTES` verdicts. An operator
who wanted a usable exit code had to buy blindness to the finding the tool exists to produce. The fix
took the shape the filing predicted — *"a distinct flag, or distinct exit codes for unproven vs proven
dirty"* — and took **both**, because either alone leaves the other surface conflated:

- `CLEAN` / `UNPROVEN` / `DIRTY` **partition** the nine-verdict codomain; exit **3** is UNPROVEN,
  exit **1** is DIRTY, and **dirty outranks unproven** so a finding never hides behind a no-answer.
- `--allow-unproven` and `--allow-dirty` each acknowledge exactly one class. There is deliberately
  no flag that accepts both without saying so.
- `--allow-orphans` is **refused by name** (exit 2, message naming both successors). Aliasing it was
  the one-line option and was rejected: the habit of reaching for it to get a green bar *was* the
  defect, and an alias keeps that habit working.
- `manifest.outcome` records the class counts, what was acknowledged, and `byteProofAvailable`.

⭐ **Two things the fix found that the filing had not.** (a) The flag's **name was wrong about its
own reach** — it read *"allow ORPHANS"* while equally accepting `MISSING_BYTES` (bytes destroyed,
metadata still advertising them — under Rule 12 the *worse* direction) and `DIVERGED_BOTH_WAYS`.
(b) `selftest` **exited on the docker gate before running anything**, so on every machine a *Cloud*
operator uses — the exact population this instance is about — the number of controls that ran was
**zero**, while a third of them needed nothing but the functions under test. The pure half now runs
first and the skipped half is reported **with a count**: *"nothing failed" is not "nothing ran"*.

**Controls, all observed RED before the fix** (three mutants of the shipped file, 2026-08-19):
restoring the pre-fix binary classification reds **C20/C21/C22/C22b/C22c** (13/18); re-admitting the
retired flag as an alias reds **C23** (17/18); removing one verdict from its class set reds **C19**
(17/18). Unmutated: **18/18**. ✅ **And the end-to-end CLI arms RAN** (local stack, same day):
`selftest` **26/26** (18 pure + 8 byte-level), `rehearse` **25/25** — **R6-capture** blind → exit **3**
(was 1) against its sighted twin at exit 0; **R10** a real orphan *under `--allow-unproven`* → exit
**1** with `accepted: []` — *the exact state that exited 0 before this change*; **R10b** same orphan
under `--allow-dirty` → exit 0, `accepted: ["dirty"]`; **R10c** blind under `--allow-unproven` →
exit 0, `byteProofAvailable: false`.
⭐ **C19 is the keystone and it is aimed at the NEXT instance, not this one:** the original defect was
a codomain that grew to nine verdicts while the classification stayed binary, so each new verdict
silently inherited *"not-clean ⇒ suppressible by the one flag"*. C19 requires every verdict to have
exactly one home, C19b requires `ALL_VERDICTS` to be checked against what `verdictFor` actually
returns rather than against itself, and C22c makes an unclassified verdict fail **closed** at runtime.

**Instance 2 — `.list('')` on an absent bucket (FIXED in `d2b19808`, kept here as evidence).**
`admin.storage.from(b).list('')` on a bucket whose **row is gone** returns `{data: [], error: null}` —
an empty list, **not** an error. So "the bucket does not exist" and "the bucket has no objects" were
literally the same value, and `delete --execute`'s post-deletion classifier took the **reassuring**
branch — *"PRE-EXISTING METADATA-LESS ORPHANS … not a failure of this deletion"*, with no
`DO NOT PROCEED` — for a bucket it had never interrogated, **on the destructive path**. Now gated on
`getBucket`, which does error, and pinned by rehearsal arm **R3d**.

⭐ **How instance 2 was found is the part worth keeping.** Step 0 named the state *"bucket row absent
+ bytes present"* as never observed, with **no control anywhere in the tool**. It surfaced only
because a control was built for a state nobody had seen — not by review, and not by any run of the
existing 15 controls.

⚠ **Correcting the frequency claim, which was wrong in the present tense** (QA MINOR-6; the lead's
ruling that prompted it is withdrawn on this point). *"It is the state all eight retired buckets are
in"* is **false as of today** — measured, the eight retired buckets hold **0 bytes** and have **no
directory on the volume**; the volume root holds only the four survivors. They **were** in that state
between the retirement migration and the stack recovery that destroyed the 221 files, and a **Cloud**
retirement produces it **by construction**. So: true historically, true for Cloud, false now. ⭐ And
the frequency argument was never the load-bearing one — **R3d's own reason is sufficient and needs no
appeal to how common the state is**: the classifier printed the reassuring arm, with no
`DO NOT PROCEED`, **on the destructive path, for a bucket it had never interrogated.**

**Instance 6 — 🟠 `verdictFor` read a missing volume DIRECTORY as "consistent and empty". Found by QA
(MAJOR-1) by CONSTRUCTING the state. ✅ FIXED.** Three API-visible keys plus a removed volume
directory verdicted `CONSISTENT_EMPTY` — a member of `CLEAN_VERDICTS` — so `capture` printed **CAPTURE
CLEAN and exited 0** over a bucket whose PHI bytes were gone.

- ⛔ **Non-monotonic in severity:** lose *some* of a bucket's bytes (directory survives) ⇒
  `MISSING_BYTES`, dirty, exit 1. Lose **all** of them (directory removed) ⇒ clean, exit 0. **The
  worse state reported better.**
- ⛔ **It is the state a volume loss with the DB intact produces** — `supabase stop`/`start` without a
  `db reset`, i.e. **FUP-DM5-STACK-CYCLE-DESTROYS-BYTES**, which has already fired once in this phase
  in the *other* direction. Under Rule 12 this is the worse direction: the metadata still advertises
  the PHI file as present and servable, `disposal_state` says nothing is owed, and
  `document-reconciliation.mjs` lists from the same API and cannot see it either.
- ⭐ **It was the SIBLING of the branch this slice had just fixed**, two lines below it, in the same
  function, in the same commit. The fixed branch's own comment says *"a verdict that treats a missing
  ROW as proof of a missing object is the withdrawn method wearing the tool's badge"* — and the next
  branch did it with a missing **directory**. **The transferable rule: a fix applied to one arm is a
  question asked of every sibling arm — diff their guard sets.**
- **Fixed** in `verdictFor`, pinned red-first by rehearsal **R7** (+ permissive twin R7-twin) and
  selftest **C14/C15**, both observed RED before the fix (`api_keys=5 volume_present=false exit=0
  verdict=CONSISTENT_EMPTY`).

**Instance 6b — 🟠 the same branch also read a FAILED measurement as emptiness. Found by doing the
guard-set diff the fix implies. ✅ FIXED.** `volumeCensus`'s catch returns `{present:false, error}`
when its `docker exec` fails for a bucket, and that mapped to `CONSISTENT_EMPTY` — **variant 1 ("I
could not look") living inside `verdictFor` itself.** Now `UNVERIFIED_PROOF_ERROR`, non-clean, pinned
by selftest **C16**. ⭐ *The guard-set diff was asked for and it found a second gap the reviewer had
not seen* — which is the argument for doing the diff rather than fixing the reported instance.

**Instance 3 — 🔴 `complete_document_disposal` persists the confusion as a REGULATORY ASSERTION.
LEAD-RULED 2026-08-17: it IS this class, and it is the worst instance of the three.** The door's
absence check reads **`storage.objects`** — the metadata table (quoted from the live catalog in
`docs/deployment/phi-disposal-runbook.md` §4). So `disposed` proves the metadata row is gone and
**not** that the bytes are gone.

**Why this instance outranks the other two, and the reason is not technical.** Instances 1–2 are
**tool output an operator reads and can second-guess**. Instance 3 is a **persisted record that
asserts a fact to a regulator.** A `disposal_state = 'disposed'` row meaning *"metadata row absent,
bytes unknown"* is a **false compliance assertion** under LGPD / ANVISA-RDC / CFM 1821-2007, inside a
20-year-retention system, on the one record class whose entire purpose is to evidence that PHI was
destroyed.

⛔ **And it compounds with S5.R, which is the sentence that makes the severity legible:** on Supabase
Cloud there is **no volume proof** — `locateVolume()`'s preconditions (`STORAGE_BACKEND=file` plus a
`supabase_storage` container on the operator's own machine) cannot hold there. So on Cloud "bytes
gone" is not merely *unchecked*; it is **unverifiable by the method we have**. Which means
**`disposed` can never mean more than "metadata gone" on Cloud unless something changes** — either
FUP-DM5-CLOUD-ORPHAN-SURFACE settles that an orphan-visible surface exists, or the door's contract is
amended to say what it actually verifies. Until one of those happens, every Cloud disposal record
carries a claim the platform cannot substantiate.

> ### ✅ BOTH ALTERNATIVES RESOLVED — instance 3 is DISCHARGED (2026-08-19)
>
> The paragraph above named two exits. **Both were taken, in the order that matters.**
>
> 1. **The door's contract was amended** — ADR 0121 **D4**, shipped as `20260928000400`. `disposed`
>    now writes `disposal_evidence` beside the state: `metadata_absent` + `metadata_source` (what it
>    genuinely checks) and `byte_proof` from a **closed** vocabulary
>    (`local_volume_verified` / `unavailable_on_platform` / `not_attempted`). An unconstrained
>    free-text field would have been the same defect one layer up. `FUP-DM5-BYTE-PROOF-NOT-ATTEMPTED`
>    then fixed the caller half: the one lane that actually deletes bytes declares
>    `unavailable_on_platform` rather than riding the `not_attempted` default.
> 2. **The Cloud question was MEASURED, and answered NO** — 2026-08-18, `cloud-orphan-probe.mjs`
>    against the live project. All five customer-reachable surfaces are metadata-bound; a byte with
>    no `storage.objects` row is invisible to every one of them *while provably still existing*
>    ([cloud-orphan-probe-2026-08-18.md](./cloud-orphan-probe-2026-08-18.md)).
>
> ⭐ **The second point is what discharges this, and it is worth stating precisely.**
> `unavailable_on_platform` was written as a holding value — true, but pending a better proof. The
> probe converts it into the **permanent and complete** answer: there is no better proof, and there
> will not be one without a change on Supabase's side. A record saying *"metadata absent; byte proof
> unavailable on this platform"* is now **exactly as strong as the truth**, which is the entire
> demand this instance made. The claim the platform could not substantiate is no longer being made.
>
> ⛔ **Not established, and it must not be read in:** that orphaned bytes are *absent* on Cloud. The
> probe proves they are **unobservable** — the opposite of reassuring. Under Rule 12 that is a
> standing, PO-ratified limit (ADR 0120 D9 amendment), not a closed risk.

⭐ **Filed undecided rather than merged on backend's own judgement — the lead ruled that was the
correct call, and it is noted as such.** The alternative (quietly folding it into the class, or
quietly giving it its own id) would have made a severity decision with regulatory weight inside an
implementation slice.

**Instance 4 — 🟠 destruction: a file UNLINKED recorded as bytes UNRECOVERABLE. ✅ RESOLVED in the
runbook by the PO's encryption decision.** Found while writing the mitigation for instance 3 — *inside
the fix for the previous instance*, which is itself the argument for having a class statement rather
than four separate tickets. `rm` proves the **directory entry** is gone; it proves nothing about the
blocks, and less than nothing on copy-on-write filesystems, SSDs with wear levelling, or any volume
that has ever been snapshotted. **Resolution (PO, 2026-08-17): destroy the KEY first, then delete the
archive.** Cryptographic erasure is the load-bearing act — residual ciphertext is unrecoverable
without the key regardless of what the filesystem did — and deleting the archive is hygiene, not
proof. The log records **both, stating what each one proves.** That is deliberately more honest than a
`shred` claim, which could not be verified on this platform anyway. Written into
`docs/deployment/phi-disposal-runbook.md` §6b.

⭐ **The sharpened statement immediately earned itself — a fifth instance was caught BEFORE it shipped,
which is exactly the use the lead named.** While verifying the runbook's encrypt-at-creation pipeline
(2026-08-17): `docker exec … tar -cf - -C /mnt stub` **fails on Git Bash for Windows** — MSYS path
translation rewrites `-C /mnt` to `C:/Program Files/Git/mnt`, tar exits 1 having written **0 bytes** —
and with stderr suppressed the encryptor consumes the empty stream and 7-Zip prints **"Everything is
Ok"**. The action was performed (a backup command ran and reported success); the state was **not**
achieved (a valid, well-formed, entirely **empty** encrypted archive). Recognised as this class on
sight rather than shipped as a command, and the runbook now carries both the working invocation and a
**mandatory** count-vs-census verification step. **Not filed as a 5th open instance — it never
reached the document.**

### 🟠 FUP-DM5-REMOTE-STATE-MEASURED — the remote was measured for the first time; **the "flags ship OFF" grading premise is WRONG at the grain it was used**, and 7 objects are stranded in two retiring buckets (owner: lead; **blocks the next `db push`**)

Filed 2026-08-17 (lead), from the first **read-only** contact with the linked project
(`azkbbhskturikxpgmafq`). The handoff banner named this the next session's first action precisely
because so many severities rested on it. Every figure below is a `select`, not an inference.

**1 · The remote holds ZERO application data.** `organizations` **0** · `profiles` **0** ·
`commissions` **0** · `cases` **0** · `documents` **0** · `document_versions` **0** ·
`document_version_files` **0** · `file_objects` **0** · `printed_documents` **0** ·
`controlled_documents` **0**. There are **no production users and no production rows**. This is the
true reason there is no production exposure, and it is *stronger* than the reason the record has been
giving — but it is a **different** reason, and the difference is the finding:

**2 · ⛔ The "flags ship OFF so the path is unreachable in production" grading is WRONG AT ITS GRAIN.**
Measured: all six document flags **are** off on the remote (`documents_foundation`,
`documents_wave_a`..`_d`, `document_printing` — all `enabled = false`; 31 other flags are on). But of
the **52** document-model functions in `app`/`public`, **51 do not read the flag at all** — exactly
**one** does (`app.compute_due_document_review_notifications`), and **no RLS policy** on any document
table consults it either. The flag is an **application-layer** gate. It does **not** make a DEFINER
door or a policy unreachable to anything holding a JWT and speaking PostgREST.

> ⭐ This is [[a-predicate-quoted-at-the-wrong-grain]] again, and it is the third time this phase: a
> **real** control (the flag genuinely is off) cited for a conclusion it does not bound (DB-level
> reachability). It reads exactly like a proof. **Re-grade on "the remote has no data", never on
> "the flags are off"** — and when the pilot loads data, the flag will *still* not be the boundary.

**3 · 7 objects are stranded in two retiring buckets, with nothing governing them.**
`printed-documents` **4** (`std/…pdf` ×1 + **`phi/…pdf` ×3**, 103–109 KB each, minted 2026-08-10,
`owner_id` NULL = service-role) and `controlled-documents` **3** (2 `.docx`, 1 `.txt`,
2026-07-21 → 2026-08-05). The two **core** document buckets are clean (`documents-standard` 0,
`documents-phi` 0). Separately `form-assets` holds **38** objects against **0** commissions — same
shape, outside DM scope, noted so it is not rediscovered as new.

*Inference, flagged as such:* one cause fits all of it — the remote DB was reset at some point and
**storage was not**, which is the mechanism in [[remote-reset-storage-orphan-is-cli-version-dependent]].
Not needed for anything below; the counts stand on their own.

**Reachability — measured, not reasoned.** `storage.objects` has RLS **enabled** with **8** policies,
and **none** of them grants SELECT on `printed-documents` or `controlled-documents` (the only
document-bucket policies are `documents_{phi,std}_obj_insert_reserved`, INSERT-only). So no tenant
JWT can read these bytes; they are reachable only by service-role, which is the app's own print path
(`open_printed_document`), and that path finds **no `printed_documents` row** to authorise. **Not an
exposure.** What they are is **permanently outside the disposal lifecycle**: every disposal path keys
off `file_objects`, and there is no row — so nothing can ever mark, complete, or evidence their
destruction. PHI-tier bytes that the platform's own retirement machinery cannot see.

### ✅ RESOLVED the same day — the 7 objects are DELETED and the push is unblocked

**PO-authorized 2026-08-17** (*"a remote database reset, including the S3 bucket, is acceptable — no
active users"*). ⚠ **The offered tool was declined and the reason matters:** a `db:reset:linked`
drops DB rows but **leaves storage objects behind** — that is the CLI-version-dependent orphaning
hazard in [[remote-reset-storage-orphan-is-cli-version-dependent]], and almost certainly **how this
state was created in the first place**. Resetting would have *recreated* the orphan condition, not
cleared it. The bytes had to go through the **Storage API**.

**Executed:** `supabase storage rm` per object, **by explicit path** — never a recursive/positional
sweep ([[a-positional-cleanup-eats-seed-rows]]). 7/7 reported deleted.

⚠ **The first attempt deleted NOTHING and reported success.** The CLI prompts
`Confirm deleting files in bucket …? [y/N]`, stdin is null in this environment, and the loop still
exited 0 — the exit code belonged to the pipeline, not the deletion. Caught by re-listing **before**
believing it (still 4 + 3), then re-run with `--yes`. Textbook
[[your-own-measurement-goes-stale-like-any-other]]: *"nothing failed" ≠ "nothing ran"*.

**Verified on BOTH surfaces after the fact**, which is the runbook's mandatory count-vs-census step:
CLI `ls -r` → `printed-documents` **0**, `controlled-documents` **0**; and `storage.objects` → the
only bucket with rows anywhere is `form-assets` (**38**). ⇒ **all EIGHT S4 retirement buckets are
empty**, so the Block-1 data guard now passes and `20260927000400` can be pushed.

**`form-assets` — ✅ ALSO CLEARED, PO-authorized separately.** It held **38** objects against **0**
commissions: equally stranded, but a RETAINED bucket (ADR 0114 D13) outside the document model and
blocking nothing, so it was deliberately left out of the first pass and raised as its own decision.
The PO then authorized it. Remote storage is now **12 buckets / 0 objects** total.

### ⛔ INCIDENT — `supabase storage rm -r ss:///<bucket>` DELETES THE BUCKET, not just its contents

Hit live on the remote, 2026-08-17, clearing `form-assets`. The flag reads
`--recursive, -r  Recursively remove a directory`, and the object paths are `{org}/{file}`, so `-r` on
the bucket root is the natural way to say *"remove everything inside"*. It is not. The output ends:

```
Deleting objects: [ …38 paths… ]
Deleting bucket: form-assets          ← NOT asked for
Successfully deleted
```

**Blast radius, measured rather than assumed:** the `storage.buckets` row was gone (12 → 11); the RLS
policies `form_assets_insert_staff_admin` / `form_assets_select_member` **survived**, because they live
on `storage.objects` and are not tied to the bucket row. So the failure mode is a bucket that no longer
exists while every policy still references it — uploads would fail at runtime with nothing in
`pg_policies` looking wrong.

**Restored** from the authoritative definition — `20260620000000_baseline.sql:24962`, cross-checked
against the live LOCAL row, which agrees exactly: `public=false`, `file_size_limit=5242880`,
`allowed_mime_types={image/png,image/jpeg,image/webp,image/gif}`. Verified after: 12 buckets, 0 objects,
`form-assets` present. ⚠ The pre-deletion REMOTE row was never captured, so the restore is to the
**migration's intent**, not to a measured prior state — if the remote had drifted, that drift is gone.
*Capture the row before deleting anything that owns rows.*

⚠ **Binding on the ADR 0120 D9 byte-deletion runbook**, which sends an operator to do exactly this
against a live project: **delete by explicit object path, never `-r` on a bucket root.** The project's
own `scripts/storage-manifest.mjs delete --execute` is safe here — it calls `remove()` with an explicit
path list — which is another reason to prefer it over ad-hoc CLI.

⭐ The same shape as the confirmation-prompt miss two steps earlier: **the tool did what it was told,
not what was meant, and reported "Successfully deleted" either way.** Read what a destructive command
*enumerated*, not just its exit line.

⭐ **A cheap CLOUD-ORPHAN-SURFACE sub-probe fell out of this for free.** That item names
*"whether `supabase storage ls --linked --experimental` differs from a `storage.objects` query"* as a
secondary probe. Both were run here, before and after: **they agreed exactly, in both states.**
⛔ That does **not** settle the item — agreement is equally consistent with the CLI simply reading the
same metadata (the likely explanation, since it speaks the Storage API). It rules the CLI **out** as
an orphan-visible surface; the **S3 endpoint remains UNPROBED**.

**4 · ✅ The S4 guard will fire, and that is the designed outcome — but it BLOCKS the next `db push`.**
⚠ **PRESENT TENSE HERE IS HISTORICAL — read the "✅ RESOLVED the same day" section above first.** The
7 objects were deleted 2026-08-17, all eight retirement buckets are empty, and `20260927000400` is
**pushable**. This paragraph is preserved as the measurement that *predicted* the abort correctly;
it is not a live blocker. ⛔ The **ordering** it states (byte-first, D9) still binds on any future run.
`20260927000400_dm5_s4_retire_legacy_buckets.sql` Block 1 counts `storage.objects` per bucket and
`raise exception`s naming the bucket and count. It is the **earliest of FIVE** local-only migrations
(⚠ this read *"one of only two"* until re-measured 2026-08-17 — the batch added three more after it:
`…0928000200`, `…0928000400`, `…0928000500`), so
the next `db push` **will abort** on `printed-documents (4)` and `controlled-documents (3)`. Nothing to
fix — the guard is correct and my measurement says exactly when it fires. **Ordering owed (ADR 0120
D9, byte-first):** `scripts/storage-manifest.mjs capture` → `delete --execute` **against the remote**,
then push. ⚠ And per the D9 Cloud half above, `locateVolume()` now **refuses** on a Cloud URL, so that
deletion runs **without** byte-level proof — the API-only over-count refusal survives, the byte-side
controls do not.

**5 · `scripts/document-reconciliation.mjs` would have caught #3 and has never been pointed at the
remote.** Checked rather than assumed: `BUCKETS` walks only the core two, **but** line 368 censuses
`[...LEGACY_BUCKETS, ...RETAINED_BUCKETS]` — `printed-documents` and `controlled-documents` are both
in `LEGACY_BUCKETS`. The tool is **correct and sufficient**; the gap is that it has only ever run
against local. ⚠ Its comment *"DM5 S4 retired 8 of those 12 — only `documents-standard`,
`documents-phi`, `form-assets` and `meeting-audio` still exist"* is **true locally and FALSE on the
remote** (12 buckets live) — [[a-comment-is-an-assertion-that-goes-stale-silently]] in the narrow form
where the subject is another system. Fixed in the same commit.

**⛔ What this does NOT settle.** It does **not** touch **FUP-DM5-CLOUD-ORPHAN-SURFACE**, and the
distinction is the whole point of that item's promotion ruling. **Two different "orphans":** what I
found are **reconciler-orphans** — a `storage.objects` row with no `file_objects` row, *visible* to a
metadata query, which is how I found them. That item asks about **byte-orphans** — bytes in the
backing store with **no `storage.objects` row**, invisible to every query I ran. I read the metadata
side only; **the S3 endpoint remains UNPROBED** and that item's severity is unchanged. Recording this
explicitly because that section's own ruling is *"a buried obligation gets discharged by association
the moment its parent looks resolved"* — remote contact having been made is exactly the kind of event
that would otherwise be misread as having settled it.

### ⬛ FUP-DM5-CLOUD-ORPHAN-SURFACE — ✅ **RESOLVED 2026-08-18 by measurement: Cloud exposes NO orphan-visible surface** (owner: backend + lead; **input to the deploy runbook**)

> ## ✅ MEASURED 2026-08-18 — **every Cloud surface is METADATA-BOUND**
>
> Full run record: **[cloud-orphan-probe-2026-08-18.md](cloud-orphan-probe-2026-08-18.md)**.
> Instrument: [`scripts/cloud-orphan-probe.mjs`](../../scripts/cloud-orphan-probe.mjs), run
> `20260818-072590` against `azkbbhskturikxpgmafq`.
>
> An orphan was **constructed** on the linked project per TRIAGE #1 and five surfaces were
> asked: S3 `ListObjectsV2` under **both** auth modes (session-token *and* dashboard access
> keys), Storage REST `/object/list`, Storage REST `GET /object`, and
> `supabase storage ls --linked`. **All five PROVEN** by the before-state control; **all five
> saw nothing.** The byte was proven still present in the same run (row restored → HTTP 200,
> correct bytes, `cf-cache: MISS`), so no arm is vacuous.
>
> ⇒ The answer is the conservative branch this item hoped against: **ADR 0120 D9's byte-side
> controls are NOT recoverable on Cloud**, and the Cloud byte half is **structurally
> unverifiable** — now *measured*, not inferred. The runbook's "asserted, not verified"
> posture for the Cloud byte half is **correct and evidenced**; nothing can contradict it.
>
> ⛔ **"No orphan surface" is not reassurance.** It does not say orphaned bytes are absent —
> it says they are **unobservable**. That is strictly worse, and it is the settled answer.
>
> ⭐ **The human blocker never actually existed.** This item was blocked for its whole life on
> "S3 access keys must be minted in the dashboard — a human step, not scriptable from here."
> Supabase's S3 endpoint also accepts **session-token auth** (`access_key_id` = project ref,
> `secret` = anon key, `session_token` = a JWT), which needs no dashboard step. Keys were
> minted anyway and both modes measured, because session-token auth respects RLS and would
> have left a confound. *A blocker recorded as external can be an unchecked assumption.*
>
> ⚠ **Two instrument defects were caught by the probe's own controls, in flight** — both now
> encoded in the script, both generalisable, detail in §5 of the run record:
> 1. **The proof-of-life contaminated its own subject.** The first run reported
>    `ORPHAN-VISIBLE` on byte retrieval — a **false positive**: a CDN fronts Cloud GETs, and
>    the *before-state control GET* primed the cache that then served a 200 for a byte the
>    origin was already refusing. ⛔ A cache-buster param does **not** defeat it (`HIT`
>    survived one); only a never-requested path does.
> 2. **Cleanup could have added to the population it measured.** The API deletes
>    `<bucket>/<name>/<version>`; restoring an orphan row with an invented `version` reports
>    success and leaves the file. The `version` is now captured before the delete.

> ## ⭕ ESCALATED 2026-08-18 — **`FUP-DM4-PRODROW` IS NOW BLOCKED ON THIS PROBE (PO ruling), and the probe has a REAL subject**
>
> Reverse of the ruling recorded in PRODROW's body — recorded here too so **neither item can be read
> alone**, per this item's own promotion ruling.
>
> **What changed.** The 2026-08-18 remote census found the production DB empty, and the logs dated the
> cause: a **remote reset at `2026-08-17 11:37:35Z`**. `storage.objects` reads **96 inserted / 47 deleted
> / 0 live** — the 47 reconcile with the S4 bucket retirement (buckets: 16−12=4, exact), which leaves
> **~49 objects that vanished with no `DELETE`**.
>
> ⭐ **A reset rebuilds `storage.objects`; it does not necessarily delete the bytes behind them, and
> whether it orphans them is CLI-VERSION DEPENDENT** →
> [[remote-reset-storage-orphan-is-cli-version-dependent]]. So this item is no longer a hypothetical
> about a synthetic byte — **there is now a concrete population of ~49 likely-orphaned objects on the
> production project**, and the metadata that would say what to look for is gone.
>
> ⚠ **The TRIAGE #1 method does not change and is not weakened.** It is *still* correct to **construct**
> an orphan rather than probe for one: the ~49 cannot be enumerated (no rows point at them), so they can
> confirm the *consequence* but can never serve as the *detector's* positive control. Construct, measure,
> then ask what the answer implies for the 49.
>
> ⛔ **Still blocked on a human step:** S3 access keys must be minted in the Supabase dashboard.

> ## ✅ METHOD RULED 2026-08-18 (DM-FUP TRIAGE #1) — **construct an orphan; do not probe for one**
>
> ⛔ **This item's own framing was wrong, and in the reassuring direction.** It calls the S3 probe
> *"the single measurement that would settle it."* As framed it settles nothing: **the remote holds 0
> objects**, so a read-only probe can show only that the endpoint *answers* — never that it would
> **reveal** an orphan. A detector run against a population with nothing to find returns clean either
> way. → [[detector-that-finds-nothing-must-be-proven-able-to-find-something]]
>
> **The ruled method, on the LINKED project:**
> 1. Mint S3 access keys (Project Settings → Storage). *A human step; it is not scriptable from here.*
> 2. Upload a **synthetic, non-PHI** byte to a scratch path.
> 3. Delete its `storage.objects` row — this **constructs** the orphan the question is about.
> 4. Ask the S3 endpoint whether the byte is still listed. **That answer is the measurement.**
> 5. Clean up, and record the run.
>
> ⛔ **A throwaway project was declined.** It answers for a *different* project's storage config, so
> the result would be an inference about `azkbbhskturikxpgmafq` rather than a measurement of it — the
> same grain error this record has already been burned by twice.
>
> ⚠ **Sequencing, binding:** this probe needs a live, writable remote. `FUP-DM4-PRODROW`'s sanctioned
> "cheap path" (a remote reset) would **destroy the surface this measurement runs on**, so the reset
> may not precede it (DM-FUP TRIAGE #6).

Filed 2026-08-17 (backend, S5.D). Filed explicitly so it **cannot become settled by silence** — the
current state of knowledge is *"we do not know"*, and that is not the same as *"there is none"*.

⚠ **NOT A NEW QUESTION — a PROMOTION. ✅ LEAD-RULED 2026-08-17: the promotion is RIGHT. KEEP IT
PROMOTED; CROSS-LINK, DO NOT MERGE DOWNWARD.** The parenthetical *"(no customer-accessible tool may be
able to SEE an orphan; S3-protocol endpoint UNPROBED)"* still lives inside **FUP-DM5-STORAGE-ORPHANS**'
open **Cloud half**, under a headline that reads *"closes empty by measurement"*.

**The ruling's reasoning, recorded because it generalises past this item:** *an item that can change a
verdict does not live inside the parentheses of the verdict it would change.* This is the same defect
this phase keeps paying for — ADR 0120's own root-cause #3 (*a supersession marker only a raw-file
reader can see is not a marker*) and the S2 reopen-banner defect (*a marker merely DISTANT is no
better than one that is hidden*). A buried obligation gets discharged by association the moment its
parent looks resolved.

**Neither item is closed by closing the other.** FUP-DM5-STORAGE-ORPHANS keeps its local half and its
`npm update` / dependency-source lesson; this item owns the Cloud measurement. ⛔ An earlier draft of
this body offered "merge downward if you prefer one item" — **that option is withdrawn by the ruling.**

**Cross-links (both directions, so neither can be read alone):** parent →
FUP-DM5-STORAGE-ORPHANS (Cloud half). Consumer → **FUP-DM5-NO-ANSWER-VS-NOTHING instance 3 (🔴)**,
which is *blocked on this measurement*: until it is settled, `disposal_state = 'disposed'` cannot mean
more than "metadata gone" on Cloud.

### ⛔ The question was framed WRONG, and QA r1 corrected it: the Cloud risk is not a MISSING proof — it is a FAKE one

Added 2026-08-17 from QA MAJOR-2. This item, ADR 0120 D9 and the runbook all rested on *"on Cloud you
lose the local volume proof"*. **Source-level fact:** `locateVolume()` finds its container **by name
pattern via `docker ps`** and takes the root from that container's env — it is **never given the
project URL**, and nothing cross-checked the two. The two preconditions are at **different grains**:
`STORAGE_BACKEND=file` is a property of the **project**, a running `supabase_storage` container is a
property of the **operator's machine**. A developer machine with `supabase start` up — the normal state
for anyone who can run this repo's gates — satisfies the container half **while the client points at
Cloud**.

**Inference, NOT executed against Cloud (and it must not be recorded as though it were):** such a run
would get `localProof.available = true`, a census of the **wrong project's volume**, and — for any
manifest bucket absent locally — a printed **byte-level assurance for a Cloud deletion that was never
checked**. *No proof refuses visibly; a proof about the wrong bytes passes.* **Strictly worse than
losing the proof**, and the runbook previously told the operator it was impossible.

✅ **GUARDED IN THE TOOL** (not left to discipline): `locateVolume()` now refuses when
`NEXT_PUBLIC_SUPABASE_URL` is not a local origin while a local container is running, downgrading the
proof to unavailable and printing the reason. Measured with a Cloud URL against a running local stack.
The guard sits in `locateVolume()` so **every** subcommand inherits it from one place, and both
polarities are pinned by selftest **C17**. This makes the "DOMAIN: LOCAL stack only" banner
**enforceable rather than advisory**.

⚠ **What this does NOT settle, and why the item stays open:** the guard prevents the fake proof; it
does not create a real one. On Cloud there is still **no** byte-level proof, so the S3-endpoint
measurement above remains the thing that would change what a Cloud run can be trusted to have proved.
And the composite Cloud consequence above is **still an inference** — no remote contact has been made.

**What IS established** (measured, local, S5.R): every byte-side control in `storage-manifest.mjs`
depends on `locateVolume()`, whose preconditions are `STORAGE_BACKEND=file` **plus** a
`supabase_storage` Docker container on the operator's own machine. Neither can hold for a Cloud
project. With the proof forced unavailable, an under-count `delete --execute` exits **0 while a real
file survives** (arm R6); the over-count refusal survives, being API-only (R6b). So **two of ADR 0120
D9's four controls do not survive the loss of local proof, and both lost ones are the byte-side ones.**

**What is NOT established, and must not be inferred:** that Cloud therefore has *no* way to see an
orphan. That step is exactly the reasoning D17's remote half got wrong — "same mechanism class" is
not evidence (see [[a-remote-reset-orphaning-storage-was-a-CLI-VERSION-window]]). The bridge we do
have is the absence of a precondition readable in the source, which bounds **this tool**, not the
platform.

**The specific measurement that would settle it:** Supabase Cloud exposes an **S3-compatible
endpoint** for Storage (`https://<ref>.supabase.co/storage/v1/s3`, with S3 access keys issued from the
dashboard). An S3 `ListObjectsV2` enumerates the *backing store* rather than `storage.objects`, so **if
it lists an object whose metadata row is gone, Cloud has an orphan-visible surface and D9's byte-side
controls are recoverable there**; if it lists from the same metadata, it does not and the byte half is
structurally unverifiable on Cloud. **It has not been probed** — probing it needs (a) PO
authorization to touch the linked project, and (b) an orphan to look for, which means deliberately
manufacturing one on Cloud, which is its own decision. Secondary, cheaper probes worth the same run:
whether the dashboard's Storage explorer reads metadata or the store, and whether
`supabase storage ls --linked --experimental` differs from a `storage.objects` query.

⚠ Until this is settled the deploy runbook must treat the Cloud byte half as **asserted, not
verified**, and say so in the disposal record — which
`docs/deployment/phi-disposal-runbook.md` §§4, 6 now does.

### ⬛ FUP-DM5-BACKUP-IS-PHI-EXPORT — ✅ **RESOLVED 2026-08-19** — a Storage backup is an **unmanaged plaintext PHI export**, and the disposal runbook instructs a human to create one (owner: PO decision, then backend + lead; **Rule 12 / LGPD / ANVISA-RDC**)

> ### ✅ RESOLVED 2026-08-19 — both remaining deliverables discharged, by execution
>
> The item's own close condition was **(a)** the literal destination path recorded in the run log at
> first execution and **(b)** the procedure actually exercised. Both are now done, and the record is
> **[`docs/deployment/phi-backup-run-log.md`](../deployment/phi-backup-run-log.md)**.
>
> **(a) Destination — PO-set 2026-08-19.** Archive `D:\phi-backups`; key
> `C:\Users\micha\phi-backup-keys` — deliberately a **different volume**, discharging "key stored
> separately". Both passed `phi_backup_dir_ok`, and both are now **owner-only** (see F1).
>
> **(b) Executed — § 6b end-to-end on the local stack.** Census **812 files / 14,691,282 bytes /
> 231 PHI-tier** → `tar` streamed straight into `openssl enc` (**encrypted at creation, no plaintext
> intermediate ever on disk**) → **catalog-compared 812 = 812** plus a per-object `sha256` content
> proof → **key destroyed first, then the archive**, in the exact wording custody mode **B** permits.
> **No recovery point retained** — the destruction step cannot be rehearsed without performing it.
> ⭐ The verification was **proven able to refuse** first: an empty-source archive built through the
> same pipeline is a *valid, well-formed 10,272-byte archive with pipe status `0 0`*, and the count
> check rejected it.
>
> ⛔ **What this does NOT discharge, stated so the close is not read wider than it is.** § 3 (the
> disposal sequence) was not run: **C1a stands** — it was *additionally* blocked by
> `FUP-DISPOSAL-CHILD-LOCK-BLOCKS-PHI-ERASURE`, ✅ **resolved 2026-08-19 (ADR 0129), so that
> second block is gone and C1a is now runnable** — but C1a stands on its own terms until § 3 is
> actually executed. **C1b stands**, and cannot inherit this run: the mechanism is local-only
> *by construction*.
>
> **Six findings; four changed instructions in § 6b.** Full text in the run log.
> - **F1 ⛔ the mandatory sync check green-lit a world-readable destination.** `phi_backup_dir_ok`
>   returned ✅ for a directory carrying `BUILTIN\Users:(RX)` + `Authenticated Users:(M)` by
>   inheritance from the drive root. The check asks *is it synced? is it in git?* and is heard as
>   *is it safe to write PHI here?* Fixed: inheritance broken, owner-only, and a
>   `phi_backup_dir_readers_ok` allow-list check added beside it. ⭐ Two barbs worth keeping: the
>   **better** backup practice (separate volume) is what exposed it — `C:\Users\<you>\…` would have
>   inherited a safe ACL and hidden it — and my **first** version of the new check was a deny-list
>   that **passed its own positive control**, printing `BUILTIN\Users:(RX)` and returning ✅. A
>   machine-local group (`MIKE_PC\CodexSandboxUsers`) then appeared on an unrelated directory, which
>   no hand-written deny-list could ever have held. *Enumerate the permitted set; report the rest.*
> - **F2** `7z a -si` **cannot take a non-interactive passphrase at all** (stdin is the tar stream;
>   no keyfile flag, no fd, no env var), so the one printed mechanism is unusable by the automated
>   backup this item predicts. An `openssl … -pass file:` form is now the **mode-B** mechanism, and
>   § 6b states the mechanism **per custody mode**.
> - **F3** every path handed to a native binary must be `cygpath -m`'d — an MSYS-form `-pass file:`
>   yields a **0-byte archive with tar's status 0**. *Third instance of the same path-translation
>   trap*; the hazard is "a path crossed into a native binary", not any one flag.
> - **F4** ⛔ **`set -o pipefail` is required — trap #2 was necessary but not sufficient.** Measured
>   with stderr fully visible: tar's error printed, `$? = 0`, 32-byte well-formed archive. A human
>   watching sees the failure; **a script sees success.**
> - **F5 → `FUP-DM5-BACKUP-HAS-NO-CLOUD-FORM` (🔴)** — the residue this close does *not* absorb.
> - **F6 → `FUP-DM5-DB-DUMP-AND-SCRATCH-DB-UNGOVERNED` (🟠)**.

Filed 2026-08-17 (backend, S5.D) **on lead ruling — filing was ruled not optional.** ⛔ **Not
hypothetical: the S5 drill created one.** A `docker cp` of the live storage volume produced **245
files / 2,456,666 bytes including 68 PHI-tier files, in plaintext, outside every platform control** —
⚠ *those 68 are PHI-tier **by bucket**, from local seed/E2E artifacts, not real patient data* (QA
INFO-5): the drill itself was **not** a live PHI incident. The 🔴 grades the **mechanism as it applies
to production**, where the same command over `documents-phi` yields real records —
no RLS, no `open_document_version` door, no PHI-access audit row, no signed-URL TTL, no encryption
beyond whatever the host filesystem provides. That copy was deleted after verification; **the
mechanism that made it remains, undocumented.**

**Why it is 🔴 rather than a hygiene note:** every safeguard in Rule 12 — the tightest RLS, the audited
single door, the tier-keyed TTLs, platform at-rest encryption — governs bytes *inside* the platform.
A volume snapshot steps around all of them at once, by design, because it is Supabase-unaware (that is
precisely why it is the only mechanism that captures orphans). The backup is therefore the **widest
PHI egress path the system has**, and it is the one with **no** documented location, permitted reader
set, retention period, or destruction step.

⛔ **The operational sting, and the reason this had to be filed before the runbook reaches the PO:**
`docs/deployment/phi-disposal-runbook.md`'s backup half **instructs a human to create exactly this
export.** *A procedure whose correct execution produces an undocumented plaintext PHI copy is not a
complete procedure.*

✅ **RESOLVED IN THE RUNBOOK — PO set all five values 2026-08-17** (§6b): **encryption** (encrypted
archive, `age` / 7z-AES, **encrypted AT CREATION** so bytes are never plaintext on disk at any point —
explicitly *not* "`docker cp` then encrypt", which leaves a plaintext window; key stored separately) ·
**location** (outside the repo **and** outside any synced folder, with a **mandatory** sync-root check,
because a copy into a synced directory silently replicates 68 PHI-tier files to a third-party cloud
and nothing in the platform would notice) · **reader set** (the accountable owner alone, pre-pilot;
never attached to an issue or support ticket) · **retention** (until the next backup is *verified
good*, max 30 days, whichever first — exactly one recovery point at a time) · **destruction** (key
first, then archive — instance 4 above).

⭐ **The retention rationale is written into the runbook, because the obvious reading inverts it:** the
20-year LGPD/ANVISA/CFM obligation belongs to the **system of record, not to backup copies.** A backup
kept 20 years satisfies nothing and creates two decades of PHI liability in a second location with no
RLS, no audit and no access control. **Short backup retention is a safety property, not a
compromise** — stated explicitly so a future reader does not "fix" 30 days up to 20 years believing
they are improving compliance.

⚠ **"Verified good" is defined as CATALOG-COMPARED, never `psql` exit 0**, and the runbook cites this
program's own drill as the reason (exit 0, **490** real errors, **90 of 274** policies restored). The
retention rule authorises destroying the only other copy, so the phrase carries the weight of the
whole rule and may not rest on a signal already proven false.

**What remains before this can close:** the **literal destination path** is recorded in the run log at
first execution (the *rule* is decided; the path is per-machine), and the first monthly run must
actually exercise the procedure — see the UNREHEARSED gap. ⚠ Note the interaction with the drill's
other finding — the byte half has **no** first-class tooling, so any future automated backup will be
built on one of these two mechanisms, and whichever is chosen inherits this item.
Related: **FUP-DM5-STACK-CYCLE-DESTROYS-BYTES** (the same volume, the destructive direction) and
**FUP-DM5-NO-ANSWER-VS-NOTHING** instance 3 (the same bytes, the *disposal-assertion* direction).

### 🔴 FUP-DM5-BACKUP-HAS-NO-CLOUD-FORM — the § 6b procedure is **local-only by construction**, and on Cloud there is **no Storage backup at all** (owner: PO decision, then backend + lead; **Rule 12 / LGPD / ANVISA-RDC**)

Filed 2026-08-19, from the § 6b first execution (finding **F5**;
[run log](../deployment/phi-backup-run-log.md)). **This is the residue that
`FUP-DM5-BACKUP-IS-PHI-EXPORT`'s close does not absorb**, named rather than dropped.

> ⭐⭐ **PROMOTED TO § Critical FUP as C3 on 2026-08-19, by explicit PO instruction** — the only way
> an entry may land in that section. Its **trigger** lives there: ⛔ *before any real patient record
> is loaded.* ⚠ That is the same instant as **C1**'s trigger and for the **opposite** reason — C1 is
> about *destroying* bytes on request, C3 about *not being able to get them back*. Two items, one
> deadline, easy to conflate; the § Critical FUP rows say so on both sides.

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

### 🟠 FUP-DM5-DB-DUMP-AND-SCRATCH-DB-UNGOVERNED — the runbook's own DB-half verification creates **two plaintext PHI copies with no handling rule** (owner: PO decision, then backend)

Filed 2026-08-19, from the § 6b first execution (finding **F6**).

> ⭐⭐ **PROMOTED TO § Critical FUP as C4 on 2026-08-19, by explicit PO instruction.** Its **trigger**
> lives there: **the first time anyone runs `supabase db dump --linked`** — which needs only the DB
> password and is the natural next step of a **C1b** rehearsal. ⛔ So the ordering matters: do not
> let a C1b run be the first execution of an ungoverned procedure.

§ 6b is titled *"PHI handling for the backup half"*, but its five values are scoped, literally, to
**"a Storage backup" / "the archive"**. The same section then requires — for the word *"verified
good"*, which authorises destroying the only other copy — a `supabase db dump` restored into a
**scratch database**. Neither artifact is named by any of the five values:

- the **dump file**: a plaintext `.sql` holding every narrative, identifier and answer. No location
  rule, no reader set, no retention, no destruction step.
- the **scratch database**: a second live copy of the PHI, which this same page describes as
  *90 of 274 RLS policies restored* — *"a restored database missing two thirds of its RLS is not a
  database — it is a data leak wearing one"*. **Nothing tells the operator to drop it.**

⭐ **This is `FUP-DM5-BACKUP-IS-PHI-EXPORT`'s own sting, one level down, inside the section that
resolved it**: *a procedure whose correct execution produces an undocumented plaintext PHI copy is
not a complete procedure*. The Storage half was governed and the DB half — added to the same section
for a different purpose — was not, because the scope sentence was written about Storage and the
requirement was added later.

⚠ Unlike F5 this one **is** reachable on Cloud today (`supabase db dump --linked` needs only the DB
password), so it is the more likely of the two to happen by accident.

**Interim mitigation, already in the runbook** (not a substitute for the decision): apply the five
values to both by analogy, drop the scratch database as soon as the comparison is recorded, and
record both in the run log. **What is owed:** the PO extending the five values explicitly, or ruling
that the DB half is covered by the managed backups and the restore test is not to be run at all.

### ⬛ FUP-DM5-BACKEND-STATE-SLICE-SECTIONS — ✅ **RESOLVED 2026-08-18** — the per-slice `backend-state.md` sections for **S2 / S3 / S5** are written (owner: **backend**)

> ### ✅ RESOLVED 2026-08-18 (backend). Three `##` sections added to `docs/backend-state.md`, in the
> chronological body between the **DM5 follow-up batch** and **DM4** sections: `## DM5·S5` ·
> `## DM5·S3` · `## DM5·S2`. Every figure carries its deriving query inline, per the S6 convention.
>
> **Derived from the LIVE catalog only** (local stack, read-only; registry **411 == 411**), never
> from migration text, the slice records, or graphify: `supabase_migrations.schema_migrations`
> (slice ranges, bounded by the **registry interval**, not a filename pattern) · `pg_proc`
> (`prosecdef`, `provolatile`, `proconfig`, `proacl`, `pg_get_functiondef`,
> `pg_get_function_identity_arguments`, `pg_get_function_result`) · `pg_constraint` +
> `pg_get_constraintdef` · `pg_attribute` (+ `attacl` / `has_column_privilege`) · `pg_class.relacl` ·
> `pg_trigger` · `pg_policy` / `pg_policies` · `pg_extension` / `pg_namespace` (the no-scheduler
> proof) · `storage.buckets` / `storage.objects` policies.
>
> **Every DM END STATE aggregate figure re-derived and REPRODUCES**: 411==411 · 13 doc-model tables
> × exactly 1 policy · 38 document-surface doors, 5 of them not EXECUTE-able by `authenticated` ·
> 4 buckets · 4 `storage.objects` policies (3 INSERT + 1 SELECT) · 165/165 RLS · the flag census
> **75 functions / 6 read a flag**. No aggregate figure was retired.
>
> ⛔ **Writing the sections found FOUR defects in the `###` stamps the aggregate block carries** —
> corrected in place there, derived in the new sections:
> 1. **S3 stamp header said "`…000350`, 6 migrations" — the registry says SEVEN** (`…000360
>    dm5_s3_r1_mint_unique_violation_discrimination`, the QA-r1 fix). *A range typed at authoring
>    time does not know about the migration the review adds.*
> 2. ⛔ **S3 stamp: "A trigger on `responses` mints/drops its securable" — THERE IS NO SUCH
>    TRIGGER.** `responses` carries 5 user triggers, none touching `securable_resources`; the
>    `form_response` securable is minted **lazily inside `mint_printed_document`**, and the
>    function's own comment says ADR 0120 **D17.2** rejected the trigger *on purpose*. ⭐ The claim
>    did not merely go stale — it asserts the exact mechanism the design wrote a paragraph to refuse.
> 3. **S2 stamp: "`securable_resources_tenant_shape` … `capa_action` (org + hospital, NULL
>    commission)"** — the CHECK places **no** constraint on `commission_id` and the column is
>    nullable. **NULL-commission is the INTENT, not the constraint.**
> 4. **S2 stamp's "admits 8 types" is now 9** (S3 added `form_response`) — true as a delta, wrong as
>    current state; both bounds now stated.
>
> ⚠ **Three more figures were right only under an unstated bound, and the bound is now written down:**
> **(a)** `FUP-DM5-DISPOSAL-JOB`'s *"three inflow doors"* — there are **4** SET-form writers of
> `disposal_pending`; 3 are `authenticated`-reachable and the 4th,
> `complete_document_reclassification`, is service-role-only, so the queue is fed wider than the
> figure says. **(b)** The DM5 follow-up-batch section's *"`authenticated` holds SELECT and nothing
> else"* on the evidence tables — the ACL is **`rm`** (SELECT + MAINTAIN); the security conclusion
> holds (no `a`/`w`/`d`), the literal string does not. **(c)** The S3 stamp's *"FIVE write guards"*
> is a curated set; the property-bounded enumeration (*body references `printed_documents` AND
> raises*) returns a **different** five, and the union is **7** — `guard_printed_document_binding`
> raises **`HC0DA`**, outside the `HC0D[KLN]` family an errcode sweep would use.
>
> **Nothing failed to reproduce**; no figure was carried forward undivided. Two figures are stated as
> *structural* rather than populated: `file_objects` and `printed_documents` both hold **0 rows** on
> this stack, so the disposal census comes from function bodies and ACLs, not data — the measured
> form of C1's UNREHEARSED gap.
>
> ✅ **S4 ADDED 2026-08-18 on a second PO ruling** — `## DM5·S4` now sits between the S5 and S3
> sections, so **all four DM5 slices have one**. Derived from: `schema_migrations` (the interval is
> **1** migration, `20260927000400`, derived not assumed) · `storage.buckets` · `pg_policy` on
> `storage.objects` (**`polcmd` census: 3 INSERT + 1 SELECT; ZERO DELETE / UPDATE / FOR ALL**) ·
> `pg_class.relacl` (`arwdDxtm` to `authenticated` **and `anon`**) · `pg_trigger` (`protect_objects_delete` /
> `protect_buckets_delete`, both **BEFORE DELETE STATEMENT**) · `pg_proc` (`storage.protect_delete`
> is role-agnostic, verified from the body) · `pg_constraint` (`file_objects_bucket_check` /
> `_bucket_from_tier`). **Residue sweep: all NINE retired bucket names score 0 across function
> bodies (comment-stripped), policy expressions and constraint defs. The census sums — 13 historical
> names = 4 live + 9 retired.**
>
> ⛔ **S4 added a THIRD catalog-false stamp claim and the FIRST figure that does not reproduce at all:**
> **(i)** *"`begin_document_upload` is the only thing that names a bucket"* — three functions do, plus
> two CHECK constraints and a client-side constant; **`app.printed_rendition_storage_bucket` landed at
> S3, so the claim was false when authored, not aged.** The correctly-bounded version is in
> `docs/reviews/dm5-s4-review.md:334` — **the stamp is a compression of it into a false absolute.**
> **(ii)** ⛔ **"4 / 6 / 4 / 13 other callers" — RETIRED, does not reproduce under any bound**
> (measured: fn `5/5/5/12`, policy `8/7/8/11`, combined `13/12/13/23`; the stamp never said which it
> counted, and two of the four drift the wrong way for a later-addition story). ⭐ **Its conclusion
> survives untouched — every count is ≥5.**
>
> ⚠ **Two traps I walked into and had to back out of, both recorded in the section because they are
> the item's whole point:** **(a)** grepping `src/` for bucket names as **string literals** returned
> `'attachments'` ×3 and `"interview-attachments"` — which are a **feature-flag key** and a **`domId`**.
> A string-literal bound is a *syntax* bound. **(b)** I nearly filed "the retirement has no standing
> pin" — `325_legacy_bucket_policy_pin.sql` t6/t7/t8 pins it thoroughly, **with an explicit positive
> control** (t8: a sweep that retired *everything* would satisfy t7 and fail t8). *Absence of a
> verdict is not absence of coverage; neutralize before escalating.* The one true residual: the pin
> is keyed to a **closed list of names**, and no assertion anywhere reads the **total** bucket count
> (complete enumeration: 7 lines across 4 files read `storage.buckets`, all name-keyed).
>
> ⚠ **The sweep's own domain was under-wide on the first pass** — it began as the DM5 record's twelve
> names and missed **`meeting-attachments`** (retired earlier at F2's `20260921000300`), which
> surfaced only from the pgTAP estate. ⛔ **The dead set cannot be enumerated from the live catalog at
> all** — a retired bucket leaves no residue to find — which is exactly why retirement had to be a
> migration and why the only standing assertion possible is over the **surviving** set.
>
> **Deployment:** as of the **2026-08-18 push** local and remote are both at `20260928000500`; the
> retirement is LIVE on the remote. The S4 section states that and carries no "local-only" phrasing.

✅ **PO-RULED 2026-08-18: yes, still wanted — written by the `backend` engineer as ONE small task, before DM5 closes.**

⛔ **Filed 2026-08-18 with an ID because it did not have one, and that was the whole risk.** Raised by
the **S6 QA (F6)**, re-homed by the **DM5 phase QA**, and carried into the gate-step-4 docket as item
6 — but it existed **only** inside those three documents and the `🛑 START HERE` block, which is
retired the moment the docket is answered. ⭐ *A body plus a narrative mention is not an index entry;
the index is what a reader greps* — the exact class as phase-QA finding **R3**, re-earned one item
later, by an obligation whose stated purpose was *"named explicitly so it cannot die quietly when DM5
closes."* **Naming a thing in the document that expires is not naming it.**

**Scope.** Three sections in `docs/backend-state.md`, one per slice — **S2** (NSP RCA/CAPA evidence),
**S3** (prints onto the core substrate), **S5** (operational closure). The DM END STATE block S6
wrote is the *aggregate*; these are the per-slice surface deltas that let a future session see what
each slice changed without re-deriving it.

⚠ **Derive every figure from the live catalog, never from the slice records** — those are exactly the
documents whose staleness this file exists to replace, and this program has already shipped
`backend-state.md` currency stamps that were themselves stale (*"stale by three slices … registry
391→407"*, corrected at S6 to a measured **411==411**). Each figure carries its query, per the
convention S6 established.

### 🟠 FUP-DM5-DISPOSAL-JOB — nothing completes a disposal: `disposal_pending` has three inflow doors and **zero automated outflow** — ⭐ **Critical FUP C1** (owner: PO; the decision is discharged, the REHEARSAL is not)

> ## ⭕ SPLIT 2026-08-18 (DM-FUP TRIAGE #3) — **C1a (local) + C1b (Cloud); C1 does NOT close on C1a**
>
> ADR 0121 Amendment 3 required the runbook be executed *"end-to-end, once, against test data"* — and
> **named no surface**. That underspecification would have discharged it with a local run. It does not:
>
> - **C1a — local.** Run it against the local stack, once, recorded. Debugs the procedure and yields the
>   first **backup destination path** owed to `FUP-DM5-BACKUP-IS-PHI-EXPORT`.
> - **C1b — Cloud.** The same run against the linked project. ⛔ **The pilot-risk acceptance is bounded
>   by C1b.** A green C1a does not release the pilot.
>
> ⭐ **Why:** the runbook itself says at §6 that a local rehearsal *"runs against a local stack by
> construction, so it cannot exercise the Cloud paths above"* — and the pilot runs on Cloud. A local-only
> rehearsal therefore discharges the amendment's **wording** while leaving its **purpose** undischarged.
> → [[a-predicate-quoted-at-the-wrong-grain]], in the highest-severity item in the register.
>
> ⚠ **Heading title is stale in one figure:** it says *"three inflow doors"*. Measured, the queue has
> **four SET-form writers** — 3 `authenticated`-reachable plus `complete_document_reclassification`
> (service-role-only). Left in place because the Critical FUP entry carries the correction; noted here so
> the two do not disagree silently a second time.

> ### ✅ PO RULING 2026-08-18 — **PILOT RISK ACCEPTED, BOUNDED BY ONE REHEARSAL.** Recorded as **Critical FUP C1**.
>
> The pilot **may proceed** over the manual-only PHI-disposal path, **on one binding condition**:
>
> ⛔ **[`phi-disposal-runbook.md`](../deployment/phi-disposal-runbook.md) must be executed end-to-end,
> once, against test data, BEFORE any real patient record is loaded.** The acceptance is **not**
> open-ended and does **not** survive the pilot admitting real PHI ahead of the rehearsal.
>
> ⭐ **The condition is the substance of the ruling, not a caveat on it.** The gap was never a missing
> mitigation — the runbook exists, and its owner, cadence and five backup values were all PO-set on
> 2026-08-17. The gap is that **the mitigation has never been observed to work.** This item's own body
> already says it below, in its own words: *"real on paper; real in practice only when the monthly run
> actually happens."* ⚠ A procedure that has only ever been **read** is a claim about a procedure —
> the same defect ADR 0121 **D4** exists to stop, one layer out.
>
> ⚠ **`disposal_state` therefore means INTENT, not a destruction guarantee — and that reading is now
> RATIFIED, not merely observed.** Nothing user-facing, regulator-facing or export-facing may describe
> it as destruction. ⭐ This **inverts ADR 0099 D10** (*"a stale row nobody looks at harms nobody"*):
> under LGPD, retention past purpose is itself the violation, so for PHI **the stale row IS the harm.**
>
> ⚠ **D2 is NOT ratified by this** — `pg_cron` stays uninstalled and the cron schema still does not
> exist. ADR 0121's D2 design remains ratified-but-unbuilt, kept as what gets built if the manual path
> proves insufficient. **`343_dm5_s5_disposal_gap.sql`'s K6b still asserts "no scheduler exists at
> all"** — true today, a **false pin** the day D2 lands; rewrite `343` in D2's slice, never after.
>
> ⭐ **The rehearsal also discharges a second obligation:** it produces the first **destination path**
> for `FUP-DM5-BACKUP-IS-PHI-EXPORT`, which that item owes *at first execution*. Do not run the
> rehearsal without capturing it.
>
> ⛔ **This ruling does NOT close the item.** The PO decision is discharged; the rehearsal is the
> deliverable, and C1 leaves the Critical list only when the run has **happened and been recorded**.

Filed 2026-08-17 (backend, S5.D), recording the **PO's deliberate deferral** rather than an
undiscovered defect: at S5.D authorization the PO ruled *document the gap, do NOT build the job* — no
`pg_cron`, no scheduled sweep, no second execution context with service-role reach. This item is where
that deferral lives so S6/QA cannot close over it silently.

**Measured, live catalog:** `request_document_disposition`, `dispose_case_phi` and
`dispose_referral_phi` all write `disposal_state = 'disposal_pending'`. `complete_document_disposal`
is the only door that can write `disposed`, its EXECUTE is granted to `postgres`/`service_role` only
(never `authenticated` — it was **built** expecting an operational caller), and it has **exactly one
caller in the repository**: `src/lib/documents/actions.ts:377`, inside `reclassifyDocument` — an
unrelated copy-then-retire lane. Nothing on the disposition path reaches it. `pg_cron` is not
installed, the `cron` schema does not exist, there is no `.github/workflows/`, and the Dockerfile runs
a single process with no scheduler.

**Mitigation shipped instead of a job:** `docs/deployment/phi-disposal-runbook.md` (manual procedure +
reconciliation). ✅ **Owner and periodicity SET by the PO 2026-08-17**: accountable owner = **the PO
(repo owner)** — deliberately not a DPO role, since naming a role that may not be staffed pre-pilot is
the same as naming no owner — executor = **whoever holds service-role reach** (ACL-forced, not a
choice), periodicity = **monthly, plus out-of-band on any data-subject request**. ⚠ The mitigation is
now real *on paper*; it becomes real *in practice* only when the monthly run actually happens, and the
sequence is still **UNREHEARSED**. The gap is pinned executably on both
sides so it cannot rot: `supabase/tests/343_dm5_s5_disposal_gap.sql` (catalog) and
`src/lib/documents/disposal-gap.test.ts` (TS, where the job would most plausibly be built and where
pgTAP is blind). Both were observed RED against real mutations before being trusted green.

⭐ **Composition with FUP-DM5-D11-SUPERSEDED-NEVER-RETIRES, which is the other half of the same
lifecycle and must not be resolved in isolation.** D11's gap is that nothing ever *marks* superseded
bytes for disposal (no inflow); this gap is that nothing ever *completes* a marking (no outflow).
**Fixing D11 alone would make things look better and destroy nothing** — it would convert silent
retention into a growing pile of `disposal_pending` rows that no code path can clear, while the D11
claim reads as honoured. Whichever is scheduled first, the other must be named in the same decision.

⚠ Also note the reconciler interaction: `scripts/document-reconciliation.mjs` classifies
`disposal_pending` as permanently `indeterminate` — *never* drift — on the stated assumption that "the
completion door is its owner". That assumption was false until the runbook existed, and it is only as
true as the runbook is actually executed.

### 🔵 FUP-DM5-Q1-OPEN-BYTES-CUT-BROKEN — ⚠ **HALF RESOLVED 2026-08-17: the guard no longer fails open; the arm is still a no-op awaiting a NAMED successor** (owner: backend)

> ## ✅ SUCCESSOR NAMED 2026-08-18 (DM-FUP TRIAGE #5) — **`app.resolve_document_version_bytes`**, and the arm moves into Critical FUP C2 Tier 1
>
> The item required that the successor be **named, not guessed**. It was **derived from the live
> catalog**, which is the strongest form of naming available here. The byte corridor:
>
> `openDocumentVersion` → `public.open_document_version` / `public.open_printed_document`
> (`prosecdef = t`, granted to `authenticated`; **thin** — `assert_documents_enabled` + dispatch)
> → **`app.resolve_document_version_bytes`**, which holds the whole kernel: `app.can_read_document`,
> `app.can_read_referral_phi`, the D15 ceiling, and the disposal/serving-state refusals
> (`HC0DD`, `HC0D8`). The app then signs a short-TTL URL with an **admin** client.
>
> ⭐ **The item's framing had no target, and that is the finding.** It asks for the arm to be re-pointed
> at a **policy**. There is **no `storage.objects` SELECT policy on document bytes at all** — the live
> set is `documents_phi_obj_insert_reserved`, `documents_std_obj_insert_reserved`,
> `form_assets_insert_staff_admin`, and `form_assets_select_member`, the last being the only SELECT and
> not a document path. The gate is a **`prosecdef = t` door whose check replaces RLS**, so the arm's
> class changes from policy-mutation to **door-mutation**. → *`prosecdef` belongs beside `pg_policies`*
>
> ⛔ **Therefore it is built inside C2 Tier 1, not as a one-off.** Tier 1's 407-door sweep needs exactly
> this machinery, as does `FUP-DM5-SIBLING-GUARD-DIFF`; building it three times was declined. ⚠ **Being
> absorbed is not being closed** — this item keeps its own line and needs its own recorded verdict.

> **✅ The fail-open half is fixed** — `coalesce(v_qual, '') !~ …`. **Proven, not assumed:**
> against the live catalog `v_qual is null` is **true**, the old form evaluates to **NULL**
> so the `if` does not fire and control falls through to `alter policy` on a nonexistent
> policy (**42704**), and the new form **announces the no-op**. A guard nobody had seen
> fire has now been seen firing.
>
> ⛔ **Deliberately NOT done: silently re-pointing the arm.** The policy
> `attachments_obj_select_readable` was dropped by DM1, so the arm now honestly reports
> that it tests nothing. Retargeting it at whatever current policy *looks* similar would
> make it assert something nobody chose — the successor must be **named** by whoever owns
> the case-bytes read path today. Downgraded 🟡 → 🔵: it is now legible rather than
> deceptive.

Filed 2026-08-17 (lead) from QA's DM5·S4 review MINOR-3. **Pre-existing — NOT S4's doing**, and
explicitly not charged to it.

`supabase/tests/mutation/q1-quality-mutation-audit.sh:140-153` (`open_bytes_cut`) targets policy
**`attachments_obj_select_readable`** on `storage.objects`. The catalog has **0** such policies —
dropped by `20260923000100_dm1_drop_attachment_substrate.sql` (**DM1**, weeks before S4).

⭐ **The interesting part is the guard, not the staleness.** The arm protects itself with
`if v_qual !~ 'read_case_deliberation' then raise …` — intended to announce a no-op. With the policy
absent, `v_qual` is **NULL**, `NULL !~ '…'` evaluates to **NULL**, the `if` does not fire, and control
falls through to `alter policy` on a nonexistent policy → **`42704`**. *A guard written to announce
"MUTATION NO-OP" instead fails open into an error* — three-valued logic eating the one branch that
existed to make the failure legible. Same family as
[[guards-that-read-right-but-fail-open]] and [[a-silent-return-hides-a-live-defect]].

**Fix:** re-point the arm at a live policy (or retire it with a named successor), and make the guard
NULL-safe (`coalesce(v_qual,'') !~ …`). Then prove it can announce a no-op — a guard nobody has seen
fire is not a guard.

### 🟠 FUP-DM5-D9-NO-ARM-SEES-A-BYTE-POST-RETIREMENT — after `…000400` applies, the retirement tool has no Cloud-visible arm left (owner: backend; **input to S5/S6 + the deploy runbook**)

Filed 2026-08-17 (lead) from QA's DM5·S4 review MINOR-5. **Scoped to the new half only** —
FUP-DM5-STORAGE-ORPHANS is separately open and not re-litigated here.

> ⭐ **UPDATE 2026-08-17 (DM5·S5, QA r1 INFO-3) — the LOCAL half of this item is now materially
> better; the CLOUD half is untouched and the item does NOT close.** Two `verdictFor` fixes landed in
> S5 and both redden states that previously printed `CAPTURE CLEAN` with exit 0 *locally*:
> **`BUCKET_ABSENT_ORPHANED_BYTES`** (bucket row gone, bytes still on the volume) and
> **`MISSING_BYTES`** (volume directory gone, metadata still listing keys — QA MAJOR-1), plus
> **`UNVERIFIED_PROOF_ERROR`** so a failed measurement is no longer read as emptiness. So the sentence
> below — *"post-migration `capture` prints CAPTURE CLEAN"* — **no longer holds for a retired bucket
> whose bytes survived**, which is the case that mattered. ⛔ **What has NOT changed:** on Cloud there
> is still no byte-visible arm at all, and S5 additionally established that a local proof run against a
> Cloud client would attest to the **wrong project's** bytes (now guarded — see
> FUP-DM5-CLOUD-ORPHAN-SURFACE). The Cloud half is the whole remaining item.

Post-migration, `storage-manifest.mjs capture` over the retired scope prints **`CAPTURE CLEAN`**. The
tool is honest — its volume proof *did* fire for absent buckets in the committed S4 manifest — but two
operational consequences are written down nowhere:

1. **Once `20260927000400` has applied, the only arm that can still see a surviving byte is the volume
   `walk`, which is `STORAGE_BACKEND=file` and therefore LOCAL-ONLY.** On Cloud, post-migration, the
   retirement tooling has **no arm at all** that can see one.
2. ⭐ **The migration's guard cannot enforce the ordering it documents, in the case that matters.** It
   refuses when `storage.objects` rows remain — but an *orphaned* bucket satisfies "no rows" perfectly.
   So the guard enforces byte-first ordering exactly when the bytes are still tracked, and is silent
   precisely when they are not. **The guard is real and it is not a proof of emptiness.**

**Why it matters:** this is the ordering that runs at deploy, against a bucket set that *does* have
metadata rows — so the guard will do its job there. The gap is the residual: nothing can confirm
afterwards, on Cloud, that no byte survived. Record it in the deploy runbook rather than discovering it
during the deploy.

### 🟠 FUP-DM5-STACK-CYCLE-DESTROYS-BYTES — a `supabase stop`/`start` recovery destroyed 221 storage objects (15 PHI-tier) with **no manifest, no count comparison, no audit** (owner: lead + backend)

Filed 2026-08-17 (lead) from QA's DM5·S4 review **B1**. Full measurement, timeline and cause: the
S4 OUTCOME block under **FUP-DM5-STORAGE-ORPHANS** above.

**The hazard, stated generally:** ADR 0120 **D9** governs *deliberate* retirement — capture, delete by
key, assert `deleted == manifest`. It says nothing about the **operational** paths that can destroy
storage bytes as a side effect, and at least one of them does so **silently**: recovering a wedged
local stack (`supabase stop` + `supabase start`, here after a mid-flight `supabase db reset` was
killed) recreated the storage volume. `supabase stop` reported `"backup":true` while doing it.

**Why it matters beyond the lost dev files:**
1. ⭐ **It is the exact event D9 exists to prevent, and it happened inside the slice that ratified D9** —
   which is the strongest possible evidence that *a rule governing the deliberate path does not
   constrain the accidental one.*
2. **It was invisible.** Nothing alarmed. It was found only because a reviewer re-measured a figure the
   lead had inherited from a manifest 3 hours old. **No gate in this repo would have caught it**, and the
   lead reported the bytes as present, and had the PO rule on them, long after they were gone.
3. **Cloud is the real exposure.** `npm run db:reset:linked` exists, and the 20-yr LGPD/ANVISA retention
   posture means "storage bytes vanished and we cannot say when or which" is a compliance statement, not
   a tidiness one.

**Candidate resolutions (PO/backend call — deliberately NOT pre-decided):** capture a manifest
**before** any stack-cycle or destructive CLI step and diff after (cheap, uses S0's existing tool) ·
document the hazard in `docs/worktrees.md`/the deployment runbook · or accept it for local dev and scope
the guard to anything touching a data-bearing stack. ⛔ **Do not resolve it by adding a comment saying
one "should" capture first** — that is the failure mode this phase has now paid for repeatedly.

### ⬛ FUP-DM5-SETLOCAL-MIGRATION — `SET LOCAL` in a migration is **not guaranteed to be inside a transaction**; `20260921000300` still relies on it (owner: backend)

> ## ✅ RESOLVED 2026-08-18 — the watermark-bounded gate is BUILT, WIRED, and VALIDATED AGAINST GROUND TRUTH
>
> `scripts/check-migration-set-local.mjs`, wired as **`lint:set-local`** — the **sixth** gate in the
> `npm run lint` chain. Current state: **2 migrations above the watermark, 411 grandfathered, 0 findings.**
>
> **It is a position scanner, not a regex.** The whole question is *context* — the same eight characters
> are a defect at top level, correct inside `do $$`, and irrelevant inside a comment or a string. It
> tracks line comments, **nested** block comments, `''`-escaped strings, quoted identifiers, `$tag$`
> bodies (consumed whole; `$1` is *not* a quote opener) and explicit `begin`/`commit` depth.
>
> ### ⭐ The validation that matters: it reproduces the BEHAVIOUR's answer exactly
> Swept over **all 413** migrations with the watermark ignored, it returns **4 files / 6 sites** —
> `20260710000000:40` · `20260711000200:68,73` · `20260921000300:58` · `20260925000300:100,118` — which
> is *precisely* the set Postgres itself named via its `25P01` warnings during a reset, **line numbers
> included**, while correctly clearing the other 8 of the 12 files `grep` flags. The ground truth was
> established by the runtime, independently of this scanner. That is what retires the "syntax finds 12,
> behaviour finds 4" objection: it is retired **empirically**, not by argument.
> → [[detector-that-finds-nothing-must-be-proven-able-to-find-something]]
>
> ### The positive control the ruling demanded — three layers
> 1. **23 in-process fixtures**, run before every scan; the gate refuses to report if they fail.
>    The load-bearing one is *"bare `set local` AFTER a closed do-block"*: a scanner that enters a
>    dollar quote and never leaves would pass **every file in the repo** silently, and that fixture is
>    the only one that can catch it.
> 2. **End-to-end injection**: a bare `set local` appended to an in-scope migration → **RED, exit 1**,
>    correct file:line. Appended to a *grandfathered* migration → **green** (the watermark bound holds
>    end-to-end, not just in a unit). Wrapped in `do $$ … $$` in an in-scope file → **green**.
> 3. **Scope fixtures** pin the boundary itself, including that the watermark file *is* grandfathered
>    (strictly-above, not at-or-above).
>
> ### ⛔ The watermark is a GRANDFATHER LINE — do not bump it on a push
> Written at length in the script header, because the obvious "maintenance" is the one thing that
> breaks it. Advancing it after each `db push` would grandfather the files you just wrote, converting
> a gate that rots toward **stricter** into one that rots toward **weaker** — reversing the exact trade
> the PO made. It never needs updating.
>
> ### One real defect found while validating
> Importing the module for the all-migrations sweep **executed the CLI block**, which can
> `process.exit(1)` and kill an importing test run. Guarded with an `import.meta.url` vs `process.argv[1]`
> main check. Observed, not theorised — the sweep printed the gate's own summary line into my results.

> ## ⛔ THIS ITEM HAD NO PROGRESS.md INDEX LINE UNTIL 2026-08-18 — added that day
>
> It has a full body here and is named in **five** documents, but `grep SETLOCAL PROGRESS.md` returned
> **nothing** for its entire life, so the next §6-step-5 rotation would have dropped it silently.
> ⭐ *A body plus a narrative mention is not an index entry; the index is what a reader greps.* That
> warning is written twice in the register itself — this is the **third** item to re-earn it.
>
> ## ✅ REMEDY RULED 2026-08-18 (DM-FUP TRIAGE #7) — **a WATERMARK-bounded static lint gate, no allowlist**
>
> The lead proposed an allowlist of the frozen files and **was wrong**; the PO's instrument is better.
> Bound the gate by the **frozen watermark** (`20260928000500`) instead: check only migrations *above*
> it. **Measured: all 12 files containing `set local` sit at or below the watermark. Zero above.** So the
> gate starts green with **nothing to allowlist** — no entry to rot, no anti-join to maintain.
>
> ⭐ **The failure directions are opposite, and that is the whole argument.** A stale **allowlist** rots
> toward *weaker*: an entry outlives its file and silently skips it (`FUP-AUTHZ-ALLOWLIST-ROT` found six
> such entries where the filing named one). A stale **watermark** rots toward *stricter*: it starts
> checking newly-frozen files and reds **loudly**. Given a choice of rot, choose the one that fails loud.
>
> **Two consequences:**
> - Because nothing existing sits above the line, the gate can be a **fast static check inside
>   `npm run lint`** rather than a slow reset-log check in the Phase Gate. The "syntax finds 12, behaviour
>   finds 4" objection dissolves — those 12 are excluded by construction, not by judgement.
> - ⚠ It still needs a **positive control** proving its `do $$` / explicit-`begin` nesting detection can
>   actually fail. A gate nobody has seen fire is not a gate.

> ⛔ **STALE, CORRECTED 2026-08-18 — read this before the "still editable in place" paragraph below.**
> That paragraph says *"the five local-only ones ARE still editable in place."* **They are not.** The
> `db push` executed 2026-08-18 applied all five; the remote is at **`20260928000500`** and **zero
> local-only migrations remain**. Nothing at or below that version may be edited in place — the editable
> window did not move forward, it **closed**. → [[a-records-claim-about-an-external-system-goes-stale-silently]]

> **⛔ CORRECTED 2026-08-17 by QA (S4 review).** Two claims in the original filing below were wrong:
> 1. **It is NOT e2e-path-specific.** A plain `npx supabase db reset --local` emits **six** `25P01`
>    warnings, one of them from `20260921000300` itself. The lead's standalone reset had simply been
>    read with `tail -25`, which cut them off.
> 2. **The lead's "the opt-in is load-bearing" probe was taken at the WRONG GRAIN.** It probed the
>    **post-reset live DB**, where `protect_delete` genuinely raises `42501` — but that is not
>    *migration-apply time*. QA's surviving hypothesis (stated as hypothesis, not demonstration): the
>    trigger **is not in force while migrations apply**, because `storage.migrations` row 55
>    (`prevent-direct-deletes`) re-executes during the reset. That explains the otherwise-unexplained
>    fact that the DELETE succeeded despite a no-op opt-in.
>
> **The fix still stands and is still correct** — the `do`-block form removes the dependency on the
> runner's transaction handling either way, and was re-proved by QA. Only the causal story changes.
> ⭐ *A probe answers the question at the grain you took it; "the guard refuses" and "the guard refuses
> **at apply time**" are different claims.* → [[a-predicate-quoted-at-the-wrong-grain]]

> ## ⛔ RE-SCOPED 2026-08-17 — THREE different enumerations, and the REMEDY IS BLOCKED
>
> **The count, measured three ways, giving three answers:**
> | method | answer |
> | --- | --- |
> | this item, as filed (one specimen someone noticed) | **1** migration |
> | `grep -l 'set local' supabase/migrations/` (bounded by a SYNTAX) | **11** migrations |
> | ⭐ **the reset's own `25P01` warnings** (bounded by the BEHAVIOUR) | **4 migrations, 6 sites** |
>
> Only the third is the defect set. The other seven `set local` uses are already inside a
> `do $$` block or an explicit transaction and never warn. Sites, triaged — **they do not
> share a severity**, which the single-specimen framing hid:
> - 🔵 `20260710000000_nsp_per_hospital:40` — `check_function_bodies = false`. **Benign**: a
>   no-op here makes `CREATE FUNCTION` fail **loudly**, and it is a validation setting, not a
>   security bypass.
> - 🟠 `20260711000200_answers_form_fk:68,73` · 🟠 `20260925000300_dm3_domain_core_binding:100,118`
>   — **the dangerous class**: a GUC that bypasses an immutability guard, wrapped around a
>   **data-dependent backfill**. On a fresh local reset the backfill matches **0 rows**, so the
>   guard never fires and the no-op is invisible; on a data-bearing target it is not.
>   Exactly [[backfill-guard-wrap-data-dependent-migration]].
> - 🟠 `20260921000300_retire_meeting_attachments_bucket:58` — the originally-filed site.
>
> ### ⛔⛔ AND THE IN-PLACE FIX IS NOT AVAILABLE: all four are APPLIED ON THE REMOTE
> Measured with `supabase migration list --linked`: the remote carries every migration through
> **`20260927000360`**, i.e. **DM1–DM5·S3 have been pushed**. ⚠ **Re-measured 2026-08-17: FIVE are
> local-only, not two** — `…0927000400` (S4) · `…0928000100` (recusal) · `…0928000200` (evidence
> revoke) · `…0928000400` (D4 contract) · `…0928000500` (finalize-atomic); `…0928000300` was the
> reverted D11 inflow and does not exist. Editing applied history creates the
> drift that blocks `db push` — *restore, don't repair*. ⛔ **The five local-only ones ARE still
> editable in place** — the "not available" verdict below applies only to the four APPLIED files.
>
> ⚠ **This contradicts `dm5-handoff.md` §13.1, which states "NOTHING PUSHED, no `db push`, no
> remote reset … remote never touched by DM1–DM5". BOTH halves of that sentence are false** —
> `origin/main` is also a DM5·S5 commit. **Nothing downstream may rely on either claim.**
>
> **Past state is fine and this is not an incident:** all four applied successfully, and
> `answers_form_fk`'s following `alter column … set not null` would have failed had its backfill
> silently skipped rows. The residual risk is **future invocations**, so the remaining remedy is
> the **lint gate** below — a gate change, and therefore a PO decision, not a mid-batch edit.
>
> ⚠ **Two consequences that outrank this item.** S4's bucket retirement (`…000400`) has **never
> reached the remote**, so ADR 0120 **D9**'s binding "delete bytes by manifest FIRST" ordering is
> still owed against a **live remote** — and `FUP-DM5-CLOUD-ORPHAN-SURFACE` stops being
> theoretical. And every follow-up resting on *"the flags ship OFF so the path is unreachable in
> production"* now depends on the **remote** flag state, which **no one in this record has
> measured**.

Filed 2026-08-16 (lead) from a live near-miss in DM5·S4. `supabase db reset` **as invoked by
`scripts/e2e-prod-gate.sh`** emitted `WARNING (25P01): SET LOCAL can only be used in transaction blocks`
against `20260927000400`, whose destructive `delete from storage.buckets` is gated on
`set local storage.allow_delete_query = 'true'`. **`SET LOCAL` outside a transaction is a silent no-op.**

**The opt-in is genuinely load-bearing** — probed in a rolled-back txn: without it,
`delete from storage.buckets` raises **`42501` from `storage.protect_delete()`**; with
`set_config(..., is_local => true)` inside a `do` block, it succeeds.

- ✅ **S4's own migration is FIXED** — opt-in and DELETE moved into one `do` block, which always runs
  inside a transaction (its own, if none is open). Applies with no warning; catalog re-verified.
- ⛔ **`20260921000300_retire_meeting_attachments_bucket.sql` still carries the original idiom.** It is
  applied history and was deliberately left alone. It is fine wherever the runner wraps the file — which
  is exactly the problem: *the correctness is conditional on an undocumented property of the tool that
  applies it*, and **`db push` to the remote is a different invocation from `supabase db reset`.**
- **Worth a lint gate:** flag `set local` at migration top level (outside `do $$`/explicit `begin`).
  Cheap, and it is the same class as the four existing non-eslint gates — each added after the class
  shipped a live defect.

⚠ **Unexplained, recorded as such:** in the observed e2e-path run the migration did **not** error after
the warning (the log continues to `Seeding data`; that batch failed later on an unrelated 502). Given the
probe, a delete matching ≥1 row without the opt-in must raise — so either it matched 0 rows there or the
session already held the GUC. **Not reproduced, and no mechanism invented for it.**

### ⬛ FUP-DM5-MANIFEST-FLAG — ✅ **RESOLVED — and it was ALREADY FIXED when re-checked 2026-08-17** (owner: backend)

> **✅ RESOLVED.** Re-measured before being worked on, and the guard was already live —
> shipped in S5 (selftest control **C11**) but never marked here. Measured:
> `capture --manifest /tmp/x.json` prints *"unknown flag "--manifest" for "capture" — that
> is "verify"/"delete"'s flag"*, refuses to run, and **exits 2** — exactly the remedy this
> item specified. The committed baseline was **not** touched (`git status` on
> `supabase/manifests/` clean).
>
> ⚠ **A method note worth more than the item.** The first exit-code reading was taken
> through `| head -5` and came back **0**; the real code is **2**. That is
> [[gate-summary-can-hide-unrun-tests]]'s sibling — *a pipe reports the PIPE's exit code* —
> the same mechanism that once masked an `exit 2` as `0` in a mutation sweep. **Never read
> an exit code through a pipe.**

Filed 2026-08-16 (lead) from a live near-miss during S4. `capture` takes **`--out`**; **`--manifest`** is
`delete`'s flag. Passing `--manifest <scratch-path>` to `capture` did not error — `argFlag` returned nothing
and the code took `?? DEFAULT_MANIFEST`, **overwriting the committed S0 baseline**
(`supabase/manifests/dm5-retirement-baseline.json`). Caught by `git status`, restored with `git checkout`.

**Why it is worth fixing rather than remembering:** this is a tool whose entire purpose is to be the
authoritative record immediately *before* an irreversible deletion, and its failure mode on a typo is to
**silently overwrite the previous authoritative record**. A wrong-but-plausible flag is exactly the input it
must be hostile to. Fix: reject unrecognised `--flags` with exit 2, and/or refuse to write the default
manifest path unless `--out` is given explicitly.

⭐ **The accident was also a free verification, worth keeping:** the diff showed the retirement-bucket
figures **byte-identical** to S0's (only `capturedAt` and the core-bucket census moved) — an independent
reproduction of the 221 files / 6.93 MB / 15 PHI-tier orphan census, four days apart.

### 🟠 FUP-DM5-D11-SUPERSEDED-NEVER-RETIRES — D11's "superseded bytes retire via `disposal_state`" is **not performed, and nothing can perform it** (owner: PO decision, then backend)

> **PO 2026-08-16: DECIDE LATER.** Asked directly at S4 authorization; the PO chose to leave the inline
> `⏳ CONTESTED` pointer in ADR 0120 D11 and keep this open. Nothing in S4 depended on it. **Still owed
> before DM5's phase QA at S6** — build it or strike it; do not let S6 close over it silently.
>
> ### ⏸ RE-RULED 2026-08-17 — still DECIDE LATER, but the reason has CHANGED and that matters
>
> ⛔ **This is no longer "not yet built." It was BUILT (`6181557e`), and the build FAILED THE GATE.**
> The inflow was reverted at `5b40d62b` because marking a superseded print `disposal_pending` made
> **every superseded print unservable** — `app.resolve_document_version_bytes:72` refuses on **any**
> non-`none` `disposal_state`. So the blocker is no longer effort or scheduling; it is a **head-on
> collision between two ratified ADRs** (0121 D3/D5 vs 0120 D6/D8) at exactly one value,
> `disposal_reason_category = 'superseded'`.
>
> ⭐ **Read this item and `FUP-DM5-SUPERSEDE-SERVING-COLLISION` as ONE deferral seen from two sides** —
> this is the missing **inflow**, that is the **decision** gating it, and `FUP-DM5-DISPOSAL-JOB` is the
> missing **outflow**. ⛔ **Do not resolve any of the three alone**: ADR 0121's own argument is that
> fixing the inflow alone *"would make things look better and destroy nothing"* — a growing pile of
> `disposal_pending` rows no code path can clear, while D11 reads as honoured.
>
> ⚠ **What the D11 keystones did NOT catch, kept because it is the transferable part.** `342`'s S3p
> block was red-proven **both ways** and stayed GREEN — it asserted the **inflow** (bytes get marked)
> and never asked whether any **reader** still worked. The blast radius was one join away and no
> assertion in the slice looked there. → [[a-predicate-quoted-at-the-wrong-grain]] — the check ran, it
> just was not checking the thing.
>
> ### ✅ DECIDED 2026-08-18 — **BUILD IT, at retention expiry. The item is now WORK, not a question.**
>
> The PO ruled the collision as **(b)** (ADR 0121 **Amendment 2**): supersession does not mark bytes;
> the marking moves to the **retention clock**. So D11's clause — *"retires superseded bytes through
> `file_objects.disposal_state`"* — **stands and gets built**; only its trigger changes. The serving
> gate is untouched, which is what makes the build cheap and un-scary.
>
> ⛔ **Still not startable, and the reason has changed AGAIN — track this, because it is the third
> distinct blocker this item has had.** Not "unbuilt" (2026-08-16), not "an undecided collision"
> (2026-08-17), but **ADR 0121 D1**: inflow and outflow ship together or neither ships. The outflow is
> now the **manual runbook** (0121 Amdt 3), so the gate is its **end-to-end rehearsal — Critical FUP
> C1**. ⭐ *A stale blocker reads exactly like a live one*, so state which one is current whenever this
> item is quoted.
>
> ⚠ **Two things below are now stale and are corrected, not deleted:** *"the PO picks"* between the two
> resolutions — picked, build it; and the framing of this as a **decision** — it is an implementation
> item, and its owner is **backend**.

Filed 2026-08-14 (lead) from `qa`'s DM5·S3 review MINOR-4. **Not an S3 bug — an ADR-0120 D11 claim that the
implementation cannot honour**, so it must be either built or struck from D11.

**Measured:** re-minting supersedes the prior print (`status='superseded'`, `superseded_at` set), but **both
the old and new `file_objects.disposal_state` stay `none`**. Nothing schedules retirement, and retirement is
operator-initiated — so a superseded print's bytes persist indefinitely. The **SUBSTITUÍDO overlay** on
download depends on that lifecycle, and ADR 0114 **O1** is the same open question one layer up.

**Why it matters beyond tidiness:** this is a **20-year-retention, LGPD/ANVISA** system where "the superseded
copy is retired" is the kind of sentence an auditor reads as a control. An ADR asserting a control that no code
performs is worse than an ADR that admits the gap. Two honest resolutions, and the PO picks:
**(a)** implement retirement (scheduler or an explicit operator action) — then D11 is true; or **(b)** amend
D11 to say superseded bytes are **retained** and the overlay is the only distinction — then the record is true.
⛔ Do **not** resolve it by adding a comment saying retirement "should" happen.

### ⬛ FUP-DM5-DANGLING-PRINT-ON-DELETED-DRAFT — ✅ **CLOSED 2026-08-18** (`20260928000800`, ADR [0123](../decisions/0123-discarding-a-draft-that-has-emitted-documents.md)) — a print of a DRAFT response outlives its response, invisible to every UI (owner: backend)

> ## ✅ CLOSED 2026-08-18 — and re-deriving the shipped fix found TWO MORE DEFECTS
>
> Migration `20260928000800`. `312` **80 → 85**, red-first. The item is closed on **four** answers,
> two of which are to questions it never asked:
>
> **D1 — the guard was WRONG, not merely incomplete.** `20260928000700` argued *"Only an ACTIVE print
> represents a live page."* ⭐ **That sentence is false by this platform's own ruling.** ADR 0120
> **D6/D8** — established the hard way by the D11 serving collision — says states change the overlay
> **STAMP, never reachability**: a `superseded` print still serves bytes and still answers
> `/verificar`. Reachable through supported actions only: mint P1 → re-mint (the mint's own
> `SUPERSEDE_ACTIVE` flips P1) → coordination revokes the active P2. **Zero actives, one superseded,
> guard open.** The exit holds: `revoke_printed_document` refuses only `status='revoked'`, so a
> superseded row can still be voided (`312` t79 pins exactly that).
> → [[a-partial-fix-reads-as-a-complete-one]] · [[a-comment-is-an-assertion-that-goes-stale-silently]]
>
> **D3 — the mint read its source UNLOCKED, and no arm was asking.** The guard is `BEFORE DELETE`;
> nothing ordered it against a concurrent mint. **Measured**, not reasoned, in a scratch schema:
> unlocked → *delete succeeds, mint commits after,* **orphan created**; with `for key share` → delete
> blocks, then the trigger raises; reversed → the locked select returns **zero rows** and the mint
> aborts on its **existing** `HC0D1`. Works because Postgres takes `LockTupleExclusive` **before**
> running a `BEFORE DELETE` trigger body. The whole fix is `for key share` on one `select`.
> ⚠ **Not pinnable behaviourally** — pgTAP is single-session, so `312` t81 pins it **structurally**
> from `pg_proc`. Weaker, and said out loud rather than papered over: the alternative was a comment.
>
> **D4 — pre-existing orphans: the subject was EMPTY.** Measured on **both** environments: production
> `0` prints / `0` responses / `0` documents / `0` dangling securables; local `0` after reset. ⭐ The
> item's own *"6 of 9 local prints are `form_response` kind"* was **E2E residue in a since-reset DB**,
> quoted forward for four days as a population. A reconcile would have had nothing to reconcile.
> ⛔ **The measurement expires at the pilot** — the set is empty because nothing exists yet; D1+D3 are
> what keep it empty. → [[your-own-measurement-goes-stale-like-any-other]]
>
> **D5 — the dangling securable: the obvious repair was the DEFECT.** Both `app.can_read_document` and
> `app.can_write_document` open with `documents d join securable_resources s on s.id =
> d.home_resource_id` and return **false** when the join misses. **Deleting** the orphaned securable
> would silently revoke `request_document_disposition` for that print — **D11's only outflow** — and
> leave unreachable bytes with no disposition authority at all. It is **retained by design** as the
> historical home anchor; the full post-deletion semantics table is ADR 0123 D5.
>
> ## ⚠ A THIRD DEFECT WAS FOUND HERE AND DELIBERATELY NOT FIXED HERE
>
> `can_view_printed_document`'s `form_response` arm grants its `staff_admin` term only when
> `status = 'submitted'`, and that predicate **is** the `printed_documents_select` policy — so a print
> of an `in_progress` draft is invisible to **every coordinator except its creator**, with the source
> still alive and no deletion involved. Filed as **FUP-DM5-DRAFT-PRINT-INVISIBLE-TO-COORDINATION**
> rather than folded in: closing this item over a new door with no UI caller would have been a
> [[correct-door-that-nothing-can-reach]].
>
> <details><summary>The shipped-prevention record as it stood before closure (superseded)</summary>

> ## ⛔ RULED THEN WITHDRAWN, SAME DAY (2026-08-18) — **option 1 reverses ADR 0104 D7. Nothing was built.**
>
> **The option list below is wrong, and that is the finding.** It offers *"refuse a mint from a
> non-`submitted` response (narrowest, and **arguably right — a draft is not a document of record**)"*.
> ADR [0104](../decisions/0104-pdf-document-printing-module.md) **D7** had already ruled the opposite:
> the `RASCUNHO` watermark's derivation is *"Source not in final state at mint (**in_progress
> response**, unapproved minutes, unsigned interview)"*, and D7 item 4 says outright — ***"Completeness
> does not gate minting — FINAL/RASCUNHO already encodes it."*** Printing a draft is a **designed
> feature with its own watermark**, not an oversight.
>
> pgTAP `312` t6 pins it **by name**: *"creator sees his own in_progress draft (RASCUNHO prints are
> legal, D7)"*. The ruling would have red-ed that keystone.
>
> ⭐ **Where this actually went wrong.** The option list is part of this item's body — written once, by
> the filer, and then quoted forward as the menu. The lead recommended from it without re-deriving its
> premise; the PO ruled on the recommendation. **An option list is an assertion, and this one carried a
> justification an ADR had already refuted.** It was caught only because implementation needed a
> fixture, and the fixture file stated D7 in a comment.
> → [[verify-dont-comply]] · [[a-comment-is-an-assertion-that-goes-stale-silently]]
>
> ## ✅ RE-RULED AND BUILT 2026-08-18 (#8b) — **option 1 below: refuse the DELETE, not the mint**
>
> Migration `20260928000700` — `app.guard_response_active_print`, BEFORE DELETE on `responses`,
> raising **`HC069`**, mapped to pt-BR in `discardResponse`. ADR 0104 D7 is untouched; drafts still
> print. pgTAP `312` **77 → 80**, red-first: t74 red **and its delete succeeded**, so the orphan is
> demonstrated rather than argued.
>
> **Three design points, each measured rather than assumed:**
> - **`status = 'active'` only.** `lookup_printed_document` (the public `/verificar` door) reads
>   `printed_documents` directly and joins **only** commissions/hospitals — **never `responses`**. So
>   public verification **survives** an orphan, and a *revoked* print must keep its row and bytes
>   precisely so a paper-holder is still told `ANULADO`. Orphaning a revoked print is correct.
> - **A trigger, not an RLS predicate.** Narrowing `responses_delete_own_draft` would refuse
>   **silently**, as a zero-row delete the caller reads as success.
> - **`SECURITY DEFINER`, and it is load-bearing.** `printed_documents` carries a SELECT policy; an
>   invoker read would let a print the deleter cannot see make the guard find nothing and **allow** the
>   delete → [[guards-that-read-right-but-fail-open]].
>
> ⭐ **t76 is the assertion that carries the weight.** After the coordinator revokes, the *same* delete
> by the *same* principal succeeds. Without it, t74 is equally satisfied by a guard that blocks every
> draft delete unconditionally — a worse bug that would have read as a pass.
>
> ## ⚠ AND THE MIGRATION SHIPPED A PUBLIC-EXECUTABLE DEFINER FUNCTION — caught by a gate, not by review
>
> Written without an explicit ACL, the function took Postgres' **default PUBLIC EXECUTE**, and pgTAP
> `320` U1 (the `FUP-ACL-APP-POPULATION` census) went red at **237 → 238**. A `SECURITY DEFINER`
> function PUBLIC may call is a live door, not a detail. Fixed with `revoke all … from public` plus
> grants mirroring both sibling guards. ⭐⭐ **The defect was invisible in the diff, in review, and in
> every functional test — `312` was fully GREEN with the door open.** That is the standing argument for
> keeping the ACL census in the phase gate. → [[new-door-must-inherit-every-sibling-arm]]
>
> ## ~~⛔ STILL OPEN — two things this ruling does NOT close~~ ✅ BOTH ANSWERED 2026-08-18 (D4/D5 above)
>
> 1. ~~**Pre-existing orphans.** The guard prevents new ones; it repairs none.~~ → **D4: the set is
>    empty in both environments, measured.** Nothing to repair.
> 2. ~~**The dangling `securable_resources` row** — a securable with no subject, which every kernel arm
>    joins through. Unchanged by this fix, and still owed.~~ → **D5: retained BY DESIGN.** It is the
>    print's disposition anchor; ⛔ deleting it is the defect, not the fix.
>
> <details><summary>The options as they stood before the re-rule (superseded)</summary>
>
> ### 🔁 RE-RULE OWED — and the surviving options are NOT the three below
>
> D7 removes option 1. It also reframes the defect: **the harm was never that a draft can be printed —
> it is that the print outlives the DELETED response** as a dangling `securable_resources` row with
> unreachable bytes. Candidates, with the lead's current recommendation first:
>
> 1. ⭐ **Refuse to delete a response that has an active print.** A narrowing on the DELETE path, not the
>    mint path. Preserves D7 completely, needs **no disposal outflow**, and therefore is **not gated on
>    Critical FUP C1** — unlike cascade-disposal. The orphan stops being created.
> 2. **Cascade the print's disposal when its source is deleted.** Handles existing rows too, but widens
>    the disposal path whose only outflow is the manual unrehearsed runbook ⇒ gated on **C1**.
> 3. **Surface orphaned prints in an admin view.** Manages orphans rather than preventing them.
>
> ⚠ Under **every** candidate, the two follow-on items stand: the **existing** dangling rows, and the
> dangling **`securable_resources`** row itself — a securable with no subject, which every kernel arm
> joins through.
>
> </details>
>
> **Cheap by measurement, not by assumption:** no E2E spec mints from an `in_progress` response, and the
> print fixture pool is `submittedResponseIds` — submitted-only by construction.
>
> ⚠ **Two things the ruling does NOT cover, and they are the follow-on work:**
> 1. **Existing rows.** 6 of 9 local prints are `form_response` kind; refusing future mints leaves those
>    where they are. Needs a one-off reconcile.
> 2. **The dangling `securable_resources` row** — the body below already says this needs handling under
>    *every* option, because every kernel arm joins through it. A securable with no subject is a latent
>    authorization question, and the chosen option does not answer it.
>
> ⛔ **Cascade-on-delete was declined** — it widens the disposal path, whose only outflow is the manual
> **unrehearsed** runbook, so it would have created work gated on Critical FUP C1.

</details>

Filed 2026-08-14 (lead) from `qa`'s DM5·S3 review MINOR-5. **CONFIRMED by probe, not reasoned.**

Mint a print from a **draft** response, then delete the response: the `responses` row goes, its
`securable_resources` row is left **dangling**, and the print becomes reachable by **no UI surface at all**
(0 rows in every projection) while its bytes and registry row persist. `revoke → dispose` still works **at the
door**, so it is recoverable by someone who already knows the id — which in practice is nobody.

Note the interaction with **D18** and `DocumentHomeResourceType`: `form_response` homes render **no panel**, so
even without deletion a `form_response` print has no surface — deletion just makes it permanent. **6 of 9
prints in the local DB are that kind**, so this is the common case, not the exotic one.

**Options:** refuse a mint from a non-`submitted` response (narrowest, and arguably right — a draft is not a
document of record); or cascade the print's disposal when its source is deleted; or surface orphaned prints in
an admin view. ⚠ Whichever is chosen, the **`securable_resources` dangling row** needs handling either way —
a securable with no subject is a latent authorization question, since every kernel arm joins through it.

### ⬛ FUP-DM5-DEAD-CORE-PROJECTION — ✅ **RESOLVED 2026-08-17 by deletion** (owner: frontend + backend)

> **✅ RESOLVED.** `getDocument` deleted from `src/lib/queries/documents.ts`. Verified at
> every **import site**, not by grepping the symbol: all five detail routes import
> `getDocument` from `@/lib/queries/controlled-documents`; the only imports from
> `queries/documents` are `listDocumentsForResource` and `documentVersionAvailability`.
> `tsc` 0, all five lint gates green after removing the now-unused `DocumentDetail` import.
>
> **Deleted rather than kept-and-documented:** keeping it preserves the trap — the next
> reader has the same 50/50 chance of editing the unreachable copy, which is exactly what
> happened to ADR 0120 **D18**. ⚠ The D18 filter **survives where it is reachable**:
> `EXCLUDE_PRINTED_RENDITIONS` is still used by `listDocumentsForResource`.
>
> ⭐ **The "check for other same-name pairs" sub-item is discharged by measurement, not by
> looking:** across `src/lib/queries/*.ts`, `getDocument` was the **only** duplicated
> export name.

Filed 2026-08-14 (lead) after `tester` found it and the lead re-verified by grep. **No behavioural
defect — a legibility trap with a live cost already paid.**

- `src/lib/queries/documents.ts:260` exports `getDocument` (Wave-A core `documents` projection). **Nothing
  under `src/` imports it.**
- `src/lib/queries/controlled-documents.ts:360` exports `getDocument` **too**, and *that* is the one all
  five detail routes import.
- **The cost already paid:** the lead's ADR-0120 **D18** ruling ("exclude prints from the detail projection
  too") was implemented on the **unreachable** one. Harmless — the reachable projection selects
  `from('controlled_documents')` and a print has no row there, so prints are excluded *structurally* — but
  the ruling bought nothing, and the record briefly implied the detail path was protected by a filter when
  it is protected by the schema. Recorded in ADR 0120's D18 amendment.

**Why it hid:** two exports, one name, different modules. A grep for `getDocument` returns hits and
*looks* answered; only `grep` for the **import site** distinguishes the reachable one. Same class as
[[an-enumeration-s-boundary-must-be-the-property-not-a-syntax]] — the name is the syntax, "what the routes
actually call" is the property.

**Fix:** decide whether the core projection is (a) dead and should be deleted, or (b) intended for a
detail route not yet mounted — and if (b), say so at the definition with what will mount it. **Do not
simply delete the D18 filter from it**: if the function survives, the filter must survive with it, or a
future route mounts an unfiltered projection. ⚠ Check for other same-name-different-module pairs in
`src/lib/queries/` while there; this one was found by accident.

### 🟠 FUP-DM5-SUPERSEDE-SERVING-COLLISION — ✅ **RULED 2026-08-18: the marking trigger moves to RETENTION EXPIRY; the serving gate is untouched.** Implementation gated on Critical FUP C1 (owner: **backend**; the PO half is discharged)

> ### ✅ PO RULING 2026-08-18 — **RESOLVED AS (b): the marking TRIGGER moves to RETENTION EXPIRY. The serving gate is NOT touched.**
>
> ⭕ **The PO half of this item is DISCHARGED; what remains under this id is backend implementation
> work, not a decision.** Severity 🔴 → 🟠, owner PO → backend.
>
> **The ruling.** Option **(b)** — amend ADR 0121 D3/D5 so supersession does **not** mark bytes at
> supersession time; the `disposal_pending` marking moves to **retention expiry**, the same clock that
> governs every other version. Option **(a)** — widening `app.resolve_document_version_bytes` to pass
> `disposal_pending` bytes whose reason is `superseded` — was **declined**, on this item's own
> argument: *a narrowing can be wrong and stay safe; a widening cannot.*
>
> ⭐ **What makes (b) more than a scheduling preference: the collision does not get adjudicated, it
> stops occurring.** The two ratified decisions were only ever in contact at the supersession
> *instant*. Move the trigger and `resolve_document_version_bytes` needs no change at all — its refusal
> on *any* non-`none` state becomes correct for **every** reason value that can reach it, because
> nothing marks a version still meant to be servable. **No PHI byte-serving gate is widened, so no
> diff-scoped door sweep and no new keystone is owed against that gate.**
>
> **What survives of D3/D5** (recorded in ADR 0121 **Amendment 2**, not restated here): D3's
> **vocabulary** stands — the `duplicate` trap it was written against (its exemption lane needs a live
> same-`sha256` sibling on the **same** `documents` row, which ADR 0120 D13 guarantees a superseded
> print never has) is untouched. D5's **principle** stands; only its evaluation point moves.
>
> ⚠ **One build-time detail is deliberately OPEN and must not be settled silently:** at retention
> expiry, does the row record `disposal_reason_category = 'superseded'` or `'retention_expired'`? Both
> are true and they mean different things to a regulator. **The implementing slice decides it
> explicitly and records the choice in ADR 0121.**
>
> ⛔ **THE REBUILD IS STILL GATED — by ADR 0121 D1, no longer by an open decision.** *Inflow and
> outflow ship together or neither ships.* The outflow is now the **manual runbook** (ADR 0121
> Amendment 3), so **D11 may be built once the runbook has been rehearsed end-to-end — Critical FUP
> C1 — and not before.** Building the inflow first would convert silent retention into a growing pile
> of `disposal_pending` rows nothing has ever been shown to clear, while the D11 claim reads as
> honoured: exactly the "reads better than it behaves" failure D1 exists to prevent.
>
> ⚠ **The reverted tree stays reverted until that gate opens.** `5b40d62b` is still the state; this
> ruling authorizes a *different* build, not the restoration of the old one.
>
> <details><summary>Superseded — the 2026-08-17 deferral, kept because its reasoning shaped the ruling</summary>
>
> > ### ⏸ PO RULING 2026-08-17 — **DECIDE LATER; the inflow STAYS REVERTED.** The item remains 🔴 OPEN.
> >
> > Both offered resolutions were **declined for now**: neither widen `app.resolve_document_version_bytes`
> > to pass `disposal_pending` bytes whose reason is `superseded`, nor reinterpret ADR 0121 **D3/D5**'s
> > ratified *"superseding marks bytes"*. The tree stays as `5b40d62b` left it.
> >
> > ⭐ **Why deferring is a real position here and not a punt.** The reverted state is *coherent*: no
> > inflow without an outflow (ADR 0121 **D1** satisfied), no unservable superseded prints, and nothing
> > in production depends on D11. The two open options are **not symmetric** — widening a PHI
> > byte-serving gate cannot be un-shipped safely, while the cost of waiting is a `disposal_state` that
> > stays `none` on superseded prints, which harms nobody today.
> > → [[keystone-measured-what-i-built-not-what-breaks]]: *a narrowing can be wrong and safe; a widening
> > cannot.*
> >
> > ⛔ **A DEFERRAL IS NOT A CLOSURE, and three things follow from that.**
> > 1. **This item stays 🔴 and S6 may NOT close over it.** It is not discharged by DM5 completing.
> > 2. **D11 cannot be rebuilt until this is decided** — it is the blocker, and ADR 0121 D3/D5 are
> >    ratified text currently **not implemented**, which the ADR must keep saying out loud.
> > 3. ⚠ **`FUP-DM5-D11-SUPERSEDED-NEVER-RETIRES` is the same deferral seen from the other side** —
> >    superseded print bytes still never retire. Do not read that item as independently open work.
> >
> > ⚠ **The condition that would force this decision:** anything that makes superseded prints accumulate
> > at volume, or a retention/erasure obligation landing on them. Re-put it to the PO then, not on a
> > schedule.
>
> </details>
>
> ⚠ **Two claims above went stale on 2026-08-18 and are corrected here rather than deleted, because
> both are the kind a later reader would otherwise quote as current.** *"D11 cannot be rebuilt until
> this is decided"* — it is decided; the blocker is now **D1's outflow gate** (Critical FUP C1).
> *"`FUP-DM5-D11-SUPERSEDED-NEVER-RETIRES` is the same deferral seen from the other side"* — still
> true, and the two now move together toward a **build**, not toward a decision.

Filed 2026-08-17 (lead), **found by the Phase Gate, not by review**, after the D11 inflow was
built, keystoned, red-proven and committed. `312` t38 — *"a revoked document still SERVES"* —
died with `documento descartado`. The inflow was reverted (`5b40d62b`); this item is the
decision that has to be made before it can be rebuilt.

**Mechanism, catalog-read.** `app.resolve_document_version_bytes:72` refuses on
`disposal_state <> 'none'` — **any** non-`none` state, not just `disposed`. So marking a
superseded print `disposal_pending` means **the previous PDF stops opening the instant a
document is re-issued.** ADR 0120 **D6/D8** rules the opposite: a print's states change what
the overlay **stamps**, never its **reachability**.

**⭐ The collision is exactly one value wide, and both sides are right.** Refusing to serve
`disposal_pending` bytes is CORRECT for `subject_request` and `retention_expired` — a subject
asked for erasure, so serving stops before the bytes are destroyed. It is WRONG for
`superseded`, where an auditor must still be able to open what was previously issued. The
whole disagreement lives at `disposal_reason_category = 'superseded'`.

**The decision, stated so it can be taken:** either
**(a)** widen `app.resolve_document_version_bytes` to pass `disposal_pending` bytes whose
reason is `superseded` — a change to a **PHI byte-serving gate**, needing its own keystone and
a diff-scoped door sweep; or
**(b)** amend ADR 0121 D3/D5 so supersession does not mark bytes at supersession time (e.g.
marking on retention expiry instead), leaving the serving gate untouched.
⛔ **Not lead-decidable.** (a) widens a PHI serving gate; (b) reinterprets a PO-ratified
decision. A narrowing can be wrong and stay safe; a widening cannot — which is why this
reverted rather than patched.

⚠ **What the D11 keystones did NOT catch, and this generalises.** `342`'s S3p block was
mutation-proven in both directions and green throughout — because it asserted **the inflow**
(bytes get marked) and never asked whether anything **downstream** still worked. The blast
radius was one join away and no assertion in the slice looked there.
[[a-predicate-quoted-at-the-wrong-grain]]: the check ran, it just was not checking the thing.
**When a change writes a new value into an existing state column, sweep every READER of that
column before believing the keystone.**

### ⬛ FUP-DM5-BYTE-PROOF-NOT-ATTEMPTED — ✅ **RESOLVED 2026-08-18** — the disposal evidence recorded `not_attempted` from the ONE lane that actually deleted the bytes (owner: backend)

> ## ✅ RULED 2026-08-18 (DM-FUP TRIAGE #2) — **write `unavailable_on_platform`**
>
> Fix site: `reclassifyDocument` in [`src/lib/documents/actions.ts`](../../src/lib/documents/actions.ts)
> — named by SYMBOL, not by line: this cited `:416` when written and the fix's own comment block moved
> it to `:426` within the hour ([[a-comment-is-an-assertion-that-goes-stale-silently]]). Add
> `p_byte_proof: 'unavailable_on_platform'` to the `complete_document_disposal` call, plus a pin so
> nothing silently reverts to the DEFAULT. Vocabulary re-verified from the live catalog
> (`pg_get_functiondef`, not migration text): `local_volume_verified` · `unavailable_on_platform` ·
> `not_attempted`.
>
> ⭐ **The deciding fact was not in the filing: no app code branches on deployment.** `src/lib/documents/`
> and `src/lib/supabase/` carry **zero** `STORAGE_BACKEND` / `isLocal` / `NODE_ENV` checks, so ONE literal
> serves both environments — while the honest answer differs between them (locally the volume is
> walkable and `local_volume_verified` is earnable; on Cloud it is not). `unavailable_on_platform` is the
> only value that is never an overclaim in either: it understates locally and is exact on Cloud.
>
> **Two alternatives explicitly rejected, and why they are worth naming:**
> - **Derive it from an env var.** Accurate per environment, but a *misconfigured* env writes a FALSE
>   proof into the regulator-facing ADR 0121 D4 evidence — failing in the reassuring direction, which is
>   the entire `FUP-DM5-NO-ANSWER-VS-NOTHING` class.
> - **⛔ Verify at call time, then write the result.** The intuitive option, and the trap: a Storage-API
>   `list()` after `remove()` reads **`storage.objects`** — metadata, not the volume. It would manufacture
>   `local_volume_verified` out of the exact proxy that NO-ANSWER instance 3 exists to condemn. Recorded
>   here so it is rejected deliberately rather than proposed again later.
>
> ⚠ **This ruling may be revisited by `FUP-DM5-CLOUD-ORPHAN-SURFACE`.** If the constructed-orphan probe
> proves Cloud *does* expose an orphan-visible surface, a fourth vocabulary value gets **earned by that
> measurement** — it is deliberately not pre-authorized here.

Filed 2026-08-17 at the DM5 **phase** QA (M4), catalog-verified by the lead before filing.

**Measured.** `public.complete_document_disposal(p_file_object_id uuid, p_byte_proof text DEFAULT
'not_attempted')`. Its **only production caller** is `reclassifyDocument`
(`src/lib/documents/actions.ts`), which calls it **without `p_byte_proof`** — *three lines after*
performing `admin.storage.remove([oldFile.storage_path])` and checking `rmError`. So the row records
**"byte deletion not attempted"** for a deletion that **was attempted and succeeded**.

⛔ **Why this is more than cosmetic.** `disposal_evidence` is the ADR **0121 D4** artifact — the thing
that says what a disposal actually did, for a regulator. This is the one code path in the product that
*can* honestly claim a byte proof, and it is the one that disclaims it. ⚠ It errs **conservatively**
(claims less than it did), which is why nothing catches it: no gate fails, and the record merely looks
modest. But it is still a **false statement in a PHI evidence trail**, and it makes the strongest
available evidence indistinguishable from the weakest.

⭐ **Shape:** [[declared-param-no-caller-blind-spot]] — a parameter exists, carries a safe-looking
default, and the only caller never passes it, so the default *is* the behaviour and the parameter reads
as unused. Related: [[a-backfill-masks-the-broken-write-path]] (the write path was never taught).

**Fix:** pass the real outcome from the lane that knows it. ⚠ Decide deliberately what the value means
when `remove()` succeeds against Cloud — the S5 finding stands that a Storage-API success is **not**
proof of byte destruction there (`FUP-DM5-CLOUD-ORPHAN-SURFACE`), so the honest value may be
lane-dependent rather than a flat "attempted". **Needs a pgTAP pin either way** — today nothing asserts
what any lane writes into `byte_proof`.

### ⬛ FUP-DM5-ATTACHMENTS-MODULE-SURVIVED-RETIREMENT — ✅ **RESOLVED 2026-08-18 by deletion of `actions.ts` ONLY** — the legacy module the retirement phase was named for (owner: frontend + backend)

> ## ⚠ SCOPE NARROWED 2026-08-18 BY MEASUREMENT — **the title over-reaches; do not delete the directory**
>
> The item says *"`src/lib/attachments/` survives."* Measured, the directory has **two** files and they
> have opposite fates:
> - **`actions.ts` — DELETE.** 6 `'use server'` exports, **zero importers**. The only surviving reference
>   anywhere is a doc comment at `src/lib/queries/case-documents.ts:17` naming `openAttachment` as the
>   audited door, which should be corrected in the same pass.
> - **`constants.ts` — KEEP. It is LIVE**, with 3 importers: `src/lib/queries/attachments.ts`,
>   `src/lib/queries/interviews.ts`, and transitively `src/lib/queries/meetings.ts` via `listAttachments`.
>
> ⭐ Deleting on the title rather than on the measurement would have broken three query modules — the
> same shape as the defect the item itself describes, where a sweep bounded by the wrong unit misses what
> it was aimed at.

Filed 2026-08-17 at the DM5 **phase** QA (M3).

`src/lib/attachments/` survives DM5 with **6 dead `'use server'` exports** whose own comments say
*"until DM2 retires it"*. The **buckets** are retired and the catalog is clean — the S6 exit sweep
measured **0 functions / 0 policies / 0 constraints / 0 defaults** referencing any of the 8 retired
names — so this is **dead application code, not a live byte path**, which is why it is 🟡 and not
higher.

⭐ **Why the S6 exit sweep could not see it, and this is the transferable part:** that sweep was bounded
by **identifier** (`storage_path`, `storage_bucket`, bucket literals, `createSignedUrl`) — deliberately,
because bounding by directory had failed before. A module that no longer *references* a retired bucket
but still *exists* matches none of those identifiers. **Both bounds are right and both are incomplete:**
"does anything still point at the retired thing?" and "is the thing that pointed at it gone?" are
different questions, and DM5 only ever asked the first.
→ [[enumeration-boundary-is-a-syntax-not-a-property]], [[cutting-a-table-does-not-cut-its-doors]].

**Before deleting:** verify by identifier that nothing imports these exports (a dead `'use server'`
export is still a live RPC surface if any client references it), and check the `attachments`
**feature-flag key** separately — it is still read live at `attachments/actions.ts:35` and
`interviews/actions.ts:798`/`:834`, and it is a *flag key*, **not** a bucket name (the `case_patient`
name-collision class).

### 🟠 FUP-AUTHZ-COMMAND-DOOR-UNSWEPT — ⭕ **RE-SCOPED 2026-08-17 (pre-S6): the filed premise was FALSE, the population is 407 not one, and the class is COVERED-BUT-UNPINNED, not blind** — ⭐ **Critical FUP C2** (owner: lead + backend)

> ### ✅ PO RULING 2026-08-18 — **TWO TIERS. Sweep the PHI / tenancy-crossing subset first; DEFER the remainder to after the pilot ships.**
>
> Recorded as **Critical FUP C2**. The decision that was owed was the **sizing**, and it is taken:
>
> **Tier 1 — sweep now, as its own scoped workstream.** The subset of the 407 that **touches PHI or
> crosses a tenant boundary**. Each swept door gets a **recorded verdict**, so a regression reds and —
> the actual point — **a NEW door cannot pass by absence.**
> **Tier 2 — the remainder is DEFERRED** until after the pilot ships and there are real customers.
>
> ⛔ **Tier 1's population is DERIVED FROM THE CATALOG AS A PROPERTY, never hand-listed.** This item's
> own history is the argument: it was filed on an inferred premise that measured **false**, and the
> phase's dominant failure class is an enumeration bounded by a **syntax or a filename** instead of a
> property → [[enumeration-boundary-is-a-syntax-not-a-property]]. A hand-picked "PHI-looking" list
> would reproduce it exactly. **Sizing Tier 1 — deriving the predicate and counting what it returns —
> is step one and is NOT yet done.** The tier split is ruled; the number is unknown.
>
> ⚠ **What this ruling does NOT do, stated because the temptation is structural:** it does not close
> Tier 2, and it does not let the 3-door sample stand in for either tier. ⛔ **The sample may not be
> used to close anything** — it establishes that the class is *covered*, which is why this is 🟠 and
> not 🔴, and nothing more. ⭐ *Absence of a verdict is not absence of coverage* — and the inverse
> holds too: **presence of coverage is not a verdict.** Nothing today records *why* any of the 407 is
> safe, so nothing notices when one stops being safe.
>
> ⚠ **`assume_role` is still ERROR-shaped, not COVERED**, and it is in Tier 1 by construction
> (`platform_role` crosses every tenancy boundary there is). Its suite run changed shape — `315`
> failed tests 5–6 then **aborted** (*"Bad plan… you planned 22, ran 7"*, exit 3). Per the door-audit
> convention that is **ERROR**, and CLAUDE.md is explicit: **`ERROR` is not a pass.** It must be
> resolved *within* Tier 1, not inherited as already-swept.

Filed 2026-08-17 (lead) on measuring, rather than trusting, a green `ARM=census`. Re-scoped
the same day, before opening S6, by measuring the two things the filing had *inferred*.

**What still holds.** `public.complete_evidence_upload_verification` (new,
FUP-DM5-FINALIZE-ATOMIC, `prosecdef = t`) is absent from every findings file, and
`ARM=census` reported *"every live authz gate carries a verdict (no unswept newcomer)"* —
546 live / 570 verdicts — **and passed.** The census's DEFINER clause is bounded by
`t.typname = 'bool' or (p.proretset and has_function_privilege('authenticated', …))`; the door
returns **`jsonb`** and is not set-returning, so it is outside the census domain entirely.

⛔ **The supporting claim was FALSE, and it understated the finding.** The filing argued this
was *"a gap rather than a definition"* because the door sweep's domain is wider —
`complete_document_upload_verification` *"**is** in the findings"*. **Measured: it is not.**
That name occurs in `authz-door-audit-findings.md` **only inside a prose paragraph stating
that the ten S2 command doors are excluded by definition**, and `verdicts_from_findings`
scrapes **markdown table rows only** (`^| `). Same for `mint_printed_document` in
`authz-rowdoor-audit-findings.md:38` — prose, inside a `>` blockquote. **No jsonb/void command
door carries a verdict anywhere.** The door sweep's PRED domain is in fact *narrower* on the
bool axis (it adds a `^(is_|can_|has_|…)` name regex the census deliberately omits).
⭐ So this is not one newcomer slipping through a boundary that covers its siblings — **the
entire population sits outside every arm's domain**, and the one document that mentions it
does so where no scraper reads. → [[a-predicate-quoted-at-the-wrong-grain]].

**The measured population** (live catalog, 2026-08-17, post-`db reset`):

| | count |
|---|---|
| `prosecdef` functions in `app`+`public` | **774** |
| in `ARM=census`'s domain — `bool` | 135 |
| in its domain — set-returning + `authenticated`-reachable | 49 |
| **outside every arm's domain** | **590** |
| ↳ `authenticated`-reachable, `prokind='f'`, non-trigger = **real command doors** | **407** |
| ↳↳ of which in `public` (PostgREST RPC-callable) | **326** |

`create_case`, `assume_role` and `add_referral_shared_item` appear in **no** findings file, **no**
allowlist and **not** in `authz-unswept-backlog.txt`. Each is a DEFINER, so by CLAUDE.md's own
standing rule its internal gate *replaces* RLS — it **is** the boundary.

**⭐ THE SAMPLE — and it inverted the expectation.** Rather than infer blindness from "no arm has
asked", three doors were neutralized (guard condition → `false`) and the full pgTAP suite run
against each. **All three went RED. The class is COVERED, not blind:**

| door | neutralized | suite | failing assertion | verdict |
|---|---|---|---|---|
| `add_referral_shared_item` | `can_read_case` recusal check | 194f / **6392** / FAIL | `340` R5–R6 *"the recused coordinator can no longer freeze a NARRATIVE…"* | **COVERED** |
| `create_case` | `is_staff_admin_of ∨ is_admin ∨ member_can` | 194f / **6392** / FAIL | `177`:13, `205`:45 *"a plain staff … is denied (42501)"* | **COVERED** |
| `assume_role` | `if not v_holds` (holds-the-role check) | 194f / **6377** / FAIL | `315`:5 *"sa_x CANNOT assume a role he does not hold"* | **COVERED**, ⚠ ERROR-shaped |

⚠ **`assume_role` is not a clean COVERED and is not recorded as one.** Its run shape differs
from baseline — `315_act_stage3_hat_condition.sql` failed tests 5–6 and then **aborted**
(*"Bad plan. You planned 22 tests but ran 7"*, exit 3), which is exactly the 6392 → 6377 delta.
Per the door-audit convention a shape change is **ERROR**, and CLAUDE.md is explicit that
`ERROR` is not a pass. The *first* failure is nevertheless a true authorization assertion, so
"something noticed" is established; "the suite is clean about it" is not.
`add_referral_shared_item` doubled as the **positive control** (the ADR 0122 keystone was built
for exactly this) — it went RED, proving the harness can find something
([[detector-that-finds-nothing-must-be-proven-able-to-find-something]]).

**⭐ Calibration, corrected in BOTH directions.** Not a vulnerability — but also **not a
coverage hole**, which is what "unswept" implied. The coverage is real; what is missing is the
**verdict**. Consequences, which are the actual finding:
1. **The coverage is unpinned.** Nothing records that these 407 doors are covered, so nothing
   detects if that coverage regresses. A keystone deleted tomorrow reds nothing.
2. **A NEW door in this class inherits no arm at all** — it is absent from every findings file,
   so it passes every arm *by absence*. Precisely the ADR 0079 Amendment 7 shape.
3. **`ARM=census` prints a claim wider than its domain** — *"every live authz gate carries a
   verdict"* over a domain excluding the application's entire command layer.
   → [[enumeration-boundary-is-a-syntax-not-a-property]], [[a-census-whose-parts-dont-sum-is-wrong]].

**Fix (unchanged in shape, re-sized).** Widen the census's DEFINER clause to admit reachable
non-trigger command doors, re-run, expect **RED with ~407 entries**, and triage — as ADR 0079
Amendment 7 did for `ARM=wrapper`. ⚠ **407 is too many to classify honestly in one pass**, and a
backlog filled with generic reasons is itself a vacuous act; sizing that triage is a **PO
decision**, not an implementer's. ⛔ **Do not close this on the 3-door sample** — three COVERED
results are evidence about three doors, not about 407 ([[a-detector-that-finds-a-lot-needs-proving-too]]).

**Harness safety, for whoever runs the full triage.** The suite runs in a **separate
connection**, so an in-transaction neutralization is invisible to it and cannot be used
(FUP-AUTHZ-HARNESS-TRANSACTIONAL). What was used instead, and worked: exact
`pg_get_functiondef` captured as the restore artifact · an **EXIT trap** restoring on any abort ·
an assertion that the neutralization **landed** (md5 must change — a silent no-apply would make
the run PASS *"having asserted nothing"*, which it did catch: `docker cp` + `psql -f` fails
silently on Windows because MSYS rewrites the container-side `/tmp` path to `C:\tmp`; use
`docker exec -i … < file`) · md5 re-verified after restore · the property sweep
`^\s*begin\s+return\s+(true|false)\s*;\s*end` clean before **and** after · and the suite
re-run to **194f/6392 PASS** to prove the stack was returned to baseline.

### 🟡 FUP-ACL-APP-POPULATION — ⭕ **RE-SCOPED 2026-08-17: the assertion is BUILT; the 237-function triage is what remains** (owner: backend + PO)

> **✅ The blind spot is closed.** `320` block U (+4, plan 10 → 14) replaces the 8-name
> allowlist with a **schema-bounded** population pin, so a new `app` door with a default
> ACL reds immediately instead of inheriting no coverage. U2/U2b are the t19c-style
> control: creating one probe function moves the count 237 → 238 and dropping it returns
> it to baseline — the detector is **shown to move**, not assumed to
> ([[detector-that-finds-nothing-must-be-proven-able-to-find-something]]).
>
> **⛔ What the first measurement actually found, and why it is NOT a mass revoke.**
> **237 of 454** `app` functions are PUBLIC-executable — 228 by default ACL (**159 of
> them SECURITY DEFINER**) plus 9 by an explicit PUBLIC grant — and `anon` resolves
> EXECUTE on all 237. The nine explicit ones name the hazard: `is_admin`,
> `is_member_of`, `is_staff_admin_of`, `is_org_admin_of`, `eval_condition`, `answer_map`,
> `latest_published_version`, `commission_of_version`, `can_read_correction_response`.
> **These are evaluated INSIDE RLS policies, which run as whatever role is reading —
> including `anon` on auth-flow paths.** Their PUBLIC grant is a decision, not drift, and
> a blanket revoke would break policy evaluation platform-wide. U3 pins that: a
> schema-wide revoke now reds in `320` rather than in production.
>
> **⬜ REMAINS OPEN — the triage, which is the real work and was never the query.** Walk
> the 159 default-ACL DEFINER functions and decide each: legitimately PUBLIC (RLS-
> evaluated) vs. should be revoked. Drive the baseline down as each batch lands.
> Calibration unchanged: `config.toml` exposes only `public`, so none of these is
> PostgREST-reachable — **defence-in-depth, not a leak path**, which is why the ratchet
> was the right increment and a rushed mass revoke was not.

<details><summary>Original filing (2026-08-14) — retained</summary>

Filed 2026-08-14 (lead) while verifying S3's `DROP`+`CREATE` PUBLIC-EXECUTE find. **Defence-in-depth,
not a leak path** — `config.toml` exposes only `public`, so an `app` function with PUBLIC EXECUTE is
not PostgREST-reachable. Recorded because the mechanism has now fired **three times** (TV, DM5·S2,
DM5·S3) and the `app` side has no generic net.

- `100_dashboard` **t19** — *"no FIRST-PARTY public function is anon-executable"* — is bounded by
  `nspname = 'public'`. Correct and well-built (it has control **t19c** proving the detector moves
  0→1, and it uses `has_function_privilege`, which **resolves** a default ACL).
- `320:170-180` — the only `app`-side check — is bounded by **8 hard-coded function names**. That is
  the "remembered-doors allowlist" that [[guards-that-read-right-but-fail-open]] itself warns is blind
  in precisely the case that matters, and a new `app` DEFINER door (e.g. S3's
  `app.resolve_document_version_bytes`, on a PHI byte path) inherits no coverage from it.

**Fix:** generalize `320`'s uniformity assertion from the 8 names to **all `app` functions**, keeping
its existing `p.proacl is null or exists(… grantee = 0)` shape (⚠ that `is null` arm is load-bearing —
`aclexplode(NULL)` returns **no rows**, so dropping it makes the check blind to exactly the default-ACL
case it exists for). Give it a **control** in t19c's style, and expect the first run to be **RED with a
list** — `app` almost certainly holds legitimate PUBLIC-executable helpers, and the real work is
triaging that list, not writing the query. Pair with the over-revoke twin (`authenticated`/`postgres`
retain EXECUTE) or a fix that over-reaches will pass the security half while breaking the app.

</details>

### 🟠 FUP-DM5-SIBLING-GUARD-DIFF — **no authz arm can see a door that OMITS a check its sibling doors all make** (owner: lead + backend; a gate-coverage gap, not a defect)

> ## ⭕ FOLDED INTO CRITICAL FUP C2 TIER 1 — 2026-08-18 (DM-FUP TRIAGE #5)
>
> This wants a transitive catalog guard-set diff over `prosecdef` doors. So does C2's 407-door Tier 1
> sweep, and so does `FUP-DM5-Q1-OPEN-BYTES-CUT-BROKEN`'s re-pointed arm
> (`app.resolve_document_version_bytes`). **One piece of door-mutation machinery, three consumers** —
> building it three times was declined.
>
> ⚠ **Absorption is not closure.** This item keeps its own index line, its own severity, and needs its
> own recorded verdict; it closes when the diff exists **with a positive control**, not when Tier 1 ships.

Filed 2026-08-14 (lead) on confirming **BUG-DM5-S3-INACTIVE-PRINT-1** (PROGRESS.md).

**The gap.** ADR 0079's standing gate has five arms and **none of them can detect this class**:
`floor` asks *is the door called*; diff-scoped `policy` asks *does anything notice when a gate is
opened*; `census` asks *has anything ever asked*; `hat` asks *does it read `memberships` without
the caller's hat*; `wrapper` covers the `prosecdef = f` half. **Every arm tests a gate that is
there.** A *missing* term is invisible to all five, because neutralizing nothing changes nothing —
and it is invisible to review too, since the door reads perfectly sensibly on its own.

**The specimen.** `app.can_read_document` guards `app.is_active(p_uid)` **above** its type dispatch;
`app.can_view_printed_document` has no effective `is_active` term, because its `form_response` arm's
first disjunct is the bare column comparison `v_resp.created_by = p_uid`, behind an `or`. Confirmed
by probe, not by reading. Latent only because `document_printing` ships OFF.

**Proposed check** (cheap, and it is a *comparison*, not a new mutation arm): for each family of
doors guarding one resource class, diff their guard sets from the catalog — `is_active`, tenancy,
flag assert, PHI gate, disposal, status — and require every asymmetry to be either fixed or
**recorded as deliberate**. Two design constraints learned the hard way:
1. Resolve each term **transitively**, and treat a term reached only through an `or` as **absent** —
   a callee cannot rescue a disjunction. (Bare structural `prosrc ~ 'is_active'` would have called
   `is_staff_admin_of_for` sufficient and **cleared this door**.)
2. It must carry a **positive control**: assert the door returns `true` for an *active* principal
   before flipping the bit, or the `false` afterwards proves nothing.

⚠ **Do not fold this into `p0-authz-invariant.sh` as a sixth arm without sizing it** — the four
phase-step arms are 2 s / 10 s / 1 min / 2 s precisely because they are cheap; a full-closure guard
diff over every door family is a periodic audit, like `ARM=wrapper`'s ~100 min sweep. Decide which
it is *before* writing it, and if it lands as periodic, say so in §6 rather than calling it standing —
"standing in prose alone" is what let three weeks pass before a sweep that then found 15 BLIND gates.

### ⬛ FUP-DM5-330-WRITE-BLIND — ✅ **RESOLVED 2026-08-17** (owner: backend)

> **✅ RESOLVED** by `330` block W (+5, plan 57 → 62), a labelled commit of its own as the
> re-scoping required.
>
> ⭐ **The blindness was RE-DERIVED, not inherited — and it was still real.** The filing
> warned that `BUG-DM5-S2-WRITE-ARM-1`'s fix (`fc7a146d`) changed the body after the
> verdict was recorded, and [[a-rename-orphans-a-name-keyed-verdict]] applies to a body
> edit too. Measured against the live catalog: rewriting the `controlled_document` arm to
> `return true` and re-running the file gave **All tests successful across all 57**. The
> keystone was then authored *against that open gate*, so its red is a **run, not a
> prediction** — W2 and W3 fail, the three positive controls stay green, and after
> restoring the gate all 62 pass.
>
> **W3 is the discriminating one.** `staff1.farm` is an approver of this document and A3
> (same file) already proves he READS it. The write arm deliberately has no approver half
> — *"an approver reads the artifact he reviews; he does not replace its bytes"*, the
> body's own comment. Same persona, same document, opposite answers: the asymmetry is now
> pinned as a **decision** rather than surviving as an oversight nobody could distinguish
> from one.
>
> ⚠ **The distinction that kept this open was correct and is worth keeping:** door-level
> BLIND lifting ≠ arm-level coverage. `342` covering the print arm would have lifted the
> door's finding while this arm stayed uncovered **wearing a COVERED status** — STALE-
> COVERED as a *status* change rather than a *body* change, which no existing check looks
> for. It was right not to close this on `342`.
>
> ⛔ **The gate restore was verified against `prosrc`, not assumed** — the shared local
> stack has had an authz gate left open by a sweep before
> ([[mutation-harness-must-prove-its-rollback-first]]).

<details><summary>Original filing + re-scoping (2026-08-14) — retained</summary>

> **Re-scoped 2026-08-14 (lead) after `backend` correctly declined to fix it inside S3.** Its reasoning
> is right and is retained: the door sweep's unit is the **suite set**, not one file, so `342` noticing a
> neutralized `can_write_document` is what lifts BLIND — and folding S3 keystones into DM3's suite is the
> same objection that moved S3's own suite off `341`, one file over.
>
> ⛔ **The distinction that keeps this open: door-level BLIND lifting ≠ arm-level coverage.** Once `342`
> covers the **print** arm, neutralizing the whole door is noticed and the finding lifts — while the
> `controlled_document` arm `330` was supposed to be watching stays uncovered, now wearing a COVERED
> status. That is **STALE-COVERED reappearing as a *status* change rather than a *body* change**, which no
> existing check looks for. Do **not** close this on `342`'s coverage. `330`'s own hygiene is a separate
> labelled commit, deliberately not in S3.

Filed 2026-08-14 (lead), carried out of the DM5 handoff where it existed **only in prose** and so was
in no tracked place. Surfaced when `can_write_document` was re-swept for the S2 arms (`fa28ec19`) —
it had been **STALE-COVERED**: a verdict recorded against the door under its pre-S2 body, which the
S2 `rca`/`capa_action` arms then changed. Per §6 step 1 a BLIND door **blocks a phase**, so this must
be keystoned (not allowlisted — `can_write_document` is a write authority, never an unreachable
backstop). ⚠ Re-derive whether it is *still* blind from the live catalog before writing the keystone:
`BUG-DM5-S2-WRITE-ARM-1`'s fix (`fc7a146d`) changed the body afterwards, and
[[a-rename-orphans-a-name-keyed-verdict]] applies — a name-keyed verdict does not follow a body edit.

</details>

### 🟡 FUP-ROTATION-BREAKS-LINKS — **every §6-step-5 rotation silently 404s its own links; 474 are broken today** (owner: lead)

Filed 2026-08-17 (lead), **measured, not inferred** — a link-resolution sweep over the four rotation
destinations after this pass's own rotation.

**The mechanism, and it is structural rather than careless.** PROGRESS.md sits at the **repo root**,
so its links are root-relative (`](docs/decisions/0120-….md)`). Every rotation destination lives in
**`docs/progress/`**. The §6 step-5 protocol says to preserve the block **verbatim** — and a verbatim
copy of a root-relative link **404s from one directory down**. ⛔ **The protocol's own correctness
requirement is what breaks the links.**

**Measured, per destination** (broken relative links, excluding this pass's appends, which were
repointed):

| destination | broken |
|---|---|
| `phase-status-archive.md` | **167** |
| `qa-verdicts-archive.md` | **154** |
| `decisions-log.md` | **144** |
| `dm5-wave-d-retirement.md` | **9** |
| **total** | **474** |

⭐ **Why this is worth a follow-up and not a cleanup commit.** These files are the *destination of
every rotation* — the place the live file points a reader when it says *"detail lives in the
record."* A 404 there means the rotation **moved the text out of reach while reading as though it
archived it**, which is the same shape as this phase's dominant class: an action performed
(*rotated*) recorded as the state achieved (*preserved and reachable*).
→ [[a-records-claim-about-an-external-system-goes-stale-silently]]

⚠ **This pass reproduced the defect before catching it** — 77 fresh broken links across three
archives, found only because a link check ran *after* the rotation rather than being part of it.
They are fixed (`](docs/…)` → `](../…)`); the 474 above are the pre-existing backlog.

**Remedy, in order of value:**
1. ⭐ **Make the transform part of the rotation recipe** in `docs/lead-playbook.md` §§4–5 — one
   `](docs/` → `](../` pass after the append, *before* the cut. Cheap, and it stops the growth.
2. A one-off sweep to repair the 474. ⚠ **Mechanical but not blind** — a few links legitimately point
   at root files (`CLAUDE.md`, `PROGRESS.md`) and need `../../`, so the transform is two rules, not one.
3. ⛔ **Do NOT "fix" this by rewriting links in PROGRESS.md itself** — they are correct *there*. The
   defect belongs to the copy, not the source.

⚠ **The verification claim needs the same care.** Four rotation headings in this pass originally read
*"preserved byte-for-byte, `cmp`-verified"*, which stopped being true the moment the links were
repointed. All four now state exactly what holds: **prose verbatim, link targets repointed.**
*An almost-true verification claim is the thing this whole register exists to catch.*

### 🟡 FUP-VACUOUS-COVERAGE-1 — two PHI-remediation tests that **NEVER RUN**, and `lint:vacuous` is structurally unable to catch them (owner: tester + backend)

> ### ⛔ BODY WRITTEN 2026-08-17 — this item had **NO body in this file** for its entire life
>
> Until now its single line in PROGRESS.md's head list *was* the whole record, and that line carried
> its own warning: *"THIS LINE IS THE ONLY RECORD — do not compress or cut it believing a body
> exists."* ⭐ **It was found exactly the way that warning anticipated** — by a pre-rotation check that
> asked, for all 54 head entries, *"does this have a body?"* rather than assuming the head list was a
> summary of something. **53 did. This one did not.** A rotation that compressed the head list without
> that check would have deleted the item outright while looking like tidying.
> → [[enumeration-boundary-is-a-syntax-not-a-property]]
>
> ⚠ Context also survives in `docs/reviews/vacuous-assertion-audit.md` and
> `docs/progress/bug-log-archive.md`, but neither is the follow-up register, so neither would have
> kept the item *open* — they record it as history, not as work.

**The finding.** `e2e/phi-remediation.spec.ts` **REM-8** and **REM-9** skip on **every** run: there is
no seeded RCA for `EV-0001`, and the only CAPA has a `NULL source_event_id` (both catalog-verified).

⛔ **Why the lint gate can never help here — this is the point of the item.** They are *honest*
`test.skip()`s, not silent greens. `lint:vacuous` (`scripts/check-vacuous-assertions.mjs`) exists to
catch **a test that goes GREEN having asserted nothing**; a test that never runs is **outside that
property**. So the gate is working as designed and the coverage hole is invisible to it —
**two different failures that both end in "the suite is green and the behaviour is untested."**
⭐ Filed *because* the audit that produced the gate noticed the gate's own boundary.

**Why it is its own item and not a drive-by.** Closing it means new fixture work against `seed.sql`,
which is **a contract with ~900 tests** — the shared-fixture hazard in
[[shared-fixture-cannot-satisfy-two-specs]]. Adding a seeded RCA for `EV-0001` and a CAPA with a real
`source_event_id` changes counts other specs assert on.

⚠ **Whoever closes this must show the two tests RUN and can FAIL** — un-skipping them and observing
green proves nothing on its own, which is the same class the parent audit was about.

### 🟡 FUP-PGTAP-WORKER-DEADLOCK — `npm run test:db` intermittently deadlocks a `pg_prove` worker (owner: backend)

Filed 2026-08-14 (lead), also carried out of prose. Non-deterministic; observed during DM5 gate runs.
Impact is **assurance, not correctness**: a hung/aborted worker can drop a suite from the run, and a
suite that never ran is not a suite that passed — the same shape as
[[gate-summary-can-hide-unrun-tests]]. **Mitigation until diagnosed:** always read the file/assertion
totals (`192 files / 6284`) against the previous known-good run, never a trailing summary line, and
never pipe the run through `tail`. Diagnosis wants the lock graph at hang time
(`pg_stat_activity` + `pg_locks`), which nobody has captured yet.

⭐ **First concrete lock-surface lead, from DM5·S3 QA r2 (2026-08-14):** `342`'s **`S3n` takes ACCESS
EXCLUSIVE on `file_objects`** — a table that many suites touch. That is a *candidate* for the contended
object, not a diagnosis: the hang was never reproduced under observation, and naming a plausible lock is
how a real cause gets closed early. Whoever picks this up should start by checking whether the observed
hangs correlate with `342` being in flight at all.

### ⬛ FUP-DM5-342-PLAN-COMMENT — ✅ **RESOLVED 2026-08-17**; the comment's own arithmetic already summed to 59 (owner: backend)

> **✅ RESOLVED.** The header now cites the plan (`plan(59) = …`) instead of carrying a
> free-standing total.
>
> ⭐ **The detail the item missed:** the itemised breakdown under that heading **already
> summed to 59**. Only the leading total was stale — items were appended over three QA
> rounds without re-adding. So the comment did not merely disagree with the code, it
> disagreed with **itself**, and a reader who trusted the total would have concluded 15
> assertions had gone missing. Textbook
> [[a-comment-is-an-assertion-that-goes-stale-silently]].

Filed 2026-08-14 from DM5·S3 QA **r2** (INFO). `supabase/tests/342_dm5_s3_printed_renditions.sql:21-27`
documents a plan of 44; the executable `plan(59)` is correct and the suite passes. **Cosmetic today** —
filed anyway because it is a pure instance of [[a-comment-is-an-assertion-that-goes-stale-silently]], the
class that has been hit repeatedly in this repo and **shipped a live bug once**. The header is the first
thing a reader trusts when deciding whether assertions went missing, which is precisely the judgement
`pg_prove`'s plan line exists to support. **Fix:** make the comment cite the plan or drop the number.
⚠ Lead did **not** fix it inline — `342` is `backend`'s file and file ownership is binding (CLAUDE.md §4).

### 🔴 FUP-PGTAP-VACUOUS — `lint:vacuous` scans TS spec files ONLY; ~6000+ pgTAP assertions are entirely unscanned, and a live specimen was found (owner: lead + backend; a program-level audit, NOT a phase side quest)

Filed 2026-08-14 during DM4. **Found by `backend` while re-reading a suite it had to edit, and
lead-confirmed.**

**The live specimen** — `supabase/tests/197_phi_disposal_closure.sql` assertion **4.1**, inside a
**PHI-boundary suite**:

```sql
(select (j -> 'shared_items' -> 0 ->> 'frozen_storage_path') from meta_read) is null
```

If `shared_items` is an **empty array**, `-> 0` yields NULL, `->> 'field'` yields NULL, and
`is null` is **true**. The assertion passes **having asserted nothing** — and it has been doing so.
Nothing guards the array's non-emptiness. The DM4 successor adds a positive control
(`shared_items -> 0 ->> 'id' IS NOT NULL` in the same read) so the deny-half provably denies a row
that **exists**.

**Why this is 🔴 and program-level.** `npm run lint`'s fifth gate (`check-vacuous-assertions.mjs`)
exists precisely because "a test that can go GREEN having asserted nothing" already shipped here —
but its scope is **first-party TS** (`src/`, `e2e/`, `*.test.*`): **180 spec files scanned, 0
findings**. The pgTAP suites are **SQL and completely outside it**, against **~6152 assertions** as
of DM3. The JSON-path-on-a-possibly-empty-array shape is a *natural* way to write these, so one
confirmed instance is weak evidence for one instance.

⚠ **Scope discipline, deliberately recorded:** DM4 fixes **only** the instance in its own diff.
A repo-wide sweep is its own audit with its own ways of being wrong — and this project has the
scar: [[a-detector-that-finds-a-lot-needs-proving-too]] (a sweep reported 89; seven of its own bugs
were 56 of them). Any detector built here must be **dry-run against a hand-classified control** and
**proven able to fail** before its count is believed
([[detector-that-finds-nothing-must-be-proven-able-to-find-something]]).

### 🟠 FUP-DM5-STORAGE-ORPHANS — a **LOCAL** DB reset wipes `storage.objects` but NOT the bytes; ⚠ **the REMOTE half was a stale inference and is now demoted to residual** (owner: lead + backend; blocks DM5 step 3 **locally**)

> ## ⭐ MECHANISM MEASURED 2026-08-18 — the guard exists, and TRUNCATE walks past it
>
> `storage.objects` carries a platform trigger **`storage.protect_delete`** (statement-level, on
> DELETE): a bare `DELETE` raises **`42501`** — *"Direct deletion from storage tables is not allowed.
> Use the Storage API instead"*, hint *"This prevents accidental data loss from orphaned objects."*
> So the casual path into this item's failure mode **is already blocked**, by Supabase, by default.
>
> ⛔ **`TRUNCATE` is not.** Measured on the local stack: upload an object → `TRUNCATE storage.objects`
> succeeds, rows gone, **byte still on disk** (`/mnt/stub/stub/<bucket>/<name>/<version>`). TRUNCATE
> fires no DELETE trigger, so no statement-level guard can see it. That is the shape of every
> orphaning event this item is about: resets, truncates, schema drop/recreate — the **bulk and
> structural** operations, never a stray per-row delete.
>
> ⇒ Restates the item's scope precisely: *routine per-object work is protected; bulk operations are
> not, and no trigger can protect them.* The grant half is closed under FUP-PCITV-1 item 3
> (`20260928000900`); the platform tables keep the grant and that is accepted in writing there.
> ⚠ Also note `/var/lib/storage` is **not** the storage root (`FILE_STORAGE_BACKEND_PATH=/mnt`) — a
> `find` against the wrong root returns a false *"the byte is gone"*.

> ⛔ **CROSS-LINK, added by lead ruling 2026-08-17 (DM5·S5): this item's Cloud half is now
> [FUP-DM5-CLOUD-ORPHAN-SURFACE](#-fup-dm5-cloud-orphan-surface), a separate item.** The S3-endpoint
> question was a **parenthetical inside this body**, under a headline reading *"closes empty by
> measurement"* — and *an item that can change a verdict does not live inside the parentheses of the
> verdict it would change*. **Closing THIS item does NOT close that one**, and this body's
> "closes empty by measurement" conclusion is about the **retirement-scope, local** question only.

> ### 📌 S4 OUTCOME 2026-08-16 — the local half is now DEMONSTRATED, not predicted, and it is **not closed**
>
> S4 ran. Measured before touching anything: **`storage.objects` = 0 rows across all 12 buckets** against
> **866 files / 9.9 MB / 235 PHI-tier** on the volume — **221 / 6.93 MB / 15 PHI** in the 8 retirement
> buckets, reproducing S0's figure exactly. **The manifest-first delete was therefore a NO-OP:** every one
> of those bytes is an orphan with no metadata row, so the Storage API cannot address it, and
> `capture` returned the `DEGENERATE BASELINE` verdict by design.
>
> - ✅ **What S4 did close:** the metadata/schema half — 8 bucket rows + the last 4 policies retired by
>   migration `20260927000400`, pinned by `325` t6/t7 (+t8 control) so it survives `db reset`.
> - ⛔⛔ **CORRECTED 2026-08-17 by QA (S4 review B1) — THE 221 FILES NO LONGER EXIST, AND THEY DID NOT GO
>   THROUGH THE GATE.** The text this bullet used to carry ("they are still on the volume … PO ruled to
>   leave them") was **false when it was written**. Measured independently, twice:
>   `docker volume inspect supabase_storage_…` → `CreatedAt 2026-08-17T01:06:02Z` (the volume object was
>   **destroyed and recreated**), and `storage-manifest.mjs walk` → *"(no directory on the volume)"* for
>   **all eight** retirement buckets, `TOTAL files=78`, all in survivor buckets; `capture` →
>   `orphan_keys=0`, verdict **`CAPTURE CLEAN`** — against a committed manifest taken 10 minutes earlier
>   on the same stack recording **221 files / 6,927,804 bytes / 15 PHI-tier**.
>
>   **Cause — the lead, and it is worth naming precisely.** Timeline (local = UTC−3): manifest
>   `00:55:57Z` (221 present) → E2E batch 4's reset 502'd `~01:01Z`, lead killed the run and a
>   **mid-flight `supabase db reset`** → `supabase start` hit a container-name conflict → lead ran
>   **`supabase stop` + `supabase start`** → **volume recreated `01:06:02Z`**. `supabase stop` reported
>   `"backup":true` and removed the storage volume regardless. ⚠ Which step of that recovery did it is
>   **not established and no mechanism is invented here** — but it happened inside the lead's recovery
>   sequence and nothing else in the window fits. (E2E run 2 started `01:09Z`, *after*.)
>
>   ⛔ **This was a disposal WITHOUT EVIDENCE — 221 files, 15 PHI-tier — inside the very slice that
>   ratified D9.** No manifest at disposal time, no `deleted == manifest` comparison, no audit row. That
>   is precisely the event D9 exists to prevent. It does not touch S4's schema work, and the bytes were
>   regenerable local dev artifacts — but *"the byte half was a no-op"* is only half true: **the bytes
>   went; they just didn't go through the gate.**
>
>   ⛔ **The PO ruling of 2026-08-17 ("leave them; keep this open") was MOOT when it was given** — made
>   **3h11m after** its subject ceased to exist, because the lead re-used a 00:55Z measurement instead of
>   re-measuring at decision time. Outcome unchanged (nothing to delete either way), but the PO was asked
>   to rule on a state that no longer existed. ⭐ **A decision brief must carry a measurement taken at
>   decision time, not the one that motivated the question.**
>
> #### ✅ RE-PUT AND RULED 2026-08-17 — this time on a measurement taken AT decision time
>
> B1 required the question be re-put to the PO. It was, carrying a **fresh** measurement rather than the
> one that motivated it — the discipline this entry's own ⭐ demands, applied to itself. Measured on a
> freshly-rebooted stack immediately after a clean `db reset`, minutes before asking:
>
> | scope | files | bytes |
> | --- | --- | --- |
> | the **8 retired** buckets | **0** | 0 |
> | the **4 surviving** buckets (`documents-standard`/`-phi`, `form-assets`, `meeting-audio`) | **166** *(at 03:45Z)* | 2,970,290 |
>
> ⛔ **The survivor row is a TIMESTAMPED OBSERVATION, not a count — and it went stale inside the same
> session** (QA r2 INFO-5). After the `e2e:prod` gate it read **245 files / 4,394,074 B** (QA, ~04:55Z)
> — ⛔ **and the "moved AGAIN 30 min later" claim that stood here was WRONG (QA r3 MINOR-11).** I read
> `du -sb /mnt` = 4,402,266 against QA's `du -sb /mnt/stub/stub` = 4,394,074 and called it drift. Both
> re-run at the same instant reproduce **both** numbers: the 8,192 B is two 4 KiB wrapper-directory
> inodes, i.e. **my measurement scope, not elapsed change.** ⭐ *Two measurements at different grains
> compared as a time series* — [[a-predicate-quoted-at-the-wrong-grain]]. **State the method beside any
> byte figure**; note `du -sb` (allocated, 4,394,074) and `stat -c %s` (apparent, 2,456,666) differ by
> 1.94 MB on this same volume. The conclusion below is unaffected: it rests on the **166 → 245 drift
> across the gate**, measured at both ends —
> `documents-phi` **68** · `documents-standard` **156** · `form-assets` **12** · `meeting-audio` **9**,
> against **0** `storage.objects` rows, so all 245 are orphans. ⭐ **This is why the PO ratified a CLASS
> and not a number:** every gate run writes bytes and every reset orphans them, so any survivor count is
> obsolete before it is committed. **Do not "refresh" this figure — quote the mechanism.** The retired
> buckets' **0** is the durable half: nothing writes to a bucket that does not exist.
>
> **PO ruling: the local volume is RATIFIED as non-durable, disposable test residue.** No cleanup step,
> no gate, no local manifest discipline. The two rejected options are recorded because they were live:
> clearing the volume as part of `db reset` (declined — it changes shared tooling every session depends
> on, and destroys evidence a future incident may need), and holding the 166 to full manifest discipline
> (declined — right discipline, wrong scope).
>
> ⭐ **What the fresh measurement changed about the question.** The 166 are **not** retirement residue.
> They are ordinary E2E/print artifacts that **the reset orphaned as it ran** — so local orphan
> accumulation is not an S4 artifact at all, it is a **standing byproduct of `db reset` on any stack that
> has written bytes**. That is D17's correcting insight, no longer an argument but a measurement. Had the
> question been re-put on the old 221-file framing, the PO would have ruled a second time on a state that
> no longer existed — the exact failure B1 was filed for.
>
> **What this closes:** the *retirement-scope* orphan question — and it closes **EMPTY BY MEASUREMENT**,
> zero bytes in all eight retired buckets. Not by disposal, not by argument, and not by the destruction
> of 2026-08-17 `01:06:02Z`, which remains an unevidenced disposal and is charged to
> **FUP-DM5-STACK-CYCLE-DESTROYS-BYTES**, not discharged here.
>
> - **This item stays OPEN on its Cloud half ONLY**, and its centre of gravity has moved: the remaining
>   question was never the local bytes, it is that **on Cloud there may be no customer-accessible tool
>   that can SEE an orphan** (the S3-protocol endpoint is still UNPROBED). See also
>   **FUP-DM5-STACK-CYCLE-DESTROYS-BYTES**.
> - ⚠ **`delete --execute` has still never run against a populated bucket.** Its correctness rests on S0's
>   8/8 self-test, not on an S4 execution — so **the production sequence remains unrehearsed end-to-end**,
>   even though production is where it is actually meaningful (it has metadata rows: 45 objects at the
>   2026-08-11 census). ✅ **OWNED 2026-08-17 — the PO directed the rehearsal into S5 as `S5.R`**
>   ([plan](../plans/dm5-wave-d-retirement-plan.md) § S5.R): the **with-metadata** path, on a
>   purpose-made disposable bucket (the eight retired ones now return `BUCKET_ABSENT` and hold 0 bytes),
>   with all four acceptance items proven able to FAIL. ⚠ **Naming an owner is not a rehearsal** — this
>   bullet stands until S5.R runs, and a green *local* rehearsal still does not license the Cloud
>   sequence, which is what keeps this follow-up open.
>
> ### ⛔ AMENDMENT 2026-08-14 — the remote half's premise was WRONG. Severity 🔴 → 🟠.
>
> This filing reasoned from the local measurement to remote by *"the same mechanism class."* **The
> mechanisms are different**, and the remote one does not exist at the CLI version this repo pins.
>
> - **Local — still true, and structural:** the database is recreated wholesale while the **Docker
>   volume survives**. Measured: `storage.objects` **0 rows vs 699 objects / 7.02 MB / 198 PHI-tier**.
>   Everything below about the local mechanism stands, and it is what blocks S4's *"prove empty via the
>   API, then delete the bucket"*.
> - **Remote — gone:** the orphaning came from **one line** in the CLI's
>   `pkg/migration/queries/drop.sql` truncate loop
>   (`or c.relnamespace::regnamespace::name = 'storage' and c.relname != 'migrations'`), added by
>   [cli#3083](https://github.com/supabase/cli/pull/3083) 2025-01-30 and **reverted by
>   [cli#3359](https://github.com/supabase/cli/pull/3359) 2025-03-27** — *"causing too much confusion
>   and accidental deletes to be worthwhile."*
>
> **Verified at OUR version against the artifact, not the PR title** — grepping the embedded SQL in
> `node_modules/@supabase/cli-windows-x64/bin/supabase-go.exe` (**v2.105.0**), lead-reproduced:
> `name = 'storage'` → **0 hits**; `name = 'auth'` → **3 hits**. The `auth` sibling is the adjacent
> line of the same loop, untouched by the revert — it is the **positive control** proving the SQL is
> greppable here and the pattern shape right, so 0 means *absent*, not *unfindable*.
>
> **Consequences:** a `db:reset:linked` would **not** orphan the remote's objects — which also reverses
> a live warning feeding **FUP-DM4-PRODROW**'s deploy decision. **The Cloud orphan-*detector* question
> drops from S4 blocker to residual**, since a detector matters only for orphans something can create.
> ⚠ **The manifest-then-reset ordering still STANDS** on the local rationale alone (ADR 0120 D17's
> second correction) — this is not licence to reset first.
>
> ⭐ **A correctness property can live in a DEPENDENCY's source and regress on `npm update`.** This one
> went true → false → true across CLI versions, and `package.json` pins **`^2.105.0`** — a caret range,
> so a routine update can silently re-arm it. Record it as *"true at v2.105.0 because that line is
> absent,"* never as *"Supabase behaves this way,"* and **re-run the grep-with-control on any CLI bump**.
> ⚠ Bounds one mechanism in the shipped binary: not a runtime observation, and not proof that no other
> code path clears storage.

Filed 2026-08-14 during DM4 planning. Found by `backend`, **independently reproduced by the lead**
on the local stack — empirical, not inferred.

**The measurement.** `storage.objects` held **0 rows** while the storage backend
(`STORAGE_BACKEND=file`, `/mnt`) held **663 files / 16.5 MB**, of which **162 are PHI-tier**
(`printed-documents/phi/*.pdf`, E2E residue). `supabase db reset --local` wipes the metadata and
**does not touch the bytes**.

**Why this is 🔴 and not a curiosity.** The Storage API **lists from `storage.objects`**. So
orphaned bytes are invisible **to the API as well as to SQL** — there is no supported read path
that sees them. DM5 step 3's method is: *"for each bucket, prove zero DB references + zero product
callers + zero policies, then empty + delete the bucket (Storage API only — never
`storage.objects` DML)."* Run after any reset, that procedure would **prove emptiness against a
truncated table, delete nothing, and report success** while PHI-tier bytes persist backend-side.
⭐ *An emptiness proof derived from a table that was just truncated is not an emptiness proof* —
the same shape as [[a-detector-that-finds-nothing-must-be-proven-able-to-find-something]].

**What DM5 must do instead:** enumerate at the **backend layer**, not the metadata layer — locally
the volume; remotely whatever the platform exposes for the S3 store — and reconcile that
enumeration against `storage.objects` in **both** directions before declaring a bucket empty.

**⚠ Remote behaviour is an INFERENCE, explicitly not verified.** Nobody has queried or inspected
the linked project. The remote reset is also a database-level reset and platform S3 bytes surviving
it is the same mechanism class, but that **must be verified at deploy time or via vendor docs, never
assumed from the local finding**. ⚠ Note the remote has never received DM1+, so its bytes include
the 2026-08-11 production census (45 objects) — **a remote reset would orphan all of them**, which
is a live input to [[FUP-DM4-PRODROW]]'s deploy decision, not a DM5-only concern.

---

**🟡 UPDATE 2026-08-14 — the METHOD half is RULED (ADR [0120](../decisions/0120-dm5-wave-d-retirement-decisions.md) D9); the REMOTE half stays open.**

Re-measured at the DM5 open on a HEAD stack: **`storage.objects` = 0 rows** against **699 objects /
7,023,687 bytes**, **198 PHI-tier** (`attachments-phi` 6, `documents-phi` 183,
`printed-documents/phi` 9); `list` returns `[]` for **all 12** buckets. Figures differ from the
663/16.5 MB/162 above because that was a different stack state — **both are real; neither
supersedes the other**, and the drift is itself the point.

**Ruled:** the plan's Storage-API emptiness method is **WITHDRAWN**, replaced by **manifest-first
deletion** — capture the authoritative key list *before* any destructive step, delete by key, assert
`deleted_count == manifest_count` per bucket. This converts an unfalsifiable negative into a
positive count comparison: a truncated table now yields a **visibly zero-length manifest** instead
of a silent pass. Backend-agnostic, so it transfers to Cloud; the local volume walk is the
**proof harness**, not the gate (it depends on `STORAGE_BACKEND=file`).

**⚠ Calibration the original filing lacks — it lowers the severity but not the priority.** The
orphans are **not servable**: a service-role `GET` on a known orphan key returns **400** and `sign`
returns **404 not_found**, because every read path resolves metadata first. So this is a
**data-at-rest / disposal-assertion** problem — Rule 12, LGPD erasure, the F-02 class — **not a live
exposure**. It is also *why* API-based enumeration fails by construction, so the calibration and the
method ruling are the same finding seen from two sides.

**Still open (do NOT read D9 as closing this):** on Cloud there may be **no customer-accessible tool
that can see an orphan** — dashboard, CLI and supabase-js all list from `storage.objects`, and the
S3 endpoint is **UNVERIFIED** (the local probe needs SigV4; the remote is off-limits under the
standing no-push directive). Also `scripts/document-reconciliation.mjs:58` covers only **2 of 12**
buckets and lists *from* `storage.objects`, so it cannot see this class either — widened in DM5 S0.

---

### 🔴 FUP-AUTHZ-HARNESS-TRANSACTIONAL — the door-audit harness neutralizes OUTSIDE a transaction, so process death leaves an authz gate OPEN (owner: lead + backend; filed 2026-08-14, DM5 S2, after it happened)

**It happened.** During DM5 S2, `app.can_write_document` — the gate for **every** document write across all
eight home types — sat live with the body `begin return true; end` on the shared stack. **An
unconditional allow.** Found by `tester`, which halted all E2E rather than produce green results against
it; independently confirmed by `backend-assurance`; and traced to a **lead instruction** that said
*"neutralize and confirm your block goes red"* **without saying transactionally**, on a stack two other
teammates were live on.

**The structural defect, which outlives the incident.** `p0-authz-door-audit.sh` restores via an **`EXIT`
trap** plus a re-fetch/byte-compare. That is good design and it is **not enough**: the trap **does not fire
when a subagent's turn ends and the process is killed** — which is the documented failure mode for the
heavy sweep. Because the harness neutralizes **outside** a transaction, **process death = gate left open**,
silently, with no marker in the catalog.

> ## ⛔ AMENDED 2026-08-17 — **THE FILED FIX CANNOT BE BUILT, AND BUILDING IT WOULD BE WORSE THAN THE BUG.**
> **Partially resolved by a different mechanism; the item stays OPEN at 🟠 for the residual.**
>
> The fix below is correct about Postgres and wrong about *this harness*. A rolled-back transaction
> makes DDL invisible **outside the session that issued it** — and `p0-authz-door-audit.sh`'s probe is
> not that session. `run_suite` shells out to **`supabase test db`, a separate process** with its own
> connections; the script's own header says it "mutate[s] the LIVE, COMMITTED catalog". Held in an
> uncommitted txn, every case would run against the **original** gate and classify **COVERED** —
> a sweep that is 100 % green and 100 % **vacuous**. ⭐ *The commit-then-restore design is REQUIRED by
> the probe's process boundary; it was never an oversight.*
>
> **What shipped instead — make the failure LOUD rather than impossible.** Process death can still
> leave a gate open; it can no longer do so unnoticed.
> - **Preflight in `p0-authz-door-audit.sh` (§7.16)** — refuses to start a sweep on a contaminated
>   stack, `exit 2`, naming the function. This is exactly the manual check that caught the original
>   incident. **Proven able to fire** against a planted unreferenced degenerate function.
> - **Preflight before EVERY arm of `p0-authz-invariant.sh`** — so the standing §6 gate step sees it.
>   Deliberately *not* a sixth arm: that would need CLAUDE.md §6 taught a new name, and a left-open
>   gate should fail **all** the arms it invalidates.
>
> ### ⚠⚠ The detector recorded below was blind to TWO of the THREE neutralization forms
> The regex in this item — `^\s*begin\s+return\s+(true|false)\s*;\s*end` — is **plpgsql-only**. The
> harness also emits **`select true`** (`language sql`) and **`begin return; end`** (the `assert_noop`
> void raise-guard). Measured: `app` + `public` hold **182 SECURITY DEFINER `language sql`** functions,
> and `'select true' ~ <that regex>` is **false**. So the query that bounded the original blast radius
> to *"exactly one hit"* — a **correct** result for that incident, which was plpgsql — **could not have
> seen a SQL-language gate at all.** ⭐ *An enumeration bounded by a SYNTAX rather than the PROPERTY,
> living inside the safety net.* All three forms are now covered, and the detector was proven able to
> find 2 constructed instances before being trusted at 0.
>
> **Residual, why this stays open:** nothing yet *restores* automatically after process death — the
> guards detect, they do not repair. A committed marker row written in the same transaction as the
> neutralization (so the two can never disagree) would let the next run self-heal; not built.

**The fix (not built): make neutralize → probe → restore a single rolled-back transaction.** Postgres DDL
is transactional, so a `CREATE OR REPLACE FUNCTION` inside a rolled-back `begin` leaves **no residue** —
`backend-assurance` proved this rather than assuming it: md5 of `pg_get_functiondef` before, gate replaced
in-txn, probe run, `rollback`, re-read → **byte-identical, same md5**. That makes the failure mode
**structurally impossible** instead of trap-dependent.

⚠ **Two forensic properties worth knowing before the next incident:**
- **`pg_proc` carries no mtime**, so a neutralization **cannot be dated from the catalog**. The only lower
  bound here was a `pg_get_functiondef` capture the sweep happened to leave in a scratchpad. **Any result
  produced in the unknown window must be RE-RUN, not re-read.**
- **The detector that found it is worth keeping**: sweep `app` + `public` for any body matching
  `^\s*begin\s+return\s+(true|false)\s*;\s*end` — it is the *property* (a degenerate always-true/false
  door) rather than a list of names. It returned **exactly one** hit, which is also how the blast radius
  was bounded to a single function. ⭐ **Consider making it a standing gate step** — it is one query, and
  a left-open gate is otherwise invisible to every arm, since all four arms test doors that *exist*.

⛔ **Do not read this as "the harness is unsafe to run."** It is safe when its process completes; the gap
is process death mid-run, which subagent turn boundaries make routine. Related:
[[mutation-harness-must-prove-its-rollback-first]] — the same class, previously recorded, where a sweep
left a gate open and `| tail` masked exit 2 as 0.

### ⬛ FUP-AUTHZ-ALLOWLIST-ROT — ✅ **RESOLVED 2026-08-17.** A resolve-in-`pg_proc` check now runs inside `ARM=floor`; it found **SIX** stale entries where this item named one (owner: lead + backend; filed 2026-08-14, DM5 S2)

> **✅ RESOLVED 2026-08-17.** `ARM=floor` now anti-joins every allowlist signature against
> `pg_proc` and fails `RC=1` on any that does not resolve. **Proven red-first**: the first run
> exited **1** listing six entries; after the fix, `EXIT=0 · INVARIANT HOLDS` with the offender
> count unchanged at **74**, all still allowlisted.
>
> ⭐ **This item named one specimen; the property-bounded check found six** — the phase's dominant
> class ([[enumeration-boundary-is-a-syntax-not-a-property]]) recurring inside the follow-up list
> itself. The six split cleanly, and the split is the interesting part:
> - **ABSENT** (door dropped, entry is pure rot): `add_referral_reply_attachment` ·
>   `get_referral_attachment_path` · `get_referral_snapshot_document_path`.
> - **RE-SIGNATURED** (door LIVE under new params, and **called**): `decline_referral` (gained
>   `p_decline_reason_code`) · `set_template_collects_patient` (`p_template_id` →
>   `p_template_version_id`) · `update_controlled_document` (gained three params).
>
> **All six were removed, none replaced.** The three live doors are not in the offender set under
> their real signatures, so they need no exemption — and per the `set_primary_subject` precedent
> already in the file, *an allowlist entry for a door that IS called suppresses the floor arm's only
> question about it.* If one later stops being called, the arm **should** fire and a human should
> justify it then. ⚠ Note the second-order rot this exposes: a re-signatured entry keeps its original
> **justification comment**, which now describes a door shape that no longer exists.

`supabase/tests/mutation/authz-neverclled-door-allowlist.txt` keys entries on the **full identity
signature**, and `p0-authz-invariant.sh:229` consumes it with
`comm -23 <(offenders) <(allow_body …)` — i.e. it **only ever subtracts**. Nothing checks that a
listed signature resolves to a function that exists.

**Live specimen:** line 41 names `add_referral_reply_attachment(...)`, which **DM4 dropped**
(`20260926000400`). Verified absent from `pg_proc` at HEAD.

⚠ **Calibrated, and this corrects the lead's first framing.** A stale entry is **inert, not
dangerous**: it can never match a live offender, so it masks nothing and fails nothing. The failure
mode is **legibility, not enforcement** — a human reading the file sees a door "accounted for" that
does not exist, and the entry's justification comment outlives the thing it justified.

⭐ **The signature-keying is otherwise a FEATURE, and DM5 S2 demonstrates why.** When `…000120`
drops `p_storage_path` from `add_capa_action_evidence`, line 37 stops matching the live door, which
then appears in `unlisted` ⇒ **FLOOR VIOLATED, RC=1** — **loud**, exactly as designed. So the
remedy for line 37 is to update it in the migration's own commit (planned), and the follow-up here
is only about the rot the mechanism cannot see.

**Proposed fix (not built):** a cheap assertion that every allowlist signature resolves in `pg_proc`,
run as part of `ARM=floor` — turning silent rot into the same loud failure the live half already
gets. ⚠ Prove it able to fail before trusting it: line 41 is a ready-made positive control.

### ⬛ FUP-DM5-GRANTS — ✅ **CLOSED 2026-08-17.** The RPCs are now the only writers — and closing it nearly INTRODUCED a stale-COVERED policy (owner: backend; filed 2026-08-14 by ADR 0120)

**Fix:** migration `20260928000200_evidence_tables_revoke_direct_write.sql` revokes
`insert, update, delete, truncate, references, trigger` on both tables from `authenticated`.
**SELECT is deliberately kept** — six measured call sites read these tables directly under RLS
(`queries/rca.ts:553`, `queries/capa.ts:505`, `safety/capa-actions.ts:501,558`,
`safety/rca-actions.ts:592,694`), all `.select()`, zero direct writes. The migration is
self-verifying (asserts the write privileges are gone, that SELECT survived, and that the owner
can still write).

**Safe because the authorization moved WITH the path, verified from the live catalog:** all four
doors are `prosecdef = t` owned by `postgres`, and each gates on the *same* predicate the RLS policy
used — `add_rca_evidence` → `app.assert_rca_writable` → `app.can_write_rca` (HC048);
`add_capa_action_evidence` → `app.assert_capa_writable` → `app.can_write_capa` (42501).
⚠ **A first pass concluded there was NO gate**, because it grepped for `can_write_rca|can_write_capa`
and the call is named `assert_rca_writable` — [[enumeration-boundary-is-a-syntax-not-a-property]]
inside the verification of a security change. **The body was read; the regex was not believed.**

**Evidence:** pgTAP `341` block **H**, plan 53→57 — H1/H2 `table_privs_are(...) = {SELECT}` exactly
(fails in BOTH directions: a re-grant reds it, so does an over-revoke that strips SELECT), H3/H4
behavioural twins proving the FUP's own bypass (`POST /rest/v1/rca_evidence`) now gets 42501.
`table_privs_are` was **red-proven** by re-granting inside a throwaway suite.

### ⭐⭐ The finding: this fix would have made TWO P0 policies silently BLIND

The revoke closes the direct-DML path — which is the **subject under test** of two keystones in
`252_authz_p0_isolation.sql`, an ADR-0078 P0 suite whose contract
(`p0b-isolation-mutation-audit.sh:146,154`) is *"opening the policy must redden the DENY"*. With the
grant gone the reader-non-writer's INSERT fails at the **grant** (42501) before RLS is consulted, so:

| | before | after the naive revoke |
|---|---|---|
| `*_write POS` (authorized writer inserts) | passes | **FAILS** — loud, catchable |
| `*_write DENY` (reader-non-writer refused) | passes *because RLS refused* | **passes because the GRANT refused** — green, and testing nothing |

The DENY half is the dangerous one: `rca_evidence_write` and `capa_action_evidence_write` would have
gone **BLIND** while `docs/reviews/authz-door-audit-findings.md:324,436` still recorded them
**COVERED**. That is *STALE-COVERED arriving as a status change rather than a body change* — the exact
defect **FUP-DM5-330-WRITE-BLIND** is open about. Found by asking which OTHER suites do direct DML on
these tables, not by running the suite and reacting; `341`'s own F8 failed first and was the prompt.

**Resolution — keep both properties.** `252` restores the grant **inside its own rolled-back
transaction**, solely to reach the policy under test; production keeps the revoke, pinned by `341`
H1–H4. **Mutation-proven, not asserted:** re-running `252` with both policies opened to
`using(true) with check(true)` fails **tests 1 and 14 — exactly those two and nothing else**. Verified
afterwards that neither policy was left open and grants are SELECT-only (the shared-stack hazard from
[[mutation-harness-must-prove-its-rollback-first]]).

⭐ **Why the RLS policies are KEPT rather than retired as unreachable.** They are now the second lock,
and the one that matters: `ALTER DEFAULT PRIVILEGES FOR supabase_admin IN SCHEMA public` still grants
`arwdDxtm` to `authenticated` on **every new table**, and `20260620000000_baseline.sql:22989,23088`
is a pg_dump that already restored these grants once. A re-dump silently re-arms direct DML — and if
RLS had been dropped as "unreachable", the tables would then be defended by nothing. **A protection
that a routine re-dump disarms, while its keystone reads COVERED, is worse than the one it replaced.**

⚠ **Generalises past this item:** that default-privilege posture means **any new table in `public`
starts with full `authenticated` grants**. The narrow idiom this project uses elsewhere
(`grant select on public.X to authenticated`) only holds where someone remembered to write it.

<details><summary>Original filing (2026-08-14) — retained</summary>


Both tables carry **table-wide `arwdDxtm` grants to `authenticated`**, so a client can
`POST /rest/v1/rca_evidence` directly and never traverse `add_rca_evidence`.

**⚠ Calibrated — this is hardening, NOT an open door.** RLS *is* enabled on both, with genuinely
**distinct** read and write predicates — `app.can_read_event(app.event_of_rca(rca_id), auth.uid())`
for SELECT versus `app.can_write_rca(rca_id, auth.uid())` for the `FOR ALL` write policy — so this is
a real second lock, not [[a-door-can-have-two-locks]]'s same-predicate-twice trap. Verified against
`pg_class.relacl` and `pg_policies` directly, at the DM5 open. What direct DML bypasses is the
**RPC's flag gate and its fail-closed arms**, not row authorization.

**Binding on DM5 S2:** do not assume the RPC is the only writer when placing the `documents_wave_d`
assert (ADR 0120 D10). A flag gate that lives only in the RPC body is bypassable by exactly this
path — the DM3 QA MAJOR-1 shape, where the gate sat on the last step of a corridor rather than the
corridor. Note the parked CHECK `rca_evidence_cited_document_parked` **does** hold against direct
DML, being a table constraint; that is the third of the three locks and the reason the citation seam
is safe today.
</details>

### ⬛ FUP-DM4-RECUSAL — ✅ **RESOLVED 2026-08-17 (local catalog); ⚠ NOT YET ON THE REMOTE** — a RECUSED coordinator could freeze a case's PHI documents into a referral, around the exclusion perimeter (owner: lead + PO + backend; **deadline was the `documents_wave_c` flag-on date**)

> ### ✅ RESOLUTION 2026-08-17 — `32054942`, migration `20260928000100`, ADR [0122](../decisions/0122-recusal-case-read-arm-at-the-referral-freeze-door.md)
>
> ⛔ **This header read `🟠` open until 2026-08-17 — a full day after the fix landed, in the file that
> is the authority for what is open.** Nothing in the entry below had been touched. Recording it here
> rather than silently rewriting: a closed security obligation that still reads OPEN costs the next
> session a re-investigation, and the same rot in the opposite direction ships a hole.
> → [[a-records-claim-about-an-external-system-goes-stale-silently]].
>
> **The PO overturned the 2026-08-14 Phase-19 deferral** (ADR 0122 **D1**): the deadline was always
> the `documents_wave_c` flag-on date, and — as QA's standing caveat below demanded — **a plane that
> only WIDENS cannot close an under-inclusive gate.** So it was closed by a **narrowing** arm, which
> is what the caveat required.
>
> **What was built.** A `app.can_read_case(v_referral.source_case_id, auth.uid())` arm raising
> `HC0DM`, placed **ABOVE the `p_kind` dispatch** — deliberately not inside the `document` arm where
> the item was filed, because the **narrative** arm freezes `case_narratives.body_md` with the
> identical omission and a guard in the reported arm would have left its sibling open
> (that is `FUP-DM5-SIBLING-GUARD-DIFF`, applied rather than merely filed).
>
> **Evidence, red-first against the pre-migration catalog:** `340` R1–R4 green, **R5/R6 RED with
> `caught: HC077 / wanted: HC0DM`** — and that `HC077` *is* the finding, the recused coordinator
> reaching past every gate into the arm's own content lookup. Plan 76 → 82, all green after.
>
> **✅ Lead-verified from the LIVE CATALOG 2026-08-17, not from the commit message**
> (`pg_get_functiondef`, per the CLAUDE.md §graphify SQL exception): the guard is at body line 24,
> the `p_kind` dispatch at line 29 — the ordering the fix depends on is real, and
> `public.add_referral_shared_item` is `prosecdef=true`.
>
> ⚠⚠ **THE ONE THING THIS DOES NOT YET COVER — and it is the half the deadline was about.**
> `20260928000100` is **LOCAL-ONLY**. `supabase migration list --linked` (measured 2026-08-17) shows
> the remote current through **`20260927000360`**, so **the recused-coordinator hole is still OPEN on
> the remote.** It closes there on `db push`, which is itself gated behind S4's `20260927000400`.
> **Do not read this ⬛ as "safe in production."** The deadline condition is unchanged: this must be
> on the remote before `documents_wave_c` is ever enabled there.

<details>
<summary>Original filing (2026-08-14) — kept in full; the gap, the PO's first ruling, and QA's binding caveat</summary>

Filed 2026-08-14 at DM4 QA r1 (**MAJOR-3**). **Found by `qa`, demonstrated LIVE** in a rolled-back
transaction — not inferred from reading code.

**The gap.** `add_referral_shared_item` checks referral-**source** authority
(`can_manage_referral_source`) but **never `can_read_case` or `can_read_document`**. So for one
user and one case, simultaneously:

```
can_read_case(caseA, u)                     = false      ← recused / excluded
can_manage_referral_source(ref on caseA, u) = true
can_read_referral_phi(ref on caseA, u)      = true        ← reaches the PHI bytes
```

A coordinator **recused** under the ADR-0072 / ETH·E1 exclusion perimeter can therefore freeze that
case's PHI documents into a referral and read them through the referral corridor. ⚠ **Two
authorization planes that were each individually correct**: ADR 0119 **D4** reasoned about exactly
this seam for the D15 **clearance** plane and never considered the **case-capability** plane.
Same shape as [[exclusion-only-as-strong-as-weakest-mutator]] — the excluded party reaches the
content by a route the exclusion never modelled.

**PO ruling 2026-08-14: DEFER to the Phase 19 access plane** (ADR 0114 Amdt 1 **D16**, which must
cover **both widening and narrowing**). Legitimate: not P0 because `documents_wave_c` **ships OFF**,
so the path is unreachable in production today. The other options offered and not taken were fixing
it inside DM4 with a keystone + negative twin, or ratifying source-authority-is-enough in ADR 0119.

⛔ **QA's standing caveat, binding on how this may close.** This is an open **security** obligation,
not a backlog item, and **its deadline is the flag-on date, not Phase 19's delivery date**. It must
**never** be absorbed into *"Phase 19 delivered an access plane"* — **a plane that only WIDENS would
not close it.** Closure requires a **narrowing** arm that refuses a recused coordinator at the
freeze door, **proven by a negative twin**, and the FUP is closed only against that evidence.

⚠ **Before `documents_wave_c` is ever enabled in production, this must be resolved or explicitly
re-ratified by the PO.** Name it in Phase 19's scope in
[accreditation-track.md](../phases/accreditation-track.md) so D16 cannot land without meeting it.

</details>

> ⭐ **The caveat above was met on its own terms, and that is why this closed rather than deferred.**
> It demanded a *narrowing* arm proven by a negative twin; it got one (R5/R6 red-first). ⚠ Its final
> paragraph still binds on the **remote**, which does not have the fix — see the resolution box above.

### 🔴 FUP-DM4-PRODROW — reconcile the dangling frozen PRODUCTION snapshot row at the push/deploy step, not during DM4 (owner: lead + backend)

> ## ⭕ UNBLOCKED 2026-08-18 — the blocker is answered, and **this item's own headline figure is WITHDRAWN**
>
> **1. The blocker is discharged.** `FUP-DM5-CLOUD-ORPHAN-SURFACE`'s constructed-orphan probe
> ran and settled: **no Cloud surface can see a byte-orphan**
> ([run record](cloud-orphan-probe-2026-08-18.md)). Per TRIAGE #9 this item tracks *two*
> questions and the probe answers the **byte** one only — so *"erased, not reconciled"*
> survives it, and this may still never close as "reconciled": no per-row
> freeze-or-tombstone decision was ever made and no manifest exists.
>
> **2. ⛔ WITHDRAW the "~49 objects vanished with no `DELETE`" figure — the arithmetic is
> unsound.** It came from `storage.objects` reading *96 inserted / 47 deleted / 0 live*, and
> that subtraction compares two different units. **Measured on the same table and project,
> 2026-08-18:** uploading exactly **5** objects moved `n_tup_ins` by **+6**; deleting exactly
> **5** moved `n_tup_del` by **+5**. Deletes track objects 1:1; **inserts do not** — the
> storage write path inserts more tuples than objects. After the probe session the counters
> read **122 ins / 62 del**, a naive residual of **60**, with a true live count of **0**.
>
> > ⭐ **A residual of 60 was manufactured while destroying nothing unaccounted for.** The
> > residual is not a count of anything real. `pg_stat_all_tables` is an approximate
> > collector view besides — `n_live_tup` read **3** when the true count was **5**.
>
> ⚠ **This does NOT rehabilitate the remote.** The production DB *was* reset and *is* empty;
> and by finding (1) any surviving bytes would be unobservable regardless. What changes is
> only that the **magnitude** must be re-derived from something other than these counters,
> and the "~49" must not be cited again. *A figure quoted from a real counter, at the wrong
> grain, reads exactly like forensics* — the same class as
> [[a-predicate-quoted-at-the-wrong-grain]], and the correction to it must not repeat
> [[a-partial-fix-reads-as-a-complete-one]]: the direction is corrected **and** the magnitude
> is withdrawn rather than restated.

> ## ⛔ CENSUS RUN 2026-08-18 (step 1 of TRIAGE #6) — **THE SUBJECT IS GONE, AND IT WAS ERASED, NOT RECONCILED**
>
> **The production database is empty.** Every application table 0 rows; `auth.users` 0; all 4 buckets
> 0 objects. The 2026-08-11 subject of this item — 1 dangling frozen referral path · 3 unreferenced
> controlled-doc objects · 4 dangling attachment rows · 45 objects / ~0.5 MB — **no longer exists.**
> Full census with deriving queries: `docs/backend-state.md` § REMOTE CENSUS 2026-08-18.
>
> ### ⭐ It did not get reconciled. It got truncated.
> `pg_stat_all_tables` distinguishes the two, and the distinction is the whole finding:
> `auth.users` shows **631 inserts, ZERO deletes, ZERO live rows** — a row-level `DELETE` increments
> `n_tup_del`, so 631-in / none-deleted / none-left is only explicable as **TRUNCATE/reset semantics**.
> Only **6 of 165** public tables ever recorded a single `DELETE`.
>
> ### ⭐⭐ WHEN — the logs answer it, and the answer EXONERATES everyone while indicting the RECORD
> `query_logs` retains to 2026-08-17T10:08. At **2026-08-17 11:37:35 UTC**: `CREATE TABLE IF NOT EXISTS
> supabase_migrations.schema_migrations` → every `CREATE EXTENSION` → then migrations from **`20260711…`**
> being *applied*. Old migrations only re-run if the history table is empty; a `db push` skips them.
> **That is a remote reset.** The `db push` the record knows about came *after*, at 2026-08-18 01:19.
> No `TRUNCATE`/`DROP SCHEMA` statement appears in the window at all.
>
> **So the reset preceded TRIAGE #6 by ~14 hours.** Nobody disobeyed the sequencing — ⭐ **TRIAGE #6 was
> RULED ON STALE FACTS.** It carefully sequenced "the reset must come LAST, because it would destroy the
> surface step 2 needs", against a remote where the reset had *already happened and the surface was
> already gone*. The ruling was moot the moment it was written, and nothing in the repo could have said
> so — this is [[a-records-claim-about-an-external-system-goes-stale-silently]] claiming a **ruling**
> rather than a status line. *The census-first ordering I then followed was right, but for the wrong
> reason.*
>
> A bare reset is still precisely the unmanifested, uncounted, unaudited byte destruction
> `FUP-DM5-STACK-CYCLE-DESTROYS-BYTES` flags as ungoverned — the event ADR 0120 **D9** exists to prevent,
> arriving through the accidental door. That judgement stands; only its tense changes, from *would* to
> *did*.
>
> ### ✅ PO RULING 2026-08-18 — **STAYS OPEN, BLOCKED ON the `FUP-DM5-CLOUD-ORPHAN-SURFACE` C1b probe**
> The PO declined both closure options (close-as-destroyed, and close-as-resolved). **This item remains
> OPEN until the constructed-orphan probe settles whether the ~49 objects' bytes survive.** It therefore
> now tracks **two** questions deliberately — the erased subject *and* the likely-orphaned bytes — kept
> together rather than split.
>
> ⛔ **Carry this forward to whenever it does close:** the *"destroyed, not reconciled"* finding below is
> **not** something the probe can change. The probe answers the byte question only. Whatever the probe
> returns, this item may **not** close as *"reconciled"* — no per-row re-freeze-or-tombstone decision was
> ever made and no manifest exists, and that stays true forever. ⭐ *Recorded here because a blocked item
> closes on the blocker's verdict, and the half that the blocker does not address is exactly the half that
> gets discharged by association* — the same defect the promotion ruling above was written to prevent.
>
> ### ⛔ THEREFORE THIS ITEM DOES NOT CLOSE AS "RECONCILED"
> The standing instruction on this item is **"reconcile or quarantine explicitly, never invent success."**
> An empty table satisfies the *letter* of "no dangling rows remain" while satisfying **none** of what was
> asked: no per-row re-freeze-or-tombstone decision, no manifest, no record of what was destroyed.
> ⭐ *The absence of the subject is not the discharge of the obligation* — closing this green would be
> exactly the shape of [[absence-of-a-verdict-is-not-absence-of-coverage]].
> **Correct disposition: close as `SUBJECT DESTROYED WITHOUT A MANIFEST`** — a different closure, with a
> different record, and one that leaves the governance defect visible. **PO ruling required.**
>
> ### 🔴 A NEW finding this census produced: 49 objects vanished without a DELETE
> `storage.objects` = **96 inserted / 47 deleted / 0 live**. 47 were deleted properly (consistent with the
> S4 bucket retirement, whose own `storage.buckets` figures reconcile *exactly*: 16−12=4). The other
> **49 left no delete record** — they went with the reset's schema rebuild. ⚠ **A reset rebuilds
> `storage.objects`; it does not necessarily delete the objects from the backing store, and whether it
> orphans them is CLI-VERSION DEPENDENT** → [[remote-reset-storage-orphan-is-cli-version-dependent]].
> So these are **likely-orphaned bytes, not confirmed-destroyed ones**, and the metadata
> that would say *what to look for* is gone too — so this is now **permanently unmeasurable from SQL**.
> Feeds `FUP-DM5-STORAGE-ORPHANS` (Cloud half) and is a second live instance of
> `FUP-DM5-NO-ANSWER-VS-NOTHING`: **`objects = 0` proves the METADATA is gone, never the BYTES.**
>
> ### What this does NOT establish — before anyone reads the above as a conclusion
> **Not when, and not by whom.** `pg_stat` carries no timestamps, and its counters are not durable
> evidence (a stats reset clears them; a `DROP`+`CREATE` gives a new relid and fresh counters). The
> reading above is *consistent with* the numbers; it is not proof, and it is recorded as such.
>
> ### Step 2 is NOT blocked by this
> `FUP-DM5-CLOUD-ORPHAN-SURFACE`'s probe **constructs** its own orphan, so an empty remote is a clean
> substrate for it — arguably better. What is lost is the chance to measure the *pre-existing* orphans,
> and that loss is permanent. The probe still answers its real question (*can any customer-accessible
> tool SEE an orphan on Cloud*) and still needs S3 keys minted by a human.

> ## ⭕ ITS TRIGGER FIRED 2026-08-18 — this is DUE, not deferred
>
> The body below sets the closure precondition as *"the DM stack pushed, `db push` run, a fresh census."*
> **The push ran on 2026-08-18.** So its own ⛔ *"do not query or mutate the linked project"* bar — which
> was scoped to the no-push directive — **lifted at the same moment**. Read-only census is now sanctioned.
>
> ## ✅ SEQUENCED 2026-08-18 (DM-FUP TRIAGE #6) — census → probe → then decide. **The remote is NOT reset first.**
>
> 1. **Read-only remote census.** The 2026-08-11 figures below are *stale by design*; migration
>    `20260927000400` has since retired 8 buckets, so the dangling rows may already be gone.
> 2. **`FUP-DM5-CLOUD-ORPHAN-SURFACE`'s constructed-orphan probe**, which needs a live writable remote.
> 3. **Then** reconcile-vs-reset, per row, with a manifest, recorded.
>
> ⭐ **The finding: the PO-sanctioned "much cheaper closure path" collides with an open item.** The
> amendment below offers a **remote reset** as the cheap way out. A bare `db:reset:linked` is precisely
> the unmanifested, uncounted, unaudited byte destruction that `FUP-DM5-STACK-CYCLE-DESTROYS-BYTES`
> flags as ungoverned — the event ADR 0120 **D9** exists to prevent, arriving through the accidental door
> instead of the deliberate one. **And it would destroy the surface step 2 needs in order to measure.**
> Both reasons are independently sufficient to sequence the reset last.

Filed 2026-08-14 at DM4 open, as the recorded half of **PO ruling R2**.

The parent plan's DM4 step 2 requires that "the 1 dangling frozen production row is reconciled
(re-freeze or explicit tombstone)". **DM4 does not do this.** At phase open, `main` sat **136
commits ahead of `origin/main`** with nothing pushed and no `db push` — reconciling production
then would move the DB ahead of the code that understands it, while the standing PO directive
still forbids pushes.

**What DM4 DOES owe:** build and prove the reconciliation path **locally**, so that the
production step is an execution, not a design exercise.

**What is deferred here**, from the 2026-08-11 production census (⚠ **stale by design — re-census
before acting, never act on these figures**): 45 objects / ~0.5 MB · `attachments*` EMPTY ·
**4 dangling attachment rows** · **3 controlled-doc objects unreferenced** · **1 dangling frozen
referral path**. Note DM3's own scope carried a related discrepancy — prod had **3 objects but 0
version rows** — with the standing instruction to *reconcile or quarantine explicitly, never
invent success*. The same instruction binds here.

⛔ **Do not query or mutate the linked project to close this while the no-push directive stands.**
Closing it requires: the DM stack pushed, `db push` run, a fresh census, then an explicit
re-freeze-or-tombstone decision per row, recorded.

**⚠ AMENDED 2026-08-14 — a second, much cheaper closure path exists.** The PO confirms **a full
database reset is available on the REMOTE as well as locally (no active users)** — the standing
pre-launch posture ([[prelaunch-db-reset-ok]]: design the correct schema rather than back-compat
migrations). A remote reset removes the dangling row outright, so the per-row
re-freeze-or-tombstone decision above **may never need to be made**. Both paths stay open; the
choice belongs to the deploy step, not to DM4.

⚠ **Do NOT let this delete DM4's guards.** M3's dead-pointer null and M4's raising `DROP TABLE`
guard are correct **independent of the deploy strategy** — M3's is *semantics, not repair* (the
sibling FK is `ON DELETE SET NULL`), and M4's value was never "prod probably has rows" but "if
rows exist, an unmodeled writer exists." A reset makes them near-unreachable, which costs nothing.
A guard removed because one deploy strategy makes it moot is a guard missing when that strategy
changes.

🔶 **OPEN, and it is DM5's problem rather than DM4's — flagged early because it is cheap to know
now:** a DB reset wipes `storage.objects` **metadata**, but it is **not established** that it
removes the underlying **bytes**. If it does not, a remote reset leaves orphaned objects with no
metadata rows — which would quietly undermine **DM5's retirement manifest**, whose method is
"prove zero DB references + zero product callers + zero policies, then empty and delete the bucket
**via the Storage API only, never `storage.objects` DML**". *An emptiness proof derived from a
table that was just truncated is not an emptiness proof.* Verify before DM5 relies on it.

### 🟡 FUP-PREVIA-MINT-FLAG-ASYMMETRY — `HC0DV` refuses a prévia on the premise that the mint is reachable, and the mint's preconditions are a STRICT SUPERSET (owner: backend; found by `qa` in the r2 re-review of the ADR 0125/0126 build)

Filed 2026-08-18 (lead), on `qa`'s **O1** — graded an observation, not a blocker, and the grading is right.
Measured from the live catalog by `qa` and **re-measured independently by the lead**:

```
public.log_document_previa    asserts:  document_printing
public.mint_printed_document  asserts:  document_printing + documents_wave_d
```

**The state that bites: `document_printing = on`, `documents_wave_d = off`.** A **locked** source then has
**no paper at all** — the prévia raises `HC0DV` (*"this source registers; emit it instead"*) and the mint
raises `HC0D7` (wave D disabled). Before `HC0DV` landed, the prévia was available in that state.

⚠ **The message actively misdirects.** Whoever disables wave D during an incident loses the accreditation
print surface **and is told to use the door they just turned off**. That is worse than a plain refusal,
because it sends the operator to a dead end with confidence.

⭐ **The class is adjacent to this build's dominant one, not the same, and the distinction is the useful
part:** the caller/door class is *a keystone proving a door works while the action cannot reach it*. This is
**a refusal added to door A on the premise that door B is available, without checking that B's preconditions
are a SUPERSET of A's.** Both are "a claim about a neighbour that nobody measured", one at the call site and
one at the precondition.

⇒ **A refusal that redirects to another door owes a check that the other door is reachable under every state
in which the refusal fires.**

**Why it is not a blocker** (and do not re-grade it without re-deriving these):
- It needs a **non-deployed flag state** — both flags are `true` today.
- Killing the document substrate arguably *should* stop printing, so the *behaviour* is defensible even
  though the *message* is not.
- No PHI or authorization consequence: it fails **closed** in both directions.

**Options, none chosen:** align the prévia door's assertions with the mint's; or make `HC0DV`'s message
conditional on the mint actually being reachable; or accept it and record the flag interaction where an
incident responder will find it. ⚠ Aligning the assertions is a **widening of refusal** — it would stop
prévias for *unlocked* sources too when wave D is off, which is a different and larger behaviour change than
it first appears.

**Two smaller records from the same review, neither filed separately:**
- **O2** — the refusal fires **after** the render, so a locked source burns a Gotenberg semaphore permit per
  request. Correctness is unaffected (no bytes leave); it is a contention cost under ADR 0125 D9's shared pool.
- **O3** — C5's 404-collapse comment now describes two refusal paths where it names one.

### 🟡 FUP-E2E-SUBMITTED-POOL-UNSCOPED — the shared submitted-response pool has no `case_phase_id is null` filter, and the one-line fix BREAKS a passing test (owner: tester + backend; **needs `seed.sql` or pool-math work, not a filter**)

Filed 2026-08-18 (lead) on `tester`'s finding during the ADR 0125/0126 E2E build. **`tester` correctly
declined to fix it** and flagged the trap in the obvious repair — that judgement is the reason this is a
follow-up rather than a broken suite.

**The gap.** `submittedResponseIds` / `creatorMintFixture` in `e2e/helpers/pdf-printing.ts` scope their pool
to `commission_id` + `status = 'submitted'` and order by `id.asc`. There is **no `case_phase_id is null`
filter** — it was never needed, because until `pdf-printing-case-currency.spec.ts` existed no spec created
phase-bound responses in that commission.

⇒ **Any phase-bound submitted response in CCIH can sort into pool index 0**, and the "full lifecycle" test's
first assertion (*"Nenhum documento emitido…"*) is then false against a genuinely fresh seed.

⚠ **This is INDEPENDENT of the cleanup bug that exposed it.** That bug is fixed. But a working `afterAll`
only prevents the leak *while it actually runs* — a crashed run, a `--grep` that skips the file, or a timeout
all leave the debris, and the pool has no scope to defend itself. Fixing the purge does not close this.

**⛔ The one-line filter is NOT the fix, and this is the measured part.** Scoping the pool to
`case_phase_id is null` would leave exactly **6** rows. Measured from the live seed:

```
Comissão de Controle de Infecção Hospitalar : submitted_standalone=6  submitted_phase=3
Comissão de Farmácia e Terapêutica          : submitted_standalone=4  submitted_phase=0
```

`creatorMintFixture` assumes **at least one submitted response OUTSIDE the 6-wide pool**. At exactly 6 that
assumption drops to **zero** and an already-passing test breaks. **A one-line fix that breaks a passing test
is not a one-line fix.**

**⇒ The real repair is one of two things, neither small:**
1. **Widen the seeded pool** in `supabase/seed.sql` — ⛔ but that file is a contract with ~900 tests, and
   [[a-shared-fixture-cannot-satisfy-two-specs]] is already a recorded scar here. Any addition must be
   checked against every consumer of the CCIH response set, not just this one.
2. **Redesign the pool math** so `creatorMintFixture` does not depend on a spare slot outside a
   fixed-width pool.

⚠ **Do not "fix" it by having each spec claim a wider index range** — that trades a structural gap for a
coordination convention between files that cannot see each other, which is the same failure one level up.

**⭐ The class:** a shared fixture's selector was **correct until a new consumer changed the population it
selects from**. Nothing about `submittedResponseIds` changed; the *world* it queries did. Same family as
[[enumeration-boundary-is-a-syntax-not-a-property]] — the boundary (`commission + status`) was a proxy for
the property (*a standalone response nothing else has claimed*), and the proxy held only while one kind of
row existed.

### ⭐⭐ ADDENDUM 2026-08-18 — the defense ALREADY EXISTED, was correct, and was UNREACHABLE

`tester` found, after being fixed and while looking at nothing in particular:
**`e2e/helpers/purge-forms.ts`** is a purpose-built, already-audited helper for this exact class, filed as
**`BUG-E2EISO-002`** after a real incident — a DB-wide sweep on **2026-08-03** found **46 orphaned draft
`form_versions` plus 2 orphaned PUBLISHED versions still carrying real `responses`/`answers`**, *"accumulated
silently across past gate runs"*.

⛔ **And it carries a tripwire that names this bug IN ADVANCE.** Verified by the lead at `:102–109`:

> *"`forms` and `form_versions` also have NO ACTION referrers — `case_phases`, `process_template_phases`,
> `case_interviews` … so this never fires today — **but that is a claim about fixtures, and a comment
> asserting it would go stale the first time a spec grows a case fixture**"*

…backed by a live `raise exception` at `:116–125` pre-checking **those exact three tables** and refusing
loudly if any row references the forms being purged.

**`pdf-printing-case-currency.spec.ts` is the first spec that grew a case fixture.** The comment predicted
its own staleness condition, named the mechanism, and shipped an instrument that would have refused —
**and none of it fired, because the tripwire lives in a helper the fixture never called.**

⇒ **A correct door nothing reaches**, at a third layer: not a query with no caller, not a keystone no product
path can satisfy, but a **tripwire no fixture consults**.

⚠ **The transmission mechanism is imitation, and it matters more than the instance.** The purge shape was
copied from `case-corrections.spec.ts` and `case-void-reopen.spec.ts` — **and neither of those uses
`purge-forms.ts` either**. Both also carry the identical unchecked `spawnSync` (no captured result, no
assertion): *unconfirmed broken, deliberately untouched*. **A defense that siblings bypass is a defense the
next author bypasses by copying them**, without ever deciding to.

**Scope, measured:** `grep -rl "session_replication_role" e2e/` → **21 files** (13 specs, 3 helpers). Not all
inspected.

**⇒ What this item should actually become.** The same gap has now surfaced **twice**: the form+response half
(2026-08-03, fixed by `purge-forms.ts`) and the **case-domain half** (2026-08-18, this item).
`purge-forms.ts` does **not** cover cases / `case_phases` / `process_templates` / `process_template_versions`
/ `process_template_phases` / `case_correction_requests` — it is form+response only, so it could not have
solved this fixture as-is. The natural repair is **extending its tripwire pattern to the case domain** rather
than every case-domain spec hand-rolling a purge. ⭐ And the tripwire is the **better instrument** than an
exit-code assertion: it refuses **before** attempting the delete, rather than reporting after.

⛔ Deliberately NOT done in the ADR 0125/0126 build: extending a shared audited helper mid-gate, and touching
two sibling specs whose breakage is unconfirmed. Both are widenings, and a widening cannot be wrong-and-safe.

⚠ **Lead note on a smaller instance of the same thing, recorded because it nearly mis-filed this item:** the
first verification query filtered `commission.name ilike '%CCIH%'` and returned **0 standalone, 0
phase-bound** — which reads as "the seed is empty" and would have made this item look like a phantom. The
commission is named **`Comissão de Controle de Infecção Hospitalar`**; `CCIH` is the *persona-email*
convention (`chefe.ccih@test.local`), not the commission's name. **A filter built from the naming convention
of an adjacent artifact returns a confident zero.**

### 🟠 FUP-42501-CONFLATES-GRANT-WITH-RLS — 2 of 12 P0-isolation assertions pass on a **table-grant** error, not on the RLS refusal they claim to prove (owner: backend + tester; **a COVERAGE defect, NOT a vulnerability — the tables are protected**)

Filed 2026-08-18 (lead). Surfaced when `backend` hit the same shape building the ADR 0125 D6 keystone
(`345_previa_audit_door.sql`) and noted it *"generalises to every `throws_ok(…, '42501')` in the tree"*.
Lead swept the tree and measured the population; **the generalisation is real but much narrower than
that**, and it lands somewhere that matters.

**⛔ NEUTRALIZE BEFORE ESCALATING — this is not a vulnerability, and the distinction is the whole item.**
Measured: `authenticated` holds **no INSERT privilege** on `public.rca_evidence` or
`public.capa_action_evidence`. So those two tables are **protected — more strongly than the test claims**,
by a missing grant rather than by RLS. Nothing is exposed. What is wrong is the **assertion**, not the
posture.

**The mechanism.** `42501` is simultaneously

- the correct SQLSTATE for an **RLS / authority** refusal, and
- Postgres's **generic** `permission denied for table …` code.

So `throws_ok($$ insert into public.X … $$, '42501')` **cannot distinguish** *"RLS refused this
cross-tenant write"* from *"the role was never granted INSERT on this table at all"*. The assertion is
satisfied by either, and it reports the first.

**Measured population — the enumeration, not an estimate.** 15 tree-wide hits for `throws_ok` + `42501`;
**3 are comments, 12 are live assertions**, all in `supabase/tests/252_authz_p0_isolation.sql`
(lines 114–157), probing 6 `rca_*` and 6 `capa_*` tables. Grant check on all twelve:

| | `authenticated` INSERT | assertion proves |
| --- | --- | --- |
| 10 tables (`rca_factors`, `rca_members`, `rca_root_causes`, `rca_timeline_entries`, `rca_why_chains`, `capa_action`, `capa_action_task`, `capa_measure`, `capa_measure_result`, `capa_effectiveness`) | **true** | ✅ RLS — the only thing that can raise `42501` |
| **`rca_evidence`**, **`capa_action_evidence`** | **false** | ⛔ **the grant.** RLS is never reached |

⇒ **The P0 suite claims cross-tenant isolation on 12 tables and demonstrates it on 10.** An auditor asking
*"is `rca_evidence` RLS-isolated?"* finds a green P0 assertion and concludes yes; the test never exercised
RLS.

⭐ **The class is the inverse of the usual one here.** This project's recurring failure is
[[absence-of-a-verdict-is-not-absence-of-coverage]] — reading a missing verdict as a hole. This is the
mirror: **a PRESENT green assertion that is not coverage.** The `42501` conflation is what makes it
invisible, because the test's own expected value is correct.

⚠ **The tree ALREADY KNEW this trap — twice — and it still recurred.** Both are comments, not gates:
`301_hospital_affiliation_substrate.sql:21` (*"'grant' cannot be proven with `throws_ok(..., '42501')`: a
miss…"*) and `277_ff4_power_authoring.sql:328`. A hazard documented in prose in two files did not stop a
third instance being written, or the two live ones surviving. **That is the argument for a mechanical
check rather than a fourth comment.**

**Fix — `backend`'s own two-part remedy from `345`, which is the model:**
1. **Grant the probe role what the test is not testing**, so the only thing left that can raise `42501` is
   the property under test; and/or
2. **Remove the incidental read entirely** (`345` passes the source id as a literal so no fixture read
   happens inside the probe at all).
3. ⭐ **Two-sided is what actually catches it.** `backend`'s deny-leg passed on the fixture's own error and
   **only the ALLOW leg failing exposed it.** A deny-only keystone is green while asserting nothing about
   authorization. Every `42501` assertion needs its allow-side twin.

⚠ **Do not "fix" this by granting INSERT on the two tables** — that would be a widening performed to make a
test honest, trading real protection for a truer assertion. Fix the **assertion**: either probe a role that
holds the grant, or assert the RLS refusal by a means that cannot be satisfied by a missing privilege.

⛔ **Not fixed in the ADR 0125/0126 build** — different suite, different subject, and it needs the `252`
owner's judgement about what each probe is meant to prove. `345`'s own instance **is** fixed, with the
measurement in that file's header.

### 🟠 FUP-SUPERSESSION-BADGE-LANE-BLIND — `resolveSupersessionBadge` mirrors an aggregation rule but drops that rule's OWN lane restriction, so a phase-bound response gets the grain ADR 0126 D8 rejected (owner: frontend + backend; **ADR 0074/0085 axis — NOT the print-currency axis**)

Filed 2026-08-18 (lead). Found by `frontend` during the ADR 0126 Amendment 1 **§K sweep**, and **outside that
sweep's bound** — §K bounds on `printed_documents.status`; this is ADR 0074's supersession axis. It surfaced
because the sweep's vocabulary caught the word *"Atual"*, i.e. **by accident, not by coverage**. Measured from
the files by `frontend` and **re-measured independently by the lead** before filing.

**The derivation, measured** (`src/lib/queries/submissions.ts`):

```
resolveSupersessionBadge:  'substituido' ⇔ hasSubmittedSuccessor
                           'atual'       ⇔ isSuccessor
fed at :432/:433 by        hasSubmittedSuccessor: supersededIds.has(r.id)
                           isSuccessor:           r.supersedes_id != null
```

`grep "correction_request|approved|current_response_id"` in that file: **0 hits**. There is no approval join.

**⭐ The precise defect is NOT "wrong grain" — it is a MIRROR that dropped its source's WHERE clause.**
The function's own comment says the submitted grain is *"the 'latest-in-chain' signal, **mirroring the
aggregation exclusion**"* — i.e. mirroring `app.submitted_form_responses`. That mirror is **correct**, and
measured, the aggregation rule it copies is **standalone-only by its own predicate**:

```
and r.case_phase_id is null                                   -- app.submitted_form_responses
and not exists (select 1 from responses succ
                where succ.supersedes_id = r.id and succ.status = 'submitted')
```

But `listSubmissions` surfaces **both** lanes (`isCasePhase: r.case_phase_id != null`, `:449`) and applies the
badge unconditionally. So:

- **standalone lane — CORRECT.** Submitted-grain *is* the effectiveness rule there, and it is exactly what
  ADR 0126 **Amendment 1 §A** ratified for the standalone head lane.
- **phase-bound lane — WRONG.** ADR 0126 **D8** requires approval-grain: `case_phases.current_response_id`
  moves **only** in `approve_correction`, and `sync_case_phase_on_submit` returns early for successors with the
  comment *"approval owns effect-taking"*.

**Consequences on the phase-bound lane, all from D8's own analysis:**
1. The original flips to **"Substituído"** the moment a correction draft is *submitted* — **before approval**,
   while `current_response_id` still points at it, so it is still the effective response.
2. It flips **back** if `reject_correction` walks the draft to `in_progress` — the badge **flaps**, driven by a
   low-authority act.
3. A submitted-but-unapproved successor renders **"Atual"**, asserting it is the current one when the phase
   pointer does not reference it.

**⭐ The differential that makes this a defect rather than a definition.** The **same pill**, one file over at
`…/manage/cases/[caseId]/fase/[phaseId]/respostas/page.tsx:65`, is fed by
`corrections.some(r => r.status === "approved")` — **approval grain**, with a comment citing the pointer
(ADR 0085). **The platform already knows the right grain and uses the wrong one one file away, rendering the
identical badge.** That is what stops the submitted-grain version reading as an intentional dashboard semantic.

⚠ **Not established, and it must be before any fix:** whether ADR 0074 *deliberately* chose submitted-grain for
a list whose job is "show me what is in flight". The mirror-comment suggests the intent was aggregation parity,
not lifecycle truth — which would make the lane restriction an oversight rather than a decision — but that is
an inference, and this item must not be closed on it. **Read ADR 0074 (and 0085) first.**

⛔ **Deliberately NOT fixed in the prévia build.** Different axis, different ADR, and a fix is a lane-aware
rewrite of a shared pure function with its own test surface. ⚠ **D8's *disclosure* argument does NOT transfer**
— that concerned a public page leaking an in-flight correction; this is an internal coordinator surface where a
`staff_admin` is entitled to see one. Only the **wrong-grain and flapping** halves transfer. Do not import D8's
severity wholesale.

**⭐⭐ SHARPENED 2026-08-18 (lead, by measurement): the correct predicate ALREADY EXISTS IN TS, in the same
directory, and ARCHITECTURE.md names it as THE twin — singular.**

`src/lib/queries/dashboard.ts` exports `isDashboardCountable`, which ARCHITECTURE.md Rule 2 (line ~266) calls
*"the TS twin"* of the choke-point. Its body:

```ts
return r.status === 'submitted' && r.casePhaseId == null && !r.hasSubmittedSuccessor
//                                 ^^^^^^^^^^^^^^^^^^^^ the lane conjunct, present here
```

`resolveSupersessionBadge` sits one file away in the same directory and omits exactly that conjunct. So this is
**not** "nobody knew the rule" — it is **two TS derivations of one SQL choke-point, of which only one is
sanctioned and only one is complete.** ARCHITECTURE.md's binding instruction in the same paragraph is
*"**Any new aggregation path must reuse that choke-point, not re-derive `status = 'submitted'`,** or corrected
metrics double-count."*

⇒ **This narrows the fix and raises the confidence.** The repair is to make the badge consume the same lane
test rather than to invent one — and the "maybe ADR 0074 chose submitted-grain deliberately" caveat is now
**much weaker**, because the deliberate choice is visible in `isDashboardCountable` and it *includes* the lane
restriction. ⚠ Still read 0074/0085 before ruling: a *display* badge is arguably not an *aggregation* path, and
that is the one reading under which the omission could be intentional.

**⇒ The class, which is the reusable part:** *a mirror inherits its source's predicate, not just its shape.*
`app.submitted_form_responses` carries `case_phase_id is null` in the same `where` as the exclusion the badge
copied; copying one conjunct and not the other produced a rule that is right on one lane and wrong on the other,
with **one code path and one badge** so nothing distinguishes them. Same family as
[[a-predicate-quoted-at-the-wrong-grain]], and the direct sibling of ADR 0126 Amendment 1 **§A** — which is the
*same lane-blindness* found in the print-currency derivation and fixed there.

### 🟡 FUP-LINT-VECTOR-DIMENSION-DRIFT — propose a lint gate over shared SQL↔TS **vector fixtures**: a declared dimension that no vector varies, or a consumer that silently drops one (owner: lead + PO; **a gate change is not a mid-build edit**)

Filed 2026-08-18 (lead) during the ADR 0125/0126 prévia build, on `backend`'s proposal. **Deliberately not
built in that build** — CLAUDE.md §8's own record is that each of the seven gates was added *after* its class
shipped a live defect, one at a time and on its own evidence. This one already has its evidence; what it does
not have is a PO ruling.

**The proposal, in the proposer's words:**

> A lint gate over the shared-vector fixtures that fails when a predicate's declared *input dimensions* and
> its *asserted rows* diverge: specifically, when a fixture gains a dimension that no vector varies (the flag
> exists but nothing pins it), or when a consumer's state-mapping function silently drops a dimension the
> fixture declares (the row passes because the flag never reaches the predicate).

**Both shapes were LIVE in the build that proposed it — this is not a hypothetical:**

1. **A dimension nothing varied.** `print-source-registers-vectors.json` declared `correction_open` /
   `phase_voided` as `form_response`-only and `meeting_disposed` as `meeting`-only, and the requirement that
   each predicate **IGNORE** a flag outside its kind was stated **in a comment and asserted by no vector** —
   every meeting row carried the form_response flags `false`, so the kind-scoping was never exercised in
   either direction. Found only because the build's task text asked for the pin by name. Fixed by adding 3
   cross-kind rows.
2. **A consumer that dropped one.** `frontend`'s `stateOf(v)` mapped three of the fixture's four keys, so the
   new `form_response + meeting_disposed → registers=true` row **passed on its first run** — the flag never
   reached the predicate, so the row asserted nothing. ⚠ The tell was *green-on-first-run*, which reads as
   "already correct" and was in fact "not yet connected". Its mirror row **was** real and also passed, so half
   the cross-kind pin worked and half was theatre, **under one indistinguishable green bar**.

**Why a gate rather than a rule.** The vector-fixture pattern is what makes a SQL↔TS mirror safe at all — ADR
0126 D3 rejects "two computations of one property" precisely because they can disagree with nothing going red,
and the mirror survives that rejection **solely** because the fixture is the thing that reds. A fixture with a
dimension nothing varies is therefore not a weak test; it is **the mirror's safety property silently absent**.
Architecture Rule 3 already mandates this pattern for the condition evaluator, so the gate would generalise
beyond the print derivation rather than serving one feature.

**Prior art to build on:** [`check-vacuous-assertions.mjs`](../../scripts/check-vacuous-assertions.mjs) is the
precedent for turning "a test that can go green having asserted nothing" into a mechanical gate, and it
self-red-proves each checker on every run — a new gate should do the same, or it joins the class it audits.
⚠ Note the existing gate's own scope limit, recorded in `FUP-PGTAP-VACUOUS`: it scans **TS spec files only**.
A vector fixture is consumed from **both** sides, so this gate must reason about the fixture and its
consumers, not about one language's test files.

**Not in scope until ruled:** whether it becomes gate 8 of `npm run lint` or a standalone check, and whether it
is fixture-shape-generic or keyed to a declared manifest. Both are PO calls, and neither should be settled by
whoever happens to be mid-build.

### 🟡 FUP-LINT-STALE-SYMBOL-COMMENT — propose a 6th lint gate: a comment naming an identifier that no longer exists (owner: lead + PO; a gate change is not a mid-phase edit)

Filed 2026-08-13 during DM3. Every one of the five gates in `npm run lint` was added **after**
its class shipped a live defect (CLAUDE.md §8). This class qualifies twice over: **~6 instances
in DM3 alone**, plus 4 historically, **one of which shipped a live bug**.

**The class.** A deletion strands every comment that referenced it, and **no gate sees any of
them** — not typecheck, not eslint, not the four custom gates. Worst DM3 specimen:
`supersedeDocument`'s doc comment telling the frontend to upload *"via `addDocumentVersion`"* —
**a deleted verb, named in the documentation of a verb the frontend actively calls**. Others:
a page header claiming the storage SELECT policy carried the approver arm (false since M5 —
different provenance, a *migration* rather than a deletion, same class), and a module header
still advertising the signed-URL byte path M5 deleted.

⚠ **The design tension that must be resolved BEFORE the gate is built — raised by `frontend`,
ruled by the lead 2026-08-13.** Four comments in `src/app` + `src/components` deliberately
name a dead symbol **as dead** ("`reviseChangesRequestedDocument` is gone"), which a naive
implementation would flag as false positives:

- `…/documentos/novo/page.tsx:40` · `…/nova-versao/page.tsx:27` · `…/revisar/page.tsx:33` ·
  `components/controlled-documents/add-version-form.tsx:52`

**RULING: tombstones are legitimate and stay.** A reader who remembers `supersedeAndSubmitDocument`
and finds **silence** concludes they are in the wrong file; one who finds *"it is gone, and here
is what replaced it"* is served. Deleting that information to satisfy a gate would make the
codebase worse in order to make a check pass — the gate exists to serve the reader, not the
reverse.

**Therefore the gate's spec must include a machine-checkable tombstone convention** (an explicit
marker token adjacent to the symbol, e.g. `@removed`), so a deliberate tombstone is
distinguishable from a stale claim **without natural-language guessing**. Settle the exact token
when the gate is built. ⛔ **Do not churn the sites now** for a gate that does not yet exist — a
mid-phase rewrite for a hypothetical checker is cost with no coverage.

**The tombstone population is SEVEN, and how it was established is the lesson.** Three
successive lists (backend 6, frontend 3, lead 4) were each short, and **none was careless** —
each was bounded by a different *unstated enumeration key*: "comments my deletion broke" / "the
composite verbs" / "verbs + the RPC". `frontend` finally derived it **by construction** — the
removal set from `git diff 5310358..HEAD -- src/lib` ∪ the `drop function|policy|column`
statements in the DM3 migrations (**12 symbols**), swept across `src/app` + `src/components`:
`novo/page.tsx:40` · `nova-versao/page.tsx:27` · `revisar/page.tsx:33` ·
`add-version-form.tsx:52` · `version-compare-modal.tsx:23` ·
`documentos-pendentes/[documentId]/page.tsx:43` · `open-controlled-version-button.tsx:20`.
**A population is only well-defined once its key is stated**, and recall is keyed to whatever
you were last looking at ([[enumeration-boundary-is-a-syntax-not-a-property]], three times in
one thread).

### ⛔ The gate CANNOT be keyed on identifier names — three live families prove it

Lead sweep of all 12 removed symbols, 2026-08-13. Every hit below is **live, correct code** that
a name-keyed gate would flag, and where the tempting "fix" edits a subsystem the rule has no
business touching:

1. ⭐ **`uploadDocumentFile` is simultaneously REMOVED and LIVE.** DM3 deleted a *private*
   `async function uploadDocumentFile` from `src/lib/controlled-documents/actions.ts`, while
   **`src/lib/documents/upload-client.ts:13` exports a live one** — imported and called by
   `add-version-form.tsx:12,144`, `create-wizard.tsx:27,436` and
   `documents/document-upload-dialog.tsx:18,216`. **This is decisive: a bare identifier is not a
   key at all**, independent of scoping-by-family. A name-keyed gate would flag three live call
   sites of a live function.
2. **printed-documents (ADR 0104, retires DM5/Wave D)** — ✅ **RESOLVED by DM5·S3, corrected here
   2026-08-17 (QA r3 MINOR-13).** `src/app/api/documents/[id]/route.ts` now calls
   `.from(row.storage_bucket)` — **the bucket comes FROM THE DOOR** (D7/D12: a print's bytes are a
   `file_objects` row in `documents-standard`/`-phi`, resolved through
   `app.resolve_document_version_bytes`), and the file says so in a comment. There is no bucket
   literal in it. ⚠ This line was reported closed **twice** while open (r2, r3) — *the small item
   reported closed repeatedly is itself the finding.* Was: `.download(row.storage_path)`, downloading
   from the **`printed-documents`** bucket. A
   different table's column that DM3 never dropped, under a URL that *reads* in-scope. Plan §1.2
   named this exact hazard (two families sharing the `document` noun) and §1.3 warns the route's
   URL is misleading while its body is not.
3. **form-assets (ratified permanently separate, ADR 0114 D13)** — `storage_path` in
   `components/forms/block-card.tsx:91,478` · `block-list.tsx:53` · `item-editor-dialog.tsx:281` ·
   `read-only-blocks.tsx:52`.

**Spec consequences (binding on whoever builds it):** resolve each symbol to its **owning module
and family**, never its name; and the first dry-run must run against a **hand-classified
control** containing all three families above as known-goods — *a detector that finds a lot needs
proving too* ([[a-detector-that-finds-a-lot-needs-proving-too]]).

### 🔻 LEAD RECOMMENDATION 2026-08-13: **do NOT build the gate.** Adopt the convention; keep the process step

Four findings, in order of how much they cost the idea:

1. **The same identifier holds THREE truth values inside ONE file.** Verified in
   `src/lib/controlled-documents/actions.ts`: **`:119`** tombstone · **`:309` LIVE and
   correct** (it names the live export *and its module*, `@/lib/documents/upload-client`) ·
   **`:693`** tombstone. So **file scoping fails too**, not just name-keying. Classification
   must be **per-occurrence**, and `:309` is separable from `:119` only by **adjacent prose** —
   natural-language disambiguation, not resolution. It is also the occurrence a gate most needs
   to get right: flagging it invites deleting the sentence that tells the next reader where the
   live helper lives.
2. **Module resolution reaches only 3 of the 7 tombstones (43%).** Sites 1–3 are TS module
   bindings; site 4 names a **Postgres function + column**, site 5 a **TS property** (`hasFile`
   — never a module binding), sites 6–7 a **Postgres policy**. The misses need two *further*
   resolvers: a type-level property resolver and a catalog lookup.
3. **The DB arm needs a RUNNING DATABASE, and that is not negotiable.** The standing rule is
   that the **live catalog is the sole truth** for any schema/RLS/RPC question — never migration
   text, which is stale by design (runtime `pg_get_functiondef()` + `replace()` + `execute`), and
   which has already produced a confident **false P0** here. So the arm must query `pg_proc` /
   `pg_policies`. All five current `npm run lint` gates are **stateless static checks that run in
   a fresh worktree with no stack up**; a DB-dependent arm changes what the lint gate *is*, and
   the shared-stack constraint makes it worse.
4. ⚠ **The proposed convention-only gate does NOT work as specified**, and the error is
   instructive. `frontend` suggested checking that *"mentions of removal-set symbols carry the
   marker"*, arguing it would leave `actions.ts:309` alone *"because a live reference wouldn't
   carry the marker."* That exemption is **inverted**: `uploadDocumentFile` **is** in the removal
   set, so `:309` mentioning it **without** a marker is precisely what the rule flags. Rescuable
   with per-occurrence suppression — but the authoring burden then lands exactly on the most
   confusing case. **Also fatal to the "it's just a grep" claim:** the rule needs a *removal set*,
   which needs a **diff base** — making it a CI check, not a stateless lint gate.

**Recommendation (PO decides — it is a lint-gate change):** adopt the tombstone marker as an
**authoring convention** (zero cost, helps every reader) and **do not build a checker**. Rely on
the step that actually worked here: **at deletion time, derive the removal set from the diff
(`git diff <base>..HEAD -- src/lib` ∪ the migrations' `drop function|policy|column` statements)
and sweep it.** That is what found all seven; three prior lists built from recall found 6, 3 and
4, each bounded by a different unstated key. **Encode it as a deletion-discipline step, not a
script** — the knowledge lives with whoever removes the symbol, and no resolver reproduces it.

**If the PO still wants a checker**, it must satisfy all of: per-occurrence classification ·
family/module resolution · a catalog arm · a diff base · and a first dry-run against a
**hand-classified control** containing `actions.ts:309`, `api/documents/[id]/route.ts:46` and the
`components/forms/*` hits as **known-goods** — *a detector that finds a lot needs proving too*
([[a-detector-that-finds-a-lot-needs-proving-too]],
[[detector-that-finds-nothing-must-be-proven-able-to-find-something]]).

### 🟡 FUP-PGTAP-SAVEPOINT — ⚠ **DOWNGRADED 2026-08-13 (🔴→🟡): the original claim was WRONG. No coverage is being lost** (owner: lead + backend)

> ## ⛔ CORRECTION — read this before the original text below
>
> **Measured on a clean reset (the run this follow-up demanded): `193` → `ok`, `194` → `ok`,
> ZERO bad plans across 190 files / 6149 tests, `Result: PASS`.** The two "affected" suites are
> **not** losing assertions.
>
> **The true mechanism**, pinned by a two-assertion repro (one outside the savepoint, one inside):
> ```
> plan(2); ok(true,'A'); savepoint s; throws_ok(…,'B'); rollback to savepoint s; finish();
>   → ok 1 - A          ← emitted to stdout
>   → ok 2 - B          ← ALSO emitted; TAP output cannot be rolled back
>   → # Looks like you planned 2 tests but ran 1
> ```
> **pg_prove parses the TAP stream, not pgTAP's internal table.** Both `ok` lines are emitted at
> statement execution and survive the rollback, so **the gate's tally is correct and the
> assertion does count**. Only pgTAP's *internal* counter under-counts, producing a `#`
> **diagnostic** that pg_prove does not treat as a failure.
>
> **What IS real:** the **degenerate** case — when *every* assertion in the file sits inside the
> rolled-back region, `finish()` raises `# No tests run!`, which **does** fail the file.
>
> ⚠ **My error, recorded because it is the more useful part: I generalized from the degenerate
> case.** The original repro was `plan(1)` with its single assertion inside the savepoint — the
> one shape where the internal under-count reaches zero and becomes an error. I proved that shape
> and then asserted the general one, filing a 🔴 gate-integrity item on a mechanism I had not
> tested in the configuration the live suites actually use.
> [[the-proposal-you-author-is-the-one-you-dont-test]], again, and this time it was mine.
>
> **Residual value (why this stays open at 🟡, not closed):** the `finish()` diagnostic is
> genuinely misleading to anyone reading it, and the degenerate shape is a real hazard worth not
> writing. `330`'s captured-definition pattern remains the better style. But **nothing is
> uncovered and no prior gate record is invalidated** — the earlier `194` "planned 8 but ran 0"
> was the dirty-DB artifact, exactly as `backend` suspected and declined to attribute.
>
> The original text below is retained as written, so the correction is legible as a correction.

### (original filing, superseded above) a pgTAP assertion inside a rolled-back savepoint PRINTS `ok` but is DISCARDED from the tally; 2 live suites use the shape

Found by `backend` during DM3·M2 (2026-08-13) and **independently reproduced by the lead
the same day**, twice, against the live DB.

**The mechanism, proven — not inferred.** With `pgtap` installed, two runs differing only
in the savepoint:

```
RUN A:  plan(1); savepoint s; select throws_ok($$ select 1/0 $$,'22012'); rollback to savepoint s; select * from finish();
        → prints  "ok 1 - threw 22012"   then  ERROR: # No tests run!
RUN B:  plan(1); select throws_ok($$ select 1/0 $$,'22012'); select * from finish();
        → prints  "ok 1 - threw 22012"   then  finish() returns 0 rows (clean)
```

pgTAP keeps its results in transaction-local state, so `rollback to savepoint` unwinds its
own bookkeeping along with the mutation. **The assertion still prints `ok`.** The file then
reports `planned N but ran <N`, which a summary line can hide — this is the pgTAP twin of
the class `lint:vacuous` gates for TypeScript, and there is **no equivalent gate for SQL**.

**Live instances — a lead sweep of `supabase/tests/` found the shape in 4 files:**

| File | Verdict |
| --- | --- |
| `193_schema_integrity.sql:89-99` | ⚠ **AFFECTED** — `throws_ok` at `:93` sits inside the window. **Missed by the original report, which flagged only 194.** The enclosed assertion is a *mutation twin* (drop the twin CHECK, assert the refusal still holds) — the kind whose silent non-counting matters most, because its whole job is to prove a barrier is independent |
| `194_tenant_composite_fk.sql:87-95` | ⚠ **AFFECTED** — `throws_ok` at `:89` inside the window (its test 4.1) |
| `330_dm3_controlled_documents.sql` | ✅ **CLEAN** — its 3 hits are *comments documenting the hazard*; the suite mutates without a savepoint and restores from a **captured** `pg_get_constraintdef`, so the restore cannot drift from the real definition |
| `100_dashboard.sql:411-412` | ✅ clean — **and it already carried the explanation**: *"⛔ Deliberately NOT a savepoint. pgTAP keeps its test counter in transaction-local state, so `rollback to savepoint` after an `is()` would rewind the counter."* |

**The most useful part of this finding is that last row.** The hazard was **already known and
already written down** — as a comment in one file, where it protected that file and nothing
else. Two other suites then shipped the shape. Knowledge that lives only in a local comment
does not propagate; that is what `lint:vacuous` and the keystone discipline exist to fix, and
this class had neither. Related: [a comment is an assertion that goes stale silently].

**What is NOT yet established.** The per-suite blast radius. `194` was observed reporting
`planned 8 but ran 0` on a **dirty** local DB, and that is *not* attributed to this mechanism —
`194` is a tenant/commission-count suite and the stack carried E2E leftovers, a known
spurious-red class. The suites cannot be run raw (`test_helpers` is harness-created), so the
real numbers come from `npm run test:db` on a **fresh `supabase db reset`**.

**Discharge:**
1. On a fresh reset, capture `planned N / ran M` for `193` and `194`; if `M < N`, those
   assertions have never contributed to any gate record, and the affected keystones' prior
   green must be re-read as unproven.
2. Rewrite both to `330`'s pattern — mutate without a savepoint, restore from a captured
   definition, and keep the file-level `rollback` as the outer restore.
3. **Add the missing gate.** A `lint:vacuous`-style check for pgTAP: flag any assertion
   between `savepoint` and `rollback to savepoint`, and/or assert `planned == ran` per file
   rather than trusting the summary. Without step 3 this recurs — it already did, twice,
   after being documented once.

### 🟡 FUP-DM3-ETHICS-UI — no UI can attach a decision letter to an ethics case; DM3 ships both seams writable via the API only (owner: PO, a feature phase)

Filed 2026-08-13 at DM3 open, as the recorded half of a PO scope ruling. **This is a
decision, not an omission** — a later reader finding two write-only columns must land here
rather than infer neglect.

**What DM3 does ship** (ADR 0114 Amendment 2 / D17, conditions 1–5): both
`ethics_decision_details.decision_letter_document_id` and
`ethics_notifications.related_document_id` get a real FK to `documents(id)`;
`issue_ethics_notification`'s fail-closed rejection is removed and keystone K8 with it;
and `set_ethics_decision_details` gains `p_decision_letter_document_id`, forwarded from
`src/lib/ethics/actions.ts`. After DM3 the seams are genuinely writable document-model
citizens **through the API**.

**What it does not ship, and why.** No attach-a-letter affordance. None has ever existed —
verified 2026-08-13 on five independent lines: no writer passes either field (the only
callers are `ethics-decisions-panel.tsx`'s 10-key payload and
`ethics-notifications-panel.tsx`'s 5-key payload); no form control exists in either dialog;
`type="file"` appears in 7 components repo-wide and **none** under `src/components/ethics/`;
nothing in `src/` *reads* either field off a value, so even a populated column would change
no pixel; and `e2e/ethics-e2-procedure.spec.ts:55-56` already declares the Stage-E
legal-privileged decision letter unbuilt.

A decision letter is the **archetypal `legal_privileged` document**. Its UI is therefore not
a form field — it needs the ADR 0072 / ETH·E1 access spine (`case_access_grants` +
`max_confidentiality` + recusal), the D15 confidentiality ceiling, and E2E coverage that
does not exist today. Appending that to a migration wave is how the most security-sensitive
surface in the phase gets the least design attention.

**Discharge = a feature phase that designs the affordance against the ETH·E1 spine**, with
its own threat model and E2E. Until then the columns are write-only by design.

### 🟡 FUP-ETH-KBD-1 — the professional lane's `TypeaheadField` mount is keyboard-UNTESTED, so BUG-ETHE4-FOCUS-1's defect is not ruled out there (owner: frontend + tester)

Carried out of **BUG-ETHE4-FOCUS-1** when that bug was rotated to
[bug-log-archive.md](./bug-log-archive.md) on 2026-08-12. It was filed inside the bug as *"not
confirmed, flagged as a hypothesis for whoever fixes it"*; archiving it under the bug's ✅ would
have converted an open question into an apparent closure.

**The gap.** `TypeaheadField` is shared by three mounts — "Buscar profissional", "Buscar
participante externo", "Usuário da plataforma". The FOCUS-1 fix (defer `setOpen(false)` one tick +
`suppressEscapeWhilePopupOpen`) was applied at the component root and all three mounts were
tab-counted after the fix, so this is **not** a suspected live regression. What is untested is the
*pre-fix* question the bug never answered: `PROF-PICK` / `PROF-CREATE` drive the professional lane
**by mouse only**, so no spec has ever keyboard-navigated it end-to-end. There is no KBD-1
equivalent guarding that lane against a future reintroduction.

**Why it is worth an item rather than a shrug.** QA's **m8** found *both* FOCUS-1 root causes
(synchronous `onBlur={settle}` at `evidence-picker.tsx:437`, no `onEscapeKeyDown` suppressor) in a
second, unrelated dialog — flagged structurally, never verified live. The pattern recurs in places
nobody has keyboard-tested; the mouse-only coverage is how it stays invisible.

**Disposition (cheap):** extend the professional lane with a KBD-1-shaped assertion — tab-stop
count plus Escape-does-not-reset-the-lane — and decide separately whether `evidence-picker.tsx`
gets the same treatment. Needs a tester-owned spec change; note FUP-ETH-A11Y-1's m4 warning that
these routes collide with `pickFromTypeahead`'s locators, so the two items should be scheduled
together.

### 🟡 FUP-ETH-A11Y-1 — the ETH·E4 dialogs: error text is never `aria-describedby`-wired, and the typeahead announces neither loading nor result count (QA m3 + m4; owner: frontend + tester)

> ✅ **BUILT in the working tree 2026-08-12 (`frontend`) — NOT committed. Awaiting the tester
> batch.** m3: both files now pass `hasError`/`hasDescription` into `useFieldIds`, spread
> `controlProps`, and put `id={errorId}` / `id={descriptionId}` on `FieldError` /
> `FieldDescription`; the checkbox-GROUP error in `case-participant-role-manager.tsx` hangs off
> the `<fieldset>`'s own `aria-describedby` (a 3rd site QA's count of 2 did not include).
> Verified live by submitting an empty "Novo papel": every emitted `aria-describedby` resolves to
> a real `role="alert"` node carrying the pt-BR message.
> **m4 route chosen: (a) a separate `sr-only` `role="status" aria-live="polite"` region, worded
> so it duplicates NO visible string** — the listbox's `aria-label` (`Opções para {label}`), which
> `pickFromTypeahead` scopes on, is byte-for-byte unchanged, and route (b) was rejected for that
> reason. New strings, all `sr-only` and all previously absent from the DOM:
> `"Carregando resultados…"` · `"1 opção disponível. Use as setas para navegar e Enter para
> escolher."` / `"{n} opções disponíveis. …"` · `"Nenhuma opção disponível."`. The error path
> announces nothing (the visible message already carries `role="alert"`), and a query below the
> 2-character floor announces nothing (a `null` `emptyAnnouncement`), so no claim is made about a
> search that never ran. Verified live: `"Nenhum resultado. Você pode cadastrar um novo."`,
> `"Digite ao menos 2 letras para buscar."` and `"Buscando…"` each still match exactly ONCE.

**m3 — `aria-describedby` never reaches the error id.** `useFieldIds`
(`src/components/ui/field.tsx:103-133`) already emits `descriptionId`, `errorId` and a
composed `aria-describedby`, but every ETH·E4 call site passes only `.controlProps.id` and
hand-sets `aria-invalid`: `add-participant-dialog.tsx` (2 sites) and
`case-participant-role-manager.tsx` (2 sites, one of which wires `descriptionId` but never
`errorId`). `FieldError` carries `role="alert"`, so the message **is** announced when it
first appears — the gap is that a user who tabs **back** to the invalid field hears the label
and nothing else. CLAUDE.md §8 requires accessible inputs.
Fix shape: pass `hasError`/`hasDescription` into `useFieldIds`, spread `controlProps` instead
of picking `.id`, and put `id={errorId}` on `FieldError` / `id={descriptionId}` on
`FieldDescription` (neither auto-wires — both are plain `<p>` pass-throughs).

**m4 — the typeahead popup has no live region.** `add-participant-dialog.tsx:391-407`:
*"Buscando…"*, the empty hint and the result list are plain nodes **outside** the listbox
that `aria-controls` points at, with no `aria-live`/`role="status"`. Only the error path is
announced (it has `role="alert"`). Keyboard operation and the rest of the ARIA structure are
complete and correct.

⚠ **Why this was filed rather than fixed inside ETH·E4 (lead, 2026-08-11).** m4 cannot be
closed without either (a) new visually-hidden text, which risks duplicating the existing
visible strings — `"Nenhum resultado. Você pode cadastrar um novo."` and `"Buscando…"` — into
a second `getByText` match and redding the suite on strict mode, or (b) folding the count into
the listbox's `aria-label`, which is the exact string `pickFromTypeahead` scopes on (QA r2
confirmed the app really does set it). **Either route needs a coordinated spec change, which
is tester-owned**, so doing it as a lead edit at the tail of the gate would have put churn
into the locators this phase had just finished stabilizing. m3 is attribute-only and safe on
its own, but it belongs with m4 as one a11y pass. Both are QA-rated MINOR and non-blocking.

### 🟡 FUP-E2E-SERVER-DEAD-1 — the prod-standalone server dies under load in ~3 of 17 batches, and `BATCH_TESTS=22` is the known rescue (owner: unassigned)

Filed from the ETH·E4 handoff §3, where it was called out but never given an id. In one
`e2e:prod` run, batches **5, 16 and 17 all hit `server_dead=1`**; 5 and 17 recovered on the
automatic `INFRA_RETRY`, **16's retry died too**, leaving 69 tests with no verdict and turning
a run with **zero assertion failures** into a RED gate. The rate is drifting: 1 of 17 earlier
the same day, 3 of 17 by evening.

Known-good workaround, used successfully **twice** on two different dead groups: re-run the
group alone at `BATCH_TESTS=22` (smaller batches ⇒ more frequent server restarts). The
Flexible-Forms group (`ff1`–`ff5` + `flagged-aggregate-result`) stresses it regardless of
batching — its own sub-batches hit `server_dead` and recovered.

**This is an infrastructure characteristic, not a product defect** — no assertion has ever
failed in one of these batches. It is filed because it costs a full gate re-run each time it
bites, and because "infra is not a pass": a batch that never produced a verdict must not be
read as green.
### 🟡 FUP-ACT-HATLESS-AUDIT — a hatless read's audit row omits the `acting_as` KEY, and absence has three meanings (S4 QA MINOR-6; owner: backend)

Catalog-verified in `app.audit_write`:

```
v_acting_as := app.active_role();
if v_acting_as is not null then
  v_metadata := v_metadata || jsonb_build_object('acting_as', v_acting_as);
end if;
```

The key is **absent, not null**. So for the hatless-grantee path — which under ADR 0106 D5/D6
as built retains read-only per-case reach **including `read_standard_phi`** (keystone `319`
A13; the Rule-12 read this platform most needs to reconstruct later) — the trail cannot
distinguish *"no hat was worn"* from *"pre-ACT row"* from *"written by a service-role/system
path"*.

**Not a violation and not blocking:** Rule 11 is met (the row records *that* and *who*;
`acting_as` is an ADR 0106 addition, not a Rule 11 requirement). This is **legibility** —
recording hatlessness explicitly (`'acting_as','none'`, or a `hatless: true` marker) turns an
inference into a fact for a few characters.

⚠ **Travels with the A13 ruling** (ADR 0106 D5/D14, S4 QA §3): if the PO ever rules that
hatless principals must lose relationship-derived reach, this class of row stops existing and
the follow-up dies with it. Do not implement it ahead of that ruling. Needs a migration —
deliberately out of S4, which shipped none.

### 🟡 FUP-PDF-4 — verification rate limiter: comment FIXED, availability lever still OPEN and re-scoped (QA P1 MINOR-3; owner: backend)

⛔ **The filed premise was wrong in a way that mattered, corrected 2026-08-11 against the code.**
The entry said the limiter is *"one **global** 60/min counter"* and prescribed *"per-credential
granularity (keep the global cap as a backstop)"* — **that is already exactly what ships, and
has since the original commit `e1daba9`**: `PER_CREDENTIAL_LIMIT = 5` over a `perCredentialHits`
map, plus the global 60 backstop. Anyone executing the prescription literally would have written
a no-op and closed the item. The lesson is the standing one: **a prescription in a follow-up is a
claim about the code and ages like one** — re-measure before implementing, not after.

**DONE:** the false *"the page shows it verbatim"* comment is corrected. Confirmed against
`src/app/(public)/verificar/[token]/page.tsx:84-90`, which catches **every** error, logs it, and
returns `{ state: "unavailable" }` — so `VERIFICATION_RATE_LIMIT_MESSAGE` is never rendered and
reaches only the server log. (The comment-asserting-an-untruth family, invisible to every gate.)

**STILL OPEN — the availability lever, correctly described:** the per-credential arm bounds
brute-forcing ONE code; it does nothing about the actual DoS. One visitor cycling ~12 distinct
credentials × 5 each exhausts the **global** 60/min budget and throttles *every* anonymous
visitor on the public `/verificar` surface. Both windows are also module-level process memory, so
they are per-PROCESS — N app instances mean N× every budget.

⚠ **Deliberately not fixed in the FUP quick batch, because neither half is guessable:** closing
it needs per-**client** granularity (which needs a *trusted* client identity — `x-forwarded-for`
is only as trustworthy as the proxy in front of it, a Coolify deploy decision, ADR 0059) **plus**
shared cross-process state. Both are decisions, not code. The limitation is now recorded in the
module docblock so the next reader does not re-derive it. The RPC stays service_role-only.

### ⬛ FUP-QOB-3 — RESOLVED 2026-08-09: `dispose_event_phi` KEEPS its tenancy arm, and referral disposal gets the same backstop BACK (PO)

**PO ruling 2026-08-09.** The finding was framed as "event is the odd one out" — investigating it
inverted that: **event was the one that got it right**, and the same-day BUG-QOB-004 cut had gone
one step too far on the referral plane.

**Two facts decided it, neither available when BUG-QOB-004 was ruled:**
1. **A hospital can have ZERO NSP operators.** Measured: `Hospital Unico C` has none, and NSP
   staffing is a separate onboarding step. NSP-only disposal leaves such a hospital unable to
   honour an **LGPD Art. 18 erasure request** — an obligation that sits with the ORGANIZATION
   (the *controlador*), not with a clinical nurse.
2. **This platform already rules the other way for acts of this shape.** ADR 0104 D11 keeps the
   tenancy arm on `revoke_printed_document` because revocation is a **governance act that reveals
   no content** — guarded by pgTAP `314` 8.5. Disposal is identical in shape: it discloses
   nothing, it destroys. D5's "zero PHI bits must not destroy Rule 12 data" guards against
   destroying what you cannot verify; that is a real concern, and it is the same one D11 already
   weighed and answered.

**Executed (`20260917000400`):** the tenancy arm is restored on `dispose_referral_phi` +
`can_dispose_referral_phi`. **`create_referral_draft` stays CUT** and the **UI wall stays** — the
backstop is disposal-only. ⚠ For a BARE tenancy admin the capability is therefore reachable only
out-of-band; that is deliberate and recorded, unlike BUG-QOB-004's accidental orphan. A tenancy
admin who is also a committee member reaches it normally.

**Guarded so it cannot be re-cut by symmetry:** `314` **8.6** (all three disposal doors keep the
arm) + **8.7** (drafting stays cut) + `295` **§7.7** flipped to assert the backstop behaviourally.
Red-proven: re-cutting the arm reds both 7.7 and 8.6 and nothing else.

**Also fixed in the same wave — three stale pt-BR messages, one per direction:**
`dispose_referral_phi` (fixed in `…000000`, re-fixed here), `dispose_case_phi` (**promised** an
org-admin arm QO·B had removed) and `revoke_printed_document` (**hid** the tenancy arm it carries).
⚠ The class: *every* time an arm moved, its sentence stayed. Invisible to every gate in the repo —
no test reads prose — and user-facing in both harmful directions.

Found by the **sibling-coherence check** run immediately after `20260917000000` landed — i.e. by
asking "what do this door's siblings look like now", not by anything in the ruling's own scope.
Measured live (`pg_get_functiondef`), all six disposal doors:

| Door | tenancy arm | PHI module (Rule 12) |
| ---- | ----------- | -------------------- |
| `dispose_case_phi` | ✗ cut (D5) | case |
| `dispose_referral_phi` / `can_dispose_referral_phi` | ✗ cut 2026-08-09 | referral |
| `dispose_attachment_phi` | ✗ none | — |
| **`dispose_event_phi`** | ✅ **LIVE** | **patient-safety / NSP** |
| `dispose_meeting_minutes` | ✅ live | not a PHI module |

**The finding:** D5's ratified reasoning — *"a principal with zero PHI bits does not destroy Rule 12
data"* — is what put `dispose_case_phi` on the CUT side, and it is what the PO applied verbatim to
the referral plane on 2026-08-09. It applies to `dispose_event_phi` **identically**: patient-safety
is PHI module 1, and a bare tenancy admin holds no PHI bits there either. So of the three Rule-12
modules, two now deny the tenancy tier its disposal arm and one still grants it — a split produced
by the order the rulings happened in, not by any decision about NSP.

**Corroborating tell:** `dispose_event_phi` still carries the pt-BR message *"apenas um administrador
da organização ou o NSP pode descartar dados do paciente"* — the exact sentence
`dispose_referral_phi` had to shed in the same wave because the cut made it false. It is currently
still TRUE for `dispose_event_phi`, which is the point: the two doors were written as a pair and have
now diverged.

⚠ **Deliberately NOT acted on.** It is outside the BUG-QOB-004 ruling, and cutting a live capability
unasked is the standing trap in the other direction — *conferring or removing a capability requires
enumerating its consumers*. `dispose_meeting_minutes` is a separate question and probably a genuine
KEEP (meeting minutes are a governance artifact, not one of the three PHI modules) — do not sweep it
in reflexively with the NSP call.

**To close:** a PO ruling on `dispose_event_phi` only — CUT (D5 consistency across all three PHI
modules) or KEEP-with-a-recorded-reason (NSP disposal is genuinely a tenancy-tier duty). Whichever
way, the pt-BR message must end up matching the arms. Owner: **PO**, then backend.

### ▶ FUP-MIN-CUTOVER — audio-minutes pre-enable gates (feature merged, flag OFF)

Owner: lead + human. Before the pilot flag flips (runbook §6 checklist is authoritative):
- [x] **Remote `db push`** — ✅ DONE (discovered already applied; catalog-verified 2026-08-06:
      302/302 migrations incl. AFF `20260909*` + MIN `20260910000100–400`, all 13 MIN functions
      in remote `pg_proc` with expected `prosecdef`, `meeting-audio` bucket cap 524288000).
      The deployed-`main`-breaks warning is closed.
- [ ] **Cloud storage upload cap** — ⛔ **BLOCKED, human decision**: org `Rede Madre` is on the
      **Free plan** (checked 2026-08-06) → 50 MB hard cap; 500 MB needs a **Pro upgrade**, then
      raise the dashboard storage limit and record it in runbook §2 (blocker recorded there).
- [ ] **T5 manual smoke** — plumbing ✅ DONE 2026-08-06: `minute_generator/.env` + platform
      `.env.local` `MINUTES_*` share minted secrets; smoke doc authored
      (`docs/testing/audio-minutes-smoke.md` — was referenced by runbook §6 but never existed);
      §3 webhook probe → 401 ✓; local storage container live-verified at 512 MiB. **Run blocked
      on human**: fill `ANTHROPIC_API_KEY` + `ASSEMBLYAI_API_KEY` in `minute_generator/.env`,
      supply a 1–3 min non-medical pt-BR audio, flip `MINUTES_SERVICE_URL` :8891→:8000 for the
      session (smoke doc has the full recipe).
- [x] **QA r2 residuals R1 + R3** — ✅ fixed 2026-08-06. R1: accessible name is now
      `Anexar a um item: "<resolução>" a "<item>"` — unique per card AND the visible label is
      the prefix (closes the pre-existing WCAG 2.5.3 gap QA's prescribed format would have kept).
      R3: `server-only` reverted on `src/lib/audio-jobs/hmac.ts`; E2E helper imports the real
      `signCallbackBody` (D16 restored); `docs/backend-state.md` updated. MIN spec 10/10 green
      (chromium, fresh reset).
- [ ] **R2** — the ≥8-tests click-delivery anomaly: did NOT reproduce on the 2026-08-06 rerun
      (10/10 first-attempt); still owed one look on different hardware before the pilot.
- [ ] Env vars on the deploy target: `MINUTES_SERVICE_URL/_API_KEY`, `MINUTES_CALLBACK_HMAC_SECRET`,
      `MINUTES_CALLBACK_BASE_URL` (runbook §3) — mint NEW production secrets, never the local
      smoke pair; plus the service itself deployed (`docker-compose.coolify.yml`) with its DPA
      gates closed (runbook §6).

<!-- OPEN backlog only (reviewed at each phase start). Resolved [x] items archived →
     docs/progress/follow-ups-archive.md (full snapshot). -->

### 🟢 FUP-QO-6 — oversight-toggle slow-confirm: **annoyance severity ACCEPTED provisionally (PO ruling 2026-08-07)**; open LOW priority, DB-vs-UI formally unclassified

**PO ruling 2026-08-07 (D-FUP-6b):** after 16 total trials with 0 recurrences (15 isolated +
1 full-load gate with a continuous ~12,100-sample out-of-process poller — see the Test Run
Summary row), the stale-UI (annoyance) assumption is **accepted provisionally for the pilot**.
The lost-write question stays formally open at LOW priority; nobody manufactures a
classification. If it recurs, the recorded next step is a targeted 20–30× repeated-trial run
of the D9 test alone under artificial contention with a **sub-second** poller (the ~1.6 s
interval aliases past the flip — proven this run). ⛔ The original "do not fix by raising the
timeout" stands. Original record + diagnostic history below.

<details><summary>Original entry (2026-08-07, pre-ruling)</summary>

### the oversight toggle intermittently fails to confirm within 10 s; DB-vs-UI unclassified

Found by `tester` once its restore check stopped trusting optimistic client state. **Pre-existing —
not introduced by QO·A, and invisible until now BY CONSTRUCTION**: the previous check read
`CommissionOversightToggle`'s optimistic value, which updates synchronously before the server action
starts, so it reported success every time regardless of what the server did. Making the check honest
is what surfaced this.

**Signature (consistent, ~3 failures in ~13 early attempts, ≈23%):** a failing run takes **~11.5 s**
against **~2.5–3.0 s** on a pass — the reload-based assertion burning its full 10 s timeout. So the
confirmation is *not* being read too early; the state genuinely is not observable within the window.

⚠ **The decisive fact is NOT established.** At the moment of failure, is the DB correct with the page
stale, or **did the write never land**? That distinction is the whole severity question: stale UI is a
known annoyance here, but an intermittent write failure means **D9's governance control silently
no-ops ~1 in 4 times** and an admin would believe a committee is under oversight when it is not.

A bounded diagnostic (15 isolated runs + an out-of-process ~1.4 s DB poller, 216 samples) came back
**15/15 PASS — unreproduced**. The only `excluded` readings were the expected mid-test transients of
passing runs. `tester` stopped at the bound rather than extending, and reported the absence of the
fact instead of manufacturing one.

**The streak is itself evidence.** P(0 failures in 15 trials) at a constant 20–25 % rate is ~1.3–3.5 %.
The likeliest reading is that failures **cluster with environmental contention** rather than being
independent per-trial draws — the diagnostic ran isolated and unloaded. Consequence for the gate:
`RETRIES=1` retries moments after the first attempt, i.e. under the *same* conditions, so the naive
~6 % residual-spurious-red figure is an **optimistic floor, not a ceiling**.

⛔ **Do not "fix" this by raising the timeout** — that hides precisely the question above. Next step is
to reproduce under **load** (during a full `e2e:prod` run, not in isolation) with the out-of-process
poller attached, then classify. In-browser instrumentation is useless here: it perturbed the measurement
(6/6 green with logging on, recurrence once removed).

**F6 result (2026-08-07, tester, under real full-gate load): still NOT REPRODUCED.** `quality-oversight.spec.ts`
ran once inside the full `e2e:prod` gate (batch 16, 87-file suite, `RESET=1`); all 4 D9/D10 toggle tests
passed clean — WRITE PATH 1.5s, READ PATH 1.6s, D10 WRITE 1.3s, D10 READ 1.9s, none near the ~11.5s
failure signature. The out-of-process DB poller (docker-exec psql against `commissions.quality_oversight`,
~1.2–1.6s interval, continuous 13:52:44–16:12:5x UTC, ~12,100 samples, 0 gaps) recorded **zero `excluded`
samples for `ccih`** across the whole batch-16 window — the WRITE-PATH test's flip + `finally`-block revert
completes faster than the poller's sampling interval, so this is aliasing (too fast to catch), not a
failed-to-flip signal; the DB row that WAS sampled around the test window read `visible` with a fresh
`updated_at` consistent with a clean, fast round-trip. Extends the non-reproduction streak to 15 isolated
+ 1 full-load run, 0 failures. **The severity question remains formally open** — this run did not supply
a failure to classify, and no classification is manufactured in its absence. Evidence + poller logs:
`docs/../PROGRESS.md` Test Run Summary (2026-08-07, "QO·FUP F6"); raw poller logs are in the tester's
scratchpad (not committed — out-of-band per the task's own instruction), `oversight-samples.log` /
`oversight-samples-resume.log`.

</details>

### 🟡 FUP-AFF-3 — pin door ACLs by DERIVING the door set, not by remembering it (2026-08-06)

Raised by `backend` at AFF close-out, and it is the **class** behind QA's N2. `302` §1's ACL
assertions covered "the doors that existed when §1 was written"; `log_cpf_probe_for` arrived two
commits later and **inherited nothing** — its ACL is its *entire* boundary (it fronts nothing, it
writes one audit row), so the one property most worth pinning was the one unpinned. Fixed for that
instance in `304` §9; the class is open.

⚠ **This is the third and fourth instance of the same failure inside one workstream** — the others
being F2's error-code detector (bounded by a 5-char syntax, so it could not see `check_violation`)
and `backend`'s own case-sensitive diff-derivation grep (which listed 1 of 4 changed gates, because
`pg_get_functiondef` emits uppercase — ADR 0079 Amendment 5a). Every instance is the recorded rule:
**an enumeration's boundary must be the property, not a syntax and not a remembered list.**

Proposed scope: one assertion that derives the door set from `pg_proc` — every `public` `prosecdef`
function granted to `service_role` must **not** be executable by `authenticated` — replacing the
per-door transcription. Needs its own allowlist discussion (legitimate dual-audience doors exist),
which is why it was flagged rather than widened into AFF unasked.

### 🟡 FUP-AFF-4 — make the membership-role list a Postgres ENUM (2026-08-06)

Raised by `backend`, and it is the durable fix for N1. `memberships_role_check` is a `CHECK` over
`text`, so the role list reaches **no** generated type (`grep technical_director_deputy
src/lib/types/database.ts` → 0 hits) and **no unit test can see the authority**. N1's remedy is a
committed fixture with a gate at each end (pgTAP `304` §10 ↔ fixture ↔ the pt-BR label test) — which
closes the drift hole, but is a **build-time gate, not a guard**: widen the CHECK, never regenerate
the fixture, ship without `npm run test:db`, and an English snake_case identifier still reaches a
pt-BR `role="alert"` through `roleLabel`'s `?? role` fallback.

As an **enum**, the list lands in `database.ts` and `tsc` enforces exhaustiveness — the check moves
from "a suite someone must run" to "the build". Deferred because it is a schema change with real
blast radius (`memberships_scope_shape`, every `role` comparison, the ADR-0094 completeness grid).
Decide before the role set next changes, not after.

### 🟡 FUP-AFF-2 — D7's "documented escape for a foreign professional" is unreachable (2026-08-06)

Raised by `backend` at W3 close-out. ADR 0097 **D7** makes `profiles.cpf` nullable *specifically* so a
foreign professional without a CPF can be registered "without a later schema change" — and then
requires CPF **at the action layer**. W3 implemented the requirement (correctly: without it the
identifier-first flow creates people no later CPF lookup can find, and the feature is inert on exactly
the population it exists for). **Net effect: the nullable column's escape has no product path.**

That is D7's own design, not a defect, and it is the right default — but it is recorded here because
the day the first customer has one foreign professional it becomes a real gap, and the fix should be a
**deliberate "sem CPF" affordance** (audited, org_admin-only, with the person still findable by name)
rather than a panicked schema change. Blocks nothing. Decide before the pilot onboards clinical staff,
not after.

### 🟡 FUP-SILENT-READ-1 — ~207 PostgREST reads never destructure `error` (2026-08-11, lead)

Surfaced during ETH·E4 when `tester`, enumerating the blast radius of the
`professional_profiles` column-list grant, noticed `getCaseDetail`'s professional embed
(`src/lib/queries/cases.ts:1358`) never destructured `error`. On any failure `profRows` is
null, `?? []` yields an empty map, and every professional participant renders with
`prof = null` — the roster silently falls back to the mint-time `display_name` snapshot,
`professionalProfileId` goes missing, and **`linkState` is undefined so the "Resolver
vínculo" affordance simply vanishes.** No error, no log, no visible failure: a deleted
feature that looks like an empty state.

**Fixed in-phase, all three ETH·E4-authored instances** (`7e55f01`): that embed, plus
`members.ts` `listLinkableOrgUsers` (an empty user list is indistinguishable from "no
account" — walking the coordinator to `no_account`, which makes the case exclusion
vacuously satisfied; the same class as QA's MAJOR-2, inside the very function written to
close the previous instance of it) and `vocabulary/actions.ts`
`listCaseParticipantRolesForAdmin`. ETH·E4-authored code is at zero.

**The repo-wide residue is this follow-up.** A cheap sweep counts **~207 of 773**
PostgREST destructures (~27%, ~40 modules — `rca.ts` 14, `capa.ts` 13, `referrals.ts` 10,
`cases.ts` 10). ⚠ **That is NOT a count of 207 bugs** and must not be cited as one. It is
pre-existing house style, and most instances are probably deliberate "return `null`/`[]`
on failure" reads. The ones that matter are only those where **an empty result is
semantically different from an error and the UI cannot tell them apart** — which is what
made the three above real. Separating those needs per-call-site judgement, not a regex:
the sweep is cheap, the triage is not.

⚠ The sweep script had a real bug before its numbers were trusted — line numbers were
computed on comment-**stripped** source, shifting every offset after the first comment.
Fixed by blanking comments length-preservingly (self-test 4/4); the count moved 210 → 209,
which is why ~207 is quoted as heuristic rather than audited. Script in `backend`'s
scratchpad. Owner: unassigned — needs a triage decision before anyone starts.

### 🔴 FUP-AFF-1 — the authz census is BLIND to write-path doors (2026-08-06, lead)

Recorded as ADR [0079](../decisions/0079-authz-door-blindness-standing-invariant.md) **Amendment 5**.
**Does not block AFF** — but AFF's gate record must **not** cite `ARM=census` as coverage for its
affiliation doors; it must cite `302_affiliation_doors.sql`'s mutation-proven keystones, which do
cover them in substance.

Found when `backend` noticed a diff-scoped `ARM=policy` run reporting **0 BLIND over five brand-new
DEFINER doors having swept none of them** — the boolean arm printed empty because they return
`uuid`, not `boolean`. The hole is wider than the observation, measured from the live catalog:

- **ARM 3's LIVE domain** is `prosecdef` functions that return `bool` **or** are set-returning +
  `authenticated`-executable, plus all RLS policies. A **scalar/void-returning write-path door is in
  none of those sets** — so `ARM=census` reports HOLDS **because the door is invisible, not because
  it is accounted.** That is Amendment 3's vacuity, recurring in a shape its own filter cannot express.
- **ARM 1's write-path sweep exists and is the right harness**, but its domain is **two frozen
  enumerations** — a hand-written list of **7** named raise-guards and a **captured snapshot** of 33
  write policies embedded in the script. Nothing added since has ever entered it. ("A remembered-doors
  allowlist is blind in exactly the case that matters" — now at the harness level.)
- **Measured blast radius:** filtering by the *property* instead of the return type — `prosecdef`,
  `authenticated`-reachable, scalar/void, comment-stripped `prosrc` both naming an identity primitive
  **and** raising `42501`/`HC*` — yields **201** functions. **6** are named in any findings report.

⚠ **Not a claim that 201 leak.** Most are covered in substance by keystones asserting through them.
The claim is narrower and worse: they carry **no sweep verdict**, and the arm whose whole job is to
detect a missing verdict cannot see that one is missing. Two caveats so the fix doesn't inherit a
false premise: the 201 is a regex *candidate* set, not a classification (`--` comments stripped,
`/* */` not), and the class is **not per-function** — AFF's gate lives in an owner-only kernel
(`app.*_impl`, ACL `postgres=X`) while reachability lives in its `authenticated` wrapper, whose body
names no identity primitive, so a per-function domain misses that door **from both ends**. The domain
has to follow the call edge, which is why this is harness work and not a filter tweak.

Scope when scheduled: derive the write-path domain from the catalog by the property (following the
wrapper→kernel call edge), fold it into ARM 3's LIVE set, and give `p0-authz-writepath-audit.sh` a
derived worklist in place of its two frozen enumerations. ⚠ **Dry-run the detector against a
hand-classified sample before believing it** — Amendment 4's harness reported 0 guards in all 45
doors and was completely wrong, and "no write-path door needs a verdict" is exactly as coherent a
false result.

_Closed 2026-08-04, rotated → [follow-ups-archive.md](./follow-ups-archive.md):_
**FUP-P16-1** (14 never-called doors failing the ADR 0079 floor — RESOLVED; `ARM=floor` now reports
`INVARIANT HOLDS`, nothing was allowlisted, and writing the positive twins found **3 doors whose
AUTHORIZED path could never succeed**. ⚠ Keep the mechanic: `pg_stat_user_functions` does not count a
call that raises, so **a deny-only keystone cannot clear the floor** and a permanently-throwing door
reads as *never called* rather than *failing*) · **FUP-P16-3** (`copy_version_children` temp-table
concern — INVESTIGATED, **not a bug**; ⚠ confirming a *pattern* is present is not confirming the
*defect* is present).

### 🔴 FUP-PCITV-1 — PCI + TV: what QA APPROVED **over**, ranked (2026-08-05)

QA r2 approved with 7 items open. None blocks the merge; **two block a clean deploy story** and are
called out in the Phase Status caveats above. Owner: unassigned unless noted.

| # | Sev | Item |
| - | --- | ---- |
| 1 | ⬛ | ~~**`ARM=census` never run**~~ **CLOSED 2026-08-05** — the arm landed with the membership-hardening merge and was run against the merged catalog. It found real debt, not nothing: `process_template_versions_{select,staff_admin_write}` carry **no verdict from any sweep**. TV swept and keystoned the six CHILD policies on `process_template_{phases,narratives,outcomes}` (`dcc5a4d`) and not its own PARENT table's two — *a new door must inherit every sibling arm*, one level up. Registered as `gate:` debt in `authz-unswept-backlog.txt`. The ghost-check also named all five `validate_template_*` signatures ADR 0096 re-keyed to `p_template_version_id`. |
| 2 | ⬛ | ~~**TV backfill never exercised** — rehearsal + snapshot blocking before `db push`.~~ **CLOSED (PO, 2026-08-05): the remote is EMPTY**, so the backfill meets 0 rows there exactly as it does locally. Not blocking. See the Phase Status caveat for the mechanism (which recurs) and for the unverified-premise error that produced this row. |
| 3 | ⬛ | ~~**Revoke residue**~~ **CLOSED 2026-08-18 — swept (first-party) AND accepted in writing (platform), which is exactly the disjunction this item demanded.** `20260928000900` revoked TRUNCATE from anon+authenticated on **63** postgres-owned tables (0 remain); pinned by pgTAP `191` §5, property-bounded by OWNERSHIP so a new first-party schema is covered on creation, with a two-direction falsifiability control. ⛔ The platform half (`storage.*`, `net.*`) **cannot be revoked by us** — see the block below. |
| 4 | ⬛ | ~~**BUG-RCA-001**~~ **CLOSED 2026-08-05** — PO ruled the interview's date is the **earliest session's `scheduled_start`**; fixed, PostgREST-verified, and the ruling pinned by `rca.test.ts` (5 cases, mutation-proven per arm). See the Bug Log. |
| 5 | 🟢 | Audit mesh **2 of 7** trigger arms keystoned (`20260906000200`). |
| 6 | 🟢 | The `is_commission_admin_of` disjunct in the 6 new tenant-isolation keystones is **unexercised** — no org-admin persona exists in the test bootstrap. Adding one lifts several suites at once. |
| 7 | 🟢 | `compute_case_phase_result` / `sync_case_phase_on_submit` still force the `in_case_rpc` GUC off (fails **closed**). · Resolver error semantics: helpers now log, but still collapse "not found" and "query failed" into one return — the discriminated-union refactor was deliberately deferred as too risky post-green. |
| 8 | 🟢 | **A FIFTH rebuild-property-loss, inside the migration written to close that class.** `20260907000700` recreated 10 policies on the 5 re-keyed relations **without the `TO authenticated` clause the originals carried** (`20260821000000` wrote `for select to authenticated`; the swap wrote bare `for select`). Platform split is **256 `{authenticated}` vs 11 `{public}` — and 10 of the 11 are these** (the 11th, `case_referral_delete_draft_source`, pre-dates the phase). `20260907001200` caught the ACL and `DEFERRABLE` losses and missed this one. **Verified INERT, twice:** `anon` holds **0 table grants on the 5** — and **0 anywhere in `public`** — so a bare policy still only ever evaluates for roles that either carry `BYPASSRLS` or cannot reach the table. Not a vulnerability; a latent widening if `anon` is ever granted anything. Normalize when one of these policies is next touched. ⚠ Same standard-consistency point as row 3: this phase refused the "unreachable" argument in `20260906000600`. |

| 9 | ⬛ | ~~**`296` suite-number COLLISION between branches.**~~ **CLOSED 2026-08-05** — resolved during the merge, not before it: the branch had committed by then, so it came through as a two-file collision on one number. Renumbered to `supabase/tests/298_authz_p0_isolation.sql`, with the Batch-4 runner in `p0b-isolation-mutation-audit.sh` following it. (A third collision was then created and caught in the same session — `299_hospital_content_door_noun_rule.sql` was first written as `284_`, which `284_accreditation_hospital_readiness.sql` already held. Check the directory before picking a number.) |
| 10 | 🟢 | **PROGRESS.md is 105 KB against the <60 KB target** (CLAUDE.md §7 — every spawn pays for it). This phase's rotation took it from 111.6 KB, so the trend is right but the gap is not closed. Next rotation should take the `📋 Remaining pre-pilot work` and closed-bug sections. |

> ### ⬛ Item 3 (revoke residue) — CLOSED 2026-08-18, and the platform half is an ACCEPTANCE, not a sweep
>
> **Swept.** `20260928000900_revoke_truncate_residue.sql` — TRUNCATE revoked from `anon` +
> `authenticated` on the **63** postgres-owned tables that still held it (the residue
> `20260711000100` left behind when it flipped the *default* but did not sweep existing tables).
> Pinned by pgTAP **`191` §5**, all 194 files / 6406 assertions green.
>
> ⭐ **Why this grant was worth more than its 🟡.** The item graded it on RLS bypass. The bigger
> consequence went unnamed: **TRUNCATE fires no DELETE trigger**, so it also walks past every
> statement-level `AFTER DELETE` guard — including `storage.protect_delete`. Measured 2026-08-18:
> a bare `DELETE` on `storage.objects` raises `42501`; a `TRUNCATE` succeeds, and the bytes stay on
> disk as orphans. Combined with [the Cloud orphan probe](cloud-orphan-probe-2026-08-18.md) of the
> same day, the blast radius is *"every byte in every bucket orphaned, and then unobservable on
> Cloud forever"* — not *"rows lost, restorable"*.
>
> ⛔ **ACCEPTED IN WRITING — the platform residue is not ours to revoke.** `storage.objects`,
> `storage.buckets`, `storage.buckets_analytics` (owner `supabase_storage_admin`) and the `net.*`
> tables (owner `supabase_admin`) grant TRUNCATE to `anon` and `authenticated`. **We cannot change
> that**, and the way it fails is the trap:
>
> | statement, run as `postgres` on Cloud | result |
> | --- | --- |
> | `revoke truncate on public.<table> from authenticated` | privilege `t` → **`f`** |
> | `revoke truncate on storage.objects from authenticated` | **no error**, privilege `t` → **`t`** |
>
> Postgres does not error when the caller is not entitled to revoke — it warns and no-ops. ⭐ *A
> migration that swept "everywhere it could" would have gone green on `db push` having hardened
> nothing on the half that mattered, and been recorded as complete.* The first probe I ran asked
> only whether the statement errored and answered **"REVOKE WOULD SUCCEED"** for `storage.objects`;
> only re-measuring the **privilege itself** exposed the no-op. Same family as
> [[guards-that-read-right-but-fail-open]] — and the reason `20260928000900` re-derives the set from
> the catalog after its loop instead of counting statements executed.
>
> The scope is therefore the deterministic first-party one. A local superuser *can* revoke on
> `storage`, so an opportunistic sweep would also have made local and Cloud diverge — green locally,
> unchanged in production.
>
> **Residual risk, stated plainly:** not reachable today. PostgREST exposes no TRUNCATE verb, and
> `anon` / `authenticated` / `service_role` are all **NOLOGIN**, so an API key is not a database
> credential. It needs a direct connection as a client role, which nothing issues. `service_role`
> keeps TRUNCATE deliberately — it is the trusted server-only role that already bypasses RLS, and
> anything holding that key can delete everything through the API anyway.

**Landed, no longer a recommendation:** the PostgREST **embed sweep** built during this phase now
lives in the repo at **`scripts/extract-embeds.mjs`** + **`scripts/probe-embeds.mjs`** (moved out of
a session scratchpad that was about to be deleted — the earlier revision of this line pointed at a
path that would not have existed, which reads as "saved" when it is not). It found BUG-TV-001 *and*
BUG-RCA-001 mechanically across 284+ call sites. It still cannot join `npm run lint`, because it
requires a live local Supabase and `probe-embeds.mjs` refuses any non-local URL by design.

⬛ **Entry point DONE 2026-08-11: `npm run sweep:embeds`** (extract → probe, both against `.`, via a
gitignored `.embed-sweep/` scratch dir; `extract-embeds.mjs` now creates that dir rather than
requiring the caller to). Run against the live local stack to confirm it works end-to-end.

**Its baseline is a NAMED list, not a count** — deliberately, per the FUP-E2E-1 lesson that a
count-shaped baseline is a hiding place:
- **311** select sites resolved, **0** unresolved · **248** distinct (relation, select) pairs probed.
- **246 × `42501`** = genuine PASS. The sweep probes with the **anon** key, which holds zero table
  grants, and its own built-in CONTROLS (C1/C2/C3) prove each run that 42501 does **not** mask embed
  or column errors — a good tool: it re-earns that claim rather than asserting it.
- **2 × `PGRST205`**, both `get_meeting_agenda_items` (`minutes-jobs/context.ts:119`,
  `minutes-jobs/queries.ts:193`) — **extractor false positives, NOT defects.** Both sites are
  `.rpc(name, args).select(...)` chains; the AST extractor reads the RPC name as a relation and
  probes `GET /rest/v1/<rpc>`, which is not a table. ⚠ Whoever next touches the sweep: this is the
  known baseline — do not chase it, and do not "fix" it by suppressing PGRST205, which is the code
  that would report a genuinely missing relation.

The generalisation that justifies keeping it: **ADR 0096 A1.5's grep sweep could not have caught
BUG-TV-001, because that site names no dropped column — it names a relation that is no longer
*reachable*. After a column drop, sweep the embeds the column ENABLED, not just the column.**

⚠ **Deferred by decision, not oversight** (ADR 0095 §3): `blocks[]` → join table; the
`case_phase_offered_results` rename.

### ⬛ Resolved — rotated 2026-08-06 → [follow-ups-archive.md](./follow-ups-archive.md)

FUP-MEM-1 (indicator doors: not a defect) · FUP-MEM-2 (`assignOrgAdmin` door) · FUP-AUTHZ-2
(15 BLIND gates) · FUP-BULK-1 (suspended members) · FUP-MEM-3/3b (DT referral plane + inbox) ·
FUP-A11Y-1 (`useFieldIds` → `useId()`) · FUP-AUTHZ-3 (45 row-returning DEFINER doors swept) ·
FUP-AUTHZ-4 (BLIND allowlist pruned). Full resolution bodies in the archive.

### ⬛ Resolved — rotated 2026-08-11 (the FUP quick batch) → [follow-ups-archive.md](./follow-ups-archive.md)

FUP-QO-9 (PGRST002 + zero-summary-crash classification; preflight now WAITS for the schema
cache) · FUP-GATE-RESET-FLAKE (reset stderr captured + retried once, loudly; `renderer_ok`
names a dead `gotenberg-pdf`) · FUP-PDF-2 (allowlist narrowed to the `HC*` class) · FUP-P16-4
(12 `+ "s"` sites → `plural()`, helper moved to `src/lib/text.ts`) · FUP-P16-2 (both
accreditation reads through `queries/`) · FUP-QOB-2 (fully discharged — ⑤ closed when ACT
shipped). Merged `97acfd6`. Full bodies in the archive.

**Rotated in the same pass, but NOT part of the batch:** FUP-QOB-1 (the `270` §J J1c catalog
pin, RATIFIED by the PO 2026-08-09) — a separate, earlier closure that had simply never been
rotated out of either file.

### ⬛ Resolved — rotated 2026-08-12 (backend FUP wave) → [follow-ups-archive.md](./follow-ups-archive.md)

FUP-PDF-3 (both doors narrowed to the granted-column composite `printed_document_public` —
ADR 0111, migration `20260921000100`, pgTAP `323` red-first + DROP+CREATE property controls) ·
FUP-F2-BUCKETS (`meeting-attachments` retired — `20260921000300`, policies + bucket behind a
non-empty REFUSE guard; pgTAP `325` pins the absence from `pg_policies`; `case-documents`
retirement stays with the open `getReferralDocumentUrl` item; ⚠ remote object count could NOT
be measured — background-agent remote SQL is auto-denied — the migration guard turns a
data-bearing remote `db push` into a loud refusal instead). Full resolution bodies in the
archive. Same wave, tracked in the RDR phase row rather than here: the `case_narrative_types`
reorder-after-archive `23505` fixed in `20260921000200` + pgTAP `324`.

⚠ **The one thing worth carrying forward rather than archiving:** three of those six were
measurably WRONG about the code, each phrased as an instruction someone would have executed
(FUP-PDF-4's prescribed fix already shipped; FUP-QO-9(b)'s "false green" was caught by three
existing checks; FUP-PDF-2's `23514` is raised by no door at all). **A prescription in a
follow-up is a claim about the code and ages like one — re-measure before implementing.**

### 🔴 FUP-FF5-1 — patient-lane sublabel is degenerate on the READ path (**PO DEFERRED 2026-07-28**)

The picker shows `Paciente / Paciente afetado`; the **durable submitted record** and wizard resume
show `Paciente / Paciente`. `buildReferenceAnswers`' input row carries no case data, so it resolves
the participant **type** while `reference_candidates` and `app.references_by_item` resolve the case
**role**. Every patient's `display_name` is the surrogate `'Paciente'` by construction, so **two
patient references in one case are indistinguishable in the permanent record**.

QA r1: **MAJOR, but ship** — every disambiguator that would work is PHI and would reverse ADR 0091
ruling 1 (which is why Rule 12 stays at three modules). The only mitigation that does not undo the
ruling is a **workflow rule**: require distinct `case_participant_roles` per patient per case.
Code fix (giving `buildReferenceAnswers` case scope) is a three-level PostgREST embed with PGRST201
exposure — both engineers independently judged it not gate-time work.

⚠ **The PO deferred the decision, not the risk.** The patient lane is live behind `entity_refs` the
moment FF-5 deploys, and ruling 2 makes that lane work **only** on case-bound forms — so this is
100% of real patient-lane usage, unexercised rather than unlikely. **Resolve before the lane is
offered to a real committee.**

### ▶ FUP-FF5-2 — `r2-m-1`: §O pins the door's behaviour, not the closure of the writer set

ADR 0091's substrate paragraph claims *"an exhaustive `pg_proc` sweep for writers of `participants`
returns exactly two functions"*. §O proves the two known doors behave (the surrogate holds) and O5
proves no writer is invoker-rights — but neither pins that the set is **closed**, so a third
DEFINER writer taking a caller-supplied label satisfies every assertion. QA r2: MINOR, not blocking
(the runtime property is held by the mutation-proven O4, and a new writer arrives with its own
migration and ADR). **Close:** one assertion pinning the writer set by **count *and* name**,
matching `(public\.)?participants\y`. Two specifics — O5's current regex is
`insert\s+into\s+public\.participants`, which matches only `public.`-qualified writes (exactly why
a rogue *unqualified* writer probe stayed green), and use `\y`, **not `\b`** (backspace in Postgres
regex).

### ▶ FUP-E2E-1 — RE-BASELINE `e2e:prod` (cross-phase, PO-ruled 2026-07-27) — **blocks nothing**

Replace the *"~18–27 expected failures"* folklore with a **named list**: run the suite on a clean
stack and classify **every** failure as `infra` / `deterministic-real` / `genuinely-flaky`, each with
an owner.

*Why:* **a count-shaped baseline is a hiding place, not a known-issues list.** FF-2's gate ran
762 passed / 55 failed; splitting by connection errors showed **52 were infra** (the
`supabase_vector` crash-loop class) and **3 were real and deterministic** — one of which
(**BUG-FF1-008**) had been red on every run since FF-1 and written off as baseline noise.

Make the triage step itself documented rather than reinvented per lead: **conn errors `> 0` = infra ·
`= 0` = real.** Also establish why batches terminate early — two reported "did not run" (11 and 39),
so raw totals misstate coverage in **both** directions.

### ▶ FUP-FF2-3 — whitespace-only observation, per-instance (DEFERRED by the lead 2026-07-27)

After BUG-FF1-007 fixed the `<> ''''` quoting slip, the per-instance filters compare `<> ''` while the
top-level one uses `btrim(...) <> ''` — so a **whitespace-only** observation is filtered at top level
but not per instance.

**Deliberately deferred, on scope discipline rather than merit:** it is a *different* defect from the
one ruled in, it is cosmetic (a blank observation block renders inside a group instance), and it
would have been the third out-of-phase fix of a wave already at its gate. **`tester` independently
confirmed the deferral is safe** — both canonical writers normalise with `nullif(btrim(...), '')`, so
the whitespace case is reachable only for **legacy rows**, the same population BUG-FF1-007 defends.

### ▶ FUP-FF1-2 — FF-1 QA non-blocking items (review r2: 4 MINOR / 6 INFO) — **7 still open**

All ruled non-blocking by `qa`. Detail rotated 2026-07-28 →
[ff-1-repeating-groups.md](./ff-1-repeating-groups.md); canonical analysis →
[phase-FF-1-review.md](../reviews/phase-FF-1-review.md) (the playbook's rule: never restate a
review's rationale here).

Open: **MINOR-1** `completeness_authorities_agree` is one-directional in pgTAP · **MINOR-2** the
suite header documents a keystone that does not exist · **MINOR-3** MUTATION F3 names the wrong
mutation · **MINOR-4** stale-comment asymmetry in `supersede_response` · **INFO-2** no coherence
guard on the direct-DML path · **INFO-3** · **INFO-4** the parity vectors have no drift detector.
Closed: INFO-1 (superseded by MINOR-4) · INFO-5 (discharged at Record) · INFO-6 (carried forward as
a binding FF-2/FF-5 requirement — **both phases have since discharged it**).

> ⚠ MINOR-2 and MINOR-3 are the same family FF-5 hit eight more times: a comment or a test name
> asserting something that is not true. Cheap to fix, invisible to every gate.
### ▶ FUP-FF1-1 — coherent fill-path hardening (post-pilot; ADR 0087 ruling 5)

- [ ] Revisit **DEFINER + per-mutation audit for the whole fill path** — `answers`,
  `answer_selected_options`, `response_group_instances` **together**, as one change. Today all three
  are direct-DML-under-RLS with no per-row audit (Rule 11 is satisfied for filling at the *response*
  level via `audit_responses_trg`); FF-1 deliberately matched that convention rather than hardening
  one table piecemeal. Decide the target posture for the set, not for a member of it.

### ▶ AUTHZ Gate-2 deferred (PO-noted 2026-07-17, non-blocking — Gate 2 shipped)

- [ ] **MINOR-1 — reserved-session door returns the respondent's own `case_id`.** `get_reserved_session_items`
  now masks times + process number on `NOT is_case_respondent`, but a respondent still receives their **own**
  `case_id` (no cross-case / cross-patient re-identification). Whether the respondent should see even their own
  linkage on the reserved door is the unresolved **A7-vs-A26** call — **fold the reconciliation at pilot close**.
  Owned by `backend`.

### ▶ ETH·E1 → ETH·E2 inheritance (PO-directed 2026-07-14: "log for E2, don't act now")

Three **known gaps** + two QA Minors, all the same class — *pre-existing scope decisions E1 does not own*, made
**visible** by E1's stricter access model. QA and `backend` independently judged each out of E1's scope; the PO
agreed and routed all of them to **ETH·E2**. **Full reasoning, measurements and the QA quotes →
[eth-e1-access-spine.md §4](./eth-e1-access-spine.md)** (detail rotated there 2026-08-04; titles +
owners kept live here).

- [ ] **GAP-E1-1 — `action_items` `assignees_only` arm never consults `can_read_case`** (a respondent who is also
  an `org_admin` could see an assignees-only item on their own case). `backend` at E2.
- [ ] **GAP-E1-2 — `patient_safety_event` has no case arm**; residual is **link-existence inference only** (the
  event carries its own incident narrative, not case deliberation). Gating it would rewrite the NSP/PHI-module-1
  model E1 doesn't own. `backend` at E2.
- [ ] **GAP-E1-3 — privileged-doc ceiling has no coordinator arm** (UX, not security: the coordinator who uploads
  a privileged doc must self-grant clearance to reopen it — correct per ADR 0072 D5). `frontend` at E2/E3.
- [ ] **MINOR-A — the generic leak sweep can pass VACUOUSLY** (10/14 covered, 4/14 vacuous). Fix: report zero-row
  tables as **uncovered** rather than silently passing them. `backend` at E2.
- [ ] **MINOR-B — `action_items` passes the sweep by FIXTURE ACCIDENT, not documented exclusion** — the moment
  someone seeds an `assignees_only` item it fails and reads as a regression. **Make it a decision, not an
  accident.** `backend` at E2.
- [ ] **participant-roles M2M (ADR 0072 D7·4) deferred to E2** — no §4 gate criterion covers it and its shape
  depends on E2's decision model; QA verified nothing half-built was left behind. `backend`.


### ⬛ FUP-DM5-FINALIZE-ATOMIC — ✅ **RESOLVED 2026-08-17** (owner: backend + lead)

> **✅ RESOLVED** by migration `20260928000500` + `341` block J (+10, plan 57 → 67).
> `public.complete_evidence_upload_verification` **delegates** to the existing byte
> verifier (one verifier, no drift) and mints the evidence row in the SAME transaction.
> Both evidence actions now pass `{ evidenceCorridor: true }`; the old four-round-trip
> sequence survives ONLY as the idempotent-retry recovery path, where the bytes are
> already committed and there is nothing left to make atomic.
>
> ⭐ **The keystone I first wrote would have been VACUOUS, and the near-miss is the
> transferable part.** "Call the door with an unwritable actor, assert the file is still
> `verifying`" passes **whatever order the checks are in** — one RPC call is one
> transaction, so any raise rolls everything back. It asserts Postgres, not the
> migration; no reordering of the function could redden it. The property only becomes
> observable as the **difference between one round-trip and two**, so J2 CONSTRUCTS the
> orphan on the old path (`unscanned_accepted/0` — verified servable bytes, zero domain
> rows) and J4 shows the identical fixture cannot reach it (`verifying/0`). Same shape as
> [[construct-the-state-nobody-constructed]]: the assertion had to build the state the
> defect lives in before it could measure anything.
>
> **Mutation-proven, not asserted:** neutralizing `can_write_rca` in the door reddens
> **exactly J3 and J4** and nothing else. Restored from the migration file afterwards and
> the restore VERIFIED against `prosrc` ([[mutation-harness-must-prove-its-rollback-first]]).
>
> ⛔ **Two designs were rejected, and the reasons are load-bearing.** (1) *Grant the
> verification door to `authenticated` and wrap it* — its measured ACL is postgres +
> service_role, never authenticated, and it takes `p_sha256`/`p_verified`, an
> **attestation by the server that downloaded the bytes**. Exposed to `authenticated`,
> any JWT holder could mark its own upload verified under a fabricated hash, defeating D9
> on a PHI-adjacent corridor. J7 now pins BOTH doors closed. (2) *Impersonate the
> uploader so `add_rca_evidence` could be reused unmodified* — `auth.uid()` is
> `coalesce(request.jwt.claim.sub, request.jwt.claims->>'sub')` (catalog-read): **two**
> GUCs behind a coalesce, so setting the one you thought of leaves the other winning.
> [[guards-that-read-right-but-fail-open]]. The actor is instead read from
> `upload_sessions.reserved_by` — written by the user-scoped `begin_document_upload`,
> never supplied by the caller — and passed explicitly to the `(id, uid)` predicates.
>
> ⚠ **The document arm's validation is DUPLICATED in the new door, deliberately.**
> Extracting a shared helper would rewrite the bodies of `add_rca_evidence` and
> `add_capa_action_evidence` — two live DEFINER doors — and a body edit **orphans a
> name-keyed door verdict** ([[a-rename-orphans-a-name-keyed-verdict]]). The duplication
> is pinned executably instead: J3/J5/J8 assert the new door refuses and accepts on the
> same terms, so drift reddens rather than accumulating.
>
> ⬜ **NOT closed by this:** the ⭐ blind-class half below. `document-reconciliation.mjs`
> still cannot see a domain-layer orphan — J2c demonstrates one it would call healthy.
> The corridor can no longer MINT one, but pre-existing rows and the other three
> corridors are untouched. **That remains a binding input to S5.**

<details><summary>Original filing (2026-08-14) — retained</summary>

Filed 2026-08-14 at DM5 S2 close. Found by `backend` while implementing the TS layer;
**not a bug in what shipped** — it is a design gap the contract's single-argument
signature makes invisible.

**The real path.** `finalizeRcaEvidenceUpload(sessionId)` / `finalizeCapaEvidenceUpload`
delegate to `finalizeDocumentUpload` (`src/lib/documents/actions.ts:158`) rather than
re-deriving the D9 verifier — one verifier, no drift, which is right. The consequence is
that finalize is **four DB round-trips**:

1. `finalize_document_upload(sessionId)`
2. service-role `storage.download` + sha256 → `complete_document_upload_verification`
3. admin read `document_versions → documents` (the evidence title comes from
   `documents.title`, and finalize returns no `document_id` — see the note below)
4. `add_rca_evidence` / `add_capa_action_evidence` (`kind:'document'`)

**The failure path, precisely.** Steps 1–3 commit independently of step 4. If step 4
fails — e.g. `assert_rca_writable` raises `HC048` because the RCA was locked between
begin and finalize — the outcome is a **verified, servable `file_object`, a
`document_version`, a bound rendition and an `active` document, with NO evidence row**.
The user sees the upload fail. A retry re-enters at `begin_document_upload`, which mints
a **NEW** document: the orphan is never recovered, only accumulated. It is invisible to
`scripts/document-reconciliation.mjs`, whose classifier judges `file_objects` against
storage and would call this row perfectly healthy — because it is. The drift is at the
DOMAIN layer, which nothing reconciles.

**Why it is not fixed in S2.** Making it atomic needs a wrapping RPC that finalizes and
creates the evidence row in one transaction — a **design change, not a bug fix**, and S2
has already been reopened once. A partial mitigation IS shipped: an idempotency guard
probes for a live evidence row on the same `document_id` before inserting, so a *retried
finalize on the same session* recovers rather than duplicating. It does not help when the
session is already consumed and the caller restarts at `begin`.

⚠ **Related latent defect in the DM2 twin, not introduced here.**
`finalize_document_upload` returns no `document_id` on either arm, so
`finalizeDocumentUpload` yields `documentId: ''` on the idempotent re-call
(`actions.ts:172`, `r.document_id ?? ''`). It propagates through
`finalizeReferralReplyAttachmentUpload`, which returns that result straight to its
caller. S2 routes around it by resolving from `documentVersionId`; the twin still has it.

⭐ **This is a BLIND CLASS in the reconciliation tooling, not just a property of this
bug — and it is a binding S5 input.** `scripts/document-reconciliation.mjs` compares
storage against `file_objects` in both directions. It cannot see a document that has
bytes, a verified file object and **no domain row**, because every object it judges is
accounted for. **S5 must not sign off a reconciliation command whose coverage is
narrower than the orphan classes it is meant to catch** — S5's job is to name the
operational owner and mechanism for the disposal job and the reconciliation command,
and this is a class that command does not currently cover.

Cross-reference: **FUP-DM5-STORAGE-ORPHANS** is the same shape one layer down — an
emptiness proof narrower than the thing it claims to prove (the Storage API lists *from*
`storage.objects`, so it cannot see bytes that table has forgotten). Two layers, one
defect shape: **the reconciler's domain is narrower than the drift it is trusted to
rule out.**

</details>

## Bodies moved here 2026-08-14 (the PROGRESS.md size rotation) — items whose ONLY record was the live line

> ⚠ **Found during the rotation, and it changes what the rotation was allowed to do:** these OPEN
> follow-ups had **no body in this file at all**, and `FUP-ACT-DISPOSE-UI`'s live line even pointed
> *here* for its "full mechanism". PROGRESS.md is supposed to carry a one-line index only
> (lead-playbook §5) — so compressing those lines to `severity · id · title · owner` would have
> **destroyed the item**, not rotated it. Bodies below are the live text, verbatim.


### 🟡 FUP-E2E-REPEAT-FLAKY — ⭕ **DOWN TO TWO members 2026-08-17, and the "one root cause" hypothesis is now EVIDENCED, not merely suspected** (owner: lead + tester)

- 🟡 **FUP-E2E-REPEAT-FLAKY** — `act-role-assumption:157` + `phase2-auth-shell:268` flaked in **BOTH** DM3 `e2e:prod` runs ⇒ a pattern, not noise; outside the DM3 diff. **Both flaked again in DM5·S3's gate (3rd + 4th occurrence) — the pattern is now established, not suspected.** Both flaked again at DM5·S6's green gate. ~~Third member added 2026-08-14: `dm5-nsp-evidence.spec.ts:347` EVID-KBD-1~~ — **REMOVED 2026-08-17: root-caused and fixed (BUG-DM5-S6-EVID-KBD-1), so it was never a flake.** All were focus/navigation-timing shaped, matching the standing *"`.focus()` is not auto-waiting — it races RSC streaming"* class, which suggested **one** root cause rather than three flaky tests — lead/tester

> **⭐ 2026-08-17 — the hypothesis in the last sentence above got its first real test, and it held.**
> EVID-KBD-1 was pursued as a *defect* rather than accepted as a flake, and it had a precise
> mechanism: a readiness helper treated the **ancestor layout's `<main>`** as proof of rendered
> content, but that `<main>` persists across the `loading.tsx` → `page.tsx` Suspense swap, so a
> fixed-budget `focusByTabbing` could start counting Tab presses against a near-inert skeleton.
> Load-dependent, hence "flaky"-looking. It is exactly the predicted family — **one layer above where
> the class was being looked for** (the check that decides *when it is safe to start*, not the
> `.focus()` call itself).
>
> **What this changes for the surviving two:** they are no longer "two tests that flake". There is now
> a **named, reproducible mechanism** to test them against, and a working method: reproduce at
> **batch composition** (they pass in isolation — the isolated run is the trap), run at `RETRIES=0`,
> and fix the *precondition* rather than the budget.
> ⭐ **Concrete unverified lead, from the tester, worth writing down before it is lost:**
> `phase2-auth-shell.spec.ts` calls a **bare `.focus()` shortly after a navigation** — the same
> anti-pattern, in one of the two survivors. **Not investigated and not confirmed** (it is unknown
> whether that route even has a `loading.tsx` boundary). *A lead, not a finding.*
> ⚠ **Do not close this FUP on EVID-KBD-1's fix** — one member's root cause is evidence about the
> class, not a closure of the other two.

### 🟡 FUP-GATE-PDFP1-FLAKE — `pdf-printing.spec.ts:38` pre-mint empty-state flake, mechanism UNPROVEN (owner: lead + tester)

- 🟡 **FUP-GATE-PDFP1-FLAKE** — `e2e/pdf-printing.spec.ts:38` failed its **pre-mint** empty-state assertion once in the DM2 re-gate's `e2e:prod` run 1, then passed **three** independent ways at `RETRIES=0` (isolation 9/9 · identical-batch re-run 60/61 · full-suite run 2, batch 8 60/0). **Not phase-attributable** — the printing module is outside the DM2 diff and the expected string is intact in source (QA r2). ⚠ **The mechanism is UNPROVEN**: no infra signal (`server_dead=0`, no conn errors), unlike DM1's proven `server_dead` flake. QA narrowed it further — the gate resets the DB **before each batch** and batch 8 ran **1 worker**, and the failing test is the *first* in its file (pool index 0), which near-refutes the shared-fixture-pool hypothesis and leaves an ordinary `toBeVisible` timing flake. ⚠ **Both evidence artifacts are gone**: `test-results/` AND `/tmp/e2e-prod-gate/batch-8.log` were overwritten by the re-runs. **Discharge = catch it once with artifacts preserved, or pin the timing.** Related and arguably the real fix: `scripts/e2e-prod-gate.sh` resolves "re-run to see if it recurs" vs "preserve the evidence" the **wrong way** — a failing batch's log and `test-results/` should be archived before any re-run (QA r2 carry-forward) — lead/tester

> ⭐ **2026-08-18 — a named candidate this item can now EXCLUDE, which is progress on "UNPROVEN" without discharging it.** **BUG-DM5-S3-ENV-FIXTURE-POOL-1** (closed + archived) proved the shared-pool mechanism *in a manual, un-reset context*: 9 pre-existing `printed_documents` rows carrying this spec's own revoke text, against a helper that claims responses by POSITION. ⛔ **That is NOT this item.** QA's narrowing here still holds — the gate resets before each batch and ran 1 worker, so pool contamination cannot be the gate failure's mechanism. What changes is that the candidate is now *named and measured* rather than hand-waved, so a future investigator can exclude it by citation instead of re-deriving it. The dev-loop half is filed separately as **FUP-E2E-PRINT-POOL-DEVLOOP**. ⚠ **Do not close either item on the other's evidence** — same assertion, two different contexts, one proven mechanism and one unproven.

### 🟡 FUP-E2E-PRINT-POOL-DEVLOOP — the print spec's fixture pool is claimed by POSITION, so a second run without a reset reds a human but never CI (owner: tester)

- 🟡 **FUP-E2E-PRINT-POOL-DEVLOOP** — `submittedResponseIds` ([e2e/helpers/pdf-printing.ts:133](../../e2e/helpers/pdf-printing.ts)) claims responses **by position** (`responses?…&order=id.asc&limit=N`) with **no filter for "has no print yet"**. Run `npx playwright test e2e/pdf-printing.spec.ts` twice against the same DB generation and the second run reds at `:47` — *"Panel starts empty for this fresh fixture"* — because index 0 was minted and revoked by the first. **Mechanism proven**, not suspected: BUG-DM5-S3-ENV-FIXTURE-POOL-1 measured 9 pre-existing `printed_documents` rows carrying this spec's own revoke sentence verbatim, against **zero** `printed_documents` inserts in `seed.sql` — tester

> **Why no gate will ever catch this.** `scripts/e2e-prod-gate.sh:50` sets `RESET="${RESET:-1}"` and runs
> `supabase db reset --local` **before every batch**, and the batch runs `--workers=1`. So the failure is
> invisible to CI **by construction** and lands only on a human in the quick dev loop — which is exactly
> how it was first filed, as an apparent product defect during an S3 gate sweep.
>
> ⛔ **NOT `FUP-GATE-PDFP1-FLAKE`, and neither closes the other.** That item is the *same assertion*
> failing **inside a gate**, where the reset-per-batch and single-worker facts are precisely what
> near-refutes the pool hypothesis; its mechanism is still UNPROVEN. Same line, two contexts, two
> mechanisms — one measured, one not.
>
> ⚠ **THE OBVIOUS FIX IS A TRAP — do not "just filter the pool".** Making `submittedResponseIds` skip
> already-printed responses **breaks the sibling tests**: they claim indices 1–5 and depend on the
> position→response mapping being stable across calls, so once the first test mints on index 0 a
> filtering helper shifts every later claim by one. Shapes that work: a **dedicated fixture** for `:38`
> alone, leaving the positional helper untouched for the rest; or an **identity-scoped** cleanup that
> deletes `printed_documents` for exactly the claimed response id — *by identity, never by position*
> (the standing "a positional cleanup eats seed rows" rule).
>
> **Discharge criterion — the fix's own test, not a green suite.** Two consecutive
> `npx playwright test e2e/pdf-printing.spec.ts` runs **with no reset between them**, both green. The
> *second* run is the assertion; a single green run proves nothing, because a single run has always
> passed. And the sibling tests must be green in **both** runs — that is the regression risk the
> filtering fix would have shipped.

### 🟡 FUP-329-ABORT-SHAPE — a `329` keystone whose failure ABORTS the file, dropping 41 assertions (owner: backend)

- 🟡 **FUP-329-ABORT-SHAPE** — a `329` keystone whose failure **aborts the file** (drops 41 assertions); it is what makes a mutation sweep over these gates unclassifiable — backend

### 🟡 FUP-ACT-CAPA-ASSIGN — NSP operators see ~only themselves in the CAPA assignee picker (owner: backend)

- 🟡 **FUP-ACT-CAPA-ASSIGN** — NSP operators see ~only themselves in the CAPA assignee picker (`profiles` RLS has no operator arm; the hatless union used to mask it) — backend

### 🔴 FUP-ETH-ROLES-1 — no production bootstrap of `case_participant_roles` (owner: product + backend)

- 🔴 **FUP-ETH-ROLES-1** — **no production bootstrap of `case_participant_roles`.** The ethics role bundle lives ONLY in `supabase/seed.sql`; the sole role-insert in any migration is the lazy `affected_patient` mint inside the patient path. A real org therefore starts with **zero** roles, and since `case_participants.role_id` is NOT NULL, EVERY participant type is a dead end until an org admin authors the vocabulary in T5 — the three role-less external types ratified on 2026-08-11 are one visible instance, not the shape. Decide before the pilot onboards a second org: bootstrap-on-org-create vs. a first-run prompt vs. accept-and-document (found 2026-08-11 while ratifying the PO items; the add-dialog empty state now at least names the remedy) — product + backend

### ⬛ FUP-DM5-DVF-FILEOBJ — ✅ **RESOLVED 2026-08-18 (`20260928000600`, `UNIQUE (file_object_id)`); ⛔ LOCAL ONLY — census the remote before `db push`** — latency had rested on CALLER DISCIPLINE ALONE (owner: backend)

> ## ✅ RULED 2026-08-18 (DM-FUP TRIAGE #4) — **add `UNIQUE (file_object_id)`**, in a migration above `20260928000500`
>
> Confirmed from the catalog: `document_version_files` carries `UNIQUE (document_version_id,
> rendition_kind)` and **nothing on `file_object_id`**. All three writers —
> `complete_document_reclassification`, `complete_document_upload_verification`,
> `mint_printed_document` — insert a `file_object` they minted in the **same call**, so 1:1 holds today
> by caller discipline and by nothing else.
>
> **Why structural beats a test:** a shared `file_object` means marking one row `disposal_pending`
> silently destroys **another row's** bytes, and no arm would notice. That is the failure ADR 0121's
> disposal lifecycle cannot absorb, so the invariant belongs in the schema rather than in a suite that
> pins current behaviour. The ruling **knowingly forecloses** rendition byte-sharing (a PDF whose
> `source` and `preview` are one object); the disposal-safety argument was judged worth that price.
>
> ⛔ **Census the remote for duplicates BEFORE pushing.** Local is **0 DVF rows / 0 duplicates**, so a
> green local `db reset` proves **nothing** about push-safety — a constraint migration that passes an
> empty local DB is exactly the shape that fails `db push` on data.
> → [[backfill-guard-wrap-data-dependent-migration]]

> **RE-CHECKED 2026-08-17 (the item's own "re-check at S4/S5" instruction).**
> ✅ **Still latent, for the stated reason:** `mint_printed_document` is the only door that
> both inserts into `document_version_files` **and** mints its own `file_objects` row, so the
> S3 property held.
>
> ⚠ **What the recheck ADDED, and it changes who must care.** The item reads as though the
> schema were holding the line. It is not: `document_version_files`'s only unique constraint
> is **`(document_version_id, rendition_kind)`** — there is **no uniqueness on
> `file_object_id`**. So one `file_object` bound to many versions is **structurally
> permitted**, `ON DELETE RESTRICT` is the only backstop, and nothing would notice a slice
> that started sharing bytes.
>
> ⛔ **This is a BINDING input to ADR 0121's disposal lifecycle, which is the slice that makes
> it live.** Disposing a shared `file_object` would retire bytes still bound to another
> version, and `complete_document_disposal`'s "all versions disposed" check walks
> `document_id`, not the sharing graph. Whoever builds the outflow must either add the
> uniqueness, or make disposal sharing-aware, or record the assumption executably.
>
> ⚠ A first pass at this recheck asked "does any door bind a pre-existing `file_object`" and
> got **two** hits (`complete_document_upload_verification`, `complete_document_reclassification`)
> — both false positives: they bind a row created moments earlier in the same corridor, which
> is not the sharing the item means. *The predicate was quoted at the wrong grain*
> ([[a-predicate-quoted-at-the-wrong-grain]]); the discriminating question was about the
> CONSTRAINT, not the callers.

⚠ **This item had no live bullet of its own** — it was named only inside the DM5 phase section's
"Open:" list and inside the DM5·S3 QA verdict. Both were rotated on 2026-08-14, so without this body
and the new live index line it would have disappeared entirely. Substance, from the QA r1 report:
the S3 mint **creates a fresh `file_object`** rather than binding a pre-existing one, which is what
ADR 0120 required S3 to ensure, so the concern **stays latent** — it becomes live only if a future
slice binds an existing `file_objects` row into `document_version_files`. Re-check at S4/S5.

### 🟠 FUP-DISPOSE-DIALOG-OVERCLAIM — the shipped referral-dispose copy is the exact "tudo apagado" over-claim ADR 0056 (b) forbade — and it offers an Art. 18 reason counsel may have closed (owner: frontend; fix vehicle: DSR plan Slice 4)

Filed 2026-08-19 (lead) — found by the disposal-touching-ADR sweep as an ADR 0056 Consequence that
was logged there and never entered this register; then verified against the shipped component.

**The defect, verbatim from the tree.** ADR 0056 Consequence (b) required the disposal-confirmation
copy to reflect the **narrowed claim** — *"no 'tudo apagado' over-claim; it should say DB PHI is
erased and attachments are retained encrypted under retention."*
`src/components/referrals/referral-dispose-dialog.tsx` ships: *"Remove **permanentemente** a
identificação do paciente e **todos os campos com dados sensíveis** … Esta ação é irreversível"* and
*"apaga **permanentemente** … Não é possível desfazer"* — no mention of retained bytes, PITR, or
distributed copies. This is pt-BR compliance copy shown to the operator at the moment they discharge
a legal obligation, asserting more than the mechanism delivers (ADR 0056 §4 narrowed the claim
precisely because Storage blobs survive).

**Aggravated 2026-08-19, then NARROWED the same day:** the dialog offers *"Solicitação do titular
(LGPD Art. 18)"* as a selectable reason, which was contingently invalid while counsel's blanket
override stood — but the Q14 return (ADR
[0035](../decisions/0035-lgpd-anvisa-regulatory-posture.md) **Amdt 1**, resolved) rules removal
requests **case-by-case with legal consultation**, so the lane is live and the reason option is
valid. The over-claim is the whole remaining defect. ⚠ Slice 4's rewrite should still note that a
`subject_request` disposal presupposes an adjudicated DSR (ADR 0130) once that workflow exists.

**Fix (decided, Q12a):** rewrite with the shared fixed residue-language constant —
[dsr-workflow-plan.md](../plans/dsr-workflow-plan.md) **Slice 4**, which also owes the same copy to
every disposal surface the DSR inbox adds. Not a one-line patch: the residue language is decided
once in the plan, never per-dialog.

### 🟠 FUP-NOTIFICATIONS-PHI-RESIDUE — `notifications.title/body` copy entity text at write time and NO dispose door touches the table (owner: backend; fix vehicle: DSR plan Slice 4)

Filed 2026-08-19 (lead) — measured during the DSR design session: `notifications` carries `title` +
`body` built from entity labels/summaries at event time, and none of the four `dispose_*` door
bodies references the table. ADR 0056 redacts `cases.label` *because* it is PHI-warned — but every
notification that label ever generated keeps the pre-redaction text. So a `granted` disposal leaves
PHI residue in a table the erasure claim never mentions.

**Fix (decided, Q12a):** each dispose door gains a scrub of `notifications.title/body` by
(`entity_type`, `entity_id`), one pgTAP pin each **plus the vacuity control** (a sibling entity's
notification must survive — a scrub test that would also pass on `delete from notifications` is not
a pin). [dsr-workflow-plan.md](../plans/dsr-workflow-plan.md) **Slice 4**. Until built, the two-tier
outcome record's residue language must not claim notifications are clean.

### 🟡 FUP-XREF-PEPPER-ROTATION-ORPHANS — rotating `mrn_pepper` permanently orphans DISPOSED xref rows; documented in ADR 0039 as "follow-up", never filed (owner: backend; pre-pilot: decide, not build)

Filed 2026-08-19 (lead) — from the disposal-ADR sweep. ADR
[0039](../decisions/0039-patient-identity-cross-committee-linkage.md) Consequences: pepper rotation
*"orphans disposed-row keys (the raw MRN is gone, so the key can't be recomputed) … a documented
residual, **not** built (follow-up)"* — and no register entry was ever created. Measured 2026-08-19:
1 live function references `mrn_pepper`; `patient_xref` holds rows whose `disposed_at` marks exactly
the population a rotation strands. The interaction with the DSR program (ADR 0130) is that disposal
**creates** the unrotatable population — every granted erasure widens it. Nothing to build now; the
item exists so a future "rotate the pepper" task cannot be scoped without meeting it.

### 🔵 FUP-ADR0121-REASON-VALUE-DRIFT — the `superseded`-vs-`retention_expired` question ADR 0121 Amdt 2 deliberately left open has been silently pre-answered by the D11 register entry (owner: lead)

Filed 2026-08-19 (lead). ADR [0121](../decisions/0121-disposal-lifecycle-inflow-outflow-and-evidence.md)
Amendment 2: the reason value recorded when the retention clock fires on a superseded version is
**deliberately left open** — *"the implementing slice decides it explicitly and records the choice
here"*, because both candidate values are true and their regulator-facing meanings differ. But the
`FUP-DM5-D11-SUPERSEDED-NEVER-RETIRES` body in this file already states
`disposal_reason_category = 'superseded'` as if chosen. The live CHECK still admits only the
original five values (measured 2026-08-19), so nothing is built on the drift — but the register is
pre-empting an ADR's reserved decision, which is how an open question becomes a "decision" nobody
made. **Fix:** the D11 implementing slice makes the call explicitly, records it in ADR 0121 Amdt 2's
reserved slot, and reconciles the D11 body; until then, neither value may be cited as decided. (ADR
[0130](../decisions/0130-dsr-subject-request-workflow.md) explicitly does **not** settle it.)


### 🟠 FUP-DISPOSE-EVENT-DOOR-GATE-BLIND — `dispose_event_phi`'s authorization gate is exercised by NO keystone: opening it leaves the full suite green (owner: backend; found by the ADR 0129 diff-scoped sweep)

**Measured 2026-08-19, by neutralization, on a fresh reset.** Rewriting the door's authz raise to
`perform 1;` — so **any** caller passes the gate — and running the full pgTAP suite:

| Door | Gate | Suite notices? |
|---|---|---|
| `dispose_case_phi` | `is_staff_admin_of(commission)` | ✅ **YES** — `151_case_patient` (6 tests) + `314_qob_org_admin_content_wall` (1) |
| `dispose_referral_phi` | `is_tenancy_admin_of` ∨ `is_pqs_operator_of` (source ∨ target) | ✅ **YES** — `189_nsp_per_hospital_isolation` |
| `dispose_meeting_minutes` | `is_staff_admin_of` ∨ `is_tenancy_admin_of` | ⛔ **WAS BLIND** — ✅ now keystoned by `348` t7 (ADR 0129 build) |
| **`dispose_event_phi`** | `is_tenancy_admin_of(commission_of_event)` ∨ `is_pqs_operator_of(hospital_of_event)` | ⛔ **BLIND** — gate opened **alone**, suite **PASS**, 6550/6550 |

⚠ **BLIND ≠ vulnerable, and the distinction is the whole point.** The gate is present and correct
today; nothing is reachable that should not be. What is missing is the *keystone* — if a refactor
dropped or weakened this gate, **nothing in 6550 tests would go red**, and a PHI-erasure door on the
patient-safety module would be silently open. That is door-blindness in the ADR 0079 sense.

**Why the standing gates did not catch it.** `ARM=census` asks whether a gate carries a *verdict*,
not whether a keystone exercises it; `ARM=floor` asks only whether the door is **called** — and it
is (its happy path is tested), which is exactly the [[a-predicate-quoted-at-the-wrong-grain]] shape:
"the door is exercised" is true and does not bound "the door's *gate* is exercised". ADR 0079
Amendment 1's diff-scoped recipe filters the diff to `^(is_|can_|has_)` function names + RLS
policies; this gate is a plain `if not (...)` **inside** a door and matches no filter. ⭐ **The
enumeration boundary is a syntax; the property is "an authorization decision no test can see change"**
— [[enumeration-boundary-is-a-syntax-not-a-property]].

**The fix** is one `throws_ok(..., '42501')` per door with a persona who holds the module's ordinary
membership but neither gate arm — the shape `348` t7 uses (a plain commission member), with a CONTROL
pinning that the persona really lacks the hat, so the refusal is attributable to the role and not to
tenancy. ⛔ **Do not "fix" this by widening the gate to make a test pass.**

**Not fixed here, deliberately.** Found *during* the ADR 0129 build, whose migration is bound to amend
nothing else (0129 Decision 1) and whose subject is the child lock. Filed rather than carried, so it is
not lost inside a build that does not own it — the same reason this door's sibling item was filed in the
first place.

### 🟠 FUP-MEETING-DISPOSAL-LEAVES-CHILD-TEXT — meeting PHI disposal redacts THREE of `meeting_agenda_items`' four text columns and none of the other child tables' (owner: backend; fix vehicle: DSR plan Slice 4)

**Measured 2026-08-19 from `information_schema` + the live `pg_proc` body**, while building ADR 0129.
`dispose_meeting_minutes` nulls `meetings.minutes_md` and redacts
`meeting_agenda_items.{description, discussion_notes, resolution}`. The free-text columns it does
**not** touch:

| Column | Touched by any dispose door? |
|---|---|
| `meeting_agenda_items.title` | ⛔ **no** — three of that table's four text columns are redacted; `title` survives |
| `meeting_attendees.{note, external_name}` | ⛔ no |
| `meeting_closed_sessions.label` | ⛔ no |
| `meeting_cases.{summary, decision}` | ✅ yes — but by `dispose_case_phi`, per-case (ADR 0056 §2's deliberate decoupling), **not** by the meeting door |

⚠ **This is an over-claim, not a regression.** ADR 0056 §2 *declares* exactly this scope, so the door
does what its ADR says. The defect is that the **language** around it — the disposal confirmations and
the runbook — reads as "the meeting's PHI is erased", and an agenda item titled with a patient's name
survives that claim. `title` is the sharp one: a reader who sees three of a table's four text columns
redacted will reasonably assume the fourth was considered.

**Why it belongs to DSR Slice 4** (residue + copy honesty, ADR 0130 Decision 9): Slice 4 already owns
the fixed, pre-written residue language and the `referral-dispose-dialog` rewrite. Either the columns
join the redaction set or the residue language names them as retained — **the one thing that must not
happen is the current state, where neither is true**. Sibling item: `FUP-NOTIFICATIONS-PHI-RESIDUE`.

⚠ Note the method that found it, because the door's own suite could not: a **column census of the
guard's four child tables**, run for an unrelated reason (checking what the child lock protects).
Reading the door tells you what it redacts; only reading the *tables* tells you what it does not —
[[new-door-must-inherit-every-sibling-arm]], applied to columns.

### 🟠 FUP-DISPOSAL-RUNBOOK-COVERS-ONLY-BYTES — the PHI-disposal runbook is the procedure for ONE of the two PHI-disposal substrates; the four column-erasing doors have no operational procedure at all (owner: backend + PO; found by correcting a wrong-grain claim, 2026-08-19)

**Measured 2026-08-19** while checking whether `FUP-DISPOSAL-CHILD-LOCK-BLOCKS-PHI-ERASURE`
really blocked C1a (it did not). PHI leaves this system by **two structurally different
substrates**, and only one has a runbook:

| Substrate | Mechanism | Operational procedure |
|---|---|---|
| **Storage bytes** — `file_objects` parked at `disposal_state = 'disposal_pending'` | inflow: `request_document_disposition`, `dispose_case_phi`, `dispose_referral_phi`, `complete_document_reclassification`; outflow: `complete_document_disposal`, which **nothing schedules** | ✅ [`phi-disposal-runbook.md`](../deployment/phi-disposal-runbook.md) — this is precisely why it exists (its § 0) |
| **DB columns** — `minutes_md`, `meeting_agenda_items.*`, `patient_identifiers`, `event_patient`, `referral_patient`, narratives… redacted in place to `[PHI removido]` | `dispose_meeting_minutes`, `dispose_case_phi`, `dispose_event_phi`, `dispose_referral_phi` — each **completes synchronously inside its own transaction** | ⛔ **NONE** |

**Measured, not inferred:** the runbook contains **zero** occurrences of `meeting`,
`minutes_md`, `dispose_meeting_minutes`, `dispose_event_phi`, `patient_xref` or
`PHI removido`; it names `dispose_case_phi` and `dispose_referral_phi` **once each**, and only
as *inflow doors that park a `file_objects` row* — never as PHI-erasure operations in their
own right. In the catalog the two paths are disjoint: `dispose_meeting_minutes` writes no
`file_objects` row and never sets `disposal_pending`; `complete_document_disposal` never
touches meetings.

⚠ **This is not a claim that column PHI is un-erasable.** The column doors work, complete
synchronously, and need no operator — which is exactly why they never acquired a procedure, and
exactly why nobody noticed. The gap is that **"the PHI disposal runbook" is read as covering PHI
disposal**, and a C1a rehearsal executed against it will exercise the byte path and record a
green that says nothing about the column path. Under LGPD Art. 18 an erasure request spans both.

**What is actually needed** (PO call — this may be a runbook § or an explicit scope statement):
1. The runbook states its substrate **in its title or § 0 banner**, so its green cannot be read
   wider than it is; **and**
2. either a companion procedure for the four column doors, **or** a recorded decision that they
   need none because they are synchronous — with the *evidence path* named either way (which
   door, which audit event, what a verifier reads afterwards).

⭐ **How it stayed invisible:** every document that touched it was individually correct about its
own subject. The runbook never claimed to cover columns; the doors never claimed to need a
runbook; C1a said "run the runbook". The gap lived **between** them, and it took a wrong-grain
claim — *"the child lock blocks C1a"* — to point at the seam. Same shape as
[[an-approvals-scope-is-a-fact-that-must-be-written-down]]: invisible from either document alone,
because each is complete about its own subject.
