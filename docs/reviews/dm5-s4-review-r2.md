# DM5 · S4 — QA review, round 2 (§6 step 3)

- **Slice:** DM5 · S4 — legacy storage-bucket retirement
- **Reviewed at:** `main` @ `52ab70a8` (tree clean), local stack only. Nothing remote touched.
- **Round 1:** [dm5-s4-review.md](./dm5-s4-review.md) — ⛔ CHANGES REQUESTED (0 P0 · 2 MAJOR · 7 MINOR · 4 INFO)
- **Date:** 2026-08-17
- **Reviewer:** `qa`
- **Verdict:** ⛔ **CHANGES REQUESTED**

> **B1 is fully discharged. B2's three named locations and R15 itself are discharged, and the new
> R15 is a genuinely better pin than the one it replaced — I confirmed it ran and passed in the
> gate under its new title.**
>
> ⛔ **But the B2 fix introduced a NEW blocking defect of its own class.** To justify the R15
> rewrite, `tester` ran a neutralization at the **raw-SQL layer** and concluded that
> `storage.protect_delete` — not the absent RLS policy — is *"the OPERATIVE guard"* on the
> document buckets. That conclusion is now written into a **pgTAP assertion label**
> (`143_capa.sql:313`), an **E2E spec comment** (`phase14c-rca.spec.ts`), **PROGRESS.md:169-171**
> and the **S5.R plan**. I disproved it by direct measurement **at the HTTP layer R15 actually
> attacks**: with the two RLS locks opened and *nothing else changed*, the same authenticated
> DELETE over the same Storage-API path returned **`200 {"message":"Successfully deleted"}`** and
> the object was gone. The trigger never fired — **the Storage API sets the bypass GUC itself.**
>
> The record therefore now *demotes the only lock there is* (`"our own lock … the OPERATIVE guard
> is storage.protect_delete"`) and promotes one that is inert on the product path. **No code
> change is requested — again — but this is a false claim about a live Rule 6 control, authored
> in the act of fixing a false claim about a live Rule 6 control, and citing the very lesson it
> violates.**

| severity | count | blocking |
| --- | --- | --- |
| **P0** | 0 | — |
| **MAJOR** | 1 (new) | **blocking** |
| **MINOR** | 4 (2 new, 2 carried-partial) | no |
| **INFO** | 4 | no |
| r1 blockers **discharged** | B1 ✅ · B2 ✅ (with a boundary miss, MINOR-8) | — |

**Stack ownership.** I ran **no** `supabase db reset`, **no** `supabase stop/start`, **no**
`e2e:prod` — per the phase's standing hazard. Every DB mutation ran either inside a single
rolled-back transaction or under an `EXIT` trap that drops what it created; the catalog was
re-verified to **4 buckets / 4 storage policies / 0 `r2probe%` policies / 0 `_mut%` functions /
0 degenerate `app` bodies** afterwards, and `git status` is clean. No harness was edited. No repo
file was modified except this review and my `PROGRESS.md` verdict row.

---

## 1 · What I re-measured at HEAD (all mine; r1's own rule is that a figure is inherited or it is measured)

| claim | lead's figure | **my measurement at `52ab70a8`** | verdict |
| --- | --- | --- | --- |
| migrations changed since `19dd3124` | 0 files | `git diff --name-only 19dd3124..HEAD -- supabase/migrations/**` → **0** | ✅ |
| everything else changed since `19dd3124` | — | only `142_rca.sql`, `143_capa.sql` (comments + one label), `constants.ts`, `storage-manifest.mjs`, `document-reconciliation.mjs` (**all three comment-only**, verified from the diff) + docs + `phase14c-rca.spec.ts` | ✅ |
| `ARM=census` | inherited from `19dd3124` | **re-run: live 546 / verdicts 570, `INVARIANT HOLDS`, exit 0** | ✅ |
| `FROMFINDINGS=1 ARM=wrapper` | inherited | **re-run: BLIND 41 ⊆ allowlist, exit 0** | ✅ |
| `ARM=hat` | inherited | **re-run: 3 findings, all reasoned-allowlisted, self-test 6/6, exit 0** | ✅ |
| `ARM=floor` | inherited | **re-run: 74 never-called doors, all allowlisted, exit 0** | ✅ |
| storage catalog | 4 / 4 | `storage.buckets` = the 4 survivors · `pg_policies` on `storage.objects` = **4** · `storage.objects` = **0 rows** | ✅ |
| the four affected assertions | pass | evaluated **directly against the live catalog**: `143` Rule-6 `0 / 2` · `142`+`143` nsp-evidence doors `0` · `200` `0 / 0` · `325` t6 `0` / t7 `0` / **t8 `4`** | ✅ |
| `e2e:prod` per-batch accounting | 1121 / 1129 | **re-summed from the 18 `(log: …)` paths the runner names** — passed **1121**, flaky **2**, skipped **6**, accounted **1129/1129**, `0 did-not-run` in all 18 | ✅ |
| R15 executed | yes | `batch-12.log:47` → `ok 44 … phase14c-rca.spec.ts:736:5 › R15: RCA evidence bytes on the document substrate … the object survives the attempt (451ms)` | ✅ |

**On the stale-log trap.** I bounded every log read to the exact 18 paths in `e2e.log`'s `(log: …)`
lines and cross-checked their mtimes: all fall inside `03:51:54–04:49:41` on 2026-08-17, one
contiguous run. `/tmp/e2e-prod-gate/` does hold decoys — `batch-1-rerun.log` (03:37, a *dead*
attempt, 14 min before this run's batch 1), `batch-15/16/17-rerun.log` from 2026-08-13, and
`batch-19…33.log` from 2026-08-12. **A glob would have mixed four dead runs in.** The two `-rerun`
logs that ARE authoritative (`batch-6-rerun`, `batch-11-rerun`) supersede same-run first attempts
at 04:13 and 04:33.

**I did not re-run `npm run test:db`.** The only pgTAP edits since my r1 measurement are comment
lines and one assertion **label string** — no predicate, no `plan()` count — so 193 files / 6351
carries. I substituted the stronger check: I evaluated the affected predicates themselves against
the live catalog (row above). Recorded in §7.

---

## 2 · B1 — ✅ **FULLY DISCHARGED**, and it went further than I asked

Each of B1's four requirements, checked against the tree rather than against the commit message:

| requirement | where | verdict |
| --- | --- | --- |
| correct every present-tense claim, with the measured timeline | `dm5-wave-d-retirement.md:41-68` · `dm5-handoff.md:580-587` · `follow-ups.md:354-371` · `PROGRESS.md:161-164, 337-344, 655` · ADR `0120` D9 postscript · **also** `backend-state.md:97-99` and the plan — **seven** locations, two more than the five I named | ✅ |
| state the mechanism as undetermined | ADR 0120: *"Which step did it is **not established, and I invent no mechanism**"* — the **window** is attributed (the lead's own `stop`/`start` recovery), the **step** is not. That is the right split | ✅ |
| re-put the question to the PO | `5d6d785b`; ruled the same day **on a measurement taken at decision time** (0 in the 8 retired · 166 / 2,970,290 B in the 4 survivors) | ✅ |
| record that the local volume is not durable | **FUP-DM5-STACK-CYCLE-DESTROYS-BYTES**, filed and open in `follow-ups.md:54` + `PROGRESS.md:656`, explicitly scoped as *"D9 governs the deliberate path; the accidental one is ungoverned and silent"* | ✅ |

**The PO ruling is in exactly four places, and I verified that is all four** (the lead's own doubt
#4, which I am closing rather than repeating): ADR `0120` D9 postscript · `follow-ups.md:394` ·
`dm5-wave-d-retirement.md:80` · `PROGRESS.md:655`. My first sweep found only three — `PROGRESS.md`
phrases it *"non-durable disposable test residue"* without the comma, so a literal-string sweep
misses it. **The count is right; the method that produced it was one comma away from being wrong**,
which is the same failure class as everything else in this slice.

⚠ **Residual, non-blocking (MINOR-9).** Inside `PROGRESS.md` itself the two carriers disagree:
the follow-up index line (`:655`) carries the new ruling in full; the **in-phase** follow-up block
(`:337-344`) still ends at *"The PO ruling to 'leave them' was MOOT when given … Item stays OPEN,
now centred on the Cloud question"* and never mentions the re-put. That is r1's MINOR-7 recurring
with the halves swapped — index current, body stale — and it is the **fifth** PROGRESS.md-currency
defect in this phase.

**And the ruling's number is already stale — measured by me, now (INFO-5).** The volume holds
**245 files / 4,394,074 B**, not 166 / 2,970,290: `documents-phi` **68 / 877,782 B**,
`documents-standard` 156 / 3,331,728 B, `form-assets` 12 / 58,184 B, `meeting-audio` 9 / 122,284 B
— against **0 rows** in `storage.objects`. The gate run added ~79 orphans in one hour. This does
**not** unsettle the ruling (the PO ratified a *class*, and the record timestamps its figure), but
a reader will quote `166` as current within a week. The record's own sentence — *"local orphan
accumulation is a standing byproduct of `db reset`"* — is now numerically demonstrated, and **68
PHI-tier orphan files sit in a surviving PHI bucket**, which is r1's INFO-4 growing, not shrinking.

**One measurement that bears on FUP-DM5-STACK-CYCLE-DESTROYS-BYTES, and I state its limit.** The
volume's `CreatedAt` is **still `2026-08-17T01:06:02Z`** — it survived the entire 18-batch gate run
with its 18 `supabase db reset`s. So `db reset` is confirmed non-destructive of the volume (D9's
local rationale holds). This is **not** evidence about `stop`/`start`: `e2e-prod-gate.sh:150-156`
only cycles the stack on its *recovery* branch, and `e2e.log` contains no `cycling the whole stack`
line — both INFRA re-runs (batches 6, 11) were `server_dead` on the **Next** server. **The
stop/start hypothesis is neither confirmed nor contradicted by this run**, and the FUP stays open.

---

## 3 · B2 — ✅ **DISCHARGED**, and the new R15 is sound

### 3.1 All three named locations, plus one the lead found himself

| r1 required | state at HEAD |
| --- | --- |
| `phase14c-rca.spec.ts:28` (header) | ✅ rewritten (`:30-38`), naming the finding and why the old pin could not fail |
| `phase14c-rca.spec.ts:647` (block comment) | ✅ replaced (`:681-...`) |
| `supabase/tests/142_rca.sql:12` | ✅ corrected at `c88f578c` — ⚠ **it was still open after `140ffd8c`**, which had edited `143_capa.sql` instead. The lead caught his own miss; I confirm the correction is real |
| *(not in r1's list)* `143_capa.sql:15` | ✅ corrected in the same commit, correctly judged the same class |

### 3.2 The new R15 is a real pin, not a better-worded one

- **It ran and passed under its new identity** — `batch-12.log`, `phase14c-rca.spec.ts:736`. The
  retired `:650` pin appears in **none** of the 18 authoritative logs. The fix executed; it was not
  merely committed.
- **Collected is unchanged at 1129** across S3 → S4 → S4-rerun, so the 176-line rewrite was
  one-test-for-one-test. Had collected moved, the figure would have needed its own explanation.
- **Its subject is now real.** I verified from the live catalog that `documents-standard` carries
  exactly one policy (`documents_std_obj_insert_reserved`, INSERT) and **no** SELECT/UPDATE/DELETE
  policy — so the object R15 plants is genuinely unreachable, and its survival is a real property.
- **The load-bearing assertion is falsifiable, and I know its mechanism** (see §4): open the two RLS
  locks and the attacker's DELETE returns 200, which reds `expect(attackResp.status()).not.toBe(200)`
  before the byte compare runs. `tester`'s service-role swap proved the same edge from the other side.
- **Status codes are correctly demoted to "weak signal".** They are in fact discriminating here — my
  probe got `403 Unauthorized / Access denied` on a *real, protected* object versus r1's
  `404 not_found` on a nonexistent one — but R15 does not rely on that, which is the right call.

### 3.3 ⚠ MINOR-8 — the widened sweep still has a boundary, and it is one bucket wide

`c88f578c`'s message says the extra location was *"found by re-running the sweep bound by the
property across all eight retired buckets."* I re-ran that sweep by hand-classifying **every**
occurrence of all eight names across `supabase/tests/`, `e2e/`, `src/`, `scripts/`. One survives:

```
supabase/tests/200_controlled_documents.sql:392   -- 7 · IMMUTABLE STORAGE BUCKET (no update/delete policy)
supabase/tests/200_controlled_documents.sql:402   0, 'the controlled-documents bucket has NO update/delete policy (Rule 6)');
```

A present-tense **Rule 6** label and section heading on a bucket whose row is asserted **retired**
ten lines below it (`:410-412`, the successor I approved at r1 §4). Structurally identical to the
`142`/`143` labels the lead corrected — same phase, same file family, same eight-bucket domain,
missed by a sweep that claimed that domain. It is **less severe** than B2 was: the assertion still
detects a resurrected policy, so it is not vacuous, and `325` t6/t8 carry the property with a
positive control. But the *claim of completeness* is falsified, which is the thing to record.
Everything else in `200`/`312`/`325`/`328`/`330`/`340`/`236` is correctly labelled as retired.

---

## 4 · ⛔ MAJOR-3 (NEW, BLOCKING) — the "operative guard" finding is inverted at the layer that matters

### 4.1 The claim, and where it now lives

The B2 fix carries a second, volunteered finding. `143_capa.sql:289-302`:

> *"Measured live: adding a PERMISSIVE `for delete to authenticated` policy on `documents-standard`
> did **not** make a delete succeed — `storage.protect_objects_delete` … refuses unconditionally,
> BEFORE RLS row filtering is reached … ⭐ Two locks, and the documented one is not the one that
> stops this attack."*

and the assertion label it produced, `143_capa.sql:313`:

> *"the document buckets carry NO update/delete policy (**our own lock; the OPERATIVE guard is
> storage.protect_delete**, see header) and the SAME derivation provably sees their 2
> insert-reserved doors (self-control)"*

The same conclusion is now in `e2e/phase14c-rca.spec.ts` (R15's ⭐ block), **`PROGRESS.md:169-171`**
(*"fires **before RLS** and is the operative guard"*) and the **S5.R plan** (`…-plan.md:203-208`).

### 4.2 It is false on the product path — measured, twice, at that path

**Probe A — the Storage API bypasses the trigger.** `storage.protect_delete()`'s body (read from
`pg_proc`, not from a migration) checks **only** `current_setting('storage.allow_delete_query')`
— it is entirely role-agnostic. Through the HTTP API:

```
POST   /storage/v1/object/documents-standard/r2probe/…pdf   (service role)  -> 200, storage.objects rows 0 -> 1
DELETE /storage/v1/object/documents-standard/r2probe/…pdf   (service role)  -> 200 {"message":"Successfully deleted"}
                                                                               storage.objects rows 1 -> 0
```

A statement-level `BEFORE DELETE` trigger that raises for every role cannot be satisfied by a role
change. **The API therefore sets the GUC on its own connection, and the trigger never fires on the
HTTP path — for anybody.**

**Probe B — the decisive one, at R15's own layer.** One real object on `documents-standard`; the
attacker is a seeded `authenticated` user (`chefe.ccih@test.local`), never service role; the only
variable is the two RLS policies:

| step | catalog | same HTTP `DELETE` as R15 issues | object |
| --- | --- | --- | --- |
| 1 | **as shipped** | `400` · `{"statusCode":"403","error":"Unauthorized","message":"Access denied"}` | **survives** |
| 2 | **+ one PERMISSIVE `for select` and one `for delete` to `authenticated`** | **`200` · `{"message":"Successfully deleted"}`** | **destroyed** |

Nothing else changed. Both temporary policies were dropped under an `EXIT` trap; the catalog reads
back **4 policies, 0 `r2probe%`**.

**Probe C — why `tester`'s experiment could not have seen this.** Repeating it at the raw-SQL layer
in one rolled-back transaction, *with the GUC set exactly as the API sets it*:

```
GUC set, NO delete policy                    -> DELETE 0   (row survives)
GUC set, delete policy only                  -> DELETE 0   (row survives)   <- the result tester saw
GUC set, SELECT policy + DELETE policy       -> DELETE 1   (row destroyed)
```

So there are indeed **two locks — and neither is the trigger.** They are the absent **SELECT**
policy (Postgres requires the row be visible for the `DELETE`'s `WHERE`) and the absent **DELETE**
policy. `tester` opened one of the two and, finding the row alive, attributed the survival to the
trigger. It is [[a-door-can-have-two-locks]] and [[a-neutralization-is-valid-only-for-its-class]]
in one experiment: the raw-SQL path is the one path where the trigger *is* unconditional, so it was
the one path that could not measure the RLS lock.

**There is also no grant-level lock to fall back on.** `storage.objects`' ACL grants `arwdDxtm` to
`authenticated` **and to `anon`**. RLS is the entire boundary — Architecture Rule 1, exactly as
written.

### 4.3 Why this blocks

1. It is a **false assertion about a live Rule 6 control**, stated as measured, sitting in a
   **passing pgTAP assertion's label** — the precise shape the same comment warns about:
   *"a label that names the wrong mechanism survives review because reviewers rule on the label."*
   [[the-proposal-you-author-is-the-one-you-dont-test]].
2. It **demotes the only lock there is.** A reader told *"the absent policy is our own lock but not
   the one that stops this attack"* has been given a reason to add a read policy on
   `documents-standard` — a natural future request ("let members download their own documents") —
   believing a platform trigger still guards deletion. **Probe B is that change, and it destroyed
   the object.**
3. r1 blocked B1 and B2 on exactly this standard — *"a record asserting a control no code performs
   is worse than one admitting the gap"* (ADR 0120 D11) — with the build sound and no code change
   requested. Applying a weaker standard to a defect **authored during the fix** would be the
   inconsistency, not the block.
4. The plan already hedges it correctly (*"the rehearsal goes through the Storage API … so it
   plausibly never meets that guard — but* plausibly *is the word this phase keeps paying for"*),
   while `143`, R15 and `PROGRESS.md` state it flatly. **The four documents disagree with each
   other**, and the flat version is the one attached to the test.

**Required to clear MAJOR-3 (no code change, no assertion change):**

- Correct `143_capa.sql:289-302` + the label at `:313`, `e2e/phase14c-rca.spec.ts`'s ⭐ block, and
  `PROGRESS.md:169-171` to say what is measured: **on the Storage-API path the trigger is bypassed
  by the API itself; the operative locks are the absent SELECT *and* DELETE policies, and both are
  ours.** `storage.protect_delete` guards only **direct SQL DML**, which is the context migration
  `20260927000400` needs it for.
- Restore the original label's substance — it was **right**, and the "correction" made it wrong.
- Upgrade the S5.R plan note from *plausibly* to the measurement (Probe A), since S5.R's rehearsal
  runs through the API and the guard question is now settled for that path.

---

## 5 · The lead's five hand-delivered doubts, answered by measurement

1. **Is the stale-header enumeration complete?** — **No.** The `retired|was:|no longer|…` filter did
   not mask anything I could find, but the sweep still missed `200_controlled_documents.sql:392/402`
   (§3.3, MINOR-8). The doubt was correctly placed; the leak was elsewhere than suspected.
2. **Was `143_capa.sql:15` in scope, or over-reach?** — **In scope, and correctly judged.** It is
   the paired twin of `142:12` (the record's own words: *"the pair was pinned together, so it is
   retired together"*), same class, same domain. Not over-reach. ⚠ But the *other* edit in that
   commit — the `:289-313` label — is where the over-reach actually was (§4).
3. **The `1121 = 1118 + 3` reconciliation is arithmetic, not identification.** — **Now identified.**
   The two current flaky are `act-role-assumption.spec.ts:157` (batch 1) and
   `phase2-auth-shell.spec.ts:268` (batch 14). The record's own S4 list of five is
   `act-role-assumption` · `bulk-case-creation` kbd grid · `phase2-auth-shell` logout ·
   `ff3-validations` · `dm5-nsp-evidence` EVID-KBD-1. The current two are a **proper subset**, so
   the three now-clean are exactly the other three. The explanation is confirmed, not merely
   consistent. (It was also forced: with collected and skips unchanged, `passed + flaky` is
   invariant at 1123 — 1118+5 = 1121+2.)
4. **Four places for the PO ruling — is that all four?** — **Yes, verified** (§2). One comma from
   not being.
5. **The authz ARMs were not re-run at HEAD.** — **I re-ran all four.** census 546/570 · wrapper
   BLIND 41 ⊆ allowlist · hat 3 allowlisted, self-test 6/6 · floor 74 allowlisted. All `INVARIANT
   HOLDS`, exit 0, unpiped. The zero-migration-diff reasoning is **sound but was not sufficient on
   its own** — `ARM=floor` derives its call floor from the *source tree*, not only the catalog, and
   three source files did change. They are comment-only (verified from the diff), so the inference
   would have held; it is now measured instead of inferred. ⚠ And per r1's INFO-3 the arms remain
   **zero coverage of this diff** — the census policy domain is `nspname = 'public'`, so the four
   dropped `storage.objects` policies were never in it. *"Four arms HOLD"* is true and says nothing
   about S4.

---

## 6 · MINOR / INFO

**MINOR-8 (new)** — `200_controlled_documents.sql:392, 402`: a present-tense Rule 6 label on the
retired `controlled-documents` bucket; the sweep that claimed the eight-bucket domain missed it. §3.3.

**MINOR-9 (new)** — `PROGRESS.md:337-344` (in-phase block) carries only the superseded *"leave
them"* ruling while `:655` carries the current one. §2.

**MINOR-4 (carried, PARTIAL — do not report as closed).** Discharged: `docs/deployment/pdf-renderer.md`
(the runbook, the highest-consequence instance) ✅ · `authz-capability-inventory.md` ✅ ·
`scripts/storage-manifest.mjs` + `scripts/document-reconciliation.mjs` — both took the
`backend-state.md` dead-noun stamp ✅, and the reasoning for keeping `RETIREMENT_BUCKETS` populated
(*"so a resurrected bucket is still enumerated rather than silently skipped"*) is right. **Still
open:** `supabase/seed.sql:2214-2216` (*"a SQL seed CANNOT put real object BYTES into the
controlled-documents bucket"*, present tense) and
`supabase/tests/235_authz_a4…:150` (*"on the legacy `case-documents` bucket (**still live until
DM4** …)"*, and DM4 has run).

**MINOR-6 (carried) — ✅ closed.** `src/lib/attachments/constants.ts:68-89` now names all three
bucket-naming functions **and embeds the `pg_proc` query that derives them** — an executable claim
instead of a recalled one. That is the right repair, not a reworded one.

**MINOR-1 (carried) — ✅ closed** in `dm5-wave-d-retirement.md:213` and `follow-ups.md:85`.
⚠ Residual: `dm5-handoff.md:595-598` still tells the old causal story (*"passed a standalone reset
… then the E2E gate's reset emitted"*). The handoff is the resume document, so it is the one a new
session reads first.

**INFO-5 — the volume is at 245 files / 4.39 MB, not 166 / 2.97 MB** (§2), with **68 PHI-tier
orphans in `documents-phi`** against 0 `storage.objects` rows. Ruling unaffected; the number is not.

**INFO-6 — "0 infra" and "2 INFRA re-runs" are both true and only one is in the headline.** The
gate summary reads `0 infra`; the next line reads `INFRA re-runs performed: 2`. Batches 6 and 11
each hit `server_dead=1` (17 and 86 connection errors) and were re-run clean on a fresh server. The
record does carry both (`dm5-wave-d-retirement.md:128`); the figure quoted to the PO should too,
because `0 infra` alone reads as *"nothing went wrong"* rather than *"nothing went wrong twice"*.

**INFO-7 — R15's discriminating half is a belt, and its independent falsifiability is unproven.**
If the DELETE succeeds, R15 reds at `not.toBe(200)` *before* the service-role GET and byte compare
run — which is what `tester` observed under the service-role swap, and what my Probe B reproduces.
For the GET/byte-compare to be the assertion that fails, a delete would have to succeed while
returning a non-2xx status. No such combination is reachable that I found. Harmless, and the belt
is cheap; just do not count it as a second independent lock (r1 INFO-1's lesson).

**INFO-8 — `anon` holds full DML grants on `storage.objects`** (`anon=arwdDxtm`). Not a defect
(it is stock Supabase, and RLS is the boundary by Rule 1), but it means every storage protection in
this codebase is exactly one permissive policy wide, which is the concrete reason MAJOR-3's label
matters.

r1's INFO-1..4 stand unchanged and are not re-litigated here.

---

## 7 · NOT TESTED / NOT COVERED

*Binding heading. An approved — or rejected — slice is not an absence of gaps.*

- ⛔ **I did not re-run `e2e:prod`, and I did not re-run `npm run test:db`.** The E2E figure is
  **verified but not re-produced**: I re-derived 1121 / 2 / 6 / 1129 by re-summing the 18
  runner-named batch logs and confirmed R15 among them, which establishes *that the reported run
  reported this*, not that a fresh run would. pgTAP is **argued**, not measured, at HEAD — the
  argument being that the two edits are comment/label-only, backed by evaluating the affected
  predicates directly against the catalog.
- ⛔ **The deploy-time byte path remains UNREHEARSED.** S5.R names an owner; the ADR's own sentence
  applies — *"naming an owner is not a rehearsal."* Nothing about it changed at r2.
- ⛔ **The mechanism that destroyed the 221 files is still undetermined**, and this round produced
  no new evidence on it. The one datum I added is negative in the useful direction: the volume
  survived 18 `db reset`s during the gate run, and no `stop`/`start` occurred in that run.
- ⚠ **MAJOR-3's probes bound the HTTP path and the SQL path on the LOCAL stack only.** I did not
  test whether Supabase Cloud's storage service behaves identically (it is the same service, but
  this phase has been burned once by reasoning local→remote by *"same mechanism class"* — D17).
  The correction I require should state its domain.
- ⚠ **My Probe B mutated the live local catalog** (two policies, ~2 s, dropped under an `EXIT`
  trap, catalog re-verified to 4 / 0). It was **not** transactional across the HTTP call — it could
  not be — so I state the exposure rather than claiming a rollback proof I do not have.
- **The four surviving `storage.objects` policies were read, not neutralized as authz gates**, and
  `app.storage_upload_reserved` was not opened. Unchanged from r1.
- **Nothing remote was touched, verified, or inferred about.** No `db push`, no remote read.
- **I did not audit S5/S6 scope**, the `documents_wave_d` flag surface, or anything outside the
  r1-blocker diff plus the sweep that bounds it.
- **I did not re-verify r1's §4 neutralization battery** (N1–N7) or the migration guard. They were
  proven at r1 and nothing in the diff since touches SQL.

---

## 8 · Itemized change list

**Blocking — must be cleared before §6 step 4:**

| # | severity | item | requirement violated |
| --- | --- | --- | --- |
| **B3** | MAJOR | The *"`storage.protect_delete` is the OPERATIVE guard"* finding is **inverted on the product path** and now sits in a passing pgTAP assertion's label (`143_capa.sql:313`, header `:289-302`), `e2e/phase14c-rca.spec.ts`'s R15 block, `PROGRESS.md:169-171` and the S5.R plan. Measured: the Storage API sets the bypass GUC (service-role API DELETE → `200`, row gone), and with the two RLS locks opened the *same authenticated HTTP DELETE* R15 issues returned `200 Successfully deleted`. The label **demotes the only lock there is**. Correct all four, restore the original label's substance, and state the domain (local stack; SQL-DML vs API path). | Architecture Rule 1 (RLS is the boundary — a record that says otherwise is worse than none); ADR 0120 D11 (*"a record asserting a control no code performs is worse than one admitting the gap"*); CLAUDE.md §8 / [[a-comment-is-an-assertion-that-goes-stale-silently]]; the comment's own stated lesson |

**Non-blocking — fix in the same pass or file follow-ups:**

| # | severity | item |
| --- | --- | --- |
| MINOR-8 | MINOR | `200_controlled_documents.sql:392, 402` — present-tense Rule 6 label on the retired `controlled-documents` bucket; the eight-bucket sweep's boundary. |
| MINOR-9 | MINOR | `PROGRESS.md:337-344` carries only the superseded *"leave them"* ruling; `:655` carries the current one. Fifth currency defect this phase. |
| MINOR-4 | MINOR | **Partial** — `seed.sql:2214-2216` and `235_authz_a4…:150` still assert retired buckets as live. Do not report MINOR-4 as closed. |
| MINOR-1 | MINOR | **Residual** — `dm5-handoff.md:595-598` still carries the pre-correction `25P01` causal story, in the document a new session reads first. |
| INFO-5..8 | INFO | See §6. |

**Discharged at r2:** B1 (all four requirements) · B2 (all three named locations, `143:15`, and R15
itself — re-pointed, executed, and load-bearing) · MINOR-1 (record) · MINOR-3 · MINOR-5 · MINOR-6 ·
MINOR-7 · four ARMs re-measured at HEAD.

---

## 9 · What is unambiguously right, and should not be lost in the verdict

- **B1's repair is the best record work in this phase.** It names the lead's own hand as the cause,
  refuses the step-level mechanism, re-puts the question **after** re-measuring, and extracts the
  generalisable lesson (*"a decision brief needs a measurement taken at decision time"*). It also
  found the better question — that the survivors are `db reset` residue, not retirement residue —
  which the original framing would have hidden. That is what B1 was for.
- **The lead caught his own B2 miss** (`142:12` still open after `140ffd8c`) by re-deriving the list
  from the property instead of walking my line numbers. That is exactly the discipline I calibrated
  for, and it worked — MINOR-8 is a boundary on a sweep that ran, not a sweep that did not.
- **The new R15 is a genuinely better test**, not a better-worded one: real bytes through the real
  corridor, the object's survival as the discriminating fact, status codes explicitly demoted, and
  proven able to fail. It replaced a green assertion that could not fail with one that can.
- **Handing me five self-doubts, three of which were real** (1, 3, 5 all had substance) is what made
  this round cheap. Two of them I closed by measurement in minutes; the third found MINOR-8.
- **The build is still sound.** Nothing at r2 touched the migration, the guard, the successor
  assertions or the catalog. MAJOR-3 is a false sentence about a true control — the control itself
  is exactly where S4 put it, and I re-proved it holds (Probe B step 1).
