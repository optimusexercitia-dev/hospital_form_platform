# PDF Document Printing Module — Implementation Plan

**Decision record:** ADR [0104](../decisions/0104-pdf-document-printing-module.md) *(renumbered from 0101 at the QO·FUP merge — 0101 is the role-landing guard)*
(read it first — decisions D1–D15 are PO-ratified, do not re-litigate). **Status:**
planned, implementation NOT started. **Written:** 2026-08-07, by the lead session that
ran the PO interview. **Audience:** the lead session that executes this, and its
teammates.

> ⚠ **Binding methodology (CLAUDE.md graphify exception / ADR 0078):** this is a
> NEW-module plan, so most of it is greenfield — but every touchpoint with the existing
> substrate below was verified in source on 2026-08-07 and marked. **[V-SRC]** verified
> in source/tests · **[INF]** inferred, confirm at build time · anything touching an
> existing function/policy: **re-read from the live catalog (`pg_get_functiondef`,
> `pg_policies`) at authoring time** — migration file text is stale by design.

---

## 0. Substrate facts this plan builds on (verified 2026-08-07)

- **Migration window:** highest registered version at writing is
  `20260911001000_interview_family_closure.sql` [V-SRC]. Sequence all new migrations
  after the highest registered version **at build time**, and mind the two-sessions
  window rule (memory: allocate above the highest REGISTERED version).
- **Feature flags:** `app.feature_flags` read through ONE memoized
  `get_feature_flags()` round trip; the typed surface is the HAND-MAINTAINED
  `FeatureFlags` interface in [feature-flags.ts](../../src/lib/queries/feature-flags.ts)
  — a key absent from the DB reads `false` [V-SRC]. Add `document_printing` to both.
- **Audit:** the ledger is WRITE-ONLY through the `app.audit_write` DEFINER writer
  [V-SRC in `src/lib/audit/actions.ts` header; re-read the signature from `pg_proc` at
  build time — INF on exact arg list].
- **Serving precedent:** attachments use an audited `open_attachment` RPC → then
  `createSignedUrl(path, SIGNED_URL_TTL_SECONDS)` [V-SRC
  `src/lib/attachments/actions.ts:182-192`]. **This module deviates deliberately
  (ADR D8): downloads NEVER hand the client a Storage URL** — bytes stream through the
  serving route so the overlay and download-time predicate always apply. The audited-RPC
  half of the pattern is reused; the signed-URL half is not.
- **Pure-module precedent:** `src/lib/attachments/constants.ts` documents the
  client-safe pure-module discipline and the build-abort failure mode this avoids
  [V-SRC]. `src/lib/pdf/` follows the same rule, enforced by lint (§6).
- **Sidecar precedent:** MIN (`minute_generator`) is the deploy-topology template
  (own Coolify resource) but NOT the flow template — mint is synchronous (ADR D5).

## 1. Program shape

Four phases matching the ADR D15 rollout order, each a phase-gated PR:

| Phase | Kind | Delivers |
| --- | --- | --- |
| **P1** | Forms | The ENTIRE skeleton: schema, doors, pure renderer, sidecar, mint/serve/verify, audit, UI. PHI-free. |
| **P2** | Meetings | Second data provider + ata template + multi-signature footer. Proves "new kind = provider + template". |
| **P3** | Cases | The PHI delta: variant fork, domain-door delegation, storage bifurcation, confidentiality band. |
| **P4** | Interviews | Case-scoped; reuses the P3 PHI arm. Smallest. |

P1 is ~70% of the program. P2–P4 must each be reviewable as "one provider + one
template + one RLS arm + tests" — if a later phase needs pipeline surgery, the P1
abstraction failed; stop and re-plan rather than patching around it.

## 2. Phase P1 — Forms + the full skeleton

### 2.1 Migrations (sequenced at build time; ~4 files)

**M1 — `printed_documents_schema.sql`.**
- `printed_document_source_kind` enum: `form_response | case | meeting | interview`
  (all four from day one — the enum is not per-phase).
- `printed_document_status` enum: `active | superseded | revoked`.
- `public.printed_documents`: `id uuid pk`, `source_kind`, `source_id uuid`,
  `commission_id uuid NOT NULL` (denormalized owner for RLS/admin-chain checks — the
  polymorphic source cannot be FK'd, ADR D3; INF: confirm every kind resolves to
  exactly one commission — forms/meetings/interviews do; a case does [V-SRC cases
  model]), `template_key text`, `template_version int`, `content_hash text`
  (sha-256 hex of the canonical bytes), `storage_path text`, `contains_phi boolean
  NOT NULL DEFAULT false`, `status printed_document_status NOT NULL DEFAULT 'active'`,
  `verification_token text NOT NULL UNIQUE` (random, ≥128-bit, URL-safe),
  `verification_short_code text NOT NULL UNIQUE` (human-typable fallback),
  `revoked_reason_class text NULL`, `revoked_reason text NULL`, `revoked_by uuid NULL`,
  `revoked_at timestamptz NULL`, `minted_by uuid NOT NULL`, `minted_at timestamptz
  NOT NULL DEFAULT now()`, `superseded_at timestamptz NULL`.
- **Zero-PHI column rule (ADR D3) is a review invariant, not a CHECK** — no title, no
  description, no free-text columns except the revocation reason (which is
  governance text about the record, not source content; keep it PHI-free by
  instruction in the revoke dialog).
- Partial unique index enforcing ONE active row per `(source_kind, source_id,
  template_key)` — supersession's anchor.
- Grants: column-list SELECT to `authenticated` per the house posture (memory:
  `profiles`/`case_referral` precedent — **every later column addition needs its own
  GRANT or reads 42501**). NO INSERT/UPDATE/DELETE grants — all writes through doors
  (M2).
- RLS: `SELECT` policy delegating to `app.can_view_printed_document(source_kind,
  source_id)` — the ADR D3 dispatch function, one arm per kind, `ELSE false`
  (fail-closed). P1 implements the `form_response` arm (delegate to the response-
  visibility predicate the forms domain already uses — read it from the live catalog,
  not from this sentence [INF]); the other three arms are literal `false` until their
  phase. **This function is a door: census-register it (ADR 0079) in the same PR.**

**M2 — `printed_documents_doors.sql`.** Three SECURITY DEFINER RPCs, each with the
house door discipline (authority FIRST, GUC bracket, `app.audit_write`, `REVOKE FROM
PUBLIC` then `GRANT authenticated`; copy the discipline from a current door read out of
the live catalog at build time, e.g. `set_case_visibility` [INF — re-read]):

- `mint_printed_document(p_source_kind, p_source_id, p_template_key,
  p_template_version, p_content_hash, p_storage_path, p_contains_phi)` — authority =
  the SAME `can_view_printed_document` dispatch (mint right ≡ source visibility, ADR
  D11); inside one transaction: supersede prior active rows for the
  `(source_kind, source_id, template_key)` triple, insert the new row, emit
  `document.minted`. Returns the row. **The Storage upload happens BEFORE this call
  and the action deletes the object if the RPC fails** — all-or-nothing (ADR D5), and
  a registry row must never point at a missing object.
- `open_printed_document(p_id)` — authority = the dispatch predicate at CALL time
  (ADR D11 download-follows-current-access); emits `document.downloaded` (with
  overlay-applied flag param from the caller); returns `storage_path + status +
  contains_phi` to the server-side route ONLY (the route streams bytes; the path never
  reaches the client).
- `revoke_printed_document(p_id, p_reason_class, p_reason)` — authority =
  `staff_admin` of `commission_id` + admin chain (mirror the existing
  commission-admin authority shape from the catalog [INF]); sets status/reason/actor;
  emits `document.revoked`. NOT the minter (ADR D11).
- Flag gate: every door checks `document_printing` is enabled (fail with the house
  disabled-feature error class) [INF: copy the flag-check idiom from a flag-aware door
  in the catalog, e.g. the administrativo `member_can` family].

**M3 — `printed_documents_storage.sql`.** Bucket `printed-documents` (private),
prefixes `std/` and `phi/` (ADR D9.4; created now, used from P3). Storage RLS: **no
direct read policy for `authenticated` at all** — objects are reached exclusively by
the serving route via service-role after `open_printed_document` authorizes [INF:
verify this matches how the attachments bucket policies are shaped before choosing
service-role-read vs owner-scoped policies]. Write policy: none for `authenticated`
either — upload happens server-side in the mint action. Rule 6 immutability: no UPDATE
on objects; new mint = new path (`std/<registry-uuid>.pdf`).

**M4 — `document_printing_flag.sql`.** Insert `document_printing` OFF into
`app.feature_flags`; `seed.sql` forces it ON for local/E2E (house pattern [V-SRC —
several flags in the interface note exactly this]).

**Also M-side:** `verification_lookups` minimal table (kind, token-hash, ts) for the
rate-limit log (ADR D12 — deliberately NOT `audit_log`), or a leaky-bucket in the route
+ no table [INF — decide at build; default to the table, it is 10 lines and auditable].

**pgTAP:** new numbered suite — registry RLS (per-kind arm + fail-closed ELSE via a
bogus kind), door authority denials (non-viewer mint 42501; minter-cannot-revoke;
platform_admin denied ALL THREE — the ADR D11 noun-rule row), supersession uniqueness,
flag-off failure. **Keystone the fail-closed ELSE and the platform_admin denial**
(reader-non-writer rule, memory: AUDIT-DOOR-BLINDNESS). `ARM=census` + `ARM=floor` +
diff-scoped `ARM=policy` over the new door + policies (Phase Gate step 1).

### 2.2 Pure renderer — `src/lib/pdf/` (frontend-engineer or backend? → **backend owns
`src/lib/pdf/`**, frontend owns `src/components/pdf/`; the HTML templates are
data-to-string code, not UI components)

```
src/lib/pdf/
  types.ts          # DocumentPayload envelope: letterhead, watermarks: WatermarkFlag[],
                    #   signatures: SignatureAttestation[], qr: {token, shortCode, url},
                    #   emission: {at, by-display}, body: per-kind discriminated union
  render.ts         # payload -> full HTML string (doc shell, embedded IBM Plex, print CSS)
  primitives/       # letterhead, watermark layer, signature-block, qr-footer,
                    #   section-table, pt-BR value formatting (dates, enums)
  documents/
    form-response.ts  # TEMPLATE_KEY='form_response', TEMPLATE_VERSION=1
  fingerprint.test.ts # ADR D4 guard: structural fingerprint per template; changing a
                      #   template without bumping its version REDS this test.
                      #   Prove the detector can detect (memory: detector-that-finds-
                      #   nothing): the test suite includes one intentional-mutation case.
```

- **PURE: no `@/lib/supabase`, no `@/lib/queries`, no `server-only`** — enforced by
  §6's lint gate, testable with Vitest alone.
- Fonts embedded as data-URI `@font-face` in the HTML shell (ADR D14 — renderer stays
  generic). Check output size; if the embedded-font HTML makes render calls slow, an
  [INF] fallback is baking fonts into a custom Gotenberg image — a deploy decision,
  not a module change.
- Watermark primitive renders `RASCUNHO`/`FINAL` (mint-time); `SUBSTITUÍDO`/`ANULADO`
  are NOT rendered here (they are the pdf-lib overlay, §2.4).
- QR: generate as inline SVG at payload-build time (pure lib, e.g. a zero-dep QR
  encoder — pick at build [INF]; it must run in Vitest without canvas/DOM).

### 2.3 Data provider + mint action (backend)

- `src/lib/forms/pdf-payload.ts` — the ADR's domain-owned mapper: reads the response +
  version + sections + answers + signoffs via `src/lib/queries/` (Rule 9) UNDER THE
  CALLER'S SESSION, computes `RASCUNHO`/`FINAL` from response lifecycle, maps
  signoffs → `SignatureAttestation[]` (`method: 'platform_signoff'`, ADR D13),
  builds the letterhead from the hospital row. Returns `DocumentPayload`.
- Provider registry: `src/lib/pdf-mint/providers.ts` [INF on final location — it
  imports domain queries so it CANNOT live in `src/lib/pdf/`; a thin
  `src/lib/pdf-mint/` module holds the impure orchestration: providers map, mint
  action, sidecar client]. `Record<SourceKind, DataProvider>` — P1 registers
  `form_response` only; an unregistered kind fails with a clear error (mirror of the
  SQL fail-closed ELSE).
- Mint server action (`src/lib/pdf-mint/actions.ts`):
  1. flag check → 2. provider lookup → 3. payload build (throws = no mint) →
  4. render HTML → 5. semaphore-bounded POST to Gotenberg
  (`PDF_RENDERER_URL/forms/chromium/convert/html`, timeout 30 s) → 6. sha-256 →
  7. Storage upload (service-role, `std/<uuid>.pdf`) → 8. `mint_printed_document`
  RPC → on RPC failure, delete the uploaded object → 9. return registry row.
  Semaphore: in-process, 3 permits (ADR D5); over-capacity waits briefly then fails
  with a pt-BR "tente novamente" — never queues to disk.
- **Env:** `PDF_RENDERER_URL` in `.env.example` with the house server-only commentary
  (mirror the MIN block's tone [V-SRC `.env.example`]).

### 2.4 Serving route + overlay (backend)

- `src/app/api/documents/[id]/route.ts`: auth session → `open_printed_document(id)`
  RPC (authorizes + audits) → service-role Storage download → if status ≠ active,
  apply the pdf-lib overlay (`SUBSTITUÍDO`/`ANULADO`, deterministic, minimal) →
  stream bytes with `Content-Disposition`. New dep: `pdf-lib` (pure JS, no Chromium).
- Overlay unit tests: bytes-in/bytes-out, both stamps, and a no-op assertion for
  active docs (served bytes === canonical bytes → hash still matches).

### 2.5 Verification surface (frontend + backend)

- `src/app/(public)/verificar/[token]/page.tsx` + a `/verificar` landing with the
  short-code input. **Unauthenticated**: confirm the middleware matcher exempts it
  (memory: a-correct-door-nothing-can-reach — a matcher redirected a public endpoint
  to /login; add an E2E that hits it logged-out) [INF — read `src/proxy.ts` matcher at
  build time].
- Lookup by token (or short code) via a dedicated DEFINER RPC returning ONLY the ADR
  D10 anemic tuple; rate-limit write per lookup. No document bytes, no download link
  for anonymous users; a logged-in user with visibility gets a link into the app.
- pt-BR wording per ADR D6: superseded = "existe uma emissão mais recente deste
  documento" — must not imply the paper is wrong.

### 2.6 UI (frontend — invoke `frontend-design` skill first)

- Mint button + dialog on the response detail screen (P1): confirms scope, shows the
  FINAL/RASCUNHO state that will be stamped, mints, then offers the download.
- Printed-documents list per source artifact (status chips, mint date, minter,
  download, revoke for staff_admin).
- Revoke dialog: reason class + free text, with the PHI-free-reason instruction inline.
- GSAP micro-animation budget per the §1 mandate; keyboard path for the whole
  mint→download flow (tester covers it).

### 2.7 Sidecar (backend, + user for Coolify)

- Local dev + E2E: Gotenberg pinned image via `docker run`/compose snippet documented
  in `docs/deployment/pdf-renderer.md`; E2E gate needs it running (extend the gate
  doc; the e2e-prod script does NOT manage it — precondition like Supabase itself
  [INF: confirm with the tester whether a health pre-check in the gate script is
  warranted]).
- Prod: own Coolify resource, pinned tag, mem/CPU caps, **no public domain, private
  network** (ADR D14). Coolify clicks are the USER'S (memory: remote pushes/infra need
  user auth) — the plan's deploy step is a runbook handoff, not an agent action.

### 2.8 P1 gates

Standard Phase Gate §6 + module-specific: fingerprint test present AND
proven-detecting; lint purity gate red-teamed (add a forbidden import locally, watch
it fail, remove); E2E: mint→download→verify (logged-out)→revoke→overlay-download →
re-verify shows ANULADO; keyboard-only mint flow; `platform_admin` UI shows no mint
surface anywhere.

## 3. Phase P2 — Meetings

- `src/lib/meetings/pdf-payload.ts` (ata: agenda, deliberations, action items refs,
  attendance, multi-signature footer from the minutes-approval signoffs [INF — read
  the meetings/minutes approval substrate at build; MIN's ADR 0099 touched it]).
- `documents/meeting.ts` template v1; RLS arm `meeting` in
  `can_view_printed_document` (delegate to meeting visibility [INF — catalog]);
  provider registration. pgTAP: the new arm + the OTHER kinds still false.
- **The review question for this phase is exactly one:** did P2 touch anything outside
  provider/template/arm/**mint surface**/tests? If yes, the abstraction leaked — fix the
  abstraction. *(Formula corrected per ADR 0104 A9; the P2 build also ratified A7/A8 —
  full-sight conjunction for per-caller-masked domains + presence-derived PHI labeling.)*

## 4. Phase P3 — Cases (the PHI delta)

- `src/lib/cases/pdf-payload.ts` with the identified/de-identified fork (ADR D9):
  de-identified reads NO identifier tables; identified reads identifiers through the
  domain's audited PHI door (`app.can_read_case_patient` predicate + the audited
  reader — re-read both from the live catalog; do NOT trust this sentence or the flag
  name confusion warned in CLAUDE.md §1) and sets `contains_phi`.
- Mint dialog gains the per-mint PHI choice, default de-identified, rendered ONLY for
  PHI-capable kinds (capability declared by the provider, not hardcoded in UI —
  ADR D9 v2-readiness).
- Storage: PHI mints to `phi/` prefix. Confidentiality band primitive activates.
- `case` arm in the dispatch function; mint door passes `contains_phi` through to the
  registry; **PHI mint emits BOTH rows** (domain PHI-read + `document.minted`) — pgTAP
  asserts both, and asserts a caller with case-view but WITHOUT the PHI door is
  refused the PHI variant while still allowed the de-identified variant (both
  directions tested).
- Diff-scoped ARM=policy over the changed dispatch function + any storage policy.

## 5. Phase P4 — Interviews

- `src/lib/interviews/pdf-payload.ts`; interview template; `interview` arm
  (case-scoped visibility + reuse of the P3 PHI arm). By now mechanical; the phase IS
  the proof of ADR D15's "new kind" claim.

## 6. Cross-cutting (P1, stays forever)

- **ESLint purity gate:** flat-config override scoped `src/lib/pdf/**` with
  `no-restricted-imports` (`@/lib/supabase*`, `@/lib/queries*`, `server-only`) at
  ERROR. Red-team it once (§2.8).
- **Types:** `npm run gen:types` after every migration (Rule 8); `FeatureFlags` gains
  `document_printing`.
- **Docs:** `docs/backend-state.md` gains the registry + doors + bucket;
  `docs/deployment/pdf-renderer.md` new; `.env.example` gains `PDF_RENDERER_URL`.
- **PROGRESS.md:** program tracked as PDF·P1…P4 rows; bugs to the Bug Log per house
  rule.

## 7. Deliberately out of scope (ADR-anchored — do not scope-creep)

Bulk export / `document_jobs` (D5) · tenant-custom stamps + `VIA NÃO CONTROLADA` (D7)
· DB-stored templates (D4) · ICP-Brasil (D13) · Meetings/Interviews-PHI beyond the
readiness seams (D9 — needs an upstream domain ADR) · any admin delete surface (D15).

## 8. Build-time verification checklist (the [INF] register)

1. `app.audit_write` exact signature (catalog).
2. Response-visibility predicate name for the `form_response` arm (catalog).
3. Door discipline template — copy a CURRENT door body (catalog), diff old-vs-new if
   any existing function is re-emitted (memory: guards-that-read-right — a REBUILD
   silently loses ACLs).
4. Middleware matcher treatment of `/verificar` + `/api/documents` (source).
5. Attachments bucket policy shape → choose the storage-policy shape for M3.
6. Flag-check idiom inside doors (catalog).
7. Meetings signoff substrate for the ata signature block (catalog + source).
8. Case PHI door + audited reader names (catalog — NOT the `case_patient` flag-key
   trap, CLAUDE.md §1).
9. Migration numbers ≥ highest registered at build time.
10. QR encoder + pdf-lib dependency picks (license, zero-DOM, bundle cost).
