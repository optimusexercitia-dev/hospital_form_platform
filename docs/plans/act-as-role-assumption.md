# Act-as role assumption — implementation plan (ADR 0106)

- **Program:** ACT — explicit role assumption as a binding constraint
- **ADR:** [0106](../decisions/0106-act-as-role-assumption.md) (D1–D11 PO interview;
  D12–D14 catalog re-census, **ratified by the PO 2026-08-09** — see below)
- **Branch:** `feat/act-as-role-assumption` (worktree; based on local `main` @ `7b7a99c`)
- **Sequencing:** **BEFORE the pilot** (PO decision, 2026-08-09). D10's big-bang
  justification depends on it; if the pilot moves first, D10 must be re-litigated.
- **Status:** plan revised after QA r1 (`docs/reviews/act-as-plan-review.md`:
  CHANGES REQUESTED — all 9 findings addressed in this revision); r2 pending; no stage
  started.

## 1. Decisions closed in the 2026-08-09 planning interview

All six are PO decisions; none may be silently reversed by a stage.

| # | Decision | Ruling |
| --- | --- | --- |
| P1 | D12–D14 (JWT transport · administrativo rides the committee hat · case-bitmask arm classification) | **Ratified as written.** |
| P2 | Sequencing vs pilot | **Before pilot.** |
| P3 | Hat lifetime | **Bound to the auth session** (one hat per sign-in; no app-level TTL). True daily freshness is a session-length policy (auth inactivity timebox — a Supabase Pro knob), not an act-as mechanism. |
| P4 | Feature flag | **NONE — the migration IS the cutover.** Deliberate deviation from house convention: a flag's off position is the exact fail-open mode D5 rejects, and enforcement + picker are one atom (enforcement without picker locks multi-role users out). Recorded here so a future "why is this unflagged" does not re-add one. |
| P5 | D9 scope at cutover | **Choke-point guards + indicator dropdown.** The ~5 area-entry guards (org manage, qualidade, NSP, NSP-org, direção técnica, commission area) render the switch hint; the indicator dropdown is the always-available escape. Row-level absences inside a page are deliberately NOT hinted — there, absence must stay indistinguishable from non-existence (D4). |
| P6 | Program shape | **Staged program, Stages 0–4 below.** Stage 3 is the only red-suite window. |

Derived rulings (follow from the ADR; recorded so the build doesn't re-decide them):

- **`session_context` is a DESIGNED hat-blind door.** The picker and the D9 hint need the
  caller's FULL grant list (D9: "constructed purely from their own memberships"). QA r1
  correction: it was **never** a `has_role_any` caller (a comment-only regex hit — the
  recorded `prosrc` trap), so there is nothing to rewire. Stage 3's task is a **no-op
  confirmation**: comment its inline query as the D9 exemption, re-diff its "verbatim from
  `has_role_any`" comment against the post-cutover `has_role_any` body, and allowlist it the
  way `service_role` is in D11 — so a later "fix the inconsistency" doesn't break the picker.
- **A switch lands on the new hat's landing route** — same destination as signing in with
  that hat.
- **Audit stamp key: `metadata.acting_as`**, minted from the same claim the permission
  check read (D8). `assume_role` emits its own audit action (`role_assumed`).
- The hook is **extended, not created**: `public.custom_access_token_hook` already exists
  (config.toml `[auth.hook.custom_access_token]`) and already stamps `is_admin` — the
  active-role claim is the same pattern generalised.

## 2. The caller-only binding (found during planning; not in the ADR)

`app.has_role(…, p_user_id)` and the `is_*_of_for` variants are also used to check
**other principals'** roles (visibility computations about other people). The active-role
condition must bind **only when the checked principal is the caller**:

```
… existing membership test
AND (p_user_id is distinct from auth.uid() OR p_role = app.active_role())
```

Otherwise one user's hat corrupts what the system may conclude about *other* users.
Stage 3 acceptance includes a sweep of every 4-arg / `_for` call site (catalog `prosrc` +
client `.rpc()` sites) classifying each as caller-check vs third-party-check, and a pgTAP
keystone proving a third-party check is hat-independent. ⚠ Sweep by the property
(callers of the function), not by name — `\yhas_role\y` does not match `_for` variants.

## 3. Substrate anchors (measured 2026-08-09 — re-verify from the catalog at build time)

- `public.custom_access_token_hook` — exists, stamps `is_admin`; wired in
  `supabase/config.toml` (`pg-functions://postgres/public/custom_access_token_hook`).
  ⚠ Remote: the hook must ALSO be enabled on Supabase Cloud (dashboard/CLI), a deploy
  step `db push` does not cover.
- `app.has_role` — two overloads; 3-arg delegates to 4-arg (one body to change).
- `app.has_role_any` — the sibling door; callers: `is_member_of`, `is_member_of_for`
  (**not** `session_context` — QA r1, comment-trap corrected).
- The census: ADR 0106 corrected table (12 via has_role · 2 via has_role_any · 7 direct
  `is_*` readers · 14 delegators · 12 neither), **plus `can_manage_professional`** — the
  8th direct reader, outside the `is_*` prefix (QA r1), DEFINER, gating 10
  professional-identity/ethics-vocab write RPCs. Full population: **127** boolean gates in
  `app` (47 `is_*` + 80 others).
- `test_helpers.claims_for(p_user, p_is_admin)` — `supabase/tests/00_setup.sql:307`;
  PLUS inline `set_config('request.jwt.claims', …)` sites (130_audit,
  180_user_registration, …) — the Stage 1 sweep is bounded by the PROPERTY
  (`set_config('request.jwt.claims'`), never by filename.
- E2E sign-in: `loginFresh` in `e2e/helpers/auth.ts` (plus any storage-state reuse path).

## 4. Stages

### Stage 0 — the role enum (FUP-AFF-4, scoped)

> **AMENDED 2026-08-09 during the build (lead ruling, PROGRESS.md Decisions).** The enum is
> **`public.platform_role`**, NOT `app.platform_role` as originally written below. Measured at
> build time: `supabase/config.toml` exposes `["public","graphql_public"]`, so an `app`-schema
> enum never reaches `gen:types` — which silently voids this plan's own "the picker (via
> generated types)". Exposing `app` was rejected (it would put every `app` DEFINER door on
> PostgREST); a hand-kept TS mirror was rejected (stale-assertion shape). A bare enum TYPE in
> `public` is not a relation — no endpoint, no RLS surface — and `public.audio_job_status` is
> the precedent. **Stage 3 must reference `public.platform_role`.** Everything else in this
> stage stands as written.

**Owner: backend.** Introduce a `platform_role` enum carrying the full role list
(source: `memberships_role_check`, derived from the catalog, **plus `'platform_admin'`** —
QA r1 BLOCKER: it is not a `memberships` value because it lives in `profiles.is_admin`, yet
D11 requires it representable for the implicit break-glass hat, the selections table, and
the `metadata.acting_as` audit stamp; adding it here is the decision, so Stage 3 doesn't
re-derive it silently). Consumers in this program: `active_role_selections.role`, the claim
value, the picker (via generated types).
**Deliberately out of scope:** converting `memberships.role` (text + CHECK) to the enum —
that is a re-key-class change with its own risk profile (the D11-anglicization lesson:
enum work rewrote `pg_proc` and stranded `pg_policy`; re-sweep `pg_policies` after ANY
enum change). Gate: lint/typecheck/pgTAP on fresh reset; `gen:types` regenerated;
`ARM=census` + `ARM=floor` (expected trivially green — named anyway, per 0079 Amendment 1:
an unnamed standing gate is the one nobody runs).

### Stage 1 — harness first (D10's own emphasis)
**Owner: tester (+backend for 00_setup.sql).**
- `test_helpers.claims_for` gains `p_active_role text default null`; null mints no claim
  (pre-cutover vacuous — suites stay green).
- Sweep every inline `request.jwt.claims` `set_config` site; route through `claims_for`
  or add the claim slot. Commit the inventory (file:line list) to
  `docs/plans/act-as-buildnotes.md`.
- E2E: `loginFresh` (and storage-state path) gains an `actAs` seam — a no-op until the
  picker exists, flipped in ONE place at Stage 3.
- **New seed persona** holding two role TYPES (e.g. `dualhat.a@test.local`:
  `org_admin` A + `quality_reviewer` A1). ⚠ Additive only — do NOT add roles to existing
  personas: `seed.sql` is a contract with ~900 tests (the pigeonhole lesson). `multi@`
  stays as the D2 negative case: two commissions, ONE role type ⇒ no picker.
Gate: full suites green (nothing enforced yet); inventory committed; `ARM=census` +
`ARM=floor` (named per 0079 Amendment 1, as in Stage 0).

### Stage 2 — behaviour-preserving normalisation
**Owner: backend.** The **8** direct `memberships` readers re-based onto
`has_role`/`has_role_any`. **No semantic change.** As of the QA-r1 census (re-derive at
build time **by the property** — comment-stripped direct `memberships` read with no
`has_role*` call, over ALL ~127 boolean gates in `app`/`public`, never by the `is_*`
prefix): `is_entitled_document_approver`, `is_hospital_member_of`,
`is_org_level_admin_within`, `is_org_member`, `is_pqs_member_of_any`,
`is_pqs_operator_in_org_for`, `is_quality_reviewer_in_org`, **`can_manage_professional`**
(QA r1 BLOCKER — the raw `role = 'staff_admin'` third arm; its 10 dependent write RPCs get
their own keystone). Publish the sweep's reconciliation (count + names) to
`docs/plans/act-as-buildnotes.md`.
- `CREATE OR REPLACE` only — never `DROP`+`CREATE` (a rebuild silently loses the ACL);
  no parameter renames (a rename is a privilege reset).
Gate: full Phase Gate step 1 incl. `ARM=census` + `ARM=floor` + **diff-scoped door sweep
over exactly these 8** (list from the migration diff); fresh-reset pgTAP; e2e:prod green.

### Stage 3 — THE ATOM (the only red window)

> **AMENDED 2026-08-10 during the build (lead ruling) — SCOPE ADDITION: the picker must
> actually be reachable.** The Frontend paragraph below says the picker is "a new first
> step in the `page.tsx` chain". Measured at build time, **`page.tsx` is not on the login
> path at all.** `signIn()` in `src/lib/auth/actions.ts` computes
> `resolveLanding()` (l.96–141) and calls `redirect(target)` (l.217–220), going **straight**
> to the landing area — `/` is never rendered. A picker built only into `page.tsx` would be
> a correct door nothing can reach.
>
> Proof it bites this very program: `resolveLanding` returns `/o/<org>/manage` for an
> `org_admin` of exactly one org (l.122), so **`dualhat.a@test.local` — the plan's own
> dual-hat persona — would never see the picker on the normal login path.**
>
> Compounding: `resolveLanding` is a *duplicate* precedence chain whose own doc comment
> claims it "Mirrors the root-landing precedence in `src/app/page.tsx`" — a stale-by-design
> assertion — and it inspects only `is_admin`, `org_admin` and commission memberships,
> i.e. **4 of the 11 roles**. A second bypass sits beside it: an explicit `?redirect=` param
> (`explicitTarget`, l.157–160) skips `resolveLanding` entirely, so a deep link lands a
> hatless principal directly in a gated area — where, post-cutover, D5 makes them a stranger.
>
> **Stage 3 must therefore sweep by the PROPERTY — every site that computes a
> post-authentication destination — not by filename**, and must not treat `page.tsx` as the
> chain. Known members: `resolveLanding`/`signIn` (`src/lib/auth/actions.ts`), the
> `page.tsx` chain, the `?redirect=` deep-link path, and the middleware session/gating
> helper in `src/lib/supabase/` (verify, do not assume). Each must be classified as
> picker-routed or reasoned-exempt, and the enumeration published to
> `act-as-buildnotes.md`. Ownership: `src/lib/**` is **backend's**, so this is a backend
> task with a frontend dependency, not a frontend task. Full analysis:
> `docs/design/act-role-picker.md` Open Question 1.

One merge. **Backend:**
- `app.active_role_selections` (`session_id` pk, `user_id`, `role public.platform_role`,
  `chosen_at`) — ⚠ see the Stage 0 amendment: the TABLE stays in `app` (unexposed), only
  the TYPE moved to `public` — written ONLY via DEFINER RPC `assume_role(p_role)` which validates
  against live memberships, upserts by session, audits `role_assumed`. ⚠ Name the
  ON CONFLICT target explicitly (the untargeted-`do nothing` lesson).
- Extend `custom_access_token_hook`: selection row by `session_id` → claim
  `active_role`; no row + exactly one live role type → derive implicitly (this IS the
  D11 break-glass path — platform_admin single-role, no UI involved); no row +
  multi-role → NO claim (D5: stranger).
- `app.active_role()` helper (reads `request.jwt.claims`); `has_role` 4-arg gains the
  §2 caller-only condition; `has_role_any` reimplemented as
  `has_role(scope, scope_id, app.active_role(), p_user_id)` for caller checks with the
  same third-party carve-out; `member_can` gains the D13 condition;
  `session_context` rewired per the §1 exemption.
- `audit_write` generalises the `actor_is_admin` pattern → `metadata.acting_as`.
- **Raw-policy sweep (QA r1):** sweep `pg_policies` (all schemas) for predicates reading
  `memberships` directly without an `app.*` door. Known instance:
  `profiles_select_self_or_admin`'s co-member arm (any-role co-membership ⇒ profile
  visibility). Fix per the §2 caller-only binding: the CALLER side of the EXISTS goes
  through hat-aware `is_member_of`; the *target* side stays any-role (what roles another
  user holds is not a function of MY hat). Any sibling arms found join the same migration
  or are recorded as reasoned, named exceptions — never left silently unswept.
**Frontend** (frontend-design skill first): picker page (multi-role, at sign-in — a new
first step in the `page.tsx` chain, which loses its precedence guessing entirely; carry
the explicit role→landing-route table lifted from `page.tsx`'s own doc comment — all 10
membership roles + `platform_admin` — so the mapping is not re-derived ad hoc mid-build);
persistent hat indicator + dropdown switch (`assume_role` → `refreshSession()` →
new hat's home); D9 hint component on the P5 choke-point guards, computed from own
memberships only. All pt-BR.
**Tester:** flip the Stage 1 seams; picker/switch/D9 specs incl. one keyboard-only flow;
`dualhat.a@` positive + `multi@` negative; a spec proving a stale pre-cutover session
(no hat) sees stranger-level nothing until re-login.
Gate: FULL Phase Gate. Diff-scoped 0079 sweep over EVERY touched gate (derive from the
migration diff). `ARM=census` is the arm that sees the brand-new `active_role()` gate
(a new gate is in no BLIND set — Amendment 3). **Plus the revert-twin keystone:** a pgTAP
test that goes RED when the active-role condition is removed from `has_role` (prove the
detector can detect — a no-regression claim needs its over-grant twin). ⚠ The keystone
must assert through a table reached ONLY via `has_role` — no OR'd permissive sibling
grant (authz-handoff §7.1 shape 6: a permissive sibling fakes both directions).

### Stage 4 — D14 arm audit + record
**Owner: backend + qa.**
- `_case_caps` audited arm-by-arm FROM THE CATALOG; each arm tagged role-derived
  (hat-bound) or relationship-derived (D6-immune); pgTAP divergence proof — same user,
  same case, two hats: role-arm capabilities differ, ACL/respondent/recusal arms identical.
- The 0079 findings file gains the two DESIGNED hat-blind doors (`session_context`,
  `service_role` paths) as reasoned allowlist entries.
- ADR 0106: record ratification + P1–P6; `docs/backend-state.md` + PROGRESS.md program
  rows (lead); QA review per stage 3+4.

## 5. Deploy notes

- Remote cutover = `db push` (needs user auth — background agents are auto-denied) +
  **enabling the hook on Supabase Cloud** + forcing re-login (D5 makes stale sessions
  see nothing; pre-pilot, that's acceptable by decision P2).
- ⛔ All merges stay LOCAL until the PO lifts the standing no-push rule (local `main` is
  ~70 ahead of origin).

## 6. Out of scope (deliberate)

- Respondent-reviewer conflict control (ADR 0106 "not decided"; a different control).
- Hat-indicator placement details — design-system decision against a real screen
  (Stage 3 frontend, `frontend-design` skill).
- Full D9 coverage beyond the P5 choke points.
- `memberships.role` column → enum conversion (future FUP; see Stage 0).
