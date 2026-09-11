# ADR 0208 — Two conventions: the candidate fan-out `D` is a parametric structural invariant plus accepted operational risk, and `search_path = ''` is the sole forward convention for SECURITY DEFINER functions

**Status:** Accepted (2026-09-11, PO rulings — unit AE5-SUCCESSOR-ADRS)
**Date:** 2026-09-11
**Area:** authorization / resolver invariants · DEFINER conventions
**Related:** ADR [0155](./0155-post-aff4-tenancy-and-person-model-evolution-sequence.md) (the AE sequence these two conventions sit under) · ADR [0183](./0183-p2-invocation-count-respecification.md) (D1's P2 bound and, at `:114-115`, the rejection of hand-copying the production `CASE` into a harness — D2 is built on the instrument 0183 D4 named) · ADR [0191](./0191-the-door-arms-domain-gains-a-schema-axis-a-targeted-home-and-a-fourth-outcome.md) (a green arm bounds its own domain — the reading D5 applies to `414`) · ADR [0079](./0079-authz-door-blindness-standing-invariant.md) (the standing door-audit invariant) · ADR [0182](./0182-statement-scoped-authorized-scope-ids.md) (the statement-scoped resolver `D` is measured on; see the ⚠ note in Context about its *"house pattern"* phrase) · ADR [0195](./0195-a-committed-number-needs-one-home-and-a-gated-mirror.md) (one home + a gated mirror — why each figure below names what watches it, or says nothing can)
⛔ Supersedes nothing, and amends no decision. Checked before omitting the label: ADR 0183's
Decisions (P2's bound, the instrument) are *extended* by D2, not changed; ADR 0191 decides the door
arm's domain and says nothing about DEFINER paths; ADR 0182's Decision section does not decide a
`search_path` convention — the one sentence in the corpus that reads like an endorsement sits in its
**Corrections** section (see Context) and is re-framed, not overturned.
⚠ **Numbering.** `docs/plans/pre-ae5-remediation.md` §3 item 5 reserved **0204** for this subject and
offers *"renumber the deferred pair and say so here"*; the PO took that branch on 2026-09-11. Highest
ADR on any live ref, re-measured at reservation: **0206** ⇒ this is **0208** (its sibling is
[0207](./0207-the-role-catalog-holds-roles-administrativo-is-a-capability-provider.md)). Every
sentence naming *"ADR 0204"* as reserved carries a dated note pointing here.

---

## Context

**Everything below is measured on the live catalog** (ADR 0078), container
`supabase_db_azkbbhskturikxpgmafq`, and witnessed in `docs/progress/ae5-successor-adrs.md` § Session
log, entry *2026-09-11 — verification of the rulings' cited facts (backend)*. Of the 14 facts the
PO's rulings cite, 10 reproduce exactly and 4 differ; the four corrections are carried **as facts**
at the PO's unchanged intent, each marked ⚠ beside the clause it changes.

**Two open follow-ups meet here.** `FUP-AE4-CANDIDATE-SCOPE-FANOUT-IS-UNBOUNDED` says the
statement-scoped resolver costs `(1 + D) × O(M)` per statement and that nothing states or watches
`D`; its own close condition offers *"a ruling that the org→hospital→commission tenancy model makes a
large `D` unreachable in practice"*. ⛔ **That option is REJECTED below** — it would overclaim.
`FUP-NO-GATE-CATCHES-A-COLLAPSED-SEARCH-PATH` asks for a gate proving every DEFINER's declared
schemas resolve; that half **exists** (`supabase/tests/414_definer_search_path_resolves.sql`), and
what remains is a *value convention*, which the follow-up itself calls *"a platform-wide decision
owing an ADR"*.

⚠ **The one sentence in the corpus that reads like a prior endorsement.** ADR 0182 `:200`, in its
*Corrections after QA review* section (not its Decision), calls `search_path=app, public, pg_catalog`
*"the house pattern"* while explaining what `413` pins. D4 re-frames that phrase — the dominant
string is **debt**, not a convention — and disturbs nothing `413` asserts: pinning two existing
functions to the value they are required to emit stays correct, because D4 freezes those paths rather
than changing them.

## Problem

Two questions were deferred out of pre-AE5 Batch 9 and each has a wrong answer that would look
right. For `D`: a fixture-derived numeric ceiling, or the sentence *"large `D` is unreachable"* —
both read as proof and neither is one. For `search_path`: admitting the dominant string as a second
coequal convention, which would make the gate accept all five present forms **and any future path
built from existing schemas**, i.e. a gate that cannot fail for the reason it was added.

## Decision

### D1 — `D` is a parametric structural invariant plus accepted operational risk

⛔ **Never *"large `D` is unreachable"*.** The PO's ruling, verbatim:

> I mostly agree, but I would change "structurally bounded" to "structurally dominated, with the
> residual risk explicitly accepted."
> […]
> But M ≤ |commissions| + 6|hospitals| + 2|orgs| + 1 is not a constant bound. A principal can still
> be assigned across an arbitrarily growing tenant tree. Therefore "large D is structurally
> unreachable" would overclaim. What has been proven is that D is not an independent fan-out
> dimension.

The invariant, verbatim, expressed over a **provider-neutral fact set `F`** rather than today's
role-only `M` — because after ADR 0207 D1 `administrativo` becomes a sibling entitlement provider and
candidates can no longer be defined solely from `authz.assignment_facts`:

> For a fixed principal, permission, and resolution kind, the candidate producer emits at most one
> scope from each applicable entitlement-provider fact and deduplicates candidates before
> confirmation. Therefore D ≤ F and Dₖ ≤ min(F, |scopesₖ|).
> For the current role provider, F = M and:
> M ≤ C + R_H·H + R_O·O + S
> where currently R_H = 6, R_O = 2, and S ≤ 1, yielding C + 6H + 2O + 1. These coefficients are
> catalog facts, not permanent constants.
> No numeric schema ceiling is imposed. The remaining growth with tenant and assignment count is an
> explicitly accepted operational risk under the recorded product and performance censuses.

**The coefficients, as catalog facts with the query that yields them:**

```sql
select allowed_scope_kind, count(*) from authz.roles group by 1 order by 1;
-- capability_plane 1 | commission 2 | hospital 6 | none 1 | organization 2
```

⇒ `R_H = 6` and `R_O = 2` are row counts of `authz.roles`, re-derivable at any time. `C`'s
coefficient is **1**, not 2, despite two commission-scoped roles, because
`memberships_one_commission_role_uq` is `UNIQUE (principal_id, commission_id) WHERE commission_id IS
NOT NULL` — one commission membership per commission per principal, whatever the role. `S ≤ 1` is the
`profiles.is_admin` `none` fact. On the product seed (3 orgs · 4 hospitals · 6 commissions) the
formula yields `6 + 24 + 6 + 1 = 37`; the measured maxima are `D_organization` **1**,
`D_hospital` **2**, `D_commission` **2**.

⚠ **Correction carried as a measured fact — the census figure `M` and the invariant's `F` are
counted at DIFFERENT GRAINS, and the ADR says which it means.** The recorded census
(min 1 · max 3 · avg **1.30** over 33 seated principals) counts **`memberships` rows** — 43/33 =
1.303. `F` is counted from the **producer**: `select count(*) from authz.assignment_facts(p)` gives
min **0** · max 3 · avg **1.27**, because `assignment_facts` gates on `app.is_active(p_principal)`
and one seeded principal is inactive. ⇒ **the invariant is stated over `F`, the producer count**;
the membership-row figures remain valid as a tenancy census and are not the same number.
⛔ The scaled-fixture `M = 20, D = 5` ceiling is **a different population** (the AE4 perf fixture,
12,036 principals over 13 orgs) and is quoted only with that label — see
`docs/followups/FUP-AE4-CANDIDATE-SCOPE-FANOUT-IS-UNBOUNDED.md` § *How it was MEASURED*.

### D2 — The six-clause shape assertion, ordered to a named unit and built on the P2 instrument

The PO's clauses, verbatim:

> I agree that a fixture-derived numeric ceiling would be the wrong control. But the shape assertion
> should pin more than "uses the same set":
> - Every candidate originates from an entitlement-provider fact.
> - One fact yields at most one candidate for a fixed resolution kind.
> - Deduplication occurs before permission confirmation.
> - The measured confirmation count satisfies U = D ≤ F.
> - Runtime and candidate resolvers use the same candidate producer and differ only in their
>   confirmer.
> - Adding a new provider adapter makes the assertion fail until that provider is included.

**The instrument is the existing one.** `scripts/authz-ae4-p2-invocation-count.sql` (ADR 0183 D4)
counts with `pg_stat_get_function_calls(<regprocedure>)` under a per-session `track_functions='all'`,
keyed by OID over **eleven** functions (⚠ this read *"nine"* until QA round 1, 2026-09-11 — the
figure had travelled unmeasured from the unit record; re-counted by the lead as the distinct
`::regprocedure` arguments at `scripts/authz-ae4-p2-invocation-count.sql:176-186`) including
`authz.assignment_facts(uuid)`,
`authz.has_permission(uuid,text,uuid,text)`, `authz.authorized_scope_ids(uuid,text,text)` and
`authz.candidate_has_permission(…)`. Confirmations are measured **as `authz.has_permission`
invocations** — exactly the `U` clause 4 needs — so clause 4 extends the instrument rather than
requiring a new one. ⚠ The counter returns **NULL, not 0**, before a function's first call, which is
why the script coalesces throughout; an assertion that reads it cold reads VOID, not zero.

⛔ **The assertion may NOT hand-copy the production `CASE` into the harness.** ADR 0183 `:114-115`
rejects exactly that:

> ⛔ **Hand-copy the resolver's candidate `CASE` into the harness to predict `U`.** Rejected: a
> harness holding a copy of production text is a duplicate no gate protects…

⚠ **Correction carried as a measured fact — clause 5 is true today by DUPLICATION, not by
construction, so it must be asserted against the live bodies.**
`pg_get_functiondef('authz.candidate_authorized_scope_ids(uuid,text,text)'::regprocedure)` carries a
candidate CTE **identical in every non-comment token** to `authz.authorized_scope_ids(uuid,text,text)`,
differing only in its confirmer (`authz.candidate_has_permission` vs `authz.has_permission`). ⚠ It
is **not byte-identical** — this said so until QA round 1 (2026-09-11): measured by the lead, a raw
`diff` of the two `pg_get_functiondef` outputs exits **1** on the signature line, **three `--`
comment lines** present only in the runtime resolver, and the confirmer line; the same diff with
`--` comments and blank lines stripped exits **0** on everything but the signature and the
confirmer. There is **no shared producer function**: there are two copies. ⇒ clause 5's assertion
**compares the two live bodies after normalisation** (extract each candidate CTE from
`pg_get_functiondef`, strip comments and whitespace, require equality — ⛔ a raw-text equality would
red on the comments alone and prove nothing about the logic), or the producer is factored out into
one function first and the assertion binds to that. ⛔ An assertion that merely
re-states the clause in its own words would be the hand-written copy LEARN-024 names.

**Ordered to a named backend unit, `AE4-D-SHAPE-ASSERTION`** — not built here. ⚠ `npm run lint`
cannot host a live-catalog count (no Docker), so this lands in `npm run test:db` and buys *"the next
Phase Gate noticed"*, never *"the next commit noticed"* (ADR 0195); the unit states that in its own
record.

### D3 — Five mandatory re-measurement triggers

The PO's list, verbatim:

> Finally, I would add mandatory remeasurement triggers:
> - administrativo is added as a permission provider;
> - another provider adapter is introduced;
> - scope_reaches gains one-to-many or descendant expansion;
> - membership uniqueness constraints are relaxed;
> - production data exceeds the tested M=20, D=5 performance envelope.

Any one of these invalidates the coefficients, the `D ≤ F` derivation, or the envelope the accepted
risk was accepted under. ⭐ Trigger 1 fires at ADR 0207's proposed-order item 6 **by construction** —
that is the change D1 pre-empts by expressing the invariant over `F`.

### D4 — `search_path = ''` with schema-qualified references is the SOLE forward convention

The PO's ruling, verbatim:

> SET search_path = '' with schema-qualified object references is the sole forward convention for
> new or touched SECURITY DEFINER functions. Existing nonempty paths are frozen compatibility debt,
> not an alternative convention; they may not grow and converge to the empty form on touch. No mass
> body re-emission is required.

⛔ *"Two coequal admitted forms"* is **rejected**, for the PO's stated reason: a gate written to
admit them *"accepts all five present forms—and any future path made from existing schemas"*. ⭐ And
converting the **middle 42** (39 + 2 + 1) to the dominant path would **broaden** resolution, not
improve it — they are often the narrower paths.

### D5 — `414` is the resolvability gate and is NOT the security property; a prospective rule is ORDERED

The PO's reasoning, verbatim:

> anon, authenticated, service_role, and authenticator currently have database TEMP. PostgreSQL
> warns that, unless pg_temp is explicitly placed last, temporary objects can precede the declared
> schemas and shadow unqualified relations inside a DEFINER. Denying CREATE on app/public/authz
> therefore does not close the complete threat. PostgreSQL's guidance recommends trusted schemas
> followed by pg_temp; Supabase recommends the stricter empty path with qualified references.

**The `TEMP` census** — `select rolname, has_database_privilege(rolname, current_database(), 'TEMP')
from pg_roles where rolname in ('anon','authenticated','service_role','authenticator')` → **4 of 4
true**. **The five-value table**, with its query:

```sql
select coalesce((select v from unnest(p.proconfig) v where v like 'search_path=%'),'<none>') sp, count(*)
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where p.prosecdef and n.nspname in ('app','public','authz') group by 1 order by 2 desc;
```

| `search_path` | count |
| --- | --- |
| `app, public, pg_catalog` | **825** |
| `public, pg_catalog` | **39** |
| `""` (the empty form) | **23** |
| `app, pg_catalog` | **2** |
| `public, app, pg_catalog` | **1** |

Total **890**; `<none>` absent ⇒ no undeclared DEFINER. (Adding `nspname` to the `GROUP BY` splits the
39 into `public` 33 + `app` 6 — a different grain of the same population, which is why the record's
opening entry reads `825/33/23/6/2/1`. Both sum to 890.)

⚠ **Correction carried as a measured fact — `414`'s two properties sit at `:119` and `:131`, and the
file makes NO safety claim to quote.** `414 § 0b:119` asserts *every* `prosecdef` function in
`app`/`public`/`authz` declares a `search_path` at all; `§ 1:131` asserts every schema named in every
such path resolves in `pg_namespace`. (`:109` is § 0a's message string — the domain statement, one
assertion earlier.) A search of the file for *"does not prove" / "not the security property" /
"safety"* returns **0 rows**: all seven assertions are resolvability and discrimination only. ⇒ this
ADR states **what `414` asserts**; it does not attribute a disclaimer to a file that carries none.

**A prospective rule against new non-empty DEFINER paths is ORDERED, and its home is named.** ⛔ A
`.claude/rules/` file is a **hint** to the writer, never the enforcer (CLAUDE.md §8). The **gate** is
a new pgTAP assertion — next free number **419** — holding the non-empty-path population as a
**frozen, ratcheting name set**: a `prosecdef` function in `app`/`public`/`authz` that is **not** in
the frozen set and carries a non-empty `search_path` reds the suite, and the set may only **shrink**
as functions converge. It is diff-scoped in effect: only a new or re-emitted function can enter the
population. It lives in `npm run test:db` because `npm run lint` may not require Docker, and it
therefore buys *"the next Phase Gate noticed"* (ADR 0195). `414` is **kept unchanged** as the
collapsed/nonexistent-schema property gate; the two are complementary, and neither is the other's
verdict.

**If a second compatibility form is ever admitted, it is property-based** — *"only trusted,
resolvable schemas with explicit `pg_temp` last"* — ⛔ never the current dominant string, whose
acceptance is what makes a gate unable to fail.

### D6 — `public.tenant_orphan_profiles` is fixed by a NARROW forward migration; the four temp-table DEFINERs are tested first

The PO's ruling, verbatim:

> For public.tenant_orphan_profiles(), its body already qualifies its only dependency (definition
> `supabase/migrations/20261003005800_ae24_inc4_linkable_picker_on_affiliations.sql:215`). Change it
> directly to the empty path in a narrow forward migration—prefer ALTER FUNCTION … SET search_path =
> '' over re-emitting the body. Fixing the live catalog cannot honestly be described as "no
> migration."

**Verified from `pg_proc`, not from the migration.** `public.tenant_orphan_profiles` is
`prosecdef = true` with `proconfig = search_path=public, app, pg_catalog` — the sole member of the
1-function bucket, and the only member of the population whose difference from the dominant 825 is
**semantic** (it inverts `public` before `app`). Its live `prosrc`, in full:

```sql
select t.profile_id, t.reason from app.tenant_orphan_profiles() t;
```

Its only relation/function reference is schema-qualified (`t.profile_id` / `t.reason` are column
refs on the aliased FROM item) ⇒ `ALTER FUNCTION … SET search_path = ''` needs **no** body change.
⚠ The ruling names only the `public` wrapper; `app.tenant_orphan_profiles` sits in the 825-bucket and
is a **separate subject** the narrow migration does not touch.

> The four DEFINER functions intentionally using temporary tables should receive targeted testing
> before any catalog-wide ALTER FUNCTION hardening sweep.

Named, measured as exactly four: `app.copy_response_answers(uuid,uuid)` ·
`app.copy_template_version_children(uuid,uuid)` · `app.copy_version_children(uuid,uuid)` ·
`public.clone_framework(uuid,uuid)`. Their targeted tests precede any sweep — they are the population
for which an empty path is not a free change.

**Ordered to a named backend unit, `DEFINER-SEARCH-PATH-NARROW-FIX`**: the one `ALTER FUNCTION`, the
419 ratchet, the `.claude/rules/` hint, and the four targeted tests. ⛔ **This ADR changes no
catalog.** It is docs-only, and a session that reads it as *"the path is fixed"* is reading a
decision as a deployment.

## Considered options

**`D`.** (a) *A stated numeric ceiling with a gate that reds above it* — the follow-up's first
option, **rejected**: the ceiling would be fixture-derived, and a fixture's maximum is a description,
not a bound. (b) *Rule that a large `D` is unreachable under the tenancy model* — the follow-up's
second option, **rejected by the PO in terms**: *"'large D is structurally unreachable' would
overclaim"*; `M` grows with an arbitrarily growing tenant tree. (c) **A parametric structural
invariant plus explicitly accepted operational risk** — taken, and it is neither of the two the
follow-up offered, which is why that close condition is **rewritten** rather than ticked.

**The `D` assertion's shape.** (a) *Assert "both resolvers use the same set"* — rejected as too
weak by the PO: it pins less than the six clauses. (b) *Copy the production `CASE` into the harness
to predict `U`* — rejected by ADR 0183 `:114-115` and again here. (c) **Six relational clauses on
the existing P2 instrument, comparing live bodies** — taken.

**`search_path`.** (a) *Mass re-emit every body onto the empty path* — rejected: no risk reduction
against a population with no CREATE exposure, and 890 re-emissions is a large blast radius for a
latent class. (b) *Admit two coequal forms and gate on the pair* — rejected: the gate would accept
all five present forms and any future path built from existing schemas. (c) **Forward-only
convergence, existing paths frozen as debt, no mass re-emit** — taken. (d) *Treat `414` as the
security property and close the follow-up* — rejected: `414` proves schemas resolve, which is not
the same claim, and the `TEMP`/`pg_temp` shadowing path is untouched by it.

## Consequences

- **Two named units are owed**: `AE4-D-SHAPE-ASSERTION` (D2) and `DEFINER-SEARCH-PATH-NARROW-FIX`
  (D5 + D6). Neither is started here; each writes its own hub and record.
- **Both follow-ups are RE-CLAUSED, not closed.** `FUP-AE4-CANDIDATE-SCOPE-FANOUT-IS-UNBOUNDED`
  closes when the six-clause assertion lands in its unit; `FUP-NO-GATE-CATCHES-A-COLLAPSED-SEARCH-PATH`
  closes when the prospective gate **and** the narrow `ALTER FUNCTION` migration land. Each carries a
  dated `**Ruling:**` line in both of its homes.
- **The accepted risk is recorded, not hidden.** Cost still grows with tenant and assignment count.
  What is proven is that `D` is not an *independent* dimension; what is accepted is the residual.
  D3's five triggers are the only thing standing between that acceptance and a silently changed
  premise, and ⛔ nothing reds when one fires — they are `prose only` until the D2 unit's clause 6
  exists, which is the one clause that fires automatically on a new provider.
- **What remains open:** whether the producer is factored out into one function (D2's alternative to
  a body comparison) is the unit's call, not this ADR's; the `.claude/rules/` file's exact scope
  path; and whether any second compatibility form is ever admitted at all — D5 states its shape
  without inviting one.
