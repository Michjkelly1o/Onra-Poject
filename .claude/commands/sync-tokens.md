# /sync-tokens

> **Purpose:** Read all design tokens from `tokens.json` (exported from Figma via the token export plugin) and map them into `tailwind.config.ts` and `src/app/globals.css`. This is a one-time setup skill — run before building any components or modules. The output becomes the single source of truth for all colors used throughout the prototype.

---

## Token Source

The project has a pre-exported `tokens.json` file at the project root. This is the primary source — **do not use Figma MCP for token syncing**. The file was exported from the Onra Design System Figma file using the token export plugin and contains:

- **`primitives.style`** — 399 raw color tokens (all color palettes with hex values)
- **`1-color-modes.light-mode`** — 345 semantic tokens for light mode
- **`1-color-modes.dark-mode`** — 345 semantic tokens for dark mode (mirrors light)

Total: 1,089 tokens.

### File Structure
```json
{
  "primitives": {
    "style": {
      "colors-brand-50": "#e9fbff",
      "colors-brand-100": "#dbf8ff",
      ...
      "colors-gray-light-mode-500": "#667085",
      ...
    }
  },
  "1-color-modes": {
    "light-mode": {
      "component-button-primary-bg": "#4b8c9a",
      "colors-text-primary": "#101828",
      ...
    },
    "dark-mode": {
      "component-button-primary-bg": "...",
      ...
    }
  }
}
```

> Note: the JSON file is double-encoded (the top level is a JSON string). Parse with `JSON.parse(JSON.parse(rawFile))` or `json.loads(json.load(f))` in Python.

---

## Primitive Color Families (399 tokens)

| Family | Shades | Notes |
|---|---|---|
| gray (multiple variants: light-mode, blue, cool, modern, neutral) | 120 | Main neutral palette |
| blue | 36 | |
| green, orange | 24 each | |
| brand | 12 | Primary brand color (teal/cyan) |
| error, warning, success | 12 each | Status colors |
| moss, teal, cyan, indigo, violet, purple, fuchsia, pink, rose, yellow | 12 each | Extended palette |
| secondary, tertiary | 12 each | |
| base | 3 | white, black |

---

## Step 1 — Read and Parse `tokens.json`

```python
import json
with open('tokens.json') as f:
    data = json.loads(json.load(f))

primitives = data['primitives']['style']       # 399 hex values
light_mode = data['1-color-modes']['light-mode']  # 345 semantic tokens
dark_mode  = data['1-color-modes']['dark-mode']   # 345 semantic tokens
```

---

## Step 2 — Understand the Two-Layer Color System

### Layer 1: Primitives (`primitives.style`)
Raw named colors with numeric scales. Key format: `colors-{family}-{shade}` → hex value.

Examples:
- `colors-brand-600` → `#4b8c9a` (primary brand)
- `colors-gray-light-mode-900` → `#101828` (near-black)
- `colors-error-500` → `#f04437` (error red)
- `colors-base-white` → `#ffffff`

These are **static values** — never change between light and dark mode. Used directly in components when a specific palette color is needed (e.g. `bg-brand-600`).

### Layer 2: Semantic Tokens (`1-color-modes`)
Purpose-based tokens that change between light and dark mode. Two sub-categories:

**`colors-*` tokens (102)** — General UI purpose colors:
- Text, background, border, surface colors
- Format: `colors-{purpose}-{variant}` (e.g. `colors-text-primary`, `colors-bg-secondary`)

**`component-*` tokens (243)** — Component-specific colors:
- Button states, input states, badge colors, etc.
- Format: `component-{component}-{variant}-{property}` (e.g. `component-button-primary-bg`, `component-input-border-focus`)

### Handling Raw Hex in Components
Some Figma components may use primitive hex values directly (not a semantic token). When building a component and you encounter a hex color:
1. Look it up in `primitives.style` by value — find its token name
2. If found → use the Tailwind primitive token (e.g. `bg-brand-600`)
3. If it matches a semantic token value → use the semantic CSS variable (e.g. `bg-primary`)
4. If no match → use raw hex as Tailwind arbitrary value: `bg-[#4b8c9a]` with comment `/* custom: not in DS */`
5. Never guess — visual fidelity takes priority over token correctness

---

## Step 3 — Write `tailwind.config.ts`

Map ALL primitives as static color values, and ALL semantic tokens as CSS variable references.

### Primitives — static colors
Convert `colors-brand-600` → Tailwind nested object `brand: { 600: '#4b8c9a' }`:

```ts
colors: {
  // Primitives — static hex values, used directly
  brand: {
    25: '#f9feff', 50: '#e9fbff', 100: '#dbf8ff',
    200: '#ccf6ff', 300: '#bdf3ff', 400: '#92d1de',
    500: '#6baebc', 600: '#4b8c9a', 700: '#306b78',
    800: '#1b4c56', 900: '#0c2d34', 950: '#030e10',
  },
  gray: {
    25: '#fcfcfd', 50: '#f9fafb', 100: '#f2f4f7',
    200: '#e4e7ec', 300: '#d0d5dd', 400: '#98a1b2',
    500: '#667085', 600: '#475467', 700: '#344054',
    800: '#18212f', 900: '#101828', 950: '#0c111d',
  },
  error: {
    25: '#fefafa', 50: '#fef2f1', 100: '#fee3e1',
    300: '#fca19b', 400: '#f97066', 500: '#f04437',
    600: '#d92c20', 700: '#b32218', 900: '#7a2619',
  },
  warning: { /* same pattern */ },
  success: { /* same pattern */ },
  // ... all other families
  
  // Semantic tokens — CSS variable references (light/dark mode aware)
  background: 'hsl(var(--background))',
  foreground: 'hsl(var(--foreground))',
  primary: {
    DEFAULT: 'hsl(var(--primary))',
    foreground: 'hsl(var(--primary-foreground))',
  },
  // ... map all component-* and colors-* semantic tokens
}
```

### Semantic token naming convention
Convert `component-button-primary-bg` → CSS variable `--component-button-primary-bg`.
Convert `colors-text-primary` → CSS variable `--colors-text-primary`.

---

## Step 4 — Write `src/app/globals.css`

Write all semantic tokens as CSS custom properties. Convert hex to HSL for Tailwind compatibility (format: channel numbers only, no `hsl()` wrapper).

```css
:root {
  /* colors-* semantic tokens */
  --colors-text-primary: 220 43% 11%;       /* #101828 */
  --colors-bg-primary: 0 0% 100%;           /* #ffffff */
  /* ... all 102 colors-* tokens */

  /* component-* tokens */
  --component-button-primary-bg: 190 34% 45%;    /* #4b8c9a */
  --component-button-primary-hover: ...;
  /* ... all 243 component-* tokens */
}

.dark {
  /* override with dark-mode values */
  --colors-text-primary: ...;
  --colors-bg-primary: ...;
  /* ... all 345 dark mode tokens */
}
```

If hex-to-HSL conversion introduces rounding errors that shift the color visibly, keep the hex value and use `bg-[#hex]` in Tailwind instead.

---

## Step 5 — Confirm and Report

After writing both files, output:
```
✓ Primitives: 399 tokens → tailwind.config.ts static colors
✓ Semantic light-mode: 345 tokens → :root CSS variables
✓ Semantic dark-mode: 345 tokens → .dark CSS variables
  ↳ colors-* tokens: 102
  ↳ component-* tokens: 243
⚠ Flagged: [list any tokens skipped or needing manual review]
```

Show summary and wait for user confirmation before writing files.

---

## Usage
```
/sync-tokens
```
No arguments needed. Reads `tokens.json` from the project root automatically. Run once before building any components.

If `tokens.json` is updated with a new export from Figma, run `/sync-tokens` again — it will overwrite only the token-related sections of `tailwind.config.ts` and `globals.css`.
