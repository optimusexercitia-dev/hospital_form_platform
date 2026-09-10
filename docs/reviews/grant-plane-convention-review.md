# QA Review — GRANT-PLANE-CONVENTION (ADR 0205 D9 + D12, the two pre-pilot case fixes)

**Reviewed:** the uncommitted working tree on `main`, docs half committed as `2dc220eb`.
**Reviewer:** qa. **Date:** 2026-09-10.

**Verdict: APPROVED**

**0 BLOCK · 0 MAJOR · 2 MINOR · 4 INFO.** Every claim in the `backend` report that I re-derived
**reproduced exactly**, including the one that is normally taken on trust: I re-ran the targeted
behavioural mutation myself and got `test:db` rc **1** with `Failed tests: 10-12` — K1/K1b/K2 of
`416` and **nothing else** out of 8,946 tests. The guard is falsifiable, it is the only thing in
the suite that holds this invariant, and it sits at the position the ruling names. The two MINORs
are both in the TS pre-check and both are false-positive-only with the DEFINER door behind them;
neither moves a security boundary. Given the standing preference for clearing cheap MINORs before
the Record step, both are one-line fixes and I would clear them before the commit rather than
carry them.

---

## Scope and method

Read: `ARCHITECTURE.md`, ADR 0205 in full (header, Context, D6, D9–D12), the hub
`docs/features/grant-plane-convention.md`, the record `docs/progress/grant-plane-convention.md`
(the `backend` report entry in full), `docs/learning/LESSONS.md`, the migration, `416`,
`src/lib/case-access/actions.ts`, `src/lib/queries/commissions.ts`,
`src/lib/case-access/actions.test.ts`, `src/lib/auth/access.ts`, `src/lib/queries/session.ts`
§ `canConfigureCommissionById`, `src/components/cases/case-access-panel.tsx` +
`use-case-action.ts`, and the three doc diffs.

**Re-measured on the live catalog** (`supabase_db_azkbbhskturikxpgmafq`, head `20261003007370`;
⛔ never from migration text — ADR 0078):

| what | measured | verdict |
| --- | --- | --- |
| `HC0U0` present in `public.grant_case_access`; `prosecdef`; `proconfig`; ACL | `t` · `t` · `search_path=app, public, pg_catalog` · `postgres=X/postgres service_role=X/postgres authenticated=X/postgres` | unmoved, as ruled |
| guard POSITION in the live body | after the `42501` authority disjunction, after `assert_not_case_excluded` (`HC0F1`), after the level check, after `HC021`, after `p_expires_at <= now()`, **before** `app._grant_case_access_unchecked(` | exactly D9's ordering |
| every function anywhere mentioning `HC0U0` | **1** — `public.grant_case_access` | no spill |
| every function mentioning `case_is_terminal` | 4 — `app.bump_case_print_revision`, `app.guard_case_status`, `app.print_source_registers`, `public.grant_case_access`; the first three pre-existing | the door is the only new reader |
| `app._case_caps` — `case_is_terminal` / `closed_at` / `status` | `f` · `f` · `t` (`status` is the pre-existing `is_active` outer gate, not a case lifecycle step) | **ADR 0078 A24·3 holds — no lifecycle step entered the resolver** |
| `app.case_is_terminal` | `status in ('completed','cancelled')`, `coalesce(...,false)` — fails closed on an unknown case | both terminal statuses, not one |
| `app.is_tenancy_admin_of_for` live body | `app.is_active(p_user_id) and (has_role('organization', c.organization_id, 'org_admin') or has_role('hospital', c.hospital_id, 'hospital_admin'))` | the TS ARM 2 mirrors the disjunction (see MINOR-1 on the `is_active` conjunct) |
| `cases` SELECT policies | **one** — `cases_select` = `app.can_read_case(id, auth.uid())` → `has_case_capability(…, 'read_case_content')` | the ⭐ edge is real; see below |
| `app._case_caps` S2 | `-- S2 · org_admin — manage_case_access ONLY (A4 removed content/deliberation)` | the ⭐ edge is real |

**Gates I ran myself, bare rc:**

| gate | rc | detail |
| --- | --- | --- |
| `npx supabase db reset --local` | **0** | fresh |
| `npm run test:db` | **0** | `Files=265, Tests=8946`, `Result: PASS` |
| `npm run lint` | **0** | full 17-gate chain, eslint 0/0 |
| `npm run typecheck` | **0** | — |
| `npm run test` (full vitest) | **0** | `152 passed / 2070 passed` |
| `npx vitest run src/lib/case-access/actions.test.ts` | pass | `14 passed (14)` |
| `scripts/door-sweep-cases.sh 2dc220eb` | **1** | `SCOPE: 1 file(s) — 0 committed (2dc220eb..HEAD), 0 worktree, 1 untracked \| filter: none \| derivation: catalog`; `grant_case_access (prosecdef, returns void — outside PRED_DOMAIN)`, tier-2 SWEEPABLE **0** |
| **my own targeted mutation** of the live door (`if false and p_level = 'write' …`), then `npm run test:db` | **1** | `Failed tests: 10-12` — K1, K1b, K2 — and **only** those, across 8,946 tests |
| restore, then catalog re-read `diff` against the captured original | **IDENTICAL** | mutation gone (`f`), `prosecdef=t`, ACL unchanged; a final `db reset --local` rc **0** left the DB pristine |

`git diff --stat -- docs/reviews/authz-door-audit-findings.md` — **empty**. `git status --porcelain`
lists exactly the eight expected paths and nothing else: no AE5 file, no `authz.*` object, no
resolver, no ledger DDL, no permission code, no second migration.

---

## 1. Requirements — does each fix do exactly what was ruled, and no more?

**Fix 1 (D9) — MET, and bounded.** The refusal is `p_level = 'write' and app.case_is_terminal(p_case)`
→ `HC0U0`, in the door only. All three "deliberately not touched" claims are measured, not asserted:
`app._case_caps` carries no lifecycle term; `app._grant_case_access_unchecked` and the `create_case`
self-grant path are untouched (the migration performs exactly one `create or replace`, and no other
function in `app`/`public`/`authz` mentions `HC0U0`); `revoke_case_access` / `list_case_access` are
untouched and `416` K6 pins revoke-on-a-terminal-case still living. Read grants on a terminal case
stay legal (K3), and K3c proves the surviving grant confers **real reach**
(`has_case_capability(read_case_content) = true`) rather than landing inert — that is the arm that
separates this from a blanket narrowing (§7.7).

The migration's method is right and, unusually, self-checking: it re-emits from the live
`pg_get_functiondef`, asserts the anchor occurs **exactly once** before the replace (a global
`replace()` on a duplicated anchor would have inserted the guard twice), and re-**reads** the catalog
afterwards to assert presence, uniqueness, position, and — the half that matters most — that nothing
was **lost** (`42501`, `HC0F1`, `HC021`, the expiry check, the kernel call, the
`org_admin_deadlock_exit` stamp) and that identity args / result / `prosecdef` / `search_path` /
owner / volatility / **full ACL** are byte-identical. LEARN-057 and LEARN-059 are both answered.

**Fix 2 (D12·i) — MET.** `authorizeCommission` is now `staff_admin of THAT commission` OR
`isCommissionAdmin(context, tenancy)`, with the `context.isAdmin` pass removed. The tenancy
coordinates come from a new `src/lib/queries/` function (Rule 9), and the tenancy predicate is
delegated to the existing mirror rather than re-derived. `HC0U0` is mapped to its own pt-BR string.

**No scope creep.** Nothing from D12's "after AE5-complete" list appears: no scaffold script, no
shared trigger, no dialog/action factory, no conformance keystone, no roster, no new ledger, no
`securable_resources` contact. `FUP-GRANT-PLANE-CONVENTION-BUILD-AFTER-AE5` is parked, as ruled.

## 2. Security / RLS

- **The ordering is the security property, and it is enforced at three layers**: the migration
  asserts the position from a catalog re-read; the live body shows it; `416` K5/K5b prove a
  non-coordinator on a terminal case still gets **42501** at level `write` *and* at level `read`.
  A terminal-status refusal cannot leak to a caller who lacks authority.
- **`prosecdef` beside `pg_policies`** — checked as the method requires, both by the migration and
  by `416` K7a/K7b/K7c (`prosecdef=t`, EXECUTE to `authenticated` + `service_role`, **no** `=` ACL
  item ⇒ PUBLIC still holds nothing). Measured again by me post-apply: unchanged.
- **No RLS policy, no table grant, no trigger changed**; the only SELECT policy on `cases` is
  untouched. The DEFINER's gate still *replaces* RLS, and the gate got strictly narrower.
- **No client-reachable service-role key**, no `NEXT_PUBLIC_` change, no new env var.

## 3. Tests — is `416` falsifiable, and is the classification honest?

**Yes, and yes — I proved the first myself rather than reading it.** My independent predicate
neutralization turned exactly K1, K1b and K2 red and nothing else. Note the mutation kept the string
`HC0U0` in the body, so a text-shaped checker stays blind to it: the red is behavioural.

The **K5/K5b re-labelling from keystone to CONTROL is honest and correct**. An ordering arm cannot
be red before the guard exists — asserting `42501` against a door with no status check passes for the
wrong reason, and calling that a RED-first keystone would be exactly the keystone vacuity the lessons
register names. The header says so in plain terms, names K1 as their discriminating twin, and the
`416` inline comment repeats it at the arm. This is the rare case of a test author downgrading their
own arm; it is the right call.

Pairing (§7.7) is complete: K1/K2 (negatives) ↔ K3/K3b/K3c (read still legal, and it *reaches*);
K1/K2 ↔ K4/K4b (the open lane still grants write, and the stored row really carries
`write_case_content`); K6 (revoke unaffected) bounds the narrowing. **P1–P9 assert every upstream
gate before any arm runs** — the case really is terminal, the coordinator really is a coordinator,
the grantee really is a member, the coordinator really is not excluded, and for K5 *both* authority
arms are proven absent for `st_x`. That is what makes a red diagnosable instead of a coincidence, and
it is the fixture discipline LESSONS demands.

The 14 vitest cells are similarly sharp: refusal and admission are asserted on **different**
witnesses (message *and* `rpc` not called, so an action that refused *and* wrote would still fail);
the "another hospital in the same org" and "another org" cells kill the two obvious wrong
predicates; the "no tier at all" floor kills a gate that returns `true`; and the § "both actions"
block proves `revokeCaseAccess` consults the same gate — which exporting the private function would
not have proven. Driving the un-exported function through the real server actions is the right seam.

## 4. Code quality

`strict` respected, **no `any`, no `@ts-ignore`/`@ts-expect-error`** in any of the three TS files.
`getCommissionTenancy` lives in `src/lib/queries/` (Rule 9), returns `null` on "absent OR invisible"
and documents that the caller must fail closed on both. Server Components untouched. File ownership
respected — `backend` touched only backend-owned paths; no `src/components` or `src/app` file moved.
The stale header of `actions.ts` (which still named the dropped `case_access` table and
`app.can_read_case` as the computation site) is corrected, and correctly carries a "verify against
the catalog, never this line" warning rather than a fresh claim to go stale.

### MINOR-1 — the TS mirror omits the `is_active` conjunct both DB arms carry
`src/lib/case-access/actions.ts:146-166`. The docblock says the gate is the mirror of the door's
disjunction "**and nothing else**". Measured, it is not quite: `app.is_tenancy_admin_of_for` opens
with `app.is_active(p_user_id)`, and ARM 1's chain reaches `authz.assignment_facts`, which also gates
on `is_active` (`t`). `authorizeCommission` checks neither — there is no `if (context.isInactive)
return false`. Its nearest sibling, `canConfigureCommissionById`
(`src/lib/queries/session.ts:757-786`), is the same disjunction over the same `commissions` read and
**does** carry it, with the comment *"Inactive accounts fail closed."*

Impact is bounded: this is a false positive only, the DEFINER door refuses with `42501`, and
`requireUser()` redirects a suspended account to `/conta-inativa` app-wide. But it is the same defect
class this fix exists to remove — a pre-check that admits a principal the DB denies — left standing
one conjunct over, under a comment that claims exactness. **Fix:** add `if (context.isInactive)
return false` after the `context` guard (one line), or soften the docblock's "and nothing else".

⚠ Related, for the record rather than as a request: the comment argues against a "third copy" of the
tenancy predicate, and the *predicate* is indeed shared via `isCommissionAdmin` — but the
**disjunction plus its commission read** is now a fourth site
(`session.ts:757`, `admin/actions.ts:116`, `members/actions.ts` `authorizeStaffOps`, and this).
Not reusing `canConfigureCommissionById` is defensible — that helper carries a ⛔ routing rule
restricting it to ADR 0100 D12 KEEP-surface configuration actions — so I am not asking for the
merge. I am noting that the duplication argument in the comment is half-true, and that the copy it
most resembles is the one carrying the conjunct MINOR-1 is about.

### MINOR-2 — `getCommissionTenancy`'s throw escapes the action as an unhandled rejection
`src/lib/queries/commissions.ts:180-186` throws `Failed to resolve commission tenancy: ${error.message}`
on a query error. The rationale is right (a swallowed error would silently deny an authorized tenancy
admin) and the throw matches the module's own convention (`commissions.ts:92`, `:128`). The gap is at
the boundary: `authorizeCommission` does not catch, `grantCaseAccess` / `revokeCaseAccess` have **no**
`try`/`catch`, and `useCaseAction` (`src/components/cases/use-case-action.ts:20-34`) `await`s the
thunk inside `startTransition` with no catch either. So a transient Supabase failure on the *new*
read leaves the panel's pt-BR `error` state for the nearest React error boundary — whereas the
sibling read in the same file, `commissionOfCase` (`actions.ts:169-177`), fails closed to
`MESSAGES.missingCase`. Conventions §8: errors user-readable in pt-BR; raw Postgres text (redacted in
prod, visible in dev) should not be on this path at all. **Fix:** wrap ARM 2's call in `try`/`catch`
in `authorizeCommission` and surface `MESSAGES.unavailable` (log server-side) — ⛔ not a bare
`return false`, which would re-introduce exactly the silent denial the throw was added to prevent.

## 5. UX & a11y

pt-BR throughout. `MESSAGES.terminalWrite` = *"Não é possível conceder edição em um caso encerrado."*
— and the inline comment forbidding the phrasing *"this case is closed"* is correct and load-bearing,
because read grants stay legal: the message is about the **level**, not the case. Mapping is by
SQLSTATE, not by message text, so the door's own lowercase pt-BR string never reaches the UI and no
raw Postgres error can. The second vitest cell pins that the code does not fall through to the
generic *"Não foi possível concluir."* — the FF-5 `HC0Q3` lesson applied. No markup, no input, no
focus surface changed, so no a11y delta.

## 6. Hygiene

ADR 0205 carries `**Status:**`, `**Area:**`, `**Related:**` and — the label a gate cannot detect —
`**Amends:** ADR 0155 · ADR 0078`, with the three amended points named inline.
`docs/decisions/INDEX.md:105` and `:182` show the generated back-pointers (`⚠ amended by …, 0205`) on
both targets, so `npm run adr:index` was run. `HC0U0` is registered in
`docs/backend-state/conventions.md` with its derivation (the union of catalog + repo + docs) rather
than only its conclusion — appropriate, since the row directly below it says of itself that it has
gone stale three times. The seam slice is appended to `cases-and-ethics.md` with the `## Current
state` block replaced (gate 16 rc 0). No secret, no `.env` change. `PROGRESS.md` correctly untouched:
this is a hub-tracked unit, not a phase row.

## 7. ⭐ The edge found and deliberately not fixed — I agree with leaving it

The finding is real and I reproduced its two halves from the catalog: `cases` has exactly **one**
SELECT policy, `cases_select` = `app.can_read_case(id, auth.uid())` = `has_case_capability(…,
'read_case_content')`; and `app._case_caps` S2 is commented, in the live body, `org_admin —
manage_case_access ONLY (A4 removed content/deliberation)`. So `grantCaseAccess`'s RLS-scoped
`commissionOfCase` read returns `null` for a tenancy admin, and the action answers *"Caso não
encontrado"* before the now-correct pre-check is ever consulted. The tenancy arm the door accepts
remains unreachable from the app.

**Leaving it is correct.** Closing it needs a *new read surface* — a door that lets a tenancy admin
resolve a case's commission and open the access roster without reading case content — and that is a
surface ADR 0205 did not rule. The two obvious shortcuts are both worse: widening `cases_select`
re-opens ADR 0078 D4, and adding a content arm to S2 is the same move one layer down. Doing either
inside a fix scoped "case-only, no AE5 contact" would be scope creep against D12.

**And it is recorded honestly**, which is the half that usually fails. It appears three times, each
with the measurement rather than the conclusion alone: the seam slice's ⚠ block (`can_read_case=false
· is_tenancy_admin_of_for=true · has_case_capability(manage_case_access)=true`, plus the sentence
*"Not fixed here by choice, not by oversight"*), the seam's § Open edges, and
`FUP-GRANT-PLANE-CONVENTION-TENANCY-ADMIN-GRANT-PATH-UNREACHABLE` — whose **Closes when** names the
two admissible resolutions *and* explicitly refuses the two shortcuts, including the subtle one
(*"⛔ Not closed by observing that the pre-check now agrees with the door — it does, and the read in
front of it is the finding"*). The record states plainly that D12's security half — the
`platform_admin` pass removed — is fully effective regardless.

**Graded as a finding class, not a defect of this unit:** *pre-existing surface gap, newly visible
because a gate was corrected*. It carries **no severity against GRANT-PLANE-CONVENTION**. It is PO
business, and the follow-up is the right home for it.

## 8. INFO

- **INFO-1 — the guard is grant-**time** only, by ruling.** A `write` grant issued while a case was
  open survives the case being closed: the door refuses new ones, the resolver keeps no lifecycle
  step (A24·3 forbids one), so the residue stays inert only because the content tables refuse the
  write — the original two-planes-disagree shape, for grants predating the close. This is inside
  D9 as written ("the grant **door** refuses"), and the alternative is the resolver change the ADR
  prohibits. Flagged so a reader does not infer that the planes now agree in every state.
- **INFO-2 — a ⛔ line was dropped, not paraphrased, from `cases-and-ethics.md` § Current state.**
  The replaced block lost *"⛔ Deployment status is not stated in this layer (ADR 0198 D5)"*. The
  fact survives at its home (`conventions.md:69`) and in `tenancy-and-identity.md:74`, the block is
  at **99/100** against the ratchet, and the new slice makes no deployment claim — so nothing is
  wrong. But gate 16's own instruction for a block at the ceiling is *"cut a PARAPHRASE and point at
  the frozen section"*, and this was a deletion. Worth one clause pointing at `conventions.md` if a
  line is ever freed.
- **INFO-3 — one near-redundant vitest cell.** `'does NOT swallow it into the generic message'`
  cannot fail unless the preceding `toEqual({ ok: false, error: TERMINAL_WRITE })` cell already has.
  Its stated purpose (discrimination) is already served by the equality assertion. Harmless.
- **INFO-4 — SCOPE base spelling.** The record quotes `0 committed (HEAD..HEAD)`; mine reads
  `0 committed (2dc220eb..HEAD)`. Same substance — 1 untracked file, filter none, derivation
  catalog, exit 1 — and the lead's gate record should quote whichever base it actually ran.

---

## Verdict

**APPROVED.** No blocking finding. The DB half is exactly the ruled change, in the ruled position,
with the resolver, the kernel, the self-grant path and the sibling doors measurably untouched, and
with a keystone I independently proved falsifiable. The TS half removes a real over-admission
(`platform_admin`) and a real under-admission (the tenancy arms) and is covered by 14 discriminating
cells. MINOR-1 and MINOR-2 are one-line fixes in `src/lib/case-access/actions.ts`; I recommend
clearing both before the commit rather than carrying them into the Record step, but neither blocks
and neither needs a re-review — a green `npm run test` and `npm run lint` after the change is
sufficient evidence.
