# ADR 0110 — One Registro vocabulary for cases and referrals

- **Status:** Accepted
- **Date:** 2026-08-12
- **Supersedes:** ADR [0109](./0109-referral-registros-and-case-access-summary.md) **D2** (the
  per-commission `referral_note_types` vocabulary) — the rest of 0109 stands.
- **Migrations:** `20260920000100_case_events_update_follow_up_kinds.sql`,
  `20260920000200_referral_registros_shared_kind_vocabulary.sql`

## Context

The case timeline's "Registros" (`case_events.kind`) offered four hand-authored kinds from a
fixed, CHECK-enforced list. The referral detail's "Registros internos" offered a *different*
thing: a per-commission, admin-maintained label vocabulary (`referral_note_types`, modelled on
`case_narrative_types`, with a snapshot column so a later rename could not rewrite history).
Two surfaces called "Registros", two unrelated type systems.

## Decisions

**D1 — Two kinds added: `update` (Atualização) and `follow_up` (Acompanhamento).** Slugs are
snake_case ASCII like every existing kind (`safety_event`, `follow_up_case`); labels are
resolved in the UI (Rule 10). The ten system/procedural kinds are untouched and remain
non-authorable.

**D2 — The referral files under the CASE vocabulary; `referral_note_types` is deleted.**
`referral_internal_notes.note_type_id`/`type_label` become a single `kind` column with the
identical six-value CHECK. The table, its two RLS policies, its audit trigger, the
`reorder_referral_note_types` RPC, the four vocabulary server actions and the "Tipos de
registro" manage dialog are all gone. Pre-launch, so existing rows take the default rather
than being mapped from their free-text label.

**D3 — The kind is REQUIRED (NOT NULL, default `note`).** The referral's "untyped" state
disappears, matching `case_events`. An omitted or blank `p_kind` resolves to `note`; a value
outside the six raises HC0A9 at the RPC's front door, with the CHECK as the backstop.

**D4 — No snapshot column, because there is nothing left to drift.** `type_label` existed to
survive a vocabulary rename. A fixed, platform-wide list cannot be renamed by a user, so the
label is resolved at render from one source: `src/lib/cases/registro-kinds.ts`. That module is
import-free and side-effect-free so BOTH a `"use client"` component and a server data-access
module can read it — which is what makes one source of truth possible at all. It narrows the
`referrals/types.ts` "ZERO imports" contract to "one inert import", stated in both files.

**D5 — The two writers are DROP + CREATE, not CREATE OR REPLACE.** `p_note_type_id uuid` →
`p_kind text` changes the signature, so the old functions are dropped. A DROP discards the
ACL, so all four `revoke`/`grant` statements are re-issued explicitly and were verified against
the catalog after applying (`prosecdef` and the postgres/service_role/authenticated EXECUTE set
are unchanged). `list_referral_internal_notes` keeps its signature and so keeps its ACL by
construction.

## Consequences

- `list_referral_internal_notes` emits `kind` in place of `note_type_id`/`type_label`; the
  `ReferralInternalNote.kind` field is typed `CaseEventKind`, not `string | null`.
- `referral_internal_notes` has no table-level `authenticated` ACL (0109 D1 — the absence of a
  grant on `body_md` *is* the K-R5-2 hardening), so `kind` needed its own explicit
  `GRANT SELECT (kind)`. A new column without one reads 42501.
- pgTAP `322` §1 is retired (−9 assertions, plan 72 → 63) and `298` GROUP G with it (plan
  36 → 32): both gated policies were dropped, so nothing was left orphaned for `ARM=census`.
  The `kind` domain is now pinned by `322` §2.5 (front door) and §2.9 (CHECK backstop).
- E2E asserts the picker's **exact** six options on the case dialog and on both referral sides.
  A subset assertion would not catch the two surfaces drifting apart, which is the whole point.
- ⚠ `referral-registros.spec.ts` REG-6 no longer asserts the absence of the type label on the
  other side. The vocabulary is shared, so that label legitimately appears in the other side's
  own picker; the cross-side keystone rests on the RUN_TAG'd title and body, as before.
