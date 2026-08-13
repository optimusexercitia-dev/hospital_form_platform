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
