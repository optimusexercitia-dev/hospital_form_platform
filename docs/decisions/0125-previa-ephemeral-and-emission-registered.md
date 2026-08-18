# ADR 0125 — `Imprimir prévia` (ephemeral) vs `Emitir documento` (registered)

- **Status:** ACCEPTED — PO-ruled 2026-08-18. **Not built** — implementation is a
  separate phase item.
- **Context:** Discharges ADR [0123](./0123-discarding-a-draft-that-has-emitted-documents.md)
  **D7**, which deferred this split to "a separate ADR, on its own evidence". **Amends**
  ADR [0104](./0104-pdf-document-printing-module.md) **D7** item 4 — knowingly, in writing,
  which is the difference between this and DM-FUP TRIAGE #8 (withdrawn 2026-08-18 for
  reversing D7 without knowing it existed). Settles the approach for
  `FUP-DM5-DRAFT-PRINT-INVISIBLE-TO-COORDINATION`; that item does **not** close until the
  prévia ships.
- **Body:** [follow-ups.md](../progress/follow-ups.md).

## Decisions

**D1 — Registration is DERIVED from source state. There is ONE print action, not two.**
A source that is **locked** yields a **registered emission** — permanent, hash-pinned,
QR-verifiable. A source that is still freely editable yields an **ephemeral prévia**. The
user never chooses which.

The rejected alternative was two buttons offered side by side on every source. It fails on
ADR 0104 D7's own principle: D7 exists so that a document's declared nature is *computed*,
never user-composed ("No free text, no user-composed stamps"). Two buttons would have made
*"is this a record?"* a user decision — free text by another name, in the one place the
module was built to prevent it.

**⭐ The discriminator is the LOCK POINT, not the watermark's finality point — and for
meetings those are different states.** This is the correction that gives the rule its
foundation: `app.guard_meeting_status` already refuses a DELETE when
`old.status in ('in_signature','signed','distributed','cancelled')`, and its own rank
comment reads *"em_assinatura and beyond are **locked**"*. The platform therefore already
has a state at which a meeting stops being freely disposable — and that state is
`in_signature`, one step before the minutes are signed. Registration aligns to **that**
existing boundary rather than inventing a second one.

An ata circulating for signature is a document of record: it is what the committee is being
asked to attest to, it is undeletable from that moment, and *"which version went out on the
12th"* is exactly what an ONA/JCI surveyor asks. It must be hash-pinned and verifiable.

**⇒ Registration and watermark are TWO derivations, not one.** They coincide for
`form_response` (both turn at `submitted`), which is why a single predicate looked
sufficient at first; meetings have an extra lifecycle step and there they separate:

| Kind | REGISTERS ⇔ (lock) | FINAL watermark ⇔ (finality) | Ephemeral prévia |
| ---- | ------------------ | ---------------------------- | ---------------- |
| `form_response` | `status = 'submitted'` | `status = 'submitted'` | `in_progress` |
| `meeting` | `status in ('in_signature','signed','distributed')` | `status in ('signed','distributed')` — `meetingWatermarkFor`, **unchanged** | `scheduled`, `held` |

⚠ **`meetingWatermarkFor` is NOT changed.** An `in_signature` ata registers **stamped
`RASCUNHO`** — permanent, QR-verifiable, and honestly marked as not-yet-approved. Making it
print `FINAL` would put a lie on the page: the signature footer still renders
*"— não assinado —"*, and `312`/E2E pin the mark. A **registered RASCUNHO** is not a
contradiction; it is ADR 0104 D7's original position (draft prints are legal and
registered), now confined to sources the platform has already locked.

⛔ **`cancelled` is deliberately EXCLUDED from registration**, even though it sits in the
lock set. The lock exists there to preserve the audit trail of a cancellation, not because
an ata of record was produced — there are no minutes to pin. This is the one place the
registering set is a strict subset of the lock set, and it is a decision, not an oversight.

What survives from the single-predicate framing is the part that mattered: **both axes are
derived, neither is chosen by the user.** That, not "exactly one predicate", is ADR 0104
D7's principle.

**D2 — This AMENDS ADR 0104 D7 item 4, and the amendment is stated rather than implied.**
D7 item 4 reads *"Completeness does not gate minting — FINAL/RASCUNHO already encodes it."*
It becomes: **completeness gates REGISTRATION, not PRINTING.** A user who needs paper of an
incomplete artifact still gets paper, on demand, watermarked — which is the interest D7 was
protecting. What changes is that the paper no longer enters the registry.

⚠ `312` **t6** (*"creator sees his own in_progress draft (RASCUNHO prints are legal, D7)"*,
line 198) and **t43** (line 447) pin registered draft mints **by name**. They are rewritten
under this ADR, not re-run. The RASCUNHO template variants stay in
`fingerprint.test.ts` — an ephemeral page is still rendered by the same templates and is
still read by a human, so its look stays pinned even though its bytes are never stored.

**D3 — A prévia is AUDITED. It has no bytes and no registry row.**
The ephemeral path emits its own `app.audit_write` event — actor, timestamp, source kind +
id, template — and nothing else. Measured: today `mint_printed_document` writes
`app.audit_write('document.minted', 'printed_document', …)`, so bypassing the RPC would
silently delete the platform's ability to answer *"was this draft ever printed, and by
whom?"* — a capability regression in a system whose Rule 11 pitch is a tamper-evident
trail.

This is also the only half that **cannot be added retroactively**: unstored bytes can be
re-rendered from the source, but an unlogged event is gone. The row records *that* + *who*
and no payload, which is exactly Rule 11's prescribed shape.

**D4 — Same render pipeline, streamed, never uploaded. No temporary object, ever.**
HTML → Gotenberg → buffer → **response stream**. The `.upload()` and the registry RPC are
simply not called. Fidelity is the reason: a prévia that does not match the document it
previews is not one, and a second rendering path (browser `window.print()`) would give the
platform two ways a document can look, pinned by one fingerprint suite.

⛔ **A "temporary upload, deleted after download" variant is rejected by name.** It
re-creates precisely the class this ADR removes: bytes at rest, a deletion that depends on
a cleanup step, and PHI-tier objects living in a bucket for a window. `FUP-DM5-DISPOSAL-JOB`
is open because a cleanup job that was written down did not exist; S4 found real bytes
surviving a count-based check. **Any "temporary" object is a permanent object with an
intention attached.**

**D5 — The prévia footer is a SIBLING primitive, and the verb `Emitido` must not appear.**
[`qr-footer.ts`](../../src/lib/pdf/primitives/qr-footer.ts) renders the QR, `Código de
verificação: …` **and** `Emitido em … por …` as one block — so dropping the QR drops the
provenance with it unless something replaces it. The replacement states the page's status
in words and keeps provenance, e.g. *"PRÉVIA — sem valor de registro, não verificável.
Gerada em <data> por <nome>."*

Keeping `Emitido` while dropping the QR would let the page claim in words what the missing
QR denies, and would preserve half the "controlled copy" signal that ADR 0104 D7 relied on
when it rejected a `VIA NÃO CONTROLADA` stamp. Reserve the verb for the registered act.

⭐ **This is why the split needs no new watermark — but the reason is the FOOTER, not the
mark.** An earlier draft of this ADR argued *"RASCUNHO ⇔ no QR ⇔ ephemeral, so the missing
QR corroborates the mark."* **That is false once `in_signature` registers** (D1): a
registered ata is stamped RASCUNHO **and** carries a QR. The two axes are read
independently, and the footer is the one that answers *"is this a record?"*:

| | **QR footer** (registered) | **Prévia footer** (ephemeral) |
| --- | --- | --- |
| **FINAL** | submitted response · signed ata | ⛔ **unreachable by design** — a locked source always registers |
| **RASCUNHO** | `in_signature` ata — *of record, not yet approved* | working copy — no registry row, no bytes |

So: **the watermark states whether the content is final; the footer states whether the page
is a record.** Three of the four cells are reachable and the fourth must not become
reachable — a prévia of a locked source would be a page the platform disclaims while its
source is immutable. Worth a keystone, not just a sentence.

The automatic `contains_phi` confidentiality band (D7's fifth row) is **unchanged** and
still not suppressible.

**D6 — Authorization is inherited RLS. Measured, and it needs a behavioural keystone.**
Both providers read through `src/lib/queries/` under the **caller's session** — verified in
the modules themselves, not from the comment: `queries/responses.ts` and `queries/meetings.ts`
use `createClient()` throughout. A caller who cannot read the source cannot build the
payload, so the prévia **fails closed on RLS with or without the DEFINER door**. The
prévia's authority is therefore exactly source-read authority, which is also the
`mint_printed_document` door's own rule (D11: "anyone who can VIEW the source").

⚠ **But an app-layer route with no `prosecdef` gate is in no authz ARM's domain** — the ADR
0079 Amendment 7 shape. The protection is real but transitive: nothing goes red if a future
edit swaps one of those queries to the admin client. The prévia route ships with a
**behavioural** keystone (a principal who cannot read the source is refused), not an arm.

**D7 — `guard_response_active_print` is RETAINED as a backstop and RE-PINNED at table
level.** This ADR makes HC069 structurally unreachable, and that is measured, not inferred:
`guard_submitted_response` raises unconditionally when `old.status = 'submitted'` on
DELETE, and the RLS delete policy is `responses_delete_own_draft` (`created_by = uid AND
status = 'in_progress'`) — so **only drafts are deletable at all**. If drafts stop
registering prints, no draft has a print and no submitted response can be deleted: the
state HC069 refuses can no longer be constructed.

The trigger and the ADR 0123 D3 key-share lock **stay**. They cost nothing at runtime and
defend a path the product does not offer *yet* — bulk delete, tenant purge, the correction
lifecycle, or direct SQL. Retiring a guard is a widening, and a widening cannot be
wrong-and-safe.

⛔ **What must NOT happen is leaving the keystones alone.** `312` §9 (t74/t76/t80 and the
supersede block from line 764) is built on the fixture *"mint from a draft, then discard
it"*. That fixture becomes **unconstructible**, so those tests go **vacuous and stay
green** — the dominant failure family in this project's record. They are rebuilt to
CONSTRUCT the state at table level (insert a `printed_documents` row against a draft
response directly, bypassing the mint), which keeps the guard honest rather than
green-and-silent. Their differentials (t76, t80 — *"the same delete now SUCCEEDS"*) must
survive the rewrite; without them the block is equally satisfied by a guard that blocks
every draft delete.

**D8 — Every kind MUST declare TWO predicates — a LOCK predicate and a watermark predicate
— and both are deferred to activation.** `case` (P3) and `interview` (P4) are in the
`source_kind` CHECK but have no provider registered, so nothing about them is ruled here
except the rule itself: **not-locked ⇒ ephemeral, no exceptions**, and the two predicates
are declared separately even where they happen to coincide. Which state locks, and which
state is final, are the domain's to define when it registers its provider — the same
activation model as ADR 0104 D15.

⚠ **Declaring them separately is the point, not ceremony.** `form_response` collapses both
onto `submitted`, and that coincidence is what made a single predicate look sufficient
until meetings were examined. A kind that declares one predicate and lets it serve both
roles will be wrong the first time its lifecycle grows a step between "cannot be edited
any more" and "content is final" — which is precisely the step meetings already have.

Binding the principle now is what stops a future kind from quietly shipping "everything
registers": the PHI kind inherits the rule by default rather than by a second decision
someone must remember to make. ADR 0104 D9.3 already puts the Rule 11 PHI-access row on the
**domain's own audited reader**, not on the registry, so a PHI prévia still logs the read.

**D9 — Render contention: one pool, and the prévia yields.** `MINT_CONCURRENCY = 3` with a
5 s acquire wait exists to bound the Gotenberg sidecar (ADR 0104 D5). The prévia shares that
semaphore unchanged — separate pools would protect emissions by removing the protection on
the sidecar — but acquires with a **materially shorter wait**, so under load the prévia is
the one that fails `tente novamente`. A prévia is the frequent, retryable convenience; an
emission is the rare, deliberate act often performed in front of a committee. The common
case must not displace the consequential one.

## Consequences

- The `DANGLING-PRINT` defect family is removed at the root rather than guarded: no draft
  registry rows ⇒ nothing to orphan. ADR 0123's D1/D3/D5 become **backstop semantics**
  rather than live governance, and are retained on that basis (D7 above).
- ⭐ **A supersession chain now records which version circulated when.** Minting at
  `in_signature` and again at `signed` supersedes the first (ADR 0104 D6 — re-minting the
  same `(source_kind, source_id, template_key)` flips the prior row), so the circulated
  draft survives as `SUBSTITUÍDO` with its own hash and code rather than vanishing. This is
  the accreditation question — *"show me the minutes circulated on the 12th"* — and under
  the ephemeral-`in_signature` version of this ADR it had no answer.
- **`FUP-DM5-DRAFT-PRINT-INVISIBLE-TO-COORDINATION` is answered without widening anything.**
  Its mechanism was that `can_view_printed_document`'s **`form_response` arm** requires
  `status = 'submitted'`; once no `in_progress` response registers, that arm always fires
  for every registered print and the predicate is correct **by construction**.
  ⚠ **The `meeting` arm never had the defect** — measured from the live catalog, it is
  `can_reach_meeting AND can_read_full_meeting_content`, with **no `status` term at all**.
  So registering an `in_signature` ata (D1) creates no invisible print: it is visible to
  every member who can reach the meeting and read its full content. The proposed
  `list_printed_documents_for_governance` door is **not built**. The reachable dead end (a
  minter who loses `staff_admin`, cannot discover the print, and is refused HC069 on
  discard) disappears with it. ⚠ The item stays **OPEN** until the prévia ships — it is
  answered in approach, not in code.
- `20260928000700` + `20260928000800` govern nothing reachable through the product once
  this lands. They are not reverted; the migrations stay on the remote and the keystones
  are rebuilt around them.
- E2E: `pdf-printing-meetings.spec.ts` T2 (mints from a `held` meeting, asserts RASCUNHO)
  is rewritten, as are the `312` tests named in D2/D7. No data migration is needed —
  production holds `0` prints (measured 2026-08-18, ADR 0123 D4) and local resets.
- ⛔ **`Emitido` becomes a reserved verb in the UI vocabulary.** It names the registered act
  only. Any surface that says "emitir" about a **still-editable** source is a defect from this
  point. ⚠ Note the boundary is **lock**, not finality: "Emitir documento" is *correct* on an
  `in_signature` ata, which is non-final and registers.
- **Meetings need no `guard_response_active_print` analogue on the normal path — measured,
  and the bound is stated rather than assumed.** `app.guard_meeting_status` (BEFORE DELETE)
  refuses `in_signature | signed | distributed | cancelled`, so the **lock set is a superset
  of the registering set** (D1) and no ordinary DELETE can orphan a registered ata. A
  `scheduled`/`held` meeting is deletable but registers nothing.
  ⚠ **Two residual paths are NOT verified and are not claimed:** a delete performed inside a
  meeting RPC (the guard yields to `app.in_meeting_rpc`) and a commission-level cascade
  (whose behaviour the trigger's own comment asserts but which was not measured here).
  Carried as an open question on `FUP-PREVIA-SPLIT-BUILD`, not as covered.
- Out of scope, named so it is not read as covered: the **lock and watermark predicates** for
  `case` / `interview` (D8 binds the principle and requires both be declared separately;
  it defers each to that kind's provider activation).
