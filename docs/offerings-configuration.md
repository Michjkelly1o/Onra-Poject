# Offerings — studio-level on/off configuration

> **Audience:** owners setting up a studio (onboarding) + developers wiring the
> cascade later.
> **Status:** **UI only.** The settings tab and toggles exist and hold local
> state, but nothing is hidden yet — the store slice + cascade gating (§4) are
> **not implemented**. This doc specifies the intended behaviour so the wiring
> phase has a single reference.

---

## 1. What it is

Not every studio sells everything. A boutique yoga studio may only run
**class memberships**; a physiotherapy clinic may only sell **recovery**
sessions; a personal-training gym may live entirely on **private** sessions.

The **Offerings** tab lets an owner declare *what this studio actually sells*
and switch off the rest. Turning an offering **off** is meant to hide
**everything** related to it — sidebar menus, modules, catalog tabs, customer
plans, schedule surfaces and reports — so staff never see options the studio
doesn't use.

**Classes are the core and are always on.** Only the three optional offerings
can be switched off:

| Offering | What it covers |
|---|---|
| **Memberships** | Recurring plans customers subscribe to for ongoing access. |
| **Private sessions** | One-to-one bookings with an instructor (personal training, private class). |
| **Recovery** | Wellness / recovery sessions — sauna, stretch, ice bath, physiotherapy. |

Where it lives: **Settings → Operations → Offerings**
(`/admin/settings/offerings`).

---

## 2. Onboarding framing ("what you need")

During owner onboarding the same three toggles are surfaced as a "What does
your studio offer?" step. Everything starts **on**; the owner opts **out** of
what they don't run. Whatever they leave on is what their staff see from day
one — no empty modules, no irrelevant tabs.

The onboarding step and the settings tab read and write the **same** state, so
a choice made in onboarding is editable forever under
Settings → Operations → Offerings (and vice-versa).

---

## 3. Impact map — what each toggle hides

This is the full blast radius per offering. Nothing here is wired yet; it is
the checklist for the cascade phase (§4).

### 3.1 Memberships (off)

> Note: this toggle governs **memberships only**, not packages. Packages are a
> separate credit product and stay visible.

- **Sidebar** — Products & pricing → *Memberships & packages*: the
  **Memberships** tab/section (`/admin/products`, tab key `memberships`).
- **POS** — the **Memberships** catalog tab (`/admin/pos`).
- **Customer profile** — the **Memberships** tab / active-membership plan card.
- **Insights** (`/admin/kpi`) — the **Membership** tab (active members, MRR,
  churn, freeze count + AED value frozen).
- **Reports** (`/admin/reports`) — the membership portions of the
  *Membership & Package* report.
- **Dashboard** — the **Active members** KPI.
- **Marketing** — audience targeting *by membership type*; **Promo codes**
  target-customers option *membership type*.
- **Settings → Booking rules** — Freeze policy (applies to memberships) and the
  Cancellation-policy membership fee rows.

### 3.2 Private sessions (off)

- **Sidebar** — Products & pricing → **Private sessions**
  (`/admin/services?type=private`).
- **POS** — the **Private sessions** catalog tab + the session-picker modal's
  private service cards (`/admin/pos`).
- **Schedule** (`/admin/schedule`) — private appointments in the grid and the
  **Private** option in the session-type filter.
- **Customer profile** — private appointment bookings in the Bookings tab.
- **Insights / Reports** — private-session performance rows.
- **Settings → Tax** — the **Private** tax category.

### 3.3 Recovery (off)

- **Sidebar** — Products & pricing → **Recovery**
  (`/admin/services?type=recovery`).
- **POS** — the **Recovery** catalog tab + the session-picker modal's recovery
  service cards (`/admin/pos`).
- **Schedule** (`/admin/schedule`) — recovery appointments in the grid and the
  **Recovery** option in the session-type filter.
- **Customer profile** — recovery appointment bookings in the Bookings tab.
- **Insights / Reports** — recovery-session performance rows.
- **Settings → Tax** — the **Recovery** tax category.

### 3.4 Cross-cutting (any of the three off)

- **Booking / checkout flows** never offer the disabled product type.
- **Notifications** for that product type stop being generated.
- **AI-Agent import / migration** skips the disabled product type.
- **CSV / Excel exports** omit the disabled product type's columns/rows.

---

## 4. Wiring notes (cascade phase — not built)

The current tab is intentionally UI-only (client asked for the surface first).
When the cascade is implemented, the recommended shape:

1. **State** — add an `offerings` slice to the Zustand store
   (`src/lib/store.ts`), e.g.
   `offeringsEnabled: { membership: boolean; private: boolean; recovery: boolean }`,
   included in `partialize` (persisted) and guarded with a `version` bump.
2. **Single selector** — expose `isOfferingEnabled(key)` and consume it
   everywhere, mirroring the existing route blocklist pattern in
   [`src/config/feature-flags.ts`](../src/config/feature-flags.ts). One helper,
   many call-sites — no scattered booleans.
3. **Gate the surfaces in §3** — Sidebar nav items
   ([`src/components/layout/Sidebar.tsx`](../src/components/layout/Sidebar.tsx)),
   POS catalog tabs ([`src/app/admin/pos/page.tsx`](../src/app/admin/pos/page.tsx)),
   schedule session-type filter + appointment rendering
   ([`src/app/admin/schedule/page.tsx`](../src/app/admin/schedule/page.tsx)),
   customer-profile tabs, and reports/insights registry entries
   ([`src/config/reports-registry.ts`](../src/config/reports-registry.ts)).
4. **Onboarding** — the onboarding "what you offer" step reads/writes the same
   slice.
5. **Safety** — turning an offering off should **hide, never delete**. Existing
   records (a customer's active membership, a booked recovery appointment)
   remain in data; only the entry points disappear. Turning it back on restores
   every surface with data intact.

### Files in this feature (UI phase)

- Tab registration — [`src/config/settings-groups.ts`](../src/config/settings-groups.ts) (Operations group)
- Page component — [`src/components/settings/OfferingsPage.tsx`](../src/components/settings/OfferingsPage.tsx)
- Route — [`src/app/admin/settings/offerings/page.tsx`](../src/app/admin/settings/offerings/page.tsx)
- Titles / breadcrumbs — [`src/components/layout/Header.tsx`](../src/components/layout/Header.tsx), [`src/config/breadcrumbs.ts`](../src/config/breadcrumbs.ts)
