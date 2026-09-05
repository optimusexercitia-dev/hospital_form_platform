-- Mimics 20261003007190 (BUG-PROF-INACTIVE-001) FAITHFULLY: NO array literal of its own;
-- declares its ONE target with the marker; and mentions `'app.is_active('` twice as a
-- LANDING ASSERTION and a replacement literal, in exactly the quoted-callable shape the
-- array fallback matches.
-- door-sweep-targets: app.can_manage_professional(uuid, uuid)
do $$
declare
  v_fn  constant text := 'app.can_manage_professional(uuid, uuid)';
  v_rep constant text := 'and app.is_active(p_uid)';
  v_src text;
begin
  v_src := pg_get_functiondef(v_fn::regprocedure);
  if position('app.is_active(' in v_src) > 0 then
    raise exception 'already gated - investigate rather than re-run';
  end if;
  perform v_rep;
end $$;
