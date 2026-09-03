# FUP-DOC-DISPOSAL-PROVENANCE-SPLIT — split `complete_document_disposal` by provenance (owner: backend/PO)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-02 · status open

> PO observation #3 at the 2026-08-27 [rulings](../design/authz-ae1-rpc-rulings.md)
> approval. One generic service-role completion door serves two provenances with different
> authorization, evidence, and audit requirements: **(a)** automated duplicate retirement
> (the reclassify lane sets `disposal_reason_category = 'duplicate'` system-side) and
> **(b)** a human performing a DSR/manual disposal. The generic door erases the
> distinction — the audit row cannot say which kind of act it records beyond
> `reason_category`, and lane (b) should name the human authority in the DSR record
> (LGPD).
>
> Fix shape: split by provenance — two doors, or a provenance argument validated against
> the pending row's `reason_category` — with per-lane evidence contracts and audit verbs.
> Interim: the ruled mechanism (rulings §4 — a recorder of an already-performed deletion,
> retention blocks + absence verification in-function) stands; the app call site remains
> system-owned (`documents/actions.ts:reclassifyDocument`).
