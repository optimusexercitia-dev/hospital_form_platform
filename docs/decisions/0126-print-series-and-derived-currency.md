# ADR 0126 — A print belongs to a SERIES, and currency is DERIVED

- **Status:** ACCEPTED — PO-ruled 2026-08-18, after a **second design-review round** found five
  further implications, each ruled below as **D8–D12** (§ Round 2). **Not built** — implementation
  is `FUP-PREVIA-SPLIT-BUILD`.
- **Context:** **Supersedes parts of ADR
  [0125](./0125-previa-ephemeral-and-emission-registered.md) — it amends D1 (D5 below) and D8
  (D7 below).** It exists because 0125's build planning measured things 0125 never did; the two
  false rationales are recorded in **0125 Amendment 1** and are not repeated here.
- **Method note, binding on any successor:** every claim below was taken from the **live catalog**,
  and the enumerations were produced by **sweeping**, not by discovery. 0125's errors both came from
  reading a property off a state list; this document was written by asking which transitions exist.
- **Standing rule, added in round 2 (D10 is the instance that forced it):** every status column the
  registration/currency derivation **reads** imports that column's own transition graph into the
  verification obligation. The read set as of D8–D12: `responses.status`,
  `case_correction_requests.status`, `case_phases.status` + `case_phases.current_response_id`,
  `meetings.status` + `meetings.revision`, and the `supersedes_id` chain. A predicate change that
  widens the read set re-runs the writer sweep over the new column — round 1 swept exactly the two
  columns currency then read, and the void door (D10) sat one column outside that boundary.

## Decisions

**D1 — A registered print belongs to a SERIES, not to a database row.**

`printed_documents` gains `source_series_id`, and the one-active partial unique index moves:

```
- (source_kind, source_id,        template_key) where status = 'active'
+ (source_kind, source_series_id, template_key) where status = 'active'
```

**The defect this closes was invisible and is live today.** Measured: `start_correction_draft`
inserts a **new** `responses` row carrying `supersedes_id = <predecessor>`. So after one correction,
R1 and R2 are unrelated as far as the registry is concerned, and **both can hold an `active` print
at the same time** — one logical document, two current papers, no constraint violated. The registry
exists to answer *"which paper is current for this document"*; keyed to a row, it answers a
different question and answers it confidently.

The series, per kind — and ⚠ this is a **third** per-kind concept, see D7:

| Kind | Series is | Note |
| ---- | --------- | ---- |
| `form_response` | the ROOT of the `supersedes_id` chain | `guard_supersession_coherent` requires `new.supersedes_id = case_phases.current_response_id`, so the chain is **linear, not branching** |
| `meeting` | its own `id` | no revision chain ⇒ the constraint is **unchanged** for meetings, not special-cased. ⚠ Round 2: the HEAD test for meetings is the **revision match** (D9), not constant-true |
| `case` / `interview` | deferred to provider activation | D7 |

⚠ **Stored, not derived — and that is forced, not preferred.** A partial unique index requires a
stored column: the series function reads tables, so it cannot be `IMMUTABLE` and cannot be indexed.
It is computed at mint.

⭐ **The orphan risk is closed by narrowing: `supersedes_id` becomes IMMUTABLE after insert**
(PO-ruled 2026-08-18). `guard_supersession_coherent` fires `BEFORE INSERT OR UPDATE OF
supersedes_id` — it *validates* the chain, it does not **freeze** it, so a re-pointed chain could
otherwise orphan a stored `source_series_id`. Freezing is the narrowing; the rejected alternative was
keeping it mutable behind a drift detector. **A narrowing can be wrong-and-safe; a detector that is
never exercised cannot.**

**Precondition, measured before ruling:** *nothing updates `supersedes_id` today.* No function that
updates `responses` mentions the column, and the two catalog regex hits (`submitted_form_responses`,
`commission_overview`) are false positives matching `where succ.supersedes_id = r.id` — a SELECT
predicate. All 18 app-layer mentions are reads, types, or the INSERT that pre-links a successor.

⚠ **It inverts an existing authorization keystone, and the rewrite must not be a code swap.**
`225_supersession.sql` **t14c** pins that a member's INSERT-then-UPDATE setting `supersedes_id` is
refused with **`42501`** — an *authority* refusal. Under immutability the refusal arrives from a
different guard with a different SQLSTATE, so t14c reds. ⛔ Swapping the expected code would silently
convert a **privilege-escalation** pin into an **immutability** pin — a strictly weaker assertion
wearing the same name. Two obligations follow:

1. Keep an assertion that the **escalation** is refused, not merely that the column is frozen. The
   two properties coincide today and would diverge the moment immutability is relaxed.
2. `guard_supersession_coherent`'s **UPDATE branch becomes unreachable.** Either narrow its trigger
   to `BEFORE INSERT` (a narrowing, therefore safe) or keep it as an explicitly-commented
   unreachable backstop — but do not leave dead authorization code reading as live, and expect the
   ADR 0079 sweeps to notice it either way.

Any future need to re-point a chain goes through a **door**, never a raw UPDATE.

**D2 — CURRENCY is a THIRD derived axis, distinct from the watermark and from the registry status.**

> **current ⇔ the source STILL satisfies the registration predicate AND the source is still the HEAD
> of its series.**

Both conjuncts are load-bearing, and each covers a case the other misses:

| Situation | registers? | head? | current | |
| --- | --- | --- | --- | --- |
| `reject_correction` walks a response back to `in_progress` | ✗ | ✓ | **no** | first conjunct |
| `reopen_meeting` moves an ata to `held` | ✗ | ✓ | **no** | first conjunct |
| R2 **approved**, **nobody has minted revision 2** | ✓ | ✗ | **no** | second conjunct |
| submitted original, no correction | ✓ | ✓ | yes | |

⚠ Round 2 re-worded row 3: it originally read "R2 **created**", which is the wrong grain — head
turns at the **approval door**, not at draft creation (**D8**).

Head-only would leave a source walked back to editable still reading as *current* while its content
can change underneath. Registers-only would leave a corrected R1 — which stays `submitted` — reading
as current forever. ~~Meetings have no chain, so they are always head and the second conjunct is a
no-op there, not an exception.~~ ⚠ **Falsified in round 2:** that constant-true declaration is
exactly what the reopen → edit → re-advance corridor exploits; head for meetings is the **revision
match** (**D9**).

⭐ The first conjunct **is** 0125's registration predicate, so currency costs one new per-kind
concept (head), not two.

**D3 — Currency is DERIVED at read time and never stamped. Nothing writes on a reversal.**

`printed_documents.status` keeps exactly its present meaning: **deliberate acts only** — re-mint
supersession (ADR 0104 D6) and revocation. A print may therefore be `status = 'active'` **and not
current**, which is a new and legal combination that both `/verificar` and the in-app panel must
express.

⛔ **Rejected: a trigger that flips `status` on reversal.** It would need three writers —
`reject_correction`, `reopen_meeting`, `supersede_response` — of a single fact. That is this
codebase's recurring drift class, and the drift would be silent. ⛔ **Rejected: both mechanisms.**
Two computations of one property can disagree, and nothing reds when they do.

⭐ **This is architecturally available, and that was measured rather than hoped.**
`app.guard_response_active_print` refuses a DELETE for `status in ('active','superseded')`, and
`documents_home_resource_id_fkey` is `ON DELETE RESTRICT` — so **a non-revoked print's source is
guaranteed to still exist.** Verification may therefore join the source for `active`/`superseded`
prints, while `revoked` prints report `ANULADO` with **no join at all**. That preserves the
independence property `312` t76 relies on (*"lookup_printed_document never joins responses"*), which
is what lets a paper-holder still verify a document whose source was later discarded.

**D4 — `superseded` ≠ `revoked`, and NOT-CURRENT is a distinct THIRD term.**

`/verificar` gains its own statement for the new combination — *"Documento autêntico — emitido de uma
revisão que não é mais a atual"* or equivalent. The two rejected shortcuts:

- **Reusing `Substituído`** would assert that a **newer print exists** when none does. An auditor
  who then asked for the superseding document would be asking for one that was never emitted.
- **Saying nothing** would let a stale page present itself as current, which is the whole defect.

`Anulado` continues to mean *void*. `Emitido` remains reserved for the registered act (0125 D5). The
page states **authenticity and currency as two separate facts**, because they are.

**D5 — 0125 D1's lock predicate is REFINED: a state a door can walk back out of is not a lock point.**

> `form_response` registers ⇔ `status = 'submitted'` **AND NOT** the draft of an open, still-rejectable
> correction request.

⚠ Round 2: the predicate gains a **third conjunct** — the attached phase, if any, is not `voided`
(**D10**, with the operational definition of "open, still-rejectable") — and the watermark moves
**in tandem** (0125 **Amendment 2**), which is what keeps 0125 D5's fourth cell unreachable.

Measured: `reject_correction` is `staff_admin`-gated and takes its target from
`case_correction_requests.draft_response_id`, so it can **only ever** walk back a *correction draft* —
never an original. `submitted` is therefore **terminal for an original and non-terminal for a
correction draft**, and 0125 D1 treated the two identically.

⭐ **This is the single change that removes four problems at once**, because it deletes their shared
subject rather than handling them:

- The **un-withdrawable correction** — `withdraw_correction` deletes the draft, that DELETE hits
  HC069, and the correction cannot be withdrawn. Gone: the draft never registered.
- The **coordination-invisible print** — measured, `app.can_read_correction_response` grants only
  `permitted_corrector`, who **is** `created_by` on the product path, so arms 1 and 3 of
  `can_view_printed_document` resolve to the **same human** and arm 3 adds *zero* coverage. There was
  a window in which a registered print was visible to nobody but its creator, and the coordinator
  entered it **by their own `reject_correction` call**. Gone.
- The **governance door** (`list_printed_documents_for_governance`) — no longer has a subject.
- The **auto-revoke question** (D6) — no longer arises.

⇒ **`FUP-DM5-DRAFT-PRINT-INVISIBLE-TO-COORDINATION` closes by construction**, this time for a reason
that survives the transition graph.

⚠ **And it makes 0125 D7's conclusion true after all.** No response can now be simultaneously a draft
and hold a registered print, so HC069 is genuinely unreachable — meaning `312` §9's fixture **is**
unconstructible and the **table-level rebuild 0125 D7 called for is required**, reversing the
interim guidance given during build planning. The guard and the ADR 0123 D3 key-share lock are
retained exactly as D7 ruled.

**Cost, stated:** a submitted correction draft prints only as a **prévia** until the correction
resolves. That is the honest reading — a document under an open, rejectable correction is not
settled — and paper is still available on demand under 0125 D2.

**D6 — The reversal doors are NOT blocked, and revocation is NOT automated.**

`reject_correction` and `reopen_meeting` keep working untouched. A source's lifecycle is its own
domain's business, and a printing module that could veto a correction rejection or a meeting reopen
would have acquired a hold over two other domains' workflows.

⛔ **Auto-revoke is refused on measurement, not on taste.** `withdraw_correction` authorizes
`auth.uid() in (requested_by, corrector) OR is_staff_admin_of(commission)`, while
`revoke_printed_document` requires `staff_admin OR tenancy_admin`. An automatic revoke there would
let a **plain corrector cause a revocation they cannot perform directly** — an authority bypass
through a side door. It also contradicts ADR 0104 D6, which makes revocation a deliberate act
carrying a mandatory reason class *and* free text; an automatic one has neither author nor reason.

⛔ **Auto-supersede was considered and does not help.** `guard_response_active_print` blocks
`active` **and** `superseded`, so superseding leaves the DELETE refused and the dead end intact. It
was the intuitive fix and it is a no-op.

**D7 — Every kind now declares THREE concepts** (this amends 0125 **D8**, which mandated two): a
**lock** predicate, a **watermark** predicate, and a **series**. All three are declared separately
even where they coincide, and all three are deferred to that kind's provider activation for `case`
and `interview` — the same activation model as ADR 0104 D15.

⚠ Round 2 makes it **four**: the **head test** is its own per-kind declaration (`form_response`:
approved-successor, **D8**; `meeting`: revision match, **D9**; `case`/`interview`: deferred with
the rest). Round 1 derived head from the series by fiat — for meetings that fiat was constant-true,
and D9 records what it cost.

The reason 0125 D8 insisted on separate declaration holds a fortiori here: `form_response` collapses
lock and watermark onto `submitted`, and that coincidence is exactly what made a single predicate
look sufficient until meetings were examined. A kind that lets one declaration serve three roles will
be wrong the first time its lifecycle grows a step between any two of them.

## Round 2 — five implications found in a second review and PO-ruled (2026-08-18)

The review that ratified this document (PROPOSED → ACCEPTED, and 0125 Amendment 1 with it) walked
the accepted design against the live catalog once more and found five implications. Same method:
every claim measured, every enumeration swept, zero-hit sweeps proven able to hit. Where a ruling
refines D1–D7, the refined text is marked in place above.

**D8 — HEAD is defined at the APPROVAL grain, and the definition must survive the responses no
pointer ever references.**

Chain-tip semantics ("head ⇔ no successor row exists") would flip the original's print to *"não é
mais a atual"* the moment `start_correction_draft` inserts R2 — before any content is approved —
and flip it back on withdrawal or rejection: currency flapping on a public page, driven by a
low-authority act, disclosing an in-flight correction to any paper-holder. Measured:
`case_phases.current_response_id` moves **only** in `approve_correction`
(`sync_case_phase_on_submit` returns early for successors — its own BE-2 comment: *"approval owns
effect-taking"*). Head aligns to that door:

> **not-head ⇔ a direct successor exists whose correction request is `approved`** — equivalently,
> the phase pointer has moved strictly past the source along the (linear) chain.

Chosen over raw pointer equality (`head ⇔ source_id = current_response_id`) on a measured edge: an
ETH·E2 **targeted-respondent defense** response is phase-attached but the pointer never references
it (`sync_case_phase_on_submit` skips `target_case_participant_id` rows), so pointer equality would
leave every registered defense print permanently not-current. Phase-less and chainless responses
are trivially head. D2's row 3 is re-worded in place under this ruling.

**D9 — meetings gain a REVISION, and head for meetings is the revision match, not constant-true.**

The corridor D2 could not see: mint at `signed` → `reopen_meeting` (measured: revokes signatures,
returns the meeting to `held`, where minutes are editable) → edit → re-advance → re-sign → nobody
re-mints. The registration predicate is satisfied again, head was declared always-true, so the old
print — whose `content_hash` pins content that **no longer exists** — reads *current*. That is
D4's own named defect ("a stale page presents itself as current"), reached by walking OUT of the
registering set and back IN with different content. Amendment 1 §D checked the reversal
transitions; it never asked about the round trip. `form_response` is immune precisely because its
reversal machinery spawns a **new row** — there, the head conjunct does the real work. Meetings got
`head ≡ true` as a by-product of "series = own id", and that fiat constant is the hole. Ruling:

- `meetings.revision` (integer, default 0), bumped **only** by `reopen_meeting` — the platform's
  one backwards door on `meetings.status` (Amendment 1 §D's sweep).
- The mint stores it on the print, exactly as `source_series_id` is stored: computed at mint,
  frozen thereafter. **Head for a meeting print ⇔ `print.source_revision = meeting.revision`.**
- Currency stays fully derived; nothing writes registry state on a reversal (D3 intact).
- ⛔ Rejected: auto-supersede on reopen — a meeting RPC writing registry rows, and `Substituído`
  would assert a newer print exists when none does, the exact lie D4 refuses. ⛔ Rejected:
  accept-and-document — the defect class this ADR exists to close.
- Named as legal, not a defect: a RASCUNHO print minted at `in_signature` stays current after the
  meeting signs (same revision, content identical, the paper honestly reads *não assinado*). The
  `/verificar` page states watermark and currency as separate facts (D4) and needs no new statement
  for it.

**D10 — a VOIDED phase's response neither registers nor stays current; the void corridor sat
outside the swept boundary.**

Measured: `approve_correction(kind='void')` sets the **phase** to `voided`, clears its result,
moves no pointer, and never touches the response — which stays `submitted`. The request closes, so
D5's predicate is satisfied again, head is untouched, and the print of a formally annulled phase
reads *"autêntico e atual"* forever. Neither 0125 nor round 1 mentioned void, because Amendment 1
§D's sweep bounded itself to the two status columns currency then read — while D5's own refinement
had already widened the read set to `case_correction_requests.status`. The class is now the
standing rule in the method note. Ruling — the `form_response` registration predicate gains a
third conjunct:

> registers ⇔ `status = 'submitted'` **AND NOT** the draft of an open, still-rejectable correction
> — operationally: no `case_correction_requests` row with `draft_response_id = id` and
> `status in ('resubmitted','under_review')`, the exact set `reject_correction` accepts; in
> `requested`/`in_progress`/`rejected` the draft is not `submitted`, and in `approved`/`withdrawn`
> the request is closed — **AND** the attached phase, if any, is not `voided`.

Void thereby derives to **not-current at read time** (first conjunct), and a voided phase's
response can no longer mint registered paper. No writer; D3 intact. Measured before ruling:
`voided` is **terminal** — `activate_phase` refuses anything but `pending` (HC019) and no other
door leaves `voided`; a future un-void door re-opens this question and inherits the standing rule.
⛔ Auto-revoke at void approval was declined again — **not** on authority this time (the void
approver IS `staff_admin`, who holds revoke authority; D6's bypass argument does not transfer to
this path) but on ADR 0104 D6's shape: revocation carries a deliberate author and a mandatory
reason class. The UI **may** prompt the approving admin to revoke deliberately; that is UX, not a
dependency of this ruling. The watermark follows in tandem — 0125 **Amendment 2**.

**D11 — meetings get the symmetric backstop, `guard_meeting_active_print`, plus a keystone on the
anchor that actually holds today.**

D3's guarantee — *"a non-revoked print's source is guaranteed to still exist"* — holds for meetings
through a chain neither document named correctly: the mint creates a `documents` row
(`printed_documents.document_id`) homed on the source's securable resource;
`documents_home_resource_id_fkey` sits on **`documents` → `securable_resources`** (`ON DELETE
RESTRICT`); deleting a meeting fires `trg_drop_securable_resource`, and **that** trips the
RESTRICT. Amendment 1 §B credited "an unnamed FK" as if it guarded the meeting delete directly —
the real anchor is one domain over and two hops deep. Measured today it holds: no function
hard-deletes a `documents` row (swept, with a positive control proving the sweep can hit) and
`documents` carries a SELECT-only policy. But the anchor's **owner is the documents domain**, and
the disposal program (C1a/C1b, `complete_document_disposal`) is precisely the future writer that
will delete document rows — the day it does, a reopened `held` meeting with a registered print
becomes deletable (`guard_meeting_status` allows `held`; the RLS delete policy admits any
`staff_admin`) and the registry row orphans, breaking the very join D3 authorizes. Ruling, on 0125
D7's own rationale (a backstop costs nothing; omitting one is a widening):

- **`guard_meeting_active_print`** — BEFORE DELETE on `meetings`, refusing while any
  `active`/`superseded` print exists — the exact symmetric of `guard_response_active_print`.
- A table-level keystone pinning it, with the differential (delete a `held` meeting with a print →
  refused; revoke the print → the same delete **succeeds** — the t76/t80 shape).
- The RESTRICT chain stays as defense-in-depth, now named.

**D12 — `/verificar`'s anonymous currency verdict is BLESSED, and the door widening is named.**

Computing currency forces the lookup door to join `responses`, `case_phases`,
`case_correction_requests` and `meetings` — an anon-reachable DEFINER door growing its read
surface — and the verdict itself tells any paper-holder that a newer state exists (*"não é mais a
atual"* ⇒ an approved correction or a meeting reopen happened). PO-ruled: **blessed.** Currency is
the page's product purpose (D4 already makes it a stated fact), the page already discloses
`Substituído`/`Anulado`, and the verdict names no content, actor, or reason. The rejected
alternative — currency for authenticated members only — would blind exactly the paper-holding
surveyor the verdict exists for, and would split one page's truth in two. Obligations: the widened
door goes through the diff-scoped ADR 0079 sweep at build, and the `revoked` arm keeps its
**no-join** independence (D3, `312` t76).

## Consequences

- **No data migration.** Production holds `0` prints (measured 2026-08-18, ADR 0123 D4) and local
  resets, so the constraint swap — which is a **narrowing** — cannot fail on existing rows. This
  window closes when the pilot loads data.
- ⚠ **The mint door's `SUPERSEDE_ACTIVE` update is keyed on `source_id` and must move to
  `source_series_id`.** Without it the new index is enforced against a supersession step that still
  thinks in rows, and the mint starts failing on the second revision. This is **not** a fourth
  kind-conditional site — it is one unconditional column swap.
- The series is computed by a **kind-dispatch**, like the registration predicate, and for the same
  reason: `mint_printed_document`'s own body forbids a fourth kind-conditional site
  (*"REGISTRATION-MIRROR TRIO, site 3 of exactly 3 … stop and re-plan, never extend"*).
- **`312` §9/§10 rebuild table-level** (D5 above), and `313`'s meeting fixtures — every one of which
  sits at the `'scheduled'` column default, measured — must be advanced to `in_signature` or they
  invert and take ~23 downstream assertions vacuous with them.
- ⛔ **Currency needs its own keystones, and they must be two-sided.** A predicate stubbed to
  "always current" passes every not-current test that only asserts the negative; a predicate stubbed
  to "never current" passes every positive one. Both directions, per conjunct — the t76/t80
  differential shape. Round 2 adds the corridor cases: the D9 round trip (reopen → edit → re-sign →
  old print NOT current; re-mint → new print current) and the D10 void (void → NOT current; the
  differential is the un-voided sibling).
- ⚠ **The mint corridor is a TOCTOU, and the predicate must be evaluated where the INSERT is.**
  The render is out-of-band (HTML → Gotenberg, seconds), and both reversal doors can fire
  mid-corridor. The registration predicate is therefore evaluated **inside
  `mint_printed_document`'s transaction** (the kind-dispatch the door calls once), and the door
  compares the source state observed at render time against the row it reads (compare-and-mint) —
  otherwise a registered hash can pin bytes of a state that never coherently registered.
- **The vector fixture is reshaped in THIS change, not deferred to the build:**
  `print-source-registers-vectors.json` gains `correction_open` / `phase_voided` dimensions and
  the D10 / 0125-Amendment-2 vectors; the generator and sync test follow; `noFinalEphemeral` stays
  asserted and true. ⚠ The vectors cover the two **mint-time axes only** — currency/head is **not
  vector-expressible** (it needs chain, pointer and revision state); its coverage is the two-sided
  keystones above, and nothing should read the vector suite as covering it.
- **Still OPEN, carried and not inherited:** the commission-level cascade path from 0125's residual
  pair (its sibling — delete inside a meeting RPC — is closed by measurement, 0125 Amendment 1 §C).
- Out of scope, named so it is not read as covered: the lock, watermark and series declarations for
  `case` / `interview` (D7 binds the principle and defers each to provider activation).

## Amendment 1 — eleven findings from BUILD, not from review (2026-08-18)

- **Status:** ACCEPTED. They sum: **2 PO-ruled design extensions** (§A, §F) · **4 corrections of fact** (§B,
  §C, §D, §G) — claims this ADR or 0125 states *as measured* which the live catalog contradicts · **4 method
  rules earned in the build** (§E, §H, §I, §J) · **1 live defect found and closed** (§K). Only the extensions
  were ratified; the rest are **recorded**, because a measurement is not a decision.
- **Method:** every item below was measured against the live catalog by the implementing teammate **and
  re-measured independently by the lead before acceptance**. Two items exist *because* the second measurement
  disagreed with the first (§H, §I).

### A — D8's HEAD definition has a STANDALONE lane it never covers (extension, PO-ruled)

D8 defines *not-head ⇔ a direct successor exists whose correction request is `approved`*. That is the
**case-phase** corridor. `public.supersede_response` (DEFINER, `staff_admin`-gated) creates a successor for a
**standalone** response with **no correction request at all** — measured, it is standalone-*only* by
construction, raising `HC0H1` when `case_phase_id is not null`. So under D8 as written a corrected standalone
original is head **forever** and its stale print reads *"atual"*: D4's own named defect.

> **Ruling — head is defined per LANE, at the grain where each lane's effect is taken:**
> `form_response` is head ⇔ **no direct successor has TAKEN EFFECT**, where taken-effect is
> — phase-bound successor: its correction request is `approved` (D8 verbatim);
> — standalone successor: the successor is **`submitted`**.

The standalone arm **reuses the platform's existing effectiveness rule** rather than inventing one:
`app.submitted_form_responses` already excludes a row pointed at by a `submitted` successor, and its own
comment states the principle — *"A merely in_progress successor does NOT exclude the predecessor — a
half-finished correction never blanks the metric."* It therefore inherits D8's rationale intact: currency does
**not** flap on draft creation, because `supersede_response` inserts its successor `in_progress`. D8's measured
ETH·E2 edge is unaffected — a targeted-respondent defense has no successor and is trivially head.

Successor-lane writer sweep (run separately, **not** inherited from the predecessor sweep): only
`reject_correction` moves a row out of `submitted`, and it takes its target from
`case_correction_requests.draft_response_id`, so it can only ever touch a **phase-bound** successor.
`submitted` is therefore terminal on a standalone successor and head-loss is monotonic.

### B — D12's "anon-reachable DEFINER door" is true at the PRODUCT level and false at the POSTGREST level

Measured: `public.lookup_printed_document` has `proacl = {postgres=X/postgres, service_role=X/postgres}` —
**no `anon`, no `authenticated`** — and it differs from both its siblings, which carry `authenticated`. It is
reached by anonymous users **only** through `src/lib/queries/printed-documents.ts`, which calls it with the
**admin** client.

⇒ The widening D12 blesses needs **no ACL change**. D12's *conclusion* (bless the verdict) and its *obligations*
(the diff-scoped ADR 0079 sweep over the widened body; the `revoked` arm keeps its no-join independence) both
stand unchanged. Only the characterisation of the door was wrong.

### C — D9's parenthetical *"(same revision, content identical …)"* is FALSE

D9 names as legal that a RASCUNHO print minted at `in_signature` stays current after signing, *"same revision,
**content identical**, the paper honestly reads não assinado"*. Measured: `meeting_signatures` carries **only**
an audit trigger — **no child lock** — so `sign_meeting` changes the rendered footer from `renderUnsigned`
(*"— não assinado —"*) to rendered attestation blocks. **The content is not identical.**

**The conclusion survives; the mechanism does not.** It survives on D4's own grounds — watermark and currency
are stated as two separate facts — not on byte-identity. See §E for the bound that replaces it.

⚠ This is the **fourth** *right-conclusion-wrong-mechanism* instance in this ADR pair (0125 Amendment 1 §A and
§B were the first two; D9's own constant-true head fiat was the third), and it recurs **inside the document
written to record that class**. A rule its own authors keep violating needs a mechanical check, not another
sentence — filed as `FUP-LINT-VECTOR-DIMENSION-DRIFT`, deliberately not built here.

### D — D6's one-line authority description is wrong for MEETINGS

ADR 0125 D6 says the prévia's authority is *"exactly source-read authority"*. Measured per kind:

- **`form_response` — exact, arm for arm.** `responses_select ∪ responses_select_targeted` equals
  `can_view_printed_document`'s form_response arm verbatim. No persona RLS admits is refused a prévia.
- **`meeting` — NARROWER, and a real persona falls in the gap.** `meetings_select` is
  `is_member_of AND (commission_default OR attendee)`; the gate adds `can_read_full_meeting_content`, false for
  a case-respondent on a case-linked agenda item, or where deliberation text exists and the caller lacks
  `read_case_deliberation`.

**The gate stands; the description is corrected to *source-read AND unmasked-content*.** Decisive reason:
`buildMeetingPayload` has **no masked rendering path** (its own header: *"A7 guarantees this provider only runs
UNMASKED"*), so serving that persona would render a partially-blank ata **with no indication anything was
removed** — worse than a refusal, and the artifact class ADR 0104 D7 exists to prevent. It also composes: the
same gate fronts the state read, so the UI hides the action rather than surfacing a 403.

### E — the BOUND on what currency claims (ratified, and it replaces §C's reasoning)

> **Currency answers *"is this print of the current REVISION of the source record"*, NOT *"would a re-render be
> byte-identical"*.** For meetings the two differ **by construction**.

Two writers were measured that change rendered meeting content without changing the revision, and **neither
gets a conjunct**, deliberately:

- `sign_meeting` (§C) — the forward, expected progression; already legal under D9.
- `action_items` — the ata renders each linked item's status/assignee/due **live**, and an item on a `signed`
  ata legitimately moves `Aberto → Concluído`. A conjunct here would flip every signed ata to not-current the
  moment anyone completes a task: a **wrong answer, confidently delivered**.

Writing the weaker claim down is what stops the next reader treating currency as a content-integrity guarantee
it was never able to be.

⭐ **Stated positively, because it is what makes the bound safe:** `app.guard_meeting_child_lock` is installed on
**four** child tables (`meeting_agenda_items`, `meeting_attendees`, `meeting_cases`, `meeting_closed_sessions`)
and reads **no** RPC flag at all, so it refuses even inside RPCs. Agenda, attendee and closed-session content is
genuinely frozen for every registering state, and is therefore not a currency exposure.

### F — DISPOSAL: a third registration conjunct for `meeting`, with the watermark in TANDEM (extension, PO-ruled)

Measured: `dispose_meeting_minutes` nulls `minutes_md` and redacts every `meeting_agenda_items` text column on a
**locked** meeting, touching neither `status` nor `revision`. A registered print would pin a `content_hash` for
bytes the source no longer holds and read *"autêntico e atual"* — D4's named defect, through a door neither
document enumerated.

> **`meeting` registers ⇔ `status in ('in_signature','signed','distributed')` AND `phi_disposed_at is null`.**

Placed in **registration**, not in currency, on **D10's symmetry**: disposal is the meeting analogue of a voided
phase — a deliberate, authorized, terminal annulment of the source record. Currency then falls out through D2's
first conjunct with **no second site**, and it closes a hole neither document had named: **a disposed meeting
could otherwise still mint NEW registered paper.** 0125 D2's protected interest is untouched — a prévia remains
available on demand.

⛔ **It could NOT go in registration alone.** A `signed`+disposed meeting would be `registers = false` while the
watermark arm delegates to `meetingWatermarkFor('signed') = 'final'` — **0125 D5's forbidden fourth cell**. So
0125 **Amendment 2**'s answer applies again: the watermark moves **in tandem**, composing the disposal term on
top while `meetingWatermarkFor` stays **byte-identical**.

⚠ **This is the SECOND time the fourth cell was nearly lost to a lock refinement that moved alone** (Amendment 2
was the first). Two instances is a pattern, so it becomes a standing obligation:

> **Any refinement to a kind's LOCK predicate must re-derive that kind's WATERMARK in the same change, and the
> vector fixture must gain the row that would have caught it.**

⚠ A separate, **pre-existing** defect was found at this door and is **not** fixed here:
`dispose_meeting_minutes` sets `app.in_meeting_rpc` with the comment *"bypass the meeting freeze guards"*, but
`app.guard_meeting_child_lock` does not read that flag — so PHI erasure **raises** on any locked meeting that
has agenda items. Filed as `FUP-DISPOSAL-CHILD-LOCK-BLOCKS-PHI-ERASURE`; it blocks Critical FUP C1a/C1b.

### G — `t14c` does not exist; the label is `14c`

ADR 0126 D1 obligation 1 names `225_supersession.sql` **`t14c`**. `grep -rn "t14c" supabase/tests/` returns
**zero hits tree-wide** — that file's labels are `14a`/`14b`/`14c`/`14d`/`14e`; the `t` prefix is `312`'s
convention. A name-keyed reference that does not resolve.

⭐ **And D1 obligation 1's fear was measured to be unfounded, for a better reason than it assumed.** The
privilege-escalation property does **not** depend on `14c`: `14a` independently pins *"a non-admin staff
member's DIRECT INSERT setting `supersedes_id` is refused (42501) — the core exploit"*, with `14b` as its
non-creation control and `14d` covering the flag-off path. Narrowing `guard_supersession_coherent_trg` to
`BEFORE INSERT` therefore leaves the escalation property with **three INSERT-path homes**, and `14c` converts
cleanly to the immutability pin. ⚠ The obligation was still right to demand the check: a trigger-ordering
measurement showed `guard_supersedes_id_frozen` sorts **before** `guard_supersession_coherent`, so had both
stayed on UPDATE the immutability refusal would have **pre-empted** the authority refusal — silently performing
the exact conversion the obligation forbids.

### H — sourcing a derivation's inputs: the DIRECTION of the failure decides the mechanism

`getResponsePrintContext` sources `correction_open` / `phase_voided` from the **DEFINER door**, not from an
inline join under the caller's RLS. The reason is not convenience:

> Read under the caller's own RLS, a correction request or voided phase the caller **cannot see** returns
> **absent** → the flags default `false` → the page stamps **FINAL**. That is a fail-**OPEN** failure landing on
> exactly 0125 D5's fourth cell, reached by a **permissions accident** rather than a logic error — on a path
> where every test is green because every test's principal can see everything.

⇒ **Where a predicate's `false` is the permissive value, its inputs must resolve with DEFINER truth *after*
gating, so the answer is either correct or absent.** Absent fails closed upstream.

### I — three claims in this build's own reporting were false, each by a different route

Recorded because the ADR pair's recurring theme is *text that reads true*, and all three were caught only by
re-measuring. They are one class with three distinct failure routes:

1. **From hitting a wall — the TIMING half.** Two `⛔ NOT WIRED YET` markers were written into the code stating
   that `getResponsePrintContext` and `getMeetingDetail` expose no correction/disposal state. Both had landed
   one turn earlier (`meetings.ts:137`, `printed-documents.ts:272/274`). The measurement was **true when taken
   and false when written down**.
2. **From a teammate's plan — the SOURCE half.** A `PrintSourceState` type-name collision was reported as
   certain (*"they **will** collide in any module importing both"*) about a file never opened. Measured
   afterwards, the type is declared **once**, with zero hits in `src/lib/queries/`. The provenance *was* hedged
   ("backend's **posted** return type") — but the conclusion drawn from it was not, and an accurately-sourced
   claim with an unverified conclusion still lands a false fact.
3. **From two secondhand accounts — the ADJUDICATION variant.** The lead ruled on that collision without
   opening the file, arbitrating between two reports. **An arbitration reads authoritative whether or not its
   subject exists.**

⇒ **A claim about another teammate's code must be measured in their file at write-up time** — whether it came
from hitting a wall, from their plan, or from someone else's report of it. **A plan is not truth about code,
any more than a migration file is truth about the catalog.**

### J — a keystone can stop being exhaustive without anything going red

The ADR 0125 D5 fourth-cell sweep was widened from 220 to **440 probes** when the `meeting_disposed` dimension
landed — but the widening was written **in a comment first and in the code never**. For one build cycle the
sweep crossed `correction_open × phase_voided` only and was structurally blind to the new flag.

⇒ **The fourth-cell keystone could not have caught §F's tandem-move error**, which is the error this ADR's own
lead made. Nothing reds when a sweep silently stops being exhaustive, because a narrowed sweep still passes
everything it *does* check. Verified by reverting the watermark arm: 440 probes red, 220 green.

The structural fix pins the chain *fixture dimensions → consumer state-mapping keys → probe keys*, and requires
every boolean dimension to vary in **both** directions — a key that is present but constant is a dimension in
name only. Generalised as `FUP-LINT-VECTOR-DIMENSION-DRIFT`.

### K — LIVE DEFECT, found on the public page: `/verificar` was already asserting currency, from the registry axis

Found while implementing D4's third term, not by looking for it. The `active` arm of
`src/components/verification/verification-result.tsx` read (git HEAD, line 217):

> *"Esta emissão foi gerada pela plataforma **e é a emissão vigente deste documento**."*

That second clause is a **currency claim derived from `printed_documents.status`** — precisely the conflation
**D3** exists to break. `status` records **deliberate acts only** (re-mint supersession, revocation); currency
is derived at read time from source state. D2 establishes that a print may legally be `status = 'active'` **and
not current** — so the anonymous verification page has been telling every paper-holder that an active document
is the current one, **with no evidence for it and nothing able to contradict it**.

**It predates this build and was live in production copy.** Removed; the arm now says only
*"Esta emissão foi gerada pela plataforma."* Red-proved — restoring the clause reds the test.

⭐ **The class, which is this amendment's recurring one arriving from a new direction: a fact asserted from an
adjacent fact that used to imply it.** `active ⇒ vigente` was *true* while the registry was the only axis.
D2 added a third axis and the sentence did not change — so a true statement became an unchecked claim with no
edit, no diff, and no test to fail. ⚠ Note the direction: the other instances in this amendment are records
going stale against the *catalog*; this one went stale against a **decision**, which is worse, because a
decision leaves no artifact a sweep can compare against.

⇒ **Adding a derivation axis obliges a sweep of every surface that already states a verdict on the old axes.**
The build did not do this — it found this instance by chance while editing the same file for another reason,
which means the sweep is still owed for any *other* surface asserting currency, recency or supersession from
`status` alone.

**Interim posture, stated so it is not mistaken for completion:** the page is now **silent** about currency
rather than **wrong** about it. That is a strict improvement, it is available without any backend dependency,
and it is not the finished state — D4's third term is built and tested but not yet wired, pending the currency
verdict on the lookup door.
