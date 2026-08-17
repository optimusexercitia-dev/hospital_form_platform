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

- **Status:** ✅ **ACCEPTED 2026-08-17** — ⚠ **partially implemented; see Amendment 1 above. D3/D5
  reverted, D2 never built, D4 shipped.** Drafted the same day from PO rulings taken at the
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

**D3 — A new `disposal_reason_category` value: `superseded`.** The live CHECK admits
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
