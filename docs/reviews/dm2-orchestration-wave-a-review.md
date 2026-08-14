# DM2 — orchestration + Wave A: QA review (r1)

**Verdict: ⛔ CHANGES REQUESTED**

- **Scope:** DM2 slices S1–S4 on branch `docs/dm1-plan-amendments` (nothing merged, nothing
  pushed — PO directive respected; `main` untouched).
- **Contract audited against:** ADR [0114](../decisions/0114-document-model-redesign.md)
  (+ Amendment 1 D15/D16), [0116](../decisions/0116-dm1-substrate-cutover-decisions.md),
  [0117](../decisions/0117-dm2-s1-confidentiality-ceiling-decisions.md),
  [0118](../decisions/0118-dm2-s2-command-layer-decisions.md); the phase record
  [dm2-orchestration-wave-a.md](../progress/dm2-orchestration-wave-a.md); the DM1 record's
  §"Carried into DM2" and its §triage-ledger obligations; ARCHITECTURE.md Rules 1/6/8/9/10/11/12.
- **Method.** Every SQL claim re-derived from the **live catalog** (`pg_proc` incl. `prosecdef`,
  `pg_policies`, `pg_trigger`, `pg_constraint`, ACLs) on a **fresh `supabase db reset`
  (373 registered == 373 files)`**; no migration text was read as evidence about a live object.
  Behavioural claims were re-run as **rolled-back probes on planted rows with real uids** under
  `set local role authenticated`. Gate figures were **re-run, not accepted**.
- **Result: 1 P0 · 3 MAJOR · 6 MINOR · 4 INFO.** The P0 is a live PHI-byte exposure that
  re-opens a control the platform closed one phase before this one, and whose only shipped
  compensating control is a React prop. That alone is `CHANGES REQUESTED`.

**What is genuinely strong** (stated up front, because most of this phase is): the D15 ceiling is
correct in **both** directions and non-vacuous; the byte corridor's state machine matches D9/D10
exactly; the D11 audit floor is exact to the row, with denials raised and never logged; the
reclassification exemption's guardrails are real differentials, not decoration; and the
"reviewer resolves nothing" gap below is the **only** authorization defect I could find in
the corridor itself.

---

## 0. Independent reproduction of the gate figures

Everything I could re-run, I re-ran. All of it reproduced.

| Figure | Phase record claims | I measured | Verdict |
| --- | --- | --- | --- |
| Migrations registered | 373 | **373 registered == 373 files** | ✅ |
| pgTAP | 189 files / 6059 PASS | **`Files=189, Tests=6059, Result: PASS`** — read from the pg_prove summary; **0 `not ok`, 0 `Bad plan`**, run shape clean | ✅ |
| `npm run lint` (5 gates) | 0/0 | exit **0**; the chain runs to completion — `lint:vacuous` reports **178 spec files / 0 findings**, so gates 2–5 genuinely executed | ✅ |
| `npm run typecheck` | "0 first-party (4 in generated `.next/types`)" | exit **0**, **0 errors of any kind** on my tree | ✅ (better than claimed) |
| `npm run test` (vitest) | 1254 | **85 files / 1254 passed** | ✅ |
| `ARM=census` | HOLDS, 569 verdicts | **INVARIANT HOLDS**, "gates carrying a verdict: 569", no unswept newcomer | ✅ |
| `ARM=hat` | HOLDS | **HOLDS** — 3 findings, all reasoned-allowlisted; self-test 6/6 | ✅ |
| `FROMFINDINGS=1 ARM=wrapper` | HOLDS, BLIND 41 ⊆ allowlist | **HOLDS**, BLIND set size **41**, all allowlisted | ✅ |
| `e2e:prod` 1088p/0f/3flaky, 1091 of 1097 accounted | — | **not re-run** (lead-owned, multi-hour). The accounting arithmetic in the record is self-consistent and the 6 unaccounted are named as the 6 skips. | accepted on the record |

I ran the sweeps with `WORK` overridden to my scratchpad; the committed findings file is
untouched (`git status` clean on `supabase/tests/mutation/`).

---

## P0-1 — The M8/M9 byte-discrimination cut was never re-expressed in `open_document_version`; a quality reviewer is served PHI-tier document bytes, and the only control shipped is a UI prop

**Requirement violated, verbatim.** Three independent statements of the same obligation, all in
the tree today:

1. `docs/progress/dm1-substrate-cutover.md:184-192` — DM2 keystone obligation **2**:
   > "`open_document_version`: the six byte-discrimination pins (from 308 5.2–5.7) — **reviewer
   > resolves nothing** / capability-grantee resolves / coordinator non-vacuity twin, **at the
   > serving layer AND as door resolve-shape**. PLUS (QA r1 MINOR-3) the E2E-level M8 bytes-cut
   > contract deleted from `quality-oversight.spec.ts` … restored against the new door in DM2's
   > rewritten specs."
2. `supabase/tests/308_case_caps_s7.sql:291-303`, in the suite that ran green this phase:
   > "byte discrimination lives INSIDE DM2's `open_document_version`. **⛔ That door's keystones
   > MUST re-express all six pins** (5.2/5.3/5.4 at the serving layer; 5.5/5.6/5.7 as door
   > resolve-shape)."
3. ADR 0100 D3/D7 + its M8 ruling (`308:259-266`): "the reviewer READ standard-tier case bytes
   through … `can_read_case` → S7 — an un-audited, PHI-capable path no threading list named.
   The cut: case/interview BYTES **additionally require `read_case_deliberation`** — which every
   content source except S7 confers."

**What DM2 shipped instead.** The `read_case_deliberation` conjunct does not exist anywhere in
the new corridor. `app.can_read_document`'s case arm is a bare `app.can_read_case(...)`
(catalog-read), which is `app.has_case_capability(..., 'read_case_content')` — precisely the bit
`_case_caps`' S7 arm confers on the oversight reviewer. `public.open_document_version`'s only
authorization statement is `if not app.can_read_document(v_doc.id, v_uid)`. The compensating
control that *was* shipped is a React prop:

```
src/components/cases/case-detail-view.tsx:730     canDownload={!isOversight}
```

documented at `src/components/documents/document-row.tsx:73-78` as:

> "Viewer may obtain document BYTES at all (ADR 0100 D3/D7 — the quality reviewer reads
> metadata but never downloads). **Suppresses the audited door outright; there is no second byte
> path to also remember to suppress.**"

Both sentences are false. The prop suppresses the *button*; the door is not suppressed and knows
nothing about oversight.

**Reproduction** (rolled-back txn, fresh reset, planted rows, real uids; `quality.a` =
`00000000-…-0000000000f3`, a `quality_reviewer` with no commission membership):

```
CASE 1ea118f5-… comm=CCIH oversight=visible vis=commission_default reviewer_can_read_case=true
KERNEL reviewer can_read_document = true
REVIEWER open_document_version  ->  SERVED tier=phi title=QA QO probe doc
REVIEWER sees document row: 1      REVIEWER sees file_object row: 1
CONTROL outsider open           ->  RAISED P0002        <-- probe is non-vacuous
```

The door returns metadata; `src/lib/documents/actions.ts:192-225` (`openDocumentVersion`, an
export of a `'use server'` module) applies no oversight check either, resolves the coordinates
with the **service client** and signs. Reachability is not theoretical: the reviewer's own case
page renders `document-row.tsx`, which statically imports `open-document-button.tsx`, which
imports the action — so the action id ships in her bundle regardless of whether the button
renders; and RLS hands her the `document_version_id` she needs (`document_versions_select`
routes the same kernel, which returns `true` for her).

**Why every gate stayed green.** The M8 cut used to live in a **storage policy**
(`attachments_obj_select_readable`) — an artifact inside `ARM=census`' domain. ADR 0114 D8
deliberately deleted the SELECT policies and moved the boundary into a `jsonb`-returning
`prosecdef` door, which is in **no** arm's domain (see INFO-1). And the E2E half of obligation 2
*was* restored (`e2e/quality-oversight.spec.ts:402-505`) — but it asserts
`docPanel.getByRole('button', { name: 'Baixar …' })` `.toHaveCount(0)`, i.e. the UI half only.
Its own comment states the false premise verbatim: *"`canDownload={!isOversight}`
(case-detail-view.tsx) suppresses the single audited byte corridor entirely … there is no
second, unaudited path left to also remember to suppress."* The green E2E now **certifies a
UI-only control**, which is the exact inversion Architecture Rule 1 exists to prevent ("never
rely on UI hiding").

**Mitigating, and worth recording:** the open is not silent — the D11 floor fires on
`sensitivity_tier = 'phi'`, so every such read mints a `document.opened` row. It is detectable
after the fact, not preventable.

**Required to close** (all three, or an explicit PO reversal of ADR 0100 D7 recorded as an ADR
amendment — this is a ruling I cannot make for you):
1. Express the cut in the **DB**: a `read_case_deliberation` conjunct (or an equivalent explicit
   arm) for case/interview-homed byte serving. Whether it belongs in `app.can_read_document`
   (which would also hide metadata — **wrong**, 308 §5.1 pins metadata as reviewer-visible) or
   as a second gate inside `open_document_version` after the kernel is a design call; the latter
   preserves 5.1.
2. Re-express pins 5.2–5.7 as keystones on the new door, each **mutation-twinned** (neutralize
   the new conjunct → the reviewer must be served → the pin must red).
3. Correct the two false comments (`document-row.tsx:73-78`,
   `e2e/quality-oversight.spec.ts:489-496`) and strengthen the E2E to assert the *door* refuses,
   not only that the button is absent.

---

## MAJOR-1 — S1-O4 is not merely "a product question": a document on a `legal_privileged` interview is readable, and its PHI bytes servable, by members who cannot see the interview at all

The ledger parks interview-label inheritance as "a product question, not a bug" (S1-O4;
ADR 0117 decision 6). I accept the **parity** finding DM2-F1 on its own terms — the retired
`can_read_attachment` never routed `can_read_interview` either, and for dropped objects
migration text is the only admissible evidence, which S1 handled correctly. What the ledger
does not record is the **magnitude**, and it should, because the entry reads as a labelling
nicety:

```
interview ROW visible to staff1 (can_read_interview)        = false
staff1 sees the interview row (under RLS)                   = 0 rows
DOCUMENT homed on that interview, visible to staff1         = true
staff1 open_document_version on it                          -> SERVED tier=phi
```

(rolled-back txn; the only mutation is setting `case_interviews.confidentiality_level =
'legal_privileged'` on the seeded interview; the document carries **no** label of its own.)

So the interview is invisible while its attachments — which *are* its content — are served, PHI
tier included. The parity argument was sound while the substrate was dark (flag off, buckets
empty, ADR 0114 D1). **DM2 is the phase that turns it on**, and that is precisely the reasoning
Amendment 1 used to make D15 a Wave-A prerequisite: *"Wave A must not re-point … before it
lands, because that is the phase in which a formerly gated document would silently become
readable by every ordinary case reader."* The identical sentence is true of the interview
dimension, and S3 shipped an interview documents panel, so the seam is reachable by design.

There **is** a mitigation: the uploader can set an enforcing label on the document
(`ENFORCING_LABEL_HOMES` includes interview). The gap is that nothing inherits, so the default
is silent.

**Required:** a recorded PO ruling *before the production flags flip*, with this evidence
attached — either "inherit the interview's label" (a kernel arm + keystone, as S1-O4 itself
specifies) or "documents on a privileged interview are deliberately committee-visible", written
into ADR 0117. Not a build change I can prescribe; a decision that must stop being implicit.

---

## MAJOR-2 — reconciliation is blind, by construction, to `failed`/`abandoned` files that DO hold bytes; the sweep can report `RECONCILIATION CLEAN` over undisposable PHI

`scripts/document-reconciliation.mjs:11-13` states the premise:

> "Reserved/**failed**/**abandoned** rows expect NO object (not drift)"

and `:136-141` encodes it:

```js
const expectsBytes = r.disposal_state === 'none' &&
  ['uploaded','verifying','scan_pending','clean','unscanned_accepted'].includes(r.upload_state)
const expectsAbsence = r.disposal_state === 'disposed'
```

The premise is wrong for **both** states this phase made reachable:

- `failed` is now reached *after* a successful PUT — that is the whole point of the BUG-DM2-001
  fix. Live door body: `complete_document_upload_verification`'s `if not p_verified` branch sets
  `upload_state='failed'` and binds; the object is in the bucket.
- `abandoned` is the expiry sweep's **own product** (`:103` `.eq('upload_state','reserved')`) —
  a user who PUT and never finalized.

For both, `expectsBytes` is false and `expectsAbsence` is false, so neither MISSING nor
MISSING-DELETE fires; and `accounted.add(r.storage_path)` at `:134` is **unconditional**, so the
object can never be an ORPHAN either (`:146-148`). The bytes are invisible in both directions,
have no disposal path (`request_document_disposition` only touches files with
`disposal_state='none'` bound to a document — which these are, but nothing ever asks), and are
retained indefinitely in `documents-phi`. Under Rule 12 and the ADR 0035 retention regime, these
are exactly the objects that must be accounted for; the reconciliation script is the only thing
that would ever notice them, and it is built not to.

The `expiredSwept: 3` smoke run could not catch this — it proves the sweep *marks* rows, not that
the drift classifier *sees* their bytes.

**Required:** treat `failed` and `abandoned` as `expectsBytes` (they are drift candidates, or
better, disposal candidates), and stop `accounted` from swallowing rows the classifier declined
to judge.

---

## MAJOR-3 — after a verification failure the upload dialog offers "Tentar novamente", which cannot succeed; each attempt drives an unaudited service-role download of the full object

Traced through both the live door bodies and the TS:

1. Verification fails → session `consumed`, file `failed`, binding written;
   `src/lib/documents/actions.ts:179-181` returns `{ ok:false, error:'upload_incomplete' }`.
2. `src/components/documents/document-upload-dialog.tsx:154-160` — `fail()` clears the session
   **only** for `upload_expired`, so the reservation survives and the submit button relabels to
   `"Tentar novamente"` (`:418-419`).
3. Retry → `finalize_document_upload` takes its `if v_s.state = 'consumed'` idempotent branch
   (catalog line 28) and returns `'upload_state', v_f.upload_state` = `failed`.
4. `actions.ts:146` does not match (`failed` ∉ {`unscanned_accepted`,`clean`}), so TS re-enters
   the D9 branch and calls `complete_document_upload_verification`, whose live body raises
   **HC0D9** at `if v_f.upload_state <> 'verifying'` (catalog line 21-22).
5. HC0D9 → `upload_incomplete` → **step 2**, forever.

The pt-BR copy the user is shown — `document-labels.ts:404` "O arquivo não chegou por completo.
**Tente enviar novamente.**" — instructs an action that cannot work. The real recovery is the
one the *row* states ("Remova este item e envie o arquivo novamente"), which the dialog never
surfaces. Each iteration also re-runs `actions.ts:164-166`, a service-role `storage.download` of
the whole object, from a client button, with no audit row.

This is the incomplete half of BUG-DM2-001: the fix made failure **observable** (it does — see
below) but not **recoverable from where the user is standing**. The E2E green bar does not catch
it because `DM2-VERIFY-FAILED` asserts the DB truth and the row's "Falha no envio" text, never
the dialog's retry affordance.

---

## MINOR

1. **`document-reconciliation.mjs:43-55` — pagination discards pages.** A directory with exactly
   1000 entries returns `[]`; 1500 returns only the last 500. Earlier pages are never
   accumulated, and no stable `sortBy` is passed, so offset paging can skip or duplicate. Every
   lost object turns its row into a **false MISSING** and hides real ORPHANs in the same page.
   Unreachable at the current census (45 objects) — which is why the smoke run passed.
2. **`document-reconciliation.mjs:90-93` — unguarded session UPDATE.** `state:'expired'` is
   written keyed only on ids read at `:81-84`, with no `.eq('state','reserved')` re-check;
   `upload_sessions` carries no transition-guard trigger (catalog-verified). A finalize landing
   in that window gets its `consumed` session stomped to `expired`. Two-word fix.
   Same file `:59`: the comment says "record it" and the code `continue`s recording nothing.
3. **A file stuck in `verifying` is swept by nothing.** If the process dies between
   `finalize_document_upload` (sets `verifying` + `consumed`) and the verification door —
   plausible on a large download+hash — the version keeps no binding and the reader sees the
   eternal `pending` that BUG-DM2-001 was filed about, by a second route. The expiry sweep only
   looks at `state='reserved'` sessions.
4. **`document-delete-button.tsx:60-64` discards the mapped pt-BR message on a premise that is
   now false.** The comment says the contract "has not yet guaranteed [the error] is user-facing
   pt-BR"; `types.ts:306-308` types it as a closed 14-member union and
   `document-labels.ts:416-418` already maps it (the upload dialog uses exactly that). Net cost:
   a delete refused by a **legal hold** shows the generic fallback instead of the string written
   for it. Strictly safe, never a Rule 10 violation — but it is the repo's own "a comment is an
   assertion that goes stale silently" class, one commit old.
5. **Authorization props default to allow.** `case-documents-panel.tsx:22-23` defaults
   `canWrite = true, canDownload = true`. Every current caller passes them explicitly, so
   nothing is wrong today; an authorization prop that fails open is a trap for the next call
   site — and P0-1 is what a fails-open authorization prop looks like when it matters.
6. **PROGRESS.md is stale on two follow-ups it discharged this phase.** `PROGRESS.md:701-702`
   still lists **FUP-DM1-E2E** and **FUP-DM1-DISPOSE** as 🟠 with "discharge = DM2 …", while S4
   rewrote the six specs and the catalog shows `dispose_case_phi` carrying its arm (f) —
   *"DM2·S2 (FUP-DM1-DISPOSE discharged): case-homed documents…"*, verified in `prosrc`. The
   phase-status row and the S2 row both say discharged; the follow-up list disagrees with them.
   Rule: PROGRESS.md is the single source of truth for status.

---

## INFO

1. **DM2 moved an authorization boundary out of every standing sweep's domain — and that is why
   P0-1 was invisible to four green arms.** I checked the census reasoning rather than the
   claim, as asked. The reasoning is **correct**: `ARM=census`' domain
   (`p0-authz-invariant.sh:246-296`) is `prosecdef` **boolean** functions, `prosecdef`
   **row-returning** (`proretset`) functions with `authenticated` EXECUTE, `public` INVOKER
   plpgsql wrappers, and all RLS policies. DM2's nine caller-facing command doors return
   `jsonb`, are `prosecdef`, and are not `proretset` — genuinely outside, by construction.
   `document_delete_affordances` returns `TABLE(...)`, hence `proretset`, hence inside — which is
   exactly why the census caught the author's misprediction. The record's account of that
   episode is accurate.
   The observation worth carrying forward is the **boundary's shape**: clause 2 was widened after
   BUG-AUTHZ-002 on the stated principle that *"a DEFINER's gate REPLACES RLS, so for these the
   internal gate IS the entire boundary"* — and that principle is a **property**, while the
   implementation is a **return-type syntax** (`proretset`). `open_document_version` satisfies
   the property completely (D8 deleted the storage SELECT policies precisely so this door would
   be the whole boundary) and fails the syntax. It joins **536** pre-existing
   `prosecdef`/`authenticated`/non-bool/non-setof functions, so this is the platform's standing
   model and **not** a DM2 regression — I am not asking DM2 to change the census. I am recording
   that the phase relocated a byte boundary from a census-covered artifact (a storage policy)
   into a non-covered one, and that the first defect in the new location went unnoticed by every
   arm. If one door earns a census-domain exception, it is this one.
2. **`documents_wave_a` is not a kill switch — and I think the ledger entry is insufficient as
   written.** Confirmed: `documents_wave_a` is read only at `actions.ts:79-82` and gates UI
   affordances; `documents_foundation` gates the doors, via `app.assert_documents_enabled()`
   which is the first statement of all twelve document doors (catalog-verified). None of the
   write actions consults the wave flag, so with `foundation=true, wave_a=false` every server
   action still succeeds. The ledger records this correctly. What it does not do is bind it:
   "the two flip together" is prose, and nothing — no CHECK, no dependency, no keystone —
   fails if someone flips one. Given that the same document says the pair is the S5 incident
   lever, I'd ask for a **pgTAP keystone** asserting the dependency (or a DB-level dependency
   between the keys) rather than a sentence, before S5 relies on it.
3. **"The client never learns a bucket, a path or a token" is true of the projections, not the
   credentials.** `types.ts:17-18` and `document-upload-dialog.tsx:101-102` state it absolutely.
   The signed URL handed to the client (`actions.ts:127`, consumed via `window.open` at
   `open-document-button.tsx:48`) contains the bucket and the full path, and parks a live PHI
   bearer token in browser history for its 120 s TTL. No SELECT policy exists so nothing is
   exploitable — but the absolute wording is the kind a later reader will lean on. ADR 0114's
   O4 closure already reasons about the bearer-token property; the type comment should not
   contradict it.
4. **Rule 9 has a deliberate, documented exception in `actions.ts`** (`:110`, `:159`, `:204`,
   `:305`, `:310` read `file_objects` / `document_version_files` inline with the admin client).
   Justified in the module header per ADR 0118 §1 — coordinates resolve only there, so the DM5
   exit criterion holds by construction. I accept the topology; noting that Rule 9's text carves
   no such exception, so it should be named in ARCHITECTURE.md at DM5 alongside the D8 Rule-1
   sharpening that ADR is already scheduled to write.

---

## What the phase record overstates or understates

The record is unusually honest — it volunteers its own ladder deviations, a skipped intermediate
observation, and an author misprediction the census corrected. These are the places where it
does not match what I measured.

**Overstates**

- **"MINOR-2 discharged (gate-before-record, O9/O10)"** (ADR 0118 Consequences) is *true* and I
  verified it (denied opens mint **zero** audit rows; `open_document_version` is the sole minter
  of `document.opened` in the entire catalog). But the phrase **"the open door is the verb's
  only minter, which is what makes the audit-exactness pins meaningful"** (§3) sits one section
  away from the fact that the door's *authorization* — not its audit — is missing the M8 cut.
  Exactness of a floor says nothing about the correctness of the gate above it.
- **DM2 obligation 2 is reported as discharged by omission.** The record's S4 row says the six
  parked specs were restored "incl. the M8 bytes-cut contract", and PROGRESS.md:116 repeats it.
  The obligation as written demands the pins "at the serving layer **AND as door resolve-shape**".
  Only the surface half exists. The record contains **zero** occurrences of "oversight",
  "quality reviewer", or "ADR 0100" — the obligation was not deferred with a reason, it was
  never picked up. That is the single most important correction in this review.
- **"a servable copy always survives"** (ADR 0118 §10) — the *claim* is correct and I re-derived
  the induction (see below), but §10 attributes the guarantee to "the evidence" generally. The
  load-bearing detail is narrower and worth pinning in the ADR text: the sibling predicate
  requires `f2.disposal_state = 'none'`, **not** merely `<> 'disposed'`. Because
  `request_document_disposition` marks *all* bound files pending in one statement
  (catalog-verified), two simultaneously-pending duplicates each fail to find a live sibling and
  **both** refuse. If a later author "simplifies" that term to `<> 'disposed'`, the last-copy
  invariant dies silently and R6/R7 still pass. Also worth recording: R7 additionally proves
  ADR 0118 §4's ordering, because the successor's bytes are still present, so a leaked exemption
  would have surfaced as HC0D9 rather than HC0DR.
- **`document-row.tsx:73-78` and `e2e/quality-oversight.spec.ts:489-496`** each assert, in prose
  a reader will trust, that the byte corridor is suppressed for the reviewer. Both are false.
  (This is the second time this phase a confident affordance claim turned out to be inference —
  the lead's own "Restrito verified" correction was the first.)

**Understates**

- **S1-O4** is filed as "a product question, not a bug" with no indication that **PHI bytes**
  follow the metadata. See MAJOR-1. The ledger entry as written would not cause a reader to go
  look.
- **BUG-DM2-001's fix** is recorded as complete, and its *observability* half genuinely is —
  I verified all three layers, including the load-bearing one nobody would notice was
  load-bearing: `app.can_read_file_object` carries **no `upload_state` filter**, so a bound
  `failed` file is visible through the chain. Had that predicate filtered on servable states,
  the whole fix would have been invisible. What is understated is that the fix ends at
  observability (MAJOR-3).
- **BUG-DM2-003's fix** is recorded as "expiry marking moved to reconciliation". Accurate, and
  the tester's refusal to un-pin the spec as literally written was exactly right. What is
  understated is that it moved the mechanism into a script with a wrong byte-invariant and a
  pagination bug (MAJOR-2, MINOR-1) — the `expiredSwept: 3` smoke result reads as validation of
  the sweep and only validates one of its three jobs.
- **The `ARM=census` "zero domain delta"** notes are correct but read as coverage. They are the
  opposite: they record that ten new authorization doors are permanently outside every standing
  gate. The findings-file note handles the bookkeeping; INFO-1 is what it means.

**Correct, and I want it on the record as verified rather than accepted**

- **The D15 ceiling, both directions, non-vacuously.** Uncleared reader:
  `legal_privileged`/`credentialing_sensitive` → `false`; `ethics_investigation`,
  `peer_review_confidential`, `phi_restricted`, `NULL` → `true` (no over-narrowing). Denial is
  **row absence** through the whole chain — `documents` 0, `document_versions` 0,
  `document_version_files` 0, `file_objects` 0 under RLS. The **creator + staff_admin** is denied
  too, and so is `platform_admin`. After a `case_access_grants` grant with
  `max_confidentiality='legal_privileged'`: the `legal_privileged` document and its entire chain
  appear, while `credentialing_sensitive` stays denied — so `confidentiality_rank` is genuinely
  consulted, not mere grant existence. The interview arm behaves identically.
- **The meeting/action_item seam, both layers.** Write side: enforcing label on a meeting home,
  on an action_item home, and by relabelling an existing meeting document all raise **HC0D6** in
  pt-BR; moving a labelled document's home is refused even earlier by `guard_document_transition`
  ("âncora do documento é imutável"). Read side, with the guard disabled in a rolled-back txn:
  meeting-enforcing → `false` for the creator/staff_admin **and** the member; action_item-enforcing
  → `false`; **control** (meeting, unlabelled) → `true`. Fail-closed, non-vacuous.
- **The corridor's state matrix, exactly as D9/D10 specify.** `disposal_pending`/`disposed` on
  the **file** → HC0DD; `disposal_pending` on the **document** → HC0DD; `scan_pending`,
  `infected`, `failed` → HC0D8; unbound → HC0D8; soft-deleted document → HC0D8;
  `unscanned_accepted` → **served** (the D9 interim acceptance); denial → P0002, byte-identical
  to not-found.
- **The D11 floor, exactly.** creator + PHI → 1 row; creator + standard → **0**; non-creator +
  standard → 1; non-creator + PHI → 1; two opens → two rows, no duplicates; every denial → 0.
  `open_document_version` is the only minter of `document.opened` in the catalog, and there is no
  audit trigger on `documents` to double it.
- **D8 structurally.** `documents-phi` and `documents-standard` are private and carry **INSERT
  policies only**, gated by `app.storage_upload_reserved` (live reserved session owned by the
  caller, matching bucket+path, file still `reserved`). No SELECT, UPDATE or DELETE policy on
  either bucket for any tier. The F-01 class is dead by construction.
- **The reclassification exemption's guardrails are real.** 329 R6/R7 are the same statement with
  one variable (sibling liveness) — `lives_ok` then `throws_ok HC0DR`; R8 is a true vacuity pin
  (unique-sha file claiming `duplicate` → HC0DR). Neither is decoration. The induction holds for
  n copies, and holds *because* of the `disposal_state = 'none'` term.
- **RLS + ACLs.** All nine DM tables have `relrowsecurity` on with exactly one SELECT policy each
  (mutations command-only). The three service-role completion doors carry **no `authenticated`
  EXECUTE** (structurally absent, not revoked-after). Tier is server-derived from the home type
  and the bucket is CHECK-derived from the tier; paths are server-generated; declared
  size/MIME are validated against the bucket config as hints. Rule 12's bucket-from-tier,
  server-derived-path and no-PHI-in-titles contract holds.
- **`document_retention_select` is `USING true`** — I checked, and it is correct: the table holds
  only policy rows (`applies_to_kind`, `applies_to_tier`, `retention_years`, …) with no document
  or file reference. Not a leak.
- **Rule 8.** `src/lib/types/database.ts` carries `documents.confidentiality_level`; the only
  migration after the last regen (`20260924000600`) rewrites function bodies and adds no column.

---

## Items I was asked to assess rather than rediscover

| Item | Assessment |
| --- | --- |
| `documents_wave_a` gates the UI only; not a kill switch | Confirmed mechanically. The ledger entry is **insufficient as written** — see INFO-2. Ask for a keystone, not a sentence. |
| Plan **Q1** (ethics seam columns have no wave) | Out of DM2 scope; blocks DM3 planning. No DM2 finding. |
| **S1-O3** (uploader visibility) | Correctly *not* added. Nothing in the tree adds an uploader arm, so ADR 0116 §11 / DM1 MAJOR-1 stays closed. Verified `app.can_read_file_object` is chain-only. |
| **S1-O4** (interview-label inheritance) | Escalated — **MAJOR-1**. The classification as a product question is defensible; leaving it undecided while Wave A ships the interview panel is not. |
| The lead's INFO (`latestVersion` null renders "Sem arquivo" + a PHI badge) | **Refuted on the observable half, and the judgement is right on the derivation.** `document-row.tsx:147` is `{doc.containsPhi && version != null && <DocumentPhiBadge />}` — the `version != null` conjunct (commit `7cb5c60`) suppresses the badge, so the contradictory pair does **not** render. The `containsPhi` fallback to the home rule (`queries/documents.ts:127-130`) is a correct fail-safe and its only consumer is that one suppressed site. `begin_document_upload` mints version 1 in the same call as the document, so the state is unreachable via the UI, as you judged. One residual: the suppression keys on `version == null`, not `latestFile == null`, so a *version with no `source` binding* (the stuck-`verifying` state, MINOR-3) renders the home-rule `containsPhi` beside "Pendente" — over-warns on case/interview (correct), under-warns on a meeting home (harmless while meetings are `standard` by construction). |

---

## Route back

P0-1 loops to step 1 (backend + frontend + tester: DB conjunct, keystones with mutation twins,
corrected comments, strengthened E2E). MAJOR-1 needs a PO ruling before the flags flip.
MAJOR-2 / MAJOR-3 and the MINORs are engineer-side and can ride the same loop. Everything else
in this phase is sound, and the ceiling and corridor work is the strongest security substrate
the platform has shipped — which is exactly why the one door that skipped its named obligation
has to be closed before Wave A goes live.

— `qa`, 2026-08-13

---

# DM2 — orchestration + Wave A: QA review (r2)

**Verdict: ✅ APPROVED**, with **one binding pre-merge condition** (r2-1 below) that
does **not** require a gate re-run because it cannot change behaviour.

r1 above is kept, not struck: the phase looped, and the loop is the record.

- **Scope:** the r1 remediation on `docs/dm1-plan-amendments`, HEAD `3b7c8fb`
  (r1 paused at `4644cef`). Still: nothing on `main`, nothing pushed, all five DM
  flags OFF in production defaults.
- **Method, unchanged from r1 and applied harder:** every SQL claim re-derived from the
  **live catalog** (`pg_proc` incl. `prosecdef`, `pg_policies`, `pg_constraint`), never
  from migration text. **Falsifiability claims were re-executed, not read** — I re-ran
  all three P0-1 mutations myself, in rolled-back transactions, with the restore verified
  by body-md5. Gate figures were re-run.
- **Result: 0 P0 · 0 MAJOR · 1 MINOR (r2-1) · 4 INFO.** Every r1 finding is discharged
  except one sub-item of P0-1's closure list, which is a comment, not a control.

---

## 0. What I re-derived myself (not accepted)

| Claim | Source of the claim | What I measured | Verdict |
| --- | --- | --- | --- |
| Migrations registered | 375 | **375 registered == 375 files** | ✅ |
| `308` sentinel 5.2s **can fail** | phase record | **Reproduced.** Cut → `and false` in a rolled-back txn: **1 red of 30, and it is 5.2s** — `caught: HC0D8 … wanted: 42501`. Control **5.2c2 stayed green**, so the red is the capability cut, not fixture rot. Door md5 `6def3045…` identical before and after | ✅ |
| `329` mutation **A** (conjunct → `and false`) | phase record: P0a/P0d/P0f red | **Reproduced exactly.** 115 planned = 115 ran, 0 aborts, **3 red: P0a, P0f, P0d** | ✅ |
| `329` mutation **B** (conjunct → `and true`) | phase record: file aborts at O1; P0b/P0c red in a focused harness | **Reproduced the abort.** 30 ok then abort at the first unguarded open — 191 cascade errors, no `finish()`. An aborted run is a failed run, so `329` cannot go green under B. P0b/P0c's individual reds are *forced* by the mutated body (`v_case is not null and true` ⇒ every case/interview open raises) — I did not re-run the focused harness | ✅ (see r2-INFO-1) |
| `329` mutation **C** (the wrong fix — conjunct in the KERNEL) | phase record: P0e + P0a red | **Reproduced exactly.** 115 = 115, 0 aborts, **2 red: P0e, P0a** (`caught: P0002, wanted: 42501`) | ✅ |
| `can_read_document` is **COVERED** by the diff-scoped sweep | lead re-gate table | **Re-derived by an independent, safer route:** kernel neutralized to `select true` in a rolled-back txn → `328` goes **18 red of 130** (K5b/c/d/f, K11k–o, K14s6, K14d1–d3, …). The gate is load-bearing and the suite notices | ✅ |
| pgTAP files I could run in isolation | 189f/6097 PASS | `308` **30/30** · `311` **40/40** · `328` **130/130** · `329` **115/115**, all 0 errors, run shapes clean | ✅ |
| `npm run lint` (five gates) | 0/0 | exit 0; chain runs to completion — `lint:vacuous` **179 spec files / 0 findings**, client/server gate 474 client + 124 server modules, both self-tests green | ✅ |
| `npm run typecheck` | 0 errors | **exit 0** | ✅ |
| `npm run test` (vitest) | 86 files / 1258 | **86 / 1258 passed** | ✅ |
| `ARM=census` | HOLDS, 549 gates / 569 verdicts | **INVARIANT HOLDS — 549 / 569**, no unswept newcomer. `WORK` overridden; `git status` clean afterwards | ✅ |
| `e2e:prod` | GREEN run 2 | not re-run (lead-owned) — **triaged below, §1.4** | see below |

Everything I ran was inside a rolled-back transaction with the mutated body restored and
**verified from the catalog by md5**. The working tree is clean; the committed findings
file is untouched.

---

## 1. The four items I was asked to scrutinise hardest

### 1.1 The P0-1 proof — real, and the sentinel genuinely fails

This was the finding that made r1 a stop, so I did not accept the record: I re-executed all
three mutations. All three reproduced exactly, including the shapes.

The **`308` sentinel is the important one**, because the defect it was written to fix was a
prose obligation that ran green all phase while unmet. It is now three live assertions
(5.2c1 fixture, 5.2s sentinel, 5.2c2 control) and I proved the middle one can fail: with
the byte cut neutralized, **5.2s is the only red in the file**, and it reds by *moving* —
the reviewer stops being refused at the cut (42501) and sails on to file-absence (HC0D8),
which is exactly the pre-fix behaviour. The differential control on the same version, one
variable apart, stays green. That is a sentinel, not a tombstone.

`329` P0a–P0f: **all six pins have an observed red under a targeted mutation**, and I
reproduced five of the six myself. The backend's honest deviation is correct and I want it
on the record as *correct*, not merely honest: the handoff's literal instruction ("revert
the conjunct → every one of the six must red") is **unsatisfiable**, because P0b/P0c/P0e are
positive controls — a control that reds when the thing it guards is removed is not a
control. Splitting falsifiability across three mutations is the right construction, and
mutation C is the strongest of them: it demonstrates *executably* why the cut lives in the
door and not the kernel (the kernel conjunct kills M8 metadata reach, which 308 §5.1 pins).

The **shape** of the fix is also right, and I checked the property rather than the diff:

- `_case_caps` S7 confers `read_case_content | view_case_overview` and **not**
  `read_case_deliberation`; every other content-conferring arm (S1, S3, S4, S6) confers
  deliberation. So the cut removes **exactly one class** and cannot over-narrow.
- That invariant is not merely true, it is **pinned**: `311` 6.6 asserts S7 is the only arm
  conferring content without deliberation, and names itself as the place a second one must
  be re-proven. This is the load-bearing lattice fact behind the cut, and it is executable.
- The cut's domain (`case` + `interview` homes) is **complete relative to the reviewer's
  reach**: the meeting arm is `is_member_of_for` and the action_item arm routes
  `is_member_of_for` / `can_read_case_committee` / assignee — the reviewer holds no
  commission membership, and `can_read_case_committee` explicitly subtracts
  `is_oversight_only_reader`. There is no fourth home type that serves her bytes.

### 1.2 MAJOR-1 cannot over-narrow — confirmed from the catalog

`app.confidentiality_clearance_ok(p_case_id, p_label, p_uid)`, read from `pg_proc`:

```
if p_label is null
   or p_label not in ('legal_privileged', 'credentialing_sensitive') then
  return true;
end if;
```

So for `NULL`, `non_phi_internal`, `ethics_investigation`, `peer_review_confidential`,
`phi_restricted` — every non-enforcing label — it returns `true` unconditionally. Ordinary
readers of ordinary interviews are unaffected, by construction and not by fixture.

The new arm is `app.can_read_interview`, which is **exactly the old predicate plus the
clearance conjunct**, row-joined; a missing interview row fails closed in both the old arm
(`case_of_interview` → NULL → `_case_caps` STEP 3 → 0) and the new (`exists` over no row).
ADR 0117 Amendment 1 states this accurately. The non-over-narrowing twins are first-class
pins inside `328` (K15t1/t2, K15g1/g2), and `328` runs **130/130**.

I also note a second-order effect, which is a *strengthening* and worth recording: because
the kernel's interview arm now routes `can_read_case_committee`, the oversight reviewer can
no longer reach interview-homed document **metadata** either. The byte cut's interview leg
is now belt-and-braces. That is fine — defence in depth on a PHI corridor is not a defect —
but it means the interview leg is currently unreachable-by-the-reviewer and the cut's
assurance rests on the case leg. No action.

### 1.3 Your gate claims — not overstated; if anything under-claimed

I checked the derivation rather than the sentence, which is what r1 was asked to do and what
the r1 *record* failed to do.

- **The case list is genuinely one gate.** Across all eight DM2 migrations
  `20260924000100`–`…000800` the functions touched are `guard_document_confidentiality`,
  `assert_documents_enabled`, `can_read_document`, and the ten `public` command/open doors.
  Under the ADR 0079 Amdt 1 `^(is_|can_|has_)` filter that is **exactly `can_read_document`**.
  I also grepped all eight for `create policy` / `alter policy` / `drop policy`: **zero**.
  Note `…000800` contains no `create or replace function` literal at all — it rewrites the
  live body via `pg_get_functiondef` + `replace()` — so a naive text derivation would have
  found *nothing*; the list was derived by resolving the `replace()` target, which is the
  correct reading of the recipe.
- **`case count nonzero` was checked before citing**, and the record says so. Good — that is
  the write-path-sweep trap this project has been burned by.
- **The `open_document_version` caveat is stated, not buried.** The re-gate section names it
  explicitly: the door carrying the byte cut returns `jsonb`, is in no arm's domain, and its
  assurance is `329` + the `308` sentinel, *not* the sweep. That is the honest form, and it
  is the correction the r1 record needed.

One thing you **under-claimed**: you cite the sweep's `COVERED` verdict without saying what
it means behaviourally. I re-derived it directly — opening the kernel turns `328` 18 red —
so the coverage is not a harness verdict, it is an observed property. Worth carrying.

### 1.4 The `e2e:prod` triage — it does not block, and I am not deferring to you

**Ruling: pass on this axis.** Not because "flake" was proven — it was not, and you were right
to refuse to call it one — but because the red is **not attributable to this phase**, and three
independent `RETRIES=0` passes stand against a single observation.

What I verified independently, which narrows the hypothesis space further than the triage did:

1. **The evidence loss is total, not partial.** I checked `/tmp/e2e-prod-gate/` — which is
   never cleaned and survives across runs. `batch-8.log` is stamped **16:23**, i.e. run 2; run 1's
   batch log was overwritten too. Nobody should go hunting: it is gone. (Caveat 2 is understated —
   it was not only `test-results/`.)
2. **Your own parked hypothesis is largely excluded by two facts visible in that batch log.**
   The gate runs `supabase db reset --local` **before each batch** (`RESET=1` default), so
   cross-batch fixture carryover cannot reach batch 8; and batch 8 ran **`1 worker`**, so
   within-batch execution is strictly serial in file order. The `submittedResponseIds` pool
   (`order=id.asc&limit=N`) is consumed at disjoint indices 1–5 by the five `pdf-printing` tests
   in declaration order, and the failing test is the **first** one, taking index 0. For a
   fixture-pollution explanation to survive, something must mint on index 0 *before* it — and the
   only other minting spec in the whole suite is `pdf-printing-meetings.spec.ts`, which is in that
   same batch and does not touch the response pool. So the shared-pool theory as written is close
   to refuted, and the residue points at a **render/visibility timing** failure on a
   `toBeVisible()` immediately after `page.goto` — the ordinary flake shape.
3. **The surface argument holds.** DM2's diff touches `src/lib/documents`,
   `src/components/documents`, `case-documents-panel`, migrations, tests and one ops script.
   `printed_documents` and `src/components/printing/*` share no module with any of it.

If DM2 had broken this it would fail deterministically; it passed in isolation 9/9, in an
identical-batch re-run, and in a full-suite run. Blocking DM2 on it would be blocking the wrong
artifact. The correct output is a **suite-health follow-up**, not a phase loop:

> **FUP-GATE-PDFP1-FLAKE** — `pdf-printing.spec.ts:38` failed its pre-mint empty-state assertion
> once, unreproducibly, with no infra signal. Next occurrence: **capture the page snapshot and the
> batch log BEFORE re-running** (both were lost this time). First checks, in order: (a) was it a
> `toBeVisible` timeout rather than a populated panel; (b) did `pdf-printing-meetings.spec.ts`
> touch the response pool.

**Process finding, recorded because it is the reusable half:** "re-run to see if it recurs" and
"preserve the evidence" are in direct conflict, and the gate resolves it the wrong way — it wipes
`test-results/` per run and overwrites `batch-N.log` per run. Worth one line in
`docs/testing/e2e-prod-build-gate.md`.

---

## 2. Disposition of every r1 finding

| r1 | Disposition | How I checked |
| --- | --- | --- |
| **P0-1** byte cut absent | ✅ **CLOSED** — cut live in `open_document_version` (catalog); six pins falsifiable; `308` sentinel proven able to fail; E2E asserts the DOOR | three mutations re-executed by me; md5 restores verified |
| — its closure item 3 (the false comments) | ⚠ **PARTIALLY UNMET → r2-1** | `git log` shows the files untouched by any remediation commit |
| **MAJOR-1** interview ceiling | ✅ **CLOSED** — PO ruled PROPAGATE; kernel arm re-pointed; ADR 0117 Amendment 1; K15 red-first 5/124 | catalog; `328` 130/130; over-narrow refuted from `confidentiality_clearance_ok` |
| **MAJOR-2** reconciliation blind | ✅ **CLOSED — and my finding was corrected, rightly** | see below |
| **MAJOR-3** dead retry | ✅ **CLOSED by removal** — `failed` has no outbound D9 arc, so retry was never recoverable; the server short-circuits with no download and no RPC; the dialog renders no submit control | `actions.ts:156-164`; vitest T1–T4 (red-first recorded); E2E `DM2-VERIFY-FAILED-TERMINAL-UI` |
| **MINOR-1** pagination | ✅ **CLOSED** — both walks accumulate with a stable sort; **and the fixture found a second same-class defect I did not name** (the `file_objects` read was a bare `.select()`, PostgREST-capped at 1000) | diff; 1001-row fixture red/green recorded |
| **MINOR-2** unguarded session UPDATE | ✅ **CLOSED** — `.eq('state','reserved')` in the statement, proven with a real two-session interleaving (`consumed` stomped pre-fix, survives post-fix); `expiredSwept` counts rows swept; the `:59` "record it" promise kept at two levels | diff |
| **MINOR-3** stuck `verifying` | ✅ **CLOSED** — 60-min sweep → `failed`, reconciled against the live verifier by a threshold 4× the reservation TTL, deliberately not a second verifier | diff; T4 twin |
| **MINOR-4** discarded pt-BR message | ✅ **CLOSED, and it was worse than I filed it** | see below |
| **MINOR-5** props default to allow | ✅ **CLOSED** — `canWrite`/`canDownload` now **required**; lead ruling accepted (a default deny is still a guess) | diff; tsc 0 |
| **MINOR-6** stale follow-ups | ✅ **CLOSED** — both rows discharged and, correctly, **verified at the source** rather than from the reports | `PROGRESS.md:760-761` |
| **INFO-1** census blind spot | ✅ Recorded as **ADR 0118 §12**, correctly scoped as not-a-DM2-regression | ADR |
| **INFO-2** `documents_wave_a` | ✅ **CLOSED better than asked** — the claim is corrected (`documents_foundation` is the kill switch, wave_a is not) and pinned by `328` **K16**, incl. K16s1 whose detector was proven able to find a planted reference. No flag-pair trigger: ruling accepted — a refuse-style dependency would slow the incident lever | `328` 130/130, K16s1/s2 green |
| **INFO-3** credential wording | ✅ **CLOSED** both halves (`types.ts` + dialog) | diff |
| **INFO-4** Rule 9 exception | ✅ **CLOSED** — DM5 step 5 carries the obligation beside the D8 Rule-1 sharpening | plan |

**On MAJOR-2 — the backend corrected me, and the correction is right.** My finding said
"treat `failed`/`abandoned` as `expectsBytes`". As stated that is wrong: an `abandoned` file
with no object is the *common* case (a reservation that never PUT), and my version would have
minted false MISSING at scale. The shipped contract — **terminal state AND bytes present ⇒
`undisposed`** — is the correct formulation, and extending it to `infected`/`rejected` (same
shape per the CHECK) is an improvement on what I asked for. I verified the classifier is
**total**: against `file_objects_upload_state_check` (10 states) × `file_objects_disposal_state_check`
(3 states), every pair lands in exactly one class, `unclassified` is currently unreachable and
exists as a forward guard that fails loud in *both* directions. `classCounts` summing to the row
count is the right shape here ("a census whose parts do not sum is wrong").

**On MINOR-4 — the frontend corrected me, and that correction matters more than the fix.** I read
the button as rendering the generic fallback where a mapped string existed. Driven for real it
rendered **nothing**: `AlertDialogAction` is Radix's `Action` and closes on click, so `setError`
wrote into an unmounting subtree and the `role="alert"` paragraph was dead UI — a refused delete
left the row in place, unexplained. Mapping the code alone would have "fixed" copy into an element
no user can reach. Both halves are fixed (`preventDefault` + `documentErrorMessage`, with an
out-of-union value still falling back). The reachability correction is right too: the batched
`document_delete_affordances` returns `canDelete=false` under a live hold, so the refusal is a race
from a stale tab, not a steady state. *A safe fallback and a message that cannot render look
identical from the outside* — that lesson is worth more than the two-line diff.

---

## 3. r2 findings

### r2-1 (MINOR — binding pre-merge condition) — P0-1's third closure item was dropped: three sites still assert that a React prop suppresses the byte corridor

r1's "Required to close" item 3 read, verbatim: *"Correct the two false comments
(`document-row.tsx:73-78`, `e2e/quality-oversight.spec.ts:489-496`) and strengthen the E2E to
assert the *door* refuses, not only that the button is absent."* The **E2E half is done**, and done
well. The **comment half was never picked up** — it does not appear in the resumption handoff's
work list, so it was dropped in transcription, not declined.

`git log 29215f4~1..HEAD -- src/components/documents/document-row.tsx` is **empty**: the file has
not been touched since before the P0 fix. Live today:

```
src/components/documents/document-row.tsx:75-76
  * reviewer reads metadata but never downloads). Suppresses the audited door
  * outright; there is no second byte path to also remember to suppress.

src/components/cases/case-detail-view.tsx:727-729
  // ADR 0100 — metadata yes, bytes no. Under the document model
  // this suppresses the single audited byte corridor; there is no
  // second signed-URL path left to also remember.

e2e/quality-oversight.spec.ts:509-513
  // ... `canDownload={!isOversight}` (case-detail-view.tsx) suppresses the
  // single audited byte corridor entirely — `OpenDocumentButton` never
  // renders for her, not merely disabled (there is no second, unaudited
  // path left to also remember to suppress under the document model).
```

Three sites, not two — I missed the `case-detail-view.tsx` call site in r1. All three still say
the prop suppresses the *corridor*. It suppresses the *button*. The corridor is shut by
`app.has_case_capability(v_case, v_uid, 'read_case_deliberation')` inside the door, which none of
them mentions. This is the exact assertion that made a reviewer believe a React prop was the
boundary, that let a green E2E certify a UI-only control, and that this repo's own scar file
records as having shipped a live bug four times ("a comment is an assertion that goes stale
silently"). The spec's block is partly self-correcting — the paragraph below it now says
explicitly that an absent button does not prove a door is shut — but the two in application code
have no counterweight.

**Why this is a condition and not a `CHANGES REQUESTED`.** I considered blocking, because "a
required-to-close item silently evaporated" is precisely this phase's own failure mode. I am not
blocking because the *control* is real, verified three ways, and independently reproduced by me;
what is left is prose. The fix is comment-only across three files: it cannot change behaviour, so
it needs `lint` + `typecheck` and nothing else — no fresh reset, no pgTAP, no `e2e:prod`. Looping
the phase to gate step 1 over three comment lines would cost hours and teach the team that review
verdicts are priced in whole gates. **But it must land before the branch merges or any flag flips**,
and it must be recorded in the QA Verdicts row so it cannot evaporate a second time. Suggested
replacement for all three: *"hides the download control; the corridor itself is shut by the
`read_case_deliberation` conjunct inside `open_document_version` (ADR 0100 D3/D7, QA r1 P0-1) —
this prop enforces nothing."*

### r2-INFO-1 — P0b/P0c's individual reds rest on a focused harness I did not re-execute

Mutation B aborts the file at the first unguarded open, which I reproduced (30 ok, then 191
cascade errors, no `finish()`). That is sufficient for the *suite* property — `329` cannot go green
under B — and the two pins' reds are logically forced by the mutated body. But the quoted
`died: 42501` lines come from a replica harness, and a replica is a second implementation of the
thing under test. Not a defect; recorded so nobody later cites "all six observed red in a clean
run", which is not what happened.

### r2-INFO-2 — the M8 E2E asserts refusal, not *which* refusal

`e2e/quality-oversight.spec.ts:536-540` asserts `openResp.ok` is falsy. A door that 404s, a broken
`m8DocVersionId`, or a blanket failure would satisfy it. The paired positive control in the sibling
test (same version id, coordinator, must succeed) covers most of that, and `329` P0a pins the code
and message exactly — so the contract *is* pinned, just not in the E2E. The two adjacent new probes
in `phase-f2-attachments.spec.ts` / `phase11-interviews.spec.ts` do assert codes (`HC0D8`,
`HC0DG`). One line — `expect(body.code).toBe('42501')` — would make this file consistent with its
own siblings. Tester's call, not a phase item.

### r2-INFO-3 — `disposal_pending` is indeterminate-and-accounted, and Wave B is where that bites

The classifier deliberately never reports a `disposal_pending` row, and the header justifies it:
the Storage delete legitimately precedes the completion door's absence check. That is correct
today because `requestDocumentDisposition` has **no UI caller** in Wave A (the only callers of the
disposal doors are `src/lib/documents/actions.ts` itself, and `complete_document_disposal` is
invoked synchronously by `reclassifyDocument`). The moment a disposal UI lands, a request whose
completion never runs leaves bytes in `documents-phi` that nothing reports and nothing sweeps — the
MAJOR-2 shape, one state over. Worth a line in the DM3/Wave-B ledger now, while the reasoning is
fresh: either a staleness threshold on `disposal_pending` (the MINOR-3 pattern) or a named owner.

### r2-INFO-4 — "exit 127 with the output swallowed" now has two independent sightings

Backend hit it three times with `process.exit()` and libuv's teardown assertion on Windows, and
fixed it by moving to `process.exitCode`; the gate hit the same shape in run 2 batch 5 with
`server_dead=0` / `conn_errors=0`. Both were correctly recorded. The reusable point is the one the
re-gate section already makes: **a runbook keyed on an exit code cannot tell a swallowed report
from a real failure.** Wherever `e2e-prod-gate.sh` classifies on exit codes, exit 127 with an empty
summary deserves its own branch rather than falling through to "failed".

---

## 4. Requirements, security and hygiene — the standing checklist

- **Requirements.** Every DM2 deliverable in the plan's §DM2 and every acceptance bullet is met.
  The two contract obligations r1 found unmet (DM1 keystone obligation 2's door half; S1-O4) are
  now discharged with rulings, mechanisms, ADR amendments and executable pins.
- **Security / RLS.** The boundary is the DB, not the UI, and that is now true *and demonstrated*:
  the byte cut is a catalog conjunct with six falsifiable pins, the D15 ceiling and the new
  interview ceiling both route the single kernel, the document buckets carry INSERT policies only,
  and the three service-role completion doors carry no `authenticated` EXECUTE. `prosecdef` was
  read beside `pg_policies` throughout. `ARM=census` HOLDS at 549/569. The `jsonb`-door blind spot
  is named as a standing platform finding (ADR 0118 §12) rather than papered over.
- **Code quality.** `tsc --noEmit` exit 0; the Rule 9 exception in `src/lib/documents/actions.ts`
  is ADR-justified and now carries a DM5 obligation to name it in ARCHITECTURE.md; the five lint
  gates pass, including `lint:vacuous` over 179 spec files.
- **UX & a11y.** New copy is pt-BR and code-mapped — no raw Postgres string can reach the UI
  (closed union + fallback). The terminal-failure dialog renders no submit control at all rather
  than a disabled one naming an action that does not exist, and the refusal messages carry
  `role="alert"`. Both were driven in a real browser against a written prediction ledger, and both
  ledgers recorded a miss — which is what makes them evidence.
- **Hygiene.** ADR 0117 Amendment 1 and ADR 0118 §§10/12 exist and match the catalog.
  `PROGRESS.md`'s follow-up rows now agree with the phase rows. Working tree clean; branch
  unmerged, unpushed; all five DM flags OFF in production defaults.

---

## 5. What to write in the QA Verdicts table (lead-owned)

> ✅ **APPROVED (r2)** [review](docs/reviews/dm2-orchestration-wave-a-review.md) — r1's 1 P0 · 3
> MAJOR · 6 MINOR · 4 INFO all discharged; **P0-1's proof re-executed by QA, not accepted** (all
> three mutations reproduced in rolled-back txns, restores md5-verified; the `308` 5.2s sentinel
> observed RED under cut-removal with its control green; `can_read_document`'s coverage re-derived
> as 18 reds in `328` under kernel neutralization). MAJOR-1 catalog-confirmed unable to
> over-narrow. Two QA findings were **corrected by the engineers and the corrections adopted**
> (MAJOR-2's classifier contract; MINOR-4 was worse than filed). r2: **0 P0 · 0 MAJOR · 1 MINOR ·
> 4 INFO**. ⛔ **Binding pre-merge condition (r2-1):** three sites still assert that a React prop
> suppresses the byte corridor (`document-row.tsx:75`, `case-detail-view.tsx:727`,
> `quality-oversight.spec.ts:509`) — comment-only, no re-gate required, **must land before merge or
> any flag flip**. `e2e:prod` run-1 red ruled **not phase-attributable** (→ FUP-GATE-PDFP1-FLAKE).

And in the phase-status gate cell: *pgTAP 189f/6097 · lint 5-gate · tsc 0 · vitest 86/1258 ·
`ARM=census`/`hat`/`floor`/`FROMFINDINGS=1 wrapper` HOLD · diff-scoped sweep `can_read_document`
COVERED (`open_document_version` is out of every arm's domain by return-type syntax — ADR 0118 §12;
its assurance is `329` P0a–P0f + the `308` sentinel) · `e2e:prod` GREEN run 2; run-1 red triaged as
non-attributable with the mechanism explicitly unproven.*

---

**Bottom line.** The one thing that made r1 a stop is closed, and closed the hard way: the control
is in the database, the pins can fail, and I proved they can fail rather than reading that they
can. Two of my own findings came back corrected and better than I filed them, which is the sign of
a team auditing the review instead of complying with it. What remains is three sentences of stale
prose in the exact place that caused the P0 — small, but not nothing, and the reason it is a
condition rather than a footnote.

— `qa`, 2026-08-13 (r2)
