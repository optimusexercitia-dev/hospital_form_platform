# ACT Stage 3 (frontend) — role picker, hat indicator, D9 hint

**Status:** design note, not yet built · **Owner:** `frontend` · **Program:** ACT (ADR
[0106](../decisions/0106-act-as-role-assumption.md)) · **Source:** the
[implementation plan](../plans/act-as-role-assumption.md) §4 Stage 3 "Frontend" + §6
· ADR 0106 D4, D5, D9, D11

This is a **design note only** — no component code, no route files. It exists so
Stage 3's actual build works from an extracted, reviewable mapping instead of
re-deriving one mid-build (the exact failure mode ADR 0101 exists to close, one level
up: a remembered picker-route list would be as fragile as a remembered
role→landing list).

---

## 1. The role → landing-route table (extracted, not invented)

### 1.1 Source

`src/app/page.tsx` (the root `Home()` Server Component) carries the routing chain's
own doc comment at **lines 12–24** (precedence list) plus the per-branch prose
comments through **line 154**. The **11** `public.platform_role` enum values (10
`memberships_role_check` values + `platform_admin`, per
`supabase/migrations/20260918000000_act_platform_role_enum.sql:56-68`, confirmed in
`src/lib/types/database.ts:17173-17184`) map onto that comment as follows.

| # | `platform_role` value | Landing route | Comment line(s) | Code (branch) |
| --- | --- | --- | --- | --- |
| 1 | `platform_admin` | `/admin` | `page.tsx:13` | `page.tsx:60-62` (`context.isAdmin`) |
| 2 | `org_admin` | `/o/<org>/manage` (1 org) · `/o` (>1 org — scope picker, not a hat decision) | `page.tsx:14-15` | `page.tsx:64-70` |
| 3 | `hospital_admin` | `/o/<org>/manage` (1 org) · `/o` (>1 org) | `page.tsx:16-17` | `page.tsx:78-86` |
| 4 | `nsp_org_admin` | `/o/<org>/nsp-org` | `page.tsx:18` | `page.tsx:94-96` |
| 5 | `nsp_coordinator` | `/o/<org>/nsp` (grouped with `pqs_member` — routing does not distinguish them) | `page.tsx:21` | `page.tsx:123-125` |
| 6 | `pqs_member` | `/o/<org>/nsp` (same as above) | `page.tsx:21` | `page.tsx:123-125` |
| 7 | `technical_director` | `/o/<org>/direcao-tecnica` (grouped with `technical_director_deputy` — D1 makes them one authority) | `page.tsx:22` | `page.tsx:135-139` |
| 8 | `technical_director_deputy` | `/o/<org>/direcao-tecnica` (same as above) | `page.tsx:22` | `page.tsx:135-139` |
| 9 | `quality_reviewer` | `/o/<org>/qualidade` | `page.tsx:23` | `page.tsx:152-154` |
| 10 | `staff_admin` | **GAP — see below** | — | `page.tsx:98-105` (generic) |
| 11 | `staff` | **GAP — see below** | — | `page.tsx:98-105` (generic) |

Fallback for anyone the picker would never route (should not occur once the picker
enumerates from live grants): `page.tsx:156-158`, the "Você ainda não tem acesso"
screen.

### 1.2 The named gap: `staff_admin` / `staff`

The doc comment does **not** name these two roles individually anywhere in lines
12–24. It describes their landing generically, by grant **count**, not by role name:

> `page.tsx:19` — "exactly one commission membership → `/o/<org>/c/<commission>`"
> `page.tsx:20` — "more than one membership → `/c` (grouped picker)"

This is a real gap in the comment (every other line names its role explicitly; these
two don't), but it is **not** an ambiguity in the code: `context.memberships` is
populated by exactly one filter,
`src/lib/queries/session-grants.ts:82-98` —

```ts
g.commission !== null && g.commission.organization !== null &&
  (g.role === 'staff' || g.role === 'staff_admin')
```

— so the route for both is unambiguous: `/o/<org>/c/<commission>` when the caller
holds exactly one commission-scoped membership, `/c` when they hold more than one
(both commission-COUNT disambiguation, same class as the org_admin/hospital_admin
`>1` branches — not a hat decision, D2's "scope stays with the switchers that already
exist"). **Reporting this as instructed rather than inferring silently:** Stage 3
should add two explicit lines to `page.tsx`'s doc comment (`staff_admin of ≥1
commission → …`, `staff of ≥1 commission → …`) so the comment stops being the one
place in the file that names 9 of 11 roles by name and the other 2 by proxy. This is
a documentation completeness fix, not a routing defect — flagging it because the task
brief said an invented route is worse than a named gap, and a *silently inferred*
route is the same risk one step removed.

### 1.3 Why this table is really a *by-role* table, not a *by-precedence* table

Post-Stage-3, `has_role`/`has_role_any` bind to `app.active_role()` (D3, D12). Every
RLS-scoped read behind `getSessionContext()`'s partition (`orgAdminOf`,
`hospitalAdminOf`, `memberships`, `nspOrgAdminOf`, `nspOperatorOf`,
`technicalDirectionOf`, `qualityReviewerOf`) will therefore return rows for **at
most one** of those seven fields for any given request — the caller's one active
hat. The `if/else if` chain in `page.tsx` stops being an ordered *guess* among
several simultaneously-populated fields (today's bug, ADR 0106 Context) and becomes,
for a real post-cutover user, a chain where only one branch can ever match. The
**order** of the branches becomes irrelevant for correctness (though the code can
keep its current order — nothing requires reordering `page.tsx` in Stage 3). What
changes is upstream of `page.tsx`: the **picker's own option list** cannot use
`getSessionContext()` (hat-scoped, and no hat exists yet for a picker-bound user) —
it must read the **hat-blind** raw grant list, i.e. the same `session_context()` RPC
`partitionGrants` already consumes, collapsed to distinct role types (D2). That data
source already exists and needs no new backend surface — see §3.

---

## 2. The current post-login chain — and a second chain the plan does not mention

### 2.1 What the plan assumes

The plan (§4 Stage 3) describes inserting the picker "as a new first step in the
`page.tsx` chain." That is accurate for a user who lands on `/` — but it is **not**
the only place a decision is made today.

### 2.2 What is actually in the codebase: two independent chains

**Chain A — `src/app/page.tsx`, `Home()` (lines 45-159).** Runs whenever a request
hits `/` — after `signIn`'s fast-path redirect (below) misses, on a direct hit
(bookmark, browser history, a stale tab), or via `resolveLanding`'s own fallback.
Reads `getSessionContext()` (cached, RLS-scoped), branches through the 11-role table
in §1, `notFound()`/`redirect()`-free (uses `redirect()` only).

**Chain B — `src/lib/auth/actions.ts`, `resolveLanding()` (lines 96-141), called from
`signIn()` at line 217.** This is a **second, independent, partial precedence chain**
that the plan's Stage 3 section never names. It:

- Runs **first**, immediately after `signInWithPassword` succeeds, before any
  redirect — it is what actually decides where a just-authenticated user goes.
- Queries `memberships` and `profiles` **directly via raw `supabase-js`** (lines
  100-112), not through `getSessionContext()`/`session-grants.ts` — a second,
  hand-rolled implementation of the same partition ADR 0101 exists specifically to
  keep from drifting.
- Only checks **4 of the 11 roles**: `platform_admin`, `org_admin` (1/>1 org),
  commission membership (1/>1). Its own doc comment (lines 88-94) documents exactly
  those 4 and nothing else — it predates `hospital_admin`, `nsp_org_admin`,
  `nsp_coordinator`/`pqs_member`, `technical_director`(`_deputy`), and
  `quality_reviewer` all being added to Chain A over time (ADR 0101's own recorded
  pattern — a role added to one seam and not the other).
- Falls through to `'/'` (line 140) for everything it doesn't recognize, which is
  why this has been *behaviorally* safe until now: an `hospital_admin`-only user
  takes one extra hop through Chain A and lands correctly. **This safety property
  breaks under the picker.**

### 2.3 The gap this creates for the picker

`resolveLanding()` never consults an `active_role` claim and never checks whether the
caller holds more than one role **type**. A user who is simultaneously `org_admin` of
one org and `quality_reviewer` of a hospital in it (the plan's own Stage 1 test
persona, `dualhat.a@test.local`) hits the `org_admin` branch (line 122) **first** and
is redirected straight to `/o/<org>/manage` — **without ever passing through `/`,
and therefore without ever reaching the picker.** This is not a hypothetical: it is
the exact "a role crosses one seam and not the other" class ADR 0101 was written to
close, recurring one layer up, for the picker gate itself.

**This is flagged, not silently worked around**, per the task brief. It sits outside
this note's scope (`src/lib/auth/actions.ts` is a `src/lib/**` domain module —
backend-owned, not frontend's to edit) but a Stage 3 plan that only touches
`page.tsx` ships a picker roughly half its target users can walk straight past. See
§7 Open Questions — this needs a backend-owned decision before Stage 3 build, not a
frontend workaround (frontend cannot fix a backend-owned file, and inventing a
duplicate check in `page.tsx` alone would leave Chain B's raw-SQL guess live and
un-hat-aware, which is precisely the "two implementations of one partition" defect
ADR 0101 diagnosed).

### 2.4 Where the picker step inserts (assuming §7's Q1 resolves toward "one decision point")

Both chains need the same test before doing anything else: **does the caller's
current JWT carry an `active_role` claim?** (D12 — minted at sign-in, implicitly for
single-role, absent for multi-role with no selection yet, D5.) Concretely:

- **Chain A (`page.tsx`)** — insert immediately after the `isInactive` /
  `mustChangePassword` gates (after line 58, before line 60's `isAdmin` check — the
  existing precedent: `/primeiro-acesso`'s own must-change gate already sits in this
  exact position in the account-status precedence). If the session has no
  `active_role` claim **and** the caller's hat-blind grant list (§3) spans more than
  one role type, `redirect("/escolher-papel")` (route name proposed in §3.1 — needs
  lead sign-off, see §7). Otherwise, proceed exactly as today — the branches
  themselves are unchanged (§1.3).
- **Chain B (`resolveLanding`)** — needs the identical test before its own
  `profiles`/`org_admin` reads, or (the cleaner option, see §7 Q1) needs to stop
  existing as an independent implementation and instead delegate to Chain A's logic
  so there is only ever **one** partition to keep in sync, matching the ADR 0101
  discipline this whole program is built on.

---

## 3. The picker screen

### 3.1 Route

Proposed: `src/app/(auth)/escolher-papel/page.tsx` — an authenticated interstitial
gate inside the existing `(auth)` route group, mirroring `/primeiro-acesso`'s
precedent exactly (`src/app/(auth)/primeiro-acesso/page.tsx`): reads
`getSessionContext()`, self-redirects away when the gate doesn't apply, otherwise
renders inside the shared split-canvas `AuthLayout` shell (`src/app/(auth)/layout.tsx`
— brand panel + centered form card, already themeable, already
`prefers-reduced-motion`-safe). `(auth)/redefinir-senha` and `(auth)/convite` already
establish that this route group is not "pre-auth only" — it also hosts authenticated
interstitials.

This is a **genuinely new UI pattern** (a choice screen, not a form), so per the
frontend role's process-discipline rule it needs the lead's plan-approval (full short
plan: files, components, the queries it depends on, a testing note) before Stage 3
writes any code — this note is not that plan-approval request, it is the design
groundwork the plan-approval request will cite.

### 3.2 Data dependency (must exist before this screen can be built)

The picker's option list needs the caller's **hat-blind** full grant list — the exact
set `partitionGrants` consumes, collapsed to distinct role **types** (D2: "Silva
picks 'quality reviewer', not 'quality reviewer — Hospital Central A'"). This is
`public.session_context()`'s raw `grants` array (already queried today by
`getSessionContext()` before partitioning), the same source the D9 exemption in the
plan (§1) already names as hat-blind by design. **No new backend surface is
required** — Stage 3 backend needs to expose a way for the picker to read it
*before* a hat exists (today `getSessionContext()` always partitions through the
hat-aware reads once Stage 3's `has_role` change lands, so the picker cannot simply
call `getSessionContext()` — it needs the pre-partition raw grants, or a dedicated
thin wrapper backend posts alongside `assume_role`). Flagged as a data dependency in
§7, not solved here — frontend builds against backend's posted signature, per the
role's process-discipline rule.

### 3.3 Layout

```
┌─────────────────────────────────────────┐
│  QUEM ESTÁ ACESSANDO              (eyebrow, tracked, text-primary uppercase)
│  Escolha seu papel                (h1, IBM Plex Serif)
│  Você tem mais de um papel na     (muted, text-pretty)
│  plataforma. Escolha com qual     
│  vai trabalhar agora.
│
│  ┌───────────────────────────────────┐
│  │ ◻ Administrador da organização    │  ← role option card, one per HELD role TYPE
│  │   Rede A                          │     (org/hospital names as supporting text
│  └───────────────────────────────────┘     when scope is unambiguous; omitted when
│  ┌───────────────────────────────────┐     the role spans several — scope itself
│  │ ◻ Revisor(a) da Qualidade         │     is picked AFTER, by /o or ?hospital=)
│  │   2 hospitais                     │
│  └───────────────────────────────────┘
│  ┌───────────────────────────────────┐
│  │ ◻ Membro de comissão              │
│  │   3 comissões                     │
│  └───────────────────────────────────┘
│
│              [ Continuar ]        (primary button, disabled until a card is
└─────────────────────────────────────────┘   selected — or auto-submits on
                                                selection; see §5 keyboard flow)
```

Each option card: `rounded-2xl border border-border bg-card shadow-xs`, radio
semantics (see §5), pt-BR label from a fixed role→label map (not the raw enum
value), a muted supporting line giving the **count** of orgs/hospitals/commissions
the role spans (never their names in aggregate — that would leak scope into a screen
D2 keeps scope-free) unless there is exactly one, in which case naming it removes an
otherwise-pointless extra click. Selecting a card and confirming calls `assume_role`
(server action), which on success redirects straight to that role's landing route
from §1 — deterministically, no guessing, because exactly one role was chosen.

### 3.4 States

- **Loading** — this is a Server Component render (session + grants resolved before
  first paint, matching every other guard in this codebase); no client-side loading
  spinner state is needed for the initial render. The **submit** action (confirming a
  choice) is client-side (`assume_role` → `refreshSession()` → redirect) and does
  need a pending state: disable the option cards + button, show an inline
  `role="status"` "Alternando papel…" — mirrors `QualityHospitalSwitcher`/
  `NspHospitalSwitcher`'s existing switch-in-flight pattern.
- **Multi-role (the only state that renders this screen's picker UI)** — as above.
- **Single-role — must NEVER render.** Enforced the same way `/primeiro-acesso` self-
  guards (§3.1): the page itself checks the grant-type count server-side before
  returning any picker markup, and self-`redirect()`s to `/` when the count is ≤ 1
  (mirroring D7: "the hat is set implicitly, matching `/o` and `/c`" — no picker
  flash, no empty-state placeholder, nothing rendered at all for this population).
  This is the one state the acceptance criteria most need a regression test for
  (tester's concern, not built here) precisely because it is a screen that must be
  invisible to most users, which is the easiest kind of requirement to silently
  regress.
- **Error** — `assume_role` validates against live memberships (ADR 0106, "Forgery is
  not the threat model"); the only realistic failure is a stale grant (the role was
  revoked between page load and submit). Inline `role="alert"` banner, pt-BR, offer
  to reload the option list — never a raw Postgres/Supabase error (CLAUDE.md §8).

### 3.5 Motion

Per the design system (§5 "Motion system"): the option-card list is a `RiseInGroup`
(`src/components/motion/rise-in-group.tsx`) — staggered `.animate-rise-in`, same
`--rise-delay` pattern used by the `AuthLayout` headline block. No GSAP is needed for
entrance; GSAP is reserved (per the skill's own guidance) for something that
*clarifies*, not decorates — here that is the **submit transition**: on confirm, a
brief cross-fade of the selected card into a compact "confirmed" state before the
navigation fires, using `getMotionDurations()`/`MOTION_EASE.outSoft`
(`src/components/motion/motion-tokens.ts`), dynamically imported, wrapped in
`try/catch` so a motion failure can never block the actual `assume_role` call or
navigation (per the skill's Flip-reorder lesson). Everything collapses to instant
under `prefers-reduced-motion`, both the CSS entrance and the GSAP submit
cross-fade (checked via `window.matchMedia`).

---

## 4. Hat indicator placement

### 4.1 The decision: extend `UserMenu`, don't add a new chrome element

`src/components/shell/user-menu.tsx` is the **one component present in every choke-
point shell** in both of this app's two shell families:

- **Sidebar-footer family** (`OrgManageSidebar`, `AppSidebar`) — `UserMenu` renders in
  a footer row beside `NotificationBell` (`src/components/shell/app-sidebar.tsx:867-
  873`), and **already carries a `roleLabel` prop** shown as a caption under the
  user's name (`user-menu.tsx:44-48`) — today a per-page string ("Coordenação" /
  "Membro" / "Administração"), not yet the JWT-sourced hat.
- **Header-bar family** (`qualidade`, `nsp`, `nsp-org` layouts) — `UserMenu` renders
  top-right beside `NotificationBell` in the sticky header (e.g.
  `src/app/o/[org]/qualidade/layout.tsx:82-84`).

This is the placement decision, made against real screens rather than in the
abstract: **the hat indicator is `UserMenu`'s existing identity block, extended** —
not a new persistent bar, not a second dropdown competing for the same header real
estate. Concretely: `roleLabel` (already-rendered caption text) becomes the
**active-hat label** read from the session's `active_role` claim (via
`getSessionContext`, which Stage 3 backend will extend to surface it) rendered
through the same §1 role→pt-BR-label map the picker uses (one map, two consumers —
avoids a second hand-copied label list), and the dropdown trigger — already a
`ChevronsUpDown` affordance today (`user-menu.tsx:50-53`, currently implying only
"open account menu") — gains a **"Trocar papel" section** above the existing "Sair"
item, listing the caller's other held role types (from the same hat-blind grant read
§3.2 needs) as selectable items. Only rendered/reachable when the caller holds more
than one role type; a single-role user's `UserMenu` is unchanged from today (no
new "Trocar papel" heading, `roleLabel` shows their one role exactly as now).

### 4.2 Why this and not a new global bar

- **No collision** — every shell already reserves this exact slot for identity chrome
  (`NotificationBell` + `UserMenu`); a *second* persistent element (e.g. a top-of-
  page ribbon) would compete with `NotificationBell` for the same header strip in the
  header-bar family, or force a new footer row in the sidebar family where none
  exists.
- **One component, six shells** — `direção técnica` is the exception (§4.4): every
  *other* choke point already imports `UserMenu`, so extending it is a one-file
  change reaching every screen simultaneously, rather than six bespoke placements.
- **Matches D7's own framing** — "the active hat persistently visible" reads
  naturally as "wherever the user already looks to confirm who they are," which in
  this codebase is unambiguously the identity menu, not a new landmark.

### 4.3 Mobile behavior

`OrgManageSidebar`/`AppSidebar` already collapse to a mobile layout (`md:flex-row` on
the shell root — mobile stacks). `UserMenu`'s footer placement is unaffected by that
collapse (it's part of the sidebar, not the collapsing nav list), so no separate
mobile treatment is needed for the sidebar family. The header-bar family
(`qualidade`/`nsp`/`nsp-org`) already truncates the org name (`max-w-[12rem]
truncate`) and hides the hospital switcher inline at narrow widths in favor of the
existing responsive header pattern — `UserMenu` sits at the far right in both cases
and the `DropdownMenuContent` (Radix, already viewport-aware) opens as an overlay
regardless of width, so no additional breakpoint logic is needed beyond what
`UserMenu` already has. The one net-new behavior: the "Trocar papel" section adds
vertical height to the dropdown panel on narrow viewports — bounded by the existing
`min-w-[14rem]` content sizing plus normal overflow scrolling Radix already provides,
not a new constraint to design.

### 4.4 The gap: `direção técnica` has no shell at all

`src/app/o/[org]/direcao-tecnica/page.tsx` is a bare `page.tsx` with **no
`layout.tsx`** (confirmed: only `error.tsx`/`loading.tsx`/`page.tsx` exist under that
route) — no header, no `UserMenu`, no `NotificationBell`. A Diretor Técnico signing
in today sees no persistent chrome at all beyond the page's own `<header>` (title +
subtitle, `page.tsx:87-101`). Extending `UserMenu` reaches five of six choke points
for free; this one needs either (a) a minimal shell/layout added around this route
(bringing it in line with every other choke point, and the natural place to add the
D9 hint's shell too — see §5.4), or (b) the indicator embedded directly in this
page's own header. Flagged as an open question (§7) — out of this note's authority
to decide unilaterally since it changes a route's structure, not just a shared
component's props.

---

## 5. The D9 hint component

### 5.1 Real guard locations (6 found, not 5 — see §5.2)

| # | Area | Guard file | Gate shape |
| --- | --- | --- | --- |
| 1 | Org manage | `src/app/o/[org]/manage/layout.tsx:24-51` | inline `getSessionContext()` + `orgAdminOf`/`hospitalAdminOf` check, `notFound()` |
| 2 | Qualidade | `src/app/o/[org]/qualidade/layout.tsx:37-49` | `getQualidadeAccessByOrg(org)` → `null` → `notFound()` |
| 3 | NSP (hospital-scoped operator console) | `src/app/o/[org]/nsp/layout.tsx:33-48` | `getNspAccessByOrg(org)` → `null` → `notFound()` |
| 4 | NSP-org (org-level NSP admin) | `src/app/o/[org]/nsp-org/layout.tsx:31-60` | inline `context.nspOrgAdminOf` check + `isNspOrgAdmin()` DEFINER probe, `notFound()` |
| 5 | Direção técnica | `src/app/o/[org]/direcao-tecnica/page.tsx:52-68` | `getTechnicalDirectionAccessByOrg(org)` → `null` → `notFound()` (guard lives in the **page**, not a layout — §4.4) |
| 6 | Commission area | `src/app/o/[org]/c/[commission]/layout.tsx:84-99` | `getCommissionAccessByOrg(org, commission)` → `null`/no standing → `notFound()` |

### 5.2 Flagging the count, not silently rounding it

The plan (P5) and this task's brief both write "the ~5 area-entry guards (org
manage, qualidade, NSP, NSP-org, direção técnica, commission area)" — that is **six
named locations** under an approximate "~5" label. All six are real, distinct guard
files with a genuine `notFound()` access check (verified above, not assumed from the
name). This note reports **six**, per the task's own instruction to flag rather than
force a fit. Not a blocker — just don't build five hint placements against a sentence
that names six.

### 5.3 Props (one component, all six sites)

A single Server Component, computed **purely from the caller's own memberships** (D9:
"constructed purely from their own memberships and never consults whether the target
exists" — it must not know or care whether *this* org/hospital/commission exists,
only what the caller holds elsewhere):

```
<RoleSwitchHint
  heldElsewhere: Array<{ role: PlatformRole; count: number }>
  // Pre-computed by the CALLER (each guard already resolved getSessionContext()/
  // the hat-blind grants for its own check) — RoleSwitchHint does no I/O of its
  // own, matching D9's "constructed purely from their own memberships": there is
  // exactly one data source (the hat-blind grant read §3.2 needs) and it is read
  // once per request, upstream, not re-derived per hint render.
/>
```

Renders **nothing** (not even an empty wrapper) when `heldElsewhere` is empty — a
caller with no other standing anywhere gets the plain `notFound()` copy, unchanged
from today, because there is nothing true to say about switching. When non-empty,
appends to the existing not-found copy (never replaces it — the base "this may not
exist, or you may not have access" sentence stays, D9 explicitly does not soften
that ambiguity, it only adds an *additional*, self-sourced fact): "Seu papel de
**{role label}** tem acesso mais amplo aqui. Trocar agora?" with a one-click switch
(same `assume_role` action §3.3 uses) — pt-BR, per role held, one line each if more
than one hat would help.

### 5.4 Where it mounts — a second gap: only 2 of 6 have a route-level boundary

`notFound()` throws to the **nearest** `not-found.tsx` boundary. Today:

- **Qualidade** (`src/app/o/[org]/qualidade/not-found.tsx`) and **NSP**
  (`src/app/o/[org]/nsp/not-found.tsx`) already have route-scoped boundaries — the
  natural mount point for `RoleSwitchHint` at these two sites (both are plain Server
  Components already, no route params needed since `getSessionContext()` doesn't
  depend on them — confirmed by the NSP boundary's own comment, "not-found
  boundaries receive no params," which is about the **org slug**, not about the
  caller's own session).
- **Org manage, NSP-org, commission area, direção técnica have none** — a denied
  request at these four falls all the way to the **global**
  `src/app/not-found.tsx`, which is deliberately generic (no shell, no session read,
  reused by every unrelated 404 in the app). Mounting `RoleSwitchHint` there would
  make *every* 404 in the platform compute the caller's grants, which is wasteful and
  also wrong scope — the global 404 must stay guard-agnostic.

**Consequence, flagged rather than papered over:** Stage 3 needs **four new
route-scoped `not-found.tsx` files** (`manage/`, `nsp-org/`, `c/[commission]/`,
`direcao-tecnica/`) before `RoleSwitchHint` can mount at those sites, mirroring the
qualidade/NSP precedent (in-shell copy, `ShieldOff`/similar icon, `animate-rise-in`,
a "Voltar" link). This is additive (new files, not edits to the guard layouts
themselves — the layouts already call bare `notFound()`, which is exactly what makes
adding a sibling boundary safe) and is squarely `src/app/**` — frontend-owned.

---

## 6. Accessibility

- **Picker (§3):** every option is a real `<fieldset>`/`<legend>`-grouped radio
  set (native `<input type="radio">` styled as cards, or `role="radiogroup"` +
  `role="radio"` cards if the visual design needs a shape native radios can't take —
  either way, arrow-key navigation between options and Space/Enter to select are
  native to the pattern, not hand-rolled). Tab order: skip-link (if the page adds
  one) → heading → radiogroup (arrow keys move selection inside it, one Tab stop for
  the whole group) → primary "Continuar" button. Every card has a visible
  `focus-visible:ring-[3px] focus-visible:ring-ring/40` state (the project's standard
  ring, not a bespoke one). The submit's pending state (§3.4) is announced via
  `role="status"`, not just a visual disable, so a screen-reader user isn't left
  guessing why the button stopped responding.
- **This screen is the one gate every multi-role user crosses at every sign-in** — a
  keyboard-only completion (login → picker → landing, zero mouse) is not a nice-to-
  have subset of the phase's one required keyboard-only flow, it should **be** that
  flow, or a close second to it, given how frequently it is exercised relative to
  other Stage 3 surfaces.
- **Hat indicator (§4):** unchanged interaction model from today's `UserMenu`
  (Radix `DropdownMenu`, full keyboard support already: Enter/Space opens,
  arrow keys move, `Home`/`End`, type-ahead, `Escape` closes and returns focus to the
  trigger). The new "Trocar papel" items are ordinary `DropdownMenuItem`s in the same
  menu — no new keyboard surface to design, only new items to label correctly
  (`aria-current="true"` or an equivalent visually-distinct "current hat" marker on
  the active role's own entry, since a menu with no indication of the current
  selection is exactly the "which hat am I wearing" confusion D7 exists to prevent).
- **D9 hint (§5):** plain text + a real `<button>`/link for the switch action (never
  a `<div onClick>`), inside the existing not-found boundary's landmark structure
  (a `<section>` with a heading, matching the qualidade/NSP precedent already in the
  codebase). No new landmark type introduced.
- **Copy:** all of the above pt-BR, per Rule 10. No user-facing English string
  anywhere in this note's proposed screens.

---

## 7. Open questions for the lead

1. **Chain B (`resolveLanding`, §2) — who owns the fix, and what shape?** This is the
   single highest-risk finding in this note: as written today, `resolveLanding()`
   would let a real fraction of multi-role sign-ins (anyone whose first-checked role
   in its 4-branch chain is `org_admin` or a commission membership — which includes
   the plan's own `dualhat.a@` test persona) skip the picker entirely on the most
   common path into the app. `src/lib/auth/actions.ts` is backend-owned
   (`src/lib/**`), so frontend cannot resolve this unilaterally; flagging for a
   decision before Stage 3 build starts, not working around it in `page.tsx` alone
   (a page.tsx-only fix leaves Chain B live, hat-blind, and diverging further next
   time a role is added to one chain and not the other — the exact ADR-0101-shaped
   defect, recurring). Two options this note can see, not evaluated against each
   other here: (a) delete `resolveLanding`'s independent logic, let `signIn` always
   redirect to `/` and take chain A's one extra hop (simplest, matches D10's
   pre-pilot "correctness over the last-mile optimization" spirit); (b) keep the
   fast path but make it delegate to the *same* pure partition/claim-check Chain A
   uses, so there is only ever one implementation to keep in sync (mirrors ADR 0101
   Decision 2's "both seams run for real" discipline).
2. **Picker route name and exact placement** — `/escolher-papel` under `(auth)`
   (§3.1) is this note's proposal, mirroring `/primeiro-acesso`. Needs explicit
   lead sign-off as a new route before Stage 3's full plan-approval request, per the
   frontend role's own process-discipline rule (new UI pattern ⇒ full short plan +
   approval, not a one-liner).
3. **The picker's pre-hat data source (§3.2)** — confirm the exact backend-posted
   shape (a raw `session_context()` read reused as-is, vs. a dedicated thin RPC/
   query function) before Stage 3 frontend writes against it, per the "build against
   backend's posted signatures, not a guessed shape" rule. This note deliberately
   does not invent one.
4. **Direção técnica's missing shell (§4.4)** — add a minimal `layout.tsx` (bringing
   it to parity with the other five choke points, and giving §5.4's new
   `not-found.tsx` a shell to render inside) or embed the indicator directly in the
   page's own header? This changes route structure, which this note treats as the
   lead's call, not a default it should assume.
5. **The "~5 vs 6" guard count (§5.2)** — confirm 6 is correct and the plan's "~5"
   wording should be read as approximate, not that one of the six listed areas was
   meant to be excluded.
6. **`roleLabel`'s current per-page semantics vs. the new hat-sourced semantics
   (§4.1)** — today `roleLabel` is computed per-shell from page-local data
   (`"Coordenação"`/`"Membro"`/`"Administração"` in the commission layout, implicit
   elsewhere). Stage 3 needs to decide whether it becomes strictly "the active JWT
   hat's pt-BR label" everywhere (simplest, one source of truth) or keeps finer
   per-shell nuance (e.g. distinguishing "Coordenação" from a bare "Membro" within
   the single `staff_admin`/`staff` hat) — these could diverge from a strict
   role-label if a shell wants to keep showing sub-role nuance beside the hat.
