# FUP-READ-ACCESS-RIDES-ON-A-WRITE-POLICY — `commissions` and `commission_meeting_types` grant tenancy-admin READS from a policy named `…_write` (owner: backend/PO; filed 2026-08-27 by `backend` at the AE1.5 triage, PO-ruled the same day)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-27 · status open

> **The measurement** (catalog, local stack, `pg_policies`):
>
> | table | policy | cmd | the duplicated arms |
> | --- | --- | --- | --- |
> | `commissions` | `commissions_admin_write` | **ALL** | `app.is_org_admin_of(organization_id)`, `app.is_hospital_admin_of(hospital_id)` |
> | `commissions` | `commissions_select_member_or_admin` | SELECT | the same two, verbatim |
> | `commission_meeting_types` | `meeting_types_staff_admin_write` | **ALL** | `app.is_tenancy_admin_of(commission_id)` |
> | `commission_meeting_types` | `meeting_types_select` | SELECT | the same one, verbatim |
>
> A `FOR ALL` permissive policy **is a read policy too** (the F-AE0-8 shape). So for `SELECT` the
> effective predicate is the nine-term / three-term disjunction of both policies, and each named
> arm is evaluated **twice per row** — a live per-row cost, today.
>
> ⛔ **Why AE1.5 did NOT remove the duplicates, though removing them is provably identity.** The
> only identity-preserving direction is to strip the arms from the **SELECT** policy — stripping
> them from the `ALL` policy would break INSERT/UPDATE/DELETE. That leaves `org_admin` /
> `hospital_admin` / tenancy-admin **read** access depending on a policy named `…_write`
> continuing to exist, so a later, entirely reasonable narrowing of a *write* policy silently
> revokes *reads* with no test naming the link. That is the *"a write lockdown is defeated by its
> parent"* shape run in reverse, and AE1 is a hardening phase: introducing authz fragility to save
> a plan node is the wrong trade. **PO-ruled 2026-08-27: leave both, record the reason.**
>
> ⚠ **This is NOT the same class as the `profiles` edit AE1.5 did make**, and the AE0 findings doc
> called them "same class" — corrected at the same ruling. `profiles`' two policies are **both
> `SELECT`**, so their disjunction is closed within one command and narrowing one of them cannot
> reach another command. These two straddle `ALL` and `SELECT`. Same *symptom* (a verbatim
> duplicated arm), different *shape*, and the difference is the whole decision.
>
> **What this item asks for — its own decision, not a repeat of the AE1.5 triage:** restructure so
> that reads live only in the `SELECT` policy and the `ALL` policy is narrowed to the write
> commands it is named for (`FOR INSERT` / `FOR UPDATE` / `FOR DELETE`, or an equivalent split).
> That is an **authorization change**, not a performance edit: it changes which policy answers for
> a read, and it must carry its own before/after per-persona visible-row proof plus a
> diff-scoped door sweep. ⛔ Do not treat it as bookkeeping because the *net* predicate is
> intended to be unchanged — the intent being "unchanged" is exactly the claim that needs proving.
>
> ⛔ **Not an AE2 item.** AE2 is the affiliation / person-tenancy split; this has no home there and
> was filed here rather than parked in a plan sentence, because a sentence in a document is not a
> register entry.
>
> **Sizing — MEASURED 2026-08-27, not estimated.** This item was filed saying the shape was
> "almost certainly wider than these two tables, ~40 pairs from the advisor list". That was an
> estimate off a warning list; it has since been **replaced by a census bounded by the property**,
> which is what the item itself demanded:
>
> ```sql
> -- Tables where a PERMISSIVE cmd='ALL' policy and a PERMISSIVE cmd='SELECT' policy
> -- on the same table share at least one VERBATIM top-level OR arm.
> with arms as (
>   select tablename, policyname, cmd,
>          btrim(unnest(string_to_array(
>            regexp_replace(coalesce(qual,''), '^\((.*)\)$', '\1'), ' OR '))) as arm
>     from pg_policies
>    where schemaname = 'public' and permissive = 'PERMISSIVE' and qual is not null
> )
> select a.tablename, count(distinct a.arm) as duplicated_arms
>   from arms a
>   join arms b on b.tablename = a.tablename and b.arm = a.arm
>              and b.cmd = 'SELECT' and a.cmd = 'ALL'
>  group by a.tablename order by 2 desc, 1;
> ```
>
> **Result: 26 tables, not 2.** Three carry **two** duplicated arms each — `commissions`
> (`is_org_admin_of`, `is_hospital_admin_of`), **`hospital_departments`** (`is_hospital_admin_of`,
> `is_org_admin_of(app.org_of_hospital(...))`) and **`hospitals`** (`is_admin`,
> `is_org_admin_of`) — and 23 carry one, overwhelmingly `app.is_tenancy_admin_of(...)` on the
> commission-scoped vocabulary tables (`case_tags`, `case_outcomes`, `forms`, `form_items`,
> `form_sections`, `form_item_options`, the seven `process_template_*` tables, …) plus
> `app.is_admin()` on `organizations`, `hospitals`, `case_types` and `case_participant_roles`.
>
> ⚠ **`organizations` and `hospitals` are the ones to look at first** — they sit at the top of the
> tenancy tree, every tenant-scoped read touches them, and on `organizations` the duplicated arm is
> `app.is_admin()`, a `SECURITY DEFINER` call evaluated **twice per row** inside an eight-term OR.
>
> ⚠ **`form_items` and `form_sections` appear in BOTH this census and AE1.5's hot subset. AE1.5
> did NOT touch their duplicated arm** — it only wrapped `auth.uid()` on those tables. Do not read
> AE1.5's hot-subset list as coverage of this item.
>
> ⚠ **Sister item:** `FUP-ZERO-ARG-APP-PREDICATES-NOT-HOISTED` covers a *different* fix on an
> overlapping population (hoisting, not de-duplication). `organizations` needs both and they are
> independent — de-duplicating leaves one per-row call, hoisting leaves two hoisted calls.
