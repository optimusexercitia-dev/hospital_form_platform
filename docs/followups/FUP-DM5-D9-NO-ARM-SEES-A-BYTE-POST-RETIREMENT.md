# FUP-DM5-D9-NO-ARM-SEES-A-BYTE-POST-RETIREMENT — after `…000400` applies, the retirement tool has no Cloud-visible arm left (owner: backend; **input to S5/S6 + the deploy runbook**)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-17 · status open

Filed 2026-08-17 (lead) from QA's DM5·S4 review MINOR-5. **Scoped to the new half only** —
FUP-DM5-STORAGE-ORPHANS is separately open and not re-litigated here.

> ⭐ **UPDATE 2026-08-17 (DM5·S5, QA r1 INFO-3) — the LOCAL half of this item is now materially
> better; the CLOUD half is untouched and the item does NOT close.** Two `verdictFor` fixes landed in
> S5 and both redden states that previously printed `CAPTURE CLEAN` with exit 0 *locally*:
> **`BUCKET_ABSENT_ORPHANED_BYTES`** (bucket row gone, bytes still on the volume) and
> **`MISSING_BYTES`** (volume directory gone, metadata still listing keys — QA MAJOR-1), plus
> **`UNVERIFIED_PROOF_ERROR`** so a failed measurement is no longer read as emptiness. So the sentence
> below — *"post-migration `capture` prints CAPTURE CLEAN"* — **no longer holds for a retired bucket
> whose bytes survived**, which is the case that mattered. ⛔ **What has NOT changed:** on Cloud there
> is still no byte-visible arm at all, and S5 additionally established that a local proof run against a
> Cloud client would attest to the **wrong project's** bytes (now guarded — see
> FUP-DM5-CLOUD-ORPHAN-SURFACE). The Cloud half is the whole remaining item.

Post-migration, `storage-manifest.mjs capture` over the retired scope prints **`CAPTURE CLEAN`**. The
tool is honest — its volume proof *did* fire for absent buckets in the committed S4 manifest — but two
operational consequences are written down nowhere:

1. **Once `20260927000400` has applied, the only arm that can still see a surviving byte is the volume
   `walk`, which is `STORAGE_BACKEND=file` and therefore LOCAL-ONLY.** On Cloud, post-migration, the
   retirement tooling has **no arm at all** that can see one.
2. ⭐ **The migration's guard cannot enforce the ordering it documents, in the case that matters.** It
   refuses when `storage.objects` rows remain — but an *orphaned* bucket satisfies "no rows" perfectly.
   So the guard enforces byte-first ordering exactly when the bytes are still tracked, and is silent
   precisely when they are not. **The guard is real and it is not a proof of emptiness.**

**Why it matters:** this is the ordering that runs at deploy, against a bucket set that *does* have
metadata rows — so the guard will do its job there. The gap is the residual: nothing can confirm
afterwards, on Cloud, that no byte survived. Record it in the deploy runbook rather than discovering it
during the deploy.
