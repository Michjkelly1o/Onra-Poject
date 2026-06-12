This module global search, is a feature where the admin can search across the entire app from one place. We can search:
1. **Pages** — every visible admin section / sub-section (Dashboard, Schedule, Customers, POS, Products, Staff details tabs, Reports, Settings sub-pages, etc.). Clicking a result navigates to that page.
2. **Customers** — by full name, email, or phone. Result row shows the customer's avatar + name + email. Clicking navigates to that customer's profile.
3. **Classes** — by class template name (e.g. "Hot Yoga") OR a specific scheduled instance (e.g. "Hot Yoga · Mon 22 May 7am"). Clicking the template goes to the template detail; clicking a schedule row goes to the class detail.
4. **Products** — memberships, packages, gift cards, and promo codes by name/code. Clicking navigates to that product's detail page.

The global search reads from the same Zustand store every other module reads from, so it never goes stale — adding a customer in the Customer module makes them findable in search on the next keystroke. Same for everything else.

Disabled features (modules turned off in `feature-flags.ts`) are filtered out of the result list automatically so the admin never clicks a result that 404s. As soon as a flag is uncommented, the related results appear again.

We will work with 3 phases:
1. Create the search modal shell (trigger button in header → modal opens with input + 5 category chips + grouped result list + empty state + Esc/click-outside to close) and wire up keyboard nav inside the modal (↑↓ to move, Enter to navigate, Esc to close).
2. Build the index hook — pulls candidates from every relevant store slice + the sidebar nav config, applies the substring match against the typed query, filters out feature-flag-disabled routes, returns a scored + grouped list. Score order: exact match > startsWith > contains.
3. Wire navigation — clicking any result (or pressing Enter on the highlighted one) calls `router.push(href)` and closes the modal.

Let's breakdown the module:
1. **Trigger** — a single search button sits in the global header (left side of the existing Notification Bell). Click only, no keyboard shortcut. Clicking opens the modal centered on the screen with the input auto-focused.
2. **Modal layout** — top: search input with `SearchLg` icon on the left and an X close on the right. Below the input: a single row of 5 category chips. Below the chips: a "Results" body that either shows grouped rows or an empty state. Bottom: a thin keyboard-hint strip ("↑↓ Navigate · ↵ Open · Esc Close").
3. **Category chips** — exactly 5, in this order:
   - **All** (default selected)
   - **Pages**
   - **Customers**
   - **Classes**
   - **Products**

   The selected chip uses the Onra DS primary (green) pill style; unselected use the neutral gray pill. Picking a chip filters the result list to that category only. Picking "All" shows everything grouped under section headings.
4. **Result groups** — when "All" is selected, results render under uppercase tracking-wider headings in this priority order: PAGES → CUSTOMERS → CLASSES → PRODUCTS. Each group shows at most 5 rows; if there are more matches, a "Show all (N)" link sits at the end of the group.
5. **Result row** — left: small icon (page icon for Pages, avatar for Customers, category-image fallback for Classes, product type icon for Products). Center: title text matching the query (no highlight needed for v1). Right: optional sublabel (customer email, class date+time, product price, etc.). Hover: `bg-[#f9fafb]`. Highlighted (via keyboard): same hover bg plus a 2px green ring matching focus state across the app.
6. **Empty state** — when the input has at least 1 character but no matches, show the canonical `<EmptyState>` component centered with the `SearchLg` icon and copy: `"No results found"` / `"Try a different keyword or check spelling."`. When the input is empty, the body shows a brief hint: `"Start typing to search pages, customers, classes, and products."` (no icon, plain text centered).
7. **Disabled features** — every candidate is filtered through `isRouteDisabled(href)` before it enters the result list, so flags toggled OFF in `feature-flags.ts` immediately remove related results. No stale entries, no 404 clicks.
8. **Performance** — pure `useMemo` filter on every keystroke. Prototype data sizes (hundreds of rows total) make this trivially fast; no debouncing or indexing infrastructure needed.

Rules:
1. put attention to details
2. use the existing DS primitives — Modal shell from the canonical confirm-modal pattern, `Field` + input chrome from `StudioProfileFormPage`, `<EmptyState>` from `@/components/ui/EmptyState`, `<Button>` for any actions, `border-1` everywhere, `@untitledui/icons` only
3. don't broke the current UI, header, or flow we already create. The global search button just slots into the header before the notification bell; nothing existing moves
4. make sure the result list filters live as the user types, AND react to feature-flag changes without a refresh
5. clicking a disabled-route result must never happen — if it does, it's a bug because the indexer should have stripped it
6. modal closes on Esc, click outside the modal card, and after a successful navigation
7. when "All" is picked, group headers always appear in the same priority order (Pages → Customers → Classes → Products) even if some groups are empty (skip empty groups, don't render a header for an empty section)
