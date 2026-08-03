# 0092 — FF-4 Power Authoring: a commission-owned block library, condition-closed snapshots, and a five-token default vocabulary

**Date:** 2026-08-03 · **Status:** accepted (product-owner decision) · **Owner:** platform lead.
**Phase:** FF-4, the **last** of the five feature phases ADR
[0086](0086-flexible-forms-pre-pilot.md) pulled pre-pilot — its gate is the last thing before the
pilot deploy (ruling 2 there). **Flag:** `power_authoring` (seeded OFF; flipped by its own enable
migration at the FF-4 gate).
**Implements:** [docs/plans/flexible-forms-program.md](../plans/flexible-forms-program.md) §3 FF-4.
**Builds on:** ADR [0060](0060-flexible-forms-foundation.md) (F3 substrate; `form_calculations`
stays reserved) · ADR [0087](0087-ff1-repeating-groups.md) (container items; the **P0-1
correction-copy trap**) · ADR [0089](0089-ff2-matrix-risk-matrix.md) (the shared deep-copy helper
this phase reuses) · ADR [0090](0090-ff3-validation-engine.md) (`form_item_validations`;
`required_if`) · ADR [0091](0091-ff5-entity-reference.md) (reference config lives in
`form_items.config`, so there is no sixth child table) · ADR
[0078](0078-authorization-capability-model.md) / [0079](0079-authz-door-blindness-standing-invariant.md)
(a DEFINER gate *replaces* RLS; keystone discipline).

## Context

FF-4 is last **structurally**, not merely by schedule: the library must be able to snapshot every
item shape the four prior phases shipped. ADR 0086 ruling 6 already trimmed it — reusable
block/question library + dynamic defaults only, **calculated fields stay post-pilot**.

The program plan left three questions open. The PO settled all three on 2026-08-03 (rulings 1, 4,
5 below). A fourth question the plan did not anticipate — what happens to conditions *inside* a
snapshot — turns out to be the sharpest correctness risk in the phase, and is settled in ruling 3.

## Substrate (live catalog, 2026-08-03)

Read from `pg_proc` / `pg_constraint` / `information_schema`, never from migration text (CLAUDE.md
§graphify exception). **235/235 migrations registered**, max version `20260902000900` matching the
last file on disk.

**The deep-copy authority is `app.copy_version_children(p_source_version_id, p_target_version_id)`**
— SECURITY DEFINER, extracted from `clone_form_version` by FF-2 (INFO-1). Its insert list is the
complete enumeration of what an item subtree *is*:

| Child | Carried |
|---|---|
| `form_items` | recursive via `parent_item_id`, re-linked after insert |
| `form_item_options` | incl. `is_other` / `is_exclusive` / `risk_weight` / `score` / `analytics_code` |
| `form_matrix_rows` / `form_matrix_columns` | FF-2 axes; both carry `form_version_id NOT NULL` |
| `form_item_validations` | FF-3; inserted **last**, after the `parent_item_id` re-link |

That ordering is not stylistic: `app.guard_item_validation_row` resolves the new item's **parent
type** to check `unique_within_group` coverage, so copying validations before the re-link sees a
NULL parent and refuses the row. The library writer inherits the constraint verbatim.

FF-5's reference config rides in `form_items.config` (jsonb) — there is **no** `form_item_references`
table — so the four rows above are the whole surface. `form_items.form_version_id` is maintained by
`form_items_sync_version_trg`, not by the caller.

Other facts the design turns on:

- **No library/block table exists.** Greenfield; no back-compat obligation (memory
  `prelaunch-db-reset-ok`).
- **`form_items_no_nested_container`** — a container may not be nested inside a container. Nesting
  is capped at 1, so a snapshot's depth is bounded at 2 by construction.
- **`form_items_default_value_display_null` is WEAKER than its TS counterpart.** The DB CHECK
  excludes `default_value` only on `section_text` / `image`. `supportsDefaultValue()`
  (`default-value-editor.tsx`) additionally excludes `group`, `repeating_group`, `matrix`,
  `risk_matrix`, `reference` — the types that answer somewhere other than `answers.value`. The DB
  will currently accept a `default_value` on a matrix that nothing can ever apply.
- **SQLSTATE high-water is `HC0Q5`.** FF-4 allocates from **`HC0Q6`**.
- **Migration window: above `20260902000900`** → `20260903000000`–`20260903000900`.

## Decision

**1. The library is commission-owned, with exactly one RLS read arm (PO ruling, 2026-08-03).**
`form_block_library` carries `commission_id NOT NULL`; an entry is visible and insertable only
inside the commission that saved it. Read arm and write arm resolve to the same perimeter (the
commission's `staff_admin` / commission-admin — the existing form-authoring perimeter,
`app.is_staff_admin_of` / `app.is_commission_admin_of`). Cross-commission is denied; cross-org is
denied twice over.

The PO chose the tightest option knowingly over an `org_visible` boolean. Widening later is purely
additive — one nullable boolean plus one `OR` arm — and nothing in this phase forecloses it. What
the tight scope buys now is that the phase adds **one** new perimeter to reason about in the last
gate before the pilot, and `library_rls_tenant_scoped` is a keystone with a single failure mode.

**2. A snapshot is an immutable materialized copy. Provenance is denormalized text, not a foreign
key.** Insert **materializes** rows via the deep-copy path — no live link back to the library entry,
so Rule 5 (published immutability) and `clone_form_version` are untouched, and an inserted block is
thereafter an ordinary part of its draft.

Symmetrically, the entry does **not** point back at where it came from. Provenance
(`saved_by`, `saved_at`, source form title, source version number) is captured as denormalized
text/uuid-without-FK at save time. Two reasons, and the second is the real one: a FK to
`form_versions` forces a CASCADE-vs-RESTRICT decision on a table whose whole point is to outlive
its source, and — the deciding argument — **any FK present will eventually be joined**, which is
how a "snapshot" quietly becomes a live link. Removing the temptation is cheaper than documenting
it.

The `snapshot` jsonb is **never updated**. Renaming, re-describing, and deleting an entry are
allowed; changing what it contains means saving a new entry. This keeps `library_insert_deep_copy`
asserting against a fixed artifact rather than a moving one.

**3. A snapshot is CLOSED UNDER ITS OWN CONDITIONS — refused at save, rewritten at insert.**
This is the ruling the program plan did not anticipate, and the one a naive implementation gets
wrong.

`visible_when` and `required_if` are expressed over `question_key`s. A block whose child condition
references a sibling *inside* the block is portable. A block whose condition references a
`question_key` **outside** the subtree is not — inserted elsewhere it either dangles or, far worse,
silently binds to an unrelated question that happens to share the key.

- **At save:** if any `visible_when` / `required_if` within the subtree references a `question_key`
  not present in the subtree, `save_block_to_library` **refuses** (`HC0Q6`) and names the offending
  keys. Refusing is correct rather than harsh — the alternative is stripping conditions at save,
  which silently changes the block's meaning between what the author saw and what they stored.
- **At insert:** the ruling-4 rename map is applied to the **conditions as well as the keys**. A
  block inserted with `peso → peso_2` must have its internal condition rewritten to read `peso_2`.
  Renaming keys without rewriting conditions is the defect this ruling exists to prevent; it passes
  every structural test and only shows up as a question that never appears.

**4. `question_key` collisions auto-suffix deterministically, and the renames are surfaced (PO
ruling, 2026-08-03).** `insert_block_from_library` never fails on a collision: it suffixes
(`peso` → `peso_2`, `peso_3`, …) against the keys already in the **target version**, deterministically
and server-side, and returns the old→new rename map. The builder then shows "N chaves renomeadas"
with inline edit while the version is still a draft.

Silent suffixing was rejected explicitly. Dashboards aggregate cross-version **by `question_key`**
([f3-question-key-aggregation.md](../design/f3-question-key-aggregation.md)), so a silent rename
splits a metric in two with no signal — and the shipped record of this codebase is that
silent-and-green is exactly how these survive review. Surfacing it costs one list in a draft-only
surface, where keys are still free to change.

**5. The dynamic-default vocabulary is five closed tokens, all PHI-free (PO ruling, 2026-08-03).**
`form_items.default_source` (text, nullable) resolves server-side at draft start:

| Token | Applies to | Resolves to |
|---|---|---|
| `today` | `date` | draft-start date |
| `now` | `time` | draft-start time |
| `current_user_name` | `short_text` / `free_text` | filling user's `profiles.full_name` |
| `current_user_email` | `short_text` / `free_text` | filling user's email |
| `commission_name` | `short_text` / `free_text` | the version's owning commission |

All five resolve from the actor's session plus the version's commission — no new read path, no new
join, no PHI. **Case context is deferred to post-pilot.** `responses` does carry `case_phase_id` and
`target_case_participant_id`, so case-scoped defaults are reachable, but reaching them would couple
the form engine to the case module and put the participant lane one step from a default resolver —
in the last phase before the pilot. Nothing here forecloses it: the vocabulary is a closed set with
a CHECK, and adding a token is one arm.

Resolution is **idempotent and never destructive**: a default seeds an answer only where none
exists, so resume is stable and a filler who clears a field does not have it refilled behind them.
This is `default_value`'s existing contract; `default_source` inherits it rather than inventing one.

**6. `default_source` XORs with `default_value`, and is pinned to the type set that can honour
it.** One CHECK for exclusivity (an item has a literal default, a dynamic default, or neither) and
one CHECK restricting `default_source` to the types `supportsDefaultValue()` admits — which is
**tighter** than the existing `form_items_default_value_display_null`. FF-4 does not inherit that
looseness, and does not retro-tighten `default_value` either: narrowing a shipped CHECK is a
separate change with its own migration risk, noted as an open question rather than smuggled into
this phase. The token↔type mapping in ruling 5 is a CHECK, not a convention.

**7. Both writers are DEFINER doors; the library is read INVOKER.** `save_block_to_library` and
`insert_block_from_library` are SECURITY DEFINER (they write across the item subtree and must
enforce the ruling-1 perimeter and the ruling-3 closure themselves), both `revoke execute … from
public, anon` at creation — ADR 0091 Amendment 2's lesson, applied at birth rather than patched.
Listing and browsing the library is a plain INVOKER read inheriting ruling 1's policy; there is no
reason for a door in front of a read whose perimeter already exists.

**8. The unit is one item subtree — a single input item, or one container with its children.**
Not a section: a section carries `visible_when`, `requires_signoff` and `signoff_role`, which are
version-level concerns with their own insert target and their own collision surface. Any item type
may be saved, including display items (`section_text` / `image`) — a reusable instruction block is
genuinely useful, and the copy path is already type-agnostic, so admitting the full set is what
makes "the library must contain every shipped type" testable rather than aspirational.

**9. No `form_calculations`.** ADR 0086 ruling 6, restated because this is the phase that would
otherwise absorb it. The name stays ADR-0060-reserved.

## Consequences

- FF-4 adds **one** table, **two** DEFINER doors, **one** nullable column on `form_items`, and no
  new read perimeter. It is the smallest of the five phases by surface — appropriate for the last
  gate before the pilot.
- The library is per-commission, so the pilot ships with no cross-committee block standardization.
  That is the accepted cost of ruling 1; the widening is queued as an open question, not a defect.
- `docs/backend-state.md` gains `form_block_library` + the two doors at Record. ARCHITECTURE.md §2
  is **not** amended — the canonical forms/response shape is unchanged (a nullable authoring column
  on `form_items` is not a shape change), and Rule 12 is untouched (no PHI).
- The FF program's migration high-water moves to `20260903000900`; the pilot deploy's local/remote
  reconciliation (program plan §5) inherits it.

## Gate keystones (all mutation-proven — revert the guard, the keystone must go red)

- `library_insert_deep_copy` — a block carrying options **and** matrix axes **and** validations
  **and** a reference config round-trips save → insert with every child intact, and validations land
  *after* the parent re-link. Asserted over the **same child-table set as
  `app.copy_version_children`**, derived from the catalog rather than hand-listed, so a sixth child
  table added to the clone path without joining the library reds this keystone (memory
  `new-door-must-inherit-every-sibling-arm`).
- `library_rls_tenant_scoped` — a sibling commission in the same org cannot read, insert from, or
  write to another's entries; cross-org likewise. Paired with an **over-grant twin** (widen the
  policy to `using (true)` → the keystone must red), because a no-regression assertion passes a
  widening by construction (memory `no-regression-claim-needs-overgrant-twin`).
- `library_reader_non_writer` — direct DML on `form_block_library` denied for `authenticated`; the
  two doors are the only writers. Includes the **DELETE** arm: the party that may read an entry must
  not be able to delete it outside the door (memory `exclusion-only-as-strong-as-weakest-mutator`).
- `snapshot_condition_closure_negative` — saving a subtree whose condition references an outside
  `question_key` is refused with `HC0Q6` and names the key; a subtree whose conditions are internal
  saves clean.
- `insert_rewrites_conditions_with_keys` — after a colliding insert, the block's internal
  `visible_when` / `required_if` reference the **renamed** keys, and the pre-existing item that owned
  the original key is untouched. The ruling-3 defect, pinned.
- `insert_collision_suffix_deterministic` — two inserts of the same block into one version yield
  `k_2` then `k_3`; the returned rename map matches what actually landed.
- `default_prefill_idempotent` — a dynamic default seeds only an unanswered item; re-entering the
  draft does not overwrite an edited or cleared answer; resume is stable across both.
- `default_source_type_check_negative` — every token × ineligible-type pair is rejected, and
  `default_source` + `default_value` together are rejected.
- `library_doors_revoke_public` — neither door is executable by `public` / `anon` (ADR 0091
  Amendment 2 — `proacl` shows grants, never revokes).
- **E2E:** save a rich block (options + validations + a matrix + a nested repeating group) → insert
  it into another draft of the same commission → observe the rename list → publish → fill → submit,
  plus one keyboard-only pass over the library browser.

## Amendment 1 — ruling 4's "inline edit" is withdrawn; the rename list is read-only (2026-08-03)

Found by `frontend` on contact with the builder, not by reading the ADR. Ruling 4 says the builder
shows the renames "with inline edit while the version is still a draft and keys are still free to
change." **Keys are not free to change, and never have been.** Verified against the live catalog and
the action layer, not inferred:

- **No `pg_proc` body performs `UPDATE … SET question_key = …` on `form_items`.** The functions that
  update `form_items` at all (`app.copy_version_children`, `delete_section_moving_items`,
  `reorder_item`) leave the key alone; the four bodies matching `question_key =` are answer-path
  reads keyed *by* question_key, not renames.
- `updateItem`'s contract is explicit: *"The item's type and its question_key are NOT changed:
  question_key is stable so dashboards aggregate across versions."*
- `addItem` mints the key server-side and never accepts one from the author.

So "inline edit" described a capability the platform does not have. `frontend` declined to render a
field that looks editable and silently discards on save — correctly; that is the
`guards-that-read-right-but-fail-open` class this codebase has been burned by.

**The rename list ships read-only** (old→new per row, "N chaves renomeadas" summary, `[]` renders
nothing), structured so a real rename action is an additive diff later.

**A second finding narrows how much ruling 4 matters at all.** `addItem` mints
`` `${slugifyLabel(label)}_${shortSuffix()}` `` — **every** key already carries a random suffix.
Keys are therefore unique by construction against anything not derived from the same source, and the
collision `insert_block_from_library` must handle is the *narrow* one: inserting the same library
block into the same version twice, because only a snapshot carries a literal key forward. The
cross-version aggregation-split worry that motivated ruling 4's "surfacing" requirement is
correspondingly smaller than the ruling implies — surfacing is still right (it is strictly better
than `addItem`'s shipped precedent, which auto-suffixes on collision and says nothing), but it is an
informational affordance, not a remedy.

That also means **within a version the suffix is always correct**: two distinct questions must have
two distinct keys, so "rename it back" is unsatisfiable by construction. A rename door's only real
use is aligning a key with a *historical* version's key so the two aggregate — a genuinely new
platform capability, not an FF-4 gap, and one that would inherit ruling 3's condition-rewrite
obligation on a new surface. Queued below rather than absorbed into the last gate before the pilot.

The keystone `insert_collision_suffix_deterministic` is unaffected — the server behaviour it pins
never depended on the edit affordance.

## Amendment 2 — ruling 2's metadata mutability had no mechanism; the doors are built, not withdrawn (2026-08-03)

Found independently by **both** `backend` and `frontend` at the end of their first task blocks.
Ruling 2 states that "renaming, re-describing, and deleting an entry are allowed (metadata)".
Nothing implemented it: `authenticated` holds zero DML on `form_block_library` and only the two
create-time doors exist, so an entry was permanent and unrenameable from the moment it was saved.

**Contrast with Amendment 1, and the reason the two resolve in opposite directions.** There, the
withdrawn affordance had no *purpose* — within a version the auto-suffix is always correct, so
"rename it back" is unsatisfiable by construction and read-only surfacing was already complete.
Here there is no workaround at all: a typo'd or obsolete entry is permanent clutter in a browser
whose whole value is being scannable, and a library that can only ever grow degrades on a schedule.
So ruling 2 is **implemented, not amended** — `update_block_library_entry` and
`delete_block_library_entry`, migration `20260903000500`+, same DEFINER posture and same commission
perimeter as their two siblings, no new RLS policy and no new grant.

**The keystone this earns is the point of doing it.** Until now ruling 2's snapshot immutability was
a *convention* holding only because nothing could write at all. An update door makes it a real
invariant needing a real proof: `library_metadata_door_cannot_touch_snapshot` — the door is
structurally incapable of mutating `snapshot`, `commission_id`, or the provenance columns
(mutation-proved by widening its UPDATE to include `snapshot` and confirming red). Paired with a
delete-safety positive: **deleting an entry disturbs no form built from it**, which pins the
no-live-link design of ruling 2 from the other end.

### Method notes worth keeping

- **`library_reader_non_writer`'s explanation was wrong while its result was right.** The file
  reasoned that "Postgres reuses the SELECT policy's USING clause as UPDATE/DELETE's row filter".
  It does not — with RLS enabled and no verb-specific policy, UPDATE/DELETE are **default-denied**
  regardless of grant. The assertions went red on a widened grant because they assert over
  `has_table_privilege` (grant-shaped), which is a *stronger* test than the one intended. Kept, with
  the comment corrected: a wrong explanation in a test comment is the
  assertion-that-goes-stale-silently class, and the next reader would have inherited it.
- **`jsonb_build_object` encodes a SQL NULL as the jsonb value `null`, not an absent key.** A later
  `->` extraction then reads it as "has a value", failing `IS NULL` CHECKs on snapshot round-trip.
  Fixed with `jsonb_strip_nulls` at snapshot-build time.
- **`form_items.position` is a per-SECTION sequence shared by top-level items *and* children**
  (`unique(section_id, position)`, no `parent_item_id` scoping — mirroring `resolveInsertPosition`).
  Computing the append slot with a `parent_item_id is null` filter collides with a prior insert's
  own children on the second `insert_block_from_library` call.
- **`library_insert_deep_copy`'s structural exclusion set needs `form_sections` alongside
  `form_items`** — `copy_version_children` clones a whole version, sections included, which is
  broader than ruling 8's "the unit is a subtree, never a section."

### Pattern across all three amendments

Three rulings lost to the code in one phase (validations-copy-ordering caught pre-build; ruling 4's
inline edit; ruling 2's metadata doors). **Every one was invisible to lint, tsc, Vitest, `next build`
and pgTAP alike** — they surface only as silently dropped rows, a field that discards on save, and an
affordance that was never built. None would have been caught by review of the ADR against itself;
all three were caught by someone holding the ADR against the actual catalog and the actual builder.
That is the argument for contract-first with teammates who are expected to push back, and it is worth
carrying into the next phase.

## Open questions (deferred, not blocking)

- **A `question_key` rename door** (Amendment 1) — draft-only, per-version uniqueness re-validated,
  and it must rewrite every `visible_when` / `required_if` referencing the old key, symmetric to
  `insert_block_from_library`. Wanted only if the pilot shows authors needing to align a new
  version's key with a historical one.

- **Org-visible library entries** (ruling 1) — additive: one boolean, one `OR` arm on the read
  policy. Revisit once the pilot shows whether committees actually want each other's blocks.
- **Case-context default tokens** (ruling 5) — revisit post-pilot with the participant lane's
  audit posture settled.
- **Retro-tightening `form_items_default_value_display_null`** (ruling 6) to match
  `supportsDefaultValue()`. Correct, but it narrows a shipped CHECK against existing rows; it wants
  its own migration and its own backfill audit (memory
  `backfill-guard-wrap-data-dependent-migration`).
- **Library entry versioning** (ruling 2) — today "edit" means "save a new entry". If commissions
  accumulate near-duplicate entries in the pilot, a `supersedes_id` chain is the additive answer.
- **`form_calculations`** (ruling 9) — post-pilot, per ADR 0086 ruling 6.
