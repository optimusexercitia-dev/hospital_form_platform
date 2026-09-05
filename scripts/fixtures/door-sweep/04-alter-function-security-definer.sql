-- Catalog: app.can_read_professional_profile -> bool, prosecdef=t, IN domain.
-- An ALTER has no body, so only the catalog can say what it returns.
alter function app.can_read_professional_profile(uuid, uuid) security definer;
