# FUP-ONE-SUPABASE-PROJECT-SERVES-TEST-AND-PRODUCTION — the "prod project" the archive defers to does not exist (owner: PO decision, then lead)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-01 · status open

> **Filed 2026-09-01**, out of ADR [0175](../decisions/0175-ae4-po-batch-oracle-inputs-and-arm3-deferral.md)
> D4(b). ⛔ **This is NOT the D4(b) item.** D4(b) asked what production's auth setting is; this is
> what answering it *uncovered*, and the two have different remedies. Filed separately so closing
> one cannot read as closing the other.
>
> ## The measurement
>
> `list_projects` (Supabase MCP, 2026-09-01) returns **exactly one** project:
> `azkbbhskturikxpgmafq`, name "Forms", region `sa-east-1`, `ACTIVE_HEALTHY`, created
> 2026-06-11. There is no second project in the account.
>
> That single ref is simultaneously:
> - what `npm run db:link` targets (CLAUDE.md §9 names the ref literally),
> - what `npm run db:push` writes migrations to,
> - what **`npm run db:reset:linked`** would destroy — CLAUDE.md marks it *"(destructive!)"*,
> - what the AE3 cutover pushed to, and what Coolify serves ([2026-Q3.md](../progress/2026-Q3.md), the AE3 cutover entry).
>
> And it currently holds fixture data: **37 `auth.users` rows** against a **36-row** seed roster
> (read-only aggregate; no rows read).
>
> ## The false premise this retires
>
> `follow-ups-archive.md:68` — an **archived, therefore unreviewed** line — reads:
>
> > DONE on the remote **TEST project** `azkbbhskturikxpgmafq` … **Still TODO for real
> > production**: re-apply on the prod project at deploy.
>
> ⛔ Both halves are load-bearing and the second is false: **there is no prod project to
> re-apply anything on.** The line is not merely stale — it describes a two-environment world
> that has never existed, and it sits in an archive nothing sweeps. Anything else deferred to
> "the prod project at deploy" is deferred to nowhere; that deferral was not audited when this
> was filed, and auditing it is part of the work.
>
> ## Why it is filed rather than fixed
>
> The remedy is a PO decision with real cost either way, and neither branch is a session's call:
>
> - **(a) Accept one environment**, and make the consequences explicit rather than implicit:
>   retire `db:reset:linked` (or gate it behind a confirmation naming the project), state in the
>   pilot decision that test fixtures and production data share a database, and re-scope every
>   "TODO at deploy" that assumed a second project.
> - **(b) Create a second project** and split the roles — then the schema-first push rule, the
>   E2E target, the Coolify environment and the backup posture (C3) all need re-pointing, and
>   the cutover is its own increment.
>
> ## Trigger — and why it is not "someday"
>
> ⛔ **BEFORE THE PILOT LOADS REAL DATA.** Today the exposure is bounded because there are no
> real users: 37 rows, all fixture-shaped. The moment a pilot record lands, a `db:reset:linked`
> — a command that exists, is documented, and has no second target to be pointed at by mistake
> **because there is no second target** — destroys production. ⚠ This compounds the recorded
> hazard *"a remote reset seeds PRODUCTION with the E2E fixture"*, which assumed the operator
> aimed at the wrong project; here there is only one to aim at.
>
> ⚠ **Adjacent, not the same, and easy to conflate:** **C3**
> (`FUP-DM5-BACKUP-HAS-NO-CLOUD-FORM`) says there is no Storage recovery point. This says the
> production database is also the test database. C3 is *can we get it back*; this is *what can
> destroy it in the first place*. If both stand at pilot, a single mistaken command is
> unrecoverable — but they are separate decisions with separate remedies, and merging them
> halves the chance either closes.
>
> ⭕ **May warrant promotion to the ⭐⭐ Critical list** — it has the shape (hard trigger, no artifact in
> the tree, no gate can notice it). Not promoted unilaterally: that table is the PO's.
