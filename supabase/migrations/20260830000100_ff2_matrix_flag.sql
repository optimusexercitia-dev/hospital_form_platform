-- FF-2 (ADR 0089) — the `matrix_fields` feature flag.
--
-- Inserted DISABLED. There is deliberately no enable migration in this wave: the
-- production flip is its own migration at the FF-2 gate, exactly as
-- `repeating_groups` was flipped by 20260828000900 at the FF-1 gate.
-- `supabase/seed.sql` turns it ON for local/E2E so the tester and the pgTAP
-- suite have a reachable feature.
--
-- ⚠ The description below states the value AT INSERT and nothing more. This repo
-- has been burned repeatedly by flag descriptions that contradict the `enabled`
-- column — a flag whose text said "Ships OFF" while `enabled = t` was read as
-- proof an authorization arm was inert, and that false claim reached an ADR
-- (ADR 0078 M4). Resolve the VALUE in `enabled`; never this sentence.

insert into app.feature_flags (key, enabled, description)
values (
  'matrix_fields',
  false,
  'Matrix & risk-matrix form items (FF-2, ADR 0089): the matrix/risk_matrix item '
  'types become live — upsert_matrix_axes writes the per-item row/column axes, '
  'the matrix arm of save_section_answers writes answer_matrix_cells / '
  'answer_risk_matrix (risk_score derived server-side as severity.weight * '
  'likelihood.weight), required-ness means row-complete, and clone/correction '
  'carry both through. VALUE AT INSERT: disabled. Flipped for production by its '
  'own migration at the FF-2 gate; seed.sql enables it for local/E2E. Resolve '
  'the VALUE in the enabled column, never this sentence.'
)
on conflict (key) do nothing;
