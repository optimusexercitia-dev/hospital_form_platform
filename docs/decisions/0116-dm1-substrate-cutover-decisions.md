# 0116 — DM1 substrate-cutover decisions (executes ADR 0114 D3/D4/D5/D7)

- **Status:** Accepted (lead-approved plan 2026-08-12:
  `docs/plans/dm1-substrate-cutover-plan.md`; build authorized same day).
- **Scope:** the build-time decisions DM1 made that ADR 0114 left open, plus
  three catalog findings the program documents did not carry. Keystones:
  pgTAP `328`; phase record `docs/progress/dm1-substrate-cutover.md`.

## Decisions

**1. Parked seams instead of column drops.** Four live tables held FKs into
`attachments` that no program document named (`rca_evidence.cited_document_id`,
`referral_shared_item.source_document_id`,
`ethics_decision_details.decision_letter_document_id`,
`ethics_notifications.related_document_id`). DM1 drops the FKs explicitly
(never CASCADE), keeps the columns as PARKED seams, and fail-closes every
writer arm with the minted SQLSTATE **`HC0DM`**. `rca_evidence` additionally
gets `CHECK (cited_document_id IS NULL)` — it is the only seam table with a
live `authenticated` FOR ALL write policy, so the patched writer alone would
not close it. Re-point owners: referral → DM4; RCA citation → Wave D; **ethics
→ OPEN (plan Q1, PO ruling pending — deliberately not assigned a wave)**.
Ethics is in no ADR 0114 D13 wave; that gap is a finding, not a decision.

**2. `securable_resources` uses the participants dialect with roles inverted —
not a fourth dialect.** Anchor `UNIQUE(id, resource_type)`; each domain table
carries a constant `securable_type` column (CHECK-pinned) + composite FK — the
`patient_participants` shape with the four PRE-EXISTING domain tables playing
the satellite role and sharing their PK with the registry row. ⚠ The interview
table is **`case_interviews`** — ADR 0114 D4 says "interviews"; no such
relation exists (the `commission_members`/`case_patient` scar class — verify
against the catalog, never the ADR's noun).

**3. Registry population is a BEFORE INSERT trigger, not command edits.**
Deliberate divergence from the participants precedent (whose anchors are
command-created): documents must attach to rows minted by ~a dozen
pre-existing RPCs, and `app.ensure_securable_resource()` keeps DM1 out of all
of them. Its registry insert uses a **targeted** `ON CONFLICT (id) DO NOTHING`
— required because BEFORE INSERT fires before an outer idempotent
`on conflict do nothing` resolves. The backfill for pre-existing rows is
data-dependent and therefore **invisible to `db reset` forever**; it was
proven on the populated stack (13 rows: 8/3/1/1) before the first post-M2
reset, and pgTAP `328` K3 asserts the anti-join in both directions on both
paths.

**4. Delete semantics: RESTRICT through the registry, CASCADE from tenancy.**
`documents.home_resource_id → securable_resources ON DELETE RESTRICT` + an
AFTER DELETE trigger on each domain table means: deleting a domain row that
still owns documents **fails (23503) and rolls back** — a deliberate
fail-safe, inert in DM1 (zero documents) and witnessed by keystone `328` K3g
with a hand-planted document so DM2 does not discover it in production.
Registry tenant FKs CASCADE so existing commission/org delete flows keep
working; a tenant cascade is still blocked by the same RESTRICT for any
resource that owns documents. Consequence: **from DM2 on, hard-deleting a
case/meeting/interview/action-item requires disposing of its documents first**
— surfaced to the PO via the phase record.

**5. Guards are strict, with no bypass GUC.** `authenticated` holds zero DML
on every new table, so the only writers are DEFINER commands, the service
role, and fixtures — exactly the writers whose bugs the guards exist to catch.
Fixtures walk legal transitions instead of skipping them. Guard SQLSTATEs
(distinct on purpose — a keystone matching them cannot be satisfied by a
neighboring validation error): `HC0D1` illegal file-object transition ·
`HC0D2` immutable write · `HC0D3` blocked by legal hold · `HC0D4` illegal
document transition. D10's "soft-delete honors hold" is enforced in the
document guard, not just the disposal path.

**6. `dispose_case_phi` lost its attachment-redaction step** (the substrate it
wrote to was dropped; zero rows carried bytes). Tracked as **FUP-DM1-DISPOSE**:
DM2 must wire case PHI erasure to document disposition (D10) with a
mutation-proven keystone **before Wave A's flag flips ON**.

**7. Retention values are provisional (O1).** The structure ships with one
catch-all row (CFM 1821/2007 20-year floor, `is_provisional = true`); the
disposal job (DM2+) must refuse to act on provisional rows.

**8. Deviation from the approved plan — SIX kernel doors, not three
(deliberate).** The plan named `can_read_document` / `can_write_document` /
`storage_upload_reserved`. The build added `can_read_document_version`,
`can_read_file_object`, `can_read_document_hold` because the per-table SELECT
policies need DEFINER **resolvers**: an inlined `EXISTS` chain in a policy
qual would query RLS'd tables (`document_versions`, `documents`) with the
CALLER's privileges, recursing through the very policies being evaluated — a
DEFINER resolver reads the chain without recursion and keeps each policy a
single falsifiable expression. All six enter the ADR 0079 census (the phase
record's T7 debt figure is 6, superseding the plan's 3).

**9. Deviation from the approved plan — kernel EXECUTE grants (the plan text
was WRONG; recorded so a plan-vs-catalog diff does not read as a P0).** The
plan said "every DEFINER door … PUBLIC-revoked" and the door section said
revoke from `authenticated`. Taken literally that breaks all eight policies: a
policy predicate is evaluated with the QUERYING role's privileges, so
`authenticated` must hold EXECUTE on every policy-referenced door. Shipped
posture: PUBLIC + `anon` revoked; explicit `authenticated` + `service_role`
EXECUTE — byte-identical to the pre-existing policy-referenced siblings
(`app.can_read_snapshot_document`, `app.can_read_case`, …). Safe because the
`app` schema is not PostgREST-exposed (`config.toml` exposes only `public`)
and **zero `public`-schema functions reference any of the six doors**
(comment-stripped `prosrc` sweep, 2026-08-12) — the only reachable paths are
policy evaluation and future DEFINER commands.

**10. DM1 dropped an ENFORCEMENT MECHANISM whose replacement is unspecified —
the confidentiality-label ceiling (⚠ visible from this record, not only from
the follow-up file).** `app.attachment_confidentiality_ok` + the
`confidentiality_label` column + the `HC0E6` open-door arm enforced ADR 0072
D7's per-document ceiling (`legal_privileged` / `credentialing_sensitive`
gated ABOVE ordinary case-read; clearance via
`case_access_grants.max_confidentiality`). The document model carries no
successor: `sensitivity_tier` selects a bucket, not a ceiling, and ADR 0114 D6
defers only the WIDENING (audience) plane — this is a NARROWING control, and
ADR 0114 does not supersede ADR 0072. **FUP-DM1-CEILING (🔴) blocks DM2 Wave A
until a PO ruling lands as an ADR 0114 amendment.** The retired keystones (228
tests 36–40, E2E AC-4a–d/AC-9) return with the control, not before.

## Consequences

- The `%attachment%` catalog surface is exactly the named DM4 allowlist
  (pinned by name in `328` K2, incl. the two non-`%attachment%` entries
  `case_documents_select_member` + `app.can_read_snapshot_document`); DM4
  empties it and re-runs the sweep at zero exceptions.
- Six E2E specs park until DM2's rewrite (FUP-DM1-E2E, each named).
- The `attachments` feature-flag key survives, verbless, until DM2 retires it.
- The `attachments`/`attachments-phi` bucket rows survive until DM5's single
  retirement manifest.
