# FUP-W3-ACL-KEYSTONE-NOT-PROVEN — an ACL keystone defended by something other than its ACL (owner: backend)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-02 · status open

- 🟡 **FUP-W3-ACL-KEYSTONE-NOT-PROVEN** — filed 2026-08-28, **verified pre-existing** by re-running
  `w3` with `SRC` pointed at the committed `293` (same verdict; control green at 25).

`w3`'s `authenticated_gets_service_door` reads **NOT PROVEN**: granting `authenticated` EXECUTE on
`public.grant_role_for` leaves `293 § 4.1` **GREEN**. So that ACL keystone is held up by something
other than the ACL — the *incidental-guard* shape, where a control appears verified because a
different mechanism happens to refuse.

⚠ ⛔ **"Not reachable" is not "protected", and here it is worse: the assertion names the ACL and
measures something else.** Either the assertion needs an actor who would otherwise be **admitted**
(so the ACL is the only thing standing between them and the door), or the ACL needs a different
witness entirely.
