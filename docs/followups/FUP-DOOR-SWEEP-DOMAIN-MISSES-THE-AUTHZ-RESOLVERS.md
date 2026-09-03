# FUP-DOOR-SWEEP-DOMAIN-MISSES-THE-AUTHZ-RESOLVERS — two `prosecdef` boolean authorization resolvers are in NEITHER sweep arm's domain, so neither arm can ever select them

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-03 · status open

authorization path, and the hole is invisible from the gate's own green. Not 🔴 because both
functions are in fact covered behaviourally (measured below), so this is a coverage-*apparatus*
gap and not a known live leak. Above 🟡 because the same shape is what ADR 0079 exists for.

**What is wrong.** `p0-authz-door-audit.sh`'s `PRED_DOMAIN` selects a `prosecdef` boolean when its
name matches `^(is_|can_|has_|referral_target_analyst|attachment_confidentiality_ok)` **or** its
comment-stripped `prosrc` matches `auth\.uid\(\)|memberships|member_can|app\.is_|app\.can_|app\.has_|principal_id`.
**`authz.scope_reaches` and `authz.candidate_has_permission` match neither**, so a `CASES=` token
naming either selects nothing and the sweep exits 3 UNPROVEN. Meanwhile `authz.has_permission`
**is** in domain (`^has_`). The resolver family is therefore swept **on one axis only**, and the
green from that axis reads as if it covered the family.

**How it was MEASURED.** `scripts/door-sweep-cases.sh` over `20261003007310` returned **exit 1 =
FINDING** (migrations touched, zero cases derived) with `scope_reaches` on its EXCLUDED-BY-NAME
review list. The domain query run directly against the live catalog returns **35** `prosecdef`
booleans in `app`/`public`/`authz` outside `PRED_DOMAIN`; 33 are feature flags (`*_enabled`),
validators (`validate_*`) and structural predicates, and **two are authorization resolvers** —
`authz.scope_reaches`, `authz.candidate_has_permission`. ⭐ The harness does **not** hide them: its
§7.17b out-of-domain census prints them. Nothing reads that census as a worklist.

**Not a live leak, and here is the evidence for that.** A TARGETED mutation case was run by hand
for `scope_reaches` on 2026-09-02 (body → `select true`, attributes preserved, the open gate proven
live by a commission reaching a foreign organization): the full suite went **Result: FAIL at the
identical shape** — 260 files / 8709 tests, no `Dubious` — with **10 suites and 29 assertions**
noticing, including `171_cross_org_isolation`. Restore proven byte-identical. So `scope_reaches` is
**COVERED**; it simply has no verdict any *arm* can produce. ⛔ `authz.candidate_has_permission` has
had **no such case run** and holds no verdict of any kind.

**What would close it.** Either (a) widen `PRED_DOMAIN` so a `prosecdef` boolean in the `authz`
schema is in domain by virtue of its schema — and re-baseline the findings file, since `PRED_TOTAL`
moves; or (b) rule explicitly that the resolver family is swept by targeted cases instead, and give
those cases a committed home so they run on a schedule rather than when someone remembers. Either
way `candidate_has_permission` owes a first verdict.

⛔ **What must NOT be mistaken for closing it.** The `scope_reaches` COVERED result above — it is one
function, measured once, by hand, outside any arm. ⛔ Nor a green from `ARM=census`/`hat`/`floor`/
`wrapper`: **their domains are bounded by `p.prosecdef` on a name/identity regex too**, so they are
silent about exactly this population. *A green arm bounds its own domain* (ADR 0079); an arm that
cannot select a gate has not cleared it.
