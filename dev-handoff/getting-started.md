# Getting Started — run, navigate & reset (dev handoff)

Day-one mechanics for a new developer. For *how the app is built*, read
[`architecture-and-centralization.md`](architecture-and-centralization.md) next;
for *what must be built for production*, read [`README.md`](README.md).

---

## Run it

```bash
npm install
npm run dev          # → http://localhost:3000
```

Scripts (standard Next.js 14): `dev`, `build`, `start`, `lint`. A production build
is `npm run build` (currently **148 static/dynamic routes**) → `npm run start`.

## Environment variables

**The app runs with essentially no configuration** — the entire "database" is
mock data in `localStorage`, so there's nothing to connect to. There is exactly
**one** real env var, and it's only needed for one feature:

| Var | Needed for | Without it |
|---|---|---|
| `ANTHROPIC_API_KEY` | The AI agent (`src/app/api/ai-agent/*`, real Anthropic API) | Everything works except the AI assistant |

Put it in `.env.local` (git-ignored). **Note:** CLAUDE.md lists Supabase keys as
a *future* setup task — they are **not referenced anywhere in the running code**
yet (the prototype has no backend), so you don't need them to run the app today.

## Navigate the four personas — there is no login

Persona is chosen by the **URL** (the first path segment), not by authentication.
Just change the URL to switch "who you are":

| Persona | Entry URL | Notes |
|---|---|---|
| **Admin** (Owner) | `/admin/dashboard` | The full studio-management app (desktop-first) |
| **Instructor** | `/instructor/dashboard` | Mobile-primary — see [`instructor-and-attendee.md`](instructor-and-attendee.md) |
| **Attendee** (attendance console) | `/attendee` | Mobile check-in surface |
| **Customer** (member) | `/customer` | Mobile-only phone frame — see [`customer-app.md`](customer-app.md) |

Each layout auto-flips `currentUser` / `currentRole` from the URL. The demo users
(Alex Owen / River Teach / …) and the whole role model are in
[`roles-and-personas.md`](roles-and-personas.md).

**Deployed:** `https://onra-poject.vercel.app` (note the literal spelling —
`onra-poject`, one missing letter). Auto-deploys from `main`.

## Reset the demo state

Everything you create/edit/cancel is saved to `localStorage` under the key
**`onra-demo-state`** and survives refresh + tab close. To get back to the seeded
sample data:

- **Surgical:** DevTools → Application → Local Storage → delete the
  `onra-demo-state` key → refresh. (Rebuilds from the seed files in
  `src/data/mock/`.)
- **Full wipe:** browser settings → Clear site data.
- **Automatic:** the store has a schema `version` (currently **124**). Bump it in
  [`src/lib/store.ts`](../src/lib/store.ts) and every tester's stale state is
  discarded + re-seeded on next load. **Bump it whenever you change seed shape**,
  or testers keep old data. (See [`architecture-and-centralization.md`](architecture-and-centralization.md) §2.)

## Two-tab demo (cross-tab sync)

Open admin in one tab and instructor in another — a write in one tab propagates to
the other in the same render cycle (a `window.storage` listener re-hydrates the
store). Useful for demoing "admin assigns a class → instructor sees it live."

## First files to read

1. This doc → [`architecture-and-centralization.md`](architecture-and-centralization.md)
   (how it's wired) → [`README.md`](README.md) (the production to-do + doc index).
2. Data model: [`src/data/mock/README.md`](../src/data/mock/README.md).
3. Project conventions & module checklist: [`CLAUDE.md`](../CLAUDE.md) at repo root.
