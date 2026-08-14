# DM5 — Wave D + retirement (phase record)

> Live status lives in **PROGRESS.md**; this file is the authority for DM5's detail.
> Rotated out of PROGRESS.md mid-phase (2026-08-14) because the live file had reached
> **128 KB against CLAUDE.md §7's "well under 60 KB"** target — and every teammate spawn
> reads it. Plan: [dm5-wave-d-retirement-plan.md](../plans/dm5-wave-d-retirement-plan.md) ·
> ADR [0120](../decisions/0120-dm5-wave-d-retirement-decisions.md) · step 0:
> [dm5-surface-verification.md](./dm5-surface-verification.md).

## ✅ RESUME AUDIT before S3 (lead, 2026-08-14, HEAD `e2af9790`) — the build is sound; **every defect was in the RECORDS**

The PO asked for a consistency check on the DM5 work before continuing. **Nothing in the built system was
wrong.** Every figure the handoff claimed reproduced exactly on a fresh reset — registry **399 == 399** ·
pgTAP **192 files / 6284** · tsc **0** · lint **5/5** · vitest **1294** · all four arms **HOLD** (census
546/569 · hat 3 · floor 74 · wrapper BLIND 41) · degenerate bodies **0** · tree clean · findings 594 lines.
The catalog corroborated every S2 claim independently: 8 securable types, **both** kernel doors carrying
`rca`+`capa_action` with `prosecdef = t`, `p_storage_path` dead on all three write doors, `wave_d` asserted
at `begin` and deliberately not at `finalize`, `tenant_shape` carrying D14's shape-B, flags default `false`
in migration and ON in the local seed only. **S2's one owed item — the four arms — is discharged.**

⭐ **The finding is the shape of the finding.** A phase that spent six weeks learning *"text is not truth"*
had produced, in its own status files, **eight** assertions that contradicted the catalog, git, or each
other. **A build verified nine ways was being described by records nobody re-ran.**

| # | inconsistency | disposition |
| --- | --- | --- |
| **1** | 🔴 **PROGRESS.md asserted `⛔⛔ S2 IS REOPENED — IT WAS NEVER FUNCTIONAL` as CURRENT STATE.** All three named defects are ✅ FIXED — contradicted by the **same file's own bug log**, by git, by 0 stub bodies, and by the live catalog. **This is the file every teammate spawn reads**: a `backend` spawned for S3 would have been briefed that S2 is broken. | ✅ rewritten; the lesson retained, explicitly re-framed as **history** |
| **2** | 🔴 **PROGRESS.md's phase-status DM row said "No migrations/code written yet"** and quoted registry **391**. Eight migrations are registered; it is **399**. | ✅ corrected, with a pointer to the live section as the authority |
| **3** | 🟠 **The "S2 … CLOSE" section here presented the VOID first close's figures** (397 / 6272 / 1264 / "6 migrations") **with no visible marker** — the reopen banner sits ~200 lines above under a different heading. ⭐ **This is ADR 0120's own withdrawal root-cause #3 repeating one file over:** *a supersession marker only a raw-file reader can see is not a marker* — and here it was worse, because the marker was merely **distant** rather than hidden. | ✅ loud in-section banner + the true figures beside the void ones |
| **4** | 🟠 **`docs/backend-state.md` predates EVERY S2 migration** (last content `bf1585ea`) — no knowledge of the new types, either kernel arm, the dead `p_storage_path`, the `wave_d` assert, or the un-parked citation seam. ⛔ **This is the same file, in the same phase, that caused S1's withdrawal — and it would now have been consulted by S3, which touches exactly that surface. Third strike attempted.** | ✅ loud currency stamp at the head enumerating all 8 migrations' deltas; full rewrite stays an S6 deliverable |
| **5** | 🆕 **The S3 trap-3 enumeration was bounded by two line numbers, not by the property** — **four** sites, two unnamed anywhere, one of them S2's own new code. And the recorded failure mode was wrong: it does not crash, it **silently misclassifies a fully-uploaded print as `pending` with `canOpen: false`**, forever. Full analysis + per-site reachability: handoff §4 trap 3. | ✅ corrected and sharpened; **reframed from "frontend's" to a joint resolution-seam fix + keystone** |
| **6** | 🟡 **Two 🔴 follow-ups were in `follow-ups.md` but had ZERO mentions in PROGRESS.md** — FUP-AUTHZ-HARNESS-TRANSACTIONAL (a **live authz-harness hazard**) and FUP-DM5-FINALIZE-ATOMIC — against the stated "filed in BOTH" discipline. | ✅ both now in PROGRESS.md's Open list |
| **7** | 🟡 **Two items lived only in handoff prose, filed nowhere:** `330` is BLIND to `can_write_document`, and the intermittent `pg_prove` worker deadlock (*will re-red a gate at random and read like a defect*). | ✅ named in PROGRESS.md as explicitly unfiled |
| **8** | 🟡 **PROGRESS.md is 137 KB** against §7's "well under 60 KB" — it was rotated to 115 KB at `3b51c20d` and grew **22 KB in one slice**. Rotation is the lead's, and [[progress-md-record-step-rotation-is-chronically-skipped]] is a standing memory. | 🔶 **OPEN** — flagged to the PO, not yet done |

⚠ **The one class this audit could NOT clear.** Every check above is static — catalog, git, counts, text.
**S2's own history is that all of those were green while the feature did not work at all**, because *not one
of them executes a page*. The E2E evidence for S2 is a **quick-loop** run (8/8 new + 36/36 pre-existing),
never `e2e:prod`. **DM5 has no full-gate E2E result at any point**, and it must not close without one.

## ⚠ INCIDENT during S2 verification — an authz gate was LIVE-OPEN on the shared stack (2026-08-14)

**Anyone auditing S2's results needs this window.** `app.can_write_document` — the gate for **every**
document write across all eight home types — sat live with the body `begin return true; end` (an
**unconditional allow**) on the shared local stack, for an interval whose only lower bound is a
`pg_get_functiondef` capture at **17:28**. ⚠ **`pg_proc` carries no mtime**, so the window cannot be
dated from the catalog; **any document-write-path result produced in it must be RE-RUN, not re-read.**

**Cause: a LEAD instruction.** I told a backend teammate to *"neutralize `can_write_document` and
confirm your keystone block goes red"* **without saying transactionally**, on a stack two other
teammates were live on. Not a product defect — the migration `20260927000160` is correct and its own
self-verifying `DO` block passed at apply time. Full analysis + the structural fix:
**FUP-AUTHZ-HARNESS-TRANSACTIONAL** in [follow-ups.md](./follow-ups.md).

**Caught by `tester`, which verified its environment BEFORE executing an agreed plan** — everything it
was about to run would have gone **green while proving nothing**, a false all-clear on the exact defect
class this slice exists to close. It also **declined to hand-patch** the function despite having the
correct body in front of it, because a second actor was mid-run.

**Resolution, verified independently by three parties** (backend-assurance's differential, the lead's
catalog sweep, `tester`'s own re-probe — each measured rather than relayed):
`degenerate_bodies 0 · has_rca_arm t · has_capa_arm t · still_neutralized f · prosecdef t`, and
`chefe.farm` → `begin_document_upload('rca', …)` → **REFUSED P0002**.

⭐ **Blast radius was bounded by a PROPERTY query, not a name list** — sweep `app`+`public` for any body
matching `^\s*begin\s+return\s+(true|false)\s*;\s*end`. **Exactly one hit.** ⚠ A left-open gate is
**invisible to all four §6 authz arms**, because they test doors that *exist*; that query is the only
thing that sees it.
⭐ **The rollback was PROVEN before being relied on** — md5 of `pg_get_functiondef` before, gate replaced
in-txn, probe, `rollback`, re-read: byte-identical, same md5. Postgres DDL is transactional, so a
rolled-back `CREATE OR REPLACE` leaves no residue — now measured, not assumed
([[mutation-harness-must-prove-its-rollback-first]]).

## ⭐ A deliberately uninformative error code is uninformative to the TEST too (S2 `341` F-block)

ADR 0120 D-note: `add_rca_evidence`'s citation arm raises **`HC0D8` for both absence and
unreadability, deliberately**, so a caller cannot use the error to probe which documents exist — an
error code that distinguishes *"not found"* from *"not yours"* is an **existence oracle**. That
design decision is correct and stays.

⚠ **But the same ambiguity that blinds an attacker blinds the assertion.** Three fixture defects in
the F-block, each caught by a red, each a different class — and the middle one is the specimen:

1. **A hardcoded id captured before the reset.** The seed mints document ids with
   `gen_random_uuid()`, so the captured id named nothing afterwards. F4/F6 went **visibly red** —
   **but F7 stayed GREEN for the wrong reason**: it asserts `HC0D8` and received `HC0D8` from *"no
   such document"* rather than *"you may not read it"*. A vacuous pass hiding inside the assertion
   its author was most confident about.
2. **The fixture was RLS-filtered by the caller.** Resolving the id inline read `public.documents`,
   gated by `can_read_document`, which returned **no rows** for the very writer who cannot read it —
   so `p_cited_entity_id` arrived NULL and the **shape** check fired (`23514`) *before* the
   authorization gate could. F7 would have been asserting **the fixture vanishing**, not the door
   working. Fixed by resolving as `postgres` into a temp table (not RLS-filtered).
3. **The temp table needed an explicit grant** — probes run as `authenticated`, `postgres` owns it.

**The rule this yields:**

> When a door answers **one code for several causes** — by design, to avoid an oracle — a test
> asserting that code proves **nothing about which cause fired**. The discriminating fact must be
> established **separately, before the assertion runs**.

`F5b` now pins both sides first: the document **exists**, `chefe.ccih` **can** read it, `nspcoord.a`
**cannot** — so F7's `HC0D8` can only mean unreadability. ⚠ **Two of the three defects would have
left a GREEN suite asserting nothing**, which is [[FUP-PGTAP-VACUOUS]] in its natural habitat:
`lint:vacuous` scans TS only, and every one of these is SQL.

`341`'s `D4d` was also converted from a substring ACL test to `aclexplode`, and **`D4e` added for the
direction a presence check structurally cannot see** (`grantee = 0` is PUBLIC) — the same habit that
produced a false positive *and* a vacuous guard across three migrations, now removed from the suite
as well as the migrations.

Suite `341`: **plan(41), 41 assertions** (30 → 41); repo total **192 files / 6272** (6261 → 6272).
Both deltas are **+11** — stated with the reconciliation because a bare "41" beside a "+11" reads as
a discrepancy, and this phase has already mis-recorded three counts.

## ⭐ The finding that justifies the whole "inference until reset" discipline (S2 `…000150`, 2026-08-14)

**A fresh `supabase db reset` did not confirm the hand-applied `REVOKE` — it FALSIFIED the migration
file.** `…000120`'s PUBLIC-grant assertion **had never executed**: it was added while repairing an
already-registered migration, so only the hand-applied `REVOKE` ever took effect, and the corrected
file first ran at the reset — where it **fired on every function and broke the reset**.

⚠ **The lead had checked that the file and the live DB agreed, and they did.** Had that been recorded
as fact rather than as an inference, a **broken migration would have carried into the gate with a
green local stack agreeing with it**. The rule, in the words that matter:

> **"File and DB agree" is NOT "the file works."** A migration that has never executed is unproven no
> matter how exactly the database matches what it claims to do.

**One habit, two OPPOSITE failures — the sharper half.** The assertions asked a *string* a question
only *structure* can answer:

| migration | test | failure |
| --- | --- | --- |
| `…000120` | `acl like '%=X/postgres%'` | **false positive on everything** — PUBLIC is an aclitem with an **empty grantee**, so the pattern also matches `postgres=X/postgres` |
| `…000130`, `…000150` | `and not like '%postgres=X/postgres%'` | **vacuous** — structurally incapable of firing while `postgres` holds a grant |

Fixed with `aclexplode(...) where grantee = 0`. **Third instance of this class in one slice** — the
first was `prosrc like '%HC0DM%'` matching the author's own **comment**. `prosrc` includes comments;
an ACL is not a string. Related: [[a-comment-is-an-assertion-that-goes-stale-silently]].

⚠ **The near-miss is part of the finding.** The first diagnosis blamed
`information_schema.column_privileges`, which was *plausible* — the column genuinely showed 0 rows —
but only because **the failed reset never created it**. *A symptom observed in a broken end-state is
not evidence about the cause.* Reproducing against the real pre-state gave the true error in one step.

**Verified after the fix** (lead, independently): `anon_exec = f` and `public_holds_exec = f`
(via `aclexplode`) on both doors, and **0 first-party `public` functions anon-executable** — the
population assertion, not just the two touched.

🔧 **Residual, benign, tracked:** `…000110:181` still uses
`if v_acl not like '%authenticated=X/postgres%'`. That is a **presence** check, so it fails **loud**
(false alarm, never false pass) — not worth re-opening a landed migration, but convert it when that
file is next touched. *The habit is the defect, even where this instance is safe.*

**Also durable, and better than the design it replaces:** `328` **K9b now asserts the OFF flag set is
EMPTY** rather than naming a flag, so it cannot go stale the next time a wave ships. The K9b/K9c
coupling exists to force flag choreography to be an explicit reviewed edit; this makes it survive
its own success.

### 🔵 IN PROGRESS — **DM5: Wave D + retirement** (opened 2026-08-14) — the program's FINAL phase

> **Plan:** [dm5-wave-d-retirement-plan.md](docs/plans/dm5-wave-d-retirement-plan.md) ·
> **ADR [0120](docs/decisions/0120-dm5-wave-d-retirement-decisions.md)** (D1–D10, PO-ruled
> 2026-08-14 before any SQL) · **step 0:** [dm5-surface-verification.md](docs/progress/dm5-surface-verification.md)
> (`005fe34d`). Window `20260927000100`+ · pgTAP **`341`** · flag `documents_wave_d`.
>
> **Step 0 found two hard blockers the parent plan did not know about**, both re-verified by the
> lead directly against the catalog before rulings were taken:
> ① **`securable_resources` admits only 6 types** and its `tenant_shape` CHECK **re-enumerates the
> same list**, so widening one CHECK alone fails every insert closed — Wave D evidence and
> form-response prints have no home. ② **`UNIQUE (document_version_id, rendition_kind)`** permits one
> `printed_pdf` per version, against `printed_documents_one_active`'s *partial* unique retaining many
> historical prints. Plus **six places the plan describes a system that does not exist** — the
> manifest is **8 buckets not 9**, the verification-token "satellite" is not a table, and
> `rca_evidence`'s parked FK is **triple-locked**, not single.
>
> **PO rulings 2026-08-14 (ADR 0120):** **R1** three new securable types (`rca`, `capa_action`,
> `form_response`), commission pinned to **reporting** with custody staying a read-time input ·
> **R3** all four `source_kind` values migrate, so the manifest closes at 8/8. ⛔ **R2 and R4 were
> RE-RULED the same day and are WITHDRAWN — see below.**
>
> ⛔ **ADR 0120 D3/D4/D5 WITHDRAWN 2026-08-14, never built; D11 replaces them.** Printed renditions
> follow the **existing new-version idiom** — each print mints a `document_version`, binds its bytes
> as that version's `printed_pdf`, records supersession on `printed_documents`, retires superseded
> bytes via `file_objects.disposal_state`. **`document_version_files` is not touched**: no liveness
> column, no partial unique, no guard exception, **no DM1-invariant amendment**. **S1 is withdrawn
> as a slice**; its window is released to S2.
>
> **Why — four facts, each verified live before the re-ruling.** ⭐ **DM2 had already evaluated and
> rejected D3+D4 BY NAME** (`dm2-orchestration-wave-a.md:253-281`: *"Option 2 (partial UNIQUE +
> liveness column + guard exception) remains strictly worse: an invariant edit for no additional
> honesty"*) · **S2.8 was never parked** — ruled, **built** (`20260924000500`), ADR'd at 0118 and
> keystoned at `329` R6/R7/R8, shipped as `reclassify_document` + `complete_document_reclassification`
> · `app.guard_document_version_immutable()` is **SHARED with `document_versions`**, so D4's
> "narrow exception" reached the table ADR 0114 **D10** protects with *"never a pointer update
> (F-03)"* · the "incompatible cardinality" compared **two keys that never meet**
> (`(document_version_id, rendition_kind)` is per-**version**; `(source_kind, source_id,
> template_key)` is per-**source**) — an artifact of the lead's framing, on an unrecorded
> many-prints-to-one-version assumption.
>
> ⛔ **Root cause, and it has now misled TWICE:** `docs/backend-state.md:245-246` said *"Still
> unbuilt: S2.8 … no legal expression"* — written at DM2 S2 close, never updated when S2.8 landed
> **hours later**. DM3's planner hit it and **caught** it; DM5's lead hit it and **did not**, and it
> produced an ADR decision. ⭐ The verdict was keyed to the **noun** `reclassify_document_file` —
> genuinely absent from `pg_proc` — while the **capability** was live under another name. *Resolve
> the VALUE, not the noun.* Corrected in the same change. **Nothing was built on D3–D5**; the cost
> was one planning cycle, because the check happened before SQL.
>
> **Lead ruling, not a PO question:** the parent plan's retirement method — "prove empty via the
> Storage API, then delete" — is **WITHDRAWN**. It proves emptiness against `storage.objects`, which
> a reset truncates while the bytes survive: measured **0 metadata rows vs 699 objects / 7.0 MB, 198
> PHI-tier**, `list` returning `[]` for all 12 buckets. Replaced by **manifest-first deletion**
> (capture keys → delete by key → assert `deleted_count == manifest_count`). ⚠ **Calibration:** the
> orphans are **not servable** (every read path resolves metadata first) — this is a data-at-rest /
> disposal-assertion problem, not a live exposure. Closes the method half of **FUP-DM5-STORAGE-ORPHANS**.
>
> ⚠ **The assurance plan is WORSE than DM4's.** Every door DM5 adds sits in a census blind class, so
> all four §6 arms pass **regardless of what is built** — bespoke keystones + mutation twins are
> mandatory, and the record names the **arm**, not the script. Red-first is genuinely hard here: a
> keystone against the un-parked `add_rca_evidence` **goes green on its first run**, satisfied by a
> *sibling* lock (the table CHECK). **FUP-PGTAP-VACUOUS applies directly** — `lint:vacuous` does not
> scan SQL and every DM5 keystone is SQL.
>
> **Later rulings 2026-08-14 — D12 (PO) + D13 (lead), both gating S3.** **D12:** printed bytes are
> served by **composition** — `open_printed_document` keeps `can_view_printed_document`, the
> revoked/superseded overlay and the token path, and **delegates byte resolution to the core door**.
> Forced by two facts: `open_document_version` hardcodes `rendition_kind = 'source'` (so a
> print-only version is unopenable through it) and `file_objects` may only live in the two document
> buckets, which carry **no SELECT policy** because ADR 0114 **D8** reserves them for *"the **single**
> audited door … (the F-01 class dies structurally)"*. ⚠ The shared resolver must be **`app`-scoped,
> never `public`**, authority the **conjunction**, and **both** refusal directions keystoned.
> **D13:** a print mints its version on its **OWN `documents` row**, never appended to a content
> document — else `add_referral_shared_item`, which picks latest-version-desc, would silently
> **freeze a printed PDF into a referral snapshot instead of the source content**. Invisible to every
> static gate; keystone the separation itself.
>
> ✅ **S2.8's three DM2 conditions re-verified as ALL DISCHARGED** (by behaviour, not by name —
> because withdrawing D5 on an unverified completion would have been the same error twice). Condition
> 1 was **exceeded**: QA r1 found R6/R7/R8 all stayed green under a `live` relaxation that kills the
> invariant for two simultaneously-pending duplicates, so R10a/R10s pin the exact
> `disposal_state = 'none'` spelling. Nothing from S2.8 becomes a DM5 item.
>
> **Slices:** **S0 ✅ COMPLETE** (`0e85cbe7`, `9d37ad79`) — `scripts/storage-manifest.mjs`, **8/8
> self-test controls**, baseline for the 8 buckets, `document-reconciliation.mjs` widened 2→**12**.
> ⭐ **C8 was added unprompted and is the discipline generalizing**: C2 proved the tool *refuses* a
> bad manifest, but *a tool hardwired to refuse everything passes C2 and is useless* — C8 is the
> permissive twin. That is the both-polarities rule applied to the harness itself.
> ⭐ **Three of the eight controls found real defects**: `find` on a *missing* directory emits the same
> empty output as an *empty* one, so an absent bucket read as verified-empty (now `—` vs `0` vs `?`);
> `storage.protect_delete()` **blocks `storage.objects` DML on this stack** — a platform guard
> absent from the step-0 model, so the harness plants bytes directly; and C8 was the missing
> permissive half. ⚠ The committed baseline
> **self-labels DEGENERATE** (zero API-visible keys while bytes exist = the post-reset state) and
> **must not be reused as S4 input**. Orphan counts, domains stated because they differ: **221 keys /
> 6.93 MB / 15 PHI** over the 8 retirement buckets; **699 / 7.02 MB / 198 PHI** over all 12.
> ~~S1 substrate amendment~~ ⛔ **WITHDRAWN** · **S2 🔵 IN PROGRESS** · S3 printed renditions
> (D11/D12/D13; **no longer blocked**) · S4 retirement execution · S5 operational closure · S6 canon + sweep.
>
> **S2 progress (2026-08-14).** Contract posted **first** (`fec8a84f`) + amendment 1 (`6a3fbf2a`);
> `frontend` spawned against it and building in parallel. **M1 applied** (`e386505f`), types
> regenerated (`ca0b5ab5`, after the reset and **before** `test:db` installs `pgtap` — that
> pollution has bitten this repo). Verified **against the applied migration, not the file text**:
> registry **392 == 392** · both CHECKs carry `rca` + `capa_action` · `tenant_shape` carries **both
> shapes** · `rca` registry commission = `event.reporting_commission_id` (D2) · `capa_action`
> commission **NULL** (D14) · `hospital_of_capa_action` non-NULL (D16) · composite FKs present ·
> **pgTAP 191f/6231 PASS — the DM4 baseline exactly, zero regressions.**
> ⭐ **The D1 coupling is PROVEN, not assumed:** with only `type_check` widened, a **fully tenanted**
> `rca` row is still rejected `23514` — fully tenanted *deliberately*, so the rejection can only come
> from `tenant_shape`'s type list; a minimally-tenanted fixture would have proven nothing. All three
> `tenant_shape` cases were shown to **discriminate before** being written as keystones.
> **`capa_action.commission_id` is left NULL for EVERY row**, including the four sources where it is
> derivable — *a half-populated column invites a future reader to treat it as authoritative*, so the
> NULL is a deliberate signal rather than an absence.
>
> **M2 `…000110` applied** (`5fd60ff1`) — `can_read_document` kernel arms, custody-following.
> registry **393 == 393** · `rca` arm resolves `can_read_event(event_of_rca(…))` at read time and a
> catalog assertion pins that it does **NOT** use the registry commission · `capa_action` arm names
> `can_read_capa` **explicitly** (it *would* fail closed reaching for the D14 NULL commission, but
> fail-closed-by-accident is not a design) · pgTAP **191f/6231 unchanged**. Applied with
> `migration up --local`, not a reset — non-destructive, `frontend` undisturbed.
> ⭐ **Building the fixture BEFORE the keystone found two things a keystone-first order would have
> hidden.** ① **The seed has no custody-moved event** — all five carry
> `current_owner_commission_id` NULL — so **that arm of `can_read_event` has never been exercised by
> any test in this repo**. A pre-existing coverage gap DM5 merely tripped over; `341` now pins it.
> ② **A raw `UPDATE` cannot create the state** (`guard_event_status()` refuses edits past `triado`),
> so a keystone written first would have failed **at fixture time and read as a defect in the arm
> rather than in the fixture**. The differential runs through the real `transfer_event_custody` RPC,
> which is also the more honest test — it proves the arm under the transition the product performs.
> ⭐ **The persona was checked against all three arms, not assumed:** `multi@test.local` (both
> commissions) and `pqsdual.a@test.local` (PQS of the hospital) would each have turned the
> differential green while proving nothing — the two-locks shape. `staff1.farm` verified as *not*
> PQS, *not* in the reporting commission, *in* the owner commission ⇒ only custody can make it true.
> ⭐ **Technique to repeat in S3:** the `CREATE OR REPLACE` rebuild was **proven faithful by diffing
> the rebuilt `pg_get_functiondef` against the captured original** (diff = exactly the 15 new arm
> lines + 3 comments), plus a `DO` block re-asserting `prosecdef` / `STABLE` / the `search_path` pin
> / the `authenticated` EXECUTE grant **from the catalog**. *Reading a body carefully is not the same
> as proving you reproduced it* — this converts the silent-property-loss class
> ([[guards-that-read-right-but-fail-open]]) into a loud failure at apply time.
>
> **S2 frontend ✅ COMPLETE** (`5793fd16`) — 13 files, +1129/−476. `openUrl` is gone, so rows render
> **no `<a href>` at all**: there is no storage coordinate left in the projection to link to, and bytes
> resolve one at a time through the audited door strictly on click (D8). `canOpen` is obeyed verbatim,
> never re-derived — it decides what to **draw**, the door decides what to **serve** (Rule 1).
> Contract amendment 1 landed *before* ship, so the `terminal` heuristic was **deleted, never
> shipped**; `credential.expiresAt` pre-empts a lapsed reservation so "expired" never reads as
> "broken" at the 120 s PHI TTL. Gates: tsc 0 · lint **5/5**, eslint 0 warnings · vitest 1264/1264.
> **Fork ledger** (recorded so the duplication reads as *chosen*, not accumulated): reused outright —
> `DocumentAvailabilityBadge`, `AVAILABILITY_PRESENTATION`, the MIME/size constants,
> `uploadDocumentFile`; forked deliberately — the open-button **shell** (~25 lines: its contract is
> *"every Wave-A byte moves through THIS control"*, so injecting a different door would falsify the
> one sentence that makes it meaningful) and the upload dialog (Wave-A's carries kind /
> confidentiality / occurredOn that NSP evidence has none of; only the **transport choreography** is
> genuinely shared). `CapaEvidenceList` / `RcaEvidencePanel` were **NOT** forked — re-pointed.
> ⭐ **`unavailable` handled by NARROWING THE REFERENCE, not widening the type:** the
> `DocumentAvailability` import is deleted, the badge map is keyed
> `Exclude<NspEvidenceAvailability,'available'>`, and the `unavailable` **badge entry is deleted** so
> no dead branch can render — the word survives only in the error map, where `HC0D8` genuinely is
> reachable (servable at render, gone by the click). A green typecheck would have been satisfied by
> *either* resolution; only asking which one distinguishes them.
> ⚠ **Runtime-unverified by design** — every action/query signature still throws
> `not implemented — DM5 S2`, so both pages 500 on the list queries until backend lands the bodies.
> Expected under contract-first; **`tester` must not read it as a frontend red.**
> 🔧 **History repair:** `e1557179` shipped with a mangled message (PowerShell here-string in the
> Bash tool — the commit *succeeds*, only the message is wrong, so nothing fails loudly). Frontend
> **correctly refused to `--amend`**: the lead had committed on top, so the reflex fix would have
> rewritten the LEAD's commit — the exact documented failure mode, and the prohibition earned its
> keep. Lead rewrote both commits via safety-branch + `reset --soft` + separate restage;
> **tree hash `abbe887c…` identical on both sides**, verified independently by frontend afterwards.
>
> **Two lead errors this slice, both recorded because they are the same class as the phase's other
> findings.** ① I told backend the upload ticket lacked `expiresAt`; it was at
> `evidence-contract.ts:202` all along — **my grep pattern never contained the term**, so I reported
> an absence from a search that could not have found it. ② My S2 task brief told `frontend` the new
> availability states were `pending/failed/disposed/unavailable`; there are **three** new states and
> `unavailable` is not among them. ⭐ Rule drawn: *the search that proves an absence must NAME the
> thing* — quotable is not the same as capable. Same family as `\yname\y` failing before `_` and the
> `.rpc('X')` sweep that missed a line-wrapped call site.
> ⚠ **`unavailable` is correctly ABSENT from `NspEvidenceAvailability`** — both NSP projections
> filter `.is('deleted_at', null)` (`rca.ts:258`, `capa.ts:366`) so it is unreachable, while
> `documents.ts` has **no** such filter, which is why the twin carries five. Tied in the doc comment
> to the **filter**, not to intent, so removing the filter makes the omission visibly wrong rather
> than quietly stale. Adding it would have been dead vocabulary reading as live behaviour — the same
> reasoning that keeps `HC0DM` out of the error map.
>
> ⛔ **State:** branch `main`, **NOT pushed**. All five DM flags ship **OFF**.
> ✅ graphify refresh **discharged** `02cec1a0` (was owed since the DM0–DM3 merge).
>
> **New this phase:** 🟡 **FUP-DM5-GRANTS** — `rca_evidence` / `capa_action_evidence` carry table-wide
> `arwdDxtm` to `authenticated`, so their RPCs are **not single doors**. ⚠ Calibrated: RLS *is* on
> with genuinely distinct read/write predicates, so this is hardening, not an open door — but DM5
> must not assume the RPC is the only writer when placing the `documents_wave_d` assert.


---

## S2 — NSP RCA/CAPA evidence onto the substrate: CLOSE

> ⛔⛔ **THE FIGURES IN THIS SECTION ARE THE FIRST CLOSE'S AND THEY ARE VOID.** This close was
> **rejected** — S2 was reopened at `52242f26` because the feature **did not work at all** while every
> figure below was green. **The section is retained verbatim as evidence of what a green close can
> assert**, and because its sub-sections on the arms, the ACL habit and the recurring classes are still
> accurate and durable. **Do not cite the gate-figures table.**
>
> ✅ **The REAL, current S2 figures** — re-measured by the lead on a fresh reset at HEAD `e2af9790`,
> tree clean, 2026-08-14: **8** migrations `20260927000100`–`000170` (not 6) · registry **399 == 399**
> (not 397) · pgTAP **192 files / 6284** (not 6272) · tsc **0** · lint **5/5** · vitest **1294** (not
> 1264) · all four arms **HOLD** (census 546/569 · hat 3 · floor 74 · wrapper BLIND 41) ·
> degenerate-body sweep **0** · diff-scoped sweep **COVERED / BLIND 0 / 1 case executed**.
>
> ⚠ **Why this banner is loud, and in prose rather than an HTML comment:** ADR 0120's own withdrawal
> root-cause #3 was *"the superseded text was marked with an HTML comment — invisible in rendered
> Markdown, so I quoted dead text as current. **A supersession marker only a raw-file reader can see is
> not a marker.**"* The reopen banner sits ~200 lines above this heading, under a different one; a reader
> who lands here by search or link would never see it. **That is the same failure, one file over.**

Migrations `20260927000100`–`000150` (6) · pgTAP `341` · ADR 0120 D1/D2/D10/D14/D15/D16.

### Gate figures (fresh `supabase db reset`) — ⛔ VOID, see the banner above

| check | figure (VOID) |
| --- | --- |
| registry | **397 registered == 397 files** |
| pgTAP | **192 files / 6272 tests PASS** |
| reconciliation | `341`: 30 to 41 · repo: 6261 to 6272 · **both +11** |
| tsc / lint / vitest | 0 · 5/5 · 1264/1264 |

### The four authz arms — named as arms, not as the script

| arm | the question it asks | result |
| --- | --- | --- |
| `ARM=census` | has anything **ever asked** about each live gate? | **HOLDS** — live 546 / verdicts 569 |
| `ARM=hat` | does any door read `memberships` **without the caller's hat**? | **HOLDS** — 3, all reasoned-allowlisted |
| `ARM=floor` | is every door **actually called**? | **HOLDS** — 74 never-called, all allowlisted |
| `FROMFINDINGS=1 ARM=wrapper` | `prosecdef = f` invoker wrappers | **HOLDS** — BLIND 41, all allowlisted |

**`ARM=census` stayed at 546 live, and that is correct, not an oversight.** No S2 function
qualifies as a census door: `app.assert_documents_wave_d_enabled` is `prosecdef = f` returning
`void`; `ensure_securable_resource_rca` / `_capa_action` return `trigger`; `add_rca_evidence` /
`add_capa_action_evidence` are composite-returning — the **pre-existing** 141 blind class, not
growth. `can_read_document` was already in the domain; the policy swap was net-zero. So **no new
door needed to join the census domain or the findings file.**

**Signature-keyed artifacts re-checked after the parameter change** — a signature change orphans a
signature-keyed entry exactly as a rename does. `authz-neverclled-door-allowlist.txt:37` updated in
the migration's own commit; findings file carries no entry for either door; line 41 deliberately
untouched (DM4's retired surface, FUP-AUTHZ-ALLOWLIST-ROT's positive control).

### Diff-scoped door sweep — 1 case COVERED, with its DOMAIN stated

Gate list derived from the migration diff (8 gates).

```
PREDICATE ARM:  COVERED  app.can_read_document(p_document_id uuid, p_uid uuid)
POLICY ARM:     (empty)
BLIND: 0   ERROR(harness): 0        over a domain of ONE
```

WARNING: the first run executed **zero cases** and printed `BLIND: 0` — indistinguishable from
clean. `CASES` matches bare `proname`, space-separated, exact; a pipe-delimited string is one token
matching nothing. **Not cited.** The re-run's nonzero count is what makes the verdict citable.

**4 of 5 requested gates are outside the harness's domain and were NOT swept** — recorded as
unswept, never as clean: `add_rca_evidence` / `add_capa_action_evidence` (composite-returning),
`hospital_of_capa_action` (uuid-returning), `capa_evidence_obj_insert_writable` (the policy arm
enumerates `public.*`; this policy is on `storage.objects`). Their only coverage is `341`.

Both runs overwrote `docs/reviews/authz-door-audit-findings.md`; restored with `git checkout --`
and the tree verified clean each time.

### The `…000120` REVOKE — FACT: falsified, then fixed

**Not a confirmed inference.** The reset did not confirm the hand-applied delta — **it falsified
the file.** That PUBLIC assertion had *never executed*: it was added while repairing an
already-registered migration, so only the hand-applied REVOKE ever took effect, and the corrected
file first ran at the reset, where it failed.

**"File and DB agree" is not "the file works."** Both agreed, and both were checked. Recording the
reproduction as fact then would have carried a broken migration into the gate with a green local
stack agreeing with it.

Now fact on a fresh reset: `anon_exec = false` on both doors; PUBLIC holds no EXECUTE
(`aclexplode … grantee = 0` false); 0 first-party `public` functions anon-executable.

### One habit, two opposite failures — the substring ACL test

`acl like '%=X/postgres%'` matched **every** function (PUBLIC is an aclitem with an *empty*
grantee, so it also matches `postgres=X/postgres`) — false positive in `…000120`. The variant
guarded with `and not like '%postgres=X/postgres%'` was **structurally incapable of firing** while
postgres held a grant — vacuous guard in `…000130`/`…000150`. *Asking a string a question only
structure can answer.* All sites — plus `…000110`'s presence check and `341` D4d — now use
`aclexplode`, with `D4e` added for the direction a presence check cannot see.

### Durable mechanism fixes (not phase details)

- **K9b asserts the OFF set is EMPTY** rather than naming a flag: it cannot go stale the next time
  a wave ships. A fix to the coupling mechanism itself, better than the coupling as designed.
- **`…000140` kept as its own migration** so BUG-DM5-CAPA-1's red was provable against the pre-fix
  catalog, and re-measured at HEAD `3b51c20d` (tree clean) rather than inherited from step 0.

### Recurring classes — counted, because the recurrence is the finding

- **Syntax-bounded enumeration: THREE instances**, three different authors' contexts, one shape —
  *the boundary was a syntax, not the property*: step 0's `.rpc('X')` sweep missing a line-wrapped
  call; the lead's `expiresAt` grep whose pattern never contained the term; this slice's derivation
  regex matching only `create or replace function` and missing a bare `create function`.
- **Text-as-truth: THREE instances** — the substring ACL tests (two opposite directions) and
  `prosrc like '%HC0DM%'` firing on the migration's own comment.
- **Measured vs. reasoned** — every claim produced by measurement held; every claim produced by
  reading and reasoning needed correction. That split, not authorship, is the phase's lesson.

### A code-design decision to defend against future "improvement"

`HC0D8` is raised for **both** absence and wrong-home/unreadable, deliberately: an error
distinguishing *"does not exist"* from *"not yours"* is an **existence oracle**.

Its cost, discovered live: **the ambiguity that blinds an attacker also blinds the test.** `341` F7
asserted `HC0D8` and received `HC0D8` — from "no such document", not "you may not read it" —
passing vacuously while F4/F6 went visibly red. **When a door answers one code for several causes,
a test asserting that code proves nothing about which cause fired; the discriminating fact must be
pinned separately, before the assertion runs.** `F5b` does that. The same shape applies to D12's
conjunction in S3.

### For `tester` — one seam a UI spec cannot reach

The **direct-PostgREST-DML path**: both evidence tables carry table-wide `arwdDxtm` to
`authenticated`, so a client can `POST /rest/v1/rca_evidence` without traversing the RPC. That is
why the shape rules are CHECKs and the flag is an assert. A UI-driven spec always goes through the
action and can never exercise the bypass — `341` F8 covers it in SQL. **A correctly-drawn boundary,
not a coverage gap.**
