# AE0.5 — the authorization matrix AXES (the shape, not the contents)

**Phase:** AE0 · **plan:** `docs/plans/authz-evolution.md` · **authority:** ADR
[0155](../decisions/0155-post-aff4-tenancy-and-person-model-evolution-sequence.md) ·
**owner:** lead · **status:** ✅ **PO-APPROVED 2026-08-26 — SEVEN axes** · **derived:**
2026-08-26 · **stack:** local, fresh reset, head `20261003004300`.

> ✅ **PO ruling, 2026-08-26.** The **seven-axis** set below is approved as the template.
> The plan's AE0.5 row names five; the audit's Phase 0 asks for seven, and AE4.1's
> `authz.permissions` carries `risk_class` + `sensitivity_ceiling`. Seven stands, and
> `docs/plans/authz-evolution.md`'s AE0.5 row is corrected to match rather than the
> deviation being carried silently. This is the template AE4.3 instantiates for
> `staff_admin` and each AE5 role fills thereafter.

AE0 builds and gets the **axes** approved; it does **not** fill any cell. AE4.3 fills the
first matrix (`staff_admin`) and AE5 fills one per role. Approving the axes here is what
makes those per-role matrices **comparable** — a matrix that invents its own axes cannot
be diffed against its siblings, and the differential oracle (AE4.5) is a per-cell
comparison.

Every value set below is **derived from the live catalog and source**, not from prose.
Where a set is defined in more than one place, all places are listed — those seams are
AE4.8's collapse targets and F1's whole subject.

---

## Axis count: SEVEN (approved) — the plan's AE0.5 row named FIVE

✅ **Resolved by PO ruling 2026-08-26: seven.** The reasoning is kept below because the
plan's row is the thing that has to be corrected, and a ruling whose reason is not written
down is one the next reader re-litigates.

⚠ **A deviation from the plan, stated rather than silently taken.** The plan's AE0.5 row
asks for *"persona × role × active-context × scope × operation"* and says it is the grid
**the audit's Phase 0 asks for**. The audit's Phase 0 item 4 actually asks for
*"persona, role, active context, scope, operation, **resource lifecycle, and
sensitivity**"* — seven. The plan's own citation is two axes shorter than the thing it
cites.

**Built as seven, because the two dropped axes are load-bearing downstream:** AE4.1's
`authz.permissions` schema carries `risk_class` **and** `sensitivity_ceiling`, and the
audit's §8 test list requires a *"lifecycle/sensitivity ceiling"* case per permission. A
matrix can be projected down to five later at no cost; a missing axis cannot be
backfilled without re-deriving and re-approving every per-role matrix in AE5.

⛔ **PO ruling required** — approve seven, or rule five and accept that lifecycle and
sensitivity are then per-role free variables.

---

## Axis 1 — PERSONA (36 values; the seed roster)

**Source of record: the seeded rows, not the `seed.sql` header.** The header names **21**
personas; the live DB holds **36** `@test.local` users. The other 15 are seeded and
commented beside their own `INSERT` but never folded back into the header, so the header
is a stale partial copy.

⛔ **There is NO cross-org persona.** Verified against data by three independent
resolutions (memberships→org via direct / hospital / commission joins;
`organization_affiliations`; `hospital_affiliations`→org): **zero principals resolve to
more than one organization**. `multi@test.local` holds two `staff` memberships that are
two *commissions* — CCIH and Farmácia e Terapêutica — **both in Rede A**.

**Consequence, binding on every later phase:** the cross-org deny cell of every matrix
**cannot be filled from the seed**. AE2.3, AE3.3, AE4.5 and each AE5 role each construct
their own cross-org fixture (plan rule 10), and delete it **by identity, never
positionally** — positional cleanup eats seed rows that ~900 tests contractually depend
on. A cross-org test written against a seeded persona passes while proving nothing.

Personas worth naming now because they are the only reachable instance of their shape:

| persona | why it is structurally unique |
| --- | --- |
| `platform@test.local` | the only `profiles.is_admin = true` row |
| `hospitaladmin.dual@test.local` | same role at **two hospitals, one org** — the only probe of the active-context ambiguity in Axis 3 |
| `solo.c@test.local` | `org_admin` **and** `hospital_admin` — two role *types*, so the only natural `/selecionar-perfil` multi-hat case |
| `staff2.ccih@test.local` | `staff` **plus all five** administrativo capabilities — the only full capability-plane instance |
| `multi@test.local` | one role type, two commission scopes |
| `novato.pendente` · `ativo.registro` · `suspenso.temp` · `desativado.conta` | the account-state ladder (Axis 6) |

---

## Axis 2 — ROLE (11 values; **5 independent definition surfaces**)

`org_admin` · `nsp_org_admin` · `hospital_admin` · `nsp_coordinator` · `staff_admin` ·
`staff` · `pqs_member` · `technical_director` · `technical_director_deputy` ·
`quality_reviewer` · `platform_admin`

| surface | carries | note |
| --- | --- | --- |
| `pg_enum` on `public.platform_role` | 11 | the enum lives in `public`, not `app` |
| `memberships_role_check` | 10 (no `platform_admin`) | ⚠ `memberships.role` is plain **`text`**, *not* typed to the enum — a hand-written literal array |
| `memberships_scope_shape` | the same 10 again | a **second** independent hand copy, branched per role |
| `src/lib/role/role-catalog.ts` `ROLE_LABELS` | 11 | type-anchored to the enum, but label prose is hand-kept |
| `profiles.is_admin` | `platform_admin` only | role #11's entire assignment mechanism, structurally separate |

The plan's AE4.2 phrasing *"all ten current roles + `platform_admin`"* is **correct**: 10
membership-bearing roles + `platform_admin` via `is_admin` = 11.

⚠ **`administrativo` is NOT a role** and is not an Axis-2 value. It is an appointment
(`commission_administrativos`) plus a capability child table, and it requires the
appointee to independently hold commission membership. It is an **Axis 5** vocabulary.

---

## Axis 3 — ACTIVE CONTEXT (role-valued, **not** (role, scope)-valued)

Values: **one of the 11 role codes, or ABSENT.**

- Selected by `public.assume_role(p_role platform_role)` — SECURITY DEFINER, **role only,
  no scope-instance argument**. It confirms the role exists for the caller and then
  **discards which scope instance proved it**.
- Stored in `app.active_role_selections` (PK `session_id`), surfaced as the JWT claim
  `claims.active_role` by `custom_access_token_hook`, read back by `app.active_role()`.
- **ABSENT is a real value and it fails closed:** the hook emits no `active_role` key when
  the caller holds **zero** role types or **more than one**, forcing `/selecionar-perfil`.
  Exactly one role type is derived implicitly. `claims.is_admin` is stamped independently
  and always.

⛔ **Two asymmetries the matrix must carry explicitly, or every per-role matrix will
silently assume they do not exist:**

1. **Same role, several scopes is NOT disambiguated.** A `hospital_admin` at two hospitals
   is "active as `hospital_admin`" at **both**; the specific hospital is re-checked per
   door (`is_hospital_admin_of(p_hospital_id)`) against `memberships`. Scope selection is
   app-side routing only (`landingRouteForRole`) and is **never persisted**. So Axis 3 ×
   Axis 4 is **not** a free product — active context constrains the role, the scope id
   constrains the resource, and nothing binds the two together.
2. **The active-context filter applies only to self-checks.** `app.has_role` /
   `has_role_any` consult `app.active_role()` **only** when `p_user_id = auth.uid()`.
   Checking a *third party* skips the active-context filter entirely. Any matrix cell for
   an operation-on-another-person is therefore **active-context-independent by
   construction** — and that must be recorded as a derived property, not discovered again
   per role.

This is G4's "role-type semantics, final-for-now" as it actually exists in the catalog.
Exact-scope contexts require their own ADR and are out of scope here.

---

## Axis 4 — SCOPE (3 kinds + zero-scope; role-exclusive **today**)

`memberships` is the single multi-scope table, keyed **`principal_id`**. The
`memberships_scope_shape` CHECK pins exactly one shape per role, so
`allowed_scope_kind` is **fully role-determined today** and never free:

| scope kind | shape | roles |
| --- | --- | --- |
| **org** | `organization_id` set; hospital + commission NULL | `org_admin`, `nsp_org_admin` |
| **org+hospital** | org + hospital set; commission NULL | `hospital_admin`, `nsp_coordinator`, `pqs_member`, `technical_director`, `technical_director_deputy`, `quality_reviewer` |
| **commission** | `commission_id` set; others NULL | `staff_admin`, `staff` |
| **zero-scope** | **no `memberships` row at all** | `platform_admin` (lives in `profiles.is_admin`) |

Secondary integrity worth carrying into AE4.1: `memberships_hospital_id_fkey` is a
**composite** FK `(hospital_id, organization_id) → hospitals(id, organization_id)` — a
hospital-tier row's hospital must belong to its own org row; and `memberships_title_scope`
requires `title_id ⇒ commission_id NOT NULL`.

⚠ **Zero-scope is a real value, not a gap.** `platform_admin` has no membership row, so
every matrix's scope axis must admit it or the noun rule (ADR 0078 A35 — tenancy /
identity / vocabulary / audit **yes**, content / PHI **never**) has nowhere to be
expressed. AE5.7 flips this role last and encodes the noun rule as *hard restrictions*.

---

## Axis 5 — OPERATION (three tiers, **no shared namespace** — this is F2)

| tier | vocabulary | count |
| --- | --- | --- |
| **(a) role-at-scope predicates** | `is_org_admin_of` · `is_hospital_admin_of` · `is_hospital_member_of` · `is_nsp_org_admin_of` · `is_nsp_coordinator_of` · `is_pqs_member_of` · `is_pqs_operator_of` · `is_pqs_writer_of` · `is_quality_reviewer_of` · `is_staff_admin_of` · `is_tenancy_admin_of` · `is_technical_director_of_for` · `is_member_of` · `is_document_approver_of`; generic `app.has_role` / `has_role_any` | 12-name family |
| **(b1) `_case_caps` bitmask** | `view_case_overview`(1) · `read_case_deliberation`(2) · `read_case_content`(4) · `read_standard_phi`(8) · `read_restricted_phi`(16) · `write_case_content`(32) · `manage_case_access`(64) | 7 bits |
| **(b2) `administrativo` capabilities** | `schedule_meetings` · `create_cases` · `assign_case_phases` · `view_signoffs` · `read_cases` | 5 codes |

⛔ **Two traps, both binding on every census this program runs:**

1. **The bare/`_for` pair.** Policies call the bare form; functions call the `_for` form.
   **No single anchored regex finds both** — sweep unanchored, always. Tier (a) is where
   AE4.3's "sweep both, unanchored" requirement bites.
2. **`read_cases` ≠ `read_case_content`.** The administrativo code and the `_case_caps`
   bit are one word apart and mean different things — the `_case_caps` body says so
   verbatim (*"Two vocabularies, one word apart"*). This is the concrete collision AE4.3
   must resolve when it folds three vocabularies into one permission-code namespace, and
   it is exactly the kind of same-name-different-meaning pair that a mechanical merge
   silently unifies.

⚠ Tier (a) expresses **"holds role R at scope S"** and nothing finer. The genuine
*operation* vocabulary today exists only in (b1) and (b2). AE4.3's permission codes should
be **derived from this existing vocabulary, not invented** — an invented code has no
mapping row back to a current enforcement site, and the mapping row is what makes the
matrix an oracle rather than a wish.

---

## Axis 6 — RESOURCE LIFECYCLE / PRINCIPAL STATE

⚠ **Two distinct lifecycles get conflated; the matrix separates them.**

**6a — principal state** (an input to *every* cell, for both actor and target):
`pending` (`novato.pendente`) · `active` (`ativo.registro`) · `suspended`
(`suspenso.temp`, `profiles.suspended_until`) · `deactivated` (`desativado.conta`,
`profiles.is_active`) · **fully offboarded** (no active affiliation).

⛔ **The fully-offboarded value has no approved authority rule yet** — that is AE2.0's PO
decision (its own ADR), and the plan states it **blocks AE2.3's design**. The axis carries
the value now so the gap is visible; the cells stay empty until AE2.0 rules.

**6b — resource lifecycle** (per resource family): form versions
`draft → published → archived` (published **immutable**; editing clones) · responses
`in_progress → submitted` (submitted immutable, counted) · affiliations
`active → ended → voided` (the AFF4 "voided tense" — voided ≠ ended) · documents
`draft → effective → expired`, plus `disposal_pending`.

⚠ **Lifecycle is not decoration.** A predicate can be true at every instant and false
across a reversal — a lifecycle axis without its **transition graph** is a snapshot, not a
rule. Where a cell depends on a transition rather than a state, the matrix records the
transition.

---

## Axis 7 — SENSITIVITY

| class | what | where |
| --- | --- | --- |
| **none** | ordinary governance content | most of the platform, PHI-free by design |
| **Class-2 professional identity** | `professional_profiles` | case-scoped RLS + audited reads, **no single door** |
| **Class-1 patient PHI — standard** | `_case_caps` bit `read_standard_phi` | |
| **Class-1 patient PHI — restricted** | `_case_caps` bit `read_restricted_phi` | the ladder already exists in the bitmask |
| **restricted personal detail** | `cpf` · `date_of_birth` · `phone` | AE3 moves these to `profile_private_details` |

The three Class-1 modules are `event_patient`, `referral_patient`, and
**`patient_identifiers` + `patient_participants`**. ⛔ **`case_patient` is a feature-flag
key, not a table** — no relation carries that name; verify against the catalog.

This axis feeds AE4.1's `sensitivity_ceiling` directly, and it is why dropping it from the
axis set would cost a re-derivation later.

---

## What the PO is being asked to approve

1. **Seven axes, not five** (or rule five — see the deviation section).
2. **The value sets above**, as derived — in particular that Axis 4 admits **zero-scope**
   and Axis 6a admits **fully offboarded**, both of which are currently un-ruled shapes
   rather than absent ones.
3. **The two Axis-3 asymmetries recorded as properties of the grid**, so no per-role
   matrix re-derives them: scope is not bound to active context, and active context does
   not apply to operations on a third party.
4. **That the cross-org cell is fixture-only** — no seeded persona can fill it, so every
   phase that needs it builds and identity-deletes its own.

Nothing here fills a cell. On approval this becomes the template AE4.3 instantiates for
`staff_admin`.

## Known duplicate-definition seams (recorded here; AE4.8 collapses them)

1. **ROLE** — 5 surfaces (above). `memberships.role` being untyped `text` is the weakest
   link: it cannot drift-check against the enum.
2. **SCOPE-KIND-PER-ROLE** — encoded in SQL (`memberships_scope_shape`) and re-encoded
   **twice** in TS (`landingRouteForRole`, `scopeSummary`), no shared source.
3. **ACTIVE-CONTEXT role-type count** — computed independently in SQL
   (`custom_access_token_hook`) and TS (`getSelectableRoles`); they must agree on
   zero/one/many across a network boundary with no shared code.
4. **OPERATION** — the `read_cases` / `read_case_content` collision, plus the systemic
   bare/`_for` duplication.
5. **PERSONA roster** — `seed.sql` header (21) vs body (36) vs CLAUDE.md's abridged list;
   three nested hand copies, already observed drifting.
