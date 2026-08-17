# DM5 — handoff (paused 2026-08-17, **S4 BUILT + both QA blockers fixed; the resume point is ONE clean `e2e:prod`, then QA r2 — read §12 FIRST**)

> **Read this first, then `docs/progress/dm5-wave-d-retirement.md`** (the phase record) and
> **ADR [0120](../decisions/0120-dm5-wave-d-retirement-decisions.md)** (D1–**D18**, all PO-ruled).
> Plan: [dm5-wave-d-retirement-plan.md](../plans/dm5-wave-d-retirement-plan.md).
> Written for someone who was **not here**. Where it says *verify*, verify — this phase punished
> inherited claims repeatedly, **including six times in the session that built S3** (§9).

## 0. ⭐ START HERE — the resume point is **S4**, and it is the irreversible one

✅ **S3 is CLOSED** (2026-08-14, all four gate steps; QA **APPROVED r2** at `801a2589`). The prerequisite
this section used to name is discharged — §10 now records the *outcome* instead of the brief.

1. ~~**S4 is next, and S4 DELETES STORAGE OBJECTS IRREVERSIBLY.**~~ ✅ **S4 RAN 2026-08-16** — PO
   authorized it explicitly on the day, as this section required. **⛔ CORRECTED 2026-08-17: step 2 is
   NOT green.** QA r1 returned **CHANGES REQUESTED** (build sound; both blockers were record/coverage
   defects, now fixed in code), and **four subsequent gate attempts produced no usable E2E figure —
   with zero assertion failures in any of them.** So: step 1 ✅ · **step 2 ⛔ UNESTABLISHED** ·
   step 3 owed (r2) · step 4 owed. **The resume point is §12.**
   ⛔ **And the headline is the opposite of what this section anticipated: S4 deleted ZERO BYTES.**
   All 221 retirement-bucket files were already metadata-less orphans, so the Storage API — the D9
   *gate* — could not address any of them; `delete --execute` never ran. What S4 retired is the
   **bucket rows + policies**, via migration `20260927000400`, and that half now survives `db reset`.
   **The deploy-time byte sequence therefore remains UNREHEARSED.** Detail: §11 + the phase record.
2. **Before spawning anyone**, re-verify the catalog claims in this file (registry, census, flags). Where
   it says *verify*, verify: this phase punished inherited claims repeatedly, **including six times in the
   session that built S3, four of them by the lead** (§9).

## 1. Where things stand

| slice | state |
| --- | --- |
| **S0** manifest tool | ✅ complete (`0e85cbe7`, `9d37ad79`) — 8/8 self-test controls |
| ~~**S1** substrate amendment~~ | ⛔ **WITHDRAWN, never built** — D3/D4/D5 struck, replaced by **D11** |
| **S2** NSP RCA/CAPA evidence | ✅ gate steps 1–2 COMPLETE; four arms DISCHARGED (§3) |
| **S3** printed renditions | ✅ **COMPLETE — all four steps** (QA **APPROVED r2** `801a2589`). Detail §9, verdict §10 |
| **S4** retirement (8 buckets) | 🔵 **BUILT + both QA blockers FIXED in code. THE ONLY THING OUTSTANDING IS A CLEAN `e2e:prod` RUN, then QA r2.** ⛔ **Do not quote 1118** — 4 gate attempts, 0 usable figures, 0 assertion failures in any of them (all environmental; 3 self-inflicted). ⚠ Byte half was a NO-OP, **then the 221 orphans were destroyed outside the gate** — §11 · §12 |
| **S5** operational closure | ⬜ not started — carries a **binding input** (§5) |
| **S6** canon + exit sweep | ⬜ not started — `backend-state.md`'s document surface is an explicit deliverable |

⛔ **Branch `main`, NOTHING PUSHED, no `db push`, no remote reset. All DM flags ship OFF**
(`documents_wave_d` **and** `document_printing` are ON in the local seed only — and **both must be flipped
together at deploy**, ADR 0120 D5/S3). Registry **406 == 406** at HEAD `801a2589`; **re-verify before
trusting any catalog claim in this file.**

### Environment facts that will otherwise cost you an hour

- ⚠ **The print corridor needs the Gotenberg sidecar.** `docker start gotenberg-pdf`, then
  `curl -s -o /dev/null -w "%{http_code}" http://localhost:3010/health` → **200**. Without it the 15 print
  specs fail as uniform pt-BR "indisponível"/timeout errors that **read exactly like product defects**.
  `PDF_RENDERER_URL=http://localhost:3010` is already in `.env.local`. Recipe:
  `docs/deployment/pdf-renderer.md:24`. **`e2e:prod` neither starts nor checks it.**
- ⚠ **Pass `--workers=1`** when driving specs against `next dev`. Default workers gave **12 failures, every
  one a 30 s `page.goto` timeout on `/login`**, while `curl` answered the same route in **73 ms**.
  Serialized: 9/9 and 4/5.
- ⚠ **A green `e2e:prod` ALWAYS leaves residue.** `RESET=1` resets *before* each batch and nothing resets
  *after the last one*, so **any `test:db` immediately after a gate runs on a contaminated DB** — that is
  what reddened `252_authz_p0_isolation` with a `(commission_id, position)` collision against
  `VIEWS-E2E` rows from batch 18. Always `supabase db reset --local` between a gate and pgTAP.

## 2. What S2 delivered

Migrations `20260927000100`–`000170` (8): securable types `rca`/`capa_action` + **both** `tenant_shape`
shapes + the `hospital_of_capa_action` correction · `can_read_document` arms (custody-following) ·
upload seam (`p_storage_path` dead) · citation seam un-parked · **BUG-DM5-CAPA-1** fix ·
arm-scoped `documents_wave_d` · **`can_write_document` arms** · pgTAP **`341`** (plan **53**).
Plus the TS layer (11 stubs filled), the availability mapping as a **pure total function** with
exhaustive tests, and ~292 lines of orphaned NSP surface deleted.

**Gate:** fresh reset · registry 399==399 · pgTAP **192 files / 6284** · tsc 0 · lint 5/5 ·
vitest 1294 · four arms **HOLD** · **E2E 8/8 new + 36/36 pre-existing at exact prior baseline**.

⚠ **S2 was closed ONCE, WRONGLY, and reopened.** It passed every gate above *except* E2E while the
feature **did not work at all** — 11 TS bodies still threw, and `can_write_document` had no arm for the
new types. **No gate in that list executes a page.** Detail: phase record + `green-bar-misses-the-wired-seam`.

## 3. S2 gate steps 1–2 are COMPLETE ✅ (resolved at the pause)

**Sweep verdict: `COVERED`** — `BLIND: 0 · ERROR: 0 · cases executed: 1` (nonzero, checked before citing),
exit 0, baseline `Files=192 Tests=6284`. **Lead-verified independently.** Commits: `eb863ce8` (`341` block
G) · `22148ca1` (`329` guard) · `fa28ec19` (findings row).

**The diagnosis held, and for the stated reason.** The earlier `ERROR` was **`329` aborting**, not this
gate being blind: the unguarded raw statement at **`329:494`** errored *outside* any pgTAP wrapper once R1
succeeded under neutralization, losing exactly 41 tests. ⚠ **`341`'s old plan was also 41 — pure
coincidence**, and that collision produced a confident wrong diagnosis ("341 aborts") that two people
adopted. **Falsified; do not re-adopt it.** Guarding `329:494` with the `340`-B7
`do $$ … exception when others …` idiom preserved the run shape ⇒ `FAIL` ⇒ `COVERED`.
**Corroboration:** the sweep's failing-file list now reads `229,231,314,328,329,340,341` — **`341` appears,
which it could not have before block G.**

⭐ **The stale-COVERED finding is recorded IN the findings row itself** (`authz-door-audit-findings.md:197`),
not only here — because that row is what a future reader will trust:

> **A gate keeps its name when its arms change.** The prior verdict was earned by DM1-era suites against
> the **six old arms**; S2 added two more underneath the **same name**, and ARM 1, the census and that row
> all kept reading `COVERED` while the new arms had **zero executable coverage anywhere in the repo**.
> **The inverse of the rename hazard: a rename orphans a verdict loudly; this widens one silently.**

**Stack verified clean at the pause:** degenerate bodies **0** (strict *and* whitespace-widened variants),
`rca_arm=t · capa_arm=t · prosecdef=t`, findings file restored to **594** lines with table integrity
checked, **tree clean on `main`**.

✅ **DISCHARGED 2026-08-14 (lead, on resume). All four arms re-run at HEAD `e2af9790` on a fresh reset —
all HOLD**, and the reasoning above is now verified rather than asserted:

| arm | the question it asks | result |
| --- | --- | --- |
| `ARM=census` | has anything **ever asked** about each live gate? | **HOLDS** — live **546** / verdicts 569 |
| `ARM=hat` | does a door read `memberships` **without the caller's hat**? | **HOLDS** — 3, all reasoned-allowlisted (self-test 6/6) |
| `ARM=floor` | is every door **actually called**? | **HOLDS** — 74 never-called, all allowlisted |
| `FROMFINDINGS=1 ARM=wrapper` | the `prosecdef = f` half | **HOLDS** — BLIND 41, all allowlisted |

**Census stayed at 546, confirming "no new census entry is owed."** Post-run safety checks, per §6:
degenerate-body sweep **0**, both kernel doors still `prosecdef = t` with both new arms, tree **clean**,
findings file back to **594** lines. ⭐ *The distance between "reasoned" and "verified" here was ~90
seconds of compute; S2 already paid once for a gate that was reasoned about instead of executed.*

**Whole baseline re-measured the same run, none of it inherited:** registry **399 == 399** · pgTAP
**192 files / 6284 PASS** · tsc **0** · lint **5/5** · vitest **1294/1294**. Every figure reproduced the
handoff's claim exactly. **The build is sound; the defects found on resume were all in the RECORDS** —
see the resume audit in the phase record.

⛔ **Before running any sweep, read §6 — the harness left an authz gate OPEN on this stack today**, and
its restore is still trap-dependent. **Run the degenerate-body query immediately after every run, every
time** (§6).

## 4. S3 — parked, with every ruling already made

**Do not re-litigate these. They are ADR 0120, PO-ruled.**

- **D1/D6** — `form_response` joins the securable types; **all four** `source_kind` values migrate, so the
  manifest closes 8/8. ⚠ `tenant_shape` will carry a **third** shape; the coupling keystone must exercise
  **all three**.
- **D7** — `printed_documents` **becomes** the satellite (keeps tokens/status/supersession/revocation;
  sheds `storage_path` + `pd_storage_path_derived`). **No new table** — ADR 0114's stated satellite never existed.
- **D11** — **one `document_version` per print event**; supersession stays on `printed_documents`;
  superseded bytes retire via `file_objects.disposal_state`. **`document_version_files` is NOT touched.**
- **D12** — `open_printed_document` keeps `can_view_printed_document`, the overlay and the token path, and
  **delegates byte resolution to the core door** (D8 reserves the two document buckets for **one** signing
  door). ⚠ Shared resolver **`app`-scoped, never `public`**; authority is the **conjunction**.
  ⚠⚠ **The conjunction is a STRICT NARROWING, not two independent locks** — `can_read_document` opens with
  `if not app.is_active(p_uid)` and closes with the D15 ceiling, so the kernel arm **implies** the print
  check. **Only ONE refusal direction is reachable**; pin the other **structurally**, do **not** fabricate
  a fixture for it. (A proposal to make the arm commission-membership instead was **rejected**: it would
  have removed print access from targeted respondents and non-member creators — a testability requirement
  driving an authorization change.)
- **D13** — a print mints its version on its **OWN `documents` row**, never appended to a content
  document, else `add_referral_shared_item` (which picks latest-version-desc) would **freeze a printed PDF
  into a referral snapshot instead of the source content**. **Keystone the separation itself.**

### S3 traps already identified — do not rediscover

1. **`printed_documents` uses COLUMN-LIST grants** — every new column needs its own GRANT or reads `42501`.
2. **pgTAP `312`/`313`/`323` insert `storage.objects` rows for `printed-documents` without creating the
   bucket row** — fix those fixtures in S3, before S4 can delete the bucket.
3. ⚠ **CORRECTED + SHARPENED 2026-08-14 (lead, resuming). The enumeration was bounded by two line
   numbers; the property has FOUR sites — and the failure mode is not the one recorded.**
   Every projection that resolves a version's bytes via `.find(b => b.rendition_kind === 'source')`:
   `queries/documents.ts:116` · `:142` (**both named**) · **`queries/controlled-documents.ts:163`** ·
   **`queries/nsp-evidence.ts:61`** (**neither named anywhere** — and the latter is S2's OWN new code,
   shipped with the same shape). This is the phase's *fourth* instance of
   [[enumeration-boundary-is-a-syntax-not-a-property]] — the plan text already counts three.

   **It does NOT crash and it does NOT read as broken.** All four feed `documentVersionAvailability`,
   whose first rule after disposal is `if (sourceUploadState === null) return 'pending'`. So a
   print-only version (a `printed_pdf` binding and no `source`) resolves `file === undefined` →
   `availability = 'pending'` → **`canOpen: false`**. A print whose bytes are fully present and
   verified renders **forever as "aguardando envio"**, and no list projection will ever offer to open
   it. **Fails soft, silent, and wrong** — no error boundary, no log, nothing for a gate to catch.

   **Reachability, per site — the question the two-line version never asked:**
   - `documents.ts` — the generic panel projection. Under **D13** a print is its **own `documents` row
     homed on the source's securable resource**, so a case's/meeting's Documentos panel **will** meet it.
     ⇒ **REACHABLE. This is the real defect, and D13 is what creates it.**
   - `controlled-documents.ts:163` — reaches only `controlled_document`-homed docs, and
     `printed_documents.source_kind` ∈ {`form_response`,`case`,`meeting`,`interview`} has **no
     `controlled_document`** ⇒ **not reachable today.**
   - `nsp-evidence.ts:61` — reaches only docs joined through `rca_evidence`/`capa_action_evidence`,
     i.e. evidence uploads ⇒ **not reachable today.**

   ⭐ **So do not "fix line 116 and 142".** Three facts make that the wrong shape: the defect is created
   by a *product* decision (D13's own-row separation), the two unreachable sites become reachable the
   instant anything binds a `printed_pdf` to a version they can see, and the bug is not in the shared
   predicate — it is that **four callers independently equate "the bytes" with "the `source` rendition"
   while the substrate now has two rendition kinds.** Fix the *resolution seam*, and **keystone the
   invariant**, not the line numbers. Backend + frontend jointly, not "frontend's".
4. **FUP-DM5-DVF-FILEOBJ** stops being latent if the print path binds a **pre-existing** `file_object`.
5. ⚠ **A new home type means enumerating EVERY dispatch on `resource_type`** — `can_read_*` **and**
   `can_write_*`. S2 shipped the read arm and missed the write arm entirely.

## 5. Open follow-ups, ranked

| id | what |
| --- | --- |
| 🔴 **FUP-AUTHZ-HARNESS-TRANSACTIONAL** | The door-audit harness neutralizes **outside a transaction**; its `EXIT` trap does not fire when a subagent's process is killed ⇒ **process death leaves an authz gate OPEN**. It happened (§6). Fix: make neutralize→probe→restore one rolled-back txn (proven residue-free by md5). |
| 🔴 **FUP-DM5-STORAGE-ORPHANS** | Method half **ruled** (ADR 0120 D9, manifest-first). **Remote half still open** — on Cloud there may be **no customer-accessible tool that can see an orphan**; the S3 endpoint is UNVERIFIED. **Blocks S4.** |
| 🔴 **FUP-PGTAP-VACUOUS** | `lint:vacuous` scans TS only; **every DM5 keystone is SQL**. |
| 🟠 **FUP-DM4-RECUSAL** | Open **security** obligation, deadline = the `documents_wave_c` flag-on date. **DM5 does not close it.** |
| 🟡 **FUP-DM5-FINALIZE-ATOMIC** | Finalize is **four round-trips**, non-atomic; a failed second RPC leaves bytes + a document with no evidence row. ⚠ **Invisible to `document-reconciliation.mjs`** — its classifier judges `file_objects` against storage and calls that row healthy, *because at the storage layer it is*. **Binding input to S5.** |
| 🟡 **FUP-AUTHZ-ALLOWLIST-ROT** | Nothing validates that floor-allowlist entries name a **live** door; line 41 names a function DM4 dropped. Inert, but reads as coverage. |
| 🟡 **FUP-DM5-GRANTS** | `rca_evidence`/`capa_action_evidence` carry table-wide `arwdDxtm` to `authenticated` — the RPCs are **not single doors**. Calibrated: RLS is a genuine second lock; hardening, not a hole. |
| 🟡 **FUP-DM4-PRODROW** · **FUP-DM3-ETHICS-UI** | Carried from earlier phases. |

### Not-yet-filed, from S2's closing reports — file or act on these

- **A stale findings row.** `docs/reviews/authz-door-audit-findings.md:197` marks `can_write_document`
  **COVERED**, sourced from **DM1-era suites**. That verdict was earned by **six arms**; S2 added two more
  underneath **the same name**. ⭐ **A gate keeps its name when its arms change** — the inverse of the
  rename hazard, and *quieter*: a rename **orphans** a verdict loudly; this **widens** one silently.
- **`330` is BLIND to `can_write_document`** — it calls `begin_document_upload` and notices nothing when
  the gate opens. Not a DM5 blocker (the gate is covered by `341`), but real.
- **The live in-dialog `terminal` UX is unexercised by any test in this repo.** DM2 QA r1 MAJOR-3's whole
  reason for the marker. `tester` attempted it twice and retired it with a **measured** reason:
  `finalize_document_upload` checks `storage.objects` **first** and raises the non-terminal `HC0D9` when
  absent, so both fault-injections land on the ordinary branch; the terminal arm needs the opposite
  ordering, and both calls sit **inside one server action, server-to-Supabase, never crossing the browser's
  network stack**. **No seam for `page.route()`.** Suggested path (PO call, trades test surface for
  production surface): a **test-only server hook** to force the verification outcome.
- **A parallel-worker deadlock** in `test_helpers.bootstrap()`'s `truncate … cascade` between `pg_prove`
  workers. Transient, cleared on re-run, **unexplained**. ⚠ *It will re-red a phase gate at random and read
  like a defect.*
- **`capa_action` coverage rests on ONE seeded row** (`source='rca'`). The other five `capa_plan_source_check`
  values are unexercised — exactly where ADR 0120 **D14**'s "NULL for 4 of 6 sources" concern lives.

## 6. ⛔ The incident — read before running any mutation harness

`app.can_write_document` — the gate for **every** document write across all eight home types — sat live
with the body `begin return true; end` (**unconditional allow**) on the shared stack. **Cause: a lead
instruction** to *"neutralize and confirm your block goes red"* that **omitted "transactionally"**, on a
stack two teammates were using. Not a product defect; the migration is correct and self-verifying.

- **Caught by `tester`, which verified its environment BEFORE executing an agreed plan** — everything it
  was about to run would have gone **green while proving nothing**.
- ⚠ **`pg_proc` carries no mtime** — the window cannot be dated from the catalog. **Any document-write
  result from it must be RE-RUN, not re-read.**
- ⭐ **Blast radius was bounded by a PROPERTY query**, not a name list: sweep `app`+`public` for
  `^\s*begin\s+return\s+(true|false)\s*;\s*end`. **Exactly one hit.** A left-open gate is **invisible to
  all four §6 arms** — they test doors that *exist*. **Consider making that query a standing gate step.**
- ⭐ **Rollback proven before being relied on** — md5 of `pg_get_functiondef` before, replace in-txn,
  probe, `rollback`, re-read: **byte-identical**. Postgres DDL is transactional; a rolled-back
  `CREATE OR REPLACE` leaves no residue. Measured, not assumed.

## 7. The lessons this phase paid for — do not re-learn them

- **"File and DB agree" is NOT "the file works."** A reset **falsified** a migration whose assertion had
  never executed, while the live DB matched it exactly. A hand-applied delta stays an **inference** until a
  reset runs.
- **A predicate quoted at the wrong grain reads exactly like a proof.** Three lead errors share it — the
  check ran, it just wasn't checking the thing. Ask *which row or object* a fact constrains.
- **A search proving an ABSENCE must NAME the thing.** Quotable ≠ capable.
- **An enumeration's boundary must be the property, not a syntax** — **four** instances this phase,
  including a `create or replace` regex that missed a bare `create function`.
- **When several locks guard one state, the DENIAL is uninformative and the ADMISSION is load-bearing.**
- **A deliberately ambiguous error code is ambiguous to the TEST too** — `HC0D8` for both absence and
  unreadability is correct design *and* blinded an assertion. Establish the discriminating fact first.
- **A measurement is not a test.** The write-arm matrix was measured beautifully and lived in a **commit
  message**, not the suite.
- **A neutralization that makes a suite ABORT is indistinguishable from a smaller suite** unless you check
  the count against the plan. ⚠ And the count is the **alarm, not the diagnosis** — here it pointed at the
  wrong file.
- **Every close carries an explicit `NOT TESTED / NOT COVERED` heading.** Binding. On its debut it
  surfaced a P0 nobody else had found. *A close that lists what passed without naming what was untested
  reads as completeness.*

## 7a. The S2 UI — what is not in any commit message (from `frontend`, at stand-down)

⚠ **None of the S2 UI components has a unit test.** The vitest count rose entirely from other work this
slice. **`tester`'s E2E is not the primary verification of this UI — it is the ONLY verification, at any
level.** Contract-first bought real type safety (the widened union broke the build immediately), but every
UI decision was reasoned from types and prior art rather than from seeing a rendered pixel. Typing cannot
catch a wrong sentence, a blocked popup, or a crash on an unmapped value.

**Check these first, in this order — `frontend`'s own ranking:**

1. ⚠ **`NSP_EVIDENCE_AVAILABILITY[availability].detail` is the highest-risk line in the UI.** If the
   projection ever emits a value outside the five-member union — a raw `file_objects` state, or a non-null
   availability on a `link` row — the lookup returns `undefined` and `.detail` **throws, crashing the whole
   panel** instead of degrading. **Everything else fails soft; this does not.** `frontend` would accept a
   missing fallback here as a finding. Exercise one row in each state.
2. **The D8 security property itself:** confirm **no signed URL appears in the rendered HTML payload** and
   **no `createSignedUrl` fires on page load**. That is the actual ADR 0114 D8 claim, and it is verifiable
   by inspecting source — no clicking required.
3. **Whether `canOpen` does any work at all.** If it is always exactly `availability === 'available'`, the
   prop is **inert** and the ceiling is unobservable — the BUG-DM2-002 shape, where a "visible but
   restricted" cell turned out unreachable. Establish which world we are in *before* anyone writes a test
   asserting it.
4. ⚠ **A silent hole `frontend` knows about and could not test:** in `OpenEvidenceButton`, on success it
   calls `window.open(...)` **from inside a transition callback** rather than directly in the click
   handler. If the browser blocks the popup, the button does **nothing at all and sets no failure state** —
   from the code's view it succeeded. **Keyboard-and-Enter is the most likely trigger.**
5. `expiresAt` pre-emption at the **120 s PHI TTL** — open the dialog, wait, submit: it must say *expirou*,
   not *não chegou por completo*.
6. The `role="status"` progress region — a fast upload may fire all three phases inside one announcement
   window.

**Decisions that will look arbitrary or wrong to a cold reader:**

- **`"use client"` on both evidence panels is FORCED, not chosen.** They hold no state and should be Server
  Components per the design system, but they descend from `RcaWorkspace` / `CapaActionCard`, which are
  client. Making them server means restructuring the whole workspace tree — far outside DM5. **The documents
  twin (`DocumentRow`) IS a Server Component**, so the two read as gratuitously inconsistent and the reason
  is invisible from either file.
- **`document-badges.tsx` now has a client consumer, and that coupling is invisible from the documents
  side.** It works only because that file happens to have no server imports. **Anyone adding one breaks the
  NSP evidence panels** — `lint:client-server-imports` catches it, but a person editing a Wave-A badge file
  will not expect NSP to be their blast radius.
- **`idPrefix` on the upload dialog fixes a LIVE a11y bug, it is not tidiness.** CAPA renders one evidence
  list *per action*, so several dialogs mount on one page; the pre-S2 code hardcoded
  `id="capa-evidence-file"`, so **every `<label htmlFor>` on the page pointed at the first action's input**.
- **`CapaEvidenceUpload` lost its `capaId` prop** because `beginCapaEvidenceUpload(actionId, request)`
  derives the plan server-side. The deletion only makes sense against the new signature.
- **There is NO feature-flag check anywhere in the UI.** `documents_wave_d` OFF surfaces as `HC0D7` through
  the error path. Deliberate — UI hiding is not a boundary (Rule 1) — but **someone auditing D10 compliance
  will grep for a flag branch and find nothing.**

**Two open gaps, not decisions:**

- **`citedDocumentId` is an unbuilt affordance.** A document citation renders its `citationLabel` as flat
  text like any other citation, with **no link through to the document**. Arguably it should be clickable;
  no query or route was posted, so `frontend` did not invent one. (`documentId` being unused *is* deliberate
  — opening goes through the evidence id.)
- ⚠ **`PendingEvidenceButton` is `disabled`, so it is not in the tab order** — a user navigating by control
  never reaches it and never hears the `aria-describedby` explanation of why it is inert. The sentence is a
  sibling paragraph so it is readable in document flow, but the wiring only pays off for someone who lands
  on the button. **May argue for `aria-disabled` over `disabled`** — needs a real screen reader.

**A side effect of un-parking the citation seam:** the citation form is hidden when
`citationTargets.length === 0` (pre-existing). So an RCA with **no interviews or meetings but ≥1 document**
now shows a "Citar registro" button **that has never appeared for it before**.

## 7b. ⚠ What S2's GREEN does NOT prove (from `tester`, at stand-down)

**Every one of the 8 tests measures exactly what it claims. But the SUITE's coverage is narrower than
"S2 evidence works" would suggest to someone who reads only the pass count.** In `tester`'s own ranking:

- 🔴 **Audit trail (Rule 11) for this corridor is COMPLETELY UNVERIFIED.** DM4 has `DM4-AUDIT-1` proving
  exact audit-row counts, a structured discriminator, and no coordinate/title leakage in metadata for its
  open door. **There is no equivalent for `openRcaEvidence` / `openCapaEvidence`** — nobody knows whether
  they emit a row, whether it is exactly-once, or whether the metadata is clean. ⚠ **The S2 contract's own
  header names closing "the Rule 11 gap" as a goal of this redesign.** What was verified is that the
  **mechanism works**, not that the **audit property holds**. Highest-value gap in the slice.
- **No derivation-honesty test for this corridor** — DM4's pattern (declare a false size/MIME at `begin`,
  prove `finalize` derives the truth from what actually landed). `finalizeDocumentUpload` is reused
  verbatim from the Wave-A/B/C corridor where it **is** proven, so risk is low — but that guarantee was
  **inherited by code-reuse reasoning, not re-measured here**.
- **No UI-level "the buttons are ABSENT, not merely refused" test for a non-writer.** RPC-level refusal is
  proven; whether `canEdit`/`canManage` actually hide *Enviar arquivo* / *Adicionar link* / *Citar registro*
  for a read-only viewer is not. DM4 has this shape (`DM4-FLAG-OFF-1`'s absent-not-disabled check).
- **No `documents_wave_d` flag-off test scoped to this corridor** — despite ADR 0120 **D10** calling the
  arm-scoped-vs-blanket distinction load-bearing, and M6 having fixed exactly that once.
- **Disposal-outranks-`unavailable` precedence is unit-tested only** (correct, per the `pending` reasoning)
  — but the two separate `unavailable` / `disposed` E2E tests do **not** prove the overlap case.
  `evidence-contract.test.ts` does.

### Fixture facts the next `tester` needs before touching anything

- ⚠ **`RCA_ID` is the ONLY seeded RCA and no RPC can mint another** (RCAs come only from the triage
  pathway). **Both** `phase14c-rca.spec.ts` (serial, walks its whole status machine) **and**
  `dm5-nsp-evidence.spec.ts` (`ensureRcaWritable`, forces it back to `in_progress`) mutate **the same row**.
  Safe today **only because nothing runs them concurrently** — a full-suite run batching across workers
  could interleave them into a **status race**. Anyone adding a third file touching `RCA_ID` must know this.
- ⚠ **The citation picker is structurally unreachable for that RCA — for EVERY target kind**, not just the
  new document seam: `listRcaCitationTargets` returns `[]` whenever the event's `case_id` is NULL, only
  `EV-0001` has one, and no RCA is seeded against it. **And `phase14c-rca.spec.ts` R8, titled for citation,
  never touches the picker** — it queries `case_interviews` directly and calls `add_rca_evidence`. **No test
  in this repo, old or new, has ever driven the citation UI form through a real select-and-submit.** Do not
  read "R8 covers citation" as UI coverage.
- **`li.animate-rise-in` generalizes.** Any component where a list item is *itself* an `<li>` containing a
  nested `<ul>/<li>` makes a bare `locator('li').filter({hasText})` match **both** outer and inner rows,
  because `hasText` filters on **accumulated** text, not own text. CAPA action cards nesting evidence lists
  are one instance; the case/action/task hierarchies likely hold others. Worth a sweep on any mysterious
  strict-mode violation.
- **Local `begin`/`finalize` wrappers live in the spec file** rather than widening
  `e2e/helpers/document-model.ts`'s `DocumentHomeResourceType` union — deliberate, to avoid touching a
  shared type. ⚠ **S3 faces the same choice point**: widen the shared union, or keep duplicating.
- **All `getByLabel` calls are scoped to `dialog.getByLabel(...)`, never bare `page.getByLabel(...)`** —
  "Arquivo" / "Título" are generic, and the scoping is **load-bearing** the moment two dialogs coexist.

⚠ **Record correction:** `BUG-DM5-S2-WRITE-ARM-1`'s first probe is **not valid fix evidence** — it ran while
`can_write_document` was neutralized by the lead's harness (§6). Kept as provenance only; the post-restore
probe and the end-to-end upload tests are the clean confirmation. Already corrected in PROGRESS.md.

## 7c. Two traps that will bite someone who was not here

### HANDOFF-1 — an intermittent `pg_prove` worker deadlock that READS LIKE A DEFECT

⚠ **Do not diagnose a red on these files as a regression without re-running first.**

**What it looks like:** `npm run test:db` exits 1, `Result: FAIL`, two files reporting
`Dubious, test returned 3 (wstat 768)` and `Bad plan. You planned N tests but ran 0`. The suite total
comes in **below baseline by exactly the sum of those files' plans** — indistinguishable from a real
regression in whatever they cover.

**What was observed:** `100_dashboard.sql` (22) and `10_immutability.sql` (17) both died at
`test_helpers.bootstrap()` line 61, `truncate table public.organizations cascade`, with
`ERROR: deadlock detected` — two workers acquiring the cascade's locks in opposing orders. Totals
`Files=192, Tests=6245` = 6284 − (22+17).

**Ruled out:** not the change under test (`341` reported `ok` in the same run) · **not** the E2E-residue
class §6 warns about (both files pass standalone via `psql`; the error is a **lock cycle**, not a count
mismatch) · not an external session (`pg_stat_activity` showed only idle daemons) · **not persistent** —
re-ran twice, `Tests=6284 PASS` both times.

**Not known:** why it is intermittent, or whether a `--jobs 1` knob exists in this `supabase test db`
invocation. **The tell is `Dubious` / `Bad plan … ran 0` plus `deadlock detected` — never a genuine
assertion failure.**

### HANDOFF-2 — `capa_action` coverage rests on ONE seeded source, but the risk is SMALLER than it looks

**Live `capa_plan.source` CHECK values and what the seed actually holds:**

| source | plans | capa_actions | reachable by `341` block G |
| --- | --- | --- | --- |
| `rca` | 1 | 2 | **yes — the only one exercised** |
| `manual` | 14 | 14 | seeded, **never exercised** |
| `event` | 1 | **0** | unreachable — no action exists |
| `indicator` / `audit_finding` / `meeting` | 0 | 0 | **not seeded at all** |

**1 of 6 sources exercised.** `manual` is the cheapest genuine second case — 14 actions already seeded,
zero new fixtures needed.

⭐ **Two facts that should stop anyone re-panicking about this.** `app.can_write_capa` is
`is_pqs_operator_of_for(capa_plan.hospital_id, uid)` — it reads **only `hospital_id` and never branches on
`source`**, so the write arm is **source-agnostic by construction**. And `capa_plan.hospital_id` is
**`NOT NULL` at the column level**, so ADR 0120 **D14**'s shape-B (`org + hospital`, NULL commission) has a
real backstop that an unseeded source cannot violate.

⚠ **Where the residual risk actually lives — and it is not the write arm.** D16's "NULL for 4 of 6 sources"
was about `app.hospital_of_capa_action` when it resolved `hospital_of_event(event_of_capa(...))`: only
`rca` and `event` reach an event. `341` E2 pins that it no longer routes that way. **The open question is
whether any OTHER resolver still reaches a CAPA's hospital via the event path** — that was not enumerated,
and the three unseeded sources cannot be tested at all until fixtures exist.

## 8. Teammates

All stood down. `backend` (the original) is **context-exhausted (~712k)** — spawn fresh, do not resume it.
`backend-assurance`, `frontend`, `tester` all hold useful context but the artifacts above are the record;
**a fresh team can resume from this document.**

⚠ **Shared local stack = one owner.** Two agents on one DB caused today's incident. Announce a reset
**before**, not after.

---

## 9. S3 — what was BUILT, and the six times this session paid the phase's own lesson again

**6 migrations `20260927000300`–`000350`** + `af9a894e` (r1) · pgTAP **`342_dm5_s3_printed_renditions.sql`**
(59) · fixtures rewritten in `312`/`313`/`323` · TS: D18 anti-join, moved coordinate, serving route.
Commits `6ffd92ff` `859faa18` `d964b61a` `e08cf4eb` `af9a894e` (+ `02b2218d` from `tester`) — all verified
**ancestors of HEAD**.

**What it does.** `form_response` joins **both** coupled CHECKs · `printed_documents` becomes a **satellite**
(`document_id`/`document_version_id` NOT NULL UNIQUE + a **composite FK** so they cannot disagree;
`storage_path` **and** `pd_storage_path_derived` retired) · a **print arm in BOTH kernel doors**, positioned
**below `app.is_active`** · new `app.resolve_document_version_bytes` with `open_document_version` **and**
`open_printed_document` both delegating to it (**D12**) · the mint rebuilt onto the substrate atomically ·
**five** write guards. Full surface delta: the currency stamp at the head of
[backend-state.md](../backend-state.md).

### Gate figures (lead-verified from the catalog, not accepted from reports)

`registry 406 == 406` · pgTAP **193 files / 6348 PASS** · tsc 0 · lint **5/5** · vitest **1294** ·
`ARM=census`/`hat`/`floor`/`FROMFINDINGS=1 wrapper` **all HOLD** (census live 546, unchanged) ·
diff-scoped sweep **BLIND 0 · ERROR 0** · degenerate bodies **0** · findings file **595**.
**`e2e:prod`: 1120 passed · 0 failed · 0 did-not-run · 3 flaky · 18 batches**, every batch's own
`accounted N/N` reconciling. `next build` compiled — **S3's first production build**.

⭐ **The corridor was EXECUTED, which S2's never was:** `pdf-printing` **9/9** and
`pdf-printing-meetings` **6/6** against real `%PDF-` bytes — mint → download → public verify → revoke →
overlay → re-verify, plus a `participants_only` meeting refusing a non-attendee, plus tester's new **D18**
test. **S2 passed every static gate while its feature did not work at all. S3 has been run.**

### One live bug found and fixed: BUG-DM5-S3-INACTIVE-PRINT-1

A **deactivated** user kept print-download authority while being refused every content document.
`can_read_document` guards `is_active` above its dispatch; `can_view_printed_document` does not — and its
`form_response` arm's **first disjunct is the bare `v_resp.created_by = p_uid`, behind an `or`**, so no
callee could supply the check. **Latent only because `document_printing` ships OFF.** Closed by D12's
conjunction — which is why "strict narrowing" is load-bearing rather than decorative. ⚠ **No authz ARM can
see this class** (all five test a gate that *is* there; a *missing* term is invisible) →
**FUP-DM5-SIBLING-GUARD-DIFF**.

### The six repeats of "the enumeration's boundary must be the property" — all in one session

Recorded because the phase's dominant failure mode fired six more times, **four of them by the lead**:

1. The inherited record named **2** `source`-rendition sites; the lead corrected it to **4**; `backend`
   found a **5th** — the lead's four were bounded by `.find(`, the fifth writes it as `.eq(`.
2. `342` was first assigned to pgTAP **`341`** — which is **S2's own suite**. The number was never `ls`'d.
3. `tenant_shape` was pinned as gaining a **third** shape; it stays at **two** (`responses.commission_id`
   is NOT NULL). *Which arm it joins* was mistaken for *a new shape*.
4. `312`/`313`/`323` were pinned at **11** `storage.objects` rows; **9** persist — the 10th sits inside a
   `throws_ok` asserting refusal. Insert **statements** counted, not persisting **rows**.
5. The smoke file's print-coordinate property had **four** sites; `backend` updated **one**. The stale
   `afterAll` deleted from the emptied bucket, i.e. **leaked orphans into the new ones**.
6. `printed_documents.storage_path` was swept in `supabase/tests` and `src` but **not `e2e/`** — one spec
   still selected it. ⚠ Every *other* `storage_path` hit in `e2e/` is `file_objects.storage_path`, which
   **still exists**, so a sweep-replace would have been wrong.

### Two true-sounding claims that were false — both corrected in place

- **ADR 0120 D17's remote half.** "A remote reset creates orphans" generalised a **local** measurement by
  *"the same mechanism class."* The remote mechanism was **one line** in the CLI's `drop.sql`, added
  [cli#3083](https://github.com/supabase/cli/pull/3083), **reverted [cli#3359](https://github.com/supabase/cli/pull/3359)**
  (Mar 2025). Grep-verified **absent** in the shipped **v2.105.0** binary with an `auth` **positive
  control** (storage → 0 hits, auth → 3). ⭐ **A correctness property can live in a DEPENDENCY's source and
  regress on `npm update`** — `package.json` pins `^2.105.0`, a caret range. Re-run the grep on any bump.
- **D18's detail half.** The filter landed on `queries/documents.ts`'s `getDocument`, which **no route
  imports**; the reachable same-named export in `queries/controlled-documents.ts` selects
  `from('controlled_documents')`, so prints are excluded **structurally, by the schema, not by D18**.
  Two exports, one name — a grep for the symbol *looks* answered; only the **import site** discriminates.

## 10. §6 step 3 — ✅ **DISCHARGED: QA APPROVED (r2)**, 2026-08-14

[dm5-s3-review.md](../reviews/dm5-s3-review.md) now carries both rounds. r1 = **CHANGES REQUESTED**
(0 P0 · 2 MAJOR blocking · 6 MINOR · 2 INFO) → all discharged at `af9a894e` → **r2 = ✅ APPROVED**
(`801a2589`). New at r2: **0 P0 · 0 MAJOR · 1 MINOR · 3 INFO**, all record-level.

| r1 item | how r2 settled it — **measured, not read** |
| --- | --- |
| **MAJOR-1** `342 S3f4` was a vacuous keystone (with guard 4 deleted the same `P0002` still came from `can_write_document`'s fail-closed `else`) | ✅ The new **`S3k`** pair discriminates. Guard 4 deleted from the **live** body (`guard4_still_present=false` printed *before* the suite ran): **`S3k2` RED — `caught: no exception / wanted: P0002` — with `S3f4` GREEN in the same run.** No production SQLSTATE changed; `P0002` remains the door's absence≡denial idiom |
| **MAJOR-2** `312 t51` recorded the retirement as *"stronger … cannot be leaked from here at all"* | ✅ Retitled *"a RELOCATION, not a withholding improvement"*, `t51c`/`t51d` added. ⭐ **r2 refused to inherit the lead's correction of r1's premise and re-derived it**: the retired CHECK made `storage_path` a pure function of `id` + `contains_phi`, both granted by the same migration ⇒ **already vacuous pre-S3**. It then **applied the declined `REVOKE` in-transaction**: the `home_resource_id`-only walk yields the coordinate **before and after**, while the column itself 42501s — *effective, and closing nothing.* Declining it was right |
| 4 MINORs | ✅ All five red-first claims reproduce **exactly**, incidental co-reds included. `S3d2`'s old vacuity shown **side-by-side on the same mutated body**: `pos_active=0`, old form `t`, new form `f`. ⭐ r2 also proved red-first the two assertions `backend` had **not** (`t51c`/`t51d`) |

⭐ **The lead closed r2's one stated gap.** r2 wrote that it had **not** re-run `ARM=census`, and that
`…000360` *does* rewrite a `prosecdef = t` body — i.e. it accepted step 1 as *reported*. Since
**`ARM=census` is exactly the arm that catches a gate you just added**, all four were re-run at
`801a2589`: census live **546** / verdicts **570** · hat **3** reasoned-allowlisted (self-test 6/6) ·
floor **74** never-called, allowlisted · `FROMFINDINGS=1` wrapper BLIND **41** ⊆ allowlist — **all HOLD**,
exit 0, never piped. ⚠ **570 > 546 is the invariant satisfied, not a discrepancy**: the surplus is verdicts
for gates no longer live (FUP-AUTHZ-ALLOWLIST-ROT). The *live* figure is unchanged.

**Still owed / still true after r2:**
- 🟡 **r2-MINOR-1 — ✅ taken**: ADR 0120 **D11** now carries an inline `⏳ CONTESTED` pointer to
  FUP-DM5-D11-SUPERSEDED-NEVER-RETIRES. Left a **pointer, not an amendment**, on purpose — build-it-or-strike-it
  is the PO's call and pre-writing either outcome would take it away.
- 🔵 r2 INFO: `t51c` is a weaker pin than its label · `342:21-27` declares plan **44** for `plan(59)`
  (→ FUP-DM5-342-PLAN-COMMENT) · `S3n` takes **ACCESS EXCLUSIVE** on `file_objects` (→ recorded on
  FUP-PGTAP-WORKER-DEADLOCK).
- ⛔ **`FUP-DM5-330-WRITE-BLIND` stays OPEN** — verified still open with its "do not close on `342`" note
  intact. `S3l` covers the **print arm only**; door-level BLIND lifting ≠ arm-level coverage.
- ⛔ **r2 is a SLICE verdict.** DM5's phase QA is owed at **S6**, and r2 authorizes **no part of S4**.

**r2's own not-re-verified list** (an APPROVED slice is not an absence of gaps): r1's entire §4 · the mint
path's error mapping for the new `raise;` · the other ~180 assertions in `312` · anything remote.

**Safety record, lead-verified after the agent stood down** — because the standing rule is that a mutation
harness proves its own rollback, and *this* stack has been left with a gate OPEN before: fresh reset first ·
**8 mutation-bearing runs, every one a single rolled-back transaction** · degenerate bodies **0** after each ·
all five mutated functions byte-identical by `md5(pg_get_functiondef)`, `begin_document_upload` =
`aedac0b01f2ad0a594b75eede6671fb0` (**the md5 r1 recorded**) · `prosecdef=true` ×5 · column ACLs restored ·
`storage.objects` back to **8** policies · registry 406==406 · `pgtap` dropped.

## 11. S4 — ✅ AUTHORIZED AND RUN 2026-08-16 (steps 1–2 green; 3–4 owed)

> ### 📌 OUTCOME — read this before the (still accurate) planning text below
>
> **PO authorized S4 on the day, as this section required.** Migration **`20260927000400`** retired the
> **8 bucket rows + the last 4 policies** (all `nsp-evidence`; the other seven buckets were already
> door-less). pgTAP **`325` 5 → 8**, red-first against the real pre-migration catalog. Gate: registry
> **407 == 407** · pgTAP **193f/6351** · tsc 0 · lint 5/5 · vitest 1294 · four arms **HOLD**
> (census **546**/570, unchanged) · `ARM=policy` **not applicable** (the diff only *drops* policies) ·
> `e2e:prod` **1118p / 0f / 0 did-not-run / 5 flaky / 18 batches**, reconciling to S3's 1129 collected
> exactly. **`pdf-printing` 9/9 + `pdf-printing-meetings` 6/6 with `printed-documents` deleted.**
>
> ⛔ **THE BYTE HALF WAS A NO-OP — and this is the single most important line in the section.** The
> stack was already in the degenerate post-reset state this file's own §11 warned about: **0
> `storage.objects` rows in all 12 buckets** against 866 files on the volume. So all 221
> retirement-bucket files are orphans with no metadata row, **unreachable through the D9 gate by
> definition**, `capture` returned `DEGENERATE BASELINE`, and **`delete --execute` was never run.**
> - ✅ Closed: the metadata/schema half, durably (six historical migrations recreate the rows on every
>   reset; the migration + `325` t6/t7 are what make retirement survive that).
> - ⛔⛔ **CORRECTED 2026-08-17 (QA B1) — the 221 files are GONE, destroyed OUTSIDE the gate.** The lead's
>   own `supabase stop` + `supabase start` recovery (after killing a mid-flight `db reset` and hitting a
>   container-name conflict) recreated the storage volume at **`01:06:02Z`**; `walk` now reports
>   *"(no directory on the volume)"* ×8 and `capture` returns `orphan_keys=0 / CAPTURE CLEAN`. **No
>   manifest, no count comparison, no audit — 15 of them PHI-tier.** The PO ruling to "leave them" was
>   **moot when given**, 3h11m later, because the lead briefed it from a 3-hour-old measurement.
>   FUP-DM5-STORAGE-ORPHANS stays OPEN (now centred on the Cloud question); new
>   **FUP-DM5-STACK-CYCLE-DESTROYS-BYTES**. ⭐ *A rule governing the deliberate path does not constrain
>   the accidental one — and nothing alarmed.*
> - ⛔ **NOT rehearsed:** the deploy-time byte sequence has still never run against a populated bucket.
>   Its correctness rests on **S0's 8/8 self-test**, not on S4. ADR 0120 **D9 now carries an inline
>   EXECUTION NOTE** saying exactly this. **Do not let S5/S6 read S4's completion as evidence that the
>   production path works.**
>
> 🔒 **One defect found and fixed, and it was aimed at the REMOTE:** the first version used
> `set local storage.allow_delete_query = 'true'` (copying `20260921000300`) and passed a standalone
> reset, pgTAP, all four arms and the catalog check — then the E2E gate's reset emitted
> **`WARNING (25P01): SET LOCAL can only be used in transaction blocks`**, i.e. a **silent no-op**,
> against a step whose refusal (`42501` from `storage.protect_delete`) was probe-confirmed as real.
> Fixed by moving the opt-in and the DELETE into **one `do` block**. ⭐ **`db push` is a different
> invocation from `db reset`.** → **FUP-DM5-SETLOCAL-MIGRATION**; `20260921000300` still carries the
> old idiom.
>
> **New follow-ups:** 🟠 FUP-DM5-SETLOCAL-MIGRATION · 🟡 FUP-DM5-MANIFEST-FLAG (`capture` takes
> `--out`; passing `delete`'s `--manifest` silently overwrote the committed S0 baseline).

The planning text below is retained because S5/S6 still depend on its reasoning. S4 retires **8
buckets** and was the first **irreversible** slice. **PO authorization was required on the day,
separately from any earlier approval** — and was given.

- **Binding ordering (ADR 0120 D9 + D17), the reverse of the intuitive one:** **delete-by-manifest through
  the Storage API FIRST**, while `storage.objects` metadata still exists and keys are enumerable — **and
  only THEN reset.** Reset-first makes emptiness **unprovable**, asserted against a just-truncated table.
  **S0's manifest tool stays load-bearing.**
- ✅ **The local rationale makes that binding, and it stands**: a local reset recreates the DB while the
  **Docker volume survives** (measured **0 metadata rows vs 699 objects / 7.02 MB / 198 PHI-tier**).
- ⛔ **The remote rationale does NOT** — see §9. `FUP-DM5-STORAGE-ORPHANS` is amended 🔴→🟠 and its Cloud
  half is **residual, not a blocker**.
- ⚠ **The committed manifest baseline self-labels DEGENERATE** and per the S0 record **must not be reused as
  S4 input** — S4 needs a fresh `capture` + `walk`. `backend` explicitly did **not** run one.
- ⭐ **A free S4 input arrives from S3:** every object still in `printed-documents` is now referenced by **no**
  `file_objects` row, so `document-reconciliation.mjs` classifies them all as unaccounted. Prints moved out;
  `printed-documents` correctly stays in `RETIREMENT_BUCKETS` while `documents-standard`/`documents-phi` are
  **CORE**, so S4's delete **cannot reach** the new print bytes.

### Open items S4/S5/S6 must not assume away

🟠 **FUP-DM5-D11-SUPERSEDED-NEVER-RETIRES** — D11 asserts superseded print bytes retire via
`file_objects.disposal_state`; **measured, both stay `none` and nothing schedules it.** Either build it or
amend D11 — a 20-yr-retention LGPD/ANVISA record asserting a control no code performs is worse than one
admitting the gap. 🟡 **FUP-DM5-DANGLING-PRINT-ON-DELETED-DRAFT** — a print of a *draft* response outlives
the deleted response: dangling `securable_resources` row, reachable by **no UI surface**; **6 of 9** local
prints are `form_response`, which renders no panel at all. 🟡 **FUP-DM5-DEAD-CORE-PROJECTION** ·
🟠 **FUP-DM5-SIBLING-GUARD-DIFF** · 🟠 **FUP-DM5-330-WRITE-BLIND** · 🟡 **FUP-ACL-APP-POPULATION** ·
🟡 **FUP-PGTAP-WORKER-DEADLOCK**. Bodies in [follow-ups.md](./follow-ups.md).

**Never verified for S3, and must not be claimed:** `case`/`interview` prints are **unmintable** (D6 is
satisfied at the *type* level only) · `add_referral_shared_item` never driven end-to-end · a print's
`file_objects.sha256` is the minter's hash (server-side, verified — but **not**
`finalize_document_upload`'s derivation, and it feeds `complete_document_disposal`'s duplicate-evidence
probe) · the smoke file is **not gate-resident** · `ARM=policy` was **not applicable** to this diff
(recorded as such, never as clean).

---

## 12. ⭐ START HERE IF YOU ARE RESUMING S4 (2026-08-17 03:30)

**S4's build and both QA r1 blockers are DONE in code.** Exactly one thing is outstanding: **a clean
`npm run e2e:prod` run**, and then **QA r2** on B1 + B2. Nothing else.

Commits (all on `main`, ⛔ **nothing pushed**): `19dd3124` (retirement) · `7977cd32` (B1 + record
corrections) · `11bfdd39` (MINOR-3/4/5/7 + 2 new FUPs) · `140ffd8c` (B2 R15 rewrite + `143` label).

### ⛔ Do NOT quote the 1118 figure

It predates the R15 fix and **no run since has reproduced it**. Four gate attempts produced **zero
usable figures — and, importantly, zero assertion failures in any of them:**

| attempt | result | cause |
| --- | --- | --- |
| tester's full gate | 46 "failures" in batch 17 + 28 unrun | **resource exhaustion**: `worker process exited unexpectedly (code=3221225794)` = `0xC0000142 STATUS_DLL_INIT_FAILED`, plus `browserContext.newPage` timeouts. **Workers never initialised; no assertion ran.** Every other batch was clean |
| lead isolation #1 | 134 UNRUN | stack still restarting **+ the tester's gate still alive** |
| lead isolation #2 | 66 UNRUN | same concurrent gate |
| lead full gate | died mid-batch-1, `EXIT=1`, **no error output at all** | unexplained abrupt termination — **no mechanism invented for it** |

⭐ **The gate's own wording is what prevented a wrong call, and it is worth internalising:**
> *GATE RED (UNRUN) — N test(s) never executed; zero assertion failures were observed. NOT a green run
> and NOT a regression signal: those tests were never given a chance to fail.*

**"Nothing failed" and "nothing ran" are different facts.** The lead nearly reported "isolation
confirms infra" from a run in which zero assertions executed.

### ⚠ The five environment traps that cost this session ~3 hours — ALL self-inflicted, ONE habit

**Trusting a status report instead of measuring the thing.**

1. **`TaskStop` / a completion notification does NOT mean the gate is gone.** The tester's task was
   reported *completed*; its `npm run e2e:prod` tree was still running, holding `:3000` and resetting
   the DB under two subsequent runs. **Before launching any gate: `Get-Process node` must be empty and
   `:3000` must have no LISTENING socket.** (`shared-local-stack-single-owner`, quoted into both
   agents' briefs and then broken by the lead twice in 20 minutes.)
2. **Piping a `supabase db reset` through `grep | head` SIGPIPE-kills the reset mid-flight**, leaving a
   half-built DB. The "never pipe a gate through `head`/`tail`" rule applies to **resets** too.
   Redirect to a file, then grep the file.
3. **After a reset the containers RESTART.** Querying immediately yields
   `relation "storage.buckets" does not exist` / `42P13 cannot change name of input parameter` — which
   read exactly like a corrupt database. **The lead misread this three times.** Poll for readiness:
   `until docker exec … psql -c 'select 1' ; do sleep 8; done`.
4. **A `supabase stop` + `start` recovery DESTROYS the storage volume** (reports `"backup":true` while
   doing it). This is how the 221 orphan files died — see §11 and FUP-DM5-STACK-CYCLE-DESTROYS-BYTES.
5. **`REBUILD=0` reuses `.next/standalone`.** Fine, but if a stale server holds `:3000` the batch
   servers collide and tests hit `ERR_CONNECTION_REFUSED` that reads like a product defect.

### The pgTAP result at the stop point, and why it is NOT a regression

**193 files / 5900 · `FAIL`.** 17 suites report `Bad plan … ran 0` with **`deadlock detected`** at
`test_helpers.bootstrap()`'s `truncate … cascade`, and **`Failed: 0` on every one — zero assertion
failures anywhere in the run.** That is **HANDOFF-1** (§7c) at unusual scale — 17 files vs the
recorded 2 — on a machine that had run three gates that night. **The last clean pgTAP measurement is
193 files / 6351 PASS at `19dd3124`;** this run neither confirms nor refutes it. **Re-run on a rested
machine before drawing any conclusion**, and check the count against the plan
(`a neutralization that makes a suite ABORT is indistinguishable from a smaller suite`).

### The exact resume recipe

1. `Get-Process node` empty · `:3000` no LISTENER · `docker start gotenberg-pdf` · `/health` = **200**
   (without it 15 print specs fail as uniform pt-BR errors that read as product defects).
2. `supabase db reset --local` **unpiped**, then **poll for readiness**, then confirm registry
   **407 == 407** and `storage.buckets` = the **4** survivors.
3. `npm run test:db` → expect **193 / 6351**. A `Bad plan … ran 0` + `deadlock` shortfall is HANDOFF-1;
   re-run before diagnosing.
4. `npm run e2e:prod` **redirected to a file, never piped.** Reconcile **per-batch** `accounted N/N`
   with **0 did-not-run** — the summary's `COVERAGE` line excludes skips and will look short.
   Verify `pdf-printing` **9/9** + `pdf-printing-meetings` **6/6** explicitly.
5. Spawn `qa` for **r2** on B1 + B2 only ([r1 review](../reviews/dm5-s4-review.md)). r1's own
   NOT-RE-VERIFIED list: it never re-ran `e2e:prod`, and B2 lives in that layer.
6. Then PO step 4.
