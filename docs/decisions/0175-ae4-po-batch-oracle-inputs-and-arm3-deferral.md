# 0175 — The AE4 PO batch: what the differential oracle asserts, and what it deliberately does not

**Status:** Accepted · 2026-09-01 (AE4, PO batch — ruled in one sitting)
**Amends:** 0155 D7 — the AE4 scope. D7 makes `staff_admin`'s substitution provable by a
differential oracle. This adds the oracle's **third and fourth** hand-encoded inputs (the
`offboarded` expected values; the arm-3 exclusion) and names one class the oracle exercises
but does **not** oracle, which D7 did not anticipate.
**Relates:** 0163 / 0164 (offboarded-person lifecycle authority — the rule this ratifies) ·
0169 (the named-divergence pattern this deliberately does **not** use) · 0172 / 0174 (the AE4
catalog) · CLAUDE.md Rule 13 · `docs/reviews/authz-ae4-review.md` findings F3, F4, F8

## Context

AE4.5's oracle asserts `legacy == catalog` and `catalog == approved`. The second half is
meaningful only if the expected value is hand-encoded **independently of the resolver** —
otherwise the suite proves the resolver equals a second implementation of itself. Four items
reached the PO because each is a place where a human must say what the right answer *is*.

## Decision

**D1 — `offboarded` is NOT a deny class, and it is proven STRUCTURALLY, not by cells.**

⚠ **D1 WAS RESHAPED THE SAME DAY, BEFORE ANY IMPLEMENTATION — the first ruling was "emit the 91
cells, expected = the `active` cell", and it is superseded by the paragraph below.** Recorded in
place rather than in a successor ADR because nothing was ever built on the first shape; ⛔ but
recorded **loudly**, because a reader who sees only the outcome would conclude the cells were
considered and rejected on cost, when in fact they were measured **unconstructible**.

**What the re-measurement found.** The 91 cells would have been born vacuous. `403` contains
**zero** occurrences of `affiliation` and creates no affiliation row for any of its three
synthetic principals, and its driver (403:194-198) has no `offboarded` branch — it resets, then
handles `deactivated` / `suspended` / `pending` only. So four of the five personas are *already*
permanently offboarded and their `offboarded` cell would be byte-identical to their `active`
cell, while `subject_holder` (`chefe.ccih`, 1 live org affiliation) would run **active under an
offboarded label** — precisely the defect D2 deletes nine cells for.

**The decision.** `offboarded` is ruled not a deny class on a **structural** basis, and the
generator exclusion stays — re-reasoned from *"awaiting PO approval"* to *"proven structurally;
cells would be duplicates"*. The proof is a catalog assertion in pgTAP 401: no function on the
`staff_admin` path references an affiliation relation. Measured at **one hop**: all **6**
`authz.*` functions and all **5** legacy predicates the oracle calls (`has_role`, `is_active`,
`is_staff_admin_of`, `is_staff_admin_of_for`, `is_org_commission_staff_admin`) return false for
`prosrc ~* 'affiliation'` — while **47** other `app`/`public` functions do reference them, so the
predicate discriminates and is not vacuous.

⭐ **Both halves of the differential are affiliation-blind**, so offboarding cannot change either
answer or produce a disagreement — for *all* inputs, not 91 sampled ones. This is the same
reasoning as D2 and it is strictly stronger than the cells it replaces. Rule 13 and 0163's *"an
ended row decides WHERE, never WHETHER"* become a pinned **structural** invariant.

⚠ **The bound, stated because it is the part that will rot:** one hop was measured, not the
transitive closure. A helper called *by* those eleven functions could still read an affiliation.
Closing it means a gate-aware closure walk — `scripts/authz-c2-tier1-sizing.sql` already computes
those and is the instrument to reuse. Until then the assertion is one-hop and must be cited that
way. The axes file's `_retired__offboarded_has_no_approved_rule` key stays retired-not-deleted.

**D2 — the nine `deny-class:unauthenticated` cells are DELETED, not relabelled.** The harness
maps its `anonymous` persona to `f.nobody`, an **authenticated** principal, so the nine cells
passed on *"not a holder"* and proved nothing about anonymity (F8). Their replacement is a
pointer to **pgTAP 401 §18**: no application role holds USAGE on `authz`, so an anonymous
caller cannot invoke the resolver at all. ⭐ A structural proof strictly dominates the
behavioural one removed, so no coverage is lost — which is the only condition under which
deleting an assertion is the honest move rather than the convenient one.

**D3 — 403 calls the real door now; arm 3's org-scope divergence is ruled in AE5, not AE4.**
`app.can_read_professional_profile` is a three-arm disjunction: `is_admin()` ·
`can_create_professional` · a case-committee traversal. 403's driver substituted a simpler
function, so arms 1 and 3 were never exercised (F3). Arm 3 grants with **no org term at all** —
a professional participating in a readable case is readable regardless of their organization.
403 is fixed to call the real door immediately; the **expected values for the divergent cells
are deferred to the AE5 matrix**, which owns the cross-role picture that makes them rulable.

⛔ The PO considered and **rejected** the lead's recommendation to approve arm 3 as a named
divergence this phase (the 0169 `meeting_cases` pattern). Recorded because a gate record that
reads as unanimous hides that an alternative was on the table.

**D4 — the two open follow-ups.** (a) `FUP-CAN-MANAGE-PROFESSIONAL-SELF-CHECK-ARM`: `p_uid` is
**documented as a null guard**, not made to filter. AE4.7c already narrowed it to exactly that,
so the remedy is a rename or comment that stops a future caller assuming it scopes — not an
authorization change. (b) `FUP-SEED-PENDING-PERSONA-CANNOT-REACH-ITS-LAYER`: ⛔ `seed.sql` is
**not touched until production auth is measured**.

⭐ **D4(b) WAS THEN MEASURED, 2026-09-01, and it moved — read the qualifier, not the headline.**
Three lines agree that production auto-confirms, so `pending` denies at no layer there either and
the local oracle **does** describe the shipped system:

1. **Only ONE Supabase project exists** — `list_projects` returns `azkbbhskturikxpgmafq`
   ("Forms") and nothing else. ⛔ This retires a false premise carried in
   `follow-ups-archive.md:68`, which calls that ref the *"remote TEST project"* and leaves
   *"Still TODO for real production: re-apply on the prod project at deploy"* — **the separate
   production project it defers to does not exist.** The same ref is what `npm run db:link`
   targets, what AE3 pushed to, and what Coolify serves.
2. That same archive line records `enable_confirmations=false` **pushed to that ref** on
   2026-06-12 via `supabase config push`.
3. Behavioural probe on the remote (read-only aggregate; no rows read): **37 users, 0
   unconfirmed, 0 with `confirmation_sent_at` set** — all 37 confirmed with no confirmation ever
   sent, which is the auto-confirm signature.

⚠ **Why this is EVIDENCE and not proof — stated because the headline will outlive the bound:**
the MCP surface exposes **no auth-config read** (`get_project` returns metadata only), so the
setting itself was never read. Leg 2 is a repo record ~3 months old about an external system.
Leg 3 is confounded: users created by the admin API or a seed are auto-confirmed *regardless* of
the setting, and 37 remote users against 36 seeded profiles says these are fixture rows, not
self-signups. ⛔ Only the dashboard, or the Management API's `/config/auth`, reads it directly.
The disposition is therefore **DOWNGRADE, not close**.

## Consequences

⛔ **The load-bearing one, owed to the Gate AE4 record:** after D3, arms 1 and 3 are *exercised*
but their divergent cells are **not oracled**. Exercised ≠ oracled. The sentence *"the
differential is green"* may not be written at Gate AE4 without that qualifier beside it, in the
same way the C2 and `PRED_DOMAIN` qualifiers already ride with "all arms HOLD".

- D1 grows the oracle by **zero** cells and makes Rule 13 falsifiable structurally instead —
  ⚠ and it leaves a **second finding it did not resolve**: four of 403's five personas hold no
  affiliation at all, so their cells labelled `active` are themselves inaccurate. Harmless today
  (nothing on the path reads affiliations, which is D1's own proof), but it is a fixture that
  cannot express a distinction it names. Filed rather than fixed inside AE4.
- D2 shrinks it by nine and removes a passing-but-vacuous class from the coverage report.
- D3 leaves AE5 a named inheritance: the arm-3 cells arrive already enumerated and already
  known to diverge, so AE5 rules them rather than discovering them.
- D4(b) converts a seed defect into a **measurement** that may close it outright: if production
  also has confirmations off, the local oracle is describing the shipped system and nothing is
  owed. If it has them on, `pending` denies at the auth layer in production only, and the
  deny-class table's row 5 needs a production-scoped qualifier.
