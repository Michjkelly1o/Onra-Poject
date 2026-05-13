# /build-component

> **Purpose:** Build a single UI component from the Onra Design System Figma file with 100% visual and behavioral fidelity. This skill reads the selected Figma component, understands all its variants and states, maps colors correctly (tokens or raw hex), and produces a production-ready TypeScript React component.

---

## Before You Start

1. The user must have the component **selected in Figma** (or provide a direct node URL)
2. If `/sync-tokens` has not been run yet, proceed anyway — use raw color values from Figma and add a `/* TODO: replace with token */` comment
3. Check `src/components/ui/` for an existing version of this component before building a new one

---

## Step 1 — Read the Component from Figma

Call `mcp__plugin_figma_figma__get_design_context` with the selected node.

From the response, extract:
- **Screenshot** — use this as the visual ground truth for layout, spacing, and visual style
- **Code output** — use as a structural reference, NOT as final code (it may have absolute positioning or wrong class names)
- **Component name** — the Figma layer name
- **Variant properties** — look for Figma variant groups (e.g. `Size=sm,md,lg`, `Intent=primary,secondary,ghost`, `State=default,hover,disabled`)

If `get_design_context` returns an error (nothing selected), ask the user to select the component in Figma first, or provide the direct URL.

---

## Step 2 — Identify All Variants

A component typically has these variant axes. Identify each one from Figma:

### Size Variants
- `sm` — smaller padding, font size, icon size
- `md` — default/base size
- `lg` — larger size
- Check the Figma screenshot for pixel differences between sizes

### Intent / Color Variants
- `default` or `primary` — main brand color action
- `secondary` — less prominent, often outlined or muted background
- `ghost` — transparent background, visible on hover
- `destructive` — red/error color for dangerous actions
- `outline` — border only, no fill
- `link` — looks like a text link

### State Variants
Every component must handle ALL these states — check the Figma for each:
- **Default** — normal resting state
- **Hover** — cursor over element (`:hover`)
- **Focus** — keyboard focused (`:focus-visible`) — must have visible ring/outline for accessibility
- **Active** — being clicked/pressed (`:active`)
- **Disabled** — non-interactive, reduced opacity or muted colors
- **Loading** — spinner replaces content, button still shows but is not clickable
- **Error** — for form inputs: red border, error message below
- **Success** — for form inputs: green border or checkmark

If a state is NOT shown in Figma, apply a reasonable visual treatment:
- Hover: slightly darken/lighten background by 10%
- Focus: add `ring-2 ring-ring ring-offset-2`
- Active: scale down slightly `scale-[0.98]` or darken more than hover
- Disabled: `opacity-50 cursor-not-allowed pointer-events-none`

---

## Step 3 — Map Colors

### Priority Order (always follow this):
1. **CSS variable via Tailwind token** — e.g. `bg-primary`, `text-foreground`, `border-border`
2. **Primitive from DS palette** — e.g. `bg-brand-600`, `text-neutral-500`
3. **Raw hex as Tailwind arbitrary value** — e.g. `bg-[#1A56DB]` — use only if no token match found
4. **Never guess** a token — if unsure, use the raw hex from Figma and add a comment

When reading a component from Figma:
- Cross-reference every color against the tokens in `tailwind.config.ts`
- If the hex matches a primitive value → use the primitive token
- If the hex matches a semantic variable → use the semantic token
- If no match → use `bg-[#hex]` and note it for future token alignment

---

## Step 4 — Build the Component

### File Location
```
src/components/ui/[component-name].tsx
```

For complex components with sub-parts, use a folder:
```
src/components/ui/[component-name]/
  index.tsx       — main export
  [component-name].tsx  — implementation
  types.ts        — TypeScript types/interfaces
```

### Component Structure

```tsx
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// Define all variants using CVA
const componentVariants = cva(
  // base classes — always applied
  'base-classes-here',
  {
    variants: {
      intent: {
        primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
      },
    },
    defaultVariants: {
      intent: 'primary',
      size: 'md',
    },
  }
)

interface ComponentProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof componentVariants> {
  // add any extra props (loading, icon, etc.)
}

export function ComponentName({ intent, size, className, ...props }: ComponentProps) {
  return (
    <element
      className={cn(componentVariants({ intent, size }), className)}
      {...props}
    />
  )
}
```

### Rules
- Always import icons from `@untitledui/icons` — never lucide-react or any other icon library
- Always use `class-variance-authority` (CVA) for variants
- Always use `cn()` from `@/lib/utils` for class merging
- Always accept `className` prop for external overrides
- Export both the component AND the variants: `export { ComponentName, componentVariants }`
- Use `forwardRef` for all interactive elements (input, button, select, etc.)
- Add `displayName` when using forwardRef

### Animations & Transitions
- Use `transition-colors duration-200` for color changes
- Use `transition-all duration-150` for size/transform changes
- Match the exact easing/duration from Figma if specified in the design
- Use `animate-spin` for loading spinners

---

## Step 5 — Handle Complex Component Types

### Form Inputs
Must include:
- Label (above input)
- Input field with all states (default, focus, error, disabled)
- Helper text (below input, muted)
- Error message (below input, destructive color)
- Left/right icon slots

### Dropdowns / Selects
- Use Radix UI `Select` as base primitive
- Style to match Figma exactly using CVA + custom CSS
- Popover/dropdown animation: fade + slight slide down

### Modals / Dialogs
- Use Radix UI `Dialog` as base
- Overlay: `bg-black/50 backdrop-blur-sm`
- Match exact padding, border-radius, shadow from Figma

### Tables
- Sticky header
- Row hover state
- Selectable rows if shown in Figma
- Empty state illustration/message

### Cards
- Match exact padding, border, shadow, radius from Figma
- Note hover lift effect if present

---

## Step 6 — Verify Visual Fidelity

After building, compare against the Figma screenshot:
1. Check spacing/padding matches (use px values from Figma if tokens don't match exactly)
2. Check font size, weight, color matches
3. Check border radius matches
4. Check all variant colors match (take a screenshot if possible)
5. Check icon sizes and positions

If spacing does not match a Tailwind scale value, use `p-[14px]` arbitrary values rather than the nearest approximation.

---

## Step 7 — Export and Document

At the bottom of the file, add a brief usage example as a comment:

```tsx
/*
Usage:
<Button intent="primary" size="md">Save Changes</Button>
<Button intent="destructive" size="sm" loading>Deleting...</Button>
<Button intent="outline" size="lg" disabled>Unavailable</Button>
*/
```

Update `src/components/ui/index.ts` to export the new component.

---

## Usage
```
/build-component
```
Select the component in Figma first, then run the skill. Optionally provide component name and target file path.
