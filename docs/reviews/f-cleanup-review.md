# F-cleanup — QA Review (D3 · D10 · D8 · D11)

**Reviewer:** `qa` · **Date:** 2026-07-12 · **Branch:** `f-cleanup`
**Scope:** the residual DB-hardening batch — D3 (result-engine junctions), D10
(`updated_at` triggers), D8 (forward-FK lock), D11 (12-enum status-key
anglicization, G1–G6). Static audit only (the lead is running the E2E gate
concurrently; no DB/port-3000 access was taken).
**Driving docs:** `docs/plans/f-cleanup.md`, `docs/plans/f-cleanup-d11.md`.
**Reported green bar (verified by lead):** pgTAP **2094 pass / 0 fail** (fresh
reset) · whole-project `tsc` **0** · `next build` green · full E2E **555 pass /
2 fail**, both triaged test-level and fixed.

---

## TOP-LINE VERDICT: ✅ APPROVED

No blocker, no major. The security-sensitive part (D3 junction RLS + the result
engine) is sound: the new junctions' policies **exactly mirror** their parent
tables, there is **no cross-commission read leak**, the evaluator
`compute_case_phase_result` is genuinely **unchanged** (Rule 3), the column drop
is **safe** (every function that referenced the dropped column is recreated or
reads only its jsonb param), and the immutability/terminal gates survive D11 with
identical semantics. D10/D8 are clean. D11's rename is 1:1 with **Rule-10 pt-BR
labels preserved** (only internal keys changed).

Four **Minor/Info** fast-follows are listed below; none block the merge.

---

## Area findings

### D3 — result-engine junctions  🔴 (the crux) — SOUND

Migration `20260719000000_phase_result_junctions.sql`. Adds
`process_template_phase_allowed_results`, `process_template_phase_offered_results`,
`case_phase_allowed_results`; drops `process_template_phases.allowed_result_ids`
and `case_phases.allowed_result_ids`.

**Atomicity — OK.** Single migration, no `CONCURRENTLY` → one transaction. Order
is correct: resolvers + tables + policies + recompute helper + `CREATE OR REPLACE`
of the 6 consumers, THEN the two `DROP COLUMN` + CHECK rewrites last (L921-933). A
half-applied drop is impossible.

**Column-drop safety — OK (verified exhaustively).** Every function whose *latest*
pre-D3 definition reads the `allowed_result_ids` **column** is recreated by D3 with
a junction-based body:
- `add_template_phase` (L229), `update_template_phase` (L312),
  `create_case_from_template` (L461), `set_case_phase_result_override` (L631),
  `validate_template_phase_result` (L749), `validate_template_recommend_when`
  (L789).
- The two validators D3 does **not** recreate —
  `app.validate_template_allowed_results` (baseline L5053) and
  `app.validate_template_result_ruleset` (`20260713001000` L25) — validate their
  **jsonb parameter** against `phase_results`, never the column. Safe.
- The only other column references in-tree are superseded
  `create_case_from_template` bodies (`20260713000500` L425-469,
  `20260714000000` L605-649) — all replaced by D3's latest. Postgres does not
  dependency-track plpgsql column refs, so this had to be confirmed manually; it
  holds.

**Offered-shadow / cascade — OK.** All three junctions carry
`result_id → phase_results(id) ON DELETE CASCADE`. `recompute_template_phase_offered_results`
(L189) rebuilds the offered set = allowed ∪ ruleset rules ∪ default. On the case
side `create_case_from_template` freezes `case_phase_offered_results` from the case
allowed junction ∪ `case_phases.result_ruleset` (L577-595) — same union semantics
as before, just re-sourced. Deleting a `phase_results` row cascades every junction
ref; the jsonb ruleset copy stays stale-but-inert (the offered junction is the
gate), the blessed existing pattern.

**Evaluator parity (Rule 3) — OK.** `compute_case_phase_result` is **not** in the
migration; it still reads `case_phases.result_ruleset` + `case_phase_offered_results`
verbatim. `blocks` stays `integer[]`; `reorder_template_phase` untouched.

**App contract — OK, byte-identical shape.**
`src/lib/queries/process-templates.ts` embeds
`process_template_phase_allowed_results ( result_id, position )` and `mapPhase`
re-aggregates to `allowedResultIds: string[] | null` (empty ⇒ null, sorted by
position). `src/lib/queries/cases.ts` `allowedFromJunction` does the same for
`case_phase_allowed_results`; `manualSubsetOf` and `getCasePhaseForFill` repointed.
Each embed has a **single** FK path to its parent (the second FK targets
`phase_results`, a different table) → no PGRST201 ambiguity.

### D10 — `updated_at` triggers  🟢 — SOUND

`20260719000200`. One generic `app.touch_updated_at()` (trivial body,
`search_path`-pinned, owned by postgres); `updated_at timestamptz not null default
now()` + a `BEFORE UPDATE FOR EACH ROW` trigger on `cases`/`commissions`/`forms`.
Metadata-only, **not** added to any audit allow-list (comments L43-48 state this;
Rule 11 held). The touch only stamps `NEW.updated_at`; it is independent of the
`cases` status-recompute (which is driven off `case_phases`), issues no further
writes, and additive-column-with-DEFAULT is backward-compatible. Test `211`
asserts function/column/trigger existence + a behavioral advance.

### D8 — forward-FK lock  🟢 — SOUND

No schema change (correct — the premise column `responses.supersedes_id` does not
exist; the indicator hooks were FK'd in Phase 15). Test `211` (L26-43) locks
`capa_plan_source_indicator_id_fkey` + `capa_measure_indicator_id_fkey` and asserts
`capa_plan.source_audit_finding_id` stays intentionally FK-less (its FK lands at
Phase 18). Matches the plan.

### D11 — status-key anglicization (G1–G6)  🔴 scope — SOUND

Migrations `20260719000300`–`000800`, dictionary in `f-cleanup-d11.md` §"Locked
translation dictionary". Spot-verified:
- **CHECK/default rewrites are 1:1 with the dictionary** (e.g. G3 L43-56:
  capa_action/case_interviews/capa_plan; G6 L33-45: cases/case_phases).
- **Shared-literal discipline is rigorous.** G3 (L58-110) scopes the catalog
  rewrite to functions referencing a G3 own-table (or the named guards
  `guard_capa_status`/`guard_interview_status`) AND **excluding** any not-yet-
  converted conflicting table (`case_referral|cases|case_phases|meetings|
  controlled_document`). G6 (L47-84), being last, safely blanket-rewrites (every
  other owner already anglicized). All rewrites use `replace(def,
  quote_literal(old), quote_literal(new))` — quoted-literal only, so identifiers/
  prose are never touched; `pg_get_functiondef` is fetched inside the loop
  (aggregate-safe). Because they are `CREATE OR REPLACE` (no RETURNS-TABLE renames
  in G3/G6), owner + grants are preserved.
- **Coupled G6 pair — OK.** `cases.status` recompute (`bool_or(status='ativa'/
  'concluida')` → `'active'/'completed'`) and `case_phases.status` land in one
  migration; the terminal gate `cases_closed_at_paired` is re-created with
  `'completed','cancelled'` (G6 L37-39) — semantics identical. The HC060 terminal-
  state guard in `set_case_phase_result_override` (`v_case_status in
  ('concluido','cancelado')`, D3 L679) is re-anglicized by G6's blanket loop.
- **D3-introduced pt-BR literals get re-anglicized.** D3 recreated
  `set_case_phase_result_override` with `'ativa'/'concluida'/'concluido'/
  'cancelado'` (runs before D11); G6's blanket loop rewrites them since it runs
  last and the function references `case_phases`/`cases`. The green pgTAP status-
  flow suites after G6 are the integration proof the scoping corrupted nothing.

---

## Security / RLS — the D3 junctions (crux)

**Verdict: no leak; policies mirror the parents exactly.**

Parent policies (baseline):
- `process_template_phases`: SELECT `is_member_of(commission_of_template) OR
  is_org_admin_of_commission(...)`; write `is_staff_admin_of(...) OR
  is_org_admin_of_commission(...)` (L21940/21944).
- `case_phase_offered_results`: SELECT `can_read_case(case_id) OR
  is_org_admin_of_commission(commission_of_case)`; write `is_staff_admin_of(...) OR
  is_org_admin_of_commission(...)` (L21526/21530).

D3 junctions (L76-173) apply the **same predicates**, resolving the parent via
SECURITY DEFINER helpers `app.commission_of_template_phase` /
`app.case_of_case_phase` (L33-54, mirroring the existing `commission_of_case` /
`commission_of_template` pattern), and correctly use the current
**`is_commission_admin_of`** helper — **not** the renamed-away
`is_org_admin_of_commission` (ADR 0051). Concretely:
- Template junctions: SELECT = `is_member_of(comm) OR is_commission_admin_of(comm)`;
  write = `is_staff_admin_of(comm) OR is_commission_admin_of(comm)`. A **non-member
  of the owning commission** fails both arms → **cannot read** another commission's
  allowed/offered rows.
- Case junction: SELECT = `can_read_case(case) OR is_commission_admin_of(comm)`;
  write = `is_staff_admin_of(comm) OR is_commission_admin_of(comm)` — correctly uses
  the tighter **per-case ACL** (`can_read_case`, ADR 0061) on the read arm, matching
  `case_phase_offered_results`.

**Enforcement authority is not weakened by read-RLS.** The manual-pick gate in
`set_case_phase_result_override` (SECURITY DEFINER, L631) reads
`case_phase_allowed_results` directly (L696-706), bypassing read-RLS, so HC058
enforcement holds regardless of the caller's junction visibility — the query-layer
read is advisory only (the RPC is the authority, consistent with Rule 3). The
cross-commission `HC059` guard (`validate_template_allowed_results`) is byte-
unchanged.

**Immutability held.** Published-version cloning is untouched; the case terminal
gates (`cases_closed_at_paired`, HC060) are preserved verbatim through D11 with
English keys. No service-role key is reachable client-side (no client code changed
in D3/D10/D8; D11 client edits are key literals + label maps only).

---

## Rule-10 (pt-BR user-facing text) — held

The D11 rename touches **internal keys only**. Verified on the representative
`src/lib/safety/capa-types.ts` label maps: keys anglicized
(`aberto`→`open`, `concluido`→`completed`, …) while the pt-BR **values are
unchanged** (`'Aberto'`, `'Em execução'`, `'Em verificação'`, `'Concluído'`,
`'Cancelado'`, `'Pendente'`, `'Em andamento'`, …). Raw Postgres errors are still
mapped to friendly pt-BR before the UI: `src/lib/safety/messages.ts` maps
`HC049` (and the HC050-053 range) to pt-BR strings (`HC_CAPA_WRONG_STATE`).

---

## Requirements / acceptance coverage

| Item | Deliverable | Met? | Evidence |
|---|---|---|---|
| D3 | 3 FK junctions replace jsonb arrays; RLS from creation; evaluator unchanged; app contract preserved | ✅ | migration + `210` keystone (tests 10-15: zero dangling refs across all 4 tables incl. the ruleset-only ref) |
| D10 | generic touch fn + column + trigger on 3 tables; metadata-only | ✅ | migration + `211` (4-11) |
| D8 | regression lock on Phase-15 FKs; document FK-less audit hook | ✅ | `211` (1-3) |
| D11 | 12 enums anglicized 1:1, coupled groups, Rule-10 preserved | ✅ | `212/214/216/218/220/222` + label maps |

pgTAP `210` covers the delete-cascade keystone comprehensively; compute/override
parity is delegated to `160_phase_results.sql` (same, now junction-backed RPCs,
green in the 2094 run).

---

## Findings (ranked)

**Blocker:** none. **Major:** none.

**Minor 1 — the "non-emitting ⇒ no allowed" invariant is no longer enforced
(defense-in-depth regression / plan-vs-impl gap).**
The old table CHECKs were `emits_result OR (result_ruleset IS NULL AND
allowed_result_ids IS NULL)`; D3 rewrote them to `emits_result OR (result_ruleset
IS NULL)` (migration L923-925, L930-932). The plan (`f-cleanup.md` L28/L166) states
the dropped "non-emitting ⇒ no allowed" arm "moved to the RPCs" — but it did **not**:
`add_template_phase` (L287) and `update_template_phase` (L405/L436) insert allowed-
junction rows whenever `p_allowed_result_ids IS NOT NULL`, **not gated on
`emits_result`**, and `validate_template_phase_result` (L771) only rejects the
*emitting-with-no-allowed* direction, never *non-emitting-with-allowed*. Impact is
**inert** (the allowed subset is consulted only for a MANUAL, i.e. emitting, phase
in `set_case_phase_result_override`; recommendation refs require an emitting source
via HC063; FK integrity is preserved), so this is not a blocker. *Fast-follow:*
gate the allowed-junction insert on `emits_result` (or clear it when
`emits_result` is false), or extend `validate_template_phase_result` to reject a
non-emitting phase that carries allowed rows — restoring the old backstop.

**Minor 2 — ADR hygiene (CLAUDE.md §8).** D3 (3 new tables + a result-engine
refactor + RLS surface) and D11 (a 12-enum convention change + a binding
translation dictionary) are non-trivial but are recorded only under `docs/plans/`,
not `docs/decisions/`. Recommend a short ADR (or elevating the plan docs to ADR
status) for durability — especially the D3 schema/RLS change and the D11
anglicization convention + locked dictionary.

**Info 3 — `210` omits the cross-commission `HC059` NEG** the plan sketched
(`f-cleanup.md` L177-178). The validator is byte-unchanged and covered indirectly by
`160`, so this is a coverage-completeness note only; optionally add the NEG to `210`.

**Info 4 — doc nit.** The D3 migration header says "5 consuming functions" but
recreates 6 (add/update_template_phase, create_case_from_template,
set_case_phase_result_override, validate_template_phase_result,
validate_template_recommend_when). Harmless.

**Info 5 — D11 diagnostic messages now echo English keys.** `guard_capa_status`
(baseline L2159, `'… inválida: % -> %'`) and `guard_capa_child_lock` (L2122,
`'… bloqueado (%)'`) interpolate the raw status key, so they now read e.g.
`bloqueado (completed)` inside a pt-BR sentence. Pre-existing interpolation pattern
(D11 only changed the key spelling), and these guards fire only on illegal out-of-
RPC transitions whose error is remapped to pt-BR by `safety/messages.ts` before the
UI — cosmetic, not a Rule-10 breach. Optional: map the key to its pt-BR label in the
message, or leave as-is (English internal keys are arguably more consistent). The
tester's `phase14d-capa.spec.ts:571` fix correctly anchors on the stable pt-BR word
`bloqueado` — sound.

---

## The two E2E fixes — verified sound (static)

- `phase14d-capa.spec.ts:571` — regex `/HC049|bloqueado|completed|terminal|encerr/i`
  anchors on the stable pt-BR `bloqueado` (and the errcode); guard behavior
  unchanged, only the interpolated key changed. Correct.
- `perf-sweep-wave2.spec.ts` — defensive `ensureReferralsFlagOn` (canonical
  `set_referrals_feature_flag` RPC + local CLI fallback, mirroring phase22) fixes
  within-batch flag contamination from a sibling referral spec's `afterAll`. Test-
  infra hardening, not an app regression.

---

## Recommendation

**APPROVED.** Merge is not gated on the four fast-follows (Minor 1, Minor 2, Info 3,
Info 4/5). Minor 1 (restore the non-emitting backstop) and Minor 2 (ADRs) are the
two worth scheduling; both are low-effort and non-urgent given the inert impact and
pre-launch reset-OK posture.
