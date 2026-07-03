# Phase B — NSP-per-hospital — HANDOFF (machine switch, 2026-07-03)

**Resume artifact.** Branch `feat/nsp-per-hospital` (off Phase-A merge `8d22a32`), now pushed to
origin. Read this + [PROGRESS.md](../../PROGRESS.md) (Phase-B row + lead notes) + ADR
[0052](../decisions/0052-nsp-per-hospital.md) + design
[nsp-per-hospital-design.md](nsp-per-hospital-design.md).

## Where we are

**Phase B is code-complete and pgTAP-green; we are in the E2E-spec fix-loop of the tester gate.**
Backend core + frontend are DONE and committed. The feature spec is green (32/32). The full
regression was run and triaged: **ZERO Phase-B app/backend/security regressions** — every failure
is an E2E-spec issue (2 stale signatures + 1 pre-existing test-isolation leak + local infra
flakiness). The tester was applying those spec fixes when its process died on a transient API error
(`FailedToOpenSocket`), mid-edit. Its partial work is **preserved as patches** (see below) and the
working tree was reverted to the last coherent, tsc-clean state.

## DONE + committed

| Area | Commits | State |
|---|---|---|
| Backend core B0–B5 (org→hospital re-key, `nsp_org_admin`, dual-referral, `dispose_referral_phi`) | `4ab7618`, `7a4ffa6` | migration `20260710000000` + seed + `189` + 7 re-keyed suites + types |
| Backend bug fixes (NPH-001 `hospitals_select` arm, NPH-002 dispose probe) | `12888b1` | migration `20260710000100_nsp_per_hospital_fixups.sql` |
| Frontend B6–B8 (hospital switcher, roster/appointment UI, PHI-free `/o/[org]/nsp-org` console, dispose dialog) | `ccb6bc3`, `6eab3d1` | tsc/eslint/build green |
| Feature E2E `e2e/nsp-per-hospital.spec.ts` (8 ACs, 32/32) | `8ddc3b9` | green (chromium, w=1, fresh reset) |
| Docs (ADR 0052, design, PROGRESS, backend-state) | …`1f7a696` | current |

**Gate metrics on the committed tree:** pgTAP **1445/1445** (fresh reset) · Vitest 193/193 · `tsc`
0 · `eslint src` 0 · `next build` ✓ · feature E2E 32/32. Bugs BUG-NPH-001/002 RESOLVED.

## PENDING — resume here (in order)

### 1. Tester: finish the 3 E2E-spec fixes (specs only — never app code)
Full detail in PROGRESS.md lead note "FULL-REGRESSION TRIAGE". Summary:

- **FIX-1 — stale per-org signatures** in `e2e/patient-index.spec.ts` + `e2e/phase14b-triage.spec.ts`
  (they call re-keyed RPCs with the old `p_org_id` arg → PGRST202). New signatures (from pg_proc):
  - `search_patient_xref(p_mrn, p_encounter, p_hospital_id)`, `patient_access_audit(p_mrn, p_encounter, p_hospital_id)`
  - `set_pqs_rca_due_window(p_hospital_id, p_days)`
  - Use `p_hospital_id = '05000000-0000-0000-0000-00000000000a'` (central-a — hospital of CCIH / the
    synthetic patient). Also re-key any `pqs_department?...organization_id=eq.` filter → `hospital_id=eq.`.
  - `patient_xref_count(p_module, p_entity_id)` + `get_patient_trajectory_for_entity(p_module, p_entity_id)`
    are UNCHANGED.
  - **The tester's WIP for FIX-1 is saved as patches** — `git apply` to resume, then finish/verify:
    - `docs/progress/phase-b-wip-tester-fix1-patient-index.patch` (patient-index — was complete + self-consistent)
    - `docs/progress/phase-b-wip-tester-fix1-phase14b.patch` (phase14b — was HALF-DONE: it renamed the
      `REDE_A_ORG` const but left 3 usages at lines ~452/467/484 → tsc broken. Finish the rename +
      switch the `pqs_department` filter to `hospital_id`.)
  - **Sweep** all `e2e/**` for any other `p_org_id` / old per-org NSP-RPC args.

- **FIX-2 — test-isolation leak** (this is the audit "failure", NOT a security bug). `phase13-audit AC-3c`
  (plain staff reads 0 audit rows) + `phase3-admin-members AC3` (staff1 → 404 on `/o/rede-a/manage`)
  fail because **a spec appoints `staff1.ccih` (uid …03) `hospital_admin` of secundario-a (…00a2) and
  never cleans up.** Verified: on a fresh reset `staff1` is `cm:staff:ccih` only (seed correct); the
  `audit_log` `is_hospital_admin_of(hospital_id)` arm then lets it read 9 secundario-a hospital-tier
  rows. **Phase B only EXPOSED a pre-existing leak** (secundario-a had no audit activity before B).
  Candidate polluter: the **hospital-admin-tier appointment test** (runs before phase13 alphabetically).
  Fix: revoke the grant in cleanup, or appoint a dedicated disposable persona instead of `staff1.ccih`.

- **FIX-3 — environmental, NO code change.** The rest — all of `user-registration`, `hospital-admin-tier
  HA-6`, and the run-1 broad phase4/5/7/8/11 timeouts — are the local **GoTrue auth rate-limit** (many
  resets in a short window) + Next.js **dev-server `ECONNRESET`** over long serial runs. Phase-B-untouched,
  green in isolation.

### 2. Lead: definitive FULL regression (green declaration)
Run on a **freshly-restarted Supabase stack** to clear the GoTrue rate-limit, with retries to absorb
dev-server flakiness:
```bash
supabase stop && supabase start        # clears the GoTrue in-memory auth rate-limit
supabase db reset --local              # fresh seed
lsof -ti:3000 | xargs kill -9          # ensure playwright boots a fresh dev server
npx playwright test --workers=1 --retries=2   # --retries absorbs ECONNRESET flakiness
```
Expect green once FIX-1/2 land (env flakiness self-heals via `--retries`). Read the actual pass/fail
from the run output, NOT the shell exit code (a trailing echo masks Playwright's RC — known pitfall).

### 3. QA review → 4. Human approval → 5. §6 Record
Spawn `qa-reviewer` (requirements + code + RLS/PHI audit; the zero-PHI `nsp_org_admin` aggregate SELECT
lists + the 4 confirmed dispose/isolation keystones are the focus). Then human approval. Then §6 Record:
phase→✅, archive Phase-B task detail from PROGRESS to `docs/progress/nsp-per-hospital.md`, `phase(B):
complete` commit, push, **remote `supabase db push`** (apply `20260710000000` + `…000100`), **merge to
main**. `docs/backend-state.md` already updated.

## Key facts for resume

- **0 Phase-B app/security regressions** — proven: pgTAP 1445 (42-keystone isolation), `nsp-per-hospital`
  + `nsp-cross-org-isolation` pass on a fresh server, `audit_log` RLS + seed both correct.
- **Personas** (all `Test1234!`): `nsporg.a@` (nsp_org_admin, org rede-a), `nspcoord.a@`/`nspcoord.a2@`
  (coordinators of central-a / secundario-a), `pqs.a@`/`pqs.a2@` (roster members central-a / secundario-a),
  `pqsdual.a@` (operates BOTH hospitals + CCIH member — exercises the switcher + operator-dispose).
- **Hospitals** (org `rede-a`): `central-a` = `05000000-0000-0000-0000-00000000000a`, `secundario-a` =
  `05000000-0000-0000-0000-0000000000a2`.
- **E2E run mechanics:** fresh `supabase db reset --local`, `--workers=1`, SMTP off (`config.toml`
  `[auth.email.smtp] enabled=false`). Restart the stack to clear the auth rate-limit; `--retries=2` for
  the dev-server ECONNRESET. Lead runs the full suite (subagents stall on the E2E watchdog).
- **Commit hygiene (shared checkout):** each teammate commits ONLY its own paths (explicit list, never
  `git add -A`) — backend `supabase/**` + `src/lib/**`, frontend `src/app/**` + `src/components/**`,
  tester `e2e/**`, lead `PROGRESS.md`/docs.

## Open decision for the human (non-blocking)
`dispose_referral_phi` was accepted as **dual-hospital** (either endpoint hospital's operator may erase;
ADR 0052 §6 amended, rationale there). If you prefer **source-only**, it's a one-line gate change — say so.
