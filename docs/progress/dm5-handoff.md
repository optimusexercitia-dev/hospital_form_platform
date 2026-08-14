# DM5 — handoff (paused 2026-08-14, before S3)

> **Read this first, then `docs/progress/dm5-wave-d-retirement.md`** (the phase record) and
> **ADR [0120](../decisions/0120-dm5-wave-d-retirement-decisions.md)** (D1–D16, all PO-ruled).
> Plan: [dm5-wave-d-retirement-plan.md](../plans/dm5-wave-d-retirement-plan.md).
> Written for someone who was **not here**. Where it says *verify*, verify — this phase punished
> inherited claims repeatedly.

## 1. Where things stand

| slice | state |
| --- | --- |
| **S0** manifest tool | ✅ complete (`0e85cbe7`, `9d37ad79`) — 8/8 self-test controls |
| ~~**S1** substrate amendment~~ | ⛔ **WITHDRAWN, never built** — D3/D4/D5 struck, replaced by **D11** |
| **S2** NSP RCA/CAPA evidence | ✅ build + E2E green; **close pending one sweep verdict** (§3) |
| **S3** printed renditions | ⛔ **NOT STARTED — the pause point.** All rulings already made (§4) |
| **S4** retirement (8 buckets) | ⬜ not started |
| **S5** operational closure | ⬜ not started — carries a **binding input** (§5) |
| **S6** canon + exit sweep | ⬜ not started |

⛔ **Branch `main`, NOTHING PUSHED, no `db push`. All DM flags ship OFF** (`documents_wave_d` is ON
in the local seed only). Registry **399 == 399** at last check; re-verify before trusting any catalog claim.

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

## 3. The ONE thing outstanding on S2

**The diff-scoped door sweep verdict for `app.can_write_document`.** Everything else is green.

- The gate **is** now covered by `341` block G (12 assertions; proven red under neutralization — exactly
  G9/G10/G11 fail, blocks P–F stay green).
- The sweep previously reported **`ERROR`**, and the cause is **not** this gate: **`329` aborts** under
  the neutralization, losing exactly 41 tests, because the unguarded raw statement at **`329:494`**
  errors *outside* any pgTAP wrapper once R1 succeeds. ⚠ **`341`'s old plan was also 41 — pure
  coincidence**, and that numeric collision produced a confident wrong diagnosis ("341 aborts") that two
  people adopted. **It is falsified. Do not re-adopt it.**
- A **guard for `329:494`** (the `340`-B7 `do $$ … exception when others …` idiom) was **tested**:
  `329` then runs 115/115 under neutralization, run shape preserved ⇒ `FAIL` ⇒ **COVERED**.
- **If the sweep verdict is not recorded below, it did not run.** Do not infer it.

⛔ **Before running that sweep, read §6 — the harness left an authz gate OPEN on the shared stack today.**

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
3. **`src/lib/queries/documents.ts:116,142`** do `.find(b => b.rendition_kind === 'source')` — a print-only
   version yields `undefined`, so `containsPhi`/`availability` derive from a **missing source**. Frontend's.
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

## 8. Teammates

All stood down. `backend` (the original) is **context-exhausted (~712k)** — spawn fresh, do not resume it.
`backend-assurance`, `frontend`, `tester` all hold useful context but the artifacts above are the record;
**a fresh team can resume from this document.**

⚠ **Shared local stack = one owner.** Two agents on one DB caused today's incident. Announce a reset
**before**, not after.
