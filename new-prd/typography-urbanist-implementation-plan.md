# Typography — Urbanist + DM Sans Implementation Plan

> **Status:** PLAN ONLY — to implement later. Nothing built yet.
> **Goal:** Give the app a fixed, two-font type system, app-wide:
> - **Urbanist** → Headline & Subheadline
> - **DM Sans** → Body & Caption
>
> This is the app's *own* typography (hardcoded), **not** the branding module's
> live font picker. Scope: **admin + attendee + instructor**. Customer (mobile)
> = open decision (see Phase 0).

---

## Why this is low-risk & safe to defer

The change is **presentational and additive**:
- Touches **only fonts** — no data, state, routes, or component logic.
- **DM Sans stays the body/default**, so body text, spacing, and layout
  structure are untouched.
- Fully **reversible** — remove the heading font family/rule and it's back to today.

**The one real caveat** is visual, not functional: Urbanist has different letter
metrics than DM Sans (x-height, width, letter-spacing), so headings will render
slightly wider/tighter and a long heading may wrap at a different point. That's
the *intended* change but needs a short tuning pass (Phase 4). It will not break
layouts — worst case a heading looks a hair off and gets a tweak.

**Cost of waiting:** the later we do it, the more headings exist to sweep. It
gets marginally *bigger*, never *harder* or *riskier*.

---

## Current state (verified)

- **One font today: DM Sans.** Tailwind `fontFamily.sans = ['"DM Sans"',
  'system-ui', 'sans-serif']`; `globals.css` body + `--brand-font` both DM Sans.
  Everything (headings + body) inherits it — there is **no heading/body split**.
- **Separate branding font system exists but is OUT OF SCOPE.**
  [`src/app/branding-fonts.ts`](../src/app/branding-fonts.ts) loads 6 Google
  fonts (DM Sans, Inter, Nunito Sans, Playfair, Cormorant, Lora) as CSS variables
  — but ONLY for the branding "Customize" **preview template**, not the app
  shell. **Do not touch it.** This plan is independent of that picker.
- **No single heading abstraction.** Headings are a mix:
  - ~213 semantic `<h1>` / `<h2>` / `<h3>` tags, AND
  - many `<p className="font-semibold text-lg/text-[20px]">`-style titles (page
    headers, card titles, section labels, modal titles) that look like headings
    but aren't heading tags.
  → There is no one switch; the semantic tags flip via one CSS rule, the
  `<p>`-style titles need a sweep.

---

## Phase 0 — Decisions (before building)

1. **Customer scope?** Client said admin/attendee/instructor. Confirm whether
   the customer (mobile) views are included or stay on DM Sans for now.
2. **Heading taxonomy — what maps to what.** Define once, apply everywhere:
   | Role | Font | Typical elements |
   |---|---|---|
   | **Headline** | Urbanist | page titles, detail-page H1, big section headings, KPI hero numbers(?), modal titles |
   | **Subheadline** | Urbanist | card/panel titles, section headers, the small uppercase "eyebrow" labels |
   | **Body** | DM Sans | paragraphs, table cells, form values, list rows |
   | **Caption** | DM Sans | field labels, helper/hint text, timestamps, badges, table column headers |
   *(The KPI numbers / metric values are a judgement call — decide if they read as
   "headline" (Urbanist) or "data" (DM Sans). Recommend DM Sans for tabular data.)*
3. **Weights needed** from Urbanist (match DM Sans usage: 400/500/600/700).

---

## Phase 1 — Load Urbanist + add the `heading` family (foundation, trivial)

1. Load Urbanist via `next/font/google` (same pattern the app already uses),
   exposing a CSS variable `--font-heading` (weights 400–700, `display: "swap"`,
   `subsets: ["latin"]`). Attach the variable to `<body>` in
   [`src/app/layout.tsx`](../src/app/layout.tsx) alongside the existing brand-font
   variables — **without** disturbing them.
2. Add a Tailwind family in [`tailwind.config.ts`](../tailwind.config.ts):
   ```
   fontFamily: {
     sans:    ['"DM Sans"', 'system-ui', 'sans-serif'],   // unchanged (body)
     heading: ['var(--font-heading)', '"DM Sans"', 'system-ui', 'sans-serif'],
   }
   ```
   → gives us a `font-heading` utility, with DM Sans as the fallback (so if
   Urbanist ever fails to load, headings degrade gracefully, not to a serif).
3. **Confirm DM Sans is actually loaded for the shell.** Today `globals.css` uses
   the literal string `'DM Sans'`, which relies on DM Sans being available as a
   loaded webfont. During Phase 1, wire the body to the loaded DM Sans (via its
   variable) so both fonts are self-hosted/SSR-safe and consistent. (Small cleanup;
   flagged so it isn't missed.)

**Deliverable:** `font-heading` exists and renders Urbanist; nothing else changes yet.

---

## Phase 2 — Apply to semantic headings (auto-coverage)

1. Global CSS rule so every semantic heading picks up Urbanist with zero
   per-file work:
   ```css
   h1, h2, h3 { font-family: var(--font-heading), 'DM Sans', system-ui, sans-serif; }
   ```
   (Scope this to the app shell; keep customer out if Phase 0 excludes it.)
2. This instantly covers the ~213 semantic `<h1>/<h2>/<h3>` across admin/
   attendee/instructor.

**Deliverable:** all real heading tags are Urbanist. The `<p>`-style titles are
still DM Sans (fixed next).

---

## Phase 3 — Sweep the `<p>`-style titles (the bulk of the work)

Apply `font-heading` to the heading-styled elements that aren't heading tags.
Known surfaces to walk (mechanical, low-risk):
- **Page headers** — [`src/components/layout/Header.tsx`](../src/components/layout/Header.tsx)
  page title, and detail-page headers (`/marketing/[id]`, `/products/classes/[id]`,
  `/customers/[id]`, staff/report detail headers, etc.).
- **Card / panel titles** — the `<p className="font-semibold text-lg/text-[20px]">`
  titles on list view-cards, side panels, detail sidebars.
- **Section headers** — [`src/components/patterns/SectionHeader.tsx`](../src/components/patterns/SectionHeader.tsx)
  and inline `SectionHeading` helpers (e.g. reports / campaign detail).
- **Modal / dialog titles** — `ConfirmModal` + form-panel titles.
- **The uppercase "eyebrow" subheadings** (SUBHEADING-style labels).

Preferred approach: where a shared component exists (Header, SectionHeader,
ConfirmModal), add `font-heading` **once** in the component → covers all uses.
For ad-hoc `<p>` titles, add `font-heading` inline (or migrate them to the shared
component during the sweep).

**Deliverable:** every headline/subheadline surface is Urbanist; body/caption
stays DM Sans.

---

## Phase 4 — Visual polish pass (tuning, not breaking)

Because Urbanist ≠ DM Sans metrically:
- Re-check heading **letter-spacing / weight** against the design (Urbanist often
  wants slightly tighter tracking at large sizes). Adjust the `display-*` /
  `text-*` heading tokens if needed.
- Scan for heading **wrap/width regressions** — long titles in fixed-width chrome
  (toolbars, cards, table headers) may wrap differently. Tune where it looks off.
- Verify weights map cleanly (DM Sans 600 → Urbanist 600 reads similarly).

---

## Phase 5 — Verify across roles + responsive

- Walk **admin / attendee / instructor** (and customer if in scope) confirming
  headings = Urbanist, body/caption = DM Sans, nothing broke.
- Responsive check at the app's breakpoints (instructor mobile 375px, attendee).
- Confirm the branding "Customize" preview is **unaffected** (still its own picker).

---

## Guardrails

- **Do NOT touch** `branding-fonts.ts` or the branding font picker — that's the
  live-preview system, separate from this.
- **DM Sans stays the body/default** — never override body to Urbanist.
- Keep DM Sans as the **fallback** in the `heading` stack (graceful degradation).
- Presentational only — no logic/data/route changes.

## Rollback
Remove the `h1,h2,h3` rule + `font-heading` usages + the family/variable. Instant
return to today's single-font state.

---

## Effort estimate
- Phase 1–2 (load + auto-cover semantic headings): ~30–60 min.
- Phase 3 (sweep `<p>` titles): the bulk — a few focused hours, scales with app size.
- Phase 4–5 (polish + verify): ~1–2 hours.
- **Risk: low** throughout (styling-only, reversible).
