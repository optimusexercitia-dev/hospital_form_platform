-- ----------------------------------------------------------------------------
-- Consolidated baseline — seeded reference data (folded to live end-state)
-- ----------------------------------------------------------------------------
-- Migration-seeded reference rows the schema dump (Workstream 0 source of truth)
-- does not carry: the app.feature_flags rows are folded to their LIVE end-state
-- (every flag ON — no per-phase flip migrations in a baseline; app.feature_flags
-- + app.feature_enabled() semantics are unchanged), plus the JC/WHO triage
-- vocabularies (pqs_event_types, pqs_sentinel_criteria). This is reference/config
-- data only. The dev/E2E fixture data — including the pqs_department singleton —
-- stays in supabase/seed.sql (the original migrations never seeded it).
-- Idempotent (ON CONFLICT) so a re-apply is safe.

-- app.feature_flags
INSERT INTO app.feature_flags (key, enabled, description) VALUES ('signoff_enforcement', true, 'When true, submit_response requires a sign-off row for every visible requires_signoff section. Enabled in Phase 6.')
  ON CONFLICT (key) DO NOTHING;
INSERT INTO app.feature_flags (key, enabled, description) VALUES ('cases_multi_phase', true, 'When true, the multi-phase cases RPCs (template lifecycle, case creation, phase activation/skip/ad-hoc/reassign/fill, close/cancel, board reads) are live. Enabled at Phase 7 completion.')
  ON CONFLICT (key) DO NOTHING;
INSERT INTO app.feature_flags (key, enabled, description) VALUES ('cases_extras', true, 'When true, the Cases-Extras write RPCs (configurable case status set + set_case_status, documents/events, tags, action items) are live. The modified core phase RPCs keep gating only cases_multi_phase. Enabled at the end of the Cases-Extras batch.')
  ON CONFLICT (key) DO NOTHING;
INSERT INTO app.feature_flags (key, enabled, description) VALUES ('meetings', true, 'When true, the Meetings feature (scheduling, minutes/ata registry, attendance/quorum, cases discussed, action plans, attachments, internal electronic signatures, pending-signatures) is live. Enabled at Phase 10 completion.')
  ON CONFLICT (key) DO NOTHING;
INSERT INTO app.feature_flags (key, enabled, description) VALUES ('interviews', true, 'When true, the Interviews feature (case-scoped interviews of healthcare professionals: scheduling, lifecycle, interviewees + interviewers, evidence attachments, conclusion writing a case_events registry row) is live. Enabled at Phase 11 completion.')
  ON CONFLICT (key) DO NOTHING;
INSERT INTO app.feature_flags (key, enabled, description) VALUES ('audit_trail', true, 'When true, the append-only tamper-evident audit trail is live: every instrumented mutation emits one hash-chained audit_log row, sensitive foreign reads/exports emit .read/.export rows, and verify_audit_chain checks integrity. Enabled at Phase 13 completion (Architecture Rule 11).')
  ON CONFLICT (key) DO NOTHING;
INSERT INTO app.feature_flags (key, enabled, description) VALUES ('patient_safety', true, 'When true, the Patient-Safety / NSP module (event intake & hand-off with isolated PHI + a custody ledger [14a], triage [14b], RCA [14c], CAPA [14d]) is live: the notify/acknowledge/transfer/PHI RPCs run, the access-follows-custody RLS + PHI isolation apply, and PHI reads emit .read audit rows (Rule 12). Enabled at Phase 14a completion; the single umbrella flag for all of Phase 14 (ADR 0030).')
  ON CONFLICT (key) DO NOTHING;
INSERT INTO app.feature_flags (key, enabled, description) VALUES ('case_narratives', true, 'When true, the Case Narratives feature (per-commission narrative TYPES, per-template narrative SLOTS interleaved with phases, and per-case de-identified Markdown prose authored inline and frozen on case close) is live. Enabled at Case Narratives completion.')
  ON CONFLICT (key) DO NOTHING;
INSERT INTO app.feature_flags (key, enabled, description) VALUES ('case_access', true, 'When true, the Case Access Control feature (per-case read/write grants via case_access, attribution-driven full-case read computed in app.can_read_case, the narrative assignee + aberta/concluida lifecycle, and the "Meus Casos" list) is live. While OFF, app.can_read_case falls back to is_member_of so the restrictive boundary does not bite. Enabled at Case Access Control completion.')
  ON CONFLICT (key) DO NOTHING;

-- public.pqs_event_types
INSERT INTO public.pqs_event_types (id, key, label, description, "position", is_active, created_at, updated_at) VALUES ('5e8778b5-de41-4926-8972-b23de6efae97', 'fall', 'Queda', NULL, 1, true, '2026-06-20 16:29:54.571345+00', '2026-06-20 16:29:54.571345+00')
  ON CONFLICT (id) DO NOTHING;
INSERT INTO public.pqs_event_types (id, key, label, description, "position", is_active, created_at, updated_at) VALUES ('21aa54f3-1c99-4f70-bd96-eb40af317008', 'medication', 'Erro de medicação', NULL, 2, true, '2026-06-20 16:29:54.571345+00', '2026-06-20 16:29:54.571345+00')
  ON CONFLICT (id) DO NOTHING;
INSERT INTO public.pqs_event_types (id, key, label, description, "position", is_active, created_at, updated_at) VALUES ('e522af86-3265-483c-9aa7-d67dbc80dbe8', 'hai', 'Infecção relacionada à assistência (IRAS)', NULL, 3, true, '2026-06-20 16:29:54.571345+00', '2026-06-20 16:29:54.571345+00')
  ON CONFLICT (id) DO NOTHING;
INSERT INTO public.pqs_event_types (id, key, label, description, "position", is_active, created_at, updated_at) VALUES ('5f8d70b1-7390-4ca6-89e0-dca0da7a6be9', 'patient_id', 'Falha na identificação do paciente', NULL, 4, true, '2026-06-20 16:29:54.571345+00', '2026-06-20 16:29:54.571345+00')
  ON CONFLICT (id) DO NOTHING;
INSERT INTO public.pqs_event_types (id, key, label, description, "position", is_active, created_at, updated_at) VALUES ('7a66a609-ed9d-44e4-adeb-24c7fec2e987', 'surgical', 'Evento cirúrgico / procedimento', NULL, 5, true, '2026-06-20 16:29:54.571345+00', '2026-06-20 16:29:54.571345+00')
  ON CONFLICT (id) DO NOTHING;
INSERT INTO public.pqs_event_types (id, key, label, description, "position", is_active, created_at, updated_at) VALUES ('c87f516b-5eef-46d0-9cb9-282b1d1c2346', 'device', 'Falha de dispositivo / equipamento', NULL, 6, true, '2026-06-20 16:29:54.571345+00', '2026-06-20 16:29:54.571345+00')
  ON CONFLICT (id) DO NOTHING;
INSERT INTO public.pqs_event_types (id, key, label, description, "position", is_active, created_at, updated_at) VALUES ('0e8ccd8b-ca4c-4ffc-80ce-86e6cae8ca7e', 'transfusion', 'Evento transfusional', NULL, 7, true, '2026-06-20 16:29:54.571345+00', '2026-06-20 16:29:54.571345+00')
  ON CONFLICT (id) DO NOTHING;
INSERT INTO public.pqs_event_types (id, key, label, description, "position", is_active, created_at, updated_at) VALUES ('c5f6f0ff-3399-44fa-98b7-990762e1e854', 'diagnostic', 'Evento laboratorial / diagnóstico', NULL, 8, true, '2026-06-20 16:29:54.571345+00', '2026-06-20 16:29:54.571345+00')
  ON CONFLICT (id) DO NOTHING;
INSERT INTO public.pqs_event_types (id, key, label, description, "position", is_active, created_at, updated_at) VALUES ('51158544-1f13-41bc-baaa-74d62971033b', 'pressure_injury', 'Lesão por pressão', NULL, 9, true, '2026-06-20 16:29:54.571345+00', '2026-06-20 16:29:54.571345+00')
  ON CONFLICT (id) DO NOTHING;
INSERT INTO public.pqs_event_types (id, key, label, description, "position", is_active, created_at, updated_at) VALUES ('ec2d8e8f-4e46-452a-acc4-b8acbac76515', 'care_transition', 'Falha na transição / continuidade do cuidado', NULL, 10, true, '2026-06-20 16:29:54.571345+00', '2026-06-20 16:29:54.571345+00')
  ON CONFLICT (id) DO NOTHING;
INSERT INTO public.pqs_event_types (id, key, label, description, "position", is_active, created_at, updated_at) VALUES ('6aff565a-758d-4a22-87ba-72990ba0a2d2', 'other', 'Outro', NULL, 11, true, '2026-06-20 16:29:54.571345+00', '2026-06-20 16:29:54.571345+00')
  ON CONFLICT (id) DO NOTHING;

-- public.pqs_sentinel_criteria
INSERT INTO public.pqs_sentinel_criteria (id, key, label, description, "position", is_active, created_at, updated_at) VALUES ('b49cf0f9-e93f-4edd-b875-8ddcd955fe65', 'wrong_site_surgery', 'Cirurgia em local, paciente ou procedimento errado', NULL, 1, true, '2026-06-20 16:29:54.571345+00', '2026-06-20 16:29:54.571345+00')
  ON CONFLICT (id) DO NOTHING;
INSERT INTO public.pqs_sentinel_criteria (id, key, label, description, "position", is_active, created_at, updated_at) VALUES ('5616761a-fb4d-484c-96bd-fe6ae0432971', 'retained_object', 'Retenção não intencional de corpo estranho', NULL, 2, true, '2026-06-20 16:29:54.571345+00', '2026-06-20 16:29:54.571345+00')
  ON CONFLICT (id) DO NOTHING;
INSERT INTO public.pqs_sentinel_criteria (id, key, label, description, "position", is_active, created_at, updated_at) VALUES ('436dac01-c9ee-45e4-aaa3-c3a1958bfb10', 'suicide_self_harm', 'Suicídio ou autoagressão em ambiente de cuidado assistido', NULL, 3, true, '2026-06-20 16:29:54.571345+00', '2026-06-20 16:29:54.571345+00')
  ON CONFLICT (id) DO NOTHING;
INSERT INTO public.pqs_sentinel_criteria (id, key, label, description, "position", is_active, created_at, updated_at) VALUES ('2208090e-e41a-4334-85c4-62a9a2f6399e', 'infant_death', 'Óbito inesperado de recém-nascido a termo', NULL, 4, true, '2026-06-20 16:29:54.571345+00', '2026-06-20 16:29:54.571345+00')
  ON CONFLICT (id) DO NOTHING;
INSERT INTO public.pqs_sentinel_criteria (id, key, label, description, "position", is_active, created_at, updated_at) VALUES ('9f3f1c1a-8baf-4dce-b544-9c923fda74bb', 'maternal_morbidity', 'Morbidade materna grave ou óbito materno', NULL, 5, true, '2026-06-20 16:29:54.571345+00', '2026-06-20 16:29:54.571345+00')
  ON CONFLICT (id) DO NOTHING;
INSERT INTO public.pqs_sentinel_criteria (id, key, label, description, "position", is_active, created_at, updated_at) VALUES ('9e51cf62-e9a1-402e-b986-cd6220b58e54', 'fall_severe_harm', 'Queda com óbito, dano permanente ou grave', NULL, 6, true, '2026-06-20 16:29:54.571345+00', '2026-06-20 16:29:54.571345+00')
  ON CONFLICT (id) DO NOTHING;
INSERT INTO public.pqs_sentinel_criteria (id, key, label, description, "position", is_active, created_at, updated_at) VALUES ('ba99bf31-682e-4738-a175-b1d4d1eae167', 'hemolytic_reaction', 'Reação transfusional hemolítica (incompatibilidade maior)', NULL, 7, true, '2026-06-20 16:29:54.571345+00', '2026-06-20 16:29:54.571345+00')
  ON CONFLICT (id) DO NOTHING;
INSERT INTO public.pqs_sentinel_criteria (id, key, label, description, "position", is_active, created_at, updated_at) VALUES ('20ec2a58-5cb3-4ba4-8166-bf388a777656', 'fire_burn', 'Incêndio, chama ou queimadura inesperada durante o cuidado', NULL, 8, true, '2026-06-20 16:29:54.571345+00', '2026-06-20 16:29:54.571345+00')
  ON CONFLICT (id) DO NOTHING;
INSERT INTO public.pqs_sentinel_criteria (id, key, label, description, "position", is_active, created_at, updated_at) VALUES ('a62af2e1-efa5-4570-82fc-3d21378ffe6b', 'abduction_elopement', 'Sequestro ou evasão de paciente com dano', NULL, 9, true, '2026-06-20 16:29:54.571345+00', '2026-06-20 16:29:54.571345+00')
  ON CONFLICT (id) DO NOTHING;
INSERT INTO public.pqs_sentinel_criteria (id, key, label, description, "position", is_active, created_at, updated_at) VALUES ('fffb7a2a-0bd8-4107-adaa-a4274707d9d6', 'wrong_family_discharge', 'Alta de recém-nascido para a família errada', NULL, 10, true, '2026-06-20 16:29:54.571345+00', '2026-06-20 16:29:54.571345+00')
  ON CONFLICT (id) DO NOTHING;

