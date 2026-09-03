# FUP-DM4-PRODROW — reconcile the dangling frozen PRODUCTION snapshot row at the push/deploy step, not during DM4 (owner: lead + backend)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-14 · status open

> ## ⭕ UNBLOCKED 2026-08-18 — the blocker is answered, and **this item's own headline figure is WITHDRAWN**
>
> **1. The blocker is discharged.** `FUP-DM5-CLOUD-ORPHAN-SURFACE`'s constructed-orphan probe
> ran and settled: **no Cloud surface can see a byte-orphan**
> ([run record](../progress/cloud-orphan-probe-2026-08-18.md)). Per TRIAGE #9 this item tracks *two*
> questions and the probe answers the **byte** one only — so *"erased, not reconciled"*
> survives it, and this may still never close as "reconciled": no per-row
> freeze-or-tombstone decision was ever made and no manifest exists.
>
> **2. ⛔ WITHDRAW the "~49 objects vanished with no `DELETE`" figure — the arithmetic is
> unsound.** It came from `storage.objects` reading *96 inserted / 47 deleted / 0 live*, and
> that subtraction compares two different units. **Measured on the same table and project,
> 2026-08-18:** uploading exactly **5** objects moved `n_tup_ins` by **+6**; deleting exactly
> **5** moved `n_tup_del` by **+5**. Deletes track objects 1:1; **inserts do not** — the
> storage write path inserts more tuples than objects. After the probe session the counters
> read **122 ins / 62 del**, a naive residual of **60**, with a true live count of **0**.
>
> > ⭐ **A residual of 60 was manufactured while destroying nothing unaccounted for.** The
> > residual is not a count of anything real. `pg_stat_all_tables` is an approximate
> > collector view besides — `n_live_tup` read **3** when the true count was **5**.
>
> ⚠ **This does NOT rehabilitate the remote.** The production DB *was* reset and *is* empty;
> and by finding (1) any surviving bytes would be unobservable regardless. What changes is
> only that the **magnitude** must be re-derived from something other than these counters,
> and the "~49" must not be cited again. *A figure quoted from a real counter, at the wrong
> grain, reads exactly like forensics* — the same class as
> [[a-predicate-quoted-at-the-wrong-grain]], and the correction to it must not repeat
> [[a-partial-fix-reads-as-a-complete-one]]: the direction is corrected **and** the magnitude
> is withdrawn rather than restated.

> ## ⛔ CENSUS RUN 2026-08-18 (step 1 of TRIAGE #6) — **THE SUBJECT IS GONE, AND IT WAS ERASED, NOT RECONCILED**
>
> **The production database is empty.** Every application table 0 rows; `auth.users` 0; all 4 buckets
> 0 objects. The 2026-08-11 subject of this item — 1 dangling frozen referral path · 3 unreferenced
> controlled-doc objects · 4 dangling attachment rows · 45 objects / ~0.5 MB — **no longer exists.**
> Full census with deriving queries: `docs/backend-state.md` § REMOTE CENSUS 2026-08-18.
>
> ### ⭐ It did not get reconciled. It got truncated.
> `pg_stat_all_tables` distinguishes the two, and the distinction is the whole finding:
> `auth.users` shows **631 inserts, ZERO deletes, ZERO live rows** — a row-level `DELETE` increments
> `n_tup_del`, so 631-in / none-deleted / none-left is only explicable as **TRUNCATE/reset semantics**.
> Only **6 of 165** public tables ever recorded a single `DELETE`.
>
> ### ⭐⭐ WHEN — the logs answer it, and the answer EXONERATES everyone while indicting the RECORD
> `query_logs` retains to 2026-08-17T10:08. At **2026-08-17 11:37:35 UTC**: `CREATE TABLE IF NOT EXISTS
> supabase_migrations.schema_migrations` → every `CREATE EXTENSION` → then migrations from **`20260711…`**
> being *applied*. Old migrations only re-run if the history table is empty; a `db push` skips them.
> **That is a remote reset.** The `db push` the record knows about came *after*, at 2026-08-18 01:19.
> No `TRUNCATE`/`DROP SCHEMA` statement appears in the window at all.
>
> **So the reset preceded TRIAGE #6 by ~14 hours.** Nobody disobeyed the sequencing — ⭐ **TRIAGE #6 was
> RULED ON STALE FACTS.** It carefully sequenced "the reset must come LAST, because it would destroy the
> surface step 2 needs", against a remote where the reset had *already happened and the surface was
> already gone*. The ruling was moot the moment it was written, and nothing in the repo could have said
> so — this is [[a-records-claim-about-an-external-system-goes-stale-silently]] claiming a **ruling**
> rather than a status line. *The census-first ordering I then followed was right, but for the wrong
> reason.*
>
> A bare reset is still precisely the unmanifested, uncounted, unaudited byte destruction
> `FUP-DM5-STACK-CYCLE-DESTROYS-BYTES` flags as ungoverned — the event ADR 0120 **D9** exists to prevent,
> arriving through the accidental door. That judgement stands; only its tense changes, from *would* to
> *did*.
>
> ### ✅ PO RULING 2026-08-18 — **STAYS OPEN, BLOCKED ON the `FUP-DM5-CLOUD-ORPHAN-SURFACE` C1b probe**
> The PO declined both closure options (close-as-destroyed, and close-as-resolved). **This item remains
> OPEN until the constructed-orphan probe settles whether the ~49 objects' bytes survive.** It therefore
> now tracks **two** questions deliberately — the erased subject *and* the likely-orphaned bytes — kept
> together rather than split.
>
> ⛔ **Carry this forward to whenever it does close:** the *"destroyed, not reconciled"* finding below is
> **not** something the probe can change. The probe answers the byte question only. Whatever the probe
> returns, this item may **not** close as *"reconciled"* — no per-row re-freeze-or-tombstone decision was
> ever made and no manifest exists, and that stays true forever. ⭐ *Recorded here because a blocked item
> closes on the blocker's verdict, and the half that the blocker does not address is exactly the half that
> gets discharged by association* — the same defect the promotion ruling above was written to prevent.
>
> ### ⛔ THEREFORE THIS ITEM DOES NOT CLOSE AS "RECONCILED"
> The standing instruction on this item is **"reconcile or quarantine explicitly, never invent success."**
> An empty table satisfies the *letter* of "no dangling rows remain" while satisfying **none** of what was
> asked: no per-row re-freeze-or-tombstone decision, no manifest, no record of what was destroyed.
> ⭐ *The absence of the subject is not the discharge of the obligation* — closing this green would be
> exactly the shape of [[absence-of-a-verdict-is-not-absence-of-coverage]].
> **Correct disposition: close as `SUBJECT DESTROYED WITHOUT A MANIFEST`** — a different closure, with a
> different record, and one that leaves the governance defect visible. **PO ruling required.**
>
> ### 🔴 A NEW finding this census produced: 49 objects vanished without a DELETE
> `storage.objects` = **96 inserted / 47 deleted / 0 live**. 47 were deleted properly (consistent with the
> S4 bucket retirement, whose own `storage.buckets` figures reconcile *exactly*: 16−12=4). The other
> **49 left no delete record** — they went with the reset's schema rebuild. ⚠ **A reset rebuilds
> `storage.objects`; it does not necessarily delete the objects from the backing store, and whether it
> orphans them is CLI-VERSION DEPENDENT** → [[remote-reset-storage-orphan-is-cli-version-dependent]].
> So these are **likely-orphaned bytes, not confirmed-destroyed ones**, and the metadata
> that would say *what to look for* is gone too — so this is now **permanently unmeasurable from SQL**.
> Feeds `FUP-DM5-STORAGE-ORPHANS` (Cloud half) and is a second live instance of
> `FUP-DM5-NO-ANSWER-VS-NOTHING`: **`objects = 0` proves the METADATA is gone, never the BYTES.**
>
> ### What this does NOT establish — before anyone reads the above as a conclusion
> **Not when, and not by whom.** `pg_stat` carries no timestamps, and its counters are not durable
> evidence (a stats reset clears them; a `DROP`+`CREATE` gives a new relid and fresh counters). The
> reading above is *consistent with* the numbers; it is not proof, and it is recorded as such.
>
> ### Step 2 is NOT blocked by this
> `FUP-DM5-CLOUD-ORPHAN-SURFACE`'s probe **constructs** its own orphan, so an empty remote is a clean
> substrate for it — arguably better. What is lost is the chance to measure the *pre-existing* orphans,
> and that loss is permanent. The probe still answers its real question (*can any customer-accessible
> tool SEE an orphan on Cloud*) and still needs S3 keys minted by a human.

> ## ⭕ ITS TRIGGER FIRED 2026-08-18 — this is DUE, not deferred
>
> The body below sets the closure precondition as *"the DM stack pushed, `db push` run, a fresh census."*
> **The push ran on 2026-08-18.** So its own ⛔ *"do not query or mutate the linked project"* bar — which
> was scoped to the no-push directive — **lifted at the same moment**. Read-only census is now sanctioned.
>
> ## ✅ SEQUENCED 2026-08-18 (DM-FUP TRIAGE #6) — census → probe → then decide. **The remote is NOT reset first.**
>
> 1. **Read-only remote census.** The 2026-08-11 figures below are *stale by design*; migration
>    `20260927000400` has since retired 8 buckets, so the dangling rows may already be gone.
> 2. **`FUP-DM5-CLOUD-ORPHAN-SURFACE`'s constructed-orphan probe**, which needs a live writable remote.
> 3. **Then** reconcile-vs-reset, per row, with a manifest, recorded.
>
> ⭐ **The finding: the PO-sanctioned "much cheaper closure path" collides with an open item.** The
> amendment below offers a **remote reset** as the cheap way out. A bare `db:reset:linked` is precisely
> the unmanifested, uncounted, unaudited byte destruction that `FUP-DM5-STACK-CYCLE-DESTROYS-BYTES`
> flags as ungoverned — the event ADR 0120 **D9** exists to prevent, arriving through the accidental door
> instead of the deliberate one. **And it would destroy the surface step 2 needs in order to measure.**
> Both reasons are independently sufficient to sequence the reset last.

Filed 2026-08-14 at DM4 open, as the recorded half of **PO ruling R2**.

The parent plan's DM4 step 2 requires that "the 1 dangling frozen production row is reconciled
(re-freeze or explicit tombstone)". **DM4 does not do this.** At phase open, `main` sat **136
commits ahead of `origin/main`** with nothing pushed and no `db push` — reconciling production
then would move the DB ahead of the code that understands it, while the standing PO directive
still forbids pushes.

**What DM4 DOES owe:** build and prove the reconciliation path **locally**, so that the
production step is an execution, not a design exercise.

**What is deferred here**, from the 2026-08-11 production census (⚠ **stale by design — re-census
before acting, never act on these figures**): 45 objects / ~0.5 MB · `attachments*` EMPTY ·
**4 dangling attachment rows** · **3 controlled-doc objects unreferenced** · **1 dangling frozen
referral path**. Note DM3's own scope carried a related discrepancy — prod had **3 objects but 0
version rows** — with the standing instruction to *reconcile or quarantine explicitly, never
invent success*. The same instruction binds here.

⛔ **Do not query or mutate the linked project to close this while the no-push directive stands.**
Closing it requires: the DM stack pushed, `db push` run, a fresh census, then an explicit
re-freeze-or-tombstone decision per row, recorded.

**⚠ AMENDED 2026-08-14 — a second, much cheaper closure path exists.** The PO confirms **a full
database reset is available on the REMOTE as well as locally (no active users)** — the standing
pre-launch posture ([[prelaunch-db-reset-ok]]: design the correct schema rather than back-compat
migrations). A remote reset removes the dangling row outright, so the per-row
re-freeze-or-tombstone decision above **may never need to be made**. Both paths stay open; the
choice belongs to the deploy step, not to DM4.

⚠ **Do NOT let this delete DM4's guards.** M3's dead-pointer null and M4's raising `DROP TABLE`
guard are correct **independent of the deploy strategy** — M3's is *semantics, not repair* (the
sibling FK is `ON DELETE SET NULL`), and M4's value was never "prod probably has rows" but "if
rows exist, an unmodeled writer exists." A reset makes them near-unreachable, which costs nothing.
A guard removed because one deploy strategy makes it moot is a guard missing when that strategy
changes.

🔶 **OPEN, and it is DM5's problem rather than DM4's — flagged early because it is cheap to know
now:** a DB reset wipes `storage.objects` **metadata**, but it is **not established** that it
removes the underlying **bytes**. If it does not, a remote reset leaves orphaned objects with no
metadata rows — which would quietly undermine **DM5's retirement manifest**, whose method is
"prove zero DB references + zero product callers + zero policies, then empty and delete the bucket
**via the Storage API only, never `storage.objects` DML**". *An emptiness proof derived from a
table that was just truncated is not an emptiness proof.* Verify before DM5 relies on it.
