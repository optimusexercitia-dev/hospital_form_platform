# Decision brief — `cases.visibility_policy`

**For:** PO · **From:** lead · **Date:** 2026-07-16 · **Blocks:** A2's equivalence diff
**Method:** live catalog only (`pg_proc`/`prosecdef`, `pg_policies`, `pg_trigger`, ACLs) +
executed probes as `set local role authenticated`. No claim below is from migration text.
**Scope:** local DB only (117/117 migrations, matches branch). Nothing pushed, nothing remote.

---

## 1. The ask — three questions

| # | Question | My recommendation |
|---|---|---|
| **Q1** | Does A1's ethics correction (`explicit_grants_only` → `commission_default`) land in `seed.sql` **now**, before A2? | **Yes — it must precede A2's diff.** See §5. |
| **Q2** | **Who** may change a case's visibility after creation, and through what door? | A **guarded RPC** (`set_case_visibility`), coordinator-only, audited — mirroring the `set_case_confidentiality` door that already exists. |
| **Q3** | When a case type's default is corrected, do **existing** cases move? | **No — forward-only, per-case override.** Today this is not merely undesirable but *unimplementable* (§3, D4). |

Q1 is confirmation of a ruling you already made. **Q2 and Q3 are genuinely open.**

---

## 2. What is live today (verified)

- **The column.** `cases.visibility_policy text NOT NULL DEFAULT 'commission_default'`,
  domain `commission_default | explicit_grants_only`. Live: **6 / 1**.
- **The seeded ethics default is still the value A1 ruled wrong.**
  `case_types.default_visibility_policy = 'explicit_grants_only'` (`seed.sql:2107`, `:2118`).
  **A1's correction was never applied.**
- **Its live effect is narrower than the ADR implies.** Only `app.can_reach_case_on_member_surface`
  reads the column unconditionally. `can_read_case` and `can_read_case_patient` read it *only* inside
  `if not app.feature_enabled('case_access')` — and `case_access` is live `enabled = t`, so **those two
  branches are dead code today**. They are the flag-OFF belt, not the runtime rule.
- **`case_types` is live `enabled = t`** — so the divergence below is present behaviour, not a latent trap.

## 3. Four defects, in severity order

### D1 — a staff_admin can silently widen an ethics case (**proven**)

`cases_staff_admin_write` is `FOR ALL` to `authenticated`; `authenticated` holds table-level `UPDATE`;
**no trigger guards this column**. So the column is writable by raw PostgREST `PATCH`.

Executed, against the seeded ethics case, as `chefe.ccih@test.local` (a staff_admin of that commission),
measuring a plain non-excluded member (`staff2.ccih@test.local`):

| | `visibility_policy` | member reach |
|---|---|---|
| before | `explicit_grants_only` | **f** |
| after staff_admin's `PATCH` | `commission_default` | **t** ⟵ widening |
| after restore | `explicit_grants_only` | **f** |

The restore returning to `f` is the positive twin — the assertion is not vacuous.
*(My first run of this used `staff1.ccih`, who is `is_case_excluded = t`; the hard-deny masked the
widening and the probe read `f`. A negative from an excluded fixture proves nothing. Corrected fixture above.)*

### D2 — the widening emits **no audit row** (Rule 11)

`app.trg_audit_cases` writes on `INSERT`, then `elsif new.status is distinct from old.status`. A
visibility change with no status change falls off the end. Measured: **audit_log delta = 0** across the
flip above. Rule 11 says every mutation emits a row; this one does not. D1 is therefore **undetectable
after the fact**.

### D3 — the two creation doors disagree, permanently

- `create_case` — **never writes the column**. Takes the column default `commission_default`, whatever
  type the case morally is.
- `create_case_from_template` — writes the type's default, *iff* `p_case_type_id is not null AND
  app.feature_enabled('case_types')`.

**Same case type, opposite visibility, depending on which RPC created it.** The doc comment at
`src/lib/queries/cases.ts:485` ("snapshotted onto `cases.visibility_policy` at create from
`case_types.default_visibility_policy`") describes only the second door and is false for the first.

### D4 — a case does not record its type, so no correction can ever be re-applied

`cases` has **no `case_type_id`**, and no FK to `case_types`. Neither does `process_templates`. The only
references to `case_types` anywhere are `case_participant_roles` and `case_type_terminology` — neither
links a *case*. The type is a **parameter** to `create_case_from_template`, read for its defaults, and
**discarded**.

Consequences: you cannot audit which cases came from which type; you cannot retroactively apply a
corrected default; and Q3 has no implementable "yes" branch without new schema.

### The contrast that makes all four indefensible

The codebase already knows this pattern and applied it to **less** sensitive columns:

| Column | Raw-table write | RPC door | Audited |
|---|---|---|---|
| `status` (workflow) | **blocked** — `guard_case_status()` raises *"case status changes must go through the case RPCs"* | yes | yes |
| `confidentiality_level` | open | **yes** — `set_case_confidentiality` + app action (`src/lib/case-recusals/actions.ts:101`) | — |
| **`visibility_policy`** (**the authorization column**) | **open** | **none** | **no** |

`src/` touches `visibility_policy` in generated types and one read-only query. **There is no product
surface to set it at all** — no RPC, no server action, no UI.

## 4. Correction to my own prior reporting

Last session I told you this column was *"permanently `explicit_grants_only`, with no door to correct
it."* **That was wrong, and I asserted it without probing.** A door exists — it is just the wrong door:
an unguarded raw-table `PATCH`, available to every staff_admin and commission_admin of the commission,
silent. That is worse than the absence I reported, and in the opposite direction: I described a case
stuck **closed**, when the live risk is a case that can be forced **open**.

This also corrects **"blocks A3"** from the same message. A3 (the agenda-item leak) *inherits* this
column's semantics through the case rule; it does not independently depend on the decision. **A2 is the
real coupling.**

## 5. Why this must precede A2 (the sequencing consequence)

A2's member arm keys on `cases.visibility_policy = 'commission_default'` as the **sole runtime
authority** (ADR 0078 D11/E, line 372). A2's proof obligation is a full-population
`LOST = 0 / GAINED = 0` equivalence diff.

That diff runs over the live population — **today 6 `commission_default` / 1 `explicit_grants_only`**.
Applying A1's seed correction *changes that population*. So:

> If A2's diff runs first, it proves equivalence over a population that is about to change, and the
> proof expires the moment the seed is fixed.

This is **§7.9** — *a closure is only closed over the population you applied the rule to* — arriving one
unit early, which is the only reason it is worth interrupting A2 for.

## 6. Options

| | Option | Cost | Leaves open |
|---|---|---|---|
| **A** | **Seed only** (A1 literal: flip the ethics default) | one token | D1, D2, D3, D4. A1's own sub-group scenario stays unimplementable — there is no override door for a coordinator to use. |
| **B** ⭐ | **Seed + `set_case_visibility` RPC + guard trigger + audit** — mirror the `set_case_confidentiality` shape exactly | one small migration + one app action | D3, D4 (both deferrable — see below) |
| **C** | Drop the per-case knob, derive visibility | — | **Not viable.** A1 requires a per-case override. |

**Recommend B.** It is the smallest change that makes A1 *true as written*: A1 claims "no schema change —
`cases.visibility_policy` was already per-case overridable", and that claim is only honest once the
override is a real, guarded, audited door rather than a raw `PATCH`.

D3 and D4 are separable and I would **not** fold them into B:
- **D3** is arguably fine if Q3 is "forward-only" and `create_case` is understood as the processless
  door (`processless_cases` is live `t`) — but it needs a PO ruling, not a silent default.
- **D4** is schema work (`cases.case_type_id`) whose only justification is a "yes" to Q3. If Q3 is **no**,
  D4 stays a documentation gap, not a defect.

---

## 7. What I need from you

1. **Q1** — confirm the seed fix lands now, ahead of A2. *(Recommend yes.)*
2. **Q2** — who holds `set_case_visibility`? Coordinator (`staff_admin`) only, or also org/hospital admin?
   Note today's *de facto* answer is "staff_admin **and** commission_admin, unaudited".
3. **Q3** — forward-only, or must existing cases follow a corrected type default? *(Recommend forward-only;
   "yes" costs D4's schema.)*
4. **D1/D2 severity** — these are live on the branch but **not on remote** (nothing pushed). Do you want
   them fixed inside this brief's unit, or filed as their own bug with a `tester` repro first?
