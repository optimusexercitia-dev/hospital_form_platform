# GRANT-PLANE-CONVENTION — progress record

The per-object grant plane convention, ADR
[0205](../decisions/0205-per-object-grant-plane-convention.md). The unit's **summary** is its hub,
[docs/features/grant-plane-convention.md](../features/grant-plane-convention.md) § Current state;
this file is its **log** (ADR 0186 D3): one dated subsection per session, appended.

Subjects: `public.case_access_grants` and everything that reads it, `app._case_caps` S3,
`public.grant_case_access` / `revoke_case_access` / `list_case_access`, `app.is_tenancy_admin_of_for`,
`app.grant_role_impl`'s commission branch, `src/lib/case-access/actions.ts`, the nine other
grant-shaped tables classified in ADR 0205 D11, the `authz` catalog (5 tables; `scope_kind` and
`resolution_scope_kind` domains; `assignment_facts`, `entailed_grants`, `has_permission`),
`securable_resources` (9 types), and the seam file `docs/backend-state/cases-and-ethics.md` — all as
they exist in the **live catalog** (⛔ never migration text — ADR 0078).

## Session log

### 2026-09-10 — analysis, grilling, ADR, and the two pre-pilot fixes opened (lead)

**Preconditions, measured:** `main` @ `eb52f1c1`, tree clean; migration head `20261003007360`;
highest pgTAP `415`; `docs/decisions/INDEX.md` next-free `0204` **reserved** by
`docs/plans/pre-ae5-remediation.md` (the `D` ceiling / `search_path` pair) and `0202` an unfillable
hole ⇒ this ADR is **0205**, as that plan instructs.

**What was measured before anything was decided** (two Explore agents + lead catalog reads):
the case ledger's 18 columns / 12 CHECKs / 3 partial indexes / own-row policy / `authenticated = r`
ACL; `_case_caps` with sources S1–S8; consumer surface `can_read_case` 18 policies,
`can_write_case_content` 3, `is_case_excluded` 16, `has_case_capability` 0 policies (12 functions);
**seven** direct readers of the ledger outside the resolver; 27 pgTAP files; the nine other
grant-shaped tables and which policy/predicate consumes each (`referral_assignments`: none, by
ruling); the `authz` catalog at 12 roles / 43 permissions / 42 role-permission rows, resolution
kinds `commission` + `organization` only, `assignment_facts` reading `memberships` + `is_admin`
only; `securable_resources` pinning every referral to its **source** commission (3/3 seed rows);
`meetings.visibility_policy ∈ {commission_default, participants_only}` with reach = member ∧
(default ∨ attendee); `can_read_interview` = case read ∧ ¬oversight-only ∧ clearance;
`grant_role_impl`: only a tenancy admin seats a `staff_admin`, no self-seat, no last-coordinator
guard; **two** seeded coordinator-less commissions (Ética, Segurança A2); the org-admin door arm's
recorded reason in ADR 0078 (*sole coordinator recused/respondent*), not the absent coordinator;
`authorizeCommission` admits `platform_admin` (door refuses) and omits tenancy admins (door accepts);
the door's PHI parameters sent by no TS caller. Dead end recorded: the first grep for the
deadlock rationale hit only D5·6's restricted-PHI "deadlock"; the door arm's reason lives ~1,000
lines later under *"The deadlock, and the PO's resolution"*.

**The grilling.** Round 1 (Q1–Q10): goal order, root-only ledgers, participation never mirrored,
catalog-named abilities, five mandatory columns, grantee rule, timing, the two case fixes, scope,
audit convention — all accepted except Q8, where the PO first chose to **remove** the org-admin arm
on the premise "a commission always has a coordinator". Round 2 re-asked Q8 with the measured
reason (the recused sole coordinator) → the PO **kept the arm** (a); asked whether to *enforce*
coordinator presence → PO chose **practice, not rule** (b); settled Q11–Q20 (app check mirrors the
door; narrowing read-only; attendees keep implicit read + reserved-session list folds in; referral
receiving side only; allow-list for the two capability planes; scaffold as a script; roster with the
first ledger; two-level UI; door refuses terminal write grants). Round 3 (Q21–Q26): fallback arm on
every root's door; administrativo never grants; typed provenance FKs; Fix 1 pre-pilot; ADR + rule
file; the three code-less case abilities stay domain-only. PO: *"Agreed. Proceed."*

**Written this session:** ADR 0205 (237 lines; Amends 0155 D7 and 0078 on three named points) ·
`.claude/rules/grant-plane-convention.md` (scoped `supabase/migrations/**`, four anchors) ·
`docs/phases/accreditation-track.md` Phase 18 + Phase 19 · `docs/quality-track-context.md` Phase 18
line · `FUP-GRANT-PLANE-CONVENTION-BUILD-AFTER-AE5` (parked) · this hub + record.

**Delegated:** `backend` (Opus) — Fix 1 (`20261003007370`, D9 door refusal, live-body re-emit,
new `HC` code), Fix 2 (`authorizeCommission` mirrors the door via `src/lib/queries/`), pgTAP `416`
RED-first, the seam slice, and the gate commands reported bare. Its report is appended below when
it lands.
