# DM5 — Wave D + retirement (phase record)

> Live status lives in **PROGRESS.md**; this file is the authority for DM5's detail.
> Rotated out of PROGRESS.md mid-phase (2026-08-14) because the live file had reached
> **128 KB against CLAUDE.md §7's "well under 60 KB"** target — and every teammate spawn
> reads it. Plan: [dm5-wave-d-retirement-plan.md](../plans/dm5-wave-d-retirement-plan.md) ·
> ADR [0120](../decisions/0120-dm5-wave-d-retirement-decisions.md) · step 0:
> [dm5-surface-verification.md](./dm5-surface-verification.md).

## 🔵 S4 — legacy bucket retirement (2026-08-16) — **PO-authorized on the day**, per §11's gate

**Authorization:** the PO authorized S4 explicitly on 2026-08-16, separately from S3's approval, after
being shown the eight buckets, the survivors, and that the run is **local-only** (the no-push directive
stands). The parked **FUP-DM5-D11** ruling was deferred in the same exchange — *decide later*, and
nothing in S4 depends on it.

**Delivered:** migration **`20260927000400_dm5_s4_retire_legacy_buckets.sql`** (drops the last 4
retirement-bucket policies + the 8 bucket rows, behind an executable byte-first guard) · pgTAP **`325`
5 → 8** (t6/t7 retirement pins + **t8**, the survivor positive control) · successor assertions in
**`200`**, **`142`**, **`143`**, **`341`** · dead bucket constants removed from
`src/lib/attachments/constants.ts`. Surface delta: the **DM5·S4** block at the head of
[backend-state.md](../backend-state.md).

### ⭐ The finding that defines S4: the byte half was a NO-OP, and the records must say so

Measured at S4 start, before touching anything: **`storage.objects` = 0 rows across all 12 buckets**
while the volume held **866 files / 9.9 MB / 235 PHI-tier**. For the 8 retirement buckets that is
**221 files / 6.93 MB / 15 PHI-tier** — reproducing S0's recorded figure **exactly**, independently.

**Every one of those bytes is already an orphan with no metadata row, so the Storage API — the D9
GATE — cannot address a single one.** A `capture` yields an empty manifest and a `delete` deletes
nothing. This is not a defect in the tool; it is the tool's own `DEGENERATE BASELINE` verdict firing
exactly as S0 designed it to.

⛔ **So S4 completed the METADATA/SCHEMA half and did NOT perform the byte half locally — it could
not.** Recorded as such, never as "retirement proven". What *is* proven: the bucket rows and doors are
gone, and they **stay** gone across `db reset`, which is the half that six historical migrations would
otherwise silently undo. The deploy-time byte path remains D9's manifest-first sequence, and it is
meaningful **there** because production *has* metadata rows (census 2026-08-11: 45 objects). The 221
local orphans stay with **FUP-DM5-STORAGE-ORPHANS**; they are a data-at-rest/disposal-assertion
problem (Rule 12), not a live exposure — every Storage read path resolves metadata first.

### Gate step 1

Fresh `supabase db reset` (announced; single-owner stack) · registry **407 == 407** · pgTAP
**193 files / 6351 PASS** (S3's 6348 + the 3 new `325` pins) · tsc **0** · lint **5/5** · vitest
**1294** (unchanged — the removed TS had no test, which is *why* it was removable) · four arms
**ALL HOLD**, exit codes captured unpiped: census live **546** / verdicts **570** (identical to S3's
close — S4 added no gate, so no census entry is owed) · hat **3** reasoned-allowlisted, self-test 6/6 ·
floor allowlisted · `FROMFINDINGS=1` wrapper BLIND **41** ⊆ allowlist · degenerate bodies **0**.

**Diff-scoped `ARM=policy`: NOT APPLICABLE, and recorded as that rather than as clean.** S4's diff
**drops** 4 policies and adds/modifies none, and touches **no** `prosecdef` body — so the sweep's
domain is empty. *A dropped policy has no gate to open.* (S3 recorded the same distinction; per its
precedent, "not applicable" must never be written up as "clean".)

### ✅ Gate step 2 — `e2e:prod` **GATE GREEN**

**1118 passed · 0 failed · 0 infra · 5 flaky · 0 did-not-run · 18 batches**, `next build` compiled,
2 infra re-runs. Gotenberg verified **200** on :3010 before the run — without it 15 print specs fail
as uniform pt-BR errors that read exactly like product defects.

**The accounting reconciles against S3 exactly, and the summary line needed checking to see it.**
The gate prints `COVERAGE: accounted for 1123 of 1129` — **6 short**, which is the shape
[[gate-summary-can-hide-unrun-tests]] warns about. Resolved: the per-batch lines sum to
**1129 / 1129 accounted with 0 did-not-run in every batch**; the summary's "accounted" simply
excludes skips. Full reconciliation, and the comparison that matters:

| run | passed | flaky | skipped | collected |
| --- | --- | --- | --- | --- |
| S3 (2026-08-14) | 1120 | 3 | 6 | **1129** |
| **S4 (2026-08-16)** | **1118** | **5** | **6** | **1129** |

**Identical collected total and identical skip count** — the only movement is **two tests shifting
from `passed` to `flaky`** (failed once, passed on retry). That is flakiness, not regression: 0 failed,
0 did-not-run. The 3 unique skips are conditional and unrelated to storage (`phi-remediation` REM-8/9,
`user-registration` AC2 invite-mode). The 5 flaky are keyboard/timing shapes
(`act-role-assumption`, `bulk-case-creation` kbd grid, `phase2-auth-shell` logout, `ff3-validations`,
`dm5-nsp-evidence` EVID-KBD-1).

⭐ **The check worth doing, because S4 deleted the bucket S3's corridor was proven against:**
`pdf-printing` **9/9** and `pdf-printing-meetings` **6/6** — identical to S3 — with **zero** non-ok in
any print / document / evidence spec. **The print corridor still mints real `%PDF-` bytes after
`printed-documents` was deleted**, which is independent confirmation that S3's re-pointing onto the
core substrate is real rather than merely asserted.

### 🔒 The defect S4 nearly shipped to the REMOTE: `SET LOCAL` in a migration is not guaranteed to be in a transaction

The first version of `…000400` copied `20260921000300`'s idiom verbatim — a bare
`set local storage.allow_delete_query = 'true'` followed by the `DELETE`. It passed a standalone
`supabase db reset`, pgTAP, all four arms and the catalog check: **4 bucket rows, exactly right.**

Then the E2E gate's own reset printed this against that very file:

```
Applying migration 20260927000400_dm5_s4_retire_legacy_buckets.sql...
WARNING (25P01): SET LOCAL can only be used in transaction blocks
```

**`SET LOCAL` outside a transaction is a silent no-op**, so in that path the platform opt-in was never
set. And the opt-in is genuinely load-bearing — probed directly, in a rolled-back transaction:

| probe | result |
| --- | --- |
| `delete from storage.buckets` **without** the opt-in | **`ERROR 42501: Direct deletion from storage tables is not allowed`** — `storage.protect_delete()` |
| the same delete with `set_config(..., is_local => true)` **inside a `do` block** | `deleted=1`, clean rollback |

**Fixed** by moving the opt-in and the `DELETE` into **one `do` block**: a `do` block always executes
inside a transaction (its own, if none is open), so the local setting is guaranteed to be in scope for
the delete beside it and to die with it. Re-verified: the migration now applies with **no warning**,
registry **407 == 407**, 4 bucket rows, pgTAP **193f/6351**, four arms HOLD.

⭐ **Why this was worth stopping a running E2E gate for.** The bug is invisible wherever the runner
happens to wrap the file, and `db push` to the remote is a *different* invocation from
`supabase db reset`. A green local gate would have certified a migration whose destructive step is
conditional on an undocumented property of the tool that applies it. **The fix removes the dependency
rather than betting on it.**

⚠ **One thing I could NOT explain, recorded as unexplained rather than rationalised:** in that e2e-path
run the migration **did not error** after the warning — the log goes straight on to `Seeding data`,
and the batch's actual failure was an unrelated 502 during container restart. Given probe A, a delete
matching ≥1 row without the opt-in *must* raise, so either the delete matched **0 rows** in that path
or the session already carried the GUC. I did not reproduce it (the fix removed the code path), and I
am not going to invent a mechanism for it — this phase has been burned by confident mechanism stories.
⚠ **`20260921000300` still carries the original `set local` idiom** and has the same latent
fragility; it is applied history and was left alone. → **FUP-DM5-SETLOCAL-MIGRATION** (filed).

### Five ways this slice tried to go wrong — all of them the phase's own recurring classes

1. ⭐ **My reference sweep was bounded by ONE property and the breakage lived in another.** I swept
   for *reads of `storage.buckets`* and for *`storage.objects` inserts*, proved exactly one breakage
   (`200:405`), and shipped it — then pgTAP returned **4 reds** in `142`/`143`/`341`, every one an
   assertion that the **policies I was dropping still EXIST**. Two properties; I enumerated one.
   [[enumeration-boundary-is-a-syntax-not-a-property]] again — *the sweep ran, it just wasn't
   sweeping the thing.*
2. ⭐⭐ **The five broken assertions failed in OPPOSITE directions, and only one direction announces
   itself.** Three went **RED** (`want 2, have 0`). Two — `142`'s and `143`'s *"NO update/delete
   policy"* Rule 6 pins — went **VACUOUS**: zero policies satisfies them forever, silently, and they
   sat in the "passing" column of a green suite. **The red ones were the lucky ones.** Both kinds were
   replaced; had I fixed only what the suite reported, S4 would have left two dead pins reading as
   coverage. Same shape at `200:405`, where `is(NULL, false)` **failed** only because pgTAP treats a
   NULL result as failure — written as a zero-count it would have flipped silently green too.
3. ⭐ **I nearly shipped a vacuity while fixing a vacuity.** `341`'s F9 pins BUG-DM5-CAPA-1 and was
   keyed to the retired policy's NAME, so it went NULL — a name-keyed verdict does not follow its
   subject ([[a-rename-orphans-a-name-keyed-verdict]]). I re-keyed it to `app.can_write_document`'s
   live capa arm via `prosrc like '%can_write_capa%'` — **but that body's own header COMMENT names
   `can_write_capa` in prose**, so the bare-name form is satisfied by the comment and would survive
   deletion of the actual call. Tightened to the CALL form `app.can_write_capa(`, then **proved** it:
   neutralizing the call in a rolled-back txn gives `bare_name = t` (the vacuity, demonstrated) and
   `call_form = f` (falsifiable). Same fix and proof for `142`'s twin. md5 of `can_write_document`
   **identical** before and after; degenerate bodies **0**.
   → [[a-comment-is-an-assertion-that-goes-stale-silently]], now as a *test's* blind spot.
4. ⚠ **Two tooling traps that each read like a real result.** (a) `ARM=census` reported
   **INVARIANT VIOLATED**, flagging `public.type_owner_is` / `view_owner_is` — **pgTAP's own
   functions**, from an extension I had installed by hand to run a single suite. Dropping pgtap
   cleared it. (b) The `exit=$?` I printed beside it was **`tail`'s** status, not the script's —
   the exact `| tail` masking that once hid an exit 2. All four arms were re-run unpiped, to files.
   → [[a-detector-that-finds-a-lot-needs-proving-too]], [[mutation-harness-must-prove-its-rollback-first]].

### One lead error, recorded because the near-miss was a committed artifact

`storage-manifest.mjs capture` takes **`--out`**; **`--manifest`** is `delete`'s flag. I passed
`--manifest`, and the capture silently wrote to the **default committed path**, overwriting S0's
baseline. `git status` caught it and it was restored with `git checkout`. ⭐ **The accident was also a
free verification:** the diff showed the retirement-bucket figures **byte-identical** to S0's, with
only the timestamp and the core-bucket census moving — an independent reproduction of the
221/6.93 MB/15 PHI claim. *An unknown flag that falls back to a default destination is a footgun; the
tool should reject unknown flags.* → **FUP-DM5-MANIFEST-FLAG** (filed).

### NOT TESTED / NOT COVERED (binding heading — a close that omits it reads as completeness)

- **The byte deletion path was never EXECUTED against a populated bucket** in S4. `delete --execute`
  was not run at all, because the manifest was empty by construction. Its correctness rests on S0's
  self-test (8/8, including a manufactured orphan and a deliberate count mismatch), **not** on an S4
  run. **The production sequence is therefore still unrehearsed end-to-end.**
- **Nothing remote was touched**, verified or otherwise. FUP-DM5-STORAGE-ORPHANS' Cloud half stays
  residual.
- **The 221 local orphan files were left in place** pending a PO decision — removing them needs the
  filesystem, a method D9 deliberately excludes from the gate.
- `235`/`236` still **create** `case-documents` / `interview-attachments` bucket rows inside their own
  rolled-back transactions. Left deliberately: they are self-sufficient, `u1-mutation-audit.sh` runs
  inside `236`'s transaction, and rewriting an authz fixture to chase a cosmetic is the riskier change.
  ⚠ But it means those suites now assert against buckets that exist **only inside the test**.
- ⚠ The Supabase CLI offered **v2.114.0** (pinned/installed **v2.105.0**). **Not taken.** D17's remote
  half was grep-verified against the v2.105.0 binary; a bump must re-run that grep.
  → [[remote-reset-storage-orphan-is-cli-version-dependent]].

## ✅ S3 — printed renditions onto the substrate: **COMPLETE, all four gate steps (2026-08-14)**

> **This is the current head of the phase.** Full narrative, the six enumeration-boundary repeats, the two
> corrected true-sounding claims, S3's record, and S4's authorization gate live in
> **[dm5-handoff.md](./dm5-handoff.md) §§9–11** — written for a session that was not here. Not duplicated
> here on purpose: two copies of a status is how this phase produced eight record defects.

**Delivered** (all ancestors of HEAD `1513c094`): `6ffd92ff` `859faa18` `d964b61a` `e08cf4eb` `af9a894e`
(backend) + `02b2218d` (tester). 6 migrations `20260927000300`–`000350`, pgTAP **`342`** (59), fixtures
rewritten in `312`/`313`/`323`. **`frontend` was never spawned** — every TS signature stayed stable and D18
removed the only new surface, so S3 needed no UI.

**Gate, lead-verified from the catalog:** registry **406 == 406** · pgTAP **193 files / 6348 PASS** · tsc 0 ·
lint **5/5** · vitest **1294** · `ARM=census`/`hat`/`floor`/`FROMFINDINGS=1 wrapper` **all HOLD** ·
diff sweep **BLIND 0 · ERROR 0** · degenerate bodies **0** · findings **595** · `e2e:prod` **1120 passed ·
0 failed · 0 did-not-run · 3 flaky · 18 batches**, `next build` compiled.

⭐ **The corridor was executed** — `pdf-printing` 9/9, `pdf-printing-meetings` 6/6, real `%PDF-` bytes,
mint → download → verify → revoke → overlay → re-verify. **S2 passed every static gate while its feature did
not work at all; S3 has been run.** ⚠ Requires the **Gotenberg sidecar** on :3010 and `--workers=1` against
`next dev` — see the handoff's environment section.

🔒 **One live bug found and fixed: BUG-DM5-S3-INACTIVE-PRINT-1** — a deactivated user kept print-download
authority. Closed by D12's conjunction. **No authz ARM can see that class** → FUP-DM5-SIBLING-GUARD-DIFF.

**Lead-verified from the catalog, not accepted from any report** (moved here at the S3-closure rotation —
these are **current facts**, and the byte-for-byte archive lower down is marked *superseded*, so they must
not live only there): `securable_resources_type_check` admits **9** types · `app.resolve_document_version_bytes`
exists and **`authenticated` cannot EXECUTE it** · the print arm is present in **both** kernel doors ·
`printed_documents.storage_path` is **dropped** · all six teammate commits are **ancestors of HEAD**.

**Still open after S3, and NOT to be assumed** — ⚠ **an `APPROVED` slice is not an absence of gaps**, and
r2 restated this as its own "not re-verified" list: `case`/`interview` prints **UNTESTED because
unmintable** (`can_view_printed_document` has arms for `form_response`/`meeting` only — **D6 is satisfied at
the *type* level**; two of four kinds have never produced a print) · `add_referral_shared_item` never driven
end-to-end · a print's `file_objects.sha256` is the **minter's** hash, not `finalize_document_upload`'s
derivation, **and it feeds `complete_document_disposal`'s duplicate-evidence probe** · the smoke file is
**not gate-resident** (`grep -n smoke package.json` → no hits) · `ARM=policy` was **not applicable** to this
diff (it adds `prosecdef` gates, no RLS policy) — recorded as *not applicable*, **never as clean**.

⚠ **D18, corrected after implementation:** the detail half's filter landed on `queries/documents.ts`'s
`getDocument`, which **no route imports**; the reachable same-named export in
`queries/controlled-documents.ts` selects `from('controlled_documents')`, so prints are excluded
**structurally, by the schema, not by D18**. `form_response` prints have **no panel to leak into at all**
(`DocumentHomeResourceType` excludes them) and **6 of 9** local prints are that kind — so the exclusion is
untestable there for want of a *surface*, not for want of a test. (ADR 0120 D18 amendment;
FUP-DM5-DEAD-CORE-PROJECTION.)

### ✅ Step 3 — QA **APPROVED (r2)**, 2026-08-14 (`801a2589`, [review](../reviews/dm5-s3-review.md))

r1 = **CHANGES REQUESTED** (0 P0 · 2 MAJOR blocking · 6 MINOR · 2 INFO) → all discharged at `af9a894e` →
**r2 = APPROVED**. New at r2: **0 P0 · 0 MAJOR · 1 MINOR · 3 INFO**, all record-level.

⭐ **What makes this r2 worth more than a second reading: it re-proved every blocking item by
neutralization.** With guard 4 deleted from the *live* body (`guard4_still_present=false` printed before the
suite ran), the new **`S3k2` went RED — `caught: no exception / wanted: P0002` — while `S3f4` stayed
GREEN.** That is MAJOR-1's exact complaint, now discriminating. `S3d2`'s vacuity was reproduced
**side-by-side on the same mutated body**: `pos_active=0`, old form `t`, new form `f`.

⭐ **r2 declined to inherit the lead's own correction.** The lead had overturned r1's MAJOR-2 premise; r2
re-derived it from the retired CHECK and the same migration's column grants, then **applied the declined
`REVOKE` in-transaction** and showed the `home_resource_id`-only walk yields the coordinate **before and
after** — effective, and closing nothing. It also proved red-first the two assertions `backend` had not
(`t51c`/`t51d`). ⚠ One r2 claim rests on **migration text** (a retired CHECK's definition) and says so;
sound only because a CHECK is not among the things this repo rewrites at runtime.

**Safety record:** fresh reset first · **8 mutation-bearing runs, every one a single rolled-back
transaction**, each prefix refusing to run as a no-op · degenerate bodies **0** after every run ·
`md5(pg_get_functiondef)` byte-identical on all five mutated functions, `begin_document_upload` =
`aedac0b01f2ad0a594b75eede6671fb0`, **the same md5 r1 recorded** · `prosecdef=true` on all five · column
ACLs restored · `storage.objects` back to **8** policies, 0 probe policies · registry 406==406 · `pgtap`
dropped. **Lead-verified independently after the agent stood down**, because the standing rule is that a
mutation harness proves its own rollback (this stack has been left with a gate OPEN before).

**Lead-closed r2's one stated gap.** r2 wrote that it had **not** re-run `ARM=census` and that
`…000360` *does* rewrite a `prosecdef = t` body — accepting step 1 as reported. Since **`ARM=census` is
precisely the arm that catches a gate you just added**, the lead re-ran all four at `801a2589`:
**census** live **546** / verdicts **570** · **hat** 3 reasoned-allowlisted (self-test 6/6) · **floor**
74 never-called, allowlisted · **`FROMFINDINGS=1` wrapper** BLIND 41 ⊆ allowlist — **all HOLD**, exit 0,
output never piped (`| tail` once masked an exit 2 as 0).

### ✅ Step 4 — PO, 2026-08-14

Instruction: *"run the QA and conclude S3."* Approval **delegated in advance, contingent on an APPROVED
r2** — had r2 reddened, this looped to step 1 rather than closing. Recorded this way, not as a review of
the evidence, because the PO gave it **before** the verdict existed.

⛔ **This is a SLICE verdict.** DM5's phase QA is still owed at **S6**, and r2 **authorizes no part of
S4** — S4 deletes storage objects irreversibly and needs PO authorization **on the day**.

## ✅ RESUME AUDIT before S3 (lead, 2026-08-14, HEAD `e2af9790`) — the build is sound; **every defect was in the RECORDS**

The PO asked for a consistency check on the DM5 work before continuing. **Nothing in the built system was
wrong.** Every figure the handoff claimed reproduced exactly on a fresh reset — registry **399 == 399** ·
pgTAP **192 files / 6284** · tsc **0** · lint **5/5** · vitest **1294** · all four arms **HOLD** (census
546/569 · hat 3 · floor 74 · wrapper BLIND 41) · degenerate bodies **0** · tree clean · findings 594 lines.
The catalog corroborated every S2 claim independently: 8 securable types, **both** kernel doors carrying
`rca`+`capa_action` with `prosecdef = t`, `p_storage_path` dead on all three write doors, `wave_d` asserted
at `begin` and deliberately not at `finalize`, `tenant_shape` carrying D14's shape-B, flags default `false`
in migration and ON in the local seed only. **S2's one owed item — the four arms — is discharged.**

⭐ **The finding is the shape of the finding.** A phase that spent six weeks learning *"text is not truth"*
had produced, in its own status files, **eight** assertions that contradicted the catalog, git, or each
other. **A build verified nine ways was being described by records nobody re-ran.**

| # | inconsistency | disposition |
| --- | --- | --- |
| **1** | 🔴 **PROGRESS.md asserted `⛔⛔ S2 IS REOPENED — IT WAS NEVER FUNCTIONAL` as CURRENT STATE.** All three named defects are ✅ FIXED — contradicted by the **same file's own bug log**, by git, by 0 stub bodies, and by the live catalog. **This is the file every teammate spawn reads**: a `backend` spawned for S3 would have been briefed that S2 is broken. | ✅ rewritten; the lesson retained, explicitly re-framed as **history** |
| **2** | 🔴 **PROGRESS.md's phase-status DM row said "No migrations/code written yet"** and quoted registry **391**. Eight migrations are registered; it is **399**. | ✅ corrected, with a pointer to the live section as the authority |
| **3** | 🟠 **The "S2 … CLOSE" section here presented the VOID first close's figures** (397 / 6272 / 1264 / "6 migrations") **with no visible marker** — the reopen banner sits ~200 lines above under a different heading. ⭐ **This is ADR 0120's own withdrawal root-cause #3 repeating one file over:** *a supersession marker only a raw-file reader can see is not a marker* — and here it was worse, because the marker was merely **distant** rather than hidden. | ✅ loud in-section banner + the true figures beside the void ones |
| **4** | 🟠 **`docs/backend-state.md` predates EVERY S2 migration** (last content `bf1585ea`) — no knowledge of the new types, either kernel arm, the dead `p_storage_path`, the `wave_d` assert, or the un-parked citation seam. ⛔ **This is the same file, in the same phase, that caused S1's withdrawal — and it would now have been consulted by S3, which touches exactly that surface. Third strike attempted.** | ✅ loud currency stamp at the head enumerating all 8 migrations' deltas; full rewrite stays an S6 deliverable |
| **5** | 🆕 **The S3 trap-3 enumeration was bounded by two line numbers, not by the property** — **four** sites, two unnamed anywhere, one of them S2's own new code. And the recorded failure mode was wrong: it does not crash, it **silently misclassifies a fully-uploaded print as `pending` with `canOpen: false`**, forever. Full analysis + per-site reachability: handoff §4 trap 3. | ✅ corrected and sharpened; **reframed from "frontend's" to a joint resolution-seam fix + keystone** |
| **6** | 🟡 **Two 🔴 follow-ups were in `follow-ups.md` but had ZERO mentions in PROGRESS.md** — FUP-AUTHZ-HARNESS-TRANSACTIONAL (a **live authz-harness hazard**) and FUP-DM5-FINALIZE-ATOMIC — against the stated "filed in BOTH" discipline. | ✅ both now in PROGRESS.md's Open list |
| **7** | 🟡 **Two items lived only in handoff prose, filed nowhere:** `330` is BLIND to `can_write_document`, and the intermittent `pg_prove` worker deadlock (*will re-red a gate at random and read like a defect*). | ✅ named in PROGRESS.md as explicitly unfiled |
| **8** | 🟡 **PROGRESS.md is 137 KB** against §7's "well under 60 KB" — it was rotated to 115 KB at `3b51c20d` and grew **22 KB in one slice**. Rotation is the lead's, and [[progress-md-record-step-rotation-is-chronically-skipped]] is a standing memory. | 🔶 **OPEN** — flagged to the PO, not yet done |

⚠ **The one class this audit could NOT clear.** Every check above is static — catalog, git, counts, text.
**S2's own history is that all of those were green while the feature did not work at all**, because *not one
of them executes a page*. The E2E evidence for S2 is a **quick-loop** run (8/8 new + 36/36 pre-existing),
never `e2e:prod`. **DM5 has no full-gate E2E result at any point**, and it must not close without one.

## ⚠ INCIDENT during S2 verification — an authz gate was LIVE-OPEN on the shared stack (2026-08-14)

**Anyone auditing S2's results needs this window.** `app.can_write_document` — the gate for **every**
document write across all eight home types — sat live with the body `begin return true; end` (an
**unconditional allow**) on the shared local stack, for an interval whose only lower bound is a
`pg_get_functiondef` capture at **17:28**. ⚠ **`pg_proc` carries no mtime**, so the window cannot be
dated from the catalog; **any document-write-path result produced in it must be RE-RUN, not re-read.**

**Cause: a LEAD instruction.** I told a backend teammate to *"neutralize `can_write_document` and
confirm your keystone block goes red"* **without saying transactionally**, on a stack two other
teammates were live on. Not a product defect — the migration `20260927000160` is correct and its own
self-verifying `DO` block passed at apply time. Full analysis + the structural fix:
**FUP-AUTHZ-HARNESS-TRANSACTIONAL** in [follow-ups.md](./follow-ups.md).

**Caught by `tester`, which verified its environment BEFORE executing an agreed plan** — everything it
was about to run would have gone **green while proving nothing**, a false all-clear on the exact defect
class this slice exists to close. It also **declined to hand-patch** the function despite having the
correct body in front of it, because a second actor was mid-run.

**Resolution, verified independently by three parties** (backend-assurance's differential, the lead's
catalog sweep, `tester`'s own re-probe — each measured rather than relayed):
`degenerate_bodies 0 · has_rca_arm t · has_capa_arm t · still_neutralized f · prosecdef t`, and
`chefe.farm` → `begin_document_upload('rca', …)` → **REFUSED P0002**.

⭐ **Blast radius was bounded by a PROPERTY query, not a name list** — sweep `app`+`public` for any body
matching `^\s*begin\s+return\s+(true|false)\s*;\s*end`. **Exactly one hit.** ⚠ A left-open gate is
**invisible to all four §6 authz arms**, because they test doors that *exist*; that query is the only
thing that sees it.
⭐ **The rollback was PROVEN before being relied on** — md5 of `pg_get_functiondef` before, gate replaced
in-txn, probe, `rollback`, re-read: byte-identical, same md5. Postgres DDL is transactional, so a
rolled-back `CREATE OR REPLACE` leaves no residue — now measured, not assumed
([[mutation-harness-must-prove-its-rollback-first]]).

## ⭐ A deliberately uninformative error code is uninformative to the TEST too (S2 `341` F-block)

ADR 0120 D-note: `add_rca_evidence`'s citation arm raises **`HC0D8` for both absence and
unreadability, deliberately**, so a caller cannot use the error to probe which documents exist — an
error code that distinguishes *"not found"* from *"not yours"* is an **existence oracle**. That
design decision is correct and stays.

⚠ **But the same ambiguity that blinds an attacker blinds the assertion.** Three fixture defects in
the F-block, each caught by a red, each a different class — and the middle one is the specimen:

1. **A hardcoded id captured before the reset.** The seed mints document ids with
   `gen_random_uuid()`, so the captured id named nothing afterwards. F4/F6 went **visibly red** —
   **but F7 stayed GREEN for the wrong reason**: it asserts `HC0D8` and received `HC0D8` from *"no
   such document"* rather than *"you may not read it"*. A vacuous pass hiding inside the assertion
   its author was most confident about.
2. **The fixture was RLS-filtered by the caller.** Resolving the id inline read `public.documents`,
   gated by `can_read_document`, which returned **no rows** for the very writer who cannot read it —
   so `p_cited_entity_id` arrived NULL and the **shape** check fired (`23514`) *before* the
   authorization gate could. F7 would have been asserting **the fixture vanishing**, not the door
   working. Fixed by resolving as `postgres` into a temp table (not RLS-filtered).
3. **The temp table needed an explicit grant** — probes run as `authenticated`, `postgres` owns it.

**The rule this yields:**

> When a door answers **one code for several causes** — by design, to avoid an oracle — a test
> asserting that code proves **nothing about which cause fired**. The discriminating fact must be
> established **separately, before the assertion runs**.

`F5b` now pins both sides first: the document **exists**, `chefe.ccih` **can** read it, `nspcoord.a`
**cannot** — so F7's `HC0D8` can only mean unreadability. ⚠ **Two of the three defects would have
left a GREEN suite asserting nothing**, which is [[FUP-PGTAP-VACUOUS]] in its natural habitat:
`lint:vacuous` scans TS only, and every one of these is SQL.

`341`'s `D4d` was also converted from a substring ACL test to `aclexplode`, and **`D4e` added for the
direction a presence check structurally cannot see** (`grantee = 0` is PUBLIC) — the same habit that
produced a false positive *and* a vacuous guard across three migrations, now removed from the suite
as well as the migrations.

Suite `341`: **plan(41), 41 assertions** (30 → 41); repo total **192 files / 6272** (6261 → 6272).
Both deltas are **+11** — stated with the reconciliation because a bare "41" beside a "+11" reads as
a discrepancy, and this phase has already mis-recorded three counts.

## ⭐ The finding that justifies the whole "inference until reset" discipline (S2 `…000150`, 2026-08-14)

**A fresh `supabase db reset` did not confirm the hand-applied `REVOKE` — it FALSIFIED the migration
file.** `…000120`'s PUBLIC-grant assertion **had never executed**: it was added while repairing an
already-registered migration, so only the hand-applied `REVOKE` ever took effect, and the corrected
file first ran at the reset — where it **fired on every function and broke the reset**.

⚠ **The lead had checked that the file and the live DB agreed, and they did.** Had that been recorded
as fact rather than as an inference, a **broken migration would have carried into the gate with a
green local stack agreeing with it**. The rule, in the words that matter:

> **"File and DB agree" is NOT "the file works."** A migration that has never executed is unproven no
> matter how exactly the database matches what it claims to do.

**One habit, two OPPOSITE failures — the sharper half.** The assertions asked a *string* a question
only *structure* can answer:

| migration | test | failure |
| --- | --- | --- |
| `…000120` | `acl like '%=X/postgres%'` | **false positive on everything** — PUBLIC is an aclitem with an **empty grantee**, so the pattern also matches `postgres=X/postgres` |
| `…000130`, `…000150` | `and not like '%postgres=X/postgres%'` | **vacuous** — structurally incapable of firing while `postgres` holds a grant |

Fixed with `aclexplode(...) where grantee = 0`. **Third instance of this class in one slice** — the
first was `prosrc like '%HC0DM%'` matching the author's own **comment**. `prosrc` includes comments;
an ACL is not a string. Related: [[a-comment-is-an-assertion-that-goes-stale-silently]].

⚠ **The near-miss is part of the finding.** The first diagnosis blamed
`information_schema.column_privileges`, which was *plausible* — the column genuinely showed 0 rows —
but only because **the failed reset never created it**. *A symptom observed in a broken end-state is
not evidence about the cause.* Reproducing against the real pre-state gave the true error in one step.

**Verified after the fix** (lead, independently): `anon_exec = f` and `public_holds_exec = f`
(via `aclexplode`) on both doors, and **0 first-party `public` functions anon-executable** — the
population assertion, not just the two touched.

🔧 **Residual, benign, tracked:** `…000110:181` still uses
`if v_acl not like '%authenticated=X/postgres%'`. That is a **presence** check, so it fails **loud**
(false alarm, never false pass) — not worth re-opening a landed migration, but convert it when that
file is next touched. *The habit is the defect, even where this instance is safe.*

**Also durable, and better than the design it replaces:** `328` **K9b now asserts the OFF flag set is
EMPTY** rather than naming a flag, so it cannot go stale the next time a wave ships. The K9b/K9c
coupling exists to force flag choreography to be an explicit reviewed edit; this makes it survive
its own success.

### 🔵 IN PROGRESS — **DM5: Wave D + retirement** (opened 2026-08-14) — the program's FINAL phase

> **Plan:** [dm5-wave-d-retirement-plan.md](docs/plans/dm5-wave-d-retirement-plan.md) ·
> **ADR [0120](docs/decisions/0120-dm5-wave-d-retirement-decisions.md)** (D1–D10, PO-ruled
> 2026-08-14 before any SQL) · **step 0:** [dm5-surface-verification.md](docs/progress/dm5-surface-verification.md)
> (`005fe34d`). Window `20260927000100`+ · pgTAP **`341`** · flag `documents_wave_d`.
>
> **Step 0 found two hard blockers the parent plan did not know about**, both re-verified by the
> lead directly against the catalog before rulings were taken:
> ① **`securable_resources` admits only 6 types** and its `tenant_shape` CHECK **re-enumerates the
> same list**, so widening one CHECK alone fails every insert closed — Wave D evidence and
> form-response prints have no home. ② **`UNIQUE (document_version_id, rendition_kind)`** permits one
> `printed_pdf` per version, against `printed_documents_one_active`'s *partial* unique retaining many
> historical prints. Plus **six places the plan describes a system that does not exist** — the
> manifest is **8 buckets not 9**, the verification-token "satellite" is not a table, and
> `rca_evidence`'s parked FK is **triple-locked**, not single.
>
> **PO rulings 2026-08-14 (ADR 0120):** **R1** three new securable types (`rca`, `capa_action`,
> `form_response`), commission pinned to **reporting** with custody staying a read-time input ·
> **R3** all four `source_kind` values migrate, so the manifest closes at 8/8. ⛔ **R2 and R4 were
> RE-RULED the same day and are WITHDRAWN — see below.**
>
> ⛔ **ADR 0120 D3/D4/D5 WITHDRAWN 2026-08-14, never built; D11 replaces them.** Printed renditions
> follow the **existing new-version idiom** — each print mints a `document_version`, binds its bytes
> as that version's `printed_pdf`, records supersession on `printed_documents`, retires superseded
> bytes via `file_objects.disposal_state`. **`document_version_files` is not touched**: no liveness
> column, no partial unique, no guard exception, **no DM1-invariant amendment**. **S1 is withdrawn
> as a slice**; its window is released to S2.
>
> **Why — four facts, each verified live before the re-ruling.** ⭐ **DM2 had already evaluated and
> rejected D3+D4 BY NAME** (`dm2-orchestration-wave-a.md:253-281`: *"Option 2 (partial UNIQUE +
> liveness column + guard exception) remains strictly worse: an invariant edit for no additional
> honesty"*) · **S2.8 was never parked** — ruled, **built** (`20260924000500`), ADR'd at 0118 and
> keystoned at `329` R6/R7/R8, shipped as `reclassify_document` + `complete_document_reclassification`
> · `app.guard_document_version_immutable()` is **SHARED with `document_versions`**, so D4's
> "narrow exception" reached the table ADR 0114 **D10** protects with *"never a pointer update
> (F-03)"* · the "incompatible cardinality" compared **two keys that never meet**
> (`(document_version_id, rendition_kind)` is per-**version**; `(source_kind, source_id,
> template_key)` is per-**source**) — an artifact of the lead's framing, on an unrecorded
> many-prints-to-one-version assumption.
>
> ⛔ **Root cause, and it has now misled TWICE:** `docs/backend-state.md:245-246` said *"Still
> unbuilt: S2.8 … no legal expression"* — written at DM2 S2 close, never updated when S2.8 landed
> **hours later**. DM3's planner hit it and **caught** it; DM5's lead hit it and **did not**, and it
> produced an ADR decision. ⭐ The verdict was keyed to the **noun** `reclassify_document_file` —
> genuinely absent from `pg_proc` — while the **capability** was live under another name. *Resolve
> the VALUE, not the noun.* Corrected in the same change. **Nothing was built on D3–D5**; the cost
> was one planning cycle, because the check happened before SQL.
>
> **Lead ruling, not a PO question:** the parent plan's retirement method — "prove empty via the
> Storage API, then delete" — is **WITHDRAWN**. It proves emptiness against `storage.objects`, which
> a reset truncates while the bytes survive: measured **0 metadata rows vs 699 objects / 7.0 MB, 198
> PHI-tier**, `list` returning `[]` for all 12 buckets. Replaced by **manifest-first deletion**
> (capture keys → delete by key → assert `deleted_count == manifest_count`). ⚠ **Calibration:** the
> orphans are **not servable** (every read path resolves metadata first) — this is a data-at-rest /
> disposal-assertion problem, not a live exposure. Closes the method half of **FUP-DM5-STORAGE-ORPHANS**.
>
> ⚠ **The assurance plan is WORSE than DM4's.** Every door DM5 adds sits in a census blind class, so
> all four §6 arms pass **regardless of what is built** — bespoke keystones + mutation twins are
> mandatory, and the record names the **arm**, not the script. Red-first is genuinely hard here: a
> keystone against the un-parked `add_rca_evidence` **goes green on its first run**, satisfied by a
> *sibling* lock (the table CHECK). **FUP-PGTAP-VACUOUS applies directly** — `lint:vacuous` does not
> scan SQL and every DM5 keystone is SQL.
>
> **Later rulings 2026-08-14 — D12 (PO) + D13 (lead), both gating S3.** **D12:** printed bytes are
> served by **composition** — `open_printed_document` keeps `can_view_printed_document`, the
> revoked/superseded overlay and the token path, and **delegates byte resolution to the core door**.
> Forced by two facts: `open_document_version` hardcodes `rendition_kind = 'source'` (so a
> print-only version is unopenable through it) and `file_objects` may only live in the two document
> buckets, which carry **no SELECT policy** because ADR 0114 **D8** reserves them for *"the **single**
> audited door … (the F-01 class dies structurally)"*. ⚠ The shared resolver must be **`app`-scoped,
> never `public`**, authority the **conjunction**, and **both** refusal directions keystoned.
> **D13:** a print mints its version on its **OWN `documents` row**, never appended to a content
> document — else `add_referral_shared_item`, which picks latest-version-desc, would silently
> **freeze a printed PDF into a referral snapshot instead of the source content**. Invisible to every
> static gate; keystone the separation itself.
>
> ✅ **S2.8's three DM2 conditions re-verified as ALL DISCHARGED** (by behaviour, not by name —
> because withdrawing D5 on an unverified completion would have been the same error twice). Condition
> 1 was **exceeded**: QA r1 found R6/R7/R8 all stayed green under a `live` relaxation that kills the
> invariant for two simultaneously-pending duplicates, so R10a/R10s pin the exact
> `disposal_state = 'none'` spelling. Nothing from S2.8 becomes a DM5 item.
>
> **Slices:** **S0 ✅ COMPLETE** (`0e85cbe7`, `9d37ad79`) — `scripts/storage-manifest.mjs`, **8/8
> self-test controls**, baseline for the 8 buckets, `document-reconciliation.mjs` widened 2→**12**.
> ⭐ **C8 was added unprompted and is the discipline generalizing**: C2 proved the tool *refuses* a
> bad manifest, but *a tool hardwired to refuse everything passes C2 and is useless* — C8 is the
> permissive twin. That is the both-polarities rule applied to the harness itself.
> ⭐ **Three of the eight controls found real defects**: `find` on a *missing* directory emits the same
> empty output as an *empty* one, so an absent bucket read as verified-empty (now `—` vs `0` vs `?`);
> `storage.protect_delete()` **blocks `storage.objects` DML on this stack** — a platform guard
> absent from the step-0 model, so the harness plants bytes directly; and C8 was the missing
> permissive half. ⚠ The committed baseline
> **self-labels DEGENERATE** (zero API-visible keys while bytes exist = the post-reset state) and
> **must not be reused as S4 input**. Orphan counts, domains stated because they differ: **221 keys /
> 6.93 MB / 15 PHI** over the 8 retirement buckets; **699 / 7.02 MB / 198 PHI** over all 12.
> ~~S1 substrate amendment~~ ⛔ **WITHDRAWN** · **S2 🔵 IN PROGRESS** · S3 printed renditions
> (D11/D12/D13; **no longer blocked**) · S4 retirement execution · S5 operational closure · S6 canon + sweep.
>
> **S2 progress (2026-08-14).** Contract posted **first** (`fec8a84f`) + amendment 1 (`6a3fbf2a`);
> `frontend` spawned against it and building in parallel. **M1 applied** (`e386505f`), types
> regenerated (`ca0b5ab5`, after the reset and **before** `test:db` installs `pgtap` — that
> pollution has bitten this repo). Verified **against the applied migration, not the file text**:
> registry **392 == 392** · both CHECKs carry `rca` + `capa_action` · `tenant_shape` carries **both
> shapes** · `rca` registry commission = `event.reporting_commission_id` (D2) · `capa_action`
> commission **NULL** (D14) · `hospital_of_capa_action` non-NULL (D16) · composite FKs present ·
> **pgTAP 191f/6231 PASS — the DM4 baseline exactly, zero regressions.**
> ⭐ **The D1 coupling is PROVEN, not assumed:** with only `type_check` widened, a **fully tenanted**
> `rca` row is still rejected `23514` — fully tenanted *deliberately*, so the rejection can only come
> from `tenant_shape`'s type list; a minimally-tenanted fixture would have proven nothing. All three
> `tenant_shape` cases were shown to **discriminate before** being written as keystones.
> **`capa_action.commission_id` is left NULL for EVERY row**, including the four sources where it is
> derivable — *a half-populated column invites a future reader to treat it as authoritative*, so the
> NULL is a deliberate signal rather than an absence.
>
> **M2 `…000110` applied** (`5fd60ff1`) — `can_read_document` kernel arms, custody-following.
> registry **393 == 393** · `rca` arm resolves `can_read_event(event_of_rca(…))` at read time and a
> catalog assertion pins that it does **NOT** use the registry commission · `capa_action` arm names
> `can_read_capa` **explicitly** (it *would* fail closed reaching for the D14 NULL commission, but
> fail-closed-by-accident is not a design) · pgTAP **191f/6231 unchanged**. Applied with
> `migration up --local`, not a reset — non-destructive, `frontend` undisturbed.
> ⭐ **Building the fixture BEFORE the keystone found two things a keystone-first order would have
> hidden.** ① **The seed has no custody-moved event** — all five carry
> `current_owner_commission_id` NULL — so **that arm of `can_read_event` has never been exercised by
> any test in this repo**. A pre-existing coverage gap DM5 merely tripped over; `341` now pins it.
> ② **A raw `UPDATE` cannot create the state** (`guard_event_status()` refuses edits past `triado`),
> so a keystone written first would have failed **at fixture time and read as a defect in the arm
> rather than in the fixture**. The differential runs through the real `transfer_event_custody` RPC,
> which is also the more honest test — it proves the arm under the transition the product performs.
> ⭐ **The persona was checked against all three arms, not assumed:** `multi@test.local` (both
> commissions) and `pqsdual.a@test.local` (PQS of the hospital) would each have turned the
> differential green while proving nothing — the two-locks shape. `staff1.farm` verified as *not*
> PQS, *not* in the reporting commission, *in* the owner commission ⇒ only custody can make it true.
> ⭐ **Technique to repeat in S3:** the `CREATE OR REPLACE` rebuild was **proven faithful by diffing
> the rebuilt `pg_get_functiondef` against the captured original** (diff = exactly the 15 new arm
> lines + 3 comments), plus a `DO` block re-asserting `prosecdef` / `STABLE` / the `search_path` pin
> / the `authenticated` EXECUTE grant **from the catalog**. *Reading a body carefully is not the same
> as proving you reproduced it* — this converts the silent-property-loss class
> ([[guards-that-read-right-but-fail-open]]) into a loud failure at apply time.
>
> **S2 frontend ✅ COMPLETE** (`5793fd16`) — 13 files, +1129/−476. `openUrl` is gone, so rows render
> **no `<a href>` at all**: there is no storage coordinate left in the projection to link to, and bytes
> resolve one at a time through the audited door strictly on click (D8). `canOpen` is obeyed verbatim,
> never re-derived — it decides what to **draw**, the door decides what to **serve** (Rule 1).
> Contract amendment 1 landed *before* ship, so the `terminal` heuristic was **deleted, never
> shipped**; `credential.expiresAt` pre-empts a lapsed reservation so "expired" never reads as
> "broken" at the 120 s PHI TTL. Gates: tsc 0 · lint **5/5**, eslint 0 warnings · vitest 1264/1264.
> **Fork ledger** (recorded so the duplication reads as *chosen*, not accumulated): reused outright —
> `DocumentAvailabilityBadge`, `AVAILABILITY_PRESENTATION`, the MIME/size constants,
> `uploadDocumentFile`; forked deliberately — the open-button **shell** (~25 lines: its contract is
> *"every Wave-A byte moves through THIS control"*, so injecting a different door would falsify the
> one sentence that makes it meaningful) and the upload dialog (Wave-A's carries kind /
> confidentiality / occurredOn that NSP evidence has none of; only the **transport choreography** is
> genuinely shared). `CapaEvidenceList` / `RcaEvidencePanel` were **NOT** forked — re-pointed.
> ⭐ **`unavailable` handled by NARROWING THE REFERENCE, not widening the type:** the
> `DocumentAvailability` import is deleted, the badge map is keyed
> `Exclude<NspEvidenceAvailability,'available'>`, and the `unavailable` **badge entry is deleted** so
> no dead branch can render — the word survives only in the error map, where `HC0D8` genuinely is
> reachable (servable at render, gone by the click). A green typecheck would have been satisfied by
> *either* resolution; only asking which one distinguishes them.
> ⚠ **Runtime-unverified by design** — every action/query signature still throws
> `not implemented — DM5 S2`, so both pages 500 on the list queries until backend lands the bodies.
> Expected under contract-first; **`tester` must not read it as a frontend red.**
> 🔧 **History repair:** `e1557179` shipped with a mangled message (PowerShell here-string in the
> Bash tool — the commit *succeeds*, only the message is wrong, so nothing fails loudly). Frontend
> **correctly refused to `--amend`**: the lead had committed on top, so the reflex fix would have
> rewritten the LEAD's commit — the exact documented failure mode, and the prohibition earned its
> keep. Lead rewrote both commits via safety-branch + `reset --soft` + separate restage;
> **tree hash `abbe887c…` identical on both sides**, verified independently by frontend afterwards.
>
> **Two lead errors this slice, both recorded because they are the same class as the phase's other
> findings.** ① I told backend the upload ticket lacked `expiresAt`; it was at
> `evidence-contract.ts:202` all along — **my grep pattern never contained the term**, so I reported
> an absence from a search that could not have found it. ② My S2 task brief told `frontend` the new
> availability states were `pending/failed/disposed/unavailable`; there are **three** new states and
> `unavailable` is not among them. ⭐ Rule drawn: *the search that proves an absence must NAME the
> thing* — quotable is not the same as capable. Same family as `\yname\y` failing before `_` and the
> `.rpc('X')` sweep that missed a line-wrapped call site.
> ⚠ **`unavailable` is correctly ABSENT from `NspEvidenceAvailability`** — both NSP projections
> filter `.is('deleted_at', null)` (`rca.ts:258`, `capa.ts:366`) so it is unreachable, while
> `documents.ts` has **no** such filter, which is why the twin carries five. Tied in the doc comment
> to the **filter**, not to intent, so removing the filter makes the omission visibly wrong rather
> than quietly stale. Adding it would have been dead vocabulary reading as live behaviour — the same
> reasoning that keeps `HC0DM` out of the error map.
>
> ⛔ **State:** branch `main`, **NOT pushed**. All five DM flags ship **OFF**.
> ✅ graphify refresh **discharged** `02cec1a0` (was owed since the DM0–DM3 merge).
>
> **New this phase:** 🟡 **FUP-DM5-GRANTS** — `rca_evidence` / `capa_action_evidence` carry table-wide
> `arwdDxtm` to `authenticated`, so their RPCs are **not single doors**. ⚠ Calibrated: RLS *is* on
> with genuinely distinct read/write predicates, so this is hardening, not an open door — but DM5
> must not assume the RPC is the only writer when placing the `documents_wave_d` assert.


---

## S2 — NSP RCA/CAPA evidence onto the substrate: CLOSE

> ⛔⛔ **THE FIGURES IN THIS SECTION ARE THE FIRST CLOSE'S AND THEY ARE VOID.** This close was
> **rejected** — S2 was reopened at `52242f26` because the feature **did not work at all** while every
> figure below was green. **The section is retained verbatim as evidence of what a green close can
> assert**, and because its sub-sections on the arms, the ACL habit and the recurring classes are still
> accurate and durable. **Do not cite the gate-figures table.**
>
> ✅ **The REAL, current S2 figures** — re-measured by the lead on a fresh reset at HEAD `e2af9790`,
> tree clean, 2026-08-14: **8** migrations `20260927000100`–`000170` (not 6) · registry **399 == 399**
> (not 397) · pgTAP **192 files / 6284** (not 6272) · tsc **0** · lint **5/5** · vitest **1294** (not
> 1264) · all four arms **HOLD** (census 546/569 · hat 3 · floor 74 · wrapper BLIND 41) ·
> degenerate-body sweep **0** · diff-scoped sweep **COVERED / BLIND 0 / 1 case executed**.
>
> ⚠ **Why this banner is loud, and in prose rather than an HTML comment:** ADR 0120's own withdrawal
> root-cause #3 was *"the superseded text was marked with an HTML comment — invisible in rendered
> Markdown, so I quoted dead text as current. **A supersession marker only a raw-file reader can see is
> not a marker.**"* The reopen banner sits ~200 lines above this heading, under a different one; a reader
> who lands here by search or link would never see it. **That is the same failure, one file over.**

Migrations `20260927000100`–`000150` (6) · pgTAP `341` · ADR 0120 D1/D2/D10/D14/D15/D16.

### Gate figures (fresh `supabase db reset`) — ⛔ VOID, see the banner above

| check | figure (VOID) |
| --- | --- |
| registry | **397 registered == 397 files** |
| pgTAP | **192 files / 6272 tests PASS** |
| reconciliation | `341`: 30 to 41 · repo: 6261 to 6272 · **both +11** |
| tsc / lint / vitest | 0 · 5/5 · 1264/1264 |

### The four authz arms — named as arms, not as the script

| arm | the question it asks | result |
| --- | --- | --- |
| `ARM=census` | has anything **ever asked** about each live gate? | **HOLDS** — live 546 / verdicts 569 |
| `ARM=hat` | does any door read `memberships` **without the caller's hat**? | **HOLDS** — 3, all reasoned-allowlisted |
| `ARM=floor` | is every door **actually called**? | **HOLDS** — 74 never-called, all allowlisted |
| `FROMFINDINGS=1 ARM=wrapper` | `prosecdef = f` invoker wrappers | **HOLDS** — BLIND 41, all allowlisted |

**`ARM=census` stayed at 546 live, and that is correct, not an oversight.** No S2 function
qualifies as a census door: `app.assert_documents_wave_d_enabled` is `prosecdef = f` returning
`void`; `ensure_securable_resource_rca` / `_capa_action` return `trigger`; `add_rca_evidence` /
`add_capa_action_evidence` are composite-returning — the **pre-existing** 141 blind class, not
growth. `can_read_document` was already in the domain; the policy swap was net-zero. So **no new
door needed to join the census domain or the findings file.**

**Signature-keyed artifacts re-checked after the parameter change** — a signature change orphans a
signature-keyed entry exactly as a rename does. `authz-neverclled-door-allowlist.txt:37` updated in
the migration's own commit; findings file carries no entry for either door; line 41 deliberately
untouched (DM4's retired surface, FUP-AUTHZ-ALLOWLIST-ROT's positive control).

### Diff-scoped door sweep — 1 case COVERED, with its DOMAIN stated

Gate list derived from the migration diff (8 gates).

```
PREDICATE ARM:  COVERED  app.can_read_document(p_document_id uuid, p_uid uuid)
POLICY ARM:     (empty)
BLIND: 0   ERROR(harness): 0        over a domain of ONE
```

WARNING: the first run executed **zero cases** and printed `BLIND: 0` — indistinguishable from
clean. `CASES` matches bare `proname`, space-separated, exact; a pipe-delimited string is one token
matching nothing. **Not cited.** The re-run's nonzero count is what makes the verdict citable.

**4 of 5 requested gates are outside the harness's domain and were NOT swept** — recorded as
unswept, never as clean: `add_rca_evidence` / `add_capa_action_evidence` (composite-returning),
`hospital_of_capa_action` (uuid-returning), `capa_evidence_obj_insert_writable` (the policy arm
enumerates `public.*`; this policy is on `storage.objects`). Their only coverage is `341`.

Both runs overwrote `docs/reviews/authz-door-audit-findings.md`; restored with `git checkout --`
and the tree verified clean each time.

### The `…000120` REVOKE — FACT: falsified, then fixed

**Not a confirmed inference.** The reset did not confirm the hand-applied delta — **it falsified
the file.** That PUBLIC assertion had *never executed*: it was added while repairing an
already-registered migration, so only the hand-applied REVOKE ever took effect, and the corrected
file first ran at the reset, where it failed.

**"File and DB agree" is not "the file works."** Both agreed, and both were checked. Recording the
reproduction as fact then would have carried a broken migration into the gate with a green local
stack agreeing with it.

Now fact on a fresh reset: `anon_exec = false` on both doors; PUBLIC holds no EXECUTE
(`aclexplode … grantee = 0` false); 0 first-party `public` functions anon-executable.

### One habit, two opposite failures — the substring ACL test

`acl like '%=X/postgres%'` matched **every** function (PUBLIC is an aclitem with an *empty*
grantee, so it also matches `postgres=X/postgres`) — false positive in `…000120`. The variant
guarded with `and not like '%postgres=X/postgres%'` was **structurally incapable of firing** while
postgres held a grant — vacuous guard in `…000130`/`…000150`. *Asking a string a question only
structure can answer.* All sites — plus `…000110`'s presence check and `341` D4d — now use
`aclexplode`, with `D4e` added for the direction a presence check cannot see.

### Durable mechanism fixes (not phase details)

- **K9b asserts the OFF set is EMPTY** rather than naming a flag: it cannot go stale the next time
  a wave ships. A fix to the coupling mechanism itself, better than the coupling as designed.
- **`…000140` kept as its own migration** so BUG-DM5-CAPA-1's red was provable against the pre-fix
  catalog, and re-measured at HEAD `3b51c20d` (tree clean) rather than inherited from step 0.

### Recurring classes — counted, because the recurrence is the finding

- **Syntax-bounded enumeration: THREE instances**, three different authors' contexts, one shape —
  *the boundary was a syntax, not the property*: step 0's `.rpc('X')` sweep missing a line-wrapped
  call; the lead's `expiresAt` grep whose pattern never contained the term; this slice's derivation
  regex matching only `create or replace function` and missing a bare `create function`.
- **Text-as-truth: THREE instances** — the substring ACL tests (two opposite directions) and
  `prosrc like '%HC0DM%'` firing on the migration's own comment.
- **Measured vs. reasoned** — every claim produced by measurement held; every claim produced by
  reading and reasoning needed correction. That split, not authorship, is the phase's lesson.

### A code-design decision to defend against future "improvement"

`HC0D8` is raised for **both** absence and wrong-home/unreadable, deliberately: an error
distinguishing *"does not exist"* from *"not yours"* is an **existence oracle**.

Its cost, discovered live: **the ambiguity that blinds an attacker also blinds the test.** `341` F7
asserted `HC0D8` and received `HC0D8` — from "no such document", not "you may not read it" —
passing vacuously while F4/F6 went visibly red. **When a door answers one code for several causes,
a test asserting that code proves nothing about which cause fired; the discriminating fact must be
pinned separately, before the assertion runs.** `F5b` does that. The same shape applies to D12's
conjunction in S3.

### For `tester` — one seam a UI spec cannot reach

The **direct-PostgREST-DML path**: both evidence tables carry table-wide `arwdDxtm` to
`authenticated`, so a client can `POST /rest/v1/rca_evidence` without traversing the RPC. That is
why the shape rules are CHECKs and the flag is an assert. A UI-driven spec always goes through the
action and can never exercise the bypass — `341` F8 covers it in SQL. **A correctly-drawn boundary,
not a coverage gap.**

## Rotated from PROGRESS.md 2026-08-14 (the size rotation) — the live DM5 section, verbatim

> ⛔ **SUPERSEDED SNAPSHOT — do not read the block below as current state.** It is preserved
> **byte-for-byte** as it stood at the rotation, which is *before* S3's step 3, so it still says
> **"S3 IS NOT CLOSED"** and *"QA r2 re-review OWED"*. **S3 closed 2026-08-14 with an APPROVED r2** — the
> live status is the **§ "S3 … COMPLETE"** section at the head of this file. Left unedited deliberately:
> an archive that gets quietly corrected stops being evidence of what was believed when. ⚠ A `grep` for
> `S3 IS NOT CLOSED` **will** hit here — check which section you landed in.

> PROGRESS.md had grown back to **154 KB** against CLAUDE.md §7's "well under 60 KB". The live
> `## Current Phase Tasks` DM5 block (S3 + S2, lines 117-352) is preserved here **byte-for-byte**;
> the live file keeps the status, the gate figures and the resume point. ⚠ Two items in it were
> **NOT** duplicated anywhere before this rotation — the "three catalog facts were WRONG" table and
> the S2 close-then-reopen history — which is why the block is copied whole rather than summarized.

### 🔵 IN PROGRESS — **DM5: Wave D + retirement** (opened 2026-08-14) — the program's FINAL phase

> **Full detail → [dm5-wave-d-retirement.md](docs/progress/dm5-wave-d-retirement.md)** (rotated
> mid-phase 2026-08-14: the live file had hit **128 KB** against §7's "well under 60 KB", and every
> spawn reads it). Plan: [dm5-wave-d-retirement-plan.md](docs/plans/dm5-wave-d-retirement-plan.md) ·
> ADR **[0120](docs/decisions/0120-dm5-wave-d-retirement-decisions.md)** (D1–D16) · step 0:
> [dm5-surface-verification.md](docs/progress/dm5-surface-verification.md).
> Window `20260927000100`+ · pgTAP **`341`** · flag `documents_wave_d`.
>
> **Slices:** **S0 ✅** manifest tool (`0e85cbe7`, `9d37ad79` — 8/8 self-test controls, 3 of which
> found real defects; baseline self-labels **DEGENERATE**, not S4 input) · ~~S1~~ ⛔ **WITHDRAWN,
> never built** (D3/D4/D5 struck → **D11**; the mechanism was already built at DM2 and DM2 had
> rejected the proposed shape **by name**) · **S2 ✅ gate steps 1–2 COMPLETE** NSP RCA/CAPA evidence ·
> **S3 🔵 OPENED 2026-08-14** printed renditions (D6/D7/D11/D12/D13 + **D17**, every ruling made) ·
> S4 retirement (**8** buckets, manifest-first per D9) · S5 operational closure · S6 canon + exit sweep.
>
> ### 🔵 S3 — printed renditions onto the substrate (opened 2026-08-14, `backend` spawned, contract-first)
>
> Window **`20260927000300`–`000399`** · pgTAP **`342_dm5_s3_printed_renditions.sql`** (49), labels
> `DM5·S3<n>`. **Preceded by a lead resume audit** — baseline re-measured, S2's four owed arms
> discharged, 8 record defects fixed (`8e0cd6ab`, `d6494e2f`); detail in the phase record's
> `RESUME AUDIT` section. PO rulings **D17** (design for a reset remote) and **D18** (prints filtered
> out of Documentos) recorded in ADR 0120 before any SQL was written.
>
> ### ⛔⛔ THREE of the "catalog facts" the lead pinned here before spawning were WRONG — corrected in place
>
> Left uncorrected they would have misled every spawn, which is the exact trap this phase has been
> fixing all day. What was pinned → what `backend` measured (and the lead re-verified):
>
> | pinned by the lead | truth | why the pin was wrong |
> |---|---|---|
> | pgTAP **`341`** | **`342`** — `341_dm5_s2_nsp_evidence_substrate.sql` is **S2's own suite** | the number was assumed free, never `ls`'d |
> | `tenant_shape` carries 2 shapes so `form_response` forces a **third**, keystone all **three** | still **TWO** shapes — `responses.commission_id` is **NOT NULL**, so `form_response` joins the existing full-tenancy **arm 1** | the *decision* (which arm) was mistaken for a *new shape* |
> | `312`/`313`/`323` insert **11** `storage.objects` rows | **9** persist — a 10th site (`312:405`) sits inside a `throws_ok` asserting the insert is **refused** | counted insert *statements*, not *persisting rows* |
>
> ✅ **Correct as pinned:** `type_check` admits 8 types and `form_response` is the single D1/D6 addition;
> `pd_storage_path_derived` is a CHECK, not a column. Also false in the brief (and in ADR 0120 D17.1):
> **`seed.sql` inserts ZERO `printed_documents` rows** — so there was no seed rewrite in this slice, only
> the three pgTAP fixtures.
>
> ⭐ **The instruction carried into S3 from S2's failure:** *a new home type means enumerating EVERY
> dispatch on `resource_type` — `can_read_*` **and** `can_write_*`* — derived from the catalog as a
> **property**, never from an expected list of names. And **posting a contract is not implementing it**:
> S2's 11 placeholder bodies were left throwing and the slice was closed green.
> ⚠ **D12's conjunction is a STRICT NARROWING** — the kernel arm *implies* the print check, so only
> **one** refusal direction is reachable; pin the other **structurally** and do not fabricate a fixture
> for an unreachable state, nor change the authorization to make it testable (that proposal was rejected).
>
> ### ✅ S3 BUILD COMPLETE — steps 1 ✅ · 2 ✅ · 3 ⏳ **QA r2 re-review OWED** · 4 ⏳ PO
>
> **⛔ S3 IS NOT CLOSED.** QA returned **CHANGES REQUESTED (r1)**; `backend` discharged both blockers and
> four MINORs (`af9a894e`) and re-passed step 1 in full — but **QA has not re-reviewed the fixes**, so
> there is no `APPROVED` verdict and §6 step 3 is unsatisfied. **Next session: run the QA r2 re-review
> first** (brief in [dm5-handoff.md](docs/progress/dm5-handoff.md)), then take S3 to the PO.
>
> #### r1 gate re-run — fresh reset, lead-verified from the catalog (2026-08-14, HEAD `1513c094`)
>
> | check | figure |
> |---|---|
> | registry · pgTAP | **406 == 406** · **193 files / 6348 PASS** |
> | tsc · lint · vitest | 0 · **5/5** (0 warnings) · **1294** |
> | four ARMs | `census` **HOLDS** (live 546) · `hat` **HOLDS** · `floor` **HOLDS** · `FROMFINDINGS=1 wrapper` **HOLDS** |
> | degenerate bodies · findings file | **0** · **595** untouched |
>
> **Lead-verified directly, not accepted from the report:** `securable_resources_type_check` admits **9**
> types · `app.resolve_document_version_bytes` exists and **`authenticated` cannot EXECUTE it** (D12's
> scope requirement standing at the ACL) · the print arm is present in **both** kernel doors ·
> `printed_documents.storage_path` is **dropped** · degenerate bodies **0** · all six teammate commits are
> **ancestors of HEAD**.
>
> ⚠ **`backend` predicted 6346 and the suite said 6348 — its own arithmetic slip, reconciled against the
> in-file plan lines** (`312` 75→77, `342` 49→59, `6336 + 12 = 6348`) rather than restated. Worth keeping:
> *a prediction restated instead of reconciled is how a wrong number becomes a record.*
>
> #### r1's own lesson — the fix for MAJOR-1 was committed in MAJOR-1's shape
>
> `backend`'s MINOR-4 fix claimed a live misreport (a duplicate `p_id` answered `HC0D4`). **Measured,
> false:** the coordinate is a pure function of `p_id`, so a duplicate collides on
> `file_objects_bucket_path_uniq` **before** the `printed_documents` insert — *outside* the handler — and
> the keystone passed identically with the old broad handler. Relabelled **latent hardening**, and
> keystoned by **opening the lock that hides it** (dropping the coordinate unique in-transaction so the
> re-mint reaches `printed_documents_pkey`). ⭐ Two bugs in its own red-first harness were caught by the
> harness's **controls**, not by reading it.
>
> #### The step-1/2 detail that produced it
>
> #### ✅ GATE GREEN — the FIRST full `e2e:prod` run in DM5, at any point in the phase (lead, 2026-08-14)
>
> ```
> GATE SUMMARY: 1120 passed · 0 failed · 0 infra · 3 flaky · 0 did-not-run · 18 batches
> COVERAGE:     accounted for 1123 of 1129 collected      (1120 + 3 flaky; the other 6 are skips)
> ```
>
> **Read the accounting, not the verdict:** every one of the 18 batches reported `0 failed`,
> `0 did-not-run` **and** its own `accounted N/N` reconciling — so no batch dropped out of the
> denominator (the way a reset-failed batch does). The 6 "unaccounted" are the **6 skipped** tests
> (`phi-remediation` REM-8/REM-9, `user-registration` AC2 invite-mode, +3), all pre-existing and
> unrelated to S3: `1120 + 3 + 6 = 1129` collected, so the accounting is complete.
>
> ⭐ **`next build` ran and compiled** (`building standalone (next build)… ✓ Compiled successfully`) —
> **S3's first production build**, which is the only gate that catches a client value-import from a
> server query module (it aborts `next build` while tsc, lint and vitest all stay green).
>
> ⭐ **All 15 print tests ran and passed IN THE PROD BUILD** (batch 9), including the new
> `pdf-printing-meetings.spec.ts:399` **D18 test** — *"a meeting print is excluded from the Anexos panel,
> though its own row exists and would be listed without the filter, and its byte corridor still works"* —
> and `pdf-printing.spec.ts:38`'s full mint→download→verify→revoke→overlay→re-verify lifecycle. The
> latter was RED for `tester` on the shared stack; it passes here under `RESET=1`, which **confirms
> BUG-DM5-S3-ENV-FIXTURE-POOL-1 as category (c) environment** rather than a defect.
>
> **3 flaky, and 2 of them are the known pair** — `act-role-assumption:157` and `phase2-auth-shell:268`,
> i.e. FUP-E2E-REPEAT-FLAKY exactly. The third is **new**: `dm5-nsp-evidence.spec.ts:347` EVID-KBD-1, a
> keyboard-only test in **DM5's own S2 spec** (passed on retry #1) — S3 did not touch that file, and the
> shape matches the standing *"`.focus()` is not auto-waiting; it races RSC streaming"* class. Added to
> FUP-E2E-REPEAT-FLAKY as a third member. ⚠ Total flaky **3** against a historical baseline of ~18–27,
> which is better than baseline and therefore **not** evidence that flakiness is fixed — one green run
> does not establish a new baseline.
>
> #### The step-1/2 detail that produced it
>
> **Built** (`6ffd92ff` P0d · `859faa18` SQL cutover · `d964b61a` TS half · `e08cf4eb` smoke):
> migrations `…000300`–`000350` (**6**) — `form_response` into both coupled CHECKs · `printed_documents`
> becomes the **satellite** (`document_id`/`document_version_id` NOT NULL UNIQUE + a **composite FK** so
> they cannot disagree; `storage_path` **and** `pd_storage_path_derived` retired) · the **print arm in
> BOTH kernel doors** · `app.resolve_document_version_bytes` with `open_document_version` **and**
> `open_printed_document` both moved onto it (D12) · the mint rebuilt onto the substrate atomically ·
> four write guards. Fixtures rewritten in `312`/`313`/`323`; TS: D18 anti-join, moved coordinate,
> serving route.
>
> | step 1 check | figure |
> |---|---|
> | registry · pgTAP | **405 == 405** · **193 files / 6336 PASS** (6284 + 1 + 2 + 49, reconciles exactly) |
> | tsc · lint · vitest | 0 · **5/5** (eslint 0 warnings) · **1294** |
> | `ARM=census` / `hat` / `floor` / `FROMFINDINGS=1 wrapper` | **all HOLD** (census live 546 unchanged) |
> | diff-scoped door sweep | **BLIND 0 · ERROR 0**, 2 cases executed (nonzero), baseline asserted |
> | degenerate-body sweep | **0**, after every mutation run |
>
> ⭐ **Step 2 — the corridor EXECUTES, which is the one thing no static gate could say.** Lead ran the
> print specs against S3's code: **`pdf-printing` 9/9** and **`pdf-printing-meetings` 4/5** — real
> `%PDF-` bytes, mint → download → public verify → revoke → overlay → re-verify, plus the restricted
> (`participants_only`) meeting refusing a non-attendee. **S3 is not S2.** ⚠ Requires the **Gotenberg
> sidecar** (`docker start gotenberg-pdf`, `/health` 200 on :3010) **and `--workers=1`** against
> `next dev` — without those, 12 specs fail as uniform `/login` timeouts that read as product defects
> (`curl` answered the same route in 73 ms).
>
> **✅ Discharged since:** the full `e2e:prod` gate ran GREEN (above) · `tester` landed `02b2218d` — the
> retired-column re-point **and** the D18 twin, so the filter now **does** have an automated twin for the
> list half.
>
> **Still open, and NOT to be assumed:** **QA (step 3) not started** · `case`/`interview` prints
> **UNTESTED because unmintable** (`can_view_printed_document` has arms for `form_response`/`meeting`
> only — D6 is satisfied at the *type* level; two of four kinds have never produced a print) ·
> `add_referral_shared_item` never driven end-to-end (S3b pins both of its exclusions structurally, but no
> referral was created and no freeze attempted) · `file_objects.sha256` for a print is the minter's hash —
> server-side and verified as such, but **not** `finalize_document_upload`'s derivation, and it feeds
> `complete_document_disposal`'s duplicate-evidence probe · the smoke file is **not gate-resident**
> (`grep -n smoke package.json` → no hits) · `storage.objects` orphan behaviour on **Cloud** remains
> **no longer an S4 blocker — FUP-DM5-STORAGE-ORPHANS' remote half was a stale inference, amended: the
> orphaning line was reverted in the CLI (cli#3359) and is lead-verified ABSENT at the pinned v2.105.0,
> with an `auth` positive control** · `ARM=policy` was **not applicable** to this diff (it
> adds `prosecdef` gates, no RLS policy) — recorded as *not applicable*, never as clean.
>
> ⚠ **Two D18 half-truths corrected after implementation, both mine:** the **detail** half's filter landed
> on `queries/documents.ts`'s `getDocument`, which **no route imports** — the reachable same-named export
> in `queries/controlled-documents.ts` selects `from('controlled_documents')`, so prints are excluded
> **structurally, by the schema, not by D18** (ADR 0120 D18 amendment; FUP-DM5-DEAD-CORE-PROJECTION). And
> `form_response` prints have **no panel to leak into at all** — `DocumentHomeResourceType` does not
> include `form_response` — so the exclusion is untestable there for want of a surface, not for want of a
> test. **6 of 9 prints in the DB are that kind.**
>
> ### S2 ✅ — gate steps 1–2 COMPLETE. Baseline RE-MEASURED by the lead at HEAD `e2af9790` (2026-08-14)
>
> Migrations `20260927000100`–`000170` (**8**) · pgTAP **`341`** · the TS layer (11 stubs filled) · the
> S2 UI · 8 new E2E. **Every figure below was re-run on a fresh `supabase db reset`, not inherited from
> the closing report** — and every one reproduced the handoff's claim exactly:
>
> | check | figure |
> | --- | --- |
> | registry | **399 registered == 399 files** |
> | pgTAP | **192 files / 6284 PASS** |
> | tsc · lint · vitest | **0** · **5/5** · **1294/1294** (88 files) |
> | `ARM=census` — has anything ever *asked* about each live gate? | **HOLDS** — live 546 / verdicts 569 |
> | `ARM=hat` — does a door read `memberships` without the caller's hat? | **HOLDS** — 3, all reasoned-allowlisted |
> | `ARM=floor` — is every door actually *called*? | **HOLDS** — 74 never-called, all allowlisted |
> | `FROMFINDINGS=1 ARM=wrapper` — the `prosecdef = f` half | **HOLDS** — BLIND 41, all allowlisted |
> | degenerate-body sweep (§ the incident) | **0 hits** — no gate left open |
> | E2E (quick loop, not `e2e:prod`) | 8/8 new + **36/36 pre-existing at exact prior baseline** |
>
> ⭐ **The four arms were the ONE item S2 left owed.** The handoff recorded them as *"reasoned, not
> verified"* — no new gate or policy was added, so no new census entry *should* be owed. Now **run**:
> all four HOLD and census stayed 546, confirming the reasoning. *An unverified inference about a gate
> is not a gate result.*
> **Diff-scoped door sweep: `COVERED` · BLIND 0 · ERROR 0 · 1 case executed** — lead-verified at the
> pause (`eb863ce8`/`22148ca1`/`fa28ec19`); **inherited here, not re-run today.** The findings row and
> both kernel arms WERE re-verified against the catalog at HEAD.
>
> ⚠ **HISTORY — not current state. S2 was closed ONCE, WRONGLY, and reopened** (`b9e7dc7d` close →
> `52242f26` reopen). Retained because the lesson is the phase's most valuable artifact; all three
> defects are ✅ **FIXED** and re-verified (catalog + 0 stub bodies + green E2E):
> **`BUG-DM5-S2-STUB-1`** 11 TS bodies still `throw 'not implemented — DM5 S2'`, taking down the entire
> RCA/CAPA workspace for every persona · **`BUG-DM5-S2-WRITE-ARM-1`** `app.can_write_document` had no
> `rca`/`capa_action` arm, so `begin_document_upload` refused **everyone** with `P0002` (M2 extended only
> the READ counterpart) · **`BUG-DM5-S2-CITATION-TARGETS-1`** `listRcaCitationTargets` never queried
> `documents`.
>
> ⭐⭐ **THE LESSON, AND IT IS THE LEAD'S FAILURE.** S2 passed a fresh reset, **pgTAP 192f/6272**, tsc 0,
> **lint 5/5**, vitest 1264, and **all four authz arms** — and the feature **did not work at all**.
> **Not one of those gates can execute a page.** The lead recorded weeks earlier that the TS bodies
> were outstanding, wrote it down as *"expected under contract-first"*, and then accepted a close that
> never mentioned them; and steered backend exclusively toward `can_read_document`, never once asking
> what the **write** side dispatches on. [[green-bar-misses-the-wired-seam]] in its purest form yet.
> ⚠ **`ARM=floor` asks whether every door is CALLED and it HELD** — because it counts *doors*, not
> *door-arms*: the doors existed and were called for other home types.
> ⭐ **`tester` went a layer deeper than the first bug** — calling `begin_document_upload` by **raw RPC,
> bypassing the stub layer**, which is the only reason defect 2 was found. Had it stopped at defect 1,
> we would have wired the TS layer, re-run, and hit `P0002` with the "fix" already merged.
>
> ✅ **Resolved since the reopen:** the `…000120` `REVOKE` was **falsified by the reset, then fixed** —
> that PUBLIC assertion had never executed. Now fact on a fresh reset (`anon_exec = false` on both
> doors). *"File and DB agree" is not "the file works."*
>
> ⛔ **State:** branch `main`, **NOT pushed**, no `db push`. All DM flags ship **OFF** (`documents_wave_d`
> is ON in the **local seed only** — catalog-verified: migration default `false`, seed enables a–d).
> graphify ✅ `02cec1a0`.
> **Open:** 🔴 FUP-AUTHZ-HARNESS-TRANSACTIONAL (**a live authz gate was left OPEN on the shared stack**
> — read the phase record's incident section before running any mutation harness) · 🔴 FUP-DM5-STORAGE-ORPHANS
> (**blocks S4**; method half ruled, remote half open) · 🔴 FUP-PGTAP-VACUOUS · 🟠 FUP-DM4-RECUSAL
> (**DM5 does NOT close it**) · 🟠 FUP-DM5-FINALIZE-ATOMIC (**binding input to S5**) ·
> 🟡 FUP-DM5-GRANTS · 🟡 FUP-AUTHZ-ALLOWLIST-ROT · 🟡 FUP-DM5-DVF-FILEOBJ · 🟡 FUP-DM4-PRODROW.
> **✅ Both prose-only items FILED 2026-08-14 (lead), no longer untracked** → 🟠 **FUP-DM5-330-WRITE-BLIND**
> and 🟡 **FUP-PGTAP-WORKER-DEADLOCK** in [follow-ups.md](docs/progress/follow-ups.md).
> ⚠ On filing, the reassurance in the original note did not survive: it said `330`'s blindness is
> "covered by `341`, so not a blocker" — **`341` is S2's own suite**
> (`341_dm5_s2_nsp_evidence_substrate.sql`), which makes the claim *plausible but unverified*, and §6
> step 1 does not accept "another suite covers it" for a BLIND door. It is also **STALE-COVERED-shaped**:
> `can_write_document`'s body changed twice after that note (S2's arms, then `fc7a146d`).
