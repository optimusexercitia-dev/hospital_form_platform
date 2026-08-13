-- Gate-2 fix: three meeting write RPCs regained PUBLIC EXECUTE (anon-executable).
-- Root cause: Stage-C Wave 2's return-type change (returns uuid) forced DROP+CREATE, which
-- reset each ACL to the default PUBLIC-EXECUTE; the binding REVOKE-FROM-PUBLIC +
-- GRANT-authenticated hygiene pattern was not re-applied. This fails 100_dashboard t19 and
-- violates the public-RPC hygiene rule (not exploitable — anon 401s at the app-schema
-- helper first — but a real regression). Re-apply the pattern, mirroring the correctly-set
-- open_reserved_session / add_reserved_item (anon_exec=f). Catalog-verified exact args.

revoke all on function public.create_meeting_agenda_item(uuid, text, text, text, text) from public;
grant execute on function public.create_meeting_agenda_item(uuid, text, text, text, text) to authenticated, service_role;

revoke all on function public.link_meeting_case(uuid, uuid, uuid, text, text) from public;
grant execute on function public.link_meeting_case(uuid, uuid, uuid, text, text) to authenticated, service_role;

revoke all on function public.update_meeting_agenda_item(uuid, text, text, text, text) from public;
grant execute on function public.update_meeting_agenda_item(uuid, text, text, text, text) to authenticated, service_role;
