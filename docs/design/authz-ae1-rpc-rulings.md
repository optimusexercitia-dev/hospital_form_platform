# AE1.4 — the 11 `UNDECIDED` `.rpc()` sites: ruling preparation for the PO

- **Status:** ✅ **APPROVED AS-IS by the PO, 2026-08-27** (same day), with **four
  observations** — see the appendix, which records each observation's disposition. Scope of
  the approval, written down so it cannot be remembered differently: **all 11 proposed
  rulings and riders R1–R3, verbatim**; the observations add work (one fix + three FUPs +
  one registry reclassification), they do not amend any ruling. The registry
  ([backend-state.md § Service-role DML registry](../backend-state.md), Group E) was flipped
  at recording — zero `undecided` rows remain, satisfying Gate AE1's `[PA-F10]` condition
  ([plan](../plans/authz-evolution.md); ADR
  [0162](../decisions/0162-authz-evolution-plan-audit-corrections.md)).
- **Scope:** the 11 Group-E call sites = **9 distinct functions** (`fail_minutes_job` has three
  call sites). All TS-side facts below are quoted from the committed AE1.4 registry (re-derived
  at `e7c26068`, 45/45, zero delta); all SQL-side facts are **measured from the live local
  catalog 2026-08-27**, never from migration text.
- **Ruling vocabulary** (the registry's): a **door name** (actor-validating) ·
  **self-scoped by construction** · **system actor: `<invariant>`** · `UNDECIDED`.

## Method and caveats

Deriving queries (run against the local stack, `supabase_db_azkbbhskturikxpgmafq`):

```sql
-- posture: schema, args, prosecdef, owner, ACL, effective EXECUTE per role
select n.nspname||'.'||p.proname, pg_get_function_identity_arguments(p.oid),
       p.prosecdef, pg_get_userbyid(p.proowner), p.proacl,
       has_function_privilege('anon', p.oid, 'execute'),
       has_function_privilege('authenticated', p.oid, 'execute'),
       has_function_privilege('service_role', p.oid, 'execute')
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where p.proname in ('complete_evidence_upload_verification','complete_document_upload_verification',
 'complete_document_reclassification','complete_document_disposal','fail_minutes_job',
 'complete_minutes_job','list_stale_meeting_audio','get_feature_flags','lookup_printed_document');
-- bodies: pg_get_functiondef(p.oid) over the same set
```

✅ **Both caveats DISCHARGED at recording (R3), 2026-08-27 — evidence:**

1. **Stack state.** All four unregistered migration files
   (`…004600`/`…004610`/`…004620`/`…004710`) grep **zero** references to any of the 9
   function names, so the hand-applied changes cannot have altered them; the posture query
   was re-run the same day (identical results, plus `md5(prosrc)` per function).
2. **Remote parity.** The identical query on the linked remote returned **byte-identical
   body hashes for all 9 functions** and identical ACLs/`prosecdef` — zero drift, both
   directions. (Grants drift independently of migrations — AE1.2's standing warning — so
   this is re-checked again at the AE1 gate as a matter of course.)

## The decisive shared fact: the ACL layer already closes the front door

Measured posture, all 9 functions: `SECURITY DEFINER`, owner `postgres`, pinned
`search_path`, **explicit ACLs** (none is on the NULL/PUBLIC default):

| function | anon EXECUTE | authenticated EXECUTE | service_role EXECUTE |
| --- | --- | --- | --- |
| `complete_evidence_upload_verification` | ✗ | ✗ | ✓ |
| `complete_document_upload_verification` | ✗ | ✗ | ✓ |
| `complete_document_reclassification` | ✗ | ✗ | ✓ |
| `complete_document_disposal` | ✗ | ✗ | ✓ |
| `fail_minutes_job` | ✗ | ✗ | ✓ |
| `complete_minutes_job` | ✗ | ✗ | ✓ |
| `list_stale_meeting_audio` | ✗ | ✗ | ✓ |
| `get_feature_flags` | ✗ | **✓** | ✓ |
| `lookup_printed_document` | ✗ | ✗ | ✓ |

So the scenario the `UNDECIDED` label had to keep open — *any logged-in user invokes these
through PostgREST* — is **refuted by measurement** for all nine (`get_feature_flags`'s
`authenticated` grant is deliberate and read-only). The residual surface is exactly one
population: **our own server code calling them with the service-role client** — which is what
each ruling below addresses. This premise is load-bearing, so Rider R1 pins it in pgTAP.

---

## Proposed rulings, per site

### 1–2. `complete_evidence_upload_verification` + `complete_document_upload_verification`
(`documents/actions.ts:finalizeDocumentUpload`)

**Measured (bodies):** the **evidence** variant is not an unguarded completion at all — it
re-derives the actor from durable state (`v_actor := upload_sessions.reserved_by`, refusing a
NULL reserver as fail-open) and checks `app.can_write_rca(...)` / `app.can_write_capa(...)`
**before any write**, authority-before-existence, then delegates byte verification to the
non-evidence variant. The **non-evidence** variant carries no actor check but is a single-shot
state transition: session must be `consumed` (set only by the user-session door
`finalize_document_upload` under the caller's own session), file must be `verifying`; it binds
the outcome and emits `document.uploaded` / `document.upload_failed` with `reserved_by`.

**Proposed ruling:**
- Site 1 → **door (re-classified, no code change):** *"door: in-function actor re-derivation —
  `upload_sessions.reserved_by` → `app.can_write_rca`/`can_write_capa`, authority before
  write; actor bound to durable session state rather than a caller-supplied parameter."*
  This is category 1 in substance; binding the actor to the session row is *stronger* than a
  `p_actor` argument, which buggy TS could fabricate.
- Site 2 → **system actor:** *"completion of a `consumed` upload session — single-transition
  state machine keyed by session id; authority spent at the user-session door
  `finalize_document_upload`; EXECUTE service_role-only (R1-pinned)."*
  The asymmetry with site 1 is deliberate: the evidence corridor mints new domain rows (a
  fresh authorization act); this one only records verification of an upload already authorized
  at begin and finalize. *Declined option, recorded:* mirroring the evidence variant's
  re-check here would only defend against authority revoked mid-upload — real but marginal;
  convert later if a finding shows mid-flight revocation matters.

### 3. `complete_document_reclassification` (`documents/actions.ts:reclassifyDocument`)

**Measured:** acts only on a file object in `upload_state='reserved'` (minted by the
user-session door `reclassify_document`) whose version has no files yet; requires the old file
to belong to the same document, sha equality with the old file, and the copied object present
in storage; emits `document.reclassified`.

**Proposed ruling — system actor:** *"completion keyed to a `reserved` file object minted by
the user-session door `reclassify_document`; sha-match + same-document + storage-presence
preconditions in-function; audit emitted in-function; EXECUTE service_role-only (R1)."*

### 4. `complete_document_disposal` (`documents/actions.ts:reclassifyDocument`)

**Measured:** the scariest name, the strongest body. Acts only on a file already in
`disposal_state='disposal_pending'`; byte-proof restricted to a closed vocabulary; blocks
disposal under a provisional retention policy except two evidence-backed exemption lanes
(audited via `document.retention_override`); verifies the storage object is **absent** (it
records a deletion that already happened — it cannot cause one); emits `document.disposed`.
The destructive act itself is the storage remove — a separate, separately-registered Group F
site.

**Proposed ruling — system actor:** *"records an already-performed storage deletion for a
file already `disposal_pending`; closed byte-proof vocabulary, retention-policy block, and
absence verification in-function; audits both lanes; EXECUTE service_role-only (R1)."*

### 5–7. `fail_minutes_job` ×3
(`minutes-jobs/actions.ts:failAndCleanUp` · `reconcile.ts:failJob` · `webhook.ts:failJob`)

**Measured:** terminal transition only — refuses unless status ∈ {`uploading`,`processing`};
flips to `failed`, purges transcript/result, emits `minutes_job.failed`, notifies the
requester. Per-path gates (registry): the caller's own RLS-scoped setup inside
`submitMinutesJob`; a `staff_admin`-gated RLS read before reconciliation; the HMAC-verified
callback route. Worst abuse by our own code: prematurely failing an in-flight job —
disruption, not escalation, and audited.

**Proposed ruling — system actor (one ruling, three rows):** *"terminal state transition
(`uploading`|`processing` → `failed`) keyed by job id; each of the three call paths gated at
its own layer (RLS-scoped setup / staff_admin-gated reconciliation read / HMAC-verified
callback route); audit + notification in-function; EXECUTE service_role-only (R1)."*
Consistent with Group C, which already rules this same lifecycle's raw table DML as system
actor.

### 8. `complete_minutes_job` (`minutes-jobs/webhook.ts:handleMeetingMinutesCallback`)

**Measured:** single transition `processing` → `done`; writes result/draft/transcript; emits
`minutes_job.completed`; notifies. The real risk is content injection — a forged callback
would plant a fabricated ata draft. The control is the route-layer HMAC
(`verifyCallbackSignature`), and the registry records that **no test exercises it**
(`route.test.ts` mocks the handler out).

**Proposed ruling — system actor, with a test obligation:** *"provider-callback completion;
sole caller is the HMAC-verified webhook route; single transition `processing`→`done` keyed by
job id; audit in-function; EXECUTE service_role-only (R1)."* **Rider R2 is a condition of
this ruling, not a suggestion** — an invariant whose only guard is untested route code is one
refactor from silently vanishing.

### 9. `list_stale_meeting_audio` (`minutes-jobs/sweep.ts:sweepStaleAudio`)

**Measured:** `STABLE`, read-only listing of TTL-expired objects in the `meeting-audio`
bucket; bounded (`limit` clamped ≤ 1000, age floor 1 h).

**Proposed ruling — system actor:** *"cron/sweep input; read-only, bounded; EXECUTE
service_role-only (R1)."*

### 10. `get_feature_flags` (`queries/feature-flags.ts:getFeatureFlagsServerOnly`)

**Measured:** `STABLE` one-liner over `app.feature_flags`; returns flag booleans only — no
tenant data, no PHI. `authenticated` may EXECUTE (deliberate); `anon` may not — which is
exactly why session-less server surfaces (`/verificar`, the webhook) read it through the
service client.

**Proposed ruling — system actor:** *"read-only global feature-flag projection; the grant
layer is the control (`authenticated` + `service_role`, `anon` excluded, R1-pinned);
service-role use exists to serve session-less server surfaces."*

### 11. `lookup_printed_document` (`queries/printed-documents.ts:lookupPrintedDocumentVerification`)

**Measured:** the designed anonymous verification surface (ADR 0104 D10) — but **not**
anonymous at the DB layer: `anon` has no EXECUTE; the server mediates, and the TS wrapper
rate-limits per credential + globally (`consumeLookupBudget`) **before** the RPC
(test-pinned). In-function: every lookup logged hash-only into `verification_lookups`
(matched or not); the registry `document_id` is disclosed only when a non-null `p_viewer`
passes `app.can_view_printed_document`; `revoked` short-circuits currency at the door.

**Proposed ruling — system actor (designed public surface):** *"server-mediated anonymous
verification (ADR 0104 D10): TS rate budget precedes every call; hash-only lookup logging
in-function; id disclosure viewer-gated in SQL. ⚠ Invariant: `p_viewer` is an
arbitrary-principal parameter — the TS wrapper must only ever pass the session-derived user
id (or null); any new caller inherits this obligation."*

---

## Riders (part of the ruling package)

- **R1 — pin the premise in pgTAP.** Every ruling above leans on the measured ACLs. Add one
  pgTAP block (AE1.6's exact-ACL pattern) asserting, for all 9 functions: `anon` has no
  EXECUTE; `authenticated` has none **except** `get_feature_flags`; `prosecdef` true; pinned
  `search_path`. A future migration widening any of these reds a test instead of silently
  re-opening the front door.
- **R2 — the HMAC deny test** (condition of ruling 8, applies to 5c/8): a route-level test
  asserting the minutes webhook rejects a bad/absent signature *without* reaching
  `fail_minutes_job`/`complete_minutes_job`. Files as a named FUP if not done inside AE1.
- **R3 — re-measure before recording** (method caveats above): fresh-reset local re-run +
  remote-parity check of the posture query; then flip the 11 registry rows from `UNDECIDED`
  to the ruled mechanism strings, citing this doc and the PO approval date.

## What approval changes

The 11 Group-E rows leave `UNDECIDED` (registry § Group E), the plan's PO-decision-table row
for AE1.4 closes, and Gate AE1's "zero `undecided` dispositions" condition `[PA-F10]` is
satisfiable. **No code or schema change ships with these rulings** except R1's pgTAP
assertions and R2's test; site 1's re-classification is evidence-based, not a rewrite.

---

## Appendix — the four PO observations at approval (2026-08-27) and their dispositions

Recorded here because an approval's scope is a fact that must be written down; the
observations were given as "fold in whenever appropriate", and each disposition below says
what was done and where the rest lives.

1. **Minutes-job idempotency defect (fix ordered).** Both terminal doors did
   SELECT-status-then-unconditional-UPDATE — concurrent callbacks could both observe
   `processing` and both win (double audit, double notification); the "status latch" was a
   read, not a latch. **FIXED** — migration `20261003005000_minutes_job_terminal_latch_atomic.sql`
   moves the latch predicate into the UPDATE's WHERE (+ `FOUND`), the ruling's preferred
   `UPDATE … WHERE status … RETURNING` form, for both `fail_minutes_job`
   (`uploading`/`processing`, the ❗5 rule preserved) and `complete_minutes_job`
   (`processing`). Return shapes, audit/notification payloads and dedupe keys preserved.
   **Validated by a rolled-back apply on the live stack**: both compile; miss-path probes
   return the preserved `{"updated": false, "status": null}`; post-rollback `md5(prosrc)`
   identical to the pre-apply hashes (rollback proven to move the hash back); and pgTAP
   `388` §3's atomicity text-pins were proven **RED against the old bodies** before landing.
   Full suite verification runs in the next owned stack window (fresh reset — the stack
   belonged to AE1.5's evidence window at recording time). ✅ **Verified the same day**: the
   PO granted stack ownership; fresh reset (all migrations registry-applied, the
   hand-applied divergence normalized) → full pgTAP suite **236 files / 7,855 tests,
   PASS**, `388` green by name.
2. **Reclassification completion should consume a DB-minted operation id.** Correct — the
   four loose parameters bound abuse relationally but do not prove one-invocation
   provenance. **FILED** as `FUP-DOC-RECLASS-OPERATION-ID` (index + body, 2026-08-27): its
   own increment (schema + both doors + TS call site), not a rider; the ruled §3 mechanism
   stands meanwhile.
3. **Disposal should split by provenance** (automated duplicate retirement vs human
   DSR/manual disposal — different authorization, evidence, audit; the generic door erases
   the distinction). **FILED** as `FUP-DOC-DISPOSAL-PROVENANCE-SPLIT` (index + body,
   2026-08-27), owner backend/PO for the LGPD/DSR half; the ruled §4 mechanism stands
   meanwhile.
4. **Treat the printed lookup as WRITE-BEARING in the registry.** Correct — every call
   inserts a `verification_lookups` row. **DONE at recording**: the Group-E row now says
   write-bearing, names the audit-retention owner (the documents/printing domain), and the
   "rate limiter fronts every caller" property gained an executable pin —
   `src/lib/queries/printed-documents-caller-census.test.ts` (house caller-census pattern:
   per-run positive controls, exactly-one-caller pin naming the budgeted wrapper, and a
   guarded budget-precedes-RPC ordering assertion; 8/8 green at recording).
