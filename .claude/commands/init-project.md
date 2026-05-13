# /init-project

> **Purpose:** One-time project setup for the Onra Studio admin dashboard prototype. Run this ONCE before anything else. Sets up all dependencies, folder structure, Supabase client, base utilities, and the core auth database tables that every module depends on. Module-specific tables are created per module using `/build-module`.

---

## When to Run
- First time setting up the project on a new machine
- After cloning the repo fresh
- Never run again after initial setup — it is not idempotent for database steps

---

## Step 1 — Install Dependencies

```bash
npm install \
  @supabase/supabase-js \
  zustand \
  class-variance-authority \
  clsx \
  tailwind-merge \
  lucide-react \
  @radix-ui/react-dialog \
  @radix-ui/react-dropdown-menu \
  @radix-ui/react-select \
  @radix-ui/react-tooltip \
  @radix-ui/react-popover \
  @radix-ui/react-tabs \
  @radix-ui/react-checkbox \
  @radix-ui/react-switch \
  @radix-ui/react-avatar \
  @radix-ui/react-separator \
  @radix-ui/react-scroll-area \
  @radix-ui/react-toast \
  date-fns \
  recharts
```

Then initialize shadcn/ui:
```bash
npx shadcn@latest init
```

When prompted by shadcn:
- Style: Default
- Base color: match the Onra DS brand color (or Slate as placeholder until `/sync-tokens` runs)
- CSS variables: Yes

---

## Step 2 — Set Up Folder Structure

Create the following directories if they don't exist:

```
src/
  app/
    (auth)/               — login, password reset pages
    (dashboard)/          — all authenticated dashboard pages
  components/
    ui/                   — shadcn + custom DS components
    layout/               — sidebar, header, mobile nav
  config/                 — navigation config, constants
  store/                  — zustand stores
  lib/                    — utilities (supabase client, cn, etc.)
  types/                  — shared TypeScript types
  data/
    mock/                 — mock data files (used before Supabase is wired)
  hooks/                  — custom React hooks
```

---

## Step 3 — Create Base Utility Files

### `src/lib/utils.ts`
```ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

### `src/lib/supabase/client.ts`
```ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

### `src/lib/supabase/server.ts`
```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createServerSupabaseClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}
```

Install the SSR package if not already present:
```bash
npm install @supabase/ssr
```

---

## Step 4 — Environment Variables

Create `.env.local` at the project root (if it doesn't exist):
```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Ask the user to fill these in from their Supabase project dashboard at:
`https://supabase.com/dashboard/project/<project-id>/settings/api`

Do NOT proceed to database steps until these are filled in.

---

## Step 5 — Core Auth Database Tables

These are the ONLY tables created here. All module tables are created in `/build-module`.

Run the following SQL in the Supabase SQL editor or via migration:

```sql
-- Studios
create table if not exists studios (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id uuid,
  logo_url text,
  branding jsonb default '{}',
  created_at timestamptz default now()
);

-- Branches
create table if not exists branches (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid references studios(id) on delete cascade,
  name text not null,
  address text,
  phone text,
  status text not null default 'active' check (status in ('active','inactive','archived')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Rooms
create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references branches(id) on delete cascade,
  name text not null,
  capacity int,
  status text not null default 'active' check (status in ('active','inactive','archived')),
  created_at timestamptz default now()
);

-- Roles
create table if not exists roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (name in ('owner','branch_admin','operator','front_desk','instructor','member')),
  description text,
  permissions jsonb default '{}',
  is_custom boolean default false,
  created_at timestamptz default now()
);

-- User roles (links auth users to roles + branches)
create table if not exists user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  role_id uuid references roles(id),
  branch_id uuid references branches(id),
  created_at timestamptz default now()
);

-- Staff profiles (extends auth.users)
create table if not exists staff_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  avatar_url text,
  status text not null default 'active' check (status in ('active','inactive','archived')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### Enable Row Level Security
```sql
alter table studios enable row level security;
alter table branches enable row level security;
alter table rooms enable row level security;
alter table user_roles enable row level security;
alter table staff_profiles enable row level security;

-- Allow authenticated users to read their own role assignments
create policy "Users can read own roles" on user_roles
  for select using (user_id = auth.uid());

-- Allow authenticated users to read branches they are assigned to
create policy "Branch scoped read" on branches
  for select using (
    id in (
      select branch_id from user_roles where user_id = auth.uid()
    )
    or exists (
      select 1 from user_roles ur
      join roles r on ur.role_id = r.id
      where ur.user_id = auth.uid() and r.name = 'owner'
    )
  );
```

---

## Step 6 — Seed Demo Data

Create the 5 demo staff users in Supabase Auth, then seed supporting tables.

Run this in the Supabase SQL editor using the service role (or use Supabase dashboard to create auth users manually):

```sql
-- Insert roles
insert into roles (name, description) values
  ('owner',        'Full access to all branches and settings'),
  ('branch_admin', 'Full access within assigned branch(es)'),
  ('operator',     'Daily operations within single branch'),
  ('front_desk',   'Check-in, POS, and customer lookups'),
  ('instructor',   'Own classes and earnings only'),
  ('member',       'Customer-facing access')
on conflict (name) do nothing;

-- Insert studio
insert into studios (id, name) values
  ('00000000-0000-0000-0000-000000000001', 'FitLab Studio')
on conflict do nothing;

-- Insert branches
insert into branches (id, studio_id, name, status) values
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'FitLab South', 'active'),
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'FitLab North', 'active'),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', 'FitLab East',  'inactive')
on conflict do nothing;

-- Insert rooms
insert into rooms (branch_id, name, capacity, status) values
  ('00000000-0000-0000-0000-000000000010', 'Room 1', 20, 'active'),
  ('00000000-0000-0000-0000-000000000010', 'Room 2', 15, 'inactive'),
  ('00000000-0000-0000-0000-000000000011', 'Room 1', 25, 'active')
on conflict do nothing;
```

After creating auth users (via Supabase Auth dashboard or API), link them:
```sql
-- After creating auth users, link them to roles
-- Replace the UUIDs with the actual auth.users IDs from your Supabase project

-- Alex Owen = Owner (all branches, null branch_id)
insert into user_roles (user_id, role_id, branch_id) values
  ('<alex-user-id>', (select id from roles where name='owner'), null);

-- Sam Admin = Branch Admin (FitLab South only)
insert into user_roles (user_id, role_id, branch_id) values
  ('<sam-user-id>', (select id from roles where name='branch_admin'), '00000000-0000-0000-0000-000000000010');

-- Jordan Ops = Operator (FitLab South)
insert into user_roles (user_id, role_id, branch_id) values
  ('<jordan-user-id>', (select id from roles where name='operator'), '00000000-0000-0000-0000-000000000010');

-- Casey Desk = Front Desk (FitLab South)
insert into user_roles (user_id, role_id, branch_id) values
  ('<casey-user-id>', (select id from roles where name='front_desk'), '00000000-0000-0000-0000-000000000010');

-- River Teach = Instructor (FitLab South)
insert into user_roles (user_id, role_id, branch_id) values
  ('<river-user-id>', (select id from roles where name='instructor'), '00000000-0000-0000-0000-000000000010');
```

All demo users have password: `Demo1234!`

---

## Step 7 — Verify Setup

Run the dev server and confirm:
```bash
npm run dev
```

Check:
- [ ] No TypeScript errors on startup
- [ ] `src/lib/utils.ts` exports `cn()` correctly
- [ ] Supabase client connects (no env var errors in console)
- [ ] Folder structure matches Step 2
- [ ] shadcn components available in `src/components/ui/`

---

## What Comes Next

After `/init-project` completes, follow this order:
1. `/sync-tokens` — map Figma DS tokens to Tailwind (when DS is ready)
2. `/build-layout` — build the app shell (sidebar, header, nav)
3. `/build-component` — build DS components from Figma
4. `/build-module [name]` — build each feature module (creates its own DB tables)

## Usage
```
/init-project
```
No arguments needed. The skill walks through each step and confirms before writing files or running commands.
