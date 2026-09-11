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
