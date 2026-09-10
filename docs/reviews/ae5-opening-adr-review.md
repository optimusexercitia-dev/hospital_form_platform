# QA Review — AE5-OPENING-ADR (pre-AE5 remediation Batch 9)

**Reviewed:** branch `authz-ae5-opening-adr`, tip `ed80da4c` (13 commits ahead of `main` @
`55e440c3`). **Reviewer:** qa. **Date:** 2026-09-10.

**Verdict: CHANGES REQUESTED**

**2 BLOCK · 2 MAJOR · 7 MINOR.** Every measurement this batch made that I re-derived
**reproduced exactly** — the blast-radius table, the 14/12 door closure, the catalog rows, the
D/M census, the five `search_path` values, the four staleness corrections. The batch does not
fail on a measurement. It fails on the thing the plan §4 step 5 says every blocking finding
across Batches 0–8 has been: **prose written beside a correct measurement that no gate can
contradict.** Here it is the batch's own product — **two of the fourteen PO rulings are recorded
only in the progress log, and both ADRs actively assert that those questions are still open.**

---

## Scope and method

Read: the hub (`docs/features/ae5-opening-adr.md`), the full record
(`docs/progress/ae5-opening-adr.md`, all nine dated entries, 1,030 lines), plan
`docs/plans/pre-ae5-remediation.md` §3's Batch 9 block with its three amendment banners and §4,
ADR 0201 (353 lines) and ADR 0203 (253) in full, the three subject follow-up bodies and their
register rows, `docs/decisions/INDEX.md`, `proposed-review.json`, `docs/features/INDEX.md`,
`docs/learning/LESSONS.md` rows LEARN-095/096, `.claude/rules/prosrc-is-not-the-whole-function.md`,
`docs/lead-playbook.md`'s R14 line, `docs/plans/authz-evolution.md` § Per-role checklist, the
manifest's three `legacyEquivalence.qualifier` fields, `docs/progress/phase-ledger.md`'s Batch 7
and Batch 8 rows, and `git show 354fd6b0` / `git log -1 ed80da4c`.

**Re-measured against the live catalog** (`supabase_db_azkbbhskturikxpgmafq`, head pair confirmed
`(20261003007360, 525)` before anything else; ⛔ never migration text, ADR 0078):

| what | result | verdict |
| --- | --- | --- |
| `is_active` term, comment-stripped, in `app.is_admin` / `app.is_admin_for` / `public.assume_role` vs the `app.is_org_admin_of_for` control | **f · f · f** vs **t** | reproduces |
| blast radius, counts **and** sets — `is_admin_for`: policies / raw / real-call; `is_admin()`: same | **0 / 6 / 5** and **26 / 32 / 13**, the 5-name set identical, the 6th mention comment-only in `app.affiliate_person_impl` | reproduces exactly |
| Class-2 door closure through the five predicates, `prosecdef` + `authenticated` EXECUTE on each | **14** distinct `public` doors, all `prosecdef=t` with `authenticated` EXECUTE; `app.can_read_professional_profile`'s `is_admin_for` short-circuit `return true`s **before** any `can_manage_professional` call | reproduces; **14 in the closure / 12 affected** is right |
| `authz.roles` `platform_admin` | `allowed_scope_kind = none`, `state = legacy` | reproduces |
| `authz.permissions` `org.professionals.manage`; grants; implications | `identity` / `authority` / `class2_professional_identity` / `organization`; `role_permissions` grants **0**; `permission_implications` **0 rows**, closure **reflexive only** | reproduces — held by nobody |
| readers of `risk_class` / `sensitivity_ceiling` / `resource_kind` over `pg_proc`, `pg_policies`, `pg_views`, matviews, `src/`, with the `resolution_scope_kind` **control** | **0 / 0 / 0** on every runtime surface; control **3** (`has_permission`, `candidate_has_permission`, `explain_permission`) | reproduces; the control licenses the zeros |
| `session_selectable` readers (0203's Correction 2) | **1** — `public.assume_role` | reproduces: the no-reader list is **4 → 3** |
| `D`/`M` census, per the follow-up's own definitions and `authz.authorized_scope_ids`' live body | `M` min 1 / max 3 / avg 1.30 over 33 seated; `D_org` 1 · `D_hosp` 2 · `D_comm` 2; tenancy 3 orgs / 4 hospitals / 6 commissions / 43 memberships; `D ≤ M` confirmed from the one-candidate-per-fact CASE | reproduces exactly |
| distinct `search_path` values over `prosecdef` functions in `app`/`public`/`authz` | **5** — 825 / 39 / 23 / 2 / 1; `public.tenant_orphan_profiles` the inverted singleton | reproduces (⚠ 5 holds only under the `prosecdef` scoping the follow-up states; without it, 7) |
| `dispose_*` doors, any schema | **4** — `dispose_case_phi`, `dispose_event_phi`, `dispose_meeting_minutes`, `dispose_referral_phi`. `dispose_attachment_phi` **absent** | reproduces: A30's bucket-C name is stale |
| `authz.entailed_grants` — the `§6A ASYMMETRY` comment, the `hat_ok` predicate, and the instrument note | comment and predicate **verbatim** as ADR 0201 quotes them; `prosrc ~ 'hat_ok'` = **f** for `entailed_grants`, **t** for all three consumers; `pg_get_function_result` carries `hat_ok boolean` | reproduces, control included |

**Re-ran, exit codes read BARE (zsh — `pipestatus`, never piped):**

- `npm run lint` → **rc 0**, 17 of 17 arms (`package.json`'s `lint` chain splits to 17 on `&&`),
  eslint 0 errors / 0 warnings.
- `npm run typecheck` → **rc 0**.
- `SELFTEST=1 bash scripts/door-sweep-selftest.sh` → **rc 0**, `SELF-TEST: PASS 46 · FAIL 0 ·
  SKIPPED 0`, groups `20/20 · 18/18 · 8/8`. `/bin/bash --version` = **3.2.57(1)-release
  (arm64-apple-darwin25)** — i.e. the R13 fix is verified on the shell that produced the red.
- `git diff --name-only main... -- supabase/migrations supabase/seed.sql src` → **0 bytes,
  EMPTY**. The batch's defining claim holds. Full diff scope is `.claude/rules`,
  `docs/{decisions,features,followups,learning,plans,progress}`, `supabase/tests/mutation` (three
  harnesses) and `supabase/tests/vectors`.

**Not run, deliberately:** `npm run test:db` and the four authz arms (the spawn instruction
reserves the fresh reset other figures depend on) · `npm run test` (vitest) · `npm run e2e:prod`
(see § E2E below) · the eleven grains behind *"reproduces at no grain measured"* (I verified the
numerals are verbatim in the live comment and mirrored at `401:1111-1112`; I accept the ADR's
careful non-claim rather than re-deriving eleven negatives).

---

## Findings

### ⛔ BLOCK-1 — PO ruling R11 is recorded nowhere but the progress log, and ADR 0203 asserts the opposite

**Requirement violated:** hub § Acceptance criteria box 1 sub-item 2 (*"the classification columns
… a consumer appears, or the column is removed with a reason"*), ADR 0176 D8 (`0176:153-155`,
verified verbatim), and CLAUDE.md §5's *"a decision superseded by an ADR amends the corpus"* —
the ADR is the durable home for a ruling, the record is its log.

**Measured.** The record at `docs/progress/ae5-opening-adr.md:790-795` reads:

> *"**PO ruling R11 — ADR 0203 D3: KEEP ALL THREE classification columns**, each owing a **named
> layer-3 consumer**, with `session_selectable` cited as the precedent that a consumer does
> eventually appear."*

ADR 0203, committed in `7365c2e6` — **the same commit whose message is
`docs(batch9): PO R11/R12`** — still carries, unamended:

- `:3` **Status:** *"⚠ § Decision **D3 is `PO to rule`** and is deliberately left open"*
- `:198` **D3** *"— the disposition of `risk_class`, `sensitivity_ceiling` and `resource_kind`:
  `PO to rule`. ⛔ Deliberately open."* … *"⛔ **No default applies while D3 is open**"*
- § Considered options `:203` *"**For D3 — the three columns.** ⛔ **Decision: `PO to rule`.**"*
- § Consequences *"the follow-up register keeps a `Status: open` entry pointing at D3"*

Command: `grep -n "R1[1-4]" docs/decisions/0201-*.md docs/decisions/0203-*.md` → **rc 1, no
matches**; `grep -rn "ruling R1[1-4]" docs/` → the record only.

**Why this blocks.** The PO chose option **(C)** — the branch that carries a *cost*: three named
layer-3 consumers plus three RED-first gates, sequenced against AE5 increment 1. If 0203 ships
`accepted` with D3 open, the corpus records as undecided the one half of ADR 0176 D8 that D8
requires decided *before* AE5, and the option's obligations (a named consumer per column, a date,
the sequencing ruling) exist in no register. 0203's own D3 forecloses the fallback in writing:
*"No default applies while D3 is open."* The Status line will also be false the moment the Record
step flips it to `accepted`.

**Owed:** rewrite 0203 `Status:` and D3 to state R11 with its recorded rationale (the § 7
invariant loss **plus** the loss of `:408`'s discrimination control; `session_selectable` as the
worked precedent), promote option (C) to ✅ CHOSEN in § Considered options, and rewrite
§ Consequences' *"the register keeps an open entry pointing at D3"* into the concrete obligation
R11 creates. `FUP-…` routing for the three named consumers needs a home.

### ⛔ BLOCK-2 — PO ruling R12 is recorded nowhere but the progress log, and ADR 0201 **and** the corrected register clause both state the opposite

**Requirement violated:** hub box 2 sub-item 4 / PO ruling R3's third site, and PO ruling R6's
*"correct both register clauses now, before Batch 10 opens against them"*. Security-relevant:
this is the `is_active` gating of the door that **mints** the platform-admin hat.

**Measured.** Record `:797-800`:

> *"**PO ruling R12 — ADR 0201 D4: gate `public.assume_role` TOO, in the same Batch 10 change**,
> with its own RED-first pgTAP cell. Rationale recorded: gating the two checks while leaving the
> **seating** door ungated would make the fix *read* as complete while a deactivated admin could
> still put the hat on. ⇒ Batch 10's `is_active` scope is now **three** sites, not the two R3
> named."*

Three surfaces a Batch 10 reader would consult say the opposite:

1. `docs/decisions/0201-the-keying-asymmetry-is-the-model.md:152` — *"⚠ **`public.assume_role` is
   a NAMED THIRD SITE and is deliberately left UNRULED here.** … Whether the door that *mints*
   the hat should also test account state is a distinct question, put with the rest of Batch 10's
   shape."*
2. same file `:344` — *"It does not rule `public.assume_role`'s `is_active` term (D4's named third
   site) …"*
3. `docs/followups/FUP-CAN-MANAGE-PROFESSIONAL-SELF-CHECK-ADMIN-ARM-IGNORES-IS-ACTIVE.md`, final
   line — *"⚠ **A THIRD site the clause still does not name:** `public.assume_role` itself.
   Whether it also gains the term goes to the PO with Batch 10's shape — ⛔ it is **not** silently
   in scope here."*

**Why this blocks, and why it is worse than BLOCK-1.** Plan §3's amendment banner 4 routes Batch
10 explicitly: *"whoever opens Batch 10 derives its scope from the unit record's R3/R4 entries and
the corrected register clauses, not from a placeholder."* The corrected register clause is one of
the three surfaces that excludes `assume_role`. So the batch's own hand-off instruction points
Batch 10 at documents that contradict R12 — and R12's own recorded rationale names the exact
failure mode that produces: *the fix reads as complete while a deactivated admin can still put
the hat on.* I confirmed the mechanism from the catalog: `public.assume_role`'s `platform_admin`
branch tests only `exists(select 1 from public.profiles where id = v_uid and is_admin = true)`,
the whole function contains no `is_active` term, and its only other gate is
`authz.roles.session_selectable`.

**Third limb, same defect.** The record `:802-806` states *"**0201 D5 closed without a fresh
question** … **R4 stands on the SURVIVING reason**"*. ADR 0201 still says in two places that it is
open — § Considered options (*"whether that reason is *sufficient* is the PO's call, travelled
with this draft"*) and `:344` (*"nor whether D5's surviving Option-2 reason is *sufficient*"*).

**Owed:** rewrite 0201 D4's third-site paragraph and its § *What this ADR does not do* to record
R12 (three sites, each with its own RED-first cell) and R12's rationale; record the D5 closure and
the reaffirmation basis; and rewrite the follow-up's final paragraph — ⛔ per R6's own instruction,
with the superseded wording quoted in place rather than overwritten. Note also that the `hat`
arm's allowlist carries `public.assume_role` with a reason derived before R12 (the record flags
this at the gate table); that reason now needs re-deriving in Batch 10, and only the record says so.

### ⚠ MAJOR-1 — the hub's `## Current state` is stale in four of its six sections, and asserts a live blocker I measured green

**Requirement violated:** CLAUDE.md §7 / ADR 0186 D3 — the hub's `## Current state` **is** the
unit's summary, replaced never appended; it is the surface the Phase Gate step 4 presentation is
built from. `lint:progress` and `lint:registers` enforce shape, never truth.

`docs/features/ae5-opening-adr.md` says **Updated: 2026-09-10**, yet:

| section | what it says | measured |
| --- | --- | --- |
| Done since start | *"**Twelve PO rulings taken** (R1–R12)"* | **fourteen** — R13 and R14 are in the record at `:905` and `:914` |
| In progress | *"Awaiting the PO's disposition on the one instrument red before QA"* | that disposition **is** R13; it was taken, executed, and independently verified |
| Next | *"PO disposition on the `SELFTEST` red (file only, or file **and** ride the three-site fix along)"* and *"two lessons (…)"* still owed | the disposition is taken, the fix landed, and **LEARN-095/096 are already written** (`docs/learning/LESSONS.md:118-119`); the lesson that *is* owed — the `git add -A` one — is not listed |
| Blockers | *"`SELFTEST=1` exits **1** (`PASS 40 · FAIL 6`)"* and *"It **blocks Batch 10**"* | I ran it: **rc 0, `PASS 46 · FAIL 0 · SKIPPED 0`** under `/bin/bash 3.2.57`. The stated blocker does not exist |
| Done since start (gate figures) | omits `SELFTEST` from the tip figures | 46/46 rc 0 is the tip result |

The record is correct throughout; only the summary is stale. But a human approving at step 4 from
this hub would be told a blocker exists that does not, and would not be told two rulings were
taken. Fix is a replacement of the four sections.

### ⚠ MAJOR-2 — ADR 0203 miscites three times, one of them a quote attributed to a file that does not contain it with the watching relation inverted

**Requirement violated:** LEARN-096's own twin, as this batch worded it — *"the class is **the lead
asserting a LOCATION rather than measuring it**"* — and ADR 0195's *a committed number needs one
home*, applied to a pointer.

ADR 0203's header states: *"0172 § 4 (`0172:102`) defers column **CREATION** for
`sensitivity_ceiling`, `assignable` and `applies_to_descendants` — and its own amendment at
`0172:114-119` **overturned** that for `sensitivity_ceiling` on a PO ruling of 2026-09-01"*. The
same two anchors are repeated in § Problem's FRAMING CORRECTION 1.

Measured — `grep -n "^### \|Not-created is chosen\|EXPIRED" docs/decisions/0172-*.md` and
`sed -n '100,135p'`:

- `0172:112` is `### 4 — Three classification columns are NOT CREATED; risk_class is (PO override).`
  The *"**Not-created is chosen for** `sensitivity_ceiling`, `assignable` and
  `applies_to_descendants`"* sentence is at **`:115`**. **`0172:102` is inside § 3**, and reads
  *"by `memberships_role_check`. That CHECK **retires at AE5-complete**…"* — nothing to do with
  the claim.
- The `> ⭐ **AMENDED 2026-09-01 (PO ruling) — sensitivity_ceiling's deferral is OVERTURNED…**`
  block begins at **`:124`**. **`0172:114-119` is the § 4 body**, i.e. the text the amendment
  overturns, not the amendment.

On the anchors, **the substance is right and verbatim-supported** — § 4 does defer creation for
those three, and the amendment does overturn it for `sensitivity_ceiling` citing migration
`20261003007130`. Only the pointers are wrong; two `sed` edits close them.

**The third miscitation is not a pointer, and it is the reason this is MAJOR.** 0203 states, in
its § Context seam table and again in § Considered options (A):

> *"plus the lint arm at `scripts/gen-authz-matrix-cells.mjs:704`, **whose own comment calls § 2.3
> *'the fuse'* that gives it teeth**"*

Measured: `sed -n '699,706p' scripts/gen-authz-matrix-cells.mjs` — line 704 **is** the M9
sensitivity lint arm (that half is right), but its comment at `:699-700` never contains the string
`the fuse` and never mentions § 2.3. The phrase lives at
`supabase/tests/410_ae49_d5_enforcement_manifest.sql:129`, inside **§ 2.3's own** comment, where
§ 2.3 calls *itself* the fuse that gives the lint arm teeth. **The direction is inverted**: 0203
has the generator vouching for the pgTAP cell; the tree has the pgTAP cell vouching for the
generator. That matters because 0203's whole § Consequences is built on ADR 0195's rule that every
figure names *what watches it* — and this is the one place the ADR states a watching relation, in
the wrong direction, attributed to a file that does not carry the words. It is also the sentence a
reader would use to conclude that `axes.sensitivity` is doubly gated.

Graded MAJOR, not MINOR, for three reasons together: this ADR is what AE5's eleven increments will
cite for the seam; two of the three defects sit in the `Amends:` header, the load-bearing part of
the corpus's provenance chain; and the class is a recurrence, one commit later, of the exact twin
this batch itself filed as LEARN-096.

**Swept, and clean** — I had every `file:line` and `§ N.N` citation in both ADRs checked against
its target (≈45 references plus 17 structural claims). Everything else is correct, including
`0176:45-47`, `0176:148-150`, `0176:153-155`, `0175:130-131`, `a30…:172`, `401:369/380/390/397/
406/408/414/416/627/850-853/1109/1111-1112`, `401` §§ 11.1-11.3 and § 13.1-13.8, `410` § 2.3 and
§§ 4.6/6.2/6.2b/6.2c/8.4/8.5, `228:630-634`, `229:215-220`, `409:679-683` (quoted verbatim, and
the *"0 hits for the prose sentence / 9 for LEGACY EQUIVALENCE"* grep asymmetry reproduces),
`415 § 1.2 :159-166`, `315:203-208/209-212/226-230`, `manifest:250`,
`authz_enforcement_manifest.psql:69`, `gen-authz-differential-cells.py:65-67`,
`actions.ts:460`/`ethics/actions.ts:638` with their 2-and-1 reference counts,
`layout.tsx:108-113`, `BUGS.md:168`, and 0203's own `src/` self-test (`sensitivity_class` hits
**2** files in `src/`; `src/lib/types/database.ts` carries **0** occurrences of `authz`, so the
`src/` zeros are licensed by a stated self-test even though a `resolution_scope_kind` grep over
`src/` also returns 0). Every structural count in 0203 reproduces: `hardDenyVocabulary` **7**
classes / **3** gated / **4** `gate: null`; `axes.sensitivity` **43 of 43**, three values, **0**
disagreements with `catalog.sensitivityCeiling`; `domainAuthorizer` non-null on **3** of 43 and the
**same** 3 with non-empty `enforcementSites`; `axes.resourceLifecycle` **43 of 43**;
`authz_differential_cells.psql` **216** rows / **0** `divergent`; and 0201's manifest claims —
`layer1Gate` on exactly one row with `enforcementSites: []` **and** `domainAuthorizer: null`, two
`residualLegacyAuthority` entries naming it, plus `org.professionals.read`'s separate
`app.is_admin_for`-gated entry — all hold.

### MINOR-1 — the hub's `adrs:` frontmatter omits the two ADRs this unit produced

`docs/features/ae5-opening-adr.md:12` lists `["0078","0079","0155","0162","0172","0175","0176",
"0193","0200"]` — the ADRs *read*, not `0201`/`0203`, the ADRs *written*. The convention is the
other way: Batch 8's hub lists `"0200"`, Batch 7's lists `"0195"`. Both files now exist, so gate
13 (which only reds on a listed ADR with **no** file) cannot see the omission. The sibling hub
`ae5-matrix-arm3-cells.md:12` carries an inline note about its own deferred `"0201"`; this hub
carries none. Add both at the Record step.

### MINOR-2 — the lesson the process error owes has no enforcer, and the `lessonsProseOnly` ratchet is at 52/52

The record's own disposition for the `git add -A` error is *"**LESSON at the Record step**, and the
next rulings file owes a **symmetric** clause: the lead stages by PATH while any agent holds the
tree, never `-A`."* Measured: `check-docs-registers` reports `lessonsProseOnly=52/52`, and the
record itself documents that the ratchet *"may only be lowered"* and refused LEARN-096 as
`prose only` earlier in this same batch. So a third prose-only lesson **will be refused**, and a
"rulings file" is a per-batch scratch artefact, not a durable home. This is a standing prohibition
with no resolution event ⇒ CLAUDE.md §8 sends it to `.claude/rules/`. Naming the enforcer now
avoids hitting the ratchet cold at the Record step.

### MINOR-3 — LEARN-096's enforcer cannot load on the surface where the error happened

`.claude/rules/prosrc-is-not-the-whole-function.md` is well-formed (1,546 bytes < 2,048; `paths:`
glob `supabase/tests/mutation/p0-authz-*.sh` matches **5** files < the 40 cap; anchors resolve;
gate 8 green). But LEARN-096's incident was a **lead catalog read while drafting an ADR**, not an
edit to a mutation harness — the rule will not be loaded by the actor or on the path that produced
the defect, while `docs/learning/LESSONS.md:119` presents it as enforced. The record shows gate 8
offered `broad:` and it was declined *"the subtree is not the subject"* — a defensible call, but
the lesson row should say what the enforcer covers, or the glob should reach the ADR/decision
surface. This is the *enforcer-that-cannot-fire* shape the register was ratcheted to prevent.

### MINOR-4 — the "no pgTAP cell deactivates a `platform_admin`" negative is a hand-list, and its count is off by one

Both the record (`docs/progress/ae5-opening-adr.md:176-177`, E1 finding 3) and the follow-up body
(`FUP-…-ADMIN-ARM-IGNORES-IS-ACTIVE.md:61-62`) state: *"Eight candidate files
inspected (`229`, `293`, `318`, `397`, `398`, `401`, `404`, `409`, `415`)"* — that is **nine**
names described as eight, and it omits `231_authz_m5_is_active_gate.sql`, the suite named for the
predicate in question. The claim is load-bearing (it licenses *"the RED-first cell the clause
demands does not exist to be reused"*, which shapes Batch 10).

**The conclusion holds** — I re-derived it rather than inspecting a list: write sites of
`profiles.is_active` / `suspended_until` across `supabase/tests/*.sql` are 5 files, and every
deactivated principal is a non-admin (`145` a PQS operator asserting `list_my_nsp_hospitals()`;
`180` `orgadmin_a` / `staff2_ccih`; `200` a document user; `231` `st_x`/`st_x2`/`st_y`/`sa_y`, and
`231` contains **zero** occurrences of `is_admin` or `platform`). Substitute the derivation for the
hand-list; the ledger's own standing lesson is *re-derive, never quote*.

### MINOR-5 — the manifest qualifier's quoted `401` witness is the pre-change run

Acceptance box 3 condition 2 asks for *"a fresh run of `401` quoted beside it … its exit read
**bare**"*. Both `legacyEquivalence.qualifier` fields quote `Files=2, Tests=122, Result: PASS, 0
not ok, exit 0 read BARE` — which the record labels, in its own witness block, as *"(`401` alone,
**before the change**, on the same fresh reset)"*. The post-change run (`00_setup 401 403 410` →
`Files=4, Tests=189, PASS, exit 0`) lives only in the record. Substantively harmless — `401`
§ 19.2b/§ 19.2c measure `count(distinct prosrc)` from the catalog and are independent of the JSON,
and I confirmed nothing under `src/` derives from the manifest (`gen-authz-matrix-cells.mjs` writes
only into `supabase/tests/vectors`) — but the comment is the artefact the clause judges, and it
should quote the run that post-dates it. One-line substitution from figures already in hand.

### MINOR-6 — `0202` is now an unfillable hole and `0204` is reserved but unwritten

PO ruling R7 split four planned ADRs and Batch 9 wrote **0201** and **0203**. `docs/decisions/`
therefore has no `0202`, and CLAUDE.md §8's rule (*"the highest number on ANY live branch + 1"*)
now yields **0204** for the next ADR of any subject — colliding with plan §3's written reservation
of 0204 for the `D`-ceiling / `search_path` document, while nothing can ever legitimately take
0202. Neither the plan's amendment banner nor the record acknowledges this. Not blocking; state the
reservation somewhere a numberer will read it, or renumber the deferred pair.

### MINOR-7 — two off-by-one anchors in ADR 0201

Both are in the two tables that Batch 10 will work from, so they are worth a `sed`:

- § Consequences, R10's expected reds: **`315:245-249`** → the asserted cell is **`246-249`**;
  `:245` is `reset role;`. (The sibling ranges `:203-208`, `:209-212`, `:226-230` are exact, and
  the four-cell count and the *"only file that does"* claim both hold — `grep -rln
  "active_role.assumed" supabase/tests/` returns `315` plus the `act-hat-blind` allowlist, as
  stated.)
- § Consequences, *"What watches each ratified fact"*: **`401:941`** → the quoted sentence spans
  **`940-941`**; only the *"Gate 4 is §§16.8-16.11"* clause is on `:941`. § 16.11 = *"THE ASYMMETRY
  ITSELF"* is correct, at `:1109`.

---

## Acceptance-criteria audit

Boxes are ticked at the Record step by convention, so unticked is expected; what is audited is
whether the **condition** is met and **proven**.

| box | condition | verdict |
| --- | --- | --- |
| 1.1 | the **D8 bundle** as one compatibility decision (F6 · F8 · `platform_role` · F7) | **PARTIAL, by ruling.** Only F6 is decided (0201 D1/D2). F8, the retirement and F7 went to a named successor by **PO R7**, with a measured basis I confirmed (`staff_admin` is the only `state='authoritative'` role, so 0202 gates increment **2**). The deferral is written into plan §3 and the hub's § Objective. ⚠ The caveat *"⛔ do not report the audit's recommendation and the binding decision as agreeing"* is honoured by silence, not by a statement. ⚠ 0201's closing sentence attributes `administrativo` / `platform_role` / F7 to *"ADR 0203 and the next unit"* — 0203 covers only the columns; a reader could mis-split it. |
| 1.2 | audit **F5's seam** decided; the classification columns get a consumer or a reason | **NOT MET — see BLOCK-1.** The seam is ratified (0203 D1, four sections, three of four gated, measured section by section and reproduced by me). The columns are not: D3 still reads `PO to rule` after R11 ruled them. |
| 1.3 | ADR 0175 D3's arm-3 cells arrive enumerated | **MET as a ruling (R9).** 0201 § *What this ADR does not do* records the promise as **undischarged** and routes it to `AE5-MATRIX-ARM3-CELLS`; the hub exists (`status: planned`) and the INDEX row is generated. Correctly refuses to quote `0175:130-131` as a completion claim — I verified that line is forward-looking (*"arrive"*). |
| 1.4 | `FUP-AE4-CANDIDATE-SCOPE-FANOUT` — a `D` ceiling or a ruling that a large `D` is unreachable, with the census | **MET as a deferral (R7).** The census is written into the follow-up body and stays open; I reproduced every figure in it, including `D ≤ M` from `authz.authorized_scope_ids`' live one-candidate-per-fact CASE. |
| 1.5 | `FUP-NO-GATE-CATCHES-A-COLLAPSED-SEARCH-PATH` — the convention owes an ADR | **MET as a deferral (R7).** Census in the body; **5** live values reproduced, `23` empty-form reproduced, `825` dominant reproduced, the inverted singleton reproduced. |
| 1.6 | the per-role checklist's five corrections | **MET.** `docs/plans/authz-evolution.md:1184-1204` carries all five as pointers naming their authority, with the measured *"0 of 5 before"* stated. |
| 1.7 | ADR 0200's inherited keying obligation as a template clause | **MET.** 0201 **D3** states it per-arm with **(a) subject** and **(b) hat** separated, and gives the reason (b) cannot be optional — the hat requirement is conditional on (a) in both `is_admin_for` and `entailed_grants`, which I verified in the catalog. |
| 2 | `…-ADMIN-ARM-IGNORES-IS-ACTIVE` | **Arm B correctly chosen (R3): entry stays open, box stays unticked.** Sub-items 1 and 2 met and reproduced exactly. ⛔ Sub-item 4's clause correction is defective — see **BLOCK-2** and **MINOR-4**. ⚠ The `**Closes when:**` field itself still names only `app.is_admin_for`; the widening lives in a dated section below it. That satisfies *"superseded wording quoted in place"* but leaves no replacement clause text, so the operative field remains the refuted one. |
| 3 | `…-PLATFORM-ADMIN-CLASS-2-WRITE` | **Arm B chosen (R4): entry stays open, box stays unticked.** The door list is derived, not quoted, and I reproduced it (3 direct / 14 closure / 12 affected, with the short-circuit proven by position in the body). The E2E clause is correctly rewritten to the PostgREST path — I confirmed there is no UI path (`layout.tsx` `notFound()` for a tenancy-less platform JWT). 0201 D5 records the **surviving** reason and names the refuted one **as refuted** with its measurement, exactly as required. |
| 4 | `FUP-ENFORCEMENT-MANIFEST-COMMENT-DESCRIBES-A-RED-THAT-IS-GREEN` | **MET AND PROVEN.** Both `legacyEquivalence.qualifier` fields (on `org.case_vocabulary.manage` and `org.participants.external.manage`) open `✅ RESOLVED 2026-09-09`, state the ruling taken **and** why it was answered by adding § 19.2c rather than editing 19.2b, state the current values (19.2b expects 2 / measures 2; 19.2c expects 1 / measures 1), keep the standing prohibition (*"⛔ 19.2b MUST STILL RED ON A FOURTH SPLIT"*), and quote the entire superseded text under `--- HISTORY`. Recorded on **both** rows with the duplication reason stated. Only MINOR-5 applies. |
| Gate | the gate line | **MET** — see below. |

**Against ADR 0201's two required scoping properties**, both hold: F6's **two axes** are stated
separately (the § Problem table, D1 = R8 subject, D2 = R10 scope) with the explicit *"the half
that 'must match' is discharged by R10, never by R8"*; and `409 § 3.7`'s **first clause only** is
named superseded, with *"⛔ **The second clause is TRUE under D5 and must survive**"* spelled out.

---

## Gate at the tip

Everything I could re-run cheaply reproduces the record: `lint` **rc 0** / 17 of 17 / 0-0 ·
`typecheck` **rc 0** · `SELFTEST=1` **rc 0, 46/46** on `bash 3.2.57` (the shell that produced the
original red — the R13 fix is proven on the failing interpreter, not on a different one) ·
**empty-pathspec assertion EMPTY**. The deriver's `rc 3 = NOT-APPLICABLE` with `derivation: NOT
REACHED` is the correct exit for a zero-migration diff and its `SCOPE:` line is quoted in the
record. `test:db` (264 / 8923 PASS on a fresh reset, shape unmoved from Batch 8) and the four arms
are accepted on the record's quoted bare exits; I did not re-run them, per instruction.

⚠ **One gate-record obligation created by this batch and not met by its own gate record:** PO
ruling **R14** added *"quote the `bash --version` that produced the SELFTEST result"* to
`docs/lead-playbook.md:157`. The record's GATE-AT-THE-TIP table and the R13 verification block
quote `SELFTEST_RC=0` and the group lines but **no `bash --version` string** — the version appears
only in the diagnosis prose earlier in the entry. Folded into MAJOR-1's hub/record refresh rather
than graded separately; the figure is `3.2.57(1)-release (arm64-apple-darwin25)` and I measured it.

## The lead's process error — ruling: **the disposition is adequate; nothing further is owed on the commit**

Verified: `git show --stat 354fd6b0` holds **seven** files — the four docs files its message
describes plus `p0-authz-{door,invoker,rowdoor}-audit.sh` at **+8 each** — and `git branch -r
--contains 354fd6b0` is **empty** (unpushed, so amending was available). The refusal to amend is
sound on both stated grounds: the sha had already been reported to the PO under that description,
and this repo corrects by a dated note beside the original. The correction is durable in **two**
places — the record's own headed section, and `ed80da4c`'s commit message, which states the file
count, the `+8`, the cause (`git add -A` while a subagent held the tree), and that it was
unreviewed and undescribed.

What **is** still owed is the *symmetric rule*, and it is graded above as **MINOR-2**: the guard
that existed faced outward only (L5 forbade the build turn tree-mutating git), and the record's
chosen homes for the inward half — "the next rulings file" plus "a LESSON" — are respectively
ephemeral and blocked by the ratchet. `backend`'s confirmation that it ran no tree-mutating git
command and that the lead's `docs/` edits survived closes the damage question.

## Is E2E owed? — **No, and I agree with the lead's position**

Reasons, in the order they bind:

1. `git diff --name-only main... -- supabase/migrations supabase/seed.sql src` is **0 bytes**,
   re-measured by me at the tip. No route, component, server action, query module, policy, RPC,
   trigger, ACL or seed row changed. There is no rendered surface for a spec to exercise.
2. The changed non-doc set is `supabase/tests/mutation/*.sh` (three `+8`-line pgTAP-mutation
   harnesses, never invoked by Playwright) and `supabase/tests/vectors/**` (two JSON qualifier
   comments plus two derived sha stamps — the record's 4-lines-across-3-files accounting, and gate
   12 `lint:authz-vectors` is green in my own `npm run lint` run). I checked the propagation path
   directly: `scripts/gen-authz-matrix-cells.mjs` writes only `OUT`, `MANIFEST_OUT` and `COVERAGE`,
   all under `supabase/tests/vectors`. **Nothing under `src/` derives from the manifest**, so a
   comment cannot reach a rendered page.
3. Batch 7's precedent is real and I read it verbatim in the ledger: `PATHSPEC_BYTES=0` … *"⚠ E2E
   not owed (no `src/`)"* — approved by QA and the PO on that basis.

Nothing would change my answer. The spec I would have asked for if the manifest fed a runtime
artefact — an ethics/participant flow over `redact_professional_profile` — is owed by **Batch 10**,
where the migration lands, and 0201 already re-words it to the PostgREST path because there is no
UI path to drive.

---

## What is wrong versus merely unproven

**Wrong** (a statement contradicted by evidence, not just unsupported):

- ADR 0203's D3/`Status:` *"`PO to rule` … deliberately left open"* — R11 ruled it. **BLOCK-1**
- ADR 0201 `:152`/`:344` *"deliberately left UNRULED"* / *"does not rule"* `public.assume_role`,
  and the follow-up's *"not silently in scope here"* — R12 ruled it. **BLOCK-2**
- ADR 0201's two statements that D5's sufficiency is unruled — the record closes it. **BLOCK-2**
- ADR 0203's `0172:102` and `0172:114-119` anchors, and its *"`gen-authz-matrix-cells.mjs:704`,
  whose own comment calls § 2.3 'the fuse'"* — that comment does not contain the phrase, and the
  watching relation runs the other way (`410:129`). **MAJOR-2**
- ADR 0201's `315:245-249` (cell is `246-249`) and `401:941` (sentence spans `940-941`). **MINOR-7**
- The hub's *"Twelve PO rulings (R1–R12)"* and its § Blockers `PASS 40 · FAIL 6`. **MAJOR-1**
- *"Eight candidate files inspected"* followed by nine names. **MINOR-4**

**Unproven but not wrong:** the qualifier's `401` witness predates the artefact it sits in
(MINOR-5); LEARN-096's enforcer is presented as covering a surface it does not reach (MINOR-3).

**Right, and re-derived rather than accepted:** every catalog figure in the § Scope table above,
the four staleness corrections (plan §6's 13 KB queue → the file is 2,263 bytes today, three
orders off; `0176:45-47`'s no-reader list **4 → 3** with `session_selectable`'s sole reader
`public.assume_role`; A30's `dispose_attachment_phi` **absent**, 4 doors not 5;
`authz-matrix-coverage.json`'s `migrationHead: "20261003007260"` against a live
`20261003007360`), the `hat_ok` instrument note **with** its one-`f`/three-`t` control, and the
verbatim `§6A ASYMMETRY` comment carrying the two grain-less numerals that `401:1111-1112` mirrors.

**Loop back to step 1 with BLOCK-1 and BLOCK-2.** The two ADRs are the batch's entire product and
both are two paragraphs from correct; MAJOR-1 and MAJOR-2 are replacements of stale or
misattributed text, and the seven MINORs are each a one-to-three-line edit. Nothing here touches
the empty-pathspec assertion, the gate at the tip, or any measurement — none of the fixes should
move a single line under `supabase/migrations`, `supabase/seed.sql` or `src/`, and the assertion
must be re-run bare after they land.
