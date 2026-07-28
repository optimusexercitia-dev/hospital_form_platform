# FF-3 — Validation Engine (`item_validations`) · QA Review r1

**Verdict: ⛔ CHANGES REQUESTED**

**Reviewer:** `qa` · **Date:** 2026-07-28 · **Branch:** `ff/flexible-forms-program` @ `fa01f76`
**Contract audited against:** ADR [0090](../decisions/0090-ff3-validation-engine.md) (incl. Amendments 1–3,
O-1…O-6) · [docs/plans/flexible-forms-program.md](../plans/flexible-forms-program.md) §3 FF-3 ·
ARCHITECTURE Rules 1/3/5/7/9/11/12 · CLAUDE.md §6/§8.

**Tally: 1 BLOCKING · 4 MAJOR · 6 MINOR · 5 INFO.**

The single blocking item is a **named ADR deliverable that is not built** — not a defect in what was
built. Everything shipped is of high quality: of the twenty-three mutation proofs this phase claims,
**every one I re-ran went red exactly as claimed**, both drift detectors are real and I executed them,
and the door-parity table is genuinely proven against the catalog rather than asserted. The four MAJORs
are all *coverage or render-path* gaps, not live security holes — I proved each one's underlying
behaviour is correct today, which is precisely why nothing caught them.

---

## 0 · How this review was conducted

Everything below was **executed**, not read. Migration text was never trusted (CLAUDE.md §graphify
exception); every schema/RLS/RPC claim comes from `pg_proc` / `pg_policies` / `pg_constraint` /
`pg_class.relacl` on the live local stack, read after a clean `supabase db reset`
(**224 registered == 224 files**, `docker inspect` health = `healthy`).

**Gate step 1, re-run by me from a fresh reset — all green:**

| gate | result |
|---|---|
| `supabase db reset --local` | clean · 224 == 224 · healthy |
| `npm run test:db` (pgTAP) | **141 files / 4160 tests / PASS** |
| `npm run test` (Vitest) | **47 files / 800 tests / pass** |
| `npm run typecheck` | 0 |
| `eslint --max-warnings=0` (`src`, `e2e`) | 0 |
| `scripts/check-tailwind-css-vars.mjs` | 0 |
| `npm run build` (`next build`) | ✅ compiled, route table emitted |

`next build` was run deliberately: this repo's own scar list records that a client component
value-importing a server query module aborts the build while tsc/lint/Vitest all pass (BUG-FBE-005).
It does not abort. The client-safe split is real (§5.4).

**Mutation method.** I captured each function's live `pg_get_functiondef`, applied a one-point
mutation via `CREATE OR REPLACE`, re-ran `274` + `275` + `272` + `270` + `209` + `271`, recorded the
reds, and restored byte-for-byte. Every mutation was checked for being a genuine no-op before it ran
(one of mine was — see M9 vs M9b below, which is itself a finding about how a "proof" can prove the
wrong thing). Final state after all 23 mutations: **0 red**, tree `git status` clean, `pgtap`
extension dropped again so a later `gen:types` is not polluted.

---

## 1 · BLOCKING

### B-1 · There is no `enable_item_validations` migration — FF-3 ships **dark** to remote

**Requirement violated:** ADR 0090 front matter — *"**Flag:** `item_validations` (seeded OFF; flipped
by its own enable migration **at the FF-3 gate**)."* We are at the FF-3 gate. It does not exist.

**Evidence (filesystem + catalog):**

```
$ ls supabase/migrations/ | grep -i enable
20260713000400_enable_controlled_docs.sql
20260715000300_enable_administrativo.sql
20260822000000_enable_case_custom_fields.sql
20260824000000_enable_cases_bulk_create.sql
20260825000600_enable_case_corrections.sql
20260828000900_enable_repeating_groups.sql      <- FF-1
20260830001200_enable_matrix_fields.sql         <- FF-2
                                                <- FF-3: absent
```

FF-3's eight migrations are `20260901000000`–`…000700`; none touches `app.feature_flags`. The flag is
`true` locally **only** because `supabase/seed.sql:2125` sets it:

```sql
update app.feature_flags set enabled = true where key = 'item_validations';
```

`seed.sql` is applied by `db reset`, which is destructive and will not be run against the
data-bearing pilot database. `db push` therefore deploys the entire phase with the flag **off**.

**Concrete failure scenario on remote after `db push`:** `set_item_validations` raises `HC0Q0` for
every author; `required_if` is passed as `null` in **all four** required-ness traversals
(`submit_response` ×2, `app.response_required_complete` ×2 — the `case when v_validations_on then …
else null end` guard); `get_response_validation_errors` returns the empty set. And because
`app.assert_item_bounds` still raises `HC061` regardless of the flag, **Amendment 1's contract
inverts on remote**: a submit is refused while the error list the wizard reads is empty — "blocked,
with nothing shown", the exact failure Amendment 1 was written to close.

**This is not a new class of miss.** It is verbatim FF-2 r1's blocker **B-3**
([ff-2-review.md](ff-2-review.md)), and the memory note *"no `enable_<flag>` migration = phase DARK
after `db push` while local stays green"* was written from it. `docs/backend-state.md:312` records the
gap honestly — *"gate-flip migration **NOT WRITTEN YET**"* — so this is a known, unbuilt deliverable
rather than a hidden one. It is one file; it is also the difference between the phase shipping and the
phase being inert in production, and FF-3 gates the pilot deploy.

**Required:** land `20260901000800_enable_item_validations.sql` and prove it flips the flag
**independently of the seed** (set `enabled = false`, replay the migration alone, assert `true`) —
the same proof FF-2 was required to produce.

---

## 2 · MAJOR

### M-1 · `submit_response`'s **repeating-group** `required_if` arm has zero test coverage

**Requirement:** ADR 0090 ruling 4 + O-6 — *"FF-3 added `required_if` to both correctly, and §N now
covers **both** sites."* · *"Whoever changes required-ness must change both."* · plan §3 FF-3:
*"`required_if` in `app.response_required_complete`/`submit_response` … incl. per-instance via FF-1's
map."*

I mutated the `required_if` input at each of the four SQL required-ness sites independently and ran
the six-file suite. The result:

| site | mutation | reds |
|---|---|---|
| `app.response_required_complete` FLAT | `case when v_validations_on then i.required_if …` → `null` | **4** — D2, D3, N2, N3 |
| `app.response_required_complete` GROUP | `… c.required_if …` → `null` | **2** — D6, N7 |
| `public.submit_response` FLAT | `… r_item.required_if …` → `null` | **1** — N4 |
| **`public.submit_response` GROUP** | `… r_child.required_if …` → `null` | **0 — nothing goes red** |

`submit_response` is the Rule 3 submission **authority**. Its per-instance `required_if` layer
(`pg_proc`, `submit_response` ~L167) can be deleted outright and the entire pgTAP suite stays green.
§N's group-arm assertions (N7, N8) and §D-group's (D6, D7) all exercise
`app.response_required_complete`; **none reaches `submit_response`'s group arm.** The ADR's
keystone-4 promise is met for the *dispatch* — it is the *authority* whose group arm is uncovered,
which is the more consequential of the pair.

**The code is correct today.** I proved it with a probe built on 274's own §D-group fixture:

```sql
-- state = D6's: instance b1 has c_flag='sim' so c_reqif is required there and is UNANSWERED
select throws_ok(
  $$select public.submit_response('ff300000-0000-0000-0000-0000000000a2')$$,
  'HC011', null,
  'QA-P1. submit_response BLOCKS on a per-instance required_if (submit GROUP arm)');
```

→ `ok 51` unmutated; → `not ok 51` with the group-arm `required_if` neutralised. **Mutation-proven
non-vacuous in both directions.** The fix is that one assertion added to §N or §D-group.

**Why it matters:** a fail-open here means a response with an unanswered per-instance `required_if`
item reaches `submitted` — immutable, counted in dashboards — while the completeness dispatch (which
only drives UI state) still says "incomplete". Exactly the shape of "a declared branch nobody
reaches", except here it is reached at runtime and observed by nothing.

### M-2 · The FF-3 read path's **only authorization gate** is neutralization-blind (ADR 0079)

**Requirement:** ARCHITECTURE Rule 1 + ADR [0079](../decisions/0079-authz-door-blindness-standing-invariant.md)
— an authz gate no keystone exercises is door-blindness, and the standing invariant exists so it
"cannot silently recur".

`app.response_validation_errors(uuid)` is **`prosecdef = true`** (verified in `pg_proc`), so it
bypasses RLS entirely. The public wrapper `public.get_response_validation_errors(uuid)` is
**`prosecdef = false`**, and its entire boundary is one invoker-side existence check:

```sql
-- public.get_response_validation_errors, live body
if not exists (select 1 from public.responses r where r.id = p_response_id) then
  return;
end if;
```

**Mutation M20** — delete those three lines → **0 red across `274`/`275`/`272`/`270`/`209`/`271`.**
The gate that stands between an authenticated user and *every response in the platform* is observed
by no test.

**What it protects, proven live.** Probe on 274's §E fixture, `st_y` = a `staff` of commission **Y**
only, reading a commission-**X** response:

| | QA-P2a (baseline: violations exist) | QA-P2b (outsider reads 0) |
|---|---|---|
| gate present | `ok` | `ok` |
| gate removed | `ok` | **`not ok` — `have: 1`** |

The leaked payload is `(item_id, group_instance_id, rule_id, rule_type, severity, message)` — the
author's pt-BR rule text and, via the folded-in bounds lane, **item labels**
(`'a pergunta "%s" exige ao menos %s caractere(s)'`). Cross-commission, cross-org. **No PHI** (Rule 12
is untouched — §5.5), but it is form content across a tenancy boundary.

The standing sweep does not see this by its own scoping: `supabase/tests/mutation/p0-authz-invariant.sh`
ARM 2 floors `authenticated`-reachable **`prosecdef = t`** public doors, and this wrapper is
`prosecdef = f`; the DEFINER half lives in `app`, which is not PostgREST-exposed. So the gap is
structural, not an oversight of the sweep — which is exactly why FF-3 owed it a keystone of its own.

**Required:** one assertion in `274` in the shape of `272` §S — assert **rows read** under
`set local role`, with the existing member read as the control.

### M-3 · The regex arm is un-mirrorable, and the client twin is a **hard navigation gate** — reachable dead end

**Requirement:** ARCHITECTURE Rule 3 (evaluator mirrored SQL ↔ TS) + ADR 0090 ruling 3 — *"The wizard
renders inline feedback from the TS twin, live. **This is UX, not the boundary** — the server is the
authority (Rule 1)."*

Two facts combine badly.

**(a) The two engines are different dialects, and nothing constrains the pattern to their
intersection.** Server: `v_text ~ (p_config ->> 'pattern')` (Postgres ARE). Client
(`src/lib/forms/validation-rules.ts:310-318`): `new RegExp(spec.config.pattern, …)`. Verified
empirically just now:

```
PG:  select '123' ~ '^[[:digit:]]{3}$'                    -> true
     app.is_valid_validation_config('regex', …)           -> true   (storable)
JS:  new RegExp('^[[:digit:]]{3}$').test('123')           -> false
```

`app.guard_item_validation_row`'s write-time probe only checks the pattern compiles **in Postgres**;
`validateRuleDraft` (`src/components/forms/validation-drafts.ts:267-273`) only checks it compiles **in
JS**. A POSIX bracket expression passes both and then *behaves differently*. The builder's hint
(`validation-rules-editor.tsx:321-325`) says nothing about dialect; ADR 0090's own rule table
advertises the type as *"POSIX `~` / `~*`"*, which is an invitation to write exactly this.

**(b) `handleNext` blocks on client-computed errors** — `wizard-client.tsx:908-921` merges
`liveFeedback.errors` into the blocking map and `return`s **without persisting or navigating**. Every
forward path goes through it; there is no route to the review screen that skips it.

**Failure scenario:** a `staff_admin` authors `regex` `^[[:digit:]]{3}$` with message *"Informe 3
dígitos."*. A filler types `123` — valid to the server. The TS twin says violated, `handleNext`
refuses to advance, and the field can never be cleared. The response is **unsubmittable through the
UI**, with no server recourse, until a `staff_admin` edits the rule. (`handleSaveAndExit`,
`wizard-client.tsx:958-982`, runs no validation, so the answers are not lost.)

**This is also a topology deviation in its own right.** Ruling 3 is titled *"`error` blocks **submit
only**, server-side"* and calls the client twin UX. The implementation makes it a hard client-side
gate on navigation. That is defensible UX *while the mirror holds* — but the regex arm is the one arm
that cannot hold, and the implementation gives it the same blocking power as the arms that can.

**Required (pick one, all cheap):** exclude `regex`-sourced errors from the `handleNext` blocking set
(leaving them advisory, per ruling 3's stated topology); **or** reject non-intersection syntax at
write time (a POSIX-class / dialect lint in `is_valid_validation_config` or the trigger); **or** state
the supported subset in the builder hint *and* record the divergence as an ADR consequence. At
minimum the divergence must stop being invisible — it is currently documented only in a code comment
(`validation-rules.ts:279-283`) and appears nowhere in ADR 0090.

### M-4 · `GroupBlock` never receives FF-3's two new props — plain-`group` children render stale

**Requirement:** ADR 0090 ruling 3 (*"The wizard renders inline feedback … live"*) · the lead's
in-scope marker ruling recorded in PROGRESS.md (*"effective required-ness … resolved ONCE … across all
10 item types"*) · CLAUDE.md §8 (*"Every form input accessible"*).

The walk computes everything correctly for plain-group children — `validation.ts:266-268` flattens
them into the same pass:

```ts
const flat = section.items.flatMap((item) =>
  item.itemType === "group" ? item.children : [item],
);
```

`section-step.tsx:320-321` forwards both new props for **top-level** items:

```tsx
warning={answerable ? warnings?.[item.id] : undefined}
requiredNow={requiredNow?.has(item.id)}
```

`repeating-group-block.tsx:409` forwards `requiredNow` for **repeating-group** children. But
`section-step.tsx:246-256` renders `<GroupBlock>` with `item, imageUrls, answers, matrixCells,
riskMatrix, errors, visibleItemIds, handlers` — **no `warnings`, no `requiredNow`** — and
`group-block.tsx:26-46` accepts neither, so its `BlockRenderer` call (`:89-109`) forwards neither.

**Two consequences on a whole containment class (ADR 0087 ruling 6 plain groups):**

1. **A `required_if`-required item inside a plain group announces itself as optional during fill** —
   no `*` marker, no `aria-required` (both fall back to static `item.required`) — while it *does*
   block `handleNext` and *does* raise `HC011` at submit. This is the harmful direction of the exact
   argument the lead used to rule the marker fix in scope (*"an item mandatory only through
   `required_if` showed no marker and announced itself as optional"*), missed on one path. It is also
   an a11y defect: assistive tech is told optional about a field that blocks.
2. **A `warn`-severity rule on a plain-group child is evaluated and never rendered inline** — it only
   surfaces later, aggregated, on the review screen. Ruling 3's inline-feedback promise is not kept
   for this containment.

The review screen *does* thread `requiredNow` through group blocks, so **fill and review visibly
disagree** for this one case — contradicting the stated intent at `wizard-client.tsx:788-791`.

I verified this by reading `group-block.tsx` and `section-step.tsx` directly, not from a summary.

This is the **fourth instance in FF-3 of the phase's signature family** — after the `isInputItem`
walk gate (2 item types), the `DateTimeItem` TIME branch (1 of 7 controls), and the ninth render path.
`backend`'s formulation applies verbatim: *the specification named one artifact while reality had
two.* The enumeration that was done — by **item type** — was correct and complete; the axis that was
never enumerated is **containment context** (top level · plain group · repeating-group instance ·
review), and the plain-group column is empty.

---

## 3 · MINOR

- **m-1 · The error-surface walker's own visibility guards are unkeystoned.** Mutations M21
  (`app.response_validation_errors` section-visibility `continue`) and M22 (its flat-arm item-visibility
  `continue`) each produce **0 red** across all six files. Failure mode is bounded — `submit_response`
  deletes hidden answers *before* calling the walker, so the gate cannot be affected — but during fill
  the wizard would surface unfixable messages for fields the user cannot see. ADR ruling 4 says the
  deadlock-negative property "gets keystones in both arms"; it has them in the dispatch (D4, N5 — I
  re-proved both, M1 → 2 red) and none in the walker.
- **m-2 · No group-arm hidden+`required_if` deadlock-negative.** Neutralising
  `app.eval_visibility(c.visible_when, v_imap)` in the dispatch's group arm reds exactly **one**
  assertion, and it is FF-1's `270` **H3** (*"two non-empty instances satisfy minInstances"*) — an
  incidental hit under an unrelated name. The property is structurally safe (SQL `AND`-conjunction, so
  `required_if` cannot resurrect a hidden child), which is why I grade this MINOR rather than MAJOR —
  but the ADR claims the negative is proven "in both arms" and in the group arm it is not.
- **m-3 · Golden-vector coverage gaps in the `eval_validation` mirror.** The wrong-type early return
  is vectored for `number_range` / `text_length` / `regex` but **not** for `date_range` or
  `datetime_order` (no vector uses a non-string value, or a non-string *sibling*). And the
  unknown-`rule_type` arm diverges silently: SQL `raise exception`, TS falls out of an exhaustive
  `switch` returning implicit `undefined`. Unreachable from a stored row (the `rule_type` allowlist
  CHECK pins the vocabulary, verified in `pg_constraint`) and TS fails *closed* (`undefined` is falsy →
  reported as a violation), so this is coverage hygiene, not a live risk.
- **m-4 · No Rule 11 keystone on the writer.** `grep -n "audit" supabase/tests/274_ff3_validations.sql`
  → 0 hits, while the plan's FF-3 scope says *"writer `set_item_validations` (draft-only, **audited**)"*.
  The behaviour is correct — I proved it live rather than reading the `perform app.audit_write(...)`
  line (probe QA-P4: `set_item_validations` → `audit_log` row with
  `action='form_item_validations.set'` → `ok`) — but a regression would be invisible.
- **m-5 · Two a11y gaps in the new authoring controls.** (a) `validation-rules-editor.tsx:305-317` —
  the `regex` pattern `<Input>` has **no `<label>`**; it relies on `<fieldset><legend>Padrão</legend>`
  for its accessible name while every other field in the same file uses an explicit or wrapping
  `<label>`. (b) `validations-dialog.tsx:78-92` — pre-save errors surface as a single `role="status"`
  banner naming the offending rule by ordinal (*"A regra 2 precisa de…"*) with no
  `aria-describedby` / `aria-invalid` on the offending field, so a screen-reader user must hunt for
  "Regra 2".
- **m-6 · `set_item_validations` does not validate `position`.** The entry-shape check requires
  `position` to be a number but never checks it is a non-negative integer or unique within the item, so
  `[{position: -1}, {position: -1}]` stores. Ordering falls back to `order by v.position, v.id`, so the
  effect is only non-deterministic-looking rule order in the editor. Cosmetic.

---

## 4 · INFO

- **i-1 · The vectors fixture's own `_comment` is stale in three places**, and it is embedded verbatim
  into `275_condition_validator_parity.sql:36-58` — so the stale text is in the pgTAP file too. It
  names the TS twin as `src/lib/forms/actions.ts` (it is `src/lib/forms/condition-shape.ts`; `actions.ts`
  only imports it) and the Vitest file as `condition-validator-parity.test.ts` (no such file; it is
  `condition-shape.test.ts`). It also states *"There is currently **ONE** such case"* of TS-only
  narrowing while `condition-shape.test.ts:85-96` enumerates **three**. Inert text, but this repo's
  standing lesson is that a reader trusting a file's self-description goes to the wrong place.
- **i-2 · PROGRESS.md:302-303 is stale.** It records *"Adjacent, NOT fixed: `HC0N5` … still falls to
  `MESSAGES.generic` in both submit switches."* It was fixed afterwards in `6196b16`
  (`fix(ff-1): map HC0N5 (min instances) in both submit switches`), which is an ancestor of `fa01f76`;
  `HC0N5` is mapped in both `submitResponse` and `submitCasePhaseResponse`
  (`src/lib/responses/actions.ts:817`). Update or strike the note.
- **i-3 · `app.response_validation_errors` has `proacl = NULL`** (⇒ `EXECUTE` to `PUBLIC`) and
  `authenticated` holds `USAGE` on schema `app`. It is **not** reachable — `config.toml:13` exposes
  only `public` + `graphql_public` to PostgREST — and **130 of 281** `app` DEFINER functions share this
  posture, so it is a pre-existing platform-wide convention, not FF-3's doing. Recorded because M-2's
  gate is what stands between it and a leak if that convention ever changes.
- **i-4 · The `e_rule_id is not null` filter in `submit_response`'s gate is genuinely unobservable.**
  Mutation M7 (remove it) → 0 red, exactly as the code comment predicts, because
  `app.assert_item_bounds` has already raised `HC061` inside the loop. This is **honest
  self-documentation**, the opposite of a vacuous keystone, and it is the right way to record a guard a
  test cannot see. Noted as a positive.
- **i-5 · One of my own mutations proved the wrong thing, and it is worth recording.** M9 removed the
  outer `coalesce(…, false)` from `app.validation_rule_allowed` — the guard whose absence caused the
  phase's first fail-open — and produced **0 red**. It was not evidence of a vacuous keystone: the body
  also carries `p_parent_item_type is not null and …`, which makes it total independently, so my
  mutation removed the belt while the brace held. Removing **both** (M9b) reds **B8** on the nose.
  Belt-and-braces is correct here; the transferable point is that a mutation must be verified to
  actually reintroduce the defect, not merely to change the text.

---

## 5 · What I checked and found **sound**

This section exists so the coverage of the review is legible, not just its output.

### 5.1 Mutation proofs re-run (all held)

Every claimed proof I re-ran produced the predicted reds, restored byte-for-byte, final suite 0 red:

| # | mutation | reds |
|---|---|---|
| M1 | dispatch flat-arm `eval_visibility(i.visible_when)` → `true` | D4, N5 (+N8 collateral) |
| M5a | `submit_response` FLAT `required_if` → `null` | N4 |
| M5c | dispatch FLAT `required_if` → `null` | D2, D3, N2, N3 |
| M5d | dispatch GROUP `required_if` → `null` | D6, N7 |
| M6 | drop `ve.e_severity = 'error'` from the submit gate | E5 |
| M9b | reintroduce the three-valued defect in `validation_rule_allowed` | B8 |
| M11 | disable the whole `HC0P9` gate | E1 |
| M12 | pass `'[]'::jsonb` as `p_peer_values` in the walker's group loop | I2, I3 |
| M13 | drop the unary `value` exemption from `is_valid_condition` | H3, H4, **275 V1** |
| M14 | drop `contains`/`not_contains` from the operator allowlist | H1, H2, **275 V1** |
| M15 | drop the `form_item_validations` block from `copy_version_children` | G1, G2, G3 |
| M16 | stop copying `required_if` in the clone | G4 |
| M23 | empty `app.item_bound_violations` | J1, J2, J3 |
| M8a | `drop policy form_item_validations_staff_admin_write` | C3, C4 |
| M8b | `drop policy form_item_validations_select_targeted` | C2, C4, **272 S2** |
| M8c | `grant insert, update, delete … to authenticated` | B2, B3, C5, **209 C17** |

Two observations worth carrying forward. **M8b reds `272` S2** — an assertion that reads *rows* under
`set local role`, not a policy's existence — which is the ETH·E1 lesson correctly applied; `274` §C
alone could only have proven the policy exists. **M8c reds B3** as well as B2: with the grant widened,
a `staff_admin` *can* insert directly, which proves the ADR's claim that K9 holds **by privilege, not
merely by policy** is literally true, and that `form_item_validations_staff_admin_write` is inert
today. (I also confirmed analytically that the `FOR ALL` policy does not widen *read* access — a
`FOR ALL` policy is a read policy in this repo's convention — because `app.is_staff_admin_of` is
`has_role(…, 'staff_admin', …)`, a strict subset of the base arm's `has_role_any`.)

### 5.2 Door parity — verified against the catalog, not the ADR

`pg_policies` + `pg_class.relacl`, read live:

| shape | `form_item_options` | `form_matrix_rows`/`_columns` | `form_item_validations` |
|---|---|---|---|
| base member/admin SELECT | ✅ | ✅ | ✅ |
| `can_access_targeted_version` | ✅ own policy | ✅ OR-arm | ✅ **own policy (FF-3)** |
| `staff_admin` FOR-ALL write | ✅ | ❌ none | ✅ **(FF-3)** |
| `authenticated` grant | `arwdDxtm` | **`r`** | **`r`** |

ADR 0090 §6's in-place **Correction** is accurate: the matrix tables carry no write policy, and FF-3
correctly took the *tighter* grant posture. `C4` is a sibling **diff** assertion rather than a fixed
list, so a future arm added to `form_item_options` alone reds it — the right shape.

On the "correction arm" half of FF-2's hand-forward: no definition-side table carries a
`can_read_correction_response` arm (that arm lives only on `answers`, `answer_selected_options`,
`answer_matrix_cells`, `answer_risk_matrix`, `responses` — confirmed by scanning `pg_policies` for
`%correction%`). `form_item_validations` therefore matches its siblings exactly; nothing is owed.

I additionally probed the persona FF-3 did not build for: a **targeted respondent** (`st_y`, member of
commission Y only) on 272's fixture can call `public.get_response_validation_errors` on their own
targeted response and the wrapper's RLS gate does see the response (QA-P3a/QA-P3b both `ok`). The
FF-2 trap — *a writer door narrower than the sibling policy* — does not bite here.

### 5.3 The two mirror pairs

**Validator pair** (`app.is_valid_condition` ↔ `isValidCondition`), the fix for BUG-FF3-002: the
allowlists are identical and in the same order — 11 operators in `condition-shape.ts:37-49`, the same
11 in the live `pg_proc` body, and the same 11 in the `ConditionOp` union
(`src/lib/queries/conditions.ts:41-52`). 27 vectors in
`src/lib/queries/__fixtures__/condition-validator-vectors.json`.

**Both drift detectors are real and were executed, not read.**
`condition-shape.test.ts:104-119` and `validations.test.ts:77-99` each read the `.sql` file off disk,
slice the `$vectors$` literal, and `expect(JSON.parse(embedded)).toEqual(JSON.parse(fixture))`. The
embedded blob was independently extracted and compared: it deep-equals the fixture (raw text differs by
one trailing newline, which is why the test parses rather than string-compares). Editing either copy
alone goes red under `npm run test`, which is in the gate. Both pgTAP files also carry a
non-vacuity floor (`V2`: `count >= 25`; `A2`) and a coverage assertion (`V3`: every accepted operator
has ≥1 vector; `A3`: all six rule types exercised).

**The "TS-only narrowings" block is honest.** `condition-shape.test.ts:75-97` enumerates three, and I
checked each for direction: blank `question_key` (SQL's `jsonb_typeof(… ) = 'string'` accepts `""`;
TS refuses), `in` with a non-array value, and an ordered op with an array value. In all three TS
accepts a strict **subset** of SQL — the safe direction — and each is backstopped by an independent
publish-time rejection in `app.assert_condition_op_target`. **No fourth, undocumented narrowing exists,
and nothing was parked there in the dangerous direction** (TS accepting what SQL rejects). The block is
doing its job: keeping the shared vectors a pure mirror.

**Evaluator pair** (`app.eval_validation` ↔ `evalValidation`), 40 vectors: I checked the six
divergence traps that matter most. The empty-value set matches exactly ({`null`, JSON null, `""`,
`[]`} — critically, `0` and `false` are **not** empty on either side, and a vector pins the `0` case).
`text_length` uses `[...text].length`, code points, matching Postgres `char_length` — and there is a
load-bearing astral vector (`"😀"` with `{max:1}` → satisfied) that would flip if it regressed to
`.length`. `unique_within_group` uses structural `jsonEquals`, with a vector that a regression to
`===` would flip and a second pinning array-order sensitivity. Only the regex arm diverges, which is
M-3.

### 5.4 Rules 5 / 7 / 9 / 11 / 12 and the client boundary

- **Rule 5 (immutability).** `guard_published_validations_trg` (`guard_published_structure`) fires
  `BEFORE INSERT OR DELETE OR UPDATE` on `form_item_validations`, and `set_item_validations` refuses a
  non-draft version with `HC0P4` (C6 covers it). `copy_version_children` copies both the validations
  block and `required_if` (G1–G4), and G5 asserts the published source is untouched.
- **Rule 7.** The author-supplied `message` is rendered as a plain JSX text child at **12** sites —
  nine of them funnelling through the single `FieldError` (`src/components/ui/field.tsx:43-59`,
  `<p role="alert">{children}</p>`), plus `matrix-grid.tsx:301`, `risk-matrix-picker.tsx:331`,
  `review-screen.tsx:145-155` and the `HC0P9` banner (`wizard-client.tsx:1344-1353`). No
  `dangerouslySetInnerHTML`, no `MarkdownRenderer` path. A `staff_admin`→filler stored-XSS vector is
  closed.
- **Rule 9 / client bundle.** `src/lib/queries/validations.ts` is the server half (it imports
  `@/lib/supabase/server`); the pure evaluator lives in `src/lib/forms/validation-rules.ts`, which the
  wizard and the rules editor import directly. The split is enforced by a static test
  (`validations.test.ts:184-202`) that greps the pure module's import lines, and empirically by the
  `next build` I ran. No `service_role` reference anywhere under `src/components/forms/` or
  `src/components/responses/`.
- **Rule 11.** `set_item_validations` emits `app.audit_write('form_item_validations.set', 'form_item',
  …)` with a payload of `{rules: <count>, item_type}` — a count and a type, no author text, no PHI.
  Verified live (QA-P4), untested in the suite (m-4).
- **Rule 12.** FF-3 touches **no PHI**. `form_item_validations` holds `rule_type`, `config`,
  `severity`, `message` — author-written form definition only; `form_items.required_if` is a condition
  object. No FF-3 function references `event_patient`, `referral_patient`, `patient_identifiers` or
  `patient_participants`. Confirmed.

### 5.5 Authority ordering, totality, and the fail-open family

`set_item_validations` gets the ADR-0079 ordering right: **authority first** (`42501`) before any
domain code, so "you may not" is never reachable through a branch that means "your data is wrong"
(B4 covers it, with the mutation named in the file). Coverage (`HC0Q1`) is checked before config
(`HC0Q2`), so an author who picked the wrong rule for the field type is told that. Every key test in
the entry-shape check resolves the **absent** case via `coalesce(jsonb_typeof(…), 'missing')` — the
`jsonb_typeof(x->'missing') is NULL` fail-open family that cost this project six downstream keystones
is explicitly closed here, in the right way.

`app.eval_validation`'s regex arm wraps both `~` and `~*` in `coalesce(…, false)` (fail **closed**,
since every caller writes `not eval_validation(…)`), and its unknown-`rule_type` arm raises rather
than degrading to "no rule". `app.item_is_required` is total. `app.validation_rule_allowed` is total
twice over (i-5).

The ReDoS bound ADR 0090 accepts is real, not asserted: `char_length(pattern) <= 200` in
`is_valid_validation_config`, plus `statement_timeout=8s` on the `authenticated` role
(`pg_roles.rolconfig`, read live).

### 5.6 Amendment 3 — the decision-#9 reversal is sound, and it closes a divergence

I audited the ratification rather than accepting it. It holds, and for a stronger reason than the
Amendment gives.

The SQL enforcement of decision #9 was the CHECK `form_items_conditional_not_required`
(`visible_when IS NULL OR required = false`, `20260620000000_baseline.sql:18261`). It is **gone from
the live catalog** — `pg_constraint` on `public.form_items` now lists only `config_shape`,
`default_value_display_null`, `input_vs_display`, `item_type_check`, `no_nested_container`,
`required_if_shape`, `visible_when_shape`. It was dropped by **FF-1** (`docs/backend-state.md`: *"the
platform-wide drop of `form_items_conditional_not_required`"*), not by FF-3.

So between FF-1 and FF-3 the prohibition was a **UI-only rule with no database backing** — the shape
Rule 1 warns about, though in the safe direction (UI stricter than DB). FF-3 removed the UI half and
replaced it with resolved semantics. The ratification is therefore not merely "a consequence of ruling
4"; it *closes a UI-only/DB divergence FF-1 opened*, which is a better argument than the Amendment
makes for itself.

**Nothing else depends on the old prohibition.** I swept independently: the retired string
*"não pode ser obrigatória"* survives only as a **negative** assertion in
`src/components/forms/item-editor-dialog.test.tsx:241` (`queryByText(…)` — asserting its **absence**,
which is the right shape: a silent revert cannot pass), and the new copy *"apenas quando aparecer"* is
at `item-editor-dialog.tsx:788` with a positive assertion at `:237`. No SQL constraint, no RPC, no
other spec references it.

### 5.7 Amendment 1 and §M

The legacy `assert_item_bounds` lane is genuinely folded into the shared walker: both
`app.assert_item_bounds` and `app.response_validation_errors` read `app.item_bound_violations`, and
the extraction preserves emission order via the explicit `ord` column, so "min before max" survives
byte-for-byte. J1/J2/J3 all red under M23. §M's mixed-severity rationale is the sharp one and is
correct: E2's state holds only errors and E4's only warns, so a refactor suppressing warns *while
errors exist* passes both — M1/M2/M3 are the only assertions that see a mixed set.

---

## 6 · On gate step 2 — my own view, since it was asked for

**PROGRESS.md's framing is correct and I would not soften it: no single full `e2e:prod` run went
green.** The gate as CLAUDE.md §6 defines it — *"the full E2E suite runs once to declare green"* — was
therefore not met literally.

**I nevertheless accept the triage conclusion for FF-3**, and the reason is evidential rather than
charitable:

- The accounting is **complete** — every one of the 908 collected tests passed under a fresh server
  with `accounted N/N`, and the residual is attributed, not waved off.
- The environmental claim is **evidenced**: failures track connection-error density exactly
  (b1–b9/b13 = 0 errors and 0 failures; b10/b11/b12 = 36/135/2); the server log carries
  `destination stream closed early`; b11's first failure is a 150 s timeout on a click where
  Playwright reports the element *visible, enabled and stable*; and — the decisive one — **the
  identical b11 specs fail at batch position 11 and pass at position 1**, which is a property of the
  process, not of the specs. No `supabase_vector` container exists here, so the known 502 path is
  correctly excluded rather than assumed.
- The triage **discriminated**. It separated two real defects (`AC-4`'s stale decision-#9 contract —
  deterministic, zero connection errors, identical on retry; and BUG-E2E-001) from 138 noise failures,
  and one of those defects is what produced Amendment 3. A triage that finds a real bug the phase's own
  19/19 spec missed is not a triage that is rationalising.

**Two things I want on the record against it, though.**

First, **a triage-based green is not repeatable by a third party**, which is what a gate is for. It is
acceptable **as a recorded exception for this phase**, and PROGRESS.md already records it as exactly
that. It is not acceptable as a standing practice, and the lead's finding — *"the suite has outgrown a
single gate process … it will block every future phase's gate identically"* — should be scheduled as
work before FF-5, not carried as a note. FF-5 will be larger.

Second, and more concretely: **a green E2E is not evidence against M-1, M-2 or M-4.** None of the
three is on a path the suite exercises — M-4 needs a `required_if` item nested in a plain `group`
during fill, M-1 needs an unanswered per-instance `required_if` reaching `submit_response`, M-2 needs
an outsider calling the read RPC. When the gate is re-run after the fixes, those three shapes should be
in it.

---

## 7 · What is required to clear this review

1. **B-1** — land the `enable_item_validations` gate-flip migration and prove it flips the flag
   independently of `seed.sql` (set `false`, replay the migration alone, assert `true`).
2. **M-1** — add the `submit_response` group-arm `required_if` keystone. My probe QA-P1 is
   drop-in and already mutation-proven in both directions; neutralising
   `case when v_validations_on then r_child.required_if else null end` must red it.
3. **M-2** — add a `272`-§S-shaped assertion for `public.get_response_validation_errors`: an outsider
   reads **0**, a member reads **>0** as the control. Removing the wrapper's existence check must red it.
4. **M-3** — decide the regex topology (advisory-only for `regex` errors in `handleNext`, or a
   write-time dialect lint, or a documented supported subset) and record the divergence in ADR 0090
   rather than only in a code comment.
5. **M-4** — thread `warnings` and `requiredNow` through `SectionStep` → `GroupBlock` →
   `BlockRenderer`, and add the render-level assertions that go red when they are dropped — the same
   shape as the render suite that already exists for the other paths. Enumerate the **containment**
   axis, not the item-type axis.

MINOR and INFO items may ride as follow-ups. **m-4** (Rule 11 keystone) and **m-5a** (the unlabelled
regex input) are cheap enough that I would take them in the same round.

---

*Stack left clean: fresh `db reset`, 224 == 224, `pgtap` extension dropped, all 23 mutated function
bodies restored (post-restore suite 0 red), working tree unmodified.*

---
---

# FF-3 — QA Review **r2**

**Verdict: ✅ APPROVED**

**Reviewer:** `qa` · **Date:** 2026-07-28 · **HEAD:** `a3573bb` · **Migrations:** 225 == 225
**r1 above is retained unedited as the record.**

**Tally: 0 BLOCKING · 1 MAJOR-coverage (non-blocking, named below) · 4 MINOR · 3 INFO.**

**Every r1 item is genuinely closed**, and I re-proved each one myself rather than accepting the
report. The r1 BLOCKING and all four r1 MAJORs are gone, with keystones that go red when I neutralise
them. Amendment 4 is the strongest artifact this phase produced and I endorse it on the merits — the
lead's instruction was overruled correctly.

I am approving with **one MAJOR-coverage item open**, stated plainly for the PO: the M-4 fix is
keystoned on only **one half of the wire**, and the uncovered half is exactly where the r1 defect
lived. It does not block because its regression costs a marker and an inline warning, not a boundary
or a submitted-record integrity failure — but it should land before the pilot.

---

## r2.0 · Verification performed

**Gate step 1, re-run by me from my own fresh `supabase db reset` at `a3573bb`:**

| gate | result |
|---|---|
| `supabase db reset --local` | clean · **225 == 225** · healthy |
| `npm run test:db` | **141 files / 4167 tests / PASS** |
| `npm run test` (Vitest) | **47 files / 809 / pass** |
| `npm run typecheck` | 0 |
| `eslint --max-warnings=0` | 0 |
| `lint:css-vars` | 0 |
| `npm run build` | **`BUILD_EXIT=0`**, route table emitted |

I ran `next build` myself and captured the exit code, because `frontend` had reported a green build
that had not executed. It is genuinely 0.

> ⚠ **A later `npm run test:db` in the same session returned FAIL / 3693 tests. It is contamination,
> not a regression, and I am naming the evidence rather than asserting it.** The failing set is
> `140_patient_safety` (35/35), `145_pqs_membership` (91/91) and a cascade of *"Bad plan. You planned
> N tests but ran 0"* aborts across unrelated files — the CLAUDE.md §6 E2E-mutated-DB shape. **No
> FF-3 file appears in it** (`274`, `275`, `272`, `270`, `209`, `271` were all 0-red under my guarded
> harness minutes earlier, and `S16_RESTORED` re-confirmed it after the last mutation). `tester` is
> running `e2e:prod` against this same local stack, and twice during my sweep it dropped the `pgtap`
> extension and `test_helpers` out from under me. **I did not re-reset**, because the shared-stack
> rule is one owner and the tester currently has it. The authoritative datum is the fresh-reset run
> above, which matches the lead's number exactly.

**23 mutations run in r2** (16 r1 re-runs + 7 new), each applied to the live catalog via
`CREATE OR REPLACE`, measured, and restored.

---

## r2.1 · ⚠ A methodology failure of my own, reported because it changes how to read r1

**Six of my r2 mutation runs came back "0 red" when in fact nothing had run at all.** The `pgtap`
extension and `test_helpers` schema had been dropped by the tester's concurrent activity, and my
harness counted only lines matching `^(ok|not ok)` — so a file that aborted at `select plan(...)`
emitted zero of both and read as a clean pass. Had I not noticed, I would have reported six
regression checks as green on the strength of nothing executing.

That is the exact vacuity I graded this phase on, committed by the reviewer.

**Fix, and it is now in every number in this section:** the harness pins the expected standalone
assertion count per file (`274`=96, `275`=3, `272`=30, `270`=52, `209`=44, `271`=90) and prints
`!! <file> ABORTED: ran N of M — NOT a pass` when short. Every r2 result below was produced under that
guard, and the baseline (`R2BASE4`) is 0 red with **no** aborts.

**What this means for r1:** the r1 zero-red findings were re-run under the guarded harness and all
still hold — **m-1** (walker section/item visibility, still 0 red with all 96 assertions running) and
**m-2** (dispatch group-arm child visibility, still exactly 1 incidental red in FF-1's `270` H3). The
two r1 MAJORs that rested on zero-red evidence, **M-1 and M-2, are now independently confirmed by
their own new keystones going red**, which is stronger evidence than the original absence. Nothing in
r1 needs retraction.

---

## r2.2 · r1 items — each re-proved

### B-1 (BLOCKING) → **closed**

`20260901000800_enable_item_validations.sql` exists. **Seed-independence proven by me**, not read:

```
update app.feature_flags set enabled = false where key = 'item_validations';   -> before=false
\i 20260901000800_enable_item_validations.sql                                  -> UPDATE 1
select enabled ...                                                             -> after=true
```

The migration's header also records `backend`'s empirical confirmation of my inversion claim (flag
off → error list 0 rows while submit still raises `HC061`). I note that it **verified the claim before
acting on it** rather than taking my word — the right response to a review finding.

### M-1 (MAJOR) → **closed**, and the split is proven in both directions

`D6a` lands. My mutation matrix, re-run at `a3573bb` under the guard:

| site neutralised | reds |
|---|---|
| `response_required_complete` FLAT | D2, D3, N2, N3 |
| `response_required_complete` GROUP | D6, N7 — **not D6a** |
| `submit_response` FLAT | N4 |
| **`submit_response` GROUP** | **D6a — not D6** |

Each arm reds only its own assertion. That is the strongest available form: D6a is unreachable through
the dispatch and D6 is unreachable through the authority, so neither can be passing for the other's
reason.

### M-2 (MAJOR) → **closed**

`§O` lands, asserted as **rows read** under `set local role` in the shape of `272` §S. Neutralising the
wrapper's existence probe reds **O2 only**; O1 (the creator control) and O3 stay green. O3 pins that the
withheld payload includes an item **label**, not merely a rule id.

`§O`'s header does something better than fix the instance: it names the **shape** — *"an INVOKER
wrapper whose own RLS probe is the only gate in front of a DEFINER body is a shape the sweep is
structurally blind to, not one it overlooked"* — and `0bfc704` tracks it as **AUDIT-INVOKER-WRAPPER**
for the PO. That is the correct generalisation and it is worth more than the keystone.

### M-3 (MAJOR) → **closed via Amendment 4.** Audited on the merits; see r2.3.

### M-4 (MAJOR) → **behaviour closed**; coverage gap remains, see r2.4

`GroupBlock` now accepts `warnings` / `requiredNow` (`group-block.tsx:33-34, 57-58`) and forwards both
with the same `answerable` guard the top-level dispatch uses (`:111-112`); `section-step.tsx:254-255`
passes them. The containment-axis table at `PROGRESS.md:270-283` enumerates all fill and review paths
and I found no fifth.

### m-4, m-5a, m-5b, i-1, i-2 → **closed**

- **m-4** — B16a/b/c. I neutralised `app.audit_write` in `set_item_validations`: **B16a + B16b red,
  B16c green**, exactly as documented. B16c *is* vacuous under that mutation (`0 = 0`), which is why
  B16a is asserted first and separately. Recording a vacuity instead of hiding it is the right call and
  the second time this phase has done it (see r1 i-4).
- **m-5a** — a real `<label htmlFor>` on the pattern input, `<legend>` demoted to `sr-only`
  (`validation-rules-editor.tsx:328-338`). The advisory JS-compile note is `role="status"` and
  explicitly non-blocking, with pt-BR copy that states the dialect situation without over-claiming.
- **m-5b** — per-rule `aria-invalid` (`:113`).
- **i-1** — all three stale pointers corrected in **both** the fixture and the copy embedded in `275`,
  and the narrowings sentence now reads *"the **THREE** places"*. I checked the third specifically,
  since `backend`'s first attempt reported three fixes and made two.
- **i-2** — the stale `HC0N5` note struck in place at `PROGRESS.md:343-344`.

**Both drift detectors re-verified by me**, parsing each `.sql` file's `$vectors$` literal and
deep-comparing to the JSON fixture: **validator 27 vectors, deep-equal true**; **evaluator 47 vectors,
deep-equal true**, of which **6 carry `"engine": "sql"`** — matching Amendment 4's stated test shape.

### r1 regression sweep — all 16 proofs hold

Re-run at `a3573bb`, guarded: dispatch flat visibility → D4/N5/N8 + `270` H1b · severity filter → E5 ·
`HC0P9` gate → E1 · peers → I2/I3 · unary exemption → H3/H4 + `275` V1 · operator allowlist → H1/H2 +
`275` V1 · clone validations → G1/G2/G3 · clone `required_if` → G4 · totality → B8 · drop write policy
→ C3/C4 · drop targeted arm → C2/C4 + `272` S2 · widen grant → B2/B3/C5 + `209` C17. Baseline and
post-restore both 0 red with no aborts. **The r2 rewrites regressed nothing.**

---

## r2.3 · Amendment 4, audited on the merits

The lead asked whether de-mirroring is genuinely total, and whether the resulting UX is acceptable.

**Is it total? Yes — I swept for leaks rather than reading the claim.**

- `evalValidation`'s `regex` arm is `return true` unconditionally.
- **Exactly one `new RegExp` survives anywhere in `src/`** (`validation-drafts.ts:441`,
  `regexCompilesInJs`). It is advisory-only: `validateRuleDraft`'s `regex` case returns `null`
  (`:276-298`), and its single consumer renders a `role="status"` hint that does not gate the save
  (`validation-rules-editor.tsx:361`).
- **No HTML `pattern=` attribute exists on any control** — worth checking explicitly, because that
  would have re-entered JS regex through native constraint validation, below the TS layer entirely.
- Both remaining client walks (`liveFeedback`, `reviewFeedback`) route through the same
  `evalValidation`, so the review screen inherits it.

**Is the reasoning sound? Yes, and I'd go further than the Amendment does.** A write-time dialect lint
would have been a blocklist over two independently-evolving grammars — and the decisive argument is the
one `backend` gave: *a lint that is 90% right still leaves the remaining 10% as an unsubmittable
response*, i.e. it does not remove the failure mode, it only shrinks it. The measurement it produced
(only 13 of 26 constructs agree; `\b` is a word boundary in JS and a **backspace** in ARE) is the kind
of evidence that should overrule an instruction, and it did. **This is the second time this phase that
an engineer tested a prescribed fix against reality and found it wrong** — the first being BUG-FF3-002.
That is a healthy pattern, not a process failure.

I verified the two load-bearing measurements independently:

```
PG:  '123' ~ '^[[:digit:]]{3}$'   -> true      JS: new RegExp(...).test('123') -> false
     app.is_valid_validation_config('regex', …) -> true   (i.e. it stores)
```

**Is the UX acceptable? Yes.** A `regex` violation now surfaces at submit with the author's own pt-BR
message via `HC0P9`, and the wizard places it on the field and navigates there. That is strictly better
than a live message that can be wrong *and* blocking, and it restores ruling 3's stated topology
instead of patching an exception into it. **Nothing here is blocking.** One narrow consequence is worth
naming as a MINOR — see **r2.5 m-4**.

### Write-time regex guard — confirmed independently, including `~*`

The lead's probe used `~` only. I tested whether that is sufficient by asking Postgres directly whether
any pattern compiles under one operator and not the other, over 20 constructs spanning POSIX bracket
expressions, PG-only escapes, ARE directors (`***=literal`, `***:`), inline flags, equivalence classes,
lookaround and the three PG-uncompilable forms:

```
RESULT: 0 of 20 patterns disagree on COMPILABILITY between ~ and ~*
```

`~` and `~*` share one compiler and differ only in a case-fold flag, so the guard's `~`-only probe
covers the case-insensitive path by construction. I then proved it end to end through the real door:

| probe | result |
|---|---|
| `a{300}` **with `caseInsensitive: true`** | `HC0Q2` ✅ |
| `(?<n>a)` with `caseInsensitive: true`, **`warn` severity** | `HC0Q2` ✅ (severity does not bypass the guard) |
| `^[[:digit:]]{3}$` with `caseInsensitive: true` — valid PG, invalid JS | **stores** ✅ (Amendment 4 on the merits) |
| message text | matches `%expressão regular%` ✅ — **no raw `2201B` reaches a filler** |

A side observation from a mis-aimed probe of my own: pointing a `regex` rule at a `number` item is
refused `HC0Q1` *"a pergunta do tipo "number" não aceita a validação "regex""* — confirming live that
coverage is checked before config, as designed.

---

## r2.4 · MAJOR-coverage (non-blocking) — the M-4 keystone covers only one half of the wire

**Requirement:** ADR 0079 keystone discipline — the fix for a MAJOR must be observable if it regresses.

`PROGRESS.md:291` claims *"reverting `GroupBlock` to forwarding neither prop → **3 red**"*. **That
claim reproduces exactly — and it is only half the wire.** I ran both mutations, restoring each file
byte-for-byte (`git diff` empty afterwards for both):

| mutation | full Vitest result |
|---|---|
| **receiver** — drop `warning=` / `requiredNow=` from `group-block.tsx:111-112` | **3 failed / 806 passed** — marker, `aria-required`, inline `warn` |
| **caller** — drop `warnings={warnings}` / `requiredNow={requiredNow}` from the `<GroupBlock>` call at `section-step.tsx:254-255` | **809 / 809 — ALL GREEN** |

**The uncovered half is precisely where the r1 defect was.** r1 M-4 read: *"`section-step.tsx:246-256`
renders `<GroupBlock>` with … no `warnings`, no `requiredNow` — and `group-block.tsx` accepts
neither."* Both halves were broken. Both were fixed. Only one is pinned. Delete those two lines from
the call site tomorrow and the r1 MAJOR returns in full silence.

The cause is structural and familiar: `required-marker.test.tsx` renders `GroupBlock` **directly, with
the props supplied**, so it cannot observe a parent that fails to supply them. It is the same shape as
a policy test that proves the predicate rather than the read, and the same shape as testing one of two
call sites.

**Why this does not block the verdict.** Its regression costs a `*` marker, an `aria-required`
attribute and an inline warning — a real a11y/UX defect, visible in use, recoverable, and it does not
let a bad record reach `submitted` (the server still raises `HC011`) or cross a tenancy boundary. That
is a materially different class from M-1 (an incomplete response reaching immutable `submitted` state)
and M-2 (a cross-tenant read), which is why those were gate-blocking and this is not. **It should land
before the pilot**, and it is one assertion: render the wizard at `SectionStep` level with a plain
group containing a `required_if` child, and assert the marker — the mutation above is the proof it
would have to survive.

---

## r2.5 · MINOR

- **m-1 (carried from r1)** — the error-surface walker's own section- and item-visibility skips remain
  unkeystoned. Re-verified under the guarded harness at `a3573bb`: still 0 red with all 96 assertions
  running. Bounded failure mode as stated in r1.
- **m-2 (carried from r1)** — no dedicated group-arm hidden+`required_if` deadlock-negative; the guard
  is still observed only incidentally, by FF-1's `270` H3.
- **m-3 (carried from r1)** — vector coverage still lacks a wrong-type case for `date_range` /
  `datetime_order`, and the unknown-`rule_type` arm still diverges (SQL raises, TS returns implicit
  `undefined`). Unreachable from a stored row; TS fails closed.
- **m-4 (NEW) — a `warn`-severity `regex` rule is silently inert.** Since Amendment 4 the client
  reports `regex` satisfied, and the server's rows reach the UI **only** on an `HC0P9` refusal —
  `wizard-client.tsx:188-190` says so in its own comment (*"`warn` rows returned by an HC0P9
  refusal"*), and `getResponseValidationErrors` is called from exactly two places, both inside the
  `SUBMIT_VALIDATION_ERROR` branch (`actions.ts:815`, `:924`). So a `warn` + `regex` rule surfaces only
  as a side effect of some *unrelated* `error` blocking the same submit; on a clean submit it is never
  shown anywhere, including review. The author gets no indication their rule does nothing.
  `CLIENT_UNEVALUATED_RULE_TYPES` was exported for exactly this and has no production consumer. Fix is
  a choice of three: badge it, hide `warn` for `regex` in the severity picker, or fetch the list on a
  successful submit.

## r2.6 · INFO

- **i-1 (NEW) — a stale, now-orphaned JSDoc block on the arm Amendment 4 changed.**
  `validation-rules.ts:268-283` still reads *"`regex` is the one arm where the two evaluators run
  DIFFERENT engines … this side is live UX. An expression JS cannot compile yields `true` here rather
  than a false accusation"* — describing the pre-Amendment-4 behaviour, directly contradicting the arm
  20 lines below it. It is also structurally orphaned: a second JSDoc block for
  `CLIENT_UNEVALUATED_RULE_TYPES` sits between it and `evalValidation`, so it documents nothing and an
  editor will not surface it on the function. In a repo whose standing lesson is *text is not truth*,
  the one comment a future reader of this arm will find should not be the false one.
- **i-2 (NEW)** — `CLIENT_UNEVALUATED_RULE_TYPES` has no production consumer (only its own definition
  and a Vitest import). Deliberate per Amendment 4; noted so it is not later deleted as dead.
- **i-3 (carried)** — `app.response_validation_errors` still has `proacl = NULL`; unchanged,
  pre-existing, not PostgREST-reachable.

*r1's i-2 (stale `HC0N5`) and i-1 (fixture pointers) are closed and are not carried.*

---

## r2.7 · Gate step 2 — my §6 view, restated as asked

**My r1 position stands unchanged, and the r2 evidence sharpens it.**

Three of the five r1 findings — M-1, M-2, M-4 — were on paths the E2E suite structurally cannot
exercise: an unanswered per-instance `required_if` reaching `submit_response`, an outsider calling a
read RPC, and a render prop inside a plain group. A green E2E was not evidence against them in r1 and
is not evidence for them now.

**r2 produced a fourth instance of the same principle, one level up.** The M-4 fix is confirmed working
by both Vitest and (presumably) the E2E re-run — and the call-site half is still unpinned. Execution
evidence tells you the code works *today*; only a mutation tells you a test would notice if it stopped.
**Those are different questions, and the gate currently only answers the first.**

So: I concur with treating gate step 2 as passed, on the same basis as r1 — complete accounting, an
environmental residual that is evidenced rather than asserted, and a triage that demonstrably
discriminates. And I repeat the two caveats, which r2 has strengthened rather than weakened:

1. **Split the gate harness before FF-5.** The lead's finding — the collapse is cumulative over run
   time, so a smaller `BATCH_SIZE` makes it worse — means FF-5 will be worse than FF-3, not better.
   This is now the second phase greened by triage.
2. **`tester` running against the shared local stack while `qa` audits it cost me real time and
   produced six false greens in my own harness.** The E2E gate and a catalog audit cannot share one
   database. That is a coordination fix, not a code fix, and it belongs alongside the harness split.

---

## r2.8 · What remains open, for the PO

| # | severity | item | consequence if it regresses |
|---|---|---|---|
| r2.4 | **MAJOR-coverage** | the `<GroupBlock>` **call site** is unpinned; only the receiving side is | r1's M-4 returns silently: a `required_if` item in a plain group announces itself optional and its `warn` never renders inline. a11y/UX; no boundary or integrity impact. **Land before pilot.** |
| r2.5 m-4 | MINOR | `warn` + `regex` is silently inert | an author's advisory rule does nothing and they are not told |
| r2.5 m-1/m-2/m-3 | MINOR | carried coverage gaps (walker visibility; group-arm deadlock-negative; three vector gaps) | bounded; each named with its failure mode in r1 |
| r2.6 i-1 | INFO | stale orphaned JSDoc on the `regex` arm | misleads the next reader of the arm Amendment 4 changed |
| r1 O-5 / O-6 | open by design | ADR-recorded PO calls; **O-6 is not closed** — the SQL pair still duplicates the walk | `Whoever changes required-ness must change both` still applies |

**None of these blocks the phase.** The security boundary, the submission authority, Rule 5
immutability, the door parity, both mirrored pairs and the flag flip are all in place and
mutation-proven — by the engineers, and independently by me.

---

*Stack state on exit: HEAD `a3573bb`, migrations 225 == 225, flag `item_validations` = `true`, `pgtap`
extension dropped, all 23 mutated function bodies restored and all 2 mutated TypeScript files restored
byte-for-byte (`git diff` empty for both). The only modified file in the worktree is
`e2e/ff3-validations.spec.ts`, which is **`tester`'s** concurrent work, not mine. I deliberately did
**not** run a further `db reset`: the tester currently owns the shared stack.*
