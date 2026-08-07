# QO·A Frontend Plan — `/o/[org]/qualidade` + the oversight viewer

**Author:** `frontend` · **Date:** 2026-08-06 · **Branch:** `feat/quality-office-oversight`
**Status:** PLAN — awaiting lead approval. **No implementation in this pass.**
**Binding inputs:** ADR [0100](../decisions/0100-quality-office-oversight.md) (D1–D14
PO-ratified) · [plan §A.3](./quality-office-oversight.md) ·
[buildnotes](./quality-office-oversight-buildnotes.md) (`backend`'s catalog pass) ·
the `frontend-design` skill ("clinical calm") · `vercel-composition-patterns`
(`architecture-avoid-boolean-props`, `patterns-explicit-variants`).

Every data shape below is marked **`TBD ← backend A.6 contract`**. Nothing here
invents a provisional type; the screens are designed around the shape of the SCREEN,
and the props are named so that the real signatures drop in without a rename.

---

## 0. Three findings that change §A.3's scope (read first)

### F1 ⛔ The commission LAYOUT 404s the reviewer before the case page runs

§A.3 and the buildnotes' silent-ignore watchlist both name only
`casos/[caseId]/page.tsx ~L72`. But that page renders **inside**
`src/app/o/[org]/c/[commission]/layout.tsx`, which carries the same gate at **L63**:

```ts
const access = await getCommissionAccessByOrg(org, commission);
if (!access || access.role === null) {
  notFound();
}
```

Widening only the page leaves the reviewer on a 404. The layout must be widened too.

**Worse — widening it naively leaks the whole coordinator menu.** The layout mounts
`AppSidebar` with `role={access.role}`, and `AppSidebar`'s `isVisible()` ends with:

```ts
return role === null || item.roles.includes(role);
```

`role === null` is the "admins see the full menu" branch. A reviewer resolved as
`{ role: null, isQualityViewer: true }` would therefore see **every** nav item —
Construtor, Casos, Assinaturas, Painel, Gerenciar, Configurações — each of which 404s
them. That is an affordance leak of exactly the shape D10 forbids ("write affordances
hidden by role"), and it would also fire ~7 count/flag reads (`listSignoffQueue`,
`countOpenCasesForBoard`, `getMemberOverview`, …) that are meaningless for a non-member.

**Design:** an **early return before any of that work**, not a widened sidebar.

```ts
if (!access || (access.role === null && !access.isQualityViewer)) notFound();

// Oversight viewer: a reduced, read-only shell — no member sidebar, no counts,
// no flag fan-out. Returns before the member branch even starts its reads.
if (access.role === null) {
  return (
    <QualityViewerShell org={org} commissionName={access.commission.name} … >
      {children}
    </QualityViewerShell>
  );
}
```

`QualityViewerShell` renders: the same sticky header chrome as the NSP console, a
"QUALIDADE" badge, the commission's name, a back link to `qualidadeHref(org)`, the
`UserMenu` — and **no navigation into the commission at all**. This is what makes the
reviewer structurally unable to reach a member surface: not a hidden link, an absent one.

### F2 ⛔ A pure `quality_reviewer` lands on "Você ainda não tem acesso"

`src/app/page.tsx` is the root role-landing router. Its branches are
platform_admin → org_admin → hospital_admin → nsp_org_admin → memberships →
technical_director → **`<NoAccess/>`**. A reviewer holds a hospital-scoped membership
with `commission_id NULL` and no admin role, so **every branch steps over them** and
they hit the dead end. This is byte-for-byte BUG-HAT-001 (hospital_admin) and the
Diretor Técnico gap that ADR 0094 W4 had to patch afterwards — the third time this
exact shape ships. `src/app/page.tsx` is **not in §A.3**.

**Design:** add a branch immediately after `nspOrgAdminOf` and **before** `memberships`
— no: after `memberships`/`/c`, mirroring the Diretor Técnico placement, so a reviewer
who is *also* a committee member keeps landing where they always did. Consequence,
stated as ADR 0094 stated its own: such a user reaches the console via the sidebar
entry (item 24 below), not via `/`.

```ts
if (context.qualityReviewerOf.length > 0) {
  redirect(qualidadeHref(context.qualityReviewerOf[0].organization.slug));
}
```

### F3 ⛔ Two live write affordances are gated on a FLAG, not on capabilities

Detailed in §3, called out here because they are the two the matrix exists to catch:

- **`NotifyEventDialog`** ("Notificar evento ao NSP") renders on `patientSafetyEnabled`
  **alone** — no capability check at all. A reviewer would get a working WRITE that
  creates a patient-safety event, and its PHI pre-fill bridge with it.
- **`correctionCaps.canFile`** is `isOpen` — computed *inside* `CaseDetailView` with the
  in-file rationale *"filing is open to any case-content reader while the case is OPEN"*.
  D3 makes the reviewer exactly that. Every phase/narrative card would render "Corrigir…".

Both violate D7 (strictly read-only, no write doors). Neither is visible from
`viewerCapabilities`, so neither would be caught by "the caps descriptor handles it".

**File-count consequence.** §A.3 sizes the frontend at ~16–18 files. With F1–F3 the
real set is **17 new + 10 modified = 27**. Flagging the delta rather than silently
absorbing it.

---

## 1. File list

### New — `frontend`-owned

| # | File | What it does |
|---|------|--------------|
| 1 | `src/app/o/[org]/qualidade/layout.tsx` | Server gate (`getQualidadeAccessByOrg` → `notFound()`), console chrome, hospital switcher (`?hospital=`), nav, bell, user menu. Mirrors `nsp/layout.tsx`. |
| 2 | `src/app/o/[org]/qualidade/page.tsx` | The cross-committee case board + KPI strip + locked-count chips. Server Component. |
| 3 | `src/app/o/[org]/qualidade/loading.tsx` | Skeleton mirroring the board layout. |
| 4 | `src/app/o/[org]/qualidade/error.tsx` | `"use client"` boundary, pt-BR, `role="alert"`, retry. |
| 5 | `src/app/o/[org]/qualidade/not-found.tsx` | In-shell 404 for the area. |
| 6 | `src/app/o/[org]/qualidade/dashboards/page.tsx` | Aggregate-only compliance dashboards (D11). Server Component. |
| 7 | `src/app/o/[org]/qualidade/dashboards/loading.tsx` | Skeleton (picker + chart cards). |
| 8 | `src/app/o/[org]/qualidade/dashboards/error.tsx` | Client error boundary. |
| 9 | `src/components/quality/quality-console-nav.tsx` | `"use client"` — "Casos" / "Painéis" with `aria-current`. Mirrors `nsp-console-nav.tsx`. |
| 10 | `src/components/quality/quality-kpi-strip.tsx` | Server — 4 KPI cards incl. the **"N casos restritos"** card (D6). Reuses `StatCount`. |
| 11 | `src/components/quality/quality-commission-filter.tsx` | `"use client"` — commission chips ("Todas" + per-commission), URL-synced `?comissao=` via `history.replaceState` (the `CasesView` idiom). |
| 12 | `src/components/quality/quality-case-board.tsx` | `"use client"` — the cross-committee table (Comissão column, sortable, search). Hrefs from a **plain `Record<string,string>` slug map**, never a builder prop. |
| 13 | `src/components/quality/quality-empty-state.tsx` | Server — the three empty variants (no oversight commissions / no readable cases / no submitted forms). |
| 14 | `src/components/quality/quality-dashboard-filters.tsx` | `"use client"` — date range only. **No CSV export** (`dashboard_export_rows` is closed, D11). |
| 15 | `src/components/quality/quality-viewer-chip.tsx` | Server — "Escritório da Qualidade · somente leitura" chip on the case page. |
| 16 | `src/components/quality/quality-viewer-shell.tsx` | Server — the reduced commission shell of F1. No member nav. |
| 17 | `src/components/org/commission-oversight-toggle.tsx` | `"use client"` — the `set_commission_oversight` switch for hospital_admin/org_admin. |

### Modified — `frontend`-owned

| # | File | Change |
|---|------|--------|
| 18 | `src/lib/routing.ts` | `qualidadeHref(org, ...segments)` mirroring `nspHref` (~L73). Pure path, no I/O. |
| 19 | `src/app/o/[org]/c/[commission]/layout.tsx` | **F1** — widen the L63 gate; early-return `QualityViewerShell` before the member reads. |
| 20 | `src/app/o/[org]/c/[commission]/casos/[caseId]/page.tsx` | Widen the L72 gate; resolve every host-side affordance prop to `false` for a viewer; pass `viewerKind="oversight"`, `backHref=qualidadeHref(org)`, `backLabel`. |
| 21 | `…/casos/[caseId]/narrativa/[narrativeId]/page.tsx` | Widen its identical `access.role === null` gate. `canEdit`/`canConclude` already resolve false from `caps` — verified by reading, not assumed. |
| 22 | `src/components/cases/case-detail-view.tsx` | Add `viewerKind?: 'member' \| 'oversight'` (default `'member'`) + `backLabel?`. See §3.1 for why one discriminator and not four booleans. |
| 23 | `src/components/org/org-commission-list.tsx` | Un-nest the card (today the **whole card is one `<Link>`** — an interactive control cannot live inside it) and add the oversight toggle. See §4. |
| 24 | `src/components/shell/app-sidebar.tsx` | "Escritório da Qualidade" entry under the "Organização" eyebrow, for a reviewer who is ALSO a commission member (F2's consequence). Gated on a new `isQualityReviewer` prop. |
| 25 | `src/app/page.tsx` | **F2** — the root-landing branch. |
| 26 | `src/components/users/affiliations-panel.tsx` | `ROLE_LABELS.quality_reviewer = "Escritório da Qualidade"`. **Must land in the same wave as backend's fixture regen** — see §6. |
| 27 | `src/components/dashboard/volume-trend.tsx` | Guard the per-member block on `byMember.length > 0` so the aggregates-only dashboard doesn't render an empty table. Small, but it touches a shared component — see the E2E note in §5. |

---

## 2. Screen design

### 2.1 Console shell — `/o/[org]/qualidade/layout.tsx`

Structurally the NSP console, re-skinned:

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [CH] Rede A   ⟨QUALIDADE⟩   🏥 Hospital Central A ⌄   Casos  Painéis   🔔 👤│  sticky, backdrop-blur
└──────────────────────────────────────────────────────────────────────────┘
   <main class="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
```

- Gate: `getQualidadeAccessByOrg(org)` → `notFound()` on `null`. Unknown org and
  no-standing are indistinguishable, exactly as the NSP layout documents.
- **Hospital is a `?hospital=` filter, never a segment** (ADR 0041 D8 / 0100 D10).
  Reuse the **generic `HospitalSwitcher`** (`src/components/shell/hospital-switcher.tsx`)
  with `allowAll={true}` — unlike NSP there is **no PHI boundary** here (D5), so
  "Todos os hospitais" is a legitimate cross-hospital view for a multi-hospital
  reviewer. Rendered only when `hospitals.length > 1`. It takes `HospitalRef[]`,
  which is what the resolver already returns for its siblings.
- Badge "QUALIDADE" in `bg-accent text-accent-foreground`, mirroring "NSP".
- No commission switcher, no member nav.

### 2.2 Board — `/o/[org]/qualidade` (the landing)

```
ESCRITÓRIO DA QUALIDADE · REDE A                      ← eyebrow, tracking-[0.16em], text-primary
Casos sob supervisão                                  ← h1, IBM Plex Serif, text-3xl, text-balance
Casos das comissões clínicas cuja supervisão foi      ← max-w-prose, text-muted-foreground
habilitada para este hospital. Somente leitura.

┌───────────┬───────────┬───────────┬──────────────────┐   grid-cols-2 sm:grid-cols-4, gap-3
│ Comissões │ Casos     │ Em aberto │ Casos restritos  │   KpiCard pattern (rounded-xl, p-4)
│     4     │    128    │     37    │        6         │   StatCount count-up (reduced-motion-safe)
│ ● supervi-│ ● visíveis│ ● em anda-│ ○ acesso restrito│   tone: accent / plain / warn / plain
│   sionadas│           │   mento   │   à comissão     │
└───────────┴───────────┴───────────┴──────────────────┘

[ Todas 128 ] [ CCIH 84 · 2 restritos ] [ Farmácia 44 ] [ Nutrição 0 ]   ← chips, aria-pressed
                                                   [ 🔍 Buscar caso ou rótulo ]

┌────────────────────────────────────────────────────────────────────────────┐
│ COMISSÃO │ CASO ⌃ │ RÓTULO │ STATUS │ DESFECHO │ FASE ATUAL │ CRIADO ⌃      │
│ CCIH     │ 0042   │ Óbito… │ ●Ativo │ —        │ Coleta     │ 12/07/2026    │
└────────────────────────────────────────────────────────────────────────────┘
Algumas comissões mantêm casos com acesso restrito — 6 casos não aparecem nesta lista.
```

**Component hierarchy** (server unless marked):

```
page.tsx (server)
├─ header (h1 + lead)
├─ <QualityKpiStrip summary=… />                        server → KpiCard × 4 → <StatCount/> (client)
├─ <QualityCommissionFilter commissions=… />            client  — chips + search, ?comissao=
├─ <QualityCaseBoard rows=… commissionSlugById=… />     client  — table, sort, row → href
└─ <QualityEmptyState variant=… />                      server  — when rows.length === 0
```

**Locked-case presentation (D6 — the constraint, spelled out).** The locked population
is surfaced in exactly two places and in exactly one register:

1. a KPI card labelled **"Casos restritos"** with the value `N` and the sub-line
   **"Acesso restrito à comissão responsável"**;
2. a per-commission chip suffix **`· N restritos`**, and one closing line under the
   board: **"Algumas comissões mantêm casos com acesso restrito — N casos não aparecem
   nesta lista."**

Rules that make this PHI-free by construction: the count is **not clickable**, has **no
drill-in, no tooltip, no per-row placeholder, no case number, no date, no commission-level
breakdown finer than the count**, and never appears as a ghost/greyed table row. There is
no affordance whose only possible next step would be to ask for content. The tone token is
`plain` (`bg-muted-foreground` dot), deliberately **not** `warn` or `danger` — a restricted
case is a normal governance state, not an anomaly, and colouring it as an alert would itself
be a signal about content.

**Board behaviour.** Sortable on Caso / Status / Criado (the `CasesTable` idiom). Search
filters case number + rótulo client-side over already-loaded rows. **No kanban** — kanban
is a work surface (drag = assign); oversight is a review surface. **No "Criar caso", no
bulk, no export.** Row click and the case-number link both go to
`commissionHref(org, commissionSlugById[row.commissionId], "casos", row.case.id)`,
resolved **inside** the client component from a plain serializable map.

**States**

| State | Render |
|---|---|
| loading | `loading.tsx`: header block + 4 KPI skeletons + chip row + 8 table-row skeletons, `bg-muted`, same radii as the real layout. |
| no oversight-visible commissions | Dashed-border empty state: *"Nenhuma comissão está sob supervisão da qualidade."* / *"A administração do hospital define quais comissões aparecem aqui."* — no link (the reviewer cannot self-serve). |
| commissions but zero readable cases | *"Nenhum caso visível no momento."* plus the restrito line when `locked > 0`. |
| one commission's fan-out fails | Degrade **per commission**: that chip renders `—` and a `role="status"` note *"Não foi possível carregar os casos de {comissão}."*; the rest of the board still renders. Never blank the page. |
| error (whole page) | `error.tsx`: `role="alert"`, *"Não foi possível carregar o painel de supervisão."* + "Tentar novamente". No raw Postgres text (Rule 10 / §7 of the design skill). |

**Motion.** `.animate-rise-in` with `--rise-delay: ${i*60}ms` on the KPI cards and the
first ~12 board rows; `.animate-fade-in` on the table container (matching `CasesTable`).
`StatCount` provides the count-up. Everything collapses under the global
`prefers-reduced-motion` rule. **No new motion primitive, no GSAP import** — this screen's
job is calm scanning; the existing tokens already carry it.

### 2.3 Dashboards — `/o/[org]/qualidade/dashboards`

```
PAINÉIS · REDE A
Conformidade das comissões supervisionadas
Estatísticas agregadas das respostas enviadas. Respostas individuais e textos
abertos não fazem parte da supervisão.                  ← states the boundary plainly

[ CCIH ] [ Farmácia ] [ Nutrição ]                       ← commission tablist, ?comissao=
[ Checklist de Higiene 128 ] [ Auditoria de Leito 44 ]   ← form tablist,       ?form=
[ De: __/__/____  Até: __/__/____ ]  [ Limpar ]          ← QualityDashboardFilters, ?from= ?to=

  128  respostas enviadas
  ┌─ Envios ao longo do tempo ────────────────┐          ← VolumeTrend (reused)
  ┌─ Seção 1 ─────────────────────────────────┐          ← DashboardCharts (reused, server)
  │ [DistributionChart] [MatrixDistributionCard]│
  │ [RiskDistributionCard]                      │
```

**Reuse, by name.** These are reused unchanged: `DashboardCharts` (a Server Component
that composes the client chart pieces), `DistributionChart`, `MatrixDistributionCard`,
`RiskDistributionCard`, `VolumeTrend`. **Not reused:** `DashboardForms` and
`DashboardFilters` — `DashboardFilters` renders the **CSV export** link into
`/c/[commission]/dashboard/export`, which is `dashboard_export_rows` (closed by D11) on
a route the reviewer 404s. Reusing it would ship a dead, denied affordance. Hence #14.

`FreeTextSamples` is **never mounted**: with `freeTextSamples: []` from the
aggregates-only assembler, `groupBySection` simply produces no free-text entries — the
suppression is structural, not a conditional. `VolumeTrend`'s per-member table needs the
`byMember.length > 0` guard (#27) for the same reason.

**States:** loading skeleton mirroring picker+charts; *"Nenhuma comissão supervisionada
tem respostas enviadas."* when no form has data; per-form *"Este formulário não tem
perguntas para exibir estatísticas."* is already `DashboardCharts`' own empty state.

---

## 3. Write-affordance suppression matrix (the case page)

Route: `/o/[org]/c/[commission]/casos/[caseId]` → `CaseDetailView` (`withHeader`).
**"Viewer" = `access.role === null && access.isQualityViewer`.** The DB capability arm is
the boundary; the UI must simply not offer what it cannot do.

Legend for **How suppressed**: **caps** = already false from `detail.viewerCapabilities`
(no code change, verified by reading the gate) · **host** = the page resolves the prop to
`false` · **variant** = suppressed inside `CaseDetailView` by `viewerKind==='oversight'`.

| # | Control (pt-BR) | Component | Gate today | Viewer value | How suppressed | If missed |
|---|---|---|---|---|---|---|
| 1 | **Notificar evento ao NSP** | `NotifyEventDialog` | `patientSafetyEnabled` **only** | ⛔ **renders** | **host + variant** | Live WRITE (creates a safety event) + PHI pre-fill bridge. **D7 + D5 breach.** |
| 2 | **Corrigir…** (per phase/narrative) | `CasePhaseList` ← `correctionCaps` | `canFile: isOpen` | ⛔ **renders** | **variant** (`correctionCaps = null`) | Live WRITE (files a correction request). **D7 breach.** |
| 3 | **Exibir identificação** (PHI reveal) | `CasePatientPanel` | `casePatientEnabled && c.patientEnabled` | ⛔ **renders** | **host** (`casePatientEnabled={false}`) **+ variant** | Invites an audited PHI read the door denies. **D5 breach**, and it teaches the reviewer the case has a patient. |
| 4 | Editar identificação do paciente | `CasePatientPanel` `canEdit` | `caps.canManageLifecycle` | false | caps (+ panel gone via #3) | — |
| 5 | **Editar** (rótulo + setor) | `EditCaseMetaDialog` | `isOpen && canEditMeta` | false — `canInCommission` needs `role==='staff_admin'` or an Administrativo capability; the reviewer has `role: null` and `capabilities: []` | **caps + host** (`canEditMeta={false}`) | Write door. |
| 6 | **Gerenciar caso** (→ coordinator route) | header link | `caps.canManageLifecycle` | false | caps | Dead link into a 404. |
| 7 | **Reabrir caso** | `ReopenCaseButton` | `correctionsEnabled && completed && canManageLifecycle` | false | caps + variant (`correctionsEnabled={false}`) | Write door. |
| 8 | Ativar / pular / reatribuir fase | `CasePhaseList` | `canAssignPhases \|\| caps.canManageLifecycle` | false | caps + host (`canAssignPhases={false}`) | Write door. |
| 9 | Corrigir resultado de fase | `CasePhaseList` `canCorrectResult` | `phaseResultsOn && access.role==='staff_admin'` | false | **caps** — ⭐ this is the gate D10 protects. Mapping the reviewer to `'staff_admin'` opens it. | Write door. |
| 10 | Editar / concluir narrativa | `CasePhaseList`, `narrativa/[id]` | `canEditNarrative(...)` / assignee | false | caps | Write door. |
| 11 | Adicionar / editar item de ação | `CaseActionItemsPanel` `canWrite` | `caps.canWriteContent` | false | caps | Write door. |
| 12 | Registrar ocorrência (timeline) | `CaseEventsTimeline` `canWrite` | `caps.canWriteContent` | false | caps | Write door. |
| 13 | Visibilidade "somente coordenação" | `CaseEventsTimeline` `canSetVisibility` | `caps.canManageLifecycle` | false | caps | Write door. |
| 14 | Adicionar / remover etiqueta | `CaseTagsPanel` `canWrite` | `caps.canWriteContent` | false | caps | Write door. |
| 15 | Enviar / excluir documento | `CaseDocumentsPanel` `canWrite` | `caps.canWriteContent` | false | caps | Write door. |
| 16 | Nova entrevista | `InterviewsPanel` `canCreate` | `caps.canManageLifecycle` | false | caps + **variant** (panel omitted, see Q4) | Write door. |
| 17 | **Encaminhar / Encaminhar adiante** | `CaseOutboundReferralsCard` | card mounts on `referralsModule != null`; wizard on `canManageLifecycle` | wizard false, **card mounts** | **host** (`referralsModule={null}`) — see **Q3**, lead decision needed | Wasted cross-commission reads for the wizard payload; possible denied reads. |
| 18 | Definir desfecho / editar ofertados | `CaseOutcomeSelector`, `CaseOfferedOutcomesEditor` | `isOpen && caps.canManageLifecycle` | false | caps | Write door. |
| 19 | Editar campos personalizados | `CaseCustomFieldsPanel` `canEdit` | `(canManageLifecycle \|\| canEditMeta) && isOpen` | false | caps + host | Write door. |
| 20 | **Back link "Meus Casos"** | header | hardcoded label + `backHref` prop | — | **variant** — `backHref={qualidadeHref(org)}`, `backLabel="Escritório da Qualidade"` | Not a write, but a dead link into a member-only route. The label is hardcoded at L374 today, so `backHref` alone is insufficient. |
| 21 | Role chip | `CaseRoleChip` | `roleFromCapabilities(caps)` → `"viewer"` | renders "viewer" | **variant** → `QualityViewerChip` ("Escritório da Qualidade · somente leitura") | Mislabels the reader; no `MyCaseRole` (backend type) change needed. |
| 22 | **Whole member sidebar** | `layout.tsx` → `AppSidebar` | `role === null` ⇒ **all items visible** | ⛔ **every item** | **F1** — early-return `QualityViewerShell`; `AppSidebar` never mounts | 12+ dead coordinator links; reads as an authorization bug. |

**Rows 1, 2, 3, 17 and 22 are the ones that require code. Everything else is already
closed by the capability descriptor** — and each was confirmed by reading its gate, not
by assuming the descriptor covers it.

### 3.1 Why one `viewerKind` discriminator and not four booleans

`CaseDetailView` already carries `canEditMeta`, `canAssignPhases`,
`canManagePhaseResults`, `correctionsEnabled`, `casesExtrasEnabled`,
`actionItemsEnabled`, `caseCustomFieldsEnabled` … A 3rd/4th behavioural boolean is
exactly the proliferation `architecture-avoid-boolean-props` warns about, and it would
put the read-only contract in four independent places that a future caller can get
partly right. `patterns-explicit-variants` prescribes the alternative: **one explicit
variant discriminator**.

```ts
/** Who is reading. 'oversight' = a quality_reviewer (ADR 0100 D7): strictly
 *  read-only, PHI-free, no correction filing, no NSP notification. Default 'member'
 *  keeps every existing caller byte-identical. */
viewerKind?: 'member' | 'oversight'
```

Defence in depth, deliberately doubled: the **host page** also resolves
`patientSafetyEnabled` / `casePatientEnabled` / `correctionsEnabled` / `canEditMeta` /
`canAssignPhases` / `canManagePhaseResults` / `referralsModule` to their off values, so
a future third caller that forgets `viewerKind` still cannot open a write path from the
host side, and a future host that forgets a prop still cannot open one from inside.

---

## 4. Oversight toggle in `/o/[org]/manage/comissoes`

`OrgCommissionList` today wraps the **entire card in one `<Link>`**. A `<button>` or
`<Switch>` cannot live inside an anchor (invalid HTML; the click target and the keyboard
path both break). So the row is restructured:

- the `<li>` becomes a `rounded-2xl border bg-card` **`<div>`**;
- the commission **name** becomes the link (keeps the hover/focus affordance and the
  `ArrowUpRight` cue at the row end, wrapped in the same link);
- a new right-aligned cell holds `<CommissionOversightToggle/>`.

The toggle: a labelled `Switch` (shadcn) — `<label>` "Supervisão da qualidade" + helper
text *"Casos e painéis desta comissão ficam visíveis ao Escritório da Qualidade."*
wired via `aria-describedby`; `useActionState` + `useTransition`, optimistic off,
`role="status"` confirmation, pt-BR error mapping. Rendered **only** for
hospital_admin / org_admin (D9) — and since this page is already gated to exactly those
two by the `/manage` layout, the control needs no additional role prop; it is
`disabled` + `aria-disabled` while pending.

Excluded state must read as the **default**, not as a penalty: unchecked, muted, no
warning colour.

**⚠ E2E note:** this is the "moving UI into a card re-scopes locators" trap. The
restructure changes the accessible name of the commission row from *the whole card* to
*the commission name*. Any existing spec doing `getByRole('link', { name: /CCIH/ })`
inside `/manage/comissoes` must be swept **together**, not fixed one rerun at a time.

---

## 5. Data dependencies — all `TBD ← backend A.6 contract`

Nothing below is implemented against a guessed shape. Where I name a field, it is a
**request**, and I will import the real type on the day it is posted.

| # | Needed | Consumed by | Note |
|---|---|---|---|
| D1 | `CommissionAccess.isQualityViewer: boolean` | files 19, 20, 21 | Per D10 a **flag**, never a role. `role` stays `null`. |
| D2 | `getQualidadeAccessByOrg(orgSlug)` → `{ context, organization, orgId, hospitals: HospitalRef[] } \| null` | file 1 | `HospitalRef[]` so the **existing** `HospitalSwitcher` takes it unchanged. |
| D3 | `SessionContext.qualityReviewerOf: { organization: OrganizationRef; hospital: HospitalRef }[]` | files 25, 24 | The "adding a role = adding a FILTER" seam `session.ts` documents. Needed for **F2**; §A.3 does not mention it. |
| D4 | `getQualityBoardSummary(orgId, hospitalId \| null)` → per-commission `{ commissionId, commissionName, commissionSlug, hospitalId, hospitalName, totalCases, openCases, lockedCases }` | files 2, 10, 11 | Buildnotes §6(g)'s proposal — **pin at contract time**. Powers the KPI strip + chips. `lockedCases` must be a bare count (D6). |
| D5 | `listQualityBoardCases(...)` → rows carrying **`commissionId`** | files 2, 12 | The `list_cases_board` fan-out. Each row must carry its commission id so the board can resolve a slug; the board never re-reads. If the shape is per-commission arrays instead, I flatten and build the map — either works, name it. |
| D6 | `getQualityFormDashboard(formId, range)` → `FormDashboard` with `freeTextSamples: []`, `completionByMember: []` | file 6 | Aggregates-only assembler calling **only the six** doors. **`getFormDashboard` today calls `dashboard_free_text` AND `dashboard_completion_by_member`** (dashboard.ts L404/L406) — two of the three closed doors. They deny by *silent empty return* (buildnotes row 17), so reusing it yields no error but two silently-empty surfaces. A distinct function keeps the two-class contract legible in the TS layer too. |
| D7 | `listDashboardForms(commissionId, range)` reachable for a reviewer | file 6 | It is `dashboard_form_totals` — one of the six. Expected fine; confirming, not assuming. |
| D8 | `OrgCommissionDetail.qualityOversight: 'visible' \| 'excluded'` | files 23, 17 | Otherwise the toggle has no current value. |
| D9 | `setCommissionOversight(commissionId, next)` server action in `src/lib/org/actions.ts`, returning the `MutationActionState` shape | file 17 | pt-BR mapping for 42501 / `HC0Q0` / P0002 **in the action layer** — raw SQLSTATEs must not reach the UI. |
| D10 | `qualidadeHref` — mine (`src/lib/routing.ts`), listed only so the dependency graph is complete | many | No backend involvement. |

**Q1–Q5 — RULED by the lead 2026-08-06.** Recorded here rather than left as open
markers: a plan that still reads "lead call" after the call was made is the
stale-comment failure this project has paid for repeatedly.

- **Q1 — `listCaseDocuments` signed URLs → DEFAULT TO NO DOWNLOAD LINKS.** Render the
  documents panel read-only **without** download links for the oversight viewer. Links
  render **only** if `backend` proves storage RLS admits a no-membership
  `read_case_content` reader **and** the download path is PHI-read-audited. A link that
  403s is a broken UI; an unaudited PHI-bearing download is worse. Whichever way it
  resolves, **it gets an E2E assertion** so the answer is pinned rather than remembered.
- **Q2 — empty is acceptable, throwing is a BUG.** The page must not 500 for a
  legitimate reader. Unresolved attributions render a neutral pt-BR fallback, never a
  blank. (`backend` confirms whether `listMembers`/`listCaseTags` return `[]` or raise.)
- **Q3 — outbound referrals: SPLIT IT.** The referral **list** is case content under D3
  (cross-committee trajectory is close to the reason the quality office exists); the
  **wizard fuel** is not — loading `targetCommissions` for a principal who can never file
  one is dead weight *and* a small leak about other commissions. So: render the card
  read-only, list only, **no wizard, no `targetCommissions`/`technicalDirectionHospitalId`
  load**. ⚖ **Bounded fallback:** if that split costs more than ~one file of change, ship
  `referralsModule={null}` instead and log a follow-up — D7 is strictly read-only and
  shipping less beats shipping a leak. Decide on sight of the code; **report which way it
  went**.
- **Q4 — interviews & meetings: OMIT BOTH** (`interviewsEnabled={false}`,
  `meetingsEnabled={false}`). A card reading *"Nenhuma reunião"* when the truth is *"not
  visible to you"* is a false statement to the user; the inverse — a count without
  content — leaks deliberation volume, which is precisely what D4 withholds. Omission
  asserts nothing in either direction.
- **Q5 — TELL THE REVIEWER THEIR ACCESS IS REGISTERED.** One line under the case header,
  matching the NSP console convention ("A identificação do paciente não aparece nesta
  lista — … com acesso registrado"). For an oversight tool this is both honest and a
  healthy deterrent against casual browsing. `backend` confirms what event actually fires
  so the copy describes the real thing, not an assumed one.

---

## 6. Cross-owner coupling I will not resolve alone

| Coupling | Owner | Risk |
|---|---|---|
| `src/lib/members/__fixtures__/membership-roles.json` gains `quality_reviewer` (backend, per pgTAP 304 §10) ↔ `ROLE_LABELS.quality_reviewer` (file 26, mine). | fixture: backend · label: frontend | ⭐ **There is NO red-free ordering across two commits — proven, not reasoned.** See §6.1. |
| `affiliations-panel.test.ts` itself | **frontend (ruled)** — CLAUDE.md scopes `tester` to `e2e/**`; a colocated vitest beside a component I own is mine. | No edit expected (it iterates the fixture); ownership recorded so nobody waits on tester. |
| `src/lib/queries/session.ts`, `src/lib/queries/org.ts`, `src/lib/queries/dashboard.ts`, `src/lib/org/actions.ts`, `src/lib/queries/quality.ts` | **backend** | I touch none of them. Every need is in §5 as a request. |
| `src/components/referrals/build-case-referrals-module.ts` | frontend (`src/components/**`) | Only if Q3 lands as "keep the card". Otherwise untouched. |
| `src/components/dashboard/volume-trend.tsx` (file 27) | frontend | Shared with the commission dashboard. Behaviour change is *only* "hide an empty block", but it is a shared component → include the commission `dashboard` specs in the rerun set. |
| `supabase/seed.sql` reviewer personas | backend (A.5) | The E2E specs and my manual verification both need `quality.a@test.local` before file 2 can be exercised. **My screens cannot be verified in-browser until A.5 lands** — see §7. |

---

### 6.1 The role-label handshake has no red-free ordering (measured 2026-08-06)

The instruction was to land the pt-BR label **first**, on the reasoning that doing so
"removes the red window entirely". I tested it before complying. It does the opposite.

`affiliations-panel.test.ts` is **bidirectional by design** — its own comment says *"The
map must not drift the OTHER way either: a stale label for a removed role is dead pt-BR
that a reader will mistake for a live case."* So:

| Order | What reds |
|---|---|
| **label first** (fixture still 9 roles) | `carries no label for a role outside the fixture` — **measured:** `AssertionError: expected [ 'quality_reviewer' ] to deeply equal []` at `affiliations-panel.test.ts:61`. |
| **fixture first** (label absent) | `labels every role in the membership-role fixture`. |

And the fixture cannot move early either: pgTAP `304` §10 asserts fixture set == the live
`memberships_role_check` set, so regenerating it before **M1** lands reds `304` instead.

**Therefore the only red-free landing is both edits inside one commit range, after M1** —
backend regenerates the fixture, I add the label, neither is pushed alone. The label was
written, measured red, and **reverted**; it lands with backend's fixture change, not
before it. (The lead's standing rule holds either way: a transient red between two commits
on a feature branch is fine — *reporting* the branch green while it is red is not.)

Label chosen: **`quality_reviewer: "Revisor da Qualidade"`** — person-scoped, matching
every sibling in the map (`Coordenação do NSP`, `Membro do PQS`, `Direção técnica`), which
name the *seat a person holds*, not the office. `ROLE_LABELS` renders per-person blockers
in `end_affiliation`, so a person-scoped reading is the grammatical fit. The office name
"Escritório da Qualidade" stays as the **console/chip** label (files 1, 15) where the
subject genuinely is the office.

## 7. Testing note (aligned with plan §A.5's E2E list)

I do not write specs (tester owns `e2e/**`). What the specs must be able to assert, and
what I will do on my side:

**Reach discipline (the `cases-board-access.spec.ts` rule): the discriminator is the
principal's REACH, never a row count.** Every negative below must assert the actual
Next.js not-found UI or a specific absent control, paired with a positive control proving
the same surface genuinely has content for someone.

1. **Board renders for `quality.a`** — the console loads at `/o/rede-a/qualidade`, the
   commission chip for CCIH is present, and **specific seeded case numbers** appear
   (not "≥1 row"). The **"Casos restritos"** KPI shows the seeded `explicit_grants_only`
   count, and the locked case's number appears **nowhere** on the page.
2. **Case opens read-only** — `quality.a` opens a CCIH case and sees: the case number, a
   narrative body, the phase list (**content present** — proves the read arm works), and
   **absent**: "Notificar evento ao NSP", "Corrigir…", "Exibir identificação", "Editar",
   "Gerenciar caso", "Reabrir caso", "Nova entrevista", any "Adicionar" affordance. Matrix
   rows 1/2/3 are the ones that would silently pass a weaker assertion — name those three
   controls **explicitly** in the spec.
3. **The member sidebar is absent** (F1) — assert "Construtor" / "Gerenciar" / "Painel"
   are **not** in the page, and that the back link goes to `/o/rede-a/qualidade`.
4. **Excluded commission** — Farmácia B (seeded `'excluded'`) has no chip on the board and
   its case URL **404s**.
5. **Locked case URL 404s** for `quality.a` while a real coordinator reaches it (the
   non-vacuity pair).
6. **Cross-org** — `quality.b` (Rede B) reaches nothing in Rede A: `/o/rede-a/qualidade`
   404s.
7. **Admin toggles oversight** — `hospitaladmin.a1` (or `orgadmin.a`) flips CCIH to
   excluded at `/o/rede-a/manage/comissoes`; `quality.a`'s board loses the chip. Also
   assert a `staff_admin` does **not** see the toggle (D9: the committee cannot opt itself
   out).
8. **Dashboards** — the six aggregate charts render; **no CSV export control** and **no
   free-text / per-member block** anywhere on the page.
9. **Root landing** (F2) — `quality.a` signing in lands on the console, **not** on
   "Você ainda não tem acesso".
10. **Keyboard-only flow** (house rule) — Tab from the console header → hospital switcher
    (Enter opens, arrows select, Enter applies) → nav → a commission chip (`aria-pressed`
    flips) → a case link → Enter opens the case. Visible focus ring at every stop. Second
    keyboard path: the oversight toggle reachable and operable by Space with its label
    announced.

**My own gate before handing to tester:** `npm run lint` (0 warnings) **+
`npm run lint:css-vars`** + `npm run typecheck` + `npm run test` + **a real
`next build`** (a client value-import of a server query module aborts the build while
tsc/lint/vitest stay green) + **loading each new page in a running dev server** (a green
build does not prove an RSC boundary; a server function passed as a prop crashes at
render — which is exactly why file 12 takes a `Record<string,string>` map and not a
builder). Verification needs backend's A.5 seed personas; until they exist I can only
build, not confirm.

---

## 8. Sequencing I am asking for

1. Lead approves this plan (new route group — plan approval required).
2. `backend` posts D1–D9 signatures (A.6) + lands the A.5 seed personas.
3. I build in this order — each step independently verifiable:
   **(a)** file 18 `qualidadeHref` → **(b)** files 1–5 + 9–13 (the board) →
   **(c)** files 6–8 + 14 (dashboards) → **(d)** F1/F3 case-page widening: files 19–22, 15, 16 →
   **(e)** files 17, 23 (the toggle) → **(f)** files 24, 25, 26, 27 (nav, landing, label, guard).
4. Hand to `tester` with the §7 list.

Step (d) is the security-relevant one and should get its own review pass regardless of
where the phase gate lands.
