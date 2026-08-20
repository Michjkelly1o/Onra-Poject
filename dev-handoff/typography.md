# Typography — the two-font system (dev handoff)

> How the app's fonts actually work today, and how to maintain/extend them.
> The original build plan (with the phased rollout + locked decisions) is at
> [`../new-prd/typography-urbanist-implementation-plan.md`](../new-prd/typography-urbanist-implementation-plan.md).
> **Shipped 2026-08-20.**

## The system in one line

**Urbanist for headlines & subheadlines. DM Sans for everything else — body,
captions, and all data/numbers.** Applies to **admin / attendee / instructor**.
The **customer (member) app stays 100% DM Sans**.

This is the app's *own* typography — it has **nothing to do** with the branding
module's live font picker ([`src/app/branding-fonts.ts`](../src/app/branding-fonts.ts)),
which loads 6 fonts only for the branding "Customize" *preview* and must not be
touched for typography work.

## How the fonts are loaded

Both fonts come from **one Google Fonts `@import`** at the top of
[`src/app/globals.css`](../src/app/globals.css):
```css
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:...&family=Urbanist:wght@400;500;600;700&display=swap');
```
- **Weights: both fonts load 400 / 500 / 600 / 700** (Regular / Medium / SemiBold
  / Bold), symmetric — so a `font-semibold` heading keeps its exact weight when it
  renders in Urbanist instead of DM Sans (no weight falls back).
- We loaded Urbanist the same `@import` way DM Sans already was, for consistency.
  (`next/font` self-hosting is the production-nice alternative — see below.)

## How it's applied

Two mechanisms, both in globals.css / Tailwind:

1. **Semantic headings** — a global rule makes every real heading tag Urbanist:
   ```css
   h1, h2, h3 { font-family: 'Urbanist', 'DM Sans', system-ui, sans-serif; }
   ```
   This covers the ~213 `<h1>/<h2>/<h3>` across admin/attendee/instructor with zero
   per-file work.

2. **`font-heading` utility** — a Tailwind family in
   [`tailwind.config.ts`](../tailwind.config.ts):
   ```
   heading: ['"Urbanist"', '"DM Sans"', 'system-ui', 'sans-serif']
   ```
   Applied as `font-heading` to the heading-styled `<p>` elements that aren't
   heading tags (page-header titles are `<h1>`, but many card/panel/section/modal
   titles are `<p className="font-semibold text-lg/[18px]/[20px]">`). DM Sans is the
   fallback so headings degrade gracefully if Urbanist fails to load.

`sans` (DM Sans) is unchanged and remains the body/default.

## The customer exclusion (airtight)

The customer shell root already carries **`data-brand-scope="customer"`**
([`src/app/customer/layout.tsx`](../src/app/customer/layout.tsx)). The CSS reverts
BOTH mechanisms under it, so the customer app stays entirely DM Sans even for
shared components (EmptyState, SectionHeader) that carry font-heading:
```css
[data-brand-scope="customer"] :is(h1, h2, h3),
[data-brand-scope="customer"] .font-heading {
  font-family: 'DM Sans', system-ui, sans-serif;
}
```

## The mapping — what is Urbanist vs DM Sans

**THE RULE: Urbanist = titling text only** (the words that name/introduce a page,
section, card, panel, or modal). **DM Sans = everything else.**

| Element | Font |
|---|---|
| Page/detail titles, section headers, modal titles, card/panel/filter titles, empty-state titles, names-used-as-a-title (e.g. a room or class name as the header) | **Urbanist** |
| Body/paragraphs, table cells + column headers, form labels/values/hints, buttons/tabs/menus/badges, timestamps/breadcrumbs, the tiny uppercase micro-labels ("Status", "Date range") | **DM Sans** |
| **ALL numbers & data — KPI values, currency (`AED …`), counts, %, ratings, prices, dates** | **DM Sans** |

Shared title components already apply it: `patterns/SectionHeader` (titleCls),
`ui/EmptyState` (title), and the modal titles are semantic `<h2>` via `modals/Modal`.

## ⚠️ The load-bearing rule for maintenance: **numbers are NEVER Urbanist**

The one real hazard is putting a value in a heading font. A big `font-semibold
text-[18px]` element can be *either* a title ("Plan freeze") *or* a value
("AED 4,200") — they share the styling.

- **When you add a title**, make it a semantic `<h1/h2/h3>` (auto-Urbanist) or add
  `font-heading`.
- **When you add a big value/number**, use a plain `<p>` (no font-heading, no
  h-tag) so it stays DM Sans.
- A regression that shipped and was caught in audit: the POS cart total
  (`AED {total}`) wrongly got `font-heading` from the signature-based sweep — it's
  a value, so it was reverted. **If you run any bulk styling pass, re-check that no
  currency/`.toLocaleString`/`.toFixed`/`%`/count landed in a heading or
  `font-heading`.**

Quick audit greps:
```bash
# any value wrongly in a heading font?
grep -rnE 'font-heading[^"]*"[^>]*>[^<]*(AED |\.toLocaleString|\.toFixed|%)' src
grep -rnE '<h[123][^>]*>[^<]*(AED |\.toLocaleString|\.toFixed|[0-9])' src
```

## Production note

`@import` from Google Fonts is a render-blocking external request (the app already
accepted this for DM Sans). For production, migrate both faces to **`next/font`**
(self-hosted, SSR-safe, no layout shift) — expose a `--font-heading` variable, wire
the body to the loaded DM Sans, and keep the same `h1,h2,h3` + `font-heading` +
customer-revert rules. Nothing else about the model changes.

## Rollback
Remove the `h1,h2,h3` rule + the `font-heading` usages + the `heading` Tailwind
family + `Urbanist` from the `@import`. Instant return to single-font DM Sans.
