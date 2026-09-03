# FUP-DOC-RECLASS-OPERATION-ID — bind reclassification completion to a DB-minted, single-use operation id (owner: backend)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-02 · status open

> PO observation #2 at the 2026-08-27 [rulings](../design/authz-ae1-rpc-rulings.md)
> approval. `reclassify_document` (begin; user-session, the real authorizer) and
> `complete_document_reclassification` (completion; service-role) communicate through four
> loose parameters — version, new file, old file, digest. The completion's relational
> checks (new file `reserved`, version empty, old file same-document, sha match, storage
> presence) bound abuse but **do not prove the tuple came from one begin invocation**.
>
> Fix shape: begin mints a `reclassification_operation_id` carrying the complete tuple;
> completion takes only that id and consumes it **exactly once** (single-use, expiring);
> the four parameters retire. A schema + both-doors + TS-call-site change — its own
> increment, not a rider. The ruled system-actor mechanism (rulings §3) stands meanwhile.
