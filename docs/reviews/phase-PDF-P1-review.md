# Phase PDF·P1 — QA Review

**APPROVED (r2)** — both r1 MAJORs closed and independently re-verified; 6 of 9 MINORs closed;
3 MINORs deferred by agreement as recorded open follow-ups. See
[§ Round 2](#round-2--verification-of-the-fix-wave) for the r2 verification record; the
sections below are the r1 review, left intact as the baseline the fix wave was measured against.

**Phase:** PDF·P1 — PDF document printing, Forms + full skeleton
**Reviewer:** `qa` · **Date:** 2026-08-07 · **Branch:** `worktree-pdf-printing-p1`
**Scope reviewed:** `git diff main...HEAD` — `0d1dca8` (contracts) · `e453c8d` (migrations +
pgTAP) · `c81f37a` (census verdicts) · `56e5529` (F1/F2 UI) · `e1daba9` (renderer / pipeline /
serving) · `2f2a909` (E2E) + PROGRESS chores. 61 files, +6143.
**Contract audited against:** ADR [0104](../decisions/0104-pdf-document-printing-module.md)
D1–D15 · [plan](../plans/pdf-document-printing.md) §2 (P1 spec) and §7 (non-scope) · the
PDF·P1 rows + lead notes in PROGRESS.md.

**Verdict rationale.** No BLOCKER. Every security invariant the phase claims was re-derived
by me from the **live catalog**, not from migration text, and every one of them holds: RLS is
the boundary, `prosecdef` was read beside `pg_policies` for all five new functions, the ACLs
are exact, `anon` has provably zero reach, the storage bucket is private with zero policies,
D8's "no signed URL ever" survives a whole-repo sweep, and D10's public tuple is anemic to the
field. The pgTAP keystones were independently mutation-audited for vacuity against the §7.1
trap list and the personas were verified to be the roles the file claims. Two **MAJOR**
findings are gaps in *guards*, not in the product: nothing violates them today, both are cheap
to close, and both must be closed before P2/P3 — P3 carries PHI onto exactly these seams.

---

## Methodology

Per the binding rule, **no schema/RLS/RPC/authorization claim below rests on a migration
file.** Every one was resolved from the live local catalog (319 registered migrations ==
319 files, verified before starting). `docs/progress/authz-handoff.md` §7 was read first and
applied: `prosecdef` beside `pg_policies` for every door the phase touched; `prosrc` regexes
comment-stripped; the permissive-sibling and wrong-arm-fixture traps applied to every
row-assertion. I re-ran `ARM=census` myself rather than trusting the B6 row. The ESLint purity
gate and the fingerprint guard were **red-teamed**, not read.

Re-run during review: `npm run lint` (exit 0) · `npx tsc --noEmit` (exit 0) · `npx vitest run
src/lib/pdf src/lib/pdf-mint src/lib/queries/printed-documents.test.ts` (4 files, 16 tests,
pass) · `ARM=census` (**INVARIANT HOLDS** — 450 live gates, 459 verdicts). The full
`e2e:prod` gate was not re-run (lead's step; recorded GREEN, 0 real failures / 1026).

---

## Axis 1 — Requirements vs ADR 0104 + plan §2

**Verdict: MET.** All fifteen decisions are implemented or deferred exactly as §7 permits.

| D | Requirement | Status |
| --- | --- | --- |
| D1 | PDF is a RECORD: bytes in Storage + registry row with identity, mint ts, actor, template key+version, hash | ✅ `printed_documents` carries all of it; smoke-proven `sha256(served) === content_hash` (B7) |
| D2 | Bytes only, payload JSON never persisted | ✅ no payload column, no payload store anywhere in the diff |
| D3 | One generic registry + per-kind dispatch, unhandled kind ⇒ false | ✅ see Axis 2; ELSE is real and keystoned |
| D4 | Templates are code, versioned by constant, fingerprint guard | ⚠️ implemented; guard has a coverage hole — **MAJOR-2** |
| D5 | Synchronous mint, bounded concurrency, all-or-nothing | ✅ 3-permit semaphore (`semaphore.ts`), 30 s budget, upload-before-RPC + `remove()` on RPC failure (`actions.ts:217-254`) |
| D6 | `active → superseded \| revoked`; supersession automatic in the mint txn; revoke staff_admin+ with mandatory reason; recency wording must not imply the paper is wrong | ✅ supersession is an `update … where status='active'` **inside** the mint door; the pt-BR recency copy is exemplary (see below) |
| D7 | Four derived-only marks + non-suppressible PHI band | ✅ `watermark.ts` — all literals, zero free text; `RASCUNHO`/`FINAL` at mint, `SUBSTITUÍDO`/`ANULADO` deliberately absent (they are D8's overlay) |
| D8 | Download-time overlay; never a bare signed Storage URL | ✅ **verified by whole-repo sweep** — see Axis 2 |
| D9 | PHI per-mint, default OFF, existing doors only; storage bifurcation | ✅ P1 fails PHI closed in **both** halves (`HC0D2` in the door, `provider.phiCapable` in TS); `phi/` prefix + band primitive built, unused, ready |
| D10 | Dedicated token, anemic public answer, no anonymous download, rate-limited | ✅ tuple is exact (Axis 2); rate limit present with a shape caveat — **MINOR-3** |
| D11 | Authorization matrix incl. the platform_admin noun rule | ✅ **verified at the catalog** — Axis 2 |
| D12 | Audit ledger via `app.audit_write`, PHI-free metadata, verification scans NOT in `audit_log` | ✅ three events, metadata is ids/flags/hash only; `verification_lookups` is a separate table with hashed credentials |
| D13 | Attestation blocks, honest caption, `— não assinado —` | ✅ `signature-block.ts` — exact ADR wording, no cursive/image/synthesized signature |
| D14 | Gotenberg sidecar pinned + private; `src/lib/pdf/` pure, enforced mechanically | ⚠️ sidecar correct (`gotenberg/gotenberg:8.24.0`); enforcement has a hole — **MAJOR-1** |
| D15 | Layout, table+enum names, flag OFF, retention, rollout order | ✅ except the ratified enum→text deviation is unrecorded in the ADR — **MINOR-6** |

**§7 non-scope: nothing crept in.** Swept and confirmed absent: bulk export / `document_jobs`,
tenant-custom stamps, `VIA NÃO CONTROLADA`, DB-stored templates, ICP-Brasil, any admin delete
surface, and any Meetings/Interviews PHI. The `phi/` prefix and the confidentiality-band
primitive exist but are inert (`contains_phi` is hard-`false` on every P1 path and the door
raises `HC0D2` on `true`) — that is D9's declared *readiness seam*, not scope creep.

**The four recorded deviations are implemented as recorded**, each verified at the catalog:

1. **text + CHECK vocabulary** instead of enums — `source_kind` and `status` are `text` with
   `printed_documents_source_kind_check` / `printed_documents_status_check` carrying the four
   and three values respectively.
2. **Door-derived storage path** — `pd_storage_path_derived` CHECK pins
   `storage_path = (case when contains_phi then 'phi/' else 'std/' end) || id || '.pdf'`; the
   door computes it and never accepts it as a parameter (there is no `p_storage_path`).
3. **In-door overlay flag** — `open_printed_document` computes `v_overlay := (v_row.status <>
   'active')` itself rather than trusting a caller-supplied flag. This is *stronger* than the
   plan's "overlay-applied flag param from the caller"; pgTAP t26 pins it.
4. **Service-role-only lookup + `p_viewer`** — `lookup_printed_document` `proacl` is
   `{postgres=X/postgres,service_role=X/postgres}`. **No `authenticated`, no `anon`.**

**Amendments A and B are implemented as recorded.** A: credentials are minted in the action
before render (`actions.ts:193-201`) because the token must be inside the canonical bytes'
QR, and the door validates *format* (`'^[A-Za-z0-9_-]{32,128}$'`, `'^[A-HJ-NP-Z2-9]{10}$'`)
plus uniqueness, raising a distinct `HC0D4` that drives a full re-render retry. B: the door
refuses to insert unless the object already exists at the derived path (`HC0D3`), so a
registry row can never point at a missing object.

**FUP-PDF-1** (creator-mint has no UI surface) is a correctly-scoped, correctly-recorded
deliberate limitation: the door grants mint to any source-viewer per D11, and the UI simply
does not offer it yet because the only response-detail screen is `staff_admin`-gated upstream.
The door is not over-tight; the UI is under-built. Right call for P1.

---

## Axis 2 — Security / RLS

**Verdict: MET. This is the strongest axis of the phase.** Every claim below is followed by
the catalog evidence I actually ran.

### 2.1 `printed_documents` — RLS, grants, indexes, CHECKs

```
select relrowsecurity from pg_class where relname='printed_documents';   -- t
select policyname, permissive, roles, cmd, qual from pg_policies where tablename='printed_documents';
--  printed_documents_select | PERMISSIVE | {authenticated} | SELECT
--  qual: app.can_view_printed_document(source_kind, source_id, (SELECT auth.uid()))
```

**Exactly one policy.** This matters more than it looks: it is what makes every pgTAP
row-assertion on this table non-vacuous under the §7.1 permissive-sibling rule — there is no
sibling permit to fake a positive and no sibling deny to fake a negative, and no `FOR ALL`
policy anywhere near it.

**Zero DML grants to `authenticated`** (`information_schema.table_privileges`): only `postgres`
and `service_role` hold INSERT/UPDATE/DELETE. All writes are door-only by construction.

**Column-list SELECT — the four excluded columns confirmed from the catalog.** 19 columns
exist; `authenticated` holds SELECT on 15. Excluded: **`storage_path`, `verification_token`,
`revoked_reason`, `revoked_by`**. Note C's rationale is recorded *in the catalog itself* as a
`COMMENT ON COLUMN` on `storage_path` ("with id + contains_phi granted the path is derivable,
so the exclusion is defense-in-depth + posture, not a secret") — a load-bearing claim encoded
where it cannot silently go stale. Good practice; I want to name it approvingly.

`printed_documents_one_active` — `UNIQUE (source_kind, source_id, template_key) WHERE status =
'active'`. Present. `pd_storage_path_derived` present as quoted above. Plus five further
integrity CHECKs (`pd_revoked_iff_ts`, `pd_revocation_complete`, `pd_superseded_has_ts`,
`pd_superseded_ts_status`, `content_hash ~ '^[0-9a-f]{64}$'`) that were not required and are
welcome.

### 2.2 `app.can_view_printed_document` — explicit arms, not delegation

`prosecdef = t`, `search_path` pinned to `app, public, pg_catalog`, `proacl =
{postgres,authenticated,service_role}`. The body is a `case … else return false; end case` —
an **explicit-arm** dispatch, never an invoker-RLS delegation. The B0 finding that drove this
is correct and important: there is no single response-visibility predicate to delegate to.

**The `form_response` arm mirrors the LIVE `responses` read surface. I verified the mirror
against `pg_policies` today, not against the comment:**

| live policy on `responses` (SELECT-capable) | qual | mirrored in the arm? |
| --- | --- | --- |
| `responses_select` | `created_by = auth.uid() OR is_commission_admin_of(commission_id) OR (status='submitted' AND is_staff_admin_of(commission_id)) OR can_read_correction_response(id, auth.uid())` | ✅ all four terms |
| `responses_select_targeted` | `can_access_targeted_response(id, auth.uid())` | ✅ |
| `responses_admin_all` (`FOR ALL` ⇒ **is a read policy**) | `is_commission_admin_of(commission_id)` | ✅ subsumed by term 2 |

Parity is exact, and it uses the `_for` variants correctly — `is_commission_admin_of` is
literally `select app.is_commission_admin_of_for(p_commission_id, (select auth.uid()))`, and
`is_staff_admin_of` is textually identical to `_for` with `auth.uid()` substituted. No
widening, no narrowing. The §7.2 "`X` vs `X_for` — two different helpers, no single regex
finds both" trap was navigated correctly by the author.

**ELSE arm:** `case | meeting | interview` all fall to `return false`. Fails closed. Census-
registered: `docs/reviews/authz-door-audit-findings.md` now carries a COVERED row for the
predicate and for `printed_documents_select`, and `authz-rowdoor-audit-findings.md` carries
`public.open_printed_document` — with an explicit hand-merge header warning that a subset run
overwrites the report (ADR 0079 Amendment 1 hazard 1). **I re-ran `ARM=census`: INVARIANT
HOLDS**, 450 live gates / 459 verdicts, no unswept newcomer.

### 2.3 The four doors

All four: `prosecdef = t`, `search_path` pinned, flag assert
(`app.assert_document_printing_enabled()`) as the **first statement**, `app.audit_write` with
PHI-free metadata (ids, template key/version, flags, hash, reason class/text — never source
content).

**ACLs, from `proacl` — exactly as required:**

```
mint_printed_document    {postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}
open_printed_document    {postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}
revoke_printed_document  {postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}
lookup_printed_document  {postgres=X/postgres,service_role=X/postgres}          -- service_role ONLY ✅
```

**`anon` has provably zero reach.** I asked the catalog directly rather than inferring:

```
select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where (p.proname ~ 'printed_document' or p.proname='get_feature_flags')
   and has_function_privilege('anon', p.oid, 'EXECUTE');            -- (0 rows)
select grantee, privilege_type from information_schema.table_privileges
 where table_name='printed_documents' and grantee='anon';           -- (0 rows)
```

This also confirms the lead's flag ruling: `get_feature_flags` is
`{postgres,service_role,authenticated}` — no anon EXECUTE — so the public pages' use of the
service-role `documentPrintingEnabled()` helper is the correct shape, not a shortcut.

**Authority-first with distinct SQLSTATEs.** `mint` checks flag → **authority (42501)** →
PHI (`HC0D2`) → template coherence (`HC0D1`) → credential format (`HC0D1`) → source resolution
(`HC0D1`) → object existence (`HC0D3`) → supersede+insert (`HC0D4` on collision). Authority
precedes every other refusal, which is precisely the structural defence §7.1 prescribes and
is what makes the pgTAP `throws_ok('42501')` tests un-fakeable. `open` returns *no row* for
both not-found and out-of-scope — no oracle, and **no audit row on deny** (t28 pins this).
One inversion in `revoke` — **MINOR-4**.

**Format validation of action-supplied credentials** — present and correct (the two regexes
quoted above); ≥192-bit token, 50-bit unambiguous short code (no I/O/0/1).

**Supersession inside the mint transaction** — confirmed: the `update … set status =
'superseded'` and the `insert` are consecutive statements in one plpgsql body, so the registry
can never transiently show two actives or zero actives.

### 2.4 D8 — no signed/storage URL can reach a client

Swept the entire repo (`src/`, `e2e/`, `scripts/`). `getPublicUrl`: **0 hits repo-wide.**
`createSignedUrl(s)`: 10 hits, and **none names `printed-documents`** (they are attachments,
form-assets, controlled-documents, nsp-evidence, referral-attachments, meeting-audio). The
four `.storage.from('printed-documents')` call sites are `upload`/`remove` in the `'use server'`
mint action, `download` in the route handler, and the node smoke script — no URL minting at
all. `from('printed_documents')` has exactly **one** call site in `src/`
(`queries/printed-documents.ts:105`) with an explicit column list that omits both withheld
columns; no `select('*')` on this table anywhere.

The serving route is the only byte path: session → `open_printed_document` (authorizes at
call time + audits) → service-role download → overlay when non-active → stream, with
`Cache-Control: no-store`. The path never enters a response body.

**Storage bucket, from `storage.buckets`:** `printed-documents`, `public = f`, MIME restricted
to `{application/pdf}`, 25 MB. **Zero policies in `pg_policies where schemaname='storage'`
mention it** — I read all 16 storage policies; none references the bucket. So `authenticated`
reads zero objects from it by RLS default-deny, which pgTAP t53/t54 independently assert.
`upsert: false` on the upload preserves Rule 6.

### 2.5 D10 — the public tuple stays anemic

`lookup_printed_document` returns exactly `(matched, status, minted_at, source_kind,
hospital_name, document_id)`. No patient anything, no case number, no actor name, no
commission name, no short code, no source id, no bytes.

**`p_viewer` null-for-anonymous is enforced in the RPC, not the page** — verified in the body:

```sql
case when p_viewer is not null
      and app.can_view_printed_document(v_row.source_kind, v_row.source_id, p_viewer)
     then v_row.id else null end
```

The page cannot opt out of this: `documentId` is the *only* input to the download affordance,
and `DownloadAffordance` returns `null` when it is null. `PrintedDocumentVerification` carries
nothing beyond the five fields, so there is nothing extra available to leak even by accident,
and `verification-result.tsx` renders exactly those five plus a navigation link. Confirmed by
reading the component: no additional field.

Lookups are logged to `verification_lookups` with `encode(digest(left(credential,512),
'sha256'),'hex')` — **hash only, never the raw token** — and that table has RLS on, **zero
policies**, and no `authenticated`/`anon` grant. D12's "anonymous internet noise stays out of
the hash-chained ledger" is honoured exactly.

### 2.6 D11 matrix, including the platform_admin noun rule

| Action | Rule | Enforcement verified |
| --- | --- | --- |
| Mint (non-PHI) | anyone who can view the source | mint door authority ≡ `can_view_printed_document` — the *same* function the RLS policy uses |
| Mint (PHI) | + domain PHI door | P1 has no PHI-capable kind; `HC0D2` fails closed |
| Download | same predicate **at download time** | `open_printed_document` re-evaluates `can_view_printed_document` on every call. Minting is not a self-grant — the side-door class is closed |
| Revoke | `staff_admin` + admin chain, **not the minter** | `is_staff_admin_of_for OR is_commission_admin_of_for`; `revoked_reason_class` restricted to a closed vocabulary and `btrim(p_reason) <> ''` mandatory |
| `platform_admin` | may not mint / download / revoke, reads 0 rows | **see below** |

**The noun rule holds structurally, not just by test.** `can_view_printed_document`'s
form_response arm has five terms, and I chased every one for a smuggled admin path with a
comment-stripped `prosrc` probe:

```sql
with b as (select p.proname, regexp_replace(p.prosrc,'--[^\n]*','','g') as src
           from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='app')
select proname, (src ~ 'is_admin'), (src ~ 'platform') from b
 where proname in ('can_read_correction_response','can_access_targeted_response',
                   'is_active','has_role','feature_enabled');
-- every row: f | f
```

Neither delegated arm carries an `is_admin` or platform branch, and neither admin helper does
either (`is_commission_admin_of_for` gates on `org_admin`/`hospital_admin` memberships only).
So a `platform_admin` with no membership reads zero rows *by predicate*, not by accident of
fixture. pgTAP t17/t18/t31 assert mint-denied, zero-rows and revoke-denied with the real
platform_admin shape (profile `is_admin = true` **and** the JWT claim — persona identity
independently verified against `00_setup.sql`, per the "a plausible variable name is not a
role" trap). One coverage gap at `open` — **MINOR-8**.

### 2.7 Rule 7 — HTML escaping into Chromium

I read **every** HTML-emitting file in `src/lib/pdf/` and traced **every** interpolation.
`esc()` escapes `& < > " '`. Coverage of payload-sourced *strings*:

| site | escaped? |
| --- | --- |
| `letterhead.ts` — hospitalName, hospitalAddress, commissionName, logoDataUri (inside `src="…"`) | ✅ all four |
| `section-table.ts` — row label + value, display-text label | ✅ all |
| `signature-block.ts` — name, title | ✅ |
| `qr-footer.ts` — url, shortCode, byDisplay | ✅ |
| `form-response.ts` — formTitle, respondentDisplay, section title, section description | ✅ |
| `watermark.ts` | n/a — 100% literals, no payload interpolation at all |
| `render.ts` — font family/dataUri | n/a — generated constants |

Non-string interpolations are typed non-strings (`versionNumber: number`) or literal-map
lookups (`STATUS_LABEL`). **The one gap is the `format*()` return path — MINOR-5.** The
architectural choice to escape at the *render boundary* rather than in the provider is the
right one: the provider can never forget, because the primitive escapes everything it is
given.

### 2.8 Rate limiting on `/verificar`

The limiter fronts **every** call path: `lookupPrintedDocumentVerification` is the RPC's only
caller in `src/` (grep-confirmed — the sole other reference is the node smoke script), the
RPC is service-role-only so PostgREST offers no bypass, and `consumeLookupBudget` runs before
the client is even constructed. The landing page performs **no** lookup — it normalizes and
redirects, so the budget is spent once per result view. The chain is closed by construction.
Shape caveats: **MINOR-3**.

---

## Axis 3 — Code quality

**Verdict: MET, with MAJOR-1.**

- **TypeScript `strict`** — `npx tsc --noEmit` exit 0. **Zero `any`** in the phase's source
  (`: any` / `as any` / `<any>` all absent), so the "no `any` without inline justification"
  rule is satisfied vacuously and honestly.
- **Lint** — `npm run lint` exit 0 (eslint `--max-warnings=0` **and** `lint:css-vars`).
- **Rule 9** — all data access flows through `src/lib/queries/`. The provider
  (`src/lib/forms/pdf-payload.ts`) reads exclusively via `getResponseForFill`,
  `getResponseSignoffs`, `getResponsePrintContext`, `evalVisibility`; no inline supabase-js.
- **Rule 8** — `src/lib/types/database.ts` regenerated (+201 lines covering the new table and
  four RPCs); domain types imported from `@/lib/pdf/types`.
- **Server Components by default** — three `"use client"` files, each justified by real
  interaction (dialog state + `useTransition` + focus management; form state; GSAP +
  `useReducedMotion`). `labels.ts` is types-only-importing and pure, so the BUG-FBE-005
  client-value-import build abort is avoided by construction.
- **Server-only boundaries** — no chain from any `"use client"` file to `pdf-lib`,
  `@/lib/supabase/admin`, or `node:crypto` exists. The client islands import the action module
  **type-only**; the sole value import is from a Server Component, where `'use server'` makes
  it an action reference rather than module code. `admin.ts` carries `import 'server-only'`, so
  the build-time tripwire backstops the whole chain.
- **File ownership** — respected: `backend` owns `src/lib/pdf*`, `src/lib/queries`, migrations,
  the route handler; `frontend` owns `src/app/(public)`, `src/components/**`; `tester` owns
  `e2e/**`. No file appears in two owners' commits.
- **Purity gate** — real, and it fires. But incomplete: **MAJOR-1**.

The `getResponsePrintContext` two-step is **safe, and I checked the ordering rather than the
existence.** Step 1 reads `responses` under the **caller's own RLS** and returns `null` if the
row is invisible; only *after* that gate passes does step 2 use the service role, and it reads
exactly two display strings (commission name, hospital name) from `commissions`/`hospitals`.
The caller is therefore pre-authorized before the elevated read, the elevated read cannot
answer a question the caller had not already answered, and it returns no existence signal
(step 1 already returned `null`). This is the ADR 0075 pre-authorized-service-role shape used
correctly, and the substrate justification is real: `hospitals_select` genuinely carries no
member arm, and a targeted respondent may not be a commission member at all, so an `!inner`
embed would empty the row for exactly the people D11 entitles to mint.

---

## Axis 4 — Tests

**Verdict: MET.** `312_printed_documents.sql` — `plan(69)`, 69 assertions, labels `t1…t69`
contiguous, no gaps, no duplicates. Full suite 173 files / 5444 PASS on a fresh reset. E2E
7/7 green twice on independent fresh resets, and the full `e2e:prod` gate GREEN with 0 real
failures / 1026 collected.

**Vacuity audit — the tests present are sound.** Independently mutation-analysed against the
§7.1 trap list:

- **Fail-closed ELSE** (t9/t10): t8 is a deliberate precondition proving the meeting row *is*
  readable, which pre-empts the wrong-arm objection — the `false` is the ELSE, not a missing
  fixture. Flip ELSE to `true` and both go red.
- **Permissive sibling**: with exactly one policy on `printed_documents` and no `FOR ALL`
  anywhere near it, t18's zero-rows and t20's positive are both un-fakeable. This is the trap
  that has faked keystones twice on this codebase; it does not apply here, and I verified the
  policy census rather than assuming.
- **Minter-cannot-revoke** (t30) ships with its **over-grant twin** (t34, `lives_ok` as
  `sa_x`), so the arm is proven not to be a blanket deny. Correct discipline.
- **Non-viewer mint refused** (t15/t16): authority is mint's first refusal and no other arm in
  mint raises 42501; the fixture pre-creates the storage object so a missing-object `HC0D3`
  cannot masquerade. Correct arm, correctly pinned.
- **`HC0D1` overload** (six raise sites, five tests): each was walked against its fallback
  SQLSTATE — every one reds for the right reason if its guard is removed.
- **Flag precondition** (t1) **asserts** the flag rather than setting it, so the known
  "fixture flag gap silently SKIPS keystones" failure is impossible here — a lost seed reds
  loudly. This is the right pattern and worth copying.
- **Personas verified**: the `admin` fixture really carries `is_admin = true` in both the
  profile and the JWT claim; `st_x2` is really a same-commission plain `staff`; `oa_b` really
  org-admins the org that owns the fixture commission. No name-shaped assumptions.

**E2E vacuity: clean.** Swept for the §7.1 shape-5 defensive-branching trap — **zero** skip-
shapes: no `if (await x.isVisible())`, no try/catch around assertions, no `.count() > 0 &&`,
no early returns, no `test.skip`/`fixme`. The three optional chains all fail closed
(`undefined !== 200`). The keyboard flow uses **real `Tab`/`Enter` presses** with auto-
retrying `expect.poll` focus assertions and **no `.focus()` anywhere** — which sidesteps the
recorded "Playwright `.focus()` is not auto-waiting" flake class. The platform_admin exclusion
uses `toHaveCount(0)`, the correct absence form.

**D6 load-bearing wording is asserted**: the recency sentence "Existe uma emissão mais recente
deste documento…" is pinned, *and* the test asserts the "não reconhecido" and "anulado"
headings are `toHaveCount(0)` on that same page — so the state cannot silently collapse into
an error state.

Gaps are recorded as MINOR-7 / MINOR-8 / INFO-5.

---

## Axis 5 — UX, a11y, hygiene

**Verdict: MET.**

- **pt-BR** — all user-facing strings are pt-BR. `FINAL`/`RASCUNHO`/`ANULADO`/`SUBSTITUÍDO`
  are the printed marks ADR 0104 D7's own table specifies in pt-BR. One fallback path can
  print a raw identifier: **MINOR-9**.
- **The D6 verification copy is exemplary and I want it on the record.** Superseded renders
  heading **"Documento autêntico"** with the notice *"Existe uma emissão mais recente deste
  documento. A via em mãos continua autêntica — apenas deixou de ser a emissão mais recente."*
  That is D6's "must NOT imply the paper is wrong" answered head-on rather than minimally.
  `unavailable` likewise says *"Isso não diz nada sobre a autenticidade do documento"* rather
  than letting an outage read as a verdict — on a page an auditor reads, that distinction is
  the whole point.
- **Raw Postgres errors** — the door errors are mapped through a SQLSTATE allowlist and
  everything else becomes a generic pt-BR message. The allowlist's shape is fragile:
  **MINOR-1**.
- **Sanitized Markdown / no raw HTML** — satisfied, and then some: `section_text` markdown is
  HTML-escaped, so raw HTML cannot reach Chromium by any route. Fidelity cost: **INFO-1**.
- **Accessibility** — every input has an associated label via `useFieldIds`; the revoke
  free-text's PHI-free instruction is wired through `aria-describedby` (verified: the
  instruction element carries `id={reasonIds.descriptionId}` and `useFieldIds` emits the
  matching `aria-describedby`), so the "não escreva dados de paciente" warning is announced
  with the field rather than orphaned; dialogs are Radix focus-trapped with a deliberate
  `onOpenAutoFocus` landing and post-mint focus move to the download link; `focus-visible`
  rings everywhere with no bare outline removal; status is never colour-alone (icon + pt-BR
  text + pill). One nit: **INFO-4**.
- **Secrets** — `.env.example` adds `PDF_RENDERER_URL` and `PDF_VERIFICATION_BASE_URL` in
  server-only blocks with an explicit "Do NOT add a `NEXT_PUBLIC_` prefix". No service-role
  reference in `src/app` or `src/components`. `PDF_VERIFICATION_BASE_URL` being *configured*
  rather than derived from request headers is the right call and correctly reasoned in-code
  ("a spoofable Host must never end up printed on paper").
- **Docs** — `docs/deployment/pdf-renderer.md` (pinned tag, local recipe, Coolify runbook as
  a user handoff), `docs/backend-state.md` PDF·P1 section, census findings files updated with
  hand-merge warnings. PROGRESS.md reflects reality: I spot-checked the B5, B6, B7 and T1
  claims against the catalog and the tree and found no overstatement.
- **ADR hygiene** — ADR 0104 exists and is thorough; it was not amended for the ratified
  deviations: **MINOR-6**.

---

## Findings

### MAJOR

**MAJOR-1 — The D14 purity gate is bypassable by relative import. `eslint.config.mjs:49-81`.**

D14 requires the boundary be "enforced mechanically" precisely because "a convention in prose
is the class of claim that goes stale silently". I red-teamed the gate rather than reading it,
using `eslint --stdin --stdin-filename` (no files written):

```
# alias form — CAUGHT
import { createClient } from '@/lib/supabase/server'
  → error  '@/lib/supabase/server' import is restricted ... no-restricted-imports   ✅

# relative form — NOT CAUGHT
import { createClient } from '../supabase/server'          → 0 problems   ❌
import { listPrintedDocuments } from '../queries/printed-documents'  → 0 problems   ❌
```

The `patterns` groups (`@/lib/supabase`, `@/lib/supabase/*`, `@/lib/queries`, `@/lib/queries/*`,
`server-only`) match the **specifier string**, so they enumerate a *syntax* rather than the
*property* ("reaches outside `src/lib/pdf`"). This is the recorded lesson "an enumeration's
boundary must be the property, not a syntax", and it bites here specifically because **every
internal import inside `src/lib/pdf/` is already relative** (`../escape`, `../types`,
`../format`, `./primitives` — 20 of 20 internal specifiers). A future author reaching for the
query layer from `src/lib/pdf/documents/` would naturally write `../../queries/...` and the
gate would stay silent.

*Not currently violated* — I enumerated all 20 imports in the module; they are internal,
`uqr`, `pdf-lib`, `node:crypto`, `vitest`. Hence MAJOR, not BLOCKER.

**Fix:** add path-shaped patterns alongside the alias ones, e.g. `["**/lib/supabase/**",
"**/lib/queries/**", "../supabase/*", "../../supabase/*", "../queries/*", "../../queries/*"]`,
then re-red-team with the two probes above and confirm both now error.

**MAJOR-2 — The D4 fingerprint guard is blind to three template branches, including the one
most real documents use. `src/lib/pdf/fingerprint.test.ts:22-88`.**

The guard hashes `renderDocumentHtml(CANONICAL)`, and `CANONICAL` fixes
`watermarks: ['draft']`, `containsPhi: false`, `logoDataUri: null`. Consequently these code
paths are **outside the fingerprint** and can be edited without moving it — leaving
`TEMPLATE_VERSION` at 1 while the layout changes, which is exactly the silent metadata
corruption D4 exists to prevent:

- `watermark.ts:26-27` — the `final` chip. **This is the branch that renders for every
  `submitted` response**, i.e. the majority of real documents.
- `watermark.ts:29-34` — the confidentiality band. Inert in P1, but it is the *first* thing
  P3's PHI delta touches, and it will land already unguarded.
- `letterhead.ts:9-11` — the logo `<img>`.
- `format.ts:37-43` — `formatDate`, reached only via date answers (the fixture's values are
  pre-formatted strings).

Separately, the in-suite "the detector DETECTS" case (`:115-122`) mutates the **output
string** (`html.replace('class="section-table"', …)`) rather than the template, so it proves
sha256 is collision-free rather than that the guard notices a template edit. The genuine
proof is the live red recorded in the B6/B3 rows (the guard reddened on a real CSS edit
mid-build) — that is real evidence and I credit it; the point is that the *committed*
artifact does not carry it.

**Fix:** add one or two further frozen fixtures (a `final` + `containsPhi: true` + logo
variant, and one with a date answer) each with its own recorded fingerprint, so every branch
of the shared primitives is version-pinned. Extend `TEMPLATE_FINGERPRINTS` rather than editing
`CANONICAL` (the file's own frozen-fixture rule is right).

### MINOR

**MINOR-1 — `SURFACEABLE_CODES` allowlists SQLSTATEs Postgres also raises, in English.
`src/lib/pdf-mint/actions.ts:92-107`.** `42501`, `23514` and `P0002` are shared codes, not
app-private ones; only the `HC0D*` family guarantees the message is our pt-BR `raise`. A
GRANT/RLS denial returns `42501` with English text, and a non-flag check-constraint violation
returns `23514` with English text **that names the constraint**. *I checked reachability and
found none live*: `authenticated` holds EXECUTE on all three doors, and I walked all seven
CHECKs on `printed_documents` — the door derives or validates every column it writes, so none
is reachable through the door today. Hence MINOR, latent. **Fix:** gate on `HC0D*` only, and
map `42501`/`23514`/`P0002` to their own fixed pt-BR strings.

**MINOR-2 — The mint/revoke doors return `printed_documents` (the whole composite), which
re-opens the two withheld columns.** `mint_printed_document` and `revoke_printed_document`
are `returns printed_documents`. A function's return value is not subject to the table's
column ACL, so an `authenticated` caller invoking these directly over PostgREST receives
`storage_path` and `verification_token` — the two columns the column-list GRANT deliberately
withholds. **Honest impact: low.** The app layer discards them (`toSummary` projects only
safe fields; `revokePrintedDocument` discards the row entirely), a direct browser `mint` call
cannot succeed anyway (Amendment B requires a pre-existing object the client cannot upload),
`storage_path` is derivable per Note C, and the bucket has no client policies so the path
grants no bytes. It is nonetheless a factual channel that defeats a deliberate posture
decision, and P3 routes PHI paths through the same shape. **Fix:** narrow both to
`returns table (…)` over the granted column list, as `open_` and `lookup_` already do.

**MINOR-3 — The verification rate limiter is a global in-process counter, which converts a
scrape defence into a trivial availability lever. `src/lib/queries/printed-documents.ts:146-168`.**
`GLOBAL_LIMIT = 60` per minute is shared by **all** anonymous visitors of a process, so one
client issuing 60 requests/minute denies verification to every auditor on that instance for
the rest of the window. It is also per-process: it resets on every deploy and does not
coordinate across instances, so the effective limit is `60 × N` and the per-credential
brute-force ceiling is `5 × N`. D10 calls rate limiting "load-bearing, not polish", and the
standard shape is per-IP. Related: the module comment at `:152-154` claims the limiter's
message is shown "verbatim" by the page, but `[token]/page.tsx:84-90` catches **every** throw
into the `unavailable` state — so a rate-limited visitor is told the service is down. **Fix:**
key the budget per client IP, and either surface the limiter message as its own state or
correct the comment.

**MINOR-4 — `revoke_printed_document` checks existence before authority, creating an existence
oracle and inverting the house discipline.** The body raises `P0002 'documento não
encontrado'` *before* the `42501` authority check, so any authenticated caller can distinguish
"this registry id exists" from "it does not" for any document in any tenant. Practical impact
is negligible (ids are random v4 UUIDs and are never printed on paper by design — D10), but
`mint` in the same migration gets the ordering right (authority first, source resolution
after), so this is an inconsistency inside one file, and §7.1 names authority-first as the
structural defence that makes vacuous keystones unwritable. **Fix:** resolve the row, check
authority, then report not-found.

**MINOR-5 — `formatDateTime`/`formatDate` return their input unescaped on the unparseable
fallback, at three unescaped call sites.** `format.ts:31` and `:41` do `return iso` when
`Number.isNaN(d.getTime())`. Three call sites interpolate the result without `esc()`:
`form-response.ts:32,34` (startedAt/submittedAt), `qr-footer.ts:24` (emission.at),
`signature-block.ts:15` (signature timestamp). All four values are currently DB `timestamptz`
or a server-generated `toISOString()`, so no attacker-controlled string can reach them — this
is a latent defence-in-depth gap, not a live XSS. It matters because it is the single
exception to an otherwise exhaustive escape discipline, and P3 aims this renderer at PHI.
**Fix:** wrap the four call sites in `esc()`, or have `format*` escape its fallback.

**MINOR-6 — ADR 0104 was not amended for the four ratified deviations; the only record is in
PROGRESS.md, which rotates.** D15 states the table ships with a `printed_document_status`
**enum**; the implementation is `text` + CHECK. The other three deviations (door-derived
storage path, in-door overlay flag, service-role-only lookup + `p_viewer`) likewise differ
from the plan's §2.1 text. All four were lead-approved and are, in my judgement, *better* than
what was specified — but a reader of ADR 0104 in six months will find a decision the catalog
contradicts, which is the failure mode CLAUDE.md itself names ("a stale doc is worse than a
missing one") and which `docs/progress/*` records as recurring. **Fix:** a short Amendment
section on ADR 0104 (or a 10-line follow-up ADR) recording the four, before the PDF·P1 detail
is rotated out of PROGRESS.md.

**MINOR-7 — The one-active partial unique index is not asserted by any test.** pgTAP t23
asserts exactly one active row after a re-mint, but the only writer in the suite is the mint
door, which supersedes *before* inserting — so **dropping `printed_documents_one_active`
leaves t21–t24 green.** The index is D6's supersession anchor and the belt to the door's
braces; the belt is untested. **Fix:** an owner-level direct INSERT of a second `active` row
for an existing triple (with a correctly derived `storage_path` so the path CHECK does not
fire first), `throws_ok(…, '23505')`.

**MINOR-8 — Two door-coverage gaps in pgTAP.** (a) `revoke_printed_document` calls the flag
assert (confirmed in the catalog body) but has **no flag-off test** — t66/t67/t68 cover mint,
open and lookup only. (b) There is no `platform_admin` probe against `open_printed_document`
or against `lookup(p_viewer := admin)`. The denial is structurally derivable (both route
through `can_view_printed_document`, whose zero-rows result for that persona t18 pins) but
D11 names download explicitly, and "derivable" is not "keystoned". *Credit where due:* the
non-viewer open denial **is** covered, soundly, by t27 with t25 as its positive twin and t28
asserting no audit row on deny.

**MINOR-9 — An unknown revoke reason class renders a raw English identifier into the pt-BR UI.
`printed-documents-panel.tsx:200-202`.** The fallback is `?? value`, so a vocabulary added
server-side before the UI catches up prints `wrong_data` / `minted_in_error` to users
(Rule 10). **Fix:** a generic pt-BR fallback such as "Outro motivo".

### INFO

**INFO-1 — `section_text` markdown prints as literal source.** `pdf-payload.ts:157-159`
passes `item.content.markdown` through as a display-text label, which `section-table.ts:24`
escapes — so `## Título` and `**negrito**` appear verbatim on paper. The *security* posture is
exactly right (escaped, never raw HTML into Chromium — Rule 7's nightmare case avoided by
construction) and I would not trade it. But a document meant to carry "the same credibility
the platform gives on screen" showing markdown syntax is a fidelity gap. A minimal escape-then-
render-a-safe-subset pass (bold/italic/lists/headings only, applied *after* escaping) would
close it without reopening the surface. Worth a P2 decision, not a P1 change.

**INFO-2 — `?via=codigo` is cosmetic; the RPC tries both credential columns regardless.**
`lookup_printed_document` matches `verification_token = btrim(cred) OR verification_short_code
= upper(btrim(cred))`, and the TS passes an identical `p_credential` for both key shapes — so
`byShortCode` affects only a log string. The `[token]/page.tsx:36-39` comment reasons
carefully that trying both keys "would double the rate-limited surface and turn a failed
lookup into a weak oracle"; the backend does try both. Harmless (the two credential spaces are
disjoint by alphabet and length, and one lookup is still one budget unit), but it is a comment
asserting a property the catalog contradicts — the "a comment is an assertion that goes stale
silently" class. Reconcile one side.

**INFO-3 — Superseded renders `tone: "warning"` (amber notice) on the public page while
`printed-document-status-chip.tsx:24-27` asserts in a comment that the muted treatment is "the
same distinction the public verification page is required to preserve".** The *wording* — what
D6 actually constrains — is correct and excellent, so this is not a D6 violation; it is a
sibling comment falsified by its sibling. Align the tone or the comment.

**INFO-4 — Revoke-dialog validation failure does not move focus to the offending field.**
`FieldError` is `role="alert"` so it announces, but a keyboard user must hunt for it.

**INFO-5 — E2E coverage gaps worth a P2 spec pass**, none of which weakens a P1 claim (each
is covered at the pgTAP layer or is a default-off path): the bare `/verificar/<token>` QR path
(all four navigations use `?via=codigo`, so the *primary production path* is untested); the
`unavailable` state is never rendered, so its distinctness from `not_found` is proven in one
direction only; `RASCUNHO` (only `FINAL` is asserted); the superseded download overlay
(byte-difference is asserted only for revoked); the flag-**OFF** paths — which are the shipped
default configuration; and an authenticated-but-not-entitled download (pgTAP t27 covers the
predicate, so this is depth, not a hole).

**INFO-6 — `canRevoke={access.role === "staff_admin"}` is tautologically true.**
`submissions/[responseId]/page.tsx:138` — the page already `notFound()`s unless the role is
`staff_admin`, so the panel's false branch is unreachable and uncoverable from this route. Not
a defect (the server action re-checks, and the panel's own doc is explicit that hiding is not
the control), but it reads like a decision that isn't one.

---

## What I want on the record as done well

Reviewing this phase was harder than usual because the easy findings were already closed.
Specifically:

1. **The `form_response` arm mirrors the live policy set explicitly instead of delegating to
   invoker RLS** — and it uses the `_for` helper variants, navigating a trap (`X` vs `X_for`)
   that has burned this codebase before.
2. **Note C's rationale lives in a `COMMENT ON COLUMN`, in the catalog** — a load-bearing
   claim encoded where a future auditor reads it and where it cannot rot unnoticed.
3. **The flag precondition is asserted (t1), not set** — which structurally forecloses the
   recorded "fixture flag gap silently SKIPS keystones" failure.
4. **Authority-first with distinct SQLSTATEs throughout `mint`**, making the `throws_ok('42501')`
   keystones un-fakeable rather than merely un-faked.
5. **The overlay flag is computed in-door**, refusing a caller-supplied value the plan would
   have allowed — a deviation that tightened the door.
6. **The hand-merge headers in both findings files name the ADR 0079 Amendment 1 overwrite
   hazard** rather than silently leaving a subset run in place.
7. **The E2E spec has zero defensive branching** and a genuinely keyboard-driven flow with no
   `.focus()` — two recorded failure classes avoided by construction.

---

## Required follow-ups

Neither blocks the phase. Both should be closed **before P2 begins**, since P2 extends these
exact seams and P3 aims them at PHI:

- [ ] **MAJOR-1** — close the relative-import hole in the purity gate and re-red-team it.
- [ ] **MAJOR-2** — extend the fingerprint fixtures to cover the `final`, PHI-band and logo
      branches.

Recommended in the same pass: **MINOR-1** (HC0D*-only allowlist), **MINOR-5** (escape the
`format*` call sites), **MINOR-6** (amend ADR 0104 before PROGRESS rotation), **MINOR-7/8**
(the three test gaps).

---

*Reviewed by `qa` against the live catalog, 2026-08-07. Read-only on application code,
migrations, specs and queries; this file is the only artifact written.*

---

# Round 2 — verification of the fix wave

**Verdict: APPROVED (r2).** Both MAJORs closed. MINOR-4/5/6/7/8/9 closed. MINOR-1/2/3 deferred
by agreement and recorded below as open follow-ups.

**Date:** 2026-08-07 · **Range reviewed:** `7e9c8f6..HEAD` — `6da8e78` (ADR amendments) ·
`a33fb68` + `cb49e65` (reason-class labels) · `e53c6c9` (FIX-1…5) · `93f307a` (backend-state
P0002 sweep). 14 files, +264/−21.

**Method.** Same discipline as r1: **nothing below was accepted from a commit message.** The
purity gate was re-probed with four fresh `eslint --stdin` shapes; the revoke door was read
from `pg_get_functiondef` and its `proacl`/`prosecdef`/`proconfig` re-checked for re-emit
property loss; the index was confirmed present in `pg_indexes`; the label fallback was
property-swept rather than read. Registered migrations == files (**320 == 320**), with
`20260913000400` at the head. Re-ran `npm run lint` (exit 0), `npx tsc --noEmit` (exit 0), and
the PDF unit tests (**18 pass**, up from 16 — the two new fingerprint tests). Per instruction
the full pgTAP/E2E suites were not re-run; backend's fresh-reset 73/73 and full `test:db` PASS
stand as recorded.

## Closed

**MAJOR-1 — purity gate now cuts on the property. CLOSED.** I re-ran my r1 probes plus two
shapes the r1 finding did not use:

| probe specifier | probe file | r1 | r2 |
| --- | --- | --- | --- |
| `@/lib/supabase/server` | `src/lib/pdf/__p.ts` | error | error (no regression) |
| `../supabase/server` | `src/lib/pdf/__p.ts` | **0 problems** | **error** ✅ |
| `../../queries/printed-documents` | `src/lib/pdf/documents/__p.ts` | **0 problems** | **error** ✅ |
| `../../supabase` (bare directory) | `src/lib/pdf/documents/__p.ts` | not probed | **error** ✅ |

`eslint.config.mjs:66-98` now enumerates the relative shapes at depths 1–3 plus a
`**/lib/{supabase,queries}/**` catch-all, and the in-file comment records *why* the boundary is
the property and not a specifier syntax — which is the part that keeps the fix from rotting.

**MAJOR-2 — the fingerprint guard now pins the remaining branches, non-vacuously. CLOSED.**
`FINAL_PHI_LOGO` (`fingerprint.test.ts:90-113`) is a frozen variant with `watermarks:['final']`,
`containsPhi:true` and a real logo data-URI, recorded as
`variants.final_phi_logo = 871e8761…c304`. What earns the close is the companion test *"the
variant genuinely renders the pinned branches (no vacuous fixture)"*: it asserts the variant
HTML contains `class="wm-chip wm-chip-final"`, the confidentiality band and `<img class="lh-logo"`,
**and that the canonical HTML does not** — so the two pins are proven to cover disjoint
branches rather than merely differing. It also asserts on **markup forms rather than bare class
tokens**, with the reasoning stated inline that the CSS block defines those selectors in every
document and a token-contains would therefore be vacuous. That is the §7.1 discipline applied
by the author without being asked for it, and it is the difference between a variant and a
guard. *(My r1 text also listed `formatDate` as uncovered; on re-reading that was over-broad —
`formatDate` is a provider-side formatter whose output arrives pre-formatted in the `value`
string, not a template branch, so a fingerprint variant is the wrong instrument. Correctly
omitted.)*

**MINOR-4 — existence oracle closed, and the re-emit lost nothing. CLOSED.** The **live** body
(`pg_get_functiondef`) now merges both denials into one raise:

```sql
  select * into v_row from public.printed_documents where id = p_id;
  if v_row.id is null
     or not (app.is_staff_admin_of_for(v_row.commission_id, auth.uid())
             or app.is_commission_admin_of_for(v_row.commission_id, auth.uid())) then
    raise exception 'apenas a coordenação da comissão pode anular um documento emitido'
      using errcode = '42501';
```

I specifically checked the re-emit for the recorded "a REBUILD silently loses properties the
original carried" hazard, property by property from the catalog: `prosecdef = t` ✅,
`proconfig = {search_path=app, public, pg_catalog}` ✅, and
`proacl = {postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}` ✅ —
identical to r1. All four doors' ACLs re-checked in the same query and unchanged, `lookup_`
still service_role-only. `P0002` is gone from the **live** module surface; it survives only in
the superseded `20260913000100` file text, which is correct (applied migrations are not edited)
and is exactly why this was verified from `pg_proc`.

**MINOR-5 — the four fallbacks are wrapped. CLOSED.** `form-response.ts:32,34`,
`qr-footer.ts:24`, `signature-block.ts:15` are now `esc(formatDateTime(…))`, and `format.ts`
carries the explanation at the source of the hazard. The proof that this is a genuine no-op on
the normal path is in the diff itself: `template-fingerprints.ts`'s canonical `fingerprint`
line is **unchanged**, i.e. rendering well-formed dates through `esc` produced byte-identical
output.

**MINOR-6 — ADR 0104 Amendments A1–A6. CLOSED**, and better than asked: A1 records a residual
I had not raised (a direct RPC caller may supply his own format-valid token, degrading only his
own document's verifiability). A3 names the enum-re-key/policy-stranding defect class as the
reason for text+CHECK. The deviations are now discoverable from `docs/decisions/` rather than
from a PROGRESS section due to rotate.

**MINOR-7 — the index is now table-level law. CLOSED.** `312` t73 inserts a second `active` row
for an existing triple **as the owner** and expects `23505`. It threads the trap I flagged: the
fixture's `storage_path` is correctly derived from its id (`std/…dddd.pdf`) and `content_hash`
is 64 hex chars, so `pd_storage_path_derived` and the hash CHECK cannot fire first and steal
the SQLSTATE. Index confirmed live in `pg_indexes`:
`CREATE UNIQUE INDEX printed_documents_one_active … WHERE (status = 'active'::text)`.

**MINOR-8 — both door-coverage gaps closed. CLOSED.** t70 asserts `platform_admin` reads 0 rows
from `open_printed_document`, t71 asserts that denial emitted **no** audit row (cumulative
count still 1 — non-vacuous, since an audit-on-deny regression makes it 2). t72 covers the
fourth door's flag gate and is falsifiable by construction: it uses `sa_x`, a persona who
**would succeed** on every other check (active doc, valid reason class, non-blank reason), so
removing the flag assert produces no throw and reds the test. Choosing that persona rather than
a conveniently-denied one is the wrong-arm-fixture lesson applied correctly.

**MINOR-9 — the raw identifier is now unrenderable. CLOSED**, and property-swept rather than
patched at the one site I named. `revokeReasonClassLabel()` (`labels.ts:82-89`) falls back to
"Outro motivo", the old `?? value` helper is deleted, and the panel no longer imports the raw
array. I swept every remaining consumer: the only other one is
`revoke-document-dialog.tsx:180`, which **iterates** the closed vocabulary to render `<option>`s
and so cannot emit an unknown value. There is no surviving path from a stored class to a raw
token.

## Deferred — recorded as open follow-ups

These were deferred by agreement, not resolved. They remain open against the module and should
be picked up before P3 routes PHI paths through the same shapes:

- **MINOR-2 — returns-row re-exposure.** `mint_printed_document` and `revoke_printed_document`
  are still `returns printed_documents`, so a direct PostgREST call returns `storage_path` and
  `verification_token` — the two columns the column-list GRANT deliberately withholds. Impact
  stays low for the r1 reasons (app layer projects them away; a browser `mint` cannot satisfy
  Amendment B; the path is derivable and grants no bytes). Fix remains: narrow both to
  `returns table (…)` over the granted column list.
- **MINOR-3 — limiter granularity.** The verification limiter is still a global in-process
  counter (60/min shared by all anonymous visitors, `5 × N` per-credential across N instances),
  so one client can deny verification to everyone on an instance. The stale
  `printed-documents.ts:152` comment claiming the limiter message is shown "verbatim" is also
  unchanged — the page still collapses it into `unavailable`.
- **MINOR-1 — SQLSTATE-allowlist text mapping.** `SURFACEABLE_CODES` still allowlists `42501`
  and `23514`, which Postgres also raises in English. Still latent (no live path found in r1),
  still worth gating on `HC0D*` only.

## New in r2 (both one-line, non-blocking)

- **r2-INFO-1 — a now-dead allowlist entry.** `src/lib/pdf-mint/actions.ts:95` still lists
  `'P0002'` in `SURFACEABLE_CODES`, but after FIX-3 **no door in the module raises it**. Harmless
  (it can no longer match), but it is a stale assertion about the door surface sitting in the
  same allowlist that deferred MINOR-1 will rewrite — sweep it in that pass.
- **r2-INFO-2 — a stale count two lines below the sweep.** `docs/backend-state.md:1801` still
  reads *"pgTAP `312_printed_documents.sql` (**69**; …)"*; the suite is now **73**
  (`plan(73)`, t70–t73 added by FIX-5). The `93f307a` sweep corrected the SQLSTATE line at
  `:1797` accurately and left the count immediately below it. Exactly the class the module's own
  docs keep flagging — a number in prose that no gate checks.

## Residual on MAJOR-1, stated for honesty rather than as a finding

The relative-escape ban enumerates depths 1–3 explicitly; the `**/lib/supabase/**` catch-all
matches on the specifier text, so it does not cover a depth-≥4 relative escape. I probed it:
`../../../../supabase/server` from a hypothetical `src/lib/pdf/a/b/c/x.ts` returns **0
problems**. This is not currently reachable — `src/lib/pdf/` nests exactly one level
(`primitives/`, `documents/`), so the config already covers two levels more than exist, and
exploiting it requires inventing a three-deep subtree. I am recording it only so the next
person to deepen that tree knows the gate's edge; if it is ever worth closing properly, the
directory-based `import/no-restricted-paths` (which resolves paths instead of matching
specifier strings) is the instrument that has no depth parameter at all.

## What the fix wave did well

The wave did not merely satisfy the findings — in three places it went to the shape the
finding was *about*. MAJOR-1 was fixed as a property cut with the reasoning recorded in the
config, not as three more patterns. MAJOR-2 shipped a vacuity control proving the new fixture
covers branches the old one does not, which is the check I would otherwise have had to run
myself. t72 picked the persona that makes the assertion falsifiable rather than the one that
makes it pass. And MINOR-9 was closed by deleting the affordance (a single sanctioned label
function) instead of fixing the one call site I happened to name — which is why my property
sweep found nothing left to report.

---

*Round 2 reviewed by `qa` against the live catalog, 2026-08-07. Read-only on application code,
migrations, specs and queries; this file and the PROGRESS rows are the only artifacts written.*
