# DM5 (Wave D + retirement) pre-phase surface verification

**Status:** read-only audit. No migrations, no application code, no mutating SQL.
Branch `main` @ `f804a03f`.

**Method (binding, CLAUDE.md).** The live local-stack catalog is the sole truth for
every schema / RLS / RPC / ACL claim, queried via
`docker exec supabase_db_azkbbhskturikxpgmafq psql -U postgres -d postgres`.
Migration text was never read as a fact. `graphify` was not used for SQL (it does not
index it) and `graphify update` was not run. The remote/linked project was **not**
touched — no `db push`, no `db:reset:linked`, no remote query; every production claim
below is tagged **UNVERIFIED — remote**. No `supabase db reset` was run (shared stack).

Every claim is tagged **[catalog]** (a catalog query, quoted), **[fs]** (the storage
volume / Storage HTTP API), or **[code]** (a file:line I read). Where a claim could not
be established it says **UNVERIFIED** and why.

Plan source: `docs/plans/document-model-redesign.md` § "Phase DM5 — Wave D +
retirement" (steps 1–5 + exit) and the "Program invariants" block.
Benchmark/format: `docs/progress/dm4-surface-verification.md`.

---

## 0. Section A — REGISTRY SANITY (gate for everything below)

**[catalog]**

```sql
select count(*) from supabase_migrations.schema_migrations;   -- 391
select max(version) from supabase_migrations.schema_migrations; -- 20260926000500
```

```
ls -1 supabase/migrations | wc -l   →  391
```

**391 registered = 391 files. PASS** — the catalog audit below runs on an
undrifted DB. Next DM5 migration window opens **above 20260926000500**.

---

## 1. DIFF TABLE — plan-named vs. reality (the headline)

| Plan names | Reality | Verdict |
|---|---|---|
| `rca_evidence` holds an inbound FK into `attachments` | Column is now **`cited_document_id uuid` NULL, with NO FK at all** — *and* a table CHECK **`rca_evidence_cited_document_parked CHECK (cited_document_id IS NULL)`**. 0 rows in the table locally | **RENAMED + HARDER THAN RECORDED** — the plan (and DM1 step 10) describes only a dropped FK + a fail-closed writer; there is a **third** lock, a CHECK constraint, that DM5 must drop too |
| `add_rca_evidence` | `public.add_rca_evidence(...)` exists, `prosecdef=t`, ACL `postgres/authenticated/service_role`, returns composite `rca_evidence`. Citation-document arm raises **`HC0DM`** | **CONFIRMED** |
| pgTAP `328` K8b parked "until Wave D" | Live and active at `supabase/tests/328_dm1_document_substrate.sql:780-793` | **CONFIRMED** (quoted in §2.3) |
| `printed_pdf` rendition kind | **ALREADY EXISTS** — but as a **CHECK constraint, not an enum**: `document_version_files_rendition_check CHECK (rendition_kind = ANY (ARRAY['source','redacted','preview','signed','printed_pdf']))` | **CONFIRMED — already present** |
| "verification tokens stay in a **satellite**" | **They are NOT in a satellite today.** `verification_token` + `verification_short_code` are columns on **`printed_documents` itself**, the same table that holds `storage_path` | **ABSENT** — the satellite must be **created** by DM5, not "kept working" |
| `revoke_printed_document` owns SQLSTATE `HC0D5` | **CONFIRMED** — `raise exception 'este documento já foi anulado' using errcode = 'HC0D5'`; corroborated by the `328` K14 header note ("HC0D5 is TAKEN by revoke_printed_document") | **CONFIRMED** |
| "4 production objects migrate copy→verify→switch" | **LOCAL: 0 `printed_documents` rows**, 0 `file_objects`, 0 `document_version_files`. Local `printed-documents` volume holds **87 orphaned byte-files** (§5). Production count **UNVERIFIED — remote** | **CONFIRMED as UNVERIFIABLE here** |
| `meeting-attachments` in the 9-bucket manifest ("if it exists") | **Does not exist.** 12 buckets live; `meeting-attachments` is absent, and `supabase/tests/325_legacy_bucket_policy_pin.sql:54-56` already pins its absence | **ABSENT** — the manifest is **8** buckets, not 9 |
| "NSP hard exclusions / PQS custody predicates preserved" | The predicates are `app.can_read_event`, `app.can_write_rca`, `app.can_read_capa`, `app.is_pqs_writer_of` — named in §2.5 | **CONFIRMED (identified)** |
| "Uploaded evidence vs. external links kept distinct" | `rca_evidence.kind ∈ {document,link,citation}` + `rca_evidence_shape` CHECK; `capa_action_evidence.kind ∈ {document,link}` + `capa_action_evidence_shape` CHECK | **CONFIRMED** |
| *(not named)* | **`capa_action_evidence`** — a SECOND evidence table with its own RPCs, its own storage writes into the **same** `nsp-evidence` bucket, and its own policy pair. The plan says only "RCA/CAPA evidence" in prose and never names this table or its doors | **UNNAMED-BY-PLAN** — load-bearing |
| *(not named)* | **`nsp-evidence` carries FOUR `storage.objects` policies, not two**, in two pairs with **conflicting path conventions** (§2.4). Reproducing "the" policy would silently drop half the boundary | **UNNAMED-BY-PLAN** — load-bearing |
| *(not named)* | **`securable_resources` cannot represent an RCA, a CAPA action, a patient-safety event, or a form response.** `securable_resources_type_check` admits exactly `{case, meeting, interview, action_item, controlled_document, case_referral}` | **UNNAMED-BY-PLAN** — **hard structural blocker for BOTH DM5 steps 1 and 2** |
| *(not named)* | **`document_version_files_version_rendition_uniq UNIQUE (document_version_id, rendition_kind)`** — at most **one** `printed_pdf` per version, while `printed_documents` explicitly keeps superseded/revoked siblings (`printed_documents_one_active` is a *partial* unique on `status='active'`). The two cardinality rules contradict | **UNNAMED-BY-PLAN** — **hard structural blocker for step 2** |
| *(not named)* | **`add_rca_evidence` / `add_capa_action_evidence` are not single doors.** `rca_evidence` and `capa_action_evidence` both carry table-wide `arwdDxtm` grants to `authenticated`, with `FOR ALL` RLS write policies. A client can `POST /rest/v1/rca_evidence` directly, bypassing the RPC's flag gate and its HC0DM arm | **UNNAMED-BY-PLAN** — load-bearing |
| *(not named)* | **`p_storage_path` is caller-supplied and never validated** by `add_rca_evidence` / `add_capa_action_evidence` — no bucket check, no existence check, no size/MIME/hash. This is the exact inverse of ADR 0114 D8/D9 | **UNNAMED-BY-PLAN** — it is *why* Wave D exists, but the plan never states the current shape |
| *(not named)* | **`delete_rca_evidence` / `delete_capa_action_evidence` soft-delete only** — they set `deleted_at` and never remove bytes. Every deleted evidence file is a permanent orphan by design | **UNNAMED-BY-PLAN** — feeds §5 |
| *(not named)* | **`pd_storage_path_derived` CHECK** hard-couples `printed_documents.storage_path` to `(contains_phi, id)`: `storage_path = (CASE WHEN contains_phi THEN 'phi/' ELSE 'std/' END \|\| id \|\| '.pdf')`. Any move to `file_objects` server-derived paths must drop this CHECK | **UNNAMED-BY-PLAN** |
| *(not named)* | **`printed_documents` uses COLUMN-LIST grants.** `authenticated` has SELECT on 15 of 19 columns; **`storage_path`, `verification_token`, `revoked_reason`, `revoked_by` are withheld**. Any DM5 column needs its own GRANT or reads fail 42501 | **UNNAMED-BY-PLAN** — the `case_referral` trap |
| *(not named)* | **`verification_lookups`** — the lookup-audit satellite (RLS on, **zero policies**, no `authenticated` grant). The only existing satellite; the token itself is not in it | **UNNAMED-BY-PLAN** |
| *(not named)* | **`src/lib/attachments/constants.ts:66-71`** — dead `ATTACHMENTS_BUCKET` / `ATTACHMENTS_PHI_BUCKET` constants and `bucketForTier()`, **zero callers** anywhere in `src/`, `e2e/`, `scripts/` | **UNNAMED-BY-PLAN** (dead surface; blocks the step-5 sweep from reading clean) |
| *(not named)* | **`scripts/document-reconciliation.mjs:58`** — the reconciliation command covers **only** `documents-standard` + `documents-phi`, and lists **from `storage.objects`**. It cannot see 10 of 12 buckets and cannot see any orphan (§5) | **UNNAMED-BY-PLAN** — load-bearing for step 3 |
| *(not named)* | **pgTAP suites `312`/`313`/`323` insert `storage.objects` rows for `printed-documents` but never create the bucket row.** Deleting that bucket breaks all three suites on an FK violation | **UNNAMED-BY-PLAN** — a concrete step-3 blocker |

**Count: 13 UNNAMED-BY-PLAN surfaces**, of which **2 are hard structural blockers**
(`securable_resources_type_check`, the rendition UNIQUE). DM4's step 0 found 6; this
phase's blind spot is larger because Wave D spans two unrelated subsystems.

> ⚠ **Corrected by the lead at the DM5 open, 2026-08-14.** This line said **12**, the
> table above it carries **13** rows, and the hand-off message reported **14** — three
> figures for one list. The measured value is **13**:
> `grep -c 'UNNAMED-BY-PLAN'` yields 14, of which one is *this summary line itself*.
> Same class as the census figure QA corrected twice in DM4 (146/150 recorded, **141**
> measured): the error was in the **recording**, not the population. Keep the deriving
> command beside any count in this program — a number without its query is a rumour.

---

## 2. Section B — Wave D part 1: NSP RCA/CAPA evidence

### 2.1 `rca_evidence` — full column list **[catalog]**

```sql
select column_name, data_type, is_nullable from information_schema.columns
where table_schema='public' and table_name='rca_evidence' order by ordinal_position;
```

| column | type | null |
|---|---|---|
| `id` | uuid | NO |
| `rca_id` | uuid | NO |
| `kind` | text | NO |
| `title` | text | NO |
| `storage_path` | text | **YES** |
| `external_url` | text | YES |
| `cited_interview_id` | uuid | YES |
| `cited_meeting_id` | uuid | YES |
| **`cited_document_id`** | **uuid** | **YES** |
| `citation_label` | text | YES |
| `deleted_at` / `deleted_by` | timestamptz / uuid | YES |
| `created_by` / `created_at` | uuid / timestamptz | YES / NO |

**The question asked — "what is the attachments FK column now?"** It is
**`cited_document_id`**, and it is **triple-parked**:

1. **No FK at all** — `pg_constraint` on `rca_evidence` lists FKs only for
   `cited_interview_id → case_interviews(id) ON DELETE RESTRICT`,
   `cited_meeting_id → meetings(id) ON DELETE RESTRICT`, `rca_id`, `created_by`,
   `deleted_by`. **Nothing for `cited_document_id`.**
2. **A CHECK constraint pinning it NULL** —
   `rca_evidence_cited_document_parked CHECK ((cited_document_id IS NULL))`.
   ⚠ **The plan and DM1 step 10 describe only #1 and #3.** A DM5 migration that
   un-parks the writer and adds the FK but forgets this CHECK will fail every insert
   with **23514**, not with the expected refusal.
3. **A fail-closed arm in the writer** — `add_rca_evidence` raises `HC0DM` when
   `p_citation_target = 'document'`.

Also on the column set: `rca_evidence_shape` CHECK enforces the three-way exclusivity,
and `cited_document_id` participates in the citation arm's
`(interview? + meeting? + document?) = 1` count — so dropping the parked CHECK alone
does not make the column writable; the shape CHECK already permits it.

**Rows:** `select count(*) from public.rca_evidence` → **0**.
`capa_action_evidence` → **0**. Nothing to migrate locally; production
**UNVERIFIED — remote**.

**Uniqueness:** `rca_evidence_storage_path_key UNIQUE (storage_path) WHERE storage_path
IS NOT NULL` (same for `capa_action_evidence`). This is a global-across-all-RCAs
uniqueness on a caller-supplied string — worth preserving in `file_objects`'
`UNIQUE(storage_bucket, storage_path)` rather than losing it.

### 2.2 `add_rca_evidence` — signature, ACL, body **[catalog]**

```
public.add_rca_evidence(p_rca_id uuid, p_kind text, p_title text,
  p_storage_path text, p_external_url text, p_citation_target text,
  p_cited_entity_id uuid, p_citation_label text) RETURNS rca_evidence
prosecdef = t   LANGUAGE plpgsql   SET search_path TO 'app','public','pg_catalog'
proacl     = {postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres}
```

Load-bearing extracts from `pg_get_functiondef` (verbatim):

```sql
perform app.assert_patient_safety_enabled();
perform app.assert_rca_writable(p_rca_id);
...
if p_kind = 'document' then
  if p_storage_path is null or p_external_url is not null or p_cited_entity_id is not null then
    raise exception 'informe exatamente um tipo de evidência: arquivo, link ou citação'
      using errcode = 'check_violation';
  end if;
...
else -- citation
  -- DM1 (ADR 0114/0116): document CITATIONS are PARKED ...
  if p_citation_target = 'document' then
    raise exception
      'a citação de documento como evidência está temporariamente indisponível (migração do modelo de documentos)'
      using errcode = 'HC0DM';
  end if;
```

**Three things the plan does not say:**

- `p_storage_path` is **written straight into the row** with **no validation whatsoever**
  — no bucket binding, no `storage.objects` existence check, no size/MIME/hash. The
  bucket name lives only in TypeScript (`src/lib/safety/rca-actions.ts:296`). This is
  the precise inverse of program invariant "buckets/paths derived server-side;
  caller-supplied bucket/path/size/MIME/hash are never trusted (D8/D9)".
- The `document` arm (an **uploaded file**) is **live**; only the `citation` arm is
  parked. K8b pins the citation arm only.
- `delete_rca_evidence` (`prosecdef=t`, same ACL) performs
  `update ... set deleted_at = now(), deleted_by = auth.uid()` — **soft delete, bytes
  never removed**.

### 2.3 pgTAP `328` keystone K8b — quoted verbatim **[code]**

`supabase/tests/328_dm1_document_substrate.sql:780-793`:

```sql
-- K8b: the seeded in-progress RCA (chefe.ccih is its team lead) refuses a
-- document CITATION (the cited_document_id seam, parked until Wave D).
select test_helpers.claims_for(
  '00000000-0000-0000-0000-000000000002'::uuid, false, 'staff_admin');
set local role authenticated;
select throws_ok(
  $$ select public.add_rca_evidence(
       'f3000000-0000-0000-0000-0000000000a3', 'citation',
       'Citação de documento (K8b)', null, null, 'document',
       'a3300000-0000-0000-0000-0000000000a1', 'Rótulo K8b') $$,
  'HC0DM',
  'a citação de documento como evidência está temporariamente indisponível (migração do modelo de documentos)',
  'K8b add_rca_evidence refuses a document citation (parked until Wave D)');
reset role;
```

**Exactly what K8b pins:** that a `staff_admin` who *is* an authorised RCA writer
gets `HC0DM` **from the RPC** when citing a document. It pins **only** the
`p_citation_target='document'` branch of `add_rca_evidence`.

**What K8b does NOT pin** — and DM5 must not read it as covering:
- the table CHECK `rca_evidence_cited_document_parked` (a different lock, §2.1);
- direct PostgREST DML on `rca_evidence` (§2.6) — the RPC is not the only door;
- the `document` (uploaded-file) arm, which is live and unpinned;
- anything about `capa_action_evidence`, which has **no equivalent keystone at all**.

The file's own header (lines 795-810) warns that K8a/K8b must survive DM3's "remove
keystone K8" — DM5 is the wave that flips **K8b** from `throws_ok(...HC0DM...)` to a
positive assertion. K8a is DM4's and is already discharged.

### 2.4 The `nsp-evidence` bucket **[catalog]**

`select id, public from storage.buckets where id='nsp-evidence'` → exists, **`public = false`** (private).

**FOUR policies, not two** — `select policyname, cmd, qual, with_check from pg_policies
where schemaname='storage' and tablename='objects'`:

| policy | cmd | predicate |
|---|---|---|
| `nsp_evidence_obj_insert_writable` | INSERT | `bucket_id='nsp-evidence' AND app.can_write_rca(((storage.foldername(name))[2])::uuid, auth.uid())` |
| `nsp_evidence_obj_select_member` | SELECT | `bucket_id='nsp-evidence' AND app.can_read_event(((storage.foldername(name))[1])::uuid, auth.uid())` |
| `capa_evidence_obj_insert_writable` | INSERT | `bucket_id='nsp-evidence' AND app.is_pqs_writer_of(app.hospital_of_event(((storage.foldername(name))[1])::uuid))` |
| `capa_evidence_obj_select_member` | SELECT | `bucket_id='nsp-evidence' AND app.can_read_capa(((storage.foldername(name))[1])::uuid, auth.uid())` |

No UPDATE and no DELETE policy on this bucket for either pair — the immutability
posture (Architecture Rule 6), already pinned by `supabase/tests/142_rca.sql:257-268`
and `143_capa.sql:266-285`.

⚠ **Three things a DM5 migration must not flatten:**

1. **The path segment differs between INSERT and SELECT for RCA.** Insert authorises on
   `foldername[2]` (the **RCA id**); select authorises on `foldername[1]` (the **event
   id**). Reproducing "the RCA policy" with a single predicate loses one of them.
2. **The two pairs read the same segment as different entity types.** RCA-select treats
   `foldername[1]` as an **event id**; CAPA-select treats the same segment as a **CAPA
   id**. `143_capa.sql:266` describes them as "mutually exclusive by construction" —
   i.e. the disjointness is a property of the *id spaces*, not of the predicates.
   RLS policies of the same command **OR** together, so both predicates are evaluated
   against every object in the bucket. That is safe only while the id spaces stay
   disjoint. A `documents`-substrate rewrite must preserve that reasoning explicitly or
   replace it with a real discriminator.
3. **CAPA insert and CAPA select disagree on what `foldername[1]` is.** Insert resolves
   it through `app.hospital_of_event(...)` (an **event** id); select resolves it through
   `app.can_read_capa(...)` (a **CAPA** id). This is an internal inconsistency in the
   live pair, not a DM5 invention. DM5 must decide it deliberately rather than pick one
   side by accident.

**Zero function bodies reference the literal `nsp-evidence`** — verified:

```sql
select n.nspname||'.'||p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('app','public') and p.prokind='f'
  and pg_get_functiondef(p.oid) like '%nsp-evidence%';   -- 0 rows
```

The bucket name exists **only in TypeScript**. Consequence: the storage policies above
**are** the entire byte boundary for NSP evidence — unlike `documents-*`, where the
admin client signs after `open_document_version`.

### 2.5 The NSP hard exclusions and PQS custody predicates **[catalog]**

The predicates a `documents`-substrate read would have to reproduce, quoted from
`pg_get_functiondef` (all `prosecdef = t`, all `STABLE`, all
`search_path = app, public, pg_catalog`):

```sql
-- app.can_read_event(p_event_id uuid, p_user_id uuid) -> boolean
select exists (
  select 1 from public.patient_safety_event e
  where e.id = p_event_id and (
        app.is_member_of_for(e.current_owner_commission_id, p_user_id)
     or app.is_member_of_for(e.reporting_commission_id, p_user_id)
     or app.is_pqs_operator_of_for(app.hospital_of_event(e.id), p_user_id)));

-- app.can_write_rca(p_rca_id uuid, p_uid uuid) -> boolean
select app.is_pqs_operator_of_for(app.hospital_of_event(app.event_of_rca(p_rca_id)), p_uid)
    or exists (select 1 from public.rca_members m
               where m.rca_id = p_rca_id and m.user_id = p_uid and m.role <> 'observer');

-- app.can_read_capa(p_capa_id uuid, p_user_id uuid) -> boolean
select app.is_pqs_operator_of_for((select hospital_id from public.capa_plan where id = p_capa_id), p_user_id)
    or app.can_read_event(app.event_of_capa(p_capa_id), p_user_id)
    or exists (select 1 from public.capa_plan cp
               join public.indicators i on i.id = cp.source_indicator_id
               where cp.id = p_capa_id and cp.source = 'indicator'
                 and app.is_member_of_for(i.commission_id, p_user_id));

-- app.is_pqs_writer_of(p_hospital_id uuid) -> boolean
select app.is_pqs_operator_of(p_hospital_id);   -- a thin alias
```

**Precisely which predicate a future `documents`-substrate read must reproduce.**
There is no single one — the boundary is **three-armed and asymmetric**:

- **RCA evidence bytes today** = `app.can_read_event(event_of_rca(rca))`. Note this is
  the **EVENT** predicate, *not* `can_write_rca`'s membership arm and **not** an
  RCA-scoped read predicate — **`app.can_read_rca` does not exist**. Custody
  (`current_owner_commission_id`) is therefore the read gate, and custody **moves**
  (`transfer`); a document-substrate read that binds to the commission at upload time
  would freeze a boundary that is designed to follow custody. **This is the single
  most likely silent regression in DM5 step 1.**
- **RCA evidence writes today** = `app.can_write_rca(rca)` — a *narrower* set
  (PQS operator OR a non-observer RCA member).
- **CAPA evidence** = `app.can_read_capa` (three arms, including the Phase-15
  indicator-commission escalation arm) for reads; `is_pqs_writer_of(hospital_of_event)`
  for the storage insert but `can_write_capa` for the table row.

The **hard exclusion** is expressed structurally rather than as a named "exclusion"
predicate: `patient_safety_event` reads are confined to the two commissions on the
event plus the hospital's PQS operators. There is **no** tenancy-admin arm and **no**
`platform_admin` arm anywhere in this chain — the noun rule holds by omission.
`app.can_read_document`'s kernel (§3.4) has **no arm for any NSP type**, so today a
document homed on an NSP resource would be **unreadable by everyone** (the `else false`
arm) — fail-closed, which is correct, but it means step 1 is a kernel change, not a
data migration.

### 2.6 Uploaded evidence vs. external links — how the distinction is represented **[catalog]**

A **`kind` text column plus a shape CHECK**, on both tables:

```sql
-- rca_evidence
rca_evidence_kind_check  CHECK (kind = ANY (ARRAY['document','link','citation']))
rca_evidence_shape       CHECK (
   (kind='document'  AND storage_path IS NOT NULL AND external_url IS NULL AND cited_* ALL NULL)
OR (kind='link'      AND external_url IS NOT NULL AND storage_path IS NULL AND cited_* ALL NULL)
OR (kind='citation'  AND storage_path IS NULL AND external_url IS NULL AND citation_label IS NOT NULL
                     AND (cited_interview_id IS NOT NULL)::int
                       + (cited_meeting_id   IS NOT NULL)::int
                       + (cited_document_id  IS NOT NULL)::int = 1))
rca_evidence_https       CHECK (external_url IS NULL OR external_url LIKE 'https://%')

-- capa_action_evidence: same pattern, kind ∈ {document, link} (no citation arm)
```

So the distinction is **not** "nullable path" — it is an explicit discriminator with a
total shape constraint. **DM5 must keep `link` off the document substrate entirely**
(an external URL has no `file_object`), which means Wave D splits one table into two
storage regimes rather than migrating it wholesale.

**⚠ `add_rca_evidence` is not a single door.** **[catalog]**

```sql
select relname, array_to_string(relacl,',') from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and relname in ('rca_evidence','capa_action_evidence');
-- rca_evidence         | postgres=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres
-- capa_action_evidence | postgres=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres
```

Both tables carry **full table-wide DML grants to `authenticated`**, with `FOR ALL` RLS
write policies (`rca_evidence_write` → `app.can_write_rca(rca_id, auth.uid())`;
`capa_action_evidence_write` → `app.can_write_capa(...)`). Contrast the DM1 substrate,
where `documents` / `document_versions` / `document_version_files` / `file_objects` all
have `authenticated=r` (SELECT only) — command-only mutations, per plan item DM1·5.

Consequence: an authorised RCA writer can `POST /rest/v1/rca_evidence` directly and
**bypass `add_rca_evidence` entirely** — including `assert_patient_safety_enabled()`
(the flag gate) and the `HC0DM` citation refusal. The `guard_rca_child_lock` trigger
still fires (it is the only backstop), and the parked-CHECK still blocks
`cited_document_id`. **DM5 must revoke these grants when it moves the write path**, or
the new command RPC will be one of two doors rather than the door.

### 2.7 TypeScript surface for RCA/CAPA evidence **[code]**

Writers (all cookie client, all in `src/lib/safety/`):

| function | file:line | what |
|---|---|---|
| `uploadRcaEvidenceFile` | `src/lib/safety/rca-actions.ts:265` | `.storage.from('nsp-evidence').upload(...)` at `:296-297` |
| `addRcaEvidence` | `src/lib/safety/rca-actions.ts:307` | `.rpc('add_rca_evidence')` at `:317`, `p_storage_path` at `:321` |
| `deleteRcaEvidence` | `src/lib/safety/rca-actions.ts:333` | `.rpc('delete_rca_evidence')` at `:337` |
| `uploadCapaEvidenceFile` | `src/lib/safety/capa-actions.ts:293` | `.storage.from('nsp-evidence').upload(...)` at `:312-313` |
| `addCapaActionEvidence` | `src/lib/safety/capa-actions.ts:319` | `.rpc('add_capa_action_evidence')` at `:329` |
| `deleteCapaActionEvidence` | `src/lib/safety/capa-actions.ts:342` | `.rpc('delete_capa_action_evidence')` at `:346` |

Readers:

| function | file:line | what |
|---|---|---|
| `listRcaEvidence` | `src/lib/queries/rca.ts:248` | selects `storage_path` at `:253`, `createSignedUrl` at `:265-268` (3600 s), **cookie client** |
| `listCapaActionEvidence` | `src/lib/queries/capa.ts:357` | selects at `:363`, `createSignedUrl` at `:372-375` (3600 s), **cookie client** |

UI routes (read-only; all writes go through client components calling the actions):
- `src/app/o/[org]/nsp/rca/[rcaId]/page.tsx` — imports `listRcaEvidence` `:11`, calls `:79`
- `src/app/o/[org]/nsp/capa/[capaId]/page.tsx` — imports `listCapaActionEvidence` `:10`, calls `:75`, groups `:84`

Write components: `src/components/safety/rca/rca-evidence-forms.tsx`,
`rca-evidence-panel.tsx`, `src/components/safety/capa/capa-evidence-forms.tsx:107,118,222`,
`capa-evidence-list.tsx:95`.

⚠ **The two signed-URL TTLs are 3600 s**, versus the document module's short-TTL
service-role signing (D8). DM5 changes the TTL by construction — worth stating so it is
a decision, not a side effect.

---

## 3. Section C — Wave D part 2: printed renditions

### 3.1 The rendition kind set **[catalog]**

**It is not an enum.** No `pg_type`/`pg_enum` row matches `%rendition%`. It is a CHECK:

```sql
select conname, pg_get_constraintdef(oid) from pg_constraint
where conrelid = 'public.document_version_files'::regclass;
```

```
document_version_files_rendition_check
  CHECK (rendition_kind = ANY (ARRAY['source','redacted','preview','signed','printed_pdf']))
document_version_files_version_rendition_uniq
  UNIQUE (document_version_id, rendition_kind)
```

**`printed_pdf` is already an allowed value.** Full allowed set: `source`, `redacted`,
`preview`, `signed`, `printed_pdf`. Current rows: `select rendition_kind, count(*) from
document_version_files group by 1` → **0 rows** (the table is empty locally).

⚠ **`document_version_files_version_rendition_uniq` is a step-2 blocker.** It permits
**exactly one** `printed_pdf` per `document_version_id`. `printed_documents` deliberately
retains superseded and revoked siblings for the same source — its uniqueness is
`printed_documents_one_active UNIQUE (source_kind, source_id, template_key) WHERE
status = 'active'`, i.e. **one *active*, many historical**. Mapping N printed documents
onto one document version is impossible under the current UNIQUE. DM5 must choose:
mint a new `document_version` per print (semantically odd — the source content did not
change), relax the UNIQUE, or keep printed PDFs off `document_version_files`. **This is a
design decision the plan assumes away with the phrase "bound to their source".**

### 3.2 `printed-documents` bucket **[catalog]**

Exists, `public = false`. **Policies on `storage.objects` naming it: ZERO.** The
complete `storage.objects` policy list is the 8 rows in §4; none mentions
`printed-documents`. This is deliberate and already pinned:
`supabase/tests/312_printed_documents.sql:402-405` —
*"t53 storage: authenticated reads ZERO printed-documents objects (bucket has NO
policies — service-role only, D8)"*, plus a `throws_ok` on a smuggled insert.

So `printed-documents` **already implements the D8 topology** (no SELECT policy;
service-role signing behind an audited door). It is the one legacy bucket that does not
need a boundary change — only a coordinate move.

### 3.3 The verification-token flow **[catalog + code]**

**Table:** `public.printed_documents` — 19 columns (§3.5). The token columns are
`verification_token text NOT NULL` and `verification_short_code text NOT NULL`, both
UNIQUE (`printed_documents_verification_token_key`,
`printed_documents_verification_short_code_key`).

**Is the token table already a satellite?** **No.** The tokens sit on the *same row* as
`storage_path`, `content_hash`, `status`, and the whole revocation block. The plan's
"verification tokens stay in a satellite" describes a target state that **does not
exist**; DM5 must create it.

The only existing satellite is **`public.verification_lookups`** — the *audit* of
lookups, not the tokens: `(id bigint, looked_up_at timestamptz, source_kind text,
token_hash text NOT NULL, matched boolean NOT NULL)`. `relacl` has **no `authenticated`
grant**, RLS is on with **zero policies** — service-role only. It stores a
`sha256` of the credential, never the raw token.

**RPCs** (all `prosecdef = t`):

| RPC | returns | ACL | notes |
|---|---|---|---|
| `lookup_printed_document(p_credential text, p_viewer uuid)` | `SETOF record` | `postgres=X, service_role=X` — **no `authenticated`** | matches token OR short code; always writes a `verification_lookups` row (hash only); returns `document_id` **only** when `p_viewer` passes `app.can_view_printed_document` |
| `open_printed_document(p_id uuid)` | `SETOF record (storage_path, status, contains_phi)` | `postgres, service_role, authenticated` | re-gates `can_view_printed_document`; emits `document.downloaded` audit; **returns the raw `storage_path` to the caller** |
| `mint_printed_document(...)` | `printed_document_public` | `postgres, service_role, authenticated` | the only function body containing the literal `'printed-documents'` |
| `revoke_printed_document(p_id, p_reason_class, p_reason)` | `printed_document_public` | `postgres, service_role, authenticated` | §3.6 |

**Public routes [code]:**

- `src/app/(public)/verificar/page.tsx` — the short-code entry form. Constructs **no**
  Supabase client; redirects to `/verificar/<code>` at `:159`.
- `src/app/(public)/verificar/[token]/page.tsx` — the verification route. Calls
  `lookupPrintedDocumentVerification(key)` at `:80` (imported `:9-10`).
- `src/lib/queries/printed-documents.ts` — where the client choice actually lives
  (imports `createAdminClient` `:1` and `createClient` `:2`). Inside
  `lookupPrintedDocumentVerification` (`:220-253`): the **cookie** client at `:232` only
  to read `auth.getClaims()` for `p_viewer`; the **admin / service-role** client at
  `:236` issues the RPC at `:237`. Rate limiting (`consumeLookupBudget`) at `:225`.
  This is forced by the ACL — `lookup_printed_document` has no `authenticated` grant.
- `src/app/api/documents/[id]/route.ts` — the download route: cookie client authorises
  via `open_printed_document` at `:33`, admin client downloads from `'printed-documents'`
  at `:45-46`.

### 3.4 The revoked / superseded overlay path **[catalog + code]**

The overlay decision is made **in the DB**, applied **in the app**:

```sql
-- open_printed_document, verbatim
v_overlay := (v_row.status <> 'active');
perform app.audit_write('document.downloaded', 'printed_document', p_id, v_row.commission_id,
  'Documento PDF baixado',
  jsonb_build_object('overlay_applied', v_overlay, 'status', v_row.status));
return query select v_row.storage_path, v_row.status, v_row.contains_phi;
```

So the RPC returns `status` + `contains_phi` alongside the path, and
`src/app/api/documents/[id]/route.ts` (`:33` authorise, `:43-46` download) is what
renders the overlay onto the served bytes. **The stored object is never rewritten** —
overlay is applied at serve time, which is exactly what makes the printed PDF safe to
model as an immutable `file_object`. That property is load-bearing and DM5 must
preserve it: the overlay reads `printed_documents.status`, so the satellite split must
keep `status` reachable from whatever the serve path resolves.

`app.can_view_printed_document(p_source_kind, p_source_id, p_uid)` is the sole authority
for both `open_` and the `lookup_` viewer-gate. It dispatches on `source_kind`:
`form_response` (mirrors the live `responses` read policies, explicitly **no**
tenancy-admin arm per ADR 0100 D12), `meeting` (`can_reach_meeting AND
can_read_full_meeting_content`), and `else return false` — a fail-closed
`ELSE_FAIL_CLOSED` arm with a comment stating a new printable kind that forgets its arm
fails shut. **`case` and `interview` arms are declared in `printed_documents_source_kind_check`
but are NOT implemented** — they land "in P3..P4" per the body comment.

### 3.5 `printed_documents` structure, grants, cardinality **[catalog]**

Columns: `id, source_kind, source_id, commission_id, template_key, template_version,
content_hash, storage_path, contains_phi, status, verification_token,
verification_short_code, minted_by, minted_at, superseded_at, revoked_reason_class,
revoked_reason, revoked_by, revoked_at`.

Constraints of note:

```
pd_storage_path_derived  CHECK (storage_path =
   ((CASE WHEN contains_phi THEN 'phi/' ELSE 'std/' END || id::text) || '.pdf'))
pd_revoked_iff_ts        CHECK ((status = 'revoked') = (revoked_at IS NOT NULL))
pd_revocation_complete   CHECK (revoked_at IS NULL OR (reason_class, reason, revoked_by ALL NOT NULL))
pd_superseded_has_ts / pd_superseded_ts_status
printed_documents_content_hash_check CHECK (content_hash ~ '^[0-9a-f]{64}$')
printed_documents_source_kind_check  CHECK (source_kind = ANY (ARRAY['form_response','case','meeting','interview']))
printed_documents_status_check       CHECK (status = ANY (ARRAY['active','superseded','revoked']))
```

`pd_storage_path_derived` is the **coupling to storage coordinates**. Moving bytes to
`file_objects` with server-derived paths requires dropping this CHECK and the column.

**Column-list grants** (the `case_referral` hardening pattern) —
`information_schema.column_privileges` for `grantee='authenticated'`:

```
SELECT on: commission_id, contains_phi, content_hash, id, minted_at, minted_by,
           revoked_at, revoked_reason_class, source_id, source_kind, status,
           superseded_at, template_key, template_version, verification_short_code
```

**Withheld: `storage_path`, `verification_token`, `revoked_reason`, `revoked_by`.**
No INSERT/UPDATE/DELETE grant at all (`relacl` = `postgres, service_role` only).
⚠ **Every column DM5 adds to this table needs its own GRANT in the same migration**, or
reads fail with 42501.

RLS: one policy, `printed_documents_select` → `app.can_view_printed_document(source_kind,
source_id, (select auth.uid()))`. No triggers (`pg_trigger` where `not tgisinternal`
→ 0 rows for this table).

**Rows: 0 locally.** Nothing references `printed_documents` by FK
(`confrelid = 'public.printed_documents'::regclass` → 0 rows) — the table is a leaf, which
makes the satellite split cheap.

### 3.6 `revoke_printed_document` — HC0D5 confirmed **[catalog]**

```
public.revoke_printed_document(p_id uuid, p_reason_class text, p_reason text)
  RETURNS printed_document_public
prosecdef = t   proacl = {postgres=X, service_role=X, authenticated=X}
```

Body order (verbatim, load-bearing parts):

```sql
perform app.assert_document_printing_enabled();
select * into v_row from public.printed_documents where id = p_id;
-- REVOKE_AUTHORITY first (M1·4 order; QA MINOR-4): not-found and
-- not-authorized are ONE indistinguishable denial — no existence oracle.
if v_row.id is null
   or not (app.is_staff_admin_of_for(v_row.commission_id, auth.uid())
           or app.is_tenancy_admin_of_for(v_row.commission_id, auth.uid())) then
  raise exception '...' using errcode = '42501';
end if;
if p_reason_class is null or p_reason_class not in ('wrong_data','minted_in_error','other') then
  raise exception 'classe de motivo de anulação inválida' using errcode = 'HC0D1';
end if;
if p_reason is null or btrim(p_reason) = '' then
  raise exception 'o motivo da anulação é obrigatório' using errcode = 'HC0D1';
end if;
if v_row.status = 'revoked' then
  raise exception 'este documento já foi anulado' using errcode = 'HC0D5';   -- ← CONFIRMED
end if;
...
return jsonb_populate_record(null::public.printed_document_public, to_jsonb(v_row));  -- FUP-PDF-3
```

**`HC0D5` is confirmed as owned by `revoke_printed_document`.** Independently
corroborated by the `328` K14 header comment (`supabase/tests/328_dm1_document_substrate.sql`,
K14 block): *"HC0D6; HC0D5 is TAKEN by revoke_printed_document, verified against
comment-stripped pg_proc.prosrc"*. DM5 must not reuse HC0D5. Also note this function
carries a **tenancy-admin arm** (`is_tenancy_admin_of_for`) — an exception to the noun
rule that DM5 must not silently drop when re-homing revocation.

### 3.7 Print/PDF generation entry points, and which write bytes **[code]**

| entry point | file:line | writes bytes? | bucket |
|---|---|---|---|
| `mint` action | `src/lib/pdf-mint/actions.ts:274-275` | **YES** — admin `.upload()` | `printed-documents` |
| compensating rollback | `src/lib/pdf-mint/actions.ts:304` | **YES** — admin `.remove()` | `printed-documents` |
| `mint_printed_document` RPC call | `src/lib/pdf-mint/actions.ts:283-284` | no (row only) | — |
| `revoke` action | `src/lib/pdf-mint/actions.ts:330` | no | — |
| download route | `src/app/api/documents/[id]/route.ts:45-46` | no (read) | `printed-documents` |
| smoke script | `scripts/smoke/pdf-mint.smoke.ts:65,70,116,183,249,256` | yes (test-only) | `printed-documents` |

**`src/lib/pdf-mint/actions.ts` is the only production writer of printed bytes**, and
it writes to exactly one bucket. That makes step 2's copy→verify→switch a
single-module change.

⚠ **Correction to a sweep result, recorded because the failure mode matters.** A
sub-agent identifier sweep for `.rpc('mint_printed_document')` reported **zero call
sites**. That is a **false negative**: the call is line-wrapped —
`.rpc(` on `src/lib/pdf-mint/actions.ts:283`, `'mint_printed_document',` on `:284` — so a
regex anchored on the single-line `.rpc('X')` form misses it. Verified by a plain
identifier grep. This is the *enumeration's boundary must be the property, not a syntax*
class; DM5's step-5 exit sweep must grep the **identifier**, never the call syntax.

### 3.8 The "4 production objects" **[catalog / UNVERIFIED — remote]**

- **Local:** `printed_documents` → **0 rows**; `file_objects` → 0; `document_version_files`
  → 0; `documents` → 3; `document_versions` → 3; `securable_resources` → 20.
- **Local storage volume:** `printed-documents` holds **87 orphaned byte-files
  / 6,903,372 bytes** (78 under `std/`, 9 under `phi/`) with **zero** `storage.objects`
  metadata rows — E2E residue, not migratable content (§5).
- **Production: UNVERIFIED — remote.** The plan's "4 production objects" traces to the
  2026-08-11 census in ADR 0114 (45 objects total: 38 form-assets, 3 controlled-documents,
  4 printed-documents). `docs/progress/follow-ups.md` FUP-DM4-PRODROW marks those figures
  **stale by design — re-census before acting**. I did not and must not query the remote
  project. DM5 step 2 must re-census production at execution time.

---

## 4. Section D — the retirement manifest

**The manifest is 8 buckets, not 9.** `meeting-attachments` **does not exist**:

```sql
select id, name, public from storage.buckets order by id;   -- 12 rows, all public=false
```

Live buckets: `attachments`, `attachments-phi`, `case-documents`, `controlled-documents`,
`documents-phi`, `documents-standard`, `form-assets`, `interview-attachments`,
`meeting-audio`, `nsp-evidence`, `printed-documents`, `referral-attachments`.

**Complete `storage.objects` policy list (all 8, whole catalog)** — every other bucket
below has **zero** policies:

| policy | cmd | bucket | predicate |
|---|---|---|---|
| `capa_evidence_obj_insert_writable` | INSERT | nsp-evidence | `is_pqs_writer_of(hospital_of_event(foldername[1]))` |
| `capa_evidence_obj_select_member` | SELECT | nsp-evidence | `can_read_capa(foldername[1], auth.uid())` |
| `nsp_evidence_obj_insert_writable` | INSERT | nsp-evidence | `can_write_rca(foldername[2], auth.uid())` |
| `nsp_evidence_obj_select_member` | SELECT | nsp-evidence | `can_read_event(foldername[1], auth.uid())` |
| `documents_phi_obj_insert_reserved` | INSERT | documents-phi | `storage_upload_reserved(bucket_id, name, auth.uid())` |
| `documents_std_obj_insert_reserved` | INSERT | documents-standard | `storage_upload_reserved(bucket_id, name, auth.uid())` |
| `form_assets_insert_staff_admin` | INSERT | form-assets | `is_tenancy_admin_of(foldername[1]) OR is_staff_admin_of(foldername[1])` |
| `form_assets_select_member` | SELECT | form-assets | `is_tenancy_admin_of(foldername[1]) OR is_member_of(foldername[1])` |

### Manifest table

Local byte figures from §5. "DB refs" = functions whose `pg_get_functiondef` contains
the bucket literal, plus columns holding paths into it, plus FKs.

| # | bucket | exists | objs / bytes (local, **on-disk**) | policies | DB references | product callers (`src/`, `e2e/`) | verdict |
|---|---|---|---|---|---|---|---|
| 1 | `attachments` | **YES** | **2 / 70** | **none** | none (`public.attachments` table gone; no function body names the literal; no column) | **none live.** Dead constant `src/lib/attachments/constants.ts:66`; pgTAP pin `328:133` asserts no policy names it | **RETIREABLE NOW** — bytes must be removed out-of-band (§5) |
| 2 | `attachments-phi` | **YES** | **6 / 170** | **none** | none | dead constant `src/lib/attachments/constants.ts:67`; pgTAP pin `328:133` | **RETIREABLE NOW** — ⚠ **PHI-tier bytes present** |
| 3 | `case-documents` | **YES** | **0 / 0** (no directory) | **none** (DM4 dropped `case_documents_select_member`) | none | comments only: `src/lib/referrals/actions.ts:549`, `src/lib/queries/referrals.ts:24,25,1099,1102,1107`; **pgTAP `235:158` and `236:100` CREATE the bucket row themselves** (`on conflict do nothing`) and insert probe objects | **RETIREABLE NOW** — the two pgTAP suites are self-sufficient (they create the row), so the delete does not break them; `e2e/dm4-referral-documents.spec.ts:785,827` assert its *absence* and stay green |
| 4 | ~~`meeting-attachments`~~ | **NO** | — | — | — | `src/lib/queries/meetings.ts:261` comment; `src/components/documents/document-labels.ts:320` is a DOM id | **ALREADY RETIRED** (migration `20260921000300`; pinned `325:54-56`). Remove from the manifest |
| 5 | `interview-attachments` | **YES** | **0 / 0** (no directory) | **none** (its member SELECT was dropped as a confirmed PHI exposure) | none | `document-labels.ts:335` DOM id; pgTAP `325:49-51` pins it **sealed**; `236:105` creates + probes it; `mutation/u1-mutation-audit.sh:59-62` re-injects the leak as a mutation | **RETIREABLE NOW** — ⚠ deleting the bucket row **may break `u1-mutation-audit.sh`**, which recreates a policy on it; verify that arm in the same change |
| 6 | `nsp-evidence` | **YES** | **0 / 0** (no directory) | **4** (§2.4) | **zero function bodies**; `rca_evidence.storage_path`, `capa_action_evidence.storage_path` hold paths into it (no FK — Storage has none) | **LIVE**: `rca-actions.ts:296`, `capa-actions.ts:312` (upload), `queries/rca.ts:267`, `queries/capa.ts:374` (sign); pgTAP `142:257-268`, `143:266-285`; `e2e/phase14c-rca.spec.ts:650,658` | **RETIRES ONLY AFTER Wave D step 1** — the only bucket whose product path is fully live |
| 7 | `referral-attachments` | **YES** | **0 / 0** (no directory) | **none** (DM4 dropped both) | one **comment-only** match in `begin_document_upload`'s body (verified: the literal appears in a DM4 explanatory comment, not in code) | comment only `src/lib/queries/referrals.ts:1123`; `328:127` says "the bucket ROWS themselves retire in DM5" | **RETIREABLE NOW** |
| 8 | `controlled-documents` | **YES** | **126 / 24,192** | **none** (DM3 M5 dropped both; pinned `330:697-699`) | none | comments only: `queries/controlled-documents.ts:22,578`, `controlled-documents/actions.ts:120`; `seed.sql:2216` explains why the seed writes no bytes | **RETIREABLE NOW** — bytes are orphaned residue |
| 9 | `printed-documents` | **YES** | **87 / 6,903,372** (78 std + **9 phi**) | **none** (D8 topology already) | `mint_printed_document` body contains the literal; `printed_documents.storage_path` (NOT NULL) + `pd_storage_path_derived` CHECK | **LIVE**: `pdf-mint/actions.ts:274,304`, `api/documents/[id]/route.ts:45`; `scripts/smoke/pdf-mint.smoke.ts` ×6; **pgTAP `312:81-87`, `313:121-143`, `323:47` insert `storage.objects` rows and do NOT create the bucket row** | **RETIRES ONLY AFTER Wave D step 2** — and ⚠ **deleting the bucket breaks pgTAP `312`/`313`/`323` on an FK violation** unless those suites are amended in the same change |

**Out of scope (D13) — `form-assets` and `meeting-audio`:** both cleanly separable.
`form-assets` has its own dedicated policy pair (`form_assets_insert_staff_admin` /
`form_assets_select_member`) keyed on `foldername[1]` = commission id, shares no
predicate with any document-model gate, and is referenced only by
`src/lib/forms/actions.ts:2159` and `src/lib/queries/forms.ts:1327`. `meeting-audio` has
**zero** `storage.objects` policies, its name lives in exactly one constant
(`src/lib/minutes-jobs/constants.ts:11`), and its callers are confined to
`src/lib/minutes-jobs/`. **One coupling to note:** both hold orphaned bytes
(`form-assets` 32 files / 2,240 B; `meeting-audio` 54 files / 45,576 B) on the same
volume, so any orphan-cleanup mechanism DM5 builds (§5) will touch them and must
deliberately exclude or include them. That is the only coupling found.

---

## 5. Section E — FUP-DM5-STORAGE-ORPHANS, reproduced at HEAD

### 5.1 The measurement **[fs]**

Backend configuration, from `docker inspect supabase_storage_azkbbhskturikxpgmafq`:
`STORAGE_BACKEND=file`, `FILE_STORAGE_BACKEND_PATH=/mnt`, `GLOBAL_S3_BUCKET=stub`,
mount = named volume `supabase_storage_azkbbhskturikxpgmafq` → `/mnt`. Objects live
at `/mnt/stub/stub/<bucket>/<key…>`, where each **object key is a directory** and each
**version is a file inside it**.

**Metadata side [catalog]:**

```sql
select coalesce(bucket_id,'(null)'), count(*), coalesce(sum((metadata->>'size')::bigint),0)
from storage.objects group by 1;          -- 0 rows
select count(*) from storage.objects;     -- 0
```

**Byte side [fs]** — `docker exec … find <bucket> -type f`, object keys derived by
stripping the version filename:

| bucket | object keys | version files | bytes |
|---|---|---|---|
| `attachments` | 2 | 2 | 70 |
| `attachments-phi` | 6 | 6 | 170 |
| `controlled-documents` | 126 | 126 | 24,192 |
| `documents-phi` | 183 | 183 | 13,265 |
| `documents-standard` | 209 | 209 | 34,802 |
| `form-assets` | 32 | 32 | 2,240 |
| `meeting-audio` | 54 | 54 | 45,576 |
| `printed-documents` | 87 | 87 | 6,903,372 |
| **TOTAL** | **699** | **699** | **7,023,687** |

**PHI-tier: 198 files** — `attachments-phi` (6) + `documents-phi` (183) +
`printed-documents/phi` (9).

Buckets with **no directory at all** (never received a byte locally): `case-documents`,
`interview-attachments`, `nsp-evidence`, `referral-attachments`.

> The lead's reproduction recorded **663 files / 16.5 MB / 162 PHI-tier**. The current
> figures (**699 / 7.02 MB / 198 PHI-tier**) differ because the shared local stack has
> been exercised since. The *phenomenon* reproduces exactly; the numbers are a moving
> target and should be re-measured, never quoted from a document.

### 5.2 The Storage API confirms the failure mode **[fs]**

`POST {API}/storage/v1/object/list/<bucket>` with the service-role key,
`{"prefix":"","limit":1000,"offset":0}`, for all 12 buckets:

```
attachments  attachments-phi  controlled-documents  documents-phi  documents-standard
printed-documents  form-assets  meeting-audio  nsp-evidence  case-documents
interview-attachments  referral-attachments
   →  every one returns  []
```

**Every bucket reports empty, while 699 objects / 7.02 MB / 198 PHI-tier files sit on
the volume.** DM5 step 3's method — *"prove zero … then empty + delete the bucket
(Storage API only)"* — would report success on all 12 and delete nothing.

### 5.3 A severity calibration the follow-up does not state **[fs]**

The orphaned bytes are **not servable**. Against a known orphan key in `documents-phi`,
with the service-role key:

```
GET  /storage/v1/object/documents-phi/<key>        → HTTP 400
POST /storage/v1/object/sign/documents-phi/<key>   → {"statusCode":"404","error":"not_found","message":"Object not found"}
```

Every Storage read path resolves metadata first, so an object with no `storage.objects`
row cannot be fetched or signed by anyone. **This is a data-at-rest / disposal-assertion
problem, not an access-control problem.** It still breaks Rule 12 and the LGPD/ANVISA
erasure story — `dispose_*` asserting disposal while PHI bytes persist is exactly the
F-02 defect class ADR 0114 exists to end — but DM5 should not describe it as a live
exposure. It also **kills one candidate enumeration method by construction**: the
Storage API can never see these, so no amount of API querying will find them.

Corroboration from the other direction: `supabase/seed.sql:2216-2219` already records
the inverse pairing — *"a `storage.objects` row with no bytes 404s on download"*. The
metadata table and the byte store drift independently in **both** directions, and only
one direction is currently detectable.

### 5.4 Why the existing reconciliation command does not cover this **[code]**

`scripts/document-reconciliation.mjs:58` defines `const BUCKETS = ['documents-standard',
'documents-phi']` and drives them into a paginated `.list()` at `:75`. So it (a) covers
**2 of 12** buckets and (b) lists **from `storage.objects`**. Post-reset it reports
`0 file_objects, 0 storage.objects` — perfectly reconciled, orphans invisible. The
command is correct for its stated job (DB↔metadata drift) and structurally incapable of
the job step 3 needs.

### 5.5 Proposed enumeration methods (proposal only — nothing implemented)

**M1 — out-of-band object-store enumeration.**
Enumerate the byte store directly, bypassing `storage.objects` entirely. Locally that is
a walk of the storage volume (`docker exec … find "$FILE_STORAGE_BACKEND_PATH/$GLOBAL_S3_BUCKET"`),
folded into a per-bucket key/byte census, then diffed **both ways** against
`storage.objects`.
*Pros:* the only method that actually sees today's 699 orphans; cheap; no schema change;
verifiable red-first (plant a file, see the census find it).
*Cons:* **backend-specific.** It depends on `STORAGE_BACKEND=file`, which is a
local-dev-only configuration. On Supabase Cloud the byte store is S3 and is not
customer-walkable through any interface I can verify from here. Whether the S3-protocol
endpoint (`/storage/v1/s3`) enumerates from the object store or from `storage.objects`
is **UNVERIFIED** — the local probe returned HTTP 400 (it requires SigV4, not a Bearer
token), and testing the remote is forbidden by the standing no-remote directive.
**So M1 does not transfer to production as written.**

**M2 — manifest-first deletion (an ordering invariant, not a query).**
Before any destructive step, capture the authoritative key list per bucket from
`storage.objects` (+ `file_objects`) into a durable, committed manifest artifact. Then
delete **by key** through the Storage API and assert `deleted_count == manifest_count`
per bucket before the bucket row is dropped. Emptiness is proven against the manifest,
never against a live count that a reset can zero.
*Pros:* backend-agnostic — works identically on the local file backend and on Cloud;
turns "prove empty" from an unfalsifiable negative into a positive count comparison;
directly neutralises the failure mode (a truncated table yields a **zero-length
manifest**, which is a visibly wrong artifact rather than a silent pass).
*Cons:* recovers nothing already orphaned — it only prevents new orphans and forces the
retirement to run in the right order; requires the manifest to be captured at the right
moment and treated as a gate artifact.

**M3 (prevention) — make the local reset byte-consistent.**
Extend the reset path so that wiping `storage.objects` also wipes the storage volume, so
`0 metadata rows` always implies `0 bytes` locally.
*Pros:* stops the local stack manufacturing orphans (it has produced 699); makes every
future "prove empty" step honest by construction on the machine where it is rehearsed.
*Cons:* destroys local fixtures; does nothing for production; and it *hides* the class
rather than detecting it — a detector that can no longer find anything because the
condition was made impossible is only as good as the guarantee that it stays impossible.

**Recommendation: M2 as the gate, M1-local as the proof, M3 as hygiene — and record
the production gap rather than closing it on paper.**
M2 is the one that generalises and the one that makes the exit criterion falsifiable, so
it should be the *binding* method for step 3. M1-local is what proves M2 actually worked
on the pre-pilot stack (run the walk after the deletions; expect zero remaining files in
the eight retired buckets — an assertion that would today fail loudly). M3 stops the
local stack producing fresh orphans between now and the pilot.

⚠ **The honest residual, to be stated in the manifest rather than glossed:** on Supabase
Cloud there may be **no customer-accessible tool that can see an orphan**, because the
dashboard's storage explorer, the CLI, and supabase-js all list from `storage.objects`.
Whether the Cloud S3 endpoint differs is **UNVERIFIED — remote**. Production orphaning
requires a destructive metadata truncation, whose only in-repo path is
`npm run db:reset:linked`; that is the risk to name. Per the follow-up, remote behaviour
stays an **inference**, and this audit does not upgrade it.

---

## 6. Section F — the census blind class and what DM5's assurance plan needs

### 6.1 The figure, measured at HEAD, with its query **[catalog]**

Applying the exact definition recorded at `docs/progress/dm3-controlled-documents.md:211`
and corrected by QA at `docs/reviews/dm4-referrals-review.md:250-268` (`prosecdef`,
composite-returning, **non-`proretset`**, `authenticated`-EXECUTE, schema **`public`**):

```sql
select count(*)
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join pg_type      t on t.oid = p.prorettype
where n.nspname = 'public'
  and p.prosecdef
  and p.prokind = 'f'
  and not p.proretset
  and t.typtype = 'c'
  and has_function_privilege('authenticated', p.oid, 'EXECUTE');
```

## → **141 at HEAD (`f804a03f`).**

This **reproduces QA's corrected figure exactly**. Sensitivity, so the next reader does
not re-derive a different number from a plausible variant:

| variant | count |
|---|---|
| exact recorded definition (`public` only) — **the figure** | **141** |
| `public` + `app` | 145 |
| the *other* blind class (`jsonb`-returning, `prosecdef`, auth-reachable, `app`+`public`) | 53 |

**146 and 150 do not reproduce under any variant I tried** — consistent with QA's
finding that the discrepancy is in the recording, not the population.
`docs/backend-state.md:205` still records **146** and should be corrected to 141 with
this query beside it (a documentation fix, not a DM5 deliverable — flagging it, not
doing it).

For context, the full `ARM=census` live domain at HEAD (the union the script builds) is
**546**: 184 `prosecdef` bool-or-setof + 88 `public` INVOKER plpgsql wrappers + 274
`public` policies.

### 6.2 Which DM5 doors fall in the blind class **[catalog]**

```sql
select n.nspname||'.'||p.proname, t.typname ret, p.proretset, p.prosecdef,
       has_function_privilege('authenticated', p.oid, 'EXECUTE')
from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_type t on t.oid=p.prorettype
where p.proname in (…);
```

| door | returns | `proretset` | auth EXEC | blind class? | bespoke keystones needed? |
|---|---|---|---|---|---|
| `add_rca_evidence` | `rca_evidence` (composite) | f | **t** | **YES — the 141** | **YES** |
| `add_capa_action_evidence` | `capa_action_evidence` (composite) | f | **t** | **YES — the 141** | **YES** |
| `mint_printed_document` | `printed_document_public` (composite) | f | **t** | **YES — the 141** | **YES** |
| `revoke_printed_document` | `printed_document_public` (composite) | f | **t** | **YES — the 141** | **YES** |
| `delete_rca_evidence` | `void` | f | t | **YES** — `void` is in no arm's domain either | **YES** |
| `delete_capa_action_evidence` | `void` | f | t | **YES** | **YES** |
| `begin_document_upload` | `jsonb` | f | t | **YES — the *other* (53) class** | **YES** |
| `finalize_document_upload` | `jsonb` | f | t | **YES — the 53** | **YES** |
| `open_document_version` | `jsonb` | f | t | **YES — the 53** | **YES** |
| `open_printed_document` | `record` | **t** | t | **NO** — `proretset` + auth-reachable ⇒ in `ARM=census`'s domain | covered by the arms |
| `lookup_printed_document` | `record` | t | **f** (no `authenticated` grant) | **NO** — and not auth-reachable at all | covered; note its reachability is via service-role only |

**Conclusion for the assurance plan.** DM5 is **worse** than DM4 on this axis, not
better. DM4 had two blind write seams; **every door DM5 will plausibly add or modify is
in one of the two blind classes** — the composite-returning 141 (all four evidence and
printed-document write doors) or the jsonb-returning 53 (all three document commands it
must extend). `ARM=census` / `hat` / `floor` / `wrapper` will pass regardless of whether
those doors are correct.

Therefore:
- **Every new or modified DM5 door needs a bespoke pgTAP keystone plus a mutation twin.**
  The §6 authz arms are a **necessary but empty** signal here — the phase record must say
  so explicitly, naming the arm, not the script (ADR 0079).
- The two **storage policies** DM5 will touch (`nsp_evidence_obj_*`,
  `capa_evidence_obj_*`) **are** in the census domain (policies, all `polcmd`), so the
  diff-scoped `ARM=policy` sweep is meaningful for those four — and per the recorded
  trap, its reported case count must be checked non-zero before it is cited.
- Any **new** gate must be added to the census domain **and** the committed findings file
  in the same change, or it passes `ARM=wrapper` / `ARM=policy` vacuously by absence
  (ADR 0079 Am. 7).
- ⚠ **Red-first is mandatory and non-trivial here**: `add_rca_evidence`'s
  `cited_document_id` seam has **three independent locks** (§2.1). A keystone written
  against the un-parked writer will go **green on its first run** because the table CHECK
  still refuses — a textbook vacuous pass with a *sibling* lock satisfying it. Drop the
  locks one at a time and prove which one each assertion is actually pinning.
- **FUP-PGTAP-VACUOUS applies directly**: `lint:vacuous` does not scan SQL, and every
  keystone DM5 writes is SQL. DM5's own assertions are unscanned by the repo's fifth lint
  gate.

---

## 7. Section G — plan-vs-reality delta

### 7.1 Named by the plan but ABSENT / RENAMED / MISDESCRIBED

1. **`meeting-attachments`** — **ABSENT.** The manifest is **8** buckets, not 9. Already
   retired by `20260921000300` and pinned by `supabase/tests/325_legacy_bucket_policy_pin.sql:54-56`.
   The plan hedges "if it exists"; the answer is no.
2. **"the verification-token flow … keep working from a satellite table"** — **the
   satellite does not exist.** `verification_token` / `verification_short_code` are
   columns on `printed_documents`, beside `storage_path`. DM5 **creates** the satellite;
   it does not preserve one. The only existing satellite, `verification_lookups`, holds
   lookup *audit* rows, not tokens.
3. **"`rca_evidence` … inbound FK into `attachments`"** — **RENAMED and understated.**
   The column is `cited_document_id`; it has no FK **and** carries a CHECK
   (`rca_evidence_cited_document_parked`) pinning it NULL **and** a fail-closed writer
   arm. Three locks, of which the plan describes two.
4. **"`printed_pdf` rendition kind"** — present, but as a **CHECK constraint, not an
   enum**. Nothing to add; the work is entirely in the `document_version_files` UNIQUE
   (see 7.2 #2).
5. **"4 production objects"** — **UNVERIFIABLE from here** and stale by the project's own
   instruction (FUP-DM4-PRODROW). Local count is 0 rows / 87 orphaned byte-files.
6. **"prove zero … then empty + delete the bucket (Storage API only)"** — the stated
   method **cannot work** as written (§5.2). Not a wording problem; the step needs a
   different mechanism.

### 7.2 LIVE but UNNAMED by the plan — the DM4 blind-spot class

Ordered by how much they change the shape of DM5.

1. **`securable_resources_type_check` admits no NSP or print type.**
   `{case, meeting, interview, action_item, controlled_document, case_referral}` — no
   `rca`, `capa_action`, `patient_safety_event`, or `form_response`. Plus
   `securable_resources_tenant_shape` requires org **and** hospital **and** commission
   all NOT NULL for every type. **Load-bearing: DM5 steps 1 and 2 are both blocked on it.**
   For RCA the commission is *ambiguous by design* (an event carries both
   `reporting_commission_id` and `current_owner_commission_id`, and custody **moves**);
   for `source_kind='form_response'` there is no securable resource concept at all. This
   is a schema-design decision the plan assumes has already been made, and it has not.
2. **`document_version_files_version_rendition_uniq UNIQUE (document_version_id,
   rendition_kind)`** vs. `printed_documents_one_active UNIQUE (…) WHERE status='active'`.
   **Load-bearing:** one `printed_pdf` per version versus many historical prints per
   source. Step 2 cannot proceed without ruling this.
3. **`nsp-evidence` has four policies in two pairs with conflicting path conventions**
   (§2.4), including an internal inconsistency inside the CAPA pair. **Load-bearing:**
   "preserve the PQS custody predicates" is not one predicate but a three-armed
   asymmetric boundary, and the RCA read gate is the **event** predicate, so it follows
   custody. A document-substrate read that binds the commission at upload time is the
   most likely silent authorization regression in DM5.
4. **`capa_action_evidence` — an entire second table, RPC pair, policy pair, and TS
   surface**, sharing the `nsp-evidence` bucket with RCA. **Load-bearing:** the plan says
   "RCA/CAPA evidence" in prose and names nothing; a migration scoped by the word `rca`
   silently omits half of step 1.
5. **`rca_evidence` / `capa_action_evidence` carry table-wide `arwdDxtm` grants to
   `authenticated`.** **Load-bearing:** the RPC is not the only door. Direct PostgREST DML
   bypasses the flag gate and the HC0DM arm. The new command RPC must be accompanied by
   a REVOKE, or DM5 ships two doors where DM1 established one.
6. **`p_storage_path` is caller-supplied and unvalidated** in both evidence writers; no
   size, MIME, or hash is captured anywhere. **Load-bearing:** this is the D8/D9 violation
   Wave D exists to fix, and the plan never states the starting position — so "onto the
   substrate" reads like a data move when it is a trust-boundary inversion.
7. **`delete_rca_evidence` / `delete_capa_action_evidence` soft-delete only.**
   **Load-bearing:** every deleted evidence file is a permanent orphan by design, which
   compounds §5 and means step 1 must decide the disposal path, not just the upload path.
8. **`pd_storage_path_derived` CHECK** couples `printed_documents.storage_path` to
   `(contains_phi, id)`. **Load-bearing but mechanical:** must be dropped when coordinates
   move to `file_objects`.
9. **`printed_documents` column-list grants** (15 of 19; `storage_path`,
   `verification_token`, `revoked_reason`, `revoked_by` withheld). **Load-bearing:** any
   DM5 column needs its own GRANT or reads fail 42501 — the `case_referral` trap.
10. **`app.can_read_document` has no NSP arm**, and its `else false` fail-closed arm plus
    the D15 ceiling backstop mean any document homed on a new resource type is
    **unreadable by everyone** until the kernel is extended. **Load-bearing but benign** —
    it fails in the safe direction, and is the reason step 1 is a kernel change.
11. **pgTAP `312`/`313`/`323` insert `storage.objects` rows for `printed-documents`
    without creating the bucket row.** **Load-bearing:** deleting that bucket in step 3
    breaks three suites on an FK violation. (By contrast `235`/`236` create their own
    bucket rows and are safe.) Similarly `mutation/u1-mutation-audit.sh:59-62` recreates a
    policy on `interview-attachments` and must be checked before that bucket row is
    dropped.
12. **`scripts/document-reconciliation.mjs` covers 2 of 12 buckets and lists from
    `storage.objects`.** **Load-bearing for step 3:** the plan's step-4 "reconciliation
    command" operational owner is being assigned to a tool that cannot see the class of
    drift step 3 must rule out.
13. **`src/lib/attachments/constants.ts:66-71`** — dead bucket constants with zero
    callers. **Not load-bearing** for correctness, but it is a `attachments`/`attachments-phi`
    literal sitting outside `src/lib/documents/`, so it will make step 5's identifier-based
    exit sweep read dirty. Delete it in step 3.
14. **`app.can_view_printed_document` has no `case` / `interview` arm** despite
    `printed_documents_source_kind_check` admitting them. **Not load-bearing for DM5**
    (fail-closed `else` arm; those arms are scheduled for later phases) — recorded so DM5
    does not read the CHECK as a list of working source kinds.

---

## 8. Uncertainties / not verified

- **Production / remote was not touched at all** — no `db push`, no `db:reset:linked`, no
  query against the linked project. Every production figure in this document is
  **UNVERIFIED — remote**, including the "4 production objects", the 2026-08-11 census,
  and whether the Cloud S3 endpoint can enumerate orphans (§5.5).
- **No `supabase db reset` was run** (shared local stack). Local row counts therefore
  reflect the current, E2E-exercised state, not a clean seed. This affects only the row
  counts, not the schema/ACL/policy facts, which are reset-independent.
- **The `/storage/v1/s3` probe returned HTTP 400** with a Bearer token; it requires SigV4
  signing. Whether that endpoint enumerates from the object store or from
  `storage.objects` is **UNVERIFIED**, and it is the single fact that would most change
  the M1-vs-M2 recommendation in §5.5.
- **No authz arm was run** (`ARM=census`/`hat`/`floor`/`wrapper`) and no mutation audit —
  out of scope for a read-only step 0. §6's conclusions are derived from the census
  *domain* queries, not from executing the harness.
- **Function-body sweeps used `pg_get_functiondef`**, which includes comments. Every
  bucket-literal hit was individually checked for comment-vs-code; the one false positive
  found (`begin_document_upload` matching `referral-attachments` in a DM4 explanatory
  comment) is recorded in the §4 manifest rather than counted as a reference.
- **`docs/backend-state.md:205` records the census blind class as 146**; §6.1 measures
  **141** at HEAD with the query. I did not edit that file — flagging the discrepancy for
  whoever owns the next backend-state rewrite (DM5 step 5).
