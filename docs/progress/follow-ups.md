# Follow-ups — live detail (OPEN items)

Full bodies of **open** follow-ups, rotated out of PROGRESS.md 2026-08-08 to keep the
tracker small (CLAUDE.md §7). PROGRESS.md keeps a one-line index (id · severity · title ·
owner) — **update BOTH when an item changes state**. Resolved items move to
[follow-ups-archive.md](./follow-ups-archive.md), same as before; the parked backlog stays
in [deferred-backlog.md](./deferred-backlog.md).

### ⬛ Resolved — rotated 2026-08-13 (the DM2 Record step): **FUP-DM1-CEILING** (D15 ceiling, DM2·S1 + S4) · **FUP-DM1-E2E** (6+1 specs rewritten, DM2·S4) · **FUP-DM1-DISPOSE** (`dispose_case_phi` arm restored, DM2·S2) — each verified independently, not accepted from a report → [follow-ups-archive.md](./follow-ups-archive.md)

### 🔴 FUP-PGTAP-VACUOUS — `lint:vacuous` scans TS spec files ONLY; ~6000+ pgTAP assertions are entirely unscanned, and a live specimen was found (owner: lead + backend; a program-level audit, NOT a phase side quest)

Filed 2026-08-14 during DM4. **Found by `backend` while re-reading a suite it had to edit, and
lead-confirmed.**

**The live specimen** — `supabase/tests/197_phi_disposal_closure.sql` assertion **4.1**, inside a
**PHI-boundary suite**:

```sql
(select (j -> 'shared_items' -> 0 ->> 'frozen_storage_path') from meta_read) is null
```

If `shared_items` is an **empty array**, `-> 0` yields NULL, `->> 'field'` yields NULL, and
`is null` is **true**. The assertion passes **having asserted nothing** — and it has been doing so.
Nothing guards the array's non-emptiness. The DM4 successor adds a positive control
(`shared_items -> 0 ->> 'id' IS NOT NULL` in the same read) so the deny-half provably denies a row
that **exists**.

**Why this is 🔴 and program-level.** `npm run lint`'s fifth gate (`check-vacuous-assertions.mjs`)
exists precisely because "a test that can go GREEN having asserted nothing" already shipped here —
but its scope is **first-party TS** (`src/`, `e2e/`, `*.test.*`): **180 spec files scanned, 0
findings**. The pgTAP suites are **SQL and completely outside it**, against **~6152 assertions** as
of DM3. The JSON-path-on-a-possibly-empty-array shape is a *natural* way to write these, so one
confirmed instance is weak evidence for one instance.

⚠ **Scope discipline, deliberately recorded:** DM4 fixes **only** the instance in its own diff.
A repo-wide sweep is its own audit with its own ways of being wrong — and this project has the
scar: [[a-detector-that-finds-a-lot-needs-proving-too]] (a sweep reported 89; seven of its own bugs
were 56 of them). Any detector built here must be **dry-run against a hand-classified control** and
**proven able to fail** before its count is believed
([[detector-that-finds-nothing-must-be-proven-able-to-find-something]]).

### 🔴 FUP-DM5-STORAGE-ORPHANS — a DB reset wipes `storage.objects` but NOT the bytes, and the Storage API cannot see what it left behind (owner: lead + backend; blocks DM5 step 3)

Filed 2026-08-14 during DM4 planning. Found by `backend`, **independently reproduced by the lead**
on the local stack — empirical, not inferred.

**The measurement.** `storage.objects` held **0 rows** while the storage backend
(`STORAGE_BACKEND=file`, `/mnt`) held **663 files / 16.5 MB**, of which **162 are PHI-tier**
(`printed-documents/phi/*.pdf`, E2E residue). `supabase db reset --local` wipes the metadata and
**does not touch the bytes**.

**Why this is 🔴 and not a curiosity.** The Storage API **lists from `storage.objects`**. So
orphaned bytes are invisible **to the API as well as to SQL** — there is no supported read path
that sees them. DM5 step 3's method is: *"for each bucket, prove zero DB references + zero product
callers + zero policies, then empty + delete the bucket (Storage API only — never
`storage.objects` DML)."* Run after any reset, that procedure would **prove emptiness against a
truncated table, delete nothing, and report success** while PHI-tier bytes persist backend-side.
⭐ *An emptiness proof derived from a table that was just truncated is not an emptiness proof* —
the same shape as [[a-detector-that-finds-nothing-must-be-proven-able-to-find-something]].

**What DM5 must do instead:** enumerate at the **backend layer**, not the metadata layer — locally
the volume; remotely whatever the platform exposes for the S3 store — and reconcile that
enumeration against `storage.objects` in **both** directions before declaring a bucket empty.

**⚠ Remote behaviour is an INFERENCE, explicitly not verified.** Nobody has queried or inspected
the linked project. The remote reset is also a database-level reset and platform S3 bytes surviving
it is the same mechanism class, but that **must be verified at deploy time or via vendor docs, never
assumed from the local finding**. ⚠ Note the remote has never received DM1+, so its bytes include
the 2026-08-11 production census (45 objects) — **a remote reset would orphan all of them**, which
is a live input to [[FUP-DM4-PRODROW]]'s deploy decision, not a DM5-only concern.

---

**🟡 UPDATE 2026-08-14 — the METHOD half is RULED (ADR [0120](../decisions/0120-dm5-wave-d-retirement-decisions.md) D9); the REMOTE half stays open.**

Re-measured at the DM5 open on a HEAD stack: **`storage.objects` = 0 rows** against **699 objects /
7,023,687 bytes**, **198 PHI-tier** (`attachments-phi` 6, `documents-phi` 183,
`printed-documents/phi` 9); `list` returns `[]` for **all 12** buckets. Figures differ from the
663/16.5 MB/162 above because that was a different stack state — **both are real; neither
supersedes the other**, and the drift is itself the point.

**Ruled:** the plan's Storage-API emptiness method is **WITHDRAWN**, replaced by **manifest-first
deletion** — capture the authoritative key list *before* any destructive step, delete by key, assert
`deleted_count == manifest_count` per bucket. This converts an unfalsifiable negative into a
positive count comparison: a truncated table now yields a **visibly zero-length manifest** instead
of a silent pass. Backend-agnostic, so it transfers to Cloud; the local volume walk is the
**proof harness**, not the gate (it depends on `STORAGE_BACKEND=file`).

**⚠ Calibration the original filing lacks — it lowers the severity but not the priority.** The
orphans are **not servable**: a service-role `GET` on a known orphan key returns **400** and `sign`
returns **404 not_found**, because every read path resolves metadata first. So this is a
**data-at-rest / disposal-assertion** problem — Rule 12, LGPD erasure, the F-02 class — **not a live
exposure**. It is also *why* API-based enumeration fails by construction, so the calibration and the
method ruling are the same finding seen from two sides.

**Still open (do NOT read D9 as closing this):** on Cloud there may be **no customer-accessible tool
that can see an orphan** — dashboard, CLI and supabase-js all list from `storage.objects`, and the
S3 endpoint is **UNVERIFIED** (the local probe needs SigV4; the remote is off-limits under the
standing no-push directive). Also `scripts/document-reconciliation.mjs:58` covers only **2 of 12**
buckets and lists *from* `storage.objects`, so it cannot see this class either — widened in DM5 S0.

---

### 🟡 FUP-AUTHZ-ALLOWLIST-ROT — nothing validates that floor-allowlist entries name a LIVE door (owner: lead + backend; filed 2026-08-14, DM5 S2)

`supabase/tests/mutation/authz-neverclled-door-allowlist.txt` keys entries on the **full identity
signature**, and `p0-authz-invariant.sh:229` consumes it with
`comm -23 <(offenders) <(allow_body …)` — i.e. it **only ever subtracts**. Nothing checks that a
listed signature resolves to a function that exists.

**Live specimen:** line 41 names `add_referral_reply_attachment(...)`, which **DM4 dropped**
(`20260926000400`). Verified absent from `pg_proc` at HEAD.

⚠ **Calibrated, and this corrects the lead's first framing.** A stale entry is **inert, not
dangerous**: it can never match a live offender, so it masks nothing and fails nothing. The failure
mode is **legibility, not enforcement** — a human reading the file sees a door "accounted for" that
does not exist, and the entry's justification comment outlives the thing it justified.

⭐ **The signature-keying is otherwise a FEATURE, and DM5 S2 demonstrates why.** When `…000120`
drops `p_storage_path` from `add_capa_action_evidence`, line 37 stops matching the live door, which
then appears in `unlisted` ⇒ **FLOOR VIOLATED, RC=1** — **loud**, exactly as designed. So the
remedy for line 37 is to update it in the migration's own commit (planned), and the follow-up here
is only about the rot the mechanism cannot see.

**Proposed fix (not built):** a cheap assertion that every allowlist signature resolves in `pg_proc`,
run as part of `ARM=floor` — turning silent rot into the same loud failure the live half already
gets. ⚠ Prove it able to fail before trusting it: line 41 is a ready-made positive control.

### 🟡 FUP-DM5-GRANTS — `rca_evidence` / `capa_action_evidence` RPCs are NOT single doors (owner: backend; filed 2026-08-14 by ADR 0120)

Both tables carry **table-wide `arwdDxtm` grants to `authenticated`**, so a client can
`POST /rest/v1/rca_evidence` directly and never traverse `add_rca_evidence`.

**⚠ Calibrated — this is hardening, NOT an open door.** RLS *is* enabled on both, with genuinely
**distinct** read and write predicates — `app.can_read_event(app.event_of_rca(rca_id), auth.uid())`
for SELECT versus `app.can_write_rca(rca_id, auth.uid())` for the `FOR ALL` write policy — so this is
a real second lock, not [[a-door-can-have-two-locks]]'s same-predicate-twice trap. Verified against
`pg_class.relacl` and `pg_policies` directly, at the DM5 open. What direct DML bypasses is the
**RPC's flag gate and its fail-closed arms**, not row authorization.

**Binding on DM5 S2:** do not assume the RPC is the only writer when placing the `documents_wave_d`
assert (ADR 0120 D10). A flag gate that lives only in the RPC body is bypassable by exactly this
path — the DM3 QA MAJOR-1 shape, where the gate sat on the last step of a corridor rather than the
corridor. Note the parked CHECK `rca_evidence_cited_document_parked` **does** hold against direct
DML, being a table constraint; that is the third of the three locks and the reason the citation seam
is safe today.

### 🟠 FUP-DM4-RECUSAL — a RECUSED coordinator can freeze a case's PHI documents into a referral, around the exclusion perimeter (owner: lead + PO + backend; **deadline = the `documents_wave_c` flag-on date**)

Filed 2026-08-14 at DM4 QA r1 (**MAJOR-3**). **Found by `qa`, demonstrated LIVE** in a rolled-back
transaction — not inferred from reading code.

**The gap.** `add_referral_shared_item` checks referral-**source** authority
(`can_manage_referral_source`) but **never `can_read_case` or `can_read_document`**. So for one
user and one case, simultaneously:

```
can_read_case(caseA, u)                     = false      ← recused / excluded
can_manage_referral_source(ref on caseA, u) = true
can_read_referral_phi(ref on caseA, u)      = true        ← reaches the PHI bytes
```

A coordinator **recused** under the ADR-0072 / ETH·E1 exclusion perimeter can therefore freeze that
case's PHI documents into a referral and read them through the referral corridor. ⚠ **Two
authorization planes that were each individually correct**: ADR 0119 **D4** reasoned about exactly
this seam for the D15 **clearance** plane and never considered the **case-capability** plane.
Same shape as [[exclusion-only-as-strong-as-weakest-mutator]] — the excluded party reaches the
content by a route the exclusion never modelled.

**PO ruling 2026-08-14: DEFER to the Phase 19 access plane** (ADR 0114 Amdt 1 **D16**, which must
cover **both widening and narrowing**). Legitimate: not P0 because `documents_wave_c` **ships OFF**,
so the path is unreachable in production today. The other options offered and not taken were fixing
it inside DM4 with a keystone + negative twin, or ratifying source-authority-is-enough in ADR 0119.

⛔ **QA's standing caveat, binding on how this may close.** This is an open **security** obligation,
not a backlog item, and **its deadline is the flag-on date, not Phase 19's delivery date**. It must
**never** be absorbed into *"Phase 19 delivered an access plane"* — **a plane that only WIDENS would
not close it.** Closure requires a **narrowing** arm that refuses a recused coordinator at the
freeze door, **proven by a negative twin**, and the FUP is closed only against that evidence.

⚠ **Before `documents_wave_c` is ever enabled in production, this must be resolved or explicitly
re-ratified by the PO.** Name it in Phase 19's scope in
[accreditation-track.md](../phases/accreditation-track.md) so D16 cannot land without meeting it.

### 🟡 FUP-DM4-PRODROW — reconcile the dangling frozen PRODUCTION snapshot row at the push/deploy step, not during DM4 (owner: lead + backend)

Filed 2026-08-14 at DM4 open, as the recorded half of **PO ruling R2**.

The parent plan's DM4 step 2 requires that "the 1 dangling frozen production row is reconciled
(re-freeze or explicit tombstone)". **DM4 does not do this.** At phase open, `main` sat **136
commits ahead of `origin/main`** with nothing pushed and no `db push` — reconciling production
then would move the DB ahead of the code that understands it, while the standing PO directive
still forbids pushes.

**What DM4 DOES owe:** build and prove the reconciliation path **locally**, so that the
production step is an execution, not a design exercise.

**What is deferred here**, from the 2026-08-11 production census (⚠ **stale by design — re-census
before acting, never act on these figures**): 45 objects / ~0.5 MB · `attachments*` EMPTY ·
**4 dangling attachment rows** · **3 controlled-doc objects unreferenced** · **1 dangling frozen
referral path**. Note DM3's own scope carried a related discrepancy — prod had **3 objects but 0
version rows** — with the standing instruction to *reconcile or quarantine explicitly, never
invent success*. The same instruction binds here.

⛔ **Do not query or mutate the linked project to close this while the no-push directive stands.**
Closing it requires: the DM stack pushed, `db push` run, a fresh census, then an explicit
re-freeze-or-tombstone decision per row, recorded.

**⚠ AMENDED 2026-08-14 — a second, much cheaper closure path exists.** The PO confirms **a full
database reset is available on the REMOTE as well as locally (no active users)** — the standing
pre-launch posture ([[prelaunch-db-reset-ok]]: design the correct schema rather than back-compat
migrations). A remote reset removes the dangling row outright, so the per-row
re-freeze-or-tombstone decision above **may never need to be made**. Both paths stay open; the
choice belongs to the deploy step, not to DM4.

⚠ **Do NOT let this delete DM4's guards.** M3's dead-pointer null and M4's raising `DROP TABLE`
guard are correct **independent of the deploy strategy** — M3's is *semantics, not repair* (the
sibling FK is `ON DELETE SET NULL`), and M4's value was never "prod probably has rows" but "if
rows exist, an unmodeled writer exists." A reset makes them near-unreachable, which costs nothing.
A guard removed because one deploy strategy makes it moot is a guard missing when that strategy
changes.

🔶 **OPEN, and it is DM5's problem rather than DM4's — flagged early because it is cheap to know
now:** a DB reset wipes `storage.objects` **metadata**, but it is **not established** that it
removes the underlying **bytes**. If it does not, a remote reset leaves orphaned objects with no
metadata rows — which would quietly undermine **DM5's retirement manifest**, whose method is
"prove zero DB references + zero product callers + zero policies, then empty and delete the bucket
**via the Storage API only, never `storage.objects` DML**". *An emptiness proof derived from a
table that was just truncated is not an emptiness proof.* Verify before DM5 relies on it.

### 🟡 FUP-LINT-STALE-SYMBOL-COMMENT — propose a 6th lint gate: a comment naming an identifier that no longer exists (owner: lead + PO; a gate change is not a mid-phase edit)

Filed 2026-08-13 during DM3. Every one of the five gates in `npm run lint` was added **after**
its class shipped a live defect (CLAUDE.md §8). This class qualifies twice over: **~6 instances
in DM3 alone**, plus 4 historically, **one of which shipped a live bug**.

**The class.** A deletion strands every comment that referenced it, and **no gate sees any of
them** — not typecheck, not eslint, not the four custom gates. Worst DM3 specimen:
`supersedeDocument`'s doc comment telling the frontend to upload *"via `addDocumentVersion`"* —
**a deleted verb, named in the documentation of a verb the frontend actively calls**. Others:
a page header claiming the storage SELECT policy carried the approver arm (false since M5 —
different provenance, a *migration* rather than a deletion, same class), and a module header
still advertising the signed-URL byte path M5 deleted.

⚠ **The design tension that must be resolved BEFORE the gate is built — raised by `frontend`,
ruled by the lead 2026-08-13.** Four comments in `src/app` + `src/components` deliberately
name a dead symbol **as dead** ("`reviseChangesRequestedDocument` is gone"), which a naive
implementation would flag as false positives:

- `…/documentos/novo/page.tsx:40` · `…/nova-versao/page.tsx:27` · `…/revisar/page.tsx:33` ·
  `components/controlled-documents/add-version-form.tsx:52`

**RULING: tombstones are legitimate and stay.** A reader who remembers `supersedeAndSubmitDocument`
and finds **silence** concludes they are in the wrong file; one who finds *"it is gone, and here
is what replaced it"* is served. Deleting that information to satisfy a gate would make the
codebase worse in order to make a check pass — the gate exists to serve the reader, not the
reverse.

**Therefore the gate's spec must include a machine-checkable tombstone convention** (an explicit
marker token adjacent to the symbol, e.g. `@removed`), so a deliberate tombstone is
distinguishable from a stale claim **without natural-language guessing**. Settle the exact token
when the gate is built. ⛔ **Do not churn the sites now** for a gate that does not yet exist — a
mid-phase rewrite for a hypothetical checker is cost with no coverage.

**The tombstone population is SEVEN, and how it was established is the lesson.** Three
successive lists (backend 6, frontend 3, lead 4) were each short, and **none was careless** —
each was bounded by a different *unstated enumeration key*: "comments my deletion broke" / "the
composite verbs" / "verbs + the RPC". `frontend` finally derived it **by construction** — the
removal set from `git diff 5310358..HEAD -- src/lib` ∪ the `drop function|policy|column`
statements in the DM3 migrations (**12 symbols**), swept across `src/app` + `src/components`:
`novo/page.tsx:40` · `nova-versao/page.tsx:27` · `revisar/page.tsx:33` ·
`add-version-form.tsx:52` · `version-compare-modal.tsx:23` ·
`documentos-pendentes/[documentId]/page.tsx:43` · `open-controlled-version-button.tsx:20`.
**A population is only well-defined once its key is stated**, and recall is keyed to whatever
you were last looking at ([[enumeration-boundary-is-a-syntax-not-a-property]], three times in
one thread).

### ⛔ The gate CANNOT be keyed on identifier names — three live families prove it

Lead sweep of all 12 removed symbols, 2026-08-13. Every hit below is **live, correct code** that
a name-keyed gate would flag, and where the tempting "fix" edits a subsystem the rule has no
business touching:

1. ⭐ **`uploadDocumentFile` is simultaneously REMOVED and LIVE.** DM3 deleted a *private*
   `async function uploadDocumentFile` from `src/lib/controlled-documents/actions.ts`, while
   **`src/lib/documents/upload-client.ts:13` exports a live one** — imported and called by
   `add-version-form.tsx:12,144`, `create-wizard.tsx:27,436` and
   `documents/document-upload-dialog.tsx:18,216`. **This is decisive: a bare identifier is not a
   key at all**, independent of scoping-by-family. A name-keyed gate would flag three live call
   sites of a live function.
2. **printed-documents (ADR 0104, retires DM5/Wave D)** — `src/app/api/documents/[id]/route.ts:46`
   `.download(row.storage_path)`, downloading from the **`printed-documents`** bucket. A
   different table's column that DM3 never dropped, under a URL that *reads* in-scope. Plan §1.2
   named this exact hazard (two families sharing the `document` noun) and §1.3 warns the route's
   URL is misleading while its body is not.
3. **form-assets (ratified permanently separate, ADR 0114 D13)** — `storage_path` in
   `components/forms/block-card.tsx:91,478` · `block-list.tsx:53` · `item-editor-dialog.tsx:281` ·
   `read-only-blocks.tsx:52`.

**Spec consequences (binding on whoever builds it):** resolve each symbol to its **owning module
and family**, never its name; and the first dry-run must run against a **hand-classified
control** containing all three families above as known-goods — *a detector that finds a lot needs
proving too* ([[a-detector-that-finds-a-lot-needs-proving-too]]).

### 🔻 LEAD RECOMMENDATION 2026-08-13: **do NOT build the gate.** Adopt the convention; keep the process step

Four findings, in order of how much they cost the idea:

1. **The same identifier holds THREE truth values inside ONE file.** Verified in
   `src/lib/controlled-documents/actions.ts`: **`:119`** tombstone · **`:309` LIVE and
   correct** (it names the live export *and its module*, `@/lib/documents/upload-client`) ·
   **`:693`** tombstone. So **file scoping fails too**, not just name-keying. Classification
   must be **per-occurrence**, and `:309` is separable from `:119` only by **adjacent prose** —
   natural-language disambiguation, not resolution. It is also the occurrence a gate most needs
   to get right: flagging it invites deleting the sentence that tells the next reader where the
   live helper lives.
2. **Module resolution reaches only 3 of the 7 tombstones (43%).** Sites 1–3 are TS module
   bindings; site 4 names a **Postgres function + column**, site 5 a **TS property** (`hasFile`
   — never a module binding), sites 6–7 a **Postgres policy**. The misses need two *further*
   resolvers: a type-level property resolver and a catalog lookup.
3. **The DB arm needs a RUNNING DATABASE, and that is not negotiable.** The standing rule is
   that the **live catalog is the sole truth** for any schema/RLS/RPC question — never migration
   text, which is stale by design (runtime `pg_get_functiondef()` + `replace()` + `execute`), and
   which has already produced a confident **false P0** here. So the arm must query `pg_proc` /
   `pg_policies`. All five current `npm run lint` gates are **stateless static checks that run in
   a fresh worktree with no stack up**; a DB-dependent arm changes what the lint gate *is*, and
   the shared-stack constraint makes it worse.
4. ⚠ **The proposed convention-only gate does NOT work as specified**, and the error is
   instructive. `frontend` suggested checking that *"mentions of removal-set symbols carry the
   marker"*, arguing it would leave `actions.ts:309` alone *"because a live reference wouldn't
   carry the marker."* That exemption is **inverted**: `uploadDocumentFile` **is** in the removal
   set, so `:309` mentioning it **without** a marker is precisely what the rule flags. Rescuable
   with per-occurrence suppression — but the authoring burden then lands exactly on the most
   confusing case. **Also fatal to the "it's just a grep" claim:** the rule needs a *removal set*,
   which needs a **diff base** — making it a CI check, not a stateless lint gate.

**Recommendation (PO decides — it is a lint-gate change):** adopt the tombstone marker as an
**authoring convention** (zero cost, helps every reader) and **do not build a checker**. Rely on
the step that actually worked here: **at deletion time, derive the removal set from the diff
(`git diff <base>..HEAD -- src/lib` ∪ the migrations' `drop function|policy|column` statements)
and sweep it.** That is what found all seven; three prior lists built from recall found 6, 3 and
4, each bounded by a different unstated key. **Encode it as a deletion-discipline step, not a
script** — the knowledge lives with whoever removes the symbol, and no resolver reproduces it.

**If the PO still wants a checker**, it must satisfy all of: per-occurrence classification ·
family/module resolution · a catalog arm · a diff base · and a first dry-run against a
**hand-classified control** containing `actions.ts:309`, `api/documents/[id]/route.ts:46` and the
`components/forms/*` hits as **known-goods** — *a detector that finds a lot needs proving too*
([[a-detector-that-finds-a-lot-needs-proving-too]],
[[detector-that-finds-nothing-must-be-proven-able-to-find-something]]).

### 🟡 FUP-PGTAP-SAVEPOINT — ⚠ **DOWNGRADED 2026-08-13 (🔴→🟡): the original claim was WRONG. No coverage is being lost** (owner: lead + backend)

> ## ⛔ CORRECTION — read this before the original text below
>
> **Measured on a clean reset (the run this follow-up demanded): `193` → `ok`, `194` → `ok`,
> ZERO bad plans across 190 files / 6149 tests, `Result: PASS`.** The two "affected" suites are
> **not** losing assertions.
>
> **The true mechanism**, pinned by a two-assertion repro (one outside the savepoint, one inside):
> ```
> plan(2); ok(true,'A'); savepoint s; throws_ok(…,'B'); rollback to savepoint s; finish();
>   → ok 1 - A          ← emitted to stdout
>   → ok 2 - B          ← ALSO emitted; TAP output cannot be rolled back
>   → # Looks like you planned 2 tests but ran 1
> ```
> **pg_prove parses the TAP stream, not pgTAP's internal table.** Both `ok` lines are emitted at
> statement execution and survive the rollback, so **the gate's tally is correct and the
> assertion does count**. Only pgTAP's *internal* counter under-counts, producing a `#`
> **diagnostic** that pg_prove does not treat as a failure.
>
> **What IS real:** the **degenerate** case — when *every* assertion in the file sits inside the
> rolled-back region, `finish()` raises `# No tests run!`, which **does** fail the file.
>
> ⚠ **My error, recorded because it is the more useful part: I generalized from the degenerate
> case.** The original repro was `plan(1)` with its single assertion inside the savepoint — the
> one shape where the internal under-count reaches zero and becomes an error. I proved that shape
> and then asserted the general one, filing a 🔴 gate-integrity item on a mechanism I had not
> tested in the configuration the live suites actually use.
> [[the-proposal-you-author-is-the-one-you-dont-test]], again, and this time it was mine.
>
> **Residual value (why this stays open at 🟡, not closed):** the `finish()` diagnostic is
> genuinely misleading to anyone reading it, and the degenerate shape is a real hazard worth not
> writing. `330`'s captured-definition pattern remains the better style. But **nothing is
> uncovered and no prior gate record is invalidated** — the earlier `194` "planned 8 but ran 0"
> was the dirty-DB artifact, exactly as `backend` suspected and declined to attribute.
>
> The original text below is retained as written, so the correction is legible as a correction.

### (original filing, superseded above) a pgTAP assertion inside a rolled-back savepoint PRINTS `ok` but is DISCARDED from the tally; 2 live suites use the shape

Found by `backend` during DM3·M2 (2026-08-13) and **independently reproduced by the lead
the same day**, twice, against the live DB.

**The mechanism, proven — not inferred.** With `pgtap` installed, two runs differing only
in the savepoint:

```
RUN A:  plan(1); savepoint s; select throws_ok($$ select 1/0 $$,'22012'); rollback to savepoint s; select * from finish();
        → prints  "ok 1 - threw 22012"   then  ERROR: # No tests run!
RUN B:  plan(1); select throws_ok($$ select 1/0 $$,'22012'); select * from finish();
        → prints  "ok 1 - threw 22012"   then  finish() returns 0 rows (clean)
```

pgTAP keeps its results in transaction-local state, so `rollback to savepoint` unwinds its
own bookkeeping along with the mutation. **The assertion still prints `ok`.** The file then
reports `planned N but ran <N`, which a summary line can hide — this is the pgTAP twin of
the class `lint:vacuous` gates for TypeScript, and there is **no equivalent gate for SQL**.

**Live instances — a lead sweep of `supabase/tests/` found the shape in 4 files:**

| File | Verdict |
| --- | --- |
| `193_schema_integrity.sql:89-99` | ⚠ **AFFECTED** — `throws_ok` at `:93` sits inside the window. **Missed by the original report, which flagged only 194.** The enclosed assertion is a *mutation twin* (drop the twin CHECK, assert the refusal still holds) — the kind whose silent non-counting matters most, because its whole job is to prove a barrier is independent |
| `194_tenant_composite_fk.sql:87-95` | ⚠ **AFFECTED** — `throws_ok` at `:89` inside the window (its test 4.1) |
| `330_dm3_controlled_documents.sql` | ✅ **CLEAN** — its 3 hits are *comments documenting the hazard*; the suite mutates without a savepoint and restores from a **captured** `pg_get_constraintdef`, so the restore cannot drift from the real definition |
| `100_dashboard.sql:411-412` | ✅ clean — **and it already carried the explanation**: *"⛔ Deliberately NOT a savepoint. pgTAP keeps its test counter in transaction-local state, so `rollback to savepoint` after an `is()` would rewind the counter."* |

**The most useful part of this finding is that last row.** The hazard was **already known and
already written down** — as a comment in one file, where it protected that file and nothing
else. Two other suites then shipped the shape. Knowledge that lives only in a local comment
does not propagate; that is what `lint:vacuous` and the keystone discipline exist to fix, and
this class had neither. Related: [a comment is an assertion that goes stale silently].

**What is NOT yet established.** The per-suite blast radius. `194` was observed reporting
`planned 8 but ran 0` on a **dirty** local DB, and that is *not* attributed to this mechanism —
`194` is a tenant/commission-count suite and the stack carried E2E leftovers, a known
spurious-red class. The suites cannot be run raw (`test_helpers` is harness-created), so the
real numbers come from `npm run test:db` on a **fresh `supabase db reset`**.

**Discharge:**
1. On a fresh reset, capture `planned N / ran M` for `193` and `194`; if `M < N`, those
   assertions have never contributed to any gate record, and the affected keystones' prior
   green must be re-read as unproven.
2. Rewrite both to `330`'s pattern — mutate without a savepoint, restore from a captured
   definition, and keep the file-level `rollback` as the outer restore.
3. **Add the missing gate.** A `lint:vacuous`-style check for pgTAP: flag any assertion
   between `savepoint` and `rollback to savepoint`, and/or assert `planned == ran` per file
   rather than trusting the summary. Without step 3 this recurs — it already did, twice,
   after being documented once.

### 🟡 FUP-DM3-ETHICS-UI — no UI can attach a decision letter to an ethics case; DM3 ships both seams writable via the API only (owner: PO, a feature phase)

Filed 2026-08-13 at DM3 open, as the recorded half of a PO scope ruling. **This is a
decision, not an omission** — a later reader finding two write-only columns must land here
rather than infer neglect.

**What DM3 does ship** (ADR 0114 Amendment 2 / D17, conditions 1–5): both
`ethics_decision_details.decision_letter_document_id` and
`ethics_notifications.related_document_id` get a real FK to `documents(id)`;
`issue_ethics_notification`'s fail-closed rejection is removed and keystone K8 with it;
and `set_ethics_decision_details` gains `p_decision_letter_document_id`, forwarded from
`src/lib/ethics/actions.ts`. After DM3 the seams are genuinely writable document-model
citizens **through the API**.

**What it does not ship, and why.** No attach-a-letter affordance. None has ever existed —
verified 2026-08-13 on five independent lines: no writer passes either field (the only
callers are `ethics-decisions-panel.tsx`'s 10-key payload and
`ethics-notifications-panel.tsx`'s 5-key payload); no form control exists in either dialog;
`type="file"` appears in 7 components repo-wide and **none** under `src/components/ethics/`;
nothing in `src/` *reads* either field off a value, so even a populated column would change
no pixel; and `e2e/ethics-e2-procedure.spec.ts:55-56` already declares the Stage-E
legal-privileged decision letter unbuilt.

A decision letter is the **archetypal `legal_privileged` document**. Its UI is therefore not
a form field — it needs the ADR 0072 / ETH·E1 access spine (`case_access_grants` +
`max_confidentiality` + recusal), the D15 confidentiality ceiling, and E2E coverage that
does not exist today. Appending that to a migration wave is how the most security-sensitive
surface in the phase gets the least design attention.

**Discharge = a feature phase that designs the affordance against the ETH·E1 spine**, with
its own threat model and E2E. Until then the columns are write-only by design.

### 🟡 FUP-ETH-KBD-1 — the professional lane's `TypeaheadField` mount is keyboard-UNTESTED, so BUG-ETHE4-FOCUS-1's defect is not ruled out there (owner: frontend + tester)

Carried out of **BUG-ETHE4-FOCUS-1** when that bug was rotated to
[bug-log-archive.md](./bug-log-archive.md) on 2026-08-12. It was filed inside the bug as *"not
confirmed, flagged as a hypothesis for whoever fixes it"*; archiving it under the bug's ✅ would
have converted an open question into an apparent closure.

**The gap.** `TypeaheadField` is shared by three mounts — "Buscar profissional", "Buscar
participante externo", "Usuário da plataforma". The FOCUS-1 fix (defer `setOpen(false)` one tick +
`suppressEscapeWhilePopupOpen`) was applied at the component root and all three mounts were
tab-counted after the fix, so this is **not** a suspected live regression. What is untested is the
*pre-fix* question the bug never answered: `PROF-PICK` / `PROF-CREATE` drive the professional lane
**by mouse only**, so no spec has ever keyboard-navigated it end-to-end. There is no KBD-1
equivalent guarding that lane against a future reintroduction.

**Why it is worth an item rather than a shrug.** QA's **m8** found *both* FOCUS-1 root causes
(synchronous `onBlur={settle}` at `evidence-picker.tsx:437`, no `onEscapeKeyDown` suppressor) in a
second, unrelated dialog — flagged structurally, never verified live. The pattern recurs in places
nobody has keyboard-tested; the mouse-only coverage is how it stays invisible.

**Disposition (cheap):** extend the professional lane with a KBD-1-shaped assertion — tab-stop
count plus Escape-does-not-reset-the-lane — and decide separately whether `evidence-picker.tsx`
gets the same treatment. Needs a tester-owned spec change; note FUP-ETH-A11Y-1's m4 warning that
these routes collide with `pickFromTypeahead`'s locators, so the two items should be scheduled
together.

### 🟡 FUP-ETH-A11Y-1 — the ETH·E4 dialogs: error text is never `aria-describedby`-wired, and the typeahead announces neither loading nor result count (QA m3 + m4; owner: frontend + tester)

> ✅ **BUILT in the working tree 2026-08-12 (`frontend`) — NOT committed. Awaiting the tester
> batch.** m3: both files now pass `hasError`/`hasDescription` into `useFieldIds`, spread
> `controlProps`, and put `id={errorId}` / `id={descriptionId}` on `FieldError` /
> `FieldDescription`; the checkbox-GROUP error in `case-participant-role-manager.tsx` hangs off
> the `<fieldset>`'s own `aria-describedby` (a 3rd site QA's count of 2 did not include).
> Verified live by submitting an empty "Novo papel": every emitted `aria-describedby` resolves to
> a real `role="alert"` node carrying the pt-BR message.
> **m4 route chosen: (a) a separate `sr-only` `role="status" aria-live="polite"` region, worded
> so it duplicates NO visible string** — the listbox's `aria-label` (`Opções para {label}`), which
> `pickFromTypeahead` scopes on, is byte-for-byte unchanged, and route (b) was rejected for that
> reason. New strings, all `sr-only` and all previously absent from the DOM:
> `"Carregando resultados…"` · `"1 opção disponível. Use as setas para navegar e Enter para
> escolher."` / `"{n} opções disponíveis. …"` · `"Nenhuma opção disponível."`. The error path
> announces nothing (the visible message already carries `role="alert"`), and a query below the
> 2-character floor announces nothing (a `null` `emptyAnnouncement`), so no claim is made about a
> search that never ran. Verified live: `"Nenhum resultado. Você pode cadastrar um novo."`,
> `"Digite ao menos 2 letras para buscar."` and `"Buscando…"` each still match exactly ONCE.

**m3 — `aria-describedby` never reaches the error id.** `useFieldIds`
(`src/components/ui/field.tsx:103-133`) already emits `descriptionId`, `errorId` and a
composed `aria-describedby`, but every ETH·E4 call site passes only `.controlProps.id` and
hand-sets `aria-invalid`: `add-participant-dialog.tsx` (2 sites) and
`case-participant-role-manager.tsx` (2 sites, one of which wires `descriptionId` but never
`errorId`). `FieldError` carries `role="alert"`, so the message **is** announced when it
first appears — the gap is that a user who tabs **back** to the invalid field hears the label
and nothing else. CLAUDE.md §8 requires accessible inputs.
Fix shape: pass `hasError`/`hasDescription` into `useFieldIds`, spread `controlProps` instead
of picking `.id`, and put `id={errorId}` on `FieldError` / `id={descriptionId}` on
`FieldDescription` (neither auto-wires — both are plain `<p>` pass-throughs).

**m4 — the typeahead popup has no live region.** `add-participant-dialog.tsx:391-407`:
*"Buscando…"*, the empty hint and the result list are plain nodes **outside** the listbox
that `aria-controls` points at, with no `aria-live`/`role="status"`. Only the error path is
announced (it has `role="alert"`). Keyboard operation and the rest of the ARIA structure are
complete and correct.

⚠ **Why this was filed rather than fixed inside ETH·E4 (lead, 2026-08-11).** m4 cannot be
closed without either (a) new visually-hidden text, which risks duplicating the existing
visible strings — `"Nenhum resultado. Você pode cadastrar um novo."` and `"Buscando…"` — into
a second `getByText` match and redding the suite on strict mode, or (b) folding the count into
the listbox's `aria-label`, which is the exact string `pickFromTypeahead` scopes on (QA r2
confirmed the app really does set it). **Either route needs a coordinated spec change, which
is tester-owned**, so doing it as a lead edit at the tail of the gate would have put churn
into the locators this phase had just finished stabilizing. m3 is attribute-only and safe on
its own, but it belongs with m4 as one a11y pass. Both are QA-rated MINOR and non-blocking.

### 🟡 FUP-E2E-SERVER-DEAD-1 — the prod-standalone server dies under load in ~3 of 17 batches, and `BATCH_TESTS=22` is the known rescue (owner: unassigned)

Filed from the ETH·E4 handoff §3, where it was called out but never given an id. In one
`e2e:prod` run, batches **5, 16 and 17 all hit `server_dead=1`**; 5 and 17 recovered on the
automatic `INFRA_RETRY`, **16's retry died too**, leaving 69 tests with no verdict and turning
a run with **zero assertion failures** into a RED gate. The rate is drifting: 1 of 17 earlier
the same day, 3 of 17 by evening.

Known-good workaround, used successfully **twice** on two different dead groups: re-run the
group alone at `BATCH_TESTS=22` (smaller batches ⇒ more frequent server restarts). The
Flexible-Forms group (`ff1`–`ff5` + `flagged-aggregate-result`) stresses it regardless of
batching — its own sub-batches hit `server_dead` and recovered.

**This is an infrastructure characteristic, not a product defect** — no assertion has ever
failed in one of these batches. It is filed because it costs a full gate re-run each time it
bites, and because "infra is not a pass": a batch that never produced a verdict must not be
read as green.
### 🟡 FUP-ACT-HATLESS-AUDIT — a hatless read's audit row omits the `acting_as` KEY, and absence has three meanings (S4 QA MINOR-6; owner: backend)

Catalog-verified in `app.audit_write`:

```
v_acting_as := app.active_role();
if v_acting_as is not null then
  v_metadata := v_metadata || jsonb_build_object('acting_as', v_acting_as);
end if;
```

The key is **absent, not null**. So for the hatless-grantee path — which under ADR 0106 D5/D6
as built retains read-only per-case reach **including `read_standard_phi`** (keystone `319`
A13; the Rule-12 read this platform most needs to reconstruct later) — the trail cannot
distinguish *"no hat was worn"* from *"pre-ACT row"* from *"written by a service-role/system
path"*.

**Not a violation and not blocking:** Rule 11 is met (the row records *that* and *who*;
`acting_as` is an ADR 0106 addition, not a Rule 11 requirement). This is **legibility** —
recording hatlessness explicitly (`'acting_as','none'`, or a `hatless: true` marker) turns an
inference into a fact for a few characters.

⚠ **Travels with the A13 ruling** (ADR 0106 D5/D14, S4 QA §3): if the PO ever rules that
hatless principals must lose relationship-derived reach, this class of row stops existing and
the follow-up dies with it. Do not implement it ahead of that ruling. Needs a migration —
deliberately out of S4, which shipped none.

### 🟡 FUP-PDF-4 — verification rate limiter: comment FIXED, availability lever still OPEN and re-scoped (QA P1 MINOR-3; owner: backend)

⛔ **The filed premise was wrong in a way that mattered, corrected 2026-08-11 against the code.**
The entry said the limiter is *"one **global** 60/min counter"* and prescribed *"per-credential
granularity (keep the global cap as a backstop)"* — **that is already exactly what ships, and
has since the original commit `e1daba9`**: `PER_CREDENTIAL_LIMIT = 5` over a `perCredentialHits`
map, plus the global 60 backstop. Anyone executing the prescription literally would have written
a no-op and closed the item. The lesson is the standing one: **a prescription in a follow-up is a
claim about the code and ages like one** — re-measure before implementing, not after.

**DONE:** the false *"the page shows it verbatim"* comment is corrected. Confirmed against
`src/app/(public)/verificar/[token]/page.tsx:84-90`, which catches **every** error, logs it, and
returns `{ state: "unavailable" }` — so `VERIFICATION_RATE_LIMIT_MESSAGE` is never rendered and
reaches only the server log. (The comment-asserting-an-untruth family, invisible to every gate.)

**STILL OPEN — the availability lever, correctly described:** the per-credential arm bounds
brute-forcing ONE code; it does nothing about the actual DoS. One visitor cycling ~12 distinct
credentials × 5 each exhausts the **global** 60/min budget and throttles *every* anonymous
visitor on the public `/verificar` surface. Both windows are also module-level process memory, so
they are per-PROCESS — N app instances mean N× every budget.

⚠ **Deliberately not fixed in the FUP quick batch, because neither half is guessable:** closing
it needs per-**client** granularity (which needs a *trusted* client identity — `x-forwarded-for`
is only as trustworthy as the proxy in front of it, a Coolify deploy decision, ADR 0059) **plus**
shared cross-process state. Both are decisions, not code. The limitation is now recorded in the
module docblock so the next reader does not re-derive it. The RPC stays service_role-only.

### ⬛ FUP-QOB-3 — RESOLVED 2026-08-09: `dispose_event_phi` KEEPS its tenancy arm, and referral disposal gets the same backstop BACK (PO)

**PO ruling 2026-08-09.** The finding was framed as "event is the odd one out" — investigating it
inverted that: **event was the one that got it right**, and the same-day BUG-QOB-004 cut had gone
one step too far on the referral plane.

**Two facts decided it, neither available when BUG-QOB-004 was ruled:**
1. **A hospital can have ZERO NSP operators.** Measured: `Hospital Unico C` has none, and NSP
   staffing is a separate onboarding step. NSP-only disposal leaves such a hospital unable to
   honour an **LGPD Art. 18 erasure request** — an obligation that sits with the ORGANIZATION
   (the *controlador*), not with a clinical nurse.
2. **This platform already rules the other way for acts of this shape.** ADR 0104 D11 keeps the
   tenancy arm on `revoke_printed_document` because revocation is a **governance act that reveals
   no content** — guarded by pgTAP `314` 8.5. Disposal is identical in shape: it discloses
   nothing, it destroys. D5's "zero PHI bits must not destroy Rule 12 data" guards against
   destroying what you cannot verify; that is a real concern, and it is the same one D11 already
   weighed and answered.

**Executed (`20260917000400`):** the tenancy arm is restored on `dispose_referral_phi` +
`can_dispose_referral_phi`. **`create_referral_draft` stays CUT** and the **UI wall stays** — the
backstop is disposal-only. ⚠ For a BARE tenancy admin the capability is therefore reachable only
out-of-band; that is deliberate and recorded, unlike BUG-QOB-004's accidental orphan. A tenancy
admin who is also a committee member reaches it normally.

**Guarded so it cannot be re-cut by symmetry:** `314` **8.6** (all three disposal doors keep the
arm) + **8.7** (drafting stays cut) + `295` **§7.7** flipped to assert the backstop behaviourally.
Red-proven: re-cutting the arm reds both 7.7 and 8.6 and nothing else.

**Also fixed in the same wave — three stale pt-BR messages, one per direction:**
`dispose_referral_phi` (fixed in `…000000`, re-fixed here), `dispose_case_phi` (**promised** an
org-admin arm QO·B had removed) and `revoke_printed_document` (**hid** the tenancy arm it carries).
⚠ The class: *every* time an arm moved, its sentence stayed. Invisible to every gate in the repo —
no test reads prose — and user-facing in both harmful directions.

Found by the **sibling-coherence check** run immediately after `20260917000000` landed — i.e. by
asking "what do this door's siblings look like now", not by anything in the ruling's own scope.
Measured live (`pg_get_functiondef`), all six disposal doors:

| Door | tenancy arm | PHI module (Rule 12) |
| ---- | ----------- | -------------------- |
| `dispose_case_phi` | ✗ cut (D5) | case |
| `dispose_referral_phi` / `can_dispose_referral_phi` | ✗ cut 2026-08-09 | referral |
| `dispose_attachment_phi` | ✗ none | — |
| **`dispose_event_phi`** | ✅ **LIVE** | **patient-safety / NSP** |
| `dispose_meeting_minutes` | ✅ live | not a PHI module |

**The finding:** D5's ratified reasoning — *"a principal with zero PHI bits does not destroy Rule 12
data"* — is what put `dispose_case_phi` on the CUT side, and it is what the PO applied verbatim to
the referral plane on 2026-08-09. It applies to `dispose_event_phi` **identically**: patient-safety
is PHI module 1, and a bare tenancy admin holds no PHI bits there either. So of the three Rule-12
modules, two now deny the tenancy tier its disposal arm and one still grants it — a split produced
by the order the rulings happened in, not by any decision about NSP.

**Corroborating tell:** `dispose_event_phi` still carries the pt-BR message *"apenas um administrador
da organização ou o NSP pode descartar dados do paciente"* — the exact sentence
`dispose_referral_phi` had to shed in the same wave because the cut made it false. It is currently
still TRUE for `dispose_event_phi`, which is the point: the two doors were written as a pair and have
now diverged.

⚠ **Deliberately NOT acted on.** It is outside the BUG-QOB-004 ruling, and cutting a live capability
unasked is the standing trap in the other direction — *conferring or removing a capability requires
enumerating its consumers*. `dispose_meeting_minutes` is a separate question and probably a genuine
KEEP (meeting minutes are a governance artifact, not one of the three PHI modules) — do not sweep it
in reflexively with the NSP call.

**To close:** a PO ruling on `dispose_event_phi` only — CUT (D5 consistency across all three PHI
modules) or KEEP-with-a-recorded-reason (NSP disposal is genuinely a tenancy-tier duty). Whichever
way, the pt-BR message must end up matching the arms. Owner: **PO**, then backend.

### ▶ FUP-MIN-CUTOVER — audio-minutes pre-enable gates (feature merged, flag OFF)

Owner: lead + human. Before the pilot flag flips (runbook §6 checklist is authoritative):
- [x] **Remote `db push`** — ✅ DONE (discovered already applied; catalog-verified 2026-08-06:
      302/302 migrations incl. AFF `20260909*` + MIN `20260910000100–400`, all 13 MIN functions
      in remote `pg_proc` with expected `prosecdef`, `meeting-audio` bucket cap 524288000).
      The deployed-`main`-breaks warning is closed.
- [ ] **Cloud storage upload cap** — ⛔ **BLOCKED, human decision**: org `Rede Madre` is on the
      **Free plan** (checked 2026-08-06) → 50 MB hard cap; 500 MB needs a **Pro upgrade**, then
      raise the dashboard storage limit and record it in runbook §2 (blocker recorded there).
- [ ] **T5 manual smoke** — plumbing ✅ DONE 2026-08-06: `minute_generator/.env` + platform
      `.env.local` `MINUTES_*` share minted secrets; smoke doc authored
      (`docs/testing/audio-minutes-smoke.md` — was referenced by runbook §6 but never existed);
      §3 webhook probe → 401 ✓; local storage container live-verified at 512 MiB. **Run blocked
      on human**: fill `ANTHROPIC_API_KEY` + `ASSEMBLYAI_API_KEY` in `minute_generator/.env`,
      supply a 1–3 min non-medical pt-BR audio, flip `MINUTES_SERVICE_URL` :8891→:8000 for the
      session (smoke doc has the full recipe).
- [x] **QA r2 residuals R1 + R3** — ✅ fixed 2026-08-06. R1: accessible name is now
      `Anexar a um item: "<resolução>" a "<item>"` — unique per card AND the visible label is
      the prefix (closes the pre-existing WCAG 2.5.3 gap QA's prescribed format would have kept).
      R3: `server-only` reverted on `src/lib/audio-jobs/hmac.ts`; E2E helper imports the real
      `signCallbackBody` (D16 restored); `docs/backend-state.md` updated. MIN spec 10/10 green
      (chromium, fresh reset).
- [ ] **R2** — the ≥8-tests click-delivery anomaly: did NOT reproduce on the 2026-08-06 rerun
      (10/10 first-attempt); still owed one look on different hardware before the pilot.
- [ ] Env vars on the deploy target: `MINUTES_SERVICE_URL/_API_KEY`, `MINUTES_CALLBACK_HMAC_SECRET`,
      `MINUTES_CALLBACK_BASE_URL` (runbook §3) — mint NEW production secrets, never the local
      smoke pair; plus the service itself deployed (`docker-compose.coolify.yml`) with its DPA
      gates closed (runbook §6).

<!-- OPEN backlog only (reviewed at each phase start). Resolved [x] items archived →
     docs/progress/follow-ups-archive.md (full snapshot). -->

### 🟢 FUP-QO-6 — oversight-toggle slow-confirm: **annoyance severity ACCEPTED provisionally (PO ruling 2026-08-07)**; open LOW priority, DB-vs-UI formally unclassified

**PO ruling 2026-08-07 (D-FUP-6b):** after 16 total trials with 0 recurrences (15 isolated +
1 full-load gate with a continuous ~12,100-sample out-of-process poller — see the Test Run
Summary row), the stale-UI (annoyance) assumption is **accepted provisionally for the pilot**.
The lost-write question stays formally open at LOW priority; nobody manufactures a
classification. If it recurs, the recorded next step is a targeted 20–30× repeated-trial run
of the D9 test alone under artificial contention with a **sub-second** poller (the ~1.6 s
interval aliases past the flip — proven this run). ⛔ The original "do not fix by raising the
timeout" stands. Original record + diagnostic history below.

<details><summary>Original entry (2026-08-07, pre-ruling)</summary>

### the oversight toggle intermittently fails to confirm within 10 s; DB-vs-UI unclassified

Found by `tester` once its restore check stopped trusting optimistic client state. **Pre-existing —
not introduced by QO·A, and invisible until now BY CONSTRUCTION**: the previous check read
`CommissionOversightToggle`'s optimistic value, which updates synchronously before the server action
starts, so it reported success every time regardless of what the server did. Making the check honest
is what surfaced this.

**Signature (consistent, ~3 failures in ~13 early attempts, ≈23%):** a failing run takes **~11.5 s**
against **~2.5–3.0 s** on a pass — the reload-based assertion burning its full 10 s timeout. So the
confirmation is *not* being read too early; the state genuinely is not observable within the window.

⚠ **The decisive fact is NOT established.** At the moment of failure, is the DB correct with the page
stale, or **did the write never land**? That distinction is the whole severity question: stale UI is a
known annoyance here, but an intermittent write failure means **D9's governance control silently
no-ops ~1 in 4 times** and an admin would believe a committee is under oversight when it is not.

A bounded diagnostic (15 isolated runs + an out-of-process ~1.4 s DB poller, 216 samples) came back
**15/15 PASS — unreproduced**. The only `excluded` readings were the expected mid-test transients of
passing runs. `tester` stopped at the bound rather than extending, and reported the absence of the
fact instead of manufacturing one.

**The streak is itself evidence.** P(0 failures in 15 trials) at a constant 20–25 % rate is ~1.3–3.5 %.
The likeliest reading is that failures **cluster with environmental contention** rather than being
independent per-trial draws — the diagnostic ran isolated and unloaded. Consequence for the gate:
`RETRIES=1` retries moments after the first attempt, i.e. under the *same* conditions, so the naive
~6 % residual-spurious-red figure is an **optimistic floor, not a ceiling**.

⛔ **Do not "fix" this by raising the timeout** — that hides precisely the question above. Next step is
to reproduce under **load** (during a full `e2e:prod` run, not in isolation) with the out-of-process
poller attached, then classify. In-browser instrumentation is useless here: it perturbed the measurement
(6/6 green with logging on, recurrence once removed).

**F6 result (2026-08-07, tester, under real full-gate load): still NOT REPRODUCED.** `quality-oversight.spec.ts`
ran once inside the full `e2e:prod` gate (batch 16, 87-file suite, `RESET=1`); all 4 D9/D10 toggle tests
passed clean — WRITE PATH 1.5s, READ PATH 1.6s, D10 WRITE 1.3s, D10 READ 1.9s, none near the ~11.5s
failure signature. The out-of-process DB poller (docker-exec psql against `commissions.quality_oversight`,
~1.2–1.6s interval, continuous 13:52:44–16:12:5x UTC, ~12,100 samples, 0 gaps) recorded **zero `excluded`
samples for `ccih`** across the whole batch-16 window — the WRITE-PATH test's flip + `finally`-block revert
completes faster than the poller's sampling interval, so this is aliasing (too fast to catch), not a
failed-to-flip signal; the DB row that WAS sampled around the test window read `visible` with a fresh
`updated_at` consistent with a clean, fast round-trip. Extends the non-reproduction streak to 15 isolated
+ 1 full-load run, 0 failures. **The severity question remains formally open** — this run did not supply
a failure to classify, and no classification is manufactured in its absence. Evidence + poller logs:
`docs/../PROGRESS.md` Test Run Summary (2026-08-07, "QO·FUP F6"); raw poller logs are in the tester's
scratchpad (not committed — out-of-band per the task's own instruction), `oversight-samples.log` /
`oversight-samples-resume.log`.

</details>

### 🟡 FUP-AFF-3 — pin door ACLs by DERIVING the door set, not by remembering it (2026-08-06)

Raised by `backend` at AFF close-out, and it is the **class** behind QA's N2. `302` §1's ACL
assertions covered "the doors that existed when §1 was written"; `log_cpf_probe_for` arrived two
commits later and **inherited nothing** — its ACL is its *entire* boundary (it fronts nothing, it
writes one audit row), so the one property most worth pinning was the one unpinned. Fixed for that
instance in `304` §9; the class is open.

⚠ **This is the third and fourth instance of the same failure inside one workstream** — the others
being F2's error-code detector (bounded by a 5-char syntax, so it could not see `check_violation`)
and `backend`'s own case-sensitive diff-derivation grep (which listed 1 of 4 changed gates, because
`pg_get_functiondef` emits uppercase — ADR 0079 Amendment 5a). Every instance is the recorded rule:
**an enumeration's boundary must be the property, not a syntax and not a remembered list.**

Proposed scope: one assertion that derives the door set from `pg_proc` — every `public` `prosecdef`
function granted to `service_role` must **not** be executable by `authenticated` — replacing the
per-door transcription. Needs its own allowlist discussion (legitimate dual-audience doors exist),
which is why it was flagged rather than widened into AFF unasked.

### 🟡 FUP-AFF-4 — make the membership-role list a Postgres ENUM (2026-08-06)

Raised by `backend`, and it is the durable fix for N1. `memberships_role_check` is a `CHECK` over
`text`, so the role list reaches **no** generated type (`grep technical_director_deputy
src/lib/types/database.ts` → 0 hits) and **no unit test can see the authority**. N1's remedy is a
committed fixture with a gate at each end (pgTAP `304` §10 ↔ fixture ↔ the pt-BR label test) — which
closes the drift hole, but is a **build-time gate, not a guard**: widen the CHECK, never regenerate
the fixture, ship without `npm run test:db`, and an English snake_case identifier still reaches a
pt-BR `role="alert"` through `roleLabel`'s `?? role` fallback.

As an **enum**, the list lands in `database.ts` and `tsc` enforces exhaustiveness — the check moves
from "a suite someone must run" to "the build". Deferred because it is a schema change with real
blast radius (`memberships_scope_shape`, every `role` comparison, the ADR-0094 completeness grid).
Decide before the role set next changes, not after.

### 🟡 FUP-AFF-2 — D7's "documented escape for a foreign professional" is unreachable (2026-08-06)

Raised by `backend` at W3 close-out. ADR 0097 **D7** makes `profiles.cpf` nullable *specifically* so a
foreign professional without a CPF can be registered "without a later schema change" — and then
requires CPF **at the action layer**. W3 implemented the requirement (correctly: without it the
identifier-first flow creates people no later CPF lookup can find, and the feature is inert on exactly
the population it exists for). **Net effect: the nullable column's escape has no product path.**

That is D7's own design, not a defect, and it is the right default — but it is recorded here because
the day the first customer has one foreign professional it becomes a real gap, and the fix should be a
**deliberate "sem CPF" affordance** (audited, org_admin-only, with the person still findable by name)
rather than a panicked schema change. Blocks nothing. Decide before the pilot onboards clinical staff,
not after.

### 🟡 FUP-SILENT-READ-1 — ~207 PostgREST reads never destructure `error` (2026-08-11, lead)

Surfaced during ETH·E4 when `tester`, enumerating the blast radius of the
`professional_profiles` column-list grant, noticed `getCaseDetail`'s professional embed
(`src/lib/queries/cases.ts:1358`) never destructured `error`. On any failure `profRows` is
null, `?? []` yields an empty map, and every professional participant renders with
`prof = null` — the roster silently falls back to the mint-time `display_name` snapshot,
`professionalProfileId` goes missing, and **`linkState` is undefined so the "Resolver
vínculo" affordance simply vanishes.** No error, no log, no visible failure: a deleted
feature that looks like an empty state.

**Fixed in-phase, all three ETH·E4-authored instances** (`7e55f01`): that embed, plus
`members.ts` `listLinkableOrgUsers` (an empty user list is indistinguishable from "no
account" — walking the coordinator to `no_account`, which makes the case exclusion
vacuously satisfied; the same class as QA's MAJOR-2, inside the very function written to
close the previous instance of it) and `vocabulary/actions.ts`
`listCaseParticipantRolesForAdmin`. ETH·E4-authored code is at zero.

**The repo-wide residue is this follow-up.** A cheap sweep counts **~207 of 773**
PostgREST destructures (~27%, ~40 modules — `rca.ts` 14, `capa.ts` 13, `referrals.ts` 10,
`cases.ts` 10). ⚠ **That is NOT a count of 207 bugs** and must not be cited as one. It is
pre-existing house style, and most instances are probably deliberate "return `null`/`[]`
on failure" reads. The ones that matter are only those where **an empty result is
semantically different from an error and the UI cannot tell them apart** — which is what
made the three above real. Separating those needs per-call-site judgement, not a regex:
the sweep is cheap, the triage is not.

⚠ The sweep script had a real bug before its numbers were trusted — line numbers were
computed on comment-**stripped** source, shifting every offset after the first comment.
Fixed by blanking comments length-preservingly (self-test 4/4); the count moved 210 → 209,
which is why ~207 is quoted as heuristic rather than audited. Script in `backend`'s
scratchpad. Owner: unassigned — needs a triage decision before anyone starts.

### 🔴 FUP-AFF-1 — the authz census is BLIND to write-path doors (2026-08-06, lead)

Recorded as ADR [0079](../decisions/0079-authz-door-blindness-standing-invariant.md) **Amendment 5**.
**Does not block AFF** — but AFF's gate record must **not** cite `ARM=census` as coverage for its
affiliation doors; it must cite `302_affiliation_doors.sql`'s mutation-proven keystones, which do
cover them in substance.

Found when `backend` noticed a diff-scoped `ARM=policy` run reporting **0 BLIND over five brand-new
DEFINER doors having swept none of them** — the boolean arm printed empty because they return
`uuid`, not `boolean`. The hole is wider than the observation, measured from the live catalog:

- **ARM 3's LIVE domain** is `prosecdef` functions that return `bool` **or** are set-returning +
  `authenticated`-executable, plus all RLS policies. A **scalar/void-returning write-path door is in
  none of those sets** — so `ARM=census` reports HOLDS **because the door is invisible, not because
  it is accounted.** That is Amendment 3's vacuity, recurring in a shape its own filter cannot express.
- **ARM 1's write-path sweep exists and is the right harness**, but its domain is **two frozen
  enumerations** — a hand-written list of **7** named raise-guards and a **captured snapshot** of 33
  write policies embedded in the script. Nothing added since has ever entered it. ("A remembered-doors
  allowlist is blind in exactly the case that matters" — now at the harness level.)
- **Measured blast radius:** filtering by the *property* instead of the return type — `prosecdef`,
  `authenticated`-reachable, scalar/void, comment-stripped `prosrc` both naming an identity primitive
  **and** raising `42501`/`HC*` — yields **201** functions. **6** are named in any findings report.

⚠ **Not a claim that 201 leak.** Most are covered in substance by keystones asserting through them.
The claim is narrower and worse: they carry **no sweep verdict**, and the arm whose whole job is to
detect a missing verdict cannot see that one is missing. Two caveats so the fix doesn't inherit a
false premise: the 201 is a regex *candidate* set, not a classification (`--` comments stripped,
`/* */` not), and the class is **not per-function** — AFF's gate lives in an owner-only kernel
(`app.*_impl`, ACL `postgres=X`) while reachability lives in its `authenticated` wrapper, whose body
names no identity primitive, so a per-function domain misses that door **from both ends**. The domain
has to follow the call edge, which is why this is harness work and not a filter tweak.

Scope when scheduled: derive the write-path domain from the catalog by the property (following the
wrapper→kernel call edge), fold it into ARM 3's LIVE set, and give `p0-authz-writepath-audit.sh` a
derived worklist in place of its two frozen enumerations. ⚠ **Dry-run the detector against a
hand-classified sample before believing it** — Amendment 4's harness reported 0 guards in all 45
doors and was completely wrong, and "no write-path door needs a verdict" is exactly as coherent a
false result.

_Closed 2026-08-04, rotated → [follow-ups-archive.md](./follow-ups-archive.md):_
**FUP-P16-1** (14 never-called doors failing the ADR 0079 floor — RESOLVED; `ARM=floor` now reports
`INVARIANT HOLDS`, nothing was allowlisted, and writing the positive twins found **3 doors whose
AUTHORIZED path could never succeed**. ⚠ Keep the mechanic: `pg_stat_user_functions` does not count a
call that raises, so **a deny-only keystone cannot clear the floor** and a permanently-throwing door
reads as *never called* rather than *failing*) · **FUP-P16-3** (`copy_version_children` temp-table
concern — INVESTIGATED, **not a bug**; ⚠ confirming a *pattern* is present is not confirming the
*defect* is present).

### 🔴 FUP-PCITV-1 — PCI + TV: what QA APPROVED **over**, ranked (2026-08-05)

QA r2 approved with 7 items open. None blocks the merge; **two block a clean deploy story** and are
called out in the Phase Status caveats above. Owner: unassigned unless noted.

| # | Sev | Item |
| - | --- | ---- |
| 1 | ⬛ | ~~**`ARM=census` never run**~~ **CLOSED 2026-08-05** — the arm landed with the membership-hardening merge and was run against the merged catalog. It found real debt, not nothing: `process_template_versions_{select,staff_admin_write}` carry **no verdict from any sweep**. TV swept and keystoned the six CHILD policies on `process_template_{phases,narratives,outcomes}` (`dcc5a4d`) and not its own PARENT table's two — *a new door must inherit every sibling arm*, one level up. Registered as `gate:` debt in `authz-unswept-backlog.txt`. The ghost-check also named all five `validate_template_*` signatures ADR 0096 re-keyed to `p_template_version_id`. |
| 2 | ⬛ | ~~**TV backfill never exercised** — rehearsal + snapshot blocking before `db push`.~~ **CLOSED (PO, 2026-08-05): the remote is EMPTY**, so the backfill meets 0 rows there exactly as it does locally. Not blocking. See the Phase Status caveat for the mechanism (which recurs) and for the unverified-premise error that produced this row. |
| 3 | 🟡 | **Revoke residue** — `authenticated` still holds `TRUNCATE` on **66 tables**; TRUNCATE bypasses RLS entirely. Unreachable via PostgREST *today*. ⚠ This phase set its own standard by **refusing the "unreachable" argument** in `20260906000600`, so it should be swept or accepted **in writing** — not left implicit. |
| 4 | ⬛ | ~~**BUG-RCA-001**~~ **CLOSED 2026-08-05** — PO ruled the interview's date is the **earliest session's `scheduled_start`**; fixed, PostgREST-verified, and the ruling pinned by `rca.test.ts` (5 cases, mutation-proven per arm). See the Bug Log. |
| 5 | 🟢 | Audit mesh **2 of 7** trigger arms keystoned (`20260906000200`). |
| 6 | 🟢 | The `is_commission_admin_of` disjunct in the 6 new tenant-isolation keystones is **unexercised** — no org-admin persona exists in the test bootstrap. Adding one lifts several suites at once. |
| 7 | 🟢 | `compute_case_phase_result` / `sync_case_phase_on_submit` still force the `in_case_rpc` GUC off (fails **closed**). · Resolver error semantics: helpers now log, but still collapse "not found" and "query failed" into one return — the discriminated-union refactor was deliberately deferred as too risky post-green. |
| 8 | 🟢 | **A FIFTH rebuild-property-loss, inside the migration written to close that class.** `20260907000700` recreated 10 policies on the 5 re-keyed relations **without the `TO authenticated` clause the originals carried** (`20260821000000` wrote `for select to authenticated`; the swap wrote bare `for select`). Platform split is **256 `{authenticated}` vs 11 `{public}` — and 10 of the 11 are these** (the 11th, `case_referral_delete_draft_source`, pre-dates the phase). `20260907001200` caught the ACL and `DEFERRABLE` losses and missed this one. **Verified INERT, twice:** `anon` holds **0 table grants on the 5** — and **0 anywhere in `public`** — so a bare policy still only ever evaluates for roles that either carry `BYPASSRLS` or cannot reach the table. Not a vulnerability; a latent widening if `anon` is ever granted anything. Normalize when one of these policies is next touched. ⚠ Same standard-consistency point as row 3: this phase refused the "unreachable" argument in `20260906000600`. |

| 9 | ⬛ | ~~**`296` suite-number COLLISION between branches.**~~ **CLOSED 2026-08-05** — resolved during the merge, not before it: the branch had committed by then, so it came through as a two-file collision on one number. Renumbered to `supabase/tests/298_authz_p0_isolation.sql`, with the Batch-4 runner in `p0b-isolation-mutation-audit.sh` following it. (A third collision was then created and caught in the same session — `299_hospital_content_door_noun_rule.sql` was first written as `284_`, which `284_accreditation_hospital_readiness.sql` already held. Check the directory before picking a number.) |
| 10 | 🟢 | **PROGRESS.md is 105 KB against the <60 KB target** (CLAUDE.md §7 — every spawn pays for it). This phase's rotation took it from 111.6 KB, so the trend is right but the gap is not closed. Next rotation should take the `📋 Remaining pre-pilot work` and closed-bug sections. |

**Landed, no longer a recommendation:** the PostgREST **embed sweep** built during this phase now
lives in the repo at **`scripts/extract-embeds.mjs`** + **`scripts/probe-embeds.mjs`** (moved out of
a session scratchpad that was about to be deleted — the earlier revision of this line pointed at a
path that would not have existed, which reads as "saved" when it is not). It found BUG-TV-001 *and*
BUG-RCA-001 mechanically across 284+ call sites. It still cannot join `npm run lint`, because it
requires a live local Supabase and `probe-embeds.mjs` refuses any non-local URL by design.

⬛ **Entry point DONE 2026-08-11: `npm run sweep:embeds`** (extract → probe, both against `.`, via a
gitignored `.embed-sweep/` scratch dir; `extract-embeds.mjs` now creates that dir rather than
requiring the caller to). Run against the live local stack to confirm it works end-to-end.

**Its baseline is a NAMED list, not a count** — deliberately, per the FUP-E2E-1 lesson that a
count-shaped baseline is a hiding place:
- **311** select sites resolved, **0** unresolved · **248** distinct (relation, select) pairs probed.
- **246 × `42501`** = genuine PASS. The sweep probes with the **anon** key, which holds zero table
  grants, and its own built-in CONTROLS (C1/C2/C3) prove each run that 42501 does **not** mask embed
  or column errors — a good tool: it re-earns that claim rather than asserting it.
- **2 × `PGRST205`**, both `get_meeting_agenda_items` (`minutes-jobs/context.ts:119`,
  `minutes-jobs/queries.ts:193`) — **extractor false positives, NOT defects.** Both sites are
  `.rpc(name, args).select(...)` chains; the AST extractor reads the RPC name as a relation and
  probes `GET /rest/v1/<rpc>`, which is not a table. ⚠ Whoever next touches the sweep: this is the
  known baseline — do not chase it, and do not "fix" it by suppressing PGRST205, which is the code
  that would report a genuinely missing relation.

The generalisation that justifies keeping it: **ADR 0096 A1.5's grep sweep could not have caught
BUG-TV-001, because that site names no dropped column — it names a relation that is no longer
*reachable*. After a column drop, sweep the embeds the column ENABLED, not just the column.**

⚠ **Deferred by decision, not oversight** (ADR 0095 §3): `blocks[]` → join table; the
`case_phase_offered_results` rename.

### ⬛ Resolved — rotated 2026-08-06 → [follow-ups-archive.md](./follow-ups-archive.md)

FUP-MEM-1 (indicator doors: not a defect) · FUP-MEM-2 (`assignOrgAdmin` door) · FUP-AUTHZ-2
(15 BLIND gates) · FUP-BULK-1 (suspended members) · FUP-MEM-3/3b (DT referral plane + inbox) ·
FUP-A11Y-1 (`useFieldIds` → `useId()`) · FUP-AUTHZ-3 (45 row-returning DEFINER doors swept) ·
FUP-AUTHZ-4 (BLIND allowlist pruned). Full resolution bodies in the archive.

### ⬛ Resolved — rotated 2026-08-11 (the FUP quick batch) → [follow-ups-archive.md](./follow-ups-archive.md)

FUP-QO-9 (PGRST002 + zero-summary-crash classification; preflight now WAITS for the schema
cache) · FUP-GATE-RESET-FLAKE (reset stderr captured + retried once, loudly; `renderer_ok`
names a dead `gotenberg-pdf`) · FUP-PDF-2 (allowlist narrowed to the `HC*` class) · FUP-P16-4
(12 `+ "s"` sites → `plural()`, helper moved to `src/lib/text.ts`) · FUP-P16-2 (both
accreditation reads through `queries/`) · FUP-QOB-2 (fully discharged — ⑤ closed when ACT
shipped). Merged `97acfd6`. Full bodies in the archive.

**Rotated in the same pass, but NOT part of the batch:** FUP-QOB-1 (the `270` §J J1c catalog
pin, RATIFIED by the PO 2026-08-09) — a separate, earlier closure that had simply never been
rotated out of either file.

### ⬛ Resolved — rotated 2026-08-12 (backend FUP wave) → [follow-ups-archive.md](./follow-ups-archive.md)

FUP-PDF-3 (both doors narrowed to the granted-column composite `printed_document_public` —
ADR 0111, migration `20260921000100`, pgTAP `323` red-first + DROP+CREATE property controls) ·
FUP-F2-BUCKETS (`meeting-attachments` retired — `20260921000300`, policies + bucket behind a
non-empty REFUSE guard; pgTAP `325` pins the absence from `pg_policies`; `case-documents`
retirement stays with the open `getReferralDocumentUrl` item; ⚠ remote object count could NOT
be measured — background-agent remote SQL is auto-denied — the migration guard turns a
data-bearing remote `db push` into a loud refusal instead). Full resolution bodies in the
archive. Same wave, tracked in the RDR phase row rather than here: the `case_narrative_types`
reorder-after-archive `23505` fixed in `20260921000200` + pgTAP `324`.

⚠ **The one thing worth carrying forward rather than archiving:** three of those six were
measurably WRONG about the code, each phrased as an instruction someone would have executed
(FUP-PDF-4's prescribed fix already shipped; FUP-QO-9(b)'s "false green" was caught by three
existing checks; FUP-PDF-2's `23514` is raised by no door at all). **A prescription in a
follow-up is a claim about the code and ages like one — re-measure before implementing.**

### 🔴 FUP-FF5-1 — patient-lane sublabel is degenerate on the READ path (**PO DEFERRED 2026-07-28**)

The picker shows `Paciente / Paciente afetado`; the **durable submitted record** and wizard resume
show `Paciente / Paciente`. `buildReferenceAnswers`' input row carries no case data, so it resolves
the participant **type** while `reference_candidates` and `app.references_by_item` resolve the case
**role**. Every patient's `display_name` is the surrogate `'Paciente'` by construction, so **two
patient references in one case are indistinguishable in the permanent record**.

QA r1: **MAJOR, but ship** — every disambiguator that would work is PHI and would reverse ADR 0091
ruling 1 (which is why Rule 12 stays at three modules). The only mitigation that does not undo the
ruling is a **workflow rule**: require distinct `case_participant_roles` per patient per case.
Code fix (giving `buildReferenceAnswers` case scope) is a three-level PostgREST embed with PGRST201
exposure — both engineers independently judged it not gate-time work.

⚠ **The PO deferred the decision, not the risk.** The patient lane is live behind `entity_refs` the
moment FF-5 deploys, and ruling 2 makes that lane work **only** on case-bound forms — so this is
100% of real patient-lane usage, unexercised rather than unlikely. **Resolve before the lane is
offered to a real committee.**

### ▶ FUP-FF5-2 — `r2-m-1`: §O pins the door's behaviour, not the closure of the writer set

ADR 0091's substrate paragraph claims *"an exhaustive `pg_proc` sweep for writers of `participants`
returns exactly two functions"*. §O proves the two known doors behave (the surrogate holds) and O5
proves no writer is invoker-rights — but neither pins that the set is **closed**, so a third
DEFINER writer taking a caller-supplied label satisfies every assertion. QA r2: MINOR, not blocking
(the runtime property is held by the mutation-proven O4, and a new writer arrives with its own
migration and ADR). **Close:** one assertion pinning the writer set by **count *and* name**,
matching `(public\.)?participants\y`. Two specifics — O5's current regex is
`insert\s+into\s+public\.participants`, which matches only `public.`-qualified writes (exactly why
a rogue *unqualified* writer probe stayed green), and use `\y`, **not `\b`** (backspace in Postgres
regex).

### ▶ FUP-E2E-1 — RE-BASELINE `e2e:prod` (cross-phase, PO-ruled 2026-07-27) — **blocks nothing**

Replace the *"~18–27 expected failures"* folklore with a **named list**: run the suite on a clean
stack and classify **every** failure as `infra` / `deterministic-real` / `genuinely-flaky`, each with
an owner.

*Why:* **a count-shaped baseline is a hiding place, not a known-issues list.** FF-2's gate ran
762 passed / 55 failed; splitting by connection errors showed **52 were infra** (the
`supabase_vector` crash-loop class) and **3 were real and deterministic** — one of which
(**BUG-FF1-008**) had been red on every run since FF-1 and written off as baseline noise.

Make the triage step itself documented rather than reinvented per lead: **conn errors `> 0` = infra ·
`= 0` = real.** Also establish why batches terminate early — two reported "did not run" (11 and 39),
so raw totals misstate coverage in **both** directions.

### ▶ FUP-FF2-3 — whitespace-only observation, per-instance (DEFERRED by the lead 2026-07-27)

After BUG-FF1-007 fixed the `<> ''''` quoting slip, the per-instance filters compare `<> ''` while the
top-level one uses `btrim(...) <> ''` — so a **whitespace-only** observation is filtered at top level
but not per instance.

**Deliberately deferred, on scope discipline rather than merit:** it is a *different* defect from the
one ruled in, it is cosmetic (a blank observation block renders inside a group instance), and it
would have been the third out-of-phase fix of a wave already at its gate. **`tester` independently
confirmed the deferral is safe** — both canonical writers normalise with `nullif(btrim(...), '')`, so
the whitespace case is reachable only for **legacy rows**, the same population BUG-FF1-007 defends.

### ▶ FUP-FF1-2 — FF-1 QA non-blocking items (review r2: 4 MINOR / 6 INFO) — **7 still open**

All ruled non-blocking by `qa`. Detail rotated 2026-07-28 →
[ff-1-repeating-groups.md](./ff-1-repeating-groups.md); canonical analysis →
[phase-FF-1-review.md](../reviews/phase-FF-1-review.md) (the playbook's rule: never restate a
review's rationale here).

Open: **MINOR-1** `completeness_authorities_agree` is one-directional in pgTAP · **MINOR-2** the
suite header documents a keystone that does not exist · **MINOR-3** MUTATION F3 names the wrong
mutation · **MINOR-4** stale-comment asymmetry in `supersede_response` · **INFO-2** no coherence
guard on the direct-DML path · **INFO-3** · **INFO-4** the parity vectors have no drift detector.
Closed: INFO-1 (superseded by MINOR-4) · INFO-5 (discharged at Record) · INFO-6 (carried forward as
a binding FF-2/FF-5 requirement — **both phases have since discharged it**).

> ⚠ MINOR-2 and MINOR-3 are the same family FF-5 hit eight more times: a comment or a test name
> asserting something that is not true. Cheap to fix, invisible to every gate.
### ▶ FUP-FF1-1 — coherent fill-path hardening (post-pilot; ADR 0087 ruling 5)

- [ ] Revisit **DEFINER + per-mutation audit for the whole fill path** — `answers`,
  `answer_selected_options`, `response_group_instances` **together**, as one change. Today all three
  are direct-DML-under-RLS with no per-row audit (Rule 11 is satisfied for filling at the *response*
  level via `audit_responses_trg`); FF-1 deliberately matched that convention rather than hardening
  one table piecemeal. Decide the target posture for the set, not for a member of it.

### ▶ AUTHZ Gate-2 deferred (PO-noted 2026-07-17, non-blocking — Gate 2 shipped)

- [ ] **MINOR-1 — reserved-session door returns the respondent's own `case_id`.** `get_reserved_session_items`
  now masks times + process number on `NOT is_case_respondent`, but a respondent still receives their **own**
  `case_id` (no cross-case / cross-patient re-identification). Whether the respondent should see even their own
  linkage on the reserved door is the unresolved **A7-vs-A26** call — **fold the reconciliation at pilot close**.
  Owned by `backend`.

### ▶ ETH·E1 → ETH·E2 inheritance (PO-directed 2026-07-14: "log for E2, don't act now")

Three **known gaps** + two QA Minors, all the same class — *pre-existing scope decisions E1 does not own*, made
**visible** by E1's stricter access model. QA and `backend` independently judged each out of E1's scope; the PO
agreed and routed all of them to **ETH·E2**. **Full reasoning, measurements and the QA quotes →
[eth-e1-access-spine.md §4](./eth-e1-access-spine.md)** (detail rotated there 2026-08-04; titles +
owners kept live here).

- [ ] **GAP-E1-1 — `action_items` `assignees_only` arm never consults `can_read_case`** (a respondent who is also
  an `org_admin` could see an assignees-only item on their own case). `backend` at E2.
- [ ] **GAP-E1-2 — `patient_safety_event` has no case arm**; residual is **link-existence inference only** (the
  event carries its own incident narrative, not case deliberation). Gating it would rewrite the NSP/PHI-module-1
  model E1 doesn't own. `backend` at E2.
- [ ] **GAP-E1-3 — privileged-doc ceiling has no coordinator arm** (UX, not security: the coordinator who uploads
  a privileged doc must self-grant clearance to reopen it — correct per ADR 0072 D5). `frontend` at E2/E3.
- [ ] **MINOR-A — the generic leak sweep can pass VACUOUSLY** (10/14 covered, 4/14 vacuous). Fix: report zero-row
  tables as **uncovered** rather than silently passing them. `backend` at E2.
- [ ] **MINOR-B — `action_items` passes the sweep by FIXTURE ACCIDENT, not documented exclusion** — the moment
  someone seeds an `assignees_only` item it fails and reads as a regression. **Make it a decision, not an
  accident.** `backend` at E2.
- [ ] **participant-roles M2M (ADR 0072 D7·4) deferred to E2** — no §4 gate criterion covers it and its shape
  depends on E2's decision model; QA verified nothing half-built was left behind. `backend`.

