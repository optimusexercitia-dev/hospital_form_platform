-- Mimics 20261003007180: a runtime-rewrite migration that names its targets in an ARRAY.
-- ⚠ It must NOT mention `app.is_active(` anywhere — fixture 11 is the only file that does,
--   and the whole point of the pair is that 11's mention is a replacement literal in a file
--   with no array of its own.
do $$
declare v_fns text[] := array[
  'app.can_manage_professional(uuid, uuid)',
  'app.can_read_professional_profile(uuid, uuid)'
];
begin
  perform pg_get_functiondef('app.can_manage_professional(uuid, uuid)'::regprocedure), v_fns;
end $$;
