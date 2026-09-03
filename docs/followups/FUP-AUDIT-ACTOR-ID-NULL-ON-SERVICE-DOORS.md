# FUP-AUDIT-ACTOR-ID-NULL-ON-SERVICE-DOORS — `actor_id` is NULL on every audit row a service-role door emits (owner: backend/PO)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-02 · status parked

> Indexed 2026-08-27 at the AE1 Record step (obligation 3). ⛔ **Previously double-registered**: a
> `deferred-backlog.md` block with the same id carried a `**Revisit when:** PO to rule` this entry
> lacked, which is exactly the QA R3 / QA M3 "backlog-only" gap this body was first written to
> flag — this entry was the one PROGRESS.md/the register could see, the backlog block was the one
> nobody without the id already in hand would find. Resolved 2026-09-03 (ADR 0186 D4, plan 5.3):
> the backlog block's `Revisit when` was folded into this entry's own **Status: parked** +
> **Revisit when** fields and the backlog copy was dropped — this is now the single account, not a
> pointer to one.
>
> `app.audit_write` derives its actor from `auth.uid()`, which is **NULL on every service-role path**.
> AE1.3 adds 8 new instances (`person.registered`, `person.fields_updated`, `person.deactivated`,
> `person.reactivated`, `person.suspended`, `credential.created`, `credential.updated`,
> `credential.deleted`) to a platform-wide set that already includes `membership.granted`,
> `form.created` and `affiliation.created`.
>
> ⚠ **This is a queryability gap, NOT a Rule 11 attribution loss** — the actor rides in
> `metadata.actor_user_id`, following the `public.log_cpf_probe_for` precedent, and pgTAP `385` §1.11
> asserts the null **positively** so it cannot later be misread as lost attribution.
>
> ⛔ **Ruled R3: do NOT fix it for these doors only.** A partially-populated `actor_id` is worse for a
> reader than a uniformly null one, because a query filtering on it silently misses everything else.
> **Discharged when** the whole-platform shape lands — `app.audit_write_as(p_actor, …)` as an internal
> helper with no EXECUTE grant — and every service-role emitter routes through it, with pgTAP `385`
> §1.11 flipped from asserting the null to asserting the actor.
