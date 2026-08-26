# AFF4 — implementation plan: org affiliation, staff data, the voided tense

**Status: PLANNED — build NOT started.** All decisions PO-ruled 2026-08-25; **authority is
ADR [0151](../decisions/0151-aff4-organization-affiliation-staff-data-voided-tense.md)**
(D1–D17) — where this plan disagrees with the ADR, the ADR wins; where either disagrees
with the live catalog at build time, the catalog wins. Analysis + rejected alternatives:
[org-affiliation-and-staff-data-model.md](./org-affiliation-and-staff-data-model.md).
**Start condition:** the PO's explicit build go, after the pre-step (Track P) is green.

**Shape:** Track P (pre-step, lands on `main` before the feature branch forks) → one
gated workstream on `feat/aff4-org-affiliation`, three tracks (backend `backend`,
frontend `frontend`, tester `tester`), standard §6 phase gate, then `qa`.
Contract-first: B1–B6 land before F screens that need the new data; F0/F1 (DatePicker
fix, error boundaries) start immediately — they touch no new data.

⚠ **Standing verification rule for every task below:** schema/RLS/door claims are
verified against the **live catalog** (`pg_policies`, `pg_proc.prosecdef`, ACLs,
`information_schema` grants), never against migration text or this plan
(ADR 0078 methodology finding).

---

## Track P — pre-step (small fix commits on `main`, before the branch)

### P1 · Fix `FUP-OPEN-DOCUMENT-VERSION-500-ON-EVERY-RAISE` (backend)

- `public.open_document_version` returns HTTP 500 `text/plain` through PostgREST for
  **every** raise, while psql shows the correct SQLSTATE + pt-BR message. Diagnose
  where the mapping breaks (SQLSTATE class? PostgREST error shaping?) before fixing —
  the register says reproducible with bare curl, pre-existing.
- ⚠ **Re-scoped 2026-08-25:** the merged-tree gate (P4) ran GREEN on Windows with no
  code change — and the door was **exercised, not skipped**: 81 tests across the seven
  document-touching specs, 0 failures (measured against final logs; collapsed-batch
  first attempts supersede to their reruns). So the "6 gate failures" **did not
  reproduce on Windows prod-standalone at `3894c667`** — platform-attributed, not
  closed: one platform's silence is not a bound on the other's defect. The item no
  longer blocks a green gate here; it stays in the pre-step on its own merits: an
  app-facing raw 500 violates §8 (raw errors never reach the UI), and curl reproduces
  it regardless of platform.
- Fix within ADR 0135's ruling (authored refusals get their own `HCxxx`; `42501`
  reserved), then re-run the specs that exercise the door.

### P2 · Door-sweep recipe learns `alter policy` (lead/backend)

- Land ADR 0079 **Amdt 8** in the recipe block itself (the block still greps only
  `create policy`; the amendment ruled `alter policy` in, a zero-row case list is a
  FINDING not a pass, and an `ALTER POLICY` invalidates the altered gate's verdict).
- This program alters three policies (B3) — without P2 our own sweep is blind to them.
- Closes `FUP-DOOR-SWEEP-RECIPE-STILL-BLIND-TO-ALTER-POLICY`.

### P3 · Sweep script stops truncating its baseline (backend)

- `p0-authz-door-audit.sh` writes findings with a truncating redirect; a subset run
  replaced the committed `docs/reviews/authz-door-audit-findings.md` 699 → 90 lines
  during AFF3. Fix shape per the register: subset runs write to a scratch path or
  merge; failing that, the script **refuses to write** when `CASES=` is set.
- **Prove it:** run a deliberate subset sweep and show the committed findings file
  survives byte-identical (`git diff --stat` clean). A guard that was never exercised
  is the class this repo keeps paying for.
- Closes `FUP-DOOR-SWEEP-DESTROYS-ITS-OWN-BASELINE`.

### P4 · Full `e2e:prod` discharge run — ✅ **DISCHARGED 2026-08-25**

- Run by a parallel session the same evening this plan was written: full gate on the
  merged tree at `3894c667`, **GREEN, exit 0** — `1239p · 0f · 2 flaky (both
  already-named baseline recurrences) · 0 did-not-run · 21 batches`, flaky tests and
  skips recorded **by identity**, run-scoped logs kept. Record:
  [merged-tree-gate-2026-08-25.md](../progress/merged-tree-gate-2026-08-25.md).
- That record satisfies both of P4's purposes: the 0147–0150 batch's deferred gate-2
  evidence, and AFF4's named-flake baseline. It also showed the macOS run's 18 reds
  **did not reproduce on Windows prod-standalone at `3894c667`** — exercised, not
  skipped (see P1's re-scope) — and that the batch-collapse family is general across
  batches, recovered in-invocation by the harness.
- ⚠ Two environment notes from that run bind AFF4's own gate: the `gotenberg-pdf`
  sidecar now carries restart policy `unless-stopped` (revert with
  `docker update --restart=no gotenberg-pdf`), and a session teardown can kill an
  attached gate run — launch the full gate detached.

---

## Track B — backend

> Door shape for every new mutation door: the actor-kernel triple (ADR 0098 §W2.1) —
> `app.*_impl` owner-only (`postgres=X`, unforgeable `p_actor`), `public.*` auth.uid()
> wrapper (`authenticated`), `public.*_for` service-role-only twin. `authenticated` must
> never hold EXECUTE on `_for`.

### B1 · Migration: `organization_affiliations` (ADR 0151 D1)

- Columns: `id uuid pk default gen_random_uuid()`, `principal_id uuid NOT NULL →
  profiles ON DELETE CASCADE`, `organization_id uuid NOT NULL → organizations ON DELETE
  CASCADE`, `started_on date NOT NULL DEFAULT CURRENT_DATE`, `ended_on date NULL`,
  `created_by/ended_by uuid NULL → profiles`, `created_at timestamptz NOT NULL now()`,
  `voided_at timestamptz NULL`, `voided_by uuid NULL → profiles`, `void_reason text NULL`.
- CHECKs: `period_ck (ended_on IS NULL OR ended_on >= started_on)`; `ended_by_shape`
  (mirrors hospital table); `voided_shape` — `voided_at IS NULL` ⇔ (`voided_by` and
  `void_reason` both NULL), reason non-blank when set. Ended+voided may coexist
  (voided takes precedence — D7).
- Partial unique: `(principal_id, organization_id) WHERE ended_on IS NULL AND
  voided_at IS NULL`. Indexes: `principal_idx`, `(organization_id) WHERE ended_on IS
  NULL AND voided_at IS NULL`.
- Guards: `app.guard_org_affiliation_no_delete` (BEFORE DELETE, always raises) +
  `app.trg_audit_organization_affiliations` (AFTER I/U/D →
  `org_affiliation.created/ended/voided/updated`; the D-arm reachable only under
  replica mode, mirroring the hospital trigger).
- RLS: enable; single SELECT policy `organization_affiliations_select` =
  `principal_id = auth.uid() OR app.is_org_admin_of(organization_id)`. No write
  policies (RLS default-deny; doors only). Grants: `authenticated` SELECT only,
  `service_role` full, `anon` nothing.

### B2 · Migration: voided tense + staff columns on `hospital_affiliations` (D7, D9)

- Add `voided_at/voided_by/void_reason` with the same `voided_shape` CHECK.
- **Index swap:** drop `hospital_affiliations_active_uq`, recreate as
  `UNIQUE (principal_id, hospital_id) WHERE ended_on IS NULL AND voided_at IS NULL`.
- Add `job_title text`, `work_email citext`, `work_phone text` + non-blank CHECKs
  (the `employee_id_not_blank` precedent). Table-level SELECT grant already exposes
  them to the policy audience — that audience is the decided one (D9), assert it in
  pgTAP rather than assuming.

### B3 · Migration: the voided exclusion in the read legs (D7) — ⚠ ALTER POLICY

- The **affiliation leg** of `profiles_admin_select`, `profiles_select_self_or_admin`,
  and `professional_credentials_select` gains `AND ha.voided_at IS NULL`. Nothing else
  in any predicate changes (the 0148 discipline: one conjunct, all sibling policies
  together).
- `hospital_affiliations_select` and `organization_affiliations_select` are **not**
  changed — voided rows stay visible to their audience (D7's record-vs-contribution
  asymmetry).
- Gate consequence: **diff-scoped door sweep over exactly these three policies + every
  new prosecdef gate**, list derived from the migration diff — this is the `alter
  policy` case P2 exists for.

### B4 · Migration: doors (D2, D5, D8)

- New triples: `affiliate_person_to_org` (tenant check conflated with not-found — no
  cross-org CPF oracle, D11) · `end_org_affiliation` (blocker enumeration per D3:
  active hospital affiliations in org; active memberships org-tier / hospital-tier of
  org hospitals / commission-tier via `commissions.hospital_id` → org; "active" per D6)
  · `update_org_affiliation` (`started_on` corrections) · `void_affiliation` (authority:
  org_admin-of-org OR hospital_admin-of-that-hospital; **refuses if any `memberships`
  row was ever scoped to that hospital or its commissions for that principal** — the
  never-employed consistency check, D8) · `void_org_affiliation` (org_admin only;
  refuses if any non-voided hospital affiliation or any org-scoped membership ever
  existed for that principal in the org).
- `affiliate_person_impl` gains: the org-parent ensure (create active org affiliation
  if absent, audited `org_affiliation.created` naming the actor — D5) + the containment
  check (D4) + the staff-data params (`p_job_title`, `p_work_email`, `p_work_phone`).
  `update_affiliation_impl` gains the same three with explicit `p_clear_*` flags
  (the `p_clear_employee_id` precedent: "leave alone" ≠ "clear").
- `get_own_person_record` (D14): `public`, prosecdef, **self-only by construction**
  (keys on `auth.uid()`, takes no target param). Returns the column-locked triple
  (CPF masked per ADR 0147's mechanism — reuse it, don't invent a second masking) +
  DOB + phone. Hand-picked projection, never `to_jsonb` (the `get_case_professional`
  lesson: a DEFINER bypasses column grants).
- Containment backstop: deferred constraint trigger on `hospital_affiliations`
  (INSERT/UPDATE) asserting an active org affiliation exists —
  `profiles_tenant_has_org_trg` style.
- ⚠ **Signature discipline:** extending `affiliate_person_impl`/`update_affiliation_impl`
  is DROP+CREATE. Sweep every `has_function_privilege('…(…)')` string naming the old
  arity (`FUP-SIGNATURE-STRING-CALLERS-ABORT-ON-A-DROP-CREATE` — a stale string ABORTS
  a suite as a plan mismatch naming no function); pin new signatures via
  `oid::regprocedure::text`.
- ⚠ Where a body must be re-emitted (e.g. `list_org_people`, B6): re-emit from the live
  `pg_get_functiondef`, never from migration text.

### B5 · Migration: backfill (D10)

- One active `organization_affiliations` row per non-admin profile with
  `home_organization_id`, `started_on = created_at::date`, `created_by NULL` — header
  comment documents the approximation and why it is acceptable (no real employment
  records exist yet; remote holds the E2E fixture only — but **re-measure
  `auth.users` on the linked project before push, never quote that claim**).
- Guard-wrapped `do $$` block; data-dependent (matches zero rows on a fresh local
  reset — that is expected, the seed provides local rows; the backfill exists for the
  remote push). ⛔ No top-level `SET LOCAL`; ⛔ the `lint:set-local` watermark is NOT
  bumped.

### B6 · Migration: `list_org_people` re-predicate (D10)

- Roster predicate moves from `profiles.home_organization_id = org` to
  `EXISTS (org affiliation to org, voided excluded)` — **ever-held**, with new param
  `p_include_ended boolean DEFAULT false` (active default filter). Payload gains
  org-affiliation status (`ativo`/`encerrado`) + `ended_on`.
- CPF-lookup audit behavior stays byte-identical (`person.cpf_lookup`, per-call,
  never the digits). Gate predicate (org_admin OR active hospital_admin hat) unchanged.

### B7 · Seed + demo seed

- `supabase/seed.sql`: `organization_affiliations` rows for **every** persona
  (Rede A + Rede B; `multi@test.local` gets both — seed is SQL and not bound by the
  product's cross-org block). ⚠ The seed is a contract with ~900 tests — **additive
  inserts only**, delete nothing, and the containment backstop (B4) makes org rows a
  precondition for the seed's existing `hospital_affiliations` inserts: order the org
  inserts first.
- Check `supabase/demo/` (customer demo seed — a different contract) for the same
  additions.

### B8 · TS layer (`src/lib`)

- `person-footprint.ts`: both legs add `voided_at IS NULL` (the resolver feeds WRITE
  authority — missing this repeats AFF2 R1's exact shape). Keep the module without
  `'use server'` (it must not become a public authority oracle).
- New actions in `src/lib/users/actions.ts`: `endOrgAffiliation`, `voidAffiliation`,
  `voidOrgAffiliation`, `updateOrgAffiliation`; new query `getOwnPersonRecord`
  (+ own-affiliations/credentials self queries via the existing self legs). All data
  access via `src/lib/queries/` (Rule 9); pt-BR error mapping (§8).
- `registerUser`: start-date param (D13) + org affiliation creation via
  `affiliate_person_to_org_for` with the actor threaded through audit metadata
  (`app.audit_write` is NULL-actor on service paths — the `log_cpf_probe_for` pattern).
- `updateUserProfile`: entry gate → `authorizePersonScopedAdmin('fields')` (D15);
  delete the dead affiliation half and its Vitest arm that pins an unproducible path.
- `npm run gen:types` after every migration (Rule 8).

### B9 · pgTAP (numbers from the live `supabase/tests/` listing at branch time — never
      eyeballed against this plan; two sessions once both took "the next number")

- New suite: `organization_affiliations` — policy audience (self ALLOW / org_admin
  ALLOW / sibling-org admin DENY / hospital_admin DENY), no-delete guard, audit verbs,
  door authority grids for all five new doors (each arm ALLOW + DENY), containment
  (insert hospital affiliation without org parent → refused; backstop trigger fires).
- **The C5 differential keystone** (the reason this program exists): wrong-hospital
  admin reads person + credentials pre-void (ever-held), **loses both post-void**,
  while the voided affiliation row itself stays visible to them. Assert the
  *differential*, not the post-state alone.
- Void refusal keystones: membership-ever-attached → refuse; reason-mandatory; ended
  row still voidable.
- D6 keystones: expired membership does NOT block `end_org_affiliation`; active one
  does, enumerated in `detail`.
- Dominance grid: every gate admitting `is_hospital_admin_of` (the void door) also
  admits `is_org_admin_of` — add to the D18-grid census.
- Fixture discipline: self-contained fixed-id fixtures, never seed-random ids; flags:
  verify no feature-flag enable is needed (AFF precedent: structural, no flag) so no
  silent keystone skip.
- Vitest keystones (service-role paths, no RLS backstop — 0098 §W3.2): wizard authority
  (org_admin only), deactivation offer appears only on empty platform-wide footprint,
  footprint resolver's voided exclusion, `updateUserProfile` tightened gate (both
  directions: allowed admin still allowed, previously-allowed-now-out actor refused).

## Track F — frontend (frontend-design skill BEFORE any new screen; pt-BR UI;
   labels/keyboard/visible focus on every input; GSAP micro-animation mandate)

### F0 · DatePicker accessible-name fix — FIRST commit, its own diff

- `aria-labelledby="{labelId} {buttonId}"` per the register's measured mechanism.
  23 call sites change accessible names → coordinate with T6 (run affected specs,
  never string-sweep — 3 of 6 breakages in the restyle incident surfaced only by
  running). Do not touch the `role="status"`/`role="alert"` asymmetry (R2-M4, separate).

### F1 · Error boundaries

- `src/app/o/[org]/manage/error.tsx` **and** `src/app/o/[org]/error.tsx` — both files
  (an `error.tsx` never wraps its own segment's layout; if only one existed it must be
  the second). Calm-clinical pt-BR copy, retry affordance.

### F2 · Affiliations panel (staff data + void)

- Display + edit `job_title` / `work_email` / `work_phone` (D14 field ownership: that
  hospital's admins + org admin). Void action per row: dialog with mandatory reason,
  refusal rendering (the blocker `detail` verbatim in pt-BR), *Anulado* badge on
  voided rows. Ended rows keep the existing *Encerrado* treatment.

### F3 · Org offboarding wizard (D12)

- New org_admin-only action in `user-lifecycle-actions`: *"Desligar da organização"*.
  Steps: (1) blockers enumerated — seats to remove, affiliations to end — with links
  to the owning controls; (2) end org affiliation; (3) **offer** deactivation iff the
  platform-wide footprint is now empty (explicit, refusable, never automatic).
- `account-situation-banner` copy extended to explain the three paths. ⚠ The parent's
  callback contract: banners set before an unmounting callback never paint — make the
  completion callback required (the recorded component-ownership lesson).

### F4 · Registration start date (D13)

- "Data de início" lands in the wizard **wired to the action** — an input whose value
  the backend discards is worse than an absent one (the register's own words); F4
  therefore depends on B8's `registerUser` change.

### F5 · `/conta` "Meus dados" (D14)

- New nav entry + read-only page: identity (masked CPF, DOB, phone via
  `getOwnPersonRecord`), own credentials, own affiliations with work data + org
  status. A pt-BR note: corrections are exercised administratively. No edit controls.

### F6 · Directory status + filter

- Status chip (ativo/encerrado) + "incluir desligados" toggle wired to
  `p_include_ended`. Empty states must never be ambiguous between "none" and
  "no access" (the standing invariant).

## Track T — tester (never edits app code)

- **T1** · Repair the suspend spec (`user-registration.spec.ts:463`): make it actually
  suspend (the DatePicker emits its hidden input only with a `name` prop — drive the
  real control), assert suspension took effect AND auto-reinstatement. This spec must
  demonstrably fail against a broken suspend before it counts (prove the check can fail).
- **T2** · Org offboarding E2E: blocked path (blockers listed) → guided completion →
  roster shows *Desligado* behind the filter → deactivation offer: accept arm + decline
  arm. Keyboard-only flow for the wizard (the per-phase a11y requirement).
- **T3** · Void E2E: create mis-entry → void with reason → badge renders; roster/panel
  reflect it. (The read-revocation differential is pgTAP's job — the browser asserts UI.)
- **T4** · `/conta` Meus dados spec: masked CPF rendering, read-only-ness, self data.
- **T5** · Registration start-date spec (value round-trips to the affiliation row).
- **T6** · DatePicker locator sweep: run every spec touching date fields after F0;
  update locators by ROLE+NAME (never `getByText`, never styling classes).
- Specs query by role+name; no `networkidle`; fixtures deleted by identity, never
  positionally (seed rows are a shared contract).

## QA + Phase Gate (§6, in order)

1. Lint (all ten) + typecheck + vitest + **pgTAP on a fresh `supabase db reset`**.
2. Authz arms: `ARM=census` (the one that catches the new gates) · `ARM=hat` ·
   `ARM=floor` · `FROMFINDINGS=1 ARM=wrapper` — **plus the diff-scoped door sweep**
   over B3's three altered policies + every new prosecdef gate, list derived from the
   migration diff (post-P2 recipe). BLIND blocks; ERROR is not a pass. Restore the
   findings file per P3's now-guarded flow.
3. Full `npm run e2e:prod` (Windows, fresh reset, quiet tree) diffed against P4's
   named-flake baseline — "mine or pre-existing?" is answered by re-running the
   suspect alone.
4. `qa` writes `docs/reviews/aff4-review.md`.
5. PO approval → Record step: PROGRESS.md updates + rotations in the same edit,
   `docs/backend-state.md` AFF4 section, FUP discharges (each closed item's index line
   AND body, both halves), `phase(AFF4): complete` commit. Graph refresh is lead-only,
   after the merge, own `chore(graphify):` commit.

**Rollout (after approval): schema first, then code** — `npm run db:push` (needs the
user's own auth; verify in the **remote catalog**: migration count + the new relations,
never `db push`'s report), then `git push` (Coolify auto-deploys on push; additive
migrations are old-code-safe, new-code/old-schema is not — the AFF2 order, kept for the
same reason).

## Risks & standing traps (named so nobody re-derives them mid-build)

- **Parallel numbering:** no second feature branch during AFF4; if one appears, the
  incoming side renumbers (ADR + migrations + pgTAP), citations included.
- **Shared local stack, one owner:** `db reset` during another session's evidence run
  lands silently in their results. Coordinate resets.
- **Windows editing:** no `sed -i`/`>`-round-trips on UTF-8 files (mojibake compounds);
  Edit tool only. ⛔ Never run Prettier on `src/` or the tracker docs.
- **`ON CONFLICT` must name its target** (an untargeted one swallows the new partial
  unique). **`citext`** claims verified against the catalog (an ADR once claimed
  signatures the catalog contradicted).
- **A green baseline is not fitness to mutate:** mutation-style pgTAP checks run on a
  fresh reset only.
- **The E2E seed contract:** additive seed changes only; a positional cleanup that
  eats seed rows breaks ~900 tests.
- **`preview_start` ignores worktrees** — frontend verification runs the primary
  checkout's launch config; verify on the branch's own dev server or after merge.

## Acceptance criteria (beyond the ADR's D-list)

1. An org admin can fully offboard a person end-to-end in the wizard, every step
   audited, and the person leaves the default roster while staying reachable behind
   the filter.
2. The C5 differential holds in pgTAP (pre-void read / post-void no-read / row still
   visible) and C5 leaves § Critical FUP at the Record step.
3. A rehire at a hospital of the same org is one action by that hospital's admin.
4. `/conta` shows the titular their own record, read-only, masked CPF.
5. Registration writes the start date the user typed.
6. All eleven FUPs named in ADR 0151's Consequences are discharged at Record —
   index line and body both.
