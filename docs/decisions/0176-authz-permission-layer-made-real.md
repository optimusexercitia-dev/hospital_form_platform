# 0176 — The permission layer made real: three interfaces, a manifest countdown, and the re-key sequenced with AE5

**Status:** Accepted · 2026-09-02 (PO, on the implementation audit of `authz-ae4-catalog` at `a0b27f3c`)
**Amends:** 0155 D7 — the adoption clause. D7 says *"atomically cut the stable wrapper family over
to the resolver"* and wants permission codes *"statically greppable at the enforcement wrappers"*.
The first sentence cannot be executed as written — a role wrapper asks a role question (Context);
the second is the actual requirement. D7 now reads: the **enforcement sites** are re-keyed to domain
authorizers carrying a permission code, and the wrapper family becomes the assignment-projection
layer. The cadence (role-by-role direct substitution), the three role states, G4 / G5 / G8 and the
never-`legacy OR new` rule are unchanged.
**Amends:** 0174 — its framing, not its mechanism. 0174 records AE4.6 as having *"cut `staff_admin`
over to the catalog"* and D1 / D2 as the cutover chokepoint. `authz.holds_role` is **layer 1 of
three** (D3 below); the state gate it introduced stays and additionally bounds layer 2. Nothing in
0174's SQL changes.
**Relates:** 0162 §2 (authority-elect — still stands) · 0172 (the deferred classification columns —
still deferred) · 0175 (the oracle's hand-encoded inputs) · 0079 (the door-sweep family the
manifest feeds) · the
[implementation audit](../reviews/authz-evolution-implementation-audit-2026-09-02.md) F1–F10 ·
[plan § AE4.9](../plans/authz-evolution.md) · `docs/handoffs/authz-ae4-catalog.md`

## Context

**What D7 said, and what landed.** D7 named `authz.has_direct_permission` — the permission
resolver — as the runtime target. AE4.6 (`20261003007200`) delegated both `staff_admin` wrappers to
`authz.assignment_facts` instead, on an argument recorded **only in the migration's comment**
(*"DELEGATION TARGET: `authz.assignment_facts`, NOT a permission code. RULED 2026-09-01"*, ruler
unnamed); AE4.7b collapsed them onto `authz.holds_role`. 0174 was voiced `Relates:` 0155 D7, so no
document carried the amendment — and the plan's own precedence rule says the ADR wins over a plan
or a migration that silently disagrees with it.

**Measured 2026-09-02 on the live catalog** (by the audit after a fresh reset, then reproduced in a
rolled-back transaction at migration head `20261003007240`):

- `holds_role` reads `assignment_facts` + `authz.roles.state`. It reads **no** permission table.
- Callers of `has_direct_permission` in `pg_proc`: **none**. Readers of `role_permissions`: the
  resolver and its explanation only. Readers of `session_selectable`, `risk_class`,
  `sensitivity_ceiling`, `resource_kind`: **none**.
- Delete `staff_admin → commission.forms.edit`: wrapper `t`, resolver `f`, explanation
  `scope_unreachable`. Set `staff_admin` to `legacy`: wrapper `f`, resolver `t`. The resolver accepts
  scope kind `hospital` — and `banana` — for a commission id.
- `is_staff_admin_of` sits in 63 policies + 151 function bodies; `_for` in 2 + 28. The whole
  `app.is_*_of*` family: ≈200 policies, ≈420 function references.

**Why every gate stayed green.** The differential compared the *candidate* evaluator with the
matrix; the wrapper gates compared the *wrapper* with legacy. Both true, neither about the seam
between them. The mid-phase QA review had measured *"callers = 0"* on the resolver and filed it as
*"rename now while callers = 0"*. ⛔ A census returning `<none>` for callers of the thing an ADR
names as the runtime path is a conformance finding, whatever question was being asked.

**Not an exposure.** `holds_role` carries every legacy gate plus the state gate; the pilot is no
less protected than before AE4. The defect is that the **approved matrix is not the oracle of what
shipped**: revoking a grant, adding one, or changing an implication changes nothing a user can
observe. AE5 would have multiplied that by eleven.

**The migration's argument is right.** `is_staff_admin_of(commission)` asks *is this user a
staff_admin here*. No permission code can stand for that: a sentinel breaks on its own revoke;
*"holds any staff_admin-granted code"* returns true for a plain `staff` the moment AE5 grants an
overlapping code; a 43rd marker permission is the role wearing a permission's name. So D7's
sentence was never executable by re-pointing wrappers. What it can mean — and what its second
clause already said — is that the **sites** ask permission questions.

## Decision

**D1 — Option A: the permission model is retained and made load-bearing.** Rejected: Option B —
amend D7 down to a role catalog with a state gate and park or drop the permission substrate. It is
cheap and honest, and it was the lead's stated fallback; it loses the matrix-as-oracle that D7
exists for, and it moves the re-key to after the pilot, against live users. ⛔ Also rejected, by
naming it: the state as built — both models shipped, one inert, the record calling it a catalog
cutover. That option preserves every cost and delivers neither benefit.

**D2 — Three interfaces; product paths call only the third.**

1. **Assignment projection** — `authz.assignment_facts` + `authz.holds_role`: which providers
   (memberships, `profiles.is_admin`, later the Administrativo tables) confer which role at which
   exact scope, with seat expiry and principal state applied and the hat applied per 0174 D1.
2. **Positive entitlement** — `authz.has_permission` (D4): which permission codes those assignments
   confer, implication closure included, **only for roles in `authoritative` state**. It is not
   final authorization, and its name must not suggest it is.
3. **Domain authorization** — `app.can_*` authorizers that carry the permission code as a literal
   (D7's "statically greppable"), compose hard denies (recusal / respondent), record lifecycle,
   sensitivity ceilings and tenant / resource rules **before** the positive source, and are what RLS
   policies, command doors and server actions call. Their explanation names the restriction that
   won; `explain_permission` describes layer 2 only.

Each layer may be called from the one above it and from tests. A policy or door that calls layer 1
or 2 directly for a *permission* decision is a finding; the manifest (D5) is how it is found.

**D3 — `holds_role` is layer 1, and transitional.** It stays the correct answer for a site that
genuinely asks a role question, with that reason recorded in the manifest; every other product
caller is a `pending-rekey` entry, and the count reaches **zero by AE5-complete** — the milestone
that also retires the `memberships` CHECKs (0162 §2). 0174 D2's state gate is unchanged and now
also bounds layer 2. The migration comment's ruling is hereby carried by an ADR.

**D4 — The resolver becomes two functions, and its contract is corrected while callers = 0.** A
private **candidate** evaluator that may see `test_validation` (the pre-cutover oracle; never
EXECUTE-granted to an application role) and a **runtime** evaluator `authz.has_permission` that
requires `state = 'authoritative'` and fails closed otherwise; no caller selects between them.
`p_scope_kind` is validated against the permission's `resolution_scope_kind` and a mismatch denies —
a security parameter kept "for call-shape symmetry" is removed or enforced, never ignored.
`has_direct_permission` / `explain_direct_permission` are renamed (they answer *entailed*, not
direct). `permission_explanation.denied_reason` uses the `authz.denial_reason` domain declared
beside it; `permission_not_granted` is a distinct outcome, with assignment / scope reachability
computed independently of the permission join; the granting path is reported under a stated
precedence or in full, never `LIMIT 1` without `ORDER BY`. Explanation is diagnostic, not a
decision; if it ever becomes remotely callable, its audit lives inside the door.

**D5 — One generated enforcement manifest, no default arm.** Sourced from the migration-owned
permission rows (43 today). Each row declares: its domain authorizer; every direct enforcement site,
or a generated call-graph boundary with a reviewed reason; applicable axes — lifecycle and
sensitivity as **data per permission**, never a global omission; the hard-deny classes outside
entitlement; expected legacy equivalence during its role's cutover; owner and expiry of any
compatibility exception; and `pending-rekey` where the site still calls layer 1. Generation fails on
`catalog − manifest`, `manifest − catalog`, and `authoritative roles − approved suites`. The pgTAP
401 `CASE … ELSE is_staff_admin_of_for` mapping and the generator's empty `catalogPermissions` /
`nonLegacyRoles` arms are retired by it; a 44th permission breaks generation until someone names
its enforcement path.

**D6 — Sequencing: the mechanism in AE4, the countdown across AE5.** `staff_admin` holds 42 of 43
codes, so a permission-keyed site and a role-keyed site are observationally near-identical until a
second role with a **different** bundle shares the site — the discriminating power is AE5's. AE4
therefore proves the seam end-to-end and stops: for each proven permission, a domain authorizer at
the site, and the grant-deletion mutation flipping the **production door** (never only the
resolver). Every AE5 role increment re-keys the sites its bundle touches before its state flips.
✅ **CONFIRMED 2026-09-02 (PO), the same day and before any code — recorded in place rather than
in a successor ADR, and loudly, because the first text of this paragraph read "PROPOSED":** the
Gate AE4 minimum is the three differential representatives, `commission.forms.edit`,
`org.professionals.create`, `org.professionals.read`, each re-keyed end-to-end with the
grant-deletion mutation flipping its production door; every other permission enters the gate as
`pending-rekey`. This is a gate line, not a proposal.

**D7 — G4 is enforced server-side; the in-flight "not implementable" ruling is superseded.**
`public.assume_role` is `SECURITY DEFINER` and reads `authz.roles.session_selectable` with no grant
to `anon` / `authenticated` / `service_role`; the ruling had read G4's "typed query" as a
client-side query into the sealed schema. pgTAP proves a true→false mutation blocks selection while
other roles still select. The vitest key-set comparison stays as a presentation-drift guard.
`platform_role` retirement is not decided here (D8).

**D8 — Explicitly NOT decided; bundled into the AE5 plan and decided together:** F6
exact-assignment active context vs the role-wide hat (audit scope must match whichever wins); F8
`administrativo` out of `authz.roles` (a 12th row under an unreachable `capability_plane` sentinel
whose own comment says NOT A ROLE); `platform_role` retirement; F7 one manifest entry per role in
`role-catalog.ts`. All are pre-users design choices, none blocks the AE4 merge, and one
compatibility migration beats four. ⛔ None may be picked off inside a role increment. The
classification columns stay deferred per 0172 — layer 3 is where their consumer appears, or they
leave with a named reason.

## Consequences

- **Gate-record language.** *"Catalog cutover"* may not describe what AE4.6 built; the honest
  sentence is *"`staff_admin` runs on layer 1; N of 43 permissions re-keyed, the rest
  `pending-rekey`"*. The differential's halves are named for what they compare — candidate vs
  matrix, wrapper vs legacy — and neither is evidence about layer 3 until a site is re-keyed.
- **The sanctioned mixed states are two:** per-role (`authoritative` / `legacy`) and, during the
  re-key, per-site between layers 1 and 3. Never per-caller, never per-path, never `legacy OR new`;
  the manifest countdown is the second state's tripwire.
- **Cheap now, expensive later.** Every D4 change is a zero-compatibility edit only while the
  resolver has no callers; D4 lands before the first re-keyed site.
- **Performance evidence** (plan AE4.4 — absent as of this ADR) is measured on the **final** path,
  a re-keyed site's policy body through layers 3 → 2 → 1, never on `holds_role` alone.
- **The rollback runbook** (plan AE4.6 — absent as of this ADR) must revert a re-keyed site to its
  layer-1 wrapper without deleting catalog data.
- **Gate AE4 stays undeclarable on its own record** — `e2e:prod` RED, `BUG-AE47C-LINKAGE-001`,
  two tester sign-offs, `backend-state.md`'s `authz` section, C2 Tier 1 — independently of this
  ADR (audit F10).
- ⛔ **What this does NOT do:** it does not make the catalog the authority (authority-elect, 0162
  §2, stands until AE5-complete); it merges and pushes nothing; it does not decide D8.

## Rejected alternatives

- **Re-point the wrappers through a sentinel or an "any granted" code** — the migration comment's
  three cases, each wrong by construction (Context).
- **Option B — role catalog only, for the pilot** — D1.
- **Keep the built state and call it a cutover** — D1, named so nobody rediscovers it as a choice.
