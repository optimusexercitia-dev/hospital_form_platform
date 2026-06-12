-- Condition evaluator (app.eval_condition) — the SQL side of the SQL<->TS
-- mirror. These vectors MUST stay identical to
-- src/lib/queries/__fixtures__/condition-vectors.json (consumed by the Vitest
-- mirror). Drift between the two evaluators is a phase-blocking bug
-- (ARCHITECTURE Rule 3). Covers all three ops, null condition, missing/null
-- answers, and checkbox-array answers.

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
  ('equals boolean', '{"question_key":"q1","op":"equals","value":true}', '{"q1":true}', true);

select plan((select count(*)::int from vectors));

select is(
  app.eval_condition(v.visible_when, v.answers),
  v.expected,
  v.name
) from vectors v;

select * from finish();
rollback;
