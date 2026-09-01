# 0172 — AE4's catalog substrate: MATCH FULL is the assignment binding, unreachable scope kinds carry the non-membership roles, and three classification columns are deferred

**Status:** Accepted · 2026-09-01 (PO-ruled in the AE4 Increment 1 plan review)
**Amends:** 0162 §2 item 2 — not its decision, its *specificity*. 0162 specifies the composite FK
`(role, scope_kind) → authz.roles(code, allowed_scope_kind)` without naming a match type; measured
here, the default (MATCH SIMPLE) makes that FK **vacuous for scopeless rows**, so the binding 0162
intends requires `MATCH FULL` and this ADR fixes it as part of the specification.
**Relates:** 0155 (D7, the catalog decision) · 0079 (the ARM/door gate family this increment's
gate record must qualify) · 0061 / 0134 (the `administrativo` capability plane) ·
0078 A35 (the noun rule `resource_kind` is derived from)

## Context

AE4 Increment 1 builds the `authz` catalog substrate: the schema, four tables, twelve seeded role
rows, the binding from `public.memberships` to the catalog, and the AE4.5 generator tooling. It is
inert — nothing delegates to it until AE4.6.

Four questions were undecided by ADR 0155, the plan, and ADR 0162, and each turned on a fact that
could not be read out of any document. All were resolved by probe, in rolled-back transactions
against the live catalog (PostgreSQL 17.6, 2026-09-01).

## Decisions

### 1 — The composite FK is `MATCH FULL`. The default would have been a label.

⭐ **The finding of the increment.** A composite foreign key under the default `MATCH SIMPLE` is
satisfied **vacuously whenever any referencing column is NULL**. Measured on a scratch table shaped
like `memberships` but without the legacy CHECKs:

| | insert `(scope_kind = NULL, role = 'TOTALLY_FAKE_ROLE')` |
| --- | --- |
| MATCH SIMPLE (the default) | **ACCEPTED** |
| MATCH FULL | REJECTED — *"MATCH FULL does not allow mixing of null and nonnull key values"* |
| MATCH FULL, valid fully-scoped row | ACCEPTED |

Since `memberships.role` is `NOT NULL`, MATCH FULL turns the constraint into the proposition 0162
actually wants: every membership row must derive a scope kind **and** have a catalog row for the
pair. This is the "a guard that reads right but fails open" class — the constraint is present,
named, and enforcing nothing for scopeless rows.

⚠ **Its value today is PROSPECTIVE, and the gate record must say so.** On the real `memberships`
table the MATCH SIMPLE hole is **unreachable, and not because of this FK**: `scope_kind` is
GENERATED so NULL requires all three scope columns NULL; `memberships_role_check` rejects an
unknown role; and `memberships_scope_shape`'s `ELSE false` rejects any unknown role regardless of
scope columns, and a known role with all-NULL scope columns too. A MATCH FULL keystone run on the
real table would go **green while measuring `memberships_role_check`**. "Not reachable" is not
"protected". MATCH FULL is the control that **survives** the AE5-complete retirement of those two
CHECKs; until then it is doubly covered. pgTAP 401 partitions the evidence accordingly — §8 proves
the semantics on a scratch table, §9 proves FK existence on the real table (explicitly **not**
match-type-specific, since both key columns are non-NULL there), and §10 names which control
actually fires today.

### 2 — The discriminator is a GENERATED STORED column, and the referential actions are RESTRICT.

Chosen over a trigger + CHECK for three reasons, heaviest first:

1. ⭐ **A generation expression cannot reference another table**, which makes Architecture Rule 13
   *structurally unexpressible* here rather than merely asserted: a future edit folding an
   affiliation lookup into the discriminator will not compile. A trigger could do that lookup
   silently.
2. It cannot be switched off — `alter table … disable trigger` and `session_replication_role =
   replica` both defeat a trigger, and this tree has already been bitten by replica mode defeating
   FK CASCADE.
3. `add column … generated … stored` computes for every existing row during the rewrite, and the
   column cannot be written explicitly, so no door can set it inconsistently with the columns it
   derives from. Verified safe: `app.grant_role_impl` is the only function in the database that
   inserts into `public.memberships` and uses an explicit named column list.

**Referential actions, measured rather than assumed** (on a generated referencing column):

| accepted | rejected |
| --- | --- |
| `on delete cascade`, `on delete restrict`, `on delete no action` | `on delete set null`, `on delete set default` |
| `on update restrict`, `on update no action` | `on update cascade`, `on update set null` |

`on delete cascade` is **legal here and is exactly what must not be used**: it would make deleting
one catalog row a silent mass revocation of every membership holding that role. `RESTRICT` on both,
stated explicitly rather than defaulted. ⚠ **Consequence binding on AE5:** because `on update
cascade` is illegal on a generated referencing column, a role code can never be renamed by `UPDATE`
while assignments exist — a future rename is a data migration, not an `UPDATE`.

### 3 — `platform_admin` and `administrativo` carry structurally unreachable scope kinds.

`memberships.scope_kind` is generated and can only ever produce `organization | hospital |
commission | NULL`. So the two catalog rows that correspond to no membership row are seeded with
values outside that set — `platform_admin` → `none` (zero-scope is a real Axis-4 value, not a gap),
`administrativo` → `capability_plane` (it is not a role at all: an appointment plus a capability
child table, ADR 0061/0134). Neither can ever be matched by the composite FK. They neither break it
nor vacuously satisfy it; they are simply never referents.

⭐ **Why this is the right device rather than a comment:** today `role = 'administrativo'` is blocked
by `memberships_role_check`. That CHECK **retires at AE5-complete**. Under this device the FK blocks
it afterwards too, because no derivable scope kind pairs with `capability_plane`. **The safety
survives the retirement without depending on it.**

⚠ **Named successor property, recorded now because its subject is scheduled for deletion.** pgTAP
401 §3.3 asserts *"the roles with a derivable scope kind are exactly the ten in
`memberships_role_check`"*. That CHECK is the assertion's right-hand side and it retires. Its
successor, to be substituted at AE5-complete, is **"the derivable set equals the set of codes with
`system_managed = false`"** — catalog-internal, and true for the same reason.

### 4 — Three classification columns are NOT CREATED; `risk_class` is (PO override).

The plan permits a column whose semantics are deferred to the audit's §8 residue to be *either* not
created yet *or* CHECK-pinned to its single legal value. **Not-created is chosen for
`sensitivity_ceiling`, `assignable` and `applies_to_descendants`**, because `authz.permissions` and
`authz.role_permissions` both hold **zero rows** through this increment — so a CHECK pinning a value
that no row holds is **itself vacuous**, adding exactly the label the rule exists to forbid. Per
column: `sensitivity_ceiling` has no defined ordering and therefore no identifiable bottom to pin
to; `applies_to_descendants` would assert a proposition about a scope-ancestry relation that does
not exist (deferred to AE7); `assignable` has no decided subject relation (grant / hold / surface).
AE4.3 adds all three in the migration that seeds the rows giving them meaning.

> ⭐ **AMENDED 2026-09-01 (PO ruling) — `sensitivity_ceiling`'s deferral is OVERTURNED; the
> other two stand.** Migration `20261003007130` creates it. **The reasoning below was not wrong;
> its stated reason EXPIRED.** The deferral rested on `authz.permissions` holding *zero rows*, so
> that a CHECK would pin a value no row holds — and **AE4.3 created the subjects**. What did *not*
> expire is the second half of the residue: the **ordering / comparison rule** remains deferred,
> and pgTAP 401 §13.6–13.7 gates that abstinence with a constructed detector rather than trusting
> a comment. ⚠ The column is pinned to a **three-value partition** —
> `none | class2_professional_identity | phi` — not the binary first proposed: checking the
> column's subjects before pinning it surfaced a Class-2 professional-identity capability
> (`app.can_manage_professional`, ADR 0078 §B7) that a binary would have classified as `none`,
> dropping a real sensitivity. `applies_to_descendants` and `assignable` are **untouched** and stay
> deferred for the original reason, which has not expired for them. Detail: the matrix
> [doc](../design/authz-ae43-staff-admin-permission-matrix.md) § 9.

**`risk_class` is created — PO override of the author's proposed deferral.** Consequence owned
here, stated plainly rather than dressed up: **no authority in this tree defines a value set for
`risk_class`.** Not ADR 0155, not the plan, not the audit, which introduces the column without
defining "types, ordering, null semantics, or enforcement". The set
`read | write | authority | irreversible` is therefore **proposed by the author, not derived**. It
is nonetheless *anchored* to distinctions the platform already enforces, so it is a proposal rather
than an invention: the first three mirror the `_case_caps` bitmask's own three-way split (`read_*`
bits · `write_case_content` · `manage_case_access`), and `irreversible` names the immutability
crossings Architecture Rules 5 and 6 already make one-way. Risk is deliberately **orthogonal to
sensitivity** — how far a wrong grant reaches, not how sensitive the data is.

### 5 — Every classification column is a DOMAIN over `text`, never a native enum.

PostgreSQL has no `ALTER TYPE … DROP VALUE`, so an enum value set invented before its subjects exist
is effectively permanent — and AE5 substitutes eleven roles, each of which may widen these
vocabularies. A domain's constraint is replaceable in a normal forward-only migration
(`alter domain … drop constraint` then `add constraint`; measured accepted, and a domain-typed
generated column still backs a MATCH FULL composite FK). This satisfies the plan-audit's
"enum/domain/check for every state and classification column" via the branch that stays amendable —
and it is what makes decision 4's override cheap, since AE4.3 can replace `risk_class`'s value set
wholesale.

### 6 — No `ALTER DEFAULT PRIVILEGES` statement, and that absence is a decision.

Two separate reasons, both measured rather than reasoned. **Functions** are already covered globally
by AE1.2's `for role postgres` rule (`defaclnamespace = 0`), whose own header predicted it would
reach `authz`; re-issuing it `IN SCHEMA authz` is the exact no-op that migration documents. **Tables
and sequences** have nothing to revoke: the `public`-schema ADP revokes exist because the baseline
*granted* ALL there, and PostgreSQL's built-in default for tables grants nothing to anyone (unlike
functions, where a NULL `proacl` includes PUBLIC). Measured in a fresh schema with no grants issued:
`anon`, `authenticated` and `service_role` all hold **no** SELECT, and `relacl` is NULL. So the
"hardening" statement would change no bit while reading in review as a control. The absence is
pinned instead by effective-privilege assertions in pgTAP 401 §4 — including the probe that turns
AE1.2's *prediction* about `authz` into a *measurement* — which is a control that can actually fail.

## Consequences

- The catalog is **AUTHORITY-ELECT**, not the authority (ADR 0162 §2). `memberships_role_check` and
  `memberships_scope_shape` stay until AE5-complete. ⛔ The phrase "the catalog is the authority" may
  not appear in a gate record before that retirement; the honest claim is **"one catalog, bound by
  FK, with legacy CHECKs still standing."**
- pgTAP 401 §3.2 is a deliberate **tripwire**: it asserts every role is `legacy` and is *supposed* to
  red at AE4.6 when `staff_admin` flips to `authoritative`. The test file says so in its own text,
  because a tripwire whose intent lives only in a completed agent's message is an ordinary failing
  test to whoever hits it.
- A twelfth lint gate (`lint:authz-vectors`) enters the chain; CLAUDE.md §8's count and chain list
  were updated in the same commit under a scoped, recorded authorization covering those two edits
  only. Rationale and its reading trap: `docs/lint-gates.md`.
- ⚠ Supabase codegen emits `scope_kind?: string | null` on the memberships Insert/Update types even
  though the column is `GENERATED ALWAYS` and cannot be written. No client code can reach it —
  `lint:memberships-door` forbids direct DML on the table from `src/` — but the type does not encode
  the restriction.
