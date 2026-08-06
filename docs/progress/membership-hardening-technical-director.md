# Membership hardening + Diretor Técnico (ADR 0094) — rotated from PROGRESS.md 2026-08-05

> Rotated out of the live PROGRESS.md at the AFF kickoff (CLAUDE.md §7 / lead-playbook §5).
> Status of record: COMPLETE, merged to `main`. The Phase Status table remains the index.

**▶ ACTIVE: Membership hardening + Diretor Técnico** (ADR
[0094](docs/decisions/0094-membership-hardening-and-technical-director.md) + Amendments 1–3; plan
[membership-hardening-technical-director.md](docs/plans/membership-hardening-technical-director.md)) —
merged to **`main`** (fast-forward) 2026-08-04, **not pushed to origin**. PO closed all
four open items 2026-08-04: atomic replace · platform_admin may **not** appoint a DT · W1→W4 straight
through · DT flag ships **ON at T4.9** — and it now **is ON** (`20260905000600`, the last step of W4).

| WS | Scope | State |
| -- | ----- | ----- |
| **W1** | Package A — one commission role per principal; composite FKs replace the two trigger guards; `granted_by` index; full writer sweep | ✅ **complete** — `9f3388a`; pgTAP `291` 35/35; mutation **9/9 RED-PROVEN**; E2E green |
| **W2** | `public.session_context()` (one round trip, generic over roles) + expiry defusal + role-completeness grid | ✅ **complete** — `36a69d5`; pgTAP `292` 25/25; mutation **9/9**; E2E green (session bootstrap re-plumbed) |
| **W3** | Package B — actor kernel + service door; **no raw `memberships` DML** (repo gate) | ✅ **complete** — `36a69d5`; pgTAP `293` 24/24 (two-entry equivalence grid); mutation **8/8**; E2E green — ⚠ **5 of the 6 migrated callers**; `assignOrgAdmin` (platform first-org_admin provisioning) has NO E2E spec, so its migration to `grant_role_for` is pgTAP-proven only → FUP-MEM-2 |
| **W4** | Diretor Técnico backend — the two roles + the referral plane | ✅ **complete** — T4.1–T4.3 `803e837` (pgTAP `294` 29/29, mutation 8/8); T4.4–T4.13 (`20260905000500` referral target sum type + `20260905000600` enable): pgTAP `295` **60/60**, mutation **13/13 RED-PROVEN**. Flag `technical_director` **ON**. Seed: `dt.a@` / `dt.dep.a@`. **No frontend** by plan — `p_target_hospital_id` on `create_referral_draft` has no product caller yet (FUP-MEM-3) |

Gate so far: pgTAP **156 files / 4796** on a fresh reset · lint 0/0 (+ `lint:memberships-door`) ·
typecheck · Vitest **901/901** · W4 mutation audits **8/8 + 13/13 RED-PROVEN**, both controls green.
Earlier targeted `e2e:prod` runs: **171 passed / 0 failed** (W3) and **160/0** (W1+W2).
**FULL `e2e:prod` 2026-08-04: 954 passed · 1 failed · 2 flaky · 5 deliberate skips · 962/962
accounted** — the one failure is FUP-BULK-1, pre-existing and reproducible on `main`.
**Authz:** diff-scoped ARM 1 over W4's own four gates = **3 COVERED · 1 ERROR · 0 BLIND**; the full
302-case sweep found 15 BLIND gates, **none of them W4's** (FUP-AUTHZ-2).
**W1→W4 is COMPLETE and merged to `main`** (fast-forward, unpushed).

**Follow-up session 2026-08-05** (branch re-based on `main` after PCI+TV — merge `fbcd800`, one
conflict, both sides kept). Of the five items this row used to list as open:
**FUP-AUTHZ-2 ✅ RESOLVED** (298 32/32 · 15/15 RED-PROVEN) · **FUP-MEM-1 ✅ RESOLVED — not a defect**
(its leading hypothesis disproven; see the entry) · **FUP-BULK-1 fixed, E2E confirmation owed**
(probabilistic, so only a full `e2e:prod` can confirm) · **FUP-MEM-2 spec written, never run** ·
**FUP-MEM-3 + 3b ✅ COMPLETE** — appointment panel, send-wizard target picker AND the DT inbox
(`/o/[org]/direcao-tecnica`); E2E 5/5, including the deputy driving the lifecycle.
**BUG-AUTHZ-002 ✅ FIXED** in the same session (it is the same defect class as FUP-AUTHZ-2 — enumerate
by property, not by name — and it exposed a hole in ARM 3 itself).

Gate on the merged tree, fresh reset: pgTAP **160 files / 4903 · PASS** · lint 0/0 · typecheck ·
Vitest **954/954** · real `next build` · `ARM=census` and `ARM=floor` both **INVARIANT HOLDS**.

> ⚠ **W4's referral plane found FIVE fail-open sites that the plan's task list did not name**, and
> none of them could have been caught by a passing test — all five fail OPEN. Making
> `target_commission_id` nullable silently changed every expression that compared to it: in SQL a NULL
> comparison inside `if`/`check` is *no opinion*, which reads as PASS. `case_referral_waiting_on_check`
> would have admitted an arbitrary committee as the waiting party; `guard_referral_message`'s
> `sender not in (v_src, v_tgt)` would have admitted a NULL sender on **every** referral, not just a DT
> one; `link_referral_case` would have attached **any case in the database** as a DT referral's target
> case; `link_referral_related_case` would have raised a raw 23502 out of a check the caller passed.
> The **fifth** was found by the new CHECK itself: "exactly one waiting party" turns every writer of
> `waiting_on_committee_id` into a writer of BOTH columns, so `conclude_referral` and `resolve_referral`
> — which need no DT *audience* arm and therefore appear in no DT-shaped enumeration — were refused the
> first time a DT referral reached them. Four found by asking "what does this evaluate to when the
> operand is NULL"; one found by making the invariant a constraint instead of a convention.
>
> ⚠ **The plan's T4.6 enumeration was also short in the other direction.** Its "21 functions referencing
> `target_commission_id`" is a `prosrc` sweep, and seven more functions inherit the target arm through
> `app.can_manage_referral_target` **without naming the column** (`can_write_referral_response`,
> `cancel_referral_assignment`, `redact_referral_message`, `redact_referral_note`,
> `set_referral_deadline`, `unlink_referral_case`, `update_referral_assignment`). Sweep by the
> **predicate's callers**, not only by the column's name.

> ⚠ **The plan was wrong about the substrate FIVE times, and every correction came from the live
> catalog or a probe, never from review.** `app.session_context()` would be unreachable by PostgREST
> (only `public`/`graphql_public` are exposed) — W2. And four in W1 (ADR 0094 Amendment 2): T1.0 as
> delete+insert defeats its own stated audit goal (the trigger emits `role_changed` only on UPDATE); a
> second FK to `hospitals` is PGRST201 against three live un-hinted embeds; a bare composite `SET NULL`
> nulls `commission_id` too and makes commission titles undeletable; and the replacement semantic opens
> a peer-demotion hole unless authority over the OUTGOING role is required. The plan's own header says
> it is not authoritative on the substrate — it meant it.
>
> ⚠ **The invariant made five pgTAP fixtures illegal, and three failed SILENTLY** — an untargeted
> `on conflict do nothing` absorbs any *future* unique index, so the promotion no-opped and ~23
> keystones in `229`/`233`/`236` denied with `HC0E4` (want of authority) instead of the exclusion code
> under test. The two sites with no `on conflict` clause failed loudly and were the safer shape.

Both programs that gated the pilot are closed:

- **Flexible-Forms, 5 of 5** (ADR [0086](docs/decisions/0086-flexible-forms-pre-pilot.md)) — FF-1/FF-2
  2026-07-27, FF-3/FF-5 2026-07-28, **FF-4 2026-08-03**. Per-phase flags, gate-flip migrations, ADRs
  and records → [flexible-forms-program.md §Program outcome](docs/plans/flexible-forms-program.md).
- **Phase 16 — Standards Crosswalk & Readiness/Gap Engine v2** (ADR
  [0093](docs/decisions/0093-phase-16-standards-crosswalk-replan.md) D1–D10 + Amendments 1–3) —
  ✅ 2026-08-04, PO-approved, flag **ON** via Migration G (`20260904000100`); merged to **`main`**
  (`484a254`) and **pushed to `origin/main`** — the `phase-16-standards-crosswalk` branch was
  fast-forwarded and deleted 2026-08-04. Full log →
  [phase-16-standards-crosswalk.md](docs/progress/phase-16-standards-crosswalk.md); as-built →
  [accreditation-track.md §16](docs/phases/accreditation-track.md).
- **Case-type assignment** (ADR 0088) shipped alongside →
  [case-type-assignment.md](docs/progress/case-type-assignment.md).

> ⚠ **The lesson Phase 16 leaves behind, because it fired FOUR times in one phase: a full green bar can
> cover code nothing ever reached.** Throwing query stubs, a stale `gen:types`, and two RSC boundary
> crashes all survived lint + typecheck + 895 Vitest + a real `next build`, because the routes sat
> behind a flag seeded OFF. **For a flag-gated phase, "it compiles" and "it works" are unrelated
> claims** — every one was caught by *executing* (a probe, a real E2E run, a fresh reset), none by
> review or build. → [route-gate-assertions.md](docs/testing/route-gate-assertions.md).
