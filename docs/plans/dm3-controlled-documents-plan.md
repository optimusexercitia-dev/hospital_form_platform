# DM3 — Wave B: controlled documents (+ the ethics document seams)

> **Status: PLAN, awaiting lead approval. No migration or code written.**
> Executes `docs/plans/document-model-redesign.md` § "Phase DM3 — Wave B" (5 steps)
> under **ADR 0114** (+ Amendment 1 / D15-D16, Amendment 2 / D17 — **five** ethics
> discharge conditions as of the 2026-08-13 update, not four), on the DM1 substrate
> (ADR 0116) and the DM2 command layer (ADR 0118).
>
> **Every schema/RLS/RPC/policy/grant/trigger fact below was read from the LIVE
> CATALOG** on 2026-08-13 (`pg_proc` incl. `prosecdef`, `pg_policies`, `pg_trigger`,
> `pg_constraint`, `pg_class.relacl`, `information_schema.column_privileges`,
> `storage.buckets`, `storage.objects`). Migration file text was not consulted for any
> claim. The SQL is reproduced in §1.9 so every number is re-derivable.
> Where this plan states something the plan doc or an ADR says differently, the
> contradiction is called out explicitly in **§8**.

**Branch:** `docs/dm1-plan-amendments`. **No pushes, no `db push`.**
**Migration window:** verified `registered == files == 375`, highest registered
`20260924000800`. DM3 opens at **`20260925000100`**.

---

## 1. Catalog census — the evidence base

### 1.1 Tables

**Controlled-document domain (Phase 17 / ADR 0057), all `relrowsecurity = t`:**

| Table | Cols | Rows (local) | Role |
| --- | --- | --- | --- |
| `controlled_documents` | 14 | 3 | Header: `commission_id`, `code`, `title`, `doc_type`, `review_cycle_months`, `status`, `current_version_id`, `category`, `tags`, `description` |
| `controlled_document_versions` | 15 | 3 | Revision: `document_id`, `version_number`, **`storage_path`**, `summary_of_changes_md`, `effective_date`, `review_due_date`, `expiry_date`, `status`, `obsolete_kind`, `proposed_effective_date`, `approval_due_date` |
| `document_approvals` | 9 | 4 | `document_version_id` → `controlled_document_versions`, `approver_id`, `decision`, `decided_at`, `signature_hash` |
| `commission_charters` | 6 | 3 | `controlled_document_id` (1 non-null) — the charter linkage |

**Core model (DM1/DM2), all `relrowsecurity = t`:** `securable_resources` (21 rows),
`documents` (1), `document_versions` (1), `document_version_files` (1),
`file_objects` (1), `upload_sessions`, `document_placements`, `document_legal_holds`,
`document_retention`.

**Ethics seam tables:** `ethics_decision_details` (0 rows local),
`ethics_notifications` (0 rows local).

### 1.2 The name collision — verified, and the single largest hazard in DM3

Two *different* families share the `document` noun. They operate on **different
tables** with **identical parameter shapes**. Resolving by name here is how DM3
ships a wrong gate.

| Function | `prosecdef` | Reads | Family |
| --- | --- | --- | --- |
| `app.can_read_document(p_document_id, p_uid)` | DEFINER | `public.documents` | **CORE** |
| `app.can_write_document(p_document_id, p_uid)` | DEFINER | `public.documents` | **CORE** |
| `app.can_read_document_version(p_version_id, p_uid)` | DEFINER | `public.document_versions` | **CORE** |
| `app.can_read_document_of_version(p_version_id, p_uid)` | DEFINER | `public.controlled_document_versions` | **CONTROLLED** |
| `app.commission_of_document(p_document_id)` | DEFINER | `public.controlled_documents` | **CONTROLLED** |
| `app.commission_of_document_version(p_version_id)` | DEFINER | `public.controlled_document_versions` | **CONTROLLED** |
| `app.can_read_document_object(p_name, p_uid)` | DEFINER | `document_approvals` + `controlled_document_versions` | **CONTROLLED** (bucket predicate) |
| `app.is_document_approver_of` / `is_document_version_approver` | DEFINER | `document_approvals` | **CONTROLLED** |

`app.can_read_document_version` and `app.can_read_document_of_version` differ by two
words and by *which substrate they authorize*. **Binding rule for DM3: every function
reference in a migration or keystone is written with the table it reads named in a
comment on the same line.** Verified bodies, not inferred.

### 1.3 Every routine on the surface (66 total, all `search_path`-pinned)

Full list captured; the ones DM3 touches or must not break:

- **Core commands (DM2, DEFINER):** `begin_document_upload`,
  `finalize_document_upload`, `complete_document_upload_verification`,
  `open_document_version`, `reclassify_document`,
  `complete_document_reclassification`, `request_document_disposition`,
  `complete_document_disposal`, `place_document_hold`, `release_document_hold`,
  `soft_delete_document`, `set_document_confidentiality`,
  `document_delete_affordances`.
- **Controlled-document commands (Phase 17, DEFINER):** `create_controlled_document`,
  `update_controlled_document`, **`set_document_version_file`**,
  `submit_document_for_approval`, `approve_document`, `reject_document`,
  `publish_document`, `supersede_document`, `mark_document_obsolete`,
  `remind_document_approver`, `list_commission_documents`,
  `hospital_document_register`, `documents_due_for_review`,
  `upsert_commission_charter`, `evidence_candidates`.
- **Triggers (DEFINER trigger fns):** `app.guard_controlled_document_status`,
  `app.mint_controlled_document_code`, `app.guard_frozen_approver_set`,
  `app.trg_audit_controlled_documents`, `app.trg_audit_controlled_document_versions`,
  `app.trg_audit_document_approvals`, `app.guard_document_transition`,
  `app.guard_document_confidentiality`, `app.guard_document_version_immutable`,
  `app.guard_file_object_transition`.

**Not DM3 scope despite the name** (verified by body): `mint_printed_document`,
`open_printed_document`, `lookup_printed_document`, `revoke_printed_document`,
`app.can_view_printed_document`, `app.assert_document_printing_enabled` — the
**printed-documents** family (ADR 0104), which retires in **DM5/Wave D**. Likewise
`src/app/api/documents/[id]/route.ts` is the **printed-document** serving route
(reads `open_printed_document`, downloads from `printed-documents`), *not* a
controlled-document path. The URL noun is misleading; the body is not.

### 1.4 RLS policies (verified — SELECT-only everywhere; mutations are command-only)

| Table | Policy | USING |
| --- | --- | --- |
| `controlled_documents` | `controlled_documents_select` | `app.is_member_of(commission_id) OR app.is_document_approver_of(id, auth.uid())` |
| `controlled_document_versions` | `controlled_document_versions_select` | `app.is_member_of(app.commission_of_document(document_id)) OR app.is_document_version_approver(id, auth.uid())` |
| `document_approvals` | `document_approvals_select` | `approver_id = auth.uid() OR app.can_read_document_of_version(document_version_id, auth.uid())` |
| `commission_charters` | `commission_charters_select` | `app.is_member_of(commission_id)` |
| `documents` | `documents_select` | `app.can_read_document(id, (select auth.uid()))` |
| `document_versions` | `document_versions_select` | `app.can_read_document(document_id, …)` |
| `document_version_files` | `document_version_files_select` | `app.can_read_document_version(document_version_id, …)` |
| `file_objects` | `file_objects_select` | `app.can_read_file_object(id, …)` |
| `securable_resources` | `securable_resources_select` | `app.is_member_of(commission_id) OR app.is_tenancy_admin_of(commission_id)` |
| `ethics_decision_details` | `ethics_decision_details_select` | `app.can_read_case_committee(case_id, auth.uid())` |
| `ethics_notifications` | `ethics_notifications_select` | `app.can_read_case_committee(case_id, auth.uid())` |

**The approver arm appears THREE times** (`controlled_documents_select`,
`controlled_document_versions_select`, and the bucket policy). It is the arm most
likely to be silently lost when byte serving moves to `open_document_version` —
keystone **K3** exists for exactly this.

### 1.5 Storage — 12 buckets, all private; 13 `storage.objects` policies

The two that bind `controlled-documents`:

| Policy | Cmd | Predicate |
| --- | --- | --- |
| `controlled_documents_obj_select_member` | SELECT | `bucket_id = 'controlled-documents' AND app.can_read_document_object(name, auth.uid())` |
| `controlled_documents_obj_insert_writable` | INSERT | `bucket_id = 'controlled-documents' AND app.is_staff_admin_of((storage.foldername(name))[1]::uuid)` |

`app.can_read_document_object` (DEFINER, verified body) = *member of
`foldername[1]` (commission)* **OR** *an approver on any version of
`foldername[2]` (document)*. Path shape confirmed against the writer:
`src/lib/controlled-documents/actions.ts:313` builds
`` `${commissionId}/${documentId}/${crypto.randomUUID()}.${ext}` ``.

The core buckets `documents-standard` / `documents-phi` have **INSERT-only** policies
(`app.storage_upload_reserved`) and **no SELECT policy** — D8 holds today.

### 1.6 Triggers, constraints, and the three barriers to a new resource type

**`securable_resources` rejects a new type on TWO independent constraints:**

```
securable_resources_type_check   CHECK (resource_type = ANY (ARRAY['case','meeting','interview','action_item']))
securable_resources_tenant_shape CHECK (resource_type = ANY (ARRAY['case','meeting','interview','action_item'])
                                        AND organization_id IS NOT NULL
                                        AND hospital_id IS NOT NULL
                                        AND commission_id IS NOT NULL)
```

`tenant_shape` is an **unconditional conjunction**, not a per-type implication — it
re-enumerates the closed set. Both must be replaced; opening only one leaves the
insert refused, and a keystone that only exercises one would read as "the type is
admitted" while it is not.

**A third barrier is in the kernel:** `app.can_read_document`'s dispatch is
`case … when 'case' … when 'meeting' … when 'interview' … when 'action_item' … else
false end`. A `controlled_document` home therefore reads as **denied to everyone**
until an arm is added. This is the correct fail-closed direction and it is what makes
the M1/M2 split (§3) produce a genuine red.

**Shared-PK registry pattern (verified, to be mirrored exactly):**

```
cases.securable_type text NOT NULL DEFAULT 'case'
cases_securable_type_check   CHECK (securable_type = 'case')
cases_securable_resource_fk  FOREIGN KEY (id, securable_type) REFERENCES securable_resources(id, resource_type)
securable_resources_id_type_uniq UNIQUE (id, resource_type)
```
Identical for `meetings`, `case_interviews`, `action_items`.

**The S2.8 blockers, both confirmed live:**
```
document_version_files_version_rendition_uniq  UNIQUE (document_version_id, rendition_kind)
guard_document_version_file_immutable          BEFORE DELETE OR UPDATE ON document_version_files
                                               EXECUTE FUNCTION app.guard_document_version_immutable()   -- raises HC0D2 unconditionally
```

**The D15 seam guard (`app.guard_document_confidentiality`, BEFORE INSERT OR UPDATE OF
`confidentiality_level, home_resource_id` ON `documents`)** raises `HC0D6` when an
enforcing label sits on a home whose `resource_type NOT IN ('case','interview')`.
**Consequence, load-bearing for §5:** a `controlled_document`-homed document can never
carry `legal_privileged` / `credentialing_sensitive`. `documents.confidentiality_level`
CHECK admits all 7 labels; only those two are ENFORCING (`app.confidentiality_clearance_ok`
returns `true` for every other label — verified body).

### 1.7 Inbound FKs (derived from `pg_constraint`, both directions — never by name)

Into the controlled-document tables: `controlled_documents.current_version_id` →
`controlled_document_versions` (SET NULL); `document_approvals.document_version_id` →
`controlled_document_versions` (CASCADE); `commission_charters.controlled_document_id`
→ `controlled_documents` (SET NULL); `controlled_document_versions.document_id` →
`controlled_documents` (CASCADE).

Into the core model: `document_versions.document_id` → `documents` (**RESTRICT**);
`document_version_files.{document_version_id,file_object_id}` → (**RESTRICT**);
`upload_sessions.*`; `document_legal_holds.document_id` (RESTRICT);
`document_placements.{document_id,resource_id}`; `documents.home_resource_id` →
`securable_resources` (**RESTRICT**); the four shared-PK composite FKs.

**The two ethics seam columns carry NO foreign key today** — verified: neither
`ethics_decision_details.decision_letter_document_id` nor
`ethics_notifications.related_document_id` appears in `pg_constraint` with
`contype='f'`. They are bare nullable `uuid`. This matches the DM1 record.

### 1.8 ACLs

**Table ACLs — uniform `authenticated=r/postgres` (table-wide SELECT).** Verified via
`pg_class.relacl` + `information_schema.column_privileges`: none of
`controlled_documents`, `controlled_document_versions`, `document_approvals`,
`documents`, `document_versions`, `document_version_files`, `file_objects`,
`securable_resources`, `ethics_*` is **column-list hardened** the way `profiles` and
`case_referral` are. **So a new column here inherits SELECT automatically and does
NOT need its own GRANT.** (Stated because the project's standing rule is the
opposite for hardened tables — this is the verified exception, not an assumption.)

**Function ACLs — a real gap, pre-existing.** The DM1/DM2 core doors are
PUBLIC-revoked (`postgres=X ; authenticated=X ; service_role=X`). Seven Phase-17
`app.*` DEFINER helpers still carry the Postgres default, i.e. **PUBLIC has
EXECUTE**:

`app.can_read_document_object`, `app.can_read_document_of_version`,
`app.commission_of_document`, `app.commission_of_document_version`,
`app.decide_document_approval_core`, `app.is_document_approver_of`,
`app.is_document_version_approver` (plus the trigger functions
`app.guard_controlled_document_status`, `app.mint_controlled_document_code`,
`app.trg_audit_*`).

**Assessment — hardening gap, NOT a live leak, and I am labelling it that way
deliberately.** `pg_namespace.nspacl` for schema `app` is
`postgres=UC ; authenticated=U ; service_role=U` — **`anon` has no USAGE on `app`**,
and `config.toml` exposes only `public` to PostgREST. So PUBLIC EXECUTE is not
reachable by an anonymous caller. It is still a deviation from ADR 0114 D7 ("every
DEFINER door … PUBLIC-revoked"), and four of these seven are inside DM3's diff.
**Disposition:** DM3 revokes PUBLIC on the ones it touches or leaves live
(§3 M5); the rest are listed in §7 as a named residual, not silently fixed and not
silently ignored.

### 1.9 The SQL (so every number above is re-derivable)

Run as `postgres` inside `supabase_db_azkbbhskturikxpgmafq`:

```sql
-- tables + RLS
select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r'
  and (c.relname ~ 'document|controlled|charter|securable|file_object|upload_session');

-- routines: name OR body reference, with prosecdef + search_path + body flags
select n.nspname||'.'||p.proname, p.prosecdef, pg_get_function_identity_arguments(p.oid),
       pg_get_function_result(p.oid), p.proconfig,
       p.prosrc ~ 'controlled_document'  as body_cd,
       p.prosrc ~ 'controlled-documents' as body_bucket,
       p.prosrc ~ 'document_approvals'   as body_appr,
       p.prosrc ~ 'commission_charters'  as body_charter
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('public','app')
  and (p.proname ~ 'document|charter'
       or p.prosrc ~ 'controlled_document|controlled-documents|document_approvals|commission_charters');

-- bodies (the ONLY way to tell the two families apart)
select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where (n.nspname='app'  and p.proname in ('can_read_document','can_write_document','can_read_document_version',
        'can_read_document_of_version','can_read_document_object','commission_of_document',
        'commission_of_document_version','can_read_file_object','guard_document_confidentiality',
        'storage_upload_reserved','guard_document_version_immutable','is_document_approver_of',
        'is_document_version_approver','confidentiality_clearance_ok','can_read_case_committee'))
   or (n.nspname='public' and p.proname in ('set_document_version_file','issue_ethics_notification',
        'open_document_version','begin_document_upload','reclassify_document'));

-- policies (table + storage)
select tablename, policyname, cmd, roles, qual, with_check from pg_policies
where schemaname='public' and tablename ~ 'document|charter|securable|file_object|ethics';
select policyname, cmd, roles, qual, with_check from pg_policies
where schemaname='storage' and tablename='objects';

-- triggers
select c.relname, t.tgname, pg_get_triggerdef(t.oid) from pg_trigger t
join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
where not t.tgisinternal and n.nspname='public' and c.relname ~ 'document|charter|ethics|file_object';

-- INBOUND FKs (both directions), CHECK/UNIQUE, unique indexes
select con.conname, src.relname, tgt.relname, pg_get_constraintdef(con.oid)
from pg_constraint con join pg_class src on src.oid=con.conrelid
join pg_class tgt on tgt.oid=con.confrelid where con.contype='f'
  and (tgt.relname ~ 'document|securable|file_object' or src.relname ~ 'document|ethics|charter');
select c.relname, con.conname, con.contype, pg_get_constraintdef(con.oid)
from pg_constraint con join pg_class c on c.oid=con.conrelid
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and con.contype in ('c','u','p') and c.relname ~ 'document|securable|file_object';

-- ACLs (table, column, function, schema)
select relname, relacl from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname ~ 'document|securable|file_object|ethics|charter';
select table_name, column_name, grantee, privilege_type from information_schema.column_privileges
where table_schema='public' and grantee in ('authenticated','anon','service_role')
  and table_name ~ 'document|securable|file_object|ethics';
select n.nspname||'.'||p.proname, p.proacl from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('public','app') and p.proname ~ 'document|charter|ethics_notification';
select nspname, nspacl from pg_namespace where nspname in ('app','public','storage');
```

**Verified vs inferred.** Everything in §§1.1–1.8 is *verified* from the catalog on
2026-08-13. **Inferred** (and flagged as such): (a) the *intent* of the two
constraint barriers being redundant rather than deliberate belt-and-braces; (b) that
production's policy/routine set matches local — **not verifiable from here**, must be
re-derived against production at build time; (c) production object counts (§2), taken
from the 2026-08-11 audit record, not re-measured.

---

## 2. Local vs production reconciliation state

| Fact | **Local (measured 2026-08-13)** | **Production (2026-08-11 audit record — NOT re-measured)** |
| --- | --- | --- |
| `controlled_documents` rows | 3 | not recorded |
| `controlled_document_versions` rows | 3 | not recorded |
| …with `storage_path IS NOT NULL` | **0** | **0** (the audit's "0 version rows referencing them") |
| objects in `controlled-documents` bucket | **0** | **3** (~part of the 45-object / 0.5 MB census) |
| `document_approvals` rows | 4 | not recorded |
| `commission_charters` with a document link | 1 | not recorded |
| `ethics_decision_details` rows / non-null seam | 0 / 0 | 3 / **0** (per the plan doc's table) |
| `ethics_notifications` rows / non-null seam | 0 / 0 | 2 / **0** |
| Drift U1 (version row → missing object) | **0** | 0 |
| Drift U2 (object → no version row) | **0** | **3** |

**They do not match, and the difference is the whole reconciliation problem.**
Local has no bytes at all, so local drift is zero *vacuously* — a local green here
proves nothing about production. Stated explicitly so no one cites the local zero as
coverage.

**The load-bearing agreement:** in **both** environments, **zero
`controlled_document_versions` rows carry a `storage_path`**. Therefore:

- The backfill has **zero version→file bindings to create**. Not "few" — zero. Any
  `file_objects` row the backfill produces would be invented.
- The 3 production objects are **pure orphans**: no version row references them, so
  there is nothing to bind them *to*. A `file_object` for them would be a row with no
  document version, which the model has no legal shape for.

**Disposition of the 3 production objects — quarantine, explicitly.**

1. **Do not migrate them.** Binding them would require inventing a version
   association that no data supports. This is the "never invent success" clause.
2. **Do not delete them in DM3.** DM5 step 3 owns bucket deletion under a single
   retirement manifest ("do not delete any early").
3. **Record them by identity.** DM3 extends the reconciliation script
   (`scripts/document-reconciliation.mjs`, ADR 0118 Consequences / FINDING 3) with a
   `--legacy-bucket controlled-documents` mode that emits, per object: `name`,
   `size`, `created_at`, and a classification of exactly one of
   `RECONCILED` / `ORPHAN_QUARANTINED` / **`UNEXPLAINED`**.
4. **What it reports when it cannot explain a row:** an `UNEXPLAINED` line naming the
   object **and a non-zero process exit**. No silent skip, no bucketing into
   "orphan" by default — `ORPHAN_QUARANTINED` requires the positive proof *no
   `controlled_document_versions.storage_path` equals this name*; anything the script
   cannot positively classify is `UNEXPLAINED` and fails the run.
5. **The manifest.** The 3 object names go into the DM5 retirement manifest as
   quarantined-and-deleted-with-the-bucket, carried in `docs/backend-state.md` so
   DM5 does not rediscover them.
6. **Production is NOT re-measured during DM3 — lead-ruled Q5, 2026-08-13.**
   Every production figure in this plan is **PROVISIONAL and UN-RE-MEASURED**, sourced
   from the 2026-08-11 audit record. Nothing is pushed; `main` stays at `f84c6b6`.
   **Re-measurement becomes an explicit PRECONDITION of two things, and of nothing
   before them:**
   - **DM5's retirement manifest** — that is where buckets are actually deleted, and
     the first moment a wrong count can destroy bytes;
   - **any `supabase db push`** — the first moment the migration chain meets real data.

   Until then the numbers are used only to size the work, never to authorize a
   deletion. Any statement in §2 or §10 that rests on them carries this marking.

**Backfill scope, consequently:** registry rows + core `documents` rows + core
`document_versions` rows, and **no `file_objects` and no `upload_sessions`** — because
there are no bytes to describe. Every backfilled core version is fileless, which the
model already represents (`open_document_version` raises `HC0D8`
*"arquivo ainda não disponível"*, and the TS projection is `availability: 'pending'`).

> **Open sub-question for the lead (§9 Q2):** the plan text says "each version → core
> `document_version`". I follow it, so reconciliation is a clean 1:1 count. The
> alternative — leave the pointer NULL and mint the core version on first upload —
> creates fewer rows but makes the exit's "migration counts reconciled" a
> conditional. I recommend the 1:1.

---

## 3. Migration plan (window `20260925000100`+)

Eight migrations. Each states its purpose, why it is (or is not) split, and its
liveness/rollback story. **No live users exist pre-pilot**, so "rollback" means
*re-runnable from a clean `supabase db reset`*, not a production undo window.

### M1 — `20260925000100_dm3_securable_controlled_document.sql`
**Registry admission.**
- Replace `securable_resources_type_check` **and** `securable_resources_tenant_shape`
  to admit `'controlled_document'` with the same NOT-NULL tenant triple.
  *(Two constraints, one behaviour — both replaced in this migration; §6 K1b
  neutralizes each independently.)*
- `controlled_documents`: add `securable_type text NOT NULL DEFAULT 'controlled_document'`
  + `CHECK (securable_type = 'controlled_document')` + composite FK
  `(id, securable_type) REFERENCES securable_resources(id, resource_type)`,
  mirroring `cases_securable_resource_fk` exactly.
- Backfill one `securable_resources` row per existing `controlled_documents` row,
  deriving `organization_id` / `hospital_id` / `commission_id` from `commissions`.
  Ordering: registry rows are inserted **before** the FK is added.
- **Deliberately does NOT touch `app.can_read_document`.** After M1 a
  `controlled_document`-homed document is readable by **nobody** (the `else false`
  arm). That intermediate state is **fail-closed and therefore correct**, not
  defective — which is what licenses the split (see the rule below).
- *Liveness:* nothing consumes the new type yet; `documents_wave_b` is OFF.

### M2 — `20260925000200_dm3_kernel_controlled_arm.sql`
**The authorization arm.** `CREATE OR REPLACE` both kernel functions:
- `app.can_read_document`: add
  `when 'controlled_document' then app.is_member_of_for(v_commission, p_uid)
   or app.is_document_approver_of(v_resource, p_uid)`
  — `v_resource` is the `controlled_documents.id` (shared PK), so
  `app.is_document_approver_of` (CONTROLLED family, reads `document_approvals`)
  applies unchanged. **This is where the approver arm survives the bucket-policy
  death.**
- `app.can_write_document`: add
  `when 'controlled_document' then app.is_staff_admin_of_for(v_commission, p_uid)`
  — mirrors today's `set_document_version_file` gate (`app.is_staff_admin_of`).
- `app.guard_document_confidentiality` **unchanged** — enforcing labels stay
  case/interview-only.

> **Why M1 and M2 are split (the DM2 lesson, applied — not ritualised).** With them
> merged, K2 ("a commission member reads a controlled-document-homed row") would be
> **green on its first run**, which per the standing rule is a *finding*, not a pass.
> Split, K2 is authored against the M1 catalog and observed **RED** on the real,
> unmutated schema. The intermediate state is admissible precisely because it is
> *fail-closed*: an absent arm denies everyone. Contrast — we would **not** split a
> migration whose intermediate state were a deliberately defective gate; an absent
> door beats a broken one.

### M3 — `20260925000300_dm3_domain_core_binding.sql`
**The domain ↔ core seam.**
- `controlled_documents.core_document_id uuid NULL REFERENCES documents(id) ON DELETE RESTRICT`
  — one core document per controlled document, stable across versions.
- `controlled_document_versions.core_document_version_id uuid NULL REFERENCES document_versions(id) ON DELETE RESTRICT`.
- Trigger `app.guard_controlled_core_binding` (BEFORE INSERT OR UPDATE OF
  `core_document_version_id`): the pointer may be set or moved **only** while the
  domain `status IN ('draft','changes_requested')` — the exact freeze rule
  `set_document_version_file` enforces today (`HC089`); and the referenced core
  version's document must be the row's own `core_document_id` (no cross-document
  binding).
- **Backfill:** for each of the 3 controlled documents, one `documents` row
  (`home_resource_id` = the M1 registry row, `title` = `controlled_documents.title`,
  `kind = 'documento_controlado'`, `status='active'`, `confidentiality_level` NULL,
  `created_by` = `controlled_documents.created_by`); for each of the 3 versions, one
  `document_versions` row (`version_number` = the domain number at backfill), pointer
  set. **No `file_objects`** (§2).
- *Liveness:* additive; both pointers nullable; nothing reads them until M4.

> **Why this is not a D10 violation.** D10 forbids a *pointer update on the file
> binding* (`document_version_files`) — that is what
> `document_version_files_version_rendition_uniq` + `guard_document_version_file_immutable`
> physically enforce. `core_document_version_id` is a **domain-side seam**, on a
> mutable domain table, moved only while the domain version is unfrozen. It amends
> nothing in DM1 and widens nothing. See §4 for the S2.8 disposition this rests on.

### M4 — `20260925000400_dm3_replace_set_document_version_file.sql`
**Step 2: the raw `storage_path` write path ends.**
- `DROP FUNCTION public.set_document_version_file(uuid, text, text, date);`
- `CREATE FUNCTION public.attach_controlled_document_version_file(
     p_version_id uuid, p_core_version_id uuid,
     p_summary_of_changes_md text DEFAULT NULL, p_expiry_date date DEFAULT NULL)
   RETURNS controlled_document_versions` — DEFINER, `search_path` pinned,
  PUBLIC revoked, `authenticated`/`service_role` granted. It asserts
  `app.assert_controlled_docs_enabled()` **and** a new
  `app.assert_documents_wave_b_enabled()` (reads the existing `documents_wave_b`
  flag, currently `false`), re-checks `app.is_staff_admin_of(commission)`, re-checks
  the draft/changes_requested freeze, then sets the pointer + summary + expiry.
  Bytes arrive **only** via the DM2 `begin_document_upload` →
  `finalize_document_upload` pair with `p_resource_type = 'controlled_document'`.
- **All five `p_storage_path` call sites die together** — catalog- and code-verified:
  `set_document_version_file` is the **only** controlled-document RPC with a
  `p_storage_path` parameter, and `src/lib/controlled-documents/actions.ts` calls it
  from **five** product verbs: `addDocumentVersion()` (:350),
  `createAndSubmitDocument()` (:660), `createDraftOnly()` (:715),
  `supersedeAndSubmitDocument()` (:787), `reviseChangesRequestedDocument()` (:877).
  The drop set is one function and **five** callers — not just the add-version path.
  *(The other `p_storage_path` sites in `src/lib/referrals/actions.ts:443`,
  `src/lib/safety/rca-actions.ts:321` and `capa-actions.ts:333` belong to DM4 and
  Wave D and are OUT of DM3's set — the enumeration is by RPC identity, not by
  parameter name.)*
- `ALTER TABLE controlled_document_versions DROP COLUMN storage_path;`
  Data-safe: zero non-null values in both environments (§2). Its column grants drop
  with it (no separate REVOKE needed).
- *Liveness:* Wave B flag OFF ⇒ the new door refuses until the gate flips it; the old
  door is gone in the same migration, so there is never a window with two writers.
  Rule 8: `npm run gen:types` after this migration.

### M5 — `20260925000500_dm3_controlled_bucket_doors_retire.sql`
**Step 4: byte serving moves to the audited door.**
- `DROP POLICY controlled_documents_obj_select_member ON storage.objects;`
- `DROP POLICY controlled_documents_obj_insert_writable ON storage.objects;`
  ⚠ **The plan text names only the SELECT policy.** Dropping SELECT alone leaves a
  live INSERT door into the bucket that bypasses `begin_document_upload` entirely —
  a write path with no reserved-path check, no tier derivation, no `file_objects`
  row. Since M4 removes its only caller, keeping it is a door nothing opens and
  everything can push through. **Recommend dropping both; flagged in §8 as a
  deviation from the plan text for the lead to confirm.**
- `DROP FUNCTION app.can_read_document_object(text, uuid);` — after a `prosrc`
  sweep proving no surviving reference (the drop set is derived from
  `pg_proc.prosrc` + `pg_policies`, never from a name list).
- `REVOKE EXECUTE … FROM PUBLIC` on the Phase-17 `app.*` helpers DM3 leaves live:
  `app.can_read_document_of_version`, `app.commission_of_document`,
  `app.commission_of_document_version`, `app.is_document_approver_of`,
  `app.is_document_version_approver`, `app.decide_document_approval_core`
  (§1.8 gap), granting `authenticated`/`service_role` explicitly.
- **The bucket row itself is NOT deleted** — DM5 owns the single retirement manifest.

### M6 — `20260925000600_dm3_controlled_no_phi_tier.sql`
**Step 3's no-PHI stance, aimed at the surface that actually admits tier input.**
`reclassify_document(p_document_id, p_target_tier)` is the **only** caller-facing
PHI-tier input in the model — verified body: it accepts `p_target_tier IN ('standard','phi')`
for **any** home type. `begin_document_upload` derives the tier server-side
(`case`/`interview` → phi, else standard), so a controlled-document upload is
`standard` by construction and has nothing to reject.
- Add to `reclassify_document`: refuse when the home `resource_type =
  'controlled_document'` and `p_target_tier = 'phi'`, with a distinct errcode.
- **Split from M2 deliberately:** with M2 landed and M6 absent, K7 is genuinely red
  on the real catalog (a controlled document *is* reclassifiable to PHI). Merged,
  K7 would be born green — vacuous.

### M7 — `20260925000700_dm3_ethics_document_seams.sql`
**Step 5, discharge conditions 1–3 and 5** (the five-condition set per the
2026-08-13 amendment; condition 4 is the K8c removal in §6).
- `ethics_decision_details.decision_letter_document_id` → real FK
  `REFERENCES documents(id) ON DELETE RESTRICT`.
- `ethics_notifications.related_document_id` → real FK, same shape.
- Trigger `app.guard_ethics_document_case_scope` on **both** tables (BEFORE INSERT OR
  UPDATE OF the seam column): the referenced document's `home_resource_id` must equal
  the row's `case_id` — i.e. resource type `'case'` and id = `case_id`. **This is the
  structural guarantee that an ethics-linked document carries the ethics reader set**
  (§5).
- `public.issue_ethics_notification` (`CREATE OR REPLACE`, **signature unchanged**):
  delete the `HC0DM` rejection; add (i) `app.can_read_document(p_related_document_id,
  auth.uid())` — you may not link what you cannot read; (ii) a same-case check with
  an errcode **distinct** from the trigger's, so the two barriers are separately
  observable (§6 K12).
  *Signature stability matters:* `supabase/tests/290_authz_never_called_door_floor.sql:195`,
  `258_ethics_e2_rpcs.sql:131` and `267_ethics_e3a_autoderive.sql:67` all call this
  RPC. Keeping the 8-parameter identity means the floor arm and both ethics suites
  are unaffected.

- **Condition 5 — `set_ethics_decision_details` gains `p_decision_letter_document_id`.**
  ⚠ **This one is a DROP+CREATE and the other is not — and confusing them silently
  discards an ACL.** Catalog-verified:

  ```
  set_ethics_decision_details  11 args, prosecdef=t
    proargtypes: uuid, uuid, date, date, boolean, text, boolean, text,
                 timestamptz, boolean, timestamptz     -- args 2..11 all DEFAULT NULL
    proacl: postgres=X ; service_role=X ; authenticated=X
  ```

  `CREATE OR REPLACE` matches on `(name, proargtypes)`, so adding a 12th parameter
  does **not** replace this function — it creates an **overload**, leaving the
  11-arg version live. Worse: because every optional argument already defaults to
  NULL, an 11-argument call would then be **ambiguous between the two candidates**
  (`42725 function is not unique`), breaking the live ethics decision screen.
  Therefore:

  ```sql
  DROP FUNCTION public.set_ethics_decision_details(
    uuid, uuid, date, date, boolean, text, boolean, text, timestamptz, boolean, timestamptz);
  CREATE FUNCTION public.set_ethics_decision_details(... , p_decision_letter_document_id uuid DEFAULT NULL) ...
  REVOKE EXECUTE ON FUNCTION public.set_ethics_decision_details(...) FROM PUBLIC;
  GRANT  EXECUTE ON FUNCTION public.set_ethics_decision_details(...) TO authenticated, service_role;
  ```

  **The re-GRANT is not optional and not cosmetic** — a DROP+CREATE restores the
  Postgres default ACL (PUBLIC EXECUTE, no `authenticated` grant), which is the
  "a rebuild loses properties / guards that read right but fail open" scar. Pinned
  by **K14b**, which asserts the ACL *after* the rebuild rather than trusting the
  migration text.

  The new parameter is subject to the same `app.guard_ethics_document_case_scope`
  trigger and the same `app.can_read_document` check as the notification seam — the
  trigger is the barrier; the RPC check is the pt-BR error, with a distinct errcode.

  **Contrast, stated so it is not "tidied" later:** `issue_ethics_notification` keeps
  its 8-argument identity and is `CREATE OR REPLACE` (ACL preserved, refusal removed
  from the **body**); `set_ethics_decision_details` changes identity and is
  DROP+CREATE (ACL rebuilt by hand). Two ethics functions, opposite treatments, in
  the same migration.

- *Liveness:* both columns hold zero non-null rows in both environments, so the FK
  additions validate trivially. No `NOT VALID` dance needed.

- **Scope boundary (PO): plumbing to writable, NO UI.** DM3 makes both seams
  writable end-to-end and stops there. No attach-a-letter affordance —
  **FUP-DM3-ETHICS-UI**. The absence of a UI is the ruling, not a gap.

### M8 — `20260925000800_dm3_wave_b_projection_doors.sql`
**Projection + register alignment.** `list_commission_documents`,
`hospital_document_register`, `documents_due_for_review` and
`evidence_candidates` currently project `controlled_document_versions.storage_path`
(or select it implicitly). `CREATE OR REPLACE` each to project
`core_document_version_id` + a derived availability instead. **Kept separate from
M4** so that the M4 drop of `storage_path` produces an immediate, loud failure in
any door still projecting it, rather than a silently rewritten body.
*(Exact door list is re-derived from `pg_proc.prosrc` at build time — the four above
are the census hits, not a hand list.)*

**Flag choreography (gate-time, not a migration):** `documents_wave_b` → ON locally
in `seed.sql`, and in production only after human approval, per the DM2 pattern.

---

## 4. S2.8 disposition — explicit, as required

**S2.8 is CLOSED, and DM3 does not force it open.**

The open item as handed to me describes `reclassify_document_file` as having "no legal
expression on the DM1 substrate". Against the live catalog:

- **No function named `reclassify_document_file` exists** in `pg_proc` (public or app).
- The capability shipped in DM2 as **`reclassify_document`** +
  **`complete_document_reclassification`** (both present, DEFINER, `search_path`
  pinned), and **ADR 0118 §10** records the resolution in terms: the UNIQUE + the
  immutability guard "rule out both a sibling `source` binding and a rebind, and D10
  forbids the pointer update. **So reclassification is APPEND-ONLY:** copy → verify →
  commit as a new `document_version` with its own binding → retire-source."

So the constraint pair was never worked around — the *command shape* changed to fit
it. Both blockers are still live and DM3 leaves both untouched.

**Does DM3's step 2 reopen it?** No, and the reason is worth pinning because it is
the one place DM3 could have drifted:

Today `set_document_version_file` can be called repeatedly on a draft version — it
`UPDATE`s `storage_path`, which is how a staff_admin fixes a wrong upload before
approval. Under the core model each `begin_document_upload` mints a **new**
`document_version`, so a single domain version can accumulate several core versions.
The naive way to preserve today's UX would be to re-bind the existing core version's
file — **which is exactly the mutation S2.8 could not express**.

DM3 does not do that. It moves the mutable pointer to the **domain** side
(`controlled_document_versions.core_document_version_id`, M3), leaving every core
`document_version` and every `document_version_files` binding append-only and
immutable. Superseded core versions remain as honest history — the same cost ADR 0118
§10 already accepted for reclassification ("visible, audited version history —
honest").

**Against the rule *"DM1 invariants may be amended, never widened as a side effect of
making a command compile"*:** DM3 amends nothing and widens nothing. The UNIQUE
stands, the immutability trigger stands, D10's no-pointer-update stands (it governs
the *file binding*, which DM3 never updates). If review disagrees that a domain-side
pointer is outside D10's scope, the fallback is to forbid re-upload on a draft and
require a new domain version — a product regression, and it should be an explicit
PO decision, not a silent consequence. Raised as **§9 Q3**.

**Consequence to state, so nobody "fixes" it later:** core `version_number` and domain
`version_number` are deliberately **not equal**. The core number counts file
revisions; the domain number is the published revision identity.

---

## 5. The authorization story

### 5.1 How a controlled-document read resolves after DM3

```
Metadata:  documents_select  →  app.can_read_document(id, uid)          [CORE kernel]
             ├─ app.is_active(uid)
             ├─ dispatch on securable_resources.resource_type
             │    └─ 'controlled_document' → app.is_member_of_for(commission, uid)
             │                             OR app.is_document_approver_of(cd_id, uid)   ← M2
             └─ D15 ceiling arm: UNREACHABLE for this home (see 5.3)

Bytes:     open_document_version(core_version_id)                        [the ONLY door]
             ├─ app.assert_documents_enabled()
             ├─ app.can_read_document(...)            ← same kernel, no second opinion
             ├─ QO·B byte cut: v_case = case resource_type when 'case' … when 'interview' …
             │                 else NULL  ⇒ NULL for controlled_document ⇒ cut does not apply
             ├─ documents.status must be 'active'         (disposal_pending/disposed → HC0DD)
             ├─ document_version_files rendition 'source' (absent → HC0D8)
             ├─ file_objects.disposal_state = 'none'; upload_state ∈ (clean, unscanned_accepted)
             ├─ D11 audit: PHI tier OR non-creator → one audit row
             └─ returns ids + metadata ONLY — no bucket, no path (ADR 0118 §1)

Signing:   src/lib/documents/actions.ts — the coordinate-resolving module exception
           (ADR 0118 §1): resolves bucket/path with the service client AFTER the door
           authorizes, signs 300 s (standard tier). Raw paths never leave the module.
```

**Which arm covers what** (naming the arm and its domain predicate, as required):

| Concern | Gate | Domain predicate |
| --- | --- | --- |
| Metadata reach | `documents_select` RLS + `app.can_read_document` | `prosecdef = t`; a DEFINER gate *replaces* RLS, so this body **is** the boundary |
| Byte reach | `open_document_version` (`prosecdef = t`, returns `jsonb`) | ⚠ **In NO authz arm's domain** — ADR 0118 §12: `ARM=census` clause 2 bounds by `proretset`, a *syntax*; this door returns scalar `jsonb`. It is covered by pgTAP keystones only. Stated, not glossed. |
| New DEFINER doors (M4, M7) | `ARM=census` | must be added to the census domain **and** the committed findings file in the same phase (ADR 0079 Am. 3 + Am. 7) |
| INVOKER wrappers | `FROMFINDINGS=1 ARM=wrapper` | DM3 adds none; if that changes, the new wrapper must enter the findings file or it passes vacuously by absence |

**Prior-version downloads keep working** (plan step 4's explicit requirement)
*by construction*: `open_document_version` takes a **core version id** and never
consults `controlled_documents.current_version_id` or the domain `status`. An
authorized member opening version N-1 passes the same kernel. Pinned by **K9** —
because "by construction" is a claim, and this repo has been burned by exactly that
phrasing.

### 5.1b What DM3 actually replaces on the download side — and the audit delta

Verified in the code: a controlled document has exactly **two** download chains, and
**neither is a serving route**. Both mint a signed URL **server-side during RSC
render** and hand the browser a plain `<a href target="_blank">`:

```
src/lib/queries/controlled-documents.ts:545  createSignedDownloadUrl(storagePath)
  └─ :548-550  cookie client → .storage.from('controlled-documents')
                             → .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS)
consumers:
  .../manage/documentos/[documentId]/page.tsx      — every PRIOR version + the in-force one
  .../documentos-pendentes/[documentId]/page.tsx   — the outside approver's copy
```

So today: **authority is checked once, at page render, by the Storage SELECT policy**
(`controlled_documents_obj_select_member`), and the resulting bearer URL is valid for
its full TTL with **no download-time re-check and no audit row**. That is the F-14
shape — the same class of finding that motivated ADR 0114 — and DM3 step 4 is its
removal.

**The audit delta, stated precisely** (the D11 floor is *not* "one row per
download"):

| | Today | After DM3 |
| --- | --- | --- |
| Download by a **non-creator** | **0** audit rows | **exactly 1** `document.opened` row |
| Download by the document's **own creator**, standard tier | 0 | **0 — deliberately** (D11 floor: same-user standard opens are not logged) |
| **Denied** attempt | 0 | **0** — denials raise, never log (D11) |
| Authority checked at | render only | **every** `open_document_version` call |

Controlled documents are `standard` tier by construction (§3 M6), so the PHI-tier
clause of the D11 floor never fires for them; the non-creator clause is what produces
the row. **An "exactly one row per download" keystone would be wrong** — K16 asserts
the three-way split above.

**Also verified, and load-bearing for the backfill:** `storage_bucket` has **zero**
occurrences anywhere in the controlled-document substrate. There is no bucket column
and no indirection — the bucket is a hard-coded literal at exactly two sites
(`actions.ts:316` upload, `queries/controlled-documents.ts:549` sign). Every
controlled-document version therefore carries a **bare path** whose bucket is implied
by the call site. This is why the §2 quarantine records the 3 production orphans by
`(bucket, name)` explicitly: the bucket is context, not data, and it stops being
recoverable the moment both call sites are deleted.

### 5.2 The version-grant seam (reviewer access, not a bucket policy)

The approver arm is preserved as an arm of the **kernel**, not of a storage policy:
`app.is_document_approver_of(controlled_documents.id, uid)`. Because
`controlled_documents.id == securable_resources.id` (shared PK), the kernel already
holds the right identifier. An approver from another commission therefore keeps byte
access through `open_document_version` after `controlled_documents_obj_select_member`
dies — **K3** proves it, and K3 is the keystone I most expect to catch a regression.

### 5.3 The D15 ceiling, and where it does *not* apply

`app.guard_document_confidentiality` refuses an enforcing label on any home outside
`('case','interview')` (errcode `HC0D6`). A `controlled_document` home is therefore
**structurally incapable** of carrying `legal_privileged` / `credentialing_sensitive`.
The kernel's ceiling arm has a fail-closed backstop for exactly this
(`v_case IS NULL → return false`), so the two barriers agree in the safe direction:
the write is refused; if it somehow existed, the read is refused.

**These are two barriers for one behaviour, and DM3 must neutralize them
independently** (K6a/K6b) — the DM2 finding about two doc-status checks that were
really one barrier with two codes.

### 5.4 ⭐ The ethics access shape — why it is NOT the controlled-document shape

**Recommendation: an ethics decision letter's core `documents` row homes on the
CASE securable resource — never on a `controlled_document` resource. No
`controlled_documents` row is created for it.**

Three independent catalog facts force this, and each of them alone would:

1. **The reader set.** A `case` home dispatches to `app.can_read_case(v_resource, uid)`
   — the ADR 0072 / ETH·E1 spine — and then through the D15 ceiling to
   `app.confidentiality_clearance_ok`, whose verified body reads
   `case_access_grants` + `max_confidentiality` + `revoked_at`/`expires_at` +
   `app.confidentiality_rank`. A `controlled_document` home dispatches to
   `app.is_member_of_for(commission, uid)` — **every ordinary commission member**.
   Homing an ethics letter on a controlled-document resource *is* importing Wave B's
   reader set, which Amendment 2 forbids in terms.
2. **The ceiling would become inexpressible.** Per §5.3 a `controlled_document`-homed
   document cannot carry `legal_privileged` at all — the exact label ADR 0072 D7 made
   enforcing for this material. Wave B's home would silently *delete* the ceiling for
   ethics letters.
3. **The byte cut.** `open_document_version`'s QO·B discrimination
   (`read_case_deliberation`) applies only to `case`/`interview` homes. A
   controlled-document home skips it; a case home keeps it.

"Reuses Wave B's machinery" (D17) is satisfied: the letter rides the **core document
aggregate and the begin/finalize/open corridor** that DM3 wires up and turns on —
which is what the wave delivers. It does not need the `controlled_documents`
lifecycle tables, because an ethics letter's approval lifecycle already exists as the
ethics case decision (`case_decisions` → `ethics_decision_details`).

⚠ **This is an interpretation of D17's "same shape as a controlled document", and
getting it wrong leaks ethics content to every commission member. Raised as §9 Q1
for an explicit ruling.** The negative twin (**K4**) is written so that the wrong
choice fails loudly rather than shipping quietly.

**The negative twin, precisely.** K4 asserts: a document homed on an ethics case,
linked from `ethics_decision_details.decision_letter_document_id`, is **not** readable
by an ordinary member of the case's commission who holds no case access — and the
mutation twin adds a commission-membership arm to the `case` branch of
`app.can_read_document` and requires K4 to go **red**. A twin that only removes the
ethics arm would prove nothing; the failure mode here is *widening*, so the twin must
widen.

---

## 6. Keystones — new suite `330_dm3_controlled_documents.sql`

DM1 = `328_dm1_document_substrate.sql`, DM2 = `329_dm2_document_commands.sql`.
**DM3 adds `330`**, and **edits `328`** (K8c removal only — see the finding below).

Every keystone below is **authored and observed RED before its implementing
migration**, or carries a named mutation twin. Green-on-first-run is treated as a
finding, not a pass.

### Labelling — R1, and the collision is wider than the trio

**R1 discharged by changing the whole scheme, not the three labels.** Enumerated from
the suites: `328` uses **~104 `K`-prefixed labels** (`K1a`…`K16s`). My draft `330`
labels collided with **eleven** of them, not three — `K1a`, `K1b`, `K2b`, `K3`, `K9`,
`K10`, `K12a`, `K12b`, `K13`, `K14b`, `K16*` — each meaning something unrelated in
each suite. Renumbering only K8a/K8b/K8c-POS would have left ten live collisions.

`329` already abandoned `K`-numbering: it uses **section letters** (`S`/`F`/`U`/`O`/
`D`/`H`/`C`/`W`/`R`/`A`/`B` + ordinal). `330` follows the newer sibling and adds the
program tag the repo uses elsewhere (`QO·B`, `ETH·E1`, `DM2·S2`): every label is
**`DM3·<Section><n>`** — globally greppable, collision-free against both `328`'s
`K*` and `329`'s bare letters.

Sections: **R** registry · **A** authorization arm · **C** ceiling · **T** tier/no-PHI ·
**B** bucket & door retirement · **P** pointer freeze · **E** ethics seams ·
**X** reconciliation & audit · **S** structural/ACL.

| # | Pins | Proven able to fail |
| --- | --- | --- |
| **DM3·R1** | `controlled_document` is an admitted `securable_resources.resource_type` with the full tenant triple | **Red-first vs. pre-M1**: refused by `securable_resources_type_check` |
| **DM3·R2** | …and by `securable_resources_tenant_shape` **independently** | Twin: restore only `type_check`, assert the insert still refuses — *two constraints, one behaviour* |
| **DM3·A1** | ⭐ a commission member reads a controlled-document-homed `documents` row | **Red-first vs. M1-only** (`else false` denies everyone) |
| **DM3·A2** | POSITIVE control: that member genuinely holds membership; a foreign-commission member reads **zero** rows | Without it, A1's denial half is vacuous |
| **DM3·A3** | ⭐ an approver who is **not** a commission member opens the version through `open_document_version` | Twin: drop the `is_document_approver_of` disjunct from the M2 arm → red. The arm the bucket-policy death would silently take |
| **DM3·A4** | ⭐ **NEGATIVE TWIN** — an ethics-case-homed letter is **not** readable by an ordinary commission member without case access | Twin: **widen** the `case` branch with a membership arm → red (the failure mode is widening, so the twin widens) |
| **DM3·C1** | the D15 ceiling still bites on the ethics letter: `legal_privileged` denied without `max_confidentiality`, served with it | Restores what `228` t36–40 lost; twin: neutralize `confidentiality_clearance_ok`'s rank check → red |
| **DM3·C2** | the S1 seam guard refuses an enforcing label on a `controlled_document` home (`HC0D6`) | Red-first vs. pre-M1 (the type cannot exist) |
| **DM3·C3** | with the **guard neutralized**, the kernel's `v_case IS NULL` backstop still denies the read | Independent neutralization of the second barrier |
| **DM3·T1** | `reclassify_document(cd, 'phi')` refuses | **Red-first vs. M2-without-M6** — it genuinely succeeds there |
| **DM3·T2** | `begin_document_upload` on a controlled-document home lands in `documents-standard` | Twin: force `p_resource_type` into the phi branch → red |
| **DM3·B1** | zero `storage.objects` policies reference `controlled-documents` (the `325` t1 shape) | **Red-first vs. pre-M5** (2 policies) |
| **DM3·B2** | `app.can_read_document_object` is absent from `pg_proc` | Red-first vs. pre-M5 |
| **DM3·B3** | POSITIVE CONTROL: the same derivation still sees the live `case-documents` policy | Mirrors `325` t4 — *a detector that finds nothing must be proven able to find something* |
| **DM3·B4** | ⭐ prior-version download: an authorized member opens version **N-1** of a superseded document and gets a payload | Twin: add a `current_version_id` check to the door → red |
| **DM3·B5** | `set_document_version_file` absent from `pg_proc`; `controlled_document_versions.storage_path` absent from `pg_attribute` | Red-first vs. pre-M4 |
| **DM3·P1** | ⭐ **R2** — once the domain version leaves `draft`/`changes_requested`, `core_document_version_id` cannot move: the **door** refuses (`HC089`) | Red-first vs. pre-M4; twin: remove the door's status check → red |
| **DM3·P2** | ⭐ **R2** — …and with the door's check neutralized, the **trigger** refuses (distinct errcode) | Independent barrier — *not one twin standing for both* |
| **DM3·P3** | ⭐⭐ **R2, the one that catches the vacuity** — the trigger still refuses **with `app.in_controlled_docs_rpc = 'on'`** | Twin: make the trigger honour the GUC (i.e. copy the sibling guard) → red. See the finding below |
| **DM3·E1** | ethics seams: both columns carry a real FK to `documents(id)` (asserted from `pg_constraint`), and `issue_ethics_notification` **accepts** a valid same-case document id | The `328` K8c inverse; red-first vs. pre-M7 (`HC0DM`) |
| **DM3·E2** | cross-case link refused **by the trigger** when the RPC's own check is neutralized | Independent barrier 1 |
| **DM3·E3** | cross-case link refused **by the RPC** (distinct errcode) when the trigger is neutralized | Independent barrier 2 |
| **DM3·E4** | a coordinator without clearance cannot link a `legal_privileged` letter | Twin: drop the `can_read_document` check → red |
| **DM3·E5** | `set_ethics_decision_details` accepts and PERSISTS `p_decision_letter_document_id` (round-trip via `get_ethics_case_procedure`) | Red-first vs. pre-M7: the parameter does not exist (`42883`) |
| **DM3·E6** | after that **DROP+CREATE**: PUBLIC has no EXECUTE, `authenticated` does — asserted from `pg_proc.proacl`, never from the migration text | Twin: omit the re-GRANT → red. *A rebuild restores the default ACL* |
| **DM3·S1** | every new/replaced door: `prosecdef = t`, `search_path` pinned, **PUBLIC revoked**, `authenticated` granted; and the §1.8 helpers M5 touches are PUBLIC-revoked | Twin: a `DROP+CREATE` without re-GRANT → red |
| **DM3·X1** | reconciliation count identity: `count(controlled_document_versions) == count(document_versions` homed on a controlled document`)`, and every pointer resolves | Twin: delete one backfilled core version → red |
| **DM3·X2** | the D11 audit split for a controlled-document download: non-creator → **exactly 1** `document.opened`; creator, standard tier → **0**; denial → **0** | Twin: widen the D11 condition to log same-user opens → the zero-arm goes red. Catches a missing row *and* a duplicate |

### ⚠ FINDING (R2) — the existing freeze guard is disarmed by the GUC every command sets

R2 assumed the pointer freeze needed a pin. The catalog says it needs a **mechanism**
first. `app.guard_controlled_document_status` (BEFORE DELETE OR UPDATE on
`controlled_document_versions`) already ends with:

```sql
-- Non-status update: forbidden once the version is FROZEN … outside an RPC.
if old.status not in ('draft', 'changes_requested') and not v_in_rpc then
  raise exception 'versões publicadas/obsoletas são imutáveis' using errcode = 'HC089';
end if;
```
where `v_in_rpc := coalesce(current_setting('app.in_controlled_docs_rpc', true),'off') = 'on'`.

**Every controlled-docs RPC sets that GUC.** So the existing guard protects only
against *direct table DML* — and after M4 the RPC corridor is the **only** writable
path. A pointer-freeze trigger written in the sibling's image, consulting `v_in_rpc`,
would be **vacuous by construction**: green forever, guarding nothing, in exactly the
place D10 exists to protect.

So R2 is implemented as **two independent barriers plus a non-bypassability pin**:

1. **The door** (`attach_controlled_document_version_file`) re-checks
   `status IN ('draft','changes_requested')` itself and raises `HC089` — mirroring
   what `set_document_version_file` does today. → **DM3·P1**
2. **The trigger** `app.guard_controlled_core_binding` guards the pointer column and
   **deliberately does NOT read `app.in_controlled_docs_rpc`** — a hard freeze the RPC
   corridor cannot bypass. → **DM3·P2**
3. **DM3·P3 makes that non-bypassability executable rather than a comment.** It sets
   the GUC to `'on'` — impersonating the corridor — and requires the refusal to hold.
   A future author "restoring consistency" with the sibling guard turns P3 red instead
   of silently disarming the freeze. *(A comment is an assertion that goes stale
   silently; this repo has shipped a live bug that way.)*

The freeze **is** expressible on the current substrate, so no stop-and-report is
triggered — but only because the trigger declines the GUC bypass. Recorded because
the natural implementation is the wrong one.

### ⚠ Finding: "remove keystone K8" names an object that no longer exists as one

ADR 0114 Amendment 2 (condition 4) and the plan's DM3 step 5 both say
**"remove keystone K8"**.
In `supabase/tests/328_dm1_document_substrate.sql`, K8 is **three sub-keystones**:

- **K8a** — `add_referral_shared_item` refuses its document arm (parked until **DM4**)
- **K8b** — `add_rca_evidence` refuses a document citation (parked until **Wave D**)
- **K8c** — `issue_ethics_notification` refuses a related document (parked until the Q1 ruling)

**Only K8c is DM3's.** Removing "K8" as written would delete two parked-seam pins that
DM4 and Wave D still depend on — a name-keyed instruction orphaned by decomposition.
**DM3 removes K8c only**, and in the same edit: decrements `328`'s `plan(N)`, and
removes line 44's precondition
`'precondition: ethics flag is ON (K8c exercises an ethics writer)'` — while leaving
lines 40/42 (the referral and RCA preconditions) intact.

**Replacement coverage for `328`'s K8c** is **DM3·E1** (the accept case),
**DM3·E2/E3** (the refusals that replace the blanket one) and **DM3·E4**. The seam is
not left unpinned; the pin changes from *"this is refused"* to *"this is allowed,
exactly this far"*.

`193_schema_integrity.sql:71-72` also references the K8b/HC0DM parking for
`rca_evidence` — untouched by DM3, verified as a different seam.

---

## 7. The typed contract (contract-first — signatures only)

Posted now so `frontend` builds against real types. **These stay stable once
approved**; a needed change goes through the lead.

### `src/lib/documents/types.ts` (core — delta)

```ts
// +'controlled_document'. NOTE: DOCUMENT_KINDS is Record<DocumentHomeResourceType, …>,
// so adding the member is a COMPILE ERROR until the vocabulary entry exists.
export type DocumentHomeResourceType =
  | 'case' | 'meeting' | 'interview' | 'action_item' | 'controlled_document'

export const DOCUMENT_KINDS: Record<DocumentHomeResourceType, readonly string[]> = {
  /* …unchanged… */
  controlled_document: ['documento_controlado'],
}

// UNCHANGED — enforcing labels stay case/interview-only (the HC0D6 seam guard).
export const ENFORCING_LABEL_HOMES: readonly DocumentHomeResourceType[] = ['case', 'interview']
```

### `src/lib/controlled-documents/types.ts` (domain — delta)

```ts
export interface ControlledDocumentVersion {
  id: string
  documentId: string
  versionNumber: number
- storagePath: string | null                 // REMOVED with the column (M4)
+ coreDocumentVersionId: string | null       // null ⇒ no file yet
+ availability: DocumentAvailability         // from '@/lib/documents/types'
  summaryOfChangesMd: string | null
  effectiveDate: string | null
  reviewDueDate: string | null
  /* …unchanged… */
}

export interface ControlledDocument {
  /* …unchanged… */
+ coreDocumentId: string | null
}
```

### `src/lib/controlled-documents/actions.ts` (new / replaced)

```ts
/** Reserve a core document_version + file object for a controlled-document version.
 *  Wraps begin_document_upload(p_resource_type: 'controlled_document'). */
export async function beginControlledVersionUpload(input: {
  commissionId: string
  documentId: string      // controlled_documents.id (== securable_resources.id)
  versionId: string       // controlled_document_versions.id
  fileName: string
  mimeType: string
  sizeBytes: number
}): Promise<
  | { ok: true; credential: DocumentUploadCredential; coreDocumentVersionId: string }
  | { ok: false; error: string; code: DocumentActionErrorCode }
>

/** Verify the upload server-side, then point the domain version at the core version.
 *  Wraps finalize_document_upload + attach_controlled_document_version_file. */
export async function finalizeControlledVersionUpload(input: {
  versionId: string
  uploadSessionId: string
  summaryOfChangesMd?: string | null
  expiryDate?: string | null
}): Promise<AddVersionState>

/** Authorize + sign a short-TTL download for ANY version, current or prior.
 *  Wraps open_document_version. Replaces createSignedDownloadUrl. */
export async function openControlledDocumentVersion(
  versionId: string,      // controlled_document_versions.id
): Promise<OpenDocumentVersionResult>

// REMOVED: addDocumentVersion(_prev, formData)          — the raw-upload action
```

### `src/lib/queries/controlled-documents.ts`

```ts
// REMOVED — the raw-path signer (the last controlled-document byte path
// outside src/lib/documents/):
- export async function createSignedDownloadUrl(storagePath: string): Promise<string | null>
```

### `src/lib/ethics/actions.ts` (condition 5 — plumbing only, no UI)

```ts
// :127 — ALREADY in the frozen input contract; :389 carries a NOTE saying it is
// deliberately dropped. DM3 deletes that NOTE and forwards the value.
export interface SetDecisionDetailsInput {
  /* … */
  decisionLetterDocumentId?: string | null   // ← now actually forwarded
}
// → supabase.rpc('set_ethics_decision_details', {
//      …, p_decision_letter_document_id: input.decisionLetterDocumentId ?? null })
```
`src/lib/queries/ethics.ts:289` already projects `decisionLetterDocumentId: string | null`
— the read side needs no change, which is precisely why the write gap was invisible.

**Unchanged and explicitly load-bearing:** `listDocuments`, `getDocument`,
`listApproverCandidates`, `listPendingApprovalsForUser`,
`getHospitalDocumentRegister`, `listDocumentsDueForReview` keep their signatures —
only the `storagePath` → `coreDocumentVersionId` + `availability` field swap reaches
their return types. 32 files / 50 import specifiers were realigned by DM2's rename;
DM3 must not move any of them again.

---

### ⚠ PROCESS NOTE — a contract review must TRACE ONE FULL CALL CHAIN

**Raised by the lead 2026-08-13, from a live failure in this very section.**
§7 was reviewed, approved, and declared *stable* to the frontend — and it was
**unbuildable**, not merely incomplete: `beginControlledVersionUpload` did not
return `uploadSessionId`, and `finalizeControlledVersionUpload` is keyed on the
upload *session*, so **finalize could never be called**. Neither the plan review
nor the approval caught it. It surfaced only when the implementer tried to *use*
the contract rather than just satisfy it.

Contract-first buys parallelism by letting one side build against signatures the
other has not implemented yet. That trade only pays if the signatures actually
compose — and reading them one at a time cannot show that, because each one
looks complete in isolation. The missing field was invisible in every view
except the sequence.

**Binding on every future phase's contract review:** before a posted contract is
declared stable, **trace at least one complete call chain end to end** —
caller → each signature in order → the value each step needs from the one
before — and confirm every input is actually produced by something upstream. A
signature list is not a contract until one full path through it has been walked.

(Two other §7 corrections came out of the same implementation pass and are
recorded in §8: the `terminal` flag, and dropping `coreDocumentId`.)

## 7b. Hand-off notes for the frontend / tester slices (verified, not adopted on trust)

**E2E specs that pin behaviour DM3 changes.** Specs are `tester`'s — engineers never
edit them. What each needs is stated so the tester is not left to infer it:

| Spec / AC | What it pins today | After the cutover |
| --- | --- | --- |
| `phase17-documents.spec.ts` **AC-7** | Rule 6 — each version upload lands at a NEW `storage_path` | **The property survives, the locator does not.** `begin_document_upload` mints `{organization_id}/{file_object_id}/{generation_uuid}` per upload, and `file_objects_bucket_path_uniq UNIQUE (storage_bucket, storage_path)` makes collision *impossible* rather than merely unobserved. The assertion must move off the dropped `controlled_document_versions.storage_path` column onto the core model — a **strengthening**, and it should be re-observed red against a deliberately reused path |
| `phase17-documents.spec.ts` **AC-11** | audit metadata excludes `storage_path` (+ title/summary/note/description/category/tags) | **Strengthens by construction.** Verified bodies: `begin_document_upload` and `open_document_version` build their audit payload as `jsonb_build_object('version_number', …)` — no coordinate is reachable to leak. AC-11 stays green and its `storage_path` clause becomes vacuous on this path; the tester should keep the clause (it still guards the other verbs) but not read its green as coverage of the new door |
| `phase17-documents.spec.ts` AC-1/2/3/5/12/13 | lifecycle CRUD | Unaffected by the substrate swap; re-run to confirm |
| `documents-redesign.spec.ts` RW-1..RW-10 | the redesigned detail screen | Download affordances change from `<a href=signed>` to the door-backed action |
| `documents-changes-requested.spec.ts` CR-0/CR-1 | the `changes_requested` re-upload loop | This is the flow that exercises the **draft re-upload** path §4 turns into a pointer move — the highest-value regression target |
| `charters-cadence.spec.ts` AC-2/AC-4 | charter ↔ document linkage | See the gate note below |

**The charter gate — confirmed, and worth a decision.**
`src/app/o/[org]/c/[commission]/manage/charter/page.tsx` gates on
**`chartersEnabled()`** (`:60`) and then calls
`listDocuments(commissionId, { docType: 'bylaws' })` from the controlled-documents
module (`:73`). So with `charters` ON and `controlled_docs` OFF the page still queries
controlled documents. After DM3 a third flag (`documents_wave_b`) governs the byte
path, so this screen could render a document list whose downloads all refuse.
**RULED (lead, Q6, 2026-08-13):** the charter screen's document list gates on
`chartersEnabled() && controlledDocsEnabled()`, and the download affordance
additionally on `documents_wave_b`. Not a security defect (the RLS/kernel arms hold
either way) — a broken-affordance risk. **Frontend's slice — backend does not
implement this.**

**Two dead components — verified dead, by a stated method.**
`src/components/controlled-documents/obsolete-document-button.tsx` and
`supersede-document-button.tsx` **exist on disk** and have **zero import specifiers
anywhere in `src/` or `e2e/`** (repo-wide grep on the filename; the only hits are
`graphify-out/*`, which is the stale generated graph, plus two planning docs and ADR
0074). ⚠ The method is a filename grep, which is a *syntax* boundary — adequate here
because a component's filename always appears in its import specifier and there is no
barrel file in that directory, but stated rather than assumed. **Do not migrate dead
code**: they are deletion candidates for the frontend slice, not rewrite targets.

---

## 8. Where the catalog contradicts the plan doc / ADRs

1. **`reclassify_document_file` does not exist** (§4). The open item names a function
   that is absent from `pg_proc`; the capability is `reclassify_document` +
   `complete_document_reclassification`, and ADR 0118 §10 already records the
   append-only resolution. **S2.8 is closed, not open.**
2. **"remove keystone K8"** names one object; the catalog of tests holds **K8a/K8b/K8c**
   with three different owning waves (§6). Only K8c is DM3's.
3. **Plan step 4 names only the bucket SELECT policy.** The catalog shows a second
   live door, `controlled_documents_obj_insert_writable` (§1.5, M5). Dropping SELECT
   alone leaves an unguarded write path into the bucket.
   📌 **SCOPE WIDENING, RECORDED (lead-ruled Q4, 2026-08-13).** DM3 drops **both**
   policies, which **exceeds the DM3 step-4 text**. Rationale, so a later reader does
   not read this as drift: the INSERT policy authorizes on
   `app.is_staff_admin_of(foldername[1])` alone and bypasses `begin_document_upload`
   entirely — no reserved-path check, no server-derived tier, no `file_objects` row,
   no `upload_sessions` row. Leaving it would leave a hole straight through the
   command layer DM2 built, in the same phase that deletes its only legitimate
   caller. The plan text was incomplete, not exceeded. Pinned by **DM3·B1**, which
   asserts *zero* `controlled-documents` policies rather than the absence of one.
4. **"PHI-tier input on a controlled document fails closed" has no target at
   `begin_document_upload`** — the tier is server-derived there and can never be PHI
   for this home. The real surface is `reclassify_document` (§3 M6). Implementing the
   sentence literally at the upload door would produce a guard over an impossible
   input while leaving the reachable one open.
5. **Local ≠ production for the backfill** (§2): local has 0 objects and 0
   `storage_path` values, so local drift is zero *vacuously*. Production's 3 orphans
   are unrepresentable in the model and are quarantined, not migrated.
6. **The ADR's "same shape as a controlled document" (D17) does not survive contact
   with the catalog** if read as "give it a controlled-document home": three
   independent catalog facts (§5.4) make that choice an ethics-content leak. Raised
   as Q1.
7. **Condition 2 is a body change, NOT a signature change — and condition 5 is the
   opposite.** Confirmed independently: `issue_ethics_notification` still carries
   `p_related_document_id` as arg 7 of 8 (`pronargs = 8`); DM1 put the refusal in the
   body. `CREATE OR REPLACE`, ACL preserved. Whereas `set_ethics_decision_details`
   must gain a 12th parameter, which `CREATE OR REPLACE` **cannot** do — it would mint
   an ambiguous overload — so it is DROP+CREATE **with an explicit re-GRANT**. Getting
   these the wrong way round silently discards an ACL on one and breaks the live
   ethics screen on the other (§3 M7).
8. **The "exactly one audit row per download" framing over-claims.** The D11 floor
   does not log a creator's own standard-tier open, and controlled documents are
   always standard tier. The correct contract is the three-way split in §5.1b, pinned
   by K16.
9. **`docs/backend-state.md` / graphify are stale on the module split** — graphify
   still reports `src/lib/queries/documents.ts` holding
   `listApproverCandidates` / `getHospitalDocumentRegister` /
   `listPendingApprovalsForUser`; on disk those are in
   `src/lib/queries/controlled-documents.ts` after the DM2 rename. The graph is stale
   by design between refreshes; recorded so no one plans against it.

---

## 9. Rulings (all six closed by the lead, 2026-08-13)

- **Q1 — RULED: the `case` securable resource.** An ethics decision letter's core
  `documents` row homes on the case, never on a `controlled_document` resource.
  Ruled by the lead as following *necessarily* from ADR 0114 Amendment 2's already
  ratified "the ethics access shape is NOT the controlled-document access shape";
  the three-fact argument is now recorded in the ADR itself. PO informed, open to
  overrule. Binds M7 and **DM3·A4**.
- **Q2 — RULED: backfill 1:1.** Fileless core `document_versions`, matching the plan
  text, so **DM3·X1**'s count identity stays a real assertion with no documented
  exception.
- **Q3 — RULED: the domain-side pointer is outside D10**, which governs the **core
  file binding** (`document_version_files`) — that stays append-only and untouched.
  Ruled explicitly rather than passing silently, because an unwritten reinterpretation
  of an ADR invariant is indistinguishable later from a widening nobody noticed.
  **Conditional on R2** — discharged by **DM3·P1/P2/P3** (§6), and note the finding
  there: the natural implementation of that freeze is vacuous.
- **Q4 — RULED: drop both policies** (see the scope-widening record, §8 item 3).
- **Q5 — RULED: nobody, during DM3.** Production is not re-measured and nothing is
  pushed. See §2 and §10 for the provisional marking and the DM5 precondition.
- **Q6 — RULED: yes** — `chartersEnabled() && controlledDocsEnabled()`, download
  affordance additionally on `documents_wave_b`. **Frontend's slice**; recorded in
  §7b, not implemented by backend.

---

## 10. Risks and what I could NOT verify

**Could not verify (stated, not assumed):**
- **Production catalog and object counts.** Every production figure here is from the
  2026-08-11 audit record. No production access; no `db push`; not re-measured.
- **That production's policy/routine set matches local.** Must be re-derived at build
  time before M5 drops policies by name.
- **Feature-flag state in production — a NAMED GATE ITEM, not a note.** Locally
  `documents_foundation = true`, `documents_wave_a = true`, `documents_wave_b = false`,
  `controlled_docs = true`, `charters = true`, `ethics = true`, `attachments = false`.
  The DM2 record has all five DM flags **OFF** in production. **These disagree.**
  Lead-ruled Q5: the disagreement is carried forward and must be
  **reconciled at deploy time, never assumed** — the deploy step reads the production
  flag table and compares, rather than flipping `documents_wave_b` on the assumption
  that the others are already where local has them.
- **The E2E surface.** I did not run Playwright; the lifecycle E2E in the DM3 exit
  criterion is `tester`'s.

**Risks:**
1. **The name collision (§1.2) is the highest-probability defect source.** Mitigation:
   every migration and keystone names the table each function reads, inline.
2. **The approver arm is the highest-impact silent loss** — three policies carry it
   today and DM3 deletes one. K3 is the guard; if K3 is ever green on first run,
   stop.
3. **Q1 unresolved ⇒ M7 cannot be written safely.** It is the only true blocker.
4. **`open_document_version` is in no authz arm's domain** (ADR 0118 §12). DM3's
   byte-path coverage is pgTAP-only. This is a standing platform gap, not a DM3
   regression, but DM3 inherits it and should not report arm-green as byte coverage.
5. **New doors must enter the census domain *and* the committed findings file in the
   same phase**, or `ARM=census` / `ARM=wrapper` pass vacuously by absence
   (ADR 0079 Am. 3 / Am. 7).
6. **The diff-scoped write-path `ARM=policy` step is a no-op outside its hardcoded
   worklist** — its reported case count must be checked non-zero for DM3's new doors
   before it is cited as coverage.
7. **Shared local stack.** DM3's window (`20260925000100`+) sits above the highest
   registered version, but a `supabase db reset` from this worktree drops another
   session's uncommitted migrations. Announce before resetting.
