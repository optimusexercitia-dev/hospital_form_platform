# AFF4 — implementation plan: org affiliation, staff data, the voided tense

**Status: BUILD IN PROGRESS on `feat/aff4-org-affiliation`** (PO's go 2026-08-26). **Authority is
ADR [0151](../decisions/0151-aff4-organization-affiliation-staff-data-voided-tense.md)**
(D1–D17) as amended by **[0154](../decisions/0154-roster-predicate-is-the-query-filter-not-list-org-people.md)**
(D10's roster predicate) — where this plan disagrees with an ADR, the ADR wins; where either
disagrees with the **live catalog**, the catalog wins. Analysis + rejected alternatives:
[org-affiliation-and-staff-data-model.md](./org-affiliation-and-staff-data-model.md).

## ▶ RESUME HERE — state at the 2026-08-26 pause

⛔ **Re-measure everything below before acting on it.** Commit counts, gate figures and stack
state go stale the moment they are written; this block records *what was done and what is next*,
never a figure to quote.

**DONE and committed** — B1 · B2 · B3 · B4 (increments 1–3) · the B8 contract + the four org/void
actions + `getOwnPersonRecord` wired live · F0 · F1 · F2 · F3 · F5 · F6's badge. All four authz
arms hold (`census` · `hat` · `wrapper` · `floor`). C5's keystone (`374`) was observed **RED at
2/15 before B3** and the red is **reproducible from the migration alone**.

**NEXT, in this exact order — `backend` gated its own start on it:**
1. `supabase db reset` (fresh, announced)
2. **The owed pgTAP half of the door-SQLSTATE coverage gate** — catalog `==` declared set, which
   catches a code existing only after a runtime body rewrite. ⛔ **Its verdict must be reported
   before B5 begins; the ABSENCE of that verdict is the signal B5 has not started.** This
   obligation was already dropped once (see *"an approval is not a completed action"* below).
3. **B5** — the backfill. 4. **B6** — the **widened** ADR 0154 form, per the ruling in B6 above.
5. Then B7 (seed) · the rest of B8 (D13 `registerUser` start date; D15 `updateUserProfile`) · B9.

**Then:** `frontend` F4 (released when B8's `registerUser` lands) and F6's toggle (released when
B6b lands) — both **held, not forgotten**. `tester` T2–T5 after that. Then `qa`, then the §6 gate.

**IN FLIGHT at the pause:** `tester` on T1 + T6 + the accessible-name composition assertion, in a
lead-granted DB window. ⛔ **`backend` holds off the stack until it hears the literal words
"handing back"**, which requires the tester confirmed finished **by measurement** — processes gone,
ports free — not by its own report.

**⚠ TWO OPEN PO DECISIONS, neither blocking:**
- **`BUG-SUSPENSION-DATE-RENDERS-A-DAY-EARLY`** — what does *"suspended until the 25th"* mean
  (00:00 or 23:59:59, in whose zone)? Detail below; **found, deliberately not fixed.**
- **Merge order** vs `claude/angry-stonebraker-c8e637` (the DatePicker bucket) — its call-site
  changes have had **no E2E pass**, so if it merges before AFF4's `e2e:prod`, any flake it produces
  lands in AFF4's numbers. Detail in *Risks* below.

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

### P1 · ~~Fix~~ **DIAGNOSE** `FUP-OPEN-DOCUMENT-VERSION-500-ON-EVERY-RAISE` — ✅ **CONCLUDED 2026-08-26 as DIAGNOSED + RE-SCOPED**

- **Root cause identified, and the item's premise refuted.** PostgREST v14.5 maps the
  SQLSTATE class `P0*` to HTTP 500 (`P0001` excepted); the status is a **pure function of
  the SQLSTATE** (`HC***` → 400, `42501` → 403, `P0002` → 500). Not media-type handling.
  Three of the register's claims were measured **false**: the `text/plain "Something went
  wrong"` body does not reproduce under any `Accept` header; it is a **P-class quirk**, not
  "every raise" (the door's own `HC0D8` refusal returns a correct 400); and it is **not
  app-facing** — `mapDocumentErrorCode` already maps `P0002 → not_found` from the JSON body,
  so **§8 is not violated**, which was the stated merit for keeping it in the pre-step.
- **PO ruling 2026-08-26 (ADR [0152](../decisions/0152-postgrest-p-class-sqlstate-maps-to-500.md),
  amends ADR 0151 D16a):** no fix here. The residual defect is a **class** — 73 `public`
  functions with EXECUTE for `authenticated` raise a P-class code — re-filed as
  `FUP-P-CLASS-SQLSTATE-ANSWERS-500-ON-DENIAL` for its own increment. ⛔ **No partial fix:**
  converting 2 of 73 makes denial semantics inconsistent (0152 D3).
- The FUP is discharged (index line + body both moved to `follow-ups-archive.md`, body kept
  verbatim so the false claims stay visible beside their correction).

<details><summary>Original P1 task text, superseded</summary>

#### P1 · Fix `FUP-OPEN-DOCUMENT-VERSION-500-ON-EVERY-RAISE` (backend)

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

### B6 · Re-predicate BOTH roster surfaces (D10) — ⚠ WIDENED 2026-08-26, PO-ruled

> ⛔ **This task's original text named the wrong function, and so does ADR 0151 D10.**
> Measured 2026-08-26 against the live code: `list_org_people` has exactly ONE caller —
> `lookupOrgPeople` (`src/lib/affiliations/actions.ts:203`), consumed by
> `register-person-flow.tsx`. That is the **add-a-person CPF/name search**, not the
> directory. The actual roster predicate is `src/lib/queries/org-users.ts:449` —
> `.eq('home_organization_id', orgId)` on `profiles`, inside `listOrgUsers`, with
> `listHospitalUsers` as its hospital-scoped sibling. Re-predicating `list_org_people`
> alone could not satisfy acceptance criterion 1. **PO ruling: both surfaces move.**
> Record obligation: **ADR 0154** amends 0151 D10 (header must carry `**Amends:** 0151` —
> the label is the only input to the back-pointer and no gate can notice it missing).

- **B6a — `list_org_people` (the add-a-person search).** Predicate moves from
  `profiles.home_organization_id = org` to `EXISTS (org affiliation to org, voided
  excluded)` — **ever-held**, with new param `p_include_ended boolean DEFAULT false`.
  Payload gains org-affiliation status (`ativo`/`encerrado`) + `ended_on`.
  CPF-lookup audit behavior stays byte-identical (`person.cpf_lookup`, per-call, never
  the digits). Gate predicate (org_admin OR active hospital_admin hat) unchanged.
  ⚠ This body is one of the **four** that use `ended_on is null` as an activeness test
  and must gain `and voided_at is null` (measured over comment-stripped `prosrc`; the
  other three are `app.affiliate_person_impl` / `end_affiliation_impl` /
  `update_affiliation_impl`, which land in B4).
- **B6b — `listOrgUsers` / `listHospitalUsers` (the actual directory roster).** Same
  org-affiliation predicate, off `home_organization_id`. This is the half acceptance
  criterion 1 depends on.
- ⭐ **RULED 2026-08-26 — where the default-active filter lives, and how parity is enforced.**
  The semantic has two possible homes (`p_include_ended` at the door; a TS option on the
  queries), and choosing differently in each is how the surfaces drift. **Ruling:**
  - **Filter at the DATA-ACCESS boundary in both**, never deferred to the page. If the page
    narrows, every future caller gets the wide set by default and must *remember* to narrow —
    a remembered step. At the boundary, the safe set is the default and widening is explicit
    and visible at the call site (*narrowing can be wrong and safe; widening cannot*).
  - **Same name both layers** (`p_include_ended` / `includeEnded`), **same default (active-only)**,
    with `lookupOrgPeople` the **single explicit widener** for D5's one-step rehire.
  - ⛔ **REJECTED: unifying the predicate by routing `listOrgUsers`/`listHospitalUsers` through
    `list_org_people`.** It looks cleaner ("one predicate cannot drift from itself") but that door
    carries **its own authorization gate** *and* **per-call `person.cpf_lookup` audit behaviour** —
    the roster is not a CPF lookup, and this would emit lookup-audit rows on every directory page
    view, silently changing the audit surface (Rule 11). `listHospitalUsers` is also hospital-scoped
    where the door is org-scoped-with-a-hat. **Three semantics conflated to remove one duplication.**
  - ⚠ **The parity assertion spans two runtimes and therefore has NO unit-level home**: the door is
    pgTAP-only, the TS queries are Vitest-only, and neither can assert the two *agree*. Assert each
    side in its own runtime (Vitest via a **recording mock proving the filter was actually requested
    of the database** — a query-level filter is invisible to any assertion over returned shape), and
    keep the cross-reference **as a courtesy to readers, explicitly NOT as the parity mechanism**.
  - ✅ **The parity gate is E2E, and it is `tester`'s (T2).** That is the only gate exercising the
    SQL door and the TS query in one process. After an offboarding: the **directory** drops the
    person by default, the **add-person search still finds them** (D5 rehire), and the *"incluir
    desligados"* toggle brings them back. **This reds if either surface changes its default alone** —
    which two independently-green unit tests never would.
- ⛔ **RLS legs and the tenant trigger STAY on `home_organization_id`** — untouched,
  still D10's named Phase 2 follow-on. The split being applied: *"roster predicate"* =
  the application query's filter; *"existing legs"* = the policies. Both of D10's
  sentences stay true under that reading.
- **Ruled semantic — the two surfaces default differently.** An org-offboarded person
  must stay **findable in the add-a-person CPF search**, or D5's one-step rehire is
  impossible (a hospital admin cannot rehire someone they cannot find). So: the
  **roster** defaults to active-only behind an explicit toggle; the **add-person search**
  reaches ended people. If that makes `p_include_ended`'s default awkward at the door,
  raise it rather than bending one surface to match the other.

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
- ⚠ **The nav entry has a trap, measured 2026-08-26.** `ContaNav` lives OUTSIDE the
  route at `src/components/notifications/conta-nav.tsx`, and `conta/layout.tsx` renders
  it **only when `notificationsEnabled()` is true** — deliberately, because both its
  current targets 404 when that flag is off. **Meus dados is NOT flag-gated** (AFF4 is
  structural, no feature flag — the AFF precedent), so simply appending it to `ITEMS`
  makes the page unreachable in exactly the deployments where the flag is off, with no
  gate able to notice. Split the nav: the always-available entries render
  unconditionally, the notifications-dependent ones stay behind the flag. Update the
  component's doc comment, which currently asserts "it never points at a dead route" —
  that sentence becomes false the moment an ungated entry is added beside a gated nav.
- The DOB column is **`date_of_birth`**, not `birth_date` (catalog-measured; the ADR's
  D14 wording is loose). CPF arrives already masked — `getOwnPersonRecord`'s TS return
  type carries no raw CPF field at all (lead ruling, so masking is a type-level
  guarantee rather than a remembered step).

### F6 · Directory status + filter — ⚠ RE-TARGETED 2026-08-26 (see B6)

- Status chip (ativo/encerrado) + "incluir desligados" toggle on the directory at
  `src/app/o/[org]/manage/usuarios/page.tsx`. ⛔ **It wires to B6b
  (`listOrgUsers`/`listHospitalUsers`), NOT to `list_org_people`'s `p_include_ended`** —
  the directory never calls that RPC; `list_org_people` backs the add-a-person search
  (`register-person-flow.tsx`). The original F6 text pointed at the wrong function.
- Both the org-wide arm (`listOrgUsers`) and the hospital-scoped arm
  (`listHospitalUsers`) must honour the toggle — a `hospital_admin` sees only the
  second, so wiring one arm leaves that role's roster permanently active-only.
- Empty states must never be ambiguous between "none" and "no access" (the standing
  invariant; `user-directory-list.tsx` already carries that reasoning in-file — follow
  it, don't restate it).

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
  ⚠ **A second branch DID appear — `claude/angry-stonebraker-c8e637`** (the DatePicker
  wrapping-`<label>` bucket F0 deferred). Numbering held: it took **no** ADR, migration or
  pgTAP number, only a namespaced bug id (`BUG-CASEPHASE-DUEDATE-001`), and it cherry-picked
  `date-picker.tsx` + `date-time-picker.tsx` from `5e7288b5` **byte-identical** — blob hashes
  `cd337073…` / `0950c364…`, verified on both sides, so those files cannot conflict.
- ⭐ **MERGE ORDER — PO-RULED 2026-08-26: AFF4 merges FIRST; the DatePicker branch is HELD.**
  Its **8 call-site changes have had NO E2E pass** (its own session swept for name matchers and
  said plainly that a grep is not a run). Had it landed first, AFF4's full `e2e:prod` would have
  run over changed accessible names nobody had executed, and any flake would have arrived wearing
  AFF4's name — and *"mine or pre-existing?"* is only answerable by re-running a suspect **alone**,
  which costs far more once two branches are interleaved in one tree.
  **Consequences to hold at merge time:**
  - AFF4's gate runs on a tree **excluding** those 8 sites. Their coverage is that branch's own
    tester pass, which the hold gives it time for — ⛔ **an untargeted whole-suite run that happens
    to touch a change is not a pass aimed at it.**
  - That branch rebases onto post-AFF4 `main`. `date-picker.tsx` / `date-time-picker.tsx` are
    **byte-identical across both** (verified blob hashes `cd337073…` / `0950c364…`) and the two
    call-site sets are disjoint, so it should rebase clean. ⚠ **A conflict in either control file
    means the byte-identity assumption broke** — stop and re-verify rather than resolving it.
  - ⚠ **`BUG-CASEPHASE-DUEDATE-001` rides on that held branch** — live data-loss on `main`: a label
    click clears an in-dialog date, and saving then drops an existing phase deadline (recoverable if
    noticed; **major, not a blocker**). The hold was ruled about **gate attribution**, not about
    sitting on a defect — if the wait grows, re-ask the PO rather than wait longer.
    ⛔ **There is NO cherry-pick fallback, contrary to an earlier framing here.** The data-loss fix
    and the a11y fix are **the same edit**: the wrapping `<label>` binds to its first labelable
    descendant, so un-wrapping is simultaneously what stops "Remover prazo" stealing the label *and*
    what lets `aria-labelledby` re-admit the value. Cherry-picking puts **one file's** changed
    accessible names into AFF4's gate rather than ten — a smaller blast radius, **not zero**. Do not
    decide the exception believing the a11y change can be left behind.
  - ⭐ **The hold's premise is dissolvable, which is cheaper than the exception.** The constraint
    exists *because* those 8 sites are unexercised; once that branch runs its own tester pass, a flake
    in AFF4's gate is no longer attributable to them and the ordering mostly stops mattering. The
    local DB was released to that branch during AFF4's pause for exactly this reason.
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

## PRE-EXISTING defects found and FIXED during AFF4 — § Bug Log entries at Record

⛔ **Each landed in its OWN commit, deliberately not absorbed into an AFF4 commit** — the
history must say what was wrong and since when. None was introduced by this program; all
three were found because AFF4 was editing adjacent code.

- **`BUG-AUTHZ-FOOTPRINT-ASYMMETRIC-READ-LIFTS-THE-D2-LOCK`** — fixed `9175b9a5`.
  `resolvePersonFootprint` dropped `error` on both service-role reads. A **memberships**-read
  failure *alone* left `hospitalIds` populated (so it sailed past the explicit empty-footprint
  guard) while clearing `hasNonCommissionTierMembership` — lifting the ADR 0133 D2 org-tier
  lock and granting a `hospital_admin` `lifecycle` (SUBSET) **over an org admin**.
  Pre-existing since ADR 0133 (AFF2). `getPersonAdminView` inherits the fix.
  ⚠ **The likelihood runs the wrong way:** the memberships query joins `commissions`, so it is
  the *heavier* read and the *more* likely to fail under pool pressure — the failure that
  removes the lock is the more probable one, which inverts the usual unlikely-error discount.
  ⚠ **The lead's hypothesised mechanism (empty footprint ⇒ SUBSET satisfied vacuously) was
  WRONG and is recorded as ruled out:** `personScopeAllows` pins `if (footprintHospitals.size
  === 0) return false` with a comment naming the vacuous-subset inversion. Recorded so nobody
  re-derives it. Keystone `person-footprint-reads.test.ts` asserts *the consequence* — the
  perturbed footprint GRANTS what the true one DENIES — so the throw cannot later be deleted
  as defensive tidiness.
- **`claims_for` vacuity — 3 tenant-isolation assertions passing for the wrong reason.**
  `test_helpers.claims_for(user, is_admin)` derives the `active_role` claim **only** when the
  persona holds exactly one live role. Persona `…00b2` holds two, so three cross-org DENY
  assertions (`301:364`, `302:286`, `302:339`) passed because `b2` **assumed no role at all** —
  not because the org anchor held. One describes itself as *the* tenant-isolation assertion.
  Bound measured before acting: 6 multi-role personas, 41 two-arg call sites, **3 affected**.
  ⚠ The first count reported was "2 pairs" — a **dedupe artefact in the measuring script**,
  not in the finding; `302` has two sites. Corrected before it was quoted anywhere.
  Fix: pass the third argument explicitly. **Then** harden the helper to *raise* on a
  multi-role persona with no explicit role, with a positive control proving the guard fires.
  ⛔ **If any of the three reds once actually evaluated against the org anchor, the build
  STOPS** — that would mean cross-org isolation is broken, and the assertion is never adjusted
  to accommodate it.
- **`app.trg_audit_hospital_affiliations` enumerated its UPDATE arms by column name**, else
  `return null` — so B2's six new columns would have been silently unaudited, making D7/D8's
  "every void is audited with its reason" false. Re-emitted from the live
  `pg_get_functiondef`. Latent, never live (no writer until B4) — which is exactly when to fix it.

## ⛔ FOUND during AFF4, deliberately NOT FIXED — needs a PO ruling, then its own item

**`BUG-SUSPENSION-DATE-RENDERS-A-DAY-EARLY`** — user-facing, pre-existing, and **filed rather
than fixed on purpose.** `profiles.suspended_until` is **`timestamptz`** (measured, not `date`);
the product write path puts the dialog's bare `YYYY-MM-DD` in with no normalisation, so it lands
at **midnight UTC**. `formatSuspensionDate`
(`src/components/users/account-situation-banner.tsx:84-88`) then formats with
`Intl.DateTimeFormat("pt-BR")` and **no explicit `timeZone`** — the runtime's. In
`America/Sao_Paulo` (UTC−3), `2026-09-25 00:00:00+00` renders as **24/09**: an admin suspends
someone until the 25th and the banner tells that user the 25th is already past. Every
product-written value, the entire target market.

⛔ **THE SEED DOES NOT REPRODUCE IT — carry this sentence or the bug dies in triage.**
`seed.sql` writes a real timestamp (`2026-09-25 10:08:42+00`), not a date string, so the seeded
row renders **correctly**. Anyone confirming against the seed finds it clean and closes this as
unreproducible. That is the fixture trap **inverted**: the fixture reaches a *passing* state the
product never produces.

⭐ **PO RULING 2026-08-26 — the blocking semantic is DECIDED: *"suspended until D"* means until
`23:59:59` of D in `America/Sao_Paulo`.** Both fixes are therefore mechanical and both are wanted:
1. An explicit **`timeZone: 'America/Sao_Paulo'`** on `formatSuspensionDate`.
2. **Normalise the write to end-of-day in that zone**, rather than start-of-day in UTC.

⚠ **One assumption is being pinned, stated rather than hidden:** this fixes a single zone
app-wide. Brazil spans four (`America/Sao_Paulo` · `Manaus` · `Rio_Branco` · `Noronha`), so the
first hospital onboarded outside UTC−3 turns this into a **per-tenant setting**, not a constant.
Recorded so that day is a known follow-on rather than a rediscovery.

**Why AFF4 still does not fix it.** The ruling makes it *implementable*, not *in scope*: it is
pre-existing, it arrives fourth after three pre-existing fixes this program already absorbed, and
AFF4 is paused. It goes to whoever picks it up with everything they need — mechanism, ruling, seed
caveat, and the two-site warning below.

⚠ **THERE MAY BE TWO SITES, NOT ONE — confirm both before fixing either.** Two readings
initially looked contradictory: `backend` measured *no normalisation at all* at the **write**
(`src/lib/users/actions.ts:1176`, `.update({ suspended_until: suspendedUntil })`), while `tester`
read the path as constructing `${date}T00:00:00.000Z`. They are **not** contradictory — they are
true of **different lines**. If a `T00:00:00.000Z` is constructed it is **upstream in the dialog**,
not at the write. So a fixer who patches only the write may leave the construction in place, or
vice versa, and either half alone still renders the wrong day. ⛔ The **outcome** is measured; the
**construction site** is not — locate it before changing anything.

## Follow-ups DISCOVERED during the build — file into the register at Record

⛔ **Collected here, not in PROGRESS.md, deliberately.** That file sat with ~300 bytes of
headroom under its 81920-byte cap while three writers shared one checkout, and a
discovered item that lives only in a chat message is invisible work. Each of these gets a
one-line index entry **and** a `follow-ups.md` body at the Record step — both halves, or
the gate reds.

- **`door-error-arms.test.ts` reports on its own list, not on the domain.** The test whose
  job is "every SQLSTATE the doors raise has an arm in `toState`" reads a hardcoded
  `DOOR_MIGRATIONS` file list and parses migration **text**. Two defects: (a) blind to any
  body rewritten at runtime via `pg_get_functiondef` + `replace` + `execute`, which this
  repo has already ruled is the normal case; (b) **silently non-covering for every new
  door** until someone edits the list — it passes 9/9 today and keeps passing whether or
  not anyone remembers. Passing-while-covering-nothing is indistinguishable from working.
  Instrument that cannot go stale: `pg_proc.prosrc`, comments stripped.
- **12 DatePicker renders sit outside F0's measured mechanism** (of 38 total; 26 were
  in-mechanism and fixed). 7 wrap the control in an implicit `<label>`, 2 use `aria-label`,
  and **1 carries no name-bearing attribute at all** — that last is an unmeasured a11y gap,
  not a styling choice. Deliberately not guessed at during F0: extending a fix to a
  mechanism nobody measured is how a partial fix reads as a complete one.
- **No error boundary in this codebase carries any entrance motion** — `usuarios/error.tsx`
  and the three others predate AFF4, and F1's two matched that template. So §1's
  micro-animation mandate is unsatisfied **app-wide and consistently**, not locally.
  ⛔ **Deliberately NOT fixed in AFF4**: animating two boundaries while four sit still makes
  the tree less coherent, and *"should an error screen animate at all"* is an app-wide design
  question — there is a real argument that motion on an error reads as flippant. Wants one
  ruling applied everywhere or a recorded exception. Filed so the gap is a **known** exception
  rather than a silent one.
- **`ROLE_LABELS[b.role] ?? b.role` renders the RAW role key when the dictionary lacks it** —
  a documented, deliberate *"untranslated is better than unnamed"* trade-off predating AFF4,
  now at **two** sites (`affiliations-panel.tsx` and F3's blocker list, which inherited it
  rather than re-deciding it — the right call from inside a feature task). Not a §8 violation:
  an untranslated role key is not a raw Postgres error. Filed because the day a role ships
  without a label, two surfaces degrade together and the record should say why.
- **QA item, not a follow-up:** `deactivateUser`'s pt-BR error text is **trusted from the
  module header, not independently verified** — named as such by `frontend`, correctly, since
  verifying another module's strings from inside a frontend task erodes file ownership. `qa`
  closes it.
- **The `claims_for` vacuity class has NO measured denominator** — and the fix count must
  never be quoted as if it did. Three real defects were found and fixed (`ff596034`), but
  the predicate that found them covered **literal-UUID two-arg calls naming a multi-role
  SEED persona**. Calls passing a variable, or naming a fixture-created principal, were
  never in its domain. ⚠ **The reported bound was 41 two-arg call sites; the true count of
  `claims_for(` across `supabase/tests/` is 2449.** That is the difference between a
  measured *domain* and a measured *syntax* — a half-swept class buried under evidence of
  thoroughness.
  ⛔ **Do NOT close this by making `claims_for` raise.** That was authorized by the lead,
  built, and **reverted** — "2+ roles → no claim" deliberately mirrors production's
  `custom_access_token_hook` D11 break-glass logic, so raising there would diverge the
  harness from production *and* make the genuine **multi-role hatless caller** (a real
  D5/D11 state) permanently untestable. Trading away a testable authorization state to
  catch a fixture mistake is the wrong trade. The positive control the lead required is
  what caught it — standalone it passed, in the full suite it failed `caught: no exception`.
  Right shape instead: a **detector** that reds on two-arg calls naming a multi-role
  persona, leaving the helper faithful to production. Needs the DB (persona role counts),
  so it belongs with the pgTAP gates, not `lint`. Building it is also what would finally
  give the class a real denominator.
- **`supabase/tests/00_setup.sql` COMMITS OVER a migration's function definition.** It runs
  `create or replace function test_helpers.claims_for(...)` as DDL **outside** its
  `begin/rollback` block, so it overwrites migration `20260918002000`'s version — meaning
  that migration's definition is **never in force during any test run**, and anyone reading
  it to learn what the helper does is reading something false. ⚠ This is the
  migration-text-is-stale hazard from a direction not previously recorded: not a runtime
  `pg_get_functiondef` + `replace()`, but a **test fixture outrunning a migration**.
- **NINE instruments in one build whose success output was indistinguishable from the real
  thing** — a pattern, not nine incidents. In every case the human-readable output looked
  right and the honest instrument was an exit code or a direct measurement:
  1. `| head -10` clipped a process list to ten rows, all `chrome.exe` — read as a clean check.
  2. A reset-log grep for `error|failed` matched two migration **filenames**
     (`…_ff3_validation_error_surface.sql`) — a clean run read as a failing one.
  3. `rm -f` silently no-opped on a mistyped path; only `git status` caught it.
  4. **A gate result laundered through a pipe** — `npm run lint:progress | tail -3` returns
     `tail`'s exit status, so a failing gate passed an `&&` chain and was committed over.
  5. **`git status` answering a different question than the one asked.** Gate figures looked
     unstable across passes because `git status` differed — but a commit *records* a file
     without altering the working tree, so the bytes the gates read never changed. A correct
     invocation of the wrong instrument. ⚠ The same instrument failed from the **opposite**
     direction the same hour: under `core.autocrlf=true` it calls a CRLF-drifted file
     unmodified, so the drift is invisible **and** `git checkout --` silently no-ops against it.
  6. **`cat -A` not showing line endings** — the tool whose entire job is displaying them
     printed `$` rather than `^M$` on a CRLF file, after a patch had already failed to match
     LF anchors.
  7. ⭐⭐ **`tasklist /FI "IMAGENAME eq node.exe"` under Git Bash — a CONSTANT `0`.** MSYS path
     conversion rewrites `/FI` into `C:/Program Files/Git/FI`; tasklist errors to **stderr**
     (discarded by `2>/dev/null`), and `| wc -l` on empty input prints **`0`**. Verified against
     a moment with **seven** node processes running, one holding `:3000`. **The lead used this
     as the precondition for authorizing two `db reset`s.**
  8. ⭐⭐ **`grep -cE '^not ok'` on `supabase test db` output — also a CONSTANT `0`.** pg_prove
     **consumes** the raw TAP stream and emits its own summary, so **no `not ok` line is ever
     printed**. Found by positive control: a log from a run known to have FAILED scores
     `^not ok = 0`, identical to every passing run. It was appended to nearly every pgTAP figure
     reported for a day.
  ⭐⭐ **7 and 8 are a DIFFERENT SPECIES from 1–6, and the difference is what makes them
  dangerous.** 1–6 produced *wrong* answers. **7 and 8 produce a CONSTANT** — so they agree with
  the truth whenever the truth is "0" and disagree **silently** whenever it isn't. A constant-`0`
  instrument is invisible *because it is usually right*: it can only be wrong on the rare failing
  run, and **"0 failures" is the most reassuring number in any gate report, so it is the last one
  anyone interrogates.**
  ⛔ **The operational consequence: a broken instrument that AGREES with a sound one adds nothing
  while making the conclusion feel more verified.** Both the lead and `backend` did exactly this
  to each other — pairing a real measurement (exit code; `netstat` port check) with a constant and
  presenting the pair as corroboration. **Corroboration from an instrument that always returns the
  same answer is not corroboration.** Neither party's *conclusions* were wrong, because the sound
  half carried them; the confidence was inflated.
  ⚠ **Same mechanism, opposite visibility — and only one is dangerous.** MSYS path conversion also
  hit `docker exec … psql -f /tmp/m3.sql` (rewritten to a Windows temp path). **That one failed
  LOUDLY** — file not found — and was fixed in minutes. The lead's failed **SILENTLY** and ran for
  a day. When auditing for this class, the loud failures are already handled; hunt the silent ones.
  9. ⭐ **A process count that COUNTS ITSELF.** The sound replacement for #7
     (`tasklist | grep -c "^node.exe"`) returned **2** where the broken `/FI` form returned 0 — but
     re-sampling gave `0, 0, 0`: **the two node processes were spawned by the measuring command's
     own `$(...)` substitution.** The instrument created what it counted. A *correct* instrument,
     honestly read, still producing a self-generated artifact. ✅ The signal that actually decides
     "is a server holding the DB" is **`pg_stat_activity`** — a client backend that is not
     PostgREST/realtime/your own `psql` — not a process count at all.
  ⭐⭐ **THE RULE, and it is cheap enough that there is no excuse:** **every counting instrument in
  a gate report must be run once against a KNOWN FAILURE before its zero is believed.** Reading the
  command never reveals this class — both constants look correct on inspection, and #8 was found
  *only* by scoring the pattern against a log already known to have failed. A positive control is
  one command; a constant that agrees with you costs a day.
  ⛔ **Hunting heuristic: skip the loud failures — they are already fixed. Hunt the CONSTANTS.**
  Loudness, not severity, decided which of the two MSYS failures cost anything.
  ✅ **Sound replacements, no path-like args and no pipe swallowing a zero-match grep:**
  `tasklist 2>/dev/null | grep -c "^node.exe"` · `netstat -ano | grep LISTENING | grep -E ":(3000|3001)\s"` ·
  pgTAP verdict from the **exit code captured without a pipe**, corroborated by `Result: PASS|FAIL`
  and `Failed N/M subtests`, both positive-controlled against a known-failing log.
- ⭐⭐ **AN ENUMERATION BOUNDARY DRAWN ON A *SYNTAX* CANNOT ENFORCE A *PROPERTY*** — now three
  distinct instances in this program, so it is a class, not three anecdotes:
  1. The census's domain is wider than ARM 1's neutralization reach, so it names gates no arm
     can sweep — and its own "Fix:" text sends you to a sweep that returns *NOTHING WAS MEASURED*.
  2. `"DateTimePicker"` does not contain `"DatePicker"` — "Time" splits it — so a literal grep
     for one silently skips 9 of 26 sites.
  3. `door-error-arms.test.ts`'s splitter required **`create OR REPLACE function`**, and AFF4's
     doors are bare `create function` (new — nothing to replace), so **every new door was skipped
     regardless of which files were in scope**.
  ⛔ **(3) was a near-miss on a FALSE FIX, and that is the durable part.** The test had *two*
  defects — a hand-maintained file list *and* the syntax-bound splitter — with the **same
  symptom**. Fixing only the visible one (adding three filenames) would have produced a green
  gate, a closed item, and **zero coverage**, indistinguishable from a real fix. Backend's own
  words: *"I would have added three filenames, watched it stay green, and reported it closed."*
  ⭐ **Where two defects share a symptom, fixing one and re-running looks exactly like fixing
  both.** The only defence is deriving the domain from the property that decides it — here, the
  SQLSTATEs reachable from the doors `actions.ts` actually calls — and proving it by mutation.
- ⚠ **An approval is not a completed action.** The lead said *"B4 carries it"*, backend agreed,
  and **neither checked across three increments** — so the door-SQLSTATE coverage test ran green
  while covering **none** of the five new codes. Nothing shipped broken (the arms existed), but
  nothing was checking and the check reported success. ⭐ *Did the thing I approved actually
  land?* is a Record-step obligation, not a memory.
- ⭐⭐ **A mutation that kills the suite before reaching the arm under test proves NOTHING
  about that arm — and its red is indistinguishable from one that does.** The lead specified
  `where pr.id = v_uid` → `where true` to prove a keystone discriminating. That returns 36
  rows, an earlier arm's scalar subquery raises, and **the suite aborts at test 35 of 39 — the
  arm under test never executes.** The run reds. Accepted in good faith it would have been
  vacuous proof. The correct mutation returns a **fixed row**, preserving suite completion so
  all 39 arms run and the right one fails with the right signal. ⛔ **Mutation testing needs
  its own liveness check:** confirm the mutated run *reached and executed* the arm, not merely
  that it went red. The pgTAP **plan count** is what made it visible (*"planned 39, ran 35"*)
  — its fourth real catch, as a detector rather than a formality. Both mutations, including
  why the obvious one is worthless, are recorded in the backlog entry itself.
- **Code written against a CONTRACT does not go stale when the implementation lands; code
  written against an implementation's current STATUS does.** Two stub→live flips happened in
  this build. The first left a stale comment (*"`assertStaffDataWired` throws until…"*); the
  second left nothing, and the reason is structural — the void dialog, the wizard and the
  self-record page were all written against the contract's success/refusal shape, never
  against "this currently throws". The one stale assertion the first flip produced was the
  one place a status had been asserted inline. ⭐ Useful as a *predictor* of where to sweep
  after any stub goes live: grep for status claims, not for the function name.
- **FIVE date fields have ZERO E2E coverage — two of them AFF4 surfaces.** Derived by the T6
  breadth sweep and reported verbatim; **not** fixed in T6, and T2–T5 own writing this coverage:
  1. `custom-field-input.tsx`'s `date` branch — no spec ever creates a `date`-type custom field.
  2. `publish-button.tsx`'s "Data de vigência" metadata.
  3. ⭐ **`affiliations-panel.tsx`'s "Data de início" (AFF4 surface)** — its dialog *is* opened
     repeatedly by `aff-hospital-affiliation.spec.ts`'s `openAffiliationDialog()`, but **only
     "Matrícula" is ever touched inside it**. A route-presence check would over-count this as covered.
  4. `rca-timeline-panel.tsx`'s "Data e hora" — the RCA route is visited by `phase14c-rca.spec.ts`
     R1/R16, but the "Adicionar evento" dialog is never opened in-browser; R7 exercises the RPC via
     `request` only, with no `page` at all.
  5. ⭐ **`register-person-flow.tsx` / `register-person-wizard.tsx`'s Nascimento / Início-do-vínculo
     (AFF4 surface)** — zero hits in any spec.
  ⛔ **(5) is the one that bites: D13's `registerUser` start-date change lands on a path with no
  browser coverage**, so nothing downstream catches the value being silently dropped until T5 exists.
  `backend` is carrying that weight deliberately in pgTAP/Vitest with an assertion that **fails if
  the parameter is dropped**, not one that merely passes when it is present.
- **Seven pgTAP suite numbers are shared by two files each** — `60`, `61`, `110`, `188`,
  `189`, `201`, `270`. Pre-existing, and harmless to *execution* (unlike a duplicate
  migration version, which can silently not apply — `supabase test db` runs every file).
  The cost is **citation**: "suite 189" names two different suites, so a gate record, a
  review or an ADR referring to one by number is ambiguous and cannot be resolved without
  opening both. This is the recorded parallel-branch collision pattern — two sessions each
  take "the next free number", git merges both cleanly, and every one is wrong.
  ✅ **Checked during AFF4, not assumed:** `374`/`375` are unique, migration versions have
  **zero** duplicates, and the ADR next-free (`0154`) matches the highest on disk (`0153`) —
  so nothing this program took has collided with the concurrent sessions.
- **`professional_credentials_select` uses bare `auth.uid()`** where both `profiles`
  policies use `( SELECT auth.uid() )` — a per-row-vs-InitPlan evaluation difference.
  Correctly kept out of B3 (one conjunct, nothing else); it needs its own item so the
  mechanism is recorded rather than rediscovered.

**Flake-baseline data point (not a follow-up, a gate input).** F0's first full-parallel
spec run threw 28/34 failures on *unrelated* ACs (login/navigation timeouts, e.g. a plain
dashboard headline count), all green on a `--workers=1` rerun. That is the known Windows
parallelism/cold-start collapse, and it is why AFF4's gate run must be the batched
`npm run e2e:prod`, **never** a parallel monolith — a monolith's reds here say nothing
about the branch.

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
