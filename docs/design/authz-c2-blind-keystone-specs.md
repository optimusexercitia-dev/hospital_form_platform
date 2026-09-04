# Per-door keystone specs for the 39 BLIND command doors

**For:** C2-TIER1 closure item 3 (`FUP-C2-THREE-BLIND-COMMAND-DOOR-GUARDS`; hub
`docs/features/c2-tier1.md` § In progress) · **Written:** 2026-09-04 · **Spec only** — no pgTAP
written, no `supabase/**` touched, **no database read**.

**Companion, not replacement:** `docs/design/authz-c2-blind-keystone-designs.md` designs three of
these doors in depth (`nsp_org_capa_rollup`, `cancel_event`, `cancel_session`). Its **§0** (what the
harness mutates) and **§4.2** (the repo idioms — claims helper + hat trap, the scaffolding triple,
pin the message, allow-leg-plus-effect, in-place vs new file) are **binding on every entry below and
are not restated here**. ⚠ Its §1.2 premise is corrected by ADR 0187 C6 (independently re-confirmed
in §5.7 below). Entries for those three doors here carry only the **delta** this spec adds.

**Rulings this spec is written under:** ADR 0187 **D2** (a B-class keystone's COVERED is state /
lifecycle / validation coverage and the label is the *condition* of closure, carried in the test-name
string) and **D3** (`app.print_source_series` out; 40 → 39). ADR 0184 **point 5** is the
anti-promotion rule D2 operationalises.

---

## 0 · Method, and what was NOT measured

Everything below is derived from a snapshot of `pg_get_functiondef` for all 39 enforcers taken from
the live catalog **before** the C2 mutation sweep started, plus direct reads of
`supabase/tests/*.sql`. The database was not read: a mutation harness owns it, and a mutated body
would have silently produced a wrong spec.

Derived here, not carried forward:

| measurement | value | how |
| --- | ---: | --- |
| anchored raises across the 39 bodies | **72** | harness-exact anchor `raise\s+exception[^;]*?errcode\s*(=\|=>)\s*'(42501\|HC0[A-Z0-9]{2})'\s*;` applied per body |
| doors with a **semicolon-spanning (UNMUTABLE)** anchored raise | **0** | the per-body anchored count equals the inventory row count for all 39 (72 = 72), so every anchored raise in this set does land |
| doors present in `c2-tier1-doors.txt` | **38 of 39** | `app.assert_ethics_typed` is an enforcer reachable from Tier-1 doors, not itself a door |
| doors on `authz-neverclled-door-allowlist.txt` | **10** | §6.5 |
| doors a pgTAP file **invokes** | **31 of 39** | §6.3 — ⚠ this contradicts a record; see §4 |

**Not measured (state it, do not infer it):**

- The bodies of the **delegates** — `app.assert_interview_writable`, `app.assert_capa_writable`,
  `app.assert_rca_writable`, `app.assert_referral_target_acts`, `app.can_write_interview`,
  `app.event_current_custodian`, `app.assert_not_case_excluded`, `app.assert_case_corrections_enabled`,
  `app.can_manage_referral_source`, `app.can_manage_referral_internal_note` — are outside the
  snapshot. Two open questions in §3 turn on exactly one of them.
- The bodies of `public.create_case_decision`, `public.schedule_ethics_hearing` and
  `public.target_case_response` — needed to close §3.1.
- Whether each proposed fixture **lands**. Where the host file already stands in the required state
  that is asserted from the file's text; where a fixture must be built it is flagged `BUILD` and is
  the entry's whole risk.
- Line numbers in the existing design doc drift by 1–2 against the current files (its §1.3 cites
  `plan(53)` at L32, the file has it at **L33**; its §3.3 cites `plan(60)` at L16, the file has it at
  **L15**). Re-derive every line number at implementation time.

---

## 1 · The adjudication rule

ADR 0187 D-M2 records the split **12 / 13 / 14** but not the predicate that produced it, and the two
regex classifiers available disagree (12/13/14 vs 12/18/9). Both are keyed on message *text*. This
spec adjudicates by reading the **guard condition** and states its rule so the result is auditable:

> **A raise is `authorization` iff the guard predicate immediately preceding it takes the CALLER as
> an input** — `auth.uid()`, or a capability predicate over the caller (`app.is_*_of`, `app.can_*`,
> `app.event_current_custodian(…, auth.uid())`). It is `state` / `lifecycle` / `validation` iff the
> guard reads only object state or input parameters.

Applied to all 39, this rule reproduces **12 / 13 / 14 exactly** — the same split as ADR 0187 D-M2,
derived independently and from a different input. That is corroboration, not a copy.

### 1.1 The regex artifact, named

The broader regex classifier calls **18** doors A2. The five it over-calls are `reopen_capa_plan`,
`reopen_interview`, `reopen_rca`, `submit_rca_for_review` and `submit_ethics_appeal`. Every one
matched on the Portuguese **`apenas`** — and in every one `apenas` governs an **object**, not a
principal:

| message | `apenas` governs | property |
| --- | --- | --- |
| *apenas um plano concluído pode ser reaberto* | the plan | lifecycle |
| *apenas entrevistas concluídas podem ser reabertas* | the interview | lifecycle |
| *apenas uma análise concluída pode ser reaberta* | the RCA | lifecycle |
| *apenas uma análise em andamento pode ser enviada para revisão* | the RCA | lifecycle |
| *apenas decisões emitidas podem ser objeto de recurso* | the decision | lifecycle |
| *apenas a coordenação pode editar uma sessão reservada* | **the caller** | authorization |
| *apenas quem detém a custódia do evento pode cancelá-lo* | **the caller** | authorization |
| *apenas o corretor designado pode reenviar* | **the caller** | authorization |

`apenas` is a syntax, not a property — the same failure the harness anchor itself has
(`FUP-C2-NEUTRALIZER-ANCHOR-BLIND-TO-HCDS-AND-28000`), one layer up. **A message-keyed classifier
cannot be repaired by a better word list**; only the guard's subject decides.

### 1.2 Three doors where the rule disagrees with a message reading — ⚠ `A2/B — needs a ruling`

The rule is itself a ruling. On 36 doors the two readings agree. On three they do not, and the rule
is what decides them. Each is marked `A2/B — needs a ruling` in §5, classified **B** provisionally,
with the recommendation recorded here:

1. **`public.add_capa_action_evidence` (HC0D8, *"documento indisponível para esta ação"*).** The
   guard reads `p_document_id` / `p_action_id` / `d.status` — **no caller input**, so the rule says
   B/validation. But it is the only thing preventing a document homed on *another* resource from
   being attached as evidence, which reads as a cross-resource isolation property, and the body's own
   comment calls it *"same denial shape"*. **Recommend B/validation** — and note that B is also the
   *conservative* call: D2's label is precisely what stops the resulting COVERED being read as
   isolation coverage.
2. **`public.submit_ethics_appeal` (HC0J0 #1, *"decisão inválida para este caso"*).** Guard is
   `v_dec_case is null or v_dec_case <> p_case_id` — a cross-case object reference, no caller input.
   Rule says B/validation. The door's principal check is `app.assert_ethics_coordinator` (HC0J1) in a
   **delegate**. **Recommend B**, same reasoning.
3. **`app.assert_ethics_typed` (HC0J0).** ⚠ Its message says *"ação inválida para o **status** atual
   do processo ético"* but its guard checks the **existence** of an `ethics_case_details` row — not a
   status column. A message-keyed classifier reads `lifecycle`; the guard says `validation`. This is a
   plain "text is not truth" instance inside the classification input itself. **Recommend
   B/validation**, and the label string should not repeat the message's "status" wording.

A fourth boundary the rule touches without changing any door's class, recorded so it is not
rediscovered: **HC0F4** (*"sua conta está inativa ou suspensa"*, guard `not app.is_active(auth.uid())`)
is caller-reading and therefore authorization by the rule, though it is an account-eligibility gate
rather than a scope gate. All four doors carrying it are already A1 or A2 on a sharper raise.

### 1.3 The property-label template (ADR 0187 D2)

Every B-class keystone's `throws_ok` description must carry the label where TAP output shows it:

```
'⭐⭐ KEYSTONE [PROPERTY: <lifecycle|state|validation> — NOT authorization]: <what the guard refuses>
 (<CODE>) — mutation-proven BLIND 2026-09-02. ADR 0187 D2: this COVERED is <label> coverage;
 the door''s authorization is <where it actually lives>, a separate worklist row.'
```

⛔ **The three existing designs pre-date D2 and two of them are non-conforming as written.**
`cancel_session` (§3.3 of the design doc) is class **B/lifecycle** and its proposed description
carries no label; `cancel_event`'s HC043 arm (§2.3) is likewise B/lifecycle and unlabelled. Both
strings must be amended before landing, or the keystones do not discharge their rows.
`nsp_org_capa_rollup` is A1 and needs no label.

---

## 2 · The adjudicated split

| class | count | doors |
| --- | ---: | --- |
| **A1** — `42501` in own body | **12** | `add_reserved_item` · `approve_correction` · `assign_narrative` · `list_hospital_eligible_users_for_pqs` · `nsp_org_capa_rollup` · `nsp_org_roster` · `reject_correction` · `reopen_referral` · `reopen_triage` · `review_correction` · `unassign_narrative` · `unassign_referral_internal_note` |
| **A2** — authorization via a caller-reading `HC0*` | **13** | `add_rca_member` · `cancel_event` · `record_session_attendance` · `resubmit_correction` · `save_correction_draft_body` · `set_event_patient` · `set_interview_interviewer_participant` · `set_interview_participant` · `set_interview_subject_participant` · `start_correction_draft` · `transfer_event_custody` · `update_event` · `withdraw_referral` |
| **B** — state / lifecycle / validation only | **14** | `app.assert_ethics_typed` · `add_capa_action_evidence` · `cancel_interview` · `cancel_session` · `conclude_referral` · `no_show_session` · `reopen_capa_plan` · `reopen_interview` · `reopen_rca` · `submit_ethics_appeal` · `submit_rca_for_review` · `update_interview` · `update_interview_subject` · `update_session` |

B by sub-label, **by guard**: lifecycle 9 (`cancel_interview`, `cancel_session`, `no_show_session`,
`reopen_capa_plan`, `reopen_interview`, `reopen_rca`, `submit_rca_for_review`, `update_interview`,
`update_session`) · validation 5 (`assert_ethics_typed`, `add_capa_action_evidence`,
`conclude_referral`, `submit_ethics_appeal`, `update_interview_subject`).

⚠ **D2's label attaches to the KEYSTONE, not to the door**, so the recorded split is **lifecycle 8 ·
validation 6**: `update_interview` carries both a lifecycle (`HC038`) and a validation (`HC0B1`)
anchored raise, and §5.2 specifies pinning `HC0B1` because the `HC038` branch may be unreachable —
which makes its recorded coverage `validation`. Where the two figures differ, the keystone's is the
one a gate record states.

No door's own body carries a guard best described as `state` rather than `lifecycle`; the D2
vocabulary's third word is unused here, which is worth saying rather than forcing a door into it.

---

## 3 · Contradictions — a deny leg that already pins the door's own code

Under mutation fact #2, if a live `throws_ok` pins a code that is in **this door's own body**, on a
call that **enters this door**, the mutated run must go red and the verdict must be COVERED. A BLIND
verdict there is a contradiction that needs explaining, not a keystone.

Every one of the 39 was checked against a full `throws_ok` errcode sweep of `supabase/tests/*.sql`.
**Two contradictions, and no others.** The other 37 are clean, and the reason they are clean is
uniform and worth stating: a code in a door's own body is pinned repeatedly across the suite — but
always on a **sibling door**. `HC0A9` is pinned ten times, never on `unassign_referral_internal_note`.
`HC071` is pinned seven times across five doors, never on `withdraw_referral`. `HC047` six times,
never on `reopen_rca` or `submit_rca_for_review`. `HC049` five times, never on `reopen_capa_plan`.
`HC0D8` six times, never on `add_capa_action_evidence`. That is the `assign_narrative` / `HC0F1`
shape generalised: **same code, different door.**

Six codes have **zero `throws_ok` pins anywhere in the suite**: `HC074`, `HC075`, `HC0M1`, `HC0M3`,
`HC0M6`, `HC0M9` — i.e. the whole correction-draft authority lane and both `conclude_referral`
validation codes are untested by any door.

### 3.1 CONTRADICTION-1 — `app.assert_ethics_typed` (HC0J0)

`supabase/tests/258_ethics_e2_rpcs.sql:92-94` pins `HC0J0` on a non-ethics case, and the comment
directly above it (`:89`) attributes the raise to `assert_ethics_typed`. Two more pins have the same
shape: `256_ethics_e2_hearings.sql:118` (`schedule_ethics_hearing`, same non-ethics fixture
`…0e2002`) and `255_ethics_e2_targeted.sql:137` (`target_case_response`, non-ethics case). If any of
the three delegates to `assert_ethics_typed`, neutralizing it turns that assertion red → COVERED.

**Most likely resolution:** all three raise `HC0J0` from their own bodies and the `:89` comment
mis-attributes. Supporting evidence inside the snapshot: `submit_ethics_appeal` raises `HC0J0` twice
**inline** even though it calls `assert_ethics_typed` on the line above — this codebase demonstrably
re-uses HC0J0 across the ethics lane rather than funnelling it. All three pins pass `null` for the
message, so none can discriminate between the delegate's string and an inline one.

**Resolve with one catalog read** once the DB is free —
`select pg_get_functiondef('public.create_case_decision(uuid,text,text,text)'::regprocedure);` and the
two siblings — and check whether `app.assert_ethics_typed` appears in the body. ⛔ Do not write this
keystone before that read: if the delegate does fire, the row is already COVERED and the keystone is
work against a verdict that was wrong.

### 3.2 CONTRADICTION-2 — `public.reopen_interview` (HC038) ⚠ the sharp one

`supabase/tests/121_interviews.sql:292-294`:

```sql
select throws_ok(
  $$ select public.reopen_interview((select id from i2)) $$,
  'HC038', null, 'a cancelled interview cannot be reopened (terminal; HC038)');                -- 43
```

`HC038` is `reopen_interview`'s **only** anchored raise and it is in its **own** body
(`if v_status <> 'completed' then raise … 'apenas entrevistas concluídas podem ser reabertas'`). The
call enters the door. There is no delegate-attribution escape available *unless* something earlier in
the door's prologue also raises `HC038` for a **cancelled** interview — and the only candidate,
`app.assert_interview_writable`, is recorded in the existing design §3.1 as raising **HC039**, not
HC038. So on the record as it stands, this door should have come back COVERED.

**Two possibilities, both findings:**

- **(a)** `app.assert_interview_writable` *does* raise `HC038` on a terminal interview. Then `:294` is
  satisfied by the delegate, BLIND is correct, and — importantly — `cancel_interview`'s own `HC038`
  (guard `status in ('completed','cancelled')`, i.e. only reachable *after* a terminal check the
  delegate would have already failed) is **unreachable dead code**, making it a D3-style
  "correct and uninteresting BLIND" rather than a keystone target.
- **(b)** `reopen_interview`'s own HC038 fires and the BLIND verdict is a harness artifact —
  candidates: `FUP-C2-NEUTRALIZER-TAIL-DRIFT-INVALIDATES-LATE-VERDICTS` (three rows already
  re-measured to COVERED that way) or a mutation that did not fully apply.

**Action, in order:** (1) read `pg_get_functiondef('app.assert_interview_writable(uuid)'::regprocedure)`;
(2) re-measure with `CASES=public.reopen_interview`. Only then write the keystone. The §5.2 entry
below specifies a keystone that is correct under **either** branch, because it targets a state the
delegate cannot pre-empt.

### 3.3 The shared mechanism, and why it matters beyond these two

Both contradictions have the same shape: **a `throws_ok` that passes `null` for the message, on a code
that more than one enforcer in the call chain raises.** §4.2 of the design doc justifies message-pinning
as defence against a missing EXECUTE grant satisfying a bare `42501`. These two rows show a second,
sharper reason: **the message is what distinguishes two worklist rows that share a code.** A
code-only pin cannot say which enforcer it measured — which is exactly the question the C2 sweep asks.

---

## 4 · Blindness shapes — the record's "36 of 40 are already invoked" over-counts

ADR 0187 D-M1 records that 36 of the 40 BLIND doors are already invoked by the suite and only four
have zero references. Re-measured here by reading every hit rather than counting grep lines:

| shape | doors (of 39) | why a name-grep misses it |
| --- | ---: | --- |
| **no mention at all** | **3** — `nsp_org_capa_rollup`, `cancel_event`, `add_capa_action_evidence` | honest; the existing derivation already finds these |
| **mentioned, never entered — t19 ACL block** | **5** — `cancel_session`, `update_session`, `update_interview` (all `121_interviews.sql` t19), `set_interview_subject_participant`, `set_interview_interviewer_participant` (both `228_ethics_e1.sql` t19) | the mention is a `has_function_privilege` read of `pg_proc.proacl`; a body rewrite perturbs no bit of it |
| **mentioned, never entered — comment / catalog name-list** | **1** — `app.assert_ethics_typed` (a comment at `258:89`); plus `326`, `314`, `363`, `382` name several referral/narrative doors inside `pg_proc`/`pg_policies` reads and `unnest(array[…])` lists that never invoke | same class, different syntax |
| **entered, but only on a path where the guard is not deciding** | the remaining **30** | the D-M1 shape: allow legs, or deny legs on a *delegate's* code |

⇒ **8 of the 39 are not invoked by any pgTAP test, not 4.** (`app.assert_ethics_typed` is entered
*transitively* whenever `submit_ethics_appeal` succeeds, but never on its failing branch and never
named — so it is a ninth door with no useful coverage, counted separately.) The corrected figure is
**31 of 39 invoked**.

The over-count is 5, and its mechanism is precisely the one the existing design's §4.3 predicted:
D-M1's enumeration is bounded by **the name appearing in a test file** — a syntax — rather than by
**the function being entered** — the property. §4.3 wrote that warning about `cancel_session`
specifically; `cancel_session` is itself inside D-M1's "36 invoked". The warning and the measurement
it warned about were written alongside each other and the warning did not reach the measurement.

⚠ **Consequence for the work estimate.** D-M1's conclusion — *"the deliverable is a deny leg in a
file that already exists"* — still holds for 30 doors. For the 8 not-invoked ones the deliverable is a
deny leg **and** a first invocation **and** (for the 10 allowlisted, §6.5) an allow leg with an effect
assertion. Those are the expensive rows.

---

## 5 · The 39 doors

Field key per entry: **raises** (its own anchored raises, code + message, from the snapshot) ·
**class** (+ one-line reason) · **refs** (pgTAP files that name it, and whether they *enter* it) ·
**deny leg** (does one already pin one of its own codes) · **pin** (the code the keystone must
assert) · **host** (file + placement + reason) · **allowlist** · **effort**.

Cluster rates are ADR 0187 C5's, re-derived here against the 39: correction workflow **6**,
interview + session **11**, referral **4** — the same counts C5 records, so C5 is corroborated.

---

### 5.1 Correction workflow — 6 doors (C5: 6/8 enforcers BLIND, 75 % vs a 23 % base)

All six live in `supabase/tests/264_correction_requests.sql` (`plan(39)` at L18, 562 lines) and share
a fixture world: `k` from `test_helpers.bootstrap()`, `sa_x` = `staff_admin` of `comm_x`, `st_x` = the
designated `permitted_corrector` in the r9 / d7 arms, requests `r4`–`r12` and `rn10`.

⛔ **Why the cluster is blind, stated once.** 264 already carries `throws_ok` arms on *every* one of
these doors — eight `HC000` arms (K8, L341–356) and two `HC0F1` arms (K9, L398–403). Both codes match
the harness anchor, so the cluster reads as covered twice over. Neither is in any door's own body:
`HC000` is `app.assert_case_corrections_enabled`'s and `HC0F1` is `app.assert_not_case_excluded`'s —
**separate worklist rows**. This is the `assign_narrative`/`HC0F1` shape at cluster scale, and it is a
third blindness mechanism beyond §4.3's two: *deny leg present, on a delegate's code*.

⚠ **Placement constraint for the whole cluster.** K9 inserts `sa_x` into `public.case_recusals`
at L394–395. From that point `sa_x` fails `assert_not_case_excluded` (HC0F1) **before** reaching any
state guard — but *after* the `42501` check, which sits earlier in `approve/reject/review_correction`.
A `42501` deny leg placed after L395 would therefore still be attributable; an `HC0M1` or `HC020` leg
would not. **Put the new block after the last K12 assertion (~L526) and before `finish()`**, and use
a persona whose recusal state you set yourself.

⚠ **`approve_correction` carries a mutation trap.** Its `HC061` raise sits inside
`exception when others then … if sqlstate = 'HC061' then raise … end if; raise;`. Neutralized, the
body becomes `… then null; end if; raise;` — and the bare `raise;` **re-raises the delegate's HC061
with the same SQLSTATE**. A keystone pinning `HC061` by code alone stays **green under mutation** and
moves nothing; pinning code **+ message** goes red. Do not use HC061 as this door's keystone (use its
`42501`), and record the trap: it is the strongest live instance of §4.2's "pin the message".

| door | raises (own body) | class | refs / entered? | existing deny leg on own code | pin |
| --- | --- | --- | --- | --- | --- |
| `approve_correction` | `42501` *apenas administradores podem aprovar correções* · `HC020` · `HC061` · `HC0F4` · `HC0M9` | **A1** — guard `app.is_staff_admin_of(v_commission)` | 264 ×7 entered (232, 258, 351 `HC000`, 399 `HC0F1`, 440, 478, 521), 265:99 (allow), 367:494 (`lives_ok`) | **no** — HC000/HC0F1 are delegates; all six suite `HC061` pins are on `submit_response` | **`42501`** + message |
| `reject_correction` | `42501` *apenas administradores podem reprovar correções* · `HC020` · `HC0F4` · `HC0M6` | **A1** — same guard | 264:282 (allow), :353 (`HC000`), :402 (`HC0F1`) | **no** — `HC0M6` has **zero** pins suite-wide | **`42501`** + message |
| `review_correction` | `42501` *apenas administradores podem revisar correções* · `HC020` · `HC0F4` | **A1** — same guard | 264:231 (allow), :349 (`HC000`) | **no** | **`42501`** + message |
| `start_correction_draft` | `HC020` · `HC0F4` · `HC0M1` *apenas o corretor designado pode iniciar o rascunho* · `HC0M9` | **A2** — guard `auth.uid() is distinct from v_corrector` | 264 ×8 entered (215, 256, 276, 292, 310, 328, 343 `HC000`, 389), 272:478 (bare), 367:475 (`lives_ok`) | **no** — `HC0M1` zero pins suite-wide | **`HC0M1`** + message |
| `save_correction_draft_body` | `HC020` · `HC0F4` · `HC0M1` *apenas o corretor designado pode editar o rascunho* | **A2** — same guard | 264:345 (`HC000`), :435 (allow) | **no** | **`HC0M1`** + message |
| `resubmit_correction` | `HC020` · `HC0F4` · `HC0M1` *apenas o corretor designado pode reenviar* · `HC0M3` · `HC0M9` | **A2** — same guard | 264 ×8 entered (227, 257, 278, 293 `lives_ok`, 329, 347 `HC000`, 390, 436), 367:484 (bare) | **no** | **`HC0M1`** + message |

**Host for all six:** `supabase/tests/264_correction_requests.sql`, one new `§K13` block appended
after K12 (last assertion ~L526) and before `select * from finish();`. Bump `plan(39)` at **L18** by
the number of arms added. In place, not a new file: the six requests, the phase/narrative fixtures and
both personas are already standing there, and a standalone file would rebuild all of it.

**Fixtures — existing, no BUILD.** The three A1 doors need a caller who is *not* `staff_admin` of
`comm_x`: use `st_x` (plain member, so the refusal is attributable to the role and not to tenancy).
The three A2 doors need a caller who is *not* the `permitted_corrector`: use `sa_x` against a request
whose corrector is `st_x` (r9's shape, L381–390). Each needs one `lives_ok`/bare-call allow leg plus an
effect `is()` — none of the six is allowlisted, so the allow leg is for the differential (§4.2), not
for `ARM=floor`.

**Effort: LOW ×6, risk LOW.** No new fixture. The only sequencing hazard is the K9 recusal above.

---

### 5.2 Interview + session — 11 doors (C5: 11/21, 52 %)

Two hosts. `supabase/tests/121_interviews.sql` (`plan(60)` at **L15**, 394 lines; `k` bootstrap with
`sa_x`, `st_x`, `st_x2`; interviews `i1` `i2` `i3`, sessions `s1` `s3` `s4`) owns the lifecycle doors.
`supabase/tests/228_ethics_e1.sql` (`plan(136)` at **L26**, 1078 lines; same `k` plus `sa_y`;
interview `iv` on `c_default` with two scheduled sessions and case participants `…e0122` in-case /
`…e0123` cross-case) owns the participant-FK doors.

⛔ **Five of the eleven are the t19 shape** (§4): `cancel_session`, `update_session`, `update_interview`
in 121's t19 block (L352–390), `set_interview_subject_participant` and
`set_interview_interviewer_participant` in 228's (L668–678). Their only mention is a
`has_function_privilege` read. They are **never entered**, and four of the five are allowlisted.

⭐ **The ready-made discriminator for every `HC039` leg** is `121:327–331`: `st_x2` (a staff member who
is *not* a registered interviewer) already raises `HC039` on `schedule_session` under
`claims_for(st_x2, false)`. Point the same probe at the four `HC039` doors.

| door | raises (own body) | class | refs / entered? | existing deny leg on own code | pin |
| --- | --- | --- | --- | --- | --- |
| `record_session_attendance` | `HC039` *sem permissão para editar esta entrevista* | **A2** — `app.can_write_interview(v_interview_id, auth.uid())` | 228:673/678 (t19), :727 `lives_ok`, :732 `throws_ok` **`23514`** | **no** — 23514 is unanchored; the four suite `HC039` pins are on other doors | **`HC039`** + message |
| `set_interview_participant` | `HC039` *sem permissão…* | **A2** — same | 228:669/674 (t19), :710 `lives_ok`, :714 `throws_ok` **`23514`** | **no** | **`HC039`** + message |
| `set_interview_subject_participant` | `HC039` *sem permissão…* | **A2** — same | 228:670/675 — **t19 only, never entered** | **no** | **`HC039`** + message |
| `set_interview_interviewer_participant` | `HC039` *sem permissão…* | **A2** — same | 228:671/676 — **t19 only, never entered** | **no** | **`HC039`** + message |
| `cancel_interview` | `HC038` *esta entrevista não pode ser cancelada neste estado* | **B / lifecycle** — `v_status in ('completed','cancelled')` | 121:284 (allow), :366 (t19) | no | **`HC038`** + message ⚠ see below |
| `reopen_interview` | `HC038` *apenas entrevistas concluídas podem ser reabertas* | **B / lifecycle** — `v_status <> 'completed'` | 121:258 (allow), **:294 `throws_ok` HC038 — §3.2** | ⛔ **YES — CONTRADICTION-2** | **`HC038`** + message, on a **non-terminal** interview |
| `update_interview` | `HC038` *a entrevista não pode ser editada neste estado* · `HC0B1` *informe uma categoria válida para a entrevista* | **B / lifecycle** (HC038); HC0B1 is validation | 121:360 — **t19 only, never entered** | no — 121:58 pins `HC0B1` on **`create_interview`**, a sibling | ⭐ **`HC0B1`** + message (see below) |
| `update_session` | `HC038` *esta sessão não pode ser editada neste estado* | **B / lifecycle** — `v_status in ('completed','cancelled','no_show')` | 121:372 — **t19 only, never entered** | no | **`HC038`** + message |
| `cancel_session` | `HC038` *uma sessão concluída não pode ser cancelada* | **B / lifecycle** | 121:381 — **t19 only** (design §3.2) | no | **`HC038`** + message |
| `no_show_session` | `HC038` *uma sessão concluída não pode ser marcada como não comparecimento* | **B / lifecycle** | 121:336 (allow, on a `scheduled` session), :384 (t19) | no | **`HC038`** + message |
| `update_interview_subject` | `HC0B2` *informe uma relação válida do entrevistado com o caso* | **B / validation** — enum check on `p_relationship_to_case` | 353:443 `throws_ok` **`23514`** (the disposal child-lock, message-pinned) | **no** — 121:216 pins `HC0B2` on **`add_interview_subject`**, a sibling | **`HC0B2`** + message |

**Two entries need their own note.**

⚠ **`reopen_interview`** — do not simply add an arm; §3.2 must be resolved first. The keystone
specified here is correct under **either** branch of §3.2 because it targets a state
`assert_interview_writable` cannot pre-empt: an interview that is **`in_progress`** (writable, and
`status <> 'completed'`). `i1` is in that state between its creation and L264's `conclude_interview`,
so the arm drops in **before L256** with `claims_for(sa_x, false)` already standing:

```
'⭐⭐ KEYSTONE [PROPERTY: lifecycle — NOT authorization]: reopen_interview on an IN_PROGRESS interview
 raises HC038 "apenas entrevistas concluídas podem ser reabertas" — the door''s OWN guard, on a state
 the writable delegate admits. Pins the MESSAGE because 121:294''s existing HC038 arm passes null and
 cannot say which enforcer refused (ADR 0187 D2; C2 BLIND 2026-09-02)'
```

⭐ **`update_interview`** — pin **`HC0B1`**, not `HC038`. Its `HC038` guard fires only for
`completed`/`cancelled`, i.e. exactly the terminal states `assert_interview_writable` is likely to
refuse first (§3.2(a)); `HC0B1` is reachable on any writable interview by passing an out-of-vocabulary
category. Both are anchored, so pinning either flips the verdict (mutation fact #2) — pin the one that
is provably reachable. **This moves the door's D2 sub-label from `lifecycle` to `validation`.**

⚠ **`cancel_interview`** — its only anchored raise is guarded by `status in ('completed','cancelled')`,
which is unreachable if §3.2(a) holds. **If the catalog read confirms `assert_interview_writable`
refuses terminal interviews, this door has no writable keystone target and needs a D3-style ruling
(correct-and-uninteresting BLIND), not a test.** Do not write it before §3.2 resolves.

**Hosts and placement.**
- `121_interviews.sql`, `plan(60)` at **L15**. `reopen_interview` before L256. `cancel_interview`
  (if it survives §3.2) and `update_interview`'s HC0B1 arm in the i1/i3 lane. `cancel_session` per the
  existing design §3.3 (deny after L188 on completed `s1`; allow after L325 on a new `s5`) — **amend
  its description string to carry the D2 label**. `no_show_session` is a one-line twin of that deny
  leg on the same `s1`, exactly as design §3.4 predicted at ~zero cost. `update_session` reuses the
  same completed `s1`.
- `228_ethics_e1.sql`, `plan(136)` at **L26**, new arms beside L710–737 where `iv`, its two sessions,
  its subject/interviewer rows and the two participants are all standing. The four `HC039` legs use
  `claims_for(st_x2, false)`; the allow legs already exist at :710 and :727 for two of the four, and
  the other two need one `lives_ok` + effect `is()` each (they are allowlisted — §6.5).
- `update_interview_subject`: host **228**, not 353. 353's fixture is a *completed, PHI-disposed*
  interview whose child-lock trigger raises `23514` before any door logic — the HC0B2 arm cannot be
  reached there. 228 has a writable interview with a subject row.

**Effort.** LOW for the six 121-lifecycle arms (fixtures standing). LOW–MEDIUM for the four 228
`HC039` arms (`st_x2`'s non-writer status is asserted at 121:331 for a different interview; confirm it
holds for `iv` in 228 — `228:328` and `:443` already claim `st_x2`, so the persona is live there).
**BLOCKED** on `reopen_interview` and `cancel_interview` until §3.2 resolves.

---

### 5.3 Referral — 4 doors (C5: 4/32, 13 % — at the base rate, not clustered)

| door | raises (own body) | class | refs / entered? | existing deny leg on own code | pin |
| --- | --- | --- | --- | --- | --- |
| `reopen_referral` | `42501` *apenas a coordenação da comissão de origem pode reabrir o encaminhamento* · `HC0A5` | **A1** — `app.can_manage_referral_source(p_referral_id, auth.uid())` | 150:988 (allow), 295:489 (allow), 326 (catalog name-list, never entered) | **no** — `HC0A5`'s single suite pin (150:985) is on **`resolve_referral`** | **`42501`** + message |
| `withdraw_referral` | `HC070` *este encaminhamento não pode ser retirado neste estado* · `HC071` *apenas a coordenação da comissão de origem pode retirar o encaminhamento* | **A2** — same predicate | 150:474 (bare allow), 326 (catalog) | **no** — `HC070` pinned 5× and `HC071` 7×, never on this door | **`HC071`** + message |
| `unassign_referral_internal_note` | `42501` *apenas a coordenação desta comissão pode remover o responsável* · `HC0A9` | **A1** — `app.can_manage_referral_internal_note(p_note_id, auth.uid())` | 322:303 (`lives_ok` allow), 326 (catalog) | **no** — `HC0A9` pinned 10× across four sibling doors, never here; `322:313`'s `42501` is on `update_referral_internal_note` | **`42501`** + message |
| `conclude_referral` | `HC074` *desfecho de resposta inválido* · `HC075` *selecione o desfecho da análise para concluir* · `HC075` *descreva o resultado da análise para concluir* | **B / validation** — all three read only params; authority is `app.assert_referral_target_acts`, a delegate | 150:885/1000/1077 (bare allow ×3), 295:463 (`lives_ok`), 326 (catalog) | **no** — `HC074` and `HC075` have **zero** pins suite-wide | **`HC075`** (*descreva o resultado…*) + message |

**Hosts.** `150_referrals.sql` (`plan(218)` at L24, 1629 lines) for `reopen_referral`,
`withdraw_referral` and `conclude_referral` — it already runs the full lifecycle on `r1`, `r6` and
`r8` with `sa_x` (source coordinator) and `sa_y` (target coordinator) both live, which is the exact
persona pair the two authority legs need: call the source-only doors as `sa_y`. `322_referral_registros.sql`
(`plan(63)` at L28) for `unassign_referral_internal_note` — its `note_src` fixture is open and
assigned going into L298, and `st_x2` is already claimed at :311 as the persona who has *lost*
authority, which is the discriminator (a member of this side who is not the coordinator).

`conclude_referral`'s deny leg is a one-liner: on `r6` after `start_referral_review`, call it with
`p_result_md => null` as the same coordinator who succeeds at :885 — reachable because
`response_expected` is true on that referral. Description:

```
'⭐⭐ KEYSTONE [PROPERTY: validation — NOT authorization]: conclude_referral with an empty result_md
 raises HC075 "descreva o resultado da análise para concluir" — ADR 0187 D2: this COVERED is
 VALIDATION coverage. The door''s authorization is app.assert_referral_target_acts, a separate
 worklist row. HC074/HC075 have zero pins anywhere in the suite (C2 BLIND 2026-09-02)'
```

**Allowlist:** `conclude_referral` only (line 79) — ⚠ and that line is probably already stale: the
door is invoked successfully three times in 150, so `pg_stat_user_functions` should record calls.
Check with `ARM=floor` before deciding whether the deletion is a retirement or a correction.

**Effort: LOW ×4, risk LOW.** All four fixtures stand.

---

### 5.4 Patient-safety event & custody — 5 doors

Host `supabase/tests/140_patient_safety.sql` (`plan(35)` at **L17**, 366 lines) for four; event `e1`
starts NSP-held, is transferred to `comm_x` at L192, and `sa_x` becomes its custodian from that point.
`141_event_triage.sql` (`plan(44)` at L19) for the fifth.

| door | raises (own body) | class | refs / entered? | existing deny leg on own code | pin |
| --- | --- | --- | --- | --- | --- |
| `cancel_event` | `HC044` *apenas quem detém a custódia do evento pode cancelá-lo* · `HC043` *este evento já está em um estado final* | **A2** (HC044) / B-lifecycle (HC043) | **zero references** | **no** — 140's single `HC044` pin (:153) and five `HC043` pins (:174, :184, :233, :238, :242) are on `acknowledge_event` and on raw DML against `event_custody` | **`HC044`** + message |
| `transfer_event_custody` | `HC044` *apenas quem detém a custódia do evento pode transferi-la* · `HC043` *um evento encerrado ou cancelado não pode ter a custódia transferida* | **A2** | 140:192 (bare allow), 341:166 (`is()` around a real call — allow) | **no** | **`HC044`** + message |
| `set_event_patient` | `HC044` *apenas quem detém a custódia do evento pode registrar dados do paciente* | **A2** — ⭐ **PHI write door** (`name`, `mrn`, `date_of_birth`, `encounter_ref`, `attending`) | 140:251 (bare allow), 363:222 (catalog `pg_get_functiondef` read, never entered) | **no** | **`HC044`** + message |
| `update_event` | `HC044` *apenas quem detém a custódia do evento pode editá-lo* | **A2** | 140:210 (`lives_ok` allow) | **no** | **`HC044`** + message |
| `reopen_triage` | `42501` *apenas o NSP pode reabrir uma triagem* · `HC045` *apenas uma triagem confirmada pode ser reaberta* | **A1** | 141:277 (bare allow) | **no** — 141's two `HC045` pins (:264, :268) are on `save_triage` and on a raw UPDATE | **`42501`** + message |

⭐ **One persona serves all four `HC044` legs.** `140:216` already claims `sa_y` (a foreign committee's
staff_admin) to assert a zero-row read — but the sharper discriminator for a *custody* refusal is
`st_x`, a plain member of the reporting commission: he clears `app.can_read_event` (so no `P0002`) and
fails **only** at custody, making the refusal attributable to `HC044` alone. This is the design doc
§2.3 persona choice, and it generalises to all four doors in one block.

⛔ **The `P0002` trap applies to all four** (design §2.1): `evento não encontrado` is unanchored, so
the intuitively "most authz-looking" stranger test moves nothing.

**Placement.** One new block in `140_patient_safety.sql` after the PHI-isolation section
(≈L260) and before the flag-gate block at L353, bumping `plan(35)` at L17. `cancel_event` needs
its own hand-rolled event (design §2.3 — `e1` is a live participant in the file's state machine and
cancelling it would pull it out from under later assertions); the other three can use `e1` directly
since their deny legs raise and change nothing. `reopen_triage`'s `42501` leg goes in `141` beside
L277 with a non-PQS persona.

**Effort:** LOW for `transfer_event_custody`, `set_event_patient`, `update_event`, `reopen_triage`
(deny leg only, `e1`/`sentinel_ev` standing, allow legs already present).
**MEDIUM for `cancel_event`** — `BUILD` a two-row fixture, and it is allowlisted so it also needs a
working allow leg plus an effect assertion (design §2.3 specifies both; its `UNVERIFIED` list at §2.4
stands).

---

### 5.5 RCA & CAPA — 5 doors

Hosts `supabase/tests/142_rca.sql` (`plan(36)` at L27) and `143_capa.sql` (`plan(38)` at L22). Both
drive everything as `claims_for(admin, true, 'pqs_member')` — the hat-explicit form (§4.2), because
`admin` holds more than one role.

| door | raises (own body) | class | refs / entered? | existing deny leg on own code | pin |
| --- | --- | --- | --- | --- | --- |
| `add_rca_member` | `HC048` *você não pode editar esta análise de causa raiz* | **A2** — `not (app.is_pqs_operator_of(…) or app.can_write_rca(p_rca_id, auth.uid()))` | 142:90/91 (bare allow ×2) | **no** — `HC048` pinned 3× (142:178 `update_rca`, 341:672 `add_rca_evidence`, 341:688 `complete_evidence_upload_verification`), never here | **`HC048`** + message |
| `submit_rca_for_review` | `HC047` *apenas uma análise em andamento pode ser enviada para revisão* | **B / lifecycle** — `status <> 'in_progress'`; authority is `app.assert_rca_writable`, a delegate | 142:267 (allow), 142:320 (allow), 143:77 (fixture driver) | **no** — `HC047` pinned 6×, never on this door | **`HC047`** + message |
| `reopen_rca` | `HC047` *apenas uma análise concluída pode ser reaberta* | **B / lifecycle** — `status <> 'completed'` | 142:296 (bare allow) | **no** | **`HC047`** + message |
| `reopen_capa_plan` | `HC049` *apenas um plano concluído pode ser reaberto* | **B / lifecycle** — `status <> 'completed'` | 143:211 (bare allow) | **no** — `HC049` pinned 5× (143:200 `add_capa_action`; 353 ×4 on the disposal lock), never here | **`HC049`** + message |
| `add_capa_action_evidence` | `HC0D8` *documento indisponível para esta ação* | **B / validation** — ⚠ `A2/B — needs a ruling`, §1.2 (1) | **zero references** | **no** — `HC0D8` pinned 6×, all on `open_document_version` / `add_rca_evidence` | **`HC0D8`** + message |

⭐ **Three of the five are two-line inversions of an assertion that already exists.** `142:286` pins
`HC047` on `add_rca_factor` against a **completed** RCA; the identical fixture, one line later, gives
`reopen_rca`'s twin — `submit_rca_for_review` on the same completed RCA raises `HC047`
(*"apenas uma análise em andamento…"*), and `reopen_rca` on the **in_progress** `r2` raises the other
`HC047` message. Same for `143:200` (`HC049` on `add_capa_action` against a concluded plan) →
`reopen_capa_plan` on an **in_execution** plan. Pin the messages: both codes carry two distinct
strings across the sibling pair, and a code-only arm cannot tell them apart (§3.3).

`add_rca_member`'s deny leg needs a caller who is neither a PQS operator of the event's hospital nor a
writer of the RCA: `st_x2` in 142's `k` (already used as a plain member at :91). `add_capa_action_evidence`
needs a document that exists and is `active` but is **homed on a different resource** — `BUILD`, and
it is allowlisted, so it also needs a working `document`-kind allow leg (which requires the
`documents_wave_d` flag on — check 143's flag block before placing).

**Placement.** 142: after L291 (the completed-RCA freeze arms). 143: after L200. Bump `plan(36)` at
L27 and `plan(38)` at L22.

**Effort:** LOW ×3 (`submit_rca_for_review`, `reopen_rca`, `reopen_capa_plan`), LOW–MEDIUM for
`add_rca_member` (persona confirm), **MEDIUM–HIGH for `add_capa_action_evidence`** — the only entry in
this cluster with no reference, a `BUILD` fixture on two tables (`documents` + `securable_resources`),
a flag dependency, and an allowlist line to retire.

---

### 5.6 Case narrative — 2 doors

| door | raises (own body) | class | refs / entered? | existing deny leg on own code | pin |
| --- | --- | --- | --- | --- | --- |
| `assign_narrative` | `42501` *sem permissão* · `HC020` · `HC021` *o responsável deve ser membro da comissão* · `HC055` | **A1** — `app.is_staff_admin_of(v_commission)` | 237:131/147 (`throws_ok` **HC0F1** ×2), :163 (`lives_ok`), 189/357 (comments) | **no** — the canonical example: `HC0F1` is `app.assert_not_case_excluded`'s, a separate row. `HC021` pinned 9× and `HC055` once, never here | **`42501`** + message |
| `unassign_narrative` | `42501` *sem permissão* · `HC020` | **A1** — same guard | 237:133/149 (`throws_ok` **HC0F1** ×2), :165 (`lives_ok`), 314:943 (catalog name-list) | **no** | **`42501`** + message |

**Host:** `supabase/tests/237_authz_exclusion_perimeter_u2.sql` (`plan(44)` at L25, 226 lines — a
hermetic world built by `test_helpers.bootstrap()`, every entity made locally). Its §2a already runs
both doors three ways for `sa_x` (recused → HC0F1, respondent → HC0F1, clean → `lives_ok`), so the
allow legs and the narrative fixture `…0c8201`/`…0c8204` are standing. The missing arm is the one
persona §2a never uses on these doors: a **non-`staff_admin`** caller. Add one block with
`claims_for(st_x, false, 'staff')` and both `42501` arms.

⚠ The `42501` check sits **before** `assert_not_case_excluded` in both bodies, so a caller who is both
non-admin and recused would still fail at `42501` — the ordering makes the leg attributable without
extra care, but state it in the description so a later reader does not "fix" it.

**Allowlist:** neither. **Effort: LOW ×2, risk LOW** — two arms in a file whose fixture is already
exactly right.

---

### 5.7 NSP org & PQS roster — 3 doors

| door | raises (own body) | class | refs / entered? | existing deny leg on own code | pin |
| --- | --- | --- | --- | --- | --- |
| `nsp_org_capa_rollup` | `42501` *apenas o administrador de NSP da organização pode ver este relatório* | **A1** | **zero references** | no | **`42501`** + message |
| `nsp_org_roster` | `42501` *apenas o administrador de NSP da organização pode ver a equipe* | **A1** | 189:214 — **allow leg only** (`is()` on `jsonb_array_length` = 2) | **no** | **`42501`** + message |
| `list_hospital_eligible_users_for_pqs` | `42501` *apenas o coordenador do NSP ou o administrador de NSP da organização pode listar os usuários elegíveis* | **A1** — `not (app.is_nsp_org_admin_of(v_org) or app.is_nsp_coordinator_of(p_hospital_id))` | 176:188 (allow leg, `create temp table` from the call), :171 pins `42501` on the **sibling** `list_org_eligible_users` | **no** | **`42501`** + message |

⭐ **ADR 0187 C6 re-confirmed independently.** `189_nsp_per_hospital_isolation.sql` §9 runs three
aggregate reads under `nsporg_a` (L202, L207, L214) and exactly **one** `42501` deny arm, at L223–227
— and its SQL is `public.nsp_org_event_rollup(…)`, not the roster. `nsp_org_roster` is called once, on
the allow leg. The design doc's §1.2 claim that both siblings carry a deny arm is false, and
`nsp_org_roster` being one of the 39 is the direct consequence.

⚠ **That existing deny arm passes `null` for its message** (L226 is a bare `null` on its own line).
Both new arms must pin the string — the two rollups and the roster differ only in the message tail
(*"ver este relatório"* / *"ver a equipe"*), so a code-only arm on either cannot say which door it
measured (§3.3).

**Host and placement.** `189_nsp_per_hospital_isolation.sql`, `plan(53)` at **L33** (the design doc
says L32 — re-derive). Both NSP arms go **inside §9**: allow legs appended after L217, deny legs after
L227, ⛔ **before L235**, where `add_pqs_member(hosp_a2, orgadmin_a)` gives `orgadmin_a` a second live
role and every later 2-arg `claims_for` mints no hat (design §1.3's placement warning — it applies to
`nsp_org_roster` identically). `list_hospital_eligible_users_for_pqs` goes in
`176_nsp_per_org_b_support.sql` (`plan(33)` at L40) beside L188, where `nspcoord_a` already succeeds;
the deny leg needs a persona holding neither `nsp_org_admin` of the org nor `nsp_coordinator` of that
hospital — 176's own sibling arm at :171 uses a rede-a org_admin against rede-b, which is the same
shape one scope down.

**Allowlist:** `nsp_org_capa_rollup` (line **99**) only. Its keystone therefore needs the allow leg
the design §1.3 already specifies.

**Effort:** LOW for `nsp_org_roster` and `list_hospital_eligible_users_for_pqs` (one arm each, into a
standing fixture). LOW–MEDIUM for `nsp_org_capa_rollup` — design §1.3 is complete but its §1.4
`UNVERIFIED` list stands, in particular the hospital count and the `pqs_a` single-role check.

---

### 5.8 Ethics — 2 doors

| door | raises (own body) | class | refs / entered? | existing deny leg on own code | pin |
| --- | --- | --- | --- | --- | --- |
| `app.assert_ethics_typed` | `HC0J0` *ação inválida para o status atual do processo ético* | **B / validation** — ⚠ `A2/B — needs a ruling`, §1.2 (3): guard checks row **existence**, message says *status* | 258:89 — **a comment**, never named by an assertion. Entered transitively via `submit_ethics_appeal` at 258:158 and 267:76, both on the **passing** branch | ⛔ **possibly — CONTRADICTION-1, §3.1** | **`HC0J0`** + **message**, mandatory |
| `submit_ethics_appeal` | `HC0J0` *decisão inválida para este caso* · `HC0J0` *apenas decisões emitidas podem ser objeto de recurso* | **B** — validation + lifecycle; ⚠ `A2/B — needs a ruling`, §1.2 (2). Authority is `app.assert_ethics_coordinator` (HC0J1), a delegate | 258:158 (bare allow), 267:76 (bare allow) | **no** — the seven suite `HC0J0` pins are all on other doors | **`HC0J0`** *apenas decisões emitidas…* + message |

⛔ **Both doors raise `HC0J0`, and so do at least three others** (`create_case_decision`,
`schedule_ethics_hearing`, `target_case_response`). Every existing `HC0J0` pin in the suite passes
`null` for the message. **A code-only keystone on either of these doors is uninterpretable** — it
cannot say which of five enforcers refused. Message-pinning is not a preference here, it is the only
way the assertion has a subject.

**Host:** `supabase/tests/258_ethics_e2_rpcs.sql` (`plan(28)` at L14, 185 lines) for both — it owns
the ethics case `…0e2001`, the non-ethics case `…0e2002`, the decision `de` and the appeal `ap`.

- `submit_ethics_appeal`: after the appeal at L158, the decision is `appealed`; `review_ethics_appeal`
  at L166 then moves it. An arm calling `submit_ethics_appeal` against a decision in a status outside
  `('issued','appealed')` raises the lifecycle `HC0J0`. ⚠ Reaching that state may need a `BUILD` —
  `de` is `issued` then `appealed` and never leaves the allowed set inside this file. Alternative with
  no build: the **first** `HC0J0` arm (a `p_decision_id` belonging to another case) — `255` has a
  cross-case fixture, but importing it into 258 is itself a build. **Flag: MEDIUM, fixture uncertain.**
- `app.assert_ethics_typed`: ⛔ **do not write until §3.1 resolves.** If the catalog read shows
  `create_case_decision` inlines its `HC0J0`, the keystone is `submit_ethics_appeal` called on the
  **non-ethics** case `…0e2002` — which reaches `assert_ethics_typed` at the door's line 3 and raises
  the delegate's message, distinguishable from both of the door's own `HC0J0` strings. That is a
  two-line arm into a standing fixture (**LOW**) *provided* `app.assert_ethics_coordinator` admits the
  caller on a non-ethics case, which is unverified.

**Allowlist:** neither (the allowlist holds `public` doors only; `app.assert_ethics_typed` is out of
its scope, and `ARM=floor` does not ask about it).

---

### 5.9 Meetings / reserved session — 1 door

| door | raises (own body) | class | refs / entered? | existing deny leg on own code | pin |
| --- | --- | --- | --- | --- | --- |
| `add_reserved_item` | `42501` *apenas a coordenação pode editar uma sessão reservada* · `HC032` *o caso pertence a outra comissão* | **A1** — `app.is_staff_admin_of(v_comm)` | 243:240 (`throws_ok` **`23514`**, the distributed-ata lock), :253 (`lives_ok`); 244:65 (`lives_ok`), :69 (`throws_ok` **`HC0F1`**), :76 (bare); 382 (header comment) | **no** — `23514` is unanchored; `HC0F1` is `app.assert_not_case_excluded`'s; the suite's single `HC032` pin (182:245) is on `create_committee_action_item` | **`42501`** + message |

⭐ This door is the densest illustration in the set: it is invoked **five** times, carries **two**
`throws_ok` arms, and is still BLIND — because one arm pins an unanchored trigger code and the other
pins a delegate's code. Grep-positive, `throws_ok`-positive, mutation-blind.

**Host:** `supabase/tests/244_authz_c6_reserved_session_lifecycle.sql` (`plan(7)` at **L9**, 91 lines)
— the cheapest host in the whole set. Its reserved session `…c6b0` is open, `sa_x` authors
successfully at L65, and the file already pins `42501` on the **sibling** `open_reserved_session` at
L44–46 (plain member) and L52–54 (over-granted delegate), so both discriminator personas are minted
and claimed. Add the same two-persona probe pointed at `add_reserved_item` after **L73** (the file's
existing `HC0F1` arm) and before the `reset role` at L80, so `sa_x`'s claims are still standing.

**Allowlist:** no. **Effort: LOW, risk LOW** — the smallest file, fixture and personas standing, and a
sibling arm to copy verbatim.

---

## 6 · Summary

### 6.1 Adjudicated counts

**A1 = 12 · A2 = 13 · B = 14 (lifecycle 9, validation 5) · total 39.** Derived by the §1 caller-input
rule from the pre-sweep `pg_get_functiondef` snapshot. This reproduces ADR 0187 D-M2's 12/13/14
independently. The broader regex's 12/18/9 is wrong by **5 doors**, all over-called A2 on `apenas`
governing an object (§1.1).

### 6.2 Doors needing a PO ruling — 3

The ruling asked for is on the **§1 rule itself**, since it is what decides these three against a
message-text reading. All three are provisionally **B** (the conservative call, because D2's label is
what prevents promotion):

1. `public.add_capa_action_evidence` — `HC0D8`, a cross-resource document-home check with no caller
   input. Isolation property, validation guard.
2. `public.submit_ethics_appeal` — `HC0J0` #1, a cross-case decision reference with no caller input.
3. `app.assert_ethics_typed` — `HC0J0`, whose **message contradicts its own guard** (says *status*,
   checks row existence).

### 6.3 Doors with no pgTAP invocation — 8 (+1)

| door | mechanism |
| --- | --- |
| `public.nsp_org_capa_rollup` | no mention anywhere |
| `public.cancel_event` | no mention anywhere |
| `public.add_capa_action_evidence` | no mention anywhere |
| `public.cancel_session` | `121:381` t19 `has_function_privilege` only |
| `public.update_session` | `121:372` t19 only |
| `public.update_interview` | `121:360` t19 only |
| `public.set_interview_subject_participant` | `228:670/675` t19 only |
| `public.set_interview_interviewer_participant` | `228:671/676` t19 only |
| *(+1)* `app.assert_ethics_typed` | named only by a comment (`258:89`); entered transitively, never on its failing branch |

⛔ **ADR 0187 D-M1's "36 of 40 already invoked, only four with zero references" over-counts by 5** and
should be corrected to **31 of 39 invoked**. The mechanism is the one the existing design's §4.3
predicted in writing: the enumeration is bounded by *the name appearing* rather than *the function
being entered*, and `cancel_session` — §4.3's own worked example — sits inside D-M1's "36".

### 6.4 Contradictions — 2

| door | the pin | why it should already be COVERED | resolve with |
| --- | --- | --- | --- |
| `public.reopen_interview` | `121_interviews.sql:292-294`, `throws_ok … 'HC038', null` **on the door itself** | `HC038` is its only anchored raise and is in its own body | read `app.assert_interview_writable`'s body; then `CASES=public.reopen_interview` |
| `app.assert_ethics_typed` | `258:92`, `256:118`, `255:137` — three `HC0J0`, `null`-message pins on non-ethics cases | `HC0J0` is its only anchored raise | read `create_case_decision` / `schedule_ethics_hearing` / `target_case_response` for an inline `HC0J0` |

Shared mechanism: **a `null`-message `throws_ok` on a code more than one enforcer in the chain raises**
(§3.3). ⛔ Neither keystone may be written before its read; both may be work against a wrong verdict.
`public.cancel_interview` is a downstream casualty of §3.2 — if branch (a) holds, its only anchored
raise is unreachable and it needs a D3-style ruling rather than a test.

### 6.5 Allowlist lines owed for deletion — 10

`supabase/tests/mutation/authz-neverclled-door-allowlist.txt`, to be deleted **in the same commit as
the door's keystone**, each of which therefore needs a **working ALLOW leg plus an effect assertion** —
a deny-only keystone leaves the door at 0 recorded calls and `ARM=floor` still reds (the file's own
⚠ header, and the `rca_writer_can_write` / `142_rca.sql §K` retirement precedent).

| line | entry | class |
| ---: | --- | --- |
| 47 | `add_capa_action_evidence(p_action_id uuid, p_kind text, p_title text, p_document_id uuid, p_external_url text)` | B/validation |
| 73 | `cancel_event(p_event_id uuid)` | A2 |
| 74 | `cancel_session(p_session_id uuid, p_reason text)` | B/lifecycle |
| 79 | `conclude_referral(p_referral_id uuid, p_reply_outcome_id uuid, p_result_md text, p_acknowledged_only boolean)` | B/validation — ⚠ line probably already stale (invoked successfully 3× in `150`) |
| 99 | `nsp_org_capa_rollup(p_org_id uuid)` | A1 |
| 127 | `set_interview_interviewer_participant(p_interviewer_id uuid, p_participant_id uuid)` | A2 |
| 128 | `set_interview_subject_participant(p_subject_id uuid, p_participant_id uuid)` | A2 |
| 140 | `update_interview(p_interview_id uuid, p_title text, p_case_phase_id uuid, p_interview_category text, p_confidentiality_level text)` | B/validation (pin HC0B1) |
| 142 | `update_interview_subject(p_subject_id uuid, p_clinical_role text, p_note text, p_external_name text, p_external_org text, p_relationship_to_case text)` | B/validation |
| 147 | `update_session(p_session_id uuid, p_session_type text, …, p_meeting_url text)` | B/lifecycle |

⚠ **Nine of the ten are also in §6.3's not-invoked set or need a built fixture** — the allowlist entry
and the blindness are the same fact, which is `allowlisting-a-door-as-e2e-only-is-what-makes-it-blind`
holding across the set rather than in one instance.

### 6.6 Batching, by cluster

| # | cluster | doors | host file(s) | effort | blocked? |
| ---: | --- | ---: | --- | --- | --- |
| 1 | Correction workflow | 6 | `264` | LOW ×6 | no |
| 2 | Interview + session | 11 | `121`, `228` | LOW ×6, LOW–MED ×4, blocked ×2 | ⛔ `reopen_interview`, `cancel_interview` on §3.2 |
| 3 | Referral | 4 | `150`, `322` | LOW ×4 | no |
| 4 | Event & custody | 5 | `140`, `141` | LOW ×4, MED ×1 (`cancel_event` BUILD) | no |
| 5 | RCA & CAPA | 5 | `142`, `143` | LOW ×3, LOW–MED ×1, MED–HIGH ×1 | no |
| 6 | Case narrative | 2 | `237` | LOW ×2 | no |
| 7 | NSP org & PQS | 3 | `189`, `176` | LOW ×2, LOW–MED ×1 | no |
| 8 | Ethics | 2 | `258` | MED ×1, blocked ×1 | ⛔ `assert_ethics_typed` on §3.1 |
| 9 | Meetings | 1 | `244` | LOW ×1 | no |

**Recommended order:** 9 → 6 → 1 → 3 → 5 → 7 → 4 → 2 → 8. Cluster 9 is a single arm in a 91-line file
with a sibling to copy — the cheapest possible proof that the whole mechanism works end to end
(keystone red under mutation, green clean) before spending on the expensive rows. Clusters 2 and 8 go
last because their two catalog reads (§3.1, §3.2) can be batched with whatever else needs the DB.

### 6.7 Before any of this lands

- ⛔ **Nothing under `supabase/tests/**` may be touched while a sweep runs** — it voids the baseline
  (design doc's second header block). All 39 keystones and all 10 allowlist deletions land after.
- The suite's shape changes (`Files`/`Tests`), which is harmless between runs and fatal to an
  in-flight one.
- Re-run `CASES="…"` per cluster to confirm BLIND → COVERED; a subset run writes to `$WORK` and the
  rows are merged into `docs/reviews/c2-command-door-findings.md`, never copied over it (ADR 0153).
- Phase-gate arms that must follow: `ARM=census`, `ARM=floor` (its offender list changes by up to 10),
  `ARM=hat`, `FROMFINDINGS=1 ARM=wrapper`.
- Every gate record citing this work carries the verbatim sentence **"Tier 2's 190 doors stay deferred
  by ADR 0171 and are NOT cleared"**, the corrected tally 109/40/22, and the D2 label split
  (ADR 0187 D1 and its Consequences).
