# DM4 (Wave C — Referrals) pre-phase surface verification

**Status:** read-only audit, no code/schema changes. Branch `main` @ `87cd1ddb`.
**Method (binding, CLAUDE.md):** the live local-stack catalog is the sole truth for
schema/RLS/RPC questions — queried via `docker exec supabase_db_azkbbhskturikxpgmafq
psql -U postgres -d postgres` (DB port 54322 per `supabase/config.toml`; verified
`psql` is not on PATH, so all catalog queries below ran inside the DB container).
Migration file text was read only where the catalog itself pointed at it (e.g. to find
the ADR that explains a catalog fact), never trusted as the fact itself. Code claims
were verified by reading the actual files/grep output, not assumed from prose. Every
claim below is tagged **[catalog]** or **[code]** with how it was checked.

Plan source: `docs/plans/document-model-redesign.md` § "Phase DM4 — Wave C: referrals"
(lines 221–253, quoted at the top of that section: *"re-verify the referral
query/action surface … against the CODE and the referral RPCs against the CATALOG; do
not trust names recorded before those merges"*). This document is that re-verification.

---

## 1. DIFF TABLE — plan-named vs. reality

| Plan names | Reality | Verdict |
|---|---|---|
| `getReferralDocumentUrl` | `src/lib/queries/referrals.ts:1090`, same name, cookie client (`createClient()` from `@/lib/supabase/server`), signs the `case-documents` bucket via RPC `get_referral_snapshot_document_path` | **CONFIRMED** |
| `getReferralReplyAttachmentUrl` | No function of this name exists anywhere in `src/` (swept by identifier). The live equivalent is **`getReferralAttachmentUrl`** (`referrals.ts:1112`), same cookie-client / RPC-then-sign shape, bucket `referral-attachments`, RPC `get_referral_attachment_path` | **RENAMED** (→ `getReferralAttachmentUrl`) |
| "the `case-documents` signer dies (F-14)" | Bucket `case-documents` + policy `case_documents_select_member` (storage) + predicate `app.can_read_snapshot_document` (app) are all still live, and are pinned as DM1's deliberate K2a/K2b spares for DM4 to retire | **CONFIRMED** (correctly still alive, correctly still DM4's to kill) |
| "The 1 dangling frozen production row is reconciled" | Reproduced locally by the seed on purpose: `referral_shared_item` row `46144a56-…` (kind=`document`, `frozen_storage_path` populated, `source_document_id` NULL) — seed comment at `supabase/seed.sql:1801-1805` says explicitly this is "exactly the production drift shape DM4 reconciles" | **CONFIRMED** (shape verified, is a fixture not the real prod row) |
| `add_referral_reply_attachment` | `public.add_referral_reply_attachment` exists, `prosecdef=t`, called from `src/lib/referrals/actions.ts:426` (`addReferralReplyAttachment`) | **CONFIRMED** — but note: the TS action wrapping it has **zero UI callers** (see §5) |
| `get_referral_attachment_path` | `public.get_referral_attachment_path` exists, `prosecdef=t`, called from `getReferralAttachmentUrl`, which is called from both referral detail pages | **CONFIRMED**, live UI path |
| "the `referral_reply_attachment` policy" | Exactly **one** policy on that table: `referral_reply_attachment_select_readable` (SELECT-only; writes are RPC-only, no `authenticated` DML grant on the table) | **CONFIRMED** |
| "both `referral_attachments_obj_*` storage policies" | Exactly two: `referral_attachments_obj_insert`, `referral_attachments_obj_select` | **CONFIRMED** |
| `case_documents_select_member` | storage.objects SELECT policy, live | **CONFIRMED** |
| `app.can_read_snapshot_document` | live, `prosecdef=t` | **CONFIRMED** |
| DM1 K2 allowlist (7 pins in `328_dm1_document_substrate.sql`) | Verbatim-quoted in §6; all 7 pins are the same 7 names above | **CONFIRMED**, no drift since DM1 |
| *(not named)* | **`public.get_referral_snapshot_document_path`** — the actual RPC behind `getReferralDocumentUrl`; reads/audits `referral_shared_item.frozen_storage_path` | **UNNAMED-BY-PLAN** |
| *(not named)* | **`public.add_referral_shared_item`**'s `document` arm — currently PARKED (raises `HC0DM`); this is the actual write seam plan step 1 must un-park | **UNNAMED-BY-PLAN** |
| *(not named)* | **`referral_shared_item.source_document_id`** — column exists but carries **no FK at all** (DM1 explicitly dropped it, ADR 0116 decision 1) | **UNNAMED-BY-PLAN** |
| *(not named)* | **`referral_shared_item_select_phi`** — the whole-table RLS SELECT policy gating `referral_shared_item` on `can_read_referral_phi` | **UNNAMED-BY-PLAN** |
| *(not named)* | **`referral_reply_attachment_select_readable`** gates on `can_read_referral_metadata` (broad), while its Storage door (`referral_attachments_obj_select`) gates on `can_read_referral_phi` (narrow) — an intentional two-layer asymmetry the plan's step-3 "negative twin" must preserve, not flatten | **UNNAMED-BY-PLAN** (nuance) |
| *(not named)* | **`addReferralReplyAttachment`** (`src/lib/referrals/actions.ts:426`) — wraps a live RPC but has **zero UI call sites** anywhere in `src/` | **UNNAMED-BY-PLAN** (dead surface) |
| *(plan preamble, not the numbered list)* | `referral_note_types` and any `%referral_note_type%` routine | **GONE** (REG·KIND / ADR 0110 — confirmed absent from the catalog; `referral_internal_notes.kind` is now a plain `text` column) — the plan's own preamble already warns of this, so not a miss, just re-confirmed |

**Count: 6 UNNAMED-BY-PLAN surfaces** (excluding the already-self-flagged `referral_note_types`).

---

## 2. Section A — catalog enumeration

### A1. Routines referencing referral/attachment/snapshot/frozen/case-documents/storage_path

**[catalog]** Query joined `pg_proc`×`pg_namespace` for `public`/`app`, matched name OR
`pg_get_functiondef()` body against each identifier, bucketed by a single first-match
`CASE` (per the methodology warning about overlapping buckets double-counting).

```
bucket        | count
attachment    |     1
frozen        |    10
referral      |    94
snapshot      |    13
storage_path  |    11
-------------------------
total (sum)   |   129   -- matches the unfiltered COUNT(*) exactly (129)
```

The full 129-row listing (schema, name, `prosecdef`, args, return type, owner, ACL,
bucket) is preserved in the session scratch output; the referral-relevant subset is
quoted inline below. Selected rows (name | prosecdef | args | ACL):

- `app.can_read_referral_phi(p_referral_id uuid, p_uid uuid) → boolean` — `prosecdef=t`, ACL `{postgres=X,authenticated=X,service_role=X}` — **the PHI gate plan step 3 says must remain the gate.** Confirmed unchanged, still the sole PHI predicate for referrals.
- `app.can_read_snapshot_document(p_object_name text, p_uid uuid) → boolean` — `prosecdef=t`. Body **(quoted in full, [catalog])**:
  ```sql
  CREATE OR REPLACE FUNCTION app.can_read_snapshot_document(p_object_name text, p_uid uuid)
   RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
   SET search_path TO 'app', 'public', 'pg_catalog'
  AS $function$
    select app.feature_enabled('case_referrals') and exists (
      select 1 from public.referral_shared_item rsi
      join public.case_referral r on r.id = rsi.referral_id
      where rsi.kind = 'document'
        and rsi.frozen_storage_path = p_object_name
        and app.can_read_referral_phi(r.id, p_uid)
    );
  $function$
  ```
- `public.get_referral_snapshot_document_path(p_shared_item_id uuid) → text` — `SECURITY DEFINER`, re-gates `can_read_referral_phi`, emits a `referral.viewed` audit row, returns `frozen_storage_path`. **Not named in the DM4 plan text.**
- `public.get_referral_attachment_path(p_attachment_id uuid) → text` — same shape, returns `referral_reply_attachment.storage_path`.
- `public.add_referral_reply_attachment(p_referral_id, p_title, p_storage_path, p_mime_type, p_size_bytes) → referral_reply_attachment` — `SECURITY DEFINER`, gates `assert_referral_target_acts(referral_id, ['accepted','in_review'])`; **no reachable UI caller** (§5).
- `public.add_referral_shared_item(p_referral_id, p_kind, p_source_narrative_id, p_source_document_id) → referral_shared_item` — `SECURITY DEFINER`. Body **(quoted in full, [catalog], the load-bearing part)**:
  ```sql
  else
    -- DM1 (ADR 0114 D5 / ADR 0116): the document arm is PARKED — its source
    -- substrate was dropped; DM4 re-points it at the document model. Fail
    -- closed until then (authority was already checked above — §7.1 order).
    raise exception
      'o compartilhamento de documentos do caso está temporariamente indisponível (migração do modelo de documentos)'
      using errcode = 'HC0DM';
  end if;
  ```
  This is **the** write seam DM4's step 1 ("Snapshot/reply files become version/file/rendition records") must re-point. Not named by identifier anywhere in the plan.
- `public.dispose_referral_phi`, `public.can_dispose_referral_phi`, `public.get_referral_patient`, `public.save_referral_patient` — all present, unaffected by this audit's scope (patient PHI, not document PHI).
- `app.set_referral_patient` — **[catalog+code]** ACL has no `authenticated` grant (only `postgres`/`service_role`), and correspondingly zero direct `.rpc()` call sites in `src/`. This is by design (ADR 0078 D7/F1 — `set_referral_patient` was deliberately taken off the public API, `save_referral_patient` is its only door), confirmed by `supabase/tests/246_authz_f1_referral_split.sql` K-F1b. **Not a gap** — included here only to show the zero-caller check was actually run and correctly distinguishes "intentionally internal" from "orphaned."
- `referral_note_types` and `%referral_note_type%`: **zero rows in `pg_proc`, zero in `information_schema.tables`** — fully gone, matches the plan's own REG·KIND warning.

### A2. Policies (all schemas) touching these identifiers

**[catalog]** 20 policies matched (count query = 20, listing = 20 rows — sums agree).
The referral-owned and document-adjacent ones:

```
public | case_referral            | case_referral_select_readable              | SELECT | can_read_referral_metadata(id, uid)
public | referral_shared_item     | referral_shared_item_select_phi            | SELECT | can_read_referral_phi(referral_id, uid)
public | referral_reply           | referral_reply_select_phi                  | SELECT | can_read_referral_phi(referral_id, uid)
public | referral_messages        | referral_messages_select_phi               | SELECT | can_read_referral_phi(referral_id, uid)
public | referral_reply_attachment| referral_reply_attachment_select_readable  | SELECT | can_read_referral_metadata(referral_id, uid)   -- ← metadata, not PHI
storage| objects                  | case_documents_select_member               | SELECT | bucket='case-documents' AND can_read_snapshot_document(name, uid)
storage| objects                  | referral_attachments_obj_insert            | INSERT | bucket='referral-attachments' AND can_manage_referral_target(folder[2], uid)
storage| objects                  | referral_attachments_obj_select            | SELECT | bucket='referral-attachments' AND can_read_referral_phi(folder[2], uid)   -- ← PHI, not metadata
```

`referral_shared_item_select_phi` gates the **whole table** on PHI, not on metadata —
so today only the `narrative` kind is actually exercised by real traffic (the
`document` kind is parked); DM4 needs to confirm this PHI-only gate is still correct
once the document arm goes live (it should be — frozen document snapshots are the
same PHI class as frozen narratives), but the plan text never names this policy.

Note the asymmetry flagged in the diff table: `referral_reply_attachment`'s table row
is gated by `can_read_referral_metadata` (whoever can see the referral's metadata sees
that an attachment exists) while its Storage bytes are gated by the narrower
`can_read_referral_phi`. This two-tier shape (see-the-row vs. read-the-bytes) is a
design decision the plan's step-3 negative twin must reproduce, not an oversight to
flatten.

### A3. FKs into `attachments` / `referral_shared_item`

**[catalog]** `select ... where confrelid = 'public.attachments'::regclass` returned:
```
ERROR:  relation "public.attachments" does not exist
```
**The `public.attachments` table itself does not exist in the live catalog at all** —
confirmed by a second, unconditional check (`information_schema.tables where
table_name = 'attachments'` → 0 rows, any schema). DM1 dropped the table outright
(per ADR 0116); only the ORPHANED storage buckets `attachments`/`attachments-phi`
survive (policy-less, DM5's to delete). This makes the plan's phrasing "inbound FKs to
attachments" moot for DM4 — there is no table left to reference.

Inbound FKs to `referral_shared_item`: **zero** (nothing references it).

Outbound FKs on `referral_shared_item`:
```
referral_shared_item_referral_id_fkey          FOREIGN KEY (referral_id) REFERENCES case_referral(id) ON DELETE CASCADE
referral_shared_item_source_narrative_id_fkey  FOREIGN KEY (source_narrative_id) REFERENCES case_narratives(id) ON DELETE SET NULL
```
**No FK on `source_document_id`.** Column is `uuid`, nullable. Confirmed by ADR 0116
decision 1 (`docs/decisions/0116-dm1-substrate-cutover-decisions.md:11-22`, read
[code] only to find the *reason* a catalog fact exists, not as the fact itself): DM1
explicitly dropped the FK (never CASCADE) and kept the column as a fail-closed
"parked seam." This is one of **four** tables DM1 parked this way — the other three
(`rca_evidence.cited_document_id`, `ethics_decision_details.decision_letter_document_id`,
`ethics_notifications.related_document_id`) are Wave D / ethics scope, not DM4's.

Row counts (`referral_shared_item`): **5 total**, **0** with `source_document_id`
populated, **1** with `frozen_storage_path` populated (the seeded dangling row, kind
`document`). `referral_reply_attachment`: **0 rows**. `file_objects` (the new
substrate): **0 rows** locally. `storage.objects`: **0 rows in any bucket** (local dev
has no physically-uploaded files at all — this is a fresh-reset local stack, not a
statement about production).

### A4. Triggers

**[catalog]** 12 triggers on referral tables (`attachments` has none — table doesn't
exist). The one document-relevant trigger:

```sql
CREATE TRIGGER trg_guard_referral_snapshot_lock
  BEFORE INSERT OR DELETE OR UPDATE ON public.referral_shared_item
  FOR EACH ROW EXECUTE FUNCTION app.guard_referral_snapshot_lock()
```
Body (quoted, [catalog]): locks `referral_shared_item` rows once `case_referral.status
<> 'draft'` (raises `HC073`), bypassed only via the `app.in_referral_rpc` GUC the RPCs
set internally. This guards the **shared_item row itself**, not the source document —
"frozen even if the source later changes" (plan step 1) is achieved today only by
value-copy for the `narrative` kind (`frozen_body_md` is a literal copy at freeze
time); for the `document` kind there is currently **no live copy mechanism at all**
since that arm is parked. DM4 must build the copy-on-freeze behavior, not just wire an
FK.

### A5. Storage buckets + `storage.objects` policies

**[catalog]** 12 buckets exist, all private. Referral-relevant: `case-documents`,
`referral-attachments`. Document-model buckets already live from DM1-3:
`documents-standard`, `documents-phi`, `controlled-documents`, `printed-documents`.
Orphaned (table gone, DM5's to retire): `attachments`, `attachments-phi`.

`case-documents` bucket has **exactly one** policy total: `case_documents_select_member`
(SELECT only). There is **no INSERT/UPDATE/DELETE policy on this bucket at all** —
nothing can currently write a *new* object into `case-documents` via RLS. It is
effectively read-only/vestigial today, serving only pre-existing frozen-snapshot rows
minted before the `document` arm was parked. `referral-attachments` has its full pair
(`referral_attachments_obj_insert` / `_select`), both PHI-gated.

### A6. Row counts / `storage_path`-family columns

**[catalog]** Columns matching `%storage_path%` across the whole schema:
`capa_action_evidence.storage_path`, `file_objects.storage_path` (NOT NULL),
`printed_documents.storage_path` (NOT NULL), `rca_evidence.storage_path`,
`referral_reply_attachment.storage_path` (NOT NULL),
`referral_shared_item.frozen_storage_path` (nullable). The last two are DM4's.

---

## 3. Section B — code enumeration

### B7. `getReferralDocumentUrl` / `getReferralReplyAttachmentUrl` identity

**[code]** Both signed-URL functions live in `src/lib/queries/referrals.ts` under the
header comment "Signed-URL doors (DEFINER-authorized + audited, signed with the
cookie client)":

```ts
export async function getReferralDocumentUrl(sharedItemId: string): Promise<string | null> {
  const supabase = await createClient()               // cookie client, NOT admin
  const { data: path } = await supabase.rpc('get_referral_snapshot_document_path', { p_shared_item_id: sharedItemId })
  if (!path) return null
  const { data: signed } = await supabase.storage.from('case-documents').createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
  return signed?.signedUrl ?? null
}

export async function getReferralAttachmentUrl(attachmentId: string): Promise<string | null> {
  const supabase = await createClient()               // cookie client, NOT admin
  const { data: path } = await supabase.rpc('get_referral_attachment_path', { p_attachment_id: attachmentId })
  if (!path) return null
  const { data: signed } = await supabase.storage.from('referral-attachments').createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
  return signed?.signedUrl ?? null
}
```

Both use `createClient()` from `@/lib/supabase/server` — the ordinary SSR **cookie**
client, never the admin/service-role client. Both are called from both referral
detail pages (`src/app/o/[org]/c/[commission]/encaminhamentos/[referralId]/page.tsx`
and `src/app/o/[org]/direcao-tecnica/[referralId]/page.tsx`).
`getReferralReplyAttachmentUrl` **does not exist under that name anywhere in `src/`** —
confirmed by `grep -rn "getReferralReplyAttachmentUrl" src/` → zero hits.

**Identifier sweep across `src/`** for other referral-reachable signers (not
directory-scoped — swept by identifier, per the methodology warning that a
directory-scoped sweep draws the boundary on syntax not on the property asserted):
- `createSignedUrl`: 9 call sites total in `src/` (`documents/actions.ts`,
  `minutes-jobs/actions.ts`, `queries/capa.ts`, `queries/forms.ts`, `queries/rca.ts`,
  and the two in `queries/referrals.ts` above). Only the two in `referrals.ts` are
  referral-reachable; the rest belong to capa/rca/forms/minutes and are out of DM4
  scope.
- `storage_bucket` (the new document-model column name): appears only in
  `src/lib/documents/actions.ts` and generated types — **zero** referral files touch
  it, confirming the referral module has not yet been repointed at the new substrate.
- Bucket string literals `'case-documents'` / `'referral-attachments'`: appear **only**
  in `src/lib/queries/referrals.ts` (the two functions above) — no other file signs
  either bucket.
- `.storage.from(` direct calls (bypassing a query helper): only two, both
  `remove()` calls unrelated to referrals (`minutes-jobs/reconcile.ts`,
  `pdf-mint/actions.ts`).

**Conclusion: no other referral-reachable signer exists beyond the two documented
above.** The sweep found nothing the plan's step-2 language missed on the *code* side;
the misses are all on the *RPC-name* side (§1's UNNAMED-BY-PLAN rows).

### B8. `.rpc()` call-site sweep

**[code]** For the referral-document-relevant RPC set:

| RPC | Call site(s) | Note |
|---|---|---|
| `get_referral_attachment_path` | `referrals.ts:1116` | live |
| `get_referral_snapshot_document_path` | `referrals.ts:1094` | live |
| `add_referral_reply_attachment` | `referrals/actions.ts:440` (wrapped as `addReferralReplyAttachment`) | **RPC exists, TS action exists, but zero UI components call the TS action** — see §5 |
| `add_referral_shared_item` | `referrals/actions.ts:220` | live (narrative arm only; document arm always throws) |
| `remove_referral_shared_item` | `referrals/actions.ts:241` | live |
| `dispose_referral_phi` | `referrals/actions.ts:968` | live |
| `can_dispose_referral_phi` | `referrals.ts:1466` | live |
| `set_referral_patient` | none (by design, ADR 0078 D7/F1 — verified against `pg_proc.proacl`: no `authenticated` grant) | not a gap |

No call site named a routine absent from `pg_proc` (all `.rpc('...')` targets in the
referral surface resolve to a real, live function).

### B9. The five components from `87cd1ddb`

**[code]** Verified the commit's own file list first (`git diff-tree --no-commit-id
--name-only -r 87cd1ddb`): 13 files, all under `src/app/.../[referralId]/page.tsx` and
`src/components/referrals/*`. **Zero `.sql` files, zero `src/lib/**` files** —
confirms the commit message's claim directly rather than accepting it.

Grepped all five new/rewritten files for `attach|upload|storage|signed|document|file`:

- `referral-deadline-button.tsx`, `referral-link-case-button.tsx`, `deadline-gate.ts`:
  **zero matches** — no document/attachment code at all.
- `referral-registro-dialog.tsx`: only prose-comment mentions of the `body_md` column
  name (plain-text registro entry, no file I/O).
- `referral-reply-dialog.tsx`: **has an attachment placeholder, not live upload code.**
  Quoted verbatim (`src/components/referrals/referral-reply-dialog.tsx:190-195`):
  ```tsx
  {/* Optional attachment — the upload action lands with backend's storage
      bucket; the field is present now so the layout is final. */}
  <div className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-card/50 px-3 py-2.5 text-xs text-muted-foreground">
    <Paperclip aria-hidden="true" className="size-4" />
    Anexos da resposta poderão ser adicionados após concluir.
  </div>
  ```
  This is a static, disabled-looking placeholder (pt-BR: "Attachments for the reply can
  be added after concluding") — **no file input, no upload wiring, nothing moves
  bytes.** It confirms the answer to the task's question directly: **the reply-attachment
  UI does not move files.** This is also *why* `addReferralReplyAttachment` has zero
  callers (§B8/§5) — the component that would call it was deliberately left
  unwired pending DM4.

---

## 4. Section C — keystone state (`supabase/tests/328_dm1_document_substrate.sql`)

**[code]** File read directly (pgTAP text, not a runtime-rewritten function body, so
this file's text is trustworthy as itself — unlike `pg_proc.prosrc`).

### K2 — the DM4 allowlist, quoted verbatim (lines 147–192)

```sql
-- =============================================================================
-- K2 — the DM4 allowlist, pinned by NAME so DM4 cannot forget an entry.
-- Every row here is a live referral-owned boundary DM1 deliberately spares
-- (plan DM1 item 1 + the 2026-08-12 amendments). DM4 retires ALL of them and
-- flips these pins to zero-count DELIBERATELY, in the same change (the
-- 325-t4 discipline: retire deliberately, never by accident).
-- =============================================================================

select ok(exists(
  select 1 from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and policyname = 'case_documents_select_member'),
  'K2a case_documents_select_member survives DM1 (live frozen-snapshot boundary until DM4)');

select ok(exists(
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname = 'can_read_snapshot_document'),
  'K2b app.can_read_snapshot_document survives DM1 (predicate of K2a, DM4 retires it)');

select ok(exists(
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'add_referral_reply_attachment'),
  'K2c add_referral_reply_attachment survives DM1 (referral-owned, DM4 migrates it)');

select ok(exists(
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'get_referral_attachment_path'),
  'K2d get_referral_attachment_path survives DM1 (referral-owned, DM4 migrates it)');

select ok(exists(
  select 1 from pg_policies
   where schemaname = 'public' and tablename = 'referral_reply_attachment'
     and policyname = 'referral_reply_attachment_select_readable'),
  'K2e referral_reply_attachment_select_readable survives DM1');

select ok(exists(
  select 1 from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and policyname = 'referral_attachments_obj_insert'),
  'K2f referral_attachments_obj_insert survives DM1');

select ok(exists(
  select 1 from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and policyname = 'referral_attachments_obj_select'),
  'K2g referral_attachments_obj_select survives DM1');
```

All 7 names in K2 match §1's DIFF TABLE's "CONFIRMED" rows exactly — **DM4's
literal-emptying job (plan step 5) is 7 assertions, not more, not fewer, and the
catalog confirms all 7 targets are still alive today** so the closure will exercise a
real (not vacuous) transition when DM4 lands.

### K8a / K8b — quoted (lines 754–822)

K8a (referral, `add_referral_shared_item` document arm — DM4's) and K8b (RCA,
`add_rca_evidence` citation arm — Wave D's) are both **present and active**:

```sql
-- K8a add_referral_shared_item refuses its document arm (parked until DM4)
select throws_ok(
  $$ select public.add_referral_shared_item(
       '328e0000-0000-0000-0000-0000000000d1', 'document', null,
       'a3300000-0000-0000-0000-0000000000a1') $$,
  'HC0DM', ...);

-- K8b add_rca_evidence refuses a document citation (parked until Wave D)
select throws_ok(
  $$ select public.add_rca_evidence(
       'f3000000-0000-0000-0000-0000000000a3', 'citation', ...) $$,
  'HC0DM', ...);
```

K8c (the ethics `related_document_id` refusal) **was removed by DM3** — the file's own
comment (lines 806–822) explains why explicitly and warns against misreading "remove
keystone K8" as removing K8a/K8b too:

> ⚠ K8a and K8b STAY. "Remove keystone K8" as originally written named an object that
> is not one: K8a is the REFERRAL seam (parked until DM4) and K8b the RCA seam (parked
> until Wave D). Removing "K8" literally would have deleted two parked-seam pins that
> other waves still depend on.

**This directly confirms the task's assumption to verify: K8a/K8b are deliberately
alive for DM4/Wave D, not stale leftovers.** DM4's exit criteria should include
flipping K8a from `throws_ok(...'HC0DM'...)` to a positive assertion once
`add_referral_shared_item`'s document arm is re-pointed at the document model — K8b
stays as-is (Wave D's, not DM4's).

The file currently plans **128 total assertions** (`select plan(128)`), spanning K1–K16;
only K1/K2/K8a/K8b/K3–K7/K9/K10/K11/K12/K13/K14 (and siblings) are in scope of this
file, all pre-existing DM1–DM3 machinery. DM4 will add new assertions on top, not
inside, this count.

---

## 5. What this changes for the DM4 plan

1. **Rename the plan's cited function name.** `getReferralReplyAttachmentUrl` should
   read `getReferralAttachmentUrl` wherever the plan or a future commit message cites
   it — the name in the codebase has been `getReferralAttachmentUrl` since before this
   audit (not renamed by `87cd1ddb`; that commit didn't touch `src/lib/**` at all, per
   §B9).

2. **Two RPCs are load-bearing for step 1 but are not named anywhere in the plan text:**
   `public.get_referral_snapshot_document_path` (the read path) and
   `public.add_referral_shared_item`'s `document` arm (the write path, currently
   `HC0DM`-parked). DM4's actual migration surface for "snapshot files become
   version/file/rendition records" is these two functions, not the TS wrapper names
   the plan lists. Both must move together — un-parking the write arm without also
   repointing the read arm (or vice versa) would create a write/read mismatch.

3. **`referral_shared_item.source_document_id` needs a new FK, not a fixed one** — DM1
   dropped the old FK on purpose (ADR 0116 decision 1); there is nothing to "migrate"
   on this column, only something to (re-)create pointing at the new `documents` (or
   `document_versions`) table.

4. **The freeze-immutability requirement (plan step 1, "frozen snapshots immutable
   even if the source document later changes/disposes") has no existing enforcement
   for the `document` kind** — `trg_guard_referral_snapshot_lock` only locks the
   `referral_shared_item` row itself post-send; it says nothing about the source. For
   `narrative` this is already true by construction (value copy at freeze time); for
   `document` DM4 must build the same copy-at-freeze discipline (presumably binding to
   a specific `document_version_id`/`file_object_id` at freeze time, immune to later
   supersession/disposal of the live document) — this is design work, not a rename.

5. **Preserve the two-tier PHI gate**, don't flatten it: `referral_reply_attachment`'s
   row-visibility (`can_read_referral_metadata`, broad) is intentionally looser than
   its byte-visibility (`can_read_referral_phi` on the Storage policy, narrow). Any
   migration to `documents`/`file_objects`-style RLS should reproduce this two-layer
   shape or explicitly decide to collapse it (a decision, not an accident) — worth a
   one-line note in the DM4 plan's step 3 negative-twin design.

6. **`addReferralReplyAttachment` (TS) / `add_referral_reply_attachment` (RPC) have
   zero live callers today** — the UI intentionally ships a disabled placeholder
   (§B9). DM4 should decide explicitly whether to (a) wire this action to a new
   file-upload flow reusing the RPC as-is, (b) retire it in favor of a document-model
   equivalent, or (c) something else — but should not assume it is either "already
   working" or "safe to delete because unused," since it is a live, correctly-built,
   simply-unwired door.

7. **`case-documents` bucket has no write policy at all today** — confirms it is
   correctly read-only/legacy, consistent with DM4 retiring it rather than extending
   it. No surprise there, just confirmed rather than assumed.

8. **K2's 7 pins are exactly and only the plan's step-4 list** (once corrected for the
   §1 rename) — no 8th name is hiding in K2 that the plan forgot. The genuinely unnamed
   surfaces (§1, 6 of them) sit *outside* K2's `%attachment%`-shaped sweep entirely,
   the same blind spot that missed `case_documents_select_member` /
   `can_read_snapshot_document` the first time (they don't match `%attachment%`
   either). **DM4's own exit sweep (plan step 5, "empty the DM1 referral allowlist")
   will not catch these 6** unless the sweep query is widened beyond `%attachment%` —
   worth flagging to whoever writes DM4's keystone, since the K1-style sweep pattern
   is structurally blind to exactly this class of surface for the third time.

---

## 6. Uncertainties / not verified

- **Production data** was not queried — this audit ran entirely against the **local**
  Docker stack (fresh-ish reset state per the seed's deterministic fixtures; `storage.
  objects` had 0 rows, meaning no real files exist locally to test signed-URL behavior
  end-to-end). The plan's "1 dangling frozen production row" is corroborated in *shape*
  by the local seed fixture and by the ADR 0116 decision text, not verified against
  the actual production database (out of this audit's access).
- The full 129-row A1 listing was reviewed but only the referral-relevant subset is
  quoted above; the remaining ~119 rows (capa/rca/documents/controlled-documents/
  case-narrative/printed-document machinery) were skimmed for referral relevance and
  none were found to be referral-reachable, but this was not an exhaustive line-by-line
  read of every one of those 119 function bodies.
- Did not run `ARM=census`/`ARM=hat`/`ARM=floor`/`ARM=wrapper` or any mutation-testing
  arm — out of scope for a read-only audit and explicitly not requested.
- Did not attempt to reconcile the plan's "4 production objects" (DM5, printed PDFs) or
  any Wave D/ethics-scoped seam — out of DM4's scope, mentioned only where the catalog
  surfaced them incidentally (e.g. K8b, the other 3 parked-seam tables).
