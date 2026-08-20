# Architecture & Centralization — how the app is built (dev handoff)

> **Read this after [`README.md`](README.md).** The README lists *what is
> simulated and must be built*. This doc explains *how the app is structured* —
> the single sources of truth, the centralization conventions, and the things a
> new developer must understand before touching the code. **Last updated: 2026-08-20.**

The guiding principle everywhere: **one source of truth, derive the rest.**
If you find yourself copying a value into two places, stop — there's almost
always a selector/helper that already derives it.

---

## 1. The prototype model in one paragraph

Client-only **Next.js 14 (App Router)**. There is **no backend** — the entire
"database" is one big **Zustand store** ([`src/lib/store.ts`](../src/lib/store.ts),
~14k lines) persisted to `localStorage`. Every screen is a `"use client"`
component that reads/writes that store. Data is seeded at boot from
[`src/data/mock/`](../src/data/mock/) (68 files, one per future table). The only
thing that leaves the browser is the AI agent (`src/app/api/ai-agent/*`, real
Anthropic API). Production work = replace the store with a real backend; see
[`backend-and-auth.md`](backend-and-auth.md).

---

## 2. The store — the single source of truth

[`src/lib/store.ts`](../src/lib/store.ts) — one `create()` wrapped in the
`persist` middleware.

- **Persist key:** `onra-demo-state` in `localStorage`. **Version:** `124`
  (constant `PERSIST_KEY`, `version:` in the persist options).
- **Bump `version` on any breaking seed/shape change** (e.g. adding a required
  field, changing a seed's meaning). On mismatch, Zustand discards the persisted
  payload and re-seeds from the mock files. This is how testers get new seed
  data. Adding an *optional* field doesn't strictly require a bump, but bump it
  if you want existing demos to pick up new seeded values.
- **Excluded from persistence (per-tab, by design):** `currentUser`,
  `currentRole`, `sidebarCollapsed`, `toast`, `pendingPurchase`,
  `bulkSelectionActive`. Persona is derived from the URL each load (§7), so
  persisting it would break the two-tab demo.
- **`onRehydrateStorage`** runs migration/backfill on every load (e.g. re-derives
  clock-relative statuses, backfills fields added since a persisted snapshot).
  Add backfills here when you add fields, so old snapshots don't crash.
- **Cross-tab sync:** a `window.storage` listener at the bottom of the file calls
  `useAppStore.persist.rehydrate()` when another tab writes — admin in one tab,
  instructor in another, same render cycle. Keep this in mind: writes are
  broadcast.

**Adapters:** seeds are snake_case; the prototype's in-memory shape is camelCase.
`*FromSeed` functions translate at boot (e.g. `referralSettingsFromSeed`). When
you add a table whose consumers need camelCase, add an adapter + seed the initial
state from `INITIAL_*`.

---

## 3. Centralized mock data — one file per future table

Full guide: [`src/data/mock/README.md`](../src/data/mock/README.md). The rules
that matter for correctness:

1. **One file = one future Postgres table**, named exactly (`customers.ts` →
   `customers`). 68 files today. Types in [`_types.ts`](../src/data/mock/_types.ts),
   all re-exported through [`index.ts`](../src/data/mock/index.ts) (respect the
   dependency order: Foundation → Locations → Products → Catalog → Schedule →
   Bookings).
2. **snake_case columns** — matches Postgres, so migration is a CSV/SQL export.
3. **FK by id only — never denormalize names onto dependent rows.** A
   `class_bookings` row stores `customer_id`, not `customer_name`. Consumers look
   the customer up at render time. (A few *schedule* rows carry denormalized
   display strings derived at boot for fast list rendering — that's the
   documented exception, not a licence to copy names around.)
4. **No baked-in counters.** "Active members per plan", "booked count", etc. are
   **derived live** from the relevant store slice — never stored. (Only
   `class_schedule.booked`/`rating_count` are pre-computed, mirroring how
   Postgres denormalizes those.)
5. **`+later:` comments** mark columns that depend on unbuilt modules — add them
   when that module ships.
6. **Synthetic data:** ~1,520 customers are generated at boot for realistic KPIs.
   **Do NOT seed these into production** — they're demo canvas only.

**Mock-data completeness rule:** a new table must cover *every displayed column*
+ *every create/edit form input*. Missing fields = broken forms.

---

## 4. Derivation over stored values — where the real logic lives

The app computes rather than stores. The main derivation layers:

- **Reports selectors** — [`src/lib/reports/selectors.ts`](../src/lib/reports/selectors.ts)
  (14 `select*` functions). Each takes the store `AppState` and returns the row
  shape a report needs. This is the single source of truth for report data.
  Reports are **registry-driven** (§6) — adding a report is mostly a
  config edit + a selector.
- **KPI/Insights** — [`src/lib/kpi/*`](../src/lib/kpi/) computes the Insights tiles
  and dashboard metrics. **Reuse selectors here** so screens agree. (Example from
  2026-08: marketing spend is derived by `selectMarketingSpend`; Insights,
  the dashboard widget, the CSV export, and the AI reader all call it via the
  `marketingSpendLedgerRows` helper — one source, so no surface disagrees. See
  [`marketing.md`](marketing.md).)
- **Balance/plan helpers** — money and credits are always derived through one
  helper, never read raw off a row. Canonical examples:
  - **Wallet:** always `walletBalanceAed` (account-credit ledger), never a stored
    balance field.
  - **Plan credits:** `derivePlanBalances`; the customer Plan-tab side panel must
    equal the sum of the Plan table's "Credit left" — both derive from the same
    helper. Never read `customer.creditsRemaining` raw for display.
- **Statuses** are re-derived from the device clock on hydrate (a past class flips
  to "Completed" automatically), not trusted off the persisted row.

**Rule of thumb:** money, credits, counts, and time-based statuses are *derived*.
If you need one, find the helper before writing a new calculation.

---

## 5. Centralized UI — check before you build a component

There is a strong "don't inline a duplicate" convention (see
`COMPONENT_CENTRALIZATION_PLAN.md` at repo root). Before creating any UI element,
check these first:

- **DS primitives** — [`src/components/ui/`](../src/components/ui/) (Button,
  Input, Select, Badge, Table, Tabs, Toast, Avatar, Checkbox, Switch, Tooltip,
  Pagination, SortableHeader, EmptyState, DatePicker, NumericInput, SelectInput,
  SlidePanel, FixedDropdown, …).
- **Shared patterns** — [`src/components/patterns/`](../src/components/patterns/)
  (RowActions, ToolbarSearch/Filter/Export/ImportButton, StatusBadge,
  DetailPageShell, DetailPageTabs, SectionHeader, ArchivedSection, BulkBarDock,
  AttendanceBar, NeutralAvatar, IconTooltip, …).
- **Modals** — [`src/components/modals/`](../src/components/modals/) (ConfirmModal,
  Modal, KpiModal). State-changing actions (delete/deactivate/archive/recover)
  use `ConfirmModal`; multi-field create/edit is a **full-page route**, not a modal.
- **Table styling** — `TABLE_TH`/`TABLE_TD` from
  [`src/lib/table-styles.ts`](../src/lib/table-styles.ts). Number-only columns are
  right-aligned (app-wide convention).
- **List UI cache** — [`src/lib/list-ui-cache.ts`](../src/lib/list-ui-cache.ts)
  (`usePersistedListState`) keeps a list's search/filter/page across a
  detail round-trip (in-memory, per session — **not** localStorage).
- **Marketing/form kit** — [`src/components/marketing/form-kit.tsx`](../src/components/marketing/form-kit.tsx)
  (Section/FormField/TextInput/Textarea/StepItem) for the campaign/announcement forms.

Notable house conventions (enforced across the app):
- Every button uses the [`<Button>`](../src/components/ui/button.tsx) component
  with `border-1` (explicit 1px), not raw `<button>`.
- Numeric inputs: placeholder `"0"`, empty when value is 0, strip leading zeros.
- Every CRUD/state-change action fires a **toast** (`showToast`).
- Internal detail links set `?returnTo=usePathname()` so close acts as "one step
  back" to wherever you came from — never a hardcoded module root.
- Bordered "view-card" containers have a fixed/min height (default
  `min-h-[760px]`) — they **fill, never hug** content, so the page doesn't jump on
  filter/search.

---

## 6. Config & registries — behaviour lives in data, not scattered code

Several behaviours are driven by a single config file. Edit the config, not N
call-sites:

- **Reports** — [`src/config/reports-registry.ts`](../src/config/reports-registry.ts)
  + [`src/config/reports/*`](../src/config/reports/) (one definition per report:
  columns, dimensions, measures, RBAC, selector name). `resolveSelector` maps the
  registry's selector string → the function in `selectors.ts`. A handful of
  reports (e.g. Acquisition Efficiency) have a **custom page** that composes
  selectors directly instead of the generic shell — those own their route.
- **Feature flags / route disabling** —
  [`src/config/feature-flags.ts`](../src/config/feature-flags.ts). `DISABLED_ROUTE_PREFIXES`
  is a prefix-match array; middleware rewrites matches to a 404. This is how a
  half-built or retired route (e.g. `/admin/marketing/spend`) is hidden without
  deleting code.
- **Breadcrumbs** — [`src/config/breadcrumbs.ts`](../src/config/breadcrumbs.ts)
  (`MODULE_LABELS` for list pages, `MODULE_ROOT` for detail pages + their dynamic
  resolvers).
- **Sidebar navigation** — the nav tree is `NAV_ITEMS` **inline in**
  [`src/components/layout/Sidebar.tsx`](../src/components/layout/Sidebar.tsx)
  (there is **no** `src/config/navigation.ts`, despite older docs — this is the
  real location). Active-state uses a global "longest-prefix wins" match; plain
  paths and `?query=` deep-links are both supported.
- **Settings groups** — [`src/config/settings-groups.ts`](../src/config/settings-groups.ts).

**Redirects** live in [`next.config.mjs`](../next.config.mjs) (`async redirects()`,
`permanent: true`). The 2026-08 URL cleanup added a redirect from every old route
to its new nav-matching path, so old bookmarks/links never 404. A redirect only
fires if no page matches the source — so a leftover folder would silently shadow
its redirect. **When you move a route: `git mv` the folder, update every
reference, add the redirect, and confirm the old folder is gone.**

---

## 7. RBAC & the "login" today — the biggest fake

Full detail + priorities: [`rbac-and-permissions.md`](rbac-and-permissions.md).
The short version a developer must internalize:

- **There is no auth.** `currentRole` / `currentUser` in the store are set by a
  **URL-driven persona auto-flip** in each layout: visiting `/admin/*` flips the
  persona to the admin demo user, `/instructor/*` to the instructor, etc. That's
  the entire "login."
- **The permission matrix is decorative.** `permission_templates.ts` +
  `roles.ts` render a nice matrix, but real gating is **hardcoded `currentRole
  === "…"` checks** in components. The 5 studio roles aren't truly distinguished.
- **Money-moving actions (refunds especially) have NO server-side enforcement** —
  today anyone in the demo can trigger them. This is the CRITICAL security item
  for production.
- **The AI agent's write-RBAC is the reference pattern** — reuse its approach
  when you build real authorization ([`ai-agent-rbac.md`](ai-agent-rbac.md)).

Production: replace persona-flip with Supabase Auth + RLS + route middleware, and
enforce permissions server-side.

---

## 8. Routing model

App Router under [`src/app/`](../src/app/). Persona is the first path segment:
`/admin/*`, `/instructor/*`, `/attendee/*`, `/customer/*` (customer is mobile-only,
rendered in a phone frame).

- **Takeover pages.** Detail/edit screens that need to render edge-to-edge (no
  sidebar/header) live at **top-level** paths, not under `/admin/*`: e.g.
  `/products/classes/[id]`, `/services/[id]`, `/marketing/[id]`,
  `/instructor/class/[id]`. This is intentional — the top-level route escapes the
  admin chrome. The instructor layout has an `isTakeover` branch that renders such
  routes full-screen. So a detail URL not matching its list's `/admin/*` prefix is
  **by design**, consistent across modules.
- **List routes** sit under the persona + nav group and match the sidebar
  (`/admin/staff/payroll`, `/admin/marketing/promotions`, `/admin/products/private`,
  …) after the 2026-08 URL cleanup.

---

## 9. Conventions a new developer MUST know (gotchas)

- **Hydration gate.** Any page whose visible values come from the persisted store
  can mismatch on a *fresh* load (server renders seed data, client rehydrates
  localStorage). Guard it with `useHasMounted()`
  ([`src/lib/use-has-mounted.ts`](../src/lib/use-has-mounted.ts)) — return a stable
  height-preserving shell until mounted, then the real data. Placed **after all
  hooks**. Used by `/admin/schedule`, Payroll, and the other data-heavy pages.
  (Production removes this need entirely once data is server-fetched.)
- **Persist version bump** when you change seed shape (§2), or testers keep stale
  data.
- **Unique identifiers.** Every full-name + email + phone across
  customers/staff/leads must be globally unique. Generators pair
  first×last sequentially — never independent modular cycling, no ordinal
  suffixes in names.
- **No dropdown separators** — flat menus only; never an `<hr>` between menu items
  (even before destructive actions).
- **Toolbar order** — the Import icon button renders immediately after the Filter
  button, always.
- **`AED`** is the only currency, format `AED [amount]`.
- **Dropdowns inside scrollable form cards** must use `FixedDropdown` or the menu
  clips.

---

## 10. Where to go next

- **What must be built for production:** [`README.md`](README.md) (master
  priority list) → [`backend-and-auth.md`](backend-and-auth.md) (do first).
- **Data schema:** [`src/data/mock/README.md`](../src/data/mock/README.md).
- **Per-module status:** the module docs in this folder (marketing, schedule,
  reports-and-insights, settings, payments-and-pos, notifications, staff-payroll,
  dashboard, services).
- **Migration/export contract:** [`export-migration.md`](export-migration.md) —
  id-first exports feed a Supabase seed; the AI-agent importer is the name-based
  ingest path.
