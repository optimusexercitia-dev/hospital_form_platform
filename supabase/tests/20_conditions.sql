-- Condition evaluator (app.eval_condition + app.eval_visibility) — the SQL side
-- of the SQL<->TS mirror. These vectors MUST stay identical to
-- src/lib/queries/__fixtures__/condition-vectors.json AND
-- src/lib/queries/__fixtures__/visibility-vectors.json (consumed by the Vitest
-- mirror). Drift between the two evaluators is a phase-blocking bug
-- (ARCHITECTURE Rule 3). Covers all ops (incl. gt/gte/lt/lte), null condition,
-- missing/null answers, checkbox-array answers, and the AND/OR group wrapper.

begin;

create temp table vectors (name text, visible_when jsonb, answers jsonb, expected boolean)
  on commit drop;

insert into vectors (name, visible_when, answers, expected) values
  ('null condition is always visible', null, '{"q1":"Sim"}', true),
  ('equals match', '{"question_key":"q1","op":"equals","value":"Sim"}', '{"q1":"Sim"}', true),
  ('equals mismatch', '{"question_key":"q1","op":"equals","value":"Sim"}', '{"q1":"Não"}', false),
  ('equals missing answer is false', '{"question_key":"q1","op":"equals","value":"Sim"}', '{}', false),
  ('equals null answer is false', '{"question_key":"q1","op":"equals","value":"Sim"}', '{"q1":null}', false),
  ('not_equals mismatch is true', '{"question_key":"q1","op":"not_equals","value":"Sim"}', '{"q1":"Não"}', true),
  ('not_equals match is false', '{"question_key":"q1","op":"not_equals","value":"Sim"}', '{"q1":"Sim"}', false),
  ('not_equals missing answer is true', '{"question_key":"q1","op":"not_equals","value":"Sim"}', '{}', true),
  ('in match scalar', '{"question_key":"q1","op":"in","value":["A","B","C"]}', '{"q1":"B"}', true),
  ('in mismatch scalar', '{"question_key":"q1","op":"in","value":["A","B","C"]}', '{"q1":"D"}', false),
  ('in missing answer is false', '{"question_key":"q1","op":"in","value":["A","B"]}', '{}', false),
  ('equals checkbox present', '{"question_key":"q1","op":"equals","value":"luvas"}', '{"q1":["luvas","avental"]}', true),
  ('equals checkbox absent', '{"question_key":"q1","op":"equals","value":"mascara"}', '{"q1":["luvas","avental"]}', false),
  ('not_equals checkbox absent is true', '{"question_key":"q1","op":"not_equals","value":"mascara"}', '{"q1":["luvas","avental"]}', true),
  ('in checkbox any in list', '{"question_key":"q1","op":"in","value":["mascara","avental"]}', '{"q1":["luvas","avental"]}', true),
  ('in checkbox none in list', '{"question_key":"q1","op":"in","value":["mascara","touca"]}', '{"q1":["luvas","avental"]}', false),
  ('equals numeric', '{"question_key":"q1","op":"equals","value":3}', '{"q1":3}', true),
  ('equals boolean', '{"question_key":"q1","op":"equals","value":true}', '{"q1":true}', true),
  -- form-builder-enhancements: ordered ops gt/gte/lt/lte (mirror the JSON fixture).
  ('gt numeric true', '{"question_key":"q1","op":"gt","value":5}', '{"q1":7}', true),
  ('gt numeric false (equal)', '{"question_key":"q1","op":"gt","value":5}', '{"q1":5}', false),
  ('gte numeric true (equal)', '{"question_key":"q1","op":"gte","value":5}', '{"q1":5}', true),
  ('gte numeric false', '{"question_key":"q1","op":"gte","value":5}', '{"q1":4}', false),
  ('lt numeric true', '{"question_key":"q1","op":"lt","value":5}', '{"q1":3}', true),
  ('lte numeric true (equal)', '{"question_key":"q1","op":"lte","value":5}', '{"q1":5}', true),
  ('gt numeric with negatives', '{"question_key":"q1","op":"gt","value":-3}', '{"q1":-1}', true),
  ('gte numeric with decimals', '{"question_key":"q1","op":"gte","value":2.5}', '{"q1":2.5}', true),
  ('gt missing answer is false', '{"question_key":"q1","op":"gt","value":5}', '{}', false),
  ('lt null answer is false', '{"question_key":"q1","op":"lt","value":5}', '{"q1":null}', false),
  ('gt array (checkbox) answer never orders, false', '{"question_key":"q1","op":"gt","value":1}', '{"q1":[2,3]}', false),
  ('gte ISO date string sorts as text, true', '{"question_key":"q1","op":"gte","value":"2026-01-01"}', '{"q1":"2026-06-23"}', true),
  ('lt ISO date string sorts as text, false', '{"question_key":"q1","op":"lt","value":"2026-01-01"}', '{"q1":"2026-06-23"}', false),
  ('lt ISO date boundary (strictly before)', '{"question_key":"q1","op":"lt","value":"2026-06-23"}', '{"q1":"2026-06-22"}', true),
  ('gt 24h time string sorts as text, true', '{"question_key":"q1","op":"gt","value":"08:00"}', '{"q1":"14:30"}', true),
  ('lte 24h time string equal, true', '{"question_key":"q1","op":"lte","value":"23:59"}', '{"q1":"23:59"}', true);

-- Visibility GROUP vectors (mirror visibility-vectors.json), exercised against
-- app.eval_visibility (the AND/OR wrapper + legacy-single passthrough).
create temp table visibility_vectors (name text, rule jsonb, answers jsonb, expected boolean)
  on commit drop;

insert into visibility_vectors (name, rule, answers, expected) values
  ('null rule is always visible', null, '{"q1":"Sim"}', true),
  ('legacy single shape delegates (match)', '{"question_key":"q1","op":"equals","value":"Sim"}', '{"q1":"Sim"}', true),
  ('legacy single shape delegates (mismatch)', '{"question_key":"q1","op":"equals","value":"Sim"}', '{"q1":"Não"}', false),
  ('all: both true', '{"match":"all","conditions":[{"question_key":"q1","op":"equals","value":"Sim"},{"question_key":"q2","op":"gt","value":5}]}', '{"q1":"Sim","q2":7}', true),
  ('all: one false short-circuits to false', '{"match":"all","conditions":[{"question_key":"q1","op":"equals","value":"Sim"},{"question_key":"q2","op":"gt","value":5}]}', '{"q1":"Sim","q2":3}', false),
  ('all: missing answer for one is false', '{"match":"all","conditions":[{"question_key":"q1","op":"equals","value":"Sim"},{"question_key":"q2","op":"gte","value":1}]}', '{"q1":"Sim"}', false),
  ('any: one true is true', '{"match":"any","conditions":[{"question_key":"q1","op":"equals","value":"Sim"},{"question_key":"q2","op":"gt","value":100}]}', '{"q1":"Sim","q2":3}', true),
  ('any: all false is false', '{"match":"any","conditions":[{"question_key":"q1","op":"equals","value":"Sim"},{"question_key":"q2","op":"gt","value":100}]}', '{"q1":"Não","q2":3}', false),
  ('any: single condition true', '{"match":"any","conditions":[{"question_key":"q1","op":"in","value":["A","B"]}]}', '{"q1":"B"}', true),
  ('all: three conditions incl. date + checkbox, all true', '{"match":"all","conditions":[{"question_key":"q1","op":"not_equals","value":"Não"},{"question_key":"q2","op":"lte","value":"2026-12-31"},{"question_key":"q3","op":"equals","value":"luvas"}]}', '{"q1":"Sim","q2":"2026-06-23","q3":["luvas","avental"]}', true),
  ('all: date out of range makes group false', '{"match":"all","conditions":[{"question_key":"q1","op":"not_equals","value":"Não"},{"question_key":"q2","op":"lte","value":"2026-12-31"}]}', '{"q1":"Sim","q2":"2027-01-01"}', false);

select plan(
  (select count(*)::int from vectors)
  + (select count(*)::int from visibility_vectors)
);

select is(
  app.eval_condition(v.visible_when, v.answers),
  v.expected,
  v.name
) from vectors v;

select is(
  app.eval_visibility(vv.rule, vv.answers),
  vv.expected,
  'visibility: ' || vv.name
) from visibility_vectors vv;

select * from finish();
rollback;
