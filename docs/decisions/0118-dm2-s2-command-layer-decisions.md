# 0118 — DM2·S2 build decisions: the document command layer

- **Status:** Accepted (lead-acked plan 2026-08-13 with four findings; built same day).
- **Scope:** the build-time decisions S2 made executing ADR 0114 D8/D9/D10/D11.
  Keystones: pgTAP `329` (new) + `228` t40–41b + `328` K10 (rewritten); phase record
  `docs/progress/dm2-orchestration-wave-a.md` §S2.

## Decisions

**1. Door return topology — IDs and metadata only, a recorded deviation from ADR
0111/0113.** Those ADRs ratified the named-composite-mirrors-GRANT shape for doors
that return ROW data. S2's doors go further: they return **no storage coordinates at
all** (ids + non-coordinate metadata as jsonb); the TS module (`src/lib/documents/`)
resolves bucket/path with the **service client** after the door authorizes, then
signs short-TTL. Reasons: a direct PostgREST caller gets authorization semantics and
nothing signable; and the DM5 exit criterion ("zero raw-path authority outside the
module") becomes true **by construction** rather than by sweep. This does NOT
supersede 0111/0113 for row-returning doors — it is the stricter sibling for doors
whose data is a storage coordinate. A future author "restoring consistency" with the
0111/0113 composite shape here would be widening, not tidying.

**2. The service role is D9's byte verifier; actor identity from the session row.**
SQL cannot hash Storage bytes, so `complete_document_upload_verification` /
`complete_document_disposal` are **service-role-only** (`authenticated` EXECUTE
structurally absent — pgTAP 329 S4/S5). Actor identity on those paths comes from
`upload_sessions.reserved_by`, never a `p_uid` parameter (authz-handoff §7.17); the
audit rows carry NULL actor (service call) with attribution in metadata —
`audit_log.actor_id` is nullable by design.

**3. FINDING 1 resolved as REMOVAL (option (b) was fiction).** The registry's
`document.opened` arm + allowlist entry were removed by needle-matched `replace()`
surgery with single-replacement proofs and postconditions: a `public` RPC arm cannot
be "pinned unreachable" — any direct PostgREST caller reaches it. Consequence: the
open door is the verb's **only** minter, which is what makes the audit-exactness
pins (329 O2/O6/O8/O10, 228 41b) meaningful. 328 K10 rewritten accordingly
(red-first: `caught: no exception / wanted: 23514` — the arm was live).

**4. Retention refuses BEFORE verify-absence** (order corrected by S2's own
keystone): the completion door must never let the disposal job delete bytes of a
retention-blocked file. The Art. 18 lane (`subject_request`) passes the provisional
gate with an audited `document.retention_override` marker (FINDING 4 — the PO's
one-line reversal seam); unbound files are exempt (an orphaned physical copy is not
the governance record). Document closure on last-file-disposed: status `disposed` +
D12 title/description redaction.

**5. Tier is server-derived from the home type** — case/interview → `phi`,
meeting/action_item → `standard` — never a caller input. Conservative (a
standard-ish case file lands in the tighter bucket); widening is a product decision.

**6. `documents.kind` is deliberately UNCHECKED text.** The closed per-home
vocabulary is product surface exported once from the TS contract
(`DOCUMENT_KINDS`); a SQL CHECK would take a migration per vocabulary change.
Stated in the migration and the contract so nobody mirrors a constraint that does
not exist.

**7. Distinct SQLSTATEs per failure class** (HC0D7 flag · HC0D8 unavailable ·
HC0D9 upload-incomplete · HC0DD disposed, uniqueness postcondition-pinned · HC0DE
expired · HC0DF too-large · HC0DG mime · HC0DR retention) so the TS error-code
union maps on **code alone, never message text**, and each keystone pins its own
code (§7.1 crispness).

**8. Upload transport:** a raw `PUT` to the signed upload URL (credential embedded;
no browser Supabase client). A failed/partial PUT leaves NO object → `finalize`
refuses (`upload_incomplete`) and the reservation stays retryable until expiry —
pinned by 329 U11/U12. The version-file **binding lands only at verified
completion**, so a never-verified upload never becomes servable and K13 chain-only
semantics are preserved; uploader visibility remains not-added (ADR 0116 §11).

**9. `begin` authority is insert-then-check against the canonical
`app.can_write_document`** (atomic in the DEFINER txn) — no resource-keyed twin
door, one authority source, zero new census-domain gates.

**10. Reclassification commits as a NEW VERSION, and the retention gate gains
ONE new exemption class: EVIDENCE-GATED duplicate retirement** (lead-approved
2026-08-13 with three conditions, all discharged; migration `20260924000500`).

*The commit shape.* `document_version_files` carries
`UNIQUE (document_version_id, rendition_kind)` + the DM1 immutability guard —
together they rule out both a sibling `source` binding and a rebind, and D10
forbids the pointer update. So reclassification is APPEND-ONLY: copy → verify
(the service verifier hashes the bytes it actually moved; the commit door
refuses a sha that differs from the source's — copy integrity is the gate) →
commit as a new `document_version` with its own binding → retire-source.
Costs, accepted: reclassification is visible, audited version history (honest
— the bytes genuinely moved bucket); prior-version opens of the retired copy
return `disposed`, the content living in the audit-linked successor.

*The exemption class.* `complete_document_disposal` honors reason
`duplicate` through a PROVISIONAL retention policy **only on evidence**: a
live, servable, same-sha256 file bound to the SAME document. **Invariant
preserved: a servable copy always survives** — the argument is inductive and
EXECUTABLE, not reasoned (Condition 1): the last copy has no sibling and
stays behind the gate, pinned by the differential pair 329 R6/R7 (same
statement, one variable — the sibling's liveness). The exemption is kept
GENERAL (evidence-gated), not path-narrowed to the reclassify door
(Condition 2, reasoning recorded): the guardrail is the EVIDENCE, never
caller provenance — a provenance marker would be a claim, strictly weaker
than the sha verification; the only practical creator of the
one-file-pending state is the reclassify completion door (which always
retires the OLD copy — `request_document_disposition` marks ALL files, so no
sibling stays live and the lane self-blocks); and the vacuity pin 329 R8
proves a non-duplicated file cannot claim the lane. The lane's use is
audited (`document.retention_override`, `lane: duplicate_evidence`). A
future reader hitting HC0DR: this section is why an exemption exists and
what bounds it. Mutation-proven: the sha term neutralized in a rolled-back
txn → a different-content sibling wrongly satisfies the lane (control:
restored door refuses HC0DR; restore catalog-verified).

**11. `canDelete` is a server-computed affordance (the `canOpen` principle),
batched.** `underLegalHold`'s `false` was unreachable — RLS cannot separate
"no hold" from "not entitled" at the query layer, and
`can_read_document_hold`'s audience ≠ `can_write_document`'s (an ordinary
writer can hold delete authority while unable to see holds). Fix (lead
route): `public.document_delete_affordances(uuid[])` — one call per list,
DEFINER, write-authority AND no-live-hold — so the UI stops offering a
delete HC0D3 would refuse WITHOUT hold existence being disclosed to
non-entitled writers, and without a UI-side restatement of a DB rule.
`underLegalHold` retyped `true | null` (the entitled-reader governance
display it actually is). The door returns SETOF — outside the census/ARM-1
domains by definition; behavioral coverage 329 A1–A3.

## Consequences

- Wave A's UI consumes exactly the S2 contract (`src/lib/documents/types.ts`,
  amended per the frontend review items 1–10); raw paths never leave the module.
- FUP-DM1-DISPOSE discharged (`dispose_case_phi` document arm; W-pins); S1-O1
  discharged (228 t40–41b); DM1 QA MINOR-2 discharged (gate-before-record, O9/O10).
- The reconciliation command is an ops **script** (`scripts/document-reconciliation.mjs`,
  FINDING 3); DM5 step 4 names its operational owner.
- Signed-URL TTLs: **PO-RULED 2026-08-13** — phi 120 s / standard 300 s, no
  streaming proxy. Recorded as ADR 0114's O4 closure (that ADR carries the
  bearer-token asymmetry reasoning); this ADR cross-references it.
- List-query perf: **PO-RULED — no embed trim**; `containsPhi` + `availability`
  stay resolved from the file embed. The ~3.7 ms/row file-chain cost is a named
  PILOT WATCH-ITEM with the measured numbers attached (DM2 record §S2.7), not a
  fix-before-ship follow-up (production census: 45 objects; real Wave-A panels
  hold single-digit documents).
