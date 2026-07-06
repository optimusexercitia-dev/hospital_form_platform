# Phase 15 — Quality Indicators — Backend Plan (tasks B2–B6)

**Author:** `backend` · **Date:** 2026-07-05 · **Branch:** `feat/phase-15-indicators`
**Status:** awaiting lead approval (B1 deliverable — full plan; migrations + RLS + novel compute)
**Spec:** `docs/phases/accreditation-track.md` § Phase 15 (L284–381) · **Decisions:** ADR
[0057](../decisions/0057-indicators-doc-control-replan.md); the derived-compute path gets its own
ADR **0058** (`docs/decisions/0058-derived-measurement-compute.md`, drafted alongside this plan).

Migrations are **forward-only, additive**; numbering starts at **`20260712000000`** (latest live =
`20260711000900`). New SQLSTATEs from **`HC084`** (HC054–HC083 consumed — the old spec's HC054/HC058
are NOT reused). Types regen after every migration (Rule 8).

---

## 0 · CAPA-surface confirmation (B1 (a) — closes the pre-WS-3c-baseline risk)

Opened `supabase/migrations/20260711000600_capa_tenant_anchor.sql` and baseline
`20260620000000_baseline.sql`. All three ★ facts confirmed **exactly** as briefed — no discrepancy:

- **`open_capa_plan(p_source text, p_classification text default 'corretiva', p_source_id uuid
  default null, p_hospital_id uuid default null)`** (L175). `source ∈ {rca,event,indicator,
  audit_finding,meeting,manual}` (L194). `indicator` is currently in the **non-derivable** branch:
  `v_hospital` resolves only for event/rca/meeting (L218–223, `else null`); for indicator it needs
  `p_hospital_id` or the single-operator-hospital auto-derive, else **HC083** (L245). Authority =
  `if v_hospital is null or not app.is_pqs_operator_of(v_hospital) then raise 42501` (L251).
- **`can_write_capa(p_capa_id, p_uid)` = `app.is_pqs_operator_of_for(capa.hospital_id, p_uid)` only**
  (L102–108, the collapsed WS-3c posture). **Phase 15 does NOT touch it.**
- **`can_read_capa`** = `is_pqs_operator_of_for(hospital_id, uid) OR can_read_event(event_of_capa,
  uid)` (L121–129).
- **`capa_plan.source_indicator_id`** (baseline L7487) and **`capa_measure.indicator_id`** (baseline
  L5945) are **bare UUID, NO FK** — both comment "FK-LESS forward hook (Phase 15). Add the FK then."
- `capa_plan.hospital_id` NOT NULL, FK→hospitals, unique `(hospital_id, code)`, auto-filled by
  `derive_capa_hospital()`; `mint_capa_code()` per-hospital advisory-lock + per-hospital `max+1`.

**Conclusion:** the two-tier hook (B6) is well-defined against the *current* surface — I move
`indicator` into the derivable branch (resolve hospital from the indicator's commission) and add the
`can_read_capa` indicator arm, leaving `can_write_capa` untouched.

---

## 1 · Migration set (B2 — `20260712000000_indicators_core.sql`)

### 1.1 `public.indicators`

```
id                 uuid pk default gen_random_uuid()
commission_id      uuid NOT NULL references public.commissions(id) on delete restrict
code               text NOT NULL                 -- per-commission mint 'IND-####'
name               text NOT NULL check (length(btrim(name)) > 0)
description_md     text                          -- sanitized Markdown (Rule 7); NEVER audited
kind               text NOT NULL check (kind in ('percentual','taxa','contagem','tempo_medio'))
numerator_label    text
denominator_label  text
unit               text
direction          text NOT NULL default 'maior_melhor'
                     check (direction in ('maior_melhor','menor_melhor'))
target_value       numeric
target_comparator  text NOT NULL default '>=' check (target_comparator in ('>=','<=','=','>','<'))
lower_warn         numeric
upper_warn         numeric
frequency          text NOT NULL default 'mensal'
                     check (frequency in ('mensal','bimestral','trimestral','semestral','anual'))
data_source        text NOT NULL default 'manual'
                     check (data_source in ('manual','derivado','hibrido'))
derived_config     jsonb                         -- null iff data_source='manual'
status             text NOT NULL default 'ativo' check (status in ('ativo','arquivado'))
created_by         uuid references auth.users(id)
created_at         timestamptz NOT NULL default now()
updated_at         timestamptz NOT NULL default now()

unique (commission_id, code)
-- data_source/config coherence: manual ⇒ config null; derivado/hibrido ⇒ config not null
check ((data_source = 'manual') = (derived_config is null))
-- taxa ⇔ hibrido, and hibrido ⇔ taxa (the rate is the only hybrid mode)
check ((kind = 'taxa') = (data_source = 'hibrido'))
```

`derived_config` **shape is validated in the RPC layer** (against the published version via
`version_has_option_code`), not by a CHECK — the same discipline as `visible_when`/`recommend_when`
(a CHECK cannot cross-reference `form_item_options`). A raw insert is blocked anyway: RLS write is
member-gated but the columns are only writable through the DEFINER RPCs (see §1.4 grant posture).

### 1.2 `public.indicator_measurements`

```
id            uuid pk default gen_random_uuid()
indicator_id  uuid NOT NULL references public.indicators(id) on delete cascade
period_label  text NOT NULL check (length(btrim(period_label)) > 0)  -- e.g. '2026-06'
period_start  date
period_end    date
numerator     numeric
denominator   numeric
value         numeric
status        text NOT NULL default 'sem_dados'
                check (status in ('na_meta','fora_da_meta','sem_dados'))
source        text NOT NULL check (source in ('manual','derivado'))
note          text
entered_by    uuid references auth.users(id)
entered_at    timestamptz NOT NULL default now()

unique (indicator_id, period_label)
check (denominator is null or denominator <> 0)   -- zero-denominator guard (belt; RPC raises HC087)
```

`status` is **stored** (computed by the RPC at write time) so `indicator_kpis` / rollup can
aggregate without recomputing per-target; it is re-derived whenever `value` or the target changes
(`set_indicator_target` re-classifies existing rows).

### 1.3 `app.mint_indicator_code()` — per-commission (reuses the `mint_meeting_number` pattern)

BEFORE-INSERT trigger on `public.indicators`: `pg_advisory_xact_lock(hashtextextended(
new.commission_id::text, 0))` then `new.code := 'IND-' || lpad((coalesce(max(...),0)+1)::text,4,'0')`
filtered to the commission (mirrors `mint_meeting_number` / `mint_capa_code`). Format `IND-####`,
per-commission-numbered.

### 1.4 Flag seed — **OFF**

```
insert into app.feature_flags (key, enabled, description)
values ('quality_indicators', false, 'Indicadores de qualidade (Fase 15)')
on conflict (key) do update set description = excluded.description;
```
Plus `app.assert_quality_indicators_enabled()` (raises when off, mirrors
`assert_meetings_enabled`) — every RPC calls it first. TS `FeatureFlags` gains `quality_indicators:
boolean` (`src/lib/queries/feature-flags.ts`). Flag flips **ON in B6** (last backend task).

### 1.5 RLS (Rule 1)

Both tables `enable row level security`. Policies:

- **SELECT** (`indicators` + `indicator_measurements`): `app.is_member_of(commission_id) OR
  app.is_org_admin_of_commission(commission_id)` (the exact member-read shape used by `forms_select` /
  `meetings_select`) — for measurements, resolve the commission via the parent indicator (subselect).
  Members read; foreign-commission users read nothing.
- **INSERT/UPDATE/DELETE**: `app.is_staff_admin_of(commission_id) OR
  app.is_commission_admin_of(commission_id)` (the post-ADR-0051 combined predicate). `staff` cannot
  write.
- **The hospital tier gets NO table grant** — it reads ONLY via `hospital_indicator_rollup` DEFINER
  (§2.4). This is the whole multi-tenancy story: no dual-scope ownership (ADR 0057 dec. 2).

Even with member-write RLS, the write columns flow through the DEFINER RPCs (which enforce the
staff_admin/commission_admin gate + validate `derived_config`); direct table INSERT by a member is
additionally shut by revoking table-level INSERT/UPDATE/DELETE from `authenticated` and routing all
writes through the RPCs (the membership-write-lockdown posture, WS-1). **Decision point for the
lead:** either (a) RLS write-policy + table grant (members with staff_admin can write directly), or
(b) zero-write-policy + DEFINER-only door (matches the hardened WS-1 posture). I recommend **(a)**
— the spec says "member-read / staff_admin-write" as an RLS shape and there is no PHI here; the
DEFINER RPCs remain the app's only write path but a raw authenticated write by a staff_admin of the
commission is not a security hole (unlike the membership tables). Flag which you want.

### 1.6 Audit AFTER-triggers (Rule 11 — non-sensitive allow-list, **never `description_md`**)

`app.trg_audit_indicators()` AFTER INSERT/UPDATE/DELETE and `app.trg_audit_indicator_measurements()`
AFTER INSERT/UPDATE/DELETE. Both use `app.audit_write(action, entity_type, entity_id, commission,
summary, metadata, organization, hospital_id)` (8-param), deriving org+hospital from the commission
via `app.org_of_commission` / `app.hospital_of_commission`, and `app.audit_diff(old, new, cols)` over
a **`constant text[]` allow-list**:

- `indicators` allow-list: `array['name','kind','direction','target_value','target_comparator',
  'frequency','data_source','status']` — **excludes `description_md`** (free-text, Rule 11) and
  `derived_config` (may embed labels; keep it out of the log too).
- `indicator_measurements` allow-list: `array['period_label','numerator','denominator','value',
  'status','source']` — **excludes `note`** (free-text).

Actions: `indicator.created` / `indicator.updated` / `indicator.archived` / `indicator.deleted`;
`indicator_measurement.recorded` / `.updated` / `.deleted`. Summaries pt-BR (`'Indicador criado: '
|| new.code`, etc.). This satisfies the acceptance "editing a measurement writes an audit row".

---

## 2 · RPC set (B3 = CRUD + record; B4 = derived compute; B5 = reads)

All `public.*` RPCs: `SECURITY DEFINER`, `set search_path to 'app','public','pg_catalog'`, first line
`perform app.assert_quality_indicators_enabled()`, and the t19 grant hygiene
(`revoke all … from public; grant execute … to authenticated, service_role`). Authority checks use
`is_staff_admin_of(commission) OR is_commission_admin_of(commission)` unless noted.

### 2.1 CRUD (B3)

- **`create_indicator(p_commission, p_name, p_kind, p_direction, p_data_source, p_frequency,
  p_target_comparator, p_target_value, p_numerator_label, p_denominator_label, p_unit,
  p_description_md, p_lower_warn, p_upper_warn, p_derived_config jsonb default null)`** → `indicators`.
  Gate the commission; **validate `derived_config`** (§3.5) when `data_source <> 'manual'`; insert
  (code minted by trigger). Returns the row.
- **`update_indicator(p_id, … same definition fields …)`** — re-validate `derived_config` if changed;
  cannot change `commission_id`.
- **`archive_indicator(p_id)`** — `status := 'arquivado'`.
- **`set_indicator_target(p_id, p_target_value, p_target_comparator, p_lower_warn, p_upper_warn)`** —
  updates the target AND **re-classifies every existing measurement** of the indicator
  (`app.classify_measurement`, §3.1) so the run chart/KPIs reflect the new target immediately.

### 2.2 `record_indicator_measurement` (B3 — manual)

`record_indicator_measurement(p_indicator, p_period_label, p_numerator, p_denominator, p_note default
null, p_period_start default null, p_period_end default null)`. Gate; compute
`value := app.compute_value(kind, numerator, denominator)` (§3.1) — for `percentual` = num/den×100,
`contagem`/`tempo_medio`-manual = num, `taxa` = num/den×1000; `status := app.classify_measurement(
value, target, comparator, direction)`. **Upsert on `(indicator_id, period_label)`**, `source =
'manual'`. HC086 if the indicator is not manual (manual RPC on a derived indicator). HC087 on
zero/invalid denominator when the kind needs one.

### 2.3 `compute_derived_measurement` (B4 — the ADR 0058 path) — see §3

### 2.4 Reads (B5)

- **`indicator_series(p_indicator, p_from text default null, p_to text default null)`** DEFINER —
  gate `is_member_of OR is_org_admin_of_commission` (members see their own indicators' trend); returns
  `(period_label, period_start, value, target, status)` ordered by `period_start nulls last,
  period_label`, windowed by `period_label` bounds. `target` echoes the indicator target.
- **`indicator_kpis(p_commission)`** DEFINER — gate `is_staff_admin_of OR is_commission_admin_of`;
  returns `(total, na_meta, fora_da_meta, sem_dados)` counting **active** indicators by their LATEST
  measurement's `status` (indicators with no measurement → `sem_dados`). Zeros for a non-privileged
  caller (return empty → mapped to zeros in TS, mirrors `capa_kpis`).
- **`hospital_indicator_rollup(p_hospital)`** DEFINER — gate `app.is_hospital_admin_of(p_hospital) OR
  app.is_org_level_admin_within(app.org_of_hospital(p_hospital))`; returns
  `(commission_id, commission_name, total, na_meta, fora_da_meta, sem_dados)` for **each commission of
  the hospital** (`hospital_of_commission = p_hospital`). **PHI-free + minimum-necessary SELECT list:
  counts + names only — NO indicator name/definition/value/`description_md`.** Mirrors `nsp_org_*`
  aggregate doors. `[]` for a foreign hospital_admin.

---

## 3 · Derived-compute design (B4 — the ADR 0058 content, summarized)

**Parity contract:** a `derivado` value **equals** `public.dashboard_distributions(form_id, from, to)`
for the same window — the pgTAP parity lock. The compute RPC does NOT call
`dashboard_distributions` (that RPC gates on `is_staff_admin_of OR is_admin`, and returns per-option
rows); instead it **re-uses the identical aggregate mechanics** over `app.submitted_form_responses(
form_id)` so the numbers coincide by construction. The two share the canonical submitted spine
(`status='submitted' AND case_phase_id IS NULL`), the option-`code` grouping
(`answer_selected_options → answers → form_items → form_item_options`), and the same period window on
`submitted_at::date`.

### 3.1 Value + classification helpers (shared, IMMUTABLE-ish `app` fns)

- `app.compute_value(kind, num, den)`: percentual → `num/den*100`; taxa → `num/den*1000`; contagem /
  tempo_medio → `num`. Null when a needed denominator is null/0.
- `app.classify_measurement(value, target, comparator, direction)`: `sem_dados` when value null; else
  evaluate `value <cmp> target`. **Off-target across BOTH directions** is inherent — the comparator
  already encodes the pass condition (e.g. `>= 90` with `maior_melhor`, `<= 2` with `menor_melhor`);
  `direction` drives only the warning-band side and the chart, not the on/off decision. On-target ⇒
  `na_meta` else `fora_da_meta`. (pgTAP asserts both a `maior_melhor/>=`  and a `menor_melhor/<=`
  indicator classify correctly.)

### 3.2 percentual / contagem derived compute

`derived_config = {form_id, numerator:{question_key, option_codes[]}, denominator:{question_key} |
'respondentes'}`.

- Resolve the **latest published version** `app.latest_published_version(form_id)` for code
  validation (labels can change across versions; `code` is stable).
- **Numerator** = count of `answer_selected_options` rows, over the windowed
  `submitted_form_responses`, where the item's `question_key = numerator.question_key` and the option
  `code ∈ numerator.option_codes` — i.e. `sum(option_count)` over the config's codes in the
  `dashboard_distributions` `tally` CTE. (For checkbox items a response can contribute multiple
  selections; this MATCHES the dashboard, which counts per selection-row — parity by construction.)
- **Denominator**:
  - `{question_key}` → the `dashboard_distributions` **`denom`** for that key = distinct responses
    that answered ANY question in that key's section (section-answered distinct-response count).
  - `'respondentes'` → `count(*)` of the windowed `submitted_form_responses`.
- `value` (percentual) = num/den×100; `contagem` returns the raw numerator (`den` recorded for
  provenance but `value = numerator`).

### 3.3 tempo_medio derived compute

`derived_config = {form_id, value:{question_key}}`. `value := avg(a.value_number)` over
`answers a join submitted_form_responses` where `a.question_key = value.question_key` and
`a.value_number is not null` (the answer-model-v2 typed column). `numerator := round(avg,4)`,
`denominator := count(*)` (n of answers averaged), `value := numerator`.

### 3.4 hybrid taxa — **one-step, born complete**

`derived_config = {form_id, numerator:{question_key, option_codes[]}}` (numerator shape only).
`compute_derived_measurement(p_indicator, p_period_label, p_denominator numeric default null,
p_period_start default null, p_period_end default null)`:

1. Derive the **numerator** exactly as §3.2's numerator.
2. **Denominator resolution — the preserve rule:**
   - if `p_denominator` is supplied → use it (and store it);
   - else if a measurement row already exists for `(indicator, period)` with a non-null
     `denominator` → **reuse the stored denominator** (recompute re-derives ONLY the numerator);
   - else → **HC088** "informe o denominador" (hybrid needs a denominator; no partial row is ever
     written — the row is born complete or not at all).
3. `value := num/den*1000`; classify; **upsert** `source='derivado'`. There is no partial-measurement
   status — `sem_dados` stays the only empty state.

For **non-hybrid derived** kinds, `p_denominator` is ignored (HC085 if passed for a manual
indicator; for derivado it is simply unused).

### 3.5 `derived_config` validation (on save — `create/update_indicator`)

`app.validate_indicator_derived_config(p_kind, p_data_source, p_config jsonb)`:

- shape check per kind (required keys present; `option_codes` a non-empty text array; `form_id` a
  real form of the indicator's commission);
- **every option `code`** in `numerator.option_codes` (and the `denominator.question_key` for the
  percentual denominator) must exist in the form's latest published version — reuse
  `app.version_has_option_code(latest_version, question_key, code)` and a `question_key`-exists check;
- reject unknown/invalid → **HC084** `'configuração derivada inválida'` / `'código de opção
  desconhecido: %'`.

This makes "an unknown option code is rejected at save" a save-time guarantee (acceptance + pgTAP).

---

## 4 · CAPA hook — two-tier (B6). **`can_write_capa` NOT widened.**

New migration `20260712000300_indicators_capa_hook.sql` (after the indicators table + RPCs exist so
the FK targets resolve):

### 4.1 Real FKs on the forward hooks

```
alter table public.capa_plan
  add constraint capa_plan_source_indicator_id_fkey
  foreign key (source_indicator_id) references public.indicators(id) on delete set null;
alter table public.capa_measure
  add constraint capa_measure_indicator_id_fkey
  foreign key (indicator_id) references public.indicators(id) on delete set null;
```
`ON DELETE SET NULL` (an indicator delete must not cascade-destroy a CAPA plan/measure — the
improvement record outlives the metric). Comments updated to drop "FK-LESS forward hook".

⚠ **PGRST201 watch** (memory: a new FK to an already-reachable table breaks un-hinted PostgREST
embeds). `capa_plan`/`capa_measure` embeds elsewhere must not implicitly traverse
`source_indicator_id`; I'll grep the query layer and pin any affected embed. `listCapaPlansForEvent`
etc. select scalar columns only (no `indicators(...)` embed), so this is low-risk, but I verify.

### 4.2 `open_capa_plan` — move `indicator` into the DERIVABLE branch

`CREATE OR REPLACE` the 4-arg `open_capa_plan`. Add an `indicator` case to the `v_hospital`
resolution so it derives from the indicator's commission (no manual `p_hospital_id` for this source):

```
v_hospital := case
  when p_source = 'event'     then app.hospital_of_event(v_event)
  when p_source = 'rca'       then app.hospital_of_event(app.event_of_rca(v_rca))
  when p_source = 'meeting'   then app.hospital_of_commission(app.commission_of_meeting(v_meeting))
  when p_source = 'indicator' then app.hospital_of_commission(
                                     (select commission_id from public.indicators where id = v_indicator))
  else null   -- audit_finding / manual: still non-derivable
end;
```

Authority is unchanged (`is_pqs_operator_of(v_hospital)` → 42501 otherwise), so **write stays
PQS-operator-gated**. A non-operator staff_admin who somehow calls it gets 42501 → the pt-BR "apenas
o NSP…" message; the UI never shows them the button (F5 capability-gates on `is_pqs_operator_of` and
routes them to the Action-Items Hub instead). Drop-and-recreate resets grants → re-assert t19.

### 4.3 `can_read_capa` — add the indicator arm (commission members read)

`CREATE OR REPLACE can_read_capa` adding a third OR term so the **indicator's commission members**
read an indicator-sourced plan (mirror of the event-source reporting-committee rule):

```
select
  app.is_pqs_operator_of_for((select hospital_id from public.capa_plan where id = p_capa_id), p_user_id)
  or app.can_read_event(app.event_of_capa(p_capa_id), p_user_id)
  or exists (                       -- NEW: indicator-sourced plan → its commission's members
    select 1 from public.capa_plan cp
    join public.indicators i on i.id = cp.source_indicator_id
    where cp.id = p_capa_id and cp.source = 'indicator'
      and app.is_member_of_for(i.commission_id, p_user_id)
  );
```
Uses the uid-pure **`app.is_member_of_for(commission, uid)`** (confirmed to exist,
`20260702000000_user_registration.sql` L219) — correct because `can_read_capa` is DEFINER +
uid-parameterized. This backs `listCapaPlansForIndicator` and the acceptance "the indicator's
commission members can read it".

### 4.4 Non-operator fallback — **no schema change**

The "Criar item de ação" path reuses the **shared Action-Items Hub** `createActionItem`
(`src/lib/cases/action-items-actions.ts` → `create_committee_action_item`, `source_type='case'`… or
a source-agnostic committee item). F5 pre-fills it with the indicator context. My `actions.ts` stub
documents this pointer; there is **no** indicator-specific action-item RPC.

---

## 5 · SQLSTATE allocations (from `HC084`)

| Code | Condition | pt-BR message |
| ---- | --------- | ------------- |
| `HC084` | invalid/unknown derived config or option code (save-time) | `'configuração derivada inválida'` / `'código de opção desconhecido: %'` |
| `HC085` | `compute_derived_measurement` / a `p_denominator` passed on a **manual** indicator | `'este indicador é manual; use o lançamento manual'` |
| `HC086` | `record_indicator_measurement` (manual) called on a **derived** indicator | `'este indicador é derivado; use o cálculo automático'` |
| `HC087` | zero/invalid denominator for a kind that needs one | `'o denominador deve ser diferente de zero'` |
| `HC088` | hybrid `taxa` compute with no denominator (and none stored to reuse) | `'informe o denominador'` |

(If B4 surfaces a need for "no published version to derive from", I'll allocate `HC089`
`'o formulário não possui versão publicada'` and note it — not pre-allocating to avoid gaps.)

---

## 6 · Testing note (required)

pgTAP files (run via the **full ordered `supabase test db` after a fresh `supabase db reset`** — a
suite is not independently runnable; a fixture missing the flag enable silently skips flag-guarded
keystones, so the fixture MUST enable `quality_indicators`):

- **`supabase/tests/NNN_indicators.sql`** (new suite):
  - **PARITY LOCK** — a derived `percentual` indicator bound to option `code`s over a seeded form:
    `compute_derived_measurement` `value`/`numerator`/`denominator` **==** the aggregate computed
    directly from `dashboard_distributions(form, from, to)` for the same window (assert equality, not
    just presence). Also a `contagem` and a `'respondentes'`-denominator variant.
  - **tempo_medio** — value == `avg(value_number)` of the seeded numeric answers.
  - **hybrid** — one-step compute (numerator derived + typed denominator) yields the right taxa;
    **preserve-on-recompute** (recompute without `p_denominator` reuses the stored denominator;
    numerator re-derives); denominator-required (HC088) when none supplied and none stored.
  - **unknown option code rejected at save** (HC084) via `create_indicator` with a bogus code.
  - **off-target across both directions** — a `maior_melhor/>=` and a `menor_melhor/<=` indicator
    classify `na_meta`/`fora_da_meta` correctly at boundary values.
  - **KPI counts** — `indicator_kpis` returns the right na-meta/fora-da-meta/sem-dados/total.
  - **RLS scoping** — a foreign-commission user reads no indicator/measurement; a `staff` cannot
    write; the rollup returns rows for a hospital_admin of the hospital and **nothing** for a foreign
    hospital_admin; assert the **rollup SELECT list is PHI-free** (no name/definition/value columns —
    a column-name assertion, mirroring the `nsp_org_*` keystone).
  - **the two new FKs resolve** — `capa_plan.source_indicator_id` and `capa_measure.indicator_id`
    reference `public.indicators` (catalog assertion); an indicator delete SETs them NULL (no
    cascade).
  - **CAPA two-tier** — `open_capa_plan('indicator', …)` by a PQS operator of the indicator's
    hospital succeeds and the plan carries the derived `hospital_id`; by a non-operator raises 42501;
    the indicator's commission member can `can_read_capa` the resulting plan; a foreign member cannot.

- **Vitest**: extend `src/lib/queries/feature-flags.test.ts` (or equivalent) for the new flag key if
  a lock exists; no evaluator vectors change (Rule 3 untouched — indicators do not touch
  `eval_condition`).

- **E2E** (tester, later gate): the acceptance flows in the spec (manual trend exactness, derived ==
  dashboard, tempo_medio, hybrid one-step + preserve, two-tier CAPA affordance, loop-closure across
  14+15, audited measurement edit, RLS negatives, one keyboard-only pass).

---

## 7 · Flag flip (B6, last)

After CRUD (B3) + compute (B4) + reads (B5) + the CAPA hook land and pgTAP is green, flip
`quality_indicators` → **ON** in a final migration (mirror `…090008` flag-flip pattern), regen types,
run the full ordered pgTAP + a fresh `db reset`, and hand to the gate. Remote `db push` needs user
authorization (background agents are auto-denied) — I'll flag it for the lead.

---

## Open questions for the lead (blockers before B2)

1. **RLS write posture (§1.5):** option (a) member-write RLS policy + table grant (my recommendation,
   matches the spec's "staff_admin-write" RLS shape; no PHI), or (b) zero-write-policy DEFINER-door
   (the hardened WS-1 posture). I'll implement whichever you pick.
2. **Predicate inventory — all VERIFIED present, no new helper needed.** `app.is_member_of` +
   uid-pure `app.is_member_of_for` (user_registration L209/L219), `app.is_org_admin_of_commission`,
   `app.is_staff_admin_of` + `_for`, `app.is_commission_admin_of` + `_for` (commission_admin_predicate
   L89), `app.is_hospital_admin_of`, `app.is_org_level_admin_within`, `app.org_of_hospital`,
   `app.hospital_of_commission`, `app.org_of_commission` all exist. (My earlier draft mis-named the
   member primitive `is_commission_member_of*`; corrected to `is_member_of*` throughout.)
3. **Rollup gate** — `is_hospital_admin_of OR is_org_level_admin_within(org)` matches `nsp_org_*`;
   confirm you want org-level admins included (I believe yes — the hospital scorecard is a
   hospital/org governance view).
