# 0150 — The audit organization is derived from the hospital, and leg 5 means the platform chain

**Status:** Accepted · 2026-08-25
**Supersedes:** nothing. **Amends:** 0149 (D4 — leg 5 as a deliberate non-decision).

## Context

ADR 0149 made `audit_log.organization_id` **authorization-load-bearing for the first time**:
its widened leg 4 is `((commission_id IS NULL) AND app.is_org_admin_of(organization_id))`,
so a hospital-tier row now reaches its org admin *through that column*. Before 0146 the
column was never consulted for hospital-tier rows, and whether it was populated did not
matter.

It was not always populated. `app.audit_write` derived org **and** hospital from
`p_commission` when a commission was supplied, but on the hospital branch it used
`v_org := p_organization` verbatim — derivation existed for one tier and not the other.
Every hospital-tier caller therefore had to remember to pass the organization by hand. All
but one did. `app.trg_audit_standard_ownerships` passes `p_hospital => new.hospital_id` at
all three of its call sites and never passes `p_organization`, so its rows land
`organization_id IS NULL`.

**Measured** (rolled back, hats asserted, calling the real writer with the trigger's exact
arguments):

| reader | sees | should |
| --- | --- | --- |
| `org_admin` of that hospital's org | **0** | ≥ 1 |
| `hospital_admin` of that hospital | 1 | 1 |
| **`platform_admin`** | **1** | **0** |

The first row falsifies ADR 0149's Consequence that "an org_admin's audit reach is now a
superset of each of its hospital admins'". For `standard_ownership.*` the hospital admin saw
strictly **more** than the org admin — the exact inversion 0146 exists to remove, surviving
in the one action class nobody looked at.

**⭐ The third row is the worse half, and it was found only because someone asked what else
a NULL organization changes.** Leg 5 is
`(organization_id IS NULL) AND (commission_id IS NULL) AND app.is_admin()`. It carries no
`hospital_id IS NULL` conjunct, so a NULL-org **hospital-tier** row satisfies it and a
`platform_admin` reads tenant audit **content** — the noun rule (CLAUDE.md §1, ADR 0078
A35). Test `372` §5.2 asserts exactly this cannot happen and passes anyway, because its
fixture guarantees a non-null organization; 372 §0.1 even *states* that guarantee as a
precondition. **The author identified the dependency correctly and guaranteed it in the
fixture. Nothing guaranteed it in the platform.**

**Scope, swept rather than assumed.** All 179 `audit_write` callers in `pg_proc`; 27 mention
a hospital; exactly one passes a hospital without an organization. Every other
hospital-passing caller derives `app.org_of_hospital(<the same hospital>)` (nine functions,
three more inline) or reads a `NOT NULL` column (`hospitals.organization_id`,
`hospital_affiliations.organization_id`, and `memberships_scope_shape` CHECKs
`organization_id IS NOT NULL` for every hospital-scoped role). Malformed rows on the seed:
**0**.

## Decision

1. **Fix the CLASS, in `app.audit_write`, not the trigger.** When a hospital is known and no
   organization was supplied, derive it:

   ```sql
   if v_hospital is not null and v_org is null then
     v_org := app.org_of_hospital(v_hospital);
   end if;
   ```

   This mirrors the derivation the function already performs from `p_commission` directly
   above, and it stops the next hospital-tier writer reintroducing the defect. Fixing only
   the trigger would have fixed the instance and left the class. The function was re-emitted
   from the live `pg_get_functiondef`, never from migration text.

2. **It is a `coalesce`, not an override — derivation is added, validation is not.** An
   explicitly-passed organization still wins, even one that disagrees with the hospital's own
   org. No current caller does that (D-context sweep; `join hospitals` mismatch count = 0),
   and `audit_log` carries no CHECK tying `organization_id` to `hospital_id`'s org. Pinned as
   behaviour in test 373 §1.3 so the absence of validation is a recorded choice rather than
   an assumption.

3. **⛔ NO BACKFILL. It is not "risky", it is barred twice over — measured.**
   - `guard_audit_immutable()` rejects **any** UPDATE on `audit_log`: *"os registros de
     auditoria são imutáveis (somente inserção)"*. Append-only is Architecture Rule 11.
   - Forcing past it (`alter table … disable trigger user`, in a rolled-back transaction)
     shows why the guard is there: `organization_id` is an input to `app.audit_canonical`,
     which feeds the sha256 `row_hash`. Re-running the row's own hash computation after the
     update returns **false** where it returned **true** before. The row stops replaying —
     precisely the tamper-evidence `verify_audit_chain` exists to detect. A backfill is
     indistinguishable, to the verifier, from an attacker editing the trail.

4. **Leg 5 gains `hospital_id IS NULL`. This amends ADR 0149 D4** — which froze leg 5 as a
   deliberate non-decision, on the grounds that its `organization_id IS NULL` bound *was* the
   noun rule.

   **That reasoning was right about the bound and wrong that two keys expressed it.** State
   the principle plainly, so the next reader does not re-derive it:

   > **Leg 5 must express the platform chain exactly as `app.audit_write` and
   > `public.verify_audit_chain` define it — all THREE scope keys NULL.**

   Both functions agree on that definition: `audit_write`'s final `else` arm selects the
   platform chain on `organization_id is null and hospital_id is null and commission_id is
   null`, and `verify_audit_chain` enumerates it with the identical predicate. Leg 5 checked
   two of the three, so it admitted a shape that is not a platform-tier row at all. **This is
   a correction, not a new restriction:** a well-formed hospital-tier row carries an
   organization and never satisfied leg 5. Measured cost to `platform_admin` on the live
   database: rows with `organization_id IS NULL AND commission_id IS NULL AND hospital_id IS
   NOT NULL` = **0**. The only rows it removes are malformed ones nobody intended it to serve.

5. **⭐ Why the write-side fix alone was insufficient — this is the whole argument for
   touching leg 5.** D1 is **forward-only** and D3 makes that permanent: any hospital-tier row
   already written with a NULL organization stays that way forever. Those rows exist in
   environments we cannot inspect. Had we shipped D1 alone, every one of them would have
   remained readable by every platform admin, indefinitely, with no remaining mechanism able
   to reach them. D4 is a **predicate** change and touches no data, so it closes that half
   **retroactively**. The two halves have genuinely different reach and the ADR says so twice
   on purpose (see Consequences).

6. **Test 372 §6.4 was rewritten, and the replacement is strictly stronger.** It asserted
   `qual NOT LIKE '%hospital_id IS NULL%'` over the **whole** predicate; D4 puts that string
   on leg 5 legitimately, so the old form reds on a correct policy. Relaxing an assertion so
   one's own change passes is one edit away from retiring the keystone, so the replacement was
   held to the original standard and verified by mutation:

   | mutation | result |
   | --- | --- |
   | restore leg 4's `hospital_id IS NULL` | **372 §6.4 reds** (+ §1.1, §1.2, §1.3, §2.2, §3.2) |
   | remove leg 5's `hospital_id IS NULL` | **372 §6.8, 373 §4.2, 373 §5.1 red** |

   Both are now **leg-scoped** — they match a whole leg rather than a bare substring, because
   a substring test cannot tell *which* leg the conjunct sits on, and "which leg" is the
   entire difference between the bug (0146) and the boundary (this ADR). The new 6.4 is
   stronger than what it replaced: the old `NOT LIKE` also passed if leg 4 were deleted
   outright.

## Consequences

- **`standard_ownership.created/updated/deleted` rows now reach their org admin.** The
  `accreditation` flag is `enabled = true`, so this surface is live rather than dormant: the
  trigger fires on the first standard-ownership assignment in any environment.

- **⚠ The two halves have DIFFERENT REACH, and "the gap is closed" would be half true — with
  the false half being the confidentiality half.** Stated separately on purpose:
  - **Confidentiality (`platform_admin` over-read) — closed retroactively.** D4 is a
    predicate change, so pre-existing NULL-org rows stop being readable immediately.
  - **Availability (org admin under-read) — closed forward-only, never retroactively.** Any
    pre-existing NULL-org hospital-tier row stays invisible to its org admin **permanently**.
    D3 is why, and D3 is not negotiable. Local seed holds zero such rows; production is
    unknown to us.

- **A malformed hospital-tier row now fails CLOSED for everyone.** If `app.org_of_hospital`
  returns NULL (a hospital id that does not resolve — `audit_log.hospital_id` carries no
  foreign key), the row still lands org-NULL, and it is now readable by *nobody*: not the
  platform admin (D4), not an org admin (no organization for leg 4 to key on). Pinned in test
  373 §4.3 so a future reader knows D4 is a confidentiality fix and not a redistribution of
  the row to a different admin.

- **The chain is untouched, and this was proven rather than argued.** Chain membership for a
  hospital-tier row is decided on `hospital_id` + `commission_id IS NULL` in **both**
  `audit_write`'s seq lookup and `verify_audit_chain`'s enumeration; neither reads
  `organization_id`. The precedence block tests `v_hospital is not null` **before**
  `v_org is not null`, so a now-non-null `v_org` cannot re-tier a row. Test 373 §3 measures
  all of it: `seq` advances by exactly 1 over the row written immediately before, `prev_hash`
  equals that row's `row_hash`, `verify_audit_chain` accepts the chain, and the row does not
  appear on the org chain.

- **⭐ A fixture can be *more* well-formed than the platform, and that is invisible by
  construction.** 372 §0.1 asserts its hospital-tier row carries a non-null organization —
  correctly identifying the exact column the widened leg keys on, and then *guaranteeing* it
  in the fixture. Every arm downstream then measures a platform that always populates that
  column. Nothing in a green suite can say "the precondition you asserted is not an invariant
  the platform holds". The generalisable form: **when a test asserts a precondition about its
  own fixture, ask what enforces that precondition in production** — and if the answer is
  "every writer remembers to", it is not enforced. Here the answer was "all but one".

- **The `platform_admin` half was found by asking a second question of the same NULL.** The
  first question — "who can no longer see this row?" — found the org-admin inversion. The
  second — "who can *now* see it that could not before?" — found the leg-5 admission, which
  is the more serious of the two and which the first question could never surface. A NULL in
  an authorization-load-bearing column has *both* effects, always.
