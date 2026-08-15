# DM5 · S3 — printed renditions onto the core document substrate — QA review

- **Verdict: ⛔ CHANGES REQUESTED** — **0 P0 · 2 MAJOR (both blocking, both cheap) · 6 MINOR · 2 INFO**
- **Reviewer:** `qa` · **Date:** 2026-08-14 · **HEAD reviewed:** `f2af151e` (tree clean)
- **Scope:** slice-level, S3 only. Migrations `20260927000300`–`000350`, commits `6ffd92ff`
  `859faa18` `d964b61a` `e08cf4eb` `02b2218d` `f8bdc4bc`, pgTAP `342` (49), the S3 halves of
  `312`/`313`/`323`, the S3 TS diff, `e2e/pdf-printing-meetings.spec.ts`.
  **Phase-level QA for DM5 is still owed at S6 and this review does not discharge it.**
- **Method:** the live catalog only (`pg_proc` incl. `prosecdef`, `pg_policies`, `pg_constraint`,
  `pg_trigger`, `pg_attribute.attacl`, `aclexplode`). Migration text was read for *intent* and for
  the guard enumeration; **no conclusion below rests on it**. Every behavioural claim was probed in
  a single rolled-back transaction with a positive control asserted **first**.

> ### ⭐ The headline, stated plainly
> **The build is sound.** The D12 conjunction is a genuine strict narrowing, proved in both
> directions; BUG-DM5-S3-INACTIVE-PRINT-1 is genuinely closed, proved end-to-end through the real
> corridor with a discriminating control; no authority was lost or gained in either kernel rebuild;
> the tier cannot be forged; the write path has no direct-DML seam; all five write guards
> differential-hold. `342` is the strongest suite I have reviewed in this program.
>
> **What I am blocking on is two things, neither of which is a behaviour defect:** one of `342`'s 49
> assertions **provably cannot fail** if the guard it names is deleted, and one **recorded security
> property is false** — the coordinate-withholding property that `312` t51 claims was made
> *"stronger"* was in fact relocated behind a chain the client can traverse.
>
> **S4 is not blocked on behaviour by anything in this report.** Nothing I found becomes worse by
> proceeding, and the S3 substrate is safe to build S4's retirement on. Both MAJORs are
> assurance/record fixes measured in lines.

---

## 1. What I probed, and the safety record of doing it

Six mutation-bearing runs, each **one transaction, each rolled back**. After **every** run:

| check | result, every run |
| --- | --- |
| degenerate-body sweep (`prosrc ~* 'begin\s+return\s+(true\|false)\s*;\s*end'` over `app`+`public`) | **0** |
| `md5(pg_get_functiondef('public.begin_document_upload(…)'))` before / after the one neutralization | `aedac0b0…` / `aedac0b0…` — **identical** |
| guard-4 text restored | `guard4_restored = t` |
| fixture residue | `printed_documents` **0** · `documents` **3** (baseline) · `storage.objects` **0** · `securable_resources where resource_type='form_response'` **0** |
| `profiles where is_active = false` | **1**, and it is the seed's `desativado.conta@test.local` (`…-0000d4`) — **not** residue from my `is_active` flips |

Probe scripts are in the session scratchpad (`probe_d12.sql`, `probe_d12b.sql`, `probe_d12c.sql`,
`probe_mint.sql`, `probe_final.sql`, `probe_draft2.sql`, `probe_orphan.sql`) and are not committed.

⭐ **Two of my own probes were fixture-defective and the phase's own recorded lessons caught them
— recorded because they calibrate how much my *other* results are worth.**

1. **`R12`/`R13`/`R16` refused for the wrong reason.** My JWT claims carried `sub` + `role` but no
   `active_role`. `app.has_role` ends with
   `and (p_user_id is distinct from auth.uid() or p_role is not distinct from app.active_role())`
   (ADR 0106/0107), so every `is_staff_admin_of_for` arm returned **false** and the guard-2/3/4/5
   blocks never reached their guards. Meanwhile my *direct* call `app.can_write_document(doc, uid)`
   as `postgres` returned **true** — because `auth.uid()` was NULL there, which short-circuits the
   hat requirement. **The same predicate, two answers, and only the corridor form is the product's.**
   Re-run with `"active_role":"staff_admin"` (probe `H0` asserts the hat first) all five guards
   discriminate. **Any print-path result measured without a hat claim is void.**
2. **`request_document_disposition((select document_id from public.printed_documents limit 1), …)`
   refused 42501 — because the subquery was RLS-filtered.** As `authenticated`,
   `printed_documents_select` is `can_view_printed_document(...)`, which was the very thing I had
   just falsified, so the id arrived **NULL** and `can_write_document(NULL, …)` fail-closed *before*
   the guard could speak. This is `341`'s F-block defect #2 verbatim, one slice later. Fixed by
   resolving the id as the owner into a granted temp table.

---

## 2. Requirements audit — S3's six deliverables against the catalog

| # | deliverable | verdict | the probe that establishes it |
| --- | --- | --- | --- |
| 1 | `form_response` in **both** `securable_resources` CHECKs, coupling intact | ✅ **CONFIRMED** | `pg_constraint`: `securable_resources_type_check` admits 9 types incl. `form_response`; `securable_resources_tenant_shape` carries **TWO** shapes and `form_response` joins shape A (org+hospital+commission all NOT NULL). `342 S3a4` neutralizes `type_check` and shows `tenant_shape` **independently** refuses `not_a_real_type` (23514), with `S3a5` as the restore control. This is a coupling proof, not a text claim. |
| 2 | `printed_documents` is the satellite; `storage_path` + `pd_storage_path_derived` retired | ✅ **CONFIRMED** | `document_id`/`document_version_id`: `attnotnull = t`, `printed_documents_document_uniq`, `printed_documents_document_version_uniq`, composite FK `printed_documents_version_document_fk → document_versions(id, document_id) ON DELETE RESTRICT`. `storage_path` absent from `pg_attribute` (`312 t51`); no `pd_storage_path_derived` in `pg_constraint`. Replacement strength probed four ways — see §4.5. |
| 3 | a print arm in **both** kernel doors, **below** `app.is_active` | ✅ **CONFIRMED** | `pg_get_functiondef` on both: `if not app.is_active(p_uid) then return false; end if;` precedes the `printed_documents` lookup in each. Behaviourally: deactivate the owner ⇒ `can_read_document = f` **and** `can_write_document = f` while `can_view_printed_document` stays **t**. Both doors `prosecdef = t`, `STABLE`, `search_path` pinned. |
| 4 | `app.resolve_document_version_bytes`, both open doors on it (D12) | ✅ **CONFIRMED** | `app`-scoped, `prosecdef = t`, EXECUTE **postgres only** (`anon`/`authenticated`/PUBLIC all false, `proacl is null` false). Both `public.open_document_version` and `public.open_printed_document` call it; the only per-door difference is the `p_rendition_kind` literal. |
| 5 | `mint_printed_document` rebuilt onto the substrate, atomically | ✅ **CONFIRMED** | Real mint through the door as `chefe.ccih`: 1 registry row (`active`), 1 `documents` row (`kind='printed_rendition'`, homed on the *response's* securable), 1 version, file at `documents-standard printed/<pd>.pdf standard unscanned_accepted` with server-derived mime, rendition `printed_pdf`, **1** `document.minted` audit row carrying `document_id` + `document_version_id`. |
| 6 | the write guards | ✅ **CONFIRMED behaviourally, ⚠ one keystone vacuous** | **There are FIVE, not four** (the task brief said four). All five differential-hold — §4.4. Guard 4's *keystone* is the blocking MAJOR-1. |

**D18 (presentation) — ✅ correctly framed everywhere I looked.** `documents.ts`'s
`EXCLUDE_PRINTED_RENDITIONS` doc-comment, both call sites, ADR 0120 D18's own boxed warning, the
E2E test's docblock, and `342 S3e`'s block header **all** say explicitly that D18 is presentation and
**must never** be recorded as narrowing access. I found **zero** comments, test names, or doc lines
that imply otherwise. The discriminator is relational (`printed_documents.document_id`, NOT NULL +
UNIQUE), not `documents.kind` — correct, and the fail-open/fail-closed reasoning for rejecting the
string forms is right.

---

## 3. Findings

### 🟠 MAJOR-1 (BLOCKING) — `342` `DM5·S3f4` is a **vacuous keystone**: it cannot go red if the guard it names is deleted

`S3f4` asserts `throws_ok(begin_document_upload('form_response', …), 'P0002')` for GUARD 4.

**Proved by neutralization** (one rolled-back txn; `md5(pg_get_functiondef)` identical before and
after; `guard4_restored = t`; degenerate bodies **0**):

```
QA PROBE: guard 4 neutralized          -- the `if p_resource_type = 'form_response' then raise P0002` block removed
guard4_still_present | f
ERROR:  recurso não encontrado
CONTEXT:  PL/pgSQL function begin_document_upload(…) line 95 at RAISE   -- ← NOT line 38 (guard 4)
```

With guard 4 gone the call proceeds, creates the `documents` row, and is refused by
`can_write_document`'s fail-closed `else` — which raises **the same `P0002` with the same message**.
So `S3f4` is satisfied by a sibling lock and is **structurally incapable of failing** on the
property it is labelled with.

**This is the phase's own binding rule, restated in the phase record and then not applied here:**

> *"When a door answers one code for several causes, a test asserting that code proves nothing about
> which cause fired; the discriminating fact must be established separately, before the assertion
> runs."* — `docs/progress/dm5-wave-d-retirement.md`, on `341`'s F7

⚠ **Why this is blocking rather than cosmetic.** `342`'s own header declares itself *"THE WHOLE
ASSURANCE, and not a supplement to the four authz arms"*, because ADR 0120's Consequences state
every door DM5 touches sits in a census blind class. When the suite **is** the boundary, an assertion
that cannot fail is a hole in the boundary. This is also the third instance in DM5 of *one code,
several causes* (`341` F7, `312` t53's near-miss, this).

**Behaviour is correct** — both locks refuse — so this is an assurance defect, not a vulnerability.

**Discharge (any one, all ~1 line):** assert the discriminating fact — e.g. pin `sqlerrm` /
`message_text` to guard 4's own string rather than the shared SQLSTATE; **or** add a twin that
neutralizes the sibling (`can_write_document`'s `else`) and shows `S3f4` still reds; **or** move
guard 4's raise to its own SQLSTATE. Whichever is chosen, **re-run the neutralization and record the
red** — the discharge claim must be a measurement, not an edit.

---

### 🟠 MAJOR-2 (BLOCKING) — the coordinate-withholding property was **not** preserved, and `312` t51's rationale records the opposite

`312`'s re-point comment says:

> *"t51 — the D7 retirement itself … The old claim is now true **STRUCTURALLY** rather than by
> privilege, which is **stronger**: a column that does not exist cannot be under-withheld."*
> …and t51's own label: *"the coordinate lives on `file_objects`, so **it cannot be leaked from here
> at all**."*

**True of the column. False of the property.** Pre-S3, `printed_documents.storage_path` was withheld
from `authenticated` by the column-list GRANT. Post-S3 the coordinate is reachable by the same
client through a chain of tables it has SELECT policies on. **Probed as the print's legitimate
viewer (`authenticated`, hat present):**

```
print_id                             | document_version_id                  | storage_bucket     | storage_path
aaaa1111-1111-4111-8111-111111111111 | bd420038-40fa-4013-bfc6-5f1db1bdacce | documents-standard | printed/aaaa1111-1111-4111-8111-111111111111.pdf
new_cols_readable       | 1     -- printed_documents.document_id / document_version_id: granted to `authenticated`
storage_objects_visible | 0     -- the object itself stays invisible
```

Path: `printed_documents.document_version_id` → `document_version_files` (policy
`can_read_document_version`) → `file_objects` (policy `can_read_file_object`, which is chain-only
through `can_read_document`). Column ACLs confirm `document_id` and `document_version_id` both carry
`SELECT → authenticated`, beside the correctly-withheld `verification_token` / `revoked_reason` /
`revoked_by`.

**Calibration, stated so this is not over-read: this is NOT a live exposure.** `documents-standard`
and `documents-phi` carry **INSERT-only** storage policies (`app.storage_upload_reserved`-gated) and
**no SELECT policy at all** — I re-verified all 8 `storage.objects` policies. Knowing the key buys
nothing; the only byte path remains the audited door. The mechanism is also pre-existing for ordinary
documents since DM1. **What is new in S3 is that prints joined it**, having previously been the one
class whose coordinate was explicitly withheld — and that a stated security property is now recorded
backwards, *and recorded as an improvement*.

**Discharge:**
1. **Correct the record** — `312`'s t51 comment and, if it repeats the claim, ADR 0120 D7. The honest
   sentence is: *the column is gone; the coordinate is now reachable through the readable
   `file_objects` chain exactly as it is for every other document, and the withholding is provided
   by the buckets having no SELECT policy, not by a grant list.*
2. **Restore the property cheaply, and this is the better half:** **no TS consumer reads either new
   column.** `listPrintedDocuments` (`src/lib/queries/printed-documents.ts:105`) selects neither; the
   E2E spec reads `document_version_id` via **service role** (`serviceQuery`). So
   `REVOKE SELECT (document_id, document_version_id) ON public.printed_documents FROM authenticated`
   costs nothing and puts prints back behind the column-list grant that `312` t51b still exercises.
   Verify by re-running `312` and `pdf-printing-meetings`.

---

### 🟡 MINOR-1 — `342` `DM5·S3d2`'s positional assertion passes when `is_active` is **absent**

`S3d2` is `position('is_active' in body) < position('printed_documents' in body)`, labelled *"the
print arm sits BELOW `app.is_active` — hoisting it above would silently drop the account check."*

**Probed:** `position()` returns **0** for an absent needle, and `0 < N` is **true**.

```
-- against a body with NO is_active at all:
pos_absent | pos_print | S3d2_would_still_be_GREEN
         0 |        21 | t
-- against the live body (positive control):
p_active | p_print | s3d2_live
     226 |     703 | t
```

So it detects a **hoist** (which is what its label claims) but is blind to **deletion** of the guard.
Not a hole — `S3c4`/`S3c5` are behavioural and would red — but the label overstates the assertion,
and the same `position()`-returns-0 shape is worth knowing repo-wide. **Fix:** conjoin
`position('is_active' in body) > 0`.

### 🟡 MINOR-2 — the print arm in `can_write_document` has **no keystone at all**, in either form

The catalog confirms the arm sits below `is_active`, and I confirmed behaviourally that a deactivated
`staff_admin` gets `can_write_document = false` on a print's document. `342` asserts **neither** —
`can_write_document` appears nowhere in the file except in a section header. The task brief asked
about *both* kernel doors; only one is pinned. Related and already filed: **FUP-DM5-330-WRITE-BLIND**
(re-scoped, explicitly says *"do not close on `342`'s coverage"*) and **FUP-DM5-SIBLING-GUARD-DIFF**.
**Fix:** add the `S3d2`/`S3c4` pair for `can_write_document` (two assertions).

### 🟡 MINOR-3 — guard 5's assertion has no in-suite ordinary-document twin

`S3f5` asserts only `can_delete = false` for the print. A blanket regression in `can_write_document`
would keep it green. My differential supplies the missing half:

```
document_id                          | can_delete
22222222-…-222222222222 (print)      | f
12121212-…-121212121212 (ordinary)   | t
```

Every other guard in `S3f` carries its twin (`S3f1t`, `S3f3t`, and `S3f4`'s corridor twin via `cd`);
this one is the exception. **Fix:** one `is(…, true)` on the existing `cd` fixture's document.

### 🟡 MINOR-4 — D11's *"retires superseded bytes through `file_objects.disposal_state`"* is not performed, and **cannot be**

**Probed** after a second mint of the same source:

```
status     | disposal_state | upload_state       | doc_status
active     | none           | unscanned_accepted | active
superseded | none           | unscanned_accepted | active
```

The mint supersedes the registry row and **does not touch the old bytes** — correctly, because ADR
0104's overlay requires a superseded print to keep serving with the `SUBSTITUÍDO` stamp, which I
confirmed it does (`open_printed_document` on the superseded row returns its bucket/path with
`status = 'superseded'`). Retirement is therefore an **operator-initiated** path — guard 3's narrow
half, which I proved reachable — and **nothing schedules it**. ADR 0120 D11 and the phase record read
as if the mint performs it, which will send the next reader hunting for absent code and matters
directly to S4/S5 and ADR 0114 **O1**. **Fix:** record it as *enabled, not performed*, and name the
owner of the schedule.

### 🟡 MINOR-5 — a print on a **draft** response that is then deleted leaves a dangling registry row and a print no product surface can reach

`can_view_printed_document`'s `form_response` arm is `v_resp.created_by = p_uid` with **no status
gate** (unchanged by S3 — the predicate is not in any S3 migration), so a user may mint a print of
their own `in_progress` response. `responses_delete_own_draft` then lets them delete it.
`securable_resources` has **no FK to `responses`** (only org/hospital/commission FKs — the shared PK
is a convention). **Probed end to end:**

```
resp | dangling_registry | readers_left | kernel_write | visible_in_ui_projection
   0 |                 1 |            0 | t            | 0
-- recovery, at the door, with the id in hand:
revoke_printed_document → dispose:  status=revoked | disposal_state=disposal_pending | doc_status=disposal_pending
```

Fail-closed on reads (**0** readers left) and **recoverable** — `revoke_printed_document` gates on
`is_staff_admin_of_for(commission_id) or is_tenancy_admin_of_for(commission_id)`, *not* on source
visibility, so it survives the source's deletion. But `listPrintedDocuments` is RLS-filtered by
`can_view_printed_document`, so the orphan is **invisible to every UI surface** and no product
affordance can revoke or dispose it. **New in S3 is the dangling `securable_resources` row**
(pre-S3, printing a form response created none); the invisibility is inherited from ADR 0104.
**Fix:** file a follow-up before S4's disposal machinery is relied on, and consider gating the
`form_response` mint on `status = 'submitted'` (a product question, not mine to rule).

### 🟡 MINOR-6 — the mint's `HC0D4` handler misses the unique that actually fires first

The handler wraps only the `printed_documents` insert, and its comment says *"this handler's
structural domain widened with the two new unique constraints, but neither is reachable."* **Probed:**
a re-mint on an existing print id is refused **earlier**, by `file_objects_bucket_path_uniq`, as a
raw `23505` outside the handler:

```
ERROR: duplicate key value violates unique constraint "file_objects_bucket_path_uniq"
  Key (storage_bucket, storage_path)=(documents-standard, printed/aaaa1111-….pdf) already exists.
CONTEXT: … mint_printed_document(…) line 182
```

⭐ **That constraint is also the reason cross-tenant byte binding is impossible** — the coordinate is
bijective with the registry PK, so a caller cannot bind another tenant's object into their own print.
Worth recording as the load-bearing lock it is. Unreachable in the normal flow (fresh uuid per mint,
`upsert: false`), and the action maps unknown errors to a generic pt-BR string, so severity is low.
**Fix:** correct the comment to name the constraint that fires first, or widen the handler.

### 🔵 INFO-1 — `PROGRESS.md:48` still reads `S3 ⬜ NEXT`

The live section records steps 1–2 green. The table line does defer to the live section as the
authority, so this is the resume audit's own item 2 in miniature — not a defect, but it is the file
every spawn reads. Lead-owned.

### 🔵 INFO-2 — `documents.kind = 'printed_rendition'` (English) beside `documento_controlado` (pt-BR)

Already ruled decorative and recorded as a cosmetic divergence; I verified nothing branches on
`kind` (the D18 discriminator is relational). **Not re-reported as a finding** — noted only to
confirm the ruling still holds against the live code.

---

## 4. What I checked and found clean — and why the silence is meaningful

### 4.1 D12's conjunction, **both** directions, with a positive control first

| probe | result |
| --- | --- |
| **P1 / R3 POSITIVE CONTROL** — active owner, real corridor | `print_check t · kernel_read t · kernel_write t · is_active t`; `open_printed_document` returns `documents-standard \| printed/<pd>.pdf \| active \| f` |
| **P5** — flip `is_active = false` | `print_check` **STILL t** · `kernel_read` **f** · `kernel_write` **f** |
| **R7** — deactivated owner through `open_printed_document` | `ERROR: sem permissão` raised at `resolve_document_version_bytes` line 10 |
| **P9 / H6 EXHAUSTIVE** — `can_read_document ⇒ can_view_printed_document` over **all 39 profiles**, form_response print and meeting print | violations **0**; and **non-vacuous**: `kernel_true = 1 / print_true = 1` (form_response) and `9 / 9` (meeting) |

**Direction 1 (print check passes, kernel fails) is reachable and refused — that IS the
BUG-DM5-S3-INACTIVE-PRINT-1 fix, and the control proves the deny is not vacuous.** Direction 2
(kernel passes, print check fails) is **structurally unreachable**: the kernel's print arm *is*
`can_view_printed_document`, verified from `pg_get_functiondef` and confirmed by the exhaustive
implication being empty *while both sides are non-empty*. `342 S3d1` pins the delegation from the
catalog, which is the right shape — no fixture was fabricated for an impossible state.

### 4.2 Authority lost or gained in the rebuild — ACLs in **both** directions

All 17 S3-touched functions, via `aclexplode` **and** `has_function_privilege`, with the
`proacl is null` arm (`aclexplode(NULL)` returns no rows and is blind to a default ACL):

- `proacl is null` = **false** for every one — so none inherited the default `EXECUTE TO PUBLIC`.
- **No PUBLIC (`grantee = 0`) grantee anywhere**; `anon` = false everywhere.
- `app.resolve_document_version_bytes`, both new guard functions, and both
  `app.printed_rendition_storage_*` helpers: **`postgres` only**.
- Every intended grantee still present: the six `public` doors and the three `app` kernel predicates
  all retain `authenticated` + `service_role`.
- **Population:** `0` first-party `public` `SECURITY DEFINER` functions are anon- or
  PUBLIC-executable (`342 S3h3`, independently reproduced).
- `public.lookup_printed_document` is `postgres` + `service_role` only — **deliberate**, pinned by
  `312 t56` (an authenticated PostgREST path would bypass the rate limiter). Not a regression.
- The `app`-schema default-ACL population (200+ functions, `app` USAGE granted to `authenticated`) is
  pre-existing and **already filed** as **FUP-ACL-APP-POPULATION** (`13db20f2`), whose text correctly
  records that this mechanism has now fired 3× including S3. **S3 added nothing to it** — verified
  per-function.

### 4.3 Rule 12 / PHI — the tier cannot be forged, and reads are audited

- `file_objects_bucket_from_tier` CHECK-pins bucket ↔ tier **bidirectionally**; `file_objects_bucket_check`
  admits only the two document buckets.
- Bucket **and** path are **server-derived** inside the mint from the single input `contains_phi`;
  the door takes no path parameter. **`HC0D3` fires iff the pre-uploaded object is not at exactly the
  derived coordinate** — probed: an object planted in the *other* bucket is refused.
- **Upward forge refused:** `contains_phi = true` on a `form_response` ⇒ `HC0D2` (probed). Only
  `meeting` accepts the PHI label (ADR 0104 A8), pinned by `313 t45`/`t49`.
- ⚠ **Residual, pre-existing and correctly out of S3's scope:** `contains_phi` is *presence-derived by
  the server action*, so a **downgrade** (real PHI labelled `false`) is not detectable at the door.
  The audit is unaffected — `open_printed_document` audits `document.downloaded` **unconditionally**,
  before returning, so a mislabelled PHI print is still fully audited. Rule 11 satisfied for both
  outcomes: `342 S3i2` = exactly **1** row on success, `S3c6` = **0** on refusal (I reproduced both).
- The two document buckets have **no SELECT policy** — only reserved-path INSERT (all 8
  `storage.objects` policies enumerated). ADR 0114 D8's *"the F-01 class dies structurally"* holds.

### 4.4 The five write guards — every one differential

| guard | print | ordinary twin |
| --- | --- | --- |
| **1** version trigger on `document_versions` | `HC0DK` — at the table **and** through the real door (`begin_document_upload` with the print's `p_document_id`, refused inside the door at line 104) | ordinary document **accepts** a new version |
| **2** `soft_delete_document` | `HC0DL` | ordinary document **soft-deletes** |
| **3** `request_document_disposition` | `HC0DN` while **active** | ordinary **disposes**; and a **superseded** print **disposes** — guard 3 is narrow, not blanket |
| **4** `begin_document_upload` | refused on a `form_response` home | the same call shape on a **meeting** home **starts an upload** |
| **5** `document_delete_affordances` | `can_delete = f` | ordinary `can_delete = t` |

Plus the **binding trigger** on `printed_documents`, which I refused four independent ways: wrong
path (`HC0DA`), wrong bucket for `contains_phi = true` (`HC0DA`), **no `printed_pdf` rendition at all**
(`HC0DA`), and a version belonging to a different document.

⚠ **One honest limit:** the **composite FK**'s own discrimination is **unprovable through an INSERT**,
because `trg_guard_printed_document_binding` is `BEFORE INSERT` and fires first — my cross-document
attempt was refused by the *trigger*, not the FK. So the FK is a backstop whose refusal no
behavioural test can attribute to it; `342` correctly pins it from the catalog rather than by insert.

### 4.5 D13's separation, and the `add_referral_shared_item` risk it exists to close

`add_referral_shared_item` excludes a print **twice, independently**: `s.resource_type = 'case'`
(prints are `form_response`/`meeting`-homed) **and** the version join
`vf.rendition_kind = 'source'` (a print version has only `printed_pdf`). `342 S3b2`/`S3b3` assert
each **alone** — which is the right shape, because asserting only "the door does not pick the print"
would be the sibling-lock trap. The second exclusion is the one that survives a future case-homed
print. Confirmed: after two mints, **2** print documents on **1** home, `1` version each, `0` prints
sharing a content document; `open_document_version` on a print version raises **`HC0D8`**, never bytes.

### 4.6 The write path has no direct-DML seam

RLS enabled on all five substrate tables, and `pg_policies` shows **SELECT-only** policies for
`authenticated` on every one — **no INSERT/UPDATE/DELETE policy exists**. So the seam that
FUP-DM5-GRANTS calls out for `rca_evidence`/`capa_action_evidence` does **not** exist here: the
DEFINER doors are genuinely the only writers. `312 t48`–`t50` pin the reader-non-writer probe.

**FUP-DM5-DVF-FILEOBJ stays latent, as ADR 0120 required S3 to ensure:** the mint creates a **fresh**
`file_object` (`v_file_id := gen_random_uuid()`) and never binds a pre-existing one, and
`file_objects_bucket_path_uniq` makes a second row at the same coordinate impossible. The third
writer D11/D12 added did **not** trip it.

### 4.7 No raw Postgres error reaches the UI, and no oracle was opened

`src/app/api/documents/[id]/route.ts:37` — `if (error || !row) return 404 'Documento não
encontrado'`. So the resolver's **new** `42501` raise is mapped to the same pt-BR 404 as the door's
two silent `return`s. The three refusal outcomes are externally indistinguishable; CLAUDE.md §8
("raw Supabase/Postgres errors never reach the UI") holds. `342 S3c5`'s comment records this shape
as *measured, and surprising* — which is the right way to have found it.

### 4.8 Residual references to the retired surface

Tight catalog sweep for the literal `'printed-documents'` and for `printed_documents…storage_path`
in comment-stripped `prosrc` over `app`+`public`: **0 hits**. **0** storage policies name the bucket.
The `printed-documents` **bucket row still exists** — correct, that is S4's manifest work, and
`325_legacy_bucket_policy_pin.sql` already pins the policy-less state.
`storage-manifest.mjs`'s retained `printed-documents → phi/` prefix rule is **deliberate** and
documented (pre-cutover bytes survive a reset that truncates `storage.objects`).

### 4.9 A measurement worth recording because it did **not** discriminate

Over the **seed** roster, `can_view_printed_document('meeting', …)` and the home arm
`is_member_of_for(commission)` **coincide exactly** — `0` pairs in *both* directions across every
meeting × every profile. So a seed-based keystone of the print arm's narrowing would have been
vacuous. **`342 S3j` does not use the seed** — it builds a `participants_only` meeting with an
attendee and a non-attendee member, asserts the flip took (`do $$ … raise $$`), and pins
`is_member_of_for = true` **and** `can_view_printed_document = false` as *controls* before asserting
the kernel refuses. `S3j5` adds the positive twin so a narrowing-that-denies-everyone fails. This is
the block the suite header calls the only one that reds if the print arm is deleted, and it earns
that claim.

---

## 5. NOT REVIEWED — stated specifically, because a clean verdict over an unstated gap is worth less

1. **I did not run `e2e:prod`, `next build`, the full pgTAP suite, or any authz ARM** — instructed not
   to; gate steps 1–2 accepted as reported (registry 405 confirmed independently).
2. **I did not execute `342`.** I read all 49 assertions and probed the same properties independently.
   *"49 pass"* is the lead's measurement. MAJOR-1 is about what two assertions **can** assert, not
   about whether they currently pass — and it was established by neutralization, not by reading.
3. **I did not run the diff-scoped door sweep**; BLIND 0 / ERROR 0 accepted.
4. **No UI was executed.** I reviewed no rendering, no a11y, no keyboard flow. S3 shipped no new UI
   (`d964b61a` touches no component), and the route's two user-facing strings are pt-BR.
5. **The Gotenberg render path, `applyStatusOverlay`, and `scripts/smoke/pdf-mint.smoke.ts`** — not
   reviewed beyond confirming the smoke script is labelled non-gate-resident.
6. **`scripts/storage-manifest.mjs`'s S3 delta** — S4's contract; I confirmed only that the retained
   PHI-prefix rule is deliberate.
7. **`312`/`313`/`323`'s full re-point** — I read the retirement, grant, and storage-isolation blocks
   and the `t65` replacement; I did **not** audit the other ~180 assertions.
8. **Whether any vitest unit test pins `storage-coordinates.ts`.** The ADR argues the runtime `HC0D3`
   equality is the real pin and I accept that reasoning, but I did not check for a unit twin.
9. **`case` / `interview` prints** — unmintable (`can_view_printed_document` has no arm), so D6 is
   satisfied at the type level only. Untested by design and by me.
10. **Remote/Cloud behaviour** — nothing is pushed; D17 forbids it. Zero coverage, by design.
11. **`can_view_printed_document` itself** — unchanged by S3 (not in any S3 migration), so I treated
    its `form_response` `created_by`-only arm as pre-existing (see MINOR-5) rather than auditing it.

---

## 6. Discharge checklist

| item | required | how to prove it |
| --- | --- | --- |
| **MAJOR-1** | make `S3f4` discriminate guard 4 from its sibling | re-run the guard-4 neutralization and **record the red**; degenerate-body sweep after |
| **MAJOR-2** | correct `312` t51's rationale **and** (preferred) `REVOKE SELECT (document_id, document_version_id) … FROM authenticated` | re-run `312` + `pdf-printing-meetings`; re-probe the chain as `authenticated` and show the walk now 42501s |
| MINOR-1 | `and position('is_active' in body) > 0` | — |
| MINOR-2 | the `S3c4`/`S3d2` pair for `can_write_document` | do **not** close FUP-DM5-330-WRITE-BLIND on it |
| MINOR-3 | ordinary-document twin for `S3f5` | — |
| MINOR-4 | record D11 retirement as *enabled, not performed*; name the schedule owner | ties to ADR 0114 **O1** / S5 |
| MINOR-5 | file the follow-up before S4 relies on the disposal machinery | — |
| MINOR-6 | name `file_objects_bucket_path_uniq` in the mint's handler comment | — |

**None of the eight blocks S4 on behaviour.** If the lead prefers to run S4 first and discharge the
two MAJORs in the same window, I have no behavioural objection — the substrate is sound; say so
explicitly in the record rather than letting the verdict be read as satisfied.

---
---

# r2 re-review — the discharge of r1

- **Verdict: ✅ APPROVED** — r1's two blocking MAJORs and its six MINORs/two INFOs are discharged.
  **New at r2: 0 P0 · 0 MAJOR · 1 MINOR · 3 INFO**, none blocking, all record-level.
- **Reviewer:** `qa` (r2; **a different reviewer from r1**) · **Date:** 2026-08-14 · **HEAD reviewed:**
  `d0e6af03`, tree clean. Fixes under audit: **`af9a894e`** (migration `20260927000360`, pgTAP `312`
  75→77, `342` 49→59).
- **Scope, narrow on purpose:** r2 decides **only whether the fixes discharge r1**. r1's §4 ("what I
  checked and found clean") **stands and was not redone**. Where I noticed something new while
  probing, it is filed below as **r2-**.
- **Method: measurement, not reading.** Every blocking item was settled by **neutralizing the guard
  and observing the red**, each in **one transaction that ROLLBACKed**. The live catalog (`pg_proc`
  incl. `prosecdef`, `pg_policies`, `pg_constraint`, `pg_attribute` ACLs via
  `has_column_privilege`) is the only authority used for present-tense claims; the one **historical**
  claim (the retired CHECK) is sourced from git, and that limit is stated where it is used.

> ### ⭐ The headline
> **Both MAJORs are genuinely discharged, and I proved each one rather than reading it.** The
> guard-4 keystone now discriminates — **with guard 4 deleted `S3k2` goes RED while `S3f4` stays
> GREEN**, exactly the pair r1 asked for, and no production SQLSTATE was changed. `S3d2` now fails
> when `is_active` is **absent** (old form: `t`, new form: `f`, measured side by side on the same
> mutated body). **All five of `backend`'s "proven RED first" claims reproduce exactly**, including
> the incidental co-reds it reported.
>
> ⚠ **The MAJOR-2 correction is the important part of this review, and it goes against r1.** r1's
> *premise* was **false** and `backend`'s corrected record is **true** — I verified it independently
> from the catalog, from git, and by applying the declined REVOKE and measuring that it closes
> **nothing**. A lead ruling was not accepted as evidence; it happens to be right.

## r2·1 — Safety record of my own probing

**Eight mutation-bearing runs** (five on `342`, three on `312`) plus three read-only probes. **Every
mutation lived inside a single transaction that ROLLBACKed** — the mutation prefix is applied, the
suite's own `rollback;` reverts it, and no mutation was ever committed. Every prefix **refuses to run
as a no-op** (`if nd = d then raise`), so a silently-unmatched pattern cannot be mistaken for a pass.

| check | result |
| --- | --- |
| degenerate-body sweep (`prosrc ~* 'begin\s+return\s+(true\|false)\s*;\s*end'`, `app`+`public`) | **0** — after every run and at close |
| `md5(pg_get_functiondef)` of all 5 mutated functions, before vs. after | **byte-identical**; `prosecdef = true` on all five. `public.begin_document_upload` = `aedac0b01f2ad0a594b75eede6671fb0`, **the same md5 r1 recorded** |
| column ACLs restored | `contains_phi`, `document_id` → `SELECT` for `authenticated` = **true** |
| `storage.objects` policies | **8**, unchanged; **0** policies named `qa_r2%` remain |
| fixture residue | `printed_documents` **0** · `storage.objects` **0** · `form_response` securables **0** · inactive profiles **1** (the seed's `desativado.conta`) |
| registry | **406 == 406** (files vs. `schema_migrations`), before and after |
| stack left as found | `pgtap` extension **dropped** (I installed it in `public` to run single files through `psql`; `supabase test db` does not leave it behind, and neither did I) |

⚠ **One environment note, stated because it is the only thing I changed outside a transaction:**
`supabase db reset --local` first (per the standing rule that a green `e2e:prod` leaves residue), then
`create extension pgtap` / `drop extension pgtap`. Nothing else was committed to the shared stack.

## r2·2 — Discharge table

| r1 item | verdict | the evidence I **observed** |
| --- | --- | --- |
| **MAJOR-1** `342 S3f4` is a vacuous keystone | ✅ **DISCHARGED** | **Guard 4 deleted from the live `public.begin_document_upload` body** (`guard4_still_present=false` printed before the suite ran): run shape **`1..59`, 58 ok, 1 not ok, 0 aborts** — and the single red is **`not ok 52 — DM5·S3k2`**, diagnosed `caught: no exception / wanted: P0002`. **`S3f4` (test 37) stayed GREEN**, reproducing r1's finding in the same run. So the pair discriminates: `S3f4` is the both-closed case, `S3k2` attributes the refusal to guard 4 alone. `S3k1` (sibling genuinely open) and `S3k3` (sibling closed again) were green in every run. **No production SQLSTATE changed** — verified from the catalog: guard 4 still raises `P0002`, the door's absence≡denial idiom, and the fix lives entirely in the test. |
| **MAJOR-2** `312 t51`'s rationale is false | ✅ **DISCHARGED — and r1's premise was wrong; see r2·3** | The new text is **true**, in all three of its parts, each measured (r2·3). The declined REVOKE was **applied in-transaction and shown to close no capability**. |
| **MINOR-1** `S3d2` passes when `is_active` is absent | ✅ **DISCHARGED** | With the `is_active` guard **deleted** from `app.can_read_document`: `1..59`, **`not ok 29 — DM5·S3d2`** (+ `not ok 22 — S3c4`, the behavioural twin, correctly). And the vacuity is reproduced *in the same transaction*: against the mutated body, `pos_active=0 · pos_print=643`, **OLD form verdict `t`** (would have passed) vs **NEW form verdict `f`**. ⭐ The one surviving `is_active` occurrence is **inside a comment** (1 raw hit, 0 after comment-stripping) — so the assertion's `regexp_replace` of `--` comments is load-bearing, not decorative. |
| **MINOR-2** `can_write_document`'s print arm had no keystone | ✅ **DISCHARGED** | Print arm removed from `app.can_write_document`: `1..59`, **`not ok 54 — S3l1`** plus `S3f2`/`S3f3`/`S3f3t` — the exact red set `backend` reported. ⛔ **FUP-DM5-330-WRITE-BLIND is still OPEN** in `docs/progress/follow-ups.md:127` with its "do not close on `342`'s coverage" note intact — verified, not assumed. |
| **MINOR-3** guard 5 had no ordinary twin | ✅ **DISCHARGED** | Guard 5 made to over-bind (its `printed_documents` sub-select widened to `where true`): `1..59`, **`not ok 39 — S3f5t`** alone; **`S3f5` stayed GREEN** — the twin, not the original, is what notices over-binding. |
| **MINOR-6** the mint's `HC0D4` handler misses the unique that fires first | ✅ **DISCHARGED, and more strongly than r1 asked** | r1 offered "correct the comment **or** widen the handler"; migration `…000360` instead makes the handler **attribute** — `get stacked diagnostics constraint_name`, `raise;` for anything outside the two credential uniques (verified from `pg_proc`, not the file). Old broad handler restored in-transaction: `1..59`, **`not ok 58 — S3n2`**, `S3n1` GREEN. ⭐ `S3n2` earns its keystone by **opening the lock that hides the path** (dropping `file_objects_bucket_path_uniq` in-transaction), which is the same prescription as MAJOR-1 — and `backend` recording that **its own first version of this fix was vacuous in exactly MAJOR-1's way** is the single best sign in this commit that the lesson took. |
| **MINOR-4** D11's retirement is "not performed and cannot be" | 🟡 **SUBSTANTIALLY discharged — one line short**; see **r2-MINOR-1** | Filed as **🟠 FUP-DM5-D11-SUPERSEDED-NEVER-RETIRES** (`follow-ups.md:11`) with the measurement, the owner (**PO decision, then backend**), both honest resolutions, and an explicit *"do not resolve it by adding a comment saying retirement 'should' happen."* That is exactly what r1 asked for **except** that ADR 0120 D11's own text still asserts the control with no marker. |
| **MINOR-5** dangling print on a deleted draft | ✅ **DISCHARGED** | Filed as **🟡 FUP-DM5-DANGLING-PRINT-ON-DELETED-DRAFT** (`follow-ups.md:28`), labelled *"CONFIRMED by probe, not reasoned"*, and it carries the part r1 flagged as the one that must not be assumed away — *"the `securable_resources` dangling row needs handling either way … every kernel arm joins through it."* |
| **INFO-1** `PROGRESS.md` reads `S3 ⬜ NEXT` | ✅ **DISCHARGED** | `PROGRESS.md:74` now reads **`S3 built, QA r2 OWED`**, and the QA-Verdicts row states *"r2 NOT YET RUN, so S3 has no APPROVED verdict."* |
| **INFO-2** `kind = 'printed_rendition'` in English | ✅ n/a — r1 did not file it as a finding; the ruling still holds. |

**Independent corroboration of the gate figure, since it cost 50 seconds:** full `npm run test:db` on
a fresh reset = **`Files=193, Tests=6348 … Result: PASS`**, matching the recorded step-1 figure
exactly. So `312`'s 75→77 and `342`'s 49→59 broke no sibling suite.

## r2·3 — MAJOR-2 in detail: r1's premise was FALSE, and the correction is TRUE

r1 blocked on the claim that S3 **relocated** a coordinate that had previously been **withheld**. The
brief told me a lead had corrected that premise and told me **not** to accept the correction from the
lead. I did not. Four measurements:

**(a) The historical half — the only claim in this review that the live catalog cannot answer.**
`pd_storage_path_derived` no longer exists, so its definition comes from git
(`e453c8d9`, the ADR-0104 P1 migration):

```sql
constraint pd_storage_path_derived check (
  storage_path = (case when contains_phi then 'phi/' else 'std/' end) || id::text || '.pdf'
)
```

and the same migration's column-list grant:

```sql
grant select (
  id, source_kind, source_id, commission_id, template_key, template_version,
  content_hash, contains_phi, status, verification_short_code, ...
) on public.printed_documents to authenticated;
```

`id` **and** `contains_phi` are both in it. So pre-S3 `storage_path` was a **pure function of two
columns the viewer could already read**, and the column-list withholding of it was **already
vacuous**. ⚠ **Stated as the limit it is:** this rests on migration text, which this repo treats as
stale by design. It is sound *here* only because a `CHECK` constraint's definition is not among the
things rewritten at runtime by `pg_get_functiondef()`+`replace()`, and because both statements are
from the migration that **created** the table. **r1's contrary premise was not measured at all** — it
was inferred from the *present* ACL and never tested against the pre-S3 shape.

**(b) The present half, measured as the print's legitimate viewer** (`authenticated`, hat present —
`active_role` in the claims, the trap r1 itself documented): both derivation inputs readable
(`id | contains_phi` → `…f201 | false`), and the derived coordinate **equals** the real one
(`printed/<id>.pdf` == `file_objects.storage_path`, `match=true`). **Exactly as derivable as before.**
Neither strengthened nor weakened — `backend`'s sentence, confirmed.

**(c) The declined REVOKE closes nothing — applied and measured, not argued.** In one rolled-back
transaction, as the legitimate viewer (`can_read_document = true` asserted first):

```
C1 PRE-REVOKE   home_resource_id-only walk -> documents-standard | printed/…f201.pdf
D0 revoke select (document_id, document_version_id) … from authenticated  -> grant now false
D1 POST-REVOKE  home_resource_id-only walk -> documents-standard | printed/…f201.pdf
D2 POST-REVOKE  select document_version_id …  -> ERROR: permission denied for table printed_documents
```

`D2` is the control that makes `D1` mean something: the revoke **is** effective, and the walk
`documents.home_resource_id → document_versions → document_version_files → file_objects` **never
touches `printed_documents`**. So the REVOKE would have closed **no capability** — declining it on
evidence is correct, and shipping it would have been a third comment asserting a property that does
not hold.

**(d) What actually protects the bytes, and both new assertions PROVEN ABLE TO FAIL.** ⭐ `backend`'s
commit proves five keystones red-first but **not** `t51c`/`t51d`, the two it added for MAJOR-2. So I
did:

- **`t51d`** — a SELECT policy on `storage.objects` for `documents-standard` created in-transaction:
  `1..77`, **`not ok 54 — t51d`** *and* **`not ok 57 — t53`** (the behavioural half). Both
  discriminate. Restored: **8** policies, `0` probe policies left.
- **`t51c`** — revoking `SELECT (contains_phi)` makes `312` fail **loudly** (the file aborts at an
  earlier read, 19 ok then abort, i.e. never green), so the *property* is covered — but see
  **r2-INFO-1**: `t51c` is not the assertion that reds, and its `is not null` form is weaker than its
  label.

I re-enumerated all **8** `storage.objects` policies: **three SELECT** (`nsp-evidence` ×2,
`form-assets`), **five INSERT**, and **every one is bucket-literal-scoped**. No SELECT policy names
either document bucket. ADR 0114 D8 holds.

## r2·4 — New at r2

### 🟡 r2-MINOR-1 (non-blocking) — ADR 0120 **D11 still asserts the control it does not perform**, with no marker

`docs/decisions/0120-dm5-wave-d-retirement-decisions.md:61-66` still reads *"…and **retires superseded
bytes through `file_objects.disposal_state`**"* as a plain statement of what D11 does. The measurement
says both `disposal_state` values stay `none` and nothing schedules it. The follow-up is filed and
well-written, but **it is not where an auditor reads D11**, and nothing in D11 points at it.

I am **not** asking for the ADR to be amended — that would pre-empt the PO's choice between
*(a)* build retirement and *(b)* strike the claim, which is exactly what the follow-up reserves.
**Fix: one inline marker in D11** — e.g. `⏳ CONTESTED: not performed today — see
FUP-DM5-D11-SUPERSEDED-NEVER-RETIRES` — which pre-empts nothing and costs a line. In a 20-year
LGPD/ANVISA record, the gap between "the ADR asserts a control" and "the control exists" is the whole
reason r1 filed this.

### 🔵 r2-INFO-1 — `312 t51c` is a weaker pin than its label claims

`t51c` asserts `(id is not null) || '|' || (contains_phi is not null) = 'true|true'`. It **does**
traverse the column-list grant (it runs as `authenticated`), so it cannot go green with the columns
revoked — but the failure lands as an **earlier abort**, never as `not ok t51c`. And its form is
satisfied by any visible row: it does **not** assert that the derivation reproduces the live
coordinate. That part is pinned elsewhere (`342 S3m4` compares against
`app.printed_rendition_storage_path`), so the property is covered — but a future reader will
over-read the label *"the coordinate is DERIVABLE"* as a coordinate-equality assertion. **Not worth a
change on its own;** worth knowing if `t51c` is ever cited as the pin.

### 🔵 r2-INFO-2 — `342`'s plan-arithmetic comment declares **44** for a plan of **59**

`342:21-27` reads `-- 44 = 3 preconditions + 5 coupling + …`. The enumerated terms now sum to **59**
(`3+5+6+4+7+2+2+3+7+2+3+5+1+3+3+3`), and `select plan(59)` is right. The `44` was already stale before
r1 (it excludes S3j's 5) and r1's four new blocks widened the gap to 15. The comment is the only place
a reader can reconcile the plan count against the file's shape, and this project's own recorded lesson
is that *a comment is an assertion that goes stale silently*. **Fix: `44` → `59`.**

### 🔵 r2-INFO-3 — the in-suite restore controls pin less than the transaction guarantees (and the transaction is fine)

`S3k3` asserts the sibling lock is closed again by **regex on `prosrc`**; `S3n3` asserts the unique is
back by **`exists(conname)`**. Neither pins `prosecdef`, the ACL, or the constraint *definition* — and
this repo has been bitten by a rebuild that read right and lost a property. **I measured it: the
property holds.** Running `S3k`'s exact open/restore cycle:
`def_identical=true · prosecdef_same=true · acl_same=true · volatility_same=true`
(`acl = {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}` throughout) —
`pg_get_functiondef` carries `SECURITY DEFINER` + the pinned `search_path`, and `CREATE OR REPLACE`
preserves the ACL. **The real guarantee is the rollback**, not the controls, and that is sound. ⚠ One
adjacent note for whoever owns **FUP-PGTAP-WORKER-DEADLOCK**: `S3n` takes an **ACCESS EXCLUSIVE** lock
on `public.file_objects` (`drop constraint`) for the remainder of `342`'s transaction, which is new
lock surface for a parallel `pg_prove` worker. Not observed to fire — `test:db` passed 193/193 — but
it is the kind of thing that shows up as an intermittent.

## r2·5 — What r2 did **NOT** re-verify

1. **r1's §4 in its entirety** — D12's conjunction, the exhaustive `kernel ⇒ print` implication over
   39 profiles, the ACL sweep of all 17 touched functions, Rule 12 / tier-forging, D13's double
   exclusion, the no-direct-DML-seam finding, the 404 mapping, the residual-reference sweep. **Not
   re-probed by design** — r2's remit is the discharge. If r1's §4 is wrong, r2 does not catch it.
2. **`e2e:prod`, `next build`, and every authz ARM / door sweep** — instructed not to run them, and
   `af9a894e` touches only pgTAP plus one exception handler's attribution. **`ARM=census` was not
   re-run**, and `…000360` **rewrites a `prosecdef = t` body** — I accept `backend`'s re-pass of step 1
   as reported rather than as verified.
3. **Whether `…000360`'s new `raise;` path can surface a raw `23505` to a user.** The re-raise is
   reachable only with a unique that today cannot fire (`S3n2` had to drop one to reach it), and r1's
   §4.7 already established that the serving route maps everything to a pt-BR 404 — but I did not
   re-walk the action's error mapping for the **mint** path at r2.
4. **No UI, no a11y, no keyboard flow, no vitest, no TypeScript.** `af9a894e` touches none.
5. **The ~180 other assertions in `312`** — I read the `t51`/`t53` block and ran the file; I did not
   audit the rest, and `t51b`'s `doc2` visibility I took from the green run rather than probing.
6. **Remote / Cloud** — nothing pushed; D17 forbids it. Zero coverage, by design.
7. **`FUP-DM5-330-WRITE-BLIND`'s substance** — I verified only that it is **still open** with its
   scoping note. Whether `330`'s `controlled_document` arm is now STALE-COVERED is not an r2 question.

## r2·6 — Bottom line for the gate

**§6 step 3 is satisfied: APPROVED.** Nothing found at r2 blocks S3's closure or S4's start.
**r2-MINOR-1** is a one-line marker in ADR 0120 D11 and can travel with S4's record commit or the
PO's D11 ruling, whichever comes first; **r2-INFO-2** is a one-character fix in a comment. Neither is
worth a step-1 loop on its own.

⛔ **Two things this verdict does NOT say.** It is a **slice** verdict — **DM5 phase QA is still owed
at S6**, as r1 stated. And it does **not** authorize S4: S4 is irreversible and needs **PO
authorization on the day**, separately.
