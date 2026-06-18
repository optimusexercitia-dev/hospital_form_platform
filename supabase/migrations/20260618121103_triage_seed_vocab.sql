-- Phase 14b / B4: Patient-Safety / NSP — seed the CONFIGURABLE vocab DEFAULTS into the
-- two config tables (so a `db reset` without seed.sql still has the JC always-review
-- checklist + the NSP/WHO event-type vocabulary). ADR 0030/0032.
--
-- Idempotent (`on conflict (key) do nothing`) so it is safe alongside seed.sql and a
-- re-run. These are DEFAULTS the NSP may rename/archive/extend (the config CRUD, B3);
-- the worksheet's sentinel-flag rows SNAPSHOT key+label, so editing the vocab later
-- never rewrites a past triage decision (viewable-forever).

-- ===========================================================================
-- pqs_sentinel_criteria — the JC "designated categories" (README_triage §1.4)
-- ===========================================================================
insert into public.pqs_sentinel_criteria (key, label, position) values
  ('wrong_site_surgery',  'Cirurgia em local, paciente ou procedimento errado', 1),
  ('retained_object',     'Retenção não intencional de corpo estranho', 2),
  ('suicide_self_harm',   'Suicídio ou autoagressão em ambiente de cuidado assistido', 3),
  ('infant_death',        'Óbito inesperado de recém-nascido a termo', 4),
  ('maternal_morbidity',  'Morbidade materna grave ou óbito materno', 5),
  ('fall_severe_harm',    'Queda com óbito, dano permanente ou grave', 6),
  ('hemolytic_reaction',  'Reação transfusional hemolítica (incompatibilidade maior)', 7),
  ('fire_burn',           'Incêndio, chama ou queimadura inesperada durante o cuidado', 8),
  ('abduction_elopement', 'Sequestro ou evasão de paciente com dano', 9),
  ('wrong_family_discharge', 'Alta de recém-nascido para a família errada', 10)
on conflict (key) do nothing;

-- ===========================================================================
-- pqs_event_types — NSP / WHO event-type vocabulary (defaults)
-- ===========================================================================
insert into public.pqs_event_types (key, label, position) values
  ('fall',              'Queda', 1),
  ('medication',        'Erro de medicação', 2),
  ('hai',               'Infecção relacionada à assistência (IRAS)', 3),
  ('patient_id',        'Falha na identificação do paciente', 4),
  ('surgical',          'Evento cirúrgico / procedimento', 5),
  ('device',            'Falha de dispositivo / equipamento', 6),
  ('transfusion',       'Evento transfusional', 7),
  ('diagnostic',        'Evento laboratorial / diagnóstico', 8),
  ('pressure_injury',   'Lesão por pressão', 9),
  ('care_transition',   'Falha na transição / continuidade do cuidado', 10),
  ('other',             'Outro', 11)
on conflict (key) do nothing;
