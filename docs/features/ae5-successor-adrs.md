---
id: AE5-SUCCESSOR-ADRS
title: "The two pre-AE5 successor ADRs written — the role-catalog decision (F7 · F8 · platform_role, reserved as 0202) and the two conventions (the D fan-out · search_path, reserved as 0204) — renumbered to highest-on-any-live-branch + 1 by PO ruling, each decision ruled by the PO on 2026-09-11 and every cited fact re-verified before it is written"
status: gated
kind: feature
program: AUTHZ
phase: "pre-AE5 remediation — the last two successors of Batch 9 (plan §3 item 3 / §6); docs-only: ADRs + register clauses; ⛔ no migration, no src/, no pgTAP — the builds they order go to named follow-on units"
branch: authz-ae5-successor-adrs   # cut from main @ adbde005
plan: ../plans/pre-ae5-remediation.md
progress: ../progress/ae5-successor-adrs.md
reviews: ["../reviews/ae5-successor-adrs-review.md", "../reviews/ae5-successor-adrs-rereview.md"]
adrs: ["0207", "0208", "0176", "0201", "0203", "0155", "0183", "0197", "0205"]   # 0207/0208 = the ADRs this unit produced (QA r1 MINOR)
handoff: ~
fup: ~
---

# AE5-SUCCESSOR-ADRS — the role-catalog decision and the two conventions, written

The PO ruled every open decision of both successors in one session (2026-09-11; the rulings are
VERBATIM in the record § Session log, first entry) and ruled the numbering: **highest on any live
branch + 1, re-measured at reservation** — 0207 and 0208 at open — because plan §3 item 5 says
`0202` *"never will"* be filled and offers *"renumber the deferred pair and say so here"*. ⛔ This
unit writes decisions; it builds nothing. Every build a ruling orders is named as a follow-on unit
inside the ADR that orders it.

## Acceptance criteria

- [x] **Every fact the rulings cite is RE-VERIFIED before it is written** (LEARN: a location is a
      measurement, from any role including the PO): the resolver's role-shaped contract, the
      candidate CTE that yields ≤ 1 scope per fact and dedups before confirmation, `414`'s property
      (declares a path; every schema exists — NOT safety), the `TEMP` privilege of the four client
      roles on the database, `public.tenant_orphan_profiles`'s body qualifying its dependency
      (from `pg_proc`, never migration text), the four DEFINER functions using temporary tables,
      the capability names (`read_cases`, `view_signoffs`, `schedule_meetings`, `create_cases`,
      `assign_case_phases`, `bulk_create_cases`, `member_can`), `authz.scope_kind`'s
      `capability_plane` value, ADR 0183's rejection of copying the production CASE into a test,
      the P2 instrumentation, and the D census (33 principals; M max 3 / avg 1.30; D max 1·2·2;
      formula bound 37; scaled fixture M=20, D=5). ⚠ A ruling sentence whose cited fact does NOT
      reproduce is reported to the lead BEFORE drafting, never silently corrected.
- [x] **ADR 0207 — the role catalog** (`**Amends:** 0176` D8 — the bundle decided; `**Related:**`
      0201, 0203, 0205): F8 `administrativo` leaves `authz.roles` as a capability-provider
      NAMESPACE whose entitlement source is each individual capability, never one bundle; the
      provider-neutral entitlement seam sits ABOVE the role-shaped resolver, preserving
      `authz.has_permission`; the capability→permission mapping constraints (the PO's list —
      `read_cases`→`commission.cases.read`, `view_signoffs`→`commission.signoffs.read`, the three
      needing narrower codes, `bulk_create_cases` keeping both entitlements, no standing PHI-write
      authority, appointment alone grants nothing, hat-independent, never lifecycle/authority
      capabilities); `platform_role` retired (column → catalog-validated text + FK to
      `authz.roles(code)`, `assume_role` one non-overloaded text signature validating
      `session_selectable` and the real assignment, enum dropped last, `capability_plane` removed
      from `authz.scope_kind`); F7 one ordered manifest entry with `PlatformRole` inferred from it
      and the binding test a generated-artifact `--check` gate (ADR 0197's pattern); the six-step
      build ordered to a named backend unit **`AE5-ROLE-CATALOG-COMPAT`** before the first AE5
      increment; `member_can` untouched until Proposed-order item 6.
- [x] **The sequencing ruled in 0207**: `staff_admin` is the already-authoritative BASELINE, not
      increment 1; after the compat unit the remaining work is ten role cutovers + one
      capability-plane cutover; item 1 is `staff`. ⇒ `FUP-AE5-MATRIX-ARM3-CELLS-INCREMENT-ONE-NAMES-TWO-DIFFERENT-ROLES`
      closes on this ruling, and the three disagreeing sentences get dated correction markers
      beside them (ADR 0105: never rewritten).
- [x] **The 0202 blast-radius census landed in 0207** with its queries (the reach table: 11 enum
      labels · 1 column · 1 routine · 0 policies · 7 TS files; the 12 catalog rows) ⇒
      `FUP-AE5-MATRIX-ARM3-CELLS-ADR-0202-BLAST-RADIUS-CITES-ANOTHER-ADRS-CENSUS` closes, and plan
      `:398`'s *"3 sites and fully measured"* gets a dated correction beside it.
- [x] **ADR 0208 — the two conventions** (`**Related:**` 0155, 0183, 0191): (a) the `D` fan-out is
      a **parametric structural invariant plus accepted operational risk** — *structurally
      dominated, residual risk explicitly accepted*, ⛔ never *"large D is unreachable"*: D ≤ F over
      a provider-neutral fact set, Dₖ ≤ min(F, |scopesₖ|), for the role provider F = M ≤ C + R_H·H +
      R_O·O + S with the coefficients named as catalog facts; no numeric ceiling; the six-clause
      shape assertion and the five re-measurement triggers, the assertion ordered to a named unit
      built on the P2 instrumentation (never a copied CASE, ADR 0183). (b) `search_path = ''` with
      schema-qualified references is the **sole forward convention** for new or touched DEFINER
      functions; existing non-empty paths are **frozen compatibility debt**, may not grow, converge
      on touch; no mass re-emit; `414` stays the resolvability gate and is NOT the security property
      (`TEMP` on the four client roles, `pg_temp` ordering); a prospective rule against new
      non-empty DEFINER paths is ordered; any second compatibility form must be property-based
      (trusted resolvable schemas, `pg_temp` explicitly last), never the dominant string; the four
      temp-table DEFINERs get targeted tests before any catalog-wide `ALTER FUNCTION` sweep;
      `public.tenant_orphan_profiles` fixed by a NARROW forward migration preferring
      `ALTER FUNCTION … SET search_path = ''` — ordered to a named unit, ⛔ this unit claims no
      catalog change.
- [x] **The two conventions' follow-ups re-claused in BOTH homes, not closed**:
      `FUP-AE4-CANDIDATE-SCOPE-FANOUT-IS-UNBOUNDED` (its *"unreachable"* option is REJECTED by
      the ruling — the clause is rewritten to the shape assertion landing) and
      `FUP-NO-GATE-CATCHES-A-COLLAPSED-SEARCH-PATH` (its clause is `414`'s property, which exists —
      rewritten to the prospective rule + the narrow migration landing). Each carries a dated
      `**Ruling:**`.
- [x] **The reservations retired**: every sentence naming *"ADR 0202"* / *"ADR 0204"* as reserved
      (plan §3 items 3 and 5, §6; `authz-evolution.md`; the handoff; ADR 0176 D8's own text is
      left, it is history) gets a dated note *"written as 0207 / 0208"*; the handoff's RESUME block
      re-routed to `AE5-ROLE-CATALOG-COMPAT`.
- [x] `npm run adr:index`; **gate** bare: `npm run lint` 0/0 · `typecheck` · `git diff --stat
      main -- supabase src` **empty** · `e2e:prod`, `test:db`, the arms **not owed** (stated).
- [ ] QA review (read-only; verifies every ADR sentence against the ruling text in the record and
      against the tree) → human approval → Record step.

## Current state

**Updated:** 2026-09-11

### Objective

Write the two remaining pre-AE5 successor ADRs from the PO's rulings of 2026-09-11, with every
cited fact re-verified, the builds they order named to follow-on units, and the four follow-ups
they touch closed or re-claused in both homes.

### Done since start

Unit opened on `authz-ae5-successor-adrs` from `main` at `adbde005`; rulings captured verbatim in
the record; **facts verified — 10 of 14 reproduce, 4 differ** (record entry 2), the lead ruling
draft-now carrying the four corrections as FACTS at the PO's unchanged intent. **Both ADRs written**
— `0207` the role catalog (`**Amends:** 0176`; D1 F8 · D2 the mapping + the FIVE-capabilities/one-DOOR
correction · D3 `platform_role` retired · D4 F7 · D5 unit `AE5-ROLE-CATALOG-COMPAT` + the `ALTER
DOMAIN` correction · D6 `staff_admin` = baseline · D7 the blast-radius census with its queries) and
`0208` the two conventions (no Amends label, and why is stated; D1 the parametric invariant + the
`F`-vs-`M` grain · D2 six clauses → `AE4-D-SHAPE-ASSERTION`, live-body comparison · D3 five triggers ·
D4 `search_path = ''` sole forward convention · D5 `414` §0b/§1 + the owed ratchet gate · D6 the
narrow `ALTER FUNCTION` → `DEFINER-SEARCH-PATH-NARROW-FIX`). **Registers done in both homes each**:
two `AE5-MATRIX-ARM3-CELLS` follow-ups carry a dated PO ruling naming 0207 D6/D7 (⛔ not moved — the
lead closes them at the Record step); the two conventions' follow-ups **re-claused, not closed**.
**Five dated correction markers** placed beside the refuted *"increment 1 is `staff_admin`"* sites
(three named + `pre-ae5-remediation.md:640`/`:670`), `:398`'s *"3 sites"* corrected, and
`authz-evolution.md:1215`'s existing note **updated** rather than doubled. **Reservations retired**
across the plan (§3 banner, items 3 + 5, §6 bullet, steps 2–3), `authz-evolution.md` (3 sites) and
the handoff, whose RESUME block is **re-routed to `AE5-ROLE-CATALOG-COMPAT`**. Gates bare: `lint`
**0** (17/17, eslint 0/0) · `typecheck` **0** · `adr:index --check` **0** · `git diff --stat main --
supabase src` **empty**. `test:db` / `e2e:prod` / the four authz arms **not owed**, stated in the
record. ⭐ Two findings recorded there: a **false generated back-pointer** into ADR 0201 (the index
parse is over-inclusive; fixed by dropping the number from 0207's Amends label), and `414`'s cited
lines re-read at source.

### In progress

Nothing. Lead gate at the tip green (lint, typecheck, adr-index, empty pathspec, 0 CR bytes). QA
round 1 **CHANGES REQUESTED** (2 MAJOR — two figures in ADR 0208 D2 re-quoted from the record
without measurement: *nine* tracked functions (eleven) and *byte-identical* CTEs (identical modulo
three comment lines); 1 MINOR; 2 NOTE), every finding re-measured by the lead and fixed at
`b2119b0a`; QA round 2 **APPROVED**, no new findings. The length overrun (322 / 310) is ruled by the
lead: no trim — the excess is verbatim rulings, SQL and tables, and the comparable authz ADRs run
longer.

### Next

Human approval (Phase Gate step 4); then the Record step: ledger row, the two
`AE5-MATRIX-ARM3-CELLS` follow-ups closed in both homes, hub → `complete` with the block cut into
the record, ff-merge to `main`, no push. The handoff already routes the next unit to
`AE5-ROLE-CATALOG-COMPAT`.

### Blockers

None.
