# ADMIN-ARM-IS-ACTIVE — progress record

The admin arm made to follow the subject's state: pre-AE5 remediation **Batch 10**. The unit's
**summary** is its hub, [docs/features/admin-arm-is-active.md](../features/admin-arm-is-active.md)
§ Current state; this file is its **log** (ADR 0186 D3): one dated subsection per session, appended.

Subjects: `app.is_admin()`, `app.is_admin_for(uuid)` and `public.assume_role(...)` as they exist in
the **live catalog** (never the migration text — ADR 0078); `app.can_manage_professional`'s first
arm and `app.can_manage_case_vocabulary` (the R4 relocation); `app.active_role_selections` and the
`active_role.assumed` audit row (R10); `docs/backend-state/authorization-and-audit.md` (the seam
that owns every one of them — a slice APPENDED there and its `## Current state` block REPLACED at
the Record step); `supabase/migrations/` and `supabase/tests/`.
Decisions this unit BUILDS, never re-takes: ADR [0201](../decisions/0201-the-keying-asymmetry-is-the-model.md)
D4 (three `is_active` sites, R3 + R12) and D5 (the Class-2 arm, R4), ADR
[0203](../decisions/0203-the-seam-is-already-encoded-the-classification-columns-are-not.md), and
the R10 audit-stamp ruling — all recorded in
[docs/progress/ae5-opening-adr.md](ae5-opening-adr.md) § Session log (entries dated 2026-09-09/10).
⛔ The scope derives from those three sources, never from R3/R4 alone (Batch 9 BLOCK-2).

## Session log

### 2026-09-10 — unit opened; the review queue processed on THIS clone first (lead)

**Why now.** All nine batches of the plan are concluded and §3's remaining set is NONE; §6 names four
successors and hands the choice to the PO. The PO said *"continue batch 9"*, was shown the four
sized (Batch 10 · ADR 0202 · ADR 0204 · `AE5-MATRIX-ARM3-CELLS`) and chose **Batch 10**: a deactivated
or suspended `platform_admin` passing every admin arm in the tree is a **live** hole, not a latent
one, and it is the fix Batch 9 decided and deferred.

**Preconditions, measured rather than assumed** (plan §6 step 1): `git status` porcelain empty on
`main` @ `b87eac1e`; `git rev-list --count origin/main..main` = **0** after `git fetch` (Batch 9 was
pushed on a fourth one-push override; ⛔ that override is spent and *"do not push"* is the standing
instruction again); `docs/features/INDEX.md` shows `in progress 0 · gated 3 · planned 3`. Branch
`authz-admin-arm-is-active` cut off `main` **before** the hub was written (gate 13 resolves an
`in_progress` hub's `branch:` against local branches).

**Migration head pair at open:** `(20261003007380, 527)` — keyed on the pair, never "head N".

**ADR number.** None reserved: this unit builds ADR 0201 D4/D5 and the R10 ruling; it takes no new
decision. ⚠ If a re-ruling of an expected red turns out to *change a stated meaning*, that is an
amendment to 0201, dated in place — not a new number. ⛔ 0202 and 0204 stay reserved; 0205 is taken;
the next free number is re-measured at the moment of reserving.

**The CLAUDE.md review queue — processed on this clone before the unit opened** (lead-playbook §4
step 7; plan §6 item 4). ⭐ **The queue is gitignored, so it is PER-CLONE**: Batch 9's record says
*"queue cleared to empty"* (five entries, 1,433 B) — that was the other clone. This one held
**12 entries, 13,875 B**, dated 2026-09-05 → 09-09. Both figures the plan argued about were true, of
different clones; plan §6 corrected in two places (operational instruction ⇒ EDITED, superseded text
quoted). Four subagents read the transcripts by `grep` window, never whole. Dispositions:

| entry (session, date, signal) | what it was | class |
| --- | --- | --- |
| `9346f622` 09-05 · `da1d3285` 09-06 · `772cd8f6` 09-07 (byte-identical bullets) | ONE session resumed twice; the hook re-scanned its history on each stop. Bullets = its own earlier `/review-claude-md` run (fix B-1 verified live in CLAUDE.md §6), an open FUP quoted (`FUP-ONE-SUPABASE-PROJECT-SERVES-TEST-AND-PRODUCTION`, still correctly open), two FUPs since archived (`…HALF-AIMED` 09-08, `…HARNESS-TRANSACTIONAL` 09-04), and an in-flight scoping call | not a doc problem |
| `ec9c5880` 09-07 `claude-md` | the PO asked whether CLAUDE.md should tell the lead to delegate more; the session answered the floor had existed since 2026-08-24 (`4d08b8df`), the **mechanism** was missing, and proposed naming the sinks — then ended unanswered | **CLAUDE.md silent on the mechanism** ⇒ `docs/lead-playbook.md` §1 paragraph, **PO-approved 2026-09-10** (lead-only file; CLAUDE.md untouched) |
| `f14a06db` 09-07 `staleness` | Batch 3 recon: a findings file's header count stale vs its body; the DRYRUN banner literal `7` vs 13 keys — fixed in-unit (`p0-authz-writepath-audit.sh:1022-1029` now derives the count) | not a doc problem — already fixed |
| `834bddc0` 09-08 `claude-md` | a subagent reconciled every "gate N" citation against the chain and found **zero** disagreement; re-verified today at **17 gates** (14–17 appended by Batches 7–9): gates 7, 9, 12, 13, 16, 17 all cite correctly | not a doc problem |
| `5f55cb11` 09-08 `staleness` | Batch 7's own recon: no `lint:*` gate asserted a privilege count — the gap it then closed (`lint:budget-anchor`, gate 15) | not a doc problem — LEARN-091/092/093 |
| `fcdc27a3` 09-09 `staleness` | "stale" inside a quote of **another repo's** docs (`scheduler_platform`), research input for ADR 0196 | keyword false positive |
| `cd3a414d` 09-09 `staleness` | ADR 0197's initiating prompt citing prose rot as the reason to generate the registries; the session caught two wrong figures IN that prompt (533 vs 473; 15 vs 18), recorded in 0197 § Context | not a doc problem |
| `b3e8da7d` 09-09 `staleness` | ADR 0198's initiating prompt citing a measured count of `STALE`/`SUPERSEDED` markers; CLAUDE.md §7's backend-state paragraph re-verified line by line against the tree (router present, gate 16 = `lint:backend-state`, `--scaffold` exists) | not a doc problem |
| `4842764c` 09-09 · `86d6eb13` 09-09 (resume) `staleness` + `claude-md` | Batch 8: *"stale-**token** window"* — a JWT term; the tightening IS declared (ADR 0200 § Consequences R3, record, QA review). The `claude-md` hit = QA confirming CLAUDE.md was **not** touched; its MINOR (AFTER assertions never proven to fire) closed the same day with five plants | not a doc problem |

**One recurrence flagged, no edit proposed:** *"declare a TIGHTENING explicitly, never fold it into
a no-regression claim"* appears in at least six reviews and is formalized in no agent checklist. It
is relevant to **this** unit — gating three admin sites is a tightening by construction — so the
builder declares it in the migration header and the record, and the reviewer checks for it.

**What this unit does NOT do.** It takes no decision Batch 9 took; it does not write ADR 0202 or
0204; it does not open AE5 (post-pilot by ADR 0155 G1); it does not push.

### 2026-09-10 — backend plan received; PO rulings R1–R3; two lead decisions (lead)

**The plan** (`backend`, Opus, plan-only turn; the stack was DOWN at `(20261003007360, 525)`, started
and fresh-reset to `(20261003007380, 527)`) is in the session scratchpad `batch10-backend-plan.md`
(800 lines) — its measurements are re-stated in this record only where a ruling rests on them.

**Measured, with a discriminating control:** `app.is_admin()`, `app.is_admin_for(uuid)` and
`public.assume_role` all lack `app.is_active(` comment-stripped, while `app.is_org_admin_of_for` **has**
it (the control that proves the query can see the term). Blast radius as sets: **26 policies + 13
functions** read `is_admin()`, **0 + 5** read `is_admin_for`; 0 triggers; 0 readers outside the four
schemas — the Batch 9 figures reproduce. The Class-2 closure: **14 `public` doors** (all `prosecdef`,
EXECUTE to `authenticated`), **12 behaviourally affected**, ⭐ plus **2 RLS policies** ADR 0201's door
table does not list (both in the unaffected half). `active_role_selections` has **no scope column**
(D2 reason 1 confirmed).

**Four findings the plan surfaced, none in any ruling:**
1. ⭐⭐ **A fifth red file:** `257_ethics_e2_retention.sql` — four `redact_professional_profile` cells
   under the `platform_admin` hat (`:132 :141 :174 :209`) reach `HC0J7`/`HC000`/`lives_ok` only
   through the arm D5 removes, so they red *as if the retention bar had broken*. Derived from the
   candidate set (13 files) read cell by cell, closed over **both** hat-seating syntaxes (`claims_for`
   and raw `set_config` — the second intersection is empty). ⚠ The builder's **first** filter was wrong
   (`claims_for\([^)]*,\s*true` cannot span `(select admin from k)`) and silently dropped the four files
   the rulings name — LEARN-098's shape, recorded in the plan.
2. ⭐⭐ **A TS mirror:** `src/lib/queries/session.ts:270` mirrors `is_admin()`'s two conjuncts, and its
   own comment says `src/lib/{admin,users}/actions.ts` run on the service-role client with no RLS
   backstop — the SQL fix alone would *read* complete.
3. `315:246-249` is an **eighth** re-ruling ADR 0201's table calls unchanged: green, dead reason.
4. ADR 0201 D5's position numerals **115/342 do not reproduce** (measured 111/338, strip expression
   quoted); ordering unaffected. Also: `app.is_admin()` carries a **PUBLIC EXECUTE** ACL entry its two
   siblings lack (unreachable — no PUBLIC schema USAGE).

**PO rulings (AskUserQuestion, plan file in front of the PO):**
- **R1 — `assume_role` gate is DOOR-WIDE (variant A), a DECLARED WIDENING of R12.** R12's words gate
  the seating door reasoning about the admin hat; (A) puts one `is_active` check before **any** seating.
  Measured cost: zero expected reds (no test seats a deactivated principal); every tenant predicate
  already carries `is_active`, so (A) removes a pointless seating and its audit row, never an ability.
  Recorded in ADR 0201 D4 as a dated note at the docs pass. The hat-blind allowlist reason for
  `assume_role` **survives** on re-derivation (account state is not a hat/grant read) and gets a dated
  appended paragraph, never inherited silently.
- **R2 — the DERIVED red set and the proposed texts are approved as written**: nine assertions across
  five files (`228 · 409 · 415 · 229`→2 · `257`×4) plus two green-but-dead-reason rewrites (`315:212`,
  `315:246-249`). Every one gets a message saying what it now proves; every old property is re-homed
  (a `lives_ok` twin under org authority beside `228`'s negative twin; `257` re-actored onto `oa_b` with
  one authority cell per pair; `229` and `257` split freeze/retention from authority). Hub box reworded.
- **R3 — the TS mirror is IN SCOPE**: `session.ts:270` gains the same `is_active` term, keyed the same
  way, with a Vitest cell RED first; the diff touches `src/` by ruling and the hub's gate line names
  the two files exactly.

**Lead decisions (not PO):** **L1** ADR 0201 D5's numerals get a dated note beside them (a record of a
measurement is annotated, never edited); **L2** the PUBLIC EXECUTE entry is a follow-up filed at the
Record step, out of Batch 10's scope. **L3** the declared-tightening sentence goes in the migration
header, this record, and the QA brief — the recurrence the queue processing flagged, applied here.

### 2026-09-10 — the BUILD: the migration, pgTAP 418 RED-first, the eleven re-rulings, the TS mirror (backend)

**Preconditions, measured.** Fresh `supabase db reset --local` rc 0 at head pair
`(20261003007380, 527)` — the pair read from `supabase_migrations.schema_migrations`, never
assumed from the hub. ⚠ **The suite baseline named in the spawn prompt was stale**: it said
264 files / 8923 tests; re-measured on that pre-migration reset it is **Files=266,
Tests=8982**. Every delta below is against the re-measured figure.

**A · RED FIRST, MEASURED.** `supabase/tests/418_admin_arm_is_active.sql`, `plan(30)`, run
against the PRE-migration catalog: **13 of 30 red, 17 green**.

| red at head | cells |
| --- | --- |
| site 1 `app.is_admin()` | `1.2` deactivated · `1.3` suspended |
| site 2 `app.is_admin_for(uuid)` | `2.2` subject deactivated · `2.3` subject suspended · `2.4` the SELF arm |
| site 3 `public.assume_role` | `3.1` deactivated · `3.2` suspended · `3.4` no seating · `3.5` no audit row · `3.8` the tenant tier (R1's declared widening) |
| the Class-2 arm | `4.1` `redact_professional_profile` · `4.6` `create_professional_profile` · `4.7` `create_external_participant` |

Green before **and** after — the controls, without which the 13 prove nothing: `0.1-0.4`
preconditions · `1.1` `2.1` `3.3` `3.9` `4.2` discrimination twins · `3.6` `3.7` the
"instrument is alive" pair for `3.4`/`3.5` · `1.4` the D11 hat conjunct survives · `4.0` the
actor re-asserted ACTIVE at §4 entry · `4.3` `4.4` `4.5` the reachability premise asserted
rather than claimed · `4.8` the vocabulary relocation. After the migration: **30/30**
(`Files=2, Tests=31` with `00_setup`), matching the file's `RUN SHAPE` line.

⛔ **A fixture trap, caught only because an expected-GREEN cell went red.** `1.4` ("a hatless
admin is denied") first used `test_helpers.claims_for(admin, true)`, on the plan's stated
reasoning that an omitted `p_active_role` leaves the caller hatless. It does not:
`00_setup.sql:418-431` unions `'platform_admin' where p_is_admin` with the live memberships and
MINTS that hat when the union has exactly one member — and `admin` holds no membership, so the
union is exactly `{platform_admin}`. The "hatless" fixture arrived **wearing the hat**, and the
cell went red for a FIXTURE reason while reading like a predicate one. The claims are now
hand-minted and the file records why. ⚠ It was visible only because the cell's declared
polarity was *green before and after*; a cell whose expected polarity is *red* would have been
indistinguishable from a correct one.

**A · the TS mirror's red, measured the same way.** `deriveIsAdmin` was extracted from
`getSessionContext` first, wired in carrying the TWO conjuncts production had, and
`session-is-admin-mirror.test.ts` run against it: rows **2 (deactivated), 3 (suspended), 5
(missing profile)** failed, the other 8 passed. With the third conjunct: 11/11.

**B · the migration.** `supabase/migrations/20261003007390_admin_arm_follows_account_state.sql`
— ONE file, five full `create or replace` bodies (never `replace()` on text). Head pair after a
fresh reset: `(20261003007390, 528)`. The **declared tightening** sentence is in the header
verbatim, and here it is again, quoted as lead decision L3 requires:

> **This migration TIGHTENS three gates. It is declared as a tightening and is not folded into
> a no-regression claim.** A `platform_admin` who is deactivated (`profiles.is_active = false`)
> or suspended (`suspended_until > now()`) stops passing `app.is_admin()`, `app.is_admin_for()`
> and the seating door `public.assume_role`. ⚠ **The `is_admin()` JWT-claim fast path is still
> there** — measured at this head: `app.is_admin()`'s body still reads
> `request.jwt.claims ->> 'is_admin'` and short-circuits on it. Batch 8 (ADR 0200) removed that
> fast path from the `can_manage_professional` **chain** only, by substituting
> `app.is_admin_for` (which has no claim path); it did not remove it from `is_admin()` itself.
> ⇒ after this migration the surviving stale-token window is the **admin FLAG alone**: a
> demoted admin can still present a stale `is_admin` claim, but `app.is_active(auth.uid())`
> always reads `public.profiles`, so **deactivation and suspension take effect immediately,
> without waiting for token expiry** — and `app.active_role()` being a bare claim read is why
> that mattered (a deactivated admin could otherwise mint a fresh hat). A second declared
> consequence: `audit_log.actor_is_admin`, stamped by `app.audit_write` from `is_admin()`,
> becomes `false` for a deactivated admin-flagged actor.

`npm run gen:types` **run**, and the measurement is the claim:
`git diff -- src/lib/types/database.ts` = **0 lines**. No signature, `prosecdef`, `proconfig`,
volatility, owner or ACL changed.

**B · the plants — 20 needles, each PROVEN to fire.** Method: apply the migration; then per
needle open a transaction, mutate the LIVE body via `pg_get_functiondef` + `replace` + `execute`
(each plant asserts it APPLIED — *a mutation that did not fully apply reports green*), run the
migration's OWN AFTER block extracted verbatim by `awk` (⛔ never a hand-written copy of it),
and roll back. Bracketed by an un-planted control before (`P00`) and after (`P21`) — *a
mutation harness proves its rollback first*.

| plants | needle proven |
| --- | --- |
| P01 P02 | site 1: `app.is_active(auth.uid())` present · the D11 hat conjunct preserved |
| P03 P04 | site 2: `app.is_active(p_user_id)` present · the D11 caller-only clause preserved |
| P05 P06 P07 | site 3: `app.is_active(v_uid)` present · `session_selectable` · the `(session_id)` upsert |
| P08 P09 | the audit row still written · the `audit_write` call isolable |
| P10 P11 P12 | R10: `v_commission` · `v_org` · `v_hospital` each absent from the CALL |
| P13 P14 | R10: `null::uuid` present in the call · the scope variables NOT renamed |
| P15 P16 P17 | site 4: the Class-2 arm absent · the org arm preserved · the deny-on-null guard preserved |
| P18 P19 P20 | site 5: the relocated arm present · both existing arms preserved |

⛔ **Two assertion defects the plants found, both fixed structurally.**

1. **A false positive that aborted the migration for real.** An explanatory comment inside
   `app.can_manage_professional` QUOTED the `(`-terminated needle that the same body's landing
   assertion requires to be ABSENT. `pg_get_functiondef` returns comments, so the migration
   raised while the arm was correctly gone.
2. **A false NEGATIVE — the only one of twenty plants that did not fire.** `P17` planted away
   `select p_uid is not null and`, and the "deny-on-null guard is PRESENT" check stayed silent,
   because the body's own comment (`⛔ THE "p_uid is not null" GUARD IS KEPT DELIBERATELY`)
   answered for the deleted code. The assertion was **vacuous**, and nothing short of a plant
   could have shown it.

⇒ **Both landing blocks now match against a COMMENT-STRIPPED body**, using the same strip
expression the unit's measurements use. A comment is prose; only the body is the body. Re-run
after the fix on a fresh reset: **20/20 fire, and the bracket is clean.**

⛔ **One plan needle corrected at build time, because it was UNSATISFIABLE.** Plan §7 asks for
"`v_org, v_hospital` **absent**" from the `assume_role` body. That substring lives inside
`select … into v_org, v_hospital, v_commission`, which R10 explicitly KEEPS (`v_holds` is
derived from those variables) — so the check as written fails the migration for the wrong
reason, while the opposite polarity would be answered by the select-into and prove nothing
about the stamp. R10 is therefore asserted on the **isolated `app.audit_write(…)` call**, plus a
separate assertion that the variables were not renamed (else the call-scoped checks pass for the
wrong reason). Plants P10–P14 are what make that split honest.

⛔ **One reordering.** "assume_role no longer writes an audit row" now runs BEFORE the
call-isolation guard. Written after it, it was **unreachable**: a body with no `app.audit_write(`
makes the substring NULL, so the isolation guard fires first and the preservation raise could
never be planted. *An earlier guard firing leaves the later one untested.*

**C · the eleven re-rulings — and the red set was MEASURED, not inherited.** Full suite at
`(20261003007390, 528)` before any re-ruling: **8 files, 14 assertions red**, against the plan's
derived 5 files / 9 assertions. Three corrections came out of that:

- **`257` reds SIX, not four.** `:132 :141 :174` red as predicted; three DOWNSTREAM cells red
  with them (the redaction never runs, so the identity / link-state / audit assertions fail).
  ⭐ **`:209` (flag-OFF) does NOT red** — `app.assert_ethics_enabled()` raises `HC000` BEFORE the
  authority check. It is re-actored onto `oa_b` anyway, because its stated RATIONALE ("asking as
  org authority makes the assertion depend on the flag alone") went false; and it deliberately
  gets **no** authority twin, because a hatted admin there gets `HC000`, so such a twin would
  assert ORDERING while wearing an authority label. ⇒ `257` is **+3**, not the plan's +4, and the
  omission is named in the file rather than silently skipped.
- **`315` is +2, not the plan's "+3 discrimination twins"** — the org-tier twin REPLACES the old
  `:209-212` cell (a rewrite), it is not an addition. `plan(26) → plan(28)`, with the arithmetic
  recorded beside `plan()`.
- **`315`'s org-tier actor is `sa_x`, not `oa_b`** — `:69-70` makes `sa_x` genuinely multi-role
  by granting him `org_admin@org_b`, and he is who assumes the org hat there. The plan proposed
  `oa_b` and flagged it for build-time verification; this is that verification.
- `oa_b` **is** `org_admin` of `app.org_of_commission(comm_x)` in bootstrap (verified: exactly 1
  membership row), so `228` and `257` needed no added membership — only the key in their `k`.

Landed: `228:630` (flip + a NEW re-homed `org_admin` `lives_ok`, `plan 144 → 145`) ·
`409 §3.7` (polarity **and** message, surviving clause preserved verbatim) · `415 §1.2` (+ its
§1 header dated correction) · `229:215` split into `1a` freeze (`sa_y`) / `1b` authority
(`plan 87 → 88`) · `257` ×4 re-actored + 3 authority twins (`plan 19 → 22`) · `315` ×4 re-ruled
+ 2 twins. After: **all six files pass.**

**⛔ C · BLOCKING FINDING — two files no ruling names, deliberately left RED.**
`401_ae4_authz_catalog.sql` §19.2b (`have 3, want 2`) and §19.2c (`have 2, want 1`), and
`403_ae45_differential_oracle.sql` §2.3b (`have 2, want 1`). Plan §6 asserted *"`401` and `410`
are NOT expected reds — re-verified here"*; **that is refuted by measurement**, and `403` was
never considered at all.

**Mechanism, measured.** Before D5, `app.can_manage_case_vocabulary` and
`app.can_manage_external_participant` had **identical comment-stripped bodies**
(`can_manage_professional(p_org,p_uid) or is_org_commission_staff_admin(p_org,p_uid)`). D5's
relocation adds `app.is_admin_for(p_uid)` to the vocabulary gate **only**, so the two diverge.
`403 §2.3b`'s whole claim is that they still agree, because `org.participants.external.manage`
(row 31) **has no representative of its own** and is covered by the AE4.5/AE4.9 differential
sweep *only* through that body identity. ⇒ **row 31 silently loses its differential coverage** —
precisely the regression `401 §19.2b` and `403 §2.3b` were written to catch. Both say in terms:
*"Do not 'fix' a red here by raising the count … a 2 means row 31 needs its own rep."* So they
were not re-coded.

Options for the PO, sized but not chosen: **(a)** give `org.participants.external.manage` its
own representative in `403`'s `authz_differential_cells` and re-rule `401 §19.2b/c` to the new
three-body reality — a substantive extension of the AE5 differential model, beyond Batch 10's
ruled scope; **(b)** put the relocated arm on `can_manage_external_participant` too, restoring
body identity — ⛔ this CONTRADICTS D5, whose declared loss list includes external-participant
minting (pinned by `418 §4.7`), and would let a `platform_admin` mint participants in any
tenant's org. (a) is the option consistent with the decisions already taken.

**D · the TS mirror.** `git diff --name-only main... -- src` names **exactly**
`src/lib/queries/session.ts` and `src/lib/queries/session-is-admin-mirror.test.ts`. The
derivation was EXTRACTED (`deriveIsAdmin`) rather than left inline — inlined it sat inside a
`cache()`-wrapped async function that awaits a client and issues an RPC, so the only testable
form was a hand-written copy in the spec, and *a harness holding a hand-written copy of
production text agrees with itself forever*. Two deliberate divergences, both documented at the
function: it is **not** `deriveUserStatus`/`isInactive` (which folds `email_confirmed_at` in on
purpose — `src/lib/users/types.ts` says at length that the two are DESIGNED to disagree), and it
**fails closed** on a missing profile where `status` deliberately fails open. The computation
MOVED below the `session_context()` read, because its third conjunct arrives with that RPC's
`profile` block.

**E · the hat-blind allowlist.** `supabase/tests/mutation/act-hat-blind-allowlist.txt`'s
`public.assume_role` entry gains a **dated re-derivation paragraph**, argued against the NEW
body: (a) `app.is_active(v_uid)` reads account state — not grant data, and not the hat: the door
still consults no `active_role`; (b) R10 NULLs the audit row's scope columns but the row is
still written, asserted by `315`'s three new twins and `418 §3.7`, not assumed. ⇒ the entry
SURVIVES and the finding stays reasoned-allowlisted. ⛔ Leaving it inherited would have been the
"reasoned" half going stale in silence. `ARM=hat` is expected to still read
`4 finding(s), all reasoned-allowlisted` — **the lead verifies that at the tip; this build does
not assume it.**

**F · gates, each rc read BARE (no pipe).**

| gate | rc | witness |
| --- | --- | --- |
| `npm run lint` | **0** | all **17** gates reached: `eslint --max-warnings=0` · `css-vars` · `memberships-door` · `client-server-imports` · `vacuous` · `set-local` · `progress` · `rules` · `adr-index` · `mojibake` · `service-role-registry` · `authz-vectors` · `registers` · `config-schemas` · `budget-anchor` · `backend-state` · `data-access` |
| `npm run typecheck` | **0** | `tsc --noEmit` |
| `npm run test` | **0** | `Test Files 154 passed (154) · Tests 2091 passed (2091)` |
| `npm run gen:types` | **0** | diff **0 lines** — the measurement IS the claim |
| `npm run test:db` (fresh reset) | **1** | `Files=267, Tests=9019` · **only** `401:113-114` and `403:5` — the blocking finding above |

⚠ The FIRST `npm run lint` was rc **1**, at gate 17 `lint:data-access`: `generated-query-modules.md`
was stale after the new export. Fixed by `npm run data-access:surface` (915 → 916 exported
symbols), ⛔ never by hand-editing a generated file — that is the drift the gate detects. An
`&&` chain stops at the first red, so the gates after it had not run on that first pass; the
rc 0 above is a full pass over all 17.

**Suite delta**, against the re-measured baseline `Files=266, Tests=8982`: **+1 file / +37
tests** = 30 (`418`) + 1 (`228`) + 1 (`229`) + 3 (`257`) + 2 (`315`). The parts sum; the figure
was checked against the run, never the run reconciled to the figure.

⛔ **NOT RUN HERE, by instruction:** the four authz arms (`census`, `hat`, `floor`,
`FROMFINDINGS=1 wrapper`), `SELFTEST=1` on the deriver and the door harness, and the diff-scoped
door sweep over both arms. Someone other than the builder runs those at the tip. The migration
declares `door-sweep-targets: app.is_admin(), app.is_admin_for(uuid),
public.assume_role(platform_role), app.can_manage_professional(uuid, uuid),
app.can_manage_case_vocabulary(uuid, uuid)` — ⚠ the deriver's **stderr must be read for
`door-sweep-targets: PARSE ERROR(S)`** beside the bare exit code, which the code alone cannot
show.

**Not edited, deliberately, and reported instead.** `app.can_create_professional`'s comment
`-- PRESERVED ARM — org authority (platform_admin via is_admin(), org_admin)` goes stale with
site 4: the platform reach it names is gone. It is a COMMENT, not an arm (the regex that finds
`is_admin(` there matches inside the comment — text is not truth), the body's behaviour is
unaffected, and the migration header names it. A follow-up body is drafted in the session
scratchpad `batch10-fups.md`, beside `app.is_admin()`'s PUBLIC EXECUTE entry (lead decision L2),
rather than a sixth body being rewritten inside a migration whose scope was ruled at five.

**Dead ends, so the next session does not repeat them.** (1) `--file` is not a `supabase test db`
flag; single-file runs are positional, and they need `00_setup.sql` passed alongside or
`test_helpers` does not exist after a reset. (2) `psql` is not on PATH on this machine — every
catalog read went through `docker exec supabase_db_… psql`, and `-f` needs `MSYS_NO_PATHCONV=1`
or Git Bash rewrites the container path into a host path. (3) `supabase db reset` restarts the
containers, so files `docker cp`-ed to `/tmp` for the plant harness must be re-copied after
every reset.

**Commits on `authz-admin-arm-is-active`** (none amended, none pushed): `f2a0da8b` 418 RED-first ·
`a0002067` the migration · `3b54bf11` the eleven re-rulings · `fa68436c` the TS mirror ·
`ebb5ddd0` the allowlist re-derivation · `95b178ca` the regenerated query-module surface.

### 2026-09-10 — build reported; the blocking red ruled (R4) and two deviations accepted (R5) (lead)

**The builder's report, in its own numbers:** pgTAP `418` **13 of 30 red** at `(20261003007380, 527)`,
**30/30 green** after the migration (17 controls green on both sides); Vitest mirror **3 of 11 red**
before, 11/11 after; **20 landing needles** each proven on a planted body — and the plants found
**two assertion defects in the plan's own design** (a comment quoting a `(`-terminated needle aborted
the migration; the `p_uid is not null` check did not fire when planted away because a comment answered
for it), both fixed by matching a **comment-stripped** body. Suite **266/8982 → 267/9019** (+1 file,
+37 = 30+1+1+3+2, parts sum); `lint` rc 0 with all 17 gates reached; `typecheck` 0; `test` 0;
`gen:types` diff 0 lines. ⛔ **`test:db` rc 1**: `401 §19.2b/c` and `403 §2.3b` red — the builder
STOPPED rather than edit a count, as both cells' messages demand. Detail: the builder's own entry above.

**The mechanism (measured, not the plan's claim):** before D5, `app.can_manage_case_vocabulary` and
`app.can_manage_external_participant` had identical comment-stripped bodies, and matrix row 31
(`org.participants.external.manage`) had **no representative of its own** — its differential coverage
rode on that body identity, which `403 §2.3b` asserts in words. D5 arms the vocabulary gate only, the
bodies diverge, and row 31 silently loses coverage: exactly the regression both cells exist to catch.
⛔ Plan §6 said *"`401` is NOT an expected red — re-verified"*; refuted by measurement, and `403` was
never considered. ⭐ A red the plan ruled out is the one worth the most — the plan's re-verification
had looked at the manifest rows, not at what shares a body.

**PO ruling R4 — option (a): row 31 gets its OWN representative** in `403`'s differential cells; then
`401 §19.2b` (→ 3), `§19.2c` (naming the new partition) and `403 §2.3b` are re-ruled as a
**consequence** of that representative existing, each message saying what it now proves — never
re-coded to a number that matches. Option (b), arming `can_manage_external_participant` too, was
rejected: it contradicts ADR 0201 D5's declared loss list, pinned RED-first by `418 §4.7`, and would
let a `platform_admin` mint participants in any tenant's organization.

**PO ruling R5 — two measured deviations from R2's texts ACCEPTED:** `257` is +3 not +4 (`:209`'s
feature-flag guard precedes authority, so an authority twin there would assert guard **ordering** under
an authority label); `315` is +2 not +3 (the org-authority twin **replaces** `:209-212`).
