# AFF — Hospital affiliation, person identity & the org people directory

> Rotated out of the live PROGRESS.md at the AFF Record step, 2026-08-06 (CLAUDE.md §7 /
> lead-playbook §5). Status of record: **COMPLETE, PO-approved 2026-08-06.** The Phase Status
> table remains the index; the durable backend surface is `docs/backend-state.md` (AFF section).
> ADR [0097](../decisions/0097-hospital-affiliation-person-identity.md) ·
> [0098](../decisions/0098-aff-w1-substrate-shape-decisions.md) ·
> [0079 Amendment 5/5a](../decisions/0079-authz-door-blindness-standing-invariant.md) ·
> plan [hospital-affiliation-person-identity.md](../plans/hospital-affiliation-person-identity.md) ·
> external audit [aff-adr-0097-external-audit.md](../reviews/aff-adr-0097-external-audit.md) ·
> QA [aff-review.md](../reviews/aff-review.md) (APPROVED r1 + APPROVED final r2).

**▶ ACTIVE: AFF — Hospital affiliation, person identity & the org people directory.**
ADR [0097](docs/decisions/0097-hospital-affiliation-person-identity.md) **Accepted** (PO-approved
2026-08-05) · plan [hospital-affiliation-person-identity.md](docs/plans/hospital-affiliation-person-identity.md)
· external audit [aff-adr-0097-external-audit.md](docs/reviews/aff-adr-0097-external-audit.md)
(BLOCKER-1 / HIGH-1 / MEDIUM-1…5 / MINOR-1 / LOW-1…3 all folded in before build).
Branch **`feat/hospital-affiliation-person-identity`** (cut from `main` @ `f41fc69`).
**Migration window: `20260909000100`+** — highest *registered* version at kickoff `20260908000100`
(285 files = 285 registered, verified against `supabase_migrations.schema_migrations`, not the directory).
**AFF gates the pilot deploy** (ADR 0097 D19).

| WS | Scope | Owner | State |
| -- | ----- | ----- | ----- |
| **W1** | Substrate — `hospital_affiliations` (T1.1) · `profiles.cpf` + column-list grant conversion (T1.2) · drop `home_hospital_id` / `hospital_employee_id` as a refactor (T1.3) · `professional_profiles.cpf` (T1.4) · pgTAP (T1.5) | `backend` | ✅ **done** — migrations `20260909000100`–`000400`; ADR [0098](docs/decisions/0098-aff-w1-substrate-shape-decisions.md) |
| **W2** | Doors, visibility & the dominance grid — `affiliate_person` / `end_affiliation` (T2.1) · `list_org_people` (T2.2) · widened `profiles` SELECT (T2.3) · dominance grid + the 2 live gaps (T2.4) · `grant_role_impl` hospital arm (T2.5) · pgTAP (T2.6) | `backend` | ✅ **done** — migrations `20260909000500`–`000900`; ADR 0098 §W2 |
| **W3** | Product surfaces — identifier-first registration (T3.1) · affiliation-derived roster (T3.2) · affiliation management + field ownership (T3.3) · single-hospital provisioning (T3.4) · seed Rede C (T3.5) · E2E (T3.6) | `frontend` + `backend` | ▶ backend ✅ (migrations `20260909001000`–`001100`; ADR 0098 §W3) · frontend ✅ · T3.6 ✅ `tester` (2026-08-06) — BUG-AFF-1 filed, fixed (`8155be2`, mirror-drift correction) and re-verified GREEN |

**File ownership (binding for this workstream):** `backend` owns `supabase/**` (migrations, pgTAP,
`seed.sql`, **and `supabase/demo/seed-revisao-prontuario.sql` — audit MEDIUM-2, it is in no gate**),
`src/lib/{supabase,queries,types}`, `src/lib/users/actions.ts`, `src/lib/members/invite.ts`.
`frontend` owns `src/app/**` and `src/components/**`. `src/lib/types/database.ts` changes **only**
via `backend` (`npm run gen:types` after every migration — Rule 8).

**The four audit rulings that changed the build** (PO-ruled 2026-08-05, all now binding):
BLOCKER-1 → **T2.5 exists at all** (`grant_role_impl`'s `hospital_admin` branch gains
`app.is_admin_for`; without it T3.4 has *no working path* — the platform admin is denied 42501 and
the fallback hits the self-grant guard) · HIGH-1 → `cpf` is **column-locked**, which converts
`profiles` to column-list grants (**from then on every new `profiles` column needs its own GRANT or
reads 42501** — the standing `case_referral` lesson now applies to `profiles`) · MEDIUM-3 →
`end_affiliation` blocks on memberships of **any tier**, not just commission seats · MEDIUM-5 →
`list_org_people` is gated by an **inline** org_admin-or-hospital_admin predicate, **not**
`app.is_org_level_admin_within` (which also admits `nsp_org_admin` and is a live leg of
`organizations_select`).

> ⚠ **Two runtime landmines this workstream must clear, neither visible to lint/tsc/tests:**
> `guard_profile_privileged_columns` compares both doomed columns and plpgsql is **late-bound** — the
> DROP succeeds and then *every* `profiles` UPDATE fails 42703 (rewrite the trigger in the **same**
> migration, regenerated from live `pg_get_functiondef`); and
> [org.ts:199](src/lib/queries/org.ts)'s embed string `profiles!profiles_home_hospital_id_fkey(count)`
> **typechecks after the drop and fails only at runtime** (the TV dropped-column mechanism — grep is
> the authority for the client layer, the catalog for SQL).

**W1 result (`backend`, 2026-08-06).** Migrations `20260909000100` (`hospital_affiliations` + its
four-leg policy + the `affiliation.created/ended` audit trigger) · `000200` (`app.is_valid_cpf`,
`profiles.cpf`, and the column-list grant conversion — `authenticated` now holds
`SELECT/INSERT/UPDATE` on **11 named columns**, table-level `dDxtm` untouched) · `000300` (the two
policy legs, the `guard_profile_privileged_columns` rewrite, the DROP) · `000400`
(`professional_profiles.cpf`). Gates: **289 registered == 289 files** on a fresh reset · pgTAP
**162 files / 4961 tests PASS** (new suite `301`, **40 assertions**) · Vitest **984/984** · lint
0 errors 0 warnings · typecheck clean · authz **`ARM=census` HOLDS** (the new policy was correctly
flagged UNKNOWN first, then swept) and **`ARM=floor` HOLDS**; the diff-scoped door sweep over
`hospital_affiliations_select` + both altered `profiles` policies returned **3 COVERED, 0 BLIND,
0 ERROR** (the findings report was *merged*, not `git checkout`-ed, so the subset run did not
discard 400+ committed verdicts). **11 mutations were run against `301`; every one went red on its
target** (each of the four policy legs individually, `using(true)` for all four deny arms, the
column lock, the stale trigger body, the partial unique, the composite FK, the CPF validator, the
DML grant). Shape decisions ADR 0097 left open are recorded in ADR
[0098](docs/decisions/0098-aff-w1-substrate-shape-decisions.md).

> ✅ **W1→W2 SEQUENCING HAZARD — CLOSED.** W1's `20260909000300` removed the `home_hospital_id`
> leg and added nothing, so a person registered at a hospital and seated on no committee was
> invisible to their own hospital's admin (seed reach was unchanged at 13/30 and 21/34 — the
> product path was the live case). **T2.3 (`20260909000700`) has landed and `301` §5.1 is
> INVERTED**: it now reads "the hospital admin reads BOTH the affiliation AND the profile of a
> committee-less employee", and the mutation oracle confirms it goes red when the affiliation leg
> is removed. The E2E gate is unblocked on this axis.

**W2 result (`backend`, 2026-08-06).** Migrations `20260909000500` (the affiliation ACTOR KERNEL +
`auth.uid()` wrappers + `_for` service twins + the delete guard + the `affiliation.deleted` audit
arm) · `000600` (`list_org_people`, inline-gated, CPF-audited) · `000700` (the two `profiles` legs)
· `000800` (both dominance gaps) · `000900` (`grant_role_impl`'s `is_admin_for` arm, regenerated
programmatically from live `pg_get_functiondef` with a single anchored replacement). Gates:
**294 registered == 294 files** on a fresh reset · pgTAP **164 files / 5024 tests PASS** (`302` =
**50** assertions, `303` = **12**) · Vitest **988/988** · lint 0/0 (the door gate now covers
`hospital_affiliations`) · typecheck clean · authz **`ARM=census` HOLDS** (it correctly flagged
`list_org_people` UNKNOWN first — swept via the ROW-DOOR arm, since the boolean-gate arm has no
mechanism for a table-returning door) and **`ARM=floor` HOLDS**; the diff-scoped run, derived from
the migration diff, returned **3 policies COVERED + 1 row-door COVERED, 0 BLIND, 0 ERROR**. Both
findings reports were **merged**, not discarded.

> ⚠ **That "0 BLIND" does NOT cover W2's four `uuid`-returning affiliation doors** (QA finding —
> the W3 record carries this disclaimer and W2's did not). `20260909000500` added
> `affiliate_person` / `affiliate_person_for` / `end_affiliation` / `end_affiliation_for`, and the
> boolean-gate arm **cannot see them**: it neutralizes by rewriting a body to `select true`, which
> is meaningless for a `uuid`-returning door, so it skips them silently — and ARM 3's census
> population is bool-or-set-returning, so it does not flag them either. **Their coverage is
> `302` §1–§3's mutation-proven keystones, not the sweep.** This is the hole recorded in ADR
> [0079](docs/decisions/0079-authz-door-blindness-standing-invariant.md) Amendment 5 / FUP-AFF-1,
> and it is the reason that amendment exists — the arm reports a clean result in the same words
> whether it swept everything or nothing.

> ⚠ **One vacuous keystone was found and fixed — by the mutation oracle, not by review.** `302`
> §4.2 asserted the membership leg using `dt.a` as its subject, but §3's fixture had affiliated
> `dt.a`, so the **affiliation** leg admitted them: removing the membership leg left the assertion
> GREEN. The subject is now `dt.dep.a` (a hospital-tier seat, never affiliated), with §4.2a
> asserting that subject has zero affiliation rows so the arm under test is the only path.
> Thirteen SQL mutations + one TS mutation were run one at a time; every one now goes red on its
> target, and the three that first reported "still green" were **harness** failures (the mutation
> had not landed) — each was re-run with its pre-image asserted.

> ⚠ **`281` D1 was INVERTED (not deleted), and gained a deny twin.** It pinned "org_admin is
> REJECTED by `set_standard_ownership`" as a "D7 asymmetry, verified" — the exact behaviour ADR
> 0097 finding 9 and the external census classify as a real dominance gap, and D18 fixes. A fixed
> bug leaving behind a test that asserts the old behaviour is how the next reader "repairs" the
> code back into the defect.

**W3 backend result (`backend`, 2026-08-06).** Migrations `20260909001000` (the
deactivated-account guard, `HC0R4`) · `001100` (the `update_affiliation` door + the
`affiliation.updated` audit arm). `OrgUserDetail` now carries `affiliations: UserAffiliation[]`
and the three transitional singular fields are gone; D14 is enforced by
`authorizeOrgAdminForUser` across name/CPF/category/credentials AND the account lifecycle;
`registerUser` requires, validates, normalizes and stores `cpf` with a front-loaded collision
block; `lookupOrgPeople` + `updateAffiliation` landed in `src/lib/affiliations/actions.ts`;
T3.4 seats `hospital_admin` alongside `org_admin` when an org has exactly one hospital.
Gates: **296 registered == 296 files** · pgTAP **165 files / 5050 tests PASS** (`304` = **23**)
· Vitest **1003/1003** · lint 0/0 · typecheck clean · `ARM=census` and `ARM=floor` HOLD.

> ⚠ **THE AUTHZ SWEEP EXAMINED NONE OF THE W3 DOORS, AND "0 BLIND" SAYS SO ONLY IF YOU
> KNOW THAT.** The diff-scoped run over `update_affiliation` / `update_affiliation_for` /
> `affiliate_person` printed **PREDICATE ARM: empty, POLICY ARM: empty, BLIND 0, ERROR 0** —
> because W3 changed no policies and these doors return `uuid`, so the boolean arm's
> neutralization (rewrite the body to `select true`) has no meaning and is skipped silently.
> The row-door arm does not apply either. `ARM=census` does not flag them, since void/uuid
> write-path doors are not in its population. **They are covered ONLY by pgTAP `304` §1–§2**
> (ACL split, authority arms, and observed-state assertions). This is a second instance of
> the hole the lead is amending ADR 0079 for.

> ⚠ **T3.5's blast radius, measured.** The seed change reded **11 assertions in 5 files**, all
> traced and fixed at the spec that owned the assumption: `301` §2 (two CPF literals collided
> with newly-seeded values), `302` §2/§5 (a fixture subject the new HC0R4 guard now refuses,
> plus an absolute `audit_log` count that was never hermetic — `frontend`'s dev server hitting
> the same local DB reded it, and the assertions are now baseline-scoped), and `190`/`224`/`293`
> (anti-lockout suites that inherited "the bootstrap has no org_admin"). **No fixture was
> clamped to preserve an old count.**

> ⚠ **`301` §4's fixture is now idempotent by construction** — T3.5 seeds the D2 affiliation, so
> a blind insert duplicated the pair and aborted the file on `hospital_affiliations_active_uq`.

> ⚠ **`seed.sql` is a contract with ~900 pgTAP tests + E2E.** T3.5 adds an org (Rede C), personas and
> affiliation rows; the very constants ADR 0097 cites (21/34 memberships, 13/30 profiles, 6 dangling)
> are the kind of number baked into counting keystones. Budget for updating them — **do not clamp the
> new fixtures to preserve old counts** (the shared-fixture pigeonhole lesson).

**W3 UI result (`frontend`, 2026-08-06) — T3.1 / T3.2 / T3.3 UI halves BUILT and browser-verified.**
Files: `src/app/o/[org]/manage/usuarios/{page,novo/page,[userId]/page}.tsx` · new
`src/components/users/{register-person-flow,cpf-field,affiliations-panel}.tsx` · rewritten
`register-user-form.tsx` / `user-profile-edit-form.tsx` · edited
`user-directory-list.tsx` / `user-lifecycle-actions.tsx`.
**T3.1** — `/usuarios/novo` is now a two-step flow inside the SAME route (a second route would
reintroduce D12's actual defect: the admin having to know in advance which case they are in). CPF
travels in a POST via `lookupOrgPeople`, **never a URL parameter** — a national ID must not land in
history or an access log. All four D12 outcomes verified in a running app, plus a **fifth guard**:
`is_active` gets its own outcome, so a deactivated account is never silently offered for affiliation
(ADR 0098 W2.2 is why the flag is in the payload). Outcome D has no branch of its own **by design** —
a CPF held outside the org is indistinguishable from "not found", and `registerUser`'s block refuses
at submit, verbatim in form. **T3.2** — employment and committees render as separate chips; the
zero-committee affiliated person (`novato.pendente`) shows "Hospital Central A · Sem comissão" in the
hospital roster, legible rather than an empty cell. Empty lists say "none found", **never** "you lack
permission" (`list_org_people` returns `[]` for an unauthorized caller by design). **T3.3** —
person-level fields (nome, CPF, categoria, credenciais) are `org_admin`-only in the UI and the CPF
field is **write-only** (D7 column-lock: no admin surface reads another person's CPF); employment
(matrícula + início, via `update_affiliation`) belongs to the hospital's own admin; account
deactivation is absent for a hospital admin with the reason stated. `endAffiliation` blockers render
the actual seats ("Membro — Comissão de Controle de Infecção Hospitalar"), never "não foi possível".
Every `can*` flag is **UX only** — the server refusals (`MESSAGES.orgAdminOnly`, the doors' SQLSTATEs)
are the boundary (Rule 1). Gates on `frontend`-owned files: typecheck **0 errors** · lint **0/0**
(incl. `lint:css-vars` + the door gate) · Vitest **1003/1003**. Verified by driving the flows in
`next dev` (13 screenshots), incl. a **keyboard-only** pass: the CPF field is reachable by Tab and
focus lands on the outcome heading after the lookup.

**QA pass 1 — F1 fixed, plus a second defect the same sweep found (`frontend`, 2026-08-06).**
**F1** (Rule 10): `affiliations-panel.tsx` rendered `" — no hospital"` — English inside the pt-BR
`role="alert"` blockers list — on the **hospital-tier** arm, the one the audit's MEDIUM-3 added so a
sitting technical director's seat cannot be orphaned. Now `" — cargo do hospital"`, which contrasts
with the commission arm (that one names its committee) and tells the admin the seat is held at the
hospital, outside any committee. **F2, found by sweeping the same branch and not reported by QA:** the
end-affiliation confirm dialog closed **only on success**, so a refusal rendered *behind* the open
modal — dimmed, and `aria-hidden` because Radix hides everything outside an open dialog, making the
blockers list **inert to assistive tech**. The admin saw a dialog that appeared to do nothing. Both
dialogs now close either way; `user-lifecycle-actions.tsx` carried the identical shape (pre-existing,
same file family) and is fixed with it.
**Why F1 survived every gate, recorded because the mechanism generalises:** no E2E reaches the
blockers list at all, and every blockers case ever rendered by hand was a *commission* seat — so the
hospital-tier arm was covered by a green bar and executed by nothing. `dr.john` (the obvious fixture)
only produces the commission arm; the hospital-tier arm needs someone **affiliated to a hospital AND
holding a hospital-tier seat there**, which in the seed is **`hospitaladmin.a1`** (`hospital_admin` of
Central A, no commission) — derived from the catalog, not guessed.
**Hardening:** `ROLE_LABELS` completeness is now executable (`affiliations-panel.test.ts`, 3 tests)
— all 9 roles covered, so the `?? role` fallback that would leak an English snake_case identifier is
unreachable today. Both assertions were **mutation-proven** (drop `technical_director`'s label → red;
set a label equal to its key → red), then the pre-image restored.
**Corrected by QA N1 (`frontend`, 2026-08-06) — the claim above was overstated as first written.**
It said a 10th role "reds the suite instead of shipping"; that was **false**. The test transcribed the
role list and `memberships_role_check` is a CHECK over `text`, **not an enum** — the list is absent
from `database.ts` and **Vitest cannot reach the database**, so widening the CHECK left the test green
while a raw English identifier rendered in the pt-BR alert. The array is deleted; the test now imports
`backend`'s committed fixture `src/lib/members/__fixtures__/membership-roles.json` (`dc11daf`), closing
the third link of the chain `memberships_role_check` → pgTAP `304` §10 (fixture == live CHECK, both
directions) → `membership-roles.test.ts` (JSON == the copy in `304`) → **this test** (every fixture role
has a pt-BR label). ⚠ **Scope, stated precisely:** widening the CHECK still does not red this test —
only `304` §10 notices, and only when `npm run test:db` runs; a widened CHECK whose fixture is never
regenerated stays green here. It is a **build-time gate, not a runtime guard**. Mutation-proven both
directions (fixture `+ quality_officer` → red on the missing label; fixture `− pqs_member` → red on the
reverse assertion), each reverted via `git checkout`. `a1fd581`.
Gates: typecheck **0** · lint **0/0** · Vitest **1013/1013**. Three previously unreachable branches
were rendered in a running app and read on screen: the hospital-tier blocker, the zero-affiliation
empty state, and outcome B for a person with no affiliation.
**E2E coverage (`tester`, 2026-08-06):** `e2e/aff-hospital-affiliation.spec.ts` AFF-6, two tests —
commission-tier (`dr.john`) and hospital-tier (`hospitaladmin.a1`, the catalog-derived fixture) —
asserting the RENDERED blocker text via `getByRole('alert')`, which pins both F1 (the pt-BR string)
and F2 (the dialog now closing on refusal) at once. See Test Run Summary for run counts.

> ⚠ **STILL UNEXERCISED, named rather than assumed harmless** (all pt-BR, none reached by any test):
> `AddAffiliationForm`'s success/error banner (exercising it mutates the shared seed mid-gate, so I
> did not); the `!canManage` read-only affiliation row and its two matrícula sub-branches — likely
> **unreachable by construction**, since `hospital_affiliations` SELECT is row-scoped on
> `is_hospital_admin_of(hospital_id)`, so a hospital admin never receives a row for a hospital they do
> not administer, and an org_admin manages all of them; `hospitalName ?? "Hospital não visível"`, same
> reason; and `LOOKUP_MESSAGES.error`. If `backend` ever widens that policy, the read-only row becomes
> live and wants a test.

> ⚠ **E2E LOCATOR IMPACT — `tester` must re-point these.** `/o/[org]/manage/usuarios/novo` no longer
> renders the create form on load; it renders the CPF step, and the create form appears only after a
> lookup returns nothing. Affected today: `e2e/user-registration.spec.ts` (6 navigations),
> `e2e/hospital-admin-tier.spec.ts` HA-6 (2), `e2e/phase3-admin-members.spec.ts` (1). Also:
> `getByLabel('Hospital de origem')` is **gone** — the hospital is now a read-only display for a
> hospital_admin (label "Hospital") and the concept is "vínculo", not "origem"; the directory row's
> "Sem hospital de origem" became the chip "Sem vínculo hospitalar"; and `getByLabel('CPF')` matches
> **two** nodes (the field and the region "Comece pelo CPF") — use
> `getByRole('textbox', { name: 'CPF' })`.

---

## Completion record — rotated from PROGRESS.md 2026-08-06 (§6 step 5)

**COMPLETE 2026-08-06.** ADR [0097](../decisions/0097-hospital-affiliation-person-identity.md) +
[0098](../decisions/0098-aff-w1-substrate-shape-decisions.md); backend surface →
`docs/backend-state.md` (AFF section). QA **APPROVED** r1 + **APPROVED final** r2
([review](../reviews/aff-review.md)). PO-approved 2026-08-06.

Final gate: lint 0/0 · typecheck · Vitest **1026/1026** · `db reset` **298=298** · pgTAP
**165 files / 5066 PASS** on a fresh reset · `ARM=census` + `ARM=floor` **INVARIANT HOLDS** ·
`e2e:prod` **GATE GREEN — 985 passed · 0 failed · 0 infra · 1 flaky · 0 did-not-run · 16 batches
(no gaps) · 0 `reset FAILED` · accounted 986/991**.

### The three lessons this workstream leaves behind

> ⚠ **It fired FOUR times: an enumeration's boundary must be the PROPERTY, not a syntax and not a
> remembered list.** (1) The error-code drift detector enumerated `errcode = '[A-Z0-9]{5}'`, so it
> could not see `check_violation` — the *same* defect it was built to catch, in the *same* file.
> (2) The diff-derivation grep was case-sensitive, but `pg_get_functiondef` emits **uppercase**, so it
> listed 1 of 4 changed gates (ADR 0079 Amendment 5a). (3) `302` §1's ACL enumeration covered "the
> doors that existed when I wrote it", and `log_cpf_probe_for` arrived two commits later inheriting
> nothing — while its ACL is its *entire* boundary. (4) A unit test transcribed the membership-role
> list and claimed in its header that widening the CHECK would red it; it could not, because Vitest
> cannot reach the database. **Every one was caught by a mutation or a catalog read. None by review.**
> Classes filed as FUP-AFF-3 / FUP-AFF-4.

> ⚠ **Second recurring shape: a comment is an assertion that goes stale silently — three instances.**
> A security comment justified `platform_admin`'s omission by citing `inviteStaff` running
> service-role; **`inviteStaff` does not exist anywhere in the repo**, and the BUG-AFF-1 fix
> *expanded* that comment rather than checking it. A test header claimed a power the code lacked.
> PROGRESS.md carried the same false claim. Where a claim is load-bearing, encode it executably
> (`301` §0.10 pins the `profiles` column-grant rule; `304` §10 pins the role fixture) or name the
> owning ADR.

> ⚠ **Three defects were invisible to every gate and visible only by executing the branch.**
> The pt-BR/English defect in the `HC0R1` blockers list survived lint + typecheck + 1023 unit tests
> + a full E2E gate **because no test reached that branch** — every blockers case anyone had ever
> rendered was a *commission* seat, and the seed's obvious fixture (`dr.john`) produces only that
> arm. Underneath it: the confirm dialog closed **only on success**, so refusals rendered behind an
> open Radix dialog — `aria-hidden`, **inert to assistive technology** — which also hid the D14
> `orgAdminOnly` refusal. Found because `getByRole('alert')` timed out on visibly-present text:
> **the locator failure WAS the accessibility bug.**

### Open at close, by design (none blocking)

Full entries live in PROGRESS.md → *Follow-ups / Deferred Items*; this is the index only.

- **FUP-AFF-1** — the authz census cannot see write-path doors; it recurred *inside* this workstream
  after being written up. AFF's doors are covered by `302`/`304` keystones — **never cite
  `ARM=census` for them.**
- **FUP-AFF-2** — D7's nullable-`cpf` escape for a foreign professional is now unreachable, since CPF
  is required at the action layer.
- **FUP-AFF-3** — derive door ACLs from `pg_proc` rather than remembering the door set.
- **FUP-AFF-4** — make the membership-role list a Postgres ENUM so `tsc` enforces it.

Separately, and **not** a follow-up but an open operational gap → tracked as **BUG-BOOTSTRAP-001** in
PROGRESS.md's Bug Log: there is still no in-app path to create a `platform_admin`.

### Why AFF was built — the five catalog-verified findings (rotated from *Remaining pre-pilot work* item 1)

Origin: the PO scenario of a professional hired by a **second hospital of the same organization** —
`registerUser` blocks on the email collision and there is no "this person already exists, vincular"
path. Evidence in ADR 0097's Context:

1. `list_addable_commission_members` **already** discloses the whole org roster to a hospital admin —
   the feature was half-shipped and undeclared.
2. `profiles.home_hospital_id` was populated on **1 of 30** profiles, so its RLS leg was inert.
3. `memberships` SELECT was **wider** than `profiles` SELECT — a hospital admin read **6** membership
   rows whose principals they could not name, including their own `technical_director`.
4. No row expressed "employed at this hospital", and `hospital_employee_id` (matrícula) was singular
   on `profiles` though it is per-employment.
5. ADR 0051 D1's **"org_admin dominates hospital_admin" is false** — `set_standard_ownership` and
   `standard_ownerships_select` admitted `hospital_admin` with no `org_admin` arm (BUG-AUTHZ-001's
   shape); both fixed in W2 behind a new dominance grid.

Single-hospital tenants were settled with **no model change** — one principal already holds
`org_admin` + `hospital_admin` (probed live) — but **no product path could seat it** (the self-grant
guard fires on the service path too), so W3 seats both at provisioning.

It was sequenced ahead of the pilot deploy because it is mostly schema (a new `hospital_affiliations`
table, `profiles.cpf`, two dropped columns, a widened `profiles` policy, two new DEFINER doors), and
every one of those is free while `supabase db reset` is free and materially more expensive the day
after the remote `db push`.

## Phase Status row (rotated verbatim from PROGRESS.md 2026-08-08)

| **AFF** | **Hospital affiliation, person identity & the org people directory** [0097](docs/decisions/0097-hospital-affiliation-person-identity.md) · [plan](docs/plans/hospital-affiliation-person-identity.md) · [audit](docs/reviews/aff-adr-0097-external-audit.md) — **gates the pilot deploy** (D19) | ✅ **complete** | ✅ lint 0/0 · tsc · Vitest **1023** · `db reset` **298=298** | ✅ pgTAP **165f/5060** fresh reset · `ARM=census` + `ARM=floor` HOLD · `e2e:prod` **GATE GREEN — 985 passed · 0 failed · 0 infra · 1 flaky · 0 did-not-run · 16 batches (no gaps) · 0 `reset FAILED` · accounted 986/991** | ✅ **APPROVED** [review](docs/reviews/aff-review.md) — 0 blocker; 6 non-blocking follow-ups, **all 6 since remediated** (`202c3db` · `8dde312` · `8111fc9`) | ✅ **2026-08-06** | 2026-08-06 | branch `feat/hospital-affiliation-person-identity`; `main` fast-forwarded + pushed to `origin` at `cc66483` (pre-remediation) |

