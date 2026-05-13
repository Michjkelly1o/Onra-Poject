# /build-module

> **Purpose:** Build a complete feature module (full page or major section) for the Onra Studio admin dashboard prototype. This skill combines PRD business logic + Figma visual design + existing components to produce a fully functional, role-aware, responsive module.

---

## Prerequisites

Before running this skill, confirm:
- [ ] `/sync-tokens` has been run (or tokens are partially in place)
- [ ] Core UI components needed for this module exist in `src/components/ui/`
- [ ] The relevant PRD file exists in `new-prd/`
- [ ] The user has the Figma screen for this module open (or provides a URL)

If prerequisites are missing, proceed anyway with what's available — use placeholder styles where tokens are missing and note any components that need to be built first.

---

## Step 1 — Read the PRD

Read the relevant PRD file from `new-prd/`. Extract:

### Business Logic
- What data is displayed and how it's structured
- What actions users can take (create, edit, delete, archive, etc.)
- Any filtering, sorting, or search behavior
- Empty state behavior
- Loading state behavior

### Role-Based Access Control (RBAC)
The platform has 5 staff roles. For each role, identify what this module shows/hides:

| Role | Scope | Typical Access Level |
|------|-------|----------------------|
| Owner | All branches | Full access to everything |
| Branch Admin | Assigned branches | Full access within branch |
| Operator | Assigned branches | Can manage but limited settings |
| Front Desk | Assigned branch | Day-to-day operations only |
| Instructor | Own data only | Very limited, mostly read-only |

For each interactive element (button, action, field, section), check the PRD for which roles can see or use it. Implement using conditional rendering:
```tsx
{hasRole(['owner', 'branch_admin']) && <DeleteButton />}
```

### Module States
Every module must handle:
- **Loading** — skeleton loaders matching the layout shape
- **Empty** — illustration + message + primary CTA (e.g. "Add your first class")
- **Error** — error message + retry button
- **Populated** — the main content view

---

## Step 2 — Read the Figma Screen

If a Figma URL is provided, call `mcp__plugin_figma_figma__get_design_context` with the screen node.

If the user selects the frame in the Figma desktop app, call `get_design_context` without a nodeId.

From the Figma output, extract:
- **Overall layout** — sidebar position, header, content area, any panels/drawers
- **Grid and spacing** — column layout, gaps, padding
- **Component instances used** — identify which components from the DS appear in this screen
- **Typography hierarchy** — page title, section headers, body text, labels, captions
- **Color usage** — background, surface cards, dividers
- **Empty/loading states** if shown

If no Figma screen is available, derive the layout from the PRD description and follow the existing dashboard layout patterns already in the codebase.

---

## Step 3 — Plan the Module Structure

Before writing code, outline the file structure:

```
src/app/(dashboard)/[module-route]/
  page.tsx                    — route entry point (Server Component if using SSR, Client if using mock data)
  
src/components/[module-name]/
  [ModuleName]Page.tsx        — main page component
  [ModuleName]Header.tsx      — page header with title, filters, primary action button
  [ModuleName]Table.tsx       — data table (if list view)
  [ModuleName]Card.tsx        — card/grid item (if grid view)
  [ModuleName]Form.tsx        — create/edit form (modal or drawer)
  [ModuleName]Detail.tsx      — detail view (if applicable)
  [ModuleName]Empty.tsx       — empty state
  [ModuleName]Skeleton.tsx    — loading skeleton
  
src/store/[module-name].store.ts    — Zustand store for this module
src/types/[module-name].types.ts    — TypeScript types
src/data/mock/[module-name].mock.ts — mock data
```

Only create files that are actually needed for the module. Don't create empty placeholder files.

---

## Step 4 — Set Up Mock Data

Since this is a prototype, all data comes from mock files. Structure mock data to:
- Reflect realistic content (real class names, real-looking member names, realistic numbers)
- Cover multiple scenarios (a few records, edge cases like long names, multiple statuses)
- Include all required fields from the PRD data model

```ts
// src/data/mock/classes.mock.ts
export const mockClasses: Class[] = [
  {
    id: 'cls_001',
    name: 'Morning Yoga Flow',
    instructorId: 'staff_003',
    branchId: 'branch_001',
    status: 'active',
    // ...
  },
  // Add 8-12 records minimum for realistic table/list display
]
```

---

## Step 5 — Set Up Zustand Store

Each module gets its own Zustand store slice:

```ts
// src/store/classes.store.ts
import { create } from 'zustand'
import { mockClasses } from '@/data/mock/classes.mock'

interface ClassesState {
  classes: Class[]
  selectedClass: Class | null
  isLoading: boolean
  filters: ClassFilters
  
  // Actions
  setSelectedClass: (cls: Class | null) => void
  setFilters: (filters: Partial<ClassFilters>) => void
  createClass: (data: CreateClassInput) => void
  updateClass: (id: string, data: Partial<Class>) => void
  deleteClass: (id: string) => void
  archiveClass: (id: string) => void
}

export const useClassesStore = create<ClassesState>((set) => ({
  classes: mockClasses,
  selectedClass: null,
  isLoading: false,
  filters: { status: 'all', branch: 'all' },
  
  setSelectedClass: (cls) => set({ selectedClass: cls }),
  setFilters: (filters) => set((state) => ({ filters: { ...state.filters, ...filters } })),
  createClass: (data) => set((state) => ({
    classes: [...state.classes, { id: `cls_${Date.now()}`, ...data }]
  })),
  // etc.
}))
```

---

## Step 6 — Build the Module

### Layout Rules
- Desktop (1280px+): Full sidebar + content area with max-width container
- Tablet (768px–1279px): Collapsible sidebar, content area adjusts
- Mobile (375px–767px): Bottom nav replaces sidebar, stacked layout
- Always use responsive Tailwind classes: `flex-col md:flex-row`, `hidden md:block`, etc.

### Page Header Pattern
Every module page follows this header structure:
```tsx
<div className="flex items-center justify-between mb-6">
  <div>
    <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
    <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
  </div>
  <div className="flex items-center gap-3">
    {/* Filter/search controls */}
    {/* Primary action button — role-gated */}
  </div>
</div>
```

### Data Table Pattern
For list views with tabular data:
- Use a custom Table component built from the DS
- Include: column headers (with sort indicators if sortable), row hover, row selection if needed
- Always include: pagination or infinite scroll, row count indicator, bulk action bar when rows selected
- Sticky header for long lists

### Filter/Search Pattern
- Search input on the left
- Filter dropdowns (status, branch, date range) to the right of search
- Active filter count badge on filter button
- "Clear all filters" link when filters are active

### Form / Modal Pattern
- Use `Dialog` from Radix for modals
- Two-column layout for forms with many fields on desktop, single column on mobile
- Required field indicator (`*`)
- Inline validation on blur, form-level error on submit
- Confirm dialog for destructive actions (delete, archive)

### Empty State Pattern
```tsx
<div className="flex flex-col items-center justify-center py-20 text-center">
  <Icon className="w-12 h-12 text-muted-foreground mb-4" />
  <h3 className="text-lg font-medium text-foreground mb-2">No {items} yet</h3>
  <p className="text-sm text-muted-foreground mb-6 max-w-sm">
    {contextual description from PRD}
  </p>
  {hasRole(['owner', 'branch_admin', 'operator']) && (
    <Button intent="primary">Add {item}</Button>
  )}
</div>
```

---

## Step 7 — Apply RBAC Throughout

For every interactive element in the module, apply the role rules from the PRD:

```tsx
const { role } = useAuthStore()
const canCreate = ['owner', 'branch_admin', 'operator'].includes(role)
const canDelete = ['owner', 'branch_admin'].includes(role)
const canEdit = ['owner', 'branch_admin', 'operator'].includes(role)
```

Use these flags to:
- Hide/show action buttons
- Disable form fields
- Hide entire sections
- Show read-only vs editable views

---

## Step 8 — Archive / Delete Rules

Follow the global rules from PRD 00:

| Action | When to use |
|--------|-------------|
| **Archive** | Items with historical records (classes, members, products) — keeps data, removes from active lists |
| **Deactivate** | Staff, memberships — temporarily inactive |
| **Delete** | Pure config with no history (booking rules, promo codes with 0 uses) |

Never add a delete option where archive is specified in the PRD. Never add archive where delete is specified.

---

## Step 9 — Responsive QA Checklist

Before marking the module complete, verify:
- [ ] Desktop (1280px): Layout matches Figma exactly
- [ ] Tablet (768px): Sidebar collapses, content reflows correctly
- [ ] Mobile (375px): All content accessible, no horizontal scroll, touch targets ≥44px
- [ ] Empty state displays correctly at all breakpoints
- [ ] Loading skeleton matches content layout shape
- [ ] All role-gated elements tested (simulate different roles via Zustand)

---

## Usage
```
/build-module [module-name]
```

Examples:
```
/build-module dashboard
/build-module class-management
/build-module point-of-sale
/build-module customer-management
```

Provide the Figma screen URL or select the screen in Figma before running for best results. The skill reads the corresponding PRD automatically based on the module name.

---

## Module to PRD Mapping

| Module Name | PRD File |
|-------------|----------|
| `dashboard` | `new-prd/02-dashboard.md` |
| `class-management` | `new-prd/03-class-management.md` |
| `booking-system` | `new-prd/04-booking-system.md` |
| `point-of-sale` | `new-prd/05-point-of-sale.md` |
| `products-services` | `new-prd/06-products-services.md` |
| `customer-management` | `new-prd/07-customer-management.md` |
| `marketing` | `new-prd/08-marketing.md` |
| `analytics-reports` | `new-prd/09-analytics-reports.md` |
| `staff-management` | `new-prd/10-staff-management.md` |
| `settings` | `new-prd/11-settings.md` |
| `notifications` | `new-prd/12-notifications.md` |
| `authentication` | `new-prd/01-authentication-login.md` |
