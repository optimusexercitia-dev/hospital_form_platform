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
