# AE3.1 — Reader/writer census for the restricted personal-detail extraction

- **Task:** AE3.1 of [`docs/plans/authz-evolution.md`](../plans/authz-evolution.md) § *Phase AE3*
  (authority: ADR [0155](../decisions/0155-post-aff4-tenancy-and-person-model-evolution-sequence.md) D4).
- **Measured:** 2026-08-31 (UTC).
- **Instrument:** [`scripts/authz-census-ae3.sql`](../../scripts/authz-census-ae3.sql) — read-only,
  block-numbered, `ON_ERROR_STOP=1`, exit 0. Every figure below cites the block that derives it.
- **Stack measured:**

  | stack | head | migrations registered | server | how reached |
  | --- | --- | --- | --- | --- |
  | local | `20261003006500` | 496 | PostgreSQL 17.6 | `docker exec supabase_db_azkbbhskturikxpgmafq psql` |
  | linked remote (`azkbbhskturikxpgmafq`) | `20261003006500` | 496 | — | Supabase MCP `execute_sql`, SELECT only |

  **Both stacks at the SAME head.** Derivation: `select max(version), count(*) from
  supabase_migrations.schema_migrations`. Parity of the AE3 subject itself is measured in
  § *Local/remote parity*, not inferred from the head matching.

- **Purpose:** close the set of everything touching `profiles.cpf` / `.date_of_birth` / `.phone`
  **before any DDL is written**. A consumer missed here becomes a runtime break at the column
  `DROP`, not a test failure — `.select('…')` is a runtime string and `.maybeSingle<T>()` is an
  assertion, so neither `tsc` nor vitest can see the seam.

> **How to read this file.** A number is admissible only with its predicate. The census is
> deliberately run at **two bounds** (wide/unanchored and narrow/word-bounded) and the
> **difference between them is reported as a ruling set**, never collapsed to either bound —
> collapsing is how a census under-reports. Every exclusion below is a **written verdict**, not
> the query's silence.

---

## 0. The scope trap this census is built around

`cpf`, `date_of_birth` and `phone` are **not unique to `profiles`**. Block 3's own catalog sweep
of every table column in `public` / `app` / `authz` returns **seven** columns across **five**
tables:

| column | class | in AE3 scope? |
| --- | --- | --- |
| `public.profiles.cpf` | person identity | ✅ **the subject** |
| `public.profiles.date_of_birth` | person identity | ✅ **the subject** |
| `public.profiles.phone` | person identity | ✅ **the subject** |
| `public.professional_profiles.cpf` | **Class-2 professional identity** (ADR 0064/0065) | ⛔ **no** |
| `public.event_patient.date_of_birth` | **Class-1 patient PHI** (Rule 12) | ⛔ **no** |
| `public.referral_patient.date_of_birth` | **Class-1 patient PHI** (Rule 12) | ⛔ **no** |
| `public.patient_identifiers.date_of_birth` | **Class-1 patient PHI** (Rule 12) | ⛔ **no** |

⛔ **Consequence, stated so it cannot be lost: after AE3 ships, "CPF lives in one place" is
FALSE.** `professional_profiles.cpf` is a second, independently-governed CPF column that AE3 does
not move and must not touch. Any AE3 close-out sentence claiming CPF consolidation is a
[wrong-grain predicate](../../.claude/rules) and must be written as *"the **profiles** CPF moves"*.

This is why blocks 3d/3e exist: 3a/3b answer *"names a token"*, which is **not** AE3's question.
AE3's question is *"touches `profiles`.{cpf,date_of_birth,phone}"*.

---

## 1. The three columns as they exist today (block 1)

| column | type | not null | default | identity/generated |
| --- | --- | --- | --- | --- |
| `cpf` | `text` | no | — | none |
| `date_of_birth` | `date` | no | — | none |
| `phone` | `text` | no | — | none |

All three are plain nullable columns. Nothing is generated, defaulted, or an identity column —
so the backfill is a straight `insert … select` with no expression to reproduce.

## 2. Constraints and indexes that MOVE, not get re-invented (block 2)

| object | kind | definition |
| --- | --- | --- |
| `profiles_cpf_valid` | CHECK | `CHECK (((cpf IS NULL) OR app.is_valid_cpf(cpf)))` |
| `profiles_cpf_key` | UNIQUE, **PARTIAL** | `CREATE UNIQUE INDEX profiles_cpf_key ON public.profiles USING btree (cpf) WHERE (cpf IS NOT NULL)` |

⚠ **Two traps in these two rows:**

1. The unique index is **partial** (`WHERE cpf IS NOT NULL`). A re-typed
   `cpf text unique` on the destination is **not** the same constraint — it would still permit
   multiple NULLs in Postgres, so the observable behaviour coincides *by accident*, but the index
   shape, its name, and its `EXPLAIN` plan all change. Move the `CREATE UNIQUE INDEX` statement
   verbatim.
2. The CHECK calls **`app.is_valid_cpf(text)`** — an `app`-schema function (INVOKER, block 3c).
   The destination table's CHECK must call the same function, not a copy. `is_valid_cpf` itself
   needs **no change** and is **not** a consumer of the column.

## 3. SQL consumers — the qualifying set (block 3d)

**Five** objects name a restricted token *and* name `profiles`. All five are `SECURITY DEFINER`,
which is consistent with §7's finding that `authenticated` cannot reach the columns at all.

| # | object | kind | tokens | role in AE3 |
| --- | --- | --- | --- | --- |
| 1 | `app.finalize_invited_person_impl` | DEFINER kernel | cpf, dob, phone | **WRITER** — re-point to the new table |
| 2 | `app.update_person_fields_impl` | DEFINER kernel | cpf, dob, phone | **WRITER** — re-point (carries the `cpf_change` arm) |
| 3 | `public.get_own_person_record` | DEFINER door | cpf, dob, phone | **READER (self)** — re-point |
| 4 | `public.guard_profile_privileged_columns` | DEFINER **trigger** | cpf, dob, phone | **IDENTITY HALF RETIRES**; lifecycle half stays |
| 5 | `public.list_org_people` | DEFINER door | cpf, dob | **READER (admin roster + CPF probe)** — re-point |

The two `_impl` kernels are AE1.3's shape (thin `public.*_for` wrapper over an `app.*_impl`
kernel). Their public wrappers — `public.update_person_fields_for`,
`public.finalize_invited_person_for` — appear only in the **wide** bound (block 3c) because they
name the tokens **as parameter names only** (`p_cpf`, `p_set_cpf`, …) and pass them through. They
still change if a signature changes; they do **not** change for a table move.

### 3b. The ruling set — wide-but-not-narrow (block 3c), each with a verdict

| object | composed identifiers | verdict |
| --- | --- | --- |
| `app.can_administer_person_for` | `cpf_change` | **NOT a column consumer.** It is the *authority predicate* for the CPF-change capability. Unchanged by the move — but AE3.3's keystone neutralizes **this** gate. |
| `app.is_valid_cpf` | `p_cpf` | **NOT a consumer** — the CHECK's validator (see §2). Unchanged. |
| `app.affiliate_{new_,}person_impl`, `app.update_affiliation_impl`, `app.trg_audit_hospital_affiliations`, `public.affiliate_person{,_for}`, `public.affiliate_new_person_for`, `public.update_affiliation{,_for}` | `work_phone`, `p_work_phone`, `v_wphone`, `p_clear_work_phone` | **OUT OF SCOPE.** `work_phone` is a column of `hospital_affiliations`, not `profiles.phone`. |
| `public.save_referral_patient`, `public.set_case_patient`, `public.set_participant_patient` | `p_date_of_birth` | **OUT OF SCOPE** — Class-1 patient PHI parameters (§0). |
| `public.update_person_fields_for`, `public.finalize_invited_person_for` | `p_cpf`, `p_date_of_birth`, `p_phone`, `p_set_*` | **Pass-through wrappers** over rows 1–2 above. No table reference of their own. |

### 3c. Excluded — names a token, does not name `profiles` (block 3e), each with a verdict

Twelve objects. Nine are Class-1 patient-PHI `date_of_birth` handlers (§0) and are dismissed as a
class. The **three that needed reading**, because a substring alone could not decide them:

| object | matched line | verdict |
| --- | --- | --- |
| `public.issue_ethics_notification` | `p_delivery_method not in ('email','letter','in_person','system','phone','other')` | **OUT OF SCOPE.** `'phone'` is a *delivery-method enum value* rendered as `telefone`. No column involved. |
| `public.log_cpf_probe_for` | `'person.cpf_lookup', 'organization', p_org_id, …` | **OUT OF SCOPE as a column consumer** — it writes an `audit_log` row and never reads `profiles.cpf`. ⚠ **But the plan binds its semantics:** AE3.3 must assert the `person.cpf_lookup` event still fires **exactly once** after the move. Not-a-consumer ≠ not-an-obligation. |
| `public.redact_professional_profile` | `cpf = null,` | **OUT OF SCOPE.** Its `update` targets `public.professional_profiles` (confirmed by reading its statement list), which has its **own** `cpf` column — §0. ⛔ A sweep that moved "the cpf column" would break this. |

## 4. RLS policies (block 4) — **zero**

No policy in any schema names `cpf`, `date_of_birth` or `phone` in either `qual` or `with_check`.
Reported separately because `USING` and `WITH CHECK` answer different questions; both are empty.

**Consequence:** the columns' confidentiality today rests on **grants** (§7) and **DEFINER doors**
(§3), *not* on RLS. AE3's destination table therefore cannot inherit protection from a policy that
does not exist — it must be built door-only and asserted as such.

## 5. Views and materialized views (block 5) — **zero, on both instruments**

- **5a (by text):** no view definition names a token.
- **5b (by catalog dependency, the authoritative half):** no `pg_rewrite` entry depends on any of
  the three columns.

The second query is the load-bearing one: text misses `select *`, dependency does not. Recording
only 5a would have been an unproven all-clear.

## 6. Triggers on `profiles` (block 6) — **two**

| trigger | function | DEFINER | timing | names a token |
| --- | --- | --- | --- | --- |
| `guard_profile_no_delete_trg` | `public.guard_profile_no_delete` | no | `BEFORE DELETE` | no |
| `guard_profile_privileged_columns_trg` | `public.guard_profile_privileged_columns` | **yes** | `BEFORE UPDATE` | **yes** |

The second is the plan's named member. Its **identity half** (guarding `cpf`/`date_of_birth`/
`phone`) retires with the move; its **lifecycle half** stays on `profiles`. ⚠ The two halves live
in one function body — the migration edits the body, it does not drop the trigger.

## 7. The grant mechanism AE3 retires (blocks 7a–7d) — **measured, and not what the phrase suggests**

The plan calls this *"column-level grants retire as a mechanism"*. Measured, the mechanism is a
**conjunction of two facts**, and citing either half alone inverts the conclusion:

| half | measured value |
| --- | --- |
| **table ACL** | `{postgres=arwdDxtm/postgres, authenticated=dxtm/postgres, service_role=arwdDxtm/postgres, supabase_auth_admin=r/postgres}` — `authenticated` holds **`dxtm`**: **no `r`, no `a`, no `w`** |
| **column ACLs** | `authenticated=arw` on **10** columns; `cpf`, `date_of_birth`, `phone` carry **no `attacl` at all** |

⛔ **The trap, written out:** an empty `attacl` means *"the table-level grant applies"*. For a role
that **held** the table grant, an empty column ACL would mean **full access**. It means *no*
access here **only because** table-level `SELECT`/`INSERT`/`UPDATE` was revoked. Asserting "the
ACL column is empty, therefore withheld" is true by accident; block 7d asserts the **property**
positively instead (`has_column_privilege(...) = false`).

Effective privilege, asserted positively (block 7b/7c):

| grantee | table SELECT | `cpf` / `date_of_birth` / `phone` SELECT · UPDATE · INSERT |
| --- | --- | --- |
| `anon` | ✗ | ✗ · ✗ · ✗ |
| `authenticated` | ✗ | ✗ · ✗ · ✗ |
| `service_role` | ✓ | ✓ · ✓ · ✓ |

`profiles` has **RLS enabled, not forced**, with **5 policies** (block 8) — none of which touch the
three columns (§4).

**Consequence for AE3.2:** the destination table is the **door-only** class (AE1.6). The default
expectation in the plan — *"no direct-table policies for `authenticated` beyond self-read if the
census shows the app needs it"* — is now measured: **the app does not need it.** Every
`authenticated` read already goes through a DEFINER door (§3), and every raw read is
`service_role` (§8). No `authenticated` grant should be issued on `profile_private_details`.

## 8. Application consumers

`authenticated` cannot reach the columns (§7), so every app read is either a **door call** or a
**`service_role` raw read**. Both were enumerated.

### 8a. Raw `service_role` DML naming a restricted column — **three sites, all break at `DROP`**

| site | statement | note |
| --- | --- | --- |
| [`src/lib/users/actions.ts:1108`](../../src/lib/users/actions.ts) | `.select('full_name, professional_category_id, cpf, date_of_birth, phone')` | the change-detection read behind the `cpf_change` arm |
| [`src/lib/users/actions.ts:720`](../../src/lib/users/actions.ts) | `.select('id').eq('cpf', cpf)` | ⛔ **added by the §8b correction** — the registration CPF-collision probe. Invisible to a select-list census; found by `tsc`. |
| [`src/lib/users/person-footprint.ts:612`](../../src/lib/users/person-footprint.ts) | `.select('date_of_birth, phone, cpf')` + `.maybeSingle<{…}>()` | inside **`getPersonAdminView`** — the admin door path the plan names |

⚠ **Both are the wired seam.** The column list is a **string**; the row type is an **assertion**
supplied at the call site. After the columns drop, `tsc`, `eslint` and vitest all stay green while
the query returns a PostgREST error at runtime. Only the E2E pass proves these.

### 8b. Every other `.from('profiles')` site — **15, of which ONE more was affected**

> ⛔ **CORRECTED 2026-08-31, during AE3.2. This section first read "15, none affected", and
> that verdict was WRONG — derived at the wrong grain.** The enumeration below lists each
> site's **`select`/`update` column list**, and "affected" was concluded from that list alone.
> A query references a column in more than one place: `users/actions.ts:720` selects only
> `id` and **filters on `.eq('cpf', …)`**. It appears in the enumeration as *(id)* and read as
> untouched. `tsc` caught it the moment the column left the generated type — a **gate** found
> it, not this census, and had that site used an explicit `.maybeSingle<T>()` type argument
> (as `person-footprint.ts:612` does) no gate would have.
>
> **The property is "names the column ANYWHERE in the query" — select list, filter, order,
> payload key — not "names it in the select list".** The 15 below are re-verified against that
> wider property; the corrected count of affected raw sites in §8a is **three**, not two.

Enumerated with its full column references, so "not affected" is a measurement rather than a
sample: `auth/actions.ts:173` *(is_active, suspended_until, email_confirmed_at,
must_change_password)* · `auth/actions.ts:304` *(update must_change_password)* ·
`members/actions.ts:233` *(id, is_active)* · `members/invite.ts:120` *(id, is_admin)* ·
`minutes-jobs/webhook.ts:224` *(id, is_active, suspended_until)* · `queries/ethics.ts:553`
*(id, full_name)* · `queries/org-users.ts:524, :633, :687` *(`PROFILE_SELECT` — id, full_name,
email, professional_category_id, is_active, suspended_until, email_confirmed_at, created_at,
category)* · `queries/printed-documents.ts:536` *(full_name)* · `queries/rca.ts:341` *(id,
full_name, email)* · `users/actions.ts:698` *(select id, **filter email**)* ·
⛔ `users/actions.ts:720` *(select id, **filter cpf** — AFFECTED, see the correction above)* ·
`users/actions.ts:1492, :1543` *(email)*.

⭐ **`PROFILE_SELECT` does not contain the three columns** — the org/hospital roster gets
`date_of_birth` and the CPF probe from the `list_org_people` **door**, not from the table. That is
why the roster keeps working across the move without a change.

### 8c. Door call sites (re-point targets, unchanged signatures expected)

`src/lib/queries/own-person.ts` (`get_own_person_record`; masks CPF at `:158–160`) ·
`src/lib/queries/org-users.ts` (`list_org_people`, incl. the per-call `person.cpf_lookup` audit) ·
`src/lib/users/actions.ts` (`update_person_fields_for`, `finalize_invited_person_for`) ·
`src/lib/users/person-footprint.ts` (`getPersonAdminView`) ·
`src/app/conta/meus-dados/page.tsx` · `src/app/o/[org]/manage/usuarios/[userId]/page.tsx` ·
`src/app/o/[org]/manage/usuarios/novo/page.tsx` · `src/components/users/{personal-data-card,
personal-data-dialog,cpf-field,phone-field,register-person-flow,register-person-wizard}.tsx`.

⭐ **`src/lib/queries/own-person.ts:20–22` already documents this census's §7 finding in a
comment** — that `profiles.cpf/.date_of_birth/.phone` carry NULL `attacl` and the table grants
`authenticated` only `dxtm`, so a direct select returns `42501`. It was measured independently
here and **agrees**; a comment is an assertion that goes stale, and this one did not.

### 8d. Types, schemas, fixtures

- **Generated types:** `src/lib/types/database.ts` — regenerated by `npm run gen:types` (Rule 8).
- **Domain types:** `src/lib/users/types.ts`, `src/lib/users/person-footprint.ts`.
- **Zod:** **none.** No `z.object` schema in `src/` names any of the three tokens — the validation
  lives in `src/lib/users/cpf.ts` (`normalizeCpf` / `isValidCpf`) and in field components.
- **pgTAP suites naming `profiles` + a token (14):** `200`, `224`, `301`, `302`, `321`, `322`,
  **`359_profiles_dob_phone.sql`**, **`361_list_org_people_dob.sql`**, `379`,
  **`385_person_doors_authority_and_audit.sql`**, **`386_person_doors_acl_and_guard.sql`**, `393`,
  `395`, plus `supabase/tests/mutation/authz-unswept-backlog.txt`. The **bolded five** are the ones
  whose subject *is* the restricted columns.
- **E2E (19 specs):** `e2e/helpers/cpf.ts` is the shared generator; the person-facing flows are
  `user-registration`, `aff4-meus-dados`, `aff2-wizard`, `aff2-directory`, `hospital-admin-tier`,
  `phase3-admin-members`, `aff4-registration-dates`.
- **`supabase/seed.sql`:** 10 token occurrences.

---

## 9. Local/remote parity of the AE3 subject (AE0.3's per-phase obligation)

Measured **2026-08-31** against the linked project, read-only, one query returning a labelled
fingerprint of every element AE3 touches. **Every element matches local exactly** — this is a
measurement of the subject, not an inference from the migration heads agreeing:

| element | local | remote | verdict |
| --- | --- | --- | --- |
| the 3 columns (name / type / notnull / `attacl`) | `text`,`date`,`text`; all `notnull=false`; all `acl=(none)` | identical | ✅ |
| `profiles_cpf_valid` CHECK | `CHECK (((cpf IS NULL) OR app.is_valid_cpf(cpf)))` | identical | ✅ |
| `profiles_cpf_key` partial unique index | identical `CREATE UNIQUE INDEX … WHERE (cpf IS NOT NULL)` | identical | ✅ |
| `profiles` table ACL | `authenticated=dxtm` (no `r`/`a`/`w`) | identical | ✅ |
| effective column privilege, 9 cells (3 cols × 3 roles) | `anon` ✗, `authenticated` ✗, `service_role` ✓ | identical | ✅ |
| qualifying functions (§3, token ∧ `profiles`) | the same **5**, all `prosecdef = true` | identical | ✅ |
| policies naming a token | **0** | **0** | ✅ |
| triggers on `profiles` | 2 (`guard_profile_no_delete` INVOKER, `guard_profile_privileged_columns` DEFINER) | identical | ✅ |

**No local-only or remote-only finding.** AE0.3's rule — *any drift is explained in writing or the
phase does not close* — is satisfied with nothing to explain.

## 10. ADR 0155 **G2** — re-measured at the AE3 branch cut

| figure | value | predicate |
| --- | --- | --- |
| `auth.users` total (remote) | **36** | `select count(*) from auth.users` |
| `auth.users` **non-test** (remote) | **0** | `count(*) filter (where email not like '%@test.local')` |

⭐ **G2 HOLDS as of 2026-08-31.** The remote carries the E2E seed fixture and **zero** non-test
accounts, so AE3 keeps its **single-shot** authorization: one migration set, no dual-write, no
audit §7 Phase 3 re-plan.

⛔ **This authorization is a measurement with an expiry, not a property.** It is void the moment
the pilot loads data. Any later session resuming AE3 **re-measures this figure** — it does not
quote this row. A claim about this remote has gone stale six times in this repo; the value above
is true of 2026-08-31 and of nothing else.
