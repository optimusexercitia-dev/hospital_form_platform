# DM5 · S5 — operational closure (S5.D, drill, baselines)

> Backend record. Run 2026-08-17 on `main`, local stack
> `supabase_db_azkbbhskturikxpgmafq` / `supabase_storage_azkbbhskturikxpgmafq`.
> Predecessor context: **S5.R is complete and lead-verified at `e5a1418e`** and was
> not redone. Step 0's surface verification
> ([dm5-s5-surface-verification.md](./dm5-s5-surface-verification.md)) was used as
> given, not re-derived.
>
> **Every schema / RLS / RPC / grant claim below is a live-catalog read**
> (`pg_proc` incl. `prosecdef`, `pg_policies`, `pg_trigger`, `pg_indexes`,
> `information_schema`), never migration text. Script-behaviour claims are either
> executed live or read from source, stated per claim.
>
> ⛔ **No `supabase stop`/`start`.** No `npm run e2e:prod`. The one
> `supabase db reset` was announced and lead-acked before it ran.

## 0 · What landed, in commit order

| commit | unit |
| --- | --- |
| `d2b19808` | `scripts/storage-manifest.mjs` — the MISSED-vs-orphan message fix + rehearsal arms R3c/R3d + the INDETERMINATE reachability fix |
| `7542f075` | the disposal-completion gap pinned on both sides + the false comment at `actions.ts:277` corrected |
| `bee1bf8f` | `docs/deployment/phi-disposal-runbook.md` |
| `09efbe5f` | three follow-ups filed (one as a class) + follow-up id unification |
| this file | the record, the drill, the baselines |

## 1 · The inherited artifacts were UNREVIEWED, and both carried real defects

Both arrived uncommitted from the previous `backend`. Reviewed as someone else's
work, which is what they were.

### 1a · The pgTAP keystone had never been executed

`plan(11)` against 12 assertions was the smaller half. **The detector detected
itself.** Both `pg_temp` helper functions carry the literal
`complete_document_disposal` in their own bodies (an `ilike` pattern; an `execute`
string), and `pg_temp_N` functions are ordinary `pg_proc` rows. First execution:

```
# Failed test 2: "K2 positive control …"
#         have: {pg_temp_44.dm5_s5_completion_callers,pg_temp_44.dm5_s5_scheduled_callers,public.dm5_s5_gap_probe}
#         want: {public.dm5_s5_gap_probe}
# Failed test 3 (K3a) … # Failed test 5 (K4) …
# Looks like you planned 11 tests but ran 12
  Parse errors: Bad plan.  You planned 11 tests but ran 12.
```

**A red for a reason that is not the property is the dangerous kind** — the natural
"fix" is to relax the assertion until it is green, which would have neutered K4
permanently. Fixed by bounding the census to non-temp/non-toast schemas, and by
excluding the door's own row **schema-qualified** rather than by bare name
(catalog-verified that `public` is its only holder, so a later
`app.complete_document_disposal` surfaces as a red to look at instead of being
silently excluded by a name match).

Note also what the plan mismatch did to the report: `Failed tests: 2-3, 5, 12` —
**test 12 was listed as failed purely because of the bad plan**, on a file whose
entire job is to go red at one named assertion. That is the masking the lead
predicted, observed.

### 1b · Two claims in that header were false, and were REPAIRED rather than deleted

- The header asserted a **red-first observation that had not happened.** Made true
  instead of removed: created a real caller in `public` out of band → K4 RED
  naming `public.dm5_s5_redfirst_probe`, exit 1 → dropped → `pg_proc` verified to
  hold no `dm5_s5%` row → 12/12 PASS. *The tempting alternative — delete the claim
  and keep the green — leaves a keystone nobody has ever seen fail.*
- An unverifiable **"FIVE instances"** count was softened to "repeated". An
  unverified number in a comment is precisely the defect that file exists to pin.

### 1c · `plan(N)` → `no_plan()` — ⛔ REVERSED AT QA r1, see §6d correction 1

> **This section records a decision that was WRONG and has been undone.** `plan(12)`
> is restored. Kept rather than deleted because the error was in the *reasoning*, not
> a typo, and the reasoning is the transferable part: the comparison below weighs
> `no_plan()` against a *wrong* `plan(N)` without noticing that the two fail in
> **opposite directions** — a wrong plan fails **safe** (a noisier red on a run
> already exiting 1; it never produced a false green), while silent assertion loss
> under `no_plan()` fails **open**. The trade-off "disclosure" below is accurate about
> the cost and wrong about which side to take. Full correction: **§6d**.

Measured both halves on this stack rather than assuming: a `no_plan()` file that
**aborts mid-run FAILS** (`Parse errors: No plan found in TAP output`,
`Non-zero exit status: 3`, Result FAIL, exit 1); its clean twin passes exit 0. So
derivation does not trade the masking failure for a silent one.

⚠ **What it genuinely costs**, disclosed in-file and here so QA rules on it rather
than discovering it: `plan(N)` catches **silent assertion loss** ("planned 12, ran
11"); `no_plan()` does not — a deleted assertion just makes the file smaller with
no complaint. The compensating control is the gate's **suite-wide total**, which
moves if an assertion vanishes anywhere — but that is a **lead-side figure compared
by a human at gate time, not an in-file guard**, and it is weaker than a per-file
plan. This file is the **1-of-195 deviation**; a future reader should not "restore
convention" without re-running both halves of the abort check.

### 1d · ⛔ The INDETERMINATE branch was unreachable in the state that needs it

Building the missing control (R3d) for "bucket row ABSENT + bytes PRESENT" — the
state step 0 named as never observed, with no control anywhere in the tool —
inverted the branch's premise:

**`.list('')` on a bucket whose row is gone returns `{data: [], error: null}` — an
empty list, not an error.** So *"I could not ask"* and *"I asked and there is
nothing"* were the same value, and the classifier printed the **reassuring** arm —
*"PRE-EXISTING METADATA-LESS ORPHANS … not a failure of this deletion"*, **no
`DO NOT PROCEED`** — on the **destructive path**, for a bucket it had never
interrogated. Now gated on `getBucket`, which does error.

⚠ **The frequency reason recorded here was WRONG IN THE PRESENT TENSE, and is
withdrawn** (QA MINOR-6). It read: *"bucket row absent + bytes present is exactly
the state all eight retired buckets are in."* **Measured today, the eight retired
buckets hold 0 bytes and have no directory on the volume** — the volume root holds
only the four survivors. They **were** in that state between the retirement
migration and the stack recovery that destroyed the 221 files, and a **Cloud**
retirement produces it **by construction**. True historically, true for Cloud,
**false as written.** In a phase whose recurring defect is a present-tense claim
about a state that has moved, that sentence was the defect.

⭐ **And it was never the load-bearing reason.** R3d's own justification is
sufficient and appeals to no frequency at all: *the classifier printed the
reassuring arm, with no `DO NOT PROCEED`, **on the destructive path, for a bucket it
had never interrogated.*** That is the reason to lead with.

The refusal summary was also rewritten: the indeterminate-only case previously
printed *"0 key(s) survived that the manifest did not list"* **inside a STOP**. A
refusal whose own numbers look benign is how a STOP gets ignored.

### 1e · Verification of the tool after four accumulated changes

| check | result |
| --- | --- |
| `rehearse` | at this point **16/16, exit 0** — the **14 pre-existing arms all still pass**, plus R3c and R3d. **Now 22/22** after QA r1 added R7/R7-twin, the enumeration added R8, and QA r2 added R6-residual/R9/R9-monotonic (§6d, §6e, §6f) |
| `selftest` | at this point **13/13, exit 0** — all originals intact (lead-requested re-check). **Now 18/18** after QA r1 added C14/C15/C16/C17 and the enumeration added C18 (§6d, §6e) |
| storage volume | **byte-identical to step 0: 245 files / 2,456,666 bytes**, `phi_tier_keys=68`, zero `dm5-%` buckets left |

## 2 · S5.D — the disposal gap, pinned on both sides

PO ruled: **document the gap, do NOT build the job.** Nothing was built.

**The false comment.** `src/lib/documents/actions.ts:277-278` asserted in the
present tense that *"the disposal job + service-only completion door do the
verified deletion."* Both halves false: there is no disposal job, and
`complete_document_disposal` has exactly one caller in the repo —
`reclassifyDocument`, an unrelated copy-then-retire lane. Corrected to state what
is true (the fail-closed half IS real and DB-enforced), what is not, and where the
manual mitigation lives.

**Both pins were observed RED against real mutations**, because a pin nobody has
seen fail is not a pin:

| pin | mutation | observed |
| --- | --- | --- |
| `supabase/tests/343_dm5_s5_disposal_gap.sql` | real caller created in `public` out of band | K4 RED naming `public.dm5_s5_redfirst_probe`, exit 1 → reverted → 12/12 |
| `src/lib/documents/disposal-gap.test.ts` | probe module with `admin.rpc('<door>')` in `scheduledDisposalSweep` | THE GAP assertion RED, reporting the **file and the function** → deleted → 10/10 |

The TS half is an AST census (comment-immune structurally, since comments are not
AST nodes) with two layers — `.rpc('<door>', …)` call sites and a superset of all
string literals equal to the door name — so a future indirection through a
constant is caught rather than silently going blind. It runs three positive
controls **every run**: an in-memory fixture, a **real file written into a temp
directory and walked** (covering the walk, not just the parse), and a denominator
anchor. Its root is asserted at module load, because a wrong cwd would make every
"no caller" assertion vacuously green.

⚠ Its own self-detection trap was pre-empted: `DOOR` is assembled from fragments
so the file is not a match for its own detector, and test files are excluded from
the census by a principled rule (a test is not a disposal job) whose cost is
stated.

## 3 · Backup/restore drill — DB and Storage TOGETHER, executed

### 3a · ⛔ THE FINDING: a restore can report success and silently lose 67% of RLS

Executed: dumped, then **replayed into a fresh database** in the same container
(nothing existing touched), then compared catalogs.

| | source `postgres` | bare-DB restore (ARM A) | + 3 empty schemas & 2 stub fns (ARM B) |
| --- | --- | --- | --- |
| `psql` exit code | — | **0** | **0** |
| true error count | — | **490** | **10** |
| tables (`public`) | 165 | **161** | 165 |
| **RLS policies (`public`)** | **274** | **⛔ 90** | **274** |
| DEFINER functions | 773 | — | 773 |
| **triggers** | **235** | 216 | **⛔ 227 — NOT parity** |

**`supabase db dump`'s output is not a standalone restore artifact.** Replayed onto
a bare Postgres it produces 490 errors (193 × `schema "X" does not exist`, 281 ×
`relation "X" does not exist`) and yields a database that *looks* restored — 161
tables with RLS enabled — while **two thirds of the security boundary is missing.**
Diagnosis confirmed by a second measurement: pre-creating empty `auth`, `storage`,
`extensions` plus stub `auth.uid()`/`auth.role()` took errors 490 → 10. The supported
restore target is therefore a **Supabase-initialized** database (locally
`supabase db reset` first; on Cloud PITR / `db push` + seed).

⛔ **CORRECTED at QA r2 — ARM B does NOT reach "full parity", and my saying so was
the same defect one layer out.** I measured tables and policies, saw both match, and
generalised to "full parity" without checking the other columns. Re-measured
independently (I re-ran ARM B rather than inherit QA's figure): **triggers 227 vs
235 — eight missing, with only 10 errors reported.** Parity holds on tables (165),
policies (274) and DEFINER functions (773); it does **not** hold on triggers.

**Which eight, because it changes the conclusion** — diffed by name from
`pg_trigger`:

```
auth.users.on_auth_user_created            storage.buckets.protect_buckets_delete
auth.users.on_auth_user_email_changed      storage.objects.protect_objects_delete
auth.users.on_auth_user_email_confirmed    storage.objects.update_objects_updated_at
realtime.subscription.tr_check_filters     storage.buckets.enforce_bucket_name_length_trigger
```

All eight are on **platform-managed tables** that my empty stub schemas never
created — hence exactly 8 `relation "X" does not exist` errors. So they are not
application triggers that failed to restore; they are the **platform surface my
diagnostic never built.**

⛔ **Two of them are `protect_buckets_delete` / `protect_objects_delete`** — the very
guards ADR 0120 D9 and this whole phase rely on to stop a raw metadata delete — and
one is `on_auth_user_created`, the profile-provisioning hook. So the honest statement
is: **ARM B was a DIAGNOSTIC that isolated a cause, never a valid restore.** Calling
it "full parity" invited a reader to treat hand-stubbed schemas as a restore
procedure, which would produce a database with **no storage delete protection and no
profile provisioning** — and 10 errors, exit 0, tables and policies all matching.

⭐ **This strengthens the drill's conclusion rather than weakening it, and it is the
strongest argument for the runbook's own comparison query** (§"VERIFIED GOOD"), which
includes `triggers` and would therefore **correctly refuse** this restore. The rule
was written to catch exactly the class its own author had just fallen into.

⛔ **Two false signals aligned to nearly produce a confident wrong conclusion, and
I am recording my own error because it is the transferable part:** `psql` without
`ON_ERROR_STOP` **exits 0 while statements fail**, and my first error count used
`grep -c '^ERROR'`, which matched **0**. I briefly held "restore succeeded, 0
errors". Only the **catalog comparison** exposed it.

⚠ **CORRECTED at QA r2 — my explanation of the anchor was stated as a property of
`psql` and it is a property of the INVOCATION.** Re-measured both ways on this stack
with a two-error script:

| invocation | `grep -c '^ERROR'` | `grep -c 'ERROR:'` | first line |
| --- | --- | --- | --- |
| `psql -f file.sql` (**what the drill used**) | **0** | 2 | `psql:/tmp/errs.sql:1: ERROR:  division by zero` |
| `psql < file.sql` (**stdin**) | **2** | 2 | `ERROR:  division by zero` |

So the record's *"psql prefixes errors with `psql:file:line:`"* is true **only for
`-f`**; on stdin there is no prefix and `^ERROR` works perfectly. My measurement of
0 was correct for my invocation; the **generalisation** was not. ⭐ **The lesson
survives and is strengthened:** the correctness of a count depends on **how you
invoked the thing you are counting with** — an anchored pattern is a bet on an output
format that the same binary changes between invocations. `grep -c 'ERROR:'`
(unanchored) is right in both. *A detector validated under one invocation is not
validated.* *An operator who replays a dump and checks the
exit code will believe the restore worked.* Same family as this program's
["Nothing failed ≠ nothing ran"](../../.claude/…) lesson and the enumeration-boundary
class — the bound was a syntax, not the property.

`pg_dump` also warns on its own account that `--data-only` may not restore at all
without `--disable-triggers`, naming circular FKs on `case_referral`, `responses`,
`form_items`, `organizations`↔`profiles`, `controlled_documents`↔`controlled_document_versions`,
`response_group_instances`, `accreditation_frameworks`.

### 3b · Does the DB backup carry the Storage metadata? YES — measured

Settled by measurement, not by reading the invocation (`--debug` does not print the
`pg_dump` argv). Created **one** object in a scratch bucket through the Storage
API, re-dumped, and looked: the data dump contains `INSERT INTO "storage"."objects"`
**and** `"storage"."buckets"` (it excludes Supabase-internal `storage.migrations`,
61 rows). Torn down through the same API — verified `objects=0`, `buckets=4`, zero
`dm5-%` buckets, volume back to 245 files / 2,456,666 bytes.

⚠ A near-miss worth recording: an earlier grep for `COPY storage\.` returned 0 and
I almost filed *"the DB dump does not carry storage metadata"* — **false**. The dump
uses `INSERT INTO "storage"."objects"`, so neither `COPY` nor `storage\.` (with a
literal dot) can match. Caught before it was written down.

### 3c · The Storage byte half — executed, and what "restore" even means

Executed a byte backup of the live volume with `docker cp` (read-only on the
volume, **no stack cycle**): 1.1 s, and **verified against the live census** —
**245 files / 2,456,666 bytes**, per-bucket parity (`documents-standard` 156,
`documents-phi` 68, `form-assets` 12, `meeting-audio` 9).

**What "restore" means for the byte half — plainly:** there is no supported restore
operation. There are only two mechanisms, and neither is a Storage restore:

1. **Object-by-object re-upload** through the Storage API (`supabase storage cp`).
   Portable to Cloud, but it enumerates from `storage.objects` — so **right now it
   would back up 0 of the 245 files present**, because `storage.objects` holds 0
   rows while the bytes sit on the volume. *A Storage backup taken through the API
   is a backup of the metadata's opinion of Storage.*
2. **Whole-volume snapshot** (what was executed). Captures bytes with byte-exact
   fidelity — and captures **every orphan too**, since it is Supabase-unaware. It
   is **LOCAL-ONLY**; no Cloud equivalent is available to us.

**The two halves are not peers, and the asymmetry is the point.** The DB half has
first-class tooling and a verifiable restore path; the byte half has neither. And
they are captured at **different instants with no coordination**, so a restore can
land in either mismatch direction: metadata without bytes (downloads 404) or bytes
without metadata (**the 245-orphan state, which is exactly what a `db reset`
produces**).

⛔ **Connection to FUP-DM5-STACK-CYCLE-DESTROYS-BYTES, which is the reason this
section matters:** the mechanism most likely to be reached for during a real
incident — a `supabase stop`/`start` recovery — is the one already confirmed to
**destroy** this exact volume. It is not a backup path; it is the failure that
already cost 221 files (15 PHI-tier). **The drill was executed without cycling the
stack, deliberately.**

⚠ **A Storage backup is a PHI export.** The `docker cp` copy contained **68
PHI-tier files** in plaintext, outside every platform control. My copy was deleted
after verification. Any real backup procedure must state where the copy lives, who
can read it, and its retention — otherwise the backup is itself a Rule-12
exposure. **This is not currently written down anywhere and is not in scope to fix
here.**

**NOT EXECUTED, and why:** restoring the volume snapshot back *into* the live
volume (it is a write to the live storage volume and could manufacture the exact
orphan state under study); Cloud PITR / `supabase backups list|restore` (requires
the linked project — still UNDETERMINED whether PITR is enabled for this project);
a full end-to-end `reset + replay` restore (the dump was taken from the seeded DB,
so replaying it onto a freshly reset DB collides on primary keys — it would measure
conflict handling, not restore fidelity).

## 4 · EXPLAIN + latency baselines — list / open / sign

Real call paths from step 0 §E, not hand-written proxies. **Every measurement runs
as `authenticated` with real JWT claims** (`test_helpers.claims_for`), because a
plan taken as `postgres` bypasses RLS and is a plan of a different query. All
inside one **rolled-back** transaction.

**N at measurement time** (a baseline without its volume is not a baseline):
`documents=3` · `controlled_documents=3` · `document_versions=3` ·
`securable_resources=22` · `commissions=6` · **`file_objects=0`**.
Synthetic arm: **+2000 `documents`** on a single CCIH securable, `analyze`d, then
rolled back.

| path | entry point | N=3 | N=2003 |
| --- | --- | --- | --- |
| **P1** list (register) | RPC `list_commission_documents(commission)` | 3.699 ms (1069 buf) | 0.736 ms (27 buf) |
| **P2** list (per-resource panel) | `.from('documents').eq('home_resource_id', …)` | 1.312 ms (343 buf) | **363.925 ms (24 201 buf)** |
| **P3** open (detail projection) | `.from('controlled_documents').eq('id', …)` | 0.050 ms | 0.019 ms |
| **P4** open/sign (bytes) | RPC `open_document_version(dv)` | ✅ **8.2 ms cold · 3.8–4.0 ms warm** (1562 → 121 buf) — measured 2026-08-17 | **not taken** — see below |

⚠ **P1's two numbers are NOT a volume curve, and reporting them as one would be
false.** It returned `rows=2` at **both** volumes — `list_commission_documents`
reads the *controlled* documents population, which the synthetic `public.documents`
rows are not part of. The 3.699 → 0.736 ms drop is first-call plpgsql
compilation/cache warming (1069 → 27 buffer hits), not an improvement from more
data. **To baseline P1 properly, the synthetic volume must be `controlled_documents`
rows — not done here.** Its honest baseline is: ~3.7 ms cold, ~0.7 ms warm, at 2
rows.

⭐ **P2 is the real finding, and it is actionable.**

```
Sort (actual time=363.788..363.858 rows=2001)
  -> Seq Scan on documents d (actual time=0.475..362.981 rows=2001)
       Filter: ((deleted_at IS NULL) AND (home_resource_id = '…'::uuid)
                AND app.can_read_document(id, (InitPlan 1).col1))
       Buffers: shared hit=24201
```

- **`public.documents` has only `documents_pkey`** — verified in `pg_indexes`.
  **No index on `home_resource_id`**, the column every per-resource panel filters
  on. Hence a Seq Scan at both volumes.
- The RLS predicate `app.can_read_document(id, uid)` is evaluated **per row** —
  ~24 201 buffer hits for 2001 rows ≈ 12 buffers/row, ~0.18 ms/row. The cost is
  the per-row DEFINER call, not the scan.
- Shape: roughly linear in rows-on-that-resource, with a heavy per-row constant.

⚠ **Bounding the claim:** 2000 documents on a *single* securable is a stress
distribution — the worst case for this query — and whether it is realistic is a
product question, not something this measurement answers. **The durable finding is
the per-row RLS cost and the missing index; the absolute 364 ms is specific to that
distribution.** Candidate responses (not decided here): an index on
`(home_resource_id) WHERE deleted_at IS NULL`, pagination in the panel, or a
cheaper read predicate.

**P4 — ✅ MEASURED 2026-08-17 (pre-S6), by meeting the prerequisite this section named.**

_(Original entry, kept because the refusal was right: `file_objects` holds **0 rows** on a
fresh reset, and a synthetic row **cannot be minted by hand** — the write path is guarded
(`objeto de arquivo deve nascer reservado`) and the follow-on transition was rejected too
(`transição de estado de upload inválida (reserved → verifying)`). **Two attempts, then
stopped** rather than guessing at a state machine. ⭐ The guard chain is *correct behaviour*,
and a fabricated row would have measured a different branch of the door while reporting it as
the real path.)_

**What closed it:** not a fabricated row, but the **real finalize corridor** — the same door
sequence `329_dm2_document_commands.sql` § U drives:
`begin_document_upload` → *(PUT)* → `finalize_document_upload` (→ `verifying`) →
`complete_document_upload_verification` (→ `unscanned_accepted`) → `open_document_version`.
Run inside **one rolled-back transaction**, same protocol as P1–P3.

⚠ **The one step that is a fixture, stated rather than implied:** SQL cannot PUT bytes, so the
`storage.objects` row the Storage API would write on the client PUT is inserted directly. That
is the fixture the committed pgTAP suite already uses — it is **not** a hand-minted
`file_objects` row, and the three state transitions above are all real RPC calls.

**N at measurement:** `documents=3` · `document_versions=3` · `file_objects` **0 → 1** ·
`document_version_files` **0 → 1**. Actor: an **entitled non-creator** (`staff`), i.e. 329 O1's
actor, not the uploader. Sanity-checked as a *serving* path — `version_number=1` was actually
returned, so these are not the timings of a refusal.

| call | actual time | buffers |
| --- | --- | --- |
| **cold** (1st — includes plpgsql compilation) | **8.16 / 8.27 ms** | shared hit **1562**, dirtied 2 |
| **warm** (2nd) | **4.02 ms** | shared hit **121** |
| **warm** (3rd) | **3.82 ms** | shared hit **121** |

- ⭐ **The cold/warm split is reported because P1's was not, and reporting one number would
  repeat P1's error** (its 3.699 → 0.736 ms drop was compilation, read at the time as a volume
  curve). Three calls were run precisely so the warm figure is corroborated, not a single sample.
- **~3.9 ms and 121 buffers to serve ONE version is the durable finding.** Step 0 named this the
  highest-leverage RPC because every open/sign surface funnels through it, so this is a
  per-open floor on every byte-serving screen in the product.
- `dirtied=2` on the cold call is the `document.opened` audit write — the door is a **writer**,
  which is why it cannot be cached away.

⛔ **NOT COVERED, and this does not become a volume curve by implication: no N=2003 arm was
taken for P4.** P1's volume arm was misleading for exactly this reason, and building one here
needs synthetic `file_objects` rows the write-path guards deliberately refuse. What is claimed
is a **single-row baseline at the stated N**, nothing about how it scales. Residue: none —
`rollback` verified (`file_objects=0`, `storage.objects=0`, 0 `document.opened` rows).

## 5 · Gate results

All run unpiped, exit codes captured.

| gate | result | vs baseline |
| --- | --- | --- |
| `supabase db reset --local` | **exit 0**, ready on the 1st readiness poll (`buckets=4`) | — |
| `npm run test:db` (fresh reset) | **194 files / 6363 PASS, exit 0** | 193 / 6351 → **+1 file / +12 tests = exactly `343`**; pre-existing figures unchanged |
| `npm run test` (vitest) | **89 files / 1304 passed, exit 0** | 88 / 1294 → **+1 file / +10 tests = exactly `disposal-gap.test.ts`**; pre-existing unchanged |
| `npm run lint` (5 chained) | **exit 0** — eslint 0 errors **0 warnings**, css-vars, memberships-door (10/10 self-test), client-server-imports (481 client / 124 server modules, 0 findings), vacuous (42/42 self-test, 185 spec files, 0 findings) | ⚠ see below |
| `npm run typecheck` | **exit 0** | 0 |
| **`next build`** | **exit 0** — compiled successfully, **19/19** static pages | ⚠ **Added at QA r1 (MINOR-1).** This phase's plan names it in gate step 1 and the first version of this table simply **omitted** it — neither run nor listed as NOT COVERED, *which is the one shape a reader cannot detect.* It is also the **only** gate that catches the BUG-FBE-005 class (a client value-import from a server module aborts `next build` while tsc/lint/vitest stay green) — precisely the exposure a new file under `src/lib/` creates. An omission that happened to be harmless is still the omission. QA ran it independently: exit 0. |
| `storage-manifest.mjs rehearse` | **22/22, exit 0** | was 16/16 → **+R7 +R7-twin** (QA r1 MAJOR-1) **+R8** (the ninth verdict) **+R6-residual +R9 +R9-monotonic** (QA r2); the **16 pre-existing arms all still pass** |
| `storage-manifest.mjs selftest` | **18/18, exit 0** | was 13/13 → **+C14 +C15 +C16** (MAJOR-1 and the sibling gap the guard-set diff found) **+C17** (MAJOR-2's affinity guard) **+C18** (the ninth verdict); **all 13 originals intact** |
| stack state after everything | volume **245 files / 2,456,666 bytes**, `buckets=4`, `dm5_buckets=0`, `dm5_drill*` databases **0** | byte-identical to step 0 |

⚠ **The lint baseline handed to me was stale: the gate was ALREADY RED before this
slice.** `npm run lint` failed with *"'cap7' is assigned a value but never used …
ESLint found too many warnings (maximum: 0)"*. Verified by reading
`git show e5a1418e:scripts/storage-manifest.mjs` — `cap7` was declared and never
used **at the lead-verified S5.R commit** (lines 1177-1182 there reference
`tmp('cap7')`, the path helper, not the variable). So `npm run lint` was not run
after `e5a1418e`, and the recorded "lint 5/5, 0 warnings" did not describe that
commit. I also did not run lint before my own first commit (`d2b19808`) — it ran
pgTAP, vitest and tsc but not the lint chain, which is how the pre-existing red
survived one more commit. Both facts are mine to report rather than quietly repair.

⭐ **The dead binding turned out to be a missing control, not a style nit.** `cap7`
was the **SIGHTED TWIN** of the R6-capture arm and was never asserted: without it,
"blind capture exits 1 and verdicts UNVERIFIED" is satisfied by a tool that exits 1
and verdicts UNVERIFIED for **every** input — i.e. one that can no longer judge
anything. R6-capture now pins both sides of the single variable the arm claims to
isolate (`cap7.exit === 0 && verdict === 'CONSISTENT'` beside the blind assertions).
Fixed by making the binding load-bearing, not by renaming it to `_cap7`.

**Authz sweep: NOT APPLICABLE — recorded as that, never as "clean".** (This
paragraph appeared **twice, verbatim** until QA r1 — MINOR-8. Deleted the copy.)

**The DIFF-SCOPED sweep is N/A** because the slice touched **no RLS policy and no
`prosecdef` boolean gate**: the changes are one Node script, one pgTAP file, one
vitest file, one TS comment, and Markdown. No migration was added or edited, so
there is no migration diff from which to derive a gate list.

**The FOUR STANDING ARMS are also N/A — and that argument has to be made, not
left as silence** (QA MINOR-9; the record previously argued only the conditional
sweep and said nothing about `ARM=census` / `ARM=hat` / `ARM=floor` /
`FROMFINDINGS=1 ARM=wrapper`, which CLAUDE.md §6 step 1 lists as **unconditional**).
The argument: **their subject is provably identical to the pre-slice catalog.** The
slice adds no `pg_proc` row, no policy, and no grant — `343` runs inside
`begin … rollback`, so its probe functions never persist (`pg_proc` holds no
`dm5_s5%` row after a run; verified), and the policy count is unchanged at **274**.
With the subject bit-identical, each arm would re-derive the same census over the
same doors. ⚠ **Not run**, deliberately: they mutate the shared stack, and this
program has already had a sweep leave an authz gate open. QA independently reached
the same N/A conclusion and also did not run them, for the same reason.

## 6 · ⛔ NOT TESTED / NOT COVERED — binding

A delivered slice is not an absence of gaps.

1. ⬛ **P4 `open_document_version` has no baseline** (§4) — **CLOSED 2026-08-17 (pre-S6)**: the
   named prerequisite was met via the real finalize corridor, giving **8.2 ms cold / 3.8–4.0 ms
   warm, 121 buf warm** at the stated N. ⚠ **A single-row baseline only — still no volume arm**,
   which is item 2's defect and is not cured here.
2. **P1's volume curve does not exist** — the synthetic arm did not touch its
   population. Its numbers are cold/warm at 2 rows only.
3. **`--allow-orphans` is unfixed** — the remaining surface of
   FUP-DM5-NO-ANSWER-VS-NOTHING. Filed, deliberately not patched.
4. **The `catch` arm of the delete classifier is uncovered.** R3d covers the
   *bucket-absent* route into INDETERMINATE; the route where `listBucketKeys`
   genuinely **throws** is still untested (I could not force a listing error
   without stubbing, which the rehearsal avoids on principle).
5. ⛔ **CORRECTED AT QA r1 — this item was WRONG, and its wrongness was the
   understatement QA blocked on as much as the code.** It said a bucket with
   API-visible keys and zero volume files *"is never examined … not classified"*,
   scoped to the **delete** classifier. **It was classified — as CLEAN.** On the
   **`capture`** path, `verdictFor`'s `!proof.present` branch returned
   `CONSISTENT_EMPTY`, a member of `CLEAN_VERDICTS`, so the verdict column, the
   **CAPTURE CLEAN headline** and the **exit code** all said clean over a bucket
   the API said held live files — and `capture` is what S4/S6 and the deploy
   runbook gate on. It was also **non-monotonic**: partial byte loss was dirty,
   *total* byte loss was clean. *"Not classified"* would have let a future reader
   believe the state merely went unexamined. **✅ Now FIXED** (`MISSING_BYTES`),
   pinned red-first by **R7 / R7-twin / C14 / C15**, plus **C16** for the
   `proof.error` sibling the guard-set diff found. Residual, genuinely still open:
   the **`left` filter in `cmdDelete`** does select only `files > 0`, so on the
   *delete* path a metadata-row-without-bytes bucket is still not examined —
   narrower than the original claim, and unfixed.
6. **The runbook has never been executed end to end** — there is no
   `disposal_pending` specimen locally (`file_objects=0`). Its steps are
   catalog-verified individually; the *sequence* is unrehearsed, and the Cloud
   sequence is unrehearsable from here.
7. **Owner and periodicity are unconfirmed** (§1 of the runbook). Until the PO
   names them the procedure exists but the mitigation does not — and the
   reconciler's premise stays false in practice.
8. **The Cloud byte half remains unverifiable** — FUP-DM5-CLOUD-ORPHAN-SURFACE;
   the S3 endpoint is UNPROBED and nothing here changed that.
9. **PITR entitlement for this project is UNDETERMINED** — needs the linked
   project.
10. **Storage-backup PHI handling** (§3c, §6b) — ✅ **RESOLVED**: filed as 🔴
    FUP-DM5-BACKUP-IS-PHI-EXPORT and **all five values set by the PO 2026-08-17**
    (encryption at creation · location outside repo *and* sync roots · reader set ·
    30-day retention · key-first destruction). ⚠ **Residual:** the *literal*
    destination path is per-machine and is recorded in the run log at first
    execution, and **the procedure has never been executed** (see item 6).
11. **`no_plan()` gives up per-file protection against silent assertion loss**
    (§1c) — the compensating control is a human comparison at gate time.
12. **The vitest census is bounded to `src/` + `scripts/`** and excludes test
    files. A caller added under `e2e/`, in a test file, or outside those roots is
    invisible to it. The pgTAP half is bounded to non-temp schemas.
13. **The three follow-ups are filed, not fixed** — per the lead's ruling.
14. ✅ **`DIVERGED_BOTH_WAYS` is now constructed** (R8 + C18), and ✅ **`MISSING_BYTES`
    via PARTIAL loss** (R9 + R9-monotonic, QA r2) — the path that carried half the
    non-monotonicity claim. The enumeration is **nine verdicts over eleven paths**
    (§6e). ⚠ **It bounds one function's RETURN DOMAIN and nothing more**, and QA's
    closing warning stands verbatim: **both blocking items came from building a state
    nobody had built, so I make no claim that the remaining unconstructed states are
    safe.**
19. **Surplus version files read CLEAN** (QA r2) — 5 keys / 6 files verdicts
    `CONSISTENT`, exit 0, because the verdict is key-set based. Recorded as a
    residual, **not** made dirty, because no supported operation on this Storage
    version produces it. ⛔ **It becomes a real defect the moment any Storage version
    retains object versions** — the trigger condition is named in the code. Not fixed,
    by decision.
20. **The C16 ↔ `volumeCensus` coupling is unpinned** (QA r2) — C16 asserts the
    mapping for the shape the catch block produces today, but nothing asserts the
    producer keeps producing it. A hand-maintained assumption between two places.
15. **`UNVERIFIED_PROOF_ERROR` is pinned only at the `verdictFor` grain** (C16), not
    end to end — forcing a real per-bucket `docker exec` failure would need stubbing,
    which the rehearsal avoids on principle. The mapping is proven; the plumbing
    from a genuine docker failure to that verdict is not.
16. **The project-affinity guard is proven at both polarities and in one live run,
    but never against Cloud** — no remote contact was made, deliberately. It is a
    guard derived from a source-level fact, and its Cloud consequence remains an
    inference (QA 8.4 makes the same point and I am not overriding it).
17. **QA did not re-measure the drill's numbers or the EXPLAIN baselines** (QA
    8.2 / 8.3) — the 490/10 error counts, 90-of-274, 161-of-165, the `docker cp`
    timing, and P1/P2/P3's timings are **still single-sourced to me.** What is
    independently confirmed is the durable half: `public.documents` holds only
    `documents_pkey`, and the live policy count is 274.
18. **The runbook's `7z a -si -p` combination is untested in a piped, non-tty
    context** (QA 8.5) — `-p` prompts on the console while data arrives on stdin.
    If it fails it lands in the same "reports success over an empty archive" region
    §6b now warns about. **Named as the first thing to check in the first
    rehearsal.**

## 6b · Lead rulings on the handed-over doubts (2026-08-17) — all three recorded

**Ruling 1 — the door's metadata-only absence check IS the NO-ANSWER class, and it ESCALATES to 🔴.**
Same structure (*"no metadata row"* read as *"no bytes"*), but the worst of the three instances, and
the reason is not technical: the other two are **tool output an operator reads and can second-guess**;
this one is a **persisted record asserting a fact to a regulator**. A `disposed` state meaning
"metadata row absent, bytes unknown" is a **false compliance assertion** under LGPD / ANVISA-RDC /
CFM 1821 in a 20-year-retention system. ⛔ It compounds with S5.R: on Cloud there is no volume proof,
so "bytes gone" is not merely unchecked there — it is **unverifiable by the method we have**, and
**`disposed` can never mean more than "metadata gone" on Cloud** until either
FUP-DM5-CLOUD-ORPHAN-SURFACE settles that an orphan-visible surface exists, or the door's contract is
amended to state what it actually verifies. Recorded in the follow-up, and in the runbook §4.
⭐ The lead ruled that **filing it undecided rather than merging it on my own judgement was the correct
call** — a severity decision with regulatory weight does not belong inside an implementation slice.

**Ruling 2 — the S3 promotion was RIGHT: keep it promoted, cross-link, do NOT merge downward.** My
body's "merge downward if you prefer one item" option is **withdrawn**, and both entries now
cross-link (parent ⇄ promoted item, plus a consumer link from NO-ANSWER instance 3, which is blocked
on this measurement). The generalisable reasoning, recorded because it outlives this item: *an item
that can change a verdict does not live inside the parentheses of the verdict it would change* — the
same defect as ADR 0120's root-cause #3 (*a supersession marker only a raw-file reader can see is not
a marker*) and the S2 reopen-banner defect (*a marker merely DISTANT is no better than one hidden*).

**Ruling 3 — the PHI-export finding is FILED (🔴), and it changes the runbook.** Filed as
**FUP-DM5-BACKUP-IS-PHI-EXPORT**, because it is not hypothetical (the drill created one) and because
⛔ **the runbook as written would instruct a human to create that export** — *a procedure whose correct
execution produces an undocumented plaintext PHI copy is not a complete procedure.* The runbook gains
**§6b**, a PHI-handling section for the backup half. §7's run record now also requires the backup's
location, reader set and destruction time.

## 6c · ✅ PO DECISIONS FILLED IN (2026-08-17) — nothing in the runbook is a proposal any more

Every value the runbook previously flagged is now decided and written as decided; every "awaiting the
PO" / "PROPOSED" marker beside a decided value has been removed here, in the runbook, in the
follow-ups and in the PROGRESS index (a stale marker beside a decided value is the currency defect
this phase has hit repeatedly).

| value | decision |
| --- | --- |
| Accountable owner | **the PO (repo owner)** — deliberately *not* a DPO role: naming a role that may not be staffed pre-pilot is the same as naming no owner |
| Executor | **whoever holds service-role reach** — ACL-forced, not a choice |
| Periodicity | **monthly**, plus **out-of-band on a data-subject request** |
| Retention | **until the next backup is verified good, max 30 days**, whichever first — exactly one recovery point |
| Encryption | **encrypted archive, encrypted AT CREATION** (`age` / 7z-AES) so bytes are never plaintext on disk at any point; key stored **separately** |
| Location | **outside the repo AND outside any synced folder**, with a mandatory sync-root check |
| Reader set | **the accountable owner alone**, pre-pilot; never attached to an issue or ticket |
| Destruction | **key first, then archive** — log both, stating what each proves |

**Two of these needed more than transcription.**

⭐ **The retention rationale is written in, because the obvious reading inverts it.** The 20-year
obligation belongs to the **system of record, not to backup copies**; a 20-year backup satisfies
nothing and creates two decades of PHI liability in a second location with no RLS, no audit, no access
control. **Short backup retention is a safety property, not a compromise** — said explicitly so a
future reader does not "fix" 30 days upward believing they improve compliance.

⛔ **"Verified good" is defined as CATALOG-COMPARED, never `psql` exit 0**, with this slice's own drill
as the citation (exit 0 · 490 real errors · 90 of 274 policies). The retention rule authorises
destroying the only other copy, so the phrase carries the weight of the whole rule; the runbook now
carries the exact comparison query and the requirement to restore into a scratch database that already
has `auth`/`storage`/`extensions`.

⚠ **One slot could not be filled and was NOT invented:** the *literal* destination path. The PO decided
the **rule** (outside the repo, outside every sync root); the path itself is per-machine, so the
runbook records it in the run log at first execution and ships a mandatory sync-root check instead of
a guessed path.

### Instance 4, and a fifth caught before it shipped

Instance 4 (destruction: a file **unlinked** recorded as bytes **unrecoverable**) is filed, and
resolved by the PO's encryption decision — cryptographic erasure is the load-bearing act; deleting the
archive is hygiene. Found *inside the fix for instance 3*, which is the argument for the class
statement existing at all.

⭐ **The reframed statement earned itself within the hour.** Verifying the encrypt-at-creation
pipeline: `docker exec … tar -cf - -C /mnt stub` **fails on Git Bash** (MSYS rewrites `-C /mnt` to
`C:/Program Files/Git/mnt`; tar exits 1, **0 bytes**), and with stderr suppressed the encryptor
consumes the empty stream and 7-Zip prints **"Everything is Ok"** — a valid, well-formed, entirely
**empty** encrypted backup from a command that reported success. *An action performed recorded as the
state achieved*, recognised on sight instead of shipped. The runbook carries the working invocation,
the reason, and a **mandatory** count-vs-census verification. Not filed as a 5th open instance — it
never reached the document.

### Two of §7's doubts adopted as BINDING named gaps — S6 may not close over them
### ⭕ Updated 2026-08-17 (pre-S6): the FIRST is discharged, the SECOND still binds

- ⬛ **P4 `open_document_version` NOT MEASURED — DISCHARGED 2026-08-17.** The original ruling
  stands and is why this closed cleanly: stopping after two attempts rather than guessing at a
  state machine was correct — **a fabricated baseline is worse than a missing one** — so the gap
  was closed by *meeting the prerequisite* (drive the real `begin → finalize →
  complete_verification` corridor) rather than by fabricating the row that was refused. Result in
  §4: **8.2 ms cold / 3.8–4.0 ms warm, 121 buffers warm**, single-row, rolled back, no residue.
  ⚠ **Discharged for the baseline, NOT for scaling** — no volume arm exists.
- 🔒 **The runbook sequence is UNREHEARSED — STILL BINDING, unchanged.** It is a procedure, not a
  proven one. Lead's framing, which is the S4 lesson repeating one layer up: *naming an owner is
  not a rehearsal, and writing a runbook is not running it.* ⛔ **S6 may not close over this one.**
  It needs the PO (its named owner) plus whoever holds service-role reach — it was never mine to
  discharge, and no amount of pre-S6 work changes that.

### The gate lesson, in the lead's words as well as mine

The lead's independent re-verification at HEAD confirmed lint 5/5, tsc 0, vitest 89f/1304, pgTAP
194f/6363 on his own fresh reset, and that `public.documents` holds **only** `documents_pkey` — so the
P2 Seq Scan finding is real, not an artifact of my synthetic volume.

⭐ **He also owned the stale baseline, and the lesson is worth more than the correction:** S5.R was
reported to the PO as "done and green" on the strength of its **selftest, catalog and volume state** —
its *functional* claims — **but not its gate**. `cap7` was present at `e5a1418e` and the lint gate was
red. *Verifying a teammate's functional claims is not verifying its gate claims.*

And the specific reason that matters here: **the lint error was pointing at a missing assertion, not
at style.** The dead binding was **R6-capture's sighted twin**, unasserted — without it the arm is
satisfied by a tool that exits 1 and verdicts UNVERIFIED for *every* input, i.e. one that can no
longer judge anything at all. **That is the argument for why lint is a phase gate and not a formatting
preference:** an unused binding is frequently a control someone wrote and forgot to assert.

## 6d · QA r1 remediation (2026-08-17) — `docs/reviews/dm5-s5-review.md` @ `2677e9a4`

Verdict was **CHANGES REQUESTED**: 0 P0 · 2 MAJOR blocking · 9 MINOR · 5 INFO, with
*"nothing in S5.R's or S5.D's design is asked to change."* Both blocking items were
defects **in the artifact this slice modified** and **in the runbook this slice
shipped**.

### MAJOR-1 — `capture` called a destroyed-bytes bucket CLEAN. Fixed, red-first.

`verdictFor`'s `!proof.present` branch consulted **only** `proof === null` — never
`apiKeys`. A bucket with 3 API-visible keys and no volume directory verdicted
`CONSISTENT_EMPTY` ∈ `CLEAN_VERDICTS` ⇒ **CAPTURE CLEAN, exit 0.**

- ⛔ **Non-monotonic in severity:** partial byte loss ⇒ `MISSING_BYTES`, exit 1;
  **total** byte loss ⇒ clean, exit 0. *The worse state reported better.*
- ⛔ **It is the state FUP-DM5-STACK-CYCLE-DESTROYS-BYTES produces** (volume loss,
  DB intact) — the worse Rule-12 direction, because the metadata still advertises
  the PHI file as present and servable and `document-reconciliation.mjs` reads the
  same API.
- ⭐ **It was the SIBLING of the branch this slice had just fixed** — two lines
  below, same function, same commit. The fixed branch's comment reads *"a verdict
  that treats a missing ROW as proof of a missing object is the withdrawn method
  wearing the tool's badge"*; the next branch did it with a missing **directory**.

**Observed RED before the fix** (a green first run would have been vacuous):
selftest **C14** `verdict=CONSISTENT_EMPTY`; rehearsal **R7**
`storage.objects 5→5 api_keys=5 volume_present=false exit=0 verdict=CONSISTENT_EMPTY`.
Then fixed → `MISSING_BYTES`. **C15 / R7-twin are the permissive twins** (a
genuinely empty bucket must stay `CONSISTENT_EMPTY`/clean, else the fix reddens
every empty bucket forever) — and C15 **passed before the fix**, which is what makes
it a real guard against over-reach rather than a companion assertion.

⭐ **The guard-set diff the lead asked for found a SECOND gap in the same branch
that QA had not reported.** `volumeCensus`'s catch returns `{present:false, error}`
when its `docker exec` fails, and the branch mapped that to `CONSISTENT_EMPTY` — *"I
could not look"* recorded as *"there is nothing there"*, i.e. **variant 1 of the
NO-ANSWER class living inside `verdictFor` itself.** Now `UNVERIFIED_PROOF_ERROR`,
non-clean, pinned by **C16** (also observed RED). The guard sets are now written
into the code so the next sibling is checked rather than assumed:

| branch | consults |
| --- | --- |
| `!exists` | `exists` · `proof.present` · `proof.keys` |
| `!proof.present` (fixed) | `proof === null` · **`proof.error`** · **`apiKeys`** |
| tail | `apiKeys` · `proof.keys`, both directions |

**Record §6 item 5 corrected** — it had said this state was *"never examined … not
classified"*. It was classified **CLEAN, by name, in the headline, with a zero
exit**, on the path S4/S6 and the deploy runbook gate on. QA blocked on that
understatement as much as on the code, and was right to.

### MAJOR-2 — the Cloud risk was framed backwards. Runbook restated; tool guarded.

Not *"on Cloud you lose the local proof"* but *"on Cloud you may get a **fake**
one"*. `locateVolume()` finds its container **by name pattern via `docker ps`** and
is never given the project URL; nothing cross-checked them. The two preconditions
are at **different grains** — file backend is a property of the **project**, a
running container is a property of the **operator's machine** — so the sentence
*"neither can hold for a Cloud project"* was **false in the most likely operator
configuration**, and it was stated as *measured*.

- **Runbook §6 rewritten with per-claim provenance:** (b) measured; (a)'s
  exit-code behaviour measured; (a)'s **Cloud consequence labelled an INFERENCE**,
  never executed remotely. The blanket *"measured, not inferred"* header is gone.
- **Tool guarded (I judged this a fix, not a follow-up):** `locateVolume()` refuses
  when `NEXT_PUBLIC_SUPABASE_URL` is not a local origin while a local container is
  running, downgrading the proof to unavailable **with the reason printed**.
  **Why a fix:** the failure mode is a *silent, confident, wrong* byte-level
  assurance on a destructive path — the one class this entire follow-up family is
  about — and the remedy is one condition. **Why in `locateVolume()`:** every
  subcommand inherits it from one place, rather than each re-deriving it (*a new
  door must inherit every sibling arm*). Measured with a Cloud URL against a running
  local stack; both polarities pinned by **C17**. It converts the "DOMAIN: LOCAL
  stack only" banner from advisory to **enforceable**.
- **Folded into FUP-DM5-CLOUD-ORPHAN-SURFACE**, which stays open: the guard
  prevents a fake proof, it does not create a real one.

### The four corrections to the lead's own rulings — all four applied

1. **`no_plan()` → `plan(12)` restored.** The acceptance reasoned from the wrong
   comparison: a wrong `plan(N)` fails **safe** (a noisier red on an
   already-failing, already-exit-1 run — it never produced a false green), while
   silent assertion loss under `no_plan()` fails **open**. The file traded the safe
   direction for the open one. Count **re-derived from the file** (12), not copied
   from the prose, and the in-file note now tells the next editor to re-derive.
2. **Class headline replaced** — see §6b / the follow-up. The promoted sentence
   covers all six instances; *action → state* is kept as a sub-class. **MAJOR-1
   added as instance 6 and a third variant: "I looked at the wrong thing."**
3. **The frequency claim withdrawn** (§1d) — the eight retired buckets hold 0 bytes
   and no directory *today*; the claim was true historically and is true for Cloud
   by construction. R3d's own reason never needed it.
4. **MINOR-3 key custody specified** — the mandated *"key destroyed"* line had **no
   verifiable referent**, which re-instantiated the class one level down. The
   runbook now forces a choice between three custody modes (**passphrase never
   persisted** / **keyfile at a stated path** / **password-manager entry**) with
   **the exact log wording each one permits** — including *"no key copy existed to
   destroy"* for the passphrase case, because *"key destroyed"* for something never
   written down is itself an action-recorded-as-state.

### MINORs and INFOs taken

| item | action |
| --- | --- |
| **MINOR-1** | `next build` **run (exit 0, 19/19 pages)** and added to the gate table with why its omission mattered |
| **MINOR-4** | sync-root check rewritten as a **function** — `exit 1` in a pasted snippet kills the operator's shell; the git half only **echoed** (advisory where OneDrive was fatal, with no visible difference); patterns were **case-sensitive**. Now `return 1`, case-insensitive over `pwd -P`, 12 providers, and an explicit note that the list **cannot** be exhaustive |
| **MINOR-5** | archive verification no longer compares against `walk`'s TOTAL (different denominator — `ALL_KNOWN_BUCKETS` vs everything under `/mnt/stub`; equal today **only** because the root holds just the four survivors). Now `find /mnt/stub -type f \| wc -l`, same denominator by construction. Verified: **245** both ways |
| **MINOR-7** | `/dispose/i` → **`/dispos/i`**. `/dispose/` cannot match `Disposal`, so the arm stayed **green** through `scheduledDisposalSweep` — the most plausible name a disposal job would carry, and the name both red-first probes used. **Verified the fix fires:** with the probe present, **2 assertions** now red where **1** was before. *The enumeration boundary is a syntax, not a property — in the file that pins that class.* |
| **MINOR-8** | duplicated *"Authz sweep: NOT APPLICABLE"* paragraph deleted |
| **MINOR-9** | the **four standing ARMs** are now argued N/A rather than unmentioned, with the reason (subject provably identical: no `pg_proc` row, no policy, no grant added; `343` rolls back — verified `dm5_s5%` procs **0**, policies **274**) and with the explicit note that they were **not run** because they mutate the shared stack |
| **INFO-2** | ADR 0120 D9's "14 controls" annotated with the HEAD figure so a reader does not conclude the tool shrank |
| **INFO-3** | FUP-DM5-D9-NO-ARM's **local** half updated — the S5 `verdictFor` work is exactly the arm that now reddens that state locally; its **Cloud** half stands and the item does not close |
| **INFO-4** | the "restore loses 67% of RLS" headline given its precondition (**bare** Postgres target; misuse, not a `supabase db dump` defect) |
| **INFO-5** | the drill's 68 PHI-tier files noted as **PHI-by-bucket, from seed/E2E artifacts, not real patient data** — the 🔴 grades the mechanism as applied to production |
| **INFO-1** | ⚠ **NOT taken — lead-owned.** `docs/plans/dm5-wave-d-retirement-plan.md:131` still contradicts PROGRESS on S4's status, and S6 will read the plan |

## 6e · The verdict enumeration — NINE verdicts over ELEVEN PATHS

> ⚠ **Restated at QA r2: the first version of this section enumerated NAMES and
> called itself complete.** It was complete on names and incomplete on **paths** —
> several verdicts are reachable by more than one route, and *"every verdict has a
> control"* is a weaker statement than it sounds. The count that matters is
> **9 verdicts over 11 reachable paths.** Enumerating the wrong denominator is the
> same defect as an underived count, one level up — and it hid the specific gap below.
>
> **The path that had no control:** `MISSING_BYTES` via **PARTIAL** byte loss
> (directory present, some keys missing). R7 constructs only the **total**-loss route.
> ⛔ That mattered because **the entire justification for the MAJOR-1 fix is the
> non-monotonicity claim** — *"lose SOME bytes ⇒ dirty exit 1; lose ALL ⇒ clean exit
> 0; the worse state reported better"* — and while the `lose ALL` half was measured
> (R7, observed red pre-fix), the `lose SOME` half was **asserted by the code comment
> and by runbook §6(c) and observed by nobody.** A comparative claim with one measured
> half is half a claim. ✅ **Now constructed: R9** (partial loss ⇒ `MISSING_BYTES`,
> exit 1, directory present, 4 of 5 volume keys) **plus R9-monotonic**, which asserts
> the convergence itself — both paths now yield the same verdict and the same exit,
> so the claim the fix rests on is an assertion rather than a sentence.

Ruled into r2 rather than filed, on the grounds that **both r1 blocking items came
from someone constructing a state nobody had constructed** — 2 for 2 for that
method on this artifact.

⛔ **First finding: the domain is NINE verdicts, not eight.** QA counted seven, the
lead eight, I had not counted at all. Derived from the function body rather than by
eye — `awk '/^function verdictFor/,/^}/' | grep -oE "'[A-Z_]+'" | sort -u` → 9.
*A count nobody derived is not a bound*, and the whole point of an enumeration is
that its denominator is real.

**Second finding, from mapping references rather than reasoning:** eight of the nine
were referenced by at least one control. `DIVERGED_BOTH_WAYS` had **exactly one
reference in the entire file — its own `return` statement.** No control, no
rehearsal arm, no assertion had ever produced it. It was **constructible in four
lines**, so it was constructed, not filed.

| # | verdict | clean? | construction | control |
| --- | --- | --- | --- | --- |
| 1 | `CONSISTENT` | ✅ clean | API and volume agree, keys > 0 | **R1, R2b, R7-twin** (e2e) · **C7** (direct) |
| 2 | `CONSISTENT_EMPTY` | ✅ clean | both sides empty | **R1x** (e2e, post-delete re-capture) · **C15** (direct) |
| 3 | `BUCKET_ABSENT` | ✅ clean | row gone, nothing on the volume | **R5** (e2e, verified teardown) · **C10** (direct) |
| 4 | `ORPHANED_BYTES` | ⛔ dirty | volume key the API cannot see | **R2** (e2e) · **C6** (direct) |
| 5a | `MISSING_BYTES` | ⛔ dirty | **TOTAL** loss — directory removed | **R7** (e2e — QA MAJOR-1) · **C14** (direct) |
| 5b | `MISSING_BYTES` | ⛔ dirty | **PARTIAL** loss — directory present, key missing | ✅ **NOW R9 + R9-monotonic** — previously **no control** |
| 6 | `BUCKET_ABSENT_ORPHANED_BYTES` | ⛔ dirty | row gone, bytes survive | **C9** (direct); e2e via R3d's delete-path twin |
| 7 | `UNVERIFIED_NO_LOCAL_PROOF` | ⛔ dirty | no proof obtainable | **R6-capture** (e2e, `docker` off `PATH`) |
| 8 | `UNVERIFIED_PROOF_ERROR` | ⛔ dirty | the measurement **failed** | **C16** (direct only — see below) |
| 9 | `DIVERGED_BOTH_WAYS` | ⛔ dirty | wrong in **both** directions at once | ✅ **NOW R8** (e2e) · **C18** (direct) — previously **nothing** |

**R8 constructs #9 for real**, not synthetically: five objects uploaded through the
Storage API, then one key's volume directory removed (⇒ the API lists a key with no
bytes) **and** a ghost directory added (⇒ the volume holds a key with no metadata),
simultaneously. Measured:

```
R8 … verdict=DIVERGED_BOTH_WAYS exit=1 api_keys=5 volume_keys=5
      (counts EQUAL, sets disjoint) orphans=[ghostdiverge/x.bin] volume_missing="r1.bin"
```

⭐ **And constructing it produced a finding the verdict alone does not carry.**
Removing one key and adding another leaves the **counts equal** — 5 API, 5 volume —
while the sets are disjoint **in both directions**. So **any count-based check calls
this state healthy**, including this tool's own `deleted === keyCount` comparison,
which is *the only control that survives on Cloud* (R6b). Only a set comparison sees
it. The equality is now asserted explicitly, so a later reader cannot mistake it for
a coincidence of the fixture.

**Proven able to fail, by neutralization:** with
`if (onlyVolume.length && onlyApi.length) return 'DIVERGED_BOTH_WAYS'` disabled, the
state falls through to `ORPHANED_BYTES` and **R8 reddens alone** (18/19); the tool
file was restored byte-identically afterwards (sha256 compared). ⚠ Note what that
mutation reveals: the **exit code stayed 1**, because `ORPHANED_BYTES` is also dirty.
Only the **verdict-name** assertion discriminated. An arm asserting nothing but the
exit code would have passed the mutation — which is the same lesson as `cap7`, one
layer along.

Both single-direction verdicts already had controls (#4, #5); this is the overlap,
and it must be dirty because **a bucket wrong in both directions is not less broken
than one wrong in one.**

**Structural reasons, for the two that are pinned at the `verdictFor` grain only:**

- **#8 `UNVERIFIED_PROOF_ERROR`** is reachable only when `volumeCensus`'s
  `docker exec` **throws** for a bucket. Forcing that for one bucket while leaving
  the others intact would mean stubbing `docker()` — and the rehearsal's whole
  premise is that it drives the **real** code paths (it forces the no-proof branch
  by removing `docker` from `PATH`, never by stubbing). So the *mapping* is pinned
  and the *plumbing* from a genuine docker failure to that verdict is not. Recorded
  as NOT COVERED item 15 rather than papered over.
  ⚠ **Wording corrected at QA r2:** the claim is *"no route we are willing to
  construct safely"*, **not** *"no non-stubbing route exists"* — the latter was never
  established and is a stronger statement than anything I measured. A per-bucket
  permission change or a mid-run container stop might well reach it; I did not try,
  because both are riskier on a shared stack than the coverage is worth.
  ⚠ **And a coupling nobody pins** (QA r2): C16 asserts the mapping for an input
  shaped `{present:false, error:'…'}` — the shape `volumeCensus`'s catch *actually*
  produces — but **nothing asserts that the producer keeps producing that shape.**
  If the catch block were changed to, say, omit `error` or set `present: true`, C16
  would keep passing while the real path stopped reaching the verdict. That coupling
  is a hand-maintained assumption between two places, which is the class this whole
  slice is about; it is recorded rather than fixed.
- **#6's end-to-end arm** exists on the delete path (R3d) rather than the capture
  path, because constructing it for `capture` means dropping a bucket row while its
  bytes survive — which R3d already does, and doing it twice in one rehearsal adds
  teardown risk for no new information.

⚠ **This enumeration is NOT a claim of completeness, and this sentence is here
verbatim by instruction because it is the honest part:** *I make no claim the
remaining unconstructed states are safe.* What the table bounds is one function's
**return domain**. It says nothing about the state space *reaching* that function —
`cmdDelete`'s `left` filter still examines only buckets with `files > 0` (NOT
COVERED item 5), the `catch` arm of the delete classifier is still untested (item 4),
and QA's own closing note applies unchanged: both blocking items came from building
a state nobody had built.

## 6f · QA r2 (✅ APPROVED, 0 P0 · 0 MAJOR · 6 MINOR · 6 INFO) — the four MINORs taken now

Report `docs/reviews/dm5-s5-review-r2.md` @ `3363cc8e`. The remediation was re-proved
by neutralization; N1's R7 line came back **character-identical** to my pre-fix
observation, and **C15 passed with the fix reverted**, confirming it as an over-reach
bound rather than a companion assertion. ⛔ **S5 is not closable:** `e2e:prod` is
PO-deferred until the follow-ups are scoped, so gate step 2 is **owed, not passed.**

**MINOR-1 — the tool printed a reassurance about the one control that is blind, in
the situation where it is blind, on a destructive path.** The no-local-proof residual
ended *"The count-comparison gate still holds."* R6 measures that exact situation:
`deleted=5 manifest=5 MATCH`, *"ALL BUCKETS MATCHED THEIR MANIFEST COUNT"*, exit 0 —
**with a real file surviving.** *"Still holds"* is true of the comparison **executing**
and false of the assurance a reader takes from it.

⭐ **This slice's own class, one layer up, inside the remediation written for it.** The
message now states the bound with the capability: the comparison **runs**, it is the
**only** control that survives without local proof, and it **cannot** detect an
under-count or a two-way divergence — it refuses only an **over-count**. And the
**wording is pinned** by new arm **R6-residual**, which requires the bound to be
stated *and* forbids the old sentence returning: an unpinned message proven wrong once
comes back.

**MINOR — nine verdicts over ELEVEN paths**, and the unobserved path constructed. See
§6e: `MISSING_BYTES` via **partial** loss had no control, and it was the half of the
non-monotonicity claim that justified the MAJOR-1 fix. **R9 + R9-monotonic** now
measure it and assert the convergence directly. Runbook §6(c) updated to say both
halves are measured.

**MINOR — the tail-branch sibling: surplus version files read CLEAN.** QA measured 5
API keys / 5 volume keys / **6 volume files** → `CONSISTENT`, `orphan_files=0`, exit 0,
because `verdictFor` compares **key sets** and a surplus version file adds no key.
**Recorded as a residual rather than made dirty**, because QA measured reachability
both ways and on this Storage version an API upsert **replaces** the version file — so
no supported operation currently produces a surplus, and reddening it would make the
tool refuse an impossible state. Verified the residual does **not** fire on the real
volume today (files == keys on all four buckets: 156/156, 68/68, 12/12, 9/9).

⛔ **The escalation trigger is named in the code, per the lead's instruction, so a
future upgrade surfaces it instead of silently promoting it:** *if any Storage version
begins **retaining object versions*** (upsert keeping the prior file, versioning or
soft-delete enabled, a multipart remnant), surplus files become routine — and they are
**bytes no key can address**, undeletable through the API and invisible to a key-set
comparison. Under Rule 12 that is **undisposable PHI**. At that point the residual
must become a dirty verdict. *Re-read this the next time `supabase` is upgraded.*

**MINOR — two corrections to the drill record**, both applied above: the `^ERROR`
anchor is **invocation-dependent** and my explanation stated it as a property of
`psql` (re-measured both ways: `-f` → 0 matches, stdin → 2 matches), and **ARM B does
not reach full parity — triggers 227 vs 235**, which I re-ran rather than inherit, and
whose eight missing triggers include `protect_buckets_delete`,
`protect_objects_delete` and `on_auth_user_created`.

**Left alone, per QA:** `UNVERIFIED_PROOF_ERROR`'s structural reason stands, with its
wording softened to *"no route we are willing to construct safely"*, and the
C16-anchoring coupling is now recorded (§6e).

## 7 · Doubts handed over, not just conclusions

1. **Is the door's metadata-only absence check part of the NO-ANSWER class, or its
   own?** `complete_document_disposal` verifies against `storage.objects`, so
   `disposed` means "metadata row absent", not "bytes gone". I recorded it in the
   class follow-up **explicitly undecided** rather than merging it on my own
   judgement. It may deserve its own item — and it may deserve a severity above
   🟠, since it is the state a PHI disposal record asserts to a regulator.
2. **Was promoting the S3-endpoint question to its own follow-up right?** It was
   already a parenthetical inside FUP-DM5-STORAGE-ORPHANS' Cloud half. I promoted
   it because that parent's headline reads *"closes empty by measurement"* and the
   obligation was positioned to be discharged by association — but two items with
   divergent bodies is its own failure mode. Both bodies say to merge downward if
   the lead prefers one item.
3. **The 4th fix to `storage-manifest.mjs` was mine to judge, and I judged it.**
   The lead ratified it afterwards. I still flag that accumulated changes to one
   operational tool in one slice is where a regression hides — which is why
   `selftest` and `rehearse` are always reported with "originals intact" rather
   than only the new totals (now **18/18** with 13 originals intact, and **22/22**
   with 16 originals intact). ⭐ **QA r1 vindicated the worry in the sharpest
   possible way**: the accumulated changes were fine, but the *fix itself* left its
   own sibling branch two lines below untouched. The regression risk was not in the
   count of changes — it was in the **scope of the reasoning behind one of them.**
4. **P2's 364 ms may not describe any real hospital.** I do not know the realistic
   documents-per-resource distribution, and I did not guess one. If the answer is
   "tens", this is a non-finding; if it is "thousands for a busy commission over 20
   years of retention", it is a pilot blocker. **That is a product question I am
   handing over, not answering.**
5. **I twice reached a confident wrong conclusion from a real measurement quoted at
   the wrong grain** in this slice alone (the `^ERROR` count; the `COPY storage\.`
   grep), and once reported a per-bucket count of 0 from an assumed path depth.
   Each was caught by a second, differently-shaped measurement — never by
   re-reading my own work. Weight my numbers accordingly: the ones with two
   independent measurements behind them are marked as such.
