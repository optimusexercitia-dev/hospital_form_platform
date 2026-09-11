---
id: ARM3-HAT-TERM-FIX
title: "The professional-profile read door evaluates the ACT hat before its arms — fixing the case-grant arm that made the hat rule unenforceable, and carrying the arm-3 comment correction in the same body"
status: in_progress
kind: feature
program: AUTHZ
phase: "Between AE5-MATRIX-ARM3-CELLS and AE5 increment 1 — the bug that unit filed and pinned (403 §7.4), fixed on the PO's ratified shape (bug body § PO ruling 2026-09-11)"
branch: claude/distracted-kapitsa-0d82de   # worktree branch, cut from main @ adbde005
plan: ../plans/authz-evolution.md
progress: ../progress/arm3-hat-term-fix.md
reviews: []
adrs: ["0175", "0176", "0200", "0201"]
handoff: ~
fup: ~
---

# ARM3-HAT-TERM-FIX — the hat rule made enforceable on the read door's case-grant arm

One migration, two duties, ⛔ never split (`.claude/rules/migrations-forward-only.md` forbids a
comment-only migration):

1. **Fix `BUG-AE5-MATRIX-ARM3-CELLS-CASE-GRANT-ARM-MAKES-THE-HAT-TERM-UNENFORCEABLE`.** Arm 3 of
   `app.can_read_professional_profile(uuid, uuid)` reaches through `app._case_caps` sources S3/S4,
   which carry no role lookup, so a holder self-checking under another hat (`active_context =
   other_role`) is granted where the hat rule says deny — 10 cells of the 216-cell
   `org.professionals.read` population at `case_reach = grant_keyed` (bug body § Scope).
2. **Discharge `FUP-AE5-MATRIX-ARM3-CELLS-READ-DOOR-COMMENT-CITES-THE-REPLACED-403-SECTION`** — the
   PO confirmed this migration as the carrier (2026-09-11): the re-emitted body corrects the arm-3
   comment's parenthetical *"exercised-but-not-oracled (ADR 0175 D3 / 403 §7.3)"* to the wording the
   follow-up's `Closes when` states.

## Acceptance criteria

- [ ] **The fix takes the PO's ratified shape.** Neither an **org** check nor a **role-keyed hat**
      check inside arm 3 (bug body § PO ruling on the fix shape, 2026-09-11): `403` **§7.5** reds on
      the first (class 4, cross-org reach, 32 cells) and **§4.1b** on the second (class 3, the
      role-free `unprivileged` reach, 36 cells — ⚠ those include `other_role` self-checks, which must
      still GRANT). The likely shape is the hat term evaluated **before** the arms, and the plan
      states the predicate as a sentence before it is written as SQL, naming what it does for a
      holder whose hat is **absent** at a self-check — a coordinate the vector does not carry.
- [ ] **§7.4 moves red→green deliberately, by the route its own message names:** the section is
      deleted and the `arm3:divergent-defective:hat-unenforceable` carve-out dropped from §4.1/§4.1b
      (⛔ never "granted on 10" edited to "granted on 0"); the generator's label for those 10 cells
      and `expected_legacy_granted` (already DENY) follow, and `403` §7.3's partition string is
      re-derived, not hand-edited. §7.5, §7.3b and §4.1b stay green **unchanged**.
- [ ] **Proven by mutation, both polarities:** on a scratch copy the fix reverted and §7.4 (or its
      successor cell assertion) observed RED again; the fix present and §7.5 + §4.1b observed GREEN;
      readings quoted bare in the record. Green on first run is a finding, not a pass.
- [ ] **The comment corrected in the same body**, read back from `pg_proc` after the migration
      applies (never from the migration text), matching the follow-up's `Closes when` wording.
- [ ] **Signature unchanged** (`(p_profile_id uuid, p_uid uuid)`, `prosecdef` true, same ACLs) —
      measured from the catalog; `npm run gen:types` shows no diff.
- [ ] **Gate** (CLAUDE.md §6 step 1, every rc bare): `npm run lint` 0/0 · `typecheck` · `npm run
      test:db` on a **fresh** `supabase db reset --local` · the four authz arms · `SELFTEST=1` on the
      deriver with its `bash --version` · the set-valued targeted home · the diff-scoped door sweep,
      both arms, over `scripts/door-sweep-cases.sh adbde005` with the `SCOPE:` line quoted and the
      exit read bare · `npm run e2e:prod` once to declare green. ⛔ Local only — never
      `db:reset:linked`.
- [ ] **Homes:** `docs/backend-state/authorization-and-audit.md` — slice appended AND the
      `## Current state` block replaced (its open edge for this bug rewritten as fixed); an ADR if the
      plan review rules one owed (number = highest on any live branch + 1, re-measured at creation;
      0206 is the highest at open); bug status cell flipped in place and the follow-up archived in
      both homes at the Record step, after QA review and human approval.

## Current state

**Updated:** 2026-09-11

### Objective
Fix the hat-unenforceable case-grant arm on the ratified shape and carry the arm-3 comment
correction in the same migration; pass the full Phase Gate; close bug and follow-up at Record.

### Done since start
Unit opened on a clean tree at `adbde005`; bug body, follow-up body, live `pg_proc` text,
`403` §4.1b/§7.3–7.5 and the vector's class coordinates read by the lead.

### In progress
`backend` drafting the full plan for lead review (lead-playbook §3: a new predicate shape inside a
SECURITY DEFINER read path).

### Next
Plan review → migration + pgTAP edits → gate → QA → PO approval → Record.

### Blockers
None.
