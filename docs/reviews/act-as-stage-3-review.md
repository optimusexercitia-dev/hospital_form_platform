# ACT Stage 3 — QA review (ADR 0106, "act as" strict role assumption)

- **Verdict: APPROVED** (round 2, head `8486497`) — see [§7 Round 2](#7-round-2--re-review-of-the-f4362fc--8486497-fix).
- ~~Round 1 verdict: **CHANGES REQUESTED**~~ (head `4441d3e`) — 1 BLOCKER, 2 MAJOR. The
  BLOCKER and MAJOR-1 are **fixed and independently verified**; MAJOR-2 is **correctly
  dispositioned** as a pre-pilot follow-up. Round 1 is preserved below in full — the record
  should show what was found and how it was resolved.
- Reviewer: `qa` · r1 + r2 2026-08-10

---

## Round 1 (head `4441d3e`) — CHANGES REQUESTED

- Branch `feat/act-as-role-assumption`, head `4441d3e`, based on local `main` @ `7b7a99c`
- Scope: every commit `8efee81..4441d3e` (the S3 window), incl. the four lead-audit
  commits `169668d` / `d6e56d1` / `81a72d1` / `4441d3e`

**One BLOCKER.** `app.is_admin_for` — the sibling of the exact function D11 names — is a
**hat-blind caller gate on the membership-grant door**, proven live: wearing the `staff` hat,
`app.is_admin()` correctly returns `false` while `grant_role_impl` (reached from
`public.grant_role`, `EXECUTE` to `authenticated`, `p_actor := auth.uid()`) **succeeds in
granting `org_admin`**. The buildnotes record the opposite as a closed question. Everything
else in the stage is, on the evidence I could gather, correct — and unusually well built.

---

## 1. Method — what I actually did

Per CLAUDE.md's binding rule, **every** schema / RLS / RPC / authorization claim below was
read from the **live catalog** (`pg_proc` incl. `prosecdef`, `pg_policies`, `pg_class.relacl`,
`proacl`, `pg_trigger`, `pg_get_viewdef`), never from a migration file. Where I could probe
behaviour instead of reasoning about text, I did — six live probes, each inside a
`begin … rollback`, so the DB is unmutated.

Two structural sweeps carried the audit:

1. **Transitive closure over `app` + `public`** (928 functions), comment-stripped
   (`regexp_replace(prosrc, '--[^\n]*', '', 'g')`), asking: which functions have **no call
   path** to `has_role` / `has_role_any` / `is_admin` / `active_role`?
2. **Population sweeps** for the residual classes the brief named: views/matviews reading
   `memberships`; functions reading `request.jwt.claims`; policies reading `memberships`
   directly; trigger functions; ACLs on the new surface.

⚠ **A methodology note I owe this review, because it is the finding's own mechanism.** My
first closure run returned *zero* hat-blind gates — a clean bill of health. It was wrong. My
edge predicate matched a callee name anywhere in the body, so the **column** `is_admin` in
`select … where id = p_user_id and is_admin = true` matched the **function** `app.is_admin`,
manufacturing a false edge that put `app.is_admin_for` inside the reachable set. Requiring
`name[[:space:]]*\(` (a real call, not a column reference) surfaced it immediately. This is
the repo's own recorded trap — *"`prosrc` matching comments"*, generalised to identifiers —
and it is worth recording that **a hat-blindness sweep whose edges are name substrings will
report closure it has not proved.**

---

## 2. Findings

### 🔴 BLOCKER-1 — `app.is_admin_for` is a hat-blind CALLER gate on `grant_role` / `revoke_role`

**Requirement violated:** ADR 0106 **D3** (the active role is the ONLY role), **D5** (fail
closed), **D11** (`platform_admin` is a hat; `is_admin()` gains the active-role condition).

**Mechanism.** D11 was implemented on `app.is_admin()` (migration `20260918002200`) —
correctly, with `IS NOT DISTINCT FROM`. Its parameterized sibling `app.is_admin_for(p_user_id)`
was classified as out of scope. From the live catalog:

```
CREATE OR REPLACE FUNCTION app.is_admin_for(p_user_id uuid) RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER
AS $function$
  select exists (select 1 from public.profiles where id = p_user_id and is_admin = true);
$function$
```

No `active_role()`, no `auth.uid()`. It has **three callers** — `app.grant_role_impl`,
`app.revoke_role_impl`, `app.affiliate_person_impl` — and the first two gate on it:

```
-- app.grant_role_impl, organization/org_admin branch:
if not (app.is_admin_for(p_actor) or app.is_org_admin_of_for(p_scope_id, p_actor)) then
  raise exception 'sem permissão' using errcode = '42501';
-- and, symmetrically, the hospital/hospital_admin branch (ADR 0097 D17).
```

and `p_actor` is bound to the **caller**:

```
CREATE OR REPLACE FUNCTION public.grant_role(...) ... AS $function$
begin
  perform app.grant_role_impl((select auth.uid()), p_scope_type, p_scope_id, p_role, p_user, ...);
end; $function$
```

`public.grant_role` and `public.revoke_role` both carry `EXECUTE` to **`authenticated`**
(`proacl = {postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}`) and
`public` is the PostgREST-exposed schema, so this is a reachable door, not an internal helper.
(The `_for` variants that take an arbitrary actor — `grant_role_for`, `revoke_role_for`,
`affiliate_person_for` — are correctly `service_role`-only.)

**Proven live**, not inferred (rolled back):

```
HAT = staff   app.is_admin() = false   app.is_admin_for(self) = true
NOTICE: RESULT: grant_role_impl SUCCEEDED while wearing the staff hat  <-- HAT-BLIND
```

i.e. a principal whose `platform_admin` entitlement is *correctly suppressed by D11 at
`is_admin()`* still granted an `org_admin` membership through the parallel door.

**The record asserts the opposite.** `docs/plans/act-as-buildnotes.md:1453-1459`:

> `app.revoke_role_impl` (comment says "no is_admin() here", but the real call is
> `is_admin_for(p_actor)`, **a different, third-party-safe function**) … `app.is_admin_for(p_user_id)`
> is the pre-existing, **deliberately separate third-party door — untouched, and correctly
> independent of any hat** (no `auth.uid()`/`active_role()` dependency at all).

That sentence is the defect. "Third-party-safe" was decided from the **function's shape**
(parameterized, no `auth.uid()` inside) rather than from the **call site's binding**
(`p_actor := auth.uid()` ⇒ it *is* the caller). The 31-door class-3 sweep applied exactly the
right property — caller-vs-third-party — but applied it per function, and `is_admin_for` fell
between class 1 (boolean gates containing `auth.uid()`) and class 3 (non-boolean doors). This
is the fourth class the review brief asked about: **a boolean gate that RECEIVES the caller's
uid rather than reading it.**

**Reachability today.** Requires a `platform_admin` who also holds ≥1 membership; the seed has
none (`315`'s TRIPWIRE — I re-verified: one `platform_admin`, `memberships = 0`). So it is
latent, on precisely the same argument that makes `is_admin()`'s own D11 clause a provable
no-op. But the precondition is one ordinary step away — any `org_admin` adding the platform
account to a commission via `addStaff` makes it multi-role, and from that moment every
non-platform hat carries full membership-grant authority. D5 exists for exactly this shape.

**Why blocking rather than a follow-up.** (a) It is an authorization gap at the
privilege-**grant** door (`org_admin` / `hospital_admin`), not a read surface. (b) It is a half
delivery of D11, the decision this stage claims to deliver. (c) The record closes the question
with a false claim, so it will not be revisited. (d) It survived `ARM=census`, `ARM=floor`,
pgTAP 5679 and 996 E2E — the ADR 0079 "green check over a live leak" shape. (e) The fix is
small and belongs here, not in a separate program: mirror `has_role`'s caller-only shape —

```
and (p_user_id is distinct from auth.uid()
     or app.active_role() is not distinct from 'platform_admin')
```

— keeping `is_admin_for` genuinely third-party-safe when asked about someone else. It needs a
**red-first keystone** (neutralize the condition ⇒ a test must red) and a re-run of the
diff-scoped door sweep over the changed gate.

▶ Related, non-blocking: `docs/progress/authz-a30-platform-admin-inventory.md:77` still records
`app.is_admin_for()` as *"0 real callers — the function is dead code"*. It has three. That
stale line is plausibly why the function reads as inert.

---

### 🟠 MAJOR-1 — `app.can_manage_professional`'s expired arm is a residual hat-blind caller arm; the recorded disposition understates it

**Requirement:** D3 / D5, and the ADR's own enforcement table, which names
`can_manage_professional` as the **8th** direct `memberships` reader that must be normalised.

Stage 2 normalised the live arm onto `has_role` (now hat-aware) and **deliberately preserved**
the no-expiry-filter quirk as a compensating raw clause, under its "no semantic change" rule
(`20260918001000:141-189`, well documented). Stage 3 did not close it. From the catalog, the
compensating clause is:

```
or exists (select 1 from public.memberships m
           where m.commission_id = c.id and m.principal_id = p_uid
             and m.role = 'staff_admin'
             and m.expires_at is not null and m.expires_at <= now())
```

— no hat condition. All **10** call sites bind `p_uid => auth.uid()` (verified from the
catalog), so it is a caller arm. **Proven live** (rolled back): a principal holding live `staff`
in commission B and an **expired** `staff_admin` in commission A, wearing the `staff` hat —

```
HAT=staff | has_role(staff_admin, c1) = false | can_manage_professional = true
```

The hat-gated arm denies; the expired arm grants. It gates 10 professional-identity /
ethics-vocabulary write RPCs (Class-2 data, ADR 0064/0065).

This is recorded as **BUG-ACT-EXPIRY-1** (OPEN, latent, disposition "S4 or standalone") — so it
was not silently dropped, and I am not re-filing it. **What I am reporting is that the bug's
framing is now incomplete:** it is described purely as an expiry defect, and on that framing
"latent, not exploitable today" is true. Under ACT it is *also* a hat-blind caller arm, which
makes the S3 residual-closure narrative ("all caller gates hat-aware") **not literally true**.
Amend BUG-ACT-EXPIRY-1 to say so, or the next reader inherits a closure claim with a known
exception filed under a different heading.

---

### 🟠 MAJOR-2 — ACT structurally re-strands the LGPD Art. 18 referral-erasure path that `20260917000400` was written one day earlier to un-strand

**Requirement:** Architecture Rule 12 / the LGPD + ANVISA/RDC posture (ADR 0035); ADR 0037.

The catalog confirms the brief's premise exactly. `public.dispose_referral_phi`'s gate:

```
if not (app.is_tenancy_admin_of(<source_commission>)
        or app.is_pqs_operator_of(app.hospital_of_commission(<source_commission>))
        or app.is_pqs_operator_of(app.hospital_of_commission(<target_commission>))) then
  raise exception 'apenas um administrador da organização ou o NSP pode descartar dados do paciente'
```

`app.is_tenancy_admin_of_for` = `has_role(organization, …, 'org_admin')` **or**
`has_role(hospital, …, 'hospital_admin')`. `is_pqs_operator_of_for` = `nsp_coordinator` or
`pqs_member`, hospital-scoped. **No commission-member arm exists on this door.**

The affordance mounts only on
`src/app/o/[org]/c/[commission]/encaminhamentos/[referralId]/page.tsx`, whose guard is
(line 107):

```ts
if (!access || access.role === null) { notFound(); }
```

`access.role` is the **hat-filtered** commission member role. So under strict single-hat:

| Principal the DB authorizes | Reaches the page? |
| --- | --- |
| `org_admin` / `hospital_admin` hat | ❌ `access.role === null` → 404 |
| `pqs_member` / `nsp_coordinator` hat | ❌ `access.role === null` → 404 |
| `staff` / `staff_admin` hat (reaches the page) | ❌ denied by the DB gate — no member arm |

The sets are **disjoint**. I confirmed the seam independently: for a principal holding both
`staff` of a commission and `org_admin` of its org, `app.is_member_of` and `app.is_org_admin_of`
are `true`/`false` under the `staff` hat and `false`/`true` under the `org_admin` hat — never
both (that same probe is my proof for MINOR-1's dead branch below). Before ACT the hatless
union of `pqsdual.a@` satisfied both halves, which is precisely what the old AC-7 test drove.
**ACT removed the last UI path to a Rule-12 erasure door.**

**Why this deserves escalation beyond a UX follow-up, plainly.** On 2026-08-09 —
one day before this stage — `20260917000400` **partially reversed** BUG-QOB-004 specifically to
restore this arm, and PROGRESS.md:1273 records the reason verbatim: *"a hospital can have ZERO
NSP operators (`Hospital Unico C`), so NSP-only disposal strands an **LGPD Art. 18** erasure
obligation that belongs to the controlador"*. ACT now re-strands the same obligation by a
different mechanism — not by cutting the arm, but by making every holder of it unable to reach
the button. The ratified ruling is intact in the catalog and void in practice.

The record files this as **FUP-ACT-DISPOSE-UI**, in the "PO ratification — same family as the
two ADR 0106 accepted losses" bucket. That framing is too weak: the other accepted losses are
convenience losses (a coordinator must switch hats). This one voids a regulatory ruling made
one day earlier, and the connection to `20260917000400`'s reasoning appears nowhere in the
follow-up. **Re-scope FUP-ACT-DISPOSE-UI from "UX ratification" to "LGPD Art. 18 reachability
regression", cite `20260917000400`, and close it before pilot.** I am not making it a BLOCKER
for S3: the platform is pre-pilot with no patient data and no live erasure obligation, the
mechanism survives at the door (the new AC-7 test drives it and asserts `acting_as` on the
audit row), and the PO owns the ratification. But it must not merge into the pilot in this
state, and the sibling `dispose_event_phi` (FUP-QOB-3) should be checked for the same
UI-reach shape.

---

### 🟡 MINOR-1 — the `navScope="member-and-configuration"` dead branch: confirmed unreachable; leaving it to S4 is acceptable, but leave a tripwire

`src/app/o/[org]/c/[commission]/layout.tsx:307-309` selects
`access.isTenancyAdmin ? "member-and-configuration" : "member"` inside the member branch
(`access.role !== null`). Reaching it needs `access.role ∈ {staff, staff_admin}` **and**
`isTenancyAdmin` true simultaneously — i.e. the caller acting as a commission role *and* as
`org_admin`/`hospital_admin`. Both are derived from `hatFilteredGrants`
(`src/lib/queries/session.ts:335-337`), and I proved the mutual exclusion live (above). The
branch is genuinely dead. `AppSidebar`'s `"member-and-configuration"` arm
(`src/components/shell/app-sidebar.tsx:80,90`) is dead with it.

Leaving it to S4 is fine — it is dead code, not wrong code. But dead authorization branches
are how a future widening quietly re-lights a shape nobody tested. Prefer a `throw`/assert over
a silent string, or a pgTAP/vitest assertion that the two predicates are mutually exclusive, so
the branch reds if the invariant ever changes.

---

### 🟡 MINOR-2 — the D9 fix (`81a72d1`) is correct, but its stated rationale is not applied consistently, and the record overstates what it was

The fix itself is right and I could not fault it:

- `RoleSwitchHint` (`src/components/role/role-switch-hint.tsx`) is `"use client"`, and its props
  are exactly `{ options: { role: string; count: number; landing: string }[] }`. `SessionGrant`
  reaches it only via `import type` from `get-role-switch-options` — erased at build.
- All **7** `not-found.tsx` mounts pass `const { options } = await getRoleSwitchOptions()` and
  nothing else. No uuid, name, or grant object crosses the boundary. (An org **slug** can appear
  inside a `landing` path string, e.g. `/o/rede-a/manage` — but only for a hat the caller is
  being offered, i.e. their own standing, which D9 explicitly permits.)
- **D9 behaviour intact:** `if (options.length === 0) return null` (single-role principal
  renders nothing, pinned by `act-role-assumption.spec.ts:218`); the active hat is excluded
  upstream by `.filter((o) => o.role !== activeRole)`
  (`src/components/role/get-role-switch-options.ts:42`); `landing` is computed **server-side**
  by `landingRouteForRole` and submitted straight to `assumeRole(role, landing)` — no
  client-side route derivation.
- **No client value-import of a server-only module.** Swept every import in the diff's
  `src/components/role/**` and `src/components/shell/**`: all server-shaped imports are either
  `import type` (erased) or `'use server'` action modules (the supported reference pattern), and
  the two value-imported modules (`role-catalog.ts`, `session-grants.ts`) are pure —
  `session-grants.ts` only **type**-imports `session.ts`, deliberately, and says so. The known
  `next build`-breaks-while-tsc-passes trap does not apply here.

**What is off is the framing and the consistency.** `public.session_context` filters
`m.principal_id = (select auth.uid())` — the grants are the **caller's own**. Serializing them
into the caller's own RSC payload discloses nothing to anyone else; ADR 0106 D9 says as much
("the hint reveals only which hats the user holds, which they just chose from"). Calling it a
*"grant-serialization leak"* (PROGRESS.md S3 status cell) overstates it — it is payload
hygiene, not a confidentiality defect.

And on the hygiene reading, the same exposure is untouched at far greater scale: the full
`SessionGrant[]` (ids, names, slugs, every role held) still crosses into four `"use client"`
components — `RolePickerForm`, `UserMenu`, `AppSidebar`, `OrgManageSidebar` — on
`/selecionar-perfil` and on **every** render under `/o/[org]/c/[commission]/**` and
`/o/[org]/manage/**` (9 layout call sites). Either the rationale applies there too, or it did
not require a fix at the 404. Pick one and record it; right now the record implies a security
fix that was, on inspection, defence in depth.

---

### 🟡 MINOR-3 — AC-8's keyboard-only proof narrowed, but the phase requirement is met elsewhere

AC-8 was re-anchored from the dispose dialog (4-control journey: focus → `Enter` → select →
`keyboard.type('APAGAR')` → destructive-submit-enable → `Escape`) onto the PHI reveal
(1 control: focus → `Enter` → text visible), because the dispose dialog became unreachable
(MAJOR-2). That is a real reduction in `nsp-per-hospital.spec.ts`, and no other keyboard flow
exists in that file.

CLAUDE.md §8's *"at least one keyboard-only flow per phase"* is nonetheless satisfied — by
ACT's own spec: `e2e/act-role-assumption.spec.ts:297`, *"Keyboard-only: sign in and complete
the picker with zero mouse input"*, driving real `Tab` / `ArrowDown` / `Enter` sequences and
explicitly avoiding a bare `.focus()` (the recorded Playwright-focus-races-RSC-streaming
lesson, honoured in a comment at :301-305). Good. Both AC-8's remaining assertions are
unconditional. Fold the lost destructive-dialog keyboard journey into FUP-ACT-DISPOSE-UI.

---

### ⚪ INFO-1 — the E2E rewrites: judged honestly, none was weakened to pass

This was the review's stated most-important question, so I state my conclusion plainly: **four
of the six rewrites are strictly stronger; two are forced narrowings that are recorded, not
hidden.** I compared each test body at `7b7a99c` against HEAD and inventoried every `expect`
for conditional gating.

| Test | Judgement |
| --- | --- |
| `phase15-indicators` **AC-5b** | **Stronger.** Every prior assertion retained verbatim; adds an unconditional proof that the `pqs_member` hat 404s the indicator page. 11 expects, none conditional. |
| `phase22-referrals` **Flow 3d** | **Equal, relocated.** The old positive claim (an entitled reader sees the PHI-bearing reply) is asserted with reversed polarity here — correctly, under a `staff` hat it must be withheld — and the positive claim survives in **Flow 1b** of the same file. Adds a `pqs_member`-can't-reach proof. Net +2 claims. |
| `phase22-referrals` **Flow 5a** | **Stronger.** Restores the Rule 11 audit-mechanism proof (row emitted, PHI-free metadata, correct `commission_id`) that an earlier round had dropped, adds a negative half. Critically, the positive `expect(PHI).toBeVisible()` now sits **outside** the `if (revealBtn.isVisible())` — the old version's "assert nothing" else-branch is gone. One conditional pair remains, but it is redundant with an unconditional `expect(html).not.toContain(PHI)` + `expect(afterStaffHat.length).toBe(before.length)` immediately after. |
| `qob-org-admin-content-wall` **member-and-configuration** | **Stronger.** One union test split into two per-hat tests; 8 → 22 assertions, all unconditional; each hat now also asserts the *other* hat's items are **absent**, which proves the composition is gone rather than merely re-personaing. This is the PO-ruled shape done properly. |
| `nsp-per-hospital` **AC-7** | **Narrower at the UI, stronger at the door.** The click-through dispose dialog is gone (forced — MAJOR-2); the mechanism is now driven at the RPC and gains a new `expect(metadata.acting_as).toBe('pqs_member')` D8 assertion plus PHI-free-metadata checks. The polarity flip `toContain(SUBJECT)` → `not.toContain(SUBJECT)` is **catalog-correct**: `dispose_referral_phi` sets `subject = '[PHI removido]'`. All expects unconditional. |
| `notifications` **N-1** | **Narrower at the UI.** The real assignment moved from the "Adicionar ação" dialog to a direct `add_capa_action` RPC, because a `pqs_member`-hatted operator's roster can no longer offer the CCIH assignee. The UI half is repurposed into a negative control (the option is absent). The notify-the-assignee-only mechanism and both isolation halves are unchanged. **N-3/N-4** are hat-threading only, otherwise byte-identical. |

**Vacuous-assertion check (BUG-VACUOUS-ASSERT-1 family) on the lead-audit session's own
rewrites:** AC-7's three tests, AC-8's, and N-1's contain **no** `expect` inside a conditional
branch, no `test.skip`/`fixme`, and no early return. Flow 5a's single conditional pair is
covered unconditionally immediately afterwards. **I found no new instance of the shape.**

**One thing I could not explain and am recording rather than skipping.** AC-7's old assertion
`expect(afterBody).toContain(REF_XHOSP_SUBJECT)` and the new
`expect(afterBody).not.toContain(REF_XHOSP_SUBJECT)` are direct opposites over the same
constant (`'Parecer sobre protocolo entre hospitais — Rede A'`), the same `REF_DETAIL_URL`
(`.../encaminhamentos/efa00000-…-a4`), and the same post-disposal state — and **both passed a
full gate**. The catalog says the new one is right. So the old one was passing for a reason
other than what it claimed (the disposal not actually landing, the page rendering a
frozen/cached title, or the assertion running before the redaction was visible). That is the
BUG-VACUOUS-ASSERT-1 family in a different costume — an assertion that measures something
other than its subject. Worth ten minutes before merge to confirm the *new* assertion is
measuring the right thing rather than inheriting the old one's confusion.

---

### ⚪ INFO-2 — PROGRESS.md's BUG-QOB-004 entry carries a superseded claim with no supersession pointer

The Bug Log entry states referral-PHI disposal *"is now **NSP-exclusive** (PQS operator of
source or target hospital)"* and that the pt-BR message *"is now 'apenas o NSP pode descartar
dados do paciente'"*. Both are false against the live catalog: the gate retains
`app.is_tenancy_admin_of(source_commission_id)` and the message is still *"apenas um
administrador da organização ou o NSP pode descartar dados do paciente"* — because
`20260917000400` restored the arm the same day, as PROGRESS.md:1273 records. Not a live defect;
but the two entries contradict each other inside a file that is loaded into every spawn, and
the Bug Log one reads as the authoritative narrative. Add the supersession pointer. (This
matters here because it is the record a reader consults when assessing MAJOR-2.)

---

### ⚪ INFO-3 — small notes, none actionable on their own

- **`app.active_role_selections`**: RLS enabled, `relacl = NULL` (no grants to `authenticated`),
  and `app` is not a PostgREST-exposed schema — so the table is unreachable except through
  `public.assume_role`. Its `active_role_selections_select_own` policy is therefore **vacuous**
  (a policy with no `GRANT` can never admit anyone). Harmless; note it so nobody later reads it
  as the boundary.
- **`assume_role`'s upsert** is `on conflict (session_id) do update` — correctly *targeted*
  (the repo's untargeted-`ON CONFLICT` lesson honoured), but the `do update` has no
  `where user_id = v_uid` guard. Not exploitable (`session_id` comes from the caller's own
  signed JWT and GoTrue session ids are unique), but the guard is one clause.
- **`audit_write` at switch time**: `assume_role`'s own audit row carries
  `metadata = {"role": "<new hat>"}` and, when switching hat→hat, will also carry
  `acting_as = <old hat>` — good provenance. On a first assumption there is no `acting_as`,
  correctly (you wore no hat while putting one on).
- **`actor_is_admin` on every audit row** is now hat-dependent (`audit_write` calls
  `app.is_admin()`). A `platform_admin` acting as something else will write
  `actor_is_admin = false`. That is right under D3, and provably a no-op today by the same
  tripwire, but it is a semantic change to a **historical** field that nothing records.
- **Architecture Rule 9 texture** (pre-existing, not ACT): `src/lib/members/actions.ts:227`,
  `src/lib/users/actions.ts:257,992` do inline `.from('memberships')` on the service-role
  client rather than going through `src/lib/queries/`. All three are post-authorization
  lookups, not gates.

---

## 3. Area-by-area answers to the brief

**1 · Is there a fourth class of hat-blindness?** **Yes — one.** It is BLOCKER-1's class:
*a boolean gate that RECEIVES the caller's uid as a parameter rather than reading `auth.uid()`*.
`app.is_admin_for` is its only member I found. Everything else came back clean, and here is how
I checked, so this reads as a real sweep and not a cherry-pick:

- **Views/matviews reading `memberships`:** the recorded claim is true, and for a stronger
  reason than recorded — `pg_class` holds **zero** relations of kind `v` or `m` in `public`,
  `app` or `test_helpers`. There is no view to be blind.
- **Functions reading `request.jwt.claims`:** re-derived from `pg_proc` across **all** schemas.
  Exactly four: `app.active_role`, `app.is_admin`, `public.assume_role`,
  `test_helpers.claims_for` (test-only) — plus Supabase's own `auth.uid/role/jwt/email` and
  `realtime.apply_rls`. The recorded "3" is correct.
- **Policies reading `memberships` raw:** three —
  `hospital_affiliations_select`, `profiles_admin_select`, `profiles_select_self_or_admin`. In
  all three the raw read resolves the **target's** scope and the **caller** is gated by
  `is_org_admin_of` / `is_hospital_admin_of` / `is_tenancy_admin_of` / `is_member_of`, all
  hat-aware. Correct shape. (The plan-QA r2 residual note — confirm the co-member arm uses
  `is_member_of` rather than a looser approximation — is satisfied: the arm is
  `app.is_active(auth.uid()) AND EXISTS (… them.principal_id = profiles.id AND app.is_member_of(them.commission_id))`.)
- **Trigger functions:** five touch `memberships`/`is_admin`/`has_role`. Four are
  audit/coherence/lifecycle. One, `public.guard_profile_privileged_columns`, reads
  `profiles.is_admin` **raw** — structurally hat-blind on the `is_admin`/`is_active` column
  guard. Same latency argument as BLOCKER-1 (no multi-role `platform_admin` exists), and it is
  a *guard* whose hat-blindness makes it no weaker, so I am not filing it separately — but it
  belongs in the same fix as `is_admin_for` if that fix is taken.
- **ACLs:** `assume_role` → `authenticated` ✓; `custom_access_token_hook` →
  `supabase_auth_admin` ✓; `grant_role_for`/`revoke_role_for`/`affiliate_person_for` →
  `service_role` only ✓.
- **Application layer (TS):** all 13 `getRawGrants()` call sites are exactly
  {picker, D9 hint, "Trocar papel" switcher passthrough} — none feeds a gate. Only three raw
  claim reads exist in `src/`, all routing/identity, none authorization. Every
  `createAdminClient()` (service-role) mutation is gated first on a `getSessionContext()`-derived
  field. `src/app/page.tsx` places `needsRoleSelection → /selecionar-perfil` **before** every
  other branch. `src/proxy.ts`'s matcher excludes only `api/health` and `api/webhooks` — the
  picker and `assume_role` are reachable (the repo's recorded "matcher redirected the webhook
  to /login" trap does not recur).
- **Non-boolean DEFINER doors:** the 31-row classification holds where I spot-checked it. All
  the target-keyed raw `memberships` readers (`eligible_voters`,
  `commission_staff_admin_of_case`, the `list_*` rosters, `nsp_org_roster`) are correctly
  hat-blind — one user's hat must not change what the system concludes about another.

**2 · `has_role` / `has_role_any` caller-only binding.** Correct. From the catalog, both carry
`(p_user_id is distinct from auth.uid() or <role> is not distinct from app.active_role())` —
the hat applies to the caller only, third-party queries are unaffected. **The BUG-ACT-NULLHAT-1
fix is present and right:** `IS NOT DISTINCT FROM`, so a hatless caller yields `FALSE`, never
`NULL` (I confirmed the live values: hatless ⇒ `is_member_of = false`, `is_org_admin_of = false`,
both non-null). **The both-NULL hole cannot reopen**: if a caller passed `p_role => NULL` the
hat clause would be true, but the `exists()` above it evaluates `m.role = NULL` ⇒ `NULL` ⇒ no
row ⇒ the conjunction is `FALSE`. The module comment correctly declines to rely on that as a
second line of defence. `has_role_any` places the condition on `m.role` *inside* the `exists()`,
which is equivalent and, unlike the ADR's "reimplement as `has_role(…, active_role)`" sketch,
preserves third-party semantics.

**3 · `assume_role`.** All three properties verified, two of them live.
**Not circular:** the `platform_admin` branch reads `public.profiles.is_admin` directly and
never calls `app.is_admin()` — so a multi-role platform admin can switch *into* the hat from
another hat. **Validates holding:** the non-platform branch selects the actual membership row
and raises `42501 'papel não disponível para este usuário'` when absent — I drove
`assume_role('nsp_coordinator')` as `dualhat.a@` (who holds `org_admin` + `quality_reviewer`)
and got exactly that. **Stamps the assumed role's own tenancy:** driving
`assume_role('quality_reviewer')` produced
`action=active_role.assumed org=0c00…0a hosp=0500…0a comm=NULL meta={"role":"quality_reviewer"}
actor_is_admin=false` — a real scope, not all-NULL. The `platform_admin` all-NULL carve-out is
the deliberate one. One nit: when a principal holds the same role in several scopes, the row is
picked `order by granted_at desc limit 1`, so the stamped scope is arbitrary among them; D2
puts scope on the existing switchers, so this is defensible, but it should be *stated* in the
ADR rather than left to `limit 1`.

**4 · The D9-hint fix.** See MINOR-2 — (a) no grant data reaches the client from any of the
7 mounts, verified prop-by-prop; (b) D9 behaviour intact on all three counts; (c) no
client-value-import trap; and yes, four other client components in this diff still receive the
full `SessionGrant[]`, which is the consistency point.

**5 · The union-capability-loss rescopes.** See INFO-1 — my honest judgement is that none was
weakened to pass.

**6 · Vacuous assertions.** None found in the lead-audit session's own rewrites; AC-8's
keyboard proof is real but narrowed (MINOR-3), and the phase requirement is met by
`act-role-assumption.spec.ts`'s own keyboard-only picker test.

**7 · The dispose-PHI capability loss.** Catalog-confirmed and escalated — MAJOR-2.

**8 · `audit_write` D8 / Rule 11.** Correct.
`v_acting_as := app.active_role(); if not null then v_metadata := v_metadata || jsonb_build_object('acting_as', v_acting_as)`.
It is a **role label only** — the value originates in `custom_access_token_hook`, which sets the
claim exclusively from `app.active_role_selections.role` (the `platform_role` enum) or from
`memberships.role`, and the JWT is GoTrue-signed so a client cannot author it. **It can never
carry PHI.** **The hash chain is unaffected in the right way:** `v_metadata` — with the stamp —
is passed to `app.audit_canonical` *before* the digest, so the stamp is inside the chain, with
no change to the hash function (exactly D8's claim). **The three exact-keys tests were not
bent:** `140_patient_safety.sql:325`, `150_referrals.sql:370`, `151_case_patient.sql:248,351`
still assert **whole-object equality** on `metadata` — they moved from `'{}'` to
`'{"acting_as": "staff_admin"}'` (and `{reason, acting_as}` for the disposal row). An
exact-equality assertion updated to a new exact key set is the strongest available shape and
still fails on any PHI leakage into metadata.

**9 · D1–D14 walk.** Below.

**10 · Knowingly-broken state.** The `navScope` branch — MINOR-1, confirmed dead, acceptable
to defer with a tripwire.

---

## 4. Requirements audit — ADR 0106 D1–D14

| D | Delivered? | Evidence |
| --- | --- | --- |
| **D1** governance/audit driver | ✅ | `acting_as` in every audit row (D8) + `active_role.assumed` events |
| **D2** unit is the role TYPE, derived from live grants | ✅ | picker options = `getSelectableRoles(getRawGrants())` → `{role, count}`; `session_context` derives from `memberships`, no hand-written list |
| **D3** strict — the active role is the ONLY role | ⚠ **mostly** | proven live at the seam (`is_member_of`/`is_org_admin_of` mutually exclusive). **Two residual arms escape it:** BLOCKER-1 (`is_admin_for`) and MAJOR-1 (`can_manage_professional` expired arm) |
| **D4** strict applies to reads AND writes | ✅ | enforcement is in `has_role`/`has_role_any`, consumed identically by `SELECT` and `UPDATE` policies |
| **D5** fail CLOSED | ✅ | `IS NOT DISTINCT FROM` (BUG-ACT-NULLHAT-1); hatless ⇒ all derived lists `[]`; hook mints **no key** rather than a JSON null |
| **D6** relationships immune | ✅ | `is_case_respondent`, `is_recused_from_case`, `is_document_approver_of`, `is_document_version_approver` all confirmed hat-free in the catalog; so are the adjacent relationship gates I classified (`is_case_excluded`, `referral_target_analyst`, `confidentiality_clearance_ok`, `attachment_confidentiality_ok`, `can_access_targeted_*`, `can_read_correction_response`) |
| **D7** fresh each session, indicator visible | ✅ | selection keyed on `session_id`; a new session has no row ⇒ implicit derivation or picker. `UserMenu` hat indicator + "Trocar papel" threaded to 9 render sites |
| **D8** audit stamps the active role; switching audited | ✅ | see area 8 |
| **D9** blocked action explains itself from own grants | ✅ | `RoleSwitchHint`, 7 mounts + the global boundary; excludes the active hat; renders nothing at 1 role |
| **D10** big bang, no flag | ✅ | no feature flag exists for ACT; the migration is the cutover |
| **D11** `platform_admin` is a hat · `service_role` exempt | ⚠ **half** | `is_admin()` ✅ with the correct `IS NOT DISTINCT FROM`; break-glass ✅ (hook derives implicitly at exactly one live role type, no UI in the path — the `315` control/restore pair drives the **real** hook). **`is_admin_for` ✗ — BLOCKER-1.** `service_role` exemption holds (no `auth.uid()` ⇒ hat clause bypassed by construction) |
| **D12** hat in the JWT, server-minted | ✅ | `custom_access_token_hook`; `app.active_role()` reads `request.jwt.claims->>'active_role'`; client never authors it |
| **D13** administrativo rides the committee hat | ✅ | `app.member_can` conjoins `app.is_member_of` → `has_role_any` (caller-bound). The fail-OPEN the ADR predicted is closed — under a non-committee hat `is_member_of` is `false`, so `member_can` is `false` |
| **D14** case bitmask classified arm by arm | ✅ **for S3's purposes** | I traced every arm of `app._case_caps` from the catalog: role-derived → S6 `is_pqs_operator_of_for`, S1 `is_staff_admin_of_for`, S2 `is_tenancy_admin_of_for`, S5 `is_member_of_for`, S7 `is_quality_reviewer_of_for` — all reach `has_role`/`has_role_any`, caller-bound; relationship-derived → S3 `case_access_grants`, S4 `case_phases`/`case_narratives` assignment, and the STEP-4 hard denies. **No arm unclassified.** The formal S4 record + the two designed hat-blind allowlist entries are still outstanding, as planned |

**D11's "provably a no-op today" claim — verified, both halves.** The catalog shows exactly one
`platform_admin` (`00000000-…-b0`) holding **0** memberships, so `claims.is_admin` and
`activeRole === 'platform_admin'` cannot diverge. The **tripwire is real**:
`315_act_stage3_hat_condition.sql:20-36` asserts *"no platform_admin holds any membership row"*,
so a future violation reds the suite instead of silently widening. ⚠ It is a **seed assertion,
not a constraint** — nothing in the schema prevents an `org_admin` from seating the platform
account on a commission, which is precisely BLOCKER-1's activation path. Worth saying in the
ADR that the no-op argument is contingent, not structural.

---

## 5. What I did not verify

- **The gate numbers** (e2e:prod 996/0/2 + the batch-8 re-run 61/61, pgTAP 178/5679,
  `ARM=census` 450/461, `ARM=floor` 80, lint 0/0, tsc, Vitest 1194). Not re-run, per the brief.
  I did re-derive `ARM=census`'s premise independently: `app.active_role()` returns `text` and
  so is correctly outside the boolean-gate population.
- **Flow 1b's coverage of Flow 3d's relocated claim** — read from the spec, not executed.
- **The AC-7 polarity puzzle** (INFO-1's last paragraph) — I established from the catalog which
  assertion is correct, not why the other one passed.
- **`dispose_event_phi`** (FUP-QOB-3) for the same UI-reach shape as MAJOR-2 — flagged, not
  swept.
- **`guard_profile_privileged_columns`'s** full reachability under RLS — I confirmed it reads
  `profiles.is_admin` raw but did not drive a live update through it.

---

## 6. Closing

This is a strong stage. The central mechanism — one enforcement body, caller-only binding, the
`IS NOT DISTINCT FROM` fail-closed fix found before shipping, the single `hatFilteredGrants`
seam that corrected 88 application call sites at once, the deliberate and *documented*
hat-blind exemption for `session_context`, and D14's arms each traceable to an enforcement point
or a D6 relationship — is right, and I could break none of it. The three post-build classes were
found and closed honestly, and the record of them is unusually candid.

It fails on one thing, and it fails on it for the reason this repo has written down more than
once: **an enumeration's boundary must be the property, not the syntax.** `is_admin_for` was
excluded because of the shape of its signature rather than the binding at its call sites, and
the buildnotes wrote that exclusion down as a verified fact. Fix that gate, keystone it
red-first, re-run the diff-scoped sweep over it, and amend the two records that now assert
something untrue (buildnotes :1453-1459 and the `authz-a30` "dead code" line). MAJOR-1 needs a
disposition amendment, not a fix in this stage. MAJOR-2 needs a re-scoped follow-up and a
decision before pilot.

**Round 1 verdict: CHANGES REQUESTED.**

---

# 7. Round 2 — re-review of the `f4362fc` / `8486497` fix

- **Verdict: APPROVED**
- Head `8486497` (`f4362fc` = the fix, `8486497` = the gate record). Diff over r1's
  `4441d3e`: 1 migration, 1 pgTAP file, 3 doc files. No app code, no spec changes.
- Everything below was re-derived from the **live catalog** or driven as a **live probe**.
  I did not take a single number from the round-2 brief on trust, and one of the claims in
  it does not survive contact (INFO-5).

## 7.1 The fix, read from the catalog

Both bodies now carry the caller-only pattern, and both are `CREATE OR REPLACE` — no
`DROP`/`CREATE` anywhere in `20260918002800` (grepped; the only `grant` hits in that file
are prose about the "membership-grant door"):

```
app.is_admin_for(p_user_id uuid):
  exists(select 1 from public.profiles where id = p_user_id and is_admin = true)
  and (p_user_id is distinct from (select auth.uid())
       or app.active_role() is not distinct from 'platform_admin')

app.can_manage_professional(p_org, p_uid) — the expired-staff_admin arm:
  exists(… m.role='staff_admin' and m.expires_at is not null and m.expires_at <= now())
  and (p_uid is distinct from (select auth.uid())
       or app.active_role() is not distinct from 'staff_admin')
```

`IS NOT DISTINCT FROM`, so a hatless caller yields `FALSE`, never `NULL` — the
BUG-ACT-NULLHAT-1 discipline applied consistently. The `service_role` exemption survives by
construction: with `auth.uid()` NULL, `p_user_id is distinct from NULL` is TRUE and the
third-party arm answers.

**✅ BLOCKER-1 — CLOSED.** **✅ MAJOR-1 (hat dimension) — CLOSED.**

## 7.2 Q1 — is it the class, or just the two instances? *(re-derived independently)*

Your concern was right to raise: fixing the two functions I named would be an
instance-bounded sweep. So I re-derived the population by the **property** instead, and I
had to build a real tool to do it, because my r1 method could not have found it.

**Method.** For all 928 functions in `app` + `public`: a balanced-paren extractor pulls
every call's full argument list from the comment-stripped `prosrc`, splits it on
**top-level** commas, and maps each argument to the callee's parameter position — **4,501
call-argument observations**. Level 0 = an argument that is literally `auth.uid()`; then
propagate: if callee `C`'s parameter at position *p* is caller-bound, any call inside `C`
passing that parameter name is caller-bound too. Converged in 2 hops.

> ⚠ **My r2 first attempt was wrong the same way my r1 sweep was, and it is worth
> recording.** A regex with one level of paren nesting silently missed
> `grant_role_impl((select auth.uid()), …)` — two levels deep — so `is_admin_for` did not
> appear in its own population. A sweep for "who receives `auth.uid()`" that uses a regex
> cannot see the argument it is looking for as soon as anyone writes `(select auth.uid())`,
> which is this codebase's *house style*. Balanced-paren extraction is the only sound tool
> here.

**Result: 61 caller-bound `(callee, parameter)` pairs.** Cross-referenced against the
strict-edge transitive closure to the four hat gates: **51 reach a hat gate, 10 do not.**
All ten are correctly hat-free, and here is each one's reason so this reads as a real
classification rather than a wave-through:

| Survivor | Why it is correctly hat-blind |
| --- | --- |
| `is_case_respondent`, `is_recused_from_case` | the two **D6-named** immunes (protective — a hat change must not clear a recusal) |
| `is_case_excluded` | `= respondent OR recused`; inherits D6 |
| `referral_target_analyst` | phase/narrative assignment + `case_access_grants` rows — relationship-derived |
| `can_access_targeted_response` | participant → professional-profile → `user_id` link — relationship-derived |
| `can_write_targeted_response` | delegates to the above + a `status='in_progress'` check |
| `can_read_correction_response` | `case_correction_requests.permitted_corrector = p_uid` — relationship-derived |
| `attachment_confidentiality_ok` | `case_access_grants.max_confidentiality` rank — relationship-derived |
| `is_active` | identity-free lifecycle (`profiles.is_active` + `suspended_until`) |
| `_grant_case_access_unchecked` | a pure INSERT helper — the `auth.uid()` it receives is the **grantee**, not a gate input; both callers (`create_case`, `create_case_from_template`) gate the caller upstream with `is_staff_admin_of(...) or is_admin()`, both hat-aware |

**Answer: no third member exists.** The fix closes the class, not just the instances.

## 7.3 Q2 — third-party semantics *(verified, and beyond what 318 covers)*

318 assertion 5 covers `is_admin_for(other)` and it stays green under both the fixed and
the neutralized catalog (§7.5), so it is a genuine control.

318 does **not** cover the third-party path of `can_manage_professional`, so I drove it.
An unrelated principal asking about a target who holds an expired `staff_admin`:

```
asker hat = staff            -> true
asker hat = quality_reviewer -> true
asker HATLESS                -> true
```

Invariant across all three. ✅ One principal's hat does not change what the system concludes
about another, on both fixed gates.

## 7.4 Q3 — break-glass: intact, but **the E2E evidence you cited does not cover it**

**The path is intact.** 318 assertion 8 (`lives_ok` on `public.grant_role('hospital', …,
'hospital_admin', …)` under the `platform_admin` hat) exercises the genuinely caller-bound
door, and I re-ran it green on the fixed catalog. ADR 0097 D17's provisioning path survives.

**But `platform-org-admin-provisioning.spec.ts` is not evidence of that.** Its own docblock
(lines 9-22) says it drives `assignOrgAdmin` → **`public.grant_role_for`**, the *service*
door — `proacl = {postgres, service_role}`, no `authenticated` — invoked on the service
client where, in its own words, `auth.uid()` is *"absent"*. With `auth.uid()` NULL,
`is_admin_for(p_actor)` takes the **third-party** arm, which the fix structurally cannot
touch. That spec would have been 3/3 green before the fix, after the fix, and after a
*broken* fix. It proves the wiring it was written to prove; it proves nothing about D11.

Filed as **INFO-5** below. The real coverage is 318 #8 — which is the right test, and it
exists.

⚠ One consequence worth stating, because it widens D11's own recorded risk: the fix extends
the picker dependency from `is_admin()` to the **membership-grant door itself**. A
`platform_admin` who ever becomes multi-role and has not picked a hat can no longer grant or
revoke — correct under D5, but D11 says the break-glass hat *"must never depend on the
picker, so no UI sits in the recovery path"*. The `315` tripwire (no `platform_admin` holds a
membership; re-verified: 1 admin, 0 memberships) is now **doubly load-bearing** — it guards
both the no-op argument and the recovery path. Worth one line in the ADR.

## 7.5 Q5 — keystone 318 non-vacuity: **independently reproduced**

I did not take the red-first record on trust. I ran the neutralization oracle myself:
captured `md5(pg_get_functiondef(...))` for both gates, ran 318 against the fixed catalog,
then `CREATE OR REPLACE`d both back to the **pre-fix bodies from my own r1 catalog dumps**,
re-ran 318, then restored from the migration.

| Run | Result |
| --- | --- |
| 318 vs **fixed** catalog | **11/11 ok** |
| 318 vs **neutralized** catalog | **not ok 3 · not ok 6 · not ok 7 · not ok 11** — 7 controls green |
| Restore | `can_manage_professional` `md5=dc1c7cc4…71f`, `is_admin_for` `md5=df975b25…4a3` — **byte-identical to the pre-neutralization baseline** |

Exactly the four ⭐ assertions you recorded, and no others. Assertion 6 — `grant_role`
succeeding under the staff hat — reproduces the r1 BLOCKER through the keystone itself.
**The keystone bites.** ✅

pgTAP arithmetic reconciles exactly: 318 declares `plan(11)` and I watched 11 assertions
run; r1 baseline 178 files / 5679 tests → 179 / 5690 is +1 file / +11 tests. ✅
`ARM=census` unchanged at 450/461 is consistent — the fix added no gate to the boolean
population, it amended two existing members.

## 7.6 Q6 — catalog property diff *(re-read, not assumed)*

Post-restore, both functions:

```
secdef=true | vol=s (STABLE) | strict=false | leakproof=false | owner=postgres
config={"search_path=app, public, pg_catalog"}
acl={postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres}
```

The ACL matches the sibling shape exactly (`has_role`, `has_role_any`,
`is_org_admin_of_for`), the `search_path` pin survived, `SECURITY DEFINER` and `STABLE`
survived, the owner is unchanged. The migration contains no `GRANT`/`REVOKE`/`DROP`, and
`CREATE OR REPLACE` cannot drop an ACL — corroborated incidentally by my neutralized
replace (also GRANT-less) still being executable by `authenticated` inside 318. **No
property lost.** ✅

## 7.7 Q4 — did you smuggle a tightening? *Not in the predicate. Partly in the outcome.*

The expiry predicate is **byte-identical**; only the hat conjunct is new. And the quirk
genuinely survives — I proved it against a **reachable** production shape, which is stronger
than 318 assertion 10 claims for itself:

```
principal: LIVE staff_admin in org A  +  EXPIRED staff_admin in org B
implicitly derived hat = staff_admin   (no picker needed — one live role type)
can_manage_professional(orgB, self) = true      <- the quirk, alive
has_role('commission', comm_B, 'staff_admin') = false   <- control
```

**But the outcome did change for one population, and the brief's "only the hat dimension
moves" does not quite cover it.** A principal whose *only* `staff_admin` membership is the
expired one can never obtain the `staff_admin` hat — `assume_role` validates live holding
and `custom_access_token_hook` derives only from live memberships. So for them the arm is
now permanently unreachable. Probed:

```
expired-only principal, asking about itself:
  implicitly derived hat = <null>  ->  can_manage_professional = false   (was TRUE pre-fix)
```

That is BUG-ACT-EXPIRY-1's own tightening, arriving early, for the bug's *main* population —
achieved not by touching expiry but by making the hat unobtainable. It narrows in the safe
direction and follows inevitably from applying D5 correctly, so I am **not** asking you to
undo it. Two record corrections instead (**MINOR-4**):

1. BUG-ACT-EXPIRY-1's residual scope is now narrower than its text implies. It survives
   **only** in the cross-org shape above — live `staff_admin` in another org plus an expired
   one in `p_org`. Single-org expired principals are already tightened.
2. **318 assertion 10 pins an unreachable state when a reachable one exists.** Its comment
   is honest (*"asserts the FUNCTION's logic, not a reachable production journey"*), but the
   cross-org fixture above pins the same claim against a state a real user can occupy, with
   an implicitly-derived hat and no synthetic claim. That is the stronger positive twin.

## 7.8 Round-2 findings

- 🟡 **MINOR-4** — the two record corrections in §7.7 (BUG-ACT-EXPIRY-1's narrowed residual
  scope; 318 assertion 10's fixture).
- ⚪ **INFO-4** — 318 assertion 4's message says *"the two siblings now **AGREE** under a
  non-matching hat"*, but the assertion is `ok(not app.is_admin())` — it measures one
  sibling. Under neutralization it stayed **green** while the siblings genuinely disagreed.
  The claim is established by #3 and #4 *together*; #4 alone cannot detect the divergence it
  names. Harmless (the real distinguishing assertion is #3), but it is the shape you asked
  me to watch for: a message asserting more than its expression checks. Re-word, or fold
  both reads into one assertion.
- ⚪ **INFO-5** — `platform-org-admin-provisioning.spec.ts` is not coverage of the D11
  caller path (§7.4). Its 3/3 green should not be cited as break-glass evidence for this
  fix; cite 318 #8 instead. Note the structural point it reveals: `assignOrgAdmin`, the
  platform admin's *real* provisioning path, runs on the service client and was therefore
  **never** exposed to the hole. The hole lived on `public.grant_role`, the `authenticated`
  PostgREST door — Rule 1 in one sentence: the TS layer was never the boundary.

## 7.9 Your three open questions

**MAJOR-2 (LGPD erasure) — your disposition is right; I would not block S3 on it.**
Blocking would require someone to decide *where* the affordance remounts, which is a product
decision neither of us owns, and the alternatives (re-open the commission route to tenancy
admins; add a tenancy-scoped disposal surface; give NSP a hospital-scoped one) have real
governance consequences that ADR 0100's content wall was built to prevent. What made it a
finding was never "it is unfixed" — it was that the follow-up did not carry the LGPD framing
or the `20260917000400` precedent, so nobody downstream would know a ratified regulatory
ruling had been voided by a different mechanism. You have fixed exactly that. My one ask:
make it a **pilot-gate check**, not a follow-up-list entry — this program's own record shows
"standing in prose alone" once meant a thing ran once in three weeks (ADR 0079). And sweep
`dispose_event_phi` (FUP-QOB-3) for the same UI-reach shape before pilot, since the sibling
was the door that surfaced the LGPD reasoning in the first place.

**The AC-7 polarity thread — worth one hour, not a program.** Two assertions that are exact
opposites over the same constant, same URL, same post-disposal state, both green across full
gates: at least one was not measuring its subject. The catalog says the new one is right, so
the *current* risk is low — but the cheap, high-value question is not "why did the old one
pass", it is **"is the new one passing for the right reason?"** Run it with the disposal step
removed: `expect(afterBody).not.toContain(REF_XHOSP_SUBJECT)` must go **RED**. If it stays
green, the assertion is measuring page state that never contained the subject, and *that*
would justify a broader pass. One targeted run answers it. I would not open a repo-wide
assertion-reliability audit on this evidence alone; `BUG-VACUOUS-ASSERT-1` already owns that
population.

**Where the sweep lesson belongs — `docs/progress/authz-handoff.md` §7.** It is the file
CLAUDE.md §5 already makes mandatory reading before any authorization or RLS work, it already
holds the sibling lessons ("text is not truth", "`prosecdef` belongs beside `pg_policies`"),
and this is the same genus. Two sentences, stated as a rule rather than a story:

> **A caller gate can RECEIVE the caller's uid instead of reading it.** Classify by the
> *call-site binding* (`p_uid := auth.uid()`), never by the signature's shape — a
> parameterized gate is not automatically third-party-safe.
> **Call-graph sweeps must use balanced-paren extraction, not regex.** An identifier
> substring matches columns as well as functions (the `is_admin` column vs the `is_admin`
> function), and a one-level regex cannot see `f((select auth.uid()))` — this codebase's
> own house style. Both errors report closure they have not proved.

The second half also belongs in ADR 0079 as an amendment, since it constrains how the
standing door-audit derives its population — and `docs/progress/authz-a30-platform-admin-inventory.md:77`
(*"`app.is_admin_for()` … is dead code"*, now 3 callers) should be corrected at the same
time; it is a live example of the first rule failing.

## 7.10 Round-2 status of the round-1 findings

| r1 finding | Status |
| --- | --- |
| 🔴 **BLOCKER-1** `is_admin_for` hat-blind caller gate | ✅ **CLOSED** — catalog-verified, red-proven by my own neutralization run (318 #3/#6/#7), class re-derived by property with no third member |
| 🟠 **MAJOR-1** `can_manage_professional` expired arm | ✅ **CLOSED** (hat dimension) — 318 #11 red-proven; third-party invariance separately probed; see MINOR-4 on the residual scope |
| 🟠 **MAJOR-2** LGPD erasure reachability | 🟡 **Correctly dispositioned** — re-scoped to close-before-pilot with the `20260917000400` citation. Not an S3 blocker; make it a pilot-gate check |
| 🟡 MINOR-1 `navScope` dead branch | open, S4, acceptable |
| 🟡 MINOR-2 RSC grant-serialization consistency | open, record correction |
| 🟡 MINOR-3 AC-8 keyboard narrowing | open, folded into FUP-ACT-DISPOSE-UI |
| ⚪ INFO-1/2/3 | unchanged |

## 7.11 Closing

The fix is correct, complete for its class, non-vacuously tested, and property-preserving —
and the two claims I could most easily have taken on trust (the red-first record and the
break-glass coverage) are the two I checked hardest: one reproduced exactly, one turned out
to be pointing at the wrong test. That is the right ratio for a round 2.

What earns the approval is not that the two gates are patched — it is §7.2. You asked the
question that mattered ("did I close the instances and miss the class?"), and the
property-bounded re-derivation says the class is closed: 61 caller-bound parameters, 10
without a hat path, all ten hat-free for a reason that survives being written down.

Residual: one MINOR (two record corrections), two INFO, and three r1 MINORs already carried
to S4. Nothing blocking.

**Round 2 verdict: APPROVED.**
