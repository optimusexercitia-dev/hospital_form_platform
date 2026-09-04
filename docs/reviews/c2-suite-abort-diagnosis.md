# C2 suite-abort ERROR class — per-door diagnosis (18 enforcers)

**Date:** 2026-09-04 · **Scope:** `FUP-C2-SUITE-ABORT-ERROR-CLASS` (16 rows) + the 2 rows the
2026-09-04 anchor fix moved into the class · **Phase:** diagnosis only — no edit was made under
`supabase/`, and none is proposed here as landed.

Subject unit: **C2-TIER1** (`docs/features/c2-tier1.md`). This document discharges the diagnosis half
of ADR [0187](../decisions/0187-c2-closes-on-disclosure-and-the-blind-set-is-labelled-by-property.md)
D1's second closure item — *"the ERROR class re-swept"*. It does **not** re-sweep it; it says exactly
what the re-sweep will need, and what it will cost.

⛔ **Tier 2's 190 doors stay deferred by ADR 0171 and are NOT cleared.**

---

## 0 · Method, and what was NOT measured

**Instrument.** A scratchpad driver (`…/scratchpad/c2diag/mutrun.sh`, `mutall.sh`) that reuses
`c2-command-door-neutralizer.sh`'s mutation **byte-for-byte** — the same anchor
(`raise\s+exception\s+'(?:[^']|'')*'[^;]*?errcode\s*(=|=>)\s*'(42501|HC0[A-Z0-9]{2})'[^;]*;` → `null;`),
the same `v_before`/`v_after` counters, the same `pg_get_functiondef` snapshot restored through the
same fixed `INFLIGHT` path. It differs from the harness in exactly one respect: **it keeps the full
TAP output**, which is what a diagnosis needs and what the harness deliberately discards. The harness
itself was not run, not edited, and not read for truth.

**Why a driver and not `SUITE=`/`CASES=`.** The harness prints a shape, not a failure site. Every
line-number and error-text claim below is read out of `pg_prove`'s own **Test Summary Report** and
`psql`'s `ERROR:` lines — not inferred from arithmetic.

**Controls that were run.**

| control | result |
| --- | --- |
| pre-flight, before every mutation | degenerate bodies = 0, `INFLIGHT` empty |
| post-mutation hash restore, every door | `md5(pg_get_functiondef(oid))` returned **exactly** to `h0`, 18/18 |
| full-suite baseline, measured here | **Files=262, Tests=8764, PASS** (94 s) |
| full-suite control **after all 18 mutations** | **Files=262, Tests=8764, PASS**, degenerate bodies = 0, `INFLIGHT` empty |
| committed findings baseline | `git diff --stat -- docs/reviews/c2-command-door-findings.md` **empty** |

**Completeness test for the file map — and it caught a miss.** For each door, the aborting files'
**plan-minus-ran** figures must sum to the door's recorded full-suite delta. They do, for **18 of
18**. The one door where the sum did *not* match on the first attempt was
`app.assert_respondent_linkage_resolved`: the brief's map named `321` alone (−27), against a recorded
−47. A catalog-derived reverse closure (`add_case_participant`, `set_case_participant_role`,
`set_primary_subject`) named `229_authz_m1_exclusion_durability.sql`, and the full-suite run confirmed
it at −20. **20 + 27 = 47.** ⭐ A grep on the enforcer's own name is not a bound on which files enter
it; the catalog's caller closure is.

**⚠ The 2026-09-02 loss figures reproduce EXACTLY at the 8764 baseline.** The brief warned they were
taken against `Tests=8685` and told me to re-derive rather than reuse. I re-derived all 18 — and every
one matched to the test. That is not luck: the delta is a property of *the aborting file's own plan*,
not of the suite total, so it is invariant under suite growth that does not touch that file. Recorded
as a fact so the next reader does not re-run 18 suites to learn it.

**What was NOT measured.**

- **No fix was applied and no fix was verified.** Every "class" and every projected verdict below is a
  reading of the mutated run, not of a repaired one. The projection *"all 18 become COVERED"* is a
  **prediction**, and Phase B's re-sweep is the measurement that can falsify it.
- **Overload safety was checked, not assumed** — all 18 names resolve to exactly one `oid`.
- **I did not check whether any of the 25 aborting statements is load-bearing for a *later*
  assertion in its file** beyond what the run showed. A file that aborts at statement N tells you
  nothing about N+1..end; fixing the abort may surface further failures. That is a Phase B discovery,
  not a Phase A gap.
- **No door outside these 18 was mutated**, so nothing here speaks to the 40 BLIND rows or the other
  ERROR sub-classes.

---

## 1 · The headline: the (a)/(b) dichotomy does not fit, and the gap is where all 18 live

The brief offered two classes:

- **(a)** the abort is at a statement that **directly exercises the neutralized guard** — the suite
  noticed and crashed instead of failing. Remedy: wrap it as an assertion.
- **(b)** the abort is **collateral** and **the suite did not notice** the guard — a keystone is owed.

Measured: **0 doors are (a). 0 doors are (b). 18 of 18 fall in the gap between them**, because (b)
bundles two properties that come apart in every single case here:

> **(c) — the abort is collateral, AND the suite noticed the guard anyway.**
> Every one of the 18 produced at least one genuine pgTAP failure (`# Failed test N … caught: no
> exception … wanted: <code>`) attributable to the mutation, *before* the file aborted. The abort is
> always downstream — a fixture write, or a cardinality/uniqueness violation caused by the door now
> proceeding where it should have been refused.

Consequences, and they are large:

1. **No keystone is owed by this class.** Not one of the 18 is an unnoticed guard. The 39 keystones
   ADR 0187 D1 counts are unaffected — this class adds zero to them.
2. **The remedy is test hygiene, not coverage work.** 25 aborting statements must stop aborting; the
   assertions that already notice the guard then survive to be scored.
3. **The ERROR is an artifact of a *global* shape guard meeting a *local* abort.** The harness
   compares `Files=…, Tests=…` for the whole suite (`c2-command-door-neutralizer.sh:357`). One file
   aborting anywhere collapses the total, so a run that FAILED loudly in a *different* file is still
   refused a verdict. Six of the 18 already have a file that fails **cleanly, with no abort at all** —
   they are COVERED today in every sense except the one the harness can read.

**⭐ The deeper reading, and it is a compliment to the schema.** The single commonest abort mechanism
is not a broken test. It is a **second, independent enforcement layer noticing**: the mutated door lets
a state transition through, and a trigger refuses the next write —
`public.guard_submitted_response` / `guard_submitted_children` / `guard_submitted_signoffs` /
`app.guard_submitted_selections` (Architecture Rules 3 and 5), `app.guard_capa_child_lock`,
`app.guard_interview_child_lock`, `app.guard_professional_linkage`, or a unique index
(`referral_resolutions_one_active`, `referral_case_links_unique`, `evidence_links_unique`,
`printed_documents_one_active`, `case_participants_case_id_participant_id_role_id_key`). The suite
aborts *because the database is defended in depth*. That is the opposite of the failure mode the
ERROR class superficially reads like.

### 1.1 Six doors already carry coverage in a file that does not abort

For these, the fix to the aborting file is the **only** thing standing between the current ERROR and a
COVERED verdict; the evidence already exists elsewhere in the suite.

| door | non-aborting file that FAILS under mutation | failures |
| --- | --- | ---: |
| `public.submit_response` | `276_ff5_references.sql` (Wstat 0, 74 tests) | 5 |
| `public.activate_phase` | `114_phase_blockers.sql` (16), `90_cases.sql` (35) | 2 + 2 |
| `public.assume_role` | `408_ae49_assume_role_session_selectable.sql` (17) | 2 |
| `public.link_referral_related_case` | `295_technical_director_referrals.sql` (61) | 1 |
| `public.set_professional_link_state` | `229_authz_m1_exclusion_durability.sql` (86) | 1 |
| `public.mint_printed_document` | `313` (59), `342` (59), `368` (58) | 4 + 1 + 4 |

---

## 2 · Per-door entries

Every row was measured on 2026-09-04 against the live DB (`supabase_db_azkbbhskturikxpgmafq`) at
baseline `Files=262, Tests=8764`. "Δ" is `plan − ran` for the aborting file. "Recorded Δ" is the
2026-09-02 figure from the register.

Reading key for the remedy column: **W** = wrap the statement in `lives_ok` (adds 1 test, bump the
file's `plan(N)`); **C** = the value subquery became multi-row — add an explicit cardinality assertion
and aggregate the value expression; **S** = special, see the entry.

---

### 2.1 `public.submit_response` — Δ 190 (recorded 190) ⚠ the sharp one

**Coverage verdict projected: COVERED.** It is the response-lifecycle authority (Architecture Rule 3)
and it is *heavily* asserted — the mutation produced failures in **seven** files.

**Anchored raises in its own body (6):**

| code | message |
| --- | --- |
| `HC010` | `esta resposta já foi enviada` |
| `HC0N5` | `o bloco "%" exige ao menos % item(ns) preenchido(s)` |
| `HC011` | `há perguntas obrigatórias sem resposta` (**two** sites, identical message) |
| `HC012` | `há seções pendentes de assinatura` |
| `HC0P9` | `%` — ⚠ a pure runtime format arg; **no message pin is possible on this one** |

**Which to pin:** `HC011` and `HC012` with their literal messages (both are already asserted, code-only,
in five files). `HC0P9` can only ever be pinned by code — record that as a known limit of §3.3's
message-discrimination rule rather than an omission.

**Files, and what happened in each:**

| file | plan → ran | Δ | genuine failure(s) before the abort | abort |
| --- | --- | ---: | --- | --- |
| `271_ff2_matrix_fields.sql` | 90 → 56 | 34 | t39 `HC011`, t45 `HC011` ("ANTI-VACUITY … DO block submit") | `:676` |
| `272_ff2_door_parity.sql` | 30 → 12 | 18 | t12 `HC011` | `:345` |
| `274_ff3_validations.sql` | 96 → 44 | 52 | t42 `HC0P9` | `:1101` |
| `30_submit_response.sql` | 8 → 1 | 7 | t1 `HC011` | `:35` |
| `367_deferred_staff_signoff.sql` | 79 → 4 | 75 | t4 `HC012` | `:122` |
| `80_signoffs.sql` | 19 → 15 | 4 | t12 `HC012`, t13 (queue count 0 ≠ 1) | `:276` |
| `276_ff5_references.sql` | 74 → 74 | **0** | t45 `HC011`, t46, t48, t57, t60 | **none — clean FAIL** |

`34+18+52+7+75+4 = 190` ✓.

**Classification: (c) — collateral, and the suite noticed, in seven files.**
**Reason:** every abort is a *post-submit* write refused by response immutability. The mutation removes
the pre-submit required/sign-off/validation guards, the response flips to `submitted`, and the next
fixture write in the file hits Rule 3/5 enforcement:

- `271:676` — `delete from public.responses where id = 'ff200000-…-33';` →
  `public.guard_submitted_response`: *submitted responses are immutable (delete blocked)*. **W**
- `272:342-345` and `274:1098-1101` — `select public.save_section_answers(…);` →
  `save_section_answers` raises `23514` *esta resposta já foi enviada e não pode mais ser editada*. **W**
- `30:34-35` — `insert into public.answers … select … from ctx c;` →
  `public.guard_submitted_children`: *INSERT on a submitted response is blocked (immutable)*. **W**
- `367:121-122` — `insert into public.response_section_signoffs … select … from k;` → same trigger family. **W**
- `80:272-276` — `select is((select public.get_response_for_signoff(<r2>) ->> 'response_id'), …);` →
  the RPC raises *resposta % não encontrada* because the response is no longer queue-eligible.
  ⚠ **`is()` does not catch** — its argument expression is evaluated before the assertion, so a raising
  expression aborts the file. Remedy: capture into a temp table under `lives_ok`, then assert. **W**

**No keystone owed.** `276_ff5_references.sql` alone would give the verdict.

---

### 2.2 `app.assert_item_bounds` — Δ 51 (recorded 51)

Zero direct pgTAP invocations, as the brief said. **Caller closure (catalog): `public.submit_response`
and `public.resubmit_correction` only.** It aborts wherever `submit_response` is exercised with a
bounded item.

**Anchored raise (1): `HC061`, message `%`.** ⚠ The message is a bare runtime format argument, so
**this door cannot be message-pinned at all** — code-only, and `HC061` is raised elsewhere too. Flagging
it because §3.3's "the message is what distinguishes two worklist rows that share a code" has no
purchase here.

| file | plan → ran | Δ | genuine failure | abort |
| --- | --- | ---: | --- | --- |
| `203_others_and_length.sql` | 17 → 15 | 2 | t15 `HC061` ("shorter than minLength … at submit") | `:225` |
| `274_ff3_validations.sql` | 96 → 49 | 47 | t49 `HC061` ("the legacy lane still raises HC061") | `:1190` |
| `52_submit_item_visibility.sql` | 7 → 5 | 2 | t5 `HC061` ("number below its config min") | `:126` |

`2+47+2 = 51` ✓.

**Classification: (c).** Same mechanism as §2.1 — the bound vanishes, the submit succeeds, immutability
refuses the next write.

- `203:222-225` — `select public.save_section_answers(…);` → *esta resposta já foi enviada…*. **W**
- `274:1187-1190` — `select public.save_section_answers(…);` → same. **W**
- `52:125-126` — `update public.answers set value = '11'::jsonb where …;` →
  *UPDATE on a submitted response is blocked (immutable)*. **W**

**No independent non-aborting file.** After the three edits, the three `HC061` failures survive and the
run FAILs with the shape intact → COVERED.

---

### 2.3 `app.assert_patient_required_fields` — Δ 31 (recorded 31)

Zero direct pgTAP invocations. **Caller closure (catalog):** `public.create_case`,
`public.create_case_from_template`, `public.bulk_create_cases`, `public.set_case_patient`,
`public.set_participant_patient`, `app._set_participant_patient_unchecked`, and — the wide one —
**`app.guard_case_patient_required`, a trigger on `public.cases`**. Its blast radius is every case row
touched by the suite, which is why a full-suite run was the only honest instrument here.

**Anchored raise (1): `HC0T1` — `este processo exige a identificação do paciente: preencha %`.** Pin the
literal prefix (`este processo exige a identificação do paciente`); the tail is a format arg.

| file | plan → ran | Δ | genuine failures | abort |
| --- | --- | ---: | --- | --- |
| `362_patient_mode_and_narrative_rename.sql` | 58 → 27 | 31 | t24, t25, t26 — all `HC0T1` (COMPAT DOOR, MULTI-PATIENT DOOR, the other missing field) | `:257` |

**Classification: (c).**
**Abort:** the assertion spanning `362:250-257` —
`select is((select pi.mrn from public.patient_identifiers pi join public.case_participants cp … where cp.case_id = <case_req>), 'MRN-1', '4.5 …');`
→ *more than one row returned by a subquery used as an expression*. Collateral: tests 4.1–4.3 wrote
patient rows that should have been refused, so the 4.5 read is no longer single-row. Remedy **C** —
add `select is((select count(*)::int from …), 1, '… exactly one identifier row')` immediately before,
and aggregate the value expression so it cannot abort.

⭐ Note the assertion's own comment: *"a lives_ok alone passes on a door that silently did nothing"*.
The file already reasons about this failure family; the edit is in its spirit.

---

### 2.4 `public.activate_phase` — Δ 56 (recorded 56)

**Anchored raises (5):** `42501` *sem permissão* · `HC020` *este caso não está aberto* · `HC019` *esta
fase não está pendente* · `HC018` *conclua ou marque as fases que bloqueiam esta antes de ativá-la* ·
`HC021` *o responsável deve ser membro da comissão*. **Pin `HC018` and `HC021`** — both are already
asserted and both failed under mutation.

| file | plan → ran | Δ | genuine failures | abort |
| --- | --- | ---: | --- | --- |
| `114_phase_blockers.sql` | 16 → 16 | **0** | t8, t11 — `HC018` | **none — clean FAIL** |
| `90_cases.sql` | 35 → 35 | **0** | t10 `HC018`, t14 `HC021` | **none — clean FAIL** |
| `367_deferred_staff_signoff.sql` | 79 → 23 | 56 | t14 `HC018` | `:298` |

**Classification: (c), with independent coverage in two files.**
**Abort:** `367:298` — `select public.skip_phase('…1313'::uuid);` → *apenas fases pendentes podem ser
marcadas como não necessárias*. Collateral: the mutated `activate_phase` activated a phase that should
have stayed blocked, so it is no longer `pendente` when `skip_phase` reaches it. Remedy **W**.

⚠ `367_deferred_staff_signoff.sql` aborts for **two different doors** — here at `:298`, and for
`submit_response` at `:122`. Two independent edits in one file.

---

### 2.5 `app.assert_respondent_linkage_resolved` — Δ 47 (recorded 47) ⚠ the brief's map was short one file

**Anchored raise (1): `HC0F0` — `resolva o vínculo de conta deste profissional antes de indicá-lo como
denunciado`.** Fully message-pinnable.

| file | plan → ran | Δ | genuine failures | abort |
| --- | --- | ---: | --- | --- |
| `229_authz_m1_exclusion_durability.sql` | 86 → 66 | 20 | t9 `HC0F0`, t65 `HC0F0` (+ t10–t16, t66 cascading) | `:746` |
| `321_eth_e4_participant_seating.sql` | 77 → 50 | 27 | t49 `HC0F0` (+ t50 cascading) | `:463` |

`20 + 27 = 47` ✓ — and this is the reconciliation that exposed the missing file (see §0).

**Classification: (c).**

- `229:746` — `select public.set_professional_link_state('…0902', 'no_account', null);` →
  `HC0F2` *o vínculo deste profissional está congelado: ele é parte em um caso ativo*, raised by the
  trigger `app.guard_professional_linkage`. Collateral: t9's refused seating actually happened, which
  made the professional load-bearing and froze his linkage. Remedy **W**.
- `321:461-463` — `create temp table seat_c … select public.add_case_participant(…);` → duplicate key on
  `case_participants_case_id_participant_id_role_id_key`. Collateral: t49's refused seating landed the
  row that the "POSITIVE TWIN" then tries to insert again. Remedy **W** (wrap the `add_case_participant`
  call; the temp table can be populated inside the `lives_ok` body or split into an update).

---

### 2.6 `public.resolve_referral` — Δ 101 (recorded 101)

**Anchored raises (2):** `42501` *apenas a coordenação da comissão de origem pode resolver o
encaminhamento* · `HC0A5` *o encaminhamento precisa estar respondido para ser resolvido*. Pin the
`42501` with its message — `150` already asserts it code-only twice.

| file | plan → ran | Δ | genuine failures | abort |
| --- | --- | ---: | --- | --- |
| `150_referrals.sql` | 218 → 117 | 101 | t116, t117 — both `42501` ("authority, not state") | `:924` |
| `295_technical_director_referrals.sql` | 61 → 61 | 0 | none (PASS) | none |

**Classification: (c).**
**Abort:** `150:924` — `select public.resolve_referral((select id from r6), 'Resumo da resolução SENSIVEL', false);`
→ duplicate key `referral_resolutions_one_active`. Collateral: the two denied resolutions at t116/t117
actually created resolution rows, so the legitimate K2 resolve collides. Remedy **W**.

---

### 2.7 `public.link_referral_related_case` — Δ 61 (recorded 61)

**Anchored raises (5):** `42501` *apenas a coordenação de origem ou destino pode vincular casos
relacionados* · `HC0A8` ×4 (*a direção técnica não vincula casos relacionados* · *tipo de relação
inválido* · *caso relacionado não encontrado* · *este caso já está vinculado com esta relação*).
⚠ Four distinct messages share `HC0A8` — a code-only pin on this door cannot say which arm it measured.

| file | plan → ran | Δ | genuine failures | abort |
| --- | --- | ---: | --- | --- |
| `150_referrals.sql` | 218 → 157 | 61 | t157 `42501` | `:1225` |
| `295_technical_director_referrals.sql` | 61 → 61 | **0** | t45 — wanted `HC0A8`, caught `23502` *null value in column "commission_id" … violates not-null* | **none — clean FAIL** |

**Classification: (c), with independent coverage.**
**Abort:** `150:1223-1225` — `create temp table link1 … select * from public.link_referral_related_case(<r9>, <tgt_case>, 'related_case');`
→ duplicate key `referral_case_links_unique`. Collateral: t157's denied link landed. Remedy **W**.

⭐ `295`'s t45 is worth reading on its own: the test is titled *"NULL-HOLE: … a raw 23502 out of a check
it PASSED"*, and under mutation it falls through to exactly that raw constraint error. The suite
documents the fail-open path it is guarding.

---

### 2.8 `public.confirm_triage` — Δ 23 (recorded 23)

**Anchored raises (6):** `42501` *apenas o NSP pode triar eventos* · `HC045` *a triagem só pode ser
confirmada a partir de um evento reconhecido* · `HC046` ×4 (*complete a triagem antes de confirmá-la* ·
*selecione o motivo de encerramento* · *classifique o alcance do evento antes de confirmar* · *eventos
sentinela exigem RCA — o desfecho não pode ser alterado*). Pin the `HC046` **message** — four arms share
the code.

| file | plan → ran | Δ | genuine failure | abort |
| --- | --- | ---: | --- | --- |
| `141_event_triage.sql` | 44 → 21 | 23 | t21 `HC046` ("sentinel event with a non-rca pathway") | `:218` |
| `142_rca.sql` · `143_capa.sql` | 36 → 36 · 38 → 38 | 0 | none (PASS) | none |

**Classification: (c).**
**Abort:** `141:218` — `select public.save_triage(<sentinel_ev>, true, null, 'sentinel', 'death', false, null, null, '{}');`
→ *o evento precisa estar reconhecido pelo NSP para ser triado*, raised by `public.save_triage` itself.
Collateral: t21's refused confirm went through and moved the event out of `acknowledged`, so the
"clear the bad pathway, then confirm" fixture can no longer save. Remedy **W**.
⚠ The statement psql names at `:218` is the **`save_triage`** call, not the `confirm_triage` call on the
next line — read from the TAP output, not assumed from the section comment.

---

### 2.9 `public.close_capa_plan` — Δ 24 (recorded 24)

**Anchored raises (3):** `HC049` *apenas um plano em execução ou verificação pode ser encerrado* ·
`HC051` *conclua ou cancele todas as ações antes de encerrar o plano* · `HC052` *registre a verificação
de eficácia antes de encerrar o plano*. Pin `HC051` — already asserted, and it failed.

| file | plan → ran | Δ | genuine failure | abort |
| --- | --- | ---: | --- | --- |
| `143_capa.sql` | 38 → 14 | 24 | t14 `HC051` | `:187` |

**Classification: (c).**
**Abort:** `143:187` — `select public.complete_capa_action((select action_id from a));` →
*o conteúdo deste plano de ação está bloqueado (completed)*, raised by the trigger
`app.guard_capa_child_lock`. Collateral: t14's refused close actually closed the plan, so the child
lock now refuses the settle step. Remedy **W**.

---

### 2.10 `public.link_evidence` — Δ 27 (recorded 27)

**Anchored raises (6):** `42501` ×3 (*você não pode gerenciar evidências nesta comissão* · *você não tem
acesso a este caso* · *você não tem acesso a este plano CAPA*) · `HC0QC` · `HC0QA` *este item não
pertence a esta comissão…* · `HC0QB` *esta evidência já está vinculada a este padrão*. ⚠ Three distinct
messages share `42501` — message-pin, not code-pin.

| file | plan → ran | Δ | genuine failures | abort |
| --- | --- | ---: | --- | --- |
| `281_accreditation_evidence_assessment.sql` | 38 → 11 | 27 | t7 `42501`, t9 `HC0QA`, t10 `42501`, t11 `HC0QA` | `:222` |

**Classification: (c).**
**Abort:** `281:219-222` — `create temp table link1 … select (public.link_evidence(<comm_x>, '28100000-…-0001', 'form', '28100000-…-0a01')).id as id;`
→ duplicate key `evidence_links_unique`. Collateral: the four denied links at t7–t11 all landed, so
"B4. the legitimate link succeeds" collides. Remedy **W**.

---

### 2.11 `public.submit_minutes_job` — Δ 71 (recorded 71)

**Anchored raises (2):** `42501` *sem permissão* · `HC0S3` *este processamento não está aguardando envio*.

| file | plan → ran | Δ | genuine failures | abort |
| --- | --- | ---: | --- | --- |
| `305_audio_minutes.sql` | 115 → 44 | 71 | t37 `HC0S3` ("submit on a `done` job → HC0S3 (state), NOT 42501 — the arm is pinned"), t38 `42501` | `:358` |

**Classification: (c).**
**Abort:** `305:355-358` —
`select isnt((select public.save_minutes_draft(<jid>, (select draft from public.meeting_minutes_jobs where id = <jid>))), null, '4.9 ALLOW: a well-formed draft saves and returns its timestamp');`
→ `HC0S3` *esta revisão não está disponível*. Collateral: the mutated submit moved the job out of the
draft-editable state. ⚠ Like `is()`, **`isnt()` evaluates its argument before asserting** — a raising
expression aborts. Remedy **W**: capture the return into a temp table inside `lives_ok`, then keep the
`isnt` on the stored value (this preserves both halves of the original assertion). Adds 1 test.

---

### 2.12 `public.cancel_minutes_job` — Δ 71 (recorded 71)

**Anchored raises (2):** `42501` *sem permissão* · `HC0S3` *este processamento já foi encerrado*.

| file | plan → ran | Δ | genuine failure | abort |
| --- | --- | ---: | --- | --- |
| `305_audio_minutes.sql` | 115 → 44 | 71 | t42 `42501` ("cancel_minutes_job DENY: a plain staff member is refused") | `:358` |

**Classification: (c).**
**Abort: the same statement as §2.11 (`305:358`).** ⭐ **One edit discharges both doors** — the 25-edit
total below counts it once.

---

### 2.13 `public.apply_minutes_review` — Δ 30 (recorded 30)

**Anchored raises (8):** `42501` *sem permissão* · `HC0S3` *esta revisão não está disponível* · `HC0S1` ·
`HC0S4` ×2 · `HC0S5` *o texto da ata contém HTML não permitido* · `HC0S6` ×2. Pin `HC0S5` and `HC0S3`
with messages (`HC0S4` and `HC0S6` each cover two distinct arms).

| file | plan → ran | Δ | genuine failures | abort |
| --- | --- | ---: | --- | --- |
| `305_audio_minutes.sql` | 115 → 85 | 30 | t63 `HC0S5`, t83 `HC0S3` ("a SECOND apply is refused"), t85 (audit rows: have 3, want 1) | `:638` |

**Classification: (c).**
**Abort:** `305:635-638` —
`select is((select metadata->>'agenda_created' from public.audit_log where action = 'minutes_job.applied' and entity_id = <jid>), '2', '7.21 … carrying the COUNTS');`
→ *more than one row returned by a subquery*. Collateral: three applies landed instead of one — which
**t85 on the line above already caught and reported** (`have: 3 / want: 1`). Remedy **C**.

⭐ This is the cleanest illustration in the whole class: the assertion that notices the defect is
immediately followed by one that crashes on the same defect.

---

### 2.14 `public.conclude_interview` — Δ 29 (recorded 29)

**Anchored raises (2):** `HC038` *apenas entrevistas em andamento ou aguardando follow-up podem ser
concluídas* · `HC041` *adicione ao menos um entrevistado antes de concluir*.
⚠ `HC038` is raised by **eight** functions plus the trigger `app.guard_interview_status` — see §3.1.
Pin by **message**, always, on this door.

| file | plan → ran | Δ | genuine failure | abort |
| --- | --- | ---: | --- | --- |
| `121_interviews.sql` | 60 → 31 | 29 | t30 `HC041` | `:218` |

**Classification: (c).**
**Abort:** `121:217-218` — `select public.add_interview_subject(<i1>, <st_x2>, null, 'Enfermeiro(a)', null, null, 'nurse');`
→ *o conteúdo desta entrevista está bloqueado (completed)*, raised by the trigger
`app.guard_interview_child_lock`. Collateral: t30's refused conclude actually concluded `i1`, so the
interview is locked when the fixture tries to add the subject. Remedy **W**.

---

### 2.15 `public.assume_role` — Δ 16 (recorded 16) ⭐ the ADR 0171 / sizing §10 obligation

**Anchored raises (2), both `42501`, distinct messages:**
*papel não selecionável nesta sessão* (the ADR 0176 D7 catalog gate) · *papel não disponível para este
usuário* (the membership gate). ⚠ The two `28000` raises (*não autenticado*, *sessão inválida*) are
**outside the anchor class** — consistent with `nraise = 2`.

| file | plan → ran | Δ | genuine failures | abort |
| --- | --- | ---: | --- | --- |
| `315_act_stage3_hat_condition.sql` | 25 → 9 | 16 | t7 `42501` ("sa_x CANNOT assume a role he does not hold"), t8 (selection row: have `nsp_org_admin`, want `org_admin`) | `:194` |
| `408_ae49_assume_role_session_selectable.sql` | 17 → 17 | **0** | t11 and t16, both `42501` and both **message-pinned** | **none — clean FAIL** |

**Classification: (c), with independent coverage.**

**Abort:** the assertion spanning `315:190-194` —
`select is((select organization_id from public.audit_log where action = 'active_role.assumed' and entity_id = (select v from sid)), (select org_b from k), 'assume_role audit (org-tier): scoped to org_b …');`
→ *more than one row returned by a subquery used as an expression*.

**Mechanism, read from the body (`pg_proc`), not inferred:** `assume_role` upserts
`app.active_role_selections … on conflict (session_id) do update` — one row per session, overwritten —
and then `perform app.audit_write('active_role.assumed', 'active_role_selection', v_session_id, …)`,
which stamps `entity_id = session_id`. Under mutation the second call
(`assume_role('nsp_org_admin')`, the one t7 expects to be denied) **succeeds**, so the session has one
selection row (overwritten — which is exactly what t8 reports) and **two** audit rows sharing an
`entity_id`. The ACT-P0 audit-scope assertion at `:190-194` reads that `entity_id` as a scalar and
aborts.

**Remedy C**, and the stronger form is worth taking: insert
`select is((select count(*)::int from public.audit_log where action = 'active_role.assumed' and entity_id = (select v from sid)), 1, 'assume_role: exactly one active_role.assumed row per session — a DENIED assumption must not be audited');`
before it, and aggregate the value expression (`max(organization_id)`) so it cannot abort. That new
assertion is not padding: *"a denied assumption leaves no audit row"* is a real Rule 11 property that
nothing currently asserts, and it is precisely the property the mutation violates.

**⭐ Verdict for the sizing §10 obligation:** `assume_role` is **not** an unguarded door and **not** an
unnoticed one. `408_ae49` already refuses the mutation twice, with the **message** asserted — and that
file's own comment says why: *"assume_role's pre-existing 'papel não disponível' denial carries the SAME
42501, so an errcode-only assertion would pass if the caller had simply stopped holding the role."*
One edit at `315:190-194` converts its ERROR to a scored **COVERED**. It is the cheapest of the 18 and
should lead Phase B.

---

### 2.16 `public.adjudicate_dsr_request` — Δ 50 (recorded 50)

**Anchored raise (1): `42501` — `apenas o Encarregado deste hospital pode registrar a decisão de uma
solicitação`.** Fully message-pinnable, and `350` already pins the message on two arms.

| file | plan → ran | Δ | genuine failures | abort |
| --- | --- | ---: | --- | --- |
| `350_dsr_adjudication_and_attested_tier.sql` | 75 → 25 | 50 | t18 `42501`; t19, t20 (message-pinned `42501`, caught `HCDS5`); t21 (platform_admin noun rule) | `:558` |
| `349` · `354` | 53 → 53 · 12 → 12 | 0 | none (PASS) | none |

**Classification: (c).**
**Abort:** `350:552-558` —
`select is(public.adjudicate_dsr_request(<req_a>, 'granted', null, 'Parecer 12/2026', array[<meeting_farm>]::uuid[]), 1, 't26 KEYSTONE: a HUMAN adjudication …');`
→ `HCDS5` *esta solicitação já foi decidida; a decisão registrada não pode ser reescrita*. Collateral:
the four denied adjudications at t18–t21 actually decided the request, so the t26 human adjudication is
refused by the immutability guard. Remedy **W** (capture the return under `lives_ok`, then `is` on the
stored value).

⭐ Note the ADR 0187 C3 connection: this is one of the four `HCDS*`/`28000` doors already inside the 171,
and its ERROR was never an anchor problem. Fixing `350:558` gives it a real verdict.

---

### 2.17 `public.set_professional_link_state` — Δ 2 (recorded 2, at the 8764 baseline) ⚠ S — special

**Anchored raises (5):** `42501` ×2 (*apenas a coordenação ou administração da organização pode vincular
profissionais* · *o vínculo deste profissional já está definido; apenas a administração da organização
pode alterá-lo*) · `HC0F0` ×3 (*estado de vínculo inválido* · *informe a conta do profissional para
vinculá-lo* · *somente o estado "linked" aceita uma conta*).

| file | plan → ran | Δ | genuine failures | abort |
| --- | --- | ---: | --- | --- |
| `229_authz_m1_exclusion_durability.sql` | 86 → 86 | **0** | t14 `42501` ("OVER-GRANT TWIN … stops him at AUTHORITY") | **none — clean FAIL** |
| `406_ae47c_operation_split.sql` | 18 → 16 | 2 | t13 `42501`, t14 (row untouched), t16 `42501` | `:243` |
| `320` · `321` | 18 → 18 · 77 → 77 | 0 | none | none |

**Classification: (c), with independent coverage — but the abort is a DELIBERATE SIGNAL.**

**Abort:** `406:236-243`, inside a `do $mut$` block that is itself a mutation harness:

> `if position(v_cut in v_src) = 0 then raise exception '406 §5: the link_state bound was not found
> VERBATIM — the mutation would be a no-op and the twin would report green.' using errcode = 'check_violation';`

This is `406_ae47c_operation_split.sql` §5's **anti-vacuity preflight**. It reads
`pg_get_functiondef('public.set_professional_link_state(uuid, text, uuid)')`, asserts the bound it is
about to neutralize is present verbatim, then removes it and runs a fail-open twin at `5.1`. Under the
C2 mutation the bound's `raise` is already gone, so §5's preflight fires **exactly as designed**. This
is the FUP's *"record why the abort is itself the signal"* branch, and it is the only one of the 25.

⛔ **Do not soften this guard.** Deleting or relaxing the `position(...) = 0` check would let §5's own
mutation become a no-op and make `5.1`'s twin report a false green — the precise failure it was built
to prevent. **Remedy S**, and it needs a lead call:

> Convert the preflight from a `raise` into `select ok(<position(...) > 0>, '406 §5 preflight: the
> link_state bound is present VERBATIM — without it §5''s own mutation is a no-op and 5.1 reports a
> false green')`, and gate the remainder of §5 (the `execute v_new`, the twin, the restore) behind that
> condition using pgTAP `skip(<why>, <n>)` so the plan count is preserved. The file then reports a
> **failing preflight plus skipped twins** instead of aborting, and the C2 harness reads a shape-stable
> FAIL.

Two mutation harnesses stacked on one function is a structural fact, not a bug; this is the cheapest
way to make them coexist without either lying.

---

### 2.18 `public.mint_printed_document` — Δ 12 (recorded 12, at the 8764 baseline)

**Anchored raises (16)** — the largest in the class. `42501` ×2 (*sem autorização para emitir um
documento deste registro* · *sem autorização para emitir a versão identificada deste caso*) · `HC0D1` ×8
(five distinct messages) · `HC0D2` · `HC0D3` ×2 · `HC0D4` · `HC0DP` · `HC0DU`. ⚠ `HC0D1` covers eight
sites and *"registro de origem não encontrado"* appears three times — message-pinning is necessary but
not by itself sufficient to identify the arm on this door.

| file | plan → ran | Δ | genuine failures | abort |
| --- | --- | ---: | --- | --- |
| `312_printed_documents.sql` | 90 → 78 | 12 | t15 `42501`, t16 `42501`, t17 `42501` (platform_admin noun rule), t40 (token format) | `:885` |
| `313_printed_documents_meetings.sql` | 59 → 59 | **0** | t17 `HC0D1`, t18 `42501`, t19 `42501`, t20 | **none — clean FAIL** |
| `342_dm5_s3_printed_renditions.sql` | 59 → 59 | **0** | t57 `HC0D4` | **none — clean FAIL** |
| `368_printed_documents_cases.sql` | 58 → 58 | **0** | t28 `42501`, t35 `42501`, t42 `42501`, t56 `HC0DP` | **none — clean FAIL** |
| `323` · `346` | 13 → 13 · 27 → 27 | 0 | none | none |

**Classification: (c), with independent coverage in three files.**
**Abort:** `312:874-884` — the `insert into public.printed_documents (id, source_kind, …) select r9a.doc_draft, … from r9a, r, k;`
→ duplicate key `printed_documents_one_active`. Collateral: the denied mints at t15–t17 all succeeded
and occupied the active slot for that source. Remedy **W** (wrap the insert in `lives_ok`).

---

## 3 · Task 2 — the two catalog reads that were blocking keystones

Both read from `pg_proc.prosrc` on the live catalog. Neither was read from a migration file.

### 3.1 `public.reopen_interview` (HC038) — **neither branch (a) nor branch (b) holds; a third one does**

The specs doc (§3.2) offered two possibilities. **Both are measurably false.**

**Read 1 — `app.assert_interview_writable` raises `HC039`, not `HC038`.** Its complete body carries
exactly two raises: `no_data_found` (*entrevista % não encontrada*) and

> `if not app.can_write_interview(p_interview_id, auth.uid()) then raise exception 'você não pode editar esta entrevista' using errcode = 'HC039'; end if;`

There is no state check in it at all. **The existing design §3.1 is correct**, and branch **(a) is
false.**

**Measurement — branch (b) is false too.** `CASES`-equivalent re-measurement: mutating
`public.reopen_interview` (hash moved, `v_after = 0`, restored exactly) and running
`121_interviews.sql` gives **`Files=1, Tests=60, Result: PASS`**. The `throws_ok … 'HC038'` at
`121:292-294` still passes with the door's own raise gone. **The BLIND verdict is CORRECT**, and it is
not tail drift and not a partial mutation.

**Read 2 — the real HC038 source is a TRIGGER, downstream, not a delegate upstream.**
`app.guard_interview_status`, a trigger on `public.case_interviews`, carries:

> `if not ( (old.status = 'draft' and new.status in ('scheduled','cancelled')) or … or (old.status = 'completed' and new.status = 'in_progress') ) then raise exception 'transição de estado de entrevista inválida: % -> %', old.status, new.status using errcode = 'HC038'; end if;`

`reopen_interview` sets `app.in_interview_rpc = 'on'` before its `update`, which clears the trigger's
*"mudanças de estado … devem passar pelas RPCs"* arm and lets execution **reach** the transition
allowlist. `cancelled → in_progress` is not in that allowlist. So with the door's own `HC038` replaced
by `null;`, the `update` proceeds and the trigger raises the **same code** — and `121:294`'s
`null`-message `throws_ok` cannot tell them apart.

> **Branch (c): a code-only `throws_ok` satisfied by a DOWNSTREAM trigger sharing the code.** §3.3's
> mechanism is right; its geometry was wrong. The competing enforcer is not earlier in the prologue,
> it is later in the write path — which is why reading the prologue could not settle it.

**⭐ And the competing enforcer is outside C2's population entirely.** `app.guard_interview_status` is a
`trigger`-returning function; the worklist's edge rule (`a.body ~ '\m<name>\M\s*\('`) can never create
an edge to a function nothing calls by name, so it appears in **0** of the 171 rows (verified against
`$WORK/worklist.tsv`). A door can be satisfied by an enforcer this sweep is structurally unable to
score.

**What follows, for both doors:**

- **`public.reopen_interview` — BLIND stands.** A keystone is owed. ⛔ It must **not** use a `cancelled`
  interview: that fixture is satisfied by the trigger. It must use a state where `X → in_progress` **is**
  an allowed transition while the door's own guard (`v_status <> 'completed'`) still fires — i.e.
  **`scheduled`** or **`awaiting_follow_up`** — and it must pin the **message**
  `apenas entrevistas concluídas podem ser reabertas`. Property label (ADR 0187 D2):
  **state / lifecycle**, never authorization.
- **`public.cancel_interview` — branch (a)'s downstream conclusion does NOT follow.** Its `HC038` is
  **not** unreachable dead code and **no D3-style ruling is owed**: `assert_interview_writable` raises
  `HC039`, so nothing pre-empts it. It does, however, need the same care in the *other* direction —
  the trigger backstops a **`completed`** interview (`completed → cancelled` is not in the allowlist)
  but **not** a **`cancelled`** one (`cancelled → cancelled` is not a status change at all, so the
  trigger returns `new` under the RPC flag). ⭐ **A `cancel_interview` keystone must therefore use an
  already-`cancelled` interview and pin the message
  `esta entrevista não pode ser cancelada neste estado`.** A `completed` fixture would be satisfied by
  the trigger and prove nothing.

### 3.2 `app.assert_ethics_typed` (HC0J0) — **the pins have the wrong subject; BLIND stands**

**Prediction stated before the read** (so it could be disconfirmed): the specs doc's *"most likely
resolution"* — all three doors raise `HC0J0` inline and the `:89` comment mis-attributes.

**Measured, over every `public`/`app` function mentioning `HC0J0` or calling `assert_ethics_typed`:**

| door | inline anchored `HC0J0` raises in its **own** body | calls `assert_ethics_typed`? |
| --- | ---: | --- |
| `public.create_case_decision` | **1** | yes |
| `public.schedule_ethics_hearing` | **1** | **no** |
| `public.target_case_response` | **3** | **no** |
| *(context)* `public.submit_ethics_appeal` | 2 | yes |
| *(context)* `app.assert_ethics_typed` | 1 | — |

**The prediction holds, and two of the three are stronger than predicted.** `schedule_ethics_hearing`
and `target_case_response` do not call `app.assert_ethics_typed` **at all** — so the pins at
`256_ethics_e2_hearings.sql:118` and `255_ethics_e2_targeted.sql:137` cannot possibly be measuring it,
under any fixture. `create_case_decision` does call it, but also raises `HC0J0` inline, and with a
`null` message the pin at `258_ethics_e2_rpcs.sql:92` cannot discriminate — the sweep's own BLIND
verdict is the evidence that the inline raise is what fires.

Fifteen `public`/`app` functions raise `HC0J0` inline across the ethics lane; the code is a lane marker,
not a delegate signature.

**What follows:** **the BLIND verdict for `app.assert_ethics_typed` STANDS**, its keystone is owed, and
it is one of ADR 0187 D-M1's four doors with **zero** pgTAP invocations — so unlike the other 35, it
needs a *new* call site, not a deny leg in an existing one. ⛔ The keystone must pin a **message** (or
call `assert_ethics_typed` directly), because `HC0J0` alone cannot name which of sixteen raisers fired.
The `258:89` comment attributing the raise to `assert_ethics_typed` is **wrong** and should be
corrected in the same edit.

---

## 4 · Summary

### 4.1 The classification

| class | count | doors |
| --- | ---: | --- |
| **(a)** abort at a statement directly exercising the neutralized guard | **0** | — |
| **(b)** collateral abort, **guard unnoticed**, keystone owed | **0** | — |
| **(c)** collateral abort, **guard noticed anyway** (the gap in the brief's dichotomy) | **18** | all |
| could not classify | **0** | — |

Of the 18, **6** additionally have a file that fails **without aborting** (§1.1) — they are covered
today by any reading except the harness's global shape check. Of the 25 aborting statements, **1** is a
deliberate anti-vacuity signal (§2.17) rather than a defect.

**⛔ Keystones owed by this class: ZERO.** ADR 0187 D1's keystone count stays at **39**. The ERROR class
is a *scoring* problem, not a coverage gap — which is a materially different conclusion from what the
follow-up's framing ("either fix the test … or record why the abort is itself the signal") allowed for,
and it should be reflected in the register when this lands.

### 4.2 What Phase B owes

**25 statement edits across 21 test files**, plus **21 `plan(N)` bumps**:

| remedy | sites | shape |
| --- | ---: | --- |
| **W** — wrap in `lives_ok` (fixture call or bare RPC that must succeed) | 19 | +1 test each |
| **C** — add a cardinality assertion + aggregate the value expression | 5 | +1 test each |
| **S** — `406` §5 preflight → `ok()` + `skip()` (⚠ needs a lead call, §2.17) | 1 | plan-neutral |

Sites, by file: `30:35` · `52:126` · `80:276` · `121:218` · `141:218` · `143:187` · `150:924` ·
`150:1225` · `203:225` · `229:746` · `271:676` · `272:345` · `274:1101` · `274:1190` · `281:222` ·
`305:358` *(shared by `submit_minutes_job` **and** `cancel_minutes_job` — one edit, two doors)* ·
`305:638` · `312:885` · `315:194` · `321:463` · `350:558` · `362:257` · `367:122` · `367:298` ·
`406:243`.

Two files carry **two independent edits** each: `274_ff3_validations.sql` (`submit_response` and
`assert_item_bounds`), `367_deferred_staff_signoff.sql` (`submit_response` and `activate_phase`),
`305_audio_minutes.sql` (three doors, two statements), `150_referrals.sql` (two doors, two statements).

**Projected suite shape after Phase B: `Files=262, Tests≈8789`** (8764 + 24 `W`/`C` edits at +1 each;
the `S` edit is plan-neutral). ⚠ That is a projection from the recommended shapes, not a measurement —
the exact count depends on the form chosen per site, and **the new number must be re-measured before it
is quoted anywhere**, because it becomes the next sweep's baseline.

**Projected verdicts: all 18 move ERROR → COVERED.** Every one already produces a genuine assertion
failure attributable to the mutation; once no file aborts, `shape_of` is preserved and the harness's
`V = FAIL` path scores it. ⛔ This is a **prediction**. The measurement is the re-sweep —
`CASES="<the 18 names>" bash supabase/tests/mutation/c2-command-door-neutralizer.sh`, 18 × 2 full runs
≈ **60 minutes** at the measured ~100 s/run — and it is what ADR 0187 D1's *"the ERROR class re-swept"*
actually requires. A row that does not come back COVERED is a finding, not a retry.

### 4.3 Order of work

1. **`public.assume_role` first** — the ADR 0171 / `authz-c2-tier1-sizing.md` §10 obligation, one edit
   at `315:190-194`, and the new cardinality assertion is a real Rule 11 property nothing asserts today.
2. **`305_audio_minutes.sql`** — two edits, three doors.
3. The remaining `W` sites, cheapest first.
4. **`406:243` last**, after the lead rules on §2.17.

### 4.4 Things that contradict what was on record

| claim | measured |
| --- | --- |
| specs §3.2 branch (a): `assert_interview_writable` raises `HC038` on a terminal interview | **false** — it raises `HC039`; the existing design §3.1 is right |
| specs §3.2 branch (b): `reopen_interview`'s BLIND is a harness artifact (tail drift / partial mutation) | **false** — re-measured PASS at `Files=1, Tests=60` with the mutation landed and restored |
| specs §6.4: "if branch (a) holds, `cancel_interview`'s `HC038` is unreachable dead code … needs a D3-style ruling" | **moot, and the conclusion does not follow** — branch (a) is false; `cancel_interview` needs a keystone, on an already-`cancelled` fixture |
| the brief's map: `assert_respondent_linkage_resolved` → 1 file (`321`) | **2 files** — `229` (−20) + `321` (−27) = 47 |
| the brief's map: `confirm_triage` → 3 files (`141`, `142`, `143`) | only **`141`** aborts; `142` and `143` pass unchanged |
| the brief's map: `submit_response` → "18 candidate files" | **7** show any effect; **6** abort; `276_ff5_references` fails cleanly |
| the brief: the 2026-09-02 deltas were taken at `Tests=8685` and must be re-derived | re-derived — **all 18 reproduce exactly** at 8764; the delta is a property of the aborting file's plan |
| `FUP-C2-SUITE-ABORT-ERROR-CLASS`: "16 enforcers" | **18** since the 2026-09-04 anchor fix (`ca328539`) moved `set_professional_link_state` and `mint_printed_document` in |
| `FUP-C2-SUITE-ABORT-ERROR-CLASS`: "`Files=259`" and its localization table | `Files=262` today; `resolve_referral` → `150` ✓, `submit_minutes_job` → `305` ✓, `submit_response` → six files not four |
