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

### 2026-09-10 — R4 built: row 31's own differential representative, the three re-rulings, the rep proven LIVE (backend)

**Scope: R4 and nothing else.** No migration, no `src/`, no ADR. `git status --porcelain` names exactly
four files: `scripts/gen-authz-differential-cells.py`,
`supabase/tests/vectors/authz_differential_cells.psql` (generated),
`supabase/tests/401_ae4_authz_catalog.sql`, `supabase/tests/403_ae45_differential_oracle.sql`.
Head pair unchanged at `(20261003007390, 528)`, read from `supabase_migrations.schema_migrations`.

**A · the blocking red RE-MEASURED at this head before anything was touched** (never inherited from
the build entry): `401` test **113** `19.2b` *have 3, want 2* · `401` test **114** `19.2c` *have 2,
want 1* · `403` test **5** `2.3b` *have 2, want 1*. `Files=3, Tests=145, Failed 3` — the same three,
so the finding reproduces on a catalog nobody re-derived it from.

**B · the representative, added through the GENERATOR'S INPUT.** `scripts/gen-authz-differential-cells.py:102`
— a fifth `REPS` entry `('org.participants.external.manage', 'can_manage_external_participant',
'organization')`, carrying the same reasoning shape the AE4.9 fourth rep carries directly above it.
⛔ The `.psql` was never hand-edited: it is regenerated, and gate 12's `--check` is what proves the
two agree. Measured against the catalog before the rep was written, so the choice rests on facts and
not on the generator's prose: `authz.permissions` gives `org.participants.external.manage` →
`resolution_scope_kind = organization`, `resource_kind = identity`; `authz.role_permissions` shows
`staff_admin` **holds** it (⭐ the single-polarity trap AE4.7c hit is a rep on a code the subject role
does NOT hold — checked, not assumed); the three org gates' comment-stripped bodies are pairwise
distinct (`md5` `f17a0c42` / `f63b7b72` / `3a86b023`), so `19.2b`'s 3 is a measurement.

⚠ **The generated file's `sourceSha256` DID NOT MOVE**, and that is worth stating: it is the sha of
the **axes JSON**, which this change does not touch. A drift check keyed on that stamp alone would
have seen nothing. Gate 12 compares the whole emitted text, which is why it does.

**Cells: 864 → 1080** (5 reps × 216), 1920 skipped by named rule, census sums (the generator asserts
it). The new rep contributes **216 cells, 30 granted / 186 denied** — both polarities, which is the
half `2.3b` now asserts.

**C · the three re-rulings, each saying what it now proves and WHY the count moved.**

| assertion | was | is | what moved |
| --- | --- | --- | --- |
| `401:1319` `19.2b` | `= 2` distinct bodies over the three org gates | **`= 3`** | ⭐ **the count moved because a REPRESENTATIVE now exists, not because a body diverged.** The divergence is the CAUSE of the loss; the 3 records the REPAIR. Message carries both occurrences (AE4.9's re-key, then ADR 0201 D5) so the next reader sees a repeat, not an incident. |
| `401:1362` `19.2c` | `= 1` body over the 31/32 pair | **RE-PREDICATED** onto the gate → representative map, read from the differential vector (`\ir` at `401:1349`) | ⛔ **re-coding it to 2 would have made it VACUOUS**: with 19.2b at 3 over three functions, a pair-count of 2 is ENTAILED and could not fail on its own. It now names what no body count can express — that each body-class HAS a rep, which is the reach both regressions actually removed. |
| `403:217` `2.3b` | `= 1` body over the 31/32 pair | **RE-RULED** onto the rep's existence, wiring, scope and BOTH polarities | the identity it pinned is gone by design (D5's declared loss list, pinned RED-first by `418 §4.7`). `classes=1` forbids a rep straddling two classes; the fallback string is `(NO CELLS — row 31 has NO REPRESENTATIVE)`, so a deleted rep reds by NAME. |

Consequential, and named rather than folded in: **`403:191` `2.3` moved `4 → 5`** (it counts distinct
`legacy_class` in the cell set, so a fifth rep moves it mechanically) and **`403:368` gained the driver's
fifth dispatch branch**. ⛔ Without that branch the suite does not go quietly wrong — `pg_temp.unknown_legacy_class`
RAISES, because ADR 0176 D5 retired the `else` catch-all. The branch calls
`app.can_manage_external_participant` **directly**; substituting the sibling that agreed with it
yesterday would have reproduced the whole defect one layer down.

**D · the rep proven LIVE — a plant, bracketed, in a rolled-back transaction.** A rep that exists in a
vector is not yet a rep that reaches a door.

| run | result |
| --- | --- |
| **P00** control, real body | `403` **23/23 ok**, zero `not ok` — the baseline without which a red proves nothing |
| **P01** `app.can_manage_external_participant` planted BROKEN OPEN (`select true`), plant asserted APPLIED in both directions before the suite ran | exactly **one** red: **`4.1` LEGACY == CATALOG**, naming **186 disagreeing cells, ALL 186 `org.participants.external.manage`**, every one `legacy=true catalog=false` |
| rollback | body `md5` back to `3a86b023…`, `$plant$` absent — proven by reading the catalog after, not assumed |

⭐ **The 186 is the parts-sum check, not a vibe:** the generator measured the new rep at 30 granted /
**186 denied**, and breaking the door open flips exactly the denials. A number that matched nothing in
particular would have meant the red came from somewhere else.

**E · gates, each rc read BARE (no pipe).**

| gate | rc | witness |
| --- | --- | --- |
| `npm run lint` | **0** | all **17** gates reached; gate 12: `gen-authz-differential-cells: in sync (1080 cells, 1920 skipped, sha 2ddda77978bb)` + both `--self-test` discrimination controls (`clean on the real spec`) |
| `npm run typecheck` | **0** | `tsc --noEmit` |
| `npm run test` | **0** | `Test Files 154 passed (154) · Tests 2091 passed (2091)` |
| `npm run test:db` (fresh `supabase db reset --local` rc 0, head pair re-read `(20261003007390, 528)`) | **0** | `All tests successful. Files=267, Tests=9019` |

**Suite delta vs the builder's `267 / 9019`: ZERO tests, rc 1 → 0.** ⭐ That is the shape R4 asks for
and it is worth naming: three assertions were **re-ruled and re-predicated**, none added, and 216 new
**cells** are folded into `§§4-5`'s existing aggregates. A rep is not an assertion, so a differential
extension can be invisible in a test count — which is exactly why `403`'s RUN SHAPE line now says so
in words instead of leaving the absence to be read as an oversight.

**F · two stale figures corrected while re-deriving, and the correction is larger than the rep.**
`403`'s header limitation paragraphs read `108` third-party-cells-with-caller==principal and `26`
`wrong_active_context:third-party` cells. Re-measured against the vector **as it stood at HEAD before
this batch** (4 reps, 864 cells) they were already **144** and **36** — i.e. they were the THREE-rep
values and AE4.9 moved the reps without moving them. Now measured off the generated file at 5 reps:
**180** and **46**. Same discipline for the cell-count paragraph: `1080 / 432 distinct coordinates /
648 re-runs`, **re-derived, and the file records that scaling by 5/4 would have produced a plausible,
wrong 540**. The generated header's own class/rep counts are now `%d`-derived from `REPS`, because
they read "THREE" through AE4.9's fourth rep — a stale partition asserted in the very file that
carries the oracle's expected values.

**Not edited, reported instead.** `docs/design/authz-ae43-staff-admin-permission-matrix.md:1235` still
says the generator's `REPS` uses **`org.professionals.manage`** — stale since AE4.7c re-pointed it to
`org.professionals.create`, and now two reps further out of date. It is a design doc, not a gate, and
the docs pass is the lead's.

**Dead ends, so the next session does not repeat them.** (1) **pgTAP is not resident in the local DB** —
`supabase test db` creates and drops the extension around its run, so a raw-`psql` plant harness gets
`function plan(integer) does not exist` until it issues `create extension if not exists pgtap with
schema extensions` itself. (2) That extension statement belongs **inside the harness's own
transaction**: `\i`-ing `403` from an already-open transaction works because the suite's closing
`rollback` unwinds the OUTER transaction too — which is what makes the plant self-cleaning and is why
the plant needed no restore step. (3) `docker cp` the whole `supabase/tests` directory, not one file:
`403`'s `\ir vectors/…` resolves relative to the file being executed.

**Commit on `authz-admin-arm-is-active`** (not amended, not pushed): see the branch tip — one commit,
`test(admin-arm-is-active): row 31 gets its own differential representative (PO ruling R4)`.

### 2026-09-10 — GATE AT THE TIP `a74f2409`, run by the lead (not the builder), detached, every rc read bare (lead)

Driver: a detached Git-Bash process writing one `<step>.rc` + `<step>.log` per step (scratchpad
`tipgate-a74f2409/`); a Monitor on the driver log; ⛔ the tree FROZEN for the run — one docs edit made
mid-run (the AE4.3 design doc's `REPS` note) was **stashed before any DB step touched the tree** and
committed only after `DONE`. `git status --short` empty before and after. Shell: **GNU bash 5.2.37
(x86_64-pc-msys)** — quoted because the SELFTEST verdict is shell-dependent (Batch 9 R14).

| step | rc (bare) | witness |
| --- | --- | --- |
| `npm run lint` | **0** | 17 of 17 gates reached; eslint 0 errors / 0 warnings (the log's one "warning" match is gate 17's standing *"BOUND: this gate never opened a database"* note) |
| `npm run typecheck` | **0** | |
| `npm run test` | **0** | `Test Files 154 passed (154)` |
| `supabase db reset --local` (×2, before `test:db` and before the arms) | **0 · 0** | |
| `npm run test:db` | **0** | `Files=267, Tests=9019` · `Result: PASS` · `All tests successful.` — the builder's figure reproduces (baseline before this unit: 266 / 8982) |
| `ARM=census` | **0** | `gates carrying a verdict: 608` · `=== INVARIANT HOLDS ===` (608 = Batch 4's figure: this unit REPLACED bodies and added no gate) |
| `ARM=hat` | **0** | `HAT-BLIND SWEEP HOLDS: 4 finding(s), all reasoned-allowlisted` — `public.assume_role` among them, with the reason RE-DERIVED this unit (`ebb5ddd0`), not inherited |
| `ARM=floor` | **0** | `=== INVARIANT HOLDS ===` |
| `FROMFINDINGS=1 ARM=wrapper` | **0** | `=== INVARIANT HOLDS ===` |
| `SELFTEST=1 door-sweep-cases` | **0** | `SELF-TEST: PASS 46 · FAIL 0 · SKIPPED 0`; third group line `--- GROUP audit startup capture: scenarios 8 (pass 8 · fail 0 · skipped 0)` (the other two group lines are in `selftest.log`) |
| deriver `ARM=read main` | **0** | `=== RESULT: DERIVED (0) — 7 case(s). This is a SELECTION, not a verdict. ===` |
| deriver `ARM=write main` | **0** | same RESULT line; `read arm : 7 case(s)   write arm: 0 case(s)` — stdout **EMPTY** for the write arm |
| door sweep, READ arm, `CASES=<the 7>` | **0** | `SWEPT: 7 gate(s)   COVERED: 6   BLIND: 0   NOTICED: 1   ERROR(harness): 0` · `ARM-DOMAIN predicate=7/127 policy=0/226 out-of-domain-bool=35` · `=== RESULT: CLEAN WITH DISCLOSURE` · `preconditions: baseline GREEN at the LAST capture (shape=Files=267, Tests=9019) · resets=0 (RESET_EVERY=20 — SUPPRESSED: the DEFAULT never fires on a SUBSET run)` |
| door sweep, WRITE arm | **3** | `SELECTION-SOURCE: CASES set and EMPTY -> selects NOTHING (UNPROVEN, exit 3)` — ⛔ **read as "0 write cases BY DERIVATION"** (all seven are `returns boolean` predicates; Batch 8's precedent): *both arms* is discharged as a CHECKED claim, not a second sweep. ⚠ The driver substituted the write arm's empty stdout because the deriver's rc was 0 for both arms — the rc is per DERIVATION, not per arm; the exit-3 is the harness refusing the empty set, which is the designed loud stop (Batch 6) |
| set-valued targeted home | **0** | `ARM-DOMAIN setvalued=3/3 (in scope) out-of-scope=2 (named, with dispositions)` · `=== RESULT: CLEAN — 3 resolver(s) measured, all COVERED. ===` |
| findings files | — | `git diff --stat -- docs/reviews/authz-door-audit-findings.md docs/reviews/authz-writepath-audit-findings.md` **EMPTY** (subset runs write to scratch; the committed baselines were never opened) |

**The deriver's `SCOPE:` line, quoted verbatim (identical on both arms):**

```
SCOPE: 1 file(s) — 1 committed (main..HEAD), 0 worktree, 0 untracked | filter: none | derivation: catalog
```

**The seven read-arm cases, as derived:** `can_manage_case_vocabulary can_manage_professional
is_active is_admin is_admin_for is_org_admin_of_for is_org_commission_staff_admin`. Six COVERED. The
one **NOTICED is `app.is_active(p_user_id uuid)`** — `aborting file(s): 200_controlled_documents.sql`,
run-shape `Files=267 Tests=8992` ≠ baseline. ⛔ Disclosed, not a verdict (ADR 0191): it **reproduces
the committed baseline's own row** for the same gate (`docs/reviews/authz-door-audit-findings.md:481`,
same aborting file), and `200_controlled_documents.sql` is already on
`FUP-C2-TIER1-VALUE-ASSERTIONS-ABORT-ON-AN-INLINE-RAISE`'s work-list (its body, line 88) for exactly this
predicate. This unit did not change `is_active`'s body — the diff merely **names** it — so nothing here
is Batch 10's to fix; recorded so it is not re-found.

**Tier 2's 190 doors stay deferred by ADR 0171 and are NOT cleared.** (ADR 0187 D1, verbatim.)

⛔ **Two doors owe TARGETED cases and are NOT discharged by this run:** the deriver printed, under
*"DOORS IDENTIFIED, NOT SWEEPABLE BY THIS ARM — each owes a TARGETED case"*: `assume_role (prosecdef,
returns void — outside PRED_DOMAIN)` and `audit_write (prosecdef, returns void — outside PRED_DOMAIN)`.
`public.assume_role` already has a category-(b) backlog entry (`authz-unswept-backlog.txt` ~923) whose
keystones (`408 §§3-4`, `315`) were named for the `…007260` body — *"a standing verdict transfers silently
to a body it was never measured against"* — and this unit changed that body again (R1, R10).
⇒ `backend` builds CASE 2 (`assume_role`: the `is_active` gate neutralized → `418 §3` must notice; the
scope triple restored into the audit call → the rewritten `315` must notice) and CASE 3 (`audit_write`:
the CALL changed, the door did not — proven from the migration and `pg_get_functiondef`; the call
deleted → `315`'s role+actor assertion must notice) in `authz-command-door-targeted-cases.sh`, and
appends a dated paragraph to the backlog entry. Brief: scratchpad `batch10-targeted-brief.md`.

### 2026-09-10 — the two TARGETED cases the deriver demanded, built and MEASURED (backend)

The discharge for the two doors the tip gate printed under *"DOORS IDENTIFIED, NOT SWEEPABLE BY THIS
ARM — each owes a TARGETED case"*. Both landed in the existing home
`supabase/tests/mutation/authz-command-door-targeted-cases.sh` (CASE 1's shape copied: `SUBJ=` token,
the mutation applied to the **LIVE body** inside a mutate/restore bracket, the pgTAP file(s) named that
must NOTICE, a discrimination half, the restore proven against the catalog). ⛔ Neither door was
hand-added to `CASES=` (ADR 0079 hazard 4). No pgTAP file was added or edited.

**CASE 2 — `public.assume_role(platform_role)`.** Subject fingerprint before/after every bracket:
`c721f45a459cc73c1e3c0db97f00ff8f`. Anchor uniqueness measured on the live body first (each anchor
occurs exactly once; `is_active` occurs exactly **once in the whole definition**, so the post-mutation
`!~ 'is_active'` check is a claim about the CALL and not a `prosrc` regex a comment could satisfy).

| half | mutation (live body) | fingerprint | pgTAP that NOTICED | discrimination |
| --- | --- | --- | --- | --- |
| 2a | `if not app.is_active(v_uid) then` → `if false then` (R1's door-wide gate) | `5e7ef84e…` | **418 RED on exactly 5 cells**: `418:248` 3.1 deactivated · `:265` 3.2 suspended · `:285` 3.4 no seating for the denied session · `:291` 3.5 no audit row for it · `:315` 3.8 the tenant-tier cell the widening owes | **408 GREEN** (`Result: PASS`, `Files=1, Tests=17`) — the sibling `session_selectable` gate in the same body still decides, so 2a removed ONE line rather than breaking the door. Without it, 3.1/3.2/3.8 are equally satisfied by a door that refuses everyone |
| 2b | the pre-R10 scope triple put BACK: `v_session_id, null::uuid,` → `v_session_id, v_commission,` and `null::uuid, null::uuid` → `v_org, v_hospital` | `fecf257f…` | **315 RED on exactly 2 cells**: `315:218` org-tier NULL triple · `315:242` commission-tier NULL triple. ⚠ The platform tier is deliberately NOT pinned — it stamps NULL either way, so a pin there would be a cell that cannot move | **418 GREEN** (`Files=1, Tests=30`) — the cross-check: 2a reds 418 and leaves 408 green; 2b reds 315 and leaves 418 green, so 2b moved the STAMP and not the seating decision |

Restore proven twice against the catalog (`md5(pg_get_functiondef)` back to `c721f45a…` after each
half), and residue enumerated rather than inferred: the state gate, the `null::uuid` pair and
`perform app.audit_write(` are all back. 418 and 315 re-run GREEN after their restores.

**CASE 3 — `app.audit_write(text,text,uuid,uuid,text,jsonb,uuid,uuid)`: the CALL changed, the door did
not.** The ruling the case CARRIES (never written as a bare allowlist line): *`app.audit_write` is an
append-only audit SINK (Architecture Rule 11), not an authorization decision; the deriver lifted it out
of the diff by NAME because `assume_role`'s CALL to it changed (R10's three `null::uuid`); the CALL is
what CASE 3 mutates.* "The migration did not touch it" is itself an assertion, so it is measured twice:

- **proof 1** — `20261003007390_admin_arm_follows_account_state.sql` defines `app.audit_write`
  **0 time(s)** and *mentions* it **6 time(s)**. ⛔ The mention count is the discrimination half: a zero
  from a grep that can find nothing is not a finding.
- **proof 2** — the live `md5(pg_get_functiondef(...))` is **`3b069ecb1a1c51b340a127f7a7dcd105`**, PINNED
  in the case and re-checked after the mutation (unmoved). When a future migration moves that body the
  case ERRORs and the ruling must be re-taken against the new body — which is precisely the failure the
  backlog entry names in its own words.
- **the mutation** — `perform app.audit_write(...);` deleted from `assume_role`'s live body (replaced by
  the plpgsql no-op), caller fingerprint `2a458150…`, the seating upsert asserted still present so this
  is a targeted mutation and not a stub. **315 RED on exactly 8 cells**: `315:186` D8 "the switch itself
  is audited" · `:207` cardinality · `:218`/`:224` org tier · `:242`/`:248` commission tier ·
  `:274`/`:280` platform tier — the `:224`/`:248`/`:280` twins ("the row still carries role + actor")
  being exactly the ones a never-written row cannot satisfy. Discrimination: **408 GREEN**
  (`Files=1, Tests=17`) — deleting the SINK CALL moved no decision the door makes. Restore proven
  (`c721f45a…`), no plant residue.

**⭐ TWO BUILDER ERRORS, both caught by the case's own pins rather than by review — recorded because a
green on the first run would have hidden each.** (1) The expected red set for CASE 3 was DERIVED as 7 and
MEASURED as 8: the derivation omitted `315:186`, the D8 existence cell. The exact-count pin (`pin_failures`
asserts the failure set is *exactly* the pinned one, count first, then each description by TEXT) is what
turned that into a loud ERROR instead of a silent "the suite went red, good enough" — the QA N-REC-1
shape, generalized from CASE 1. (2) The first residue check for CASE 3 was `!~ 'null;'`, which **can never
pass**: the body already contains `v_holds := v_org is not null or … is not null;`. A check that cannot
succeed is as blind as one that cannot fail. Replaced by the exact plant signature
`chr(10) || '  null;' || chr(10)`, and the detector is now PROVEN able to fire — the mutated body is
asserted to CARRY that signature before the restored body is asserted not to.

**Harness changes beside the two cases** (all mechanical, CASE 1's behaviour byte-identical): `run_suite`
now delegates to `run_suite_log` so each of the seven suite runs gets its OWN log — with one shared path
the post-restore run overwrites the evidence the pin was computed from, and a witness quoted from a
clobbered file is a witness about the wrong run. Case counts stay DERIVED (`SELECTED`/`COVERED`
increments), never typed; nothing outside the file asserts a count (grep: the harness is referenced by no
script, gate or package.json entry).

**Witnesses — every rc read BARE, never through a pipe.**

| run | rc | RESULT line |
| --- | --- | --- |
| `CASES="public.assume_role" bash …/authz-command-door-targeted-cases.sh` | **0** | `=== RESULT: 1 of 1 case(s) COVERED. ===` · `CASE 2 VERDICT: COVERED` |
| `CASES="app.audit_write" bash …` (first run) | **1** | ⛔ the two builder errors above — `failure set is 8 assertion(s), not the 7 pinned` then `RESIDUE`. Restore had already been PROVEN before the stop, catalog re-checked at `c721f45a…` by hand |
| `CASES="app.audit_write" bash …` (after the fix) | **0** | `=== RESULT: 1 of 1 case(s) COVERED. ===` · `CASE 3 VERDICT: COVERED` |
| `unset CASES; bash …` (the whole home) | **0** | `=== RESULT: 3 of 3 case(s) COVERED. ===` — CASE 1 `COVERED` beside the two new ones, its pin still verified at `# Failed test 32` |
| `supabase db reset --local` | **0** | |
| `npm run test:db` | **0** | `Files=267, Tests=9019` · `Result: PASS` · `All tests successful.` — **unchanged**, and it must be: no pgTAP file was added or edited |
| `npm run lint` | **0** | 17 of 17 gates reached; the trailing gates' own `⚠ BOUND` notes are standing text, not warnings |

⚠ **Observed, NOT fixed (it is approved text and not this task's subject):** `418`'s header RUN SHAPE line
reads `Files=2, Tests=31` (30 + 00_setup.sql's one), but a single-file `npx supabase test db
supabase/tests/418_admin_arm_is_active.sql` measures `Files=1, Tests=30` — `00_setup.sql` is not counted
as a second file on this CLI (v2.115.0). The header's own warning ("a stale RUN SHAPE is read as the
expected shape by the next person diagnosing a count mismatch") is what makes this worth naming. For the
lead to rule.

⚠ `CASES=` semantics differ between this home and the deriver, and the header now says so: HERE an
empty/unset `CASES` selects EVERY case (`want` returns 0 on `-z`), whereas `scripts/door-sweep-cases.sh`
treats an empty `CASES` as the third state that selects NOTHING and exits 3. `unset CASES` is unambiguous
in both, and is what the full run above used.

**Commit on `authz-admin-arm-is-active`** (not amended, not pushed): one commit touching
`supabase/tests/mutation/authz-command-door-targeted-cases.sh`,
`supabase/tests/mutation/authz-unswept-backlog.txt` and this record.

### 2026-09-10 — E2E: `e2e/admin-arm-is-active.spec.ts` written, run, GREEN (tester)

**Fixture idiom reused, never invented.** `e2e/helpers/service-role.ts`'s `svcSelect`/`svcUpdate`
(the same REST-over-service-role idiom `ethics-e2-procedure.spec.ts`, `user-registration.spec.ts`
and `form-name-attribute-invariant.spec.ts` already use to read/mutate `profiles`), plus
`e2e/helpers/auth.ts`'s `loginFresh`/`accessToken` (the same raw-grant pattern
`act-role-assumption.spec.ts`'s D5 case and `case-patient.spec.ts`'s RPC-denial cases use). All
four tests that mutate `platform@test.local` (`00000000-0000-0000-0000-0000000000b0`) read the
row's original `is_active`/`suspended_until` FIRST, mutate inside `try`, restore in `finally` —
proven restored by re-reading the row via `curl` after the run: `{"is_active":true,
"suspended_until":null}`, matching the seeded baseline. `test.describe.configure({ mode: 'serial'
})` wraps the whole file (the same idiom ~10 other lifecycle-mutating spec files already use) so
no two of these tests race the same profile row across workers.

**Two of the brief's own framing claims were WRONG, measured before writing assertions on them
(CLAUDE.md: verify against the live app, never the plan's prose) — both corrected in the spec's
header comment, not silently worked around:**

1. **S1/S2 "open the role picker".** `platform@test.local` holds ZERO memberships (seed.sql) and
   is single-role-TYPE; `session.ts`'s `needsRoleSelection` is `activeRole === null &&
   distinctRoleTypes.size > 1` over `memberships ∪ grants`, a set the bare `is_admin` flag never
   joins — so this persona never sees `/selecionar-perfil` (self-guard bounces it, verified by
   reading `selecionar-perfil/page.tsx`) and never calls `assume_role` from any ordinary login
   path. **First draft asserted a `/conta-inativa` redirect on fresh login — RAN RED**
   (`page.waitForURL` timed out; the actual page snapshot showed the account stayed on `/login`
   with an inline banner). Root cause read from `src/lib/auth/actions.ts:165-185`: the sign-in
   Server Action itself reads `is_active`/`suspended_until` right after
   `signInWithPassword` succeeds and, for suspended/deactivated, calls `supabase.auth.signOut()`
   **before ever returning** — no session is ever established, and `MESSAGES.accountInactive`
   ("Sua conta está suspensa/desativada. Contate o administrador da sua organização.") renders
   inline on `/login`. `/conta-inativa` (`context.isInactive`, `src/app/page.tsx`) is the sibling
   gate for a session that WAS valid and went stale mid-session, re-checked on the next
   navigation — not what fires on a fresh login attempt. Fixed: S1/S2 now assert the actual
   observed mechanism (stay on `/login`, the inline banner, `getByRole('status')`), and separately
   exercise `public.assume_role` directly via a raw RPC call (`accessToken` + `request.post` to
   `rest/v1/rpc/assume_role`, `p_role: 'platform_admin'`) since no UI path reaches that door for
   this persona — asserting only the login banner would leave R1's own widening completely
   unproven (a UI-only pass, DB-door blind). Verified `platform_admin` is `session_selectable =
   true` in `authz.roles` (migration `20261003007110`) before relying on that RPC path reaching
   the `is_active` gate rather than the earlier `session_selectable` check.
2. **S3 "src/lib/admin/actions.ts or src/lib/users/actions.ts"`.** Grepped every `.tsx` under
   `src/app`/`src/components` importing each file: `src/lib/users/actions.ts` never checks
   `context.isAdmin` anywhere (its own header: "the platform_admin isAdmin short-circuit is
   DELIBERATELY ABSENT"); `src/lib/admin/actions.ts`'s `requireAdmin()`-gated `createCommission`
   has ZERO UI callers (confirmed further: `/admin/comissoes/**`, its own redirect target, does
   not exist as a route — `find src/app/admin` lists only `audit/`, `error.tsx`, `layout.tsx`,
   `loading.tsx`, `page.tsx`), and `updateCommission`/`assignStaffAdmin` are wired only into
   `/o/[org]/manage/comissoes/[commissionSlug]`, the org-admin surface a walled-off
   `platform_admin` cannot reach. The one action platform_admin ACTUALLY reaches, gated by the
   identical `requireAdmin()` → `context.isAdmin` predicate (same shape, `src/lib/platform/
   actions.ts:50-53`), is `createOrganization` — wired to `OrganizationCreateForm` on `/admin`
   itself. Used that instead; the file-path deviation is called out in the spec's own comment.

**S4 verified by looking, not trusted from the plan** (Batch 9 R6's claim, brief's own
instruction): grepped every `.tsx` for `createProfessionalProfile`/`updateProfessionalProfile`
(the `src/lib/participants/actions.ts` wrappers around `create_professional_profile`/
`update_professional_profile`) — exactly ONE caller, `src/components/cases/
add-participant-dialog.tsx`, mounted only inside commission/case-scoped pages under
`/o/[org]/c/[commission]/casos/**`. `platform@test.local` holds zero memberships anywhere
(architectural "noun rule"), so no navigation reaches a page that renders that dialog. Written as
`test.skip` with the measured reason in the spec body and header, confirming Batch 9 R6
independently rather than inheriting it.

**Run.** `npx playwright test e2e/admin-arm-is-active.spec.ts --project=chromium` (quick loop,
dev server via Playwright's own `webServer`, none pre-existing on :3000):

```
Running 4 tests using 1 worker
  4 tests: 1 skipped (S4), 3 passed (9.1s)
```

**Keyboard-only flow (CLAUDE.md §8):** S1's sign-in is driven entirely via
`pressSequentially`/`keyboard.press('Tab'|'Enter')`, tab order re-verified against
`act-role-assumption.spec.ts`'s own keyboard-only case (email autofocus → forgot-password link →
password → show-password toggle → Entrar) rather than assumed identical.

**Bugs filed:** none — every failure encountered while drafting (the `/conta-inativa` timeout) was
a wrong assertion in this spec, not an app defect; fixed in the spec, not worked around.

**Dev server:** none left running — `netstat -ano | findstr :3000` after the run showed only
`TIME_WAIT` sockets, no `LISTENING` entry; Playwright's own `webServer` tore itself down at the
end of the run.

**Not run here, by the brief's own instruction:** the full-suite `npm run e2e:prod` gate — that is
the lead's job, once, before declaring green.

Commit on `authz-admin-arm-is-active` (not amended, not pushed): `e2e/admin-arm-is-active.spec.ts`
+ this record entry.

### 2026-09-10 — fix-loop iteration 1: QA's two MINORs discharged (backend)

**Scope.** QA review (`docs/reviews/admin-arm-is-active-review.md`) APPROVED, 0 BLOCK / 0 MAJOR /
2 MINOR. This entry discharges both. No migration, no `src/`, no RLS/RPC change — a comment
correction plus a drafted follow-up.

**MINOR-1 — `418`'s stale `RUN SHAPE` line, corrected to the MEASURED figure(s), not a guess.**
Re-measured both shapes myself, on THIS clone, at head pair `(20261003007390, 528)` (confirmed via
`select max(version), count(*) from supabase_migrations.schema_migrations` = unchanged — no
migration lands in this turn):

- `npx supabase test db supabase/tests/00_setup.sql supabase/tests/418_admin_arm_is_active.sql` →
  `Files=2, Tests=31`, `Result: PASS` — the header's original claim reproduces WHEN `00_setup.sql`
  is passed alongside.
- `npx supabase test db supabase/tests/418_admin_arm_is_active.sql` ALONE, with `test_helpers`
  already installed in the DB from the run above (`00_setup.sql` installs the schema OUTSIDE its
  own per-file rollback, so it persists across separate `supabase test db` invocations) →
  `Files=1, Tests=30`, `Result: PASS` — reproduces QA's figure exactly.
- On a bare fresh `supabase db reset --local` (`test_helpers` not yet installed), the standalone
  form fails outright: `schema "test_helpers" does not exist` — a third fact neither the stale
  header nor the QA finding named, measured here so the corrected comment does not imply the
  standalone form always works.

`supabase/tests/418_admin_arm_is_active.sql:40` rewritten to state all three facts with the exact
command beside each, rather than swapping one number for another — QA's own instruction ("if the
2/31 came from running it beside `00_setup`, say that in the comment instead of deleting the
fact") is honored by keeping both figures, not by replacing one with the other.

**MINOR-2 — the `CASES=` empty-selects-all vs empty-selects-nothing divergence: drafted as a
follow-up, NOT fixed.** Per the lead's fix-loop framing this is a ruling — the harness's semantics
stay as they are this turn — so the discharge is a follow-up BODY only, drafted into the session
scratchpad `batch10-fups.md` as `## 5 ·
FUP-CASES-EMPTY-SEMANTICS-DIVERGE-ACROSS-MUTATION-HARNESS-FAMILIES` (NOT filed to the open
register — the Record step does that). It names: the mechanism
(`authz-command-door-targeted-cases.sh:69-72`'s `want()` treating `CASES=""` as "no filter" —
i.e. run everything — against the four `p0-authz-*.sh` homes' identical
`SELECTION_SOURCE="CASES set and EMPTY -> selects NOTHING (UNPROVEN, exit 3)"` line at
`p0-authz-door-audit.sh:113` / `p0-authz-invoker-audit.sh:134` / `p0-authz-rowdoor-audit.sh:93` /
`p0-authz-writepath-audit.sh:272`); the hazard (an engineer who internalized "empty is the third
state" reflexively exports `CASES=` here expecting a loud refusal and instead silently gets a
full run, indistinguishable in shape from a deliberate subset that happened to match everything);
and a `Closes when` naming three observables — `CASES=""` exits 3 with a refusal message,
`unset CASES` still runs every case, and a self-test row proves both mechanically, mirroring
`door-sweep-selftest.sh:612`/`:618`'s own pair for the deriver side of the identical distinction.
No harness file touched.

**Gates, rc read bare.**

| gate | rc | witness |
| --- | --- | --- |
| `npm run lint` | **0** | all 17 gates reached |
| `supabase db reset --local` | **0** | head pair `(20261003007390, 528)` |
| `npm run test:db` | **0** | `Files=267, Tests=9019` · `Result: PASS` · `All tests successful.` — unchanged from the tip gate, as it must be: no pgTAP file added or edited, no migration |

**Not run here:** `npm run typecheck`, `npm run test` (Vitest), the four authz arms, `e2e:prod` —
out of scope for a comment-plus-scratchpad-draft fix-loop turn; nothing here touches `src/`, a
migration, or a pgTAP file.

**Commit on `authz-admin-arm-is-active`** (not amended, not pushed):
`supabase/tests/418_admin_arm_is_active.sql` (RUN SHAPE correction) + this record entry.

### 2026-09-10 — authz seam slice appended, Current state replaced (backend)

**Scope: docs only** (the full `npm run e2e:prod` gate was running detached against the built app;
`src/`, `e2e/`, `supabase/` and any DB command were off-limits this turn). Read, in order: CLAUDE.md
§7 · `docs/backend-state/README.md` · `authorization-and-audit.md`'s prior `## Current state` block
and its last two slices (`§ AE5's opening decision`, `§ Per-object grant plane`) for the slice shape ·
this record in full · ADR 0201 D4/D5 with its two dated notes · the migration
`20261003007390_admin_arm_follows_account_state.sql` header (lines 1–137, comments only).

**Appended** a new frozen slice, `## Admin arm follows account state; the Class-2 write arm
relocated; the audit stamp logs role only` (`docs/backend-state/authorization-and-audit.md:1399`),
covering: the three `is_active` sites with their keying (table) and `assume_role`'s door-wide gate as
R1's declared widening of R12; the Class-2 arm removed from `can_manage_professional` and relocated
to an explicit `is_admin_for` arm on `can_manage_case_vocabulary`, `can_manage_external_participant`
deliberately unarmed; R10's role-only audit stamp and `315:212`'s rewrite; the TS mirror in
`session.ts`; row 31's own differential representative (the `gen-authz-differential-cells.py` REPS
entry, the `401`/`403` re-rulings, the live plant); the two TARGETED cases (`assume_role`,
`audit_write`) and the backlog paragraph; the derived expected-red set across five files (`228 · 409 ·
415 · 229 · 257`) plus `315`'s two rewrites. Every fact carries a witness — a record entry, a commit
sha (`a0002067` migration · `f2a0da8b` 418 · `3b54bf11` re-rulings · `fa68436c` TS mirror ·
`c5a52efb` targeted cases · `a74f2409` row 31 rep), or a pgTAP file:line/§ — none typed from memory.

**REPLACED** the `## Current state` block (never appended): folded the now-resolved "neither
`is_admin()`/`is_admin_for()`/`assume_role` consults `is_active`" Open-edge bullet into two Invariants
bullets stating the built/true state; trimmed the subject-keyed-asymmetry bullet (its R10-not-R8
tail is now the new bullet's own subject); replaced the stale "Arm-1 removal is Batch 10's, not done"
clause; added an Open-edges bullet naming the three follow-ups this unit files (the stale
`can_create_professional` comment, `is_admin()`'s unreachable PUBLIC EXECUTE grant, the `CASES=`
empty-semantics divergence across mutation-harness families); added the new slice to § Where the
detail lives. Line count measured, not assumed: `awk` over the block (heading exclusive, next `##`
exclusive) gave **111** after the first pass (over the 100-line ratchet) — three new/edited bullets
were carrying manual mid-sentence line breaks that added lines without adding content — consolidated
each to fewer physical lines (no prose cut) and re-measured: **96/100**. File size **153.1 KB**
(gate's own report), under the 160 KB warn and 200 KB cap.

**Gates, rc read bare.**

| gate | rc | witness |
| --- | --- | --- |
| `npm run lint:backend-state` | **0** | `OK — 15 seam file(s) + README.md, all routed, preamble identical, 1052 KB total, largest authorization-and-audit.md at 153.1 KB (warn 160 KB / cap 200 KB)`; headroom line lists `authorization-and-audit.md (96, 4 left)` |
| `npm run lint` | **0** | all 17 gates reached (chain ends at `lint:data-access`, itself rc 0) |

**Not run here, by instruction:** `typecheck`, `test`, `test:db`, `supabase db reset`, the four authz
arms, `next build`/`npm run dev` — the E2E gate was running detached against the built app and no DB
or dev-server command was permitted this turn. No `src/`, `e2e/` or `supabase/` file touched;
`git status --porcelain` before this turn's commit names exactly two files:
`docs/backend-state/authorization-and-audit.md` and this record.

**Commit on `authz-admin-arm-is-active`** (not amended, not pushed): the seam-file slice + Current
state replacement + this record entry.

### 2026-09-10 — the prod E2E gate at `9f0909d3`: two reds, one pre-existing on `main`, one a consequence of R10 that needed a ruling (R6) (lead)

Run detached (`REBUILD=1 npm run e2e:prod`, artifacts under the session scratchpad `e2eprod-9f0909d3/`),
monitored per batch. Batches 1–11 and 14: every test accounted, 0 failed; batch 1 had **one flaky**
(`act-role-assumption.spec.ts` *"The switch"*, passed on retry #1 — the flaky baseline's known recurring
row for that spec, timed out waiting for an account-menu item, not on the door). Two reds:

1. **Batch 12 — `pdf-printing-cases.spec.ts:618` (+10 did-not-run behind it, serial):** the fixture
   `grantWriteAccessNoPhi` calls `grant_case_access(p_level => 'write')` on a **completed** case and the
   door now refuses with `HC0U0` *"não é possível conceder edição em um caso encerrado"*. ⛔ **Not Batch
   10's**: `HC0U0` is raised by migration `20261003007370` (ADR 0205 Fix 2, unit `GRANT-PLANE-CONVENTION`,
   merged to `main` before this unit), and neither grant-plane unit's record mentions `e2e:prod` — the red
   was on `main` and this run is the first full gate to reach it. Spec-side fix (tester): the completed
   case needs a `read` grant for printing, or the grant precedes closure; bug row names the origin.
2. **Batch 13 — `phase13-audit.spec.ts:981` AC-3f-platform:** asserts the platform-tier feed (`org NULL
   AND commission NULL`) is EMPTY as a no-leak check. Under R10 every `active_role.assumed` row is
   scope-less, so hat seatings from earlier tests in the batch land in the platform feed. ⭐ **A
   consequence of R10 the ruling did not name**: the stamp has two READERS — `listAudit` (platform feed,
   `commission_id IS NULL` rows) now shows tenant seatings; `listAuditForOrg` (`organization_id = org`)
   loses them — and the spec's own history (its *"mechanism #1"* comment) records that ACT stage 3 stamped
   the assumed role's tenant precisely to keep seatings out of the platform feed. Taken to the PO with
   three options.

**PO ruling R6 — option (d): seating is an IDENTITY event; the platform feed is its home; R10 stands.**
Role seating is identity/session, inside `platform_admin`'s noun (A35: identity + audit); tenant admins
see role GRANTS and every later action row with its place and `acting_as`. ⇒ no code change; ADR 0201 D2
carries a dated note naming both readers; AC-3f is REWRITTEN by the tester to assert the precise no-leak
property (every platform-feed row scope-less, never a tenant-scoped row) — ⚠ robust also to the
pre-existing `BUG-CAPA-AUDIT-SCOPE-1` (all-NULL CAPA rows, the spec's *"mechanism #2"*, still open).
(b) re-stamp the tenant and (c) one row per org were rejected: a second `assume_role` migration, `315`/`418`
re-ruled again, and R10's snapshot objection back. ⭐ Lesson: a ruling that changes what a column HOLDS must
enumerate what READS it — the plan's blast radius covered the predicates' readers (policies, functions) and
not the audit stamp's (two TS queries).

### 2026-09-10 — the two prod-gate specs fixed and re-verified green (tester)

**Scope: the two real failures the lead's `e2e:prod` gate found (21 batches, tip `9f0909d3`) — both
SPECS, per this unit's hard boundary (never app code). `git status --porcelain` names exactly three
files: `e2e/pdf-printing-cases.spec.ts`, `e2e/phase13-audit.spec.ts`, `docs/bugs/BUGS.md` +
`docs/bugs/BUG-ADMIN-ARM-IS-ACTIVE-GRANT-P3-FIXTURE-WRITE-ON-TERMINAL.md` (this entry).**

**Fix 1 — `pdf-printing-cases.spec.ts`'s `beforeAll` (BUG-ADMIN-ARM-IS-ACTIVE-GRANT-P3-FIXTURE-WRITE-ON-TERMINAL,
`fixed`).** Measured what a completed case's printing corridor actually needs, against the LIVE
catalog, before touching the fixture:

* `mint_printed_document`'s authority gate (`app.can_view_printed_document`, `case` arm) is
  `app.can_read_case ∧ app.can_read_full_case_content` — both READ capabilities. A `read` grant
  passes both; tried first on that reasoning.
* **But** it broke the manage-detail ROUTE itself, where the "Documentos emitidos" panel lives.
  `canOpenCaseManagement` (`src/lib/queries/cases.ts`) is `staff_admin ∨ isAdministrativo ∨
  canWriteContent`; for the plain-member persona this fixture seats (`staff1.ccih@test.local`)
  that collapses to `case_access_grants.write_case_content`. Live probe, `case_viewer_capabilities`
  RPC as that persona on a fresh closed probe case with a `read` grant:
  `{"can_write_content": false}` → the route 404s (`notFound()`), reproduced **3/3** in isolated
  Playwright runs (`-g "a content reader WITHOUT the PHI door"`, `--retries=2`).
* `write_case_content` is a static column, unaffected by a LATER `close_case` call — live-measured
  by granting `write` on an open probe case, closing it, and re-probing
  `case_viewer_capabilities` as the grantee: still `can_write_content: true`.

⇒ **The fix is ORDERING, not level.** `write` is correct and load-bearing for both personas this
fixture seats (`caseNoPhiMinterId`, `caseOpenId`); `caseNoPhiMinterId`'s grant call moved from
*after* the six-case `closeSpecCase` loop to *before* it (the only case in the loop this fixture
also grants to). `caseOpenId` never closes in this file, so its call site was never at risk and is
unchanged. Bug row `BUG-ADMIN-ARM-IS-ACTIVE-GRANT-P3-FIXTURE-WRITE-ON-TERMINAL` filed `fixed` by this commit (spec-only
fix — see `docs/bugs/BUG-ADMIN-ARM-IS-ACTIVE-GRANT-P3-FIXTURE-WRITE-ON-TERMINAL.md` for the full root-cause writeup,
including the two live probes above, each with its exact request/response).

⚠ **A false lead, recorded so the next session does not repeat it.** A first attempt granted
`read` to BOTH `caseNoPhiMinterId` and `caseOpenId`. Re-running the FULL two-file suite
(`--workers=1`) showed `caseOpenId`'s corridor test failing instead (`?phi=1 without PHI
authority…`), reproduced 3/3 in isolation — a DIFFERENT symptom of the SAME root cause
(`canWriteContent` false), not a new bug. `caseOpenId` was never touched by the ORIGINAL HC0U0
defect (it never closes, so a `write` grant there never trips D9) — the correct fix touches only
`caseNoPhiMinterId`'s ordering.

**Fix 2 — `phase13-audit.spec.ts` AC-3f-platform, rewritten per PO ruling R6 (no bug row — a ruled
behaviour change, this record is the citation).** Replaced the empty-state assertion with the
precise no-leak property: every row the `/admin/audit` cross-commission feed shows scope-less
(`organization_id IS NULL AND commission_id IS NULL`) is asserted against DATA, never the
empty-state text. Implementation notes, since the first draft was itself wrong twice:

* The feed can legitimately be non-empty now (R6: seating rows are scope-less by design), so the
  test branches on rendered row count — 0 rows is vacuously scope-less (asserts the empty state
  literally, so the branch is not silently skipping the check), >0 rows correlates every rendered
  row back to its DB truth.
* ⛔ **`seq` ALONE is not a correlation key** — measured live, `\d audit_log` carries FOUR unique
  indexes, one PER TIER (`..._commission_seq_key`, `..._hospital_seq_key`, `..._org_seq_key`,
  `..._platform_seq_key`); the same small `seq` repeats once per commission/org/hospital. A first
  draft querying `seq=in.(...)` alone got **128** rows back for **7** rendered seqs — cross-tier
  collisions, not the rendered rows, and the test correctly refused to trust that number. Fixed by
  pairing `seq` with the row's own `occurred_at` (read from the `<time datetime>` attribute,
  microsecond precision, never the rendered relative text) and asserting exactly one DB row
  resolves per pair before trusting its scope columns.
* Asserts `hospital_id IS NULL` too, stronger than R6's literal wording (org + commission) but
  consistent with it: `audit_log_platform_seq_key` — the one index that makes `seq` globally
  unique — is keyed on all three tiers being NULL, so a hospital-tier leak would satisfy "org NULL
  and commission NULL" while still being a tenant-scoped row.
* The long comment above the test gained a dated 2026-09-10 paragraph naming R6 (quoted: *"seating
  is an IDENTITY event and the platform feed is its home"*) and recording why "empty" stopped being
  the property.

**Run, quoted verbatim (`--project=chromium --workers=1`, dev server — the gate's own server from
the batch-10 tip run was already gone; port 3000 verified free before each run; the local stack was
left up, freshly seeded by the gate's last batch reset — no `supabase db reset` was run by this
session):**

```
38 passed (1.7m)
```

Run **twice** in a row to rule out the dev-server flakiness this exact file's corridor-1 test
documents in its own comments (a cold-`next dev`-compile class of flake, not a code defect) —
both runs green, no retries needed. Earlier intermediate runs (both grants at `read`; then
`caseNoPhiMinterId` at `read` / `caseOpenId` at `write`) are the false-lead trail above, not this
result.

**Not touched, per the hard boundary.** No application code, migration, RLS policy, or query
changed. `docs/features/admin-arm-is-active.md` (the hub) is lead-owned and not edited here.

Commit on `authz-admin-arm-is-active` (not amended, not pushed): spec fixes + `docs/bugs/BUGS.md` +
`docs/bugs/BUG-ADMIN-ARM-IS-ACTIVE-GRANT-P3-FIXTURE-WRITE-ON-TERMINAL.md` + this entry, one commit.

### 2026-09-10 — E2E loop closed: the two fixed specs GREEN on the prod build; the gate chain at the final tip (lead)

Full gate at `9f0909d3` (previous entry): `GATE SUMMARY: 1251 passed · 2 failed · 0 infra · 2 flaky ·
10 did-not-run · 21 batches`, `COVERAGE: accounted for 1265 of 1277` (the 12 outside the line are
`skipped`, which the gate excludes from its own count — Batch 8's note), `GATE_EXIT=1`. Both reds
dispositioned (one pre-existing on `main`, one ruled R6); both flakies are named rows of the flaky
baseline (`act-role-assumption` *"The switch"* · `phase2-auth-shell.spec.ts:268`, 16 prior sightings),
each passed on retry #1.

Tester's fixes (`8e8b6126`): `pdf-printing-cases` — the `write` grant is **load-bearing** (the manage
route's `canOpenCaseManagement` needs `write_case_content`; a `read` grant measured `can_write_content:
false` 3/3), and a `write` grant **survives a later `close_case`** (live-probed) ⇒ the grant is moved
BEFORE the close loop, level unchanged; bug row `BUG-ADMIN-ARM-IS-ACTIVE-GRANT-P3-FIXTURE-WRITE-ON-TERMINAL`
(`fixed`; renamed by the lead at `df5e86f0` because gate 13 requires the hub prefix — its two citations
in the spec are comment lines, changed for the id only). `phase13-audit` AC-3f rewritten to the R6
property — every rendered platform-feed row scope-less, checked against `audit_log` by `(occurred_at,
seq)` (⭐ `seq` alone collides across the four per-tier unique indexes: 128 false matches for 7 rows on
the first attempt — measured, not assumed).

**Closing subset on the prod build**, detached, `SPECS="e2e/pdf-printing-cases.spec.ts
e2e/phase13-audit.spec.ts" npm run e2e:prod` at `8e8b6126`: `GATE SUMMARY: 38 passed · 0 failed · 0
infra · 0 flaky · 0 did-not-run · 1 batches` · `COVERAGE: accounted for 38 of 38` · `GATE_EXIT=0` ·
`verdict=GATE GREEN`. ⇒ green under the flaky-baseline rule: the full suite ran once, the two real
failures were fixed spec-side and re-run on the prod build, the flakies are baseline rows.

**Gate chain at the final tip `df5e86f0`, rc bare:** `npm run lint` **0** (17 gates reached) ·
`typecheck` **0** · `git diff --stat 9f0909d3..HEAD -- src supabase` **EMPTY** (the app the full E2E
built and ran is byte-identical to the tip; only `e2e/` and docs moved since) · `test:db` last run at
`c5a52efb`/`9f0909d3` (`Files=267, Tests=9019`) with no `supabase/` change after it.
