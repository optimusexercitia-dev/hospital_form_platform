# DM4 — Wave C: referrals (build plan)

> Program: ADR [0114](../decisions/0114-document-model-redesign.md) (+Amdt 1 D15/D16, +Amdt 2 D17) ·
> parent plan [DM0–DM5](./document-model-redesign.md) § "Phase DM4".
> **Step 0 evidence (binding, read it before writing SQL):**
> [dm4-surface-verification.md](../progress/dm4-surface-verification.md).
> Opened 2026-08-14. Branch: **`main`** (DM0–DM3 merged at `17b1516b`; ⛔ **nothing pushed**,
> **no `db push`**, all five DM flags **OFF**).

## 0. What step 0 changed about this plan

The parent plan's DM4 list was written before REG·KIND/ADR 0110 and before the referral
layout refactor. It was re-derived from the **live catalog**, not confirmed from the text.
Everything it names is live, with **one rename** and **six surfaces it never names**.

| Parent plan says | Reality (catalog/code verified) |
| --- | --- |
| `getReferralReplyAttachmentUrl` | **GONE** → `getReferralAttachmentUrl` (`src/lib/queries/referrals.ts:1112`) |
| `getReferralDocumentUrl` | CONFIRMED (`…referrals.ts:1090`) — but its RPC is **unnamed by the plan** |
| `add_referral_reply_attachment`, `get_referral_attachment_path` | CONFIRMED, both `prosecdef` |
| `case_documents_select_member`, `app.can_read_snapshot_document` | CONFIRMED (DM1's hand-named spares) |
| `referral_attachments_obj_insert` / `_select`, K2 allowlist | CONFIRMED |
| — | **UNNAMED:** `get_referral_snapshot_document_path` (the read seam's actual RPC) |
| — | **UNNAMED:** `add_referral_shared_item`'s `document` arm (fails closed `HC0DM` — the write seam) |
| — | **UNNAMED:** `referral_shared_item_select_phi`, the whole-table PHI policy |
| — | **UNNAMED:** `referral_reply_attachment_select_readable` gates on `can_read_referral_metadata` (broad) while its Storage door gates on `can_read_referral_phi` (narrow) — an **intentional two-tier asymmetry the negative twin must preserve** |
| — | **UNNAMED:** `addReferralReplyAttachment` TS action — wraps a live RPC, **zero UI callers** |

⚠ **`referral_shared_item.source_document_id` carries NO FK** (verified `NONE`, nullable).
DM1 dropped it deliberately (ADR 0116 D1). **DM4 creates that constraint; it does not migrate one.**
⚠ **`public.attachments` the TABLE no longer exists** — DM1 dropped it outright. Only the orphaned
`attachments` / `attachments-phi` *buckets* survive, and those are **DM5's**, not DM4's.

## 1. PO rulings for this phase (2026-08-14)

- **R1 — Reply attachments are RE-POINTED, not retired.** The inert seam
  (`referral-reply-dialog.tsx` ships a disabled placeholder; `add_referral_reply_attachment` has
  zero UI callers) is **rebuilt on the document model** in DM4: begin/finalize upload, rendition
  binding, the audited open door, and a real UI control replacing the placeholder.
  ⚠ **This makes DM4 a migration *plus new product surface*** — it carries UI, E2E and QA burden
  the parent plan's DM4 text does not describe. Scope it as such; do not let it grow further.
- **R2 — The 1 dangling frozen PRODUCTION row is DEFERRED to the push/deploy step.** DM4 builds
  and proves reconciliation **locally**; production is untouched while 136 commits sit unpushed.
  Filed as **FUP-DM4-PRODROW** so the obligation cannot be lost. Do **not** query or mutate the
  linked project during this phase.

## 2. Slices, owners, file ownership

**Migration window: `20260926000100`+** (highest registered = `20260925001100`; disk 386 ==
registered 386, verified clean at phase open). ⚠ The chain + `seed.sql` are ONE artifact.

| # | Slice | Owner | Touches |
| --- | --- | --- | --- |
| S0 | **Contract-first** — post typed signatures for every query/action `frontend` depends on, **before** implementing | `backend` | `src/lib/queries/referrals.ts`, `src/lib/referrals/actions.ts` (stubs + types only) |
| S1 | **Read seam** — frozen snapshots → version/file/rendition; `getReferralDocumentUrl` + `get_referral_snapshot_document_path` onto the audited open door; the `case-documents` signer dies (**F-14**) | `backend` | migrations, `src/lib/queries/referrals.ts` |
| S2 | **Write seam** — un-park `add_referral_shared_item`'s `document` arm; **create** the FK on `referral_shared_item.source_document_id` | `backend` | migrations |
| S3 | **Reply attachments re-pointed (R1)** — begin/finalize upload + rendition binding on the document model; retire `add_referral_reply_attachment` / `get_referral_attachment_path` and their policies | `backend` | migrations, `src/lib/referrals/actions.ts` |
| S4 | **Reply-attachment UI** — replace the disabled placeholder with a real upload control | `frontend` | `src/components/referrals/referral-reply-dialog.tsx` (+ siblings) |
| S5 | **Keystone closure** — empty the DM1 allowlist **entirely** (incl. the two non-`%attachment%` case-documents entries); re-run the door sweep at **zero exceptions**; K8a/K8b disposition | `backend` | `supabase/tests/328_dm1_document_substrate.sql`, new DM4 suite |
| S6 | **Test pass** | `tester` | `e2e/**` only |
| S7 | **QA + the five-step gate** | `qa` → lead | `docs/reviews/dm4-referrals-review.md` |

**Binding:** two teammates never edit the same file; shared types change only via `backend`.
`frontend` owns no SQL; `tester` never edits app code; `qa` is read-only on app code.

## 3. Assurance — the part that is NOT optional

### 3.1 Both write seams are in the census blind class

`add_referral_shared_item` and `add_referral_reply_attachment` are **`prosecdef = true` returning
composite types** and auth-reachable. That places them in the **unruled census blind class**
(measured **150**; the recorded figure is **146** — ⚠ *delta unreconciled, do not report as growth*).

**Consequence, stated so nobody misreads a green bar:** `ARM=census`, `ARM=hat`, `ARM=floor` and
`FROMFINDINGS=1 ARM=wrapper` will **all pass regardless of what DM4 does to these two doors.**
They are not evidence for this phase. This is the same standing blind spot ADR 0118 §12 recorded
for `open_document_version` (blind for returning `jsonb`).

**Therefore DM4 authors bespoke pgTAP keystones for both doors, RED-FIRST:**
- Write the keystone, **neutralize the door's gate, and require the suite to go RED** before the
  fix lands. A keystone never proven able to fail is not a keystone
  ([[detector-that-finds-nothing-must-be-proven-able-to-find-something]]).
- **Neutralize each excluded state INDEPENDENTLY.** DM3 found two doc-status checks that were
  **one barrier with two codes** — killing one still refused via the other. One twin standing for
  several states hides exactly that.
- ⚠ A **`public`** RPC arm can **never** be "pinned unreachable" — any direct PostgREST caller
  reaches it. If an arm is orphaned, **remove it**; "keep it and keystone it unreachable" is fiction.

### 3.2 The negative twin (plan step 3, sharpened by step 0)

Document-layer access **must not widen `can_read_referral_phi`**. Step 0 found the asymmetry the
twin has to preserve: `referral_reply_attachment_select_readable` gates on
`can_read_referral_metadata` (**broad**) while its Storage door gates on `can_read_referral_phi`
(**narrow**). That is intentional and two-tier — **a twin that collapses them into one tier passes
by construction and proves nothing** ([[a-no-regression-claim-needs-an-over-grant-twin]]).

### 3.3 Standing method rules for this phase

- **The catalog is the sole truth.** `pg_proc` (incl. `prosecdef`), `pg_policies`, `pg_policy`,
  `pg_trigger`, ACLs. Never graphify SQL, never grep a migration file and believe it — that has
  produced a confident **false P0** on this project.
- **`prosecdef` belongs beside `pg_policies`** — a DEFINER's gate *replaces* RLS.
- **Run pgTAP on a fresh `supabase db reset`.** DM3's P0 (every create broken since M1, masked by
  a backfill) was visible **only** to the fresh reset.
- **When a fixture violates a new constraint, ask what else writes that table** — the fixture is a
  *caller*, not the bug. DM3's first diagnosis was one level too shallow and a seed-only fix would
  have gone green and shipped a broken wizard. Prefer satisfying a constraint **by construction**
  (a `BEFORE INSERT` trigger) over N hand-mirrored call sites.
- **Gate a corridor at its FIRST residue-producing step**, not its last. DM3's flag gated the last
  step: flag OFF still created the doc, reserved a path, **PUT real bytes**, and finalized.
  ⚠ Scope the assert by home type — a blanket assert satisfies the new keystone while silently
  killing Wave A.

## 4. Exit criteria

1. Referral E2E green **both sides** (source + target), plus the new reply-attachment flow.
   Baseline to beat: **89 passed · 0 did-not-run · coverage 89/89** (lead-verified 2026-08-14).
2. **Audit-row exactness proven** — a fresh centralized PHI snapshot opens from the canonical
   bucket **exactly once with exactly one audit row**; the retired bucket path serves nothing.
3. **DM1 allowlist empty; door-sweep keystone at ZERO exceptions.**
4. Bespoke keystones for both blind doors, each **proven able to fail**.
5. Negative twin green, preserving the two-tier asymmetry.
6. Full §6 five-step Phase Gate: build (lint 5/5 · tsc · vitest · pgTAP on fresh reset · all four
   authz arms · diff-scoped door sweep) → test pass → QA → human approval → Record.

## 5. Deliberately NOT in DM4

- Production reconciliation (**FUP-DM4-PRODROW**, R2) · any push or `db push`.
- Bucket deletions — **all** batch in DM5 so there is exactly one retirement manifest.
- NSP RCA/CAPA evidence, printed-PDF renditions, ARCHITECTURE/Rule-9 canon rewrites — **DM5**.
- Ruling the 146/150 census blind class as a whole. DM4 keystones **its own two doors**; the
  class-wide ruling stays open with the PO.
