# Phase F1 — Case-Participants E0 — QA Review

**Verdict: APPROVED** (re-review 2026-07-10, after the fix loop closed the initial CHANGES REQUESTED)
**Commit reviewed:** `ef66b0a` + fix-loop changes in the working tree (uncommitted at re-review time)
**Reviewer:** `qa` · **Date:** 2026-07-10
**Scope:** ADR 0064 (E0 slice) + ADR 0066 (patient_xref re-key), conforming to ADR 0065 (F0 conventions).
Structural, pre-pilot, reset-OK, flags OFF.

**Summary counts (as originally found):** 0 BLOCKER · 1 MAJOR · 2 MINOR · 3 INFO — **all addressed** (see
"Re-review — fix-loop verification" below).

---

## Re-review — fix-loop verification (2026-07-10)

`backend` applied all five fixes on a fresh reset; verified against the live DB + migration/test source
(the migrations are the truth — the tree is uncommitted). All findings closed; verdict flips to **APPROVED**.

**MAJOR-1 — CLOSED.** `grant select ... to authenticated` now present on all 7 non-PHI tables (in the F1
migrations: `…000000` L70/115/181/226/306/338, `…000100` L143). Live: `has_table_privilege('authenticated',
…, 'SELECT') = t` on all 7 (was `f`). The shipped `_select` policies are now reachable — proven by K9
running a plain `select` **as `authenticated`** (`set local role` + `claims_for`, not superuser/DEFINER).
`patient_identifiers` / `patient_participants` correctly untouched: all DML `f`, 0 policies (door-only).

**MINOR-1 — CLOSED (both arms).** Catalog tables (`case_types`, `case_type_terminology`,
`case_participant_roles`) also got `grant insert, update, delete to authenticated`, correctly narrowed by
their pre-existing org-admin-gated `_admin_write` policies (K9e proves a non-org-admin write is RLS-rejected
with `42501`, an org-admin write succeeds). The dead `case_participants_write` `FOR ALL` policy was **dropped**
(not left inert): `case_participants` now has 1 policy (`_select`) and INSERT/UPDATE/DELETE stay ungranted
(`f`) — writes are strictly DEFINER-RPC-owned (grant-immune) until E1. No boundary removed, no over-exposure.

**MINOR-2 — CLOSED.** One-line invariant comment added to the `set_case_patient` compat resolver
(`…000100` ~L449) documenting the implicit inner-join-on-`patient_identifiers` dependency.

**INFO-1 — CLOSED.** `src/lib/cases/types.ts:22` now reads `can_read_case_patient`.

**FIX 5 (regression lock) — VERIFIED a real lock, not a superuser tautology.** New K9 block in
`supabase/tests/207_case_participants_e0.sql` (+9 assertions; plan 21→30; suite 1904→1913). Each assertion
does `test_helpers.claims_for(user)` + `set local role authenticated` + a **plain** `select` / `insert` on
`case_participants` / `participants` / `case_types` — never a DEFINER RPC or the superuser default role, and
it clears the transaction-local JWT GUC first so the role scope is genuine. K9a/K9c/K9d assert `> 0` rows on
an in-scope authenticated select; **if the SELECT grant were reverted these selects would raise
`permission denied for table` and the assertions would fail** — so the grant+policy pair is regression-locked.
K9b/K9c/K9d out-of-scope arms assert `lives_ok` + `0` rows (RLS filters, not a permission error), proving the
policy adjudicates. `database.ts` unchanged (grants don't alter generated types) — correct.

**No new issue introduced.** The changes are additive grants + one policy drop + comments; the PHI surface is
untouched. **APPROVED.**

---

## Original review (CHANGES REQUESTED, 2026-07-10)

**Summary counts:** 0 BLOCKER · 1 MAJOR · 2 MINOR · 3 INFO.

The design is sound and idiomatic, the PHI isolation posture is preserved verbatim, and every
adversarial invariant I could construct against the schema (class-separation, cross-tenant,
primary-subject, disposal, REVOKE-from-public, flags-OFF) holds. The single reason this is
**CHANGES REQUESTED** rather than APPROVED is **MAJOR-1**: seven new non-PHI tables ship RLS SELECT
policies `to authenticated` (the documented "org-scoped read" / "case-scoped RLS" access paths)
**with no table-level `GRANT` to `authenticated`**, so those policies are inert and the reads they
authorize fail with `permission denied`. This is a genuine Rule-1 gap (a boundary that cannot fire)
and a docs-vs-reality mismatch, masked by the fact that pgTAP never exercises a direct authenticated
read on these tables. It is not a live break at E0 (flags OFF; no query-layer code reads these tables
directly yet; PHI is unaffected because PHI is door-only by design), but it must be fixed before E1
wires the direct reads — and fixing it now is a one-line grant per table that also makes the shipped
policies testable.

---

## MAJOR

### MAJOR-1 — Seven new non-PHI tables have RLS SELECT policies but no `GRANT` to `authenticated` (Rule 1: inert boundary)

**Files:**
- `supabase/migrations/20260716000000_participants_registry.sql:163` (`participants_select`),
  `:58` (`case_types_select`), `:86` (`case_type_terminology_select`), `:200` (`case_participant_roles_select`),
  `:279` (`professional_profiles_select`), `:307` (`professional_participants_select`)
- `supabase/migrations/20260716000100_patient_identifiers_rekey.sql:132` (`case_participants_select`),
  `:135` (`case_participants_write` — a `FOR ALL` policy, equally inert)

**What's wrong.** Every one of these tables does `enable row level security` and creates a policy
`for select to authenticated using (…)` — but no migration ever issues
`grant select on <table> to authenticated`. In Postgres, RLS **narrows** an existing table
privilege; it does not **grant** one. With no table GRANT, the SELECT policy can never execute.
Verified against the live catalog:

```
has_table_privilege('authenticated','public.participants','SELECT')            → f
has_table_privilege('authenticated','public.case_participants','SELECT')       → f
has_table_privilege('authenticated','public.professional_profiles','SELECT')   → f
has_table_privilege('authenticated','public.case_types','SELECT')              → f
   (…same for case_type_terminology, case_participant_roles, professional_participants)
```

And a direct read as `authenticated` (the PostgREST path) errors — Postgres itself prints the fix:

```
set local role authenticated;  select count(*) from public.participants;
ERROR:  permission denied for table participants
HINT:   Grant the required privileges … GRANT SELECT ON public.participants TO authenticated;
```

By contrast, every **peer** RLS-guarded table grants `authenticated` SELECT and returns cleanly
(`case_outcomes`, `phase_results`, `hospital_departments`, `case_narrative_types`,
`process_templates` all → `has_table_privilege = t`; `select count(*)` → `0`, RLS-filtered, no
permission error). F1 breaks that established norm on all seven new tables.

**Why it is a real defect, not intended isolation.** The intent is explicitly *direct authenticated
read subject to RLS*, not door-only:
- ADR 0064 Decision 2: professional identity gets "**normal RLS confined to the case's readers** plus
  audited reads" — not the REVOKE-all single-door apparatus.
- Migration comment `…000000_participants_registry.sql:161` — "Registry holds no payload → **org-scoped
  read is appropriate**"; `:277-278` — "a **direct SELECT** is still bounded … Class 2 is not
  REVOKE-all-isolated."
- `docs/backend-state.md:55` documents `case_types`/`case_type_terminology` as "catalog tables,
  **org-scoped read** / org-admin write" and `professional_profiles` as "**case-scoped RLS + audited
  reads**". It correctly reserves "All DML REVOKED; door-only" (`:59`) for `patient_identifiers`
  **only**. So the backend's own design doc says these seven are directly readable — and the shipped
  grant state contradicts it.

**Why pgTAP 207 (21/21) did not catch it.** Every `set local role authenticated` block in
`supabase/tests/207_case_participants_e0.sql` calls a SECURITY DEFINER RPC
(`get_case_professional`, `set_participant_patient`, `get_case_patients`, `dispose_case_phi`) — which
runs as the function owner and is unaffected by the table grant. The direct table writes/reads in the
test (e.g. `insert into public.participants` at `:86`, the K6 drift `update` at `:201`, the K7
`display_name` `select` at `:232`) execute at the **default superuser role** (before any `set role`),
which bypasses both GRANT and RLS. The `participants_select` / `professional_profiles_select` /
`case_participants_select` policies are therefore **never once executed as `authenticated`** by the
suite. This is the classic gap: the phase is green, but the non-PHI RLS boundary it shipped is
unexercised and, as shipped, non-functional.

**Failure scenario.** As soon as E1 (or any consumer) adds the designed direct read — e.g.
`supabase.from('case_participants').select(...)`, `.from('professional_profiles')`, or a
`case_types`/terminology catalog fetch for the type-aware UI — the query returns
`permission denied for table …` for every `authenticated` caller, i.e. every non-service-role user.
The `case_participants_write` `FOR ALL` policy (`…000100:135`) is likewise dead: any direct
`authenticated` INSERT/UPDATE is blocked at the grant layer regardless of `can_read_case`.

**Requested change.** Add the missing table grants, matching the peer-table convention and the
documented access model, e.g.:
```sql
grant select on public.participants               to authenticated;
grant select on public.case_participant_roles     to authenticated;
grant select on public.case_types                 to authenticated;
grant select on public.case_type_terminology      to authenticated;
grant select on public.professional_profiles      to authenticated;
grant select on public.professional_participants  to authenticated;
grant select, insert, update on public.case_participants to authenticated;  -- to make case_participants_write live
```
`patient_identifiers` / `patient_participants` are **correct as-is** — DML REVOKED, door-only,
0 policies (deny-all by design). Do **not** grant those.
Then add a pgTAP assertion that exercises at least one of these policies **as `authenticated`** (e.g.
`test_helpers.claims_for(sa_x)` + `set local role authenticated` + a plain
`select … from public.case_participants where case_id = …`) so the grant + policy pair is regression-locked
and this class of gap can't recur silently. (Reader's discretion whether `case_participant_roles` /
`case_types` / terminology also want an org-admin write grant to make their `_admin_write` `FOR ALL`
policies live — same inert-policy issue applies to those write policies; at minimum SELECT is required
for the E1 read paths.)

---

## MINOR

### MINOR-1 — `case_participants_write` (and the catalog `_admin_write` policies) are dead until their write grants land
`…000100:135` defines `case_participants_write for all to authenticated using/with check
(can_read_case(...))`. Even though direct writes are intended to funnel through DEFINER RPCs in later
phases, the ADR comment at `:129-131` explicitly calls it "defence in depth … a direct client write
still needs `can_read_case`." With no INSERT/UPDATE grant that defence is not present — a direct write
is blocked one layer earlier (grant), so the policy never adjudicates. Same applies to
`case_types_admin_write` / `case_type_terminology_admin_write` / `case_participant_roles_admin_write`
(`…000000:61,93,203`). Rolled into the MAJOR-1 fix if the write grants are added; listed separately
because it is a distinct policy (write vs read) and the reviewer may choose to keep writes DEFINER-only
and instead **drop** the dead `FOR ALL` policies to avoid implying a boundary that isn't wired.
Either way the current state — policy present, grant absent — should not ship as-is.

### MINOR-2 — `set_case_patient` compat resolver silently depends on an identifiers row existing
`…000100:449-456`: the compat door resolves "the case's existing single patient" via an **inner join
on `patient_identifiers`**. It is behavior-correct today because `set_participant_patient` always writes
an identifiers row (`:400`), so after any single-patient write the resolver finds it. But the invariant
is implicit: a patient participant that exists **without** an identifiers row (reachable via the E1
multi-patient path or a seed insert) would be invisible to this resolver, and the next compat edit would
mint a **second** patient participant on the same case rather than updating the first. Not reachable from
the shipped ADR-0038 single-patient UI, so not a live bug — but worth a one-line comment on the door (or
resolving on `participants.participant_type = 'patient'` alone and left-joining identifiers) so a future
maintainer doesn't trip the duplicate-participant edge in E1.

---

## INFO (no action required)

- **INFO-1** — `src/lib/cases/types.ts:22` doc comment still says the read scope is "the BROAD
  `can_read_case`"; the migration/panel use `can_read_case_patient`. Pre-existing wording, not
  load-bearing (the actual gate is correct in SQL). Cheap to align if touched.
- **INFO-2** — `supabase/seed.sql:723` seeds `patient_identifiers.name = 'Paciente de Demonstração'`
  and inserts directly into the door-only satellite (as `postgres`, bypassing the DEFINER writer). Fine
  for local seed (synthetic PHI, reset-OK); noting only that it exercises a path the writer normally
  owns. The paired `participants.display_name = 'Paciente'` surrogate is Q4-compliant.
- **INFO-3** — The live `feature_flags` table currently shows `case_patient = t`; this is a pgTAP/E2E
  run leftover (test 207 flips it in-transaction, and prior E2E runs mutate it), **not** a seed/migration
  state. The migration seeds `case_patient` per its own module and F1 leaves `case_participants`/`case_types`
  at `false`. On a fresh `supabase db reset` the F1 flags are OFF (verified: seed.sql flips only
  `controlled_docs` on; the two F1 flags stay at the migration-seeded `false`).

---

## What I verified (held up)

1. **RLS enabled on all 9 new tables** — `relrowsecurity = t` on `participants`, `case_participant_roles`,
   `case_participants`, `patient_participants`, `professional_participants`, `professional_profiles`,
   `patient_identifiers`, `case_types`, `case_type_terminology`. `patient_identifiers` /
   `patient_participants` correctly have 0 policies (deny-all door-only) with DML REVOKED from
   `authenticated`. (The policy **grant** gap is MAJOR-1.)
2. **Class-1 patient PHI posture preserved verbatim** — `patient_identifiers` DML revoked from
   `authenticated` (`…000100:184`); sole writer is the atomic coordinator-gated DEFINER
   `set_participant_patient` (`is_staff_admin_of` gate `:336`, name-or-MRN floor `:352`, disposed-guard
   `:344`); reads only via `get_participant_patient`/`get_case_patients`/compat `get_case_patient`, all
   NULL/`[]`-out-of-scope with **no audit row on a denied read** (`:490,:532`) and one
   `case_patient.read` per row actually returned. Direct authenticated `select` on `patient_identifiers`
   → permission denied (confirmed). No service-role key reachable client-side (`cases.ts` uses only the
   SSR `createClient`, `server-only`).
3. **Class-2 professional identity** — case-scoped read gate `app.can_read_professional_profile`
   traverses **base tables under DEFINER** (`…000000:259-270`, R6-safe, no `case_participants` RLS
   recursion); `get_case_professional` re-gates + logs exactly one `professional_profile.read`; foreign
   reader → NULL (pgTAP K4). The verb is in **both** the `log_audit_access` allow-list (`…000100:658`)
   **and** the C-4 `_audit_access_authorized` dispatch (`:699`), so the audit actually fires (not
   silently blocked). No isolated single door — matches the ADR (Class 2 is deliberately lighter).
4. **Q3 patient `display_name` non-PHI invariant** — writer sets the surrogate `'Paciente'`
   (`…000100:377`), never the raw name; CHECK-derived `sensitivity_class` (`…000000:134`); disposal
   redacts `display_name` to `[PHI removido]` (`…000200:69`) as belt-and-suspenders. pgTAP K7 asserts
   the redaction; K2 asserts the sensitivity CHECK both directions.
5. **REVOKE ALL … FROM PUBLIC on every new/changed RPC (t19)** — `set_participant_patient`,
   `get_participant_patient`, `get_case_patients`, `get_case_professional`, compat
   `set_case_patient`/`get_case_patient` all have `has_function_privilege('public', …, 'EXECUTE') = f`,
   `authenticated = t`. `dispose_case_phi` (`CREATE OR REPLACE`, unchanged signature) correctly
   **preserved** its prior ACL — public=f, auth=t — so no explicit REVOKE is needed there, and it truly
   kept the old signature. pgTAP K8 locks this.
6. **R5 class-separation** — `participants UNIQUE(id, participant_type)` + composite-FK+CHECK on both
   subtypes; pgTAP K1 proves a `professional` cannot acquire a `patient_participants` row and a
   `patient` cannot acquire a `professional_participants` row (both `23503`). Primary-subject
   partial-unique (one live per case) proven by K5 (`23505`).
7. **R2 tenant integrity** — `cases.organization_id` denormalized with the **HC095** drift trigger
   (`…000100:46-68`, fires BEFORE INSERT/UPDATE) and the **HC094** participant-same-org-as-case trigger
   (`…000100:101-123`). Both are real triggers, verified firing by pgTAP K6.
8. **Compat doors behavior-preserving** — `get_case_patient`/`set_case_patient` resolve the case's lone
   patient participant scoped to `case_id` + `removed_at is null` + `participant_type='patient'`; they
   cannot return another case's patient (join is anchored on `cp.case_id = p_case_id`). ADR-0038
   single-patient UI works with zero frontend edits. (See MINOR-2 for the implicit identifiers-row
   dependency.)
9. **Flags OFF (m2 hard gate)** — `…000200:133-147` seeds `case_participants` + `case_types` `false`
   with `on conflict do update set enabled = excluded.enabled` (forced OFF even over a pre-existing row);
   seed.sql does not flip them. Verified live-off on the two F1 flags.
10. **R3 disposal compose** — `dispose_case_phi` deletes every patient participant's `patient_identifiers`
    row (`…000200:58-64`), each DELETE firing the xref-maintain trigger that stamps the participant's
    `patient_xref` row disposed (participant-grained per ADR 0066); redacts registry `display_name`;
    soft-removes case links. The xref stamp (disposed_at/reason, keys retained) exactly matches the
    baseline `trg_xref_maintain` semantics and the `search_patient_xref`/`patient_xref_count`
    `disposed_at is null` readers — behavior-preserving. All prior disposal arms (answers, narratives,
    events, interviews, label, documents, meeting_cases, flags, GUC bypasses, HC056 double-dispose guard,
    coordinator/org-admin authz) preserved verbatim; F2 seam marked. pgTAP K7 proves the per-participant
    xref purge.
11. **Rule 9 data-access layer** — `src/lib/queries/cases.ts` routes all PHI through the DEFINER RPCs;
    `src/lib/cases/types.ts` stays client-safe (zero imports preserved, pt-BR labels present). TypeScript
    strict respected; no unjustified `any`. (No new direct `.from('participants'/…)` reads exist yet — E0
    is structural; those land in E1 and are exactly what MAJOR-1 will block until the grants are added.)

**Tooling note:** verification ran against the live local DB (`supabase_db_azkbbhskturikxpgmafq`) via
read-only introspection (`has_table_privilege`, `has_function_privilege`, `pg_policies`, simulated
`set role authenticated` reads) plus `git show ef66b0a` and source reading. I did not re-run the pgTAP
suite (reported 1904/1904 on fresh reset; I confirmed *why* 207 passes while MAJOR-1 stands). No
application code, migration, or spec was modified.
