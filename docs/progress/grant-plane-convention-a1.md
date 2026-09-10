# GRANT-PLANE-CONVENTION-A1 — progress record

ADR [0205](../decisions/0205-per-object-grant-plane-convention.md) § Amendment 1 and Fix 3. The
unit's **summary** is its hub,
[docs/features/grant-plane-convention-a1.md](../features/grant-plane-convention-a1.md) § Current
state; this file is its **log** (ADR 0186 D3): one dated subsection per session, appended.

Subjects: ADR 0205 (amended in place), `public.grant_case_access` (the public door only — the
INVOKER kernel, `create_case` and `revoke_case_access` are out of scope), `src/lib/case-access/actions.ts`,
`src/components/cases/case-access-panel.tsx`, `.claude/rules/grant-plane-convention.md`, the two
grant-plane follow-ups, `docs/phases/accreditation-track.md` (Phase 18), PROGRESS.md § Phase Status,
and the seam file `docs/backend-state/cases-and-ethics.md` — all as they exist in the **live
catalog** (⛔ never migration text — ADR 0078).

## Session log

### 2026-09-10 — the audit re-derived, the amendment grilled and written, Fix 3 opened (lead)

**Preconditions, measured:** `main` @ `021987e7`, tree clean but for the untracked audit file;
migration head `20261003007370`; container `supabase_db_azkbbhskturikxpgmafq`.

**The audit, re-derived on the live catalog** — every claim checked against `pg_get_functiondef`,
`information_schema`, `pg_constraint` and the seed, never the migration files the audit cites:

- **F1 cardinality** — text-level, confirmed: D4 "rows named by code" against the reference ledger's
  one boolean row; D5's unique tuple silent on the ability.
- **F2 referral anchor** — confirmed: `app.ensure_securable_resource_referral` stamps
  `commission_id = new.source_commission_id` plus the source's org/hospital; 4/4 seeded referrals
  anchored on source, 0 on target. Found on the way, missed by the audit: `case_referral.target_type
  = 'technical_director'` carries a `target_hospital_id` and NO commission — D6·1 undefined there.
- **F3 narrowing** — half: `securable_resources` has the typed composite key `(id, resource_type)`
  and `action_items` FKs it today (the audit's *"cannot be typed"* is false for this dialect); but
  the registry has no parent column, and agenda items / closed-session items / document versions
  are outside its type domain. `action_items.source_type ∈ {meeting, manual, case}`, `linked_case_id`
  only with meeting-sourced — two candidate roots / no root, confirmed on the CHECK.
- **F4 self-grant** — confirmed on the live door body: authority (42501) → `assert_not_case_excluded`
  → level → `is_member_of_for` (HC021) → future expiry → `case_is_terminal` (HC0U0) → kernel; no
  `p_user = auth.uid()` comparison; the door's own comment names grantee membership as the
  self-escalation guard. Resolver S2 = `manage_case_access` ONLY for a tenancy admin ⇒ the audit's
  *"not an escalation"* is wrong on that arm (a tenancy admin holding a plain membership).
- **F5 tenancy-admin path** — confirmed and already filed: `commissionOfCase` reads `cases` through
  RLS and `cases_select` = `can_read_case`; the internal review § 7 had graded it a pre-existing
  gap. The audit's addition is the copy risk into the shared factory (the build FUP says "lifted from").
- **Additional concerns** — D5 lists seven names (confirmed); `resolution_scope_kind` domain =
  `organization | hospital | commission` and `has_permission` fails closed on mismatch (confirmed —
  so D12's "mechanical" contradicted the ADR's own Option D); Phase 18 line 671 still said
  "per-round auditor write grant" (confirmed); "centralization described as decided" — no such text
  in the hub, rule file or phase docs (no action).

**Facts fetched in parallel** (Explore agent): in-place amendment is this repo's convention, in two
forms (`**Amended (date):**` header line — 0073; `## Amendment N — title` sections — 0061, 0125,
0137), both inert to `build-adr-index.mjs` (passive voice deliberately unmatched); a hub
`complete → in_progress` regression is ungoverned by `check-docs-registers.mjs` and unprecedented —
the precedent is a new unit code; a `complete` hub whose `reviews:` cites a non-APPROVED verdict reds
gate 13 (`HUBS complete via review NOT APPROVED reds`); the tenancy-admin commission page is
`src/app/o/[org]/manage/comissoes/[commissionSlug]/page.tsx`. Lead-measured: `npm run lint:registers`
rc=0 with the untracked audit file in `docs/reviews/`.

**Grilling:** two rounds, 16 questions (Q1–Q10 rulings + amendment mechanics; Q11–Q16 the
dependent decisions); the PO agreed with every recommendation. Rulings: ADR 0205 § Amendment 1
(D2·2, D4·2, D5·2, D6·5, D7·2, D12·2). Stated-without-asking assumptions accepted: unit code
`grant-plane-convention-a1`; the parent reference is a typed composite; backend picks the HC code;
the keystone's subject is the exploit persona; three commits straight on `main`.

**Written this session (commit 1):** ADR 0205 § Amendment 1 + six ⚠ markers + the header line + the
two in-place editorial corrections; the audit file committed verbatim; the rule file's one-liners;
the Phase 18 line; the tenancy-admin FUP archived, the build FUP's *Closes when* widened; the
PROGRESS row; this hub + record; `adr:index` / `features:index` regenerated. Gate witnesses for
commit 1 are appended below.

**Fix 3 opened:** `backend` (migration re-emitted from the live def, RED-first pgTAP, `actions.ts`
mapping + unit test) ∥ `frontend` (picker excludes the actor) — disjoint files. Gate and QA to
follow; witnesses appended here.

**Gate witness, commit 1 (docs only):** `npm run lint` **rc=0**, taken bare after one red — `check-rules-staleness` refused the rule file at 2407 bytes (cap 2048); the one-liners were tightened to 1998 bytes and the chain re-run. Registers gate: 22 hubs · 19 records · 227 open + 156 archived follow-ups (one moved); `adr:index` 201 ADRs, next free 0206, back-pointers current; `features:index` 22 hubs. `typecheck` / `test` / `test:db` not run: no code changed in this commit.
