# URL Consistency Refactor — Plan (Phase 0 audit)

**Goal:** make every route's URL match its sidebar group/label, on admin **and**
instructor, **phase by phase**, updating **every** reference so there are **no
dead links and nothing breaks**.

**Status:** PHASE 0 — audit + plan only. No routes moved yet.

---

## The mismatches

### Admin
| Nav → item | Current URL(s) | Target URL(s) |
|---|---|---|
| Marketing → Promotions | `/admin/products/promo-codes` + `/products/promo-codes/*` (new·[id]·edit) | `/admin/marketing/promotions` + `/marketing/promotions/*` |
| Marketing → Referrals | `/admin/settings/referral` + `/settings/referral/edit-information` | `/admin/marketing/referrals` + `/marketing/referrals/edit-information` |
| Products → Classes | `/admin/class-types` + `/class-types/*` (new·[id]·edit) | `/admin/products/classes` + `/products/classes/*` |
| Staff → Payroll | `/admin/compensation` + `/compensation/*` (run·[instructorId]) | `/admin/staff/payroll` + `/staff/payroll/*` |
| Products → Private sessions | `/admin/services?type=private` (query-param view) | `/admin/products/private` |
| Products → Recovery | `/admin/services?type=recovery` (query-param view) | `/admin/products/recovery` |

### Instructor
| Nav / flow → page | Current URL | Target URL |
|---|---|---|
| Schedule → class detail (full-screen takeover) | `/class/[classId]` | `/instructor/class/[classId]` |
| Earnings → class detail (full-screen takeover) | `/earnings/[classId]` | `/instructor/earnings/[classId]` |

(Main instructor nav — Dashboard/Schedule/Earnings/Time off — already matches.)

---

## Reference blast-radius per route (must ALL be updated)

Every route move touches these categories. Verified via full-repo grep:

- **App folders** — the actual route directories (list under `/admin/*` AND the
  create/detail/edit tree at top-level `/*`).
- **Sidebar** — `src/components/layout/Sidebar.tsx`
- **Header page titles** — `src/components/layout/Header.tsx` (`PAGE_TITLES`, prefix-matched)
- **Breadcrumbs** — `src/config/breadcrumbs.ts`
- **Feature flags** — `src/config/feature-flags.ts` (prefix-matched; some routes listed)
- **Settings groups / nav config** — `src/config/settings-groups.ts` (referral/services)
- **Global search** — `src/lib/global-search.ts`
- **Form-panel hosts / helpers** — `marketing-form-panel.ts`, `referral-helpers.ts`
- **Store** — `src/lib/store.ts` (nav/route logic for referral + compensation)
- **Seed data** — `branches.ts`, `payroll_entries.ts`, `appointments.ts`,
  `referral_settings.ts` reference route strings
- **AI-agent route catalog** — `src/ai-agent/data/known-routes.ts`,
  `src/ai-agent/studio-setup/setup-catalog.ts`, `src/ai-agent/agent/tools.ts`,
  `src/ai-agent/migration/entities/index.ts`
- **Every internal link** — `router.push(...)`, `<Link href>`, `returnTo=` params
  inside page/detail components (PromoFormPage, ProductFormPage, ServiceFormPage,
  ServiceDetailPage, PayrollRunPage, StaffDetailPage, EditReferralInformationPage, …)

Per-route file counts (approx): Promotions 12 · Referrals 16 · Classes 23 ·
Payroll 15 · Services 23.

---

## No-dead-link strategy

For each moved route, add a **redirect from the OLD URL → new URL** in
`next.config` `redirects()` (or an equivalent redirect page), so any bookmark,
deep link, `returnTo`, or externally-shared old URL still resolves. Redirects are
kept until we're confident nothing references the old path.

---

## Phase order (safest first; one route per phase)

Each phase = move folders → update ALL references above → add old→new redirect →
`tsc` clean + `next build` all pages + click-path spot-check → local commit.

1. **Phase 1 — Payroll** (`/admin/compensation` → `/admin/staff/payroll`). Self-contained module; no query-params; good first proof of the process.
2. **Phase 2 — Referrals** (`/admin/settings/referral` → `/admin/marketing/referrals`). Moves it out of Settings into Marketing where the nav shows it.
3. **Phase 3 — Promotions** (`/admin/products/promo-codes` → `/admin/marketing/promotions`).
4. **Phase 4 — Classes** (`/admin/class-types` → `/admin/products/classes`).
5. **Phase 5 — Instructor takeovers** (`/class/[id]` → `/instructor/class/[id]`, `/earnings/[id]` → `/instructor/earnings/[id]`). Full-screen pages currently OUTSIDE the layout on purpose — verify they still render edge-to-edge after the move.
6. **Phase 6 — Private / Recovery** (query-param → path). Hardest: the `services`
   module renders via `?type=`; giving it real `/admin/products/private` +
   `/admin/products/recovery` paths needs the module to read the type from the
   path. Done last, on its own, carefully.

---

## Guardrails (every phase)

- Grep the OLD path string across the WHOLE repo after editing → must return
  only the redirect entry (no stray references left).
- Update the AI-agent route catalog + seeds in the SAME phase as the move.
- Keep the old→new redirect so no link 404s.
- `tsc` clean + `next build` all static pages before committing.
- One route per commit, local only (no push unless asked).
