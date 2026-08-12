-- =============================================================================
-- Case "Registros" — two new MANUAL kinds: `update` + `follow_up`.
-- Additive, forward-only, reset-OK. No data migration (nothing is re-keyed).
--
-- The manual vocabulary becomes the six-value list that
-- `src/lib/cases/registro-kinds.ts` is the TS mirror of, and that
-- `referral_internal_notes_kind_check` pins on the referral side (next
-- migration). The ten system/procedural kinds are untouched.
--
-- ⚠ `case_events.visibility`, the `case_events_select` narrowing and every write
-- policy are deliberately NOT restated here — this migration widens exactly one
-- CHECK. (A DROP+CREATE of a policy would silently drop the E3a narrowing.)
-- =============================================================================

alter table public.case_events drop constraint case_events_kind_check;
alter table public.case_events add constraint case_events_kind_check
  check (kind = any (array[
    -- manual (authored via CaseEventForm) — `update` + `follow_up` are NEW
    'note', 'meeting', 'decision', 'update', 'follow_up', 'other',
    -- system "registry echo" kinds (deduped off the timeline)
    'interview', 'safety_event',
    -- ethics procedural kinds (E3a; auto-derived by the E2 RPCs)
    'admissibility_decided', 'allegation_added', 'finding_recorded',
    'notification_issued', 'hearing_scheduled', 'vote_cast',
    'decision_issued', 'appeal_submitted'
  ]));

comment on column public.case_events.kind is
  'Registro kind. The SIX manual kinds (note/meeting/decision/update/follow_up/other) are the shared vocabulary mirrored by src/lib/cases/registro-kinds.ts and by referral_internal_notes.kind; the remaining values are system-emitted (registry echoes + E3a ethics procedural events) and are never hand-authored.';
