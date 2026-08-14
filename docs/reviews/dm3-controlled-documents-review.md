# DM3 — Wave B: controlled documents · QA review (r1)

- **Date:** 2026-08-13
- **Branch:** `docs/dm1-plan-amendments` (⛔ not `main`; nothing pushed)
- **Scope audited:** migrations `20260925000100`–`…001000`, pgTAP `330` (+ the `328`
  K8c edit), `supabase/seed.sql`, `supabase/tests/00_setup.sql`, the DM3 slices of
  `src/lib/{documents,controlled-documents,ethics,queries}` and
  `src/components/controlled-documents/**`, `e2e/dm3-wave-b-documents.spec.ts`.
- **Contract:** ADR 0114 (+ **Amendment 1 D15/D16**, **Amendment 2 D17**), ADRs 0116 /
  0117 / 0118, `docs/plans/document-model-redesign.md` §DM3 (exit criteria),
  `docs/plans/dm3-controlled-documents-plan.md` §§3/5/6/7/7b.

---

## VERDICT: **CHANGES REQUESTED**

**One blocking item (MAJOR-1).** It is *not* a security hole — I probed the
authorization boundary from every angle I could construct and it held every time.
It is a **flag-choreography defect against the phase's own stated contract**, with a
data-hygiene consequence that lands in exactly the production state the deploy step
expects to pass through, and it is asserted *the other way round* in two places in the
shipped tree.

Everything else in DM3 that I could verify, I verified — and the security core of this
phase is the strongest I have audited on this project. The P0 fix is structurally
complete and its keystone is genuinely falsifiable; the ethics seams discharge all five
conditions; the D15 ceiling narrows and fails closed; the byte round trip is real byte
equality through the real corridor. **0 P0 · 1 MAJOR (blocking) · 4 MINOR · 5 INFO.**

---

## P0 — none

---

## MAJOR-1 (BLOCKING) — `documents_wave_b` gates the LAST step of the corridor, not the corridor; the tree states the opposite twice

**Requirement violated:** DM3's own stated flag contract, written into
`supabase/seed.sql` (~L2244–2247):

> *"DM3 Wave B joins the same MIN pattern (2026-08-13). `documents_wave_b` gates
> `attach_controlled_document_version_file`; **with it OFF every DM3 door answers
> HC0D7** and the Wave B keystones red on the gate rather than on a defect."*

and into `src/lib/documents/actions.ts:85-88`:

> *"UI-gating only: the DB gate is `app.assert_documents_wave_b_enabled()`, **which
> every DM3 door calls (HC0D7), so a stale client cannot reach past this**."*

The MIN pattern this cites is the one DM1/DM2 established for Wave A — *"the Wave A
surface is **ABSENT**, not disabled"* (same seed block, L2236–2238). DM3 does not
implement it.

### Evidence I produced

**(a) Exactly one function in the live catalog calls the gate.**

```
select n.nspname||'.'||p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where p.prosrc ~ 'assert_documents_wave_b_enabled';
-- → public.attach_controlled_document_version_file   (1 row, and only this one)
```

`create_controlled_document`, `begin_document_upload`, `finalize_document_upload`,
`reclassify_document`, `set_ethics_decision_details`, `issue_ethics_notification` —
every other door DM3 added or amended — do not.

**(b) With the flag OFF, the corridor is open up to its last step.** Probed live in a
rolled-back transaction as `chefe.ccih` (`staff_admin`, CCIH), flag flipped OFF inside
the transaction:

```
create_controlled_document          : ACCEPTED (no HC0D7)
begin_document_upload               : ACCEPTED (no HC0D7)
attach_controlled_document_version_file : REFUSED HC0D7
reclassify_document(…,'phi')        : REFUSED HC0DH   (the no-PHI stance, not the flag)
open_document_version               : REFUSED HC0D8   (fileless fixture, not the flag)
```

So with `documents_wave_b = false` a coordinator can still create the controlled
document, reserve a server-side path, **PUT real bytes into `documents-standard`**, and
finalize — minting a real `documents` row, a real `document_versions` row, a real
`file_objects` row in `unscanned_accepted`, and a real Storage object. Only the domain
pointer refuses. The residue is **orphaned bytes plus an orphaned core version plus a
draft whose file will never appear**, invisible to the controlled-document UI and
unreachable by any retry.

**(c) The UI never reads the flag at all.** `documentsWaveBEnabled()` is added by DM3
at `src/lib/documents/actions.ts:90-92` and is **called from nowhere** in `src/` —
`grep -rn documentsWaveBEnabled src/` returns only its own definition and the
`FeatureFlags` type entry. The `manage/documentos` area gates on `controlled_docs`
alone (`…/manage/documentos/layout.tsx:25-27`). So the sentence *"UI-gating only"*
describes a UI gate that does not exist.

**(d) This is the deploy's expected interim state, not a hypothetical.** The plan's own
§10 records it as a **named gate item**: local has `controlled_docs = true` /
`documents_wave_b = false`, production per the DM2 record has all five DM flags OFF,
*"These disagree"*, reconciled at deploy time. ADR 0114's production census recorded
**all 35 feature flags ON in production**. `controlled_docs` ON with `documents_wave_b`
OFF is therefore the state a deploy passes through, and in it the user sees a complete,
inviting upload wizard that uploads the file successfully and then fails on the final
step with *"O envio de documentos ainda não está disponível."*

**(e) No test covers it.** The Test Run Summary already records *"Could not exercise:
… the `documents_wave_b`-OFF arm of the charter download affordance (Q6)"*. The arm is
untested, and it is broken-affordance-shaped.

### Why it is not a security finding

I verified the authority is unchanged in the flag-OFF state: `can_write_document`'s
`controlled_document` arm is `app.is_staff_admin_of_for(v_commission, p_uid)` and it
discriminates correctly —

```
can_write_document(core_doc_of DOC-0001, …):
  chefe.ccih   (staff_admin CCIH)                    → t
  staff1.ccih  (plain CCIH member)                   → f
  staff1.farm  (outside APPROVER, reads DOC-0001)    → f    ← reads, cannot write
can_read_document (same outside approver)            → t
begin_document_upload as plain member                → REFUSED P0002
begin_document_upload as outside approver            → REFUSED P0002
attach_… as outside approver                         → REFUSED 42501
```

Nobody unauthorized can create the residue. That is why this is MAJOR, not P0.

### Acceptable fixes (either one discharges it)

1. **Make the contract true.** Add `perform app.assert_documents_wave_b_enabled();` to
   `begin_document_upload` **when the resolved home is `controlled_document`** (and to
   `create_controlled_document`, if the PO wants the surface ABSENT rather than
   read-only). Then the seed's "every DM3 door answers HC0D7" is a fact, and the flag
   behaves like Wave A's. Needs a keystone that reds when the assert is removed.
2. **Make the text true.** Correct both comments to state precisely what the gate covers
   (*"`documents_wave_b` gates the domain-pointer attach only; the core upload corridor
   is gated by `documents_foundation`"*), delete or wire `documentsWaveBEnabled()`, and
   record in the deploy step that `controlled_docs` must not be ON ahead of
   `documents_wave_b` — with the orphaned-bytes consequence named.

I recommend (1): the phase's flag discipline exists precisely so a half-flipped flag
cannot produce a working-looking affordance, and (2) leaves that outcome live and merely
documented. Whichever is chosen, `documentsWaveBEnabled()` must not ship uncalled with a
doc comment that misdescribes the catalog — that is the
`FUP-LINT-STALE-SYMBOL-COMMENT` class the phase itself identified, recurring inside the
same phase.

---

## MINOR

### MINOR-1 — *"in no authz arm's domain"* is measurably wrong; the conclusion drawn from it is right

Stated in three places — `docs/plans/dm3-controlled-documents-plan.md` §10 risk 4
(*"`open_document_version` is in no authz arm's domain"*), PROGRESS.md's census-scope
block (*"`attach_controlled_document_version_file` … **in no arm's domain**"*), and the
handoff to me.

**Measured.** ARM 2 (`ARM=floor`) bounds its domain as *every* `public` `prosecdef`
function EXECUTE-able by `authenticated` — no return-type clause at all
(`p0-authz-invariant.sh:209-218`). Its live domain is **411 signatures**, and it
contains both:

```
attach_controlled_document_version_file(p_version_id uuid, p_core_version_id uuid, …)
open_document_version(p_document_version_id uuid)
begin_document_upload(…) · finalize_document_upload(…) · create_controlled_document(…)
```

The accurate statement is: *in **no substantive** arm's domain — only ARM 2's, which
asserts nothing beyond "called at least once."* The distinction matters because this
project's own record is that call-counting is insufficient (ADR 0079 / AUDIT-DOOR-
BLINDNESS), and because a future reader who checks the claim, finds it false, and
concludes the record was merely over-cautious would draw the wrong lesson. The
**conclusion** — *"its assurance is keystones only"* — I verified and agree with.

I also re-derived the census figures independently and they are exact: clause 1
(`prosecdef` + bool-or-retset) = **185**, clause 2 (`public` INVOKER plpgsql,
auth-EXECUTE) = **88** → **273 signatures**, plus **275** policies = **548** live gates;
`ARM=census` reported `live 548 / accounted 569`. The **146** composite-returning
DEFINER figure is also exact. No fourth arithmetic error there.

### MINOR-2 — `DM3B-2` does not assert sha256; the file docstring says the round trip proves it

`e2e/dm3-wave-b-documents.spec.ts` L50-52 claims *"`finalize` DERIVES size/MIME/hash
from what actually landed"*, and the handoff to me repeated it for DM3B-2. DM3B-2
(L295-337) asserts **only** `size_bytes` and `mime_type` against `file_objects`; it
queries no `sha256`. The hash claim is carried entirely by **DM3B-1** (L254), which
asserts `core.sha256 === sha256Hex(payload.buffer)`.

The property *is* proven — nothing ever declares a hash, so there is no lie for
`finalize` to discard, and DM3B-1's assertion against an independently computed hash of
the uploaded buffer is the right proof. Only the label is wrong. Fix the docstring or
add the sha256 assertion to DM3B-2.

### MINOR-3 — `HC0DI` / `HC0DJ` have no pt-BR mapping; and `mapEthicsError` echoes `error.message` for its neighbours

DM3 makes `HC0DI` (`app.guard_ethics_document_case_scope`) and `HC0DJ` (the two ethics
doors' own read/scope checks) newly reachable. Neither has a case in `mapEthicsError`
(`src/lib/ethics/actions.ts:165-189`); both fall to `default: return MESSAGES.generic`.
That is safe (pt-BR, no raw text) and, given the D17 no-UI scope boundary, currently
unreachable from any screen — so it is MINOR, not MAJOR.

The adjacent risk is worth recording while the file is open: `mapEthicsError` returns
`error.message || …` for `HC0J1` (`:171`), five codes at `:181`, `42501` (`:183`) and
`P0002` (`:185`). Those messages are authored pt-BR strings today, so nothing raw
reaches the UI — but the pattern is one `raise exception` away from doing so, and
ARCHITECTURE Rule / CLAUDE.md §8 forbid raw Postgres text in the UI categorically.
Pre-existing, not a DM3 regression. Recommend a follow-up rather than a DM3 fix.

### MINOR-4 — `docs/backend-state.md` was not updated

The backend surface changed materially (one new door, two retired symbols, two dropped
Storage policies, a new `securable_resources` type, two ethics FKs). §6 step 5 puts this
update at the *record* step, so this is on schedule, not late — flagged only so it is not
skipped, since the DM2 record was bitten by exactly this file going stale.

---

## INFO

- **INFO-1 — the wizard's file field has no accessible label; pre-existing, NOT DM3.**
  `create-wizard.tsx:1093-1099` ties `<FieldLabel htmlFor="wizard-file">Arquivo` to the
  `id` that `Dropzone` (`src/components/ui/dropzone.tsx:99-110`) places on an
  `aria-hidden="true"` / `tabIndex={-1}` / `sr-only` `<input type="file">`. The control a
  user actually focuses is the sibling `<button>` (`dropzone.tsx:155-179`), which carries
  `aria-describedby` but no `aria-label` / `aria-labelledby` back to "Arquivo". A
  screen-reader user hears only the dropzone's inner text. **I verified this is not a DM3
  regression:** `git show 4c6f7d9:src/components/controlled-documents/create-wizard.tsx`
  contains the identical four lines (at L788-798). `add-version-form.tsx:280-296` — which
  DM3 *did* rewrite — uses a plain visible `<input id="documentFile">` under its
  `FieldLabel` and is correct. Recommend a follow-up against `Dropzone`'s call sites
  repo-wide, not a DM3 change.
- **INFO-2 — the MIME stored by `finalize` is the upload's `Content-Type` header, not a
  byte sniff.** `finalize_document_upload` reads `storage.objects.metadata->>'mimetype'`.
  I chased this as a possible stored-XSS vector and it is closed twice over: the bucket's
  `allowed_mime_types` excludes `text/html` and is enforced by the Storage API on the
  PUT, and `openDocumentVersion` signs with `{ download: fileName }`
  (`src/lib/documents/actions.ts:238`), forcing `Content-Disposition: attachment`. No
  action; recorded so the next reader does not re-chase it.
- **INFO-3 — door/TS agreement on the source binding is structurally safe.**
  `open_document_version` selects the source binding with `order by created_at desc limit
  1` while `openDocumentVersion` re-resolves it with `.single()`. Divergence is
  impossible: `document_version_files_version_rendition_uniq UNIQUE (document_version_id,
  rendition_kind)`. Both resolve from the same `documentVersionId` the door authorized,
  so there is no confused-deputy seam.
- **INFO-4 — `ARM=wrapper`'s INVOKER clause is `nspname = 'public'`-bounded**, so
  `app.assert_documents_wave_b_enabled` is outside it. Already self-reported by the lead
  in PROGRESS.md as a fourth `enumeration-bounded-by-location` instance; I confirmed the
  clause. No action in DM3.
- **INFO-5 — `securable_resources` rows are not reaped when a controlled document is
  deleted.** `controlled_documents_securable_resource_fk` points *into* the registry, so a
  `DELETE` leaves an orphan registry row (and `documents.home_resource_id` would keep it
  alive anyway). Harmless — the registry holds identity + tenant anchors only (D4, anti-EAV)
  and `can_read_document` resolves through `documents`, which is gone. Recorded, not filed.

---

## What I VERIFIED vs what I ACCEPTED

Everything under "verified" I reproduced myself against the live catalog or by running
it. All mutations were executed inside `BEGIN … ROLLBACK`; I confirmed zero residue
after every one (no `QATWIN` marker in any body, `trg_guard_document_confidentiality`
back to `tgenabled = 'O'`, `documents_wave_b` back to `true`, zero probe rows).

### Verified

| # | Claim | How |
|---|---|---|
| 1 | **P0-DM3-1's fix is complete and unbypassable** | `mint_controlled_document_resource_trg` is `BEFORE INSERT … FOR EACH ROW` on `controlled_documents`, so it fires on *every* insert path incl. direct/seed/`COPY`. `securable_type` is `NOT NULL DEFAULT 'controlled_document'`, so the composite FK `(id, securable_type) → securable_resources(id, resource_type)` cannot be satisfied vacuously by a NULL (the CHECK alone would have been). The FK is validated (no `NOT VALID`). `authenticated` has **no INSERT policy** on `controlled_documents` — a direct insert returns **42501**. Only one routine in the catalog inserts into the table. |
| 2 | **Both R3 twins genuinely falsify — and the two-mechanisms finding is real** | I re-ran them independently. Baseline → `OK`. Trigger-only neutralized → **`OK`**. Door-insert-only neutralized → **`OK`**. **Both** neutralized → **`REFUSED 23503`**. Exactly the lead's TWIN B construction; a single twin would have certified a keystone that cannot fail. |
| 3 | **The A4 negative twin falsifies on WIDENING** | Widened `can_read_document`'s `case` branch with `or app.is_member_of_for(v_commission, p_uid)`, guarded by `if mutated = src then raise`. Baseline A4 = `f`, A4b = `t`; **mutated A4 = `t`** → the pin reds. The twin is the assertion, as the suite comment says. |
| 4 | **The ethics reader set was NOT widened** | `can_read_document`'s `controlled_document` arm is `is_member_of_for OR is_document_approver_of`; the `case` arm remains `can_read_case` + the clearance conjunct. `app.guard_ethics_document_case_scope` (BEFORE INSERT/UPDATE OF on **both** ethics tables) forces `resource_type = 'case'` **and** `home_resource_id = new.case_id`, code `HC0DI`, independent of the doors' own `HC0DJ`. |
| 5 | **All five D17 discharge conditions** | (1) `ethics_decision_details_decision_letter_document_fk` and `ethics_notifications_related_document_fk` both `→ documents(id) ON DELETE RESTRICT`. (2) `issue_ethics_notification` still the **8-arg** identity; ACL intact. (3) the `HC0DM` refusal is gone from the body. (4) `328` `plan(130)→plan(128)`, K8c and only the ethics precondition removed; K8a/K8b and their preconditions intact. (5) `set_ethics_decision_details` is the **12-arg** identity, **no 11-arg overload survives**, and `proacl = {postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}` — **the re-GRANT after DROP+CREATE happened**, asserted from `pg_proc.proacl`, not migration text. TS forwards at `src/lib/ethics/actions.ts:411`. |
| 6 | **The D15 ceiling still bites, and fails closed on a Wave-B home** | `HC0D6` refuses `legal_privileged` on a controlled-document home (probed: `REFUSED HC0D6`). Forced past the guard, the ceiling denies **both** the commission member and the entitled approver (`f`, `f`) — the `else null → return false` arm. On a `case` home the ceiling **narrows**: uncleared CCIH member `f`, cleared reader `t`. Under `set local role authenticated` as `staff1.ccih`, `documents`' RLS returns **1 of 2** probe rows — the controlled one, not the privileged case one. |
| 7 | **`can_read_document` / `can_write_document` split** | Table in MAJOR-1(e). Approver reads and cannot write; plain member neither; cross-org principal `f`. |
| 8 | **Both `controlled-documents` Storage policies are gone** | `select count(*) from pg_policies where schemaname='storage' and qual||with_check like '%controlled-documents%'` → **0**. No SELECT policy on `documents-standard` / `documents-phi` either; only the two `…_insert_reserved` policies, whose predicate `app.storage_upload_reserved` pins bucket + exact path + `reserved_by = uid` + `state='reserved'` + unexpired + `upload_state='reserved'`. |
| 9 | **The retired symbols are actually gone** | `set_document_version_file` and `app.can_read_document_object`: **0 rows** in `pg_proc`. `controlled_document_versions.storage_path`: absent from `pg_attribute`. |
| 10 | **The no-PHI stance is enforced twice** | `reclassify_document` raises `HC0DH` for a `controlled_document` home *before* consulting file state; and `begin_document_upload` derives the tier server-side (`case … in ('case','interview') then 'phi' else 'standard'`), so a controlled home can never reserve a PHI bucket. |
| 11 | **The four authz arms** | I ran three myself: `ARM=census` → **HOLDS** (548 live / 569 accounted). `ARM=hat` → **HOLDS** (self-test 6/6; 3 reasoned-allowlisted findings). `FROMFINDINGS=1 ARM=wrapper` → **HOLDS** (BLIND 41, all allowlisted). |
| 12 | **Build gates** | `npm run typecheck` → **0**. `npm run lint` → **5/5** (`eslint` 0/0 · css-vars · memberships-door 0 · client-server-imports 0 findings / 473+124 modules, self-test 10/10 · vacuous 0 findings / 180 specs, self-test 42/42). `npm run test` → **86 files / 1258 passed**. |
| 13 | **Migration reconciliation** | 385 files on disk = 385 rows in `supabase_migrations.schema_migrations`; max version `20260925001000`. |
| 14 | **DM3B-1 is genuine byte equality** | Uploads through the real browser client chain, then `Buffer.compare(returned, payload.buffer) === 0` on the body fetched from the **door-signed** URL, plus an independently computed `sha256Hex(returned)` and a per-run unique marker. It cannot pass on an empty body, a truncated body, or the wrong file. Neither DM3B-1 nor DM3B-2 is skipped or flag-gated in-spec. |
| 15 | **DM3B-2's lie is a real lie** | `declaredMime: 'text/plain'` + `declaredSize: 1` accepted at `begin`; a real PDF PUT with `Content-Type: application/pdf`; then `size_bytes` asserted `=== payload.buffer.length` **and** `.not.toBe(1)`, `mime_type === 'application/pdf'`. |
| 16 | **The client corridor leaks no coordinates** | `beginDocumentUpload` resolves bucket/path with `createAdminClient()` **server-side** and returns only `{method, url, headers, expiresAt}`; the client PUTs with plain `fetch`. No service-role key, bucket name or raw path reaches the browser. The one `src/lib/queries/*` import in `create-wizard.tsx:19` is `import type`, which the client/server gate treats as erased — and that gate passes with 0 findings. |
| 17 | **INFO-1 is pre-existing** | The `wizard-file` / `Dropzone` wiring is present verbatim at the DM3 base commit `4c6f7d9`. |

### Accepted (not independently reproduced), with the reason

- **`e2e:prod` GATE GREEN** — 1102 passed · 0 failed · 2 flaky · 0 did-not-run · 18
  batches · accounted 1104/1110 with the 6 unaccounted being the 6 skips. The full gate
  is lead-run and hours long; a subagent cannot run it. I accept the lead's arithmetic
  and the stated per-batch `accounted N/N` verification. The two flaky specs
  (`act-role-assumption.spec.ts:157`, `phase2-auth-shell.spec.ts:268`) are outside the
  DM3 diff — I confirmed that from the diff, not from the claim.
- **pgTAP 190 files / 6150 tests / PASS on a fresh reset** — I did not re-run
  `supabase db reset` (shared stack; announcing and resetting mid-review would have
  destroyed the E2E-exercised state and cost the session). I verified the suite *content*
  of `330` and `328` directly, ran the mutation twins myself, and verified every
  structural claim `330` makes against the catalog independently.
- **`ARM=floor` HOLDS** — I did not re-run it: it mutates `track_functions` on the shared
  database and runs the whole pgTAP suite. I verified its *domain* query instead (411
  signatures) and used that to produce MINOR-1.
- **The diff-scoped door sweep: `can_read_document` COVERED, `can_write_document`
  `ERROR run-shape!=baseline` resolved by runlog to substantively covered (14 reds across
  5 suites), BLIND 0.** I did not re-run the sweep. The `ERROR` cause is credibly
  diagnosed and filed as `FUP-329-ABORT-SHAPE` (a keystone whose failure aborts the file
  and drops 41 assertions — the same class `330` already fixed for B4 with a catching
  wrapper). I did independently verify the *substance* the sweep was trying to establish:
  `can_write_document`'s `controlled_document` arm discriminates staff_admin from member
  from approver (MAJOR-1(e)). **Caveat stated plainly:** an `ERROR` is not a pass, and the
  resolution rests on reading a runlog rather than on a clean verdict. It should not be
  cited later as "COVERED".
- **Production catalog / object counts / flag state** — no production access, per the
  plan's own §10. Every production statement in this review is sourced to the 2026-08-11
  audit record.

---

## On the lead's three self-reported errors

All three corrections are **right**, and I checked each rather than accepting it.

1. **"My gate-RED diagnosis was one level too shallow."** Correct, and the correction is
   the most valuable single act of the phase. I confirmed the seed *is* one of the
   writers that violated M1's FK — but so is the product's own create door, and a
   seed-only fix would have gone green with a wizard that raised `23503` on every
   attempt. The M8+M9 pair is the right shape: M8 fixes the door, M9 makes the property
   hold for writers nobody enumerated.
2. **`git add -A` swept backend's work into three docs commits.** Confirmed as described;
   history correctly not rewritten. No content is lost or misattributed in the tree — only
   the commit messages under-describe. Agreed disposition.
3. **`FUP-PGTAP-SAVEPOINT` filed by generalizing from a degenerate repro, then measured
   and downgraded.** The correction is right, and the *method* — measure the coverage
   actually lost before asserting a gate-integrity hole — is the one this project keeps
   having to relearn (`a-detector-that-finds-a-lot-needs-proving-too`).

**A fourth error, as requested.** I found one, and it is MINOR-1: *"in no authz arm's
domain"*, stated in the plan's §10 risk 4, in PROGRESS.md, and in the handoff. It is
false for ARM 2, whose domain is every `public` `prosecdef` function EXECUTE-able by
`authenticated` — 411 signatures, including both functions the claim names. The
conclusion drawn from it is correct; the reason given is not. I looked hard for a
fourth *arithmetic* error and did not find one: the 273 / 146 / 548 figures all
reproduce exactly.

---

## Answer to the handoff's question 4 — is keystones-only assurance sufficient for `attach_controlled_document_version_file`?

**Yes, for DM3 — and no, as a standing posture.**

Sufficient here because the door's boundary is a single named predicate
(`app.is_staff_admin_of(v_commission)`) with no branching, and it is pinned three ways
that each fail differently: `DM3·P1c` (a plain member cannot attach), `DM3·P1` (the
door's own freeze, `HC089`, distinct from the trigger's `HC0DB`), `DM3·P1b` (the positive
control that P1/P1c are not "refuses everyone"), plus `314 §10.3` for the tenancy-admin
wall. I re-verified the discriminations directly (MAJOR-1(e)): outside approver → 42501.
A door this shallow is within what keystones can hold.

Not sufficient as a posture because the reason it is unswept — composite return type — is
a property of its **signature**, not of its risk, and the class is now **146** functions
wide. The lead's refusal to mint a findings-md row it did not earn, and to widen the
domain mid-phase, were both correct. But the third measured edge on the same file, and
the first found by counting rather than by a live leak, is the argument for scheduling
the widening rather than carrying it. **That is a PO scheduling decision and I do not
consider it a DM3 blocker** — DM3 added one member to a pre-existing class and declared
it honestly in `authz-unswept-backlog.txt` rather than in the BLIND allowlist, which is
the correct half of that distinction.

---

## Already-dispositioned, NOT re-filed

`FUP-DM3-ETHICS-UI` (no attach-a-letter UI — PO-ruled scope boundary) · the 146-function
census blind class (pre-existing; see above — **I do not consider it blocking**) ·
deliberate tombstone comments and the lead's recommendation not to build the
stale-symbol gate · `FUP-329-ABORT-SHAPE` · `FUP-DM3-SIGBASIS` ·
`FUP-LINT-STALE-SYMBOL-COMMENT` · `FUP-PGTAP-SAVEPOINT` (downgraded) · the untested
`documents_wave_b`-OFF charter arm — **except** that MAJOR-1 is precisely what that
untested arm was hiding, so it is raised as a new finding rather than as a re-file.

---

## Re-review scope

MAJOR-1 only. If fix (1) is chosen I will want to see the new keystone red with the
`assert` removed, one twin, before the arm counts as covered. MINOR-1 through MINOR-4 and
all INFO items are recordable without a second round.
