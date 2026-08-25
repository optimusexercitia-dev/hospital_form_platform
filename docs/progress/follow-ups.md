# Follow-ups â€” live detail (OPEN items)

Full bodies of **open** follow-ups, rotated out of PROGRESS.md 2026-08-08 to keep the
tracker small (CLAUDE.md Â§7). PROGRESS.md keeps a one-line index (id Â· severity Â· title Â·
owner) â€” **update BOTH when an item changes state**. Resolved items move to
[follow-ups-archive.md](./follow-ups-archive.md), same as before; the parked backlog stays
in [deferred-backlog.md](./deferred-backlog.md).

### â¬› FUP-DM5-NO-ANSWER-VS-NOTHING â€” âœ… **ALL SIX INSTANCES CLOSED 2026-08-19** â€” *"I could not look"* is not distinguished from *"I looked and found nothing"* (owner: backend + lead; **a design-level blind spot, filed as a CLASS**)

> ## âœ… CLOSED 2026-08-19 â€” the last open instance is fixed, and the class statement is KEPT
>
> **Instance 1 (`--allow-orphans`) â€” the item's own "remaining surface" â€” is FIXED**, by ADR
> [0128](../decisions/0128-unproven-is-not-clean-capture-outcome-classes.md): unproven and dirty
> are now separate classes with separate exit codes (**3** vs **1**) and separate acknowledgements
> (`--allow-unproven` / `--allow-dirty`), and **dirty outranks unproven** so a finding can never
> hide behind a no-answer. `--allow-orphans` is **refused by name, not aliased** â€” the muscle
> memory was the defect. â­ Fixing it surfaced a **second conflation nobody had filed**: the flag
> read *"allow ORPHANS"* while equally accepting `MISSING_BYTES` and `DIVERGED_BOTH_WAYS`. *A flag
> that accepts more than its name says is this class one layer up* â€” found by the sibling-guard
> diff, which is the method [[new-door-must-inherit-every-sibling-arm]] keeps earning.
>
> **Instance 3 is discharged, not merely downgraded** â€” and the closing fact is a MEASUREMENT, not
> a decision. ADR 0121 **D4** (shipped, `20260928000400`) made `disposed` record what it actually
> verified (`metadata_absent` + a closed `byte_proof` vocabulary), and `FUP-DM5-BYTE-PROOF-NOT-ATTEMPTED`
> then made the one lane that really deletes bytes declare `unavailable_on_platform` instead of
> riding the default. The open half was *"unless FUP-DM5-CLOUD-ORPHAN-SURFACE settles that an
> orphan-visible surface exists"* â€” it was probed on 2026-08-18 and **all five Cloud surfaces are
> metadata-bound** ([cloud-orphan-probe-2026-08-18.md](./cloud-orphan-probe-2026-08-18.md)). So
> `unavailable_on_platform` is not a placeholder awaiting a better proof; it is the **true and
> permanent** value there. The record no longer asserts more than the door verifies.
>
> â›” **What closing this item does NOT mean, stated because the class's own lesson predicts the
> misreading.** It does not mean orphaned bytes are absent on Cloud â€” the probe proves they are
> **unobservable**, which is the opposite of reassuring. It does not add a Cloud byte proof; none
> exists and none is being built (PO-ratified, ADR 0120 D9 amendment 2026-08-18). **What closed is
> the CONFLATION** â€” every surface that used to answer "I could not look" with a reassuring value
> now says which of the two things happened.
>
> **Kept, not archived-and-forgotten:** the one-sentence class statement below is the most
> productive review lens this program produced (six instances, three variants, four of them found
> *inside the fix for another one*). It is retained here in full for that reason.

> # â­ THE CLASS, IN ONE SENTENCE
>
> ## **An observable PROXY is substituted for the property that actually matters â€” and it always fails in the REASSURING direction.**
>
> â›” **Corrected at QA r1.** The previous headline was *"an action performed is recorded as the state
> achieved"*. QA was right that it fits instances 3/4/5 and **not 1/2**: *"I could not look"* is not an
> action performed, and the table's own first column contradicted its own header. The sentence that
> covers **all** of them was already sitting one line below, so it is promoted; *action â†’ state* is
> kept as a **named sub-class**. This matters because the entire point of the reframe was
> recognisability in review â€” **a class that mis-describes two of its own instances will mis-train the
> next reader.**
>
> ### Three variants, six instances
>
> | # | variant | the proxy actually observed | the property it was recorded as | state |
> | --- | --- | --- | --- | --- |
> | 1 | **"I could not look"** | `--allow-orphans` â€” proof unavailable | *I looked and found nothing* | âœ… ADR 0128 |
> | 2 | **"I could not look"** | `.list('')` â€” absence of a **bucket** | absence of **keys** | âœ… `d2b19808` |
> | 3 | **action â†’ state** | `complete_document_disposal` â€” **metadata row** gone | **bytes** gone | âœ… ADR 0121 D4 + the Cloud probe |
> | 4 | **action â†’ state** | destruction â€” file **unlinked** | bytes **unrecoverable** | âœ… runbook Â§6b (key-first) |
> | 5 | **action â†’ state** *(caught pre-ship)* | backup pipeline **ran, exit 0** | a backup **exists** | âœ… never shipped |
> | 6 | **"I looked at the WRONG THING"** | `verdictFor` â€” no volume **directory** | the bucket is **consistent and empty** | âœ… `verdictFor` + R7/C14â€“C16 |
>
> â­ **Instance 6 is QA's MAJOR-1 and it is a THIRD distinct variant** â€” not "I could not look" and not
> "an action recorded as a state", but **"I looked at the wrong thing."** The tool consulted the volume
> and reported honestly about it, while never consulting the API set that contradicted it. That variant
> is the hardest of the three to spot in review, because the measurement genuinely happened.
>
> **Severity ðŸ”´ â†’ â¬› CLOSED 2026-08-19.** The ruling below stands as the reason it *was* ðŸ”´; it is kept
> because the rule it states â€” *the class heading carries the severity of its worst instance* â€” is the
> part that transfers to the next class-shaped filing.
>
> **Severity ðŸ”´** (lead ruling 2026-08-17, escalated from ðŸŸ  on instance 3): the class heading carries
> the severity of its worst instance. Instances 1â€“2 are ðŸŸ  â€” tool output an operator reads and can
> second-guess. **Instance 3 is ðŸ”´**: a *persisted record asserting a fact to a regulator*. âš  Bound it
> precisely, per QA: instance 3 is a **latent** false assertion â€” it says the record *can assert more
> than it verifies*, not that it *asserts falsely today*; it becomes false only where an API delete
> removed metadata while bytes survived.

Filed 2026-08-17 (backend, S5.D) â€” **lead-ruled to be filed as a class, not as two bugs.** Two
independent instances in one tool, in unrelated code paths, found days apart by different means. Filed
as two items each gets fixed once and the shape stays open; filed as a class it gets a design answer.

**Instance 1 â€” `--allow-orphans`. âœ… FIXED 2026-08-19 (ADR 0128).** One flag muted two different
facts. On Cloud the local volume proof cannot exist, so every bucket verdicts
`UNVERIFIED_NO_LOCAL_PROOF` and `capture` exited **1 on a perfectly healthy project**; the only route
to exit 0 was `--allow-orphans`, which **also** silenced genuine `ORPHANED_BYTES` verdicts. An operator
who wanted a usable exit code had to buy blindness to the finding the tool exists to produce. The fix
took the shape the filing predicted â€” *"a distinct flag, or distinct exit codes for unproven vs proven
dirty"* â€” and took **both**, because either alone leaves the other surface conflated:

- `CLEAN` / `UNPROVEN` / `DIRTY` **partition** the nine-verdict codomain; exit **3** is UNPROVEN,
  exit **1** is DIRTY, and **dirty outranks unproven** so a finding never hides behind a no-answer.
- `--allow-unproven` and `--allow-dirty` each acknowledge exactly one class. There is deliberately
  no flag that accepts both without saying so.
- `--allow-orphans` is **refused by name** (exit 2, message naming both successors). Aliasing it was
  the one-line option and was rejected: the habit of reaching for it to get a green bar *was* the
  defect, and an alias keeps that habit working.
- `manifest.outcome` records the class counts, what was acknowledged, and `byteProofAvailable`.

â­ **Two things the fix found that the filing had not.** (a) The flag's **name was wrong about its
own reach** â€” it read *"allow ORPHANS"* while equally accepting `MISSING_BYTES` (bytes destroyed,
metadata still advertising them â€” under Rule 12 the *worse* direction) and `DIVERGED_BOTH_WAYS`.
(b) `selftest` **exited on the docker gate before running anything**, so on every machine a *Cloud*
operator uses â€” the exact population this instance is about â€” the number of controls that ran was
**zero**, while a third of them needed nothing but the functions under test. The pure half now runs
first and the skipped half is reported **with a count**: *"nothing failed" is not "nothing ran"*.

**Controls, all observed RED before the fix** (three mutants of the shipped file, 2026-08-19):
restoring the pre-fix binary classification reds **C20/C21/C22/C22b/C22c** (13/18); re-admitting the
retired flag as an alias reds **C23** (17/18); removing one verdict from its class set reds **C19**
(17/18). Unmutated: **18/18**. âœ… **And the end-to-end CLI arms RAN** (local stack, same day):
`selftest` **26/26** (18 pure + 8 byte-level), `rehearse` **25/25** â€” **R6-capture** blind â†’ exit **3**
(was 1) against its sighted twin at exit 0; **R10** a real orphan *under `--allow-unproven`* â†’ exit
**1** with `accepted: []` â€” *the exact state that exited 0 before this change*; **R10b** same orphan
under `--allow-dirty` â†’ exit 0, `accepted: ["dirty"]`; **R10c** blind under `--allow-unproven` â†’
exit 0, `byteProofAvailable: false`.
â­ **C19 is the keystone and it is aimed at the NEXT instance, not this one:** the original defect was
a codomain that grew to nine verdicts while the classification stayed binary, so each new verdict
silently inherited *"not-clean â‡’ suppressible by the one flag"*. C19 requires every verdict to have
exactly one home, C19b requires `ALL_VERDICTS` to be checked against what `verdictFor` actually
returns rather than against itself, and C22c makes an unclassified verdict fail **closed** at runtime.

**Instance 2 â€” `.list('')` on an absent bucket (FIXED in `d2b19808`, kept here as evidence).**
`admin.storage.from(b).list('')` on a bucket whose **row is gone** returns `{data: [], error: null}` â€”
an empty list, **not** an error. So "the bucket does not exist" and "the bucket has no objects" were
literally the same value, and `delete --execute`'s post-deletion classifier took the **reassuring**
branch â€” *"PRE-EXISTING METADATA-LESS ORPHANS â€¦ not a failure of this deletion"*, with no
`DO NOT PROCEED` â€” for a bucket it had never interrogated, **on the destructive path**. Now gated on
`getBucket`, which does error, and pinned by rehearsal arm **R3d**.

â­ **How instance 2 was found is the part worth keeping.** Step 0 named the state *"bucket row absent
+ bytes present"* as never observed, with **no control anywhere in the tool**. It surfaced only
because a control was built for a state nobody had seen â€” not by review, and not by any run of the
existing 15 controls.

âš  **Correcting the frequency claim, which was wrong in the present tense** (QA MINOR-6; the lead's
ruling that prompted it is withdrawn on this point). *"It is the state all eight retired buckets are
in"* is **false as of today** â€” measured, the eight retired buckets hold **0 bytes** and have **no
directory on the volume**; the volume root holds only the four survivors. They **were** in that state
between the retirement migration and the stack recovery that destroyed the 221 files, and a **Cloud**
retirement produces it **by construction**. So: true historically, true for Cloud, false now. â­ And
the frequency argument was never the load-bearing one â€” **R3d's own reason is sufficient and needs no
appeal to how common the state is**: the classifier printed the reassuring arm, with no
`DO NOT PROCEED`, **on the destructive path, for a bucket it had never interrogated.**

**Instance 6 â€” ðŸŸ  `verdictFor` read a missing volume DIRECTORY as "consistent and empty". Found by QA
(MAJOR-1) by CONSTRUCTING the state. âœ… FIXED.** Three API-visible keys plus a removed volume
directory verdicted `CONSISTENT_EMPTY` â€” a member of `CLEAN_VERDICTS` â€” so `capture` printed **CAPTURE
CLEAN and exited 0** over a bucket whose PHI bytes were gone.

- â›” **Non-monotonic in severity:** lose *some* of a bucket's bytes (directory survives) â‡’
  `MISSING_BYTES`, dirty, exit 1. Lose **all** of them (directory removed) â‡’ clean, exit 0. **The
  worse state reported better.**
- â›” **It is the state a volume loss with the DB intact produces** â€” `supabase stop`/`start` without a
  `db reset`, i.e. **FUP-DM5-STACK-CYCLE-DESTROYS-BYTES**, which has already fired once in this phase
  in the *other* direction. Under Rule 12 this is the worse direction: the metadata still advertises
  the PHI file as present and servable, `disposal_state` says nothing is owed, and
  `document-reconciliation.mjs` lists from the same API and cannot see it either.
- â­ **It was the SIBLING of the branch this slice had just fixed**, two lines below it, in the same
  function, in the same commit. The fixed branch's own comment says *"a verdict that treats a missing
  ROW as proof of a missing object is the withdrawn method wearing the tool's badge"* â€” and the next
  branch did it with a missing **directory**. **The transferable rule: a fix applied to one arm is a
  question asked of every sibling arm â€” diff their guard sets.**
- **Fixed** in `verdictFor`, pinned red-first by rehearsal **R7** (+ permissive twin R7-twin) and
  selftest **C14/C15**, both observed RED before the fix (`api_keys=5 volume_present=false exit=0
  verdict=CONSISTENT_EMPTY`).

**Instance 6b â€” ðŸŸ  the same branch also read a FAILED measurement as emptiness. Found by doing the
guard-set diff the fix implies. âœ… FIXED.** `volumeCensus`'s catch returns `{present:false, error}`
when its `docker exec` fails for a bucket, and that mapped to `CONSISTENT_EMPTY` â€” **variant 1 ("I
could not look") living inside `verdictFor` itself.** Now `UNVERIFIED_PROOF_ERROR`, non-clean, pinned
by selftest **C16**. â­ *The guard-set diff was asked for and it found a second gap the reviewer had
not seen* â€” which is the argument for doing the diff rather than fixing the reported instance.

**Instance 3 â€” ðŸ”´ `complete_document_disposal` persists the confusion as a REGULATORY ASSERTION.
LEAD-RULED 2026-08-17: it IS this class, and it is the worst instance of the three.** The door's
absence check reads **`storage.objects`** â€” the metadata table (quoted from the live catalog in
`docs/deployment/phi-disposal-runbook.md` Â§4). So `disposed` proves the metadata row is gone and
**not** that the bytes are gone.

**Why this instance outranks the other two, and the reason is not technical.** Instances 1â€“2 are
**tool output an operator reads and can second-guess**. Instance 3 is a **persisted record that
asserts a fact to a regulator.** A `disposal_state = 'disposed'` row meaning *"metadata row absent,
bytes unknown"* is a **false compliance assertion** under LGPD / ANVISA-RDC / CFM 1821-2007, inside a
20-year-retention system, on the one record class whose entire purpose is to evidence that PHI was
destroyed.

â›” **And it compounds with S5.R, which is the sentence that makes the severity legible:** on Supabase
Cloud there is **no volume proof** â€” `locateVolume()`'s preconditions (`STORAGE_BACKEND=file` plus a
`supabase_storage` container on the operator's own machine) cannot hold there. So on Cloud "bytes
gone" is not merely *unchecked*; it is **unverifiable by the method we have**. Which means
**`disposed` can never mean more than "metadata gone" on Cloud unless something changes** â€” either
FUP-DM5-CLOUD-ORPHAN-SURFACE settles that an orphan-visible surface exists, or the door's contract is
amended to say what it actually verifies. Until one of those happens, every Cloud disposal record
carries a claim the platform cannot substantiate.

> ### âœ… BOTH ALTERNATIVES RESOLVED â€” instance 3 is DISCHARGED (2026-08-19)
>
> The paragraph above named two exits. **Both were taken, in the order that matters.**
>
> 1. **The door's contract was amended** â€” ADR 0121 **D4**, shipped as `20260928000400`. `disposed`
>    now writes `disposal_evidence` beside the state: `metadata_absent` + `metadata_source` (what it
>    genuinely checks) and `byte_proof` from a **closed** vocabulary
>    (`local_volume_verified` / `unavailable_on_platform` / `not_attempted`). An unconstrained
>    free-text field would have been the same defect one layer up. `FUP-DM5-BYTE-PROOF-NOT-ATTEMPTED`
>    then fixed the caller half: the one lane that actually deletes bytes declares
>    `unavailable_on_platform` rather than riding the `not_attempted` default.
> 2. **The Cloud question was MEASURED, and answered NO** â€” 2026-08-18, `cloud-orphan-probe.mjs`
>    against the live project. All five customer-reachable surfaces are metadata-bound; a byte with
>    no `storage.objects` row is invisible to every one of them *while provably still existing*
>    ([cloud-orphan-probe-2026-08-18.md](./cloud-orphan-probe-2026-08-18.md)).
>
> â­ **The second point is what discharges this, and it is worth stating precisely.**
> `unavailable_on_platform` was written as a holding value â€” true, but pending a better proof. The
> probe converts it into the **permanent and complete** answer: there is no better proof, and there
> will not be one without a change on Supabase's side. A record saying *"metadata absent; byte proof
> unavailable on this platform"* is now **exactly as strong as the truth**, which is the entire
> demand this instance made. The claim the platform could not substantiate is no longer being made.
>
> â›” **Not established, and it must not be read in:** that orphaned bytes are *absent* on Cloud. The
> probe proves they are **unobservable** â€” the opposite of reassuring. Under Rule 12 that is a
> standing, PO-ratified limit (ADR 0120 D9 amendment), not a closed risk.

â­ **Filed undecided rather than merged on backend's own judgement â€” the lead ruled that was the
correct call, and it is noted as such.** The alternative (quietly folding it into the class, or
quietly giving it its own id) would have made a severity decision with regulatory weight inside an
implementation slice.

**Instance 4 â€” ðŸŸ  destruction: a file UNLINKED recorded as bytes UNRECOVERABLE. âœ… RESOLVED in the
runbook by the PO's encryption decision.** Found while writing the mitigation for instance 3 â€” *inside
the fix for the previous instance*, which is itself the argument for having a class statement rather
than four separate tickets. `rm` proves the **directory entry** is gone; it proves nothing about the
blocks, and less than nothing on copy-on-write filesystems, SSDs with wear levelling, or any volume
that has ever been snapshotted. **Resolution (PO, 2026-08-17): destroy the KEY first, then delete the
archive.** Cryptographic erasure is the load-bearing act â€” residual ciphertext is unrecoverable
without the key regardless of what the filesystem did â€” and deleting the archive is hygiene, not
proof. The log records **both, stating what each one proves.** That is deliberately more honest than a
`shred` claim, which could not be verified on this platform anyway. Written into
`docs/deployment/phi-disposal-runbook.md` Â§6b.

â­ **The sharpened statement immediately earned itself â€” a fifth instance was caught BEFORE it shipped,
which is exactly the use the lead named.** While verifying the runbook's encrypt-at-creation pipeline
(2026-08-17): `docker exec â€¦ tar -cf - -C /mnt stub` **fails on Git Bash for Windows** â€” MSYS path
translation rewrites `-C /mnt` to `C:/Program Files/Git/mnt`, tar exits 1 having written **0 bytes** â€”
and with stderr suppressed the encryptor consumes the empty stream and 7-Zip prints **"Everything is
Ok"**. The action was performed (a backup command ran and reported success); the state was **not**
achieved (a valid, well-formed, entirely **empty** encrypted archive). Recognised as this class on
sight rather than shipped as a command, and the runbook now carries both the working invocation and a
**mandatory** count-vs-census verification step. **Not filed as a 5th open instance â€” it never
reached the document.**

### â¬› FUP-DM5-CLOUD-ORPHAN-SURFACE â€” âœ… **RESOLVED 2026-08-18 by measurement: Cloud exposes NO orphan-visible surface** (owner: backend + lead; **input to the deploy runbook**)

> ## âœ… MEASURED 2026-08-18 â€” **every Cloud surface is METADATA-BOUND**
>
> Full run record: **[cloud-orphan-probe-2026-08-18.md](cloud-orphan-probe-2026-08-18.md)**.
> Instrument: [`scripts/cloud-orphan-probe.mjs`](../../scripts/cloud-orphan-probe.mjs), run
> `20260818-072590` against `azkbbhskturikxpgmafq`.
>
> An orphan was **constructed** on the linked project per TRIAGE #1 and five surfaces were
> asked: S3 `ListObjectsV2` under **both** auth modes (session-token *and* dashboard access
> keys), Storage REST `/object/list`, Storage REST `GET /object`, and
> `supabase storage ls --linked`. **All five PROVEN** by the before-state control; **all five
> saw nothing.** The byte was proven still present in the same run (row restored â†’ HTTP 200,
> correct bytes, `cf-cache: MISS`), so no arm is vacuous.
>
> â‡’ The answer is the conservative branch this item hoped against: **ADR 0120 D9's byte-side
> controls are NOT recoverable on Cloud**, and the Cloud byte half is **structurally
> unverifiable** â€” now *measured*, not inferred. The runbook's "asserted, not verified"
> posture for the Cloud byte half is **correct and evidenced**; nothing can contradict it.
>
> â›” **"No orphan surface" is not reassurance.** It does not say orphaned bytes are absent â€”
> it says they are **unobservable**. That is strictly worse, and it is the settled answer.
>
> â­ **The human blocker never actually existed.** This item was blocked for its whole life on
> "S3 access keys must be minted in the dashboard â€” a human step, not scriptable from here."
> Supabase's S3 endpoint also accepts **session-token auth** (`access_key_id` = project ref,
> `secret` = anon key, `session_token` = a JWT), which needs no dashboard step. Keys were
> minted anyway and both modes measured, because session-token auth respects RLS and would
> have left a confound. *A blocker recorded as external can be an unchecked assumption.*
>
> âš  **Two instrument defects were caught by the probe's own controls, in flight** â€” both now
> encoded in the script, both generalisable, detail in Â§5 of the run record:
> 1. **The proof-of-life contaminated its own subject.** The first run reported
>    `ORPHAN-VISIBLE` on byte retrieval â€” a **false positive**: a CDN fronts Cloud GETs, and
>    the *before-state control GET* primed the cache that then served a 200 for a byte the
>    origin was already refusing. â›” A cache-buster param does **not** defeat it (`HIT`
>    survived one); only a never-requested path does.
> 2. **Cleanup could have added to the population it measured.** The API deletes
>    `<bucket>/<name>/<version>`; restoring an orphan row with an invented `version` reports
>    success and leaves the file. The `version` is now captured before the delete.

> ## â­• ESCALATED 2026-08-18 â€” **`FUP-DM4-PRODROW` IS NOW BLOCKED ON THIS PROBE (PO ruling), and the probe has a REAL subject**
>
> Reverse of the ruling recorded in PRODROW's body â€” recorded here too so **neither item can be read
> alone**, per this item's own promotion ruling.
>
> **What changed.** The 2026-08-18 remote census found the production DB empty, and the logs dated the
> cause: a **remote reset at `2026-08-17 11:37:35Z`**. `storage.objects` reads **96 inserted / 47 deleted
> / 0 live** â€” the 47 reconcile with the S4 bucket retirement (buckets: 16âˆ’12=4, exact), which leaves
> **~49 objects that vanished with no `DELETE`**.
>
> â­ **A reset rebuilds `storage.objects`; it does not necessarily delete the bytes behind them, and
> whether it orphans them is CLI-VERSION DEPENDENT** â†’
> [[remote-reset-storage-orphan-is-cli-version-dependent]]. So this item is no longer a hypothetical
> about a synthetic byte â€” **there is now a concrete population of ~49 likely-orphaned objects on the
> production project**, and the metadata that would say what to look for is gone.
>
> âš  **The TRIAGE #1 method does not change and is not weakened.** It is *still* correct to **construct**
> an orphan rather than probe for one: the ~49 cannot be enumerated (no rows point at them), so they can
> confirm the *consequence* but can never serve as the *detector's* positive control. Construct, measure,
> then ask what the answer implies for the 49.
>
> â›” **Still blocked on a human step:** S3 access keys must be minted in the Supabase dashboard.

> ## âœ… METHOD RULED 2026-08-18 (DM-FUP TRIAGE #1) â€” **construct an orphan; do not probe for one**
>
> â›” **This item's own framing was wrong, and in the reassuring direction.** It calls the S3 probe
> *"the single measurement that would settle it."* As framed it settles nothing: **the remote holds 0
> objects**, so a read-only probe can show only that the endpoint *answers* â€” never that it would
> **reveal** an orphan. A detector run against a population with nothing to find returns clean either
> way. â†’ [[detector-that-finds-nothing-must-be-proven-able-to-find-something]]
>
> **The ruled method, on the LINKED project:**
> 1. Mint S3 access keys (Project Settings â†’ Storage). *A human step; it is not scriptable from here.*
> 2. Upload a **synthetic, non-PHI** byte to a scratch path.
> 3. Delete its `storage.objects` row â€” this **constructs** the orphan the question is about.
> 4. Ask the S3 endpoint whether the byte is still listed. **That answer is the measurement.**
> 5. Clean up, and record the run.
>
> â›” **A throwaway project was declined.** It answers for a *different* project's storage config, so
> the result would be an inference about `azkbbhskturikxpgmafq` rather than a measurement of it â€” the
> same grain error this record has already been burned by twice.
>
> âš  **Sequencing, binding:** this probe needs a live, writable remote. `FUP-DM4-PRODROW`'s sanctioned
> "cheap path" (a remote reset) would **destroy the surface this measurement runs on**, so the reset
> may not precede it (DM-FUP TRIAGE #6).

Filed 2026-08-17 (backend, S5.D). Filed explicitly so it **cannot become settled by silence** â€” the
current state of knowledge is *"we do not know"*, and that is not the same as *"there is none"*.

âš  **NOT A NEW QUESTION â€” a PROMOTION. âœ… LEAD-RULED 2026-08-17: the promotion is RIGHT. KEEP IT
PROMOTED; CROSS-LINK, DO NOT MERGE DOWNWARD.** The parenthetical *"(no customer-accessible tool may be
able to SEE an orphan; S3-protocol endpoint UNPROBED)"* still lives inside **FUP-DM5-STORAGE-ORPHANS**'
open **Cloud half**, under a headline that reads *"closes empty by measurement"*.

**The ruling's reasoning, recorded because it generalises past this item:** *an item that can change a
verdict does not live inside the parentheses of the verdict it would change.* This is the same defect
this phase keeps paying for â€” ADR 0120's own root-cause #3 (*a supersession marker only a raw-file
reader can see is not a marker*) and the S2 reopen-banner defect (*a marker merely DISTANT is no
better than one that is hidden*). A buried obligation gets discharged by association the moment its
parent looks resolved.

**Neither item is closed by closing the other.** FUP-DM5-STORAGE-ORPHANS keeps its local half and its
`npm update` / dependency-source lesson; this item owns the Cloud measurement. â›” An earlier draft of
this body offered "merge downward if you prefer one item" â€” **that option is withdrawn by the ruling.**

**Cross-links (both directions, so neither can be read alone):** parent â†’
FUP-DM5-STORAGE-ORPHANS (Cloud half). Consumer â†’ **FUP-DM5-NO-ANSWER-VS-NOTHING instance 3 (ðŸ”´)**,
which is *blocked on this measurement*: until it is settled, `disposal_state = 'disposed'` cannot mean
more than "metadata gone" on Cloud.

### â›” The question was framed WRONG, and QA r1 corrected it: the Cloud risk is not a MISSING proof â€” it is a FAKE one

Added 2026-08-17 from QA MAJOR-2. This item, ADR 0120 D9 and the runbook all rested on *"on Cloud you
lose the local volume proof"*. **Source-level fact:** `locateVolume()` finds its container **by name
pattern via `docker ps`** and takes the root from that container's env â€” it is **never given the
project URL**, and nothing cross-checked the two. The two preconditions are at **different grains**:
`STORAGE_BACKEND=file` is a property of the **project**, a running `supabase_storage` container is a
property of the **operator's machine**. A developer machine with `supabase start` up â€” the normal state
for anyone who can run this repo's gates â€” satisfies the container half **while the client points at
Cloud**.

**Inference, NOT executed against Cloud (and it must not be recorded as though it were):** such a run
would get `localProof.available = true`, a census of the **wrong project's volume**, and â€” for any
manifest bucket absent locally â€” a printed **byte-level assurance for a Cloud deletion that was never
checked**. *No proof refuses visibly; a proof about the wrong bytes passes.* **Strictly worse than
losing the proof**, and the runbook previously told the operator it was impossible.

âœ… **GUARDED IN THE TOOL** (not left to discipline): `locateVolume()` now refuses when
`NEXT_PUBLIC_SUPABASE_URL` is not a local origin while a local container is running, downgrading the
proof to unavailable and printing the reason. Measured with a Cloud URL against a running local stack.
The guard sits in `locateVolume()` so **every** subcommand inherits it from one place, and both
polarities are pinned by selftest **C17**. This makes the "DOMAIN: LOCAL stack only" banner
**enforceable rather than advisory**.

âš  **What this does NOT settle, and why the item stays open:** the guard prevents the fake proof; it
does not create a real one. On Cloud there is still **no** byte-level proof, so the S3-endpoint
measurement above remains the thing that would change what a Cloud run can be trusted to have proved.
And the composite Cloud consequence above is **still an inference** â€” no remote contact has been made.

**What IS established** (measured, local, S5.R): every byte-side control in `storage-manifest.mjs`
depends on `locateVolume()`, whose preconditions are `STORAGE_BACKEND=file` **plus** a
`supabase_storage` Docker container on the operator's own machine. Neither can hold for a Cloud
project. With the proof forced unavailable, an under-count `delete --execute` exits **0 while a real
file survives** (arm R6); the over-count refusal survives, being API-only (R6b). So **two of ADR 0120
D9's four controls do not survive the loss of local proof, and both lost ones are the byte-side ones.**

**What is NOT established, and must not be inferred:** that Cloud therefore has *no* way to see an
orphan. That step is exactly the reasoning D17's remote half got wrong â€” "same mechanism class" is
not evidence (see [[a-remote-reset-orphaning-storage-was-a-CLI-VERSION-window]]). The bridge we do
have is the absence of a precondition readable in the source, which bounds **this tool**, not the
platform.

**The specific measurement that would settle it:** Supabase Cloud exposes an **S3-compatible
endpoint** for Storage (`https://<ref>.supabase.co/storage/v1/s3`, with S3 access keys issued from the
dashboard). An S3 `ListObjectsV2` enumerates the *backing store* rather than `storage.objects`, so **if
it lists an object whose metadata row is gone, Cloud has an orphan-visible surface and D9's byte-side
controls are recoverable there**; if it lists from the same metadata, it does not and the byte half is
structurally unverifiable on Cloud. **It has not been probed** â€” probing it needs (a) PO
authorization to touch the linked project, and (b) an orphan to look for, which means deliberately
manufacturing one on Cloud, which is its own decision. Secondary, cheaper probes worth the same run:
whether the dashboard's Storage explorer reads metadata or the store, and whether
`supabase storage ls --linked --experimental` differs from a `storage.objects` query.

âš  Until this is settled the deploy runbook must treat the Cloud byte half as **asserted, not
verified**, and say so in the disposal record â€” which
`docs/deployment/phi-disposal-runbook.md` Â§Â§4, 6 now does.

### â¬› FUP-DM5-BACKUP-IS-PHI-EXPORT â€” âœ… **RESOLVED 2026-08-19** â€” a Storage backup is an **unmanaged plaintext PHI export**, and the disposal runbook instructs a human to create one (owner: PO decision, then backend + lead; **Rule 12 / LGPD / ANVISA-RDC**)

> ### âœ… RESOLVED 2026-08-19 â€” both remaining deliverables discharged, by execution
>
> The item's own close condition was **(a)** the literal destination path recorded in the run log at
> first execution and **(b)** the procedure actually exercised. Both are now done, and the record is
> **[`docs/deployment/phi-backup-run-log.md`](../deployment/phi-backup-run-log.md)**.
>
> **(a) Destination â€” PO-set 2026-08-19.** Archive `D:\phi-backups`; key
> `C:\Users\micha\phi-backup-keys` â€” deliberately a **different volume**, discharging "key stored
> separately". Both passed `phi_backup_dir_ok`, and both are now **owner-only** (see F1).
>
> **(b) Executed â€” Â§ 6b end-to-end on the local stack.** Census **812 files / 14,691,282 bytes /
> 231 PHI-tier** â†’ `tar` streamed straight into `openssl enc` (**encrypted at creation, no plaintext
> intermediate ever on disk**) â†’ **catalog-compared 812 = 812** plus a per-object `sha256` content
> proof â†’ **key destroyed first, then the archive**, in the exact wording custody mode **B** permits.
> **No recovery point retained** â€” the destruction step cannot be rehearsed without performing it.
> â­ The verification was **proven able to refuse** first: an empty-source archive built through the
> same pipeline is a *valid, well-formed 10,272-byte archive with pipe status `0 0`*, and the count
> check rejected it.
>
> â›” **What this does NOT discharge, stated so the close is not read wider than it is.** Â§ 3 (the
> disposal sequence) was not run: **C1a stands** â€” it was *additionally* blocked by
> `FUP-DISPOSAL-CHILD-LOCK-BLOCKS-PHI-ERASURE`, âœ… **resolved 2026-08-19 (ADR 0129), so that
> second block is gone and C1a is now runnable** â€” but C1a stands on its own terms until Â§ 3 is
> actually executed. **C1b stands**, and cannot inherit this run: the mechanism is local-only
> *by construction*.
>
> **Six findings; four changed instructions in Â§ 6b.** Full text in the run log.
> - **F1 â›” the mandatory sync check green-lit a world-readable destination.** `phi_backup_dir_ok`
>   returned âœ… for a directory carrying `BUILTIN\Users:(RX)` + `Authenticated Users:(M)` by
>   inheritance from the drive root. The check asks *is it synced? is it in git?* and is heard as
>   *is it safe to write PHI here?* Fixed: inheritance broken, owner-only, and a
>   `phi_backup_dir_readers_ok` allow-list check added beside it. â­ Two barbs worth keeping: the
>   **better** backup practice (separate volume) is what exposed it â€” `C:\Users\<you>\â€¦` would have
>   inherited a safe ACL and hidden it â€” and my **first** version of the new check was a deny-list
>   that **passed its own positive control**, printing `BUILTIN\Users:(RX)` and returning âœ…. A
>   machine-local group (`MIKE_PC\CodexSandboxUsers`) then appeared on an unrelated directory, which
>   no hand-written deny-list could ever have held. *Enumerate the permitted set; report the rest.*
> - **F2** `7z a -si` **cannot take a non-interactive passphrase at all** (stdin is the tar stream;
>   no keyfile flag, no fd, no env var), so the one printed mechanism is unusable by the automated
>   backup this item predicts. An `openssl â€¦ -pass file:` form is now the **mode-B** mechanism, and
>   Â§ 6b states the mechanism **per custody mode**.
> - **F3** every path handed to a native binary must be `cygpath -m`'d â€” an MSYS-form `-pass file:`
>   yields a **0-byte archive with tar's status 0**. *Third instance of the same path-translation
>   trap*; the hazard is "a path crossed into a native binary", not any one flag.
> - **F4** â›” **`set -o pipefail` is required â€” trap #2 was necessary but not sufficient.** Measured
>   with stderr fully visible: tar's error printed, `$? = 0`, 32-byte well-formed archive. A human
>   watching sees the failure; **a script sees success.**
> - **F5 â†’ `FUP-DM5-BACKUP-HAS-NO-CLOUD-FORM` (ðŸ”´)** â€” the residue this close does *not* absorb.
> - **F6 â†’ `FUP-DM5-DB-DUMP-AND-SCRATCH-DB-UNGOVERNED` (ðŸŸ )**.

Filed 2026-08-17 (backend, S5.D) **on lead ruling â€” filing was ruled not optional.** â›” **Not
hypothetical: the S5 drill created one.** A `docker cp` of the live storage volume produced **245
files / 2,456,666 bytes including 68 PHI-tier files, in plaintext, outside every platform control** â€”
âš  *those 68 are PHI-tier **by bucket**, from local seed/E2E artifacts, not real patient data* (QA
INFO-5): the drill itself was **not** a live PHI incident. The ðŸ”´ grades the **mechanism as it applies
to production**, where the same command over `documents-phi` yields real records â€”
no RLS, no `open_document_version` door, no PHI-access audit row, no signed-URL TTL, no encryption
beyond whatever the host filesystem provides. That copy was deleted after verification; **the
mechanism that made it remains, undocumented.**

**Why it is ðŸ”´ rather than a hygiene note:** every safeguard in Rule 12 â€” the tightest RLS, the audited
single door, the tier-keyed TTLs, platform at-rest encryption â€” governs bytes *inside* the platform.
A volume snapshot steps around all of them at once, by design, because it is Supabase-unaware (that is
precisely why it is the only mechanism that captures orphans). The backup is therefore the **widest
PHI egress path the system has**, and it is the one with **no** documented location, permitted reader
set, retention period, or destruction step.

â›” **The operational sting, and the reason this had to be filed before the runbook reaches the PO:**
`docs/deployment/phi-disposal-runbook.md`'s backup half **instructs a human to create exactly this
export.** *A procedure whose correct execution produces an undocumented plaintext PHI copy is not a
complete procedure.*

âœ… **RESOLVED IN THE RUNBOOK â€” PO set all five values 2026-08-17** (Â§6b): **encryption** (encrypted
archive, `age` / 7z-AES, **encrypted AT CREATION** so bytes are never plaintext on disk at any point â€”
explicitly *not* "`docker cp` then encrypt", which leaves a plaintext window; key stored separately) Â·
**location** (outside the repo **and** outside any synced folder, with a **mandatory** sync-root check,
because a copy into a synced directory silently replicates 68 PHI-tier files to a third-party cloud
and nothing in the platform would notice) Â· **reader set** (the accountable owner alone, pre-pilot;
never attached to an issue or support ticket) Â· **retention** (until the next backup is *verified
good*, max 30 days, whichever first â€” exactly one recovery point at a time) Â· **destruction** (key
first, then archive â€” instance 4 above).

â­ **The retention rationale is written into the runbook, because the obvious reading inverts it:** the
20-year LGPD/ANVISA/CFM obligation belongs to the **system of record, not to backup copies.** A backup
kept 20 years satisfies nothing and creates two decades of PHI liability in a second location with no
RLS, no audit and no access control. **Short backup retention is a safety property, not a
compromise** â€” stated explicitly so a future reader does not "fix" 30 days up to 20 years believing
they are improving compliance.

âš  **"Verified good" is defined as CATALOG-COMPARED, never `psql` exit 0**, and the runbook cites this
program's own drill as the reason (exit 0, **490** real errors, **90 of 274** policies restored). The
retention rule authorises destroying the only other copy, so the phrase carries the weight of the
whole rule and may not rest on a signal already proven false.

**What remains before this can close:** the **literal destination path** is recorded in the run log at
first execution (the *rule* is decided; the path is per-machine), and the first monthly run must
actually exercise the procedure â€” see the UNREHEARSED gap. âš  Note the interaction with the drill's
other finding â€” the byte half has **no** first-class tooling, so any future automated backup will be
built on one of these two mechanisms, and whichever is chosen inherits this item.
Related: **FUP-DM5-STACK-CYCLE-DESTROYS-BYTES** (the same volume, the destructive direction) and
**FUP-DM5-NO-ANSWER-VS-NOTHING** instance 3 (the same bytes, the *disposal-assertion* direction).

### ðŸ”´ FUP-DM5-BACKUP-HAS-NO-CLOUD-FORM â€” the Â§ 6b procedure is **local-only by construction**, and on Cloud there is **no Storage backup at all** (owner: PO decision, then backend + lead; **Rule 12 / LGPD / ANVISA-RDC**)

Filed 2026-08-19, from the Â§ 6b first execution (finding **F5**;
[run log](../deployment/phi-backup-run-log.md)). **This is the residue that
`FUP-DM5-BACKUP-IS-PHI-EXPORT`'s close does not absorb**, named rather than dropped.

> â­â­ **PROMOTED TO Â§ Critical FUP as C3 on 2026-08-19, by explicit PO instruction** â€” the only way
> an entry may land in that section. Its **trigger** lives there: â›” *before any real patient record
> is loaded.* âš  That is the same instant as **C1**'s trigger and for the **opposite** reason â€” C1 is
> about *destroying* bytes on request, C3 about *not being able to get them back*. Two items, one
> deadline, easy to conflate; the Â§ Critical FUP rows say so on both sides.

The mechanism Â§ 6b prescribes is `docker exec supabase_storage_<ref> â€¦ tar`. That cannot reach a
Supabase-managed project. What is available on Cloud instead, **measured against Supabase's own
documentation, not inferred**:

| candidate | verdict |
| --- | --- |
| managed **daily backups / PITR** | *"Database backups do not include objects you store via the Storage API"* â€” the DB holds only metadata ([platform/backups](https://supabase.com/docs/guides/platform/backups)) |
| **"Restore to a new project"** | storage objects and bucket settings are listed under *what needs manual reconfiguration* â€” **not copied** |
| `supabase storage cp -r --linked` | takes a destination **path**; there is no stdout/streaming form, so it writes **plaintext PHI files to disk** |

â‡’ Three consequences, each of which invalidates a sentence that currently reads as settled:

1. **On the platform the pilot runs on, there is no Storage recovery point** â€” not governed, not
   ungoverned, not managed. Â§ 2's *"if the stack must be cycled, take the Â§ 6b backup first"* has no
   Cloud analogue.
2. **The Â§ 6b "encrypted AT CREATION, never plaintext on disk at any point" decision is
   unsatisfiable on Cloud with available tooling** â€” and the vendor's own advice ("download storage
   objectsâ€¦ store in a secure location") is *exactly* the ungoverned plaintext export this whole
   item family exists to prevent. The PO decision stands; the means to obey it does not exist.
3. âš  **`FUP-DM5-BACKUP-IS-PHI-EXPORT`'s production framing was premised on a mechanism that is not
   available in production.** It graded *"the mechanism as it applies to production, where the same
   command over `documents-phi` yields real records"* â€” the same command cannot be issued there. The
   Cloud risk is **not** an over-wide export; it is an **absent** backup plus whatever the operator
   improvises. Different risk, different remedy, and it needed its own item to stay visible.

**Decision owed from the PO** (this is a risk acceptance, not an engineering call): either
(a) accept that Storage has no recovery point pre-pilot and say so where a pilot decision is made, or
(b) name a Cloud mechanism â€” S3-protocol client against the Storage endpoint piped into an
encryptor is the only shape that could satisfy "encrypted at creation" â€” and then it must be
rehearsed like any other. âš  Note (b) overlaps **`FUP-DM5-CLOUD-ORPHAN-SURFACE`**: the S3 endpoint is
**UNPROBED**, and a backup taken through it inherits whatever that probe answers about orphans.

### ðŸŸ  FUP-DM5-DB-DUMP-AND-SCRATCH-DB-UNGOVERNED â€” the runbook's own DB-half verification creates **two plaintext PHI copies with no handling rule** (owner: PO decision, then backend)

Filed 2026-08-19, from the Â§ 6b first execution (finding **F6**).

> â­â­ **PROMOTED TO Â§ Critical FUP as C4 on 2026-08-19, by explicit PO instruction.** Its **trigger**
> lives there: **the first time anyone runs `supabase db dump --linked`** â€” which needs only the DB
> password and is the natural next step of a **C1b** rehearsal. â›” So the ordering matters: do not
> let a C1b run be the first execution of an ungoverned procedure.

Â§ 6b is titled *"PHI handling for the backup half"*, but its five values are scoped, literally, to
**"a Storage backup" / "the archive"**. The same section then requires â€” for the word *"verified
good"*, which authorises destroying the only other copy â€” a `supabase db dump` restored into a
**scratch database**. Neither artifact is named by any of the five values:

- the **dump file**: a plaintext `.sql` holding every narrative, identifier and answer. No location
  rule, no reader set, no retention, no destruction step.
- the **scratch database**: a second live copy of the PHI, which this same page describes as
  *90 of 274 RLS policies restored* â€” *"a restored database missing two thirds of its RLS is not a
  database â€” it is a data leak wearing one"*. **Nothing tells the operator to drop it.**

â­ **This is `FUP-DM5-BACKUP-IS-PHI-EXPORT`'s own sting, one level down, inside the section that
resolved it**: *a procedure whose correct execution produces an undocumented plaintext PHI copy is
not a complete procedure*. The Storage half was governed and the DB half â€” added to the same section
for a different purpose â€” was not, because the scope sentence was written about Storage and the
requirement was added later.

âš  Unlike F5 this one **is** reachable on Cloud today (`supabase db dump --linked` needs only the DB
password), so it is the more likely of the two to happen by accident.

**Interim mitigation, already in the runbook** (not a substitute for the decision): apply the five
values to both by analogy, drop the scratch database as soon as the comparison is recorded, and
record both in the run log. **What is owed:** the PO extending the five values explicitly, or ruling
that the DB half is covered by the managed backups and the restore test is not to be run at all.

### ðŸŸ  FUP-DM5-DISPOSAL-JOB â€” nothing completes a disposal: `disposal_pending` has three inflow doors and **zero automated outflow** â€” â­ **Critical FUP C1** (owner: PO; the decision is discharged, the REHEARSAL is not)

> ## â­• SPLIT 2026-08-18 (DM-FUP TRIAGE #3) â€” **C1a (local) + C1b (Cloud); C1 does NOT close on C1a**
>
> ADR 0121 Amendment 3 required the runbook be executed *"end-to-end, once, against test data"* â€” and
> **named no surface**. That underspecification would have discharged it with a local run. It does not:
>
> - **C1a â€” local.** Run it against the local stack, once, recorded. Debugs the procedure and yields the
>   first **backup destination path** owed to `FUP-DM5-BACKUP-IS-PHI-EXPORT`.
> - **C1b â€” Cloud.** The same run against the linked project. â›” **The pilot-risk acceptance is bounded
>   by C1b.** A green C1a does not release the pilot.
>
> â­ **Why:** the runbook itself says at Â§6 that a local rehearsal *"runs against a local stack by
> construction, so it cannot exercise the Cloud paths above"* â€” and the pilot runs on Cloud. A local-only
> rehearsal therefore discharges the amendment's **wording** while leaving its **purpose** undischarged.
> â†’ [[a-predicate-quoted-at-the-wrong-grain]], in the highest-severity item in the register.
>
> âš  **Heading title is stale in one figure:** it says *"three inflow doors"*. Measured, the queue has
> **four SET-form writers** â€” 3 `authenticated`-reachable plus `complete_document_reclassification`
> (service-role-only). Left in place because the Critical FUP entry carries the correction; noted here so
> the two do not disagree silently a second time.

> ### âœ… PO RULING 2026-08-18 â€” **PILOT RISK ACCEPTED, BOUNDED BY ONE REHEARSAL.** Recorded as **Critical FUP C1**.
>
> The pilot **may proceed** over the manual-only PHI-disposal path, **on one binding condition**:
>
> â›” **[`phi-disposal-runbook.md`](../deployment/phi-disposal-runbook.md) must be executed end-to-end,
> once, against test data, BEFORE any real patient record is loaded.** The acceptance is **not**
> open-ended and does **not** survive the pilot admitting real PHI ahead of the rehearsal.
>
> â­ **The condition is the substance of the ruling, not a caveat on it.** The gap was never a missing
> mitigation â€” the runbook exists, and its owner, cadence and five backup values were all PO-set on
> 2026-08-17. The gap is that **the mitigation has never been observed to work.** This item's own body
> already says it below, in its own words: *"real on paper; real in practice only when the monthly run
> actually happens."* âš  A procedure that has only ever been **read** is a claim about a procedure â€”
> the same defect ADR 0121 **D4** exists to stop, one layer out.
>
> âš  **`disposal_state` therefore means INTENT, not a destruction guarantee â€” and that reading is now
> RATIFIED, not merely observed.** Nothing user-facing, regulator-facing or export-facing may describe
> it as destruction. â­ This **inverts ADR 0099 D10** (*"a stale row nobody looks at harms nobody"*):
> under LGPD, retention past purpose is itself the violation, so for PHI **the stale row IS the harm.**
>
> âš  **D2 is NOT ratified by this** â€” `pg_cron` stays uninstalled and the cron schema still does not
> exist. ADR 0121's D2 design remains ratified-but-unbuilt, kept as what gets built if the manual path
> proves insufficient. **`343_dm5_s5_disposal_gap.sql`'s K6b still asserts "no scheduler exists at
> all"** â€” true today, a **false pin** the day D2 lands; rewrite `343` in D2's slice, never after.
>
> â­ **The rehearsal also discharges a second obligation:** it produces the first **destination path**
> for `FUP-DM5-BACKUP-IS-PHI-EXPORT`, which that item owes *at first execution*. Do not run the
> rehearsal without capturing it.
>
> â›” **This ruling does NOT close the item.** The PO decision is discharged; the rehearsal is the
> deliverable, and C1 leaves the Critical list only when the run has **happened and been recorded**.

Filed 2026-08-17 (backend, S5.D), recording the **PO's deliberate deferral** rather than an
undiscovered defect: at S5.D authorization the PO ruled *document the gap, do NOT build the job* â€” no
`pg_cron`, no scheduled sweep, no second execution context with service-role reach. This item is where
that deferral lives so S6/QA cannot close over it silently.

**Measured, live catalog:** `request_document_disposition`, `dispose_case_phi` and
`dispose_referral_phi` all write `disposal_state = 'disposal_pending'`. `complete_document_disposal`
is the only door that can write `disposed`, its EXECUTE is granted to `postgres`/`service_role` only
(never `authenticated` â€” it was **built** expecting an operational caller), and it has **exactly one
caller in the repository**: `src/lib/documents/actions.ts:377`, inside `reclassifyDocument` â€” an
unrelated copy-then-retire lane. Nothing on the disposition path reaches it. `pg_cron` is not
installed, the `cron` schema does not exist, there is no `.github/workflows/`, and the Dockerfile runs
a single process with no scheduler.

**Mitigation shipped instead of a job:** `docs/deployment/phi-disposal-runbook.md` (manual procedure +
reconciliation). âœ… **Owner and periodicity SET by the PO 2026-08-17**: accountable owner = **the PO
(repo owner)** â€” deliberately not a DPO role, since naming a role that may not be staffed pre-pilot is
the same as naming no owner â€” executor = **whoever holds service-role reach** (ACL-forced, not a
choice), periodicity = **monthly, plus out-of-band on any data-subject request**. âš  The mitigation is
now real *on paper*; it becomes real *in practice* only when the monthly run actually happens, and the
sequence is still **UNREHEARSED**. The gap is pinned executably on both
sides so it cannot rot: `supabase/tests/343_dm5_s5_disposal_gap.sql` (catalog) and
`src/lib/documents/disposal-gap.test.ts` (TS, where the job would most plausibly be built and where
pgTAP is blind). Both were observed RED against real mutations before being trusted green.

â­ **Composition with FUP-DM5-D11-SUPERSEDED-NEVER-RETIRES, which is the other half of the same
lifecycle and must not be resolved in isolation.** D11's gap is that nothing ever *marks* superseded
bytes for disposal (no inflow); this gap is that nothing ever *completes* a marking (no outflow).
**Fixing D11 alone would make things look better and destroy nothing** â€” it would convert silent
retention into a growing pile of `disposal_pending` rows that no code path can clear, while the D11
claim reads as honoured. Whichever is scheduled first, the other must be named in the same decision.

âš  Also note the reconciler interaction: `scripts/document-reconciliation.mjs` classifies
`disposal_pending` as permanently `indeterminate` â€” *never* drift â€” on the stated assumption that "the
completion door is its owner". That assumption was false until the runbook existed, and it is only as
true as the runbook is actually executed.

### ðŸ”µ FUP-DM5-Q1-OPEN-BYTES-CUT-BROKEN â€” âš  **HALF RESOLVED 2026-08-17: the guard no longer fails open; the arm is still a no-op awaiting a NAMED successor** (owner: backend)

> ## âœ… SUCCESSOR NAMED 2026-08-18 (DM-FUP TRIAGE #5) â€” **`app.resolve_document_version_bytes`**, and the arm moves into Critical FUP C2 Tier 1
>
> The item required that the successor be **named, not guessed**. It was **derived from the live
> catalog**, which is the strongest form of naming available here. The byte corridor:
>
> `openDocumentVersion` â†’ `public.open_document_version` / `public.open_printed_document`
> (`prosecdef = t`, granted to `authenticated`; **thin** â€” `assert_documents_enabled` + dispatch)
> â†’ **`app.resolve_document_version_bytes`**, which holds the whole kernel: `app.can_read_document`,
> `app.can_read_referral_phi`, the D15 ceiling, and the disposal/serving-state refusals
> (`HC0DD`, `HC0D8`). The app then signs a short-TTL URL with an **admin** client.
>
> â­ **The item's framing had no target, and that is the finding.** It asks for the arm to be re-pointed
> at a **policy**. There is **no `storage.objects` SELECT policy on document bytes at all** â€” the live
> set is `documents_phi_obj_insert_reserved`, `documents_std_obj_insert_reserved`,
> `form_assets_insert_staff_admin`, and `form_assets_select_member`, the last being the only SELECT and
> not a document path. The gate is a **`prosecdef = t` door whose check replaces RLS**, so the arm's
> class changes from policy-mutation to **door-mutation**. â†’ *`prosecdef` belongs beside `pg_policies`*
>
> â›” **Therefore it is built inside C2 Tier 1, not as a one-off.** Tier 1's 407-door sweep needs exactly
> this machinery, as does `FUP-DM5-SIBLING-GUARD-DIFF`; building it three times was declined. âš  **Being
> absorbed is not being closed** â€” this item keeps its own line and needs its own recorded verdict.

> **âœ… The fail-open half is fixed** â€” `coalesce(v_qual, '') !~ â€¦`. **Proven, not assumed:**
> against the live catalog `v_qual is null` is **true**, the old form evaluates to **NULL**
> so the `if` does not fire and control falls through to `alter policy` on a nonexistent
> policy (**42704**), and the new form **announces the no-op**. A guard nobody had seen
> fire has now been seen firing.
>
> â›” **Deliberately NOT done: silently re-pointing the arm.** The policy
> `attachments_obj_select_readable` was dropped by DM1, so the arm now honestly reports
> that it tests nothing. Retargeting it at whatever current policy *looks* similar would
> make it assert something nobody chose â€” the successor must be **named** by whoever owns
> the case-bytes read path today. Downgraded ðŸŸ¡ â†’ ðŸ”µ: it is now legible rather than
> deceptive.

Filed 2026-08-17 (lead) from QA's DM5Â·S4 review MINOR-3. **Pre-existing â€” NOT S4's doing**, and
explicitly not charged to it.

`supabase/tests/mutation/q1-quality-mutation-audit.sh:140-153` (`open_bytes_cut`) targets policy
**`attachments_obj_select_readable`** on `storage.objects`. The catalog has **0** such policies â€”
dropped by `20260923000100_dm1_drop_attachment_substrate.sql` (**DM1**, weeks before S4).

â­ **The interesting part is the guard, not the staleness.** The arm protects itself with
`if v_qual !~ 'read_case_deliberation' then raise â€¦` â€” intended to announce a no-op. With the policy
absent, `v_qual` is **NULL**, `NULL !~ 'â€¦'` evaluates to **NULL**, the `if` does not fire, and control
falls through to `alter policy` on a nonexistent policy â†’ **`42704`**. *A guard written to announce
"MUTATION NO-OP" instead fails open into an error* â€” three-valued logic eating the one branch that
existed to make the failure legible. Same family as
[[guards-that-read-right-but-fail-open]] and [[a-silent-return-hides-a-live-defect]].

**Fix:** re-point the arm at a live policy (or retire it with a named successor), and make the guard
NULL-safe (`coalesce(v_qual,'') !~ â€¦`). Then prove it can announce a no-op â€” a guard nobody has seen
fire is not a guard.

### ðŸŸ  FUP-DM5-D9-NO-ARM-SEES-A-BYTE-POST-RETIREMENT â€” after `â€¦000400` applies, the retirement tool has no Cloud-visible arm left (owner: backend; **input to S5/S6 + the deploy runbook**)

Filed 2026-08-17 (lead) from QA's DM5Â·S4 review MINOR-5. **Scoped to the new half only** â€”
FUP-DM5-STORAGE-ORPHANS is separately open and not re-litigated here.

> â­ **UPDATE 2026-08-17 (DM5Â·S5, QA r1 INFO-3) â€” the LOCAL half of this item is now materially
> better; the CLOUD half is untouched and the item does NOT close.** Two `verdictFor` fixes landed in
> S5 and both redden states that previously printed `CAPTURE CLEAN` with exit 0 *locally*:
> **`BUCKET_ABSENT_ORPHANED_BYTES`** (bucket row gone, bytes still on the volume) and
> **`MISSING_BYTES`** (volume directory gone, metadata still listing keys â€” QA MAJOR-1), plus
> **`UNVERIFIED_PROOF_ERROR`** so a failed measurement is no longer read as emptiness. So the sentence
> below â€” *"post-migration `capture` prints CAPTURE CLEAN"* â€” **no longer holds for a retired bucket
> whose bytes survived**, which is the case that mattered. â›” **What has NOT changed:** on Cloud there
> is still no byte-visible arm at all, and S5 additionally established that a local proof run against a
> Cloud client would attest to the **wrong project's** bytes (now guarded â€” see
> FUP-DM5-CLOUD-ORPHAN-SURFACE). The Cloud half is the whole remaining item.

Post-migration, `storage-manifest.mjs capture` over the retired scope prints **`CAPTURE CLEAN`**. The
tool is honest â€” its volume proof *did* fire for absent buckets in the committed S4 manifest â€” but two
operational consequences are written down nowhere:

1. **Once `20260927000400` has applied, the only arm that can still see a surviving byte is the volume
   `walk`, which is `STORAGE_BACKEND=file` and therefore LOCAL-ONLY.** On Cloud, post-migration, the
   retirement tooling has **no arm at all** that can see one.
2. â­ **The migration's guard cannot enforce the ordering it documents, in the case that matters.** It
   refuses when `storage.objects` rows remain â€” but an *orphaned* bucket satisfies "no rows" perfectly.
   So the guard enforces byte-first ordering exactly when the bytes are still tracked, and is silent
   precisely when they are not. **The guard is real and it is not a proof of emptiness.**

**Why it matters:** this is the ordering that runs at deploy, against a bucket set that *does* have
metadata rows â€” so the guard will do its job there. The gap is the residual: nothing can confirm
afterwards, on Cloud, that no byte survived. Record it in the deploy runbook rather than discovering it
during the deploy.

### ðŸŸ  FUP-DM5-STACK-CYCLE-DESTROYS-BYTES â€” a `supabase stop`/`start` recovery destroyed 221 storage objects (15 PHI-tier) with **no manifest, no count comparison, no audit** (owner: lead + backend)

Filed 2026-08-17 (lead) from QA's DM5Â·S4 review **B1**. Full measurement, timeline and cause: the
S4 OUTCOME block under **FUP-DM5-STORAGE-ORPHANS** above.

**The hazard, stated generally:** ADR 0120 **D9** governs *deliberate* retirement â€” capture, delete by
key, assert `deleted == manifest`. It says nothing about the **operational** paths that can destroy
storage bytes as a side effect, and at least one of them does so **silently**: recovering a wedged
local stack (`supabase stop` + `supabase start`, here after a mid-flight `supabase db reset` was
killed) recreated the storage volume. `supabase stop` reported `"backup":true` while doing it.

**Why it matters beyond the lost dev files:**
1. â­ **It is the exact event D9 exists to prevent, and it happened inside the slice that ratified D9** â€”
   which is the strongest possible evidence that *a rule governing the deliberate path does not
   constrain the accidental one.*
2. **It was invisible.** Nothing alarmed. It was found only because a reviewer re-measured a figure the
   lead had inherited from a manifest 3 hours old. **No gate in this repo would have caught it**, and the
   lead reported the bytes as present, and had the PO rule on them, long after they were gone.
3. **Cloud is the real exposure.** `npm run db:reset:linked` exists, and the 20-yr LGPD/ANVISA retention
   posture means "storage bytes vanished and we cannot say when or which" is a compliance statement, not
   a tidiness one.

**Candidate resolutions (PO/backend call â€” deliberately NOT pre-decided):** capture a manifest
**before** any stack-cycle or destructive CLI step and diff after (cheap, uses S0's existing tool) Â·
document the hazard in `docs/worktrees.md`/the deployment runbook Â· or accept it for local dev and scope
the guard to anything touching a data-bearing stack. â›” **Do not resolve it by adding a comment saying
one "should" capture first** â€” that is the failure mode this phase has now paid for repeatedly.

### ðŸŸ  FUP-DM5-D11-SUPERSEDED-NEVER-RETIRES â€” D11's "superseded bytes retire via `disposal_state`" is **not performed, and nothing can perform it** (owner: PO decision, then backend)

> **PO 2026-08-16: DECIDE LATER.** Asked directly at S4 authorization; the PO chose to leave the inline
> `â³ CONTESTED` pointer in ADR 0120 D11 and keep this open. Nothing in S4 depended on it. **Still owed
> before DM5's phase QA at S6** â€” build it or strike it; do not let S6 close over it silently.
>
> ### â¸ RE-RULED 2026-08-17 â€” still DECIDE LATER, but the reason has CHANGED and that matters
>
> â›” **This is no longer "not yet built." It was BUILT (`6181557e`), and the build FAILED THE GATE.**
> The inflow was reverted at `5b40d62b` because marking a superseded print `disposal_pending` made
> **every superseded print unservable** â€” `app.resolve_document_version_bytes:72` refuses on **any**
> non-`none` `disposal_state`. So the blocker is no longer effort or scheduling; it is a **head-on
> collision between two ratified ADRs** (0121 D3/D5 vs 0120 D6/D8) at exactly one value,
> `disposal_reason_category = 'superseded'`.
>
> â­ **Read this item and `FUP-DM5-SUPERSEDE-SERVING-COLLISION` as ONE deferral seen from two sides** â€”
> this is the missing **inflow**, that is the **decision** gating it, and `FUP-DM5-DISPOSAL-JOB` is the
> missing **outflow**. â›” **Do not resolve any of the three alone**: ADR 0121's own argument is that
> fixing the inflow alone *"would make things look better and destroy nothing"* â€” a growing pile of
> `disposal_pending` rows no code path can clear, while D11 reads as honoured.
>
> âš  **What the D11 keystones did NOT catch, kept because it is the transferable part.** `342`'s S3p
> block was red-proven **both ways** and stayed GREEN â€” it asserted the **inflow** (bytes get marked)
> and never asked whether any **reader** still worked. The blast radius was one join away and no
> assertion in the slice looked there. â†’ [[a-predicate-quoted-at-the-wrong-grain]] â€” the check ran, it
> just was not checking the thing.
>
> ### âœ… DECIDED 2026-08-18 â€” **BUILD IT, at retention expiry. The item is now WORK, not a question.**
>
> The PO ruled the collision as **(b)** (ADR 0121 **Amendment 2**): supersession does not mark bytes;
> the marking moves to the **retention clock**. So D11's clause â€” *"retires superseded bytes through
> `file_objects.disposal_state`"* â€” **stands and gets built**; only its trigger changes. The serving
> gate is untouched, which is what makes the build cheap and un-scary.
>
> â›” **Still not startable, and the reason has changed AGAIN â€” track this, because it is the third
> distinct blocker this item has had.** Not "unbuilt" (2026-08-16), not "an undecided collision"
> (2026-08-17), but **ADR 0121 D1**: inflow and outflow ship together or neither ships. The outflow is
> now the **manual runbook** (0121 Amdt 3), so the gate is its **end-to-end rehearsal â€” Critical FUP
> C1**. â­ *A stale blocker reads exactly like a live one*, so state which one is current whenever this
> item is quoted.
>
> âš  **Two things below are now stale and are corrected, not deleted:** *"the PO picks"* between the two
> resolutions â€” picked, build it; and the framing of this as a **decision** â€” it is an implementation
> item, and its owner is **backend**.

Filed 2026-08-14 (lead) from `qa`'s DM5Â·S3 review MINOR-4. **Not an S3 bug â€” an ADR-0120 D11 claim that the
implementation cannot honour**, so it must be either built or struck from D11.

**Measured:** re-minting supersedes the prior print (`status='superseded'`, `superseded_at` set), but **both
the old and new `file_objects.disposal_state` stay `none`**. Nothing schedules retirement, and retirement is
operator-initiated â€” so a superseded print's bytes persist indefinitely. The **SUBSTITUÃDO overlay** on
download depends on that lifecycle, and ADR 0114 **O1** is the same open question one layer up.

**Why it matters beyond tidiness:** this is a **20-year-retention, LGPD/ANVISA** system where "the superseded
copy is retired" is the kind of sentence an auditor reads as a control. An ADR asserting a control that no code
performs is worse than an ADR that admits the gap. Two honest resolutions, and the PO picks:
**(a)** implement retirement (scheduler or an explicit operator action) â€” then D11 is true; or **(b)** amend
D11 to say superseded bytes are **retained** and the overlay is the only distinction â€” then the record is true.
â›” Do **not** resolve it by adding a comment saying retirement "should" happen.

### ðŸŸ  FUP-DM5-SUPERSEDE-SERVING-COLLISION â€” âœ… **RULED 2026-08-18: the marking trigger moves to RETENTION EXPIRY; the serving gate is untouched.** Implementation gated on Critical FUP C1 (owner: **backend**; the PO half is discharged)

> ### âœ… PO RULING 2026-08-18 â€” **RESOLVED AS (b): the marking TRIGGER moves to RETENTION EXPIRY. The serving gate is NOT touched.**
>
> â­• **The PO half of this item is DISCHARGED; what remains under this id is backend implementation
> work, not a decision.** Severity ðŸ”´ â†’ ðŸŸ , owner PO â†’ backend.
>
> **The ruling.** Option **(b)** â€” amend ADR 0121 D3/D5 so supersession does **not** mark bytes at
> supersession time; the `disposal_pending` marking moves to **retention expiry**, the same clock that
> governs every other version. Option **(a)** â€” widening `app.resolve_document_version_bytes` to pass
> `disposal_pending` bytes whose reason is `superseded` â€” was **declined**, on this item's own
> argument: *a narrowing can be wrong and stay safe; a widening cannot.*
>
> â­ **What makes (b) more than a scheduling preference: the collision does not get adjudicated, it
> stops occurring.** The two ratified decisions were only ever in contact at the supersession
> *instant*. Move the trigger and `resolve_document_version_bytes` needs no change at all â€” its refusal
> on *any* non-`none` state becomes correct for **every** reason value that can reach it, because
> nothing marks a version still meant to be servable. **No PHI byte-serving gate is widened, so no
> diff-scoped door sweep and no new keystone is owed against that gate.**
>
> **What survives of D3/D5** (recorded in ADR 0121 **Amendment 2**, not restated here): D3's
> **vocabulary** stands â€” the `duplicate` trap it was written against (its exemption lane needs a live
> same-`sha256` sibling on the **same** `documents` row, which ADR 0120 D13 guarantees a superseded
> print never has) is untouched. D5's **principle** stands; only its evaluation point moves.
>
> âš  **One build-time detail is deliberately OPEN and must not be settled silently:** at retention
> expiry, does the row record `disposal_reason_category = 'superseded'` or `'retention_expired'`? Both
> are true and they mean different things to a regulator. **The implementing slice decides it
> explicitly and records the choice in ADR 0121.**
>
> â›” **THE REBUILD IS STILL GATED â€” by ADR 0121 D1, no longer by an open decision.** *Inflow and
> outflow ship together or neither ships.* The outflow is now the **manual runbook** (ADR 0121
> Amendment 3), so **D11 may be built once the runbook has been rehearsed end-to-end â€” Critical FUP
> C1 â€” and not before.** Building the inflow first would convert silent retention into a growing pile
> of `disposal_pending` rows nothing has ever been shown to clear, while the D11 claim reads as
> honoured: exactly the "reads better than it behaves" failure D1 exists to prevent.
>
> âš  **The reverted tree stays reverted until that gate opens.** `5b40d62b` is still the state; this
> ruling authorizes a *different* build, not the restoration of the old one.
>
> <details><summary>Superseded â€” the 2026-08-17 deferral, kept because its reasoning shaped the ruling</summary>
>
> > ### â¸ PO RULING 2026-08-17 â€” **DECIDE LATER; the inflow STAYS REVERTED.** The item remains ðŸ”´ OPEN.
> >
> > Both offered resolutions were **declined for now**: neither widen `app.resolve_document_version_bytes`
> > to pass `disposal_pending` bytes whose reason is `superseded`, nor reinterpret ADR 0121 **D3/D5**'s
> > ratified *"superseding marks bytes"*. The tree stays as `5b40d62b` left it.
> >
> > â­ **Why deferring is a real position here and not a punt.** The reverted state is *coherent*: no
> > inflow without an outflow (ADR 0121 **D1** satisfied), no unservable superseded prints, and nothing
> > in production depends on D11. The two open options are **not symmetric** â€” widening a PHI
> > byte-serving gate cannot be un-shipped safely, while the cost of waiting is a `disposal_state` that
> > stays `none` on superseded prints, which harms nobody today.
> > â†’ [[keystone-measured-what-i-built-not-what-breaks]]: *a narrowing can be wrong and safe; a widening
> > cannot.*
> >
> > â›” **A DEFERRAL IS NOT A CLOSURE, and three things follow from that.**
> > 1. **This item stays ðŸ”´ and S6 may NOT close over it.** It is not discharged by DM5 completing.
> > 2. **D11 cannot be rebuilt until this is decided** â€” it is the blocker, and ADR 0121 D3/D5 are
> >    ratified text currently **not implemented**, which the ADR must keep saying out loud.
> > 3. âš  **`FUP-DM5-D11-SUPERSEDED-NEVER-RETIRES` is the same deferral seen from the other side** â€”
> >    superseded print bytes still never retire. Do not read that item as independently open work.
> >
> > âš  **The condition that would force this decision:** anything that makes superseded prints accumulate
> > at volume, or a retention/erasure obligation landing on them. Re-put it to the PO then, not on a
> > schedule.
>
> </details>
>
> âš  **Two claims above went stale on 2026-08-18 and are corrected here rather than deleted, because
> both are the kind a later reader would otherwise quote as current.** *"D11 cannot be rebuilt until
> this is decided"* â€” it is decided; the blocker is now **D1's outflow gate** (Critical FUP C1).
> *"`FUP-DM5-D11-SUPERSEDED-NEVER-RETIRES` is the same deferral seen from the other side"* â€” still
> true, and the two now move together toward a **build**, not toward a decision.

Filed 2026-08-17 (lead), **found by the Phase Gate, not by review**, after the D11 inflow was
built, keystoned, red-proven and committed. `312` t38 â€” *"a revoked document still SERVES"* â€”
died with `documento descartado`. The inflow was reverted (`5b40d62b`); this item is the
decision that has to be made before it can be rebuilt.

**Mechanism, catalog-read.** `app.resolve_document_version_bytes:72` refuses on
`disposal_state <> 'none'` â€” **any** non-`none` state, not just `disposed`. So marking a
superseded print `disposal_pending` means **the previous PDF stops opening the instant a
document is re-issued.** ADR 0120 **D6/D8** rules the opposite: a print's states change what
the overlay **stamps**, never its **reachability**.

**â­ The collision is exactly one value wide, and both sides are right.** Refusing to serve
`disposal_pending` bytes is CORRECT for `subject_request` and `retention_expired` â€” a subject
asked for erasure, so serving stops before the bytes are destroyed. It is WRONG for
`superseded`, where an auditor must still be able to open what was previously issued. The
whole disagreement lives at `disposal_reason_category = 'superseded'`.

**The decision, stated so it can be taken:** either
**(a)** widen `app.resolve_document_version_bytes` to pass `disposal_pending` bytes whose
reason is `superseded` â€” a change to a **PHI byte-serving gate**, needing its own keystone and
a diff-scoped door sweep; or
**(b)** amend ADR 0121 D3/D5 so supersession does not mark bytes at supersession time (e.g.
marking on retention expiry instead), leaving the serving gate untouched.
â›” **Not lead-decidable.** (a) widens a PHI serving gate; (b) reinterprets a PO-ratified
decision. A narrowing can be wrong and stay safe; a widening cannot â€” which is why this
reverted rather than patched.

âš  **What the D11 keystones did NOT catch, and this generalises.** `342`'s S3p block was
mutation-proven in both directions and green throughout â€” because it asserted **the inflow**
(bytes get marked) and never asked whether anything **downstream** still worked. The blast
radius was one join away and no assertion in the slice looked there.
[[a-predicate-quoted-at-the-wrong-grain]]: the check ran, it just was not checking the thing.
**When a change writes a new value into an existing state column, sweep every READER of that
column before believing the keystone.**

### ðŸŸ  FUP-AUTHZ-COMMAND-DOOR-UNSWEPT â€” â­• **RE-SCOPED 2026-08-17 (pre-S6): the filed premise was FALSE, the population is 407 not one, and the class is COVERED-BUT-UNPINNED, not blind** â€” â­ **Critical FUP C2** (owner: lead + backend)

> ### âœ… PO RULING 2026-08-18 â€” **TWO TIERS. Sweep the PHI / tenancy-crossing subset first; DEFER the remainder to after the pilot ships.**
>
> Recorded as **Critical FUP C2**. The decision that was owed was the **sizing**, and it is taken:
>
> **Tier 1 â€” sweep now, as its own scoped workstream.** The subset of the 407 that **touches PHI or
> crosses a tenant boundary**. Each swept door gets a **recorded verdict**, so a regression reds and â€”
> the actual point â€” **a NEW door cannot pass by absence.**
> **Tier 2 â€” the remainder is DEFERRED** until after the pilot ships and there are real customers.
>
> â›” **Tier 1's population is DERIVED FROM THE CATALOG AS A PROPERTY, never hand-listed.** This item's
> own history is the argument: it was filed on an inferred premise that measured **false**, and the
> phase's dominant failure class is an enumeration bounded by a **syntax or a filename** instead of a
> property â†’ [[enumeration-boundary-is-a-syntax-not-a-property]]. A hand-picked "PHI-looking" list
> would reproduce it exactly. **Sizing Tier 1 â€” deriving the predicate and counting what it returns â€”
> is step one and is NOT yet done.** The tier split is ruled; the number is unknown.
>
> âš  **What this ruling does NOT do, stated because the temptation is structural:** it does not close
> Tier 2, and it does not let the 3-door sample stand in for either tier. â›” **The sample may not be
> used to close anything** â€” it establishes that the class is *covered*, which is why this is ðŸŸ  and
> not ðŸ”´, and nothing more. â­ *Absence of a verdict is not absence of coverage* â€” and the inverse
> holds too: **presence of coverage is not a verdict.** Nothing today records *why* any of the 407 is
> safe, so nothing notices when one stops being safe.
>
> âš  **`assume_role` is still ERROR-shaped, not COVERED**, and it is in Tier 1 by construction
> (`platform_role` crosses every tenancy boundary there is). Its suite run changed shape â€” `315`
> failed tests 5â€“6 then **aborted** (*"Bad planâ€¦ you planned 22, ran 7"*, exit 3). Per the door-audit
> convention that is **ERROR**, and CLAUDE.md is explicit: **`ERROR` is not a pass.** It must be
> resolved *within* Tier 1, not inherited as already-swept.

Filed 2026-08-17 (lead) on measuring, rather than trusting, a green `ARM=census`. Re-scoped
the same day, before opening S6, by measuring the two things the filing had *inferred*.

**What still holds.** `public.complete_evidence_upload_verification` (new,
FUP-DM5-FINALIZE-ATOMIC, `prosecdef = t`) is absent from every findings file, and
`ARM=census` reported *"every live authz gate carries a verdict (no unswept newcomer)"* â€”
546 live / 570 verdicts â€” **and passed.** The census's DEFINER clause is bounded by
`t.typname = 'bool' or (p.proretset and has_function_privilege('authenticated', â€¦))`; the door
returns **`jsonb`** and is not set-returning, so it is outside the census domain entirely.

â›” **The supporting claim was FALSE, and it understated the finding.** The filing argued this
was *"a gap rather than a definition"* because the door sweep's domain is wider â€”
`complete_document_upload_verification` *"**is** in the findings"*. **Measured: it is not.**
That name occurs in `authz-door-audit-findings.md` **only inside a prose paragraph stating
that the ten S2 command doors are excluded by definition**, and `verdicts_from_findings`
scrapes **markdown table rows only** (`^| `). Same for `mint_printed_document` in
`authz-rowdoor-audit-findings.md:38` â€” prose, inside a `>` blockquote. **No jsonb/void command
door carries a verdict anywhere.** The door sweep's PRED domain is in fact *narrower* on the
bool axis (it adds a `^(is_|can_|has_|â€¦)` name regex the census deliberately omits).
â­ So this is not one newcomer slipping through a boundary that covers its siblings â€” **the
entire population sits outside every arm's domain**, and the one document that mentions it
does so where no scraper reads. â†’ [[a-predicate-quoted-at-the-wrong-grain]].

**The measured population** (live catalog, 2026-08-17, post-`db reset`):

| | count |
|---|---|
| `prosecdef` functions in `app`+`public` | **774** |
| in `ARM=census`'s domain â€” `bool` | 135 |
| in its domain â€” set-returning + `authenticated`-reachable | 49 |
| **outside every arm's domain** | **590** |
| â†³ `authenticated`-reachable, `prokind='f'`, non-trigger = **real command doors** | **407** |
| â†³â†³ of which in `public` (PostgREST RPC-callable) | **326** |

`create_case`, `assume_role` and `add_referral_shared_item` appear in **no** findings file, **no**
allowlist and **not** in `authz-unswept-backlog.txt`. Each is a DEFINER, so by CLAUDE.md's own
standing rule its internal gate *replaces* RLS â€” it **is** the boundary.

**â­ THE SAMPLE â€” and it inverted the expectation.** Rather than infer blindness from "no arm has
asked", three doors were neutralized (guard condition â†’ `false`) and the full pgTAP suite run
against each. **All three went RED. The class is COVERED, not blind:**

| door | neutralized | suite | failing assertion | verdict |
|---|---|---|---|---|
| `add_referral_shared_item` | `can_read_case` recusal check | 194f / **6392** / FAIL | `340` R5â€“R6 *"the recused coordinator can no longer freeze a NARRATIVEâ€¦"* | **COVERED** |
| `create_case` | ~~`is_staff_admin_of âˆ¨ is_admin âˆ¨ member_can`~~ â†’ **`is_staff_admin_of âˆ¨ member_can`** (arm CUT 2026-08-22, PO ruling) | 194f / **6392** / FAIL | `177`:13, `205`:45 *"a plain staff â€¦ is denied (42501)"* | âš  **COVERED was true about the DOOR, not about the ARM** â€” a plain-staff denial cannot see an `is_admin` disjunct, so the verdict said the door was *exercised*, never that it was *bounded*. Genuinely bounded now by `357` Â§8d.1 |
| `assume_role` | `if not v_holds` (holds-the-role check) | 194f / **6377** / FAIL | `315`:5 *"sa_x CANNOT assume a role he does not hold"* | **COVERED**, âš  ERROR-shaped |

âš  **`assume_role` is not a clean COVERED and is not recorded as one.** Its run shape differs
from baseline â€” `315_act_stage3_hat_condition.sql` failed tests 5â€“6 and then **aborted**
(*"Bad plan. You planned 22 tests but ran 7"*, exit 3), which is exactly the 6392 â†’ 6377 delta.
Per the door-audit convention a shape change is **ERROR**, and CLAUDE.md is explicit that
`ERROR` is not a pass. The *first* failure is nevertheless a true authorization assertion, so
"something noticed" is established; "the suite is clean about it" is not.
`add_referral_shared_item` doubled as the **positive control** (the ADR 0122 keystone was built
for exactly this) â€” it went RED, proving the harness can find something
([[detector-that-finds-nothing-must-be-proven-able-to-find-something]]).

**â­ Calibration, corrected in BOTH directions.** Not a vulnerability â€” but also **not a
coverage hole**, which is what "unswept" implied. The coverage is real; what is missing is the
**verdict**. Consequences, which are the actual finding:
1. **The coverage is unpinned.** Nothing records that these 407 doors are covered, so nothing
   detects if that coverage regresses. A keystone deleted tomorrow reds nothing.
2. **A NEW door in this class inherits no arm at all** â€” it is absent from every findings file,
   so it passes every arm *by absence*. Precisely the ADR 0079 Amendment 7 shape.
3. **`ARM=census` prints a claim wider than its domain** â€” *"every live authz gate carries a
   verdict"* over a domain excluding the application's entire command layer.
   â†’ [[enumeration-boundary-is-a-syntax-not-a-property]], [[a-census-whose-parts-dont-sum-is-wrong]].

**Fix (unchanged in shape, re-sized).** Widen the census's DEFINER clause to admit reachable
non-trigger command doors, re-run, expect **RED with ~407 entries**, and triage â€” as ADR 0079
Amendment 7 did for `ARM=wrapper`. âš  **407 is too many to classify honestly in one pass**, and a
backlog filled with generic reasons is itself a vacuous act; sizing that triage is a **PO
decision**, not an implementer's. â›” **Do not close this on the 3-door sample** â€” three COVERED
results are evidence about three doors, not about 407 ([[a-detector-that-finds-a-lot-needs-proving-too]]).

**Harness safety, for whoever runs the full triage.** The suite runs in a **separate
connection**, so an in-transaction neutralization is invisible to it and cannot be used
(FUP-AUTHZ-HARNESS-TRANSACTIONAL). What was used instead, and worked: exact
`pg_get_functiondef` captured as the restore artifact Â· an **EXIT trap** restoring on any abort Â·
an assertion that the neutralization **landed** (md5 must change â€” a silent no-apply would make
the run PASS *"having asserted nothing"*, which it did catch: `docker cp` + `psql -f` fails
silently on Windows because MSYS rewrites the container-side `/tmp` path to `C:\tmp`; use
`docker exec -i â€¦ < file`) Â· md5 re-verified after restore Â· the property sweep
`^\s*begin\s+return\s+(true|false)\s*;\s*end` clean before **and** after Â· and the suite
re-run to **194f/6392 PASS** to prove the stack was returned to baseline.


> ## â›” EXTENSION 2026-08-23 (AFF2 B1) â€” **trigger-returning** `prosecdef` gates are in no arm's domain EITHER, and this item's own wording excludes them
>
> This item is scoped to *"407 reachable **non-trigger** command doors"*. Measured during AFF2 B1:
> **`guard_profile_privileged_columns`** is `prosecdef = t`, `authenticated`-EXECUTE-able
> (`{postgres=X, authenticated=X, service_role=X}` â€” no PUBLIC), returns **`trigger`**, and carries
> **no verdict in any findings file or allowlist** â€” all four checked. `ARM=census`'s DEFINER clause
> is bounded to `bool`/set-returning functions plus policies, so a `trigger` return type is excluded
> **by construction**.
>
> â­ So this subset falls in the gap between the arms *and* this follow-up: the arms exclude it by
> return type, and this item excludes it by the word **"non-trigger"**. An exclusion written to bound
> a claim honestly ended up naming the one population nothing else covers.
>
> âš  **AFF2 did not create it, but B1 made it LOAD-BEARING.** That trigger is now the only in-DB control
> over who may write `profiles.date_of_birth` / `phone` (beside the column-grant absence) â€” ADR 0133
> D10's *"writable only through `registerUser`/`updateUserProfile`"* is enforced there. It is keystoned
> by pgTAP `359` Â§3 (both columns, separate arms, with an attribution twin), so the **property** is
> pinned; what is missing is its presence in the **standing** invariant, which is the difference between
> "tested once" and "cannot silently stop being tested".
>
> â›” **Not a live hole; do not report it as one.** Calling a `RETURNS trigger` function directly outside
> trigger context raises â€” and there is no PUBLIC/`anon` grant. This is a **measurement-domain** gap.
> The cheap mitigation is the recorded one: `revoke all on function â€¦ from public` costs nothing,
> because executing a trigger does not check EXECUTE on its function. The real fix is widening the
> census domain to include `trigger` returns, which is a gate change needing its own decision.

### ðŸŸ¡ FUP-ACL-APP-POPULATION â€” â­• **RE-SCOPED 2026-08-17: the assertion is BUILT; the 237-function triage is what remains** (owner: backend + PO)

> **âœ… The blind spot is closed.** `320` block U (+4, plan 10 â†’ 14) replaces the 8-name
> allowlist with a **schema-bounded** population pin, so a new `app` door with a default
> ACL reds immediately instead of inheriting no coverage. U2/U2b are the t19c-style
> control: creating one probe function moves the count 237 â†’ 238 and dropping it returns
> it to baseline â€” the detector is **shown to move**, not assumed to
> ([[detector-that-finds-nothing-must-be-proven-able-to-find-something]]).
>
> **â›” What the first measurement actually found, and why it is NOT a mass revoke.**
> **237 of 454** `app` functions are PUBLIC-executable â€” 228 by default ACL (**159 of
> them SECURITY DEFINER**) plus 9 by an explicit PUBLIC grant â€” and `anon` resolves
> EXECUTE on all 237. The nine explicit ones name the hazard: `is_admin`,
> `is_member_of`, `is_staff_admin_of`, `is_org_admin_of`, `eval_condition`, `answer_map`,
> `latest_published_version`, `commission_of_version`, `can_read_correction_response`.
> **These are evaluated INSIDE RLS policies, which run as whatever role is reading â€”
> including `anon` on auth-flow paths.** Their PUBLIC grant is a decision, not drift, and
> a blanket revoke would break policy evaluation platform-wide. U3 pins that: a
> schema-wide revoke now reds in `320` rather than in production.
>
> **â¬œ REMAINS OPEN â€” the triage, which is the real work and was never the query.** Walk
> the 159 default-ACL DEFINER functions and decide each: legitimately PUBLIC (RLS-
> evaluated) vs. should be revoked. Drive the baseline down as each batch lands.
> Calibration unchanged: `config.toml` exposes only `public`, so none of these is
> PostgREST-reachable â€” **defence-in-depth, not a leak path**, which is why the ratchet
> was the right increment and a rushed mass revoke was not.

<details><summary>Original filing (2026-08-14) â€” retained</summary>

Filed 2026-08-14 (lead) while verifying S3's `DROP`+`CREATE` PUBLIC-EXECUTE find. **Defence-in-depth,
not a leak path** â€” `config.toml` exposes only `public`, so an `app` function with PUBLIC EXECUTE is
not PostgREST-reachable. Recorded because the mechanism has now fired **three times** (TV, DM5Â·S2,
DM5Â·S3) and the `app` side has no generic net.

- `100_dashboard` **t19** â€” *"no FIRST-PARTY public function is anon-executable"* â€” is bounded by
  `nspname = 'public'`. Correct and well-built (it has control **t19c** proving the detector moves
  0â†’1, and it uses `has_function_privilege`, which **resolves** a default ACL).
- `320:170-180` â€” the only `app`-side check â€” is bounded by **8 hard-coded function names**. That is
  the "remembered-doors allowlist" that [[guards-that-read-right-but-fail-open]] itself warns is blind
  in precisely the case that matters, and a new `app` DEFINER door (e.g. S3's
  `app.resolve_document_version_bytes`, on a PHI byte path) inherits no coverage from it.

**Fix:** generalize `320`'s uniformity assertion from the 8 names to **all `app` functions**, keeping
its existing `p.proacl is null or exists(â€¦ grantee = 0)` shape (âš  that `is null` arm is load-bearing â€”
`aclexplode(NULL)` returns **no rows**, so dropping it makes the check blind to exactly the default-ACL
case it exists for). Give it a **control** in t19c's style, and expect the first run to be **RED with a
list** â€” `app` almost certainly holds legitimate PUBLIC-executable helpers, and the real work is
triaging that list, not writing the query. Pair with the over-revoke twin (`authenticated`/`postgres`
retain EXECUTE) or a fix that over-reaches will pass the security half while breaking the app.

</details>

### ðŸŸ  FUP-DM5-SIBLING-GUARD-DIFF â€” **no authz arm can see a door that OMITS a check its sibling doors all make** (owner: lead + backend; a gate-coverage gap, not a defect)

> ## â­• FOLDED INTO CRITICAL FUP C2 TIER 1 â€” 2026-08-18 (DM-FUP TRIAGE #5)
>
> This wants a transitive catalog guard-set diff over `prosecdef` doors. So does C2's 407-door Tier 1
> sweep, and so does `FUP-DM5-Q1-OPEN-BYTES-CUT-BROKEN`'s re-pointed arm
> (`app.resolve_document_version_bytes`). **One piece of door-mutation machinery, three consumers** â€”
> building it three times was declined.
>
> âš  **Absorption is not closure.** This item keeps its own index line, its own severity, and needs its
> own recorded verdict; it closes when the diff exists **with a positive control**, not when Tier 1 ships.

Filed 2026-08-14 (lead) on confirming **BUG-DM5-S3-INACTIVE-PRINT-1** (PROGRESS.md).

**The gap.** ADR 0079's standing gate has five arms and **none of them can detect this class**:
`floor` asks *is the door called*; diff-scoped `policy` asks *does anything notice when a gate is
opened*; `census` asks *has anything ever asked*; `hat` asks *does it read `memberships` without
the caller's hat*; `wrapper` covers the `prosecdef = f` half. **Every arm tests a gate that is
there.** A *missing* term is invisible to all five, because neutralizing nothing changes nothing â€”
and it is invisible to review too, since the door reads perfectly sensibly on its own.

**The specimen.** `app.can_read_document` guards `app.is_active(p_uid)` **above** its type dispatch;
`app.can_view_printed_document` has no effective `is_active` term, because its `form_response` arm's
first disjunct is the bare column comparison `v_resp.created_by = p_uid`, behind an `or`. Confirmed
by probe, not by reading. Latent only because `document_printing` ships OFF.

**Proposed check** (cheap, and it is a *comparison*, not a new mutation arm): for each family of
doors guarding one resource class, diff their guard sets from the catalog â€” `is_active`, tenancy,
flag assert, PHI gate, disposal, status â€” and require every asymmetry to be either fixed or
**recorded as deliberate**. Two design constraints learned the hard way:
1. Resolve each term **transitively**, and treat a term reached only through an `or` as **absent** â€”
   a callee cannot rescue a disjunction. (Bare structural `prosrc ~ 'is_active'` would have called
   `is_staff_admin_of_for` sufficient and **cleared this door**.)
2. It must carry a **positive control**: assert the door returns `true` for an *active* principal
   before flipping the bit, or the `false` afterwards proves nothing.

âš  **Do not fold this into `p0-authz-invariant.sh` as a sixth arm without sizing it** â€” the four
phase-step arms are 2 s / 10 s / 1 min / 2 s precisely because they are cheap; a full-closure guard
diff over every door family is a periodic audit, like `ARM=wrapper`'s ~100 min sweep. Decide which
it is *before* writing it, and if it lands as periodic, say so in Â§6 rather than calling it standing â€”
"standing in prose alone" is what let three weeks pass before a sweep that then found 15 BLIND gates.

### ðŸŸ¡ FUP-ROTATION-BREAKS-LINKS â€” **every Â§6-step-5 rotation silently 404s its own links; 474 are broken today** (owner: lead)

Filed 2026-08-17 (lead), **measured, not inferred** â€” a link-resolution sweep over the four rotation
destinations after this pass's own rotation.

**The mechanism, and it is structural rather than careless.** PROGRESS.md sits at the **repo root**,
so its links are root-relative (`](docs/decisions/0120-â€¦.md)`). Every rotation destination lives in
**`docs/progress/`**. The Â§6 step-5 protocol says to preserve the block **verbatim** â€” and a verbatim
copy of a root-relative link **404s from one directory down**. â›” **The protocol's own correctness
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

â­ **Why this is worth a follow-up and not a cleanup commit.** These files are the *destination of
every rotation* â€” the place the live file points a reader when it says *"detail lives in the
record."* A 404 there means the rotation **moved the text out of reach while reading as though it
archived it**, which is the same shape as this phase's dominant class: an action performed
(*rotated*) recorded as the state achieved (*preserved and reachable*).
â†’ [[a-records-claim-about-an-external-system-goes-stale-silently]]

âš  **This pass reproduced the defect before catching it** â€” 77 fresh broken links across three
archives, found only because a link check ran *after* the rotation rather than being part of it.
They are fixed (`](docs/â€¦)` â†’ `](../â€¦)`); the 474 above are the pre-existing backlog.

**Remedy, in order of value:**
1. â­ **Make the transform part of the rotation recipe** in `docs/lead-playbook.md` Â§Â§4â€“5 â€” one
   `](docs/` â†’ `](../` pass after the append, *before* the cut. Cheap, and it stops the growth.
2. A one-off sweep to repair the 474. âš  **Mechanical but not blind** â€” a few links legitimately point
   at root files (`CLAUDE.md`, `PROGRESS.md`) and need `../../`, so the transform is two rules, not one.
3. â›” **Do NOT "fix" this by rewriting links in PROGRESS.md itself** â€” they are correct *there*. The
   defect belongs to the copy, not the source.

âš  **The verification claim needs the same care.** Four rotation headings in this pass originally read
*"preserved byte-for-byte, `cmp`-verified"*, which stopped being true the moment the links were
repointed. All four now state exactly what holds: **prose verbatim, link targets repointed.**
*An almost-true verification claim is the thing this whole register exists to catch.*

### ðŸŸ¡ FUP-PGTAP-WORKER-DEADLOCK â€” `npm run test:db` intermittently deadlocks a `pg_prove` worker (owner: backend)

Filed 2026-08-14 (lead), also carried out of prose. Non-deterministic; observed during DM5 gate runs.
Impact is **assurance, not correctness**: a hung/aborted worker can drop a suite from the run, and a
suite that never ran is not a suite that passed â€” the same shape as
[[gate-summary-can-hide-unrun-tests]]. **Mitigation until diagnosed:** always read the file/assertion
totals (`192 files / 6284`) against the previous known-good run, never a trailing summary line, and
never pipe the run through `tail`. Diagnosis wants the lock graph at hang time
(`pg_stat_activity` + `pg_locks`), which nobody has captured yet.

â­ **First concrete lock-surface lead, from DM5Â·S3 QA r2 (2026-08-14):** `342`'s **`S3n` takes ACCESS
EXCLUSIVE on `file_objects`** â€” a table that many suites touch. That is a *candidate* for the contended
object, not a diagnosis: the hang was never reproduced under observation, and naming a plausible lock is
how a real cause gets closed early. Whoever picks this up should start by checking whether the observed
hangs correlate with `342` being in flight at all.

### ðŸ”´ FUP-PGTAP-VACUOUS â€” `lint:vacuous` scans TS spec files ONLY; ~6000+ pgTAP assertions are entirely unscanned, and a live specimen was found (owner: lead + backend; a program-level audit, NOT a phase side quest)

Filed 2026-08-14 during DM4. **Found by `backend` while re-reading a suite it had to edit, and
lead-confirmed.**

**The live specimen** â€” `supabase/tests/197_phi_disposal_closure.sql` assertion **4.1**, inside a
**PHI-boundary suite**:

```sql
(select (j -> 'shared_items' -> 0 ->> 'frozen_storage_path') from meta_read) is null
```

If `shared_items` is an **empty array**, `-> 0` yields NULL, `->> 'field'` yields NULL, and
`is null` is **true**. The assertion passes **having asserted nothing** â€” and it has been doing so.
Nothing guards the array's non-emptiness. The DM4 successor adds a positive control
(`shared_items -> 0 ->> 'id' IS NOT NULL` in the same read) so the deny-half provably denies a row
that **exists**.

**Why this is ðŸ”´ and program-level.** `npm run lint`'s fifth gate (`check-vacuous-assertions.mjs`)
exists precisely because "a test that can go GREEN having asserted nothing" already shipped here â€”
but its scope is **first-party TS** (`src/`, `e2e/`, `*.test.*`): **180 spec files scanned, 0
findings**. The pgTAP suites are **SQL and completely outside it**, against **~6152 assertions** as
of DM3. The JSON-path-on-a-possibly-empty-array shape is a *natural* way to write these, so one
confirmed instance is weak evidence for one instance.

âš  **Scope discipline, deliberately recorded:** DM4 fixes **only** the instance in its own diff.
A repo-wide sweep is its own audit with its own ways of being wrong â€” and this project has the
scar: [[a-detector-that-finds-a-lot-needs-proving-too]] (a sweep reported 89; seven of its own bugs
were 56 of them). Any detector built here must be **dry-run against a hand-classified control** and
**proven able to fail** before its count is believed
([[detector-that-finds-nothing-must-be-proven-able-to-find-something]]).

### ðŸŸ  FUP-DM5-STORAGE-ORPHANS â€” a **LOCAL** DB reset wipes `storage.objects` but NOT the bytes; âš  **the REMOTE half was a stale inference and is now demoted to residual** (owner: lead + backend; blocks DM5 step 3 **locally**)

> ## â­ MECHANISM MEASURED 2026-08-18 â€” the guard exists, and TRUNCATE walks past it
>
> `storage.objects` carries a platform trigger **`storage.protect_delete`** (statement-level, on
> DELETE): a bare `DELETE` raises **`42501`** â€” *"Direct deletion from storage tables is not allowed.
> Use the Storage API instead"*, hint *"This prevents accidental data loss from orphaned objects."*
> So the casual path into this item's failure mode **is already blocked**, by Supabase, by default.
>
> â›” **`TRUNCATE` is not.** Measured on the local stack: upload an object â†’ `TRUNCATE storage.objects`
> succeeds, rows gone, **byte still on disk** (`/mnt/stub/stub/<bucket>/<name>/<version>`). TRUNCATE
> fires no DELETE trigger, so no statement-level guard can see it. That is the shape of every
> orphaning event this item is about: resets, truncates, schema drop/recreate â€” the **bulk and
> structural** operations, never a stray per-row delete.
>
> â‡’ Restates the item's scope precisely: *routine per-object work is protected; bulk operations are
> not, and no trigger can protect them.* The grant half is closed under FUP-PCITV-1 item 3
> (`20260928000900`); the platform tables keep the grant and that is accepted in writing there.
> âš  Also note `/var/lib/storage` is **not** the storage root (`FILE_STORAGE_BACKEND_PATH=/mnt`) â€” a
> `find` against the wrong root returns a false *"the byte is gone"*.

> â›” **CROSS-LINK, added by lead ruling 2026-08-17 (DM5Â·S5): this item's Cloud half is now
> [FUP-DM5-CLOUD-ORPHAN-SURFACE](#-fup-dm5-cloud-orphan-surface), a separate item.** The S3-endpoint
> question was a **parenthetical inside this body**, under a headline reading *"closes empty by
> measurement"* â€” and *an item that can change a verdict does not live inside the parentheses of the
> verdict it would change*. **Closing THIS item does NOT close that one**, and this body's
> "closes empty by measurement" conclusion is about the **retirement-scope, local** question only.

> ### ðŸ“Œ S4 OUTCOME 2026-08-16 â€” the local half is now DEMONSTRATED, not predicted, and it is **not closed**
>
> S4 ran. Measured before touching anything: **`storage.objects` = 0 rows across all 12 buckets** against
> **866 files / 9.9 MB / 235 PHI-tier** on the volume â€” **221 / 6.93 MB / 15 PHI** in the 8 retirement
> buckets, reproducing S0's figure exactly. **The manifest-first delete was therefore a NO-OP:** every one
> of those bytes is an orphan with no metadata row, so the Storage API cannot address it, and
> `capture` returned the `DEGENERATE BASELINE` verdict by design.
>
> - âœ… **What S4 did close:** the metadata/schema half â€” 8 bucket rows + the last 4 policies retired by
>   migration `20260927000400`, pinned by `325` t6/t7 (+t8 control) so it survives `db reset`.
> - â›”â›” **CORRECTED 2026-08-17 by QA (S4 review B1) â€” THE 221 FILES NO LONGER EXIST, AND THEY DID NOT GO
>   THROUGH THE GATE.** The text this bullet used to carry ("they are still on the volume â€¦ PO ruled to
>   leave them") was **false when it was written**. Measured independently, twice:
>   `docker volume inspect supabase_storage_â€¦` â†’ `CreatedAt 2026-08-17T01:06:02Z` (the volume object was
>   **destroyed and recreated**), and `storage-manifest.mjs walk` â†’ *"(no directory on the volume)"* for
>   **all eight** retirement buckets, `TOTAL files=78`, all in survivor buckets; `capture` â†’
>   `orphan_keys=0`, verdict **`CAPTURE CLEAN`** â€” against a committed manifest taken 10 minutes earlier
>   on the same stack recording **221 files / 6,927,804 bytes / 15 PHI-tier**.
>
>   **Cause â€” the lead, and it is worth naming precisely.** Timeline (local = UTCâˆ’3): manifest
>   `00:55:57Z` (221 present) â†’ E2E batch 4's reset 502'd `~01:01Z`, lead killed the run and a
>   **mid-flight `supabase db reset`** â†’ `supabase start` hit a container-name conflict â†’ lead ran
>   **`supabase stop` + `supabase start`** â†’ **volume recreated `01:06:02Z`**. `supabase stop` reported
>   `"backup":true` and removed the storage volume regardless. âš  Which step of that recovery did it is
>   **not established and no mechanism is invented here** â€” but it happened inside the lead's recovery
>   sequence and nothing else in the window fits. (E2E run 2 started `01:09Z`, *after*.)
>
>   â›” **This was a disposal WITHOUT EVIDENCE â€” 221 files, 15 PHI-tier â€” inside the very slice that
>   ratified D9.** No manifest at disposal time, no `deleted == manifest` comparison, no audit row. That
>   is precisely the event D9 exists to prevent. It does not touch S4's schema work, and the bytes were
>   regenerable local dev artifacts â€” but *"the byte half was a no-op"* is only half true: **the bytes
>   went; they just didn't go through the gate.**
>
>   â›” **The PO ruling of 2026-08-17 ("leave them; keep this open") was MOOT when it was given** â€” made
>   **3h11m after** its subject ceased to exist, because the lead re-used a 00:55Z measurement instead of
>   re-measuring at decision time. Outcome unchanged (nothing to delete either way), but the PO was asked
>   to rule on a state that no longer existed. â­ **A decision brief must carry a measurement taken at
>   decision time, not the one that motivated the question.**
>
> #### âœ… RE-PUT AND RULED 2026-08-17 â€” this time on a measurement taken AT decision time
>
> B1 required the question be re-put to the PO. It was, carrying a **fresh** measurement rather than the
> one that motivated it â€” the discipline this entry's own â­ demands, applied to itself. Measured on a
> freshly-rebooted stack immediately after a clean `db reset`, minutes before asking:
>
> | scope | files | bytes |
> | --- | --- | --- |
> | the **8 retired** buckets | **0** | 0 |
> | the **4 surviving** buckets (`documents-standard`/`-phi`, `form-assets`, `meeting-audio`) | **166** *(at 03:45Z)* | 2,970,290 |
>
> â›” **The survivor row is a TIMESTAMPED OBSERVATION, not a count â€” and it went stale inside the same
> session** (QA r2 INFO-5). After the `e2e:prod` gate it read **245 files / 4,394,074 B** (QA, ~04:55Z)
> â€” â›” **and the "moved AGAIN 30 min later" claim that stood here was WRONG (QA r3 MINOR-11).** I read
> `du -sb /mnt` = 4,402,266 against QA's `du -sb /mnt/stub/stub` = 4,394,074 and called it drift. Both
> re-run at the same instant reproduce **both** numbers: the 8,192 B is two 4 KiB wrapper-directory
> inodes, i.e. **my measurement scope, not elapsed change.** â­ *Two measurements at different grains
> compared as a time series* â€” [[a-predicate-quoted-at-the-wrong-grain]]. **State the method beside any
> byte figure**; note `du -sb` (allocated, 4,394,074) and `stat -c %s` (apparent, 2,456,666) differ by
> 1.94 MB on this same volume. The conclusion below is unaffected: it rests on the **166 â†’ 245 drift
> across the gate**, measured at both ends â€”
> `documents-phi` **68** Â· `documents-standard` **156** Â· `form-assets` **12** Â· `meeting-audio` **9**,
> against **0** `storage.objects` rows, so all 245 are orphans. â­ **This is why the PO ratified a CLASS
> and not a number:** every gate run writes bytes and every reset orphans them, so any survivor count is
> obsolete before it is committed. **Do not "refresh" this figure â€” quote the mechanism.** The retired
> buckets' **0** is the durable half: nothing writes to a bucket that does not exist.
>
> **PO ruling: the local volume is RATIFIED as non-durable, disposable test residue.** No cleanup step,
> no gate, no local manifest discipline. The two rejected options are recorded because they were live:
> clearing the volume as part of `db reset` (declined â€” it changes shared tooling every session depends
> on, and destroys evidence a future incident may need), and holding the 166 to full manifest discipline
> (declined â€” right discipline, wrong scope).
>
> â­ **What the fresh measurement changed about the question.** The 166 are **not** retirement residue.
> They are ordinary E2E/print artifacts that **the reset orphaned as it ran** â€” so local orphan
> accumulation is not an S4 artifact at all, it is a **standing byproduct of `db reset` on any stack that
> has written bytes**. That is D17's correcting insight, no longer an argument but a measurement. Had the
> question been re-put on the old 221-file framing, the PO would have ruled a second time on a state that
> no longer existed â€” the exact failure B1 was filed for.
>
> **What this closes:** the *retirement-scope* orphan question â€” and it closes **EMPTY BY MEASUREMENT**,
> zero bytes in all eight retired buckets. Not by disposal, not by argument, and not by the destruction
> of 2026-08-17 `01:06:02Z`, which remains an unevidenced disposal and is charged to
> **FUP-DM5-STACK-CYCLE-DESTROYS-BYTES**, not discharged here.
>
> - **This item stays OPEN on its Cloud half ONLY**, and its centre of gravity has moved: the remaining
>   question was never the local bytes, it is that **on Cloud there may be no customer-accessible tool
>   that can SEE an orphan** (the S3-protocol endpoint is still UNPROBED). See also
>   **FUP-DM5-STACK-CYCLE-DESTROYS-BYTES**.
> - âš  **`delete --execute` has still never run against a populated bucket.** Its correctness rests on S0's
>   8/8 self-test, not on an S4 execution â€” so **the production sequence remains unrehearsed end-to-end**,
>   even though production is where it is actually meaningful (it has metadata rows: 45 objects at the
>   2026-08-11 census). âœ… **OWNED 2026-08-17 â€” the PO directed the rehearsal into S5 as `S5.R`**
>   ([plan](../plans/dm5-wave-d-retirement-plan.md) Â§ S5.R): the **with-metadata** path, on a
>   purpose-made disposable bucket (the eight retired ones now return `BUCKET_ABSENT` and hold 0 bytes),
>   with all four acceptance items proven able to FAIL. âš  **Naming an owner is not a rehearsal** â€” this
>   bullet stands until S5.R runs, and a green *local* rehearsal still does not license the Cloud
>   sequence, which is what keeps this follow-up open.
>
> ### â›” AMENDMENT 2026-08-14 â€” the remote half's premise was WRONG. Severity ðŸ”´ â†’ ðŸŸ .
>
> This filing reasoned from the local measurement to remote by *"the same mechanism class."* **The
> mechanisms are different**, and the remote one does not exist at the CLI version this repo pins.
>
> - **Local â€” still true, and structural:** the database is recreated wholesale while the **Docker
>   volume survives**. Measured: `storage.objects` **0 rows vs 699 objects / 7.02 MB / 198 PHI-tier**.
>   Everything below about the local mechanism stands, and it is what blocks S4's *"prove empty via the
>   API, then delete the bucket"*.
> - **Remote â€” gone:** the orphaning came from **one line** in the CLI's
>   `pkg/migration/queries/drop.sql` truncate loop
>   (`or c.relnamespace::regnamespace::name = 'storage' and c.relname != 'migrations'`), added by
>   [cli#3083](https://github.com/supabase/cli/pull/3083) 2025-01-30 and **reverted by
>   [cli#3359](https://github.com/supabase/cli/pull/3359) 2025-03-27** â€” *"causing too much confusion
>   and accidental deletes to be worthwhile."*
>
> **Verified at OUR version against the artifact, not the PR title** â€” grepping the embedded SQL in
> `node_modules/@supabase/cli-windows-x64/bin/supabase-go.exe` (**v2.105.0**), lead-reproduced:
> `name = 'storage'` â†’ **0 hits**; `name = 'auth'` â†’ **3 hits**. The `auth` sibling is the adjacent
> line of the same loop, untouched by the revert â€” it is the **positive control** proving the SQL is
> greppable here and the pattern shape right, so 0 means *absent*, not *unfindable*.
>
> **Consequences:** a `db:reset:linked` would **not** orphan the remote's objects â€” which also reverses
> a live warning feeding **FUP-DM4-PRODROW**'s deploy decision. **The Cloud orphan-*detector* question
> drops from S4 blocker to residual**, since a detector matters only for orphans something can create.
> âš  **The manifest-then-reset ordering still STANDS** on the local rationale alone (ADR 0120 D17's
> second correction) â€” this is not licence to reset first.
>
> â­ **A correctness property can live in a DEPENDENCY's source and regress on `npm update`.** This one
> went true â†’ false â†’ true across CLI versions, and `package.json` pins **`^2.105.0`** â€” a caret range,
> so a routine update can silently re-arm it. Record it as *"true at v2.105.0 because that line is
> absent,"* never as *"Supabase behaves this way,"* and **re-run the grep-with-control on any CLI bump**.
> âš  Bounds one mechanism in the shipped binary: not a runtime observation, and not proof that no other
> code path clears storage.

Filed 2026-08-14 during DM4 planning. Found by `backend`, **independently reproduced by the lead**
on the local stack â€” empirical, not inferred.

**The measurement.** `storage.objects` held **0 rows** while the storage backend
(`STORAGE_BACKEND=file`, `/mnt`) held **663 files / 16.5 MB**, of which **162 are PHI-tier**
(`printed-documents/phi/*.pdf`, E2E residue). `supabase db reset --local` wipes the metadata and
**does not touch the bytes**.

**Why this is ðŸ”´ and not a curiosity.** The Storage API **lists from `storage.objects`**. So
orphaned bytes are invisible **to the API as well as to SQL** â€” there is no supported read path
that sees them. DM5 step 3's method is: *"for each bucket, prove zero DB references + zero product
callers + zero policies, then empty + delete the bucket (Storage API only â€” never
`storage.objects` DML)."* Run after any reset, that procedure would **prove emptiness against a
truncated table, delete nothing, and report success** while PHI-tier bytes persist backend-side.
â­ *An emptiness proof derived from a table that was just truncated is not an emptiness proof* â€”
the same shape as [[a-detector-that-finds-nothing-must-be-proven-able-to-find-something]].

**What DM5 must do instead:** enumerate at the **backend layer**, not the metadata layer â€” locally
the volume; remotely whatever the platform exposes for the S3 store â€” and reconcile that
enumeration against `storage.objects` in **both** directions before declaring a bucket empty.

**âš  Remote behaviour is an INFERENCE, explicitly not verified.** Nobody has queried or inspected
the linked project. The remote reset is also a database-level reset and platform S3 bytes surviving
it is the same mechanism class, but that **must be verified at deploy time or via vendor docs, never
assumed from the local finding**. âš  Note the remote has never received DM1+, so its bytes include
the 2026-08-11 production census (45 objects) â€” **a remote reset would orphan all of them**, which
is a live input to [[FUP-DM4-PRODROW]]'s deploy decision, not a DM5-only concern.

---

**ðŸŸ¡ UPDATE 2026-08-14 â€” the METHOD half is RULED (ADR [0120](../decisions/0120-dm5-wave-d-retirement-decisions.md) D9); the REMOTE half stays open.**

Re-measured at the DM5 open on a HEAD stack: **`storage.objects` = 0 rows** against **699 objects /
7,023,687 bytes**, **198 PHI-tier** (`attachments-phi` 6, `documents-phi` 183,
`printed-documents/phi` 9); `list` returns `[]` for **all 12** buckets. Figures differ from the
663/16.5 MB/162 above because that was a different stack state â€” **both are real; neither
supersedes the other**, and the drift is itself the point.

**Ruled:** the plan's Storage-API emptiness method is **WITHDRAWN**, replaced by **manifest-first
deletion** â€” capture the authoritative key list *before* any destructive step, delete by key, assert
`deleted_count == manifest_count` per bucket. This converts an unfalsifiable negative into a
positive count comparison: a truncated table now yields a **visibly zero-length manifest** instead
of a silent pass. Backend-agnostic, so it transfers to Cloud; the local volume walk is the
**proof harness**, not the gate (it depends on `STORAGE_BACKEND=file`).

**âš  Calibration the original filing lacks â€” it lowers the severity but not the priority.** The
orphans are **not servable**: a service-role `GET` on a known orphan key returns **400** and `sign`
returns **404 not_found**, because every read path resolves metadata first. So this is a
**data-at-rest / disposal-assertion** problem â€” Rule 12, LGPD erasure, the F-02 class â€” **not a live
exposure**. It is also *why* API-based enumeration fails by construction, so the calibration and the
method ruling are the same finding seen from two sides.

**Still open (do NOT read D9 as closing this):** on Cloud there may be **no customer-accessible tool
that can see an orphan** â€” dashboard, CLI and supabase-js all list from `storage.objects`, and the
S3 endpoint is **UNVERIFIED** (the local probe needs SigV4; the remote is off-limits under the
standing no-push directive). Also `scripts/document-reconciliation.mjs:58` covers only **2 of 12**
buckets and lists *from* `storage.objects`, so it cannot see this class either â€” widened in DM5 S0.

---

### ðŸ”´ FUP-AUTHZ-HARNESS-TRANSACTIONAL â€” the door-audit harness neutralizes OUTSIDE a transaction, so process death leaves an authz gate OPEN (owner: lead + backend; filed 2026-08-14, DM5 S2, after it happened)

**It happened.** During DM5 S2, `app.can_write_document` â€” the gate for **every** document write across all
eight home types â€” sat live with the body `begin return true; end` on the shared stack. **An
unconditional allow.** Found by `tester`, which halted all E2E rather than produce green results against
it; independently confirmed by `backend-assurance`; and traced to a **lead instruction** that said
*"neutralize and confirm your block goes red"* **without saying transactionally**, on a stack two other
teammates were live on.

**The structural defect, which outlives the incident.** `p0-authz-door-audit.sh` restores via an **`EXIT`
trap** plus a re-fetch/byte-compare. That is good design and it is **not enough**: the trap **does not fire
when a subagent's turn ends and the process is killed** â€” which is the documented failure mode for the
heavy sweep. Because the harness neutralizes **outside** a transaction, **process death = gate left open**,
silently, with no marker in the catalog.

> ## â›” AMENDED 2026-08-17 â€” **THE FILED FIX CANNOT BE BUILT, AND BUILDING IT WOULD BE WORSE THAN THE BUG.**
> **Partially resolved by a different mechanism; the item stays OPEN at ðŸŸ  for the residual.**
>
> The fix below is correct about Postgres and wrong about *this harness*. A rolled-back transaction
> makes DDL invisible **outside the session that issued it** â€” and `p0-authz-door-audit.sh`'s probe is
> not that session. `run_suite` shells out to **`supabase test db`, a separate process** with its own
> connections; the script's own header says it "mutate[s] the LIVE, COMMITTED catalog". Held in an
> uncommitted txn, every case would run against the **original** gate and classify **COVERED** â€”
> a sweep that is 100 % green and 100 % **vacuous**. â­ *The commit-then-restore design is REQUIRED by
> the probe's process boundary; it was never an oversight.*
>
> **What shipped instead â€” make the failure LOUD rather than impossible.** Process death can still
> leave a gate open; it can no longer do so unnoticed.
> - **Preflight in `p0-authz-door-audit.sh` (Â§7.16)** â€” refuses to start a sweep on a contaminated
>   stack, `exit 2`, naming the function. This is exactly the manual check that caught the original
>   incident. **Proven able to fire** against a planted unreferenced degenerate function.
> - **Preflight before EVERY arm of `p0-authz-invariant.sh`** â€” so the standing Â§6 gate step sees it.
>   Deliberately *not* a sixth arm: that would need CLAUDE.md Â§6 taught a new name, and a left-open
>   gate should fail **all** the arms it invalidates.
>
> ### âš âš  The detector recorded below was blind to TWO of the THREE neutralization forms
> The regex in this item â€” `^\s*begin\s+return\s+(true|false)\s*;\s*end` â€” is **plpgsql-only**. The
> harness also emits **`select true`** (`language sql`) and **`begin return; end`** (the `assert_noop`
> void raise-guard). Measured: `app` + `public` hold **182 SECURITY DEFINER `language sql`** functions,
> and `'select true' ~ <that regex>` is **false**. So the query that bounded the original blast radius
> to *"exactly one hit"* â€” a **correct** result for that incident, which was plpgsql â€” **could not have
> seen a SQL-language gate at all.** â­ *An enumeration bounded by a SYNTAX rather than the PROPERTY,
> living inside the safety net.* All three forms are now covered, and the detector was proven able to
> find 2 constructed instances before being trusted at 0.
>
> **Residual, why this stays open:** nothing yet *restores* automatically after process death â€” the
> guards detect, they do not repair. A committed marker row written in the same transaction as the
> neutralization (so the two can never disagree) would let the next run self-heal; not built.

**The fix (not built): make neutralize â†’ probe â†’ restore a single rolled-back transaction.** Postgres DDL
is transactional, so a `CREATE OR REPLACE FUNCTION` inside a rolled-back `begin` leaves **no residue** â€”
`backend-assurance` proved this rather than assuming it: md5 of `pg_get_functiondef` before, gate replaced
in-txn, probe run, `rollback`, re-read â†’ **byte-identical, same md5**. That makes the failure mode
**structurally impossible** instead of trap-dependent.

âš  **Two forensic properties worth knowing before the next incident:**
- **`pg_proc` carries no mtime**, so a neutralization **cannot be dated from the catalog**. The only lower
  bound here was a `pg_get_functiondef` capture the sweep happened to leave in a scratchpad. **Any result
  produced in the unknown window must be RE-RUN, not re-read.**
- **The detector that found it is worth keeping**: sweep `app` + `public` for any body matching
  `^\s*begin\s+return\s+(true|false)\s*;\s*end` â€” it is the *property* (a degenerate always-true/false
  door) rather than a list of names. It returned **exactly one** hit, which is also how the blast radius
  was bounded to a single function. â­ **Consider making it a standing gate step** â€” it is one query, and
  a left-open gate is otherwise invisible to every arm, since all four arms test doors that *exist*.

â›” **Do not read this as "the harness is unsafe to run."** It is safe when its process completes; the gap
is process death mid-run, which subagent turn boundaries make routine. Related:
[[mutation-harness-must-prove-its-rollback-first]] â€” the same class, previously recorded, where a sweep
left a gate open and `| tail` masked exit 2 as 0.

### ðŸ”´ FUP-DM4-PRODROW â€” reconcile the dangling frozen PRODUCTION snapshot row at the push/deploy step, not during DM4 (owner: lead + backend)

> ## â­• UNBLOCKED 2026-08-18 â€” the blocker is answered, and **this item's own headline figure is WITHDRAWN**
>
> **1. The blocker is discharged.** `FUP-DM5-CLOUD-ORPHAN-SURFACE`'s constructed-orphan probe
> ran and settled: **no Cloud surface can see a byte-orphan**
> ([run record](cloud-orphan-probe-2026-08-18.md)). Per TRIAGE #9 this item tracks *two*
> questions and the probe answers the **byte** one only â€” so *"erased, not reconciled"*
> survives it, and this may still never close as "reconciled": no per-row
> freeze-or-tombstone decision was ever made and no manifest exists.
>
> **2. â›” WITHDRAW the "~49 objects vanished with no `DELETE`" figure â€” the arithmetic is
> unsound.** It came from `storage.objects` reading *96 inserted / 47 deleted / 0 live*, and
> that subtraction compares two different units. **Measured on the same table and project,
> 2026-08-18:** uploading exactly **5** objects moved `n_tup_ins` by **+6**; deleting exactly
> **5** moved `n_tup_del` by **+5**. Deletes track objects 1:1; **inserts do not** â€” the
> storage write path inserts more tuples than objects. After the probe session the counters
> read **122 ins / 62 del**, a naive residual of **60**, with a true live count of **0**.
>
> > â­ **A residual of 60 was manufactured while destroying nothing unaccounted for.** The
> > residual is not a count of anything real. `pg_stat_all_tables` is an approximate
> > collector view besides â€” `n_live_tup` read **3** when the true count was **5**.
>
> âš  **This does NOT rehabilitate the remote.** The production DB *was* reset and *is* empty;
> and by finding (1) any surviving bytes would be unobservable regardless. What changes is
> only that the **magnitude** must be re-derived from something other than these counters,
> and the "~49" must not be cited again. *A figure quoted from a real counter, at the wrong
> grain, reads exactly like forensics* â€” the same class as
> [[a-predicate-quoted-at-the-wrong-grain]], and the correction to it must not repeat
> [[a-partial-fix-reads-as-a-complete-one]]: the direction is corrected **and** the magnitude
> is withdrawn rather than restated.

> ## â›” CENSUS RUN 2026-08-18 (step 1 of TRIAGE #6) â€” **THE SUBJECT IS GONE, AND IT WAS ERASED, NOT RECONCILED**
>
> **The production database is empty.** Every application table 0 rows; `auth.users` 0; all 4 buckets
> 0 objects. The 2026-08-11 subject of this item â€” 1 dangling frozen referral path Â· 3 unreferenced
> controlled-doc objects Â· 4 dangling attachment rows Â· 45 objects / ~0.5 MB â€” **no longer exists.**
> Full census with deriving queries: `docs/backend-state.md` Â§ REMOTE CENSUS 2026-08-18.
>
> ### â­ It did not get reconciled. It got truncated.
> `pg_stat_all_tables` distinguishes the two, and the distinction is the whole finding:
> `auth.users` shows **631 inserts, ZERO deletes, ZERO live rows** â€” a row-level `DELETE` increments
> `n_tup_del`, so 631-in / none-deleted / none-left is only explicable as **TRUNCATE/reset semantics**.
> Only **6 of 165** public tables ever recorded a single `DELETE`.
>
> ### â­â­ WHEN â€” the logs answer it, and the answer EXONERATES everyone while indicting the RECORD
> `query_logs` retains to 2026-08-17T10:08. At **2026-08-17 11:37:35 UTC**: `CREATE TABLE IF NOT EXISTS
> supabase_migrations.schema_migrations` â†’ every `CREATE EXTENSION` â†’ then migrations from **`20260711â€¦`**
> being *applied*. Old migrations only re-run if the history table is empty; a `db push` skips them.
> **That is a remote reset.** The `db push` the record knows about came *after*, at 2026-08-18 01:19.
> No `TRUNCATE`/`DROP SCHEMA` statement appears in the window at all.
>
> **So the reset preceded TRIAGE #6 by ~14 hours.** Nobody disobeyed the sequencing â€” â­ **TRIAGE #6 was
> RULED ON STALE FACTS.** It carefully sequenced "the reset must come LAST, because it would destroy the
> surface step 2 needs", against a remote where the reset had *already happened and the surface was
> already gone*. The ruling was moot the moment it was written, and nothing in the repo could have said
> so â€” this is [[a-records-claim-about-an-external-system-goes-stale-silently]] claiming a **ruling**
> rather than a status line. *The census-first ordering I then followed was right, but for the wrong
> reason.*
>
> A bare reset is still precisely the unmanifested, uncounted, unaudited byte destruction
> `FUP-DM5-STACK-CYCLE-DESTROYS-BYTES` flags as ungoverned â€” the event ADR 0120 **D9** exists to prevent,
> arriving through the accidental door. That judgement stands; only its tense changes, from *would* to
> *did*.
>
> ### âœ… PO RULING 2026-08-18 â€” **STAYS OPEN, BLOCKED ON the `FUP-DM5-CLOUD-ORPHAN-SURFACE` C1b probe**
> The PO declined both closure options (close-as-destroyed, and close-as-resolved). **This item remains
> OPEN until the constructed-orphan probe settles whether the ~49 objects' bytes survive.** It therefore
> now tracks **two** questions deliberately â€” the erased subject *and* the likely-orphaned bytes â€” kept
> together rather than split.
>
> â›” **Carry this forward to whenever it does close:** the *"destroyed, not reconciled"* finding below is
> **not** something the probe can change. The probe answers the byte question only. Whatever the probe
> returns, this item may **not** close as *"reconciled"* â€” no per-row re-freeze-or-tombstone decision was
> ever made and no manifest exists, and that stays true forever. â­ *Recorded here because a blocked item
> closes on the blocker's verdict, and the half that the blocker does not address is exactly the half that
> gets discharged by association* â€” the same defect the promotion ruling above was written to prevent.
>
> ### â›” THEREFORE THIS ITEM DOES NOT CLOSE AS "RECONCILED"
> The standing instruction on this item is **"reconcile or quarantine explicitly, never invent success."**
> An empty table satisfies the *letter* of "no dangling rows remain" while satisfying **none** of what was
> asked: no per-row re-freeze-or-tombstone decision, no manifest, no record of what was destroyed.
> â­ *The absence of the subject is not the discharge of the obligation* â€” closing this green would be
> exactly the shape of [[absence-of-a-verdict-is-not-absence-of-coverage]].
> **Correct disposition: close as `SUBJECT DESTROYED WITHOUT A MANIFEST`** â€” a different closure, with a
> different record, and one that leaves the governance defect visible. **PO ruling required.**
>
> ### ðŸ”´ A NEW finding this census produced: 49 objects vanished without a DELETE
> `storage.objects` = **96 inserted / 47 deleted / 0 live**. 47 were deleted properly (consistent with the
> S4 bucket retirement, whose own `storage.buckets` figures reconcile *exactly*: 16âˆ’12=4). The other
> **49 left no delete record** â€” they went with the reset's schema rebuild. âš  **A reset rebuilds
> `storage.objects`; it does not necessarily delete the objects from the backing store, and whether it
> orphans them is CLI-VERSION DEPENDENT** â†’ [[remote-reset-storage-orphan-is-cli-version-dependent]].
> So these are **likely-orphaned bytes, not confirmed-destroyed ones**, and the metadata
> that would say *what to look for* is gone too â€” so this is now **permanently unmeasurable from SQL**.
> Feeds `FUP-DM5-STORAGE-ORPHANS` (Cloud half) and is a second live instance of
> `FUP-DM5-NO-ANSWER-VS-NOTHING`: **`objects = 0` proves the METADATA is gone, never the BYTES.**
>
> ### What this does NOT establish â€” before anyone reads the above as a conclusion
> **Not when, and not by whom.** `pg_stat` carries no timestamps, and its counters are not durable
> evidence (a stats reset clears them; a `DROP`+`CREATE` gives a new relid and fresh counters). The
> reading above is *consistent with* the numbers; it is not proof, and it is recorded as such.
>
> ### Step 2 is NOT blocked by this
> `FUP-DM5-CLOUD-ORPHAN-SURFACE`'s probe **constructs** its own orphan, so an empty remote is a clean
> substrate for it â€” arguably better. What is lost is the chance to measure the *pre-existing* orphans,
> and that loss is permanent. The probe still answers its real question (*can any customer-accessible
> tool SEE an orphan on Cloud*) and still needs S3 keys minted by a human.

> ## â­• ITS TRIGGER FIRED 2026-08-18 â€” this is DUE, not deferred
>
> The body below sets the closure precondition as *"the DM stack pushed, `db push` run, a fresh census."*
> **The push ran on 2026-08-18.** So its own â›” *"do not query or mutate the linked project"* bar â€” which
> was scoped to the no-push directive â€” **lifted at the same moment**. Read-only census is now sanctioned.
>
> ## âœ… SEQUENCED 2026-08-18 (DM-FUP TRIAGE #6) â€” census â†’ probe â†’ then decide. **The remote is NOT reset first.**
>
> 1. **Read-only remote census.** The 2026-08-11 figures below are *stale by design*; migration
>    `20260927000400` has since retired 8 buckets, so the dangling rows may already be gone.
> 2. **`FUP-DM5-CLOUD-ORPHAN-SURFACE`'s constructed-orphan probe**, which needs a live writable remote.
> 3. **Then** reconcile-vs-reset, per row, with a manifest, recorded.
>
> â­ **The finding: the PO-sanctioned "much cheaper closure path" collides with an open item.** The
> amendment below offers a **remote reset** as the cheap way out. A bare `db:reset:linked` is precisely
> the unmanifested, uncounted, unaudited byte destruction that `FUP-DM5-STACK-CYCLE-DESTROYS-BYTES`
> flags as ungoverned â€” the event ADR 0120 **D9** exists to prevent, arriving through the accidental door
> instead of the deliberate one. **And it would destroy the surface step 2 needs in order to measure.**
> Both reasons are independently sufficient to sequence the reset last.

Filed 2026-08-14 at DM4 open, as the recorded half of **PO ruling R2**.

The parent plan's DM4 step 2 requires that "the 1 dangling frozen production row is reconciled
(re-freeze or explicit tombstone)". **DM4 does not do this.** At phase open, `main` sat **136
commits ahead of `origin/main`** with nothing pushed and no `db push` â€” reconciling production
then would move the DB ahead of the code that understands it, while the standing PO directive
still forbids pushes.

**What DM4 DOES owe:** build and prove the reconciliation path **locally**, so that the
production step is an execution, not a design exercise.

**What is deferred here**, from the 2026-08-11 production census (âš  **stale by design â€” re-census
before acting, never act on these figures**): 45 objects / ~0.5 MB Â· `attachments*` EMPTY Â·
**4 dangling attachment rows** Â· **3 controlled-doc objects unreferenced** Â· **1 dangling frozen
referral path**. Note DM3's own scope carried a related discrepancy â€” prod had **3 objects but 0
version rows** â€” with the standing instruction to *reconcile or quarantine explicitly, never
invent success*. The same instruction binds here.

â›” **Do not query or mutate the linked project to close this while the no-push directive stands.**
Closing it requires: the DM stack pushed, `db push` run, a fresh census, then an explicit
re-freeze-or-tombstone decision per row, recorded.

**âš  AMENDED 2026-08-14 â€” a second, much cheaper closure path exists.** The PO confirms **a full
database reset is available on the REMOTE as well as locally (no active users)** â€” the standing
pre-launch posture ([[prelaunch-db-reset-ok]]: design the correct schema rather than back-compat
migrations). A remote reset removes the dangling row outright, so the per-row
re-freeze-or-tombstone decision above **may never need to be made**. Both paths stay open; the
choice belongs to the deploy step, not to DM4.

âš  **Do NOT let this delete DM4's guards.** M3's dead-pointer null and M4's raising `DROP TABLE`
guard are correct **independent of the deploy strategy** â€” M3's is *semantics, not repair* (the
sibling FK is `ON DELETE SET NULL`), and M4's value was never "prod probably has rows" but "if
rows exist, an unmodeled writer exists." A reset makes them near-unreachable, which costs nothing.
A guard removed because one deploy strategy makes it moot is a guard missing when that strategy
changes.

ðŸ”¶ **OPEN, and it is DM5's problem rather than DM4's â€” flagged early because it is cheap to know
now:** a DB reset wipes `storage.objects` **metadata**, but it is **not established** that it
removes the underlying **bytes**. If it does not, a remote reset leaves orphaned objects with no
metadata rows â€” which would quietly undermine **DM5's retirement manifest**, whose method is
"prove zero DB references + zero product callers + zero policies, then empty and delete the bucket
**via the Storage API only, never `storage.objects` DML**". *An emptiness proof derived from a
table that was just truncated is not an emptiness proof.* Verify before DM5 relies on it.

### ðŸŸ¡ FUP-PREVIA-MINT-FLAG-ASYMMETRY â€” `HC0DV` refuses a prÃ©via on the premise that the mint is reachable, and the mint's preconditions are a STRICT SUPERSET (owner: backend; found by `qa` in the r2 re-review of the ADR 0125/0126 build)

Filed 2026-08-18 (lead), on `qa`'s **O1** â€” graded an observation, not a blocker, and the grading is right.
Measured from the live catalog by `qa` and **re-measured independently by the lead**:

```
public.log_document_previa    asserts:  document_printing
public.mint_printed_document  asserts:  document_printing + documents_wave_d
```

**The state that bites: `document_printing = on`, `documents_wave_d = off`.** A **locked** source then has
**no paper at all** â€” the prÃ©via raises `HC0DV` (*"this source registers; emit it instead"*) and the mint
raises `HC0D7` (wave D disabled). Before `HC0DV` landed, the prÃ©via was available in that state.

âš  **The message actively misdirects.** Whoever disables wave D during an incident loses the accreditation
print surface **and is told to use the door they just turned off**. That is worse than a plain refusal,
because it sends the operator to a dead end with confidence.

â­ **The class is adjacent to this build's dominant one, not the same, and the distinction is the useful
part:** the caller/door class is *a keystone proving a door works while the action cannot reach it*. This is
**a refusal added to door A on the premise that door B is available, without checking that B's preconditions
are a SUPERSET of A's.** Both are "a claim about a neighbour that nobody measured", one at the call site and
one at the precondition.

â‡’ **A refusal that redirects to another door owes a check that the other door is reachable under every state
in which the refusal fires.**

**Why it is not a blocker** (and do not re-grade it without re-deriving these):
- It needs a **non-deployed flag state** â€” both flags are `true` today.
- Killing the document substrate arguably *should* stop printing, so the *behaviour* is defensible even
  though the *message* is not.
- No PHI or authorization consequence: it fails **closed** in both directions.

**Options, none chosen:** align the prÃ©via door's assertions with the mint's; or make `HC0DV`'s message
conditional on the mint actually being reachable; or accept it and record the flag interaction where an
incident responder will find it. âš  Aligning the assertions is a **widening of refusal** â€” it would stop
prÃ©vias for *unlocked* sources too when wave D is off, which is a different and larger behaviour change than
it first appears.

**Two smaller records from the same review, neither filed separately:**
- **O2** â€” the refusal fires **after** the render, so a locked source burns a Gotenberg semaphore permit per
  request. Correctness is unaffected (no bytes leave); it is a contention cost under ADR 0125 D9's shared pool.
- **O3** â€” C5's 404-collapse comment now describes two refusal paths where it names one.

### ðŸŸ¡ FUP-E2E-SUBMITTED-POOL-UNSCOPED â€” the shared submitted-response pool has no `case_phase_id is null` filter, and the one-line fix BREAKS a passing test (owner: tester + backend; **needs `seed.sql` or pool-math work, not a filter**)

Filed 2026-08-18 (lead) on `tester`'s finding during the ADR 0125/0126 E2E build. **`tester` correctly
declined to fix it** and flagged the trap in the obvious repair â€” that judgement is the reason this is a
follow-up rather than a broken suite.

**The gap.** `submittedResponseIds` / `creatorMintFixture` in `e2e/helpers/pdf-printing.ts` scope their pool
to `commission_id` + `status = 'submitted'` and order by `id.asc`. There is **no `case_phase_id is null`
filter** â€” it was never needed, because until `pdf-printing-case-currency.spec.ts` existed no spec created
phase-bound responses in that commission.

â‡’ **Any phase-bound submitted response in CCIH can sort into pool index 0**, and the "full lifecycle" test's
first assertion (*"Nenhum documento emitidoâ€¦"*) is then false against a genuinely fresh seed.

âš  **This is INDEPENDENT of the cleanup bug that exposed it.** That bug is fixed. But a working `afterAll`
only prevents the leak *while it actually runs* â€” a crashed run, a `--grep` that skips the file, or a timeout
all leave the debris, and the pool has no scope to defend itself. Fixing the purge does not close this.

**â›” The one-line filter is NOT the fix, and this is the measured part.** Scoping the pool to
`case_phase_id is null` would leave exactly **6** rows. Measured from the live seed:

```
ComissÃ£o de Controle de InfecÃ§Ã£o Hospitalar : submitted_standalone=6  submitted_phase=3
ComissÃ£o de FarmÃ¡cia e TerapÃªutica          : submitted_standalone=4  submitted_phase=0
```

`creatorMintFixture` assumes **at least one submitted response OUTSIDE the 6-wide pool**. At exactly 6 that
assumption drops to **zero** and an already-passing test breaks. **A one-line fix that breaks a passing test
is not a one-line fix.**

**â‡’ The real repair is one of two things, neither small:**
1. **Widen the seeded pool** in `supabase/seed.sql` â€” â›” but that file is a contract with ~900 tests, and
   [[a-shared-fixture-cannot-satisfy-two-specs]] is already a recorded scar here. Any addition must be
   checked against every consumer of the CCIH response set, not just this one.
2. **Redesign the pool math** so `creatorMintFixture` does not depend on a spare slot outside a
   fixed-width pool.

âš  **Do not "fix" it by having each spec claim a wider index range** â€” that trades a structural gap for a
coordination convention between files that cannot see each other, which is the same failure one level up.

**â­ The class:** a shared fixture's selector was **correct until a new consumer changed the population it
selects from**. Nothing about `submittedResponseIds` changed; the *world* it queries did. Same family as
[[enumeration-boundary-is-a-syntax-not-a-property]] â€” the boundary (`commission + status`) was a proxy for
the property (*a standalone response nothing else has claimed*), and the proxy held only while one kind of
row existed.

### â­â­ ADDENDUM 2026-08-18 â€” the defense ALREADY EXISTED, was correct, and was UNREACHABLE

`tester` found, after being fixed and while looking at nothing in particular:
**`e2e/helpers/purge-forms.ts`** is a purpose-built, already-audited helper for this exact class, filed as
**`BUG-E2EISO-002`** after a real incident â€” a DB-wide sweep on **2026-08-03** found **46 orphaned draft
`form_versions` plus 2 orphaned PUBLISHED versions still carrying real `responses`/`answers`**, *"accumulated
silently across past gate runs"*.

â›” **And it carries a tripwire that names this bug IN ADVANCE.** Verified by the lead at `:102â€“109`:

> *"`forms` and `form_versions` also have NO ACTION referrers â€” `case_phases`, `process_template_phases`,
> `case_interviews` â€¦ so this never fires today â€” **but that is a claim about fixtures, and a comment
> asserting it would go stale the first time a spec grows a case fixture**"*

â€¦backed by a live `raise exception` at `:116â€“125` pre-checking **those exact three tables** and refusing
loudly if any row references the forms being purged.

**`pdf-printing-case-currency.spec.ts` is the first spec that grew a case fixture.** The comment predicted
its own staleness condition, named the mechanism, and shipped an instrument that would have refused â€”
**and none of it fired, because the tripwire lives in a helper the fixture never called.**

â‡’ **A correct door nothing reaches**, at a third layer: not a query with no caller, not a keystone no product
path can satisfy, but a **tripwire no fixture consults**.

âš  **The transmission mechanism is imitation, and it matters more than the instance.** The purge shape was
copied from `case-corrections.spec.ts` and `case-void-reopen.spec.ts` â€” **and neither of those uses
`purge-forms.ts` either**. Both also carry the identical unchecked `spawnSync` (no captured result, no
assertion): *unconfirmed broken, deliberately untouched*. **A defense that siblings bypass is a defense the
next author bypasses by copying them**, without ever deciding to.

**Scope, measured:** `grep -rl "session_replication_role" e2e/` â†’ **21 files** (13 specs, 3 helpers). Not all
inspected.

**â‡’ What this item should actually become.** The same gap has now surfaced **twice**: the form+response half
(2026-08-03, fixed by `purge-forms.ts`) and the **case-domain half** (2026-08-18, this item).
`purge-forms.ts` does **not** cover cases / `case_phases` / `process_templates` / `process_template_versions`
/ `process_template_phases` / `case_correction_requests` â€” it is form+response only, so it could not have
solved this fixture as-is. The natural repair is **extending its tripwire pattern to the case domain** rather
than every case-domain spec hand-rolling a purge. â­ And the tripwire is the **better instrument** than an
exit-code assertion: it refuses **before** attempting the delete, rather than reporting after.

â›” Deliberately NOT done in the ADR 0125/0126 build: extending a shared audited helper mid-gate, and touching
two sibling specs whose breakage is unconfirmed. Both are widenings, and a widening cannot be wrong-and-safe.

âš  **Lead note on a smaller instance of the same thing, recorded because it nearly mis-filed this item:** the
first verification query filtered `commission.name ilike '%CCIH%'` and returned **0 standalone, 0
phase-bound** â€” which reads as "the seed is empty" and would have made this item look like a phantom. The
commission is named **`ComissÃ£o de Controle de InfecÃ§Ã£o Hospitalar`**; `CCIH` is the *persona-email*
convention (`chefe.ccih@test.local`), not the commission's name. **A filter built from the naming convention
of an adjacent artifact returns a confident zero.**

### ðŸŸ  FUP-SUPERSESSION-BADGE-LANE-BLIND â€” `resolveSupersessionBadge` mirrors an aggregation rule but drops that rule's OWN lane restriction, so a phase-bound response gets the grain ADR 0126 D8 rejected (owner: frontend + backend; **ADR 0074/0085 axis â€” NOT the print-currency axis**)

Filed 2026-08-18 (lead). Found by `frontend` during the ADR 0126 Amendment 1 **Â§K sweep**, and **outside that
sweep's bound** â€” Â§K bounds on `printed_documents.status`; this is ADR 0074's supersession axis. It surfaced
because the sweep's vocabulary caught the word *"Atual"*, i.e. **by accident, not by coverage**. Measured from
the files by `frontend` and **re-measured independently by the lead** before filing.

**The derivation, measured** (`src/lib/queries/submissions.ts`):

```
resolveSupersessionBadge:  'substituido' â‡” hasSubmittedSuccessor
                           'atual'       â‡” isSuccessor
fed at :432/:433 by        hasSubmittedSuccessor: supersededIds.has(r.id)
                           isSuccessor:           r.supersedes_id != null
```

`grep "correction_request|approved|current_response_id"` in that file: **0 hits**. There is no approval join.

**â­ The precise defect is NOT "wrong grain" â€” it is a MIRROR that dropped its source's WHERE clause.**
The function's own comment says the submitted grain is *"the 'latest-in-chain' signal, **mirroring the
aggregation exclusion**"* â€” i.e. mirroring `app.submitted_form_responses`. That mirror is **correct**, and
measured, the aggregation rule it copies is **standalone-only by its own predicate**:

```
and r.case_phase_id is null                                   -- app.submitted_form_responses
and not exists (select 1 from responses succ
                where succ.supersedes_id = r.id and succ.status = 'submitted')
```

But `listSubmissions` surfaces **both** lanes (`isCasePhase: r.case_phase_id != null`, `:449`) and applies the
badge unconditionally. So:

- **standalone lane â€” CORRECT.** Submitted-grain *is* the effectiveness rule there, and it is exactly what
  ADR 0126 **Amendment 1 Â§A** ratified for the standalone head lane.
- **phase-bound lane â€” WRONG.** ADR 0126 **D8** requires approval-grain: `case_phases.current_response_id`
  moves **only** in `approve_correction`, and `sync_case_phase_on_submit` returns early for successors with the
  comment *"approval owns effect-taking"*.

**Consequences on the phase-bound lane, all from D8's own analysis:**
1. The original flips to **"SubstituÃ­do"** the moment a correction draft is *submitted* â€” **before approval**,
   while `current_response_id` still points at it, so it is still the effective response.
2. It flips **back** if `reject_correction` walks the draft to `in_progress` â€” the badge **flaps**, driven by a
   low-authority act.
3. A submitted-but-unapproved successor renders **"Atual"**, asserting it is the current one when the phase
   pointer does not reference it.

**â­ The differential that makes this a defect rather than a definition.** The **same pill**, one file over at
`â€¦/manage/cases/[caseId]/fase/[phaseId]/respostas/page.tsx:65`, is fed by
`corrections.some(r => r.status === "approved")` â€” **approval grain**, with a comment citing the pointer
(ADR 0085). **The platform already knows the right grain and uses the wrong one one file away, rendering the
identical badge.** That is what stops the submitted-grain version reading as an intentional dashboard semantic.

âš  **Not established, and it must be before any fix:** whether ADR 0074 *deliberately* chose submitted-grain for
a list whose job is "show me what is in flight". The mirror-comment suggests the intent was aggregation parity,
not lifecycle truth â€” which would make the lane restriction an oversight rather than a decision â€” but that is
an inference, and this item must not be closed on it. **Read ADR 0074 (and 0085) first.**

â›” **Deliberately NOT fixed in the prÃ©via build.** Different axis, different ADR, and a fix is a lane-aware
rewrite of a shared pure function with its own test surface. âš  **D8's *disclosure* argument does NOT transfer**
â€” that concerned a public page leaking an in-flight correction; this is an internal coordinator surface where a
`staff_admin` is entitled to see one. Only the **wrong-grain and flapping** halves transfer. Do not import D8's
severity wholesale.

**â­â­ SHARPENED 2026-08-18 (lead, by measurement): the correct predicate ALREADY EXISTS IN TS, in the same
directory, and ARCHITECTURE.md names it as THE twin â€” singular.**

`src/lib/queries/dashboard.ts` exports `isDashboardCountable`, which ARCHITECTURE.md Rule 2 (line ~266) calls
*"the TS twin"* of the choke-point. Its body:

```ts
return r.status === 'submitted' && r.casePhaseId == null && !r.hasSubmittedSuccessor
//                                 ^^^^^^^^^^^^^^^^^^^^ the lane conjunct, present here
```

`resolveSupersessionBadge` sits one file away in the same directory and omits exactly that conjunct. So this is
**not** "nobody knew the rule" â€” it is **two TS derivations of one SQL choke-point, of which only one is
sanctioned and only one is complete.** ARCHITECTURE.md's binding instruction in the same paragraph is
*"**Any new aggregation path must reuse that choke-point, not re-derive `status = 'submitted'`,** or corrected
metrics double-count."*

â‡’ **This narrows the fix and raises the confidence.** The repair is to make the badge consume the same lane
test rather than to invent one â€” and the "maybe ADR 0074 chose submitted-grain deliberately" caveat is now
**much weaker**, because the deliberate choice is visible in `isDashboardCountable` and it *includes* the lane
restriction. âš  Still read 0074/0085 before ruling: a *display* badge is arguably not an *aggregation* path, and
that is the one reading under which the omission could be intentional.

**â‡’ The class, which is the reusable part:** *a mirror inherits its source's predicate, not just its shape.*
`app.submitted_form_responses` carries `case_phase_id is null` in the same `where` as the exclusion the badge
copied; copying one conjunct and not the other produced a rule that is right on one lane and wrong on the other,
with **one code path and one badge** so nothing distinguishes them. Same family as
[[a-predicate-quoted-at-the-wrong-grain]], and the direct sibling of ADR 0126 Amendment 1 **Â§A** â€” which is the
*same lane-blindness* found in the print-currency derivation and fixed there.

### ðŸŸ¡ FUP-LINT-VECTOR-DIMENSION-DRIFT â€” propose a lint gate over shared SQLâ†”TS **vector fixtures**: a declared dimension that no vector varies, or a consumer that silently drops one (owner: lead + PO; **a gate change is not a mid-build edit**)

Filed 2026-08-18 (lead) during the ADR 0125/0126 prÃ©via build, on `backend`'s proposal. **Deliberately not
built in that build** â€” CLAUDE.md Â§8's own record is that each of the seven gates was added *after* its class
shipped a live defect, one at a time and on its own evidence. This one already has its evidence; what it does
not have is a PO ruling.

**The proposal, in the proposer's words:**

> A lint gate over the shared-vector fixtures that fails when a predicate's declared *input dimensions* and
> its *asserted rows* diverge: specifically, when a fixture gains a dimension that no vector varies (the flag
> exists but nothing pins it), or when a consumer's state-mapping function silently drops a dimension the
> fixture declares (the row passes because the flag never reaches the predicate).

**Both shapes were LIVE in the build that proposed it â€” this is not a hypothetical:**

1. **A dimension nothing varied.** `print-source-registers-vectors.json` declared `correction_open` /
   `phase_voided` as `form_response`-only and `meeting_disposed` as `meeting`-only, and the requirement that
   each predicate **IGNORE** a flag outside its kind was stated **in a comment and asserted by no vector** â€”
   every meeting row carried the form_response flags `false`, so the kind-scoping was never exercised in
   either direction. Found only because the build's task text asked for the pin by name. Fixed by adding 3
   cross-kind rows.
2. **A consumer that dropped one.** `frontend`'s `stateOf(v)` mapped three of the fixture's four keys, so the
   new `form_response + meeting_disposed â†’ registers=true` row **passed on its first run** â€” the flag never
   reached the predicate, so the row asserted nothing. âš  The tell was *green-on-first-run*, which reads as
   "already correct" and was in fact "not yet connected". Its mirror row **was** real and also passed, so half
   the cross-kind pin worked and half was theatre, **under one indistinguishable green bar**.

**Why a gate rather than a rule.** The vector-fixture pattern is what makes a SQLâ†”TS mirror safe at all â€” ADR
0126 D3 rejects "two computations of one property" precisely because they can disagree with nothing going red,
and the mirror survives that rejection **solely** because the fixture is the thing that reds. A fixture with a
dimension nothing varies is therefore not a weak test; it is **the mirror's safety property silently absent**.
Architecture Rule 3 already mandates this pattern for the condition evaluator, so the gate would generalise
beyond the print derivation rather than serving one feature.

**Prior art to build on:** [`check-vacuous-assertions.mjs`](../../scripts/check-vacuous-assertions.mjs) is the
precedent for turning "a test that can go green having asserted nothing" into a mechanical gate, and it
self-red-proves each checker on every run â€” a new gate should do the same, or it joins the class it audits.
âš  Note the existing gate's own scope limit, recorded in `FUP-PGTAP-VACUOUS`: it scans **TS spec files only**.
A vector fixture is consumed from **both** sides, so this gate must reason about the fixture and its
consumers, not about one language's test files.

**Not in scope until ruled:** whether it becomes gate 8 of `npm run lint` or a standalone check, and whether it
is fixture-shape-generic or keyed to a declared manifest. Both are PO calls, and neither should be settled by
whoever happens to be mid-build.

### ðŸŸ¡ FUP-LINT-STALE-SYMBOL-COMMENT â€” propose a 6th lint gate: a comment naming an identifier that no longer exists (owner: lead + PO; a gate change is not a mid-phase edit)

Filed 2026-08-13 during DM3. Every one of the five gates in `npm run lint` was added **after**
its class shipped a live defect (CLAUDE.md Â§8). This class qualifies twice over: **~6 instances
in DM3 alone**, plus 4 historically, **one of which shipped a live bug**.

**The class.** A deletion strands every comment that referenced it, and **no gate sees any of
them** â€” not typecheck, not eslint, not the four custom gates. Worst DM3 specimen:
`supersedeDocument`'s doc comment telling the frontend to upload *"via `addDocumentVersion`"* â€”
**a deleted verb, named in the documentation of a verb the frontend actively calls**. Others:
a page header claiming the storage SELECT policy carried the approver arm (false since M5 â€”
different provenance, a *migration* rather than a deletion, same class), and a module header
still advertising the signed-URL byte path M5 deleted.

âš  **The design tension that must be resolved BEFORE the gate is built â€” raised by `frontend`,
ruled by the lead 2026-08-13.** Four comments in `src/app` + `src/components` deliberately
name a dead symbol **as dead** ("`reviseChangesRequestedDocument` is gone"), which a naive
implementation would flag as false positives:

- `â€¦/documentos/novo/page.tsx:40` Â· `â€¦/nova-versao/page.tsx:27` Â· `â€¦/revisar/page.tsx:33` Â·
  `components/controlled-documents/add-version-form.tsx:52`

**RULING: tombstones are legitimate and stay.** A reader who remembers `supersedeAndSubmitDocument`
and finds **silence** concludes they are in the wrong file; one who finds *"it is gone, and here
is what replaced it"* is served. Deleting that information to satisfy a gate would make the
codebase worse in order to make a check pass â€” the gate exists to serve the reader, not the
reverse.

**Therefore the gate's spec must include a machine-checkable tombstone convention** (an explicit
marker token adjacent to the symbol, e.g. `@removed`), so a deliberate tombstone is
distinguishable from a stale claim **without natural-language guessing**. Settle the exact token
when the gate is built. â›” **Do not churn the sites now** for a gate that does not yet exist â€” a
mid-phase rewrite for a hypothetical checker is cost with no coverage.

**The tombstone population is SEVEN, and how it was established is the lesson.** Three
successive lists (backend 6, frontend 3, lead 4) were each short, and **none was careless** â€”
each was bounded by a different *unstated enumeration key*: "comments my deletion broke" / "the
composite verbs" / "verbs + the RPC". `frontend` finally derived it **by construction** â€” the
removal set from `git diff 5310358..HEAD -- src/lib` âˆª the `drop function|policy|column`
statements in the DM3 migrations (**12 symbols**), swept across `src/app` + `src/components`:
`novo/page.tsx:40` Â· `nova-versao/page.tsx:27` Â· `revisar/page.tsx:33` Â·
`add-version-form.tsx:52` Â· `version-compare-modal.tsx:23` Â·
`documentos-pendentes/[documentId]/page.tsx:43` Â· `open-controlled-version-button.tsx:20`.
**A population is only well-defined once its key is stated**, and recall is keyed to whatever
you were last looking at ([[enumeration-boundary-is-a-syntax-not-a-property]], three times in
one thread).

### â›” The gate CANNOT be keyed on identifier names â€” three live families prove it

Lead sweep of all 12 removed symbols, 2026-08-13. Every hit below is **live, correct code** that
a name-keyed gate would flag, and where the tempting "fix" edits a subsystem the rule has no
business touching:

1. â­ **`uploadDocumentFile` is simultaneously REMOVED and LIVE.** DM3 deleted a *private*
   `async function uploadDocumentFile` from `src/lib/controlled-documents/actions.ts`, while
   **`src/lib/documents/upload-client.ts:13` exports a live one** â€” imported and called by
   `add-version-form.tsx:12,144`, `create-wizard.tsx:27,436` and
   `documents/document-upload-dialog.tsx:18,216`. **This is decisive: a bare identifier is not a
   key at all**, independent of scoping-by-family. A name-keyed gate would flag three live call
   sites of a live function.
2. **printed-documents (ADR 0104, retires DM5/Wave D)** â€” âœ… **RESOLVED by DM5Â·S3, corrected here
   2026-08-17 (QA r3 MINOR-13).** `src/app/api/documents/[id]/route.ts` now calls
   `.from(row.storage_bucket)` â€” **the bucket comes FROM THE DOOR** (D7/D12: a print's bytes are a
   `file_objects` row in `documents-standard`/`-phi`, resolved through
   `app.resolve_document_version_bytes`), and the file says so in a comment. There is no bucket
   literal in it. âš  This line was reported closed **twice** while open (r2, r3) â€” *the small item
   reported closed repeatedly is itself the finding.* Was: `.download(row.storage_path)`, downloading
   from the **`printed-documents`** bucket. A
   different table's column that DM3 never dropped, under a URL that *reads* in-scope. Plan Â§1.2
   named this exact hazard (two families sharing the `document` noun) and Â§1.3 warns the route's
   URL is misleading while its body is not.
3. **form-assets (ratified permanently separate, ADR 0114 D13)** â€” `storage_path` in
   `components/forms/block-card.tsx:91,478` Â· `block-list.tsx:53` Â· `item-editor-dialog.tsx:281` Â·
   `read-only-blocks.tsx:52`.

**Spec consequences (binding on whoever builds it):** resolve each symbol to its **owning module
and family**, never its name; and the first dry-run must run against a **hand-classified
control** containing all three families above as known-goods â€” *a detector that finds a lot needs
proving too* ([[a-detector-that-finds-a-lot-needs-proving-too]]).

### ðŸ”» LEAD RECOMMENDATION 2026-08-13: **do NOT build the gate.** Adopt the convention; keep the process step

Four findings, in order of how much they cost the idea:

1. **The same identifier holds THREE truth values inside ONE file.** Verified in
   `src/lib/controlled-documents/actions.ts`: **`:119`** tombstone Â· **`:309` LIVE and
   correct** (it names the live export *and its module*, `@/lib/documents/upload-client`) Â·
   **`:693`** tombstone. So **file scoping fails too**, not just name-keying. Classification
   must be **per-occurrence**, and `:309` is separable from `:119` only by **adjacent prose** â€”
   natural-language disambiguation, not resolution. It is also the occurrence a gate most needs
   to get right: flagging it invites deleting the sentence that tells the next reader where the
   live helper lives.
2. **Module resolution reaches only 3 of the 7 tombstones (43%).** Sites 1â€“3 are TS module
   bindings; site 4 names a **Postgres function + column**, site 5 a **TS property** (`hasFile`
   â€” never a module binding), sites 6â€“7 a **Postgres policy**. The misses need two *further*
   resolvers: a type-level property resolver and a catalog lookup.
3. **The DB arm needs a RUNNING DATABASE, and that is not negotiable.** The standing rule is
   that the **live catalog is the sole truth** for any schema/RLS/RPC question â€” never migration
   text, which is stale by design (runtime `pg_get_functiondef()` + `replace()` + `execute`), and
   which has already produced a confident **false P0** here. So the arm must query `pg_proc` /
   `pg_policies`. All five current `npm run lint` gates are **stateless static checks that run in
   a fresh worktree with no stack up**; a DB-dependent arm changes what the lint gate *is*, and
   the shared-stack constraint makes it worse.
4. âš  **The proposed convention-only gate does NOT work as specified**, and the error is
   instructive. `frontend` suggested checking that *"mentions of removal-set symbols carry the
   marker"*, arguing it would leave `actions.ts:309` alone *"because a live reference wouldn't
   carry the marker."* That exemption is **inverted**: `uploadDocumentFile` **is** in the removal
   set, so `:309` mentioning it **without** a marker is precisely what the rule flags. Rescuable
   with per-occurrence suppression â€” but the authoring burden then lands exactly on the most
   confusing case. **Also fatal to the "it's just a grep" claim:** the rule needs a *removal set*,
   which needs a **diff base** â€” making it a CI check, not a stateless lint gate.

**Recommendation (PO decides â€” it is a lint-gate change):** adopt the tombstone marker as an
**authoring convention** (zero cost, helps every reader) and **do not build a checker**. Rely on
the step that actually worked here: **at deletion time, derive the removal set from the diff
(`git diff <base>..HEAD -- src/lib` âˆª the migrations' `drop function|policy|column` statements)
and sweep it.** That is what found all seven; three prior lists built from recall found 6, 3 and
4, each bounded by a different unstated key. **Encode it as a deletion-discipline step, not a
script** â€” the knowledge lives with whoever removes the symbol, and no resolver reproduces it.

**If the PO still wants a checker**, it must satisfy all of: per-occurrence classification Â·
family/module resolution Â· a catalog arm Â· a diff base Â· and a first dry-run against a
**hand-classified control** containing `actions.ts:309`, `api/documents/[id]/route.ts:46` and the
`components/forms/*` hits as **known-goods** â€” *a detector that finds a lot needs proving too*
([[a-detector-that-finds-a-lot-needs-proving-too]],
[[detector-that-finds-nothing-must-be-proven-able-to-find-something]]).

### ðŸŸ¡ FUP-PGTAP-SAVEPOINT â€” âš  **DOWNGRADED 2026-08-13 (ðŸ”´â†’ðŸŸ¡): the original claim was WRONG. No coverage is being lost** (owner: lead + backend)

> ## â›” CORRECTION â€” read this before the original text below
>
> **Measured on a clean reset (the run this follow-up demanded): `193` â†’ `ok`, `194` â†’ `ok`,
> ZERO bad plans across 190 files / 6149 tests, `Result: PASS`.** The two "affected" suites are
> **not** losing assertions.
>
> **The true mechanism**, pinned by a two-assertion repro (one outside the savepoint, one inside):
> ```
> plan(2); ok(true,'A'); savepoint s; throws_ok(â€¦,'B'); rollback to savepoint s; finish();
>   â†’ ok 1 - A          â† emitted to stdout
>   â†’ ok 2 - B          â† ALSO emitted; TAP output cannot be rolled back
>   â†’ # Looks like you planned 2 tests but ran 1
> ```
> **pg_prove parses the TAP stream, not pgTAP's internal table.** Both `ok` lines are emitted at
> statement execution and survive the rollback, so **the gate's tally is correct and the
> assertion does count**. Only pgTAP's *internal* counter under-counts, producing a `#`
> **diagnostic** that pg_prove does not treat as a failure.
>
> **What IS real:** the **degenerate** case â€” when *every* assertion in the file sits inside the
> rolled-back region, `finish()` raises `# No tests run!`, which **does** fail the file.
>
> âš  **My error, recorded because it is the more useful part: I generalized from the degenerate
> case.** The original repro was `plan(1)` with its single assertion inside the savepoint â€” the
> one shape where the internal under-count reaches zero and becomes an error. I proved that shape
> and then asserted the general one, filing a ðŸ”´ gate-integrity item on a mechanism I had not
> tested in the configuration the live suites actually use.
> [[the-proposal-you-author-is-the-one-you-dont-test]], again, and this time it was mine.
>
> **Residual value (why this stays open at ðŸŸ¡, not closed):** the `finish()` diagnostic is
> genuinely misleading to anyone reading it, and the degenerate shape is a real hazard worth not
> writing. `330`'s captured-definition pattern remains the better style. But **nothing is
> uncovered and no prior gate record is invalidated** â€” the earlier `194` "planned 8 but ran 0"
> was the dirty-DB artifact, exactly as `backend` suspected and declined to attribute.
>
> The original text below is retained as written, so the correction is legible as a correction.

### (original filing, superseded above) a pgTAP assertion inside a rolled-back savepoint PRINTS `ok` but is DISCARDED from the tally; 2 live suites use the shape

Found by `backend` during DM3Â·M2 (2026-08-13) and **independently reproduced by the lead
the same day**, twice, against the live DB.

**The mechanism, proven â€” not inferred.** With `pgtap` installed, two runs differing only
in the savepoint:

```
RUN A:  plan(1); savepoint s; select throws_ok($$ select 1/0 $$,'22012'); rollback to savepoint s; select * from finish();
        â†’ prints  "ok 1 - threw 22012"   then  ERROR: # No tests run!
RUN B:  plan(1); select throws_ok($$ select 1/0 $$,'22012'); select * from finish();
        â†’ prints  "ok 1 - threw 22012"   then  finish() returns 0 rows (clean)
```

pgTAP keeps its results in transaction-local state, so `rollback to savepoint` unwinds its
own bookkeeping along with the mutation. **The assertion still prints `ok`.** The file then
reports `planned N but ran <N`, which a summary line can hide â€” this is the pgTAP twin of
the class `lint:vacuous` gates for TypeScript, and there is **no equivalent gate for SQL**.

**Live instances â€” a lead sweep of `supabase/tests/` found the shape in 4 files:**

| File | Verdict |
| --- | --- |
| `193_schema_integrity.sql:89-99` | âš  **AFFECTED** â€” `throws_ok` at `:93` sits inside the window. **Missed by the original report, which flagged only 194.** The enclosed assertion is a *mutation twin* (drop the twin CHECK, assert the refusal still holds) â€” the kind whose silent non-counting matters most, because its whole job is to prove a barrier is independent |
| `194_tenant_composite_fk.sql:87-95` | âš  **AFFECTED** â€” `throws_ok` at `:89` inside the window (its test 4.1) |
| `330_dm3_controlled_documents.sql` | âœ… **CLEAN** â€” its 3 hits are *comments documenting the hazard*; the suite mutates without a savepoint and restores from a **captured** `pg_get_constraintdef`, so the restore cannot drift from the real definition |
| `100_dashboard.sql:411-412` | âœ… clean â€” **and it already carried the explanation**: *"â›” Deliberately NOT a savepoint. pgTAP keeps its test counter in transaction-local state, so `rollback to savepoint` after an `is()` would rewind the counter."* |

**The most useful part of this finding is that last row.** The hazard was **already known and
already written down** â€” as a comment in one file, where it protected that file and nothing
else. Two other suites then shipped the shape. Knowledge that lives only in a local comment
does not propagate; that is what `lint:vacuous` and the keystone discipline exist to fix, and
this class had neither. Related: [a comment is an assertion that goes stale silently].

**What is NOT yet established.** The per-suite blast radius. `194` was observed reporting
`planned 8 but ran 0` on a **dirty** local DB, and that is *not* attributed to this mechanism â€”
`194` is a tenant/commission-count suite and the stack carried E2E leftovers, a known
spurious-red class. The suites cannot be run raw (`test_helpers` is harness-created), so the
real numbers come from `npm run test:db` on a **fresh `supabase db reset`**.

**Discharge:**
1. On a fresh reset, capture `planned N / ran M` for `193` and `194`; if `M < N`, those
   assertions have never contributed to any gate record, and the affected keystones' prior
   green must be re-read as unproven.
2. Rewrite both to `330`'s pattern â€” mutate without a savepoint, restore from a captured
   definition, and keep the file-level `rollback` as the outer restore.
3. **Add the missing gate.** A `lint:vacuous`-style check for pgTAP: flag any assertion
   between `savepoint` and `rollback to savepoint`, and/or assert `planned == ran` per file
   rather than trusting the summary. Without step 3 this recurs â€” it already did, twice,
   after being documented once.

### ðŸŸ¡ FUP-DM3-ETHICS-UI â€” no UI can attach a decision letter to an ethics case; DM3 ships both seams writable via the API only (owner: PO, a feature phase)

Filed 2026-08-13 at DM3 open, as the recorded half of a PO scope ruling. **This is a
decision, not an omission** â€” a later reader finding two write-only columns must land here
rather than infer neglect.

**What DM3 does ship** (ADR 0114 Amendment 2 / D17, conditions 1â€“5): both
`ethics_decision_details.decision_letter_document_id` and
`ethics_notifications.related_document_id` get a real FK to `documents(id)`;
`issue_ethics_notification`'s fail-closed rejection is removed and keystone K8 with it;
and `set_ethics_decision_details` gains `p_decision_letter_document_id`, forwarded from
`src/lib/ethics/actions.ts`. After DM3 the seams are genuinely writable document-model
citizens **through the API**.

**What it does not ship, and why.** No attach-a-letter affordance. None has ever existed â€”
verified 2026-08-13 on five independent lines: no writer passes either field (the only
callers are `ethics-decisions-panel.tsx`'s 10-key payload and
`ethics-notifications-panel.tsx`'s 5-key payload); no form control exists in either dialog;
`type="file"` appears in 7 components repo-wide and **none** under `src/components/ethics/`;
nothing in `src/` *reads* either field off a value, so even a populated column would change
no pixel; and `e2e/ethics-e2-procedure.spec.ts:55-56` already declares the Stage-E
legal-privileged decision letter unbuilt.

A decision letter is the **archetypal `legal_privileged` document**. Its UI is therefore not
a form field â€” it needs the ADR 0072 / ETHÂ·E1 access spine (`case_access_grants` +
`max_confidentiality` + recusal), the D15 confidentiality ceiling, and E2E coverage that
does not exist today. Appending that to a migration wave is how the most security-sensitive
surface in the phase gets the least design attention.

**Discharge = a feature phase that designs the affordance against the ETHÂ·E1 spine**, with
its own threat model and E2E. Until then the columns are write-only by design.

### ðŸŸ¡ FUP-ETH-KBD-1 â€” the professional lane's `TypeaheadField` mount is keyboard-UNTESTED, so BUG-ETHE4-FOCUS-1's defect is not ruled out there (owner: frontend + tester)

Carried out of **BUG-ETHE4-FOCUS-1** when that bug was rotated to
[bug-log-archive.md](./bug-log-archive.md) on 2026-08-12. It was filed inside the bug as *"not
confirmed, flagged as a hypothesis for whoever fixes it"*; archiving it under the bug's âœ… would
have converted an open question into an apparent closure.

**The gap.** `TypeaheadField` is shared by three mounts â€” "Buscar profissional", "Buscar
participante externo", "UsuÃ¡rio da plataforma". The FOCUS-1 fix (defer `setOpen(false)` one tick +
`suppressEscapeWhilePopupOpen`) was applied at the component root and all three mounts were
tab-counted after the fix, so this is **not** a suspected live regression. What is untested is the
*pre-fix* question the bug never answered: `PROF-PICK` / `PROF-CREATE` drive the professional lane
**by mouse only**, so no spec has ever keyboard-navigated it end-to-end. There is no KBD-1
equivalent guarding that lane against a future reintroduction.

**Why it is worth an item rather than a shrug.** QA's **m8** found *both* FOCUS-1 root causes
(synchronous `onBlur={settle}` at `evidence-picker.tsx:437`, no `onEscapeKeyDown` suppressor) in a
second, unrelated dialog â€” flagged structurally, never verified live. The pattern recurs in places
nobody has keyboard-tested; the mouse-only coverage is how it stays invisible.

**Disposition (cheap):** extend the professional lane with a KBD-1-shaped assertion â€” tab-stop
count plus Escape-does-not-reset-the-lane â€” and decide separately whether `evidence-picker.tsx`
gets the same treatment. Needs a tester-owned spec change; note FUP-ETH-A11Y-1's m4 warning that
these routes collide with `pickFromTypeahead`'s locators, so the two items should be scheduled
together.

### ðŸŸ¡ FUP-ETH-A11Y-1 â€” the ETHÂ·E4 dialogs: error text is never `aria-describedby`-wired, and the typeahead announces neither loading nor result count (QA m3 + m4; owner: frontend + tester)

> âœ… **BUILT in the working tree 2026-08-12 (`frontend`) â€” NOT committed. Awaiting the tester
> batch.** m3: both files now pass `hasError`/`hasDescription` into `useFieldIds`, spread
> `controlProps`, and put `id={errorId}` / `id={descriptionId}` on `FieldError` /
> `FieldDescription`; the checkbox-GROUP error in `case-participant-role-manager.tsx` hangs off
> the `<fieldset>`'s own `aria-describedby` (a 3rd site QA's count of 2 did not include).
> Verified live by submitting an empty "Novo papel": every emitted `aria-describedby` resolves to
> a real `role="alert"` node carrying the pt-BR message.
> **m4 route chosen: (a) a separate `sr-only` `role="status" aria-live="polite"` region, worded
> so it duplicates NO visible string** â€” the listbox's `aria-label` (`OpÃ§Ãµes para {label}`), which
> `pickFromTypeahead` scopes on, is byte-for-byte unchanged, and route (b) was rejected for that
> reason. New strings, all `sr-only` and all previously absent from the DOM:
> `"Carregando resultadosâ€¦"` Â· `"1 opÃ§Ã£o disponÃ­vel. Use as setas para navegar e Enter para
> escolher."` / `"{n} opÃ§Ãµes disponÃ­veis. â€¦"` Â· `"Nenhuma opÃ§Ã£o disponÃ­vel."`. The error path
> announces nothing (the visible message already carries `role="alert"`), and a query below the
> 2-character floor announces nothing (a `null` `emptyAnnouncement`), so no claim is made about a
> search that never ran. Verified live: `"Nenhum resultado. VocÃª pode cadastrar um novo."`,
> `"Digite ao menos 2 letras para buscar."` and `"Buscandoâ€¦"` each still match exactly ONCE.

**m3 â€” `aria-describedby` never reaches the error id.** `useFieldIds`
(`src/components/ui/field.tsx:103-133`) already emits `descriptionId`, `errorId` and a
composed `aria-describedby`, but every ETHÂ·E4 call site passes only `.controlProps.id` and
hand-sets `aria-invalid`: `add-participant-dialog.tsx` (2 sites) and
`case-participant-role-manager.tsx` (2 sites, one of which wires `descriptionId` but never
`errorId`). `FieldError` carries `role="alert"`, so the message **is** announced when it
first appears â€” the gap is that a user who tabs **back** to the invalid field hears the label
and nothing else. CLAUDE.md Â§8 requires accessible inputs.
Fix shape: pass `hasError`/`hasDescription` into `useFieldIds`, spread `controlProps` instead
of picking `.id`, and put `id={errorId}` on `FieldError` / `id={descriptionId}` on
`FieldDescription` (neither auto-wires â€” both are plain `<p>` pass-throughs).

**m4 â€” the typeahead popup has no live region.** `add-participant-dialog.tsx:391-407`:
*"Buscandoâ€¦"*, the empty hint and the result list are plain nodes **outside** the listbox
that `aria-controls` points at, with no `aria-live`/`role="status"`. Only the error path is
announced (it has `role="alert"`). Keyboard operation and the rest of the ARIA structure are
complete and correct.

âš  **Why this was filed rather than fixed inside ETHÂ·E4 (lead, 2026-08-11).** m4 cannot be
closed without either (a) new visually-hidden text, which risks duplicating the existing
visible strings â€” `"Nenhum resultado. VocÃª pode cadastrar um novo."` and `"Buscandoâ€¦"` â€” into
a second `getByText` match and redding the suite on strict mode, or (b) folding the count into
the listbox's `aria-label`, which is the exact string `pickFromTypeahead` scopes on (QA r2
confirmed the app really does set it). **Either route needs a coordinated spec change, which
is tester-owned**, so doing it as a lead edit at the tail of the gate would have put churn
into the locators this phase had just finished stabilizing. m3 is attribute-only and safe on
its own, but it belongs with m4 as one a11y pass. Both are QA-rated MINOR and non-blocking.

### ðŸŸ¡ FUP-E2E-SERVER-DEAD-1 â€” the prod-standalone server dies under load in ~3 of 17 batches, and `BATCH_TESTS=22` is the known rescue (owner: unassigned)

Filed from the ETHÂ·E4 handoff Â§3, where it was called out but never given an id. In one
`e2e:prod` run, batches **5, 16 and 17 all hit `server_dead=1`**; 5 and 17 recovered on the
automatic `INFRA_RETRY`, **16's retry died too**, leaving 69 tests with no verdict and turning
a run with **zero assertion failures** into a RED gate. The rate is drifting: 1 of 17 earlier
the same day, 3 of 17 by evening.

Known-good workaround, used successfully **twice** on two different dead groups: re-run the
group alone at `BATCH_TESTS=22` (smaller batches â‡’ more frequent server restarts). The
Flexible-Forms group (`ff1`â€“`ff5` + `flagged-aggregate-result`) stresses it regardless of
batching â€” its own sub-batches hit `server_dead` and recovered.

**This is an infrastructure characteristic, not a product defect** â€” no assertion has ever
failed in one of these batches. It is filed because it costs a full gate re-run each time it
bites, and because "infra is not a pass": a batch that never produced a verdict must not be
read as green.
**â­• NEW DATA POINT â€” ADR 0137 batch, 2026-08-24: 4 of 20 batches.** `REBUILD=1 npm run e2e:prod`,
batches **5, 6, 9, 12** each `server_dead=1` (conn_errors 1 / 38 / 72 / 64). **All four recovered on
`INFRA_RETRY`**, so the run finished `GATE GREEN`, exit 0 â€” 1221 passed, 0 failed, 0 infra,
0 did-not-run.

âš  **The rate is still drifting: 1/17 â†’ 3/17 â†’ 4/20.** And the run IMMEDIATELY before this one
(same tree, same day) is the counter-example that makes this expensive rather than cosmetic:
batch 6 died, **its retry did not recover**, and a run with **zero assertion failures** exited
**5 (UNRUN)** with 10 tests never executed. Recovery is luck, not a property.

â­ The gate is doing its job â€” clean/unproven/dirty stay partitioned, so a stack death never reads
as a regression. What it cannot do is make an unrun test proven. `BATCH_TESTS=22` remains the
recorded rescue and is still unapplied.

### ðŸŸ¡ FUP-ACT-HATLESS-AUDIT â€” a hatless read's audit row omits the `acting_as` KEY, and absence has three meanings (S4 QA MINOR-6; owner: backend)

Catalog-verified in `app.audit_write`:

```
v_acting_as := app.active_role();
if v_acting_as is not null then
  v_metadata := v_metadata || jsonb_build_object('acting_as', v_acting_as);
end if;
```

The key is **absent, not null**. So for the hatless-grantee path â€” which under ADR 0106 D5/D6
as built retains read-only per-case reach **including `read_standard_phi`** (keystone `319`
A13; the Rule-12 read this platform most needs to reconstruct later) â€” the trail cannot
distinguish *"no hat was worn"* from *"pre-ACT row"* from *"written by a service-role/system
path"*.

**Not a violation and not blocking:** Rule 11 is met (the row records *that* and *who*;
`acting_as` is an ADR 0106 addition, not a Rule 11 requirement). This is **legibility** â€”
recording hatlessness explicitly (`'acting_as','none'`, or a `hatless: true` marker) turns an
inference into a fact for a few characters.

âš  **Travels with the A13 ruling** (ADR 0106 D5/D14, S4 QA Â§3): if the PO ever rules that
hatless principals must lose relationship-derived reach, this class of row stops existing and
the follow-up dies with it. Do not implement it ahead of that ruling. Needs a migration â€”
deliberately out of S4, which shipped none.

### â–¶ FUP-MIN-CUTOVER â€” audio-minutes pre-enable gates (feature merged, flag OFF)

Owner: lead + human. Before the pilot flag flips (runbook Â§6 checklist is authoritative):
- [x] **Remote `db push`** â€” âœ… DONE (discovered already applied; catalog-verified 2026-08-06:
      302/302 migrations incl. AFF `20260909*` + MIN `20260910000100â€“400`, all 13 MIN functions
      in remote `pg_proc` with expected `prosecdef`, `meeting-audio` bucket cap 524288000).
      The deployed-`main`-breaks warning is closed.
- [ ] **Cloud storage upload cap** â€” â›” **BLOCKED, human decision**: org `Rede Madre` is on the
      **Free plan** (checked 2026-08-06) â†’ 50 MB hard cap; 500 MB needs a **Pro upgrade**, then
      raise the dashboard storage limit and record it in runbook Â§2 (blocker recorded there).
- [ ] **T5 manual smoke** â€” plumbing âœ… DONE 2026-08-06: `minute_generator/.env` + platform
      `.env.local` `MINUTES_*` share minted secrets; smoke doc authored
      (`docs/testing/audio-minutes-smoke.md` â€” was referenced by runbook Â§6 but never existed);
      Â§3 webhook probe â†’ 401 âœ“; local storage container live-verified at 512 MiB. **Run blocked
      on human**: fill `ANTHROPIC_API_KEY` + `ASSEMBLYAI_API_KEY` in `minute_generator/.env`,
      supply a 1â€“3 min non-medical pt-BR audio, flip `MINUTES_SERVICE_URL` :8891â†’:8000 for the
      session (smoke doc has the full recipe).
- [x] **QA r2 residuals R1 + R3** â€” âœ… fixed 2026-08-06. R1: accessible name is now
      `Anexar a um item: "<resoluÃ§Ã£o>" a "<item>"` â€” unique per card AND the visible label is
      the prefix (closes the pre-existing WCAG 2.5.3 gap QA's prescribed format would have kept).
      R3: `server-only` reverted on `src/lib/audio-jobs/hmac.ts`; E2E helper imports the real
      `signCallbackBody` (D16 restored); `docs/backend-state.md` updated. MIN spec 10/10 green
      (chromium, fresh reset).
- [ ] **R2** â€” the â‰¥8-tests click-delivery anomaly: did NOT reproduce on the 2026-08-06 rerun
      (10/10 first-attempt); still owed one look on different hardware before the pilot.
- [ ] Env vars on the deploy target: `MINUTES_SERVICE_URL/_API_KEY`, `MINUTES_CALLBACK_HMAC_SECRET`,
      `MINUTES_CALLBACK_BASE_URL` (runbook Â§3) â€” mint NEW production secrets, never the local
      smoke pair; plus the service itself deployed (`docker-compose.coolify.yml`) with its DPA
      gates closed (runbook Â§6).

<!-- OPEN backlog only (reviewed at each phase start). Resolved [x] items archived â†’
     docs/progress/follow-ups-archive.md (full snapshot). -->

### ðŸŸ¢ FUP-QO-6 â€” oversight-toggle slow-confirm: **annoyance severity ACCEPTED provisionally (PO ruling 2026-08-07)**; open LOW priority, DB-vs-UI formally unclassified

**PO ruling 2026-08-07 (D-FUP-6b):** after 16 total trials with 0 recurrences (15 isolated +
1 full-load gate with a continuous ~12,100-sample out-of-process poller â€” see the Test Run
Summary row), the stale-UI (annoyance) assumption is **accepted provisionally for the pilot**.
The lost-write question stays formally open at LOW priority; nobody manufactures a
classification. If it recurs, the recorded next step is a targeted 20â€“30Ã— repeated-trial run
of the D9 test alone under artificial contention with a **sub-second** poller (the ~1.6 s
interval aliases past the flip â€” proven this run). â›” The original "do not fix by raising the
timeout" stands. Original record + diagnostic history below.

<details><summary>Original entry (2026-08-07, pre-ruling)</summary>

### the oversight toggle intermittently fails to confirm within 10 s; DB-vs-UI unclassified

Found by `tester` once its restore check stopped trusting optimistic client state. **Pre-existing â€”
not introduced by QOÂ·A, and invisible until now BY CONSTRUCTION**: the previous check read
`CommissionOversightToggle`'s optimistic value, which updates synchronously before the server action
starts, so it reported success every time regardless of what the server did. Making the check honest
is what surfaced this.

**Signature (consistent, ~3 failures in ~13 early attempts, â‰ˆ23%):** a failing run takes **~11.5 s**
against **~2.5â€“3.0 s** on a pass â€” the reload-based assertion burning its full 10 s timeout. So the
confirmation is *not* being read too early; the state genuinely is not observable within the window.

âš  **The decisive fact is NOT established.** At the moment of failure, is the DB correct with the page
stale, or **did the write never land**? That distinction is the whole severity question: stale UI is a
known annoyance here, but an intermittent write failure means **D9's governance control silently
no-ops ~1 in 4 times** and an admin would believe a committee is under oversight when it is not.

A bounded diagnostic (15 isolated runs + an out-of-process ~1.4 s DB poller, 216 samples) came back
**15/15 PASS â€” unreproduced**. The only `excluded` readings were the expected mid-test transients of
passing runs. `tester` stopped at the bound rather than extending, and reported the absence of the
fact instead of manufacturing one.

**The streak is itself evidence.** P(0 failures in 15 trials) at a constant 20â€“25 % rate is ~1.3â€“3.5 %.
The likeliest reading is that failures **cluster with environmental contention** rather than being
independent per-trial draws â€” the diagnostic ran isolated and unloaded. Consequence for the gate:
`RETRIES=1` retries moments after the first attempt, i.e. under the *same* conditions, so the naive
~6 % residual-spurious-red figure is an **optimistic floor, not a ceiling**.

â›” **Do not "fix" this by raising the timeout** â€” that hides precisely the question above. Next step is
to reproduce under **load** (during a full `e2e:prod` run, not in isolation) with the out-of-process
poller attached, then classify. In-browser instrumentation is useless here: it perturbed the measurement
(6/6 green with logging on, recurrence once removed).

**F6 result (2026-08-07, tester, under real full-gate load): still NOT REPRODUCED.** `quality-oversight.spec.ts`
ran once inside the full `e2e:prod` gate (batch 16, 87-file suite, `RESET=1`); all 4 D9/D10 toggle tests
passed clean â€” WRITE PATH 1.5s, READ PATH 1.6s, D10 WRITE 1.3s, D10 READ 1.9s, none near the ~11.5s
failure signature. The out-of-process DB poller (docker-exec psql against `commissions.quality_oversight`,
~1.2â€“1.6s interval, continuous 13:52:44â€“16:12:5x UTC, ~12,100 samples, 0 gaps) recorded **zero `excluded`
samples for `ccih`** across the whole batch-16 window â€” the WRITE-PATH test's flip + `finally`-block revert
completes faster than the poller's sampling interval, so this is aliasing (too fast to catch), not a
failed-to-flip signal; the DB row that WAS sampled around the test window read `visible` with a fresh
`updated_at` consistent with a clean, fast round-trip. Extends the non-reproduction streak to 15 isolated
+ 1 full-load run, 0 failures. **The severity question remains formally open** â€” this run did not supply
a failure to classify, and no classification is manufactured in its absence. Evidence + poller logs:
`docs/../PROGRESS.md` Test Run Summary (2026-08-07, "QOÂ·FUP F6"); raw poller logs are in the tester's
scratchpad (not committed â€” out-of-band per the task's own instruction), `oversight-samples.log` /
`oversight-samples-resume.log`.

</details>

### ðŸŸ¡ FUP-AFF-4 â€” make the membership-role list a Postgres ENUM (2026-08-06)

Raised by `backend`, and it is the durable fix for N1. `memberships_role_check` is a `CHECK` over
`text`, so the role list reaches **no** generated type (`grep technical_director_deputy
src/lib/types/database.ts` â†’ 0 hits) and **no unit test can see the authority**. N1's remedy is a
committed fixture with a gate at each end (pgTAP `304` Â§10 â†” fixture â†” the pt-BR label test) â€” which
closes the drift hole, but is a **build-time gate, not a guard**: widen the CHECK, never regenerate
the fixture, ship without `npm run test:db`, and an English snake_case identifier still reaches a
pt-BR `role="alert"` through `roleLabel`'s `?? role` fallback.

As an **enum**, the list lands in `database.ts` and `tsc` enforces exhaustiveness â€” the check moves
from "a suite someone must run" to "the build". Deferred because it is a schema change with real
blast radius (`memberships_scope_shape`, every `role` comparison, the ADR-0094 completeness grid).
Decide before the role set next changes, not after.

### ðŸŸ¡ FUP-AFF-2 â€” D7's "documented escape for a foreign professional" is unreachable (2026-08-06)

Raised by `backend` at W3 close-out. ADR 0097 **D7** makes `profiles.cpf` nullable *specifically* so a
foreign professional without a CPF can be registered "without a later schema change" â€” and then
requires CPF **at the action layer**. W3 implemented the requirement (correctly: without it the
identifier-first flow creates people no later CPF lookup can find, and the feature is inert on exactly
the population it exists for). **Net effect: the nullable column's escape has no product path.**

That is D7's own design, not a defect, and it is the right default â€” but it is recorded here because
the day the first customer has one foreign professional it becomes a real gap, and the fix should be a
**deliberate "sem CPF" affordance** (audited, org_admin-only, with the person still findable by name)
rather than a panicked schema change. Blocks nothing. Decide before the pilot onboards clinical staff,
not after.

### ðŸŸ¡ FUP-SILENT-READ-1 â€” ~207 PostgREST reads never destructure `error` (2026-08-11, lead)

Surfaced during ETHÂ·E4 when `tester`, enumerating the blast radius of the
`professional_profiles` column-list grant, noticed `getCaseDetail`'s professional embed
(`src/lib/queries/cases.ts:1358`) never destructured `error`. On any failure `profRows` is
null, `?? []` yields an empty map, and every professional participant renders with
`prof = null` â€” the roster silently falls back to the mint-time `display_name` snapshot,
`professionalProfileId` goes missing, and **`linkState` is undefined so the "Resolver
vÃ­nculo" affordance simply vanishes.** No error, no log, no visible failure: a deleted
feature that looks like an empty state.

**Fixed in-phase, all three ETHÂ·E4-authored instances** (`7e55f01`): that embed, plus
`members.ts` `listLinkableOrgUsers` (an empty user list is indistinguishable from "no
account" â€” walking the coordinator to `no_account`, which makes the case exclusion
vacuously satisfied; the same class as QA's MAJOR-2, inside the very function written to
close the previous instance of it) and `vocabulary/actions.ts`
`listCaseParticipantRolesForAdmin`. ETHÂ·E4-authored code is at zero.

**The repo-wide residue is this follow-up.** A cheap sweep counts **~207 of 773**
PostgREST destructures (~27%, ~40 modules â€” `rca.ts` 14, `capa.ts` 13, `referrals.ts` 10,
`cases.ts` 10). âš  **That is NOT a count of 207 bugs** and must not be cited as one. It is
pre-existing house style, and most instances are probably deliberate "return `null`/`[]`
on failure" reads. The ones that matter are only those where **an empty result is
semantically different from an error and the UI cannot tell them apart** â€” which is what
made the three above real. Separating those needs per-call-site judgement, not a regex:
the sweep is cheap, the triage is not.

âš  The sweep script had a real bug before its numbers were trusted â€” line numbers were
computed on comment-**stripped** source, shifting every offset after the first comment.
Fixed by blanking comments length-preservingly (self-test 4/4); the count moved 210 â†’ 209,
which is why ~207 is quoted as heuristic rather than audited. Script in `backend`'s
scratchpad. Owner: unassigned â€” needs a triage decision before anyone starts.

### ðŸ”´ FUP-AFF-1 â€” the authz census is BLIND to write-path doors (2026-08-06, lead)

Recorded as ADR [0079](../decisions/0079-authz-door-blindness-standing-invariant.md) **Amendment 5**.
**Does not block AFF** â€” but AFF's gate record must **not** cite `ARM=census` as coverage for its
affiliation doors; it must cite `302_affiliation_doors.sql`'s mutation-proven keystones, which do
cover them in substance.

Found when `backend` noticed a diff-scoped `ARM=policy` run reporting **0 BLIND over five brand-new
DEFINER doors having swept none of them** â€” the boolean arm printed empty because they return
`uuid`, not `boolean`. The hole is wider than the observation, measured from the live catalog:

- **ARM 3's LIVE domain** is `prosecdef` functions that return `bool` **or** are set-returning +
  `authenticated`-executable, plus all RLS policies. A **scalar/void-returning write-path door is in
  none of those sets** â€” so `ARM=census` reports HOLDS **because the door is invisible, not because
  it is accounted.** That is Amendment 3's vacuity, recurring in a shape its own filter cannot express.
- **ARM 1's write-path sweep exists and is the right harness**, but its domain is **two frozen
  enumerations** â€” a hand-written list of **7** named raise-guards and a **captured snapshot** of 33
  write policies embedded in the script. Nothing added since has ever entered it. ("A remembered-doors
  allowlist is blind in exactly the case that matters" â€” now at the harness level.)
- **Measured blast radius:** filtering by the *property* instead of the return type â€” `prosecdef`,
  `authenticated`-reachable, scalar/void, comment-stripped `prosrc` both naming an identity primitive
  **and** raising `42501`/`HC*` â€” yields **201** functions. **6** are named in any findings report.

âš  **Not a claim that 201 leak.** Most are covered in substance by keystones asserting through them.
The claim is narrower and worse: they carry **no sweep verdict**, and the arm whose whole job is to
detect a missing verdict cannot see that one is missing. Two caveats so the fix doesn't inherit a
false premise: the 201 is a regex *candidate* set, not a classification (`--` comments stripped,
`/* */` not), and the class is **not per-function** â€” AFF's gate lives in an owner-only kernel
(`app.*_impl`, ACL `postgres=X`) while reachability lives in its `authenticated` wrapper, whose body
names no identity primitive, so a per-function domain misses that door **from both ends**. The domain
has to follow the call edge, which is why this is harness work and not a filter tweak.

Scope when scheduled: derive the write-path domain from the catalog by the property (following the
wrapperâ†’kernel call edge), fold it into ARM 3's LIVE set, and give `p0-authz-writepath-audit.sh` a
derived worklist in place of its two frozen enumerations. âš  **Dry-run the detector against a
hand-classified sample before believing it** â€” Amendment 4's harness reported 0 guards in all 45
doors and was completely wrong, and "no write-path door needs a verdict" is exactly as coherent a
false result.

_Closed 2026-08-04, rotated â†’ [follow-ups-archive.md](./follow-ups-archive.md):_
**FUP-P16-1** (14 never-called doors failing the ADR 0079 floor â€” RESOLVED; `ARM=floor` now reports
`INVARIANT HOLDS`, nothing was allowlisted, and writing the positive twins found **3 doors whose
AUTHORIZED path could never succeed**. âš  Keep the mechanic: `pg_stat_user_functions` does not count a
call that raises, so **a deny-only keystone cannot clear the floor** and a permanently-throwing door
reads as *never called* rather than *failing*) Â· **FUP-P16-3** (`copy_version_children` temp-table
concern â€” INVESTIGATED, **not a bug**; âš  confirming a *pattern* is present is not confirming the
*defect* is present).

### ðŸ”´ FUP-PCITV-1 â€” PCI + TV: what QA APPROVED **over**, ranked (2026-08-05)

QA r2 approved with 7 items open. None blocks the merge; **two block a clean deploy story** and are
called out in the Phase Status caveats above. Owner: unassigned unless noted.

| # | Sev | Item |
| - | --- | ---- |
| 1 | â¬› | ~~**`ARM=census` never run**~~ **CLOSED 2026-08-05** â€” the arm landed with the membership-hardening merge and was run against the merged catalog. It found real debt, not nothing: `process_template_versions_{select,staff_admin_write}` carry **no verdict from any sweep**. TV swept and keystoned the six CHILD policies on `process_template_{phases,narratives,outcomes}` (`dcc5a4d`) and not its own PARENT table's two â€” *a new door must inherit every sibling arm*, one level up. Registered as `gate:` debt in `authz-unswept-backlog.txt`. The ghost-check also named all five `validate_template_*` signatures ADR 0096 re-keyed to `p_template_version_id`. |
| 2 | â¬› | ~~**TV backfill never exercised** â€” rehearsal + snapshot blocking before `db push`.~~ **CLOSED (PO, 2026-08-05): the remote is EMPTY**, so the backfill meets 0 rows there exactly as it does locally. Not blocking. See the Phase Status caveat for the mechanism (which recurs) and for the unverified-premise error that produced this row. |
| 3 | â¬› | ~~**Revoke residue**~~ **CLOSED 2026-08-18 â€” swept (first-party) AND accepted in writing (platform), which is exactly the disjunction this item demanded.** `20260928000900` revoked TRUNCATE from anon+authenticated on **63** postgres-owned tables (0 remain); pinned by pgTAP `191` Â§5, property-bounded by OWNERSHIP so a new first-party schema is covered on creation, with a two-direction falsifiability control. â›” The platform half (`storage.*`, `net.*`) **cannot be revoked by us** â€” see the block below. |
| 4 | â¬› | ~~**BUG-RCA-001**~~ **CLOSED 2026-08-05** â€” PO ruled the interview's date is the **earliest session's `scheduled_start`**; fixed, PostgREST-verified, and the ruling pinned by `rca.test.ts` (5 cases, mutation-proven per arm). See the Bug Log. |
| 5 | ðŸŸ¢ | Audit mesh **2 of 7** trigger arms keystoned (`20260906000200`). |
| 6 | ðŸŸ¢ | The `is_commission_admin_of` disjunct in the 6 new tenant-isolation keystones is **unexercised** â€” no org-admin persona exists in the test bootstrap. Adding one lifts several suites at once. |
| 7 | ðŸŸ¢ | `compute_case_phase_result` / `sync_case_phase_on_submit` still force the `in_case_rpc` GUC off (fails **closed**). Â· Resolver error semantics: helpers now log, but still collapse "not found" and "query failed" into one return â€” the discriminated-union refactor was deliberately deferred as too risky post-green. |
| 8 | ðŸŸ¢ | **A FIFTH rebuild-property-loss, inside the migration written to close that class.** `20260907000700` recreated 10 policies on the 5 re-keyed relations **without the `TO authenticated` clause the originals carried** (`20260821000000` wrote `for select to authenticated`; the swap wrote bare `for select`). Platform split is **256 `{authenticated}` vs 11 `{public}` â€” and 10 of the 11 are these** (the 11th, `case_referral_delete_draft_source`, pre-dates the phase). `20260907001200` caught the ACL and `DEFERRABLE` losses and missed this one. **Verified INERT, twice:** `anon` holds **0 table grants on the 5** â€” and **0 anywhere in `public`** â€” so a bare policy still only ever evaluates for roles that either carry `BYPASSRLS` or cannot reach the table. Not a vulnerability; a latent widening if `anon` is ever granted anything. Normalize when one of these policies is next touched. âš  Same standard-consistency point as row 3: this phase refused the "unreachable" argument in `20260906000600`. |

| 9 | â¬› | ~~**`296` suite-number COLLISION between branches.**~~ **CLOSED 2026-08-05** â€” resolved during the merge, not before it: the branch had committed by then, so it came through as a two-file collision on one number. Renumbered to `supabase/tests/298_authz_p0_isolation.sql`, with the Batch-4 runner in `p0b-isolation-mutation-audit.sh` following it. (A third collision was then created and caught in the same session â€” `299_hospital_content_door_noun_rule.sql` was first written as `284_`, which `284_accreditation_hospital_readiness.sql` already held. Check the directory before picking a number.) |
| 10 | ðŸŸ¢ | **PROGRESS.md is 105 KB against the <60 KB target** (CLAUDE.md Â§7 â€” every spawn pays for it). This phase's rotation took it from 111.6 KB, so the trend is right but the gap is not closed. Next rotation should take the `ðŸ“‹ Remaining pre-pilot work` and closed-bug sections. |

> ### â¬› Item 3 (revoke residue) â€” CLOSED 2026-08-18, and the platform half is an ACCEPTANCE, not a sweep
>
> **Swept.** `20260928000900_revoke_truncate_residue.sql` â€” TRUNCATE revoked from `anon` +
> `authenticated` on the **63** postgres-owned tables that still held it (the residue
> `20260711000100` left behind when it flipped the *default* but did not sweep existing tables).
> Pinned by pgTAP **`191` Â§5**, all 194 files / 6406 assertions green.
>
> â­ **Why this grant was worth more than its ðŸŸ¡.** The item graded it on RLS bypass. The bigger
> consequence went unnamed: **TRUNCATE fires no DELETE trigger**, so it also walks past every
> statement-level `AFTER DELETE` guard â€” including `storage.protect_delete`. Measured 2026-08-18:
> a bare `DELETE` on `storage.objects` raises `42501`; a `TRUNCATE` succeeds, and the bytes stay on
> disk as orphans. Combined with [the Cloud orphan probe](cloud-orphan-probe-2026-08-18.md) of the
> same day, the blast radius is *"every byte in every bucket orphaned, and then unobservable on
> Cloud forever"* â€” not *"rows lost, restorable"*.
>
> â›” **ACCEPTED IN WRITING â€” the platform residue is not ours to revoke.** `storage.objects`,
> `storage.buckets`, `storage.buckets_analytics` (owner `supabase_storage_admin`) and the `net.*`
> tables (owner `supabase_admin`) grant TRUNCATE to `anon` and `authenticated`. **We cannot change
> that**, and the way it fails is the trap:
>
> | statement, run as `postgres` on Cloud | result |
> | --- | --- |
> | `revoke truncate on public.<table> from authenticated` | privilege `t` â†’ **`f`** |
> | `revoke truncate on storage.objects from authenticated` | **no error**, privilege `t` â†’ **`t`** |
>
> Postgres does not error when the caller is not entitled to revoke â€” it warns and no-ops. â­ *A
> migration that swept "everywhere it could" would have gone green on `db push` having hardened
> nothing on the half that mattered, and been recorded as complete.* The first probe I ran asked
> only whether the statement errored and answered **"REVOKE WOULD SUCCEED"** for `storage.objects`;
> only re-measuring the **privilege itself** exposed the no-op. Same family as
> [[guards-that-read-right-but-fail-open]] â€” and the reason `20260928000900` re-derives the set from
> the catalog after its loop instead of counting statements executed.
>
> The scope is therefore the deterministic first-party one. A local superuser *can* revoke on
> `storage`, so an opportunistic sweep would also have made local and Cloud diverge â€” green locally,
> unchanged in production.
>
> **Residual risk, stated plainly:** not reachable today. PostgREST exposes no TRUNCATE verb, and
> `anon` / `authenticated` / `service_role` are all **NOLOGIN**, so an API key is not a database
> credential. It needs a direct connection as a client role, which nothing issues. `service_role`
> keeps TRUNCATE deliberately â€” it is the trusted server-only role that already bypasses RLS, and
> anything holding that key can delete everything through the API anyway.

**Landed, no longer a recommendation:** the PostgREST **embed sweep** built during this phase now
lives in the repo at **`scripts/extract-embeds.mjs`** + **`scripts/probe-embeds.mjs`** (moved out of
a session scratchpad that was about to be deleted â€” the earlier revision of this line pointed at a
path that would not have existed, which reads as "saved" when it is not). It found BUG-TV-001 *and*
BUG-RCA-001 mechanically across 284+ call sites. It still cannot join `npm run lint`, because it
requires a live local Supabase and `probe-embeds.mjs` refuses any non-local URL by design.

â¬› **Entry point DONE 2026-08-11: `npm run sweep:embeds`** (extract â†’ probe, both against `.`, via a
gitignored `.embed-sweep/` scratch dir; `extract-embeds.mjs` now creates that dir rather than
requiring the caller to). Run against the live local stack to confirm it works end-to-end.

**Its baseline is a NAMED list, not a count** â€” deliberately, per the FUP-E2E-1 lesson that a
count-shaped baseline is a hiding place:
- **311** select sites resolved, **0** unresolved Â· **248** distinct (relation, select) pairs probed.
- **246 Ã— `42501`** = genuine PASS. The sweep probes with the **anon** key, which holds zero table
  grants, and its own built-in CONTROLS (C1/C2/C3) prove each run that 42501 does **not** mask embed
  or column errors â€” a good tool: it re-earns that claim rather than asserting it.
- **2 Ã— `PGRST205`**, both `get_meeting_agenda_items` (`minutes-jobs/context.ts:119`,
  `minutes-jobs/queries.ts:193`) â€” **extractor false positives, NOT defects.** Both sites are
  `.rpc(name, args).select(...)` chains; the AST extractor reads the RPC name as a relation and
  probes `GET /rest/v1/<rpc>`, which is not a table. âš  Whoever next touches the sweep: this is the
  known baseline â€” do not chase it, and do not "fix" it by suppressing PGRST205, which is the code
  that would report a genuinely missing relation.

The generalisation that justifies keeping it: **ADR 0096 A1.5's grep sweep could not have caught
BUG-TV-001, because that site names no dropped column â€” it names a relation that is no longer
*reachable*. After a column drop, sweep the embeds the column ENABLED, not just the column.**

âš  **Deferred by decision, not oversight** (ADR 0095 Â§3): `blocks[]` â†’ join table; the
`case_phase_offered_results` rename.

### â¬› Resolved â€” rotated 2026-08-06 â†’ [follow-ups-archive.md](./follow-ups-archive.md)

FUP-MEM-1 (indicator doors: not a defect) Â· FUP-MEM-2 (`assignOrgAdmin` door) Â· FUP-AUTHZ-2
(15 BLIND gates) Â· FUP-BULK-1 (suspended members) Â· FUP-MEM-3/3b (DT referral plane + inbox) Â·
FUP-A11Y-1 (`useFieldIds` â†’ `useId()`) Â· FUP-AUTHZ-3 (45 row-returning DEFINER doors swept) Â·
FUP-AUTHZ-4 (BLIND allowlist pruned). Full resolution bodies in the archive.

### â¬› Resolved â€” rotated 2026-08-11 (the FUP quick batch) â†’ [follow-ups-archive.md](./follow-ups-archive.md)

FUP-QO-9 (PGRST002 + zero-summary-crash classification; preflight now WAITS for the schema
cache) Â· FUP-GATE-RESET-FLAKE (reset stderr captured + retried once, loudly; `renderer_ok`
names a dead `gotenberg-pdf`) Â· FUP-PDF-2 (allowlist narrowed to the `HC*` class) Â· FUP-P16-4
(12 `+ "s"` sites â†’ `plural()`, helper moved to `src/lib/text.ts`) Â· FUP-P16-2 (both
accreditation reads through `queries/`) Â· FUP-QOB-2 (fully discharged â€” â‘¤ closed when ACT
shipped). Merged `97acfd6`. Full bodies in the archive.

**Rotated in the same pass, but NOT part of the batch:** FUP-QOB-1 (the `270` Â§J J1c catalog
pin, RATIFIED by the PO 2026-08-09) â€” a separate, earlier closure that had simply never been
rotated out of either file.

### â¬› Resolved â€” rotated 2026-08-12 (backend FUP wave) â†’ [follow-ups-archive.md](./follow-ups-archive.md)

FUP-PDF-3 (both doors narrowed to the granted-column composite `printed_document_public` â€”
ADR 0111, migration `20260921000100`, pgTAP `323` red-first + DROP+CREATE property controls) Â·
FUP-F2-BUCKETS (`meeting-attachments` retired â€” `20260921000300`, policies + bucket behind a
non-empty REFUSE guard; pgTAP `325` pins the absence from `pg_policies`; `case-documents`
retirement stays with the open `getReferralDocumentUrl` item; âš  remote object count could NOT
be measured â€” background-agent remote SQL is auto-denied â€” the migration guard turns a
data-bearing remote `db push` into a loud refusal instead). Full resolution bodies in the
archive. Same wave, tracked in the RDR phase row rather than here: the `case_narrative_types`
reorder-after-archive `23505` fixed in `20260921000200` + pgTAP `324`.

âš  **The one thing worth carrying forward rather than archiving:** three of those six were
measurably WRONG about the code, each phrased as an instruction someone would have executed
(FUP-PDF-4's prescribed fix already shipped; FUP-QO-9(b)'s "false green" was caught by three
existing checks; FUP-PDF-2's `23514` is raised by no door at all). **A prescription in a
follow-up is a claim about the code and ages like one â€” re-measure before implementing.**

### ðŸ”´ FUP-FF5-1 â€” patient-lane sublabel is degenerate on the READ path (**PO DEFERRED 2026-07-28**)

The picker shows `Paciente / Paciente afetado`; the **durable submitted record** and wizard resume
show `Paciente / Paciente`. `buildReferenceAnswers`' input row carries no case data, so it resolves
the participant **type** while `reference_candidates` and `app.references_by_item` resolve the case
**role**. Every patient's `display_name` is the surrogate `'Paciente'` by construction, so **two
patient references in one case are indistinguishable in the permanent record**.

QA r1: **MAJOR, but ship** â€” every disambiguator that would work is PHI and would reverse ADR 0091
ruling 1 (which is why Rule 12 stays at three modules). The only mitigation that does not undo the
ruling is a **workflow rule**: require distinct `case_participant_roles` per patient per case.
Code fix (giving `buildReferenceAnswers` case scope) is a three-level PostgREST embed with PGRST201
exposure â€” both engineers independently judged it not gate-time work.

âš  **The PO deferred the decision, not the risk.** The patient lane is live behind `entity_refs` the
moment FF-5 deploys, and ruling 2 makes that lane work **only** on case-bound forms â€” so this is
100% of real patient-lane usage, unexercised rather than unlikely. **Resolve before the lane is
offered to a real committee.**

### â–¶ FUP-E2E-1 â€” RE-BASELINE `e2e:prod` (cross-phase, PO-ruled 2026-07-27) â€” **blocks nothing**

Replace the *"~18â€“27 expected failures"* folklore with a **named list**: run the suite on a clean
stack and classify **every** failure as `infra` / `deterministic-real` / `genuinely-flaky`, each with
an owner.

*Why:* **a count-shaped baseline is a hiding place, not a known-issues list.** FF-2's gate ran
762 passed / 55 failed; splitting by connection errors showed **52 were infra** (the
`supabase_vector` crash-loop class) and **3 were real and deterministic** â€” one of which
(**BUG-FF1-008**) had been red on every run since FF-1 and written off as baseline noise.

Make the triage step itself documented rather than reinvented per lead: **conn errors `> 0` = infra Â·
`= 0` = real.** Also establish why batches terminate early â€” two reported "did not run" (11 and 39),
so raw totals misstate coverage in **both** directions.

### â–¶ FUP-FF2-3 â€” whitespace-only observation, per-instance (DEFERRED by the lead 2026-07-27)

After BUG-FF1-007 fixed the `<> ''''` quoting slip, the per-instance filters compare `<> ''` while the
top-level one uses `btrim(...) <> ''` â€” so a **whitespace-only** observation is filtered at top level
but not per instance.

**Deliberately deferred, on scope discipline rather than merit:** it is a *different* defect from the
one ruled in, it is cosmetic (a blank observation block renders inside a group instance), and it
would have been the third out-of-phase fix of a wave already at its gate. **`tester` independently
confirmed the deferral is safe** â€” both canonical writers normalise with `nullif(btrim(...), '')`, so
the whitespace case is reachable only for **legacy rows**, the same population BUG-FF1-007 defends.

### â–¶ FUP-FF1-2 â€” FF-1 QA non-blocking items (review r2: 4 MINOR / 6 INFO) â€” **7 still open**

All ruled non-blocking by `qa`. Detail rotated 2026-07-28 â†’
[ff-1-repeating-groups.md](./ff-1-repeating-groups.md); canonical analysis â†’
[phase-FF-1-review.md](../reviews/phase-FF-1-review.md) (the playbook's rule: never restate a
review's rationale here).

Open: **MINOR-1** `completeness_authorities_agree` is one-directional in pgTAP Â· **MINOR-2** the
suite header documents a keystone that does not exist Â· **MINOR-3** MUTATION F3 names the wrong
mutation Â· **MINOR-4** stale-comment asymmetry in `supersede_response` Â· **INFO-2** no coherence
guard on the direct-DML path Â· **INFO-3** Â· **INFO-4** the parity vectors have no drift detector.
Closed: INFO-1 (superseded by MINOR-4) Â· INFO-5 (discharged at Record) Â· INFO-6 (carried forward as
a binding FF-2/FF-5 requirement â€” **both phases have since discharged it**).

> âš  MINOR-2 and MINOR-3 are the same family FF-5 hit eight more times: a comment or a test name
> asserting something that is not true. Cheap to fix, invisible to every gate.
### â–¶ FUP-FF1-1 â€” coherent fill-path hardening (post-pilot; ADR 0087 ruling 5)

- [ ] Revisit **DEFINER + per-mutation audit for the whole fill path** â€” `answers`,
  `answer_selected_options`, `response_group_instances` **together**, as one change. Today all three
  are direct-DML-under-RLS with no per-row audit (Rule 11 is satisfied for filling at the *response*
  level via `audit_responses_trg`); FF-1 deliberately matched that convention rather than hardening
  one table piecemeal. Decide the target posture for the set, not for a member of it.

### â–¶ AUTHZ Gate-2 deferred (PO-noted 2026-07-17, non-blocking â€” Gate 2 shipped)

- [ ] **MINOR-1 â€” reserved-session door returns the respondent's own `case_id`.** `get_reserved_session_items`
  now masks times + process number on `NOT is_case_respondent`, but a respondent still receives their **own**
  `case_id` (no cross-case / cross-patient re-identification). Whether the respondent should see even their own
  linkage on the reserved door is the unresolved **A7-vs-A26** call â€” **fold the reconciliation at pilot close**.
  Owned by `backend`.

### â–¶ ETHÂ·E1 â†’ ETHÂ·E2 inheritance (PO-directed 2026-07-14: "log for E2, don't act now")

Three **known gaps** + two QA Minors, all the same class â€” *pre-existing scope decisions E1 does not own*, made
**visible** by E1's stricter access model. QA and `backend` independently judged each out of E1's scope; the PO
agreed and routed all of them to **ETHÂ·E2**. **Full reasoning, measurements and the QA quotes â†’
[eth-e1-access-spine.md Â§4](./eth-e1-access-spine.md)** (detail rotated there 2026-08-04; titles +
owners kept live here).

- [ ] **GAP-E1-1 â€” `action_items` `assignees_only` arm never consults `can_read_case`** (a respondent who is also
  an `org_admin` could see an assignees-only item on their own case). `backend` at E2.
- [ ] **GAP-E1-2 â€” `patient_safety_event` has no case arm**; residual is **link-existence inference only** (the
  event carries its own incident narrative, not case deliberation). Gating it would rewrite the NSP/PHI-module-1
  model E1 doesn't own. `backend` at E2.
- [ ] **GAP-E1-3 â€” privileged-doc ceiling has no coordinator arm** (UX, not security: the coordinator who uploads
  a privileged doc must self-grant clearance to reopen it â€” correct per ADR 0072 D5). `frontend` at E2/E3.
- [ ] **MINOR-A â€” the generic leak sweep can pass VACUOUSLY** (10/14 covered, 4/14 vacuous). Fix: report zero-row
  tables as **uncovered** rather than silently passing them. `backend` at E2.
- [ ] **MINOR-B â€” `action_items` passes the sweep by FIXTURE ACCIDENT, not documented exclusion** â€” the moment
  someone seeds an `assignees_only` item it fails and reads as a regression. **Make it a decision, not an
  accident.** `backend` at E2.
- [ ] **participant-roles M2M (ADR 0072 D7Â·4) deferred to E2** â€” no Â§4 gate criterion covers it and its shape
  depends on E2's decision model; QA verified nothing half-built was left behind. `backend`.


## Bodies moved here 2026-08-14 (the PROGRESS.md size rotation) â€” items whose ONLY record was the live line

> âš  **Found during the rotation, and it changes what the rotation was allowed to do:** these OPEN
> follow-ups had **no body in this file at all**, and `FUP-ACT-DISPOSE-UI`'s live line even pointed
> *here* for its "full mechanism". PROGRESS.md is supposed to carry a one-line index only
> (lead-playbook Â§5) â€” so compressing those lines to `severity Â· id Â· title Â· owner` would have
> **destroyed the item**, not rotated it. Bodies below are the live text, verbatim.


### ðŸŸ¡ FUP-E2E-REPEAT-FLAKY â€” â­• **DOWN TO TWO members 2026-08-17, and the "one root cause" hypothesis is now EVIDENCED, not merely suspected** (owner: lead + tester)

- ðŸŸ¡ **FUP-E2E-REPEAT-FLAKY** â€” `act-role-assumption:157` + `phase2-auth-shell:268` flaked in **BOTH** DM3 `e2e:prod` runs â‡’ a pattern, not noise; outside the DM3 diff. **Both flaked again in DM5Â·S3's gate (3rd + 4th occurrence) â€” the pattern is now established, not suspected.** Both flaked again at DM5Â·S6's green gate. ~~Third member added 2026-08-14: `dm5-nsp-evidence.spec.ts:347` EVID-KBD-1~~ â€” **REMOVED 2026-08-17: root-caused and fixed (BUG-DM5-S6-EVID-KBD-1), so it was never a flake.** All were focus/navigation-timing shaped, matching the standing *"`.focus()` is not auto-waiting â€” it races RSC streaming"* class, which suggested **one** root cause rather than three flaky tests â€” lead/tester

> **â­ 2026-08-17 â€” the hypothesis in the last sentence above got its first real test, and it held.**
> EVID-KBD-1 was pursued as a *defect* rather than accepted as a flake, and it had a precise
> mechanism: a readiness helper treated the **ancestor layout's `<main>`** as proof of rendered
> content, but that `<main>` persists across the `loading.tsx` â†’ `page.tsx` Suspense swap, so a
> fixed-budget `focusByTabbing` could start counting Tab presses against a near-inert skeleton.
> Load-dependent, hence "flaky"-looking. It is exactly the predicted family â€” **one layer above where
> the class was being looked for** (the check that decides *when it is safe to start*, not the
> `.focus()` call itself).
>
> **What this changes for the surviving two:** they are no longer "two tests that flake". There is now
> a **named, reproducible mechanism** to test them against, and a working method: reproduce at
> **batch composition** (they pass in isolation â€” the isolated run is the trap), run at `RETRIES=0`,
> and fix the *precondition* rather than the budget.
> â­ **Concrete unverified lead, from the tester, worth writing down before it is lost:**
> `phase2-auth-shell.spec.ts` calls a **bare `.focus()` shortly after a navigation** â€” the same
> anti-pattern, in one of the two survivors. **Not investigated and not confirmed** (it is unknown
> whether that route even has a `loading.tsx` boundary). *A lead, not a finding.*
> âš  **Do not close this FUP on EVID-KBD-1's fix** â€” one member's root cause is evidence about the
> class, not a closure of the other two.

### ðŸŸ¡ FUP-GATE-PDFP1-FLAKE â€” `pdf-printing.spec.ts:38` pre-mint empty-state flake, mechanism UNPROVEN (owner: lead + tester)

- ðŸŸ¡ **FUP-GATE-PDFP1-FLAKE** â€” `e2e/pdf-printing.spec.ts:38` failed its **pre-mint** empty-state assertion once in the DM2 re-gate's `e2e:prod` run 1, then passed **three** independent ways at `RETRIES=0` (isolation 9/9 Â· identical-batch re-run 60/61 Â· full-suite run 2, batch 8 60/0). **Not phase-attributable** â€” the printing module is outside the DM2 diff and the expected string is intact in source (QA r2). âš  **The mechanism is UNPROVEN**: no infra signal (`server_dead=0`, no conn errors), unlike DM1's proven `server_dead` flake. QA narrowed it further â€” the gate resets the DB **before each batch** and batch 8 ran **1 worker**, and the failing test is the *first* in its file (pool index 0), which near-refutes the shared-fixture-pool hypothesis and leaves an ordinary `toBeVisible` timing flake. âš  **Both evidence artifacts are gone**: `test-results/` AND `/tmp/e2e-prod-gate/batch-8.log` were overwritten by the re-runs. **Discharge = catch it once with artifacts preserved, or pin the timing.** Related and arguably the real fix: `scripts/e2e-prod-gate.sh` resolves "re-run to see if it recurs" vs "preserve the evidence" the **wrong way** â€” a failing batch's log and `test-results/` should be archived before any re-run (QA r2 carry-forward) â€” lead/tester

> â­ **2026-08-18 â€” a named candidate this item can now EXCLUDE, which is progress on "UNPROVEN" without discharging it.** **BUG-DM5-S3-ENV-FIXTURE-POOL-1** (closed + archived) proved the shared-pool mechanism *in a manual, un-reset context*: 9 pre-existing `printed_documents` rows carrying this spec's own revoke text, against a helper that claims responses by POSITION. â›” **That is NOT this item.** QA's narrowing here still holds â€” the gate resets before each batch and ran 1 worker, so pool contamination cannot be the gate failure's mechanism. What changes is that the candidate is now *named and measured* rather than hand-waved, so a future investigator can exclude it by citation instead of re-deriving it. The dev-loop half is filed separately as **FUP-E2E-PRINT-POOL-DEVLOOP**. âš  **Do not close either item on the other's evidence** â€” same assertion, two different contexts, one proven mechanism and one unproven.

### ðŸŸ¡ FUP-E2E-PRINT-POOL-DEVLOOP â€” the print spec's fixture pool is claimed by POSITION, so a second run without a reset reds a human but never CI (owner: tester)

- ðŸŸ¡ **FUP-E2E-PRINT-POOL-DEVLOOP** â€” `submittedResponseIds` ([e2e/helpers/pdf-printing.ts:133](../../e2e/helpers/pdf-printing.ts)) claims responses **by position** (`responses?â€¦&order=id.asc&limit=N`) with **no filter for "has no print yet"**. Run `npx playwright test e2e/pdf-printing.spec.ts` twice against the same DB generation and the second run reds at `:47` â€” *"Panel starts empty for this fresh fixture"* â€” because index 0 was minted and revoked by the first. **Mechanism proven**, not suspected: BUG-DM5-S3-ENV-FIXTURE-POOL-1 measured 9 pre-existing `printed_documents` rows carrying this spec's own revoke sentence verbatim, against **zero** `printed_documents` inserts in `seed.sql` â€” tester

> **Why no gate will ever catch this.** `scripts/e2e-prod-gate.sh:50` sets `RESET="${RESET:-1}"` and runs
> `supabase db reset --local` **before every batch**, and the batch runs `--workers=1`. So the failure is
> invisible to CI **by construction** and lands only on a human in the quick dev loop â€” which is exactly
> how it was first filed, as an apparent product defect during an S3 gate sweep.
>
> â›” **NOT `FUP-GATE-PDFP1-FLAKE`, and neither closes the other.** That item is the *same assertion*
> failing **inside a gate**, where the reset-per-batch and single-worker facts are precisely what
> near-refutes the pool hypothesis; its mechanism is still UNPROVEN. Same line, two contexts, two
> mechanisms â€” one measured, one not.
>
> âš  **THE OBVIOUS FIX IS A TRAP â€” do not "just filter the pool".** Making `submittedResponseIds` skip
> already-printed responses **breaks the sibling tests**: they claim indices 1â€“5 and depend on the
> positionâ†’response mapping being stable across calls, so once the first test mints on index 0 a
> filtering helper shifts every later claim by one. Shapes that work: a **dedicated fixture** for `:38`
> alone, leaving the positional helper untouched for the rest; or an **identity-scoped** cleanup that
> deletes `printed_documents` for exactly the claimed response id â€” *by identity, never by position*
> (the standing "a positional cleanup eats seed rows" rule).
>
> **Discharge criterion â€” the fix's own test, not a green suite.** Two consecutive
> `npx playwright test e2e/pdf-printing.spec.ts` runs **with no reset between them**, both green. The
> *second* run is the assertion; a single green run proves nothing, because a single run has always
> passed. And the sibling tests must be green in **both** runs â€” that is the regression risk the
> filtering fix would have shipped.

### ðŸŸ¡ FUP-329-ABORT-SHAPE â€” a `329` keystone whose failure ABORTS the file, dropping 41 assertions (owner: backend)

- ðŸŸ¡ **FUP-329-ABORT-SHAPE** â€” a `329` keystone whose failure **aborts the file** (drops 41 assertions); it is what makes a mutation sweep over these gates unclassifiable â€” backend

### ðŸŸ¡ FUP-ACT-CAPA-ASSIGN â€” NSP operators see ~only themselves in the CAPA assignee picker (owner: backend)

- ðŸŸ¡ **FUP-ACT-CAPA-ASSIGN** â€” NSP operators see ~only themselves in the CAPA assignee picker (`profiles` RLS has no operator arm; the hatless union used to mask it) â€” backend

### ðŸ”´ FUP-ETH-ROLES-1 â€” no production bootstrap of `case_participant_roles` (owner: product + backend)

- ðŸ”´ **FUP-ETH-ROLES-1** â€” **no production bootstrap of `case_participant_roles`.** The ethics role bundle lives ONLY in `supabase/seed.sql`; the sole role-insert in any migration is the lazy `affected_patient` mint inside the patient path. A real org therefore starts with **zero** roles, and since `case_participants.role_id` is NOT NULL, EVERY participant type is a dead end until an org admin authors the vocabulary in T5 â€” the three role-less external types ratified on 2026-08-11 are one visible instance, not the shape. Decide before the pilot onboards a second org: bootstrap-on-org-create vs. a first-run prompt vs. accept-and-document (found 2026-08-11 while ratifying the PO items; the add-dialog empty state now at least names the remedy) â€” product + backend

### â¬› FUP-DISPOSE-DIALOG-OVERCLAIM â€” âœ… **CLOSED 2026-08-20 (DSR Slice 4 item 3)** â€” the shipped referral-dispose copy is the exact "tudo apagado" over-claim ADR 0056 (b) forbade â€” and it offers an Art. 18 reason counsel may have closed (owner: frontend; vehicle: DSR plan Slice 4)

> ## âœ… CLOSED 2026-08-20 â€” both over-claiming strings REPLACED, not supplemented
>
> `src/components/referrals/referral-dispose-dialog.tsx` now renders the shared
> `DSR_RESIDUE_NOTICE` verbatim (no fifth line, no paraphrase â€” the language is decided
> once, centrally), and the two over-claims are gone rather than qualified. Eight lint gates
> + tsc green.
>
> â›” **The verification scope is REPO-WIDE over `src/`, not file-local (corrected at QA r1).**
> The closing evidence first recorded a grep over the one rewritten file â€” but the rule the
> code comments state is repo-wide, so closure passed under one stated scope and would have
> failed under the other. That mattered â€” the file-scoped grep was green while **two** more
> copies of the same defect pair were live in `dsr-task-inbox.tsx` and, worst of all, in the
> docblock of `DSR_RESIDUE_NOTICE` itself, where it is the first thing anyone reads before
> reusing the constant. All now carry the history in English with an explicit note that the
> pt-BR strings are never quoted.
>
> â›” **CORRECTED AGAIN (QA r2). This paragraph previously asserted that the widened grep
> "exits **1**". IT EXITED 0 WHEN THAT SENTENCE WAS WRITTEN** â€” and the file matching it was
> `referral-dispose-dialog.test.tsx`, *the very file the next paragraph of this record
> introduces as the closure's evidence*. The record certified its own falsifier.
>
> â­â­ **This is the FOURTH recurrence in a single day, and the fourth author had personally
> fixed the previous three.** That is the finding, not the four instances: ***the prohibition
> is not holdable by discipline.*** Documenting a defect by quoting it is the natural way to
> write the comment, so the rule asks every future author to suppress the obvious phrasing
> forever, with nothing able to contradict them. A grep-verified follow-up whose own evidence
> is prose is self-defeating by construction. Raised to the PO as a **gate** proposal â€”
> âš  per CLAUDE.md Â§8 every existing gate was added after exactly this pattern: a class that
> shipped a live defect and kept recurring under discipline alone.
>
> âœ… **Executable coverage now exists** â€” `referral-dispose-dialog.test.tsx`, 15 tests,
> every one **mutation-proven** to fail (11 mutations, all red under an anchor-uniqueness
> guard). This closes a real gap: **no E2E reaches this dialog at all** (AC-7 POSTs the RPC
> directly; `FUP-ACT-DISPOSE-UI`'s referral lane is undischarged), which is the likeliest
> reason the over-claim survived unnoticed from the day it shipped.
> The Art.18-reason half was already narrowed on 2026-08-19 by counsel's Q14 return (ADR
> 0035 Amdt 1) and the dialog now carries a `subject_request`-only note that such a
> disposal presupposes an adjudicated DSR (ADR 0130).
>
> âš  **Two facts worth carrying forward.**
> **(a) â­• INSTRUMENT SWAPPED 2026-08-20 â€” the closure evidence is the rendered-output
> assertion, and the grep is RETIRED for this item.** The original instrument was a grep
> over `src/` for the shipped pt-BR literal, which made the fix able to defeat its own
> check: a docblock quoting the removed strings as "do not reintroduce" hits **forever**,
> on a comment rather than on live copy, and reads as an unfixed defect. That happened
> four times in one day â€” `FUP-GREP-VERIFIED-FOLLOWUP-IS-SELF-DEFEATING` â€” and the grep's
> measured record is **0 true positives / 4 false positives**: every string it ever
> matched was prose *about* the defect. The one real over-claim was found by re-reading
> the component, not by the grep.
> The instrument is now **claim 2 of
> `referral-dispose-dialog.test.tsx` (**REMOVED 2026-08-21** with its component; the shared over-claim property survives in [`dsr-disposal-overclaim.test.tsx`](../../src/components/dsr/dsr-disposal-overclaim.test.tsx), and the residue-CLASS pin was RELOCATED there rather than deleted)**
> â€” `TOTALITY_QUANTIFIER` matched against **rendered DOM text**, and exactly co-scoped with
> this item (which is about the *referral* dialog's copy): it keys on the quantifier
> **family**, so a paraphrase one word off still reds where the literal grep would have
> passed it; and comments are **not present in rendered output at all**, so the
> false-positive class is structurally impossible rather than merely discouraged.
>
> â›” **CORRECTED 2026-08-20 (later the same day). This paragraph said "strictly stronger in
> both directions" and that was FALSE AS WRITTEN â€” an over-claim, in the note that exists to
> record an over-claim.** The assertion read `dialog.textContent`, which concatenates sibling
> text with no separator, so a ``-anchored pattern is blind at every element edge; the grep
> it replaced read SOURCE, where the string is contiguous, and had no such hole. The swap was
> stronger on the axis being discussed (paraphrase, and false positives on prose) and
> **weaker on one nobody had looked at**. Closed by `renderedText()` (join text NODES with a
> space) under `FUP-OVERCLAIM-PROPERTY-ONE-SURFACE-ONLY`, found only by mutating the
> instrument â€” so the claim is true now, and was not on the day it was written.
> â­ *"Strictly stronger" is a claim over ALL axes, and it is almost never measured over
> all of them.*
> â›” **Do not re-run the grep to re-verify this item** â€” a hit means a comment. QA's r2
> record ([review](../reviews/dsr-slice-4-review.md), "the verification instrument â€¦ **is**
> this grep") predates this swap and is left as written; it is a record, not an instruction.
> â­ **The prohibition dissolves with the instrument.** *"Nothing in that file, comments
> included, may ever contain those strings"* was downstream of the grep and had no other
> ground. With the grep retired, quoting the defect in a comment is harmless â€” and keeping
> an unenforceable standing rule after removing its only enforcer is precisely what ADR
> 0127 refuses to admit. The fifth recurrence the PO's record-only ruling expected is now
> a non-event rather than a suppressed instinct.
> **(b) Left deliberately, flagged not fixed:** the confirm-field helper ("exclusÃ£o
> **definitiva**") and the destructive button ("Apagar **definitivamente**"). These assert
> *finality*, not the *completeness* ADR 0056 (b) forbids, `DSR_RESIDUE_NOTICE` now
> qualifies them two blocks above in the same dialog, and relabelling the button
> re-scopes any future E2E locator. A deliberate decision, not a drive-by â€” but if the
> PO wants strict alignment with the PITR line, that is the remaining string pair.

Filed 2026-08-19 (lead) â€” found by the disposal-touching-ADR sweep as an ADR 0056 Consequence that
was logged there and never entered this register; then verified against the shipped component.

**The defect, verbatim from the tree.** ADR 0056 Consequence (b) required the disposal-confirmation
copy to reflect the **narrowed claim** â€” *"no 'tudo apagado' over-claim; it should say DB PHI is
erased and attachments are retained encrypted under retention."*
`src/components/referrals/referral-dispose-dialog.tsx` ships: *"Remove **permanentemente** a
identificaÃ§Ã£o do paciente e **todos os campos com dados sensÃ­veis** â€¦ Esta aÃ§Ã£o Ã© irreversÃ­vel"* and
*"apaga **permanentemente** â€¦ NÃ£o Ã© possÃ­vel desfazer"* â€” no mention of retained bytes, PITR, or
distributed copies. This is pt-BR compliance copy shown to the operator at the moment they discharge
a legal obligation, asserting more than the mechanism delivers (ADR 0056 Â§4 narrowed the claim
precisely because Storage blobs survive).

**Aggravated 2026-08-19, then NARROWED the same day:** the dialog offers *"SolicitaÃ§Ã£o do titular
(LGPD Art. 18)"* as a selectable reason, which was contingently invalid while counsel's blanket
override stood â€” but the Q14 return (ADR
[0035](../decisions/0035-lgpd-anvisa-regulatory-posture.md) **Amdt 1**, resolved) rules removal
requests **case-by-case with legal consultation**, so the lane is live and the reason option is
valid. The over-claim is the whole remaining defect. âš  Slice 4's rewrite should still note that a
`subject_request` disposal presupposes an adjudicated DSR (ADR 0130) once that workflow exists.

**Fix (decided, Q12a):** rewrite with the shared fixed residue-language constant â€”
[dsr-workflow-plan.md](../plans/dsr-workflow-plan.md) **Slice 4**, which also owes the same copy to
every disposal surface the DSR inbox adds. Not a one-line patch: the residue language is decided
once in the plan, never per-dialog.

### ðŸŸ  FUP-CORRECTION-CORRIDOR-COVERAGE-UNMEASURED â€” âœ… **ALL SEVEN LANES MEASURED 2026-08-20.** One lane is fully covered, six have a permanently-frozen state, and the meeting gate bound generalises to only two of six â€” while the *erasure* fallback turns out to be BROKEN on two lanes (owner: backend + PO; filed 2026-08-20 when the PO asked whether minutes-adjustment mechanisms already existed)

Filed 2026-08-20 (lead). ADR
[0131](../decisions/0131-phi-erasure-reach-bounded-to-designated-fields.md) **Amendment 2**
promotes the reopen corridor from "a documented procedure" to **the platform's corrective
control** for PHI that reaches free text despite training. A control that load-bearing needs
its coverage known, and it was known for exactly one lane.

**MEASURED 2026-08-20 (lead)** â€” live catalog (`pg_proc` bodies, `pg_trigger`, the status
CHECKs) **plus an executed differential**: **59 probes** â€” 33 state/transition + 21 gate, and a
**5-probe corrective re-run**. Every probe matched its declared expectation, including **7
positive controls ALLOWED** and a **THAW control** (post-reopen child write succeeds) proving
the instrument can distinguish. âš  **The corrective run is why the count is 59 and not 54:** two
of the original 33 came back BLOCKED *as expected but for the wrong reason* â€” `42501` on a
persona scoped to the wrong commission, i.e. a **gate** refusal masquerading as the **state**
refusal being measured. Re-run against correctly-scoped rows (plus a sanity probe proving the
persona clears the gate, refused `HC033` on state) they returned the intended verdict. A
matching expectation is not a valid measurement. Fixtures were driven through the lanes' own guarded transitions â€” never a
trigger bypass â€” each with a post-condition assert so a silent no-op could not masquerade as
a built state. Every battery ran inside a rolled-back transaction; the pre-state was
re-verified row by row afterwards (all statuses identical, 0 disposal marks, 0 added rows).
â›” **The catalog read alone would have been wrong** â€” see (c).

#### (a) Reachability â€” locked states vs states the corridor reverses

â­ Read from the **transition graph** in each lane's `guard_*_status` matrix, not from the
door's own state check: every â›” state below has **no outgoing edge at all**, so it is
structurally terminal rather than merely un-reopened.

| lane | free text LOCKED in | reopen door reverses | â›” permanently frozen |
| --- | --- | --- | --- |
| meeting | `in_signature`, `signed`, `distributed`, `cancelled` | `in_signature`, `signed` | **`distributed`, `cancelled`** |
| case | `completed`, `cancelled` | `completed` | **`cancelled`** |
| referral | every state â‰  `draft` | `resolved` â†’ `in_review` â€” **still â‰  `draft`** | â›” **every non-draft state** |
| rca | `completed` | `completed` | **none** âœ… |
| capa_plan | `completed`, `cancelled` | `completed` | **`cancelled`** |
| interview | `completed`, `cancelled` | `completed` | **`cancelled`** |
| triage / event | `triaged`, `closed`, `cancelled` | `triaged` | **`closed`, `cancelled`** |

â›” **The referral lane's corridor does not do the job at all.** `case_referral.subject` /
`description_md` / `decline_note` are writable **only in `draft`** â€” `app.assert_referral_draft_writable`
gates the one door that writes them (`update_referral_draft`). `reopen_referral` lands on
`in_review`, which is not `draft`; probed directly, the post-reopen UPDATE still raises
`HC070`. What reopening *does* restore is the **reply** (`conclude_referral` requires
`in_review` and UPSERTs `referral_reply.result_md`) â€” so the **target's** text is correctable
and the **source's** never is, from the moment it leaves draft.

âš  `reopen_capa_plan` **NULLs `lessons_learned_md`** rather than unlocking it. For that one
column the corridor is an erasure, not a correction â€” fine for PHI removal, but "reopen â†’
edit â†’ re-sign" is not what happens.

#### (b) Gate relation â€” reopen vs the lane's erasure door

| lane | reopen gate | erasure door Â· gate | relation |
| --- | --- | --- | --- |
| meeting | `is_staff_admin_of` | `dispose_meeting_minutes` Â· staff_admin **OR** tenancy_admin | **NARROWER** âŠŠ |
| case | `is_staff_admin_of` + not-excluded | `dispose_case_phi` Â· staff_admin + not-excluded | **EQUAL** = |
| referral | `is_staff_admin_of_for(source)` | `dispose_referral_phi` Â· tenancy(source) **OR** NSP(source hosp) **OR** NSP(target hosp) | â›” **DISJOINT** |
| rca | NSP operator **OR** `rca_members`(role â‰  observer) | `dispose_event_phi` Â· tenancy **OR** NSP | â›” **CROSSING** |
| capa | NSP operator of the plan's hospital | `dispose_event_phi` Â· tenancy **OR** NSP | **NARROWER** âŠŠ |
| interview | not-excluded **AND** (staff_admin **OR** interviewer) | `dispose_case_phi` Â· staff_admin | â›” **WIDER** âŠ‹ |
| triage | `can_read_event` **AND** NSP operator | `dispose_event_phi` Â· tenancy **OR** NSP | **NARROWER** âŠŠ |

â­ **The FUP's own warning lands harder than it was stated.** Of the six lanes it said must
not be generalised, only **two** repeat the meeting's "narrower": one is **equal**, one
**wider**, one **crossing**, one **disjoint**. Generalising the meeting bound would have been
wrong for **four of six â€” and wrong in both directions.**

Every relation is pinned by an executed *pair*, never read off the source. DISJOINT, for
instance: org_admin â†’ `reopen_referral` **BLOCKED 42501** and source staff_admin â†’
`dispose_referral_phi` **BLOCKED 42501**, with each **ALLOWED** on the other door.

â›” **The filed "only 2 of 7 doors mention `is_staff_admin_of`" undercounts** â€” it was a symbol
grep. **Four** lanes reach that predicate; two of them through a helper
(`can_manage_referral_source`, `can_write_interview`). The conclusion it supported still
holds, but for a different reason than the evidence given.

âš  On the triage lane an org_admin is refused at the **read** gate (`can_read_event` â†’ `P0002`),
before the authority arm is reached: the actor who may **erase** the event's PHI cannot **read**
the event.

#### (c) â›” The erasure fallback is BROKEN on two lanes â€” found only by EXECUTION

The premise underneath this item â€” *where the corridor cannot reach, the erasure door still
can* â€” is **false**, and it fails in states the corridor **can** reach too. Each measured with
a matched positive control:

- `dispose_event_phi` **raises `HC047`** whenever the lane's RCA is `completed` â€” the normal end
  state of a finished investigation. `app.guard_rca_child_lock` refuses `rca_factors` /
  `rca_root_causes` / `rca_timeline_entries` / `rca_evidence` / `rca_why_chains`.
- `dispose_event_phi` **raises `HC049`** whenever the CAPA plan is `completed` **or** `cancelled`
  (`app.guard_capa_child_lock` on `capa_effectiveness` / `capa_measure_result` / `capa_action_task`).
- `dispose_case_phi` **raises `23514`** whenever the case has a `completed`/`cancelled` interview
  with subject rows (`app.guard_interview_child_lock` on `case_interview_subjects`).
- **Positive controls**: the same doors **ALLOWED** with rca `in_progress` / interview
  `awaiting_follow_up`; and `dispose_meeting_minutes` on a **`distributed`** meeting,
  `dispose_referral_phi` on a **`completed`** referral, `dispose_case_phi` on a **`cancelled`**
  case â€” all ALLOWED. The lock is the child guard, not the terminal state as such.

The raise aborts the whole RPC, so **nothing is erased** â€” `event_patient` is not even deleted.
It fails **loudly**, which is the one mercy here.

â›” **This is ADR [0129](../decisions/0129-meeting-child-lock-disposal-flag.md)'s defect,
recurring in three siblings its fix never looked at.** 0129 gave `app.in_disposal_rpc` to
`guard_meeting_child_lock` alone; the other three child locks read **no stand-aside GUC at
all**. The enumeration that closed `FUP-DISPOSAL-CHILD-LOCK-BLOCKS-PHI-ERASURE` was bounded by
the **instance**, not the property.

Property-bounded sweep (write sets **derived** from the door bodies, crossed with every
row-level trigger that can `raise`): **15 guards with no `app.in_*` stand-aside sit on tables
the erasure doors write; 3 are confirmed blockers by execution.** âš  **A candidate count is not
a defect count** â€” most of the other twelve are *coherence* guards (they refuse an incoherent
write, not a state) and some are DELETE-only triggers on tables the door only UPDATEs. They are
**unproven either way, not cleared.** Filed as `BUG-DISPOSAL-CHILD-LOCK-RCA-CAPA-INTERVIEW`.

#### Residue â€” what is still open

1. **PO ruling per â›” cell in (a)**: corrective path, widened corridor, or an explicit
   *"no correction, erasure only"* acceptance â€” recorded **where the pilot decision is made**,
   not only here (the requirement C3 and `FUP-RESIDUE-NOTICE-RESTS-ON-TRAINING` both carry).
   â›” Do not read `rca`'s âœ… as safe: its corridor is complete and its erasure door is the
   broken one.
2. **A capa_plan with `source in ('manual','meeting','indicator','audit_finding')`** â€” permitted
   by the `capa_plan_source_shape` CHECK â€” is matched by **no** erasure door at all
   (`dispose_event_phi` reaches capa only via `source_event_id` / `source_rca_id`). Combined with
   `cancelled` being corridor-unreachable, such a plan's free text has **neither** remedy.
   Sibling item: `FUP-DOOR-ERASURE-FREETEXT-CENSUS`.
3. **Two guard messages point at a door that will refuse the reader** â€” `guard_capa_status`
   *"(reabra para editar)"* on a `cancelled` plan, and `guard_event_triage` *"(reabra a triagem
   para editar)"* on a `closed`/`cancelled` event. Both corridors are unreachable from those
   states. Copy fix, but it is an instruction to attempt the impossible during an LGPD response.
4. **The twelve unproven sweep candidates** above.

### ðŸŸ¡ FUP-XREF-PEPPER-ROTATION-ORPHANS â€” rotating `mrn_pepper` permanently orphans DISPOSED xref rows; documented in ADR 0039 as "follow-up", never filed (owner: backend; pre-pilot: decide, not build)

Filed 2026-08-19 (lead) â€” from the disposal-ADR sweep. ADR
[0039](../decisions/0039-patient-identity-cross-committee-linkage.md) Consequences: pepper rotation
*"orphans disposed-row keys (the raw MRN is gone, so the key can't be recomputed) â€¦ a documented
residual, **not** built (follow-up)"* â€” and no register entry was ever created. Measured 2026-08-19:
1 live function references `mrn_pepper`; `patient_xref` holds rows whose `disposed_at` marks exactly
the population a rotation strands. The interaction with the DSR program (ADR 0130) is that disposal
**creates** the unrotatable population â€” every granted erasure widens it. Nothing to build now; the
item exists so a future "rotate the pepper" task cannot be scoped without meeting it.

### ðŸ”µ FUP-ADR0121-REASON-VALUE-DRIFT â€” the `superseded`-vs-`retention_expired` question ADR 0121 Amdt 2 deliberately left open has been silently pre-answered by the D11 register entry (owner: lead)

Filed 2026-08-19 (lead). ADR [0121](../decisions/0121-disposal-lifecycle-inflow-outflow-and-evidence.md)
Amendment 2: the reason value recorded when the retention clock fires on a superseded version is
**deliberately left open** â€” *"the implementing slice decides it explicitly and records the choice
here"*, because both candidate values are true and their regulator-facing meanings differ. But the
`FUP-DM5-D11-SUPERSEDED-NEVER-RETIRES` body in this file already states
`disposal_reason_category = 'superseded'` as if chosen. The live CHECK still admits only the
original five values (measured 2026-08-19), so nothing is built on the drift â€” but the register is
pre-empting an ADR's reserved decision, which is how an open question becomes a "decision" nobody
made. **Fix:** the D11 implementing slice makes the call explicitly, records it in ADR 0121 Amdt 2's
reserved slot, and reconciles the D11 body; until then, neither value may be cited as decided. (ADR
[0130](../decisions/0130-dsr-subject-request-workflow.md) explicitly does **not** settle it.)


### ðŸŸ  FUP-DISPOSAL-RUNBOOK-COVERS-ONLY-BYTES â€” the PHI-disposal runbook is the procedure for ONE of the two PHI-disposal substrates; the four column-erasing doors have no operational procedure at all (owner: backend + PO; found by correcting a wrong-grain claim, 2026-08-19)

**Measured 2026-08-19** while checking whether `FUP-DISPOSAL-CHILD-LOCK-BLOCKS-PHI-ERASURE`
really blocked C1a (it did not). PHI leaves this system by **two structurally different
substrates**, and only one has a runbook:

| Substrate | Mechanism | Operational procedure |
|---|---|---|
| **Storage bytes** â€” `file_objects` parked at `disposal_state = 'disposal_pending'` | inflow: `request_document_disposition`, `dispose_case_phi`, `dispose_referral_phi`, `complete_document_reclassification`; outflow: `complete_document_disposal`, which **nothing schedules** | âœ… [`phi-disposal-runbook.md`](../deployment/phi-disposal-runbook.md) â€” this is precisely why it exists (its Â§ 0) |
| **DB columns** â€” `minutes_md`, `meeting_agenda_items.*`, `patient_identifiers`, `event_patient`, `referral_patient`, narrativesâ€¦ redacted in place to `[PHI removido]` | `dispose_meeting_minutes`, `dispose_case_phi`, `dispose_event_phi`, `dispose_referral_phi` â€” each **completes synchronously inside its own transaction** | â›” **NONE** |

**Measured, not inferred:** the runbook contains **zero** occurrences of `meeting`,
`minutes_md`, `dispose_meeting_minutes`, `dispose_event_phi`, `patient_xref` or
`PHI removido`; it names `dispose_case_phi` and `dispose_referral_phi` **once each**, and only
as *inflow doors that park a `file_objects` row* â€” never as PHI-erasure operations in their
own right. In the catalog the two paths are disjoint: `dispose_meeting_minutes` writes no
`file_objects` row and never sets `disposal_pending`; `complete_document_disposal` never
touches meetings.

âš  **This is not a claim that column PHI is un-erasable.** The column doors work, complete
synchronously, and need no operator â€” which is exactly why they never acquired a procedure, and
exactly why nobody noticed. The gap is that **"the PHI disposal runbook" is read as covering PHI
disposal**, and a C1a rehearsal executed against it will exercise the byte path and record a
green that says nothing about the column path. Under LGPD Art. 18 an erasure request spans both.

**What is actually needed** (PO call â€” this may be a runbook Â§ or an explicit scope statement):
1. The runbook states its substrate **in its title or Â§ 0 banner**, so its green cannot be read
   wider than it is; **and**
2. either a companion procedure for the four column doors, **or** a recorded decision that they
   need none because they are synchronous â€” with the *evidence path* named either way (which
   door, which audit event, what a verifier reads afterwards).

â­ **How it stayed invisible:** every document that touched it was individually correct about its
own subject. The runbook never claimed to cover columns; the doors never claimed to need a
runbook; C1a said "run the runbook". The gap lived **between** them, and it took a wrong-grain
claim â€” *"the child lock blocks C1a"* â€” to point at the seam. Same shape as
[[an-approvals-scope-is-a-fact-that-must-be-written-down]]: invisible from either document alone,
because each is complete about its own subject.

### ðŸŸ  FUP-FORM-IDENTIFIER-IN-URL â€” a sensitive field submitted BEFORE HYDRATION serialises into the query string. **4 leaks CONFIRMED AND FIXED (incl. CPF + MRN); the STANDING DETECTOR and the `useFieldIds` default remain open** (owner: frontend + lead; **class, correction, measurement and fixes all credited to `frontend`**)

**Filed and largely closed 2026-08-20**, during DSR Slice 3, by `frontend` â€” found in its own new
code, then measured and fixed across the app. â›” **Downgraded ðŸ”´ â†’ ðŸŸ  because the measured leaks are
gone, NOT because the class is closed.** What is open is the *detector* and the substrate default.

**Mechanism.** A form input carrying a `name` is serialised by the browser's *native* GET submit.
Pressing Enter **before React has hydrated** submits natively: no handler is attached yet, so
`preventDefault` cannot run. A `<form onSubmit={â€¦}>` with **no `action=`** GETs to the current URL.

â›” **`name` is INJECTED, not written.** `useFieldIds(name, â€¦)` returns a `controlProps` object
containing `name`, which components spread onto the input. **There is no `name=` in the source** â€” the
defect is invisible to the obvious search, which it defeated three times.

**MEASURED â€” the complete population that was examined, nothing predicted:**

| surface | before | after |
|---|---|---|
| `users/cpf-field.tsx` (via `/manage/usuarios/novo` **and** `/manage/usuarios/[userId]`) | â›” LEAKS `?cpf=` | âœ… SAFE |
| `users/user-profile-edit-form.tsx` | â›” LEAKS `?fullName=â€¦&cpf=â€¦&professionalCategoryId=â€¦` | âœ… SAFE |
| `users/affiliations-panel.tsx` | â›” LEAKS `?newHospitalId=â€¦&newEmployeeId=â€¦` | âœ… SAFE |
| `patient-index/patient-search-view.tsx` | â›” LEAKS `?patient-mrn=â€¦&patient-encounter=â€¦` (**PHI**) | âœ… SAFE |
| `users/register-user-form.tsx` (the predicted `?password=`) | âœ… NOT-REACHABLE-PRE-HYDRATION | â€” |
| `printing/revoke-document-dialog` Â· `forms/save-to-library-dialog` Â· `forms/edit-library-entry-dialog` | âœ… NOT-REACHABLE-PRE-HYDRATION | â€” |

The four NOT-REACHABLE verdicts are **measured, not assumed**: each host route was loaded JS-disabled
and its server HTML counted zero forms and zero dialog nodes. (Two required creating a draft through
the real UI first, since the seed has none; it was deleted afterwards.)

**Fix:** ten one-line `name={undefined}` strips across five files. â­ **No `FormData` anywhere** â€” all
four leaking forms were already `useState`-controlled, so no submission path changed and the
`method="post"` question is moot. â­ **The two CPF leaks were ONE bug**: both routes render the shared
`users/cpf-field.tsx`, so a single strip fixed both â€” which is also why the CPF exposure was *wider*
than either route on its own suggested.

**Control, both directions** (a sweep returning SAFE everywhere is indistinguishable from a sweep that
stopped looking): the `cpf-field.tsx` strip was reverted and re-run â†’ **LEAKS**; restored â†’ **SAFE**.
Same harness, same run, unmodified between.

â­â­ **THE FINDING: BOTH PREDICTIONS WERE WRONG, IN OPPOSITE DIRECTIONS.** `backend` and the lead both
escalated `?password=<plaintext>` as the thing that mattered â€” **it does not exist**. Meanwhile
**`cpf`, the Brazilian national identity number, leaked in two places and was on NEITHER candidate
list.** Both lists were assembled from field names their authors could think of. **A list of names you
can think of is not an enumeration of the population.** See
[[enumeration-boundary-is-a-syntax-not-a-property]].

## â›” STILL OPEN â€” two limits `frontend` stated about its own sweep

1. **"8 candidates, 8 measured" is NOT "the app is clean."** The population was a list a *static read*
   proposed; the sweep measured that list honestly but never independently enumerated every `<form>` in
   the app. Given this class has beaten a reasoned read three times, the standing check must be a
   **crawler over authenticated routes that fails on ANY named input inside an action-less form** â€” not
   a re-run of this list. â›” Never a `name=` grep: it cannot work against an injected `name`.
2. **`<select>` coverage is weaker than text-input coverage.** The harness does not overwrite `<select>`
   values, so a select is only caught by noticing its *real* value in the URL â€” which is exactly how
   `professionalCategoryId` and `newHospitalId` surfaced. **A select that happened to be empty at page
   load would have read as clean.** The select population is not reliably enumerated by this run.

## âœ… PO-RULED 2026-08-20 â€” INVERT the `useFieldIds` default (assigned to `frontend`; a SEPARATE change after Slice 3)

`frontend`'s recommendation (not actioned, per the lead's ruling): have `useFieldIds` **omit** `name`,
and require the callers that genuinely use `FormData` to opt in explicitly. Today the **dangerous case
is the default** and the safe case needs discipline at **51 call sites â€” with a measured failure rate
of 10/51**. Inverting makes the safe case free, makes the dangerous case visible in review, and turns
this from a discipline into something a lint rule could actually gate. âš  It touches every form in the
app, so it is its own change with its own review, not a rider on a security fix.

â›” **The inversion's hazards run the OPPOSITE direction from the leak, and every one fails SILENTLY â€”
green in `tsc`, lint and unit tests while broken at runtime.** Enumerate before changing the hook:
1. â›” **`<form action={serverAction}>` / `useActionState`** â€” a server action receives **FormData built
   from `name`d inputs**. Losing `name` does not degrade it; it submits **nothing**. Hardest to spot,
   because such a form never had an `onSubmit` to notice.
2. â›” **Radio groups** â€” `name` is what *groups* radios so only one can be selected. Purely behavioural.
3. **Explicit `FormData` reads** (`new FormData`, `formData.get`).
4. âš  **Autofill / password managers** â€” `name` feeds autocomplete heuristics; opting back in there is the
   *correct* outcome, not a workaround.

â›” **Out of scope of the inversion:** the standing route-crawler gate (limit 1 above). It is the right
detector, but CLAUDE.md's gate list is the PO's to extend.

### â›” CORRECTION 2026-08-20 (`frontend`, self-reported) â€” the true blast radius was **GET FORMS ONLY**, not 133 spreads

Measured during the step-3 verification, and it **shrinks a number this file previously carried**:

```
LOGIN (no JS): method=post  named=[â€¦,"email","password"]
ADMIN (no JS): method=post  named=["name","slug"] / ["organizationId","name","slug"] / â€¦
DSR   (no JS): method=get   named=[]
```

**Every server-action form renders as `method="post"`, and a POST body does not reach the query
string.** So the 30 fields opted back in were **never at risk of this leak** â€” and all four genuine
leaks were client `onSubmit` forms, which default to **GET**. The defect's population was never "every
form using `useFieldIds`"; it was GET forms only.

â­ The inversion remains right â€” it makes the safe case free and the dangerous case *declared* â€” but the
honest framing is **defence-in-depth plus a documented taxonomy**, â›” **not "133 live leaks closed."**
Recorded because the teammate corrected its own headline downward rather than letting the larger number
stand, and an inflated number in a security record is a claim that will be quoted.

### Annotation landed at 30, not the 42 upper bound â€” the file-level trap was real

Reading each site against its server action's actual `formData.get()` **read set** removed 12 that
file-level bucketing would have wrongly opted in: 9 controlled fields in `add-participant-dialog` (its
action never reads those keys), `add-member-picker`'s search box (a client-side filter â€” the action
reads hidden inputs), and 2 resolving to the shared `cpf-field`. â­ **That is exactly the "33 is an upper
bound, not a work list" hazard, and it fired.**

âš  **`radioGroup` and `autofill` have ZERO call sites.** All 20 radios take `name` from explicit
attributes the hook never touches, and for the auth fields `formData` is the *binding* reason (they
break without it), so they were annotated `formData`. Two union variants are unused â€” **open question
for the PO**, since "a new reason must require adding a variant" argues for pruning to `formData` alone.

### Enumeration (measured 2026-08-20, before the hook was touched) â€” the blast radius is ~1/3 of the class counts

**43 files spread `{...X.controlProps}`; 133 spreads total.**

| bucket | files | spreads | meaning |
|---|---|---|---|
| **AT RISK** â€” file also uses `action={}` / `useActionState` / `FormData` | 17 | **33** | per-site inspection required |
| **RADIO** â€” `add-participant-dialog.tsx` | 1 | **9** | `name` groups the radios; stripping breaks selection **silently** |
| **SAFE** â€” no action, no FormData, no radio | 25 | **91** | the inversion is a no-op |

â­ **The gap between class counts and the intersection is the useful finding.** 44 files use
`useActionState`/`action={}` and 22 read `FormData` â€” but most get `name` from **hand-written
attributes**, which the inversion cannot touch (`create-case-dialog.tsx`: 14 explicit `name=` vs 2
spreads). âš  **And the bucketing is FILE-level: 33 is an UPPER BOUND on the work, not a work list.**
"The file contains a server action" says nothing about whether *this control's* value is read from
FormData. â›” Opting a field in because its file appeared in a bucket re-adds `name` to fields that do
not need it â€” the worst available outcome, and invisible afterwards because the opt-in would *look*
deliberate. Ambiguous site â†’ leave un-annotated and **exercise** it: a broken submission is loud, a
needless `name` is silent.

### The opt-in shape (ruled 2026-08-20) â€” `nameRequiredFor`, a closed union, â›” no `"other"`

```ts
useFieldIds("email", { nameRequiredFor: "formData" })    // a server action / FormData read consumes it
useFieldIds("kind",  { nameRequiredFor: "radioGroup" })  // `name` is what groups the radios
useFieldIds("email", { nameRequiredFor: "autofill" })    // password-manager heuristics need it
```

â›” **Rejected: `submitsVia`** (the proposed name) â€” false for two of its own three values, since neither
radio-grouping nor autofill is submission. **A parameter name that lies about its content** is the
class this repo paid for when `p_template_id` was renamed to stop lying and the forced `DROP`+`CREATE`
silently reset an ACL. A closed union with **no `"other"`** keeps unclassifiable sites out of a catch-all
â€” which is where the next leak would hide.

**Sequencing â€” three steps, no broken intermediate:** (1) add the parameter, still always emitting
`name` (no-op); (2) annotate the sites (no-op); (3) flip the default â€” one risky change, once, against
an already-annotated tree. â›” Flipping first leaves ~42 sites broken while they are annotated.

The auth forms (`login-form`, `password-set-form`, `reset-request-form`) are class 1 **and** class 4
simultaneously â€” they opt back in under `"autofill"`, with the reason stated at the call site; that is
the **correct outcome, not a workaround**.

### âš  A cheap lint rule becomes possible â€” and it does NOT close this follow-up

`nameRequiredFor: "formData"` co-occurring with an action or a `FormData` read is an ordinary static
check, no browser needed. â›” **But it is a CLAIM-CHECKER, not a leak detector.** It verifies a *declared*
opt-in is honest; it cannot see a field carrying `name` for another reason, a hand-written `name=`, or a
form the enumeration never reached â€” and "8 candidates, 8 measured" was already not "the app is clean".
**The route crawler remains the detector.** Recording a cheap check as coverage for an expensive one is
exactly how this program's four authz ARMs came to pass while seeing nothing.

### ðŸŸ¡ FUP-VITEST-UNCAPTURED-FAILURE â€” one unit test failed once and **nobody knows which** (owner: backend/lead; **filed only because QA found it was missing from the record entirely**)

**2026-08-20, DSR Slice 3.** A full `npm run test` run reported **1447 passed / 1 failed of 1448**. The
failing test's name, assertion and cause were **not captured**, and the run was not preserved. It has
passed on every run since (five-plus, all 1448/1448).

> ### â­• SECOND OCCURRENCE 2026-08-21 â€” partly captured, and with a probable cause
>
> During the DSR operational-remediation round, `backend` observed **1 failed / 1506** in *"a
> printed-documents actions test"*, did not investigate, and **reported it** rather than letting it
> disappear â€” which is this item working as intended, one notch short of its ask.
>
> **What is known this time, and it is more than last time: the file family is named.** What is
> still missing is the test name and the assertion.
>
> **Probable cause, stated as probable and not as diagnosis:** `git status` at that moment showed
> `frontend` **mid-write** on `referralId/page.tsx` and two DSR test files â€” a concurrent-write race
> against a running vitest, not a product defect. âš  That is a *hypothesis consistent with the
> evidence*, not a finding; nobody re-ran it against the same tree state, and nobody can.
>
> **Re-measured by the lead immediately after the tree settled: `npm run test` â†’ 1506/1506, exit 0,
> 106 files.** Clean.
>
> â­ **The generalisable half:** running the full unit suite while another agent is writing source
> produces failures that are real observations of an unreal state. Two agents, one working tree,
> is the same hazard class as two agents and one local database â€” and unlike the database, nothing
> announces it. â›” Do not reconcile a test count taken during another agent's write.

â›” **"Passed on every run since" is not a diagnosis.** The test cannot be named, so it cannot be
re-examined, and nothing distinguishes *a fixed flake* from *a real intermittent defect that has not
recurred yet*. The honest state is **undiagnosed**, and it must not be quietly graded as resolved by the
passage of green runs.

âš  **Why this is filed at all:** the lead stated twice that it "stays a work item" and **never wrote it
down**. QA found every occurrence in the record was a flat *"vitest 1447"* â€” the failure had been
verbally acknowledged into non-existence. *A work item that lives only in a report is not a work item.*

**If it recurs:** â›” **capture the full vitest output BEFORE re-running.** A re-run destroys the only
evidence, and the re-run is the reflex.

### ðŸ”´ FUP-AUTHZ-HARNESS-PRECONDITIONS â€” a neutralization verdict has at least TWO preconditions and the harness checks ONE (owner: backend/harness; **filed after two near-miss false BLINDs on the same live door in one session**)

**2026-08-20, DSR Slice 3.** The neutralization harness returned **`PASS`** for two probes against
`create_dsr_request`'s authorization gate and `complete_dsr_task`'s effect check. Read literally, that
says **a live PHI-adjacent authorization gate is BLIND**. It said nothing of the kind â€” **twice, by two
different broken preconditions:**

1. **The baseline was already red.** The `db reset` before the run had **exited 1** and the suite was
   failing 73/75 before any probe fired. A probe verdict over a red baseline is not a weak verdict, it is
   **no verdict**.
2. **The domain did not contain the subject.** The harness's `SUITE` defaulted to `00_setup + 350`, and
   **both keystones live in `349`.** The suite it ran never contained the assertion it was trying to
   falsify.

â›” **The general form: *"nothing noticed the gate opening"* and *"nothing that could notice was running"*
are INDISTINGUISHABLE in the output.** A neutralization verdict rests on at least two preconditions â€”
**baseline green** and **the keystone present in the swept domain** â€” and the harness asserts only the
first. Both near-misses were on the **same door**, reached by different routes, within one session.

âš  **How the second was caught: by wondering why a gate that had been watched working would suddenly be
unguarded.** The author's own words: *"that is luck, not method."* â›” Had either been piped through
`tail`, or believed, it would have been a **false P0 on a live authorization door** â€” the exact class
that burned an external auditor in ADR 0078.

**Scope â€” â›” do NOT read this as "RED verdicts are unaffected".** This defect cannot manufacture a false
COVERED from a **green-verified** baseline: it fails toward PASS/BLIND, and the harness already asserts
the probe moved `md5(pg_get_functiondef)` (a dead write channel aborts loudly). âš  **It does NOT follow
that RED is unconditionally safe.** A **red baseline also yields a red post-probe run** â€” mutate a gate
in an already-failing suite and it stays failing, the harness prints `# Failed test â€¦`, and that reads as
**RED = COVERED**, attributing a pre-existing failure to the mutation. That is a **false RED, failing in
the *reassuring* direction** â€” the one nobody re-checks. It is the exact inverse of the two near-misses,
and is **not** excluded by them.

> **A RED verdict is sound iff the baseline was verified green for that run.**

**Every verdict in DSR Slice 3 meets that bar:** each battery run gated on a printed green baseline, and
**no verdict rests on a PASS â€” 47 RED + 1 GREEN, and the GREEN was recorded as a finding, not a pass.**
So no Slice 3 verdict needs re-opening.

â›” **Provenance of this scope note, because it is the point.** QA argued structurally that *"a RED entails
all three preconditions, so the harness defect cannot reach a RED"*, and **the lead endorsed it without
testing it.** `backend` refuted it: the argument holds for two preconditions and **fails for the
baseline**. An over-strong safety rule, adopted because its conclusion was correct for the case at hand,
would have been relied on later where the conclusion does not hold. *The conclusion being right is not
evidence that the reasoning is.*

**A second instance of the same family, found fixing this one:** `350`'s verdict census. The strict
pattern (`\.\.+` dot-leader) returned **46** â€” it missed a line appended with a one-dot leader. The naive
pattern (`^--   .*RED`) returns **49** â€” inflated by prose lines merely containing the word. **Both
candidate shapes are wrong, in opposite directions.** True total **48 = 47 RED + 1 GREEN**, now derived
four ways and cross-checked. â›” The shape contract is written out â€” and **nothing enforces it**: a comment
cannot check itself.

**The fix (filed, NOT built):** the harness must assert its own preconditions and refuse to emit a
verdict when either fails â€” baseline green âœ… *(already checked)*, and **keystone present in the domain
âŒ (not checked)**. A `PASS` with the subject absent must be an ERROR, never a verdict. This project
leans on this instrument for its entire authz coverage story.

### ðŸŸ¡ FUP-PGTAP-184-T11-FLAKE â€” `184_hospital_admin_isolation.sql` test 11 failed once, undiagnosed but NAMED (owner: unassigned)

**2026-08-20.** *"RLS: ha1 reads CCIH forms (swapped surface)"* failed on the first full `test:db` run
after an orphaned server was reaped; **passed in isolation on a fresh reset and on two subsequent full
runs** (6678/6678 twice). `184` runs **before** `350` alphabetically, so the DSR suite cannot contaminate
it, and nothing Slice 3 touched goes near `forms`/`commissions` RLS.

â›” **Not a diagnosis** â€” "passed three times since" never is. But unlike
[[FUP-VITEST-UNCAPTURED-FAILURE]] this one **has a name**, so it is actionable rather than a footnote:
whoever picks it up has the file and the test. âš  Plausible but unverified: it first appeared during the
window when a stray standalone server was deadlocking pgTAP, so contention is a candidate cause â€” that is
a hypothesis, not a finding.

### ðŸŸ¡ FUP-E2E-GATE-CENSUS-AND-CRASH-CLASSIFIER â€” the gate's own arithmetic does not sum, and it scores a worker crash as an assertion failure (owner: lead/tester)

> ### â­• HALF-RESOLVED 2026-08-21 (lead, measured on a full gate run) â€” the arithmetic DOES sum; the census line just does not count skips
>
> Run of 2026-08-21, 19/19 batches, on the DSR remediation branch:
> `1166 passed Â· 2 failed Â· 3 flaky Â· 11 skipped Â· 0 did-not-run Â· 1182 collected`.
>
> **1166 + 2 + 3 + 11 = 1182, exactly.** The gate nonetheless printed
> `COVERAGE: accounted for 1171 of 1182 collected tests` â€” and **1171 = 1166 + 2 + 3**, i.e. the
> `accounted` figure omits the **skipped** bucket. â­ So the *"11 tests in no bucket"* this item was
> filed on were never in no bucket: they were **skips, in a bucket the coverage line does not add
> up.** The defect is the reporting definition, not lost tests.
>
> âš  **This resolves the ARITHMETIC half only. The item stays OPEN for its other half** â€” the INFRA
> classifier still has no notion of a worker exit code, so a `0xC0000409` crash would score as an
> assertion failure with tests stranded behind it. â›” That half is untouched by this measurement, and
> the fix for it is still **not** "add crash to INFRA": a crash is a third category requiring a re-run
> before any verdict.
>
> â­ **Worth keeping regardless of the fix:** `did-not-run` was **0 on every one of the 19 batches**,
> and that â€” not the pass count â€” is the number that answers *"did anything get swallowed?"*. It is
> the direct antidote to the serial-abort blindness recorded in
> [[e2e-prod-build-flaky-baseline]]: a serial file that aborts leaves tests unrun, and this field is
> where that shows.


**2026-08-20, the DSR Slice 3 declaring run.** Two defects in `scripts/e2e-prod-gate.sh`, both found by
reading its output rather than trusting the headline:

1. â›” **The census does not sum.** `GATE SUMMARY: 1153 passed Â· 3 failed Â· 4 flaky Â· 5 did-not-run` and
   `COVERAGE: accounted for 1165 of 1176 collected` â€” **11 tests are in no bucket at all.** They are
   neither passed, failed, flaky, nor reported as never-run. A census whose parts do not sum is wrong,
   and this one is the instrument that declares the phase green.
2. â›” **The INFRA classifier has no notion of a worker exit code.** It classifies on `server_dead`,
   `conn_errors` and `pgrst_unready`. `ethics-e2-procedure.spec.ts:913` died with
   `worker process exited unexpectedly (code=3221226505)` â€” `0xC0000409`, a Windows stack-buffer-overrun
   â€” and was scored as a **real assertion failure**, with 5 further tests stranded behind the dead
   worker and reported as did-not-run. An isolated re-run of the same frozen tree passed 68/68.

âš  **Consequence, and it cuts both ways.** A crash counted as a defect sends someone hunting a
non-existent bug (this cost a `useFieldIds`-regression investigation before being ruled out on
evidence). â›” And the same blindness could equally hide a real defect behind "infra" once the classifier
is taught about crashes â€” so the fix is **not** "add crash to the INFRA list", it is *classify a crash
as its own third category: neither pass nor defect, and REQUIRING a re-run before any verdict.*

**Related in kind, same session:** `FUP-AUTHZ-HARNESS-PRECONDITIONS` â€” a verdict emitted about a
substrate that was not in the state the instrument assumed. This is the same family in the E2E gate.

### ðŸ”´ FUP-E2E-ABSENT-ROW-ASSERTIONS â€” `expect(row?.field).not.toBeNull()` passes when the row is ABSENT, and it is live on PHI-erasure assertions (owner: tester/lead; **the number was wrong in BOTH directions before anyone measured it**)

**2026-08-20, found by QA r2 while falsifying a count the lead had relayed.** B2 fixed this shape inside
the DSR specs. It is **not** confined to them.

> ### â›” FOURTH CORRECTION 2026-08-20 (lead, measured) â€” the item was also read TOO WIDE, and the over-read is in the alarming direction
>
> A DSR-remediation sweep listed **five** live PHI-erasure instances: `case-patient.spec.ts:1193`,
> `pdf-printing-meetings.spec.ts:335`, and `meeting-audio-minutes.spec.ts:483/492/571`. **Only the
> first two are vacuous.** The three audio ones use `.toBeTruthy()`, and `undefined` is **falsy** â€”
> they fail loudly on an absent row.
>
> **Measured, not reasoned** (vitest 4.1.8, four assertions, all passing):
>
> | matcher on `absent?.field` (â‡’ `undefined`) | verdict |
> |---|---|
> | `.not.toBeNull()` | â›” **PASSES** â€” this is the vacuity, and it is the ONLY one |
> | `.toBeTruthy()` | âœ… throws |
> | `.toBe(false)` | âœ… throws |
> | `.toBeNull()` | âœ… throws |
>
> â­ **So the defect is the MATCHER, not the optional chaining.** `row?.` is necessary but not
> sufficient; every prior statement of this item said *"optional chaining converts a missing subject
> into a passing assertion"*, which is true only in composition with a matcher that accepts
> `undefined`. Stated at the wrong grain, that reads as a licence to sweep every `?.` in the tree â€”
> and the population it yields is mostly sound tests. [[a-predicate-quoted-at-the-wrong-grain]]
>
> âš  **This does NOT shrink the item**, for two reasons. (1) The **second** vacuity mechanism the DSR
> fix named â€” a helper that returns `[]` on a *failed read*, turning "the request errored" into "the
> table is empty" â€” is **matcher-independent** and still unswept. (2) The population must be
> re-derived as a property (**matcher âˆˆ the accepts-`undefined` set** Ã— a possibly-absent subject),
> â›” never as a grep for `?.`. Four counts have now been claimed for this item and four have been
> wrong.

â›” **Three numbers were claimed and none survived measurement:**
- `tester` reported *"14 spec files carry private copies, exactly one other swallows"* â€” the lead relayed it.
- QA measured *"â‰¥49 swallowing helper bodies"* and flagged its own larger figure (85/67) as **unverified**.
- **Lead's own measurement, bounded by shape and stated as such:** **17** assertions of the form
  `expect(x?.field).not.toBeNull()` / `.toBeTruthy()` across **10 files**, and **9 separate private
  `serviceQuery` definitions** in `e2e/`, several returning `[]` on a failed or non-array response.

âš  **17 is a LOWER BOUND on ONE SHAPE, not the population.** The *property* is "an assertion that a row's
field is non-null where the row itself may be absent"; a regex over `?.` cannot enumerate that. See
[[enumeration-boundary-is-a-syntax-not-a-property]]. â›” **Do not quote 17 as the count.**

**The PHI-relevant instances â€” this is why it is ðŸ”´, not ðŸŸ¡:**
- `e2e/pdf-printing-meetings.spec.ts:335` â€” `expect(row?.phi_disposed_at, 'the RPC actually disposed this
  fixture').not.toBeNull()`. â­ **Its own assertion message is precisely the false statement an absent row
  makes it assert.** Byte-identical in kind to B2.
- `e2e/meeting-audio-minutes.spec.ts:482/483/492/571` â€” `applied_at`, `purged_at`, `audio_deleted_at`:
  **audio-PHI deletion** assertions in the same shape.
- `e2e/meeting-held-time.spec.ts:296/373/566` â€” `held_at`.

â›” **`lint:vacuous` sees none of it** â€” the vacuity is manufactured **one call frame away**, inside the
helper, so the assertion reads as unconditional at the call site.

**Not fixed here, deliberately:** the tree was hash-frozen for the declaring gate, and converting a
swallowed read into an assertion can surface a hidden failure in a spec nobody has analysed. This needs
its own pass, with each conversion's red triaged.

â­ **The lesson that outranks the fix:** *"exactly one other"* closed a question that was open. It is the
partial-fix-reads-as-complete family **retiring the very lesson B2 had just taught** â€” and it took a
reviewer measuring, not a reporter reporting, to catch it.

### â¬› INCIDENT (recorded 2026-08-20) â€” a process tree is not dead because the child you named is

The lead killed the **listener** on :3000, saw the port go free, and declared the `e2e:prod` tree reaped.
It was not: the **`npm run e2e:prod` parent was still alive and minting replacement standalone servers**,
which is why two people looking at "the server on :3000" saw **different pids**. Those orphans served live
app queries through PostgREST against pgTAP's `TRUNCATE` and **deadlocked three consecutive `test:db`
runs â€” 21 deadlocks each, ~700 tests never executing.** `taskkill /PID <parent> /T /F` then took out a
**4-deep chain**.

â›” **Generalisable, and this is the half that was missing from the record:** *the port going free is
evidence about the CHILD, not the SUPERVISOR.* Reap by process tree from the parent, and verify by
enumerating the **process table** â€” never by re-checking the port. âš  `TaskStop` does not reap a
background command's process tree (standing rule, now with a second occurrence).

### ðŸŸ  FUP-DSR-OUTCOME-RECORD-HAS-NO-DELIVERY â€” the DSR workflow's one promise to the data subject has no mechanism (owner: PO/frontend; **filed 2026-08-20, PO-deferred the same day**)

ADR [0130](../decisions/0130-dsr-subject-request-workflow.md) **D1** requires answering a subject
request with its outcome and, for a refusal, its legal basis (LGPD Art. 18 Â§4). `BUG-DSR-S3-007`
calls the outcome record *"the artifact delivered to the data subject"*.

â›” **`src/components/dsr/dsr-outcome-record.tsx` renders on screen only.** Measured 2026-08-20:
the DSR module contains **no export, print, PDF or download path** â€” not in `src/components/dsr/`,
not in `src/app/o/[org]/titulares/`, not in `src/lib/dsr/`. No document names how the record
reaches the subject, and no runbook covers it. This is the workflow's **only** promise to the
subject with neither a mechanism nor a procedure.

**PO ruling 2026-08-20: OUT OF SCOPE for the operational-remediation round** (the round that fixed
`BUG-DISPOSAL-CHILD-LOCK-RCA-CAPA-INTERVIEW`). â›” **Deferred with the gap named â€” not closed, not
descoped.** Today an operator delivers the answer out-of-band, keyed by the request's `file_ref`.

**Two shapes when it is taken up, and they are not equivalent:**
1. **Minimal print view** â€” a print stylesheet plus an `Imprimir` affordance on
   `/o/[org]/titulares/[requestId]`. Cheap, no new door. âš  But ADR
   [0125](../decisions/0125-previa-ephemeral-and-emission-registered.md) /
   [0126](../decisions/0126-print-series-and-derived-currency.md) make printing a **registered
   emission** concept in this platform, so an unregistered print sits *beside* that model rather
   than inside it â€” and the delivered legal answer would carry no verification trail.
2. **Registered emission** â€” route the record through the existing print/emission subsystem so the
   delivered answer is a registered document. Correct for a legal deliverable; costs its own ADR
   plus a print-source vector.

âš  **Do not let the screen render stand in for delivery in any status claim.** The record being
*complete and correct on screen* is what the DSR gate verified; that it *reached the subject* has
never been in scope and is not evidenced anywhere.

### ðŸŸ¡ FUP-DSR-ENCARREGADO-MUST-BE-A-COMMISSION-MEMBER â€” the LGPD data-protection officer cannot be a pure officer (owner: PO/product; **filed 2026-08-20 after a lead premise was measured false**)

`app.is_dpo_of_for(p_hospital_id, p_user_id)` carries this as a **hard conjunct**, measured in the
live catalog 2026-08-20:

```sql
and exists (
  select 1 from public.commissions c
  where c.hospital_id = p_hospital_id
    and app.has_role_any('commission', c.id, p_user_id)
)
```

So an *Encarregado* (LGPD Art. 41 data-protection officer) who holds **no commission role** in that
hospital resolves `false`, arm 1 of `list_my_dsr_hospitals()` returns nothing, and
`/o/[org]/titulares` 404s them. A second, independent lock says the same thing one layer out:
`organizations_select` is `is_admin OR is_org_admin_of OR is_org_member OR is_pqs_operator_in_org OR
is_nsp_org_admin_of OR is_org_level_admin_within OR is_quality_reviewer_in_org` â€” **no DPO arm** â€”
and `titulares/layout.tsx` reads the organization row *before* the DSR gate.

â›” **This is BY DESIGN, not an oversight.** ADR [0130](../decisions/0130-dsr-subject-request-workflow.md)
D2, quoted in `src/lib/queries/dsr.ts`: *"The Encarregado is a plain member of ONE commission BY
DESIGN."* The seed's only DPO, `staff1.ccih@test.local`, is a plain CCIH `staff` member for exactly
this reason.

**The open product question, which the design does not answer:** in a real hospital the Encarregado
is frequently a compliance/legal officer with no committee seat. Today onboarding one means giving
them a commission membership they do not otherwise need â€” which is a *read grant over that
commission's content*, i.e. paying for a DSR office with unrelated access.

â­• **Filed, not fixed.** Discovered 2026-08-20 when a lead spawn prompt asserted the opposite
(*"in production an Encarregado is a hospital/org officer who need not be a member of any
commission"*) and `frontend` measured it false before building against it. â­ The premise was wrong in
the direction that would have produced **dead navigation code**, and the catch came from a teammate
checking the catalog rather than the prompt.

**If the PO wants the pure-officer persona**, it costs: an `is_dpo_of_for` widening, an
`organizations_select` DPO arm, an ADR 0130 D2 amendment, and a re-think of where such a user lands
after login (`list_my_dsr_hospitals()` returns `orgId` but **no `orgSlug`**, and a caller who cannot
read `organizations` cannot resolve one). â›” Not a nav change â€” a boundary change, and it widens a
read path, so it does not qualify as wrong-and-safe.

### ðŸŸ¡ FUP-TITLE-ERASURE-REACH-IS-NOT-UNIFORM â€” six of the ten annotated `*.title` columns ARE inside a disposal door's reach, and four are not (owner: PO/lead; **filed 2026-08-20 while writing the ADR 0131 Amdt 1 helper text**)

â­ **THE MEASUREMENT, taken because a shared constant was about to state the opposite.** ADR 0131
Amendment 1 promotes soft helper text on `*.title` inputs, resting on the WS B "title invariant"
(*titles are governance metadata, PHI-free by design*). The natural REASON to give a user for that
instruction is *"titles are not erased when patient data is discarded"*. Measured in the live
catalog against the four `dispose_*` doors' write sets:

| inside a door's redaction reach | NOT inside any door's reach |
|---|---|
| `cases.label` Â· `case_events.title` (`dispose_case_phi`) | `patient_safety_event.title` |
| `documents.title` (`dispose_case_phi` **and** `dispose_referral_phi`) | `meetings.title` |
| `rca_evidence.title` (`dispose_event_phi`) | `capa_action.title` |
| `case_referral.subject` (`dispose_referral_phi`) | `case_interviews.title` |
| `meeting_agenda_items.title` (`dispose_meeting_minutes`) | |

â›” **So a single constant claiming EITHER direction ships a false compliance statement on roughly
half its sites** â€” the exact failure `D12_TITLE_GUIDANCE`'s docblock names (*a false blanket warning
teaches clinicians to skip guidance*). Following the precedent's letter would have violated its
reasoning.

â­• **Resolved for the copy, open as a record question.** `PHI_TITLE_HINT` /
`PHI_FREE_TEXT_HINT` (`src/components/ui/phi-input-hint.tsx`) give the reason that is true at every
site â€” **visibility**: a title rides queue, list and dashboard projections and is readable by people
who cannot open the record. A pinned unit assertion forbids either constant from acquiring an
erasure verb, so this cannot regress silently.

**What stays open, for the PO:** the loose reading of "the title invariant" â€” *titles are outside
erasure* â€” is **false for six columns**, and ADR 0131 Amdt 1's own framing invites it. Either the
ADR gains a sentence naming the split, or a future reader will cite the invariant for a conclusion
it does not bound. âš  Also note the direction: the six are erased *more* than the invariant implies,
so the error is conservative for the data subject and misleading for the record â€” which is why it
is a documentation item, not a defect.

### ðŸŸ  FUP-COPY-PROPERTY-CANNOT-SEE-ITS-OWN-SURFACE-SET â€” the shared disposal-copy property has no census of the surfaces it is asserted on (owner: lead/frontend; **filed 2026-08-21, found by reading 15 tests before deleting them**)

`src/components/dsr/disposal-copy-property.ts` defines the residue / over-claim properties once and
is iterated by two suites. **Nothing asserts how many suites import it, or which surfaces exist.**

Measured 2026-08-21 while removing `ReferralDisposeDialog` (PO-ruled; no hat can reach it). Deleting
its 15-test suite would have caused **three coverage drops, two of them silent**:

| drop | detail |
|---|---|
| â›” **residue-CLASS content pin: 1 â†’ 0** | A repo-wide search found `cifrad` / `PITR` / `impressas` in **exactly one file** â€” the one being deleted. Eight other assertions pin `DSR_RESIDUE_NOTICE.length === 4`; **none looks at what the four lines say.** â­ *A cardinality pin and a content pin are different properties, and the cheaper one is the one that gets written.* Relocated to constant-level tests â€” tying it to a component is what made it deletable |
| â›” **type-to-confirm arming: 1 â†’ 0, on a LIVE control** | `toBeDisabled`/`toBeEnabled` existed **only** in that file. `DsrMeetingDisposeDialog` carries the identical `disabled={isPending \|\| !armed}` and had **no arming test at all** â€” so the deletion would have left the module's most dangerous button with zero behavioural coverage, and nothing would have gone red. Ported + mutation-proven (`disabled={isPending}` reds 3) |
| âš  `dsr-meeting-residue.test.tsx` negative arm: **5 â†’ 4** surfaces | The referral arm proved `DSR_MEETING_RESIDUE_RETAINED` does not leak onto a non-meeting surface. The **lane** is still covered (the `dispose_referral` inbox card renders the shared notice through the same constant); what was lost is one *surface*. Recorded in-file |

â›” **`lint:vacuous` is structurally blind to this.** The assertions were **removed**, not made vacuous â€”
a deleted test is not a test that asserts nothing. Neither gate can see a property whose surface set
silently shrinks, and the shared property file cannot see it either.

**The only thing that caught it was reading all 15 tests before deleting any of them.** That is not a
control; it is an unusually careful person. [[removing-a-subject-breaks-its-assertions-in-two-directions]]

**What would be a control:** the property module declares its expected surface roster and asserts a
**floor** on it, the way `dsr-disposal-overclaim.test.tsx`'s `SURFACES` roster already does with its
`>= 7` anti-vacuity guard. âš  That guard is why the over-claim property's 4 â†’ 3 surface reduction is
**not** a loss here: the roster never contained the referral dialog, so nothing shrank. The two
properties that *did* drop had no roster. â›” Filed rather than built â€” a roster asserted at the wrong
grain (*"assert every adjacent affordance"*) is the un-checkable shape DSR Slice 3 already rejected;
naming the gap honestly is the first deliverable.

> ### â­• A THIRD INSTANCE, INSIDE THE MODULE ITSELF â€” found 2026-08-21 during the QA round-2 sweep
>
> `disposal-copy-property.ts`'s own docblock said the property *"is asserted from two files"*. Measured:
> **one** importer (`grep -rn "disposal-copy-property" src/` minus the module's own path). It had been
> stale for a day, and **nothing could contradict it** â€” the roster is prose and no gate reads it.
>
> â­ **The module whose entire job is to define a property once so it cannot drift carried a stale count
> OF ITS OWN CONSUMERS.** That is this item inside its own subject.
>
> âš  **The stale digit was load-bearing, so it was not quietly decremented.** The module's stated
> justification was *"two copies of a pattern drift"* â€” a premise that evaporates at one consumer. The
> docblock now states the two reasons the module still earns its place (it is the one place the property
> is *stated*, and the deleted surface's content pins were relocated *into* the survivor, which is
> auditable only because the property has a named home), with an explicit â›” against the obvious next
> move: **a count of one is not evidence the abstraction was wrong** â€” inlining is the state it was
> extracted *from*, and a second consumer is one dispose surface away.
>
> **Fix shape, proposed by `frontend` and deliberately NOT built:** a self-counting anti-vacuity test in
> the consuming suite, in the shape that file already uses for `SURFACES.length >= 7` â€” read `src/`,
> count importers, assert the number. It converts the roster from prose nothing can contradict into an
> assertion that reds when a consumer is added or deleted, which is exactly the failure that occurred.
> âš  Two caveats make it a decision rather than an obvious win: it is **a test that reads source**, the
> shape `.claude/rules/ui-copy-forbidden-strings.md` warns against (though here the subject is the import
> graph, not rendered copy, so that false-positive class does not apply); and it pins a number that
> *should* change when a dispose surface is added, so it must red **loudly** rather than become a digit
> someone bumps reflexively.

### ðŸŸ  FUP-E2E-HELPERS-SWALLOW-FAILED-READS â€” ~48 spec files + 2 helpers turn a FAILED READ into "the table is empty" (owner: tester/lead; **filed 2026-08-21; 3 instances fixed, the population reported and deliberately NOT swept**)

The second mechanism inside `FUP-E2E-ABSENT-ROW-ASSERTIONS`, and the one **no matcher choice
defends against**: a helper that returns `[]` when the request itself failed, so *"the request
errored"* and *"the table is empty"* become indistinguishable at every call site.

**Fixed 2026-08-21, three live instances, all now `expect(resp.ok(), â€¦)` before returning:**
`e2e/case-patient.spec.ts`'s local `restGet` Â· `e2e/patient-index.spec.ts`'s local `restGet` Â· the
**shared** `serviceQuery` in `e2e/helpers/documents.ts`. â­ The shared one is used by **6** spec
files; all 6 re-run, **47/47 pass**. Safe by construction: every call site uses the service-role
key, never an RLS-scoped read, so asserting `ok()` cannot misclassify a real access-boundary result
as a failure â€” checked, not assumed.

â›” **The population is ~48 spec files + 2 helpers carrying the same
`Array.isArray(data) ? data : []` shape, and it was deliberately left alone.** The overwhelming
majority are unrelated to PHI erasure, and a 48-file sweep in the same session that fixed 3 would be
a scope explosion with regressions nobody could individually verify. â›” **Do not read the 3 fixed as
a sample that closes the item** â€” â­ *a fix count is not a population count*, the same shape as this
round's other three magnitude corrections.

**When this is taken up:** derive the population as a property (a helper that can return a
collection **and** has a non-throwing failure path), not as a grep for `Array.isArray`; fix the
**shared** helpers first, since each covers many call sites at once; and prove each fix by making a
read fail and requiring red. âš  Where a helper is used with an **RLS-scoped** key rather than the
service role, `ok()` is the wrong assertion â€” an empty result may be the correct answer there, and
that distinction is what makes this a per-helper job rather than a codemod.

### ðŸŸ¡ FUP-DISPOSE-REFERRAL-HAS-NO-INBOX-BROWSER-COVERAGE â€” three of the four erasure lanes are driven through the DSR inbox in a browser; the referral lane is not (owner: tester; **filed 2026-08-21 as the named residual of a bug that closed on removal**)

`BUG-DISPOSE-DIALOG-NO-BROWSER-COVERAGE` closed 2026-08-21 **on removal of its subject**, not on
achieved coverage â€” the `ReferralDisposeDialog` was deleted (no hat could reach it). What that close
does **not** cover, and what is recorded here so it is not inherited as coverage:

**`dispose_referral_phi`'s live pathway â€” the DSR task inbox â€” has no browser-level test anywhere.**
Grepped the whole `e2e/` tree: the only `dispose_referral` hit is `nsp-per-hospital.spec.ts`'s
**direct RPC POST**, which proves the door and the audit trail and says nothing about the inbox card,
its confirm flow, or the server action behind it. `dispose_case`, `dispose_event` and
`dispose_meeting` all gained inbox-driven browser coverage in this round; the referral lane alone did
not.

âš  **Asymmetry worth stating plainly:** the lane whose UI was removed is the lane with the least
browser coverage, and the close of the removal bug is the document a future reader will find first.

### ðŸŸ¡ FUP-CHILD-LOCK-REGRESSION-GUARD-COVERS-ONE-LANE â€” the browser-level P0 guard covers the interview lane only (owner: tester; **filed 2026-08-21 by its own author, as a stated bound**)

`e2e/dsr-disposal-child-lock-regression.spec.ts` drives a real inbox disposal against a **locked
interview** and asserts by **count** (`patient_identifiers` = 0), never by null-check. That is item 9
of the P0's **ten** guard-tripping statements.

â›” **Not covered at the browser level:** the **`meeting_cases`** lane (item 10 â€” the shared fixture's
meeting stays `scheduled`, and reaching `signed` requires the real meeting-lifecycle RPCs) and the
**RCA/CAPA** lanes (no NSP/event fixture exists in the DSR helper). Both are covered at the DB layer
by pgTAP `353`, mutation-proven â€” so this is a *layer* gap, not an unproven fix.

â­ **Filed by the author of the guard, in the report that delivered it.** Recorded because the
alternative â€” a green regression spec whose name implies it covers the bug â€” is exactly how the
original defect survived a full gate.

### ðŸŸ¡ FUP-RULES-VOLUME-CAPS-BIND-IN-OPPOSITE-DIRECTIONS â€” the cap that binds is the one the gate never reports (owner: lead; **filed 2026-08-21 after a one-line rule edit came within 31 bytes of redding the gate**)

â­ **THE OBSERVATION.** ADR [0127](../decisions/0127-standing-rules-home-and-staleness-gate.md) bounds
a `.claude/rules/` rule two ways â€” `paths:` may match â‰¤ **40** files (waivable with `broad:`) and the
file may be â‰¤ **2048** bytes. Measured across the whole population today, the two caps do not bind the
same rules, and they do not bind in the same direction:

| rule | bytes free (cap 2048) | files matched (soft cap 40) |
|---|---|---|
| `answer-maps.md` | 1277 | 4 |
| `radix-dialogs.md` | 1187 | 3 |
| `ui-copy-forbidden-strings.md` | **92** | 5 |
| `progress-contract.md` | **68** | **125** â€” waived in writing by `broad:` |

Reproduce: byte counts are `wc -c .claude/rules/*.md`; matched counts are
`paths.reduce((n,g) => n + globSync(g).length, 0)`, the same expression
`scripts/check-rules-staleness.mjs:120` uses.

â›” **The two rules with almost no byte headroom are the two nobody would call broad**, and the one
that genuinely IS broad (125 files, 3Ã— the soft cap) has that cap **permanently waived** by its
`broad:` declaration â€” so for that rule the byte cap is the *only* live bound, and it is at 97 %.

## Why this is a gap and not a curiosity

**The gate's success line reports NEITHER number:**

```
check-rules-staleness: OK (4 rule file(s), anchors + globs resolve)
```

Its failure messages each name only the cap that broke (`:124` for files, `:140` for bytes). So there
is **no warning band at all**: a rule at 2047 bytes and a rule at 771 bytes produce byte-identical
output, and nobody learns a rule is one line from unmaintainable until the edit that breaks it. The
proximity is invisible precisely while it is still cheap to act on.

âš  **Concrete instance, which is why this is filed rather than observed.** On 2026-08-21 adding ONE
path line to `ui-copy-forbidden-strings.md` took it from 1963 â†’ 2017 bytes, leaving **31 bytes**. The
gate said `OK`. Nothing in that output distinguished it from a rule with 1277 bytes spare. It was
caught only because the byte count was measured by hand while checking the *other* cap â€” the one the
instruction had asked about.

## Shape of a fix â€” â›” FILED, NOT BUILT

A gate change needs its own decision; this is not that decision, and it is out of scope for the round
that surfaced it. Two candidate shapes, both cheap:

- **Report both headrooms** on success, per rule â€” `name: 92 B free, 35 file slots free`.
- **Report whichever is tighter**, as a percentage of its cap â€” one number per rule, and it is
  automatically the one that matters.

The second is probably right: it is a single figure, it cannot be read as "the other one is fine",
and it makes the `broad:`-waived case behave correctly on its own (a waived file cap simply stops
competing to be the tightest).

âš  **What a fix must NOT do:** turn proximity into a failure. These are soft caps for a reason â€”
redding a green build because a rule is at 96 % converts a nudge into a blocker and invites exactly
the wrong response, which is trimming the codified lesson to fit. Visibility is the ask, not
enforcement.

### ðŸŸ¡ FUP-EXIT-CODE-MASKING-HAS-NO-MECHANISM â€” a control that rests entirely on habit, with a measured failure rate (owner: lead; **filed 2026-08-21 as an ACCEPTED RESIDUAL, not as resolved**)

**A pipe erases the exit status of everything to its left, and no gate in this repo can catch it.**

**Measured failure rate: two occurrences in one day**, both by an operator who already knew the
narrow form of the lesson:
- `npm run lint:progress 2>&1 | tail -2 && git add â€¦ && git commit â€¦` â€” the `&&` chain reads
  **`tail`'s** status, which is 0 whatever the gate did. â›” **A commit landed on a FAILING gate.**
- `npm run e2e:prod > log 2>&1; echo "E2E_EXIT=$?"` â€” reported as *"the gate finished with exit code
  0"*. The 0 was the **trailing `echo`'s**. The gate had exited **1**, correctly.

â­ **Both failed in the reassuring direction** â€” the one that does not prompt a second look.

### â›” Why this is filed as ACCEPTED rather than fixed: there is no mechanism to build

| candidate | why it cannot work |
|---|---|
| `set -o pipefail` | cannot reach an **ad-hoc typed** command, which is what both occurrences were |
| a check inside the gate scripts | **a script cannot detect that it is being piped** into something that discards its status |
| `lint:progress` / any repo gate | cannot verify an exit code that was **never captured** |
| a `.claude/rules/` entry | â›” **fails ADR 0127 admission.** Its subject is POSIX semantics â€” it **can never be shown stale**, so `lint:rules` would have nothing to check and it would sit unfalsifiable forever in a 12-slot, byte-bound population. It also has **no honest `paths:` glob**: the trigger is *authoring a command*, not opening a file |

âš  **An admissible variant is constructible and would be ineffective** â€” scope to `package.json` +
`scripts/*.sh`, anchor on the gate script names. It would then fire when someone **edits those
files**, and both occurrences touched **no file at all**. **Admissible and inert is not a hint; it is
a fifth rule that never loads when the hazard occurs.**

**So the control is: the operator runs the gate bare, captures `$?` immediately, and reads the
value.** That is a habit, it is the whole of the mitigation, and it has a measured failure rate.
â›” **Recording it as resolved would be false.** The lesson is generalised in memory (auto-loaded, and
generalised precisely because the narrow *"don't `tail` `e2e:prod`"* form **existed and failed to
transfer** to a different gate) â€” but memory is prose, and prose has now failed here once.

â­ **This is filed in the same register as the ADR 0131 training premise at
[dm5-po-decisions.md](dm5-po-decisions.md) item 2**: when a control rests entirely on a human, this
repo says so plainly rather than letting a green gate imply otherwise. Raised by QA in the round-2
addendum, and the framing is theirs.

### ðŸ”´ FUP-ETHICS-CASE-DELETE-CASCADE â€” a commission `staff_admin` can `DELETE` an in-flight ethics case over PostgREST, cascading all SEVEN `ethics_*` tables, with ZERO audit rows naming any ethics entity (owner: backend + PO; found 2026-08-21 answering the PO's "were any doors opened?", ADR 0132)

**â›” PO-ruled RECORD-ONLY 2026-08-21 (ADR
[0132](../decisions/0132-ethics-proceedings-carry-no-erasure-entitlement.md)) â€” accepted and OPEN,
not fixed and not absent.** Closing it is an RLS/gate change owing migrations, pgTAP keystones and
an ADR 0079 diff-scoped door sweep; it was deliberately not slipped into a documentation change.

**Measured against the live catalog at head `20261003000300`, 2026-08-21, and confirmed BY
EXECUTION in a transaction â€” rolled back, pre-state re-verified byte-for-byte.**

â­ **The finding is not "cases can be deleted". It is that the ethics lane's deliberate
write-lockdown is defeated by a parent that was never locked down.** Each of the nine `ethics_*`
tables is granted `select` **and nothing else** to `authenticated` (verified: three `grant select`
statements in the E2 intake migrations, no `insert`/`update`/`delete` anywhere), carries only a
SELECT RLS policy, and is written exclusively by **14 DEFINER RPCs none of which contains a
`DELETE`**. That is a real, intentional hardening â€” and the FK cascade walks straight through it.

| probe (same JWT: `chefe.ccih`, `active_role=staff_admin`) | result |
|---|---|
| `DELETE /rest/v1/ethics_case_details?case_id=eq.â€¦` | â›” **403** `42501` permission denied |
| `DELETE /rest/v1/cases?id=eq.â€¦` | âœ… **200** |

- **The cascade:** all seven case-scoped tables (`ethics_allegations`, `ethics_appeals`,
  `ethics_case_details`, `ethics_decision_details`, `ethics_findings`, `ethics_hearings`,
  `ethics_notifications`) carry `case_id â€¦ REFERENCES cases(id) ON DELETE CASCADE`.
- **The grant + policy:** `cases` grants `authenticated` DELETE; `cases_staff_admin_write` is
  `FOR ALL` to any commission `staff_admin` (`is_staff_admin_of(commission_id) AND NOT
  is_case_excluded(...)`). Both predicates measured TRUE for the seed persona.
- **The only bound is too narrow:** `app.guard_case_status`' DELETE arm raises only for
  `old.status in ('completed','cancelled')`. The CHECK admits five values, so `not_started`,
  `pending` and `in_review` â€” **every in-flight proceeding** â€” are deletable. â­ That is exactly
  the window in which a party has the strongest incentive to want the record gone.
- **Executed differential:** ethics case + details `1 â†’ 1` before, `0 â†’ 0` after the DELETE,
  `1 â†’ 1` again after `rollback`. The probe MOVED state and the restore brought it BACK.
- â›” **Rule 11 gap on this path:** the statement emits **3** audit rows â€” 2 `case_access.revoked`
  + 1 `case.deleted` â€” and **none names any ethics entity**, because **no `ethics_*` table carries
  an audit trigger** (measured: 2 triggers across all nine, both document-scope guards, neither on
  DELETE). The proceeding's content vanishes leaving a row that says only *"Caso nÂº N excluÃ­do"*.

âš  **Bounded, stated:** this is a structural finding about reachability. It does **not** claim
anyone has done it, and it does **not** enumerate the other case-composition children that share
the cascade â€” the sweep was scoped to the ethics lane the PO asked about. â›” A future reader must
not treat "ethics is the only lane affected" as measured; it was not asked.

### ðŸŸ  FUP-ETHICS-RESPONDENT-PIN-FIRES-TOO-LATE â€” `redact_professional_profile` erases the accused doctor's identity from an UNDECIDED ethics case; the retention pin lands one lifecycle stage after the entitlement ends (owner: backend + PO; ADR 0132)

**â›” PO-ruled RECORD-ONLY 2026-08-21** â€” same disposition and same reason as the item above.

**Measured 2026-08-21 against the live catalog; confirmed BY EXECUTION, rolled back.**

The `HC0J7` retention bar fires only when `retention_pinned_at is not null` **OR** the professional
is a respondent in a case with an **`issued`** decision. `app.trg_pin_respondent_retention` is an
UPDATE trigger on `case_decisions` whose first statement is *"Only the transition INTO 'issued'"*.
â‡’ through intake, admissibility, findings and hearings, **both halves of the bar are false** and the
door succeeds.

- **Gate is wider than the subject suggests:** `app.can_manage_professional` = `is_admin()` OR
  `is_org_admin_of(org)` OR **any commission `staff_admin` in that org**. The same persona that can
  delete the case can redact its respondent.
- **Executed:** `Dra. Denunciada` / `CRM-9001` â†’ `Profissional (dados removidos)` / null
  (`license_number`, `license_region`, `specialty`, `professional_type`, `cpf`, `user_id` all
  nulled), on a case with `retention_pinned_at IS NULL` and **0** issued decisions. Rolled back and
  re-verified.
- âš  **No UI calls it â€” and that is NOT the control.** `redactProfessionalProfile`
  ([actions.ts:637](../../src/lib/ethics/actions.ts)) has **zero** callers in `src/`. But the RPC is
  `EXECUTE`-granted to `authenticated` and answers over PostgREST (probe returned `P0002`
  *profissional nÃ£o encontrado* â€” the body, not a 403). â­ The PO's *"no UI is needed"* is already
  satisfied; the door is live anyway. [[correct-door-that-nothing-can-reach]] in reverse.
- â­ **Why the existing coverage is green over this.** pgTAP `257` and
  `e2e/ethics-e2-procedure.spec.ts` both pin the bar for a **pinned/decided** respondent â€” they
  assert `HC0J7` fires when it should. Nothing asserts the pre-decision case, because
  pre-decision redaction is **permitted by design** under ADR 0072 Â§7's original rationale. The
  suites are sound; the design moved under them.
  [[fixture-cannot-reach-the-failing-state]]

**Why it is a defect now and was not before.** ADR 0072 Â§7 keyed retention on the *defensibility of
the decision*, so pinning at issuance was coherent. ADR 0132 keys it on the **proceeding** being an
administrative record with legal consequences, so the entitlement is absent from
**allegation-filing**. The pin's trigger point is inherited from a rationale that no longer governs.

**Fix shape when it is scoped** (filed, deliberately NOT built): pin on the respondent link being
created rather than on decision issuance â€” i.e. a trigger on `case_participants` for
`role.key = 'respondent_doctor'` â€” and widen the belt from `cd.status = 'issued'` to *"respondent in
any ethics case that is not `cancelled`"*. â›” Do **not** fix it by narrowing
`can_manage_professional`; that gate serves non-ethics professional administration too, and cutting
it would be a different change with its own blast radius.

### ðŸŸ¢ FUP-APP-SCHEMA-PUBLIC-EXECUTE-IS-CONFIG-BOUNDED â€” half of `app` is PUBLIC-executable, and the only thing bounding it is one config line (owner: backend; filed 2026-08-22, found while deriving an ACL by property for ADR 0134 Amdt 6)

**Found while doing something else** â€” the ADR 0134 Amendment 6 condition "derive `member_can_for`'s ACL
from the catalog by property, do not invent one". The derivation surfaced an asymmetry, and the
asymmetry turned out to be the small end of a much larger measured fact.

**Filed as ðŸŸ¢ informational, deliberately.** It is **not** a live hole, and it must not be reported as
one â€” see the bound below. It is filed because the bound is a *config line*, not the ACLs, and nothing
in the tree says so.

**Measured 2026-08-22 from the live catalog** (property + count for each):

| property | count |
|---|---|
| functions in schema `app` (`prokind='f'`) | **467** |
| of those, **`anon` holds EXECUTE** (`has_function_privilege`) | **237** |
| `proacl IS NULL` â€” the *permissive default*, which includes PUBLIC | **228** |
| an **explicit** `=X/postgres` PUBLIC entry in `proacl` | **9** |

The nine explicit ones: `answer_map`, `can_read_correction_response`, `commission_of_version`,
`eval_condition`, `is_admin`, **`is_member_of`**, `is_org_admin_of`, **`is_staff_admin_of`**,
`latest_published_version`. Four of those nine are **authorization predicates**.

â›” **THE BOUND, and it is the whole severity argument.** Schema `app` is **not exposed to PostgREST** â€”
`supabase/config.toml:13` is `schemas = ["public", "graphql_public"]`. An `anon` caller cannot reach
`app.*` over the API at all (this repo has already recorded that `app.*` RPCs are 404). So these grants
confer nothing today. â‡’ **defense-in-depth gap, not a vulnerability.** If that one line ever gains
`"app"`, 237 functions become directly callable by `anon` in the same edit â€” the ACLs are not the thing
holding the line, and a reader auditing the ACLs would conclude they were.

â­ **How this was nearly filed wrong, which is the reusable part.** It was first reported as
*"`app.is_member_of` carries a PUBLIC EXECUTE grant while its `_for` twin and the whole `_for` family do
not â€” `is_member_of` is wider than every sibling."* Every clause of that is **true**, and the framing is
**wrong in the way this repo keeps being wrong**: it names the instance found instead of the class. Run
by property, the class is 237 of 467, `is_staff_admin_of` is a second explicit member the sentence
missed, and the dominant mechanism is not a deliberate grant at all but **`proacl IS NULL`** â€” the
default nobody wrote. A one-outlier framing invites a one-function fix that would change nothing.

**To close** â€” this needs a *decision*, not a patch, and the decision is not this increment's:
1. Rule whether `app` should be default-`REVOKE`d from PUBLIC at all (a sweeping ACL change across 228
   functions, each of which must still work for `authenticated` / `service_role` / the DEFINER chains).
2. If yes, the honest gate is a **pgTAP** assertion (âš  DB anchors are not checkable in `npm run lint` â€”
   ADR 0127's stated bound), and it must be **red-first**: create a throwaway `app` function with a NULL
   `proacl` and require the gate to catch it, or the gate proves only that today's 228 were listed.
3. Whatever is decided, `supabase/config.toml:13` should carry a comment saying that 237 `app` functions
   are anon-executable and this line is what makes that safe. Right now the load-bearing line looks
   routine.

â›” **Do not "fix" this by adding `REVOKE` to the ADR 0134 migration.** It is outside that ruling's
approval scope, it is unrelated to the case surface split, and a sweeping privilege change smuggled into
a feature migration is how the next reader loses the reasoning.

### ðŸŸ¡ FUP-SIGNATURE-STRING-CALLERS-ABORT-ON-A-DROP-CREATE â€” a caller that names the OLD ARITY fails as a plan mismatch, pointing nowhere near signatures (owner: backend; filed 2026-08-22, found when the full suite failed in a file this increment never touched)

**What happened.** ADR 0134 Amdt 2 needed `p_patient` added to `public.create_case` and
`public.create_case_from_template`. `CREATE OR REPLACE` **cannot add a parameter** â€” it creates an
*overload*, and PostgREST 300s on an ambiguous candidate set â€” so both were `DROP FUNCTION` +
`CREATE`. That hazard was anticipated and pinned (`357` 1.5 asserts the overload count is 1 each).

**A second, different hazard was not.** `supabase/tests/100_dashboard.sql:439` asserted

```sql
has_function_privilege('anon', 'public.create_case_from_template(uuid,text,uuid,text,uuid,jsonb)', 'EXECUTE')
```

â€” a **signature STRING naming the old arity**. The moment the seventh argument landed, that string
stopped resolving and the call raised `function ... does not exist`.

**â›” WHY IT IS WORTH A FOLLOW-UP RATHER THAN JUST A FIX â€” it does not present as a signature problem.**
The raise happened mid-file, so the suite **ABORTED** rather than reddening an assertion. What the gate
reported was:

```
Dubious, test returned 3 ... Parse errors: Bad plan.  You planned 22 tests but ran 20.
```

A plan mismatch in `100_dashboard.sql` â€” a file the increment never touched, about dashboards, naming no
function. `Result: FAIL` with **zero `# Failed test` lines**, which is the recorded *"green has a third
failure mode â€” the assertion that NEVER RAN"* shape wearing its opposite: a red that names the wrong
subject. Reading the summary alone would send the next person into the dashboard suite.

**The overload pin cannot catch this, and that is structural.** `357` 1.5 counts CANDIDATES; this is a
caller pinning an ARITY. Different failures, and neither implies the other.

**Population, swept by property** (`create_case(_from_template)?\([a-z]` across `supabase/tests/`, `src/`,
`e2e/`, `supabase/seed.sql`, excluding `supabase/migrations/`): **9 textual hits, exactly ONE executable**
â€” `100_dashboard.sql:439`. The other 8 are prose in docs, ADRs, comments and one test *description*
string. Fixed in place.

**Mitigation landed:** `supabase/tests/357_creation_scoped_case_phi.sql` 1.6/1.7 pin both doors' exact
`p.oid::regprocedure::text` â€” which is the *same string form* `has_function_privilege` takes, so the pin
matches the hazard rather than approximating it â€” and they sit beside the explanation, so a future
signature change reds next to its reason instead of in a distant ACL assertion.

**Why it stays open.** The mitigation covers the two doors this increment changed. The **class** is
untreated: any future signature change in this repo walks into the same abort, and nothing enumerates
signature-string callers generally. Cheap options, in increasing cost: (a) a lint/pgTAP sweep asserting
that every `has_function_privilege(..., '<schema>.<fn>(<types>)', ...)` string in `supabase/tests/`
resolves to a live `regprocedure` â€” catalog-checkable, and it would have caught this before the run;
(b) a convention of passing `oid` rather than a signature string. âš  Whatever is built, the control must
be that it goes RED on a deliberately stale signature â€” a sweep of this shape that finds nothing is
indistinguishable from one that cannot find anything.

### ðŸŸ  FUP-42501-AUTHORED-MESSAGES-FLATTENED-BY-EVERY-MAPPER â€” 103 authored pt-BR refusals, and the app layer discards essentially all of them (owner: backend/frontend; filed 2026-08-22, found when a PO-ruled message never reached the UI)

**How it surfaced.** ADR 0134 Amendment 7 Â§A7.2 requires `bulk_create_cases` to refuse the
`all_phases` scope **at the gate, with its own pt-BR message naming the scope** â€” so a delegate is
told *which half to change* instead of being handed a generic "forbidden". The door does exactly
that. `src/lib/cases/bulk-actions.ts` then mapped `42501` to a flat constant and **the message never
reached the user**. Fixed narrowly for that one message (see below); the CLASS is what this item is.

**Measured, both sides.**

*Database side* â€” distinct `raise exception '<msg>' ... errcode = '42501'` across `public` + `app`,
comment-stripped:
```
DISTINCT = 104   |   bare 'sem permissÃ£o' = 1   |   INFORMATIVE = 103
```
Almost every authored `42501` in this schema says something specific â€” *"apenas a coordenaÃ§Ã£o da
comissÃ£o de destino pode atribuir responsÃ¡veis"*, *"apenas a coordenaÃ§Ã£o pode abrir uma sessÃ£o
reservada"*, and 101 more.

*App side* â€” modules under `src/lib/**` (excluding tests) that map `42501`: **63**. Modules doing ANY
message recognition rather than returning a flat constant: **2** (`dsr/messages.ts`,
`forms/actions.ts`), plus the pair added by this fix.

â‡’ **The answer to "does the mapping flatten every `42501` from every door?" is essentially YES**, and
it is 103 authored sentences wide.

**â›” WHY THIS IS NOT SIMPLY A BUG TO SWEEP.** The flattening is not careless â€” it is the only
*safe* default, because **`42501` is the one SQLSTATE whose message cannot be trusted from the code
alone**: Postgres raises it both for an authored refusal AND for its own raw-English
`permission denied for table X`. Passing `42501` messages through wholesale would leak raw English to
the UI and breach CLAUDE.md Â§8 / Rule 10. That is the same conflation recorded in
`FUP-42501-CONFLATES-GRANT-WITH-RLS`, one layer up: there it makes a TEST unable to say which lock
refused; here it makes the UI unable to say what the user should do differently.

**The shape that works, demonstrated by the fix.** An explicit **recognition list** â€” not an
allowlist on the code, and not a passthrough: only messages named verbatim survive, everything else
still becomes the generic string. `src/lib/cases/bulk-error-map.ts` does this for one message, and
returns the CANONICAL entry rather than the matched text, so no `linha N:` prefix or Postgres
`CONTEXT:` detail can ride along.

**âš  The test must have BOTH halves or it tests nothing.** `bulk-error-map.test.ts` asserts the
recognised message survives AND that an unrecognised `42501` (including
`permission denied for table patient_identifiers`) still maps to the generic string. Proven by two
neutralizations with **complementary** red sets: emptying the recognition list reds 4 (the anchor +
the three surfacing tests), converting the mapper to a passthrough reds 4 (the canonical-text and
both unrecognised-`42501` tests). Neither mutation alone reds both halves â€” which is exactly why
both are needed. â›” The first attempt at the emptying mutation **did not actually mutate** (the regex
missed; the suite stayed green) and was caught only by grepping the file for the entry afterwards.
A "9 passed" from a no-op probe is not evidence.

**What to decide (not urgent, but it is 103 messages).** Options, increasing cost: (a) leave it and
extend the recognition list per message as product need arises â€” cheap, but each one is discovered
by a user hitting a dead end, which is how this one was found; (b) mark authored refusals with a
distinguishable SQLSTATE (an `HC***` in the project's own space) so the existing
`PT_BR_SQLSTATES` allowlist handles them structurally and `42501` stays reserved for real
privilege errors â€” the cleanest, and it makes the trust question decidable from the code, but it is
a 103-site migration touching live doors; (c) a shared recognition registry generated FROM the
catalog, so the list cannot drift from the doors. âš  Under (a) or (c) the standing control is that
every entry must be copied from `pg_get_functiondef` verbatim and pinned, or the list silently
degrades to the generic string â€” failing exactly as if it were not there, with nothing going red.

### ðŸŸ  FUP-DEV-SERVER-SERVED-STALE-CODE-FOR-HOURS â€” a green E2E run against a stale instrument is indistinguishable from a real pass (owner: tester/lead; filed 2026-08-22, found mid-verification in Increment 2)

**What happened.** The long-lived `next dev` process (PID 10664, started **11:20:33** local) was serving
**pre-Increment-2 code** for files whose commits landed at **12:33, 12:45 and 14:30** â€” hours earlier. It
rendered the appoint dialog **without** the fifth `read_cases` checkbox and **with** the retired PHI copy
(*"inserir e visualizar dados de paciente"*), while the same files on disk plainly carried the new code.
`taskkill` + `rm -rf .next` + a fresh `npm run dev` fixed it immediately.

â­ **It was one step from being filed as a product bug.** A "MÃºltiplos casos" bulk-gate failure was about
to be reported as a defect in the new two-key gate. It was the instrument. The tester's own discipline â€”
*clear `.next`, rebuild, re-run before reporting a regression* â€” is the only reason it was not.

â›” **MECHANISM NOT ESTABLISHED, and that is the honest state.** The old process's console output was **not
captured before the kill**, so it is unknown whether the watcher had died or was alive and silently
dropping events. The staleness was **not** deliberately reproduced afterwards â€” manufacturing a second
stale window mid-session was judged not worth the risk, which was the right call and leaves the cause
open. âš  Do not let a later reader turn "restarting fixed it" into a diagnosis; it is a remedy, not a cause.

â›” **The blast radius is every green run, which is the direction nobody investigates.** A *failing* spec
against stale code gets investigated and the staleness surfaces â€” that is exactly what happened here. A
**passing** spec against stale code is indistinguishable from a real pass and is never questioned. So the
suspect population is not "runs that failed"; it is **every `npx playwright test` executed against a
long-lived dev server in this repo**, and its size is not established.

**Bound, stated so this is not over-read:** `npm run e2e:prod` â€” the Â§6 step-2 gate â€” builds a prod
standalone bundle and never touches a dev server. **The phase gate is unaffected.** This is a
quick-loop-instrument problem, not a gate problem.

#### â­ MECHANISM ESTABLISHED 2026-08-22 (later the same day) â€” and it is OUR tooling, not another session

The entry above says the mechanism was not established, and twice that day the interference was
attributed to *"another Claude session on this shared machine"*. **That attribution was wrong, and the
real mechanism is in this repo's own config.**

`playwright.config.ts:31-36`:
```ts
webServer: { command: 'npm run dev', url: 'http://localhost:3000',
             reuseExistingServer: !process.env.CI, timeout: 120_000 }
```

So **every `npx playwright test` invocation boots `npm run dev` on port 3000** when nothing is
listening, and **reuses** whatever is listening when something is. Two consequences, both observed:

1. **A `npm run dev` server is left behind.** The tester found and killed *"one more benign leftover
   from my own successful `webServer` boot â€” not crashed, just idle"* â€” i.e. it observed this happening
   from its own run, not someone else's.
2. **That server holds ~20 live connections to the local database**, which is what makes
   `supabase db reset --local` fail part-way through the baseline. Measured: with it killed, app
   connections dropped 20 â†’ 11 and a reset succeeded **on the first attempt** (440 registered = 440
   files) after failing **3 of 4** attempts before.

â›” **This explains the whole day's interference without invoking another session:** backend's three
failed resets and the DB stranded at 325 of 440 migrations Â· a pgTAP run returning **4 failures and ~300
fewer tests** (6621 vs 6941) that was **fully green** on a clean re-run Â· `191_grant_hardening` Â§2.3
failing once and never again Â· and the "stale server" this entry was originally filed about â€” a
**reused** long-lived dev server is exactly what `reuseExistingServer: true` produces, and nothing
guarantees it is younger than the code under test.

âš  **What is still NOT established:** whether *every* leftover observed that day came from this path.
Other sessions on the machine can also start servers, and one process seen listening cannot be traced
to its parent after the fact. The claim here is that this path **is sufficient** to produce every
symptom observed â€” not that no other path contributed.

â­ **The reusable lesson is about the attribution, not the config.** "Another session did it" is
unfalsifiable, costs nothing to say, and **stops the search**. It was believed twice, by two different
agents, on evidence that fit the local explanation equally well. The config line had been sitting in the
repo the whole time.

**Additional close condition, now that the mechanism is known:** either stop the E2E entry point from
leaving a server behind, or make `supabase db reset` refuse to start while anything holds a connection
â€” a reset that half-applies **440 migrations** and reports a partial state is worse than one that
declines. âš  `e2e:prod` is unaffected (it manages its own standalone server and clears the port per
batch); this is the **quick-loop** entry point.

**To close â€” the cheap fix does not require the mechanism.** A **proof-of-life** at the start of any
dev-server E2E run: assert something that exists *only* in HEAD before any other assertion, so a stale
server fails loudly at the first step instead of quietly passing. That catches the whole class whatever
the cause. âš  It must be a check that is **read**, not an implicit `beforeAll` precondition, and it must
be built so it can fail â€” this repo has a recorded case of a positive control that passed while priming a
cache and made the real assertion meaningless. Establishing the actual mechanism (watcher death vs
dropped events) stays worth doing, but it is not a precondition for the guard.

### ðŸŸ¡ FUP-CS2-QA-RESIDUE â€” the twelve non-blocking QA findings from Increment 2, and four of them are the same class (owner: backend/tester/frontend; filed 2026-08-22 at the Record step; â­• **12 â†’ 6 on 2026-08-22** â€” M-5/M-6/M-7/M-14/M-15/M-16 remediated red-first and QA C-3 discharged; **M-4 STRUCK as already-delivered**. Remaining: M-1, M-8, M-11, M-12, M-13, M-17. Record: [case-split-assertion-integrity.md](case-split-assertion-integrity.md))

â›” **Filed so the review's findings do not leave with the review.** QA r2 APPROVED with five record
conditions; C-1 (gate figures), C-2, C-4 (verdict rows) and the M-3 / M-4 / M-9 / M-10 items are
**discharged in that delivery**. What remains is **M-1, M-5, M-6, M-7, M-8, M-11 â€“ M-17**, whose full
statements live in [case-surface-split-increment-2-review.md](../reviews/case-surface-split-increment-2-review.md)
Â§ "M-findings" â€” that file is authoritative; this entry exists so the items are **reachable from the
register the PO reads**, not restated.

â­ **Four of them are one class, and it is this increment's own recurring one â€” an assertion that proves
less than its name claims:**
- **M-5** â€” `356` Â§13's door-set pins are **count-keyed, not name-keyed**: `count(*) = 4` passes if one
  door leaves the set and another joins. A **swap** is exactly how this repo's last name-keyed verdict
  went stale.
- **M-7** â€” `356` Â§2.1's *"one body, not two"* is bounded to the **`app` schema**, so a hand-copy of the
  predicate into `public` passes it.
- **M-15** â€” the "read-only shell" E2E claim is a **2-item hand-list against a 16-member derived class**
  (the same class the `/casos` differential had to re-derive by property after being wrong twice).
- **M-16** â€” the 404 matcher **cannot say which gate fired**, the precise defect a wrong matcher caused
  earlier in this program when it reported a fixed build as broken.

**The rest, one line each:** **M-1** whether any suite exercises the `meetings` **write** path is still
unanswered (A6.4-3) Â· **M-6** `356` Â§8.2d can pass on a NULL participant id Â· **M-8** the
echo-narrowing property (*the server returns no identifier value*) is **unasserted end-to-end** â€” the
component half is pinned, the corridor is not Â· **M-11** the appoint dialog does not tell the coordinator
that the **two keys together** unlock bulk, which is now the only way to get it Â· **M-12** two small UI
items Â· **M-13** `isAdministrativo` was not narrowed alongside `canInCommission` (**not live** â€” it can
no longer decide anything, and it is documented as redundant rather than counted as defence in depth) Â·
**M-14** `ALL` in `session-capability-mirror.test.ts` is **unenforced exhaustiveness in the file whose
docblock says it must not be** Â· **M-17** `dbQuery`'s fail-open survives under the one poll that still
needs it.

**Also owed, from QA condition C-3 â€” and it is the highest-value item here.** The verification that
settled *"S1â€“S7 and the S3 loop are untouched"* was: take the live `app._case_caps` body, **strip the S8
block, `md5` it, and compare against the pre-change hash the migration header records**. It matched
exactly. â­ **Promote it to a pgTAP catalog assertion**, because it is the check that makes the *next*
arm's author prove they changed **only their arm** â€” today it exists as a one-off a reviewer happened to
run. âš  Whatever is built must be **red-first**: mutate a non-S8 arm and require it to fail, or it is a
hash comparison that has never been shown able to disagree.

### ðŸŸ¡ FUP-PLAIN-STAFF-ASSIGNEE-CANNOT-REACH-THE-MANAGE-HOST â€” the surfaced arm's own principal 404s before it (owner: frontend/PO; filed 2026-08-22 by the agent that surfaced the arm, as a stated bound on its own fix)

â­ **Filed by the fix's author, in the delivery, because the alternative is a close note that reads as
completeness.** `FUP-CASE-PHASE-RESULT-ASSIGNEE-UNDERGRANT` is discharged â€” the case-detail surface now
offers the result affordance per-phase, mirroring the door. But `canOpenCaseManagement` admits only
**coordinator âˆ¨ administrativo âˆ¨ per-case write-grantee**, and a **plain-staff assignee is none of
those**: they 404 at the manage host before any phase renders.

**Measured in a browser, not read:** `staff1.ccih` (assignee of an active phase) and `staff3.ccih` both
received the root 404.

â‡’ The widened arm is reachable for an assignee who **also** holds a manage-host arm. A plain-staff
assignee still has only the end-of-wizard path â€” which is not nothing (that path is real and
member-authorized), so this is a **narrower** residue than the parent item, not a reopening of it.

â›” **Not fixable inside the UI fix.** Widening `canOpenCaseManagement` is ADR 0134 routing territory â€”
D1's read/manage split â€” and would admit plain staff to the manage host for every other purpose too.
It needs a PO ruling on the routing, not a patch. âš  Do **not** close this by observing that the wizard
path exists; the question is whether an assignee should reach the manage surface at all.

### ðŸŸ¡ FUP-ACTIVE-PHASE-STASHED-OVERRIDE-IS-INVISIBLE â€” the write succeeds and nothing shows it (owner: backend; filed 2026-08-22 from the phase-result widening)

On an **active** phase the door *stashes* the override (no recompute â€” that is the documented difference
between the `set` and `correct` kinds). But `getCaseDetail` does **not** select `result_override_id`;
only `getCasePhaseForFill` does. So after a successful save: **no badge renders, and reopening the
dialog shows no pre-selection.** The write landed; the surface cannot show it.

âš  **Mitigated with copy, not fixed** â€” the dialog now says the choice *"fica guardado e passa a valer
quando a fase for concluÃ­da"*. The data gap is real and is a query-layer change (`src/lib/queries/`),
which is backend's.

â­ **It produced a false defect report during the build**, which is the reason it is worth a line: a
first-draft assertion demanded a result badge after a successful `set`, so a **correct save read exactly
like a live defect**. Caught only by checking the catalog instead of believing the UI â€”
[[a-wrong-matcher-reads-exactly-like-a-live-defect]].

**Cosmetic, same area:** `PhaseResultCorrectButton` now renders *"Definir resultado"* as well, so its
name is a misnomer. One import site.

### ðŸŸ  FUP-RETRY-CHANGES-THE-FAILURE-MODE-ON-NON-IDEMPOTENT-TESTS â€” the gate's verdict is unreadable where a test poisons its own re-run (owner: tester/lead; filed 2026-08-23 from the first full `e2e:prod` since Increment 2)

â­ **Found by triaging a RED gate whose two "real failures" were neither real nor failures of the code.**

`e2e:prod` runs with `RETRIES=1`. Where a test **mutates shared state and is not idempotent**, a
transient first-attempt failure (server death, connection collapse â€” the known Windows prod-standalone
family) leaves that state behind, and the **retry then fails DIFFERENTLY** â€” on an assertion about the
state its own first attempt created. Measured, both instances from the 2026-08-23 run:

| test | reported failure | why the retry produced it |
| --- | --- | --- |
| `ethics-e4-participants.spec.ts:918` | `expect(seatedTwice.length).toBe(2)` â†’ **1** | attempt 1 already seated the participant |
| `user-registration.spec.ts:506` | strict-mode: `getByLabel('ComissÃ£o')` matches the `<select>` **and** a `Remover ComissÃ£oâ€¦` button | attempt 1 already assigned the commission, so the Remover button exists |

Both error-context directories end in **`-retry1`** â€” the tell, and the only thing in the output that
distinguishes this from a hard defect. **Re-run alone with `RETRIES=0`: 25 passed / 0 failed, GREEN,
exit 0**, including the 8-test serial tail the first run reported as `did-not-run`.

â›” **Why this is worse than flake, and rates ðŸŸ  rather than ðŸŸ¡.** A flake reads as noise and invites a
re-run. This reads as a **deterministic product defect** â€” a wrong participant count, an ambiguous
locator â€” and it points at the feature under test rather than at the harness. It cost a full triage
cycle to establish that neither failure said anything about the code, and the next reader gets no hint:
`GATE RED â€” 2 real failure(s)` is exactly what a genuine regression prints.

âš  **Do NOT "fix" this by setting `RETRIES=0`.** The retry exists to absorb the documented Windows
server-death family, which is real and frequent (this run: five batches hit `server_dead=1` with 4â€“75
connection errors, plus one `exit 127` crash). Removing it trades an unreadable RED for a much noisier
one.

**Directions, none free:** make the tests idempotent (delete-by-identity setup â€” â›” never positional,
`seed.sql` is a contract with ~900 tests); or have the gate classify a retry-only failure distinctly, so
`RED â€” 2 real failures` cannot be printed for a pair that passed alone; or run the retry against a fresh
`db reset`, which is the batch's own recovery model applied one level down.

â­ Class: **a repair mechanism that changes what it is repairing.** Same family as the recorded lesson
that a positive control can contaminate its own subject.

### ðŸŸ¡ FUP-AFF2-CONTA â€” the data subject is the one party who cannot read their own record (owner: frontend/PO; filed 2026-08-23 at AFF2 build start, deferred by design in ADR 0133 D11)

ADR [0133](../decisions/0133-aff2-affiliation-scoped-administration-um-redesign.md) D9 adds
`profiles.date_of_birth` and `profiles.phone`; D10 column-locks both â€” excluded from every
`authenticated` column-list grant on `profiles` (SELECT **and** UPDATE), readable only through a
service-role read behind the D1/D4 authorizer, writable only via `registerUser` / `updateUserProfile`.
That posture is correct against the disclosure it targets (a co-commission member reading a
colleague's birth date and phone) and has one consequence nobody chose independently: **the person the
row is about cannot read it either.** An admin can see a professional's DOB and phone; the professional
cannot.

âš  **This is a named LGPD control, not a UI nicety.** ADR 0133 **Amdt 1 ruling 5** states the posture
explicitly: the DSR lane is **patient-keyed by design** (`dsr_requests.patient_key` via `patient_xref`),
so **professional** data subjects exercise their Art. 18 rights administratively, through their
organization's administration â€” *out of DSR scope by design, not omission*. That framing only holds if
an administrative access path actually exists. `/conta` is that path. Until it ships, the Art. 18
access right for these two columns is discharged by nothing.

**Shape when built:** a self-service read on `/conta` showing the person their own `date_of_birth` and
`phone`. â›” It is **not** simply a column-grant widening â€” granting `authenticated` SELECT on these
columns re-opens exactly the colleague-disclosure D10 exists to prevent. It needs the same shape as the
B6 rail read: a server-side authorized read keyed on `auth.uid() = profiles.id`, returning only the
caller's own row. Whether it is also **writable** by the titular (Art. 18 rectification, as distinct
from access) is a **PO question, not an implementation detail** â€” the columns currently join
`guard_profile_privileged_columns` (Amdt 1 ruling 6), so a self-service write would have to be admitted
through that guard deliberately.

**Why deferred rather than built:** severable by design (ADR 0133 D11 says so in the decision itself),
and it touches a surface â€” `/conta` â€” that AFF2's F-track does not otherwise open. Deferring keeps the
workstream's file ownership clean. â›” **Deferred is not dropped:** the deferral is recorded here so the
next reader finds a registered item rather than an absence, which is the failure mode the ADR's own
"not omission" wording is guarding against.

### ðŸŸ¡ FUP-AFF2-ACTIVE-MEANS-TWO-THINGS â€” three authorities say "active membership" and no policy implements it (owner: backend/PO; filed 2026-08-23 at AFF2 build start, from a conflict `backend` measured before writing SQL)

ADR [0133](../decisions/0133-aff2-affiliation-scoped-administration-um-redesign.md) D13, the AFF2
plan's B2 task, and the build prompt each say the new `professional_credentials` membership leg admits
people holding an **active** membership. Measured 2026-08-23 against the live catalog: **neither**
`profiles` SELECT policy (`profiles_admin_select`, `profiles_select_self_or_admin`) filters
`expires_at` on its membership leg. There is no expiry predicate to mirror, and none of the three
authorities' "active" has ever been implemented on this path.

**Ruled MIRROR (Amdt 2 ruling 3), and the reasoning is the reason this stays open rather than closing.**
Filtering only the new policy would make `profiles` and `professional_credentials` **silently disagree
about what "active" means**, and the next reader could not tell which one is the bug. Worse, it
reproduces the trap B2 exists to remove: a person whose membership expired still reaches the directory
through the `profiles` leg, so a credentials-only filter renders their **Registro cell blank** â€”
"empty means no-permission" all over again. So the question is answerable **only for both policies at
once**, and a one-sided fix is itself the defect.

âš  **The asymmetry now lives inside a single policy, which is the part that will mislead.** AFF2's B2
adds two legs: the **affiliation** leg filters activity (`ended_on IS NULL`), the **membership** leg
does not. A reader who checks the affiliation leg and generalises will conclude both are activity-
bounded. `backend` was asked to state this in the B2 test comments rather than leave it to inference.

â›”â›” **CORRECTED 2026-08-23 â€” THIS ITEM'S OWN BOUNDING CLAIM WAS FALSE, and it is what kept the item
non-blocking.** The paragraph here previously read: *"Not a live hole; do not report it as one â€¦ The write
boundary is untouched: ADR 0133 D1/D2 bound administration separately."* **That is wrong.** D1/D2 are not
bounded *separately* â€” they are **implemented through `resolvePersonFootprint`**, and QA measured that its
membership leg has the **identical missing `expires_at` filter** (`person-footprint.ts:81-91`; the
affiliation leg three lines above *does* filter `ended_on`). So an expired seat granted person-level
**WRITE** authority â€” `updateUserProfile`, `upsertCredential`, `removeCredential` â€” on the path D4 declares
has no RLS backstop. Not a read-only exposure at all.

â­ **The error is this file's own named class, committed in the sentence warning against it.** The body
below still says *"anyone closing this item on 'expiry is already handled' has quoted a real filter for a
conclusion it does not bound"* â€” and the bounding claim above did exactly that, citing D1/D2 as a separate
boundary while they run through the unfiltered resolver. Written by the lead; found by QA when asked
whether any residue was understated.

âš– **PO-ruled 2026-08-23: FILTER the resolver** (ADR 0133 **Amendment 4** r1). That closes the write half â€”
one line plus a red-first keystone (an expired-membership-only target must be DENIED `fields` and
`credentials`). â›” It does **not** conflict with Amdt 2 r3: that ruling barred the two **RLS policies** from
disagreeing *with each other*; this is the **write** resolver, and a resolver stricter than the read
policies is the read-wider-than-write asymmetry Amdt 2 r2 already established.

âš  **What REMAINS open, and it is genuinely the READ half only:** the two `profiles` policies and the B2
`professional_credentials` policy still carry no expiry filter, so an expired seat still admits a **read**.
That is the original question â€” answerable only for all of them at once. â›” **And the answerable set is
THREE authorities, not two**: this item said "both policies"; B2's membership leg is a third, and the
resolver was a fourth until Amdt 4 settled it.

â›” **Reachability, measured (QA):** `memberships` rows with a non-null `expires_at` = **0 of 43**, and no
app path writes one. But `public.grant_role` is DEFINER, `authenticated`-executable and takes
`p_expires_at`, refusing only an already-past value â€” so a future-dated grant that later lapses **is
constructible through the API**, though not through the UI. â­ Pre-AFF2 the same unfiltered read existed and
bought nothing person-level; **AFF2 is what monetised it.**

**Note the caller-side filter does NOT cover this.** `app.has_role` filters `expires_at` on the
**admin's own** membership â€” their hat. It says nothing about the **target's** membership, which is
what this leg tests. Anyone closing this item on "expiry is already handled" has quoted a real filter
for a conclusion it does not bound.

**To decide:** whether "active" should mean `expires_at IS NULL OR expires_at > now()` on the
membership legs of **both** policies, in one deliberate change with its own diff-scoped `ARM=policy`
sweep â€” or whether the authorities' wording should be corrected to match the implemented behaviour.
â›” Never smuggled into a feature migration; `profiles` is a swept surface and the AFF2 plan's own risk
list forbids widening it "while we're here".

### ðŸŸ¡ FUP-MANAGE-ROUTES-HAVE-NO-ERROR-BOUNDARY â€” a render failure in the org-admin console destroys the user's entire navigation (owner: frontend; filed 2026-08-23, found incidentally while AFF2 built `usuarios/error.tsx`)

**Measured 2026-08-23 by resolving each route's NEAREST ancestor boundary** (not by checking for an
`error.tsx` in the same directory â€” that method mis-reports covered children as gaps). Ten route
segments under `o/[org]/manage` have no boundary between themselves and **`src/app/error.tsx`**, the
root: `manage` itself, `acreditacao`, `audit`, `comissoes`, `documentos`, `hospitais`,
`hospitais/[hospitalId]`, `indicadores`, `painel`, `tipos-de-caso`.

There is **no `error.tsx` at `manage/`, at `o/[org]/`, or at `o/`** â€” so the root boundary is what
catches them, and it replaces the entire tree. The user loses the sidebar, the org switcher and the
DSR "Direitos do Titular" console entry, and is left on an error page with **no navigation at all**.

â­ **This is a gap, not a design choice, and the sibling census is what shows it:** of the 14
`manage` segments carrying a `page.tsx`, **four** have their own boundary â€” `administradores`,
`comissoes/[commissionSlug]`, `equipe-nsp`, and now `usuarios`. A convention that is followed a
quarter of the time is an omission with survivors, not a decision.

**AFF2's contribution, and its bound.** AFF2 added `usuarios/error.tsx` (`1eefc90e`), which also
covers `usuarios/[userId]` and `usuarios/novo` â€” a segment boundary catches its descendants, so those
two are **not** in the list above despite having no file of their own. â›” **The other ten are
pre-existing and OUT of AFF2 scope.** Do not smuggle the fix into the workstream; it touches nine
route groups the workstream has no business editing, and the plan's own risk list forbids exactly this
kind of "while we're here" widening.

## â›” AMENDED 2026-08-23, before anyone built it: **it is TWO files, and the one this FUP originally named is the LESS important one**

Filed as *"cheapest fix: one `manage/error.tsx`"*. That is **wrong as a close condition** â€” built and closed
as written, it would leave the highest-blast-radius case open, which is the recorded *a partial fix reads as
a complete one* shape. Found by `frontend` while checking the scope claim of their own commit.

**`manage/error.tsx` cannot catch `manage/layout.tsx`.** From **this version's** own docs â€” read at
`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md:96`, not from memory, per
CLAUDE.md's "this is NOT the Next.js you know":

> `error.js` wraps `loading.js`, `not-found.js`, `page.js`, and nested `layout.js` files in a React error
> boundary. It does **not** wrap the `layout.js` or `template.js` above it in the same segment.

**Why the layout is the case that matters most.** `o/[org]/manage/layout.tsx` awaits
`getSessionContext()` (:33) and, in one `Promise.all` (:77â€“82), `getRawGrants()` and
**`listMyDsrHospitals()`**. A throw in any of them takes down **every `manage` route at once**, not one
segment â€” and `listMyDsrHospitals` is the **newest** of the three (DSR shipped beside AFF2), so the
least-exercised code sits in the widest-blast-radius position on the whole surface.

**The file that closes it is `o/[org]/error.tsx`** â€” a boundary in a segment strictly *above* `manage`.
âœ… **Verified there is no further hidden layer** (the same partial-fix trap, one level up): the only layouts
on the chain are `src/app/layout.tsx` and `o/[org]/manage/layout.tsx` â€” **`o/layout.tsx` and
`o/[org]/layout.tsx` do not exist** â€” and the root layout is already covered by `global-error.tsx`. So two
files genuinely close it; there is no third.

âš  **Bounds AFF2's own commit honestly:** `usuarios/error.tsx` (`1eefc90e`) does **not** cover
`manage/layout.tsx` either. That is a stated limit in the file's scope comment, not coverage.

âš  **Written, not exercised.** Nobody has thrown from `manage/layout.tsx` to watch where it lands. The docs
are unambiguous and the ancestor walk is mechanical, but this carries the same *written-not-verified* label
as the boundary that prompted it.

**Build order if only one happens: `o/[org]/error.tsx` first.**

**The original (still true, but secondary): a `manage/error.tsx`** A single boundary at the `manage` segment covers all ten at
once and leaves the four existing per-route boundaries to take precedence where they exist. âš  It must
follow the constraints AFF2's own boundary established: **nothing from the `error` object reaches the
screen** â€” not `message`, not `digest`, not a code, because a Postgres error string can carry table,
column and constraint names (CLAUDE.md Â§8: raw errors never reach the UI); a `reset()` retry as the
primary action; a second action that is a **different route** from the one that failed (a link back to
the page you are already on may not navigate at all); and focus moved to the heading on mount, since
React swaps the tree in place with no navigation and a keyboard user is otherwise left focused on a
control that no longer exists.

âš  **Unverified is not verified.** AFF2's boundary is committed lint-green and `tsc`-clean but has
**never been exercised by a thrown render** â€” the one file whose entire job happens in a state no
static gate can reach. Whoever builds `manage/error.tsx` should verify both.

### ðŸŸ¡ FUP-WAITFORURL-SATISFIED-BY-ITS-OWN-STARTING-URL â€” a wait that is already true does not wait, and fails somewhere else (owner: tester/lead; filed 2026-08-23, found by `tester` sweeping their own fix)

`e2e/aff-hospital-affiliation.spec.ts:764` (AFF-K, the keyboard test) does:

```ts
await page.keyboard.press('Enter')                              // client-side nav FROM /usuarios/novo
await page.waitForURL(/\/usuarios\/[^/]+$/, { timeout: 10_000 })
```

The starting URL **`/â€¦/usuarios/novo` already satisfies that pattern** â€” `/usuarios/` followed by one or more
non-slash characters, then end. So the wait resolves **immediately, with zero navigation**, and the test races
ahead of the real transition.

â­ **The class, which is the reason this is filed rather than shrugged at: the symptom appears somewhere else.**
The same mistake elsewhere in this sweep did not fail at the wait â€” it failed one step later with a misleading
*"person not found in search"*, sending the reader to look at search. A wait that no-ops is invisible at the
place it is wrong.

âš  **It is GREEN today, and that is the problem.** Nothing interrupts it with a fresh `page.goto` before the next
assertion, whose own 10 s timeout absorbs the real navigation's delay. So it passes while **racing silently** â€”
the precise shape that becomes an unattributable flake months later, on a slower machine or a colder compile.

**Swept, so the boundary is known rather than assumed:** **9** loose `[^/]+` forms remain across `e2e/`
(`aff-hospital-affiliation` Ã—3, `hospital-admin-tier` Ã—1, `user-registration` Ã—5). **Eight are safe by
structure** â€” each is a `card.click()` from `/usuarios?search=â€¦`, and that URL has **no slash after
`usuarios`**, so the pattern cannot match it. Verified on three of the eight by reading the preceding lines,
not inferred from the count. **`:764` is the only one whose starting URL matches.**

**Fix:** the positive form `/\/usuarios\/[0-9a-f-]{36}$/i` â€” assert what the destination **is**, not merely
what it is not.

â›” **Pre-existing and out of AFF2's scope.** `tester` found it while sweeping a bug of their own making, and
correctly declined to fix it: the file is fully green and untouched by this workstream. **How to apply beyond
this instance: a `waitForURL` pattern must be checked against the STARTING url, not only the destination.**

### ðŸŸ  FUP-E2E-PIN-RECORDS-COUNTS-NOT-IDENTITIES â€” the baseline can only be diffed arithmetically, and the evidence is destroyed before anyone can check (owner: tester/lead; filed 2026-08-23, found when the AFF2 gate tried to compare flaky tests by identity)

The `e2e:prod` declare-green step works by diffing a run against a **pinned baseline**. AFF2's pin is the
2026-08-23 run at `d885f621`: *"1185 p Â· 2 f Â· 2 flaky Â· 8 DNR Â· 20 batches"*. When AFF2's own run also
produced **2 flaky**, the obvious reading is parity. It is not a reading anyone can justify.

**Two measured facts, which together make it unknowable:**
1. **No document names the pin's flaky tests.** The Test Run Summary row says *"2 flaky"*; the triage doc it
   links (`case-split-assertion-integrity.md`) details the two **failures** and contains **zero** occurrences
   of the word *flaky*. The identities were never written down.
2. **The raw logs cannot supply them either.** `scripts/e2e-prod-gate.sh:57` sets
   `GATE_LOGDIR="${TMPDIR:-/tmp}/e2e-prod-gate"` with batch files named **`batch-N.log`**. The directory is
   **not run-scoped**, so every run overwrites the previous run's logs *by batch number*. Both runs happened
   on 2026-08-23, so AFF2's `batch-1.log` overwrote the pin's before anyone thought to look.

â›” **So "2 then, 2 now" establishes same-COUNT and nothing about same-IDENTITY.** That is the
*a total that matches is not a list that matches* trap â€” hit twice already this week â€” except here it is
**built into the instrument** rather than into one person's enumeration. AFF2's two were named
(`act-role-assumption.spec.ts:157` and `phase2-auth-shell.spec.ts:268`, both pre-existing session/auth specs,
neither in any AFF2-touched file, both recovered on retry); the pin's two cannot be.

âš  **The consequence is permanent, and worth stating flatly: a NEW flake and a RECURRING one are
indistinguishable in the gate record.** A run that silently trades two stable tests for two newly-unstable
ones reports as parity. Flakiness is precisely the property that needs identity tracking, because its
**count** is the one thing about it expected to vary run to run.

**Fix â€” two small changes, neither urgent:**
- **Name flaky tests (file + title) in the Test Run Summary row**, not just the count. Nothing else has to
  change for a pin to become diffable.
- **Make `GATE_LOGDIR` run-scoped** (a timestamp or commit sha in the path) so a run's evidence survives the
  next one. âš  The script already reasons carefully about `batch-N-unrun.log` stubs at `:366-368`; the
  **cross-run** collision was simply never considered.

â­ Found because `tester` was asked to compare by identity and **reported it as unverifiable rather than
assuming parity**. The honest answer is what produced the finding â€” a confident "same two, parity" would have
closed the question and left the instrument broken.

### ðŸŸ¡ FUP-AFF2-REGISTRATION-HAS-NO-START-DATE â€” a plan deliverable was dropped, and the tracker said it shipped (owner: backend then frontend; filed 2026-08-23 at the AFF2 post-Record documentation review)

`registerUser` accepts **no affiliation start date**. The AFF2 plan specifies one â€” F3 step 2,
`docs/plans/aff2-user-management.md`: *"Hospital â€¦, MatrÃ­cula, **Data de inÃ­cio**"* â€” and the sibling
action on the existing-person path, `affiliatePerson`, **does** accept one. So the asymmetry is in the
**actions layer**, not in the UI: `RegisterUserInput` (`src/lib/users/actions.ts`) has no such field, and
`register-person-wizard.tsx:59` still carries the comment marking the insertion point.

**Behaviourally this costs nothing today.** A person registered today starts their affiliation today,
which is the correct default. â›” **The defect is the RECORD, and it is the reason this item exists.**
`docs/progress/aff2.md` Â§ F3 enumerated three blocked deliverables â€” DOB/phone Â· **start date** Â· redirect
â€” and the next block announced *"âœ… **ALL THREE CLOSED**"* over three bullets that were DOB Â· phone Â·
**redirect**. Item 2 left the list while the count stayed at three. Anyone checking whether the start date
shipped would have found a green claim.

â­ *A total that matches is not a list that matches* â€” this workstream's own recorded lesson, and it landed
**in the workstream's own record**, which is what makes it worth a line rather than a shrug. Found by QA
(R3). The closure text was corrected at the Record step; **filing the dropped deliverable is the other half
of QA's discharge condition** (*"either build the field or file it"*), and it had not been done.

**Fix:** add `affiliationStartedOn?: string | null` to `RegisterUserInput`, pass it through to the
affiliation insert, and render a `DatePicker` in wizard step 2 defaulting to today. One field, one
pass-through, one control. **Do not close this by deciding the default is fine** â€” that decision is
already recorded and is not what is open; what is open is that `affiliatePerson` and `registerUser`
disagree about whether a start date is expressible.

### ðŸŸ¡ FUP-AFF2-UPDATE-PROFILE-AFFILIATION-HALF-IS-DEAD â€” the looser entry gate is justified by a path no caller takes (owner: backend + PO decision; filed 2026-08-23 at the AFF2 post-Record documentation review)

`updateUserProfile` takes `authorizeForUser` â€” the **no-tier, no-subset** gate â€” as its entry authority,
and the reason is written into the code: *"a hospital_admin may still reach this action, because the
AFFILIATION half of it is legitimately theirs (matrÃ­cula at their own hospital)."*

**Measured (QA R5): no caller exercises that half.** `updateUserProfile` has exactly one caller in `src/**`
â€” `UserProfileEditForm` â€” and its payload never sets `homeHospitalId` or `hospitalEmployeeId`. AFF2's F2
moved employment facts to `AffiliationsPanel`, which goes through its own door. So the home-hospital
validation and `ensureActiveAffiliation` inside `updateUserProfile` are reachable only by a hand-crafted
server-action call, and the Vitest arm *"a hospital_admin editing ONLY the matrÃ­cula is ALLOWED"* pins a
path the product cannot produce.

â›” **Not a hole, and must not be filed as one** â€” `affiliate_person_for` re-derives authority in PostgreSQL,
and the per-capability gate inside the action is what actually bounds the write. This is a **decision owed**,
not a defect.

**The decision:** with the affiliation half dead, the entry gate could tighten to
`authorizePersonScopedAdmin('fields')`, which **shrinks the blast radius of the R1 class for free** â€”
R1 was an over-grant that survived precisely because the entry gate was permissive and the real bound sat
deeper. Against that: the affiliation half may be re-wired to a caller later, and tightening now makes that
a two-step change. âš  **Whoever rules on this must also decide what happens to the Vitest arm** â€” a keystone
pinning an unreachable path is the *"a keystone proves the door, a second caller proves nothing about the
real one"* shape, and silently deleting it would remove the only assertion covering the loosening if the
half is ever revived.

### ðŸŸ¡ FUP-VITEST-CATALOG-DRIVEN-CASE-COUNT â€” two suites generate their cases from the LIVE catalog; pin the role SET so a mid-reset read cannot shrink coverage silently (owner: backend + frontend)

> **Raised 2026-08-23**, during ADR 0137's batch, from a vitest total that moved
> **1684 â†’ 1677 â†’ hard-fail â†’ 1684 with no source change on either side.**

**The property.** Two unit suites read `public.memberships_role_check` from the LIVE database
**at module import** and generate one test per role returned:

| File | Helper | Generating blocks |
|---|---|---|
| `src/lib/queries/session-grants.test.ts` | `readRoleVocabularyFromCatalog()` at `:71` | `it.each(...)` at `:233` â€” **1** |
| `src/components/shell/nav-scope-exclusivity.test.ts` | its own copy at `:74` | `it.each(ROLES)` at `:262` **and** `:289` â€” **2** |

So the dynamic surface is **3N** for N roles, and `npm run test`'s total is a function of DB state
rather than of the code. âš  The other role-shaped lines in `session-grants.test.ts` (`:228`, `:257`,
`:275`) are `for` loops **inside one test** â€” they change what an assertion iterates, not how many tests
exist. Blocks are the unit, not files.

**What is already safe, and must not be re-litigated.** Coverage cannot shrink **durably**:
`supabase/tests/292_session_context.sql` pins the vocabulary bidirectionally â€” Â§3.1 reds when the CHECK
admits a role the hand-declared `role_scope` map does not name, Â§3.2 reds when the map names a role the
CHECK no longer admits. A role genuinely disappearing reds `npm run test:db`.

â›” **The residual, and the whole reason for this item: Â§292 structurally cannot see the TRANSIENT
window.** The two gates read the same database at different times. `memberships_role_check` is created
by one migration and rebuilt by later ones, so a reset passes through a period where the constraint is
**present and valid but partial**. Run `npm run test` inside that window and `test:db` after it, and
vitest generates fewer cases, reports a tidy green, and nothing correlates the two. That is the failure
actually observed above.

## The fix

Assert the role **SET** in both files, against one shared literal:

```ts
expect([...CATALOG_ROLES].sort()).toEqual(EXPECTED_ROLES)
```

- **A set, not `.length`.** A count misses a **substitution** â€” one role removed and one added leaves
  the length identical while every generated case silently changes subject. A one-sided check passes
  when too much changed, not only when too little did.
- **`EXPECTED_ROLES` in ONE shared module**, imported by both files â€” never a literal pasted into each.
  The helper is already duplicated; a second duplicated literal would give four written copies of the
  vocabulary and two fresh drift paths.

â›”â›” **THE SHARED MODULE MUST EXPORT A FUNCTION, NEVER A TOP-LEVEL `const`.** This is the prohibition the
item exists for, because the change that breaks it looks exactly like tidying.

The helper's **logic** and its **invocation count** want opposite treatment:

- the copy-pasted **logic** is a real defect â€” two independently-maintained regexes over
  `pg_get_constraintdef` can drift with nothing to catch it. Collapse it to one definition.
- the two independent **reads** are a **FEATURE** once each is pinned to the same literal. Two reads
  that must both equal one constant make a catalog change *between them* detectable â€” which is the
  transient window above. Collapse them and the only instrument that can observe it is gone.

So: **one logic definition, two call sites.** Each test file keeps its own top-level
`const ROLES = readRoleVocabularyFromCatalog()` and asserts it against the shared `EXPECTED_ROLES`.

âš  **Why a module-scope `const` is the trap â€” stated carefully, because the obvious reason is
config-dependent.** A `const` evaluated at module scope makes *how many times the catalog is read* an
emergent property of the runner's isolation/pool settings rather than a decision any author made: with
per-file isolation each file re-evaluates it, without isolation the module registry is shared and the
reads collapse to one per worker. â›” **Measured: `vitest.config.mts` pins NEITHER `pool` NOR `isolate`**
(no `poolOptions` anywhere), so the behaviour is inherited from the installed Vitest's defaults
(`^4.1.8`) and can change under a version bump or a perf tweak by someone who has never heard of these
tests. **This has NOT been measured empirically** â€” only the absence of the config has. An exported
function needs none of that reasoning to be safe: each read is explicit and reviewable at its call site,
and the count stops depending on a knob.

**The triangle this closes.** Â§292 ties CHECK â†” `role_scope`; the new assertion ties CHECK â†” literal;
and two reads that disagree cannot both equal the same constant. Any divergence reds somewhere.

## â­ The methodology note, which is the transferable part

**Both enumerations of this property were wrong, in mirrored directions, and neither was settled by the
grep:**

- **Under-report from a syntax bound.** The first sweep was `execFileSync|execSync` and named *files*
  ("two suites") when the moving unit is *generated blocks* (three).
- **Over-report from a widened bound.** The corrective sweep added `spawnSync`, `child_process`,
  `psql`, `docker exec` and `pg` client imports across `src/` **and** `e2e/`, and produced a third
  candidate â€” `src/lib/queries/print-source-vectors.test.ts`. It is a **false positive**: it matched a
  comment about `pg_prove` globbing and a `.psql` **filename**, and it `readFileSync`s a committed JSON
  fixture. Its case count is a function of a **version-controlled file** â€” diffable and reviewable â€” not
  of DB state. A different property entirely.

Both were resolved by **opening the candidate and reading it**. A syntax bound over-reports as readily
as it under-reports, and widening one does not convert it into a property.

âš  **Do not record a vitest test COUNT as gate evidence for this repo.** It is a property of the tree's
database at an instant. The durable claim is pass/fail, on a fresh `supabase db reset`, with the stack
up. (`test:db` counts *are* stable â€” pgTAP plans are literal.)

â­ **Credit, because it is the reason this was a conversation rather than a silent green:** the helper
fails CLOSED â€” with the stack down it throws *"this guard reads the catalog on purpose and must never
silently skip"* instead of defaulting to a hardcoded list. Preserve that behaviour through any refactor.

### FUP-DSS-STANDALONE-ROUTE-DISABLES-SUBMIT

✅ **RESOLVED 2026-08-24 — shape (a), the narrower fix, as this entry preferred.**

- `getResponseForFill` now projects `case_phase_id` (`ResponseForFill.casePhaseId`), and the
  standalone route `notFound()`s a response whose lane is not its own. The guard sits BEFORE the
  `submitted` branch, so it holds at every status.
- ⛔ **(a) is not one line, and the entry did not say so.** Two live links fed that route with a
  case-phase draft and would now 404 instead of showing a dead button — measured, not guessed:
  `listFillableForms`' "Continuar" annotation (its draft lookup had no lane conjunct) and
  `MyResponseCard`'s in_progress row. Both are lane-filtered in the same change; SUBMITTED
  case-phase rows stay in "Minhas respostas", because their link is the lane-agnostic read-only
  viewer that also carries the respondent's own PDF path.
- ⭐ **And a third feeder was a DATABASE defect, found by following the same thread.**
  `start_or_resume_response`'s resume query selected any `in_progress` response for
  (version, caller) while `responses_one_draft_per_user_idx` — the index it defers to on the CREATE
  path — carries `AND case_phase_id IS NULL`. So "Preencher" on the standalone form handed back the
  caller's CASE-PHASE draft. Fixed in migration `20261003002000`; the state is **not in `seed.sql`**
  (no `in_progress` case-phase response exists there), so it was CONSTRUCTED and pinned red-first in
  pgTAP `367` §15 — 15.1 failed against the old body and passes against the new one, 15.2 pins that
  the fix adds a standalone draft rather than hijacking the phase draft.
- Keystone: `e2e/deferred-staff-signoff.spec.ts` — "the standalone forms route refuses a CASE-PHASE
  response, and only that". THREE assertions, because "it 404s" is also true of a route that 404s
  everything and of a response the caller cannot read: the same response walks its OWN route (renders),
  and a STANDALONE draft of the same user on the same route and version renders too. Only the lane
  differs across the three.
- ⚠ It runs on its OWN throwaway fixtures. An earlier draft drove the SHARED response's wizard, which
  left it resumed at a later section and reddened the submit test two tests down — rendering a wizard
  is not a read-only act.

---

⚠ **NEW — created by the ADR 0136 increment.** Filed 2026-08-24 (lead), from the build's own
route census, not from a failing test.

`WizardData.deferStaffSignoff` is resolved on **one** of the three routes that render the wizard —
`…/cases/[caseId]/phase/[phaseId]/responder/[responseId]`. The standalone
`…/forms/[formId]/responder/[responseId]` route takes the parameter's `false` default.

**And that route is not structurally prevented from serving a CASE-PHASE response.** Measured:
`getResponseForFill` filters on `id` alone (`src/lib/queries/responses.ts:816-823` — no
`case_phase_id` predicate), and the page's guards are `formId` + `commissionId` + `status`, all of
which a case-phase response satisfies (its form IS `formId`, its commission IS the caller's). So the
same response renders with a DISABLED submit on one route and an ENABLED one on the other.

✅ **Not a security defect, and the direction matters:** the divergence is strictly MORE restrictive
— the standalone route refuses a submit the database would accept. Nothing is granted anywhere.

⛔ **But it is a divergence that did not exist before this increment.** Until now both routes agreed
because neither knew about case phases. It is reachable by hand-editing a URL the assignee already
sees, and it presents as "the button is dead for no reason".

**Decide between:**
- **(a)** the standalone route `notFound()`s a response whose `case_phase_id` is non-null — the
  narrower fix, and arguably right independently: that route's copy, back-link and confirmation
  screen are all written for the standalone lane; or
- **(b)** it resolves `deferred_staff_signoff` too and passes it through.

⭐ (a) is preferred: it removes a whole class of "which route am I on?" divergence rather than
keeping two routes in step forever. ⛔ Either way it needs a keystone — today NOTHING asserts which
lane that route serves.

**Owner:** frontend (with a backend one-liner if (a) needs a `case_phase_id` projection).

---

### FUP-DSS-PENDING-SIGNOFFS-WALKTHROUGH-KEYSTONE

✅ **RESOLVED 2026-08-24 — pgTAP `367` §13, 13 assertions.**

⛔ **The shape this entry asked for could not pass, and that is the finding.** The eleven siblings
owe "the outsider reads 0 rows through this door". `app.pending_staff_signoffs` has **no identity
predicate at all**, so it returns the SAME rows to every caller by construction — an
outsider-reads-0 assertion would have been FALSE, and making it true would have meant bolting a gate
onto a helper whose four callers each already gate.

So the boundary is walked where it lives:
- **13.1–13.3** pin the caller-blindness AS DESIGNED (coordinator, respondent and a non-member
  staff_admin all read the same 1 row) — so a gate added later without moving the backlog record
  reds here.
- **13.4–13.9** walk every principal through the two consumers: `get_response_for_signoff` (refuses
  with `P0002`) and `list_signoff_queue` (returns empty). The respondent — who OWNS the response —
  is refused too: the read right is the act of signing, not authorship.
- **13.10–13.12** are the differential: after the section is signed all three read 0, which is what
  proves 13.1–13.3's "1" tracks the live projection instead of a constant.
- The outsider is `sa_y` (same org, same hospital, other commission), never an org-B user — a fully
  foreign principal is denied by the tenant boundary before this door's gate is reached.

⭐ **Drilled RED, both consumers at once**: opening the authorization gate of
`get_response_for_signoff` and `list_signoff_queue` (each `if not (...)` → `if false and not (...)`)
reds exactly 13.5, 13.6, 13.8, 13.9; the restore was byte-compared back. ⚠ 13.1–13.3 are NOT
mutation-proven — narrowing the projection to `where false` reds §2/§3 first and the file aborts at
test 23, never reaching §13. Their non-vacuity is structural (13.10–13.12), and saying which of the
two it is matters.

---

⚠ **NEW — an owed keystone the ADR 0136 increment did not discharge.** Filed 2026-08-24 (lead).

`app.pending_staff_signoffs(uuid)` is a `SECURITY DEFINER` set-returning function with **no identity
predicate at all**. `ARM=census` flagged it never-swept the day it landed;
`p0-authz-rowdoor-audit.sh` was run over it and returned **UNSUPPORTED** — *"no statement-level
identity guard — the gate is a conjunct inside the query"* — which is structurally exact. It is
recorded in `supabase/tests/mutation/authz-unswept-backlog.txt` under the UNSUPPORTED block.

⛔ **It is deliberately NOT filed under `helper:`.** A `helper:` line asserts "not an authorization
decision"; this one IS an input to one — `get_response_for_signoff` uses its emptiness as the
read-right scope (*"the read right is scoped to the act of signing"*).

✅ **BEHAVIOUR is pinned and DRILLED** — pgTAP 367, drills 2026-08-24 RED in **both** directions
(narrowing to `where false` reds 7 assertions; dropping the already-signed conjunct reds 6).

⛔ **That is not the same thing, and the gap is the point of this entry:** a behaviour drill asks
"does anything notice when the projection changes?". The keystone this class owes asks "does the
projection return the same rows to a principal who should see NOTHING?" — a **computed enumeration
plus a row-count assertion per principal**, in the shape of
`supabase/tests/299_hospital_content_door_noun_rule.sql` §4 (worked example:
`300_rowdoor_gate_keystones.sql`). It is the twelfth entry in that block; the eleven before it owe
the same thing.

**Owner:** backend.

---

### FUP-DSS-SIGN-SECTION-INVOKER-VERDICT-STALE

✅ **RESOLVED 2026-08-24 — and the honest re-run said BLIND, not COVERED.**

`CASES="sign_section" p0-authz-invoker-audit.sh`, fresh reset, baseline `Files=218, Tests=7226,
PASS`: **BLIND**, `open-guard(g1=0,g2=0,g3=1)`. ⛔ **Both halves of the old row were stale** — the
verdict AND the guard class it was about. ADR 0136 rewrote the lifecycle guard to
`if v_status <> 'in_progress' and not app.is_signoff_deferral_open(...)`, which moved the opened
guard from class G1 to class G3.

⭐ **Hand-classification, which the PROVISIONAL note asked for and nobody had done: none of this
wrapper's `if` guards is the authorization gate.** They are a domain probe, a lifecycle window and
two shape checks. `sign_section` is INVOKER, so the authorization decision is the RLS `WITH CHECK`
on `response_section_signoffs.signoffs_insert` (`signed_by = auth.uid() AND app.can_sign_section(...)`),
which the INSERT reaches as the caller — COVERED independently by the write-path sweep
(`251_authz_p0_isolation.sql`) and by the predicate arm (`app.can_sign_section`). The BLIND was
therefore about the LIFECYCLE guard, and it was real: `367` §5 pinned that bound by calling the
PREDICATES directly, and a predicate call is not a walk through the door.

⛔ **THE FIRST FIX DID NOT WORK, AND WHY IS THE LESSON.** `367` §14.1 walked the door and asserted
`throws_ok(..., '23514')` — and the sweep still returned BLIND. **The second lock:** the INSERT
trigger `guard_submitted_signoffs` shares the very same `is_signoff_deferral_open` window and refuses
with `errcode = 'check_violation'` — **the identical SQLSTATE**. A matcher keyed on the code alone
passes whichever lock fires and cannot notice the first being removed. §14.1 is now pinned to the
wrapper's own MESSAGE. Verdict after that: **COVERED**, earned by the keystone with the sweep as its
own oracle. ⚠ Two locks are good; a keystone that cannot say which one held is not.

---

⚠ **NEW — a verdict this increment invalidated and did not re-derive.** Filed 2026-08-24 (lead).

`docs/reviews/authz-invoker-audit-findings.md:100` carries:

```
public.sign_section(…) | invoker | open-guard(g1=1,g2=0,g3=0) | COVERED
  | ⚠ g1-only: PROVISIONAL, hand-classify (the opened probe may be a domain check, not the gate)
  — 226_notifications.sql
```

The ADR 0136 increment **changed that function's gate**: its `if v_status <> 'in_progress' then raise`
became `if v_status <> 'in_progress' and not app.is_signoff_deferral_open(p_response_id) then raise`.

⛔ Two separate problems, and the second is the one that bites:
1. The COVERED verdict was measured against the OLD body. `FROMFINDINGS=1 ARM=wrapper` passed at the
   gate — but that mode compares a **committed findings file** to an allowlist and re-measures
   nothing, so a changed body is invisible to it by construction.
2. The verdict was **PROVISIONAL to begin with** and carries an explicit `hand-classify` instruction
   that nobody has executed. A provisional COVERED reads as COVERED in every downstream summary.

⭐ This is the ADR-0079 lesson one arm over: *absence of a verdict is not absence of coverage* — and
a **stale** verdict is worse than an absent one, because the census counts it as satisfied.

**Do:** re-run the invoker sweep scoped to `sign_section` (`p0-authz-invoker-audit.sh`) and
hand-classify the g1 probe, recording WHICH of the three guards is the authorization gate. ⚠ Restore
the findings file after a subset run, as with the door sweep.

**Owner:** backend.

---

### FUP-DOOR-AUDIT-PREDICATE-ARM-BOUNDED-BY-A-NAME

✅ **RESOLVED 2026-08-24 — shape (c), widen by PROPERTY. ADR
[0079](../decisions/0079-authz-door-blindness-standing-invariant.md) Amendment 9.**

⭐ **(b) turned out to be already done, measured before choosing:** all 42 out-of-domain booleans
were already listed in `authz-unswept-backlog.txt`, so the "cheap half" bought nothing. And the
script's stated reason for refusing (c) — *"the out-of-domain set contains two SIDE-EFFECTING
writers"* — is an argument about widening by TYPE, not by property: of the 42, exactly **9** have a
body referencing an identity primitive, and one of those 9 IS `remind_document_approver`. The
property filter separates the gates from the writers, which the type filter could not.

- Domain: **102 → 110**; out-of-domain **42 → 34**. The two writers are held out BY NAME with the
  reason written at the exclusion, and stay VISIBLE in the census.
- The domain is now ONE interpolated string instead of two hand-kept copies of the same SQL — the
  census's `not (…)` is the same string, so the two cannot drift.
- **8 gates swept, fresh reset, baseline `Files=218, Tests=7223, PASS`: 6 COVERED · 1 BLIND · 1
  ERROR.** New follow-ups for the last two: `FUP-RCA-WRITER-CAN-WRITE-IS-BLIND` and
  `FUP-DOOR-SWEEP-BROAD-GATE-ABORTS-A-FILE`. `member_can`/`member_can_for` — the pair whose `CASES=`
  run once executed zero cases and printed `BLIND: 0` — are **COVERED**, held by 12 and 40 files.
- ⚠ It is still an approximation, and the census says so on every run: a gate reaching identity only
  INDIRECTLY is outside the arm and looks like a feature-flag reader from there.

⛔ **A measurement lesson, recorded in the amendment because it nearly shipped as a finding:** it
took THREE runs to get a trustworthy answer. Run 1 was contaminated by the operator editing a pgTAP
file mid-sweep; run 2 was a quiet tree with **no fresh reset** and still got 6 of 8 verdicts wrong.
**A green baseline is not evidence the database is fit to mutate** — the preflight proves the tree
unmutated, and says nothing about whether residual state will make a file ABORT once a gate opens.

---

⚠ **The harness names this class in its own output and it has never been REGISTERED anywhere** —
verified 2026-08-24: zero hits in `follow-ups.md` and `PROGRESS.md`, two in
`supabase/tests/mutation/p0-authz-door-audit.sh` (`:315`, `:393`). Filed by the ADR 0136 increment,
which is the first recorded instance of it actually costing something.

The door sweep's predicate arm bounds its domain with a **name regex** —
`^(is_|can_|has_|referral_target_analyst|attachment_confidentiality_ok)`, minus `^is_valid_` —
standing in for the property *"is an authorization predicate"*, which no regex decides. The script is
honest about this: it censuses the gap on every run and refuses to auto-widen (widening would swap a
silent gap for silent ERRORs — the out-of-domain set contains feature-flag readers, `validate_*`
shape checkers, and two SIDE-EFFECTING writers whose bodies must not be swapped for `select true`).
**Measured 2026-08-24: `out-of-domain-bool=42`.**

⭐ **THE LIVE INSTANCE.** ADR 0136's new predicate was first written as `app.signoff_deferred_open`.
`ARM=census` flagged it never-swept; the diff-scoped sweep then matched **ZERO gates** and reported
`UNPROVEN — NOTHING WAS MEASURED`. The function was shaped exactly like a predicate and excluded
purely by its name. It was **renamed** to `app.is_signoff_deferral_open`, after which the same sweep
returned **COVERED**.

⛔ **The rename is a WORKAROUND, and it quietly created a new obligation:** the sweep's coverage now
depends on an unwritten naming convention that no gate enforces. The next authz predicate someone
names `signoff_x_allowed` or `phase_is_open` escapes the arm, and `ARM=census` will say so **only if
it is a `prosecdef` boolean** — which is the one arm that would then have to be read carefully rather
than skimmed.

**Decide between:**
- **(a)** a `lint`/pgTAP check that a `prosecdef` boolean in `app`/`public` either matches the arm's
  prefix set or appears in `authz-unswept-backlog.txt` — turning the convention into a gate;
- **(b)** classify the 42 out-of-domain booleans once, into `authz-unswept-backlog.txt`, so the census
  gap is a reviewable list rather than a count; or
- **(c)** widen the arm by PROPERTY (e.g. "references an authz predicate or `auth.uid()`") with the
  known side-effecting writers excluded by name — the script's own stated reason for not doing this
  is worth re-reading before choosing it.

⚠ **(b) is the cheap half of (a) and does not replace it:** a one-time classification goes stale the
next time someone adds a gate.

**Owner:** backend.

---

### FUP-DSS-KEYBOARD-FLOW-IS-THIN

✅ **RESOLVED 2026-08-24 — the test now SIGNS with the keyboard.**

`e2e/deferred-staff-signoff.spec.ts` — "keyboard-only: reach the queue row, open it, and SIGN — no
pointer": Tab to the queue row, Enter to open it, Tab to "Assinar", Enter, then assert the phase
reached `completed`. No `click()`, no `tap()`, and deliberately **no `locator.focus()`** — focusing
programmatically would step over a control the Tab order cannot actually reach, which is the defect
a keyboard test exists to find. The walk is bounded (60 presses) so an unreachable control fails as
a finding rather than hanging to the suite timeout.

⚠ **A SECOND fixture, on purpose.** Signing needs an unsigned frozen record and the pointer-driven
test above consumes the only one. Building a second case rather than converting that test keeps the
failure modes separable: a red here means the KEYBOARD path broke, not that signing broke. The
old test's assertion (the attested row LEFT the queue) is kept and now also guarantees the new
fixture is the only row the tab walk can land on.

⭐ **Found while fixing it — the spec's cleanup had never worked.** `afterAll` deleted the case
"and the cascade takes its phases + responses with it"; measured, `responses.case_phase_id →
case_phases` is **NO ACTION**, as are the two `→ form_versions` edges, and a submitted response
cannot be deleted at all (`submitted responses are immutable`). The deletes' status was never
checked, so it failed SILENTLY: three spec-owned forms, four cases and four responses accumulated
in one afternoon, and the symptom surfaced two tests away as a strict-mode violation on the sign-off
queue — which reads exactly like a product bug. Fixed by deleting in FK order, asserting every
delete except the two refusals that ARE product invariants, and RUN-SCOPING every name the spec
searches by so an undeletable leftover can never collide with a later run.

---

⚠ **NEW — a self-reported gap in this increment's own E2E.** Filed 2026-08-24 (lead).

CLAUDE.md §8 requires *"at least one keyboard-only flow per phase"*.
`e2e/deferred-staff-signoff.spec.ts`'s keyboard test asserts that the queue no longer lists the
attested row and that the first tab stop has an accessible name. **That is an a11y floor, not a
keyboard-only FLOW** — it never signs anything with the keyboard.

The act worth covering is the one this ADR creates: reach the queue row, open it, and **sign**, all
without a pointer — because that signature now concludes a case phase and releases everything
downstream of it, so a keyboard trap there is materially worse than one on a draft.

⛔ Recorded rather than quietly left, because a thin test in the *place the requirement points at*
reads as the requirement being met.

**Owner:** tester.

---

### FUP-RCA-WRITER-CAN-WRITE-IS-BLIND

✅ **RESOLVED 2026-08-24 — keystoned, re-swept COVERED, and its allowlist line deleted.**

**Built:** `142_rca.sql` §K — four assertions that call `public.rca_writer_can_write` **as each of
four principals** (PQS operator → true · assigned non-observer SME → true · OBSERVER → false ·
non-team non-PQS → false). The file already asserted the same four expectations, but against the
INNER `app.can_write_rca(rca, uid)` **uid-purely** — which is precisely why the wrapper was BLIND:
the wrapper takes only `p_rca_id` and resolves the caller through `auth.uid()`, so no uid-pure call
can reach it, and neutralizing it does not touch the inner predicate.

**Evidence — the sweep is the oracle, not review.** Diff-scoped `CASES="rca_writer_can_write"`
(ADR 0079 Amdt 1 recipe) on a FRESH `supabase db reset`: baseline `Files=218, Tests=7232, PASS`,
`ARM-DOMAIN predicate=1/110` (non-empty — not an UNPROVEN vacuous pass), **verdict COVERED, exit 0
read UNPIPED**. ⭐ **The attribution was measured, not assumed:** the neutralized run failed exactly
**one** file — `142_rca.sql` tests **10–11**, both by name, `have: true / want: false` — with run
shape identical to baseline. The two GRANT twins stayed green, which is correct for an
opening mutation and is what makes them twins rather than duplicates.

**Second, independent confirmation:** its line was deleted from `authz-neverclled-door-allowlist.txt`
in the same commit, so `ARM=floor` — which zeroes `pg_stat_user_functions` and runs the whole suite
itself — could only hold if the door is genuinely called now. It holds, and the counter reads
`rca_writer_can_write calls=4`, up from the 0 that put it on that list in July.

⛔ **CORRECTION to this follow-up's own prescription, recorded because it would have misdirected the
next reader.** It said the keystone owed the shape of `300_rowdoor_gate_keystones.sql` — "a row
count through the door, never a predicate call". **That shape cannot apply here and the keystone is
a predicate call by necessity.** That rule bounds ROW-RETURNING doors, where a correct predicate can
sit behind a door that forgets to consult it. Measured in `pg_policies` + `pg_proc`: **no policy and
no routine references this wrapper** — its one consumer is `src/lib/queries/rca.ts`
(`viewerCanWrite`). The boolean IS the door's entire output; there is no corridor of rows to count.
The two sibling probe doors the same widening scored COVERED are asserted exactly this way
(`121_interviews.sql`, `143_capa.sql` §M2). The prescription was carried over from the row-door file
without asking whether this door has rows behind it.

⛔ **What the COVERED does and does not say, since the filing was careful about this and the closure
must be too.** This is a **UI capability probe**. Opening it granted no write: the eight `rca*` RLS
policies gate on `app.can_write_rca` directly and the mutation never touched them. BLIND meant
*nothing would notice if it opened* — which is the only question the sweep asks — not *unprotected*.

⭐ **The mechanism worth keeping.** The allowlist line was not wrong when written: the door really is
exercised by E2E and not by pgTAP. But "never called by pgTAP, allowlisted with a rationale" is
**exactly the state that makes a door BLIND**, and then the floor arm and the door arm AGREE with
each other — and agreement reads as coverage. It sat that way from 2026-07-18 until a *different*
question was asked of it on 2026-08-24. A line in that file states WHERE a door is exercised; it
never states that it IS.

---

⚠ **NEW — the first finding produced by widening the door sweep's predicate arm.** Filed 2026-08-24,
by the sweep, not by review.

`public.rca_writer_can_write(p_rca_id uuid)` is a `prosecdef` boolean whose body reads
`auth.uid()`. Neutralizing it to `select true` — opening the gate — leaves the FULL pgTAP suite
GREEN: **218 files, 7223 tests, Result: PASS**, zero assertions reddened.

⛔ **It had never been swept in EITHER direction before**, because the arm's domain was a NAME regex
(`^(is_|can_|has_|…)`) and this gate matches none of it. It entered the domain with ADR
[0079](../decisions/0079-authz-door-blindness-standing-invariant.md) Amendment 9 and returned BLIND
on the first run. ⚠ **BLIND is not "vulnerable"** — it means no keystone exercises the gate, so
nothing would notice if it were opened. Whether it is reachable, and by whom, is the next question,
not a conclusion.

⛔ **BLIND blocks a phase (CLAUDE.md §6 step 1)** and the allowlist is NOT available here: that file
is for an unreachable backstop, and an RCA write gate is not one. It owes a keystone in the shape of
`300_rowdoor_gate_keystones.sql` — a row count through the door per principal, never a predicate
call, each denial with its non-vacuity twin.

**Owner:** backend.

---


### FUP-DOOR-SWEEP-BROAD-GATE-ABORTS-A-FILE

⚠ **NEW — a harness ceiling the same widening exposed.** Filed 2026-08-24 (lead).

`app.event_current_custodian` came back **ERROR**: `run-shape != baseline (Files=218 Tests=7199)`.
The cause is exact — with the gate open, `140_patient_safety.sql` fails its test 11 and then
**ABORTS** (`Bad plan. You planned 35 tests but ran 11`), so the denominator moves and §7.15
withholds a verdict rather than recording one against a run whose assertions did not all execute.

✅ **The harness is right and must not be loosened.** ⚠ But **ERROR here means *unclassifiable*, not
*unprotected*** — the suite plainly DID notice (test 11 reddened). ⛔ And it is not a pass either:
CLAUDE.md §6 requires ERROR to be covered in the phase's mutation audit.

⭐ **The class matters more than this one case.** Widening the arm by property admits BROADER gates
— capability resolvers, audit gates — and a broad gate is exactly the kind whose opening makes some
file abort. Expect more of these, not fewer, as the arm's domain grows.

**Decide between:**
- **(a)** a bespoke neutralization per case (what ADR 0079 Amendment 1 already prescribes for
  value-returning raise-guards) — precise, and it does not touch the classifier; or
- **(b)** teaching the classifier a fourth outcome for "shape moved AND the suite went FAIL", which
  is strictly more information than ERROR — ⛔ but it must never collapse into COVERED, because the
  failing assertions may belong to a different gate entirely.

**Owner:** backend.

---

### FUP-E2E-CREATEFRESHCASE-SILENT-NULL

âš  **PRE-EXISTING â€” not caused by ADR 0137.** Filed 2026-08-23 (tester) while auditing
`catch(() => null/[]/undefined)` sites for the ADR 0137 `case-patient` rewrite.

`e2e/case-narratives.spec.ts:192-207` â€” `createFreshCase(page, token)` resolves the M&M template via
`getMandMTemplateId` (itself a `.catch(() => null)` around `getPublishedTemplateVersion`), then calls
`create_case_from_template`. **Any failure along that chain â€” template not found, RPC non-2xx, malformed
body â€” returns `null`, with no thrown error and no logged reason.** Its only caller (verified: one call
site, `:193`) narrows on `if (!templateId) return null`, and the RPC branch likewise returns `null` on
`!resp.ok()`.

âœ… **Not currently masking a live regression** â€” the M&M template resolution it wraps touches no name ADR
0137 touched (verified separately from `BUG-E2E-CP-HELPER-COLLECTSPATIENT`).

â­ **But it is the same family, and that is why it is filed rather than left:** a test whose *setup*
silently degrades reads as *"this case genuinely has nothing to test"* rather than *"the fixture broke"* â€”
and **nothing distinguishes the two outcomes.** That is `lint:vacuous`'s own shape sitting outside what the
gate can trace into, because the vacuity lives in a helper.

**Decide between:**
- **(a)** throw with the underlying reason instead of returning `null`; or
- **(b)** keep null-on-failure but require **every** caller to assert non-null with a message naming the
  failure mode â€” mirroring the `restGet` / `expect(resp.ok())` discipline already used elsewhere in this
  suite.

**Owner:** tester.

---

### FUP-AFF2-DIRECTORY-SEARCH-HAS-NO-REGISTRO-LEG

⚠ **The deferral is real and PO-ruled; what was missing is the REGISTER LINE.** ADR 0133
**Amendment 2** closes with two deferrals *"named so they are records rather than omissions"*.
Measured 2026-08-24: the sibling (`error.tsx` for the `usuarios` route) was **built** —
`src/app/o/[org]/manage/usuarios/error.tsx` exists — and this one appeared in **no register at
all**: zero occurrences in `follow-ups.md` and `deferred-backlog.md`, and PROGRESS.md's only
`registro` is the unrelated REG·KIND row (`:98`). ⭐ Of a pair named so that neither would become an
omission, the one that became an omission is the one that stayed deferred — **naming a deferral
inside an ADR is not filing it**, because nobody reads an ADR to find out what is open.

**What is deferred.** The design handoff's directory search reads *"Buscar por nome, e-mail ou
**registro**…"* — `docs/design/temp/user_management_redesign/Gestão de Usuários.dc.html:82` **and**
`:374`. The live search matches **name and e-mail only**.

✅ **Nothing is user-visibly false today, which is why this is 🟡 and not a bug.** Amdt 2's other
half shipped: label and placeholder both read *"Buscar por nome ou e-mail"*
(`src/components/users/user-directory-search.tsx:72,83`), replacing a pre-existing false claim
(*"ou categoria"* — never searched, and it had propagated into the visible `aria-label`). The
docblock at `src/lib/queries/org-users.ts:349-360` records the deferral in code, and until this line
existed it was the **strongest record of it anywhere** — visible only to someone already reading the
function they would have to change.

⛔ **TWO query sites, not one.** `listOrgUsers` (`org-users.ts:401`) and `listHospitalUsers` (`:487`)
each build the same `full_name.ilike,email.ilike` `.or()`. Fixing the first alone gives org admins
and hospital admins **different search semantics on the same screen** — against ADR 0133 D14, whose
premise is that both roles get the same screens with the differences data-side.

**Shape of the fix, if it is built.** The number is `professional_credentials.registration_number`
(`org-users.ts:68-76`) — a **1→N** table the directory already batch-reads per page in
`loadPageExtras` (`:258`). So the leg is a **join filter**: resolve matching `user_id`s and `.in()`
them, the shape `hospitalPeopleIds` (`:133`) already uses and whose `:124` comment explains why a
resolved set beats a raw `.or()` string. Never another `.or()` clause on `profiles`.
⚠ **It must respect ADR 0133 D13's widened `professional_credentials` SELECT.** A hospital_admin who
may *see* a person but not *read* their credential must not get a search returning fewer rows than
their own directory shows — that is the *"empty never means no-permission"* trap D13 exists to
remove, re-entered through the search box. A DENY-arm keystone belongs with the build.

**A decision is owed before any build.** Ruling *"not building it — the label is honest now"* is a
legitimate close; **drifting into that by never deciding is not**, and was the live state for a day.

**Owner:** backend/PO.

---

### 🟡 FUP-UI-AUTHZ-WRAPPERS-DUPLICATE-THE-ENFORCING-PREDICATE — six `public` authz wrappers mirror an `app.*` rule that RLS calls directly, and nothing pins that the two agree (owner: backend + PO; filed 2026-08-24, found while keystoning `rca_writer_can_write`)

**The shape.** A handful of `public` `prosecdef` SQL bool functions exist whose entire body delegates to an
`app.*` predicate — e.g. `public.rca_writer_can_write(p_rca_id)` is exactly
`select app.can_write_rca(p_rca_id, auth.uid())`.

⛔ **They are NOT redundant, and must not be "simplified" away.** Measured: `app` is **not a
PostgREST-exposed schema** (`supabase/config.toml:13` → `schemas = ["public", "graphql_public"]`), so the UI
cannot call the enforcing predicate over the API *even though* `authenticated` does hold EXECUTE on
`app.can_write_rca`. The wrapper is a necessary bridge. ⭐ Recorded because the first reading of the grant
alone said "redundant" and was wrong — the exposure, not the grant, is what makes them load-bearing.

**Population, measured in the catalog 2026-08-24** — 18 such wrappers, of which 12 are `*_enabled`
feature-flag delegations (`select app.feature_enabled('x')`, low risk). **Six are authorization predicates:**

| wrapper | delegates to | pgTAP coverage |
| --- | --- | --- |
| `rca_writer_can_write` | `app.can_write_rca` | ✅ `300_rowdoor_gate_keystones.sql` §1.10/2.10 (added 2026-08-24, mutation-proven) |
| `interview_viewer_can_write` | `app.can_write_interview` | ✅ `121_interviews.sql:117-124` (two-sided `is()`) |
| `is_nsp_coordinator_of_self` | `app.is_nsp_coordinator_of` | ⛔ **none — 0 files** |
| `is_nsp_org_admin_of_self` | `app.is_nsp_org_admin_of` | ⛔ **none — 0 files** |
| `is_pqs_member_of_self` | `app.is_pqs_member_of` | ⛔ **none — 0 files** |
| `is_pqs_member_self` | `app.is_pqs_member_of_any` | ⛔ **none — 0 files** |

**All six have ZERO catalog references** — no policy, no trigger, no other function body. Enforcement bypasses
them entirely: all **eight** rca write policies (`rca_update` · `rca_delete` · `rca_evidence_write` ·
`rca_factors_write` · `rca_members_write` · `rca_root_causes_write` · `rca_timeline_write` ·
`rca_why_chains_write`) call `app.can_write_rca(id, auth.uid())` directly.

**The hazard: two copies of one authorization rule, and only one of them is enforced.** Today they agree
*because* the wrapper delegates — and **nothing pins that it keeps delegating**. Inline the logic, or "fix" one
side, and the UI silently disagrees with the database: write affordances offered that the DB then refuses, or
hidden that it would have allowed. ⚠ **No existing gate can see it.** The door sweep cannot — neutralize a
wrapper and RLS is unaffected, which is precisely why `rca_writer_can_write` swept BLIND across 218 files. The
RLS keystones cannot — they never call the wrapper.

⚠ **NOT a live hole, and do not report it as one:** verified 2026-08-24 that every wrapper still delegates, so
UI and DB agree today. The item is the absence of anything that would notice if they stopped.

⭐ **What the two existing keystones still do NOT pin.** Both assert the wrapper's output against a
**hardcoded expectation** (`is(..., false)` / `is(..., true)`). That catches a wrapper that breaks alone; it
does **not** catch wrapper and predicate drifting apart, because nothing compares them. The assertion that
would is the **differential**, evaluated as one principal:

```sql
select is(public.rca_writer_can_write(<rca>), app.can_write_rca(<rca>, auth.uid()),
  'wrapper agrees with the predicate RLS actually enforces');
```

**Decide between:**
- **(a)** differential assertions for all six, plus first-ever coverage for the four `is_*_self` wrappers; or
- **(b)** a structural fix that removes the second copy — generate the wrappers from the predicate, or expose
  one definition both the UI and RLS consult, so agreement is not a thing anyone has to test.

**Owner:** backend + PO decision.

---

### 🟡 FUP-CLAIMS-SURVIVAL-DIFFERENTIAL-IS-NOT-RUN-BY-ANYTHING — the detector that found six false premises is a technique, not a gate (owner: backend/tester; filed 2026-08-24 at the close of FUP-RESET-ROLE-DOES-NOT-CLEAR-JWT-CLAIMS)

`claims_for` writes `request.jwt.claims` with `is_local => true`, so the claims outlive `reset role`. A
pgTAP test can therefore assert an owner-context property while still running as the last persona, and be
green for a reason unrelated to what it names.

**That class is now empty — and nothing keeps it empty.** It was emptied by a one-off differential: append
`set local request.jwt.claims = '';` after every `reset role;` (2171 sites, 172 files), run the suite, and
treat every moved verdict as a finding. Six were found and fixed. ⛔ **Nothing runs that comparison**, so a
test written tomorrow can reintroduce the defect and the suite stays green — the same *"standing in prose
only"* shape ADR 0079's door sweep was operationalised to escape.

⚠ **It cannot simply be bolted into `npm run lint`** — ADR 0127's stated bound: DB anchors are not
checkable there. And it is not a cheap check: it is a **full-suite run with a tree-wide edit applied and
then reverted**, i.e. the shape of the periodic `ARM=wrapper` sweep, not of a per-phase step.

⭐ **It has a working positive control already** — `358` G4 pins the hazard, so it MUST fail while the
instrument is applied. A run where G4 passes means the edit did not take, and the result must be discarded
rather than read as "clean". Any scripted version must assert that inversion before believing its own
output.

**Decide between:**
- **(a)** script it as a periodic audit (alongside the other ~100-min sweeps), with the G4 inversion as its
  self-test; or
- **(b)** rule the class closed-by-convention and rely on `test_helpers.reset_role_and_claims()` adoption —
  ⚠ but note the close measured that the verb is **not** a drop-in replacement for `reset role` (it needs
  `test_helpers` schema USAGE, which a restricted role may lack), so adoption is not mechanical.

**Owner:** backend/tester.

---
