-- door-sweep-targets: authz.has_permission(uuid, text, uuid, text)
--                     authz.candidate_has_permission(uuid, text, uuid, text)
--                     authz.explain_permission(uuid, text, uuid, text)
--                     authz.entailed_grants(uuid, text, uuid, text)
--
-- ⚠ NO `pg_get_functiondef` and NO `create function` anywhere: the declaration path is the
-- ONLY path that can reach these four. That is the whole point of the fixture.
select 1;
