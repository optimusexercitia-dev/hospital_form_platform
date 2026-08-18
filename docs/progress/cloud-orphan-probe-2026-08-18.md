# Cloud constructed-orphan probe — run record, 2026-08-18

Subject: **`azkbbhskturikxpgmafq`** (production, region `sa-east-1`) · instrument:
[`scripts/cloud-orphan-probe.mjs`](../../scripts/cloud-orphan-probe.mjs) · run
`20260818-072590` · method ruled by **DM-FUP TRIAGE #1**.

Settles `FUP-DM5-CLOUD-ORPHAN-SURFACE`. Consumers: `FUP-DM4-PRODROW`,
`FUP-DM5-NO-ANSWER-VS-NOTHING` (instance 3), `FUP-DM5-STORAGE-ORPHANS` (Cloud half),
`FUP-DM5-D9-NO-ARM-SEES-A-BYTE-POST-RETIREMENT`, `FUP-DM5-BYTE-PROOF-NOT-ATTEMPTED`
(its ruling reserved a revisit against this result).

---

## 1. Verdict

> **Every measured Supabase Cloud surface is METADATA-BOUND. Cloud exposes NO
> orphan-visible surface — not by enumeration, and not by retrieval.**
>
> A byte in the backing store with no `storage.objects` row is invisible to all five
> surfaces below, _while the byte provably still exists_. ADR 0120 D9's byte-side
> controls are therefore **NOT recoverable on Cloud**, and the Cloud byte half is
> **structurally unverifiable** — which is now **measured**, not inferred.

The item's own framing anticipated the opposite possibility ("if it lists an object
whose metadata row is gone… D9's byte-side controls are recoverable there"). They are
not. The conservative reading in the record was the correct one.

## 2. What "no orphan surface" does and does not mean

|                     |                                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Established**     | No customer-reachable surface on this project can enumerate or serve a byte-orphan.                                |
| **Established**     | The byte survives the metadata delete — measured, both directions (§4).                                            |
| **NOT established** | That orphaned bytes are _absent_. The probe proves they are **unobservable**, which is the opposite of reassuring. |
| **NOT established** | Anything about deletion _durability_. A Cloud disposal record can only ever assert "metadata gone".                |

⛔ The practical consequence for the disposal runbook is unchanged and now
**evidenced**: on Cloud the byte half must be recorded as _asserted, not verified_.
There is no surface that could contradict it.

## 3. Results

Instrument proof-of-life: in the BEFORE state all three objects hold metadata rows, so
every surface must see them. **All five surfaces PROVEN.** A surface that fails this
arm is classified `INVALID`, never "no".

### BEFORE — all objects hold metadata rows

| Surface                                       | control | subject                           | Verdict         |
| --------------------------------------------- | ------- | --------------------------------- | --------------- |
| S3 `ListObjectsV2` (session-token auth)       | seen    | **seen**                          | proof-of-life ✔ |
| S3 `ListObjectsV2` (dashboard access keys)    | seen    | **seen**                          | proof-of-life ✔ |
| Storage REST `/object/list` (service_role)    | seen    | **seen**                          | proof-of-life ✔ |
| Storage REST `GET /object` (byte retrieval)   | seen    | **seen** (189 B, `cf-cache=MISS`) | proof-of-life ✔ |
| `supabase storage ls --linked --experimental` | seen    | **seen**                          | proof-of-life ✔ |

### AFTER — `orphan.bin` + `retrieval-only.bin` rows deleted, bytes left

| Surface                                       | control | orphan                                             | Verdict            |
| --------------------------------------------- | ------- | -------------------------------------------------- | ------------------ |
| S3 `ListObjectsV2` (session-token auth)       | seen    | not seen                                           | **METADATA-BOUND** |
| S3 `ListObjectsV2` (dashboard access keys)    | seen    | not seen                                           | **METADATA-BOUND** |
| Storage REST `/object/list` (service_role)    | seen    | not seen                                           | **METADATA-BOUND** |
| Storage REST `GET /object` (byte retrieval)   | seen    | not seen (HTTP 400 `NoSuchKey`, `cf-cache=BYPASS`) | **METADATA-BOUND** |
| `supabase storage ls --linked --experimental` | seen    | not seen                                           | **METADATA-BOUND** |

**Both S3 auth modes were measured.** Session-token auth respects RLS per Supabase's
docs, so a "not seen" under it alone would carry an RLS confound; dashboard access keys
bypass RLS by design. Both returned the same answer, so the confound is eliminated
rather than argued away. ⭐ Session-token auth (`access_key_id` = project ref,
`secret` = anon key, `session_token` = a JWT) needs **no dashboard-minted key** — the
human step this item was blocked on for its whole life was never strictly required.

## 4. The byte provably survived — so no arm is vacuous

The whole measurement is worthless if the metadata delete also removed the byte: every
surface would report "not seen" because there is nothing to see. Both directions were
measured on the **same path**, cache-free:

| Step                                              | Result                                                    |
| ------------------------------------------------- | --------------------------------------------------------- |
| Row deleted, **first-ever request** for that path | HTTP **400** `NoSuchKey`, `cf-cache-status: BYPASS`       |
| Row restored with its **original `version`**      | HTTP **200**, 92 B, correct body, `cf-cache-status: MISS` |

The only prior request for that path returned 400, so the 200 cannot be a stale cache
entry, and it is served from origin (`MISS`). The byte was on the backing store
throughout. **The 400 is metadata-binding, not byte absence.**

Negative control: a never-uploaded path in the same bucket also returns 400 — so 400 is
not a universal answer, and the detector discriminates.

## 5. Two defects found in the instrument, in flight

Both were caught by the probe's own controls, and both are now encoded in the script.

### 5.1 The proof-of-life contaminated its own subject (a FALSE POSITIVE)

The first production run reported **`ORPHAN-VISIBLE`** on byte retrieval: HTTP 200,
189 B, for an object with no row. It was **wrong**. Cloud fronts these GETs with a CDN
(`cf-cache-status: HIT` on the control). The BEFORE-state GET — _this probe's own
positive control_ — populated the cache; after the row was deleted the CDN kept serving
the cached copy. The same request minutes later returned 400.

⛔ **A cache-buster query parameter does NOT fix this** — a unique `?probe_cb=` still
returned `cf-cache-status: HIT`. Encoding the buster as the fix would have been a
partial fix reading as a complete one. The only reliable defense is a path **never
requested before**, so the retrieval arm now uses a dedicated third object
(`retrieval-only.bin`) that is uploaded, orphaned, and requested exactly once — in the
after-state. Its proof-of-life comes from the control instead.

⭐ **The generalisable lesson:** _a detector's positive control can contaminate the
subject it is controlling for._ The before/after design that makes a "no" trustworthy
is the same design that primed the cache which manufactured a "yes".

### 5.2 Cleanup could have ADDED to the population it was measuring

The Storage API deletes the backing path `<bucket>/<name>/<version>`. An orphan has no
row, so cleanup must restore one — and a restore that invents a fresh `version` deletes
a path that does not exist: **the API reports success and the file stays on disk.**
Proven byte-level on the local stack (volume walk before/after). The construct step now
**captures `id`/`version`/`metadata` before the delete**, and cleanup restores exactly.

### 5.3 One anomaly that could not be explained

The very first rehearsal run reported `control=true` from `supabase storage ls
--linked` against a bucket that existed only locally — a target that provably cannot
see it (reproduced: `--linked` returns empty). The re-run **overwrote the state file**,
destroying the raw output, so it is permanently unexplainable. Same evidence loss as
`FUP-GATE-PDFP1-FLAKE`. Fixed: `saveState()` now also writes an immutable
`run-<runId>.json` that no later run can overwrite. Recorded rather than papered over.

## 6. ⚠ CORRECTION — the "~49 objects vanished with no `DELETE`" figure is **unsound**

`FUP-DM4-PRODROW` was escalated on census forensics reading _`storage.objects` 96
inserted / 47 deleted / 0 live ⇒ ~49 objects vanished with no `DELETE`_. That
subtraction does not hold. **Measured today on the same table and project:**

| Action                       | `n_tup_ins` | `n_tup_del` |
| ---------------------------- | ----------- | ----------- |
| Upload exactly **5** objects | **+6**      | +0          |
| Delete exactly **5** objects | +4          | **+5**      |

Deletes track objects 1:1; **inserts do not** — the storage API's write path inserts
more tuples than objects. After the session the counters read **122 ins / 62 del**, a
naive residual of **60**, while the true live count is **0**.

> ⭐ **I manufactured a residual of 60 while destroying nothing unaccounted for.** The
> residual is not a count of anything real, and it is not evidence of vanished objects.

⛔ This does **not** show that nothing was lost: the production DB _was_ reset and _is_
empty, and §1 shows any surviving bytes would be unobservable anyway. What it shows is
that the specific arithmetic used to **size** the loss compares two different units, so
the "~49" figure must not be carried forward or cited. `pg_stat_all_tables` is also an
approximate collector view — `n_live_tup` read **3** while the true count was **5**.

⇒ `FUP-DM4-PRODROW` is unblocked, but on a corrected basis: its blocker is answered
(§1), and its headline magnitude needs re-deriving from something other than these
counters. Per TRIAGE #9 it may still never close as "reconciled" — no per-row
freeze-or-tombstone decision was made and no manifest exists.

## 7. Cleanup and residue — stated honestly

Production is back to baseline: **0 live objects**, the 4 original buckets
(`documents-phi`, `documents-standard`, `form-assets`, `meeting-audio`), no
`orphan-probe-*` bucket or row. All probe objects were removed through the Storage API
with correct `version`s — the mechanism proven byte-level on the local stack.

⛔ **Byte-level confirmation on Cloud is impossible, by this probe's own finding.** The
HTTP 400s returned for the deleted paths prove only that the metadata is gone — exactly
the inference §1 forbids. This run's cleanup is therefore _asserted, not verified_, on
the same footing as every other Cloud deletion. The local rehearsal is the only place
where "the bytes are gone" was actually observed (volume walk: clean).

## 8. Reproduction

```bash
node scripts/cloud-orphan-probe.mjs preflight
```

Phases are separate so each mutating step on a production project is individually
authorized: `construct` → the printed SQL (capture, then delete under a
`set_config(..., true)` inside one `do $$` block, since `storage.protect_delete` blocks
a bare `DELETE`) → `measure --orphan-confirmed` → `cleanup` → `report`.

`PROBE_ALLOW_LOCAL_REHEARSAL=1` runs the whole instrument against the local stack and
**refuses to emit a Cloud verdict**. The rehearsal is what proved the tool could find
something before it got its one shot; local orphan visibility is a property of the
`file` backend and must not be carried to Cloud.
