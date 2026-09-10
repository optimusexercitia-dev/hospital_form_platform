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
