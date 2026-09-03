# FUP-AUTHZ-COMMAND-DOOR-UNSWEPT — ⭕ **RE-SCOPED 2026-08-17 (pre-S6): the filed premise was FALSE, the population is 407 not one (⭕ **re-derived 426 at the AE1 Record step 2026-08-27, then **427** (345 `public` + 82 `app`) on 2026-08-31 — and the figure is now DERIVED by `ARM=census`'s own banner each run, so this chain ends here rather than needing a next link**), and the class was read as COVERED-BUT-UNPINNED — ⛔ FALSIFIED 2026-08-31, see the amendment below** — ⭐ **Critical FUP C2** (owner: lead + backend)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-17 · status open

> ## ⭕ AMENDED 2026-08-31 (ADR 0171) — RE-GRAINED, INSTRUMENTED, AND NO LONGER "COVERED-BUT-UNPINNED"
>
> **Tier 1's predicate is replaced.** The 2026-08-18 form (*"touches PHI or crosses a tenant
> boundary"*), derived honestly, returned **405 of 427 (94.8 %)** — it did not partition. The
> adopted predicate uses a **GATE-AWARE closure** (never descending into a boolean-returning
> callee, because *a predicate that CHECKS PHI access is not itself a PHI-touching door*) over a
> **PHI-marked** relation: **Tier 1 = 237 (55.5 %), Tier 2 = 190**, six controls passing, no
> hand-list. ⛔ **The TENANCY disjunct is DROPPED** as a domain tautology (74.5–92.5 % at every
> grain tried, driven by `cases`/`memberships`/`meetings`); those doors are Tier 2 —
> **deferred, not cleared**. Sizing + rejected variants:
> [authz-c2-tier1-sizing.md](../design/authz-c2-tier1-sizing.md) §8b.
>
> **The long pole is built:**
> [`c2-command-door-neutralizer.sh`](../../supabase/tests/mutation/c2-command-door-neutralizer.sh)
> rewrites an authz `raise` to `null;` — guard gone, effect intact — and its unit is the
> **enforcer, not the door** (237 doors share 243 enforcers; 72 already in the bool arm, 171 new).
> Design + its safety properties: [authz-c2-command-door-neutralizer.md](../design/authz-c2-command-door-neutralizer.md).
>
> ⛔ **THE HEADLINE CORRECTION: this class is NOT "covered-but-unpinned".** The first 8 measurements
> found **3 BLIND** (`FUP-C2-THREE-BLIND-COMMAND-DOOR-GUARDS`). The old reading came from a 3-door
> sample this very entry warned *"may not be used to close anything"* — and it was nonetheless
> carried as a characterisation of the whole class for two weeks. ⭐ The sample was not misused to
> CLOSE the item; it was misused to DESCRIBE it, which no one noticed because it was hedged.
>
> ⭕ **SWEPT 2026-09-02 — 171 of 171: COVERED 109 · BLIND 40 · ERROR 22**
> ([findings](../reviews/c2-command-door-findings.md); ADR 0184 records the branch it ran against).
> ⛔ **STILL OPEN.** The sweep produced verdicts; it did not close the class. Its own anchor is a
> **syntax, not a property** — `HCDS*` (60 raises, LGPD Art. 18) and `28000` were never in the
> worklist, non-authz **state** guards were swept in as authz, and **22 doors carry no verdict**.
> A verdict here is `HC0*`-coded-guard coverage, **not** authorization coverage →
> `FUP-C2-NEUTRALIZER-ANCHOR-BLIND-TO-HCDS-AND-28000`. Both absorbed items stay open; `assume_role`
> stays ERROR-shaped.


> ### ✅ PO RULING 2026-08-18 — **TWO TIERS. Sweep the PHI / tenancy-crossing subset first; DEFER the remainder to after the pilot ships.**
>
> Recorded as **Critical FUP C2**. The decision that was owed was the **sizing**, and it is taken:
>
> **Tier 1 — sweep now, as its own scoped workstream.** The subset of the population that **touches PHI or
> crosses a tenant boundary**. Each swept door gets a **recorded verdict**, so a regression reds and —
> the actual point — **a NEW door cannot pass by absence.**
> **Tier 2 — the remainder is DEFERRED** until after the pilot ships and there are real customers.
>
> ⛔ **Tier 1's population is DERIVED FROM THE CATALOG AS A PROPERTY, never hand-listed.** This item's
> own history is the argument: it was filed on an inferred premise that measured **false**, and the
> phase's dominant failure class is an enumeration bounded by a **syntax or a filename** instead of a
> property → [[enumeration-boundary-is-a-syntax-not-a-property]]. A hand-picked "PHI-looking" list
> would reproduce it exactly. **Sizing Tier 1 — deriving the predicate and counting what it returns —
> is step one and is NOT yet done.** The tier split is ruled; the number is unknown.
>
> ⚠ **What this ruling does NOT do, stated because the temptation is structural:** it does not close
> Tier 2, and it does not let the 3-door sample stand in for either tier. ⛔ **The sample may not be
> used to close anything** — it establishes that the class is *covered*, which is why this is 🟠 and
> not 🔴, and nothing more. ⭐ *Absence of a verdict is not absence of coverage* — and the inverse
> holds too: **presence of coverage is not a verdict.** Nothing today records *why* any of them is
> safe, so nothing notices when one stops being safe.
>
> ⚠ **`assume_role` is still ERROR-shaped, not COVERED**, and it is in Tier 1 by construction
> (`platform_role` crosses every tenancy boundary there is). Its suite run changed shape — `315`
> failed tests 5–6 then **aborted** (*"Bad plan… you planned 22, ran 7"*, exit 3). Per the door-audit
> convention that is **ERROR**, and CLAUDE.md is explicit: **`ERROR` is not a pass.** It must be
> resolved *within* Tier 1, not inherited as already-swept.

Filed 2026-08-17 (lead) on measuring, rather than trusting, a green `ARM=census`. Re-scoped
the same day, before opening S6, by measuring the two things the filing had *inferred*.

**What still holds.** `public.complete_evidence_upload_verification` (new,
FUP-DM5-FINALIZE-ATOMIC, `prosecdef = t`) is absent from every findings file, and
`ARM=census` reported *"every live authz gate carries a verdict (no unswept newcomer)"* —
546 live / 570 verdicts — **and passed.** The census's DEFINER clause is bounded by
`t.typname = 'bool' or (p.proretset and has_function_privilege('authenticated', …))`; the door
returns **`jsonb`** and is not set-returning, so it is outside the census domain entirely.

⛔ **The supporting claim was FALSE, and it understated the finding.** The filing argued this
was *"a gap rather than a definition"* because the door sweep's domain is wider —
`complete_document_upload_verification` *"**is** in the findings"*. **Measured: it is not.**
That name occurs in `authz-door-audit-findings.md` **only inside a prose paragraph stating
that the ten S2 command doors are excluded by definition**, and `verdicts_from_findings`
scrapes **markdown table rows only** (`^| `). Same for `mint_printed_document` in
`authz-rowdoor-audit-findings.md:38` — prose, inside a `>` blockquote. **No jsonb/void command
door carries a verdict anywhere.** The door sweep's PRED domain is in fact *narrower* on the
bool axis (it adds a `^(is_|can_|has_|…)` name regex the census deliberately omits).
⭐ So this is not one newcomer slipping through a boundary that covers its siblings — **the
entire population sits outside every arm's domain**, and the one document that mentions it
does so where no scraper reads. → [[a-predicate-quoted-at-the-wrong-grain]].

**The measured population** (live catalog, 2026-08-17, post-`db reset`):

| | count |
|---|---|
| `prosecdef` functions in `app`+`public` | **774** |
| in `ARM=census`'s domain — `bool` | 135 |
| in its domain — set-returning + `authenticated`-reachable | 49 |
| **outside every arm's domain** | **590** |
| ↳ `authenticated`-reachable, `prokind='f'`, non-trigger = **real command doors** | **407** |
| ↳↳ of which in `public` (PostgREST RPC-callable) | **326** |

⛔ **THE TABLE ABOVE IS A DATED SNAPSHOT (2026-08-17) AND IS KEPT AS ONE — do not quote its
figures as current.** Every number in it has moved: the command-door row measured **426** at the
AE1 Record step and **427** (345 `public` + 82 `app`) on 2026-08-31. It is preserved because the
*decomposition it demonstrates* is the point — most `prosecdef` functions are outside every arm's
domain — not because any cell is still true. ⭐ **The live figure is DERIVED by `ARM=census`'s own
banner each run** (QA AE3 r3/r4); cite the banner, never this table. The prose below was rewritten
2026-08-31 to stop restating these cells.

`create_case`, `assume_role` and `add_referral_shared_item` appear in **no** findings file, **no**
allowlist and **not** in `authz-unswept-backlog.txt`. Each is a DEFINER, so by CLAUDE.md's own
standing rule its internal gate *replaces* RLS — it **is** the boundary.

**⭐ THE SAMPLE — and it inverted the expectation.** Rather than infer blindness from "no arm has
asked", three doors were neutralized (guard condition → `false`) and the full pgTAP suite run
against each. **All three went RED. The class is COVERED, not blind:**

| door | neutralized | suite | failing assertion | verdict |
|---|---|---|---|---|
| `add_referral_shared_item` | `can_read_case` recusal check | 194f / **6392** / FAIL | `340` R5–R6 *"the recused coordinator can no longer freeze a NARRATIVE…"* | **COVERED** |
| `create_case` | ~~`is_staff_admin_of ∨ is_admin ∨ member_can`~~ → **`is_staff_admin_of ∨ member_can`** (arm CUT 2026-08-22, PO ruling) | 194f / **6392** / FAIL | `177`:13, `205`:45 *"a plain staff … is denied (42501)"* | ⚠ **COVERED was true about the DOOR, not about the ARM** — a plain-staff denial cannot see an `is_admin` disjunct, so the verdict said the door was *exercised*, never that it was *bounded*. Genuinely bounded now by `357` §8d.1 |
| `assume_role` | `if not v_holds` (holds-the-role check) | 194f / **6377** / FAIL | `315`:5 *"sa_x CANNOT assume a role he does not hold"* | **COVERED**, ⚠ ERROR-shaped |

⚠ **`assume_role` is not a clean COVERED and is not recorded as one.** Its run shape differs
from baseline — `315_act_stage3_hat_condition.sql` failed tests 5–6 and then **aborted**
(*"Bad plan. You planned 22 tests but ran 7"*, exit 3), which is exactly the 6392 → 6377 delta.
Per the door-audit convention a shape change is **ERROR**, and CLAUDE.md is explicit that
`ERROR` is not a pass. The *first* failure is nevertheless a true authorization assertion, so
"something noticed" is established; "the suite is clean about it" is not.
`add_referral_shared_item` doubled as the **positive control** (the ADR 0122 keystone was built
for exactly this) — it went RED, proving the harness can find something
([[detector-that-finds-nothing-must-be-proven-able-to-find-something]]).

**⭐ Calibration, corrected in BOTH directions.** Not a vulnerability — but also **not a
coverage hole**, which is what "unswept" implied. The coverage is real; what is missing is the
**verdict**. Consequences, which are the actual finding:
1. **The coverage is unpinned.** Nothing records that these doors are covered, so nothing
   detects if that coverage regresses. A keystone deleted tomorrow reds nothing.
2. **A NEW door in this class inherits no arm at all** — it is absent from every findings file,
   so it passes every arm *by absence*. Precisely the ADR 0079 Amendment 7 shape.
3. **`ARM=census` prints a claim wider than its domain** — *"every live authz gate carries a
   verdict"* over a domain excluding the application's entire command layer.
   → [[enumeration-boundary-is-a-syntax-not-a-property]], [[a-census-whose-parts-dont-sum-is-wrong]].

**Fix (unchanged in shape, re-sized).** Widen the census's DEFINER clause to admit reachable
non-trigger command doors, re-run, expect **one RED entry per door in the class** — the count is
whatever `ARM=census`'s banner derives that run — and triage, as ADR 0079 Amendment 7 did for
`ARM=wrapper`. ⚠ **That population is far too many to classify honestly in one pass**, and a
backlog filled with generic reasons is itself a vacuous act; sizing that triage is a **PO
decision**, not an implementer's. ⛔ **Do not close this on the 3-door sample** — three COVERED
results are evidence about three doors, not about the population ([[a-detector-that-finds-a-lot-needs-proving-too]]).

**Harness safety, for whoever runs the full triage.** The suite runs in a **separate
connection**, so an in-transaction neutralization is invisible to it and cannot be used
(FUP-AUTHZ-HARNESS-TRANSACTIONAL). What was used instead, and worked: exact
`pg_get_functiondef` captured as the restore artifact · an **EXIT trap** restoring on any abort ·
an assertion that the neutralization **landed** (md5 must change — a silent no-apply would make
the run PASS *"having asserted nothing"*, which it did catch: `docker cp` + `psql -f` fails
silently on Windows because MSYS rewrites the container-side `/tmp` path to `C:\tmp`; use
`docker exec -i … < file`) · md5 re-verified after restore · the property sweep
`^\s*begin\s+return\s+(true|false)\s*;\s*end` clean before **and** after · and the suite
re-run to **194f/6392 PASS** to prove the stack was returned to baseline.


> ## ⛔ EXTENSION 2026-08-23 (AFF2 B1) — **trigger-returning** `prosecdef` gates are in no arm's domain EITHER, and this item's own wording excludes them
>
> This item is scoped to *"407 reachable **non-trigger** command doors"*. Measured during AFF2 B1:
> **`guard_profile_privileged_columns`** is `prosecdef = t`, `authenticated`-EXECUTE-able
> (`{postgres=X, authenticated=X, service_role=X}` — no PUBLIC), returns **`trigger`**, and carries
> **no verdict in any findings file or allowlist** — all four checked. `ARM=census`'s DEFINER clause
> is bounded to `bool`/set-returning functions plus policies, so a `trigger` return type is excluded
> **by construction**.
>
> ⭐ So this subset falls in the gap between the arms *and* this follow-up: the arms exclude it by
> return type, and this item excludes it by the word **"non-trigger"**. An exclusion written to bound
> a claim honestly ended up naming the one population nothing else covers.
>
> ⚠ **AFF2 did not create it, but B1 made it LOAD-BEARING.** That trigger is now the only in-DB control
> over who may write `profiles.date_of_birth` / `phone` (beside the column-grant absence) — ADR 0133
> D10's *"writable only through `registerUser`/`updateUserProfile`"* is enforced there. It is keystoned
> by pgTAP `359` §3 (both columns, separate arms, with an attribution twin), so the **property** is
> pinned; what is missing is its presence in the **standing** invariant, which is the difference between
> "tested once" and "cannot silently stop being tested".
>
> ⛔ **Not a live hole; do not report it as one.** Calling a `RETURNS trigger` function directly outside
> trigger context raises — and there is no PUBLIC/`anon` grant. This is a **measurement-domain** gap.
> The cheap mitigation is the recorded one: `revoke all on function … from public` costs nothing,
> because executing a trigger does not check EXECUTE on its function. The real fix is widening the
> census domain to include `trigger` returns, which is a gate change needing its own decision.


**From the Critical pin, 2026-09-03 (compacted at ADR 0186 D4, plan 5.6):**

- **Item (was):** 🟠 **`FUP-AUTHZ-COMMAND-DOOR-UNSWEPT`** — reachable command doors (population per the entry) sit outside `ARM=census`'s domain — ⛔ **re-derived by property 2026-08-31** (`prosecdef` ∧ not trigger ∧ not set-returning ∧ return ≠ `bool` ∧ `authenticated`/`anon` holds EXECUTE), **never incremented**; was 426 at the AE1 Record step and 407 on 2026-08-17. ⭐ **The figure is now DERIVED by `ARM=census`'s own banner each run**, so this row records a measurement rather than owning one — the banner printed the frozen 407 beside four green arms for two weeks. ⭐ **Decomposed, because the halves differ** (⛔ **re-derived 2026-08-31 with the headline; QA r2 B4 caught the OLD decomposition pasted beside the NEW total — 344+82 sums to 426, not 427**): **345** are `public` and therefore still inside `ARM=floor`'s domain (which carries no return-type filter); **82** are `app` and sit in **no** arm bounded on client-reachability (`ARM=census` is bounded to `bool`/set-returning; these return `jsonb`/`void`). ⛔ **NO LONGER 'covered-but-unpinned' — FALSIFIED 2026-08-31 (ADR 0171).** That reading rested on a 3-door sample from 2026-08-17 and stood two weeks; the purpose-built neutralizer found **3 BLIND** in its first 8 measurements (`FUP-C2-THREE-BLIND-COMMAND-DOOR-GUARDS`). *Three COVERED results were evidence about three doors, never about the population.*
- **What must happen (was):** **Tier 1 — sweep the subset that touches PHI or crosses a tenant boundary**, derived as a property over the catalog, never hand-listed ([[enumeration-boundary-is-a-syntax-not-a-property]]). **Tier 2 — the remainder is DEFERRED.** Each swept door gets a recorded verdict, so a regression reds and a **new** door cannot pass by absence. ⭕ **Tier 1 ABSORBED TWO ITEMS 2026-08-18** — `FUP-DM5-Q1-OPEN-BYTES-CUT-BROKEN` (successor named: `app.resolve_document_version_bytes`) and `FUP-DM5-SIBLING-GUARD-DIFF`. All three want the same door-mutation machinery over `prosecdef` gates; building it three times was declined. ⚠ **Absorption is not closure** — each keeps its own index line and its own verdict.
- **Trigger — the point it can no longer wait (was):** **Tier 1: SIZED 2026-08-31** — instrument `scripts/authz-c2-tier1-sizing.sql` (re-derives every figure; quotes none), record [authz-c2-tier1-sizing.md](../design/authz-c2-tier1-sizing.md). ⛔ **The split does not split — the ruled predicate returns 405/427 (94.8 %), leaving a Tier 2 of 22 internal helpers.** The **tenancy disjunct is the vacuous half** (395 alone / 92.5 %): a DEFINER door bypasses RLS and must re-establish tenancy itself, so every gated door reaches `profiles` (354), `memberships` (346), `commissions` (246) — it measures *is tenancy-gated*, not *crosses a boundary*. ⛔ **The PHI comment convention is NOT a usable marker** — prose polarity is not machine-decidable (a positive regex captures `patient_xref`'s *"is NOT a PHI store"*), and 50 base tables carry no comment; the PHI arm rides on the hard `has_table_privilege` door-only fact instead (6/6 canonical stores). ⛔ **Depth-0 grain is FALSIFIED** (drops `create_case` + `set_participant_patient`), as is the only population-cutting variant (hand-list, and falsified on `assume_role`). ▶ **PO ruling owed** — §8. ⚠ **No command-door neutralizer exists**: all three harnesses open a boolean gate or a policy `USING`; these doors return `jsonb`/`uuid`/`void`. **Tier 2: after the pilot ships, once there are real customers.**
- **Owner (pin's own column):** lead + backend
