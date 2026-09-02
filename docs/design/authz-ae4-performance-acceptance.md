# AE4 performance acceptance — fixture, harness and pass/fail protocol

**Obligation:** `FUP-AE4-PERFORMANCE-EVIDENCE-ON-THE-FINAL-PATH` (audit finding IA-F9);
Gate AE4 item per ADR [0176](../decisions/0176-authz-permission-layer-made-real.md) Consequences.
**Acceptance form:** [docs/plans/authz-evolution.md](../plans/authz-evolution.md) § AE4.4
*Performance evidence [PA-F6]* — nested plans over a scaled, `ANALYZE`d fixture, on the **final** path.
**Author:** `backend` · **Written:** 2026-09-02 · **Branch:** `authz-ae4-catalog`.

> ⛔ **STATUS after run 1 (2026-09-02): VOID.** The fixture loaded clean and five of nine harness
> sections completed, but the harness aborted in section 7 (`permission denied for function
> ae4_time`), so **DC1, DC2, P4, P5 and all of Pass B never ran**. A VOID run is re-run; it is
> never recorded as a pass. Diagnosis, rulings and fixes: **§9**. Outputs:
> `authz-ae4-perf-run-{load,passA,passB}.txt`.
>
> ⭐ **But run 1 was not empty.** Pass A captured P5's two arms in full, and they **exceed the
> threshold** — see §9.5. That result is *provisional* (its controls never ran), and it means the
> re-run is not a formality.

| Artifact | Path |
| --- | --- |
| Fixture loader | [`scripts/authz-ae4-perf-fixture.sql`](../../scripts/authz-ae4-perf-fixture.sql) |
| Fixture teardown | [`scripts/authz-ae4-perf-teardown.sql`](../../scripts/authz-ae4-perf-teardown.sql) |
| Measurement harness | [`scripts/authz-ae4-perf-harness.sql`](../../scripts/authz-ae4-perf-harness.sql) |

**Why `scripts/` and not `supabase/tests/perf/`.** `supabase test db` sweeps `supabase/tests` with
`pg_prove`, and a non-pgTAP `.sql` there is a live risk to Phase Gate step 1. Measured: **every**
subdirectory of `supabase/tests` today holds deliberately non-`.sql` artifacts
(`mutation/*.sh`, `vectors/*.json`) — `.sql` under that tree is reserved for the numbered suite.
`scripts/authz-explain-baselines-ae0.sql` is the established home for exactly this artifact class,
and these three files sit beside it. ⛔ None of them is applied by `supabase db reset`; they are
not part of the seed contract.

---

## 1. The final path, verified against the live catalog

Read from `pg_proc` (incl. `prosecdef`), `pg_policies` and the ACLs on 2026-09-02, container
`supabase_db_azkbbhskturikxpgmafq`. ⛔ Migration text was not consulted and may not be: some
migrations rewrite function bodies at runtime, so a file cannot be trusted to match the live body.

### 1.1 The chain, function by function

| # | Layer | Object | `prosecdef` | volatility | lang | EXECUTE ACL |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | policy | 6 RLS policies (§1.2) | — | — | — | `{authenticated}` |
| 1 | **3** | `app.can_edit_commission_forms(p_commission_id uuid, p_uid uuid)` | `t` | `s` | sql | postgres, **authenticated**, service_role |
| 1 | **3** | `app.can_read_professional_profile(p_profile_id uuid, p_uid uuid)` | `t` | `s` | plpgsql | postgres, **authenticated**, service_role |
| 1 | **3** | `app.can_create_professional(p_org uuid, p_uid uuid)` | `t` | `s` | sql | **postgres only** |
| 2 | **2** | `authz.has_permission(principal, scope_kind, scope_id, permission_code)` | `t` | `s` | sql | postgres only |
| 3 | **2** | `authz.entailed_grants(principal, resolution_kind, scope_id, permission_code)` | `t` | `s` | sql | postgres only |
| 4 | **1** | `authz.assignment_facts(principal)` → SRF `(role_code, scope_kind, scope_id)` | `t` | `s` | sql | postgres only |
| 4 | **1** | `authz.scope_reaches(assignment_kind, assignment_id, resolution_kind, requested_id)` | `t` | `s` | sql | postgres only |
| 5 | tables | `public.memberships`, `public.profiles` (`assignment_facts`); `public.commissions`, `public.hospitals` (`scope_reaches`); `authz.roles`, `authz.role_permissions`, `authz.permission_implication_closure` (`entailed_grants`); `authz.permissions` (`has_permission`'s scope-kind validation) | | | | |

Supporting predicates reached from layer 3: `app.is_tenancy_admin_of_for` → `app.has_role` →
`public.memberships` + `public.commissions`; `app.can_manage_professional` → `app.is_admin` +
`app.is_org_admin_of`; `app.is_active` → `public.profiles`; `app.active_role()` reads the
`request.jwt.claims` GUC; `app.commission_of_version` → `form_versions ⨝ forms`.

**Two structural facts that decide what is worth measuring.**

1. **`authz.assignment_facts` is a non-inlinable `SECURITY DEFINER` set-returning function
   evaluated once per protected row**, and `authz.entailed_grants` calls
   **`authz.scope_reaches` once per assignment fact**. So the work per protected row is
   `O(M)` where `M` is the principal's live membership count — and AE5 multiplies the
   *outer* dimension across eleven roles. This is the F9 mechanism, and it is the reason the
   acceptance scales the **protected-row** axis, not only the authz-input axis (§3).
2. ⛔ **`authz.holds_role` is not on this path at all.** `has_permission` reaches
   `assignment_facts` directly through `entailed_grants`. `holds_role` is the layer-1 sibling
   used by `app.is_staff_admin_of{,_for}`. The FUP says "never `holds_role` alone"; the catalog
   says it is not even a component of the thing being measured.

### 1.2 The policies on the chain

| Table | Policy | cmd | Predicate |
| --- | --- | --- | --- |
| `public.forms` | `forms_staff_admin_write` | ALL | `can_edit_commission_forms(commission_id, auth.uid())` |
| `public.form_versions` | `form_versions_staff_admin_write` | ALL | `can_edit_commission_forms((select f.commission_id from forms f where f.id = form_id), auth.uid())` |
| `public.form_sections` | `form_sections_staff_admin_write` | ALL | `can_edit_commission_forms(commission_of_version(form_version_id), auth.uid())` |
| `public.form_items` | `form_items_staff_admin_write` | ALL | `can_edit_commission_forms(commission_of_version(form_version_id), auth.uid())` |
| `public.professional_profiles` | `professional_profiles_select` | SELECT | `can_read_professional_profile(id, auth.uid())` |
| `public.professional_participants` | `professional_participants_select` | SELECT | `can_read_professional_profile(professional_profile_id, auth.uid())` |

`app.can_create_professional` carries **no policy**; its callers are the DEFINER doors
`public.create_professional_profile`, `public.ensure_professional_participant` and
`public.set_professional_link_state`. It is therefore out of scope for a *policy-level* plan and
is covered only by the direct-seam attribution path (M4). ⚠ Two functions whose `prosrc` matches
`can_create_professional` — `app.can_manage_professional` and `app.can_read_professional_profile` —
match **inside a comment**, not a call. Text is not truth even after the catalog read.

### 1.3 The population, measured — and the trap that decides which SELECT is measurable

| Measure | Live figure |
| --- | --- |
| RLS-enabled tables in `public` | **171** |
| Policies in `public` | **283** |
| Policies whose predicate transitively reaches `authz.assignment_facts` | **125** |
| Policies whose predicate reaches it **through `authz.has_permission`** (the final path) | **6** |

Method for the two closure figures: a recursive closure over `pg_proc.prosrc` with `--` comments
stripped and word-boundary matching, then matched against `pg_policies.qual`/`with_check`. ⛔ It is
an **upper bound**: a name appearing in a body is evidence of a call, not proof of one. The AE4
review's F9 said *"~63 policies"*; that figure is not contradicted here so much as measured by a
different and wider method — the 125 includes the `holds_role` → `is_staff_admin_of{,_for}`
population as well as the 6 on the permission path.

⚠ **A sibling permissive policy can short-circuit the measurement.** `forms`, `form_versions`,
`form_sections` and `form_items` each also carry a `*_select` policy on `is_member_of(...) OR
is_tenancy_admin_of(...)`, and permissive policies are OR-ed. A `staff_admin` **is** a member, so on
a **SELECT** the sibling can satisfy the qual and `can_edit_commission_forms` may never be
evaluated — Postgres orders OR-ed quals by estimated cost, not by policy. So:

- the **write** path (`UPDATE`) is where the four form policies are the *only* applicable policy
  and the permission arm cannot be bypassed — that is M2/M3/M3b;
- `public.professional_profiles` carries **exactly one** permissive SELECT policy, so its read path
  is clean by construction — that is M1/M1b, and it is the amplifier that makes the per-row SRF
  behaviour visible.

---

## 2. What the fixture may and may not change

The fixture scales **only** the tables the chain above reads, plus the tenancy rows they hang off.
`hospital_affiliations` / `organization_affiliations` are deliberately **not** scaled: no function
on the chain reads them (Architecture Rule 13 — an affiliation locates, a membership grants).

Three side effects had to be designed around; each is a catalog fact, not a guess.

1. ⛔ **`public.memberships` carries `trg_audit_memberships`, a FOR EACH ROW trigger appending to
   the hash-chained `public.audit_log`.** Loading ~49 000 memberships would append ~49 000 links to
   a tamper-evident chain that `verify_audit_chain` and the audit pgTAP suites assert over — and an
   append-only chain **cannot be un-appended by a teardown**. The fixture would be irreversible.
   The loader therefore disables the eight audit/seeding triggers **inside the load transaction**
   (`ALTER TABLE` is transactional: an abort rolls the disable back with everything else) and
   re-enables them before `COMMIT`, with a `do` block that raises if any is left off. The
   derivation and guard triggers stay **on**, so every fixture row is valid under exactly the rules
   production enforces.
   **Bound this creates:** fixture rows have no `audit_log` history, and fixture commissions have
   no default meeting types or member titles (`seed_*_on_commission_insert_trg` are in the disabled
   set). Nothing on the chain reads either. `audit_log`'s row count must be **identical** before
   and after both load and teardown; both scripts assert it.
2. **`guard_published_structure` blocks INSERT/UPDATE on the children of a published version**, so
   the fixture's form versions are all `draft`. A published fixture version could be neither loaded
   nor measured on the write path.
3. **`profiles.id` FKs `auth.users(id)` and `guard_profile_no_delete_trg` blocks profile deletion
   outright.** The loader therefore creates `auth.users` rows and lets the shipped
   `handle_new_user` trigger mint the profiles (so fixture principals are ordinary non-admin
   accounts by exactly the production mechanism); the teardown disables that one guard, deletes
   profiles, then `auth.users`. One bcrypt hash of a discarded random secret is computed **once**
   via `\gset` for all rows — inlining `crypt(…, gen_salt('bf'))` in the INSERT would make a
   VOLATILE call per row (12 000 bcrypt hashes). Addresses are under the reserved `.invalid` TLD
   and no fixture account has a knowable password.

> ⚠ **METHODOLOGY FINDING, recorded because it produced a confident false negative during this
> very task.** A first pass asked for triggers with
> `where tgrelid::regclass::text in ('public.memberships', …)` and got **zero rows** — because
> `regclass::text` renders search-path-relative (`memberships`, not `public.memberships`). On that
> reading the fixture would have bulk-loaded 49 000 rows straight into the hash-chained audit log,
> irreversibly. The correct form joins `pg_class` to `pg_namespace` explicitly. This is the ADR 0078
> class exactly: the instrument's own output format, not the file, was the lie.

---

## 3. The scale factor, and why each axis is that size

There is no single multiplier, because the chain has **three independent cost axes** and only one
of them is `memberships`. Each is sized by the production quantity it stands for, and each is
stated with the trap it defeats.

| Axis | Table | Seed | Fixture | Factor | What it stands for / which trap it defeats |
| --- | --- | --- | --- | --- | --- |
| A — platform breadth | `public.memberships` | 44 | **≈ 48 800** | ×1 100 | 10 customer networks × 12 hospitals × 8 commissions × ~50 members. `memberships` is a **single shared table under RLS**, so its cardinality is platform-wide, not per-tenant. Defeats the *statistics* trap: at 44 never-`ANALYZE`d rows a seq scan is the correct plan; at 48 800 analysed rows only `memberships_principal_idx` is. |
| A | `public.profiles` / `auth.users` | 39 | **12 000** | ×308 | The people those memberships belong to. `assignment_facts`' `platform_admin` arm reads `profiles` by PK on **every** call. |
| A | `public.commissions` / `hospitals` / `organizations` | 6 / 4 / 3 | **960 / 120 / 10** | ×160 / ×30 / ×3.3 | `scope_reaches` walks commission → hospital → organization **per assignment fact per protected row**. |
| B — principal fan-out `M` | the measured principal's `memberships` rows | 1 (measured) | **20** | ×20 | The inner-loop length of `entailed_grants` → `scope_reaches`. A clinical director on a dozen committees plus hospital-level roles is the realistic worst case for one person. ⚠ The seed's `chefe.ccih` has `M = 1` (measured), so seed-sized data cannot see this axis at all. |
| C — protected rows | `public.professional_profiles` | 1 | **10 000** | ×10 000 | The professional register of a network. This is the count of per-row `can_read_professional_profile` → `has_permission` → `assignment_facts` invocations on **one unfiltered list read**. This axis, not axis A, is the F9 mechanism. |
| C | `public.form_items` | 27 | **16 000** (200 in the measured version) | ×590 | 200 items is a large accreditation checklist; it is the per-row count of the write-path policy `USING` evaluation. |

Derived: 40 forms × 2 draft versions × 8 sections × 25 items in the measured commission.

### 3.1 The trap this fixture CANNOT defeat, stated rather than papered over

`shared_buffers` on this stack is **128 MB** (measured). The hot fixture is ~10 MB. **The entire
fixture will be resident in cache**, and no realistic cardinality for this domain would change that
— a hospital network genuinely has tens of thousands of memberships, not tens of millions. So the
FUP's trap 1 (*"a fixture that fits in memory will report that the seam is free, which is a fact
about the fixture"*) is **partly irreducible here**.

The consequence is binding on §6 and is why the pass conditions are written the way they are:
**this is a plan-shape and invocation-count acceptance, not a latency prediction.** A millisecond
threshold on a fully cached fixture cannot fail for the right reason. The harness reports
`Buffers: shared hit=… read=…` so the claim is evidenced rather than assumed, and the two ratio
conditions (P4, P5) are *relative* — both sides of each ratio pay the same cache advantage, so the
ratio survives the residency that an absolute number would not.

---

## 4. The measured principal, and the proof that its only grant path is the permission arm

**This is the whole point of the exercise.** Each layer-3 authorizer retains a residual legacy arm
(ADR [0178](../decisions/0178-ae49-d6-rekey-as-built.md) §2) and a disjunction short-circuits, so a
principal granted through some other arm never reaches the permission arm and a "the seam is cheap"
number taken on that principal has measured nothing.

**The principal** is fixture user #1 (`ae4perf-1@perf.invalid`), acting hat `staff_admin`, holding
exactly **20** memberships:

- **1** × `staff_admin` on the measured commission — the one row that can grant anything measured;
- 12 × `staff` at sibling commissions; 4 × `staff_admin` in a **different organization** (so
  `scope_reaches` must reject each of them, per protected row); 3 × hospital-scope
  `quality_reviewer` / `pqs_member` / `technical_director_deputy`;
- ⛔ **zero** `org_admin` and **zero** `hospital_admin` rows, and `profiles.is_admin = false`.

`org_admin` and `hospital_admin` are the **only** inputs to `app.is_tenancy_admin_of_for`, which is
the **only** other arm of `app.can_edit_commission_forms`. Their absence makes the property belong
to the **principal**, not to the session. (The acting hat would also suppress them — `app.has_role`'s
self-check requires the acting role to equal the granted role — but resting the property on the
claims payload would make it an accident. Belt and braces.)

### 4.1 The proof (harness §2) — one assertion per competing arm, not prose

Evaluated under the principal's own claims, so the `entailed_grants` hat conjunct takes its **self**
branch, i.e. the production semantics. Every one of these is a harness assertion that raises:

| | Check | Required |
| --- | --- | --- |
| a | `app.can_edit_commission_forms(C*, P)` | **TRUE** |
| b | `app.is_tenancy_admin_of_for(C*, P)` — the only other arm of (a) | **FALSE** |
| c | `authz.has_permission(P,'commission',C*,'commission.forms.edit')` | **TRUE** |
| d | `app.is_admin()` | FALSE |
| e | `app.can_manage_professional(ORG*, P)` — the org-authority arm of (f) | **FALSE** |
| f | `app.can_read_professional_profile(PP*, P)` | **TRUE** |
| g | `authz.has_permission(P,'organization',ORG*,'org.professionals.read')` | TRUE |
| h | principal holds `org_admin`/`hospital_admin` anywhere | FALSE |
| i | `profiles.is_admin` | FALSE |
| j | the case-participant traversal arm of (f) | **FALSE** |

(a) ∧ ¬(b) ⇒ the permission arm is what grants the form-edit path. (f) ∧ ¬(d) ∧ ¬(e) ∧ ¬(j) ⇒ the
permission arm is what grants the professional-read path — (j) closes the third arm explicitly
instead of arguing from control flow.

### 4.2 The ablation (harness §3) — proven, not asserted

Inside a rolled-back transaction, `authz.roles.state` for `staff_admin` is flipped
`authoritative` → `legacy`, which disables **layer 2's state gate and nothing else**: the
membership, the hat, the profile and every legacy arm are untouched. Both authorizers must go
**FALSE**. Anything still TRUE is granted by an arm this measurement does not see, and the run is
**VOID**. Then `ROLLBACK`, and both must return to **TRUE** — *a probe that moves the answer but
never brings it back has proven the harness destructive, not the property true.*

> ✅ **The ablation is proven able to bite, read-only, before any window is spent.** Measured
> 2026-09-02 on the seed: `authz.entailed_grants(chefe.ccih, 'commission', CCIH,
> 'commission.forms.edit')` returns **exactly one row** —
> `staff_admin / commission.forms.edit / state=authoritative / hat_ok=true` — while
> `app.is_tenancy_admin_of_for` is `false` and `app.can_edit_commission_forms` is `true`. One row,
> gated on `state`, is the entire grant. Flipping `state` therefore *must* flip the authorizer.
> ⚠ The seed persona is **not** the measured principal (its fan-out `M` is 1 and the fixture is
> tiny); this establishes only that the ablation's mechanism is live.

---

## 5. The measured paths

| Id | Statement | Principal | Why |
| --- | --- | --- | --- |
| **M1** | `select count(*) from public.professional_profiles` | permission-only | Sole permissive SELECT policy ⇒ the full chain runs once per row with nothing able to short-circuit it. The F9 mechanism, directly. |
| **M1b** | same, `where organization_id = ORG*` | permission-only | The realistic list read. The P5 numerator. |
| **M1b-LEGACY** | *identical statement, identical rows* | `org_admin` of ORG* | Reaches the same rows through `can_manage_professional` and never evaluates `has_permission`. The P5 denominator. |
| **M2** | `update public.forms set title = title where id = F*` | permission-only | `forms_staff_admin_write` is the **only** policy applicable to an UPDATE, so the permission arm cannot be short-circuited by a sibling. Rolled back. |
| **M3** | `update public.form_items … where form_version_id = V*` (200 rows) | permission-only | The per-row write gate. Rolled back. |
| **M3b** | same over every version of C* (16 000 rows) | permission-only | Write-gate plan shape at volume. Rolled back. |
| **M4** | ~10 000 direct `authz.has_permission` calls, **scope id varying per row** | permission-only | ⛔ **ATTRIBUTION ONLY, NOT THE ACCEPTANCE.** Reported so per-call cost can be attributed; presenting it as evidence about the final path is exactly the mistake the FUP forbids. ⚠ The varying scope id is load-bearing: `has_permission` is `STABLE`, so with four constant arguments the planner folds it to a **single** InitPlan evaluation — "10 000 calls" would be one call, and the measurement of nothing would read as a spectacularly fast seam. |

⛔ **M2 / M3 / M3b timings may not be used for a ratio.** `public.form_items` carries
`audit_form_items_trg`, a FOR EACH ROW trigger appending to the hash-chained `audit_log`; its
per-row cost dwarfs the policy predicate, so a "linear growth" reading there would be a fact about
the **audit trigger**. Those three paths contribute **plan shape only**. The linearity condition is
measured on the read path, where no trigger fires.

**Pass A** captures `EXPLAIN (ANALYZE, BUFFERS)`, three reps each (rep 1 cold, reps 2–3 warm; all
three reported — the difference is signal). **Pass B** (`-v NESTED=1`) re-runs bounded variants
under `auto_explain` with `log_nested_statements = on`, because a `SECURITY DEFINER` function is
never inlined and Pass A shows only an outer `Filter` / `Function Scan`. ⛔ Pass B's row counts are
deliberately bounded (200, not 10 000) — `auto_explain` emits one plan per nested statement per
row. The bounded runs are their **own named paths** (`M1-nested`, `M2-nested`, `SEAM-nested`) and
their numbers are not M1's or M2's. *Never substitute a different query for a named path: a missing
baseline is honest, a mislabelled one poisons every later comparison.*

---

## 6. Pass conditions — and, explicitly, what a FAIL looks like

An acceptance with no failing shape is not an acceptance. Three outcomes are possible, and they are
not two: **PASS**, **FAIL** (a real regression), and **VOID** (nothing was measured). ⛔ A VOID run
is re-run; it is never recorded as a pass. *Absence of a verdict is not absence of coverage.*

### 6.1 PASS requires all of P1–P6

| | Condition | Read from | FAILS when |
| --- | --- | --- | --- |
| **P1** | No `Seq Scan` on `public.memberships`, `public.profiles`, `public.commissions` or `public.hospitals` anywhere in the nested plans | Pass B | Any of the four is seq-scanned. Post-`ANALYZE` at 48 800 memberships the index is the only correct plan; a seq scan is the regression F9 predicts, and it is the one that turns linear into quadratic at production scale. |
| **P2** | `authz.assignment_facts` is invoked **once per protected row**, not once per protected row **per assignment fact** | Pass B `loops` on the `assignment_facts` node | `loops` exceeds the protected-row count. That means the SRF is re-invoked inside the fact loop — an `O(M²)` shape. |
| **P3** | `authz.scope_reaches` invocations ≤ `M` (= 20) per protected row | Pass B `loops` on the `scope_reaches` node | `loops` is `M ×` the role-permission row count or worse, i.e. the join order pushed `scope_reaches` below the implication-closure join. |
| **P4** | Growth in the protected-row count is **at worst linear**: `t(N=10 000) / t(N=1 000) ≤ 30` (linear = 10; 3× headroom) | harness §7, machine-asserted | Ratio > 30. Super-linear growth in protected rows is precisely the hazard AE5 multiplies across eleven roles. |
| **P5** | The permission arm costs **≤ 4×** the legacy arm on the identical statement over identical rows | harness §7, machine-asserted | Ratio > 4. Rationale for K = 4: layer 3→2→1 adds one DEFINER SRF, three indexed joins and `M` `scope_reaches` calls over a path that is one indexed `EXISTS`; 4× is generous for that and still catches an order of magnitude. ⚠ Valid **only** because §4 proved the principal reaches those rows through the permission arm alone. |
| **P6** | Every control holds (§6.2) | harness §§0–3, 7, 8 | Any control failing makes the run **VOID**, not FAIL. |

### 6.2 The controls, and what each one would catch

| Control | Question it answers | VOIDs the run when |
| --- | --- | --- |
| **Fixture gate** (§0) | Did the fixture fully load, and was it `ANALYZE`d? | A live count below the declared scale, a principal fan-out ≠ 20, or any chain table with `last_analyze IS NULL`. *A fixture that cannot reach the failing state cannot produce a pass.* |
| **Positive control** (§1) | Is the session context reaching the policies at all? | Fewer than 3 distinct readings across six arms — or the **hat control**: with `active_role` absent (1c) or wrong (1d) the authorizer must be FALSE. If a missing hat still grants, the self-check conjunct is not live and nothing measures the production shape. |
| **Principal proof** (§2) | Is any competing arm granting? | Any of (b), (d), (e), (h), (j) TRUE. |
| **Ablation** (§3) | Is the permission arm merely *true*, or *load-bearing*? | Either authorizer still TRUE with layer 2 disabled — **or** either still FALSE after the rollback. |
| **P5 precondition** (§7) | Do P5's two arms do the **same work**? | The two principals see different row counts through the org-filtered read, or either sees zero. A ratio over unequal work is two statements wearing one label, not a comparison. |
| **DC1 — planted cost** (§8) | **Could this measurement have shown a regression at all?** | A deliberately ~50×-more-expensive `authz.assignment_facts` (same rows, opaque extra work, installed and rolled back in one transaction) moves the measured statement by **< 10×**. Then the instrument is blind and no green number above is distinguishable from a dead one. Paired with a restore check: after rollback the statement must return within 2× of baseline, and `prosrc` must no longer contain the planted marker. |
| **DC2 — N-differential** (§7) | Did the **fixture**, as opposed to the instrument, actually scale the work? | 1000× the protected rows costs < 5× more. Then either the fixture did not scale or the per-row evaluation is not happening — and a flat green number is uninterpretable either way. |

**DC1 is the discrimination control the obligation asks for**, and DC2 is its cheap companion: DC1
proves the *instrument* can see an expensive seam, DC2 proves the *fixture* is presenting one to it.
Neither alone is sufficient — a broken query can satisfy "the number is small" and its own negative
control at the same time.

---

## 7. What the lead must run, in order, in the DB window

**Preconditions.** Exclusive ownership of the local stack (the loader takes `ACCESS EXCLUSIVE` on
`memberships`, `commissions` and the four form tables while triggers are toggled). A **fresh**
`supabase db reset --local` — a bisect or an E2E run leaves a schema that poisons every catalog
read. No parallel agent writing to the DB.

```bash
# 0. Fresh, quiet stack.
supabase db reset --local

# 1. Load the scaled fixture and ANALYZE (expect a few minutes).
docker exec -i supabase_db_azkbbhskturikxpgmafq \
  psql -U postgres -d postgres -X -f - \
  < scripts/authz-ae4-perf-fixture.sql \
  > docs/design/authz-ae4-perf-run-load.txt 2>&1
echo "load exit: $?"          # read the exit code DIRECTLY; a pipe erases it

# 2. PASS A — gates, controls, plans, and the machine-asserted P4/P5/DC1/DC2.
docker exec -i supabase_db_azkbbhskturikxpgmafq \
  psql -U postgres -d postgres -X -f - \
  < scripts/authz-ae4-perf-harness.sql \
  > docs/design/authz-ae4-perf-run-passA.txt 2>&1
echo "passA exit: $?"

# 3. PASS B — nested body plans. P1, P2 and P3 are read from THIS output only.
docker exec -i supabase_db_azkbbhskturikxpgmafq \
  psql -U postgres -d postgres -X -v NESTED=1 -f - \
  < scripts/authz-ae4-perf-harness.sql \
  > docs/design/authz-ae4-perf-run-passB.txt 2>&1
echo "passB exit: $?"

# 4. Evaluate P1-P3 from the Pass B output — TWO STAGES, presence before bounds.
#    ⛔ Do not run the bound greps unscoped or before the presence greps: run 1
#    showed an unscoped P1 grep reading M4's driver as the seam, and an empty
#    bound grep reads exactly like a pass. Commands: section 9.7.

# 5. Teardown — OR, preferred, a reset (see below).
supabase db reset --local
```

⛔ **Read every exit code directly, never through a pipe or a trailing `echo`** — a pipe erases the
exit code, and this project has already recorded gate runs reported as 0 that were 1.
⛔ **A `raise exception` from the harness aborts psql under `ON_ERROR_STOP` and is a non-zero exit.**
That is the harness *working*: read the message, which says whether the run is FAIL or VOID.

**Teardown.** `supabase db reset --local` is the preferred and stronger teardown: it also restores
the never-`ANALYZE`d condition (see §8). `scripts/authz-ae4-perf-teardown.sql` exists for the case
where the seed state must be preserved in place; it deletes **by identity** (re-deriving the same
deterministic `ae4perf.pid(kind, n)` ids over the same ordinal ranges — no positional delete, no
uuid-range predicate) and asserts both zero fixture residue and an unchanged `audit_log` count.

---

## 8. Residual bounds — what this acceptance does not settle

1. ⛔ **`ANALYZE` and the AE0.2 baselines cannot coexist on one database.** AE0.2's plans are
   defined on a **never-`ANALYZE`d** database and its doc says outright: do not `ANALYZE` before
   re-running. This acceptance *requires* `ANALYZE`. Running it therefore **permanently ends AE0.2
   comparability on that instance** until a `supabase db reset --local`. Both scripts say so; plan
   the window so no AE0 comparison is owed afterwards without a reset first.
2. **The fixture is fully cache-resident and no realistic cardinality changes that** (§3.1). This
   acceptance is plan-shape and invocation-count evidence, not a production latency prediction.
   AE7's entry condition 2 (`EXPLAIN (ANALYZE, BUFFERS)` on **real** data) is a different and later
   obligation that this does not discharge.
3. **`app.can_create_professional` is measured only as a direct seam call (M4), never at policy
   level**, because it has no policy — its callers are three DEFINER doors. A door-level
   measurement is a separate, smaller piece of work and is not part of this acceptance.
4. **40 of 43 permissions remain `pending-rekey`.** This measures the three re-keyed
   representatives. It is evidence about the *shape* AE5 will multiply, not about 43 sites.
5. **Thresholds K = 4 (P5), 30 (P4), 10× (DC1), 5× (DC2) are engineering judgements**, argued in
   §6 but not derived from a prior measurement — there is none. The first run should be read as
   establishing whether these thresholds are well-placed as much as whether the seam is cheap; a
   value that lands within a few percent of a threshold is a reason to re-derive the threshold, not
   to declare a narrow pass.
6. ~~**Nothing here has been executed.**~~ **Superseded by run 1 (§9), which found exactly the
   debugging this item predicted.** As of 2026-09-02: the loader has run clean; sections 0–3 and
   Pass A have run; the teardown, Pass B, DC1, DC2, P4 and P5 have **still never executed**.

---

## 9. Run 1 (2026-09-02) — VOID: diagnosis, rulings, and what changed

Fresh `db reset`, fixture loaded first time with no errors (12 000 users, 10 000
`professional_profiles`, 16 000 form items, 966 commissions). The fixture gate, the positive control
(*"3 distinct readings; hat is load-bearing"*), the principal proof, the ablation and the P5
precondition (*"both arms see the same 10 000 rows"*) all passed. Then:

```
psql:<stdin>:593: ERROR:  permission denied for function ae4_time
```

`PASSA_EXIT=3`, `PASSB_EXIT=3`, same line. Outputs: `authz-ae4-perf-run-{load,passA,passB}.txt`.

### 9.1 Ruling on the crash — fix the class, not the symptom

The caller did `set local role authenticated` and *then* called a `pg_temp` function; `authenticated`
holds no EXECUTE on it. ⛔ **The fix is not a grant.** `ae4_time` now **owns the role switch** and is
called as `postgres`, which removes **three** privilege dependencies at once — EXECUTE on the
function, INSERT/UPDATE on `ae4_timing`, and USAGE on the session temp schema — instead of patching
whichever one happened to fire first. Only `execute p_stmt` runs as `authenticated`, so the plan is
still chosen under the impersonated role and RLS still applies to the measured statement.

⛔ **And explicitly not `SECURITY DEFINER`**, the obvious-looking alternative: that would run the
measured statement as `postgres`, RLS bypassed, measuring a query that does not exist in production
and reporting a spectacularly fast seam — **silently**. So `ae4_timing` gained a `measured_as`
column recording `current_user` *at the moment of measurement*, and a new **impersonation gate**
raises unless every timing says `authenticated`. A privilege regression must be loud, not fast.
The same fix covers both DC1 call sites, which carried the identical defect.

### 9.2 Ruling on P2/P3 — NOT unmeasurable. Their instrument never ran.

The reported mechanism — *"plain `EXPLAIN` does not descend into `SECURITY DEFINER` bodies"* — is
**true of Pass A and is the wrong attribution for this absence**. Measured: the string `PASS B`
appears **zero times** in `authz-ae4-perf-run-passB.txt`; the file ends at line 593 on the
`ae4_time` error. **Pass B never executed.** It sat *after* sections 7–8 in file order and
`ON_ERROR_STOP` killed psql before reaching it. The 88 `loops=` lines are Pass A's, which of course
carry no nested nodes.

*An absence's mechanism is measured, not read off its gate.* The two candidate mechanisms demanded
opposite fixes — re-specify P2/P3 over a new capture mechanism, or run the one that already exists.
It is the second.

**P2 and P3 stand as specified**, over `auto_explain` with `log_nested_statements = on` — the
mechanism PA-F6 calls for and the one AE0.2's Pass B already established on this stack. Two
structural changes:

1. **Pass B now runs BEFORE sections 7–8**, so a later abort can no longer cost the structural
   evidence. New order: gates and controls (§§0–3) → Pass A → **Pass B** → DC2/P4/P5 → DC1 →
   postflight. Gates stay first because they void a run cheaply.
2. ⛔ **An absent subject is VOID, never PASS.** *An empty grep against "loops ≤ N" reads exactly
   like a pass* — a real defect in how P1–P3 were specified. Every structural check is now
   **two-stage: presence first, bound second**, and the evidence region is delimited by
   `AE4-PASSB-BEGIN` / `AE4-PASSB-END` markers so the greps can be scoped with `awk` (the same file
   also contains Pass A). A zero subject count is a finding about the **capture mechanism**, and no
   bound may be evaluated against it.

### 9.3 Ruling on P1's `commissions` hit — neither a defect nor a bound to re-derive

It is a **scope defect in P1**. Verified at `passA.txt:717`: the node is
`Seq Scan on commissions c … rows=966 loops=1` feeding a `Materialize`, inside **M4's own FROM
clause** (`from public.commissions c, generate_series(1, 11) g`) — the attribution driver that
deliberately enumerates every commission. At 966 rows with `loops=1` that is the correct plan, and
M4 is labelled ATTRIBUTION ONLY. P1 was never meant to bind on the outer measured statement's own
`FROM`; it bounds access **inside the DEFINER bodies**, which only Pass B can show. The grep was
unscoped, so it read the driver as the seam.

**Fix:** P1 is scoped to the `AE4-PASSB-BEGIN`/`END` region, and the harness now prints the
exclusion beside M4 so the next reader does not re-raise it.

⚠ **Second-order note, recorded rather than left implicit.** Inside `scope_reaches`, `commissions`
and `hospitals` are reached **by primary key**, so an index scan is chosen at almost any cardinality
and their presence in P1's list is weak. **The load-bearing member of P1's list is `memberships`**
(48 800 rows, hit by `assignment_facts` on every protected-row evaluation). The ×160 commissions
cardinality is not what P1 depends on and does not need re-deriving.

### 9.4 Ordering hazard that outlived the crash

`ON_ERROR_STOP` means **section 9's postflight never runs on any failure**, so an aborted run leaves
the stack unverified. In run 1 that was harmless (the crash preceded DC1, so no planted body was
ever installed) but it is not harmless in general. After **any** non-zero harness exit, run the
postflight standalone before anything else:

```sql
select (select p.prosrc like '%ae4dc1%' from pg_proc p join pg_namespace n on n.oid=p.pronamespace
         where n.nspname='authz' and p.proname='assignment_facts')             as dc1_body_stuck,     -- must be f
       (select state::text from authz.roles where code='staff_admin')          as staff_admin_state,  -- must be authoritative
       exists (select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
                 join pg_namespace n on n.oid=c.relnamespace
                where n.nspname='public' and not t.tgisinternal and t.tgenabled='D') as trigger_disabled;  -- must be f
```

### 9.5 ⭐ The result run 1 did produce — and it fails P5

P5's machine assertion never ran, but **its inputs were captured in full by Pass A**: three reps of
the identical statement over the identical 10 000 rows (the precondition confirmed both arms see
10 000), with the identical plan shape (`Seq Scan on professional_profiles … rows=10000`).

| | best of 3 | shared buffer hits | per protected row |
| --- | --- | --- | --- |
| M1b — **permission arm** | **13 126 ms** | **1 440 164** | 1.31 ms · 144 buffers |
| M1b-LEGACY — **legacy arm** | **2 142 ms** | **170 164** | 0.21 ms · 17 buffers |
| **ratio** | **6.13×** | **8.46×** | — |

**P5's threshold is ≤ 4×. Both ratios exceed it.** Corroborating, from M4: 10 626 direct
`authz.has_permission` calls in 8 553 ms with `shared hit=382 743` — **0.80 ms and ~36 buffers per
call**. The three figures are mutually consistent: the per-row cost of the protected read is
dominated by the seam, and the seam is buffer-heavy. This is the regression class F9 predicted.

⛔ **This is a provisional signal, not a verdict, and it may not be recorded as one.** The run is
VOID: **DC1 never ran**, so a dead or miscalibrated instrument is not excluded, and **Pass B never
ran**, so there is no evidence of *where* those ~127 extra buffers per row go — `assignment_facts`
re-invocation (P2), `scope_reaches` fan-out (P3), and a seq scan inside a body (P1) are three
different defects with three different fixes, and nothing yet distinguishes them.

⛔ **The threshold does not move.** 6.13× is 53% past K = 4, not a boundary case; §8 item 5 licenses
re-deriving a threshold for a value landing *within a few percent*, and this is not that. Relaxing
K to accommodate an observed number would green the condition and delete its subject.

**What the re-run must establish, in this order:** (i) DC1 passes, so the instrument is known able
to see an expensive seam; (ii) Pass B yields non-zero subject counts for `assignment_facts` and
`scope_reaches`; (iii) P1/P2/P3 bounds are evaluated against those plans; (iv) **only then** is the
P5 ratio a verdict. If DC1 passes and P2/P3 hold while P5 still reads ~6×, the honest conclusion is
that the seam legitimately costs ~6× the legacy arm per protected row, and the finding belongs to
AE5 sizing rather than to the harness.

### 9.6 Cost of the re-run

The fixture is dropped by the reset releasing the DB to the rollback-runbook verification. Budget a
full reload (§7 step 1) before re-running; the harness's fixture gate aborts immediately if it is
skipped, which is the intended behaviour.

### 9.7 P1/P2/P3 evaluation commands (revised — presence first, scoped second)

```bash
B=docs/design/authz-ae4-perf-run-passB.txt
awk '/AE4-PASSB-BEGIN/,/AE4-PASSB-END/' "$B" > /tmp/ae4-nested.txt

# STAGE 1 — PRESENCE. Zero here is VOID (capture-mechanism finding), never a pass.
grep -c 'assignment_facts' /tmp/ae4-nested.txt
grep -c 'scope_reaches'    /tmp/ae4-nested.txt

# STAGE 2 — BOUNDS. Only run these once stage 1 is non-zero for both.
grep -nE 'Seq Scan on (memberships|profiles|commissions|hospitals)\b' /tmp/ae4-nested.txt  # P1: empty
grep -nE 'assignment_facts.*loops=[0-9]+'                             /tmp/ae4-nested.txt  # P2: <= protected rows
grep -nE 'scope_reaches.*loops=[0-9]+'                                /tmp/ae4-nested.txt  # P3: <= M (20) per row
```
