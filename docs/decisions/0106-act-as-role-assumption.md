# ADR 0106 — "Act as": role assumption as a binding constraint

- **Status:** Accepted (design; 2026-08-09) — **not yet built**
- **Scope:** supersedes FUP-QOB-2 ruling ⑤ (dual-hat precedence), which was recorded FALSE
- **Relates to:** ADR [0100](./0100-quality-office-oversight.md) D1/D12 (quality office,
  duty separation) · ADR [0101](./0101-role-landing-guard.md) (the landing chain) ·
  ADR [0079](./0079-authz-door-blindness-standing-invariant.md) (fail-loud discipline) ·
  Architecture Rules 1 (RLS is the boundary) and 11 (auditability)

## Context

A user may hold several roles at once — `org_admin` of an organization, `quality_reviewer`
of one of its hospitals, `staff` of a committee. Today those grants simply **stack**, and
which one "wins" is decided by an ordered redirect chain in `src/app/page.tsx`.

**The recorded ruling on this was false.** FUP-QOB-2 ⑤ stated *"dual-hat keeps
reviewer-shell precedence"*. Measured 2026-08-09: `orgAdminOf` branches at **line 64**,
`qualityReviewerOf` at **line 152**, so the **tenancy admin wins** — the opposite. The
ruling was never implemented and never checked against the chain. The reviewer branch sits
last for an unrelated reason its own comment gives: it was added to fix the *dead-end* class
(a hospital-scoped role with no landing route → "Você ainda não tem acesso"), which ADR 0101
records **five** times. It was never an expression of precedence.

The measured consequence: a bare tenancy admin holding the reviewer seat lands on
`/o/<org>/manage`, sees **no link** to the quality console (that entry is gated
`showsMemberItems && isQualityReviewer` — the committee-member sidebar only), yet **can**
reach `/o/<org>/qualidade` by URL, because its guard admits anyone genuinely holding the
seat. An orphaned capability — the BUG-QOB-004 shape.

**The deeper problem is not the ordering.** A precedence chain *guesses* which role the user
wants right now. It cannot be right for everyone, and every new role is another guess. The
platform already rejects guessing one level down: `/o` picks the organization and `/c` picks
the commission, each skipping itself when there is only one option.

## Decision

Replace precedence with **explicit role assumption**. A user with more than one role chooses
which role they are **acting as**, and that choice **binds what the session may do** — it is
not a view preference.

The ten decisions below were taken in a design interview with the PO on 2026-08-09. Three
went against the author's recommendation and are marked ⚑.

### D1 — The driver is governance and audit, not convenience
The purpose is to **evidence separation of duties**: "this case was reviewed by someone
acting as the quality office, not by the administrator accountable for that committee."
Accident-prevention is a by-product, not the goal. This is what forces every decision below
toward a real constraint rather than a cosmetic one.

### D2 — The unit is the role TYPE, not the membership row
Silva picks *"quality reviewer"*, not *"quality reviewer — Hospital Central A"*. **Scope
stays with the switchers that already exist** (`?hospital=`, `/o`, `/c`), so the picker
answers only *as what*, never *where*. This matches a decision already shipped and tested:
the quality console deliberately offers "Todos os hospitais" because it holds no PHI.

⛔ **Entries are DERIVED from live grants, never from a hand-written list.** This is the
whole reason ADR 0101 exists: a remembered list is how a role ships with nowhere to land,
five times over. A newly-invented role must appear in the picker automatically.

### D3 ⚑ — Strict: the active role is the ONLY role
*(PO chose strict over the author's proposal of exclusivity-per-role.)*

While acting as `org_admin`, every other grant is suppressed. There is no exclusivity
property, no roles table, no judgement about which roles conflict — the rule is uniform, so
there is nothing to maintain and nothing to get wrong. It also makes the enforcement
predicate trivial (D11).

**Accepted cost:** a coordinator who is also an org admin must switch hats to do committee
work. The friction is the point — but it is also the main adoption risk (D9 exists to
mitigate it).

### D4 — Strict applies to reads AND writes
The suppressed role's rows are **absent**, not read-only.

Three reasons: (a) read separation *is* the separation for the quality office — a reviewer
who can still read as an admin sees everything regardless, and the oversight toggle becomes
decorative; (b) Rule 11 already treats reads as audit-worthy; (c) RLS decides row visibility
with one mechanism for `SELECT` and `UPDATE` — a writes-only variant would need a second,
weaker boundary beside the one already trusted, which is the "UI hiding is not security"
trap.

### D5 — Fail CLOSED
No active role means **no role at all** — the request sees what a stranger sees.

The rejected alternative fails *open*, and its failure mode is specific and nasty: every path
that forgets to set a hat **silently reverts to today's behaviour and looks completely
normal**, while the audit records a hat that constrained nothing. That is the exact class
ADR 0079 exists for — "a gate that isn't exercised is a live leak wearing a green check".

### D6 — "Act as" governs roles you HOLD, not relationships you are IN
Per-object relationships are **immune** to hat changes: `is_case_respondent`,
`is_recused_from_case`, `is_document_approver_of`, `is_document_version_approver`.

You do not "act as a respondent" — a case does not stop being about you because you switched
context. Two of these are **protective** (recusal keeps you *out* of something; if a hat
change could clear a recusal, that is a conflict-of-interest hole, not a feature), and
suppressing an approver assignment would break document approval for no governance gain.

*Noted, not decided:* whether a reviewer should be barred from reviewing a committee where
she is herself a respondent is a **different control**, not an act-as one.

### D7 — Fresh each session, with the active hat persistently visible
The hat is chosen at sign-in and does not persist across sessions. Single-role users never
see the picker — the hat is set implicitly, matching `/o` and `/c`.

In a strict system the cost of *not knowing which hat you are wearing* is high: every
unexplained absence is a hat problem. A daily deliberate choice is also stronger evidence
than a setting someone last touched in March. **The indicator is non-negotiable**; exact
placement is a design-system decision to be made against a real screen.

### D8 — Every audit row stamps the active role; switching is itself audited
Both fall out of D1, and both are **free**: `audit_log.metadata` is inside the hash chain, so
a stamp there is tamper-evident with **no migration and no change to the hash function**.
`audit_write` already computes `actor_is_admin` at write time — the same pattern, generalised.

The stamp **must** be read from the same source the permission check read, so the record and
the enforcement can never disagree.

### D9 — A blocked action explains itself, from the user's OWN grants
*"Your Committee Member hat has broader access here — switch?"*, with a one-click switch.

This appears to soften the guard that says an unknown org and a caller with no standing
*"both get `notFound()` — indistinguishable by design"*. It does not. That rule protects
information about **what exists** and **what others can reach**; the hint reveals only
**which hats the user holds**, which they just chose from. The message is constructed purely
from their own memberships and **never** consults whether the target exists.

Without this, the rational user response to arbitrary-looking absences is to pick the widest
hat every morning and never switch — which would produce *worse* evidence than today.

### D10 ⚑ — Big bang, not shadow mode
*(PO chose big bang over the author's proposal of shadow-then-enforce.)*

Justified by position rather than appetite: the platform is **pre-pilot with no live users**,
so "breakage" means tests failing, not customers blocked. And the suites **are** the shadow
mode — 5,636 pgTAP + ~1,050 E2E, all of which fail loudly under D5 for any unwired path, and
a gate that enumerates them exhaustively in about an hour.

**The bulk of the work is therefore the test harness**, not the feature:
`test_helpers.claims_for` and every E2E sign-in helper must set a hat, and until they do,
large parts of both suites go red at once. This is expected, bounded and visible.

### D11 — Principals outside the membership model
- **`platform_admin` is a hat.** It holds no memberships (`is_admin()` reads
  `profiles.is_admin`), so `has_role` filtering would not reach it; `is_admin()` gains the
  same active-role condition. Day to day nothing changes — the account holds one role, so the
  hat is set implicitly and the picker never appears.
  ⚠ **Break-glass risk, on the record:** this is the account reached for when things are
  broken, and BUG-BOOTSTRAP-001 already notes the first one can only be created by direct
  SQL. Its hat **must** be set implicitly and must never depend on the picker, so no UI sits
  in the recovery path.
- **`service_role` is EXEMPT, deliberately.** Webhooks, the audio-minutes callback, the PDF
  renderer and scheduled jobs act as *the system*; there is no person to wear a hat, and
  service_role already sits outside RLS rather than passing it. Recorded as a decision with
  its reason **precisely so a later "fix the inconsistency" does not take down every
  webhook.**

## The enforcement point (measured, not assumed)

| How the 47 `app.is_*` primitives resolve identity | Count | Consequence |
| --- | --- | --- |
| via `app.has_role` | 15 | the enforcement point |
| read `memberships` directly | 7 | **must be normalised onto `has_role` first** |
| delegate to another primitive | 27 | inherit the constraint for free |
| neither (validators / relationships / platform-admin) | 13 | 7 irrelevant · 4 immune (D6) · 2 handled by D11 |

So the constraint lands in **one function**:

```
app.has_role(scope_type, scope_id, role, user_id)
  → existing membership test  AND  role = <the active role>
```

The active role travels per request as a session setting — a pattern already used by **40**
functions (`current_setting`). Validation is against live memberships, so a user can never
assume a role they do not hold.

**Forgery is not the threat model.** The user is *allowed* to choose any hat they genuinely
hold; the constraint is that they get exactly **one at a time**, enforced at the boundary and
recorded in the trail.

## Consequences

- Ruling ⑤ is **moot**: nothing is guessed, so no precedence rule is needed. The orphaned
  console is closed as a side effect — it becomes an entry in the picker.
- The ADR-0101 dead-end class is closed **structurally**: an unrouted role becomes a visible
  picker entry instead of a silent step-over.
- FUP-AFF-4 (make the role list an enum) becomes more valuable, not less — the picker and the
  audit stamp both consume the role list, so a list no generated type can see is a liability.
- ⚠ **Adoption is the real risk, not correctness.** If switching is slow or the indicator is
  weak, users will pick the widest hat and never switch, and the audit trail will attest to a
  separation that is not being practised. D7 and D9 exist for this; they should be treated as
  load-bearing, not polish.

## Not decided here

- Where the hat indicator sits (design-system decision, against a real screen).
- Whether a reviewer may review a committee in which she is a respondent (a separate control
  — see D6).
- Sequencing against the pilot.
