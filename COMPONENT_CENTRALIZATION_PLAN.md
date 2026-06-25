# Component Centralization Plan — Onra Studio

> **Status**: Planning — implementation NOT started.
> **Created**: 2026-06-24
> **Owner**: any developer continuing this codebase.
> **Goal**: Reach 95%+ component centralization before the customer side build begins, without breaking the demo, app state, or persisted data.

---

## 1. Why this plan exists

The Onra Studio prototype was built page-by-page from Figma specs. The core design system primitives in [`src/components/ui/`](src/components/ui) are well-centralized (Button, SelectInput, SortableHeader, SlidePanel, etc.). But **module-specific patterns were inlined into page files instead of extracted to shared components** — so the same status badge, the same row dropdown, the same modal chrome, the same filter pill, etc. each got re-implemented per module.

A full audit on **2026-06-24** found **201+ duplicate implementations across 14 patterns** with ~5,000–7,000 lines of boilerplate that could be deleted. As the app grows (customer side coming) and the dev team takes over for production, this duplication becomes:
- A bug-multiplier (fix one badge, miss six others)
- An onboarding cost (new devs see "which RowActions do I use?")
- A rebrand blocker (hex codes hardcoded, not all routed through tokens)
- A migration risk (more files for the Supabase swap)

This plan documents what to centralize, in what order, with what guardrails — designed to be executed incrementally without disrupting the live demo.

---

## 2. Audit inventory (the duplication map)

> **Audit history**: First-pass audit on 2026-06-24 found 14 patterns (~201 dupes). A second-pass audit on the same date filled gaps and surfaced **9 additional pattern categories** including the biggest finding: **106 named modal instances** (vs the 15 confirmation modals counted in pass 1) and **20 detail-page two-column shells** sharing identical layout. Combined total: **~380+ duplicate implementations across 23 patterns**.

### 2.1 First-pass findings (general primitive duplication)

| # | Pattern | Implementations found | Canonical exists? | Divergence | Priority |
|---|---|---|---|---|---|
| 1 | **Table TH/TD class constants** | 32 files | No | Low (mostly identical) | **CRITICAL — easiest win** |
| 2 | **StatusBadge** (CustomerStatusBadge, BookingStatusBadge, ClassStatusBadge, etc.) | 36 files | No | High (each takes different status enum) | **CRITICAL** |
| 3 | **Row Actions Dropdown** (RowActions, RowMenu, *RowActions) | 27 files | No | Medium (varying item counts) | **HIGH** |
| 4 | **FilterPill** (selection chip in filter panels) | 16 files | No | Low (identical) | **HIGH** |
| 5 | **SectionHeader** | 10 files (3 different APIs) | No | High (inconsistent props) | **HIGH** |
| 6 | **Avatar wrappers** (StaffAvatar, InstructorAvatar, CustomerAvatar, ProductAvatar, etc.) | 23 files | Primitive only | Medium | MEDIUM |
| 7 | **FieldLabel** | 6 files (2 different APIs) | No | Medium | MEDIUM |
| 8 | **List page Toolbar** (Total + Search + Export + Filter + Add) | ~15 pages | No | Medium | MEDIUM |
| 9 | **Pagination** | 20+ files (no shared primitive) | No | Low | MEDIUM |
| 10 | **EmptyState / EmptyTablePane** | 8 files | `EmptyState` exists but unused | Low | MEDIUM |
| 11 | **SortableHeader (local copies in 3 modals)** | 3 local + 1 canonical | Yes — replace local | Low | LOW |
| 12 | **ActionBtn** (sidebar action button: icon + label) | 3 files | No | None | LOW |
| 13 | **RangeSection / ValueChip** | 2 files | No | None | LOW |

**First-pass subtotal: ~201 duplicate implementations**

### 2.2 Second-pass findings (deeper structural patterns)

| # | Pattern | Implementations found | Canonical exists? | Divergence | Priority |
|---|---|---|---|---|---|
| 14 | **Modal SHELLS — every named modal in the app** (CancelClassModal, CancelBookingModal, AddCustomerModal, PaymentConfirmationModal, RoomCapacityModal, AddCustomerConfirmationModal, POSModal, CheckoutConfirmationModal, RemoveBookingModal, DeleteReviewModal, FreezeModal, UnfreezeModal, CancelPlanModal, ActionModal × many, ProcessPayrollModal, PayrollSubmittedModal, ChangeShiftModal, AssignStaffModal, ChangeRoleModal, RoomDetailModal, TaxRateModal, AgreementContentModal, CategoryModal, CustomerImportModal, BookingModal, PosNewCustomerModal, EditInstructorProfileModal, AddWidgetModal, GiftCardRecipientModal, the 4 dashboard KPI modals, etc.) | **106 instances** (91 inline + 15 dedicated files) | `ModalShell` exists at `admin/settings/payments/page.tsx` but unused elsewhere | High (shapes vary widely) | **CRITICAL** |
| 15 | **Detail-page two-column shell** (`<div className="flex gap-6 h-[832px]">` + left sidebar card + right tabs panel) | 15 detail pages share identical layout | No | Low (literally identical chrome) | **CRITICAL** |
| 16 | **Segmented pill tabs** (`bg-surface-secondary border-1 border-gray-200 rounded-[10px] p-1 gap-1` row of toggle buttons) | 7 rounded-pill instances + 10+ detail-page tab arrays | No | Low (consistent visual, varying tab arrays) | **HIGH** |
| 17 | **Recharts wrappers** (LineChart / BarChart with shared `margin`, axis config, tooltip styling repeated inline) | 15+ instances across 3 files (admin dashboard, insights, instructor dashboard, DashboardWidgetCard) | Partial (`InstructorCharts.tsx` for instructor only) | Medium | **HIGH** |
| 18 | **BulkActionBar — inline implementations** (`BulkActionBar` is NOT a shared component despite existing in module pages; each page rebuilds chrome) | 6 inline implementations | No | Low | **HIGH** |
| 19 | **Notification + activity row chrome** (NotificationRow in 2 places + TeamActivityRow + ActivityRow on dashboard — comment even acknowledges "Row chrome MIRRORS NotificationRow") | 4 implementations | No | Low | MEDIUM |
| 20 | **Rating + AttendanceBar derived badges** (StarRating × 2, RatingStars × 2, RatingCell, AttendanceBar × 3, PlanIconBadge / PackageIconBadge / MembershipIconBadge) | 9 implementations with 6 duplicates | No | Low–Medium | MEDIUM |
| 21 | **KPI MetricCard variants** (admin dashboard `MetricCard`, admin insights `InsightMetricCard`, admin compensation `MetricCard`, instructor `InstructorMetricCard`) | 4 distinct implementations | Partial (instructor card exists; admin variants don't share) | Medium | MEDIUM |
| 22 | **Multi-select pills** (Status filter pills, Categories pills, Day-of-week pickers, What-stood-out review tags, Applicable categories) | 6+ inline implementations | No | Low (visually consistent, hand-coded each time) | MEDIUM |
| 23 | **`buildMonthGrid()` helper** (the calendar grid builder) | 2 duplicates (admin schedule + instructor schedule) | No | None (identical logic) | LOW |
| 24 | **Divider component** (h-px / w-px dividers in custom shapes) | 2 named (CustomerDetailsTab `Divider`, ToolbarDivider in RichTextEditor) + many inline `<div className="h-px ...">` | No | Low | LOW |

**Second-pass subtotal: ~180+ duplicate implementations**

### 2.3 Combined totals

| Metric | Value |
|---|---|
| Total patterns identified | **23** |
| Total duplicate implementations | **~380+** |
| New shared files to create | **18–24** |
| Files to refactor | **120–140** |
| Estimated lines of boilerplate deletable | **~7,500–10,000** |
| Coverage of plan after execution | **~95–97%** (Section 10's recurring audit catches the long tail) |

### 2.1 Pattern detail — high-priority specifics

> Full per-file locations + line numbers were captured during the audit. They live in this commit's session notes — re-run the audit agent on this branch to regenerate the per-file list when starting Phase 2.

**StatusBadge** is the biggest visual-consistency win. 36 implementations across:
- Every list page (`admin/customers`, `admin/products`, `admin/schedule`, `admin/services`, `admin/agreements`, `admin/tax`, `admin/class-types`, `admin/marketing`, `admin/promo-codes`, `admin/gift-cards`, `admin/categories`)
- Every detail page (`CustomerDetailPage`, `AgreementDetailPage`, etc.)
- The shared `src/components/ui/badge.tsx` (exports `BookingStatusBadge` only)
- Takeover detail pages (`/schedule/[id]`, `/class/[id]`, `/earnings/[id]`)
- Customer profile inner tabs (`CustomerBookingsTab`, `CustomerPaymentsTab`)

**RowActions** has 27 implementations with 1–7 menu items varying per module. Same kebab + FixedDropdown chrome across all 27.

**TH/TD constants** is the mechanical "no-brainer" — 32 files each define the same `const TH = "px-4 py-3 text-left text-[12px] font-medium text-[#667085] border-b border-[#e4e7ec]"`.

---

## 3. Target architecture

Where new shared components live, after this plan executes:

```
src/components/
├── ui/                       ← Primitives (UNCHANGED — already centralized)
│   ├── Button.tsx
│   ├── SelectInput.tsx
│   ├── TextInput.tsx
│   ├── Textarea.tsx
│   ├── Checkbox.tsx
│   ├── Toggle.tsx
│   ├── RangeSlider.tsx
│   ├── SortableHeader.tsx
│   ├── SlidePanel.tsx
│   ├── FixedDropdown.tsx
│   ├── Toast.tsx
│   ├── DatePicker.tsx
│   ├── TableAvatar.tsx
│   ├── BulkActionBar.tsx         ← NEW (extracted from 6 inline impls)
│   ├── Pagination.tsx            ← NEW (extracted from 20+ inline impls)
│   ├── Divider.tsx               ← NEW (extracted from inline `<div className="h-px...">`)
│   └── ...
│
├── patterns/                 ← NEW — composite patterns (multiple primitives)
│   ├── StatusBadge.tsx           ← consolidates 36 implementations
│   ├── RowActions.tsx            ← consolidates 27 implementations
│   ├── FilterPill.tsx            ← consolidates 16 implementations
│   ├── SectionHeader.tsx         ← consolidates 10 implementations
│   ├── SectionCard.tsx           ← consolidates SectionCard wrappers
│   ├── FieldLabel.tsx            ← consolidates 6 implementations
│   ├── EmptyState.tsx            ← moves canonical here, updates 6 consumers
│   ├── ActionBtn.tsx             ← consolidates 3 implementations
│   ├── MetricCard.tsx            ← consolidates the 4 KPI metric card variants
│   ├── ListToolbar.tsx           ← consolidates ~15 list page toolbars
│   ├── SegmentedTabs.tsx         ← NEW (rounded-pill tab row, 7+ instances)
│   ├── DetailPageTabs.tsx        ← NEW (detail page tab arrays, 10+ pages)
│   ├── DetailPageShell.tsx       ← NEW (two-column h-[832px] layout, 15 pages)
│   ├── MultiSelectPills.tsx      ← NEW (multi-select pill list, 6+ inline impls)
│   ├── RatingDisplay.tsx         ← NEW (consolidates StarRating + RatingStars + RatingCell)
│   ├── AttendanceBar.tsx         ← NEW (consolidates 3 inline impls)
│   ├── PlanIconBadge.tsx         ← centralizes Package/Membership icon badges
│   ├── NotificationRow.tsx       ← NEW (consolidates 2 NotificationRow + 2 activity rows)
│   └── StepSidebar.tsx           ← NEW (extracts StepRow/StepSidebar form chrome)
│
├── modals/                   ← NEW — modal shells
│   ├── Modal.tsx                 ← base shell (backdrop + container + close)
│   ├── ModalHeader.tsx           ← title + subtitle + close button row
│   ├── ConfirmModal.tsx          ← consolidates ~20 confirmation modals (Action/Delete/Toggle variants)
│   ├── KpiModal.tsx              ← dashboard KPI modal shell (4 modals reuse)
│   └── README.md                 ← documents the migration path for the other ~80 named modals
│
├── charts/                   ← NEW — Recharts wrappers
│   ├── SharedLineChart.tsx       ← wraps LineChart with shared axis/margin/tooltip config
│   ├── SharedBarChart.tsx        ← wraps BarChart with same
│   ├── ChartContainer.tsx        ← responsive wrapper + empty-state handling
│   └── chart-axis-props.ts       ← shared axisProps object (currently inlined ~15x)
│
├── layout/                   ← UNCHANGED (Header, Sidebar)
├── customers/                ← Module-specific stays here
├── staff/                    ← Module-specific stays here
├── services/                 ← Module-specific stays here
├── products/                 ← Module-specific stays here
├── marketing/                ← Module-specific stays here
├── settings/                 ← Module-specific stays here
└── schedule/                 ← Module-specific stays here

src/lib/
├── table-styles.ts           ← NEW — `TABLE_TH` + `TABLE_TD` constants (kills 32 duplicates)
└── calendar-utils.ts         ← NEW — extracted `buildMonthGrid()` (kills 2 duplicates)
```

**Rule**: anything that appears in 2+ module files moves to `patterns/` or `modals/`. Anything that's truly one module's chrome (e.g., `CustomerDetailsTab` form layout) stays in the module folder.

---

## 4. Migration plan — 7 phases with safety gates

Execute in this order. Do NOT skip phases. Verify after each phase before starting the next. **Phases 6 and 7 were added after the second-pass audit** to cover the modal explosion, detail-page shells, tabs, and chart wrappers that the first pass missed.

### Phase 1 — Mechanical wins (low risk, high impact)

**Goal**: Consolidate things with identical APIs across all duplicates. Zero behavior change possible because the API doesn't vary.

| Task | Effort | Files touched | Risk |
|---|---|---|---|
| 1.1 Create `src/lib/table-styles.ts` with `TABLE_TH` + `TABLE_TD` exports | 5 min | 1 new file | Zero |
| 1.2 Replace local `const TH` / `const TD` in 32 files with the import | 30 min | 32 files | Zero (identical strings) |
| 1.3 Create `src/components/patterns/FilterPill.tsx` | 15 min | 1 new file | Zero |
| 1.4 Replace 16 inline FilterPill components with the import | 30 min | 16 files | Zero |
| 1.5 Create `src/components/patterns/EmptyState.tsx` (move + standardize from canonical) | 15 min | 1 file | Zero |
| 1.6 Replace 6 inline EmptyState / EmptyTablePane with imports | 20 min | 6 files | Zero |
| 1.7 Delete the 3 local SortableHeader copies in dashboard modals, import canonical | 20 min | 3 files | Low — small API adjustment in 3 modals |

**Verification gate after Phase 1:**
- `node ./node_modules/typescript/bin/tsc --noEmit` exit 0
- `npx next build` exit 0 (92/92 pages)
- Manual visual smoke: open `/admin/customers`, `/admin/schedule`, `/admin/products`, the 3 dashboard KPI modals — confirm they look identical to before
- Commit to branch with message: `refactor: phase 1 mechanical centralization (TH/TD, FilterPill, EmptyState, SortableHeader)`

**Phase 1 outcome**: ~57 duplicate implementations deleted in ~2.5 hours. No risk to demo state because the substituted code is functionally identical.

---

### Phase 2 — StatusBadge consolidation (medium risk, biggest visual win)

**Goal**: One `<StatusBadge>` component handling every status type the app uses.

**API design:**
```tsx
// src/components/patterns/StatusBadge.tsx
type StatusType =
  | "customer" | "product" | "schedule" | "service" | "agreement"
  | "tax" | "template" | "marketing" | "booking" | "appointment"
  | "instructor" | "role" | "shift" | "gift_card" | "promo" | "plan";

interface StatusBadgeProps {
  type: StatusType;
  status: string;          // value within that type's enum
  /** Optional inline text appended after status (e.g., "Waitlist #3"). */
  label?: string;
  /** Override the icon (some badges include a small dot/icon). */
  size?: "sm" | "md";
}

// Maps each (type, status) pair to a palette + label string.
// Defined once, internally — no per-page palette code.
```

**Migration steps:**
1. Create [`src/components/patterns/StatusBadge.tsx`](src/components/patterns/StatusBadge.tsx) with the consolidated palette map
2. For each of the 36 call sites, replace the local `*StatusBadge` with `<StatusBadge type="..." status={s} />`
3. Delete each of the 36 local implementations
4. Keep the canonical `BookingStatusBadge` export in `src/components/ui/badge.tsx` as a re-export for backward compat (in case external code imports it)

**Risk mitigation:**
- Do it module-by-module (customers first, then products, then schedule, etc.) — 10 commits, not 1
- After each module, run typecheck + visual check
- Status values are TypeScript-typed — wrong status string fails at compile time

**Phase 2 verification gate:**
- Typecheck clean
- Build clean
- Manual smoke on EVERY list page (10–12 pages) — badges look identical
- Persisted state (`onra-demo-state` in localStorage) unchanged — badges are pure presentation, no store touched

**Phase 2 outcome**: ~36 duplicates deleted, ~1.5–2 hours.

---

### Phase 3 — RowActions consolidation (medium risk, big maintainability win)

**Goal**: One `<RowActions>` component with item array prop.

**API design:**
```tsx
// src/components/patterns/RowActions.tsx
interface RowActionItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  /** Red text + red icon. Used for Delete / Deactivate. */
  danger?: boolean;
  /** Hide this item conditionally (e.g., Delete only when no history). */
  hidden?: boolean;
  /** Disable + show tooltip. */
  disabled?: boolean;
  disabledReason?: string;
  /** Visual divider AFTER this item. */
  divider?: boolean;
}

interface RowActionsProps {
  items: RowActionItem[];
  triggerLabel?: string; // aria-label for the kebab button
}

// Renders the kebab + FixedDropdown pattern, identical to the 27 current
// implementations. Items are computed by the consumer based on row state.
```

**Migration steps (per file):**
1. Identify which menu items the local `RowActions` produces
2. Convert to an `items` array
3. Replace the JSX with `<RowActions items={items} />`
4. Delete the local component definition

**Risk mitigation:**
- Module-by-module, smallest first
- Keep `Categories` (2 items) and `Customer Bookings tab` (1 item) as the test cases — verify those work before moving to the 7-item customer list dropdown
- Use TypeScript strict mode — wrong items shape fails at compile time

**Phase 3 verification gate:**
- Click through every kebab menu on every list page (~12 pages)
- Confirm: View → navigates correctly (returnTo preserved), Edit → navigates correctly, Delete → opens confirm modal, etc.
- The store should NOT be touched in this phase. Verify no mutations leaked.

**Phase 3 outcome**: ~27 duplicates deleted, ~2.5 hours.

---

### Phase 4 — Modal shells (HIGH risk, biggest scope of any phase)

**Goal**: One `<Modal>` base shell + `<ConfirmModal>` + `<KpiModal>` that **all 106 modal instances** in the app build on.

> **Why this phase grew**: the first audit counted 15 confirmation modals. The second audit found **91 inline modal functions + 15 dedicated modal files = 106 named modals total**. Most share the same backdrop + container + close button chrome but were written by hand each time.

**Step 4.1 — Base Modal shell:**
```tsx
// src/components/modals/Modal.tsx
export function Modal({ open, onClose, children, maxWidth = 480, lockScroll = true }) { /* backdrop + container */ }
Modal.Header = function ModalHeader({ title, subtitle, onClose, icon }) { /* ... */ };
Modal.Body = function ModalBody({ children, scrollable = true }) { /* ... */ };
Modal.Footer = function ModalFooter({ children, align = "right" }) { /* ... */ };
```

**Step 4.2 — ConfirmModal built on top:**
```tsx
// src/components/modals/ConfirmModal.tsx
type Tone = "danger" | "success" | "warning" | "info";
interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  icon?: React.ComponentType;
  tone: Tone;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  /** Bulk variant (shows count + plural language). */
  count?: number;
  /** Disable the confirm button. */
  confirmDisabled?: boolean;
}
```

**Step 4.3 — KpiModal shell (for the 4 dashboard modals):**
```tsx
// src/components/modals/KpiModal.tsx
interface KpiModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  maxWidth?: number; // default 720
  height?: number;   // default 560
  children: React.ReactNode;
}
```

**Migration steps — sub-phases because of the scale (106 modals):**

**4A — Foundation (~30 min)**
1. Create the 3 shell components in `src/components/modals/`
2. Document the migration pattern in `src/components/modals/README.md`
3. No call-site changes yet — just the foundation

**4B — KPI dashboard modals (~30 min, 4 modals, low risk):**
- Refactor `CancellationsModal` → use `<KpiModal>` shell
- Refactor `ClassesModal` → use `<KpiModal>` shell
- Refactor `AttendanceModal` → use `<KpiModal>` shell
- Refactor `ClientsModal` → use `<KpiModal>` shell
- Verify routing on row clicks still works

**4C — Confirmation modals (Action/Delete/Toggle variants) (~90 min, ~20 instances):**
The "ActionModal" pattern appears 15+ times. Migrate module-by-module:
1. `/admin/customers` ActionModal
2. `/admin/products` + gift cards + promo codes ActionModal
3. `/admin/schedule` AdminCancelClassModal
4. `/admin/services` ActionModal
5. `/admin/settings/agreements` ActionModal
6. `/admin/settings/tax` ActionModal + PricesIncludeTaxConfirmModal
7. `/admin/settings/page.tsx` GenericConfirmModal + ToggleConfirmModal
8. `/admin/settings/notifications` ChannelToggleConfirmModal
9. `/admin/settings/referral` ReferralToggleConfirmModal
10. `/admin/staff/pay-rate` ConfirmModal
11. `/admin/categories` DeleteConfirmModal
12. `/components/staff/{ShiftDetailPage,PayRateDetailPage,StaffDetailPage}` ConfirmModal × 3
13. `/components/services/ServiceDetailPage` ActionModal
14. `/components/settings/booking-rules` DeleteConfirmModal
15. `/app/marketing/[id]` ActionModal
16. `/app/products/*/[id]` ActionModal × 3

**4D — Specialized data-input modals (~120 min, ~50 modals):**
These need careful migration because they have unique inner content:
- `/app/schedule/[classId]` — CancelBookingModal, CancelClassModal, AddCustomerModal, PaymentConfirmationModal, RoomCapacityModal, AddCustomerConfirmationModal, POSModal, CheckoutConfirmationModal, RemoveBookingModal, DeleteReviewModal (10 modals in this file alone)
- `/app/admin/settings/payments` — ModalShell, ConnectModal, LoadingModal, ViewModal, EnableWalletModal (5 modals)
- `/components/customers/CustomerDetailPage` — FreezeModal, UnfreezeModal, CancelPlanModal
- `/components/services/{AppointmentDetailPage,ServiceDetailPage}` — CancelAppointmentModal, CancelBookingModal, RemoveBookingModal, DeleteReviewModal
- `/components/staff/{ShiftDetailPage,ShiftManagementTab,PayrollRunPage}` — ChangeShiftModal, ProcessPayrollModal, PayrollSubmittedModal, action modals
- `/components/staff/{AssignStaffModal,ChangeRoleModal}` (dedicated files)
- `/components/settings/{TaxRateModal,AgreementContentModal,booking-rules/CategoryModal,rooms/RoomDetailModal}` (dedicated files)
- `/components/customers/CustomerImportModal` (dedicated)
- `/components/instructor/account/EditInstructorProfileModal` (dedicated)
- `/components/dashboard/AddWidgetModal` (dedicated)
- `/components/member/BookingModal` + `/components/pos/PosNewCustomerModal` (member/POS dedicated)
- `/app/admin/pos` GiftCardRecipientModal

**4E — Verification + cleanup (~30 min):**
- Sweep for any remaining `fixed inset-0 ... bg-[#0c111d]/...` inline modal divs that weren't migrated
- Delete any obsolete inline modal definitions
- Update the modal `README.md` with the final canonical patterns

**Risk mitigation:**
- Modal closing logic + Escape key + click-outside behavior MUST stay identical across ALL 106 modals
- Each modal has slightly different behavior (some block close while async work runs, some have custom keyboard handlers) — preserve verbatim
- The 4 KPI modals interact with router (navigation on row click) — verify navigation still triggers `onClose` first to avoid orphan overlays
- The POS modal + Schedule add-customer modal are NESTED — confirm parent/child close behavior unchanged
- The Member booking modal lives in customer-side flow — verify before touching

**Phase 4 verification gate:**
- Open every single modal in the app via every entry point — confirm no visual regression
- Confirm all modals close consistently via X, backdrop, Escape, save/confirm action
- Confirm `returnTo` behavior is unchanged (modals don't break it)
- Confirm nested modals (POS → confirmation flows) still chain correctly
- Confirm form modals still preserve draft state (sessionStorage backup)

**Phase 4 outcome**: ~100+ duplicate modal implementations deleted, **~5–6 hours** (was 3h estimate — increased after second-pass audit revealed 7× scale).

---

### Phase 5 — Form atoms + Avatars + Toolbar + Pagination (medium risk, broadest scope)

**Goal**: Eliminate the remaining form chrome duplication and list-page toolbar repetition.

**Step 5.1 — Form atoms:**
- Create `src/components/patterns/FieldLabel.tsx` — unified API (`label: string, hint?: string`)
- Create `src/components/patterns/SectionHeader.tsx` — unified API (`title: string, subtitle?: string, right?: ReactNode, small?: boolean`)
- Refactor the 6 FieldLabel call sites + 10 SectionHeader call sites

**Step 5.2 — Pagination primitive:**
- Create `src/components/ui/Pagination.tsx` with unified API
- Refactor 20+ list pages

**Step 5.3 — ListToolbar:**
- Create `src/components/patterns/ListToolbar.tsx` that wraps Total + optional Branch + Search + optional Export + Filter + Add
- Refactor ~15 list pages

**Step 5.4 — Avatar wrappers:**
- Decide: keep module-specific avatar wrappers as thin shims OR consolidate to one polymorphic `<Avatar>` with `type` prop
- Recommendation: keep TableAvatar primitive, delete redundant wrappers that only re-export with different prop shapes

**Risk mitigation:**
- This phase is the broadest — split into multiple commits per step
- Toolbar refactor changes layout — visually verify carefully
- Each form page change must preserve form state shape

**Phase 5 verification gate:**
- Every list page renders with correct toolbar layout
- Every form page submits correctly + preserves draft (sessionStorage for some)
- Pagination cycles work + persist across navigation
- Avatars render correctly in tables, detail page headers, modals

**Phase 5 outcome**: ~50 duplicates deleted, ~4–5 hours.

---

### Phase 6 — Detail-page shells + Tabs (HIGH risk, MAJOR layout consolidation)

**Goal**: One `<DetailPageShell>` for the 15 two-column h-[832px] detail pages + `<SegmentedTabs>` + `<DetailPageTabs>` for the 17+ tab layouts.

> **Why this phase exists**: the second audit found 15 detail pages share an IDENTICAL chrome — `<div className="flex gap-6 h-[832px]">` + left sidebar card + right tabs panel. They each rebuild this from scratch. Plus 10+ of those same pages hardcode their tab button arrays inline.

**Step 6.1 — DetailPageShell:**
```tsx
// src/components/patterns/DetailPageShell.tsx
interface DetailPageShellProps {
  /** Left sidebar content — usually the entity info card + action buttons */
  sidebar: React.ReactNode;
  /** Right panel content — usually tabs + table */
  main: React.ReactNode;
  /** Container height (default 832px per CLAUDE.md rule 7 — never hugs) */
  height?: number;
}
// Renders: <div className="flex gap-6 h-[height]px">
//           <Card className="w-[320px]">{sidebar}</Card>
//           <Card className="flex-1">{main}</Card>
//         </div>
```

**Step 6.2 — SegmentedTabs (rounded-pill tab row):**
```tsx
// src/components/patterns/SegmentedTabs.tsx
interface TabDef { key: string; label: string; count?: number; disabled?: boolean; }
interface SegmentedTabsProps {
  tabs: TabDef[];
  activeKey: string;
  onChange: (key: string) => void;
}
```

**Step 6.3 — DetailPageTabs (tab navigation for detail pages):**
```tsx
// src/components/patterns/DetailPageTabs.tsx
// Same API as SegmentedTabs but renders the detail-page horizontal tab pattern (underline style)
```

**Migration steps (sub-phases because 25+ pages are affected):**

**6A — Foundation (~20 min):**
1. Create the 3 components
2. Apply to ONE detail page as proof of concept (e.g., `PayRateDetailPage` or `RoleDetailPage` — they're smaller)
3. Verify visual + behavior parity

**6B — Detail page migrations (~120 min, 15 pages):**
Migrate one at a time, verify each:
- `/components/customers/CustomerDetailPage`
- `/components/staff/{StaffDetailPage, RoleDetailPage, PayRateDetailPage, PayrollInstructorDetailPage}`
- `/components/services/ServiceDetailPage`
- `/components/settings/{AgreementDetailPage, branches/BranchDetailPage}`
- `/app/schedule/[classId]/page.tsx`
- `/app/class-types/[id]/page.tsx`
- `/app/class/[classId]/page.tsx`
- `/app/earnings/[classId]/page.tsx`
- `/app/products/[id]/page.tsx`
- `/app/products/gift-cards/[id]/page.tsx`
- `/app/products/promo-codes/[id]/page.tsx`
- `/app/marketing/[id]/page.tsx`

**6C — Tab consolidation (~45 min, 17+ instances):**
Replace inline tab button arrays with `<DetailPageTabs>` or `<SegmentedTabs>`:
- 7 rounded-pill instances (admin/instructor schedule, POS list/grid, CancellationsModal, StaffPermissionsPage × 2)
- 10+ detail page tab arrays (already migrated as part of 6B above for some)

**Risk mitigation:**
- The 832px height is a CLAUDE.md rule (#7) — DetailPageShell must enforce it
- Tab state preservation across navigation needs careful handling
- Some tabs deep-link via URL (`?tab=bookings`) — preserve `useSearchParams` flow
- Some detail pages have inner sub-tabs INSIDE the main tab (Customer profile has 9 outer tabs, several with inner content) — handle nesting carefully

**Phase 6 verification gate:**
- Every detail page loads with correct layout (320px sidebar + flex-1 main)
- Every tab clicks correctly + preserves state
- Deep-linked tab URLs (`?tab=...`) still work
- Sticky elements (action footer, sidebar buttons) still pin correctly

**Phase 6 outcome**: ~32 duplicates deleted (15 shells + 17 tabs), ~3 hours.

---

### Phase 7 — Charts + Calendar utils + Multi-select + Rating/AttendanceBar (MEDIUM risk)

**Goal**: Final pass on the remaining mid-priority patterns: Recharts wrappers, calendar utilities, multi-select pill lists, rating/attendance displays, dividers, and notification rows.

**Step 7.1 — Recharts wrappers (~60 min):**
```tsx
// src/components/charts/SharedLineChart.tsx
// src/components/charts/SharedBarChart.tsx
// src/components/charts/chart-axis-props.ts
```
Migrate:
- `/app/instructor/dashboard/page.tsx` (3 chart instances)
- `/components/dashboard/DashboardWidgetCard.tsx` (12+ variants — biggest consolidation here)
- `/components/staff/InstructorCharts.tsx`
- Admin dashboard charts
- Insights page charts

**Step 7.2 — `buildMonthGrid` to shared util (~10 min):**
Move to `src/lib/calendar-utils.ts`, replace 2 inline copies with import.

**Step 7.3 — MultiSelectPills (~30 min):**
```tsx
// src/components/patterns/MultiSelectPills.tsx
interface MultiSelectPillsProps {
  pills: { id: string; label: string }[];
  selectedIds: string[];
  onChange: (next: string[]) => void;
}
```
Replace 6+ inline implementations.

**Step 7.4 — RatingDisplay + AttendanceBar + PlanIconBadge (~30 min):**
- `<RatingDisplay rating={n} count={c} size="md" />` — consolidates `StarRating`, `RatingStars`, `RatingCell` (5 instances)
- `<AttendanceBar booked={b} capacity={c} />` — consolidates 3 inline impls
- `<PlanIconBadge kind="membership" | "package" />` — centralize the 3 plan icon badges

**Step 7.5 — NotificationRow + ActivityRow (~30 min):**
Consolidate the 4 row implementations into 2 components:
- `<NotificationRow notification={n} onClick={handle} />`
- `<ActivityRow activity={a} />`

**Step 7.6 — Divider component (~10 min):**
- Move `Divider()` from `CustomerDetailsTab` to `src/components/ui/Divider.tsx`
- Replace inline `<div className="h-px ...">` with `<Divider />` across detail pages

**Risk mitigation:**
- Charts: preserve the exact tooltip + axis + tick formatting (clients see these)
- Recharts margin/padding values must NOT change (visual regression risk)
- Multi-select pills must preserve current selection state + onChange contract
- Rating display: precision (decimal places, star half-fills) must match

**Phase 7 verification gate:**
- Every dashboard chart renders with correct data + tooltip
- Every multi-select filter (Status, Categories, Days, etc.) toggles correctly
- Every rating display shows correct stars + count
- Every notification panel + activity feed renders rows correctly
- Schedule month view still renders for admin AND instructor

**Phase 7 outcome**: ~50 duplicates deleted, ~3 hours.

---

## 5. Safety rules (apply to every phase)

These rules exist to make sure centralization doesn't break the demo, the persisted state, or the work already done.

### 5.1 No behavior changes
The refactor must NOT change what the app does. Same clicks → same actions, same form submits → same store mutations, same navigations → same URLs. If a behavior change is needed, it goes in a SEPARATE commit (not the centralization commit) so reviewers can split-test.

### 5.2 No visual changes
The new shared component must render visually identically to the old inline version. If there are tiny pixel differences (a 1px border, a font-weight mismatch), normalize them in a third commit AFTER the centralization is done.

### 5.3 No store changes
The Zustand store ([src/lib/store.ts](src/lib/store.ts)) MUST NOT be touched during centralization. The store's `persist` version stays at `2`. Persisted demo state (`onra-demo-state` in localStorage) survives every phase.

### 5.4 No data layer changes
The mock data files ([src/data/mock/](src/data/mock/)) MUST NOT be touched. Schema for future Supabase migration stays stable.

### 5.5 TypeScript first
Every shared component has a strict typed API. Wrong prop shapes fail at `tsc --noEmit`. This is the primary regression guard.

### 5.6 Module-by-module migration
Within each phase, refactor ONE module at a time and commit. Don't do all 32 TH/TD replacements in one giant commit — do customers, then schedule, then products, etc. Smaller commits = easier review + easier rollback.

### 5.7 Build verification after every commit
After every migration commit:
1. `node ./node_modules/typescript/bin/tsc --noEmit` — must exit 0
2. `npx next build` — must exit 0 with all 92 pages prerendered
3. Quick visual check of the migrated module in browser

### 5.8 The returnTo contract stays intact
Per [memory: feedback-returnto-current-pathname](.claude/projects/-Users-hizkiast-Desktop-Syncfit/memory/feedback_returnto_current_pathname.md): every internal detail-page link uses `?returnTo=${encodeURIComponent(pathname)}`. The new `<RowActions>` and any new navigation entry point MUST preserve this contract.

### 5.9 Feature flag preservation
[src/config/feature-flags.ts](src/config/feature-flags.ts) MUST NOT be touched. The currently disabled instructor routes stay disabled.

### 5.10 If a phase breaks the demo: rollback immediately
The branch model means rollback is `git revert <commit>` or `git reset --hard <previous-sha>`. Don't try to fix forward under pressure — roll back, regroup, retry.

---

## 6. Rules for future development (after centralization is done)

Once the plan executes, these rules prevent re-introducing duplication:

### 6.1 Before creating any new component
1. Check [src/components/ui/](src/components/ui/) for primitives
2. Check [src/components/patterns/](src/components/patterns/) for composite patterns
3. Check [src/components/modals/](src/components/modals/) for modal chrome
4. If a similar pattern exists → use it (even if it needs a small prop addition)
5. If genuinely new → add it to the appropriate shared folder, NOT inline in the page

### 6.2 The 2-strikes rule
First time a pattern appears → inline is OK (might be unique).
Second time the SAME pattern appears in a different module → STOP, extract to `patterns/`, refactor both call sites.

### 6.3 Status badges always go through `<StatusBadge>`
New status types? Add to the type map inside `StatusBadge.tsx`. Never create a new local `*StatusBadge` component.

### 6.4 Row dropdowns always go through `<RowActions>`
New menu items? Pass via the `items` array. Never create a new local `*RowActions` component.

### 6.5 Modals always go through `<Modal>` shell
Use `<Modal>` / `<Modal.Header>` / `<Modal.Body>` / `<Modal.Footer>` for any new modal. Use `<ConfirmModal>` for any new confirmation flow.

### 6.6 Color tokens, not hex codes
When adding new components, use Tailwind semantic tokens from [tailwind.config.ts](tailwind.config.ts) — NOT inline hex codes like `#658774`. Hex codes in `[bg-#...]` syntax are technical debt; the centralized components should set the example by avoiding them.

### 6.7 New components include TypeScript-strict APIs
Use union types for status values, never `string`. Use discriminated unions for prop variants. Wrong usage must fail at compile time.

---

## 7. Estimated total effort + cost-benefit

> Updated after second-pass audit. Phase 4 expanded ~2× (modals jumped from 15 → 106 instances), and two new phases (6 and 7) were added to cover detail-page shells, tabs, charts, calendar utils, multi-select pills, and rating/attendance badges.

| Phase | Scope | Human dev estimate | Claude estimate |
|---|---|---|---|
| **Phase 1** | Mechanical (TH/TD, FilterPill, EmptyState, SortableHeader local) | ~2.5 hours | ~30–45 min |
| **Phase 2** | StatusBadge (36 files) | ~1.5–2 hours | ~45–60 min |
| **Phase 3** | RowActions (27 files) | ~2.5 hours | ~60–75 min |
| **Phase 4** | **Modal shells + ConfirmModal + KpiModal (106 instances)** | **~5–6 hours** ⬆ | **~2–2.5 hours** |
| **Phase 5** | Form atoms + Pagination + Toolbar + Avatars + BulkActionBar (40+ files) | ~4–5 hours | ~90–120 min |
| **Phase 6** | DetailPageShell + Tabs (32 files) — NEW | ~3 hours | ~75–90 min |
| **Phase 7** | Charts + Calendar utils + Multi-select + Rating/AttendanceBar + Dividers + NotificationRow (50+ files) — NEW | ~3 hours | ~60–90 min |
| **Total** | **7 phases** | **~22–25 hours human** | **~8–10 hours Claude** |

**Duplicate implementations deleted:**

| Source | Count |
|---|---|
| First-pass patterns (TH/TD, StatusBadge, RowActions, FilterPill, etc.) | ~200 |
| Second-pass patterns (Modals, DetailPageShell, Tabs, Charts, etc.) | ~180 |
| **Total** | **~380 duplicates deleted** |

**Outcome estimate after full plan execution:**
- ~7,500–10,000 lines of boilerplate deleted
- Centralization: ~75% → ~95–97%
- Bundle size impact: noticeable (~15–25 KB savings — modal consolidation alone is significant)
- Maintainability: dramatically improved — a designer-driven rebrand or new theme becomes a 1-file change instead of 100+
- Future page creation: ~50% fewer component definitions needed per new page (was estimated ~40% before second-pass)
- Supabase migration risk: reduced (fewer surface areas to touch)
- Dev team onboarding: significantly easier (one canonical pattern per concern)
- Customer-side build: massively de-risked (all the chrome a customer-side page needs already exists in shared components)

---

## 8. What this plan deliberately does NOT change

To keep scope tight and protect the live demo, these things are explicitly out of scope:

- **Routing structure** — `/admin/*`, `/instructor/*`, all takeover routes stay exactly as they are
- **Store shape** — Zustand store interface unchanged
- **Mock data schema** — `src/data/mock/` files untouched (already migration-ready)
- **Feature flags** — disabled routes stay disabled
- **Persist version** — stays at `2`, persisted state survives
- **Business logic** — all permission checks, archive/delete rules, returnTo logic preserved verbatim
- **Color palette** — hex codes already in use stay as-is; only NEW components use semantic tokens (color audit is a separate followup, not this plan's scope)
- **Module-specific components** — `CustomerDetailPage`, `ServiceDetailPage`, etc. stay where they are. Only the patterns they DEDUPLICATE move.

---

## 9. How to use this plan

When you (or another developer) is ready to start:

1. Branch from the latest main (or wherever stable lives)
2. Start with **Phase 1** — the lowest-risk wins build confidence
3. Commit module-by-module within each phase
4. Run typecheck + build + visual check after every commit
5. Push your branch to GitHub for a Vercel preview deployment — verify in browser
6. Only after each phase's verification gate passes, merge to main
7. Update this document with "✅ Phase X complete on YYYY-MM-DD" markers as you go

---

## 10. Future audit cadence

After every 5–10 new pages or modules added to the app, run a fresh component duplication audit (use the same agent prompt this plan was generated from). Catch new duplicates early — don't let the codebase drift back to inline-per-page over time.

---

**End of plan.** All work documented. Implementation begins when a developer (you or your team) is ready.
