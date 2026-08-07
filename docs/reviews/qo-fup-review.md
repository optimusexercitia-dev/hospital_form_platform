# QO·FUP — focused review (follow-up close-out on top of QO·A)

- **Reviewer:** `qa` · **Date:** 2026-08-07 · **Branch:** `feat/quality-office-oversight`
- **Scope:** `ec9ca1c..087928c` (9 commits, 18 files). NOT a phase review — QO·A itself
  was APPROVED at r3; only what QO·FUP changed on top of it is audited here.
- **Verdict: `CHANGES REQUESTED`**

> ⛔ **No shipped code needs to change.** Every behavioural deliverable (F1, F2, F3, F4,
> F7, F8) is correct, and I re-derived each one from the live catalog rather than from
> the migration text. The block is **R1**: three records state as *catalog-verified* a
> fact the catalog contradicts, and the follow-up filed on that false reading
> (**FUP-QO-7**) points the next engineer at a seam limit that does not exist while a
> **live privilege widening in a PHI module** sits at the same door, undescribed. On a
> program whose standing rule is "text is not truth", ratifying that into ADR 0102 +
> PROGRESS.md + backend-state.md is the more expensive option.

---

## 1. Gates I ran (fresh `supabase db reset --local`, 315 files = 315 registered)

| Gate | Result |
| ---- | ------ |
| `npm run test:db` | **PASS** — 172 files, **5371** tests, 0 failures |
| `ARM=census` (authz) | **INVARIANT HOLDS** — 447 live gates, 456 verdicts, no unswept newcomer |
| `ARM=floor` (authz) | **INVARIANT HOLDS** — 82 never-called doors, all allowlisted (was 83; `list_my_nsp_hospitals()` genuinely called now) |
| `f1-expiry-seam-audit.sh` | **6/6 RED-PROVEN**, control all green (**45** tests ran) — claim verified exactly |
| `a2-mutation-audit.sh` | **12/12 RED-PROVEN**, controls green for **both** targeted suites (234: 54, 241: 16) |
| `npx vitest run session-grants.test.ts` | **14/14** — all **10** catalog roles enumerated and landed |
| `npm run test` (full vitest) | **1172** passed / 77 files |
| `npm run lint` (incl. `lint:css-vars`, `lint:memberships-door`) | clean |
| `npm run typecheck` | clean |

This discharges the "**Fresh-reset gates PARKED** pending 'stack is yours'" note on F8 in
PROGRESS.md — they now hold on a clean reset. No `any` in the new TypeScript; no `.env`
or secret-shaped file in the diff.

---

## 2. Findings

### R1 — MAJOR (blocking) · a "catalog-verified" claim the catalog contradicts, and the live defect it hides

**Three records** say the sibling PHI door omits `expires_at` from its conflict update:

- `docs/decisions/0102-extend-on-regrant-expiry-seam.md`, Consequences:
  "`app._grant_case_access_unchecked`'s `on conflict … do update` list runs
  `read_case_content … granted_at` and **omits `expires_at`** — the case-access door
  still has the seam limit this ADR removes from the role door."
- `PROGRESS.md`, FUP-QO-7: "…and **omits `expires_at`** (catalog-verified)."
- `docs/backend-state.md`: "the sibling PHI door … **deliberately KEEPS the do-nothing
  seam** → FUP-QO-7".

**The live catalog says otherwise.** There is exactly one
`app._grant_case_access_unchecked(uuid,uuid,text,timestamptz,text,text,boolean,boolean)`
(no overload), and `expires_at` is the **last item in its `do update set` list**:

```
  do update set
     read_case_content      = excluded.read_case_content,
     ...
     granted_at             = excluded.granted_at,
     expires_at             = excluded.expires_at;      -- <= present, unconditional
```

So the door does **not** carry the pre-F1 seam limit. The real divergence is the
opposite one, and it is worse: `= excluded.expires_at` with **no `coalesce`** is exactly
the **"NULL clears"** semantic that ADR 0102 §2 refused for the role door on the grounds
that it is "a **privilege WIDENING** shipped by a change whose purpose is the opposite".

**It is reachable and I reproduced it.** `public.grant_case_access` passes `p_expires_at`
straight through, and `src/lib/case-access/actions.ts:181` sends
`p_expires_at: expiry ?? undefined` — i.e. a blank expiry field. Against the local stack,
as the case's coordinator, through the real door:

```
after grant with expiry            expires_at = 2026-08-14 16:27:41+00
*** after re-grant with NULL expiry ***   expires_at = <null>   became_permanent = t
```

A **time-boxed PHI grant** (`case_access_grants` carries `read_standard_phi` /
`read_restricted_phi`) is silently converted to **permanent** by a re-grant that leaves
the expiry field blank. No audit distinction, no confirmation.

**Why this blocks.** The defect is pre-existing and *not* introduced by QO·FUP — I am not
asking for a fix here. What blocks is that QO·FUP **read this exact door, mis-read it,
and wrote the mis-reading into three durable records plus a follow-up**. FUP-QO-7 as
filed asks the next engineer to consider adding extend-on-regrant to a door that already
has it, and its "⚠ Whichever way it goes, the caller sweep must be redone" note would
send them looking for the wrong thing. Requested:

1. Correct the claim in **ADR 0102** (Consequences), **PROGRESS.md** (FUP-QO-7) and
   **`docs/backend-state.md`** — quoting the live `do update` list.
2. **Re-scope FUP-QO-7** to the divergence that actually exists: the case door is
   NULL-clears, the role door is NULL-leaves-unchanged, and the case door is the PHI one.
   Raise its severity to reflect a reachable privilege widening, and note the reproduction
   above so it does not have to be rediscovered.
3. `306` 4.4's comment ("mirrors `grant_case_access` verbatim") is **still true** — both
   doors refuse `p_expires_at <= now()` identically (catalog-checked). Leave it; only the
   ADR's gloss on it is wrong.

---

### R2 — MINOR · the caller sweep that carries the whole NULL decision is an undercount

ADR 0102 §2, the migration header, and PROGRESS.md all say **"ALL THREE production
callers omit the argument"** and name `admin/actions.ts:285`, `members/actions.ts:235`,
`org/actions.ts:618`. The enumeration's boundary was the **name `grant_role`**, not the
property *"reaches `app.grant_role_impl`"*. From the catalog, the kernel has **three**
doors and materially more call sites:

| Door | Callers found |
| ---- | ------------- |
| `public.grant_role` | the 3 TS sites named, **plus** 5 SQL callers: `add_pqs_member`, `assign_org_admin`, `assign_nsp_org_admin`, `assign_hospital_admin`, `assign_nsp_coordinator` |
| `public.grant_role_for` (service door, `service_role=X`) | `src/lib/platform/actions.ts:210` **and** `:247` — not mentioned anywhere in the sweep |
| `app.grant_role_impl` (direct) | `public.appoint_technical_director` (two `perform` sites) |

**The conclusion survives** — I re-swept all of them and **none** passes `p_expires_at`
(the only `p_expires_at` in `src/` is `case-access/actions.ts:181`, a different door). So
"NULL = leave unchanged" is if anything better supported than argued. But the *recorded*
sweep is what the next change will be checked against, and it currently misses the
service door entirely. Please restate it as "every caller that reaches
`app.grant_role_impl` — 3 doors, N sites — omits the argument", derived from the catalog.

---

### R3 — MINOR · F1 changed a premise and no prose sweep followed it

`on conflict … do nothing` → `do update set expires_at = …` invalidated the stated
mechanism at four places that were not touched:

- `src/lib/platform/actions.ts:205` — "The kernel's `on conflict do nothing` keeps a
  repeat provision idempotent."
- `src/lib/platform/actions.ts:237-238` — "A repeat provision is idempotent (the kernel's
  targeted `on conflict do nothing`)".
- `supabase/tests/224_memberships_collapse.sql:435` — "§11 · Grant idempotency (on
  conflict do nothing — no duplicate row)".
- `supabase/tests/145_pqs_membership.sql:112` — "Duplicate enrollment is idempotent (on
  conflict do nothing)" — `add_pqs_member` reaches the kernel via `grant_role`.

The *outcomes* they describe are still true (these callers omit the expiry, so
`coalesce` no-ops), so nothing is red — which is precisely the failure mode: this is the
"a comment is an assertion that goes stale silently" class, which on this program has
already shipped one live bug. Four one-line edits.

---

### R4 — INFO · F1's new behaviour has no production call site

No caller anywhere (TS or SQL) passes `p_expires_at` to the grant kernel today, so the
extend/shorten write is currently unreachable from the product. That is legitimate — it is
PO-ruled D14 break-glass preparation, and shipping it now is cheaper than having D14
inherit the seam. It is worth one sentence in ADR 0102 acknowledging it, because §2 of the
same ADR argues *against* `p_clear_expiry` on the grounds that it "would be a declared
parameter no caller passes", and a future auditor reading both will otherwise read an
inconsistency where there is a deliberate choice.

---

### R5 — INFO · the new NSP landing 404s when `patient_safety` is off

`src/app/o/[org]/nsp/page.tsx` calls `notFound()` when the flag is off, **after** the
access check. So with the flag off, a principal holding only `pqs_member` now gets a hard
404 where they previously got the friendly pt-BR "sem acesso" screen. Low impact: the flag
is `enabled = true` in the seed, and a coordinator-only principal is redirected to
`/nsp/equipe` *before* the flag check, so only the flag-off `pqs_member` case is affected.
Noting it because the F4 guard asserts a role **lands**, not that it lands somewhere
usable — the guard would stay green through this.

---

### R6 — INFO · the landing guard's collapse control is deliberately coarse

`session-grants.test.ts` asserts each role redirects *somewhere*, plus `urls.size > 1`. It
would stay green if a role were routed to the *wrong* office (e.g. `nsp_coordinator` to
`/qualidade`), and `size > 1` is satisfied by 9-of-10 collapsing. ADR 0101 is explicit
that this is a landing guard, not a routing-correctness guard, so this is a recorded
scope note, not a defect.

---

## 3. Verified correct (audited from the catalog, not from file text)

**F1 — `20260912000000`, the expiry seam.** All of the following re-derived independently:

- **Conflict target is still targeted, and the siblings still refuse.** Empirically: an
  `insert … on conflict (principal_id, role, organization_id, hospital_id, commission_id)
  do update` that violates `memberships_one_technical_director_uq` still raises 23505. The
  three other unique indexes (`…_one_commission_role_uq`, `…_one_technical_director_uq`,
  `memberships_pkey`) are not absorbed. ADR 0102 D4 holds.
- **`p_expires_at <= now()` refused on BOTH write paths** — the check sits above the
  `p_scope_type = 'commission'` replace block. Driven through `public.grant_role` as a real
  `org_admin`: refused on the INSERT path *and* on the atomic-replace path
  (`a data de expiração deve ser futura`, `check_violation`).
- **No authority arm was widened.** Every branch's gate is byte-identical to the QO·A
  body apart from the two expiry lines; the self-grant deny, the `p_title_id` scope check,
  the TD physician/one-titular checks and the `quality_reviewer` no-`is_admin_for` posture
  are unchanged.
- **Rule 11 — metadata only.** Live audit rows emitted by the door carry exactly
  `role, user_id, organization_id, hospital_id, commission_id` (+ `expires_at_before` /
  `expires_at_after` on the two UPDATE verbs). No new verb, no payload, no PHI, one row per
  operation.
- **`292` §2.1's singleton genuinely holds.** An independent catalog probe (every
  `app`/`public` function whose comment-stripped body touches `memberships` and writes
  `expires_at`) returns exactly one row: `app.grant_role_impl`. §2.2's recut to a **named
  set** is the honest fix — a bare `count = 2` would have admitted an unrelated third writer.
- **Rebuild lost nothing.** `create or replace`, unchanged signature; the post-migration
  catalog matches the header's BEFORE snapshot property-for-property for both functions:
  `prosecdef=t`, `owner=postgres`, `proconfig={search_path=app, public, pg_catalog}`,
  volatility, strictness, language, return type, and `proacl={postgres=X/postgres}` on the
  kernel.
- **Falsifiability is real.** All six seam-audit cases RED-PROVEN on my run; the three
  that leave 4.6/4.13 green (`ratchet`, `drop_insert_coalesce`, `drop_replace_coalesce`)
  are the ones that make the claim non-vacuous, and they do.
- Behavioural note, not a defect: a no-argument re-grant of an **already-expired** row
  correctly leaves it expired (verified: `still_live = f`), and passing a real value
  revives it. Unchanged from the `do nothing` era, and unreachable via `addStaff`
  (which short-circuits on any existing row) and `list_addable_commission_members`
  (which excludes anyone holding a membership row).

**F8 — `20260912000100`, `list_my_nsp_hospitals()`.** The `me` CTE (`where
app.is_active(auth.uid())`) is the *outer* gate, so an inactive caller collapses **both**
union arms — there is no second exit path, and the pre-existing
`coalesce(jsonb_agg(...), '[]')` supplies the safe default unchanged. Expiry filter
present on both arms. ACL preserved exactly (`authenticated=X/postgres`,
`service_role=X/postgres`), `prosecdef=t`, `search_path` and volatility unchanged — I
compared against the header snapshot field by field. `145` §I is well-shaped: positive
twins on both arms (I1/I5), a **both-directions** probe (I4 — reactivation restores the
row, so I3's zero is attributable), a separate coordinator-arm case (I6) that a one-arm
fix would fail, `jsonb_array_length` rather than the always-1 `count(*)`, and a structural
ACL pin (I7). The allowlist removal is genuine, not bookkeeping: `ARM=floor` on my run
reports 82 never-called doors and the door is not among them.

**F4/F7 — ADR 0101, the role→landing guard.** The enumeration is read from
`pg_constraint` **at test time** through the DB container, with the container name derived
from `config.toml` — not a snapshot and not a remembered list. It ran all **10** roles the
live `memberships_role_check` admits (`org_admin`, `nsp_org_admin`, `hospital_admin`,
`nsp_coordinator`, `staff_admin`, `staff`, `pqs_member`, `technical_director`,
`technical_director_deputy`, `quality_reviewer`) and each landed. It drives the **real**
`page.tsx` default export over the **real** `partitionGrants` — only `getSessionContext`,
`signOut` and `redirect` are stubbed, and `@/lib/routing` stays real. It **fails loudly**
when the stack is down instead of skipping, and it fails on a zero-length vocabulary. The
`KNOWN_UNROUTED` ledger is asserted in both directions (unlisted-and-unrouted reds the
`it.each`; listed-and-landing reds the staleness test) and is legitimately empty. The
CONTROL (a synthetic role the catalog rejects must report NoAccess) is the
"detector-can-find-something" proof and passes. `nspOperatorOf.role` is referenced nowhere
outside its own type — the "display only, gate nothing on it" claim is true by absence.

**F2 — `100_dashboard` t19.** The extension exclusion is by **property**
(`pg_depend.deptype = 'e'`), not by name. Assertion and control share **one**
`pg_temp.first_party_anon_execs()` helper, so 19c cannot drift from what it proves; it
plants-asserts-drops rather than using a savepoint (correct — pgTAP's counter is
transaction-local).

**F3 — `a2-mutation-audit.sh`.** The retarget is the right call over deletion, and the
harness improvement is the real content: `run_case` now takes a per-case source and the
control loop runs **once per targeted suite**, so a red in a file whose control never ran
can no longer be counted as evidence. 12/12 on my run with both controls green.

**Records that check out.** ARCHITECTURE.md Rule 12's `pqs_members` correction is a
genuine erratum fix — `to_regclass('public.pqs_members')` is NULL, as is
`commission_members`. `306` is 45 tests. The floor delta 83→82 is real. The `292` §2.2
named set is exactly `app._t292_expiry_writer, app.grant_role_impl`. The F6 test record is
notably honest — it reports a non-reproduction as a non-reproduction and declines to
manufacture a classification, which is the right posture.

---

## 4. What closes this review

R1 (correct three records, re-scope FUP-QO-7), R2 (restate the sweep by property), R3
(four prose lines). R4–R6 are informational. No migration, no application code, and no
test needs to change; nothing needs re-running except a re-read of the corrected records.
