# DM1 — substrate cutover: QA review (gate step 3)

> Reviewer: `qa` · 2026-08-12/13 · branch `docs/dm1-plan-amendments` (HEAD `dafcbb1`)
> Program: Document Model Redesign (ADR [0114](../decisions/0114-document-model-redesign.md));
> phase decisions ADR [0116](../decisions/0116-dm1-substrate-cutover-decisions.md);
> plan [dm1-substrate-cutover-plan.md](../plans/dm1-substrate-cutover-plan.md);
> phase record [dm1-substrate-cutover.md](../progress/dm1-substrate-cutover.md).
>
> **Method.** Every schema / RLS / RPC claim below was resolved against the **live
> catalog** (`pg_proc` incl. `prosecdef`, `pg_policy`, `pg_constraint`, `pg_policies`,
> ACLs), never migration file text — per the binding CLAUDE.md exception. Behavioral
> claims were re-measured under `set local role authenticated` with real seed personas
> and real JWT hats. Where a claim is load-bearing I also asked whether the assertion
> **could fail**, and mutated the substrate to prove it.

## VERDICT: **APPROVED**

DM1's acceptance contract — *drop the centralized attachments substrate; build an
**inert** replacement; no public RPCs; no UI; flags off; nothing user-visible changes*
— is **met**, and met in the strong sense: I could not reach a single document-model
row, byte, or write path as any persona. The four authz arms, the pgTAP suite, lint
and vitest all reproduce independently on a fresh reset.

Approval carries **one MAJOR finding (MAJOR-1) that must be discharged before DM2
Wave A's flag flips ON**, alongside the already-blocking FUP-DM1-CEILING. It is not a
DM1 blocker because the surface it affects is unreachable in DM1 (zero rows, zero
writers), but it is a pre-built bypass of the very control FUP-DM1-CEILING exists to
restore, so it must not ride into Wave A unexamined.

---

## 1. Gate evidence — independently reproduced

Everything in this table I ran myself on a **fresh `supabase db reset --local`**
(exit 0 — which also proves the migration chain + `seed.sql` are one clean artifact;
367 registered == 367 files, max `20260923000600`, pgtap dropped).

| Evidence | Recorded | Measured by me | Result |
|---|---|---|---|
| pgTAP full suite | `PASS 188 files / 5909 tests` | `All tests successful. Files=188, Tests=5926, Result: PASS`, `0` lines matching `^not ok` | ✅ (count reconciled — see MINOR-4) |
| `ARM=census` | HOLDS, 548 live / 568 verdicts | `live authz gates (catalog): 548` / `gates carrying a verdict: 568` / `INVARIANT HOLDS`, exit 0 | ✅ exact match |
| `ARM=hat` | HOLDS | `HAT-BLIND SWEEP HOLDS: 3 finding(s), all reasoned-allowlisted`, exit 0 | ✅ |
| `FROMFINDINGS=1 ARM=wrapper` | HOLDS, BLIND 41 ⊆ allowlist | `BLIND set size: 41` / `OK`, exit 0 | ✅ exact match |
| `ARM=floor` | HOLDS, 77 never-called doors | `authenticated-reachable prosecdef doors with 0 calls: 77` / `OK`, exit 0 | ✅ exact match |
| `npm run lint` (five gates) | 0/0 | `vacuous-assertion gate: OK (178 spec files, 0 findings)`, `LINT_EXIT=0` | ✅ |
| `npm run test` (vitest) | 1254/1254 | `Test Files 85 passed (85)` / `Tests 1254 passed (1254)`, exit 0 | ✅ exact match |
| `npm run typecheck` | "tsc clean" | `TSC_EXIT=2` — 4 errors, **all** in generated `.next/types/validator.ts`, **0** in `src/`/`e2e/` | ⚠ see MINOR-6 |

`e2e:prod` (1073 passed / 1 failed / 3 flaky / 17 batches / 0 did-not-run) was not
re-run — the full suite is lead-run by standing practice. I audited the disposition
instead; see INFO-4.

---

## 2. Drop completeness AND over-cut (review item 1)

### Under-cut: the surviving `%attachment%` surface is exactly the allowlist

```sql
select n.nspname||'.'||p.proname, p.prosecdef from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
 where p.proname ilike '%attachment%' and n.nspname in ('app','public','storage','extensions');
select schemaname||'.'||tablename||' :: '||policyname, cmd from pg_policies
 where policyname ilike '%attachment%' or tablename ilike '%attachment%';
select n.nspname||'.'||c.relname, c.relkind from pg_class c
  join pg_namespace n on n.oid=c.relnamespace
 where c.relname ilike '%attachment%' and n.nspname not in ('pg_catalog','information_schema');
```

```
 public.add_referral_reply_attachment | t
 public.get_referral_attachment_path  | t
(2 rows)

 public.referral_reply_attachment :: referral_reply_attachment_select_readable | SELECT
 storage.objects :: referral_attachments_obj_insert                            | INSERT
 storage.objects :: referral_attachments_obj_select                            | SELECT
(3 rows)

 public.referral_reply_attachment | r     (+ its 3 indexes)
```

That is the 5 referral surfaces, and nothing else. The two non-`%attachment%`
allowlist entries both survive and are intact:

```
 storage.objects :: case_documents_select_member | SELECT |
   ((bucket_id = 'case-documents') AND app.can_read_snapshot_document(name, (SELECT auth.uid())))
 app.can_read_snapshot_document | prosecdef=t | {"search_path=app, public, pg_catalog"}
```

**Verdict: exactly the 7-item allowlist. No under-cut.**

### Over-cut: checked by dependency, not by name

A name sweep was wrong in both directions three times in this program, so I ran the
checks that a name sweep cannot do:

**(a) No surviving function body references anything dropped.** Comment-stripped
`prosrc` sweep across all of `app` + `public` for the 5 dropped RPCs, the 7 dropped
`app` routines, `attachment_confidentiality_ok`, the 3 dropped relations, and the
`in_attachments_rpc` GUC:

```
 fn | name
----+------
(0 rows)
```

**(b) No dangling FK, and every parked seam is guarded.**
`select count(*) … contype='f' and confrelid::regclass::text like '%attachment%'` (excluding
`referral_reply_attachment`) → **0**. All four parked columns survive as nullable `uuid`:

```
 ethics_decision_details | decision_letter_document_id | uuid
 ethics_notifications    | related_document_id         | uuid
 rca_evidence            | cited_document_id           | uuid
 referral_shared_item    | source_document_id          | uuid
```

`rca_evidence_cited_document_parked CHECK ((cited_document_id IS NULL))`, `convalidated = t`
— present and validated, and load-bearing exactly as ADR 0116 §1 argues (`rca_evidence`
is the one seam table with a live `authenticated FOR ALL` write policy). The three
writers that needed fail-closing all carry the minted SQLSTATE:

```
 public.add_rca_evidence          :: HC0DM=true
 public.add_referral_shared_item  :: HC0DM=true
 public.issue_ethics_notification :: HC0DM=true
```

I also confirmed the pre-existing `rca_evidence_shape` CHECK remains satisfiable
alongside the new one: for `kind='citation'` it requires exactly one of
`{cited_interview_id, cited_meeting_id, cited_document_id}` non-null, so parking the
document arm narrows the citation vocabulary to interview/meeting without making any
row unwritable.

**(c) Nothing needed was taken.** The accreditation controlled-document module
(`controlled_documents`, `controlled_document_versions`, `document_approvals`,
`commission_charters` FK) and the printed-document module are fully intact — verified
by FK enumeration. `get_referral_snapshot_document_path` survives.

**Verdict: no over-cut detected.**

---

## 3. The two plan deviations (review item 2)

### (a) Six kernel doors, not three — implementation correct, **documentation imprecise** (MINOR-1)

All six exist, all `prosecdef = t`, all `search_path`-pinned:

```
 can_read_document          | t | {"search_path=app, public, pg_catalog"} | p_document_id uuid, p_uid uuid
 can_write_document         | t | {…}                                     | p_document_id uuid, p_uid uuid
 can_read_document_version  | t | {…}                                     | p_version_id uuid, p_uid uuid
 can_read_file_object       | t | {…}                                     | p_file_object_id uuid, p_uid uuid
 can_read_document_hold     | t | {…}                                     | p_document_id uuid, p_uid uuid
 storage_upload_reserved    | t | {…}                                     | p_bucket text, p_name text, p_uid uuid
```

The recursion argument in ADR 0116 §8 is sound and I accept it. But the section
characterises all three additions as *resolvers* that "read the chain without
recursion". Read from the catalog, only **one** of the three is a pure chain resolver:

- `can_read_document_version` — pure: `select document_id … return … app.can_read_document(v_document, p_uid)`. ✅
- `can_read_document_hold` — **does not consult `can_read_document` at all**; it resolves the home commission and returns `is_staff_admin_of_for(...) OR is_tenancy_admin_of_for(...)`. This *is* documented, but in the **plan** (§4, "hold existence is write-authority governance metadata"), not in ADR 0116 §8.
- `can_read_file_object` — carries an **independent grant arm** (see MAJOR-1).

### (b) `authenticated` EXECUTE on the doors — **the plan text was wrong; the shipped posture is right**

Confirmed, and confirmed against the sibling precedent rather than by argument. The
ACLs are byte-identical across new and pre-existing policy-referenced doors:

```
 can_read_case              | {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
 can_read_snapshot_document | {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
 can_read_document          | {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
 can_write_document         | {…identical…}
 can_read_document_version  | {…identical…}
 can_read_file_object       | {…identical…}
 can_read_document_hold     | {…identical…}
 storage_upload_reserved    | {…identical…}
```

No PUBLIC entry (an empty grantee) and no `anon` entry on any of the six — **PUBLIC and
`anon` are revoked**. For independent confirmation that this is the house pattern and
not a DM1 invention, the *retired* `app.can_read_attachment` shipped with exactly
`revoke all … from public; grant execute … to authenticated, service_role`.

**Not reachable from `public`.** Sweeping every function body in every schema for the
six door names, the only referents are three `app` DEFINER internals:

```
 app | _audit_access_authorized  | t | can_read_document
 app | can_read_document_version | t | can_read_document
 app | can_read_file_object      | t | can_read_document
```

Zero `public`-schema functions. Combined with `config.toml` exposing only `public`,
the doors are reachable solely through policy evaluation and future DEFINER commands.
**ADR 0116 §9 is accurate.**

---

## 4. Inertness (review item 3) — confirmed behaviorally, not only structurally

**Structure.** All nine tables: RLS enabled, **exactly one** policy each, all `SELECT`,
`authenticated` = SELECT-only, `anon` = nothing. Column-level grants checked separately
(the `case_referral` scar): SELECT only, no DML column smuggled in.

**Behavior beats the `using(true)` trap.** Rather than grep the quals, I planted a full
chain as `postgres` (no writer exists) and measured rows per persona with real hats:

| persona | docs | vers | vfiles | fobj | holds | places | secres | retention |
|---|---|---|---|---|---|---|---|---|
| chefe.ccih (home staff_admin) | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| staff2.ccih (plain member) | 1 | 1 | 1 | 1 | **0** | 1 | 1 | 1 |
| **platform@test.local** | **0** | **0** | **0** | **0** | **0** | **0** | **0** | 1 |
| orgadmin.a (tenancy admin) | **0** | 0 | 0 | 0 | 1 | 0 | 1 | 1 |
| quality.b (cross-org) | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 |
| chefe.farm (other commission, same org) | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 |

Cross-org and cross-commission walls hold. `document_retention` = 1 for everyone is
the deliberate `qual = true` config read (1 row, `is_provisional = t`).

**DML.** 19 write attempts (UPDATE + DELETE across all nine, plus an INSERT) under
`role authenticated` → **every one `42501`**. `authenticated` holds table-level
INSERT/UPDATE/DELETE on `storage.objects`, so the storage denials below are genuine
*policy* denials, not missing grants.

**Row counts — the substrate is empty:**

```
 documents 0 · document_versions 0 · document_version_files 0 · file_objects 0
 document_placements 0 · upload_sessions 0 · document_legal_holds 0
 document_retention 1 (provisional) · securable_resources 28 (registry backfill)
 storage.objects in documents-standard/documents-phi: 0
 storage.objects in attachments/attachments-phi: 0
```

**Zero public RPCs.** Sweeping every `public` function body for the nine relation
names returns one match, `mint_printed_document` — a **false positive** of my own
regex on the substring `printed_documents`; its body references none of the new
tables. So: **no public function touches the document model.**

**Flags.** All five OFF, asserted as state:

```
 attachments f · documents_foundation f · documents_wave_a f
 documents_wave_b f · documents_wave_c f · documents_wave_d f
```

**Buckets.** Both private, F2-mirrored caps (26214400 / 13 MIME types). Exactly two
policies touch them, both INSERT, both reservation-bound; **no SELECT policy**.
Behaviorally:

- unreserved INSERT → `42501` (standard **and** phi tier);
- with a hand-planted `reserved` session + file_object, `storage_upload_reserved` returns `t` for the owner, `f` for another uid, `f` for another path, `f` once expired — **the predicate is non-vacuous, it can say yes**;
- the reserved INSERT then **succeeds**, and the uploader **still reads 0 rows back** from `storage.objects`. So the zero-SELECT posture holds in the hardest case: your own object, just uploaded, same transaction. `platform_admin` also reads 0.

---

## 5. The noun rule (review item 4) — re-verified, and proven falsifiable

`app.can_read_document` has no `is_admin` arm (catalog body: `is_active` outer gate,
then a four-way `case`/`meeting`/`interview`/`action_item` dispatch, `else false`).
Measured: `platform@test.local` reads **0** across all eight document tables and the
registry.

A green measurement of zero is worthless unless it can turn non-zero, so I mutated the
door inside a rolled-back transaction:

```
### BASELINE: platform_admin document count (expect 0)
 pa_docs_baseline  0
### MUTATION: neutralize app.can_read_document to return true
 pa_docs_mutated   1
### RESTORE CHECK (from the catalog)
 restored          t
```

**K5d is load-bearing.** (My first attempt at this ran against an empty table and
reported 0 → 0 — a vacuous pass. Recorded because it is the exact failure mode this
project keeps hitting; the numbers above are from the corrected run.)

I also checked the phase record's stronger claim that the dispatch is "the exact
predicate set the retired dispatchers used". The retired `can_read_attachment` carried
`OR is_commission_admin_of_for(...)` on its meeting and interview arms, which the new
door does not. This turns out to be **immaterial**: `is_member_of_for` resolves through
`has_role_any('commission', …)`, which matches *any* role including `staff_admin`
(verified: `is_member_of_for(CCIH, chefe.ccih) = t`), so the old `OR` was redundant.
No finding — recorded so the next reader does not re-derive it.

---

## 6. FUP-DM1-CEILING (review item 5)

**Is the record adequate for a future reader to treat it as a gate?** Yes —
unusually so. It is carried in **four** independent places, each of which alone would
stop a reader: PROGRESS.md's index row (🔴, "BLOCKS DM2 Wave A"), the follow-ups.md
body, ADR 0116 §10 (so it is visible from the *phase's own decision record*, not only
from a follow-up file), and the program plan's `⛔ BLOCKS DM2` section with three
costed ruling options. The body names the dropped mechanism
(`app.attachment_confidentiality_ok` + the label column + the `HC0E6` arm), the live
contract that encodes it (`ethics-e1-access-spine.spec.ts` AC-4a–d, AC-9 + pgTAP `228`
t36–40), the discharge condition (a PO ruling as an ADR 0114 amendment), and — the part
that makes it a gate rather than background — **why it is easy to wave through**:
present real-world risk is zero, so the failure mode is a silent authorization
regression introduced by a later data-model migration. I would not improve it.

**Does anything in DM1 make the eventual fix harder?** Structurally, DM1 makes it
*easier*: because every chain policy routes through the single `can_read_document`
door, a ceiling arm added there propagates to versions, version-files and placements
with no policy changes. **With one exception, which is MAJOR-1 below** — two doors
reach document-adjacent rows *without* passing through `can_read_document`, so a
ceiling installed in the kernel will not cover them. That is the direct answer to this
question and the reason MAJOR-1 is attached to Wave A rather than filed as a nicety.

---

## 7. The parks (review item 6)

Six specs named, five files changed, `meeting-audio-minutes.spec.ts` correctly
untouched. Mechanisms verified in the diff:

| file | mechanism | `expect()` main → HEAD | assessment |
|---|---|---|---|
| `phase-f2-attachments.spec.ts` | whole-file `test.describe.skip` | 48 → 48 | ✅ `git diff -w` = **+18 lines only** — body preserved verbatim |
| `ethics-e1-access-spine.spec.ts` | 3 × in-body `test.skip(true, …)` | 47 → 47 | ✅ each names FUP-DM1-E2E **and** FUP-DM1-CEILING |
| `phase11-interviews.spec.ts` | commented blocks, 2 tests | 157 → 157 (4 commented) | ✅ IV2-11 (the "seventh test") is real and annotated |
| `cases-extras.spec.ts` | commented block | 70 → 70 (7 commented) | ✅ |
| `quality-oversight.spec.ts` | prose annotation | **137 → 133, 0 commented** | ⚠ MINOR-3 |

The tester's three corrections to the backend's static sweep are borne out by the code
(`attachments-panel.tsx` gating both file and link behind one flag; `cases-extras`'s
upload trigger, not just the download button), and test titles were annotated so the
park is visible in the run report rather than only in the source. **No spec was
deleted, and no skip was used to hide a failing assertion** — with the single
accounting exception in MINOR-3.

---

## 8. Judging the two substitutions for the un-run sweep cases

**`app.storage_upload_reserved` — adequate, and I went further.** The record cites a
targeted mutation (neutralize → K6d/K6f flip → keystones red, restore catalog-verified).
Independently I established something a sweep verdict does not: the predicate
discriminates in all four directions (owner/other-uid/other-path/expired) **and** the
policy it feeds actually binds — the reserved INSERT succeeds where the unreserved one
gets `42501`. A sweep says "some keystone notices if I open this"; that pair says "the
gate is the thing deciding". ✅

**`app._audit_access_authorized` — adequate, but it needed checking, because a
name-keyed verdict attests to the body that existed when it was minted, and DM1
*rewrote this body*** (attachment-read arm out, `document.opened` arm in). The standing
verdict alone would have been the "a rename orphans a name-keyed verdict" scar in its
body-rewrite form. K10a–d do cover the new arm, and I re-measured them plus a mutation:

```
A1 entitled reader (chefe.ccih):    ALLOWED            (expected)
A2 attachment.read:                 refused 23514      (verb retired)
A3 foreign staff_admin:             refused 42501      (expected)
A3-MUT (can_read_document → true):  now ALLOWED        → the arm is load-bearing
```

✅ — with one thing the record does not mention, at A4: see MINOR-5.

**The un-run write-path `ARM=policy` subset — correctly not cited.** The reasoning is
right (zero DM1 gates in its hardcoded worklist ⇒ `BLIND: 0` over zero cases, the
no-op) and the record says so explicitly instead of quoting a hollow number. The two
storage INSERT policies are covered behaviorally by K6d–K6h plus TWIN5, and my §4
measurements reproduce that coverage end-to-end. **The K6 twins do cover them.** ✅

---

## Findings

### MAJOR-1 — `app.can_read_file_object` carries an undocumented, unkeystoned grant arm that bypasses the document chain (and will bypass the FUP-DM1-CEILING ceiling)

Catalog body:

```sql
  -- The uploader sees their own object (upload status UX); everyone else
  -- reaches it only through a readable bound document.
  if exists (select 1 from public.file_objects fo
             where fo.id = p_file_object_id and fo.created_by = p_uid) then
    return true;
  end if;
```

Three problems, in ascending order:

1. **It is not a resolver.** ADR 0116 §8 justifies this door as a recursion-avoiding chain resolver. This arm authorizes *outside* the chain, on row ownership. The characterisation in §8 does not describe what shipped.
2. **It is a widening versus the substrate it replaces.** The retired `app.can_read_attachment` was pure owner-type dispatch with no creator arm.
3. **It has no keystone.** Suite `328` is *aware* of the arm — K11h says "not the creator arm — staff1 is not the creator" and K11m says "neither creator nor chain" — and deliberately routes around it. So the arm is the one piece of new authorization logic in the kernel that nothing exercises in either direction.

**Why it matters at Wave A, not now.** In DM1 it is unreachable (0 rows, no writer;
verified). From DM2, `created_by` is the uploader. A principal later **excluded** from a
case (ADR 0072 recusal — the platform's strongest narrowing control) keeps SELECT on the
`file_objects` row they uploaded: `storage_bucket`, `storage_path`, `sha256`,
`mime_type`, `size_bytes`, `upload_state`, `disposal_state`, timestamps. No bytes leak
(the buckets have no SELECT policy — verified), so this is metadata, not content. But
the ceiling that FUP-DM1-CEILING will install lands in `can_read_document`, and **this
arm does not call `can_read_document`** — the ceiling will not cover it.

**Requested before Wave A's flag flips ON** (not before DM1 merges): a PO/lead ruling on
whether the uploader arm survives, recorded wherever the ceiling ruling lands; if it
survives, a keystone pair (uploader-with-no-document-read reads 1 / excluded uploader
reads 0) and a line in ADR 0116 §8 correcting the "resolver" characterisation.

*Companion, same shape but already documented and therefore only INFO-3:*
`can_read_document_hold` likewise never calls `can_read_document`.

### MINOR-1 — ADR 0116 §8 mischaracterises the three added doors

§8 describes all three as chain resolvers needed to avoid RLS recursion. Only
`can_read_document_version` is one. `can_read_document_hold` has independent
staff_admin/tenancy arms (documented in the plan, not in §8); `can_read_file_object` has
the arm in MAJOR-1 (documented nowhere but its own inline comment). The recursion
rationale is correct and sufficient for *why they exist*; it is not a description of
*what they authorize*. One added sentence per door fixes it.

### MINOR-2 — `document.opened` inherits an `is_admin()` bypass the phase's headline claim does not mention

Measured (§8, A4): **`platform@test.local` successfully mints a `document.opened` audit
row for a document it provably cannot read.** The cause is pre-existing and honestly
documented *inside* `app._audit_access_authorized` — a `if coalesce(app.is_admin(), false)
then return true;` short-circuit above all 18 arms, with an in-body note that this is
"a pre-existing property of all 18 arms, and precisely why `public.read_minutes_transcript`
gates itself BEFORE recording rather than inferring authorization from this registry".

So: not a DM1 defect, and not a read leak — `can_read_document` still denies the content
(§4). But DM1 registered a **new** verb under that bypass while the phase's headline
claim is "no `is_admin` arm — the noun rule". Both are true, at different layers, and
the record does not distinguish them. **The mitigation the body names is not written
down as a DM2 obligation for documents:** the phase record's obligation #2 asks
`open_document_version` for byte-discrimination pins, but never says *gate before
recording, do not infer authorization from the registry*. Add it to the DM2 obligation
list.

### MINOR-3 — FUP-DM1-E2E's "preserving the removed code as a comment" is inaccurate for `quality-oversight.spec.ts`, and a security contract went untested without being named

The FUP says the two blocks were "Commented out … preserving the removed code as a
comment". In files 4 and 5 that is exactly what happened (4 and 7 commented `expect()`s).
In `quality-oversight.spec.ts` the **4 `expect()` calls were deleted** and replaced by
prose annotations (`137 → 133`, `0` commented). The annotations are good — they name the
fixture id, the mechanism and the discharge — and the code is recoverable from git, so
this is an accuracy defect in the FUP, not a concealment.

The substantive half: what those four assertions proved was the **M8 bytes-cut** — an
oversight reader must *not* get the download control for a PHI-tier case document, with
a coordinator positive control in the paired test. That is a security contract, and it
is now unasserted anywhere. It is implicitly inside FUP-DM1-E2E's discharge, but it is
not in the phase record's "DM2 keystone obligations" list where the other four losses
are enumerated. **Add it as obligation #5**, so it is discharged by name rather than by
someone re-reading a spec comment.

### MINOR-4 — the headline test count (5909) describes a tree two commits older than the one being approved

PROGRESS.md and the phase record cite `188 files / 5909 tests` as gate-step-1 evidence.
The tree at HEAD is **5926** (5909 + K11's 15 + K12's 2). The phase record's turn-7 note
and the findings file both explain the arithmetic, so nothing is hidden — but the number
presented as *the* gate figure is the pre-K11/K12 one. Resolved: I ran the full suite at
HEAD and it is `Files=188, Tests=5926, Result: PASS`. Recommend updating the headline to
5926 so the figure describes the approved tree.

### MINOR-5 — `npm run typecheck` currently exits 2; the recorded "tsc clean" is not reproducible as-is

Four `TS2344` errors, **all** in the generated `.next/types/validator.ts`, caused by
mixed dev/prod route artifacts (`.next/dev/types/routes.d.ts` @ 22:38 is newer than
`.next/types/routes.d.ts` @ 22:21 — a dev server ran after the prod build). **Zero
errors in `src/`, `e2e/`, or any first-party file**, so no DM1 code is implicated and I
did not treat it as a gate failure. Flagged only because the gate is recorded green and
is red on a clean checkout of this branch until `.next` is cleared — worth one line in
the phase record so the next person does not chase it as a DM1 regression.

### INFO-1 — one allowlist entry is not pinned by name in K2

Suite `328`'s K2 header states that every K1 allowlist entry "EXIST[s] in K2 so DM4
cannot forget one". K1c allowlists the **relation** `referral_reply_attachment`, which
has no K2 pin (K2 pins 7: the 2 routines, 3 policies, and the 2 non-`%attachment%`
survivors). It is transitively pinned — K2e asserts its policy, which cannot exist
without the table — so the coverage is real and only the header's universal claim is
loose. Add a K2h if DM4's closure is to be purely mechanical.

### INFO-2 — `app.can_read_document_hold` grants hold visibility to principals with no document read

Measured: `orgadmin.a` reads `documents = 0` but `document_legal_holds = 1`. So a
tenancy admin learns that a document exists on a case they cannot read, plus its
`reason_category`. This is deliberate and documented in the plan ("hold existence is
write-authority governance metadata"), and it is a governance surface rather than
content — but it is a second door that does not route through `can_read_document`
(cf. MAJOR-1) and should be re-examined when the ceiling ruling lands.

### INFO-3 — a pre-existing BLIND door sits next to the new model, name-adjacent

`app.can_read_document_object(p_name text, p_uid uuid)` is live, `prosecdef = t`, and
sits in the findings file's **BLIND work-list** with an empty citation. It predates DM1
and is outside DM1's diff, so it does not block this phase. Noting it because the name
reads like part of the new kernel and is not — DM2 should not assume it is covered by
the DM1 verdict rows.

### INFO-4 — the single `e2e:prod` failure: disposition accepted

`case-narratives.spec.ts` AC-10 failed once in 1073. The disposition rests on two
independent non-reproductions (13/13 in isolation, 68/68 in an identical batch-2 re-run,
both `RETRIES=0`) and a signature matching the harness's own `server_dead` INFRA class
below the classifier threshold. The accounting discipline that matters here is present
and is the thing I checked hardest: **17 batches, every one `accounted N/N`, 0
did-not-run** — the "a reset-FAILED batch drops out of the gate's own denominator" trap
is closed. Two non-reproductions is adequate evidence; I accept it. Strictly, though,
1073/1 is a triaged pass, not a clean green, and the summary should keep saying so.

---

## What the record overstates

The lead asked for this explicitly. The DM1 record is, overall, more careful than most
in this repo — it volunteers its own near-misses (the vacuous first `test_helpers` run,
the comment that contained the literal it was warning about, the K11h wrong-arm red, the
`tail`-masked exit code). Four places still claim more than was shown:

1. **ADR 0116 §8, "the build added … because the per-table SELECT policies need DEFINER *resolvers*"** — this is the significant one. It presents three doors as mechanical chain resolvers; two of them carry independent authorization arms, one of which (MAJOR-1) widens access relative to the substrate being replaced and is exercised by no keystone. A reader auditing §8 would not know to look for it.
2. **Phase record, turn-3: "dispatch = the exact predicate set the retired dispatchers used"** — not exact; the retired door's meeting/interview arms carried an extra `OR is_commission_admin_of_for`. I verified the delta is *immaterial* (`has_role_any` already matches `staff_admin`), so the claim's conclusion holds while its wording does not. Say "behaviorally equivalent, verified" rather than "exact".
3. **FUP-DM1-E2E: "preserving the removed code as a comment"** — true for two files, false for `quality-oversight.spec.ts`, where four assertions were deleted in favour of prose (MINOR-3). The FUP is otherwise scrupulous about its own corrections, which makes this line stand out.
4. **`188 files / 5909 tests` as the gate figure** — describes the tree before K11/K12 (MINOR-4). Benign and self-explained elsewhere, but it is the number a human approver will read.

And one thing the record **understates**, worth saying because it cuts the other way:
the phase claims `ARM=census` "sees the new doors" on the strength of a captured
required-failure. That is the right proof, and it is stronger than claimed — the
captured failure named *exactly* the 15 new gates, which also rules out the failure
having come from unrelated drift.

---

## Conditions attached to this approval

None block the merge of DM1. All are gates on **DM2 Wave A**, to be recorded where the
FUP-DM1-CEILING ruling lands:

1. **MAJOR-1** — rule on the `can_read_file_object` uploader arm; keystone it in both directions, or remove it. It must be settled in the same ruling as the ceiling, because the ceiling does not cover it.
2. **MINOR-2** — add "`open_document_version` gates before recording; it must not infer authorization from `log_audit_access`" to the DM2 keystone obligations.
3. **MINOR-3** — add the M8 bytes-cut contract to the DM2 obligation list as a named item (#5).
4. **MINOR-1 / overstatement 1–4** — documentation corrections to ADR 0116 §8, the phase record's "exact predicate set" line, the FUP-DM1-E2E parking note, and the 5909 → 5926 headline.

---

## QA verdict row (for PROGRESS.md — lead owns the table)

| Phase | Reviewer | Date | Verdict | Report |
|---|---|---|---|---|
| DM1 — substrate cutover | `qa` | 2026-08-13 | **APPROVED** (1 MAJOR + 5 MINOR + 4 INFO, all carried to DM2 Wave A; none block DM1) | [dm1-substrate-cutover-review.md](dm1-substrate-cutover-review.md) |
