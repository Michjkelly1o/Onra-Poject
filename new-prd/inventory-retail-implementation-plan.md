# Onra — Inventory / Retail implementation plan

Companion to [`Onra_Reporting.xlsx`](./Onra_Reporting.xlsx) §7 INVENTORY / RETAIL.

Client 2026-07-27 — retail module that stores physical retail products (apparel, supplements, equipment, accessories, etc.), tracks branch-scoped stock, sells at POS + on the customer portal, and reports Retail Sales + Stock on Hand exactly per the client's Excel spec. Reuses every existing DS / module chrome — no new UI primitives.

---

## Client answers driving this plan (2026-07-27)

| # | Question | Decision |
|---|---|---|
| 1 | Stock at 0 | Decrement on POS sale + show **"Out of stock"** disabled card (visible but unclickable) |
| 2 | Branch scope | **Studio-global catalog + branch-scoped stock** (one product list, per-branch `unitsOnHand`) |
| 3 | Categories | **Editable in Settings → Operations → Retail categories** (matches `/admin/categories` UI exactly) |
| 4 | Sidebar placement | Sub-item under **Products** group |
| 5 | Image count | **One primary image** per product |
| 6 | Customer portal | **Yes** — retail shop on `/customer/shop` too |
| 7 | Tax + refund | **Same as memberships / packages** — VAT per Tax Settings, refundable through the standard POS refund flow |
| 8 | Reports | **Retail Sales + Stock on Hand** per Excel §7 |
| 9 | Archived receipts | **Snapshot name / SKU / price / unit cost at sale time** on the transaction line item so past receipts stay intact even after product edits / archives |

---

## Governing rules (apply to every phase)

- Every UI element must use an EXISTING component / pattern (see [Component reuse](#component-reuse--locked-list)). If a pattern doesn't exist, stop and confirm before inventing one.
- Every store change is additive (new optional fields, new slices). Existing shapes never mutate.
- Persist version bumps only when a slice shape changes; migration one-shot and idempotent.
- Every phase ends with `tsc --noEmit` + `yarn build` clean AND the existing Products, POS, Reports, Customer portal screens render correctly with no change to their behaviour.
- Retail slices are additive to the store; no existing slice is renamed or reshaped.
- No existing routes deleted / renamed. New routes only: `/admin/products/retail/*`, `/admin/settings/retail-categories`, `/admin/reports/retail-sales`, `/admin/reports/stock-on-hand`, `/customer/shop/*`.

---

## Data model

### `RetailCategory`

Same shape as `ClassCategory` so the same `CategoryModal` + `/admin/categories` table chrome drives both.

```
{ id, label, image_url?, status: "active" | "inactive", createdAt }
```

### `RetailProduct` (studio-global catalog)

```
{
  id,
  name,               // required
  sku,                // required, unique
  categoryId,         // FK → retailCategories.id
  description?,
  priceAed,           // required — POS sale price
  unitCostAed,        // required — needed for Gross margin % + Stock value
  reorderThreshold,   // required — Stock on Hand report + amber flag
  imageUrl?,          // one primary
  status: "active" | "inactive" | "archived",
  createdAt,
  updatedAt,
}
```

### `RetailStock` (branch-scoped, one row per (product, branch))

```
{
  id,
  productId,          // FK → retailProducts.id
  branchId,           // FK → branches.id
  unitsOnHand,        // current — decremented on POS sale, incremented on receive
  lastAdjustedAt?,
  lastReceivedAt?,
}
```

### `RetailStockAdjustment` (audit trail)

Every stock delta writes here so Stock on Hand's **Units received** / **Sell-through %** / **Stock turnover** can be computed in a period window.

```
{
  id,
  productId,
  branchId,
  delta,              // negative for sale / loss, positive for receive / adjust
  kind: "sale" | "receive" | "adjust" | "loss" | "refund",
  reason?,
  sourceTransactionId?, // FK when the change is tied to a POS sale / refund
  createdBy,
  createdAt,
}
```

### `CustomerTransaction` line-item extensions

```
{
  ...,
  productSnapshotName?,    // populated for retail lines at sale time
  productSnapshotSku?,
  productSnapshotPriceAed?,
  productSnapshotUnitCostAed?,
  branchIdAtSale?,
}
```

**Why snapshot** — client Q9 answer. Past receipts must render exactly as sold. Also enables gross-margin math after product edits / archives.

---

## Phase A — Data foundation (no UI change)

**Goal:** types + slices + seeds + CRUD actions + persist bump. Nothing visible changes; every downstream phase now has clean data to plug into.

**Store changes (`src/lib/store.ts`):**
- 4 new types + slices on `AppState`: `retailCategories`, `retailProducts`, `retailStock`, `retailStockAdjustments`.
- Seed data:
  - 5 hand-authored categories (Apparel, Supplements, Equipment, Accessories, Recovery — labels only, studio can rename freely).
  - ~15 products across the 5 categories (2–4 per category) — each with `name / sku / categoryId / priceAed / unitCostAed / reorderThreshold / imageUrl`.
  - Per-branch stock: for every active branch × every active product, one `RetailStock` row with a mid-range `unitsOnHand` (varied so Stock on Hand's amber-flag branch reads real).
  - `RetailStockAdjustments`: ~30 seed rows so Sell-through % and Stock turnover render on the report from day 1.
- New CRUD actions:
  - `addRetailCategory / updateRetailCategory / deleteRetailCategory` + `canDeleteRetailCategory` guard.
  - `addRetailProduct / updateRetailProduct / setRetailProductStatus / archiveRetailProduct` + `canDeleteRetailProduct` guard.
  - `adjustRetailStock(productId, branchId, delta, kind, reason?, sourceTransactionId?)` — writes both `RetailStock` update + `RetailStockAdjustment` entry in one `set()`.
  - `receiveRetailStock(productId, branchId, delta, reason?)` — thin wrapper on `adjustRetailStock` with `kind: "receive"`.

**Migration (persist middleware):**
- Persist bump v86 → v87.
- Rehydrate hook injects the seed rows for pre-v87 states (idempotent — checks each row's id before adding, matching the customer-lead-management showcase persona pattern).

**Verify:** `tsc + yarn build` clean; every existing Products, POS, Reports, Customer portal page renders identically. Highest-impact phase — done well, everything downstream is a UI wire-up.

---

## Phase B — Admin inventory list

**Goal:** `/admin/products/retail` list page + create/edit form + stock configure modal + sidebar entry.

**Route additions:**
- `/admin/products/retail` — list page (same chrome as gift cards)
- `/admin/products/retail/new` — create form (full page)
- `/admin/products/retail/[id]` — detail page
- `/admin/products/retail/[id]/edit` — edit form (full page)

**Components reused (see locked list at bottom):**
- Table chrome from [`/admin/products/gift-cards/page.tsx`](../src/app/admin/products/gift-cards/page.tsx): `ToolbarTotal`, `ToolbarSearch`, `ToolbarExport`, `ToolbarFilter`, `SortableHeader`, `TABLE_TH`, `TABLE_TD`, `BulkActionBar`, `Pagination`, `RowActions`, `StatusBadge`, `EmptyState`, `ConfirmModal`, floating bulk-delete pill.
- Filter side panel from `SlidePanel`.
- `SelectInput` for category picker.
- `ImageBannerUpload` for the product image.

**List table columns:**
- Checkbox
- Image + Name + Category pill
- SKU
- Price · AED
- Stock — aggregate across all branches (with a small drill-down chip)
- Status (Active / Inactive / Archived)
- Actions ⋮

**List toolbar:**
- Total count · Search · Export CSV · Filter (side panel) · Add product

**Filter side panel** (reused SlidePanel pattern):
- Category chips (from `retailCategories`)
- Status chips
- Stock level buckets: In stock / Low (≤ reorder threshold) / Out of stock

**Create / Edit form fields:**
- Name (required)
- SKU (required, unique across active products)
- Category (SelectInput from `retailCategories`)
- Description (optional multi-line)
- Price · AED (required, > 0)
- Unit cost · AED (required, ≥ 0) — with a helper "Used for gross-margin calculations in reports"
- Reorder threshold (integer, ≥ 0) — with a helper "Stock on Hand report flags products at or below this level"
- Image upload (one primary)
- Status (Active / Inactive radio)

**Configure stock modal** (opens from row action **Configure stock** or from the detail page):
- Per-branch stock rows, editable `unitsOnHand` inputs
- Reason picker (Received shipment / Manual adjustment / Lost / Damaged)
- On save: writes N `adjustRetailStock` entries (one per changed branch) in the same `set()` so React sees one consistent state.

**Sidebar entry:**
- Add `Retail` sub-item under the `Products` nav group (below Gift cards).

**Verify:** `tsc + yarn build` clean. Existing `/admin/products/*` routes (memberships, packages, gift cards, promo codes) unchanged. Sidebar's `Products` group expands to include Retail.

---

## Phase C — Settings retail categories

**Goal:** Settings → Operations → Retail categories tab, matching `/admin/categories` UI exactly.

**Route:** `/admin/settings/retail-categories`

**Placement:** `Settings → Operations` group, **after Tax** (per client 2026-07-27).

**Components reused:**
- Table chrome from [`/admin/categories/page.tsx`](../src/app/admin/categories/page.tsx) — literally the same TH/TD constants, RowActions dropdown, bulk-select, floating action pill, pagination.
- `CategoryModal` from [`src/components/settings/booking-rules/CategoryModal.tsx`](../src/components/settings/booking-rules/CategoryModal.tsx) — accepts `{ name, image_url }`; since `RetailCategory.label` mirrors `ClassCategory.name`, we pass a thin adapter or rename the field to `name` for consistency.
- `ConfirmModal` for delete.
- `ToolbarTotal`, `ToolbarSearch`, `StatusBadge`, `Pagination`.

**Behaviour:**
- Same table shape: **Checkbox · Image + Name · Status · Actions ⋮**.
- Row kebab: Edit · Delete.
- Delete blocked with a warning toast if any **non-archived** product references the category (`canDeleteRetailCategory` guard).
- Rename cascades everywhere on next render (product form dropdown, POS filter chips, report grouping label) via the "label lookup by id" pattern the audit-3 fix established for follow-up stages.
- Bulk delete only proceeds on categories with zero product references; guarded results table renders which ones were deleted vs blocked (matches gift-card bulk delete UX).

**Settings groups update (`src/config/settings-groups.ts`):**
- Add tab entry `{ label: "Retail categories", href: "/admin/settings/retail-categories" }` at the end of the Operations group's tabs array, after `Tax`.

**Verify:** `tsc + yarn build` clean. Existing Operations tabs (Booking rules, Tax, Integrations, Migration & imports) unchanged. Class categories page at `/admin/categories` unaffected.

---

## Phase D — POS integration

**Goal:** "Retail" tab in POS + image-banner card variant + stock decrement + snapshot line items.

**Route:** `/admin/pos` (existing — additive change only).

**Components reused:**
- `ProductPosCard` — **extended** with an image-banner variant (new optional `bannerImageUrl?: string` prop; when set, the banner renders a full-cover image instead of the tinted icon + concentric pattern).
- Cart mechanic (existing).
- Payment confirmation modal (existing).
- Category filter chips (reuse the `FilterPill` pattern used by the Retail list-page filter row).

**Tab strip change:**
- `All · Memberships · Packages · Gift cards · Retail`  (client 2026-07-27: Retail sits AFTER Gift cards).

**ProductPosCard extension:**
- Add `type: "retail"` to `ProductPosCardType` union.
- Extend props: `bannerImageUrl?: string`.
- Banner render logic:
  - `type === "retail"` → render `<img src={bannerImageUrl}>` full-cover with a subtle inset shadow; no concentric pattern; no tinted-icon tile.
  - Other types render as today.

**Retail tab body:**
- Category filter chip row at the top (from `retailCategories`, "All" chip first).
- Card grid of active retail products for the current branch.
- Cards with `unitsOnHand === 0` at the current branch render disabled with an **"Out of stock"** pill overlay on the banner.
- Add-to-cart button disabled at 0 stock.

**Line item shape (cart):**
- Extends existing POS cart line-item shape with `retailProductId`, `qty`, and snapshot fields populated at sale time.

**Sale completion (`applyPurchase` extension):**
- For each retail line item:
  - Snapshot `productSnapshotName / Sku / PriceAed / UnitCostAed / branchIdAtSale` onto the transaction line.
  - Call `adjustRetailStock(productId, branchId, -qty, "sale", undefined, transactionId)` in the SAME `set()` so the receipt + stock update are one atomic write.
- Existing membership / package / gift-card behaviour untouched.

**Refund flow (existing refundTransaction extended):**
- When a retail line item is refunded, `adjustRetailStock(productId, branchId, +qty, "refund", "Refund", transactionId)` fires. Stock comes back automatically.

**Verify:** `tsc + yarn build` clean. Existing POS flows for memberships / packages / gift cards unchanged. Cart, payment confirmation, receipts still work identically for non-retail sales.

---

## Phase E — Reports (per `Onra_Reporting.xlsx` §7)

**Goal:** Retail Sales report + Stock on Hand report, both matching the Excel spec column-for-column.

**Routes:**
- `/admin/reports/retail-sales`
- `/admin/reports/stock-on-hand`

**Components reused:**
- Existing report shell / pivot layout (Reports v33 — the shared table + toolbar + date range + branch filter chrome every report uses).
- `DateRangeFilter`, `SelectInput` (branch + category filters).
- `TABLE_TH` / `TABLE_TD` constants.
- `EmptyState`.

### Retail Sales report

**Data source:** `CustomerTransaction` line items where the line originated from a retail product (identified via the snapshot fields). Snapshot fields are the source of truth so archived / deleted products still surface historically.

**Columns (matching Excel §7 Retail Sales):**

| Column | Source |
|---|---|
| Product name | `productSnapshotName` |
| Category | Resolved via `productSnapshotSku` → current `retailProducts.categoryId` → `retailCategories.label` (falls back to snapshot category label if product deleted) |
| Units sold | Sum of qty in period |
| Net sales · AED | Sum of line total (post-discount, pre-refund) |
| Gross margin % | `(net − Σ(qty × productSnapshotUnitCostAed)) ÷ net × 100` |
| Attached to | **Yes** when the same customer has a **class booking OR non-retail transaction on the same calendar day** in the same branch. Else **No**. |

**Filters:** date range · branch · category.

**Group by:** product · category (default: product).

**Summary tiles at the top of the report:**
- **Attachment rate** — % of retail transactions where any line is `Attached to = Yes`
- **Avg items / sale** — mean line count per retail transaction
- **Avg retail spend / sale** — mean net sales AED per retail transaction

### Stock on Hand report

**Data source:** current `RetailStock` × `RetailProduct` join, plus `RetailStockAdjustment` aggregations for the period window.

**Columns (matching Excel §7 Stock on Hand):**

| Column | Source |
|---|---|
| Product name | `retailProducts.name` |
| Category | `retailCategories.label` (via FK) |
| SKU | `retailProducts.sku` |
| Units on hand | `retailStock.unitsOnHand` for the current branch (or aggregated if branch filter = "All") |
| Stock value · AED | `unitsOnHand × unitCostAed` |
| Reorder threshold | `retailProducts.reorderThreshold` |
| Units received (period) | Sum of `retailStockAdjustments.delta` where `kind = "receive"` in the date-range window |
| Sell-through % | `Σ(sold in period) ÷ Σ(received in period) × 100` |
| Stock turnover × | `Σ(sold in period) ÷ mean(unitsOnHand in period)` (mean approximated as `(start + end) / 2`) |

**Row flag:** when `unitsOnHand ≤ reorderThreshold`, row highlights with a subtle amber background + a `⚠ Reorder` badge in the Units column.

**Filters:** date range · branch · category.

**Group by:** category (default).

**Reports registry entry updates:**
- Add both reports to the reports registry / nav under a new **"Inventory / Retail"** report group so they list alongside the existing Financial / Membership / Client / Activity groups from Excel §1–§6.

**Verify:** `tsc + yarn build` clean. Every existing report page renders identically. Retail Sales attachment logic verified against a known-good demo transaction pair (retail sale + same-day class booking → Attached = Yes).

---

## Phase F — Customer portal shop

**Goal:** `/customer/shop` for browsing + purchasing retail products via the customer app.

**Routes:**
- `/customer/shop` — grid list
- `/customer/shop/[id]` — product detail

**Components reused:**
- Customer portal card patterns from existing `/customer/products/*` screens.
- Customer cart mechanic (existing) — extends to accept retail line items.
- Customer checkout flow (existing `applyPurchase` path) — retail lines snapshot + stock-decrement plumbing already lands in Phase D.
- Customer product detail page shell from `/customer/products/gift-card/*`.

**List page (`/customer/shop`):**
- Category filter chip row (from `retailCategories`)
- Search
- Product grid: image + name + price + Add-to-cart CTA
- Cards with `unitsOnHand === 0` at the customer's home branch render disabled with an "Out of stock" pill

**Detail page (`/customer/shop/[id]`):**
- Large primary image
- Name + category pill + price
- Description (if set)
- Qty picker (clamped to `unitsOnHand`)
- Add-to-cart CTA (disabled when at 0 stock)
- Related products (same category, optional)

**Stock read:**
- Reads `retailStock` filtered to the customer's `home branchId` (from `customer.branchId`).

**Checkout:**
- Retail line items go through the SAME `applyPurchase` extension from Phase D — same snapshot behaviour, same stock decrement, same receipt.

**Notifications:**
- Optional (Phase F+): send a customer notification when a favorited product comes back in stock. Skip for now unless client asks.

**Verify:** `tsc + yarn build` clean. Every existing customer portal route (bookings, appointments, gift cards, memberships) renders identically. Retail-portal add-to-cart writes the same shape of CustomerTransaction the POS flow does.

---

## Phase G — Audit + client feedback rounds

**Standard audit gates** (matching the 3-audit pattern that stabilised customer-lead-management):

1. **Data-vs-details consistency** — retail product's aggregate stock in the list matches sum of per-branch stock on the detail page. Reports' Units sold matches sum of relevant transaction lines.
2. **Cross-module sync** — every retail write triggers all dependent re-renders in the same render cycle:
   - Product edited → POS card + customer shop card + list row + reports header re-render.
   - Category renamed → product form dropdown + POS filter chip + report grouping label.
   - Product archived → hidden from POS + customer shop + list default filter, still visible on past receipts (snapshot).
   - POS sale → stock decrement + adjustment log + Stock on Hand report reflects.
   - Refund → stock increment + adjustment log with `kind: "refund"`.
3. **Store consistency** — chained `set()` calls (sale + stock decrement + adjustment log) receive the latest state; no stale closure.
4. **Migration idempotent** — Phase A rehydrate injection guarded by `id` checks so a mid-session persist bump doesn't duplicate seeds.
5. **AI Agent regression** — the AI Agent doesn't currently read retail slices; verify no accidental read path introduced.
6. **Type safety** — no `as` casts on the transaction snapshot fields that would mask a missing snapshot at read time.

**Cross-module wiring verify sweep** — walk every entry in the map below and confirm the reflected surface updates on next render, not next reload.

---

## Cross-module connection map

| When this happens... | It affects... |
|---|---|
| Retail category renamed (Settings) | Product form dropdown label · POS filter chip · Retail Sales + Stock on Hand report grouping labels |
| Retail category deleted (Settings) | Blocked with toast when any non-archived product references it (`canDeleteRetailCategory` guard) |
| Retail product edited (name / price / cost) | POS card · customer shop card · list row all re-render immediately; past receipts unchanged (snapshot preserved) |
| Retail product archived | Hidden from POS · customer shop · list default filter; still appears on past receipts (snapshot) |
| Retail product deleted (hard delete) | Blocked with toast if any transaction ever referenced it; only allowed for products with zero sales history |
| POS retail sale completed | `RetailStock.unitsOnHand -= qty`; `RetailStockAdjustment` entry with `kind: "sale"`; transaction line item snapshot filled; receipt renders; Retail Sales report reflects on next render |
| Customer portal retail purchase completed | Same as POS retail sale — same `applyPurchase` extension path |
| POS retail sale refunded | `RetailStock.unitsOnHand += qty`; `RetailStockAdjustment` entry with `kind: "refund"`; transaction status → refunded |
| Stock adjusted manually (Configure stock modal) | `RetailStockAdjustment` entry with `kind: "adjust"` + reason; Stock on Hand report Units received/Sell-through recompute |
| Stock received (bulk restock) | `RetailStockAdjustment` entry with `kind: "receive"`; Units received (period) + Sell-through % in Stock on Hand report update |
| Branch archived | Its retail stock rows preserved for historical reports; new POS sales default to active branches only |
| Category active/inactive toggled | Products in inactive category hidden from POS + customer shop; reports still see them for history |

---

## Component reuse — locked list

| Where I need something | Existing component I'll reuse |
|---|---|
| Table row chrome | `TABLE_TH` + `TABLE_TD` constants (from `src/lib/table-styles.ts`) |
| Toolbar row | `ToolbarTotal`, `ToolbarSearch`, `ToolbarExport`, `ToolbarFilter` (all from `src/components/patterns/*`) |
| Sortable column header | `SortableHeader` + `useSort` |
| Bulk-select checkbox cell | `CheckboxCell` (from gift-cards page) |
| Floating bulk-action pill | `BulkActionBar` (from gift-cards page) |
| Row action kebab | `RowActions` |
| Confirmation modal | `ConfirmModal` |
| Toast on any state change | `showToast` |
| Status pill | `StatusBadge` |
| Empty state | `EmptyState` |
| Pagination | `Pagination` |
| Filter side panel | `SlidePanel` |
| Selects / dropdowns | `SelectInput` |
| Image upload for the product | `ImageBannerUpload` (existing) |
| Category modal (name + image) | `CategoryModal` from `src/components/settings/booking-rules/CategoryModal.tsx` — reused as-is for retail categories |
| Product POS card | `ProductPosCard` — EXTENDED with `type: "retail"` variant + optional `bannerImageUrl` prop |
| Report table + filters | Existing report shell (Reports v33) |
| Customer portal product card | Existing customer product card pattern from `/customer/products/*` |
| Customer cart mechanic | Existing customer cart |
| Applies-a-sale plumbing | `applyPurchase` action — extended, not duplicated |
| Refund plumbing | `refundTransaction` action — extended, not duplicated |

**No new UI primitives are invented.** If a case comes up where a reuse doesn't fit, stop and confirm with the client before adding a new one.

---

## Safety recap

- 6 build phases (A–F) + 1 audit phase (G).
- Each build phase ends with a `tsc + build` gate + visual sanity check that no existing screen broke.
- 4 new slices additive: `retailCategories`, `retailProducts`, `retailStock`, `retailStockAdjustments`.
- `CustomerTransaction` line-item extension is **optional** — pre-existing membership / package / gift-card lines never gain snapshot fields, so no shape mutation.
- Persist migration one-shot at v86→v87 bump. Idempotent seed injection guarded by id checks.
- Zero existing routes broken. Only additive:
  - `/admin/products/retail`, `/new`, `/[id]`, `/[id]/edit`
  - `/admin/settings/retail-categories`
  - `/admin/reports/retail-sales`, `/stock-on-hand`
  - `/customer/shop`, `/shop/[id]`
- Every UI element traces back to a component we already have (see locked list above).
- The AI Agent's existing dataset reads are untouched — retail slices are simply new state the agent can OPT INTO later via `store-readers.ts` if the client asks for retail analytics via chat.

---

## Coverage check

### Client 9-question answers — every one covered

- ✅ Q1 Stock at 0 → Phase D "Out of stock" disabled card + Phase A `unitsOnHand` decrement.
- ✅ Q2 Branch scope → Phase A `RetailStock` per-branch table.
- ✅ Q3 Categories editable → Phase C Settings sub-tab.
- ✅ Q4 Sidebar sub-item under Products → Phase B sidebar entry.
- ✅ Q5 One primary image → Phase B form field + Phase D POS banner variant.
- ✅ Q6 Customer portal shop → Phase F `/customer/shop`.
- ✅ Q7 Same tax + refund → Phase D reuses existing tax + refundTransaction, plus stock-restore refund branch.
- ✅ Q8 Reports per Excel §7 → Phase E covers both, column-for-column below.
- ✅ Q9 Snapshot name at sale → Phase D transaction line-item snapshot fields.

### `Onra_Reporting.xlsx` §7 Inventory / Retail — every column covered

**Retail Sales:**
- ✅ Product name (from `productSnapshotName`)
- ✅ Product category (resolved via SKU → current category; snapshot fallback)
- ✅ Units sold
- ✅ Net sales · AED
- ✅ Gross margin % — `(net − Σ(qty × snapshotUnitCost)) ÷ net`
- ✅ Attached to — same-day same-customer class-booking or non-retail transaction check
- ✅ Summary metrics: Attachment rate · Avg items/sale · Avg retail spend/sale

**Stock on Hand:**
- ✅ Product name
- ✅ Product category
- ✅ SKU
- ✅ Units on hand
- ✅ Stock value — `unitsOnHand × unitCostAed`
- ✅ Reorder threshold — with amber row flag when `unitsOnHand ≤ threshold`
- ✅ Units received (period) — from `RetailStockAdjustment` `kind: "receive"`
- ✅ Sell-through % — `sold ÷ received`
- ✅ Stock turnover × — `sold ÷ avg unitsOnHand in period`
