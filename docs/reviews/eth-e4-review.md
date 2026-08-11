# QA Review — ETH·E4 · Ethics participant seating & professional identity

- **Reviewer:** `qa` · **Date:** 2026-08-11
- **Branch:** `worktree-ethics-committee-completion` @ `7dc2a72` (23 commits ahead of `main` @ `9fbc69d`)
- **Contract audited against:** ADR [0108](../decisions/0108-eth-e4-participant-seating.md) ·
  [build plan](../phases/ethics-e4-participant-seating.md) ·
  [locator contract](../phases/ethics-e4-locator-contract.md) ·
  [plan review](./eth-e4-plan-review.md) · CLAUDE.md §§3/8 · ARCHITECTURE.md Rules 1/8/9/10/11/12 ·
  `docs/progress/authz-handoff.md` §7

---

# VERDICT: **CHANGES REQUESTED**

One **P0** and six **MAJOR** findings. The P0 is an RLS/confidentiality regression introduced by
this phase: **ADR 0108 D5's exposure argument — the clause the PO ratified the widening against —
is false as written.** Per CLAUDE.md §6 and the reviewer standard, a single unmet blocking
requirement of this class is `CHANGES REQUESTED` regardless of how much else is correct — and a
great deal here *is* correct. This is not a weak build. It is a strong build with a security clause
that does not hold.

**What this phase did unusually well, stated up front because it should not be lost in a
CHANGES REQUESTED:** every keystone in pgTAP 321 that I tried to falsify *did* falsify. The
`set_primary_subject` modification is genuinely surgical and I could reconstruct its full lineage.
The `ARM=census` correction made mid-build was correct, and I verified the underlying claim
rather than the prose. The `207`/`320` census edits are conscious, by name, and one of them
*tightens* while loosening. Suite 321 K3c had already found the CPF gap by measuring rather than
reasoning — the P0 below is the column *next to* the one it found.

---

## How I verified (method, so the negatives are worth something)

The **live catalog was the sole authority** for every schema/RLS/RPC/authz claim
(`pg_proc` incl. `prosecdef` / `proconfig` / `proacl`, `pg_policies`, `pg_trigger`,
`information_schema.column_privileges`). Migration text was read **only** to reconstruct history,
never believed as state. graphify was not used for SQL and `graphify update` was not run.

**Stack state.** `supabase_migrations.schema_migrations` = 352 rows = 352 files on disk, max
version `20260919000500` — the DB was on a clean, complete E4 reset before I started, so every
measurement below is against the shipped substrate.

**DB mutations I made (disclosed):** I installed the `pgtap` extension and ran
`supabase/tests/00_setup.sql` (exactly what `npm run test:db` does) so I could run suite 321
directly. **Every probe and every neutralization ran inside a transaction that I rolled back** —
verified afterwards that `professional_participants_profile_uniq` is still present and the doors
carry their shipped bodies. A `supabase db reset` restores the pgtap/test_helpers residue if the
lead wants a pristine tree before the gate record.

**Commands whose results I am reporting first-hand:** `ARM=census`, `ARM=hat`, `ARM=floor`,
`npm run lint`, `npm run typecheck`, pgTAP 321 (baseline + 8 neutralizations), and ~20 catalog
queries. I did **not** re-run the full `e2e:prod` gate or `npm run test:db` in full; those I
audited by construction and by reading, and I say so where it matters.

---

# P0 — BLOCKING

## P0-1 · The D5 widening discloses **ethics-proceeding involvement** to every org manager. ADR 0108 D5's exposure argument is false as written.

**The requirement violated.** ADR 0108 D5, *"The exposure argument, stated so it can be checked"*:

> This arm adds `license_number` / `specialty` / `professional_type` to people who may already
> seat professionals — it does **not** add the existence fact, and **it discloses no case linkage**
> (`professional_participants` carries no `case_id`).

The disclosure does not travel through `professional_participants`. It travels through two columns
**on `professional_profiles` itself** that the argument never enumerates.

**The substrate, from the catalog.**

- `authenticated` holds a **table-wide** SELECT grant on `professional_profiles` — all 17 columns,
  no column-list grant (unlike `profiles` and `case_referral`).
- `app.trg_pin_respondent_retention` (AFTER UPDATE on `case_decisions`) is the **only** writer of
  `retention_pinned_at` / `retention_pin_reason`. It fires **only** on the transition into
  `status = 'issued'`, and **only** for participants whose role key is `respondent_doctor`:

  ```sql
  update public.professional_profiles
    set retention_pinned_at = now(), retention_pin_reason = 'ethics_decision_issued'
  where id = r.profile_id and retention_pinned_at is null;
  ```

- Therefore `retention_pin_reason = 'ethics_decision_issued'` **is** a case linkage. It says, of a
  named doctor: *"respondent in an ethics proceeding that reached an issued decision."* Role,
  stage, and outcome-existence — the three facts sigilo exists to protect.
- `public.issue_decision` is a `prosecdef` door with `EXECUTE` to `authenticated`, so the write is
  product-reachable. **ETH·E4 is what makes it reachable in practice** — before this phase nothing
  could seat a `respondent_doctor`, so the trigger could not fire through the product. This phase
  opens the write path and widens the read path in the same change.

**Measured live, not reasoned.** Persona `chefe.farm@test.local` — `staff_admin` of *Comissão de
Farmácia e Terapêutica*, Rede A. No ethics membership, no case access, no relationship to the
proceeding whatsoever. Both runs inside a rolled-back transaction, with the ACT hat set
(`active_role = 'staff_admin'`, else `app.has_role`'s caller-hat condition denies and the probe
lies — my first attempt did exactly that and I re-ran it):

| Predicate | Rows visible in `professional_profiles` | `retention_pin_reason` |
| --- | --- | --- |
| **Pre-D5** (arm neutralized in-transaction) | **0** | — |
| **Post-D5** (shipped) | **1** | **`ethics_decision_issued`** |

She also reads `user_id`, `link_state`, `affiliation_status`, `redacted_at`, `redacted_by`, and
`cpf` — none of which D5 enumerates.

**Second delivery path.** `public.get_case_professional` returns `to_jsonb(v_profile)` — the whole
row — gated on the same widened predicate. Suite `207`'s new assertion
(`pr_org_manager.j->>'full_name'`) confirms the whole JSON reaches the org manager. So the exposure
is not confined to the invoker-rights picker query; it is on the audited door too.

**Why no gate caught this, and why the phase's own methodology was sound but insufficient.** The
policy is *correct*. The predicate is *correct*. The widening was *deliberate and keystoned*
(K3a is falsifiable — I proved it, see below). The gap is between the **predicate** and the
**column set the grant exposes** — a dimension neither `pg_policies` nor a door sweep measures.
This is the ADR-0097 column-list-grant lesson arriving on a table that never adopted it. Backend
found the same class one column over (FUP-ETH-CPF-1, `cpf`) and correctly classified *that* one as
latent. `retention_pin_reason` is **not** latent — it has a live writer and a live trigger.

**What I am asking for (shape, not prescription).** The two candidate fixes both already exist in
this codebase as house patterns; the choice is the lead's/PO's:

1. **Column-list SELECT grant on `professional_profiles`** (the `profiles` / `case_referral`
   pattern), exposing to `authenticated` only what the picker and roster need — `id`,
   `organization_id`, `full_name`, `professional_type`, `license_number`, `license_region`,
   `specialty`, `link_state`, `redacted_at` — and withholding `cpf`, `retention_pinned_at`,
   `retention_pin_reason`, `redacted_by`, `user_id`. Note the standing trap: on a column-list
   grant **every future column needs its own GRANT or reads 42501**. This also closes
   FUP-ETH-CPF-1 in the same change.
2. **Narrow what `get_case_professional` returns** — it must stop returning `to_jsonb(whole row)`
   regardless of which option is taken, or option 1 is bypassed by the door.

Whichever is chosen, **ADR 0108 D5's exposure paragraph must be rewritten to enumerate what the
arm actually discloses, column by column, derived from `information_schema.column_privileges`** —
not from prose. The PO ratified a clause that a five-minute catalog query falsifies; the remedy is
that the clause be re-derived and re-ratified, not merely patched.

**Suggested keystone (so this cannot regress silently):** a pgTAP assertion that the
`authenticated` SELECT column set on `professional_profiles` is *exactly* the ratified list, by
name — the same shape as 321 K8's writer census. A count alone cannot fail on a wrong population.

---

# MAJOR

## MAJOR-1 · Raw Postgres error text reaches the UI (CLAUDE.md §8, explicit)

`src/lib/vocabulary/actions.ts:144`:

```ts
default:
  return error.message || MESSAGES.generic
```

Every SQLSTATE the four vocabulary writers can raise other than `23505` / `42501` / `HC0F3`
renders its raw engine text — `23503`, `23514`, `22001` (the `key` / `display_name` inputs are
unbounded in the UI), `42703`, and transport failures (`TypeError: fetch failed`). It is rendered
verbatim by `FormBanner` at `src/components/org/case-participant-role-manager.tsx:347` and as
`role="alert"` text at `src/components/org/case-type-terminology-dialog.tsx:140`.

This deviates from the house pattern the module's own header claims to mirror:
`src/lib/cases/actions.ts:281` ends `default: return MESSAGES.generic`, and
`mapParticipantError` (`src/lib/participants/actions.ts:190`) does the same. One-line fix.

**Related (MINOR, same file family):** `src/lib/participants/actions.ts:186-189` prefers
`error.message` for `P0002` and `23514`. Both are raised by the engine/constraint layer, not by a
`raise … using message`, so their text is English (`new row for relation "…" violates check
constraint "…"`, `query returned no rows`). The `HC0*` arms preferring `error.message` are fine —
I verified from the catalog that every `HC0*` raise in the E4 doors carries a pt-BR message.

## MAJOR-2 · Two live paths steer a coordinator into `no_account` — which provably disables the automatic impedimento

This is the **same defect class** that commit `ca2bdb6` fixed, only partially closed. I verified
the consequence from the catalog rather than taking the commit message's word for it:

```sql
-- app.is_case_respondent
... join public.professional_profiles prof on prof.id = pp.professional_profile_id
where ... and r.key = 'respondent_doctor' and prof.user_id = p_uid
```

and `professional_profiles_link_state_coherent` forces `(link_state = 'linked') = (user_id is not
null)`. So under `no_account`, `user_id` is NULL, `is_case_respondent` can never resolve, and **a
respondent who does have a platform account is never automatically excluded from their own
disciplinary case.** ADR 0108 D6 names this ("vacuously satisfied"); it is an authorization
consequence, not a UX one.

Two paths reach it:

**(a) A failed search is indistinguishable from "no results."**
`src/lib/queries/participants.ts:141`, `:158`, `:185` and `src/lib/queries/members.ts:239` all
destructure `{ data }` and discard `error`. `searchParticipants` therefore never throws, so the
`catch` at `src/lib/participants/actions.ts:376` is unreachable and `searchParticipantCandidates`
always returns `ok: true`. The caller has no `else` branch
(`src/components/cases/add-participant-dialog.tsx:569`, `:599`), so a 42501 / PGRST / network
failure renders as *"Nenhum resultado. Você pode cadastrar um novo."* (`:877`, `:1037`). `profiles`
is on column-list grants on this project — a documented recurring 42501 source — and
`listLinkableOrgUsers` filters on `home_organization_id`, `is_active`, `is_admin`, so any grant
regression on those columns silently empties the *possui conta* roster. **No gate sees this:**
`next build`, lint, typecheck and vitest are all blind, and E2E never asserts *which* user was
linked (see MAJOR-3 / MINOR-4).

**(b) The deliberately-accepted scope limit.** `listLinkableOrgUsers`
(`src/lib/queries/members.ts:212-255`) rides the existing co-membership arm of
`profiles_select_self_or_admin`, so for a plain `staff_admin` the roster is *their own perimeter ∩
the org*, not the org. **My assessment: this needs closing before pilot, not after.** An ethics
committee investigates across the hospital by definition — a coordinator seating a surgeon
reported by the CCIH shares no commission with them and will not find them. The failure mode is
not "the picker is empty and I stop"; it is "the picker is empty so I tick *não possui conta*",
which is precisely the outcome (a) and `ca2bdb6` were written to prevent. The scope limit is
well-reasoned and honestly documented in the function header — it is the *consequence* that makes
it unacceptable, and that consequence is now measured rather than argued.

Minimum I would accept for (b) short of widening the policy: **the `no_account` confirmation must
be unreachable when the search failed**, and the *possui conta* lane must distinguish "no matches"
from "I could not ask." Fixing (a) is a precondition for that and is cheap.

Secondary defects in the same function: the roster is anchored on `profiles.home_organization_id`
rather than membership, so a person working in the org under a different home org is invisible
(ADR 0097 AFF makes affiliation a visibility input — this query does not consult it); and
`.limit(500)` truncates with no signal.

## MAJOR-3 · The ADR 0108 D6 guard has no falsifiable E2E proof — its two gating assertions are vacuous

`e2e/ethics-e4-participants.spec.ts:443` and `:463` assert `expect(submit).toBeDisabled()` to prove
submit stays disabled until the linkage choice is made. But the predicate is

```ts
const canSubmit = hasParticipantSelection && roleId !== "" && linkageOk && !isPending
```
(`src/components/cases/add-participant-dialog.tsx:678`), and `roleId` initialises to `""`
(`:516`). The helper only selects **Papel** at spec `:468` — *after* both assertions. So at `:443`
and `:463` the button is disabled for a reason that has nothing to do with linkage.

**Delete `linkageOk` from `canSubmit` entirely and every test in the file still passes.** No other
test asserts submit state as a function of linkage. D6 is the decision that says `no_account`
"must never be reachable by accepting a default" — its guard is currently unproven. Fix is cheap:
move the **Papel** selection above the two `toBeDisabled()` assertions (the role list derives from
`chosenType`, which is `"professional"` for that whole lane, so it is selectable earlier).

Given the project's own history — *"a silent return hides a live defect"*, *"a vacuity control
anchored on a defect evaporates"* — and given that the repo now ships a `lint:vacuous` gate that
reported 174 spec files / 0 findings, this one slipping through is worth noting: the gate checks
for *no unconditional assertion*, and here the assertion is unconditional but **satisfied by an
unrelated cause**. That is a class the gate cannot express.

## MAJOR-4 · The new `lint:client-server-imports` gate does not close BUG-FBE-005's class

Commit `7dc2a72`. The gate's construction is genuinely good — the 7-arm self-test *refuses to run*
(`exit 2`) if the type-erasure or comment-stripping logic breaks, RULE 1 (`'use server'` terminates
traversal) is correct and load-bearing, and it was proven able to fail against the real chain
(revert to `1a5823a^` → 4 findings, exit 1). It is not decorative. But:

- **Its server signal is the `server-only` literal only** (`scripts/check-client-server-imports.mjs:67`).
  Measured on this tree: **30 files carry the marker; 47 files import `@/lib/supabase/server` and
  carry neither `server-only` nor `"use server"`** — including nearly all of `src/lib/queries/*`
  and, pointedly, **`src/lib/queries/members.ts`, the module ETH·E4 just extended.** Exporting any
  runtime value from `members.ts` and importing it from `add-participant-dialog.tsx` aborts
  `next build` while the gate prints `OK (0 findings)`. That is BUG-FBE-005's exact shape, in the
  same feature surface, one file over.
- **`export … from` is not traversed** (`:88` requires the literal `import … from`; `:115` walks
  `valueImports` only). A barrel that re-exports a runtime value from a `server-only` module is
  invisible — and the script's own failure text (`:200-202`) *names* that hazard as the thing not
  to do. Ten real `export … from` sites already exist in `src/`.
- Also not matched: dynamic `import()` / `await import()`, `require()`, bare side-effect imports;
  `isClient`/`isServerOnly` read **raw** text (not comment-stripped), so a doc-comment line
  beginning `import "server-only"` misclassifies a client-safe module.

Not phase-blocking on its own — nothing is currently broken (`npm run lint` passes, 472 client
modules / 30 server-only modules scanned, 0 findings). It is MAJOR because it was **presented as
the containment** for a recurring build-aborting defect and does not contain it. Either widen the
server signal (treat `@/lib/supabase/server` / `next/headers` importers as server modules) and add
re-export traversal, or downgrade the claim in the gate record so nobody relies on it.

## MAJOR-5 · The write-door coverage achieved this phase is **one-time and by hand** — it is not standing

The mid-build correction to ADR 0108 and plan §7 is **correct, and I verified it rather than
accepting it.** The census's live domain is
`t.typname = 'bool' OR (p.proretset AND has_function_privilege('authenticated', …))`
(`supabase/tests/mutation/p0-authz-invariant.sh:245-250`). Measured:

| Door | returns | in census domain |
| --- | --- | --- |
| `public.ensure_professional_participant` | `uuid` | **false** |
| `public.create_external_participant` | `uuid` | **false** |
| `public.set_primary_subject` | `void` | **false** |
| `app.can_read_professional_profile` | `bool` | true |
| `app.can_manage_professional` | `bool` | true |

So `ARM=census`'s HOLDS is vacuous over all three write doors, exactly as ADR 0079 Amendment 5 and
FUP-AFF-1 say. **The correction was right and the neutralization oracle was the right substitute.**

The finding is what happens next. `supabase/tests/mutation/p0-authz-writepath-audit.sh` is the
**standing** harness for exactly this class — value-returning DEFINER raise-guards — and its ARM-1
door list is **hand-enumerated from a captured snapshot**. It contains **zero** mentions of the
three E4 doors. So the next phase's write-path sweep is blind to them, and the coverage this phase
achieved evaporates with this session. This is the ADR 0079 *"standing in prose alone once meant it
ran once in three weeks"* shape, recurring.

**Ask:** add the three doors to `p0-authz-writepath-audit.sh` ARM 1 (bespoke neutralizations, since
two return `uuid` and a blanket body-swap risks a NULL-propagation ERROR rather than a BLIND), or
— better — derive ARM 1's population from the catalog rather than a snapshot, so a new door of the
class cannot be born outside it.

**Also stale:** `supabase/tests/mutation/authz-neverclled-door-allowlist.txt:109` still lists
`set_primary_subject(p_case_participant_id uuid)`. ETH·E4 gave that door its first caller. The
entry is now inert, which means if the caller is ever removed, `ARM=floor` stays silent. Remove it.

## MAJOR-6 · Mint-then-fail leaves an orphan, and retrying mints a duplicate

`src/components/cases/add-participant-dialog.tsx:692-745`. `submit()` performs up to three
sequential writes (`createProfessionalProfile` → `setProfessionalLinkState` → `addCaseParticipant`;
or `createExternalParticipant` → `addCaseParticipant`) with no compensation and no memo of what
already succeeded. If step 2 or 3 fails, the banner correctly shows (no false success) but the
dialog stays open in `"create"` mode with the created id discarded — so pressing **Adicionar**
again creates a *second* profile / participant.

For the external lane this is a **guaranteed** duplicate on every retry, because
`create_external_participant` is CREATE-ALWAYS by design (ADR 0108 D8) — the design decision is
sound; the retry path turns its accepted cost into an automatic one. For the professional lane the
first step is `create_professional_profile`, so a retry mints a duplicate Class-2 identity, which
then fragments the prior-case history the 1:1 registry index exists to keep whole.

Minimal fix: hold the created id in state/ref and skip the create step on retry.

---

# MINOR

- **m1 · Rule 9 seam.** `listCaseParticipantRolesForAdmin` (`src/lib/vocabulary/actions.ts:174-198`)
  is a pure read living in a `'use server'` module, consumed by
  `src/app/o/[org]/manage/tipos-de-caso/page.tsx:62`. Its sibling read correctly lives at
  `src/lib/queries/participants.ts:217`, and the doc comment at `vocabulary/actions.ts:170` even
  contrasts the two. Secondary: being exported from a `'use server'` module publishes it as a
  callable Server-Action endpoint, and unlike every writer in that file it does not call
  `authorizeOrg` (bounded only by RLS `is_org_member`, so no cross-tenant leak).
  *Not flagged:* the direct `.from().insert()/.update()` writes in `vocabulary/actions.ts` **are**
  the house pattern (`src/lib/cases/actions.ts:194-225`), and both target tables carry RLS
  `*_admin_write` policies plus audit triggers — RLS is the boundary, as Rule 1 requires.
- **m2 · Rule 11, Class-2 identity: the widened read path is unaudited.**
  `get_case_professional` calls `log_audit_access('professional_profile.read', …)`. The direct RLS
  read used by `searchParticipants` (`src/lib/queries/participants.ts:141`) does not, and cannot.
  The unaudited-RLS-read gap is **pre-existing** (the `professional_profiles_select` policy always
  existed), but D5 widens its population from "case readers" to "every org manager" and E4 makes it
  a routine, per-keystroke path. ADR 0064/0065 describes Class-2 as "case-scoped RLS + audited
  reads"; after D5 the first half is no longer true and the second half does not cover the new
  path. Worth an explicit decision rather than inheritance.
- **m3 · a11y — `aria-describedby` never wired to error ids.** `useFieldIds` is built to emit it
  (`src/components/ui/field.tsx:103-133`) but every E4 call site passes only `.controlProps.id` and
  sets `aria-invalid` by hand: `add-participant-dialog.tsx:922`, `:1094`,
  `case-participant-role-manager.tsx:354`, `:368` (which wires `descriptionId` but never `errorId`).
  `FieldError` carries `role="alert"`, so the message *is* announced when it appears; a user
  tabbing back to the invalid field hears nothing. CLAUDE.md §8 requires accessible inputs.
- **m4 · a11y — the typeahead announces neither result count nor loading.**
  `add-participant-dialog.tsx:282-393`. Keyboard operation and ARIA structure are otherwise
  complete and correct (ArrowUp/Down with wraparound, Enter, Escape, `role="combobox"` +
  `aria-expanded`/`-controls`/`-activedescendant`/`-autocomplete`, visible focus). What is missing
  is any `aria-live`/`role="status"`: *"Buscando…"* (`:379`) and the empty hint (`:383`) are plain
  `<p>`s **outside** the listbox that `aria-controls` points at.
- **m5 · Three of five mintable external types are unseatable out of the box.**
  `EXTERNAL_PARTICIPANT_TYPES` offers all five (`src/lib/forms/reference-constants.ts:132`), and the
  `participants_sensitivity_derives_type` CHECK admits all five, but the seeded
  `case_participant_roles` cover only `external_person` (3 roles) and `regulatory_body` (1). A
  coordinator can mint a `department` / `institution` / `other` participant and then find the role
  select empty — a dead end inside a dialog. T5 lets an org admin add roles, which is the right
  long-term answer, but the out-of-box product should not offer a type it cannot seat. Either seed
  a generic role for the three, or filter the type list to types with at least one active role.
- **m6 · E2E vacuity, three smaller instances.**
  `e2e/ethics-e4-participants.spec.ts:581` — `if (await alert.isVisible().catch(() => false))` is a
  skip-without-asserting branch *and* a swallowed error *and* a non-auto-waiting point-in-time check
  (a live flake source against the Radix mount); PRIMARY-MOVE's guard is only real because
  PRIMARY-MOVE-CANCEL (`:965`) asserts it properly. `:1032` — UNKNOWN-RESOLVE's closing assertion
  (`Resolver vínculo` `toHaveCount(0)`) passes if the row vanished entirely; needs a positive twin.
  `:394` — `pickFromTypeahead` uses a page-wide substring `getByRole('option').first()`, and native
  `<select><option>` elements in the same dialog also carry role `option`. Nothing anywhere asserts
  **which** platform user was linked in PROF-CREATE or UNKNOWN-RESOLVE — a picker returning the
  wrong person passes. (A *null* link does fail, since `linkageOk` requires `Boolean(linkUserId)`.)
- **m7 · KBD-1 has one no-op keyboard step.** `:1094` `arrowSelectNative(…, 'Pessoa externa')`, but
  `extType` initialises to `"external_person"` whose label *is* "Pessoa externa" — the loop matches
  on iteration 0 and presses zero keys. The **Tipo** select is tabbed to but never keyboard-operated.
  The rest of KBD-1 is genuine (see CLEAN below).
- **m8 · A structurally identical focus/Escape hole outside E4.**
  `src/components/accreditation/evidence-picker.tsx` renders its own `DialogContent` (`:108`)
  containing a `role="combobox"` typeahead (`:424`) with a **synchronous** `onBlur={settle}`
  (`:437`) and **no** `onEscapeKeyDown` suppressor — i.e. both root causes of BUG-ETHE4-FOCUS-1,
  in one file. Not verified live; flagged as structurally identical, not as a confirmed bug.
  Out of ETH·E4's scope — worth a follow-up, not a change request against this phase.
- **m9 · Two names for one person on one screen.** The roster correctly renders live-then-snapshot
  (ADR 0108 D3), but the D7-untouched rail card renders only the snapshot
  (`case-primary-subject-panel.tsx:46`). After an `update_professional_profile` rename, rail and
  roster disagree. A consequence of D7, not a violation of D3.
- **m10 · `revalidatePath` covers one of two routes.** `src/lib/participants/actions.ts:195-201`
  revalidates only `manage/cases`; the roster is also mounted on the staff `casos` route. The
  acting user is unaffected (`router.refresh()`), so this only leaves the other route stale for
  other viewers.
- **m11 · `!` assertions.** `add-participant-dialog.tsx:756` and
  `case-participant-role-manager.tsx:304` — both guarded, neither can mask a dropped column.

---

# Verified CLEAN — stated explicitly

These are the items I actively tried to break and could not. A clean negative is the point.

### Focus item 1 — the D5 keystone **is** falsifiable (I proved it myself)

I neutralized the arm in the live catalog (transaction-local, rolled back) by replacing
`if v_org is not null and app.can_manage_professional(v_org, p_uid) then` with `if false then`, then
ran suite 321:

```
ORACLE A — D5 org-manager arm REVERTED     ok=57  NOT-ok=2
  not ok 19 - K3a ⭐ THE WIDENING: an org manager who is NOT a case reader READS the profile
  not ok 20 - K3a: …including the CRM
```

Backend's report is accurate. K3a is a real keystone, not a no-regression test — and the suite
header explains *why* the plan's own literal wording for keystone 3 could not have failed. K3b
(the containment: a plain org member still gets 0 rows) is the right twin. **The keystone is
sound; the ADR clause it defends is not — see P0-1.**

### Focus item 2 — `set_primary_subject`: surgical deltas only, properties intact

I reconstructed the door's **full lineage** rather than trusting either the file or the ADR:

1. `20260720001010` created it, gate `is_staff_admin_of(v_commission) or is_commission_admin_of(v_commission)`.
2. `20260722000000` `create or replace`d it, adding the `HC0F1` exclusion gate.
3. `20260916000000` (QO·B M7) **runtime-rewrote** it via `pg_get_functiondef()` + regex, stripping
   ` or app.is_commission_admin_of(v_commission)` and leaving the now-redundant parentheses
   `if not (app.is_staff_admin_of(v_commission)) then`.

**The E4 file's base carries exactly that fingerprint** — the redundant parens and the absent
tenancy token. The author took the **post-M7 catalog body**, not the migration text. That is the
single most important thing to get right here and it was gotten right.

Diff between the pre-E4 live body and the shipped body is exactly: two added declarations
(`v_participant`, `v_role`), two added select-list columns, one `perform
app.assert_respondent_linkage_resolved(…)`, one demote `UPDATE`, and comments. **Nothing removed.**
Gates (`HC0E4`/`HC0F1`), error codes, the `unique_violation` → `HC0E7` backstop, and the audit event
name `case.primary_subject_set` are all present in the live body.

Properties from the catalog: `prosecdef = t`, `proconfig = {search_path=app, public, pg_catalog}`,
owner `postgres`, `proacl = {postgres=X/postgres, service_role=X/postgres, authenticated=X/postgres}`
— identical to its three siblings, and preserved by `CREATE OR REPLACE` semantics (the file contains
no `revoke`/`grant`, correctly). 321 K8 re-pins `prosecdef` and the anon-EXECUTE negative.

**I re-ran M7's own postcondition (a) against the post-E4 catalog** over all 29 CUT-side doors:
**NONE** carries `is_commission_admin_of` or `is_tenancy_admin_of`. The E4 replace did not resurrect
the tenancy arm. That was the real risk and it did not fire.

Both deltas are independently falsifiable:

```
ORACLE E — DELTA 2 (linkage re-assert) REMOVED    ok=57  NOT-ok=2  (K6b ×2)
ORACLE F — DELTA 1 (demote incumbent) REMOVED     ok=55  NOT-ok=4  (K6a ×3, K6b ×1)
```

**Census updates, both conscious and by name.** `320` went 10→12 with all twelve members
enumerated in the comment — I re-derived the list from the live catalog and it matches **exactly**,
name for name. `207` went 30→31: this is a *deliberate loosening* of a protective assertion
(sa_y, previously called "a foreign reader", is in fact an org manager under `test_helpers`'
one-org fixture and now reads), and the block correctly **re-points the protective intent at
`st_y`**, a plain member of the sibling commission — so if the arm were ever widened from "org
managers" to "org members", that assertion reds. `229` was **not** modified, and its door census
was unaffected — correct, since the new mint doors are org-scoped, not case-scoped. That was
verified rather than assumed, exactly as the plan required.

### Focus item 3 — the neutralization oracle **is** sufficient for all three write doors

I ran it myself, per door, in rolled-back transactions:

```
ORACLE B — ensure_professional_participant HC0E4 gate OPENED   ok=57  NOT-ok=2
ORACLE C — create_external_participant     HC0E4 gate OPENED   ok=58  NOT-ok=1
ORACLE D — set_primary_subject             HC0E4 gate OPENED   ok=58  NOT-ok=1
ORACLE G — mint-door audit_write REMOVED (Rule 11)             ok=58  NOT-ok=1
```

Every gate is covered; opening any of them is noticed. Baseline is **59/59 green**. Dropping the
1:1 unique index aborts the door outright (the `on conflict` spec fails), which K4 also pins via a
`23505` `throws_ok`. **Yes — the oracle is genuinely sufficient for these three doors, this time.**
The insufficiency is temporal, not logical: see MAJOR-5.

### Focus item 4 — FUP-ETH-CPF-1's latency claim is **correct**, independently verified

I did not take it on trust. From the catalog:

- `authenticated` grants on `professional_profiles`: **SELECT only** — no INSERT/UPDATE/DELETE, so
  no direct-DML write path.
- Functions writing `professional_profiles`: `create_professional_profile`,
  `update_professional_profile`, `set_professional_link_state`, `redact_professional_profile`,
  `app.trg_pin_respondent_retention`. **None mentions `cpf`** (regex over `prosrc` for
  `\mcpf\M` alongside `professional_profiles` returns empty).
- Local data: `count(*) = 1`, `count(cpf) = 0`.

So the column is unwritable through the product. **FUP-ETH-CPF-1 is correctly classified as a
follow-up, not a blocker** — and K3c's detector was proven able to fire against a planted writer,
which is the right discipline. **LGPD posture:** CPF is a national ID and Class-2 professional
identity under Rule 12; the correct remedy is the column-list grant, which is the same remedy P0-1
needs. I recommend closing both in one change rather than sequencing them.

### Focus item 5 — the three E2E-only defects

- **`8e5ebcd` (BUG-ETHE4-FOCUS-1) — fix is correct and complete, verified at the mechanism.**
  Two distinct root causes, both fixed at the root: a synchronous `onBlur` popup close racing Radix
  `FocusScope`'s focus handoff (deferred one tick, `add-participant-dialog.tsx:316`), and Radix
  `DismissableLayer` handling Escape in the **capture** phase before any nested bubble handler,
  making the pre-existing `stopPropagation()` structurally too late (fixed via
  `onEscapeKeyDown={suppressEscapeWhilePopupOpen}`). The obvious worry — that a capture-phase
  suppressor could swallow Escape from a nested or parent dialog — is unfounded in **both**
  directions: `DismissableLayer` invokes the callback only for the highest layer
  (`isHighestLayer` check in `@radix-ui/react-dismissable-layer`), so a higher layer handles its own
  Escape and a lower layer's callback never runs. Applied to both E4 dialogs. `stopPropagation` is
  correctly *not* called, so the popup still closes on the same keypress. **Within E4, no
  equivalent hole remains** — `TypeaheadField` is the only typeahead in the surface. Outside it: m8.
- **`ca2bdb6` (the *possui conta* picker) — right diagnosis, incomplete closure.** See MAJOR-2.
  The fix itself is correctly applied to both `CaseDetailView` mounts and inherited by
  `ResolveLinkageDialog`.
- **`1a5823a` (server-only value-import) — fix is correct and complete.** The const moved to the
  already-existing client-safe `reference-constants.ts` beside its siblings, deliberately **not**
  re-exported from the server module, with a comment left at the old site so the next author does
  not helpfully add one back. Equivalent holes elsewhere: MAJOR-4.

### Requirements coverage — all 8 E2E acceptance items COVERED

Verified by reading assertions, not titles: PROF-PICK (pick-existing), PROF-CREATE (create-inline,
also the PostgREST-reachability proof for `ensure_professional_participant`), EXT-CREATE,
EXT-REUSE (asserts the *same* `participant_id` across two seatings — the reuse arm, not a second
denunciante), REMOVE, CHANGE-ROLE (asserts the current role's menuitem **disabled**, and new role
present **and** old role absent), PRIMARY-SET / PRIMARY-MOVE / PRIMARY-MOVE-CANCEL,
UNKNOWN-RESOLVE (real before/after transition), KBD-1.

**KBD-1 is a genuine keyboard-only flow.** Zero `.click()` calls; every interaction is
`page.keyboard.press`/`.type`. `.focus()` appears nowhere in the spec except in two comments
explaining why it is banned — the project's documented "Playwright `.focus()` is not auto-waiting"
lesson was applied. Focus is asserted with web-first `toBeFocused()`. No `networkidle`. The
symptom-2 regression is pinned at `:1077`. (m7 is one no-op step inside an otherwise real flow.)

**FUP-ETH-1's acceptance criterion is met literally.** All three raw
`dbInsert('case_participants', …)` sites in `ethics-e3a-surfacing.spec.ts` are gone — along with
raw inserts into `professional_profiles` / `participants` / `professional_participants` that the
criterion did not even name. One caveat, recorded rather than charged: they were replaced by
`callRpc(request, 'add_case_participant' | …)` under a real user JWT — the real doors, but invoked
from the test, **not driven through `CaseParticipantsPanel`**. The plan says of this replacement
"*This replacement is the proof the panel is reachable*" (§5.2). It is not; an RPC call proves the
door. That proof is delivered instead by `ethics-e4-participants.spec.ts`, which does drive the UI.
The criterion is met; the stated rationale is met by a different file. **One raw participant insert
remains in `e2e/`** — `ethics-e1-access-spine.spec.ts:577-594`, a service-role throwaway deleted at
`:617`, legitimate because the test under it is *about* `add_case_participant`'s authority. Naming
it so it is not mistaken for a miss.

### Other rules

- **Rule 1 (RLS is the boundary).** Both vocabulary tables carry `*_admin_write` `ALL` policies on
  `is_admin() ∨ is_org_admin_of(…)`; the UI's `authorizeOrg` is defense-in-depth, not the gate. No
  service-role key reachable client-side (`npm run lint` and the client/server gate both clean).
- **Rule 8.** `src/lib/types/database.ts` regenerated — exactly the two new RPC signatures added,
  nothing else drifted.
- **Rule 10 (pt-BR).** **Clean.** Every user-visible string across all six components, both action
  modules and both admin dialogs is pt-BR, including transient states and every `aria-label`. The
  only English on screen is `role.key`, deliberately rendered as an identifier in a `<code>` chip.
  Code, comments and commits in English.
- **Rule 11 (auditability).** `ensure_professional_participant` emits
  `professional_profile.participant_minted` on the org chain (falsifiable — ORACLE G);
  `create_external_participant` emits `external.participant_minted`; `set_primary_subject` keeps
  `case.primary_subject_set`. **Both vocabulary tables carry AFTER INSERT/UPDATE/DELETE audit
  triggers** — `trg_audit_case_participant_role` (pre-existing) and
  `trg_audit_case_type_terminology` (added by `20260919000500`), so the direct-DML writers are
  covered at the table, not the caller. Exception noted at m2.
- **`ensure_professional_participant`'s race arm is correct.** Targeted `on conflict
  (professional_profile_id)`, never the untargeted form; the losing branch deletes its orphaned
  `participants` row and re-reads under a fresh READ COMMITTED snapshot. I traced both interleavings
  (winner commits / winner rolls back) and both resolve correctly.
- **pgTAP 321 keystones are falsifiable, not decorative** — eight independent neutralizations, eight
  distinct RED signatures. The suite also asserts its own **flags** before relying on them
  (`case_participants`, `audit_trail` — the latter because `app.audit_write` returns early when off,
  which would make the audit keystones measure the flag), and carries explicit PRE-flight
  assertions so the K2/K3/K5/K6 denials deny for the right reason. This is the standard the project
  has been reaching for.
- **Authz ARMs, re-run by me:** `ARM=census` HOLDS (450 live gates / 461 verdicts, no unswept
  newcomer) · `ARM=hat` HOLDS (self-test 6/6, 3 pre-existing reasoned allowlists, none from E4) ·
  `ARM=floor` HOLDS (79 never-called doors, all allowlisted). `npm run lint` 0/0 including
  `lint:css-vars`, `lint:client-server-imports` (472 client / 30 server-only modules, 0 findings)
  and `lint:vacuous` (self-test 42/42, 174 spec files, 0 findings). `npm run typecheck` clean.
  No `any` anywhere in the audited surface; no `as unknown as`.

---

# Could NOT verify

- **The full `e2e:prod` gate (1005 passed / 0 assertion failures / 17 batches) and the 70/70
  re-run of the infra-lost batch.** I did not re-run them. The PROGRESS.md record does the right
  things — it reconciles each batch's own `accounted N/N` **first**, checks for `reset FAILED` and
  batch-number gaps, and explicitly refuses to count the 62 infra-lost tests as passes — which is
  the discipline this repo's "a gate summary can hide unrun tests" lesson demands. I accept it as
  reported and flag that acceptance.
- **`npm run test:db` in full (5778/5778 across 182 files).** I ran suite 321 directly (59/59) and
  re-derived 207's and 320's census claims from the catalog, but did not execute the whole suite.
  Suites 228 / 229 / 314 staying green after the `set_primary_subject` replace is reported by
  backend; I verified the *structural* basis for it (ACL, `prosecdef`, gates, the M7 tenancy
  postcondition) rather than the run.
- **The diff-scoped door sweep over `can_read_professional_profile` + its 2 policies (0 BLIND /
  0 ERROR).** Not re-run — ~1 min/gate was affordable, but the finding it would surface
  (is the widened predicate keystoned?) I answered more directly and more strongly with ORACLE A.
- **Remote (`db push`) state.** Plan §6 step 3 — the read-only remote check for duplicate
  `professional_participants.professional_profile_id` before any push — is **still outstanding** and
  remains mandatory. The `20260919000100` unique index is data-dependent: it passes a 0-row local
  reset and can fail 23514/23505 on the data-bearing remote. Local `count = 1` proves nothing here.
- **m8** (`evidence-picker.tsx`) is a structural read, not a live reproduction.

---

# What would clear this review

1. **P0-1** — close the `retention_pin_reason` / `retention_pinned_at` disclosure, and rewrite ADR
   0108 D5's exposure argument from `information_schema.column_privileges` rather than prose. Add
   the column-set keystone. Closing FUP-ETH-CPF-1 in the same change is the efficient path.
2. **MAJOR-1** — one line: `default: return MESSAGES.generic`.
3. **MAJOR-2** — surface search failures distinctly from "no results" (2(a) is the cheap half and a
   precondition for the rest); decide 2(b) explicitly — I recommend closing it pre-pilot.
4. **MAJOR-3** — move the **Papel** selection above the two `toBeDisabled()` assertions so the D6
   guard has a falsifiable proof.
5. **MAJOR-5** — put the three write doors into the standing write-path harness (or derive its
   population from the catalog); drop the stale `set_primary_subject` never-called allowlist entry.
6. **MAJOR-4** and **MAJOR-6** — fix, or downgrade the gate's claim in the record and file MAJOR-6
   as a tracked follow-up. Either is acceptable to me; silently carrying MAJOR-4 as "closed" is not.

MINORs are not blocking. m5 and m8 are natural follow-ups rather than in-phase work.

---

**VERDICT: CHANGES REQUESTED**

---
---

# Round 2 — re-review after remediation (2026-08-11)

- **Reviewed at:** `120318a` (6 commits after r1's `11d87e3`)
- **r1 verdict:** CHANGES REQUESTED (1 P0 / 6 MAJOR / 11 MINOR)

# VERDICT (r2): **CHANGES REQUESTED** — narrow

**The P0 is genuinely closed**, and closed better than I asked for: the lead caught that a
column-list grant alone is bypassed by a `SECURITY DEFINER` door, and backend *measured* that
requirement instead of arguing it. That was the right catch, and it was mine to have made — my r1
remedy named `get_case_professional` as "must stop returning `to_jsonb(whole row)` regardless", but
I filed it as a rider on the grant rather than as the co-equal half it is. Five of six MAJORs are
closed or acceptably closed.

This is **not** a re-litigation. Three specific things block, all small:

1. **MAJOR-2(a) is NOT fixed** — the exact failure the finding named survives, verified by me at
   the source line.
2. **MAJOR-6's professional lane rests on a premise the catalog contradicts.**
3. **A new finding of the FUP-SILENT-READ-1 class sits in the ETH·E4 roster read itself**, with a
   larger blast radius than the one that was fixed.

Everything else below is signed off, including both deliberately-open items.

---

## P0-1 — **CLOSED.** Verified four ways, and the divergence detector works in both directions

From the live catalog, not the migration:

- `professional_profiles` **has no table-level SELECT** for `authenticated`
  (`relacl = {postgres=arwdDxtm/postgres, service_role=arwdDxtm/postgres}`). The grant is
  column-list: **12 of 17** columns. Revoked set computed by differencing `pg_attribute` against
  `information_schema.column_privileges`: **`cpf`, `redacted_by`, `retention_pin_reason`,
  `retention_pinned_at`, `user_id`** — exactly the five claimed.
- `get_case_professional` no longer returns `to_jsonb(v_profile)`; it returns an explicit
  `jsonb_build_object` whose 12 keys are **set-identical** to the granted 12. I compared both sets
  element-wise.
- `redact_professional_profile` now sets `cpf = null`.
- **No views** over `professional_profiles` (a non-`security_invoker` view would bypass both RLS
  *and* the column grant — checked via `pg_depend`/`pg_rewrite`; there are none). Of the 12
  functions that read the table, **only `get_case_professional` projects data**; the rest return
  `void`/`uuid`/`boolean`/`trigger`. **No sibling arm was missed.**

**Live re-probe of my r1 P0 scenario** — same persona (`chefe.farm@test.local`, `staff_admin` of
Farmácia, Rede A, no ethics anything), same planted retention pin, ACT hat set, rolled back:

| | r1 (pre-fix) | r2 (post-fix) |
| --- | --- | --- |
| `can_read_professional_profile` | true | true *(D5 intact — the feature survives)* |
| `full_name`, `license_number` | read | **read** |
| `retention_pin_reason` | **`ethics_decision_issued`** | **42501** |
| `cpf` | read (NULL) | **42501** |
| `user_id` | read | **42501** |
| `get_case_professional` keys | whole row | **exactly the granted 12** |

**Falsification — I ran four oracles against pgTAP 321 (all rolled back), not two:**

| Oracle | Result |
| --- | --- |
| P1 · table-wide grant restored (the pre-fix state) | **6 RED** — tests 26-30 + 39 |
| P2 · projection reverted to `to_jsonb(v_profile)` | **6 RED** — tests 34-39 |
| **P3 · (mine) grant `cpf` back, projection unchanged** | **2 RED** — 28 + 39 |
| **P4 · (mine) revoke a *projected* column (`specialty`)** | **1 RED** — 39 |

P1 and P2 reproduce the lead's two reported REDs exactly. **P3 and P4 are the ones I care about:**
they prove the `set_eq` keystone catches grant/projection divergence in **both** directions, which
is the property that makes this fix durable rather than a point-in-time patch. Baseline 321:
**75/75**. The over-revocation twin is present and real — the fix removed the leak, not the feature.

I also confirmed the `ok(j ? 'cpf' is false)` idiom parses and is falsifiable
(`'{"cpf":1}'::jsonb ? 'cpf' is false` returns `f`; absent returns `t`), rather than assuming the
precedence.

**Residual, recorded so it is not discovered later as a surprise:** the retention fact is still
reachable through `audit_log` — `app.trg_pin_respondent_retention` emits
`professional_profile.retention_pinned` with `commission_id = null` and the org id. Probed live:
the **sibling-commission `staff_admin` sees 0 rows**; an **`org_admin` sees it**, because
`audit_log_select`'s `(hospital_id IS NULL AND commission_id IS NULL AND is_org_admin_of(...))` arm
admits them. That is the designed oversight posture for a population that could already read the
whole org chain, so I rate it **INFO, not a finding** — but the P0 remediation is complete for
staff_admins, not for org_admins, and the difference should be stated rather than implied.

**ADR 0108 D5 amendment reviewed.** The false clause is struck through in place with the reason
recorded ("checkable, checked with the wrong instrument, and passed review"). That is the right
form — it preserves the error, which is what makes it useful.

---

## Blocking items

### B-1 · MAJOR-2(a) is **NOT FIXED** — the error travels two hops further and is dropped at the third

The claim relayed to me was "all four swallowed errors in `participants.ts` now throw." That is
**true and is not the finding.** The finding was about what the coordinator sees.

- Layer 1 OK — `src/lib/queries/participants.ts` throws at `:159`, `:174`, `:211`, `:262`.
- Layer 2 OK — `src/lib/participants/actions.ts:373-378` catches and returns `{ ok: false, error }`.
- Layer 3 **fails** — the dialog discards it. Verified by me at the source:

```tsx
src/components/cases/add-participant-dialog.tsx:589   if (res.ok) setProfResults(res.candidates);
src/components/cases/add-participant-dialog.tsx:619   if (res.ok) setExtResults(res.candidates);
```

No `else`. `res.error` is never read; `setError` is never called. The rendered string is decided at
`:912-916` and `:1072-1076`, which key **only** on `profQuery.trim().length >= 2`:

> `"Nenhum resultado. Você pode cadastrar um novo."`

That is verbatim the sentence r1 said must not appear on a failed search, and the next click is
*Cadastrar novo profissional* then the linkage fieldset then **Não possui conta** — the exclusion
vacuously satisfied. **Fix: an `else` that surfaces `res.error`, and an error-distinct empty state.**

Genuinely fixed by a different mechanism, and worth crediting: `resolve-linkage-dialog.tsx` runs no
server search — its roster is the `platformUsers` prop from `listLinkableOrgUsers`, which now
throws (`members.ts:255`) and reaches a real route error boundary. That also covers the *add*
dialog's `PlatformUserField`. Only the two typeaheads above remain blind.

### B-2 · MAJOR-6's professional lane is uncovered, on a premise the catalog contradicts

The external lane **is** fixed (`add-participant-dialog.tsx:522-526`, `:563-564`, `:749-778`) — the
minted `participantId` is retained and reused, and the setters commit before the failing call.

Commit `7900f51` justifies leaving the professional lane alone: *"The professional lane is immune
(its mint is get-or-create)."* **I checked `pg_proc` directly. It is a bare INSERT:**

```
public.create_professional_profile -> insert into public.professional_profiles (...) returning id into v_id;
```

No lookup, no `on conflict`. `ensure_professional_participant` is the get-or-create door, but it
mints the *`participants`* row from an **already-existing** profile — a different door doing a
different job. `professionalProfileId` is a plain `let` re-declared per `submit()` (`:707`), so a
failure at step 2 (`setProfessionalLinkState`, `:735`) or step 3 (`addCaseParticipant`, `:789`)
discards it and the retry re-enters at `:712`:

- **CRM blank** (permitted — only `fullName` is required): the retry mints a **duplicate
  `professional_profiles` row**, fragmenting the prior-case history the 1:1 registry index exists
  to keep whole.
- **CRM entered**: `professional_profiles_license_uniq` raises 23505, which falls to the generic
  message — a **permanent dead end**. The profile exists, the dialog holds no id for it, every
  retry fails identically. Arguably worse than the duplicate.

Backend was right to decline an atomic `seat_professional` door — ADR 0108 D1 rejects it on sound
grounds. The fix is the same client-side memo already written for the external lane, extended to
cover steps 1 and 2.

### B-3 · NEW — `src/lib/queries/cases.ts:1333` silently empties the **entire ETH·E4 roster**

Found while auditing the FUP-SILENT-READ-1 remediation. Twenty-five lines *above* the `profRows`
read that was just fixed, in the same function, feeding the same UI:

```ts
const { data: partRows } = await supabase.from('case_participants')…   // no `error`
```

On failure `partRows` is null, so `participants` is `[]` (`:1387`) — **the case renders with an
empty participant roster and no error at all.** Strictly larger blast radius than the bug that
*was* fixed: a coordinator sees a case with no participants and re-seats people who are already
seated.

This is the roster ETH·E4 exists to build, so it is in scope for this phase rather than for
FUP-SILENT-READ-1's residue. (`src/lib/queries/members.ts:183`, `listAddableMembers`, is the same
shape but pre-dates E4 — that one belongs in the follow-up.)

The sweep that produced FUP-SILENT-READ-1 was the right instinct and found real defects; it just
stopped at the function that had already failed rather than at the read directly above it.

---

## Signed off in r2

| Item | r2 verdict |
| --- | --- |
| **MAJOR-5** — write doors in the standing harness | **CONFIRMED, and done better than the siblings.** All three are in `GUARD_KEYS` with signature maps and neutralization cases (`p0-authz-writepath-audit.sh:120`, `:140-142`, `:348-375`). Uniquely among the eleven, they are **derived from `pg_get_functiondef` at runtime and assert the splice matched**, so a renamed gate aborts loudly instead of neutralizing nothing and reporting BLIND — the other ten pin transcribed bodies that go stale silently. The stale `set_primary_subject` never-called allowlist entry is removed with a note. |
| **MAJOR-3** — D6 guard falsifiable | **CONFIRMED.** Papel is selected at spec `:462`, before both assertions; at `:469` and `:490` every other conjunct of `canSubmit` is satisfied, so only `linkageOk` can be the cause. *Residual (MINOR):* the `possui_conta` arm (`:472-483`) has no `toBeDisabled()` between checking the radio and picking the user, so `linkageOk`'s `Boolean(linkUserId)` half is still ungated — deleting it leaves the suite green. |
| **MAJOR-4** — client/server gate | **CONFIRMED as claimed.** Ran it: self-test **10/10**, 472 client / **124** server modules, 0 findings. The set is derived (marker **OR** `@/lib/supabase/server` / `next/headers`), not listed; `src/lib/queries/members.ts` is now in it; `export * from` and `export { x as y } from` are value edges with type-only correctly erased. *Three constructible bypasses remain (MINOR):* `isClient` reads only the **first 400 bytes**, so a module header longer than that — this repo's convention — hides `"use client"` and the file is never scanned; dynamic `import()` / `require()` are not edges; `stripComments` is not string-literal-aware. The 400-byte window is the realistic one. |
| **m6 (a)-(d)** | **CONFIRMED**, all four. The `isVisible().catch` probe is replaced by an explicit `expectConfirmation` parameter with both arms asserting; UNKNOWN-RESOLVE has a positive twin plus a DB identity assertion; `pickFromTypeahead` is scoped to the named listbox (and the app really does set that `aria-label`); PROF-CREATE and UNKNOWN-RESOLVE now assert **which** user was linked. |
| **m6 (e) / m7** | **NOT FIXED** (MINOR). `arrowSelectNative` at spec `:1178` still presses zero keys — `extType` initialises to the label being selected, so the loop matches at iteration 0. Commit `b15ad85` is candid about this; the discrepancy is in the summary relayed to me, not in the work. KBD-1 still never proves the **Tipo** select is keyboard-operable. |
| **MAJOR-1** | **PARTIAL** (MINOR). `vocabulary/actions.ts:143-149` default now returns `MESSAGES.generic` — that file is clean. `participants/actions.ts` was untouched: `:187` (`P0002`) and `:189` (`23514`) still prefer `error.message`. **No door on this platform raises `P0002` deliberately** (zero `pg_proc` hits), so that arm is engine English 100% of the time; the `23514` arm forwards `new row for relation "…" violates check constraint "…"` into both dialogs' error banners. Two lines. |
| **Rule 8 / 10 / 11, ARMs, build** | Re-run by me post-fix: `ARM=census` **HOLDS** (450/461) · `ARM=hat` **HOLDS** (self-test 6/6, same 3 pre-existing allowlists) · `ARM=floor` **HOLDS** (79 never-called, all allowlisted). |

### pgTAP count — verified independently, and the flakiness has a cause

The lead asked me to re-verify counts rather than trust a summary. I did, and **reproduced the
flake before eliminating it**:

- On the DB as I found it (post-`e2e:prod`): `Files=182, Tests=5746`, **Result: FAIL** —
  `252_authz_p0_isolation.sql` exited 3 with *"planned 48 tests but ran 0"*.
- After `supabase db reset --local` (353 migrations registered = 353 files, max
  `20260919000600`): **`Files=182, Tests=5794`, Result: PASS.**

So the intermediate short counts are **not** mysterious: they are the documented E2E-mutated-DB
class that CLAUDE.md §6 step 1 requires a fresh reset to avoid. Treat any pgTAP run that did not
follow a reset as **void** rather than as flaky — the distinction matters, because "flaky" invites
re-running until green while "void" tells you what to fix. **5794/5794 confirmed.**

*(Disclosure: I ran `supabase db reset --local` on the shared local stack, and installed `pgtap` +
`test_helpers` for the direct 321 runs. The tree is now on a clean reset.)*

---

## The two deliberately-open items — my judgements

### 1 · MAJOR-2(b), the picker scope limit — **NOT a blocker**, conditional on B-1

**Recommendation: documented pre-pilot follow-up, not a phase blocker.** I am revising my r1
"close it pre-pilot" to "close it before pilot onboarding, tracked" — and the reason is a catalog
check I should have run in r1 rather than reasoning from the failure mode.

**The population where the scope limit bites is very nearly disjoint from the population where the
automatic impedimento is load-bearing.** Verified:

- The exclusion only protects against a respondent who **can read the case**. Case read resolves
  through `app.has_case_capability(...,'read_case_content')`; there is **no `case_access` flag row
  in `app.feature_flags` at all**, so the flag-OFF member branch governs — case read comes from
  **commission membership**.
- A respondent who is a member of the coordinator's commission is **visible in the picker**:
  `profiles_select_self_or_admin` carries
  `is_active(auth.uid()) AND EXISTS (memberships them WHERE them.commission_id IS NOT NULL AND
  them.principal_id = profiles.id AND app.is_member_of(them.commission_id))`.

So the coordinator who most needs the impedimento — investigating a fellow committee member — *is*
the coordinator whose picker finds them. The surgeon from another commission, whom the picker
misses, cannot read the case anyway. The residual intersection is a per-case `grant_case_access` to
a non-co-member, which requires the coordinator to grant case access to the very person they just
asserted has no platform account; `record_recusal` remains as the manual remedy.

**The condition matters, though.** My r1 severity rested substantially on (a) *compounding* (b): a
system that lies about the roster turns a bad human decision into an inevitable one. **(a) is not
fixed (B-1).** So: (b) is not a blocker **once B-1 lands**. Until then the two together still are.

Two cheap things I would attach to the follow-up rather than to the phase: the `no_account`
confirmation copy should say the roster may not include everyone in the organization (it converts a
silent incompleteness into a named one); and `listLinkableOrgUsers` anchors on
`profiles.home_organization_id`, which ADR 0097 (AFF) made insufficient — hospital affiliation is a
visibility input and this query does not consult it.

Escalating the `profiles_select_self_or_admin` widening to the PO rather than letting `backend`
take it was the right call.

### 2 · m2, the unaudited widened read path — **not a blocker; the P0 fix materially shrank it**

Honest update rather than a restatement: **the P0 remediation changed this calculus.** The
unaudited invoker-rights path now reaches only the 12 granted columns — name, CRM, region,
specialty, type, affiliation status, link state, timestamps. The facts that made m2 worth raising —
the case linkage, the national ID, the auth-account correlation — are now either revoked outright
or reachable only through `get_case_professional`, which **does** call `log_audit_access`.

What remains unaudited is professional credential data that ADR 0091 D1 already characterises as
"an already-org-readable name", org-scoped. That is a defensible reading of ADR 0065's
"audited reads" for Class-2 — but it is a *reading*, and ADR 0064/0065 also says "case-scoped RLS",
which after D5 is no longer true. **Stays MINOR.** What it needs is one line in ADR 0108 recording
the decision explicitly, so the next phase inherits a ratified position instead of an assumption.
PO escalation is appropriate; it should not hold the phase.

---

## What would clear r2

1. **B-1** — an `else` at `add-participant-dialog.tsx:589` / `:619` that surfaces `res.error`, and
   an empty state that distinguishes "no matches" from "the search failed". Two hops of the fix are
   already built; only the last one is missing.
2. **B-2** — extend the external lane's memo to the professional lane's steps 1 and 2. Correct the
   `7900f51` commit rationale in the record: `create_professional_profile` is a bare INSERT.
3. **B-3** — destructure and throw at `cases.ts:1333`.

MINORs (MAJOR-1's two arms, m6(e), the `possui_conta` gate assertion, the gate's 400-byte window)
are not blocking; fix or file, either is fine, but do not carry them as closed.

**I would expect r3 to be a read of three diffs, not a re-audit.**

---

**VERDICT (r2): CHANGES REQUESTED — narrow (3 blocking items, all small; P0-1 closed)**
