# Plan — Printing Cases (ADR 0104 P3, decided in ADR 0144)

**Status:** ✅ **READY TO EXECUTE** — the §1 decision was resolved by the PO 2026-08-25 (shape
(a), now ADR 0144 **D15**). No open blockers.
**ADR:** [0144](../decisions/0144-case-printing-dossier-lock-and-phi-fork.md) (accepted
2026-08-25, catalog-verified; amends [0104](../decisions/0104-pdf-document-printing-module.md)).
**Predecessors:** P1 Forms + P2 Meetings, both complete and QA-approved.
**Plan formula (ADR 0104 A9):** provider + template + arm + **mint surface** + tests.

---

## 0. Substrate facts — catalog-verified 2026-08-25

Preconditions checked before any read: **453 migration files == 453 registered**, so the
catalog was current. ⛔ Everything below is from `pg_proc` / `pg_get_functiondef`, never from
migration text (CLAUDE.md graphify exception).

| Fact | Value |
| --- | --- |
| `'case'` source kind | declared in `PrintedDocumentSourceKind`; **fails closed** today, pinned by `print-source-vectors.test.ts:202` |
| Providers registered | `form_response`, `meeting` only — `PDF_PROVIDERS` reserves `phiCapable` for P3 |
| `phi/` + `std/` prefixes | created in P1, **unused** — P3 is first use |
| Writers of `cases.status` | exactly 4: `app.recompute_case_status` (guards terminal), `close_case`, `cancel_case` (HC025 on terminal), `reopen_case` (HC0M8 on cancelled) |
| Door out of `completed` | **`reopen_case`, and only it** |
| `app.can_read_case` | `(p_case_id uuid, p_uid uuid)` DEFINER — exists |
| `app.can_read_case_patient` | `(p_case_id uuid, p_uid uuid)` DEFINER — exists |
| Case **full-content** predicate | ⛔ **does not exist** — must be written |
| `app.audit_write` | `(p_action, p_entity_type, p_entity_id, p_commission, p_summary, p_metadata, p_organization, p_hospital)` DEFINER |
| `dispose_case_phi` | `(p_case_id uuid, p_reason text)` DEFINER; already marks `file_objects.disposal_state = 'disposal_pending'` — a **two-phase** idiom to reuse, not to reinvent |
| `cases` revision column | ⛔ none — `printed_documents.source_revision` is NOT NULL |

⚠ **Methodology note, kept because it nearly cost the verification:** the first catalog query
returned **0 rows** using `\b` for a word boundary. Postgres ARE uses `\y`. The positive
control (`update public.cases` as a literal) returned **10**. ⛔ Run a positive control before
believing any zero, and strip `--` / `/* */` comments before any `prosrc` regex.

---

## 1. ✅ RESOLVED — the content-drift decision (ADR 0144 D15)

**PO ruled 2026-08-25: shape (a) — trigger-bump.** `cases.revision` is bumped by triggers on
every dossier-visible content table, not only by `reopen_case`. Nothing blocks §2.

⚠ **The coupling this creates must be written into the migration and the template module:**
the trigger set is scoped to *the tables the template renders*, so **adding a section to the
case template can require adding a trigger** — otherwise the new section drifts silently, which
is the exact defect D15 exists to prevent. Cross-reference both directions in comments.

### Why it was blocking — kept for the reviewer

D4 originally bumped `cases.revision` only on `reopen_case`, but
dossier-visible content can change on a `completed` case with **no case-level door involved**,
so no bump is possible and a registered dossier can read *"autêntico e atual"* while its text
has drifted.

Measured: 41 functions write case-content tables — **16** carry a terminal guard, **25** do
not, all 25 `EXECUTE`-able by `authenticated`. ⚠ Reachability was **not** proven per-function;
but `rename_case_tag`, `update_case_outcome` and `archive_case_outcome` need no reachability
argument — they are **commission-level and take no case argument**, so no case-terminality
guard *could* apply.

Three shapes were put to the PO; the full record is ADR 0144 **§ D15**. **(a)** trigger-bump
`revision` on every dossier-visible content table — **CHOSEN** · **(b)** keep reopen-only bumps
and narrow the currency claim — rejected, it leaves `/verificar` making a false statement on an
**unauthenticated** surface · **(c)** exclude vocabulary-derived text from the dossier —
rejected, it buys honest currency by removing the outcome and tag labels an ONA tracer expects,
i.e. it fixes the claim by degrading the artifact.

(a) is the only shape under which `/verificar` stays truthful, which is the entire point of D1's
record semantics. Its cost — a tag rename supersedes outstanding dossiers — is the honest
answer, and supersession is cheap: the document stays downloadable, it just stops claiming
currency.

---

## 2. Work breakdown

⛔ File ownership is binding (CLAUDE.md §4): no two teammates edit the same file. Shared types
change only via `backend`.

### 2.1 `backend` — migrations

1. **`cases.revision`** `integer not null default 1`; `reopen_case` bumps it. Plus the §1
   trigger set if the PO rules (a). ⛔ No top-level `set local` (gate `lint:set-local`); use one
   `do $$` block. ⛔ Do **not** bump the `check-migration-set-local.mjs` watermark.
2. **`app.can_read_full_case_content(p_case_id uuid, p_uid uuid)`** — NEW predicate.
   ⛔ Must be **fail-closed on an empty case**. `can_read_full_meeting_content` is fail-open
   standalone (vacuous `NOT EXISTS` over zero rows); do not copy its shape. Ship a
   `COMMENT ON FUNCTION` stating the fail direction, and pay 0104's outstanding debt by adding
   the equivalent comment to the meeting twin.
3. **`app.print_source_registers` / watermark** — add the `case` arm to the SQL mirror, with
   the `case_disposed` input. Both arms spelled out separately (ADR 0125 D8 / 0126 D7).
4. **Mint door** — `case` arm in the dispatch; `contains_phi` passthrough; series keyed on
   `(case_id, variant)`; **compare-and-mint** (render↔register TOCTOU, ADR 0126).
   ⛔ Kind-conditional sites stay at **three** (A8). A fourth = stop and redesign.
5. **`dispose_case_phi`** — extend to mark `contains_phi` case printed-documents for byte
   destruction via the **existing two-phase idiom**, and revoke the rows with a disposal
   `revoked_reason_class`.
6. `npm run gen:types` after every migration (Rule 8).

### 2.2 `backend` — pure renderer, `src/lib/pdf/`

- `documents/case.ts` — the template. ⛔ `src/lib/pdf/**` may not import `@/lib/supabase`,
  `@/lib/queries` or `server-only` (ESLint `no-restricted-imports`, ADR 0104 D14).
- `documents/print-source.ts` — the `case` arm in **both** `printSourceRegisters` and
  `printSourceWatermark`, `caseDisposed` added to `PrintSourceState`. ⛔ Do **not** factor the
  shared conjunction into a helper — the module header forbids it, and it is what keeps ADR
  0125 D5's fourth cell unreachable.
- `primitives/table-of-contents.ts` — the one new primitive; rendered **unconditionally**.
- `render.ts` — `TEMPLATES.case` key + version.

### 2.3 `backend` — provider + payload

- `src/lib/cases/pdf-payload.ts` — `buildCasePayload`, with the identified / de-identified
  fork. ⛔ **CORRECTED 2026-08-25.** This line read *"de-identified reads **no** identifier
  table at all"*, which **contradicts D5 and was unbuildable**: `age_years`, `sex` and
  `unit` — the three fields D5's own rationale exists to protect — live on
  `patient_identifiers`, the same Class-1 table as `name`/`mrn`, and that table has RLS on,
  **0 policies** and no `authenticated` ACL, so `public.get_case_patients` is the only way
  to read any of it. Taken literally the instruction deleted D5's clinical floor.
  **Both variants read through `public.get_case_patients`** (the audited door — never
  `patient_identifiers` directly) and the de-identified one drops the five identified
  fields in TS. Lead ruling 2026-08-25 → **ADR 0144 Amendment 2**.
- `providers.ts` — the `case` entry, `phiCapable: true` (the first).
- Field split is ADR 0144 D5: de-identified keeps `age_years`/`sex`/`unit`;
  `patient_key`/`encounter_key` print in **neither** variant.
- ⚠ Template must **degrade gracefully on a disposed case** — answers deleted, narratives
  nulled, label redacted. Empty sections must not render as empty headings.

### 2.4 `frontend` — the mint surface

- A *Documentos impressos* card on the case **Detalhes** tab, reusing `PrintedDocumentsPanel`,
  `MintDocumentButton`, `previa-link`. Not in the shared `(detail)` layout header.
- The PHI choice renders **only** because the provider declares `phiCapable` — ⛔ never
  hardcode the kind in UI (ADR 0104 D9 v2-readiness).
- Invoke the `frontend-design` skill before building. pt-BR user text (Rule 10).

### 2.5 `tester` — E2E

- New spec `e2e/pdf-printing-cases.spec.ts`. ⚠ **Requires the Gotenberg sidecar** — `docker
  start gotenberg-pdf`, confirm `:3010/health` = 200. No gate starts or checks it, and its
  absence produces a generic pt-BR error that reads exactly like a product defect.
- ⚠ Against `next dev`, pass `--workers=1` — the print specs otherwise fail as uniform
  30 s `/login` timeouts while `curl` answers in ~73 ms.
- ⛔ Assertion hygiene: `expect(row?.f).not.toBeNull()` **passes when the row is absent**
  (`FUP-E2E-ABSENT-ROW-ASSERTIONS`). Use matchers that reject `undefined`.

### 2.6 `qa` — review

`docs/reviews/phase-p3-review.md`, `APPROVED` / `CHANGES REQUESTED`. Focus the PHI delta:
the fork, the new predicate's fail direction, the prévia audit asymmetry, D10's disposal path.

---

## 3. Test floor (ADR 0144 D14)

**Vector fixture** `print-source-registers-vectors.json` drives the TS suite **and** pgTAP;
drift is phase-blocking. Add: `case_disposed` dimension · the 5 statuses × {disposed, not}
cross-product for `case` · vectors pinning that `correction_open` / `phase_voided` /
`meeting_disposed` are **IGNORED** for `case`. Extend the fourth-cell probe sweep to `case`.

**pgTAP:** both directions on the PHI door (case-view *without* it → identified refused,
de-identified allowed) · PHI mint emits **both** rows · **identified prévia emits the PHI-read
row and NO mint row** · disposed case drops registration and refuses identified · SQL↔TS
vector parity · `can_read_full_case_content` proven **not fail-open standalone** · A7 arm
proven on a recused member and a phase-only respondent, **mint and download**.

---

## 4. Gate plan (CLAUDE.md §6, in order)

1. **Build complete** — lint (all ten gates), typecheck, unit, `npm run test:db` on a **fresh
   `supabase db reset`**. Authz arms: **`ARM=census`** (the arm that can see a brand-new gate —
   `can_read_full_case_content` is new, so it passes `ARM=policy` **vacuously**), `ARM=hat`,
   `ARM=floor` (⚠ **fresh reset mandatory** — floor reads ~110 never-called doors on a stale DB
   vs ~72 fresh), `FROMFINDINGS=1 ARM=wrapper`. Plus the **diff-scoped** door sweep over exactly
   the policies and `prosecdef` gates this phase touched, derived from the migration diff, never
   by hand (ADR 0079 Amdt 1). BLIND blocks the phase; `ERROR` is not a pass.
2. **Test pass** — full `npm run e2e:prod`, launched via `bash scripts/e2e-prod-gate.sh` from
   **Git Bash** (a PowerShell spawn chain yields a phantom "toolchain drift" exit 3). Gotenberg
   up first. ⚠ Read `did-not-run` per batch, not the pass count, to answer "was anything
   swallowed?".
3. **QA review** — §2.6.
4. **Human approval** — summary + open risks; wait.
5. **Record** — PROGRESS.md updated **and everything completed rotated out in the same edit**
   (`lint:progress` reds otherwise); `docs/backend-state.md` updated (new predicate, the `case`
   arm, `cases.revision`, disposal extension); commit `phase(P3): complete — …`.
   ⛔ Name the **ARM**, never the script.

---

## 5. Out of scope

Bulk export / `document_jobs` · tenant stamps · DB-stored templates · ICP-Brasil · admin
delete surface · the standalone `interview` kind (P4) · council registrations in print
(ADR 0144 D11) · **byte-destruction for the `meeting` kind** — ADR 0144 D10's named sibling,
filed 🔴, *not* fixed here.

---

## 6. Open [INF] carried in

1. `phi/` storage policy shape — confirm the P1 policies cover the case prefix as-is before
   writing migration §2.1.4.
2. Which audited reader the case module uses for a PHI read, and its exact event key —
   needed for the D9 prévia asymmetry assertion.

---

## 7. Risks

| Risk | Mitigation |
| --- | --- |
| Dossier is the first **long** document; pagination/perf unproven at 60+ pages | Render a worst-case fixture early; Gotenberg timeout is a real failure mode |
| `contains_phi` auto-derive (D6) makes `phi/` the dominant prefix, where P1/P2 left it empty | Expected and accepted; verify storage policy coverage ([INF] 1) before the first mint |
| Disposal (D10) touches a door already carrying two disposal idioms | Reuse the two-phase pattern; do not add a third |
| A fourth kind-conditional site in the mint door | A8's abstraction-leak signal — stop and redesign, do not add a branch |
