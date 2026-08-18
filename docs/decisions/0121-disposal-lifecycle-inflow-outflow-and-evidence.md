# ADR 0121 — Disposal lifecycle: inflow, outflow, and what `disposed` asserts

> ## ⛔⛔ AMENDMENT 1 (2026-08-17, later the same day) — **ACCEPTED ≠ IMPLEMENTED. Only D4 shipped.**
>
> This ADR was written as one lifecycle and is **not in force as one.** Read this before quoting any
> decision below as describing the system.
>
> | decision | ratified | in the tree today |
> |---|---|---|
> | **D3 / D5** — superseding marks bytes for disposal (the **inflow**) | ✅ | ⛔ **BUILT, THEN REVERTED** (`6181557e` → `5b40d62b`) |
> | **D2** — the cron **outflow** that completes a disposal | ✅ | ⛔ **DOES NOT EXIST** (`FUP-DM5-DISPOSAL-JOB`, 🟠, blocking pre-pilot) |
> | **D4** — what `disposed` asserts (`byte_proof` + `metadata_source`) | ✅ | ✅ **SHIPPED** (`20260928000400`) — independently correct, purely additive |
>
> **Why the inflow was reverted, and it was the Phase Gate that caught it, not review.** `312` t38 —
> *"a revoked document still SERVES"* — died with `documento descartado`.
> **`app.resolve_document_version_bytes:72` refuses on `disposal_state <> 'none'` — ANY non-`none`
> state**, so marking a superseded print `disposal_pending` **stopped its PDF opening the instant the
> document was re-issued.** That collides head-on with **ADR 0120 D6/D8**: a print's states change what
> the overlay STAMPS, never its reachability. ⭐ **The collision is exactly one value wide and both
> sides are right** — refusing to serve is correct for `subject_request` and `retention_expired`, wrong
> for `superseded`.
>
> ⏸ **PO RULING 2026-08-17: DECIDE LATER; the inflow stays reverted.** Both resolutions were declined
> for now — widening `app.resolve_document_version_bytes` for `superseded`, or reinterpreting D3/D5.
> ⭐ *Widening a PHI byte-serving gate is not a change to make unilaterally, which is why this reverted
> rather than patched: a narrowing can be wrong and safe, a widening cannot.*
> Tracked as **`FUP-DM5-SUPERSEDE-SERVING-COLLISION`** (🔴, **open**) — **D11 cannot be rebuilt until
> it is decided, and DM5·S6 may not close over it.**
>
> ✅ **SUPERSEDED BY AMENDMENT 2 (2026-08-18) — the deferral is DISCHARGED and the collision is
> RULED.** The PO chose the **reinterpretation**, not the widening: supersession no longer marks bytes
> at supersession time. Read Amendment 2 before quoting anything above as the current position; the
> paragraph is kept because *why* the inflow reverted is still the reason the ruling took the shape it
> did.
>
> ⚠ **So the three follow-ups the Context line says this ADR "closes" are NOT closed.**
> `FUP-DM5-D11-SUPERSEDED-NEVER-RETIRES` and `FUP-DM5-DISPOSAL-JOB` are both still open; only the
> `NO-ANSWER` instance-3 half moved, via D4. ⛔ **The two are the same deferral seen from opposite
> sides** — inflow and outflow — and the ADR's own argument for why they must not be resolved
> separately (the ⭐ note below) is *why* deferring both together is coherent rather than a schedule slip.
>
> ⚠ **Still owed whenever the job lands:** a **keystone for D4** (its behaviour is verified by a
> rolled-back probe recorded in the commit, which is a measurement, **not** a regression gate) and a
> rewrite of `343_dm5_s5_disposal_gap.sql`, whose **K6b asserts "no scheduler exists at all"** — true
> today, a **false pin** the day D2 ships. **Rewrite 343 in the same slice as D2, not after.**

> ## ✅ AMENDMENT 2 (2026-08-18) — **THE COLLISION IS RULED: supersession no longer marks bytes. The trigger moves to RETENTION EXPIRY; the serving gate is NOT touched.**
>
> **PO ruling, taken at the DM5 gate-step-4 decision docket.** Of the two resolutions Amendment 1
> left open, the PO chose **(b), the reinterpretation** — and declined **(a), the widening**, for the
> reason Amendment 1 already gave: *a narrowing can be wrong and stay safe; a widening cannot.*
>
> **The ruling, stated so it can be built:**
>
> 1. ⛔ **Supersession does NOT write `disposal_state`.** Re-issuing a document has **no** disposal
>    consequence at the moment it happens. The `disposal_pending` marking moves to **retention
>    expiry** — the same clock that governs every other version.
> 2. ✅ **`app.resolve_document_version_bytes` is UNCHANGED.** Its refusal on *any* non-`none`
>    `disposal_state` stays exactly as it is, and it is now **correct for every reason value that can
>    reach it**, because nothing marks a version that is still meant to be servable. ⭐ **This is the
>    whole point of choosing (b): a PHI byte-serving gate is not widened, so no diff-scoped door sweep
>    and no new keystone is owed against that gate.**
> 3. ✅ **ADR 0120 D6/D8 stands undisturbed** — a print's state changes what the overlay **stamps**,
>    never its reachability. The collision does not need adjudicating because it no longer occurs:
>    the two decisions were only ever in contact at the supersession *instant*.
>
> **What this does to D3 and D5 below — read them through this, not as written:**
>
> | | as ratified 2026-08-17 | in force from 2026-08-18 |
> |---|---|---|
> | **D3** — the `superseded` reason value | the value **and** its trigger (mark at supersession) | ⚠ **the VOCABULARY survives; the TRIGGER is struck.** D3's actual argument was never about timing — it was that `duplicate` **must not be reused**, because its exemption lane needs a live same-`sha256` sibling on the **same** `documents` row, which ADR 0120 **D13** guarantees a superseded print will never have. That reasoning is untouched and still binding. |
> | **D5** — a superseded print under a *provisional* retention policy is BLOCKED (`HC0DR`) | evaluated at supersession | ⚠ **the PRINCIPLE survives; the TIMING moves.** A provisional retention policy blocking a disposal is correct wherever it is evaluated — it now simply cannot fire at supersession, because nothing is marked there. |
>
> ⚠ **ONE BUILD-TIME DETAIL IS DELIBERATELY LEFT OPEN, and it must not be silently settled:** when
> the retention clock fires on a superseded version, does the row record
> `disposal_reason_category = 'superseded'` or `'retention_expired'`? Both are true statements and the
> regulator-facing meanings differ — `retention_expired` is the *legally operative* reason, while
> `superseded` preserves *why this version and not the current one*. **The implementing slice decides
> it explicitly and records the choice here.** It is named rather than resolved because inventing a
> regulator-facing value in an amendment is the exact class this ADR exists to stop.
>
> ⛔⛔ **D1 STILL BINDS, AND IT IS WHAT GATES THE REBUILD.** *Inflow and outflow ship together, in one
> gate, or neither ships.* This ruling unblocks D11 **as a decision**; it does **not** authorize
> building the inflow. The outflow that satisfies D1 is **no longer D2's cron job** — the PO ruled at
> the same docket (see Amendment 3) that the outflow is the **manual runbook**, accepted as a pilot
> risk **bounded by one end-to-end rehearsal**. ⭐ **So the inflow may be built once that rehearsal has
> happened, and not before** — otherwise D11 converts silent retention into a growing pile of
> `disposal_pending` rows that nothing has ever been shown to clear, which is precisely the
> "reads better than it behaves" failure D1 was written against. Tracked as **Critical FUP C1**.
>
> ✅ **`FUP-DM5-SUPERSEDE-SERVING-COLLISION`'s PO half is DISCHARGED.** What remains under that id is
> **backend implementation work**, not a decision. `FUP-DM5-D11-SUPERSEDED-NEVER-RETIRES` — its other
> side — moves with it and is still not independently actionable.

> ## ✅ AMENDMENT 3 (2026-08-18) — **the outflow is the MANUAL RUNBOOK, accepted as a pilot risk BOUNDED BY ONE REHEARSAL. D2 is not built.**
>
> **PO ruling, same docket.** The pilot **may proceed** over the manual-only PHI-disposal path that
> Amendment 1 records as shipping — **on one binding condition**:
>
> ⛔ **`docs/deployment/phi-disposal-runbook.md` must be executed end-to-end, once, against test data,
> BEFORE any real patient record is loaded.** The acceptance is **not** open-ended and does not
> survive the pilot admitting real PHI ahead of the rehearsal.
>
> ### ⭕ AMENDED 2026-08-18, same day (DM-FUP TRIAGE #3) — **the rehearsal is TWO runs, and the bound is the Cloud one**
>
> The condition above says "against test data" without naming a surface, and that underspecification
> would have discharged it with a local run. **It does not.** Split, both required:
>
> - **C1a — local.** Execute the runbook end-to-end against the local stack, once, and record the run.
>   It debugs the procedure, and it produces the first **backup destination path** that
>   `FUP-DM5-BACKUP-IS-PHI-EXPORT` is owed at first execution.
> - **C1b — Cloud.** The same execution against the linked project. ⛔ **This is the run the pilot-risk
>   acceptance is bounded by.** A green C1a does **not** release the pilot.
>
> ⭐ **Why this is not bookkeeping.** The runbook already states, in §6, that a local rehearsal *"runs
> against a local stack by construction, so it cannot exercise the Cloud paths above"* — and the pilot
> runs on Cloud. So a local-only rehearsal would have discharged this amendment's **wording** while
> leaving its **purpose** — observing that the mitigation works on the surface that will hold real PHI —
> entirely undischarged. *A predicate quoted at the wrong grain reads exactly like a proof*, and it would
> have done so here in the highest-severity item in the register, inside the amendment written to stop
> precisely that. → [[a-predicate-quoted-at-the-wrong-grain]]
>
> ⚠ **C1a is worth running first anyway** — debugging an unrehearsed 41 KB procedure directly against
> the production project, with no dry run, was the alternative and was declined.
>
> ⭐ **Why the condition is the substance of the ruling, not a caveat on it.** The gap is not that a
> mitigation is missing — the runbook exists, and its owner, cadence and five backup values were all
> PO-set on 2026-08-17. The gap is that **the mitigation has never been observed to work.** A
> procedure that has only ever been read is a claim about a procedure. This ADR's own D4 exists
> because a record asserted more than anything had verified; an unrehearsed runbook is the same defect
> one layer out, and `FUP-DM5-DISPOSAL-JOB`'s body already says so in its own words: *"real on paper;
> real in practice only when the monthly run actually happens."*
>
> ⚠ **This does NOT ratify D2.** `pg_cron` is still not installed, the cron schema still does not
> exist, and the D2 design below stays **ratified-but-unbuilt** — kept because it is the design that
> gets built if and when the manual path proves insufficient, and because Amendment 1's warning
> survives: **`343_dm5_s5_disposal_gap.sql`'s K6b asserts "no scheduler exists at all"**, which is true
> today and becomes a **false pin** the day D2 lands. Rewrite `343` in D2's slice, never after.
>
> ⚠ **`disposal_state` therefore still means INTENT, not a destruction guarantee** — and that reading
> is now *ratified*, not merely observed. Anything user-facing, regulator-facing or export-facing must
> not describe it as destruction. This **inverts ADR 0099 D10** (*"a stale row nobody looks at harms
> nobody"*): for PHI under LGPD, retention past purpose is itself the violation, so **the stale row IS
> the harm** — D10's rationale does not transfer, and this ADR's D2 preamble already flagged that
> inversion before it was ruled on.
>
> ✅ Recorded as **Critical FUP C1** in PROGRESS.md, which carries the trigger and the deadline.
> `FUP-DM5-DISPOSAL-JOB` stays 🟠 **open**: the PO decision is discharged, the rehearsal is not.

- **Status:** ✅ **ACCEPTED 2026-08-17** — ⚠ **partially implemented; see Amendments 1–3 above. D3/D5
  reverted then RE-RULED (Amdt 2), D2 never built and now superseded as the outflow (Amdt 3), D4
  shipped.** Drafted the same day from PO rulings taken at the
  DM5 follow-up-batch open; **D2 and D4 — the two rulings this ADR does not merely record —
  were RATIFIED BY THE PO as proposed**, unblocking the build. D4 was ratified in its
  *record-what-was-verified* form, not the stronger *block-disposal-without-byte-proof*
  variant that was offered alongside it.
- **Context:** ⚠ **This line describes the ADR's INTENT, not its effect — none of the three
  follow-ups below is closed today (Amendment 1).** It addresses three follow-ups that are one
  lifecycle, not three bugs —
  `FUP-DM5-D11-SUPERSEDED-NEVER-RETIRES` (no inflow),
  `FUP-DM5-DISPOSAL-JOB` (no outflow), and instance 3 of
  `FUP-DM5-NO-ANSWER-VS-NOTHING` (the record asserts more than the door verifies).
  Amends **ADR 0120 D11**; introduces cron infrastructure that **ADR 0099 D10** declined
  for its own feature. Bodies: [follow-ups.md](../progress/follow-ups.md).
- **Evidence base:** every catalog claim below was measured against the live local
  catalog on 2026-08-17 before the ruling was taken, not accepted from the follow-up
  text. Two of the follow-ups' own claims did not survive that check — see §Corrections.

> ⭐ **Why one ADR and not three.** `FUP-DM5-DISPOSAL-JOB` states the composition
> explicitly: *"Fixing D11 alone would make things look better and destroy nothing"* —
> it would convert silent retention into a growing pile of `disposal_pending` rows that
> no code path can clear, while the D11 claim reads as honoured. The inverse is equally
> true: an outflow without an inflow completes dispositions nobody ever requested for
> superseded bytes. **The PO ruled both, in one decision, which is what the record
> demanded.**

## Corrections to the inherited record, taken before the rulings

1. **`FUP-DM4-RECUSAL` names a gate that is not in the body.** The follow-up says
   `add_referral_shared_item` *"checks referral-source authority
   (`can_manage_referral_source`)"*. The live body contains no such string; its gate is
   `app.assert_referral_draft_writable`. The **substance holds** — catalog-read, the door
   is `prosecdef = t` and contains **no `can_read_case` and no `can_read_document`** — but
   the paraphrase was recorded as a quotation. *A door's guard set is read from the
   catalog, never from a description of it.*
2. **`FUP-DM5-SETLOCAL-MIGRATION`'s enumeration is bounded by a filename.** It names one
   migration; **eleven** contain `set local`. This is the phase's dominant failure class
   ([[enumeration-boundary-is-a-syntax-not-a-property]]) recurring inside the follow-up
   list itself.

## Decisions

**D1 — The inflow and the outflow ship together, in one gate, or neither ships.**
Binding, and it is a *sequencing* rule rather than a preference: either half alone
produces a system that reads better than it behaves. Any future slice that touches one
must name the other in the same decision.

**D2 — Mechanism: `pg_cron` schedules; the existing application process executes.**
⚠ **This is the ruling that needs PO ratification, because the obvious design is wrong.**

The obvious design — a `pg_cron` job that calls `app.complete_document_disposal`
directly — **cannot work**, and the reason is worth stating so nobody re-proposes it:
the door **verifies** that the object is already absent and **raises `HC0D9`** if it is
still present. It never deletes bytes. The byte deletion must go through the **Storage
API**, which is not reachable from SQL. A pure-SQL cron job could therefore only ever
complete disposals whose bytes something *else* had already deleted — i.e. it would
automate the half that was never the gap.

So the executor must hold service-role reach over Storage. Measured facts that pick the
design:

- `pg_cron` **1.6.4** is in the local stack's `shared_preload_libraries`, and
  `create extension pg_cron` succeeds (proven in a **rolled-back** transaction, per the
  standing rule that a mutation proves its own rollback). Supabase Cloud preloads it too.
- `pg_net` **0.20.3** is already **installed**.
- `app.complete_document_disposal(uuid)` is `prosecdef = t` with EXECUTE granted to
  **`postgres` and `service_role` only** — never `authenticated`. It was **built**
  expecting an operational caller.
- The **application server already holds service-role reach over Storage** — the finalize
  path does a service-role `storage.download`. It is not a new capability.

**Ruling:** `pg_cron` (scheduler, in the DB) → `pg_net` (transport) → **an authenticated
route handler in the existing app** (executor), which performs the Storage-API delete and
then calls the door. Authentication reuses the **ADR 0099 D10** pattern already reviewed
and shipped for `/api/webhooks/audio-jobs`: HMAC over `"<timestamp>.<body>"`, stale
timestamps rejected, idempotent on a terminal state.

*Rejected, with reasons, so they are not re-proposed:*
- **`pg_net` straight to the Storage REST API with a Vault-stored service key.** Works,
  and puts **service-role credentials inside the database** — a genuinely new reach, in
  the one system whose entire compromise story is "the database". The app server already
  has the key; the database does not need it.
- **An external scheduler (Coolify cron / GitHub Actions).** Adds a second execution
  context and a deploy-target-specific configuration that lives outside this repo, so it
  cannot be tested by any gate here.
- **A pure-SQL `pg_cron` job.** Cannot delete bytes — see above.

⚠ **On ADR 0099 D10.** D10's *"No new cron infrastructure"* is scoped to the **audio-jobs**
feature and carries its own reopening clause (`0099…md:218-224`), whose stated cost was
*"a scheduled job to monitor, and a second execution context with service-role reach over
storage."* This design pays the first cost and **not** the second. D10's audio-job
decision is **untouched** — this ADR does not overturn it, it introduces infrastructure
D10 declined to build for a different feature. ⭐ And D10's own rationale (*"a stale row
nobody looks at harms nobody"*) **inverts for PHI**: a `disposal_pending` row that never
completes means bytes that should have been destroyed still exist.

**D3 — A new `disposal_reason_category` value: `superseded`.**
⚠ **AMENDED 2026-08-18 (Amdt 2) — the VOCABULARY below stands, the TRIGGER does not.** Supersession
no longer marks bytes; marking moves to **retention expiry**. The `duplicate`-trap argument that
follows is the part that is still binding.
The live CHECK admits
`{retention_expired, subject_request, entered_in_error, duplicate, other}`. ⚠ **`duplicate`
is the trap here and it must not be reused.** Its exemption lane requires *evidence* — a
live, servable, same-`sha256` sibling bound to the **same document**. Under ADR 0120
**D13** a print mints its version on its **own `documents` row**, so a superseded print's
replacement is a *different* document and the sibling probe finds nothing. Marking a
superseded print `duplicate` would therefore fail the exemption silently and, where a
provisional retention policy applies, block the disposal with `HC0DR`. A new value states
the actual reason and keeps the `duplicate` lane's evidence semantics intact.

**D4 — `disposed` records the evidence for its own claim.** ⚠ **The second ruling needing
PO ratification, and it is the reason this ADR exists at all rather than just a job.**

Measured, from the live body: the door's absence check reads **`storage.objects`** — the
**metadata** table. So `disposal_state = 'disposed'` today proves *the metadata row is
gone* and **not** that the bytes are gone. `FUP-DM5-NO-ANSWER-VS-NOTHING` grades that 🔴
because it is a **persisted record asserting a fact to a regulator** under LGPD /
ANVISA-RDC / CFM 1821-2007, inside a 20-year-retention system, on the one record class
whose entire purpose is to evidence that PHI was destroyed.

⛔ **Automating the outflow changes that item's severity by itself.** Today the false
assertion is **latent** — it is produced by hand, occasionally. A scheduled job produces
it **systematically, monthly, at scale**, and on Cloud the byte proof is *unavailable by
construction* (`FUP-DM5-CLOUD-ORPHAN-SURFACE`; the S3 endpoint is still **UNPROBED**).
**Building D2 without D4 would industrialise the defect.**

**Ruling:** `complete_document_disposal` writes, alongside the state, a record of **what
it actually verified** — that the metadata row is absent (which it checks), and which
byte-level proof was available and what it returned (`local volume proof` / `unavailable
on this platform` / `not attempted`). The state name stays `disposed`; its **meaning is
defined by the evidence beside it**, and the runbook and any regulator-facing export read
the evidence, never the state alone.

⭐ This does not manufacture a proof that does not exist — on Cloud there still is none.
It stops the record from **claiming** one. That is the whole content of the
`NO-ANSWER-VS-NOTHING` class: *an observable proxy is substituted for the property that
matters, and it always fails in the reassuring direction.*

**D5 — A superseded print under a provisional retention policy is BLOCKED, and that is
correct.** Stated so it is not discovered as a bug: once D3 marks superseded bytes
`disposal_pending`, a bound file under a provisional `document_retention` row raises
`HC0DR` until ratification. The inflow **marks**; it does not grant an exemption.
⚠ **AMENDED 2026-08-18 (Amdt 2) — the PRINCIPLE stands, the TIMING moves.** A provisional retention
policy blocking a disposal is correct wherever it is evaluated; it simply can no longer fire *at
supersession*, because nothing is marked there any more.

## Consequences

- `FUP-DM5-D11-SUPERSEDED-NEVER-RETIRES` closes against a **constructed** state, not a
  reasoned one. ⚠ The current local DB cannot demonstrate it: `file_objects` **0**,
  `printed_documents` **0**, `storage.objects` **0**, `documents` **3** (seed only). Any
  figure describing "9 local prints" is stale. The state must be built — mint, re-mint to
  supersede, assert the marking — before any assertion about it is trusted.
- `FUP-DM5-DISPOSAL-JOB` closes only when the job has **run** and completed a real
  pending disposal. A scheduled job that has never fired is the same class of claim this
  ADR exists to stop.
- `scripts/document-reconciliation.mjs` classifies `disposal_pending` as permanently
  `indeterminate` on the stated assumption that *"the completion door is its owner."*
  That assumption becomes true here for the first time and the classifier should be
  revisited in the same slice.
- `FUP-DM5-NO-ANSWER-VS-NOTHING` instance 3 is **downgraded, not closed**, by D4 — the
  record becomes honest; the missing Cloud proof remains missing, and
  `FUP-DM5-CLOUD-ORPHAN-SURFACE` still owns it.
- **ADR 0120 D11 is amended** by D3/D5: superseded bytes are marked for disposal with an
  explicit reason, and their retirement is subject to retention policy like any other.
  D11's inline `⏳ CONTESTED` pointer is discharged.
  ⚠ **RE-AMENDED 2026-08-18 (Amdt 2): the amendment holds in substance and changes trigger.**
  Superseded bytes still retire under retention policy with an explicit reason — but the marking
  happens **when the retention clock fires**, not at supersession. ⛔ D11 remains **unbuilt**, now
  gated by **D1** on the outflow rehearsal (Amdt 3 / Critical FUP C1) rather than by an open decision.
