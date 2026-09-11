# AE5-SUCCESSOR-ADRS — progress record

> Hub: [ae5-successor-adrs.md](../features/ae5-successor-adrs.md) · plan:
> [pre-ae5-remediation.md](../plans/pre-ae5-remediation.md) §3 item 3 / §6. Branch:
> `authz-ae5-successor-adrs`, cut from `main` at `adbde005`.

Subjects: the two ADRs the plan reserved as **0202** (F7 · F8 · `platform_role`) and **0204** (the
`D` fan-out ceiling · the `search_path` convention), written as **0207** and **0208**; the four
follow-ups whose clauses those decisions touch; the reservation sentences in the plan, the
programme plan and the handoff. ⛔ Docs-only: no migration, no `src/`, no pgTAP — every build the
rulings order is named to a follow-on unit inside the ADR that orders it.

## Session log

### 2026-09-11 — unit opened; the PO's rulings taken and captured VERBATIM (lead)

**Why now.** The PO, after the Record step of `BACKEND-STATE-SERVICE-ROLE-SEAM`, instructed: *"lets
solve the AE5 successors ADR 0202 and ADR 0204 here in this session."* Tree clean on `main` at
`adbde005`.

**Inputs gathered before asking** (two Explore agents, each quote spot-checked at source by the
lead): F7/F8 are findings of `docs/reviews/authz-evolution-implementation-audit-2026-09-02.md:337/:360`
(read by the lead in full); ADR 0176 D8 bundles them undecided and forbids picking one off inside an
increment; the 0202 blast-radius census that
`FUP-AE5-MATRIX-ARM3-CELLS-ADR-0202-BLAST-RADIUS-CITES-ANOTHER-ADRS-CENSUS` says nobody ran was
measured live: `platform_role` = 11 enum labels · 1 column (`app.active_role_selections.role`) ·
1 routine (`public.assume_role`) · 0 RLS policies · 7 first-party TS files; `authz.roles` = 12 rows,
`staff_admin` alone `authoritative`, `administrativo` at `allowed_scope_kind = capability_plane`,
`session_selectable = f`. The `search_path` census re-measured live and equal to the follow-up body's
five-value table (890 DEFINERs: 825 / 33 / 23 / 6 / 2 / 1, none undeclared). The D fan-out census
in `FUP-AE4-CANDIDATE-SCOPE-FANOUT-IS-UNBOUNDED.md` read at source. ⛔ The lead's own recommendations
to the PO were made from these and are superseded wherever the rulings below differ.

**Numbering ruled: renumber to 0207 and 0208** (highest on any live branch + 1, re-measured at
open: `0206` on `main`, four `origin/*` refs carry none higher). The plan's own item 5 offered this.

**PO RULINGS, VERBATIM (the writer's source; the ADRs are the artefacts that must carry them):**

*On F8 (`administrativo`), the `platform_role` retirement, the compat unit and the sequencing:*

> `administrativo` leave `authz.roles`. I would make one refinement to the proposal: administrativo
> should be a capability-provider namespace, but the actual entitlement source must be each
> individual capability—not one administrativo bundle.
> ```
> memberships / profiles.is_admin
>         → role assignment adapter → role_permissions ┐
>                                                      ├→ entitlement seam → has_permission → app.can_*
> administrativo capability rows
>         → capability adapter → capability_permissions┘
> ```
> Do not put administrativo into assignment_facts, and do not make it produce a fake role_code. The
> existing resolver is explicitly role-shaped—role_code, role_state, and hat_ok (resolver
> `supabase/migrations/20261003007250_ae49_d4_resolver_contract.sql:208`). The provider-neutral
> seam should sit above that implementation while preserving the stable authz.has_permission
> interface.
> The mapping must preserve the measured capability boundaries:
> - read_cases → commission.cases.read
> - view_signoffs → commission.signoffs.read
> - schedule_meetings, create_cases, and assign_case_phases need narrower codes or carefully split
>   mappings. They must not simply receive commission.meetings.manage or commission.cases.manage:
>   those existing permissions cover much broader surfaces.
> - bulk_create_cases must continue requiring both create and assignment entitlements.
> - Creation-scoped patient entry must not become standing PHI-write authority.
> - Appointment alone grants nothing; feature flag, active account, current commission membership,
>   and the concrete capability row remain mandatory.
> - Administrativo remains hat-independent—it is delegated authority layered onto membership, not a
>   selectable hat.
> - It must never receive authority/lifecycle capabilities such as staff management, case-access
>   granting, case closure, reserved-session authorship, or signing.
> I would execute this as ADR 0202 followed by a named backend unit such as AE5-ROLE-CATALOG-COMPAT,
> before the first actual AE5 increment:
> 1. Convert app.active_role_selections.role from platform_role to catalog-validated text and add
>    an FK to authz.roles(code), preserving existing values.
> 2. Replace assume_role(platform_role) with one non-overloaded text signature that validates
>    session_selectable and the caller's real assignment.
> 3. Remove the old enum after its dependencies are gone.
> 4. Delete the inert administrativo role row and remove capability_plane from authz.scope_kind.
> 5. Collapse the TypeScript role mirrors into the single F7 manifest and infer PlatformRole from it
>    rather than the retired generated enum (current mirrors `src/lib/role/role-catalog.ts:39`).
> 6. Leave member_can behavior untouched until proposed-order item 6, when the capability plane is
>    mapped to permission codes as a sibling entitlement provider—"mapped, not merged," exactly as
>    the plan states (`docs/plans/authz-evolution.md:1178`).
> This also cleans up the sequencing language: staff_admin is the already-authoritative baseline,
> not AE5 increment 1. After the compatibility unit, the remaining work is ten real role cutovers
> plus one capability-plane cutover. Item 1 is therefore staff; item 6 remains the administrativo
> provider mapping.

*On `platform_role`:* **Retire** — column re-typed to text with FK to `authz.roles(code)`; enum
dropped; TS type derived from the catalog (the recommended option, chosen as offered).

*On F7:* **One ordered manifest entry per role; compat maps derived; binding test becomes a
generated-artifact `--check` gate** (the recommended option, chosen as offered).

*On the `D` ceiling:*

> I mostly agree, but I would change "structurally bounded" to "structurally dominated, with the
> residual risk explicitly accepted."
> D ≤ M is real today: the candidate CTE projects at most one scope ID from each assignment_facts
> row and deduplicates before confirmation (implementation
> `supabase/migrations/20261003007320_ae4_statement_scoped_authorized_scope_ids.sql:149`). The live
> census also reproduces the recorded figures:
> - 33 seated principals
> - M: max 3, average 1.30
> - D_org: max 1
> - D_hospital: max 2
> - D_commission: max 2
> - Current global formula bound: 37
> But M ≤ |commissions| + 6|hospitals| + 2|orgs| + 1 is not a constant bound. A principal can still
> be assigned across an arbitrarily growing tenant tree. Therefore "large D is structurally
> unreachable" would overclaim. What has been proven is that D is not an independent fan-out
> dimension.
> There is also an important connection to the administrativo decision: after administrativo
> becomes a sibling capability provider, candidates cannot remain defined solely from
> authz.assignment_facts. The invariant should be expressed over a provider-neutral fact set, say F,
> rather than freezing today's role-only M.
> I would record the decision approximately as:
> For a fixed principal, permission, and resolution kind, the candidate producer emits at most one
> scope from each applicable entitlement-provider fact and deduplicates candidates before
> confirmation. Therefore D ≤ F and Dₖ ≤ min(F, |scopesₖ|).
> For the current role provider, F = M and:
> M ≤ C + R_H·H + R_O·O + S
> where currently R_H = 6, R_O = 2, and S ≤ 1, yielding C + 6H + 2O + 1. These coefficients are
> catalog facts, not permanent constants.
> No numeric schema ceiling is imposed. The remaining growth with tenant and assignment count is an
> explicitly accepted operational risk under the recorded product and performance censuses.
> I agree that a fixture-derived numeric ceiling would be the wrong control. But the shape assertion
> should pin more than "uses the same set":
> - Every candidate originates from an entitlement-provider fact.
> - One fact yields at most one candidate for a fixed resolution kind.
> - Deduplication occurs before permission confirmation.
> - The measured confirmation count satisfies U = D ≤ F.
> - Runtime and candidate resolvers use the same candidate producer and differ only in their
>   confirmer.
> - Adding a new provider adapter makes the assertion fail until that provider is included.
> The existing P2 instrumentation already measures actual confirmation calls and supports extending
> this relational assertion without copying the production CASE into a test—the latter is
> explicitly rejected by ADR 0183 (`docs/decisions/0183-p2-invocation-count-respecification.md:67`).
> Finally, I would add mandatory remeasurement triggers:
> - administrativo is added as a permission provider;
> - another provider adapter is introduced;
> - scope_reaches gains one-to-many or descendant expansion;
> - membership uniqueness constraints are relaxed;
> - production data exceeds the tested M=20, D=5 performance envelope.
> So: approve the no-numeric-ceiling direction, but describe it as a parametric structural invariant
> plus accepted operational risk—not as proof that large D is impossible. No code or database state
> was modified.

*On `search_path`:*

> Keep "no mass re-emit" and fix-on-touch, but do not recognize app, public, pg_catalog as a
> permanently acceptable security convention. Treat it as grandfathered compatibility debt.
> Why:
> - The live census still reproduces 825 / 39 / 23 / 2 / 1.
> - The existing `supabase/tests/414_definer_search_path_resolves.sql:109` already proves all 890
>   DEFINER functions declare a path and every named schema exists. It does not prove those paths
>   are safe.
> - anon, authenticated, service_role, and authenticator currently have database TEMP. PostgreSQL
>   warns that, unless pg_temp is explicitly placed last, temporary objects can precede the declared
>   schemas and shadow unqualified relations inside a DEFINER. Denying CREATE on app/public/authz
>   therefore does not close the complete threat. PostgreSQL's guidance recommends trusted schemas
>   followed by pg_temp; Supabase recommends the stricter empty path with qualified references.
> - The middle 42 are often narrower paths. Converting them to the dominant path would broaden
>   resolution, not improve it.
> - The proposed gate cannot enforce "two admitted forms": it accepts all five present forms—and any
>   future path made from existing schemas.
> I would record this decision instead:
> SET search_path = '' with schema-qualified object references is the sole forward convention for
> new or touched SECURITY DEFINER functions. Existing nonempty paths are frozen compatibility debt,
> not an alternative convention; they may not grow and converge to the empty form on touch. No mass
> body re-emission is required.
> For public.tenant_orphan_profiles(), its body already qualifies its only dependency (definition
> `supabase/migrations/20261003005800_ae24_inc4_linkable_picker_on_affiliations.sql:215`). Change it
> directly to the empty path in a narrow forward migration—prefer ALTER FUNCTION … SET search_path =
> '' over re-emitting the body. Fixing the live catalog cannot honestly be described as "no
> migration."
> Keep 414 as the collapsed/nonexistent-schema property gate, but add a separate prospective rule
> preventing new nonempty DEFINER paths. If a second compatibility form must be permitted, make it
> property-based—only trusted, resolvable schemas with explicit pg_temp last—not the current
> dominant string. The four DEFINER functions intentionally using temporary tables should receive
> targeted testing before any catalog-wide ALTER FUNCTION hardening sweep.
> So: approve forward-only convergence and no mass re-emit; reject "two coequal admitted forms" and
> reject "schema exists" as the whole security property. No files or database state were changed.

**What the rulings change about this unit's shape.** The lead had framed both ADRs as docs-only
closures; the rulings ORDER builds — a compat migration unit (`AE5-ROLE-CATALOG-COMPAT`), a narrow
`ALTER FUNCTION` migration, a D-shape pgTAP assertion, a prospective search_path rule, targeted
temp-table tests. ⇒ this unit stays docs-only and each ADR names the unit that owes its build; the
two conventions' follow-ups are RE-CLAUSED, not closed. ⚠ The rulings cite eleven facts by location
(hub criterion 1); ⛔ none is written into an ADR before it reproduces — a ruling is a measurement to
verify, from any role.

**Homes written:** hub (`in_progress`), this record, `docs/features/INDEX.md` regenerated; gate 13
bare; rc in the commit.

### 2026-09-11 — verification of the rulings' cited facts (backend)

Hub criterion 1. Every fact the PO's rulings cite by location was re-measured before any drafting.
⛔ Nothing was drafted in this pass. Live catalog reads only (`docker exec supabase_db_… psql -At`);
no migration, no `src/`, no reset. **11 of 14 reproduce exactly; 3 differ and are reported to the
lead before drafting, never silently corrected.**

**1 · The resolver is role-shaped — REPRODUCES, file AND catalog.**
`sed -n '195,225p' supabase/migrations/20261003007250_ae49_d4_resolver_contract.sql` → `:208` is
exactly `create or replace function authz.entailed_grants(`. The file defines **four** functions
(`grep -ni '^create or replace function' …` → `:208 entailed_grants`, `:260 has_permission`,
`:315 candidate_has_permission`, `:359 explain_permission`).
Live: `select pg_get_functiondef('authz.entailed_grants(uuid,text,uuid,text)'::regprocedure)` →
`RETURNS TABLE(role_code text, granting_permission_code text, role_state text, hat_ok boolean)`,
`STABLE SECURITY DEFINER SET search_path TO ''`, sourced `from authz.assignment_facts(p_principal)
af join authz.roles r on r.code = af.role_code`. ⇒ the PO's three named columns are three of the
four; the contract is role-shaped in the catalog, not only in the file.

**2 · One scope per fact, deduplicated before confirmation — REPRODUCES, and stronger.**
`sed -n '135,165p' supabase/migrations/20261003007320_ae4_statement_scoped_authorized_scope_ids.sql`
→ `:149` is `with candidate as materialized (`, the CTE opening.
Live `pg_get_functiondef('authz.authorized_scope_ids(uuid,text,text)'::regprocedure)`:
`select distinct <one CASE expression> … from authz.assignment_facts(p_principal) af`, then
`select c.scope_id from candidate c where c.scope_id is not null and authz.has_permission(…)`.
⇒ exactly one projected id per fact, `distinct` applied **before** the confirmer. ✔
⭐ **Extra, measured and load-bearing for 0208's shape assertion:**
`pg_get_functiondef('authz.candidate_authorized_scope_ids(uuid,text,text)'::regprocedure)` carries a
**byte-identical candidate CTE**, differing only in its confirmer
(`authz.candidate_has_permission`). The PO's clause 5 (*"Runtime and candidate resolvers use the
same candidate producer and differ only in their confirmer"*) is therefore true **today by textual
duplication, not by construction** — two copies, no shared producer function. ⚠ LEARN-024: an
assertion that merely re-states the clause would be a hand-written copy of production text; the
assertion must compare the two live bodies (or the producer must be factored out).

**3 · `414`'s property — FACT REPRODUCES, LINE DIFFERS.**
`grep -n 'select is(|select ok(|§0a|§0b' supabase/tests/414_definer_search_path_resolves.sql` →
`plan(7)` at `:50`; §0a `:106-110`, §0b `:116-121`, §1 `:126-132`, §2a `:160`, §2b `:170`, §2c
`:180`, §3 `:193`.
⚠ **`:109` is §0a's message string** — *"DOMAIN as a NAMED SET: the sweep examines prosecdef
functions in all three of app, authz and public"*. The two properties the ruling attributes to that
line are **§0b at `:119`** (*"every prosecdef function in app/public/authz declares a search_path at
all"*) and **§1 at `:131`** (*"every schema named in every prosecdef search_path … resolves in
pg_namespace"*). The file proves exactly what the PO says it proves; the citation points one
assertion early.
⚠ **"NOT safety" is an absence, verified as one.** `grep -n -i 'does not prove|not the security
property|safety|safe' supabase/tests/414_…sql` → **0 rows**; all seven assertions enumerated above
are resolvability/discrimination only. So the file makes **no** claim about path safety — it does
not *say* it is not the safety property, it simply never asserts it. ⇒ the ADR must phrase this as
*what 414 asserts*, not as a disclaimer 414 carries.
Population: `select count(*) … where prosecdef and nspname in ('app','public','authz')` → **890**. ✔

**4 · `TEMP` on the four client roles — REPRODUCES.**
`select rolname, has_database_privilege(rolname, current_database(), 'TEMP') from pg_roles where
rolname in ('anon','authenticated','service_role','authenticator')` →
`anon t · authenticated t · authenticator t · service_role t` (4/4).

**5 · `public.tenant_orphan_profiles` — REPRODUCES, file line exact.**
`select … prosecdef, proconfig from pg_proc …` →
`public.tenant_orphan_profiles | prosecdef=true | proconfig=search_path=public, app, pg_catalog`
(the sole member of the 1-function bucket in §12) and, separately,
`app.tenant_orphan_profiles | prosecdef=true | proconfig=search_path=app, public, pg_catalog`.
Live `prosrc` of the `public` wrapper, in full:
`select t.profile_id, t.reason from app.tenant_orphan_profiles() t;`
⇒ its **only** relation/function reference is schema-qualified; `t.profile_id`/`t.reason` are
column refs on the aliased FROM item. `ALTER FUNCTION … SET search_path = ''` needs **no** body
change. ✔
`grep -rn "function public.tenant_orphan_profiles" supabase/migrations/` →
`20261003005800_ae24_inc4_linkable_picker_on_affiliations.sql:215` is the `create or replace`. ✔
⚠ The ruling names only the `public` wrapper; the `app` function sits in the 825-bucket and is a
separate subject the narrow migration does not touch.

**6 · "The four DEFINER functions intentionally using temporary tables" — REPRODUCES, exactly four.**
`select n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' from pg_proc p
join pg_namespace n on n.oid=p.pronamespace where p.prosecdef and n.nspname in
('app','public','authz') and p.prosrc ~* 'temp(orary)? table|pg_temp'` → **4**:
`app.copy_response_answers(uuid,uuid)` · `app.copy_template_version_children(uuid,uuid)` ·
`app.copy_version_children(uuid,uuid)` · `public.clone_framework(uuid,uuid)`.

**7 · The capability names — ⚠ DIFFERS: it is FIVE capabilities, not six.**
`read_cases` is **not** an enum label anywhere (`select … from pg_type t join pg_enum e … where
e.enumlabel='read_cases'` → 0 rows). The live catalog is a **CHECK constraint on a table column**:
`select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid=
'public.commission_administrativo_capabilities'::regclass` →
`commission_administrativo_capabilities_capability_check :: CHECK ((capability = ANY (ARRAY[
'schedule_meetings','create_cases','assign_case_phases','view_signoffs','read_cases'])))`.
`select distinct capability from public.commission_administrativo_capabilities` → the same five.
Table shape: `commission_id, user_id, capability, granted_by, granted_at`, PK
`(commission_id,user_id,capability)`, FK to `commission_administrativos`.
⛔ **`bulk_create_cases` is a DOOR, not a capability** —
`select … where p.proname='bulk_create_cases'` → `public.bulk_create_cases(p_template_id uuid,
p_deadline date, p_phase_scope text, p_rows jsonb) prosecdef=true`, and its live body carries
`or (app.member_can(v_commission_id, 'create_cases') and app.member_can(v_commission_id,
'assign_case_phases'))`. ⇒ the PO's sentence *"bulk_create_cases must continue requiring both create
and assignment entitlements"* describes a **live guard on an RPC** and is correct as written; it is
the six-name list in the hub criterion that conflates a door with the capability vocabulary. The ADR
must say five capabilities + one door.
`member_can`: `select … where p.proname ilike '%member_can%'` → **two** functions, both
`prosecdef=true`, both `returns boolean` — `app.member_can(p_commission_id uuid, p_capability text)`
(resolves `auth.uid()`) and `app.member_can_for(p_commission_id uuid, p_capability text, p_user_id
uuid)` (third-party form; `app._case_caps`' S8 arm calls the `_for` variant, ADR 0134 Amdt 6).
⚠ Two vocabularies one word apart: `read_cases` (ADR-0061 delegation) vs `app._cap_bit
('read_case_content')` — the S8 comment says so in the live `prosrc`.

**8 · `authz.scope_kind` — ⚠ DIFFERS: it is a DOMAIN, not an enum.**
`select t.typtype::text, t.typbasetype::regtype::text from pg_type t … where nspname='authz' and
typname='scope_kind'` → `d | text`.
`select conname, pg_get_constraintdef(oid) from pg_constraint where contypid = <that oid>` →
`scope_kind_check :: CHECK ((VALUE = ANY (ARRAY['organization','hospital','commission','none',
'capability_plane'])))`. `capability_plane` is present. ✔
⚠ **Two columns are typed by it** (`select … from pg_attribute a … where a.atttypid = <that oid>`):
`authz.roles.allowed_scope_kind` **and `public.memberships.scope_kind`**. ⇒ step 4 of the PO's
ordered build is *"remove `capability_plane` from `authz.scope_kind`"* = **`ALTER DOMAIN … DROP
CONSTRAINT` + re-add without the value**, and it touches the domain `memberships.scope_kind` also
depends on — not an `ALTER TYPE … DROP VALUE` (which Postgres does not offer for enums anyway). The
ADR must name the mechanism, because "remove from the enum" would mis-order the compat unit.
`authz.roles` — `select code, allowed_scope_kind, system_managed, session_selectable, state from
authz.roles order by code` → **12 rows**, columns all `text`/`boolean`:

| code | allowed_scope_kind | system_managed | session_selectable | state |
| --- | --- | --- | --- | --- |
| `administrativo` | `capability_plane` | t | **f** | legacy |
| `hospital_admin` | hospital | f | t | legacy |
| `nsp_coordinator` | hospital | f | t | legacy |
| `nsp_org_admin` | organization | f | t | legacy |
| `org_admin` | organization | f | t | legacy |
| `platform_admin` | `none` | **t** | t | legacy |
| `pqs_member` | hospital | f | t | legacy |
| `quality_reviewer` | hospital | f | t | legacy |
| `staff` | commission | f | t | legacy |
| `staff_admin` | commission | f | t | **authoritative** |
| `technical_director` | hospital | f | t | legacy |
| `technical_director_deputy` | hospital | f | t | legacy |

⇒ `staff_admin` alone authoritative; `administrativo` the only non-`session_selectable` row and the
only `capability_plane` row. ✔

**9 · ADR 0183's rejection of copying the production CASE — FACT REPRODUCES, LINE DIFFERS.**
`sed -n '55,80p' docs/decisions/0183-p2-invocation-count-respecification.md` → **`:67` is Decision
1** (*"P2 becomes a bound with a measured right-hand side … `A = 1 + U`"*), which says nothing about
copying. The rejection is at **`:114-115`**, in Considered options:

> ⛔ **Hand-copy the resolver's candidate `CASE` into the harness to predict `U`.** Rejected: a
> harness holding a copy of production text is a duplicate no gate protects…

⇒ 0208 must cite `0183:114`, not `:67`.
**The P2 instrumentation, named:** `scripts/authz-ae4-p2-invocation-count.sql` (exists, 38,754 B,
ADR 0183 D4). It counts with `pg_stat_get_function_calls(<regprocedure>)` under a per-session
`track_functions='all'`, keyed by OID over nine functions incl.
`authz.assignment_facts(uuid)`, `authz.has_permission(uuid,text,uuid,text)`,
`authz.authorized_scope_ids(uuid,text,text)`, `authz.candidate_has_permission(…)`. ⭐ Confirmations
are measured **as `authz.has_permission` invocations** (script `:66-67`), which is exactly the
`U` the PO's clause 4 (`U = D ≤ F`) needs — so the assertion extends the existing instrument rather
than needing a new one. ⚠ `coalesce(…, 0)` is applied throughout because the counter returns **NULL,
not 0**, before the first call (script `:167`).

**10 · The `D` census — REPRODUCES on the live seed, with one definitional nuance.**
Re-ran the follow-up body's own query verbatim (fixing only its `group by 1` → `group by org_count`,
which errors on this server as *"aggregate functions are not allowed in GROUP BY"*):
`with af as (select m.principal_id, coalesce(m.organization_id, (select c.organization_id from
commissions c where c.id=m.commission_id), (select h.organization_id from hospitals h where
h.id=m.hospital_id)) org from memberships m where (m.expires_at is null or m.expires_at>now()) and
m.scope_kind is not null) select org_count, count(*) from (select principal_id, count(distinct org)
org_count from af group by 1) t group by org_count order by org_count;` → **`1|33`** ✔ (single
bucket, as recorded).
Tenancy: `orgs=3 hospitals=4 commissions=6 profiles=36 memberships=43 admins=1` ✔.
`M` as **raw membership rows** per seated principal → `seated=33 M_min=1 M_max=3 M_avg=1.30` ✔
(43/33 = 1.303).
`D` recomputed by replaying the live candidate CASE per resolution kind over
`authz.assignment_facts` → `D_organization max=1 · D_hospital max=2 · D_commission max=2` ✔.
Formula bound `C + 6H + 2O + 1 = 6 + 24 + 6 + 1` → **37** ✔.
⚠ **Nuance the ADR must state:** the recorded `M` counts **membership rows**. Counting from the live
producer instead — `select count(*) from authz.assignment_facts(p)` — gives `M_min=0 M_max=3
M_avg=1.27`, because `assignment_facts` gates on `app.is_active(p_principal)` and
`suspenso.temp@test.local` is inactive (facts = 0). Since the ruling re-expresses the invariant over
a **provider-neutral fact set `F`**, the ADR must say `F` is counted from the producer, and that the
two counts differ by the active gate on this seed.
⛔ The scaled-fixture `M=20, D=5` figure is **not** on this seed (it is the AE4 perf fixture,
12,036 principals / 13 orgs). It is quoted only with its source line —
`docs/followups/FUP-AE4-CANDIDATE-SCOPE-FANOUT-IS-UNBOUNDED.md` § *"How it was MEASURED"* and the
*"⚠ This is a DIFFERENT population"* paragraph — exactly as the ruling's fifth re-measurement
trigger requires.

**11 · The `platform_role` reach census (0202's blast radius) — REPRODUCES, 11 · 1 · 1 · 0 · 7.**
- **11 enum labels** — `select e.enumlabel from pg_enum e where e.enumtypid='public.platform_role'
  ::regtype order by e.enumsortorder` → org_admin, nsp_org_admin, hospital_admin, nsp_coordinator,
  staff_admin, staff, pqs_member, technical_director, technical_director_deputy, quality_reviewer,
  platform_admin.
- **1 column** — `select … from pg_attribute a join pg_class c … where a.atttypid =
  'public.platform_role'::regtype and a.attnum>0 and not a.attisdropped` →
  `app.active_role_selections.role` (relkind `r`).
- **1 routine** — `select … from pg_proc p join pg_namespace n … where n.nspname in
  ('app','public','authz') and p.prokind in ('f','p') and pg_get_functiondef(p.oid) ilike
  '%platform_role%'` → `public.assume_role(p_role platform_role)`, `prosecdef=true`, and
  `select … where p.proname='assume_role'` confirms it is **not overloaded** (one signature).
  ⚠ `prokind in ('f','p')` is required: without it `pg_get_functiondef` errors on aggregates
  (`ERROR: "array_agg" is an aggregate function`) and the census returns nothing at all.
- **0 policies** — `select count(*) from pg_policies where coalesce(qual,'')||coalesce(with_check,'')
  ilike '%platform_role%'` → `0`.
- **7 first-party TS files** — `grep -rln 'platform_role' src/` → `src/lib/auth/actions.ts`,
  `src/lib/queries/session.ts`, `src/lib/role-selection/actions.ts`,
  `src/lib/role/landing-route.test.ts`, `src/lib/role/role-catalog.test.ts`,
  `src/lib/role/role-catalog.ts`, `src/lib/types/database.ts`. ⚠ one of the seven
  (`src/lib/types/database.ts`) is **generated** (Rule 8) — 6 hand-written + 1 regenerated by
  `npm run gen:types`.
- Cross-check `select distinct d.classid::regclass, d.objid from pg_depend d where d.refobjid=
  'public.platform_role'::regtype and d.deptype<>'i'` → exactly two dependents, `pg_class` +
  `pg_proc` — consistent with 1 column + 1 routine, no third limb.

**12 · The `search_path` five-value table — REPRODUCES the PO's figures exactly.**
`select coalesce((select v from unnest(p.proconfig) v where v like 'search_path=%'),'<none>') sp,
count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.prosecdef and n.nspname
in ('app','public','authz') group by 1 order by 2 desc` →

| `search_path` | count |
| --- | --- |
| `app, public, pg_catalog` | **825** |
| `public, pg_catalog` | **39** |
| `""` (empty) | **23** |
| `app, pg_catalog` | **2** |
| `public, app, pg_catalog` | **1** |

Total **890**, `<none>` absent ⇒ no undeclared DEFINER. ✔ 825/39/23/2/1 is the PO's list.
⚠ **The record's own opening entry (`:30`) says `825 / 33 / 23 / 6 / 2 / 1`** — that is not a
contradiction but a **different grain**: adding `nspname` to the GROUP BY splits the 39 into
`public|public, pg_catalog = 33` and `app|public, pg_catalog = 6`. Both sum to 890. The ADR should
carry the 5-value global table (the PO's) and may note the per-schema split.

**13 · `src/lib/role/role-catalog.ts` — REPRODUCES; F7's five declarations all still exist.**
`sed -n '30,45p'` → `:39` is exactly
`export type PlatformRole = Database["public"]["Enums"]["platform_role"];` ✔ (the PO's citation).
The five declarations F7 names (`docs/reviews/authz-evolution-implementation-audit-2026-09-02.md`
§ F7) have all shifted **+10 lines** since that review; current numbers from
`grep -n 'ROLE_LABELS|ROLE_SCOPE_KIND|ROLE_ORDER|ROLE_BRANCH|ROLE_MANIFEST|scopeSummary'`:

| declaration | F7 cited | now |
| --- | --- | --- |
| `ROLE_LABELS` | 32 | **42** |
| `ROLE_SCOPE_KIND` | 57 | **67** |
| `ROLE_ORDER` | 89 | **99** |
| `ROLE_BRANCH` | 184 | **194** |
| the role-group switch in `scopeSummary` | 338 | **348** |
| `ROLE_MANIFEST` (zips the first three) | 103–115 | **121–126** |

File is 386 lines. ⇒ F7 is live and unremediated; the "+10" is a uniform shift, not an edit.

**14 · The disagreeing "increment 1" sentences and plan `:398` — ALL REPRODUCE at their cited lines,
and there are MORE than three.**
- `docs/progress/ae5-opening-adr.md:519-522` — *"AE5's increment 1 is `staff_admin` … so 0202 gates
  increment **2**, not 1."* ✔ (cited `:519-520`)
- `docs/progress/ae5-opening-adr.md:522-523` — *"AE5's eleven increments = 12 catalog roles −
  `staff_admin`."* ✔ (cited `:522`)
- `docs/plans/authz-evolution.md:1174` — *"before AE5 **increment 2** (increment 1 is `staff_admin`,
  the only already-`authoritative` role)."* ✔
- `docs/plans/authz-evolution.md:1178-1180` — **Proposed order**, item **1 is `staff`**. ✔
- `docs/plans/pre-ae5-remediation.md:396-398` — *"increment 1 is `staff_admin`, the only role already
  `state = 'authoritative'` … so 0202 gates increment **2**."* ✔
- **`docs/plans/pre-ae5-remediation.md:398`** — *"Its blast radius is **3 sites** and fully measured
  (see the unit record)."* ✔ exactly at `:398`.

⭐ **Two further live repeats the ruling's correction list does not name**, found by
`grep -n "increment 1" docs/progress/ae5-opening-adr.md docs/plans/authz-evolution.md
docs/plans/pre-ae5-remediation.md`:
`docs/plans/pre-ae5-remediation.md:640` and **`:670`** both repeat *"increment 1 is `staff_admin`,
the only already-`authoritative` role"*. ⇒ the correction markers must cover **five** sites, not
three, or the follow-up closes while two live sentences still assert the refuted reading.
⚠ `docs/plans/authz-evolution.md:1215` **already** carries a ⛔ note that the ordinal disagrees with
the Proposed order and points at the follow-up — that note is superseded by the ruling and needs a
dated update rather than a fresh marker beside it.

**Numbering re-measured (highest on ANY live branch + 1).** `git for-each-ref refs/heads refs/remotes`
→ 3 local + 5 remote refs; per-ref `git ls-tree --name-only <ref> docs/decisions/ | sed 's#.*/##' |
grep -oE '^[0-9]{4}' | sort -n | tail -1` → `main` **0206**, `authz-ae5-successor-adrs` 0206,
`claude/distracted-kapitsa-0d82de` 0206, `origin/main` 0205, `origin/authz-ae5-matrix-arm3-cells`
0205, `origin/authz-enforcement-manifest` 0193, `origin/authz-c2-tier1` 0180. Highest anywhere =
**0206** ⇒ **0207 and 0208** stand. A sweep for `docs/decisions/(0202|0204|0207|0208)-*` across every
ref returns **0 rows** — the reserved numbers exist nowhere and the two new ones are free.
⚠ `git worktree list` shows a second worktree at
`.claude/worktrees/distracted-kapitsa-0d82de` on `claude/distracted-kapitsa-0d82de` (`ab54d339`);
it carries no ADR above 0206, so it does not move the number.

**⛔ INSTRUMENT FINDING — the prescribed CRLF check is a DEAD INSTRUMENT in this Git Bash.**
The task's gate was `grep -c $'\r'` = 0. Self-tested against a planted pair (LEARN-025: a detector
that reports the same value on both arms cannot discriminate):
`printf 'a\nb\nc\n' > lf.txt; printf 'a\r\nb\r\nc\r\n' > crlf.txt` →
`grep -c $'\r' lf.txt` = **3** and `grep -c $'\r' crlf.txt` = **3** — identical, i.e. it returns the
**line count** and can never return 0 for a non-empty file.
`tr -cd '\r' < lf.txt | wc -c` = **0** vs `tr -cd '\r' < crlf.txt | wc -c` = **3** — discriminates.
⇒ line-ending checks in this unit use `tr -cd '\r' < <file> | wc -c`. Measured now: this record
**0** CR, the hub **0** CR, `docs/followups/follow-ups-open.md` **0** CR. `.gitattributes` carries
`* text=auto eol=lf` against `core.autocrlf=true`, so LF is the tree's normal form.

**Not owed by this pass, stated rather than inferred:** `test:db`, `e2e:prod` and the four authz arms
are not owed — nothing in `supabase/` or `src/` was touched and nothing will be (`git status
--porcelain` clean at the time of measurement). No DB state was modified: every read above is a
`select`, and no `begin`/`rollback` probe was needed.
