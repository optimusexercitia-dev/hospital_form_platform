# AE5-OPENING-ADR — progress record

AE5's opening decision: pre-AE5 remediation **Batch 9**, the last block under
[docs/plans/pre-ae5-remediation.md](../plans/pre-ae5-remediation.md) §3 § Remaining. The unit's
**summary** is its hub, [docs/features/ae5-opening-adr.md](../features/ae5-opening-adr.md)
§ Current state; this file is its **log** (ADR 0186 D3): one dated subsection per session, appended.

Subjects: ADR **0201** (reserved at unit open — *highest on any live ref + 1*), the decisions ADR
0176 D8 bundles for AE5's first step, audit F5's seam model, ADR 0175 D3's arm-3 divergent cells;
`app.is_admin`, `app.is_admin_for`, `app.is_active`, `app.is_org_admin_of_for` and
`app.can_manage_professional` as they exist in the **live catalog** (⛔ never the migration text —
ADR 0078; some migrations rewrite function bodies at runtime), together with the `public` doors the
last of those gates; `supabase/tests/vectors/authz-enforcement-manifest.json` rows 31/32 and
`supabase/tests/401_ae4_authz_catalog.sql` § 19.2b/§ 19.2c; and
`docs/backend-state/authorization-and-audit.md` (the seam that owns these predicates — a slice
APPENDED there and its `## Current state` block REPLACED at the Record step; ⚠ that block stood at
**99 of 100 lines** at unit open, so the next slice on that seam must **cut before it adds**).
Decisions read: [0078](../decisions/0078-authorization-capability-model.md) A35 (the noun
rule), [0079](../decisions/0079-authz-door-blindness-standing-invariant.md) (the door-audit sweep is
a standing gate), [0155](../decisions/0155-post-aff4-tenancy-and-person-model-evolution-sequence.md)
G1 + [0162](../decisions/0162-authz-evolution-plan-audit-corrections.md) (AE5 is post-pilot),
[0172](../decisions/0172-ae4-catalog-substrate-match-full-binding-and-deferred-classification-columns.md)
(the deferred classification columns), [0175](../decisions/0175-ae4-po-batch-oracle-inputs-and-arm3-deferral.md)
D3, [0176](../decisions/0176-authz-permission-layer-made-real.md) D8,
[0193](../decisions/0193-the-enforcement-manifest-declares-what-it-measured.md) D5 and
[0200](../decisions/0200-professional-identity-predicates-answer-about-their-subject.md) (the keying
obligation this batch inherits) — all in `docs/decisions/INDEX.md`.

## Session log

### 2026-09-09 — unit opened (lead)

**Why now.** Batches 0–8 are concluded, merged and pushed; the plan's §6 checklist has read
*"Batch 9 is next — and it is not a fix"* since Batch 8's Record step; the PO said *"initiate batch
9"* and authorised subagents. The window matters because AE5 substitutes eleven role increments
through **one** per-role template, and every defect left in that template is copied eleven times.

**Preconditions, measured rather than assumed** (plan §6 step 1):

- `git status --porcelain` **empty** on `main` @ `55e440c3`.
- `git rev-list --count origin/main..main` = **0**, and `main..origin/main` = **0** — ⛔ measured at
  open, not quoted: a clean push state is an **instant, not a lease**. Batch 8's record states the
  distance was *"large and growing"* at its own close; the Batch 8 merge-and-push witness commit
  (`55e440c3`, *"87 commits pushed, 0 ahead / 0 behind"*) is what moved it to 0, and this
  measurement is what confirms it still holds now. ⛔ The standing plan §4 step 6 instruction *"do
  not push"* is live again — the three overrides on record (Batches 4, 7, 8) were each scoped in
  writing to one push and are spent.
- `docs/features/INDEX.md` shows **no `in_progress` hub** (18 hubs: 0 in progress · 3 gated · 2
  planned · 0 parked · 13 complete). ⚠ **Stated, not absorbed:** the three `gated` hubs
  (`BACKEND-STATE-CURRENT-STATE`, `BACKEND-STATE-SPLIT`, `DATA-ACCESS-GENERATION`, all program
  DOCS) have **no live branch** — `git branch` lists neither `backend-state-current-state` nor
  `data-access-generation` — so each is either merged-and-unrecorded or lost, and ⛔ *a deleted
  branch is not evidence of a merge*. Plan §6 step 1's precondition tests `in_progress` only, so
  this does not block Batch 9; it is written down here so it is not re-discovered.
- `git worktree list` shows **only** the primary tree.
- `npm run lint` **rc 0 bare**, 17 of 17 gates, eslint 0 errors / 0 warnings — the baseline this
  unit must return to.

**Migration head pair at open:** `(20261003007360, 525)`, measured from
`supabase_migrations.schema_migrations` on the local stack, with 525 files on disk. ⛔ Keyed on the
**pair**, never *"head N"* (Batch 7's lesson: a migration can be inserted below a later version
after the commit that added it).

**ADR number.** **0201** reserved — *highest on ANY live ref + 1*, derived across
`refs/heads` + `refs/remotes` (`git ls-tree` over every ref, not the index's "next free"): the
maximum is **0200** on every ref that carries one. ⚠ Gate 9 catches a duplicate at rebase, so the
number is a reservation, not a claim.

**Branch.** `authz-ae5-opening-adr` cut off `main` @ `55e440c3` **before** the hub was written,
because gate 13 resolves an `in_progress` hub's `branch:` against local branches (Batch 6's
finding). Plan §6 step 3 words the same requirement the other way round; both agree on the reason,
and the branch existing when the gate runs is what satisfies it.

**PO rulings taken AT open** (`AskUserQuestion`, before any work — plan §4 step 2: *PO questions go
to the PO before the build where they change scope*):

- **R1 — scope shape: "Decide now, build later."** Batch 9 stays **not a fix**. It produces ADR 0201
  and the rulings that ADR records, plus the one text-only follow-up; where a ruling orders a
  database change, the change is deferred to a **named Batch 10** and the follow-up stays
  `Status: open` with a decided path. ⇒ Batch 7's **empty-pathspec assertion is live**.
  ⚠ This is a widening of Batch 9's *subject* (three follow-ups the plan did not assign to it) with
  **no** widening of its *kind*, and plan §3 owes an amendment saying so in writing.
- **R2 — the CLAUDE.md review queue: skip, and record the deferral.** Plan §6 step 4 says to process
  `.claude/claude-md-review-queue.md` before Batch 9 opens, on the ground that it was **13 KB and
  unprocessed** at Batch 8's Record step. ⛔ **Re-measured at open: 1,433 bytes, three entries**
  (2026-08-25, 2026-09-03, 2026-09-07), each a truncated staleness snippet about a figure, none a
  rule. The 13 KB figure in plan §6 is therefore **stale** and is corrected by this measurement, not
  by deletion. The PO ruled skip; the deferral is recorded here so it is attributable rather than
  forgotten.

**What the three follow-ups claim, and what is a measurement to re-derive.** ⛔ Batch 7's lesson is
binding on all three: *a `Closes when` can name stale heads, a wrong predicate, or a case that
cannot fail — read the body, re-measure what it names, and correct the clause before closing on it.*

1. `…-ADMIN-ARM-IGNORES-IS-ACTIVE` asserts, from `pg_proc` on 2026-09-09, that neither
   `app.is_admin()` nor `app.is_admin_for()` contains an `app.is_active` term. Same-day, so not yet
   stale — but it is still **a measurement, and it is re-derived at this head pair**, not quoted.
   Its clause has **two arms** and the PO's ruling picks one.
2. `…-PLATFORM-ADMIN-CLASS-2-WRITE` asserts **3 `public` RPCs** sit behind
   `app.can_manage_professional`, and its clause explicitly requires the door list *"derived from
   `pg_proc`, not quoted"* to be in front of the PO. ⇒ the count is re-derived and reported plainly
   if it is not 3. Two arms; the PO's ruling picks one.
3. `FUP-ENFORCEMENT-MANIFEST-COMMENT-…` is the only one that closes here unconditionally: rows 31/32
   of the manifest carry a `_comment` reading *"19.2b is RED on exactly this and must not be
   re-numbered to 2 … AWAITING A LEAD RULING"*. **Confirmed stale at open by reading `401`
   directly:** § 19.2b's expected value **is** 2 (`supabase/tests/401_ae4_authz_catalog.sql`), and
   § 19.2c exists beside it asserting the surviving pair is `can_manage_external_participant` +
   `can_manage_case_vocabulary` — i.e. the ruling the comment awaits was taken **and** the objection
   it raised (*"a bare count of 2 over three functions is satisfied by any of the three pairings"*)
   was answered by adding 19.2c rather than by editing 19.2b alone. ⛔ The close still owes a
   **fresh run of `401`** quoted beside the rewritten comment; the reading above is source text, and
   source text is not a run.

**Protocol.** Plan §4. `backend` (Opus — authz semantics) returns a FULL plan before touching
anything; the lead approves with rulings written into ONE scratch file the build turn reads; the two
disposition questions go to the PO **before** the build, because each changes scope — but only
**after** the live-catalog evidence exists, because both clauses require the measurement to be in
front of the PO. ⛔ Lead writes no feature code, no migration, no SQL. ⛔ One agent on the tree at a
time; an agent that reports "finished" while holding a background waiter is not finished.

### 2026-09-09 — live-catalog evidence for both authz clauses; PO ruling R3 taken; R4 put back for confirmation (lead)

**Instrument.** Both clauses require a measurement in front of the PO, so the evidence was derived
before either question was asked. Derived by subagent against the live catalog on
`supabase_db_azkbbhskturikxpgmafq` at the open head pair `(20261003007360, 525)`, from `pg_proc`
(`prosecdef`, `proconfig`, comment-stripped `prosrc`), `pg_policies` and `has_function_privilege`.
⛔ No migration text was used as evidence (ADR 0078). ⚠ A sibling container `supabase_db_escalume`
is a **different project** — named here because it is one `docker exec` typo away and a read against
it would look like a finding.

**E1 — the `is_active` asymmetry, confirmed and WIDER than the clause.** All four predicates have
exactly one live overload; all four are `SECURITY DEFINER` with `search_path` pinned to
`app, public, pg_catalog`.

- `app.is_active(p_user_id uuid default auth.uid())` checks **two** things, not one:
  `profiles.is_active` **and** `(suspended_until is null or now() >= suspended_until)`, wrapped in
  `coalesce(…, false)` — fails closed on a null uid or an absent profile row.
- `app.is_admin_for(p_user_id)` = `exists(select 1 from profiles where id = p_user_id and is_admin)`
  **and** a *caller-only* ACT-hat clause (`p_user_id is distinct from auth.uid() or
  app.active_role() = 'platform_admin'`). **No `is_active` term** — confirmed on the
  comment-stripped body with a `\yis_active\y` match.
- `app.is_admin()` = the raw JWT `is_admin` claim **or** the `profiles` fallback, **and**
  `app.active_role() = 'platform_admin'`. **No `is_active` term.**
- `app.is_org_admin_of_for(p_org_id, p_user_id)` = `app.is_active(p_user_id) and app.has_role(…)` —
  i.e. arm 2 **does** follow the subject's state. The asymmetry the follow-up describes is real and
  sits inside one expression.

⭐ **Two findings the follow-up does not contain, both material to the ruling:**

1. **The ACT hat does not imply active, and neither does minting it.** `app.active_role()` is
   `current_setting('request.jwt.claims')::jsonb ->> 'active_role'` — a **claim read**, nothing more.
   And `public.assume_role(p_role platform_role)`, the door that seats the hat, tests
   `exists(select 1 from profiles where id = v_uid and is_admin = true)` for the `platform_admin`
   branch — **no `is_active`**. ⇒ the gap is **not** bounded by token expiry: a deactivated or
   suspended admin can seat a *fresh* platform-admin hat. ⛔ Anyone reasoning *"the hat expires, so
   the exposure is one token lifetime"* is reasoning from an assumption this measurement refutes.
2. ⛔ **THE CLAUSE NAMES THE WRONG PREDICATE — Batch 7's exact fault shape.** The follow-up's
   `Closes when` names **only** `app.is_admin_for`. Measured blast radius, counts **and** sets
   (⛔ *a count is not a set*), with `--`/`/* */` comments stripped and a call-shape suffix required
   because `profiles.is_admin` is also a **column name** and a bare word match counts comments and
   column references (`is_admin_for` never matches `\yis_admin\y`, `_` being a word character):

   | predicate | RLS policies (`qual`/`with_check`) | functions, raw text mention | functions, **real call** |
   | --- | --- | --- | --- |
   | `app.is_admin_for` | **0** | 6 | **5** |
   | `app.is_admin()` | **26** | 32 | **13** |

   The 5 real `is_admin_for` callers: `app.can_manage_professional`,
   `app.can_read_professional_profile`, `app.grant_role_impl`,
   `app.recover_orphan_person_to_org_impl`, `app.revoke_role_impl` (the sixth mention is
   comment-only, in `app.affiliate_person_impl`). The 26 policies and 13 functions on `app.is_admin()`
   are enumerated in the subagent report; ⛔ they are a **set to re-derive at Batch 10's head**, not
   a list to quote from here. ⇒ **closing on the clause as written would gate the predicate with
   0 policies and leave the one with 26 blind.**

3. **No pgTAP test anywhere deactivates a `platform_admin` and measures an admin arm.** Eight
   candidate files inspected (`229`, `293`, `318`, `397`, `398`, `401`, `404`, `409`, `415`): every
   existing "deactivated principal" cell targets a **different role** — `404` a `staff_admin` (and
   its own §1.5 comment says so explicitly, naming this very follow-up's predecessor as the reason
   it stopped at the staff_admin arm), `409` §3.10/3.11 a `staff_admin`, `397` §2.6 an `org_admin`,
   `401` §16.3/16.4 a `staff_admin`. `415`, the ADR 0200 subject-keying suite, contains **zero**
   occurrences of `is_active`. ⇒ the RED-first cell the clause demands does not exist to be reused.

**E2 — the Class-2 door list. The follow-up's COUNT is right: exactly 3 `public` RPCs.**
`public.update_professional_profile`, `public.redact_professional_profile`,
`public.set_professional_link_state` — all `prosecdef = t`, all with EXECUTE granted to
`authenticated`. What each writes to `public.professional_profiles`:

| RPC | columns written | Class-2 content |
| --- | --- | --- |
| `update_professional_profile` | `full_name`, `professional_type`, `license_number`, `license_region`, `specialty`, `affiliation_status` | name · licence number · region · specialty |
| `redact_professional_profile` | scrubs `full_name` → `'Profissional (dados removidos)'`, nulls `license_number`, `license_region`, `specialty`, `professional_type`, `affiliation_status`, `user_id`, **`cpf`**; sets `link_state`, `redacted_at`, `redacted_by` | **CPF** · name · licence · specialty — this one **destroys** |
| `set_professional_link_state` | `user_id`, `link_state` | account linkage only |

⚠ `set_professional_link_state` is gated by `app.can_create_professional` **unconditionally** and by
`app.can_manage_professional` **only when** the current `link_state` `is distinct from 'unknown'` —
so it is a *conditional* member of this arm's surface, not a flat one.

`app.can_manage_professional`'s live body is guard + two arms: `p_uid is not null` and
(`app.is_admin_for(p_uid)` **or** `app.is_org_admin_of_for(p_org, p_uid)`). Arm 1 is the subject of
the clause; arm 2 carries the `is_active` term arm 1 lacks. Its header comment already states the
AE5 template obligation ADR 0193 D5 / ADR 0200 imposed.

**E3 — ⛔ the follow-up's PREMISE is contested by ADR 0078 A35's own text, in two places.** The
clause asserts the noun rule forbids this. Read directly:

- **A35 PO ruling 1** — *"`platform_admin` **MAY** touch **tenancy · identity · vocabulary ·
  audit**; **MAY NOT** touch **commission content or PHI**"*, with the explicit instruction *"Rule on
  the noun, not the column"*. **"identity" is in the MAY list.**
- **A35 PO ruling 3** — *"**Class-2 (professional identity) is deliberately excluded** — audited
  reads, a product decision; over-reach fails keystone 23."*

⇒ the follow-up's *"the noun rule says a platform_admin may not touch Class-2"* is **not** what A35
says. ⚠ But A35's exclusion is worded around **reads** (*"audited reads"*), and these are **writes**,
one of them destruction — and A35 ruling 3's own reasoning treats destruction as the graver breach
(*"The breach is DESTRUCTION, not disclosure — platform_admin destroyed referral PHI it cannot
read"*), fixing `dispose_referral_phi` as a **lone outlier** on exactly that ground. So the question
is live on the merits; what is dead is the claim that A35 already answered it against the arm.

**PO ruling R3 — the `is_active` clause: GATE BOTH PREDICATES.** The PO ruled that platform-admin
authority **does** follow account state. Consequences, recorded now so Batch 10 inherits them:
Batch 10 owes the `is_active` term on **`app.is_admin()` and `app.is_admin_for()` both**, plus a
pgTAP cell that deactivates a `platform_admin` and asserts the admin arm denies, **RED before the
change**; and this batch owes the **clause correction in the register** — the entry's `Closes when`
names only `app.is_admin_for` and must be widened to both, with the measured blast radius beside it
and the superseded wording quoted, ⛔ corrected *before* anything closes on it, never around it. The
entry **stays `Status: open`**. ⚠ Whether `assume_role` also gains the term is a **third** site the
clause does not name; it is put to the PO with the rest of Batch 10's shape, not decided here.

**R4 — the Class-2 clause: PUT BACK FOR CONFIRMATION, not yet ruled.** The PO answered by handing
the lead a fuller evidence document (preserved verbatim at session scratchpad
`batch9-po-input-class2.md`). ⛔ **It is evidence and a RECOMMENDATION, not the ruling** — its §6 is
headed *"RECOMMENDATION"* and its own text addresses *"the PO"* in the third person and names a
*"fallback if the PO wants the narrowest change"*, so it cannot be read as the PO's own decision.
Its recommendation is **Arm B, relocated not deleted**: A35's "identity" noun is the *user
directory*; a tenant's professional registry is Class-2 *tenant* content; `platform_admin` reads it
and never writes it — with the vocabulary reach that today rides on this predicate re-declared as
its own explicit `is_admin_for` arm so it survives.
⇒ It also **corrects two of the lead's premises** and **widens the door list from 3 to a claimed 12**
(the transitive closure through `can_create_professional`, `can_manage_case_vocabulary` and
`can_manage_external_participant`). ⛔ Every load-bearing claim in it is under **independent
verification** before any of it reaches ADR 0201 — *text is not truth*, and a document is not a
measurement no matter who hands it over. The ruling is asked again, crisply, once that verification
returns.

### 2026-09-09 — the PO-supplied Class-2 document verified claim by claim; corrected in BOTH directions (lead)

**Why this step exists.** The document arrived from the PO, and *text is not truth* applies to a
document no matter who hands it over (LEARN's founding finding, bitten three times per ADR 0078
A35's own preamble). Eleven load-bearing claims were put to an independent subagent against the
same live catalog. ⭐ **Nine survive, two are corrected, and one omission is material** — and ⛔ the
corrections run in **both** directions: one figure was too small, one expected-red list was wrong
about what would red *and* missed something that would.

**CONFIRMED, quoted from the tree (V2, V3, V4, V5, V7, V9, V11):**

- **No UI affordance reaches the arm.** `updateProfessionalProfile` has 2 references in `src/`
  (its definition at `src/lib/participants/actions.ts:460` and one doc comment);
  `redactProfessionalProfile` has **1** (its own definition, `src/lib/ethics/actions.ts:638`). Zero
  component or client callers for either. ⇒ the arm's only live reach is **PostgREST**. ⚠ This is
  the same population as the open sibling `…-VOCAB-REDACTION-ZERO-CALLERS`, which is why it is a
  *reachability* fact and not a *harmlessness* one: a `'use server'` export is POST-reachable
  whether or not a component calls it (LEARN-018's Server-Action form).
- **Neither link dialog can reach the `can_manage_professional` branch.**
  `add-participant-dialog.tsx:982` fires only under `needsLinkage && … && !linkageDecidedAtCreation`,
  and `resolve-linkage-dialog.tsx:85` renders only when `participant.linkState === "unknown"`. The
  live RPC re-reads `link_state` from the row and applies `can_manage_professional` **only** when it
  `is distinct from 'unknown'` ⇒ both dialogs land on `can_create_professional`'s arm. The RPC's
  server-side re-read means a forged id falls **into** the org-authority check, not past it.
- **A `platform_admin` cannot reach the tenant route at all.**
  `src/app/o/[org]/c/[commission]/layout.tsx:108–113` returns `notFound()` when
  `access.role === null && !isQualityViewer && !isTenancyAdmin`, and its own comment names this case
  and cites **BUG-MT-005** (`docs/bugs/BUGS.md:168`, status **fixed**). ⇒ Arm B's *"E2E over the
  reachable UI path"* is **unwritable as the clause words it** — there is no such path. It must be
  rewritten as: platform JWT gets 404 on the case route **and** 42501 on a PostgREST call.
- **Both contradictory readings of A35 are live in the tree, verbatim.** `409` § 3.7's message says
  *"Professional IDENTITY is inside platform_admin's noun (ADR 0078 A35)"*; A30's inventory
  (`docs/progress/authz-a30-platform-admin-inventory.md:165–172`) puts **this same predicate** in
  **bucket C** — *"writes Class-2 professional records cross-tenant"* — and defers it as *"a product
  decision, not a safety necessity"*. ⇒ ADR 0201 must pick one **and retire the other in writing**;
  leaving both is how the next reader gets an all-clear from whichever they open.
- **AE5 structure holds.** `authz.roles` `platform_admin`: `allowed_scope_kind = none`,
  `state = legacy`. `org.professionals.manage` exists in `authz.permissions`
  (`risk_class = authority`, `sensitivity_ceiling = class2_professional_identity`,
  `resolution_scope_kind = organization`) and `authz.role_permissions` holds **0** grants of it, with
  no implication closure reaching it ⇒ **held by nobody**. A scope-less role cannot hold an
  org-scoped code, so *"keep the arm"* obliges AE5 to invent a carrier for it.
- **`FUP-ETHICS-RESPONDENT-PIN-FIRES-TOO-LATE`** is open, 🟠 high, `Closes when: PO to rule`.
- **HC0J7 does not cover the case that matters.** `redact_professional_profile` raises HC0J7 only
  when `retention_pinned_at` is set **or** the profile is a non-removed `respondent_doctor` on a case
  whose decision `status = 'issued'`. ⇒ it does **not** bar redacting the respondent of an
  **undecided** case — exactly the gap the ethics follow-up names.

⭐ **Those four facts compose into one concrete, currently-live scenario, and it is the sharpest
thing in this entry:** a `platform_admin` — **including a deactivated or suspended one**, per this
unit's own E1 — can erase the identity (name, CPF, licence, specialty) of the accused doctor in an
**undecided** ethics case, in **any** tenant, over PostgREST, with **no UI path**, **no retention
bar**, and **no tenant-side actor in the trail. ⛔ Verified in four independent pieces, not inferred
from one.**

**CORRECTED — the door closure is 14, not 12 (V1).** The document's set omits a **fourth** `app`
helper, `app.can_read_professional_profile`, and the two `authenticated`-executable RPCs it reaches:
`public.get_case_professional` (direct) and `public.log_audit_access` (via
`app._audit_access_authorized`'s `'professional_profile.read'` arm). Full closure: 3 direct
(`update_professional_profile`, `redact_professional_profile`, `set_professional_link_state`) + 2 via
`can_create_professional` (`create_professional_profile`, `ensure_professional_participant`) + 6 via
`can_manage_case_vocabulary` (create/archive × {`case_assignment_role`,
`ethics_allegation_category`, `ethics_sanction_type`}) + 1 via `can_manage_external_participant`
(`create_external_participant`) + **2 via `can_read_professional_profile`** = **14**.
⭐ **But the behaviourally affected set is 12, not 14, and the difference is load-bearing:**
`can_read_professional_profile` carries its **own** `app.is_admin_for` short-circuit that returns
before it ever calls `can_manage_professional`, so removing arm 1 changes **nothing** for those two
doors. ⇒ ADR 0201 must cite **14 in the closure and 12 as affected**; ⛔ a single number here is
wrong whichever one is chosen, and this is the *count-is-not-a-set* trap arriving as *one set is not
two questions*. ✅ Independent corroboration of the 3-direct sub-claim: `320:129–134` already asserts
by comment-stripped regex that **exactly 3** `public` RPCs name `can_manage_professional`.

**CORRECTED — the expected-red list is wrong in both directions (V10).** Of the four named:

| named | verdict |
| --- | --- |
| `228` update positive twin (`228_ethics_e1.sql:630–634`) | ✅ real — `lives_ok(update_professional_profile)` under a `platform_admin` hat, labelled a POSITIVE TWIN; flips to `throws_ok 42501` |
| `409` § 3.7 | ✅ real — same shape, and its **message text** must be rewritten, not just its polarity |
| `415` § 1.x arm-1 keying cells | ✅ real — the file's header pins *"BOTH ARMS, BOTH POLARITIES"* |
| `401` / `410` manifest fields | ⛔ **NOT a behavioural dependency.** The fields exist, but `pendingRekey.layer1Gate` is **AE-layer** terminology, not arm 1 of this predicate's own `OR`, and both `residualLegacyAuthority` entries citing it explicitly label it *"the org-manager arm"* — i.e. **arm 2**. `org.professionals.manage` has `enforcementSites: []`. **Removing arm 1 would not red `401` or `410`.** |

⛔ **And the list MISSED a real one:** `229_authz_m1_exclusion_durability.sql:215–220`, the
**"M1·1 FREEZE TWIN ⭐⭐"** — it calls `set_professional_link_state` on an **already-linked** profile
under a `platform_admin` hat and expects `HC0F2` (the B7 freeze). That path needs
`can_manage_professional` precisely because `v_current_link <> 'unknown'`, i.e. it reaches the door
**through arm 1**. Remove arm 1 and its error flips to `42501` at the authority check *before* the
trigger fires ⇒ **red**, and ⛔ red in a way that would read like the freeze had broken. ⚠ 13 test
files name `can_manage_professional`; the other 9 were inspected and carry no arm-1 behavioural
dependency (they test the AE4.7c split, arm 2, or structure).

**CORRECTED — two smaller figures (V6, V8).**
- ⛔ `dispose_attachment_phi` **does not exist in the live catalog, in any schema.** There are **4**
  `dispose_*` doors, not 5 — the 5 comes from the stale A30 doc. The document's own breakdown
  (5+2+1) sums to **8** while its headline says 7; the true total **is** 7 (4 + 3), so the headline
  was right by coincidence and the breakdown was not. ✅ The **outlier finding survives intact**:
  of all 7 destruction doors, only `redact_professional_profile` reaches `app.is_admin`/
  `app.is_admin_for`, and only transitively through `can_manage_professional`.
- `public.professional_profiles`: RLS enabled; **exactly one** policy (`professional_profiles_select`,
  SELECT, `authenticated`); ACL `{postgres,service_role}` and `has_table_privilege('authenticated', …)`
  **false for all of** SELECT/INSERT/UPDATE/DELETE ⇒ removing the arm at the predicate is not
  theatre. `organization_id` **NOT NULL** ✅. ⛔ *"UNIQUE per org"* is **REFUTED as worded**: the only
  org-scoped uniqueness is the **partial** index `professional_profiles_license_uniq` on
  `(organization_id, license_number, license_region) WHERE license_number IS NOT NULL`.

**What this changes for the ruling.** Nothing in the corrections weakens the merits — the destruction
outlier, the zero-UI reach, the nobody-holds-the-permission fact and the undecided-case gap all
survive. What the corrections change is **what ADR 0201 may write down** and **what Batch 10 must
expect**: the closure figure (14 / 12 affected), the E2E rewritten to the PostgREST path, `229`
added to the expected reds and `401`/`410` removed from them. R4 goes back to the PO with these
figures rather than the document's.

### 2026-09-09 — PO rulings R4, R5, R6; and ⛔ R4's stated rejection reason for Option 2 is REFUTED (lead)

**PO ruling R4 — the Class-2 write arm: ARM B, RELOCATED NOT DELETED.** The PO answered with an
execution-verified addendum (`AskUserQuestion`, 2026-09-09; PO's own run at head
`20261003007360`, rolled back) adopting the relocation and **rejecting the narrowest variant by
name**. The ruling to record in ADR 0201: *A35's "identity" noun is the **user directory**; a
tenant's professional registry is **Class-2 tenant content**. `platform_admin` **reads** it (A35
ruling 3, unchanged) and never **writes** it.* Batch 10 owes:

1. `app.can_manage_professional` → `select p_uid is not null and app.is_org_admin_of_for(p_org, p_uid)`.
2. `app.can_manage_case_vocabulary` gains an **explicit** `app.is_admin_for(p_uid)` arm — declared,
   answer-preserving. ⚠ **This is not optional tidying: the PO's run proved a bare removal STRANDS
   VOCABULARY** (`42501 "sem autorização para gerenciar o catálogo"`), and vocabulary is an A35
   MAY-noun. The explicit arm restores it *while redaction stays denied* — measured, both halves.
3. **No** platform arm on `can_create_professional` / `can_manage_external_participant` ⇒
   `platform_admin` loses professional create and external-participant mint. ⛔ A behaviour change
   **beyond the clause**, so ADR 0201 states it in its own sentence rather than letting it arrive as
   a surprise red.
4. **Expected reds to RE-RULE, never silence** — the corrected list (this unit's verification entry
   supplies it, ⛔ not the document's): `228:630–634` positive twin · `409` § 3.7 (**polarity *and*
   message text**) · `415` § 1.2 flips while § 1.1 and the arm-2 cells stay · `229:215–220` M1·1
   FREEZE TWIN. ⛔ `401` and `410` are **NOT** on this list — their fields are name-based and their
   `residualLegacyAuthority` entries name **arm 2**; an optional note only.
5. **Over-grant twins (ADR 0078 A33, ⛔ mandatory, each mutation-tested):** `org_admin` STILL
   updates / redacts / re-links; `platform_admin` STILL manages vocabulary; `platform_admin` DENIED
   `redact_professional_profile` RED-before / GREEN-after. ✅ The PO's run reports `org_admin`
   update/redact LIVE throughout, i.e. the twins already hold at head.

**PO-measured facts recorded as the PO's own (⛔ attributed, not adopted as this lead's
measurements).** Each is a claim this session did **not** re-run, and two of them are destructive:

- ⭐ **The harm is PROVEN, not argued:** at head, a `platform_admin` calling
  `redact_professional_profile` on the seeded **undecided** ethics case **LIVES** — it erased
  *"Dra. Denunciada"*. Rolled back.
- Bare removal ⇒ `42501` on redact / update / create / re-link **and** strands vocabulary.
- ⭐ **`229`'s flip is at the door's FIRST gate**, `can_create_professional` — **not** at
  `can_manage_professional` as the earlier verification assumed. `org_admin` (`sa_y`, seated at
  `229:112`) reaches `HC0F2` **before and after** ⇒ the cell **splits in two** per A33's ordering:
  `org_admin` proves the freeze, `platform_admin` proves the authority deny.
- Fixture ordering for Batch 10: `228:634`'s positive twin **precedes** the `org_admin` grants at
  `228:1119` ⇒ reorder, or seat the principal first.

⛔ **R4's STATED REASON FOR REJECTING OPTION 2 IS REFUTED — measured, and it is the lead's job to
say so.** The addendum rejects the narrow variant on the ground that *"`ensure_professional_participant`
is gated by `can_create_professional` and **seats a professional INTO A CASE — commission content**"*.
Both halves fail against the live catalog:

- **It does not seat anyone into a case.** Its only occurrence of the string `case_participants` is
  `app.assert_case_participants_enabled` — a **feature-flag assertion**; a regex for
  `(insert|update|delete) … case_participants` over the comment-stripped body returns **false**. Its
  writes are `public.participants` + `public.professional_participants`. ⭐ **The function's own
  comment says so in as many words:** *"this door is org-scoped, not case-scoped — it mints a
  registry identity, **it does not seat anyone**."*
- **It is not the seating gate.** `public.add_case_participant` is the seating door and it is gated
  by `app.is_staff_admin_of(v_case.commission_id)` — a **commission** predicate. `can_create_professional`
  does not appear in it. ⇒ a `platform_admin` holding `can_create_professional` could **not** seat a
  participant into a case.

⚠ **The CONCLUSION survives on a DIFFERENT fact, and that is why this is a correction and not a
reversal.** `ensure_professional_participant` inserts a `public.participants` row carrying
`sensitivity_class = 'professional_identity'` and `display_name = v_prof.full_name` — **the real
name** (ADR 0091 D1; `participants_sensitivity_derives_type` forces the class). So under Option 2 a
`platform_admin` could still **create Class-2 professional identity content in any tenant's org
registry** — an objection on exactly the same noun-rule ground the ruling rests on, just **org-scoped
Class-2 creation**, not commission content. ⇒ **ADR 0201 must record the surviving reason and ⛔ must
not repeat the refuted one**; writing *"seats into a case"* into an accepted ADR would put a false
sentence at the top of the authority chain, which is the `409` § 3.7 failure this very batch is
retiring. ⚠ Whether the surviving reason is *sufficient* to reject Option 2 is the PO's call and is
put to them with the ADR draft, not decided here.

**PO ruling R5 — retire `409` § 3.7's contrary reading of A35.** Adopted. ⚠ Under R4 the sentence's
host cell **flips anyway** (its `create_professional_profile` call is denied), so the marker work
**rides with Batch 10's rewrite** of that cell rather than being a Batch 9 text edit. Batch 9's share
is that **ADR 0201 names `409` § 3.7's message as superseded text and names A30's bucket-C reading as
the one that wins** — so the ruling is durable even if Batch 10 slips.

**PO ruling R6 — correct both register clauses now, before Batch 10 opens against them.** Adopted.
Owed in this batch: the `is_active` entry's `Closes when` widened from `app.is_admin_for` alone to
**both** admin predicates, with the measured blast radius beside it; the Class-2 entry's *"E2E over
the reachable UI path"* rewritten to the **PostgREST** path (there is no UI path — V4), and its door
list stated as the **closure of 14 with 12 behaviourally affected**. ⛔ Superseded wording quoted in
place, never overwritten. Both entries **stay `Status: open`**.

### 2026-09-09 — `FUP-ENFORCEMENT-MANIFEST-COMMENT-DESCRIBES-A-RED-THAT-IS-GREEN`: condition met and proven (lead)

**⚠ First, a correction to the follow-up's own address.** It says *"rows 31/32 of
`supabase/tests/vectors/authz-enforcement-manifest.json`"*, which reads as JSON positions. It is
**not** — those are the **AE4 permission-matrix** row numbers, and `401` § 19.2's message is what
maps them: row 31 = `org.participants.external.manage`, row 32 = `org.case_vocabulary.manage`
(row 30 = `…manage`, 33 = `…read`, 43 = `…create`). By **JSON insertion order** the same two rows sit
at positions **40 and 39**. ⛔ Nobody should have to re-derive that twice; both numberings are
recorded here. The two stale `_comment`s were found at their `legacyEquivalence.qualifier` fields,
which is the field the follow-up means.

**Measured before touching anything, on a FRESH `supabase db reset --local` (rc 0):**

- `401` § 19.2b's own expression — `count(distinct` comment-stripped `prosrc)` over
  `app.{can_create_professional, can_manage_external_participant, can_manage_case_vocabulary}` —
  **measures 2, expects 2** ⇒ green.
- `401` § 19.2c's expression, over the two-function pair — **measures 1, expects 1** ⇒ green.
- ⭐ **The md5s the stale comment cites are STILL CURRENT** (re-measured, ⛔ not quoted):
  `can_manage_case_vocabulary` and `can_manage_external_participant` both `3a86b023`,
  `can_create_professional` `f17a0c42`. So the *history* in that comment is accurate; only its
  *verdict* had rotted. ⇒ the fix is a resolution appended to a true record, not a correction of a
  false one — which is exactly why the follow-up forbids closing it by **deletion**.
- `403` § 2.3b exists and carries the co-sharing assertion the reduction rests on.

⚠ **A run-mechanics fact worth writing down:** `401` **cannot run alone**. In isolation it dies at
line 1056 with `ERROR: schema "test_helpers" does not exist` — 95 of 121 planned, `Bad plan`, exit
**3**, and ⛔ **0 `not ok`**, i.e. it fails without a single failing assertion. `test_helpers` is
created by `supabase/tests/00_setup.sql`. ⇒ any single-file `401` debug loop must pass `00_setup.sql`
first, and ⛔ an exit-3 `Bad plan` with 0 `not ok` is a **harness** result, never a finding.

**The change.** Both `legacyEquivalence.qualifier` fields rewritten to open with `✅ RESOLVED
2026-09-09`, stating (a) the current values of § 19.2b and § 19.2c, (b) **what was ruled** — 19.2b's
expected value *was* moved 1 → 2, and the objection the comment raised against that move (*a bare
count of 2 over three functions is satisfied by ANY of the three pairings*) was answered **not** by
editing 19.2b alone but by **adding § 19.2c**, which pins *which* pair survives, with `403`'s fourth
representative and its § 2.3b carrying the co-sharing — (c) the standing prohibition **kept**: ⛔
19.2b must still red on a fourth split, and an expected value that tracks reality by being edited is
not an assertion, and (d) the **entire superseded text quoted verbatim** under
`--- HISTORY, THE SUPERSEDED TEXT QUOTED IN FULL:`. Recorded on **both** rows, not once — the same
reason the gap was recorded on both.

**Witnesses, exit codes read BARE:**

- ⭐ `npx supabase test db --local supabase/tests/00_setup.sql 401 403 410` **AFTER** the change:
  `All tests successful. Files=4, Tests=189`, `Result: PASS`, **0 `not ok`**, **exit 0**. (`401`
  alone, before the change, on the same fresh reset: `Files=2, Tests=122`, `PASS`, exit 0.)
- `npm run lint:authz-vectors` (gate 12) first reported **DRIFT** — the generated fixture is derived
  from this JSON — and is **green** after `node scripts/gen-authz-matrix-cells.mjs`.
- ⭐ **The diff is 4 lines across 3 files and every one is accounted for**: 2 in the manifest JSON
  (the two qualifiers), 1 in `authz-matrix-coverage.json` (**`manifestSha256` only** — `expected`
  117000 / `executed` 2002 / `skipped` 114998 all unchanged), 1 in
  `authz_enforcement_manifest.psql` (**`sourceSha256` only**). ⇒ the generated fixture carries **no
  qualifier text at all**, so a comment propagates as a sha stamp and nothing else — which is the
  correct shape and is why gate 12's DRIFT was a stamp, not a data change. ⛔ Gate 12 was green in
  this unit's baseline, so no pre-existing drift was absorbed.

⇒ **The clause's three conditions are met**: the comment states the ruling that was taken ✅, states
the current value of § 19.2b ✅, and a fresh run of `401` is quoted beside it showing § 19.2b and
§ 19.2c green ✅. ⚠ The register entry still **stays `Status: open`** until the Record step, after PO
approval — a met condition is not a closed entry.

### 2026-09-09 — plan received (backend/Opus, plan-only turn); lead spot-check; three PO questions framed (lead)

**Plan.** `backend` (Opus) returned a FULL plan in text, no files written, on the fresh-reset state
this session handed it (head pair `(20261003007360, 525)`, unchanged). Preserved at session
scratchpad `batch9-backend-plan.md`. Its verdict, and ⛔ it is a **sizing refusal**, not a schedule:

⭐ **The eight subjects contain 14 distinct decisions, and one ADR would be ~900–1,200 lines.**
Corpus calibration, measured over the live `docs/decisions/` corpus: **n = 198, median 123 lines,
p90 390, max 2119**; the two comparable multi-decision authz ADRs cost **559** (`0190`) and **599**
(`0191`) for 4–5 decisions each. ⇒ one document is *"four ADRs in a trench coat"*, and it also
defeats `Supersedes:`/`Amends:` — reversing the `D` ceiling later would mean amending the very
document AE5's template cites.

**Proposed split, with the opening one named:** **0201** *the keying asymmetry is the model* (F6 +
ADR 0200's template obligation + R3 + R4 + R5, ~280 lines) · **0202** *the role catalog is one
manifest, and `platform_role` retires with it* (F7, F8, the retirement, ~180) · **0203** *the seam is
already encoded; the classification columns are not* (F5 + the three columns, ~170) · **0204** *two
platform-wide conventions with a census and no gate* (the `D` ceiling + `search_path`, ~150).
⭐ **0201 alone is the true opening ADR**, and the reason is measured, not asserted: AE5's increment
1 is `staff_admin`, which is **the only role already `state = 'authoritative'`** (`select code,
allowed_scope_kind, state from authz.roles` → 11 `legacy` + `staff_admin authoritative`), so 0202
gates increment **2**, not 1. ⭐ And the arithmetic closes: **AE5's eleven increments = 12 catalog
roles − `staff_admin`.**

⭐ **Its sharpest finding: F6 is not an open design question — the catalog already implements an
answer nobody ratified.** `authz.entailed_grants` emits a `hat_ok` column computed as
`(p_principal is distinct from (select auth.uid()) or af.role_code is not distinct from
app.active_role())`, carrying the comment *"The §6A ASYMMETRY … a THIRD-PARTY question ignores the
hat …, a SELF question requires it …. Neither uniform choice is correct."* And `authz.has_permission`
**enforces** it (`and eg.hat_ok`). ⇒ the **live third option is subject-keyed asymmetry**; the
implementation audit **recommends** the exact-assignment hat; ADR 0176 D8 names only the
exact-assignment and role-wide options. ⛔ **The code implements an option the binding decision does
not list.** And `app.is_admin_for`'s ACT clause is that same predicate with the role hardcoded ⇒ F6,
ADR 0200's keying obligation and R3/R4 are **one decision**, which is why they share 0201.

**Two subjects are not ADRs at all, and the plan says so with measurements:**

- **Item 3 (arm-3 divergent cells) is WORK, not a decision.** The enumeration **does not exist**:
  `supabase/tests/vectors/authz_differential_cells.psql` holds 216 `org.professionals.read` rows and
  `grep -c divergent` = **0**. The manifest only narrates the hazard
  (`authz-enforcement-manifest.json:1240`: *"arms 1 and 3 are EXERCISED BUT NOT ORACLED, and arm 3 is
  OPEN AND MASKING"*). ⇒ recommend **deferring to a named unit `AE5-MATRIX-ARM3-CELLS`**, due before
  increment 1 runs its matrix, not before its template is written.
- **Item 6 (per-role checklist) is one lead doc edit.** `docs/plans/authz-evolution.md:1172–1180`
  carries **0 of the 5** corrections (zero occurrences of `SCOPE:`, `SELFTEST`, `set-valued`,
  `NOTICED`, `RESET_EVERY`, `CARRIED`); three of the five already have a home in
  `docs/lead-playbook.md`. ⇒ five pointer lines at the Record step. ⛔ Not backend's file.

**Plan's recommendation: 0201 + 0203 in Batch 9 · 0202 next · 0204 and items 3 and 6 out.**
*"Three ADRs at ~280/~170 and one lead doc edit is one honest session. Four ADRs plus 216-row triage
is four."*

**LEAD SPOT-CHECK — three claims re-measured; ⛔ two hold verbatim and the third exposed a fault in
the LEAD'S OWN instrument, not in the plan.**

1. ✅ `docs/decisions/0176-…:45–47` confirmed verbatim: *"Readers of `session_selectable`,
   `risk_class`, `sensitivity_ceiling`, `resource_kind`: **none**."* ⇒ the plan's *"the no-reader list
   is FOUR columns and one of them now HAS a reader"* rests on real text. (`session_selectable` is
   read by `public.assume_role` and gated by pgTAP `408` — so the set shrank **4 → 3** and no gate
   could say so.)
2. ⚠ **Grain correction to the plan, not a refutation.** It says ADR 0175 *"already **asserts** it as
   done"*. The actual sentence (`0175:130–131`) is *"D3 leaves AE5 a named inheritance: the arm-3
   cells **arrive** already enumerated and already known to diverge, so AE5 rules them rather than
   discovering them."* That is **forward-looking** — a promise about the hand-off, not a claim of
   present completion. The plan's substance survives (**nothing discharges it, and the enumeration
   is measurably absent**); its verb does not. ⛔ ADR 0201 must not quote it as an assertion of
   completion.
3. ⛔ **THE LEAD'S CHECK WAS THE WRONG INSTRUMENT.** A `prosrc ~ 'hat_ok'` regex over `authz`
   returned **false for `entailed_grants`** and true for `has_permission` /
   `candidate_has_permission`, which read as *"the plan attributed the term to the wrong function."*
   It did not. `hat_ok` is a **`RETURNS TABLE` column name** — it lives in the function's **result
   type** (`pg_get_function_result` → `… hat_ok boolean)`), so `prosrc` cannot contain it, while the
   predicate **and** the `§6A ASYMMETRY` comment are in the body **exactly as the plan quoted them**.
   ⭐ **LESSON (Record step): a `prosrc` regex is BLIND to a `RETURNS TABLE` column name** — a
   `hat_ok`-shaped negative from `prosrc` alone is an instrument artefact, and the whole F6 finding
   would have been "refuted" by it. ⭐ Also corrected upward: the consumers are **three**, not one —
   `has_permission`, `candidate_has_permission` **and** `explain_permission`.

**Findings the plan surfaced that this batch will FILE, not fix** (Record step; ⛔ named now so they
are not re-discovered): ADR 0175 D3's undischarged forward promise · `0176:45`'s no-reader list
stale 4 → 3 with no gate able to say so · `FUP-AE4-CANDIDATE-SCOPE-FANOUT-IS-UNBOUNDED`'s *"nothing
in the schema bounds either"* refuted — **`D ≤ M` structurally**, from
`authz.authorized_scope_ids`' one-candidate-per-assignment-fact shape, with
`M ≤ |commissions| + 6·|hospitals| + 2·|orgs| + 1` derived from three `memberships` constraints ·
`FUP-NO-GATE-CATCHES-A-COLLAPSED-SEARCH-PATH`'s figures stale in three ways (**5** live
`search_path` values, not 2; **23** empty-form not 17; and `public.tenant_orphan_profiles`
**inverts** the resolution order relative to the dominant 825 — a semantic singleton, not a style
one) · `authz-matrix-coverage.json`'s `migrationHead: "20261003007260"` against a live
`20261003007360`.

**Next: three PO questions, all *changes scope*, so all before the build** — the sizing verdict, F6's
disposition, and whether items 3 and 6 are in or out. A fourth (does `public.assume_role` also gain
the `is_active` term?) and the three measurement-backed ones (the classification columns, the `D`
ceiling, the `search_path` value) follow, and their measurements are already in hand.

### 2026-09-09 — PO rulings R7, R8, R9; and R8's audit-scope obligation measured, not quoted (lead)

**PO ruling R7 — sizing: ADR 0201 + ADR 0203 in Batch 9.** `0202` (the role catalog, `platform_role`
retirement) becomes the next unit, due before AE5 **increment 2**; `0204` (the `D` ceiling, the
`search_path` convention) is deferred **with both censuses written into the follow-up bodies now**, so
neither is re-measured. Plan §3 owes the deferrals in writing.

**PO ruling R8 — F6: RATIFY THE SUBJECT-KEYED ASYMMETRY THE CATALOG ALREADY IMPLEMENTS.** A question
about a third party ignores the hat; a question about the caller requires it. This is ratification of
enforced behaviour — the other two options change a live resolver whose blast radius is
`authz.has_permission`, `authz.candidate_has_permission` **and** `authz.explain_permission` (three
consumers of `entailed_grants.hat_ok`, not one).

**PO ruling R9 — item 3 OUT, item 6 IN.** Item 3 → a named unit **`AE5-MATRIX-ARM3-CELLS`**, due
before AE5 increment 1 runs its **matrix**, ⛔ not before its **template** is written — that is the
real dependency, and it keeps ~216 rows of per-cell triage out of this batch. Item 6 → five pointer
lines the **lead** adds to `docs/plans/authz-evolution.md:1172–1180` at the Record step. The
undischarged ADR 0175 D3 promise is filed as a follow-up so it cannot go missing.

**⭐ R8's owed verification, now done — and it does NOT come out where the audit's text left it.**
The lead told the PO that the audit-scope consequence rested on the audit's prose rather than a
catalog read, and owed the read before ADR 0201 could state it as fact. Measured from
`public.assume_role`'s live body:

- For a **non-`platform_admin`** role it selects the matching membership
  `order by m.granted_at desc nulls last, m.id limit 1` — deterministic, but **semantically
  arbitrary**: the most recently granted seating, tie-broken by id — and stamps that ONE scope triple
  (`v_org`, `v_hospital`, `v_commission`) into `app.audit_write('active_role.assumed', …)`.
- `app.active_role_selections` stores `(session_id, user_id, role, chosen_at)` — ⭐ **no scope column
  at all.** The selection is role-wide by storage, not by interpretation.
- And `hat_ok` compares **`af.role_code is not distinct from app.active_role()`** — **role only, no
  scope term.**

⇒ **F6 has TWO axes and the ruling settles only one.** On the **subject** axis the hat is
asymmetric (R8 ratifies that). On the **scope** axis the hat is **role-wide**, so effective authority
spans **every** seating of the role while the audit row names **one**. ⛔ **Ratifying option (i) does
not fix the audit-scope mismatch — it ratifies it**, and ADR 0176 D8's own words make settling that
mandatory rather than optional: *"F6 exact-assignment active context vs the role-wide hat (**audit
scope must match whichever wins**)"*. So ADR 0201 cannot be complete on R8 alone; the matching half
is a distinct question, put to the PO before the build rather than drafted around.

⚠ Note for whoever drafts it: for the `platform_admin` branch there is **no scope to stamp** —
`v_org`/`v_hospital`/`v_commission` stay NULL by the ruling's own carve-out — so the mismatch is a
**tenant-role** phenomenon only, and a fix that assumes every branch has a scope is wrong.

### 2026-09-09 — PO ruling R10; lead half built (item 6, plan sizing, two censuses, the arm-3 unit) (lead)

**PO ruling R10 — the audit stamp: LOG THE ROLE ONLY, no place.** `active_role.assumed` carries no
scope columns; implementation ⇒ **Batch 10**. Rationale to record in ADR 0201: it matches the storage
(`app.active_role_selections` has **no scope column**), each later action audit row already carries
its own place, and it avoids the trap the alternative walks into — a footprint recorded at
assume-time is a **snapshot** that a mid-session grant invalidates while `hat_ok` admits the new
seating. ⚠ The `platform_admin` branch already stamps NULL by its own carve-out ⇒ a **tenant-role**
change only, and a fix assuming every branch has a scope would be wrong.
⇒ **D8's *"audit scope must match whichever wins"* is discharged by R10, not by R8.**

**Lead half built, on files disjoint from the concurrent ADR-drafting turn** (`docs/decisions/**` is
backend's; `docs/plans/**`, `docs/progress/**`, `docs/features/**`, `docs/followups/**` are the
lead's — the rulings file states the split, and forbids the build turn any git command that mutates
the working tree, because a build agent's `git stash` silently reverted a lead's uncommitted work on
this repo once already):

1. **Item 6 — the five corrections, added as POINTERS** to `docs/plans/authz-evolution.md` § Per-role
   checklist. ⛔ Measured **before** adding, so the claim is a finding and not an impression: the file
   held **zero** occurrences of `SCOPE:`, `SELFTEST`, `set-valued`, `NOTICED`, `RESET_EVERY` and
   `CARRIED` ⇒ **0 of 5**. Each is a pointer naming its authority (ADR 0189/0190/0191, lead-playbook
   §4, `pre-ae5-remediation.md` §4/§5), ⛔ **not a second home** — *a correction that lives only where
   the batch that found it wrote it is a correction the next role increment will not read.*
   ⚠ Correction 4 carries its own live caveat: `rowdoor` and `invoker` **still lack `RESET_EVERY`**.
2. **Plan §3 — the sizing ruling and every deferral in writing**, with the corpus figures and, for
   each deferral, the reason it may wait. ⭐ The `0202`-gates-increment-2 claim is stated **with its
   measurement** (`staff_admin` is the only `authoritative` role), not as a judgement.
3. **Both deferred follow-ups now carry their censuses**, per R7, so ADR 0204 never re-measures them —
   and each body says ⛔ **the clause may not be closed on the figures it was filed with**:
   - `FUP-AE4-CANDIDATE-SCOPE-FANOUT-IS-UNBOUNDED`: its *"nothing in the schema bounds either"* is
     **refuted** — `D ≤ M` structurally, `M` bounded by the tenant tree from three `memberships`
     constraints — plus the product-seed census (all **33** seated principals in **exactly 1** org)
     **and** the perf-fixture figures beside it, because they are different populations and a
     closure needs both. The no-instrument negative carries its self-test.
   - `FUP-NO-GATE-CATCHES-A-COLLAPSED-SEARCH-PATH`: **five** live conventions, not two; empty-form
     **23** not 17; dominant **825** not 400 (400 is only its `app` half); and
     `public.tenant_orphan_profiles` **inverts** the resolution order — ⭐ a **semantic singleton**,
     which is exactly the shape a count cannot show. Its two surviving premises re-verified; its own
     gate-count numeral flagged stale **again**.
4. **`AE5-MATRIX-ARM3-CELLS` hub created** (`status: planned`) per R9, stating why it is **work and
   not a decision**, that the dependency is the **matrix** and not the template, and that the open QA
   finding at `docs/reviews/authz-ae4-review.md:99-101` is a live home not to be duplicated. ⚠ It also
   notes that this unit **writes generated vectors**, so ⛔ Batch 7's empty-pathspec assertion does
   **not** carry over to it.
   ⚠ **Gate 13 caught a real thing here:** the hub's `adrs:` listed `"0201"`, which **has no file yet**
   — `[HUBS] ADR 0201 has no file`. Dropped with an inline note; ⛔ **the Record step must re-add it**
   once `docs/decisions/0201-*.md` exists. A forward ADR reference in frontmatter is gated; in prose
   it is not.

**Still owed in this batch:** ADR 0201 + ADR 0203 (drafting turn in flight) · the classification-column
PO question (0203 leaves it `PO to rule` by instruction) · the `public.assume_role` `is_active`
question (R3's named third site) · the Record step's filings — the five named findings, the
`prosrc`-blind-to-`RETURNS TABLE` lesson, and R10's Batch 10 implementation, which has **no register
home yet**.

### 2026-09-09 — build turn: ADR 0201 + ADR 0203 written; SEVEN re-measurement findings, one of them against the LEAD (backend, then lead spot-check)

**Built.** `docs/decisions/0201-the-keying-asymmetry-is-the-model.md` (**353** lines) and
`docs/decisions/0203-the-seam-is-already-encoded-the-classification-columns-are-not.md` (**253**),
both `Status: proposed`, both added to `docs/decisions/proposed-review.json` (`proposed` now 10 —
gate 9 reds when that set drifts from the live corpus; the **lead** flips them to `accepted` and
removes them at the Record step, per L2). `npm run adr:index` run **once**.
**Headers:** 0201 `Amends:` 0176 (D8's F6 slot), 0193 (D5), 0200; `Supersedes:` — ⭐ deliberately
phrased to begin *"nothing in the ADR corpus"* so the generator's `NOTHING_RX` suppresses a bogus
back-pointer edge, with `409` § 3.7's first clause named **in prose** at D6, because the header
vocabulary takes ADR numbers only. 0203 `Amends:` 0172, 0176; ⭐ its `Status:` line itself carries
`D3 is PO to rule`, so the open sub-question cannot be missed by a reader who stops at the header.

⚠ **Four files outside the build turn's permitted list changed, disclosed rather than absorbed:** the
**generated** `adr-backpointers` blocks in `0172`, `0176`, `0193`, `0200` (+10/−0, +1/−1, +1/−1,
+10/−0). Verified line-by-line as machine-owned only, and the edges are exactly L15's
(`0176 ← 0201, 0203` · `0193 ← 0201` · `0200 ← 0201` · `0172 ← 0203`). ⛔ **Any new `Amends:` header
forces this** — so L4's file-ownership list was under-specified, not violated. Recorded so the next
batch's rulings file names the generated blocks explicitly.

**Overruns flagged, not hidden:** 353 against ~280 and 253 against ~170. Both grew on **content** —
0201 carries finding 4's two tables and finding 5's mechanism; 0203 carries the four-row seam table
and three options each with measured consequences. Corpus context: median **123**, p90 **390**,
`0200` itself **306** ⇒ both sit inside p90. **Lead ruling: accepted, no cut.** ⛔ Compressing here
would cut qualifiers first, which is this project's measured failure mode.

**Gates run by the builder, bare:** `adr:index` **0** · `lint:adr-index` **0** · `lint:registers`
**0** · `lint:progress` **0** · `lint:mojibake` **0**.

**THE SEVEN FINDINGS FROM RE-MEASUREMENT.** ⭐ Three change what the ADRs say, one is against the
lead, and one is a Batch 10 obligation nobody had named.

1. ⛔ **THE LEAD'S L13 WAS WRONG, AND THE BUILDER CAUGHT IT.** L13 attributed `401`'s
   implication-monotonicity assertions to **§ 12**. **Verified by the lead against the source:**
   `401:369` is `-- §7 — THE PHI / WRITE SEPARATION INVARIANTS, as data tests.` and the cells are
   **7.1–7.5** at `:397 / :406 / :408 / :414 / :416`; `:627` is the AE4.5 generator section. Line
   numbers right, **label wrong**. ⭐ And the correction makes the finding **stronger**: `:408` is
   *"7.3 DISCRIMINATION CONTROL … the two invariants are independent, not one predicate counted
   twice"* ⇒ removing either column also destroys **the control that proves they are two
   invariants**, not just the invariants. ⚠ **Second lead error this batch** (after the
   `prosrc`-blind-to-`RETURNS TABLE` check) — the pattern is the lead asserting a *location* from
   memory of a file it read once. ⇒ **LESSON at the Record step.**
2. **The plan's *"151 → 150"* delta is NOT REPRODUCIBLE.** Eleven grains tried against
   `entailed_grants`' comment; **none** yields 27, 150 or 151 (`_for` functions 18/37 · bodies 104/69
   · policies 2 · occurrences 141/178 · `auth.uid()` bodies 43/244/2/289 · `(select auth.uid())` 57 ·
   policies 184 · occurrences 53). ⇒ written into the ADR as *"reproduces at no grain measured"*,
   ⛔ **not as a delta** — a corrected literal would be the same defect with a newer number.
3. **The plan UNDERSTATED F5's encoding.** Sensitivity is encoded **twice**, not missing: `axes.sensitivity`
   on **43 of 43** rows, gated by `410 § 2.3` (*"THE FOUR-COLUMN MIRROR"*) **and** the lint arm at
   `gen-authz-matrix-cells.mjs:704`, *plus* the `gate: null` hard-deny class at `:250`. ⇒ 0203's D2
   is reframed: the corner is that entry's **`note`** — the only one pointing at a **deferral**
   rather than a mechanism — ⛔ not a missing gate.
4. ⭐⭐ **R10 HAS EXPECTED REDS NOBODY NAMED, AND IT CREATES A VACUITY.** `supabase/tests/315_act_stage3_hat_condition.sql`
   is the **only** file pinning the `active_role.assumed` scope, and it holds **four** live cells.
   **Verified by the lead:** `:208` asserts the audit row's `organization_id` **=** `org_b` and
   `:230` asserts `commission_id` **=** `comm_x` — both non-NULL, both **FLIP** under R10; `:249`
   (platform tier, all three NULL) is R10's own carve-out and stands. ⛔ **And `:212` — *"hospital_id
   /commission_id stay NULL for an org-tier hat"* — STAYS GREEN WHILE LOSING ALL DISCRIMINATING
   POWER**, because the cell that made it discriminating is `:208`, the one that flips: once every
   scope column is NULL, *"these two are NULL"* distinguishes nothing. ⇒ **Batch 10 owes `:212` a
   REWRITE, not a tick** — ADR 0078 A33's *"a test that cannot fail is not evidence"*, arriving as a
   **consequence of a ruling** rather than of a code change. ⛔ This is the finding most likely to be
   lost; it goes in R10's follow-up.
5. **The *"`401`/`410` are not dependencies"* claim is RIGHT, but not for the stated reason.**
   `pendingRekey.layer1Gate = app.can_manage_professional` sits on **one** row
   (`org.professionals.manage`, `enforcementSites: []` **and** `domainAuthorizer: null`), and the two
   `residualLegacyAuthority` entries naming that gate do say *"the org-manager arm"* ✅ — but
   `org.professionals.read` **separately** declares a residual entry whose gate **is
   `app.is_admin_for`**, and that one survives R4 untouched. ⇒ stated precisely so a later checker
   does not find arm 1's predicate in the manifest and reopen a closed question.
6. **A30's bucket-C table — R5's WINNING reading — carries a stale name.** It lists
   `dispose_attachment_phi` among five disposal doors; the live catalog has **4**. ⇒ 0201 cites A30
   **for its classification**, ⛔ not wholesale. ⚠ The same stale name reached this batch through the
   PO-supplied document (its *"5 `dispose_*`"*), i.e. **one stale row propagated into two documents**.
7. **`409` § 3.7's message is stale on TWO counts, not one.** Besides the A35 clause R5 supersedes,
   `:680` names the arm `app.is_admin()` — but since ADR 0200 the chain reaches **`app.is_admin_for`**,
   and `create_professional_profile`'s comment-stripped body contains **no** `app.is_admin()` (control:
   `can_create_professional(` **present**). ⇒ **Batch 10's rewrite is not a polarity flip alone.**
   ⚠ Related stale text deliberately **not** edited: `app.can_create_professional`'s own comment still
   says *"platform_admin via is_admin()"*.

**Left undecided on purpose, each with its reason:** 0203 **D3** (the three classification columns) —
`PO to rule`, three options with measured consequences, plus an explicit *"no default applies while D3
is open"* because ADR 0176 D8's clause is a **disjunction with no third branch** · 0201 **D4** —
`public.assume_role`'s `is_active` term (measured absent; control `is_org_admin_of_for` **present**),
R3's named third site, unruled · 0201 **D5** — whether Option 2's *surviving* reason is **sufficient**
is the PO's call, ⛔ not the drafter's.

**⭐ The batch's defining claim, measured at the tip:** `git diff --name-only main... -- supabase/migrations
supabase/seed.sql src` is **EMPTY**. Full diff scope is `docs/features` · `docs/followups` ·
`docs/plans` · `docs/progress` · `supabase/tests/vectors` — no migration, no seed, no `src`.

### 2026-09-10 — PO rulings R11, R12; GATE AT THE TIP (run by the lead, not the builder) — and one instrument red isolated to bash 3.2 (lead)

**PO ruling R11 — ADR 0203 D3: KEEP ALL THREE classification columns**, each owing a **named
layer-3 consumer**, with `session_selectable` cited as the precedent that a consumer does eventually
appear. The removal options were declined on the measured cost: `401` § 7's cells 7.1–7.5 use
`resource_kind` and `risk_class` as an **ordering** to assert PHI/write monotonicity, and `:408` is a
**DISCRIMINATION CONTROL** proving the two are independent invariants rather than one predicate
counted twice ⇒ removal is an **invariant loss plus the loss of its control**, not a test edit.

**PO ruling R12 — ADR 0201 D4: gate `public.assume_role` TOO, in the same Batch 10 change**, with its
own RED-first pgTAP cell. Rationale recorded: gating the two checks while leaving the **seating**
door ungated would make the fix *read* as complete while a deactivated admin could still put the hat
on. ⇒ Batch 10's `is_active` scope is now **three** sites, not the two R3 named.

**0201 D5 closed without a fresh question.** The lead reported the refutation of R4's stated reason to
the PO in plain terms; the PO did not reverse R4 and went on to rule R5–R12. ⇒ per the reaffirmation
rule that is their decision: **R4 stands on the SURVIVING reason**, the refuted one is **withdrawn**,
and ADR 0201 records both facts with their provenance visible. ⛔ The lead did not decide sufficiency;
it recorded that the ruling was reaffirmed after the refutation was disclosed.

---

## GATE AT THE TIP — `HEAD` = `2c58bde6` + the two ADRs. Exit codes read **BARE**, no pipes.

⚠ **A shell fact that voided one capture and is worth the line:** the first attempt wrote
`echo "LINT_RC=${PIPESTATUS[0]}"`. This session's shell is **zsh**, where the array is
`pipestatus` (lower-case) — so the capture printed **empty**, not a code. ⛔ An exit code read
through the wrong array name is not a bare read; `npm run lint` was re-run on its own.

| step | result |
| --- | --- |
| `npm run lint` | ⭐ **rc 0 bare**, 17 of 17 gates, eslint **0 errors / 0 warnings** |
| `npm run typecheck` | **rc 0** |
| `npm run test` (vitest) | **rc 0** — `151` files, `2056` tests, all passed ⇒ **identical to Batch 8**, no drift |
| `supabase db reset --local` | **rc 0** (fresh, immediately before `test:db`) |
| `npm run test:db` (pgTAP) | ⭐ **rc 0** — `Files=264, Tests=8923`, `Result: PASS`, `All tests successful.` ⇒ **shape did not move** (Batch 8: 264 / 8923) |
| `ARM=census` | **rc 0** — `=== INVARIANT HOLDS ===` |
| `ARM=hat` | **rc 0** — `HAT-BLIND SWEEP HOLDS: 4 finding(s), all reasoned-allowlisted` (`authz.assignment_facts` · `public.assume_role` · `public.session_context` · policy `public.memberships.memberships_select`) · `=== INVARIANT HOLDS ===`. ⚠ **`public.assume_role` is on that allowlist and is now an R12 subject** — Batch 10 must re-derive the allowlist reason, not inherit it. |
| `ARM=floor` | **rc 0** — `=== INVARIANT HOLDS ===` |
| `FROMFINDINGS=1 ARM=wrapper` | **rc 0** — `mode: FROMFINDINGS (comparing COMMITTED findings md, no sweep)` · `=== INVARIANT HOLDS ===` |
| diff-scoped door deriver, `main...HEAD` | ⭐ **rc 3 bare = NOT-APPLICABLE**, and **that exit IS the "no gate changed" claim** (CLAUDE.md §6 step 1). `CASELIST` **0 bytes**, correctly — a no-migration batch derives nothing. |
| empty-pathspec assertion | ⭐ `git diff --name-only main... -- supabase/migrations supabase/seed.sql src` → **EMPTY**. Full diff scope: `docs/features` · `docs/followups` · `docs/plans` · `docs/progress` · `supabase/tests/vectors` |
| `SELFTEST=1 door-sweep-cases` | ⛔ **rc 1 — `PASS 40 · FAIL 6 · SKIPPED 0`** (see below) |

**The deriver's `SCOPE:` line, quoted verbatim** (owed on every exit, 0/1/2/3):

```
=== RESULT: NOT-APPLICABLE (3) — no migration file in the diff. ===
SCOPE: 0 file(s) — 0 committed (main..HEAD), 0 worktree, 0 untracked | filter: none | derivation: NOT REACHED (this run ended before the catalog was probed)
```

⚠ `derivation: NOT REACHED` is the correct value here and ⛔ **not** a `PROVISIONAL` heuristic — the
run ended before probing the catalog because there was nothing to probe.

**The three `--- GROUP …` lines, quoted rather than restated:**

```
--- GROUP deriver:               scenarios 20 (pass 20 · fail 0 · skipped 0)
--- GROUP merge helper:          scenarios 18 (pass 18 · fail 0 · skipped 0)
--- GROUP audit startup capture: scenarios 8 (pass 2 · fail 6 · skipped 0)
```

### ⛔ THE SELFTEST RED, ISOLATED TO A CAUSE — and it is a bash-VERSION landmine, not a semantic defect

**Attribution first.** `git diff --name-only main... -- scripts/ supabase/tests/mutation/` is
**EMPTY** ⇒ every harness and the self-test are **byte-identical to `main`**, and the self-test reads
none of this batch's changed paths. ⇒ ⛔ **not attributable to Batch 9.**

**The failing set is exactly 3 harnesses × 2 polarities**, all in the `audit startup capture` group:
`p0-authz-door-audit`, `p0-authz-rowdoor-audit`, `p0-authz-invoker-audit` — and
`p0-authz-writepath-audit` **PASSES both**. Reproduced by hand; the harness's own output names it:

```
p0-authz-door-audit.sh: command substitution: line 797: `case "$CASES_EXPLICIT_AT_STARTUP" in 0|1'
  NOT OK 0  startup capture is a set-ness bit (0|1)  ->  echo 1;; *) echo 0;; esac) (expected 1)
--- SELFTEST TOTAL: 32/33 ok, 1 failed ---
```

⭐ **The cause is `bash 3.2.57`, the macOS default** (`/bin/bash`; no bash ≥ 4 on this machine). Its
`$( … )` parser closes the substitution at the `)` in the `case` pattern `0|1)`. Minimal repro,
same shell: `V=1; echo "result=$(case "$V" in 0|1) echo 1;; *) echo 0;; esac)"` →
`result= echo 1;; *) echo 0;; esac)`.

**The three unportable sites**, one line each: `p0-authz-door-audit.sh:798` ·
`p0-authz-rowdoor-audit.sh:308` · `p0-authz-invoker-audit.sh:367`. ⭐ **The writepath harness carries
the SAME assertion in a portable shape** — a plain `case` **statement**, not a substitution
(`p0-authz-writepath-audit.sh:1313-1315`) — and it was the one **ported, not copied**, in Batch 3
(ADR 0192). ⇒ **this is the copy-not-port class, arriving in the instrument rather than the subject.**

⛔ **THE LEAD'S FIRST PROPOSED FIX WAS WRONG, AND ITS OWN CONTROL CAUGHT IT.** The lead proposed the
POSIX optional leading paren — `in (0|1)` — and measured it under the failing shell: **still broken**
(`result= echo 0;; esac)`). ⇒ had that gone into a `Closes when`, the clause would have named a fix
that does not work — Batch 7's *"a `Closes when` can name a wrong predicate"*, avoided only by
running the control. **Three forms were then measured to work under bash 3.2, each with a V=1/V=9
discrimination pair** (`1`/`0` in all three): a **backtick** substitution around the same `case`; a
brace-grouped `test` chain; and an `if … then … else … fi` inside `$( )`. ⇒ the clause names the
**property** — *parses and discriminates under bash 3.2* — with those three as measured witnesses,
⛔ not one mandated form.

⚠⚠ **The second-order finding, and it is the one that matters most.** Two earlier unit records quote
`SELFTEST TOTAL: 33/33 ok, 0 failed` as a gate witness. **Both were TRUE where they ran** — those
batches ran under a bash ≥ 4 (the plan's own §4 step 3 describes launching sweeps via `bash.exe`) —
and **this run's 32/33 is TRUE here.** ⇒ ⛔ **the mandated `SELFTEST=1` gate step returns a DIFFERENT
VERDICT on different machines, and neither the harness, the playbook, nor any record says so.** A
reader on macOS reproducing a quoted `33/33` gets `32/33` and would read a **regression** that is not
one; a reader on Linux/Windows would call this batch's red **unreproducible**. That is worse than a
plain red, and it is the same class as the two cross-OS gate landmines already on record.

**Lead disposition — recommended to the PO, ⛔ not decided here.** It does **not** block Batch 9:
the batch owes **no sweep** (deriver rc 3, `CASELIST` 0 bytes, empty pathspec), the failing row is a
**type check on a bit**, and the set-ness **semantics** it sits beside are proven **green in the same
run** — rows A (`CASES` unset ⇒ full), C (`CASES=""` explicit ⇒ selects nothing, *"⭐ THE FIX"*) and
E1/E2/E3 (`count_sel` 3 / 1 / 0) all `ok`, 32 of 33. ⛔ But it **must be filed**, and it **blocks
Batch 10**, which runs a real door sweep on a migration from this machine.
