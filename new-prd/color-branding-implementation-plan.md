# Color Branding Migration — Implementation Plan

**Goal:** migrate the entire app (admin / instructor / attendee / customer) from the
old sage-green + teal palette to the new brand palette in
[`new-color-brand.json`](new-color-brand.json), harmoniously and reversibly.

**Status (2026-08-06):** Phase 1, Phase A, Phase B1, Phase B2 **DONE & committed locally**.
Phase B3 and later are **pending**. Nothing pushed.

---

## 1. Hard rules (do not break)

1. **Only colors from `new-color-brand.json`.** No invented / blended hexes. If a
   scale step is needed that the JSON lacks (e.g. `-25` / `-950` endpoints), reuse the
   nearest real JSON step — never fabricate.
2. **System colors stay as-is:** error red, warning amber, success green, info blue,
   purple/indigo. These are functional signals — do not rebrand them.
3. **Text hierarchy stays as-is.** `--colors-text-primary/secondary/tertiary/quaternary/
   placeholder` keep their current cool-grey values — changing them disturbs the
   dark→grey contrast hierarchy. (Decided by client.)
4. **Cards stay pure white** (`--colors-bg-primary` `#ffffff` + literal `bg-white`).
   Warming cards to Fashion white is an *optional* later step (needs a `bg-white`→token
   codemod) — see B3.
5. **Two-tier brand:** prominent/solid = **deep teal** (Rich blue green); subtle =
   **soft mint** (Tranquil mint). Same cohesive family, keyed off light-vs-dark step.
6. **Centralize, don't scatter.** Every color flows through a semantic token in
   `globals.css`. Flipping the palette = editing ~40 token values in one file.
7. **Commit local only — never push** unless the user explicitly says "push".

---

## 2. The palette (`new-color-brand.json`) + role assignments

7 families, each 50–900:

| Family | Role | Used for |
|---|---|---|
| **Rich blue green** (`#e8edee`→`#164e52`→`#092122`) | **MAIN brand** | Primary buttons, links, focus, toggles, solid brand fills, progress bars |
| **Fashion white** (`#fefefd`→`#696661`) | **MAIN background** | (Deferred) warm white cards/app bg — option B |
| **Tranquil mint** (`#fafcfb`→`#555f5a`) | **SECONDARY** | Soft pill/badge backgrounds, soft borders (light end of secondary scale) |
| **Pastel grey** (`#fafaf9`→`#575551`) | **SECONDARY** | Warm borders, warm surfaces |
| **Pampas** (`#fefefd`→`#666564`) | **SECONDARY** | Warm page bg + subtle surface tints |
| **Traditional mint** (`#f8faf7`→`#4e574a`) | **ACCENT** | Small highlights / badges only — never big surfaces |
| **Honeysuckle** (`#fdfef2`→`#616835`) | **ACCENT** | Fresh highlight accent (net-new slot) — use sparingly |

---

## 3. Token architecture (the flip points — all in `src/app/globals.css :root`)

Because these live in `:root`, they apply on **all four sides**. Only the 4
`--brand-*` values are additionally runtime-overridden on the **customer** side by
`src/components/customer/shell/BrandTokens.tsx` (from the `brandingSettings` seed).

| Token group | Meaning | Palette |
|---|---|---|
| `--rbg-50..900` | Rich blue green scale (primary button) | Rich blue green (JSON exact) |
| `--colors-brand-*` | interactive: links, focus, teal accents | Rich blue green |
| `--colors-secondary-*` | brand fills + soft pills/badges (composed ramp) | Tranquil mint (light 25–300) → Rich blue green (dark 500–950) |
| `--colors-tertiary-*` | olive-grey info surfaces (info banner `#f1f2ed`) | **UNCHANGED so far** — B3 candidate |
| `--colors-bg-*` | surfaces | Pampas / Pastel grey (bg-primary `#ffffff` kept) |
| `--colors-border-*` | borders | Pastel grey |
| `--colors-text-*` | text hierarchy | **UNCHANGED (kept, per rule 3)** |
| `--colors-success/warning/error-*` | status | **UNCHANGED (system)** |
| `--brand-primary/tertiary/text/background` | admin-editable + customer runtime brand | primary `#164e52`, tertiary `#d5e7df`, text/bg unchanged |

Customer seed: [`src/data/mock/branding_settings.ts`](src/data/mock/branding_settings.ts)
`primaryColor #164E52`, `tertiaryColor #DCEBE4` (no store version bump — a bump would
wipe demo data; returning testers must reset branding / clear localStorage to see the
customer-side `--brand-*` change).

---

## 4. Phases

### ✅ Phase 1 — Primary button (commit `71f8ee1a`)
Added `--rbg-*` (Rich blue green) tokens; primary Button variant → `--rbg-500` bg +
white text, hover/active `--rbg-600/700`, light inset border ring.

### ✅ Phase A — Centralization (commits `56ec62d3`, `5c050136`, `15649cfb`, `1c154154`)
Routed **~9,450 hardcoded Tailwind-arbitrary hex → the existing `--colors-*` semantic
tokens** (visual no-op — each token still held its original value). Context-aware codemod
by Tailwind prefix (`text-`/`border-`/`bg-`). Slices: `components/ui` → `components/*` →
`app/admin` → rest of `src`.
- **Codemod:** persisted at the session scratchpad as `centralize-colors.mjs`. Re-create
  from the pattern below if needed. **Quoted-inline hex (`'#hex'`/`"#hex"`) is
  deliberately NOT converted** — those become SVG presentation attributes (Recharts
  `fill`/`stroke`) where `var()` does not resolve and would break chart colors.

### ✅ Phase B1 — Brand flip (commit `9e11269f`)
- `--colors-brand-*` → Rich blue green (deep teal).
- `--colors-secondary-*` → composed ramp: **Tranquil mint** (light: soft pills/badges/
  borders) → **Rich blue green** (dark: solid brand fills/text/toggles). `secondary-600`
  = `#164e52` matches the primary buttons.
- `--brand-primary #164e52`, `--brand-tertiary #d5e7df`; `branding_settings` seed to match.
- **Progress bars (14, all sides):** repointed to `secondary-400` = `#457175` (rich blue
  green-400) — a soft medium teal on light tracks. Category-colored data-viz bars and
  solid-brand elements (toggles/dots/step-circles) left as-is.

### ✅ Phase B2 — Warm neutrals (commit `a50ec819`)
Surfaces + borders → warm JSON families; **text + white cards untouched**:
- borders → Pastel grey (`primary #d9d5ce`, `secondary #e9e7e3`, `tertiary #f0efec`)
- surfaces → Pampas (`bg-secondary #fbfbfa`, `bg-tertiary #f6f6f4`), Pastel grey
  (`bg-quaternary #e9e7e3`); body bg `#fbfbfa`; `utility-gray-50/200` to match
- avatar neutral bg → `#dfdbd6`

Effect is intentionally subtle (warm borders + faint cream page behind crisp white cards).

### ✅ Phase B3 — Leftover hex sweep, charts, badges (DONE 2026-08-10, committed locally)
Flipped every remaining hardcoded OLD-brand sage/mint hex → the new Rich blue
green / Tranquil mint families (JSON exact), in 5 reviewable cluster commits
(`c6df2afb` AI Agent · `f48e7816` admin/instructor/customer brand-green ·
`c3036813` dark-sage `#3b5446`→`#10373a` · `c70f8ce3` Recharts · `a8b829a0`
final accents + warm-grey helper text). Mapping used: `#658774`→`#164e52`,
`#7ba08c`/`#79ab8a`/`#4f6e5d`/`#5b8270`→`#457175`/`#164e52`, `#aad4bd`→`#94aeaf`,
`#c4edd6`/`#dcefe4`/`#e9fff3`→`#dcebe4`/`#eff6f3`, `#3b5446`/`#4c6a5a`/`#3f5b4c`→
`#10373a`, chart `#92baa4`→`#90a099`, helper `#6e776f`→`#667085`. **Kept:** system
success/warning/error greens (`#067647`/`#17b26a`/`#47b881`…), the `#a9c3b4`
success border, and the distinct categorical chart series (cyan `#92d1de`, mauve
`#b892ba`, amber `#f7b955`). `git grep` confirms **zero old sage/teal brand hex
left in `src`** (the only two `#658774` matches are truthful history comments).
Category palette: Pilates rebranded to teal; Barre (blue) + Yoga (amber) kept
distinct. Embed wrapped in `<BrandTokens>` so it follows the live brand too.

**Still open (optional polish, not blocking):**

### ⬜ Phase B3-extra — Accents, info-surface, QA (OPTIONAL / PENDING)
1. **Badge decisions.** Decide per badge type which become **brand teal** (e.g. Active /
   Completed brand-styled badges) vs stay **system** (true success green / warning /
   error). Currently brand-colored badges follow the secondary ramp; system badges use
   `--colors-success/warning/error-*` (kept).
2. **Charts (by hand).** Recharts fills/strokes use quoted hex (not tokenized). Update
   deliberately — some series may adopt new brand colors; keep multi-series charts
   visually distinct. Files: `DashboardWidgetCard.tsx`, `staff/InstructorCharts.tsx`.
   Watch the ranked bar-charts (mauve `#b892ba`, amber `#f7b955`) — categorical, keep
   distinct unless told otherwise.
3. **Accents.** Introduce **Traditional mint** / **Honeysuckle** on chosen small
   elements only (highlight chips, "new" markers, a KPI accent). Never big surfaces.
4. **Info-surface scale** (`--colors-tertiary-*`, olive grey) — decide whether to warm
   toward Pampas / Tranquil mint or leave as the info-banner neutral.
5. **Leftover non-tokenized hex:** a few dark greys (`#18212f`, `#0c111d`, `#182230`)
   and all quoted-inline / SVG-attribute hex were not centralized in Phase A — sweep as
   needed.
6. **Contrast QA** across all four sides at their breakpoints.

### ⬜ Phase B4 (OPTIONAL) — Warm cards
Warm `--colors-bg-primary` → Fashion white `#fefefd` **and** codemod literal `bg-white`
→ the token so white cards don't mismatch the warmed page. Only if the client wants the
fuller cream look.

---

## 5. Centralization codemod (reference)

`node centralize-colors.mjs <dir> [--apply]` — walks `.ts`/`.tsx`, rewrites
`PREFIX-[#hex]` → `PREFIX-[var(--token)]` picking the token by role:
- `text-`/`fill-`/`stroke-`/`placeholder-` → `--colors-text-*`
- `border-`/`divide-`/`ring-`/`outline-` → `--colors-border-*`
- `bg-`/`from-`/`via-`/`to-` → `--colors-bg-*` (or brand/secondary scale for brand hexes)

Every mapped hex must equal its token's *current* value so the adoption pass is a verified
no-op. **Never rewrite quoted `'#hex'`/`"#hex"`** (SVG-attribute / Recharts safety).

Verify each slice: `npx tsc --noEmit` + `npx next build` (expect "Compiled successfully"),
and grep for `(fill|stroke|stopColor)="var\(` to confirm no `var()` leaked into an SVG
attribute.

---

## 6. Current committed token values (globals.css, post-B2)

```
--rbg-50..900:            Rich blue green (#e8edee … #092122)
--colors-brand-25..950:   Rich blue green (25=#e8edee, 50..900 JSON, 950=#092122)
--colors-secondary-25..950:
   25 #fafcfb  50 #eff6f3  100 #e7f1ed  200 #dcebe4  300 #d5e7df   (tranquil mint)
   400 #457175                                                      (rich blue green-400 — progress fill)
   500 #457175 600 #164e52 700 #14474b 800 #10373a 900 #0c2b2d 950 #092122  (rich blue green)
--colors-bg-secondary #fbfbfa  bg-tertiary #f6f6f4  bg-quaternary #e9e7e3  (bg-primary #ffffff KEPT)
--colors-border-primary #d9d5ce  border-secondary #e9e7e3  border-tertiary #f0efec
--colors-text-*:          UNCHANGED (kept)
--brand-primary #164e52  --brand-tertiary #d5e7df  --brand-text #101828  --brand-background #ffffff
```

---

## 7. How to resume

1. Read this doc + [`new-color-brand.json`](new-color-brand.json).
2. Pick the next pending item in **Phase B3** (badges → charts → accents, usually).
3. Make token/component edits using **only JSON hexes**; keep system colors + text + white
   cards untouched unless the client changes a rule.
4. `tsc` + `next build` after each change; review on each side; commit locally per step.
5. Update the memory note [[project_branding_migration]] as phases complete.
