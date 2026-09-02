# ADR 0123 — Discarding a draft that has emitted documents

- **Status:** ACCEPTED — PO-ruled 2026-08-18.
- **Context:** `FUP-DM5-DANGLING-PRINT-ON-DELETED-DRAFT`, filed 2026-08-14 from `qa`'s
  DM5·S3 review (MINOR-5). Its first ruling ("refuse the mint from a non-`submitted`
  response") was **WITHDRAWN** the same day for reversing ADR
  [0104](./0104-pdf-document-printing-module.md) **D7**; its second ruling shipped as
  migration `20260928000700` (`app.guard_response_active_print`). This ADR closes the
  item: it **corrects** the shipped guard's stated rationale, closes a **measured**
  concurrency hole beside it, and gives the two remainders 000700 left open a durable
  answer. Touches ADR 0104 D6/D7/D11 and ADR
  [0120](./0120-dm5-wave-d-retirement-decisions.md) D6/D8/D11/D13.
- **Body:** [follow-ups-open.md](../progress/follow-ups-open.md).

## Decisions

**D1 — The delete guard blocks `active` AND `superseded`, not `active` alone.**
`20260928000700` argued *"Only an ACTIVE print represents a live page."* **That sentence
is false by this platform's own ruling.** ADR 0120 **D6/D8** — established the hard way by
the D11 serving collision, where marking a superseded print `disposal_pending` stopped its
PDF opening the instant a document was re-issued — says states change the overlay **STAMP,
never reachability**. A `superseded` print still serves its bytes and still answers
`/verificar`. It is a live page.

The hole is reachable without exotic input: mint P1 → re-mint (the mint's own
`SUPERSEDE_ACTIVE` update flips P1 to `superseded`, as `printed_documents_one_active`
requires) → coordination revokes the now-active P2. Zero actives, one superseded, and the
`active`-only guard opens the door. The escape hatch is intact —
`revoke_printed_document` refuses only `status = 'revoked'`, so a superseded row can still
be voided, and D1 therefore adds no dead end it does not also provide an exit from.

⚠ **`312` t76 does not catch this widening** — it is equally satisfied by an `active`-only
guard, because its fixture has no superseded sibling. D1 ships with its own red-first
keystone or it ships unpinned.

**D2 — `revoked` stays permissive. Restated, not re-opened.** 000700's reasoning survives
D1 intact and is recorded here so it is not re-litigated: `lookup_printed_document` reads
`printed_documents` directly and joins **only** commissions/hospitals — never `responses`
— so public verification **survives** an orphan. A revoked print must keep its row and its
bytes precisely so a holder of the paper is still told **ANULADO**. Orphaning that one is
correct behaviour, and it is the one case where a deliberate governance act has already
been performed.

**D3 — The mint KEY-SHARE-locks its source response before creating the print chain.**
`app.guard_response_active_print` is `BEFORE DELETE`; `mint_printed_document` read
`responses` **unlocked**. Nothing ordered the two, so the guard could pass on an empty
registry while a concurrent mint committed a print immediately afterward.

**Measured, not reasoned** (2026-08-18, scratch schema, dropped after):

| # | Arrangement | Result |
| - | ----------- | ------ |
| 1 | mint reads source unlocked (**the shipped code**) | delete succeeds, mint commits after → **orphan created** |
| 2 | mint takes `for key share` first | delete **blocks**, then the trigger raises → no orphan |
| 3 | delete first, mint second | the locked select returns **zero rows** → mint aborts |

Test 2 works because Postgres acquires `LockTupleExclusive` **before** running a
`BEFORE DELETE` row trigger's body, so the body re-reads on a fresh snapshot after the
wait. The abort half of test 3 needed **no new code**: the mint already raises `HC0D1`
when the source lookup yields null. The fix is `for key share` on one existing `select`.

⚠ **This fix is not pinnable by the ordinary suite** — pgTAP is single-session, so no
keystone in `312` can construct the interleaving. It is pinned **structurally instead**,
by asserting from `pg_proc` that the live body still carries the lock. That is a weaker
control than a behavioural keystone and is chosen knowingly: the alternative was a
**comment**, and a comment is an assertion that goes stale silently.

**D4 — Pre-existing orphans: CLOSED by measurement. No reconcile is built.**
Measured 2026-08-18 on **both** environments: production holds `0` prints, `0` responses,
`0` documents, `0` dangling securables; local after a fresh reset holds `0` prints. The
follow-up's *"6 of 9 local prints are `form_response` kind"* was **E2E residue in a
since-reset local DB**, not a population. A reconcile job would have had an empty subject.

⛔ **The measurement has an expiry and it is the pilot.** The orphan set is empty *because
nothing has been created yet*. D1 and D3 are what keep it empty; they are cheap now and
become a data-repair job the day the pilot loads rows.

**D5 — The dangling `securable_resources` row is RETAINED BY DESIGN, and deleting it is a
defect.** This is the remainder 000700 left as *"a securable with no subject … still
owed"*, and the obvious repair is the wrong one. Both `app.can_read_document` and
`app.can_write_document` open with
`documents d join securable_resources s on s.id = d.home_resource_id` and return **false**
when that join misses. Deleting the orphaned securable would therefore silently revoke
`request_document_disposition` for that print — **D11's only outflow** — turning a
retained-but-inert row into unreachable bytes with no disposition authority at all.

The row's authorization meaning after the source dies is stated once, here, so it is a
recorded semantics rather than an orphan called deliberate:

| Surface | After the source response is deleted | Enforced by |
| ------- | ------------------------------------ | ----------- |
| Content read | **false** | `can_read_document` → print arm → `can_view_printed_document` (its `form_response` arm returns false when the row is gone) |
| Byte download | **false** | `open_printed_document`, same predicate |
| Write / disposition | **coordinator** | `can_write_document`'s print arm — authorizes on `printed_documents.commission_id`, joins no `responses` |
| Public verification | **available, reports `revoked`** | `lookup_printed_document` (D2) |
| Governance metadata | **no surface today** | D6 |

**D6 — Coordinator discovery is a SEPARATE defect and does not close with this item.**
The registry door proposed alongside this fix (`list_printed_documents_for_governance`) is
**deferred to its own follow-up**, for a reason found while verifying this one:
`can_view_printed_document`'s `form_response` arm grants the `staff_admin` term only when
`status = 'submitted'`. That same predicate **is** the `printed_documents_select` policy.
So a print of an `in_progress` draft is invisible to every coordinator **except its
creator** — while the source still exists, with no deletion involved. That is a live
defect of a different shape, and folding it in here would have closed this item over a
door with no caller.

**D7 — The `Imprimir prévia` / `Emitir documento` product split is out of scope.** It
amends ADR 0104 **D7** and would partly obsolete this guard. Separate ADR, on its own
evidence.

> ## ⬛ D7 DISCHARGED 2026-08-18 — ADR [0125](./0125-previa-ephemeral-and-emission-registered.md)
>
> Ruled: registration is **derived from source state** at the **lock point**, one action —
> freely-editable ⇒ ephemeral prévia, locked ⇒ registered (for meetings that turns at
> `in_signature`, so an ata circulating for signature registers while still stamped RASCUNHO).
> It did partly obsolete this guard, and by more than "partly" — **measured**,
> `guard_submitted_response` raises unconditionally on a submitted DELETE and the RLS policy is
> `responses_delete_own_draft`, so **only drafts are deletable**; once drafts stop registering
> prints, the state HC069 refuses cannot be constructed. D1/D3/D5 below are therefore **retained
> as backstop semantics** (0125 D7) — nothing here is reverted, and `312` §9 is rebuilt to
> construct the state at table level so the guard does not go green-and-silent.

## Consequences

- `app.guard_response_active_print` refuses on `active` **or** `superseded`; its `HC069`
  text and the pt-BR app-layer message stop saying "ativo".
- `mint_printed_document` serializes against the discard path. Concurrent discard now
  loses deterministically in **both** directions rather than racing.
- `FUP-DM5-DANGLING-PRINT-ON-DELETED-DRAFT` **closes**. Its two remainders are answered:
  orphans by D4, the securable by D5.
- A new follow-up carries D6. Until it lands, coordination cannot see a draft print it did
  not itself mint — including one whose minter has since lost `staff_admin`, who is
  consequently unable to discard their own draft with no in-product way out.
- ⛔ **`prosecdef` belongs beside `pg_policies`.** D1 rewrites a `SECURITY DEFINER`
  trigger function; `20260928000700` shipped that same function with Postgres' default
  **PUBLIC EXECUTE** and was caught only by the `320` U1 ACL census, with `312` fully
  green and the door open. The ACL is restated explicitly in the migration.
