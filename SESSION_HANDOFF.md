# Session Handoff — Onra Studio Admin Dashboard

**Project:** Onra Studio fitness studio management SaaS — admin dashboard prototype  
**Stack:** Next.js 14 App Router · Tailwind CSS · Zustand · `@untitledui/icons` (never lucide-react) · TypeScript  
**Design source:** Figma file `nzV4uBZZ4MWQAKNs6lnW0O` (Onra — Studio Dashboard Prototype)

---

## Key files to read before continuing

| File | Why |
|---|---|
| `CLAUDE.md` | Project rules, tech stack, RBAC roles, all 13 modules spec |
| `src/lib/store.ts` | Zustand store — all types, mock data, actions |
| `src/app/schedule/new/page.tsx` | Add-schedule 3-step form (most complex page, ~1300 lines) |
| `src/app/admin/schedule/page.tsx` | Schedule list — week/day/month/list views, filter panel |
| `src/components/ui/DatePicker.tsx` | Reusable date picker — use this for ALL date-only inputs |
| `src/app/class-types/[id]/page.tsx` | Class template detail — 3-tab right panel |
| `src/app/class-types/new/page.tsx` | Create new template — 2-step form |

---

## What was built this session

### 1. Add Schedule flow (`/schedule/new`)
Full 3-step form outside the admin layout (no sidebar/header). Lives at `src/app/schedule/new/page.tsx`.

**Step 1 — Class details:**
- `TemplateDropdown`: no search, 82×82px thumbnail, 14px name, 12px description, icon row (Grid01 / MarkerPin01 / ClockFastForward / Users01). Opens from `left-0`.
- Duration input: no "min" suffix, value shows empty when 0 (no leading zeros).
- Capacity input: same fix.

**Step 2 — Location & instructor:**
- `LocationDropdown`: grouped by branch, over-capacity badge = `bg-[#fffaeb] border border-[#fedf89] text-[#dc6803]`, used-by-other badge = `bg-[#f2f4f7] text-[#667085]`.
- Over-capacity logic compares against `capacity` (step 1 current value), NOT `templateCapacity`.
- Right panel shows `8/8 → 6/6` (orange) when selected room < class capacity.
- `templateCapacity` state = original template value, never mutated by room selection.
- Spot selection toggle disabled until room is selected.
- "Customize spot" button: 162px fixed width, opens inline overlay (not a new route).
- Instructor cards: green `border-[#658774]` when selected, no outer glow shadow.

**Step 3 — Date & time:**
- Layout: Row 1 = `[Repeat | Date]` (grid-cols-2), Row 2 = `[Start time | End time]` (grid-cols-2).
- Date field: uses `<DatePicker>` component (not native `<input type="date">`).
- Start time: `<TimeDropdown>` — 15-min slots 6:00 AM–10:00 PM, grays out slots where selected instructor already has a class on that date/time.
- End time: **disabled computed display** — `calcEndTime(startTime, duration)`. Not user-selectable. Shows "Auto-calculated from X min duration".
- Recurring time slots (`TimeSlotRow`): start time = `TimeDropdown`, end time = same disabled computed display.

### 2. Customize Spot — inline overlay
The customize-spot page at `/schedule/new/customize-spot` is **no longer navigated to**. Instead, clicking "Customize spot" in step 2 sets `showCustomizeSpot(true)` which renders a full-screen `absolute inset-0` overlay within the same `/schedule/new` page. This preserves all step 2 state when closing the overlay.

Key overlay behaviour:
- "Customize spot" button → enables editing (`csCustomized = true`).
- "Update spot" button → saves layout/blocked spots, closes overlay. Disabled when `layoutExceeds`.
- "Cancel" → closes overlay without saving.
- Spot count is always `min(cols × rows, roomCapacity)` — never exceeds room capacity.

### 3. DatePicker component (`src/components/ui/DatePicker.tsx`)
Reusable single-date picker based on Figma node `6862:160002`.
- Trigger: calendar icon + formatted date (or placeholder).
- Popup: 282px wide, month navigation, 7-col grid (Mo–Su), 36×36px cells.
- Selected date: green filled circle `#658774`. Today: green text `#658774` on light green bg.
- Bottom panel: Cancel + Apply buttons.
- **Smart positioning**: auto-detects viewport space on open. Flips to `right-0` if not enough horizontal space. Flips to `bottom-[calc(100%+4px)]` if not enough vertical space.
- Already used in: step 3 date field, recurring end-date field, schedule filter panel.

### 4. TimeDropdown component (inline in `schedule/new/page.tsx`)
- 15-min slots from 06:00 to 22:00.
- `unavailable` prop: array of "HH:MM" strings → grayed out with "Unavailable" badge.
- `minAfter` prop: all slots ≤ this value are disabled (used on end time to prevent selecting same/earlier than start).
- Computed unavailability: instructor's existing classes on the selected date.

### 5. Schedule filter (`/admin/schedule`)
- "Custom date range" section now uses `<DatePicker>` (imported and used for both start and end date).

### 6. Class template detail (`/class-types/[id]`)
- "Applicable memberships" tab and "Applicable packages" tab both have a Filter button.
- Filter is a **single-select dropdown** (not multi-select checkboxes): All / Only enabled / Only disabled.
- Green dot on Filter button when active.
- `MEMBERSHIPS` data updated with `enabled: boolean` field.
- `PACKAGES` data updated with `enabled: boolean` field.
- Status badge column added to both tables (green = Enabled, gray = Disabled).

### 7. Create new template (`/class-types/new`)
- Step 2 "Applicable memberships" Filter button now opens `MembershipFilterDropdown`.
- Same single-select design: All / Only enabled / Only disabled.
- `MEMBERSHIP_ITEMS` updated with `enabled: boolean`.
- `visibleItems` derived from filter — "Select all" only selects visible items.

---

## Important patterns to follow

### Never break these
- All icons from `@untitledui/icons` — never `lucide-react`.
- All monetary values in AED.
- `DatePicker` for every date-only input (not `<input type="date">`).
- End time is always computed: `calcEndTime(startTime, duration)` — never user-editable.
- Over-capacity comparison uses `capacity` (step 1 mutable value), not `templateCapacity`.

### Badge style rule
All badges use **background + border** (never outline-only):
- Warning/over-capacity: `bg-[#fffaeb] border border-[#fedf89] text-[#dc6803]`
- Neutral/used: `bg-[#f2f4f7] text-[#667085]`
- Success/enabled: `bg-[#ecfdf3] border border-[#abefc6] text-[#067647]`
- Inactive: `bg-[#f9fafb] border border-[#e4e7ec] text-[#344054]`

### Filter design rule
Membership/status filters are **single-select dropdowns** (not panels, not multi-checkbox):
- Options: All / Only [X] / Only [Y]
- Green dot indicator when active
- Selected item: green highlight + check mark

---

## Pending / not yet started

- Class detail page (`/schedule/[classId]`) — roster, attendance, ratings, cancel flow
- All other modules (Booking, POS, Customers, Products, Marketing, Analytics, Staff, Settings, Notifications)
- Supabase integration (currently all mock data in Zustand store)
- Role-based visibility (RBAC conditions with `hasRole([...])`)
- Mobile views for Instructor and Customer roles

---

## Module build order (from CLAUDE.md)

Build Owner role view for each module first (sees everything), then verify other roles via role switcher.

Next in queue based on schedule work done: **Module 04 — Booking System** (roster on class detail links to bookings).
