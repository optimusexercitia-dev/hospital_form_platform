# Backend State — document printing and dossiers

> Part of `docs/backend-state/` — **start at [`README.md`](README.md)**, which routes you to the
> one file you need and carries the maintenance rules in full. ⛔ A posted section is FROZEN:
> correct it by APPENDING a `⚠ **Superseded** — … See <file> § <heading>.` marker, never in place.

## Current state

**Updated:** 2026-09-09 — a REPLACEABLE projection of the frozen slices below; the rules that govern it are [`README.md` § Maintenance rules](README.md#maintenance-rules) 7–8.

### Surface

- **`public.printed_documents`** — the emission registry: polymorphic `(source_kind, source_id)` with
  **no FK**, `template_key` + `template_version`, sha-256 `content_hash`, `contains_phi`, status
  `active|superseded|revoked`, unique `verification_token` + `verification_short_code`; **no DML
  grants** (door-only writes). `verification_lookups` is the scan log — credential **HASH only**.
- **The print SERIES, not the row** — `source_series_id` + `source_revision` computed at mint and frozen; the
  one-active partial unique is keyed `(source_kind, source_series_id, template_key) where status='active'`.
- **Prévia vs emission** — ONE print action: a **locked** source yields a registered emission, anything still
  editable an **ephemeral prévia** — streamed, **no bytes at rest, no registry row**, its own audit row.
  Prévia route `src/app/api/previa/[kind]/[id]/route.ts`; emission runs `src/lib/pdf-mint/actions.ts`.
- **Four per-kind concepts, declared SEPARATELY even where they coincide** — `app.print_source_registers`
  (lock) · `_watermark` · `_series` · `_head` (+ `_revision`), each its own dispatch with a **fail-closed
  ELSE**; `app.resolve_print_source_state` resolves, `public.print_source_state` is the one gated read.
- **Renditions** — tier from `contains_phi`, bucket `documents-phi` / `documents-standard` (⚠ **no
  `printed-documents` bucket any more**). `/api/documents/[id]` is the ONLY byte path and is
  **kind-agnostic**, overlaying `SUBSTITUÍDO`/`ANULADO` on non-active serves.
- **The case dossier** — ONE fixed template rendering the whole dossier **inline**; uploaded case files
  appear only as a hashed **manifest** line. Counter: the side table `public.case_print_revisions`. Mask:
  `app.can_read_full_case_content`, seven `not exists` axes behind a **fail-closed preamble**.
- **The provider registry** — `src/lib/pdf-mint/providers.ts`; an **unregistered kind fails closed**, and
  the `case` provider's `phiCapable: true` is what makes the mint dialog offer the identified variant.
- **Doors** — `mint_printed_document` · `open_printed_document` · `revoke_printed_document` ·
  `lookup_printed_document` (**EXECUTE service_role ONLY**) · `log_document_previa` ·
  `app.can_view_printed_document` · `public.printed_document_currency`. Signatures, `prosecdef`, grants:
  [`generated-rpc-surface.md`](generated-rpc-surface.md) · [`generated-helper-surface.md`](generated-helper-surface.md).

### Invariants

- **A prévia never registers and never leaves bytes at rest.** `log_document_previa` refuses a **locked**
  source (`HC0DV`) and the route logs BEFORE it streams, so a refusal means no bytes leave; no
  `.upload()`, no mint RPC, **no temporary storage object at any point**.
- **Registration is DERIVED, never chosen, and DB-ENFORCED.** The UI derives the affordance and **the
  door refuses independently** (Rule 1); a non-registering source is refused at mint with `HC0DP`. The
  per-kind rules are decisions, not symmetry: `registers(case) = status IN ('completed','cancelled') AND
  phi_disposed_at IS NULL`, and ⭐ **`cancelled` REGISTERS for cases and is EXCLUDED for meetings.**
- **CURRENCY is a third derived axis — `registers AND head`, computed at READ TIME and NEVER STAMPED.**
  `status` keeps its meaning (deliberate acts only), so `status='active' AND NOT current` is a legal
  combination; no trigger writes it. **`null` = NOT EVALUATED**, arising only for `revoked`.
- **Compare-and-mint is a TOCTOU guard and the caller must cooperate** — `p_source_revision` must be the
  **render-time observed** revision, or `HC0DU` is **vacuous while looking correct**.
- **The terminality lock forces the case counter into a side table.** `app.guard_case_status` blocks any
  non-status update to a terminal case, yet the counter must move *exactly while the case is terminal*.
  So `case_print_revisions` has zero policies and no `authenticated` grant — that `revoke all` is
  **load-bearing, not decorative** against Supabase's default grant. **An absent row means revision 0**, so
  the client reads the value via `public.print_source_state`: under caller RLS it would read absent → 0 and
  compare `0 = 0`. ⛔ **TWO functions write this table, not one — and both COMMENTs say one.**
- **The identified / de-identified fork is `template_key`, and there is NO variant column** — `'case'` and
  `'case_identified'` supersede **independently** over one series. ⛔ **`contains_phi` is NOT the variant
  flag**: it is **constitutive** for the case kind (`containsPhi := !caseDisposed`), hence **true for every
  live case mint including the de-identified variant**. Destruction therefore keys on the **TIER** and
  download on the **VARIANT** — ⛔ gate the download on `template_key`, **NEVER `sensitivity_tier`**.
- **PHI obligation (Rule 12) — gated twice, and the user's choice is never the key.** Mint raises `42501`
  when `app.can_read_case_patient` fails; `open_printed_document` applies the same `template_key`-keyed
  refusal **by `return` — no row, no audit**; `variant` comes from what the audited door returned, not from
  the request. ⛔ **`log_document_previa` deliberately does NOT gate the identified variant** —
  `p_template_key` is a **label** there, not an authorization input — so a case prévia is reachable only
  while the case is **non-terminal, or terminal AND disposed**. `dispose_case_phi`'s registry half revokes
  **exactly the set** its bytes half destroys and **never overwrites a HUMAN revocation**.
- **Provider registration IS the activation** (ADR 0104 D15 / 0144 D12) — a new kind adds no flag, and an
  unregistered kind fails closed.

### Rollout

- Gated by the **`document_printing`** flag; a new kind adds **NO new flag** and rides it, because
  provider registration is the activation. ⛔ Resolve the flag's VALUE and its readers from
  [`generated-feature-flags.md`](generated-feature-flags.md), never from a sentence here.
- The renderer is an out-of-process **sidecar** (pinned Gotenberg image, `PDF_RENDERER_URL` +
  `PDF_VERIFICATION_BASE_URL`) — runbook [`../deployment/pdf-renderer.md`](../deployment/pdf-renderer.md).

### Open edges

- **The corridor needs a sidecar no gate starts** — `scripts/smoke/pdf-mint.smoke.ts` "needs stack + sidecar".
  ⚠ **Gotenberg egress is verified OPEN, not merely unverified**: the sanitize schema is the **sole** mitigation, egress denial PO-deferred.
- **"No registered case document can be standard-tier" is NOT held by the mint door** — no mirror refuses
  `FALSE` for `case`; the registration gate one layer up closes it
  (`FUP-MINT-KIND-TIER-RULE-ONE-DIRECTION`). **Axis C's parity is pinned by nothing in any layer**
  (`FUP-DOSSIER-CAN-SILENTLY-OMIT-CONTENT`); **`app.case_is_terminal`'s status set MUST equal the `registers(case)` arm's**, held by one pgTAP set-equality assertion and nothing else.
- **The revision-trigger set is scoped to the tables the template renders** — adding a dossier section can
  require adding a trigger, and nothing but a comment in each direction holds that coupling.
- **Two doors are UNSUPPORTED by the authz harness**, both with drilled keystones, filed in
  `supabase/tests/mutation/authz-unswept-backlog.txt`: `printed_document_currency` ·
  `open_printed_document`. ⚠ Separately, `revoked_reason_class` has **no table CHECK**.

### Where the detail lives

- The frozen slices below, in order: **§ PDF·P1** · **§ PDF·P2** · **§ PDF·P3**.
- ADR [0104](../decisions/0104-pdf-document-printing-module.md) (module) · [0111](../decisions/0111-printed-document-door-return-shape.md) (door return shape) ·
  [0125](../decisions/0125-previa-ephemeral-and-emission-registered.md) (prévia vs emission) · [0126](../decisions/0126-print-series-and-derived-currency.md) (series + currency) ·
  [0144](../decisions/0144-case-printing-dossier-lock-and-phi-fork.md) (dossier, lock, PHI fork) · [0145](../decisions/0145-print-path-markdown-is-stricter-than-screen.md) (print-path Markdown).

## PDF·P1 — PDF document printing: Forms + full skeleton (2026-08-07; ADR 0104; migrations `20260913000000`-`...000300`; flag `document_printing` **OFF** — seed forces ON local/E2E)

**A generated PDF is a RECORD (D1):** minting stores canonical bytes in Storage + one
`printed_documents` row (polymorphic `(source_kind, source_id)` — no FK, ADR D3; denormalized
`commission_id`; `template_key`+`template_version`; sha-256 `content_hash`; `contains_phi`;
status `active|superseded|revoked` text+CHECK; unique `verification_token` [≥192-bit b64url] +
`verification_short_code` [10 chars of `A-HJ-NP-Z2-9`; lookup uppercases, so case-insensitive]).
`pd_storage_path_derived` CHECK pins `storage_path = std|phi/<id>.pdf` (closes
exfiltration-by-reference against ANY writer). Partial unique = ONE active per
(source, template) — supersession's anchor. Column-list SELECT grant to authenticated
**excluding** `storage_path`/`verification_token`/`revoked_reason`/`revoked_by`; **no DML grants**
(door-only writes). `verification_lookups` = the D12 scan log (RLS on, 0 policies, 0 ACL;
credential HASH only).

- **Dispatch door** `app.can_view_printed_document(kind, id, uid)` — SECURITY DEFINER boolean,
  one arm per kind delegating to the source domain's LIVE read surface (`form_response` arm
  mirrors `responses_select` + targeted + admin chain), **`ELSE false` fail-closed**; the
  registry RLS predicate AND the doors' authority check (never invoker-RLS — inside a DEFINER
  an invoker EXISTS would run as owner, fail-open). No `is_admin()` anywhere: platform_admin
  reads 0 rows, mints/opens/revokes nothing (D11 noun rule; keystoned).
- **Doors** (authenticated+service_role; census verdicts COVERED, 2026-08-07). ⚠ Since
  `20260921000100` (FUP-PDF-3, ADR 0111) mint + revoke `RETURNS public.printed_document_public` —
  the composite mirroring the authenticated column-list GRANT exactly; `verification_token` /
  `storage_path` / `revoked_by` / `revoked_reason` never leave the doors (pgTAP `323`).
  `mint_printed_document(p_id, kind, source, template_key, template_version, content_hash,
  token, short_code, contains_phi)` — authority = the dispatch; PHI refused in P1 (`HC0D2`);
  format-validates the action-minted credentials (Amendment A; collision `HC0D4` → the action
  re-mints); verifies the storage OBJECT exists first (Amendment B, `HC0D3`); supersedes prior
  actives in-transaction; audits `document.minted`. `open_printed_document(p_id)` — the serving
  route's core: call-time authority, no-row-no-audit on deny, audits `document.downloaded`
  (`overlay_applied` computed in-door). `revoke_printed_document(p_id, class, reason)` —
  staff_admin/commission-admin chain only, NOT the minter; `HC0D1` validation, `HC0D5`
  already-revoked; audits `document.revoked`. `lookup_printed_document(credential, p_viewer)` —
  **EXECUTE service_role ONLY** (the app-layer rate limiter in
  `src/lib/queries/printed-documents.ts` fronts the only call path); anemic D10 tuple;
  `document_id` only for a source-visible `p_viewer`; writes the scan log.
- **Storage:** bucket `printed-documents` (private, 25 MB, `application/pdf`,
  prefixes `std/` now + `phi/` from P3) with **ZERO storage.objects policies** — service-role
  only; the serving route `/api/documents/[id]` is the ONLY byte path (D8), applying the
  pdf-lib `SUBSTITUÍDO`/`ANULADO` overlay on non-active serves (canonical bytes stay
  hash-faithful; `active` serves are byte-identical).
- **App layer:** pure renderer `src/lib/pdf/` (ESLint `no-restricted-imports` purity gate;
  embedded IBM Plex data-URI faces via `scripts/generate-pdf-fonts.mjs`; template
  fingerprints per D4 in `template-fingerprints.ts` + proven-detecting test); providers
  registry `src/lib/pdf-mint/providers.ts` (P1: `form_response` only; unregistered kind fails
  closed); mint pipeline `src/lib/pdf-mint/actions.ts` (3-permit semaphore, 30 s Gotenberg
  budget, upload-before-RPC + delete-on-failure — all-or-nothing D5); provider
  `src/lib/forms/pdf-payload.ts` (caller-session Rule 9 reads; wizard-mirror visibility via
  `evalVisibility`; signoffs → attestation blocks D13). Sidecar: pinned
  `gotenberg/gotenberg:8.24.0`, `PDF_RENDERER_URL` + `PDF_VERIFICATION_BASE_URL` env —
  runbook `docs/deployment/pdf-renderer.md`.
- **SQLSTATEs:** `HC0D1` validation · `HC0D2` PHI-mint refused · `HC0D3` storage object
  missing · `HC0D4` credential collision (retry signal) · `HC0D5` already revoked ·
  authority `42501` · flag-off `check_violation`. **No `P0002` anywhere** (since
  `20260913000400`, QA MINOR-4): not-found is indistinguishable from denial by design —
  revoke MERGES it into the 42501 raise, open returns no-row-no-audit, lookup answers
  `matched=false`. No door is an existence oracle.
- **Tests:** pgTAP `312_printed_documents.sql` (73; fail-closed ELSE + platform_admin denial
  keystones; A33 drills D1–D6 RED-proven) + `323_printed_document_door_return_shape.sql`
  (13; FUP-PDF-3 red-first keystones + DROP+CREATE property-preservation controls);
  Vitest fingerprint/overlay/semaphore/lookup
  (`p_viewer` declared-param pin + rate-limit pin); e2e smoke
  `scripts/smoke/pdf-mint.smoke.ts` (`vitest.smoke.config.ts`; needs stack + sidecar).
- ⚠ `hospitals_select` has NO member arm (catalog, 2026-08-07) — letterhead names resolve via
  the caller-pre-authorized service-role read in `getResponsePrintContext` (step 1 proves
  source visibility under the caller's own RLS; step 2 reads two display names). If a member
  arm ever lands on `hospitals`, that helper can collapse to one query.

## PDF·P2 — Prévia (ephemeral) vs Emission (registered), print SERIES, derived CURRENCY (2026-08-19; ADR 0125 + 0126 incl. 0125 Am. 1/2 and 0126 Am. 1; migrations `20260928001000`–`...001500`; flag `document_printing`)

**Registration is DERIVED, never chosen (0125 D1), and it is DB-ENFORCED.** A **locked** source
yields a registered emission; anything still editable yields an **ephemeral prévia** — streamed,
**no bytes at rest, no registry row**, its own audit row. There is ONE print action; the UI derives
the affordance and **the door refuses independently** (Rule 1 — never rely on UI hiding).

**Four per-kind concepts, declared SEPARATELY even where they coincide** (0126 D7 + round 2):
`app.print_source_registers` (lock) · `app.print_source_watermark` · `app.print_source_series` ·
`app.print_source_head` (+ `app.print_source_revision`). Each is its own dispatch with a per-kind
CASE and a **fail-closed ELSE** — deliberately NOT new branches inside `mint_printed_document`,
whose body forbids a fourth kind-conditional site. `app.resolve_print_source_state` is the shared
resolver; `public.print_source_state` is the one gated read the UI calls.

- **`form_response` registers ⇔** `status='submitted'` **AND NOT** the draft of an open,
  still-rejectable correction (`case_correction_requests.status in ('resubmitted','under_review')`)
  **AND NOT** attached to a `voided` phase. The **watermark moves in TANDEM** (0125 Am. 2), so
  D5's fourth cell (FINAL + prévia footer) stays unreachable.
- **`meeting` registers ⇔** `status in ('in_signature','signed','distributed')` **AND**
  `phi_disposed_at is null`. ⛔ `cancelled` is locked but **excluded by decision**.
  ⚠ `meetingWatermarkFor` is **UNCHANGED** — an `in_signature` ata registers **stamped RASCUNHO**.

**A print belongs to a SERIES, not a row (0126 D1).** `printed_documents` gains
`source_series_id` + `source_revision` (both computed at mint, frozen); the one-active partial
unique index re-keys `(source_kind, source_series_id, template_key) where status='active'`, and
the mint's `SUPERSEDE_ACTIVE` update moved to the series column. Closes a live defect: after one
correction, R1 and R2 could **both** hold an `active` print. `responses.supersedes_id` is now
**IMMUTABLE** (`app.guard_supersedes_id_frozen`, `HC0DT`); `guard_supersession_coherent_trg`
narrowed to `BEFORE INSERT`. ⚠ `225`'s escalation pin keeps **three INSERT-path homes**
(`14a`/`14b`/`14d`) — `14c` converted to the immutability pin, NOT a code swap.

**CURRENCY is a third derived axis (0126 D2/D3): `registers AND head`, computed at READ TIME and
NEVER STAMPED.** `printed_documents.status` keeps its meaning — deliberate acts only — so
`status='active' AND NOT current` is a new legal combination. ⛔ No trigger writes it; only the
mint and revoke write the table. `lookup_printed_document` gains `is_current`;
`public.printed_document_currency(uuid[])` is the batch read. **`null` = NOT EVALUATED**, arising
only for `revoked`, which keeps the **no-join independence** `312` t76 pins.
`meetings.revision` is bumped **only** by `reopen_meeting`; meeting head = revision match.
`form_response` head = **no successor that has TAKEN EFFECT**, per lane — phase-bound: its
correction request is `approved`; standalone: the successor is `submitted` (0126 Am. 1 §A,
reusing `app.submitted_form_responses`' own rule).

**New doors + guards (12 new `prosecdef` gates, all with explicit `proacl`, none NULL):**
`public.log_document_previa` (`HC0DV` refuses a **locked** source; the route logs BEFORE it
streams, so a refusal means no bytes leave) · `app.guard_meeting_active_print` (BEFORE DELETE on
`meetings`, the symmetric of `guard_response_active_print`) · the four dispatches + resolver +
`print_source_state` + `printed_document_currency` + `printed_document_is_current` +
`guard_supersedes_id_frozen`.

**New SQLSTATEs:** `HC0DP` (source does not register — the mint refuses) · `HC0DU`
(compare-and-mint: observed revision ≠ current) · `HC0DV` (locked source refused a prévia) ·
`HC0DT` (`supersedes_id` frozen).

⚠ **Compare-and-mint is a TOCTOU guard and the caller must cooperate.** `mint_printed_document`
gained `p_source_revision`; the value must be the **render-time observed** revision, carried on
`DocumentPayload.sourceRevision` across the render window exactly as `containsPhi` is. A fresh
read at submit hands the door its own current value and makes the check **vacuous while looking
correct**. `src/lib/pdf-mint/actions.ts` imports **no** source-detail query, so a fresher value is
structurally unreachable.

**Route:** `src/app/api/previa/[kind]/[id]/route.ts` — `resolve → render → LOG → stream`. No
`.upload()`, no mint RPC, **no temporary storage object at any point** (0125 D4 rejects that
variant by name). Shares `mintSemaphore` at 3 permits with a materially shorter acquire, so the
prévia is the one that yields (D9).

**Shared SQL↔TS contract:** `src/lib/queries/__fixtures__/print-source-registers-vectors.json`
(20 vectors, 3 kind-scoped flags) compiles via `scripts/gen-print-source-vectors.mjs` to
`supabase/tests/vectors/print_source_registers_vectors.psql`. ⚠ The **`.psql` extension is
load-bearing** — `pg_prove` globs `*.sql` and would collect it as a planless test and fail the
run; `\ir` takes an explicit path. `*.psql text eol=lf` added to `.gitattributes`.

**Keystones:** `344` (both predicates over all 20 vectors + kind-scoping) · `345` (the prévia
audit door, two-sided) · `346` (currency two-sided **per conjunct**, `guard_meeting_active_print`
with the t76/t80 differential, the locked-source refusal, and the `form_response` head arm
two-sided **per lane**) · `312` §9/§10 rebuilt **table-level** (the mint can no longer construct
that state) with the differentials preserved · `313` t55–t58r over a **real stored**
`source_revision`.

⚠ **Two doors are UNSUPPORTED by the authz harness, both with drilled keystones** — see
`supabase/tests/mutation/authz-unswept-backlog.txt`: `printed_document_currency` (its gate is a
WHERE-clause **conjunct**, which is correct for per-row filtering and outside the mechanism) and
`open_printed_document` (**two independent gates**; the kernel's `can_read_document` refuses by
RAISING, which aborts the transaction mid-file so the run shape stops matching baseline — the
suites notice **emphatically**, 312 fails 64/90).

## PDF·P3 — the case DOSSIER: terminality lock, a per-case revision counter, and the identified / de-identified fork (2026-08-25; ADR **0144** + **Amendments 1–6** + ADR **0145**; migrations `20261003002200`–`…002800`, **7**; pgTAP **`368` `plan(58)`** new + `344` `plan(110)` · `313` `plan(59)` · `229` `plan(85)` · `356` `plan(78)` updated; **NO new flag** — rides `document_printing`, and per ADR 0104 D15 / 0144 D12 **provider registration IS the activation**)

⚠ **NOT a completed phase — re-measure before quoting.** QA **APPROVED** at pass 2
(`docs/reviews/phase-p3-review.md`), but the approval is **explicitly conditional** on the PO
accepting gate 2 at **RED (UNRUN)**: 36 specs did not run, all in batch 6, all in files P3 never
touched (the pre-existing Windows standalone collapse; P3's own spec ran 11/11, zero assertion
failures). **PO phase-approval NOT given** — the 2026-08-25 ruling authorised gate step 3 only —
and NOT PUSHED at the time of writing — ✅ **PUSHED 2026-08-25**. Record step not run at the time of writing.

**The artifact is ONE fixed template rendering the WHOLE dossier (D1/D2)** — phase answers,
narratives, interviews, the referral frozen snapshot + reply, timeline, outcomes, action items,
corrections and participants **inline**; uploaded case files appear only as a hashed **manifest**
line (Gotenberg renders HTML and cannot inline a PDF/JPEG). ⛔ No per-mint section picker: it would
break `src/lib/pdf/template-fingerprints.ts` determinism. The ADR 0125 prévia/emission lane and the
ADR 0126 series/currency machinery apply unchanged; P3 adds the `case` kind to them.

### `public.case_print_revisions` — the counter is a SIDE TABLE, and that is forced

D4 wanted a `meetings.revision` analogue on `cases`; **it cannot live there.**
`app.guard_case_status` (BEFORE UPDATE, catalog-measured) raises `check_violation` —
*"cases in a terminal state are immutable (update blocked)"* — on **any non-status update** to a
`completed`/`cancelled` case unless `app.in_case_rpc` is `on`. D15 needs the counter to move
**exactly while the case is terminal**, i.e. precisely when that guard forbids writing it. ⛔ The
rejected repair was setting `app.in_case_rpc` in the bump trigger: that GUC also unlocks **status
transitions** and routes every bump through `audit_cases_trg`, filing a `case.updated` audit row for
a tag rename (ADR 0144 Amendment 4).

Measured 2026-08-25 (`pg_attribute` / `pg_class` / `pg_policy` / `pg_constraint` / `pg_indexes`):

| fact | value |
| --- | --- |
| columns | `case_id uuid` PK · `revision integer not null default 0` · `updated_at timestamptz not null default now()` — **three, no more** |
| RLS | `relrowsecurity = t`, `relforcerowsecurity = f`, and **ZERO policies** |
| `relacl` | `{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}` — **no `authenticated`, no `anon`, no column-list grants**. `has_table_privilege('authenticated', …, 'select')` = **f** |
| constraints | `case_print_revisions_pkey (case_id)` · `_revision_check CHECK (revision >= 0)` · `_case_id_fkey → cases(id) ON DELETE CASCADE` |
| triggers on it | **0** |

⭐ The `revoke all` is **load-bearing, not decorative**: Supabase's default privileges DO grant
`authenticated` ALL on a new `public` table, so the absence of a grant here is an *act*.
**An absent row means revision 0** — the one definition, in `app.print_source_revision`.

⚠ **Because the table is ungranted, the client cannot read the counter it must feed to
compare-and-mint.** `public.print_source_state` therefore carries it: measured
`pg_get_function_result` = `TABLE(status text, correction_open boolean, phase_voided boolean,
meeting_disposed boolean, case_disposed boolean, source_revision integer)`. The B-side
**generated types** (`git show origin/main:src/lib/types/database.ts`, a catalog-derived artifact,
not migration text) list only `correction_open · meeting_disposed · phase_voided · status` — so
**both** `case_disposed` and `source_revision` are P3 additions. Reading the revision under the
caller's own RLS instead would return **absent → default 0**, and the door would compare `0 = 0`:
`HC0DU` **vacuous while looking correct**.

⛔ **TWO functions write this table, not one — and both COMMENTs say one.** Measured by regexing
`pg_get_functiondef` across `app`+`public` for a write to `public.case_print_revisions`:
`app.bump_case_print_revision` **and** `app.trg_bump_case_revision_self`. The second inlines its own
`insert … on conflict` rather than delegating, and the reason is structural: it fires `AFTER UPDATE`
on `cases` and keys on **`old.status`**, because on a `reopen_case` (completed → active) the central
function's own `app.case_is_terminal` guard reads the **post-update** row, answers false, and would
skip the bump on the way *out* of terminal — the one transition D4 exists for. The shape is correct;
the two comments (`COMMENT ON FUNCTION app.bump_case_print_revision` — *"The ONE writer"* — and
`COMMENT ON TABLE public.case_print_revisions` — *"Written ONLY by app.bump_case_print_revision"*)
are **stale as written**. Do not reason from "one writer" that the terminal-only guard is
centralized: it is not.

### The 27 gates — 15 brand new + 12 same-signature body replacements

Two-sided catalog diff in [`docs/progress/pdf-p3-reconciliation.md`](../progress/pdf-p3-reconciliation.md)
(two `db reset` runs, keyed on **`oid::regprocedure`** — never `proname`, which collapses overloads).
Its correction is the methodology point worth keeping: an earlier *"17 brand new"* was wrong because
**a `create or replace` of a pre-existing function is indistinguishable from a creation in migration
text**. Re-verified here 2026-08-25 on the A-side: `pg_proc` in `app`+`public` = **1025**,
`prosecdef = t` = **825** (810 + 15, so the parts sum), NULL `proacl` = **228**, `pg_policies` =
**282**, RLS **169 / 169** `public` tables.

- **15 new**, all `prosecdef = t`, all `proacl = {postgres=X/postgres}` (no `authenticated`, no
  PUBLIC): `app.case_is_terminal(uuid)` · `app.bump_case_print_revision(uuid)` ·
  `app.can_read_full_case_content(uuid,uuid)` · the **12** `app.trg_bump_case_revision*()` trigger
  functions.
- **12 replaced**, `prosecdef`/`proacl` unchanged in **0 of 12**:
  `app.can_view_printed_document` · `app.print_source_{registers,watermark,series,revision,head}` ·
  `app.resolve_print_source_state` · `public.{print_source_state,mint_printed_document,
  log_document_previa,open_printed_document,dispose_case_phi}`.
  ⚠ **"Same-signature" is a statement about the KEY, not about the shape.** `oid::regprocedure`
  renders IN arguments only, so two of these actually changed their result contract and were
  DROP+CREATEd: `app.resolve_print_source_state` gained an **`OUT o_case_disposed boolean`** (visible
  in `pg_get_function_arguments`, invisible in `regprocedure`) and `public.print_source_state` gained
  **two return columns**. `002700`/`002800` re-issue the ACLs the DROP+CREATE would otherwise revert;
  the NULL-`proacl` census being **228 on both sides** is the evidence they held.
- **0 signatures removed**, **0 policy lines changed in either direction** (`USING` and `WITH CHECK`
  compared separately, with a positive control on the differ), **+23 triggers, 0 removed**.

**The D15 trigger set: 23 triggers → the 12 handlers, and every handler is reached.** All
`tgenabled = 'O'`, all `AFTER ROW`, none carrying a `WHEN` clause. Measured spread:
`action_items` · `answers` (**three** triggers — `_ins`/`_upd` via `…_answers_new`, `_del` via
`…_answers_old`) · `case_correction_requests` · `case_events` · `case_interview_interviewers` ·
`case_interview_subjects` · `case_interviews` · `case_narrative_types` · `case_narratives` ·
`case_outcomes` · `case_participant_roles` · `case_participants` · `case_phases` · `case_referral` ·
`case_tag_assignments` · `case_tags` · `case_types` · `cases` (the `_self` handler) · `documents` ·
`meeting_cases` · `patient_identifiers`. The generic `app.trg_bump_case_revision()` takes the
FK column name as **`tg_argv[0]`** and bumps for OLD and NEW, so one body serves 10 tables.
⚠ **D15's set is scoped to the tables the template renders** — adding a dossier section can require
adding a trigger, and nothing but a comment in each direction holds that coupling.

⛔ **The `printed_rendition` exclusion in `app.trg_bump_case_revision_documents` is what makes case
minting possible at all.** `mint_printed_document` inserts the print's own `public.documents` row
with `kind = 'printed_rendition'` **homed on the source** (`home_resource_id = p_source_id`, the case),
inside the mint transaction and *after* compare-and-mint has passed. Without the `if v_rec ->> 'kind'
= 'printed_rendition' then return null` guard, that insert bumps the counter past the
`source_revision` the same transaction is storing ⇒ **every case mint lands NOT-CURRENT the instant
it succeeds**, and the unauthenticated `/verificar` reports *"não é mais a atual"* on paper whose ink
is still wet. A Postgres trigger `WHEN` clause cannot express it, which is why it is in the body.

### `app.can_read_full_case_content(p_case_id, p_uid)` — the seven-axis mask predicate

`prosecdef = t`, `STABLE`, `proacl = {postgres=X/postgres}` (**not** EXECUTE-able by
`authenticated`), `search_path = app, public, pg_catalog`, and it carries the `COMMENT ON FUNCTION`
ADR 0104 A7 has long owed its sibling. **Fail-closed preamble ahead of all seven axes** (null uid,
null case, unknown case → false) — stated explicitly rather than inherited, because each axis is a
`not exists` block and every one of them is **vacuously true on zero rows**: the fail direction lives
in the preamble, not in the axes.

| axis | what it refuses on |
| --- | --- |
| **A** | `read_case_content` **and** `read_case_deliberation` capabilities — the oversight-only reader (S7 quality reviewer, S8 `administrativo` on a locked case) gets titles, never bodies, so it must not mint bytes containing bodies |
| **B** | any `case_events` row with `visibility <> 'case_readers'`, unless caller `is_staff_admin_of_for` the commission |
| **C** | ⭐ any `case_phases.current_response_id` whose response fails `app.can_view_printed_document('form_response', …)` |
| **D** | any `case_interviews` row failing `app.can_read_interview` |
| **E** | case-linked `action_items` — mirrors `action_items_select`'s `case_restricted` and `assignees_only` scopes (`committee` needs no arm) |
| **F** | any `meeting_cases` link failing `app.can_reach_meeting` |
| **G** | any `case_referral` failing `app.can_read_referral` (**content**, not `_metadata` — the dossier renders the snapshot and the reply) |

⭐ **Axis C reuses the `form_response` arm of the print dispatch rather than restating the
`responses_select` disjunction** — one authority for one rule. ⚠ It **looks** recursive and is not:
`can_view_printed_document`'s `case` arm calls this function, this call re-enters the dispatch with
kind `'form_response'`, and that branch calls nothing here. Depth **2**, fixed.

⭐ **Axis C's gated set is a SUPERSET of the set the dossier inlines, and that is the answer to
"does the dossier widen print reach?".** Catalog-measured 2026-08-25: Axis C ignores `cp.status`
entirely, while `public.get_case_detail` yields a `response_id` only for
`cp.status in ('completed','awaiting_signoff')`. The TS half closes the chain — the payload inlines
answers in exactly one place (`buildCasePayload`'s phases leg) and its only response-selecting
predicate is `phase.responseId !== null`, i.e. the envelope's already-narrowed value; an unreachable
response yields an **answer-less phase, not a failure**. So
inlined ⊆ {envelope `response_id`} ⊆ {`current_response_id`} — the dossier is **narrower** than what
the axis demands entitlement for, i.e. narrowing-safe. QA settled the parity empirically at
**975 cells** (75 persona×hat combos × 13 responses) → **0 DOOR_YES/POLICY_NO, 0 DOOR_NO/POLICY_YES**,
with both controls proven able to move (drop the `is_staff_admin_of_for` arm → 11; widen to any
member → 171). ⛔ **Read the trap before re-running it:** QA's first matrix reported 11 false
findings because the door side was evaluated as **`postgres`** — under which `app.has_role`'s closing
act-as **hat** clause (`p_user_id is distinct from auth.uid() or …`) is **vacuously satisfied** since
`auth.uid()` is NULL. Both sides must run as `authenticated` under identical
`request.jwt.claims`. ⚠ The parity itself is pinned by **nothing** in any layer
(`FUP-DOSSIER-CAN-SILENTLY-OMIT-CONTENT` / the owed cross-kind vector).

### The variant is `template_key`, and there is NO variant column

⭐ **ADR 0144 Amendment 1: the carrier already existed.** Measured — `printed_documents_one_active`
is `UNIQUE (source_kind, source_series_id, template_key) WHERE status = 'active'`, and
`mint_printed_document`'s supersede statement is likewise scoped `and template_key = p_template_key`.
So `app.print_source_series('case', id)` returns **the case id for both variants**, takes no variant
argument and needs none, and `'case'` / `'case_identified'` supersede **independently** over one
series — which is what lets a de-identified dossier printed for an auditor coexist with a valid
identified one instead of `/verificar` calling the latter "superseded" on an unauthenticated page.
**No signature change, no new kind-conditional site.** D7's *"the series keys on (case_id, variant)"*
is amended to `(case_id, template_key)`. `printed_documents_source_kind_check` already admitted
`'case'` (and `'interview'`) from P1, so no CHECK moved.

⛔ **`contains_phi` is NOT the variant flag.** ADR 0144 **Amendment 5** makes it **constitutive** for
the case kind — the provider sets `containsPhi := !caseDisposed`, so it is **true for every live case
mint including the de-identified variant** — and the mint derives the tier from it verbatim:
`v_tier := case when coalesce(p_contains_phi,false) then 'phi' else 'standard' end`,
bucket via `app.printed_rendition_storage_bucket(boolean)` → `documents-phi` / `documents-standard`,
path via `app.printed_rendition_storage_path(uuid)` → `'printed/' || id || '.pdf'`. ⚠ There is **no
`printed-documents` bucket any more** — DM5·S3 moved renditions onto the two core buckets; measured
`storage.buckets` = `documents-phi` · `documents-standard` · `form-assets` · `meeting-audio`.

**Three gate sites know the template key, and each is deliberate:**

- `mint_printed_document`, **trio site 3** (PHI capability — *not* site 1, template coherence, whose
  job is exactly one thing): `if p_source_kind = 'case' and p_template_key = 'case_identified' and
  not app.can_read_case_patient(p_source_id, v_uid) then raise … '42501'`. Runs **before** template
  coherence so an unauthorized identified mint answers 42501 rather than HC0D1. Site 1 gained
  `if p_source_kind = 'case' and p_template_key not in ('case','case_identified') then HC0D1`; site 2
  gained `v_commission := app.commission_of_case(...)` with **no `for key share` twin** (a case is not
  discardable, so ADR 0123 D3's ordering has no case analogue — the terminal freeze plus the D15 bump
  order the mint instead).
- `open_printed_document`, the download half of A7: the same `template_key`-keyed refusal, **by
  `return` — no row, no audit**, so the serving route yields a 404 indistinguishable from
  nonexistent. It is needed because `app.resolve_document_version_bytes` gates case-homed bytes on
  `read_case_deliberation` and carries **no PHI-tier term** for the `case` home (the `case_referral`
  home right below it does).
- ⛔ **`log_document_previa` deliberately does NOT gate the identified variant.** `p_template_key` is
  a **label** there, not an authorization input; the door's authority is the kind-agnostic
  `can_view_printed_document` call plus `HC0DV` (a **registering** source may not be previewed).
  Consequence for the case kind, stated in the body: a case prévia is reachable only while the case is
  **non-terminal**, or **terminal AND disposed**.

⛔ **`template_key`, NEVER `sensitivity_tier`, on the download side** — Amendment 5 makes the
de-identified variant phi-tier too, so a tier-keyed gate would refuse it to exactly the readers it
exists for.

### The lock: `registers(case) = status IN ('completed','cancelled') AND phi_disposed_at IS NULL`

`app.resolve_print_source_state` gained the `o_case_disposed` OUT param and reads
`c.status, c.phi_disposed_at is not null` **together, reporting them separately** — the status term
alone cannot see a disposal, exactly as for a disposed meeting. The `case` arms of
`print_source_registers` and `print_source_watermark` then **write the same two conjuncts out twice**
(ADR 0125 D8 / 0126 D7 forbid factoring the axes: for `meeting` they genuinely separate, since an
`in_signature` ata registers stamped RASCUNHO). ⭐ The disposal term is the **tandem** move and it is
forced — in registration only, a `completed` + disposed case would be `registers=false` +
`watermark='final'`, ADR 0125 D5's forbidden **fourth cell** reached.

⭐ **`cancelled` REGISTERS for cases and is EXCLUDED for meetings, and both are decisions.** A
cancelled meeting has no minutes to pin; a cancelled case has a complete process record and is
terminal-**forever** (`reopen_case` refuses it with `HC0M8`), so its currency claim is unconditional.
`completed` is a lock point only because `reopen_case` is the single door out of it — catalog-measured
2026-08-25, **4** functions write `cases.status`: `app.recompute_case_status` returns early under an
explicit "never override a manual terminal status" guard, `cancel_case` raises `HC025` on any
terminal (so completed→cancelled is unconstructible), `close_case` is the way in, `reopen_case`
requires `completed`. And `reopen_case` changes `status` — a dossier-visible column — so the `cases`
trigger brackets the whole non-terminal window.

⚠ **`app.case_is_terminal`'s status set MUST equal that arm's.** They are declared separately because
0125 D8 forbids the shared helper, so **nothing but pgTAP `368` t14's set-equality assertion holds
them together**. Widen one without the other and content drift on the new status goes unbumped while
`/verificar` keeps claiming currency.

`app.print_source_head`'s `case` arm is the revision match, **shaped differently from the meeting arm
on purpose**: a meeting's `revision` is a NOT NULL column, a case's lives in a side table where an
absent row means 0, so an inline `exists (select 1 from case_print_revisions …)` would report **every
fresh print as not-current**. It calls `app.print_source_revision('case', …)` — the single definition
of absent-is-0, the same one the mint stores — after a separate existence check on `cases` (without
which an unknown case would compare `0 = 0` and answer TRUE).

### `dispose_case_phi` — blocks (f) and (f2), and the conjunct that made C-1 load-bearing

- **(f)**, pre-existing: case-homed `documents` redact (`title = '[PHI removido]'`, `description =
  null`) and every **phi-tier** bound `file_objects` row enters the D10 two-phase machine
  (`disposal_state = 'disposal_pending'` + `disposal_reason_category`). ⭐ Because
  `mint_printed_document` homes the print's own `documents` row on the **case**, this block already
  covered a case's printed renditions — the **bytes** half of D10 needed no new statement.
- **(f2)**, new: the registry half.
  ```sql
  update public.printed_documents
     set status = 'revoked', revoked_at = now(), revoked_by = auth.uid(),
         revoked_reason_class = 'phi_disposed', revoked_reason = 'Descarte de dados … ' || p_reason
   where source_kind = 'case' and source_id = p_case_id
     and contains_phi                -- ⭐ EXACTLY the set (f) destroys
     and status <> 'revoked';        -- ⭐ never overwrite a HUMAN revocation
  ```
  Placed **before** block (h) sets `phi_disposed_at`, so it is independent of any present or future
  guard keyed on that column. Superseded rows **are** included (their bytes go too). `revoked_by` is
  provably non-null because the door's authority check routes `app.is_staff_admin_of`, which refuses a
  null `auth.uid()` — that is what satisfies `pd_revocation_complete` instead of raising mid-erasure.
  New `revoked_reason_class` value **`phi_disposed`**, deliberately **not** added to
  `revoke_printed_document`'s vocabulary (a human must not be able to claim an Art. 18 erasure);
  ⚠ measured — `revoked_reason_class` has **no table CHECK**.
- ⚠ **Two discriminators, deliberately different.** Destruction keys on the **TIER** (what could be
  in the bytes); download keys on the **VARIANT** (what this reader may see). Collapsing them either
  leaks PHI or breaks the de-identified variant, because Amendment 5 makes `contains_phi` true for
  **both**.

### ⭐ An invariant, and the mechanism that is actually holding it up

**"No registered case document can be standard-tier"** is true today and is **NOT held by the mint
door.** Measured: `mint_printed_document`'s `p_contains_phi` **defaults to `false`**, the door refuses
`TRUE` for `form_response` (`p_source_kind not in ('meeting','case')` → `HC0D2`) and has **no mirror
refusing `FALSE` for `case`**; `v_tier` is derived from the caller's value with **no cross-check
against `print_source_registers`**. What closes it is the **D3 registration gate** one layer up:
a disposed case does not register (`HC0DP`), and the provider's constitutive
`containsPhi := !caseDisposed` means every *registering* case mint is phi-tier. QA proved the
complement through the real door (rolled back): `contains_phi = false ⟺ caseDisposed ⟺ HC0DP`.
⛔ So the DB refuses the **disposed case**, never the **value `false`** — any future derivation for
`containsPhi` reopens standard-tier for a **live** case with nothing in the catalog objecting. Owed
fix filed as **`FUP-MINT-KIND-TIER-RULE-ONE-DIRECTION`** (owner backend):
`if p_source_kind = 'case' and not coalesce(p_contains_phi,false) then raise`.
*"Not reachable today is not protected."*

**Other invariants standing on a mechanism outside their own layer** — state the mechanism whenever
quoting them: the seven axes' fail-closed property lives in the **preamble**, not the axes ·
`can_read_full_meeting_content` remains **fail-open standalone** (safe only behind its reach
conjunct; P3 paid its long-owed `COMMENT ON FUNCTION`) · `case_print_revisions`' isolation rests on a
`revoke all` beating Supabase's **default grant** · D9's PHI-read-emission half and Amendment 2's
"de-identified read goes through the audited door" are pinned by **exactly two E2E assertions** and
are structurally unpinnable in pgTAP (the PHI read happens in TypeScript, before any RPC) · Axis C's
parity is pinned by nothing.

### Authz-sweep coverage of this surface — state it before quoting a green ARM

- ⭐ **`ARM=census` is what surfaced `app.case_is_terminal` the day it landed** — a brand-new gate is
  in no BLIND set and passes `ARM=policy` **vacuously** (ADR 0079 Amendment 3).
- `app.case_is_terminal(p_case_id uuid)` is filed in
  `supabase/tests/mutation/authz-unswept-backlog.txt` under the **strong** `helper:` claim, and the
  justification is structural, not judgement: it **takes no subject** (no uid parameter, no
  `auth.uid()` in the body), its only consumer gates *when a monotonic counter moves*, and **zero**
  RLS policies reference it (`pg_policies` swept). ⛔ **Format trap recorded there:** `allow_body()`
  reads each non-comment line **verbatim** as a gate signature, so a literal `helper: ` prefix makes
  the line match nothing and the gate reappears as a **GHOST** — the `helper:` claim goes in the
  comment, the bare signature on its own line.
- The other 14 new gates and all 12 replacements are in **neither** the backlog nor the blind
  allowlist. The two carried-over unsupported doors from P2 (`printed_document_currency`,
  `open_printed_document`) are unchanged.
- Phase-1 arms and the diff-scoped sweep are recorded in the phase's own progress detail; ⛔ they are
  historical the moment the tree moves — the **reconciliation** is what let them stand, by proving the
  27-name scope was the complete catalog delta.

### App layer (the pure-renderer purity gate still holds)

`src/lib/pdf/documents/case.ts` (the template) + `primitives/table-of-contents.ts` (the one new
primitive, rendered **unconditionally** — conditional rendering is D1's fingerprint problem in
another costume) + `documents/print-source.ts` (the two D3 arms written out twice, `caseDisposed` on
`PrintSourceState`) + `render.ts` (`TEMPLATES.case`, `templateFor`) + `markdown.ts`.
`src/lib/cases/pdf-payload.ts` — `buildCasePayload`, `resolvePatients` the single fork point (nulls
the five identified fields in TS), and `containsPhi = !context.caseDisposed` as a **single term**
under a ⛔ "do not restore a presence derivation here" block.
`src/lib/queries/printed-documents.ts` — `getCasePrintContext(caseId): Promise<CasePrintContext |
null>` (`{commissionName, hospitalName, status, caseDisposed, revision}`, `caseDisposed`
non-nullable) **returns null rather than coalescing**, with a runtime `typeof` check on
`case_disposed`/`source_revision`/`status`: caller-RLS visibility probe → the `print_source_state`
door → admin client for the two display names only. `src/lib/pdf-mint/providers.ts` registers the
`case` kind with **`phiCapable: true`** — the first provider to carry it, and the only thing that
makes the mint dialog offer the identified variant.

⭐ **The user chooses `includePhi`; the KEY is never that choice.** `resolvePatients` sets
`variant` from what the audited door actually returned (throwing on a request it cannot honour rather
than silently downgrading), and `templateFor(payload.body)` in `src/lib/pdf/render.ts` maps
`variant === 'identified'` to the key. ⛔ A provider-level `templateKeyFor(options)` was **rejected**:
a request-derived key would label identifier-free bytes `case_identified` and supersede a real
identified dossier. *A fact about the render must reach the door FROM the render.*

`src/lib/queries/document-hashes.ts` is new — `listCaseDocumentHashes(documentIds):
Promise<Map<string,string>>` for D2's manifest; **no new door, no DEFINER, no ACL change** (caller
session down `documents → document_versions → document_version_files → file_objects.sha256`; an
unreachable file is simply absent and the manifest prints `—`). `src/lib/queries/cases.ts`'s
`getCasePatients` was fixed to honour the **three-answer contract** `rows | [] | null` — the `null`
arm previously returned `[]`, telling an unentitled caller a case had **no patient**.
⚠ `case_print_revisions` **is** in the regenerated `src/lib/types/database.ts` (Rule 8 satisfied).

**Routes:** the prévia route gained `'case'` in its kind set and `?phi=1` — **exactly one spelling**,
so `?phi=true` yields the de-identified variant (pinned) — ordered **build → render → log → stream**,
with an unentitled identified request dying in the provider before the door is reached.
⭐ **`/api/documents/[id]` is UNCHANGED for the case kind** (zero occurrences of `case`): serving is
kind-agnostic — `open_printed_document` returns `storage_bucket`, pdf-lib overlays. **No new route or
page**: the print surface is the shared `PrintedDocumentsSection` block on the existing case detail
tab, whose visibility is `casePrintState != null`, i.e. the door's own answer, and which derives
**both** D3 axes from that one state object. `src/lib/cases/actions.ts` has **no** print additions.

**ADR 0145** (amends ADR 0014) adds `PDF_MARKDOWN_SANITIZE_SCHEMA` in
`src/lib/markdown/sanitize-schema.ts` — the shared screen schema with `img` filtered out, consumed
**only** by `src/lib/pdf/markdown.ts`. P3 is the first path rendering author-controlled Markdown as
live HTML **inside Gotenberg**, a headless Chromium on the server network, so an `![](https://…)`
was SSRF reach + a per-render exfil beacon on a Rule 12 document + a non-reproducible
`content_hash`. ⚠ Gotenberg **egress is verified OPEN, not merely unverified** (the dev recipe runs
the container with no network restriction; Coolify constrains inbound only) — the schema is the
**sole** mitigation, egress denial PO-deferred.

### SQLSTATEs (all pre-existing; P3 adds none)

`HC0DP` (source does not register — *"use a prévia"*) · `HC0DU` (compare-and-mint: observed revision
≠ current; ⭐ **load-bearing far more often for cases than for meetings**, because D15 bumps on every
dossier-visible write, so an ordinary tag rename during the render window raises it) · `HC0DV`
(locked source refused a prévia) · `HC0D1/2/3/5` · `42501` (identified mint without the PHI door) ·
`HC025` / `HC0M8` / plain `check_violation` on the case-status guards. `HC0DP` and `HC0DU` are
**not** in the UI's surfaceable-error allowlist.

### Tests + measured figures

pgTAP **`368_printed_documents_cases.sql` `plan(58)`** (668 lines; `48 + C-3a's 8 (t28a-h) + C-3b's
t38a + M-3's t40a`) plus updates to `344` (`plan(110)`), `313` (`plan(59)`), `229` (`plan(85)`),
`356` (`plan(78)`). Vector fixture `print-source-registers-vectors.json` → **34** vectors (gains a
`case_disposed` dimension; vectors pinning `correction_open`/`phase_voided`/`meeting_disposed` are
**IGNORED** for `case`, and cross-kind vectors are what pin that — not the comments). Mutation
harness **`supabase/tests/mutation/p3-case-print-mutation-audit.sh`** (8 fingerprints; the mutation
is injected **inside `368`'s own transaction** after a marker, so it rolls back with the suite and
"a mutation that did not fully apply reports GREEN" is removed by construction; `_mut_368` compares
`pg_get_functiondef` before and after and **raises when the text did not move**). E2E
`e2e/pdf-printing-cases.spec.ts` (11/11) carries the two claims pgTAP structurally cannot.
Ratchet: `320`'s PUBLIC-executable `app.*` population — re-measured **237** = 228 NULL `proacl` +
9 explicit `=X/`; it read 249 mid-phase (the 12 new trigger functions) and was fixed **at the cause**
in `002800`, so `320` needed no edit.

⭐ **Lessons this phase paid for, verbatim where they are quotable:** *a mutation audit's coverage is
the set of mutations you RAN, never the suite you ran them IN* (`368` t40 asserted a row written by
t18 twenty-odd assertions earlier — deleting the mint left it green) · *a claim about where a
property is pinned is itself an unpinned claim* (Amendment 6) · *a parity audit is not a door audit,
and a matrix with a superuser on one side is biased toward "the door is wider", which looks exactly
like a finding* (the 975-cell correction) · and the C-1 shape: an E2E test **pinned the defect**
(`contains_phi === false` on C-1's exact case, captioned "recorded as a measurement"), so an 11/11
green contained an assertion that would have gone RED on correct behaviour.

**Clean-tree residue** (re-measured 2026-08-25 on the P3 tree, 460 migrations / `max(version)
20261003002800`): `cases` **8** · `case_print_revisions` **1 row, revision 1** — ⛔ **not 0**;
`seed.sql` closes a case then inserts `case_phases`, firing a D15 trigger once (case
`d0000000-…-0000000000c2`) · `printed_documents` **0**.
