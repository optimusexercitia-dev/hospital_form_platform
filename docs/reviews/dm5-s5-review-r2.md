# DM5 · S5 — QA review, round 2 (operational closure)

> **Verdict: ✅ APPROVED (r2)** — **0 P0 · 0 MAJOR · 6 MINOR · 6 INFO**, none blocking.
> Reviewed at `150fe009`, tree clean. r1: [`dm5-s5-review.md`](./dm5-s5-review.md) @ `2677e9a4`
> — ⛔ CHANGES REQUESTED, 2 MAJOR.
>
> ⭐ **Both r1 blocking items are discharged, and I re-proved each by neutralization rather
> than by reading the fix.** Three mutations, three single-property reds: reverting the
> `!proof.present` branch reproduces the pre-fix red **verbatim to the character**
> (`api_keys=5 volume_present=false exit=0 verdict=CONSISTENT_EMPTY`); `C15` **passes with
> the fix reverted**, which is what makes it an over-reach guard and not a companion
> assertion; the affinity guard **actually refuses** a Cloud URL against a live local stack.
>
> ⭐ **I also closed my own r1 gap** (NOT-COVERED 8.2/8.3, filed by `backend` as its item 17):
> the drill and the P2 baseline are **no longer single-sourced.** I re-measured both from
> scratch. **The 67%-of-RLS headline is real** — and the re-measurement produced two
> corrections plus one new finding.
>
> **Gates re-verified independently at this HEAD** (not taken from the coordinator's run):
> pgTAP **194 files / 6363, Result: PASS, exit 0** — with `343` now on **`plan(12)`**, so the
> restored count is confirmed correct rather than asserted — and vitest **89 files / 1304, exit
> 0**. `selftest` **18/18** and `rehearse` **19/19** on my own runs at HEAD.
>
> ⛔ `e2e:prod` still not run — **deferred by PO decision, still not a gap I found.**
> Constraints honoured: no `supabase stop`/`start`, no remote contact, live catalog only.
> **Stack restored exactly as handed over: buckets 4 · volume 245 files / 2,456,666 bytes ·
> policies 274 · registry 407 · no `qa_s5%`/`dm5_s5%` rows · pgtap absent · `git status` clean.**

---

## 1 · The r1 blocking items — discharged, re-proved by neutralization

### MAJOR-1 ✅ DISCHARGED — and the red-first claim reproduces to the character

| mutation (one line, reverting the fix) | selftest | rehearse |
| --- | --- | --- |
| **N1** — `!proof.present` branch back to `return proof === null ? 'UNVERIFIED_NO_LOCAL_PROOF' : 'CONSISTENT_EMPTY'` | **C14 RED · C16 RED · C15 GREEN** — 16/18 | **R7 RED alone**, R7-twin green — 18/19 |

N1's R7 line came back:

```
NOT OK  R7 … — storage.objects 5→5 api_keys=5 volume_present=false exit=0 verdict=CONSISTENT_EMPTY
```

That is **character-identical** to the pre-fix observation the record claims (§6d). The
red-first account is not merely plausible, it is reproducible.

**✅ The `C15` claim I was asked to re-run is TRUE, and it is the load-bearing one.** With the
fix reverted, C15 (`no directory AND no API keys stays CONSISTENT_EMPTY and CLEAN`) **passed**.
That is exactly what distinguishes an over-reach guard from a companion assertion: it holds on
both sides of the change, so it constrains the fix rather than merely echoing it. Had it
reddened under N1 it would have been asserting the fix, not guarding it. Same for `R7-twin`,
which stayed green under N1.

**✅ The second gap the guard-set diff found is real, and I confirm it was mine to have missed.**
`volumeCensus`'s catch returns `{present:false, error}` on a failed `docker exec`, and the old
branch mapped that to `CONSISTENT_EMPTY` — variant 1 of the NO-ANSWER class *inside `verdictFor`
itself*, two lines from the branch I did report. N1 reddens **C16** as well as C14, which
confirms both guards were absent from the same line. I reported one of two; the method the lead
asked for found the other. That is the method working, and it is worth saying plainly.

### ⛔ "Confirm there is no third sibling" — in the fixed branch, NO. In the TAIL branch, YES (measured, MINOR-2)

**In the branch that was fixed: no third sibling.** I enumerated `volumeCensus`'s **complete
output space** rather than eyeballing the branch — it returns exactly four shapes, and every one
is now discriminated:

| `volumeCensus` / `cmdCapture` produces | reached via | verdict now |
| --- | --- | --- |
| `null` (no local proof at all) | `loc.available === false` | `UNVERIFIED_NO_LOCAL_PROOF` |
| `{present:false, error}` | the `catch` — a failed `docker exec` | `UNVERIFIED_PROOF_ERROR` ✅ new |
| `{present:false}` + API keys | `__ABSENT__` marker | `MISSING_BYTES` ✅ fixed |
| `{present:false}` + no API keys | `__ABSENT__` marker | `CONSISTENT_EMPTY` (correct) |
| `{present:true, …}` | normal census | falls through to the tail |

I also checked the one shape that *could* have been a fifth — `present:true` with `files > 0` but
`keys` empty. It is unreachable by construction: `files` is only incremented on a line that also
contributes a key. So the fixed branch is complete.

**But the tail branch has one, and I measured it.** The tail compares **key sets only** and never
consults `proof.files` / `proof.bytes`, which sit in the same object it is given:

```
bucket                    exists  api_keys  vol_keys  vol_files    vol_bytes  verdict
qa-s5-r2-residue          true           5         5          6           58  CONSISTENT
TOTAL api_keys=5  orphan_keys=0 (PHI-tier 0)  orphan_files=0  orphan_bytes=0
CAPTURE CLEAN                              ← exit 0
```

Five keys, five volume keys, **six volume files** — one extra file inside an existing key
directory. `orphan_files=0`, `CAPTURE CLEAN`, exit 0, with an unaccounted 13-byte file on the
volume. Same class as MAJOR-1: a byte the gate cannot see, reported clean.

**⭐ Graded MINOR because I measured its reachability in both directions rather than assuming
it.** A supported API overwrite does **not** create version residue on this Storage version:

```
upload #1        : ok      volume files : 1
upload #2 upsert : ok      volume files : 1     ← replaced in place, same UUID version file
after API remove : volume files : 0
```

So the state is **not product-reachable through the supported path today**, and I am not blocking
on a state I had to manufacture. It stays a finding because (i) the tool's own header says
`keys == files` is *"a property of the current data, not a guarantee"* — so the tail branch's
`CONSISTENT` silently depends on an assumption the author already flagged as data-dependent, and
(ii) the tool is the retirement gate for eight legacy buckets whose write history predates the
current Storage version, which is the whole reason a volume census exists. **If a future Storage
version retains versions, this becomes a MAJOR by the same argument r1 used.** One-line remedy in
§4.

### MAJOR-2 ✅ DISCHARGED — the guard refuses, and the runbook no longer overclaims

**The guard actually refuses — measured, not read:**

```
$ NEXT_PUBLIC_SUPABASE_URL=https://azkbbhskturikxpgmafq.supabase.co node scripts/storage-manifest.mjs walk
LOCAL PROOF UNAVAILABLE — the Storage client points at https://azkbbhskturikxpgmafq.supabase.co,
which is not a local origin, while a local supabase_storage container is running. REFUSING to
attribute this machine's volume to that project: … NO project affinity …
exit=2
```

and it still **permits** the real case (`NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` →
`TOTAL files=245 bytes=2456666`). **N3** (`isLocalOrigin` → always true) reddens **C17 alone**,
so the guard is load-bearing rather than decorative. Placing it inside `locateVolume()` is the
right seam: `capture`, `delete`, `walk`, `selftest` and `rehearse` inherit one condition instead
of five copies — which is itself the fix for the *class* rather than the instance.

**No residual overclaiming.** I read §6 end to end. The blanket *"Both caveats below were measured
… not inferred"* header is gone, replaced by per-claim provenance that separates (b) measured,
(a) exit-code behaviour measured, (a) **Cloud consequence an inference never executed against
Cloud**. The false grain-conflating sentence is gone and its replacement states the grain
distinction explicitly. The new §6(c) is accurate. I found **no** sentence in §6 still claiming
Cloud measurement. ✅

---

## 2 · The nine-verdict enumeration — my judgement, as asked

**The count is right. `9` is correct, and it is correct two independent ways:** nine distinct
verdict *strings*, and nine `return` sites. I re-derived it from the body rather than trusting
either figure.

**⛔ My r1 "seven" was wrong, and I am recording the error rather than the correction.**
Pre-fix the function returned **eight** distinct verdicts; I wrote seven, in the very report whose
MAJOR-1 blocked on someone else's incomplete classifier enumeration. That is *"a census whose
parts don't sum is wrong"*, committed by the reviewer auditing exactly that class. The lead's
eight was right for the pre-fix body and nine is right for the post-fix body.

**⭐ But the enumeration is complete on NAMES and incomplete on PATHS, and that distinction is the
judgement you asked for.** `MISSING_BYTES` and `CONSISTENT_EMPTY` are each reachable from **two
structurally different states**. Enumerating by returned string therefore cannot be a coverage
claim — it counts the codomain, not the domain:

| # | reachable state | verdict | control |
| --- | --- | --- | --- |
| 1 | row absent + bytes present | `BUCKET_ABSENT_ORPHANED_BYTES` | C9 · R3d |
| 2 | row absent + no bytes | `BUCKET_ABSENT` | C10 · R5 |
| 3 | no local proof at all | `UNVERIFIED_NO_LOCAL_PROOF` | R6-capture (both polarities) |
| 4 | proof **errored** | `UNVERIFIED_PROOF_ERROR` | **C16 only — unit grain** |
| 5 | directory gone + API keys | `MISSING_BYTES` | C14 · R7 · R7-twin |
| 6 | directory gone + no keys | `CONSISTENT_EMPTY` | C15 |
| 7 | present, wrong both ways | `DIVERGED_BOTH_WAYS` | C18 · R8 |
| 8 | present, volume-only keys | `ORPHANED_BYTES` | R2 · R2b |
| 9 | **present, API-only keys — *partial* byte loss** | `MISSING_BYTES` | ⛔ **NONE** |
| 10 | present, sets agree, keys > 0 | `CONSISTENT` | R1 · R7-twin · R2b |
| 11 | present, sets agree, keys = 0 | `CONSISTENT_EMPTY` | R1x |

**Eleven paths, nine names, one path with no control at all** (#9) — plus #4 pinned only at the
unit grain, and the tail's byte-count blindness (MINOR-2) which is not a path at all but a state
*inside* paths 7–11 that no verdict distinguishes.

Path #9 matters specifically because **the code and the runbook both assert its behaviour**:
`verdictFor:453-455` says *"Same verdict as the partial-loss case, which is the point"*, and
runbook §6(c) rests the non-monotonicity story on *"losing some of a bucket's bytes was dirty
(exit 1)"*. Both are almost certainly true — but they are **asserted, not observed**, and C14/R7
both construct `present:false`, i.e. the *total*-loss route. **The claim that made MAJOR-1 legible
is the one claim in that story with no control.** Not blocking (the direction is more-dirty, not
less), but it is one line of selftest and it should exist before S6 cites the enumeration as
coverage. MINOR-3.

**Recommendation:** state the enumeration as *"nine verdicts over eleven reachable paths"* and keep
the path table, not the name count. A future reader who sees "all nine verdicts have controls"
will believe something stronger than what is true.

---

## 3 · The two claims I was told to test rather than take

### 3a · ⭐ CONFIRMED, and the Cloud position IS worse than r1 concluded

Constructed the diverged state through the real API plus the volume: `k1.bin` keeps its metadata
row and loses its bytes; `ghost.bin` gains bytes and has no metadata row. **Counts equal (5 API,
5 volume), sets disjoint in both directions.**

| run | result |
| --- | --- |
| **sighted** `capture` | `DIVERGED_BOTH_WAYS`, `orphan_keys=1`, **CAPTURE NOT CLEAN** ✅ |
| **blind** `capture` (docker off PATH = the Cloud shape) | `UNVERIFIED_NO_LOCAL_PROOF`, and the residual text reads *"The count-comparison gate still holds."* |
| **blind `delete --execute`** from that blind manifest | `deleted=5 manifest=5  **MATCH**` · **"ALL BUCKETS MATCHED THEIR MANIFEST COUNT"** · *"byte removal is UNVERIFIED from here"* |
| volume afterwards | **`vol_files=1  api_keys=0`** — a real byte survived a run that reported success |

**So the claim holds, and it is sharper than "two of four controls are lost."** The one control r1
concluded *does* transfer to Cloud — the `deleted === keyCount` comparison — **passed on a state
that was wrong in both directions simultaneously, and left a byte behind.** The structural reason
is the one already written in the runbook, now with a second demonstration: the comparison is
between the manifest and *itself as executed*, never between the manifest and reality. Equal
counts over disjoint sets is the general case that defeats it, and it is **constructible in four
shell commands**.

⭐ **The corollary for the record's own residual text is the part I would fix:** the blind capture
prints *"The count-comparison gate still holds"* — true as a statement about the gate running, and
**exactly the reassurance this measurement refutes.** MINOR-1.

⚠ **My own measurement error, disclosed:** my first pass reported *"blind capture exit=0"*. That
was `grep`'s exit status, not the tool's — I piped the run and read `$?` after the pipe. The
stdout facts above are unaffected (they are the tool's own printed lines), but the exit codes in
that first pass were not measured at all. Same family as this program's *"never pipe `e2e:prod`
through `tail`"* lesson, committed by me while auditing exit-code claims.

### 3b · ⭐ CONFIRMED — the assertion-grain lesson, and it generalises

Under **N2** (`DIVERGED_BOTH_WAYS` return neutralized so the state falls through), R8 reported:

```
NOT OK  R8 … — verdict=ORPHANED_BYTES exit=1 api_keys=5 volume_keys=5 (counts EQUAL, sets disjoint)
```

**The exit code stayed 1.** Only the verdict-name assertion discriminated. So an arm asserting
only `exit === 1` would have passed a run in which the verdict under test had been deleted.

**The general statement, worth carrying beyond this arm:** `CLEAN_VERDICTS` partitions nine
verdicts into two buckets, so **an exit code is a CLASS assertion, never an IDENTITY assertion.**
Any mutation that swaps one non-clean verdict for another — six of the nine — is invisible to it.
The rule that follows: *an arm must assert the identity it names, not the bucket that identity
falls into.*

✅ **And I checked whether the suite currently violates it:** I scanned every `exit === N`
predicate in both harnesses and **found no exit-only arm** — each is paired with a verdict name or
a distinctive message regex. So this is a **near-miss and a discipline**, not a live gap. Stating
it as a live gap would be the overstatement r1 objected to elsewhere.

---

## 4 · Ruling on the two verdicts pinned at the `verdictFor` grain only

**`UNVERIFIED_PROOF_ERROR` (#4): the structural reason is SUFFICIENT. Accepted.** It is not
"unlikely" wearing better clothes, and the distinction is testable: *"unlikely"* would be a claim
about how often a `docker exec` fails; the reason given is a claim about **what constructing it
would require** — a stub inside the measurement path. The rehearsal's whole value is that it runs
the real code against real bytes; a stubbed `docker` would make it a test of the stub. That is the
same principle that made *"P4 NOT MEASURED"* the right call over a fabricated `file_objects` row —
*a fabricated baseline is worse than a missing one* — and it should be cited as the same
principle, because consistency is what makes it a rule rather than an excuse.

⚠ **Two conditions on that acceptance, and they are cheap:**
1. **The unit pin must assert the mapping from the real producer's shape, not a hand-written
   object.** C16 passes `{present:false, error:'docker exec failed', …}`. That is the shape
   `volumeCensus`'s `catch` builds — I verified it at source (`{present:false, error:String(e),
   keys:[], files:0, bytes:0}`) — so the pin is anchored on the producer, not on a guess. ✅ As
   built, this condition is already met; it needs recording, because if `volumeCensus`'s catch ever
   stops setting `error`, C16 keeps passing while the plumbing goes blind. **A comment naming
   `volumeCensus`'s catch as C16's contract would make that couple visible.**
2. There *is* a non-stubbing route, and it should be named as the reason rather than left
   unmentioned: `volumeCensus` is called with a bucket list, and a name that is invalid as a shell
   path component would make its `docker exec` fail for real. I did **not** pursue it (it would
   mean feeding the tool a deliberately malformed bucket name, whose blast radius on the
   destructive path I am not willing to explore in a review), but *"no non-stubbing route exists"*
   would be a stronger claim than has been established. Say *"none we are willing to construct
   safely"*.

**MINOR-2's tail-branch state (byte counts vs key sets): NOT sufficient as a grain argument,
because no grain argument was made** — it simply has no control at either grain. §4's guard-set
table lists the tail as consulting *"`apiKeys` · `proof.keys`, both directions"*, which is
accurate and is precisely the omission: `proof.files` and `proof.bytes` are in the same object and
are not consulted. One-line remedy: after the set comparisons, `if (proof.files >
proof.keys.length)` emit a residual (or a distinct verdict) — and a selftest twin proving a
matched census stays `CONSISTENT`.

---

## 5 · ⭐ Closing MY OWN gap — the drill and the baseline are no longer single-sourced

`backend` was right to hand this back rather than let it pass, and filing it as its NOT-COVERED
item 17 was the correct move. r1's items 8.2/8.3 are now **closed by independent measurement.**

### 5a · The backup/restore drill — re-measured from scratch. **The headline is REAL.**

Dumped the live schema with `supabase db dump --local` (2,556,521 bytes, read-only on the source),
replayed into two scratch databases in the same container, compared catalogs with the runbook's
own query, dropped both. Live DB untouched; `pg_database` holds no `qa_s5%` row afterwards.

| | source `postgres` | **ARM A** bare DB | **ARM B** + 3 schemas & 2 stub fns |
| --- | --- | --- | --- |
| `psql` exit code | — | **0** | **0** |
| errors (`ERROR:` lines) | — | **490** | **0** |
| … `schema … does not exist` | — | 193 | — |
| … `relation … does not exist` | — | 281 | — |
| tables (`public`) | **165** | **161** | **165** |
| rls_enabled | 165 | 161 | 165 |
| **policies (`public`)** | **274** | **⛔ 90** | **274** |
| functions (`public`+`app`) | 970 | 968 | 970 |
| definers | 773 | 771 | 773 |
| triggers | **235** | 216 | **⚠ 227** |

**✅ Confirmed: `psql` exit 0, 490 real errors, 90 of 274 policies — 67.2% of the RLS boundary
lost, on a restore that reported success.** Every figure in the record's ARM A column reproduces
exactly. The finding is real and the headline is earned.

**⚠ Correction 1 — the `^ERROR` anchor story is INVOCATION-DEPENDENT, and my run came out the
opposite way round.** The record (and runbook §"VERIFIED GOOD") says `grep -c '^ERROR'` returns
**0** because *"psql prefixes errors with `psql:file:line:`"*. In my run — `psql < dump.sql`, i.e.
**stdin** rather than `-f` — bare `^ERROR` matched **490** and the `psql:…:` form matched **0**:
the exact inverse. psql only prefixes when it is reading a *named* input. **The lesson survives
and is strengthened** — an anchor bound to a syntax rather than to the property was wrong in one
invocation and right in the other, which is worse than being simply wrong. But the runbook's table
states one invocation's behaviour as a general fact. MINOR-4.

**⚠ Correction 2 / NEW FINDING — ARM B does NOT reach full parity: triggers 227 vs 235, with ZERO
errors reported.** The record says the prepared target *"took errors 490 → 10 and both tables and
policies to full parity"* — literally true and narrowly scoped, and I confirm tables, policies,
functions and definers all reach parity. **Triggers do not: 8 are missing, and nothing said so.**
Exit 0, zero errors, and a catalog that still differs. ⭐ **This is the same class as MAJOR-1 one
layer out — and it is also the best possible argument for the runbook's own rule**, because the
comparison query *includes* `triggers`, so an operator following §"VERIFIED GOOD" **would catch
it and correctly refuse.** The control is adequate; the record's *"full parity"* phrasing is what
invites the wrong reading, and it matters because the retention rule lets "verified good"
authorise destroying the only other copy. MINOR-5. (My ARM B saw 0 errors where the record saw 10
— an environment/invocation difference, not a contradiction; the direction and magnitude are
identical.)

### 5b · The P2 baseline — re-measured. **The finding and its magnitude are real.**

Same securable, real `test_helpers.claims_for` claims, `set local role authenticated`, +2000
synthetic rows on that one securable, `analyze`, all inside one **rolled-back** transaction
(verified: `documents` back to 3 rows afterwards).

| | mine | record |
| --- | --- | --- |
| N=3 · rows returned | 1 (2 removed by filter) | — |
| N=3 | **0.463 ms**, 24 buffers | 1.312 ms, 343 buffers |
| N=2003 | **353.808 ms**, **26 867 buffers**, rows=2001 | 363.925 ms, 24 201 buffers |
| plan | **Seq Scan on documents**, `Filter: (… home_resource_id = … AND app.can_read_document(id, (InitPlan 1).col1))` | same |

**Same shape, same order of magnitude, same conclusion:** a Seq Scan with the DEFINER read
predicate evaluated **per row** (~13 buffers/row, ~0.18 ms/row), and no index on
`home_resource_id` (`pg_indexes`: `documents_pkey` only — re-verified). The ~3% time and ~11%
buffer differences are consistent with a different column projection. **Nothing in the P2 finding
is single-sourced any more.**

⚠ **What this does NOT close, and it applies to the record's numbers as much as mine:** neither
measurement executes PostgREST's generated SQL. `listDocumentsForResource` selects `LIST_SELECT`
with embeds and two further filters; from `psql` that cannot be reproduced. The *entry point* was
correctly identified from real code, but *"real call paths from step 0 §E, not hand-written
proxies"* overstates it — both are **shape-faithful proxies**, and the honest claim is that the
plan shape and the per-row cost are real. INFO-2.

---

## 6 · MINOR (6)

**MINOR-1 — the blind capture's residual still says *"The count-comparison gate still holds."***
`scripts/storage-manifest.mjs:451`. §3a measured that gate passing over a both-ways-diverged
bucket while a byte survived. The sentence is true about the gate *running* and is the exact
reassurance the measurement refutes — on the one code path whose entire purpose is to tell a Cloud
operator what they can still trust. Suggest: *"the count comparison still runs, and it is blind to
any divergence with equal counts — R8."*

**MINOR-2 — the tail branch calls a bucket `CONSISTENT` while its byte census disagrees.**
Measured (§1): 5 keys / 5 volume keys / **6 volume files** → `CONSISTENT`, `orphan_files=0`,
CAPTURE CLEAN, exit 0. Graded MINOR on measured non-reachability (an API upsert replaces the
version file in place — measured), and it becomes MAJOR if any future Storage version retains
versions. Remedy in §4.

**MINOR-3 — path #9 (`MISSING_BYTES` via *partial* byte loss) has no control at either grain**,
yet both the code comment and runbook §6(c) assert its behaviour. One selftest line
(`verdictFor({exists:true, apiKeys:['a','b'], proof:{present:true, keys:['a'], files:1, bytes:1}})`
⇒ `MISSING_BYTES`) closes it. See §2.

**MINOR-4 — the runbook's `grep -c '^ERROR'` row states one invocation's behaviour as general.**
Measured inverse on stdin (§5a). Either scope the row to `-f`, or drop the anchor and keep the
rule that survives both: *count nothing, compare the catalog.*

**MINOR-5 — "full parity" in the ARM B account is narrower than it reads: triggers 227 vs 235
with zero errors reported** (§5a). Say which four dimensions reached parity and which did not; the
comparison query already catches it, which is the point worth making.

**MINOR-6 — the runbook says `rehearse` has "18 controls"; it has 19.** `phi-disposal-runbook.md`
§6, *"Practical consequence"*. Measured: `rehearse` 19/19, `selftest` **18**/18 — the runbook has
selftest's number. A stale count in the operational document, in the commit that corrected other
stale counts. (The record itself is correct: 19/19 and 18/18.)

---

## 7 · INFO (6)

**INFO-1 — my r1 verdict count was wrong (seven; the pre-fix body had eight).** Recorded as my
error, in §2, because the report it appeared in blocked on an incomplete enumeration.

**INFO-2 — "real call paths, not hand-written proxies" overstates both P2 measurements** (§5b).
Both are shape-faithful proxies; PostgREST's SQL is not reachable from `psql`.

**INFO-3 — my first §3a pass mis-read a pipe's exit status as the tool's** (§3a). Disclosed
because the finding is *about* exit codes.

**INFO-4 — the four r1 corrections I asked for are all applied, and better than requested.**
`plan(12)` restored with §1c **kept and marked REVERSED** (the reasoning preserved as the
transferable part — the right call); the class headline replaced with the proxy-substitution
statement and MAJOR-1 added as instance 6, third variant *"I looked at the wrong thing"*; the
frequency claim withdrawn in **both** files with the historical/Cloud halves kept; MINOR-3's key
custody now forces one of three named modes with the exact log wording each permits — including
*"no key copy existed to destroy"* and the warning that mode A makes the archive unrecoverable by
anyone else. The sync-root check is now a **function** that returns rather than `exit`s,
case-insensitively matched on the resolved physical path, with the git half **failing** instead of
echoing, and the "not exhaustive" caveat stated. The archive verification now compares
same-denominator counts by construction. All four exceed what r1 asked.

**INFO-5 — the standing-ARM N/A argument is now made rather than left as silence** (r1 MINOR-9),
and it is the argument I reached independently: the subject is bit-identical to the pre-slice
catalog because `343` runs inside `begin … rollback`. I re-verified the two facts it rests on
(`pg_proc` holds no `dm5_s5%` row; policies = 274).

**INFO-6 — C16's contract is anchored on the real producer's shape** (I verified `volumeCensus`'s
catch builds exactly `{present:false, error, keys:[], files:0, bytes:0}`), but nothing in the code
records that couple. One comment naming the catch as C16's contract prevents a silent decouple.

---

## 8 · ⛔ NOT TESTED / NOT COVERED — binding

**Everything in the record's own §6 (18 items) is carried forward**, except item 17, which I have
now closed (§5) and which should be rewritten rather than left asserting that QA did not measure.
Specifically still open and unrelieved: **P4 `open_document_version` has no baseline**; P1 has no
volume curve; `--allow-orphans` is unfixed; the `catch` arm of the *delete* classifier is
uncovered; `cmdDelete`'s `left` filter still skips metadata-without-bytes buckets on the
destructive path; the runbook sequence is **UNREHEARSED** (including the `7z -si -p` tty
question); the Cloud byte half is unverifiable from here; PITR entitlement is UNDETERMINED.
Additionally, from this round:

**8.1 — `e2e:prod` NOT run: deferred by PO decision, and I concur** (reasoning in r1 §8.1,
unchanged — the remediation since r1 touched one Node script, one pgTAP file, one vitest file and
Markdown; `src/lib/documents/actions.ts` is untouched by all four commits, so the zero-runtime-
footprint premise still holds). **DM5 cannot exit without it**; S1–S4 changed runtime behaviour.

**8.2 — path #9 and the tail's byte-count blindness are UNCOVERED BY ANY CONTROL** (MINOR-2/3). I
measured the second and reasoned the first; neither has an arm in either harness.

**8.3 — `UNVERIFIED_PROOF_ERROR` remains unproven end to end**, accepted on the structural reason
(§4) with two recorded conditions. The mapping is observed; the plumbing from a genuine `docker`
failure to that verdict is not, and *"no non-stubbing route exists"* is not established — only
"none we are willing to construct safely".

**8.4 — the project-affinity guard has never run against Cloud, and its Cloud consequence remains
an inference.** I made no remote contact. What is measured is: it refuses a Cloud-shaped URL
against a live local stack, it permits loopback, and C17 pins both polarities. What is inferred
is what would have happened without it.

**8.5 — I did not re-measure the `docker cp` byte-backup timing, the 68-PHI-tier file count, or
P1/P3/P4.** These remain single-sourced to `backend`. I judged that acceptable: the byte census
they rest on (245 files / 2,456,666 bytes / `phi_tier_keys=68`) I have now reproduced four times
across this review, and none of them carries a rule the way 90-of-274 does.

**8.6 — the DIVERGED count-blindness measurement is LOCAL.** It establishes a property of this
tool's code under a forced no-local-proof branch. It is **not** a Cloud measurement, and the
inference to Cloud is the same source-level bridge as MAJOR-2's — now guarded, still an inference.

**8.7 — r1's closing warning stands verbatim, and this round is its second confirmation.** Both r1
blocking items came from constructing a state nobody had constructed; **both r2 findings came the
same way** (MINOR-2 from manufacturing version residue, §3a from manufacturing equal-count
divergence). **I make no claim that the remaining unconstructed states are safe.** The measured
base rate for this artifact is now: every time someone builds a state the harness never built,
they find something.

---

## 9 · Why APPROVED

Both blocking items are fixed at the right seam, authored red-first, and **re-proved by
neutralization on my own runs** — including the one claim that most needed re-running (C15 passing
pre-fix) and the one that most needed refuting (it did not need refuting). The guard-set diff I
asked for found a gap **I had missed**, which is the method outperforming the reviewer. The
runbook's Cloud section now carries per-claim provenance and no longer claims measurement for an
inference. The nine-verdict enumeration is arithmetically right, and my objection to it is a
framing one (names vs paths) with one genuinely uncovered path behind it — not a defect in what
was built. The two claims I was told to test both hold, and one of them makes the Cloud position
**worse** than r1 concluded, which is now recorded rather than discovered later. My own gap is
closed: the loudest number in the slice — *a restore reports success and loses 67% of RLS* —
reproduces exactly, independently, and produced two corrections and a new finding on the way.

Six MINORs remain. None is a blocking requirement, none is a security boundary, and the three that
touch the tool are one line each. **MINOR-6 (a stale control count in the operational runbook) and
MINOR-1 (a residual sentence that reassures against a measured fact) are the two I would take
before S6**, because both live in documents an operator reads under pressure.
