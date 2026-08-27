# AE1 close condition #3 — the tiered DEFINER threat review (PA-F11)

**Measured 2026-08-27**, local stack, migration head `20261003005300`, 484 applied == 484 on
disk. **Deriving instrument:** [`scripts/authz-tier1-threat-review-ae1.sql`](../../scripts/authz-tier1-threat-review-ae1.sql)
— every figure below is one of its blocks; re-run it rather than quoting this file.

**Authority:** ADR [0155](../decisions/0155-post-aff4-tenancy-and-person-model-evolution-sequence.md)
D9 · the [plan](../plans/authz-evolution.md) AE1.2 step 1 as amended by `[PA-F11]` ·
ADR [0162](../decisions/0162-authz-evolution-plan-audit-corrections.md).
**Input:** the 752-function classification, [authz-definer-classification-ae1.md](./authz-definer-classification-ae1.md).

**PO rulings taken 2026-08-27, before this was written:**

1. **Scope** — instrument first, then review the residue **by class**, inside AE1. (The
   alternative considered and declined: writing ten columns × 500+ rows by hand, which adds
   prose, not signal, and is the shallow-pass failure the phase record warned about before
   this item was started.)
2. **The existence-before-authority set** — filed as a follow-up, fixed outside AE1.

---

## 1. ⛔ Tier 1 is 523, not 432 — the sized figure was the DEFINER subset

PA-F11 defines Tier 1 as *"remotely reachable functions (exposed schema per `config.toml` +
`authenticated`/`anon` effective EXECUTE)"*. Nothing in that definition says DEFINER. The
phase's **432** inherited AE1.2's DEFINER-only population and silently dropped 91 functions:

| population | count | in the "432"? |
| --- | ---: | :---: |
| `public` SECURITY DEFINER, `authenticated`-executable | 432 | ✅ |
| `public` SECURITY INVOKER, `authenticated`-executable | 90 | ⛔ **no** |
| `graphql_public.graphql` (INVOKER, `anon` + PUBLIC) | 1 | ⛔ **no** |
| **TIER 1 by the stated definition** | **523** | |
| Tier 2 — `app` DEFINER, `authenticated`-executable (`anon` holds no USAGE on `app`) | 320 | — |

⭐ **The 91 dropped are the exact class ADR [0079](../decisions/0079-authz-door-blindness-standing-invariant.md)
Amendment 7 was written for**: a `public` **INVOKER** wrapper whose own probe is the only gate
in front of an `app` DEFINER body — which was in *no* arm's domain at all until that amendment
added `ARM=wrapper`. A threat review of "remotely reachable" that covers only DEFINERs
reproduces the same blind spot in a different instrument. This review uses **523**.

⚠ `anon` holds EXECUTE on **zero** `public` functions (the one `anon`-executable Tier 1 row is
`graphql_public.graphql`). The known `anon` residue is 237 `app` functions and stays where it
is: `FUP-APP-SCHEMA-PUBLIC-EXECUTE-IS-CONFIG-BOUNDED`, a PO decision, out of scope here.

---

## 2. Method — decide what the catalog can decide, then partition the rest

PA-F11 asks ten threat columns per Tier 1 row. Eight of them are catalog facts; two need
judgment. So the instrument **decides** every column it can, and every row it cannot decide
lands in a **named REVIEW bucket carrying the property that put it there**. The residue is
then a measured number rather than an estimate, and the review that follows is bounded by a
property rather than by patience.

**325 of 523 are decided mechanically with no residual question. 198 carry at least one
bucket.** Buckets overlap by design (a function may be flagged twice).

### ⛔ The grain error this method exists to avoid

Computed **per body**, column C3 × C4 reads **27 doors that take an arbitrary principal uuid
with nothing binding it to the session** — `assign_org_admin(p_org, p_user)`,
`assign_hospital_admin`, `revoke_nsp_org_admin`, and so on: `SECURITY DEFINER`,
`authenticated`-executable, no `auth.uid()` anywhere in the body.

Read the bodies and every one is a two-line delegator:

```
public.assign_org_admin  ->  public.grant_role(...)  ->  app.grant_role_impl((select auth.uid()), ...)
```

Computed over the **call closure**, the same column reads **zero**. The 27 were an artifact of
the instrument's grain, and *"a wrapper whose gate lives one level down"* is precisely the shape
that produced ADR 0079 Amendment 7. Identity binding and authority are therefore computed
transitively throughout this review, never per body.

### The closure is measured by two instruments, not one

Bare-name matching over-joins across schemas, and **over-inclusion is the unsafe direction
here** — it claims a binding that may not exist. So the closure is built twice: qualified-only
edges (cannot over-join) and qualified+bare (can). Both were run:

| | qualified-only | qualified + bare |
| --- | ---: | ---: |
| edges | 2,258 | 2,262 |
| Tier 1 with no identity binding in closure | **58** | **58** |
| of those, also no authority token | **21** | **21** |

The two edge sets differ by 4 edges and **not one row changes bucket**. The over-join concern
is a measured non-issue, not a caveat.

---

## 3. The ten columns

| # | column | decided | residue |
| --- | --- | --- | ---: |
| C1 | owning role + `BYPASSRLS` effect | 522 owned by `postgres` (`rolbypassrls`), 1 by `supabase_admin` | 0 |
| C2 | PostgREST exposure | 501 callable · 22 return `trigger` and are not callable at all | 0 |
| C3 | caller-identity binding | 465 bound somewhere in the closure (241 in their own body) | **58** |
| C4 | arbitrary-principal parameters | 52 take one; **0** take one without binding identity | **0** |
| C5 | authority before existence | 338 authority-first · 110 N/A · 41 read-first, uniform deny · **3 INVOKER read-first** (RLS-filtered, so not-found already means not-authorized) | **31** |
| C6 | overload / default-argument reach | **0 overloaded names**; 180 with default arguments | 0 |
| C7 | dynamic SQL + `search_path` | 521 pin `search_path`; **0 use dynamic SQL** after disposition (§5) | **5 flagged → 0 findings** |
| C8 | output minimization / enumeration | 47 DEFINER set-returning surfaces, all reviewed (§4.4); the 41/6 gate-token split is **BLOCK 10** | **0** |
| C9 | audit emission | 270 mutating doors: 108 call audit, 100 audited by table trigger | **62** |
| C10 | exact grants | `proacl` never NULL; 1 PUBLIC/`anon`-executable row | **1** |

**C1 corrects a premise the classification rests on.** `authz-definer-classification-ae1.md`
§1 states *"a `SECURITY DEFINER` runs as a superuser, so its callees need no `authenticated`
EXECUTE"*. Measured: `postgres` is **`rolsuper = false`** on this stack (Supabase de-superusers
it) and `rolbypassrls = true`. The conclusion survives — via **ownership**, since `postgres`
owns all 522 and an owner holds EXECUTE — but the stated mechanism is wrong, and `BYPASSRLS`,
not superuser, is the half that matters for authorization. *A conclusion that survives its
premise being false has not been verified; the same file recorded that lesson about PA-F15
three days ago.*

---

## 4. The 198-row residue, reviewed by class (the PO's ruling)

### 4.1 C3 — 58 with no identity binding anywhere in the closure

⛔ **The first version of this table summed to 60 against a bucket of 58** (QA finding M1), in a
document whose own instrument contract says *"Every bucket is a PARTITION whose parts sum to the
population"*. Cause: `graphql_public.graphql` and `list_audit_filter_actors` were given their own
"individually reviewed" row while already sitting in the INVOKER class — **double-counted** — and
the trigger class was overstated by two. Re-derived as a true partition (BLOCK 3 + BLOCK 4):

| class | n | verdict |
| --- | ---: | --- |
| **trigger-returning bodies** (`guard_*`, `sync_profile_email*`, `form_item*_sync_version`, `handle_new_user`, `snap_referral_commission_names`, `reject_*`, `commission_derive_organization_id`, `assert_profile_tenant_has_org`) | **20** | ✅ **Correct by construction.** PostgREST cannot call a `trigger`-returning function, and EXECUTE is checked at `CREATE TRIGGER`, not at fire time. The body runs inside a DML statement whose own authorization already happened; binding identity here would authorize nothing. |
| **feature-flag readers** (`*_enabled` ×12 + `get_feature_flags`) | **13** | ✅ **Deliberately identity-free.** A flag is deployment configuration, not tenant data, and must read identically for every caller. Verified: no flag value is tenant-scoped. |
| **INVOKER — RLS is the boundary** (Architecture Rule 1): the process-template family, `reorder_item`, `reorder_section`, `reconcile_item_options`, `delete_section_moving_items`, `get_response_validation_errors`, `reference_candidates`, `publish_form_version`, `submit_response`, **and** `graphql_public.graphql` (§4.5) and `list_audit_filter_actors` | **24** | ✅ `prosecdef = false`, so the caller's own policies apply to every row the body touches; identity binding is supplied by the policy layer, which is where this platform puts it. |
| **DEFINER remainder — individually reviewed** | **1** | `public.validate_visible_when` — §5 |

**20 + 13 + 24 + 1 = 58** ✓

### 4.2 C5 — 31 DEFINER doors that confirm existence before checking authority → **FUP**

The positional pass flags 75 bodies that read a table before their first authority token. Two
further splits, both of which change the verdict:

- **41** deny *silently or uniformly* (`return;`, empty result). Nothing is disclosed — and for
  several the lookup is what determines *which* scope to authorize against, so it is
  structurally unavoidable. **Not findings.**
- **3** are INVOKER: the pre-authority read is RLS-filtered, so their "not found" **already
  means** "not visible to you" — the correct uniform answer. **Not findings.**
- **31** are DEFINER *and* raise a distinguishable not-found error before the authority check.
  Their read bypasses RLS, so the error tells a caller with no access that an object exists.

Representative, measured:

```
public.assign_member_title(p_member_id, p_title_id)
  select commission_id into v_commission from public.memberships where id = p_member_id;
  if v_commission is null then raise exception 'membro inexistente' ...   -- ← before authority
  if not (app.is_staff_admin_of(v_commission) or ...) then raise exception 'sem permissão' ...
```

**Severity: low, and stated as such.** UUIDs are not enumerable, so this is a *confirmation
oracle* — it validates an identifier the caller already holds — not an enumeration sweep. But
it is exactly the standard AE1.3's six new doors were built to (*"authority checked before
existence so a probe cannot enumerate"*), and five of the 31 are case-module doors
(`get_case_detail`, `grant_case_access`, `list_case_access`, `revoke_case_access`,
`set_case_visibility`).

**Disposition — PO-ruled 2026-08-27: filed as `FUP-DEFINER-EXISTENCE-BEFORE-AUTHORITY`, fixed
outside AE1.** Reordering 31 bodies is a migration plus a diff-scoped door sweep plus a
mutation-proof per door; that is its own increment, and AE1 is already the largest phase in
the program. The deriving predicate is BLOCK 6, so the set is re-derivable rather than
remembered.

### 4.3 C9 — 62 mutating DEFINER doors whose tables emit no audit row → **FUP**

Architecture Rule 11: *every mutation emits a row.* Counting only direct `audit_write` calls
reports 162 gaps; that number is wrong, because this platform audits mostly at the **table**
level through `trg_audit_*` triggers (54 tables carry one). With both paths measured:

| mutating Tier 1 DEFINER doors | 270 |
| --- | ---: |
| audit reachable through the call closure | 108 |
| audited by a trigger on the table they write | 100 |
| **no audit path by either mechanism** | **62** |

The 62 are a coherent class: **child entities and vocabulary tables** — `rca_factors`,
`rca_members`, `rca_root_causes`, `rca_timeline_entries`, `rca_evidence`, `rca_why_chains`,
`capa_action`, `capa_action_task`, `capa_action_evidence`, `capa_measure`,
`capa_measure_result`, `case_interview_interviewers`, `case_interview_subjects`,
`case_tag_assignments`, `case_assignment_roles`, `referral_shared_item`,
`referral_requested_actions`, `pqs_event_types`, `pqs_sentinel_criteria`,
`ethics_allegation_categories`, `ethics_sanction_types`, `hospital_departments`,
`case_correction_requests`, `interview_session_attendance`, `upload_sessions`/`file_objects`.

**The parents are audited and the children are not.** `app.trg_audit_rca` exists;
`rca_factors` carries only `guard_rca_child_lock`. A child insert never touches the parent
row, so no parent audit row is emitted for it either.

Evidence hierarchy, stated: the **catalog** is decisive (no audit trigger on the table, no
`audit_write` in the door's closure). `audit_log` on this stack corroborates —
`entity_type` holds `rca`, `capa_plan`, `interview` but no child type — and is only
corroboration, since a seeded database's absence could mean "the path was never exercised".

**Disposition: `FUP-CHILD-ENTITY-MUTATIONS-UNAUDITED`.** Out of scope for AE1 (an
audit-trigger migration over ~25 tables, each needing an entity-type and a diff shape), and it
is a **Rule 11** question for the PO — whether child-entity mutations are in scope for the
trail at all, or whether Rule 11 means the parent aggregate.

### 4.4 C8 — the 47 DEFINER set-returning surfaces: **zero findings**

A DEFINER that returns rows bypasses RLS, so this is the column where an enumeration leak
would live. 41 of 47 carry an authority-helper call in the body. The other 6 were **read in
full**, not inferred:

| function | how it is scoped |
| --- | --- |
| `capa_kpis` | `memberships` where `principal_id = auth.uid()` **and the ACT active hat matches** |
| `commission_overview` | `where c.organization_id in (select … where principal_id = auth.uid() and role='org_admin' and active hat matches)` |
| `pqs_inbox` | `where rc.hospital_id in (select … auth.uid() … active hat …)` |
| `list_my_assigned_capa_actions` | `where ca.assignee_user_id = auth.uid()` |
| `my_pending_meeting_signatures` | `where a.user_id = v_uid`, `v_uid := auth.uid()` |
| `get_own_person_record` | `v_uid := auth.uid()`, raises `42501` when null; hand-picked projection (its own comment forbids `to_jsonb(pr)` precisely because DEFINER bypasses the column grants on `cpf`/`date_of_birth`) |

All six are **scope-bound by an inline `auth.uid()` predicate** rather than by a gate-helper
call. That is a second legitimate pattern, and the reason the column needed reading rather
than a regex: *"no gate token"* and *"no authorization"* are different claims.

### 4.5 C7 and C10 — 3 rows, individually justified

- **`graphql_public.graphql`** — the only PUBLIC- and `anon`-executable Tier 1 function, and
  one of the two that do not pin `search_path`. Platform-managed (`pg_graphql`, owned by
  `supabase_admin`), **INVOKER**, so every row it returns passes the caller's own RLS. Not
  ours to modify; recorded so its absence from a future sweep is noticed. ✅ no action.
- **`public.guard_profile_no_delete`** — unpinned `search_path`, and it is a three-line
  INVOKER trigger whose entire body raises an exception. It **resolves no object at all**, so
  there is nothing for a hostile `search_path` to capture. ✅ no action. (It is also one of
  the two barriers that made PA-F15's cascade premise false — see the AE1 record.)
- **Dynamic SQL: zero.** §5.

---

## 5. Zero dynamic SQL — and the two instruments that nearly said otherwise

The detector flagged 3 candidates. All three are false positives, and both steps of finding
that out are worth keeping:

| function | match | what it actually is |
| --- | --- | --- |
| `bulk_create_cases` | `format(` | `format('%s casos criados em massa', v_count)` — an audit summary string |
| `validate_visible_when` | `format(` ×4 | pt-BR validation messages |
| `complete_dsr_task` | `execute ` | inside the error text *"… **execute** o descarte antes de concluir a tarefa"* — a Portuguese imperative verb |

⭐ **The comment-strip does not strip STRING LITERALS**, and this codebase's literals are
pt-BR prose. Every `prosrc` sweep in this repo inherits that: a natural-language body word can
fire a code-shape detector. A match here is a **candidate**; the discriminator is reading it in
context, which is why BLOCK 5 prints named rows and not a count.

⛔ **And the probe that read the context was broken in the direction of agreement.**
`regexp_matches` returns captures at index **1**; the context probe read `m[0]`, which is NULL
for every match, so it reported *"no matches"* on a body containing them. It agreed with the
expectation being tested — *these are probably false positives* — and would have closed all
three as dispositioned-by-nothing. The disagreement between a `true` boolean and an empty
match list is what caught it. **A probe that confirms what you already believe is the one to
re-run against a known positive.**

---

## 5a. The public command doors — justified by derivation, not by 384 paragraphs

**PO-ruled 2026-08-27** (QA finding M1). PA-F11 asks that public command doors be
**individually justified**; the first version of this review had **no notion of a command door
at all** — they were dissolved into the 523 with everything else — and declared the clause met.

⛔ **Three populations were in play and one sentence cited a fourth.**

| population | n | what it is |
| --- | ---: | --- |
| catalog upper bound (**BLOCK 9**): `public` + `prosecdef` + `authenticated`-executable + `rettype <> 'trigger'` | **413** | every function PostgREST can invoke that runs as its owner |
| the classification's **command door** class | **384** | the subset of those actually reached from `src/` at tier `rpc`/`code-literal` (372 + 12 multi-class) |
| `public` **INVOKER**, auth-exec, non-trigger | **87** | also client-callable, in **neither** figure above — the ADR 0079 A7 class again |
| the figure the old §7 sentence cited | 407 | ⛔ **C2's `public` + `app` count**, a different population from the one that sentence bounds |

⭐ **413 and 384 are not a discrepancy — they answer different questions.** The catalog can say
what is *invocable*; only the `src/` sweep can say what is *invoked*. Neither number is wrong, and
quoting one where the other belongs is what produced the 407.

**What the justification IS, and why it is derived.** Per door it has two halves, and both already
exist as measured facts:

- **why it needs EXECUTE** → the classification's per-row evidence (`authz-definer-classification-ae1.md`
  §12): the `src/` call site that reaches it, at tier `rpc` or `code-literal`. A door with no such
  row is not a command door — that is the class definition, not an exception to it.
- **what its risk is** → the threat columns of this review, emitted per door by **BLOCK 9**:
  identity binding over the closure · takes-a-principal · returns-rows · default args · pinned
  `search_path`.

The justification is the **join** of those two, which is why it is a query and not 384 paragraphs.
⚠ **This is a narrowing of PA-F11's literal wording and is recorded as one**: "individually
justified" here means *every door carries a derivable per-row justification*, not *a human wrote a
sentence about each*. The PO took that trade knowingly; the alternative — a 384-row hand list —
is the shallow-pass failure this phase named before starting, and it would go stale on the next
door added.

⛔ **What this does NOT do:** it does not sweep them. The command doors remain outside every ARM
arm's domain (`FUP-AUTHZ-COMMAND-DOOR-UNSWEPT`, C2), and BLOCK 9 characterizes them without
changing that. The C2 subset closes before Gate AE4 per the pilot cutline, not here.

## 6. Findings, collected

| # | finding | disposition |
| --- | --- | --- |
| **F-T1-1** | Tier 1 is **523**, not 432; the sized figure was its DEFINER subset, dropping 90 `public` INVOKER functions + `graphql_public.graphql` — the ADR 0079 A7 class | corrected here; the phase record and the plan's `[PA-F11]` sizing both cite 432 and are amended |
| **F-T1-2** | **31** DEFINER doors confirm existence before checking authority (low severity: confirmation oracle, not enumeration) | `FUP-DEFINER-EXISTENCE-BEFORE-AUTHORITY` — PO-ruled out of AE1 |
| **F-T1-3** | **62** mutating DEFINER doors write tables with **no audit path by either mechanism** — an Architecture Rule 11 gap concentrated in child entities and vocabulary tables | `FUP-CHILD-ENTITY-MUTATIONS-UNAUDITED` — needs a PO reading of Rule 11's grain |
| **F-T1-4** | the classification's premise *"a DEFINER runs as a superuser"* is **false** on this stack (`postgres` is `rolsuper = f`, `rolbypassrls = t`); the conclusion survives via ownership | corrected in [authz-definer-classification-ae1.md](./authz-definer-classification-ae1.md) §1 |
| — | C4 arbitrary-principal binding · C7 dynamic SQL · C8 enumeration · C6 overload reach | **zero findings**, each measured, not assumed |

## 7. What this review does NOT cover — stated, not implied

- **Tier 2 (320 `app` DEFINERs)** keeps the four-way classification plus exact grants only, per
  PA-F11. That is the *declared* bound: `anon` holds no USAGE on `app` and `app` is not a
  PostgREST-exposed schema, so no `app` function is client-invocable. If either fact changes,
  Tier 2 becomes Tier 1 and this review is incomplete by exactly 320 rows.
- **The reachable command doors of `FUP-AUTHZ-COMMAND-DOOR-UNSWEPT` (C2)** remain outside
  every ARM arm's domain. This review characterizes them; it does not sweep them.
- **`ARM=policy`, `ARM=floor`, `ARM=census`, `ARM=hat` and `ARM=wrapper` are unaffected** by
  this document. It adds no gate and no test — it is a review, and its findings are carried by
  the two follow-ups above, not by anything that would go red.
- Column C5's positional pass is a **heuristic over body text**, refined by two semantic splits.
  It can miss a body whose disclosure runs through a path the position of the first token does
  not represent. The 31 are a floor.

### 7a. The instrument's OWN domain — added 2026-08-27 (QA finding M1)

§7 above bounds the *subject*. It said nothing about the *instrument*, which is the half a reader
needs in order to know what a green column is worth. Each of these is a real limit, not a
disclaimer:

- **The call closure is depth-bounded at 8.** A binding reachable only at depth 9+ reads as absent.
  Nothing measures how close the real graph comes to that bound.
- **The closure spans `app`, `public`, `graphql_public` only.** A binding that arrives through a
  function in any other schema is invisible to it.
- ⛔ **The comment-strip does NOT strip string literals, and BLOCK 3 reads the same `prosrc`.**
  §5 applies that lesson to the dynamic-SQL detector and **not** to the edge builder — where the
  consequence is worse: a function name appearing inside a pt-BR string manufactures a **phantom
  edge**, which can *create* an identity binding that does not exist. That is the unsafe
  direction, and the two-instrument agreement test does not cover it: qualified-vs-bare measures
  over-joining across schemas, not literals. ⚠ So *"the over-join concern is a measured non-issue"*
  is true **only of the mode it tested**.
- **BLOCK 3's schema pattern has no left word boundary** (`(app|public)\.` matches inside
  `v_app.foo(`), and it joins on `proname` with arity ignored, where the sibling `sig` regex uses
  `\y`.
- **C4 relies on a parameter-NAME regex.** "52 take a principal uuid" is a **floor**: a principal
  parameter named something the regex does not anticipate is not counted, and C4's headline zero
  is conditioned on that floor.
- **C2's exposure test is `rettype <> 'trigger'` against a hand-typed schema literal** — the
  exposed-schema list is copied from `config.toml`, not read from it, so a change there does not
  reach this instrument.
- **C9 filters to DEFINER mutators**, which excludes the 90 `public` INVOKER functions F-T1-1 was
  added to catch — `publish_form_version` and `submit_response` among them. Architecture Rule 11
  asks its question of *every* mutation, so C9's 62 is a floor over a subset.
- ⚠ **"325 decided mechanically" means "tripped none of six residue predicates"** — an absence of
  flags, not a positive certification across ten columns. C1, C2, C4 and C6 contribute no residue
  bucket at all, so they are "decided" for all 523 rows by construction.
