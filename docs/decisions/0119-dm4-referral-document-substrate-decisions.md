# 0119 — DM4 (Wave C): referral documents on the core document model

- **Status:** Accepted — PO rulings 2026-08-14 (findings 4/5 of the DM4 catalog
  audit), lead-approved migration plan M1–M5 same day. Executes ADR 0114 D4/D8/D13
  Wave C; plan `docs/plans/dm4-referrals-plan.md`; step-0 evidence
  `docs/progress/dm4-surface-verification.md`.
- **Number check:** directory scanned at write time; 0118 was highest. Renumber at
  merge if a collision appears (the ADR-0115 scar — collisions merge cleanly).

## Decisions

**D1 — `case_referral` becomes a securable resource type.** Registry anchors are
the SOURCE commission's tenancy (matches every referral audit row today). The
generic `app.ensure_securable_resource()` cannot be attached (it reads
`new.commission_id`; the table has `source_commission_id`), so a referral-specific
BEFORE INSERT trigger fn mints the registry row (same targeted
`ON CONFLICT (id) DO NOTHING` discipline), with a backfill + composite-FK pin in
the same migration. Both `securable_resources` CHECKs widen with
`'case_referral'`.

**D2 — the two-tier referral asymmetry survives the substrate move.** Kernel
(`app.can_read_document`) referral arm = `can_read_referral_metadata` (broad:
rows/titles); the byte corridor (`open_document_version`) gains a referral
discrimination arm requiring `can_read_referral_phi` (narrow), mirroring the QO·B
case arm. A twin that collapses the tiers proves nothing — the keystone asserts
BOTH halves (metadata reader: row visible AND bytes 42501).

**D3 — a frozen document snapshot is a version BINDING, not a byte copy.**
`referral_shared_item.frozen_document_version_id → document_versions
ON DELETE RESTRICT` (append-only versions make the binding supersession-immune by
construction) + frozen title/mime/size value-copies. The legacy shape CHECK — which
REQUIRED `frozen_storage_path` for `kind='document'` and would reject every
version-bound row — is replaced by a three-state arm: version-bound | legacy-path |
tombstoned. Bytes serve ONLY through the bespoke audited DEFINER door
`open_referral_snapshot_document` (gate: `can_read_referral_phi`; exactly one
`referral.viewed`; service-role signing, 120 s — ADR 0114 D8 reversed the
cookie-client posture).

**D4 (PO) — an ENFORCING label refuses the freeze; the freeze wins thereafter.**
`legal_privileged`/`credentialing_sensitive` on the source document blocks
`add_referral_shared_item`'s document arm with **`HC0DC`** — the referral corridor
has no clearance plane, so freezing would launder the D15 ceiling (the DM3
ethics-home precedent). Accepted cost: sharing a privileged document requires
deliberate de-labelling first. Corollary: a label applied AFTER a freeze does NOT
retract committee B's access — the snapshot records a disclosure that happened;
retro-hiding would make an immutable snapshot effectively mutable. Labels govern
future freezes only.

**D5 (PO) — soft-delete survives, disposal wins.** Source-document soft-delete
does NOT kill a frozen snapshot (B's disclosure record survives A's retraction —
the door deliberately does not check `documents.status`); D10 file disposal DOES
fail it closed (LGPD erasure outranks the disclosure record — `HC0DD`).
`dispose_referral_phi` tombstones the referral-side binding
(`frozen_tombstone_reason = 'phi_disposed'`) and routes referral-homed reply
documents into the D10 lane; it never disposes the SOURCE case's document (shared
bytes, case A's record).

**D6 — reply attachments are referral-homed documents (PO ruling R1).** Tier
pinned `phi`; kind `anexo_resposta`; write authority = target coordinator while
`accepted`/`in_review` (`can_write_document` referral arm — legacy RPC parity);
corridor = the existing `begin_document_upload`/`finalize_document_upload`
(wave-c-asserted at BEGIN, home-scoped, the first residue-producing step). The
legacy surface (`referral_reply_attachment` table + RPCs + three storage
policies + `app.can_read_snapshot_document`) is dropped; the DM1 allowlist empties
to zero exceptions. New SQLSTATEs: `HC0DC` (label-refused freeze), `HC0DS`
(snapshot unavailable: tombstoned/unbound).

**D7 — production is an assumption the chain survives being wrong about**
*(amended same day: the PO ruled the pre-pilot remote may be RESET at deploy —
zero pilot users — so no dangling row will exist in any database this chain
builds; the guards stay because the deploy strategy is a revocable decision and
the chain must be correct under every strategy).* DM1–DM3 were never pushed, so
prod still runs the pre-DM1 arm whose `source_document_id` FK'd into the old
`attachments` table; its current value is UNKNOWN here (inference, labelled).
Before creating the new FK, M3 nulls any value not resolving to `documents(id)`
(late application of the old FK's `ON DELETE SET NULL`) and **proves itself
in-line**: plant a dead-pointer specimen under the old CHECK → run the guard →
RAISE unless nulled → delete specimen → add the FK → swap the CHECK. The proof
executes on every reset forever and ships no caller-less helper. The reply-table
drop keeps its row-count guard that RAISES — a migration that passes every local
reset and is **intended to hard-fail a future `db push`** if unmodeled rows
exist (fail loudly over destroy silently; disposition: FUP-DM4-PRODROW).
**The reconciler migration (former M5) is DELETED — four migrations, not
five:** a DEFINER reconciler no buildable database needs is born caller-less
(census/floor noise). Tombstone machinery lands in M3 (columns + `HC0DS` door
refusal + CHECK arm) and M4 (`dispose_referral_phi`'s `'phi_disposed'`
tombstoning); the seeded "indisponível" specimen survives at ENC-0001's exact
current fixture position, reason `'legacy_unreconciled'` (retained in the
vocabulary, commented: no live writer post-DM4).

**D8 — storage bytes survive `db reset` (VERIFIED locally, empirically).**
`storage.objects` = 0 rows while the file backend holds 663 orphaned files
(16.5 MB, 162 PHI-tier printed PDFs) — reset wipes metadata, never bytes; and
the Storage API lists FROM `storage.objects`, so orphaned bytes are invisible
to the API as well as to SQL. Consequence for DM5 (filed by the lead as its own
follow-up): a bucket-emptiness proof via the API proves emptiness against a
truncated table; real proofs must enumerate at the backend layer. Remote
behavior is the same mechanism class but is an **inference** — verify at deploy
time.

**D9 — reply-document ROW metadata is metadata-tier and NOT wave-c-gated at
read time; a deliberate position, not an oversight** (lead question 2026-08-14;
pinned executably by 340 E3a/E3b). `get_referral_detail`'s embedded
`reply_documents` projection and `list_referral_reply_documents` serve
title/mime/size/availability/`can_open` to any reader passing the METADATA
tier — the exact authority the retired
`referral_reply_attachment_select_readable` carried, and the same answer the
kernel arm gives a direct PostgREST reader of `documents`. This is not the
Rule-1 "UI hiding" shape: the ACCESS gate is SQL (`can_read_referral` /
`can_read_referral_metadata`), `can_open` is server-computed truth, and bytes
sit behind the PHI-gated doors which re-gate independently. The wave-c flag is
a ROLLOUT switch gating residue CREATION (BEGIN + the freeze arm — the DM3
lesson applied), never historical-row reads — matching Waves A/B exactly,
whose kernel and `documents_select` carry no wave flag either. With the flag
OFF no referral-homed row can come to exist; rows visible flag-OFF are only
those legitimately minted while ON, served to the same readers entitled then.

## Consequences

- Both referral write doors return composites and the new read doors return jsonb —
  ALL in the unruled census blind class: `ARM=census/hat/floor/wrapper` pass
  vacuously for this phase's doors. Evidence is the bespoke red-first keystone set
  (each excluded state neutralized INDEPENDENTLY) + the Amendment-1 diff-scoped
  sweep with its case count checked.
- `get_referral_detail` is rewritten (it embedded the dropped table); the F-14
  signer and the entire `case-documents`/`referral-attachments` policy surface die;
  the buckets themselves wait for DM5's single retirement manifest.
- Rows in `referral_shared_item`/`referral_reply_attachment` were guarded by RLS
  having no write policies, NOT by absent grants (`authenticated=arwdDxtm` on
  both) — the keystone suite now pins zero-write-policies explicitly.
- ⭐ **A door may have more than one lock — neutralizing one and observing no
  leak proves NOTHING about that lock** (matrix finding N10a, beside the
  standing "a neutralization is valid only for its class" rule). Opening
  `open_referral_snapshot_document`'s PHI gate alone leaked nothing, because
  `log_audit_access` carries its OWN authorization and raised. A single-lock
  neutralization would have reported "gate not load-bearing" — a false
  negative that reads exactly like a clean result. The matrix proves each lock
  alone (N10a: the audit raise IS the red) and both together (N10b: the
  assertions flip). Corollary from the same session: **the matrix's own first
  control went green having run nothing** (pgTAP absent → every case aborted →
  zero `not ok` lines read as success); the committed harness now preflights
  and fails loudly — the vacuity class bites inside the tools built to detect
  it.
