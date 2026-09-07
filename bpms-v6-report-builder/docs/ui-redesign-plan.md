# UI Redesign Plan — Material BPMS (v2 UI)

Status: **APPROVED PLAN** (awaiting execution) · Owner: Super Z · Created: 2026-09-05
Decisions locked with the user (AskUserQuestion round, 2026-09-05).

## 1. Goals

Replace the current emerald shadcn/ui look with a **Material Design based, more
user-friendly and more interactive** UI, while preserving 100% of v1 behavior
(engine, strategies, forms, versioning) and the Persian RTL language contract.

**Non-goals:** engine/backend behavior changes (except one small read-only
dashboard endpoint), i18n extraction (stays Persian-only), bpmn-js canvas
reskinning, replacing the form-builder/dnd logic.

## 2. Locked decisions

| Dimension | Decision |
|---|---|
| Material stack | **Hybrid** — Tailwind MD3 token restyle on existing shadcn/ui components; **MUI X DataGrid** (and MUI theme provider) for complex data tables |
| Palette | **Indigo classic** — primary `#3B5BDB` (light) / `#BAC3FF` (dark), MD3 tonal surfaces |
| Dark mode | Light + dark toggle in app bar (`next-themes`, already in deps), persisted, follows system by default |
| App shell | Modern MD shell: top app bar + collapsible sidebar (drawer ⇄ icon rail) + breadcrumbs + **KPI dashboard landing page** |
| Interactivity | All four: KPI dashboard, DataGrid tables, **Ctrl+K command palette**, micro-interactions (ripples, state layers, skeletons, transitions) |
| BPMN designer | Materialize **chrome only** (panels/toolbars/dialogs); bpmn-js canvas untouched |
| Language | Persian-only, RTL (project rule unchanged) |
| Rollout | **Incremental** — theme foundation first, then view-by-view, each phase browser-verified |

## 3. Design system spec (MD3 tokens, indigo seed)

### 3.1 Color roles (mapped into the EXISTING shadcn CSS variables)

Keeping shadcn var names (`--primary`, `--background`, …) means every existing
component re-skins instantly; only values change in `globals.css`.

| Role | Light | Dark | Used for |
|---|---|---|---|
| primary | `#3B5BDB` | `#BAC3FF` | main actions, active nav, RUNNING status |
| on-primary | `#FFFFFF` | `#1D2874` | text on primary |
| primary-container | `#E1E6FF` | `#3E4CAD` | selected rows, tonal buttons, active nav pill |
| on-primary-container | `#1C2C7C` | `#DCE1FF` | text on container |
| secondary | `#585E71` | `#C0C6DC` | secondary buttons, muted emphasis |
| tertiary (success) | `#2E7D32` | `#8FD694` | COMPLETED / تایید |
| error | `#BA1A1A` | `#FFB4AB` | FAILED / destructive / رد |
| warning (custom) | `#B26A00` | `#FFC46B` | PENDING / self-service badge |
| background | `#FBF9FE` | `#121317` | app background |
| surface / card | `#FFFFFF` | `#1E1F26` | cards, app bar (elevated) |
| surface-container | `#F1EEF9` | `#26282F` | tables header, secondary panels, designer tabs |
| outline / border | `#D9D9E3` / `#C4C6D4` | `#47464F` | borders, dividers |
| ring / focus | `#3B5BDB` | `#BAC3FF` | focus rings |

Status semantics (kept consistent everywhere): RUNNING=primary, COMPLETED=tertiary
green, FAILED/TERMINATED/CANCELLED=error/neutral, PENDING=warning amber.
`src/lib/i18n.ts` `statusColors` is the single place to re-map.

### 3.2 Typography — Vazirmatn (already loaded via next/font), MD3 type scale

| Token | Size/Line | Weight | Use |
|---|---|---|---|
| headline-md | 24/36 | 700 | page titles |
| title-lg | 20/30 | 600 | card/section titles |
| title-md | 16/26 | 500 | list item titles, dialog titles |
| body-md | 14/24 | 400 | body (Persian needs ≥1.6 line-height) |
| label-lg | 14/20 | 500 | buttons, tabs |
| label-md | 12/18 | 500 | badges, captions, breadcrumbs |

### 3.3 Shape

`--radius: 0.75rem` (12px) for cards; buttons → **full pill** (`rounded-full`);
dialogs 28px; chips/badges 8px; inputs 10–12px (MD3 outlined text field).

### 3.4 Elevation & state layers

MD3 shadow ramp (subtle): lvl1 `0 1px 2px rgb(0 0 0/.30), 0 1px 3px 1px rgb(0 0 0/.15)`,
lvl2 `0 1px 2px rgb(0 0 0/.30), 0 2px 6px 2px rgb(0 0 0/.15)`, lvl3 for dialogs/app bar.
State layers: hover = 8% primary overlay, press = 12% (utility classes
`.state-layer`, `.state-layer-press`). Ripple: shared `<Ripple/>` primitive +
`useRipple()` hook attached to Button/list rows/nav items.

### 3.5 Motion

- Route/page transitions: framer-motion `template.tsx` fade+8px slide (200ms, ease-out).
- List entrance: staggered 30ms/item fade-up.
- KPI numbers: count-up hook.
- Respect `prefers-reduced-motion`.

## 4. Target architecture (hybrid)

```
Tailwind 4 + MD3 tokens (globals.css)  ← restyled shadcn/ui (buttons, cards, dialogs, forms…)
MUI (@mui/material + @mui/x-data-grid) ← ONLY for list-view data tables
  └─ emotion RTL cache (stylis-plugin-rtl, dir="rtl") + indigo theme + faIR localeText
  └─ loaded per-view via next/dynamic (bundle isolation)
next-themes (class strategy)           ← dark mode; <html> already has suppressHydrationWarning
framer-motion                          ← transitions (already in deps)
recharts                               ← dashboard charts, MD3 colors (already in deps)
cmdk (shadcn command)                  ← Ctrl+K palette (already in deps)
```

New deps to install: `@mui/material @mui/x-data-grid @emotion/react @emotion/styled
@mui/material-nextjs stylis stylis-plugin-rtl`. Nothing removed yet (cleanup phase
may drop unused radix packages at the very end — optional).

### 4.1 URL routing migration (part of Phase 2)

Today navigation is AppShell `useState` (no URLs — no back button, no deep
links). Migrate to App Router pages; view components stay client components,
pages are thin wrappers:

```
src/app/page.tsx                    → redirect to /dashboard (keeps auth wrapper)
src/app/(app)/layout.tsx            → auth guard + new shell (app bar, sidebar, palette)
src/app/(app)/dashboard/page.tsx    → Phase 3 dashboard (KPIs + charts)
src/app/(app)/tasks/page.tsx        → tasks list (DataGrid)
src/app/(app)/tasks/[id]/page.tsx   → task detail
src/app/(app)/instances/page.tsx    → instances list
src/app/(app)/instances/[id]/page.tsx
src/app/(app)/processes/page.tsx
src/app/(app)/processes/[id]/design/page.tsx  → fullscreen designer (no shell)
src/app/(app)/admin/{departments,categories,users}/page.tsx  → ADMIN guard
```

`navigate()` becomes `router.push()`; `onViewTask/onBack/onOpenDesigner`
callbacks switch to typed `href`s. Old `AppShell` view-switcher is deleted after
migration. Escape hatch: if routing proves disruptive mid-phase, ship the shell
restyle first and defer URL move — visual redesign is independent of it.

### 4.2 Backend addition (only one): dashboard aggregates

`GET /api/dashboard` (auth; new `dashboard` module, read-only, no schema change):
`{ myPendingTasks, runningInstances, activeProcesses, completedLast7Days:
[{date,count}], instancesByStatus, recentTasks[≤5], recentInstances[≤5] }` —
ADMIN gets global numbers, USER gets own-scope numbers (mirrors `/tasks/mine`,
`/process-instances/mine`). Covered by a small E2E script.

## 5. Phased rollout (each phase = verified increment)

### Phase 0 — Boot & baseline
Install/run the stack in this environment (backend migrate+seed :3001, frontend
:3000), run all 5 E2E suites, capture before-screenshots of every view
(light), record tsc baseline. No code changes.
**Verify:** suites ✓, screenshots saved, baseline recorded.

### Phase 1 — Design tokens + dark mode + base component restyle
- `globals.css`: MD3 indigo palette (light+dark) mapped onto existing shadcn vars; new tokens (elevation, state layers, success/warning roles); radius 12px.
- `tailwind.config.ts`: keep `darkMode:"class"`; add tokens (success/warning/elevation) as needed.
- `layout.tsx`: wrap `ThemeProvider` (next-themes, attribute="class") + `MUIRTLProvider` placeholder (no MUI yet — provider lands in Phase 4, stub file created now).
- Restyle the ~20 actually-used shadcn primitives to MD3 (button→pill+ripple, card→elevation+12px, dialog 28px, input/select MD3 outlined, badge/chips, tabs→MD3 pills, table header surface-container, toast→snackbar, skeleton shimmer, dropdown/tooltip/menu, switch/checkbox, alert-dialog, avatar, separator, breadcrumb).
- `use-theme` hook + toggle button component; `Ripple` primitive; status colors re-mapped in `i18n.ts` only.
**Verify:** every existing view renders correctly in BOTH themes (tokens are compatible by construction), zero console errors, RTL intact, screenshots.

### Phase 2 — Shell, navigation & command palette
- App Router routes (§4.1), auth-guard layout, delete state-switcher.
- New `app-shell`: MD3 top app bar (brand, search-trigger→palette, theme toggle, user menu with role badge + logout) + collapsible sidebar (w-64 drawer ⇄ 72px icon rail, tooltips in rail mode, MD3 active pill `primary-container`), admin-only items gated as today.
- Breadcrumbs on detail views (tasks › detail / instances › detail).
- Global command palette (Ctrl+K + app-bar trigger): navigation, my pending tasks, processes (admin), actions (toggle theme, start instance → pick active process, logout). Persian placeholder labels.
- framer-motion page transition `template.tsx`.
**Verify:** every navigation path incl. deep links + browser back/refresh, designer fullscreen route, admin gating per role, palette flows; console clean.

### Phase 3 — Dashboard landing
- Backend `GET /api/dashboard` (§4.2) + `dashboardApi` in `lib/api.ts`.
- `dashboard-view.tsx`: role-aware — 4 KPI stat cards (count-up, MD3 tonal icons), 2 charts (instances-by-status donut, 7-day completed-trend bars — recharts, MD3 palette), recent tasks/instances lists (click → detail), quick actions (شروع فرآیند for ACTIVE processes; for ADMIN also jump-to-designer/فرآیند جدید).
- Register as landing view after login; sidebar gains «داشبورد» item.
- E2E: `scripts/test-dashboard-e2e.cjs` (aggregates correct for admin + user).
**Verify:** numbers cross-checked against DB; empty-state (fresh seed) and populated-state screenshots.

### Phase 4 — DataGrid list views (MUI)
- MUI provider with RTL emotion cache + indigo theme aligned to tokens + `faIR` DataGrid locale; `@mui/material-nextjs` for App Router.
- `material-data-grid.tsx` shared wrapper: RTL, Persian column labels, MD3-styled toolbar/pagination/chips, density toggle, `loading` skeleton overlay, error/empty states; lazy-loaded via `next/dynamic`.
- Migrate: tasks list (filters: status/self-service/process; actions: claim/complete→detail), instances (status chips, terminate w/ confirm), users, departments. Categories/processes keep card layouts but get sort/filter toolbar (MD3) — processes table may adopt DataGrid too if cleaner.
**Verify:** sort/filter/pagination each view; claim/release/terminate actions still work; RTL column alignment correct; bundle only pulls MUI on list routes.

### Phase 5 — Task/instance detail + forms (workflow heart)
- `task-detail-view`: MD3 two-pane (RTL: form right, metadata+history left), MD3 filled-text-field forms, file upload chips restyle, readOnly prefill presentation (lock icon + tonal surface), submit button with loading ripple.
- `instance-detail-view`: task timeline (MD3, status icons), restyled preview dialog, **instance attachments panel** (roadmap item #2 — endpoint `GET /files/by-instance/:id` already exists).
- Forms (`forms-view`, `form-builder`, `form-builder-panel`, `dynamic-form`): MD3 field palette, properties panel, live preview — dnd-kit logic untouched.
**Verify:** full browser leave-flow (john→annual→jane approve→notify), file upload+download, readOnly prefill, claim/release; console clean; E2E suites still pass.

### Phase 6 — Designer chrome + processes
- `process-designer-view`: MD3 header (name, «نسخه N» chip, save/activate buttons), left bpmn-js palette container + right tabs panel restyled (forms/assignments/conditions/variables); all four dialogs (assignment, gateway-conditions, versions, preview+print) to MD3 — **print CSS preserved** (`.process-print-area` rules in globals.css must keep working).
- bpmn-js canvas untouched (decision); canvas context menu remains.
- `processes-view` polish: version chip, status chips, actions.
**Verify:** edit+save (version bump), condition modal validation, versions restore, activate gate; `test-condition-validation.cjs` passes; print preview still paper-clean.

### Phase 7 — Admin views, login, polish, final QA
- `users-view`/`departments-view`/`categories-view` dialogs to MD3; `login-view`: centered MD3 card on indigo gradient, demo-account quick-login chips (admin/john/jane/bob).
- Empty/error states everywhere; micro-interaction pass (staggered lists, animated badges); focus-visible rings audit; reduced-motion respected.
- Optional cleanup: prune unused radix deps (only if zero imports remain).
- Final QA: all 5 E2E suites, tsc zero NEW errors vs baseline, full walkthrough both themes, screenshots set, docs update (`architecture.md` §6, `AGENTS.md` §7 UI notes), worklog entry.
**Verify:** definition of done below.

## 6. Risk register

| Risk | Mitigation |
|---|---|
| MUI (emotion) × Tailwind style-order conflicts | MUI only in DataGrid routes; shared wrapper owns its styling; visual regression check per view |
| MUI RTL (stylis-plugin-rtl) pitfalls (popovers, column alignment) | `direction:'rtl'` in theme + RTL cache provider; explicit RTL checks in Phase 4 verification |
| DataGrid bundle weight (~100KB gz) | `next/dynamic` import only on list views |
| Routing migration breaks nav callbacks | Mechanical map (grep `onViewTask|onBack|onOpenDesigner`), escape hatch documented in §4.1 |
| Dark-mode flash/hydration | next-themes with `suppressHydrationWarning` (already present on `<html>`) |
| Turbopack stale CSS (historic) | `rm -rf .next` + restart between phases; never trust old dev.log |
| Print CSS regression (preview dialog) | Protected verification step in Phase 6; print rules isolated in globals.css with `:has()` selectors — do not refactor them |
| Persian strings drift | `t` helper in `i18n.ts` untouched; new labels Persian; no English user-facing text |
| tsc baseline creep | Compare vs 13-error baseline after every phase |
| ValidationPipe DTO trap | No DTO changes planned; if dashboard endpoint grows params → decorate everything |

## 7. Definition of done (per project rules)

1. All 5 E2E suites pass (backend behavior unchanged; +1 new dashboard suite).
2. Zero NEW `tsc --noEmit` errors vs documented baseline.
3. Browser walkthrough of every view, both themes: zero console errors, RTL correct.
4. All user-facing strings Persian; dates `fa-IR`.
5. Screenshots (before/after) in `download/`; worklog entry appended per phase.
6. `docs/architecture.md` §6 + `AGENTS.md` updated to describe the new shell.

## 8. Future (out of scope now)

Jalali date picker, EN locale (i18n extraction), MUI X DatePickers, virtualized
DataGrid for very large task queues, FAB quick-actions, PWA shell.
