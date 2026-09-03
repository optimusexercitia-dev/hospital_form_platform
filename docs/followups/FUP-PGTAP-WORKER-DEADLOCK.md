# FUP-PGTAP-WORKER-DEADLOCK — `npm run test:db` intermittently deadlocks a `pg_prove` worker (owner: backend)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-14 · status parked

Filed 2026-08-14 (lead), also carried out of prose. Non-deterministic; observed during DM5 gate runs.
Impact is **assurance, not correctness**: a hung/aborted worker can drop a suite from the run, and a
suite that never ran is not a suite that passed — the same shape as
[[gate-summary-can-hide-unrun-tests]]. **Mitigation until diagnosed:** always read the file/assertion
totals (`192 files / 6284`) against the previous known-good run, never a trailing summary line, and
never pipe the run through `tail`. Diagnosis wants the lock graph at hang time
(`pg_stat_activity` + `pg_locks`), which nobody has captured yet.

⭐ **First concrete lock-surface lead, from DM5·S3 QA r2 (2026-08-14):** `342`'s **`S3n` takes ACCESS
EXCLUSIVE on `file_objects`** — a table that many suites touch. That is a *candidate* for the contended
object, not a diagnosis: the hang was never reproduced under observation, and naming a plausible lock is
how a real cause gets closed early. Whoever picks this up should start by checking whether the observed
hangs correlate with `342` being in flight at all.
