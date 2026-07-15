# A30 — `platform_admin` enumeration (ANALYSIS ONLY — for PO ruling)

**Author:** `backend` · **Date:** 2026-07-15 · **Branch:** `feat/authorization-capability-model` @ `7b11333`
**Stack:** local Supabase, fresh `db reset` (112 migrations + seed, incl. M1). All probes rolled back.
**Status:** awaiting PO ruling. **No SQL, no migration, no app code was written.**

---

## 0. Headline (read this first)

Three findings change the shape of the question the PO was asked to rule on.

1. **The "42" is inflated, and two of the brief's named contradictions do not exist.**
   `42 = 20 functions + 22 policies`. **Three of those 20 match only inside `--` comments** —
   comments that *document the arm's removal*. Text-matching `pg_proc.prosrc` counts comments.
   The real count is **40 sites** (see §1). Specifically, the brief's claim that
   **"Both confidentiality-ceiling helpers"** carry admin arms is **false as of this catalog** —
   `app.confidentiality_clearance_ok` and `app.attachment_confidentiality_ok` both contain only:
   > `-- ⟵ INFO-1: the is_admin() bypass is GONE. Clearance rides case_access ONLY.`
   The bypass was already removed. I flag this per the standing instruction to report
   contradictions with the prompt rather than work around them.

2. **CLAUDE.md §1 is much closer to true than 40 sites suggests.** Measured behaviourally,
   a `platform_admin` reads **0 of 7 `cases`, 0 of 13 `responses`, 0 of 6 `case_narratives`,
   0 of 1 `meetings`**, and is **hard-denied by grant** on `patient_identifiers`. The wall
   around tenant *content* genuinely holds. Most of the 40 are tenancy/config/vocabulary.

3. **The real defect is not read — it is a write/destroy-without-read asymmetry**, and I proved
   both by execution, not by predicate:
   - `platform_admin` **destroyed PHI it cannot read** — `referral_patient` 1 row → **0 rows**,
     `subject` → `[PHI removido]`, while `can_read_referral_phi` = `false` and
     `get_referral_patient` returns `NULL`.
   - `platform_admin` **wrote case content on a case it reads 0 rows of**
     (`set_case_offered_outcomes` → 1 `case_offered_outcomes` row).

---

## 1. Is this a population or a floor?

**Population, for the enumerated authority spellings** — with one caveat stated below.

I closed every spelling rather than filtering one arm name (M1's lesson):

| Spelling | Result |
| --- | --- |
| `app.is_admin()` calls | 17 functions (comments stripped) + 22 policies |
| `app.is_admin_for()` calls | **0 real callers — the function is dead code** (its only mention is a comment in `create_referral_draft` saying `…626000 correctly dropped is_admin_for`) |
| Raw JWT claim read directly | **`app.is_admin` is the ONLY reader** of `request.jwt.claims` → the claim cannot be reached around the helper |
| `profiles.is_admin` column read directly | 6 functions; 5 are non-arms (definitions/insert/CHECK/negative filter), **1 is a real arm the `is_admin()` text filter MISSES** → `guard_profile_privileged_columns` |
| `is_platform_admin*` / `superuser*` | do not exist |
| Wrapper class (transitive closure, depth ≤ 5) | 177 rows — **but ~100 flow through `app.audit_write`, which is NOT an arm** (§2) |
| **Storage** policies | **19 policies, ZERO admin arms — Storage is clean** |
| Triggers | every `trg_audit_*` reaches `is_admin` only via `audit_write` attribution; **no trigger has its own arm** |
| ACLs / `relacl` | only `supabase_auth_admin=r` on `profiles` (that is GoTrue, not `platform_admin`) — **no admin-related grants** |

**Caveat (the honest floor):** this is a population over *`is_admin`-derived* authority. A path that
conferred platform reach under an entirely different name (e.g. a bespoke role check) would not be
caught by any of the above. I found no evidence of one — `profiles.is_admin` and the JWT claim are
the only two sources of the authority, and both funnel through `app.is_admin`. I therefore state this
as a **population with a single named residual**, not a bare floor.

**Name traps resolved (do not classify by name):**
- `app.can_read_case_or_admin` — the "admin" is **`commission_admin`**, not `platform_admin`. **No platform arm.**
- `app.attachment_confidentiality_ok` / `confidentiality_clearance_ok` — comment-only. **No arm.**

**Already settled, noted once and dropped:** the JWT arm is **not forgeable** —
`custom_access_token_hook` (verified `SECURITY DEFINER`, reads `profiles.is_admin`) mints it
server-side; it is a cache. The only residual is **staleness** (revoked admin keeps the claim until
refresh) → already post-pilot backlog (session revocation). Not re-litigated.

---

## 2. The distinction that collapses most of the closure

`app.audit_write` calls `app.is_admin()` **only to stamp `audit_log.actor_is_admin`**:

```
v_actor_is_admin := coalesce(app.is_admin(), false);
... insert into audit_log (..., actor_id, actor_is_admin, ...)
```

That is **attribution, not authorization**. It gates nothing. Every `trg_audit_*` trigger and ~100
RPCs inherit it transitively and are **false positives** for "admin authority". Counting the naive
closure would have reported ~177 "sites" and buried the 5 that matter.

Likewise `public.log_audit_access` is a **logger**, not a door: the PHI getters
(`get_event_patient`, `get_referral_patient`, `get_case_patient`) **re-gate independently** with
`app.can_read_*` — none of which has an admin arm — *before* calling it. `_audit_access_authorized`'s
admin arm therefore authorizes *recording* an access, never returning data. Verified behaviourally
(`get_referral_patient` → `NULL` for a `platform_admin`).

---

## 3. The 4-bucket inventory (40 sites)

**Counts: A = 26 · B = 7 · C = 5 · D = 1 · not-an-arm = 1.**

### Bucket A — legitimate platform administration (KEEP) — 26

Cross-tenant infrastructure the product genuinely needs. **Removing these breaks real platform surface**
(this is the over-reach risk the brief flags for keystone 23).

| Object | Kind | `prosecdef` | Reaches | Breaks if removed |
| --- | --- | --- | --- | --- |
| `organizations_admin_write` / `organizations_select` | policy | — | tenancy root | **Onboarding a new organization becomes impossible.** No one else can create an org. |
| `commissions_admin_write` | policy | — | tenancy | platform-side commission provisioning / support fixes |
| `hospitals_select` / `hospitals_write` | policy | — | tenancy | hospital provisioning |
| `hospital_departments_select` | policy | — | tenancy config | support visibility |
| `profiles_admin_insert` / `_select` / `_update` | policy | — | user directory | **user administration / support**; `_insert` backs `handle_new_user` |
| `memberships_select` | policy | — | who-is-in-what | support diagnosis of access problems |
| `audit_log_select` | policy | — | **narrow: `organization_id IS NULL AND commission_id IS NULL`** — platform-level rows only | platform audit review. **Well-designed — already scoped away from tenant rows.** |
| `case_types_*` ×2, `case_type_terminology_*` ×2, `case_participant_roles_*` ×2, `referral_types_write_admin`, `reply_outcomes_write_admin`, `professional_categories_admin_write` | policy | — | **vocabulary/config**, not content | seeding + maintaining platform-default vocabularies |
| `participants_select` (admin arm) — *see D* | policy | — | pseudonymous | — |
| `app.can_curate_pqs_vocab` | helper | `t` | **`p_hospital_id IS NULL` → platform-scope vocab only** | platform-default PQS vocabulary curation. Arm is *correctly* narrowed to the platform scope. |
| `public.grant_role` / `revoke_role` | RPC | `t` | memberships | **bootstrapping the first `org_admin`** — without it a new tenant has no admin |
| `public.verify_audit_chain` | RPC | `t` | hash chain integrity | platform integrity tooling (Rule 11) |
| `app._audit_access_authorized` | helper | `t` | authorizes *logging*, never data (§2) | admin's own access could not be audit-recorded |
| `guard_profile_privileged_columns` | trigger fn | `t` | gates `is_admin`/`is_active` changes | **This is a PROTECTION, not a grant** — it is the arm that stops non-admins escalating. Removing it *widens*. |

### Bucket B — tenant data, non-PHI (contradicts CLAUDE.md §1) — 7

| Object | Kind | `prosecdef` | Reaches | Breaks if removed |
| --- | --- | --- | --- | --- |
| `public.set_case_offered_outcomes` | RPC | `t` | **case content (write)** | nothing user-facing. **`qa`'s A0 finding — PROVEN: writes a case it reads 0 rows of.** |
| `public.create_case` | RPC | `t` | creates a case in **any** commission | nothing user-facing |
| `public.dashboard_distributions` | RPC | `t` | tenant response aggregates | nothing user-facing |
| `public.dashboard_export_rows` | RPC | `t` | **tenant response rows (export)** | nothing user-facing. Widest bucket-B *read*. |
| `public.hospital_document_register` | RPC | `t` | `controlled_documents` across a hospital | nothing user-facing |
| `public.hospital_indicator_rollup` | RPC | `t` | `indicators` + `indicator_measurements` | nothing user-facing |
| `public.list_approver_candidates` | RPC | `t` | user lists | nothing user-facing |

**Note the asymmetry:** the RLS on `cases`/`responses` has **no** admin arm (measured: 0 rows), yet these
`SECURITY DEFINER` RPCs reach the same data *around* that RLS. The wall exists; these are doors cut in it.

### Bucket C — tenant PHI (Rule 12) — 5

| Object | Kind | `prosecdef` | Reaches | Breaks if removed |
| --- | --- | --- | --- | --- |
| **`public.dispose_referral_phi`** | RPC | `t` | **DESTROYS `referral_patient` + redacts subject/messages/attachments** | **Nothing.** The 4 sibling disposal RPCs (`dispose_case_phi`, `dispose_event_phi`, `dispose_attachment_phi`, `dispose_meeting_minutes`) have **NO admin arm**. This one is the **lone outlier** — strong evidence of accident, not design. |
| **`public.can_dispose_referral_phi`** | helper | `t` | the predicate mirroring the above | the UI affordance only |
| `app.can_read_professional_profile` | helper | `t` | **Class-2 professional identity** — `full_name`, `license_number`, `license_region`, `specialty` (measured: **1 of 1** profiles, cross-tenant) | admin support on professional records. Read **is** audited (`professional_profile.read`). |
| `app.can_manage_professional` | helper | `t` | **writes** Class-2 professional records cross-tenant | platform-side professional-record fixes |
| `professional_credentials_select` | policy | — | **`registration_number`** (council registration), cross-tenant | support visibility |

**Class note:** all 5 are **Class-2 professional identity** or **referral PHI destruction**. **No arm anywhere
reads Class-1 patient PHI** — `event_patient`, `referral_patient`, `case_patient` and `patient_identifiers`
have no admin arm, and `patient_identifiers` is denied to `authenticated` by grant. The single audited
door holds on read. **The breach is destruction, not disclosure.**

### Bucket D — needs a domain judgement — 1

| Object | Question for the PO |
| --- | --- |
| `participants_select` (admin arm) | `participants.sensitivity_class = 'patient_phi'` and `participant_type='patient'`, but `display_name` is a **pseudonym by convention** (seed: `"Paciente"`). **Is the pseudonym enforced, or merely conventional?** If a user can type a real patient name into `display_name`, this arm becomes a cross-tenant PHI read (bucket C). If enforced, it is bucket B (pseudonymous label). I could not find an enforcing constraint. **This is a general design question the admin arm merely exposes** — it affects every org member too (`is_org_member(...) OR is_admin()`). |

### Not an authority arm — 1

`app.audit_write` — stamps `actor_is_admin` (§2). **Do not touch:** removing it destroys Rule 11 attribution.

---

## 4. The four answers

### Q1 — Is CLAUDE.md §1 simply false as written?

**The doc is what needs amending — but it is a small amendment, not a capitulation.**

"Walled off from all tenant data" is **false as an absolute** (12 sites contradict it: B=7 + C=5). But it is
**substantially true as a description of reads of tenant content** — measured, `platform_admin` reads 0
cases, 0 responses, 0 narratives, 0 meetings, 0 patient identifiers. The other 26 sites are **not tenant
data at all** — they are tenancy structure, the user directory, platform vocabulary, and platform audit.

So this is **not** "a rule contradicted 42 times is the wrong rule". It is a rule stated too absolutely,
whose *spirit* the schema largely honours, with **12 genuine violations of which 5 are the real problem**.
The rule earned its keep — it is why `cases` and `responses` have no admin arm.

**Recommended wording:**

> `platform_admin` — global superuser for **platform operations**: tenancy (organizations, hospitals,
> commissions), the user directory and role grants, platform-default vocabularies, and the
> platform-scoped audit trail. It is **walled off from tenant content** — cases, responses, meetings,
> narratives, and **all patient PHI**, which it can neither read nor write. Any `platform_admin` arm on
> tenant content or PHI is a **bug**, not a feature.

That wording is enforceable, matches the catalog for 26 of 40 sites, and turns the remaining 12 into
tracked defects rather than an unresolvable doc-vs-code standoff.

### Q2 — Minimum fix for the bucket-C (PHI) exposure, and its cost

**Minimum fix = delete 2 admin arms. Roughly 6 lines of SQL. Cost: near zero.**

1. `public.dispose_referral_phi` — drop `app.is_admin() or` from the gate.
2. `public.can_dispose_referral_phi` — drop `app.is_admin() or` from the predicate.

**Cost:** *nothing breaks.* The 4 sibling disposal RPCs already work without an admin arm, so the
remaining grantees (`is_commission_admin_of` source, `is_pqs_operator_of` source/target) are the
already-proven, already-shipped disposal population. This **removes the sharpest class in the brief**:
an actor who cannot read the data can annihilate it. It also makes the disposal family **internally
consistent** — 5 of 5 with no admin arm, instead of 4 of 5.

**Deliberately NOT in the minimum fix** (they need the PO's call, and over-reach breaks keystone 23):
- `can_read_professional_profile` / `can_manage_professional` / `professional_credentials_select` are
  **Class-2, not Class-1**, the read is **audited**, and platform support on professional records may be
  a genuine requirement. Removing these is a **product decision**, not a safety necessity.

### Q3 — Is there a bright line?

**A usable bright line exists, but the mechanical version the brief proposes does not survive contact.**

The proposed *"platform_admin never touches a table with a `commission_id`/PHI column"* **fails**: it would
strike `commissions_admin_write` and `memberships_select` (both carry `commission_id`) and thereby break
**tenant onboarding and the `org_admin` bootstrap** — exactly the over-reach that fails keystone 23. It
also *misses* `professional_credentials` and `professional_profiles`, which have **no `commission_id` column**
yet are the Class-2 exposure.

**The line that does hold — rule on the noun, not the column:**

> `platform_admin` may act on **tenancy, identity, vocabulary, and platform audit**.
> It may **never** act on **content produced inside a commission** (cases, responses, narratives,
> meetings, indicators, documents) or on **any PHI — read or write or destroy**.

This is mechanical enough to apply per-table and it classifies **39 of 40** sites unambiguously (the
lone exception is bucket D). It is also **already how the RLS was built** — which is why `cases` and
`responses` have no arm. Under this line the outstanding defects are exactly B(7) + C(5), and bucket A
survives intact.

**Residual case-by-case:** only bucket D, and only because of a pseudonym convention that is not
enforced by a constraint.

### Q4 — Sequencing

**Recommendation: take the 2-line bucket-C `dispose_referral_phi` fix in the NEXT migration (before
the resolver). Defer B, the Class-2 arms, and D to after Gate 1.**

**The trade-off, stated plainly:**

*For sooner:* it is **PHI destruction** (Rule 12, irreversible, and LGPD/CFM-1821 20-yr-retention
territory — an unauthorized disposal is a *retention* violation, not just an access one). The fix is
2 arms, has **zero blast radius** (4 siblings already prove the shape), and needs no resolver. It is
also the one item where waiting has an asymmetric downside: every other bucket-C item is a *read* that
is *audited*; this one is silent, permanent data loss.

*For later (the scope fence):* A30 was chartered as analysis, the resolver is the program's spine, and
this program has repeatedly been saved by not widening scope mid-flight.

**Why sooner wins here, narrowly:** the fence exists to stop *speculative* work leaking into the
resolver. This is not speculative — it is a proven, executed destruction of PHI by an actor who cannot
read it, and the fix is *subtractive* (removing an arm), so it cannot conflict with the resolver, which
only ever *adds* a capability path. A subtractive 2-line fix has no merge surface.

**But B and Class-2 must wait**, because those are genuine product judgements about what platform support
needs to do, and getting them wrong breaks legitimate surface — the exact failure mode keystone 23 guards.

**⚠ Sequencing caveat for whoever implements:** any change here is a **behavioural narrowing**. Per the
program's own lesson (*a no-regression claim needs an over-grant twin*), the test must assert that the
**non-admin disposal population still disposes** — a test that only asserts "admin can no longer dispose"
passes by construction and proves nothing.

---

## 5. Reproducible SQL

```sql
-- (1) Real is_admin() call sites — COMMENTS STRIPPED (the correction that matters).
--     Without the regexp_replace this over-reports by 3.
with stripped as (
  select n.nspname||'.'||p.proname as fn, p.prosecdef,
         regexp_replace(p.prosrc, '--[^\n]*', '', 'g') as src
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public','app','storage')
)
select fn, prosecdef from stripped where src ~* '\mis_admin\s*\(' order by 1;   -- 17

-- (2) Policies (pg_policies stores PARSED expressions — no comment risk).
select schemaname||'.'||tablename, policyname, cmd, qual, with_check
from pg_policies
where coalesce(qual,'')||coalesce(with_check,'') ~* 'is_admin' order by 1,2;    -- 22

-- (3) Storage policies: expect ZERO admin arms.
select policyname, qual, with_check from pg_policies where schemaname = 'storage';  -- 19, none

-- (4) Close the spelling: the ONLY reader of the raw JWT claim must be app.is_admin.
select n.nspname||'.'||p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public','app','storage')
  and regexp_replace(p.prosrc,'--[^\n]*','','g') ~* 'jwt.claims';               -- app.is_admin only

-- (5) Direct profiles.is_admin readers (finds guard_profile_privileged_columns,
--     which the is_admin() text filter MISSES).
select p.proname, m[1] from pg_proc p join pg_namespace n on n.oid = p.pronamespace,
lateral regexp_matches(regexp_replace(p.prosrc,'--[^\n]*','','g'), '([^\n]*is_admin[^\n]*)','g') m
where n.nspname = 'public';

-- (6) ACL sweep.
select c.relname, c.relacl::text from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relacl::text ~* 'admin';   -- supabase_auth_admin (GoTrue) only
```

### Behavioural probes (all rolled back — assert ROWS, never a predicate's return)

```sql
-- PROBE A — platform_admin DESTROYS PHI it cannot read.  RESULT: 1 row -> 0 rows.
begin;
  select count(*) from public.referral_patient where referral_id='efa00000-0000-0000-0000-0000000000a1'; -- 1
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b0","role":"authenticated","is_admin":true}';
  select app.can_read_referral_phi('efa00000-0000-0000-0000-0000000000a1', auth.uid());  -- FALSE  (cannot read)
  select public.get_referral_patient('efa00000-0000-0000-0000-0000000000a1');            -- NULL   (cannot read)
  select public.dispose_referral_phi('efa00000-0000-0000-0000-0000000000a1','entered_in_error');  -- SUCCEEDS
  reset role;
  select count(*) from public.referral_patient where referral_id='efa00000-0000-0000-0000-0000000000a1'; -- 0  ← DESTROYED
  select subject, phi_disposed_by from public.case_referral where id='efa00000-0000-0000-0000-0000000000a1';
  -- '[PHI removido]' | 00000000-...-b0
rollback;

-- PROBE B — the wall around tenant CONTENT holds (this is what saves CLAUDE.md §1).
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b0","role":"authenticated","is_admin":true}';
  select count(*) from public.cases;                 -- 0 of 7
  select count(*) from public.responses;             -- 0 of 13
  select count(*) from public.case_narratives;       -- 0 of 6
  select count(*) from public.meetings;              -- 0 of 1
  select count(*) from public.organizations;         -- 2 of 2   (bucket A, intended)
  select count(*) from public.professional_profiles; -- 1 of 1   ← bucket C (Class-2)
  select count(*) from public.patient_identifiers;   -- ERROR 42501: permission denied (grant-level door)
rollback;

-- PROBE C — qa's A0 finding: writes case content it reads 0 rows of.
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b0","role":"authenticated","is_admin":true}';
  select count(*) from public.cases where id='d0000000-0000-0000-0000-0000000000c1';  -- 0  (cannot read)
  select public.set_case_offered_outcomes('d0000000-0000-0000-0000-0000000000c1',
         array['e1000000-0000-0000-0000-0000000000d1']::uuid[]);                      -- SUCCEEDS
  reset role;
  select count(*) from public.case_offered_outcomes where case_id='d0000000-0000-0000-0000-0000000000c1'; -- 1 ← WROTE
rollback;
```

---

## 6. For the PO to rule on

1. **Adopt the amended CLAUDE.md §1 wording** (Q1)? → turns 12 sites into tracked defects.
2. **Adopt the "tenancy/identity/vocabulary/audit vs. commission content + PHI" bright line** (Q3)?
   → classifies 39/40 mechanically. **Reject the `commission_id`-column version — it breaks onboarding.**
3. **Take the 2-arm `dispose_referral_phi` fix in the next migration** (Q4)? → subtractive, zero blast radius.
4. **Bucket D:** is `participants.display_name` guaranteed pseudonymous, or must it be constrained?
5. **Class-2 (3 sites):** does platform support legitimately need cross-tenant professional records?
   → **product decision.** Reads are audited; this is not a safety necessity.
6. **Dead code:** `app.is_admin_for` has zero real callers — drop it? (housekeeping, not a finding)
