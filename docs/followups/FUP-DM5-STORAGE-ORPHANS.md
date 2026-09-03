# FUP-DM5-STORAGE-ORPHANS — a **LOCAL** DB reset wipes `storage.objects` but NOT the bytes; ⚠ **the REMOTE half was a stale inference and is now demoted to residual** (owner: lead + backend; blocks DM5 step 3 **locally**)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-14 · status open

> ## ⭐ MECHANISM MEASURED 2026-08-18 — the guard exists, and TRUNCATE walks past it
>
> `storage.objects` carries a platform trigger **`storage.protect_delete`** (statement-level, on
> DELETE): a bare `DELETE` raises **`42501`** — *"Direct deletion from storage tables is not allowed.
> Use the Storage API instead"*, hint *"This prevents accidental data loss from orphaned objects."*
> So the casual path into this item's failure mode **is already blocked**, by Supabase, by default.
>
> ⛔ **`TRUNCATE` is not.** Measured on the local stack: upload an object → `TRUNCATE storage.objects`
> succeeds, rows gone, **byte still on disk** (`/mnt/stub/stub/<bucket>/<name>/<version>`). TRUNCATE
> fires no DELETE trigger, so no statement-level guard can see it. That is the shape of every
> orphaning event this item is about: resets, truncates, schema drop/recreate — the **bulk and
> structural** operations, never a stray per-row delete.
>
> ⇒ Restates the item's scope precisely: *routine per-object work is protected; bulk operations are
> not, and no trigger can protect them.* The grant half is closed under FUP-PCITV-1 item 3
> (`20260928000900`); the platform tables keep the grant and that is accepted in writing there.
> ⚠ Also note `/var/lib/storage` is **not** the storage root (`FILE_STORAGE_BACKEND_PATH=/mnt`) — a
> `find` against the wrong root returns a false *"the byte is gone"*.

> ⛔ **CROSS-LINK, added by lead ruling 2026-08-17 (DM5·S5): this item's Cloud half is now
> [FUP-DM5-CLOUD-ORPHAN-SURFACE](./follow-ups-archive.md), a separate item** (✅ resolved 2026-08-18;
> body rotated to the archive 2026-08-31, so this is no longer an in-file anchor)**.** The S3-endpoint
> question was a **parenthetical inside this body**, under a headline reading *"closes empty by
> measurement"* — and *an item that can change a verdict does not live inside the parentheses of the
> verdict it would change*. **Closing THIS item does NOT close that one**, and this body's
> "closes empty by measurement" conclusion is about the **retirement-scope, local** question only.

> ### 📌 S4 OUTCOME 2026-08-16 — the local half is now DEMONSTRATED, not predicted, and it is **not closed**
>
> S4 ran. Measured before touching anything: **`storage.objects` = 0 rows across all 12 buckets** against
> **866 files / 9.9 MB / 235 PHI-tier** on the volume — **221 / 6.93 MB / 15 PHI** in the 8 retirement
> buckets, reproducing S0's figure exactly. **The manifest-first delete was therefore a NO-OP:** every one
> of those bytes is an orphan with no metadata row, so the Storage API cannot address it, and
> `capture` returned the `DEGENERATE BASELINE` verdict by design.
>
> - ✅ **What S4 did close:** the metadata/schema half — 8 bucket rows + the last 4 policies retired by
>   migration `20260927000400`, pinned by `325` t6/t7 (+t8 control) so it survives `db reset`.
> - ⛔⛔ **CORRECTED 2026-08-17 by QA (S4 review B1) — THE 221 FILES NO LONGER EXIST, AND THEY DID NOT GO
>   THROUGH THE GATE.** The text this bullet used to carry ("they are still on the volume … PO ruled to
>   leave them") was **false when it was written**. Measured independently, twice:
>   `docker volume inspect supabase_storage_…` → `CreatedAt 2026-08-17T01:06:02Z` (the volume object was
>   **destroyed and recreated**), and `storage-manifest.mjs walk` → *"(no directory on the volume)"* for
>   **all eight** retirement buckets, `TOTAL files=78`, all in survivor buckets; `capture` →
>   `orphan_keys=0`, verdict **`CAPTURE CLEAN`** — against a committed manifest taken 10 minutes earlier
>   on the same stack recording **221 files / 6,927,804 bytes / 15 PHI-tier**.
>
>   **Cause — the lead, and it is worth naming precisely.** Timeline (local = UTC−3): manifest
>   `00:55:57Z` (221 present) → E2E batch 4's reset 502'd `~01:01Z`, lead killed the run and a
>   **mid-flight `supabase db reset`** → `supabase start` hit a container-name conflict → lead ran
>   **`supabase stop` + `supabase start`** → **volume recreated `01:06:02Z`**. `supabase stop` reported
>   `"backup":true` and removed the storage volume regardless. ⚠ Which step of that recovery did it is
>   **not established and no mechanism is invented here** — but it happened inside the lead's recovery
>   sequence and nothing else in the window fits. (E2E run 2 started `01:09Z`, *after*.)
>
>   ⛔ **This was a disposal WITHOUT EVIDENCE — 221 files, 15 PHI-tier — inside the very slice that
>   ratified D9.** No manifest at disposal time, no `deleted == manifest` comparison, no audit row. That
>   is precisely the event D9 exists to prevent. It does not touch S4's schema work, and the bytes were
>   regenerable local dev artifacts — but *"the byte half was a no-op"* is only half true: **the bytes
>   went; they just didn't go through the gate.**
>
>   ⛔ **The PO ruling of 2026-08-17 ("leave them; keep this open") was MOOT when it was given** — made
>   **3h11m after** its subject ceased to exist, because the lead re-used a 00:55Z measurement instead of
>   re-measuring at decision time. Outcome unchanged (nothing to delete either way), but the PO was asked
>   to rule on a state that no longer existed. ⭐ **A decision brief must carry a measurement taken at
>   decision time, not the one that motivated the question.**
>
> #### ✅ RE-PUT AND RULED 2026-08-17 — this time on a measurement taken AT decision time
>
> B1 required the question be re-put to the PO. It was, carrying a **fresh** measurement rather than the
> one that motivated it — the discipline this entry's own ⭐ demands, applied to itself. Measured on a
> freshly-rebooted stack immediately after a clean `db reset`, minutes before asking:
>
> | scope | files | bytes |
> | --- | --- | --- |
> | the **8 retired** buckets | **0** | 0 |
> | the **4 surviving** buckets (`documents-standard`/`-phi`, `form-assets`, `meeting-audio`) | **166** *(at 03:45Z)* | 2,970,290 |
>
> ⛔ **The survivor row is a TIMESTAMPED OBSERVATION, not a count — and it went stale inside the same
> session** (QA r2 INFO-5). After the `e2e:prod` gate it read **245 files / 4,394,074 B** (QA, ~04:55Z)
> — ⛔ **and the "moved AGAIN 30 min later" claim that stood here was WRONG (QA r3 MINOR-11).** I read
> `du -sb /mnt` = 4,402,266 against QA's `du -sb /mnt/stub/stub` = 4,394,074 and called it drift. Both
> re-run at the same instant reproduce **both** numbers: the 8,192 B is two 4 KiB wrapper-directory
> inodes, i.e. **my measurement scope, not elapsed change.** ⭐ *Two measurements at different grains
> compared as a time series* — [[a-predicate-quoted-at-the-wrong-grain]]. **State the method beside any
> byte figure**; note `du -sb` (allocated, 4,394,074) and `stat -c %s` (apparent, 2,456,666) differ by
> 1.94 MB on this same volume. The conclusion below is unaffected: it rests on the **166 → 245 drift
> across the gate**, measured at both ends —
> `documents-phi` **68** · `documents-standard` **156** · `form-assets` **12** · `meeting-audio` **9**,
> against **0** `storage.objects` rows, so all 245 are orphans. ⭐ **This is why the PO ratified a CLASS
> and not a number:** every gate run writes bytes and every reset orphans them, so any survivor count is
> obsolete before it is committed. **Do not "refresh" this figure — quote the mechanism.** The retired
> buckets' **0** is the durable half: nothing writes to a bucket that does not exist.
>
> **PO ruling: the local volume is RATIFIED as non-durable, disposable test residue.** No cleanup step,
> no gate, no local manifest discipline. The two rejected options are recorded because they were live:
> clearing the volume as part of `db reset` (declined — it changes shared tooling every session depends
> on, and destroys evidence a future incident may need), and holding the 166 to full manifest discipline
> (declined — right discipline, wrong scope).
>
> ⭐ **What the fresh measurement changed about the question.** The 166 are **not** retirement residue.
> They are ordinary E2E/print artifacts that **the reset orphaned as it ran** — so local orphan
> accumulation is not an S4 artifact at all, it is a **standing byproduct of `db reset` on any stack that
> has written bytes**. That is D17's correcting insight, no longer an argument but a measurement. Had the
> question been re-put on the old 221-file framing, the PO would have ruled a second time on a state that
> no longer existed — the exact failure B1 was filed for.
>
> **What this closes:** the *retirement-scope* orphan question — and it closes **EMPTY BY MEASUREMENT**,
> zero bytes in all eight retired buckets. Not by disposal, not by argument, and not by the destruction
> of 2026-08-17 `01:06:02Z`, which remains an unevidenced disposal and is charged to
> **FUP-DM5-STACK-CYCLE-DESTROYS-BYTES**, not discharged here.
>
> - **This item stays OPEN on its Cloud half ONLY**, and its centre of gravity has moved: the remaining
>   question was never the local bytes, it is that **on Cloud there may be no customer-accessible tool
>   that can SEE an orphan** (the S3-protocol endpoint is still UNPROBED). See also
>   **FUP-DM5-STACK-CYCLE-DESTROYS-BYTES**.
> - ⚠ **`delete --execute` has still never run against a populated bucket.** Its correctness rests on S0's
>   8/8 self-test, not on an S4 execution — so **the production sequence remains unrehearsed end-to-end**,
>   even though production is where it is actually meaningful (it has metadata rows: 45 objects at the
>   2026-08-11 census). ✅ **OWNED 2026-08-17 — the PO directed the rehearsal into S5 as `S5.R`**
>   ([plan](../plans/dm5-wave-d-retirement-plan.md) § S5.R): the **with-metadata** path, on a
>   purpose-made disposable bucket (the eight retired ones now return `BUCKET_ABSENT` and hold 0 bytes),
>   with all four acceptance items proven able to FAIL. ⚠ **Naming an owner is not a rehearsal** — this
>   bullet stands until S5.R runs, and a green *local* rehearsal still does not license the Cloud
>   sequence, which is what keeps this follow-up open.
>
> ### ⛔ AMENDMENT 2026-08-14 — the remote half's premise was WRONG. Severity 🔴 → 🟠.
>
> This filing reasoned from the local measurement to remote by *"the same mechanism class."* **The
> mechanisms are different**, and the remote one does not exist at the CLI version this repo pins.
>
> - **Local — still true, and structural:** the database is recreated wholesale while the **Docker
>   volume survives**. Measured: `storage.objects` **0 rows vs 699 objects / 7.02 MB / 198 PHI-tier**.
>   Everything below about the local mechanism stands, and it is what blocks S4's *"prove empty via the
>   API, then delete the bucket"*.
> - **Remote — gone:** the orphaning came from **one line** in the CLI's
>   `pkg/migration/queries/drop.sql` truncate loop
>   (`or c.relnamespace::regnamespace::name = 'storage' and c.relname != 'migrations'`), added by
>   [cli#3083](https://github.com/supabase/cli/pull/3083) 2025-01-30 and **reverted by
>   [cli#3359](https://github.com/supabase/cli/pull/3359) 2025-03-27** — *"causing too much confusion
>   and accidental deletes to be worthwhile."*
>
> **Verified at OUR version against the artifact, not the PR title** — grepping the embedded SQL in
> `node_modules/@supabase/cli-windows-x64/bin/supabase-go.exe` (**v2.105.0**), lead-reproduced:
> `name = 'storage'` → **0 hits**; `name = 'auth'` → **3 hits**. The `auth` sibling is the adjacent
> line of the same loop, untouched by the revert — it is the **positive control** proving the SQL is
> greppable here and the pattern shape right, so 0 means *absent*, not *unfindable*.
>
> **Consequences:** a `db:reset:linked` would **not** orphan the remote's objects — which also reverses
> a live warning feeding **FUP-DM4-PRODROW**'s deploy decision. **The Cloud orphan-*detector* question
> drops from S4 blocker to residual**, since a detector matters only for orphans something can create.
> ⚠ **The manifest-then-reset ordering still STANDS** on the local rationale alone (ADR 0120 D17's
> second correction) — this is not licence to reset first.
>
> ⭐ **A correctness property can live in a DEPENDENCY's source and regress on `npm update`.** This one
> went true → false → true across CLI versions, and `package.json` pins **`^2.105.0`** — a caret range,
> so a routine update can silently re-arm it. Record it as *"true at v2.105.0 because that line is
> absent,"* never as *"Supabase behaves this way,"* and **re-run the grep-with-control on any CLI bump**.
> ⚠ Bounds one mechanism in the shipped binary: not a runtime observation, and not proof that no other
> code path clears storage.

Filed 2026-08-14 during DM4 planning. Found by `backend`, **independently reproduced by the lead**
on the local stack — empirical, not inferred.

**The measurement.** `storage.objects` held **0 rows** while the storage backend
(`STORAGE_BACKEND=file`, `/mnt`) held **663 files / 16.5 MB**, of which **162 are PHI-tier**
(`printed-documents/phi/*.pdf`, E2E residue). `supabase db reset --local` wipes the metadata and
**does not touch the bytes**.

**Why this is 🔴 and not a curiosity.** The Storage API **lists from `storage.objects`**. So
orphaned bytes are invisible **to the API as well as to SQL** — there is no supported read path
that sees them. DM5 step 3's method is: *"for each bucket, prove zero DB references + zero product
callers + zero policies, then empty + delete the bucket (Storage API only — never
`storage.objects` DML)."* Run after any reset, that procedure would **prove emptiness against a
truncated table, delete nothing, and report success** while PHI-tier bytes persist backend-side.
⭐ *An emptiness proof derived from a table that was just truncated is not an emptiness proof* —
the same shape as [[a-detector-that-finds-nothing-must-be-proven-able-to-find-something]].

**What DM5 must do instead:** enumerate at the **backend layer**, not the metadata layer — locally
the volume; remotely whatever the platform exposes for the S3 store — and reconcile that
enumeration against `storage.objects` in **both** directions before declaring a bucket empty.

**⚠ Remote behaviour is an INFERENCE, explicitly not verified.** Nobody has queried or inspected
the linked project. The remote reset is also a database-level reset and platform S3 bytes surviving
it is the same mechanism class, but that **must be verified at deploy time or via vendor docs, never
assumed from the local finding**. ⚠ Note the remote has never received DM1+, so its bytes include
the 2026-08-11 production census (45 objects) — **a remote reset would orphan all of them**, which
is a live input to [[FUP-DM4-PRODROW]]'s deploy decision, not a DM5-only concern.

---

**🟡 UPDATE 2026-08-14 — the METHOD half is RULED (ADR [0120](../decisions/0120-dm5-wave-d-retirement-decisions.md) D9); the REMOTE half stays open.**

Re-measured at the DM5 open on a HEAD stack: **`storage.objects` = 0 rows** against **699 objects /
7,023,687 bytes**, **198 PHI-tier** (`attachments-phi` 6, `documents-phi` 183,
`printed-documents/phi` 9); `list` returns `[]` for **all 12** buckets. Figures differ from the
663/16.5 MB/162 above because that was a different stack state — **both are real; neither
supersedes the other**, and the drift is itself the point.

**Ruled:** the plan's Storage-API emptiness method is **WITHDRAWN**, replaced by **manifest-first
deletion** — capture the authoritative key list *before* any destructive step, delete by key, assert
`deleted_count == manifest_count` per bucket. This converts an unfalsifiable negative into a
positive count comparison: a truncated table now yields a **visibly zero-length manifest** instead
of a silent pass. Backend-agnostic, so it transfers to Cloud; the local volume walk is the
**proof harness**, not the gate (it depends on `STORAGE_BACKEND=file`).

**⚠ Calibration the original filing lacks — it lowers the severity but not the priority.** The
orphans are **not servable**: a service-role `GET` on a known orphan key returns **400** and `sign`
returns **404 not_found**, because every read path resolves metadata first. So this is a
**data-at-rest / disposal-assertion** problem — Rule 12, LGPD erasure, the F-02 class — **not a live
exposure**. It is also *why* API-based enumeration fails by construction, so the calibration and the
method ruling are the same finding seen from two sides.

**Still open (do NOT read D9 as closing this):** on Cloud there may be **no customer-accessible tool
that can see an orphan** — dashboard, CLI and supabase-js all list from `storage.objects`, and the
S3 endpoint is **UNVERIFIED** (the local probe needs SigV4; the remote is off-limits under the
standing no-push directive). Also `scripts/document-reconciliation.mjs:58` covers only **2 of 12**
buckets and lists *from* `storage.objects`, so it cannot see this class either — widened in DM5 S0.

---
