# DM4 — Wave C: referrals · QA review (gate step 3)

- **Verdict: ⛔ CHANGES REQUESTED**
- **Round:** 1 · **Date:** 2026-08-14 · **Branch:** `main` · **HEAD audited:** `f8052575`
- **Counts: 0 P0 · 3 MAJOR (2 blocking) · 8 MINOR · 6 INFO**
- Contract audited against: `docs/plans/dm4-referrals-plan.md` §§0–4 · ADR
  [0119](../decisions/0119-dm4-referral-document-substrate-decisions.md) D1–D10 ·
  `docs/progress/dm4-surface-verification.md` · PROGRESS.md DM4 section + both gate records.

**Method note.** Every schema / RLS / RPC / authorization claim below was resolved from the
**live catalog** (`pg_proc.prosrc`, `prosecdef`, `pg_policies`, ACLs, `information_schema`)
on the running stack, never from migration text. Migration files were read only for
`DROP FUNCTION` *intent*, and each drop was then confirmed absent in `pg_proc`. Gate figures
from steps 1 and 2 were **verified, not re-run**, per the spawn constraint; where I could
falsify a recorded figure by read-only measurement, I did, and two of them do not reproduce.

---

## Summary

The substrate move itself is well built. The two-tier referral asymmetry survives it
correctly, the F-14 signer is genuinely dead at the catalog level, the DM1 allowlist really
is at zero exceptions, the audit-exactness criterion is pinned on a structured field rather
than on translatable prose, and Rules 7 / 9 / 11 / 12 and the service-role boundary all hold
under adversarial probing. ADR 0119 D9 — the item I was asked to challenge hardest — is
**correct**: I verified from the catalog that the read authority genuinely is the metadata
tier at every seam, and that no row crosses PostgREST to a reader the door would refuse.

Three things block. Two are assurance-integrity defects: the phase's own headline evidence
("16/16 RED-PROVEN") **does not reproduce at HEAD**, because a later migration rewrote a
function body that one matrix case mutates by string match; and the retired storage twin's
*can-fail* proof was deleted while the in-tree disposition comment claims a matrix coverage
that does not exist. The third is a live authorization gap: the freeze corridor never checks
whether the caller may read the document it is freezing, so a **recused or respondent**
source-commission coordinator can route around the case-exclusion perimeter to PHI-classified
bytes. I demonstrated that one on the live catalog.

None of the three is a *shipped* leak — `documents_wave_c` ships OFF — and none is a
cross-tenant hole. But two of them are exactly the failure classes this project has already
paid six review rounds to learn, and the third defeats a clinical-governance control.

---

## Blocking findings

### 🔴 MAJOR-1 — `16/16 RED-PROVEN` does not reproduce at HEAD: N10b's mutation is a silent no-op *(blocking)*

**Requirement violated:** plan §4 exit criterion 4 — *"Bespoke keystones for both blind doors,
each **proven able to fail**"*; plan §3.1 — *"A keystone never proven able to fail is not a
keystone."*

`supabase/tests/mutation/dm4-referral-doors-matrix.sh:157-165` (case **N10b**) mutates
`open_referral_snapshot_document` by `pg_get_functiondef` + `replace()`, searching for:

```
  perform public.log_audit_access(
    'referral.viewed', 'referral', v_item.referral_id, v_referral.source_commission_id,
    'Documento do encaminhamento ' || coalesce(v_referral.code, '') || ' acessado', '{}'::jsonb);
```

Migration `20260926000500` (M5, commit `726032fc`, ADR 0119 D10) rewrote that call to pass
`jsonb_build_object('kind','document_open', …)` instead of `'{}'::jsonb`. Measured on the live
catalog:

```
N10b_replace_matches = false
```

SQL `replace()` on a non-matching needle returns the haystack unchanged, so **N10b now injects
only its first mutation (the PHI gate) and degenerates into N10a**. The audit lock still
raises, the transaction aborts, and `C11b` never emits a TAP line — `run_case` would classify
it `[C11b]=ABSENT(aborted?)` → `*** VACUOUS` → `fail=1` → the script exits non-zero.

**The commit history confirms it was never re-run.** `git log -- …matrix.sh` shows **exactly
one commit, `66084b4f`**, which precedes `726032fc`. The gate-step-1 record that carries
"16/16 RED-PROVEN" was written at `c86a4f16`, also before M5. The later
"↻ Re-confirmed at HEAD" pass re-ran pgTAP, the four arms and the build — **not the matrix.**

**Scope, measured — the defect is bounded to N10b.** I checked every other `replace()` source
literal in the harness against its live target: N1, N2/N3, N4, N5, N7, N8, N9a, N9b, N10a's
gate, N11, N12, N13 and N6's 11-arg signature **all still match**. So the write seam
(`add_referral_shared_item`: N7/N8/N12) and `can_write_document` (N4/N5) retain valid
red-first proofs. What is lost is specific: **nothing at HEAD proves the C11 family can fail
against a mutated gate.**

**Aggravating context.** M5's own commit message cites the lesson it then broke:
*"a replace that matches nothing silently no-ops"* — it added a no-match guard that RAISES to
the migration, and did not apply the same guard to the harness the same commit invalidated.

**Required:** re-point N10b's second `replace()` at the current body (or better, give it the
same no-match guard M5 gave itself, so a future body rewrite fails loudly instead of
degrading), re-run the matrix, and record the figure with the HEAD it was measured at. Until
then the "16/16" figure must not be cited as evidence for anything in the C11 family.

---

### 🔴 MAJOR-2 — the retired positive twin lost its can-fail proof, and the disposition comment claims coverage that does not exist *(blocking)*

**Requirement violated:** plan §4 exit criterion 5 — *"Negative twin green, **preserving the
two-tier asymmetry**"*; plan §3.2 — *"a twin that collapses them into one tier passes by
construction and proves nothing"*; ADR 0079 / authz-handoff §7 ("text is not truth").

`git diff 17b1516b..HEAD -- supabase/tests/mutation/u1-mutation-audit.sh` removes two
injections:

- `restore_casedoc_member` — the leak injection that proved `236` ③a/③c can fail;
- **`drop_snapshot_arm`** — which closed the load-bearing snapshot arm and required the
  **positive** twin ("the referral recipient STILL reads") to go red.

Removing them was *necessary* — both `ALTER`ed `case_documents_select_member`, which M4
dropped, and a mutation that cannot mutate reports success. But the replacement comment
(`u1-mutation-audit.sh:133-140`) asserts:

> *"Their keystones' successors live in pgTAP 340 (C10a/C11b/C11d/D4a) and are matrix-covered
> by dm4-referral-doors-matrix.sh (N10a/N10b/N11)."*

The matrix's complete expected-red pattern set is:
`B10c · B1 · B4 · B6c · B6a|B6b|B5c · B9a|B9b · C3 · C4 · C6 · C5 · C11b · C13c|E2 · C7a · C13b|C13c`.

**`C10a`, `C11d` and `D4a` appear in no matrix case at all**, and `C11b`'s only case is the
broken N10b. So at HEAD, **zero of the four named successors is matrix-covered.** The claim is
false as written and false in a way that reads as reassurance.

Two further substantive gaps behind it:

1. **Polarity.** ③TWIN was a *positive* twin — it detected **over-narrowing**. Of the four
   named successors, only **C11d** (the B-side target coordinator reading the frozen snapshot
   cross-commission, controlled by C11a and C12) actually carries that property. `C10a` reads
   as the **source**-commission coordinator (claims set at `340:428`, not changed until
   `340:503`) — the wrong side of the boundary ③TWIN existed to test. `C11b` is a *deny*, which
   passes by construction under any over-narrowing. `D4a` is a retirement pin, a different
   category. The successor list in `236:15-21` / `236:224-230` overstates coverage ~4×.
2. **No narrowing mutation exists anywhere for the new door.** Every N10*/N11 case *opens* a
   gate. Nothing narrows `open_referral_snapshot_document`'s PHI gate to require C10a/C11d to
   go red — which is precisely what `drop_snapshot_arm` did for the retired arm. C10a/C11d were
   red-first-proven only against door **absence** (`pg_temp.snap` → `"__ABSENT__"`), which the
   gate record itself correctly classifies as the *weak* class: "Absence-red proves
   authorship-before, not falsifiability."

**Required:** either add a narrowing case to the matrix (e.g. collapse the door's gate to a
predicate the B-side recipient fails, and require C10a/C11d red) — the surviving
`restore_interview_attach_policy` is the template for converting rather than deleting — or
correct the disposition comment in `u1-mutation-audit.sh` and `236` to claim only what is
true. **A correction alone leaves exit criterion 5's positive half unproven**, so I recommend
the mutation.

---

### 🔴 MAJOR-3 — the freeze corridor never checks whether the caller may read the source document: a recused coordinator reaches PHI bytes around the exclusion perimeter

**Requirement violated:** Architecture Rule 1 (the DEFINER's gate *replaces* RLS and is
under-inclusive) · ADR 0119 D4's own stated rationale · the exclusion perimeter `236` exists
to close.

`public.add_referral_shared_item` (`prosecdef = true`) resolves the source document with:

```sql
select d.* into v_doc
  from public.documents d
  join public.securable_resources s on s.id = d.home_resource_id
 where d.id = p_source_document_id
   and s.resource_type = 'case'
   and d.home_resource_id = v_referral.source_case_id
   and d.status = 'active';
```

There is **no `app.can_read_document(p_source_document_id, auth.uid())` check, and no
`can_read_case`.** The caller's only gate is `app.assert_referral_draft_writable` →
`app.can_manage_referral_source` → `app.is_staff_admin_of_for(source_commission_id)`. The
byte door `open_referral_snapshot_document` then gates on `app.can_read_referral_phi`, whose
source-side arm is the **same** `is_staff_admin_of_for(source_commission_id)`. And
`app._audit_access_authorized`'s `'referral.viewed'` arm is *also*
`can_read_referral_phi` — so both locks open together.

Meanwhile `app.can_read_document`'s `case` arm is `app.can_read_case` =
`app.has_case_capability(…, 'read_case_content')`, which hard-denies a principal who is
`app.is_case_excluded` (respondent or recused).

**Demonstrated on the live stack** (single transaction, `ROLLBACK`ed; `chefe.ccih`, a
`staff_admin` of CCIH, recused from case `d0000000-…c1`, evaluated against the real referral
`efa00000-…a1` homed on that case):

```
app.can_read_case(caseA, u)                    = false
app.can_manage_referral_source(ref on caseA,u) = true
app.can_read_referral_phi(ref on caseA, u)     = true
```

So the same principal the platform's own capability resolver refuses on the case can (a) open
a referral draft on that case — `create_referral_draft` gates on `is_staff_admin_of_for`, not
on case access — (b) freeze any active document homed on it, and (c) read the bytes through
the audited door, which records the read as a legitimate `referral.viewed`.

**Why this is DM4's to answer and not simply inherited.** The `narrative` arm has the identical
shape and predates DM4, so the *class* is pre-existing. But before DM4 the `document` arm
failed closed (`HC0DM`); DM4 is what makes **document bytes** reachable this way. And ADR 0119
D4 reasons about exactly this seam — *"the referral corridor has no clearance plane, so
freezing would launder the D15 ceiling"* — then stops at the two enforcing labels. The
identical argument applies to the **case-capability plane**, which the ADR does not consider.
The refusal set is under-inclusive relative to its own rationale.

**Mitigating:** `documents_wave_c` ships **OFF** in production, so the path is inert today;
the actor must be a source-commission `staff_admin`; the access is audited; it is not a
cross-tenant leak. That is why I grade this MAJOR and not P0 — but recusal is a
conflict-of-interest control in a clinical-governance product, and an audit row that reads as
a normal referral view is a poor consolation.

**Required — a PO ruling at minimum, recorded in ADR 0119.** Either (a) add
`app.can_read_document(p_source_document_id, auth.uid())` to the document arm (and consider
the narrative arm's twin), or (b) rule explicitly that referral authority is
commission-scoped by design and that case exclusion does not reach it, and pin that ruling in
`236` so it cannot be rediscovered as a bug. Silence is the one outcome I will not sign off.

---

## MINOR

- **MINOR-1 — the matrix does not neutralize the availability/disposal locks independently.**
  Answering the challenge directly: **16/16 is not sufficient**, though it is close. The
  *authorization* states are opened independently and correctly (HC071 vs HC070 as separate
  barriers is exactly right, and the DM3 one-barrier-two-codes trap is avoided). But
  `add_referral_shared_item`'s `d.status = 'active'` clause and the servable-file subquery's
  `f.disposal_state = 'none'` / `upload_state in (…)` predicates, and
  `open_referral_snapshot_document`'s `v_doc.status in ('disposal_pending','disposed')`,
  `v_file.disposal_state <> 'none'` and `v_file.upload_state not in (…)` checks, are **not
  neutralized at all**. These are the D5/R5 "disposal kills" locks. `340 C15c` asserts HC0DD
  *fires*, which is real partial cover, but nothing proves those locks are load-bearing. Note
  the `d.status='active'` and `resource_type='case'` clauses share one SQLSTATE (`HC077`) with
  the not-found case — the same shape DM3 was bitten by, in the freeze arm this time.
  N11 is acceptable as built: it opens both tombstone conditions at once, but `C13c` and `E2`
  are distinct assertions covering the two conditions separately, so each is observed.

- **MINOR-2 — N10a proves less than its label suggests.** Answering the challenge: yes, a
  keystone here proves less than it appears. The "second lock" is **not independent** — I
  resolved `app._audit_access_authorized`'s `'referral.viewed'` arm and it returns
  `app.can_read_referral_phi(p_entity_id, v_uid)`, the *identical* predicate as the door's own
  gate. So `open_referral_snapshot_document` is defence-in-depth on **one** predicate applied
  twice, not two locks. N10a therefore proves the *audit layer* refuses; it says nothing about
  whether the gate is load-bearing. Combined with MAJOR-1, **nothing at HEAD proves 340 goes
  red when that predicate is removed from both sites.** ADR 0119's ⭐ Consequences note should
  say "the same predicate, enforced twice" rather than "more than one lock" — the current
  wording invites the reader to bank two independent locks.

- **MINOR-3 — the census figure is unreconcilable as recorded; the true HEAD value is 141.**
  Answering the challenge: it is resolvable, and *both* recorded numbers are wrong at HEAD.
  Applying the exact definition recorded in `docs/progress/dm3-controlled-documents.md:209`
  (`prosecdef`, composite-returning, **non-`proretset`**, `authenticated`-EXECUTE, schema
  `public`):

  | measurement | count |
  | --- | --- |
  | exact recorded definition, at HEAD | **141** |
  | …allowing `proretset` | 144 |
  | …`public` + `app` | 145 |

  DM4 removed exactly one member (`add_referral_reply_attachment`, composite-returning;
  `get_referral_attachment_path` and `get_referral_snapshot_document_path` return `text` and
  `app.can_read_snapshot_document` is `boolean`, so none of those three were ever in the
  class), giving **142 pre-DM4** — neither 146 nor 150. DM4's own additions
  (`open_referral_snapshot_document`, `list_referral_reply_documents`) return `jsonb`, so they
  join the *other* blind class, not this one. The plan's instruction "do not report as growth"
  is right, for a different reason than it gives: the discrepancy is in the **recording**, not
  in the population. Record the query beside the number so the next reader can reproduce it.

- **MINOR-4 — the T6 caveat lives only in the commit message, and the in-file header
  contradicts it.** Confirmed by running both implementations over all six inputs: T6 is the
  only case where the shipped merge and the original concatenation produce identical output
  (`uploaded = []` makes the seeding loop at `reply-attachment-rows.ts:65` a no-op), so it is a
  regression guard, not a red-first pin. Five of six (T1/T2/T3/T4/T5) **are** proven pins, and
  every load-bearing property — dedup, tie-break, insertion order — is covered
  non-vacuously, so coverage is fine. What is not fine: `reply-attachment-rows.test.ts:162-163`
  says only "Guards against a merge that only behaves when `uploaded` is non-empty" without
  saying the case cannot discriminate, while the file header at `:23-25` asserts **"All four
  were observed RED against the ORIGINAL concatenation"** — in a six-test file with five pins.
  The accurate count (`5/6`) lives only in commit `f8052575`'s subject. **Yes, this matters**:
  this is the [[a-comment-is-an-assertion-that-goes-stale-silently]] class, in a file whose
  entire purpose is to be the durable pin for BUG-DM4-DUP-1. One-line fix, no test change.

- **MINOR-5 — HC0DC's pt-BR message is dead where it is needed (Rule 10).**
  `mapReferralDocumentError` maps HC0DC, but its only call site is
  `src/lib/referrals/actions.ts:564` (the snapshot open door), which per the catalog raises only
  HC0DS / HC0DD / HC0D8. HC0DC is raised by `add_referral_shared_item` — the freeze — whose
  action routes through `mapReferralError`, which has **no HC0DC case** and falls to
  `REFERRAL_MESSAGES.generic`. So R3's specific, actionable refusal ("documentos com
  confidencialidade restrita não podem ser compartilhados em encaminhamentos") is replaced in
  the UI by a generic string, exactly where a coordinator needs to be told to de-label first —
  the "accepted cost" R3 explicitly signed up for becomes unexplainable.

- **MINOR-6 — two error codes in the new document vocabulary are unreachable.**
  `referral-document-labels.ts:14-18` justifies the file on "three codes Wave A has no concept
  of", but `not_target_coordinator` (HC072) and `referral_wrong_state` (HC070) cannot be
  produced on any document path: `can_write_document`'s referral arm returns a plain boolean, so
  a wrong actor **and** a wrong state both surface as `42501` → `forbidden`. Dead vocabulary,
  the class the same file warns about at `:130-141`.

- **MINOR-7 — three accessibility gaps on the new upload control.** The control is largely
  good (real `<label htmlFor>`, polite live region, Enter intercepted so it attaches rather than
  concluding the referral, inert rows explained in text rather than colour). But:
  (a) `referral-reply-attachments.tsx:303` ends `focus-visible:outline-none` with **no
  replacement ring** — CLAUDE.md §8 requires visible focus; note this is a verbatim copy of the
  Wave-A pattern (`documents/document-upload-dialog.tsx:343`, `meetings/minutes-upload-dialog.tsx:257`),
  so fix it as a three-site sweep, not a DM4-local patch;
  (b) the error spans at `:308-312` and `:346-350` have no `id` and are never added to
  `aria-describedby`, so a user returning to the field hears the hint but not the error;
  (c) the fresh/"Anexado" state at `:267-274` is icon-only with both icons `aria-hidden`, which
  contradicts this codebase's own "icon + text + shape — never colour alone" standard.

- **MINOR-8 — the retirement pins are all zero-count negatives with no positive control.**
  `328` K1a–K1d and `340` D1/D2/D3/D4a/D4b/D6/D7 are every one of them `is(count(*), 0)`. I
  verified each is *currently correct* against the live catalog, so this is not a false pin —
  but a mistyped schema filter or table name passes silently forever, which is the
  [[detector-that-finds-nothing-must-be-proven-able-to-find-something]] class. `325` t4→t5 shows
  the team knows the remedy and applied it there; `328`/`340` went the other way in the same
  commit series (`328` K2a–K2g flipped from seven `ok(exists(…))` probes to `ok(not exists(…))`,
  leaving zero positive catalog probes in that file). Partial mitigation exists: `u1`'s surviving
  `restore_interview_attach_policy` injection would flip K1b. One `is(count(*) >= 1, true)`
  sibling probe per catalog view per file closes it.

---

## INFO

- **INFO-1 — the `attachments` naming collision is real but latent.** `.enabled` is computed
  at exactly two sites and both read `documents_wave_c`
  (`…/encaminhamentos/[referralId]/page.tsx:155`, `…/direcao-tecnica/[referralId]/page.tsx:115`).
  A flag key literally named `attachments` exists and is `false`, but **no code path reads it**.
  It fooled the lead and it briefly fooled me; renaming the interface field `enabled` →
  `waveCEnabled` would end it.
- **INFO-2 — flag containment is asymmetric between the write and read corridors.** The
  catalog shows `assert_documents_wave_c_enabled` in `begin_document_upload` and
  `add_referral_shared_item` (both write paths, correctly at the first residue-producing step
  per the DM3 lesson) but **not** in `open_referral_snapshot_document` or `open_document_version`.
  With the flag off no residue can be created, so this is containment, not access control —
  `can_read_referral_phi` still gates the door regardless. Recording it so nobody later reads
  "wave-c gates the corridor" as covering both directions.
- **INFO-3 — `listReferralReplyDocuments` (`queries/referrals.ts:1155-1158`) destructures
  `{ data }` and discards `error`.** Fail-safe (`[]`), but a door failure is indistinguishable
  from "no attachments" and is not logged.
- **INFO-4 — `narrowDocumentError`'s `default` branch (`errors.ts:79-80`) defeats
  exhaustiveness.** Unreachable today; a future `DocumentActionErrorCode` member will silently
  degrade to `unknown` rather than failing to compile — the exact protection
  `referral-document-labels.ts:14-18` claims for this surface.
- **INFO-5 — `236` carries two pieces of dead fixture.** The `shared.pdf` object at `236:99` is
  now referenced by nothing, and the new PRE at `236:128` (`can_read_referral_phi(f7200, sa_y)`)
  has no in-file consumer — its shared item is tombstoned `legacy_unreconciled`, so even the new
  door would refuse it (`HC0DS`). It is a premise for a twin that lives in another file with a
  different fixture.
- **INFO-6 — `t5` (`325:72-77`) is a sound positive control and can fail.** Catalog-verified
  non-degenerate (matches exactly 1 row, `documents_phi_obj_insert_reserved`), same derivation as
  the retired t4, and it matches on the bucket literal so it survives a policy rename. Two small
  caveats worth noting for later: the matching row has `qual IS NULL`, so t5 exercises only the
  `with_check` limb (t4's subject was a SELECT policy living in `qual`), and t5 does not control
  t1/t2, which use a space-separated concatenation variant.

---

## Exit criteria (plan §4), individually

| # | Criterion | Verdict |
| --- | --- | --- |
| 1 | Referral E2E green both sides + the new reply-attachment flow; baseline 89/89 | ✅ **MET** — gate step 2 records 99 passed / 0 failed / 0 flaky / 0 did-not-run, coverage 99/99; the 4-spec baseline 89/89 identical to the pre-DM4 measurement |
| 2 | Audit-row exactness; retired bucket path serves nothing | ✅ **MET** — `340 C10b` pins exactly-one and `C10c` pins `metadata.kind='document_open'` on that one row, so the criterion no longer rests on a Rule-10 pt-BR string (ADR 0119 D10). Retirement pinned by `D4a`/`D4b`/`325 t4`; catalog confirms **zero** storage policies referencing `case-documents` or `referral-attachments` |
| 3 | DM1 allowlist empty; door sweep at ZERO exceptions | ✅ **MET** — `328` K1a–K1e carry no allowlist; verified live: 0 `%attachment%` routines/policies/relations/grants in `app`+`public`, and `pg_policies` scan is cross-schema so the storage layer is covered. See MINOR-8 on the absent positive control |
| 4 | Bespoke keystones for both blind doors, **each proven able to fail** | ⛔ **NOT MET at HEAD** — MAJOR-1. The write seam is fine (N7/N8/N12 + N4/N5 all still match the live bodies); the snapshot read door's PHI gate has no reproducible can-fail proof |
| 5 | Negative twin green, preserving the two-tier asymmetry | 🟡 **PARTIAL** — the kernel/byte asymmetry twin is sound and proven in **both** directions (N1 widens the byte gate → `B10c` red; N2 narrows the kernel arm → `B1` red; N3 blankets it → `B4` red), which is exactly the non-collapsing twin §3.2 demands. But the retired storage twin's positive half lost its can-fail proof — MAJOR-2 |
| 6 | Full §6 five-step gate | 🟡 **IN PROGRESS** — steps 1–2 green as recorded (I re-derived registry 391 == 391 and confirmed every retired surface absent from `pg_proc`/`pg_policies`); step 3 is this review; MAJOR-1 loops one step-1 artifact |

---

## Rule compliance

- **Rule 1 (RLS is the boundary)** — 🟡 **PASS with MAJOR-3.** No UI-only access control was
  found; every gate I traced is SQL. `documents`/`document_versions`/`document_version_files`/
  `file_objects` all grant `authenticated` **`r` only**, with RLS enabled and a policy each.
  The defect is *scope* of a DEFINER gate, not placement.
- **ADR 0119 D9, challenged specifically** — ✅ **UPHELD.** `documents_select` USING is
  `app.can_read_document(id, auth.uid())`, whose `case_referral` arm is
  `app.can_read_referral_metadata` — **identical** to the authority the retired
  `referral_reply_attachment_select_readable` carried, so nothing widened.
  `list_referral_reply_documents` gates on the same predicate and computes `can_open` server-side
  from `can_read_referral_phi`; `get_referral_detail` gates on `app.can_read_referral`, which is
  a thin alias for `can_read_referral_metadata`, and passes `v_can_phi` into
  `app._referral_reply_documents`. The projection helper lives in schema `app`, and
  `config.toml:13` exposes only `public` + `graphql_public`, so it is unreachable over PostgREST.
  **No row crosses PostgREST to a reader the door would refuse** — the row set and the door's
  admission set are the same predicate, by construction. `file_objects.storage_path` *is*
  readable at metadata tier through the chain-only `app.can_read_file_object`, but the
  `documents-phi` / `documents-standard` buckets carry **no SELECT policy at all** (verified: 8
  storage policies total, all INSERT except two unrelated evidence-bucket SELECTs), so path
  knowledge yields no bytes — signing is service-role-only.
- **Rule 7 (sanitized Markdown, never raw HTML)** — ✅ **PASS.** `rehype-raw` is absent from
  `package.json` and unimported; the sole renderer uses
  `rehypePlugins={[[rehypeSanitize, SANITIZE_SCHEMA]]}`; all four `dangerouslySetInnerHTML`
  occurrences in `src/` are inside comments. DB-sourced titles and filenames render as text
  children, and `snapshotDownloadFileName` strips to `[a-zA-Z0-9 _-]` before the `download`
  parameter.
- **Rule 9 (data access via `src/lib/queries/`)** — ✅ **PASS.** Across the whole DM4 `src/`
  diff, Supabase clients appear in exactly two server modules
  (`src/lib/queries/referrals.ts`, `src/lib/referrals/actions.ts`); zero in `src/components/**`
  or `src/app/**`. The client islands import `"use server"` actions and a pure-`fetch` upload
  helper. `referral-open-file-button.tsx` passes a discriminated `door` union rather than a
  server function as a prop — the anti-BUG-QI-001 shape, correctly applied.
- **Rule 10 (pt-BR user text; no raw Postgres errors)** — ✅ **PASS on containment**, with
  MINOR-5/6 on mapping. Every DM4 client error path terminates in a mapped constant; the label
  record is total over its code union and entirely pt-BR. All four new SQLSTATEs raised by the
  open corridor (HC0DS/HC0DD/HC0D8, plus HC0DC in the freeze mapper) are mapped.
- **Rule 11 (auditability)** — ✅ **PASS.** Exactly one `referral.viewed` per served open, pinned
  by `C10b`; denials mint none (`C11c`, and the door's `return null` precedes `log_audit_access`
  by construction); the discriminator is a structured `metadata.kind` carrying **references only**
  (`shared_item_id`, `document_version_id`) — never payloads or PHI. Keeping the verb coarse to
  avoid fragmenting the K10 registry is the right call.
- **Rule 12 (PHI isolation)** — ✅ **PASS.** Reply documents are tier-pinned `phi`; the two-tier
  asymmetry is preserved and keystoned on both halves; `app` schema unexposed;
  `SUPABASE_SERVICE_ROLE_KEY` is referenced only in `src/lib/supabase/admin.ts`, whose first line
  is `import 'server-only'`, and no `"use client"` module in the diff reaches it. Signing is
  server-side with a 120 s TTL, and no storage coordinate is ever passed as a prop.

## Follow-ups filed this phase

`FUP-DM4-PRODROW`, `FUP-DM5-STORAGE-ORPHANS` and `FUP-PGTAP-VACUOUS` are all present in
PROGRESS.md with owners and correct severity. `FUP-PGTAP-VACUOUS` is the right call and is
reinforced by MINOR-8 and by the vacuity candidates listed above — note especially the
no-observable `lives_ok` cluster (`340` B9c `:306-311`, C7b `:404-408`, C15b `:474-477`) and
`F1` (`:723-726`), whose `23503` is produced by **any** inbound FK and has no childless-referral
control to attribute it. `FUP-DM5-STORAGE-ORPHANS` correctly captures ADR 0119 D8's empirical
finding; the inference about remote behaviour is properly labelled as such.

## Discharge conditions for APPROVED

1. **MAJOR-1** — re-point N10b (preferably with a no-match guard that raises), re-run the
   matrix, record the figure **with the HEAD it was measured at**.
2. **MAJOR-2** — add a narrowing mutation for `open_referral_snapshot_document`'s gate that
   requires `C10a`/`C11d` red; **or**, if the PO accepts the weaker position, correct the
   disposition comments in `u1-mutation-audit.sh:133-140` and `236:15-21`/`236:224-230` to
   claim only `C11d` and only what the matrix actually covers.
3. **MAJOR-3** — a recorded PO ruling in ADR 0119: either gate the freeze on
   `app.can_read_document`, or rule the exclusion perimeter out of scope for referral authority
   and pin that ruling in `236`.

MINOR-1 through MINOR-8 and all INFO items are non-blocking and may be carried, but MINOR-2's
correction to ADR 0119's ⭐ Consequences note and MINOR-4's one-line caveat beside T6 are cheap
and should ride along with the MAJOR fixes.
