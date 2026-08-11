# ADR 0107 — ACT S4: hat-blindness gets its own allowlist artifact + a self-testing standing sweep

- **Status:** Accepted (2026-08-10) — ACT Stage 4 backend items (ADR 0106 D14; plan §Stage 4)
- **Relates to:** ADR 0106 (act-as) · ADR 0079 Amendment 6 (call-site-binding populations) ·
  authz-handoff §7.17

## Decisions

1. **Designed hat-blind doors live in a NEW artifact,
   `supabase/tests/mutation/act-hat-blind-allowlist.txt`, not in the 0079 BLIND allowlist.**
   The 0079 file's contract is *keystone coverage debt* (burn-down list); hat-blindness
   entries are *designed behaviour with a stated invalidation condition* ("wrong the day…").
   Overloading one file with the other dimension would let a designed exemption silence a
   coverage regression — the same merge Amendment 3 forbids for the unswept backlog.
2. **The sweep found a third and a fourth designed door beyond the plan's two.** Plan §Stage 4
   named `session_context` + the `service_role` paths. The executable sweep also fires on
   `public.assume_role` (the hat-acquisition door — consulting the current hat would make
   switching impossible) and the `memberships_select` **self arm** (own-grants visibility,
   the same D9 information boundary). Both are allowlisted with reasoning; both rulings are
   flagged for lead/QA veto. The `service_role` class (`custom_access_token_hook`) is a
   **header note, not a keyed entry**: the sweep can never emit that key (event-bound, not
   `auth.uid()`-bound), and an unmatchable key would be a permanent ghost.
3. **The sweep self-tests on every run** (planted blind / covered / class-4 specimens + a
   neutralized-anchor flip, all rolled back) and **fails on ghosts as well as new findings**.
   A detector that finds nothing must prove it can find something — Amendment 4's harness
   shipped a complete false negative once; this makes the proof structural, not a one-off.
4. **Delegation counts as hat evidence only because the anchors are checked.** `has_role` /
   `has_role_any` must themselves carry the caller-only condition or the sweep fails outright
   — otherwise every delegating door would still show "evidence" while the estate went blind.
5. **D14 classification tension — RESOLVED by PO ruling 2026-08-10** (was "recorded, not
   resolved"). The ruling classes per-case ACL rows (`case_access_grants`) as
   relationship-derived/D6-immune — hat-independent including the hatless state — although
   D13's "a grant you hold, not a relationship you are in" could read otherwise. **The PO
   ruled KEEP AS-BUILT** at the S4 gate: an ACL grant names a *person*, so no principled hat
   could own it, and the surviving reach is **read-only** (mask 30; both write bits absent).
   Keystone `319` A13 pins it; any re-ruling must consciously red it. Full ruling + the
   measured bit decode: ADR 0106 D5. Open consequence: `FUP-ACT-HATLESS-AUDIT`.

## Consequences

- `ARM=hat` joins `p0-authz-invariant.sh` (~10 s; in `ARM=all`). Proposed for CLAUDE.md §6
  step 1 alongside `ARM=census`/`ARM=floor` — that edit is the lead's (CLAUDE.md changes
  require asking first).
- Known blind spots are stated in the script header (chunk-level adjacency; `= any(array)`
  comparands; named-arg calls; the TS twin `getRawGrants()` is app-review territory;
  `member_can` is out of the memberships domain and keystoned separately).
