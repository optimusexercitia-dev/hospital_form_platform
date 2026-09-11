# FUP-ARM3-HAT-TERM-FIX-STALE-ACTIVE-ROLE-SELECTION-OUTLIVES-ITS-MEMBERSHIP — a session's explicit role selection is never revalidated, so the token hook keeps minting a hat whose membership is gone

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-11 · status open

**Where it came from.** QA review of unit `ARM3-HAT-TERM-FIX`, finding **B1**. The unit's migration,
ADR [0209](../decisions/0209-the-act-hat-is-a-door-level-term-on-the-professional-profile-read-door.md)
D2 and the `authorization-and-audit.md` slice each claimed the door's held-role set was *"exactly the
set `public.custom_access_token_hook` can mint `active_role` from"*, and therefore that *"the door can
never refuse a hat the token hook is able to issue"*. QA measured that **false**; the three sentences
were narrowed the same day, and the window the measurement exposed is this item. ⛔ The sentence was
the finding; **this** is the mechanism the sentence was hiding.

## The mechanism — measured from the live catalog, with the query beside each reading

**1. The hook has TWO branches, and the first one wins.**

```sql
select prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'custom_access_token_hook';
```

> ```
>   if v_session_id is not null then
>     select role::text into v_selected_role
>     from app.active_role_selections
>     where session_id = v_session_id;
>   end if;
>   if v_selected_role is not null then
>     -- An explicit selection for THIS session wins.
>     claims := jsonb_set(claims, '{active_role}', to_jsonb(v_selected_role));
>   else
>     ... -- D11 break-glass: derive implicitly when there is EXACTLY ONE live role type
> ```

⚠ The implicit branch is also **narrower** than the door's held set: it mints only when the live
role-type set has cardinality **1**. The door's set is the union, so the door admits hats the implicit
branch would decline to mint — the asymmetry runs both ways, and neither direction is *"exactly"*.

**2. The only writer validates at SELECTION TIME and then upserts.**

```sql
select n.nspname||'.'||p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where p.prosrc like '%active_role_selections%';
```

→ exactly `public.assume_role` and `public.custom_access_token_hook` (the hook only reads). Live
`assume_role` checks `authz.roles.session_selectable`, then `app.is_active(v_uid)`, then that a live
membership carries the role (`expires_at is null or expires_at > now()`), and then:

> `insert into app.active_role_selections (session_id, user_id, role, chosen_at) values (…)
>  on conflict (session_id) do update set role = excluded.role, chosen_at = excluded.chosen_at;`

There is **no deleter anywhere in `pg_proc`**. ⚠ Bound on that negative: the sweep is keyed on the
table name appearing in `prosrc`, so a writer that reached the table through dynamic SQL would be
invisible to it.

**3. Nothing invalidates the row afterwards.**

```sql
select t.tgname from pg_trigger t where t.tgrelid = 'public.memberships'::regclass and not t.tgisinternal;
select conname, pg_get_constraintdef(oid) from pg_constraint
 where conrelid = 'app.active_role_selections'::regclass;
select column_name from information_schema.columns
 where table_schema = 'app' and table_name = 'active_role_selections';
select t.tgname from pg_trigger t
 where t.tgrelid = 'app.active_role_selections'::regclass and not t.tgisinternal;
```

→ `public.memberships` carries **one** non-internal trigger, `trg_audit_memberships`. The selection
table has a PK on `session_id` and **one** FK, `user_id → profiles(id) ON DELETE CASCADE`; its columns
are `session_id, user_id, role, chosen_at` — **no `session_id` FK and no expiry column** — and it
carries **no** non-internal trigger of its own.

⇒ **When a membership is revoked, deleted or its `expires_at` passes mid-session, the selection row
survives and the hook keeps minting that `active_role` on every token refresh.** The only thing that
clears it is the user's profile being deleted (the cascade) or a later `assume_role` on the same
`session_id`.

## What it means TODAY — fail-closed, and that is why this is medium and not critical

The stale hat is a **claim**, not an authority. Every consumer re-derives the authority:

- `app.has_role(…)` requires a **live** membership (`expires_at is null or expires_at > now()`) — the
  revoked principal fails there regardless of the claim;
- `app.is_admin_for(…)` reads `profiles.is_admin` and `app.is_active`, not the claim;
- `app.can_read_professional_profile(uuid, uuid)`'s new door-level hat term (ADR 0209 D1/D2) compares
  the presented hat against **live** memberships, so it **denies** the stale hat — the same answer the
  two predicates above give, reached the same way.

⛔ **So the deny is the correct behaviour and must not be "fixed".** Making the door read
`app.active_role_selections` would make it accept a hat the principal no longer holds, which is
precisely `BUG-AE5-MATRIX-ARM3-CELLS-CASE-GRANT-ARM-MAKES-THE-HAT-TERM-UNENFORCEABLE` re-opened from
the other side.

## What is UNTESTED — the actual gap

- **No assertion anywhere constructs the stale state.** Nothing seats a selection row, revokes or
  expires the membership behind it, and then measures what the hook mints or what any predicate
  answers. The window's *mechanism* is measured (above); its *behaviour under the transition* is not.
- **No assertion covers the E2E reachability.** QA recorded this explicitly as a could-not-verify:
  B1 is argued from the catalog and from `assume_role`'s body, never from an end-to-end reproduction.
  The frequency is unknown.
- **Two adjacent staleness sources ride the same row and are equally unasserted**, and they should be
  ruled on together rather than discovered one at a time: a role whose `authz.roles.session_selectable`
  flips to false after a seating, and an account deactivated after a seating (`assume_role` gates on
  `app.is_active` at seating time only — pre-AE5 Batch 10 closed the *seating* door, not the seated
  row). ⚠ The Batch 10 record already names the surviving stale-token window for the admin FLAG; this
  is the same shape one table over.

## What must NOT be mistaken for closing it

⛔ Narrowing the three sentences — that is done, and it is what made this visible.
⛔ A cell asserting `app.can_read_professional_profile` denies the stale hat: the door already denies,
and such a cell would be green before any fix — green on first run, which is a finding, not a pass.
⛔ "A session is short-lived" — unmeasured, and it is a claim about GoTrue's configuration, which is
an external system whose settings go stale silently.
