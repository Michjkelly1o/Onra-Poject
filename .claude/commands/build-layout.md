# /build-layout

> **Purpose:** Build the app shell for the Onra Studio admin dashboard — sidebar navigation, top header bar, branch switcher, demo role switcher, and the root layout wrapper that all modules live inside. Built once, used by every module. Designed to be fully config-driven so navigation changes per role (adding/removing/reordering menu items) require only a single config file update — no layout component changes.

---

## Core Design Principle: Config-Driven Navigation

The sidebar and mobile nav are purely driven by a navigation config array. Adding a new module to any role's menu = add one object to the array. Removing = delete or comment it out. Reordering = move the object. The layout component never needs to change.

This means:
- When a new module is built later (e.g. a new Promotions module for Front Desk), just add it to the config
- When a role's access changes (e.g. Front Desk gets access to Reports), update the `roles` array in that nav item
- No sidebar/layout rebuild needed — the change is instant

---

## What This Skill Builds

```
src/
  app/
    (dashboard)/
      layout.tsx              — root layout wrapper (sidebar + header + page slot)

  components/
    layout/
      Sidebar.tsx             — left navigation sidebar
      SidebarNavItem.tsx      — individual nav item with icon + label + active state
      Header.tsx              — top bar (branch switcher, notifications, user menu)
      BranchSwitcher.tsx      — dropdown to switch branch context (Owner / multi-branch BA only)
      NotificationBell.tsx    — bell icon with unread count badge
      UserMenu.tsx            — avatar dropdown (profile, settings, sign out)
      DemoRoleSwitcher.tsx    — clearly labeled demo mode widget
      MobileNav.tsx           — hamburger + full-screen overlay nav for mobile

  config/
    navigation.ts             — THE single source of truth for all nav items and role visibility

  store/
    auth.store.ts             — current user, role, branch scope
    layout.store.ts           — sidebar collapsed state, mobile nav open state
```

---

## Step 1 — Read Figma Layout (if available)

If the user provides a Figma URL for the sidebar or app shell frame, call `mcp__plugin_figma_figma__get_design_context` to extract:
- Sidebar width (collapsed and expanded)
- Nav item height, padding, icon size
- Active state styling (background color, left border accent, icon + text color)
- Header height and contents
- Logo/brand area at the top of sidebar
- Bottom section of sidebar (user avatar area, settings shortcut)
- Collapse/expand transition style

If no Figma URL is provided, follow the default spec in this skill.

---

## Step 2 — Navigation Config File

This is the only file that ever needs to change when navigation changes.

```ts
// src/config/navigation.ts
import {
  BarChart01, Calendar, CalendarCheck01, Users01, BookOpen01,
  ShoppingCart01, UserSquare, BarLineChart, CurrencyDollar, Settings01,
  UserCircle, type UntitledIconComponent
} from '@untitledui/icons'

export type Role = 'owner' | 'branch_admin' | 'operator' | 'front_desk' | 'instructor'

export type NavItem = {
  label: string           // display label
  href: string            // route path
  icon: UntitledIconComponent  // @untitledui/icons component
  roles: Role[]           // which roles can see this item
  badge?: 'notifications' // reserved for special badge rendering
  section?: string        // optional group header (e.g. 'Operations', 'Admin')
}

export const NAV_ITEMS: NavItem[] = [
  // --- Items visible to management roles ---
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: BarChart01,
    roles: ['owner', 'branch_admin'],
  },
  {
    label: 'Schedule',
    href: '/schedule',
    icon: Calendar,
    roles: ['owner', 'branch_admin', 'operator', 'front_desk'],
  },
  {
    label: 'Customers',
    href: '/customers',
    icon: Users01,
    roles: ['owner', 'branch_admin', 'operator', 'front_desk'],
  },
  {
    label: 'Bookings',
    href: '/bookings',
    icon: BookOpen01,
    roles: ['operator'],
  },
  {
    label: 'POS',
    href: '/pos',
    icon: ShoppingCart01,
    roles: ['owner', 'branch_admin', 'operator', 'front_desk'],
  },
  {
    label: 'Staff',
    href: '/staff',
    icon: UserSquare,
    roles: ['owner', 'branch_admin'],
  },
  {
    label: 'Reports',
    href: '/reports',
    icon: BarLineChart,
    roles: ['owner', 'branch_admin', 'operator'],
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: Settings01,
    roles: ['owner', 'branch_admin'],
  },

  // --- Items visible to Front Desk ---
  {
    label: 'Today',
    href: '/today',
    icon: CalendarCheck01,
    roles: ['front_desk'],
  },

  // --- Items visible to Instructor ---
  {
    label: 'Dashboard',
    href: '/instructor-dashboard',
    icon: BarChart01,
    roles: ['instructor'],
  },
  {
    label: 'My Schedule',
    href: '/my-schedule',
    icon: Calendar,
    roles: ['instructor'],
  },
  {
    label: 'My Earnings',
    href: '/my-earnings',
    icon: CurrencyDollar,
    roles: ['instructor'],
  },
  {
    label: 'Profile',
    href: '/profile',
    icon: UserCircle,
    roles: ['instructor'],
  },
]

// Helper: filter nav items for a given role
export function getNavItemsForRole(role: Role): NavItem[] {
  return NAV_ITEMS.filter(item => item.roles.includes(role))
}

// Default landing route per role — redirect here after login or role switch
export const DEFAULT_ROUTE: Record<Role, string> = {
  owner: '/dashboard',
  branch_admin: '/dashboard',
  operator: '/schedule',
  front_desk: '/today',
  instructor: '/instructor-dashboard',
}
```

### How to Extend Later
- **New module for existing role:** Add one `NavItem` object to `NAV_ITEMS` with the correct `roles` array
- **New role:** Add the role to the `Role` type, add it to `DEFAULT_ROUTE`, and add it to the `roles` array of relevant nav items
- **Move an item:** Change its position in the array — sidebar renders in order
- **Hide an item temporarily:** Remove the role from its `roles` array, or comment it out

---

## Step 3 — Auth Store

```ts
// src/store/auth.store.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Role } from '@/config/navigation'

export interface Branch {
  id: string
  name: string
}

export interface AuthUser {
  id: string
  name: string
  email: string
  role: Role
  branchId: string | null       // null = all branches (owner)
  assignedBranches: Branch[]    // branches accessible to this user
  avatarUrl?: string
}

interface AuthState {
  user: AuthUser | null
  isLoading: boolean
  setUser: (user: AuthUser | null) => void
  hasRole: (roles: Role[]) => boolean
  canAccessBranch: (branchId: string) => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isLoading: false,
      setUser: (user) => set({ user }),
      hasRole: (roles) => {
        const user = get().user
        return user ? roles.includes(user.role) : false
      },
      canAccessBranch: (branchId) => {
        const user = get().user
        if (!user) return false
        if (user.role === 'owner') return true
        return user.assignedBranches.some(b => b.id === branchId)
      },
    }),
    { name: 'onra-auth' }
  )
)
```

---

## Step 4 — Layout Store

```ts
// src/store/layout.store.ts
import { create } from 'zustand'

interface LayoutState {
  sidebarCollapsed: boolean
  mobileNavOpen: boolean
  activeBranchId: string | null   // null = all branches (owner default)
  toggleSidebar: () => void
  setMobileNavOpen: (open: boolean) => void
  setActiveBranch: (branchId: string | null) => void
}

export const useLayoutStore = create<LayoutState>((set) => ({
  sidebarCollapsed: false,
  mobileNavOpen: false,
  activeBranchId: null,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setMobileNavOpen: (open) => set({ mobileNavOpen: open }),
  setActiveBranch: (branchId) => set({ activeBranchId: branchId }),
}))
```

---

## Step 5 — Sidebar Component

### Dimensions & Transition
- Expanded: `w-60` (240px)
- Collapsed (icon-only): `w-16` (64px)
- Transition: `transition-all duration-200 ease-in-out`

### Three Sections
1. **Top** — logo + studio name (hide name when collapsed), collapse toggle button
2. **Middle** — `getNavItemsForRole(role)` rendered as a list of `SidebarNavItem`
3. **Bottom** — user mini card with avatar + name + role label (show avatar only when collapsed)

### Nav Item Active State
```ts
const pathname = usePathname()
const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
```

Active styling (adapt to Figma if provided):
- Background: `bg-accent` or brand tinted background
- Text + icon: `text-primary` or brand color
- Optional left accent border: `border-l-2 border-primary -ml-px`

Collapsed state:
- Show icon only, hide label
- Wrap in Radix `Tooltip` showing label on hover

### Responsive Rules
- `md:flex hidden` — sidebar only visible on tablet and up
- Desktop (≥1280px): expanded by default
- Tablet (768–1279px): collapsed (icon-only) by default
- Mobile (<768px): hidden entirely — `MobileNav` takes over

---

## Step 6 — Header Component

Height: `h-16` (64px), full width of content area, sticky at top.

Contents from left to right:
1. **Hamburger button** — mobile only (`md:hidden`), opens `MobileNav`
2. **Branch Switcher** — only for `owner` and `branch_admin`
3. **Spacer** — `flex-1`
4. **Notification Bell** — all roles
5. **User Menu** — all roles (avatar + dropdown)

### Branch Switcher
```tsx
{hasRole(['owner', 'branch_admin']) && <BranchSwitcher />}
```

- Owner: shows "All Branches" + each branch. Selecting a branch sets `activeBranchId` in layout store.
- Branch Admin: shows only their `assignedBranches`. No "All Branches" option.
- All other roles: component not rendered at all.

When `activeBranchId` changes, all data-fetching hooks re-run with the new branch filter.

### Notification Bell
- Lucide `Bell` icon
- Badge: absolutely positioned red dot, `text-[10px]`, shows unread count
- Count > 99 → show "99+"
- Count = 0 → hide badge entirely (no empty dot)
- Click → open notification drawer/panel (implemented in notifications module)

### User Menu
Radix `DropdownMenu` triggered by avatar:
- Avatar: photo if available, initials fallback (`JD` from "Jordan Ops")
- Dropdown items: My Profile, Account Settings, divider, Sign Out
- Sign out: `supabase.auth.signOut()` → clear auth store → redirect to `/login`

---

## Step 7 — Demo Role Switcher

**This must look clearly different from real UI — never let it be confused with a real feature.**

Placement: bottom of sidebar, above the user card. Collapsible section.

```tsx
<div className="mx-3 mb-3 rounded-lg border border-amber-200 bg-amber-50 p-2.5">
  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-amber-600">
    Demo Mode
  </p>
  <div className="space-y-0.5">
    {DEMO_USERS.map((demo) => (
      <button
        key={demo.role}
        onClick={() => handleRoleSwitch(demo)}
        className={cn(
          'w-full rounded px-2 py-1.5 text-left text-xs transition-colors',
          currentUser?.role === demo.role
            ? 'bg-amber-200 font-semibold text-amber-900'
            : 'text-amber-800 hover:bg-amber-100'
        )}
      >
        {demo.name}
        <span className="ml-1 text-amber-500">({demo.roleLabel})</span>
      </button>
    ))}
  </div>
</div>
```

When sidebar is collapsed (icon-only), show a single amber dot indicator. Expand sidebar to use the switcher.

### Role Switch Flow
```ts
async function handleRoleSwitch(demo: DemoUser) {
  await supabase.auth.signInWithPassword({
    email: demo.email,
    password: 'Demo1234!'
  })
  // Fetch role + branch from user_roles table
  const { data } = await supabase
    .from('user_roles')
    .select('*, roles(*), branches(*)')
    .eq('user_id', session.user.id)
  
  useAuthStore.getState().setUser(mapToAuthUser(data))
  router.push(DEFAULT_ROUTE[demo.role])
}
```

### Demo Users
```ts
export const DEMO_USERS = [
  { role: 'owner',        name: 'Alex Owen',   roleLabel: 'Owner',        email: 'alex@fitlab.demo' },
  { role: 'branch_admin', name: 'Sam Admin',   roleLabel: 'Branch Admin', email: 'sam@fitlab.demo' },
  { role: 'operator',     name: 'Jordan Ops',  roleLabel: 'Operator',     email: 'jordan@fitlab.demo' },
  { role: 'front_desk',   name: 'Casey Desk',  roleLabel: 'Front Desk',   email: 'casey@fitlab.demo' },
  { role: 'instructor',   name: 'River Teach', roleLabel: 'Instructor',   email: 'river@fitlab.demo' },
]
```

---

## Step 8 — Mobile Navigation

Triggered by hamburger button in header. Full-screen overlay.

```tsx
// MobileNav.tsx
// Animated from left, covers full screen
<div className={cn(
  'fixed inset-0 z-50 md:hidden',
  mobileNavOpen ? 'pointer-events-auto' : 'pointer-events-none'
)}>
  {/* Backdrop */}
  <div
    className={cn('absolute inset-0 bg-black/50 transition-opacity', mobileNavOpen ? 'opacity-100' : 'opacity-0')}
    onClick={() => setMobileNavOpen(false)}
  />
  
  {/* Nav panel */}
  <div className={cn(
    'absolute left-0 top-0 h-full w-72 bg-background shadow-xl transition-transform duration-300',
    mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
  )}>
    {/* Same structure as Sidebar — logo, nav items, demo switcher, user card */}
  </div>
</div>
```

Close on: nav item tap, backdrop click, or swipe left (optional).

---

## Step 9 — Root Layout

```tsx
// src/app/(dashboard)/layout.tsx
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar — tablet and desktop only */}
      <Sidebar className="hidden md:flex" />

      {/* Content area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-screen-xl px-4 py-6 md:px-6">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile nav overlay */}
      <MobileNav />
    </div>
  )
}
```

---

## Step 10 — Visual QA Checklist

- [ ] Desktop (1280px): Sidebar visible, correct nav per each of the 5 roles
- [ ] Desktop collapsed: icon-only mode, tooltips on hover
- [ ] Tablet (768px): sidebar starts icon-only, tap expands as overlay
- [ ] Mobile (375px): sidebar hidden, hamburger opens full-screen nav
- [ ] Owner + Branch Admin see branch switcher, other roles do not
- [ ] Demo role switcher visible, labeled clearly, switching roles redirects correctly
- [ ] Notification bell renders with/without badge correctly
- [ ] Adding a new nav item to `navigation.ts` appears in sidebar without any other changes
- [ ] Removing a role from a nav item's `roles` array hides it correctly for that role

---

## Usage
```
/build-layout
```

Optionally provide the Figma URL for the sidebar or header frame to pixel-match the design. If no URL is provided, the skill builds to the spec above.
