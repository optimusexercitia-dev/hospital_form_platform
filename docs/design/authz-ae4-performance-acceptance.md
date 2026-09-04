# AE4 performance acceptance — fixture, harness and pass/fail protocol

**Obligation:** `FUP-AE4-PERFORMANCE-EVIDENCE-ON-THE-FINAL-PATH` (audit finding IA-F9);
Gate AE4 item per ADR [0176](../decisions/0176-authz-permission-layer-made-real.md) Consequences.
**Acceptance form:** [docs/plans/authz-evolution.md](../plans/authz-evolution.md) § AE4.4
*Performance evidence [PA-F6]* — nested plans over a scaled, `ANALYZE`d fixture, on the **final** path.
**Author:** `backend` · **Written:** 2026-09-02 · **Branch:** `authz-ae4-catalog`.

> ⭐⭐ **STATUS after run 6 (2026-09-03): MET.** All of P1–P5 and P7 pass, every control holds, and
> **K = 4 was not moved.** The increment is `20261003007320` (ADR
> [0182](../decisions/0182-statement-scoped-authorized-scope-ids.md)) — the permission answer is
> computed once per **statement** instead of once per protected row. **Full record: §14**, and the
> protocol amendment it is judged under: **§13** — ruled before the run **except for DC2, which was
> re-aimed after it FAILED at 1.15× against `≥ 5×` on the live path** (§13.2, §13.6, §14).
> ⛔ Every run-1..5 verdict below stands as measured, under the wording in force at the
> time; none of them is erased by this line.
>
> ~~⛔ **STATUS after run 5 (2026-09-02): NOT MET — but no longer VOID, and the residue is now two
> named things rather than one unexplained number.** Run 5 is the first run against a FIXED
> `authz.scope_reaches` (migration `20261003007310`, ADR
> [0180](../decisions/0180-scope-reaches-commission-org-ascent-plan-fix.md)). Controls PASS, so the
> conditions are verdicts and not VOID. **P2, P3, P4, DC1, DC2 PASS.** **P1 FAILED** as worded —
> `Seq Scan on hospitals` **8 240 → 4 120**, exactly the half the fix did not target — and then
> **PASSES** under the re-specification the PO ruled afterwards (§12.6, ADR
> [0181](../decisions/0181-p1-bounds-the-index-path-not-the-scan-node.md)); ⛔ **both verdicts
> stand, neither erases the other.** **P5 FAILS at 5.28x / 4.99x** (was 6.19x / 6.21x), improved
> but over K=4. ⛔ **That is a PARTIAL RESULT and is recorded as one: K does not move, and P5 is
> not argued down from P1's re-specification.** ⭐ **The one condition still failing is P5, and its
> cause is named:** not a plan defect but VOLUME — ~170 000 lookups re-resolving the same 20
> assignment facts, once per protected row. That is `authz.entailed_grants`' invocation structure
> and a separate increment. Record: **§12**.~~ **— superseded by run 6 above; the separate
> increment it names was built as `20261003007320`. §12's own verdict table is unchanged.**
>
> ~~**STATUS after run 3 (2026-09-02): still VOID — and the open question is now one function.**~~
> P5 has FAILED on **five** readings (6.13 / 5.20 / 6.21 / 6.27 / 6.04 vs K=4). P2, P3, DC2 and P4
> **PASS**. P1 **FAILS** on a located mechanism: `authz.scope_reaches` seq-scans the whole `hospitals`
> table on every call. DC1 ran for the first time and **failed at 1.53x** — which the arithmetic and
> P2 together explain as `assignment_facts` holding only **1–3 %** of per-row cost, not as a dead
> instrument (DC2 read 775x on the same apparatus). DC1 is **re-aimed**, not reinterpreted: §11.
> Every condition remains VOID under the dependency rule. Records: **§12** (run 5), **§11** (run 3),
> **§10** (run 2), **§9** (run 1). ⚠ **Run 4 has no numbered section** — it is the run that first
> executed the verdict table, its artifacts are the ones commit `8ca976d7` carries, and its figures
> are quoted throughout §12 as the pre-fix baseline.
>
> ~~**STATUS after run 1 (2026-09-02): VOID.**~~ The fixture loaded clean and five of nine harness
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
| **P1** | ⭐ **RE-SPECIFIED — ADR [0181](../decisions/0181-p1-bounds-the-index-path-not-the-scan-node.md), PO ruling 2026-09-02.** No `Seq Scan` on `public.memberships`, `public.profiles`, `public.commissions` or `public.hospitals` **that SURVIVES `enable_seqscan = off`** — i.e. no access on those four with **no index path at all**. The raw seq-scan census over the nested region is still **reported**, as evidence; it is no longer the pass/fail. | `scripts/authz-ae4-p1-index-path.sql` (verdict) + Pass B (census) | A scan survives the probe ⇒ the planner has no alternative to it and it can never self-correct at any cardinality — the regression F9 predicts. ⛔ **The bundled vacuity control must FIRE**, or the run is VOID: "no scan survived" and "the probe is broken" are the same string. |
| ~~**P1** (original wording, kept because runs 1–5 were judged under it)~~ | ~~No `Seq Scan` on those four anywhere in the nested plans~~ | ~~Pass B~~ | ~~Any of the four is seq-scanned.~~ ⚠ **Retired for a measured reason, not because it failed:** its FAILS-when column names the property (*"the one that turns linear into quadratic at production scale"*) while its condition bound a **token**. On a 2-page table a sequential scan is the correct plan and self-corrects by 620 rows (§12.2), so the two predicates had come apart. **Post-`ANALYZE` at 48 800 memberships the index is the only correct plan** — that rationale is unchanged and is what the new form measures directly. |
| ~~**P2** (runs-1..5 wording, kept because runs 1–5 were judged under it)~~ ⛔ **RETIRED — live form: §16 (ADR [0183](../decisions/0183-p2-invocation-count-respecification.md)), via §13.2** | ~~`authz.assignment_facts` is invoked **once per protected row**, not once per protected row **per assignment fact**~~ | ~~Pass B `loops` on the `assignment_facts` node~~ | ~~`loops` exceeds the protected-row count. That means the SRF is re-invoked inside the fact loop — an `O(M²)` shape.~~ ⚠ **Retired in two steps, and neither is in this row's text.** §13.2 re-stated it per-**statement** (the wording above goes *vacuous* the moment the read stops being per-row: "≤ 1 per protected row" is trivially true at 200 rows and 1 invocation). §16.1 then found the §13.2 wording *itself* could not fail, and §16.2 replaced P2's wording **and its instrument** — `A = 1 + U` on a `pg_stat_get_function_calls` counter, read from `scripts/authz-ae4-p2-invocation-count.sql`, plus **P2a** (row independence) and **P2b** (candidate slope). First scored under that form in run 7 (§17). |
| **P3** ⛔ **NARROWED — §13.2** *(this row's bound is still live for every UNCONVERTED path)* | `authz.scope_reaches` invocations ≤ `M` (= 20) per protected row | Pass B `loops` on the `scope_reaches` node | `loops` is `M ×` the role-permission row count or worse, i.e. the join order pushed `scope_reaches` below the implication-closure join. ⛔ **On the CONVERTED read path the bound is `≤ M` per STATEMENT** (§13.2) — the per-protected-row form above would pass vacuously there, for the same reason P2's did. The two forms coexist by path; neither replaces the other. |
| **P4** | Growth in the protected-row count is **at worst linear**: `t(N=10 000) / t(N=1 000) ≤ 30` (linear = 10; 3× headroom) | harness §7, machine-asserted | Ratio > 30. Super-linear growth in protected rows is precisely the hazard AE5 multiplies across eleven roles. |
| **P5** | The permission arm costs **≤ 4×** the legacy arm on the identical statement over identical rows | harness §7, machine-asserted | Ratio > 4. Rationale for K = 4: layer 3→2→1 adds one DEFINER SRF, three indexed joins and `M` `scope_reaches` calls over a path that is one indexed `EXISTS`; 4× is generous for that and still catches an order of magnitude. ⚠ Valid **only** because §4 proved the principal reaches those rows through the permission arm alone. |
| **P6** | Every control holds (§6.2) | harness §§0–3, 7, 8 | Any control failing makes the run **VOID**, not FAIL. |

⛔ **"P1–P6" is the runs-1..5 set, and it is no longer the whole acceptance.** §13.2 adds **P7
(short-circuit shape)** as a pass condition and **DC3 (semantic ablation)** as a control; both are
scored from run 6 on (§14, §15.2) and neither appears in this table or in §6.2. They are also the
*only* two things that bound the **converted** path (§13.5), the timing conditions having been
flattened by the change itself — so a reader who takes §6 as the complete list gets this run's
coverage claim backwards. ⚠ Left here rather than rotated in, because runs 1–5 were judged under §6
as written and §13 is the amendment of record; read the heading as a date-stamp, not a total.

### 6.2 The controls, and what each one would catch

| Control | Question it answers | VOIDs the run when |
| --- | --- | --- |
| **Fixture gate** (§0) | Did the fixture fully load, and was it `ANALYZE`d? | A live count below the declared scale, a principal fan-out ≠ 20, or any chain table with `last_analyze IS NULL`. *A fixture that cannot reach the failing state cannot produce a pass.* |
| **Positive control** (§1) | Is the session context reaching the policies at all? | Fewer than 3 distinct readings across six arms — or the **hat control**: with `active_role` absent (1c) or wrong (1d) the authorizer must be FALSE. If a missing hat still grants, the self-check conjunct is not live and nothing measures the production shape. |
| **Principal proof** (§2) | Is any competing arm granting? | Any of (b), (d), (e), (h), (j) TRUE. |
| **Ablation** (§3) | Is the permission arm merely *true*, or *load-bearing*? | Either authorizer still TRUE with layer 2 disabled — **or** either still FALSE after the rollback. |
| **P5 precondition** (§7) | Do P5's two arms do the **same work**? | The two principals see different row counts through the org-filtered read, or either sees zero. A ratio over unequal work is two statements wearing one label, not a comparison. |
| **DC1 — planted cost** (§8) ⭐ **RE-AIMED — §13** | **Could this measurement have shown a regression at all?** | A deliberately ~50×-more-expensive `authz.assignment_facts` (same rows, opaque extra work, installed and rolled back in one transaction) moves the measured statement by **< 10×**. Then the instrument is blind and no green number above is distinguishable from a dead one. Paired with a restore check: after rollback the statement must return within 2× of baseline, and `prosrc` must no longer contain the planted marker. |
| **DC2 — N-differential** (§7) ⛔ **RE-AIMED — §13.6, and re-aimed AFTER it FAILED** | Did the **fixture**, as opposed to the instrument, actually scale the work? *(unchanged — the question, the `≥ 5×` threshold and the meaning all survive)* | 1000× the protected rows costs < 5× more. Then either the fixture did not scale or the per-row evaluation is not happening — and a flat green number is uninterpretable either way. ⛔ **From run 6 this is measured on the PRE-CHANGE predicate** (harness label `DC2L/N=*`), because after `20261003007320` the live path's cost is O(1) in protected rows *by design*, so on the live predicate the failure condition above describes the intended state. The live N-differential is still printed, as evidence; it is no longer a verdict. ⚠ **This row is why the marker matters:** unlike DC1's, DC2's re-aim was **not** ruled in advance — run 6's first pass A read DC2 at `1.15×` against `≥ 5×`, a control FAIL that under P6 VOIDs the run, and the re-aim followed that reading. §13.2's DC2 row and §13.6 carry the record. |

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

⛔ **BEFORE STEP 0 — RENAME THE PREVIOUS RUN'S ARTIFACTS, or you silently invalidate every
citation of them.** Steps 1–3 **overwrite** `authz-ae4-perf-run-{load,passA,passB}.txt` in place.
Those files are not scratch: §14, §16, ADR 0183 and the external-audit response all cite them by
**line number** (`run6-passB.txt:2818`, `run6-passA.txt:340`, …), and an overwrite leaves every one
of those pointing at whatever now occupies that line — the citation still *looks* checkable, which
is the whole failure this document exists to distrust. Run 6's pair was preserved as
`authz-ae4-perf-run6-*.txt` on 2026-09-03 for exactly this reason; ⚠ it was preserved **after**
§16 had already been written against the un-suffixed names, so the repoint was a repair, not a
convention that was followed. Do it first from now on:

```bash
# -1. Preserve the outgoing run under its own number, and repoint nothing —
#     citations already name run6-*, and run N names runN-*.
git mv docs/design/authz-ae4-perf-run-passA.txt docs/design/authz-ae4-perf-run<N>-passA.txt
git mv docs/design/authz-ae4-perf-run-passB.txt docs/design/authz-ae4-perf-run<N>-passB.txt
git mv docs/design/authz-ae4-perf-run-load.txt  docs/design/authz-ae4-perf-run<N>-load.txt
```

⚠ An earlier instance of this same rot is still visible and is left as a marker: §9.2 states a
count "in `authz-ae4-perf-run-passB.txt`; the file ends at line 593" — a **run 2** artifact that
run 6 overwrote long ago. Nothing flagged it, because a stale line number cannot fail a gate.

```bash
# 0. Fresh, quiet stack. ⛔ Run this from the WORKTREE you are testing, not the primary
#    checkout — both share project_id azkbbhskturikxpgmafq, so `db reset` applies whichever
#    directory's migrations you happen to be standing in. Measured 2026-09-03: a reset run
#    from the wrong checkout left the DB at head 20261003007300 with authz.authorized_scope_ids
#    ABSENT, and reported "clean".
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

# 4. The COMMITTED CHECKERS — P1's verdict and, from run 7 on, P2's. Added
#    2026-09-03 (ADR 0183): P1's checker existed from run 6 but was never a step
#    here, so it lived only in whoever remembered to run it.
#    ⛔ Read each exit code DIRECTLY. Both need the fixture loaded; P2's also
#    needs superuser (track_functions) and takes ~10 s.
docker exec -i supabase_db_azkbbhskturikxpgmafq \
  psql -U postgres -d postgres -X -f - < scripts/authz-ae4-p1-index-path.sql
echo "P1PROBE: $?"
docker exec -i supabase_db_azkbbhskturikxpgmafq \
  psql -U postgres -d postgres -X -f - < scripts/authz-ae4-p2-invocation-count.sql
echo "P2PROBE: $?"

# 5. Evaluate P3 — and P1/P2's EVIDENCE — from the Pass B output. TWO STAGES,
#    presence before bounds.
#    ⛔ Do not run the bound greps unscoped or before the presence greps: run 1
#    showed an unscoped P1 grep reading M4's driver as the seam, and an empty
#    bound grep reads exactly like a pass. Commands: section 9.7.

# 6. Teardown — OR, preferred, a reset (see below).
supabase db reset --local
```

⛔ **The run ledger line gains `P2PROBE` from run 7 on**:
`RESET=… · LOAD=… · PASSA=… · PASSB=… · P1PROBE=… · P2PROBE=…`. The run-6 lines (§14, §15.2) carry
no `P2PROBE` and must not be given one — that run had no P2 probe, and back-filling a field into a
record of a run that did not produce it is how a record stops being one.

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
   `AE4-PASSB-BEGIN` / `AE4-PASSB-END` markers so the greps can be scoped with `awk` — ⚠ **those
   markers were themselves defective and are SUPERSEDED by the tokenised sentinels, §10.1** — (the same file
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

**Fix (superseded in form by §10.1, unchanged in substance):** P1 is scoped to the nested region, and the harness now prints the
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

### 9.7 P1/P2/P3 evaluation commands (revised twice — see §10.1 for why)

⛔ The region sentinels are **tokenised and anchored**, and the token is never written in prose
anywhere in this repository except the command below. Run 2's extraction failed precisely because
the old markers were plain words that also appeared in the text explaining them (§10.1).

```bash
B=docs/design/authz-ae4-perf-run-passB.txt
awk '/^@@AE4_NESTED_BEGIN@@$/{f=1;next} /^@@AE4_NESTED_END@@$/{f=0} f' "$B" > /tmp/ae4-nested.txt

# STAGE 0 — EXTRACTOR SANITY. The nested region is tens of thousands of lines.
# A region of a few dozen means the EXTRACTOR is broken, not that the subjects
# are missing. Run 2 returned 48 lines and it read as a clean absence.
wc -l < /tmp/ae4-nested.txt          # expect >> 1000; a small number is an extractor finding

# STAGE 1 — PRESENCE. Zero here is VOID (capture-mechanism finding), never a pass.
grep -c 'assignment_facts' /tmp/ae4-nested.txt
grep -c 'scope_reaches'    /tmp/ae4-nested.txt

# STAGE 2 — BOUNDS. Only once stages 0 and 1 are satisfied.
grep -oE 'Seq Scan on [a-z_]+' /tmp/ae4-nested.txt | sort | uniq -c | sort -rn     # P1 (evidence)
grep -c 'Function Scan on assignment_facts af' /tmp/ae4-nested.txt                 # P2 (evidence)
grep -c 'Filter: authz.scope_reaches' /tmp/ae4-nested.txt                          # P3
```

⛔ **P1's and P2's VERDICTS no longer come from this region.** Both are now committed checkers with
exit codes; the greps above are kept because presence and the raw census are still worth reporting,
and stages 0–1 above still bind (an absent subject is VOID, never PASS — §9.2).

| condition | verdict from | this region now supplies |
| --- | --- | --- |
| **P1** | `scripts/authz-ae4-p1-index-path.sql` (ADR 0181) | the raw `Seq Scan` census, as evidence |
| **P2** | `scripts/authz-ae4-p2-invocation-count.sql` (ADR 0183, §16) | the raw node count, as evidence |
| **P3** | this region | the bound |

⛔ **The retired P2 command was**
`grep -oE 'Function Scan on assignment_facts af .*loops=[0-9]+' | grep -oE 'loops=[0-9]+' | sort | uniq -c`.
It counted `loops` **values**, never the node count against a bound. Every nested `has_permission`
emits its own plan with its own node at `loops=1`, so *"every node `loops=1`"* is true for any
number of candidate scopes and **cannot fail** — it is stated here in full so the next reader can
see why it is gone rather than re-inventing it. §16 has the replacement.

---

## 10. Run 2 (2026-09-02) — the rulings, and the structural verdict the artifact already held

Run 2 confirmed the §9.1 fix: the harness reached its own conditions and raised a real verdict.
P5 failed reproducibly — **5.20×** (pass A) and **6.21×** (pass B), against run 1's **6.13×**.
Three independent readings, all well past K = 4.

### 10.1 Ruling on the empty nested region — the hypothesis is disproven; the defect was mine

The offered hypothesis was that `auto_explain` writes to the **server log** and so can never appear
in `passB.txt`. **That is disproven by the artifact.** `passB.txt` is **230 815 lines**; the nested
region alone is **229 939**. `client_min_messages = log` forwarded the LOG-level output to psql
exactly as AE0.2 established. The capture mechanism has been working the whole time.

The zero came from **my extraction markers matching their own documentation**. The old range
expression opened at line **709** — an advisory line beside M4 that *named* the two markers — and
closed at line **756**, the BEGIN banner's own second line, which spelled the END marker in prose.
48 lines, both subject counts zero, and the two-stage rule dutifully reported VOID.

⭐ **The two-stage rule worked. It is the reason no false pass was reported.** What failed was the
extractor, and this is the *third* consecutive absence in this workstream whose mechanism was
mis-attributed on first reading — run 1's Pass B (blamed on `EXPLAIN` semantics, actually an
ordering defect), run 1's P1 hit (blamed on cardinality, actually grep scope), and now this. The
standing lesson holds and has now been paid for three times: **an absence's mechanism is measured,
not inferred from its gate.**

**Fixes:** the sentinels are now tokenised (`@@…@@`), alone on their line, matched with `^…$`
anchors, and the token appears in prose nowhere; the M4 advisory no longer names it. And a
**stage-0 extractor-sanity check** was added — the region must be thousands of lines, because a
broken extractor and a genuine absence are otherwise indistinguishable.

### 10.2 Ruling on DC1 — both shapes, plus a dependency rule

The observation is correct and is a protocol defect: the control that excludes a dead instrument sat
**downstream of the condition it validates**, so it could not run in exactly the case that matters.
Adopted, per the second offered shape and more:

1. **Conditions no longer raise where they are evaluated.** DC2, P4 and P5 write into a
   `pg_temp.ae4_verdict` table; **section 10 raises once**, at the end, *after* DC1 and *after* the
   postflight. A P5 failure can no longer hide P4, and can no longer prevent DC1.
2. **Every condition is pre-registered `UNRUN`.** A row never written stays `UNRUN` and is reported;
   a condition that silently vanished from the table would otherwise read as a clean sheet.
3. ⭐ **The dependency rule, which is the real answer:** a condition whose controls did not PASS is
   rewritten **VOID** — never PASS, never FAIL. *"A reproducible failure is still not reportable as
   a verdict"* stops being something a human has to argue and becomes what the table says, with the
   reason attached. Statuses are now four: `PASS` / `FAIL` (a regression) / `VOID` (nothing was
   measured) / `UNRUN` (never reached).

DC1's ratio is carried out of its rolled-back transaction in a psql variable (`\gset` is client
state and survives the rollback) and its verdict is written afterwards.

### 10.3 ⭐ P1, P2 and P3 — evaluated from run 2's committed artifact

Once the region was extracted correctly, the evidence was already there. Presence: `assignment_facts`
**418**, `scope_reaches` **412**, `memberships` **1 067**.

| | Verdict | Evidence |
| --- | --- | --- |
| **P2** | **PASS** | `Function Scan on assignment_facts af` appears **209** times, **every one `loops=1`**. The SRF is invoked once per `entailed_grants` call, i.e. once per protected row — *not* once per assignment fact. The `O(M²)` shape P2 exists to catch is **not present**. |
| **P3** | **PASS** | `scope_reaches` is planned as a `Filter:` **on the `assignment_facts` Function Scan node** — evaluated at most once per assignment fact per call, exactly the `≤ M` bound. 206 filter nodes, one per call. |
| **P1** | ⛔ **FAIL** | Not on `memberships`, which is clean: **209 `Index Scan on memberships_principal_idx`** plus 209 `Bitmap Heap Scan`, zero sequential scans. It fails on **`hospitals`: 8 240 sequential scans.** |

**The P1 mechanism, located exactly.** Inside `authz.scope_reaches`, the `organization`←`commission`
ascent runs as an **InitPlan Hash Join** whose inner side is `Seq Scan on hospitals h (rows=124)` —
it scans and hashes the **whole** `hospitals` table on every call, then joins it to the single
commission row:

```
InitPlan 1
  ->  Hash Join   Hash Cond: (h.id = c.hospital_id)   Buffers: shared hit=5
        ->  Seq Scan on hospitals h  (rows=124)       Buffers: shared hit=2
```

The correct plan is a PK lookup of the commission followed by a PK lookup of its one hospital. ~~This
term is `O(protected_rows × M × |hospitals|)` — the one part of the chain that grows with the
**tenant count** rather than with the principal.~~ ⚠ **BOTH claims in this paragraph are corrected by
§12:** the 8 240 are **two** InitPlans of 4 120, not one (§12.1), and the `O(|hospitals|)` scaling
does not survive measurement — the planner self-corrects to an index by ~2 000 rows (§12.2).

⚠ This revises §9.3's second-order note, which said `hospitals` was reached *by primary key* and that
P1's load-bearing member was `memberships`. **`memberships` is fine; `hospitals` is the defect.**
That note reasoned from the function's SQL text; the plan says otherwise. Corrected in place and
kept visible — it is the same class as everything else in §10.1.

### 10.4 What this means for P5, and what it does not

A seq-scan-and-hash of 124 rows per `scope_reaches` call, tens of times per protected row, is a
strong candidate for the bulk of P5's ~6× — and the legacy arm (`is_org_admin_of`) performs **no**
commission→hospital→organization ascent at all, so it pays none of it.

⛔ **Still not a verdict, and the reason is now narrower than it was.** DC1 has never run, so the
instrument remains unvalidated and every condition above is VOID under §10.2's dependency rule. But
the open question has changed shape: it is no longer *"is the seam inherently ~6× more expensive"* —
P2 and P3 say the layer's invocation structure is sound, and P1 names a **specific, local, probably
fixable plan defect** in one branch of `scope_reaches`.

**Run 3 must, in order:** (i) DC1 PASS; (ii) re-confirm P2/P3 with the corrected extractor;
(iii) confirm P1's `hospitals` finding; (iv) only then is P5 a verdict. If P1's defect is later
fixed and P5 falls under 4×, the acceptance is met and no AE5 sizing concern arises from it. If P5
stays ~6× with P1 clean, the seam legitimately costs ~6× per protected row, it becomes the AE5
sizing finding — 11 roles multiplying it — and a genuine input to the PO's gate decision.

⛔ **Do not fix `scope_reaches` inside this workstream.** It is a migration against a `SECURITY
DEFINER` function on the authorization path; it needs its own plan approval and its own pgTAP
keystone, and changing the subject mid-measurement would leave the acceptance measuring something
the previous three runs did not.

---

## 11. Run 3 (2026-09-02) — DC1 ran, failed at 1.53×, and the failure is informative

Stages 0 and 1 were satisfied for the first time: nested region **229 937** lines, `assignment_facts`
**418**, `scope_reaches` **412**. The tokenised sentinels fixed the extractor. Run 3 reproduces run 2
exactly on the bounds — P1 **FAIL** (`Seq Scan on hospitals` = 8 240; memberships/profiles/commissions
= 0, memberships taking 429 *index* scans), P2 **PASS**, P3 412 nodes.

| | pass A | pass B | threshold | |
| --- | --- | --- | --- | --- |
| DC2 | 775.71 | 693.13 | ≥ 5 | PASS |
| P4 | 10.49 | 6.79 | ≤ 30 | PASS |
| P5 | 6.27 | 6.04 | ≤ 4 | **FAIL** (five readings: 6.13 / 5.20 / 6.21 / 6.27 / 6.04) |
| DC1 | 1.53× | 1.55× | ≥ 10 | **FAIL** |

### 11.1 Ruling — the instrument is demonstrably alive, and DC1's verdict still stands

**The offered reading is right, and there is a stronger form of it available than the one argued.**
The argument offered was that P1 + P2 make `scope_reaches` the plausible dominant term, so DC1 planted
cost in the wrong place. That is an inference. **DC2 = 775.71× is a measurement**, taken by *the same
timing function, on the same statements, in the same run*. **A dead instrument cannot produce 775×.**
The apparatus is not dead, and that is settled by evidence rather than by plausibility.

**What else could produce 1.53×?** Four candidates, three of them already refuted by evidence in hand:

| Candidate | Status |
| --- | --- |
| The planted body never installed | **Refuted** — the restoration check fires on `prosrc like '%ae4dc1%'` and had something to find and clear; had the `create or replace` not applied, the transaction would have raised. |
| The planner folded the plant away | **Refuted** — the plant is a `union all` branch whose filter is `md5(...) = <literal>`, opaque to the planner; it cannot be proven empty at plan time. |
| `assignment_facts` results cached across rows, so the plant is paid once per statement rather than once per row | **Refuted** — P2 measured **209 `Function Scan on assignment_facts` nodes, every one `loops=1`**, i.e. one invocation per protected row. No cross-row reuse. |
| `assignment_facts` is simply a small share of per-row cost | **The remaining explanation.** |

Quantified: for a planted multiplier `k` on a term holding share `x` of per-row cost, the observed
ratio is `k·x + (1 − x)`. With `k ≈ 20–50` and ratio `1.53`, `x ≈ 1–3 %`. **`authz.assignment_facts`
is one to three per cent of the per-protected-row cost** — which is why F9's premise (*"a non-inlinable
DEFINER SRF evaluated per row"* as the regression) does not survive contact with the plans: the SRF
is real, it is per-row, and it is cheap.

⛔ **DC1's verdict nevertheless stands as FAIL, and the dependency rule holds: every condition
including P5 is VOID.** A failed control may not be argued into a pass — that is the single move this
acceptance exists to prevent, and it does not become acceptable because the argument is a good one.
What the reading licenses is **re-aiming the control**, not reinterpreting its result.

### 11.2 The re-aim — DC1 becomes an attribution instrument, not just a detector

Both offered shapes, taken together, because the pair is strictly more informative than either arm:

- **DC1a** — plant in `authz.assignment_facts`. **Kept.** Its 1.53× is now a *reading* of that term's
  share, not an unexplained failure.
- **DC1b** — plant in `authz.scope_reaches`. New, aimed at the term P1 indicts.
- **Pass condition:** the pair passes iff **at least one arm moves ≥ 10×**. ⛔ It must not be able to
  pass by spreading two small numbers across two arms — if neither moves, the instrument is blind and
  the run is VOID.

Two anti-optimiser properties in DC1b's plant, both load-bearing and both learned from earlier defects
in this workstream: the planted subquery is the **`CASE` selector**, so it must be evaluated to choose
a branch (as an `AND` conjunct the planner would order it last and short-circuit past it on the
~19-in-20 calls returning false — under-planting in exactly the place being measured); and it is
**correlated on `p_assignment_id`**, so it cannot be hoisted into a once-per-statement InitPlan, which
is the same folding hazard that M4 hit in §5.

⚠ **Prediction, recorded before run 4 so it cannot be fitted afterwards: DC1a ≈ 1.5×, DC1b ≥ 10×.**
If DC1b also returns ≈ 1.5×, the cost is in neither term, P1's hospital-scan attribution is wrong too,
and that is a genuinely informative surprise rather than a tuning problem.

### 11.3 The verdict table has still never executed

`declare v_r numeric := nullif(:'dc1_ratio', '')::numeric;` — **psql does not interpolate `:'var'`
inside a dollar-quoted body.** The server received the literal text and raised `syntax error at or
near ":"`, so section 10 — the single-raise verdict table built in §10.2 — never ran, and run 3's
numbers were read out of `NOTICE`s by hand.

**Fix:** the DC1 verdict is now an ordinary SQL statement, where interpolation does work. Measured
across the whole harness: **that was the only such site** — sections 2 and 3 read `fixture_meta`
through subqueries precisely to avoid it, which is why they have worked since run 1.

⛔ **Recorded as an open risk: the verdict table has been specified for two runs and executed in
none.** Until run 4 exercises it, "the harness raises one verdict at the end" is a claim about code
that has never run. Treat run 4's first job as confirming that section 10 produces a table.

### 11.4 Where the finding now stands

Nothing here is yet a verdict — DC1 has not passed, so §10.2's dependency rule holds and P5 is VOID
on five consistent readings. But the shape of the likely outcome is now sharp, and it is the good one:

- the permission layer's **invocation structure is sound** — P2 and P3 pass, and `assignment_facts`
  measures at 1–3 % of per-row cost;
- the cost is concentrated in **one branch of one function**, `authz.scope_reaches`'s
  organization-from-commission ascent, which seq-scans and hashes the whole `hospitals` table per
  call instead of doing two primary-key lookups;
- ~~that term is `O(protected_rows × M × |hospitals|)` — **the only part of the chain that scales with
  tenant count**, and therefore the only part whose cost grows as the platform onboards customers.~~
  ⚠ **CORRECTED by §12.2** — measured against `ANALYZE`d copies of `hospitals` at 124 / 620 / 1 984 /
  19 964 rows, the planner leaves the seq scan on its own by ~2 000 rows. It is a small-table
  artifact, not a tenant-count term. The waste it *did* carry is real and is paid at every
  cardinality; that is what `20261003007310` removed.

If run 4's DC1b confirms it, this stops being *"the seam is 6× expensive"* — an argument against the
permission layer — and becomes *"one branch has a fixable plan defect"*, which is a much smaller and
much more actionable finding, and a genuine input to the PO's Gate AE4 decision.

⛔ **`authz.scope_reaches` is still not to be touched from this workstream.** It is a migration
against a `SECURITY DEFINER` function on the authorization path: it needs its own plan approval and
its own pgTAP keystone, and changing the subject mid-measurement would invalidate five runs. The fix
is a separate increment, and the acceptance re-runs against it afterwards.

---

## 12. Run 5 (2026-09-02) — the first run against a FIXED `scope_reaches`. NOT MET, and the two halves of the residue are different

Subject: `20261003007310` (ADR [0180](../decisions/0180-scope-reaches-commission-org-ascent-plan-fix.md)).
The commission→organization ascent stopped joining `public.hospitals` for a column
`public.commissions` already carries; `commissions_hospital_org_fkey` makes the two provably the
same value. Fresh `db reset` at head `20261003007310`, full fixture reload, both passes.
`RESET=0 · LOAD=0 · PASSA=3 · PASSB=3` — each read from its own file. ⛔ The two 3s are the
harness **working**: section 10 raises once at the end when a condition fails (§10.2).

| | pass A | pass B | run 4 (pre-fix) | threshold | |
| --- | --- | --- | --- | --- | --- |
| DC1a `assignment_facts` | 1.58× | 1.68× | 1.52× | — | — |
| DC1b `scope_reaches` | **18.12×** | **17.01×** | 14.17× | ≥ 10 (either arm) | **PASS** |
| DC2 | 704.31× | 686.08× | 548.67× | ≥ 5 | **PASS** |
| P4 | 9.30 | 9.43 | 10.59 | ≤ 30 | **PASS** |
| P5 | **5.28×** | **4.99×** | 6.19× | ≤ 4 | ⛔ **FAIL** |

Externally, per §9.7 — stage 0 nested region **212 149** lines; stage 1 presence `assignment_facts`
**418**, `scope_reaches` **412**; only then the bounds:

| | Verdict | Evidence |
| --- | --- | --- |
| **P2** | **PASS** | 209 `Function Scan on assignment_facts`, **every one `loops=1`**. Unchanged by the fix, as expected — it touches table access, not invocation structure. |
| **P3** | **PASS** | 206 `Filter: authz.scope_reaches` nodes on that Function Scan. Unchanged. |
| **P1** | ⛔ **FAIL** under the wording in force at the time; **PASS** under the re-specification ruled afterwards (§12.6) | `memberships` 0 · `profiles` 0 · `commissions` 0 · **`hospitals` 4 120** (was 8 240). ⛔ **Both verdicts stand and neither replaces the other** — the FAIL is what run 5 measured against the condition as written, and it is not erased by the ruling that followed it. |

### 12.1 P1 — the count halved, and the surviving half is the half that was never the target

Run 4's 8 240 `Seq Scan on hospitals` were **two InitPlans of 4 120 each**, not one — a fact §10.3
does not record, because it attributes all 8 240 to the ascent. Run 5 removes exactly one of them:

- **gone:** InitPlan 1's `hospitals h` at **width 32** — the join node. 4 120 → 0.
- **remains:** the organization-from-**hospital** arm, 4 120 nodes, of which **603 execute** and
  3 517 are `never executed`. ⭐ 603 is the *identical* executed count run 4 measured for that arm,
  which is the strongest available confirmation that the fix removed the intended node and only it.

The ascent now shows up as `Index Scan using commissions_pkey`, whose count rose to **8 253**.

⛔ **P1 is recorded as FAIL.** The surviving nodes cost 2 buffers, an `Index Only Scan` on
`hospitals_id_org_uq` was measured to cost 2 as well, and the arm self-corrects to that index at
620 rows (§12.2) — so removing them would move no cost and would satisfy P1's wording while its
stated subject was never present. The wording gap is `FUP-AE4-P1-BOUNDS-A-SYNTAX-NOT-A-PROPERTY`,
for the PO. **It is not closed by editing P1 here.**

### 12.2 ⚠ A claim in §§10.3 and 11.4 does not survive measurement

Both call the term `O(protected_rows × M × |hospitals|)` — *"the only part of the chain that scales
with tenant count"*. Measured 2026-09-02 with `EXPLAIN (GENERIC_PLAN)` against `ANALYZE`d copies of
`hospitals` carrying identical indexes:

| `hospitals` rows / pages | organization←hospital arm | the ascent's join |
| --- | --- | --- |
| 124 / 2 (the fixture) | `Seq Scan` (cost 3.55) | `Hash Join` + `Seq Scan` (11.88) |
| 620 / 9 | **`Index Only Scan`** (8.29) | `Hash Join` + `Seq Scan` |
| 1 984 / 28 | `Index Only Scan` | **`Nested Loop` + `Index Only Scan`** (16.60) |
| 19 964 / 285 | `Index Only Scan` | `Nested Loop` + `Index Only Scan` |

`public.hospitals` is **2 pages**, so a full scan at 3.24 genuinely beats a `hospitals_pkey`
descent at 8.29 — the planner was locally correct, and it **self-corrects long before any
interesting tenant count**. The seq scan is a small-table artifact, not a tenant-count term.

⭐ **This does not weaken the finding, it re-describes it.** What was actually wrong is paid at
*every* cardinality: the ascent fetched `h.organization_id` across a join when `c.organization_id`
was already in the driving row — 5 buffers and a 124-row hash build per call, 17 calls per
protected row for the measured principal. That is what run 5 removed. **Corrected in place and kept
visible**, same as §10.3's own correction of §9.3.

### 12.3 A prediction recorded before the run, and wrong in its direction

§11.2's arithmetic (`k·x + (1 − x)`) was used to predict that DC1b would **fall** — making
`scope_reaches` cheaper should shrink the share `x` a plant multiplies, so 14.17× was expected to
land at 8–14×, with a real risk of dropping under 10 and voiding the whole run. **It rose, to
18.12× / 17.01×.**

The model was the wrong shape. DC1b's plant adds a roughly **fixed absolute** cost per call, not a
multiple of the term's own cost, so the observed ratio is `1 + N·C / T_base` — and shrinking
`T_base` *raises* it. **The control got stronger because the subject got faster.** Recorded because
the arithmetic in §11.1 is still used there to size `assignment_facts` at 1–3 %, and that use is
unaffected: it reasons about a plant applied to a term at *fixed* baseline, which is the case it fits.

### 12.4 Where P5 now stands — a partial result, stated as one

**P5 FAILS on eight readings across five runs:** 6.13 / 5.20 / 6.21 / 6.27 / 6.04 / 6.19 / **5.28**
/ **4.99**. The fix moved the permission arm from 13 111 ms to 11 560 ms (pass A) and 10 745 ms
(pass B) over the identical 10 000 rows, against a legacy arm holding steady at ~2 150 ms.

⛔ **K = 4 does not move, and P5 is not "nearly met".** §8 item 5 licenses re-deriving a threshold
for a value landing within a few percent of it; 4.99 is **25 % over** and 5.28 is **32 % over**.
⛔ **And P5 may not be argued down from P1's outcome.** P1 turning out to be partly a specification
artifact says nothing about P5 — the two conditions are independent and P5 has never rested on P1.

What the run *does* settle: the remaining cost is **not** the plan defect that was fixed, and not
`assignment_facts` (DC1a still ~1.6×). DC1b at 17–18× says `scope_reaches` is still the dominant
term — but now as *volume*, not as a bad plan: 17 index-scan ascents per protected row × 10 000
protected rows is ~170 000 lookups of the same 20 assignment facts, re-resolved for every row.
Removing **that** is a change to `authz.entailed_grants`' invocation structure, not to
`scope_reaches`, and it is a different increment with its own approval. That, not a threshold edit,
is the honest next move — and it is a genuine input to the PO's Gate AE4 decision.

### 12.5 A stale snippet, found by running it

§9.4's standalone postflight query tests `prosrc like '%ae4dc1%'` on **`authz.assignment_facts`
only**. Since §11.2 added DC1b, which plants into **`authz.scope_reaches`**, that snippet is
half-aimed: a stuck DC1b body would read as a clean stack. ⚠ The **harness's own** section 9 is
fine — it asks "any authz body still contains a DC1 planted marker" and covers both. Run 5's
postflight was executed with both bodies checked explicitly: `dc1a_body_stuck=f`,
`dc1b_body_stuck=f`, `staff_admin_state=authoritative`, `trigger_disabled=f`, and
`ascent_join_back=f` (the fix survived its own measurement).

### 12.6 P1 re-specified, and re-evaluated — PASS, with the control that makes that readable

`FUP-AE4-P1-BOUNDS-A-SYNTAX-NOT-A-PROPERTY` was put to the PO with four candidate wordings and
ruled on 2026-09-02. **Adopted: bound the property — a `Seq Scan` on the four chain tables is a
finding only when it SURVIVES `enable_seqscan = off`.** Rationale, instrument, the two rejected
options and the measurement that killed a third: ADR
[0181](../decisions/0181-p1-bounds-the-index-path-not-the-scan-node.md).

⛔ **This flips P1 from FAIL to PASS, which is the single move this document exists to distrust.**
Three things make it a correction rather than a fudge, and all three are checkable:

1. **The subject did not change.** P1's FAILS-when column has said *"the one that turns linear into
   quadratic at production scale"* since `82613268`. The **instrument** was a token match that had
   measurably come apart from it (§12.2). The re-spec makes the instrument match the subject that
   was written down first, not the result that was measured last.
2. **The old verdict is preserved, not overwritten** — §12's table and §10.3 both still read FAIL,
   labelled with the wording each was judged under.
3. ⭐ **The new check is proven able to return both verdicts, and the proof ships inside it.**
   `scripts/authz-ae4-p1-index-path.sql` builds an index-less copy of `hospitals` as §0 and
   **raises VOID if that control does not produce a surviving scan** — so the check cannot
   silently become vacuous the way an empty grep can. Measured 2026-09-02: the control fires, and
   pointing a §1 subject at the index-less copy makes the whole probe raise and exit **3**. The
   stronger control — dropping `hospitals`' real indexes in a rolled-back transaction — was also
   run once by hand and produced a surviving `Seq Scan`, with the index path returning after
   rollback.

**Run 5, re-evaluated (`P1_PROBE_EXIT=0`):**

| Subject | Node under `enable_seqscan=off` | |
| --- | --- | --- |
| §0 control — `p1_noindex`, no index by construction | `Seq Scan` | **SURVIVES — control FIRED** |
| `hospitals` — `scope_reaches` organization←hospital | `Index Only Scan` | CLEAR |
| `commissions` — the ascent / hospital←commission | `Index Scan` | CLEAR |
| `memberships` — `assignment_facts` by principal | `Index Only Scan` | CLEAR |
| `profiles` — `assignment_facts` platform_admin arm | `Index Scan` | CLEAR |

⚠ **What P1 now asserts, exactly:** every one of those four accesses *has* an index path, so none
of them can degrade without bound as rows accumulate. It does **not** assert that the planner will
choose that path at production scale — for `hospitals` that was measured separately (§12.2) and
holds; for any table added to P1's list later, its own crossover is owed.

⛔ **P5 is untouched by this.** It failed at 5.28× / 4.99× against K = 4 and still does. The two
conditions are independent, and nothing in this ruling licenses re-deriving K.

---

## 13. Amendment for the statement-scoped increment (2026-09-03) — ADR 0182

⛔ **READ THIS BEFORE RUNNING RUN 6.** Migration `20261003007320` computes the permission answer
**once per statement** instead of once per protected row. Three of the conditions below were
calibrated against the per-row amplification that change removes, and **run 6 executed against the
unamended protocol would be VOID — with the VOID caused by the optimization working.** That is the
single failure mode this document exists to distrust, so the amendment is ruled *before* the run and
its reasoning is recorded here rather than after a surprising result.

⛔ **CORRECTED 2026-09-03 (QA review): that sentence is true of §§13.1–13.5 and NOT of §13.6.** This
draft asked the amplification question of DC1 and never asked it of DC2. Run 6's first pass A asked
it — **DC2 read `1.15×` against its `≥ 5×` threshold**, a control FAIL — and DC2 was re-aimed
*after* that reading. So one control did move after a failing result, which is the shape this
section opens by distrusting. It is said here, at the top, because a reader who takes the sentence
above at face value will not reach §13.6.

### 13.1 Why DC1 cannot survive unamended — measured, not predicted

DC1's measured statement is, verbatim from harness §8:

```sql
select count(*) from (select 1 from public.professional_profiles limit 200) t
```

That is a read through `professional_profiles_select` — **the exact policy `20261003007320`
rewrites.** DC1a plants into `authz.assignment_facts` and DC1b into `authz.scope_reaches`; both
terms are today paid 200× per statement and are afterwards paid **once**. Neither arm can then reach
`≥ 10×`, so DC1 fails, P6 fails, and the run is VOID.

⛔ **The threshold is not the problem and must not be lowered.** DC1's `≥ 10×` is a correct measure
of *per-row amplification*; once the amplification is gone, no plant into the authorization chain
can move a 200-row read by 10×. Lowering it would be editing an instrument to accommodate a result.

### 13.2 What is ruled instead

| | Amendment | Why |
| --- | --- | --- |
| **DC1** | **Unchanged statement, unchanged `≥ 10×`, but the PRE-CHANGE policy predicate is re-installed for the duration** — in the same rolled-back transaction that already installs and removes the planted body. Recorded from now on as **DC1 (legacy-predicate control)**. | Keeps DC1 measuring exactly what it measured in runs 1–5 — the 200-row per-row read — so the eight readings stay comparable, and proves the *timing harness* can still see an expensive seam. ⛔ See §13.5: the obvious re-aim was measured and killed. |
| **DC3 — semantic ablation** (NEW) | On the converted path, mutate `authz.authorized_scope_ids` in a rolled-back transaction. **DC3a, empty set** ⇒ the org-filtered read's row count must **NOT move**. **DC3b, every organization** ⇒ it must yield **foreign** rows. Both must hold, or the run is VOID. ⚠ Those two row counts are the whole of the **scored** criterion: DC3a's cost is expected to rise to the pre-change magnitude and is printed beside the count as evidence (§14 records `10 390 ms`), but harness §8b's `DC3` verdict tests row counts only, so a cost that failed to rise would be visible and would not by itself VOID the run. ⛔ **CORRECTED 2026-09-03 (QA review).** This row first read *"empty set ⇒ the read must yield 0 rows"*, which is **unsatisfiable by construction** and contradicted the control that was actually built and scored (harness §8b; §14's DC3a row): the policy's `ELSE` arm is the untouched authorizer, so emptying the set arm removes the short-circuit and never the grant. A row count that DROPS there would mean the rewrite NARROWED the policy — the one thing the subset argument says it cannot do — so **0 rows is the FAILURE condition, not the pass**. The implemented control was correct throughout; this text was not, and under P6 the written form would have VOIDed a passing run. | The converted path needs a discrimination control that a once-per-statement plant cannot provide. This is the §3 ablation pattern — *is the arm merely true, or load-bearing?* — applied to the set arm, and it is a **semantic** probe, so flattening the timing cannot flatten it. |
| **P2** | Re-stated: `authz.assignment_facts` is invoked **once per STATEMENT** on the converted read path (and unchanged, once per protected row, everywhere else). | ⛔ Under the old wording P2 passes **vacuously** after the change: "≤ 1 invocation per protected row" is trivially true at 200 rows and 1 invocation. A condition that passes because its subject stopped running is not a pass. |
| **P3** | Re-stated: `authz.scope_reaches` invocations are bounded by `M` **per statement** on the converted read path; the `≤ M` per-protected-row bound still governs every unconverted path. | Same vacuity, same remedy. |
| **P7 — short-circuit shape** (NEW) | On the M1b plan: the policy's scope subplan must appear as a **`hashed SubPlan`** at **`loops=1`**, and the fallback arm's InitPlan must read **`never executed`**. ⛔ **AMENDED 2026-09-03 (QA review, MED-2) — P7 ships a NEGATIVE CONTROL, and run 6 was scored without one.** The same probe is re-run with the **pre-change predicate** installed in a rolled-back transaction — a shape that provably has no set subplan at all — and if it reports all three true *there*, it is measuring nothing and the run is **VOID**, not PASS (`scripts/authz-ae4-perf-harness.sql:1256-1263`). §12.6 property 3 asks exactly this of a new check: DC3b earned it (`0 → 1` foreign rows), P7's first form did not. First measured in §15.2 — live `[hashed=t,loops1=t,never=t]`, control `[hashed=f,loops1=f,never=f]`. ⚠ **§14's P7 PASS therefore stands as a bare positive**; §15.2's is the first P7 verdict with a discrimination half behind it. ⚠ **Scope bound (§16.2):** P7's `never executed` holds **only because M1b is org-filtered** — on the unfiltered M1-nested statement run 6 recorded the fallback executing four times. P7 bounds the outer structure, not row-independence, which is **P2a**'s job. | A policy that silently stopped short-circuiting — a planner change, a lost `CASE`, a widened candidate set — would pass the re-stated P2/P3 vacuously and surface only as a slow P5. This asserts the mechanism directly. |
| **P1 · P4 · P5** | **UNCHANGED.** `K = 4` is not moved. | ⛔ P5 has never rested on P1 and does not rest on this amendment either; the conditions are independent (§12.4). §8 item 5 licenses re-deriving a threshold only for a value within a few percent of it. |
| **DC2** | ⛔ **RE-AIMED, and re-aimed AFTER a failing reading — full record: §13.6.** DC2 keeps its question, its `≥ 5×` threshold and its meaning, and moves onto the **pre-change predicate** (harness label `DC2L/N=*`). The live N-differential is still printed, as evidence; it is no longer a verdict. | ⛔ **CORRECTED 2026-09-03 (QA review).** This row listed DC2 as `UNCHANGED` alongside P1/P4/P5, and that is the answer a reader who stops at the ruling table takes away — which is what a ruling table is for. §13.1 asked the amplification question of DC1 and never asked it of DC2; **run 6's first pass A answered it: DC2 read `1.15×` against `≥ 5×`** (`10 rows 6.590000 ms, 10000 rows 7.583000 ms`), a control FAIL, which under P6 VOIDs the run. The re-aim was ruled only after that reading. ⭐ It is the same mechanism as DC1's and **no threshold moved** — but the chronology is the opposite of this section's preamble, and stating it in the ruling table is the difference between a correction and a fudge. |

### 13.3 The P5 precondition still binds, and gains a reading

§6.2's P5 precondition — both arms must see the same rows through the org-filtered read — is
unchanged and is now *more* load-bearing, because the two arms take structurally different paths
through the same policy. ⚠ **A new reading hazard:** after the change the permission arm is expected
to be **cheaper than the legacy arm**, so P5's ratio falls far below 1. That is a pass, but it means
P5 has stopped discriminating in the direction it was written for. DC3 and P7, not P5's margin, are
what show the converted path is doing real work.

### 13.4 What this amendment does NOT do

- It does **not** touch the fixture, the measured principal, §4's proof, or the ablation in §3.
- It does **not** retire any run-1..5 verdict. Every table above §13 stands as measured, under the
  wording in force at the time.
- ⛔ It does **not** convert `professional_participants_select`. That policy stays per-row on
  purpose. ~~it is DC1's new subject, and converting it would take the re-aimed control away
  again.~~ ⛔ **STRUCK 2026-09-03 (ADR
  [0183](../decisions/0183-p2-invocation-count-respecification.md)): the reason was already dead
  when it was written.** §13.5 — *four lines below this one* — records that the re-aim onto
  `professional_participants_select` was measured and **killed** (the target is empty), and §13.2's
  DC1 row was rewritten to keep the legacy predicate instead. So this bullet's *conclusion* stands
  (the policy is not converted, and `FUP-PROFESSIONAL-PARTICIPANTS-SELECT-STILL-PER-ROW` tracks it)
  while its *reason* names a control that does not exist. Struck rather than deleted: a reader who
  met the claim elsewhere needs to find it retired, not absent.

### 13.5 A re-aim that was written, measured, and killed — recorded rather than quietly replaced

The first draft of §13.2 re-aimed DC1 onto **`professional_participants_select`**, on the reasoning
that it shares the same per-row authorizer, was deliberately left unconverted, and would therefore
still present the seam DC1 plants into. The reasoning was sound and the target was **empty**.

**Measured 2026-09-03, on a fresh `supabase db reset --local`:**

| relation | rows |
| --- | --- |
| `public.professional_participants` | **1** |
| `public.professional_profiles` | 1 |
| `public.participants` | 5 |

and `scripts/authz-ae4-perf-fixture.sql` **`analyze`s `public.professional_participants` without
ever inserting into it** — it scales `professional_profiles`, not the link table. So the re-aimed
DC1 would have planted into a chain invoked **once**, over a one-row protected population, and
reported some number. ⛔ *A control aimed at a table the fixture never fills is not a weak control;
it is a control measuring nothing, and it would have reported a ratio either way.*

This is the §6.2 fixture-gate hazard turned on the controls themselves: **a fixture that cannot
reach the failing state cannot produce a pass** — and the same is true of an instrument pointed
somewhere the fixture never went.

⚠ **Why the fixture was NOT extended instead.** Populating `professional_participants` at 10 000
rows is a §2 fixture change, and §2's bound is the `audit_log` row count being identical before and
after load and teardown. Growing the fixture to rescue a control is a larger and riskier change than
re-installing a predicate that already exists, and it would have to be justified on its own. The
residual is filed as `FUP-PROFESSIONAL-PARTICIPANTS-SELECT-STILL-PER-ROW`.

⛔ **What DC1 does and does not bound after this.** It bounds the **harness** — `pg_temp.ae4_time`
plus the 200-row statement can still resolve a ~50× plant. It does **not** bound the converted
path, because after `20261003007320` that path has almost no authorization cost left to attribute.
**DC3 (semantic ablation) and P7 (short-circuit shape) are what bound the converted path**, and
neither is a timing ratio — which is the point, since flattening the timing is the change itself.

### 13.6 DC2 fell to the same trap, and §13 missed it — found by RUNNING, not by reading

§13.1 reasoned carefully about DC1 and did not ask the same question of DC2. Run 6's first pass A
answered it anyway:

```
AE4 DC2: 10 rows 6.590000 ms, 10000 rows 7.583000 ms, ratio 1.15.
```

**DC2 FAILED at 1.15× against its `≥ 5×` threshold** — and it failed *because the change worked*.
DC2 asks whether the **fixture** scaled the work, and infers it from cost tracking the protected-row
count. Once the authorization answer is computed once per statement, cost stops tracking N by
design, so DC2's failure condition — *"either the fixture did not scale or the per-row evaluation is
not happening"* — now describes the intended state. Under §6.2 that fails P6 and VOIDs the run.

⭐ **This is the same structural trap as DC1's, one control further along, and reasoning did not
catch it — running did.** Recorded rather than folded silently into §13.2, because the lesson is
about the amendment's method, not about DC2: *a change that flattens a cost curve invalidates every
control that reads that curve, and they must be enumerated, not remembered.*

**Ruled, consistent with DC1:** DC2 keeps its question, its `≥ 5×` threshold and its meaning, and
moves onto the **pre-change predicate** (harness label `DC2L/N=*`). **P4 keeps the LIVE timings**,
because *"is growth in protected rows at worst linear"* is a question about the shipped path and is
answerable there — P4 read **1.11** against its `≤ 30`. The live N-differential is still printed as
evidence; it is no longer a verdict.

⛔ **The controls now split cleanly by what they can still see, and the split is the honest
statement of this run's coverage:**

| Control | Predicate it runs on | What it bounds |
| --- | --- | --- |
| DC1a / DC1b | pre-change | the **harness** can resolve a planted seam |
| DC2 (`DC2L`) | pre-change | the **fixture** scaled the protected-row population |
| DC3a | **live** | the `ELSE` arm **still grants** with the set arm emptied — a no-regression check on the **fallback**, ⛔ *not* a discrimination half |
| DC3b | **live** | the set arm is **consulted** and **load-bearing**, semantically — ⭐ the whole discrimination weight sits on this row |
| P7 | **live** | the short-circuit is **real** — uncorrelated subplan, fallback not reached |
| P4 · P5 | **live** | growth and relative cost on the shipped path |

⛔ **CORRECTED 2026-09-03 (QA review — the half of the DC3 finding the first correction pass
missed).** The first two rows were **one** row, `DC3a / DC3b`, credited jointly with *"the set arm
is consulted and load-bearing"*. DC3a shows no such thing: it shows the **fallback** still grants,
which is exactly what the harness's own message says of it — *"DC3a empty-set: own-org rows %s ->
%s (MUST NOT move: the ELSE arm still grants)"* versus *"DC3b over-broad: … (MUST become > 0: the
set arm is consulted and load-bearing)"* (`scripts/authz-ae4-perf-harness.sql:1203`). Crediting the
pair jointly made the one discrimination claim that bounds the converted path read as twice as
supported as it is. ⚠ DC3a is not thereby worthless — it is the check that the rewrite did not
**narrow** the policy — but it is a no-regression check, and it is the only one of the two that
could have been passed by a set arm nothing consults.

---

## 14. Run 6 (2026-09-03) — the first run against the statement-scoped path. **ACCEPTANCE MET.**

Subject: `20261003007320` (ADR [0182](../decisions/0182-statement-scoped-authorized-scope-ids.md)),
judged under the §13 amendment. ⛔ **CORRECTED 2026-09-03 (QA review): this sentence read
*"which was ruled and written **before** the run"*, and that is true of §§13.1–13.5 but NOT of
§13.6.** DC2's half of the trap was found by RUNNING pass A — the amendment's first draft reasoned
about DC1 and never asked the same question of DC2, which then failed at 1.15× against `≥ 5×`. So
one control was re-aimed **after** a failing reading, which is exactly the shape this document
exists to distrust, and it is stated here rather than left to §13.6 to disclose alone. What makes
it a correction and not a fudge is checkable: no threshold moved, the failing reading is recorded
as a failing reading, and the re-aim is the same mechanism DC1 already used. Fresh
`supabase db reset --local` at head `20261003007320`, full fixture reload, both passes.
`RESET=0 · LOAD=0 · PASSA=3 · PASSB=3 · P1PROBE=0` — each read from its own file.
⛔ The two 3s are the harness **working**: section 10 raises once at the end because P1/P2/P3 are
`UNRUN` in-process by design and are evaluated externally per §9.7.

| | pass A | pass B | run 5 | threshold | |
| --- | --- | --- | --- | --- | --- |
| DC1a `assignment_facts` | 1.60× | 1.63× | 1.58× / 1.68× | — | — |
| DC1b `scope_reaches` | 17.86× | 18.48× | 18.12× / 17.01× | ≥ 10 (either) | **PASS** |
| DC2 (pre-change predicate) | 685.91× | 684.38× | 704.31× / 686.08× | ≥ 5 | **PASS** |
| DC3a empty set — own-org rows | 10 000 → **10 000** @ 10 390 ms | 10 000 → **10 000** @ 10 487 ms | *(new)* | must NOT move | **PASS** |
| DC3b over-broad — foreign rows | 0 → **1** | 0 → **1** | *(new)* | must become > 0 | **PASS** |
| P4 | 1.16 | 1.16 | 9.30 / 9.43 | ≤ 30 | **PASS** |
| P5 | **0.00** (2.779 ms / 2 097.155 ms) | **0.00** (2.863 ms / 2 113.220 ms) | 5.28× / 4.99× | ≤ 4 | ⭐ **PASS** |
| P7 short-circuit shape | hashed=t, loops=1=t, never-executed=t | same | *(new)* | all three | **PASS** |

Externally, per §9.7 — stage 0 nested region **9 735** lines (≫ 1 000, so the extractor is live);
stage 1 presence `assignment_facts` **24**, `scope_reaches` **16**, `authorized_scope_ids` **1** —
all non-zero, so **not VOID**; only then the bounds:

| | Verdict | Evidence |
| --- | --- | --- |
| **P1** | **PASS** | `scripts/authz-ae4-p1-index-path.sql` exit **0**, and ⭐ **the bundled vacuity control FIRED** (`p1_noindex` → `Seq Scan` SURVIVES). All four chain tables CLEAR: `commissions` Index Scan · `hospitals` Index Only Scan · `memberships` Index Only Scan · `profiles` Index Scan. Raw census, reported as evidence: `memberships` 0 · `profiles` 0 · `commissions` 0 · **`hospitals` 161** (was 4 120). ⛔ Under P1's *retired* wording that is still a FAIL; ADR 0181 is what makes it a PASS, and both readings are stated. |
| **P2** | **PASS** | Segmented by named path: **M1-nested 7** `Function Scan on assignment_facts` nodes over **200 protected rows** — once per *statement*, not per row (was ~200). M2-nested 4, SEAM-nested 1, both unconverted and unchanged. **Every node `loops=1`**, all 12. |
| **P3** | **PASS** | **M1-nested 3** `Filter: authz.scope_reaches` nodes per statement, far inside the `M = 20` bound. M2-nested 4, SEAM-nested 1. |

### 14.1 What the run settles, and what it explicitly does not

**Settles.** The residue §12.4 localized is gone, and it was removed the way §12.4 predicted — by
changing `entailed_grants`' *invocation structure*, not `scope_reaches`. The permission arm went
**1 001 345 buffers / 12 178 ms → 402 buffers / 3.842 ms** on the identical statement over the
identical 10 000 rows, with the legacy arm unmoved at ~2 100 ms.
⛔ **CORRECTED 2026-09-03 (ADR [0183](../decisions/0183-p2-invocation-count-respecification.md)):
this read `402 buffers / ~2.8 ms`, which matches neither artifact and contradicted this section's
own table.** The coherent pair — same statement, same `explain (analyze, buffers)` node — is
`run6-passA.txt:340` (402 buffers) with `run6-passA.txt:348` (3.842 ms); the harness §7 best-of-5 on
the identical statement is **3.996 ms** (`run6-passA.txt:947`), which is the figure §15.2's P5 row already
carries. `~2.8 ms` is neither, and a buffers count paired with a latency from no stated apparatus
is the shape §14.1's own "does not settle" item 1 warns about. ⚠ **This does not contradict ADR
0182's `8.3 ms`** — that is a *different apparatus*, honestly labelled there: the pre-commit
candidate installed in a rolled-back transaction and read off EXPLAIN, not the shipped body under
the harness. DC3 is what makes that
attributable rather than merely fast: with the set builder emptied the row count is **unchanged**
(the `ELSE` arm still grants — the policy did not narrow) while cost returns to **10 390 ms**, and
with it over-broadened a **foreign-organization** row becomes visible. The set arm is therefore
consulted, load-bearing, and bounded.

**Does not settle.**
1. ⛔ **§8 item 2 still binds.** The fixture is fully cache-resident. This is plan-shape and
   invocation-count evidence, **not** a production latency prediction, and AE7's entry condition 2
   is a separate obligation.
2. ⚠ **P5 has stopped discriminating in the direction it was written for** (§13.3). At 0.00× the
   permission arm is ~750× *cheaper* than the legacy arm, so P5's margin is no longer informative
   about the converted path. **DC3 and P7 are what bound it**, and that is by design, not by
   accident.
3. **`professional_participants_select` is untouched and still per-row** —
   `FUP-PROFESSIONAL-PARTICIPANTS-SELECT-STILL-PER-ROW`.
4. **40 of 43 permissions remain `pending-rekey`** (§8 item 4). Unchanged.
5. The three new functions are **outside every sweep arm's domain by return type** and hold their
   verdicts from targeted mutation cases, not from an arm —
   `FUP-DOOR-SWEEP-DOMAIN-GAP-WIDENED-BY-SET-VALUED-RESOLVERS`.

### 14.2 K = 4 was not moved, and did not need to be

Eight readings across five runs failed P5 at 6.13 / 5.20 / 6.21 / 6.27 / 6.04 / 6.19 / 5.28 / 4.99.
⭐ **No threshold was re-derived, in either direction.** §8 item 5's licence — for a value landing
within a few percent of a threshold — was never invoked, and the two readings that came closest
(4.99, 25 % over) were recorded as FAIL and left as FAIL. The condition was met by removing the
cost, which is the only way it was ever going to be met honestly.

---

## 15. QA review of run 6 (2026-09-03) — CHANGES REQUESTED, corrected, and re-verified

QA reviewed the increment at `9f7fa68d` and returned **CHANGES REQUESTED**. It found **no privilege
escalation, no RLS hole and no regression** — it independently measured 520 cells / 37 principals /
11 hats / all 13 organizations in the self+hat context the policy actually uses and got **0
over-grants**, with 17 fallback-only grants confirming the `ELSE` arm is load-bearing. What it did
find was one real defect, one control missing its vacuity proof, two coverage claims thinner than
they read, and a record contradicting its own artifacts.

### 15.1 What was wrong, and what was done

| Finding | Correction |
| --- | --- |
| ⛔ **`app.current_professional_read_organizations` declared a `search_path` resolving to nothing it named.** `20261003007320` emitted it single-quoted, so ONE identifier, not a list: `current_schemas(true)` was `{pg_temp_N, pg_catalog}` against the sibling's `{pg_temp_N, app, public, pg_catalog}`. Latent (the body fully qualifies) but this is a DEFINER on the authorization path. | `20261003007330`. ⛔ **And pgTAP `413` PINNED THE DEFECT** — the expected `proconfig` was hand-typed from the broken catalog, so the suite would have reddened when someone fixed it. Repaired **structurally**: `413` now compares this function's `search_path` to its **sibling's**, plus a "contains no quote" check. Detail: ADR 0182 § Corrections. |
| **P7 had never been shown able to fail** — §12.6 property 3 requires exactly that of a new check. DC3b earned it (0 → 1); P7 did not. | P7 now runs its probe against the pre-change predicate (a shape with no set subplan) and **VOIDs the run if the probe reports PASS there**. Measured below. |
| **§13.2's DC3 ruling text was unsatisfiable** — it specified "empty set ⇒ 0 rows" while the implemented and scored control requires the row count NOT to move. Under P6 the written form would have VOIDed a passing run. | §13.2 corrected in place and labelled. The control itself was right throughout. |
| **§14 claimed the whole amendment predated the run**; §13.6 documents DC2's half was found by *running* pass A. | §14 corrected in place. One control **was** re-aimed after a failing reading, and that now says so where a reader meets it. |
| **The document header still declared the run-5 status.** | Header updated; the run-5 block is struck through, not deleted. |
| **`413` §5 — the subset invariant this rests on — ran over 2 rows × 1 principal**, with no non-vacuity guard (§2 had them; §5 did not). | §0 now seeds three profiles per organization; §5 sweeps **81 profiles × 41 principals** and §5b asserts both polarities are present (measured: 16 granting / 3 305 denying). |
| **`413` §2 exercises only 2 of the candidate map's 4 branches.** | ⭐ Not a test gap — measured against the live catalog, only two are reachable **anywhere**: `same-kind` (57 342 fact×permission pairs) and `commission→organization` (6 036). `commission→hospital` is unreachable because **no permission resolves at hospital scope** (0 of 43); `hospital→organization` because no hospital-scope membership holds a role entailing an organization-scope permission. Both mechanisms are now separately falsifiable assertions (`413` §2d/§2e), so the day either stops holding the suite says so. |
| **No authorising party was recorded anywhere**, though §12.4 requires this increment to carry "its own approval" and ADR 0181 set the precedent with a dated ruling. | ADR 0182 now carries a dated `**Approved:**` line naming what was approved and when. |

⚠ **One QA observation is corrected here.** The report flags the door-sweep read arm as the one
gate figure it could not confirm. That run was valid — it executed on the seed-only database
*before* the fixture load — but it is not reproducible while the fixture is loaded, which is what
QA hit. It was re-run on the fresh reset below.

### 15.2 Re-verification — every gate re-run, nothing inherited

⛔ **The pgTAP shape moved** (`Files=261, Tests=8733` → **`Tests=8738`**) when `413` gained five
assertions, so **all three targeted mutation verdicts were re-earned**, not carried over: a verdict
recorded at one shape is not a verdict at another. All three returned **COVERED** at the identical
new shape, restores byte-identical, ACLs unchanged. ⚠ The door's body md5 also moved with the
`search_path` fix (`a62e7809…` → `88a65e5b…`); both values are recorded in
`authz-unswept-backlog.txt` so a reader meeting either can tell staleness from tampering.

`RESET=0 · LOAD=0 · PASSA=3 · PASSB=3 · P1PROBE=0` · pgTAP `Files=261, Tests=8738` **PASS** ·
lint 12/12 **0** · typecheck **0** · `census`/`hat`/`floor`/`wrapper` all **0** ·
door-sweep read arm **CLEAN/COVERED**.
⛔ **BOTH ARMS, recorded 2026-09-04** — the line above named only the read arm, and this tree's rule
is that the sweep is TWO arms (`FUP-DIFF-SCOPED-SWEEP-IS-HALF-AIMED`). Re-run for
`professional_profiles_select` on a fresh reset at head `20261003007340` (re-review N3): read arm
**exit 0, CLEAN, COVERED**; **write arm `exit 3` = UNPROVEN — not a pass.** The write zero is
attributed by the harness itself (*"a SELECT policy has no write semantics"*, guard arm 0/13, policy
arm 0/107) and its domain is the **live catalog**, which is what separates it from ADR 0178's
write-arm zero — that one came off a 33-row snapshot and was an apparatus gap. Figures for both arms
live in `../progress/authz-ae4.md`.

| | pass A | pass B | threshold | |
| --- | --- | --- | --- | --- |
| DC1a / DC1b | 1.52× / **16.92×** | 1.74× / **18.30×** | ≥ 10 (either) | **PASS** |
| DC2 (pre-change predicate) | 802.29× | — | ≥ 5 | **PASS** |
| DC3a empty set — own-org rows | 10 000 → **10 000** @ 10 797 ms | same | must NOT move | **PASS** |
| DC3b over-broad — foreign rows | 0 → **1** | 0 → **1** | must become > 0 | **PASS** |
| P4 | 1.61 | 1.23 | ≤ 30 | **PASS** |
| P5 | **0.00** (3.996 / 2 391.518 ms) | **0.00** (3.023 / 2 165.509 ms) | ≤ 4 | **PASS** |
| **P7** | live `[hashed=t,loops1=t,never=t]`; ⭐ **CONTROL `[hashed=f,loops1=f,never=f]` — the probe is now proven able to return BOTH verdicts** | same | all three, control not all-true | **PASS** |

Externally per §9.7 — stage 0 **9 735** lines; presence `assignment_facts` **24**, `scope_reaches`
**16**; **P1 PASS** (probe exit 0, bundled vacuity control FIRED, all four chain tables CLEAR) ·
**P2 PASS** (M1-nested **7** nodes over 200 protected rows, all 12 `loops=1`) · **P3 PASS**
(M1-nested **3** filter nodes). ⛔ **K = 4 still not moved.**

### 15.3 The lesson worth keeping

Two of the four defects were **a test pinning what it should have measured**: `413` hand-typed a
`proconfig` string copied from a broken catalog, and P7 asserted a plan shape without ever showing
it could report the other answer. Both were green, and both were green for a reason unrelated to
the property. ⭐ *The repair in each case was to replace a literal with a comparison — ~~the
sibling's `search_path`~~, the pre-change predicate's plan — because a hand-typed expected value
cannot tell a defect from a design.*

⛔ **HALF OF THAT LESSON WAS REVERSED 2026-09-03, and the reversal is the sharper reading.** `413`
no longer compares `app.current_professional_read_organizations`' `search_path` to its **sibling's**;
it pins **both** siblings independently against the direct constant
`search_path=app, public, pg_catalog`, which is the house pattern (`341:222-225`, `393:241-244`,
`396:157-161`, `292:42-45`). Sibling-equality defines a *security* invariant as equality with a
**mutable object**: if both siblings drift to the same unsafe value it stays green, which is the one
outcome a `search_path` pin exists to catch. ⭐ What made the original defect a defect was copying a
constant **out of a broken catalog** — not the use of a constant. The remedy is to type the value
the migration is **required to emit**. The P7 half of the lesson (compare against the pre-change
predicate's plan) is untouched and still stands: there the reference is a *shape the code must not
have*, not a value it must keep. The class — rather than these two names — is swept by
`supabase/tests/414_definer_search_path_resolves.sql`; ⛔ do not grow a per-name list in `413`.

---

## 16. P2 re-specified — a falsifiable bound with a committed checker (2026-09-03) — ADR 0183

Subject: acceptance condition **P2**, as amended by §13.2 and as scored in run 6. This section
**replaces P2's wording and its instrument**; every run-1..6 verdict stands as measured, under the
wording in force at the time.

### 16.1 Why the §13.2 wording could not fail

§13.2 re-stated P2 as *"`authz.assignment_facts` is invoked **once per STATEMENT** on the converted
read path"* — the right property, for the right reason: the old *"≤ 1 per protected row"* form had
gone vacuous the moment the read stopped being per-row. But the **instrument** was left where it
was, at §9.7 stage 2:

```
grep -oE 'Function Scan on assignment_facts af .*loops=[0-9]+' | grep -oE 'loops=[0-9]+' | sort | uniq -c
```

That pipeline counts **`loops` values**, never the node count against a bound. Each nested
`has_permission` is a separate `SECURITY DEFINER` body and emits its own plan carrying its own node
at `loops=1`, so *"every node `loops=1`"* — the sentence run 6's PASS was justified with — is true
for **every** candidate count and cannot report the other answer. ⭐ **This is the second time P2
went vacuous the same way**: §13.2 re-specified the *condition* and left the *measurement* one level
down, where it went vacuous again. A condition and its instrument are re-specified together or not
at all.

The second half of the defect is scope. Run 6 recorded **7** invocations against a condition reading
"once per statement" and scored **PASS**. Decomposed against the committed artifact
(`authz-ae4-perf-run6-passB.txt`, M1-nested region = lines 857–5960):

| line(s) | caller | rows | P2's subject? |
| --- | --- | --- | --- |
| 2818 | the `candidate` CTE inside `authorized_scope_ids` | 20 (= M) | **yes** — the one resolver entry |
| 1820, 2746 | `entailed_grants`, the two candidate confirmations | 16 + 4 = 20 | **yes** — `U = 2` |
| 3822 | `entailed_grants` from the policy's **ELSE** arm | 0 | no |
| 4049, 4792, 5535 | `authz.holds_role` via `app.can_manage_professional` | 0 | no |

**3 of the 7 are the resolver (`1 + U`, `U = 2`, exactly as the structure predicts); 4 are its
neighbours.** Nothing was anomalous — M1-nested is `limit 200` **unfiltered**, so one row missed the
set arm and fell through to `app.can_read_professional_profile`. ⛔ The defect is that run 6's P2
evidence **counted off-path nodes into its subject**. *A criterion that cannot tell its own subject
from its neighbours is the same failure as one whose observable cannot move.*

⭐ **And this was not a borderline call — the harness forbids it in its own header.**
`scripts/authz-ae4-perf-harness.sql:41-44`, forty lines into the file that produced the evidence:

```
-- ⛔ NEVER `authz.holds_role` alone. It is not even ON this path: has_permission
--    reaches assignment_facts directly through entailed_grants. holds_role is
--    the layer-1 sibling used by app.is_staff_admin_of{,_for}. Measuring it
--    measures the pre-D6 world.
```

Three of the four off-path nodes are exactly that. So P2's PASS did not merely apply a criterion
that could not fail — it **broke a written rule sitting in the right place**, and neither the run's
own scoring, the internal QA review, nor the later external audit noticed. ⛔ That is the argument
for §16.2 being an executable checker rather than a better-worded grep: the rule already existed in
prose, in the correct file, and prose did not enforce it. It is also why §16.2's `§4` reports the
decomposition as **per-function invocation counters keyed by OID** rather than as node text scraped
from a plan — a counter attributed to `authz.holds_role`'s own OID cannot be read as the resolver's,
which is precisely the mistake the `loops=1` grep made possible.

### 16.2 The replacement

Let `A` = `authz.assignment_facts` invocations per statement, `U` = the **measured** number of
candidate confirmations the resolver performs, `N` = protected rows.

| | Condition | Read from | FAILS when |
| --- | --- | --- | --- |
| **P2 (bound)** | `A = 1 + U` on the converted path, with `authz.authorized_scope_ids` itself entered exactly **once** per statement | `scripts/authz-ae4-p2-invocation-count.sql` §3 (verdict) + the Pass B node census (evidence) | `A ≠ 1 + U` at either `N`, or the resolver was entered more than once. ⛔ The bundled §0 calibration and the §1/§2 controls must FIRE, or the run is **VOID**. |
| **P2a (row independence)** | `ΔA = 0` when `N` goes 200 → 400, measured on the **org-filtered** statement so the `ELSE` arm is `never executed` **by construction** — and that is asserted (`Δcan_read_professional_profile = 0`), not assumed | checker §2 | `A` moves with `N` — the resolver is being re-entered per row. **VOID** if the ELSE arm executed at all, because the count is then not about the resolver. |
| **P2b (the candidate slope)** | Planting candidate scopes gives `ΔA = ΔU`, with `ΔU` **measured**, never predicted from the number of memberships added | checker §1 | `ΔA ≠ ΔU`. ⛔ **Verdict precedence:** `ΔU > 0 ∧ ΔA = 0` is **VOID** (a dead instrument), never FAIL — collapsing the two loses the finding that matters. |
| **P2 scope** | P2's subject is the **resolver's own re-entry**. `holds_role` and `ELSE`-arm contributions are reported as a **decomposition** and are never folded into the count | checker §4 | The decomposition identity leaves a residual — reported as a **named unexplained term**, never absorbed. |

| | Amendment | Why |
| --- | --- | --- |
| **The instrument** | `pg_stat_get_function_calls(oid)` under a per-session `track_functions = 'all'`, keyed by **OID** via `::regprocedure`. | No text scraping, no queryid matching, no plan parsing — and it counts `has_permission` / `entailed_grants` / `holds_role` / `can_read_professional_profile` in the same pass, so §16.1's decomposition comes for free and becomes an assertion instead of a hand attribution. |
| **`U` is measured, not read off a plan** | `U` = `authz.has_permission` invocations attributable to the resolver, on the same counter. | ⛔ **`U` is NOT readable off the resolver's plan, and that is a catalog fact:** `authorized_scope_ids` is `SECURITY DEFINER` ⇒ never inlined ⇒ `EXPLAIN (ANALYZE)` stops at `Function Scan on authz.authorized_scope_ids`. The `candidate` / `Unique` nodes exist only in the auto_explain nested log (`passB.txt:2810-2814`) — which cannot carry an exit code and cannot attribute a node to its caller, *which is exactly how three `holds_role` nodes became P2 evidence*. It is also **not** the `SubPlan → ProjectSet rows=` reading (`passA.txt:342`): that is the **granted** count, a different quantity, and the checker's §1 arm C separates them by construction. And it is **not** a hand-copy of the resolver's candidate `CASE` — a harness holding a copy of production text is a duplicate no gate protects. |
| **Two controls, and they are different things** | **§0 liveness** (`Δ = 1` for one direct call over `M` rows) and **§1 discrimination** (the candidate differential). Both must fire. | ⭐ **§0 is a gate, not a formality.** For a `language sql` SRF, fmgr may be entered once per invocation or once per *row*; `Δ = M` means every number is inflated `M`-fold and is reported **VOID with a remedy**, never as a number. ⭐ And **measured 2026-09-03**: without a top-level `pg_stat_force_next_flush()` before each read the delta is **0** — a silent dead instrument, because pending function stats are invisible inside a transaction block and are not flushed immediately after one. §0 is what catches that. |
| **§1 carries a `ΔU = 0` arm and a non-authorizing arm** | A seat planted in an **already-proposed** organization must give `ΔU = 0 ∧ ΔA = 0`; a seat in a new organization in a **non-authorizing** role must give `ΔU > 0` while the **granted** count does not move. | Without the `ΔU = 0` arm, an instrument counting **facts** rather than **invocations** passes anyway — that arm is where the two disagree. Without the non-authorizing arm, the count is not shown to track **proposals** rather than **grants**, which is the whole content of "`1 + U`". A plant-only control measures the `INSERT`'s own trigger cost rather than assuming it is zero. |
| **§2 carries its own control** | With the **pre-change** per-row predicate installed in a rolled-back transaction, `ΔA` **must** differ between the two `N`; if it does not, §2 is VOID. | "`ΔA` is the same at both `N`" is precisely the shape that reads as a pass when nothing ran. Measured: control `ΔA` = **200 / 400**, live `ΔA` = **3 / 3**. |
| **P1 · P3 · P4 · P5 · P7 · DC1 · DC2 · DC3** | **UNCHANGED.** No threshold moves. | P2 is an invocation count, not a cost; nothing in it re-derives a latency or a ratio. |

⛔ **Do not fold P7 into this and do not rely on it here.** P7 bounds the *outer* structure on M1b,
and its `never executed` holds **only because M1b is org-filtered**. Run 6 is the proof of the gap:
on the unfiltered M1-nested statement the fallback *did* execute, four times. Row-independence
therefore belongs in **P2a**, not P7.

### 16.3 The checker

`scripts/authz-ae4-p2-invocation-count.sql`, beside P1's, same shape: `ON_ERROR_STOP on`, structured
extraction, **exit 0 = clear · exit 3 = FAIL, or a control did not fire (VOID)** via one
`raise exception` in a closing `do $verdict$`. ⛔ Read the exit code **directly**; a pipe erases it.
Layout: §0 calibration → §1 candidate differential (plant-only control + three arms + a coverage
requirement that **both** polarities actually occurred) → §2 `N`-differential with its
pre-change-predicate control → §3 the bound → §4 decomposition → postflight → verdict. Every
mutation runs inside `begin … rollback`; the postflight asserts that `memberships` / `profiles` /
`organizations` counts, the `professional_profiles_select` predicate and every body on the
`assignment_facts` chain are as the run found them. Function-call counters survive `ROLLBACK`, which
is what makes that possible.

§4 mechanizes §16.1's hand attribution as an identity over **every** catalog function that enters
`assignment_facts` —

```
ΔA = Δauthorized_scope_ids + Δentailed_grants + Δholds_role
       + Δcandidate_authorized_scope_ids + Δexplain_permission
```

— and the caller list is **checked against the catalog** rather than trusted, so a caller added later
makes the checker say so instead of silently producing a residual. On the same unfiltered `limit 200`
statement run 6 captured, this returns `A = 7 = 1 + 3 + 3 + 0 + 0`, **residual 0** — §16.1's table,
re-derived by machine.

**First run, 2026-09-03 (perf fixture loaded, exit 0):** calibration `Δ = 1` over `M = 20`; baseline
`A = 3, U = 2, granted = 2`; arms — *new org, authorizing* `ΔA = ΔU = 1` (granted 2 → 3),
*same org* `ΔA = ΔU = 0`, *new org, non-authorizing* `ΔA = ΔU = 1` (granted **unchanged**);
`N` 200 → 400 gives `ΔA` **3 → 3** with the ELSE arm at 0 calls, against a control at **200 → 400**.
⭐ **Every failure mode was forced and observed**, because a checker that has only ever printed CLEAR
is worth nothing: dropping the forced flush ⇒ §0 **VOID**; planting all three arms into
already-proposed organizations ⇒ §1 coverage **VOID** (*"the differential never fired"*, not PASS);
freezing the counter ⇒ §1 **VOID** *"DEAD INSTRUMENT, not a pass"*, with VOID outranking the FAILs it
also produces; and a resolver mutated to enter `assignment_facts` once more — in a rolled-back
transaction, derived from `pg_get_functiondef` so the mutation is not a hand-copy either — ⇒ §3
**FAIL** `A = 4, 1 + U = 3`. All four exited **3**; all four postflights passed and the fixture was
unmoved at `48 799 / 12 036 / 13`.

### 16.4 Run 6 is re-decomposable but **NOT re-scorable** — a fresh run is owed

Re-scoring run 6 under §16.2 was attempted before a re-run was proposed, and it provably fails. The
committed artifacts yield `U = 2`, `1 + U = 3` and the full seven-node attribution in §16.1 with **no
re-run at all** — that decomposition lands for free. What they cannot yield is a **verdict**, on four
independent counts:

| | The new wording needs | The artifacts hold |
| --- | --- | --- |
| i | an **org-filtered** nested capture (P2a) | M1-nested is `limit 200` **unfiltered**, so the ELSE arm contaminates it; M1b is org-filtered but carries no nested capture |
| ii | a **second `N`** | only `N = 200` exists |
| iii | the **candidate differential** and its `ΔU = 0` arm (P2b) | never run, in any form |
| iv | **any invocation counter** | `track_functions` was `none` for every run to date |

⇒ **P2 is `UNRUN` until run 7.** Run 6's P2 row stands as recorded — a PASS under the wording then in
force — and is **not** retroactively converted into a fail; what §16 retires is the wording and the
instrument, not the measurement. ⛔ And the run-6 ledger lines (§14, §15.2) carry no `P2PROBE`; they
must not be given one.

## 17. Run 7 (2026-09-03) — the first run scored under §16. **P2 MEASURED, and it PASSES.**

Subject: `20261003007320` + `20261003007330`, branch `authz-ae4-scope-reaches-fix`, judged under §16.
Fresh `supabase db reset --local` **run from the worktree under test** (see §7's ⛔ — a reset run from
the primary checkout left the stack at head `20261003007300` with `authz.authorized_scope_ids`
**absent**, and reported "clean"), full fixture reload, both passes, both committed checkers.
Run 6's artifacts were preserved as `authz-ae4-perf-run6-*.txt` **before** this run overwrote the
canonical pair — §7's other ⛔.

`RESET=0 · LOAD=0 · PASSA=3 · PASSB=3 · P1PROBE=0 · P2PROBE=0` — each read from its own file.
⛔ The two 3s are the harness working: section 10 raises because P1/P2/P3 are `UNRUN` in-process by
design. ⭐ This is the **first ledger line to carry `P2PROBE`**, per §16.4.

| | Verdict | Evidence |
| --- | --- | --- |
| **P1** | **PASS** | `scripts/authz-ae4-p1-index-path.sql` exit **0**; the bundled vacuity control FIRED; all four chain tables CLEAR. |
| **P2** | **PASS** | `scripts/authz-ae4-p2-invocation-count.sql` exit **0**. Calibration `Δ = 1` over `M = 20` (counts invocations, not rows). Differential fired in BOTH directions: `1a` new authorizing org `ΔA = +1, granted 2→3`; `1b` same org `ΔU = 0 ⇒ ΔA = 0`; **`1c` new NON-authorizing org `ΔA = +1` while `granted` stayed 2** — the count tracks PROPOSALS, not grants. N-differential control FIRED (`ΔA` 200/400 on the pre-change predicate) against live **3 / 3**. Bound `A = 1 + U` holds at both `N`. §4 decomposition closes with **residual 0**: `A = 7 = asi 1 + entailed_grants 3 + holds_role 3`. |

Full pgTAP on the same fresh reset, before the fixture was loaded: **`Files=262, Tests=8745, PASS`**
(run 6: `261 / 8738`; the deltas are `414`'s new file and its `plan(7)` — `413` is unchanged at 29,
which is the arithmetic confirming its 2-for-2 swap added no assertions). Lint **12/12**, tsc clean.

### 17.1 ⛔ The first attempt at run 7 VOIDed, and the reason is the point

Recorded rather than quietly replaced, per §13.5's precedent. The first execution returned
**`P2PROBE=3` — VOID, not FAIL**, on two controls: `§0 calibration` reported *"delta=, neither 1 nor
M. The instrument is not understood; no number below may be read"*, and `§1 coverage` reported *"the
differential never fired"*.

**Cause.** `pg_stat_get_function_calls(oid)` returns **NULL, not 0**, for a function with no stats
row yet. On a freshly reset stack under a per-session `track_functions = 'all'`, **nothing** has a
stats row when the baseline snapshot is taken, so every baseline read NULL and every delta computed
as `new - NULL` = NULL. Fixed with `coalesce(..., 0)` on all eleven counter reads.

⚠ **Why it survived development.** The checker had been run four times against a long-lived stack —
so the stats rows it needed had been created **by its own earlier runs**. The instrument only worked
once it had already been used. Re-running is the natural way to gain confidence in a probe and is
precisely the action that cannot find this: every run after the first is warm. ⛔ Note also that
`pg_stat_reset()` and `pg_stat_reset_single_function_counters()` are **permission denied even to
`postgres`** on Supabase, so the only route back to a cold instrument is a full `db reset` — budget
for it rather than skipping the test.

⭐ **What this says about §16.** A checker whose controls must FIRE reported VOID on its first cold
start instead of a confident PASS built on NULL deltas. The retired instrument — `every node
loops=1` — had no such control and would have reported the same PASS it always did. That is the
§16 argument, demonstrated on §16's own checker within a day of writing it.
