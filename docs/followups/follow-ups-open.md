# Follow-ups — the OPEN register

**This file is the single register of open follow-ups.** One item = **one entry**, holding its
severity, id, title, owner, origin and full body **together**. There is no separate index to keep
in sync: that split lived in `PROGRESS.md` from 2026-08-08 until **2026-09-02**, and eliminating it
is what this file is for (ADR [0179](../decisions/0179-follow-up-register-consolidation.md)).

> ⛔ **New follow-ups are filed HERE, never in PROGRESS.md.** PROGRESS.md holds no follow-up
> material at all since ADR 0185 D5 — the PO-curated **⭐⭐ Critical** table moved here too, pinned
> at the top so the register's length cannot bury it. It is *additive*: a Critical row adds a
> trigger and a deadline to an item that also keeps its full entry below, and the gate reds on a
> Critical id with no entry.

---

## ⭐⭐ Critical — the must-not-be-forgotten list

_**PO-curated. Entries land here ONLY on the PO's explicit instruction.** No implementer, reviewer or
lead may promote an item into this section, and nothing arrives here as a side effect of a review
round. It is the short list of follow-ups whose loss would be materially costly, **pinned at the top
of the register precisely so that the register's length cannot bury them**._ The pre-pilot
rulings behind these rows — the two 🔴 pilot-gate checks CLAUDE.md §5 once pointed at — are in
[dm5-po-decisions.md](../progress/dm5-po-decisions.md) § Remaining pre-pilot work.

⛔ **NEVER ROTATE THIS SECTION.** It lived in PROGRESS.md as that file's only protected section (ADR
[0179](../decisions/0179-follow-up-register-consolidation.md)) until ADR
[0185](../decisions/0185-documentation-restructure-feature-hubs-and-gated-registers.md) D5 moved it
here, table verbatim, links repointed. ⚠ An entry leaves only when the work has **landed**, which is
not the same as the phase it was filed in closing — *a deliverable assigned to a slice disappears when
that slice closes cleanly* (ADR 0120's own O1/O2 correction, and the reason this section exists).
⚠ **These rows are ADDITIVE, not the item's record**: each adds a trigger and a deadline to an item
that keeps its full entry below in this file. A row here whose entry is missing is an orphan, and
`lint:registers` reds on it.

| # | item | what must happen | trigger — the point it can no longer wait | owner |
|---|---|---|---|---|
| **C1** | 🔒 **`FUP-DM5-DISPOSAL-JOB`** | Run C1a (local) + C1b (Cloud) rehearsals of the disposal runbook; C1b is the release condition. | Before any real patient record is loaded. | PO (executor = whoever holds service-role reach — an ACL fact, not a choice) |
| **C2** | 🟠 **`FUP-AUTHZ-COMMAND-DOOR-UNSWEPT`** | Sweep Tier 1 (PHI / tenant-boundary command doors) by property; Tier 2 deferred. | PO ruling owed (§8); Tier 2 after the pilot ships. | lead + backend |
| **C3** | 🔴 **`FUP-DM5-BACKUP-HAS-NO-CLOUD-FORM`** | PO decision: accept no Storage recovery point pre-pilot, or name + rehearse a mechanism. | Before any real patient record is loaded. | PO decision, then backend + lead |
| **C4** | 🟠 **`FUP-DM5-DB-DUMP-AND-SCRATCH-DB-UNGOVERNED`** | PO extends the five retention values to the DB-dump + scratch-DB artifacts, or rules the restore test out. | The first `supabase db dump --linked` run. | PO decision, then backend |

⚠ The C1–C4 emoji (🔒 🟠 🔴) predate the D4 scale and are the rows' own markers; each item's `**Severity:**` word lives in its entry below, and that is the rated one.

---

## How to append a follow-up

**Append a new `### ` entry at the END of this file.** Headings are never edited once filed —
citations and anchors key on them.

```markdown
### <severity> FUP-<SCREAMING-KEBAB-ID> — <the claim, in one line>

**Filed:** <YYYY-MM-DD> (<origin>) · **Owner:** <role(s)> · **Severity:** <word> — <why>
**Closes when:** <condition — "PO to rule" if the body states none, never invented>
**Status:** open

<Body: ≤ 10 lines inline, else `docs/followups/<FUP-ID>.md` (the `docs/bugs/` per-item pattern),
and this entry keeps only a `**Body:**` line naming that file.>
```

A **parked** entry adds `**Revisit when:** <trigger>` after `**Status:** parked` — same file, no
separate backlog. Entry ≤ 20 lines; heading ≤ 160 chars; no `##`/`####` inside an entry.

**Fields:** `<severity>` = the shared five-level scale (ADR 0185 D4, matches `docs/bugs/BUGS.md`):
⛔ `catastrophic` · 🔴 `critical` · 🟠 `high` · 🟡 `medium` · 🟢 `low` · `unrated`+⚪ if never
assessed. `FUP-<ID>` = `SCREAMING-KEBAB`, permanent, unique across this file + the archive, a
registered code (a hub id or a [legacy-codes.md](legacy-codes.md) row; `FUP-BACKLOG-*` = assigned
at the 2026-09-03 backlog merge). `**Filed:**` = date + **the origin in parentheses** (phase /
increment / review / gate run — never a bare date or ADR number; cite the ADR in the body).
`**Owner:**` = closed vocabulary `lead`·`backend`·`frontend`·`tester`·`qa`·`PO`·`unassigned`,
joined `role + role` in that order. `**Closes when:**` = the discharge condition, `PO to rule` if
none stated. `**Status:**` = `open`|`parked` (`parked` needs `**Revisit when:**`). Body: how it
was MEASURED, what closes it, and ⛔ what must NOT be mistaken for closing it.

The gate (`lint:registers`) reds on a missing field, an entry over the cap, or a body file linked
by more than one entry. Entry headings **are** the index: `grep -n '^### ' follow-ups-open.md`.

---

## When an item changes state

- **Still open, facts changed** → edit the entry **in place**.
- **Parked** → `**Status:** parked` + `**Revisit when:**`, in place. **Reopened** → drop
  `**Revisit when:**`, `**Status:** open`.
- **Resolved** → move the whole entry — and its body file, if it has one — **verbatim** to
  [follow-ups-archive.md](follow-ups-archive.md); `cmp`-verify before deleting the source.
- **A standing prohibition with no resolution event** ("never fix X by granting Y") → not a
  follow-up; it belongs in `.claude/rules/`, path-scoped, under ADR 0127's admission filter.

⛔ **Never compress an open entry to save bytes.** This register's measured failure mode is
**prose rot, not stale subjects**: compression under pressure cuts qualifiers first, and the
qualifier is the half that carries the bound.

## The other registers

| Register | Holds | File |
| --- | --- | --- |
| **This file** | every OPEN and PARKED follow-up, entry + body | `follow-ups-open.md` |
| Archive | resolved follow-ups, verbatim | [follow-ups-archive.md](follow-ups-archive.md) |
| Critical list | PO-curated must-not-be-forgotten list, with triggers | pinned at the top of this file (⭐⭐ Critical) |

⛔ **There is no separate parked-backlog file.** `deferred-backlog.md` merged into this register as
`**Status:** parked` entries and was deleted 2026-09-03 (ADR 0186 D4); its 29 id-less items were
assigned `FUP-BACKLOG-<slug>` ids (legend row: [legacy-codes.md](legacy-codes.md)).

---

### 🟢 FUP-PROGRESS-INDEX-LINES-HAVE-OUTGROWN-THE-CONTRACT — the de-duplication pass ran; 23 PARTIAL lines remain (owner: lead)

**Filed:** 2026-08-29 (at the Record step, from a size warning that could not be discharged by rotating concluded material — because nothing concluded was left) · **Owner:** lead · **Severity:** low — per emoji at consolidation
**Closes when:** a dedicated pass (not a Record-step side effect), item by item, cutting from the index ONLY what the body demonstrably carries. ⚠ A line whose detail exists NOWHERE else is not a candidate — it is a body that was never written, and the fix there is to write the body.
**Status:** open
**Body:** [FUP-PROGRESS-INDEX-LINES-HAVE-OUTGROWN-THE-CONTRACT.md](FUP-PROGRESS-INDEX-LINES-HAVE-OUTGROWN-THE-CONTRACT.md)

### 🟡 FUP-AE2-PERSON-PREAMBLE-THREE-COPIES — the person-authorization preamble exists in three independent TS copies, and that duplication is the mechanism behind this phase's recurring sibling-axis misses (owner: backend)

**Filed:** 2026-08-28 (at AE2.4 increment 3, on the lead's ruling that assigned the third and second copies to that increment) · **Owner:** backend · **Severity:** medium — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-AE2-PERSON-PREAMBLE-THREE-COPIES.md](FUP-AE2-PERSON-PREAMBLE-THREE-COPIES.md)

### 🟠 FUP-AE1-REVOKE-SET-EXECUTION — 233 classified revokes are HELD, partitioned, and 137 of them are a silent no-op as written (owner: backend/PO)

**Filed:** 2026-08-27 (at AE1's RV0 completion) · **Owner:** backend + PO · **Severity:** high — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-AE1-REVOKE-SET-EXECUTION.md](FUP-AE1-REVOKE-SET-EXECUTION.md)

### 🟡 FUP-DEFINER-EXISTENCE-BEFORE-AUTHORITY — 31 Tier-1 DEFINER doors confirm an object exists before checking authority (owner: backend/PO)

**Filed:** 2026-08-27 (by AE1 close condition #3, the [tier-1 threat review](../design/authz-ae1-tier1-threat-review.md) §4.2 (finding F-T1-2)) · **Owner:** backend + PO · **Severity:** medium — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-DEFINER-EXISTENCE-BEFORE-AUTHORITY.md](FUP-DEFINER-EXISTENCE-BEFORE-AUTHORITY.md)

### 🟠 FUP-CHILD-ENTITY-MUTATIONS-UNAUDITED — ~25 child/vocabulary tables emit no audit row on any mutation (owner: backend/PO)

**Filed:** 2026-08-27 (by AE1 close condition #3, the [tier-1 threat review](../design/authz-ae1-tier1-threat-review.md) §4.3 (finding F-T1-3)) · **Owner:** backend + PO · **Severity:** high — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-CHILD-ENTITY-MUTATIONS-UNAUDITED.md](FUP-CHILD-ENTITY-MUTATIONS-UNAUDITED.md)

### 🟡 FUP-DOC-RECLASS-OPERATION-ID — bind reclassification completion to a DB-minted, single-use operation id (owner: backend)

**Filed:** 2026-09-02 (ad-hoc: PROGRESS.md consolidation 2026-09-02) · **Owner:** backend · **Severity:** medium — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-DOC-RECLASS-OPERATION-ID.md](FUP-DOC-RECLASS-OPERATION-ID.md)

### 🟡 FUP-DOC-DISPOSAL-PROVENANCE-SPLIT — split `complete_document_disposal` by provenance (owner: backend/PO)

**Filed:** 2026-09-02 (ad-hoc: PROGRESS.md consolidation 2026-09-02) · **Owner:** backend + PO · **Severity:** medium — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-DOC-DISPOSAL-PROVENANCE-SPLIT.md](FUP-DOC-DISPOSAL-PROVENANCE-SPLIT.md)

### ⛔ FUP-DM5-BACKUP-HAS-NO-CLOUD-FORM — the § 6b procedure is **local-only by construction**, and on Cloud there is **no Storage backup at all** (owner: PO decision, then backend + lead; **Rule 12 / LGPD / ANVISA-RDC**)

**Filed:** 2026-08-19 (from the § 6b first execution (finding F5; [run log](../deployment/phi-backup-run-log.md))) · **Owner:** lead + backend + PO · **Severity:** catastrophic — CATASTROPHIC per D4: "the pilot platform has NO Storage recovery point at all" is a data-loss exposure, not merely a missing safeguard
**Closes when:** (this is a risk acceptance, not an engineering call): either (a) accept that Storage has no recovery point pre-pilot and say so where a pilot decision is made, or (b) name a Cloud mechanism — S3-protocol client against the Storage endpoint piped into an encryptor is the only shape that could satisfy "encrypted at creation" — and then it must be rehearsed like any other. ⚠ Note (b) overlaps `FUP-DM5-CLOUD-ORPHAN-SURFACE`: the S3 endpoint is UNPROBED, and a backup taken through…
**Status:** open
**Body:** [FUP-DM5-BACKUP-HAS-NO-CLOUD-FORM.md](FUP-DM5-BACKUP-HAS-NO-CLOUD-FORM.md)

### 🟠 FUP-DM5-DB-DUMP-AND-SCRATCH-DB-UNGOVERNED — the runbook's own DB-half verification creates **two plaintext PHI copies with no handling rule** (owner: PO decision, then backend)

**Filed:** 2026-08-19 (from the § 6b first execution (finding F6)) · **Owner:** backend + PO · **Severity:** high — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-DM5-DB-DUMP-AND-SCRATCH-DB-UNGOVERNED.md](FUP-DM5-DB-DUMP-AND-SCRATCH-DB-UNGOVERNED.md)

### 🟠 FUP-DM5-DISPOSAL-JOB — nothing completes a disposal: `disposal_pending` has three inflow doors and **zero automated outflow** — ⭐ **Critical FUP C1** (owner: PO; the decision is discharged, the REHEARSAL is not)

**Filed:** 2026-08-17 (backend, S5.D) · **Owner:** PO · **Severity:** high — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-DM5-DISPOSAL-JOB.md](FUP-DM5-DISPOSAL-JOB.md)

### 🟠 FUP-DM5-Q1-OPEN-BYTES-CUT-BROKEN — ⚠ **HALF RESOLVED 2026-08-17: the guard no longer fails open; the arm is still a no-op awaiting a NAMED successor** (owner: backend)

**Filed:** 2026-08-17 (lead) · **Owner:** backend · **Severity:** high — re-rated from 🔵 per D4: the arm is absorbed into Critical FUP C2 Tier 1, a standing door-audit gate a phase gate depends on, though it is not itself a wrong authorization answer
**Closes when:** re-point the arm at a live policy (or retire it with a named successor), and make the guard NULL-safe (`coalesce(v_qual,'') !~ …`). Then prove it can announce a no-op — a guard nobody has seen fire is not a guard.
**Status:** open
**Body:** [FUP-DM5-Q1-OPEN-BYTES-CUT-BROKEN.md](FUP-DM5-Q1-OPEN-BYTES-CUT-BROKEN.md)

### 🟠 FUP-DM5-D9-NO-ARM-SEES-A-BYTE-POST-RETIREMENT — after `…000400` applies, the retirement tool has no Cloud-visible arm left (owner: backend; **input to S5/S6 + the deploy runbook**)

**Filed:** 2026-08-17 (lead) · **Owner:** backend · **Severity:** high — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-DM5-D9-NO-ARM-SEES-A-BYTE-POST-RETIREMENT.md](FUP-DM5-D9-NO-ARM-SEES-A-BYTE-POST-RETIREMENT.md)

### 🟠 FUP-DM5-STACK-CYCLE-DESTROYS-BYTES — a `supabase stop`/`start` recovery destroyed 221 storage objects (15 PHI-tier) with **no manifest, no count comparison, no audit** (owner: lead + backend)

**Filed:** 2026-08-17 (lead) · **Owner:** lead + backend · **Severity:** high — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-DM5-STACK-CYCLE-DESTROYS-BYTES.md](FUP-DM5-STACK-CYCLE-DESTROYS-BYTES.md)

### 🟠 FUP-DM5-D11-SUPERSEDED-NEVER-RETIRES — D11's "superseded bytes retire via `disposal_state`" is **not performed, and nothing can perform it** (owner: PO decision, then backend)

**Filed:** 2026-08-14 (lead) · **Owner:** backend + PO · **Severity:** high — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-DM5-D11-SUPERSEDED-NEVER-RETIRES.md](FUP-DM5-D11-SUPERSEDED-NEVER-RETIRES.md)

### 🟠 FUP-DM5-SUPERSEDE-SERVING-COLLISION — ✅ **RULED 2026-08-18: the marking trigger moves to RETENTION EXPIRY; the serving gate is untouched.** Implementation gated on Critical FUP C1 (owner: **backend**; the PO half is discharged)

**Filed:** 2026-08-17 (lead) · **Owner:** backend · **Severity:** high — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-DM5-SUPERSEDE-SERVING-COLLISION.md](FUP-DM5-SUPERSEDE-SERVING-COLLISION.md)

### 🟠 FUP-C2-THREE-BLIND-COMMAND-DOOR-GUARDS — 3 BLIND from the first 8 measurements; ⭕ **the full sweep then found 40** (owner: backend)

**Filed:** 2026-08-31 (from the subset that PROVED [`c2-command-door-neutralizer.sh`](../../supabase/tests/mutation/c2-command-door-neutralizer.sh) · **Owner:** backend · **Severity:** high — high — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-C2-THREE-BLIND-COMMAND-DOOR-GUARDS.md](FUP-C2-THREE-BLIND-COMMAND-DOOR-GUARDS.md)

### 🟠 FUP-AUTHZ-COMMAND-DOOR-UNSWEPT — ⭕ **RE-SCOPED 2026-08-17 (pre-S6): the filed premise was FALSE, the population is 407 not one (⭕ **re-derived 426 at the AE1 Record step 2026-08-27, then **427** (345 `public` + 82 `app`) on 2026-08-31 — and the figure is now DERIVED by `ARM=census`'s own banner each run, so this chain ends here rather than needing a next link**), and the class was read as COVERED-BUT-UNPINNED — ⛔ FALSIFIED 2026-08-31, see the amendment below** — ⭐ **Critical FUP C2** (owner: lead + backend)

**Filed:** 2026-08-17 (lead) · **Owner:** lead + backend · **Severity:** high — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-AUTHZ-COMMAND-DOOR-UNSWEPT.md](FUP-AUTHZ-COMMAND-DOOR-UNSWEPT.md)

### 🟡 FUP-ACL-APP-POPULATION — ⭕ **RE-SCOPED 2026-08-17: the assertion is BUILT; the 237-function triage is what remains** (owner: backend + PO)

**Filed:** 2026-08-14 (lead) · **Owner:** backend + PO · **Severity:** medium — per emoji at consolidation
**Closes when:** generalize `320`'s uniformity assertion from the 8 names to all `app` functions, keeping its existing `p.proacl is null or exists(… grantee = 0)` shape (⚠ that `is null` arm is load-bearing — `aclexplode(NULL)` returns no rows, so dropping it makes the check blind to exactly the default-ACL case it exists for). Give it a control in t19c's style, and expect the first run to be RED with a list — `app` almost certainly holds legitimate PUBLIC-executable helpers, and the real wor…
**Status:** parked
**Revisit when:** PO to rule
**Body:** [FUP-ACL-APP-POPULATION.md](FUP-ACL-APP-POPULATION.md)

### 🟠 FUP-DM5-SIBLING-GUARD-DIFF — **no authz arm can see a door that OMITS a check its sibling doors all make** (owner: lead + backend; a gate-coverage gap, not a defect)

**Filed:** 2026-08-14 (lead) · **Owner:** lead + backend · **Severity:** high — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-DM5-SIBLING-GUARD-DIFF.md](FUP-DM5-SIBLING-GUARD-DIFF.md)

### 🟡 FUP-ROTATION-BREAKS-LINKS — **every §6-step-5 rotation silently 404s its own links; 474 are broken today** (owner: lead)

**Filed:** 2026-08-17 (lead) · **Owner:** lead · **Severity:** medium — per emoji at consolidation
**Closes when:** PO to rule
**Status:** parked
**Revisit when:** when it says *"detail lives in the
**Body:** [FUP-ROTATION-BREAKS-LINKS.md](FUP-ROTATION-BREAKS-LINKS.md)

### 🟡 FUP-PGTAP-WORKER-DEADLOCK — `npm run test:db` intermittently deadlocks a `pg_prove` worker (owner: backend)

**Filed:** 2026-08-14 (lead) · **Owner:** backend · **Severity:** medium — per emoji at consolidation
**Closes when:** PO to rule
**Status:** parked
**Revisit when:** PO to rule
**Body:** [FUP-PGTAP-WORKER-DEADLOCK.md](FUP-PGTAP-WORKER-DEADLOCK.md)

### 🔴 FUP-PGTAP-VACUOUS — `lint:vacuous` scans TS spec files ONLY; ~6000+ pgTAP assertions are entirely unscanned, and a live specimen was found (owner: lead + backend; a program-level audit, NOT a phase side quest)

**Filed:** 2026-08-14 (during DM4) · **Owner:** lead + backend · **Severity:** critical — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-PGTAP-VACUOUS.md](FUP-PGTAP-VACUOUS.md)

### 🟠 FUP-DM5-STORAGE-ORPHANS — a **LOCAL** DB reset wipes `storage.objects` but NOT the bytes; ⚠ **the REMOTE half was a stale inference and is now demoted to residual** (owner: lead + backend; blocks DM5 step 3 **locally**)

**Filed:** 2026-08-14 (during DM4 planning) · **Owner:** lead + backend · **Severity:** high — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-DM5-STORAGE-ORPHANS.md](FUP-DM5-STORAGE-ORPHANS.md)

### 🔴 FUP-AUTHZ-HARNESS-TRANSACTIONAL — the door-audit harness neutralizes OUTSIDE a transaction, so process death leaves an authz gate OPEN (owner: lead + backend; filed 2026-08-14, DM5 S2, after it happened)

**Filed:** 2026-08-14 (DM5 S2, after it happened) · **Owner:** lead + backend · **Severity:** critical — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-AUTHZ-HARNESS-TRANSACTIONAL.md](FUP-AUTHZ-HARNESS-TRANSACTIONAL.md)

### 🔴 FUP-DM4-PRODROW — reconcile the dangling frozen PRODUCTION snapshot row at the push/deploy step, not during DM4 (owner: lead + backend)

**Filed:** 2026-08-14 (at DM4 open, as the recorded half of PO ruling R2) · **Owner:** lead + backend · **Severity:** critical — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-DM4-PRODROW.md](FUP-DM4-PRODROW.md)

### 🟡 FUP-PREVIA-MINT-FLAG-ASYMMETRY — `HC0DV` refuses a prévia on the premise that the mint is reachable, and the mint's preconditions are a STRICT SUPERSET (owner: backend; found by `qa` in the r2 re-review of the ADR 0125/0126 build)

**Filed:** 2026-08-18 (lead) · **Owner:** backend · **Severity:** medium — per emoji at consolidation
**Closes when:** PO to rule
**Status:** parked
**Revisit when:** when wave D is off, which is a different and larger behaviour change than
**Body:** [FUP-PREVIA-MINT-FLAG-ASYMMETRY.md](FUP-PREVIA-MINT-FLAG-ASYMMETRY.md)

### 🟡 FUP-E2E-SUBMITTED-POOL-UNSCOPED — the shared submitted-response pool has no `case_phase_id is null` filter, and the one-line fix BREAKS a passing test (owner: tester + backend; **needs `seed.sql` or pool-math work, not a filter**)

**Filed:** 2026-08-18 (lead) · **Owner:** backend + tester · **Severity:** medium — per emoji at consolidation
**Closes when:** PO to rule
**Status:** parked
**Revisit when:** PO to rule
**Body:** [FUP-E2E-SUBMITTED-POOL-UNSCOPED.md](FUP-E2E-SUBMITTED-POOL-UNSCOPED.md)

### 🟠 FUP-SUPERSESSION-BADGE-LANE-BLIND — `resolveSupersessionBadge` mirrors an aggregation rule but drops that rule's OWN lane restriction, so a phase-bound response gets the grain ADR 0126 D8 rejected (owner: frontend + backend; **ADR 0074/0085 axis — NOT the print-currency axis**)

**Filed:** 2026-08-18 (lead) · **Owner:** backend + frontend · **Severity:** high — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-SUPERSESSION-BADGE-LANE-BLIND.md](FUP-SUPERSESSION-BADGE-LANE-BLIND.md)

### 🟡 FUP-LINT-VECTOR-DIMENSION-DRIFT — propose a lint gate over shared SQL↔TS **vector fixtures**: a declared dimension that no vector varies, or a consumer that silently drops one (owner: lead + PO; **a gate change is not a mid-build edit**)

**Filed:** 2026-08-18 (lead) · **Owner:** lead + PO · **Severity:** medium — per emoji at consolidation
**Closes when:** PO to rule
**Status:** parked
**Revisit when:** when a predicate's declared *input dimensions* and
**Body:** [FUP-LINT-VECTOR-DIMENSION-DRIFT.md](FUP-LINT-VECTOR-DIMENSION-DRIFT.md)

### 🟡 FUP-LINT-STALE-SYMBOL-COMMENT — propose a 6th lint gate: a comment naming an identifier that no longer exists (owner: lead + PO; a gate change is not a mid-phase edit)

**Filed:** 2026-08-13 (during DM3) · **Owner:** lead + PO · **Severity:** medium — per emoji at consolidation
**Closes when:** PO to rule
**Status:** parked
**Revisit when:** once its key is stated, and recall is keyed to whatever
**Body:** [FUP-LINT-STALE-SYMBOL-COMMENT.md](FUP-LINT-STALE-SYMBOL-COMMENT.md)

### 🟡 FUP-PGTAP-SAVEPOINT — ⚠ **DOWNGRADED 2026-08-13 (🔴→🟡): the original claim was WRONG. No coverage is being lost** (owner: lead + backend)

**Filed:** 2026-08-19 (earliest dated reference in the entry; no explicit filing date stated) · **Owner:** lead + backend · **Severity:** medium — per emoji at consolidation
**Closes when:** 1. On a fresh reset, capture `planned N / ran M` for `193` and `194`; if `M < N`, those assertions have never contributed to any gate record, and the affected keystones' prior green must be re-read as unproven. 2. Rewrite both to `330`'s pattern — mutate without a savepoint, restore from a captured definition, and keep the file-level `rollback` as the outer restore. 3. Add the missing gate. A `lint:vacuous`-style check for pgTAP: flag any assertion between `savepoint` and `ro…
**Status:** parked
**Revisit when:** when *every* assertion in the file sits inside the
**Body:** [FUP-PGTAP-SAVEPOINT.md](FUP-PGTAP-SAVEPOINT.md)

### 🟡 FUP-DM3-ETHICS-UI — no UI can attach a decision letter to an ethics case; DM3 ships both seams writable via the API only (owner: PO, a feature phase)

**Filed:** 2026-08-13 (at DM3 open, as the recorded half of a PO scope ruling) · **Owner:** PO · **Severity:** medium — per emoji at consolidation
**Closes when:** PO to rule
**Status:** parked
**Revisit when:** PO to rule
**Body:** [FUP-DM3-ETHICS-UI.md](FUP-DM3-ETHICS-UI.md)

### 🟡 FUP-ETH-KBD-1 — the professional lane's `TypeaheadField` mount is keyboard-UNTESTED, so BUG-ETHE4-FOCUS-1's defect is not ruled out there (owner: frontend + tester)

**Filed:** 2026-08-19 (earliest dated reference in the entry; no explicit filing date stated) · **Owner:** frontend + tester · **Severity:** medium — per emoji at consolidation
**Closes when:** PO to rule
**Status:** parked
**Revisit when:** when that bug was rotated to
**Body:** [FUP-ETH-KBD-1.md](FUP-ETH-KBD-1.md)

### 🟡 FUP-ETH-A11Y-1 — the ETH·E4 dialogs: error text is never `aria-describedby`-wired, and the typeahead announces neither loading nor result count (QA m3 + m4; owner: frontend + tester)

**Filed:** 2026-08-19 (earliest dated reference in the entry; no explicit filing date stated) · **Owner:** frontend + tester · **Severity:** medium — per emoji at consolidation
**Closes when:** PO to rule
**Status:** parked
**Revisit when:** PO to rule
**Body:** [FUP-ETH-A11Y-1.md](FUP-ETH-A11Y-1.md)

### 🟡 FUP-E2E-SERVER-DEAD-1 — the prod-standalone server dies under load in ~3 of 17 batches, and `BATCH_TESTS=22` is the known rescue (owner: unassigned)

**Filed:** 2026-08-19 (earliest dated reference in the entry; no explicit filing date stated) · **Owner:** unassigned · **Severity:** medium — per emoji at consolidation
**Closes when:** PO to rule
**Status:** parked
**Revisit when:** once nothing holds the DB.
**Body:** [FUP-E2E-SERVER-DEAD-1.md](FUP-E2E-SERVER-DEAD-1.md)

### 🟡 FUP-ACT-HATLESS-AUDIT — a hatless read's audit row omits the `acting_as` KEY, and absence has three meanings (S4 QA MINOR-6; owner: backend)

**Filed:** 2026-08-19 (earliest dated reference in the entry; no explicit filing date stated) · **Owner:** backend · **Severity:** medium — per emoji at consolidation
**Closes when:** PO to rule
**Status:** parked
**Revisit when:** PO to rule
**Body:** [FUP-ACT-HATLESS-AUDIT.md](FUP-ACT-HATLESS-AUDIT.md)

### 🟡 FUP-MIN-CUTOVER — audio-minutes pre-enable gates (feature merged, flag OFF)

**Filed:** 2026-08-19 (earliest dated reference in the entry; no explicit filing date stated) · **Owner:** lead · **Severity:** medium — pre-enable checklist while the flag stays OFF (▶ marker, not a D4 emoji) — not a live defect, but real work remains before cutover
**Closes when:** PO to rule
**Status:** parked
**Revisit when:** Before the pilot flag flips (runbook §6 checklist is authoritative):
**Body:** [FUP-MIN-CUTOVER.md](FUP-MIN-CUTOVER.md)

### 🟢 FUP-QO-6 — oversight-toggle slow-confirm: **annoyance severity ACCEPTED provisionally (PO ruling 2026-08-07)**; open LOW priority, DB-vs-UI formally unclassified

**Filed:** 2026-08-19 (earliest dated reference in the entry; no explicit filing date stated) · **Owner:** PO · **Severity:** low — per emoji at consolidation
**Closes when:** PO to rule
**Status:** parked
**Revisit when:** once its restore check stopped trusting optimistic client state.
**Body:** [FUP-QO-6.md](FUP-QO-6.md)

### 🟡 FUP-AFF-4 — make the membership-role list a Postgres ENUM (2026-08-06)

**Filed:** 2026-08-06 (see heading) · **Owner:** backend · **Severity:** medium — per emoji at consolidation
**Closes when:** Decide before the role set next changes, not after.
**Status:** parked
**Revisit when:** Decide before the role set next changes, not after.
**Body:** [FUP-AFF-4.md](FUP-AFF-4.md)

### 🟡 FUP-AFF-2 — D7's "documented escape for a foreign professional" is unreachable (2026-08-06)

**Filed:** 2026-08-06 (see heading) · **Owner:** backend · **Severity:** medium — per emoji at consolidation
**Closes when:** Decide before the pilot onboards clinical staff,
**Status:** parked
**Revisit when:** before the pilot onboards clinical staff,
**Body:** [FUP-AFF-2.md](FUP-AFF-2.md)

### 🟡 FUP-SILENT-READ-1 — ~207 PostgREST reads never destructure `error` (2026-08-11, lead)

**Filed:** 2026-08-11 (lead) · **Owner:** lead · **Severity:** medium — per emoji at consolidation
**Closes when:** PO to rule
**Status:** parked
**Revisit when:** when `tester`, enumerating the blast radius of the
**Body:** [FUP-SILENT-READ-1.md](FUP-SILENT-READ-1.md)

### 🔴 FUP-AFF-1 — the authz census is BLIND to write-path doors (2026-08-06, lead)

**Filed:** 2026-08-06 (lead) · **Owner:** backend · **Severity:** critical — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-AFF-1.md](FUP-AFF-1.md)

### 🔴 FUP-PCITV-1 — PCI + TV: what QA APPROVED **over**, ranked (2026-08-05)

**Filed:** 2026-08-05 (see heading) · **Owner:** unassigned · **Severity:** critical — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-PCITV-1.md](FUP-PCITV-1.md)

### 🔴 FUP-FF5-1 — patient-lane sublabel is degenerate on the READ path (**PO DEFERRED 2026-07-28**)

**Filed:** 2026-09-02 (ad-hoc: PROGRESS.md consolidation 2026-09-02) · **Owner:** backend · **Severity:** critical — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-FF5-1.md](FUP-FF5-1.md)

### 🟢 FUP-E2E-1 — RE-BASELINE `e2e:prod` (cross-phase, PO-ruled 2026-07-27) — **blocks nothing**

**Filed:** 2026-08-19 (earliest dated reference in the entry; no explicit filing date stated) · **Owner:** PO · **Severity:** low — ▶ marker, not a D4 emoji; its own heading says the PO-ruled re-baseline "blocks nothing"
**Closes when:** PO to rule
**Status:** parked
**Revisit when:** PO to rule
**Body:** [FUP-E2E-1.md](FUP-E2E-1.md)

### 🟢 FUP-FF2-3 — whitespace-only observation, per-instance (DEFERRED by the lead 2026-07-27)

**Filed:** 2026-08-19 (earliest dated reference in the entry; no explicit filing date stated) · **Owner:** PO · **Severity:** low — ▶ marker, not a D4 emoji; its own heading calls it a "whitespace-only observation"
**Closes when:** PO to rule
**Status:** parked
**Revisit when:** PO to rule

After BUG-FF1-007 fixed the `<> ''''` quoting slip, the per-instance filters compare `<> ''` while the
top-level one uses `btrim(...) <> ''` — so a **whitespace-only** observation is filtered at top level
but not per instance.

**Deliberately deferred, on scope discipline rather than merit:** it is a *different* defect from the
one ruled in, it is cosmetic (a blank observation block renders inside a group instance), and it
would have been the third out-of-phase fix of a wave already at its gate. **`tester` independently
confirmed the deferral is safe** — both canonical writers normalise with `nullif(btrim(...), '')`, so
the whitespace case is reachable only for **legacy rows**, the same population BUG-FF1-007 defends.

### 🟢 FUP-FF1-2 — FF-1 QA non-blocking items (review r2: 4 MINOR / 6 INFO) — **7 still open**

**Filed:** 2026-08-19 (earliest dated reference in the entry; no explicit filing date stated) · **Owner:** PO · **Severity:** low — ▶ marker, not a D4 emoji; QA r2 classified these MINOR/INFO and non-blocking
**Closes when:** PO to rule
**Status:** parked
**Revisit when:** PO to rule
**Body:** [FUP-FF1-2.md](FUP-FF1-2.md)

### 🟢 FUP-FF1-1 — coherent fill-path hardening (post-pilot; ADR 0087 ruling 5)

**Filed:** 2026-08-19 (earliest dated reference in the entry; no explicit filing date stated) · **Owner:** PO · **Severity:** low — ▶ marker, not a D4 emoji; post-pilot hardening per ADR 0087 ruling 5, not a current defect
**Closes when:** PO to rule
**Status:** parked
**Revisit when:** PO to rule

- [ ] Revisit **DEFINER + per-mutation audit for the whole fill path** — `answers`,
  `answer_selected_options`, `response_group_instances` **together**, as one change. Today all three
  are direct-DML-under-RLS with no per-row audit (Rule 11 is satisfied for filling at the *response*
  level via `audit_responses_trg`); FF-1 deliberately matched that convention rather than hardening
  one table piecemeal. Decide the target posture for the set, not for a member of it.

### 🟡 FUP-E2E-REPEAT-FLAKY — ⭕ **DOWN TO TWO members 2026-08-17, and the "one root cause" hypothesis is now EVIDENCED, not merely suspected** (owner: lead + tester)

**Filed:** 2026-09-02 (ad-hoc: PROGRESS.md consolidation 2026-09-02) · **Owner:** lead + tester · **Severity:** medium — per emoji at consolidation
**Closes when:** PO to rule
**Status:** parked
**Revisit when:** when it is safe to start*, not the
**Body:** [FUP-E2E-REPEAT-FLAKY.md](FUP-E2E-REPEAT-FLAKY.md)

### 🟠 FUP-AE2-MISSING-FROM-THE-PHASE-LEDGER — a shipped phase absent from the append-only record (owner: lead)

**Filed:** 2026-09-02 (ad-hoc: PROGRESS.md consolidation 2026-09-02) · **Owner:** lead · **Severity:** high — per emoji at consolidation
**Closes when:** (a) write AE2's row, marked reconstructed; and (b) the general question — is AE2 the only one? ⛔ Do not answer that by eye: derive it, by diffing the phases named in `phase-ledger.md` against those with a `docs/progress/<phase>.md` record and a QA verdict. This one was found by accident, which is not a method — lead
**Status:** open
**Body:** [FUP-AE2-MISSING-FROM-THE-PHASE-LEDGER.md](FUP-AE2-MISSING-FROM-THE-PHASE-LEDGER.md)

### 🟡 FUP-EVENT-PATIENT-POLICY-PREEMPTED — a PHI policy that never runs, and would arm silently (owner: backend + lead)

**Filed:** 2026-09-02 (ad-hoc: PROGRESS.md consolidation 2026-09-02) · **Owner:** lead + backend · **Severity:** medium — per emoji at consolidation
**Closes when:** a ruling — (a) drop the policy as dead, making the absent grant the single stated control; (b) keep it and pin the pre-emption executably (assert the grant is absent, so a future `grant` reds *here* with the reason attached); or (c) re-derive the predicate against current requirements and keep it as a live belt beside the braces. ⛔ Do not close this by observing that nothing is currently exposed — that is the premise, not the disposition. ⚠ Also worth deriving the general pro…
**Status:** open
**Body:** [FUP-EVENT-PATIENT-POLICY-PREEMPTED.md](FUP-EVENT-PATIENT-POLICY-PREEMPTED.md)

### 🟡 FUP-E2E-AE3-TWO-NOVEL-FLAKES — two names outside the baseline, ONE observation each, disposition UNDECIDED (owner: lead + tester)

**Filed:** 2026-09-02 (ad-hoc: PROGRESS.md consolidation 2026-09-02) · **Owner:** lead + tester · **Severity:** medium — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-E2E-AE3-TWO-NOVEL-FLAKES.md](FUP-E2E-AE3-TWO-NOVEL-FLAKES.md)

### 🟡 FUP-E2E-PROF-CREATE-ROSTER-FLAKE — `ethics-e4-participants.spec.ts:765` PROF-CREATE roster row, ONE observation, disposition UNDECIDED (owner: lead + tester)

**Filed:** 2026-09-02 (ad-hoc: PROGRESS.md consolidation 2026-09-02) · **Owner:** lead + tester · **Severity:** medium — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-E2E-PROF-CREATE-ROSTER-FLAKE.md](FUP-E2E-PROF-CREATE-ROSTER-FLAKE.md)

### 🟡 FUP-GATE-PDFP1-FLAKE — `pdf-printing.spec.ts:38` pre-mint empty-state flake, mechanism UNPROVEN (owner: lead + tester)

**Filed:** 2026-08-19 (earliest dated reference in the entry; no explicit filing date stated) · **Owner:** lead + tester · **Severity:** medium — per emoji at consolidation
**Closes when:** PO to rule
**Status:** parked
**Revisit when:** once in the DM2 re-gate's `e2e:prod` run 1, then passed three independent ways at `RETRIES=

- 🟡 **FUP-GATE-PDFP1-FLAKE** — `e2e/pdf-printing.spec.ts:38` failed its **pre-mint** empty-state assertion once in the DM2 re-gate's `e2e:prod` run 1, then passed **three** independent ways at `RETRIES=0` (isolation 9/9 · identical-batch re-run 60/61 · full-suite run 2, batch 8 60/0). **Not phase-attributable** — the printing module is outside the DM2 diff and the expected string is intact in source (QA r2). ⚠ **The mechanism is UNPROVEN**: no infra signal (`server_dead=0`, no conn errors), unlike DM1's proven `server_dead` flake. QA narrowed it further — the gate resets the DB **before each batch** and batch 8 ran **1 worker**, and the failing test is the *first* in its file (pool index 0), which near-refutes the shared-fixture-pool hypothesis and leaves an ordinary `toBeVisible` timing flake. ⚠ **Both evidence artifacts are gone**: `test-results/` AND `/tmp/e2e-prod-gate/batch-8.log` were overwritten by the re-runs. **Discharge = catch it once with artifacts preserved, or pin the timing.** Related and arguably the real fix: `scripts/e2e-prod-gate.sh` resolves "re-run to see if it recurs" vs "preserve the evidence" the **wrong way** — a failing batch's log and `test-results/` should be archived before any re-run (QA r2 carry-forward) — lead/tester

> ⭐ **2026-08-18 — a named candidate this item can now EXCLUDE, which is progress on "UNPROVEN" without discharging it.** **BUG-DM5-S3-ENV-FIXTURE-POOL-1** (closed + archived) proved the shared-pool mechanism *in a manual, un-reset context*: 9 pre-existing `printed_documents` rows carrying this spec's own revoke text, against a helper that claims responses by POSITION. ⛔ **That is NOT this item.** QA's narrowing here still holds — the gate resets before each batch and ran 1 worker, so pool contamination cannot be the gate failure's mechanism. What changes is that the candidate is now *named and measured* rather than hand-waved, so a future investigator can exclude it by citation instead of re-deriving it. The dev-loop half is filed separately as **FUP-E2E-PRINT-POOL-DEVLOOP**. ⚠ **Do not close either item on the other's evidence** — same assertion, two different contexts, one proven mechanism and one unproven.

### 🟡 FUP-E2E-PRINT-POOL-DEVLOOP — the print spec's fixture pool is claimed by POSITION, so a second run without a reset reds a human but never CI (owner: tester)

**Filed:** 2026-08-19 (earliest dated reference in the entry; no explicit filing date stated) · **Owner:** tester · **Severity:** medium — per emoji at consolidation
**Closes when:** PO to rule
**Status:** parked
**Revisit when:** once the first test mints on index 0 a
**Body:** [FUP-E2E-PRINT-POOL-DEVLOOP.md](FUP-E2E-PRINT-POOL-DEVLOOP.md)

### 🟡 FUP-329-ABORT-SHAPE — a `329` keystone whose failure ABORTS the file, dropping 41 assertions (owner: backend)

**Filed:** 2026-08-19 (earliest dated reference in the entry; no explicit filing date stated) · **Owner:** backend · **Severity:** medium — per emoji at consolidation
**Closes when:** PO to rule
**Status:** parked
**Revisit when:** PO to rule

- 🟡 **FUP-329-ABORT-SHAPE** — a `329` keystone whose failure **aborts the file** (drops 41 assertions); it is what makes a mutation sweep over these gates unclassifiable — backend

### 🟡 FUP-ACT-CAPA-ASSIGN — NSP operators see ~only themselves in the CAPA assignee picker (owner: backend)

**Filed:** 2026-08-19 (earliest dated reference in the entry; no explicit filing date stated) · **Owner:** backend · **Severity:** medium — per emoji at consolidation
**Closes when:** PO to rule
**Status:** parked
**Revisit when:** PO to rule

- 🟡 **FUP-ACT-CAPA-ASSIGN** — NSP operators see ~only themselves in the CAPA assignee picker (`profiles` RLS has no operator arm; the hatless union used to mask it) — backend

### 🔴 FUP-ETH-ROLES-1 — no production bootstrap of `case_participant_roles` (owner: product + backend)

**Filed:** 2026-09-02 (ad-hoc: PROGRESS.md consolidation 2026-09-02) · **Owner:** backend · **Severity:** critical — per emoji at consolidation
**Closes when:** Decide before a second org onboards — product/backend
**Status:** open

- 🔴 **FUP-ETH-ROLES-1** — **no production bootstrap of `case_participant_roles`.** The ethics role bundle lives ONLY in `supabase/seed.sql`; the sole role-insert in any migration is the lazy `affected_patient` mint inside the patient path. A real org therefore starts with **zero** roles, and since `case_participants.role_id` is NOT NULL, EVERY participant type is a dead end until an org admin authors the vocabulary in T5 — the three role-less external types ratified on 2026-08-11 are one visible instance, not the shape. Decide before the pilot onboards a second org: bootstrap-on-org-create vs. a first-run prompt vs. accept-and-document (found 2026-08-11 while ratifying the PO items; the add-dialog empty state now at least names the remedy) — product + backend

### 🟠 FUP-CORRECTION-CORRIDOR-COVERAGE-UNMEASURED — ✅ **ALL SEVEN LANES MEASURED 2026-08-20.** One lane is fully covered, six have a permanently-frozen state, and the meeting gate bound generalises to only two of six — while the *erasure* fallback turns out to be BROKEN on two lanes (owner: backend + PO; filed 2026-08-20 when the PO asked whether minutes-adjustment mechanisms already existed)

**Filed:** 2026-08-20 (when the PO asked whether minutes-adjustment mechanisms already existed) · **Owner:** backend + PO · **Severity:** high — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-CORRECTION-CORRIDOR-COVERAGE-UNMEASURED.md](FUP-CORRECTION-CORRIDOR-COVERAGE-UNMEASURED.md)

### 🟡 FUP-XREF-PEPPER-ROTATION-ORPHANS — rotating `mrn_pepper` permanently orphans DISPOSED xref rows; documented in ADR 0039 as "follow-up", never filed (owner: backend; pre-pilot: decide, not build)

**Filed:** 2026-08-19 (lead) · **Owner:** backend · **Severity:** medium — per emoji at consolidation
**Closes when:** Decide before any rotation task is scoped — backend
**Status:** open

Filed 2026-08-19 (lead) — from the disposal-ADR sweep. ADR
[0039](../decisions/0039-patient-identity-cross-committee-linkage.md) Consequences: pepper rotation
*"orphans disposed-row keys (the raw MRN is gone, so the key can't be recomputed) … a documented
residual, **not** built (follow-up)"* — and no register entry was ever created. Measured 2026-08-19:
1 live function references `mrn_pepper`; `patient_xref` holds rows whose `disposed_at` marks exactly
the population a rotation strands. The interaction with the DSR program (ADR 0130) is that disposal
**creates** the unrotatable population — every granted erasure widens it. Nothing to build now; the
item exists so a future "rotate the pepper" task cannot be scoped without meeting it.

### 🟢 FUP-ADR0121-REASON-VALUE-DRIFT — the `superseded`-vs-`retention_expired` question ADR 0121 Amdt 2 deliberately left open has been silently pre-answered by the D11 register entry (owner: lead)

**Filed:** 2026-08-19 (lead) · **Owner:** lead · **Severity:** low — re-rated from 🔵 per D4: a documentation/register drift with "nothing... built on the drift" — no live behaviour affected
**Closes when:** the D11 implementing slice makes the call explicitly, records it in ADR 0121 Amdt 2's reserved slot, and reconciles the D11 body; until then, neither value may be cited as decided. (ADR [0130](../decisions/0130-dsr-subject-request-workflow.md) explicitly does not settle it.)
**Status:** open
**Body:** [FUP-ADR0121-REASON-VALUE-DRIFT.md](FUP-ADR0121-REASON-VALUE-DRIFT.md)

### 🟠 FUP-DISPOSAL-RUNBOOK-COVERS-ONLY-BYTES — the PHI-disposal runbook is the procedure for ONE of the two PHI-disposal substrates; the four column-erasing doors have no operational procedure at all (owner: backend + PO; found by correcting a wrong-grain claim, 2026-08-19)

**Filed:** 2026-09-02 (ad-hoc: PROGRESS.md consolidation 2026-09-02) · **Owner:** backend + PO · **Severity:** high — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-DISPOSAL-RUNBOOK-COVERS-ONLY-BYTES.md](FUP-DISPOSAL-RUNBOOK-COVERS-ONLY-BYTES.md)

### 🟠 FUP-FORM-IDENTIFIER-IN-URL — a sensitive field submitted BEFORE HYDRATION serialises into the query string. **4 leaks CONFIRMED AND FIXED (incl. CPF + MRN); the STANDING DETECTOR and the `useFieldIds` default remain open** (owner: frontend + lead; **class, correction, measurement and fixes all credited to `frontend`**)

**Filed:** 2026-09-02 (ad-hoc: PROGRESS.md consolidation 2026-09-02) · **Owner:** lead + frontend · **Severity:** high — per emoji at consolidation
**Closes when:** ten one-line `name={undefined}` strips across five files. ⭐ No `FormData` anywhere — all four leaking forms were already `useState`-controlled, so no submission path changed and the `method="post"` question is moot. ⭐ The two CPF leaks were ONE bug: both routes render the shared `users/cpf-field.tsx`, so a single strip fixed both — which is also why the CPF exposure was *wider* than either route on its own suggested.
**Status:** open
**Body:** [FUP-FORM-IDENTIFIER-IN-URL.md](FUP-FORM-IDENTIFIER-IN-URL.md)

### 🟡 FUP-VITEST-UNCAPTURED-FAILURE — one unit test failed once and **nobody knows which** (owner: backend/lead; **filed only because QA found it was missing from the record entirely**)

**Filed:** 2026-09-02 (ad-hoc: PROGRESS.md consolidation 2026-09-02) · **Owner:** lead + backend · **Severity:** medium — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-VITEST-UNCAPTURED-FAILURE.md](FUP-VITEST-UNCAPTURED-FAILURE.md)

### 🔴 FUP-AUTHZ-HARNESS-PRECONDITIONS — a neutralization verdict has at least TWO preconditions and the harness checks ONE (owner: backend/harness; **filed after two near-miss false BLINDs on the same live door in one session**)

**Filed:** 2026-09-02 (ad-hoc: PROGRESS.md consolidation 2026-09-02) · **Owner:** backend · **Severity:** critical — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-AUTHZ-HARNESS-PRECONDITIONS.md](FUP-AUTHZ-HARNESS-PRECONDITIONS.md)

### 🟡 FUP-PGTAP-184-T11-FLAKE — `184_hospital_admin_isolation.sql` test 11 failed once, undiagnosed but NAMED (owner: unassigned)

**Filed:** 2026-09-02 (ad-hoc: PROGRESS.md consolidation 2026-09-02) · **Owner:** unassigned · **Severity:** medium — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open

**2026-08-20.** *"RLS: ha1 reads CCIH forms (swapped surface)"* failed on the first full `test:db` run
after an orphaned server was reaped; **passed in isolation on a fresh reset and on two subsequent full
runs** (6678/6678 twice). `184` runs **before** `350` alphabetically, so the DSR suite cannot contaminate
it, and nothing Slice 3 touched goes near `forms`/`commissions` RLS.

⛔ **Not a diagnosis** — "passed three times since" never is. But unlike
[[FUP-VITEST-UNCAPTURED-FAILURE]] this one **has a name**, so it is actionable rather than a footnote:
whoever picks it up has the file and the test. ⚠ Plausible but unverified: it first appeared during the
window when a stray standalone server was deadlocking pgTAP, so contention is a candidate cause — that is
a hypothesis, not a finding.

### 🟡 FUP-E2E-GATE-CENSUS-AND-CRASH-CLASSIFIER — the gate's own arithmetic does not sum, and it scores a worker crash as an assertion failure (owner: lead/tester)

**Filed:** 2026-09-02 (ad-hoc: PROGRESS.md consolidation 2026-09-02) · **Owner:** lead + tester · **Severity:** medium — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-E2E-GATE-CENSUS-AND-CRASH-CLASSIFIER.md](FUP-E2E-GATE-CENSUS-AND-CRASH-CLASSIFIER.md)

### 🟠 FUP-E2E-ABSENT-ROW-ASSERTIONS — `expect(row?.field).not.toBeNull()` passes when the row is ABSENT, and it is live on PHI-erasure assertions (owner: tester/lead; **the number was wrong in BOTH directions before anyone measured it**)

**Filed:** 2026-09-02 (ad-hoc: PROGRESS.md consolidation 2026-09-02) · **Owner:** lead + tester · **Severity:** high — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-E2E-ABSENT-ROW-ASSERTIONS.md](FUP-E2E-ABSENT-ROW-ASSERTIONS.md)

### 🟠 FUP-DSR-OUTCOME-RECORD-HAS-NO-DELIVERY — the DSR workflow's one promise to the data subject has no mechanism (owner: PO/frontend; **filed 2026-08-20, PO-deferred the same day**)

**Filed:** 2026-08-20 (PO-deferred the same day) · **Owner:** frontend + PO · **Severity:** high — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-DSR-OUTCOME-RECORD-HAS-NO-DELIVERY.md](FUP-DSR-OUTCOME-RECORD-HAS-NO-DELIVERY.md)

### 🟡 FUP-DSR-ENCARREGADO-MUST-BE-A-COMMISSION-MEMBER — the LGPD data-protection officer cannot be a pure officer (owner: PO/product; **filed 2026-08-20 after a lead premise was measured false**)

**Filed:** 2026-08-20 (after a lead premise was measured false) · **Owner:** PO · **Severity:** medium — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-DSR-ENCARREGADO-MUST-BE-A-COMMISSION-MEMBER.md](FUP-DSR-ENCARREGADO-MUST-BE-A-COMMISSION-MEMBER.md)

### 🟡 FUP-TITLE-ERASURE-REACH-IS-NOT-UNIFORM — six of the ten annotated `*.title` columns ARE inside a disposal door's reach, and four are not (owner: PO/lead; **filed 2026-08-20 while writing the ADR 0131 Amdt 1 helper text**)

**Filed:** 2026-08-20 (while writing the ADR 0131 Amdt 1 helper text) · **Owner:** lead + PO · **Severity:** medium — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-TITLE-ERASURE-REACH-IS-NOT-UNIFORM.md](FUP-TITLE-ERASURE-REACH-IS-NOT-UNIFORM.md)

### 🟠 FUP-COPY-PROPERTY-CANNOT-SEE-ITS-OWN-SURFACE-SET — the shared disposal-copy property has no census of the surfaces it is asserted on (owner: lead/frontend; **filed 2026-08-21, found by reading 15 tests before deleting them**)

**Filed:** 2026-08-21 (found by reading 15 tests before deleting them) · **Owner:** lead + frontend · **Severity:** high — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-COPY-PROPERTY-CANNOT-SEE-ITS-OWN-SURFACE-SET.md](FUP-COPY-PROPERTY-CANNOT-SEE-ITS-OWN-SURFACE-SET.md)

### 🟠 FUP-E2E-HELPERS-SWALLOW-FAILED-READS — ~48 spec files + 2 helpers turn a FAILED READ into "the table is empty" (owner: tester/lead; **filed 2026-08-21; 3 instances fixed, the population reported and deliberately NOT swept**)

**Filed:** 2026-08-21 (3 instances fixed, the population reported and deliberately NOT swept) · **Owner:** lead + tester · **Severity:** high — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-E2E-HELPERS-SWALLOW-FAILED-READS.md](FUP-E2E-HELPERS-SWALLOW-FAILED-READS.md)

### 🟡 FUP-DISPOSE-REFERRAL-HAS-NO-INBOX-BROWSER-COVERAGE — three of the four erasure lanes are driven through the DSR inbox in a browser; the referral lane is not (owner: tester; **filed 2026-08-21 as the named residual of a bug that closed on removal**)

**Filed:** 2026-08-21 (as the named residual of a bug that closed on removal) · **Owner:** tester · **Severity:** medium — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-DISPOSE-REFERRAL-HAS-NO-INBOX-BROWSER-COVERAGE.md](FUP-DISPOSE-REFERRAL-HAS-NO-INBOX-BROWSER-COVERAGE.md)

### 🟡 FUP-CHILD-LOCK-REGRESSION-GUARD-COVERS-ONE-LANE — the browser-level P0 guard covers the interview lane only (owner: tester; **filed 2026-08-21 by its own author, as a stated bound**)

**Filed:** 2026-08-21 (by its own author, as a stated bound) · **Owner:** tester · **Severity:** medium — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-CHILD-LOCK-REGRESSION-GUARD-COVERS-ONE-LANE.md](FUP-CHILD-LOCK-REGRESSION-GUARD-COVERS-ONE-LANE.md)

### 🟡 FUP-RULES-VOLUME-CAPS-BIND-IN-OPPOSITE-DIRECTIONS — the cap that binds is the one the gate never reports (owner: lead; **filed 2026-08-21 after a one-line rule edit came within 31 bytes of redding the gate**)

**Filed:** 2026-08-21 (after a one-line rule edit came within 31 bytes of redding the gate) · **Owner:** lead · **Severity:** medium — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-RULES-VOLUME-CAPS-BIND-IN-OPPOSITE-DIRECTIONS.md](FUP-RULES-VOLUME-CAPS-BIND-IN-OPPOSITE-DIRECTIONS.md)

### 🟡 FUP-EXIT-CODE-MASKING-HAS-NO-MECHANISM — a control that rests entirely on habit, with a measured failure rate (owner: lead; **filed 2026-08-21 as an ACCEPTED RESIDUAL, not as resolved**)

**Filed:** 2026-08-21 (as an ACCEPTED RESIDUAL, not as resolved) · **Owner:** lead · **Severity:** medium — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-EXIT-CODE-MASKING-HAS-NO-MECHANISM.md](FUP-EXIT-CODE-MASKING-HAS-NO-MECHANISM.md)

### ⛔ FUP-ETHICS-CASE-DELETE-CASCADE — a commission `staff_admin` can `DELETE` an in-flight ethics case over PostgREST, cascading all SEVEN `ethics_*` tables, with ZERO audit rows naming any ethics entity (owner: backend + PO; found 2026-08-21 answering the PO's "were any doors opened?", ADR 0132)

**Filed:** 2026-09-02 (ad-hoc: PROGRESS.md consolidation 2026-09-02) · **Owner:** backend + PO · **Severity:** catastrophic — CATASTROPHIC per D4: a staff_admin can DELETE an in-flight case cascading all 7 ethics_* tables with ZERO audit rows — data loss with no attribution
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-ETHICS-CASE-DELETE-CASCADE.md](FUP-ETHICS-CASE-DELETE-CASCADE.md)

### 🟠 FUP-ETHICS-RESPONDENT-PIN-FIRES-TOO-LATE — `redact_professional_profile` erases the accused doctor's identity from an UNDECIDED ethics case; the retention pin lands one lifecycle stage after the entitlement ends (owner: backend + PO; ADR 0132)

**Filed:** 2026-09-02 (ad-hoc: PROGRESS.md consolidation 2026-09-02) · **Owner:** backend + PO · **Severity:** high — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-ETHICS-RESPONDENT-PIN-FIRES-TOO-LATE.md](FUP-ETHICS-RESPONDENT-PIN-FIRES-TOO-LATE.md)

### 🟢 FUP-APP-SCHEMA-PUBLIC-EXECUTE-IS-CONFIG-BOUNDED — half of `app` is PUBLIC-executable, and the only thing bounding it is one config line (owner: backend; filed 2026-08-22, found while deriving an ACL by property for ADR 0134 Amdt 6)

**Filed:** 2026-08-22 (found while deriving an ACL by property for ADR 0134 Amdt 6) · **Owner:** backend · **Severity:** low — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-APP-SCHEMA-PUBLIC-EXECUTE-IS-CONFIG-BOUNDED.md](FUP-APP-SCHEMA-PUBLIC-EXECUTE-IS-CONFIG-BOUNDED.md)

### 🟡 FUP-SIGNATURE-STRING-CALLERS-ABORT-ON-A-DROP-CREATE — a caller that names the OLD ARITY fails as a plan mismatch, pointing nowhere near signatures (owner: backend; filed 2026-08-22, found when the full suite failed in a file this increment never touched)

**Filed:** 2026-08-22 (found when the full suite failed in a file this increment never touched) · **Owner:** backend · **Severity:** medium — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-SIGNATURE-STRING-CALLERS-ABORT-ON-A-DROP-CREATE.md](FUP-SIGNATURE-STRING-CALLERS-ABORT-ON-A-DROP-CREATE.md)

### 🟠 FUP-42501-AUTHORED-MESSAGES-FLATTENED-BY-EVERY-MAPPER — 103 authored pt-BR refusals, and the app layer discards essentially all of them (owner: backend/frontend; filed 2026-08-22, found when a PO-ruled message never reached the UI)

**Filed:** 2026-08-22 (found when a PO-ruled message never reached the UI) · **Owner:** backend + frontend · **Severity:** high — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-42501-AUTHORED-MESSAGES-FLATTENED-BY-EVERY-MAPPER.md](FUP-42501-AUTHORED-MESSAGES-FLATTENED-BY-EVERY-MAPPER.md)

### 🟠 FUP-DEV-SERVER-SERVED-STALE-CODE-FOR-HOURS — a green E2E run against a stale instrument is indistinguishable from a real pass (owner: tester/lead; filed 2026-08-22, found mid-verification in Increment 2)

**Filed:** 2026-08-22 (found mid-verification in Increment 2) · **Owner:** lead + tester · **Severity:** high — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-DEV-SERVER-SERVED-STALE-CODE-FOR-HOURS.md](FUP-DEV-SERVER-SERVED-STALE-CODE-FOR-HOURS.md)

### 🟡 FUP-CS2-QA-RESIDUE — the twelve non-blocking QA findings from Increment 2, and four of them are the same class (owner: backend/tester/frontend; filed 2026-08-22 at the Record step; ⭕ **12 → 6 on 2026-08-22** — M-5/M-6/M-7/M-14/M-15/M-16 remediated red-first and QA C-3 discharged; **M-4 STRUCK as already-delivered**. Remaining: M-1, M-8, M-11, M-12, M-13, M-17. Record: [case-split-assertion-integrity.md](../progress/case-split-assertion-integrity.md))

**Filed:** 2026-09-02 (ad-hoc: PROGRESS.md consolidation 2026-09-02) · **Owner:** backend + frontend + tester · **Severity:** medium — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-CS2-QA-RESIDUE.md](FUP-CS2-QA-RESIDUE.md)

### 🟡 FUP-PLAIN-STAFF-ASSIGNEE-CANNOT-REACH-THE-MANAGE-HOST — the surfaced arm's own principal 404s before it (owner: frontend/PO; filed 2026-08-22 by the agent that surfaced the arm, as a stated bound on its own fix)

**Filed:** 2026-08-22 (by the agent that surfaced the arm, as a stated bound on its own fix) · **Owner:** frontend + PO · **Severity:** medium — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-PLAIN-STAFF-ASSIGNEE-CANNOT-REACH-THE-MANAGE-HOST.md](FUP-PLAIN-STAFF-ASSIGNEE-CANNOT-REACH-THE-MANAGE-HOST.md)

### 🟡 FUP-ACTIVE-PHASE-STASHED-OVERRIDE-IS-INVISIBLE — the write succeeds and nothing shows it (owner: backend; filed 2026-08-22 from the phase-result widening)

**Filed:** 2026-08-22 (from the phase-result widening) · **Owner:** backend · **Severity:** medium — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-ACTIVE-PHASE-STASHED-OVERRIDE-IS-INVISIBLE.md](FUP-ACTIVE-PHASE-STASHED-OVERRIDE-IS-INVISIBLE.md)

### 🟠 FUP-RETRY-CHANGES-THE-FAILURE-MODE-ON-NON-IDEMPOTENT-TESTS — the gate's verdict is unreadable where a test poisons its own re-run (owner: tester/lead; filed 2026-08-23 from the first full `e2e:prod` since Increment 2)

**Filed:** 2026-08-23 (from the first full `e2e:prod` since Increment 2) · **Owner:** lead + tester · **Severity:** high — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-RETRY-CHANGES-THE-FAILURE-MODE-ON-NON-IDEMPOTENT-TESTS.md](FUP-RETRY-CHANGES-THE-FAILURE-MODE-ON-NON-IDEMPOTENT-TESTS.md)

### 🟡 FUP-AFF2-ACTIVE-MEANS-TWO-THINGS — three authorities say "active membership" and no policy implements it (owner: backend/PO; filed 2026-08-23 at AFF2 build start, from a conflict `backend` measured before writing SQL)

**Filed:** 2026-08-23 (at AFF2 build start, from a conflict `backend` measured before writing SQL) · **Owner:** backend + PO · **Severity:** medium — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-AFF2-ACTIVE-MEANS-TWO-THINGS.md](FUP-AFF2-ACTIVE-MEANS-TWO-THINGS.md)

### 🟡 FUP-WAITFORURL-SATISFIED-BY-ITS-OWN-STARTING-URL — a wait that is already true does not wait, and fails somewhere else (owner: tester/lead; filed 2026-08-23, found by `tester` sweeping their own fix)

**Filed:** 2026-08-23 (found by `tester` sweeping their own fix) · **Owner:** lead + tester · **Severity:** medium — per emoji at consolidation
**Closes when:** the positive form `/\/usuarios\/[0-9a-f-]{36}$/i` — assert what the destination is, not merely what it is not.
**Status:** open
**Body:** [FUP-WAITFORURL-SATISFIED-BY-ITS-OWN-STARTING-URL.md](FUP-WAITFORURL-SATISFIED-BY-ITS-OWN-STARTING-URL.md)

### 🟠 FUP-E2E-PIN-RECORDS-COUNTS-NOT-IDENTITIES — the baseline can only be diffed arithmetically, and the evidence is destroyed before anyone can check (owner: tester/lead; filed 2026-08-23, found when the AFF2 gate tried to compare flaky tests by identity)

**Filed:** 2026-08-23 (found when the AFF2 gate tried to compare flaky tests by identity) · **Owner:** lead + tester · **Severity:** high — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-E2E-PIN-RECORDS-COUNTS-NOT-IDENTITIES.md](FUP-E2E-PIN-RECORDS-COUNTS-NOT-IDENTITIES.md)

### 🟠 FUP-E2E-FLAKE-BASELINE-NOT-FED-BY-THE-RUN-THAT-EXCEEDED-IT — plan rule 11's fingerprinted baseline exists, and the last full gate neither fed it nor reconciled against it (owner: lead/tester; filed 2026-08-31 while triaging AE3 readiness)

**Filed:** 2026-08-31 (while triaging AE3 readiness) · **Owner:** lead + tester · **Severity:** high — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-E2E-FLAKE-BASELINE-NOT-FED-BY-THE-RUN-THAT-EXCEEDED-IT.md](FUP-E2E-FLAKE-BASELINE-NOT-FED-BY-THE-RUN-THAT-EXCEEDED-IT.md)

### 🟡 FUP-VITEST-CATALOG-DRIVEN-CASE-COUNT — two suites generate their cases from the LIVE catalog; pin the role SET so a mid-reset read cannot shrink coverage silently (owner: backend + frontend)

**Filed:** 2026-09-02 (ad-hoc: PROGRESS.md consolidation 2026-09-02) · **Owner:** backend + frontend · **Severity:** medium — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-VITEST-CATALOG-DRIVEN-CASE-COUNT.md](FUP-VITEST-CATALOG-DRIVEN-CASE-COUNT.md)

### 🟡 FUP-DOOR-SWEEP-BROAD-GATE-ABORTS-A-FILE

**Filed:** 2026-08-24 (lead) · **Owner:** backend · **Severity:** medium — the heading carried NO emoji at consolidation; medium is the default, PO to confirm
**Closes when:** (a) a bespoke neutralization per case (what ADR 0079 Amendment 1 already prescribes for value-returning raise-guards) — precise, and it does not touch the classifier; or; (b) teaching the classifier a fourth outcome for "shape moved AND the suite went FAIL", which is strictly more information than ERROR — ⛔ but it must never collapse into COVERED, because the failing assertions may belong to a different gate entirely.
**Status:** open
**Body:** [FUP-DOOR-SWEEP-BROAD-GATE-ABORTS-A-FILE.md](FUP-DOOR-SWEEP-BROAD-GATE-ABORTS-A-FILE.md)

### 🟡 FUP-E2E-CREATEFRESHCASE-SILENT-NULL

**Filed:** 2026-08-23 (tester) · **Owner:** tester · **Severity:** medium — the heading carried NO emoji at consolidation; medium is the default, PO to confirm
**Closes when:** (a) throw with the underlying reason instead of returning `null`; or; (b) keep null-on-failure but require every caller to assert non-null with a message naming the failure mode — mirroring the `restGet` / `expect(resp.ok())` discipline already used elsewhere in this suite.
**Status:** open
**Body:** [FUP-E2E-CREATEFRESHCASE-SILENT-NULL.md](FUP-E2E-CREATEFRESHCASE-SILENT-NULL.md)

### 🟡 FUP-AFF2-DIRECTORY-SEARCH-HAS-NO-REGISTRO-LEG

**Filed:** 2026-09-02 (ad-hoc: PROGRESS.md consolidation 2026-09-02) · **Owner:** backend + PO · **Severity:** medium — the heading carried NO emoji at consolidation; medium is the default, PO to confirm
**Closes when:** The number is `professional_credentials.registration_number` (`org-users.ts:68-76`) — a 1→N table the directory already batch-reads per page in `loadPageExtras` (`:258`). So the leg is a join filter: resolve matching `user_id`s and `.in()` them, the shape `hospitalPeopleIds` (`:133`) already uses and whose `:124` comment explains why a resolved set beats a raw `.or()` string. Never another `.or()` clause on `profiles`. ⚠ It must respect ADR 0133 D13's widened `professional_cr…
**Status:** open
**Body:** [FUP-AFF2-DIRECTORY-SEARCH-HAS-NO-REGISTRO-LEG.md](FUP-AFF2-DIRECTORY-SEARCH-HAS-NO-REGISTRO-LEG.md)

### 🟡 FUP-UI-AUTHZ-WRAPPERS-DUPLICATE-THE-ENFORCING-PREDICATE — six `public` authz wrappers mirror an `app.*` rule that RLS calls directly, and nothing pins that the two agree (owner: backend + PO; filed 2026-08-24, found while keystoning `rca_writer_can_write`)

**Filed:** 2026-08-24 (found while keystoning `rca_writer_can_write`) · **Owner:** backend + PO · **Severity:** medium — per emoji at consolidation
**Closes when:** (a) differential assertions for all six, plus first-ever coverage for the four `is_*_self` wrappers; or; (b) a structural fix that removes the second copy — generate the wrappers from the predicate, or expose one definition both the UI and RLS consult, so agreement is not a thing anyone has to test.
**Status:** open
**Body:** [FUP-UI-AUTHZ-WRAPPERS-DUPLICATE-THE-ENFORCING-PREDICATE.md](FUP-UI-AUTHZ-WRAPPERS-DUPLICATE-THE-ENFORCING-PREDICATE.md)

### 🟡 FUP-CLAIMS-SURVIVAL-DIFFERENTIAL-IS-NOT-RUN-BY-ANYTHING — the detector that found six false premises is a technique, not a gate (owner: backend/tester; filed 2026-08-24 at the close of FUP-RESET-ROLE-DOES-NOT-CLEAR-JWT-CLAIMS)

**Filed:** 2026-08-24 (at the close of FUP-RESET-ROLE-DOES-NOT-CLEAR-JWT-CLAIMS) · **Owner:** backend + tester · **Severity:** medium — per emoji at consolidation
**Closes when:** (a) script it as a periodic audit (alongside the other ~100-min sweeps), with the G4 inversion as its self-test; or; (b) rule the class closed-by-convention and rely on `test_helpers.reset_role_and_claims()` adoption — ⚠ but note the close measured that the verb is not a drop-in replacement for `reset role` (it needs `test_helpers` schema USAGE, which a restricted role may lack), so adoption is not mechanical.
**Status:** open
**Body:** [FUP-CLAIMS-SURVIVAL-DIFFERENTIAL-IS-NOT-RUN-BY-ANYTHING.md](FUP-CLAIMS-SURVIVAL-DIFFERENTIAL-IS-NOT-RUN-BY-ANYTHING.md)

### 🟡 FUP-P3-MINT-AFFORDANCE-WIDER-THAN-ITS-DOOR — NARROWED 2026-08-25 by catalog measurement; still OPEN on the identified axis (owner: frontend/qa; filed by the builder as a stated bound on F2)

**Filed:** 2026-09-02 (ad-hoc: PROGRESS.md consolidation 2026-09-02) · **Owner:** frontend + qa · **Severity:** medium — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-P3-MINT-AFFORDANCE-WIDER-THAN-ITS-DOOR.md](FUP-P3-MINT-AFFORDANCE-WIDER-THAN-ITS-DOOR.md)

### 🟡 FUP-P3-DOSSIER-HAS-NO-RECUSAL-ROSTER — the case dossier cannot show who was recused (owner: backend)

**Filed:** 2026-08-25 (during the PDF·P3 build, as a named gap rather than a silent cut) · **Owner:** backend · **Severity:** medium — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-P3-DOSSIER-HAS-NO-RECUSAL-ROSTER.md](FUP-P3-DOSSIER-HAS-NO-RECUSAL-ROSTER.md)

### 🔴 FUP-CASE-DOCS-DEAD-READER — three surfaces render zero case documents, silently (owner: frontend + backend)

**Filed:** 2026-08-25 (during PDF·P3 while sourcing D2's document manifest) · **Owner:** backend + frontend · **Severity:** critical — per emoji at consolidation
**Closes when:** repoint all three to `listDocumentsForResource('case', caseId)` (`src/lib/queries/documents.ts`, DM2), adapt the shape, then delete `listCaseDocuments` so the dead path cannot be re-adopted. ⛔ The test must upload a document and assert it APPEARS. A test asserting the list is well-formed passes against `return []` — it is the same fixture-cannot-reach-the-failing-state trap that hid the defect. ⚠ PDF·P3's own manifest is safe: it is built on `listDocumentsForResource`, never …
**Status:** open
**Body:** [FUP-CASE-DOCS-DEAD-READER.md](FUP-CASE-DOCS-DEAD-READER.md)

### 🟡 FUP-REFERRAL-WIZARD-TEST-HAS-NO-TIMEOUT-MARGIN — a unit test that flakes on a busy box (owner: frontend)

**Filed:** 2026-08-25 (PDF·P3, reported by `frontend` as a not-mine red) · **Owner:** frontend · **Severity:** medium — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-REFERRAL-WIZARD-TEST-HAS-NO-TIMEOUT-MARGIN.md](FUP-REFERRAL-WIZARD-TEST-HAS-NO-TIMEOUT-MARGIN.md)

### 🟠 FUP-CASE-CONFIDENTIALITY-VS-PHI — a case can be classified "no patient data" while holding patient data (owner: backend + PO ruling)

**Filed:** 2026-09-02 (ad-hoc: PROGRESS.md consolidation 2026-09-02) · **Owner:** backend + PO · **Severity:** high — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-CASE-CONFIDENTIALITY-VS-PHI.md](FUP-CASE-CONFIDENTIALITY-VS-PHI.md)

### 🟡 FUP-CASE-NUMBER-FORMAT-HAS-EIGHT-AUTHORITIES — `padStart(4,'0')` is reimplemented at 8 sites (owner: frontend)

**Filed:** 2026-09-02 (ad-hoc: PROGRESS.md consolidation 2026-09-02) · **Owner:** frontend · **Severity:** medium — per emoji at consolidation
**Closes when:** repoint the seven inline sites at the shared formatter, then keep new ones out. ⛔ A ninth `padStart` is the failure mode, not the eight existing ones. Owner: `frontend`. ⛔ TWO TRAPS FOR WHOEVER PLANS THIS SWEEP — added 2026-08-25, both measured. 1. One of the eight is NOT substitutable. `src/components/referrals/format.ts:18` defines its own `formatCaseNumber` with a different signature — `(n: number | null | undefined)`, returning `"—"` on null. Repointing it at the shared f…
**Status:** open
**Body:** [FUP-CASE-NUMBER-FORMAT-HAS-EIGHT-AUTHORITIES.md](FUP-CASE-NUMBER-FORMAT-HAS-EIGHT-AUTHORITIES.md)

### 🟡 FUP-BULK-GRID-MODEL-IMPORTS-UPWARD — a `src/lib` → `src/components` dependency no gate can see (owner: frontend)

**Filed:** 2026-09-02 (ad-hoc: PROGRESS.md consolidation 2026-09-02) · **Owner:** frontend · **Severity:** medium — per emoji at consolidation
**Closes when:** the F3/F4 shape — the type belongs in `src/lib/cases/types.ts`, with the component re-exporting if it needs the name. Unrelated to printing; found while censusing for F4. Owner: `frontend`.
**Status:** open
**Body:** [FUP-BULK-GRID-MODEL-IMPORTS-UPWARD.md](FUP-BULK-GRID-MODEL-IMPORTS-UPWARD.md)

### 🟡 FUP-MOCKED-MODULE-ASSERTED-ABOUT-ITSELF — suites that mock a module and then assert a property OF that module (owner: backend + qa)

**Filed:** 2026-08-25 (PDF·P3) · **Owner:** backend + qa · **Severity:** medium — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-MOCKED-MODULE-ASSERTED-ABOUT-ITSELF.md](FUP-MOCKED-MODULE-ASSERTED-ABOUT-ITSELF.md)

### 🔴 FUP-E2E-GATE-CLASSIFIER-BLIND-TO-WORKER-CRASHES — a host-resource collapse is booked as failures against the phase under test (owner: tester + backend)

**Filed:** 2026-09-02 (ad-hoc: PROGRESS.md consolidation 2026-09-02) · **Owner:** backend + tester · **Severity:** critical — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-E2E-GATE-CLASSIFIER-BLIND-TO-WORKER-CRASHES.md](FUP-E2E-GATE-CLASSIFIER-BLIND-TO-WORKER-CRASHES.md)

### 🟡 FUP-MOJIBAKE-GATE-BLIND-TO-UNTRACKED-FILES — a brand-new file is in no `ls-files` set, so gate 10 passes it vacuously (owner: backend)

**Filed:** 2026-09-02 (ad-hoc: PROGRESS.md consolidation 2026-09-02) · **Owner:** backend · **Severity:** medium — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-MOJIBAKE-GATE-BLIND-TO-UNTRACKED-FILES.md](FUP-MOJIBAKE-GATE-BLIND-TO-UNTRACKED-FILES.md)

### 🔴 FUP-E2E-GATE-DISCARDS-SERVER-LOG-ON-MID-BATCH-DEATH

**Filed:** 2026-09-02 (ad-hoc: PROGRESS.md consolidation 2026-09-02) · **Owner:** backend + tester · **Severity:** critical — per emoji at consolidation
**Closes when:** per-batch filename (`server-batch-N.log`, matching the existing convention) and a `tail` on the INFRA-classification path, not only the start-failure path. ⛔ Prove it by forcing a mid-batch server death and confirming the artifact survives — a retention fix that is never observed retaining anything is the same vacuity as a classifier arm that only ever passes. Owner: `tester` (fault injection) + `backend` (script). --- ### ⭐⭐ SECOND FINDING, SAME CLASS — `GATE_EXIT` is lost f…
**Status:** open
**Body:** [FUP-E2E-GATE-DISCARDS-SERVER-LOG-ON-MID-BATCH-DEATH.md](FUP-E2E-GATE-DISCARDS-SERVER-LOG-ON-MID-BATCH-DEATH.md)

### 🟡 FUP-GOTENBERG-EGRESS-UNRESTRICTED — the print sidecar's only mitigation is an application-layer allowlist (owner: backend)

**Filed:** 2026-08-25 (out of PDF·P3 finding C-2. P3 is the first path that puts author-controlled Markdown inside Gotenberg — a headless Chromium on the server network…) · **Owner:** backend · **Severity:** medium — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-GOTENBERG-EGRESS-UNRESTRICTED.md](FUP-GOTENBERG-EGRESS-UNRESTRICTED.md)

### 🟡 FUP-MINT-KIND-TIER-RULE-ONE-DIRECTION — the mint door refuses the wrong tier for one kind and not the other (owner: backend)

**Filed:** 2026-08-25 (QA pass 2 finding N-1. `mint_printed_document`'s `p_contains_phi` defaults to `false`) · **Owner:** backend · **Severity:** medium — per emoji at consolidation
**Closes when:** a `if p_source_kind = 'case' and not coalesce(p_contains_phi,false) then raise` conjunct, so the invariant lives where Rule 1 puts it. ⚠ It is a gate change: it owes a keystone and a diff-scoped door sweep. Not reachable today — and "not reachable" is not "protected", which is why this is filed rather than dropped.
**Status:** open
**Body:** [FUP-MINT-KIND-TIER-RULE-ONE-DIRECTION.md](FUP-MINT-KIND-TIER-RULE-ONE-DIRECTION.md)

### 🟠 FUP-DOSSIER-CAN-SILENTLY-OMIT-CONTENT — a hash-sealed dossier's answer reads swallow their errors (owner: backend)

**Filed:** 2026-08-25 (QA pass 2 finding N-2. Two halves; the second is the one with teeth) · **Owner:** backend · **Severity:** high — per emoji at consolidation
**Closes when:** make the dossier path fail loudly, with a test that a read error produces an error rather than a short document.
**Status:** open
**Body:** [FUP-DOSSIER-CAN-SILENTLY-OMIT-CONTENT.md](FUP-DOSSIER-CAN-SILENTLY-OMIT-CONTENT.md)

### 🟡 FUP-CASE-PRINT-REVISIONS-COMMENTS-CLAIM-ONE-WRITER — a false statement living inside the catalog (owner: backend)

**Filed:** 2026-08-25 (while writing the PDF·P3 entry in `docs/backend-state.md`…) · **Owner:** backend · **Severity:** medium — per emoji at consolidation
**Closes when:** a migration correcting both COMMENTs to name both writers and why the second exists. Cheap, but it is a migration, so it wants a fresh reset and a `test:db` pass behind it. ⚠ Consider at the same time whether a pgTAP assertion can pin the writer set (`pg_get_functiondef` regex over the two schemas), since that is the only thing that could ever contradict the comment.
**Status:** open
**Body:** [FUP-CASE-PRINT-REVISIONS-COMMENTS-CLAIM-ONE-WRITER.md](FUP-CASE-PRINT-REVISIONS-COMMENTS-CLAIM-ONE-WRITER.md)

### 🟠 FUP-E2E-CLEANUP-LEAVES-STORAGE-BYTES — registry rows deleted, PHI-bucket objects left behind (owner: tester + backend)

**Filed:** 2026-08-25 (measured on a tree that had been freshly reset hours earlier: `storage.objects` held 9 `printed/<uuid>.pdf` objects in `documents-phi` while `printed_documents`…) · **Owner:** backend + tester · **Severity:** high — per emoji at consolidation
**Closes when:** (1) make the E2E cleanup delete bytes before (or with) the registry row, and assert the object count returns to baseline — an assertion, not a comment, since the current gap is exactly a cleanup nobody checks. (2) Decide whether a reset should also empty `documents-*`. (3) Check whether the production disposal path can orphan the same way: if a `printed_documents` row is ever deleted rather than revoked, its bytes outlive every control that reaches them by registry. ---
**Status:** open
**Body:** [FUP-E2E-CLEANUP-LEAVES-STORAGE-BYTES.md](FUP-E2E-CLEANUP-LEAVES-STORAGE-BYTES.md)

### 🟡 FUP-DOOR-SWEEP-FULL-RUN-DESTROYS-HAND-MERGED-ANNOTATIONS — the subset half is fixed, the full half is not, and the file is not purely generated (owner: backend; filed 2026-08-26, found while closing the subset half)

**Filed:** 2026-08-26 (found while closing the subset half) · **Owner:** backend · **Severity:** medium — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-DOOR-SWEEP-FULL-RUN-DESTROYS-HAND-MERGED-ANNOTATIONS.md](FUP-DOOR-SWEEP-FULL-RUN-DESTROYS-HAND-MERGED-ANNOTATIONS.md)

### 🟠 FUP-P-CLASS-SQLSTATE-ANSWERS-500-ON-DENIAL — an ordinary authorization denial answers 5xx, across 73 reachable doors (owner: backend; filed 2026-08-26, measured during the AFF4 pre-step)

**Filed:** 2026-08-26 (measured during the AFF4 pre-step) · **Owner:** backend · **Severity:** high — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-P-CLASS-SQLSTATE-ANSWERS-500-ON-DENIAL.md](FUP-P-CLASS-SQLSTATE-ANSWERS-500-ON-DENIAL.md)

### 🟡 FUP-GATE-19-TESTS-NEVER-RAN-ON-MACOS — the failure count understates what went unexercised (owner: lead/tester; filed 2026-08-25)

**Filed:** 2026-08-25 (see body) · **Owner:** lead + tester · **Severity:** medium — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-GATE-19-TESTS-NEVER-RAN-ON-MACOS.md](FUP-GATE-19-TESTS-NEVER-RAN-ON-MACOS.md)

### 🔴 FUP-MEETING-CASES-SELECT-OMITS-RECUSAL — the read policy hand-rolls a weaker predicate than its three siblings (owner: backend/PO; filed 2026-08-26 by the AFF4 lead, found by a peer session auditing `can_reach_meeting`; NOT AFF4's work and not absorbed by it)

**Filed:** 2026-08-26 (by the AFF4 lead, found by a peer session auditing `can_reach_meeting`; NOT AFF4's work and not absorbed by it) · **Owner:** backend + PO · **Severity:** critical — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-MEETING-CASES-SELECT-OMITS-RECUSAL.md](FUP-MEETING-CASES-SELECT-OMITS-RECUSAL.md)

### 🟡 FUP-HOSPITAL-DIRECTORY-EXPIRED-SEAT-STALE-ROSTER — an expired seat still counts a person onto the hospital directory (owner: backend/PO; filed 2026-08-26 at the AFF4 QA round, found by `backend` while ruling the hospital roster predicate)

**Filed:** 2026-08-26 (at the AFF4 QA round, found by `backend` while ruling the hospital roster predicate) · **Owner:** backend + PO · **Severity:** medium — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-HOSPITAL-DIRECTORY-EXPIRED-SEAT-STALE-ROSTER.md](FUP-HOSPITAL-DIRECTORY-EXPIRED-SEAT-STALE-ROSTER.md)

### 🟠 FUP-DOOR-SWEEP-DERIVER-BLIND-TO-ALTER-FUNCTION — a `prosecdef` flip on an existing boolean gate derives ZERO cases and reads as clean (owner: backend/lead; filed 2026-08-26, found by `backend` while fixing BUG-D5-REHIRE-HOSPADMIN-001)

**Filed:** 2026-08-26 (found by `backend` while fixing BUG-D5-REHIRE-HOSPADMIN-001) · **Owner:** lead + backend · **Severity:** high — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-DOOR-SWEEP-DERIVER-BLIND-TO-ALTER-FUNCTION.md](FUP-DOOR-SWEEP-DERIVER-BLIND-TO-ALTER-FUNCTION.md)

### 🟡 FUP-READ-ACCESS-RIDES-ON-A-WRITE-POLICY — `commissions` and `commission_meeting_types` grant tenancy-admin READS from a policy named `…_write` (owner: backend/PO; filed 2026-08-27 by `backend` at the AE1.5 triage, PO-ruled the same day)

**Filed:** 2026-08-27 (by `backend` at the AE1.5 triage, PO-ruled the same day) · **Owner:** backend + PO · **Severity:** medium — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-READ-ACCESS-RIDES-ON-A-WRITE-POLICY.md](FUP-READ-ACCESS-RIDES-ON-A-WRITE-POLICY.md)

### 🟡 FUP-ZERO-ARG-APP-PREDICATES-NOT-HOISTED — the advisor's initplan rule is blind to `app.*()`, so zero-argument RLS predicates are still evaluated per row (owner: backend; filed 2026-08-27 by `backend` at the AE1.5 triage, PO-scoped the same day)

**Filed:** 2026-08-27 (by `backend` at the AE1.5 triage, PO-scoped the same day) · **Owner:** backend · **Severity:** medium — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-ZERO-ARG-APP-PREDICATES-NOT-HOISTED.md](FUP-ZERO-ARG-APP-PREDICATES-NOT-HOISTED.md)

### 🟡 FUP-QA-FINDINGS-N3-N4-UNACCOUNTED — two QA findings have ZERO hits in the live register (owner: lead; rotated from the Now section of PROGRESS.md (retired 2026-09-03, ADR 0185) on 2026-08-27, measured 2026-08-26)

**Filed:** 2026-09-02 (ad-hoc: PROGRESS.md consolidation 2026-09-02) · **Owner:** lead · **Severity:** medium — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-QA-FINDINGS-N3-N4-UNACCOUNTED.md](FUP-QA-FINDINGS-N3-N4-UNACCOUNTED.md)

### 🟠 FUP-AE4-PERFORMANCE-EVIDENCE-ON-THE-FINAL-PATH — the AE4.4 measurement was never made, and it only became MEASURABLE at AE4.9 D6 (owner: backend; filed 2026-09-02 by `lead`, from audit finding IA-F9)

**Filed:** 2026-09-02 (by `lead`, from audit finding IA-F9) · **Owner:** backend · **Severity:** high — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-AE4-PERFORMANCE-EVIDENCE-ON-THE-FINAL-PATH.md](FUP-AE4-PERFORMANCE-EVIDENCE-ON-THE-FINAL-PATH.md)

### 🟠 FUP-ADR-CROSS-LINKS-HAVE-NO-GATE — 13 broken ADR-to-ADR links, and gate 9 structurally cannot see them (owner: lead/backend; filed 2026-09-02 by `lead`, measured during AE4.9 D6)

**Filed:** 2026-09-02 (by `lead`, measured during AE4.9 D6) · **Owner:** lead + backend · **Severity:** high — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-ADR-CROSS-LINKS-HAVE-NO-GATE.md](FUP-ADR-CROSS-LINKS-HAVE-NO-GATE.md)

### 🟠 FUP-DIFF-SCOPED-SWEEP-IS-HALF-AIMED — the mandated per-phase sweep had a FOUR-part hole: the deriver names ONE arm for a TWO-arm list; arm 2 reports success at exit 0 having measured nothing; 9 policies fall outside both arms; and a killed run leaves an RLS policy WIDE OPEN with nothing reporting it (owner: backend/lead; filed 2026-08-27 by `backend`, all four measured during AE1.5)

**Filed:** 2026-08-27 (by `backend`, all four measured during AE1.5) · **Owner:** lead + backend · **Severity:** high — per emoji at consolidation
**Closes when:** either a documented recovery step ("if you kill a run, do X"), or a restore that does not depend on a signal-catchable trap. Until then the operational rule is: a contaminated run must be allowed to FINISH and its verdicts discarded — never killed. ⛔ And the contamination surface is the WORKING TREE, not the database. The baseline is the suite's SHAPE (`Files=`/`Tests=`), so adding a test file invalidates a sweep exactly as effectively as touching the DB — and nothing about d…
**Status:** open
**Body:** [FUP-DIFF-SCOPED-SWEEP-IS-HALF-AIMED.md](FUP-DIFF-SCOPED-SWEEP-IS-HALF-AIMED.md)

### 🟡 FUP-AE1-UNREACHABLE-PUBLIC-DOORS — 11 `public` DEFINER doors `authenticated` can call that nothing in `src/` calls, + 3 no instrument references, + 15 comment-only (owner: backend/PO)

**Filed:** 2026-08-27 (at the AE1 Record step (obligation 2), from RV4 of [authz-definer-classification-ae1.md](../design/authz-definer-classification-ae1.md)…) · **Owner:** backend + PO · **Severity:** medium — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-AE1-UNREACHABLE-PUBLIC-DOORS.md](FUP-AE1-UNREACHABLE-PUBLIC-DOORS.md)

### 🟡 FUP-AUDIT-ACTOR-ID-NULL-ON-SERVICE-DOORS — `actor_id` is NULL on every audit row a service-role door emits (owner: backend/PO)

**Filed:** 2026-09-02 (ad-hoc: PROGRESS.md consolidation 2026-09-02) · **Owner:** backend + PO · **Severity:** medium — per emoji at consolidation
**Closes when:** PO to rule
**Status:** parked
**Revisit when:** PO to rule
**Body:** [FUP-AUDIT-ACTOR-ID-NULL-ON-SERVICE-DOORS.md](FUP-AUDIT-ACTOR-ID-NULL-ON-SERVICE-DOORS.md)

### 🟠 FUP-SERVICE-ROLE-WRITE-SITES-NO-GUARD-VANISH-TEST — 19 of 44 service-role write sites have no test that would notice their guard vanish (owner: backend/tester)

**Filed:** 2026-08-27 (at the AE1 Record step (obligation 4, AE1.4)) · **Owner:** backend + tester · **Severity:** high — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-SERVICE-ROLE-WRITE-SITES-NO-GUARD-VANISH-TEST.md](FUP-SERVICE-ROLE-WRITE-SITES-NO-GUARD-VANISH-TEST.md)

### 🟡 FUP-REACTIVATE-USER-HAS-NO-DENY-ARM — the reactivate path's authority is proven only by its sibling's deny test (owner: backend/tester)

**Filed:** 2026-08-27 (at the AE1 Record step (obligation 6, AE1.4)) · **Owner:** backend + tester · **Severity:** medium — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-REACTIVATE-USER-HAS-NO-DENY-ARM.md](FUP-REACTIVATE-USER-HAS-NO-DENY-ARM.md)

### 🟡 FUP-MUTATION-AUDIT-BLIND-TO-THE-DOOR-WRAPPERS — the AE1.3 audit mutates the six `app.*_impl` kernels and nothing mutates a `public.*_for` body (owner: backend)

**Filed:** 2026-08-27 (at the AE1 Record step (obligation 9, AE1.3 gate record)) · **Owner:** backend · **Severity:** medium — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-MUTATION-AUDIT-BLIND-TO-THE-DOOR-WRAPPERS.md](FUP-MUTATION-AUDIT-BLIND-TO-THE-DOOR-WRAPPERS.md)

### 🟠 FUP-DOOR-SWEEP-DERIVER-SPANS-THE-WHOLE-WORKING-TREE — a diff-scoped sweep for one increment silently selects another increment's cases (owner: backend/lead)

**Filed:** 2026-08-27 (at the AE1 Record step (obligation 10, AE1.3 gate record)) · **Owner:** lead + backend · **Severity:** high — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-DOOR-SWEEP-DERIVER-SPANS-THE-WHOLE-WORKING-TREE.md](FUP-DOOR-SWEEP-DERIVER-SPANS-THE-WHOLE-WORKING-TREE.md)

### 🟠 FUP-RLS-BOUND-READ-REPOINTED-TO-A-NARROWER-AUDIENCE — a shipped, unexercised instance in `listOrgUsers`, and the census class that cannot see it (owner: backend)

**Filed:** 2026-09-02 (ad-hoc: PROGRESS.md consolidation 2026-09-02) · **Owner:** backend · **Severity:** high — per emoji at consolidation
**Closes when:** (1) decide whether `listOrgUsers`' exposure is fixed now or when C-b′ lands for its sibling — they are the same shape and one fix likely serves both; (2) a pin that is a property of the query rather than of one call site (`org-roster-predicate.test.ts:186` pins the old predicate's absence for `listOrgUsers` only, and its own comment concedes the over-claim); (3) state whether the audience-comparison pass becomes a standing step for re-pointings, or stays advice.
**Status:** open
**Body:** [FUP-RLS-BOUND-READ-REPOINTED-TO-A-NARROWER-AUDIENCE.md](FUP-RLS-BOUND-READ-REPOINTED-TO-A-NARROWER-AUDIENCE.md)

### 🟠 FUP-FINDINGS-MD-PIPE-TABLE-MANUFACTURES-VERDICTS — a prose table inflates `ARM=census` and MASKS a real newcomer (owner: backend)

**Filed:** 2026-09-02 (ad-hoc: PROGRESS.md consolidation 2026-09-02) · **Owner:** backend · **Severity:** high — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-FINDINGS-MD-PIPE-TABLE-MANUFACTURES-VERDICTS.md](FUP-FINDINGS-MD-PIPE-TABLE-MANUFACTURES-VERDICTS.md)

### 🟡 FUP-AE2-CATALOG-SUPERSET-OF-CHAIN — a hand-applied migration makes the live catalog a SUPERSET of the migration chain, and no gate can see it (owner: backend/PO)

**Filed:** 2026-09-02 (ad-hoc: PROGRESS.md consolidation 2026-09-02) · **Owner:** backend + PO · **Severity:** medium — per emoji at consolidation
**Closes when:** (a) decide whether any cheap positive control exists — e.g. a gate-time assertion that a freshly reset catalog and the working stack agree on a hash of `pg_proc` + `pg_policies` + ACLs for the objects a phase touched; (b) if no such control is affordable, make the prohibition explicit where the action is taken (a `.claude/rules/` entry scoped to `supabase/migrations/`, alongside `push-schema-before-code`), because a warning is only as good as its position relative to the acti…
**Status:** open
**Body:** [FUP-AE2-CATALOG-SUPERSET-OF-CHAIN.md](FUP-AE2-CATALOG-SUPERSET-OF-CHAIN.md)

### 🟠 FUP-W1-STALE-GRANTROLE-MUTANTS — three mutants pinned to a signature that no longer exists: a harness that CANNOT FAIL, reported as one that cannot run (owner: backend)

**Filed:** 2026-09-02 (ad-hoc: PROGRESS.md consolidation 2026-09-02) · **Owner:** backend · **Severity:** high — per emoji at consolidation
**Closes when:** re-point all three at `app.grant_role_impl` and the current spelling, then prove each RED before accepting the file's verdict again. ⚠ Do not merely make them run — a mutant that runs and holds is exactly what the current state already claims.
**Status:** open
**Body:** [FUP-W1-STALE-GRANTROLE-MUTANTS.md](FUP-W1-STALE-GRANTROLE-MUTANTS.md)

### 🟡 FUP-W3-ACL-KEYSTONE-NOT-PROVEN — an ACL keystone defended by something other than its ACL (owner: backend)

**Filed:** 2026-09-02 (ad-hoc: PROGRESS.md consolidation 2026-09-02) · **Owner:** backend · **Severity:** medium — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-W3-ACL-KEYSTONE-NOT-PROVEN.md](FUP-W3-ACL-KEYSTONE-NOT-PROVEN.md)

### 🟡 FUP-REVALIDATE-PATH-NAMES-A-ROUTE-THAT-DOES-NOT-EXIST — the coordinator page is never revalidated (owner: frontend)

**Filed:** 2026-09-02 (ad-hoc: PROGRESS.md consolidation 2026-09-02) · **Owner:** frontend · **Severity:** medium — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-REVALIDATE-PATH-NAMES-A-ROUTE-THAT-DOES-NOT-EXIST.md](FUP-REVALIDATE-PATH-NAMES-A-ROUTE-THAT-DOES-NOT-EXIST.md)

### 🟠 FUP-AE2-397-DENY-CELLS-SQLSTATE-ONLY — `397 §§ 2/3`'s ten deny cells assert SQLSTATE only, in the suite that documents having been bitten by exactly that (owner: backend; filed 2026-08-28 by QA r3 F1)

**Filed:** 2026-08-28 (by QA r3 F1) · **Owner:** backend · **Severity:** high — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-AE2-397-DENY-CELLS-SQLSTATE-ONLY.md](FUP-AE2-397-DENY-CELLS-SQLSTATE-ONLY.md)

### 🟡 FUP-AE2-TEST-HARDENING-R3 — two small anti-vacuity gaps QA r3 found (owner: backend; filed 2026-08-28, QA r3 F3+F4)

**Filed:** 2026-08-28 (QA r3 F3+F4) · **Owner:** backend · **Severity:** medium — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open

1. `400 § 4.2` asserts `23514` with `errmsg = null`, and that code has **two arms** in the guard — so
   the cell cannot say which raised.
2. Several `lives_ok` accept cells lack the **write-through twin their own files mandate**. Bounded
   rather than open-ended: QA r3 checked that `393`'s fixture ids currently all match, so no cell is
   silently passing today.

### 🟡 FUP-AE2-392-FILENAME-CLAIMS-A-DIFFERENTIAL — `392_ae23a_widening_differential.sql` contains no differential (owner: backend/lead; filed 2026-08-28 by QA r3 F6)

**Filed:** 2026-08-28 (by QA r3 F6) · **Owner:** lead + backend · **Severity:** medium — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open

After the AE2 re-cut the file is a suite about the NEW person-read predicate; its **name still asserts
a differential**. Deliberately **not** renamed during the drop increment, and QA r3 verified the
reason holds: `docs/reviews/authz-door-audit-findings.md` keys its witness lists on **full
filenames** (confirmed live, 4 occurrences), so a rename **orphans name-keyed verdicts** — and doing
it inside a 50-file integration window adds a deletion to an already-large change.

⛔ **This line exists because the deferral's only record was the phase document, which the Record step
rotates away.** A deferral whose reasoning survives only in rotated narrative is indistinguishable
from an oversight — QA r3 F6 raised exactly that. **Rename and re-point the findings witnesses in the
same commit, or not at all.**

### 🟠 FUP-AE2-VOID-LAST-ORG-AFFILIATION-UNMAPPED — the containment trigger's `23514` reaches the user as "tente novamente", and the guard that looks like it covers this is bounded to DOORS (owner: backend; filed 2026-08-31 from the AE2.4 residue the plan said to assign before the drop)

**Filed:** 2026-08-31 (from the AE2.4 residue the plan said to assign before the drop) · **Owner:** backend · **Severity:** high — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-AE2-VOID-LAST-ORG-AFFILIATION-UNMAPPED.md](FUP-AE2-VOID-LAST-ORG-AFFILIATION-UNMAPPED.md)

### 🟠 FUP-NO-GATE-REPRODUCES-DOCKER-CONTEXT — a `src/` file importing across a `.dockerignore` boundary is green on EVERY local gate and red only on the build server (owner: backend/lead; filed 2026-09-01 from the AE3 cutover deploy failure)

**Filed:** 2026-09-01 (from the AE3 cutover deploy failure) · **Owner:** lead + backend · **Severity:** high — per emoji at consolidation
**Closes when:** A cheap gate that resolves every `src/` import against the *docker context* rather than the working tree — not a full image build. ⚠ Do not close it by deleting the exclusion: the layer-invalidation rationale for excluding `scripts/` is still correct for its other ~40 files.
**Status:** open
**Body:** [FUP-NO-GATE-REPRODUCES-DOCKER-CONTEXT.md](FUP-NO-GATE-REPRODUCES-DOCKER-CONTEXT.md)

### 🟡 FUP-DBPUSH-SWALLOWS-NOTICE — the AE3 runbook's step-4 safety read is unexecutable through the command the runbook prescribes (owner: lead; filed 2026-09-01 from the AE3 cutover)

**Filed:** 2026-09-01 (from the AE3 cutover) · **Owner:** lead · **Severity:** medium — per emoji at consolidation
**Closes when:** Replace step 4's instruction with a post-push catalog query whose expected values are computed *before* the push (as was done here: 36 profiles / 5 cpf / 0 dob / 0 phone → expect `ppd_rows = 5`), so the read is an assertion against a prediction rather than a number to eyeball. ⚠ The same defect is latent in any runbook step that says to read a `raise notice`.
**Status:** open
**Body:** [FUP-DBPUSH-SWALLOWS-NOTICE.md](FUP-DBPUSH-SWALLOWS-NOTICE.md)

### 🟡 FUP-SEED-PENDING-PERSONA-CANNOT-REACH-ITS-LAYER

**Filed:** 2026-09-01 (AE4.5, out of the deny-class effect table) · **Owner:** backend · **Severity:** medium — a fixture defect, not a product defect.
**Closes when:** either align the mirror at the seed (its own increment), or add a comment beside the persona stating that it models the *profiles-mirror* state only and cannot be used for auth-layer assertions.
**Status:** open
**Body:** [FUP-SEED-PENDING-PERSONA-CANNOT-REACH-ITS-LAYER.md](FUP-SEED-PENDING-PERSONA-CANNOT-REACH-ITS-LAYER.md)

### 🟠 FUP-CAN-MANAGE-PROFESSIONAL-SELF-CHECK-ARM

**Filed:** 2026-09-01 (AE4.5, alongside BUG-PROF-INACTIVE-001) · **Owner:** backend · **Severity:** high — a distinct authorization defect in the same predicate, deliberately NOT fixed
**Closes when:** PO's, once BUG-PROF-INACTIVE-001 is green.
**Status:** open
**Body:** [FUP-CAN-MANAGE-PROFESSIONAL-SELF-CHECK-ARM.md](FUP-CAN-MANAGE-PROFESSIONAL-SELF-CHECK-ARM.md)

### 🟠 FUP-ONE-SUPABASE-PROJECT-SERVES-TEST-AND-PRODUCTION — the "prod project" the archive defers to does not exist (owner: PO decision, then lead)

**Filed:** 2026-09-01 (out of ADR [0175](../decisions/0175-ae4-po-batch-oracle-inputs-and-arm3-deferral.md) D4(b)) · **Owner:** lead + PO · **Severity:** high — per emoji at consolidation
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-ONE-SUPABASE-PROJECT-SERVES-TEST-AND-PRODUCTION.md](FUP-ONE-SUPABASE-PROJECT-SERVES-TEST-AND-PRODUCTION.md)

### 🔴 FUP-AE4-MANIFEST-HAS-NO-SITE-AXIS-CLOSURE — the enforcement manifest checks set difference on the PERMISSION axis only, so a declared-but-unre-keyed site cannot red

**Filed:** 2026-09-02 (Gate AE4 QA review, finding F-BLOCK-1's mechanism) · **Owner:** lead + backend · **Severity:** critical — ADR [0176](../decisions/0176-authz-permission-layer-made-real.md) D5 says generation "fails on set difference in either direction". On the **site** axis it does not fail in either direction, and that is not a gap in coverage but a false claim in the decision record.
**Closes when:** A generated check, in both directions, over the site axis: every `enforcementSites` entry resolves to a catalog object that carries the row's permission literal, and every catalog object carrying that literal appears in exactly one row. It must be proven able to red — remove one site from a row and the gate must fail; add a spurious one and it must fail the other way.
**Status:** open
**Body:** [FUP-AE4-MANIFEST-HAS-NO-SITE-AXIS-CLOSURE.md](FUP-AE4-MANIFEST-HAS-NO-SITE-AXIS-CLOSURE.md)

### 🟠 FUP-AE4-ORACLE-APPROVAL-SCOPE-STATED-THREE-WAYS — the regression oracle cites its own PO approval at 42, 33 and 43 rows

**Filed:** 2026-09-02 (Gate AE4 QA review, finding F-BLOCK-3) · **Owner:** lead · **Severity:** high — the oracle is sound; what is unciteable is its **approval scope**, and an approval's scope is a fact that has to be written down once.
**Closes when:** One sentence, PO-confirmed, naming the count approved, the date, and what the delta rows are — then every other statement of it deleted rather than corrected, so a fourth cannot appear.
**Status:** open
**Body:** [FUP-AE4-ORACLE-APPROVAL-SCOPE-STATED-THREE-WAYS.md](FUP-AE4-ORACLE-APPROVAL-SCOPE-STATED-THREE-WAYS.md)

### 🟠 FUP-AE4-HARDDENY-CLASSES-CANNOT-FAIL — `hardDenyClasses` is empty on all 43 rows and the lint arm that checks it iterates zero times

**Filed:** 2026-09-02 (Gate AE4 QA review, finding F-MAJOR-1) · **Owner:** backend · **Severity:** high — a check that structurally cannot return the failing verdict is not a check; it is a green that reads like one.
**Closes when:** Either populate `hardDenyClasses` from the catalog so the arm has something to iterate, or replace the loop with an assertion that can fail on the empty case — plus a discrimination control for §6.2, anchored on a class known to be present, and its search depth raised past the one hop that currently hides `app.is_active`.
**Status:** open
**Body:** [FUP-AE4-HARDDENY-CLASSES-CANNOT-FAIL.md](FUP-AE4-HARDDENY-CLASSES-CANNOT-FAIL.md)

### 🟠 FUP-WRITEPATH-FINDINGS-FILE-COVERS-33-OF-107 — the committed findings baseline predates the domain fix, and `FROMFINDINGS` arms structurally cannot notice

**Filed:** 2026-09-02 (write-arm re-aim, commit `d2069603`) · **Owner:** backend · **Severity:** high — the gap is invisible to precisely the cheap arm the phase gate runs.
**Closes when:** One full write-path sweep over the widened domain, with its rows merged into the committed findings file — not replacing it, since the 33 carry hand-merged annotations.
**Status:** open
**Body:** [FUP-WRITEPATH-FINDINGS-FILE-COVERS-33-OF-107.md](FUP-WRITEPATH-FINDINGS-FILE-COVERS-33-OF-107.md)

### 🟠 FUP-STORAGE-OBJECTS-INSERT-POLICIES-NEWLY-IN-DOMAIN — three policies that were in no arm's domain may return BLIND on their first sweep

**Filed:** 2026-09-02 (write-arm re-aim, commit `d2069603`) · **Owner:** backend · **Severity:** high — a first measurement of a never-measured population is where real findings live.
**Closes when:** Sweep them and record a verdict per policy.
**Status:** open
**Body:** [FUP-STORAGE-OBJECTS-INSERT-POLICIES-NEWLY-IN-DOMAIN.md](FUP-STORAGE-OBJECTS-INSERT-POLICIES-NEWLY-IN-DOMAIN.md)

### 🟠 FUP-PERF-ANALYZE-ENDS-AE0-COMPARABILITY — the AE4 performance acceptance and the AE0.2 baselines cannot coexist on one instance

**Filed:** 2026-09-02 (IA-F9 staging, commit `82613268`) · **Owner:** lead + backend · **Severity:** high — it destroys a baseline silently, and the destruction is invisible until someone tries to compare.
**Closes when:** Sequence the DB window so no AE0 comparison is owed after the perf run, and say so in the window's plan; or re-base AE0.2 onto an analysed instance, which is its own decision.
**Status:** open
**Body:** [FUP-PERF-ANALYZE-ENDS-AE0-COMPARABILITY.md](FUP-PERF-ANALYZE-ENDS-AE0-COMPARABILITY.md)

### 🟡 FUP-DOOR-AUDIT-ALL-POLICY-COVERED-IS-MIRROR-AMBIGUOUS — a read-arm COVERED on a `FOR ALL` policy can be earned by a write keystone

**Filed:** 2026-09-02 (write-arm re-aim; the file is not that agent's to change) · **Owner:** backend · **Severity:** medium — it weakens what a read COVERED means; it opens nothing.
**Closes when:** Either open the halves separately in the read arm too, or record per verdict which half the keystone exercised.
**Status:** open
**Body:** [FUP-DOOR-AUDIT-ALL-POLICY-COVERED-IS-MIRROR-AMBIGUOUS.md](FUP-DOOR-AUDIT-ALL-POLICY-COVERED-IS-MIRROR-AMBIGUOUS.md)

### 🟡 FUP-AUDIT-REGISTRY-CONSUMER-OF-READ-AUTHORIZER-UNRECORDED — `app._audit_access_authorized` routes a permission to a re-keyed authorizer and appears in no manifest row

**Filed:** 2026-09-02 (rollback runbook §6, commit `3634a3ad`) · **Owner:** backend · **Severity:** medium — correct as it stands; what is missing is the record that it exists.
**Closes when:** A named note wherever the authorizer's consumers are enumerated — the manifest row's qualifier, or `../backend-state.md`'s authz section — saying the audit registry is a consumer and is deliberately not an enforcement site.
**Status:** open
**Body:** [FUP-AUDIT-REGISTRY-CONSUMER-OF-READ-AUTHORIZER-UNRECORDED.md](FUP-AUDIT-REGISTRY-CONSUMER-OF-READ-AUTHORIZER-UNRECORDED.md)

### 🟠 FUP-C2-NEUTRALIZER-ANCHOR-BLIND-TO-HCDS-AND-28000 — the C2 neutralizer's anchor is a SYNTAX, not a property: it excludes the DSR authz family AND sweeps in non-authz state guards, so "458 authz raises" is wrong in both directions

**Filed:** 2026-09-02 (C2 Tier-1 full sweep, pre-flight audit of the running harness) · **Owner:** lead + backend · **Severity:** high — a measurement-domain gap, not a demonstrated live hole
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-C2-NEUTRALIZER-ANCHOR-BLIND-TO-HCDS-AND-28000.md](FUP-C2-NEUTRALIZER-ANCHOR-BLIND-TO-HCDS-AND-28000.md)

### 🟠 FUP-C2-NEUTRALIZER-TAIL-DRIFT-INVALIDATES-LATE-VERDICTS — a long sweep degrades its own DB, and the harness's baseline is captured once at the top

**Filed:** 2026-09-02 (C2 Tier-1 full sweep, run 1 — observed in its final three enforcers) · **Owner:** backend · **Severity:** high — it cost no wrong verdict *this* run (the harness caught it
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-C2-NEUTRALIZER-TAIL-DRIFT-INVALIDATES-LATE-VERDICTS.md](FUP-C2-NEUTRALIZER-TAIL-DRIFT-INVALIDATES-LATE-VERDICTS.md)

### 🟠 FUP-C2-SUITE-ABORT-ERROR-CLASS — 16 enforcers abort a pgTAP file when neutralized, so they finish the sweep with no verdict

**Filed:** 2026-09-02 (C2 Tier-1 full sweep, run 1) · **Owner:** backend · **Severity:** high — 16 doors with **no** coverage verdict, including the response-lifecycle authority.
**Closes when:** PO to rule
**Status:** open
**Body:** [FUP-C2-SUITE-ABORT-ERROR-CLASS.md](FUP-C2-SUITE-ABORT-ERROR-CLASS.md)

### 🟠 FUP-DOOR-SWEEP-DOMAIN-MISSES-THE-AUTHZ-RESOLVERS — two `prosecdef` boolean authorization resolvers are in NEITHER sweep arm's domain, so neither arm can ever select them

**Filed:** 2026-09-03 (AE4 `authz.scope_reaches` fix increment, 2026-09-02 — ADR [0180](../decisions/0180-scope-reaches-commission-org-ascent-plan-fix.md) · **Owner:** lead + backend · **Severity:** high — a standing gate has a hole in its domain, on the
**Closes when:** Either (a) widen `PRED_DOMAIN` so a `prosecdef` boolean in the `authz` schema is in domain by virtue of its schema — and re-baseline the findings file, since `PRED_TOTAL` moves; or (b) rule explicitly that the resolver family is swept by targeted cases instead, and give those cases a committed home so they run on a schedule rather than when someone remembers. Either way `candidate_has_permission` owes a first verdict.
**Status:** open
**Body:** [FUP-DOOR-SWEEP-DOMAIN-MISSES-THE-AUTHZ-RESOLVERS.md](FUP-DOOR-SWEEP-DOMAIN-MISSES-THE-AUTHZ-RESOLVERS.md)

### 🟡 FUP-PROFESSIONAL-PARTICIPANTS-SELECT-STILL-PER-ROW — the second policy on the same authorizer was NOT converted, and it cannot serve as a control either

**Filed:** 2026-09-03 (AE4 / IA-F9 statement-scoped increment, `20261003007320` — ADR [0182](../decisions/0182-statement-scoped-authorized-scope-ids.md) · **Owner:** lead + backend · **Severity:** medium — a known, bounded residual with no failing condition
**Closes when:** Either convert it to the same statement-scoped arm (it needs its own candidate map, because the policy's column is `professional_profile_id`, not `organization_id` — the set would have to be a set of profile ids or the predicate would need a join), or rule explicitly that a ≤ 20-row per-row evaluation is accepted and record the bound as a product invariant with something that reds when the page size grows.
**Status:** open
**Body:** [FUP-PROFESSIONAL-PARTICIPANTS-SELECT-STILL-PER-ROW.md](FUP-PROFESSIONAL-PARTICIPANTS-SELECT-STILL-PER-ROW.md)

### 🟠 FUP-DOOR-SWEEP-DOMAIN-GAP-WIDENED-BY-SET-VALUED-RESOLVERS — three more authorization functions are outside `PRED_DOMAIN`, this time by RETURN TYPE

**Filed:** 2026-09-03 (diff-scoped door sweep, AE4 `20261003007320` — ADR [0182](../decisions/0182-statement-scoped-authorized-scope-ids.md) · **Owner:** lead + backend · **Severity:** high — same class and same reason as
**Closes when:** Extend `PRED_DOMAIN` along the return-type axis (a `prosecdef` function in `authz`, or one whose result is a scope-id set consumed by a policy, is in domain regardless of `typname`) and re-baseline the findings file; or rule that set-valued resolvers are swept by targeted cases and give those cases a committed home so they run on a schedule. Either way this should be resolved together with `FUP-DOOR-SWEEP-DOMAIN-MISSES-THE-AUTHZ-RESOLVERS` — they are one apparatus gap with tw…
**Status:** open
**Body:** [FUP-DOOR-SWEEP-DOMAIN-GAP-WIDENED-BY-SET-VALUED-RESOLVERS.md](FUP-DOOR-SWEEP-DOMAIN-GAP-WIDENED-BY-SET-VALUED-RESOLVERS.md)

### 🟡 FUP-NO-GATE-CATCHES-A-COLLAPSED-SEARCH-PATH — a `SET search_path` that silently resolves to nothing passes every gate in the chain

**Filed:** 2026-09-03 (QA review of the AE4/IA-F9 statement-scoped increment — ADR [0182](../decisions/0182-statement-scoped-authorized-scope-ids.md) · **Owner:** lead + backend · **Severity:** medium — the whole known population is
**Closes when:** A `lint:*` gate (or a pgTAP catalog assertion, which is cheaper — it needs no new script and the DB is already the authority) asserting that for every `prosecdef` function in `app`/`public`/`authz`, `proconfig`'s `search_path` either is the empty form or splits into schemas that all exist in `pg_namespace`. ⛔ Text-matching for a quote is the *symptom*; the property is *"every named schema resolves"*.
**Status:** open
**Body:** [FUP-NO-GATE-CATCHES-A-COLLAPSED-SEARCH-PATH.md](FUP-NO-GATE-CATCHES-A-COLLAPSED-SEARCH-PATH.md)

### 🟠 FUP-PRIVILEGE-BUDGET-CEILING-BREACHED-BY-SEVEN — the `authenticated`-executable DEFINER budget is 759 against a ceiling of 752, and six of the seven are unattributed

**Filed:** 2026-09-03 (AE4/IA-F9 statement-scoped increment — found while recording the one function that increment adds…) · **Owner:** lead + PO · **Severity:** high — the budget's whole purpose is that it may not rise silently,
**Closes when:** Attribute the six — diff the `authenticated`-executable DEFINER set between head `…005300` and head `…007330` (the query above, run against each), name each function and the increment that added it — then put the aggregate to the PO: either the ceiling moves by ruling to the justified number, or the unjustified grants are revoked. ⭐ A gate would be cheap and is the durable form: the count is one query, and a `lint:*` step that reds when it exceeds a committed figure converts …
**Status:** open
**Body:** [FUP-PRIVILEGE-BUDGET-CEILING-BREACHED-BY-SEVEN.md](FUP-PRIVILEGE-BUDGET-CEILING-BREACHED-BY-SEVEN.md)

### 🟡 FUP-AE4-CANDIDATE-SCOPE-FANOUT-IS-UNBOUNDED — the statement-scoped resolver costs `(1 + D) × O(M)` per statement, and nothing states or watches `D`

**Filed:** 2026-09-03 (external audit of the AE4/IA-F9 statement-scoped increment, finding 1…) · **Owner:** lead + backend · **Severity:** medium — a known, bounded residual with no failing condition driving it, and the measured
**Closes when:** Either a stated ceiling on `D` per principal with something that reds when it is exceeded, or a ruling that the org→hospital→commission tenancy model makes a large `D` unreachable in practice — recorded together with the census that shows it, so the next reader does not have to re-measure to find out whether anyone ever checked.
**Status:** open
**Body:** [FUP-AE4-CANDIDATE-SCOPE-FANOUT-IS-UNBOUNDED.md](FUP-AE4-CANDIDATE-SCOPE-FANOUT-IS-UNBOUNDED.md)

### 🟠 FUP-SCOPE-REACHES-HOSPITALS-SEQ-SCAN — `authz.scope_reaches` seq-scans the whole `hospitals` table on every call, and it is the only authz cost that grows with tenant count

**Filed:** 2026-09-02 (IA-F9 performance acceptance, runs 2–4) · **Owner:** backend · **Severity:** high — not a correctness or authorization defect; a scaling one, on the path every protected row takes, that gets worse as the platform onboards customers.
**Closes when:** A migration re-planning the ascent as PK lookups, with its own plan approval, its own keystone, and the diff-scoped door sweep on both arms — it is a `SECURITY DEFINER` function on the authorization path. Then the acceptance re-run against it.
**Status:** open
**Body:** [FUP-SCOPE-REACHES-HOSPITALS-SEQ-SCAN.md](FUP-SCOPE-REACHES-HOSPITALS-SEQ-SCAN.md)

### 🔴 FUP-AUTHZ-AE3-CUTOVER-OPERATOR-OBLIGATIONS-OWED — the AE3 cutover left two operator obligations undischarged: rotate the remote DB password, and destroy the preimage together with its passphrase

**Filed:** 2026-09-03 (the Now section of PROGRESS.md retiring, ADR 0185 D6 — the bullet was written 2026-09-01 at the AE3 cutover) · **Owner:** PO · **Severity:** critical — a remote DB password treated as exposed must not reach the pilot; PO to confirm the level
**Closes when:** both actions are done and each is recorded with a date in `../deployment/ae3-cutover-runbook.md`; destroying one of the two artifacts without the other discharges nothing.
**Status:** open

Verbatim from the Now section of PROGRESS.md (retired 2026-09-03, ADR 0185; bullet dated 2026-09-01): *AE3 cutover complete — schema-first discharged end to end: 5 migrations applied → catalog-verified on the remote → `git push main` → Coolify green (after one build break, `a12b7c1d`) → § 3 smoke PASSED. Narrative + every figure → [2026-Q3.md](../progress/2026-Q3.md); runbook → [ae3-cutover-runbook.md](../deployment/ae3-cutover-runbook.md). ⛔ TWO CLOSING OBLIGATIONS STILL OWED — the operator's, not a session's: (1) ROTATE THE REMOTE DB PASSWORD (§ 4.1 — typed on a workstation during an incident-shaped procedure; treat it as exposed rather than reasoning about whether it was), (2) DESTROY `~/ae3-preimage.csv.gpg` TOGETHER WITH ITS PASSPHRASE (destroying one without the other discharges nothing).* ⚠ **Neither leaves an artifact in the tree — no gate, and no later session, can notice they were skipped.** This entry is the only witness now that PROGRESS.md's Now section is retired.

### 🟢 FUP-ENV-LINT-AUTHZ-VECTORS-NEEDS-PYTHON3 — gate 12 shells `python3`; a host with only `python` on PATH reds `npm run lint`

**Filed:** 2026-09-03 (the Now section of PROGRESS.md retiring, ADR 0185 D6 — the fact was recorded at the C2 merge on 2026-09-03) · **Owner:** lead · **Severity:** low — a toolchain prerequisite recorded nowhere but a rotated bullet
**Closes when:** `../lint-gates.md` (`lint:authz-vectors`) and `../worktrees.md` name `python3` as a host dependency, or the script falls back to `python`.
**Status:** open

Verbatim from the Now section of PROGRESS.md (retired 2026-09-03, ADR 0185): *Gate 12 now shells `python3` (C2's fix — `python` does not exist on macOS/modern Linux); verified working on this Windows host (`python3` → 3.14.3), but it is a NEW host dependency and a machine carrying only `python` on PATH now REDS gate 12.* Measured: `package.json` `lint:authz-vectors` = `… && python3 scripts/gen-authz-differential-cells.py --check`.

### 🟢 FUP-ENV-STALE-ORIGIN-BRANCH-C2-TIER1-NEUTRALIZER — `c2-tier1-neutralizer` may still exist on origin, 105+ commits behind, carrying only a resume handoff

**Filed:** 2026-09-03 (the Now section of PROGRESS.md retiring, ADR 0185 D6 — recorded 2026-09-02 in PO ruling 1) · **Owner:** lead · **Severity:** low — a trap for whoever reaches for the C2-sounding name, not a defect
**Closes when:** `git ls-remote --heads origin c2-tier1-neutralizer` returns nothing, or the branch is retired deliberately with a note.
**Status:** open

Verbatim from the Now section of PROGRESS.md (retired 2026-09-03, ADR 0185): *`c2-tier1-neutralizer` still exists locally and on origin, 105 commits behind, carrying only a resume handoff — the neutralizer itself is already in AE4 (`66b31cd1`). It is a trap for whoever reaches for the C2-sounding name; delete it or retire it deliberately.* Measured 2026-09-03: absent from `git branch --list` locally; origin **unmeasured**.

### 🟡 FUP-ENV-NVM-DEFAULT-NODE-20-KILLS-GATE-8 — nvm still defaults to Node 20 on the dev machine, and `npm run lint` dies at gate 8 there

**Filed:** 2026-09-03 (the Now section of PROGRESS.md retiring, ADR 0185 D6 — the bullet dates from 2026-08-25, corrected 2026-08-31) · **Owner:** lead · **Severity:** medium — the lint chain aborts before its verdict on the default shell
**Closes when:** `nvm alias default 24` is set on the machines that run the gate and recorded in `../worktrees.md`, or the chain fails fast with a clear message on Node < 24.
**Status:** open

Verbatim from the Now section of PROGRESS.md (retired 2026-09-03, ADR 0185): *nvm still defaults to Node 20, and `npm run lint` DIES AT GATE 8 there (`globSync` needs 22+). `.nvmrc` + `engines` are set; `nvm alias default 24` is not. ⛔ CORRECTED 2026-08-31: this said `default 22`, and following it literally still left the tree BELOW the pin — `.nvmrc` is 24 and `engines` is `>=24.0.0` (measured, not quoted). The bullet's own remedy was the stale half. Kept live deliberately when the gate-tooling bullet was rotated 2026-08-25: it is the one item in that ✅-marked bullet with an unfired resolution event, it exists in no other file — owner: whoever next hits it.*

### 🟡 FUP-DISPOSAL-RUNBOOK-THREE-CORRECTIONS-OWED — after C1a ran, `phi-disposal-runbook.md` still carries a false banner and omits two preconditions

**Filed:** 2026-09-03 (the Now section of PROGRESS.md retiring, ADR 0185 D6 — recorded at C1a's discharge, 2026-08-31) · **Owner:** backend · **Severity:** medium — the runbook is the C1b instrument; a false banner and a missing precondition mislead the Cloud run
**Closes when:** `../deployment/phi-disposal-runbook.md` (a) drops the `NEVER EXECUTED END-TO-END` banner, (b) § 3 Step B carries a retention-gate warning, (c) states that after a fresh reset the disposal queue is EMPTY and constructing the pending state is the first step.
**Status:** open

Verbatim from the Now section of PROGRESS.md (retired 2026-09-03, ADR 0185; C1a bullet, 2026-08-31): *§ 3 steps A–D ran end-to-end twice (`standard` + `phi` tier) via the `subject_request` lane; byte proof earned (−168 B per run). Still owed: the runbook's `NEVER EXECUTED END-TO-END` banner is now FALSE · § 3 Step B needs a retention-gate warning (delete-then-`HC0DR` manufactures the § 4 orphan class) · ⛔ after a fresh reset the disposal queue is EMPTY — `seed.sql` creates zero `file_objects`, so constructing the pending state is a mandatory first step the runbook omits. ⚠ `HC0DR` is still live: ADR 0114 O1's provisional catch-all blocks every file whose reason is neither `subject_request` nor `duplicate`. The run went around that gate by the lane designed for it — it did not open it.* Run log → [phi-backup-run-log.md](../deployment/phi-backup-run-log.md).

### 🟡 FUP-AFF4-RESIDUE-UNFILED — AFF4's ~16 QA-review obligations and ~20 plan-discovered follow-ups were never filed as register entries

**Filed:** 2026-09-03 (the Now section of PROGRESS.md retiring, ADR 0185 D6 — the residue was recorded at AFF4's Record step, 2026-08-26) · **Owner:** lead · **Severity:** medium — items invisible to the register the PO reads from
**Closes when:** every item in [aff4.md](../progress/aff4.md) § "Residue this Record step did NOT file" is either filed here as its own entry or ruled out by the PO, and that section says which.
**Status:** open

Verbatim from the Now section of PROGRESS.md (retired 2026-09-03, ADR 0185): *AFF4's unfiled residue is still live — ~16 QA-review obligations + ~20 plan-discovered follow-ups were never converted into `FUP-*` index lines at its Record step, so they are invisible to the register the PO reads from (pointer list: aff4.md § "Residue this Record step did NOT file"). ⛔ The one AFF4 item that has NOT concluded.*

### 🟢 FUP-DOCS-CONSOLIDATION-TWO-COOLIFY-RUNBOOKS — two Coolify runbooks with overlapping scope; one should remain

**Filed:** 2026-09-03 · **Owner:** lead · **Severity:** low
**Closes when:** one runbook remains and the other is deleted or reduced to a pointer
**Status:** open

`docs/deploy-coolify.md` (8.9 KB) and `docs/deployment/coolify.md` (19.2 KB) both document the Coolify deploy procedure, with overlapping scope. Filed by ADR 0186 Wave 0 (`docs/plans/docs-consolidation.md` § 9).

### ⚪ FUP-BACKLOG-ETHICS-COMMITTEE-TRACK-E2-PROCEDURE — Ethics Committee track — E2 (procedure) + E3 (terminology/UX) remain; E0 (case-participants, ADR 0064) and E1 (access spine, ADR 0072) are COMPLETE

**Filed:** 2026-07-15 · **Owner:** unassigned · **Severity:** unrated
**Closes when:** PO to rule
**Status:** parked
**Revisit when:** PO to rule

**Ethics Committee track — E2 (procedure) + E3 (terminology/UX) remain; E0 (case-participants, ADR 0064) and E1 (access spine, ADR 0072) are COMPLETE.** Original E0→E3 sequencing narrative archived → [follow-ups-archive.md](./follow-ups-archive.md) (2026-07-15 entry). **E2** (ADR [0073](../decisions/0073-ethics-procedure-model.md)): `ethics_case_details`/`ethics_allegations`/`ethics_findings`/`case_decisions`+`ethics_decision_details` (sanctions, CRM/CFM reporting)/`case_votes`/`ethics_hearings`/`ethics_appeals`; open sub-decisions carried in ADR 0064 §"Open items" (`form_responses.target_case_participant_id`, `case_phases` assignment-role vocabulary, reconciling `case_interview_subjects` with case-level participants). **E3**: label bundles, procedural-timeline categories, dashboards, standards-crosswalk (Phase 16) evidence linkage. Sequencing tracked live under "Current Phase Tasks" S4/S5 above; the three known E1→E2 gaps are tracked separately above (▶ ETH·E1 → ETH·E2 inheritance).

### ⚪ FUP-BACKLOG-P7-AUDITLOG-RANGEPARTITIONING-DEFERRED-LEAD — P7 — `audit_log` range-partitioning DEFERRED (lead decision 2026-07-05, pre-pilot hardening WS-5)

**Filed:** 2026-07-05 · **Owner:** lead + backend · **Severity:** unrated
**Closes when:** PO to rule
**Status:** parked
**Revisit when:** If audit volume ever demands partitioning, the correct axis is `chain_key` LIST/HASH partitioning (NOT time) — a designed track with the chain-integrity model…

**P7 — `audit_log` range-partitioning DEFERRED (lead decision 2026-07-05, pre-pilot hardening WS-5).** Declarative range-partition-by-time is **structurally incompatible** with the audit chain: Postgres forces the partition key into every unique index, so the 4 partial-unique per-chain `seq` indexes would become `(chain_key, seq, occurred_at)` — permitting the same `seq` in different months and destroying the global-per-chain monotonic-seq invariant `verify_audit_chain` + the hash chain rely on. A wrong partition on the tamper-evidence table is worse than none. **If audit volume ever demands partitioning, the correct axis is `chain_key` LIST/HASH partitioning (NOT time)** — a designed track with the chain-integrity model reworked, not a cheap pre-launch win. Pairs with P6 (checkpointed `verify_audit_chain`) + the §6.5 evidence work (pre-Phase-19). Owned by lead (scheduling) + backend.

### ⚪ FUP-BACKLOG-D3-JSONBARRAY-JUNCTIONTABLE-NORMALIZATION-DEFERRED — D3 — jsonb/array → junction-table normalization DEFERRED to its own scoped plan (user decision 2026-07-05, pre-pilot hardening WS-3b)

**Filed:** 2026-07-05 · **Owner:** lead + backend · **Severity:** unrated
**Closes when:** PO to rule
**Status:** parked
**Revisit when:** Do it as a WS-1-style scoped plan pre-pilot while data is disposable (reset-OK).

**D3 — jsonb/array → junction-table normalization DEFERRED to its own scoped plan (user decision 2026-07-05, pre-pilot hardening WS-3b).** Move FK-bearing data out of `case_phases`/`process_template_phases.allowed_result_ids` (46 refs), `result_ruleset` result-ids (62), and `blocks integer[]` (120) into junction tables. **No reachable defect** — the shipped `reorder_template_phase` remaps `blocks` atomically; D3 prevents *future* dangling-`phase_results.id` UUIDs. Heaviest item (~14 functions across the case-phase result/recommendation engine; the `result_ruleset` structured jsonb is the awkward part — junction vs. jsonb+validation-trigger is the open design decision). Do it as a WS-1-style scoped plan **pre-pilot while data is disposable** (reset-OK). **Dispositioned 2026-07-10 → [Pre-Pilot Foundations Program](../plans/pre-pilot-foundations-program.md) F-cleanup** (the sibling structural tracks are resolved there: D12 closed, D5/§6.2 & D6/§6.3 superseded/cancelled, P6 stays deferred). Owned by lead (scheduling) + backend.

### ⚪ FUP-BACKLOG-D7-THREAD-PHOSPITALID-FOR-HOSPITALSCOPED — D7 — thread `p_hospital_id` for hospital-scoped NSP vocab. RE-SCOPED 2026-07-07: NOT backend-only — needs FE + a product decision (deferred)

**Filed:** 2026-07-07 · **Owner:** backend + frontend · **Severity:** unrated
**Closes when:** PO to rule
**Status:** parked
**Revisit when:** PO to rule

**D7 — thread `p_hospital_id` for hospital-scoped NSP vocab. RE-SCOPED 2026-07-07: NOT backend-only — needs FE + a product decision (deferred).** Investigation (Batch B) found the vocab-CRUD call sites in `src/lib/safety/triage-actions.ts` (`create/update/reorder/archive` × EventType/SentinelCriterion) omit `p_hospital_id` → hit the GLOBAL arm (`can_curate_pqs_vocab(NULL)` = `is_admin` only) → non-admin hospital operator gets 42501. But it can't be threaded server-side: "current NSP hospital" is resolved from the **`?hospital=` URL param** (`nsp-hospital-scope.ts`), which a `'use server'` action can't read, and there's no cookie/server persistence; for a **multi-hospital** operator the hospital is a genuine UI choice. Also the vocab **UI is currently GLOBAL** (`nsp/configuracoes` documents vocab as shared, no hospital prop, global list reads) — so scoping it needs (a) a product decision on global-vs-per-hospital vocab semantics + list behavior (global ∪ hospital, per-row editability) and (b) wiring `hospitalId` through page→managers→dialog→actions (frontend). Owned by frontend + backend + product when scheduled.

### ⚪ FUP-BACKLOG-WS3C-FE-FOLLOWUP-MANUALCAPA-UI — WS-3c FE follow-up — manual-CAPA UI should pass `p_hospital_id` for MULTI-hospital operators (backend, non-breaking). BLOCKED — confirmed 2026-07-07 (Batch B)

**Filed:** 2026-07-07 · **Owner:** backend + frontend · **Severity:** unrated
**Closes when:** PO to rule
**Status:** parked
**Revisit when:** BLOCKED — confirmed 2026-07-07 (Batch B). No multi-hospital manual-CAPA UI exists to drive it: `open_capa_plan('manual', …)` auto-derives the hospital for the…

**WS-3c FE follow-up — manual-CAPA UI should pass `p_hospital_id` for MULTI-hospital operators (backend, non-breaking). BLOCKED — confirmed 2026-07-07 (Batch B).** No multi-hospital manual-CAPA UI exists to drive it: `open_capa_plan('manual', …)` auto-derives the hospital for the common single-hospital operator (works today); the multi-hospital branch raises **HC083** and has no caller. Stays deferred until a multi-hospital manual-CAPA UI is built — then thread the chosen hospital into `openCapaPlan` (`src/lib/safety/capa-actions.ts`). Owned by backend (+ frontend).

### ⚪ FUP-BACKLOG-WS4-C6-FE-FOLLOWUPS-PHIDISPOSAL — WS-4 C-6 FE follow-ups — PHI-disposal UI + copy (backend + frontend; before the pilot exposes disposal UI)

**Filed:** 2026-09-03 · **Owner:** backend + frontend + qa · **Severity:** unrated
**Closes when:** PO to rule
**Status:** parked
**Revisit when:** before the pilot exposes disposal UI). The backend is complete; three product-facing pieces remain (QA INFO-3, ADR 0056): (a) `dispose_meeting_minutes` action…

**WS-4 C-6 FE follow-ups — PHI-disposal UI + copy (backend + frontend; before the pilot exposes disposal UI).** The backend is complete; three product-facing pieces remain (QA INFO-3, ADR 0056): (a) **`dispose_meeting_minutes` action + UI** — the standalone meeting-minutes disposal RPC exists but has no server-action/UI; (b) **disposal copy must reflect the NARROWED claim** — user-facing text must NOT say "tudo apagado"/fully-erased (storage blobs are retained encrypted under the 20-yr LGPD/ANVISA/CFM retention regime; DB-side PHI is erased) — copy should state DB-side PHI removed + attachments retained under retention; (c) **non-PHI "motivo da recusa" field** — after §6.4, `decline_note` is nulled to non-PHI referral readers, so a separate non-PHI decline-reason surface is needed for the metadata view. Owned by frontend (+ backend for the action). See [pre-pilot-hardening-wave1.md](../progress/pre-pilot-hardening-wave1.md).

### ⚪ FUP-BACKLOG-ACTIONITEMS-HUB-REMAINING-SATELLITES-ADOPTONDEMAND — Action-items hub — REMAINING satellites, adopt-on-demand (partner-handoff Phases 2–4; ADR [0050](../decisions/0050-action-items-fold-visibility-scope-case-access-expiry.md)). PULLED PRE-PILOT 2026-07-12 (ADR [0071](../decisions/0071-pre-pilot-release-scope-expansion.md)); ⚠ NARROWED 2026-07-28 — this entry claimed the whole menu was open, but the S2·AI track shipped three of them on 2026-07-14 (`phase(ai)`, [ai-satellites](../progress/ai-satellites.md)): ~~activity feed (`action_item_updates`)~~ ✅, ~~checklist items~~ ✅, ~~reminder/escalation rules~~ ✅ (`action_item_reminders` + the reminder→notifications scan arm)

**Filed:** 2026-07-12 · **Owner:** lead + backend + frontend · **Severity:** unrated
**Closes when:** PO to rule
**Status:** parked
**Revisit when:** Adopt selectively when real committee workflows demand them — the hub-and-spoke schema already accommodates each as an additive satellite (no core-table…

**Action-items hub — REMAINING satellites, adopt-on-demand (partner-handoff Phases 2–4; ADR [0050](../decisions/0050-action-items-fold-visibility-scope-case-access-expiry.md)). PULLED PRE-PILOT 2026-07-12 (ADR [0071](../decisions/0071-pre-pilot-release-scope-expansion.md)); ⚠ NARROWED 2026-07-28 — this entry claimed the whole menu was open, but the S2·AI track shipped three of them on 2026-07-14 (`phase(ai)`, [ai-satellites](../progress/ai-satellites.md)): ~~activity feed (`action_item_updates`)~~ ✅, ~~checklist items~~ ✅, ~~reminder/escalation rules~~ ✅ (`action_item_reminders` + the reminder→notifications scan arm).** Still open: evidence, scheduled follow-ups, formal reviews, dependencies, per-committee custom fields, per-commission status/urgency **management UI** (the tables are configurable already; only global defaults are seeded + only the 4 global keys are surfaced), and effectiveness checks. Adopt selectively when real committee workflows demand them — the hub-and-spoke schema already accommodates each as an additive satellite (no core-table change), and status gating flags (`requires_comment`/`requires_evidence`/`requires_review`) become meaningful once evidence/review land. Owned by lead (scheduling) + backend/frontend when picked up.

### ⚪ FUP-BACKLOG-BREAKGLASS-ACCESS-LOGGED-REASONED-TIMEBOXED — Break-glass access (logged, reasoned, time-boxed emergency access to restricted cases / PHI)

**Filed:** 2026-09-03 · **Owner:** lead + backend · **Severity:** unrated
**Closes when:** PO to rule
**Status:** parked
**Revisit when:** Target Phase 20 (Notifications & Escalation).

**Break-glass access (logged, reasoned, time-boxed emergency access to restricted cases / PHI).** Target Phase 20 (Notifications & Escalation). A dedicated `break_glass_access_events` record + a temporary-grant path that requires a reason, is always audited, notifies privacy/security, and appears in audit reports — NOT platform-admin-sees-everything. Partner handoff §19 as the reference model; composes with `case_access` expiry (ADR 0050) and the audited-single-door PHI posture (Rule 12). Owned by lead (scheduling) + backend.

### ⚪ FUP-BACKLOG-USER-REGISTRATION-PHASE9-EMAILTEMPLATE-DEPLOY — User Registration — Phase-9 email-template deploy dependency (feature COMPLETE; deploy-time task)

**Filed:** 2026-09-03 · **Owner:** backend · **Severity:** unrated
**Closes when:** PO to rule
**Status:** parked
**Revisit when:** PO to rule

**User Registration — Phase-9 email-template deploy dependency (feature COMPLETE; deploy-time task).** The pt-BR invite + recovery templates (`supabase/templates/{invite,recovery}.html`) must be pasted into Supabase **Dashboard → Auth → Email Templates** for Cloud (self-hosted `config.toml` templates don't auto-apply), preserving the `{{ .TokenHash }}` + `?type=invite|recovery` link shape — alongside the already-flagged custom SMTP. Until then invite/recovery links work locally but NOT in prod. Owned by backend at deploy. See [user-registration.md](../progress/user-registration.md).

### ⚪ FUP-BACKLOG-BROADER-ORGMEMBERROLEMANAGEMENT-UI-MULTITENANCY-GAP — Broader org-member-role-management UI (multi-tenancy gap; surfaced building NSP-per-org B3)

**Filed:** 2026-09-03 · **Owner:** backend + frontend · **Severity:** unrated
**Closes when:** PO to rule
**Status:** parked
**Revisit when:** PO to rule

**Broader org-member-role-management UI (multi-tenancy gap; surfaced building NSP-per-org B3).** NSP-per-org added a *focused* `/o/[org]/manage/equipe-nsp` that toggles only the `nsp_coordinator` role, but there is **no general org-member management UI** — an `org_admin` cannot add/remove other `org_admin`s or manage org membership through the app (only the seed + direct DB). Build a proper `/o/[org]/manage/membros` surface (+ `organization_members` role CRUD actions). Owned by frontend + backend.

### ⚪ FUP-BACKLOG-NSP-APPOINTPICKER-ANNOTATEEXCLUDE-CURRENT-ORGADMINS — NSP appoint-picker: annotate/exclude current org_admins (minor UX, NSP-per-org B3)

**Filed:** 2026-09-03 · **Owner:** frontend · **Severity:** unrated
**Closes when:** PO to rule
**Status:** parked
**Revisit when:** PO to rule

**NSP appoint-picker: annotate/exclude current org_admins (minor UX, NSP-per-org B3).** The appoint picker lists all org users incl. `org_admin`s; selecting one returns the "já é administrador" refusal (the DB guard is the safety). Cleaner: disable/annotate current org_admins in the picker. Owned by frontend.

### ⚪ FUP-BACKLOG-APPOINTNSPCOORDINATOR-TOCTOU-HARDENING-OPTIONAL-NSPPERORG — `appointNspCoordinator` TOCTOU hardening (optional, NSP-per-org B3)

**Filed:** 2026-09-03 · **Owner:** backend · **Severity:** unrated
**Closes when:** PO to rule
**Status:** parked
**Revisit when:** PO to rule

**`appointNspCoordinator` TOCTOU hardening (optional, NSP-per-org B3).** The SELECT-role-then-upsert has a negligible race (admin-only, deliberate, low-frequency); a DB-level guard (trigger / partial constraint forbidding a coordinator-upsert over an `org_admin` row) would close it fully — over-engineering for now. Owned by backend.

### ⚪ FUP-BACKLOG-MULTITENANCY-ORGADMIN-TSGATE-GAP-IN — Multi-tenancy — org_admin TS-gate gap in the invoker `authorize*` helpers (QA INFO / lead #15, non-blocking)

**Filed:** 2026-09-03 · **Owner:** lead + qa · **Severity:** unrated
**Closes when:** PO to rule
**Status:** parked
**Revisit when:** PO to rule

**Multi-tenancy — org_admin TS-gate gap in the invoker `authorize*` helpers (QA INFO / lead #15, non-blocking).** ~8 invoker-context `authorize*` server-action helpers gate on `is_staff_admin_of` / `isAdmin` but do **not** yet grant the org_admin → coordinator branch that `getCommissionAccessByOrg` grants on the read path. RLS is the security backstop (these are invoker-context, not service-role, so the worst case is an org_admin being *denied* a write they should be allowed, not an escalation), but the gates should be aligned with the read path for consistency. Enumerate + add the `is_org_admin_of_commission` term.

### ⚪ FUP-BACKLOG-PREEXISTING-FULLSERIALSUITE-CONTAMINATION-NOT-A — Pre-existing full-serial-suite contamination (NOT a form-builder regression)

**Filed:** 2026-09-03 · **Owner:** unassigned · **Severity:** unrated
**Closes when:** PO to rule
**Status:** parked
**Revisit when:** PO to rule

**Pre-existing full-serial-suite contamination (NOT a form-builder regression).** A single full serial run is RED on `main` itself (~17–19 failures; branch ≤ baseline, 0 net new — proven by failing-title diff). Cross-spec seed-mutation in lexical run order (phase10–14/22 before phase2–8). Separate spec-isolation effort (phase13-saga class); the team's green path is chunked runs with a fresh reset per chunk. Tracked, does not gate any single feature.

### ⚪ FUP-BACKLOG-HARDEN-E2EFORMBUILDERENHANCEMENTSSPECTS-TO-A-THROWAWAY — Harden `e2e/form-builder-enhancements.spec.ts` to a throwaway commission (QA INFO-4, nice-to-have)

**Filed:** 2026-09-03 · **Owner:** qa · **Severity:** unrated
**Closes when:** PO to rule
**Status:** parked
**Revisit when:** PO to rule

**Harden `e2e/form-builder-enhancements.spec.ts` to a throwaway commission (QA INFO-4, nice-to-have).** It builds fixtures in the seeded CCIH commission (`COMM_A`/`/c/ccih`) rather than a probe commission/users (cf. P13-005/006 lessons). Acceptable now (branch added 0 net contamination); harden (use `makeProbeCommission`/`makeProbeUser`) if it joins the full gate matrix.

### ⚪ FUP-BACKLOG-CASEPATIENT-DISPOSAL-UI-DESCARTAR-DADOS — `case_patient` disposal UI — "Descartar dados do paciente" (frontend, not blocking; mirrors the NSP WS C item below)

**Filed:** 2026-09-03 · **Owner:** frontend · **Severity:** unrated
**Closes when:** PO to rule
**Status:** parked
**Revisit when:** PO to rule

**`case_patient` disposal UI — "Descartar dados do paciente" (frontend, not blocking; mirrors the NSP WS C item below).** `dispose_case_phi` + the `disposeCasePhi(caseId, reason)` action are live; the UI is a coordinator/admin-gated button on the case detail opening a confirm dialog with a reason-category `<select>` bound to `PhiDisposeReason`/`CASE_PHI_DISPOSE_REASON_LABELS` (NO free-text — constrained category), reflecting `has_patient=false` + the `phi_disposed_*` stamp post-action. One-shot (HC056).

### ⚪ FUP-BACKLOG-WS-A-FE-PQSMEMBERSHIP-MANAGEMENT — WS A FE — PQS-membership management UI (frontend, not blocking)

**Filed:** 2026-09-03 · **Owner:** frontend · **Severity:** unrated
**Closes when:** PO to rule
**Status:** parked
**Revisit when:** PO to rule

**WS A FE — PQS-membership management UI (frontend, not blocking).** `pqs_members` is admin-managed via `add/remove/list_pqs_members` RPCs + a seeded admin (functional/testable now). A roster-management screen under `/admin` (enroll/remove PQS staff, list members) is a frontend task; in prod the first admin enrolls staff via `add_pqs_member`. Mirror the `assignStaffAdmin` admin-action pattern (`requireAdmin` + admin client) for the server actions.

### ⚪ FUP-BACKLOG-WS-A-FE-ADMINNSP-GATING — WS A FE — `/admin/nsp` gating + patient-panel affordance (frontend/tester, surfaced by WS A trace 2026-06-20)

**Filed:** 2026-06-20 · **Owner:** frontend + tester · **Severity:** unrated
**Closes when:** PO to rule
**Status:** parked
**Revisit when:** PO to rule

**WS A FE — `/admin/nsp` gating + patient-panel affordance (frontend/tester, surfaced by WS A trace 2026-06-20).** (a) `/admin/nsp/[eventId]/page.tsx` gates ONLY on `context.isAdmin`. Post-WS-A a **non-PQS admin** degrades to `notFound()` (clean pt-BR 404 — `getSafetyEvent`'s `patient_safety_event` SELECT is now `can_read_event`, which denies a non-PQS/non-custodian admin → null → 404), NOT a crash/broken-empty page. Ideal: gate the NSP routes on `is_pqs_member` (e.g. via `patient_safety_enabled()` + a PQS check / a new `public.is_pqs_member()` read) for a tailored "não autorizado" instead of a generic 404. (b) The patient panel renders on `event.hasPatient` ALONE; entitlement is enforced at the data layer (the `get_event_patient` RPC returns null for an unentitled caller → `<PatientPanelEmpty>`), so **no PHI leaks**, but the affordance ideally gates on `hasPatient` AND entitlement to avoid showing an empty panel to an entitled-event-but-unentitled-PHI viewer. **No reporter-facing route renders the panel** (verified: `/c/[slug]/eventos` is governance-only, PHI-free; the panel is admin-route-exclusive) — so a reporter, incl. after custody handoff, never reaches it. Flagged per coordinator; NOT fixed in WS A.

### ⚪ FUP-BACKLOG-WS-E-M2-PERVOCABULARY-REORDERARCHIVE — WS E / M2 — per-vocabulary reorder/archive RPC consolidation DEFERRED (backend, 2026-06-20)

**Filed:** 2026-06-20 · **Owner:** backend · **Severity:** unrated
**Closes when:** PO to rule
**Status:** parked
**Revisit when:** Revisit only if the vocab set grows materially.

**WS E / M2 — per-vocabulary reorder/archive RPC consolidation DEFERRED (backend, 2026-06-20).** The reorder/archive RPCs for `case_tags`/`case_outcomes`/`case_narrative_types` (commission-scoped, `assert_*_enabled`+`is_staff_admin_of`) vs `pqs_event_types`/`pqs_sentinel_criteria` (GLOBAL, `assert_patient_safety_enabled`+`is_pqs_member`, two-step negative-offset against a deferrable position unique) diverge by gate/flag/scope/collision-strategy/pt-BR message. A shared `app.reorder_vocab(table,…)` helper would need table-name-interpolated dynamic SQL (injection surface + allow-list) and couldn't encode the per-table divergence — less auditable than the current explicit static RPCs. Revisit only if the vocab set grows materially. No code change.

### ⚪ FUP-BACKLOG-WS-B-AUTHORITATIVE-PHIBEARING-FREETEXT — WS B — authoritative PHI-bearing free-text column list (for ARCHITECTURE.md Rule 11/12 + ADR alignment, lead-owned). FINAL count = 22 columns

**Filed:** 2026-06-20 · **Owner:** lead + backend · **Severity:** unrated
**Closes when:** PO to rule
**Status:** parked
**Revisit when:** PO to rule

⚠ **NARROWED by ADR 0131 (2026-08-20) — the Rule 12 half is descoped, the Rule 11 half is NOT.** Erasure no longer extends to these columns (designated PHI fields only; training is the control), so the remaining deliverable — the ARCHITECTURE.md alignment — must record them as *PHI-capable, read-audited, **not** erased*. ⛔ Do not delete this item: removing it because half of it is descoped would silently drop the **read-audit** obligations its own text names (`meeting.viewed`, `interview.viewed`). ⭐ Its `*.title` EXCLUSION is the **title invariant** ADR 0131 now leans on — catalog-verified: 23 `PHI-BEARING free text` comments, zero on a `title`. **WS B — authoritative PHI-bearing free-text column list (for ARCHITECTURE.md Rule 11/12 + ADR alignment, lead-owned). FINAL count = 22 columns** (18 + the 4 borderline, lead ruled CLASSIFY 2026-06-20). Backend applied SQL column COMMENTs (`'PHI-BEARING free text (WS B; Rule 11/12)…'`) to: `patient_safety_event.description_md`, `event_triage.disposition_notes_md`, `rca.{what_md,expected_md,summary_md,impact,scope}`, `rca_factors.text`, `rca_root_causes.text`, `rca_timeline_entries.description`, `capa_plan.lessons_learned_md`, `capa_effectiveness.method_md`, `capa_action_task.description`, `capa_measure_result.note`, `meetings.minutes_md`, `case_interviews.summary_md`, `case_narratives.body_md`, `case_events.body` **(the original 18)** + **`meeting_agenda_items.{description,discussion_notes,resolution}` + `case_interview_subjects.note` (the +4 addendum** — all are multi-line textareas; agenda free-text already read-audited via `meeting.viewed` on `getMeetingDetail`/`listMeetingAgenda`, subject note via `interview.viewed` on `getInterviewDetail`/`listInterviewSubjects`; no new audit emit needed). **EXCLUDED** (governance metadata, PHI-free by the title invariant): all `*.title` + `case_interview_subjects.clinical_role`. Comment-only; `db diff` clean; types unchanged. Lead aligns ARCHITECTURE.md/ADRs from this 22-column list (backend left those docs untouched per instruction).

### ⚪ FUP-BACKLOG-WS-C-FE-DESCARTAR-DADOS — WS C FE — "Descartar dados do paciente" disposal UI (frontend, not blocking)

**Filed:** 2026-09-03 · **Owner:** frontend · **Severity:** unrated
**Closes when:** PO to rule
**Status:** parked
**Revisit when:** PO to rule

**WS C FE — "Descartar dados do paciente" disposal UI (frontend, not blocking).** The `disposeEventPhi(eventId, reason)` server action + the `dispose_event_phi` RPC are live and E2E-testable; the UI is a frontend task: an admin/PQS-gated button on the NSP event detail (`/admin/nsp/[eventId]`) opening a confirm dialog with a **reason-category `<select>`** bound to `PhiDisposeReason` / `PHI_DISPOSE_REASON_LABELS` (NO free-text field — the reason is a constrained category), a destructive-action confirm, and post-action it should reflect `has_patient=false` (panel gone) + show the `phi_disposed_at/by/reason` stamp ("dados descartados em … por … — motivo: …"). Disposal is one-shot (HC056 → "PHI já descartada"). Owned by `frontend`.

### ⚪ FUP-BACKLOG-WS-BC-FE-DISCOURAGE-PHI — WS B/C FE — discourage PHI in `*.title` / structured short fields (frontend, not blocking; surfaced 2026-06-20)

**Filed:** 2026-06-20 · **Owner:** frontend · **Severity:** unrated
**Closes when:** PO to rule
**Status:** parked
**Revisit when:** PO to rule

⭐ **PROMOTED by ADR 0131 (2026-08-20) — no longer "not blocking".** 0131 makes **training** the compensating control for PHI in free text, and this helper text is the **only software support for that control** — it defends the very title invariant WS B's exclusion rests on. Cheapest change that makes the decision hold in practice. **WS B/C FE — discourage PHI in `*.title` / structured short fields (frontend, not blocking; surfaced 2026-06-20).** The minimum-necessary invariant assumes titles stay PHI-free (they ride on queue/list paths). Add helper text / a soft validation note ("Não inclua dados do paciente.") to the title inputs on event/RCA/CAPA/meeting/interview/case forms (mirrors the existing case-action-item dialog note). Soft guidance only — no hard block. Owned by `frontend`.

### ⚪ FUP-BACKLOG-E2E-REGRESSION-SUITE-IS-NOT — E2E regression suite is NOT reliably green against a PROD build (test-harness debt, surfaced 2026-06-18; NOT a Phase-14 defect)

**Filed:** 2026-06-18 · **Owner:** backend + tester · **Severity:** unrated
**Closes when:** PO to rule
**Status:** parked
**Revisit when:** PO to rule

**E2E regression suite is NOT reliably green against a PROD build (test-harness debt, surfaced 2026-06-18; NOT a Phase-14 defect).** The freeze-proof gate now requires `next build`+`next start` (the heavy NSP pages crawl + balloon the `next dev` server to 4.3 GB — see user MEMORY `e2e-gate-prod-build`). But the pre-≤13 specs were authored against `next dev` and flake against the prod build: (a) Radix dialog close-animations (`data-[state=closed]:animate-out`) race tight `toBeHidden`/`toHaveCount` timeouts because — unlike the Phase-14 specs — the older specs DON'T set `reducedMotion: 'reduce'`; (b) the suite shares one mutable DB with no per-test reset, so Playwright `retries` (and parallel workers) CASCADE write-pollution: retries=2 produced MORE hard failures (25) than retries=0 (14). **Phase-14 specs are clean (65/65).** Evidence (2026-06-18, prod build, LOCAL Docker): full suite workers=1/retries=0 → 246 pass / 14 fail; non-14 specs workers=4/retries=2 → 162/13 flaky/20 fail; non-14 specs workers=1/retries=2 → 167/3 flaky/25 fail. Every failure is a pre-14 spec. **Fixes (test-infra; `tester` + `backend` for config):** add `use: { reducedMotion: 'reduce' }` to `playwright.config.ts` (one line, stabilizes animation timing globally); point `webServer.command` at a prod build for the gate; give the older mutation specs DB isolation (unique per-test fixtures or reset-per-file). Until then, the older specs' "green" depends on the `next dev` model.

### ⚪ FUP-BACKLOG-E2E-CASENARRATIVES-AC1B-SPECISOLATION-TESTEROWNED — E2E `case-narratives` AC-1b spec-isolation (tester-owned; surfaced 2026-06-19 during the case-access refinement triage)

**Filed:** 2026-06-19 · **Owner:** tester · **Severity:** unrated
**Closes when:** PO to rule
**Status:** parked
**Revisit when:** PO to rule

**E2E `case-narratives` AC-1b spec-isolation (tester-owned; surfaced 2026-06-19 during the case-access refinement triage).** AC-1b renames the "Resumo Clínico" narrative TYPE to "…(Renomeado) {timestamp}" and never restores it, so on the shared DB a re-run/later-ordered AC-1 (which asserts the original label) fails. NOT a code regression — pre-existing test debt, an instance of the no-per-test-DB-isolation problem in the item above. Fix: AC-1b restores the original label in a teardown/`finally` (or uses a throwaway type). Until then `case-narratives` AC-1 is order/state-dependent.

### ⚪ FUP-BACKLOG-PHASE-14A-DEFERRED-QA-REVERIFY — Phase 14a deferred (QA re-verify INFO)

**Filed:** 2026-09-03 · **Owner:** backend + qa · **Severity:** unrated
**Closes when:** PO to rule
**Status:** parked
**Revisit when:** do it on the next `src/lib/safety/actions.ts` touch (e.g. Phase 14b).

**Phase 14a deferred (QA re-verify INFO):** sweep the success string out of `ActionState.error` for the 4 remaining safety actions (`transferEventCustody` / `updateEvent` / `setEventPatient` / `cancelEvent`) into the new `message` field — harmless today (all consumers gate on `!result.ok`), do it on the next `src/lib/safety/actions.ts` touch (e.g. Phase 14b). Backend-owned. The 2 flagged in QA N1/I2 (`notifySafetyEvent`/`acknowledgeEvent`) are already done.

### ⚪ FUP-BACKLOG-INTERVIEWS-MINHAS-ENTREVISTAS-DISCOVERY-SURFACE — Interviews — "Minhas entrevistas" discovery surface for plain-`staff` interviewers (Phase 11, deferred per lead)

**Filed:** 2026-09-03 · **Owner:** lead + frontend · **Severity:** unrated
**Closes when:** PO to rule
**Status:** parked
**Revisit when:** PO to rule

**Interviews — "Minhas entrevistas" discovery surface for plain-`staff` interviewers (Phase 11, deferred per lead).** v1 has NO dedicated list for a plain-`staff` registered interviewer to find interviews they may write — they reach the detail by DIRECT LINK only (the case-detail "Entrevistas" panel is coordinator-gated). The interview detail page renders correctly for them (membership guard + `viewerCanWrite` controls), and the detail header back-link points non-coordinators at the commission home (`/c/[slug]`), never the coordinator case page. A future "Minhas entrevistas" surface (mirroring "Minhas fases") would close the discovery gap. Owned by `frontend` when scheduled.

### ⚪ FUP-BACKLOG-PHASE-8-DEPLOY-CHECKLIST-PRODUCTION — Phase 8 deploy checklist — production Supabase Cloud MUST use asymmetric (ES256/RS256) JWT signing keys

**Filed:** 2026-08-19 · **Owner:** qa · **Severity:** unrated
**Closes when:** PO to rule
**Status:** parked
**Revisit when:** PO to rule
**Body:** [FUP-BACKLOG-PHASE-8-DEPLOY-CHECKLIST-PRODUCTION.md](FUP-BACKLOG-PHASE-8-DEPLOY-CHECKLIST-PRODUCTION.md)

### 🟡 FUP-VACUOUS-COVERAGE-1 — two PHI-remediation tests that **NEVER RUN**, and `lint:vacuous` is structurally unable to catch them (owner: tester + backend)

**Filed:** 2026-08-17 · **Owner:** backend + tester · **Severity:** medium — per emoji at consolidation (archive-sourced body)
**Closes when:** PO to rule
**Status:** parked
**Revisit when:** PO to rule
**Body:** [FUP-VACUOUS-COVERAGE-1.md](FUP-VACUOUS-COVERAGE-1.md)

### 🟡 FUP-PDF-4 — verification rate limiter: comment FIXED, availability lever still OPEN and re-scoped (QA P1 MINOR-3; owner: backend)

**Filed:** 2026-08-11 · **Owner:** backend + qa · **Severity:** medium — per emoji at consolidation (archive-sourced body)
**Closes when:** PO to rule
**Status:** parked
**Revisit when:** PO to rule
**Body:** [FUP-PDF-4.md](FUP-PDF-4.md)

### 🟡 FUP-AFF-3 — pin door ACLs by DERIVING the door set, not by remembering it (2026-08-06)

**Filed:** 2026-08-06 · **Owner:** backend + qa · **Severity:** medium — per emoji at consolidation (archive-sourced body)
**Closes when:** PO to rule
**Status:** parked
**Revisit when:** PO to rule
**Body:** [FUP-AFF-3.md](FUP-AFF-3.md)

### 🟢 FUP-FF5-2 — `r2-m-1`: §O pins the door's behaviour, not the closure of the writer set

**Filed:** 2026-09-03 · **Owner:** qa · **Severity:** low — ▶ marker, not a D4 emoji; carried from the archive-sourced body, not re-assessed
**Closes when:** PO to rule
**Status:** parked
**Revisit when:** PO to rule

ADR 0091's substrate paragraph claims *"an exhaustive `pg_proc` sweep for writers of `participants`
returns exactly two functions"*. §O proves the two known doors behave (the surrogate holds) and O5
proves no writer is invoker-rights — but neither pins that the set is **closed**, so a third
DEFINER writer taking a caller-supplied label satisfies every assertion. QA r2: MINOR, not blocking
(the runtime property is held by the mutation-proven O4, and a new writer arrives with its own
migration and ADR). **Close:** one assertion pinning the writer set by **count *and* name**,
matching `(public\.)?participants\y`. Two specifics — O5's current regex is
`insert\s+into\s+public\.participants`, which matches only `public.`-qualified writes (exactly why
a rogue *unqualified* writer probe stayed green), and use `\y`, **not `\b`** (backspace in Postgres
regex).

### ⚪ FUP-BACKLOG-AUTHZ-GATE2-MINOR1-RESERVEDSESSION-DOOR — AUTHZ Gate-2 deferred (PO-noted 2026-07-17, non-blocking — Gate 2 shipped)

**Filed:** 2026-07-17 · **Owner:** backend + PO · **Severity:** unrated
**Closes when:** PO to rule
**Status:** parked
**Revisit when:** PO to rule

- [ ] **MINOR-1 — reserved-session door returns the respondent's own `case_id`.** `get_reserved_session_items`
  now masks times + process number on `NOT is_case_respondent`, but a respondent still receives their **own**
  `case_id` (no cross-case / cross-patient re-identification). Whether the respondent should see even their own
  linkage on the reserved door is the unresolved **A7-vs-A26** call — **fold the reconciliation at pilot close**.
  Owned by `backend`.

### ⚪ FUP-BACKLOG-ETH-E1E2-INHERITANCE-GAPE1123-MINORAB — ETH·E1 → ETH·E2 inheritance (PO-directed 2026-07-14: "log for E2, don't act now")

**Filed:** 2026-07-14 · **Owner:** backend + frontend + qa + PO · **Severity:** unrated
**Closes when:** PO to rule
**Status:** parked
**Revisit when:** PO to rule
**Body:** [FUP-BACKLOG-ETH-E1E2-INHERITANCE-GAPE1123-MINORAB.md](FUP-BACKLOG-ETH-E1E2-INHERITANCE-GAPE1123-MINORAB.md)
