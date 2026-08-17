# DM5 · S5 — QA review (operational closure)

> **Verdict: ⛔ CHANGES REQUESTED** — 0 P0 · **2 MAJOR (both blocking)** · 9 MINOR · 5 INFO.
> Reviewed at `23b1d9cf`, tree clean, on the stack as handed over (registry **407 == 407**,
> `storage.buckets` = the four survivors, volume 245 files / 2,456,666 bytes).
> Round 1. Reviewer: `qa`.
>
> ⭐ **The build is sound and the four chartered S5.R acceptance items are genuinely
> falsifiable — I proved each one by neutralization, not by reading the fix.** Both blocking
> items are defects I found in the *artifact this slice modified* and in the *runbook this
> slice shipped*; **no part of the delivered S5.R / S5.D design is being asked to change.**
> Both are cheap to close (one 1-line tool guard + three sentences of documentation).
>
> ⛔ **`npm run e2e:prod` was NOT run and its absence is NOT a finding** — deferred by PO
> decision. I examined the deferral independently and **concur**; the reasoning and the
> residual are in §8.1.

---

## 1 · Method, and what I did to the stack

Everything below is either a **live-catalog read** (`pg_proc` incl. `prosecdef`, `pg_policies`,
`pg_trigger`, `pg_indexes`, ACLs), an **executed measurement**, or a **source-level fact with
the inference labelled as such**. No claim in this review rests on migration text, on
graphify, or on grep-as-proof.

I ran, in this order: 1 baseline `rehearse`; **5 single-variable mutant `rehearse` runs**; the
**TS pin red-first** (a real probe module written into `src/lib/documents/`, run, deleted); the
**pgTAP pin red-first** (a real caller created in `public`, `343` run, dropped); one **purpose-built
measurement of my own hypothesis** (§3.1); and the **four gate commands plus `next build`**.

**Stack state after all of it — restored and verified:** `storage.buckets` = 4, `storage.objects`
= 0, volume = **245 files**, bucket dirs = the four survivors, `pg_proc` holds no `qa_s5%` row,
`pgtap` not installed, `git status` clean, HEAD unchanged at `23b1d9cf`. Five mutant copies were
written to the repo root as `.qa-mutant.mjs` and deleted in the same command each time; two
transient probes (`src/lib/documents/qa-s5-redfirst-probe.ts`, `.qa-missingbytes.mjs`) likewise.
⛔ **No `supabase stop`/`start`. No `e2e:prod`. No remote contact of any kind.**

---

## 2 · What I independently re-proved (the part that is NOT taken on trust)

### 2a · The four S5.R acceptance items are load-bearing — **measured by neutralization**

The plan requires each acceptance item **"proven able to FAIL, never merely observed passing."**
I did not accept the in-run twin arms as that proof. I mutated the tool's real code, one variable
at a time, and recorded which arms reddened. Baseline: **16/16, exit 0**, reproduced on my own run.

| mutant | single change to `scripts/storage-manifest.mjs` | arms that went RED | chartered item it proves live |
| --- | --- | --- | --- |
| **M1** | `const ok = deleted === rec.keyCount` → `const ok = true` (:623) | **R3a, R6b** — 14/16 | **item 3**, over-count half |
| **M2** | `left = …filter(present && files>0)` → `left = []` (:644) | **R3b, R3b-diagnosis, R3c, R3d** — 12/16 | **item 3**, under-count/byte half + all three classifier arms |
| **M3** | `if (onlyVolume.length) return 'ORPHANED_BYTES'` → `&& false` (:372) | **R2** alone — 15/16 | **item 2** |
| **M4** | `.remove(batch)` → a stub reporting success and deleting nothing (:615) | R3a, R3b, R3b-diag, R3c, **R1x, R4b**, R6, R6b — 8/16 | **item 1** + item 4's admit half |
| **M5** | `retirementGuardSql` returns `select 1;` (:1066) | **R4a** alone — 15/16 | **item 4**, refuse half |

Every mutation reddened **exactly the arms that own the neutralized property** and left the
others green. That is a stronger result than the record claims for itself: the arms are not
merely paired, they are **individually discriminating**. M3 and M5 reddening a *single* arm each
is the specific evidence that these are not blanket assertions.

**R3b-vs-R6 is genuinely single-variable.** Verified at source, not from the comment: both build
their manifest by `pop()`-ing one key from a **sighted** capture (`cap4` / `cap7`), both call the
same `cmdDelete`, and the only difference is `process.env.PATH = noDocker` around the R6 call —
forcing `locateVolume()` down its **pre-existing** unavailable branch, with an in-arm vacuity
guard (`if (locateVolume().available) throw … 'the arm would be vacuous'`, :1311). M2
independently confirms the direction: kill the byte-side proof with the proof *available* and
R3b reddens while R6 stays green. The claim holds.

**The `cap7` fix is real, not cosmetic.** Without the sighted twin, R6-capture is satisfied by a
tool that verdicts `UNVERIFIED_NO_LOCAL_PROOF` and exits 1 for *every* input. The assertion now
pins both sides of the one variable in the same expression (:1331-1337). I accept the record's
account of this in full, and it is the best single item in the slice.

### 2b · Both gap keystones go RED if someone wires the disposal job — **reproduced**

| pin | my mutation | observed |
| --- | --- | --- |
| `supabase/tests/343_dm5_s5_disposal_gap.sql` | `create function public.qa_s5_redfirst(uuid)` calling the door, out of band | **`Failed tests: 2-3, 5`, `Tests: 12`, Result FAIL, exit 1**; K4's diagnostic named it: `have: {public.qa_s5_redfirst} want: {}`. Dropped → **12/12 PASS**, exit 0. |
| `src/lib/documents/disposal-gap.test.ts` | `src/lib/documents/qa-s5-redfirst-probe.ts` with `admin.rpc('complete_document_disposal', …)` inside `scheduledDisposalSweep` | **`Tests 1 failed | 9 passed`**; THE GAP failed reporting `+ src/lib/documents/qa-s5-redfirst-probe.ts :: scheduledDisposalSweep [rpc-call]`. Deleted → **10/10**. |

Both reds **name what broke them**, at the file-and-function grain on the TS side and
schema-qualified on the SQL side. The record's red-first account is accurate. ✅

### 2c · Catalog facts behind the record and the runbook — all verified live

| claim | source | verdict |
| --- | --- | --- |
| `public.complete_document_disposal` exists, `prosecdef = t` | `pg_proc` | ✅ |
| its ACL is `postgres` + `service_role` only, never `authenticated`/`anon` | `proacl = {postgres=X/postgres,service_role=X/postgres}` | ✅ (K7a/K7b correct; runbook §2 correct) |
| the only other `pg_proc` body mentioning the door is `public.dispose_case_phi` | `prosrc` scan | ✅ — and comment-stripped it does **not** call it, so K3b's live subject is real |
| `pg_cron` not installed, no `cron` schema | `pg_extension`, `pg_namespace` | ✅ (K6a/K6b non-vacuous) |
| `perform app.assert_documents_enabled()` is the door's first statement | `prosrc` | ✅ (runbook §2 precondition correct) |
| runbook §4's quoted absence check is **verbatim** from the live body, not paraphrased | `prosrc like` | ✅ — including the comment line, the message, `HC0D9`, `HC0DR`, both exemption lanes |
| `app.guard_file_object_transition` — BEFORE INSERT OR UPDATE on `file_objects`, DEFINER, enabled | `pg_trigger` (`tgtype` bits, `tgenabled='O'`) | ✅ |
| **`public.documents` holds only `documents_pkey`** | `pg_indexes` | ✅ — **the P2 Seq Scan finding is real**, not an artifact of the synthetic volume |
| 274 policies / 4 buckets / 0 `storage.objects` / registry 407 | catalog | ✅ matches the handover |

### 2d · Every gate figure in the record reproduces at HEAD on my own run

This is the direct answer to the lead's doubt #3 (*"did any other figure inherit the same
non-verification?"*). **No.**

| gate | record says | I measured |
| --- | --- | --- |
| `npm run lint` (5 chained) | exit 0 | **exit 0** — eslint 0/0, css-vars, door gate 10/10, client/server 481+124 → 0 findings, vacuous 42/42 → 0 findings over 185 spec files |
| `npm run typecheck` | exit 0 | **exit 0** |
| `npm run test` | 89 files / 1304 | **89 files / 1304 passed, exit 0** |
| `npm run test:db` | 194 files / 6363 | **194 files / 6363, Result: PASS, exit 0** |
| `343` contributes +12 | +12 | **12** (counted in its own runlog) |
| `disposal-gap.test.ts` contributes +10 | +10 | **10** |
| **`next build`** | **not in the record's gate table** | **exit 0** — see MINOR-1 |

---

## 3 · ⛔ BLOCKING (2 MAJOR)

### MAJOR-1 — `capture` reports **CAPTURE CLEAN, exit 0** for a bucket whose bytes are gone while its metadata survives. Measured. The classifier-completeness claim in the record is wrong.

**Requirement violated:** ADR 0120 **D9** ("the gate must turn an unfalsifiable negative into a
positive comparison"); Architecture **Rule 12**; and the record's own §1e/§6-item-5 completeness
argument — *"The S5 message fix has THREE outcomes; R3b and R3c cover two … R3d the third"*
(`scripts/storage-manifest.mjs:1356`). **There is a fourth, and it is silently clean.**

**What I measured** (unmodified tool, purpose-made bucket, teardown verified):

```
bucket                    exists  api_keys  vol_keys  vol_files    vol_bytes  verdict
qa-s5-missingbytes-probe  true           3         —          —            —  CONSISTENT_EMPTY

TOTAL api_keys=3  orphan_keys=0 (PHI-tier 0)  orphan_files=0  orphan_bytes=0
CAPTURE CLEAN                       ← exit 0
```

Three objects uploaded through the Storage API (3 rows in `storage.objects`, confirmed by
catalog read), then the bucket's **volume directory removed** so the bytes are gone and the
metadata is intact. `verdictFor` (`scripts/storage-manifest.mjs:364-366`) short-circuits on
`!proof.present` **without ever consulting `apiKeys`**, returns `CONSISTENT_EMPTY`, which is a
member of `CLEAN_VERDICTS` (:382) — so the headline, the verdict column and the exit code all
say clean over a bucket the API says holds three live files.

**Three reasons this is blocking and not a footnote:**

1. **It is the exact defect the same slice fixed one line above.** The S5 change to the
   `!exists` branch (:347-362) is *"a verdict that treats a missing row as proof of a missing
   object is the withdrawn method wearing the tool's badge."* The `!proof.present` branch is the
   same sentence with the nouns swapped — *a verdict that treats a missing directory as proof of
   a missing object* — and it was left in place, two lines later, in the same function, in the
   commit that fixed its sibling.
2. **The verdict is non-monotonic in severity.** Lose *some* of a bucket's bytes and you get
   `MISSING_BYTES` → dirty, exit 1. Lose **all** of them and you get `CONSISTENT_EMPTY` → clean,
   exit 0. **The worse state reports better.** No control anywhere in `selftest` (13) or
   `rehearse` (16) constructs it — I had to build the state to find it.
3. **This state is not hypothetical for this project.** It is what a storage-volume loss with
   the database intact produces — i.e. `supabase stop`/`start` without a `db reset`, the exact
   mechanism of **FUP-DM5-STACK-CYCLE-DESTROYS-BYTES**, which has already fired once in this
   phase in the other direction. Under Rule 12 it is the more dangerous direction: the metadata
   says the PHI file is present and servable, `disposal_state` says nothing is owed, and
   `document-reconciliation.mjs` lists from the same API and cannot see it either (runbook §5.2
   documents its blindness to volume *orphans* — this is the opposite axis and equally invisible).

⚠ **The record does name a neighbouring shape** (§6 item 5: *"A bucket with API-visible keys but
ZERO volume files is never examined by the new classifier … not fixed"*) — but it scopes it to
the **delete** classifier and calls it *"not classified."* It is not unclassified. **It is
classified CLEAN, by name, in the headline, with a zero exit**, on the `capture` path that S4/S6
and the deploy runbook gate on. That understatement is the defect I am blocking on as much as
the code.

**Minimal remediation (either is acceptable; (a) preferred):**
- **(a)** In `verdictFor`, make the `!proof.present` branch consult `apiKeys`: return
  `MISSING_BYTES` (already a dirty verdict) when `apiKeys.length > 0`. Add a rehearsal arm
  (`R7`) that constructs the state exactly as I did — bucket exists, N objects uploaded through
  the API, volume directory removed — and asserts the verdict is dirty and the exit is 1, with
  its permissive twin (directory present ⇒ `CONSISTENT`). Prove it able to fail by reverting the
  one line.
- **(b)** If the PO prefers no tool change in S5: correct record §6 item 5 to state the measured
  behaviour (`CONSISTENT_EMPTY`, `CAPTURE CLEAN`, exit 0, non-monotonic), file it as its own
  follow-up citing this measurement, and add it to runbook §6a's *"never automate on the exit
  code"* paragraph. **Prose alone is not sufficient without the record correction** — the
  present §6 item 5 wording would let a future reader believe the state merely goes unexamined.

### MAJOR-2 — runbook §6 asserts as **measured** a Cloud claim that is **inferred and false at the predicate grain**; and the "local proof" has no project affinity, so it can attest to a *different project*.

**Requirement violated:** plan § S5.R — *"State the domain the rehearsal covers"* — and the
runbook's own §6 header: **"Both caveats below were measured in the S5.R rehearsal, not
inferred."**

`docs/deployment/phi-disposal-runbook.md:236-238` (caveat (a)):

> "The local volume proof requires `STORAGE_BACKEND=file` plus a `supabase_storage` Docker
> container **on the operator's own machine**. **Neither can hold for a Cloud project**, so
> **every** bucket verdicts `UNVERIFIED_NO_LOCAL_PROOF` and `capture` exits **1** — on a
> perfectly healthy project."

**The two conditions are at different grains, and the sentence conflates them.** The backend
condition is a property *of the project*; the container condition is a property *of the
operator's machine*. A developer machine running `supabase start` — the normal state for anyone
who can run this repo's gates at all — satisfies the container condition **while the client
points at Cloud**. So "neither can hold for a Cloud project" is false in the most likely
operator configuration, and it is stated as measured. This is the *predicate quoted at the wrong
grain* class, in the shipped operational document, inside the section that claims measurement.

**The underlying tool fact, verified at source:** `locateVolume()`
(`scripts/storage-manifest.mjs:224-268`) finds the container **by name pattern via `docker ps`**
and derives the root from the *container's* env. It is never given the project URL. I enumerated
every use of `adminClient()`'s `url`: lines 143, 145, 149 (build the client) and 403 (stamp
`manifest.supabaseUrl`). **Nothing anywhere asserts that the volume being walked belongs to the
project the Storage API is talking to.** The manifest prints `supabaseUrl` and
`localProof.container` side by side and cross-checks neither.

**Consequences — labelled by strength, exactly as I would demand of the slice:**

- **Measured (§3.1 above, local):** a bucket the API says holds keys, with no matching volume
  directory, verdicts `CONSISTENT_EMPTY` / `CAPTURE CLEAN` / exit 0.
- **Source-level (certain):** in `cmdDelete`, `left` selects only buckets with `files > 0`
  (:644); when no manifest bucket has a local directory, `left` is empty and the tool prints
  **`LOCAL PROOF: zero bytes remain on the volume for every manifest bucket.`** and exits 0
  (:734-738). This string is asserted as the success signal by R1x (:1261).
- **Inference (NOT a Cloud measurement, and I did not attempt one):** an operator running this
  tool against Cloud from a machine with a local stack up gets `localProof.available = true`,
  a census of the **wrong project's** volume, and — for any manifest bucket absent locally — a
  printed **byte-level assurance for a Cloud deletion that was never checked**. For buckets that
  *do* exist locally, the two key sets are disjoint and the run goes loud but wrong
  (`DIVERGED_BOTH_WAYS`, or a false `MISSED BY THE MANIFEST` / `DO NOT PROCEED`).

⭐ **Why this matters beyond a doc fix:** S5's headline finding is *"on Cloud you lose the local
proof."* The tool's actual behaviour admits a third state — **"on Cloud you may get a *fake*
local proof"** — which is strictly worse than losing it, and which the runbook currently tells
the operator is impossible. A missing control is a known gap; a control that attests to the
wrong subject is the reassuring-signal class this whole follow-up family is about.

**Minimal remediation:**
1. Rewrite the false sentence: the **file backend** cannot hold for a Cloud project; the
   **container** can and usually will be running, in which case the tool walks the **local**
   volume and attributes it to the Cloud project. State that the `UNVERIFIED_NO_LOCAL_PROOF` /
   exit-1 outcome holds **only when no local stack is running.**
2. Correct §6's "Both caveats below were measured … not inferred": caveat (a)'s Cloud half is an
   inference, and (per this item) was wrong.
3. Add a project-affinity guard in the tool — at minimum: when `localProof.available` is true and
   `NEXT_PUBLIC_SUPABASE_URL` is not a loopback/`localhost` origin, refuse (or downgrade the
   proof to unavailable and emit a residual). One condition, and it makes the "domain: LOCAL
   stack only" banner enforceable rather than advisory.
4. Fold the state into **FUP-DM5-CLOUD-ORPHAN-SURFACE** or a new item, since it changes what a
   Cloud run of the deploy sequence can be trusted to have proved.

---

## 4 · The five questions I was asked

**Q1 — Are the four S5.R acceptance items genuinely proven falsifiable, or only observed
passing?** **Genuinely falsifiable, and better than claimed.** Five neutralizations, each
reddening exactly the arms that own the mutated property (§2a). R3b-vs-R6 is single-variable at
source, with an in-arm vacuity guard, and M2 confirms the direction independently. This is the
strongest assurance artifact DM5 has produced.

**Q2 — Is the under-count finding's bridge to Cloud correctly bounded, or does it overreach?**
**The bridge as written is correctly bounded — and it is the *wrong* bridge.** The stated
inference (*"the absence of a precondition readable in the source"*, ADR 0120 D9 note) is
honestly labelled, is weaker than a Cloud measurement, says so, and does not repeat D17's
"same mechanism class" error. It does not overreach. **But the precondition it names does not
hold the way it claims**: `locateVolume()`'s container condition is about the operator's
machine, not the project (MAJOR-2). So the conclusion *"on Cloud the byte-side controls are
lost"* is **too generous to the tool** — the reachable state is *"on Cloud the byte-side
controls may be present and wrong."* The finding needs widening, not weakening.

**Q3 — Do the two gap keystones actually go RED if someone wires the job?** **Yes — reproduced
independently, both naming the culprit** (§2b).

**Ruling on `no_plan()`: ACCEPTED for this file, with a correction to its stated rationale and
a recommendation.** It is acceptable because (i) the abort-safety half was *measured*, not
assumed, and I confirmed the count is still visible in the runlog (`Tests: 12` on both my red and
green runs, so the suite-total comparison has a per-file number to land on), and (ii) the file
discloses the cost in-file and forbids naive restoration. **But the justification inverts the
risk directions and should be corrected:** a wrong `plan(N)` **fails safe** (a noisy red on a run
that was already failing — the observed `Failed tests: 2-3, 5, 12` was a *reporting* artifact of
a run that correctly exited 1, never a false green), whereas silent assertion loss under
`no_plan()` **fails open**. The file traded a fail-safe failure mode for a fail-open one and
described that as protecting its ability to go red. **Recommendation (non-blocking):** now that
the assertion set is stable at 12, restore `plan(12)` in a change that re-derives the count, or
add an end-of-file count guard so the number fails as one named assertion instead of a parse
error. The compensating control (a lead-side human comparison) is the weakest link in an
otherwise exemplary vacuity design, and the record is right to flag it.

**Q4 — Is the runbook executable as written?** **Substantially yes; three executability gaps,
all MINOR.** Every catalog-dependent step I could check is correct and verbatim from the live
catalog (§2c). `7z` **is** on PATH here (`/c/Users/micha/scoop/shims/7z`); `age` is **not**, so
the 7z form is correctly the primary. The count-vs-census verification is comparable **today**
(`find /mnt/stub -type f` = **245** = `walk`'s TOTAL) but only because the volume root holds
nothing but the four bucket directories — see MINOR-5. The deliberately-unfilled destination
path plus the mandatory sync-root check is the right call, and the check itself has two defects
(MINOR-4). The load-bearing destruction act has **no mechanism** (MINOR-3). The sequence remains
unrehearsed, which the record already binds as a named gap.

**Q5 — Is the NO-ANSWER class statement right, and is instance 3's severity right?**

**Severity: YES, 🔴 is correct, and the argument for it is the right argument.** A persisted
record asserting PHI destruction to a regulator, where what was verified is metadata absence, in
a 20-year-retention LGPD / ANVISA-RDC / CFM 1821 regime, is a different kind of defect from tool
output an operator can second-guess. The compounding point — that on Cloud it is not merely
unchecked but *unverifiable by the method we have* — is what makes 🔴 rather than 🟠 the honest
grade. I would add one bound for precision: this is a **latent false assertion**, not a
demonstrated live one; it becomes false only where the API delete removed metadata while bytes
survived. Say "can assert more than it verifies", not "asserts falsely today".

**Class statement: PARTLY. The headline sentence does not cover half of its own instances, and
the sentence that does is sitting one line below it.** *"An ACTION PERFORMED is recorded as the
STATE ACHIEVED"* fits instances 3, 4 and the caught fifth exactly. It does **not** fit 1 or 2:
`--allow-orphans` and `.list('')` are not actions recorded as states — they are **"I could not
look" recorded as "I looked and found nothing"**, which is the item's own original title and
still its heading. The table forces the mismatch visibly: its first column heading is *"the
action performed"* and its first two rows contain *"I could not look"* and *"absence of a
bucket"*, neither of which is an action performed. **The true class is the sentence immediately
below:** *every instance substitutes an observable **proxy** for the property that matters, and
every one fails in the **reassuring** direction.* That covers all five, and it is the one a
reviewer can actually apply. **Recommendation:** promote the proxy/reassuring-direction sentence
to the headline and keep *action → state* as the named **sub-class** covering 3/4/5. This is
MINOR-2, and it matters only because the entire point of the reframe was recognizability in
review — a class that mis-describes two of its own four instances will mis-train the next
reader. ⭐ **My MAJOR-1 is a sixth instance of the corrected class** (*"no volume directory"*
recorded as *"the bucket is consistent and empty"*) and a **third** distinct variant: not "I
could not look", but **"I looked at the wrong thing."**

---

## 5 · The lead's four handed-over doubts

**Doubt 1 — was the 4th fix's reasoning right?** ⚠ **The conclusion is right; the reason as
stated is false in the present tense, and it was not the load-bearing reason anyway.** *"Bucket
row absent + bytes present is exactly the state all eight retired buckets are in"* — measured
today, the eight retired buckets hold **0 bytes** and have **no directory on the volume** (I
re-measured: the volume root holds only the four survivors). They were briefly in that state
between the retirement migration and the stack recovery that destroyed the 221 files; and a
Cloud retirement produces it by construction. So the claim is true **historically** and **for
Cloud**, and false as written in the present tense, in a phase whose recurring defect is a
present-tense claim about a state that has moved. **You did not widen scope for nothing** — but
the sufficient justification is the one R3d itself produced and needs no frequency argument at
all: *the classifier printed the reassuring arm, with no `DO NOT PROCEED`, on the destructive
path, for a bucket it had never interrogated.* Lead that reason; demote the "all eight buckets"
sentence to the past tense with the Cloud-by-construction half kept. (MINOR-6.)

**Doubt 2 — is key-first cryptographic erasure sound, or a different unverifiable claim?**
**It is a genuine improvement and the honest framing is what makes it sound — but as written the
runbook re-instantiates the class it resolves, one level down.** The improvement is real: the
claim moves from *"bytes unrecoverable"* (contradicted by CoW filesystems, wear levelling and
snapshots) to *"residual ciphertext unrecoverable without the key"*, which does not depend on
what the filesystem did with the blocks; and §6b's insistence on logging *what each act proves*
is exactly right. **What is missing is the mechanism for the load-bearing act.** The runbook
never says where the key lives or how it is destroyed — only *"key stored separately"* and
*"Destroy the KEY first."* So the mandated log line *"key destroyed (renders any residual
ciphertext unrecoverable)"* has **no verifiable referent**: if the key is a `7z -p` passphrase
typed interactively and never persisted, there is nothing to destroy and the log line asserts an
act that did not occur; if it is in a password manager, "destroyed" inherits that tool's
sync/backup/undelete semantics and is exactly as unverifiable as `rm` was. **That is instance 4
recreated inside its own fix** — an action recorded as a state — and it is the answer to your
doubt: you have not substituted an unverifiable claim for an unverifiable claim, but you have
left the new claim's referent unspecified, which gets you there in one step. Fix is small
(MINOR-3) and needs no PO decision.

**Doubt 3 — did any other figure inherit the same non-verification?** **No.** I re-ran all four
gates at HEAD: lint exit 0, tsc exit 0, vitest **89f/1304**, pgTAP **194f/6363** — every figure
in the record reproduces, and the two derived deltas (+12 for `343`, +10 for the TS pin) are
individually correct (§2d). The only gate item I found *missing* rather than wrong is
**`next build`**, which the phase's own plan § Gate names in step 1 and the record's gate table
omits — so I ran it: **exit 0** (MINOR-1). Your ownership of the stale lint baseline is recorded
correctly, and the observation that the dead binding *was* the missing control is the most
valuable sentence in the record.

**Doubt 4 — was the PO right to defer `e2e:prod`?** **Yes, and I would not overturn it.**
Reasoning and residual in §8.1. I verified the zero-footprint premise myself rather than
inheriting it.

---

## 6 · MINOR (9)

**MINOR-1 — `next build` is a step-1 gate item in this phase's own plan and is absent from the
record's gate table.** `docs/plans/dm5-wave-d-retirement-plan.md` § Gate: *"Fresh `supabase db
reset` → `npm run test:db`, lint 5/5, typecheck, vitest, **`next build`**."* The record's §5
table lists seven gates and not that one, and does not list it as NOT COVERED either — it is
simply absent, which is the one shape a reader cannot detect. **I ran it: exit 0** (compiled
successfully, 19/19 static pages). Add the row citing this review. ⚠ It is the *only* gate that
would have caught the BUG-FBE-005 class from a new file under `src/lib/`, which is precisely the
exposure §8.1 turns on — an omission that happened to be harmless is still the omission.

**MINOR-2 — the reframed class statement does not cover instances 1–2.** See Q5. Promote the
proxy/reassuring-direction sentence; keep *action → state* as the sub-class. Applies in three
places: `docs/progress/follow-ups.md:13-17`, the same table's first column heading, and the
PROGRESS index entry.

**MINOR-3 — the key's custody and destruction have no mechanism, so the mandated log line has no
referent.** `docs/deployment/phi-disposal-runbook.md:396-400`. Name where the key lives (a
specific password-manager entry, or a keyfile at a stated path) and the act that destroys it;
and give the "passphrase never persisted" case its own log wording (*"no copy existed to
destroy"*), because *"key destroyed"* for a passphrase that was never written down is itself an
action-recorded-as-state.

**MINOR-4 — the sync-root check has two defects and one hazard.** Same file, :286-295.
(i) The git-worktree half only **echoes** the refusal — it never `exit 1`s, so the check is
fatal for OneDrive and advisory for "inside the repo", with no visible difference. (ii) The
`case` patterns are **case-sensitive** — `*OneDrive*` does not match a lowercased path, and
`Nextcloud`/`Syncthing`/`Box`/`pCloud` are absent. (iii) `exit 1` in a snippet an operator pastes
into an interactive shell **closes the shell**; make it a function or `return 1`.

**MINOR-5 — the mandatory archive verification compares two counts that are equal only by
accident of the current layout.** Same file, :312-344: `7z l | tail -3`'s file count is taken over
everything under `/mnt/stub`, while `walk`'s TOTAL is taken over `ALL_KNOWN_BUCKETS`. Today they
agree (**245 = 245**, measured) because the volume root holds nothing but the four survivor
directories. State that equivalence condition, or make the comparison
`docker exec … find /mnt/stub -type f | wc -l` so the two sides have the same denominator by
construction. A mandatory verification whose two numbers can diverge for a benign reason is a
verification that will be waived.

**MINOR-6 — record §1d and follow-up instance 2 assert in the present tense a bucket state that
no longer exists.** See doubt 1. Past-tense it, keep the Cloud-by-construction half, and lead
with R3d's own reason.

**MINOR-7 — the TS pin's named-negative assertion is narrower than its own description, and my
run demonstrates it.** `src/lib/documents/disposal-gap.test.ts:341`:
`callSites.filter((r) => /disposition|dispose/i.test(r.enclosing))`. **`/dispose/` does not match
`Disposal`** — my probe function was named `scheduledDisposalSweep` (the same name the record's
own red-first probe used) and the *"no caller sits on the disposition path"* assertion stayed
**green** while only the total-count assertion reddened. The property is still caught, by the
other assertion; but the arm advertised as *"a second call site added to the disposition path is
reported as such"* does not fire for the single most plausible name a disposal job would carry.
Use `/dispos/i`. ⭐ This is the *enumeration boundary is a syntax, not a property* class in the
file that pins that class.

**MINOR-8 — record §5 contains the same paragraph twice, verbatim.**
`docs/progress/dm5-s5-operational-closure.md:358-360` and `:362-366` — the *"Authz sweep: NOT
APPLICABLE"* paragraph is duplicated. Delete one.

**MINOR-9 — the four standing authz ARMs are neither run nor recorded.** CLAUDE.md §6 step 1
lists `ARM=census` / `ARM=hat` / `ARM=floor` / `FROMFINDINGS=1 ARM=wrapper` as **unconditional**
build-complete gates (~1.2 min total); the *diff-scoped* sweep is the conditional one. The record
argues only the conditional one ("no migration ⇒ no diff to derive a list from") and says nothing
about the four. **I believe N/A is the correct answer here** — the slice adds no `pg_proc` row and
no policy (the pgTAP file rolls back; I confirmed `pg_proc` holds no `dm5_s5%` row and the policy
count is unchanged at 274), so the ARMs' subject is provably identical to the pre-slice catalog —
**but the record has to make that argument rather than leave the ARMs unmentioned.** I did not run
them: they mutate the shared stack, and this program has already had a sweep leave an authz gate
open. One sentence closes this.

---

## 7 · INFO (5)

**INFO-1 — the plan's S4 heading contradicts PROGRESS.** `docs/plans/dm5-wave-d-retirement-plan.md:131`
still reads *"steps 1 ✅ · 2 ⛔ UNESTABLISHED · 3 r1 ⛔ (fixed, r2 owed) · 4 owed"* while PROGRESS
(the §7 source of truth) records **S4 CLOSED, all five gate steps, QA APPROVED r3**. Since S5's
`e2e:prod` deferral leans on S4's E2E being established, the plan is the file S6 will read, and
this is the currency defect the phase keeps filing against others. Lead-owned.

**INFO-2 — ADR 0120 D9's note says "14 controls green" at `e5a1418e`.** Correct for that commit;
`rehearse` is 16 at HEAD. Add the HEAD figure in parentheses so an S6 reader comparing the two
does not conclude the tool shrank.

**INFO-3 — FUP-DM5-D9-NO-ARM-SEES-A-BYTE-POST-RETIREMENT's local half is now stale.** It says
*"once `…000400` applies, `capture` prints `CAPTURE CLEAN`"* — the S5 `verdictFor` fix
(`BUCKET_ABSENT_ORPHANED_BYTES`) is exactly the arm that now reddens that state locally. Its
**Cloud** half stands untouched. Update it so the improvement is visible; the item should not
close.

**INFO-4 — the "restore loses 67% of RLS" headline omits its precondition.** The body is precise
(the target was a **bare** Postgres, and the supported target is a Supabase-initialized
database), and the transferable finding — `psql` exits 0 without `ON_ERROR_STOP`, and
`grep -c '^ERROR'` matches nothing because psql prefixes `psql:file:line:` — is excellent and
correctly cited in the "verified good" rule. The one-line headline as it appears in PROGRESS
reads as a defect in `supabase db dump` rather than as a misuse of it. One qualifying clause.

**INFO-5 — the drill's "68 PHI-tier files" are synthetic locally.** They are PHI-tier by
*bucket*, from seed/E2E artifacts, not real patient data. The 🔴 severity is right because it
grades the **mechanism** applied to production, and the follow-up says so; a half-sentence
distinguishing the two would stop a future reader treating the drill itself as a live incident.

---

## 8 · ⛔ NOT TESTED / NOT COVERED — binding

A delivered slice is not an absence of gaps, and a review is not an absence of them either.
Everything the record's own §6 lists (13 items) is **carried forward unchanged and unrelieved**,
including: **P4 `open_document_version` has no baseline**; P1 has no volume curve;
`--allow-orphans` is unfixed; the `catch` arm of the delete classifier is uncovered; the runbook
sequence is **UNREHEARSED**; the Cloud byte half is unverifiable from here; PITR entitlement is
UNDETERMINED; `no_plan()`'s per-file protection is given up; the vitest census excludes `e2e/`
and test files, and the pgTAP census excludes temp schemas. Additionally, **from this review**:

**8.1 — `npm run e2e:prod` was NOT run: DEFERRED BY PO DECISION, not a gap I found. I examined
the decision and CONCUR.** I verified the zero-footprint premise myself rather than inheriting
it: the `src/lib/documents/actions.ts` diff is **entirely a JSDoc block** (no executable line
changed); `package.json` adds only a `storage:rehearse` script; the new test file is imported by
**nothing** (the sole textual reference is a comment in `actions.ts:295`); there are **no**
migrations in the diff (registry 407 unchanged), **no** policy change (274 unchanged), **no**
`prosecdef` change, and **no** `e2e/` change. An `e2e:prod` run would therefore exercise a binary
whose behaviour is identical in every path the suite touches, at a cost of ~18 batches, and would
produce no information about S5. The two known classes that a green non-E2E bar misses are the
RSC-boundary render crash (no component changed) and the client→server value import that aborts
`next build` (covered by `lint:client-server-imports`, 0 findings over 481+124 modules — **and
now by my `next build`, exit 0**). ⛔ **The deferral is sound for S5 and says nothing about DM5:**
the phase cannot exit without it, because S1–S4 did change runtime behaviour.

**8.2 — I did not verify the drill's numbers, only its method and its conclusions.** The 490/10
error counts, 90-of-274 policies, 161-of-165 tables, the `docker cp` timing and the per-bucket
parity are **taken as reported.** I re-derived only the figures that bound a rule: the live
policy count (**274**) and the live volume census (**245 files**). Nothing was replayed into a
scratch database by me.

**8.3 — I did not re-measure the EXPLAIN baselines.** P2's 364 ms / 24 201 buffers, P1's
3.699→0.736 ms and P3's numbers are **taken as reported.** What I verified is the durable half:
**`public.documents` holds only `documents_pkey`** — so the missing `home_resource_id` index and
the per-row `app.can_read_document` evaluation are real. The record's own bound stands: 2000
documents on one securable is a stress distribution, and whether it is realistic is the open
product question (record §7.4).

**8.4 — MAJOR-2's Cloud consequence is an INFERENCE, not a measurement, and I made no remote
contact.** Its components are: one measurement (§3.1), one source-level certainty (`left` is
empty ⇒ the success line prints), and the absence of a project-affinity guard (enumerated at
source). The composite — that a Cloud run can print a byte-level assurance derived from a local
volume — has **not** been executed and must not be recorded as though it had.

**8.5 — the runbook's encrypt-at-creation pipeline was not executed end to end by me, and one
specific failure mode is unrehearsed.** `7z a -si -p -mhe=on` takes its data on **stdin** while
`-p` prompts for a passphrase on the console. Whether that combination works in the piped,
non-tty context the runbook shows is **untested**; if it fails, the failure lands in the same
"reports success over an empty archive" region the record already documents. This is a specific
sub-case of the record's own binding gap ("the sequence is UNREHEARSED") and should be named in
the first rehearsal.

**8.6 — no `disposal_pending` specimen exists, so the runbook's Steps A–D were verified
individually and never in sequence.** `file_objects` = 0 rows on a fresh reset. I verified each
step's *catalog preconditions* (§2c); I verified **no** state transition, no `HC0D9`/`HC0DR`
error path, and no audit row.

**8.7 — the two blocking items are the ones I found by building a state nobody had built.** Both
came from constructing a condition, not from reading code — MAJOR-1 needed a bucket with metadata
and no bytes, and neither `selftest` (13) nor `rehearse` (16) constructs it. **I make no claim
that the remaining unconstructed states are safe.** `verdictFor` has seven outcomes; the rehearsal
now exercises five, MAJOR-1 is the sixth, and `DIVERGED_BOTH_WAYS` remains unconstructed by
anything.

---

## 9 · What must happen to clear this verdict

1. **MAJOR-1** — fix `verdictFor`'s `!proof.present` branch with a red-first rehearsal arm, **or**
   correct record §6 item 5 to the measured behaviour and file it. (Record correction is required
   either way.)
2. **MAJOR-2** — correct runbook §6's false Cloud sentence and its "measured, not inferred"
   header; add the project-affinity guard or its residual; link the state into a follow-up.
3. **MINOR-1** — add the `next build` row to the record's gate table, citing this review.
4. **MINOR-9** — one sentence recording the four standing ARMs as unchanged-subject N/A, with the
   reason.
5. MINOR-2…8 and INFO-1…5 at the lead's discretion; MINOR-3, MINOR-4 and MINOR-7 are each a
   one-line change and I would take them now.

⭐ **Nothing in S5.R's or S5.D's design is being asked to change.** The rehearsal is the best
falsifiability artifact this phase has produced, the two gap pins do what they say and name what
breaks them, the runbook is accurate everywhere it touches the catalog, and the drill's
false-signal finding is worth more than the drill. Both blocking items are the same defect this
program keeps re-finding — a signal that reads reassuring about a subject it did not examine —
and the second one sits in the section that claims to have measured it.
