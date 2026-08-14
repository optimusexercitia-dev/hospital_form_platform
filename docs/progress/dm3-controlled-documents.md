# DM3 — Wave B: controlled documents (phase record)

**Rotated out of PROGRESS.md at the DM3 Record step, 2026-08-14** (CLAUDE.md §7 /
lead-playbook §5). PROGRESS.md keeps a one-line pointer; this file holds the full
narrative. Append-only — never loaded by a teammate spawn.

Phase: **✅ COMPLETE**, PO-approved 2026-08-14. Branch `docs/dm1-plan-amendments`
(⛔ not `main`, nothing pushed, no `db push`). Plan:
[dm3-controlled-documents-plan.md](../plans/dm3-controlled-documents-plan.md) · Review:
[dm3-controlled-documents-review.md](../reviews/dm3-controlled-documents-review.md) ·
ADR [0114](../decisions/0114-document-model-redesign.md) **Amendment 2 (D17)**.

---

### 🟢 IN PROGRESS — **DM3: Wave B — controlled documents** (opened 2026-08-13)

Plan: **[dm3-controlled-documents-plan.md](docs/plans/dm3-controlled-documents-plan.md)**
(`dc6ae9b`) — **APPROVED by the lead 2026-08-13** with two binding conditions (R1, R2).
Window `20260925000100`–`000800` (8 migrations); new pgTAP suite **`330`**, plus a
**K8c-only** edit to `328`. Census: 375 registered == 375 files.

| Slice | Owner | Status |
| --- | --- | --- |
| S1 — M1–M7 migrations + suite `330` | backend | ✅ applied — `330` **44/44**, `328` **128/128**; **M8 dropped with evidence** (its premise was false: no projection door ever projected `storage_path`) |
| S1b — backend side of the §7 contract (TS) | backend | ✅ landed (`d75883b`) — 3 lead-approved §7 corrections; `typecheck` 14 = **10 frontend** (the contract boundary, by design) + **4 backend** (composite verbs, held for frontend's signal) |
| S1c — keystones `DM3·B4` + `DM3·X3` | backend | ✅ green (`47e37ed`) — neither could be red-first (both pin existing behaviour), so **both twins were RUN**: twin 1 reds `X3a`+`B4` (2/50), twin 2 reds `X3b` **alone** (1/50) |
| S1d — composite deletion + §7 process note | backend | ✅ landed (`9167497`) — **typecheck 0**, lint 5/5, `330` **50/50**, `328` **128/128** |
| S2 — frontend: upload + download cutover, field swap, charter gate, dead-component removal | frontend | ✅ landed (`ef62e1b` + `de21b87`) — all 3 wizard modes orchestrate client-side; lint 5/5, vitest **1258/1258**. ⚠ **`createDraftOnly` SURVIVES** (minus its `if (hasFile)` block) — it is the wizard's step 1 and the only verb returning `{documentId, versionId}`; **3 verbs die, not 4** |
| S1e — P0 remediation: M8/M9/M10 + `DM3·R3` twins + repo-wide removal sweep | backend | ✅ landed (`5a7c684`) — pgTAP **190f/6150 PASS** |
| S1f — register the 4 new DEFINER doors (census domain + findings file) | backend | 🟢 in progress — **lead runs the arms**, not the registrar (an arm run by the hand that registered the door is not independent) |
| S3 — tester: the BYTE ROUND TRIP + lifecycle + prior-version E2E | tester | ✅ **GREEN** (`0c10b9b`+`ce85b4c`, ancestors verified) — **47 collected / 47 ran / 47 passed / 0 skipped** on a fresh reset; **NO bug filed, no application defect found** (all 9 baseline reds tester-owned: 7 stale locators + 2 worker interference) |
| S3b — full `e2e:prod` gate (lead-run) | lead | ✅ **GATE GREEN** — 1102 passed · 0 failed · 0 infra · 2 flaky · **0 did-not-run** · 18 batches; **accounting closes exactly**: 1102+0+2 = 1104 accounted, +6 skipped = **1110 = collected**, every batch `accounted N/N` |
| S4 — QA review r1 | qa | ⛔ **CHANGES REQUESTED** — 0 P0 · **1 MAJOR (blocking)** · 4 MINOR · 5 INFO. [review](docs/reviews/dm3-controlled-documents-review.md) |
| S4b — MAJOR-1 remediation (M11) | backend | ✅ landed (`5b35003`) — assert moved to `begin_document_upload`, **home-type-scoped**; `DM3·T3` **red-first** ("caught: no exception"), twin reds `T3` **and only** `T3`; `T3b` control keeps Wave A alive |
| S4c — re-gate (lead) | lead | ✅ **step-1 half GREEN** — fresh reset 0 · pgTAP **190f/6152 PASS** (0 `not ok`, 0 bad plans) · `ARM=census`/`hat`/`FROMFINDINGS=1 wrapper`/`floor` **all INVARIANT HOLDS** (census 569 verdicts, wrapper BLIND 41 all allowlisted) · tsc 0 · lint 5/5. ✅ `e2e:prod` **GATE GREEN** (1101 passed · 0 failed · 0 infra · 3 flaky · **0 did-not-run** · 18 batches; accounting closes exactly: 1101+0+3 = 1104, +6 skipped = **1110 = collected**, every batch `accounted N/N`). The 3 flaky are all **outside the DM3 diff** — `act-role-assumption:157`, `phase2-auth-shell:268`, `bulk-case-creation:756`/`form-builder-enhancements:622`; ⚠ **the first two also flaked in run 1**, i.e. repeat offenders across two independent runs → **FUP-E2E-REPEAT-FLAKY**. ⚠ **My sweep-scope reasoning was UPHELD but its WARRANT was wrong** (QA r2): *"M11 creates no gate and no policy"* is a claim about **migration file text**, which is **stale by design** here — the exact class that produced this project's confident false P0. The sound warrant is that the **live census domain is unchanged**, which is what `ARM=census` exists to detect: post-M11 **548 live / 569 accounted, HOLDS**, `public` policies **275** — both identical to the pre-M11 figures, and `can_read_document`'s controlled arm byte-identical to the r1 audit. *Right decision, wrong evidence; the catalog now carries it.* **Diff-scoped sweep NOT re-run — reasoned:** the case list re-derived over `4c6f7d9..HEAD` incl. M11 is **unchanged** (M11 creates no `is_/can_/has_` gate and no policy) and neither swept gate was touched, so a re-run would re-test an unchanged substrate |
| S4 — QA review | qa | ⬜ not started |
| S5 — gate + approval | lead | ⬜ not started |

**Rulings made at plan approval** (detail: ADR 0114 Amdt 2, corrected `57da0ce`):
- **Ethics letters home on the `case` securable resource, never `controlled_document`** —
  three catalog facts each force it alone. Lead-ruled, not sent to the PO, because it
  follows necessarily from the ratified Amendment-2 text and the alternative is
  affirmatively unsafe (it silently deletes the D15 ceiling via `HC0D6`).
- Backfill fileless core versions **1:1**; the domain-side pointer is **outside D10**
  (which governs the core *file binding*) — **conditional on R2**; **both**
  `controlled_documents_obj_*` policies dropped (the INSERT one bypasses
  `begin_document_upload` entirely); production **not** re-measured during DM3, with
  re-measurement a **precondition of DM5's manifest and any `db push`**; charter screen
  gates on `charters && controlled_docs`.

**Lead's two binding conditions on the plan:**
- **R1** — `330` reuses the labels **K8a/K8b/K8c**, which already mean *referral / RCA /
  ethics seam* in `328` and which **DM4 and Wave D still cite by name**. Renumber `330`'s
  trio. (The plan diagnoses this exact class one section later.)
- **R2** — Q3's approval is conditional on a keystone pinning that the domain pointer
  **cannot move once the version leaves draft**, proven able to fail. Unpinned, "mutable
  while draft" is an intention, and the failure mode is swapping the file under an
  already-approved document — the class D10 exists to prevent, re-entering through the
  door just ruled open.

⚠ **Corrections the census forced in binding text the LEAD authored** — both verified
independently before amending: (1) "remove keystone K8" named **three** sub-keystones and
would have deleted DM4's and Wave D's parked-seam pins; (2) conditions 2 and 5 need
**opposite** treatments — `issue_ethics_notification` keeps its 8-arg identity
(`CREATE OR REPLACE`, ACL preserved) while `set_ethics_decision_details` has 11 args with
**10 `DEFAULT NULL`**, so `CREATE OR REPLACE` mints an **overload** and the live 11-arg
call becomes ambiguous (`42725`) — it needs `DROP`+`CREATE`+**re-GRANT**.
⚠ **A lead over-claim was corrected by backend and the correction adopted:** "exactly one
audit row per download" is wrong — the D11 floor does not log a creator's own
standard-tier open. Contract: non-creator → 1, creator → **0 deliberately**, denial → 0.

**Build findings so far (S1):**
- **Two real holes caught red-first, both "caught: no exception"** — `reclassify_document(<controlled doc>, 'phi')` genuinely **succeeded** (`DM3·T1`), and a direct `INSERT` linking *another case's* document into `ethics_notifications` genuinely **succeeded** (`DM3·E2`). T1 is the direct payoff of the M2/M6 split: merged, that keystone would have been **born green**.
- **M4 absorbed two routines a column drop would have broken at RUNTIME, silently** — `submit_document_for_approval`'s has-a-file precondition and `decide_document_approval_core`'s **e-signature hash basis**. A column drop does not fail a function that references it. The hash stays bound to an immutable storage path rather than `file_objects.sha256`: changing the basis of an existing e-signature is a **semantic change to a signing artifact**, not a refactor → **FUP-DM3-SIGBASIS**.
- **Three vacuity/false-positive finds in the backend's OWN work**, all the same shape — *a check that passes for a reason unrelated to the property*: `proacl::text like '%=X/postgres,%'` matches **every** ordinary grant (failed closed here; the identical shape fails **open** just as easily) · `prosrc like '%in_controlled_docs_rpc%'` returns **true because the comment saying it deliberately does NOT read the GUC contains the string** · a clearance-destroying probe ordered before `DM3·E5`, so E5 failed for the **fixture's** reason, not the product's.
- **M3 failed first run on `HC089`** — a migration runs *outside* the RPC corridor, so the sibling guard was armed against the backfill. The bypass the backfill must use is the one the new freeze trigger **deliberately refuses to inherit**; that reads like an inconsistency and is the whole design. A future "harmonizing" edit would silently reopen D10.
- ⚠ `seed.sql`'s `documents_wave_b` line and `328` K9b/K9c are **one artifact**. K8a/K8b **survive** for DM4/Wave D with their reasoning left in place. `app.can_write_document` diverges between session claims and a literal uid (act-as, ADR 0106/0107) — a manual psql probe is **not** representative of `test_helpers.claims_for`.
- ⚠ The M7 trigger fix was hand-applied to local, then re-applied byte-exact from the migration file. **A fresh `supabase db reset` at gate step 1 is still required** to prove the chain end-to-end — it is also where `193`/`194` get measured for FUP-PGTAP-SAVEPOINT.

### ⛔→✅ QA MAJOR-1 — the flag gated the LAST STEP of the corridor, not the corridor

**The untested arm held the defect.** `documents_wave_b` was checked by exactly **one** function
(`attach_controlled_document_version_file`), and `documentsWaveBEnabled()` — added by DM3 — had
**zero callers** in `src/`. QA's live probe with the flag OFF (rolled-back txn, as `chefe.ccih`):
`create_controlled_document` **ACCEPTED** · `begin_document_upload` **ACCEPTED** · `attach_…`
**REFUSED HC0D7**. So a coordinator still created the document, reserved a path, **PUT real bytes
into `documents-standard`**, and finalized — leaving **orphaned bytes + an orphaned core version
+ a draft whose file never appears**. Lead- and backend-confirmed from the catalog independently
before the fix.

**Not an authz hole** (QA verified authority unchanged: outside approver reads but cannot write,
`42501` at the door; plain member and outside approver both `P0002` at `begin`). A **flag-contract**
defect — and the tree **asserted the opposite in two places**, `seed.sql` and
`src/lib/documents/actions.ts:87` (*"which every DM3 door calls (HC0D7)"*).

⚠ **The sharpest stale-comment instance of the phase, and the author named why:** *"I wrote
'every DM3 door calls it' while having added the assert to exactly one door, in the same phase.
**The claim was general where my knowledge was specific.**"* Both comments now name the two
asserting doors **and** record that "every door" is not the target state either — the gate is
deliberately scoped so Wave A keeps working. *A claim kept narrow enough to stay true is the
correction; a more emphatic claim is not.*

**Fix (M11) — placed by argument, not by convenience.** The assert went to
**`begin_document_upload`**, because reserving the path is **the first step that produces
residue**: before it nothing exists; after it a file object, an upload session and a signed PUT
credential all do. Gating `finalize` is too late (bytes have landed); gating only `create` leaves
the corridor open to anyone holding a document id. **Scoped to the home type, not blanket** —
`begin_document_upload` serves every home, so a top-of-door assert would satisfy the new keystone
while **silently killing Wave A**; `DM3·T3b` is the control that catches exactly that. `DM3·T3`
authored **red-first** ("caught: no exception"); its twin reds `T3` **and only** `T3`.

⚠ **Stated choice, not an assumption** (backend raised it; lead ruling): the `documents_wave_b`-OFF
arm is covered by **pgTAP `DM3·T3`/`T3b` only**, not by E2E — exercising it in E2E means flipping a
shared-stack flag mid-run, which would race every other spec. **This is the second finding that
gap has produced**, so it is recorded as a decision rather than left implicit.

### ✅ DIFF-SCOPED DOOR SWEEP — `BLIND: 0`; the one `ERROR` resolved by reading the runlog

Case list **derived from the migration diff, never by hand** (ADR 0079 Amdt 1 recipe over
`4c6f7d9..HEAD`): exactly two gates, `can_read_document` and `can_write_document`; **no policies
created** by the diff. Baseline green before mutating (`Files=190 Tests=6150 PASS`).

| gate | verdict |
| --- | --- |
| `app.can_read_document` | **COVERED** — noticed by 9 suites (`144`,`171`,`228`,`229`,`311`,`314`,`328`,`329`,`330`) |
| `app.can_write_document` | `ERROR run-shape!=baseline (Files=190 Tests=6109)` → **substantively COVERED** |

⚠ **`ERROR` is not a pass (§6), so it was resolved rather than recorded.** Reading the runlog —
per *[`ERROR|run-shape!=baseline` ≠ unswept — read the runlog]* — neutralizing
`can_write_document` produced **14 failures across 5 suites**: `229` (48, 62, 67–68), `231`
(57, 77), `314` (47), `328` (52–53), `329` (13–14, 59, 61, 72). **The suite noticed loudly.** The
`ERROR` is a *harness classification* artifact: `329` **aborted** (`exit 3`, `Bad plan: planned
115 but ran 74`), so the run shape differed from baseline and the harness could not compare
like-for-like. Blindness was never in question — `BLIND: 0`.

⚠ **New follow-up — `FUP-329-ABORT-SHAPE`:** `329` carries a keystone whose failure **ends the
file**, dropping **41** subsequent assertions. It cost nothing here (the gate was still seen), but
it is what makes a mutation run over these gates **unclassifiable** rather than COVERED, and it
will do so on every future sweep. Same class as the B4 lesson the backend fixed in `330` — *a
keystone whose red takes the rest of the suite with it is one you cannot read* — one suite over,
and now with a measured cost.

⚠ **The documented sweep hazard recurred and was handled:** the subset run **overwrote the
committed findings md, truncating it 594 → 38 lines**. Restored via `git checkout --` per
lead-playbook §4; tree verified clean afterwards. Every phase that skips that restore silently
destroys the audit record and makes the next full sweep read as a mass regression.

### ⭐ THE BYTE ROUND TRIP IS PROVEN — the one thing DM3 had never established

`DM3B-1` drives the **real browser corridor** and asserts **byte equality**, not "a file
downloads": an object exists at the reserved coordinate with `storage.objects` metadata size ==
the uploaded length → `finalize` **derived** `size_bytes`/`mime_type`/`sha256` from what landed
(`unscanned_accepted`, `standard` tier, `documents-standard`) → the door signs it back →
**`Buffer.compare(returned, uploaded) === 0`** plus sha256 and a unique marker.

**Derivation is proven, not assumed:** `DM3B-2` **declares a lie at `begin`** (1 byte,
`text/plain`), PUTs a real PDF, and requires the truth to win. Everything before this slice was a
DB-layer proof or an **absence** proof; this is the first evidence the replacement corridor
*works* rather than that the old one is gone.

**Where the tester refused a green** (the standard this phase has held throughout):
- ⚠ **`DM3B-8` first passed for the WRONG reason** — a `created_by` NOT NULL fired **before** the
  UNIQUE ever ran. The insert now copies every other column from the incumbent row, so the
  duplicated coordinate is the only thing wrong with it, and it names
  `file_objects_bucket_path_uniq`. (*wanted X, caught `<code>` ⇒ chase the fixture.*)
- **`DM3B-4` takes a BEFORE-SHOT**: the same non-member is refused `P0002` **before** being named
  approver and served **after** — which makes the arm the *cause* rather than a coincidence. Its
  negative twin (approver on a *different* document) pins exact SQLSTATE + message and asserts
  no leakage; her own document refuses with a **different** code (`HC0D8`), proving the first
  denial was authorization and not a generic no.
- **AC-7 re-pointed but labelled in-file as green BY CONSTRUCTION**; the falsifiable version is
  `DM3B-8`. **AC-11 kept but NOT credited** — its `storage_path` clause is now vacuous on the new
  door.

**Two observations, neither a DM3 regression:** `open_document_version` refusals surface as
**HTTP 500, not 404** (measured `{"code":"P0002"}` / `HTTP_STATUS=500`) — pre-existing DM2
transport behaviour, so the spec pins code+message and only `status >= 400`, since encoding 500
would make a PostgREST detail into a DM3 contract. And **AC-13's keyboard assertion is a
positional Tab count coupled to REGISTER ROW COUNT** — red at 56 accumulated documents against a
60-press budget; raised to 240, but **a green AC-13 is meaningful only on a fresh reset** and will
drift again the moment the seed gains a document.

**Gaps the tester stated rather than reported around:** the **`documents_wave_b`-OFF arm** of the
charter affordance (Q6) was not exercised (flipping a shared-stack flag mid-run would have raced
the other specs) · the 47 are a **scoped quick loop, not the gate** (`e2e:prod` is lead-run) ·
the new spec adds **~14 documents per run** to commission A, feeding the AC-13 accumulation.

### ✅ AUTHZ ARMS — all four HOLD (lead-run 2026-08-13, registration by backend: the split was deliberate)

`ARM=census` **HOLDS** (569 gates carry a verdict; no unswept newcomer) · `ARM=hat` **HOLDS**
(3 findings, all reasoned-allowlisted) · `FROMFINDINGS=1 ARM=wrapper` **HOLDS** (BLIND 41, all
allowlisted) · `ARM=floor` **HOLDS** (every never-called door on the floor allowlist).

⛔ **READ THE SCOPE BEFORE CITING THESE.** A green census is **SILENT** on DM3's principal new
door, not supportive. Lead-verified from the catalog:
`attach_controlled_document_version_file` is **`prosecdef=t`, NOT `proretset`, returns the
composite `controlled_document_versions`, lives in `public`, and carries EXECUTE to
`authenticated`** — PostgREST-reachable, and **in no BLINDNESS-DETECTING arm's domain**.
⚠ **Corrected by QA (MINOR-1), verified by the lead:** *"in no arm's domain"* is **measurably
false** — `ARM=floor`'s domain is every `public` `prosecdef` function EXECUTE-able by
`authenticated`, **411 signatures**, and it contains **both** this door and
`open_document_version`. But ARM 2 asks only *"is the door called?"*, never *"does anything
notice when it is opened?"* — so **the conclusion below stands and only the reason was wrong.**
The same imprecision is inherited from DM2 (ADR 0118 §12) and appears in `backend-state.md` and
the DM3 plan; corrected there too. Its own
`app.is_staff_admin_of` check **is** the entire boundary. It is pinned **behaviourally**
(`330 DM3·P1/P1b/P1c`, `314 §10.3`) — **by keystones, not by any arm.**

### 🔴 THE CENSUS DOMAIN'S THIRD MEASURED EDGE — **146 DEFINER doors no arm can see** (PO decision)

Lead-verified count: **146** functions that are `prosecdef`, composite-returning, non-`proretset`,
and EXECUTE-able by `authenticated`. The census domain is **273 signatures and DM3 contributes 0**
— the domain's clauses are bounded by **return type** (`bool`, or `proretset` + auth-EXECUTE, or
`public` INVOKER plpgsql), so a composite-returning DEFINER is outside all of them. **Not a DM3
regression — the class predates it (ADR 0118 §12) — but DM3 added one to it**, inherited from
`set_document_version_file`, which was in the same class.

⚠ **This is the THIRD measured edge on that file**, after the INVOKER-wrapper class and the
row-returning doors BUG-AUTHZ-002 exposed — **and each previous edge was found by a live leak
rather than by counting.** That is the argument for scheduling the widening: this one was found by
counting, which is the cheap way to find it. **PO decision, not a phase decision** — widening the
domain admits ~146 previously-unswept doors to the LIVE set at once, none carrying a verdict, so
`ARM=census` would red on ~145 pre-existing doors immediately. A backlog to schedule, not a gate to
trip mid-phase.

⚠ **A fourth `enumeration-bounded-by-location` instance, same phase:** `ARM=wrapper`'s INVOKER
clause is bounded by `nspname = 'public'`, so `app.assert_documents_wave_b_enabled` (INVOKER,
schema `app`, auth-EXECUTE — lead-verified) is invisible to it.

**Backend refused two shortcuts, and both refusals were right.** (1) **No findings-md row** — a
findings verdict means *a neutralization sweep ran and this is what it said*; none has, so a row
would be **a verdict nobody earned**, which is the exact fabrication the census exists to prevent
and worse than an admitted gap. (2) **No domain widening mid-phase.** All six new functions went
into `authz-unswept-backlog.txt` (*"we have never swept it, so we do not know"*) and **not** the
BLIND allowlist (*"we swept it and nothing noticed"*) — the same distinction that made the stale
allowlist entry below dangerous.
⚠ **It was SIX new functions, not the four backend first reported** — the first list came from
recall rather than the catalog, and the two missed included the INVOKER one. Same class as the
four short counts in the frontend thread, now six landings this phase.

### 🔴 A STALE ALLOWLIST ENTRY PRE-EXCUSES A FUTURE DOOR — found by the repo-wide removal sweep

`supabase/tests/mutation/authz-blind-allowlist.txt` still named **`app.can_read_document_object`**,
which **M5 dropped** along with the policy it served. **The allowlist is where a door is *excused*
from the BLIND check** — so an entry naming a dropped function **pre-excuses any future function
that reclaims the name.** A hole that opens silently, years later, for whoever picks the natural
name, and invisible in every direction: no test fails, no gate reds, the entry reads as
maintained configuration. Pruned.

⚠ **This is the payoff for widening the sweep, and it settles that argument empirically.** The
lead predicted only the mutation-script chore; **neither lead nor backend listed the allowlist**.
A removal-set sweep bounded by `src/**` — the boundary actually used earlier in the phase — would
have missed **the only finding that had teeth**. Fifth landing of *an enumeration bounded by a
location cannot enforce a property*, and the first where the miss was dangerous rather than
untidy.

**`DM3·R3` is now falsifiable — and twin B's construction is itself a finding.** Twin A (kill the
door's core-document minting) reds `R3c`+`X1`, 2/55. Twin B had to neutralize registry minting on
**both** sides — the M9 trigger *and* the M8 door's belt-and-braces insert — because **with either
alone neutralized `R3` stays green**: two sufficient mechanisms, only both-off reproduces the P0.
Third appearance of *two barriers, one behaviour* this phase; a single twin would have certified a
keystone that cannot fail. Twin B's own first draft **failed its own `if mutated = src then raise`
guard** on whitespace drift — the guard earning its keep on the twin that needed it. `R3e` added as
`R3d`'s positive control (*"one row with a null pointer" is otherwise satisfiable by counting
nothing*).

### ✅ GATE STEP 1 — **GREEN**, lead-verified independently (2026-08-13)

Re-ran `supabase db reset --local` + the full pgTAP suite myself rather than accepting the
report: **`RESET_EXIT=0` · `PGTAP_EXIT=0` · `Files=190, Tests=6149` · 0 `not ok` · 0 bad plans ·
`All tests successful` · `Result: PASS`.** Backend's figures reproduce exactly.
This run is also the **FUP-PGTAP-SAVEPOINT measurement** — `193` **ok**, `194` **ok** — which
**refuted** the lead's own 🔴 filing (see the Follow-ups index).

Still outstanding for the phase gate: the four authz arms + the diff-scoped door sweep, then
tester (step 2) and QA (step 3).

### 🔴 P0-DM3-1 — the CREATE door never satisfied M1's own FK. **The seed failure was the symptom, not the defect**

**Found by the mandatory fresh-reset gate step**, and it is the strongest argument for that step
the program has produced. M1 added
`controlled_documents_securable_resource_fk (id, securable_type) → securable_resources(id, resource_type)`
**and backfilled the existing rows — but never taught the CREATE path to satisfy it.** So **since
M1, every attempt to create a controlled document has raised 23503** — *the product's create
wizard*, not merely `seed.sql`. Fixed by **M8**
(`20260925000800_dm3_create_door_mints_registry.sql`): the create door now mints the registry row.

⚠ **The lead's own RED diagnosis was one level too shallow** — recorded because the shallow
version reads as complete. "Three raw insert sites in `seed.sql` lack registry rows" is *true*
and would have produced a *fix that works*: patch the seed, reset goes green, gate passes, and
**the create wizard stays broken in production**. The seed was simply the first caller to run
after the FK existed. **When a fixture violates a new constraint, ask what else writes that
table before patching the fixture** — a fixture is a caller, and callers come in families.

### ⚠ LEAD ERROR — `git add -A` swept backend's in-progress work into three docs commits

`94fc3f0`, `f7265bd` and `0b6706d` carry `docs(dm3):` subjects but **also contain backend's live
work**: the new **M8 migration** (119 lines), the `seed.sql` rewrite (~170 lines across the
three), and `330` edits (90 lines). Nothing is lost or broken — the work is committed and the
tip is correct — but **three commit messages materially misdescribe their contents**.

⛔ **History is NOT rewritten** (other sessions live on this branch; standing rule). This entry
is the correction of record.

**This is the same class the lead had just written up twice** — *a commit's own output is not a
safe report of what it committed* — and the same standing rule the lead had just issued to
frontend after the 613-file incident: **stage explicitly; never `git add -A`**. Issuing a rule
is not applying it. Cf. [the proposal you author is the one you don't test] — the rule you write
for others is the one you exempt yourself from. **Lead practice changed: explicit path staging
only.**

### ⛔ GATE STEP 1 — **RED**. `supabase db reset` FAILS (2026-08-13, lead-run)

```
RESET_EXIT=1 · Seeding data from supabase/seed.sql...
ERROR: insert or update on table "controlled_documents" violates foreign key
constraint "controlled_documents_securable_resource_fk" (SQLSTATE 23503)
```
**Fails at SEEDING, not migration** — all 7 DM3 migrations applied cleanly. Three raw insert
sites in `seed.sql` (**`:2582`, `:2612`, `:2864`**) create controlled documents with **no
`securable_resources` row**, against
`FK (id, securable_type) REFERENCES securable_resources(id, resource_type)`.

⚠ **Why nothing caught it: M3's BACKFILL MASKED IT.** Migrations were applied incrementally to
a DB that *already held* the seeded rows, so the backfill minted their registry rows. A fresh
reset inverts that — migrations hit an **empty** DB (backfill finds nothing), then `seed.sql`
inserts **new** documents that must satisfy the FK unaided. **The backfill and the seed can
each be correct while the pair is broken.** The recorded rule, earned again: *the migration
chain and `seed.sql` are ONE artifact* — and `seed.sql` is a contract with ~900 tests.
Returned to backend with the instruction **not to stop at the constraint that fired** — the FK
is the first invariant to reject the row, not necessarily the only one DM3 added.

⚠ **The pgTAP numbers from that run are VOID** — the suite ran against a half-seeded DB, so its
fifteen `planned N but ran 0` lines are **artifacts of the failed seed** and are **NOT**
evidence for FUP-PGTAP-SAVEPOINT. That measurement remains outstanding.

**Two gate lessons from the composite deletion (`9167497`):**
- ⚠ **`typecheck` hit 0 with three dead symbols still present** — `uploadDocumentFile`,
  `MAX_DOCUMENT_BYTES` and the MIME→extension map, all mirroring the retired bucket. **eslint
  caught them, typecheck did not.** "0 typecheck errors" is not a safe stopping point for a
  deletion; the five-gate `npm run lint` is what closes it.
- ⚠ **The deletion set was verified from the CODE, not from the lead's message — and the
  message was wrong.** Enumerating every caller of all 16 exported verbs showed the three
  doomed verbs had **6 references, all comments, zero call sites**, while `createDraftOnly`
  had a real import. It also showed *why* "four" was wrong: `supersedeDocument` **and**
  `supersedeAndSubmitDocument` both exist and frontend calls the former — **two names
  collapsed into one is how a live verb gets deleted.**

**S2 findings (frontend, `ef62e1b` · `de21b87` · `7cbe6b7`):**
- ⚠ **A real defect caught only by a RUNTIME check — no gate would have seen it.** Moving the
  wizard chain client-side made step *ordering* frontend's responsibility, and the size/MIME
  validation ended up **inside `attachFile`** — i.e. **after** create/supersede had already
  run. The retired server action validated **up front** precisely to avoid orphan drafts, so
  an oversized file would have left a created document plus an empty draft. Fixed in
  `7cbe6b7`. *A responsibility that moves layers does not announce that it moved.*
- ⚠ **A label reversed on evidence — and the first reasoning was wrong for a subtle reason.**
  Frontend had declined to reword Wave A's `pending`, arguing one state should not carry two
  names across waves; backend agreed. The screens then showed both seeded documents rendering
  `pending` with a **non-null** pointer, because **M3's backfill binds every version to a
  deliberately fileless core version** — so "Processando envio" told coordinators to wait for
  an upload that never happened. Wave A's `pending` can arise **only** from a real upload;
  Wave B's also covers backfilled versions, **a state Wave A cannot reach**. Two state *sets*
  sharing one label, not one state with two names → **"Aguardando arquivo"**.
- A page header claiming the **storage SELECT policy carried the approver arm** was rewritten —
  false since M5; that access moved to the kernel. Another instance of the class below.
- Submit affordance gates on **`availability === 'available'`** — the only state meaning the
  door will hand over bytes, read from the **shared** predicate rather than a parallel opinion,
  and pinned executably by `DM3·X3b`.
- ⚠ **Not verified: the byte round trip.** No seeded version has bytes, so every controlled
  document renders `pending`; upload/download success paths are **tester's**, with
  `documents_wave_b` on.

⚠ **STALE-COMMENT CLASS — 5th, 6th … instance this phase; the deletion alone stranded 8.**
Two were backend's (fixed): `supersedeDocument`'s doc told the frontend to upload *"via
`addDocumentVersion`"* — **a deleted verb, in the doc of a verb they actively call** — and a
section header still described the full retired chain. Six are in frontend's page/wizard
headers (list handed over, not edited across the ownership line). **The pattern is now stable
enough to name: a deletion strands every comment that referenced it, and NO gate sees any of
them.** → **FUP-LINT-STALE-SYMBOL-COMMENT**.

### ⚠ INCIDENT (2026-08-13) — `supabase/` left the index; 613 files deleted from HEAD, all recovered

**Recovered in full, lead-verified rather than accepted.** Counts of tracked files under
`supabase/`: `226bfb9`/`d75883b` **613** → **`ef62e1b` 0** → `47e37ed` 1 → `d53d083` **613** →
HEAD **613**. All 7 DM3 migrations present at HEAD; `git status` clean; and
`git diff --stat c055e41 HEAD -- supabase/` is **exactly one** changed file — `330` at
+114/−1, precisely the intended B4/X3 addition. **Nothing was lost and nothing drifted:** the
working tree was intact throughout (files showed `??`, never deleted).

⛔ **ATTRIBUTION CORRECTED — `d53d083`'s commit message is WRONG and cannot be edited.** It
says *"612 files were dropped by `47e37ed`"*. `47e37ed` is where the absence became **visible**
(it re-added 1 file, its own `330`). The commit that dropped them is **`ef62e1b`**, and its
author identified and reported it. History is deliberately **not** rewritten — other sessions
are active on this branch, and amending another session's commit is a recorded scar. This
entry is the correction of record; a reader auditing the branch from commit messages alone
would otherwise start from a false premise about the wrong teammate's work.

**Cause — now KNOWN** (it was reported as "not established", which was true of the reporter):
staging a slice, `git add -A src/components src/app` was followed by
`git rm --cached -r --ignore-unmatch supabase` intending to keep one file out of the commit.
Two things made that catastrophic:
1. ⚠ **`git rm --cached -r <dir>` does NOT "unstage" — it stages a DELETION of every tracked
   file under that directory.** `git commit` then reads the index and commits all 613.
   (The target file was already unstaged — ` M`, not `M ` — so the command was unnecessary
   as well as wrong.)
2. **Its output was piped to `/dev/null`**, discarding the 613 lines that would have said so.

⚠ **The reusable lesson: a commit's own output is not a safe report of what it committed.**
`ef62e1b`'s `--stat` read as an ordinary 3-file change while silently carrying 612 deletions.
Only `git status --short` exposed it, and only because it happened to be appended to that
command. **Standing rule: stage explicitly (`git add <paths>`), never send a `git rm` through
`/dev/null`, and check `git ls-tree -r --name-only HEAD | wc -l` after any commit that touched
the index broadly.**

**Three §7 corrections, all lead-approved** (`d75883b`) — none moved a signature frontend was
already building against:
1. ⚠ **`beginControlledVersionUpload` had to return `uploadSessionId`.** `finalize` is keyed on
   the **session**, not the version, so **§7 as approved was not merely incomplete — it was
   UNCALLABLE.** Neither the lead nor the plan review caught it; it surfaced only because
   backend tried to *use* the contract rather than just implement it. **Process note for the
   next phase's contract review: trace one full call chain through the posted signatures.**
2. `finalize` returns `AddVersionState` + `terminal?: boolean`, carrying DM2's MAJOR-3 through
   so the dialog cannot offer a retry on a spent reservation.
3. **`ControlledDocument.coreDocumentId` DROPPED** — `list_commission_documents` is a DEFINER
   rollup that does not return the column, so every list row would have carried `null`, reading
   as *"this document has no core document"* rather than *"this projection doesn't carry it."*
   Same false-for-an-unrelated-reason shape as the vacuity finds — but this one would have been
   read by a **human**, not a test.

**Availability is ONE shared predicate, not a Wave-B copy.** Backend extracted Wave A's
`documentVersionAvailability` and wrote it to match `open_document_version` branch for branch,
so `availability === 'available'` means *"the door would serve these bytes right now"* — the
value frontend gates the submit affordance on. Two copies drift **silently, because both still
typecheck**; no gate catches a UI predicate that has diverged from the door it mirrors. That is
exactly why `DM3·X3` (projection ↔ door agreement) was ordered written **now**: it is currently
asserted in a **comment**, and prose cannot fail. `DM3·B4` was ordered now for a different
reason — it pins a **DM3 exit criterion** (prior-version download), and an exit criterion
deferred behind another teammate's landing is one that can be lost.

⚠ **Stale-comment class: the instance count was 2, not 1.** Frontend flagged
`SupersedeDocumentButton` in `src/lib/responses/actions.ts`; backend found
`queries/controlled-documents.ts`'s header still advertising *"Storage reads are signed-URL
only, minted server-side (`createSignedDownloadUrl`)"* — **describing the exact byte path M5
deleted**. A found-instance list from whoever tripped over it is a starting point, never the
population (cf. `328`'s eleven collisions vs three; `193` alongside `194`).

**Lead ruling — the create-wizard's terminal step (frontend escalation, Q-A/B/C).** Plan §7
posted a contract for **one** upload path, but M4 kills **five** `p_storage_path` call sites;
the other four are the wizard's composites. They cannot survive: `begin` needs
`{commissionId, documentId, versionId}`, so **"create + upload + submit" is not expressible
atomically on the DM2 substrate**, whichever layer orchestrates it. Ruled: the wizard moves to
a **client-orchestrated chain**; backend adds `versionId?` to `CreateDocumentState` (verified
first — `create_controlled_document` returns the whole row, `controlled_documents` carries
`current_version_id`, and `actions.ts:609-610` already reads and **discards** it); the three
composite verbs are then **deleted**. Rejected: keeping them alive on an `uploadSessionId`
param — still not atomic, so it preserves four byte-adjacent verbs that only *look* like a
transaction and that DM5's exit sweep would have to reason about.
⚠ **Named so it is not later discovered as a regression:** partial failure is *already* a
designed, recoverable state (server returns `documentId` + banner), so client orchestration
does **not** introduce it. What widens is the **abandonment** surface — closing the tab between
`begin` and `finalize` leaves a created draft + an unfinalized upload session. That is the DM2
`failed`/`abandoned` state: **new to this surface, not to the platform, already reconciled.**
Tester covers it; QA should not file it as new.
Q-B: the partial-failure banner decision moves to the component layer, on four conditions —
the `aviso` value set stays **enumerated** (growing it is a lead call) · branch on the failed
step + `DocumentActionErrorCode`, **never message text** · ⛔ no comment claiming a client
branch is a control (the DM2 P0 / r2-1 class) · the failure message must actually **render**
(Radix `AlertDialogAction` unmounts on click).
Q-C: the wizard stays in S2, **sequenced** after backend's field, with standing latitude for
frontend to stop at that boundary and split if it proves larger than the ruling assumes.

**Lead ruling — the TS cutover crosses a file-ownership boundary: option 1 (contract-first).**
The five `set_document_version_file` call sites change *shape*, not just call: server-side
`FormData` upload → the DM2 client-upload flow, which changes the component contract.
Backend posts + lands the signatures in `src/lib/**`; **frontend** does the component
cutover; `typecheck` stays RED at 6 until S2 lands, deliberately. **Option 3 (a thin
server-side compat path) was rejected** — it would install a **second byte-writing path
beside the DM2 corridor in the phase whose purpose is collapsing them to one**: a temporary
red bar is a schedule cost, a second write path is an architecture cost that outlives the
phase. Option 2 (backend takes frontend's files) breaks §4 ownership for speed — the exact
trade the contract-first rule exists to prevent.

