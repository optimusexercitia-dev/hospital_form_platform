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

### 1c · `plan(N)` → `no_plan()`, with the trade-off disclosed

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

**Lead's ruling adds the stronger reason, recorded here as instructed:** *"bucket
row absent + bytes present" is exactly the state all eight retired buckets are in.*
Not a corner case — the shape of the real retirement scope, and on Cloud after a
retirement migration the dangerous state by construction.

The refusal summary was also rewritten: the indeterminate-only case previously
printed *"0 key(s) survived that the manifest did not list"* **inside a STOP**. A
refusal whose own numbers look benign is how a STOP gets ignored.

### 1e · Verification of the tool after four accumulated changes

| check | result |
| --- | --- |
| `rehearse` | **16/16, exit 0** — the **14 pre-existing arms all still pass**, plus R3c and R3d |
| `selftest` | **13/13, exit 0** — all originals intact (lead-requested re-check) |
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

| | source `postgres` | bare-DB restore | + 3 empty schemas & 2 stub fns |
| --- | --- | --- | --- |
| `psql` exit code | — | **0** | **0** |
| true error count | — | **490** | **10** |
| tables (`public`) | 165 | **161** | 165 |
| **RLS policies (`public`)** | **274** | **⛔ 90** | **274** |
| triggers | 235 | 216 | — |

**`supabase db dump`'s output is not a standalone restore artifact.** Replayed onto
a bare Postgres it produces 490 errors (193 × `schema "X" does not exist`, 281 ×
`relation "X" does not exist`) and yields a database that *looks* restored — 161
tables with RLS enabled — while **two thirds of the security boundary is missing.**
Diagnosis confirmed by a second measurement: pre-creating empty `auth`, `storage`,
`extensions` plus stub `auth.uid()`/`auth.role()` took errors 490 → 10 and both
tables and policies to **full parity**. The supported restore target is therefore a
**Supabase-initialized** database (locally `supabase db reset` first; on Cloud
PITR / `db push` + seed).

⛔ **Two false signals aligned to nearly produce a confident wrong conclusion, and
I am recording my own error because it is the transferable part:** `psql` without
`ON_ERROR_STOP` **exits 0 while statements fail**, and my first error count used
`grep -c '^ERROR'` — which matches nothing, because psql prefixes errors with
`psql:file:line:`. I briefly held "restore succeeded, 0 errors". Only the
**catalog comparison** exposed it. *An operator who replays a dump and checks the
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
| **P4** open/sign (bytes) | RPC `open_document_version(dv)` | **NOT MEASURED** — see below | — |

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

**P4 — NOT MEASURED, with the exact blocker.** `file_objects` holds **0 rows** on a
fresh reset, so the byte door has nothing to resolve, and a synthetic row cannot be
minted by hand: the write path is guarded (`objeto de arquivo deve nascer
reservado`), and the follow-on transition was also rejected (`transição de estado de
upload inválida (reserved → verifying)`). **Two attempts, then stopped** rather
than guessing at a state machine — a fabricated row risks measuring a different
branch of the door and reporting it as the real path. ⭐ The guard chain is
*correct behaviour*: byte metadata cannot be fabricated by hand. **Prerequisite to
finish this:** populate `file_objects` through the real finalize path (an E2E slice
that uploads a document, or the demo seed), then re-run. Step 0 named
`open_document_version` the highest-leverage target because every open/sign surface
funnels through it, so **this gap is worth closing** — it is listed in §6.

## 5 · Gate results

All run unpiped, exit codes captured.

| gate | result | vs baseline |
| --- | --- | --- |
| `supabase db reset --local` | **exit 0**, ready on the 1st readiness poll (`buckets=4`) | — |
| `npm run test:db` (fresh reset) | **194 files / 6363 PASS, exit 0** | 193 / 6351 → **+1 file / +12 tests = exactly `343`**; pre-existing figures unchanged |
| `npm run test` (vitest) | **89 files / 1304 passed, exit 0** | 88 / 1294 → **+1 file / +10 tests = exactly `disposal-gap.test.ts`**; pre-existing unchanged |
| `npm run lint` (5 chained) | **exit 0** — eslint 0 errors **0 warnings**, css-vars, memberships-door (10/10 self-test), client-server-imports (481 client / 124 server modules, 0 findings), vacuous (42/42 self-test, 185 spec files, 0 findings) | ⚠ see below |
| `npm run typecheck` | **exit 0** | 0 |
| `storage-manifest.mjs rehearse` | **16/16, exit 0** (re-run after the lint fix) | 14 pre-existing arms intact + R3c + R3d |
| `storage-manifest.mjs selftest` | **13/13, exit 0** (re-run after the lint fix) | all originals intact |
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

**Authz sweep: NOT APPLICABLE — recorded as that, never as "clean".** This slice
touched **no RLS policy and no `prosecdef` boolean gate**: the changes are one
Node script, one pgTAP file, one vitest file, one TS comment, and Markdown. No
migration was added or edited, so there is no migration diff from which to derive
a gate list.

**Authz sweep: NOT APPLICABLE — recorded as that, never as "clean".** This slice
touched **no RLS policy and no `prosecdef` boolean gate**: the changes are one
Node script, one pgTAP file, one vitest file, one TS comment, and Markdown. No
migration was added or edited, so there is no migration diff from which to derive
a gate list.

## 6 · ⛔ NOT TESTED / NOT COVERED — binding

A delivered slice is not an absence of gaps.

1. **P4 `open_document_version` has no baseline** (§4) — the highest-leverage RPC,
   blocked on an empty `file_objects`. Named prerequisite; not done.
2. **P1's volume curve does not exist** — the synthetic arm did not touch its
   population. Its numbers are cold/warm at 2 rows only.
3. **`--allow-orphans` is unfixed** — the remaining surface of
   FUP-DM5-NO-ANSWER-VS-NOTHING. Filed, deliberately not patched.
4. **The `catch` arm of the delete classifier is uncovered.** R3d covers the
   *bucket-absent* route into INDETERMINATE; the route where `listBucketKeys`
   genuinely **throws** is still untested (I could not force a listing error
   without stubbing, which the rehearsal avoids on principle).
5. **A bucket with API-visible keys but ZERO volume files is never examined** by
   the new classifier — the `left` filter selects buckets with `files > 0`. A
   metadata row with no bytes (`MISSING_BYTES` shape) after a matched delete would
   not be classified. Pre-existing scope, not a regression; not fixed.
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
10. **Storage-backup PHI handling is undocumented** (§3c) — a volume snapshot is a
    plaintext PHI export; where it may live, who may read it, and its retention are
    written down nowhere. Surfaced, not fixed, not filed as its own follow-up
    pending the lead's call.
11. **`no_plan()` gives up per-file protection against silent assertion loss**
    (§1c) — the compensating control is a human comparison at gate time.
12. **The vitest census is bounded to `src/` + `scripts/`** and excludes test
    files. A caller added under `e2e/`, in a test file, or outside those roots is
    invisible to it. The pgTAP half is bounded to non-temp schemas.
13. **The three follow-ups are filed, not fixed** — per the lead's ruling.

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
   The lead ratified it afterwards. I still flag that four accumulated changes to
   one operational tool in one slice is where a regression hides — which is why
   `selftest` 13/13 and `rehearse` 16/16 are reported with "originals intact"
   rather than only the new totals.
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
