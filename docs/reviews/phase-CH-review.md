# Phase CH — Committee Charters & Meeting Cadence — QA Review

**Verdict: ✅ APPROVED** · **Date:** 2026-07-20 (r1) · **Reviewer:** `qa`
**Scope:** ADR [0080](../decisions/0080-committee-charters-cadence-model.md) (D1–D11) + build plan
[charters-cadence.md](../plans/charters-cadence.md) §9 (supersedes accreditation-track §21).
**Commits audited (all on `main`):** BE-1 `458aedb` · BE-2 `565e2f6` · BE-3 `109ef50` · BE-4 `37a63dc` ·
BE-5 `13750b1` · FE-1 `d982401` · FE-2 `5d366db` · CH-TEST `14c4381` · phase17 fix `cb6a671`.

**Findings: 0 P0 · 0 MAJOR · 0 MINOR · 3 INFO.** No blocking issue. The security crux (RLS row-visibility
under `set local role`, the three keystones, catalog facts) is met and mutation-proven. Every audit fact
below was taken from the **live catalog** (`docker exec … psql` / `pg_get_functiondef`), never migration-file
text (CLAUDE.md graphify-SQL exception).

---

## 1. Security / RLS crux (the ADR-0078/0079 way — row-visibility, not "revert the predicate")

**Live row-visibility on `public.commission_charters` under `set local role authenticated` + JWT-claim GUC**
(charter commission `b0…b1` Farmácia has one seeded charter row):

| Persona | JWT `sub` | Rows for b1 | Total charter rows | Verdict |
|---|---|---|---|---|
| **member** (`staff1.farm`, staff of b1) | `…006` | **1** | 1 | ✅ reads own |
| **staff_admin** of b1 (`chefe.farm`) | `…005` | **1** | 1 | ✅ reads own |
| **foreign-commission** member (`chefe.ccih`, only in a1) | `…002` | **0** | 0 | ✅ denied |
| **pure non-member** (`orgadmin.a`, no commission membership) | `…b1` | **0** | 0 | ✅ denied (org_admin is *not* a member — ADR 0078 A8 posture) |

The member's cross-commission total is **1** (only its own row) — the other two charter rows (c1, c2) are
filtered. Row-level isolation confirmed empirically, not via a predicate's boolean.

**Policy / grant surface (catalog):**
- Exactly **one** policy: `commission_charters_select` `FOR SELECT TO authenticated USING (app.is_member_of(commission_id))`.
- **No** INSERT/UPDATE/DELETE policy → no authenticated write path; sole write door is the DEFINER RPC.
- `relrowsecurity = t`. Grants: `authenticated = SELECT` only (postgres/service_role full, as normal).

**The 3 RPCs (`pg_proc`):** `upsert_commission_charter`, `meeting_cadence_status`, `suggest_carry_forward`
are all `prosecdef = t`, **owner = postgres**, `search_path = 'app, public, pg_catalog'` pinned, and
`proacl = {postgres, service_role, authenticated}=X` only — **public/anon EXECUTE revoked** (no PUBLIC grant).

**Authority / scope (verified in the live function bodies):**
- `upsert_commission_charter`: flag `assert_charters_enabled()` (HC000) → **`is_staff_admin_of` HC0K0 FIRST**
  → link check HC0K1 (`d.commission_id = p_commission AND d.doc_type = 'regimento'`) → upsert → `charter.upserted`
  audit. `created_by` set on insert only. Ordering exactly per §3.
- `meeting_cadence_status` / `suggest_carry_forward`: flag gate → **`is_member_of` HC0K2** entry check on each.
- `suggest_carry_forward` actions arm carries **`app.can_read_action_item(ai.id, v_uid)`** — the confidentiality
  filter is present, not merely intended.

**Keystone mutation harness** (`bash supabase/tests/mutation/ch-be3-mutation-audit.sh`, independently re-run):

```
KS_AUTHORITY (HC0K0 plain member upsert)             RED-PROVEN
KS_MEMBER (HC0K2 non-member cadence)                 RED-PROVEN
KS_FILTER (can_read_action_item confidentiality)     RED-PROVEN
CONTROL — unmutated run: all green (29 tests ran)
```

Each gate, when neutralized, makes its keystone go **RED** with the control green — the keystones can fail,
therefore they are evidence (A33).

**pgTAP** (fresh-reset, current seeded DB): `260_charters` **11/11**, `261_charters_rpcs` **29/29**,
`262_charter_notifications` **10/10** — 0 failures. (The 8 `250/251/252_authz_p0` reds are the documented
pre-existing baseline, not CH.)

## 2. Requirements — ADR 0080 D1–D11 + §9

| Decision | Evidence | Met |
|---|---|---|
| D1 regimento = controlled doc (delegate) | `controlled_document_id` FK → `controlled_documents(id) ON DELETE SET NULL` | ✅ |
| D2 no inline governance text | table has no purpose/scope/authority/membership columns | ✅ |
| D3 no charter dates | no `effective_date`/`review_due_date` on the row | ✅ |
| D4 row shape | PK `commission_id`; `meeting_frequency NOT NULL` CHECK 5-value; nullable FK; created_by/at/updated_at | ✅ |
| D5 4-state, never-met neutral | `sem_regimento`/`sem_reunioes`/`em_dia`/`em_atraso`; no-charter→sem_regimento, no last_held→sem_reunioes | ✅ |
| D6 DEFINER member-scoped cadence | over base `meetings` (`held_at IS NOT NULL AND visibility_policy='commission_default'`), calendar-interval windows, inclusive `<=` boundary | ✅ |
| D7 carry-forward suggestion + selective copy | agenda `resolution IS NULL` from most-recent held plenary; actions non-terminal, both `can_read_action_item`-filtered; agenda copied via existing `createAgendaItem`, actions read-only | ✅ |
| D8 cadence-overdue N arm only | `compute_due_charter_notifications` (em_atraso only); review-due deferred | ✅ |
| D9 UI | `manage/charter` page + meetings-list badge + carry-forward panel | ✅ |
| D10 SQLSTATE HC0K· | HC0K0/1/2 + HC000 in bodies + `messages.ts` | ✅ |
| D11 flag `charters` seed-ON / prod-OFF | `app.feature_enabled('charters')=t` locally (seed); RPCs gated; pgTAP flag-OFF keystone proves HC000 | ✅ |

**§9 acceptance:** all pgTAP arms present and green (RLS member/non-member/foreign; upsert authority + HC0K1
+ one `charter.upserted` row; cadence × 5 freq × 4 state, `participants_only` excluded, HC0K2; carry-forward
confidentiality filter; N idempotent + recipient + PHI-free; flag-OFF HC000). **E2E** `charters-cadence.spec.ts`
= 10 tests incl. a keyboard-only save pass; Test-pass gate already declared green (lead).

## 3. PHI / Rule 12 — CH holds no patient data

- Charter content lives in the controlled-doc **file** (`storage_path`), never inline.
- Cadence data = frequency enum + `held_at` timestamps + commission names — all non-PHI.
- `charter.upserted` audit metadata = `{meeting_frequency, has_regimento (bool)}` — config-level, PHI-free.
- `charter/overdue` notification body = `'A comissão ' || name || ' está com a cadência de reuniões em atraso.'`
  — commission name + fixed pt-BR string, PHI-free by construction.

## 4. Code quality & notifications

- `src/lib/queries/charters.ts` is `import 'server-only'`; all access via the RPCs / member-RLS table read
  (Rule 9). No inline supabase-js in components.
- **BUG-FBE-005 avoided:** the client `carry-forward-panel.tsx` and `charter-form.tsx` value-import only pure
  modules (`@/lib/charters/types`, `messages`, `labels`) and `"use server"` actions; **no value-import from
  `src/lib/queries/*`**. Server pages own the query calls.
- No bare `any`, no service-role key reachable in any CH file. Generated `database.ts` carries the table + 3 RPCs
  (Rule 8). pt-BR throughout (Rule 10); `mapCharterError` maps HC0K0/1/2 + PG codes to pt-BR — raw Postgres text
  never reaches the UI.
- **Notifications:** `compute_due_charter_notifications` scans base tables inline (mirrors §4, **strict `>`**),
  staff_admin recipients via `memberships`, weekly dedup `charter_cadence:{commission}:{IYYY-IW}` (idempotent),
  `enqueue_notification` opt-out delivery; `kind`/`entity_type` CHECKs **widened preserving all prior values**;
  wired into `compute_due_notifications`.
- **phase17 fix `cb6a671` is spec-only and sound:** touches only `e2e/phase17-documents.spec.ts` + `PROGRESS.md`.
  The DOC-0001 collision is legitimate (doc codes are per-commission; CH seeded Farmácia's regimento as its own
  DOC-0001, colliding with CCIH's on the hospital-admin rollup). The fix scopes the locator to the overdue row
  (deterministically CCIH's, since the regimento review-due 2027 is not overdue) — a correct spec fix, not a
  masked app defect.

## 5. INFO (non-blocking, no action required to pass the gate)

- **INFO-1:** `charter.upserted` audit metadata carries `meeting_frequency` + `has_regimento` — slightly more
  than plan §2's "commission + who". Both are non-PHI config values and consistent with the platform's
  `audit_write` metadata convention; acceptable.
- **INFO-2:** `mapCharterError` has no explicit `HC000` (flag-off) case — it falls through to the generic pt-BR
  string, and the RPC's own HC000 text ("recurso indisponível") is pt-BR anyway. A dedicated
  `CHARTER_MESSAGES.unavailable` string exists but is unused on this path. Cosmetic.
- **INFO-3:** `getCharter` / `getMeetingCadenceStatus` collapse a genuine DB error and a no-row/non-member
  result to `null`/empty. This is safe degradation (documented intent: FE omits the indicator / shows
  "sem regimento"), but a transient error is indistinguishable from "not configured". Acceptable for CH.

---

**Bottom line:** the RLS boundary is real and member-scoped (proven live), the DEFINER write door is the sole
mutation path with authority-first ordering, all three security keystones are RED-provable, the confidentiality
filter holds, CH is PHI-free, and every ADR 0080 decision + §9 criterion is met. **APPROVED.**
