# FUP-AE5-STAFF-DOOR-SWEEP-POLICY-ARM-EXCLUDES-STORAGE-SCHEMA

**Filed:** 2026-09-14 (unit `AE5-STAFF`, T8) · **Owner:** backend
**Severity:** medium — a re-keyed enforcement site that **no mutation arm can reach**, on a
Class-1-adjacent surface (form assets).
**Status:** open

## The gap

AE5 T7 re-keyed `storage.objects / form_assets_select_member`. Its live qual is

```
(bucket_id = 'form-assets') AND ( app.is_tenancy_admin_of(((storage.foldername(name))[1])::uuid)
                               OR app.can_forms_read(((storage.foldername(name))[1])::uuid, (select auth.uid())) )
```

so it is a declared enforcement site of `commission.forms.read`. **No arm of the door sweep can
sweep it:**

* the **predicate arm** neutralizes FUNCTIONS — a policy name matches no gate there;
* the **policy arm**'s domain is `public` policies — a `storage` policy is outside it.

T8's gate run says so in its own words, and it is why the run could not end CLEAN:

```
=== RESULT: UNPROVEN (PARTIAL) — 73 gate(s) measured, 0 BLIND · 0 ERROR, but
    these were requested and matched NO gate: form_assets_select_member responses_insert_own
    A clean verdict over a subset of what was asked for is the finding this gate
    exists to prevent. NOT a pass. ===
```

`responses_insert_own` is dispositioned by the write arm. `form_assets_select_member` has **no arm
at all**, and that is this follow-up.

## Does `425` probe that site today? MEASURED — and the expected answer was wrong

The site IS in `425`'s list (`('commission.forms.read', 'policy',
'storage.objects.form_assets_select_member')`), and its probe is **NOT public-only**. The generic
policy branch of `pg_temp.site_signature` derives the relation from the site string itself:

```sql
v_table := regexp_replace(p_site, '\.[^.]+$', '');   -- -> 'storage.objects'
execute format('select count(*)::text from %s', v_table) into v_result;
```

so it issues `select count(*)::text from storage.objects` — schema-qualified, reaching storage.

⛔ **The gap is therefore NOT "425 cannot see storage".** It is two separate things:

1. **no mutation arm can neutralize the site** (above); and
2. **425 reaches it but cannot discriminate**, because the table is EMPTY on the seeded stack —
   measured as `postgres` with no role switch and still 0, which is why `425 § 2.0` excludes it
   from the positive-control claim while KEEPING it in § 3.1/§ 3.2's denominator (a 0-before /
   0-after pair is a valid, if uninformative, "no movement" observation).

A reader who assumed (1) implies a public-only probe would fix the wrong thing. Both halves have to
move for the site to be covered.

## Closes when

The policy arm's domain includes `storage` policies that carry a layer-1 gate or a domain-authorizer
call, **and** `storage.objects / form_assets_select_member` is actually swept with a verdict, **and**
that arm is shown **able to red** — neutralize the site and require the suite to notice.

⛔ A verdict of COVERED obtained while `storage.objects` still holds zero rows is not a closure: the
discrimination half needs a seeded form asset, or the arm is measuring an empty table. That is the
same shape as the ten sites `425 § 2.0` already excludes for emptiness — the difference between
"nothing noticed" and "there was nothing to notice".

## Related

`FUP-DOOR-SWEEP-DOMAIN-GAP-WIDENED-BY-SET-VALUED-RESOLVERS` (ADR 0191) is the same class on a
different axis — a family excluded before any name, body or schema test runs. ADR 0191 split that
fix into a schema-axis widening plus a targeted-case file with a committed home; whichever shape is
chosen here, the precedent is that an unreachable family gets a home and a schedule, not a note.
