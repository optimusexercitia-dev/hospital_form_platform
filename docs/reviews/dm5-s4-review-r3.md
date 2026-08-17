# DM5 · S4 — QA review, round 3 (§6 step 3)

- **Slice:** DM5 · S4 — legacy storage-bucket retirement
- **Reviewed at:** `main` @ `977f1d71` (tree clean), local stack only. Nothing remote touched.
- **Prior rounds:** [r1](./dm5-s4-review.md) ⛔ (2 MAJOR) → [r2](./dm5-s4-review-r2.md) ⛔ (1 MAJOR, new)
- **Scope:** verification of `977f1d71` only, as directed. Nothing wider re-audited.
- **Date:** 2026-08-17
- **Reviewer:** `qa`
- **Verdict:** ✅ **APPROVED**

> **B3 is discharged, and the correction is correct.** I checked the corrected mechanism against my
> own r2 probes and against fresh catalog reads rather than reading it for plausibility, as asked.
> The third telling of this mechanism is the right one, in all four homes plus the fifth the lead
> found himself (the *"Proven able to FAIL"* cause). The `service_role` half — *"succeeds by
> bypassing RLS, not via the GUC"* — is catalog-true: `pg_roles.rolbypassrls = true` for
> `service_role`, `false` for `authenticated` and `anon`. **No inversion, and no over-correction of
> the mechanism.**
>
> ⚠ **But the lead's question 3 — *"anything that overstates what the probes support"* — has two
> answers, both non-blocking and both in the new text:** the *"its own HINT"* attribution is wrong
> (the phrase is in the exception **MESSAGE**; the HINT is different text), and the *"245 /
> 4,402,266 B half an hour later with nothing writing"* datum is a **measurement-scope artifact,
> not drift** — my re-measurement with r2's exact method returns **4,394,074 B, 245 files,
> per-bucket identical**. The conclusions both support are still right; the evidence offered for
> them is not what it claims to be.
>
> ⚠ **And MINOR-4 is 5 of 6, not closed** — for the second consecutive round. The sweep boundary
> also moved once more rather than closing: `200_controlled_documents.sql:16` still indexes the file
> as asserting *"immutable storage bucket (no update/delete policy)"*, 377 lines above the §7
> relabel that says the opposite.
>
> None of the four is blocking: no security control is misstated, no coverage is vacuous, no
> requirement is unmet, and the corrected texts now warn about the exact change that would open the
> lock. **APPROVED with four MINORs and three INFOs.**

| severity | count | blocking |
| --- | --- | --- |
| **P0** | 0 | — |
| **MAJOR** | 0 | — |
| **MINOR** | 4 (all new) | no |
| **INFO** | 3 | no |
| r2's B3 | ✅ **discharged** | — |
| r2's MINOR-8 / -9 / -1 residual | ✅ discharged (MINOR-8's *class* recurs — MINOR-12) | — |
| r2's MINOR-4 | ⚠ **5 of 6 — reported closed, is not** (MINOR-13) | no |
| r2's INFO-5 / -7 / -8 | ✅ recorded | — |

**Stack ownership.** No `e2e:prod`, no ARM run, no stack cycle, no `db reset`, no catalog mutation
of any kind this round — every check was a read (`pg_proc`, `pg_roles`, `pg_class`, `pg_policies`,
a read-only volume walk in a throwaway container). Catalog re-verified after: **4 buckets · 4
storage policies · 0 `r2probe%` · 0 `_mut%` · 0 `storage.objects` rows.** Repo tree clean except
this review and my `PROGRESS.md` verdict row.

---

## 1 · Is the correction itself correct? — **Yes, on every load-bearing clause**

Checked clause by clause against my r2 measurements and fresh catalog reads. The lead is the third
writer of this mechanism; these are the claims that would have to be wrong for the third telling to
be wrong too.

| clause, as now written | my check | verdict |
| --- | --- | --- |
| `protect_delete()` *"tests exactly one thing and is entirely ROLE-AGNOSTIC"* | `pg_proc.prosrc` re-read verbatim: one `IF COALESCE(current_setting('storage.allow_delete_query', true),'false') != 'true'` → `RAISE … ERRCODE '42501'`. No role reference anywhere in the body | ✅ |
| *"the Storage API sets that GUC itself, so the trigger NEVER FIRES on an HTTP delete"* | r2 Probe A: service-role API `DELETE` → `200 {"message":"Successfully deleted"}`, `storage.objects` 1 → 0. A role-agnostic statement trigger cannot be satisfied by a role change ⇒ the GUC was set on that connection | ✅ |
| *"The operative locks … are TWO absent policies, both ours: no SELECT policy (Postgres needs the row visible for the DELETE's WHERE) and no DELETE policy"* | r2 Probe C, rolled back: GUC set + delete policy only → `DELETE 0`; GUC set + **select and** delete policy → `DELETE 1` | ✅ |
| *"Opening BOTH … made the same authenticated HTTP DELETE this test issues return `200 {"message":"Successfully deleted"}`"* | r2 Probe B: step 1 (as shipped) → `403 Access denied`, object survives; step 2 (both locks opened) → `200`, object destroyed. Same URL, same bearer, only the policies varied | ✅ |
| *"It guards direct SQL DML only — which is the context the DM5·S4 migration needs it for"* | `20260927000400`'s `do` block sets the GUC precisely because its `DELETE` is direct SQL. Consistent | ✅ |
| **NEW, item 3 —** *"The service role succeeds because it **bypasses RLS**, not via the GUC"* | `pg_roles`: `service_role rolbypassrls=true`, `postgres true`, **`authenticated false`, `anon false`, `supabase_storage_admin false`**. `storage.objects` owner = `supabase_storage_admin`, `relrowsecurity=t`, `relforcerowsecurity=f` | ✅ **and it is the right correction** — the GUC is what the two callers *share*, so it cannot be what distinguishes them; RLS is the only thing that differs. The old note had the one datum that mattered and attached it to the wrong variable |
| *"`storage.objects` grants `arwdDxtm` to `authenticated` AND `anon` — no grant-level fallback"* | ACL re-read: `authenticated=arwdDxtm/…`, `anon=arwdDxtm/…` | ✅ |
| **Domain statements** | *"LOCAL stack, both paths; NOT verified against Cloud"* present in `143`, R15, `PROGRESS.md`, and the plan (which adds *"Re-probe before the Cloud run"*). I found **no** residual sentence claiming a Cloud property | ✅ |
| Assertion/plan stability | `143`, `200`, `235` diffs add comment lines and change label strings only — **no `select ok/is` added or removed**, no predicate touched. I re-evaluated the affected predicates directly against the live catalog at r2 and they hold | ✅ |

**Item 5 — the S5.R consequence the lead asked me to check is CORRECT, and I can name why.** Two
facts make it airtight rather than plausible, and neither is in the plan: `scripts/storage-manifest.mjs:131`
authenticates with **`SUPABASE_SERVICE_ROLE_KEY`**, and `service_role` carries **`rolbypassrls =
true`**. So for the rehearsal tool the trigger is bypassed (API sets the GUC) *and* RLS is bypassed
(role attribute) — **nothing platform-level stands under `delete --execute`**, exactly as the plan
now says. The manifest comparison and the tool's own refusals really are the only controls. → INFO-11.

---

## 2 · MINOR-10 (new) — *"its own HINT"* names the wrong field, in four places

The corrected texts cite the guard's own error text as documentary corroboration:

> *"⭐ Its own **HINT** says \"Use the Storage API instead\""* — `143_capa.sql:300`,
> `e2e/phase14c-rca.spec.ts` (line-wrapped), `PROGRESS.md:175`, plan `:208`.

The body, read verbatim from `pg_proc`:

```sql
RAISE EXCEPTION 'Direct deletion from storage tables is not allowed. Use the Storage API instead.'
    USING HINT = 'This prevents accidental data loss from orphaned objects.',
          ERRCODE = '42501';
```

*"Use the Storage API instead"* is the **exception MESSAGE**. The **HINT** is a different sentence
that says nothing about the API. The commit body gets it right (*"the mechanism's error message"*);
the four in-tree copies do not.

**Substance is undamaged** — the phrase exists, it is the guard's own text, and it does point at the
API — and the *proof* in all four places is the measurement, not the quote. But this is a
quoted-source error inside the correction whose entire purpose was precision, in the one clause
offered as independent corroboration. `supabase/migrations/20260910000400:28` already quotes the
same string correctly as the *error*, so the right form exists in-tree.
→ [[a-comment-is-an-assertion-that-goes-stale-silently]], and the field-vs-value grain of
[[a-predicate-quoted-at-the-wrong-grain]]. **Fix: say "its own error message", or quote the HINT
accurately.**

---

## 3 · MINOR-11 (new) — the byte-drift datum is a measurement artifact, not drift

Three documents now carry, as *evidence*:

> *"**245 files / 4,394,074 B** after the gate, and 245 / **4,402,266 B** half an hour later **with
> nothing deliberately writing**"* — `dm5-wave-d-retirement.md:81`, `follow-ups.md:396`
> (+ the ADR's *"it read 245 files after the same session's gate"*, which is fine).

**Re-measured now, with r2's exact method** (`du -sb` inside `/v/stub/stub`, throwaway container):

```
files=245   du_sb_total=4394074
  documents-phi 68 / 877,782   documents-standard 156 / 3,331,728
  form-assets   12 /  58,184   meeting-audio        9 /   122,284
```

**Byte-identical to r2, per bucket, hours later.** The volume has not moved. The 8,192 B delta is
exactly two 4 KiB directory inodes — the signature of a `du` taken one or two levels wider (e.g. at
`/v` rather than `/v/stub/stub`), not of bytes appearing. And the ambiguity is larger than the delta:
`du -sb` reports **4,394,074** (allocated) while summing `stat -c %s` reports **2,456,666**
(apparent) — the same volume, **1.94 MB apart**, by method alone.

Nothing downstream breaks: the **166 → 245 across the gate is genuine drift** (I measured both ends
myself), so *"a survivor count is obsolete before it is committed"* and *"the PO ratified a class,
not a number"* both stand on evidence I produced. But the record currently presents a
measurement-scope difference as an observed phenomenon and reasons from it — **the exact shape this
phase keeps paying for, one layer down.** *A byte figure without its method is not a figure.*

**Fix:** drop the *"and it moved again 30 min later"* clause (or attribute it to method), keep
166 → 245, and state the method beside any byte count.

---

## 4 · MINOR-12 (new) — the sweep boundary moved again; the same file still contradicts itself

`200_controlled_documents.sql`'s §7 heading and label are correctly relabelled, and the new header
records **why** the sweep missed them. I verified that diagnosis and it is right, with one
refinement worth having:

- `:393` (header) is a **comment** that names the property **without the noun** → escapes a
  name-bounded sweep, caught by a comment-bounded one.
- `:416` (label) is an assertion **string** that **does** carry the noun → escapes a
  comment-bounded sweep, caught by a name-bounded one.

So neither line escaped both bounds *individually*; the **conjunction** (comment AND name) is what
let the pair through — which is what the header means and what its closing sentence gets exactly
right (*"it lives in comments, section headers AND assertion labels"*). ⭐ The operational
consequence, which is not written down: **an OR-bounded sweep would have caught both lines.** A
sweep bounded by two properties is narrower than either, and this is the second time in this slice
that a *conjunction* was mistaken for coverage.

**Then I ran the dimension the lead asked about** — property-words with no bucket noun
(`immutab|rule 6|no update/delete|rejects DELETE|UPDATE` across `supabase/tests/` and `e2e/`,
hand-classified, ~60 hits). Almost all are Rule-5 response/version immutability and out of scope.
**One survives, and it is in the file just edited:**

```
supabase/tests/200_controlled_documents.sql:16
--   * immutable storage bucket (no update/delete policy);
```

The file's own `Asserts:` index, 377 lines above a §7 that now reads *"⛔ RETIRED … the two pins
below now assert its RETIREMENT, not its immutability."* **The file contradicts itself in its own
table of contents**, and the fix once again stopped at the lines a reviewer cited. Non-blocking (the
assertion is correctly labelled and `325` t6/t7/t8 carries the real pin), but it is the **third**
iteration of one boundary. Cleared, for the record: `140_patient_safety.sql:181` names an
UPDATE/DELETE policy on **`public.patient_safety_event`**, a table, not a bucket — out of scope.

---

## 5 · MINOR-13 (new) — MINOR-4 is reported closed and is 5 of 6

`seed.sql:2216` ✅ and `235_authz_a4…:150` ✅ are both properly corrected (the `235` note is
particularly good — it says the fixture now inserts into a bucket that does not exist and that the
A4 assertion does not depend on it). With r2's four, that is five of the six locations r1 named.

**Still open — r1 MINOR-4, item 4:** `docs/progress/follow-ups.md:753-754` states

> *"**printed-documents** … — `src/app/api/documents/[id]/route.ts:46` `.download(row.storage_path)`,
> downloading from the **`printed-documents`** bucket."*

The route reads `row.storage_bucket` **from the door** (`route.ts:43-52`, with a comment explaining
that a bucket literal *"would have been a third derivation of a coordinate that has exactly one
authority"*) and names no bucket. r1 flagged this line and called it a candidate to close; it is
untouched, and it is now an assertion about live code that is false.

**This is the second consecutive round in which MINOR-4 has been reported closed while a location
r1 named was still open.** The item is small; the pattern is the finding. *A closure claim is a
claim, and it needs the same re-derivation from the list as the fix did.*

---

## 6 · MINOR-14 (new) — the restored `143` label names a lock the assertion does not test

The restored label is right on substance and better than the original. One clause outruns the
predicate:

> *"…NO update/delete policy — THIS IS the operative Rule 6 lock on the Storage-API path, **together
> with the equally absent SELECT policy** …"*

The predicate counts only `cmd in ('UPDATE','DELETE')` and the two INSERT controls. **If someone
added a SELECT policy on `documents-standard` tomorrow, this assertion stays green while half the
lock it names is open** — which is precisely the half my Probe C showed is load-bearing (delete
policy alone → `DELETE 0`; select **and** delete → `DELETE 1`).

The property *is* pinned — in `312_printed_documents.sql:565-574` **t51d** (*"ZERO SELECT policies
on storage.objects name either document bucket"*), with **t53pre** as its positive control. So this
is a citation gap, not a coverage gap. **Fix: point the label at `312` t51d** (as it already points
at the header), or add the SELECT conjunct here. Same discipline as r1 INFO-1: name where each lock
is pinned, and do not let one label imply two.

---

## 7 · INFO

- **INFO-9 — *"for ANY caller"* is measured for two of three roles.** The GUC-bypass claim is
  measured for `service_role` (Probe A) and `authenticated` (Probe B step 2). For `anon` it is
  **inferred** from the role-agnostic body. The inference is sound and I would not spend a probe on
  it; it should not be written as if measured.
- **INFO-10 — the corrected R15 note now carries the right warning, and it is worth keeping
  verbatim:** *"If anyone ever adds a read policy to `documents-standard` … they must add no DELETE
  policy with it, and this test is what notices."* That sentence is the inverse of the defect B3
  was, and it is the most useful line in the fix.
- **INFO-11 — the S5.R inference deserves its two mechanisms in-line** (§1): `storage-manifest.mjs:131`
  uses `SUPABASE_SERVICE_ROLE_KEY`, and `service_role` has `rolbypassrls = true`. Without them the
  plan's *"nothing platform-level will stop them"* reads as an assumption a future reader may
  re-litigate; with them it is a two-line catalog check.

---

## 8 · NOT TESTED / NOT COVERED

*Binding heading. An APPROVED slice is not an absence of gaps.*

- ⛔ **This round verified `977f1d71` and nothing else**, as directed. r1's neutralization battery
  (N1–N7), the migration and its guard, the successor assertions, and the four ARMs were **not**
  re-run — they were measured at r1 (SQL) and r2 (ARMs at HEAD), and this commit touches only
  comments, label strings and docs.
- ⛔ **I did not re-run `e2e:prod`, `npm run test:db`, or any ARM** (instructed not to). pgTAP's
  193 / 6351 is **the lead's measurement**, taken after a fresh reset following these edits. I
  verified it *could not* have changed — no assertion added, removed or re-predicated in any of the
  three `.sql` files — but I did not observe it. **R15 has not been re-executed since `977f1d71`**;
  the change to it is comment-only, so the 1121 figure carries, and I say that as an argument, not
  a measurement.
- ⛔ **Nothing about Cloud was verified.** Every probe behind B3 and every claim I approved is
  **local-stack only**. The texts now say so; the plan's *"re-probe before the Cloud run"* is the
  binding instruction, and it is unexecuted.
- ⚠ **`anon` was never probed** (INFO-9).
- ⚠ **My byte re-measurement used one method** (`du -sb`, allocated) plus one cross-check
  (`stat -c %s`, apparent). I did not determine which method produced `4,402,266`; I show it is
  reachable by widening the `du` scope by two directories and that the two standard methods differ
  by 1.94 MB on this volume. **The artifact explanation is strongly supported, not proven** — the
  proven part is that the volume is byte-identical to r2 under a fixed method.
- ⚠ **The MINOR-12 sweep is bounded too.** I swept property-words in `supabase/tests/` and `e2e/`.
  I did **not** sweep `src/`, `scripts/` or `docs/` for noun-less property text, nor property words
  outside my regex (e.g. *"append-only"*, *"never overwritten"*, *"write-once"*). **The class is
  open by construction; treat it as a standing sweep, not a closed one.**
- **Nothing remote was touched, verified, or inferred about.** No `db push`, no remote read.
- **S5/S6 scope, the `documents_wave_d` flag surface, and FUP-DM5-STACK-CYCLE-DESTROYS-BYTES are
  outside this round.** S5.R remains **UNREHEARSED**; naming an owner is not a rehearsal, and the
  record says so in three places.

---

## 9 · Itemized change list

**Blocking: none.** B3 discharged. The slice is clear for §6 step 4.

| # | severity | item |
| --- | --- | --- |
| MINOR-10 | MINOR | *"its own HINT"* — the quoted phrase is the exception **MESSAGE**; the HINT is other text. Four locations: `143_capa.sql:300`, `e2e/phase14c-rca.spec.ts` (⭐ block), `PROGRESS.md:175`, plan `:208`. Say "error message". |
| MINOR-11 | MINOR | The *"4,402,266 B with nothing writing"* datum is a measurement-scope artifact (re-measured: **4,394,074 B, 245 files, per-bucket identical**; delta = two 4 KiB dir inodes; `du -sb` vs `stat` differ by 1.94 MB). Drop or attribute the clause; keep 166 → 245; state the method beside any byte count. `dm5-wave-d-retirement.md:81`, `follow-ups.md:396`. |
| MINOR-12 | MINOR | `200_controlled_documents.sql:16` — the file's `Asserts:` index still claims *"immutable storage bucket (no update/delete policy)"*, contradicting the §7 relabel below it. Third iteration of the MINOR-8 boundary. (Also: record that an **OR**-bounded sweep catches both shapes; a conjunction is narrower than either bound.) |
| MINOR-13 | MINOR | MINOR-4 is **5 of 6, not closed** — `docs/progress/follow-ups.md:753-754` still says `route.ts:46` downloads from `printed-documents`; it reads `row.storage_bucket` from the door. Second consecutive round this item was reported closed while open. |
| MINOR-14 | MINOR | `143_capa.sql:333`'s restored label names the absent **SELECT** policy as half the lock, but the predicate tests only UPDATE/DELETE. The SELECT half is pinned in `312` **t51d** (control: t53pre) — cite it, or add the conjunct. |
| INFO-9..11 | INFO | See §7. |

**Recommended for the record, not required:** carry MINOR-12's *"a conjunction of bounds is narrower
than either bound"* and MINOR-13's *"a closure claim needs the same re-derivation as the fix"* into
the durable lessons — both have now fired twice inside one slice.

---

## 10 · What is unambiguously right

- **The mechanism is correct on the third telling, and it is correct for the right reasons** — the
  fix does not merely reverse the earlier sentence, it identifies *why* the earlier experiment
  could not see the answer (one of two locks, at the one layer where the trigger is unconditional)
  and it corrects the `service_role` cause the lead found on his own. **Item 3 was not on my list
  and it is the load-bearing half**: had the "API sets the GUC *for the service role specifically*"
  story survived, the inversion could grow back from it.
- **Verifying my load-bearing facts from the catalog before writing** — role-agnostic body, 4
  INSERT/SELECT-only policies, the `arwdDxtm` grant to `anon` — is the right response to a
  reviewer's finding, and it is why r3 was cheap.
- **The S5.R consequence was drawn, flagged as an inference, and handed to me to check.** It is
  correct, and drawing it was the difference between a corrected comment and a corrected plan.
- **`200`'s new header records the sweep's failure shape rather than just fixing the line** — that
  is the durable half, and my refinement (§4) sharpens it rather than contradicting it.
- **The handoff's `25P01` causal story is now corrected in the file a new session reads first**, and
  it correctly states the fix as a property of `set local` in a migration rather than of a runner.
- **Both new MINORs are evidence defects, not mechanism defects.** After three rounds on one
  mechanism, the remaining errors are in the corroboration rather than the claim — which is the
  right direction of travel, and the reason this is an APPROVED and not a fourth loop.
