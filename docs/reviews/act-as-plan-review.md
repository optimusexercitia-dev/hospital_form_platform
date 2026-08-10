# Act-as role assumption — PRE-BUILD PLAN REVIEW (ADR 0106)

- **Reviewed:** `docs/plans/act-as-role-assumption.md` @ commit `1bdf016`
- **Against:** `docs/decisions/0106-act-as-role-assumption.md`, CLAUDE.md §§3/5/6,
  `docs/progress/authz-handoff.md` §7, ADR 0079, ADR 0061, ADR 0078 (D1–D14 context)
- **Method:** live-catalog verification only for schema/RLS/RPC claims (`docker exec
  supabase_db_azkbbhskturikxpgmafq psql`), read-only; no `db reset`/`start`; no writes
  except this report.
- **Verdict: CHANGES REQUESTED** (pre-build). This is a plan-fidelity and
  completeness review, not a build audit — nothing has been implemented yet. The
  verdict blocks Stage 0 kickoff until the two BLOCKER items are resolved in the
  plan text (or in the ADR, since one of them is a Stage-0 design gap the plan
  inherited).

---

## Summary

The plan is well-constructed and, on the parts I could check function-by-function,
faithful to the ADR: D1–D11's PO decisions and D12–D14's re-census findings each
have a concrete stage, the caller-only binding (plan §2) is a sharp, well-specified
catch not in the ADR, and Stage 3's gate section is the most carefully written part
of the document — it correctly names `ARM=census`/`ARM=floor`, the diff-scoped 0079
sweep, and a falsifiable revert-twin keystone. The **is\_\* primitive census itself
verifies exactly**: 47 total, split 12/2/7/14/12, and the 7 named "direct readers"
are precisely the 7 the catalog shows.

However, the ADR's own "corrected, measured-not-assumed" enforcement-point census —
the section that exists specifically to fix the *first* census's boundary error —
itself undercounts the live catalog by a wide margin (127 boolean gates in `app`,
not 80), and that undercount is not academic: it hid a genuine 8th direct
`memberships` reader (`app.can_manage_professional`) that Stage 2's plan, as
written, will not touch. Two more substrate anchors in ADR §3 (`session_context`'s
claimed relationship to `has_role_any`, and the "~30 functions already use this
`current_setting` pattern" precedent for D12) do not survive a catalog check either.
None of these are exotic — they are exactly the failure shapes
`docs/progress/authz-handoff.md` §7 catalogs at length, recurring inside the
document written to apply that lesson.

---

## Findings

### 1. BLOCKER — `app.can_manage_professional` is an 8th direct `memberships` reader, outside Stage 2's enumerated list, and Stage 2/3 as written will not fix it

**Requirement violated:** ADR 0106 D5 (fail closed — "every path that forgets to set
a hat silently reverts to today's behaviour and looks completely normal") and D13's
own worked example of exactly this failure shape found "in the design's own blind
spot." Also plan Stage 2 ("the 7 direct memberships readers... re-based onto
`has_role`/`has_role_any`. No semantic change.").

**Evidence (live catalog):**

```sql
CREATE OR REPLACE FUNCTION app.can_manage_professional(p_org uuid, p_uid uuid)
 RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER
AS $function$
  select p_uid is not null and (
    coalesce(app.is_admin(), false)
    or app.is_org_admin_of(p_org)
    or exists (
      select 1 from public.memberships m
      join public.commissions c on c.id = m.commission_id
      where c.organization_id = p_org
        and m.principal_id = p_uid
        and m.role = 'staff_admin'          -- ⬅ direct read, bypasses has_role
    )
  );
$function$
```

It reads `memberships.role = 'staff_admin'` directly — the same shape as the 7
readers Stage 2 targets — but it does **not** start with `is_`, so it fell outside
both the original name-prefix census *and* the "corrected" one (which re-derived the
`is_*` population correctly but never sweeps the other ~80 boolean gates for the
same defect). It is `SECURITY DEFINER` and gates 10 write RPCs, confirmed live:

```
create_ethics_sanction_type, archive_ethics_sanction_type, create_case_assignment_role,
create_professional_profile, update_professional_profile, set_professional_link_state,
archive_case_assignment_role, redact_professional_profile,
create_ethics_allegation_category, archive_ethics_allegation_category
```

**Consequence if built as planned:** two of the function's three arms
(`app.is_admin()`, `app.is_org_admin_of`) become correctly hat-gated for free once
D11/Stage 3 land (they delegate). The third arm does not — a `staff_admin` of a
commission in the org keeps managing professional profiles, ethics-vocab, and case
assignment roles **under any active hat**, silently, because nothing constrains the
raw `EXISTS` clause. This is D13's own "fails OPEN, looks completely normal" shape,
recurring on a second, un-enumerated door, on Class-2 professional-identity data
(ADR 0064/0065; CLAUDE.md §1).

**Fix required in the plan:** Stage 2's sweep must be re-scoped from "the 7 named
`is_*` readers" to *every* boolean gate in `app`/`public` (property: direct
`FROM/JOIN public.memberships` with no `has_role`/`has_role_any` call in between —
see Finding 3 for why the `is_*` prefix is not a safe boundary here either), and
`can_manage_professional` added to the named list with its own keystone.

---

### 2. BLOCKER — Stage 0's enum-derivation instruction omits `platform_admin`, which D11 requires to be representable

**Requirement violated:** ADR 0106 D11 ("`platform_admin` is a hat... its hat must
be set implicitly and must never depend on the picker") and D8 (audit stamp
`metadata.acting_as`, "minted from the same claim the permission check read").

**Evidence (live catalog):**

```sql
CHECK ((role = ANY (ARRAY['org_admin', 'nsp_org_admin', 'hospital_admin',
  'nsp_coordinator', 'staff_admin', 'staff', 'pqs_member', 'technical_director',
  'technical_director_deputy', 'quality_reviewer'])))
```

`memberships_role_check` — the source Stage 0 names for `app.platform_role` — has
**no `platform_admin` value**, because `platform_admin` is not a `memberships` row;
it is `profiles.is_admin` (confirmed: `app.is_admin()` reads `profiles.is_admin`,
not `memberships`). Stage 0 says: *"Introduce `app.platform_role` enum carrying the
full role list (source: `memberships_role_check`) — derive from the catalog."* Taken
literally, the enum would not accept `'platform_admin'` as a value.

**Consequence:** Stage 3's hook logic ("no row + exactly one live role type → derive
implicitly — this IS the D11 break-glass path... platform_admin single-role, no UI
involved") needs to mint an `active_role` claim value for a platform_admin session,
and `app.active_role_selections.role app.platform_role` / the audit stamp
`metadata.acting_as` need to be able to hold it too. As written, either the enum
type rejects it (a runtime error on the one account class that must never break —
BUG-BOOTSTRAP-001's account) or a backend engineer quietly adds `'platform_admin'`
to the enum by hand, undocumented, at build time — exactly the "a stage silently
decides something the ADR didn't" pattern CLAUDE.md's phase discipline exists to
prevent.

**Fix required in the plan:** Stage 0 should explicitly say the enum is
`memberships_role_check`'s values **plus `platform_admin`** (or equivalent), and
name the audit-stamp/hook implication so Stage 3 doesn't re-derive it silently.

---

### 3. MAJOR — ADR 0106's "measured, not assumed" enforcement-point census undercounts the live catalog by 47 functions

**Requirement violated:** the review brief's binding rule (live catalog is sole
truth) and the ADR's own stated method ("re-derive it from the catalog at build
time, never from this text").

**Evidence (live catalog):**

```sql
select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='app' and p.prorettype = 'bool'::regtype;
-- 127, not the ADR's stated 80
```

The `is_*` sub-count is exactly right (47, split 12/2/7/14/12 — independently
re-derived and verified name-for-name against the catalog). But the ADR's
arithmetic is `47 (is_*) + 33 (other) = 80`; the actual "other" bucket is **80**,
not 33 — the ADR's own total is the size the "other" bucket *should have been*,
suggesting the query that produced "80" silently excluded roughly half the
`can_*`/`eval_*`/`validate_*` population (or was run against a narrower filter than
`prorettype = boolean` as stated). This is precisely the "an enumeration's boundary
must be the property, not a name/syntax" lesson the ADR text itself invokes to
justify moving off the `is_*` prefix — and the corrected count still isn't closed.
Finding 1 is the direct, material consequence: a real door hid in the 47-function
gap between "33 claimed" and "80 actual."

**Fix required in the plan:** add a Stage-1 or Stage-2 task mirroring ADR 0079
Amendment 3's `ARM=census` discipline — every boolean gate in `app`/`public`
(not just `is_*`) gets a verdict (has-`has_role`/has-`has_role_any`/direct-reader/
delegate/identity-free), committed to a findings file, before Stage 3 is declared
scoped. Re-run the 80-vs-127 reconciliation and publish the corrected table.

---

### 4. MAJOR — ADR §3's substrate anchor for `session_context` is false; Stage 3's task description rests on a wrong premise

**Requirement violated:** the review brief's substrate-verification item
("`app.has_role_any` callers... `public.session_context`") and, generally,
`docs/progress/authz-handoff.md` §7.2 ("a comment is an assertion that goes stale
silently" — here a comment *and* an ADR anchor, neither checked against the body).

**Evidence (live catalog):** sweeping every `app`/`public` function body
(comment-stripped) for `\yhas_role_any\y` finds exactly two callers —
`app.is_member_of` and `app.is_member_of_for`. `public.session_context()` is not
among them; its body independently re-implements the membership filter inline:

```sql
from public.memberships m
cross join me
...
where m.principal_id = me.uid
  -- Verbatim from app.has_role_any — the single effective-grant filter.
  and (m.expires_at is null or m.expires_at > now())
```

The comment asserts parity with `has_role_any`; the function does not call it. ADR
0106 §"the enforcement point" lists `session_context` as a caller of
`has_role_any` alongside `is_member_of`/`is_member_of_for`; the plan's §1 "derived
ruling" then describes Stage 3 work as *"It is rewired OFF `has_role_any` onto an
explicit own-grants query"* — but there is nothing to rewire off, because
`session_context` was never on `has_role_any` to begin with.

**Consequence:** low direct risk (the design intent — own-grants, hat-blind — is
almost certainly still correct, since the function already reads unfiltered
`memberships`), but the plan's Stage 3 checklist item is written as an action
("rewire off X") that doesn't correspond to any code change, which risks an
engineer either skipping a step that doesn't exist as described, or "fixing" the
inline query to literally call the new `has_role_any` and then having to
special-case it back out — churn the plan should pre-empt by correcting the
premise now.

**Fix required in the plan:** correct ADR §3 and plan §1 to state that
`session_context` was **already** independent of `has_role_any` (not "rewired off"
it), and that its D9-exemption status is a **no-op confirmation**, not a migration
task. Verify the "Verbatim from `app.has_role_any`" comment is actually still
accurate (it should be re-diffed against the current `has_role_any` body, not
trusted) before Stage 3 closes.

---

### 5. MAJOR — an RLS policy on `profiles` grants co-member visibility across a suppressed hat, unreached by any stage

**Requirement violated:** ADR 0106 D4 ("the suppressed role's rows are absent, not
read-only... RLS decides row visibility with one mechanism"). Review brief item
C.4 ("any RLS policy whose predicate inlines a role check without calling an
`app.*` primitive").

**Evidence (live catalog):** `profiles_select_self_or_admin` (SELECT policy on
`public.profiles`) carries a co-member arm with no role predicate at all:

```sql
... OR (app.is_active(auth.uid()) AND EXISTS (
  SELECT 1 FROM memberships me JOIN memberships them
    ON them.commission_id = me.commission_id
  WHERE me.commission_id IS NOT NULL
    AND me.principal_id = auth.uid()
    AND them.principal_id = profiles.id
)) OR ...
```

This arm answers "are we both members of the same commission, in *any* role,"
without going through `has_role`, `has_role_any`, or `is_member_of` — it is not one
of Stage 2's 7 named readers (it's a policy predicate, not a function), and no
stage's checklist covers a raw `pg_policies` sweep for this shape.

**Consequence:** post-cutover, a user acting as (say) `org_admin` who also holds a
suppressed `staff` membership on commission Y keeps seeing the names/basic profile
fields of commission Y's other members via this arm — a membership-adjacent
visibility leak across the hat boundary. Low PHI blast radius (name/active-status
fields, not case content), but a direct, measurable instance of the D4 property the
ADR treats as load-bearing ("read separation *is* the separation for the quality
office").

**Fix required in the plan:** add this policy (and any sibling arm found by the
same sweep) to Stage 3's scope, or record it explicitly as an accepted, reasoned
exception the way `session_context`/`service_role` are — not silently absent from
every stage's checklist.

---

### 6. MINOR — D12's "~30 functions already use this pattern" precedent doesn't hold up; only one does

**Requirement violated:** substrate-verification duty (unfalsified quantitative
claim in the ADR).

**Evidence (live catalog):** of 33 `app`/`public` functions matching
`current_setting`, only **one** (`app.is_admin`) reads
`current_setting('request.jwt.claims', ...)`. The other 32 read unrelated
RPC-context escape-hatch GUCs for immutability-guard triggers
(`app.in_case_rpc`, `app.in_safety_rpc`, `app.allow_audit_teardown`, etc. —
`guard_case_status`, `guard_referral_reply_lock`, and 24 similar trigger guards).

**Consequence:** none to the design (the mechanism plainly works — `is_admin`
already does it), but the ADR overstates the maturity of the approach ("a pattern
~30 `app` functions already use" reads as "well-trodden"; it is one prior instance,
not thirty). Cosmetic, but it is exactly the kind of unverified count this review
was asked to catch, and it sits in the same paragraph as Finding 3's larger miss.

**Fix suggested:** correct the ADR's phrasing to "the same pattern `is_admin`
already uses" rather than implying a 30-function precedent.

---

### 7. MAJOR — Stages 0 and 1 omit the CLAUDE.md §6 step-1 authz arms from their own gates

**Requirement violated:** CLAUDE.md §6 step 1 ("Authz gates — `ARM=census` (~2 s)
**and** `ARM=floor` (~1 min)... must hold" — stated as a per-phase requirement, not
conditional on touching RLS) and ADR 0079 Amendment 1's own history lesson ("called
this a 'standing invariant' in prose... so it ran when someone remembered, which
was never").

**Evidence (plan text):** Stage 0's gate: *"lint/typecheck/pgTAP on fresh reset;
`gen:types` regenerated."* Stage 1's gate: *"full suites green (nothing enforced
yet); inventory committed."* Neither names `ARM=census`/`ARM=floor`. Stage 2 and
Stage 3 both name them correctly (Stage 2 additionally adds the diff-scoped sweep;
Stage 3 adds it over every touched gate plus the revert-twin).

**Consequence:** likely low practical impact (Stage 0/1 touch no RLS policies), but
this is the *exact* omission pattern Amendment 1 was written to close, in a program
whose own ADR quotes that lesson at length. CLAUDE.md §6 step 5 requires "the arm,
never the script" to be named in the record — a gate bullet that names neither is
the weaker precursor of that failure.

**Fix suggested:** add `ARM=census` + `ARM=floor` explicitly to Stage 0 and Stage
1's gate bullets, even though they are expected to pass trivially — the point (per
Amendment 1) is that naming it is what keeps it from being the phase nobody
remembers to run.

---

### 8. INFO — Stage 3's revert-twin keystone is well-specified; one additional guard is worth naming explicitly

The plan's revert-twin ("a pgTAP test that goes RED when the active-role condition
is removed from `has_role`") plus the separate third-party-immunity keystone
together satisfy ADR 0079 Amendment 2's "probe both directions" spirit better than
most keystones in this codebase's own history. One addition worth naming in the
plan text: per `authz-handoff.md` §7.1 shape 6 (the "permissive sibling" trap —
`FOR ALL PERMISSIVE` policies fake both positive and negative row-assertions), the
keystone should assert on a table/column reached **only** through `has_role` (not
one with an OR'd sibling grant), and that requirement should be spelled out rather
than left implicit in "full Phase Gate."

---

### 9. INFO — the page.tsx → picker migration isn't enumerated role-by-role

`src/app/page.tsx`'s 8-branch precedence chain (`isAdmin`, `orgAdminOf`,
`hospitalAdminOf`, `nspOrgAdminOf`, `memberships`, `nspOperatorOf`,
`technicalDirectionOf`, `qualityReviewerOf` — confirmed live, lines 60/64/68/78/94/
98/103/123/135/152 exactly matching the ADR's cited line numbers) each encode a
distinct landing route. The plan's Stage 3 frontend bullet says the picker "loses
its precedence guessing entirely" but doesn't enumerate the role→landing-route
table the replacement needs (all 10 `memberships_role_check` values plus
`platform_admin` → their existing routes). Recommend Stage 3 carry that table
explicitly (it can be lifted verbatim from `page.tsx`'s own doc comment) so the
mapping isn't re-derived ad hoc mid-build.

---

## Verified claims table

| # | Claim (source) | Method | Result |
|---|---|---|---|
| 1 | 47 `app.is_*` boolean primitives | `pg_proc`/`pg_namespace`, `proname like 'is\_%'` | **Confirmed**, exactly 47 |
| 2 | Disjoint split 12 (`has_role`) / 2 (`has_role_any`) / 7 (direct) / 14 (delegate) / 12 (neither) | classified all 47 by body content (comment-stripped) | **Confirmed exactly**, function-for-function |
| 3 | The 7 named direct readers (`is_entitled_document_approver`, `is_hospital_member_of`, `is_org_level_admin_within`, `is_org_member`, `is_pqs_member_of_any`, `is_pqs_operator_in_org_for`, `is_quality_reviewer_in_org`) | same classification | **Confirmed**, exact match |
| 4 | "80 functions" for `prorettype = boolean` in `app` | live count | **FALSE** — actual **127** |
| 5 | "33 boolean gates outside the `is_*` prefix" | 127 total − 47 `is_*` | **FALSE** — actual **80**; see Finding 3 |
| 6 | `app.can_manage_professional` — not mentioned by the ADR/plan at all | body inspection | **New direct `memberships` reader found**, 8th of its class, see Finding 1 |
| 7 | `public.custom_access_token_hook` exists, stamps `is_admin`, wired in `config.toml` | `pg_proc` + `config.toml` grep | **Confirmed** |
| 8 | `app.has_role` — 3-arg delegates to 4-arg | `pg_get_functiondef` on both overloads | **Confirmed** |
| 9 | `app.has_role_any` callers: `is_member_of`, `is_member_of_for`, `public.session_context` | word-boundary sweep of comment-stripped `prosrc` | **PARTIALLY FALSE** — `session_context` does not call it; see Finding 4 |
| 10 | `app.member_can` reads `commission_administrativo_capabilities` via `auth.uid()`, no `has_role`/hat consultation | `pg_get_functiondef` | **Confirmed**, fails open exactly as D13 states |
| 11 | `app._case_caps` mixes role primitives (`is_staff_admin_of_for`, `is_tenancy_admin_of_for`, `is_member_of_for`, `is_quality_reviewer_of_for`, `is_pqs_operator_of_for`) with relationship arms (`is_case_respondent`, `is_recused_from_case`, hard deny before positive arms) | `pg_get_functiondef` | **Confirmed** |
| 12 | `memberships_role_check` backs every role type shown in `page.tsx`'s precedence chain | `pg_get_constraintdef` | **Confirmed**, 10 values; **`platform_admin` absent** — see Finding 2 |
| 13 | "current_setting... a pattern ~30 `app` functions already use" (D12) | body sweep for `current_setting` | **Misleading** — 33 functions use `current_setting`, but only **1** (`is_admin`) for `request.jwt.claims`; see Finding 6 |
| 14 | `session_id` is available inside the custom-access-token-hook `event.claims` before the hook runs (needed for Stage 3's `active_role_selections` lookup) | Supabase docs search | **Confirmed** — required claim on every access token, present pre-hook |
| 15 | Storage-schema RLS policies (`storage.objects`) all delegate to `app.*` helpers, none inline raw `memberships` | full `pg_policies` dump for `schemaname='storage'` | **Confirmed clean** — no additional finding |
| 16 | `src/proxy.ts` makes no role/landing decisions (coarse auth gate only) | file read | **Confirmed** — consistent with ADR 0101's page.tsx-owns-landing model |
| 17 | `page.tsx`'s precedence chain: `orgAdminOf` at line 64, `qualityReviewerOf` at line 152 (ADR's "ruling ⑤ was false" measurement) | file read | **Confirmed exactly** |
| 18 | `test_helpers.claims_for` mints only `sub`/`role`/`is_admin` (no session id) — used as Stage 1's extension point | file read (schema doesn't exist outside a pgTAP run; **not** catalog-verifiable without running the suite, flagged as file-text evidence, not catalog) | Consistent with plan; caveat noted |
| 19 | `e2e/helpers/auth.ts` exports `loginFresh` | file read | **Confirmed** |
| 20 | Client-side JWT-claims consumption (`session.ts`/`middleware.ts`) is duck-typed off `getClaims().data.claims`, no closed schema that would reject a new `active_role` key | file read | **Confirmed clean** — no breakage risk from adding a claim |

---

## What would flip this to APPROVED

1. Re-scope Stage 2 (or add a Stage 1 task) to sweep **all ~127** boolean gates in
   `app`/`public` for direct `memberships` reads, not just the 47 `is_*` ones;
   name `app.can_manage_professional` explicitly and give it a keystone.
2. Resolve the `platform_admin` enum gap in Stage 0 explicitly (add it to
   `app.platform_role`, or state the alternate mechanism), and thread the
   consequence into Stage 3's hook/audit-stamp description.
3. Correct the three false/misleading substrate claims in ADR 0106 §3 and the
   plan §1 (`session_context`'s relationship to `has_role_any`, the 80/33 boolean-
   gate counts, the "~30 functions" precedent) — text, not code, but the plan
   should not ship instructions built on premises the catalog contradicts.
4. Add the `profiles_select_self_or_admin` co-member arm to Stage 3's scope or
   record it as a reasoned, named exception.
5. Add `ARM=census`/`ARM=floor` to Stage 0/1's gate bullets.

None of these require re-litigating a PO decision (P1–P6, D1–D14 all stand); they
are completeness and accuracy corrections to the plan and its ADR before Stage 0
starts.
