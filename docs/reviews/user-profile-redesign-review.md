# QA review — `feat/user-profile-redesign` (person-profile redesign · AFF3 · AUD1)

**Reviewer:** `qa` · **Date:** 2026-08-25 · **Range:** `8ecf51de..32fa326d` (9 commits, 47 files, +5122/−765)
**Verdict: CHANGES REQUESTED**

The two RLS widenings are *correctly bounded* — I verified that independently and adversarially, and
found no cross-org, cross-hospital or cross-tenant admission. The write boundary holds. The new pgTAP
keystones are genuinely falsifiable; I proved it by mutating the live catalog rather than trusting the
claim. Changes are requested for **one incomplete fix whose ADR ships a Consequence that is false as
written**, and for **two documentation-integrity defects that no gate can see** — the class this repo
pays for repeatedly.

**Method note.** The local DB arrived *without* either branch migration (last applied
`20261003002100`) — leftover from the counterfactual "migrations removed + `db reset`" experiment. I
ran a fresh `supabase db reset --local` before auditing; every catalog claim below is post-reset. All
ten lint gates, the three affected unit-test files (47 tests), and pgTAP 368+369 were re-run green by
me under Node 24. **Measured** = I ran it; **read** = I read it and did not execute it.

---

## BLOCKING

### B1 · AUD1's fix does not reach one live writer, and ADR 0146's superset Consequence is false — *measured*

`app.trg_audit_standard_ownerships` (live catalog, `prosecdef = t`) writes **hospital-tier** audit rows
naming the hospital but **no organization**, at all three of its call sites:

```
perform app.audit_write('standard_ownership.created', 'standard_ownership', new.id,
  null, 'Comissão responsável atribuída', app.audit_diff(null, to_jsonb(new), c_cols),
  p_hospital => new.hospital_id);        -- ← p_organization is never passed
```

`app.audit_write` derives org+hospital **from the commission** when one is supplied, but on the
hospital branch it uses `v_org := p_organization` verbatim — no derivation, no validation. So these
rows land with `organization_id IS NULL`.

Before AUD1 that was inert: leg 4 excluded hospital-tier rows outright, so
`audit_log.organization_id` was never consulted for them. **AUD1 makes that column
authorization-load-bearing for the first time**, and `app.has_role` with a NULL scope id yields false
(`m.organization_id = NULL` → NULL → `exists` false), so `app.is_org_admin_of(NULL)` is false.

Measured, in a rolled-back transaction, calling the real writer exactly as the trigger does:

| | result |
| --- | --- |
| row shape written | `org_is_null=true  hosp_set=true  comm_null=true` |
| preconditions | `is_org_admin_of(A)=true`, `is_admin()=false`, `is_hospital_admin_of(H)=true` |
| **org_admin of that hospital's org sees** | **0** |
| **hospital_admin of that hospital sees** | **1** |

This directly falsifies `docs/decisions/0146-org-admin-reads-hospital-tier-audit.md` Consequences:

> "An org_admin's audit reach is now a superset of each of its hospital admins'."

It is not. For `standard_ownership.*` the hospital admin sees strictly more than the org admin — the
exact inversion ADR 0146 exists to remove, surviving in the one action class nobody looked at.

**Why every existing measurement missed it.** The seed holds zero `standard_ownership.*` rows
(`select distinct action … where commission_id is null and hospital_id is not null` returns only
`affiliation.created, membership.granted`), so the 19/19 parity figure could not see it. pgTAP 369 is
blind for a subtler reason that is worth stating: `369_audit_org_leg_hospital_tier.sql:129-134` (§0.1)
*asserts* its fixture row "carries a non-null `organization_id` — the column the widened leg keys on".
The author identified the dependency exactly right and guaranteed it **in the fixture**. Nothing
guarantees it **in the platform**.

**Scope — bounded, measured.** I swept all 179 `audit_write` callers in `pg_proc`. This trigger is the
sole offender. Every other hospital-tier caller is safe *by construction*, and I verified each
mechanism:

- `appoint_hospital_dpo`, `revoke_hospital_dpo`, `create_dsr_request`, `search_patient_xref`,
  `set_pqs_rca_due_window`, `get_patient_trajectory_for_entity`, `trg_audit_capa_plan` — all derive
  org via `app.org_of_hospital(<the same hospital>)`.
- `trg_audit_memberships`, `assume_role` — take org+hospital from a `memberships` row, and
  `memberships_scope_shape` **CHECKs** `organization_id IS NOT NULL` for every hospital-scoped role.
- `trg_audit_hospital_affiliations`, `trg_audit_hospital_updated` — `hospital_affiliations.organization_id`
  and `hospitals.organization_id` are both `NOT NULL`.

Measured on the seed: `select count(*) from audit_log where commission_id is null and hospital_id is
not null and organization_id is null` → **0**, consistent with the above.

**This surface is live, not dormant.** Measured: `select enabled from app.feature_flags where key =
'accreditation'` → **`true`**. The trigger is attached and will fire on the first standard-ownership
assignment in any environment, producing audit rows the org admin cannot see.

**Severity.** Fails **closed** — no leak, no cross-tenant read. It is blocking because a shipped ADR
now asserts a property of the platform that is false, the fix silently does not apply to an entire
action class, and **no gate in this repo can ever notice**: `lint:vacuous` does not read SQL (see M5),
the door sweep audits gates rather than writers, and `audit_log` carries no constraint tying
`organization_id` to `hospital_id`'s org.

**Suggested resolution** (engineer's call, not mine to make):
1. In `app.audit_write`, on the hospital branch, `v_org := coalesce(p_organization, app.org_of_hospital(v_hospital))`
   — one line, fixes the class rather than the instance, and makes the chain-precedence block
   self-consistent with the commission branch directly above it.
2. A pgTAP arm in 369 that writes a hospital-tier row **the way the trigger does** (no
   `p_organization`) and asserts the org admin still reads it. §0.1 today asserts the fixture is
   well-formed; this would assert the *platform* is.
3. Correct or qualify the superset sentence in ADR 0146's Consequences.

### B2 · Three documents claim `FUP-AFF2-ACTIVE-MEANS-TWO-THINGS` is closed; two record that closure as **proposed and rejected** — *read*

| file:line | claim |
| --- | --- |
| `docs/decisions/0145-ever-held-affiliation-read-visibility.md:141` | "**`FUP-AFF2-ACTIVE-MEANS-TWO-THINGS` closes.**" — argued from "all three policies now contain zero `ended_on` **and** zero `expires_at`" |
| `docs/backend-state.md:486` | "…so both legs now agree and that follow-up **closes**." |
| `PROGRESS.md:348` | "⚠ **NARROWED** … ⛔ **That is NOT this item's closure**" — item still 🟡, still open |
| `docs/progress/follow-ups.md:4539-4543` | "⛔ Do not read 'all three predicates now contain zero `expires_at`' as closure. **That was proposed and rejected on 2026-08-25** … a true measurement carrying a conclusion it does not bound." |

Commit order explains it — `d150321b` (fix + ADR 0145) landed first, `dbf2efc2` reversed the ruling
after — but neither ADR 0145 nor `backend-state.md` was updated. The ADR is now the **only** authority
asserting the closure, and it asserts it using the precise argument `follow-ups.md` names as a repo
failure class. An ADR is the durable artefact; a reader arriving there gets the rejected conclusion
with nothing able to contradict it. Two edits: `0145:141`, `backend-state.md:486`.

### B3 · `docs/backend-state.md` does not document ADR 0146 / migration `20261003002300` at all — *measured*

Zero occurrences of `0146`, `AUD1`, or `20261003002300` in the file. The AFF3 half is documented well
(`:479-488`, accurate against the migration). The second migration — a widening of the platform's
**audit read policy** — is absent, and `:1776` still describes the org arm's reach in pre-change terms
as "the designed oversight posture". Per Phase Gate §6 step 5, `backend-state.md` is updated when the
backend surface changes; half of it was.

---

## What I checked hardest, and what held

### The widenings are correctly bounded — *measured, adversarially*

Both changes landed exactly as claimed, verified against `pg_policies` after a fresh reset (never
against migration text):

- All three AFF3 policies: `ended_on` **absent**, `hospital_affiliations` leg **present**.
- `audit_log_select` leg 4 is now `((commission_id IS NULL) AND app.is_org_admin_of(organization_id))`;
  leg 5 retains `(organization_id IS NULL)`.

Things I specifically tried to break and could not:

- **Can leg 4 now reach the platform tier?** No. Platform-tier rows have `organization_id IS NULL`, and
  every leg predicate is false — not NULL — on a NULL scope id. Measured under a live `org_admin`
  session: `is_staff_admin_of(NULL)=false  is_tenancy_admin_of(NULL)=false
  is_hospital_admin_of(NULL)=false  is_org_admin_of(NULL)=false`. This matters for the whole
  predicate, not just leg 4: legs 1 and 2 carry **no** null guard on `commission_id`, so every
  hospital-tier and org-tier row is evaluated against them, and their NULL-safety is what keeps that
  from being a hole. (`app.has_role` compares `m.<scope>_id = p_scope_id`, which yields NULL and so
  an empty `exists`.) Leg 5's population is unreachable through leg 4.
- **Can a hospital-tier row carry a foreign org?** No writer permits it (see B1's sweep); measured
  `join hospitals` mismatch count = **0**. There is no CHECK enforcing it, which is worth knowing, but
  every path is safe by construction today.
- **Does AFF3 cross hospitals or orgs?** No. The leg stays keyed to
  `app.is_hospital_admin_of(ha.hospital_id)`; the change is purely tense. pgTAP 368 §3.3/§3.4 pin the
  sibling-hospital boundary with a positive twin, and §3 of 369 pins cross-org with the control on the
  same session.
- **Did AUD1 widen the write surface?** No. `audit_log` ACL is `authenticated=rxtm` — SELECT only, no
  DML; the immutability triggers are intact; §6.2 pins the policy as SELECT-only.
- **Did AFF3 widen column exposure?** No. `authenticated` holds column-list SELECT on `profiles`
  excluding `cpf`/`date_of_birth`/`phone`; no grant changed.

### READ widened, WRITE did not — *read + measured*

- `src/lib/users/person-scope.ts` is **comment-only** on this branch (`git diff` confirms): the
  zero-footprint guard at `:127-128` and the D2 tier guard at `:114` are untouched.
- `src/lib/users/person-footprint.ts:78` still carries `.is('ended_on', null)`.
- pgTAP `368:290-320` §4 proves the RLS half with the right control — §4.1/§4.2 are silent
  zero-row UPDATEs, and §4.3 (the same session successfully updating its **own** row) is what makes
  them mean something rather than "this session has no UPDATE grant". §4.4 pins the UPDATE surface by
  policy name. This is correctly constructed.
- `departed-person-footprint.test.ts` is the good kind of test: the mock at `:66-88` **honours** `.is`
  and `.eq` instead of returning `self`, so deleting the resolver's `ended_on` filter makes the ended
  row survive, `hospitalIds` becomes `[HOSP_A]`, and §1 reds on `[]` vs `[HOSP_A]`. §2 is the control
  (same row, active), §3.3 is a named diagnostic. It is falsifiable by construction, not shape-matching.

### The pgTAP keystones can fail — *measured by mutating the live catalog*

`lint:vacuous` scans `e2e/*.spec.ts` and `src/**/*.test.ts(x)` only (measured: "scanned 240 spec
files") — **it does not read SQL**, so nothing automated stands behind these suites. I mutated the live
policies and re-ran; every result matched the ADRs' claims exactly, and I restored from the migration
files and re-confirmed PASS afterwards.

| mutation | result |
| --- | --- |
| restore `ended_on` on **only** `profiles_admin_select` (half-applied migration) | **1 arm red — §5.2 alone.** Every behavioural arm stayed green. This confirms ADR 0145 D2's claim verbatim, and it is the reason §5 exists |
| restore `ended_on` on **all three** policies | 9 red: §1.1, §1.2, §1.4, §2.2, §2.3, §3.4 + §5.2, §5.4, §5.6 |
| restore `(hospital_id IS NULL)` on audit leg 4 | 6 red: §1.1, §1.2, §1.3, §2.2, §3.2, §6.4 |
| **widen leg 5** (drop `organization_id IS NULL`), leg 4 left correct | **3 red: §5.2, §5.3, §6.5** — exactly the three arms ADR 0146 D4 names |

The leg-5 result is the one I most wanted to see fail, because "I widened one leg and deliberately not
the other" is only a credible claim if something notices when the other one moves. It does.

### Frontend — clean on the things that usually are not

Verified by reading: all 11 mutation entry points re-derive authority server-side (Rule 1 — no action
trusts a client capability flag; `updateUserProfile` even picks `cpf_change` vs `fields` from a
**server-side diff** against the stored row, `src/lib/users/actions.ts:804-863`, and `removeCredential`
resolves `user_id` from the DB rather than the request, `:991-1002`). Rule 10 pt-BR clean. No
`error.message` rendered anywhere. **Zero** hits for `oklch(`, `rgb(`, hex, or the dead bare `[--var]`
form across all 18 files. `"use client"` discipline clean; every cross-boundary import is `import type`.

`PersonalDataCard`'s three states do **not** collapse: WITHHELD (`personalData === null`) renders a
`ScopeNote` and **no `<dl>` at all** (`personal-data-card.tsx:119-129`), NOT-INFORMED renders "Não
informado"/"Não informada" per field (`:139,146,154,162`), PRESENT renders the value.

ADR 0144 holds on all three requirements: `maskCpf` is **not exported** (`person-footprint.ts:197`),
is called inside `getPersonAdminView` beside the only `select(…, cpf)` (`:339`), emits digits 1–3 and
8–11 only, and no raw CPF reaches a client component — `PROFILE_SELECT` (`org-users.ts:52-53`) does not
include `cpf` and `ProfileRow` has no such field, so the other object crossing to the client cannot
carry it either.

---

## MINOR — worth fixing, not blocking

**M1 · ADR 0146 amends `0041:99` without naming it** — *read*. `docs/decisions/0041-multi-tenancy-organizations-hospitals.md:99`
decides the per-tier shape verbatim: "`audit_log_select`: staff_admin reads its commission chain,
**org_admin its org chain**, and `platform_admin` **only** the platform chain." 0146 changes precisely
that clause and names only 0051. 0041 carries no inbound edge at all (`INDEX.md:66`), so a reader
landing there gets the pre-change rule with nothing to contradict it. No gate can detect a missing
`Amends:` label — this is the human check the lead-playbook assigns to the Record step.

**M2 · ADR 0145 invokes a data class whose defining control it declines, citing two superseded ADRs** — *read*.
`0145:67-71` classifies council registrations as "Class-2 professional-identity data (… ADR 0064/0065)"
while widening read on `professional_credentials`; `0145:158-160` then states "reads … were not audited
before this change and are not now." But Class 2 as decided is case-scoped RLS **plus audited reads**
(`0064:121-124`, `0065:94-98`). Both readings need a ruling, not a silent choice: either
`professional_credentials` is *not* Class-2 (0064/0065 scope the class to `professional_profiles`, a
different table), making `0145:68` an overstatement of sensitivity — or it is, and 0145 amends 0064/0065
by widening a Class-2 read without the audit. Separately, **0064 and 0065 are both superseded**
(`INDEX.md:89-90`); the live home of the taxonomy is `0072:525-527`.

**M3 · AFF3 removes the only revocation path for a mistakenly-created affiliation** — *measured*.
`hospital_affiliations` carries a SELECT policy only, `authenticated` holds `r` alone, and **no function
anywhere deletes from it** (swept `pg_proc` for `delete from … hospital_affiliations` → empty). So an
affiliation created against the wrong hospital can only be *ended*. Before AFF3, ending it revoked that
admin's read; after AFF3, nothing ever does. ADR 0145 D5 accepts "unbounded in time" for *legitimately
departed* staff and argues it well — it does not address the data-entry-error case, where the widening
turns a correctable mistake into permanent read access to a person who never worked there. Either state
it as an accepted consequence or give the correction path a home.

**M4 · ADR 0145 D6's "therefore" over-generalizes** — *read*. "A departed person therefore has an empty
active footprint" is true only when they also hold no active commission-tier seat.
`resolvePersonFootprint` has **two** sources (`person-footprint.ts:70-100`): active affiliations ∪ the
hospitals of active commission-tier memberships. Someone whose affiliation ended but who still sits on a
commission at that hospital keeps a non-empty footprint and remains writable. The *behaviour* is
defensible — a live commission seat is a live tie — but the ADR's reasoning does not derive it, and
`departed-person-footprint.test.ts` exercises only the affiliation source (`:92-99` sets
`memberships: []`). One arm with a surviving commission seat would pin the real rule.

**M5 · `lint:vacuous` does not cover pgTAP** — *measured*. Default paths are `e2e/*.spec.ts` plus
`src/**/*.test.ts(x)` (`check-vacuous-assertions.mjs:36`). The gate reports "240 spec files" and reads
no SQL. Given that this repo's most expensive recurring defect is an unreachable-false SQL keystone,
the suites that matter most are the ones with no automated vacuity check. Not a defect of this branch;
recording it because B1 and the mutation table above are the only reason anyone knows these two suites
are sound.

**M6 · a11y: three new date-picker triggers have no accessible name** — *read*.
`date-picker.tsx:143-169` names the trigger `<button>` from its **subtree contents**; an associated
`<label for>` is not in the accessible-name chain for a button. `aria-label` is supported (`:148`) and
is not passed at any of the three new sites: `personal-data-dialog.tsx:196` ("Nascimento" → announces
"Não informado, botão"), `affiliations-panel.tsx:577`, `user-lifecycle-actions.tsx:247` ("Suspenso até"
→ "Selecionar data, botão"). CLAUDE.md §8 requires every form input to carry a label.

**M7 · a11y: error regions contradict the branch's own stated rule** — *read*. `personal-data-card.tsx:101-117`
and `access-card.tsx:81-95` deliberately keep a permanently-mounted `role="status"`, with a comment
explaining that a live region mounting together with its content announces unreliably. Every **error**
path does exactly that — `FormBanner` returns `null` when empty (`form-banner.tsx:24`) and is itself
conditionally rendered at six sites. `FormBanner` is also `role="status"`/`aria-live="polite"` for
errors (`:26-27`), while `affiliations-panel.tsx:335` correctly uses `role="alert"` for the same class
of message.

**M8 · a11y: the credential "Número" validation error is not wired to its input** — *read*.
`credentials-card.tsx:241` sets a banner but `:238` builds the field without `hasError`, so `:377-384`
gets neither `aria-invalid` nor `aria-describedby`. `personal-data-dialog.tsx:106-109` + `:176-178` does
this correctly in the same branch.

**M9 · two server-side modules lack `import 'server-only'`** — *read*. `src/lib/queries/org-users.ts:1`
and `affiliations.ts:1` have it; **`src/lib/users/person-footprint.ts:1`** and
**`src/lib/queries/audit.ts:1`** do not. Nothing leaks today (both are only type-imported by client
components), but `person-footprint.ts` is precisely the module ADR 0144 designates as the sole
authorized reader of `profiles.cpf` on the service-role client. The guard that would turn a future
value-import into a build error is the one it is missing.

**M10 · `upsertCredential` reports success on a zero-row update** — *read*. `actions.ts:956-983`
constrains `.eq('id', …).eq('user_id', …)` (correct — a forged id cannot cross to another person), but a
zero-row UPDATE is not an error, so the UI shows "salvo" for a write that did not happen.

**M11 · `cpfPresent` is computed and never consumed** — *read*. `person-footprint.ts:338` returns it;
`personal-data-card.tsx:134` branches on `cpfMasked` alone. Since `maskCpf` returns `null` for both
"absent" and "stored but malformed", a malformed legacy CPF renders as "Não informado" — a fourth state
collapsing into (c). ADR 0144 D4 keeps `cpfPresent` for exactly this reason; the rail does not use it.

**M12 · two stale line citations in tracker bodies** — *read*. `FUP-DOOR-SWEEP-DESTROYS-ITS-OWN-BASELINE`
cites the truncating redirect at `p0-authz-door-audit.sh:565`; it is at **`:475`**.
`FUP-OPEN-DOCUMENT-VERSION-500-ON-EVERY-RAISE` writes `open-controlled-version-button.tsx` without its
directory (`src/components/controlled-documents/`).

---

## Notes on things I was asked to disagree with if I could

**The 18 E2E failures.** I did not find grounds to dispute the lead's conclusion. Both structural
arguments hold on their own terms — a bare `curl` reproduction takes the Next app out of the path
entirely, and reproduction with both migrations removed takes this branch out of it. Neither AFF3 nor
AUD1 touches `open_document_version`, controlled documents, or any policy those specs traverse. I have
no evidence pointing back at this branch and did not manufacture any.

**The bounded unknown is now closed — `open_document_version`'s SUCCESS path works.** *Measured.* The
reason nobody had exercised it: the seed contains **zero** `file_objects` and **zero**
`document_version_files` rows, so with seed data as-is the RPC cannot succeed for any input — it
raises `HC0D8 "arquivo ainda não disponível"` from `app.resolve_document_version_bytes`. That is a
fixture gap, not a defect. Building the bytes the legitimate way (walking `file_objects` through
`app.guard_file_object_transition`: `reserved → uploaded → verifying → scan_pending → clean`, then
linking as `rendition_kind='source'`), three rolled-back probes with preconditions asserted first:

| caller | tier | result |
| --- | --- | --- |
| `staff_admin`, **is** `created_by` | standard / `clean` | **SUCCESS**, correct `jsonb` payload |
| `staff`, non-creator | standard / `clean` | **SUCCESS** + `document.opened` audit row written |
| creator | **phi** / `unscanned_accepted` | **SUCCESS** + audit row written |

Both D11 audit-write branches (non-creator, and PHI tier) fire correctly and the hash chain accepts
the inserts. **There is no success-path defect.**

⚠ **This also falsifies the follow-up's stated mechanism.** `FUP-OPEN-DOCUMENT-VERSION-500-ON-EVERY-RAISE`
is consistent with a bare `raise` defaulting to `P0001` (which PostgREST maps to 500). That is **not**
what the live code does: every `raise` in `open_document_version`,
`app.assert_documents_enabled` and `app.resolve_document_version_bytes` carries an **explicit
`using errcode`** — `HC0D7` / `HC0D8` / `HC0DD`, plus `P0002` and `42501`. Measured by trapping
`sqlstate`. Per ADR 0018 `HC0xx` maps to **HTTP 400 with the JSON body preserved** and `P0002` to 404,
so the follow-up's own table showing *both* returning 500 `text/plain` **contradicts** the verified
mapping rather than following from it. The follow-up should be re-scoped to what it is: an
error-**transport** defect at the PostgREST boundary on the refusal path only. Worth adding to its
body: any E2E test expecting a successful open must mint bytes first via `e2e/helpers/document-model.ts`,
or it reds with `HC0D8` for fixture reasons that look like door reasons.

(ADR 0135 is not a compliance test here — it is Accepted-then-**deferred** by the PO and unbuilt. Against
that future rule this door is already partly compliant; its three remaining `42501` authored refusals
are known deferred debt and must not be "fixed" ad hoc.)

**Not re-litigated.** The lead's own mutation runs (the `resolvePersonFootprint` 7/11 and the leg-5
platform-admin-wall arm) I did not repeat; my catalog mutations above cover the same boundary from a
different direction and agree with them.

---

## Summary

| | |
| --- | --- |
| **Blocking** | B1 (AUD1 incomplete for `standard_ownership.*`; ADR 0146's superset Consequence false — *measured*), B2 (three docs vs. two on a rejected closure), B3 (`backend-state.md` omits ADR 0146 entirely) |
| **Minor** | M1–M12 |
| **Verified sound** | Boundedness of both widenings (no cross-org / cross-hospital / cross-tenant admission); the read/write asymmetry; the falsifiability of both pgTAP suites and the new unit test; ADR 0144's CPF containment; Rules 1, 10; Tailwind v4 tokens; `PersonalDataCard`'s three states |

B1 is the finding I would most want acted on: it is the only one where a shipped ADR states something
about the platform that is not true, and it is invisible to every gate this repo has.

---

# Round 2

**Reviewer:** `qa` · **Date:** 2026-08-25 · **Range:** `32fa326d..67fcb6a4` (+ `857e6297`, `3cdb545d`)
**Verdict: APPROVED**

B1 is fixed, and fixed wider than I scoped it — I confirmed both halves by measurement rather than by
reading the table I was given. The new keystones genuinely fail; I proved it with five distinct
catalog mutations, each run inside the test file's own rolled-back transaction so the live catalog was
never left altered. **Three of my round-1 findings were wrong and I withdraw them** (M6 entirely, M11
entirely, and two of M9's four targets), plus one line citation in M12. Five new MINORs, none touching
the security boundary; two are one-line doc edits.

**Method note.** Every catalog claim below is `docker exec … psql` against the live local DB at
migration `20261003002400`, with preconditions asserted in the same session before the measurement.
Mutations were injected immediately after each pgTAP file's own `select plan(N)` in a scratchpad copy,
so they roll back with the file — the catalog is **byte-identical to how I found it** (verified at the
end: `audit_log_select` qual unchanged, `audit_write` derivation present, `track_functions=none`,
seed row counts intact, `git status` clean apart from the pre-existing untracked
`docs/design/temp/`). Nothing was restored because nothing was left changed.

---

## 1 · B1's fix — verified, both halves, by construction rather than by table

### The fix is genuinely at the class level

The offending writer is **unchanged**, which is the point: live `app.trg_audit_standard_ownerships`
still passes `p_hospital =>` at **3** call sites and contains **zero** occurrences of
`p_organization`. The correction sits in `app.audit_write` (live `pg_get_functiondef`, line 61):

```
if v_hospital is not null and v_org is null then
  v_org := app.org_of_hospital(v_hospital);
end if;
```

### Write side — measured, calling the writer with the trigger's exact arguments

| | measured |
| --- | --- |
| row shape | `organization_id = <org A>` · `hospital_id = <hosp A>` · `commission_id = NULL` |
| `seq` | hospital-chain max **+ 1** (`t`) |
| `prev_hash` | equals the previous **hospital-chain** row's `row_hash` (`t`) |
| org chain max `seq` | **unchanged** (`t`) |
| org chain row count | **unchanged** (`t`) |
| `verify_audit_chain(p_hospital => H_A)` | `ok = t` |
| `verify_audit_chain(p_organization => org A)` | `ok = t` |

Chain neutrality is not merely observed, it is **structural** and I read it in the live definitions:
`audit_write`'s hospital arm selects on `hospital_id = v_hospital and commission_id is null`, and
`verify_audit_chain` enumerates that same chain identically — **neither reads `organization_id`** — and
the precedence block tests `v_hospital is not null` before `v_org is not null`.

### Read side — the four personas, preconditions asserted in-session

**(a) A new, well-formed hospital-tier row** (written through the real writer, no `p_organization`):

| persona | precondition asserted | rows visible |
| --- | --- | --- |
| `org_admin` of org A | `is_org_admin_of(A)=true`, `is_admin()=false` | **1** ← was **0** in round 1 |
| `hospital_admin` of hosp A | `is_hospital_admin_of(H)=true` | **1** |
| `platform_admin` | `is_admin()=true` | **0** ← the noun rule holds |
| `org_admin` of org **B** | `is_org_admin_of(B)=true`, `is_org_admin_of(A)=false` | **0** |

The inversion ADR 0146 exists to remove is gone for this action class, and no tenant boundary moved.

**(b) A *legacy* malformed row** (`organization_id` NULL, `hospital_id` set — the shape production may
already hold), inserted directly as owner since the only triggers on `audit_log` are BEFORE
UPDATE/DELETE/TRUNCATE:

| persona | rows visible |
| --- | --- |
| `platform_admin` | **0** ← leg 5's new `hospital_id IS NULL` is what does this |
| `org_admin` of org A | **0** — the accepted forward-only consequence, correctly documented |
| `hospital_admin` of hosp A | **1** |
| `org_admin` of org B | **0** |

And the row does satisfy the **old** leg 5's conjuncts (`organization_id IS NULL` alone → `t`) while
failing the new ones (`t`/`f` measured side by side). The platform_admin half was real and is closed
retroactively, exactly as ADR 0147 D4 claims.

**Residual, restated not re-opened.** `audit_log` carries **no** foreign key on `hospital_id` or
`organization_id` and **no** CHECK tying them (measured: 7 constraints, none of them this). Agreement
is a writer-discipline invariant — measured **0** rows whose org disagrees with their hospital's org,
and **0** hospital-tier rows still org-NULL. ADR 0147 states "adds derivation and adds no validation"
and test 370 §1.3 deliberately pins that a caller-supplied disagreeing org **wins**. Honest and
bounded; named here only so it is not rediscovered as a surprise.

---

## 2 · The new keystones can fail — five mutations, measured

`lint:vacuous` still does not read SQL, so this is again the only thing standing behind these suites.

| mutation | 369 | 370 |
| --- | --- | --- |
| **A** — leg 5 reverted to pre-0147 (drop `hospital_id IS NULL`) | **§6.8 red** | **§4.2 red** (behavioural) + **§5.1 red** (structural) |
| **B** — write-side derivation removed (`v_org := v_org`) | **PASS** — 369 is structurally blind, exactly as round 1 said | **§1.1 red** + **§2.1 red** |
| **A+B** — the full pre-0147 platform | — | **§1.1, §2.1, §2.3, §4.2, §5.1 red** — all four ⭐ keystones |
| **C1** — leg 4's `hospital_id IS NULL` restored (the 0146 bug) | §6.4 + §1.1, §1.2, §1.3, §2.2, §3.2 red | §5.2 + §2.1, §2.5 red |
| **C2** — leg 4 **deleted outright** | §6.4, §6.6 + the same 5 behavioural arms red | §5.2 + §2.1, §2.5 red |
| **C3** — `hospital_id IS NULL` poisoned onto **leg 3** | §4.1 red | §2.2 red |

Mutation **B** is the one I most wanted: it isolates the write half, and 369 stays green under it.
That is the finding of round 1 reproduced as a *measurement of the test suite*, and it is why 370 had
to exist rather than 369 being extended.

### 369 §6.4 is **strictly stronger**, not merely narrower — the concern was well placed and it holds

I did not take this on the commit message's word. I set five candidate policies and evaluated **both**
predicate forms against the qual Postgres actually renders:

| candidate policy | old `NOT LIKE '%hospital_id IS NULL%'` | new leg-scoped `LIKE` |
| --- | --- | --- |
| Q0 — current, correct (post-0147) | **FAIL** ← false positive on a correct policy | PASS |
| Q1 — pre-0147, correct | PASS | PASS |
| Q2 — the 0146 bug (leg 4 carries the conjunct) | FAIL | FAIL |
| **Q3 — leg 4 DELETED, pre-0147 leg 5** | **PASS — vacuously** | **FAIL** |
| Q4 — leg 4 deleted, post-0147 leg 5 | FAIL | FAIL |

Q3 is decisive: the form being replaced **passed while the entire org leg was absent**. The
replacement catches everything the old form caught (Q2) *plus* a case the old form was blind to (Q3),
and stops false-positiving on a correct policy (Q0). The one dimension the old form covered and the
new one gives up — the conjunct migrating onto legs 1–3 — is covered **behaviourally**, measured:
mutation C3 reds 369 §4.1 and 370 §2.2. This is a strengthening, not a relaxation-to-pass.

---

## 3 · The no-backfill reasoning — `backend` is right, and ADR 0147 already says so

**Measured.** `app.guard_audit_immutable()` is a `BEFORE DELETE OR UPDATE … FOR EACH ROW` trigger
whose entire body is:

```
raise exception 'os registros de auditoria são imutáveis (somente inserção)' using errcode = 'HC042';
```

No condition, no column test. A no-op `update … set summary = summary` on a real row is rejected with
`HC042`. The UPDATE therefore never lands and the hash is never recomputed — **the trigger is the
proximate bar, and the hash break is a second, independent fact.**

That second fact is also true, and I measured it rather than accepting it: forcing past the guard with
`alter table … disable trigger user` inside a rolled-back transaction, the row's own hash **replays
`true` before and `false` after** the `organization_id` rewrite.

⚠ One caution on the earlier measurement shape: a backfill `UPDATE … where … organization_id is null`
run on this DB reports **success**, because it matches **zero rows** (measured: 0 pre-existing
malformed rows here) and a row trigger cannot fire on a row that was never touched. Anyone re-deriving
this must target a row that exists, as I did.

**ADR 0147 D3 is correct as written** — it lists the guard *first* ("barred twice over"), then the
hash, and both bullets check out. Nothing to change there. See R2-M3 for where the weaker half travels
alone.

---

## 4 · Round-1 findings — disposition

### Withdrawn

- **M6 — WITHDRAWN, wholly.** `<label for>` **is** in the accessible-name chain for a `<button>` and
  **outranks** subtree contents: `button` is a *labelable* element in HTML, so the associated `label`
  is consumed at the native-host-language step, which precedes name-from-contents. All three sites I
  cited do carry an associated label immediately above the `DatePicker`
  (`personal-data-dialog.tsx:195`, `affiliations-panel.tsx:574`, `user-lifecycle-actions.tsx:258`,
  each `htmlFor={…controlProps.id}` against the button's `id` at `date-picker.tsx:145`), so the three
  `aria-label`s I asked for were measured to be exact no-ops. ⛔ **The premise was already recorded as
  measured-false in this repo** at `src/components/safety/patient-fields.tsx:305-315`, including that
  an earlier version of its own comment had asserted it — I reasoned from it anyway and did not check.
  That is the real lesson here and it is mine, not the branch's. The adjacent defect `frontend` found
  by actually measuring (`labelfor` **displaces** `contents:`, so the button announces its label and
  drops its value) is the true one, correctly filed as
  `FUP-DATEPICKER-VALUE-ABSENT-FROM-ACCESSIBLE-NAME` and correctly not built inside a feature branch.
- **M11 — WITHDRAWN.** `cpfPresent === true && cpfMasked === null` is unreachable. `profiles_cpf_valid`
  is a **validated** CHECK (`cpf is null or app.is_valid_cpf(cpf)`, added at column creation with no
  `NOT VALID`) and `app.is_valid_cpf` rejects anything but `^[0-9]{11}$`. A third render branch would
  have been dead code. Correcting the comment was the right call; see R2-M1 and R2-M2 for what the
  correction left behind.
- **M9 — HALF WITHDRAWN.** `src/lib/queries/org-users.ts` and `src/lib/queries/affiliations.ts` both
  **already** carried `import 'server-only'` at `32fa326d`; I mis-transcribed the targets. The two
  genuinely missing were `src/lib/users/person-footprint.ts` and `src/lib/queries/audit.ts`, and both
  now have it at line 1. I additionally proved this cannot have broken the build: `npm run build` exits
  **0** — the check that matters, since a client value-import of a `server-only` module aborts
  `next build` while tsc/lint/vitest stay green.
- **M12 — HALF WITHDRAWN.** The truncating redirect `} > "$FINDINGS"` is at
  `supabase/tests/mutation/p0-authz-door-audit.sh:**565**`, exactly as the follow-up originally cited;
  `:475` is an unrelated `echo` inside the zero-selection UNPROVEN block. My relocation was wrong. The
  unqualified-filename half was fair and is fixed.

### Addressed

| # | disposition |
| --- | --- |
| **B1** | **CLOSED** — §1 above. Fixed as a class, and the platform_admin half I missed is closed too |
| **B2** | **CLOSED** — `0145:165` now reads "is NARROWED, and does **NOT** close", with the rejected argument quoted and named as circular; `backend-state.md:486` now reads "does **NOT** close". The four surfaces agree |
| **B3** | **CLOSED** — `backend-state.md:513-545` is a new § covering both migrations, both legs, the `audit_write` derivation and the pgTAP plans; `:1844-1846` corrected and cross-linked. The "LOCAL ONLY, NOT PUSHED" flag on that § is the right kind of live-state honesty |
| **M1** | **CLOSED** — ADR 0146's header now declares `**Amends:** 0041 … , 0051`, and 0041 carries the generated back-pointer. `lint:adr-index` green (145 ADRs, next free 0148) |
| **M2** | **CLOSED, and better than I asked** — the Class-2 claim is **withdrawn** rather than the control declined, verified against ARCHITECTURE.md Rule 12 and the live catalog (`professional_credentials` appears zero times in 0064/0065; no function audits a read of it). The superseded citations are corrected to 0072 / 0114 |
| **M3** | **ACCEPTED CONSEQUENCE, properly recorded** — `0145` now names the mis-entry gap explicitly, measured (SELECT-only policy, `authenticated=r`, zero deleting functions), and states that no correction path is built and why. PO decision; not mine to re-open |
| **M4** | **CLOSED** — the "therefore" is retracted, the union of the two footprint sources is stated, and the test gap (`departed-person-footprint.test.ts:92-99` sets `memberships: []`) is named in the ADR itself |
| **M5** | still true, still not this branch's defect |
| **M7** | **PARTIAL** — see R2-M4 |
| **M8** | **CLOSED** — `credentials-card.tsx:251-254` wires `hasError`, `:400` spreads `controlProps`, `:413` renders `<FieldError id={numberField.errorId}>`. No dangling `aria-describedby`: the id is only referenced when `numberError` is set, and `FieldError` renders in the same pass |
| **M10** | **CLOSED** — `actions.ts:953-976` now `.select('id')`s and returns `MESSAGES.generic` (pt-BR) on a zero-row result |

---

## 5 · New in round 2 — MINOR

**R2-M1 · the `cpfPresent` correction swapped one false claim for another — *measured*.**
`src/lib/users/person-footprint.ts:236-238` now says the field stays "…because ADR 0144 D4 requires
presence as a fact in its own right — **what the edit form and any completeness check consume**".
`grep -rn cpfPresent src/` returns exactly **two** production hits, both inside `person-footprint.ts`
itself (`:243` declaration, `:352` producer); `PersonalDataDialog` receives the whole object
(`personal-data-dialog.tsx:79`) and reads only `dateOfBirth` and `phone`. There is no edit-form
consumer and no completeness check. The comment written to stop a reader chasing a state that does not
exist now sends them chasing a consumer that does not exist — the same class as B2, inside the fix for
it. **One-line edit:** say the field is retained by ADR 0144 D4 as a fact with no current consumer.

**R2-M2 · two unit tests still encode the CPF states that comment now calls impossible — *read*.**
`src/lib/users/person-admin-view.test.ts:380-397` is a ⭐-starred, mutation-controlled arm pinning
`cpf: '1114447'` → `cpfPresent === true, cpfMasked === null`, with a comment asserting "a
malformed/legacy value **is real data**" — the exact premise `person-footprint.ts:230-234` now says
"does not exist in the system". `:398-407` pins `cpf: '111.444.777-35'`, which
`supabase/tests/359_profiles_dob_phone.sql:245-249` proves is refused at rest with `23514`. Neither
test is *wrong* — testing a defensive path is legitimate — but neither is annotated, so the next
reader re-derives the false premise from the tests. Two comment lines.

**R2-M3 · the no-backfill argument travels at half strength in the two artefacts most likely to be
read — *measured*.** `guard_audit_immutable` appears in ADR 0147 and **nowhere else**: zero occurrences
in `supabase/migrations/20261003002400_…sql` and zero in
`supabase/tests/370_…sql`, both of whose headers give only the hash-chain reason. The hash argument
alone is *defeasible* — "just recompute the hashes" is the obvious next thought, and acting on it means
reaching for `disable trigger`. The categorical bar (an unconditional BEFORE-UPDATE guard + Rule 11) is
the one that should lead. One sentence in each header.

**R2-M4 · M7 is fixed at six sites, not as a class, and the escalation half is refused — *measured*.**
`FormBanner` still `return null`s when empty (`src/components/auth/form-banner.tsx:35`, byte-identical
to round 1) and remains mount-with-content at **193** call sites across 149 files, several in this same
feature area (`credentials-editor.tsx:201`, `committee-role-assigner.tsx:146`,
`register-person-flow.tsx:457`). The new `LiveBanner` (`form-banner.tsx:63-85`) is correct and
correctly applied at the six sites the branch touched, and the deferral is *documented* at
`form-banner.tsx:57-61` — so this is a scoped fix with a stated boundary, not a silent one. Two things
worth saying anyway: the **error** tone is still `role="status"`/`aria-live="polite"` for both
components (`:38-39`, `:76-77`) while `affiliations-panel.tsx:335` uses `role="alert"` for the same
message class, so the inconsistency I filed is unchanged; and `affiliations-panel.tsx:362` now mounts
one permanent `role="status"` **per affiliation row**, while the same commit's own message declines to
permanently mount the per-row **alert** precisely because it "would resolve to 2 for a person with two
affiliations". The counting argument is applied to one and not the other. Nothing reds today — no
current spec runs an unscoped `[role="status"]` query on `/manage/usuarios/[userId]` — but the
asymmetry should be either justified or removed before it does.

**R2-M5 · a correct fix with an incorrect stated mechanism — *read*.**
`src/components/users/credentials-card.tsx:257-262` calls `setNumberError(...)` then
`numberRef.current?.focus()` synchronously in the same handler, i.e. **before** React flushes; at the
moment focus lands the input has neither `aria-invalid` nor `aria-describedby`, and screen readers do
not generally re-announce a description change on an already-focused element. The comment at `:259-261`
credits the announcement to exactly that. What actually announces is `FieldError`'s `role="alert"`
insertion (`field.tsx:54`). Outcome fine, rationale wrong — and `FieldError` being a `role="alert"`
that mounts with its content sits unreconciled beside `form-banner.tsx:19-26`'s new bold prohibition
of that pattern. The two rules now coexist with no stated boundary.

---

## 6 · Gates I ran, and the one I did not

**Green under Node 24, on the current tree, by me:**

| gate | result |
| --- | --- |
| `npm run lint` (all ten) | **PASS** — incl. `lint:adr-index` 145 ADRs, `lint:vacuous` 240 specs / 0, `lint:progress`, `lint:rules`, `lint:mojibake` 2824 files |
| `npx tsc --noEmit` | **clean**, exit 0 |
| `npm run build` | **exit 0** — the check that actually proves the two new `import 'server-only'` are safe |
| `npm run test` | **126 files / 1727 tests** pass |
| `npm run test:db` | **221 files / 7318 tests** pass |
| `ARM=census` | INVARIANT HOLDS — 560 live gates, no unswept newcomer in domain |
| `ARM=hat` | INVARIANT HOLDS — 6/6 self-tests, 3 findings all reasoned-allowlisted |
| `ARM=floor` | INVARIANT HOLDS — 72 never-called doors, all allowlisted (fresh-reset figure) |
| `FROMFINDINGS=1 ARM=wrapper` | INVARIANT HOLDS — BLIND set 41 ⊆ allowlist |

**⛔ Not run, deliberately: the diff-scoped `ARM=policy` door sweep over `audit_log_select` for
migration `20261003002400`.** `p0-authz-door-audit.sh:565` writes the **tracked**
`docs/reviews/authz-door-audit-findings.md` through a truncating redirect
(`FUP-DOOR-SWEEP-DESTROYS-ITS-OWN-BASELINE`), and restoring it afterwards needs a `git checkout <path>`
I am barred from. Its substance for this one policy I measured directly instead, which is the stronger
form: **every one of the three legs a session could plausibly move — 3, 4, 5 — reds a named keystone
when opened** (mutations A, C1, C2, C3 in §2). The formal sweep run remains the lead's step 1.

**⚠ Phase Gate §6 step 2 is stale against the tree — the lead's call, flagged not adjudicated.** The
recorded full `e2e:prod` is at **`d1ea9574`**, three commits behind. Since then `ec7d74b1` changed six
live-region DOM shapes and moved the suspend `DatePicker`'s DOM id off the literal `suspend-until`
(acknowledged and filed as `FUP-AC4-SUSPEND-TEST-SUSPENDS-NOBODY`), and `3641b2f3` changed
`upsertCredential`'s success/failure semantics — a user-visible behaviour change on a path E2E
traverses. The specs touching `/manage/usuarios/*`, credentials and affiliations should be re-run
before Record. This is a gate-completeness item, not a code defect, and it is why it does not change my
verdict.

---

## Round-2 summary

| | |
| --- | --- |
| **Blocking** | **none** |
| **Minor** | R2-M1 (false consumer claim in the comment that fixed a false claim), R2-M2 (two tests still encode the impossible state), R2-M3 (no-backfill stated at half strength in the migration + test headers), R2-M4 (M7 fixed at 6 of 193 sites; error tone unescalated; per-row `role="status"` asymmetry), R2-M5 (correct fix, wrong stated mechanism) |
| **Withdrawn** | **M6** entirely · **M11** entirely · **M9** two of four targets · **M12** the line relocation |
| **Verified by measurement** | B1 both halves, incl. chain neutrality and `verify_audit_chain`; the class-level nature of the fix; all four of 370's ⭐ keystones falsifiable; 369 §6.4's replacement **strictly stronger** via a five-policy truth table; 369's blindness to the write half reproduced; the guard-trigger bar and the hash break as two independent facts; the org/hospital agreement invariant and its absence of a constraint |

R2-M1 and R2-M3 are one-line doc edits and R2-M2 is two comment lines — cheap enough to clear before
the Record step rather than carry. R2-M4 and R2-M5 are genuine but scoped, documented deferrals and are
fine to carry.

**APPROVED.**
