# FUP-DM5-DISPOSAL-JOB — nothing completes a disposal: `disposal_pending` has three inflow doors and **zero automated outflow** — ⭐ **Critical FUP C1** (owner: PO; the decision is discharged, the REHEARSAL is not)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-17 · status open

> ## ⭕ SPLIT 2026-08-18 (DM-FUP TRIAGE #3) — **C1a (local) + C1b (Cloud); C1 does NOT close on C1a**
>
> ADR 0121 Amendment 3 required the runbook be executed *"end-to-end, once, against test data"* — and
> **named no surface**. That underspecification would have discharged it with a local run. It does not:
>
> - **C1a — local.** Run it against the local stack, once, recorded. Debugs the procedure and yields the
>   first **backup destination path** owed to `FUP-DM5-BACKUP-IS-PHI-EXPORT`.
> - **C1b — Cloud.** The same run against the linked project. ⛔ **The pilot-risk acceptance is bounded
>   by C1b.** A green C1a does not release the pilot.
>
> ⭐ **Why:** the runbook itself says at §6 that a local rehearsal *"runs against a local stack by
> construction, so it cannot exercise the Cloud paths above"* — and the pilot runs on Cloud. A local-only
> rehearsal therefore discharges the amendment's **wording** while leaving its **purpose** undischarged.
> → [[a-predicate-quoted-at-the-wrong-grain]], in the highest-severity item in the register.
>
> ⚠ **Heading title is stale in one figure:** it says *"three inflow doors"*. Measured, the queue has
> **four SET-form writers** — 3 `authenticated`-reachable plus `complete_document_reclassification`
> (service-role-only). Left in place because the Critical FUP entry carries the correction; noted here so
> the two do not disagree silently a second time.

> ### ✅ PO RULING 2026-08-18 — **PILOT RISK ACCEPTED, BOUNDED BY ONE REHEARSAL.** Recorded as **Critical FUP C1**.
>
> The pilot **may proceed** over the manual-only PHI-disposal path, **on one binding condition**:
>
> ⛔ **[`phi-disposal-runbook.md`](../deployment/phi-disposal-runbook.md) must be executed end-to-end,
> once, against test data, BEFORE any real patient record is loaded.** The acceptance is **not**
> open-ended and does **not** survive the pilot admitting real PHI ahead of the rehearsal.
>
> ⭐ **The condition is the substance of the ruling, not a caveat on it.** The gap was never a missing
> mitigation — the runbook exists, and its owner, cadence and five backup values were all PO-set on
> 2026-08-17. The gap is that **the mitigation has never been observed to work.** This item's own body
> already says it below, in its own words: *"real on paper; real in practice only when the monthly run
> actually happens."* ⚠ A procedure that has only ever been **read** is a claim about a procedure —
> the same defect ADR 0121 **D4** exists to stop, one layer out.
>
> ⚠ **`disposal_state` therefore means INTENT, not a destruction guarantee — and that reading is now
> RATIFIED, not merely observed.** Nothing user-facing, regulator-facing or export-facing may describe
> it as destruction. ⭐ This **inverts ADR 0099 D10** (*"a stale row nobody looks at harms nobody"*):
> under LGPD, retention past purpose is itself the violation, so for PHI **the stale row IS the harm.**
>
> ⚠ **D2 is NOT ratified by this** — `pg_cron` stays uninstalled and the cron schema still does not
> exist. ADR 0121's D2 design remains ratified-but-unbuilt, kept as what gets built if the manual path
> proves insufficient. **`343_dm5_s5_disposal_gap.sql`'s K6b still asserts "no scheduler exists at
> all"** — true today, a **false pin** the day D2 lands; rewrite `343` in D2's slice, never after.
>
> ⭐ **The rehearsal also discharges a second obligation:** it produces the first **destination path**
> for `FUP-DM5-BACKUP-IS-PHI-EXPORT`, which that item owes *at first execution*. Do not run the
> rehearsal without capturing it.
>
> ⛔ **This ruling does NOT close the item.** The PO decision is discharged; the rehearsal is the
> deliverable, and C1 leaves the Critical list only when the run has **happened and been recorded**.

Filed 2026-08-17 (backend, S5.D), recording the **PO's deliberate deferral** rather than an
undiscovered defect: at S5.D authorization the PO ruled *document the gap, do NOT build the job* — no
`pg_cron`, no scheduled sweep, no second execution context with service-role reach. This item is where
that deferral lives so S6/QA cannot close over it silently.

**Measured, live catalog:** `request_document_disposition`, `dispose_case_phi` and
`dispose_referral_phi` all write `disposal_state = 'disposal_pending'`. `complete_document_disposal`
is the only door that can write `disposed`, its EXECUTE is granted to `postgres`/`service_role` only
(never `authenticated` — it was **built** expecting an operational caller), and it has **exactly one
caller in the repository**: `src/lib/documents/actions.ts:377`, inside `reclassifyDocument` — an
unrelated copy-then-retire lane. Nothing on the disposition path reaches it. `pg_cron` is not
installed, the `cron` schema does not exist, there is no `.github/workflows/`, and the Dockerfile runs
a single process with no scheduler.

**Mitigation shipped instead of a job:** `docs/deployment/phi-disposal-runbook.md` (manual procedure +
reconciliation). ✅ **Owner and periodicity SET by the PO 2026-08-17**: accountable owner = **the PO
(repo owner)** — deliberately not a DPO role, since naming a role that may not be staffed pre-pilot is
the same as naming no owner — executor = **whoever holds service-role reach** (ACL-forced, not a
choice), periodicity = **monthly, plus out-of-band on any data-subject request**. ⚠ The mitigation is
now real *on paper*; it becomes real *in practice* only when the monthly run actually happens, and the
sequence is still **UNREHEARSED**. The gap is pinned executably on both
sides so it cannot rot: `supabase/tests/343_dm5_s5_disposal_gap.sql` (catalog) and
`src/lib/documents/disposal-gap.test.ts` (TS, where the job would most plausibly be built and where
pgTAP is blind). Both were observed RED against real mutations before being trusted green.

⭐ **Composition with FUP-DM5-D11-SUPERSEDED-NEVER-RETIRES, which is the other half of the same
lifecycle and must not be resolved in isolation.** D11's gap is that nothing ever *marks* superseded
bytes for disposal (no inflow); this gap is that nothing ever *completes* a marking (no outflow).
**Fixing D11 alone would make things look better and destroy nothing** — it would convert silent
retention into a growing pile of `disposal_pending` rows that no code path can clear, while the D11
claim reads as honoured. Whichever is scheduled first, the other must be named in the same decision.

⚠ Also note the reconciler interaction: `scripts/document-reconciliation.mjs` classifies
`disposal_pending` as permanently `indeterminate` — *never* drift — on the stated assumption that "the
completion door is its owner". That assumption was false until the runbook existed, and it is only as
true as the runbook is actually executed.


**From the Critical pin, 2026-09-03 (compacted at ADR 0186 D4, plan 5.6):**

- **Item (was):** 🔒 **`FUP-DM5-DISPOSAL-JOB`** — the PHI-disposal path is **manual and UNREHEARSED**. `disposal_state` records an **intent, not a destruction guarantee**: **4 SET-form writers** put rows into `disposal_pending` — 3 `authenticated`-reachable (`request_document_disposition`, `dispose_case_phi`, `dispose_referral_phi`) **plus `complete_document_reclassification`, service-role-only** — against **exactly ONE** outflow door, and **nothing automated calls it** (no `pg_cron`, no cron schema, single-process Dockerfile). ⚠ *Corrected 2026-08-18: this said "three inflow doors", which is right only bounded to JWT-reachable doors — **the queue is fed wider than the item said**.*
- **What must happen (was):** ⭕ **SPLIT IN TWO 2026-08-18 (DM-FUP TRIAGE #3) — and C1 does NOT close on C1a.** **C1a (local)** — execute [`phi-disposal-runbook.md`](../deployment/phi-disposal-runbook.md) end-to-end against local test data, once, and record the run. ⭕ **PARTIAL 2026-08-19: the § 6b BACKUP half is DONE** — executed, verified, destroyed, recorded in [`phi-backup-run-log.md`](../deployment/phi-backup-run-log.md), which discharged `FUP-DM5-BACKUP-IS-PHI-EXPORT`'s destination path. ⛔ **The § 3 DISPOSAL half — which is what C1a is FOR — has still not run.** ⭐ **CORRECTED 2026-08-19:** it was recorded as blocked by `FUP-DISPOSAL-CHILD-LOCK-BLOCKS-PHI-ERASURE`; **it never was** — the runbook is the `file_objects`/Storage path and `dispose_meeting_minutes` is disjoint from it in the catalog (writes no `file_objects` row, never sets `disposal_pending`; the runbook says "meeting" zero times). That FUP is resolved anyway (ADR 0129), but § 3 is un-run for its own reasons, not newly released. The two halves are independently executable; do not read the backup run as C1a. **C1b (Cloud)** — the same run against the linked project; ⚠ it **cannot inherit** the backup half, which has no Cloud form at all (`FUP-DM5-BACKUP-HAS-NO-CLOUD-FORM`). ⛔ **Why the split is not bookkeeping:** the runbook itself says a local rehearsal *"runs against a local stack by construction, so it cannot exercise the Cloud paths"* (§6) — so a local-only run discharges this row's **wording** while leaving its **purpose** undischarged, which is [[a-predicate-quoted-at-the-wrong-grain]] in the highest-severity item in the register.
- **Trigger — the point it can no longer wait (was):** ⛔ **BEFORE ANY REAL PATIENT RECORD IS LOADED.** PO-accepted 2026-08-18 as a pilot risk **bounded by this rehearsal** (ADR 0121 **Amdt 3**) — the acceptance is not open-ended, and the pilot may not admit real PHI ahead of it. ⭐ **The bound is C1b, not C1a**: the pilot runs on Cloud, so a green local rehearsal does **not** release it.
- **Owner (pin's own column):** PO (executor = whoever holds service-role reach — an ACL fact, not a choice)
