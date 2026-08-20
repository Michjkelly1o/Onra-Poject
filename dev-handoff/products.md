# Products & Services (admin) — status & production work (dev handoff)

**Verdict — real and store-wired.** The product catalog renders live from the
`memberships`, `packages`, `giftCardDesigns` / `issuedGiftCards`, and retail
slices. CRUD, deactivate, archive, delete (when unused), and the POS-catalog
linkage all persist through the store. The archive/delete business rules are
implemented (not decorative).

> **This module is split across several routes and nav groups** — the "Products &
> pricing" sidebar group. Some pieces have their own handoff docs; this doc
> covers Memberships / Packages / Gift cards / Retail and points to the rest.

---

## Routes (the Products nav group)

| Route | What | Doc |
|---|---|---|
| `/admin/products` | **Memberships & Packages** — one page, `SegmentedTabs` toggle | this doc |
| `/admin/products/gift-cards` | Gift card designs + issued gift cards | this doc |
| `/admin/products/retail` + `/retail-categories` | Retail products + categories | this doc / [`export.md`](export.md) |
| `/admin/products/classes` | Class **templates** | [`schedule.md`](schedule.md) |
| `/admin/products/private`, `/admin/products/recovery` | Private / Recovery **services** | [`services-configuration.md`](services-configuration.md) |
| `/products/[id]`, `/products/new`, `/products/[id]/edit` | Product detail / create / edit (top-level takeover) | this doc |

**Promo codes moved out** — they now live under **Marketing** at
`/admin/marketing/promotions` (2026-08 URL cleanup), documented in
[`marketing.md`](marketing.md).

---

## Memberships & Packages (`/admin/products`)

- One list with a `SegmentedTabs` toggle: **Memberships** | **Packages**.
- Seeded from [`memberships.ts`](../src/data/mock/memberships.ts) +
  [`packages.ts`](../src/data/mock/packages.ts) — the **single source** for the POS
  catalog, the class-types "Applicable plans" tab, the checkout picker, and
  analytics. Never inline a product array anywhere else.
- **Active-members count is derived live** (matched from the `customers` store),
  never a stored counter.
- Detail page (`/products/[id]`) has an "Applicable plans" / category context; a
  status flip or delete propagates to the POS catalog + class-types tab in the
  same render cycle.

## Gift cards (`/admin/products/gift-cards`)

- **Designs** (templates) + **Issued** gift cards (sub-view). Issued cards are
  created when **sold through POS**, not authored here.
- Issued gift cards are **financial records — never deletable** (design decision +
  PRD).

## Retail (`/admin/products/retail`)

- Retail products + `retail-categories`, with per-branch stock
  (`retailStock`, `retailStockAdjustments`). Feeds the Retail Sales + Stock-on-Hand
  reports. Retail's two reports were skipped in the reports spec — see
  [`reports-and-insights.md`](reports-and-insights.md).

---

## Archive / Delete rules (implemented)

The standard lifecycle is enforced in the list's bulk-action bar and row actions:
**Deactivate → Archive → Delete**, where **Delete only appears when the item has
zero holders/history** (`hasDeletable` = ≥1 selected row with zero holders).
Archived rows move to their own section (toggle to view). Issued gift cards are
the exception — never deleted.

---

## What a real dev must build / harden

- **Product data is client-only** like everything else — see
  [`backend-and-auth.md`](backend-and-auth.md). Migrate the seeds to tables.
- **Product images** are base64 data-URLs in localStorage → object storage
  ([`backend-and-auth.md`](backend-and-auth.md) §3).
- **Retail pricing per-branch accordion** (step-2 of the retail form, collapsible
  per-branch stock when a product has size variants) is **postponed** — a parked
  UI enhancement, not a bug.
- **Deletion safety** — the "zero holders" check is computed client-side from the
  store; in production this must be a server-side constraint (FK / usage check)
  before a hard delete.

## Cross-module

- Products appear in **POS** ([`payments-and-pos.md`](payments-and-pos.md)) and on
  the customer profile Plan tab ([`customer-management.md`](customer-management.md)).
- Revenue from product sales feeds **Reports/Insights**
  ([`reports-and-insights.md`](reports-and-insights.md)).
